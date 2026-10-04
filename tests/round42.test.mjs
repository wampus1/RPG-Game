import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGame, stubInput } from './helpers.mjs';
import { B, BLOCKS } from '../src/world/blocks.js';
import { FY, buildFloor, DTYPES } from '../src/world/dungeongen.js';
import { DungeonRun, BOSS_HP, BOSS_HP_EXTRA } from '../src/game/dungeon.js';
import { summon, addHazard, areaTiles, sameSide, BRAINS } from '../src/entities/monsters.js';
import { topicsFor, respond } from '../src/game/dialogue.js';
import { geoTalk } from '../src/game/geotalk.js';
import { GUARD_HP } from '../src/entities/npcgen.js';
import { Rope } from '../src/render/bossrig.js';
import { MAP_W } from '../src/config.js';

function start(seed = 12345, minute = 10 * 60) {
  const game = makeGame(seed);
  const input = stubInput();
  game.minute = minute;
  for (let i = 0; i < 20; i++) game.update(0.1, input);
  return { game, input, p: game.player };
}
const run = (game, input, n, dt = 0.05) => {
  for (let i = 0; i < n; i++) game.update(dt, input);
};
const townsfolk = (game) => game.npcs.filter((n) => !n.dead && !n.hired && !n.visit && !n.warband && n.rec.age !== 'child');
const fresh = (game, type) => ({ ...game.sim.dungeons.all.find((d) => d.type === type), floors: {}, cleared: false, pack: null });

// ------------------------------------------------------------ talk
test('a researcher talks about the tree of learning, and it opens', () => {
  const { game } = start();
  const n = game.npcs.find((q) => !q.dead && q.rec.job === 'researcher') || townsfolk(game).find((q) => q.rec.job !== 'mayor' && q.rec.job !== 'guard');
  n.rec.job = 'researcher';
  const t = topicsFor(n, game).find((q) => q.id === 'research');
  assert.ok(t, 'a topic for it');
  assert.match(t.label, /tree of learning/);
  const r = respond(n, game, 'research');
  assert.equal(r.open, 'tech');
  assert.ok(r.lines.length >= 1);
});

// ------------------------------------------------------------ digging
test('digging two high takes ground and the walls of the town\'s buildings, never what you built in the open', () => {
  const { game, p } = start();
  const w = game.world;
  const L = w.layouts.get(game.currentSettlement.id);
  const b = L.buildings.find((q) => q.x1 - q.x0 >= 3 && q.z1 - q.z0 >= 3);
  assert.ok(b);
  // (A plank wall of the town's, up at head height.)
  w.setBlock(b.x0, p.y + 1, b.z0, B.planks);
  assert.ok(game.digsAlong(b.x0, p.y + 1, b.z0), 'a town wall comes away with it');
  w.setBlock(b.x0, p.y + 1, b.z0, B.stone);
  assert.ok(game.digsAlong(b.x0, p.y + 1, b.z0), 'and the ground always does');
  // Out in the open: your own cobblestone stays.
  let x = p.x;
  while (game.currentSettlement && L.inside(x, p.z) && x < p.x + 200) x++;
  w.setBlock(x, p.y + 1, p.z, B.cobblestone);
  assert.ok(!game.digsAlong(x, p.y + 1, p.z));
});

test('Shift and dig at the step: the blocks over it and over your head come away, and the step stays to walk up', () => {
  const { game, input, p } = start();
  const w = game.world;
  const keys = new Set(['ShiftLeft']);
  input.isDown = (k) => keys.has(k);
  game.input = input;
  const X = p.x + 1;
  const Y = p.y;
  const Z = p.z;
  for (const [x, y, z] of [[X, Y, Z], [X, Y + 1, Z], [X, Y + 2, Z], [p.x, Y + 2, Z]]) w.setBlock(x, y, z, B.stone);
  const c = { x: X, y: Y, z: Z, block: BLOCKS[B.stone], inReach: true };
  const plan = game.digPlan(c);
  assert.equal(plan.kind, 'step');
  assert.equal(plan.extra.length, 3);
  game.mining = null;
  for (let i = 0; i < 600 && game.digPlan(c).extra.length; i++) game.mineTick(0.05, c);
  assert.equal(w.getBlock(X, Y, Z), B.stone, 'the step is left');
  assert.equal(w.getBlock(X, Y + 1, Z), B.air);
  assert.equal(w.getBlock(X, Y + 2, Z), B.air);
  assert.equal(w.getBlock(p.x, Y + 2, Z), B.air, 'and the rock over your head');
  assert.equal(w.stepTarget(p.x, Y, Z, X, Z), Y + 1, 'a step you can walk up');
});

test('the ground dug from under you: you drop', () => {
  const { game, input, p } = start();
  const w = game.world;
  const y0 = p.y;
  w.setBlock(p.x, y0 - 1, p.z, B.air);
  w.setBlock(p.x, y0 - 2, p.z, B.air);
  run(game, input, 20);
  assert.ok(p.y < y0, `fell from ${y0} to ${p.y}`);
});

// ------------------------------------------------------------ town chests
test('a town\'s chests can\'t be broken, unless the town\'s abandoned', () => {
  const { game, p } = start();
  const w = game.world;
  const L = w.layouts.get(game.currentSettlement.id);
  let at = null;
  for (const b of L.buildings) {
    for (let x = b.x0; x <= b.x1 && !at; x++) for (let z = b.z0; z <= b.z1 && !at; z++) for (let y = p.y - 2; y <= p.y + 3 && !at; y++) {
      if (w.getBlock(x, y, z) === B.chest && game.containerOwner(x, y, z)) at = { x, y, z };
    }
    if (at) break;
  }
  assert.ok(at, 'a chest of the town\'s');
  assert.ok(game.unbreakableChest(at.x, at.y, at.z));
  const c = { ...at, block: BLOCKS[B.chest], inReach: true };
  game.mining = null;
  for (let i = 0; i < 100; i++) game.mineTick(0.1, c);
  assert.equal(w.getBlock(at.x, at.y, at.z), B.chest, 'still there');
  assert.ok(game.ui.msgs.some((m) => /can't be broken|won't break|town's/i.test(m)));
  game.currentSettlement.deserted = true;
  assert.ok(!game.unbreakableChest(at.x, at.y, at.z), 'nobody\'s now');
  game.currentSettlement.deserted = false;
});

// ------------------------------------------------------------ guards
test('guards are tougher, and some carry a bow as well as a blade', () => {
  const { game } = start();
  assert.ok(GUARD_HP >= 30);
  const guards = game.npcs.filter((n) => !n.dead && n.rec.job === 'guard');
  assert.ok(guards.length);
  for (const g of guards) assert.ok(g.maxHp >= 24, `${g.maxHp}`);
  // About a third of them, given the chance.
  let bows = 0;
  for (let i = 0; i < 30; i++) {
    const g = guards[0];
    const rec = g.rec;
    const was = { idx: rec.idx, eq: rec.equipment, inv: rec.inv };
    rec.idx = 1000 + i;
    rec.equipment = { ...was.eq, items: [], tool: 'iron_sword' };
    rec.inv = [];
    if (g.guardBow()) bows++;
    Object.assign(rec, { idx: was.idx, equipment: was.eq, inv: was.inv });
  }
  assert.ok(bows >= 4 && bows <= 20, `${bows} of 30`);
});

// ------------------------------------------------------------ fear
test('killings the town knows of make folk fear you, fading with the days', () => {
  const { game } = start();
  const J = game.sim.justice;
  const sid = game.currentSettlement.id;
  assert.equal(J.dreadIn(sid), 0);
  J.knownKilling(sid, {});
  J.knownKilling(sid, {});
  const c = {};
  J.knownKilling(sid, c);
  J.knownKilling(sid, c);
  assert.equal(J.dreadIn(sid), 3, 'each counted once');
  game.day += 10;
  assert.equal(J.dreadIn(sid), 2, 'and fading');
});

// ------------------------------------------------------------ the map
test('a town, or the shore, told of goes on your map (and the marks are kept)', () => {
  const { game } = start();
  const ow = game.world.ow;
  const n = townsfolk(game)[0];
  const q = ow.settlements.find((o) => o !== game.currentSettlement && o.condition !== 'abandoned' && !o.deserted && !ow.explored[o.cz * MAP_W + o.cx]);
  assert.ok(q);
  const r = geoTalk(n, game, `town:${q.id}`);
  assert.ok(ow.explored[q.cz * MAP_W + q.cx], 'the town on the map');
  assert.ok(r.lines.includes('(Marked on your map.)'));
  const before = ow.pins.length;
  const s = geoTalk(n, game, 'coast');
  assert.ok(ow.pins.length === before + 1 || !/nearest shore/.test(s.lines[0]), 'the shore pinned');
  const data = game.serialize();
  const g2 = makeGame(12345);
  g2.applySave(JSON.parse(JSON.stringify(data)));
  assert.equal(g2.world.ow.pins.length, ow.pins.length);
});

// ------------------------------------------------------------ bosses
test('masters: a tenth more health all round, more again for the great slow ones; halls a little bigger', () => {
  assert.ok(Math.abs(BOSS_HP - 1.3 * 1.1) < 1e-9);
  for (const k of ['worm', 'slag_titan', 'spore_colossus', 'coral_colossus']) assert.ok(BOSS_HP_EXTRA[k] > 1, k);
  for (const type of Object.keys(DTYPES)) {
    if (type === 'kavorent') continue;
    for (let seed = 1; seed <= 3; seed++) {
      const f = buildFloor({ type, seed: seed * 7919, depth: 2, level: 1, vaultFloor: 0 }, 1);
      assert.ok(f.bossRoom, `${type} ${seed}`);
      assert.ok(f.bossRoom.x1 - f.bossRoom.x0 + 1 >= 16 && f.bossRoom.z1 - f.bossRoom.z0 + 1 >= 12, `${type} ${seed}`);
    }
  }
});

test('what a master raises never hurts it, nor it them', () => {
  const { game, p } = start();
  new DungeonRun(game, fresh(game, 'kavorent')).enter();
  const d = game.dungeon;
  const s = game.findFreeSpot(p.x + 3, p.z, FY);
  const boss = d.spawn('prime', s.x, s.y, s.z, { boss: true });
  boss.dormant = 999;
  const mite = summon(game, 'mite', boss, 2);
  assert.ok(mite);
  assert.ok(mite.summoner === boss && sameSide(mite, boss) && sameSide(boss, mite));
  const hp = boss.hp;
  game.damage(boss, 5, mite);
  assert.equal(boss.hp, hp, 'no blow lands');
  // A burst of its going up, right on top of it.
  addHazard(game, { by: mite, tiles: areaTiles(boss.x, boss.z, 2), y: boss.y, dur: 0, dmg: 6, trap: true });
  run(game, stubInput(), 2);
  assert.equal(boss.hp, hp, 'not even a trap of its own thing\'s');
  d.leave();
});

test('the Drowned Priest flings his flail down the line at you, and whirls it when you\'re close', () => {
  const { game, p } = start();
  new DungeonRun(game, fresh(game, 'crypt')).enter();
  const d = game.dungeon;
  for (const c of game.creatures) {
    c.dead = true;
    game.removeOcc(c);
  }
  game.creatures = [];
  const s = game.findFreeSpot(p.x + 3, p.z, FY);
  const c = d.spawn('priest', s.x, s.y, s.z, { boss: true });
  c.target = p;
  c.flailCd = 0;
  c.castCd = 99;
  c.tideCd = 99;
  c.whirlCd = 99;
  c.sinceAtk = 99;
  const n0 = (game.hazards || []).length;
  for (let i = 0; i < 40 && !c.flail; i++) {
    c.flailCd = 0;
    c.recover = 0;
    BRAINS.priest(c, 0.05);
  }
  assert.ok(c.flail, 'the flail\'s out');
  assert.ok((game.hazards || []).length > n0, 'and where it lands is shown');
  // (A blow that lands as a ring has somewhere for it to ring out from.)
  for (const h of game.hazards) if (h.kind === 'slam') assert.ok(h.center && typeof h.center.x === 'number', 'a centre to it');
  d.leave();
});

// ------------------------------------------------------------ chains
test('a chain carried with what holds it keeps still (a camera turn doesn\'t set it whipping)', () => {
  const r = new Rope(6, 0.4, { x: 0, y: 2, z: 0 }, { x: 2, y: 0, z: 0 });
  for (let i = 0; i < 30; i++) r.step(1 / 60, { x: 0, y: 2, z: 0 }, { x: 2, y: 0, z: 0 });
  const v0 = r.p.map((q) => [q.x - q.px, q.z - q.pz]);
  r.carry(1, 0, 1, true);
  r.p.forEach((q, i) => {
    assert.ok(Math.abs(q.x - q.px - v0[i][0]) < 1e-9 && Math.abs(q.z - q.pz - v0[i][1]) < 1e-9, 'no speed given it');
  });
  assert.ok(Math.abs(r.p[0].x - 1) < 0.05, 'the held end moved');
});

// ------------------------------------------------------------ traps
test('an old place\'s own traps hold off while you\'re in your pack; what lives there doesn\'t', () => {
  const { game, input, p } = start();
  new DungeonRun(game, fresh(game, 'holdout')).enter();
  for (const c of game.creatures) {
    c.dead = true;
    game.removeOcc(c);
  }
  game.creatures = [];
  game.cheats = { ...(game.cheats || {}), god: false };
  p.hp = p.maxHp;
  game.ui.find = (k) => (k === 'inventory' ? {} : null);
  assert.ok(game.rummaging());
  addHazard(game, { tiles: [{ x: p.x, z: p.z }], y: p.y, dur: 0, dmg: 4, trap: true, place: true });
  run(game, input, 2);
  assert.equal(p.hp, p.maxHp, 'the trap held off');
  const s = game.findFreeSpot(p.x + 2, p.z, FY);
  const foe = game.dungeon.spawn('skeleton', s.x, s.y, s.z, {});
  foe.dormant = 999;
  addHazard(game, { by: foe, tiles: [{ x: p.x, z: p.z }], y: p.y, dur: 0, dmg: 4 });
  run(game, input, 2);
  assert.ok(p.hp < p.maxHp, 'a blow still lands');
  game.ui.find = () => null;
  game.dungeon.leave();
});

// ------------------------------------------------------------ duels
function bout(game, p) {
  const n = townsfolk(game).find((q) => q.rec.job !== 'guard' && q.rec.job !== 'mayor');
  const spot = game.findFreeSpot(p.x + 2, p.z, p.y);
  n.teleport(spot.x, spot.y, spot.z);
  game.startDuel(n, 0);
  game.duelBegins();
  return n;
}

test('a bout won: they go down on one knee, and a blow after it lands on nothing (and is no crime)', () => {
  const { game, input, p } = start();
  const n = bout(game, p);
  const sid = game.currentSettlement.id;
  for (let i = 0; i < 200 && game.duel; i++) {
    n.dodgeCd = 5;
    game.damage(n, 2, p);
  }
  assert.ok(!game.duel, 'the bout is over');
  assert.ok(game.scene && game.scene.kind === 'yield', 'the moment of it');
  run(game, input, 4);
  assert.ok(n.kneelT > 0, 'down on one knee');
  const hp = n.hp;
  game.damage(n, 3, p);
  assert.equal(n.hp, hp, 'the stray blow lands on nothing');
  assert.ok(!game.isWanted(sid), 'and nobody calls the guard');
  // A while on, they're up again.
  game.scene = null;
  run(game, input, 140);
  assert.ok(!(n.kneelT > 0), 'up again');
});

test('a bout lost: you go down on one knee, held there a few seconds, as they walk off', () => {
  const { game, input, p } = start();
  const n = bout(game, p);
  game.cheats = { ...(game.cheats || {}), god: false };
  p.hp = p.maxHp;
  for (let i = 0; i < 200 && game.duel; i++) game.damage(p, 1, n);
  assert.ok(!game.duel);
  assert.ok(p.kneelT > 0 || (game.scene && game.scene.kind === 'yield'));
  run(game, input, 40);
  assert.ok(p.kneelT > 0, 'still getting your breath');
  assert.ok(game.isBlocked(), 'held there');
  const hp = p.hp;
  game.damage(p, 3, n);
  assert.equal(p.hp, hp, 'no more blows from them');
  assert.ok(n.walkOff || n.distTo(p) >= 2, 'they\'re off');
  run(game, input, 120);
  assert.ok(!(p.kneelT > 0), 'up again');
});

// ------------------------------------------------------------ windmills
test('a windmill\'s sails know which way their hub faces', () => {
  const { game } = start();
  const ow = game.world.ow;
  let seen = 0;
  for (const s of ow.settlements.slice(0, 60)) {
    const L = game.world.getLayout(s);
    for (const b of L ? L.buildings : []) {
      if (b.type !== 'windmill' || !b.sails) continue;
      seen++;
      const sl = b.sails;
      assert.equal(Math.abs(sl.nx) + Math.abs(sl.nz), 1);
      assert.equal(!!sl.nz, sl.along, 'faces out of the wall it\'s on');
      // Out from the building, the way it faces.
      if (sl.nz) assert.ok(sl.nz > 0 ? sl.z > b.z1 : sl.z < b.z0);
      else assert.ok(sl.nx > 0 ? sl.x > b.x1 : sl.x < b.x0);
    }
    if (seen >= 3) break;
  }
  assert.ok(seen >= 1, 'found a windmill');
});
