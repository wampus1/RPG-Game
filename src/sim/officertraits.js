// (Round 125) What a townsperson is like in office: two or three traits
// each, read off their character (their personality, their skills, their
// years, their trade) and a little of who they are besides. Each has its
// work wherever they serve: the steward who never forgets, the treasurer
// who skims, the stern magistrate, the brave captain, the councillor who
// wants your seat. See office.js for where each counts.
import { hash4 } from '../util/rng.js';

export const OTRAITS = {
  diligent: { name: 'Diligent', glyph: '✓', color: '#a0e8a0', about: 'Never forgets a matter left to them (steward). Gathers 5% more tax (treasurer).' },
  careless: { name: 'Careless', glyph: '~', color: '#ffb080', about: 'Forgets the odd matter left to them (steward). Gathers 5% less tax (treasurer).' },
  shrewd: { name: 'Shrewd', glyph: '¤', color: '#ffd070', about: 'Good with money: a treasurer gathers up to a fifth more tax.' },
  honest: { name: 'Honest', glyph: '♦', color: '#a0e8ff', about: 'Never skims the books, and no bribe moves them on the council.' },
  grasping: { name: 'Grasping', glyph: '$', color: '#ff9070', about: 'Skims the tax as treasurer. On the council, a bribe sways them twice as far.' },
  stern: { name: 'Stern', glyph: '!', color: '#ffa060', about: 'Raises fines after thefts (magistrate). Keeps the watch sharp: it counts half a guard stronger (captain).' },
  merciful: { name: 'Merciful', glyph: '♥', color: '#ff90b0', about: 'Eases the fines once the streets are calm (magistrate). The poor think the better of you for naming them.' },
  brave: { name: 'Brave', glyph: '▲', color: '#e8c070', about: 'Leads from the front: the watch counts a whole guard stronger again (captain).' },
  timid: { name: 'Timid', glyph: '▼', color: '#a09080', about: 'Hangs back: the watch counts no stronger for them (captain).' },
  popular: { name: 'Well liked', glyph: '☺', color: '#c0e070', about: 'Their faction warms to you twice as much for naming them, and minds twice as much if you dismiss them.' },
  learned: { name: 'Learned', glyph: '§', color: '#c8b8ff', about: 'Votes by what the town needs more than by their faction (council). Never sets fines too harsh (magistrate).' },
  ambitious: { name: 'Ambitious', glyph: '♠', color: '#d080ff', about: 'Wants your seat: votes against you more often on the council.' },
  loyal: { name: 'Steadfast', glyph: '♣', color: '#80d0a0', about: 'Votes with you more often on the council, whatever their faction thinks.' },
};
export const OTRAIT_IDS = Object.keys(OTRAITS);

// The two or three of them that fit someone best (the same every time).
export function traitsOf(r) {
  if (!r) return [];
  if (r.otraits && r.otraits.v === 1) return r.otraits.list;
  const P = r.personality || {};
  const S = r.skills || {};
  const n = (k) => (Math.abs(hash4(r.idx | 0, k, (r.name && r.name.first ? r.name.first.length : 0), 0x07a1)) % 1000) / 1000;
  const d = P.diligence ?? 0.5;
  const k = P.kindness ?? 0.5;
  const b = P.bravery ?? 0.5;
  const t = P.temper ?? 0.5;
  const so = P.sociability ?? 0.5;
  const fit = {
    diligent: d - 0.62,
    careless: 0.32 - d,
    shrewd: (S.trading || 0) - 0.45 + (r.job === 'merchant' ? 0.15 : 0),
    honest: (k - 0.55) * 0.8 + (n(1) - 0.5) * 0.3,
    grasping: (0.36 - k) * 0.9 + (n(2) - 0.5) * 0.2,
    stern: t - 0.62,
    merciful: (k - 0.66) + (0.45 - t) * 0.4,
    brave: b - 0.66,
    timid: 0.3 - b,
    popular: so - 0.68,
    learned: (r.age === 'elder' ? 0.12 : 0) + (['priest', 'scholar', 'noble', 'healer'].includes(r.job) ? 0.15 : 0) + (n(3) - 0.7) * 0.4,
    ambitious: (n(4) - 0.78) * 0.8 + (r.job === 'noble' ? 0.08 : 0) + (t - 0.5) * 0.1,
    loyal: (n(5) - 0.8) * 0.8 + (k - 0.5) * 0.1,
  };
  // (Never both of a pair.)
  const against = { diligent: 'careless', careless: 'diligent', honest: 'grasping', grasping: 'honest', brave: 'timid', timid: 'brave', stern: 'merciful', merciful: 'stern', ambitious: 'loyal', loyal: 'ambitious' };
  const list = [];
  for (const id of OTRAIT_IDS.slice().sort((p, q) => fit[q] - fit[p])) {
    if (list.length >= 3) break;
    if (fit[id] <= 0 && list.length >= 2) break;
    if (list.some((q) => against[q] === id)) continue;
    list.push(id);
  }
  r.otraits = { v: 1, list };
  return list;
}

export const hasTrait = (r, id) => traitsOf(r).includes(id);

// How well someone would serve in an office, 0 to 4 stars (for the list).
export function suits(k, r) {
  const T = traitsOf(r);
  const good = { steward: ['diligent', 'learned', 'loyal', 'honest'], treasurer: ['shrewd', 'diligent', 'honest'], magistrate: ['learned', 'stern', 'merciful', 'honest'], captain: ['brave', 'stern', 'loyal'] }[k] || [];
  const bad = { steward: ['careless', 'ambitious'], treasurer: ['grasping', 'careless'], magistrate: ['grasping'], captain: ['timid'] }[k] || [];
  let s = 2 + T.filter((q) => good.includes(q)).length - T.filter((q) => bad.includes(q)).length;
  if (k === 'treasurer') s += (r.skills?.trading || 0) > 0.6 ? 1 : 0;
  if (k === 'captain') s += (r.skills?.combat || 0) > 0.6 ? 1 : 0;
  return Math.max(0, Math.min(4, s));
}
