// (Round 78) Keeping your things in order: the pack sorted (like with like,
// stacks put together), your pack's odds and ends put away into the chests
// about you that already hold the same (and that are yours to put things
// in), and the makings for something on the bench taken from the chests
// you've set down yourself within a few paces as well as from your pack.
import { BELT_SIZE, INV_SIZE } from '../config.js';
import { ITEMS, maxStack } from '../world/items.js';
import { BLOCKS } from '../world/blocks.js';
import { addItem, countAny, removeAny } from './inventory.js';

// Which kinds of thing come first in a sorted pack.
const ORDER = ['weapon', 'tool', 'armor', 'ammo', 'potion', 'food', 'block', 'material'];
const rank = (it) => {
  const i = ORDER.indexOf(it ? it.kind : '');
  return i < 0 ? ORDER.length : i;
};

// The pack (not the belt) put in order: stacks of a thing together, then
// by kind, then by name. True if anything moved.
export function sortPack(inv) {
  const before = JSON.stringify(inv.slice(BELT_SIZE, INV_SIZE));
  const held = new Map();
  const order = [];
  for (let i = BELT_SIZE; i < INV_SIZE; i++) {
    const s = inv[i];
    if (!s) continue;
    if (!held.has(s.item)) {
      held.set(s.item, 0);
      order.push(s.item);
    }
    held.set(s.item, held.get(s.item) + s.count);
    inv[i] = null;
  }
  order.sort((a, b) => {
    const A = ITEMS[a];
    const B = ITEMS[b];
    return rank(A) - rank(B) || String((A && A.name) || a).localeCompare(String((B && B.name) || b)) || String(a).localeCompare(String(b));
  });
  let i = BELT_SIZE;
  for (const k of order) {
    let n = held.get(k);
    const max = maxStack(k);
    while (n > 0 && i < INV_SIZE) {
      const c = Math.min(n, max);
      inv[i++] = { item: k, count: c };
      n -= c;
    }
  }
  return JSON.stringify(inv.slice(BELT_SIZE, INV_SIZE)) !== before;
}

const key = (x, y, z) => `${x},${y},${z}`;

// The chests and barrels about you (within `r` paces, a pace or two up or
// down), as [{ x, y, z, slots, owner }]. `mine`: only those you set down
// yourself; else any that's yours to put things in (your own, the wild's,
// a shop's you work at, your hosts').
export function chestsNear(game, r = 5, mine = false) {
  const p = game.player;
  const w = game.world;
  const out = [];
  const placed = game.myChests || new Set();
  for (let y = p.y - 2; y <= p.y + 2; y++) {
    for (let z = p.z - r; z <= p.z + r; z++) {
      for (let x = p.x - r; x <= p.x + r; x++) {
        const b = BLOCKS[w.getBlock(x, y, z)];
        if (!b || b.interact !== 'container') continue;
        if (mine && !placed.has(key(x, y, z))) continue;
        const owner = game.containerOwner ? game.containerOwner(x, y, z) : null;
        if (!mine && owner && !['mine', 'work', 'host'].includes(owner.kind)) continue;
        const slots = w.getContainer(x, y, z);
        if (slots) out.push({ x, y, z, slots, owner });
      }
    }
  }
  return out;
}

// Your pack's things put away into the chests about you that already hold
// some of the same: { moved (count), chests (how many took some) }.
export function quickStack(game, r = 5) {
  const p = game.player;
  const chests = chestsNear(game, r);
  let moved = 0;
  const used = new Set();
  for (let i = BELT_SIZE; i < INV_SIZE; i++) {
    const s = p.inv[i];
    if (!s) continue;
    for (const c of chests) {
      if (!c.slots.some((q) => q && q.item === s.item)) continue;
      const left = addItem(c.slots, s.item, s.count);
      const put = s.count - left;
      if (!put) continue;
      moved += put;
      used.add(c);
      s.count = left;
      if (!left) {
        p.inv[i] = null;
        break;
      }
    }
  }
  return { moved, chests: used.size };
}

// Where the makings for something on the bench can come from: your pack,
// then the chests you've set down within a few paces.
export function craftSources(game) {
  const p = game.player;
  return [p.inv, ...chestsNear(game, 4, true).map((c) => c.slots)];
}

export function countFrom(sources, k) {
  let n = 0;
  for (const s of sources) n += countAny(s, k);
  return n;
}

// Take `n` of `k` from the sources in turn: what was taken, [[item, n]].
export function takeFrom(sources, k, n) {
  const used = [];
  for (const s of sources) {
    if (n <= 0) break;
    const got = removeAny(s, k, Math.min(n, countAny(s, k)));
    for (const [item, c] of got) {
      used.push([item, c]);
      n -= c;
    }
  }
  return used;
}

// (Round 78) Set down by you: kept, so the bench knows them (see
// Game.tryPlace and Game.breakBlock).
export function notePlaced(game, x, y, z, on) {
  game.myChests ||= new Set();
  if (on) game.myChests.add(key(x, y, z));
  else game.myChests.delete(key(x, y, z));
}

// A piece against what you have on (or in hand), for its tooltip: lines
// [{ text, good }], or [].
export function compareGear(p, item) {
  const it = ITEMS[item];
  if (!it || !p) return [];
  const out = [];
  const pct = (v) => Math.round((v || 0) * 100);
  const fmt = (n, unit = '') => `${n > 0 ? '+' : ''}${n}${unit}`;
  if (it.kind === 'armor' && it.slot) {
    const worn = p.equip && p.equip[it.slot];
    if (!worn || worn === item) return out;
    const W = ITEMS[worn];
    if (!W) return out;
    out.push({ text: `vs ${W.name} (worn):`, good: null });
    const da = pct(it.armor) - pct(W.armor);
    if (da) out.push({ text: `  armour ${fmt(da, '%')}`, good: da > 0 });
    statDiff(out, it.stats, W.stats, fmt);
    if (out.length === 1) out.push({ text: '  much the same', good: null });
    return out;
  }
  if (it.kind === 'weapon' || (it.kind === 'tool' && it.damage)) {
    const heldKey = p.heldItem ? p.heldItem() : null;
    if (!heldKey || heldKey === item) return out;
    const H = ITEMS[heldKey];
    if (!H || !(H.kind === 'weapon' || (H.kind === 'tool' && H.damage))) return out;
    out.push({ text: `vs ${H.name} (in hand):`, good: null });
    const dd = Math.round(((it.damage || 0) - (H.damage || 0)) * 10) / 10;
    if (dd) out.push({ text: `  damage ${fmt(dd)}`, good: dd > 0 });
    if (it.cooldown && H.cooldown && it.cooldown !== H.cooldown) {
      const dps = (it.damage || 0) / it.cooldown - (H.damage || 0) / H.cooldown;
      const r = Math.round(dps * 10) / 10;
      if (r) out.push({ text: `  per second ${fmt(r)}`, good: r > 0 });
    }
    const dr = Math.round(((it.reach || it.range || 0) - (H.reach || H.range || 0)) * 10) / 10;
    if (dr) out.push({ text: `  reach ${fmt(dr)}`, good: dr > 0 });
    statDiff(out, it.stats, H.stats, fmt);
    if (out.length === 1) out.push({ text: '  much the same', good: null });
  }
  return out;
}

function statDiff(out, a = {}, b = {}, fmt) {
  const ks = new Set([...Object.keys(a || {}), ...Object.keys(b || {})]);
  for (const k of ks) {
    const d = ((a || {})[k] || 0) - ((b || {})[k] || 0);
    if (d) out.push({ text: `  ${k} ${fmt(d)}`, good: d > 0 });
  }
}
