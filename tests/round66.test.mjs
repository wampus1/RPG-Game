// Round 66: the mod's home page (its bar of squares); sounds and songs in
// mods (kept small, played by nodes, effects and biomes); items made
// special by nodes (stars, stones, modifiers, numbers, a name); the game's
// rules changed by a mod; how gear looks worn and held; the land,
// containers and what's set down changed by nodes; and the update.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGame } from './helpers.mjs';
import { newMod, normalizeMod, newAsset, encodeCel, modHash, COLLECTIONS } from '../src/mod/format.js';
import { NODES, makeNode, compile, Runner } from '../src/mod/graph.js';
import { SVC, THEME_LIST, MOD_LIST, GEM_LIST, TREE_LIST } from '../src/mod/nodes.js';
import { remakeItem, modScaleDamage } from '../src/mod/hooks.js';
import { installMods, uninstallMods, MODS } from '../src/mod/registry.js';
import { compileBiome } from '../src/mod/biomes.js';
import { packClip, clipSamples, newSound, cleanSound, encodeWav, decodeWav, cut, insert, mixIn, onRange, tone, stretch, speed, pitch, EFFECTS, peak } from '../src/mod/sound.js';
import { newSong, cleanSong, notesIn, songSteps, songToMidi, midiToSong, songFile, readSongFile, INST_NAME, DRUM_NAMES } from '../src/mod/song.js';
import { rule, WORLD_RULES } from '../src/mod/rules.js';
import { heldLookOf, WORN_LOOKS } from '../src/mod/gear.js';
import { barCells } from '../src/workshop/homebar.js';
import { PATCH, DRUM } from '../src/game/synth.js';
import { THEMES, musicMood } from '../src/game/music.js';
import { Audio } from '../src/game/audio.js';
import { ITEMS, tuneKey, parseTune } from '../src/world/items.js';
import { starKey, parseStar, MODS as QMODS } from '../src/world/quality.js';
import { B, BLOCKS } from '../src/world/blocks.js';
import { TREE_BUILDERS } from '../src/world/trees.js';
import { SPECIES } from '../src/entities/creature.js';
import { drawHumanoid } from '../src/render/people.js';
import { countItem } from '../src/game/inventory.js';
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
// Zero crossings a second: a tone's pitch.
const hz = (x, rate) => {
  let n = 0;
  for (let i = 1; i < x.length; i++) if (x[i - 1] < 0 && x[i] >= 0) n++;
  return n / (x.length / rate);
};

// ------------------------------------------------------------ the home page
test('the home page\'s bar: every square shared out, and one at least for each kind there is', () => {
  const a = barCells([3, 1, 0, 6], 20);
  assert.equal(a.reduce((s, n) => s + n, 0), 20);
  assert.equal(a[2], 0, 'none of a kind: no square');
  assert.ok(a[0] >= 1 && a[1] >= 1 && a[3] > a[0]);
  const b = barCells([1, 1000], 48);
  assert.deepEqual(b, [1, 47], 'one thing among many still shows');
  assert.deepEqual(barCells([0, 0], 48), [0, 0]);
  for (const ns of [[5, 5, 5], [1, 2, 3, 4, 5, 6, 7], [100, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]]) {
    const c = barCells(ns, 48);
    assert.equal(c.reduce((s, n) => s + n, 0), 48, ns.join(','));
    assert.ok(c.every((n) => n >= 1));
  }
});

// ------------------------------------------------------------ the format
test('a mod keeps sounds, songs, gear looks and rules; one with none of them hashes as it did before', () => {
  for (const k of ['sounds', 'songs', 'gear']) assert.ok(COLLECTIONS.includes(k), k);
  const m = newMod({ name: 'Old', author: 'T' });
  normalizeMod(m);
  const before = { ...m };
  for (const k of ['sounds', 'songs', 'gear']) delete before[k];
  assert.equal(modHash(m), modHash(before), 'empty ones leave the hash be');
  m.rules = {};
  assert.equal(modHash(m), modHash(before));
  m.rules = 'all of them';
  normalizeMod(m);
  assert.equal(m.rules, undefined, 'rules that aren\'t rules are dropped');
  m.rules = { hearts: 12 };
  normalizeMod(m);
  assert.deepEqual(m.rules, { hearts: 12 });
  assert.notEqual(modHash(m), modHash(before));
});

// ------------------------------------------------------------ sounds
test('a sound kept small (four bits a sample) sounds as it did; .wav out and in', () => {
  const rate = 22050;
  const t = tone(rate, 'sine', 440, 1, 440, 0.8);
  const p = packClip(t, rate);
  assert.equal(p.n, t.length);
  assert.ok(p.data.length < t.length * 0.7, `${p.data.length} letters for ${t.length} samples`);
  const back = clipSamples({ ...p });
  let sig = 0;
  let noise = 0;
  for (let i = 0; i < t.length; i++) {
    sig += t[i] * t[i];
    noise += (t[i] - back[i]) ** 2;
  }
  assert.ok(10 * Math.log10(sig / noise) > 30, 'clean enough');
  // .wav: one channel, and two mixed to one.
  const w = decodeWav(encodeWav(t, rate));
  assert.equal(w.rate, rate);
  assert.equal(w.x.length, t.length);
  assert.ok(Math.abs(w.x[1000] - t[1000]) < 1e-3);
  const st = decodeWav(encodeWav(t, rate, new Float32Array(t.length)));
  assert.ok(Math.abs(st.x[1000] - t[1000] / 2) < 1e-3, 'two channels mixed');
  assert.equal(decodeWav(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])), null);
  // A sound read from anywhere: put right.
  const s = cleanSound({ rate: 999, data: 5, n: -3, vol: 'loud', root: 1000, loop: 'yes' });
  assert.deepEqual([s.rate, s.data, s.n, s.vol, s.root, s.loop], [22050, '', 0, 1, 96, true]);
  assert.equal(newSound({ name: 'Quiet' }).n, 0);
});

test('a sound cut, put together, mixed; its speed, length and pitch each changed on their own', () => {
  const rate = 22050;
  const x = new Float32Array([1, 2, 3, 4, 5, 6]);
  assert.deepEqual([...cut(x, 1, 3)], [1, 4, 5, 6]);
  assert.deepEqual([...insert(x, 2, new Float32Array([9, 9]))], [1, 2, 9, 9, 3, 4, 5, 6]);
  assert.deepEqual([...mixIn(x, new Float32Array([1, 1, 1]), 5, 2)], [1, 2, 3, 4, 5, 8, 2, 2]);
  assert.deepEqual([...onRange(x, 2, 4, (y) => y.map((v) => -v))], [1, 2, -3, -4, 5, 6]);
  const t = tone(rate, 'sine', 440, 1, 440, 0.8);
  // Stretched: twice as long, the same note.
  const st = stretch(t, 2, rate);
  assert.equal(st.length, t.length * 2);
  assert.ok(Math.abs(hz(st, rate) - 440) < 8, `stretched: ${hz(st, rate)} Hz`);
  // Faster: half as long, an octave up.
  const sp = speed(t, 2, rate);
  assert.equal(sp.length, t.length / 2);
  assert.ok(Math.abs(hz(sp, rate) - 880) < 12, `faster: ${hz(sp, rate)} Hz`);
  // Higher: as long, an octave up.
  const pi = pitch(t, 12, rate);
  assert.equal(pi.length, t.length);
  assert.ok(Math.abs(hz(pi, rate) - 880) < 12, `higher: ${hz(pi, rate)} Hz`);
  // Every effect gives back sound (no gaps of nonsense), none of it louder
  // than it can be but the one that's asked to be louder.
  for (const [k, [, args, fn]] of Object.entries(EFFECTS)) {
    const o = Object.fromEntries(args.map((a) => [a[0], a[5]]));
    const y = fn(t, rate, o);
    assert.ok(y.length > 0 && y.every(Number.isFinite), k);
    if (k !== 'gain' && k !== 'distort') assert.ok(peak(y) <= 1.0001, `${k}: ${peak(y)}`);
  }
});

// ------------------------------------------------------------ songs
test('a song: made, kept, out to MIDI and back with the same notes, to a file and back', () => {
  const s = newSong({ demo: true });
  const was = JSON.stringify(s);
  cleanSong(s);
  assert.equal(JSON.stringify(s), was, 'a good song stays as it is');
  const notes = (q) => notesIn(q, 0, songSteps(q)).map((e) => `${e.ci}:${e.at}:${e.len}`);
  assert.ok(notes(s).length > 50);
  const back = midiToSong(songToMidi(s), { name: 'Back' });
  assert.equal(back.bpm, s.bpm);
  assert.deepEqual(notes(back), notes(s));
  const r = readSongFile(songFile(s, null));
  assert.equal(r.song.chans.length, s.chans.length);
  assert.deepEqual(notes(r.song), notes(s));
  // Every instrument one the game can play, every drum one of its own.
  for (const k of Object.keys(INST_NAME)) assert.ok(PATCH[k], k);
  assert.deepEqual(Object.keys(DRUM_NAMES).sort(), Object.keys(DRUM).sort());
  // A song that isn't one: turned away.
  assert.throws(() => readSongFile('{"no":1}'));
});

// ------------------------------------------------------------ in the game
test('a mod\'s sounds and songs are in the game while it is; a node\'s sound is the mod\'s, played as loud and as high as it says', () => {
  const m = newMod({ name: 'Noisy', author: 'T' });
  m.sounds.chime = { ...newSound({ name: 'Chime', samples: tone(22050, 'sine', 880, 0.2) }) };
  m.songs.tune = newSong({ name: 'Tune', demo: true });
  normalizeMod(m);
  quiet(() => installMods([m]));
  const sk = `m:${m.id}:chime`;
  try {
    assert.ok(MODS.sounds.get(sk));
    assert.ok(MODS.songs.get(`m:${m.id}:tune`));
    // The game's sound player: a mod's clip, by its key.
    const played = [];
    const voiced = [];
    const gains = [];
    const ctx = {
      state: 'running',
      currentTime: 0,
      createBuffer: (ch, n, rate) => {
        const d = new Float32Array(n);
        return { n, rate, getChannelData: () => d };
      },
      createBufferSource: () => {
        const s = { playbackRate: { value: 1 }, connect: (g) => g, start: () => played.push(s) };
        return s;
      },
      createGain: () => {
        const g = { gain: { value: 1 }, connect: (d) => d };
        gains.push(g);
        return g;
      },
    };
    const au = Object.assign(Object.create(Audio.prototype), { ctx, master: {}, enabled: true, last: new Map(), listener: null });
    au.voice = (n) => voiced.push(n);
    au.play(sk, null, null, { vol: 0.5, pitch: 2 });
    assert.equal(played.length, 1);
    assert.equal(played[0].buffer.n, MODS.sounds.get(sk).v.n);
    assert.equal(played[0].playbackRate.value, 2);
    assert.equal(gains[0].gain.value, 0.5);
    au.play('coin');
    assert.deepEqual(voiced, ['coin'], 'the game\'s own, as ever');
    // A node's: the mod's sound by its '@id'.
    const game = makeGame(4242);
    const asked = [];
    game.audio = { play: (...a) => asked.push(a) };
    SVC.sound(xOf(game, m), '@chime', null, { vol: 1.5, pitch: 0.5 });
    assert.equal(asked[0][0], sk);
    assert.deepEqual(asked[0][3], { vol: 1.5, pitch: 0.5 });
  } finally {
    uninstallMods();
  }
  assert.equal(MODS.sounds.size, 0);
  assert.equal(MODS.songs.size, 0);
});

test('a biome\'s music: one of the game\'s themes or the mod\'s own song, by day and by night; a node\'s music over it, for a while', () => {
  const m = newMod({ name: 'Tunes', author: 'T' });
  m.songs.tune = newSong({ name: 'Tune', demo: true });
  m.songs.dark = newSong({ name: 'Dark', demo: true });
  m.biomes.glade = { id: 'glade', name: 'Glade', base: 'forest', music: '@tune', musicNight: 'tundra' };
  m.biomes.moor = { id: 'moor', name: 'Moor', base: 'plains', music: 'desert', musicNight: '@dark' };
  m.biomes.hush = { id: 'hush', name: 'Hush', base: 'plains', music: '@tune' };
  normalizeMod(m);
  const c = compileBiome(m, m.biomes.glade);
  assert.equal(c.song, `m:${m.id}:tune`);
  assert.equal(c.musicNight, 'tundra');
  assert.equal(compileBiome(m, { id: 'x', name: 'X', base: 'plains', music: 'nonsense!' }).song, undefined);
  for (const [k] of THEME_LIST) assert.ok(THEMES[k], k);
  quiet(() => installMods([m]));
  try {
    const at = (biome, minute, renderer = {}) => musicMood({ player: { dead: false }, npcs: [], creatures: [], minute, biomeCache: { biome: `m:${m.id}:${biome}` }, renderer, world: null, currentSettlement: null });
    assert.equal(at('glade', 600), `song:m:${m.id}:tune`);
    assert.equal(at('glade', 0), 'tundra', 'its night\'s own theme');
    assert.equal(at('moor', 600), 'desert');
    assert.equal(at('moor', 0), `song:m:${m.id}:dark`);
    assert.equal(at('hush', 0), `song:m:${m.id}:tune`, 'no night of its own: the day\'s at night too');
    // A node's music, for a while (and only while).
    assert.equal(at('moor', 600, { modMusicOn: { key: 'fight_boss', until: 0 } }), 'fight_boss');
    const r = { modMusicOn: { key: 'fight_boss', until: performance.now() / 1000 - 1 } };
    assert.equal(at('moor', 600, r), 'desert');
    assert.equal(r.modMusicOn, null);
    // Put on for a player by a node (the screen's own: see renderer.modMusic).
    const game = makeGame(4242);
    const put = [];
    game.renderer.modMusic = (k, s) => put.push([k, s]);
    const mn = makeNode('act.music', 0, 0, { id: 'mu', v: { song: 'tune', secs: 30 }, p: { what: 'song' } });
    const x = xOf(game, m);
    const run = new Runner(compile(graph([mn])), {});
    NODES['act.music'].run(x, mn, run.api(x, mn));
    assert.deepEqual(put[0], [`song:m:${m.id}:tune`, 30]);
    SVC.music(x, null, null, 0);
    assert.deepEqual(put[1], [null, 0]);
  } finally {
    uninstallMods();
  }
});

// ------------------------------------------------------------ items made special
test('an item made special by a node: its numbers and name in its key, stars and modifiers that suit it, a stone set or taken out', () => {
  const t = { damage: 3, swing: 1.25, str: 1, name: 'Ember' };
  const k = tuneKey('iron_sword', t);
  assert.match(k, /^iron_sword\^/);
  assert.deepEqual(parseTune(k.slice(k.indexOf('^') + 1)), t);
  assert.equal(tuneKey('iron_sword', { damage: 0, swing: 1 }), 'iron_sword', 'nothing changed: the piece itself');
  const d = ITEMS[k];
  const base = ITEMS.iron_sword;
  assert.equal(d.name, 'Ember');
  assert.equal(d.damage, base.damage + 3);
  assert.ok(Math.abs(d.cooldown - base.cooldown / 1.25) < 0.002);
  assert.equal(d.stats.str, ((base.stats || {}).str || 0) + 1);
  assert.equal(d.tunedFrom, 'iron_sword');
  // Stars, a stone, modifiers (a bow's left off a sword).
  const s = remakeItem('iron_sword', { stars: 3, gem: 'ruby', mods: ['keen', 'twin'] });
  const ps = parseStar(s);
  assert.equal(ps.stars, 3);
  assert.equal(ps.plain, 'iron_sword+ruby');
  assert.deepEqual(ps.mods, ['keen']);
  const game = makeGame(4242);
  const m = newMod({ name: 'Smith', author: 'T' });
  const x = xOf(game, m);
  assert.equal(SVC.itemFact(x, s, 'stars'), 3);
  assert.match(SVC.itemFact(x, s, 'modifiers'), /keen/i);
  assert.equal(SVC.itemFact(x, s, 'stone set in it'), 'ruby');
  assert.equal(SVC.itemFact(x, s, 'the plain piece'), 'iron_sword');
  // Taken apart and put together again: the stone out, the stars kept.
  const out = parseStar(remakeItem(s, { gem: 'remove' }));
  assert.equal(out.plain, 'iron_sword');
  assert.equal(out.stars, 3);
  // Stars taken down to none take their modifiers with them.
  assert.equal(remakeItem(s, { more: -5 }), 'iron_sword+ruby');
  // Tuned and starred: both kept.
  const both = remakeItem(k, { stars: 2 });
  assert.equal(parseStar(both).plain, k);
  assert.equal(ITEMS[both].name.includes('Ember'), true);
  // Every modifier on the list is one the game has, every stone one it sets.
  const all = new Set(Object.values(QMODS).flatMap((q) => Object.keys(q)));
  for (const [mk] of MOD_LIST) assert.ok(all.has(mk), mk);
  for (const [g] of GEM_LIST.slice(1)) assert.ok(ITEMS[g === 'edge' ? 'iron_sword+edge' : g === 'plating' ? 'iron_helmet+plating' : `iron_sword+${g}`], g);
  // The Item node, made special.
  const node = makeNode('ref.item', 0, 0, { id: 'it', v: { stars: 4, damage: 2 }, p: { ref: 'iron_sword', custom: true, gem: 'none', mods: [] } });
  const run = new Runner(compile(graph([node])), {});
  const got = NODES['ref.item'].eval(x, node, 'out', run.api(x, node));
  assert.equal(parseStar(got).stars, 4);
  assert.equal(ITEMS[got].damage > base.damage, true);
  // Change an item: what the player holds, changed where it is.
  const p = game.player;
  p.inv[p.selected] = { item: 'iron_sword', count: 1 };
  const now = SVC.editItem(x, p, { from: 'the main hand' }, { stars: 2, mods: ['venom'] });
  assert.equal(p.inv[p.selected].item, now);
  assert.deepEqual(parseStar(now).mods, ['venom']);
  p.equip.head = 'iron_helmet';
  const helm = SVC.editItem(x, p, { from: 'an armour slot', wear: 'head' }, { tune: { armor: 5 } });
  assert.equal(p.equip.head, helm);
  assert.ok(ITEMS[helm].armor > ITEMS.iron_helmet.armor);
  assert.equal(SVC.editItem(x, p, { from: 'an armour slot', wear: 'feet' }, { stars: 2 }), null, 'nothing there');
});

// ------------------------------------------------------------ rules
test('the game\'s rules changed by mods (their percents multiplied), things\' numbers too; all as they were after', () => {
  const a = newMod({ name: 'Rules A', author: 'T' });
  a.rules = { breakSpeed: 200, hearts: 15, taken: 50, items: { iron_sword: { damage: 20, name: 'Big Sword' } }, blocks: { stone: { hardness: 0.1, light: 4 } }, creatures: { wolf: { hp: 99, speed: 200 } } };
  const b = newMod({ name: 'Rules B', author: 'T' });
  b.rules = { breakSpeed: 200, dealt: 300 };
  normalizeMod(a);
  normalizeMod(b);
  const stone = BLOCKS[B.stone];
  const was = { sword: ITEMS.iron_sword.damage, name: ITEMS.iron_sword.name, ruby: ITEMS['iron_sword+ruby'].damage, hard: stone.hardness, light: stone.light, wolf: SPECIES.wolf.hp, step: SPECIES.wolf.step };
  const game = makeGame(4242);
  const dirt = BLOCKS[B.dirt];
  const slow = game.breakTime(dirt);
  quiet(() => installMods([a, b]));
  try {
    assert.equal(rule('breakSpeed'), 4, 'twice, twice');
    assert.equal(rule('hearts'), 15);
    assert.equal(rule('day'), 1, 'as the game has it');
    assert.ok(Math.abs(game.breakTime(dirt) - Math.max(0.08, slow / 4)) < 1e-9);
    assert.equal(ITEMS.iron_sword.damage, 20);
    assert.equal(ITEMS.iron_sword.name, 'Big Sword');
    assert.equal(ITEMS['iron_sword+ruby'].damage, 20, 'its set pieces made again from it');
    assert.equal(stone.hardness, 0.1);
    assert.equal(stone.light, 4);
    assert.equal(SPECIES.wolf.hp, 99);
    assert.equal(SPECIES.wolf.step, was.step / 2, 'twice as fast');
    const g2 = makeGame(4243);
    assert.equal(g2.player.maxHp, 30, 'fifteen hearts');
    const p = g2.player;
    const s = g2.findFreeSpot(p.x + 3, p.z, p.y);
    const wolf = g2.spawnMonster('wolf', s.x, s.y, s.z);
    assert.equal(wolf.maxHp, 99);
    assert.equal(modScaleDamage(p, wolf, 10), 5, 'half as hard on players');
    assert.equal(modScaleDamage(wolf, p, 10), 30, 'three times as hard from them');
  } finally {
    uninstallMods();
  }
  assert.equal(MODS.rules, null);
  assert.equal(rule('hearts'), 10);
  assert.equal(ITEMS.iron_sword.damage, was.sword);
  assert.equal(ITEMS.iron_sword.name, was.name);
  assert.equal(ITEMS['iron_sword+ruby'].damage, was.ruby);
  assert.deepEqual([stone.hardness, stone.light], [was.hard, was.light]);
  assert.deepEqual([SPECIES.wolf.hp, SPECIES.wolf.step], [was.wolf, was.step]);
  assert.ok(Math.abs(game.breakTime(dirt) - slow) < 1e-9);
  // (Every rule's range holds what the game has.)
  for (const W of WORLD_RULES) assert.ok(W.def >= W.min && W.def <= W.max, W.key);
});

// ------------------------------------------------------------ gear looks
test('gear looks: worn (the game\'s look under it, tinted, art over the person); held, for its starred and tuned pieces too', () => {
  const m = newMod({ name: 'Gear', author: 'T' });
  const a = newAsset({ name: 'Crest', w: 16, h: 30 });
  const idx = new Uint8Array(16 * 30);
  for (let y = 6; y < 9; y++) for (let xx = 4; xx < 12; xx++) idx[y * 16 + xx] = 3;
  a.frames[0].cels.l1 = encodeCel(idx);
  m.assets.crest = a;
  m.gear.helm = { name: 'Helm look', item: 'iron_helmet', worn: { base: 'helmet', tint: '#c03030', art: 'crest' } };
  m.gear.blade = { name: 'Blade look', item: 'iron_sword', held: { art: null, x: 2, y: 12, scale: 1.2, angle: 20 } };
  normalizeMod(m);
  const was = ITEMS.iron_helmet.look;
  assert.ok(WORN_LOOKS.head.includes('helmet'));
  quiet(() => installMods([m]));
  try {
    const look = ITEMS.iron_helmet.look;
    assert.match(look, /^modgear\d+$/);
    const G = MODS.gearLooks[+look.slice(7)];
    assert.deepEqual([G.base, G.tint, G.slot, G.frames.length], ['helmet', '#c03030', 'head', 1]);
    assert.equal(G.frames[0].filter((v, i) => i % 4 === 3 && v).length, 8 * 3, 'its art, pixel for pixel');
    const who = { skin: '#d8a880', hair: '#5a3a22', hairStyle: 'short', shirt: '#7a5a8a', pants: '#4a4a6a', shoes: '#3a2a1a' };
    const plain = drawHumanoid({ ...who, hat: 'helmet' }, 0, 0);
    const worn = drawHumanoid({ ...who, hat: look }, 0, 0);
    assert.ok(plain.d.some((v, i) => v !== worn.d[i]), 'it looks as the mod has it');
    // Held: the piece, and any made from it.
    const H = heldLookOf('iron_sword');
    assert.equal(H.held.scale, 1.2);
    assert.equal(heldLookOf(starKey('iron_sword', 2, 'c', 5, [])), H);
    assert.equal(heldLookOf(tuneKey('iron_sword', { damage: 2 })), H);
    assert.equal(heldLookOf('iron_axe'), null);
  } finally {
    uninstallMods();
  }
  assert.equal(ITEMS.iron_helmet.look, was, 'the game\'s own look again');
  assert.equal(MODS.gearLooks.length, 0);
  assert.equal(heldLookOf('iron_sword'), null);
});

// ------------------------------------------------------------ the land
test('the land changed by nodes: balls, digging, lines, copies, hills, trees, crops, water; doors, chests, what\'s set down', () => {
  const game = makeGame(4242);
  const m = newMod({ name: 'Land', author: 'T' });
  m.loot.t = { id: 't', name: 'T', rolls: [2, 2], entries: [{ item: 'coin', w: 1, min: 3, max: 3 }], always: [] };
  normalizeMod(m);
  quiet(() => installMods([m]));
  try {
    const p = game.player;
    const w = game.world;
    const x = xOf(game, m);
    // A flat floor of stone to work on (its top at 5), air over it.
    const C = { x: p.x + 10, y: 6, z: p.z + 10 };
    for (const [dx, dz] of [[-6, -6], [6, 6], [-6, 6], [6, -6]]) assert.ok(w.regionAt(C.x + dx, C.z + dz), 'there to work on');
    SVC.fill(x, { x: C.x - 6, y: 6, z: C.z - 6 }, { x: C.x + 6, y: 14, z: C.z + 6 }, 'air');
    SVC.fill(x, { x: C.x - 6, y: 1, z: C.z - 6 }, { x: C.x + 6, y: 5, z: C.z + 6 }, 'stone');
    const g = SVC.groundAt(x, { x: C.x, y: 10, z: C.z });
    assert.deepEqual([g.y, g.block], [6, 'stone']);
    // A ball in the air, counted, turned to another block, dug away.
    const mid = { x: C.x, y: 10, z: C.z };
    const n = SVC.ball(x, mid, 2, 'planks', false, true);
    assert.ok(n > 20);
    const count = (what, from, r = 3) => SVC.countBlocks(x, { shape: 'a ball', a: mid, r, what, from });
    assert.equal(count('a block', 'planks'), n);
    assert.equal(SVC.replaceBlocks(x, { shape: 'a ball', a: mid, r: 3, what: 'a block', from: 'planks', to: 'cobblestone' }), n);
    assert.equal(count('a block', 'cobblestone'), n);
    assert.equal(SVC.dig(x, mid, { shape: 'a ball', r: 3 }), n);
    assert.equal(count('any'), 0);
    // A wall along a line, two high, and a copy of it.
    const a0 = { x: C.x - 5, y: 6, z: C.z - 6 };
    const a1 = { x: C.x + 5, y: 6, z: C.z - 6 };
    assert.equal(SVC.line(x, a0, a1, 'cobblestone', 2, 1), 22);
    assert.equal(SVC.copyBlocks(x, a0, { ...a1, y: 7 }, { x: C.x - 5, y: 6, z: C.z - 4 }, false), 22);
    assert.equal(SVC.countBlocks(x, { shape: 'a box', a: { x: C.x - 5, y: 6, z: C.z - 4 }, b: { x: C.x + 5, y: 7, z: C.z - 4 }, what: 'a block', from: 'cobblestone' }), 22);
    // A crop, grown so far; a tree; water.
    const crop = { x: C.x + 5, y: 6, z: C.z + 5 };
    assert.ok(SVC.plantCrop(x, crop, 'wheat', 2));
    assert.equal(SVC.blockFact(x, crop, 'grown (a crop)'), 2);
    assert.equal(w.getBlock(crop.x, 5, crop.z), B.farmland);
    const tree = { x: C.x - 5, y: 6, z: C.z + 5 };
    assert.ok(SVC.growTree(x, tree, 'birch'));
    assert.notEqual(w.getBlock(tree.x, 6, tree.z), B.air);
    assert.equal(SVC.pour(x, { x: C.x + 2, y: 6, z: C.z - 2 }, 'water', 0, true), 1);
    assert.equal(SVC.blockFact(x, { x: C.x + 2, y: 6, z: C.z - 2 }, 'liquid'), true);
    // A door, opened and shut.
    const dd = { x: C.x - 5, y: 6, z: C.z };
    w.setBlock(dd.x, 6, dd.z, B.door);
    w.setBlock(dd.x, 7, dd.z, B.door_top);
    assert.equal(SVC.door(x, dd, 'open'), true);
    assert.equal(SVC.blockFact(x, { ...dd, y: 7 }, 'open (a door)'), true);
    assert.equal(SVC.door(x, dd, 'shut'), false);
    assert.equal(SVC.door(x, dd, 'the other way'), true);
    // A chest: emptied, filled, taken from, filled from a loot table.
    const box = { x: C.x + 5, y: 6, z: C.z };
    w.setBlock(box.x, box.y, box.z, B.chest);
    assert.equal(SVC.blockFact(x, box, 'a container'), true);
    SVC.boxEmpty(x, box, false);
    assert.equal(SVC.boxInfo(x, box, null).all, 0);
    assert.equal(SVC.boxPut(x, box, 'bread', 5, false), 0, 'all of it in');
    assert.equal(SVC.boxInfo(x, box, 'bread').n, 5);
    const had = countItem(p.inv, 'bread');
    assert.equal(SVC.boxTake(x, box, 'bread', 3, p), true);
    assert.equal(countItem(p.inv, 'bread'), had + 3);
    assert.equal(SVC.boxTake(x, box, 'bread', 9, p), false, 'not that many');
    assert.equal(SVC.boxFill(x, box, 't', true), 6);
    assert.deepEqual([SVC.boxInfo(x, box, 'coin').n, SVC.boxInfo(x, box, 'bread').n], [6, 0]);
    assert.equal(SVC.blockFact(x, box, 'items in it'), 6);
    assert.equal(SVC.boxEmpty(x, box, false), 6);
    // Set down on the ground, and taken up.
    const spot = { x: C.x, y: 6, z: C.z + 2 };
    assert.equal(SVC.setDown(x, spot, 'iron_sword', 1), true);
    assert.equal(SVC.blockFact(x, spot, 'set down here'), 'iron_sword');
    assert.deepEqual(SVC.takeUp(x, spot, null), { item: 'iron_sword', count: 1, owner: null });
    assert.equal(w.getBlock(spot.x, spot.y, spot.z), B.air);
    // Candles scattered about, and cleared away (the door and chest left).
    const lit = SVC.scatter(x, { x: C.x, y: 6, z: C.z }, 2, 6, 'candles');
    assert.ok(lit >= 1);
    assert.equal(SVC.countBlocks(x, { shape: 'a ball', a: { x: C.x, y: 6, z: C.z }, r: 3, what: 'a block', from: 'candles' }), lit);
    assert.equal(SVC.clearDeco(x, { x: C.x, y: 6, z: C.z }, 3), lit);
    assert.equal(w.getBlock(box.x, box.y, box.z), B.chest);
    // A hill raised and let down again.
    assert.ok(SVC.raise(x, { x: C.x, y: 6, z: C.z }, 1, 2, null) > 0);
    assert.equal(SVC.groundAt(x, { x: C.x, y: 10, z: C.z }).y, 8);
    assert.ok(SVC.raise(x, { x: C.x, y: 6, z: C.z }, 1, -2, null) > 0);
    assert.equal(SVC.groundAt(x, { x: C.x, y: 10, z: C.z }).y, 6);
  } finally {
    uninstallMods();
  }
  for (const [k] of TREE_LIST.slice(1)) assert.ok(TREE_BUILDERS[k], k);
  for (const t of ['blk.replace', 'blk.ball', 'blk.dig', 'blk.raise', 'blk.line', 'blk.copy', 'blk.tree', 'blk.crop', 'blk.liquid', 'blk.door', 'box.put', 'box.take', 'box.empty', 'box.fill', 'q.box', 'deco.setdown', 'deco.takeup', 'deco.scatter', 'deco.clear', 'q.ground', 'q.countblocks', 'act.music', 'act.musicstop', 'act.itemedit']) assert.ok(NODES[t], t);
});

// ------------------------------------------------------------ the update
test('a world from 0.65 comes up to 0.66', () => {
  assert.ok(compareVersions(GAME_VERSION, '0.66.0') >= 0);
  assert.ok(STEPS.find((s) => s.to === '0.66.0'));
  const d = { gv: '0.65.0', v: 1, mods: null, modMusic: { key: 'x' } };
  const r = migrateSave(d);
  assert.ok(r.log.some((l) => /sounds and songs/.test(l)));
  assert.equal(d.modMusic, undefined);
  assert.equal(d.gv, GAME_VERSION);
});
