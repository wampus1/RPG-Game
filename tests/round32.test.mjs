import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGame, stubInput } from './helpers.mjs';
import { B } from '../src/world/blocks.js';
import { DungeonRun, INFECTED_HP } from '../src/game/dungeon.js';
import { FY } from '../src/world/dungeongen.js';
import { shielded } from '../src/entities/monsters.js';
import { PRESS } from '../src/entities/tempo.js';
import { FIELD_OFF, lowerFields } from '../src/entities/fields.js';
import { RNG } from '../src/util/rng.js';
import { GROUND } from '../src/config.js';

function start(seed = 12345, minute = 10 * 60) {
  const game = makeGame(seed);
  const input = stubInput();
  game.minute = minute;
  for (let i = 0; i < 20; i++) game.update(0.1, input);
  game.cheats = { ...(game.cheats || {}), god: true };
  return { game, input, p: game.player };
}
const run = (game, input, n, dt = 0.05) => {
  for (let i = 0; i < n; i++) game.update(dt, input);
};
const fresh = (game, type) => ({ ...game.sim.dungeons.all.find((d) => d.type === type), floors: {}, cleared: false, pack: null });
const TYPE = { barrow_king: 'barrow', mound_witch: 'barrow', worm: 'mine', foreman: 'mine', brood_mother: 'mine', priest: 'crypt', horror: 'crypt', hollow_saint: 'crypt', warlord: 'holdout', twins: 'holdout', poisoner: 'holdout', overseer: 'kavorent', prime: 'kavorent' };

// Into a holdout with nothing in it but you (and what's put there).
function holdout(game) {
  new DungeonRun(game, fresh(game, 'holdout')).enter();
  for (const c of game.creatures) {
    c.dead = true;
    game.removeOcc(c);
  }
  game.creatures = [];
  return game.dungeon;
}

// Into the hall of a master of the kind given, the fight begun, you a few
// paces off.
function fight(game, p, species) {
  const rec = fresh(game, TYPE[species]);
  new DungeonRun(game, rec).enter();
  while (game.dungeon.floor < rec.depth - 1) game.dungeon.changeFloor(1);
  const d = game.dungeon;
  d.metBoss = true;
  const br = d.data.bossRoom;
  for (const c of game.creatures) {
    if (c.isBoss || c.leash) {
      c.dead = true;
      game.removeOcc(c);
    }
  }
  game.creatures = game.creatures.filter((c) => !c.dead);
  const cx = Math.round((br.x0 + br.x1) / 2);
  const cz = Math.round((br.z0 + br.z1) / 2);
  const c = d.spawn(species, cx, FY, cz, { boss: true });
  c.leash = br;
  for (const q of game.creatures) if (!q.isBoss) q.dormant = 999;
  const s = game.findFreeSpot(cx, cz + 4, FY);
  p.teleport(s.x, s.y, s.z);
  d.bossFight();
  game.scene = null;
  return { d, c, br };
}

// You and a foe side by side (it held where it stands, and hard to kill).
function squareUp(game, p) {
  const d = holdout(game);
  // (Backed against a wall if it can be, so a blow can't knock it out of
  // reach.)
  // (Looked for all round where you came in, nearest first.)
  const around = [];
  for (let a = -12; a <= 12; a += 2) for (let b = -12; b <= 12; b += 2) around.push([a, b]);
  around.sort((m, n) => Math.hypot(...m) - Math.hypot(...n));
  for (const pinned of [true, false]) for (const [a, b] of around) {
    const s = game.findFreeSpot(p.x + a, p.z + b, FY);
    if (!s) continue;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const x = s.x + dx;
      const z = s.z + dz;
      if (!game.world.canStand(x, s.y, z) || game.occupiedAny(x, s.y, z)) continue;
      // (Pinned: nowhere a blow could knock it to, by the same rule a
      // knock-back goes by.)
      if (pinned && game.world.stepTarget(x, s.y, z, x + dx, z + dz, false) >= 0) continue;
      p.teleport(s.x, s.y, s.z);
      const foe = d.spawn('skeleton', x, s.y, z, {});
      foe.maxHp = foe.hp = 999;
      foe.dormant = 999;
      return foe;
    }
  }
  return null;
}

// ------------------------------------------------------------ combat
test('clicked again mid-swing: the next blow is lined up and follows straight on, with the breath for it', () => {
  const { game, input, p } = start();
  const foe = squareUp(game, p);
  assert.ok(foe);
  p.inv[0] = { item: 'iron_sword', count: 1 };
  p.selected = 0;
  p.stamina = 10;
  game.attack(foe);
  assert.ok(p.swing, 'the first blow comes round');
  const after1 = p.stamina;
  game.attack(foe);
  assert.ok(game.queuedBlow, 'the second is lined up');
  // (One at a time.)
  const q = game.queuedBlow;
  game.attack(foe);
  assert.equal(game.queuedBlow, q);
  let t = 0;
  while (game.queuedBlow && t < 3) {
    foe.dormant = 999;
    game.update(0.05, input);
    t += 0.05;
  }
  assert.ok(!game.queuedBlow, 'thrown');
  assert.equal(p.combo, 2, 'a combo');
  assert.ok(p.stamina < after1, 'it cost its breath');
  // Sooner than waiting the blow out and clicking again.
  const def = p.heldDef();
  assert.ok(t < (def.cooldown || 0.4) + 0.5, `followed on in ${t.toFixed(2)}s`);
});

test('too winded for it: nothing is lined up', () => {
  const { game, p } = start();
  const foe = squareUp(game, p);
  p.inv[0] = { item: 'iron_sword', count: 1 };
  p.selected = 0;
  p.stamina = 10;
  game.attack(foe);
  p.stamina = 0;
  game.attack(foe);
  assert.ok(!game.queuedBlow);
  // (Swinging at the air, as much.)
  p.stamina = 10;
  game.swingAt();
  assert.ok(game.queuedBlow && !game.queuedBlow.target, 'a swing at the air lines up too');
});

test('a blighted thing is frailer than its kin, and walking into its room says nothing', () => {
  const { game, input, p } = start();
  const rec = fresh(game, 'kavorent');
  const d = new DungeonRun(game, rec);
  d.enter();
  const plain = d.spawn('drone', p.x + 3, FY, p.z, {});
  const sick = d.spawn('drone', p.x + 4, FY, p.z, { infected: true });
  assert.ok(INFECTED_HP < 1);
  assert.ok(sick.maxHp < plain.maxHp, `${sick.maxHp} < ${plain.maxHp}`);
  assert.equal(sick.maxHp, Math.max(1, Math.round(plain.maxHp * INFECTED_HP)));
  // Into a room the blight's got into: no message about it.
  let bl = null;
  for (let f = 0; f < rec.depth && !bl; f++) {
    if (f) d.changeFloor(1);
    bl = (d.data.blighted || [])[0];
  }
  if (bl) {
    const s = game.findFreeSpot(Math.round((bl.x0 + bl.x1) / 2), Math.round((bl.z0 + bl.z1) / 2), FY);
    p.teleport(s.x, s.y, s.z);
    const n = game.ui.msgs.length;
    for (const c of game.creatures) c.dormant = 999;
    run(game, input, 20);
    assert.ok(!game.ui.msgs.slice(n).some((m) => /blight has got in/i.test(m)));
  }
  d.leave();
});

test('the Overseer\'s shield turns a blade too, till its sentinels are down', () => {
  const { game, input, p } = start();
  const { c } = fight(game, p, 'overseer');
  c.workCd = c.beamCd = c.gridCd = 999;
  run(game, input, 40);
  assert.ok(shielded(c));
  const hp = c.hp;
  game.damage(c, 8, p);
  assert.equal(c.hp, hp, 'glanced off');
  assert.ok(c.shieldHit, 'a ripple where it struck');
  for (const s of c.sentinels) if (!s.dead) game.kill(s, p);
  assert.ok(!shielded(c));
  game.damage(c, 8, p);
  assert.ok(c.hp < hp, 'down: it goes in');
  game.dungeon.leave();
});

test('no master goes long without an attack: what it has is made ready, then it comes at you', () => {
  // (Before round 32: the Mound Witch could go 17 seconds, the Overseer 11,
  // Mother Nettle 9, the Hollow Saint 8.)
  for (const sp of ['overseer', 'mound_witch', 'poisoner', 'hollow_saint']) {
    const { game, input, p } = start();
    const { c } = fight(game, p, sp);
    let longest = 0;
    let gap = 0;
    for (let i = 0; i < 500 && !c.dead; i++) {
      p.hp = p.maxHp;
      const before = c.sinceAtk || 0;
      game.update(0.05, input);
      gap = (c.sinceAtk || 0) > before ? gap + 0.05 : 0;
      longest = Math.max(longest, gap);
    }
    assert.ok(longest < PRESS[1] + 1.5, `${sp}: ${longest.toFixed(1)}s without an attack`);
    game.dungeon.leave();
  }
});

test('the Overseer turns off a wall of force in its way, and it comes back up after', () => {
  const { game, input, p } = start();
  const { c } = fight(game, p, 'overseer');
  const w = game.world;
  // A wall of force right where it would step.
  const x = c.x + (c.foot || 0) + 1;
  const put = [];
  for (let dz = -2; dz <= 2; dz++) {
    for (const y of [c.y, c.y + 1]) {
      if (w.getBlock(x, y, c.z + dz) !== B.air) continue;
      w.setBlock(x, y, c.z + dz, B.kav_field);
      put.push({ x, y, z: c.z + dz });
    }
  }
  assert.ok(put.length);
  assert.ok(lowerFields(c, c.x + 1, c.z), 'turned off');
  assert.ok(put.some((q) => w.getBlock(q.x, q.y, q.z) === B.air));
  assert.ok(game.fieldsOff.length);
  // (Out of the way of it, so nothing stands in the gap.)
  c.dormant = 999;
  const s = game.findFreeSpot(c.x - 6, c.z, FY);
  p.teleport(s.x, s.y, s.z);
  run(game, input, Math.ceil((FIELD_OFF + 1) / 0.05));
  assert.ok(put.every((q) => w.getBlock(q.x, q.y, q.z) === B.kav_field), 'back up');
  game.dungeon.leave();
});

test('the Overseer paths through a wall of force rather than round it', async () => {
  const { game, p } = start();
  const { c } = fight(game, p, 'overseer');
  const { findPath } = await import('../src/entities/pathfind.js');
  const { fits } = await import('../src/entities/footprint.js');
  const { fieldWay } = await import('../src/entities/fields.js');
  const w = game.world;
  const br = game.dungeon.data.bossRoom;
  // A wall right across the hall between it and you.
  const z = c.z + (c.foot || 0) + 2;
  for (let x = br.x0; x <= br.x1; x++) for (const y of [c.y, c.y + 1]) if (w.getBlock(x, y, z) === B.air) w.setBlock(x, y, z, B.kav_field);
  const goal = { x: c.x, y: c.y, z: z + 3 };
  const plain = findPath(w, c.x, c.y, c.z, goal.x, goal.y, goal.z, { maxNodes: 800, near: 2, partial: true, clear: (x, y, zz) => fits(game, c, x, y, zz, true) });
  assert.ok(!plain || !plain.length || plain[plain.length - 1][2] < z, 'nobody else gets through');
  const soft = fieldWay(game);
  const way = findPath(w, c.x, c.y, c.z, goal.x, goal.y, goal.z, { maxNodes: 800, near: 2, partial: true, through: soft, clear: (x, y, zz) => fits(game, c, x, y, zz, true, soft) });
  assert.ok(way && way.some(([, , qz]) => qz > z), 'its way goes through');
  game.dungeon.leave();
});

// ------------------------------------------------------------ tents
test('tents stand three paces apart (they\'re big enough to stand up in), the fire out in front', () => {
  const game = makeGame(7);
  const input = stubInput();
  game.minute = 9 * 60;
  for (let i = 0; i < 20; i++) game.update(0.1, input);
  const far = game.world.ow.settlements.find((s) => !game.active.has(s.id));
  const L = game.sim.layoutOf(far.id);
  const c = game.sim.camps.pitch(L, 'n:test32', 'nomad', 3, game.sim.abs + 600, 3);
  assert.ok(c);
  const tents = c.ops.filter((o) => o[3] === B.tent);
  assert.equal(tents.length, 3);
  for (let i = 1; i < tents.length; i++) assert.equal(Math.abs(tents[i][0] - tents[0][0]) + Math.abs(tents[i][2] - tents[0][2]), 3 * i);
  const fire = c.ops.find((o) => o[3] === B.campfire);
  for (const t of tents) assert.ok(Math.abs(t[0] - fire[0]) + Math.abs(t[2] - fire[2]) >= 2, 'not up against a tent');
});

test('those who live in tents go in for the night (out of sight), and come out in the morning', () => {
  const game = makeGame(8);
  const input = stubInput();
  game.minute = 9 * 60;
  for (let i = 0; i < 20; i++) game.update(0.1, input);
  const [, a] = [...game.active][0];
  const L = a.layout;
  let b = null;
  for (let d = 0; d < 400 && !b; d++) b = game.sim.nomads.arrive(L, game.day + d, new RNG(d));
  b.arrive = game.sim.abs - 1;
  b.decide = game.sim.abs + 6000;
  let c = null;
  for (let i = 0; i < 1600 && !(c && c.placed >= c.ops.length); i++) {
    game.update(0.25, input);
    c = game.sim.camps.get(`n:${b.id}`);
  }
  assert.ok(c && c.placed >= c.ops.length, 'the camp is up');
  const fam = game.npcs.filter((n) => n.nomad && n.nomad.id === b.id && !n.dead);
  assert.ok(fam.length);
  // By day: no bed in a tent.
  assert.equal(fam[0].tentBed(c), null);
  // Bedtime.
  game.minute = 22 * 60;
  const tb = fam[0].tentBed(c);
  assert.ok(tb && tb.bed && tb.bed.tent);
  assert.equal(game.world.getBlock(tb.bed.x, GROUND, tb.bed.z), B.tent);
  let inside = [];
  for (let i = 0; i < 1200 && inside.length < fam.length; i++) {
    game.minute = 22 * 60;
    game.update(0.1, input);
    inside = fam.filter((n) => n.sleeping && n.bedTile && n.bedTile.tent);
  }
  assert.ok(inside.length >= 1, `${inside.length} of ${fam.length} turned in`);
  const n = inside[0];
  assert.equal(game.world.getBlock(n.x, GROUND, n.z), B.tent, 'inside it');
  // Morning: out they come, beside the tent.
  game.minute = 6 * 60 + 30;
  for (let i = 0; i < 20; i++) game.update(0.1, input);
  assert.ok(!n.sleeping, 'awake');
  assert.notEqual(game.world.getBlock(n.x, GROUND, n.z), B.tent, 'out of it');
});

// ------------------------------------------------------------ the spire
test('a spire\'s blight takes the snow too, lavender, out to a ragged edge (not a neat ring, nor a speckle)', async () => {
  const { stampSites, blighted, blightReach, BLIGHT_R } = await import('../src/world/sites.js');
  const { REGION_W, REGION_D } = await import('../src/config.js');
  const s = { id: 'k32', type: 'kavorent', x: 2000, z: 2000, h: 5, seed: 4242, state: {} };
  const reg = {
    x0: s.x - (REGION_W >> 1),
    z0: s.z - (REGION_D >> 1),
    m: new Map(),
    get(lx, y, lz) {
      return this.m.get(`${lx},${y},${lz}`) ?? (y === 5 ? B.snow : y < 5 ? B.dirt : B.air);
    },
    set(lx, y, lz, id) {
      this.m.set(`${lx},${y},${lz}`, id);
    },
  };
  stampSites({ sites: [s] }, reg);
  let inside = 0;
  let wrong = 0;
  let stray = 0;
  for (let lz = 0; lz < REGION_D; lz++) {
    for (let lx = 0; lx < REGION_W; lx++) {
      const x = reg.x0 + lx;
      const z = reg.z0 + lz;
      const d = Math.hypot(x - s.x, z - s.z);
      // (The spire's own cleared ground.)
      if (Math.abs(x - s.x) <= 7 && Math.abs(z - s.z) <= 7) continue;
      const top = reg.get(lx, 5, lz);
      if (blighted(s, x, z)) {
        inside++;
        if (top !== B.snow_void) wrong++;
      } else if (top === B.snow_void) stray++;
      // (Well inside its edge: all of it, no gaps.)
      if (d <= blightReach(s, Math.atan2(z - s.z, x - s.x)) - 1.5) assert.equal(top, B.snow_void, `a gap at ${d.toFixed(1)}`);
    }
  }
  assert.ok(inside > 200, `${inside} blighted`);
  assert.equal(wrong, 0);
  assert.equal(stray, 0);
  // Its edge wanders: lobes and fingers.
  const reach = [...Array(64).keys()].map((i) => blightReach(s, (i / 64) * Math.PI * 2));
  assert.ok(Math.max(...reach) - Math.min(...reach) > 4, 'ragged');
  assert.ok(Math.min(...reach) > 9 && Math.max(...reach) < BLIGHT_R + 9);
});

test('each floor of a Kavorent ruin is its own: named, and with its own things in it', async () => {
  const { buildFloor, kavKind, KAV_KINDS } = await import('../src/world/dungeongen.js');
  const game = makeGame(12345);
  const recs = game.sim.dungeons.all.filter((d) => d.type === 'kavorent').slice(0, 3);
  assert.ok(recs.length);
  const seen = new Set();
  for (const rec0 of recs) {
    const rec = { ...rec0, depth: 6 };
    const kinds = [];
    for (let n = 0; n < rec.depth - 1; n++) {
      const k = kavKind(rec, n);
      assert.ok(KAV_KINDS[k], `floor ${n}: ${k}`);
      kinds.push(k);
      seen.add(k);
      const f = buildFloor(rec, n);
      assert.equal(f.kind, k);
      const count = (id) => {
        let c = 0;
        for (const reg of f.regions.values()) for (let i = 0; i < reg.blocks.length; i++) if (reg.blocks[i] === id) c++;
        return c;
      };
      if (k === 'works') assert.ok((f.basins || []).length >= 1 && count(B.water) >= 4, 'coolant basins');
      if (k === 'archive') assert.ok(count(B.kav_monolith) + count(B.kav_holo) >= 20, 'aisles');
      if (k === 'dynamo') assert.ok((f.arcs || []).length >= 1 && count(B.kav_pylon) >= 2, 'pylons');
      if (k === 'fallen') assert.ok(count(B.kav_debris) >= 10, 'fallen alloy');
      if (k === 'garrison') assert.ok(count(B.kav_statue) >= 8 && f.spawns.some((s) => s.ambush), 'sentinels, and some awake');
      if (k === 'blighted') assert.ok(f.blighted.length >= 3, 'blighted rooms');
    }
    assert.equal(new Set(kinds).size, kinds.length, 'no two floors alike');
    assert.equal(kavKind(rec, rec.depth - 1), null, 'the master\'s floor is its own');
  }
  assert.ok(seen.size >= 4);
});

// ------------------------------------------------------------ falling
test('fallen: the dark and your body, the rite (glyphs, rings, turning), lifted, then white, and you rise at your rest', async () => {
  const { DEATH } = await import('../src/game/scenes.js');
  const { musicMood } = await import('../src/game/music.js');
  const { game, input, p } = start();
  game.cheats.god = false;
  p.spawn = { x: p.x, y: p.y, z: p.z };
  const s = game.findFreeSpot(p.x + 20, p.z, p.y);
  p.teleport(s.x, s.y, s.z);
  game.kill(p, null);
  assert.ok(p.dead);
  const sc = game.scene;
  assert.equal(sc && sc.kind, 'death');
  assert.equal(musicMood(game), 'death');
  // (Slowed, and dark: nothing raised yet.)
  for (let i = 0; i < Math.ceil(DEATH.RING / 0.05); i++) game.update(0.05, input);
  assert.ok(p.dead, 'still down');
  assert.ok(sc.etched >= 6, `glyphs cut: ${sc.etched}`);
  const until = (t) => {
    while (sc.t < t) game.update(0.05, input);
  };
  until(DEATH.SPIN + 0.3);
  assert.equal(musicMood(game), 'ritual');
  assert.ok(sc.spin > 0, 'turning');
  until(DEATH.FLASH + 0.1);
  assert.ok(sc.reborn && !p.dead, 'raised');
  assert.ok(Math.abs(p.x - p.spawn.x) <= 3 && Math.abs(p.z - p.spawn.z) <= 3, 'at your rest');
  for (let i = 0; i < 60 && game.scene; i++) game.update(0.05, input);
  assert.equal(game.scene, null, 'and it\'s over');
});

test('the rite can be hurried on (and a plain respawn ends it)', async () => {
  const { DEATH } = await import('../src/game/scenes.js');
  const { game, input, p } = start();
  game.cheats.god = false;
  game.kill(p, null);
  const sc = game.scene;
  sc.update(game, 0, [{ code: 'Space' }]);
  assert.ok(sc.t >= DEATH.ETCH - 0.2);
  sc.update(game, 0, [{ code: 'Space' }]);
  assert.ok(sc.t >= DEATH.FLASH - 0.6);
  for (let i = 0; i < 20; i++) game.update(0.05, input);
  assert.ok(!p.dead);
  // (Raised some other way: the rite's done with.)
  game.kill(p, null);
  game.respawn();
  assert.equal(game.scene, null);
});

test('a spire opened with a stone stands open on every side, not just the one you stood at', async () => {
  const { siteBlocks } = await import('../src/world/sites.js');
  const s = { type: 'kavorent', x: 0, z: 0, h: 5, seed: 99 };
  const doors = (state) => siteBlocks(s, state).filter(([, , , id]) => id === B.kav_door).map(([dx, , dz]) => `${dx},${dz}`);
  assert.equal(doors({}).length, 0, 'shut');
  for (const side of [0, 1, 2, 3]) {
    const d = new Set(doors({ open: side }));
    for (const f of ['0,2', '-2,0', '0,-2', '2,0']) assert.ok(d.has(f), `opened at ${side}: a door at ${f}`);
  }
});

test('a Kavorent lift is a ride: the shaft, then the floor below, and nothing can touch you on it', async () => {
  const { LIFT } = await import('../src/game/scenes.js');
  const { game, input, p } = start();
  game.cheats.god = false;
  const rec = fresh(game, 'kavorent');
  new DungeonRun(game, rec).enter();
  const d = game.dungeon;
  const dn = d.data.down;
  const ly = [FY - 1, FY, FY + 1].find((y) => game.world.getBlock(dn.x, y, dn.z) === B.kav_lift);
  p.teleport(dn.x, FY, dn.z);
  const { BLOCKS } = await import('../src/world/blocks.js');
  d.interact(dn.x, ly, dn.z, BLOCKS[B.kav_lift]);
  assert.equal(game.scene && game.scene.kind, 'lift');
  assert.equal(d.floor, 0, 'not there yet');
  const hp = p.hp;
  game.damage(p, 5, null);
  assert.equal(p.hp, hp, 'out of reach in the shaft');
  let t = 0;
  while (game.scene && t < LIFT.dur + 1) {
    game.update(0.05, input);
    t += 0.05;
  }
  assert.equal(game.dungeon.floor, 1, 'down a floor');
  assert.ok(t >= LIFT.dur - 0.1, 'and it took its time');
  game.dungeon.leave();
});

// ------------------------------------------------------------ quick fixes
test('starting out in a town that bans drawn weapons: yours is put away, not held', () => {
  const { game, p } = start();
  p.inv[0] = { item: 'iron_sword', count: 1 };
  p.inv[1] = { item: 'bread', count: 2 };
  p.selected = 0;
  game.stowArms();
  assert.notEqual(p.selected, 0);
  assert.ok(!(p.heldDef() && p.heldDef().kind === 'weapon'), 'nothing drawn');
});

test('a wagon\'s bench and its back are different places to sit', () => {
  const { game, p } = start();
  const prop = { x: p.x + 1, y: p.y, z: p.z, type: 'wagon' };
  game.riding.useWagon(prop, 'bench');
  assert.equal(p.wagonSeat, 'bench');
  assert.ok(prop.bench && !prop.riders.length, 'shown up front');
  game.riding.climbOut();
  assert.ok(!prop.bench);
  game.riding.useWagon(prop, 'back');
  assert.equal(p.wagonSeat, 'back');
  assert.ok(!prop.bench && prop.riders.length === 1, 'shown in the back');
  game.riding.climbOut();
});
