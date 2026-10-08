// Round 75: stairs, one for each floor a people lays, climbed with
// something over your head; two-storey homes go up them; and the
// migration step.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGame, stubInput } from './helpers.mjs';
import { B, BLOCKS, STAIR_BASES, stairFor } from '../src/world/blocks.js';
import { RECIPES } from '../src/world/recipes.js';
import { STEPS } from '../src/game/migrate.js';
import { GAME_VERSION, compareVersions } from '../src/version.js';
import { SURFACE } from '../src/config.js';

const Y0 = SURFACE + 1;

test('a stair for each floor, in its own stuff, and made at the workbench', () => {
  for (const base of STAIR_BASES) {
    const s = BLOCKS[B[`${base}_stairs`]];
    assert.ok(s && s.stair && s.render === 'stair' && s.stairOf === base && s.rotatable);
  }
  assert.equal(stairFor(B.marble), B.marble_stairs);
  assert.equal(stairFor(B.planks_dark), B.planks_dark_stairs);
  assert.equal(stairFor(B.dirt), B.planks_stairs, 'plank stairs where there\'s none of its own');
  const list = Array.isArray(RECIPES) ? RECIPES : Object.values(RECIPES).flat();
  assert.ok(list.some((r) => (r.out || r.item || r.result) === 'marble_stairs' || JSON.stringify(r).includes('marble_stairs')));
});

test('up onto a stair with a block over your head, and down again', () => {
  const game = makeGame(777);
  const w = game.world;
  const p = game.player;
  const x = p.x + 3;
  const z = p.z;
  const y = p.y;
  for (let dx = -1; dx <= 2; dx++) for (let dy = 0; dy <= 3; dy++) w.setBlock(x + dx, y + dy, z, B.air);
  for (let dx = -1; dx <= 2; dx++) w.setBlock(x + dx, y - 1, z, B.stone_bricks);
  // A ceiling two over the floor: a plain step under it can't be climbed.
  for (let dx = -1; dx <= 2; dx++) w.setBlock(x + dx, y + 2, z, B.stone_bricks);
  w.setBlock(x, y, z, B.stone_bricks);
  assert.equal(w.stepTarget(x - 1, y, z, x, z), -1, 'a plain block: no room to climb');
  w.setBlock(x, y, z, B.planks_stairs, 3);
  assert.equal(w.stepTarget(x - 1, y, z, x, z), y + 1, 'a stair: up you go, stooping');
  assert.ok(w.canStand(x, y + 1, z));
  assert.equal(w.stepTarget(x, y + 1, z, x - 1, z), y, 'and down');
});

test('a home of two storeys: stairs in its floor\'s stuff, up and down', () => {
  const game = makeGame(12345, { wg: 5 });
  const input = stubInput();
  for (let i = 0; i < 3; i++) game.update(0.1, input);
  const w = game.world;
  let n = 0;
  for (const L of w.layouts.values()) {
    for (const b of L.buildings) {
      if (b.storeys !== 2) continue;
      const st = b.stair;
      if ([st.from, st.low, st.mid, st.top].some((t) => w.getBlock(t.x, Y0 - 1, t.z) === B.bedrock)) continue;
      const want = stairFor(b.mats.floor || B.planks);
      assert.equal(w.getBlock(st.low.x, Y0, st.low.z), want);
      assert.equal(w.getBlock(st.mid.x, Y0 + 1, st.mid.z), want);
      assert.equal(w.getBlock(st.top.x, Y0 + 2, st.top.z), want);
      assert.equal(w.getMeta(st.low.x, Y0, st.low.z) & 3, b.stairUp);
      const path = [st.from, st.low, st.mid, st.top];
      let y = Y0;
      for (let i = 1; i < path.length; i++) y = w.stepTarget(path[i - 1].x, y, path[i - 1].z, path[i].x, path[i].z);
      assert.equal(y, Y0 + 3, 'up');
      for (let i = path.length - 2; i >= 0; i--) y = w.stepTarget(path[i + 1].x, y, path[i + 1].z, path[i].x, path[i].z);
      assert.equal(y, Y0, 'and down');
      n++;
    }
  }
  assert.ok(n > 0);
});

test('the migration step: 0.75.0', () => {
  assert.ok(compareVersions(GAME_VERSION, '0.75.0') >= 0);
  const step = STEPS.find((s) => s.to === '0.75.0');
  assert.ok(step && step.game && step.data);
  const log = [];
  step.data({}, log);
  assert.ok(log.length);
});
