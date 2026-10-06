// Mods put into the game (round 62): their blocks, items, creatures,
// recipes, effects, events, loot, structures and stories added to the
// game's own lists for the world being played, and taken out again when
// it's left (so the next world has only its own).
//
// A world keeps the number each of its mods' blocks is stored by (see
// installMods's blockIds): the same block keeps the same number for as
// long as the world has it. A block whose mod is gone (or no longer has it)
// stays as a "missing" block, so nothing built of it is lost.
import { BLOCKS, defineBlockAt, truncateBlocks } from '../world/blocks.js';
import { ITEMS } from '../world/items.js';
import { RECIPES } from '../world/recipes.js';
import { SPECIES } from '../entities/creature.js';
import { CREATURE_LOOKS } from '../render/sprites.js';
import './rig.js';
import './biomes.js';
import './worldplan.js';
import { Px } from '../render/pixel.js';
import { gameKey, tagRange, isModKey, assetPixels, modHash } from './format.js';

export { assetPixels };
import { compile, Runner, NODES } from './graph.js';
import './nodes.js';

import { MODS } from './state.js';

export { MODS };

let vanilla = null; // the game's own counts, before any mod
const added = { items: [], species: [], looks: [], recipes: [] };

export function installedHash() {
  return MODS.active.map((m) => m.hash || m.id).join(',');
}

// What a reference in a mod's graph comes to in the game. An item, block
// or creature: one of this mod's ('@id'), any mod's ('m:mod:id') or the
// game's own key. Anything else: this mod's thing by id.
export function resolveRef(mod, v) {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v !== 'string') return v;
  if (v[0] === '@') return gameKey(mod.id, v.slice(1));
  return v;
}

export function toPx(pix) {
  const p = new Px(pix.w, pix.h);
  p.d.set(pix.d);
  return p;
}

// ------------------------------------------------------------ install
// Put `mods` into the game. `o.blockIds`: the numbers a world keeps its
// mods' blocks by (from its save). Returns { blockIds, remap, report }:
// `remap` old number -> new for any that had to move (see remapRegions).
export function installMods(mods, o = {}) {
  uninstallMods();
  if (!vanilla) vanilla = { blocks: BLOCKS.length };
  MODS.active = mods.slice();
  MODS.serial++;
  const report = [];
  const keep = { ...(o.blockIds || {}) };
  const remap = {};
  for (const m of mods) {
    m.hash ||= modHash(m);
    MODS.byId.set(m.id, m);
  }
  // (Each mod's collections, by `${mod}:${id}`.)
  for (const m of mods) {
    for (const [k, map] of [['loot', MODS.loot], ['structures', MODS.structures], ['layouts', MODS.layouts], ['dungeons', MODS.dungeons], ['vfx', MODS.vfx], ['assets', MODS.assets], ['rigs', MODS.rigs], ['stories', MODS.stories]]) {
      for (const [id, v] of Object.entries(m[k] || {})) map.set(`${m.id}:${id}`, { mod: m, v });
    }
  }
  // Every entity, compiled.
  const ents = [];
  for (const m of mods) {
    for (const [id, ent] of Object.entries(m.entities || {})) {
      let prog;
      try {
        prog = compile(ent.graph || { nodes: [], links: [] }, { mod: m.id, ent: id });
      } catch (e) {
        report.push({ level: 'error', text: `${ent.name}: ${e.message}` });
        continue;
      }
      if (!prog.root) continue;
      const d = NODES[prog.root.type];
      const key = gameKey(m.id, id);
      const rec = { mod: m, ent, id, key, kind: d.kind, tpl: prog.root.type, prog, runner: null, f: null };
      rec.runner = new Runner(prog, MODS.host || nullHost);
      try {
        rec.f = rec.runner.fields({ game: null, mod: m });
      } catch (e) {
        report.push({ level: 'error', text: `${ent.name}: ${e.message}` });
        rec.f = {};
      }
      MODS.ents.set(key, rec);
      ents.push(rec);
    }
  }
  // Blocks first (items of them after): at the numbers they're kept by.
  const blocks = ents.filter((r) => r.kind === 'block');
  const used = new Set();
  let next = vanilla.blocks;
  for (const id of Object.values(keep)) if (id >= vanilla.blocks) next = Math.max(next, id + 1);
  const take = () => {
    while (used.has(next)) next++;
    return next++;
  };
  for (const r of blocks) {
    let id = keep[r.key];
    if (!(id >= vanilla.blocks) || used.has(id)) {
      const nid = take();
      if (id !== undefined) remap[id] = nid;
      id = nid;
    }
    used.add(id);
    keep[r.key] = id;
    r.blockId = id;
  }
  // (Kept numbers whose blocks are gone: missing blocks, so the world
  // still knows them.)
  for (const [k, id] of Object.entries(keep)) {
    if (used.has(id) || !(id >= vanilla.blocks)) continue;
    if (MODS.ents.has(k)) continue;
    used.add(id);
    defineBlockAt(id, k, { label: 'Missing Block', missing: true, hardness: 0.5, drop: null });
    report.push({ level: 'warn', text: `A block from a mod that isn't here any more (${k}) shows as a missing block.` });
  }
  for (const r of blocks) defineBlockAt(r.blockId, r.key, blockProps(r));
  // (No gaps left between.)
  for (let i = vanilla.blocks; i < BLOCKS.length; i++) if (!BLOCKS[i]) defineBlockAt(i, `m:gap:${i}`, { label: 'Missing Block', missing: true, hardness: 0.5, drop: null });
  for (const r of blocks) MODS.blocks.set(r.blockId, r);
  MODS.blockIds = keep;
  // Items.
  for (const r of ents) {
    const it = itemOf(r);
    if (!it) continue;
    ITEMS[r.key] = it;
    added.items.push(r.key);
  }
  // Creatures.
  for (const r of ents) {
    if (r.kind !== 'creature') continue;
    SPECIES[r.key] = speciesOf(r);
    added.species.push(r.key);
    CREATURE_LOOKS[r.key] = lookOf(r);
    added.looks.push(r.key);
  }
  // Effects, events, recipes.
  for (const r of ents) {
    if (r.kind === 'effect') MODS.effects.set(r.key, r);
    else if (r.kind === 'event') MODS.events.push(r);
    else if (r.kind === 'recipe') {
      const rec = recipeOf(r);
      if (rec) {
        RECIPES.push(rec);
        added.recipes.push(rec);
      } else report.push({ level: 'warn', text: `Recipe "${r.ent.name}" makes nothing, or needs nothing: left out.` });
    }
  }
  for (const fn of MODS.hooks.install) {
    try {
      fn(MODS, report);
    } catch (e) {
      report.push({ level: 'error', text: e.message });
    }
  }
  return { blockIds: { ...keep }, remap, report };
}

// Take every mod back out of the game.
export function uninstallMods() {
  if (!MODS.active.length && !added.items.length) return;
  for (const fn of MODS.hooks.uninstall) {
    try {
      fn(MODS);
    } catch {
      // Its own trouble.
    }
  }
  for (const k of added.items) delete ITEMS[k];
  for (const k of added.species) delete SPECIES[k];
  for (const k of added.looks) delete CREATURE_LOOKS[k];
  for (const r of added.recipes) {
    const i = RECIPES.indexOf(r);
    if (i >= 0) RECIPES.splice(i, 1);
  }
  added.items = [];
  added.species = [];
  added.looks = [];
  added.recipes = [];
  if (vanilla) truncateBlocks(vanilla.blocks);
  MODS.active = [];
  MODS.byId.clear();
  MODS.ents.clear();
  MODS.blocks.clear();
  for (const k of ['loot', 'structures', 'layouts', 'dungeons', 'vfx', 'assets', 'rigs', 'stories', 'effects']) MODS[k].clear();
  MODS.events = [];
  MODS.blockIds = {};
  MODS.serial++;
}

// Region data (as a save keeps it) with some blocks' numbers changed:
// `remap` old -> new.
export function remapRegion(r, remap) {
  if (!r || !r.rle) return r;
  for (let k = 0; k < r.rle.length; k += 3) {
    const v = remap[r.rle[k + 1]];
    if (v !== undefined) r.rle[k + 1] = v;
  }
  return r;
}

const nullHost = { later() {}, ask() {}, fault() {} };

// ------------------------------------------------------------ what each is
const num = (v, d) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
function blockProps(r) {
  const f = r.f;
  const shape = f.shape || 'cube';
  const render = shape === 'cube' ? 'cube' : shape === 'plant' ? 'plant' : shape === 'flat' ? 'flat' : 'sprite';
  const solid = render === 'cube' ? f.solid !== false : render === 'sprite' ? f.solid !== false : false;
  const use = f.use || 'nothing';
  const p = {
    solid, opaque: render === 'cube' && !f.seeThrough, render, tall: shape === 'tall',
    hardness: Math.max(0, num(f.hardness, 1)), tool: f.tool && f.tool !== 'none' ? f.tool : null,
    light: Math.max(0, Math.min(15, Math.round(num(f.light, 0)))), rotatable: !!f.rotatable, label: f.name || r.ent.name,
    interact: use === 'container' ? 'container' : use === 'sit' ? 'sit' : use === 'graph' ? 'mod' : null,
    support: render !== 'cube', standable: render === 'cube' ? solid : false,
    modSlots: Math.max(1, Math.min(27, Math.round(num(f.slots, 9)))),
  };
  // What it drops: an item, a loot table (rolled in hooks.js), or itself.
  if (f.loot) p.drop = null;
  else if (f.drop) p.drop = resolveRef(r.mod, f.drop);
  else p.drop = f.item === false ? null : r.key;
  if (r.prog.next.has(`${r.prog.root.id}.onUse`) && !p.interact) p.interact = 'mod';
  return p;
}

function itemOf(r) {
  const f = r.f;
  const base = { key: r.key, name: f.name || r.ent.name, value: Math.max(0, Math.round(num(f.value, 1))), mod: r.mod.id, modEnt: r.id, about: f.about || undefined };
  switch (r.tpl) {
    case 'tpl.block':
      if (f.item === false) return null;
      return { ...base, kind: 'block', block: r.blockId, stack: 64 };
    case 'tpl.food': {
      const heal = Math.max(0, num(f.heal, 2));
      const regen = Math.max(0, num(f.regen, 0));
      const now = Math.min(heal, 3);
      return { ...base, kind: 'food', stack: Math.max(1, Math.round(num(f.stack, 16))), heal: heal + regen, now, regen: heal - now + regen, regenT: Math.max(3, Math.round((heal - now + regen) * 1.2)), drink: f.kind === 'drink' || f.kind === 'potion', modFood: true, anytime: !!f.anytime };
    }
    case 'tpl.weapon': {
      const ranged = !!f.ranged;
      return {
        ...base, kind: 'weapon', stack: 1, damage: Math.max(0, num(f.damage, 5)), reach: num(f.reach, 1.6), cooldown: Math.max(0.15, num(f.cooldown, 0.42)), style: f.style || 'sword',
        hands: f.hands === 'two' ? 2 : 1, ranged, range: ranged ? num(f.range, 8) : undefined, ammo: ranged ? resolveRef(r.mod, f.ammo) || 'none' : undefined, modElement: f.element && f.element !== 'none' ? f.element : null, modKnock: num(f.knock, 0),
      };
    }
    case 'tpl.tool':
      return { ...base, kind: 'tool', stack: 1, tool: f.tool || 'pick', speed: Math.max(0.5, num(f.speed, 4)), damage: num(f.damage, 2), reach: 1.5, cooldown: 0.45 };
    case 'tpl.armor': {
      const slot = f.slot || 'body';
      const looks = { head: 'helmet', body: 'plate', legs: 'plate', feet: 'iron', shield: 'iron' };
      const look = !f.look || f.look === 'auto' ? looks[slot] : f.look;
      const it = { ...base, kind: 'armor', stack: 1, slot, armor: slot === 'shield' ? 0 : Math.max(0, Math.min(0.5, num(f.armor, 10) / 100)), look: f.tint ? `${look}:${f.tint}` : look };
      if (slot === 'shield') it.block = Math.max(0, Math.min(0.95, num(f.block, 75) / 100));
      return it;
    }
    case 'tpl.material':
      return { ...base, kind: 'material', stack: Math.max(1, Math.round(num(f.stack, 64))), fuel: !!f.fuel };
    default:
      return null;
  }
}

function speciesOf(r) {
  const f = r.f;
  const t = r.tpl;
  const S = {
    name: f.name || r.ent.name, hp: Math.max(1, Math.round(num(f.hp, 10))), dmg: Math.max(0, num(f.damage, 0)), step: 0.36 / Math.max(0.2, num(f.speed, 1)),
    drops: [], mod: r.mod.id, modEnt: r.id, modKey: r.key, light: Math.round(num(f.light, 0)) || undefined,
  };
  const drop = resolveRef(r.mod, f.drop);
  if (drop) S.drops.push([drop, 1, 1, 1]);
  if (f.loot) S.modLoot = `${r.mod.id}:${f.loot}`;
  if (t === 'tpl.animal') {
    S.mode = f.temper === 'fights back' ? 'neutral' : 'passive';
    S.aggro = 0;
    if (f.temper === 'tame') S.tame = true;
    if (!S.dmg && S.mode === 'neutral') S.dmg = 2;
  } else if (t === 'tpl.hostile') {
    S.mode = 'hostile';
    S.aggro = Math.round(num(f.aggro, 8));
    if (f.burnsInSun) S.night = true;
    if (f.attack === 'arrows') S.ranged = true;
    if (f.attack === 'fire orbs') S.lobs = 'fire';
    if (f.attack === 'frost orbs') S.lobs = 'frost';
    if (f.attack === 'none') S.noAttack = true;
    if (f.blow) S.style = f.blow;
  } else if (t === 'tpl.npc') {
    S.mode = f.temper === 'fights back' ? 'neutral' : 'passive';
    S.aggro = 0;
    S.npc = true;
    S.humanoid = !(f.look || f.rig);
    S.modLook = { skin: f.skin, hair: f.hair, shirt: f.shirt, pants: f.pants, hairStyle: f.hairStyle };
    S.title = f.title || '';
    S.wander = Math.round(num(f.wander, 4));
    if (f.temper === 'shrugs it off') S.calm = true;
    if (f.immortal) S.immortal = true;
  } else if (t === 'tpl.boss') {
    S.mode = 'hostile';
    S.aggro = 30;
    S.boss = true;
    S.big = f.size !== 'normal';
    S.title = f.title || '';
    S.phases = Math.max(1, Math.min(4, parseInt(f.phases, 10) || 3));
    S.style = f.blow || 'slam';
    S.modColor = r.mod.color;
    S.modIntro = f.intro || '';
    S.modDeath = f.death || '';
  }
  if (f.floats) S.floats = true;
  if (f.swims) S.swims = true;
  if (f.fireproof) S.fireproof = true;
  S.modBrain = true;
  // Out in the wild: when, where, how often.
  const when = f.spawnTime || (t === 'tpl.hostile' ? 'night' : 'day');
  if ((t === 'tpl.animal' || t === 'tpl.hostile') && when !== 'never' && num(f.weight, 3) > 0) {
    S.modSpawn = { when, biomes: Array.isArray(f.biomes) ? f.biomes.map((b) => (typeof b === 'string' && b[0] === '@' ? gameKey(r.mod.id, b.slice(1)) : b)) : [], weight: num(f.weight, 3), group: Math.max(1, Math.min(6, Math.round(num(f.group, 1)))) };
  }
  return S;
}

// How a creature looks: its art's frames (walking, if it has a "walk"
// tag), square, 16 across (32 for a great one, or art that big).
function lookOf(r) {
  const f = r.f;
  const m = r.mod;
  const big = r.tpl === 'tpl.boss' && f.size !== 'normal';
  const a = f.look && m.assets[f.look];
  if (f.rig && m.rigs[f.rig] && MODS.rigLook) {
    const L = MODS.rigLook(m, m.rigs[f.rig], big);
    if (L) return L;
  }
  if (!a) {
    // (No art yet: a plain shape in the mod's colour, so it shows.)
    const sz = big ? 32 : 16;
    return { frames: 2, size: sz, draw: (fr) => placeholder(sz, m.color, fr) };
  }
  const sz = big || a.w > 20 || a.h > 20 ? 32 : 16;
  const [f0, f1] = (a.tags || []).some((t) => t.name === 'walk') ? tagRange(a, 'walk') : [0, a.frames.length - 1];
  const frames = Math.max(1, Math.min(8, f1 - f0 + 1));
  return {
    frames, size: sz, modAsset: true,
    // (Its art faces right, as drawn: the game wants it facing left.)
    draw: (fr) => {
      const pix = assetPixels(m, f.look, f0 + (fr % frames), sz, sz, 'contain', true);
      const p = toPx(pix);
      const q = new Px(sz, sz);
      for (let y = 0; y < sz; y++) for (let x = 0; x < sz; x++) {
        const i = (y * sz + x) * 4;
        const j = (y * sz + (sz - 1 - x)) * 4;
        q.d[j] = p.d[i];
        q.d[j + 1] = p.d[i + 1];
        q.d[j + 2] = p.d[i + 2];
        q.d[j + 3] = p.d[i + 3];
      }
      return q;
    },
  };
}

function placeholder(sz, color, fr) {
  const p = new Px(sz, sz);
  const c = color || '#ffe070';
  const r = sz * 0.34;
  p.ellipse(sz / 2 - 0.5, sz - r - 1 - (fr % 2), r, r * 0.9, c);
  p.set(Math.round(sz * 0.38), Math.round(sz - r * 1.3), '#1c1622');
  p.set(Math.round(sz * 0.62), Math.round(sz - r * 1.3), '#1c1622');
  return p.outline ? p.outline('#1c1622') : p;
}

function recipeOf(r) {
  const f = r.f;
  const out = resolveRef(r.mod, f.out);
  if (!out || !ITEMS[out]) return null;
  const ins = {};
  for (const [k, c] of [['a', 'an'], ['b', 'bn'], ['c', 'cn'], ['d', 'dn']]) {
    const it = resolveRef(r.mod, f[k]);
    if (it && ITEMS[it]) ins[it] = (ins[it] || 0) + Math.max(1, Math.round(num(f[c], 1)));
  }
  if (!Object.keys(ins).length) return null;
  return { station: f.station || 'hand', out, n: Math.max(1, Math.round(num(f.count, 1))), in: ins, mod: r.mod.id };
}

// Is this one of a mod's (item, block or creature key)?
export const fromMod = isModKey;
