// Playing together: accounts, the LAN relay, a world with more than one
// player in it, and the host and a player's copy of it kept the same.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { makeGame, stubInput, stubUI, stubRenderer } from './helpers.mjs';
import { Game } from '../src/game/game.js';
import { Creature } from '../src/entities/creature.js';
import { DungeonRun } from '../src/game/dungeon.js';
import { FY } from '../src/world/dungeongen.js';
import { seatField } from '../src/game/party.js';
import { B } from '../src/world/blocks.js';
import { siteBlocks } from '../src/world/sites.js';
import { Accounts, nameProblem, profileOf, cleanDesc, wordCount, DESC_WORDS, cleanIcon } from '../src/net/account.js';
import { MachineSync } from '../src/net/machine.js';
import { MachineStore } from '../tools/store.mjs';
import { SaveStore } from '../src/game/saves.js';
import { EventEmitter } from 'node:events';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { HostNet } from '../src/net/host.js';
import { GuestNet } from '../src/net/guest.js';
import { MAX_PLAYERS, NET_VERSION, openEnvelope, toPlayer, toRelay } from '../src/net/protocol.js';
import { packGrid, unpackGrid } from '../src/net/uiwire.js';
import { Grid } from '../src/ui/ascii.js';
import { Relay } from '../tools/relay.mjs';
import { rankAddresses, addressFor, broadcastAddresses, parseQuery, queryPacket, answerPacket, readAnswer, beaconText, readBeacon, Nearby, MDNS_NAME } from '../tools/lan.mjs';
import { networkWorlds } from '../src/ui/multiplayer.js';

const memStore = () => {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
};
const uiStub = () => {
  const u = stubUI();
  u.windows = [];
  u.update = () => {};
  u.find = () => null;
  u.closeAll = () => {};
  return u;
};
const keyInput = () => {
  const inp = stubInput();
  inp.keys = new Set();
  inp.isDown = (k) => inp.keys.has(k);
  return inp;
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// ------------------------------------------------------------ accounts
test('accounts: a name for good, a picture and words that can change', () => {
  assert.ok(nameProblem('ab'));
  assert.ok(nameProblem('no/slashes'));
  assert.equal(nameProblem('Wren_7'), null);
  const st = memStore();
  const a = new Accounts(st);
  assert.equal(a.profile, null);
  a.create('Wren', { shape: 'moon', color: '#70c8ff', bg: '#1e2a44' }, '  Likes   boats.  ');
  assert.equal(a.profile.desc, 'Likes boats.');
  a.update({ icon: { shape: 'gem', color: '#ff7060', bg: '#3a1e1e' }, desc: 'Likes rafts.', name: 'Changed' });
  const again = new Accounts(st);
  assert.equal(again.profile.name, 'Wren', 'the name stays');
  assert.equal(again.profile.icon.shape, 'gem');
  assert.equal(again.profile.desc, 'Likes rafts.');
  // (Carried to another browser by its code.)
  const code = again.exportCode();
  const elsewhere = new Accounts(memStore());
  elsewhere.importCode(code);
  assert.equal(elsewhere.profile.id, again.profile.id);
  assert.equal(elsewhere.profile.name, 'Wren');
  assert.throws(() => elsewhere.importCode('nonsense'));
});

test('accounts: a friend request asked, answered, and both are friends', () => {
  const a = new Accounts(memStore());
  const b = new Accounts(memStore());
  a.create('Asha', null, '');
  b.create('Bram', null, '');
  assert.ok(a.sentRequest(b.profile));
  assert.ok(a.hasSent(b.profile.id));
  assert.ok(b.gotRequest(a.profile), 'a new request');
  assert.equal(b.gotRequest(a.profile), false, 'not twice');
  b.answer(a.profile.id, true);
  a.befriend(b.profile);
  assert.ok(a.isFriend(b.profile.id) && b.isFriend(a.profile.id));
  assert.equal(a.hasSent(b.profile.id), false);
  // (Asked each other at once: friends straight away.)
  const c = new Accounts(memStore());
  const d = new Accounts(memStore());
  c.create('Cato', null, '');
  d.create('Dell', null, '');
  c.sentRequest(d.profile);
  d.sentRequest(c.profile);
  c.gotRequest(d.profile);
  assert.ok(c.isFriend(d.profile.id));
});

// ------------------------------------------------------------ the relay
test('accounts: a title, frames and patterns, and forty words about you at most', () => {
  const words = Array.from({ length: 55 }, (_, i) => `w${i}`).join(' ');
  assert.equal(wordCount(cleanDesc(words)), DESC_WORDS);
  assert.equal(cleanDesc('  Likes    boats.  '), 'Likes boats.');
  assert.deepEqual(cleanIcon({ shape: 'ship', color: '#50e0c8', bg: '#101018', pattern: 'stars', frame: 'gold' }), { shape: 'ship', color: '#50e0c8', bg: '#101018', pattern: 'stars', frame: 'gold' });
  assert.equal(cleanIcon({ frame: 'nonsense' }).frame, 'plain');
  const a = new Accounts(memStore());
  a.create('Wren', { shape: 'cat', frame: 'rune' }, 'Hello there.', 'Sailor');
  assert.equal(a.profile.title, 'Sailor');
  assert.equal(a.profile.icon.frame, 'rune');
  a.update({ title: 'Not a title' });
  assert.equal(a.profile.title, '', 'only the titles there are');
  const b = new Accounts(memStore());
  a.update({ title: 'Bard' });
  b.importCode(a.exportCode());
  assert.equal(b.profile.title, 'Bard', 'carried by the code');
});

// The game's server, kept in memory, and a browser's fetch that reaches it
// (from this machine, or from another at `ip`).
function machineServer() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tessera-store-'));
  const store = new MachineStore(dir);
  const fetchFrom = (ip = null) => async (url, { method = 'GET', body = null, headers = {} } = {}) => {
    const req = new EventEmitter();
    req.method = method;
    req.headers = Object.fromEntries(Object.entries(headers || {}).map(([k, v]) => [k.toLowerCase(), v]));
    let code = 0;
    let out = '';
    const done = new Promise((resolve) => {
      const res = { writeHead: (c) => {
        code = c;
      }, end: (b = '') => {
        out = String(b);
        resolve();
      } };
      store.handle(req, res, url, ip ? `ip-${ip}` : 'local', !ip);
    });
    if (method === 'PUT') {
      req.emit('data', Buffer.from(String(body)));
      req.emit('end');
    }
    await done;
    return { ok: code >= 200 && code < 300, status: code, json: async () => JSON.parse(out), text: async () => out };
  };
  return { dir, store, fetchFrom };
}

// A browser at one address: its own storage, account and saves.
function browserAt(fetch) {
  const st = memStore();
  const accounts = new Accounts(st);
  const saves = new SaveStore(st);
  return { st, accounts, saves, sync: new MachineSync({ storage: st, accounts, store: saves, fetch }) };
}

const fakeGame = (name) => ({
  playerName: 'Wren', day: 3, minute: 600, seed: 42, currentSettlement: { name: 'Bramley' }, player: { x: 0, z: 0 },
  partyWorld: { name }, partyChars: new Map(), seats: [], serialize: () => ({ v: 9, seed: 42, party: { world: { name } } }),
});

test('machine: the account and worlds are the same at every address the game is opened at', async () => {
  const { dir, fetchFrom } = machineServer();
  // At localhost: an account made, a world hosted and saved.
  const A = browserAt(fetchFrom());
  assert.ok(await A.sync.start());
  A.accounts.create('Wren', { shape: 'ship' }, 'Hello.', 'Sailor');
  await A.saves.save('mp1', fakeGame('Testland'));
  await A.sync.chain;
  // At the network address (a stranger to localhost's storage): the same.
  const B = browserAt(fetchFrom());
  assert.equal(B.accounts.account, null);
  assert.ok(await B.sync.start());
  assert.equal(B.accounts.profile.name, 'Wren', 'the account came with it');
  assert.equal(B.accounts.profile.title, 'Sailor');
  assert.equal(B.saves.worlds().length, 1, 'and the world');
  assert.equal((await B.saves.load('mp1')).party.world.name, 'Testland');
  // Changed there, it's changed here next time; deleted there, gone here.
  B.accounts.update({ desc: 'Back again.' });
  B.saves.remove('mp1');
  await B.sync.chain;
  const A2 = browserAt(fetchFrom());
  A2.st.setItem('tessera-account-v1', A.st.getItem('tessera-account-v1'));
  A2.accounts.reload();
  await A2.saves.save('mp1', fakeGame('Old copy'));
  // (Saved here before it was deleted there: older, so it goes.)
  const ix = A2.saves.index();
  ix.mp1.savedAt = 1;
  A2.saves.writeIndex(ix);
  A2.saves.onChange = null;
  assert.ok(await A2.sync.start());
  assert.equal(A2.accounts.profile.desc, 'Back again.');
  assert.equal(A2.saves.worlds().length, 0);
  // Another machine on the network: only its account is kept here.
  const far = fetchFrom('192.168.1.40');
  const C = browserAt(far);
  assert.ok(await C.sync.start());
  assert.equal(C.accounts.account, null, 'not this machine\'s account');
  C.accounts.create('Bram', null, '');
  await C.sync.chain;
  const C2 = browserAt(far);
  await C2.sync.start();
  assert.equal(C2.accounts.profile.name, 'Bram', 'theirs, at any address on this server');
  assert.equal((await far('/api/store/save-mp1', { method: 'PUT', body: '{}' })).status, 403, 'no worlds from elsewhere');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('relay: one host from this machine, players passed through, kicks and bans', async () => {
  const relay = new Relay({ port: 0, max: MAX_PLAYERS, addrs: () => ['10.0.0.5'] });
  const server = http.createServer((q, r) => r.end('x'));
  server.on('upgrade', (req, s) => relay.upgrade(req, s));
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  const open = (hello) => new Promise((res) => {
    const ws = new globalThis.WebSocket(`ws://127.0.0.1:${port}/net`);
    const got = [];
    ws.onmessage = (e) => got.push(String(e.data));
    ws.onopen = () => {
      ws.send(JSON.stringify(hello));
      res({ ws, got });
    };
  });
  try {
    const lobby = await open({ t: 'hello', v: NET_VERSION, role: 'lobby', account: { id: 'l1', name: 'Lobbyist' } });
    const host = await open({ t: 'hello', v: NET_VERSION, role: 'host', account: { id: 'h1', name: 'Hosty' }, world: { name: 'Testland' } });
    await wait(60);
    assert.equal(JSON.parse(host.got[0]).t, 'hosting');
    assert.equal(relay.info().host.name, 'Testland');
    assert.equal(relay.info().host.hostName, 'Hosty');
    assert.ok(lobby.got.some((s) => JSON.parse(s).t === 'host' && JSON.parse(s).host), 'the title screen is told');
    // (A second host on the same machine is turned away.)
    const other = await open({ t: 'hello', v: NET_VERSION, role: 'host', account: { id: 'h2', name: 'Other' } });
    await wait(40);
    assert.equal(JSON.parse(other.got[0]).why, 'busy');
    // A player: the host hears of them, and their words come through.
    const guest = await open({ t: 'hello', v: NET_VERSION, role: 'guest', account: { id: 'g1', name: 'Guesty' } });
    await wait(60);
    const join = openEnvelope(host.got.find((s) => s.includes('"join"')));
    assert.equal(join.ctl.t, 'join');
    assert.equal(join.ctl.account.name, 'Guesty');
    const cid = join.ctl.cid;
    guest.ws.send(JSON.stringify({ t: 'in', k: ['KeyD'] }));
    const big = 'x'.repeat(150000);
    host.ws.send(toPlayer(cid, JSON.stringify({ t: 's', big })));
    await wait(80);
    assert.ok(host.got.some((s) => s.startsWith(`@${cid}|`) && s.includes('KeyD')));
    assert.ok(guest.got.some((s) => s.length > 150000), 'a big snapshot comes through whole');
    // An invitation to someone at the title screen.
    host.ws.send(toRelay({ t: 'invite', to: 'l1', invite: { from: { name: 'Hosty' }, world: 'Testland' } }));
    await wait(40);
    assert.ok(lobby.got.some((s) => JSON.parse(s).t === 'invite'));
    // Kicked, then banned: turned away at the door.
    host.ws.send(toRelay({ t: 'kick', cid, why: 'bye' }));
    await wait(60);
    assert.ok(guest.got.some((s) => s.includes('"kicked"')));
    host.ws.send(toRelay({ t: 'bans', ids: ['g1'] }));
    await wait(20);
    const back = await open({ t: 'hello', v: NET_VERSION, role: 'guest', account: { id: 'g1', name: 'Guesty' } });
    await wait(60);
    assert.equal(JSON.parse(back.got[0]).why, 'banned');
    // (A different version of the game: turned away.)
    const old = await open({ t: 'hello', v: NET_VERSION + 1, role: 'guest', account: { id: 'g9', name: 'Old' } });
    await wait(40);
    assert.equal(JSON.parse(old.got[0]).why, 'version');
    for (const c of [lobby, host, other, guest, back, old]) c.ws.close();
  } finally {
    server.close();
    server.closeAllConnections?.();
  }
});

// ------------------------------------------------------------ finding each other
test('lan: the address friends can reach comes first, not a virtual machine\'s', () => {
  const ifaces = {
    'vEthernet (WSL)': [{ family: 'IPv4', address: '172.25.80.1', netmask: '255.255.240.0', internal: false }],
    'VirtualBox Host-Only Network': [{ family: 'IPv4', address: '192.168.56.1', netmask: '255.255.255.0', internal: false }],
    'Wi-Fi': [{ family: 'IPv4', address: '192.168.1.23', netmask: '255.255.255.0', internal: false }, { family: 'IPv6', address: 'fe80::1', internal: false }],
    'Loopback Pseudo-Interface 1': [{ family: 'IPv4', address: '127.0.0.1', netmask: '255.0.0.0', internal: true }],
    docker0: [{ family: 'IPv4', address: '172.17.0.1', netmask: '255.255.0.0', internal: false }],
    'Ethernet 2': [{ family: 'IPv4', address: '169.254.10.4', netmask: '255.255.0.0', internal: false }],
  };
  const r = rankAddresses(ifaces);
  assert.equal(r[0].address, '192.168.1.23', 'the Wi-Fi');
  assert.equal(r.length, 5, 'IPv4 only, not this machine\'s own loopback');
  assert.equal(r[r.length - 1].address, '169.254.10.4', 'no network at all: last');
  // (A Mac's: en0 is its Wi-Fi; utun a VPN.)
  const mac = rankAddresses({ utun3: [{ family: 'IPv4', address: '10.8.0.2', netmask: '255.255.255.0', internal: false }], en0: [{ family: 'IPv4', address: '10.0.0.14', netmask: '255.255.255.0', internal: false }] });
  assert.equal(mac[0].address, '10.0.0.14');
  // Answered from the address on the asker's own network.
  assert.equal(addressFor('192.168.56.10', r), '192.168.56.1');
  assert.equal(addressFor('::ffff:192.168.1.40', r), '192.168.1.23');
  assert.equal(addressFor('8.8.8.8', r), '192.168.1.23');
  assert.ok(broadcastAddresses(r).includes('192.168.1.255'));
});

test('lan: "tessera.local" asked for on the network, and answered', () => {
  const q = parseQuery(queryPacket(MDNS_NAME, { id: 77 }));
  assert.equal(q.id, 77);
  assert.equal(q.questions[0].name, 'tessera.local');
  assert.equal(q.questions[0].type, 1);
  // An answer isn't a question.
  assert.equal(parseQuery(answerPacket(MDNS_NAME, '192.168.1.23')), null);
  assert.equal(readAnswer(answerPacket(MDNS_NAME, '192.168.1.23'), 'tessera.local'), '192.168.1.23');
  // A plain resolver's question: its id and question echoed back.
  const legacy = answerPacket(MDNS_NAME, '10.0.0.14', { id: 77, legacy: true });
  assert.equal(legacy.readUInt16BE(0), 77);
  assert.equal(readAnswer(legacy, 'TESSERA.local'), '10.0.0.14');
  // (Nonsense is ignored.)
  assert.equal(parseQuery(Buffer.from('hello')), null);
  assert.equal(parseQuery(Buffer.from([0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 63])), null);
});

test('lan: a world hosted elsewhere on the network is heard of, and forgotten when it\'s gone', () => {
  const world = { name: 'Testland', hostName: 'Hosty', hostIcon: null, players: 2, max: 4 };
  const text = beaconText({ id: 'abc', v: NET_VERSION, port: 8080, world });
  assert.equal(readBeacon(text, 'abc'), null, 'not our own');
  assert.equal(readBeacon('{"app":"other"}'), null);
  assert.equal(readBeacon('not json'), null);
  const b = readBeacon(text, 'mine');
  assert.equal(b.world.name, 'Testland');
  const near = new Nearby();
  near.heard(b, '192.168.1.40', 1000);
  assert.deepEqual(near.list(2000).map((n) => [n.addr, n.port, n.world.name]), [['192.168.1.40', 8080, 'Testland']]);
  assert.equal(near.list(20000).length, 0, 'not heard from in a while: gone');
  near.heard(b, '192.168.1.40', 30000);
  near.heard(readBeacon(beaconText({ id: 'abc', v: NET_VERSION, port: 8080, world: null }), 'mine'), '192.168.1.40', 30500);
  assert.equal(near.list(31000).length, 0, 'stopped hosting: gone at once');
  // The Multiplayer menu: the world at this address first, then those found.
  const lan = { host: { name: 'Here', hostName: 'Me', players: 1, max: 4 }, nearby: near.list(31000).concat([{ addr: '192.168.1.40', port: 8080, v: NET_VERSION, world }]) };
  const ws = networkWorlds(lan);
  assert.equal(ws[0].name, 'Here');
  assert.equal(ws[0].at, null);
  assert.deepEqual(ws[1].at, { addr: '192.168.1.40', port: 8080 });
  assert.deepEqual(networkWorlds(null), []);
  // And the relay says so.
  const relay = new Relay({ port: 0, addrs: () => ['10.0.0.5'], extra: () => ({ mdns: 'tessera.local', nearby: lan.nearby }) });
  assert.equal(relay.info().mdns, 'tessera.local');
  assert.equal(relay.info().nearby.length, 1);
  // A connection long silent (a laptop shut mid-game) is let go of, so the
  // world can be hosted again; one that answers its pings is kept.
  const quiet = { open: true, heard: 0, shut: 0, closed() {
    this.shut++;
    this.open = false;
  }, frame() {} };
  const alive = { open: true, heard: 50000, pings: 0, closed() {}, frame() {
    this.pings++;
  } };
  relay.socks.add(quiet);
  relay.socks.add(alive);
  relay.beat(60000);
  assert.equal(quiet.shut, 1);
  assert.equal(alive.pings, 1);
  assert.ok(!relay.socks.has(quiet));
});

test('ui frames: a window\'s cells packed and unpacked the same', () => {
  const g = new Grid(10, 3);
  g.text(1, 1, 'Hello ★', '#ffe070', '#100c18');
  g.put(0, 0, '█', '#ff0000');
  const back = unpackGrid(JSON.parse(JSON.stringify(packGrid(g))));
  assert.deepEqual(back.ch, g.ch);
  assert.deepEqual(back.fg.map((c, i) => (g.ch[i] === ' ' ? null : c)), g.fg.map((c, i) => (g.ch[i] === ' ' ? null : c || '#e8d8b0')));
  assert.deepEqual(back.bg, g.bg.map((c) => c || null));
});

// ------------------------------------------------------------ the party
function party(seed = 12345) {
  const game = makeGame(seed);
  const input = stubInput();
  game.minute = 10 * 60;
  for (let i = 0; i < 20; i++) game.update(0.1, input);
  game.startParty({ id: 'h', name: 'Hosty' });
  const gin = keyInput();
  const gui = stubUI();
  const seat = game.addSeat({ id: 'g', name: 'Guesty' }, { ui: gui, input: gin, hero: null });
  return { game, input, gin, gui, seat, gp: seat.ent };
}

test('party: each player their own character, standing and crimes', () => {
  const { game, input, gin, seat, gp } = party();
  assert.equal(game.everyone().length, 2);
  assert.ok(gp !== game.player);
  assert.ok(!(gp.x === game.player.x && gp.z === game.player.z), 'not on top of the host');
  // They walk on their own keys.
  const x0 = gp.x;
  const hx = game.player.x;
  gin.keys.add('KeyD');
  for (let i = 0; i < 30; i++) game.update(0.05, input);
  gin.keys.clear();
  assert.notEqual(gp.x, x0, 'the guest walked');
  assert.equal(game.player.x, hx, 'the host stood still');
  // What a townsperson thinks of each of them is their own.
  const npc = game.npcs.find((n) => !n.dead && n.rec);
  const hostOp = game.sim.opinion(npc);
  game.asPlayer(gp, () => game.sim.changeRep(npc, -30));
  assert.equal(game.sim.opinion(npc), hostOp, 'the host\'s standing unchanged');
  assert.ok(game.asPlayer(gp, () => game.sim.opinion(npc)) < hostOp, 'the guest\'s fell');
  // A blow the guest lands is the guest's crime, not the party's.
  const victim = game.npcs.find((n) => !n.dead && n.rec && n.rec.job !== 'guard' && n.settlement);
  game.damage(victim, 1, gp);
  const sid = victim.settlement.id;
  assert.ok(game.asPlayer(gp, () => game.sim.justice.pendingIn(sid).length) > 0);
  assert.equal(game.sim.justice.pendingIn(sid).length, 0);
  // Leaving keeps their character for next time.
  const inv = JSON.stringify(gp.inv);
  const at = [gp.x, gp.z];
  game.removeSeat(seat);
  assert.equal(game.everyone().length, 1);
  assert.ok(game.partyChars.has('g'));
  const back = game.addSeat({ id: 'g', name: 'Guesty' }, { ui: stubUI(), input: keyInput(), hero: null });
  assert.equal(JSON.stringify(back.ent.inv), inv);
  assert.deepEqual([back.ent.x, back.ent.z], at);
  assert.ok(game.asPlayer(back.ent, () => game.sim.opinion(npc)) < hostOp, 'their standing kept too');
  assert.ok(game.asPlayer(back.ent, () => game.sim.justice.pendingIn(sid).length) > 0, 'and their crimes');
});

test('party: a guard halts the player who did the crime, and only that player sees it', () => {
  const { game, gui, gp } = party();
  const victim = game.npcs.find((n) => !n.dead && n.rec && n.rec.job !== 'guard' && n.settlement);
  game.damage(victim, 1, gp);
  const sid = victim.settlement.id;
  assert.ok(game.asPlayer(gp, () => game.isWanted(sid)), 'the guest is wanted');
  assert.ok(!game.isWanted(sid), 'the host isn\'t');
  const seen = { host: 0, guest: 0 };
  game.ui.openHalt = () => seen.host++;
  gui.openHalt = () => seen.guest++;
  const g = game.guardsOf(sid).find((q) => !q.dead && !q.sleeping);
  assert.ok(g);
  const spot = game.findFreeSpot(gp.x + 1, gp.z, gp.y);
  g.teleport(spot.x, spot.y, spot.z);
  g.engage(gp);
  for (let i = 0; i < 10 && !seen.guest && !seen.host; i++) g.fight(0.05);
  assert.equal(seen.host, 0, 'not on the host\'s screen');
  assert.equal(seen.guest, 1, 'on the guest\'s');
  // Come quietly: the guard leads the guest, not the host.
  game.asPlayer(gp, () => game.sim.justice.surrender(sid, g));
  assert.ok(gp.restrained && !game.player.restrained);
  assert.equal(g.state, 'escort');
  for (let i = 0; i < 5; i++) g.escortWalk(0.05);
  assert.equal(g.state, 'escort', 'still leading them');
});

test('party: players hurt each other only when the host allows it', () => {
  const { game, input, gp } = party();
  const hp0 = gp.hp;
  game.damage(gp, 2, game.player);
  assert.equal(gp.hp, hp0, 'friends, unless the host says otherwise');
  game.pvp = true;
  game.damage(gp, 2, game.player);
  assert.ok(gp.hp < hp0, 'with fighting allowed, the blow lands');
  // A swing at them, standing beside you, lands as on anyone.
  const p = game.player;
  const spot = game.findFreeSpot(p.x + 1, p.z, p.y);
  gp.teleport(spot.x, spot.y, spot.z);
  const hp1 = gp.hp;
  p.attackCd = 0;
  game.attack(gp);
  for (let i = 0; i < 20; i++) game.update(0.05, input);
  assert.ok(gp.hp < hp1, 'struck');
  // (Kept with the world.)
  game.partyWorld = { name: 'Testland' };
  const save = JSON.parse(JSON.stringify(game.serialize()));
  assert.equal(save.party.pvp, true);
  const again = new Game({ seed: save.seed, renderer: stubRenderer(), audio: null, ui: stubUI(), save });
  assert.equal(again.pvp, true);
});

test('party: a beast goes for one of you, the nearest', () => {
  const { game, input, gp } = party();
  // The guest well off from the host.
  const s = game.findFreeSpot(game.player.x + 14, game.player.z + 6, game.player.y);
  gp.teleport(s.x, s.y, s.z);
  game.moveEntity(gp, s.x, s.y, s.z);
  game.minute = 23 * 60;
  // (Level with them, a few paces off.)
  const at = game.findFreeSpot(gp.x + 3, gp.z, gp.y);
  const sk = new Creature(game, 'skeleton', at.x, at.y, at.z);
  game.addCreature(sk);
  // (Entities compared as yes or no: a failure would print the whole world.)
  assert.ok(game.findPrey(sk, 12) === gp, 'the guest is its prey');
  const seen = new Set();
  for (let i = 0; i < 80 && !sk.dead; i++) {
    game.update(0.05, input);
    if (sk.target) seen.add(sk.target);
  }
  assert.ok(seen.has(gp), 'it went for the guest');
  assert.ok(!seen.has(game.player), 'never the host, far off');
  assert.ok(![...seen].some((q) => q.kind === 'player' && q !== gp), 'no other player');
  // (No one hurts another player.)
  const hp = gp.hp;
  game.damage(gp, 5, game.player);
  assert.equal(gp.hp, hp);
});

test('party: a dungeon\'s traps catch any of you, not only the host', () => {
  const { game, input, gp } = party();
  const rec = { ...game.sim.dungeons.all.find((d) => d.type === 'barrow'), floors: {}, cleared: false, pack: null };
  new DungeonRun(game, rec).enter();
  for (let i = 0; i < 5; i++) game.update(0.05, input);
  const d = game.dungeon;
  assert.ok(game.world.inInstance(gp.x), 'the guest came down');
  // Spikes under the guest (and not the host).
  game.world.setBlock(gp.x, gp.y, gp.z, B.spikes);
  d.data.spikes = [{ x: gp.x, z: gp.z, phase: 0 }];
  const hp = gp.hp;
  const hostHp = game.player.hp;
  for (let i = 0; i < 80 && gp.hp === hp; i++) {
    d.t += 0.1;
    d.spikesTick(0.1);
  }
  assert.ok(gp.hp < hp, 'the guest was spiked');
  assert.equal(game.player.hp, hostHp);
});

test('party: time only races when everyone sleeps', () => {
  const { game, seat } = party();
  game.sleepFast = 40;
  assert.equal(game.timeRate(), 1);
  seat.store.g.sleepFast = 40;
  assert.equal(game.timeRate(), 40);
});

test('party: the world\'s save keeps everyone\'s characters', () => {
  const { game, gp } = party();
  game.partyWorld = { name: 'Testland' };
  gp.give('coin', 77);
  const coins = gp.inv.reduce((n, s) => n + (s && s.item === 'coin' ? s.count : 0), 0);
  const save = JSON.parse(JSON.stringify(game.serialize()));
  assert.equal(save.party.world.name, 'Testland');
  const ch = new Map(save.party.chars).get('g');
  assert.ok(ch, 'the guest\'s character is in the save');
  const again = new Game({ seed: save.seed, renderer: stubRenderer(), audio: null, ui: stubUI(), save });
  assert.equal(again.partyWorld.name, 'Testland');
  again.startParty({ id: 'h', name: 'Hosty' });
  const seat = again.addSeat({ id: 'g', name: 'Guesty' }, { ui: stubUI(), input: keyInput(), hero: null });
  assert.equal(seat.ent.inv.reduce((n, s) => n + (s && s.item === 'coin' ? s.count : 0), 0), coins);
});

// ------------------------------------------------------------ host and player
// A host and a player joined through a relay kept in memory: what one
// sees is what the other does.
function linked() {
  const game = makeGame(12345);
  const input = stubInput();
  game.minute = 10 * 60;
  for (let i = 0; i < 20; i++) game.update(0.1, input);
  const queue = [];
  let guestNet = null;
  const toGuest = [];
  const hostNet = new HostNet(game, {
    send: (text) => {
      if (text[0] === '@') {
        const body = text.slice(text.indexOf('|') + 1);
        toGuest.push(body);
        queue.push(() => guestNet.receive(body));
      }
    },
    profile: { id: 'h', name: 'Hosty' },
    world: { name: 'Testland' },
    makeUI: () => uiStub(),
  });
  const flush = () => {
    while (queue.length) queue.shift()();
  };
  const out = { game, input, hostNet, toGuest, gg: null, ended: null };
  guestNet = new GuestNet({
    send: (text) => queue.push(() => hostNet.receive(`@7|${text}`)),
    profile: { id: 'g', name: 'Guesty' },
    build: (save) => (out.gg = new Game({ seed: save.seed, renderer: stubRenderer(), audio: null, ui: uiStub(), save, remote: true })),
    onNeedHero: () => guestNet.sendHero(null),
    onEnd: (why) => {
      out.ended = why;
    },
  });
  out.guestNet = guestNet;
  out.gin = keyInput();
  out.step = (n) => {
    for (let i = 0; i < n; i++) {
      game.update(0.05, input);
      flush();
      if (out.gg) out.gg.update(0.05, out.gin);
      flush();
    }
  };
  hostNet.receive('!' + JSON.stringify({ t: 'join', cid: 7, account: { id: 'g', name: 'Guesty' } }));
  flush();
  out.step(5);
  return out;
}

test('host and player: the same world on both screens', () => {
  const L = linked();
  const { game, gg, guestNet } = L;
  assert.ok(gg, 'the player\'s copy of the world was made');
  assert.equal(game.seats.length, 2);
  const welcome = JSON.parse(L.toGuest.find((s) => s.includes('"welcome"')));
  assert.equal(welcome.save.party, null, 'the others\' characters aren\'t sent');
  const gp = game.seats[1].ent;
  // They walk; both screens agree where they are.
  L.gin.keys.add('KeyD');
  L.step(20);
  L.gin.keys.clear();
  L.step(5);
  assert.deepEqual([gg.player.x, gg.player.z], [gp.x, gp.z]);
  // The host, as the player sees them.
  const hostSeen = guestNet.ents.get(game.player.id);
  assert.deepEqual([hostSeen.x, hostSeen.z], [game.player.x, game.player.z]);
  // Everyone about them in the same place.
  const near = [...game.creatures, ...game.npcs].filter((c) => !c.dead && Math.abs(c.x - gp.x) < 25 && Math.abs(c.z - gp.z) < 25);
  for (const c of near) {
    const m = guestNet.ents.get(c.id);
    assert.ok(m, `${c.kind} ${c.id} is seen`);
    assert.deepEqual([m.x, m.z], [c.x, c.z]);
  }
  // A block set on the host is there for the player too.
  const bx = gp.x + 2;
  const bz = gp.z + 1;
  game.world.setBlock(bx, gp.y, bz, B.cobblestone);
  L.step(3);
  assert.equal(gg.world.getBlock(bx, gp.y, bz), B.cobblestone);
  // The ground about them, cell for cell.
  let cells = 0;
  let off = 0;
  for (const r of gg.world.regions.values()) {
    const hr = game.world.regionAt(r.x0, r.z0);
    if (!hr) continue;
    for (let i = 0; i < r.blocks.length; i += 3) {
      cells++;
      if (r.blocks[i] !== hr.blocks[i]) off++;
    }
  }
  assert.ok(cells > 10000);
  assert.equal(off, 0);
});

test('host and player: the whole party goes down into a dungeon, and up again', () => {
  const L = linked();
  const { game } = L;
  const gp = game.seats[1].ent;
  const rec = { ...game.sim.dungeons.all.find((d) => d.type === 'barrow'), floors: {}, cleared: false, pack: null };
  new DungeonRun(game, rec).enter();
  L.step(8);
  assert.ok(game.world.inInstance(game.player.x));
  assert.ok(game.world.inInstance(gp.x), 'the guest went down too');
  assert.ok(Math.max(Math.abs(gp.x - game.player.x), Math.abs(gp.z - game.player.z)) <= 4, 'beside the host');
  assert.ok(L.gg.world.inst && L.gg.world.inInstance(L.gg.player.x), 'and sees it');
  assert.ok(L.gg.dungeon && L.gg.dungeon.floor === game.dungeon.floor);
  // (Their copy of it knows what kind of place it is: the HUD names it.)
  assert.ok(L.gg.dungeon.T && L.gg.dungeon.T.name === game.dungeon.T.name);
  assert.ok(Array.isArray(L.gg.dungeon.knownStairs()));
  game.dungeon.leave();
  L.step(8);
  assert.ok(!game.world.inInstance(gp.x), 'up again with the host');
  assert.ok(!L.gg.world.inst);
});

test('host and player: the host lets players fight, and the player is told', () => {
  const L = linked();
  assert.equal(L.guestNet.pvp, false);
  const notes = [];
  L.guestNet.onNote = (text) => notes.push(text);
  L.hostNet.setPvp(true);
  L.step(1);
  assert.ok(L.game.pvp);
  assert.equal(L.guestNet.pvp, true, 'the player knows');
  assert.ok(notes.some((t) => /fight/.test(t)), 'and was told');
  L.hostNet.setPvp(false);
  L.step(1);
  assert.equal(L.guestNet.pvp, false);
});

test('host and player: a master\'s fight on both screens, its waking and its fall', () => {
  const L = linked();
  const { game } = L;
  const seat = game.seats[1];
  const gp = seat.ent;
  const rec = { ...game.sim.dungeons.all.find((d) => d.type === 'barrow'), floors: {}, cleared: false, pack: null };
  new DungeonRun(game, rec).enter();
  L.step(4);
  while (game.dungeon.floor < rec.depth - 1) {
    game.dungeon.changeFloor(1);
    L.step(4);
  }
  const d = game.dungeon;
  const boss = game.creatures.find((c) => c.isBoss && !c.dead && c.leash);
  assert.ok(boss, 'the barrow\'s master, waiting in its hall');
  const [cx, cz] = [boss.x, boss.z];
  for (const q of game.creatures) if (!q.isBoss) q.dormant = 999;
  const s1 = game.findFreeSpot(cx, cz + 4, FY);
  game.player.teleport(s1.x, s1.y, s1.z);
  const s2 = game.findFreeSpot(cx + 2, cz + 4, FY);
  gp.teleport(s2.x, s2.y, s2.z);
  L.step(2);
  // It wakes: both of you see it, its name across the top, the camera on it.
  d.bossFight();
  L.step(4);
  assert.equal(game.scene && game.scene.kind, 'boss_in', 'the host sees it wake');
  assert.equal(seatField(game, seat, 'scene')?.kind, 'boss_in', 'so does the player (their seat)');
  assert.equal(L.gg.scene && L.gg.scene.kind, 'boss_in', 'on the player\'s own screen');
  assert.equal(L.gg.dungeon.fight && L.gg.dungeon.fight.name, d.fight.name, 'its bar');
  const seen = L.guestNet.ents.get(boss.id);
  assert.ok(seen && seen.isBoss && seen.species === boss.species, 'the master itself');
  const name = d.fight.name;
  // Hurt, its bar falls on both screens.
  boss.hp = Math.round(boss.maxHp / 2);
  L.step(16);
  assert.ok(Math.abs(L.gg.dungeon.fight.frac - d.fight.frac) < 0.05, 'the same bar');
  assert.equal(seen.hp, boss.hp);
  // The player brings it down: its fall on both screens.
  game.scene = null;
  game.damage(boss, boss.hp + 5, gp);
  L.step(12);
  assert.ok(boss.dead);
  assert.equal(game.scene && game.scene.kind, 'boss_down', 'the host sees it fall');
  assert.equal(L.gg.scene && L.gg.scene.kind, 'boss_down', 'and the player');
  assert.equal(L.gg.dungeon.fallen && L.gg.dungeon.fallen.name, name, 'VANQUISHED, on theirs too');
});

test('host and player: kicked, the player\'s screen goes back to the title', () => {
  const L = linked();
  const cid = [...L.hostNet.guests.keys()][0];
  L.hostNet.kick(cid);
  L.step(1);
  assert.equal(L.game.seats.length, 1);
  assert.ok(L.game.partyChars.has('g'), 'their character kept');
  assert.equal(profileOf({ id: 'g', name: 'Guesty' }).id, 'g');
});

test('an old place cleared on the host falls in on every player\'s copy of the world too', () => {
  const L = linked();
  const { game, gg } = L;
  const rec = game.sim.dungeons.all.find((d) => d.type === 'barrow' && !d.cleared);
  const site = game.sim.dungeons.site(rec);
  const theirs = gg.world.sites.find((q) => q.id === site.id);
  assert.ok(theirs && !(theirs.state && theirs.state.cleared), 'open, on both');
  // Cleared by someone else, far from everyone (its ground not loaded on
  // the host): the player's copy still learns of it.
  game.sim.dungeons.cleared(rec, 'Some adventurers');
  L.step(2);
  assert.ok(theirs.state && theirs.state.cleared, 'the player knows it\'s fallen in');
  // The ground of it, on both: fallen in. (The player's from the host, as
  // they ask for it.)
  const rx = Math.floor(site.x / 64);
  const rz = Math.floor(site.z / 36);
  game.loadAround(site.x, site.z, true);
  gg.world.loadRegion(rx, rz);
  for (let i = 0; i < 10 && !gg.world.isLoaded(rx, rz); i++) {
    L.step(1);
    gg.world.loadRegion(rx, rz);
  }
  assert.ok(gg.world.isLoaded(rx, rz));
  // And ground the player already holds, which the host had let go of
  // when it fell in: put right on the player's side too.
  const rec2 = game.sim.dungeons.all.find((d) => d.type !== 'kavorent' && !d.cleared && d !== rec);
  const site2 = game.sim.dungeons.site(rec2);
  const r2x = Math.floor(site2.x / 64);
  const r2z = Math.floor(site2.z / 36);
  gg.world.loadRegion(r2x, r2z);
  for (let i = 0; i < 10 && !gg.world.isLoaded(r2x, r2z); i++) {
    L.step(1);
    gg.world.loadRegion(r2x, r2z);
  }
  assert.ok(gg.world.isLoaded(r2x, r2z));
  if (game.world.isLoaded(r2x, r2z)) game.world.unloadRegion(r2x, r2z);
  const sentBefore = L.toGuest.length;
  game.sim.dungeons.cleared(rec2, 'Some adventurers');
  L.step(2);
  assert.equal(L.toGuest.slice(sentBefore).filter((t) => t.includes('"site"')).length, 1, 'the player told');
  // (What a place sets, the last word on each block.)
  const finalOf = (s) => [...new Map(siteBlocks(s, s.state).map((q) => [`${q[0]},${q[1]},${q[2]}`, q])).values()];
  for (const [dx, y, dz, id] of finalOf(site2)) assert.equal(gg.world.getBlock(site2.x + dx, y, site2.z + dz), id, `player's held ground ${dx},${y},${dz}`);
  const placed = finalOf(site);
  assert.ok(placed.length > 5);
  for (const [dx, y, dz, id] of placed) {
    assert.equal(game.world.getBlock(site.x + dx, y, site.z + dz), id, `host ${dx},${y},${dz}`);
    assert.equal(gg.world.getBlock(site.x + dx, y, site.z + dz), id, `player ${dx},${y},${dz}`);
  }
});
