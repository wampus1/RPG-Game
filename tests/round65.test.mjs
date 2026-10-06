// Round 65: the game's items (not just its blocks) to start art from, and
// person-sized art for people; what a biome's ponds hold; every trade in a
// story; towns and their people for graphs; crossing to another world map;
// Nearest and Target upgraded; finding out about anyone or anything; and
// the update.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGame, stubRenderer, stubUI } from './helpers.mjs';
import { newMod, normalizeMod, newAsset, encodeCel } from '../src/mod/format.js';
import { NODES, makeNode, shown, compile, Runner, fits } from '../src/mod/graph.js';
import { SVC } from '../src/mod/nodes.js';
import { WHO, WHO_JOBS } from '../src/mod/storynodes.js';
import { installMods, uninstallMods, MODS } from '../src/mod/registry.js';
import { compileBiome, biomeFields, LIQUIDS } from '../src/mod/biomes.js';
import { useWorldMap, chosenWorldMap, gameLands, packGrid, WN } from '../src/mod/worldplan.js';
import { TOWN_FACTS, TOWN_CHANGES, PERSON_FACTS, PERSON_CHANGES, JOB_LIST, LAW_LIST } from '../src/mod/townlists.js';
import { townFact, changeTown, personFact, changePerson } from '../src/mod/towns.js';
import { JOBS } from '../src/entities/npcgen.js';
import { LAWS } from '../src/sim/laws.js';
import { CREATURE_LOOKS } from '../src/render/sprites.js';
import { itemGroup, ITEM_GROUPS } from '../src/workshop/itemgroups.js';
import { B } from '../src/world/blocks.js';
import { Game } from '../src/game/game.js';
import { STEPS, migrateSave } from '../src/game/migrate.js';
import { GAME_VERSION, compareVersions } from '../src/version.js';

const graph = (nodes, links = []) => ({ nodes, links, notes: [] });
const quiet = (fn) => {
  const w = console.warn;
  console.warn = () => {};
  try {
    return fn();
  } finally {
    console.warn = w;
  }
};
const xOf = (game, mod) => ({ game, mod, player: game.player, self: null, vars: {}, locals: {}, steps: 0, pos: { x: game.player.x, y: game.player.y, z: game.player.z } });

// ------------------------------------------------------------ the Workshop's art
test('the game\'s items to start art from: by kind, its blocks last (they came first, and filled the list)', () => {
  assert.equal(itemGroup('iron_sword'), 'Weapons');
  assert.equal(itemGroup('iron_helmet'), 'Armour');
  assert.equal(itemGroup('bread'), 'Food & potions');
  assert.equal(itemGroup('stone'), 'Blocks');
  assert.equal(ITEM_GROUPS[ITEM_GROUPS.length - 1], 'Blocks');
});

test('a person\'s art is drawn at a person\'s height, not squeezed into a square', () => {
  const m = newMod({ name: 'People', author: 'T' });
  const a = newAsset({ name: 'Smith', w: 16, h: 30, use: 'person' });
  a.id = 'smith';
  const idx = new Uint8Array(16 * 30);
  for (let y = 2; y < 30; y++) for (let x = 5; x < 11; x++) idx[y * 16 + x] = 3;
  a.frames[0].cels.l1 = encodeCel(idx);
  m.assets.smith = a;
  m.entities.npc = { id: 'npc', name: 'Smith', graph: graph([makeNode('tpl.npc', 0, 0, { v: { name: 'Smith', look: 'smith' } })]) };
  normalizeMod(m);
  quiet(() => installMods([m]));
  try {
    const L = CREATURE_LOOKS[`m:${m.id}:npc`];
    assert.equal(L.size, 32);
    const px = L.draw(0);
    let n = 0;
    let top = 99;
    for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) if (px.d[(y * 32 + x) * 4 + 3]) {
      n++;
      top = Math.min(top, y);
    }
    assert.equal(n, 6 * 28, 'pixel for pixel');
    assert.equal(top, 32 - 28, 'feet on the ground');
  } finally {
    uninstallMods();
  }
  // (Its colours only matter without art of its own.)
  const plain = makeNode('tpl.npc');
  assert.ok(shown(plain, NODES['tpl.npc'].inMap.skin));
  plain.v.look = 'smith';
  assert.ok(!shown(plain, NODES['tpl.npc'].inMap.skin));
});

// ------------------------------------------------------------ biomes, stories
test('what a biome\'s ponds hold: water, lava, ice or mud', () => {
  const m = newMod({ name: 'Ponds', author: 'T' });
  assert.equal(biomeFields('swamp').liquid, 'water');
  assert.equal(compileBiome(m, { id: 'fen', name: 'Fen', base: 'swamp', water: 'pools', liquid: 'lava' }).liquid, B.lava);
  assert.equal(compileBiome(m, { id: 'fen', name: 'Fen', base: 'swamp', water: 'ponds', liquid: 'ice' }).liquid, B.ice);
  assert.equal(compileBiome(m, { id: 'fen', name: 'Fen', base: 'swamp', water: 'ponds', liquid: 'water' }).liquid, undefined);
  assert.deepEqual(Object.keys(LIQUIDS), ['water', 'lava', 'ice', 'mud']);
});

test('a story\'s people can be of any trade a town has', () => {
  for (const [k] of JOB_LIST) if (k !== 'mayor') assert.ok(Object.values(WHO_JOBS).some((v) => v.includes(k)), k);
  for (const w of Object.keys(WHO_JOBS)) assert.ok(WHO.includes(w));
  // (The trade lists the Workshop shows are the game's own.)
  for (const [k] of JOB_LIST) assert.ok(JOBS[k], k);
  for (const [k, nm] of LAW_LIST) assert.equal(LAWS[k].name, nm);
});

// ------------------------------------------------------------ towns
test('towns and their people: what\'s known of them, and changing them', () => {
  const game = makeGame();
  const m = newMod({ name: 'Towns', author: 'T' });
  const x = xOf(game, m);
  const t = SVC.townOf(x, game.player, 'the nearest');
  assert.ok(t && t.t === 'town' && t.name);
  assert.ok(fits('town', 'pos'), 'a town is a place too');
  for (const f of TOWN_FACTS) assert.notEqual(SVC.townFact(x, t, f), undefined, f);
  const s = game.world.ow.settlements[t.sid];
  const c0 = townFact(game, s, 'coffers');
  assert.ok(changeTown(game, s, 'coffers', { value: 50, how: 'add' }));
  assert.equal(townFact(game, s, 'coffers'), c0 + 50);
  assert.ok(changeTown(game, s, 'tax %', { value: 20, how: 'set' }));
  assert.equal(townFact(game, s, 'tax %'), 20);
  assert.ok(changeTown(game, s, 'a law', { law: 'curfew', on: true }));
  assert.match(townFact(game, s, 'laws'), /Curfew/);
  assert.ok(changeTown(game, s, 'everyone\'s mood', { value: 90, how: 'set' }));
  assert.equal(townFact(game, s, 'mood'), 90);
  assert.ok(changeTown(game, s, 'name', { text: 'Newmarket' }));
  assert.equal(SVC.townFact(x, t, 'name'), 'Newmarket');
  assert.ok(changeTown(game, s, 'wanted', { value: 2, how: 'set' }));
  assert.equal(townFact(game, s, 'wanted'), true);
  assert.ok(changeTown(game, s, 'wanted', { value: 0, how: 'set' }));
  assert.equal(townFact(game, s, 'wanted'), false);
  for (const ch of TOWN_CHANGES) assert.equal(typeof ch, 'string');
  // Someone new moves in.
  const n0 = townFact(game, s, 'people');
  const r = SVC.newcomer(x, t, { first: 'Wren', job: 'farmer' });
  assert.ok(r);
  assert.equal((r.rec || r).name.first, 'Wren');
  assert.equal(townFact(game, s, 'people'), n0 + 1);
  // About someone, and changing them.
  const one = SVC.peopleOf(x, t, 'anyone').find((q) => (q.rec || q).age === 'adult' && (q.rec || q).job !== 'guard');
  assert.ok(one);
  for (const f of PERSON_FACTS) assert.notEqual(personFact(game, one, f), undefined, f);
  assert.ok(changePerson(game, one, 'trade', { job: 'guard' }));
  assert.equal(personFact(game, one, 'trade (its key)'), 'guard');
  assert.ok(changePerson(game, one, 'coins', { value: 9, how: 'set' }));
  assert.equal(personFact(game, one, 'coins'), 9);
  assert.ok(changePerson(game, one, 'add a trait', { text: 'brave' }));
  assert.match(personFact(game, one, 'traits'), /brave/);
  for (const ch of PERSON_CHANGES) assert.equal(typeof ch, 'string');
});

// ------------------------------------------------------------ finding out
test('Nearest of anything; Target by how they stand; about anyone or anything', () => {
  const game = makeGame();
  const m = newMod({ name: 'Find', author: 'T' });
  const x = xOf(game, m);
  const p = game.player;
  // Nearest, as a graph has it.
  const nn = makeNode('q.nearest', 0, 0, { id: 'n', v: { r: 3000 }, p: { which: 'a town' } });
  const run = new Runner(compile(graph([nn])), {});
  const ev = (port) => NODES['q.nearest'].eval(x, nn, port, run.api(x, nn));
  assert.equal(ev('found'), true);
  assert.equal(ev('town').t, 'town');
  assert.ok(ev('dist') >= 0);
  assert.ok(!shown(nn, NODES['q.nearest'].outMap.out), 'a town, not someone');
  const blk = SVC.findNearest(x, x.pos, { which: 'a block', r: 12, block: game.world.getBlock(p.x, p.y - 1, p.z) === B.grass ? 'grass' : 'stone_bricks' });
  assert.ok(blk === null || (blk.pos && blk.dist >= 0));
  const s = game.findFreeSpot(p.x + 2, p.z, p.y);
  const wolf = game.spawnMonster('wolf', s.x, s.y, s.z);
  const near = SVC.findNearest(x, x.pos, { which: 'a kind of creature', r: 20, species: 'wolf', notSelf: true });
  assert.equal(near && near.ent, wolf);
  // Target: the nearest player to the wolf; who last hurt it.
  assert.equal(SVC.target(x, wolf, 'the nearest player', 12), p);
  wolf.modHurtBy = p;
  assert.equal(SVC.target(x, wolf, 'who last hurt it', 12), p);
  const tn = makeNode('ctx.target', 0, 0, { id: 't', p: { which: 'who last hurt it' } });
  const y = { ...x, self: wolf };
  const r2 = new Runner(compile(graph([tn])), {});
  assert.equal(NODES['ctx.target'].eval(y, tn, 'out', r2.api(y, tn)), p);
  assert.equal(NODES['ctx.target'].eval(y, tn, 'found', r2.api(y, tn)), true);
  // About anyone or anything.
  assert.equal(SVC.entFact(x, wolf, 'kind'), 'wolf');
  assert.equal(SVC.entFact(x, p, 'is a player'), true);
  assert.equal(SVC.playerFact(x, p, 'empty slots'), p.inv.filter((q) => !q).length);
  assert.equal(SVC.itemFact(x, 'iron_helmet', 'worn on'), 'head');
  assert.equal(SVC.blockFact(x, { x: p.x, y: p.y + 5, z: p.z }, 'air'), true);
  for (const t of ['q.entinfo', 'q.playerinfo', 'q.iteminfo', 'q.blockinfo', 'q.abilities', 'q.direction', 'q.slot', 'q.structinfo', 'q.random', 'q.townof', 'q.towninfo', 'act.towndo', 'act.newcomer', 'flow.people', 'q.person', 'act.persondo', 'act.cross', 'q.whichworld']) assert.ok(NODES[t], t);
});

// ------------------------------------------------------------ other worlds
function twoMaps() {
  const m = newMod({ name: 'Two Worlds', author: 'T' });
  const empty = () => packGrid(new Uint8Array(WN));
  m.worlds.a = { id: 'a', name: 'Home', base: 'game', lands: gameLands('game'), use: true, paint: { land: empty(), biome: empty(), legend: [], town: empty() }, places: [], realms: [], people: [] };
  m.worlds.b = { id: 'b', name: 'Elsewhere', base: 'game', lands: gameLands('game'), paint: { land: empty(), biome: empty(), legend: [], town: empty() }, places: [], realms: [], people: [] };
  normalizeMod(m);
  return m;
}

test('crossing to another world map: a world of its own, the player as they were', () => {
  const m = twoMaps();
  quiet(() => installMods([m]));
  try {
    assert.deepEqual(chosenWorldMap(), { mod: m.id, id: 'a' });
    assert.equal(MODS.world.name, 'Home');
    const game = new Game({ seed: 777, renderer: stubRenderer(), audio: null, ui: stubUI(), learned: true });
    const p = game.player;
    p.give('gold_ingot', 5);
    const x = xOf(game, m);
    // (A creature at their heel goes with them.)
    const s = game.findFreeSpot(p.x + 1, p.z, p.y);
    const pup = game.spawnMonster('wolf', s.x, s.y, s.z);
    pup.petOf = p;
    SVC.cross(x, p, 'b', null);
    const out = game.crossing;
    assert.ok(out && out.player && out.map.id === 'b');
    assert.equal(out.creatures.length, 1);
    // The other world: made from the other map, with them in it.
    assert.ok(useWorldMap(out.map));
    assert.equal(MODS.world.name, 'Elsewhere');
    const g2 = new Game({ seed: 778, renderer: stubRenderer(), audio: null, ui: stubUI(), worldMap: out.map, worldRoot: '1' });
    g2.applyArrival(out);
    const gold = g2.player.inv.filter(Boolean).filter((q) => q.item === 'gold_ingot').reduce((n, q) => n + q.count, 0);
    assert.equal(gold, p.inv.filter(Boolean).filter((q) => q.item === 'gold_ingot').reduce((n, q) => n + q.count, 0));
    assert.ok(g2.creatures.some((c) => c.species === 'wolf' && c.petOf === g2.player));
    const d = g2.serialize();
    assert.deepEqual(d.worldMap, { mod: m.id, id: 'b' });
    assert.equal(d.worldRoot, '1');
    assert.equal(SVC.worldMap({ ...x, game: g2 }).name, 'Elsewhere');
    // (Back to the world it began as: nothing to cross when you're there.)
    assert.equal(game.requestCross({ who: p, map: null }), false);
  } finally {
    uninstallMods();
  }
});

// ------------------------------------------------------------ the update
test('a world from 0.64 comes up to 0.65', () => {
  assert.ok(compareVersions(GAME_VERSION, '0.65.0') >= 0);
  assert.ok(STEPS.find((s) => s.to === '0.65.0'));
  const d = { gv: '0.64.0', v: 1, mods: null };
  const r = migrateSave(d);
  assert.ok(r.log.some((l) => /towns/.test(l)));
  assert.equal(d.worldMap, null);
  assert.equal(d.gv, GAME_VERSION);
});
