// Round 134: lighter all round. The world's work out of sight spread over
// the frames (the realms' roads worked out ahead, far towns' hours a few at
// a time), the forge's lighting kept from frame to frame, a region's blocks
// packed for a save only when they've changed: each the same outcome as
// before, only cheaper.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGame } from './helpers.mjs';
import { simulateTo } from '../src/sim/econ.js';
import { GBuf, shade, N } from '../src/ui/forgelight.js';
import { Shop, fire, bellows, ironBar, lantern, hide, motes, blank } from '../src/ui/forgepaint.js';
import { Region } from '../src/world/region.js';
import { DEFAULTS, SETTING_ROWS, applySettings } from '../src/game/settings.js';
import { GAME_VERSION } from '../src/version.js';
import { WORLD_Y } from '../src/config.js';
import { stepsFor } from '../src/game/migrate.js';

test('a road\'s way worked out ahead is the very way it would have been, and is used', () => {
  const g = makeGame(12345, { wg: 9 });
  const D = g.sim.diplomacy;
  const S = g.world.ow.settlements;
  let checked = 0;
  for (let i = 0; i < S.length && checked < 2; i++) {
    for (let j = i + 1; j < S.length && checked < 2; j++) {
      const a = S[i];
      const b = S[j];
      if (D.dist(a, b) > 8) continue;
      g.sim.layoutOf(a.id);
      g.sim.layoutOf(b.id);
      const { q0, q1 } = D.roadPlan(a, b);
      const fresh = D.route(q0, q1, [a, b]);
      // (A little at a time: a millisecond a go.)
      let goes = 0;
      while (!D.prepRoad(a, b, 1)) goes++;
      assert.ok(goes >= 0);
      const kept = D.routes.get(D.routeKey(q0, q1, [a, b], 7));
      assert.ok(kept, 'kept for when it\'s wanted');
      assert.deepEqual(kept, fresh);
      // Wanted: that one, taken.
      assert.equal(D.route(q0, q1, [a, b]), kept);
      assert.ok(!D.routes.has(D.routeKey(q0, q1, [a, b], 7)));
      checked++;
    }
  }
  assert.equal(checked, 2);
  // A realm's next road, as roadWorks would choose it.
  const civ = g.world.ow.civs.find((c) => c && g.sim.realms.state[c.id] && g.world.layouts.get(g.sim.realms.state[c.id].capital));
  if (civ) {
    const capL = g.world.layouts.get(g.sim.realms.state[civ.id].capital);
    const pair = g.sim.realms.roadPair(civ, capL);
    if (pair) assert.ok(pair[0] && pair[1] && pair[0] !== pair[1]);
  }
});

test('a far town caught up an hour at a time comes out just as caught up all at once', () => {
  const a = makeGame(777, { wg: 9 });
  const b = makeGame(777, { wg: 9 });
  const s = a.world.ow.settlements.find((q) => !a.active.has(q.id) && q.type === 'town') || a.world.ow.settlements.find((q) => !a.active.has(q.id));
  const LA = a.sim.layoutOf(s.id);
  const LB = b.sim.layoutOf(s.id);
  assert.ok(LA && LA.econ && LB && LB.econ);
  for (const g of [a, b]) g.minute += 9 * 60;
  const to = a.sim.abs;
  assert.equal(b.sim.abs, to);
  simulateTo(a.sim, LA, to);
  let calls = 0;
  // (No time at all allowed: an hour a call, the least it does.)
  while (LB.econ.lastAbs + 60 <= to && calls < 100) {
    assert.equal(simulateTo(b.sim, LB, to, false, 0), 1);
    calls++;
  }
  assert.ok(calls >= 2, `several turns (${calls})`);
  assert.equal(LB.econ.lastAbs, LA.econ.lastAbs);
  assert.equal(JSON.stringify(LB.econ.ledger), JSON.stringify(LA.econ.ledger));
  assert.equal(LB.econ.treasury, LA.econ.treasury);
  assert.deepEqual(LB.npcs.map((r) => [r.coins, r.mood, r.fed]), LA.npcs.map((r) => [r.coins, r.mood, r.fed]));
});

test('the festival\'s ground: what\'s laid out read the same, by number', () => {
  const g = makeGame(12345, { wg: 9 });
  const L = [...g.world.layouts.values()].find((q) => q.econ && q.plaza);
  const E = g.sim.events;
  const map = E.laid(L);
  // What's laid a pace or two off the ground is there, by its number.
  let found = 0;
  for (const arr of L.placements.values()) {
    for (let i = 0; i < arr.length && found < 200; i += 5) {
      const [x, y, z] = [arr[i], arr[i + 1], arr[i + 2]];
      if (y < 6 || y > 8) continue;
      const k = (x * 65536 + z) * 8 + (y - 6);
      if (map.has(k)) found++;
    }
  }
  assert.ok(found > 0);
  assert.ok(map instanceof Map);
  const site = E.findSite(L, 'feast');
  if (site) {
    assert.ok(site.x1 >= site.x0 && site.z1 >= site.z0);
    for (let z = site.z0; z <= site.z1; z++) for (let x = site.x0; x <= site.x1; x++) assert.ok(E.clear(L, x, z, 2), 'the stage on clear ground');
  }
});

test('the forge lit with its lights kept from frame to frame: the very same picture', () => {
  for (const kind of ['forge', 'stitch', 'carve']) {
    const S = new Shop(kind, 3);
    const kept = new Uint8ClampedArray(N * 4);
    const fresh = new Uint8ClampedArray(N * 4);
    for (let f = 0; f < 12; f++) {
      const t = f / 10;
      S.begin();
      if (kind === 'forge') {
        fire(S, t, 0.6);
        bellows(S, f / 12);
        ironBar(S, 0.5 + f / 30);
      } else if (kind === 'stitch') {
        lantern(S, t);
        hide(S, f, (w) => 72 + Math.sin(w * 0.06) * 10, [], -24 + f, 72);
      } else {
        motes(S, t);
        blank(S, [0.2], [0.4], [f / 12]);
      }
      const L = S.def.lights(S, t, { fire: 0.6 });
      shade(S.gb, L, S.def.amb, kept);
      // (The same scene in a buffer that's never kept anything.)
      const gb = new GBuf(S.gb.cam).copy(S.gb);
      shade(gb, L, S.def.amb, fresh);
      assert.deepEqual(kept, fresh, `${kind}, frame ${f}`);
    }
    assert.ok(S.gb.lc && S.gb.lc.slots.size > 0, `${kind}: some lights kept`);
  }
});

test('a region\'s blocks packed once till they change; its chests always as they are', () => {
  const r = new Region(3, 4);
  for (let i = 0; i < 500; i++) r.set(i % 64, 6, Math.floor(i / 64), 3 + (i % 5));
  const a = r.serialize();
  const b = r.serialize();
  assert.equal(a.rle, b.rle, 'the same runs, not packed again');
  r.containers.set(7, [{ item: 'coin', count: 3 }]);
  assert.equal(r.serialize().containers.length, 1);
  r.set(0, 7, 0, 9);
  const c = r.serialize();
  assert.notEqual(c.rle, a.rle);
  const back = Region.deserialize(c);
  assert.equal(back.get(0, 7, 0), 9);
  assert.equal(back.get(1, 6, 0), r.get(1, 6, 0));
  // (In the world: a block set there changes what's saved.)
  const g = makeGame(12345, { wg: 9 });
  const p = g.player;
  const reg = g.world.regionAt(Math.floor(p.x), Math.floor(p.z));
  const before = JSON.stringify(reg.serialize().rle);
  g.world.setBlock(Math.floor(p.x), WORLD_Y - 1, Math.floor(p.z), 3, 0);
  assert.notEqual(JSON.stringify(reg.serialize().rle), before);
});

test('background world work, gentle: half the time a frame', () => {
  assert.equal(DEFAULTS.bgWork, 0);
  const row = SETTING_ROWS.find((q) => q.key === 'bgWork');
  assert.ok(row && row.tab === 'General' && row.opts.length === 2);
  const g = makeGame(12345, { wg: 9 });
  const renderer = {};
  g.renderer = renderer;
  applySettings({ ...DEFAULTS, bgWork: 1 }, { renderer });
  assert.equal(renderer.gentleWork, true);
  assert.equal(g.sim.workMs(6), 3);
  applySettings({ ...DEFAULTS }, { renderer });
  assert.equal(g.sim.workMs(6), 6);
});

test('version 1.34.0', () => {
  assert.equal(GAME_VERSION, '1.34.0');
  const s = stepsFor('1.33.0').find((q) => q.to === '1.34.0');
  assert.ok(s && s.game);
});
