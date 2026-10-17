// Round 118: playing together, and the townsfolk upstairs. A guest's ENTER
// skips their opening (it went to their chat); doors swing in a shared
// world, on the host's screen and the guests'; one part of what's drawn
// over the world gone wrong never takes the rest of it (the HUD, the
// windows, the notices) with it; townsfolk who go up a stair stay up it;
// and the version's step.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { makeGame, stubInput, stubUI, stubRenderer } from './helpers.mjs';
import { Game } from '../src/game/game.js';
import { HostNet } from '../src/net/host.js';
import { GuestNet } from '../src/net/guest.js';
import { B, META_STATE } from '../src/world/blocks.js';
import { UI } from '../src/ui/ui.js';
import { cleanCtx } from '../src/render/renderer.js';
import { GAME_VERSION, compareVersions } from '../src/version.js';
import { stepsFor } from '../src/game/migrate.js';

const src = (f) => fs.readFileSync(new URL(`../src/${f}`, import.meta.url), 'utf8');

const uiStub = () => {
  const u = stubUI();
  u.windows = [];
  u.update = () => {};
  u.find = () => null;
  u.closeAll = () => {};
  return u;
};
// A host and a guest, joined (as in round92's tests), each screen's doors
// counted.
function linked() {
  const game = makeGame(12345);
  const input = stubInput();
  game.minute = 10 * 60;
  for (let i = 0; i < 20; i++) game.update(0.1, input);
  const swung = { host: 0, guest: 0 };
  game.renderer.swing = () => swung.host++;
  const queue = [];
  let guestNet = null;
  const hostNet = new HostNet(game, {
    send: (text) => {
      if (text[0] === '@') {
        const body = text.slice(text.indexOf('|') + 1);
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
  const out = { game, gg: null, swung };
  const gin = stubInput();
  guestNet = new GuestNet({
    send: (text) => queue.push(() => hostNet.receive(`@7|${text}`)),
    profile: { id: 'g', name: 'Guesty' },
    build: (save) => {
      const r = stubRenderer();
      r.swing = () => swung.guest++;
      out.gg = new Game({ seed: save.seed, renderer: r, audio: null, ui: uiStub(), save, remote: true });
      return out.gg;
    },
    onNeedHero: () => guestNet.sendHero(null),
    onEnd: () => {},
  });
  out.step = (n) => {
    for (let i = 0; i < n; i++) {
      game.update(0.05, input);
      flush();
      if (out.gg) out.gg.update(0.05, gin);
      flush();
    }
  };
  hostNet.receive('!' + JSON.stringify({ t: 'join', cid: 7, account: { id: 'g', name: 'Guesty' } }));
  flush();
  out.step(10);
  return out;
}

test('a door opened in a shared world swings, on the host\'s screen and the guest\'s', () => {
  const L = linked();
  const { game } = L;
  const w = game.world;
  const p = game.player;
  // A door beside the guest (whose ground the guest has).
  const gp = game.seats[1].ent;
  const x = gp.x + 2;
  const z = gp.z;
  const y = w.findStandY(x, z, gp.y);
  w.setBlock(x, y, z, B.door, 0);
  w.setBlock(x, y + 1, z, B.air);
  L.step(5);
  const h0 = L.swung.host;
  const g0 = L.swung.guest;
  w.setState(x, y, z, true);
  L.step(5);
  assert.ok(L.swung.host > h0, 'it swings on the host\'s screen');
  assert.ok(L.swung.guest > g0, 'and on the guest\'s');
  assert.ok(L.gg.world.getMeta(x, y, z) & META_STATE, 'open there too');
  void p;
});

test('in an opening, a guest\'s ENTER goes to the host, to skip it; otherwise it opens their chat', () => {
  const g = src('net/guest.js');
  assert.ok(/const skip = \(k\.code === 'Enter' \|\| k\.code === 'NumpadEnter'\) && !!\(game\.scene \|\| game\.cutscene\);/.test(g));
  assert.ok(/if \(!skip && \(remoteModal/.test(g));
  // (The host gives ENTER to an opening that's playing: see UI.handle.)
  assert.ok(/game\.scene && game\.scene\.intro && !\['Escape'/.test(src('ui/ui.js')));
});

test('one part of the HUD or a window gone wrong never takes the rest with it', () => {
  const calls = [];
  const ctx = { save: () => calls.push('save'), restore: () => calls.push('restore') };
  const ui = Object.create(UI.prototype);
  const err = console.error;
  let logged = 0;
  console.error = () => logged++;
  try {
    ui.part(ctx, 'hud', () => {
      throw new Error('boom');
    });
    ui.part(ctx, 'hud', () => {
      throw new Error('boom');
    });
    let ran = false;
    ui.part(ctx, 'minimap', () => {
      ran = true;
    });
    assert.ok(ran, 'the next part drawn');
  } finally {
    console.error = err;
  }
  assert.equal(logged, 1, 'told once, not every frame');
  assert.deepEqual(calls, ['save', 'restore', 'save', 'restore', 'save', 'restore'], 'the pen put back each time');
  const u = src('ui/ui.js');
  for (const name of ['hud', 'minimap', 'guild strip', 'boss bar', 'notes', 'tooltip']) assert.ok(u.includes(`this.part(ctx, '${name}'`), name);
  assert.ok(/const drawWin = \(w\) => this\.part\(ctx/.test(u), 'each window on its own');
  // (And the world under the HUD kept, the HUD gone wrong.)
  let reset = 0;
  cleanCtx({ reset: () => reset++, restore() {}, setTransform() {} }, true);
  assert.equal(reset, 0);
  assert.ok(/cleanCtx\(ctx, true\)/.test(src('main.js')));
});

test('townsfolk who go up a stair stay up it', () => {
  const game = makeGame(4242, { wg: 6 });
  const input = stubInput();
  const W = game.world;
  let found = null;
  for (const s of W.ow.settlements.slice(0, 30)) {
    const L = W.layouts.get(s.id) || W.layOut(s);
    for (const b of L.buildings) {
      const bed = b.beds.find((q) => q.up && q.y > 6);
      if (bed) {
        found = { s, bed };
        break;
      }
    }
    if (found) break;
  }
  assert.ok(found, 'a bed upstairs');
  const { s, bed } = found;
  game.teleportPlayer(bed.x, 40, bed.z + 3);
  game.minute = 12 * 60;
  for (let i = 0; i < 300 && !game.npcs.some((n) => n.layout && n.layout.settlement === s); i++) game.update(0.1, input);
  const n = game.npcs.find((q) => q.layout && q.layout.settlement === s && q.rec.job !== 'guard');
  assert.ok(n, 'someone of the town about');
  let spot = null;
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1]]) {
    const y = W.findStandY(bed.x + dx, bed.z + dz, bed.y);
    if (y >= 7 && W.canStand(bed.x + dx, y, bed.z + dz)) {
      spot = { x: bed.x + dx, y, z: bed.z + dz };
      break;
    }
  }
  assert.ok(spot, 'the floor upstairs');
  n.teleport(spot.x, spot.y, spot.z);
  assert.equal(n.stepDown(), false, 'upstairs, under the roof: left there');
  assert.equal(n.y, spot.y);
});

test('version 1.18.0, and the step to it', () => {
  assert.ok(compareVersions(GAME_VERSION, '1.18.0') >= 0);
  const steps = stepsFor('1.17.0').filter((s) => s.to === '1.18.0');
  assert.equal(steps.length, 1);
  const log = [];
  steps[0].data({}, log);
  assert.ok(/door/i.test(log[0]) && /stair/i.test(log[0]));
});
