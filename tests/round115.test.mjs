// Round 115: smoother, and lighter for whoever joins you. A town's day of
// business worked through a little each frame (a town you're in, one
// coming into view); a nearby town laid out in the queue, not all at once;
// the look for a pier made ahead and the same as ever; the ground by an
// old place's way in kept while anyone's below; creatures not searching
// every frame for a way that isn't there; pictures' pixels kept, never
// read back off the screen; the floor's plan sent by the host to a guest;
// each thing's state worked out once a frame for all the guests; and the
// version's step.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { makeGame, stubInput } from './helpers.mjs';
import { DungeonRun } from '../src/game/dungeon.js';
import { buildFloor, FY } from '../src/world/dungeongen.js';
import { Creature } from '../src/entities/creature.js';
import { walkTo } from '../src/game/minework.js';
import { keepPixels, pixelsOf, pixelsIn } from '../src/render/pixels.js';
import { packPlan, unpackPlan, diffFields, fieldsOf } from '../src/net/wire.js';
import { REGION_W, REGION_D } from '../src/config.js';
import { B } from '../src/world/blocks.js';
import { GAME_VERSION, compareVersions } from '../src/version.js';
import { stepsFor } from '../src/game/migrate.js';

// In the biggest town, by day.
function inCity() {
  const game = makeGame(12345);
  const input = stubInput();
  const s = game.world.ow.settlements.filter((q) => !q.deserted && q.condition !== 'abandoned').sort((a, b) => b.cw * b.cd - a.cw * a.cd)[0];
  game.teleportPlayer(Math.round((s.cx + s.cw / 2) * 64), 40, Math.round((s.cz + s.cd / 2) * 36));
  game.minute = 9 * 60;
  for (let i = 0; i < 60; i++) game.update(1 / 30, input);
  // (Till its people are about: the ground comes in a piece at a time.)
  for (let i = 0; i < 1200 && !game.npcs.some((q) => !q.dead && q.layout && q.layout.settlement === s); i++) game.update(1 / 30, input);
  return { game, input, s, L: game.world.layouts.get(s.id) };
}

test('a town you\'re in works through its morning\'s business a little each frame, its hours waiting for it', () => {
  const { game, input, L } = inCity();
  const sim = game.sim;
  // (Up to the hour the day's business falls due in.)
  let job = null;
  for (let i = 0; i < 30 * 60 * 3 && !job; i++) {
    game.minute = Math.max(game.minute, 10 * 60 + 58);
    game.update(1 / 30, input);
    if (sim.hereJob && sim.hereJob.L === L) job = sim.hereJob;
  }
  assert.ok(job, 'its day of business under way, not done all at once');
  const lastAbs = L.econ.lastAbs;
  let frames = 0;
  while (sim.hereJob === job && frames < 600) {
    game.update(1 / 30, input);
    frames++;
    if (sim.hereJob === job) assert.ok(L.econ.lastAbs <= lastAbs + 60, 'its hours wait for it');
  }
  assert.ok(frames > 1, `spread over frames (${frames})`);
  assert.notEqual(sim.hereJob, job, 'and done');
  // (And then its hours catch up.)
  for (let i = 0; i < 60; i++) game.update(1 / 30, input);
  assert.ok(L.econ.lastAbs + 60 > sim.abs, 'its books up to date');
});

test('a town coming into view finishes its day over the frames after; anything else wanting it done gets it done at once', () => {
  const { game, L } = inCity();
  const sim = game.sim;
  // (Its books as if it hadn't been seen to since yesterday morning.)
  L.econ.lastAbs = Math.floor((sim.abs - 24 * 60) / 60) * 60;
  sim.catchUp(L, true);
  const pending = sim.hereJob && sim.hereJob.L === L;
  assert.ok(pending, 'its day of business left for the frames to come');
  // Anything that needs it done now (a save, a skip) has it done.
  sim.catchUp(L);
  assert.ok(!(sim.hereJob && sim.hereJob.L === L), 'done when it has to be');
  assert.ok(L.econ.lastAbs + 60 > sim.abs);
});

test('the look for a pier is made ahead, a few rows at a time, and finds the same spot', () => {
  const game = makeGame(12345);
  const S = game.sim.ships;
  let checked = 0;
  for (const s of game.world.ow.settlements) {
    if (!S.wet(s) || s.deserted) continue;
    const L = game.world.getLayout(s);
    if (!L || !L.edgeSteps) continue;
    for (const size of ['small', 'medium']) {
      const steps = S.dockSiteSteps(L, size);
      let r;
      let yields = 0;
      do {
        r = steps.next();
        if (!r.done) yields++;
      } while (!r.done);
      assert.deepEqual(r.value, S.dockSite(L, size), `${s.name}: the same spot`);
      assert.ok(yields > 1, 'a few rows at a time');
      checked++;
    }
    // Made ahead for the day: used, as the town's unchanged; not, if it has.
    S.found = { sid: s.id, day: 3, sig: S.dockSig(L), sites: new Map([['small', 'AHEAD']]) };
    assert.equal(S.dockFor(L, 3, 'small'), 'AHEAD');
    assert.notEqual(S.dockFor(L, 4, 'small'), 'AHEAD', 'another day: looked for again');
    S.found.sig = 'changed';
    assert.notEqual(S.dockFor(L, 3, 'small'), 'AHEAD', 'the town changed: looked for again');
    S.found = null;
    if (checked >= 4) break;
  }
  assert.ok(checked >= 2, 'towns on the water looked at');
});

test('the ground by an old place\'s way in is kept while anyone\'s below; climbing out lays nothing out again', () => {
  const game = makeGame(12345);
  const input = stubInput();
  const base = game.sim.dungeons.all.find((q) => q.type === 'crypt' && q.x !== undefined);
  game.teleportPlayer(base.x, game.world.findStandY(base.x, base.z + 3, 40) || 40, base.z + 3);
  for (let i = 0; i < 30; i++) game.update(1 / 30, input);
  const run = new DungeonRun(game, { ...base, floors: {}, cleared: false, pack: null, weakened: 0, depth: 3 });
  run.enter();
  // (Long enough below for anything far off to be let go.)
  for (let i = 0; i < 400; i++) game.update(1 / 30, input);
  const rx = Math.floor(base.x / REGION_W);
  const rz = Math.floor(base.z / REGION_D);
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) if (game.world.inBounds(rx + dx, rz + dz)) assert.ok(game.world.isLoaded(rx + dx, rz + dz), 'kept while you\'re below');
  const t0 = performance.now();
  run.leave();
  assert.ok(performance.now() - t0 < 1000);
  assert.ok(!game.regionPinned(rx + 5, rz + 5), 'nothing else kept for it');
});

test('a creature with no way to where it\'s going doesn\'t look again every frame', () => {
  const game = makeGame(12345);
  const input = stubInput();
  const base = game.sim.dungeons.all.find((q) => q.type === 'crypt');
  new DungeonRun(game, { ...base, floors: {}, cleared: false, pack: null, weakened: 0, depth: 3 }).enter();
  const p = game.player;
  // Shut in where it stands: no step to take toward anywhere.
  const at = { x: p.x + 3, z: p.z };
  for (let dz = -1; dz <= 1; dz++) {
    for (let dx = -1; dx <= 1; dx++) {
      game.world.setBlock(at.x + dx, FY - 1, at.z + dz, B.stone);
      for (const y of [FY, FY + 1, FY + 2]) game.world.setBlock(at.x + dx, y, at.z + dz, dx || dz ? B.stone : B.air);
    }
  }
  const c = new Creature(game, 'mourner', at.x, FY, at.z);
  game.addCreature(c);
  const goal = { x: at.x + 8, z: at.z };
  game.frameNo = 100;
  assert.equal(walkTo(c, goal, 0), false);
  assert.equal(c.lureNone, c.lureGoal, 'none found, and noted');
  c.lurePath = null;
  game.frameNo = 105;
  assert.equal(walkTo(c, goal, 0), false);
  assert.equal(c.lurePath, null, 'not looked for again so soon');
  game.frameNo = 140;
  walkTo(c, goal, 0);
  assert.ok(Array.isArray(c.lurePath), 'looked for again in a while');
  void input;
});

test('a picture\'s pixels kept from when it was made, or read once and kept', () => {
  let reads = 0;
  const data = new Uint8ClampedArray(4 * 4 * 4).map((_, i) => i % 256);
  const canvas = (w, h) => ({ width: w, height: h, getContext: () => ({ getImageData: () => { reads++; return { data }; } }) });
  const a = keepPixels(canvas(4, 4), data);
  assert.equal(pixelsOf(a), data);
  assert.equal(reads, 0, 'kept, not read back');
  const b = canvas(4, 4);
  pixelsOf(b);
  pixelsOf(b);
  assert.equal(reads, 1, 'read once, then kept');
  // A piece of it, as getImageData gives it.
  const piece = pixelsIn(a, 1, 2, 2, 1);
  assert.deepEqual([...piece], [...data.slice((2 * 4 + 1) * 4, (2 * 4 + 3) * 4)]);
  // (And nowhere in drawing is a picture read back to draw an icon.)
  const src = fs.readFileSync(new URL('../src/render/renderer.js', import.meta.url), 'utf8');
  assert.ok(!/sctx\.getImageData|ctxm\.getImageData|img\.getContext\('2d'\)\.getImageData/.test(src));
});

test('the floor\'s plan, packed small by the host and the same at the guest\'s', () => {
  const rec = { id: 'p1', type: 'barrow', seed: 4242, depth: 3, level: 2, name: 'T', origin: { who: 'x', y: 1 }, fallen: [] };
  const f = buildFloor(rec, 1);
  const packed = packPlan(f, 'k');
  const text = JSON.stringify(packed);
  assert.ok(text.length < f.plan.W * f.plan.D * 2, `packed small (${text.length} for ${f.plan.W * f.plan.D} squares)`);
  const back = unpackPlan(JSON.parse(text));
  assert.equal(back.plan.W, f.plan.W);
  assert.equal(back.plan.D, f.plan.D);
  assert.deepEqual([...back.plan.open], [...f.plan.open]);
  assert.deepEqual([...back.plan.room], [...f.plan.room]);
  assert.equal(back.x0, f.x0);
  assert.deepEqual(back.up, f.up ? { x: f.up.x, z: f.up.z } : null);
  assert.equal(back.rooms.length, f.rooms.filter((r) => r.stairs).length);
  // (The guest no longer lays floors out itself.)
  const guest = fs.readFileSync(new URL('../src/net/guest.js', import.meta.url), 'utf8');
  assert.ok(!/planFloor|buildFloor/.test(guest), 'no floor laid out on a guest\'s machine');
});

test('each thing\'s state worked out once, for however many it\'s sent to', () => {
  const { game } = inCity();
  const n = game.npcs.find((q) => !q.dead);
  assert.ok(n, 'someone about');
  const now = fieldsOf(n);
  const a = {};
  const b = {};
  const da = diffFields(n, a, now);
  const db = diffFields(n, b);
  assert.deepEqual(da, db, 'the same, worked out once or for each');
  assert.equal(diffFields(n, a, now), null, 'nothing new the second time');
  const host = fs.readFileSync(new URL('../src/net/host.js', import.meta.url), 'utf8');
  assert.ok(/this\.fields = new Map\(\)/.test(host) && /this\.fields = null/.test(host), 'kept for a frame, no longer');
});

test('version 1.15.0, and the step to it', () => {
  assert.ok(compareVersions(GAME_VERSION, '1.15.0') >= 0);
  const steps = stepsFor('1.14.0').filter((s) => s.to === '1.15.0');
  assert.equal(steps.length, 1);
  const log = [];
  steps[0].data({}, log);
  assert.ok(/plan/i.test(log[0]) && /frame/i.test(log[0]));
});
