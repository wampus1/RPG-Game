// Round 141: playing together, lighter on the network. What the host sends
// each player is a fraction of what it was: its own clocks are kept to
// itself, the clocks a player's screen runs itself are sent when they're
// set, the ground goes a region at a time, and the relay compresses what
// goes over the network and holds the host back from a player whose
// connection can't keep up. Pointer-only input goes thirty times a second.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import net from 'node:net';
import crypto from 'node:crypto';
import { makeGame, stubInput, stubUI, stubRenderer } from './helpers.mjs';
import { Game } from '../src/game/game.js';
import { HostNet } from '../src/net/host.js';
import { GuestNet } from '../src/net/guest.js';
import { fieldsOf, diffFields, CLOCKS } from '../src/net/wire.js';
import { NET_VERSION, openEnvelope, toPlayer } from '../src/net/protocol.js';
import { Relay } from '../tools/relay.mjs';
import { GAME_VERSION, compareVersions } from '../src/version.js';
import { stepsFor } from '../src/game/migrate.js';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const uiStub = () => {
  const u = stubUI();
  u.windows = [];
  u.update = () => {};
  u.find = () => null;
  u.closeAll = () => {};
  return u;
};

// A host and a guest, joined, every message the host sends them counted.
function linked() {
  const game = makeGame(12345);
  const input = stubInput();
  game.minute = 12 * 60;
  for (let i = 0; i < 20; i++) game.update(0.1, input);
  const queue = [];
  const down = [];
  const up = [];
  let guestNet = null;
  const hostNet = new HostNet(game, {
    send: (text) => {
      if (text[0] !== '@') return;
      const body = text.slice(text.indexOf('|') + 1);
      down.push(body);
      queue.push(() => guestNet.receive(body));
    },
    profile: { id: 'h', name: 'Hosty' },
    world: { name: 'Testland' },
    makeUI: () => uiStub(),
  });
  const flush = () => {
    while (queue.length) queue.shift()();
  };
  const out = { game, hostNet, down, up, gg: null };
  const gin = stubInput();
  guestNet = new GuestNet({
    send: (text) => {
      up.push(text);
      queue.push(() => hostNet.receive(`@7|${text}`));
    },
    profile: { id: 'g', name: 'Guesty' },
    build: (save) => {
      out.gg = new Game({ seed: save.seed, renderer: stubRenderer(), audio: null, ui: uiStub(), save, remote: true });
      return out.gg;
    },
    onNeedHero: () => guestNet.sendHero(null),
    onEnd: () => {},
  });
  out.guestNet = guestNet;
  out.run = (secs, each = null) => {
    const dt = 1 / 60;
    for (let i = 0; i < secs / dt; i++) {
      each?.(i);
      game.update(dt, input);
      flush();
      if (out.gg) out.gg.update(dt, gin);
      flush();
    }
  };
  out.seat = () => [...hostNet.guests.values()][0];
  hostNet.receive('!' + JSON.stringify({ t: 'join', cid: 7, account: { id: 'g', name: 'Guesty' } }));
  flush();
  return out;
}
const bytes = (list) => list.reduce((n, s) => n + Buffer.byteLength(s), 0);

test('the host\'s own clocks stay with it; the ones a player\'s screen runs itself go when they\'re set', () => {
  const e = { id: 9, x: 3, trailEatT: 1.5, gemMendT: 2, chairT: 0.3, roofT: 1, restT: 4, dishClock: 2, moveT: 0, moveDur: 0.25, idleAnim: { kind: 'sweep', t: 0, dur: 8, fx: 0.4 } };
  const f = fieldsOf(e);
  for (const k of ['trailEatT', 'gemMendT', 'chairT', 'roofT', 'restT', 'dishClock']) assert.ok(!(k in f), k);
  assert.ok(!JSON.parse(f.idleAnim).fx, 'the idle business\'s own countdown, too');
  const last = {};
  assert.ok(diffFields(e, last, fieldsOf(e), 0).moveT, 'the first time, everything');
  // Running on, as the far side would have it: nothing to send.
  e.moveT = 0.4;
  e.idleAnim.t = 0.1;
  e.trailEatT = 1.4;
  assert.equal(diffFields(e, last, fieldsOf(e), 0.1), null);
  // Set again (a new step, a new business): sent.
  e.moveT = 0;
  e.x = 4;
  const d = diffFields(e, last, fieldsOf(e), 0.15);
  assert.ok(d.moveT && d.x);
  e.idleAnim = { kind: 'gesture', t: 0, dur: 5 };
  assert.ok(diffFields(e, last, fieldsOf(e), 0.2).idleAnim);
  // Gone its own way (a hitch on the host's side): sent to put it right.
  e.idleAnim.t = 3;
  assert.ok(diffFields(e, last, fieldsOf(e), 0.3).idleAnim);
  // (Without a clock, as before: every change.)
  e.idleAnim.t = 3.05;
  assert.ok(diffFields(e, {}, fieldsOf(e)).idleAnim);
  for (const k of ['moveT', 'actionTimer', 'flash', 'bubble', 'emote', 'idleAnim', 'windup']) assert.ok(CLOCKS[k], k);
});

test('in a town, a player is sent a fraction of what they were, and their screen runs the clocks', () => {
  const W = linked();
  W.run(3);
  const g = W.seat();
  const s = W.game.world.ow.settlements.find((q) => q.type === 'city' && !q.deserted) || W.game.world.ow.settlements.find((q) => q.type === 'town');
  const L = W.game.world.layouts.get(s.id) || W.game.world.layOut(s);
  g.seat.ent.x = L.plaza.cx;
  g.seat.ent.z = L.plaza.cz + 2;
  W.game.teleportPlayer(L.plaza.cx + 2, 6, L.plaza.cz + 2);
  W.run(5);
  W.down.length = 0;
  W.up.length = 0;
  W.run(10);
  const perSec = bytes(W.down) / 10;
  assert.ok(perSec < 40 * 1024, `about the town: ${Math.round(perSec / 1024)} KB/s (it was over 120)`);
  assert.ok(bytes(W.up) / 10 < 4 * 1024);
  // The screen's own copies run on between words.
  const n = [...W.guestNet.ents.values()].find((q) => q.netKind === 'N');
  if (n) {
    n.idleAnim = { kind: 'sweep', t: 0, dur: 9 };
    n.windup = { t: 0, dur: 1 };
    W.gg.update(0.5, stubInput());
    assert.ok(n.idleAnim.t >= 0.45 && n.windup.t >= 0.45);
  }
});

test('the ground goes a region at a time, the one underfoot first, and not twice', () => {
  const W = linked();
  W.run(2);
  const sizes = W.down.map((q) => JSON.parse(q)).filter((m) => m.r).map((m) => m.r.length);
  assert.ok(sizes.length >= 9 && sizes.every((n) => n === 1), `one a message: ${sizes}`);
  const first = W.down.map((q) => JSON.parse(q)).find((m) => m.r).r[0];
  const p = W.seat().seat.ent;
  assert.equal(`${first.rx},${first.rz}`, `${Math.floor(p.x / 64)},${Math.floor(p.z / 36)}`, 'the ground underfoot first');
  // (Past the world itself, sent once on arriving.)
  const most = Math.max(...W.down.filter((q) => JSON.parse(q).t === 's').map((q) => Buffer.byteLength(q)));
  assert.ok(most < 200 * 1024, `no word near a megabyte: ${Math.round(most / 1024)}KB`);
  // Asked for again while it's on its way, or just gone: not sent again.
  const g = W.seat();
  const k = [...g.sent.regions][0].split(',').map(Number);
  W.down.length = 0;
  W.hostNet.receive(`@7|${JSON.stringify({ t: 'need', rx: k[0], rz: k[1] })}`);
  W.run(0.3);
  assert.ok(!W.down.some((q) => (JSON.parse(q).r || []).some((r) => r.rx === k[0] && r.rz === k[1])), 'not again');
  // Let go of, then asked for: sent.
  W.hostNet.receive(`@7|${JSON.stringify({ t: 'drop', rx: k[0], rz: k[1] })}`);
  W.hostNet.receive(`@7|${JSON.stringify({ t: 'need', rx: k[0], rz: k[1] })}`);
  W.run(0.3);
  assert.ok(W.down.some((q) => (JSON.parse(q).r || []).some((r) => r.rx === k[0] && r.rz === k[1])), 'sent once let go of');
});

test('a player whose connection can\'t keep up: the host holds back, then sends what\'s changed', () => {
  const W = linked();
  W.run(2);
  W.down.length = 0;
  W.hostNet.receive('!' + JSON.stringify({ t: 'backlog', cid: 7, on: true }));
  W.run(1);
  assert.equal(W.down.length, 0, 'nothing more piled on');
  W.hostNet.receive('!' + JSON.stringify({ t: 'backlog', cid: 7, on: false }));
  W.run(0.2);
  assert.ok(W.down.length > 0, 'and on again');
});

test('pointer-only input goes thirty times a second at most; keys and clicks at once', () => {
  const sent = [];
  const gn = Object.create(GuestNet.prototype);
  Object.assign(gn, { send: (j) => sent.push(j), last: null, sentAt: 0, rate: 20 });
  gn.game = { cursor: null, aimAngle: () => 0, renderer: { view: 0 } };
  const input = { keys: new Set(), mouse: { x: 0, y: 0, down: false, rdown: false, inside: true }, lastMoveKey: null };
  const fwd = { pressed: [], clicks: [], wheel: 0 };
  for (let i = 0; i < 30; i++) {
    input.mouse.x = i;
    gn.sendInput(input, fwd, false);
  }
  assert.ok(sent.length <= 2, `pointer moves in a burst: ${sent.length}`);
  gn.sendInput(input, { pressed: [{ code: 'KeyE', key: 'e' }], clicks: [], wheel: 0 }, false);
  assert.ok(JSON.parse(sent[sent.length - 1]).p.length, 'a key, there and then');
});

// A WebSocket client by hand, that can stop reading (a player on a poor
// connection).
function rawClient(port, hello) {
  return new Promise((res) => {
    const s = net.connect(port, '127.0.0.1');
    const key = crypto.randomBytes(16).toString('base64');
    s.write(`GET /net HTTP/1.1\r\nHost: x\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: ${key}\r\nSec-WebSocket-Version: 13\r\n\r\n`);
    s.once('data', () => {
      const body = Buffer.from(JSON.stringify(hello));
      const mask = crypto.randomBytes(4);
      const head = body.length < 126 ? Buffer.from([0x81, 0x80 | body.length]) : Buffer.from([0x81, 0x80 | 126, body.length >> 8, body.length & 255]);
      const m = Buffer.from(body);
      for (let i = 0; i < m.length; i++) m[i] ^= mask[i & 3];
      s.write(Buffer.concat([head, mask, m]));
      res(s);
    });
  });
}

test('the relay: compressed over the network; a player falling behind holds the host back', async () => {
  const relay = new Relay({ port: 0, addrs: () => ['10.0.0.5'], squeeze: () => true });
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
    const host = await open({ t: 'hello', v: NET_VERSION, role: 'host', account: { id: 'h1', name: 'Hosty' }, world: { name: 'Testland' } });
    const guest = await open({ t: 'hello', v: NET_VERSION, role: 'guest', account: { id: 'g1', name: 'Guesty' } });
    await wait(80);
    assert.match(guest.ws.extensions, /permessage-deflate/);
    const cid = openEnvelope(host.got.find((s) => s.includes('"join"'))).ctl.cid;
    // Through whole, both ways, compressed or not, in order.
    const big = JSON.stringify({ t: 's', e: Array.from({ length: 400 }, (_, i) => [i, 'N', { x: String(i), look: '"plain"' }]) });
    host.ws.send(toPlayer(cid, big));
    host.ws.send(toPlayer(cid, '{"t":"x"}'));
    guest.ws.send(JSON.stringify({ t: 'in', pad: 'k'.repeat(4000) }));
    await wait(120);
    assert.ok(guest.got.includes(big));
    assert.equal(guest.got[guest.got.length - 1], '{"t":"x"}');
    assert.ok(host.got.some((s) => s.startsWith(`@${cid}|`) && s.includes('kkkk')));
    // (By default, this machine's own browser isn't: no Wi-Fi between.)
    assert.equal(new Relay({ addrs: () => [] }).squeeze('127.0.0.1'), false);
    assert.equal(new Relay({ addrs: () => [] }).squeeze('192.168.1.20'), true);
    // A player who stops reading: the host's told, and told again when
    // they've caught up.
    const slow = await rawClient(port, { t: 'hello', v: NET_VERSION, role: 'guest', account: { id: 'g2', name: 'Slowcoach' } });
    await wait(80);
    const cid2 = openEnvelope(host.got.filter((s) => s.includes('"join"')).pop()).ctl.cid;
    slow.pause();
    const chunk = JSON.stringify({ t: 's', pad: crypto.randomBytes(300 * 1024).toString('base64') });
    for (let i = 0; i < 40 && !host.got.some((s) => s.includes('"backlog"')); i++) {
      host.ws.send(toPlayer(cid2, chunk));
      await wait(25);
    }
    await wait(60);
    const on = host.got.map((s) => (s[0] === '!' ? JSON.parse(s.slice(1)) : null)).find((m) => m && m.t === 'backlog' && m.on);
    assert.ok(on && on.cid === cid2, 'held back');
    slow.resume();
    slow.on('data', () => {});
    for (let i = 0; i < 100 && !host.got.some((s) => s.includes('"backlog"') && s.includes('"on":false')); i++) await wait(30);
    assert.ok(host.got.some((s) => s.includes('"backlog"') && s.includes('"on":false')), 'and on again');
    slow.destroy();
    guest.ws.close();
    host.ws.close();
  } finally {
    server.close();
    server.closeAllConnections?.();
  }
});

test('version 1.41.0', () => {
  assert.ok(compareVersions('1.41.0', GAME_VERSION) <= 0);
  assert.ok(stepsFor('1.40.0').some((q) => q.to === '1.41.0'));
});
