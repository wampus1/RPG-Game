// Round 109: the Drowned Broch made over. Its tiles and things drawn
// afresh; its floors laid out by its own architect (the court and its
// scarcement ledge, the wheelhouse and its bays, the gallery climbing in
// the wall, the drowned stair going down into the water, the wreckers' den
// and its strongroom, the beacon on its dais, the boat-noust) beside its
// old rooms, every one walkable, ledges, steps and water too; what's
// written there made from the broch's own story and its town's; its new
// creatures drawn and at work (the trowie that shrinks from a lit lamp and
// runs off to its cell with your coin, the lantern-bearer that quickens the
// drowned, the fulmar's oil that catches fire); the gale through the
// slits; the lamps; the beacon fed with fish-oil; the false lights the
// drowned rise to; the strongroom and its key; the wall-cells; the seals
// that give you away; and its two masters painted by hand.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGame, stubInput } from './helpers.mjs';
import { DungeonRun } from '../src/game/dungeon.js';
import { buildFloor, FY } from '../src/world/dungeongen.js';
import { BLOCKS, B } from '../src/world/blocks.js';
import { ITEMS } from '../src/world/items.js';
import { SPECIES } from '../src/entities/creature.js';
import { BROCH_SPECIES } from '../src/entities/brochmobs.js';
import { BROCH_MOBS } from '../src/render/art/broch_mobs.js';
import { BROCH_SPRITES, brochTop, brochFront } from '../src/render/art/broch_tex.js';
import { brochLore, FAULTS } from '../src/world/deeps/brochlore.js';
import { BROCH_OWN } from '../src/world/deeps/broch.js';
import { bcT, restore, gust, GUST_PUSH } from '../src/game/brochwork.js';
import { addItem, countItem } from '../src/game/inventory.js';
import { GAME_VERSION, compareVersions } from '../src/version.js';
import { stepsFor } from '../src/game/migrate.js';
import { BROCH_BOSS_ART } from '../src/render/art/broch_bosses.js';
import { FORGE } from '../src/render/forge.js';
import '../src/render/bossbody.js';

const rec = (s) => ({ id: `b${s}`, type: 'broch', isle: 'skerries', seed: 1000 + s * 31, depth: 3, level: 2, vaultFloor: 1, origin: { who: 'the Beacon-Keeper Erling', y: 1201 }, townName: 'Quillcross' });
const at = (f, x, y, z) => {
  const r = f.regions.get(Math.floor(x / 64) * 4096 + Math.floor(z / 36));
  return r ? r.get(x % 64, y, z % 36) : 0;
};
const PASS = new Set(['sealed', 'portcullis', 'boss_gate']);
// Every tile you can walk to from the way in: a step up or down at a time,
// or swum (deep water). (Things set on the floor aren't tiles to walk to.)
function reach(f) {
  const P = f.plan;
  const solid = (x, y, z) => {
    const b = BLOCKS[at(f, f.x0 + x, y, z)];
    return !!(b && b.solid && !PASS.has(b.interact));
  };
  const prop = (x, y, z) => (BLOCKS[at(f, f.x0 + x, y, z)] || {}).render === 'sprite';
  const stand = (x, z) => {
    if (!P.open[z * P.W + x]) return null;
    for (const y of [FY - 1, FY, FY + 1, FY + 2]) if ((y === FY - 1 ? !solid(x, FY - 1, z) && solid(x, FY - 2, z) : (solid(x, y - 1, z) && !prop(x, y - 1, z)) || y === FY) && !solid(x, y, z) && !solid(x, y + 1, z)) return y;
    if (at(f, f.x0 + x, FY - 1, z) === B.water && at(f, f.x0 + x, FY - 2, z) === B.water) return FY - 1;
    return null;
  };
  const seen = new Map();
  const e = [f.entry.x - f.x0, f.entry.z];
  seen.set(e[1] * P.W + e[0], stand(e[0], e[1]));
  const st = [e];
  while (st.length) {
    const [x, z] = st.pop();
    const h = seen.get(z * P.W + x);
    for (const [a, c] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + a;
      const nz = z + c;
      const i = nz * P.W + nx;
      if (nx < 0 || nz < 0 || nx >= P.W || nz >= P.D || seen.has(i)) continue;
      const h2 = stand(nx, nz);
      if (h2 === null || h2 - h > 1) continue;
      seen.set(i, h2);
      st.push([nx, nz]);
    }
  }
  let miss = 0;
  for (const r of f.rooms) {
    if (r.kit === 'hidden') continue;
    for (let z = r.z0; z <= r.z1; z++) {
      for (let x = r.x0; x <= r.x1; x++) {
        if (P.room[z * P.W + x] !== r.id) continue;
        const h = stand(x, z);
        if (h === null) continue;
        // (Its scarcement and its gallery's rise, up their steps; not the
        // tops of the wheelhouse's piers.)
        if (h === FY + 2 && at(f, f.x0 + x, FY + 1, z) !== B.bc_ledge) continue;
        if (!seen.has(z * P.W + x)) miss++;
      }
    }
  }
  return miss;
}

test('every floor of a Drowned Broch can be walked, up onto its ledges and down into its water', () => {
  for (let s = 0; s < 6; s++) for (let n = 0; n < 3; n++) assert.equal(reach(buildFloor(rec(s), n)), 0, `seed ${s} floor ${n}`);
});

test('a floor of a Drowned Broch is laid out as one: its beacon and oil, its strongroom and key, its slits, cells, lamps, pools and false lights', () => {
  const kits = new Set();
  const n0 = { beacons: 0, keeperkists: 0, strongrooms: 0, casks: 0, cells: 0, slits: 0, pools: 0, lamps: 0, falselights: 0 };
  const sp = {};
  let ledges = 0;
  for (let s = 0; s < 6; s++) {
    for (let n = 0; n < 3; n++) {
      const f = buildFloor(rec(s), n);
      for (const r of f.rooms) kits.add(r.kit);
      for (const q of f.beacons || []) assert.equal(at(f, q.x, FY + 1, q.z), B.bc_beacon);
      if ((f.beacons || []).length) assert.ok((f.casks || []).length > 0, 'oil for the beacon on its floor');
      for (const q of f.keeperkists || []) assert.equal(at(f, q.x, FY, q.z), B.bc_keeperkist);
      for (const q of f.strongrooms || []) {
        assert.equal(at(f, q.x, FY, q.z), B.bc_bardoor);
        assert.ok(f.spawns.some((x) => x.key === 'wreckers_key'), 'someone carries the key');
      }
      for (const q of f.casks || []) assert.equal(at(f, q.x, FY, q.z), B.bc_oilcask);
      for (const q of f.cells || []) assert.equal(at(f, q.x, FY, q.z), B.bc_cell);
      for (const q of f.slits || []) {
        assert.ok(q.tiles.length > 0);
        if (!q.along) assert.equal(at(f, q.x, FY, q.z), B.bc_slit);
      }
      for (const g of f.pools || []) for (const t of g.tiles) assert.equal(at(f, t.x, FY - 1, t.z), B.water);
      for (const q of f.lamps || []) assert.equal(at(f, q.x, FY, q.z), B.bc_lamp);
      for (const q of f.falselights || []) assert.equal(at(f, q.x, FY, q.z), B.bc_falselight);
      for (const k of Object.keys(n0)) n0[k] += (f[k] || []).length;
      for (const q of f.spawns) sp[q.species] = (sp[q.species] || 0) + 1;
      for (let z = 0; z < f.plan.D; z++) for (let x = 0; x < f.plan.W; x++) if (at(f, f.x0 + x, FY + 1, z) === B.bc_ledge) ledges++;
    }
  }
  for (const k of BROCH_OWN) assert.ok(kits.has(k), `the ${k}`);
  for (const [k, v] of Object.entries(n0)) assert.ok(v > 3, `${k}: ${v}`);
  assert.ok(ledges > 30, `ledges: ${ledges}`);
  for (const k of ['trowie', 'lantern_bearer', 'fulmar', 'seal', 'drowned', 'wrecker']) assert.ok(sp[k] > 2, `${k}: ${sp[k]}`);
});

test('what\'s written in a Drowned Broch is its own story and its town\'s, and the same each time', () => {
  const a = brochLore(rec(1), 0, 'beacon_keeper');
  const b = brochLore(rec(1), 0, 'beacon_keeper');
  for (const k of ['log', 'rules', 'tally', 'letter', 'ballad', 'kist', 'bunk', 'drowned', 'figurehead', 'story', 'last']) {
    const t = a[k]();
    assert.deepEqual(t, b[k](), k);
    assert.ok(t.title && t.lines.length >= 1 && t.lines.every((l) => typeof l === 'string' && l.length > 3), k);
  }
  for (const kind of [0, 1]) assert.ok(a.symbol(kind).lines[0].length > 10);
  assert.ok(a.log().title.includes(a.keeper) && /oil/.test(a.log().lines.join(' ')), 'the log tells where the oil is');
  assert.ok(a.letter().lines.join(' ').includes(a.ship), 'the ship by name');
  assert.ok(a.story().lines.includes(FAULTS[a.fault].why), 'what went wrong');
  assert.ok(a.last().title.includes('Beacon-Keeper'));
  const titles = new Set();
  for (let s = 1; s <= 4; s++) for (let n = 0; n < 3; n++) for (const l of buildFloor(rec(s), n).lore) titles.add(l.title);
  for (const t of ['Notice, by the Door', 'A Symbol Stone', 'A Drowned Sailor', 'In a Sea-Kist', 'A Tally, in Charcoal']) assert.ok(titles.has(t), t);
});

test('the Drowned Broch\'s tiles and things are drawn; its new creatures are in the game and drawn; its oil and key are things', () => {
  for (const n of ['bc_flagstone', 'bc_flags', 'bc_wet', 'bc_slate', 'bc_shingle', 'bc_hearth', 'bc_planks', 'bc_ledge', 'bc_step']) assert.ok(brochTop(n, 0), `${n} top`);
  for (const n of ['bc_flagstone', 'bc_wrackwall', 'bc_patch', 'bc_slit', 'bc_cell', 'bc_symbol', 'bc_lampniche', 'bc_bardoor', 'bc_ledge', 'bc_step', 'bc_wet']) assert.ok(brochFront(n, 0), `${n} front`);
  for (const [k, fn] of Object.entries(BROCH_SPRITES)) {
    assert.ok(BLOCKS[B[k]], `${k} is a block`);
    for (const st of [false, true]) assert.ok(fn(0, st, 0), `${k} drawn`);
  }
  for (const sp of Object.keys(BROCH_SPECIES)) {
    assert.ok(SPECIES[sp], `${sp} is a species`);
    assert.ok(BROCH_MOBS[sp] && BROCH_MOBS[sp].rows.length === 24, `${sp} is drawn`);
  }
  assert.ok(ITEMS.fish_oil && ITEMS.wreckers_key);
});

// ------------------------------------------------------- in the broch
function inBroch() {
  const game = makeGame(12345);
  const input = stubInput();
  game.minute = 600;
  for (let i = 0; i < 20; i++) game.update(0.1, input);
  const base = game.sim.dungeons.all.find((q) => q.type === 'crypt');
  const r = { ...base, type: 'broch', isle: 'skerries', floors: {}, cleared: false, pack: null, weakened: 0 };
  new DungeonRun(game, r).enter();
  const d = game.dungeon;
  for (const c of game.creatures) {
    c.dead = true;
    game.removeOcc(c);
  }
  game.creatures = [];
  game.cheats = { ...(game.cheats || {}), god: false };
  for (const k of ['beacons', 'keeperkists', 'strongrooms', 'casks', 'cells', 'slits', 'pools', 'lamps', 'falselights']) d.data[k] = [];
  // A clear hall, 15 by 8, about the way in, its flagstone wall north of it.
  const e = d.data.rooms.find((q) => q.kit === 'entry');
  const x0 = d.data.x0 + e.cx - 7;
  const z0 = e.cz - 2;
  for (let z = z0 - 2; z <= z0 + 5; z++) {
    for (let x = x0 - 1; x <= x0 + 15; x++) {
      for (const y of [FY, FY + 1, FY + 2]) game.world.setBlock(x, y, z, B.air);
      game.world.setBlock(x, FY - 1, z, B.bc_flags);
      game.world.setBlock(x, FY - 2, z, B.bc_flagstone);
    }
  }
  for (let x = x0 - 1; x <= x0 + 15; x++) for (const y of [FY, FY + 1]) game.world.setBlock(x, y, z0 - 3, B.bc_flagstone);
  const p = game.player;
  p.teleport(x0, FY, z0 + 4);
  p.hp = p.maxHp = 200;
  d.brochT = null;
  return { game, input, d, p, x0, z0 };
}
const run = (game, input, secs) => {
  for (let t = 0; t < secs; t += 0.05) game.update(0.05, input);
};

test('a gust in at a slit knocks you down its line, off the ledge if you\'re on it, and blows out the lamps it passes', () => {
  const { game, d, p, x0, z0 } = inBroch();
  const sx = x0 + 6;
  for (const y of [FY, FY + 1]) game.world.setBlock(sx, y, z0 - 3, B.bc_slit);
  const tiles = [];
  for (let z = z0 - 2; z <= z0 + 5; z++) tiles.push({ x: sx, z });
  const s = { x: sx, z: z0 - 3, dir: { x: 0, z: 1 }, tiles, room: 0 };
  d.data.slits = [s];
  const lamp = { x: sx + 1, z: z0 + 2 };
  game.world.setBlock(lamp.x, FY, lamp.z, B.bc_lamp);
  game.world.setState(lamp.x, FY, lamp.z, true);
  d.data.lamps = [lamp];
  // On the floor: knocked along.
  p.teleport(sx, FY, z0);
  gust(d, s);
  assert.equal(p.z, z0 + GUST_PUSH, 'knocked along');
  assert.ok(!game.world.getState(lamp.x, FY, lamp.z), 'the lamp blown out');
  // On the ledge: knocked off it, and hurt.
  for (const y of [FY, FY + 1]) game.world.setBlock(sx, y, z0 - 2, B.bc_ledge);
  p.teleport(sx, FY + 2, z0 - 2);
  const hp = p.hp;
  gust(d, s);
  assert.equal(p.y, FY, 'down on the floor');
  assert.ok(p.hp < hp, 'hurt by the fall');
  // A lamp lit again by hand.
  d.interact(lamp.x, FY, lamp.z, BLOCKS[B.bc_lamp]);
  assert.ok(game.world.getState(lamp.x, FY, lamp.z));
  game.world.setState(lamp.x, FY, lamp.z, false);
  restore(d);
  assert.ok(game.world.getState(lamp.x, FY, lamp.z), 'stays lit');
});

test('the gale comes on its own, with a whistle before it', () => {
  const { game, input, d, p, x0, z0 } = inBroch();
  const sx = x0 + 6;
  const tiles = [];
  for (let z = z0 - 2; z <= z0 + 5; z++) tiles.push({ x: sx, z });
  d.data.slits = [{ x: sx, z: z0 - 3, dir: { x: 0, z: 1 }, tiles, room: 0 }];
  p.teleport(sx, FY, z0 - 1);
  run(game, input, 12);
  assert.ok(p.z > z0 - 1, 'knocked along by it');
});

test('fish-oil from a cask feeds the beacon: lit, the false lights die, the drowned shrink back, the keeper\'s kist comes open', () => {
  const { game, d, p, x0, z0 } = inBroch();
  const cask = { x: x0 + 2, z: z0 + 1 };
  game.world.setBlock(cask.x, FY, cask.z, B.bc_oilcask);
  d.data.casks = [cask];
  const bq = { x: x0 + 8, z: z0 - 1 };
  game.world.setBlock(bq.x, FY, bq.z, B.bc_step);
  game.world.setBlock(bq.x, FY + 1, bq.z, B.bc_beacon);
  d.data.beacons = [bq];
  const kq = { x: x0 + 10, z: z0 - 1 };
  game.world.setBlock(kq.x, FY, kq.z, B.bc_keeperkist);
  d.data.keeperkists = [kq];
  const fl = { x: x0 + 13, z: z0 + 3 };
  game.world.setBlock(fl.x, FY, fl.z, B.bc_falselight);
  game.world.setState(fl.x, FY, fl.z, true);
  d.data.falselights = [fl];
  const dr = d.spawn('drowned', x0 + 8, FY, z0 + 2, {});
  dr.dormant = 0;
  // Cold, without oil.
  d.interact(bq.x, FY + 1, bq.z, BLOCKS[B.bc_beacon]);
  assert.ok(!game.world.getState(bq.x, FY + 1, bq.z));
  d.interact(kq.x, FY, kq.z, BLOCKS[B.bc_keeperkist]);
  assert.equal(game.world.getBlock(kq.x, FY, kq.z), B.bc_keeperkist, 'locked');
  // A jar from the cask; the cask's dry after.
  d.interact(cask.x, FY, cask.z, BLOCKS[B.bc_oilcask]);
  assert.equal(countItem(p.inv, 'fish_oil'), 1);
  d.interact(cask.x, FY, cask.z, BLOCKS[B.bc_oilcask]);
  assert.equal(countItem(p.inv, 'fish_oil'), 1, 'one jar a cask');
  const hp = dr.hp;
  d.interact(bq.x, FY + 1, bq.z, BLOCKS[B.bc_beacon]);
  assert.ok(game.world.getState(bq.x, FY + 1, bq.z), 'lit');
  assert.equal(countItem(p.inv, 'fish_oil'), 0, 'the oil used');
  assert.ok(!game.world.getState(fl.x, FY, fl.z), 'the false light dead');
  assert.ok(dr.hp < hp && dr.lostT > 0, 'the drowned shrink back');
  assert.equal(game.world.getBlock(kq.x, FY, kq.z), B.chest, 'the kist open');
  game.world.setState(bq.x, FY + 1, bq.z, false);
  game.world.setBlock(kq.x, FY, kq.z, B.bc_keeperkist);
  restore(d);
  assert.ok(game.world.getState(bq.x, FY + 1, bq.z), 'still lit');
  assert.equal(game.world.getBlock(kq.x, FY, kq.z), B.chest);
});

test('while a false light burns the drowned rise up out of the water to it; smashed, it stops', () => {
  const { game, input, d, p, x0, z0 } = inBroch();
  const pool = [];
  for (let x = x0 + 9; x <= x0 + 12; x++) {
    game.world.setBlock(x, FY - 1, z0 + 4, B.water);
    game.world.setBlock(x, FY - 2, z0 + 4, B.bc_shingle);
    pool.push({ x, z: z0 + 4 });
  }
  d.data.pools = [{ tiles: pool, room: 0 }];
  const fl = { x: x0 + 10, z: z0 + 2 };
  game.world.setBlock(fl.x, FY, fl.z, B.bc_falselight);
  game.world.setState(fl.x, FY, fl.z, true);
  d.data.falselights = [fl];
  p.teleport(x0 + 4, FY, z0 + 1);
  const T = bcT(d);
  T.rise.set(`f${fl.x},${fl.z}`, 0.01);
  run(game, input, 0.2);
  const risen = game.creatures.filter((c) => c.species === 'drowned' && !c.dead);
  assert.ok(risen.length >= 1, 'one up out of the water');
  assert.ok(pool.some((t) => t.x === risen[0].x && t.z === risen[0].z), 'from the water');
  d.interact(fl.x, FY, fl.z, BLOCKS[B.bc_falselight]);
  assert.ok(!game.world.getState(fl.x, FY, fl.z), 'smashed');
  for (const c of game.creatures) c.dead = true;
  T.rise.set(`f${fl.x},${fl.z}`, 0.01);
  run(game, input, 0.2);
  assert.equal(game.creatures.filter((c) => c.species === 'drowned' && !c.dead).length, 0, 'no more');
});

test('the lantern-bearer keeps out of reach and quickens the drowned by him', () => {
  const { game, input, d, p, x0, z0 } = inBroch();
  const lb = d.spawn('lantern_bearer', x0 + 6, FY, z0 + 2, {});
  lb.dormant = 0;
  const dr = d.spawn('drowned', x0 + 8, FY, z0 + 2, {});
  dr.dormant = 0;
  p.teleport(x0 + 4, FY, z0 + 2);
  run(game, input, 2);
  assert.ok(Math.max(Math.abs(lb.x - p.x), Math.abs(lb.z - p.z)) >= 2, 'out of reach');
  assert.ok(dr.hasteT > 0, 'the drowned quickened');
});

test('the strongroom: barred and padlocked till you\'ve the key off the wrecker that carries it', () => {
  const { game, input, d, p, x0, z0 } = inBroch();
  const door = { x: x0 + 7, z: z0 - 3 };
  for (const y of [FY, FY + 1]) game.world.setBlock(door.x, y, door.z, B.bc_bardoor);
  d.data.strongrooms = [{ ...door, room: 0 }];
  d.interact(door.x, FY, door.z, BLOCKS[B.bc_bardoor]);
  assert.equal(game.world.getBlock(door.x, FY, door.z), B.bc_bardoor, 'locked');
  const w = d.spawn('wrecker', x0 + 9, FY, z0 + 2, { key: 'wreckers_key' });
  // (Struck till it's down: a wrecker will turn a blow now and then.)
  for (let k = 0; k < 20 && !w.dead; k++) game.damage(w, 999, p);
  assert.ok(w.dead);
  run(game, input, 0.1);
  const drop = game.drops.find((q) => q.item === 'wreckers_key');
  assert.ok(drop || countItem(p.inv, 'wreckers_key') > 0, 'dropped the key');
  if (!countItem(p.inv, 'wreckers_key')) addItem(p.inv, 'wreckers_key', 1);
  d.interact(door.x, FY, door.z, BLOCKS[B.bc_bardoor]);
  assert.equal(game.world.getBlock(door.x, FY, door.z), B.air, 'open');
  assert.equal(countItem(p.inv, 'wreckers_key'), 0);
  for (const y of [FY, FY + 1]) game.world.setBlock(door.x, y, door.z, B.bc_bardoor);
  restore(d);
  assert.equal(game.world.getBlock(door.x, FY, door.z), B.air, 'still open');
});

test('a trowie won\'t come near you by a lit lamp; in the dark it bites, takes your coin to its cell and into the wall, where you can get it back', () => {
  const { game, input, d, p, x0, z0 } = inBroch();
  const cellQ = { x: x0 + 12, z: z0 - 3, loot: [['old_coin', 2]], trow: false, room: 0 };
  for (const y of [FY, FY + 1]) game.world.setBlock(cellQ.x, y, cellQ.z, B.bc_cell);
  d.data.cells = [cellQ];
  const lamp = { x: x0 + 3, z: z0 + 1 };
  game.world.setBlock(lamp.x, FY, lamp.z, B.bc_lamp);
  game.world.setState(lamp.x, FY, lamp.z, true);
  d.data.lamps = [lamp];
  addItem(p.inv, 'coin', 20);
  const coins = countItem(p.inv, 'coin');
  p.teleport(x0 + 3, FY, z0 + 2);
  const t = d.spawn('trowie', x0 + 8, FY, z0 + 2, {});
  t.dormant = 0;
  run(game, input, 3);
  assert.equal(countItem(p.inv, 'coin'), coins, 'it kept off');
  assert.ok(Math.max(Math.abs(t.x - p.x), Math.abs(t.z - p.z)) >= 2);
  // The lamp out: it comes.
  game.world.setState(lamp.x, FY, lamp.z, false);
  let took = false;
  for (let k = 0; k < 200 && !took; k++) {
    game.update(0.05, input);
    if (countItem(p.inv, 'coin') < coins) took = true;
  }
  assert.ok(took, 'coin snatched');
  p.teleport(x0, FY, z0 + 5);
  for (let k = 0; k < 300 && !t.dead; k++) game.update(0.05, input);
  assert.ok(t.dead, 'into the wall');
  assert.ok(d.state.broch.hoard[`${cellQ.x},${cellQ.z}`] > 0, 'in its hoard');
  const before = countItem(p.inv, 'coin');
  d.interact(cellQ.x, FY, cellQ.z, BLOCKS[B.bc_cell]);
  assert.ok(countItem(p.inv, 'coin') > before, 'got back');
  assert.ok(countItem(p.inv, 'old_coin') >= 2, 'and the hoard\'s own');
});

test('a wall-cell with a trowie in it bites the hand that\'s put in it, once', () => {
  const { game, d, p, x0, z0 } = inBroch();
  const q = { x: x0 + 4, z: z0 - 3, loot: [['gem', 1]], trow: true, room: 0 };
  for (const y of [FY, FY + 1]) game.world.setBlock(q.x, y, q.z, B.bc_cell);
  d.data.cells = [q];
  const hp = p.hp;
  d.interact(q.x, FY, q.z, BLOCKS[B.bc_cell]);
  assert.ok(p.hp < hp, 'bitten');
  assert.ok(game.creatures.some((c) => c.species === 'trowie' && !c.dead), 'out it comes');
  d.interact(q.x, FY, q.z, BLOCKS[B.bc_cell]);
  assert.equal(countItem(p.inv, 'gem'), 1, 'and what was in it');
});

test('a fulmar spits its oil at you when you come by its nest; oiled, the first fire you come near sets you alight', () => {
  const { game, input, d, p, x0, z0 } = inBroch();
  const f = d.spawn('fulmar', x0 + 6, FY, z0 + 1, { peaceful: true });
  f.dormant = 0;
  p.teleport(x0 + 7, FY, z0 + 2);
  run(game, input, 0.5);
  assert.ok(p.oiledT > 0, 'oiled');
  const lamp = { x: x0 + 10, z: z0 + 3 };
  game.world.setBlock(lamp.x, FY, lamp.z, B.bc_lamp);
  game.world.setState(lamp.x, FY, lamp.z, true);
  d.data.lamps = [lamp];
  p.teleport(x0 + 11, FY, z0 + 3);
  run(game, input, 0.2);
  assert.ok(p.burnT > 0, 'alight');
  assert.ok(!(p.oiledT > 0), 'the oil burnt off');
});

test('a seal that sees you barks, and the drowned in the shallows wake', () => {
  const { game, input, d, p, x0, z0 } = inBroch();
  d.spawn('seal', x0 + 8, FY, z0 + 2, { peaceful: true }).dormant = 0;
  const dr = d.spawn('drowned', x0 + 12, FY, z0 + 2, { dormant: 2 });
  assert.ok(dr.dormant);
  p.teleport(x0 + 6, FY, z0 + 2);
  run(game, input, 0.3);
  assert.ok(!dr.dormant && dr.target === p, 'woken');
});

test('the version and its step', () => {
  assert.ok(compareVersions(GAME_VERSION, '1.9.0') >= 0);
  assert.ok(stepsFor('1.8.0').some((s) => s.to === '1.9.0'));
});

test('the Drowned Broch\'s masters are painted by hand, every part in place', () => {
  assert.deepEqual(Object.keys(BROCH_BOSS_ART).sort(), ['beacon_keeper', 'sea_trow']);
  for (const [k, A] of Object.entries(BROCH_BOSS_ART)) {
    assert.ok(SPECIES[k], `${k} is a species`);
    assert.ok(FORGE[k] && FORGE[k].pix, `${k} is painted`);
    assert.equal(A.size, 64);
    assert.equal(A.body.rows.length, 64, `${k} has a body`);
    for (const [n, q] of Object.entries(A.parts)) assert.ok(q.pix && q.pix.rows.length, `${k}.${n} has a picture`);
  }
  assert.ok(BROCH_BOSS_ART.beacon_keeper.parts.blade, 'his lantern on its pole');
  assert.ok(BROCH_BOSS_ART.sea_trow.parts.blade, 'its anchor');
});
