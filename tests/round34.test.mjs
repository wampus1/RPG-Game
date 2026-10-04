import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGame, stubInput } from './helpers.mjs';
import { B, BLOCKS } from '../src/world/blocks.js';
import { DAY } from '../src/sim/econ.js';
import { compass, howFar, geoMenu, geoTalk } from '../src/game/geotalk.js';
import { LAWS, lawFits, foundingLaws } from '../src/sim/laws.js';
import { RITES, riteOf } from '../src/sim/events.js';
import { treeOf } from '../src/sim/tech.js';
import { ISLE_TRADES, tradeOfStyle, tradePrice, TRADE_BUILDINGS } from '../src/sim/isletrades.js';
import { THEMES, musicMood } from '../src/game/music.js';
import { RNG } from '../src/util/rng.js';
import { SPECIES, Creature } from '../src/entities/creature.js';
import { BRAINS } from '../src/entities/monsters.js';
import { isleNightSpecies } from '../src/entities/islemobs.js';
import { buildFloor, dtypeOf, DTYPES, FY } from '../src/world/dungeongen.js';
import { ISLE_BOSSES, ISLE_DTYPES, ISLE_DSTYLE, OWN_TYPE, ISLE_BOSS_HP, FAR_DELVE_DAY } from '../src/world/isledeep.js';
import { work, clearWorks, dropWorks, raiseWorks, updateWorks } from '../src/entities/bosskit.js';
import { DungeonRun } from '../src/game/dungeon.js';

// One world for the looking-only tests (making one takes a while).
let shared = null;
const world = () => (shared ||= makeGame(12345));
const run = (game, input, secs, step = 0.05) => {
  for (let t = 0; t < secs; t += step) game.update(step, input);
};
const settle = (game, style, notVillage = true) => game.world.ow.settlements.find((s) => s.style === style && (!notVillage || s.type !== 'village') && s.condition !== 'abandoned');

// ------------------------------------------------------------ the bugs
test('every town hall on every island keeps its treasury chest, villages too', () => {
  const game = world();
  let halls = 0;
  for (const s of game.world.ow.settlements) {
    const L = game.world.getLayout(s);
    if (!L.buildings.some((b) => b.type === 'townhall')) continue;
    halls++;
    assert.ok(L.treasury && L.treasury.length >= 1, `${s.name} (${s.island}, ${s.type}) has a treasury chest`);
  }
  assert.ok(halls > 10);
});

test('lava burns and sets alight whatever walks into it (not what lives in fire), and nothing wanders in', () => {
  const game = makeGame(12345);
  const input = stubInput();
  const p = game.player;
  game.loadAround(p.x, p.z, true);
  const x = p.x + 3;
  const z = p.z;
  const y = game.world.findStandY(x, z, p.y);
  game.world.setBlock(x, y, z, B.lava);
  game.world.setBlock(x + 2, y, z, B.lava);
  const deer = new Creature(game, 'deer', x, y, z);
  game.addCreature(deer);
  // (Knocked in and dazed, so it can't just bolt straight out.)
  deer.stunT = 3;
  const crab = new Creature(game, 'magma_crab', x + 2, y, z);
  game.addCreature(crab);
  const hp = deer.hp;
  run(game, input, 1);
  assert.ok(deer.dead || deer.hp < hp, 'the deer is burned');
  assert.ok(deer.dead || deer.burnT > 0, 'and set alight');
  assert.equal(crab.hp, crab.maxHp, 'a magma crab is at home in it');
  // (Nothing steps into it of its own accord.)
  const boar = new Creature(game, 'boar', x - 1, y, z);
  game.addCreature(boar);
  assert.equal(boar.tryStep(x, z, 0.3), false, 'a beast won\'t step into lava');
});

// ------------------------------------------------------------ talk
test('anyone can be asked about the islands, the storm and the way to places', () => {
  const game = world();
  assert.equal(compass(0, 0, 10, 0), 'east');
  assert.ok(howFar(20).length && howFar(2000).length && howFar(20) !== howFar(2000));
  const s = game.world.ow.settlements.find((q) => q.name === 'Redford');
  const L = game.world.getLayout(s);
  const rec = L.npcs.find((r) => r.age === 'adult');
  const npc = { rec, x: L.plaza.cx, z: L.plaza.cz, y: 6, layout: L, settlement: s };
  const menu = geoMenu(npc, game);
  assert.ok(menu.length >= 4, 'a handful of things to ask');
  const lines = menu.map((o) => geoTalk(npc, game, o.arg ?? o.id ?? o)).filter(Boolean).map((r) => (typeof r === 'string' ? r : r.text || r.line || JSON.stringify(r)));
  assert.ok(lines.some((l) => /Kharos|Myrrow/.test(l)), 'the other islands are named');
  assert.ok(lines.some((l) => /storm|Wall/i.test(l)), 'and the storm');
});

// ------------------------------------------------------------ culture
test('each people passes its own laws, and keeps its own festival', () => {
  assert.ok(lawFits({ style: 'ember' }, 'fireTithe') && !lawFits({ style: 'vale' }, 'fireTithe'));
  assert.ok(lawFits({ style: 'mist' }, 'lanternLaw') && !lawFits({ style: 'tide' }, 'lanternLaw'));
  assert.ok(lawFits({ style: 'tide' }, 'catchShare') && lawFits({ style: 'north' }, 'horseLaw'));
  assert.ok(Object.keys(LAWS).includes('raftDues') && Object.keys(LAWS).includes('sporeLaw') && Object.keys(LAWS).includes('blackGlass'));
  const rng = new RNG(5);
  let tithes = 0;
  for (let i = 0; i < 40; i++) if (foundingLaws({ style: 'ember', type: 'town' }, rng).fireTithe) tithes++;
  assert.ok(tithes > 20, 'most Ashborn towns tithe to the mountain');
  assert.equal(riteOf({ style: 'ember' }), 'vigil');
  assert.equal(riteOf({ style: 'mist' }), 'lanterns');
  assert.equal(riteOf({ style: 'tide' }), 'tidefeast');
  assert.ok(RITES.vigil && RITES.lanterns && RITES.tidefeast);
});

test('the far islands dress their own way, and build their own roofs', () => {
  const game = world();
  for (const [style, outfit, roofs] of [['ember', 'ashwrap', [B.kiln_tile, B.copper_roof, B.ash_brazier]], ['mist', 'mistcloak', [B.roof_mushroom, B.roof_moss]], ['tide', 'tidewrap', [B.roof_reed]]]) {
    const s = settle(game, style);
    const L = game.world.getLayout(s);
    const adults = L.npcs.filter((r) => r.age === 'adult' && r.look);
    const dressed = adults.filter((r) => r.look.outfit === outfit || r.look.outfit.startsWith('robe') || r.look.gear);
    assert.ok(dressed.length >= adults.length * 0.6, `${s.name}: ${outfit} worn (${dressed.length}/${adults.length})`);
    game.loadAround(L.plaza.cx, L.plaza.cz, true);
    const b = s.bounds;
    let n = 0;
    for (let z = b.z0; z <= b.z1; z++) for (let x = b.x0; x <= b.x1; x++) for (let y = 6; y < 16; y++) if (roofs.includes(game.world.getBlock(x, y, z))) n++;
    assert.ok(n > 10, `${s.name}: its own roofs (${n})`);
  }
});

// ------------------------------------------------------------ trees and trades
test('each island learns from its own tree, steps dropped and added', () => {
  const k = treeOf('kharos');
  const m = treeOf('myrrow');
  const t = treeOf('thessa');
  assert.ok(k.techs.magma_forges && k.techs.glassblowing && !k.techs.cavalry);
  assert.ok(m.techs.pearl_diving && m.techs.bog_venom && !m.techs.catapults);
  assert.ok(t.techs.windmills && t.techs.horse_archers && !t.techs.crossbows);
  // (Every step reachable, nothing asking for a step its tree doesn't have.)
  for (const tr of [k, m, t]) for (const id of tr.ids) for (const r of tr.techs[id].req.flat()) assert.ok(tr.techs[r], `${id} needs ${r}`);
});

test('each people has its own trade and building, at work in its towns', () => {
  const game = world();
  assert.equal(tradeOfStyle('vale'), 'miller');
  assert.equal(tradeOfStyle('ember'), 'glassblower');
  assert.equal(tradeOfStyle('mist'), 'sporewright');
  assert.equal(tradeOfStyle('tide'), 'pearldiver');
  for (const style of ['vale', 'ember', 'mist', 'tide']) {
    const s = settle(game, style);
    const L = game.world.getLayout(s);
    const job = tradeOfStyle(style);
    assert.ok(L.buildings.some((b) => b.type === ISLE_TRADES[job].building), `${s.name} has its ${ISLE_TRADES[job].building}`);
    assert.ok(L.npcs.some((r) => r.job === job), `and its ${job}`);
  }
  assert.ok(TRADE_BUILDINGS.has('glassworks') && TRADE_BUILDINGS.has('windmill'));
  assert.equal(tradePrice(null, 'bread', false), 1);
});

// ------------------------------------------------------------ music
test('each island plays its own music, in town, out on its land, and in a fight', () => {
  const game = world();
  const input = stubInput();
  game.minute = 12 * 60;
  const go = (x, z) => {
    game.loadAround(x, z, true);
    const y = game.world.findStandY(x, z, 6);
    game.player.teleport(x, y > 0 ? y : 6, z);
    game.updateSettlements?.(true);
    run(game, input, 1.5, 0.1);
  };
  const s = settle(game, 'ember');
  const L = game.world.getLayout(s);
  go(L.plaza.cx, L.plaza.cz + 2);
  assert.match(musicMood(game), /^ashborn_/);
  const t = settle(game, 'tide');
  const M = game.world.getLayout(t);
  go(M.plaza.cx, M.plaza.cz + 2);
  assert.match(musicMood(game), /^stilt_/);
  for (const k of ['dungeon_grove', 'dungeon_forge', 'dungeon_grotto']) assert.ok(THEMES[k] && THEMES[k].own && THEMES[`${k}_boss`] && THEMES[`${k}_fight`], k);
});

// ------------------------------------------------------------ the night
test('the far islands\' nights bring their own monsters, each fighting its own way', () => {
  const game = world();
  const seen = new Set();
  for (let i = 0; i < 400; i++) {
    seen.add(isleNightSpecies(game, 'kharos', 0, 0));
    seen.add(isleNightSpecies(game, 'myrrow', 0, 0));
  }
  for (const k of ['ash_wraith', 'magma_slug', 'glasshide', 'lantern_thief', 'spore_puffer']) {
    assert.ok(seen.has(k), `${k} comes out`);
    assert.ok(SPECIES[k].night && BRAINS[SPECIES[k].brain], `${k} has its brain`);
  }
  assert.ok(SPECIES.glasshide.glancing, 'arrows glance off a glasshide');
});

test('a lantern thief snatches your lantern and runs; kill it and you get it back', () => {
  const game = makeGame(12345);
  const input = stubInput();
  game.minute = 23 * 60;
  const s = settle(game, 'mist');
  const x0 = s.bounds.x1 + 20;
  const z0 = s.bounds.z1 + 6;
  game.loadAround(x0, z0, true);
  const p = game.player;
  p.teleport(x0, game.world.findStandY(x0, z0, 6), z0);
  p.equip.shield = 'lantern';
  const c = new Creature(game, 'lantern_thief', x0 + 4, game.world.findStandY(x0 + 4, z0, p.y), z0);
  game.addCreature(c);
  for (let i = 0; i < 200 && !c.loot; i++) {
    p.hp = p.maxHp;
    game.update(0.05, input);
  }
  assert.ok(c.loot && c.loot.item === 'lantern', 'it took the lantern');
  assert.notEqual(p.equip.shield, 'lantern');
  const n = game.drops.length;
  game.damage(c, 99, p);
  run(game, input, 0.3);
  assert.ok(game.drops.slice(n).some((d) => d.item === 'lantern'), 'and drops it as it dies');
});

// ------------------------------------------------------------ the deep
test('each island has its own kind of old place, and makes the usual kinds its own way', () => {
  const game = world();
  const sites = game.world.sites;
  for (const [isle, own] of Object.entries(OWN_TYPE)) assert.ok(sites.some((s) => s.island === isle && s.type === own), `${isle} has a ${own}`);
  // (Its rec knows its island; its kind's look is the island's.)
  const D = game.sim.dungeons.all;
  assert.ok(D.every((d) => d.isle));
  assert.equal(dtypeOf({ type: 'crypt', isle: 'kharos' }).name, 'Glass Crypt');
  assert.equal(dtypeOf({ type: 'crypt', isle: 'kharos' }).wall, B.basalt_bricks);
  assert.equal(dtypeOf({ type: 'barrow', isle: 'myrrow' }).name, 'Bog Barrow');
  assert.equal(dtypeOf({ type: 'crypt', isle: 'thessa' }), DTYPES.crypt, 'Thessa\'s as they always were');
  for (const k of ['grove', 'forge', 'grotto']) assert.ok(D.find((d) => d.type === k).name.length > 5, `a ${k} has a name`);
});

test('every island\'s masters are its own: three to a kind, none shared, all with brains and art', async () => {
  const { hasFigure } = await import('../src/render/bossfigs.js');
  const { beastOf } = await import('../src/render/bossbeasts.js');
  const all = [];
  for (const kinds of Object.values(ISLE_BOSSES)) for (const list of Object.values(kinds)) {
    assert.equal(list.length, 3);
    all.push(...list);
  }
  for (const T of Object.values(ISLE_DTYPES)) {
    assert.equal(T.bosses.length, 3);
    all.push(...T.bosses);
  }
  assert.equal(new Set(all).size, all.length, 'no master met on two islands');
  assert.equal(all.length, 33);
  const thessa = ['barrow_king', 'mound_witch', 'worm', 'foreman', 'brood_mother', 'priest', 'horror', 'hollow_saint', 'warlord', 'twins', 'poisoner'];
  for (const k of all) {
    const S = SPECIES[k];
    assert.ok(S && S.boss && BRAINS[S.brain], `${k} is a master with a brain`);
    assert.ok(!thessa.includes(k));
    assert.ok(S.humanoid ? S.look && hasFigure(k) : beastOf(k), `${k} is drawn`);
  }
  // (The far islands' harder.)
  assert.ok(ISLE_BOSS_HP.kharos > 1 && ISLE_BOSS_HP.myrrow > 1 && !ISLE_BOSS_HP.thessa);
});

test('every kind of old place on every island builds, with its own master in its hall', () => {
  for (const isle of ['thessa', 'kharos', 'myrrow']) {
    for (const type of ['barrow', 'mine', 'crypt', 'holdout', 'grove', 'forge', 'grotto']) {
      const rec = { id: 990, type, isle, seed: 4242, depth: 2, level: 3, vaultFloor: 0 };
      for (let n = 0; n < 2; n++) {
        const out = buildFloor(rec, n);
        for (const s of out.spawns) assert.ok(SPECIES[s.species], `${isle} ${type}: ${s.species}`);
        if (n === 1) {
          const boss = out.spawns.find((s) => s.boss);
          assert.ok(boss && dtypeOf(rec).bosses.includes(boss.species), `${isle} ${type} ruled by ${boss && boss.species}`);
        }
      }
    }
  }
  assert.ok(ISLE_DSTYLE.kharos.crypt.pool === B.lava, 'a Kharos crypt floods with lava');
});

test('a master\'s works on its hall are put back when it falls, and never saved', () => {
  const game = makeGame(12345);
  const base = game.sim.dungeons.all.find((d) => d.type !== 'kavorent');
  const rec = { ...base, type: 'forge', isle: 'kharos', floors: {}, cleared: false, depth: 1 };
  new DungeonRun(game, rec).enter();
  const d = game.dungeon;
  const br = d.data.bossRoom;
  const cx = Math.round((br.x0 + br.x1) / 2);
  const cz = Math.round((br.z0 + br.z1) / 2);
  const c = d.spawn('kiln_king', cx, FY, cz, { boss: true });
  let x = cx + 3;
  while (game.world.getBlock(x, FY, cz) !== B.air) x--;
  assert.ok(work(game, x, FY, cz, B.lava, 0, c));
  assert.equal(game.world.getBlock(x, FY, cz), B.lava);
  dropWorks(game);
  assert.equal(game.world.getBlock(x, FY, cz), B.air, 'not in a save');
  raiseWorks(game);
  assert.equal(game.world.getBlock(x, FY, cz), B.lava);
  // (Solid works never on anyone.)
  assert.equal(work(game, game.player.x, game.player.y, game.player.z, B.obsidian, 0, c), false);
  c.dead = true;
  updateWorks(game, 0.1);
  assert.equal(game.world.getBlock(x, FY, cz), B.air, 'put back when it falls');
  clearWorks(game);
  d.leave();
});

test('the island masters fight: every one uses its powers, and those that keep their halls change them', () => {
  const game = makeGame(12345);
  const input = stubInput();
  game.cheats = { ...(game.cheats || {}), god: true };
  const p = game.player;
  const base = game.sim.dungeons.all.find((d) => d.type !== 'kavorent');
  // (A few of each island's that keep their halls (see round35 for the
  // rest, which have their own ways instead): one that floods, one that
  // grows briars, one that lets lava in.)
  const typeOf = (sp) => {
    for (const kinds of Object.values(ISLE_BOSSES)) for (const [t, list] of Object.entries(kinds)) if (list.includes(sp)) return t;
    return Object.entries(ISLE_DTYPES).find(([, T]) => T.bosses.includes(sp))[0];
  };
  for (const [sp, isle, kind] of [['lamprey_queen', 'myrrow', B.water], ['thorn_queen', 'thessa', B.briar], ['magma_tender', 'kharos', B.lava]]) {
    const type = typeOf(sp);
    new DungeonRun(game, { ...base, type, isle, floors: {}, cleared: false, depth: 1 }).enter();
    const d = game.dungeon;
    const br = d.data.bossRoom;
    for (const q of game.creatures) if (q.isBoss || q.leash) q.dead = true;
    const cx = Math.round((br.x0 + br.x1) / 2);
    const cz = Math.round((br.z0 + br.z1) / 2);
    const c = d.spawn(sp, cx, FY, cz, { boss: true });
    c.leash = br;
    const s = game.findFreeSpot(cx, cz + 4, FY);
    p.teleport(s.x, s.y, s.z);
    d.bossFight();
    game.scene = null;
    let made = 0;
    for (let t = 0; t < 40 && !c.dead; t += 0.05) {
      // (Worn down into its later phases as the fight goes on.)
      if (t > 13 && t < 13.06) c.hp = Math.floor(c.maxHp * 0.6);
      if (t > 26 && t < 26.06) c.hp = Math.floor(c.maxHp * 0.3);
      p.hp = p.maxHp;
      game.update(0.05, input);
      made = Math.max(made, (game.works || []).filter((w) => w.id === kind).length);
    }
    assert.ok(made > 0, `${sp} changed its hall`);
    assert.ok((c.casts || 0) >= 5, `${sp} used its powers (${c.casts})`);
    c.dead = true;
    run(game, input, 0.2);
    assert.equal((game.works || []).length, 0, `${sp}'s works put back`);
    d.leave();
  }
});

test('adventurers leave the far islands\' old places to you a good while', () => {
  const game = world();
  const D = game.sim.dungeons;
  const far = D.all.find((d) => d.isle === 'kharos' && d.type !== 'kavorent');
  const home = D.all.find((d) => d.isle === 'thessa' && d.type !== 'kavorent');
  // (Earlier tests on this world may have set foot on Kharos.)
  delete D.isleFirst.kharos;
  assert.ok(D.openToDelvers(home, 13 * DAY));
  assert.ok(!D.openToDelvers(far, 13 * DAY) && !D.openToDelvers(far, (FAR_DELVE_DAY + 5) * DAY), 'not while you\'ve not been');
  D.isleFirst.kharos = FAR_DELVE_DAY;
  assert.ok(!D.openToDelvers(far, (FAR_DELVE_DAY + 3) * DAY), 'nor just after you get there');
  assert.ok(D.openToDelvers(far, (FAR_DELVE_DAY + 12) * DAY));
  const saved = D.serialize();
  D.isleFirst = {};
  D.load(saved);
  assert.equal(D.isleFirst.kharos, FAR_DELVE_DAY, 'remembered in a save');
  delete D.isleFirst.kharos;
  assert.ok(BLOCKS[B.forge_door].interact === 'dungeon' && BLOCKS[B.grotto_mouth].interact === 'dungeon' && BLOCKS[B.hollow_door].interact === 'dungeon');
});
