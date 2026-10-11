// Round 87: the essentials. A bridge with a way over at any slant (and
// one in a kept region cleared); a wagon cut by the rows it stands over;
// the coach on the ground under a tree; the wait slider's fill in the
// font; the door answered from inside it; the gate shut to you after
// curfew (but not with something after you); a guard's own memory of
// warning you; and the version's step.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeGame, stubInput } from './helpers.mjs';
import { B } from '../src/world/blocks.js';
import { onBridge, bridgeWalk, clearBridgeWalk, bridgeMats, DECK_Y } from '../src/world/bridges.js';
import { Region } from '../src/world/region.js';
import { steedSprite, steedSlices, steedRows } from '../src/render/steeds.js';
import { coachY } from '../src/game/rides.js';
import { CHAR_INDEX } from '../src/render/font.js';
import { updateKnocks } from '../src/game/doorlocks.js';
import { buildingAt } from '../src/sim/sim.js';
import { REGION_W, REGION_D, GROUND } from '../src/config.js';
import { GAME_VERSION, compareVersions } from '../src/version.js';
import { stepsFor, migrateSave } from '../src/game/migrate.js';

// ------------------------------------------------------------ bridges
const bridgeAt = (deg, hw = 1) => {
  const a = (deg * Math.PI) / 180;
  const b = { x0: 100.3, z0: 100.7, x1: 100.3 + Math.cos(a) * 40, z1: 100.7 + Math.sin(a) * 40, hw, kind: hw === 1 ? 'plank' : 'causeway', land: 'default' };
  return Object.assign(b, { bx0: Math.min(b.x0, b.x1) - hw - 3, bx1: Math.max(b.x0, b.x1) + hw + 3, bz0: Math.min(b.z0, b.z1) - hw - 3, bz1: Math.max(b.z0, b.z1) + hw + 3 });
};

test('a bridge has a way over at every slant, a pace wide, never squeezed between posts', () => {
  for (const hw of [1, 2]) {
    for (let deg = 0; deg < 360; deg += 5) {
      const b = bridgeAt(deg, hw);
      const along = (x, z) => ((x - b.x0) * (b.x1 - b.x0) + (z - b.z0) * (b.z1 - b.z0)) / 40;
      const walk = new Set();
      for (let x = 50; x < 150; x++) for (let z = 50; z < 150; z++) if (bridgeWalk(onBridge([b], x, z))) walk.add(`${x},${z}`);
      const start = [...walk].map((k) => k.split(',').map(Number)).filter(([x, z]) => along(x, z) < 3);
      const seen = new Set(start.map((q) => q.join(',')));
      const q = [...start];
      let far = 0;
      while (q.length) {
        const [x, z] = q.pop();
        far = Math.max(far, along(x, z));
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const k = `${x + dx},${z + dz}`;
          if (walk.has(k) && !seen.has(k)) {
            seen.add(k);
            q.push([x + dx, z + dz]);
          }
        }
      }
      assert.ok(far >= 37, `hw ${hw} at ${deg}°: across to ${far.toFixed(1)}`);
    }
  }
});

test('a bridge kept in a save from before: its posts on the way over cleared', () => {
  const b = bridgeAt(20);
  const r = new Region(1, 1);
  // (The region over the bridge: moved to sit under it.)
  const ox = REGION_W;
  const oz = REGION_D;
  const B2 = { ...b, x0: b.x0 + ox - 100 + 10, x1: b.x1 + ox - 100 + 10, z0: b.z0 + oz - 100 + 10, z1: b.z1 + oz - 100 + 10 };
  Object.assign(B2, { bx0: Math.min(B2.x0, B2.x1) - 4, bx1: Math.max(B2.x0, B2.x1) + 4, bz0: Math.min(B2.z0, B2.z1) - 4, bz1: Math.max(B2.z0, B2.z1) + 4 });
  const M = bridgeMats('default', 'plank');
  let put = 0;
  for (let lz = 0; lz < REGION_D; lz++) {
    for (let lx = 0; lx < REGION_W; lx++) {
      if (!bridgeWalk(onBridge([B2], ox + lx, oz + lz))) continue;
      r.set(lx, DECK_Y + 1, lz, M.rail);
      put++;
    }
  }
  assert.ok(put > 10);
  assert.ok(clearBridgeWalk(r, [B2]));
  let left = 0;
  for (let lz = 0; lz < REGION_D; lz++) for (let lx = 0; lx < REGION_W; lx++) if (r.get(lx, DECK_Y + 1, lz) === M.rail) left++;
  assert.equal(left, 0);
  assert.ok(!clearBridgeWalk(r, [B2]), 'nothing more the second time');
});

// ------------------------------------------------------------ wagons
test('a wagon cut by the rows it stands over: every pixel in one, within its span', () => {
  const mk = (w, h) => ({ width: w, height: h, store: {}, getContext() {
    const self = this;
    return { createImageData: (W, H) => ({ data: new Uint8ClampedArray(W * H * 4) }), putImageData(id) { self.store.px = new Uint32Array(id.data.buffer); } };
  } });
  for (const a of [0, 0.8, 1.6, 2.5, 3.14, -1.1]) {
    for (const fr of [0, 0.4, 0.9]) {
      const S = steedSprite('wagon', { horse: { coat: 1 }, frame: 0, legs: 0 }, a, mk);
      const sl = steedSlices(S, fr, mk);
      const [k0, k1] = steedRows('wagon', true, a, Math.round(fr * 16) / 16);
      let n = 0;
      for (const [k, c] of sl) {
        assert.ok(k >= k0 && k <= k1, `row ${k} in ${k0}..${k1}`);
        n += c.store.px.filter(Boolean).length;
      }
      assert.equal(n, S.px.filter(Boolean).length);
      assert.ok(sl.size >= 1);
    }
  }
});

// ------------------------------------------------------------ the game
const input = stubInput();
const G = makeGame(12345, { wg: 8 });
const run = (n, dt = 0.05) => {
  for (let i = 0; i < n; i++) G.update(dt, input);
};
run(10);
const w = G.world;
const p = G.player;

test('the coach keeps to the ground under a tree, never up on it', () => {
  const x = Math.round(p.x) + 9;
  const z = Math.round(p.z) + 9;
  for (let y = 1; y < 14; y++) w.setBlock(x, y, z, y <= 5 ? B.dirt : B.air);
  w.setBlock(x, 6, z, B.log_oak);
  w.setBlock(x, 7, z, B.log_oak);
  w.setBlock(x, 8, z, B.leaves_oak);
  assert.equal(coachY(w, x, z, 6), 6, 'on the ground, through the trunk');
  assert.equal(coachY(w, x, z, 8), 6, 'down off the leaves');
});

test('the wait slider\'s fill (and the hull\'s ends) are in the font', () => {
  for (const c of ['█', '─', '▛', '▜', '◄', '►']) assert.ok(CHAR_INDEX.has(c), c);
});

test('a knock answered: over to the door from inside, then it opened', () => {
  let found = null;
  for (const L of w.layouts.values()) {
    for (const b of L.buildings || []) {
      if (!b.residential || !b.door) continue;
      let y = -1;
      for (let yy = GROUND - 1; yy <= GROUND + 3; yy++) if (w.getBlock(b.door.x, yy, b.door.z) === B.door) y = yy;
      if (y < 0) continue;
      const n = G.npcs.find((q) => !q.dead && q.layout === L && q.state === 'routine' && !q.sleeping);
      if (!n) continue;
      // A spot inside, a few paces from the door.
      let spot = null;
      for (let zz = b.z0 + 1; zz < b.z1 && !spot; zz++) for (let xx = b.x0 + 1; xx < b.x1 && !spot; xx++) if (Math.abs(xx - b.door.x) + Math.abs(zz - b.door.z) >= 3 && w.canStand(xx, y, zz)) spot = { x: xx, z: zz };
      if (spot) found = { L, b, y, n, spot };
      if (found) break;
    }
    if (found) break;
  }
  assert.ok(found, 'a house to knock at');
  const { b, y, n, spot } = found;
  w.setState(b.door.x, y, b.door.z, false);
  n.teleport(spot.x, y, spot.z);
  G.knocks = [{ x: b.door.x, y, z: b.door.z, n, t: 0, by: p, b }];
  updateKnocks(G, 0.1);
  assert.ok(n.answer && !n.answer.opened, 'on the way to the door');
  assert.ok(!w.getState(b.door.x, y, b.door.z), 'not opened from across the room');
  for (let i = 0; i < 400 && n.answer && !n.answer.opened; i++) G.update(0.05, input);
  assert.ok(w.getState(b.door.x, y, b.door.z), 'opened');
  assert.ok(Math.abs(n.x - b.door.x) + Math.abs(n.z - b.door.z) <= 2, 'by the door');
  assert.ok(buildingAt(found.L, n.x, n.z) === b, 'from inside');
});

test('after curfew the watch keeps the gate shut, unless something\'s after you', () => {
  const L = [...w.layouts.values()].find((q) => q.econ && q.settlement && G.npcs.some((n) => n.layout === q && n.rec.job === 'guard'));
  assert.ok(L, 'a town with its watch');
  const guard = G.npcs.find((n) => n.layout === L && n.rec.job === 'guard' && !n.dead);
  const s = L.settlement;
  const cx = Math.round((s.bounds.x0 + s.bounds.x1) / 2);
  const cz = Math.round((s.bounds.z0 + s.bounds.z1) / 2);
  // A gate in the town, the guard by it, you at it.
  let gx = null;
  let gz = null;
  for (let r = 0; r < 12 && gx === null; r++) {
    for (const [dx, dz] of [[r, 0], [-r, 0], [0, r], [0, -r]]) {
      const x = cx + dx;
      const z = cz + dz;
      if (w.canStand(x, GROUND, z) && w.canStand(x + 1, GROUND, z)) {
        gx = x;
        gz = z;
        break;
      }
    }
  }
  w.setBlock(gx, GROUND, gz, B.city_gate);
  w.setState(gx, GROUND, gz, false);
  p.teleport(gx + 1, GROUND, gz);
  guard.teleport(gx + 1, GROUND, gz + 1);
  guard.sleeping = false;
  guard.state = 'routine';
  L.econ.laws ||= {};
  L.econ.laws.curfew = true;
  G.minute = 23 * 60;
  G.currentSettlement = s;
  assert.equal(G.useGate(gx, GROUND, gz), false, 'shut to you');
  assert.ok(!w.getState(gx, GROUND, gz));
  const wolfLike = { dead: false, x: gx + 4, z: gz, hostileNow: true };
  G.creatures.push(wolfLike);
  assert.ok(G.chasedAt(p));
  assert.equal(G.useGate(gx, GROUND, gz), true, 'let in from it');
  G.creatures.splice(G.creatures.indexOf(wolfLike), 1);
  L.econ.laws.curfew = false;
});

test('a guard remembers warning you: tonight, or another night; another guard doesn\'t', () => {
  const J = G.sim.justice;
  const L = [...w.layouts.values()].find((q) => q.econ && G.npcs.filter((n) => n.layout === q && n.rec.job === 'guard').length >= 2);
  assert.ok(L, 'a town with two of the watch');
  const [g1, g2] = G.npcs.filter((n) => n.layout === L && n.rec.job === 'guard' && !n.dead);
  L.econ.laws ||= {};
  L.econ.laws.curfew = true;
  G.minute = 23 * 60;
  const said = [];
  const sayOf = (g) => {
    g.say = (t) => said.push([g, t]);
  };
  sayOf(g1);
  sayOf(g2);
  const warnBy = (g) => {
    J.curfewT = { t: 0, guard: g, warned: false, done: false, stage: 0 };
    g.sleeping = false;
    g.state = 'routine';
    g.teleport(p.x + 1, p.y, p.z);
    said.length = 0;
    J.curfewWatch({ npcs: [g] }, L, p, null);
    return said.filter((q) => q[0] === g).map((q) => q[1]).join(' ');
  };
  const first = warnBy(g1);
  assert.ok(first && !/again|already|remember|habit/i.test(first), `first: ${first}`);
  assert.match(warnBy(g1), /again|already|once tonight|Didn't I/i, 'the same guard, the same night');
  assert.ok(!/again|already|remember|habit/i.test(warnBy(g2)), 'another guard knows nothing of it');
  G.day = (G.day || 0) + 1;
  assert.match(warnBy(g1), /again|remember|habit/i, 'another night');
  L.econ.laws.curfew = false;
});

// ------------------------------------------------------------ the version
test('0.87.0: its step', () => {
  assert.ok(compareVersions(GAME_VERSION, '0.87.0') >= 0);
  assert.ok(stepsFor('0.86.0').some((s) => s.to === '0.87.0'));
  const { log } = migrateSave({ gv: '0.86.0', wg: 8 });
  assert.ok(log.some((l) => /Bridges/.test(l)));
});
