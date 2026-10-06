// Round 61: armour in hand put on even with a shield on your arm; things
// dropped in lava burn up; a master isn't knocked off its stroke (only a
// parry does that); masters half as hard again to bring down; a shield
// holds the parry open a little longer; a Kavorent chest now and then
// holds a piece of their arms; the Crucible strikes its piston walls at
// you; and masters' tiers, with the time crystals that turn a beaten place
// back, harder.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGame, stubInput } from './helpers.mjs';
import { ITEMS } from '../src/world/items.js';
import { starGear } from '../src/world/quality.js';
import { B } from '../src/world/blocks.js';
import { ItemDrop } from '../src/entities/itemdrop.js';
import { DungeonRun, BOSS_HP } from '../src/game/dungeon.js';
import { buildFloor, FY } from '../src/world/dungeongen.js';
import { parryWindow, SHIELD_PARRY, resolveHit, STYLES } from '../src/game/combat.js';
import { phaseOf } from '../src/entities/tempo.js';
import { TIERS, tierTick, applyTier } from '../src/entities/bosstier.js';
import { useTimeCrystal, restoredTier, cantRestore } from '../src/game/timecrystal.js';
import { hurl } from '../src/entities/bosses_spire.js';
import { STEPS } from '../src/game/migrate.js';
import { GAME_VERSION, compareVersions } from '../src/version.js';

function start(seed = 12345) {
  const game = makeGame(seed);
  const input = stubInput();
  game.minute = 10 * 60;
  for (let i = 0; i < 20; i++) game.update(0.1, input);
  return { game, input, p: game.player };
}
const fresh = (game, type) => ({ ...game.sim.dungeons.all.find((d) => d.type === type), floors: {}, cleared: false, pack: null, packs: [] });
const quiet = (fn) => {
  const w = console.warn;
  console.warn = () => {};
  try {
    return fn();
  } finally {
    console.warn = w;
  }
};

test('a shield in hand, right-clicked: put on, not raised as a guard', () => {
  const { game, p } = start();
  p.equip.shield = 'iron_shield';
  p.inv[p.selected] = { item: 'kav_aegis', count: 1 };
  game.cursor = null;
  game.rightClick();
  assert.equal(p.equip.shield, 'kav_aegis');
  p.inv[p.selected] = { item: 'kav_visor', count: 1 };
  game.rightClick();
  assert.equal(p.equip.head, 'kav_visor');
});

test('dropped in lava, it burns up; a fireproof piece doesn\'t', () => {
  const { game, p } = start();
  const w = game.world;
  const x = p.x + 3;
  const z = p.z;
  const y = w.findStandY(x, z, p.y);
  w.setBlock(x, y - 1, z, B.lava);
  const d = new ItemDrop(game, 'bread', 2, x, y + 1, z);
  game.drops.push(d);
  for (let i = 0; i < 40 && !d.dead; i++) d.update(0.05);
  assert.ok(d.dead, 'burned up');
  const f = new ItemDrop(game, starGear('kav_visor', { stars: 3, origin: 'd', mods: ['fireproof'] }), 1, x, y + 1, z);
  for (let i = 0; i < 40; i++) f.update(0.05);
  assert.ok(!f.dead, 'fireproof: not');
});

test('masters: half as hard again to bring down, and not knocked off their stroke', () => {
  assert.ok(Math.abs(BOSS_HP - 1.43 * 1.5) < 1e-9);
  const { game, p } = start();
  new DungeonRun(game, fresh(game, 'barrow')).enter();
  const s = game.findFreeSpot(p.x + 2, p.z, p.y);
  const boss = game.dungeon.spawn('barrow_king', s.x, s.y, s.z, { boss: true });
  boss.dormant = 0;
  boss.windup = { t: 0, dur: 2, st: STYLES.slash || Object.values(STYLES)[0], target: p, tiles: [], y: boss.y, heading: [1, 0], combo: 0 };
  // A heavy blow, a stagger: it keeps on with its stroke.
  resolveHit(game, p, boss, { ...(STYLES.maul || Object.values(STYLES)[0]), stagger: 1 });
  assert.ok(!(boss.stunT > 0), 'not staggered');
  assert.ok(boss.windup, 'still winding up');
});

test('a shield on your arm holds the parry open a little longer; a master at tier 3, a little less', () => {
  const { game, p } = start();
  p.equip.shield = null;
  const bare = parryWindow(game);
  p.equip.shield = 'iron_shield';
  const shield = parryWindow(game);
  assert.ok(Math.abs(shield - bare - SHIELD_PARRY) < 1e-9);
  assert.ok(parryWindow(game, { parryK: TIERS[3].parry }) < shield);
});

test('a Kavorent chest now and then holds a piece of their arms or armour', () => {
  let gear = 0;
  for (let seed = 1; seed <= 12; seed++) {
    const f = buildFloor({ type: 'kavorent', seed: seed * 7919, depth: 3, level: 4, vaultFloor: 0 }, 1);
    for (const r of f.regions.values()) for (const slots of r.containers.values()) for (const q of slots || []) if (q && /^kav_(visor|carapace|greaves|treads|aegis|blade|lance|caster)/.test(q.item)) gear++;
  }
  assert.ok(gear > 0, `${gear}`);
});

test('the Crucible strikes one of its piston walls at you: it slides, and the floor burns behind it', () => {
  const { game, p } = start();
  new DungeonRun(game, fresh(game, 'kavorent')).enter();
  const s = game.findFreeSpot(p.x + 4, p.z, p.y);
  const c = game.dungeon.spawn('crucible', s.x, s.y, s.z, { boss: true });
  c.dormant = 0;
  c.target = p;
  c.leash = { x0: c.x - 14, z0: c.z - 10, x1: c.x + 14, z1: c.z + 10 };
  // A wall of its own beside it, toward you.
  const w = { x: c.x - 3, z: c.z };
  for (const y of [FY, FY + 1]) game.world.setBlock(w.x, y, w.z, B.kav_wall);
  c.pillars = [{ tiles: [w], life: 5 }];
  assert.ok(hurl(c), 'struck');
  for (let i = 0; i < 40; i++) game.update(0.05, stubInput());
  assert.notEqual(game.world.getBlock(w.x, FY, w.z), B.kav_wall, 'gone from where it stood');
  assert.ok(game.fireTiles && [...game.fireTiles.keys()].length > 0, 'a burning trail');
});

test('tiers: tier 3 has three times the health, harder and quicker, a tighter parry, a fourth phase, and the turned time\'s works', () => {
  const { game, input, p } = start();
  const rec = fresh(game, 'barrow');
  const hp = {};
  for (const t of [1, 2, 3]) {
    rec.tier = t;
    const run = new DungeonRun(game, rec);
    run.enter();
    const s = game.findFreeSpot(p.x + 3, p.z, p.y);
    const b = game.dungeon.spawn('barrow_king', s.x, s.y, s.z, { boss: true });
    hp[t] = b;
    if (t < 3) {
      game.kill(b, null);
      run.leave();
    }
  }
  assert.ok(Math.abs(hp[3].maxHp / hp[1].maxHp - 3) < 0.02);
  assert.ok(Math.abs(hp[2].maxHp / hp[1].maxHp - 1.75) < 0.02);
  assert.ok(Math.abs(hp[3].dmgMult / hp[1].dmgMult - 1.5) < 1e-6);
  assert.ok(Math.abs((hp[3].tempo || 1) / (hp[1].tempo || 1) - 1.5) < 1e-6);
  assert.equal(hp[3].parryK, 0.7);
  const b = hp[3];
  b.hp = Math.round(b.maxHp * 0.1);
  assert.equal(phaseOf(b), 4);
  b.hp = Math.round(b.maxHp * 0.5);
  assert.equal(phaseOf(b), 2);
  b.target = p;
  b.gapT = 0;
  b.ringsCd = 0;
  assert.ok(tierTick(b, 0.1), 'rings of the turned time');
  b.gapT = 0;
  b.ringsCd = 99;
  b.echoCd = 0;
  assert.ok(tierTick(b, 0.1), 'your own steps');
  quiet(() => {
    for (let i = 0; i < 10; i++) game.update(0.1, input);
  });
  // (Tier 1: none of it.)
  const t1 = applyTier({ maxHp: 100, hp: 100, dmgMult: 1 }, 1);
  assert.equal(t1.maxHp, 100);
});

test('a master\'s fall leaves a time crystal of its tier', () => {
  const { game, p } = start();
  const rec = fresh(game, 'barrow');
  rec.tier = 2;
  new DungeonRun(game, rec).enter();
  const d = game.dungeon;
  // (Down to its master's floor.)
  if (rec.depth > 1) d.open(rec.depth - 1, 'top');
  const sp = d.data.spawns.find((q) => q.boss);
  const s = game.findFreeSpot(p.x + 2, p.z, p.y);
  const b = d.spawn(sp.species, s.x, s.y, s.z, { boss: true, id: sp.id });
  quiet(() => game.kill(b, p));
  assert.ok(game.drops.some((q) => q.item === 'time_crystal_2'), 'tier II crystal');
});

test('a time crystal at the way into a beaten place: the scene, and the place as it was, a tier up', () => {
  const { game, input, p } = start();
  const rec = game.sim.dungeons.all.find((d) => d.type === 'barrow');
  assert.ok(cantRestore(game, rec), 'not while its master waits');
  rec.cleared = true;
  const site = game.sim.dungeons.site(rec);
  site.state = { cleared: true };
  game.teleportPlayer(rec.x + 1, 6, rec.z + 2);
  for (let i = 0; i < 10; i++) game.update(0.1, input);
  p.inv[p.selected] = { item: 'time_crystal_1', count: 1 };
  assert.ok(useTimeCrystal(game, ITEMS.time_crystal_1));
  assert.equal(game.scene && game.scene.kind, 'timeturn');
  assert.equal(p.inv[p.selected], null, 'used up');
  for (let i = 0; i < 90; i++) game.update(0.1, input);
  assert.equal(rec.cleared, false);
  assert.equal(rec.tier, restoredTier(1));
  assert.equal(rec.tier, 2);
  assert.equal(rec.restores, 1);
  assert.equal(site.state.cleared, false);
  assert.equal(restoredTier(3), 3);
  // Saved with the world.
  const saved = game.sim.dungeons.serialize().list.find((q) => q.id === rec.id);
  assert.equal(saved.tier, 2);
});

test('0.61.0', () => {
  assert.ok(STEPS.find((q) => q.to === '0.61.0'));
  assert.ok(compareVersions(GAME_VERSION, '0.61.0') >= 0);
});
