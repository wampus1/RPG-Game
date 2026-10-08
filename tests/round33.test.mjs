import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGame, stubInput } from './helpers.mjs';
import { RNG } from '../src/util/rng.js';
import { MAP_W, MAP_H, REGION_W, REGION_D, DAY_MINUTES } from '../src/config.js';
import { LANDMASSES, DAGONI_KEYS, STORM, stormAt, insideStorm } from '../src/world/geography.js';
import { Overworld } from '../src/world/worldgen.js';
import { BIOMES } from '../src/world/biomes.js';
import { B } from '../src/world/blocks.js';
import { ITEMS } from '../src/world/items.js';
import { RECIPES } from '../src/world/recipes.js';
import { CULTURES } from '../src/world/names.js';
import { SPAWNS_OFF } from '../src/world/dungeongen.js';
import { TECHS, ISLE_TECHS, offered, isleOf, treeOf } from '../src/sim/tech.js';
import { OVERSEA } from '../src/sim/war.js';
import { ERUPT_MIN, ERUPT_MAX } from '../src/sim/volcano.js';
import { SPECIES, Creature } from '../src/entities/creature.js';
import { STORM_WALL, steer } from '../src/entities/raft.js';
import { rollCatch, KINDS } from '../src/game/fishing.js';
import { MapWindow, ZOOMS, mapMode } from '../src/ui/worldmap.js';

const DAY = DAY_MINUTES;

function world(seed = 12345) {
  return makeGame(seed);
}

function run(game, input, secs, step = 0.05) {
  for (let t = 0; t < secs; t += step) game.update(step, input);
}

const centre = (s) => ({ x: (s.bounds.x0 + s.bounds.x1) / 2, z: (s.bounds.z0 + s.bounds.z1) / 2 });

// ------------------------------------------------------------ the world
test('a much bigger world: three Dagoni Islands inside a storm, two continents and far isles beyond', () => {
  // (A world as they were made then: since 0.68 the far lands are lived in
  // too. See round68.test.mjs.)
  const ow = new Overworld(12345, { wg: 1 });
  assert.ok(MAP_W * MAP_H >= 300 * 220, `a big map (${MAP_W} x ${MAP_H})`);
  assert.deepEqual([...DAGONI_KEYS].sort(), ['kharos', 'myrrow', 'thessa']);
  assert.equal(LANDMASSES.filter((L) => L.kind === 'continent').length, 2);
  assert.ok(LANDMASSES.filter((L) => L.kind === 'isle').length >= 3, 'farther islands');
  // Everyone lives on the Dagoni Islands; every one of the three is lived on.
  for (const k of DAGONI_KEYS) assert.ok(ow.settlements.some((s) => s.island === k), `${k} has towns`);
  assert.ok(ow.settlements.every((s) => DAGONI_KEYS.has(s.island)));
  // The three are inside the storm; the rest of the world outside it.
  for (const L of LANDMASSES) {
    const x = L.cx * REGION_W;
    const z = L.cz * REGION_D;
    assert.equal(insideStorm(x, z), L.kind === 'dagoni', L.key);
  }
  // Far lands are land (with biomes), but empty.
  const vel = LANDMASSES.find((L) => L.key === 'velmarch');
  const far = ow.cell(vel.cx, vel.cz);
  assert.ok(far && far.biome !== 'ocean', 'Velmarch is land');
  assert.ok(!ow.settlements.some((s) => Math.hypot(s.cx - vel.cx, s.cz - vel.cz) < vel.rx));
  // (Only the islands are worked out up front; the rest comes when looked at.)
  assert.ok(ow.liveCells.length < MAP_W * MAP_H / 3, 'lazy far cells');
});

test('the player starts on Thessa, a small island among the three', () => {
  const game = world();
  const p = game.player;
  assert.equal(game.world.ow.islandAt(p.x, p.z), 'thessa');
  // (Small beside the continents over the sea.)
  const area = (k) => {
    const L = LANDMASSES.find((q) => q.key === k);
    return L.rx * L.rz;
  };
  for (const k of ['velmarch', 'ostria']) assert.ok(area('thessa') * 8 < area(k), `smaller than ${k}`);
  assert.ok(game.world.ow.islandCells('thessa').length < game.world.ow.islandCells('kharos').length * 3, 'and not so much bigger than its neighbours');
});

test('the storm turns back anyone else\'s raft: it would take a real ship to get out (or in)', () => {
  // The ring itself is wild; the islands' sea within it is calm.
  const ringX = (STORM.cx + STORM.rx + STORM.band / 2) * REGION_W;
  const ringZ = STORM.cz * REGION_D;
  assert.ok(stormAt(ringX, ringZ) > STORM_WALL, 'wild in the band');
  assert.equal(stormAt(STORM.cx * REGION_W, STORM.cz * REGION_D), 0, 'calm within');
  const game = world();
  const input = stubInput();
  run(game, input, 0.5);
  // Paddling east out of the islands' sea, up to the edge of it.
  const z = Math.round(ringZ);
  let x = Math.round((STORM.cx + STORM.rx * 0.6) * REGION_W);
  while (stormAt(x + 1, z) <= STORM_WALL) x++;
  const calls = [];
  game.stormTurnsBack = (raft) => calls.push(raft);
  // (Yours goes on in: see round38's storm.)
  const p = { game, kind: 'npc', raft: { x, z, ang: Math.PI / 2, v: 4 } };
  const fwd = { isDown: (k) => k === 'KeyW' };
  steer(p, 0.5, fwd);
  assert.ok(p.raft.v < 0, 'thrown back');
  assert.equal(p.raft.x, x, 'no further out');
  assert.deepEqual(calls, [true]);
  // (Coming back in is no trouble.)
  p.raft.ang = -Math.PI / 2;
  p.raft.v = 2;
  game.world.isWaterAt = () => true;
  assert.ok(stormAt(x - 1, z) <= stormAt(x, z));
});

// ------------------------------------------------------------ the islands
test('each island has biomes of its own, and its own people', () => {
  const ow = new Overworld(12345);
  const isleBiomes = Object.entries(BIOMES).filter(([, b]) => b.isle);
  assert.ok(isleBiomes.length >= 6, 'new biomes');
  const seen = { thessa: new Set(), kharos: new Set(), myrrow: new Set() };
  for (const k of DAGONI_KEYS) for (const c of ow.islandCells(k)) seen[k].add(c.biome);
  for (const [name, b] of isleBiomes) {
    assert.ok(seen[b.isle].has(name), `${name} on ${b.isle}`);
    for (const k of DAGONI_KEYS) if (k !== b.isle) assert.ok(!seen[k].has(name), `no ${name} on ${k}`);
  }
  // Kharos has its volcano; the Ashborn live there; the Mirefolk and the
  // Stiltfolk on Myrrow.
  assert.ok(seen.kharos.has('volcano'));
  assert.ok(ow.settlements.filter((s) => s.island === 'kharos').every((s) => s.style === 'ember'));
  assert.ok(ow.settlements.filter((s) => s.island === 'myrrow').every((s) => s.style === 'mist' || s.style === 'tide'));
  assert.ok(!ow.settlements.some((s) => s.island === 'thessa' && ['ember', 'mist', 'tide'].includes(s.style)));
  for (const k of ['ember', 'mist', 'tide']) assert.ok(CULTURES[k] && CULTURES[k].first.length >= 40, `${k} names`);
});

test('the islands\' own blocks and goods: lava, ash, black glass; peat, moss, giant mushrooms', () => {
  for (const k of ['ash', 'basalt', 'obsidian', 'lava', 'cinder', 'sulfur_crust', 'steam_vent', 'log_cinder', 'fire_lily', 'moss', 'peat', 'heather', 'mycelium', 'log_mangrove', 'mushroom_cap', 'glowcap_cap']) assert.ok(B[k] !== undefined, k);
  for (const k of ['sulfur', 'peat_turf', 'obsidian_shard', 'moth_dust', 'obsidian_blade', 'harpoon', 'pepper_stew', 'mushroom_broth', 'crab_boil', 'cooked_crab']) assert.ok(ITEMS[k], k);
  // What you can make of them.
  const makes = (out, k) => RECIPES.some((r) => r.out === out && r.in[k]);
  assert.ok(makes('obsidian_blade', 'obsidian_shard'));
  assert.ok(makes('planks', 'log_mangrove') && makes('planks_dark', 'log_cinder'));
  assert.ok(makes('dynamite', 'sulfur'));
  assert.ok(makes('cooked_crab', 'crab_meat'));
  assert.ok(makes('torch', 'peat_turf'));
  for (const r of RECIPES) for (const k of [r.out, ...Object.keys(r.in)]) assert.ok(ITEMS[k] || k === 'log', `${k} is a thing`);
});

test('each island has creatures of its own, and fish', () => {
  const kh = Object.entries(SPECIES).filter(([, s]) => s.isle === 'kharos').map(([k]) => k);
  const my = Object.entries(SPECIES).filter(([, s]) => s.isle === 'myrrow').map(([k]) => k);
  assert.ok(kh.length >= 3 && my.length >= 3);
  assert.ok(kh.some((k) => SPECIES[k].night && SPECIES[k].mode === 'hostile'), 'something to fear at night on Kharos');
  // Fish: only off their island.
  const catches = (isle) => {
    const seen = new Set();
    let r = 1;
    const rand = () => (r = (r * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 4000; i++) {
      seen.add(rollCatch(rand, { rank: 5, isle, salt: false }));
      seen.add(rollCatch(rand, { rank: 5, isle, salt: true }));
    }
    return seen;
  };
  const isleFish = Object.entries(KINDS).filter(([, k]) => k.isle);
  assert.ok(isleFish.length >= 4);
  const at = { thessa: catches('thessa'), kharos: catches('kharos'), myrrow: catches('myrrow') };
  for (const [k, K] of isleFish) {
    assert.ok(at[K.isle].has(k), `${k} off ${K.isle}`);
    for (const o of DAGONI_KEYS) if (o !== K.isle) assert.ok(!at[o].has(k), `no ${k} off ${o}`);
  }
});

test('a cinderling throws fire that burns where it lands; a crawler puffs spores when struck', () => {
  const game = world();
  const input = stubInput();
  run(game, input, 0.5);
  const p = game.player;
  p.godMode = true;
  game.minute = 23 * 60;
  const y = game.world.findStandY(p.x + 5, p.z, p.y);
  const c = new Creature(game, 'cinderling', p.x + 5, y, p.z);
  game.addCreature(c);
  c.target = p;
  let lobs = 0;
  for (let i = 0; i < 400 && !lobs; i++) {
    game.minute = 23 * 60;
    game.update(0.05, input);
    lobs = game.projectiles.filter((a) => a.from === c && a.onLand).length;
  }
  assert.ok(lobs, 'it threw');
  const a = game.projectiles.find((q) => q.from === c && q.onLand);
  assert.deepEqual(a.tint, [255, 130, 40]);
  // Where it comes down: fire on the ground.
  const fires = () => [...(game.fireTiles || new Map()).values()].filter((z) => !z.done).length;
  const f0 = fires();
  a.onLand(game, Math.round(p.x), Math.round(p.z), Math.round(p.y));
  assert.ok(fires() > f0 || p.burnT > 0, 'the ground burns');
  // A crawler, struck, puffs spores (sooner or later).
  const y2 = game.world.findStandY(p.x - 3, p.z, p.y);
  const cr = new Creature(game, 'shroom_crawler', p.x - 3, y2, p.z);
  game.addCreature(cr);
  const zones = () => (game.zones || []).filter((z) => z.kind === 'spores' && z.by === cr).length;
  for (let i = 0; i < 12 && !zones(); i++) cr.onHurt(p);
  assert.ok(zones(), 'spores');
  assert.ok(cr.angry, 'and it turns on you');
});

test('the coward is kept out of the old places for now', () => {
  assert.ok(SPAWNS_OFF.has('coward'));
});

// ------------------------------------------------------------ technology
test('each island\'s realms have a few technologies nobody else can learn', () => {
  const game = world();
  const ow = game.world.ow;
  const by = {};
  for (const id of ISLE_TECHS) for (const k of TECHS[id].isles) (by[k] ||= []).push(id);
  for (const k of DAGONI_KEYS) assert.ok((by[k] || []).length >= 3, `${k}: ${by[k]}`);
  for (const k of DAGONI_KEYS) {
    const s = ow.settlements.find((q) => q.civ && isleOf(q) === k);
    assert.ok(s, `a realm on ${k}`);
    for (const id of ISLE_TECHS) assert.equal(offered(s, id), TECHS[id].isles.includes(k), `${id} on ${k}`);
    // (And most of the common tree is shared: each island goes without a
    // few of its steps; see round 34. A step it learns in a form of its
    // own counts as shared: Kharos's kilnwork for masonry, say.)
    const common = Object.keys(TECHS).filter((id) => !TECHS[id].isles);
    const ownForm = (id) => ISLE_TECHS.some((q) => TECHS[q].as.includes(id) && offered(s, q));
    const shared = common.filter((id) => offered(s, id) || ownForm(id)).length;
    assert.ok(shared >= common.length - 8 && shared < common.length, `${k}: ${shared} of ${common.length}`);
    assert.equal(treeOf(k).ids.length, Object.keys(TECHS).filter((id) => offered(s, id)).length);
  }
});

// ------------------------------------------------------------ across the water
test('realms on different islands raid and make war across the water, by raft', () => {
  const game = world();
  const ow = game.world.ow;
  const W = game.sim.war;
  for (const s of ow.settlements) game.sim.layoutOf(s.id);
  let found = null;
  for (const a of ow.civs) for (const b of ow.civs) {
    if (a === b || found || a.island === b.island) continue;
    const pair = W.seaPairs(a, b, 28).find(([s, o]) => s.island !== o.island);
    if (pair) found = { a, b, pair };
  }
  assert.ok(found, 'a pair of towns facing each other over the sea');
  const [s, o] = found.pair;
  assert.ok(s.coast && o.coast);
  assert.ok(Math.hypot(s.cx - o.cx, s.cz - o.cz) <= OVERSEA);
  // (Never by land.)
  assert.ok(!W.borderPairs(found.a, found.b, 999).some(([x, y]) => x.island !== y.island));
  const raid = W.planRaid(found.a, found.b, s, o, game.day, new RNG(3), true);
  assert.ok(raid && raid.naval, 'raiders by raft');
  // Neighbours over the water hear of one another and send envoys.
  assert.ok(game.sim.diplomacy.travelHours(s, o) > 8, 'a long crossing');
});

// ------------------------------------------------------------ the volcano
test('the volcano wakes every 60 to 100 days: tremors first, then fire, ash, and lava', () => {
  const game = world();
  const input = stubInput();
  run(game, input, 0.5);
  const V = game.sim.volcano;
  const ow = game.world.ow;
  assert.ok(ow.volcano && ow.island(ow.volcano.island).key === 'kharos', 'on Kharos');
  for (const s of ow.settlements) game.sim.layoutOf(s.id);
  V.daily(game.day, new RNG(1));
  const gap = V.next - game.day;
  assert.ok(gap >= ERUPT_MIN && gap <= ERUPT_MAX, `${gap} days`);
  // Tremors, three days before.
  V.daily(V.next - 3, new RNG(2));
  const kh = V.towns('kharos');
  assert.ok(kh.length && kh.every((L) => L.econ.ledger.some((q) => /Sleeper is stirring/.test(q.text))));
  // It goes up.
  const flows0 = ow.volcano.flows.length;
  const r = V.erupt(new RNG(5));
  assert.ok(ow.volcano.flows.length > flows0, 'new rivers of lava');
  assert.ok(V.ashLevel(game.sim.abs + 200) > 0.5, 'the sun blotted out');
  assert.equal(V.ashLevel(game.sim.abs + 6 * DAY), 0, 'for a few days');
  assert.ok(kh.every((L) => L.econ.ledger.some((q) => /Sleeper woke/.test(q.text))));
  const far = V.towns().filter((L) => L.settlement.island !== 'kharos');
  assert.ok(far.length && far.every((L) => L.econ.ledger.some((q) => /came over the sea from Kharos/.test(q.text))), 'heard on the other islands');
  assert.ok(r.dead >= 0 && r.burnt >= 0);
  const gap2 = V.next - game.day;
  assert.ok(gap2 >= ERUPT_MIN && gap2 <= ERUPT_MAX, 'and next time');
  // The new flows run hot, then cool to rock.
  const f = ow.volcano.flows[ow.volcano.flows.length - 1];
  assert.ok(f.until > game.day && f.until <= game.day + 5);
  const Vg = ow.volcano;
  let hot = null;
  for (let d = 0.2; d < 1.6 && !hot; d += 0.02) {
    const x = Math.round(Vg.x + Math.cos(f.a) * d * Vg.r);
    const z = Math.round(Vg.z + (Math.sin(f.a) * d * Vg.r) / Vg.squash);
    if (ow.lavaAt(x, z, Math.hypot(x - Vg.x, (z - Vg.z) * Vg.squash) / Vg.r) === 'lava') hot = { x, z };
  }
  assert.ok(hot, 'molten');
  ow.today = f.until + 1;
  const cool = ow.lavaAt(hot.x, hot.z, Math.hypot(hot.x - Vg.x, (hot.z - Vg.z) * Vg.squash) / Vg.r);
  assert.ok(cool && cool !== 'lava', `cooled to ${cool}`);
});

test('the ash darkens the sky on every one of the islands, and a save keeps the mountain\'s clock', () => {
  const game = world();
  const input = stubInput();
  run(game, input, 0.5);
  const V = game.sim.volcano;
  V.erupt(new RNG(7));
  game.minute = 12 * 60;
  run(game, input, 2);
  assert.ok(game.ashLevel() > 0, 'dark at noon on Thessa');
  // (Burning rock comes down only on Kharos: sail away and it stops.)
  V.bombs = 10;
  const hz = (game.hazards || []).length;
  V.rain(0.1);
  assert.equal(V.bombs, 0);
  assert.equal((game.hazards || []).length, hz);
  const d = JSON.parse(JSON.stringify(game.sim.serialize()));
  const g2 = world();
  g2.sim.load(d);
  assert.equal(g2.sim.volcano.next, V.next);
  assert.equal(g2.sim.volcano.count, V.count);
  assert.equal(g2.world.ow.volcano.flows.filter((f) => f.born !== undefined).length, game.world.ow.volcano.flows.filter((f) => f.born !== undefined).length);
});

// ------------------------------------------------------------ the map
test('the world map zooms in and out (condensed tiles, then dots) and pans with W/A/S/D', () => {
  const game = world();
  const keys = new Set();
  const ui = { game, input: { isDown: (k) => keys.has(k) }, mouse: { x: 0, y: 0, down: false }, mouseCell: null, audio: null, msg() {} };
  const w = new MapWindow(ui);
  // (The list down the right put away: the map has the window to itself.)
  w.listOpen = false;
  w.listW = 0;
  assert.equal(mapMode(w.z), 'glyphs', 'opens close in');
  // Out, step by step: the glyphs squeeze into tiles, then into dots.
  const modes = [];
  for (let i = 0; i < ZOOMS.length; i++) {
    modes.push(mapMode(w.z));
    w.zoomTo(w.zi - 1);
  }
  assert.ok(modes.includes('tiles') && modes.includes('dots'));
  assert.equal(w.z, ZOOMS[0]);
  // All the way out: the whole world, in the middle of the window.
  w.update(0.05);
  const A = w.area();
  const tl = w.at(0, 0);
  const br = w.at(MAP_W * REGION_W, MAP_H * REGION_D);
  assert.ok(tl.x >= A.x0 - 1 && br.x <= A.x1 + 1 && tl.y >= A.y0 - 1 && br.y <= A.y1 + 1, 'all of it in view');
  assert.ok(Math.abs((tl.x + br.x) / 2 - (A.x0 + A.x1) / 2) < 2, 'centred');
  // Back in, and along with D held.
  w.zoomTo(3);
  const x0 = w.cam.x;
  keys.add('KeyD');
  for (let i = 0; i < 20; i++) w.update(0.05);
  keys.clear();
  assert.ok(w.cam.x > x0 + 2, 'moved east');
  const z0 = w.cam.z;
  keys.add('KeyW');
  for (let i = 0; i < 20; i++) w.update(0.05);
  keys.clear();
  assert.ok(w.cam.z < z0 - 2, 'and north');
  // (Never off past the world's edge.)
  keys.add('KeyA');
  for (let i = 0; i < 200; i++) w.update(0.05);
  keys.clear();
  const a = w.area();
  assert.ok(w.origin().x <= a.x0 + 1, 'the west edge stays at the window\'s edge');
  // Space: back to where you are (close in).
  w.zoomTo(ZOOMS.length - 1);
  w.onKey({ code: 'Space' });
  for (let i = 0; i < 60; i++) w.update(0.05);
  assert.ok(Math.abs(w.cam.x - game.player.x / REGION_W) < 1 && Math.abs(w.cam.z - game.player.z / REGION_D) < 1);
  void centre;
});
