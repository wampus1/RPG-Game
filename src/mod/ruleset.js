// The world's mods' rules put into the game (round 66: see rules.js): the
// world's rules worked out together (MODS.rules), and the items, blocks and
// creatures they change changed in the game's own lists, and put back as
// they were when the world's left.
import { MODS } from './state.js';
import { WORLD_RULES } from './rules.js';
import { gameKey } from './format.js';
import { ITEMS, rebuildVariants, forgetDerived } from '../world/items.js';
import { BLOCKS } from '../world/blocks.js';
import { SPECIES } from '../entities/creature.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const saved = { items: new Map(), blocks: new Map(), species: new Map() };

// A thing's key in the game, from a mod's rules ('@id': the mod's own).
const refKey = (m, ref) => (typeof ref === 'string' && ref[0] === '@' ? gameKey(m.id, ref.slice(1)) : ref);

function changeItem(k, ch) {
  const it = Object.prototype.hasOwnProperty.call(ITEMS, k) ? ITEMS[k] : null;
  if (!it || !ch || typeof ch !== 'object') return false;
  if (!saved.items.has(k)) saved.items.set(k, { ...it });
  const d = { ...it };
  if (typeof ch.name === 'string' && ch.name.trim()) d.name = ch.name.trim().slice(0, 32);
  if (isNum(ch.damage)) d.damage = clamp(ch.damage, 0, 9999);
  if (isNum(ch.armor) && d.kind === 'armor' && d.slot !== 'shield') d.armor = clamp(ch.armor / 100, 0, 0.9);
  if (isNum(ch.block) && typeof d.block === 'number' && d.kind === 'armor') d.block = clamp(ch.block / 100, 0, 0.98);
  if (isNum(ch.cooldown) && d.cooldown) d.cooldown = clamp(ch.cooldown, 0.1, 10);
  if (isNum(ch.speed) && d.speed) d.speed = clamp(ch.speed, 0.1, 100);
  if (isNum(ch.reach) && d.reach) d.reach = clamp(ch.reach, 0.5, 8);
  if (isNum(ch.range) && d.range) d.range = clamp(Math.round(ch.range), 1, 64);
  if (isNum(ch.heal) && (d.kind === 'food' || d.kind === 'potion')) {
    const now = clamp(ch.heal, 0, 200);
    d.heal = now;
    if (d.now !== undefined) d.now = Math.min(now, d.now);
  }
  if (isNum(ch.stack)) d.stack = clamp(Math.round(ch.stack), 1, 999);
  if (isNum(ch.value)) d.value = clamp(Math.round(ch.value), 0, 999999);
  ITEMS[k] = d;
  rebuildVariants(k);
  return true;
}

function changeBlock(k, ch) {
  const b = BLOCKS.find((q) => q && q.name === k);
  if (!b || !ch || typeof ch !== 'object') return false;
  if (!saved.blocks.has(b)) saved.blocks.set(b, { hardness: b.hardness, light: b.light, label: b.label });
  if (isNum(ch.hardness)) b.hardness = clamp(ch.hardness, 0, 1000);
  if (isNum(ch.light)) b.light = clamp(Math.round(ch.light), 0, 15);
  if (typeof ch.label === 'string' && ch.label.trim()) b.label = ch.label.trim().slice(0, 32);
  return true;
}

function changeSpecies(k, ch) {
  const S = SPECIES[k];
  if (!S || !ch || typeof ch !== 'object') return false;
  if (!saved.species.has(k)) saved.species.set(k, { ...S });
  if (isNum(ch.hp)) S.hp = clamp(Math.round(ch.hp), 1, 100000);
  if (isNum(ch.dmg)) S.dmg = clamp(ch.dmg, 0, 9999);
  if (isNum(ch.speed) && S.step) S.step = saved.species.get(k).step / clamp(ch.speed / 100, 0.1, 10);
  if (isNum(ch.aggro)) S.aggro = clamp(Math.round(ch.aggro), 0, 64);
  if (typeof ch.name === 'string' && ch.name.trim()) S.name = ch.name.trim().slice(0, 32);
  return true;
}

function install() {
  uninstall();
  const R = {};
  let any = false;
  for (const m of MODS.active) {
    const r = m.rules;
    if (!r || typeof r !== 'object') continue;
    for (const W of WORLD_RULES) {
      const v = r[W.key];
      if (!isNum(v) || v === W.def) continue;
      any = true;
      if (W.unit === '%') R[W.key] = (R[W.key] ?? 1) * (clamp(v, W.min, W.max) / 100);
      else R[W.key] = clamp(v, W.min, W.max);
    }
    for (const [ref, ch] of Object.entries(r.items || {})) any = changeItem(refKey(m, ref), ch) || any;
    for (const [ref, ch] of Object.entries(r.blocks || {})) any = changeBlock(refKey(m, ref), ch) || any;
    for (const [ref, ch] of Object.entries(r.creatures || {})) any = changeSpecies(refKey(m, ref), ch) || any;
  }
  MODS.rules = any ? R : null;
  // (Starred and set pieces made up before: made again from the new.)
  if (saved.items.size) forgetDerived('');
}

function uninstall() {
  for (const [k, it] of saved.items) {
    ITEMS[k] = it;
    rebuildVariants(k);
  }
  for (const [b, was] of saved.blocks) Object.assign(b, was);
  for (const [k, S] of saved.species) if (SPECIES[k]) Object.assign(SPECIES[k], S);
  if (saved.items.size) forgetDerived('');
  saved.items.clear();
  saved.blocks.clear();
  saved.species.clear();
  MODS.rules = null;
}

// (After every mod's things are in: their rules change them too.)
MODS.hooks.install.push(() => install());
MODS.hooks.uninstall.unshift(() => uninstall());
MODS.rules = null;
