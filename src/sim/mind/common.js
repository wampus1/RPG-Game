// (Round 136) What the inner lives' parts share: who lives in a town, how
// someone's made, who two people are to each other, and who's playing.
import { alive } from '../econ.js';
import { hash4 } from '../../util/rng.js';

export const residents = (L) => L.npcs.filter((r) => r && alive(r) && !r.away && !r.migrated && !r.visitor);
export const P = (r) => r.personality || { bravery: 0.5, sociability: 0.5, diligence: 0.5, temper: 0.4, kindness: 0.55 };
export const nameOf = (r) => (r && r.name ? `${r.name.first} ${r.name.last}` : 'someone');
export const firstOf = (r) => (r && r.name ? r.name.first : 'someone');
export const has = (r, t) => !!(r && r.traits && r.traits.includes(t));

// Who `b` is to `a`: 'partner', 'child', 'parent', 'sibling', 'household',
// 'friend', 'workmate', or null.
export function bond(a, b) {
  if (!a || !b || a === b) return null;
  if (a.partner === b.idx || b.partner === a.idx) return 'partner';
  if ((a.children || []).includes(b.idx) || (b.parents || []).includes(a.idx)) return 'child';
  if ((a.parents || []).includes(b.idx)) return 'parent';
  if ((a.parents || []).some((p) => (b.parents || []).includes(p))) return 'sibling';
  if (a.household !== undefined && a.household !== null && a.household === b.household) return 'household';
  if ((a.friends || []).includes(b.idx) || (b.friends || []).includes(a.idx)) return 'friend';
  if (a.work && b.work && a.work.building !== undefined && a.work.building !== null && a.work.building === b.work.building) return 'workmate';
  return null;
}
export const CLOSE = { partner: 1, child: 0.95, parent: 0.85, sibling: 0.7, household: 0.6, friend: 0.5, workmate: 0.22 };

// Of one blood (not to be courted).
export function blood(a, b) {
  const k = bond(a, b);
  return k === 'child' || k === 'parent' || k === 'sibling';
}

// The one playing, as a memory has them ('p:host', 'p:<seat>').
export function pkey(game) {
  const p = game && game.player;
  return `p:${p && p.seat && !p.seat.host ? p.seat.id : 'host'}`;
}

// How two get on, left to themselves: a chemistry fixed for the pair (the
// same each time), how alike their tempers and their sociability are, and
// how kind each is (-1..1).
export function chemistry(a, b) {
  const h = hash4(Math.min(a.idx, b.idx), Math.max(a.idx, b.idx), 0xaf1, 7) / 4294967296;
  const pa = P(a);
  const pb = P(b);
  const alike = 1 - (Math.abs(pa.sociability - pb.sociability) + Math.abs(pa.temper - pb.temper)) / 2;
  const hob = (a.hobbies || []).some((x) => (b.hobbies || []).includes(x)) ? 0.15 : 0;
  return Math.max(-1, Math.min(1, (h - 0.5) * 1.2 + (alike - 0.6) * 0.6 + (pb.kindness - 0.5) * 0.5 + (pa.kindness - 0.5) * 0.25 + hob));
}

// What they think of someone of their town ('n:<idx>' in their opinions).
export const nk = (r) => `n:${r.idx}`;
