// (Round 128) The shelves of a library: a few of the world's books on each
// (see books/books.js shelfBooks), to take down and read where you stand.
// Taking one down isn't stealing. Walking out of the library with it is,
// unless you've paid a scholar or a researcher there for it first. A shelf
// anywhere else (someone's house, a shop) is theirs, as any chest is.
import { bookKey } from '../world/bookreg.js';
import { ITEMS } from '../world/items.js';
import { shelfBooks } from './books/books.js';
import { countItem, removeItem } from './inventory.js';
import { buildingAt } from '../sim/sim.js';
import { hash4 } from '../util/rng.js';
import { bare } from '../sim/careers.js';

// Where the town keeps its books for anyone to read.
export const LIBRARIES = new Set(['library', 'academy', 'study', 'college']);
const SLOTS = 9;

// What's on the shelf: its books, put there the first time anyone looks.
export function shelfSlots(game, x, y, z) {
  const w = game.world;
  let slots = w.peekContainer(x, y, z);
  if (slots) return slots;
  slots = new Array(SLOTS).fill(null);
  const n = 2 + (hash4(x, y, z, game.seed ^ 0x5e1f) % 3);
  shelfBooks(game, x, y, z, n).forEach((id, i) => {
    slots[i] = { item: bookKey(id), count: 1 };
  });
  w.putContainer(x, y, z, slots);
  return slots;
}

// Whose the shelf is: a library's (the town's, to read), or whoever's the
// house or shop it stands in.
export function shelfOwner(game, x, y, z) {
  const s = game.world.ow.settlementAt(x, z);
  if (s && !s.deserted && s.condition !== 'abandoned') {
    const L = game.world.getLayout(s);
    const b = L && buildingAt(L, x, z);
    if (b && LIBRARIES.has(b.type)) return { kind: 'library', id: b.id, sid: s.id, label: b.name, b };
  }
  return game.containerOwner(x, y, z);
}

export function openShelf(game, x, y, z) {
  const slots = shelfSlots(game, x, y, z);
  const owner = shelfOwner(game, x, y, z);
  game.audio?.play('chest');
  const title = owner && owner.label ? `Bookshelf · ${owner.label}` : 'Bookshelf';
  game.ui.openContainer(title, slots, { x, y, z, owner, shelf: true });
  if (owner && owner.kind !== 'library' && owner.kind !== 'mine' && owner.kind !== 'host' && owner.kind !== 'work' && owner.sid !== undefined) game.peekWarning(owner);
}

// Books taken down from a library's shelf: the reader's to read here, and
// owed for if they're taken out.
export function tookFromShelf(game, owner, taken) {
  const p = game.player;
  const books = taken.filter((t) => typeof t.item === 'string' && t.item.startsWith('book~'));
  if (!books.length) return;
  p.loans ||= [];
  for (const t of books) {
    const q = p.loans.find((l) => l.item === t.item && l.sid === owner.sid && l.bid === owner.id);
    if (q) q.count += t.count;
    else p.loans.push({ item: t.item, count: t.count, sid: owner.sid, bid: owner.id });
  }
  if (!p.loanTold) {
    p.loanTold = true;
    game.ui.msg('Read it here as long as you like. To take a book out of the library, pay one of its scholars or researchers for it first.', '#e8d8a0');
  }
}

// Put back: owed for no more.
export function putOnShelf(game, owner, added) {
  const p = game.player;
  if (!p.loans) return;
  for (const t of added) {
    const q = p.loans.find((l) => l.item === t.item && l.sid === owner.sid && l.bid === owner.id);
    if (!q) continue;
    q.count -= t.count;
  }
  p.loans = p.loans.filter((l) => l.count > 0);
}

// What the books taken down in a town would cost to take away (those still
// in the pack), and how many.
export function duesIn(game, sid) {
  const p = game.player;
  let cost = 0;
  let n = 0;
  for (const l of p.loans || []) {
    if (l.sid !== sid) continue;
    const k = Math.min(l.count, countItem(p.inv, l.item));
    n += k;
    cost += k * (ITEMS[l.item]?.value || 8);
  }
  return { cost, n };
}

// Paid for: they're the reader's now. False if they haven't the coin.
export function payDues(game, sid, rec) {
  const p = game.player;
  const { cost } = duesIn(game, sid);
  if (countItem(p.inv, 'coin') < cost) return false;
  if (cost) removeItem(p.inv, 'coin', cost);
  const L = game.world.layouts.get(sid);
  if (L && L.econ) L.econ.treasury = (L.econ.treasury || 0) + Math.ceil(cost / 2);
  if (rec) rec.coins = (rec.coins || 0) + Math.floor(cost / 2);
  p.loans = (p.loans || []).filter((l) => l.sid !== sid);
  game.audio?.play('coin');
  return true;
}

// Each moment: a reader who has gone out of the library with books they
// took down and didn't pay for has stolen them.
export function libraryTick(game, dt) {
  const p = game.player;
  if (!p || !p.loans || !p.loans.length) return;
  p.loanT = (p.loanT || 0) - dt;
  if (p.loanT > 0) return;
  p.loanT = 0.4;
  const keep = [];
  const gone = new Map();
  for (const l of p.loans) {
    const L = game.world.layouts.get(l.sid);
    const b = L && L.buildings[l.bid];
    if (!b) continue;
    const here = buildingAt(L, p.x, p.z);
    if (here === b && !game.dungeon) {
      keep.push(l);
      continue;
    }
    const n = Math.min(l.count, countItem(p.inv, l.item));
    if (n <= 0) continue;
    const k = `${l.sid}:${l.bid}`;
    if (!gone.has(k)) gone.set(k, { sid: l.sid, b, items: [] });
    gone.get(k).items.push({ item: l.item, count: n });
  }
  p.loans = keep;
  for (const g of gone.values()) {
    const value = g.items.reduce((s, t) => s + (ITEMS[t.item]?.value || 8) * t.count, 0);
    const names = g.items.map((t) => ITEMS[t.item]?.name || 'a book');
    const desc = `Walking out of the ${bare(g.b.name)} with ${names.length > 1 ? `${names.length} books` : `"${names[0]}"`}, unpaid for`;
    const wits = game.sim.witnesses(g.sid, p.x, p.z, 9);
    game.ui.msg(`You've taken ${names.length > 1 ? 'books' : 'a book'} out of the ${bare(g.b.name)} without paying for ${names.length > 1 ? 'them' : 'it'}.`, '#ffb080');
    if (!wits.length) {
      game.sim.justice.unseen(g.sid, { type: 'theft', x: p.x, z: p.z, value, items: g.items, desc, bid: g.b.id, owner: { kind: 'biz', id: g.b.id }, ownerName: g.b.name });
      continue;
    }
    const keeper = wits.find((n) => n.rec.work && n.rec.work.building === g.b.id) || wits[0];
    keeper.say(['Oi! That book hasn\'t been paid for!', 'Those don\'t leave the library!', 'Thief! Bring that book back!'][hash4(p.x, p.z, value, 3) % 3], 3, '#ffb080');
    game.sim.justice.commit(g.sid, 'theft', { witnesses: wits, value, items: g.items, desc, bid: g.b.id, owner: { kind: 'biz', id: g.b.id }, victimNpc: keeper });
  }
}
