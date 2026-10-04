import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGame, stubInput } from './helpers.mjs';
import { ITEMS, socketed, grownRelic, SHARD_MAX } from '../src/world/items.js';
import { DungeonRun } from '../src/game/dungeon.js';
import { fitShard, setRelic, relicAt, relicReach, inRelic, RELIC_R, serializeRelics, loadRelics } from '../src/game/relics.js';
import { buildFloor, gearFor, FY } from '../src/world/dungeongen.js';
import { RNG } from '../src/util/rng.js';
import { MODS, STAR_MAX, starKey, parseStar, plainKey, starGear, rollStars, rollMods, starable, gearClass } from '../src/world/quality.js';
import { modsOf, onBladeMods, onBlockMods, toolDrops, stepModMult, gearHp, critBonus, bladeMult } from '../src/game/mods.js';
import { B, BLOCKS } from '../src/world/blocks.js';
import { WORLD_Y } from '../src/config.js';
import { spireStormAt, strike } from '../src/game/spirestorm.js';
import { allSpiresBeaten } from '../src/game/wallfall.js';
import { Creature, SPECIES } from '../src/entities/creature.js';
import { BRAINS } from '../src/entities/monsters.js';
import { beastOf } from '../src/render/bossbeasts.js';
import { SPIRE_MASTERS } from '../src/world/isledeep.js';
import { screened, soak } from '../src/entities/bosses_spire.js';

function start(seed = 12345, minute = 10 * 60) {
  const game = makeGame(seed);
  const input = stubInput();
  game.minute = minute;
  for (let i = 0; i < 20; i++) game.update(0.1, input);
  return { game, input, p: game.player };
}

// Something in your hand, in the first slot of your belt.
function hold(p, key) {
  p.inv[0] = { item: key, count: 1 };
  p.selected = 0;
}

// A dummy to try things on, a pace in front of you.
function dummy(game, p, hp = 200) {
  const c = new Creature(game, 'wolf', p.x + 1, p.y, p.z);
  game.addCreature(c);
  c.hp = c.maxHp = hp;
  return c;
}

test('eight modifiers for each kind of gear', () => {
  for (const cls of ['blade', 'bow', 'shield', 'armor', 'tool']) assert.equal(Object.keys(MODS[cls]).length, 8, cls);
  assert.equal(gearClass(ITEMS.iron_sword), 'blade');
  assert.equal(gearClass(ITEMS.longbow), 'bow');
  assert.equal(gearClass(ITEMS.iron_shield), 'shield');
  assert.equal(gearClass(ITEMS.chainmail), 'armor');
  assert.equal(gearClass(ITEMS.iron_pickaxe || ITEMS.stone_pickaxe), 'tool');
  assert.equal(gearClass(ITEMS.bread), null);
});

test('a starred piece is its plain one made better, its stars and modifiers in its key', () => {
  const k = starKey('iron_sword', 4, 'd', 600, ['venom', 'keen']);
  const it = ITEMS[k];
  assert.ok(it, k);
  assert.equal(it.stars, 4);
  assert.equal(it.origin, 'd');
  assert.deepEqual(it.mods, ['venom', 'keen']);
  assert.equal(it.plain, 'iron_sword');
  assert.equal(plainKey(k), 'iron_sword');
  assert.equal(it.name, `Venomous ${ITEMS.iron_sword.name}`);
  assert.ok(it.damage > ITEMS.iron_sword.damage, `${it.damage} vs ${ITEMS.iron_sword.damage}`);
  assert.ok(it.value > ITEMS.iron_sword.value);
  assert.ok(!it.stack || it.stack === 1, 'one to a slot');
  // More stars, better (whatever the roll).
  const one = ITEMS[starKey('iron_sword', 1, 'c', 1295)];
  const five = ITEMS[starKey('iron_sword', 5, 'c', 0)];
  assert.ok(five.damage > one.damage);
  // The same stars, a little more or less by the roll.
  assert.notEqual(ITEMS[starKey('iron_sword', 3, 'c', 0)].damage, ITEMS[starKey('iron_sword', 3, 'c', 1295)].damage);
  // Armour keeps more off; a shield takes more of a blow.
  assert.ok(ITEMS[starKey('chainmail', 3, 'c', 600)].armor > ITEMS.chainmail.armor);
  assert.ok(ITEMS[starKey('iron_shield', 3, 'c', 600)].block > ITEMS.iron_shield.block);
  // Nothing new among the items you'd list (a starred piece is made up when asked for).
  assert.ok(!Object.keys(ITEMS).some((q) => q.includes('~')));
  // A key that isn't a good one is no item at all.
  assert.equal(ITEMS['iron_sword~9zz'], undefined);
  assert.equal(ITEMS[starKey('iron_sword', 3, 'c', 0, ['smelting'])], undefined, 'not a blade modifier');
  assert.deepEqual(parseStar(k), { plain: 'iron_sword', stars: 4, origin: 'd', roll: 600, mods: ['venom', 'keen'] });
  // A stone set in it keeps its stars.
  const set = socketed(k, 'ruby');
  assert.ok(ITEMS[set], set);
  assert.equal(ITEMS[set].stars, 4);
  assert.ok(ITEMS[set].socket);
  // Only plain gear takes stars.
  assert.ok(starable('iron_sword'));
  assert.ok(!starable(k));
  assert.ok(!starable('bread'));
  assert.equal(starGear('bread'), 'bread');
});

test('stars: made at a bench mostly one or two; found below, more the deeper, more again off a master', () => {
  const rng = new RNG(45);
  const avg = (o) => {
    let n = 0;
    for (let i = 0; i < 400; i++) n += rollStars(rng, o);
    return n / 400;
  };
  const made = avg({ origin: 'c' });
  assert.ok(made < 2.3, `made ${made}`);
  assert.ok(avg({ origin: 'c', tinker: true }) > made);
  assert.ok(avg({ origin: 'd', tier: 3 }) > avg({ origin: 'd', tier: 0 }) + 1);
  assert.ok(avg({ origin: 'd', tier: 1, boss: true }) > avg({ origin: 'd', tier: 1 }) + 0.6);
  for (let i = 0; i < 300; i++) {
    const s = rollStars(rng, { origin: 'd', tier: 6, boss: true });
    assert.ok(s >= 1 && s <= STAR_MAX);
  }
  // More modifiers with more stars; a tool's own only on that kind of tool.
  let few = 0;
  let many = 0;
  for (let i = 0; i < 300; i++) {
    few += rollMods('blade', 1, rng).length;
    many += rollMods('blade', 5, rng).length;
    assert.ok(!rollMods('tool', 5, rng, ITEMS.iron_axe || { tool: 'axe' }).includes('smelting'));
  }
  assert.ok(many > few * 3, `${many} vs ${few}`);
});

test('gear found below is starred and marked as from the deep, chests and masters alike', () => {
  let found = 0;
  for (let seed = 1; seed < 25; seed++) {
    for (const type of ['crypt', 'mine', 'kavorent']) {
      const rec = { type, seed: seed * 977, depth: type === 'kavorent' ? 4 : 3, level: 2, isle: 'thessa', name: 'x' };
      for (let n = 0; n < rec.depth; n++) {
        const out = buildFloor(rec, n);
        for (const r of out.regions.values()) {
          for (const slots of r.containers.values()) {
            for (const s of slots) {
              if (!s || !gearClass(ITEMS[s.item])) continue;
              assert.ok(ITEMS[s.item].stars, `${s.item} unstarred`);
              assert.equal(ITEMS[s.item].origin, 'd');
              found++;
            }
          }
        }
      }
    }
  }
  assert.ok(found > 20, `${found}`);
  // The same floor, the same things (stars and all).
  const rec = { type: 'crypt', seed: 4242, depth: 3, level: 1, isle: 'thessa', name: 'x' };
  const items = (o) => [...o.regions.values()].flatMap((r) => [...r.containers.values()].flat()).filter(Boolean).map((s) => s.item).join();
  assert.equal(items(buildFloor(rec, 2)), items(buildFloor(rec, 2)));
  const rng = { chance: (p) => Math.random() < p, int: (a, b) => a + Math.floor(Math.random() * (b - a + 1)), float: (a, b) => a + Math.random() * (b - a), pick: (a) => a[Math.floor(Math.random() * a.length)] };
  for (let i = 0; i < 30; i++) {
    const k = gearFor('barrow', 2, rng, null, true);
    assert.ok(ITEMS[k].stars >= 2, k);
    assert.equal(ITEMS[k].origin, 'd');
  }
});

test('things made at a bench come out starred', () => {
  const { game, p } = start();
  const r = { out: 'iron_sword' };
  const made = new Set();
  for (let i = 0; i < 40; i++) made.add(starGear(r.out, { origin: 'c' }));
  for (const k of made) {
    assert.equal(ITEMS[k].origin, 'c');
    assert.equal(ITEMS[k].plain, 'iron_sword');
  }
  assert.ok(made.size > 10, 'each one its own');
  assert.ok(game && p);
});

test('a blade\'s modifiers: venom poisons, frost chills, keen strikes true, merciless finishes', () => {
  const { game, p } = start();
  const t = dummy(game, p);
  assert.ok(t, 'a creature to try it on');
  hold(p, starKey('iron_sword', 3, 'c', 600, ['venom', 'frost', 'keen']));
  assert.deepEqual(modsOf(p).blade, ['venom', 'frost', 'keen']);
  onBladeMods(game, p, t);
  assert.ok(t.poisonT > 0, 'poisoned');
  assert.ok(t.slowT > 0, 'chilled');
  assert.ok(critBonus(p) > 0);
  hold(p, starKey('iron_sword', 3, 'c', 600, ['merciless']));
  t.hp = 10;
  assert.equal(bladeMult(p, t), 1.5);
  t.hp = 200;
  assert.equal(bladeMult(p, t), 1);
  // A plain one does none of it.
  hold(p, 'iron_sword');
  assert.equal(critBonus(p), 0);
});

test('a thorned shield gives back what it turns; fleet and hale armour', () => {
  const { game, p } = start();
  const t = dummy(game, p);
  p.equip.shield = starKey('iron_shield', 3, 'c', 600, ['thorns']);
  const hp = t.hp;
  onBlockMods(game, p, t, false, 6);
  assert.ok(t.hp < hp, 'struck back');
  // Fleet: quicker steps; hale: more health.
  p.equip.body = starKey('chainmail', 3, 'c', 600, ['fleet', 'hale']);
  p.equip.feet = starKey('iron_boots', 3, 'c', 600, ['fleet']);
  assert.ok(stepModMult(p) < 1);
  assert.equal(gearHp(p), 2);
  const before = p.maxHp;
  p.update(0.05, stubInput(), game);
  assert.ok(p.maxHp >= before);
});

test('a smelting pick brings ore up as metal; a sawing axe fells planks', () => {
  const { game, p } = start();
  const pick = Object.keys(ITEMS).find((k) => ITEMS[k].tool === 'pick' && starable(k));
  hold(p, starKey(pick, 3, 'c', 600, ['smelting']));
  const drops = [{ item: 'iron_ore', count: 1 }];
  toolDrops(game, p, B.iron_ore, drops);
  assert.equal(drops[0].item, 'iron_ingot');
  const axe = Object.keys(ITEMS).find((k) => ITEMS[k].tool === 'axe' && starable(k));
  const log = Object.keys(B).find((k) => /^log/.test(k));
  if (axe && log) {
    hold(p, starKey(axe, 3, 'c', 600, ['sawing']));
    const d = [{ item: ITEMS[log] ? log : 'log_oak', count: 1 }];
    toolDrops(game, p, B[log], d);
    assert.ok(/planks/.test(d[0].item), d[0].item);
  }
});

// Down to the last floor of an old place of `type`, beside its master.
function down(game, type = 'barrow') {
  const base = game.sim.dungeons.all.find((d) => d.type === type);
  const rec = { ...base, floors: {}, cleared: false, pack: null };
  new DungeonRun(game, rec).enter();
  while (game.dungeon.floor < rec.depth - 1) game.dungeon.changeFloor(1);
  return rec;
}

test('a master leaves one to three relic shards, and its gear a star better', () => {
  const { game, p } = start();
  const counts = new Set();
  for (let k = 0; k < 5; k++) {
    down(game);
    const boss = game.creatures.find((c) => c.isBoss && !c.dead && c.leash);
    assert.ok(boss);
    game.drops = [];
    game.kill(boss, p);
    const shards = game.drops.filter((d) => d.item === 'relic_shard').reduce((n, d) => n + d.count, 0);
    assert.ok(shards >= 1 && shards <= 3, `${shards} shards`);
    counts.add(shards);
    for (const d of game.drops) if (gearClass(ITEMS[d.item]) && ITEMS[d.item].origin) assert.equal(ITEMS[d.item].origin, 'd');
    game.dungeon.leave();
  }
  assert.ok(counts.size >= 2, 'not always the same');
});

test('a relic shard set into a relic in your pack makes its circle reach further, for good', () => {
  const { game, p } = start();
  assert.equal(ITEMS.relic_shard.kind, 'relic_shard');
  assert.equal(grownRelic('hearth', 0), 'relic_hearth');
  assert.equal(ITEMS[grownRelic('hearth', 3)].shards, 3);
  assert.equal(ITEMS[grownRelic('hearth', 3)].relic, 'hearth');
  assert.equal(ITEMS['relic_hearth*9'], undefined);
  assert.ok(!Object.keys(ITEMS).some((k) => k.includes('*')));
  p.inv.fill(null);
  p.inv[0] = { item: 'relic_shard', count: SHARD_MAX + 2 };
  p.inv[3] = { item: 'relic_ward', count: 1 };
  p.selected = 0;
  assert.ok(fitShard(game, ITEMS.relic_shard));
  assert.equal(p.inv[3].item, 'relic_ward*1');
  assert.equal(p.inv[0].count, SHARD_MAX + 1);
  for (let i = 0; i < SHARD_MAX + 1; i++) fitShard(game, ITEMS.relic_shard);
  assert.equal(ITEMS[p.inv[3].item].shards, SHARD_MAX, 'no more than it can take');
  assert.equal(p.inv[0].count, 2, 'the rest kept');
  // None to set it in: kept.
  p.inv[3] = null;
  assert.ok(fitShard(game, ITEMS.relic_shard));
  assert.equal(p.inv[0].count, 2);
  // Set down, it reaches further; taken up, it keeps its shards.
  const x = Math.round(p.x) + 2;
  const z = Math.round(p.z);
  const y = Math.round(p.y);
  game.world.setBlock(x, y, z, B.relic);
  setRelic(game, x, y, z, 'ward', 4);
  assert.equal(relicAt(game, x, y, z).r, relicReach(4));
  assert.ok(relicReach(4) > RELIC_R);
  assert.ok(inRelic(game, x + RELIC_R + 1.5, y, z, 'ward'), 'within the grown circle');
  assert.ok(!inRelic(game, x + relicReach(4) + 1.5, y, z, 'ward'));
  game.takeRelic(x, y, z);
  assert.ok(p.inv.some((s) => s && s.item === 'relic_ward*4'));
  // (And saved and loaded with it.)
  setRelic(game, x, y, z, 'ward', 2);
  const saved = serializeRelics(game);
  loadRelics(game, saved);
  assert.equal(relicAt(game, x, y, z).shards, 2);
  assert.equal(relicAt(game, x, y, z).r, relicReach(2));
});

// Down to the master of `isle`'s spire.
function spireHall(game, isle) {
  const base = game.sim.dungeons.all.find((d) => d.type === 'kavorent' && d.isle === isle);
  const rec = { ...base, floors: {}, cleared: false, pack: null };
  new DungeonRun(game, rec).enter();
  while (game.dungeon.floor < rec.depth - 1) game.dungeon.changeFloor(1);
  const boss = game.creatures.find((c) => c.isBoss && !c.dead);
  return { rec, boss };
}

test('each island\'s spire has its own master: the Overseer, the Crucible, the Condenser', () => {
  assert.deepEqual(SPIRE_MASTERS, { thessa: 'overseer', kharos: 'crucible', myrrow: 'condenser' });
  for (const k of ['crucible', 'condenser']) {
    assert.ok(SPECIES[k] && SPECIES[k].boss && BRAINS[SPECIES[k].brain], k);
    assert.ok(beastOf(k), `${k} is drawn`);
  }
  for (const [isle, sp] of Object.entries(SPIRE_MASTERS)) {
    const game = makeGame(12345);
    const { boss } = spireHall(game, isle);
    assert.equal(boss && boss.species, sp, isle);
  }
});

// A fight of `secs` with the master of `isle`'s spire, you stood in its hall.
function spireFight(isle, secs, hpShare = 1) {
  const game = makeGame(12345);
  const input = stubInput();
  const { boss } = spireHall(game, isle);
  const p = game.player;
  boss.hp = Math.round(boss.maxHp * hpShare);
  for (const c of game.creatures) if (c !== boss && !c.isBoss) c.dormant = 999;
  p.teleport(boss.x + 4, boss.y, boss.z);
  game.moveEntity(p, boss.x + 4, boss.y, boss.z);
  boss.target = p;
  const orig = game.damage.bind(game);
  let took = 0;
  game.damage = (e, n, by) => {
    if (e === p) {
      took += n;
      p.hp = p.maxHp;
      return;
    }
    return orig(e, n, by);
  };
  const seen = new Set();
  for (let i = 0; i < secs * 20; i++) {
    game.update(0.05, input);
    if (boss.overheat) seen.add('overheat');
    if (boss.ventT > 0) seen.add('vent');
    for (const c of game.creatures) if (!c.dead && c !== boss) seen.add(c.species);
    if (p.soakT > 0) seen.add('soaked');
    for (const q of game.works || []) seen.add(`work:${q.id}`);
  }
  return { game, boss, p, took, seen };
}

test('the Crucible runs hot and must blow it off: shelter behind a coolant column, then strike its open core', () => {
  const { boss, took, seen } = spireFight('kharos', 60);
  assert.ok(took > 0, 'it fights');
  assert.ok(seen.has('overheat'), 'it overheats');
  assert.ok(seen.has('vent'), 'and stands open after');
  assert.ok(seen.has(`work:${B.kav_coolant}`), 'coolant columns go up');
  assert.ok(seen.has(`work:${B.lava}`) || seen.has(`work:${B.kav_wall}`), 'its lance leaves lava, its pistons stand');
  // Open, your blows bite deeper.
  boss.ventT = 2;
  assert.ok(boss.S.ward(boss.game, boss, null, 10) > 10);
  boss.ventT = 0;
  assert.equal(boss.S.ward(boss.game, boss, null, 10), 10);
  // Its slag drones, once it's worn.
  const worn = spireFight('kharos', 30, 0.5);
  assert.ok(worn.seen.has('slag_drone'), 'slag drones');
});

test('a column between you and the Crucible shelters you from its blast', () => {
  const game = makeGame(12345);
  const { boss } = spireHall(game, 'kharos');
  const p = game.player;
  const at = { x: boss.x + 5, z: boss.z };
  assert.ok(!screened(game, boss, at));
  game.world.setBlock(boss.x + 3, FY, boss.z, B.kav_coolant);
  game.world.setBlock(boss.x + 3, FY + 1, boss.z, B.kav_coolant);
  assert.ok(screened(game, boss, at));
  assert.ok(p);
});

test('the Condenser soaks you, grounds itself on its rods, and lightning finds you harder wet', () => {
  const { game, boss, took, seen } = spireFight('myrrow', 60);
  assert.ok(took > 0, 'it fights');
  assert.ok(seen.has('storm_rod'), 'it plants its rods');
  assert.ok(seen.has('soaked'), 'its rain soaks you');
  // Its rods standing: it's grounded.
  const rods = game.creatures.filter((c) => !c.dead && c.species === 'storm_rod' && c.summoner === boss);
  if (rods.length) assert.ok(boss.S.ward(game, boss, null, 10) < 10);
  for (const r of rods) game.kill(r, null);
  assert.equal(boss.S.ward(game, boss, null, 10), 10, 'its rods down, it takes your blows');
  // Soaked, it's worse.
  const p = game.player;
  p.soakT = 0;
  soak(game, p, 5);
  assert.equal(p.soakT, 5);
  for (let i = 0; i < 120; i++) p.update(0.05, stubInput(), game);
  assert.ok(!(p.soakT > 0), 'dried off in time');
});

test('one spire to an island, each its own: the facility, the thermal spire in the crater\'s lava, the tidal spire by the sea', () => {
  const game = makeGame(12345);
  const w = game.world;
  const spires = w.sites.filter((s) => s.type === 'kavorent');
  assert.equal(spires.length, 3);
  const by = Object.fromEntries(spires.map((s) => [s.island, s]));
  assert.equal(by.thessa.theme, 'facility');
  assert.equal(by.kharos.theme, 'thermal');
  assert.equal(by.myrrow.theme, 'tidal');
  // Kharos's: in the crater.
  const V = w.ow.volcano;
  assert.equal(by.kharos.x, V.x);
  assert.equal(by.kharos.z, V.z);
  // Myrrow's: by the water, its intakes run to it.
  assert.ok(by.myrrow.sea, 'the sea found');
  assert.ok(by.myrrow.sea[2] <= 28);
  // The thermal spire's causeways: out over the lava and up the crater's
  // wall, never more than a pace up (or down) at a time.
  const s = by.kharos;
  for (let rz = Math.floor((s.z - 45) / 36); rz <= Math.floor((s.z + 45) / 36); rz++) for (let rx = Math.floor((s.x - 45) / 64); rx <= Math.floor((s.x + 45) / 64); rx++) w.loadRegion(rx, rz);
  const top = (x, z) => {
    for (let y = WORLD_Y - 1; y >= 0; y--) if (BLOCKS[w.getBlock(x, y, z)].solid || BLOCKS[w.getBlock(x, y, z)].liquid) return { y, lava: w.getBlock(x, y, z) === B.lava };
    return { y: -1 };
  };
  assert.equal(w.getBlock(s.x + 3, s.h, s.z), B.kav_floor, 'a platform round its foot');
  assert.equal(w.getBlock(s.x + 9, s.h, s.z + 9), B.lava, 'in the lava');
  for (const [ux, uz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    let last = top(s.x + ux * 4, s.z + uz * 4).y;
    for (let k = 5; k <= 24; k++) {
      const t = top(s.x + ux * k, s.z + uz * k);
      assert.ok(!t.lava, `no lava on the causeway (${ux},${uz}) at ${k}`);
      assert.ok(Math.abs(t.y - last) <= 1, `a step of one at most (${ux},${uz}) at ${k}: ${last} to ${t.y}`);
      last = t.y;
    }
  }
});

test('each spire keeps a storm about it, rain and lightning, till its master\'s beaten', () => {
  const { game, p } = start();
  const s = game.world.sites.find((q) => q.type === 'kavorent' && q.island === 'thessa');
  assert.equal(spireStormAt(game, s.x, s.z), 1);
  assert.equal(spireStormAt(game, s.x + 200, s.z), 0);
  const mid = spireStormAt(game, s.x + 22, s.z);
  assert.ok(mid > 0 && mid < 1, `${mid}`);
  // Under it: clouds, and rain.
  p.teleport(s.x + 8, s.h + 1, s.z);
  game.moveEntity(p, s.x + 8, s.h + 1, s.z);
  for (let i = 0; i < 80; i++) game.update(0.1, stubInput());
  assert.ok(game.spireStorm > 0.5, `${game.spireStorm}`);
  assert.equal(game.weather.kind, 'rain');
  assert.ok(game.stormSea.cloud > 0.15 && game.stormSea.cloud < 0.6, `some cloud, not the wall's: ${game.stormSea.cloud}`);
  // Its lightning: into the spire, or the ground (and whoever's there).
  const hp = p.hp;
  const at = strike(game, s, { x: p.x, z: p.z });
  assert.ok(!at.spire);
  assert.ok(p.hp < hp, 'struck');
  // Beaten: no storm.
  const rec = game.sim.dungeons.get(s.id);
  game.sim.dungeons.cleared(rec, 'you');
  assert.ok(s.state.beaten);
  assert.equal(spireStormAt(game, s.x, s.z), 0);
});

test('beat all three spires and, out of the last, the storm wall comes down for good', () => {
  const { game, input } = start();
  const ow = game.world.ow;
  const inWall = (() => {
    // (A spot in the thick of the storm.)
    for (let x = 0; x < 200 * 64; x += 64) {
      for (let z = 0; z < 300 * 36; z += 36) if (ow.stormAt(x, z) > 0.8) return { x, z };
    }
    return null;
  })();
  assert.ok(inWall, 'the storm is up');
  const recs = game.sim.dungeons.all.filter((d) => d.type === 'kavorent');
  assert.equal(recs.length, 3);
  // Two beaten: not yet.
  for (const r of recs.slice(0, 2)) game.sim.dungeons.cleared(r, 'you');
  assert.ok(!allSpiresBeaten(game));
  // The third: down into it, its master beaten, and back up.
  const last = recs[2];
  new DungeonRun(game, last).enter();
  game.sim.dungeons.cleared(last, 'you');
  assert.ok(allSpiresBeaten(game));
  game.dungeon.leave();
  assert.ok(game.wallPending, 'its scene waiting');
  game.update(0.1, input);
  assert.equal(game.scene && game.scene.kind, 'wall');
  assert.ok(!ow.wallDown, 'not till it breaks');
  for (let i = 0; i < 200 && game.scene; i++) game.update(0.1, input);
  assert.ok(!game.scene, 'the scene played through');
  assert.ok(ow.wallDown);
  assert.equal(ow.stormAt(inWall.x, inWall.z), 0, 'no storm where it stood');
  assert.equal(ow.stormNear(inWall.x, inWall.z), 0);
  assert.ok(ow.insideStorm(game.player.x, game.player.z), 'the islands still the islands');
  // Saved with the world.
  const data = JSON.parse(JSON.stringify(game.serialize()));
  assert.equal(data.wallDown, true);
  const g2 = new game.constructor({ seed: data.seed, renderer: game.renderer, audio: null, ui: game.ui, save: data });
  assert.ok(g2.world.ow.wallDown);
  assert.equal(g2.world.ow.stormAt(inWall.x, inWall.z), 0);
});
