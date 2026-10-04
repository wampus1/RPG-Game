import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGame, stubInput } from './helpers.mjs';
import { ITEMS } from '../src/world/items.js';
import { FY, gearFor, lootTier } from '../src/world/dungeongen.js';
import { DungeonRun } from '../src/game/dungeon.js';
import { RNG } from '../src/util/rng.js';

function start(seed = 12345, minute = 10 * 60) {
  const game = makeGame(seed);
  const input = stubInput();
  game.minute = minute;
  for (let i = 0; i < 20; i++) game.update(0.1, input);
  return { game, input, p: game.player };
}

// Down to the last floor of an old place of `type`, beside its master.
function down(game, type = 'barrow', isle = null) {
  const base = game.sim.dungeons.all.find((d) => d.type === type && (!isle || d.isle === isle));
  const rec = { ...base, floors: {}, cleared: false, pack: null };
  new DungeonRun(game, rec).enter();
  while (game.dungeon.floor < rec.depth - 1) game.dungeon.changeFloor(1);
  return rec;
}

const isGear = (k) => !!ITEMS[k] && (ITEMS[k].kind === 'weapon' || ITEMS[k].kind === 'armor');

test('a piece of gear for an old place: better the deeper, its own island\'s sometimes, the Kavorent\'s in their halls', () => {
  const rng = new RNG(44);
  for (let i = 0; i < 40; i++) {
    assert.ok(isGear(gearFor('barrow', rng.int(0, 4), rng)));
    assert.ok(ITEMS[gearFor('kavorent', 2, rng)].kav);
  }
  // Deep down it's steel; near the top, scraps.
  const value = (t) => {
    let n = 0;
    for (let i = 0; i < 60; i++) n += ITEMS[gearFor('crypt', t, rng)].value || 0;
    return n / 60;
  };
  assert.ok(value(3.5) > value(0) * 2, `${value(3.5)} vs ${value(0)}`);
  assert.equal(lootTier({ level: 1, isle: 'kharos' }, 2), 2.75);
});

test('a master falls and leaves one or two pieces of gear, besides its relic', () => {
  const { game, p } = start();
  let seen = 0;
  for (let k = 0; k < 4; k++) {
    down(game);
    const boss = game.creatures.find((c) => c.isBoss && !c.dead && c.leash);
    assert.ok(boss);
    game.drops = [];
    game.kill(boss, p);
    const gear = game.drops.filter((d) => isGear(d.item) && Math.abs(d.x - boss.x) <= 3 && Math.abs(d.z - boss.z) <= 3);
    const fromIt = boss.S.drops ? boss.S.drops.filter(([q]) => isGear(q)).length : 0;
    assert.ok(gear.length >= 1 && gear.length <= 2 + fromIt, `${gear.length} pieces`);
    seen += gear.length;
    game.dungeon.leave();
  }
  assert.ok(seen >= 4);
});

test('a mimic, killed, spills what it held and a piece of gear', () => {
  const { game, p } = start();
  down(game);
  const d = game.dungeon;
  const q = game.findFreeSpot(p.x + 2, p.z, FY);
  const m = d.spawn('mimic', q.x, FY, q.z);
  m.mimicLoot = [{ item: 'torch', count: 2 }];
  game.drops = [];
  game.kill(m, p);
  assert.ok(game.drops.some((x) => x.item === 'torch'), 'what it held');
  assert.equal(game.drops.filter((x) => isGear(x.item)).length, 1, 'and one piece of gear');
});

test('the Hollow Oak has something for every season, and its roots whatever the season', async () => {
  const { BRAINS } = await import('../src/entities/monsters.js');
  const { game, input, p } = start();
  game.cheats = { ...(game.cheats || {}), god: true };
  down(game, 'grove');
  const d = game.dungeon;
  const br = d.data.bossRoom;
  for (const c of game.creatures) if (c.isBoss || c.leash) {
    c.dead = true;
    game.removeOcc(c);
  }
  game.creatures = game.creatures.filter((c) => !c.dead);
  const cx = Math.round((br.x0 + br.x1) / 2);
  const cz = Math.round((br.z0 + br.z1) / 2);
  const oak = d.spawn('hollow_oak', cx, FY, cz, { boss: true });
  oak.leash = br;
  assert.ok(BRAINS.hollowOak);
  const s = game.findFreeSpot(cx, cz + 4, FY);
  p.teleport(s.x, s.y, s.z);
  d.bossFight();
  game.scene = null;
  // Its cooldowns, as they're used (each one an attack of its own).
  const prev = {};
  const used = new Set();
  let moveT = 0;
  for (let i = 0; i < 1600 && !oak.dead; i++) {
    p.hp = p.maxHp;
    moveT -= 0.05;
    if (moveT <= 0) {
      moveT = 3;
      const a = Math.random() * Math.PI * 2;
      const r = 2 + Math.floor(Math.random() * 5);
      const q = game.findFreeSpot(Math.round(oak.x + Math.cos(a) * r), Math.round(oak.z + Math.sin(a) * r), FY);
      if (q && q.x >= br.x0 && q.x <= br.x1 && q.z >= br.z0 && q.z <= br.z1) p.teleport(q.x, q.y, q.z);
    }
    if (i === 500) oak.hp = Math.floor(oak.maxHp * 0.6);
    game.update(0.05, input);
    for (const k of Object.keys(oak)) {
      if (!k.endsWith('Cd') || k === 'attackCd' || typeof oak[k] !== 'number') continue;
      if (prev[k] !== undefined && oak[k] > prev[k] + 0.4) used.add(k);
      prev[k] = oak[k];
    }
  }
  // Something of each season's, and its roots.
  assert.ok(['acornCd', 'thicketCd'].some((k) => used.has(k)), `spring: ${[...used]}`);
  assert.ok(['sunCd', 'podCd'].some((k) => used.has(k)), `summer: ${[...used]}`);
  assert.ok(['leafCd', 'boughCd'].some((k) => used.has(k)), `autumn: ${[...used]}`);
  assert.ok(['frostCd', 'icicleCd'].some((k) => used.has(k)), `winter: ${[...used]}`);
  assert.ok(used.has('rootCd'), `roots: ${[...used]}`);
  assert.ok(used.size >= 8, `${used.size} ways: ${[...used]}`);
});

test('a master\'s works come round while it walks, not only while it stands', async () => {
  const { walkCooldowns } = await import('../src/entities/tempo.js');
  const c = { attackCd: 1, rootCd: 2, sunCd: 0, name: 'x', fooCd: 'n/a' };
  walkCooldowns(c, 0.5);
  assert.equal(c.rootCd, 1.5);
  assert.equal(c.attackCd, 1, 'an ordinary blow\'s runs down anyway');
  assert.equal(c.sunCd, 0, 'ready stays ready');
  assert.equal(c.fooCd, 'n/a');
});
