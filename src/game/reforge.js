// (Round 78) At the anvil (or a smith's grindstone): a piece of gear
// reforged (beaten out afresh: its make and its modifiers rolled again, its
// stars kept, now and then one more; a far land's own mark kept), or one
// of its modifiers moved onto another piece of the same kind (the piece it
// came off used up in the doing). Either for a price in coin and a bar of
// iron (a bowstring, for a bow). See ui/reforge.js.
import { ITEMS } from '../world/items.js';
import { gearClass, parseStar, starKey, rollMods, rollStars, modOf, LAND_MOD_DEFS, STAR_MAX } from '../world/quality.js';
import { countItem, removeItem } from './inventory.js';

const ROLLS = 36 * 36;
export const MAX_MODS = 3;

const LOOSE = {
  chance: (p) => Math.random() < p,
  int: (a, b) => a + Math.floor(Math.random() * (b - a + 1)),
  float: (a, b) => a + Math.random() * (b - a),
  pick: (a) => a[Math.floor(Math.random() * a.length)],
};

// Can this be worked at the anvil at all?
export function workable(key) {
  const it = ITEMS[key];
  if (!it || it.socket || it.enhanced || it.uniform) return false;
  const plain = it.stars ? ITEMS[it.plain] : it;
  return !!gearClass(plain);
}

// What it costs to reforge, or to move a modifier onto, this piece.
export function reforgeCost(key) {
  const it = ITEMS[key];
  const p = parseStar(key);
  const stars = p ? p.stars : 0;
  const mods = p ? p.mods.length : 0;
  const cls = gearClass(it && it.stars ? ITEMS[it.plain] : it);
  return { coin: 20 + stars * 15 + mods * 20, item: cls === 'bow' ? 'string' : 'iron_ingot', n: cls === 'bow' ? 2 : 1 };
}
export function moveCost(toKey) {
  const c = reforgeCost(toKey);
  return { ...c, coin: c.coin + 40 };
}

function canPay(inv, c) {
  return countItem(inv, 'coin') >= c.coin && countItem(inv, c.item) >= c.n;
}
function pay(inv, c) {
  removeItem(inv, 'coin', c.coin);
  removeItem(inv, c.item, c.n);
}

// The piece beaten out afresh: a new key. Its stars kept (one more, now and
// then, up to five), its make rolled again, its modifiers rolled again
// (any far land's own kept).
export function reforgeKey(key, rng = LOOSE) {
  const it = ITEMS[key];
  const p = parseStar(key);
  const plain = p ? p.plain : key;
  const base = ITEMS[plain];
  const cls = gearClass(base);
  if (!cls) return key;
  let stars = p ? p.stars : rollStars(rng, { origin: 'c' });
  if (rng.chance(0.15)) stars = Math.min(STAR_MAX, stars + 1);
  const land = p ? p.mods.filter((m) => LAND_MOD_DEFS[cls] && LAND_MOD_DEFS[cls][m]) : [];
  const fresh = rollMods(cls, stars, rng, base).filter((m) => !land.includes(m));
  const mods = [...land, ...fresh].slice(0, MAX_MODS);
  return starKey(plain, stars, p ? p.origin : (it && it.origin) || 'c', rng.int(0, ROLLS - 1), mods);
}

// Reforge the piece in pack slot `i`: { ok, key, why }.
export function reforge(game, i, rng = LOOSE) {
  const inv = game.player.inv;
  const s = inv[i];
  if (!s || !workable(s.item)) return { ok: false, why: 'That can\'t be reforged.' };
  const c = reforgeCost(s.item);
  if (!canPay(inv, c)) return { ok: false, why: `It takes ¤${c.coin} and ${c.n > 1 ? `${c.n} ` : 'a '}${ITEMS[c.item].name}${c.n > 1 ? 's' : ''}.` };
  pay(inv, c);
  const was = s.item;
  // (Taken off the stack, if it was one of several.)
  const key = reforgeKey(was, rng);
  if (s.count > 1) {
    s.count--;
    const j = inv.findIndex((q) => !q);
    if (j >= 0) inv[j] = { item: key, count: 1 };
    else game.spawnDrop?.(key, 1, game.player.x, game.player.y, game.player.z, true);
  } else inv[i] = { item: key, count: 1 };
  game.audio?.play('clang');
  return { ok: true, key, was };
}

// The modifiers a piece carries that could go onto `toKey`: [ids].
export function movable(fromKey, toKey) {
  const a = parseStar(fromKey);
  if (!a || !a.mods.length) return [];
  const A = ITEMS[a.plain];
  const B0 = ITEMS[toKey];
  const bPlain = B0 && B0.stars ? ITEMS[B0.plain] : B0;
  const cls = gearClass(A);
  if (!cls || gearClass(bPlain) !== cls) return [];
  const b = parseStar(toKey);
  const has = b ? b.mods : [];
  if (has.length >= MAX_MODS) return [];
  return a.mods.filter((m) => !has.includes(m) && modOf(cls, m) && (!modOf(cls, m).land || !has.some((q) => modOf(cls, q) && modOf(cls, q).land)));
}

// Move modifier `mod` off the piece in slot `from` onto the piece in slot
// `to` (the first used up): { ok, key, why }.
export function moveMod(game, from, to, mod) {
  const inv = game.player.inv;
  const A = inv[from];
  const B0 = inv[to];
  if (!A || !B0 || from === to) return { ok: false, why: 'Pick two pieces.' };
  if (!movable(A.item, B0.item).includes(mod)) return { ok: false, why: 'That modifier won\'t go onto that.' };
  const c = moveCost(B0.item);
  if (!canPay(inv, c)) return { ok: false, why: `It takes ¤${c.coin} and ${c.n > 1 ? `${c.n} ` : 'a '}${ITEMS[c.item].name}${c.n > 1 ? 's' : ''}.` };
  pay(inv, c);
  const b = parseStar(B0.item);
  const plain = b ? b.plain : B0.item;
  const key = starKey(plain, b ? b.stars : 1, b ? b.origin : 'c', b ? b.roll : Math.floor(Math.random() * ROLLS), [...(b ? b.mods : []), mod]);
  // The piece it came off: used up.
  if (A.count > 1) A.count--;
  else inv[from] = null;
  if (B0.count > 1) {
    B0.count--;
    const j = inv.findIndex((q) => !q);
    if (j >= 0) inv[j] = { item: key, count: 1 };
    else game.spawnDrop?.(key, 1, game.player.x, game.player.y, game.player.z, true);
  } else inv[to] = { item: key, count: 1 };
  game.audio?.play('clang');
  return { ok: true, key };
}
