// How a mod's gear looks on someone (round 66: the Workshop's Gear tab):
// worn (armour and clothes: one of the game's looks under it, tinted, and
// art of the mod's own laid over the person, from the front, the side and
// the back), and held (art of its own, where the hand grips it, how big,
// at what slant). Kept in the mod's `gear`:
//   { name, item ('@id', or one of the game's items: the piece it's the
//     look of), worn: { base (one of the game's looks, or 'none'), tint
//     ('#rrggbb' or null), art (art 16 x 30: frames front, side, back) },
//     held: { art (or none: its icon), x, y (the grip, in the art's
//     pixels), scale, angle (degrees), upright } }
// In the game, a piece with a worn look of a mod's has its look as
// 'modgear<n>' (see render/people.js: MODS.gearLooks[n]); a held look's
// in MODS.heldLooks (see render/renderer.js, drawHeld).
import { MODS } from './state.js';
import { gameKey, composite } from './format.js';
import { ITEMS, rebuildVariants, forgetDerived } from '../world/items.js';

export const OVER_W = 16;
export const OVER_H = 30;
// The game's looks a piece can be worn as, by where it's worn.
export const WORN_LOOKS = {
  head: ['helmet', 'lcap', 'hood', 'straw', 'circlet', 'goggles', 'cap', 'feather', 'scarf', 'fur'],
  body: ['plate', 'chain', 'leather', 'linen', 'coat'],
  legs: ['plate', 'leather', 'cloth'],
  feet: ['iron', 'leather'],
  shield: ['wood', 'iron', 'round'],
};

const refKey = (m, ref) => (typeof ref === 'string' && ref[0] === '@' ? gameKey(m.id, ref.slice(1)) : ref);
const own = (k) => typeof k === 'string' && Object.prototype.hasOwnProperty.call(ITEMS, k);

// A piece of art as overlays: up to three frames (front, side, back) of
// 16 x 30 RGBA, its guide layers (named "Guide...") left out. Art of
// another size is set at the bottom middle.
export function overlayFrames(asset) {
  if (!asset || !asset.frames || !asset.frames.length) return null;
  const ids = asset.layers.filter((L) => L.visible !== false && !/^guide/i.test(L.name || '')).map((L) => L.id);
  const out = [];
  for (let f = 0; f < Math.min(3, asset.frames.length); f++) {
    const src = composite(asset, f, { layers: ids });
    const d = new Uint8ClampedArray(OVER_W * OVER_H * 4);
    const ox = Math.floor((OVER_W - asset.w) / 2);
    const oy = OVER_H - asset.h;
    for (let y = 0; y < asset.h; y++) for (let x = 0; x < asset.w; x++) {
      const X = x + ox;
      const Y = y + oy;
      if (X < 0 || Y < 0 || X >= OVER_W || Y >= OVER_H) continue;
      const i = (y * asset.w + x) * 4;
      const j = (Y * OVER_W + X) * 4;
      d[j] = src[i];
      d[j + 1] = src[i + 1];
      d[j + 2] = src[i + 2];
      d[j + 3] = src[i + 3];
    }
    out.push(d);
  }
  return out;
}

// A gear look made ready to draw: { base, tint, frames, slot }.
export function wornLook(mod, g, slot) {
  const w = g.worn || {};
  const tint = /^#[0-9a-f]{6}$/i.test(w.tint || '') ? w.tint : null;
  const art = w.art && mod.assets ? mod.assets[w.art] : null;
  return { base: w.base || 'none', tint, frames: art ? overlayFrames(art) : null, slot };
}

const saved = new Map(); // item key -> its look before

function install() {
  uninstall();
  MODS.gearLooks = [];
  MODS.heldLooks = new Map();
  for (const m of MODS.active) {
    for (const g of Object.values(m.gear || {})) {
      if (!g || typeof g !== 'object') continue;
      const k = refKey(m, g.item);
      if (!own(k)) continue;
      const it = ITEMS[k];
      if (g.worn && it.slot) {
        const n = MODS.gearLooks.length;
        MODS.gearLooks.push(wornLook(m, g, it.slot));
        if (!saved.has(k)) saved.set(k, it.look);
        it.look = `modgear${n}`;
        rebuildVariants(k);
      }
      if (g.held) MODS.heldLooks.set(k, { mod: m, gear: g, held: g.held });
    }
  }
  if (saved.size) forgetDerived('');
  MODS.serialGear = (MODS.serialGear || 0) + 1;
}

function uninstall() {
  for (const [k, look] of saved) {
    if (!own(k)) continue;
    ITEMS[k].look = look;
    rebuildVariants(k);
  }
  if (saved.size) forgetDerived('');
  saved.clear();
  MODS.gearLooks = [];
  MODS.heldLooks = new Map();
}

// The held look a key has (its own, or the plain piece's it was made from:
// starred, set, tuned).
export function heldLookOf(key) {
  const H = MODS.heldLooks;
  if (!H || !H.size) return null;
  let k = key;
  for (let n = 0; n < 5 && k; n++) {
    const h = H.get(k);
    if (h) return h;
    const it = ITEMS[k];
    const next = it && (it.plain || it.tunedFrom || (it.socket || it.enhanced ? it.base : null));
    if (!next || next === k) break;
    k = next;
  }
  return null;
}

// (After the rules: a piece they change keeps its look.)
MODS.hooks.install.push(() => install());
MODS.hooks.uninstall.unshift(() => uninstall());
MODS.gearLooks = [];
MODS.heldLooks = new Map();
