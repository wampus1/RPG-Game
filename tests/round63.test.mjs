// Round 63: the Workshop made over (its own pixel lettering), and three new
// kinds of thing in mods, in the game: biomes (new ones, and the game's
// own changed), the world's map (land and sea, biomes painted, where towns
// may go, realms, places and people set down, where characters begin),
// and the character screen (tabs of a mod's own, the game's changed, and
// what choosing gives: things, stats, health, traits, companions, values
// graphs read); and the step that brings a world from 0.62 up to 0.63.
import test from 'node:test';
import assert from 'node:assert/strict';
import { stubRenderer, stubUI, stubInput } from './helpers.mjs';
import { newMod, normalizeMod, exportMod, importMod, modHash, problems } from '../src/mod/format.js';
import { makeNode } from '../src/mod/graph.js';
import { SVC } from '../src/mod/nodes.js';
import { installMods, uninstallMods, MODS } from '../src/mod/registry.js';
import { bpEncode, bpAt } from '../src/mod/build.js';
import { biomeFields, biomeSpawn } from '../src/mod/biomes.js';
import { compilePlan, gameLands, packGrid, WN } from '../src/mod/worldplan.js';
import { charGenOf, tabsOf, defaultPicks, cleanPicks, startOf } from '../src/mod/chargen.js';
import { Overworld } from '../src/world/worldgen.js';
import { BIOMES } from '../src/world/biomes.js';
import { B } from '../src/world/blocks.js';
import { DAGONI_KEYS } from '../src/world/geography.js';
import { MAP_W, MAP_H, REGION_W, REGION_D } from '../src/config.js';
import { Game } from '../src/game/game.js';
import { CharacterWindow } from '../src/ui/create.js';
import { Grid } from '../src/ui/ascii.js';
import { randomHero, normalizeHero, hpBonus } from '../src/game/hero.js';
import { buildPixelFont, traceGlyph } from '../src/workshop/pixfont.js';
import { STEPS, migrateSave } from '../src/game/migrate.js';
import { GAME_VERSION, compareVersions } from '../src/version.js';

const graph = (nodes) => ({ nodes, links: [], notes: [] });
const quiet = (fn) => {
  const w = console.warn;
  console.warn = () => {};
  try {
    return fn();
  } finally {
    console.warn = w;
  }
};
const fakeUI = () => ({ audio: null, mouseCell: { x: -1, y: -1 }, time: 0, close() {} });

// A hut of 5x5, to set down on a world map.
function hut(m) {
  const st = { id: 'hut', name: 'Hut', w: 5, d: 5, h: 5, ground: 1, pal: ['keep', 'planks', 'stone_bricks', 'air'], marks: [], place: { where: 'nowhere', count: 0 } };
  const n = st.w * st.d * st.h;
  const idx = new Uint8Array(n);
  for (let z = 0; z < 5; z++) for (let x = 0; x < 5; x++) {
    idx[bpAt(st, x, 1, z)] = 1;
    for (let y = 2; y < 4; y++) if (x === 0 || z === 0 || x === 4 || z === 4) idx[bpAt(st, x, y, z)] = 2;
  }
  idx[bpAt(st, 2, 2, 4)] = 3;
  bpEncode(st, idx, new Uint8Array(n));
  m.structures.hut = st;
}

// ------------------------------------------------------------ the Workshop
test('the Workshop\'s lettering: the game\'s own font, made a TrueType font', () => {
  const f = buildPixelFont();
  assert.equal(new DataView(f.buffer, f.byteOffset).getUint32(0), 0x00010000);
  const n = (f[4] << 8) | f[5];
  const tags = [];
  for (let i = 0; i < n; i++) tags.push(String.fromCharCode(...f.slice(12 + i * 16, 16 + i * 16)));
  for (const t of ['OS/2', 'cmap', 'glyf', 'head', 'hhea', 'hmtx', 'loca', 'maxp', 'name', 'post']) assert.ok(tags.includes(t), t);
  // (The whole file sums as a font's must.)
  let s = 0;
  for (let i = 0; i < f.length; i += 4) s = (s + (((f[i] << 24) | ((f[i + 1] || 0) << 16) | ((f[i + 2] || 0) << 8) | (f[i + 3] || 0)) >>> 0)) >>> 0;
  assert.equal(s, 0xb1b0afba);
  // A pixel, a square; a ring of them, a square with a hole in it.
  const one = new Uint8Array(48);
  one[0] = 1;
  assert.deepEqual(traceGlyph(one), [[[0, 6], [0, 7], [1, 7], [1, 6]]]);
  const ring = new Uint8Array(48);
  for (const [x, y] of [[0, 0], [1, 0], [2, 0], [0, 1], [2, 1], [0, 2], [1, 2], [2, 2]]) ring[y * 6 + x] = 1;
  assert.equal(traceGlyph(ring).length, 2);
});

test('a mod keeps its biomes, world maps and character tabs; one with none keeps the hash it had', () => {
  const m = newMod({ name: 'Plain', author: 'T' });
  normalizeMod(m);
  for (const k of ['biomes', 'worlds', 'chargen']) assert.deepEqual(m[k], {}, k);
  // (A mod from 0.62, without them, hashes as it did.)
  const old = { ...m };
  delete old.biomes;
  delete old.worlds;
  delete old.chargen;
  assert.equal(modHash(old), modHash(m));
  m.biomes.heath = { id: 'heath', name: 'Heath', base: 'plains', ...biomeFields('plains') };
  m.worlds.w = { id: 'w', name: 'World', base: 'game', lands: gameLands('game'), paint: {}, places: [], people: [], realms: [], spawn: null };
  m.chargen.t = { id: 't', name: 'Tab', title: 'TAB', rows: [{ id: 'r', label: 'Row', kind: 'pick', options: [{ id: 'a', name: 'A' }] }] };
  const back = importMod(exportMod(m));
  assert.equal(back.hash, modHash(m));
  assert.equal(back.biomes.heath.name, 'Heath');
  assert.equal(back.chargen.t.rows[0].options[0].name, 'A');
});

// ------------------------------------------------------------ biomes
test('a mod\'s biome grows in new worlds; a change to one of the game\'s holds while the mod\'s in, and goes after', () => {
  const m = newMod({ name: 'Biomes', author: 'T' });
  m.biomes.glass = { id: 'glass', name: 'Glass Heath', title: 'Glass Heath', base: 'plains', ...biomeFields('plains'), surface: 'sand', creatures: { day: [['wolf', 1]].map(([species, w]) => ({ species, w })), night: [], mode: 'only' }, place: { how: 'climate', isles: ['thessa'], temp: [0, 100], moist: [0, 100], share: 50 } };
  m.biomes.fc = { id: 'fc', name: 'Forest (changed)', change: 'forest', base: 'forest', ...biomeFields('forest'), surface: 'sand' };
  normalizeMod(m);
  const was = BIOMES.forest.surface;
  assert.notEqual(was, B.sand);
  quiet(() => installMods([m]));
  const key = `m:${m.id}:glass`;
  try {
    assert.ok(BIOMES[key], 'in the game\'s list');
    assert.equal(BIOMES[key].surface, B.sand);
    assert.equal(BIOMES[key].name, 'Glass Heath');
    assert.equal(BIOMES.forest.surface, B.sand, 'the game\'s forest, changed');
    assert.equal(BIOMES.forest.name, 'Forest', 'keeping its name');
    const ow = new Overworld(4242);
    let n = 0;
    let land = 0;
    for (let cz = 0; cz < MAP_H; cz++) {
      for (let cx = 0; cx < MAP_W; cx++) {
        const c = ow.cell(cx, cz);
        if (!c || c.island !== 'thessa' || c.biome === 'ocean' || c.biome === 'beach') continue;
        land++;
        if (c.biome === key) n++;
      }
    }
    assert.ok(n > 0 && n < land, `it grows on some of Thessa: ${n} of ${land}`);
    // (Only what it says comes out in it.)
    assert.equal(biomeSpawn(key, false), 'wolf');
    assert.equal(biomeSpawn(key, true), false);
  } finally {
    uninstallMods();
  }
  assert.equal(BIOMES[key], undefined);
  assert.equal(BIOMES.forest.surface, was, 'the game\'s own again');
});

// ------------------------------------------------------------ the world map
function worldMod() {
  const m = newMod({ name: 'World', author: 'T' });
  hut(m);
  m.entities.sage = { id: 'sage', name: 'Sage', graph: graph([makeNode('tpl.npc', 0, 0, { v: { name: 'Sage' } })]) };
  const lands = gameLands('game').map((L) => (L.key === 'thessa' ? { ...L, allow: ['forest', 'plains', 'taiga'] } : L));
  lands.push({ key: 'glass', name: 'Glass Isle', kind: 'dagoni', cx: 38, cz: 143, rx: 6, rz: 4, rough: 0.2, civs: 1, towns: 1, villages: 2, rivers: 1, lakes: 0, dungeons: 0, spires: 0 });
  const land = new Uint8Array(WN);
  const biome = new Uint8Array(WN);
  const town = new Uint8Array(WN);
  // A desert painted on Thessa; no towns on its west end.
  for (let cz = 167; cz <= 171; cz++) for (let cx = 55; cx <= 58; cx++) biome[cz * MAP_W + cx] = 1;
  for (let cz = 150; cz <= 190; cz++) for (let cx = 30; cx <= 43; cx++) town[cz * MAP_W + cx] = 2;
  m.worlds.w = {
    id: 'w', name: 'The Map', base: 'game', lands,
    paint: { land: packGrid(land), biome: packGrid(biome), legend: ['desert'], town: packGrid(town) },
    places: [{ id: 'p1', kind: 'structures', ref: 'hut', cx: 50, cz: 174 }],
    realms: [{ id: 'r1', name: 'The Glass Throne', style: 'vale', color: 2, values: ['pious'], cx: 60, cz: 172 }],
    people: [{ id: 'q1', ent: '@sage', cx: 0, cz: 0, realm: 'r1', home: 'capital' }],
    spawn: { cx: 47, cz: 176 },
  };
  normalizeMod(m);
  return m;
}

test('a world map: the lands as it has them, biomes and towns where it paints them, its realm founded', () => {
  const m = worldMod();
  const plan = compilePlan(m, m.worlds.w);
  assert.equal(plan.lands[0].key, 'thessa', 'Thessa first');
  for (const k of ['kharos', 'myrrow', 'glass']) assert.ok(plan.lands.some((L) => L.key === k), k);
  assert.deepEqual(plan.legend, ['desert']);
  quiet(() => installMods([m]));
  try {
    assert.ok(MODS.world, 'the world map is the game\'s');
    assert.ok(DAGONI_KEYS.has('glass'), 'its new island lived in');
    const ow = new Overworld(31337);
    assert.equal(ow.islands[0].key, 'thessa');
    assert.equal(ow.cell(56, 169).biome, 'desert', 'painted');
    // (Thessa grows only what it's allowed, but for what's painted.)
    const seen = new Set();
    for (let cz = 150; cz < 190; cz++) for (let cx = 30; cx < 75; cx++) {
      const c = ow.cell(cx, cz);
      if (c && c.island === 'thessa') seen.add(c.biome);
    }
    for (const b of seen) assert.ok(['forest', 'plains', 'taiga', 'desert', 'beach', 'ocean', 'mountain'].includes(b), b);
    const zone = (cx, cz) => cx >= 30 && cx <= 43 && cz >= 150 && cz <= 190;
    for (const s of ow.settlements.filter((q) => q.island === 'thessa' && ['city', 'town', 'village'].includes(q.type))) {
      for (let dz = 0; dz < s.cd; dz++) for (let dx = 0; dx < s.cw; dx++) assert.ok(!zone(s.cx + dx, s.cz + dz), `${s.name} is where no towns may be`);
    }
    const civ = ow.civs.find((c) => c.planRealm === 'r1');
    assert.ok(civ, 'the realm founded');
    assert.equal(civ.name, 'The Glass Throne');
    assert.equal(civ.island, 'thessa');
    assert.ok(ow.settlements.some((s) => s.island === 'glass'), 'the new island settled');
  } finally {
    uninstallMods();
  }
  assert.ok(!DAGONI_KEYS.has('glass'));
  assert.equal(MODS.world, null);
});

test('a world map\'s place, person and beginning, in a game', () => {
  const m = worldMod();
  quiet(() => installMods([m]));
  try {
    const hero = { ...randomHero(5), origin: 'crash', name: 'Tester' };
    const game = new Game({ seed: 31337, renderer: stubRenderer(), audio: null, ui: stubUI(), hero, learned: true });
    const site = game.world.sites.find((s) => s.planId === 'p1');
    assert.ok(site, 'the hut set down');
    assert.ok(Math.abs(site.x - 50.5 * REGION_W) < REGION_W && Math.abs(site.z - 174.5 * REGION_D) < REGION_D, 'where the map has it');
    assert.ok(game.world.modMarks.some((q) => q.key === 'world:q1'), 'the sage, in the realm\'s capital');
    const p = game.player;
    assert.ok(Math.abs(p.x - 47.5 * REGION_W) < 24 && Math.abs(p.z - 176.5 * REGION_D) < 24, 'begun where the map says');
    assert.deepEqual(startOf(game, game.hero), { x: Math.floor(47.5 * REGION_W), z: Math.floor(176.5 * REGION_D) });
  } finally {
    uninstallMods();
  }
});

// ------------------------------------------------------------ the character screen
function cgMod() {
  const m = newMod({ name: 'Callings', author: 'T' });
  m.entities.wand = { id: 'wand', name: 'Glass Wand', graph: graph([makeNode('tpl.weapon', 0, 0, { v: { name: 'Glass Wand', damage: 3 } })]) };
  m.entities.pup = { id: 'pup', name: 'Pup', graph: graph([makeNode('tpl.animal', 0, 0, { v: { name: 'Pup', hp: 12 } })]) };
  m.chargen.calling = { id: 'calling', name: 'Calling', title: 'CALLING', about: 'What you were raised to be.', order: 25, rows: [
    { id: 'class', label: 'Calling', kind: 'pick', def: 'mage', options: [
      { id: 'mage', name: 'Mage', effects: { items: [['@wand', 1]], stats: { cha: 1 }, hp: 3, traits: ['tough'], companion: '@pup', flags: { arcane: 2 } } },
      { id: 'thief', name: 'Thief', effects: { coins: 20 } },
    ] },
    { id: 'gifts', label: 'Gifts', kind: 'many', max: 2, options: [{ id: 'a', name: 'Sight' }, { id: 'b', name: 'Luck', effects: { hp: 2 } }, { id: 'c', name: 'Speed' }] },
    { id: 'skill', label: 'Skills', kind: 'points', points: 3, entries: [{ id: 'm', name: 'Magic', max: 2, effects: { flags: { magic: 1 } } }, { id: 'f', name: 'Fists' }] },
    { id: 'motto', label: 'Motto', kind: 'text' },
  ] };
  m.chargen.basics = { id: 'basics', name: 'Basics (changed)', game: 'basics', title: 'WHO', hideRows: ['nameStyle', 'origin:star', 'kit:fisher', 'trait:angler'], rows: [{ id: 'home', label: 'Homeland', kind: 'pick', options: [{ id: 'n', name: 'North' }, { id: 's', name: 'South' }] }],
    add: { origin: [{ id: 'exile', name: 'Exile', as: 'crash', effects: { coins: 5 } }], kit: [{ id: 'glass', name: 'Glasswright', effects: { items: [['@wand', 2]], coins: 3 } }] } };
  m.chargen.looks = { id: 'looks', name: 'Looks (changed)', game: 'looks', hide: true };
  normalizeMod(m);
  return m;
}

test('the character screen as a world\'s mods have it: their tabs, the game\'s changed, what\'s taken away', () => {
  const m = cgMod();
  const cg = charGenOf([m]);
  const tabs = tabsOf(cg);
  assert.deepEqual(tabs.map((t) => t.name), ['WHO', 'CALLING', 'STATS', 'TRAITS'], 'in order, LOOKS hidden');
  const win = new CharacterWindow(fakeUI(), 5, () => {}, [m]);
  assert.ok(!win.rows.some((r) => r.id === 'nameStyle'), 'a game row taken away');
  assert.ok(!win.origins().some((o) => o.game === 'star') && win.origins().some((o) => o.mod === `${m.id}:exile`));
  assert.ok(!win.kits().some((o) => o.game === 'fisher') && win.kits().some((o) => o.mod === `${m.id}:glass`));
  assert.ok(!win.rows.some((r) => r.id === 'trait:angler'));
  assert.ok(win.rows.some((r) => r.tab === 'basics' && r.id === `${m.id}:home`), 'a row of the mod\'s on the game\'s tab');
  // Every tab draws.
  const g = new Grid(win.w, win.h);
  for (let i = 0; i < win.tabs.length; i++) {
    win.setTab(i);
    win.hits = [];
    win.draw(g);
  }
  // Its own tab: one of several (no more than two), points (no more than
  // there are, or one may take), words.
  win.setTab(1);
  const at = (id) => win.tabRows.findIndex((r) => r.id === id);
  const key = (id) => `${m.id}:${id}`;
  for (const o of ['a', 'b', 'c']) {
    win.sel = at(`${key('gifts')}/${o}`);
    win.onKey({ code: 'Space' });
  }
  assert.deepEqual(win.hero.modPicks[key('gifts')], ['a', 'b']);
  win.sel = at(`${key('skill')}/m`);
  for (let i = 0; i < 3; i++) win.onKey({ code: 'ArrowRight' });
  win.sel = at(`${key('skill')}/f`);
  for (let i = 0; i < 3; i++) win.onKey({ code: 'ArrowRight' });
  assert.deepEqual(win.hero.modPicks[key('skill')], { m: 2, f: 1 });
  win.sel = at(key('motto'));
  for (const ch of 'Ever 2') win.onKey({ code: ch === ' ' ? 'Space' : `Key${ch}`, key: ch });
  assert.equal(win.hero.modPicks[key('motto')], 'Ever 2', 'digits typed, not a tab chosen');
  assert.equal(win.tab, 1);
  win.modBonus();
  assert.equal(win.hero.modHp, 5, 'Mage and Luck: shown as you choose');
  let out = null;
  win.onDone = (h) => (out = h);
  win.begin();
  assert.equal(out.modPicks[key('class')], 'mage');
  assert.equal(out.modStats, undefined, 'given when the game begins, not before');
  // (A guest's choices, from their own screen, as the rules allow.)
  const h = { ...randomHero(3), modPicks: { [key('gifts')]: ['a', 'b', 'c', 'zz'], [key('skill')]: { m: 9, f: 9 }, [key('class')]: 'nope' } };
  cleanPicks(cg, h);
  assert.deepEqual(h.modPicks[key('gifts')], ['a', 'b']);
  assert.deepEqual(h.modPicks[key('skill')], { m: 2, f: 1 });
  assert.equal(h.modPicks[key('class')], null);
  assert.equal(defaultPicks(cg, {})[key('class')], 'mage', 'starts on its default');
});

test('what a character\'s choices give, in the game: things, stats, health, traits, values, a companion', () => {
  const m = cgMod();
  quiet(() => installMods([m]));
  try {
    let hero = null;
    const win = new CharacterWindow(fakeUI(), 3, (h) => (hero = h), [m]);
    win.setKit(win.kits().find((o) => o.mod === `${m.id}:glass`));
    win.begin();
    const game = new Game({ seed: 4242, renderer: stubRenderer(), audio: null, ui: stubUI(), hero, learned: true });
    const p = game.player;
    const have = (k) => p.inv.filter(Boolean).filter((s) => s.item === k).reduce((n, s) => n + s.count, 0) + Object.values(p.equip).filter((q) => q === k).length;
    assert.equal(have(`m:${m.id}:wand`), 3, 'the Mage\'s wand and the gear\'s two');
    assert.equal(have('bread') > 0, true, 'what everyone gets, still');
    const h = game.hero;
    assert.deepEqual(h.modStats, { cha: 1 });
    assert.equal(h.modHp, 3);
    assert.equal(hpBonus(h), hpBonus({ ...h, modHp: 0 }) + 3);
    assert.ok(h.traits.includes('tough') && h.modGranted.includes('tough'));
    // (A trait given over the picks is kept when the game's loaded again.)
    assert.ok(normalizeHero(JSON.parse(JSON.stringify(h))).traits.includes('tough'));
    // Values graphs read, kept with the player.
    const x = { game, mod: m, player: p, vars: {} };
    assert.equal(SVC.getVar(x, 'player', 'class'), 'mage');
    assert.equal(SVC.getVar(x, 'player', 'arcane'), 2);
    SVC.setVar(x, 'player', 'met', 1);
    assert.equal(h.modFlags[`${m.id}:met`], 1);
    // The companion: beside them, friendly, at their heel.
    const input = stubInput();
    for (let i = 0; i < 4; i++) game.update(0.5, input);
    const pet = game.creatures.find((c) => c.petId);
    assert.ok(pet && pet.species === `m:${m.id}:pup`);
    assert.equal(pet.petOf, p);
    assert.equal(pet.hostileNow, false);
    assert.ok(pet.distTo(p) >= 1);
    // (Fallen: back in the morning.)
    game.kill(pet, null);
    const C = h.modCompanions[0];
    assert.equal(C.alive, false);
    assert.equal(C.back, game.day + 1);
  } finally {
    uninstallMods();
  }
});

test('the Workshop sees what\'s wrong with a character tab', () => {
  const m = cgMod();
  m.chargen.calling.rows.push({ id: 'empty', label: 'Empty', kind: 'pick', options: [] });
  m.chargen.calling.rows[0].options[0].effects.story = 'gone';
  m.chargen.calling.rows[0].options[1].effects.start = 'spawn';
  const ps = problems(m).map((q) => q.text).join('\n');
  assert.match(ps, /"Empty" has nothing to choose/);
  assert.match(ps, /story "gone"/);
  assert.match(ps, /where the world map says, and no world map says/);
});

// ------------------------------------------------------------ the update
test('a world from 0.62 comes up to 0.63', () => {
  assert.ok(compareVersions(GAME_VERSION, '0.63.0') >= 0);
  const step = STEPS.find((s) => s.to === '0.63.0');
  assert.ok(step);
  const d = { gv: '0.62.0', v: 1, mods: null };
  const r = migrateSave(d);
  assert.ok(r.log.some((l) => /Workshop/.test(l)));
  assert.ok(compareVersions('0.62.0', GAME_VERSION) < 0);
});
