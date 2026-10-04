import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGame, stubInput } from './helpers.mjs';
import { B, BLOCKS } from '../src/world/blocks.js';
import { buildFloor, DTYPES, FY } from '../src/world/dungeongen.js';
import { DungeonRun } from '../src/game/dungeon.js';
import { SPECIES } from '../src/entities/creature.js';
import { blightTick, bossBreach } from '../src/entities/monsters.js';
import { useGadget } from '../src/game/kavtech.js';
import { findPath } from '../src/entities/pathfind.js';
import { ITEMS } from '../src/world/items.js';
import { BLIGHT_R } from '../src/world/sites.js';

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
const fresh = (game, type) => ({ ...game.sim.dungeons.all.find((d) => d.type === type), floors: {}, cleared: false, pack: null });
const blockAt = (f, x, y, z) => {
  const r = f.regions.get((Math.floor(x / 64) + 2000) * 4096 + Math.floor(z / 36));
  return r ? r.get(x % 64, y, z % 36) : 0;
};
// Every room reachable from the way in (gates, seals and fields counting as
// ways through).
function unreached(f) {
  const P = f.plan;
  const pass = (x, z) => {
    if (!P.open[z * P.W + x]) return false;
    const bl = BLOCKS[blockAt(f, x, FY, z)];
    return !bl.solid || ['sealed', 'portcullis', 'boss_gate'].includes(bl.interact) || bl.name === 'weak_wall' || bl.name === 'kav_field';
  };
  const seen = new Uint8Array(P.W * P.D);
  const st = [[f.entry.x - f.x0, f.entry.z]];
  seen[st[0][1] * P.W + st[0][0]] = 1;
  while (st.length) {
    const [x, z] = st.pop();
    for (const [a, c] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + a;
      const nz = z + c;
      const i = nz * P.W + nx;
      if (nx < 0 || nz < 0 || nx >= P.W || nz >= P.D || seen[i] || !pass(nx, nz)) continue;
      seen[i] = 1;
      st.push([nx, nz]);
    }
  }
  return f.rooms.filter((r) => {
    if (r.kit === 'hidden') return false;
    for (let z = r.z0; z <= r.z1; z++) for (let x = r.x0; x <= r.x1; x++) if (P.room[z * P.W + x] === r.id && seen[z * P.W + x]) return false;
    return true;
  });
}
// (Which of its works comes next: the one after this.)
const ORDER = ['fields', 'rush', 'spikes', 'laser'];
const WORK = (k) => (ORDER.indexOf(k) + ORDER.length - 1) % ORDER.length;

// Into the Overseer's hall, its waking scene played out.
function overseerFight(game, p) {
  game.cheats = { ...(game.cheats || {}), god: true };
  const rec = fresh(game, 'kavorent');
  new DungeonRun(game, rec).enter();
  while (game.dungeon.floor < rec.depth - 1) game.dungeon.changeFloor(1);
  const d = game.dungeon;
  const g = d.data.bossGate;
  p.teleport(g.x - g.ox * 3, FY, g.z - g.oz * 3);
  d.bossFight();
  playScene(game);
  const c = game.creatures.find((q) => q.species === 'overseer');
  for (const q of game.creatures) if (q !== c) q.dormant = 99;
  // (Round 30: no sentinels called, and nothing else in the way of its
  // works; worn down far enough to have them all.)
  c.callCd = c.beamCd = c.gridCd = c.sentCd = 999;
  c.hp = Math.floor(c.maxHp * 0.3);
  c.phaseSeen = 3;
  c.gapT = 0;
  return { rec, d, c };
}

// ------------------------------------------------------------ the camera
test('the camera draws back gradually as you near a spire, from well out', () => {
  const { game, p } = start();
  const rec = game.sim.dungeons.all.find((d) => d.type === 'kavorent');
  game.loadAround(rec.x, rec.z, true);
  const at = (dz) => {
    p.teleport(rec.x, game.world.findStandY(rec.x, rec.z + dz, rec.h + 1), rec.z + dz);
    return game.spireNearness(0.016);
  };
  const ks = [BLIGHT_R + 16, BLIGHT_R + 10, BLIGHT_R + 4, BLIGHT_R - 2, 10, 5].map(at);
  assert.equal(ks[0], 0, 'nothing far off');
  for (let i = 1; i < ks.length; i++) assert.ok(ks[i] >= ks[i - 1], `nearer, never less (${ks.join(', ')})`);
  assert.ok(ks[1] > 0 && ks[1] < 0.2, 'it starts out past the blight, gently');
  assert.ok(ks[ks.length - 1] > 0.98, 'all the way, close to');
});

// ------------------------------------------------------------ Kavorent halls
test('a Kavorent ruin\'s rooms come in odd shapes, and every one can still be reached', () => {
  const { game } = start();
  const rec = fresh(game, 'kavorent');
  const shapes = new Set();
  for (let s = 0; s < 3; s++) {
    for (let n = 0; n < rec.depth; n++) {
      const f = buildFloor({ ...rec, seed: rec.seed + s * 101 }, n);
      for (const r of f.rooms) shapes.add(r.shape);
      assert.deepEqual(unreached(f).map((r) => `${r.kit}/${r.shape}`), [], `floor ${n + 1}`);
    }
  }
  const odd = ['diamond', 'star', 'hex', 'wheel', 'crescent', 'teeth', 'wedge', 'zigzag'].filter((k) => shapes.has(k));
  assert.ok(odd.length >= 5, odd.join(' '));
  assert.ok(Object.keys(DTYPES.kavorent.shapes).length >= 10);
});

test('the blight has got into some rooms: veined floor, growths, and what lives there changed', () => {
  const { game } = start();
  const rec = fresh(game, 'kavorent');
  let rooms = 0;
  let infected = 0;
  let veined = 0;
  for (let n = 0; n < rec.depth; n++) {
    const f = buildFloor(rec, n);
    rooms += f.blighted.length;
    infected += f.spawns.filter((s) => s.infected).length;
    for (const r of f.regions.values()) for (let i = 0; i < r.blocks.length; i++) if (r.blocks[i] === B.blight_floor) veined++;
  }
  assert.ok(rooms >= 3, `${rooms} rooms`);
  assert.ok(infected >= rooms, `${infected} changed`);
  assert.ok(veined > 40);
  // (Not in the other kinds of place.)
  for (const type of ['barrow', 'crypt']) assert.equal(buildFloor(fresh(game, type), 1).blighted.length, 0);
  // Made, they're the blight's, and marked so (frailer since round 32).
  const d = new DungeonRun(game, rec);
  d.enter();
  const c = d.spawn('drone', game.player.x + 4, FY, game.player.z, { infected: true });
  assert.ok(c.infected);
  assert.ok(c.maxHp < Math.round(SPECIES.drone.hp * (1 + 0.3 * (c.level - 1))));
  d.leave();
});

test('blighted constructs fight their own way: drones blink, wardens lash and drag, menders feed their kin; all burst into spores', () => {
  const { game, p } = start();
  const rec = fresh(game, 'kavorent');
  const d = new DungeonRun(game, rec);
  d.enter();
  game.cheats = { ...(game.cheats || {}), god: true };
  const spot = (dx, dz) => game.findFreeSpot(p.x + dx, p.z + dz, FY);
  // A drone, a way off: in a flash it's beside you.
  let s = spot(6, 0);
  const drone = d.spawn('drone', s.x, s.y, s.z, { infected: true });
  drone.target = p;
  drone.blightCd = 0;
  game.sim.lineOfSight = () => true;
  assert.ok(blightTick(drone, 0.016));
  assert.ok(Math.max(Math.abs(drone.x - p.x), Math.abs(drone.z - p.z)) <= 2, 'beside you');
  // A warden: a tendril lashed at you.
  s = spot(0, 3);
  const warden = d.spawn('warden', s.x, s.y, s.z, { infected: true });
  warden.target = p;
  warden.blightCd = 0;
  const before = (game.hazards || []).length;
  if (Math.max(Math.abs(warden.x - p.x), Math.abs(warden.z - p.z)) >= 2) {
    assert.ok(blightTick(warden, 0.016));
    assert.ok(game.hazards.length > before, 'a lash');
  }
  // A mender: its hurt kin mended.
  drone.hp = 2;
  s = spot(5, 1);
  const mender = d.spawn('mender', drone.x, FY, drone.z + 1, { infected: true });
  mender.target = p;
  mender.blightCd = 0;
  blightTick(mender, 0.016);
  assert.ok(drone.hp > 2, 'mended');
  // Killed: a cloud of spores.
  const zones = (game.zones || []).length;
  game.kill(drone, p);
  assert.ok(game.zones.length > zones && game.zones.some((z) => z.kind === 'spores'));
  d.leave();
});

test('the Kavorent\'s constructs are lightly built: about half what they were', () => {
  assert.equal(SPECIES.drone.hp, 7);
  assert.equal(SPECIES.warden.hp, 17);
  assert.equal(SPECIES.mender.hp, 4);
  assert.equal(SPECIES.golem.hp, 40);
  assert.equal(SPECIES.mite.hp, 3);
  // (Not its masters.)
  assert.equal(SPECIES.overseer.hp, 320);
});

// ------------------------------------------------------------ the Overseer
test('the Overseer throws up walls of force round you; they stand a while, then fall', () => {
  const { game, input, p } = start();
  const { c } = overseerFight(game, p);
  c.workI = WORK('fields');
  c.workCd = 0;
  run(game, input, 15);
  const fields = (game.bulwarks || []).flatMap((b) => b.put);
  assert.ok(fields.length >= 6, `${fields.length} field blocks`);
  assert.ok(fields.every((q) => game.world.getBlock(q.x, q.y, q.z) === B.kav_field));
  assert.ok(!fields.some((q) => q.x === p.x && q.z === p.z), 'never where you stand');
  c.workCd = 999;
  run(game, input, 100);
  assert.ok(fields.every((q) => game.world.getBlock(q.x, q.y, q.z) !== B.kav_field), 'gone again');
  game.dungeon.leave();
});

test('the Overseer rushes you down a lit lane and slams where it stops', () => {
  const { game, input, p } = start();
  const { c } = overseerFight(game, p);
  // (Put a little way off from you.)
  const s = game.findFreeSpot(p.x + 6, p.z, FY);
  c.teleport(s.x, s.y, s.z);
  game.moveEntity(c, s.x, s.y, s.z);
  c.workI = WORK('rush');
  c.workCd = 0;
  game.sim.lineOfSight = () => true;
  const from = { x: c.x, z: c.z };
  run(game, input, 2);
  assert.equal(c.act && c.act.kind, 'rush');
  run(game, input, 20);
  assert.ok(Math.max(Math.abs(c.x - from.x), Math.abs(c.z - from.z)) >= 3, 'it went');
  assert.ok(!c.act, 'and slammed');
  game.dungeon.leave();
});

test('the Overseer shoots spikes into the floor, then swings them round itself', () => {
  const { game, input, p } = start();
  const { c } = overseerFight(game, p);
  c.workI = WORK('spikes');
  c.workCd = 0;
  run(game, input, 2);
  assert.ok(game.kavSpikes.length >= 8);
  run(game, input, 10);
  assert.ok(game.kavSpikes.every((s) => s.state === 'stuck' || s.state === 'charged'));
  run(game, input, 12);
  assert.ok(game.kavSpikes.every((s) => s.state === 'orbit'));
  const d = Math.hypot(game.kavSpikes[0].x - c.x, game.kavSpikes[0].z - c.z);
  assert.ok(Math.abs(d - 3.3) < 0.6, `round it (${d.toFixed(2)})`);
  run(game, input, 45);
  assert.equal(game.kavSpikes.length, 0, 'called home');
  game.dungeon.leave();
});

test('the Overseer\'s great beam turns slowly onto you and leaves the floor burning', () => {
  const { game, input, p } = start();
  const { c } = overseerFight(game, p);
  game.sim.lineOfSight = () => true;
  c.workI = WORK('laser');
  c.workCd = 0;
  run(game, input, 2);
  assert.equal(game.lasers.length, 1);
  const L = game.lasers[0];
  const a0 = L.ang;
  run(game, input, 25);
  assert.ok(L.fired);
  assert.notEqual(L.ang, a0, 'turning');
  assert.ok(game.zones.some((z) => z.kind === 'fire'), 'the floor alight');
  run(game, input, 60);
  assert.equal(game.lasers.length, 0, 'spent');
  game.dungeon.leave();
});

// ------------------------------------------------------------ walls in its way
test('a master smashes through blocks you\'ve built in its way', () => {
  const { game, p } = start();
  const rec = fresh(game, 'barrow');
  new DungeonRun(game, rec).enter();
  while (game.dungeon.floor < rec.depth - 1) game.dungeon.changeFloor(1);
  const d = game.dungeon;
  const boss = game.creatures.find((c) => c.isBoss);
  boss.target = p;
  // A wall of your own between it and you.
  const s = game.findFreeSpot(boss.x + 3, boss.z, FY);
  p.teleport(s.x, s.y, s.z);
  const wx = boss.x + Math.sign(p.x - boss.x);
  for (const y of [FY, FY + 1]) {
    game.world.setBlock(wx, y, boss.z, B.cobblestone);
    d.notePlaced(wx, y, boss.z);
  }
  boss.breachT = 0;
  assert.ok(bossBreach(boss, 0.016));
  assert.equal(game.world.getBlock(wx, FY, boss.z), B.air);
  assert.equal(d.placed.size, 0);
  // (What the place is built of, it leaves be.)
  game.world.setBlock(wx, FY, boss.z, B.cobblestone);
  boss.breachT = 0;
  assert.equal(bossBreach(boss, 0.016), false);
  d.leave();
});

test('a master\'s way to you runs straight through what you\'ve built, not round it', () => {
  const { game, p } = start();
  const rec = fresh(game, 'barrow');
  const d = new DungeonRun(game, rec);
  d.enter();
  // (Open ground round you, whatever the room's shape: the floor under it,
  // and air over it.)
  for (let dz = -6; dz <= 6; dz++) {
    for (let dx = -1; dx <= 5; dx++) {
      game.world.setBlock(p.x + dx, FY - 1, p.z + dz, B.stone);
      for (const y of [FY, FY + 1, FY + 2]) game.world.setBlock(p.x + dx, y, p.z + dz, B.air);
    }
  }
  const s = game.findFreeSpot(p.x + 4, p.z, FY);
  // A wall of yours, three high, right across the way.
  const wall = [];
  for (let dz = -6; dz <= 6; dz++) {
    for (const y of [FY, FY + 1, FY + 2]) {
      if (game.world.getBlock(p.x + 2, y, p.z + dz) !== B.air) continue;
      game.world.setBlock(p.x + 2, y, p.z + dz, B.cobblestone);
      d.notePlaced(p.x + 2, y, p.z + dz);
      wall.push(1);
    }
  }
  const through = (x, y, z) => d.placed.has(`${x},${y},${z}`) || d.placed.has(`${x},${y + 1},${z}`);
  const path = findPath(game.world, s.x, s.y, s.z, p.x, p.y, p.z, { maxNodes: 2000, near: 1, through });
  assert.ok(path && path.length, 'a way');
  assert.ok(path.some(([x, y, z]) => through(x, y, z)), 'through the wall');
  d.leave();
});

test('what you build below is remembered with the floor', () => {
  const { game, p } = start();
  const rec = { ...game.sim.dungeons.all.find((d) => d.type === 'crypt' && d.depth >= 2), floors: {}, cleared: false, pack: null };
  const d = new DungeonRun(game, rec);
  d.enter();
  const key = `${p.x + 1},${FY},${p.z}`;
  d.notePlaced(p.x + 1, FY, p.z);
  d.changeFloor(1);
  assert.ok(!d.placed.has(key), 'not on the floor below');
  d.changeFloor(-1);
  assert.ok(d.placed.has(key));
  d.leave();
});

// ------------------------------------------------------------ spoils
test('the Overseer leaves two cores, scrap and its Eye; the Prime Golem a core', () => {
  const drops = (k) => Object.fromEntries(SPECIES[k].drops.map(([i, lo, hi, ch]) => [i, [lo, hi, ch]]));
  assert.deepEqual(drops('overseer').kav_scrap, [4, 8, 1]);
  assert.deepEqual(drops('overseer').overseer_eye, [1, 1, 1]);
  assert.deepEqual(drops('prime').kav_core, [1, 1, 1]);
  const { game, p } = start();
  const { c } = overseerFight(game, p);
  for (const n of game.dungeon.data.nodes) if (n.boss) game.world.setState(n.x, FY, n.z, false);
  const before = game.drops.length;
  game.kill(c, p);
  const got = {};
  for (const q of game.drops.slice(before)) got[q.item] = (got[q.item] || 0) + q.count;
  assert.equal(got.kav_core, 2);
  assert.equal(got.overseer_eye, 1);
  assert.ok(got.kav_scrap >= 4 && got.kav_scrap <= 8);
  playScene(game);
  game.dungeon.leave();
});

test('the Overseer\'s Eye pours out its beam where you point, then must gather itself', () => {
  const { game, input, p } = start();
  const def = ITEMS.overseer_eye;
  assert.equal(def.kind, 'gadget');
  assert.ok(def.charge >= 20);
  const rec = fresh(game, 'kavorent');
  const d = new DungeonRun(game, rec);
  d.enter();
  for (const c of game.creatures) c.dormant = 99;
  // Something hostile in front of you.
  const s = game.findFreeSpot(p.x + 3, p.z, FY);
  const foe = d.spawn('mender', s.x, s.y, s.z);
  foe.dormant = 99;
  game.aimAngle = () => Math.atan2(foe.z - p.z, foe.x - p.x);
  useGadget(game, def);
  assert.equal(game.lasers.length, 1);
  assert.equal(game.lasers[0].by, p);
  const hp = foe.hp;
  run(game, input, 20);
  assert.ok(foe.hp < hp || foe.dead, 'burned');
  // (Gathering itself: used again, nothing.)
  run(game, input, 40);
  const n = game.lasers.length;
  useGadget(game, def);
  assert.equal(game.lasers.length, n);
  d.leave();
});
