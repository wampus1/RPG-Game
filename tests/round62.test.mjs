// Round 62: mods. The mod file itself (made, packed, hashed, sent and
// taken back in), the library that keeps them (and the very versions
// worlds were made with), entities as graphs put into the game (blocks,
// items, creatures, events) and taken out again, structures built into a
// world with their chests, triggers and spawners, a mod's own dungeon,
// stories told by the game's own story engine (and changes to the game's
// stories), rigs baked into creatures that walk, strike and flinch,
// effects played, the console's mod commands, and the step that brings a
// world from 0.61 up to 0.62.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGame, stubInput } from './helpers.mjs';
import { newMod, newAsset, normalizeMod, exportMod, importMod, modHash, freeId, encodeCel, decodeCel, countThings } from '../src/mod/format.js';
import { makeNode, emptyGraph, lint } from '../src/mod/graph.js';
import '../src/mod/nodes.js';
import { installMods, uninstallMods, MODS } from '../src/mod/registry.js';
import { ModLibrary } from '../src/mod/library.js';
import { bpEncode, bpDecode, bpAt, bpCells } from '../src/mod/build.js';
import { RigPose, quickRig, autoAnims } from '../src/mod/rig.js';
import { VfxPlayer, newLayer, newEffect, EMITTER_PRESETS, trackAt } from '../src/mod/vfx.js';
import { compileStory } from '../src/mod/storyrun.js';
import { MOTIFS, R } from '../src/sim/saga/core.js';
import { runCommand } from '../src/game/commands.js';
import { ITEMS } from '../src/world/items.js';
import { B, BLOCKS } from '../src/world/blocks.js';
import { SPECIES } from '../src/entities/creature.js';
import { STEPS, migrateSave } from '../src/game/migrate.js';
import { GAME_VERSION, compareVersions } from '../src/version.js';

const L = (a, ap, b, bp = 'in') => ({ id: `${a.id}${ap}${b.id}${bp}`, from: [a.id, ap], to: [b.id, bp] });
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

// A mod with a bit of everything.
function bigMod() {
  const m = newMod({ name: 'Test Mod', author: 'Tester' });
  const a = newAsset({ name: 'Rune', w: 16, h: 16 });
  const idx = new Uint8Array(256);
  for (let i = 0; i < 256; i++) idx[i] = (i % 5) ? 30 : 24;
  a.frames[0].cels.l1 = encodeCel(idx);
  a.id = 'rune';
  m.assets.rune = a;
  m.entities.runestone = { id: 'runestone', name: 'Rune Stone', graph: graph([makeNode('tpl.block', 0, 0, { v: { name: 'Rune Stone', texture: 'rune' } })]) };
  const food = makeNode('tpl.food', 0, 0, { v: { name: 'Glowberry', heal: 3 } });
  const msg = makeNode('act.message', 300, 0, { v: { text: 'You glow, {player}!' } });
  m.entities.berry = { id: 'berry', name: 'Glowberry', graph: graph([food, msg], [L(food, 'onUse', msg)]) };
  m.entities.imp = { id: 'imp', name: 'Imp', graph: graph([makeNode('tpl.hostile', 0, 0, { v: { name: 'Imp', hp: 20, damage: 2 } })]) };
  return m;
}

// A structure: a 7x7 hut, a chest with loot, a trigger by the door.
function hut(m) {
  const st = { id: 'hut', name: 'Hut', w: 7, d: 7, h: 6, ground: 1, pal: ['keep', 'planks', 'stone_bricks', 'chest', 'air'], marks: [], place: { where: 'wild', biomes: [], count: 3, isle: 'any' } };
  const n = st.w * st.d * st.h;
  const idx = new Uint8Array(n);
  for (let z = 0; z < 7; z++) for (let x = 0; x < 7; x++) {
    idx[bpAt(st, x, 1, z)] = 1;
    for (let y = 2; y < 5; y++) if (x === 0 || z === 0 || x === 6 || z === 6) idx[bpAt(st, x, y, z)] = 2;
  }
  idx[bpAt(st, 3, 2, 6)] = 4;
  idx[bpAt(st, 3, 2, 3)] = 3;
  st.marks.push({ id: 'c1', type: 'chest', x: 3, y: 2, z: 3, loot: 'treasure' }, { id: 't1', type: 'trigger', x: 3, y: 2, z: 5, r: 2, message: 'You step into the hut.', once: true });
  bpEncode(st, idx, new Uint8Array(n));
  m.structures.hut = st;
  m.loot.treasure = { id: 'treasure', name: 'Treasure', rolls: [2, 2], entries: [{ item: 'gold_ingot', w: 1, min: 1, max: 1 }], always: [{ item: 'coin', min: 5, max: 5, chance: 100 }] };
  return st;
}

test('a mod file: made whole, packed, hashed, and taken back in the same', () => {
  const m = bigMod();
  normalizeMod(m);
  assert.match(m.id, /^[a-z][a-z0-9]{3,31}$/);
  const text = exportMod(m);
  const back = importMod(text);
  assert.equal(back.hash, modHash(m));
  assert.equal(countThings(back), countThings(m));
  // (Saved again later: the same hash, whatever its time.)
  back.updated = Date.now() + 5000;
  assert.equal(modHash(back), modHash(m));
  // Ids never clash across its collections.
  assert.notEqual(freeId(m, 'structures', 'rune'), 'rune');
  // Pixels packed and unpacked.
  const cel = new Uint8Array(100).map((_, i) => (i * 7) % 5);
  assert.deepEqual([...decodeCel(encodeCel(cel), 100)], [...cel]);
});

test('the library keeps mods, and the exact versions worlds were made with', async () => {
  const lib = new ModLibrary(null, null);
  const m = bigMod();
  await lib.put(m, { mine: true });
  assert.ok(lib.has(m.id));
  const v1 = (await lib.get(m.id)).hash;
  await lib.putPack(await lib.get(m.id));
  // Changed after: the old version's still there for its worlds.
  const cur = await lib.get(m.id);
  cur.name = 'Test Mod 2';
  await lib.put(cur);
  const res = await lib.resolve([{ id: m.id, hash: v1, name: 'Test Mod', version: '1.0.0' }]);
  assert.equal(res[0].mod.name, 'Test Mod');
  assert.equal(res[0].newer.name, 'Test Mod 2');
  assert.equal(res[0].missing, false);
  // Someone else's version of a mod by the same id never overwrites yours.
  const theirs = importMod(exportMod({ ...JSON.parse(exportMod(cur)), name: 'Their Mod' }));
  await lib.addPack(exportMod(theirs), { from: 'Friend' });
  assert.equal((await lib.get(m.id)).name, 'Test Mod 2');
  assert.ok(lib.hasPack(modHash(theirs)));
  const gone = await lib.resolve([{ id: 'nothere', hash: 'zz', name: 'Gone' }]);
  assert.equal(gone[0].missing, true);
});

test('entities go into the game, and come out again', () => {
  const m = bigMod();
  normalizeMod(m);
  const vanilla = BLOCKS.length;
  const res = quiet(() => installMods([m]));
  const blockKey = `m:${m.id}:runestone`;
  assert.ok(B[blockKey] >= vanilla, 'a block of its own, past the game\'s');
  assert.ok(ITEMS[`m:${m.id}:berry`]);
  assert.ok(ITEMS[blockKey], 'its block as an item too');
  assert.ok(SPECIES[`m:${m.id}:imp`]);
  // (Its block keeps its number, the next time, by the world's map.)
  const id1 = B[blockKey];
  uninstallMods();
  assert.equal(ITEMS[`m:${m.id}:berry`], undefined);
  assert.equal(SPECIES[`m:${m.id}:imp`], undefined);
  assert.equal(B[blockKey], undefined);
  quiet(() => installMods([m], { blockIds: res.blockIds }));
  assert.equal(B[blockKey], id1);
  uninstallMods();
  // A loop with no wait in it is found.
  const a = makeNode('flow.seq', 0, 0);
  const b = makeNode('act.message', 0, 0);
  const g = { ...emptyGraph(), nodes: [a, b], links: [L(a, 'a', b), L(b, 'then', a)] };
  assert.ok(lint(g).some((q) => /loop/.test(q.text)));
});

test('a modded consumable does what its graph says', () => {
  const m = bigMod();
  normalizeMod(m);
  quiet(() => installMods([m]));
  try {
    const game = makeGame();
    const p = game.player;
    p.inv[p.selected] = { item: `m:${m.id}:berry`, count: 2 };
    p.hp = 5;
    game.eat();
    assert.ok(game.ui.msgs.some((x) => /You glow/.test(x)));
    assert.ok(p.hp > 5);
  } finally {
    uninstallMods();
  }
});

test('structures are built into the world, chests filled from their loot', () => {
  const m = bigMod();
  const st = hut(m);
  normalizeMod(m);
  const { idx } = bpDecode(st);
  assert.equal(idx[bpAt(st, 0, 2, 0)], 2);
  assert.ok(bpCells(m, st).length > 50);
  quiet(() => installMods([m]));
  try {
    const game = makeGame();
    const sites = game.world.sites.filter((s) => s.mod === m.id && s.thing === 'hut');
    assert.ok(sites.length >= 1, 'placed in the world');
    const s = sites[0];
    game.loadAround(s.x, s.z, true);
    const w = game.world;
    const x0 = s.x + s.ox;
    const z0 = s.z + s.oz;
    assert.equal(BLOCKS[w.getBlock(x0 + 1, s.h, z0 + 1)].name, 'planks');
    assert.equal(BLOCKS[w.getBlock(x0, s.h + 1, z0)].name, 'stone_bricks');
    assert.equal(BLOCKS[w.getBlock(x0 + 3, s.h + 1, z0 + 3)].name, 'chest');
    const slots = w.getContainer(x0 + 3, s.h + 1, z0 + 3).filter(Boolean);
    assert.ok(slots.some((q) => q.item === 'gold_ingot'));
    assert.ok(slots.some((q) => q.item === 'coin'));
    // Its trigger, stepped into.
    game.teleportPlayer(x0 + 3, s.h + 1, z0 + 5);
    const input = stubInput();
    for (let i = 0; i < 12; i++) game.update(0.1, input);
    assert.ok(game.ui.msgs.some((x) => /step into the hut/.test(x)));
    // And the console puts it right here too.
    game.cheats = { console: true };
    const out = runCommand(game, 'mod place hut');
    assert.match(out[0], /built/);
    assert.match(runCommand(game, 'mod list')[0], /Test Mod/);
    assert.match(runCommand(game, 'mod give glowberry 3')[0], /3 Glowberry/);
  } finally {
    uninstallMods();
  }
});

test('a mod\'s dungeon: a way in, its floors, a master at the bottom', () => {
  const m = bigMod();
  const ent = { id: 'gate', name: 'Gate', w: 5, d: 5, h: 4, ground: 1, pal: ['keep', 'cobblestone'], marks: [{ id: 'e', type: 'entry', x: 2, y: 1, z: 2 }], place: { where: 'nowhere', count: 0 } };
  const i2 = new Uint8Array(100);
  for (let z = 0; z < 5; z++) for (let x = 0; x < 5; x++) i2[bpAt(ent, x, 1, z)] = 1;
  bpEncode(ent, i2, new Uint8Array(100));
  m.structures.gate = ent;
  const floor = (id) => {
    const f = { id, name: id, w: 18, d: 12, h: 4, ground: 1, pal: ['keep', 'stone_bricks'], marks: [{ id: 'u', type: 'up', x: 2, y: 1, z: 2, rot: 0 }], place: { count: 0 } };
    const n = 18 * 12 * 4;
    const i3 = new Uint8Array(n);
    for (let z = 0; z < 12; z++) for (let x = 0; x < 18; x++) if (x === 0 || z === 0 || x === 17 || z === 11) i3[bpAt(f, x, 1, z)] = 1;
    bpEncode(f, i3, new Uint8Array(n));
    return f;
  };
  m.structures.f1 = floor('f1');
  m.structures.f2 = floor('f2');
  m.dungeons.deep = { id: 'deep', name: 'the Deep Hall', entrance: 'gate', floors: ['f1', 'f2'], boss: 'ghoul', place: { biomes: [], count: 1, isle: 'any' } };
  normalizeMod(m);
  quiet(() => installMods([m]));
  try {
    const game = makeGame();
    const rec = game.sim.dungeons.all.find((d) => d.mod === m.id);
    assert.ok(rec, 'a record of it, with the game\'s');
    assert.equal(rec.depth, 2);
    const fl = MODS.buildFloor(rec, 1);
    assert.ok(fl.spawns.some((q) => q.boss && q.species === 'ghoul'), 'its master, as far from the stairs as can be');
    assert.ok(fl.up);
  } finally {
    uninstallMods();
  }
});

test('a mod\'s story is told by the game\'s story engine', () => {
  const m = bigMod();
  const N = (type, p, id) => makeNode(type, 0, 0, { p, id });
  const s = N('st.start', { title: 'Bread for {giver}', when: 'now and then', chance: 100, where: 'any town', giver: 'someone grown', other: 'someone grown', perTown: true, max: 3 }, 's');
  const t = N('st.task', { kind: 'bring things', title: 'Bring {giver} {count} {item}', item: 'bread', count: 2, coins: 10 }, 't');
  const k = N('st.talk', { who: 'other', ask: 'Hello?', text: '{giver} owes me!', a: 'Pay up', b: 'Leave' }, 'k');
  const e1 = N('st.end', { outcome: 'paid', text: 'All square.' }, 'e1');
  const e2 = N('st.end', { outcome: 'walked', text: 'Off they went.' }, 'e2');
  m.stories.bread = { id: 'bread', name: 'Bread', graph: graph([s, t, k, e1, e2], [L(s, 'begin', t), L(t, 'done', k), L(k, 'a', e1), L(k, 'b', e2)]) };
  normalizeMod(m);
  assert.ok(compileStory(m, m.stories.bread));
  quiet(() => installMods([m]));
  try {
    const mid = `m:${m.id}:bread`;
    assert.ok(MOTIFS[mid]);
    const game = makeGame();
    const S = game.sim.saga;
    S.start();
    for (let d = 1; d <= 3; d++) S.daily(d);
    const th = S.threads.find((q) => q.m === mid);
    assert.ok(th, 'begun in a town');
    const task = th.tasks[0];
    assert.equal(task.kind, 'fetch');
    assert.equal(task.item, 'bread');
    const pid = S.players()[0].pid;
    S.accept(task, R.pl(pid));
    S.complete(task, R.pl(pid));
    assert.equal(th.node, 'k');
    const npc = { rec: { idx: th.cast.other.idx, sid: th.cast.other.sid } };
    const topics = MOTIFS[mid].townTalk(th, npc, pid, S);
    assert.equal(topics.length, 1);
    const said = MOTIFS[mid].respond(th, npc, pid, 'sg_mod', topics[0].arg, S);
    assert.equal(said.choices.length, 2);
    MOTIFS[mid].respond(th, npc, pid, 'sg_modc', said.choices[1].arg, S);
    assert.equal(th.outcome, 'walked');
  } finally {
    uninstallMods();
  }
  assert.equal(MOTIFS[`m:${m.id}:bread`], undefined);
});

test('changes to the game\'s stories: off, and sent another way', () => {
  const m = bigMod();
  m.patches.p1 = { id: 'p1', name: 'No feuds', motif: 'festival', off: true };
  normalizeMod(m);
  const scan = MOTIFS.festival.scan;
  quiet(() => installMods([m]));
  assert.equal(MOTIFS.festival.scan, null);
  uninstallMods();
  assert.equal(MOTIFS.festival.scan, scan);
  // A turn from planning to the feast, always ended there instead.
  m.patches.p1 = { id: 'p1', name: 'Rained off', motif: 'festival', turns: [{ from: 'planning', to: 'feast', chance: 100, instead: '=rained' }], arrive: [] };
  quiet(() => installMods([m]));
  try {
    const game = makeGame();
    const S = game.sim.saga;
    S.start();
    const L0 = [...game.world.layouts.values()].find((q) => q.econ && q.settlement);
    const th = S.begin('festival', { cast: { town: R.town(L0.settlement.id) }, sid: L0.settlement.id, vars: { name: 'the Test Fair' } });
    if (th && !th.done) {
      S.go(th, 'feast');
      assert.equal(th.outcome, 'rained');
    }
  } finally {
    uninstallMods();
  }
});

test('a rig: cut up, posed, and baked into a creature that walks, strikes and flinches', () => {
  const w = 12;
  const h = 16;
  const rgba = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const on = (y < 5 && x >= 4 && x < 8) || (y >= 5 && y < 11 && x >= 2 && x < 10) || (y >= 11 && (x === 4 || x === 5 || x === 7 || x === 8));
    if (on) rgba.set([200, 120, 60, 255], (y * w + x) * 4);
  }
  const rig = quickRig('walker', { rgba, w, h });
  assert.ok(rig.bones.length >= 5 && rig.parts.length >= 4);
  assert.deepEqual(Object.keys(rig.anims).sort(), ['attack', 'hurt', 'idle', 'walk']);
  const pose = new RigPose(rig, { rgba, w, h });
  const b = pose.bake('walk', 6);
  assert.equal(b.frames.length, 6);
  assert.notDeepEqual([...b.frames[0]], [...b.frames[2]], 'it moves');
  // In the game: its look, in groups.
  const m = newMod({ name: 'Rigs' });
  const a = newAsset({ name: 'Body', w, h });
  m.assets.body = a;
  const look = MODS.rigLook(m, { ...rig, asset: 'body' }, false);
  assert.ok(look.groups.walk && look.groups.attack && look.groups.hurt);
  assert.equal(look.frames, 22);
  assert.ok(Object.keys(autoAnims({ ...rig, anims: {} }, 'idle')).includes('idle'));
});

test('effects: particles, keyframes and simulated motion, the same every time', () => {
  const fx = newEffect({ dur: 1, loop: false, layers: [newLayer('emitter', { ...EMITTER_PRESETS.sparks, id: 'e1' }), newLayer('sprite', { id: 's1', anim: { ...newLayer('sprite').anim, bob: 3, bobHz: 1 }, keys: { scale: [{ t: 0, v: 1 }, { t: 1, v: 2 }] } })] });
  const p = new VfxPlayer(fx, { seed: 5 });
  p.step(0.2);
  assert.ok(p.em.get('e1').parts.length > 5, 'a burst of sparks');
  const q = new VfxPlayer(fx, { seed: 5 });
  q.seek(0.2);
  assert.equal(q.em.get('e1').parts.length, p.em.get('e1').parts.length);
  assert.equal(trackAt(fx.layers[1].keys.scale, 0.5, 1), 1.5);
  const t1 = p.spriteAt(fx.layers[1], 0.25);
  assert.ok(Math.abs(t1.y - (-8 + 3)) < 0.01, 'bobbed up and down');
  // Over, and gone.
  p.step(0.25);
  p.step(0.25);
  p.step(0.25);
  p.step(0.25);
  p.step(0.25);
  p.step(0.25);
  assert.ok(p.done);
});

test('a world from 0.61 is brought up to 0.62 (and a modded world saves its mods)', () => {
  assert.ok(STEPS.find((q) => q.to === '0.62.0'));
  assert.ok(compareVersions(GAME_VERSION, '0.62.0') >= 0);
  const d = { gv: '0.61.0', v: 99 };
  const res = migrateSave(d);
  assert.equal(d.mods, null);
  assert.ok(res.log.some((l) => /Workshop/.test(l)));
  const m = bigMod();
  normalizeMod(m);
  quiet(() => installMods([m]));
  try {
    const game = makeGame();
    const save = game.serialize();
    assert.equal(save.mods.refs[0].id, m.id);
    assert.equal(save.mods.refs[0].hash, modHash(m));
    assert.ok(Object.keys(save.mods.blockIds).length >= 1);
  } finally {
    uninstallMods();
  }
});
