import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGame, stubInput } from './helpers.mjs';
import { B, BLOCKS, META_STATE } from '../src/world/blocks.js';
import { buildFloor, DTYPES, FY, KAV_FLOORS, kavFloor, SPIKE_CYCLE } from '../src/world/dungeongen.js';
import { DungeonRun, BOSS_HP, BOSS_HP_EXTRA, BOSS_DMG, holdings } from '../src/game/dungeon.js';
import { SPECIES } from '../src/entities/creature.js';
import { musicMood, THEMES } from '../src/game/music.js';
import { BLIGHT_R } from '../src/world/sites.js';
import { TradeWindow, OLD_COIN_WANDERING, OLD_COIN_SHOP } from '../src/ui/windows.js';
import { bossTint, drawnAsMaster, LEGGED, BOSS_SCALE } from '../src/render/bossart.js';
import { addItem, countItem } from '../src/game/inventory.js';

function start(seed = 12345, minute = 10 * 60) {
  const game = makeGame(seed);
  const input = stubInput();
  game.minute = minute;
  for (let i = 0; i < 20; i++) game.update(0.1, input);
  return { game, input, p: game.player };
}
const run = (game, input, n, dt = 0.1) => {
  for (let i = 0; i < n; i++) game.update(dt, input);
};
// Play a scene through to its end (on its own clock).
function playScene(game, step = 0.05) {
  for (let i = 0; i < 400 && game.scene; i++) {
    const sc = game.scene;
    sc.t += step;
    sc.update?.(game, step);
    if (sc.t >= sc.dur) {
      sc.end?.(game);
      if (game.scene === sc) game.scene = null;
    }
  }
}
// Every block of a kind on a floor.
function blocksOf(f, id) {
  let n = 0;
  for (const r of f.regions.values()) for (let i = 0; i < r.blocks.length; i++) if (r.blocks[i] === id) n++;
  return n;
}
// A dungeon record of a type, fresh (nothing cleared, no floors kept).
function fresh(game, type) {
  return { ...game.sim.dungeons.all.find((d) => d.type === type), floors: {}, cleared: false, pack: null };
}

// ------------------------------------------------------------ quick fixes
test('a peddler on the road changes up to a hundred old coins a day; a shop in town, fewer', () => {
  const { game } = start();
  assert.equal(OLD_COIN_WANDERING, 100);
  assert.ok(OLD_COIN_SHOP < OLD_COIN_WANDERING);
  const room = (npc) => TradeWindow.prototype.oldRoom.call({ npc }, game);
  const peddler = { visit: { goods: {} }, rec: {} };
  assert.equal(room(peddler), 100);
  const caravan = { rec: { caravanTrader: 3 } };
  assert.equal(room(caravan), 100);
  const shop = { rec: {} };
  assert.equal(room(shop), OLD_COIN_SHOP);
  // (What they've taken today counts against it; tomorrow it's fresh.)
  peddler.rec.oldTaken = { day: game.day, n: 60 };
  assert.equal(room(peddler), 40);
  peddler.rec.oldTaken = { day: game.day - 1, n: 100 };
  assert.equal(room(peddler), 100);
});

test('with no room in your pack, what lies on the ground isn\'t pulled to you', () => {
  const { game, input, p } = start();
  for (let i = 0; i < p.inv.length; i++) p.inv[i] = { item: 'dirt', count: 64 };
  game.spawnDrop('old_coin', 1, p.x + 1, p.y, p.z);
  const d = game.drops[game.drops.length - 1];
  d.pickupDelay = 0;
  const before = { x: d.px, z: d.pz };
  run(game, input, 10);
  assert.ok(!d.dead, 'still lying there');
  assert.ok(Math.hypot(d.px - before.x, d.pz - before.z) < 0.05, 'not drawn toward you');
  // Room again: in it comes.
  p.inv[0] = null;
  run(game, input, 20);
  assert.equal(countItem(p.inv, 'old_coin'), 1);
});

test('the hunt close by gets paths first, even when the budget\'s spent', () => {
  const { game } = start();
  game.pathBudget = 0;
  assert.equal(game.requestPathBudget(), false);
  assert.equal(game.requestPathBudget(true), true, 'an urgent one still goes');
});

test('a wisp outside can\'t lob its light in under a roof', () => {
  const { game, p } = start();
  const y = p.y;
  game.world.setBlock(p.x, y + 3, p.z, B.planks);
  assert.ok(game.roofed(p.x, y, p.z));
  game.world.setBlock(p.x, y + 3, p.z, B.air);
  assert.ok(!game.roofed(p.x, y, p.z));
});

test('no floor gives way under you any more', () => {
  const { game } = start();
  for (const type of ['barrow', 'mine', 'crypt', 'holdout']) {
    const rec = fresh(game, type);
    for (let n = 0; n < rec.depth; n++) assert.equal(blocksOf(buildFloor(rec, n), B.cracked_floor), 0, `${type} floor ${n + 1}`);
  }
});

test('the sentinel drone lights the room without a haze over its own face', () => {
  assert.equal(SPECIES.drone.noHalo, true);
});

// ------------------------------------------------------------ the spire
test('round a spire the land is blighted violet, with strange growths', () => {
  const { game } = start();
  const rec = game.sim.dungeons.all.find((d) => d.type === 'kavorent');
  game.loadAround(rec.x, rec.z, true);
  let blighted = 0;
  let growths = 0;
  for (let dz = -BLIGHT_R; dz <= BLIGHT_R; dz++) {
    for (let dx = -BLIGHT_R; dx <= BLIGHT_R; dx++) {
      for (let y = 1; y < 15; y++) {
        const id = game.world.getBlock(rec.x + dx, y, rec.z + dz);
        if (id === B.grass_void || id === B.leaves_void) blighted++;
        if (id === B.void_bloom || id === B.glow_crystal || id === B.tendril || id === B.eye_stalk) growths++;
      }
    }
  }
  assert.ok(blighted > 20, `blighted ground (${blighted})`);
  assert.ok(growths > 3, `growths (${growths})`);
});

test('near a spire the camera draws back and its song plays; offered a stone, it opens in a scene', () => {
  const { game, input, p } = start();
  const rec = game.sim.dungeons.all.find((d) => d.type === 'kavorent');
  game.loadAround(rec.x, rec.z, true);
  p.teleport(rec.x, game.world.findStandY(rec.x, rec.z + 4, rec.h + 1), rec.z + 4);
  run(game, input, 3);
  assert.ok(game.renderer.zoomGoal > 1.1, `zoomed out (${game.renderer.zoomGoal})`);
  assert.equal(musicMood(game), 'spire');
  assert.ok(THEMES.spire && THEMES.spire_swell && THEMES.spire_open);
  p.inv[0] = { item: 'ruby', count: 1 };
  p.selected = 0;
  game.offerToSpire(rec);
  assert.equal(game.scene.kind, 'spire');
  assert.ok(game.scene.lock, 'you stand and watch');
  assert.notEqual(rec.spire && rec.spire.open, 0, 'not open yet: the door dissolves first');
  playScene(game);
  assert.equal(rec.spire.open, 0, 'open, on the face you stood at');
  assert.equal(musicMood(game), 'spire_open');
});

// ------------------------------------------------------------ Kavorent floors
test('each of a Kavorent ruin\'s floors is lit its own colour, and none so dark as before', () => {
  assert.equal(KAV_FLOORS.length, 6);
  assert.equal(new Set(KAV_FLOORS.map((q) => q.name)).size, 6);
  assert.equal(new Set(KAV_FLOORS.map((q) => q.glow.join(','))).size, 6);
  for (const q of KAV_FLOORS) assert.ok(Math.max(...q.dark) >= 0.14, `${q.name} ambient`);
  assert.ok(Math.max(...DTYPES.kavorent.dark) > 0.11);
  const { game } = start();
  const rec = fresh(game, 'kavorent');
  const d = new DungeonRun(game, rec);
  d.enter();
  assert.equal(d.pal.name, kavFloor(0).name);
  d.changeFloor(1);
  assert.equal(d.pal.name, kavFloor(1).name);
  assert.notEqual(kavFloor(0).name, kavFloor(1).name);
  d.leave();
});

test('Kavorent halls are dressed to overawe: sentinels, monoliths, conduits, vents', () => {
  const { game } = start();
  const rec = fresh(game, 'kavorent');
  const seen = new Set();
  for (let n = 0; n < rec.depth; n++) {
    const f = buildFloor(rec, n);
    for (const k of ['kav_statue', 'kav_monolith', 'kav_holo', 'kav_conduit', 'kav_husk', 'kav_vent']) if (blocksOf(f, B[k])) seen.add(k);
  }
  assert.ok(seen.size >= 5, [...seen].join(' '));
  // (Its master's hall has its ranks of sentinels.)
  const last = buildFloor(rec, rec.depth - 1);
  const br = last.bossRoom;
  let ranks = 0;
  for (const r of last.regions.values()) {
    for (let z = br.z0; z <= br.z1; z++) {
      for (let x = br.x0; x <= br.x1; x++) {
        if (x < r.x0 || x >= r.x0 + 64 || z < r.z0 || z >= r.z0 + 36) continue;
        const id = r.get(x - r.x0, FY, z - r.z0);
        if (id === B.kav_statue || id === B.kav_monolith) ranks++;
      }
    }
  }
  assert.ok(ranks >= 4, `sentinels and monoliths in the hall (${ranks})`);
});

// ------------------------------------------------------------ the masters
test('masters are tougher than their kind, drawn half as big again, in their own colours', () => {
  assert.ok(BOSS_HP > 1 && BOSS_DMG > 1);
  assert.ok(BOSS_SCALE >= 1.5);
  for (const k of ['brood_mother', 'horror', 'overseer']) assert.ok(LEGGED.has(k), `${k} walks on legs`);
  const { game } = start();
  const rec = fresh(game, 'crypt');
  new DungeonRun(game, rec).enter();
  while (game.dungeon.floor < rec.depth - 1) game.dungeon.changeFloor(1);
  const boss = game.creatures.find((c) => c.isBoss);
  const lvl = boss.level;
  assert.equal(boss.maxHp, Math.round(Math.round(boss.S.hp * (1 + 0.3 * (lvl - 1))) * BOSS_HP * (BOSS_HP_EXTRA[boss.species] || 1)));
  assert.ok(Math.abs(boss.dmgMult - (1 + 0.15 * (lvl - 1)) * BOSS_DMG) < 1e-9);
  assert.ok(drawnAsMaster(boss));
  assert.match(bossTint(boss)[0], /^#[0-9a-f]{6}$/);
  // (The Hollow Saint's images look just as she does.)
  assert.ok(drawnAsMaster({ S: SPECIES.saint_shade, species: 'saint_shade', kind: 'monster' }));
  game.dungeon.leave();
});

test('into a master\'s hall: a scene as it wakes (nothing moves till it\'s done); its fall, another', () => {
  const { game, input, p } = start();
  game.cheats = { ...(game.cheats || {}), god: true };
  const rec = fresh(game, 'barrow');
  new DungeonRun(game, rec).enter();
  while (game.dungeon.floor < rec.depth - 1) game.dungeon.changeFloor(1);
  const d = game.dungeon;
  const g = d.data.bossGate;
  p.teleport(g.x + g.ox, FY, g.z + g.oz);
  d.interact(g.x, FY, g.z, BLOCKS[B.boss_gate]);
  p.teleport(g.x - g.ox * 2, FY, g.z - g.oz * 2);
  run(game, input, 2);
  assert.ok(d.fight);
  assert.equal(game.scene && game.scene.kind, 'boss_in');
  assert.ok(game.scene.lock);
  assert.match(musicMood(game), /_boss(:p[1-3])?$/);
  const boss = game.creatures.find((c) => c.isBoss && !c.dead);
  const at = { x: boss.x, z: boss.z };
  run(game, input, 10);
  assert.ok(boss.x === at.x && boss.z === at.z && !boss.windup, 'held still while it plays');
  playScene(game);
  // Its fall.
  for (const c of game.creatures.filter((q) => q.isBoss && !q.dead)) game.kill(c, p);
  assert.equal(game.scene && game.scene.kind, 'boss_down');
  assert.ok(game.scene.ghost && game.scene.ghost.dead, 'still seen a moment, coming apart');
  assert.ok(game.scene.timeScale(0.5) < 0.5, 'the world slowed');
  playScene(game);
  assert.ok(rec.cleared);
  game.dungeon.leave();
});

// ------------------------------------------------------------ what you find below
test('what you find below is lost where you fall, in a pack you can go back for; brought up, it\'s yours', () => {
  const { game, p } = start();
  const rec = fresh(game, 'mine');
  const d = new DungeonRun(game, rec);
  d.enter();
  assert.ok(d.carried, 'what you came down with is noted');
  const brought = holdings(p);
  addItem(p.inv, 'gold_ingot', 3);
  p.equip.head = p.equip.head || 'iron_helmet';
  const found = new Map(d.unbound());
  assert.equal(found.get('gold_ingot'), 3);
  if (!brought.has('iron_helmet')) assert.equal(found.get('iron_helmet'), 1);
  const coins = countItem(p.inv, 'coin');
  const at = { x: p.x, z: p.z };
  game.kill(p, null);
  assert.equal(countItem(p.inv, 'gold_ingot'), brought.get('gold_ingot') || 0, 'the gold is gone from you');
  assert.ok(rec.pack && rec.pack.floor === 0);
  assert.ok(Math.abs(rec.pack.x - at.x) <= 3 && Math.abs(rec.pack.z - at.z) <= 3, 'near where you fell');
  assert.equal(game.world.getBlock(rec.pack.x, FY, rec.pack.z), B.satchel);
  const slots = game.world.getContainer(rec.pack.x, FY, rec.pack.z);
  assert.equal(countItem(slots, 'gold_ingot'), 3);
  if (coins) assert.equal(countItem(slots, 'coin'), Math.ceil(coins / 2));
  // Up and back down: it's still there, waiting.
  game.respawn();
  assert.equal(game.dungeon, null);
  const again = new DungeonRun(game, rec);
  again.enter();
  assert.equal(game.world.getBlock(rec.pack.x, FY, rec.pack.z), B.satchel);
  assert.equal(countItem(game.world.getContainer(rec.pack.x, FY, rec.pack.z), 'gold_ingot'), 3);
  // Take it, and climb out alive: it's yours now.
  addItem(p.inv, 'gold_ingot', 3);
  assert.equal(new Map(again.unbound()).get('gold_ingot'), 3);
  again.leave();
  const third = new DungeonRun(game, rec);
  third.enter();
  assert.equal(third.unbound().length, 0, 'bound to you');
  third.leave();
});

test('deeper down, now and then a chest has teeth; killed, it gives up what it held', () => {
  const { game, p } = start();
  game.cheats = { ...(game.cheats || {}), god: true };
  let rec = null;
  let floor = -1;
  for (const q of game.sim.dungeons.all) {
    if (q.type === 'kavorent') continue;
    for (let n = 1; n < q.depth && !rec; n++) if (buildFloor(q, n).mimics.length) [rec, floor] = [{ ...q, floors: {}, cleared: false }, n];
    if (rec) break;
  }
  assert.ok(rec, 'some floor somewhere has one');
  new DungeonRun(game, rec).enter();
  while (game.dungeon.floor < floor) game.dungeon.changeFloor(1);
  const m = game.dungeon.data.mimics[0];
  assert.equal(game.world.getBlock(m.x, FY, m.z), B.chest);
  const held = game.world.getContainer(m.x, FY, m.z).filter(Boolean).map((q) => ({ ...q }));
  p.teleport(m.x, FY, m.z + 1);
  game.interact(m.x, FY, m.z);
  const c = game.creatures.find((q) => q.species === 'mimic');
  assert.ok(c, 'it wakes');
  assert.equal(game.world.getBlock(m.x, FY, m.z), B.air);
  const before = game.drops.length;
  game.kill(c, p);
  const dropped = game.drops.slice(before).reduce((n, q) => n + q.count, 0);
  // (What it held, and a piece of gear besides: see round 44.)
  assert.equal(dropped, held.reduce((n, q) => n + q.count, 0) + 1);
  game.dungeon.leave();
});

test('spikes in a passage come up in their turn, and hurt whoever stands on them', () => {
  const { game, p } = start();
  let rec = null;
  for (const q of game.sim.dungeons.all) if (q.type !== 'kavorent' && buildFloor(q, 0).spikes.length) rec = rec || { ...q, floors: {}, cleared: false };
  assert.ok(rec);
  const d = new DungeonRun(game, rec);
  d.enter();
  const sp = d.data.spikes[0];
  assert.equal(game.world.getBlock(sp.x, FY, sp.z), B.spikes);
  p.teleport(sp.x, FY, sp.z);
  // Down a while...
  d.t = SPIKE_CYCLE * 10 - sp.phase + 0.2;
  d.spikesTick(0.01);
  assert.equal(game.world.getState(sp.x, FY, sp.z), false);
  const hp = p.hp;
  // ...then up.
  d.t = SPIKE_CYCLE * 10 - sp.phase + SPIKE_CYCLE - 0.5;
  d.spikesTick(0.01);
  assert.equal(game.world.getState(sp.x, FY, sp.z), true);
  assert.ok(p.hp < hp, 'it hurts');
  d.leave();
});

test('an old idol blesses whoever lays a hand on it, once', () => {
  const { game, p } = start();
  let rec = null;
  let floor = -1;
  for (const q of game.sim.dungeons.all) {
    if (q.type === 'kavorent') continue;
    for (let n = 0; n < q.depth && !rec; n++) if (blocksOf(buildFloor(q, n), B.idol)) [rec, floor] = [{ ...q, floors: {}, cleared: false }, n];
    if (rec) break;
  }
  assert.ok(rec);
  const d = new DungeonRun(game, rec);
  d.enter();
  while (d.floor < floor) d.changeFloor(1);
  let at = null;
  for (const r of d.data.regions.values()) {
    for (let i = 0; i < r.blocks.length && !at; i++) {
      if (r.blocks[i] !== B.idol) continue;
      const y = i % 16;
      const col = Math.floor(i / 16);
      at = { x: r.x0 + (col % 64), y, z: r.z0 + Math.floor(col / 64) };
    }
  }
  assert.ok(at && at.y === FY);
  assert.ok(game.world.getMeta(at.x, FY, at.z) & META_STATE, 'lit');
  // (Stood beside it: it's not always in reach of the stairs.)
  const by = [[0, 1], [1, 0], [-1, 0], [0, -1]].find(([dx, dz]) => game.world.getBlock(at.x + dx, FY, at.z + dz) === B.air && game.world.getBlock(at.x + dx, FY + 1, at.z + dz) === B.air);
  if (by) p.teleport(at.x + by[0], FY, at.z + by[1]);
  p.hp = 3;
  const buffs = (p.buffs || []).length;
  game.interact(at.x, FY, at.z);
  assert.ok(p.hp === p.maxHp || (p.buffs || []).length > buffs, 'blessed');
  assert.equal(game.world.getState(at.x, FY, at.z), false, 'its eyes go dark');
  const after = JSON.stringify(p.buffs);
  game.interact(at.x, FY, at.z);
  assert.equal(JSON.stringify(p.buffs), after, 'only once');
  d.leave();
});
