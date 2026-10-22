// (Round 137) At the anvil: what a piece's triggers set off, changed round.
// A piece's triggers and what each sets off (one of its modifiers, or one
// of its abilities: see world/triggers.js) are what they are; but any two
// of them can trade what they set off, for a little of what the piece is
// made of and some coin. Nothing's added or taken away: a healing aura
// that came when you were struck comes when you bring a foe down instead,
// and the meteor that came then comes when you're struck.
import { ITEMS } from '../world/items.js';
import { parseStar, starKey, modOf, gearClass } from '../world/quality.js';
import { splitTok, tokOf, TRIGGERS, RATES, triggerText } from '../world/triggers.js';
import { craftSources, countFrom, takeFrom } from './invtools.js';
import { countItem, removeItem } from './inventory.js';
import { recipeFor } from './smithing.js';
import { mastery, gainMastery } from './mastery.js';

const BASES = ['iron_ingot', 'steel_ingot', 'gold_ingot', 'string', 'leather', 'cloth', 'planks', 'stone', 'cobblestone', 'obsidian_shard', 'kav_scrap'];

// A piece's triggers, each with what it sets off: [{ i (its place among
// the piece's modifiers), t, p, ab, name, when, rate }].
export function bindings(key) {
  const sp = parseStar(key);
  if (!sp) return [];
  const cls = gearClass(ITEMS[sp.plain]);
  const out = [];
  sp.mods.forEach((m, i) => {
    const s = splitTok(m);
    if (!s.t || !TRIGGERS[s.t]) return;
    const d = modOf(cls, m);
    if (!d) return;
    out.push({ i, t: s.t, p: s.p, ab: s.ab, name: d.name, when: triggerText(s.t), rate: RATES[TRIGGERS[s.t].rate] });
  });
  return out;
}
export const rebindable = (key) => bindings(key).length >= 2;

// What changing them round costs: a little of what it's made of (its
// recipe's main makings: a bar of iron, a string, a hide...), and coin.
export function rebindCost(key) {
  const sp = parseStar(key) || { plain: key, stars: 1 };
  const r = recipeFor(sp.plain);
  let item = 'iron_ingot';
  if (r) {
    const ins = Object.entries(r.in).filter(([k]) => BASES.includes(k)).sort((a, b) => b[1] - a[1]);
    if (ins.length) item = ins[0][0];
  } else if (gearClass(ITEMS[sp.plain]) === 'bow') item = 'string';
  return { coin: 10 + 10 * sp.stars, item, n: sp.stars >= 4 ? 2 : 1, name: ITEMS[item] ? ITEMS[item].name : item };
}

// The piece with the things set off by its triggers `a` and `b` (places
// among its modifiers) swapped. Null if they can't be.
export function swappedKey(key, a, b) {
  const sp = parseStar(key);
  if (!sp || a === b) return null;
  const cls = gearClass(ITEMS[sp.plain]);
  const A = sp.mods[a] && splitTok(sp.mods[a]);
  const B = sp.mods[b] && splitTok(sp.mods[b]);
  if (!A || !B || !A.t || !B.t || A.t === B.t && A.p === B.p) return null;
  const mods = sp.mods.slice();
  mods[a] = tokOf(A.p, B.t);
  mods[b] = tokOf(B.p, A.t);
  if (!modOf(cls, mods[a]) || !modOf(cls, mods[b])) return null;
  return starKey(sp.plain, sp.stars, sp.origin, sp.roll, mods);
}

// Swap them, on the piece in pack slot `slot`: { ok, key, why }.
export function rebind(game, slot, a, b) {
  const p = game.player;
  const s = p.inv[slot];
  if (!s) return { ok: false, why: 'The piece isn\'t in your pack.' };
  const key = swappedKey(s.item, a, b);
  if (!key) return { ok: false, why: 'Those two can\'t change places.' };
  const c = rebindCost(s.item);
  const src = craftSources(game);
  if (countItem(p.inv, 'coin') < c.coin || countFrom(src, c.item) < c.n) return { ok: false, why: `It takes ¤${c.coin} and ${c.n > 1 ? `${c.n} ` : 'a '}${c.name.toLowerCase()}${c.n > 1 ? 's' : ''}.` };
  removeItem(p.inv, 'coin', c.coin);
  takeFrom(src, c.item, c.n);
  // (Taken off the stack, if it was one of several.)
  if (s.count > 1) {
    s.count--;
    const j = p.inv.findIndex((q) => !q);
    if (j >= 0) p.inv[j] = { item: key, count: 1 };
    else game.spawnDrop?.(key, 1, p.x, p.y, p.z, true);
  } else p.inv[slot] = { item: key, count: 1 };
  // (A smith's work, a little: see mastery.js.)
  if (mastery(game, 'smithing')) gainMastery(game, 'smithing', 0.2);
  const r = game.renderer;
  r.emit(p.x, p.y + 1.2, p.z, { n: 12, color: ['#90c8f8', '#ffb0f0', '#ffffff'], up: 24, speed: 30, life: 0.7, shape: 'star', glow: true, gravity: -6 });
  r.effect?.({ type: 'sigil', wx: p.x, wy: p.y, wz: p.z, color: ['#90c8f8', '#ffffff'], life: 0.8, oy: 4 });
  game.audio?.play('clang', p);
  game.audio?.play('ab_surge', p);
  return { ok: true, key };
}
