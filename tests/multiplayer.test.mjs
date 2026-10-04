// Playing together: accounts, the LAN relay, a world with more than one
// player in it, and the host and a player's copy of it kept the same.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { makeGame, stubInput, stubUI, stubRenderer } from './helpers.mjs';
import { Game } from '../src/game/game.js';
import { Creature } from '../src/entities/creature.js';
import { DungeonRun } from '../src/game/dungeon.js';
import { B } from '../src/world/blocks.js';
import { Accounts, nameProblem, profileOf } from '../src/net/account.js';
import { HostNet } from '../src/net/host.js';
import { GuestNet } from '../src/net/guest.js';
import { MAX_PLAYERS, NET_VERSION, openEnvelope, toPlayer, toRelay } from '../src/net/protocol.js';
import { packGrid, unpackGrid } from '../src/net/uiwire.js';
import { Grid } from '../src/ui/ascii.js';
import { Relay } from '../tools/relay.mjs';

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
  game.dungeon.leave();
  L.step(8);
  assert.ok(!game.world.inInstance(gp.x), 'up again with the host');
  assert.ok(!L.gg.world.inst);
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
