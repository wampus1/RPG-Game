// Round 70: no stall finding a town's ship somewhere to lie; a task taken
// up by something you did says so (and whose it is); imperial cities full
// of houses and shops, with an arena, a park, a training yard, beast pens,
// a market square and a monument; thin walls along a bridge, joined all
// the way (slanted ones too), its lanterns lit; and a dungeon's chests
// with its own dishes in them, and their recipes now and then.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGame, stubInput } from './helpers.mjs';
import { waterSpot } from '../src/game/ships3d.js';
import { R } from '../src/sim/saga/core.js';
import { B, BLOCKS, META_STATE, WALL_BASES } from '../src/world/blocks.js';
import { bridgeMats, onBridge, DECK_Y } from '../src/world/bridges.js';
import { PANTRY, pantryOf, dungeonDish, lootFor } from '../src/world/dungeongen.js';
import { parseDish, RECIPE_PREFIX } from '../src/world/dishes.js';
import { LANDMARKS } from '../src/world/empire.js';
import { WORLD_GEN } from '../src/world/worldgen.js';
import { STEPS, migrateSave } from '../src/game/migrate.js';
import { GAME_VERSION, compareVersions } from '../src/version.js';
import { RNG } from '../src/util/rng.js';

const empireCity = (game) => game.world.ow.settlements.find((s) => s.empire && s.type === 'city' && s.condition !== 'abandoned' && !s.deserted);

test('finding a ship somewhere to lie never makes the world (no stall)', () => {
  const game = makeGame(4242);
  const before = game.world.regions.size;
  const far = { x: game.player.x + 3000, z: game.player.z + 3000 };
  const t = Date.now();
  const at = waterSpot(game, 'galleon', far.x, far.z, 0, 16, false);
  assert.equal(at, null, 'nothing loaded there: nowhere found');
  assert.equal(game.world.regions.size, before, 'and nothing generated looking');
  assert.ok(Date.now() - t < 200);
});

test('a task taken up unasked says so, and whose it is', () => {
  const game = makeGame(12345);
  const input = stubInput();
  game.minute = 10 * 60;
  for (let i = 0; i < 20; i++) game.update(0.1, input);
  const S = game.sim.saga;
  let t = null;
  for (let d = 0; d < 40 && !t; d++) {
    S.daily(d);
    t = S.openTasks().find((q) => q.giverName && !q.only && !S.person('host').known[q.id]);
  }
  assert.ok(t, 'a task going');
  const n = game.ui.msgs.length;
  S.accept(t, R.pl('host'));
  const said = game.ui.msgs.slice(n).join('\n');
  assert.match(said, /In your journal now/);
  assert.ok(said.includes(t.giverName), 'whose');
  // (One you were told of first: nothing more said.)
  const t2 = S.openTasks().find((q) => q !== t && !q.only && !q.claims.length);
  if (t2) {
    S.hear('host', t2);
    const m = game.ui.msgs.length;
    S.accept(t2, R.pl('host'));
    assert.ok(!game.ui.msgs.slice(m).some((q) => /In your journal now/.test(q)));
  }
});

test('thin walls of thirteen stones, joining like fences', () => {
  assert.equal(WALL_BASES.length, 13);
  for (const base of WALL_BASES) {
    const id = B[`${base}_wall`];
    assert.ok(id !== undefined, base);
    const o = BLOCKS[id];
    assert.equal(o.render, 'wall');
    assert.equal(o.opaque, false);
    assert.equal(o.wallOf, base);
    assert.equal(o.tool, BLOCKS[B[base]].tool);
  }
});

test('a bridge parapet is a wall of its stone; a plank bridge keeps its rail', () => {
  assert.equal(bridgeMats('default', 'stone').rail, B.cobblestone_wall);
  assert.equal(bridgeMats('default', 'causeway').rail, B.stone_bricks_wall);
  assert.equal(bridgeMats('kharos', 'stone').rail, B.basalt_wall);
  assert.equal(bridgeMats('velmarch', 'causeway').rail, B.marble_wall);
  assert.equal(bridgeMats('default', 'plank').rail, B.fence);
});

test('a slanted bridge: its parapet joined side to side all along, its deck no narrower', () => {
  const b = { x0: 0, z0: 0, x1: 40, z1: 30, hw: 1, kind: 'stone', bx0: -5, bx1: 45, bz0: -5, bz1: 35 };
  const at = new Map();
  for (let z = -5; z <= 35; z++) for (let x = -5; x <= 45; x++) {
    const c = onBridge([b], x, z);
    if (c) at.set(`${x},${z}`, c);
  }
  const edge = (c) => c.rim || Math.abs(c.side) === b.hw || Math.abs(c.sideF) + c.slant > b.hw + 0.5;
  const walls = [...at].filter(([, c]) => edge(c)).map(([k]) => k);
  const set = new Set(walls);
  // Two runs of wall, one each side, each joined up without a corner step.
  const seen = new Set();
  let runs = 0;
  for (const k of walls) {
    if (seen.has(k)) continue;
    runs++;
    const q = [k];
    seen.add(k);
    while (q.length) {
      const [x, z] = q.pop().split(',').map(Number);
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const n = `${x + dx},${z + dz}`;
        if (set.has(n) && !seen.has(n)) (seen.add(n), q.push(n));
      }
    }
  }
  assert.equal(runs, 2);
  // And the walkway between them always there.
  for (let t = 3; t < 47; t += 2) {
    const x = Math.round((t / 50) * 40);
    const z = Math.round((t / 50) * 30);
    const c = at.get(`${x},${z}`);
    assert.ok(c && !edge(c), `deck at ${x},${z}`);
  }
});

test('the lanterns on a bridge are lit when it is made', () => {
  const game = makeGame(4242, { wg: 3 });
  const bs = game.world.ow.bridges || [];
  const b = bs.find((q) => q.kind !== 'plank');
  assert.ok(b, 'a stone bridge or causeway');
  let lamps = 0;
  for (let k = 0; k <= 1; k += 0.05) {
    const cx = Math.round(b.x0 + (b.x1 - b.x0) * k);
    const cz = Math.round(b.z0 + (b.z1 - b.z0) * k);
    game.loadAround(cx, cz, true);
  }
  const M = bridgeMats(b.land, b.kind);
  for (let z = Math.floor(b.bz0); z <= b.bz1; z++) for (let x = Math.floor(b.bx0); x <= b.bx1; x++) {
    if (!game.world.regionAt(x, z)) continue;
    for (const y of [DECK_Y + 2, DECK_Y + 4]) {
      if (game.world.getBlock(x, y, z) !== M.lamp) continue;
      lamps++;
      assert.ok(game.world.getMeta(x, y, z) & META_STATE, `lit at ${x},${y},${z}`);
    }
  }
  assert.ok(lamps > 0, 'lamps on it');
});

test('a dungeon keeps its own dishes, and now and then the recipe', () => {
  for (const [type, list] of Object.entries(PANTRY)) {
    const P = pantryOf(type);
    assert.ok(P.length >= 3, type);
    for (const k of P) assert.ok(list.includes(k), `${type}: ${k}`);
  }
  const rng = new RNG(7);
  for (let i = 0; i < 30; i++) {
    const key = dungeonDish('grotto', null, rng);
    assert.ok(key);
    const d = parseDish(key);
    assert.ok(d && d.ings.length >= 1 && d.ings.length <= 3);
    for (const k of d.ings) assert.ok(pantryOf('grotto').includes(k), k);
  }
  let dishes = 0;
  let recipes = 0;
  const r2 = new RNG(11);
  for (let i = 0; i < 400; i++) {
    for (const [k] of lootFor('crypt', 2, r2, 1)) {
      if (k.startsWith(RECIPE_PREFIX)) recipes++;
      else if (parseDish(k)) dishes++;
    }
  }
  assert.ok(dishes > 80, `dishes ${dishes}`);
  assert.ok(recipes > 15 && recipes < dishes, `recipes ${recipes}`);
  // (Never in a Kavorent vault.)
  for (let i = 0; i < 100; i++) for (const [k] of lootFor('kavorent', 2, r2, 1)) assert.ok(!parseDish(k) && !k.startsWith(RECIPE_PREFIX));
});

test('an imperial city: landmarks, beast pens, and its streets filled with houses and shops', () => {
  assert.ok(WORLD_GEN >= 3);
  const game = makeGame(4242, { wg: 3 });
  const s = empireCity(game);
  assert.ok(s, 'an imperial city');
  const L = game.world.getLayout(s);
  const kinds = (L.landmarks || []).map((m) => m.kind);
  assert.ok(kinds.length >= 4, kinds.join());
  for (const k of kinds) assert.ok(LANDMARKS.some((q) => q.kind === k), k);
  assert.equal(new Set(kinds).size, kinds.length, 'no two the same');
  assert.ok(L.buildings.some((b) => b.type === 'academy' || b.type === 'college'), 'a school');
  assert.ok(L.fillers > 10, `${L.fillers} more houses and shops`);
  // Landmarks don't overlap each other.
  const ms = L.landmarks;
  for (let i = 0; i < ms.length; i++) for (let j = i + 1; j < ms.length; j++) {
    const a = ms[i];
    const c = ms[j];
    assert.ok(a.x1 < c.x0 || c.x1 < a.x0 || a.z1 < c.z0 || c.z1 < a.z0, `${a.kind} / ${c.kind}`);
  }
  // The same every time.
  const again = makeGame(4242, { wg: 3 }).world.getLayout(s);
  assert.deepEqual(again.landmarks.map((m) => [m.kind, m.x0, m.z0]), ms.map((m) => [m.kind, m.x0, m.z0]));
  // Its pens stocked when it's lived in.
  if (kinds.includes('pens')) {
    assert.ok(L.pens.length >= 1);
    game.activate(s, true);
    const stock = game.creatures.filter((c) => c.livestock === s.id && c.leash);
    assert.ok(stock.length > 0, 'beasts in the pens');
    for (const c of stock) assert.ok(c.x >= c.leash.x0 && c.x <= c.leash.x1 + 1 && c.z >= c.leash.z0 && c.z <= c.leash.z1 + 1);
  }
});

test('a world made before keeps its cities as they were', () => {
  const game = makeGame(4242, { wg: 2 });
  const s = empireCity(game);
  if (!s) return;
  const L = game.world.getLayout(s);
  assert.ok(!(L.landmarks && L.landmarks.length));
});

test('the update: 0.70.0', () => {
  assert.ok(compareVersions(GAME_VERSION, '0.70.0') >= 0);
  const st = STEPS.find((q) => q.to === '0.70.0');
  assert.ok(st);
  const d = { gv: '0.69.0', wg: 2 };
  const { log } = migrateSave(d);
  assert.ok(log.some((l) => /thin walls/.test(l)));
  assert.ok(log.some((l) => /Dungeon chests/.test(l)));
  assert.equal(d.wg, 2, 'its plan kept');
});
