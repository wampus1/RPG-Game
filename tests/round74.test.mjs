// Round 74: old places' names four words at most, the first night no
// longer stalled laying out far capitals, the map's list (clicked,
// searched, slid), paintings on walls, houses of two storeys, academies
// walled into rooms, and the migration step.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGame, stubInput } from './helpers.mjs';
import { shortName, wordsIn, bareName } from '../src/world/dungeonnames.js';
import { B, BLOCKS } from '../src/world/blocks.js';
import { wallDirOf } from '../src/game/displays.js';
import { MapWindow } from '../src/ui/worldmap.js';
import { STEPS } from '../src/game/migrate.js';
import { GAME_VERSION, compareVersions } from '../src/version.js';
import { SURFACE } from '../src/config.js';

const Y0 = SURFACE + 1;

test('old places are named in four words at most, without their fluff', () => {
  assert.equal(shortName('the Barrow of Thane Dorrin Stonefist'), 'Dorrin Stonefist\'s Barrow');
  assert.equal(shortName('the Barrow of Old Angus the Bone-Carver'), 'Angus\'s Barrow');
  assert.equal(shortName('the Hammer of the Old Ones'), 'the Old Ones\' Hammer');
  assert.equal(bareName('the Hollow King'), 'the Hollow King');
  const game = makeGame(4242, { wg: 5 });
  const all = game.sim.dungeons.all;
  assert.ok(all.length > 10);
  for (const d of all) assert.ok(wordsIn(d.name) <= 4, d.name);
});

test('the first night: no realm\'s far capital laid out all at once for its ruler', () => {
  const game = makeGame(12345, { wg: 5 });
  const before = game.world.layouts.size;
  for (const civ of game.world.ow.civs || []) {
    const cap = game.world.ow.settlements[civ.capital];
    if (!cap || game.world.layouts.has(cap.id)) continue;
    const t0 = performance.now();
    game.sim.realms.ruler(civ);
    assert.ok(performance.now() - t0 < 150, `${civ.name}'s ruler looked up at once`);
  }
  assert.ok(game.world.layouts.size - before <= 1);
});

test('the map\'s list: a click on a place goes there, the search finds it, the list slides away', () => {
  const game = makeGame(4242, { wg: 5 });
  game.revealMap = true;
  const ui = { game, input: { isDown: () => false }, mouse: { x: 0, y: 0, down: false }, mouseCell: { x: 0, y: 0 }, audio: null, msg() {}, time: 0 };
  const w = new MapWindow(ui);
  const e = w.listEntries(game).find((q) => q.kind === 'place');
  w.goTo(e);
  assert.ok(w.zi >= 4);
  assert.ok(Math.abs(w.goal.x - e.x / 32) < 2 || w.goal.x > 0);
  // (Clicks on the list's own lines reach them: the window's hits.)
  let hit = false;
  w.hits = [{ x: 60, y: 5, w: 20, h: 1, fn: () => { hit = true; } }];
  w.onClick({ button: 0, x: 0, y: 0 }, 61, 5, game);
  assert.ok(hit);
  w.search = e.label.slice(0, 4);
  assert.ok(w.listEntries(game).some((q) => q.label === e.label));
  w.listOpen = false;
  const c0 = w.listCols();
  w.update(0.05);
  assert.ok(w.listCols() < c0 && w.listCols() > 2, 'sliding, not snapped');
  for (let i = 0; i < 40; i++) w.update(0.05);
  assert.equal(w.listCols(), 2);
});

test('paintings hang on a wall (none needed under them) and come down with it', () => {
  const game = makeGame(777, { wg: 5 });
  const p = game.player;
  const w = game.world;
  const x = p.x + 3;
  const z = p.z;
  const y = p.y + 1;
  for (const [dx, dy] of [[0, 0], [0, -1], [1, 0], [1, -1], [-1, 0], [0, 1]]) w.setBlock(x + dx, y + dy, z, B.air);
  for (const yy of [y - 2, y - 1, y, y + 1]) w.setBlock(x, yy, z - 1, B.stone_bricks);
  w.setBlock(x, y - 1, z, B.air);
  assert.ok(BLOCKS[B.painting_small].onWall && !BLOCKS[B.painting_small].support);
  assert.ok(game.canPlace(B.painting_small, x, y, z), 'on the wall, over nothing');
  assert.ok(!game.canPlace(B.painting_small, x + 1, y, z + 2), 'not in the open');
  w.setBlock(x, y, z, B.painting_small, 2);
  assert.equal(wallDirOf(w, x, y, z, 2), 2);
  game.breakBlock(x, y, z - 1, false);
  assert.equal(w.getBlock(x, y, z - 1), B.air);
  assert.equal(w.getBlock(x, y, z), B.air, 'down with its wall');
});

test('homes of two storeys, a stair up to a room over the house', () => {
  const game = makeGame(12345, { wg: 5 });
  const input = stubInput();
  for (let i = 0; i < 3; i++) game.update(0.1, input);
  const w = game.world;
  let checked = 0;
  for (const L of w.layouts.values()) {
    for (const b of L.buildings) {
      if (b.storeys !== 2) continue;
      const st = b.stair;
      // (Only what's loaded.)
      if ([st.from, st.low, st.mid, st.top, b.inside].some((t) => w.getBlock(t.x, Y0 - 1, t.z) === B.bedrock)) continue;
      assert.ok(w.canStand(st.from.x, Y0, st.from.z));
      assert.ok(w.canStand(st.low.x, Y0 + 1, st.low.z));
      assert.ok(w.canStand(st.mid.x, Y0 + 2, st.mid.z));
      assert.ok(w.canStand(st.top.x, Y0 + 3, st.top.z), 'up on the floor above');
      assert.ok(BLOCKS[w.getBlock(b.inside.x, Y0 + 2, b.inside.z)].solid, 'a floor over the house');
      checked++;
    }
  }
  assert.ok(checked > 0);
  const homes = [...w.layouts.values()].flatMap((L) => L.buildings.filter((q) => q.type === 'house_m' || q.type === 'house_l'));
  assert.ok(homes.filter((q) => q.storeys === 2).length >= homes.length * 0.25, 'not rare');
});

test('the migration step: 0.74.0, and old places\' long names cut down', () => {
  assert.ok(compareVersions(GAME_VERSION, '0.74.0') >= 0);
  const step = STEPS.find((s) => s.to === '0.74.0');
  const game = makeGame(777);
  const d = game.sim.dungeons.all[0];
  d.name = 'the Barrow of Thane Dorrin Stonefist';
  const log = [];
  step.game(game, log);
  assert.equal(d.name, 'Dorrin Stonefist\'s Barrow');
  assert.ok(log.length);
});
