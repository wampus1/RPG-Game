// A tavern's room to let (round 54): two beds behind a door in a back
// corner (see Layout.innRoom), let by the night by the innkeeper or the
// barkeep, for one night, three or a week. Whoever rents it (and anyone
// playing with them) may sleep there till the morning they're due out; it
// stands empty otherwise, and its beds aren't anyone's to sleep in.
import { DAY } from './econ.js';

export const INN_NIGHTS = [1, 3, 7];
// (Out by mid-morning after the last night.)
export const CHECKOUT = 10 * 60;

// What a stay costs, in a town of this kind: a night, or the longer stays
// a little cheaper by the night.
export function innPrice(L, nights) {
  const base = { village: 6, town: 9, city: 14 }[L.settlement.type] || 9;
  const per = nights >= 7 ? 0.7 : nights >= 3 ? 0.85 : 1;
  return Math.max(1, Math.round(base * nights * per));
}

// The town's taverns that have a room.
export function innsOf(L) {
  return L.buildings.filter((b) => b.type === 'tavern' && b.inn && !b.underConstruction);
}

// The tavern someone keeps (their place of work), if it has a room: an
// innkeeper or barkeep's, or the cook's where there's nobody else.
export function innFor(npc) {
  const rec = npc.rec;
  const L = npc.layout;
  if (!rec || !L || !['innkeeper', 'barkeep', 'cook'].includes(rec.job)) return null;
  const w = rec.work;
  const b = w && w.kind === 'building' ? L.buildings[w.building] : null;
  if (b && b.inn) return b;
  // (A cook lets the room only of the tavern they cook in.)
  if (rec.job === 'cook') return null;
  // (Working somewhere else today: the town's own tavern will do.)
  return innsOf(L)[0] || null;
}

// The stay on a tavern's room just now (null if it's not let).
export function stayAt(L, b, now) {
  const r = L.econ && L.econ.inns && L.econ.inns[b.id];
  return r && r.until > now ? r : null;
}

// Is (x, z) one of a tavern's room beds? Its building if so.
export function innBedAt(L, x, z) {
  // (Round 77: and the rooms upstairs, where it has them.)
  for (const b of innsOf(L)) if (b.inn.beds.some((q) => q.x === x && q.z === z) || (b.lodging || []).some((q) => q.x === x && q.z === z)) return b;
  return null;
}

// Let it, to `pid` (named `who`), for `nights` nights from tonight (or
// on from the end of their stay, if they've one running). Returns it.
export function rentRoom(L, b, pid, who, nights, now) {
  const e = L.econ;
  e.inns ||= {};
  const today = Math.floor(now / DAY);
  // (Before dawn, tonight is the night already begun.)
  const tonight = now % DAY < 6 * 60 ? today - 1 : today;
  const cur = stayAt(L, b, now);
  const mine = !!(cur && cur.pid === pid);
  const from = mine ? Math.round((cur.until - CHECKOUT) / DAY) : tonight;
  const stay = { pid, who, until: (from + nights) * DAY + CHECKOUT, since: mine ? cur.since : now };
  e.inns[b.id] = stay;
  return stay;
}

// How long it has left, in words.
export function stayLeft(stay, now) {
  const n = Math.max(0, Math.ceil((stay.until - CHECKOUT - now) / DAY));
  return n <= 0 ? 'tonight is your last night' : n === 1 ? 'one more night' : `${n} more nights`;
}

// (A room let to someone long gone: what they left behind is the
// keeper's now. Nothing is kept in the room, so there's nothing to do but
// forget it.)
export function sweepInns(L, now) {
  const e = L.econ;
  if (!e || !e.inns) return;
  for (const [id, r] of Object.entries(e.inns)) if (!(r.until > now)) delete e.inns[id];
}
