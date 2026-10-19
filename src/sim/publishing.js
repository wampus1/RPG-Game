// (Round 127) Publishing: the writers of the world and what they put out.
// The bookish people of a town (its scholars, its priests, the ones who
// read for pleasure) sit down now and then to write: a novel of their own,
// or, a sequel to it if the first did well, and later a prequel; or a book
// of their town, its annals, its old places, its table. When it's done it
// comes out, and the town hears of it.
//
// Every book there is (the ones on the shelves since before anyone now
// living, and the new ones) is read more or less: how much, its standing,
// rises when it's new, when people buy it and talk of it, and falls away
// again over the weeks, back to what it's always been; and now and then an
// old one is found again. What's read most is what the merchants and the
// shops stock, what the readers of a town go out to buy, and what's in
// their hands on the bench by the well.
import { loreOf } from '../game/books/lore.js';
import { library, metaOf, idOf, GENRES } from '../game/books/books.js';
import { newSeries, addBook, nextBookType } from '../game/books/novels.js';
import { voiceFor } from '../game/books/voice.js';
import { BOOKS, BOOK_HOOKS, TOP_BOOKS, bookKey, bookIdOf } from '../world/bookreg.js';
import { alive, ledger, st, price, invAdd } from './econ.js';
import { stallKeepers } from './shops.js';
import { RNG, hash4 } from '../util/rng.js';

// Who writes: the learned trades, and anyone who reads for pleasure.
const LEARNED = new Set(['scholar', 'priest', 'mayor', 'noble', 'herbalist', 'retired', 'innkeeper']);
const READING = new Set(['book', 'scroll', 'paper', 'ink']);
// Books of a town a writer of it might put out, besides a novel.
const OF_TOWN = ['annals', 'deeps', 'table', 'road'];

function strHash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

export class Publishing {
  constructor(game, sim) {
    this.game = game;
    this.sim = sim;
    // The series written since (novels.js), and the other books.
    this.series = [];
    this.pieces = [];
    // Standing, by book id (only where it's not what it's always been),
    // and how it came out: { start, peak } while it's new.
    this.pop = {};
    this.launch = {};
    this.sold = {};
    this.trend = {};
    this.day = -1;
    // (A book in hand, a book on a stall: what it is, when it's asked.)
    BOOK_HOOKS.resolve = (id) => this.infoOf(id);
    BOOK_HOOKS.sold = (L, rec, item) => this.boughtBy(L, rec, item);
  }

  lore() {
    return loreOf(this.game);
  }

  // ------------------------------------------------------------ standing
  // What a book's standing has always been: an old book of the rolls, a
  // little; a story, more.
  baseOf(id) {
    const h = strHash(id);
    return id.startsWith('novel:') ? 10 + (h % 30) : 4 + (h % 22);
  }

  popOf(id) {
    const p = this.pop[id];
    return p === undefined ? this.baseOf(id) : p;
  }

  bump(id, n) {
    this.pop[id] = Math.max(0, Math.min(100, this.popOf(id) + n));
  }

  // The new books of the writers since, as the library has its own (see
  // books.js library()).
  entries(lore) {
    const out = [];
    for (const s of this.series) {
      const home = lore.ow.settlements[s.home];
      if (!home) continue;
      const subj = { id: s.id, town: s.home, realm: home.civ ? home.civ.id : null, land: home.island || 'thessa', series: s };
      s.books.forEach((b, k) => out.push({ genre: 'novel', subj, n: k }));
    }
    const subjects = (lore._subjects ||= {});
    for (const p of this.pieces) {
      const G = GENRES[p.genre];
      if (!G) continue;
      const list = (subjects[p.genre] ||= G.subjects(lore));
      const subj = list.find((q) => q.id === p.subj);
      if (subj) out.push({ genre: p.genre, subj, n: p.n, meta: { author: p.author, year: p.year } });
    }
    return out;
  }

  // What a book is, for its item and its word: title, writer, year, and
  // how it stands.
  infoOf(id) {
    const lore = this.lore();
    const e = library(lore).find((q) => idOf(q) === id);
    if (!e) return null;
    const m = metaOf(lore, e);
    const town = e.subj.town !== undefined && e.subj.town !== null ? e.subj.town : null;
    return { id, title: m.title, by: m.author.name, year: m.year, genre: e.genre, novel: e.genre === 'novel', town, pop: Math.round(this.popOf(id)) };
  }

  // Once a day, for the whole world: every book's standing drifts back
  // toward what it's always been; the new ones climb to their peak first;
  // now and then an old one is found again. Then what's read most is
  // written up for the shops.
  worldDay(day) {
    if (this.day === day) return;
    const first = this.day < 0;
    this.day = day;
    const rng = new RNG(hash4(this.game.seed, day, 0xb00c5));
    const lore = this.lore();
    const lib = library(lore);
    if (!first) {
      for (const id of Object.keys(this.pop)) {
        const base = this.baseOf(id);
        let p = this.pop[id];
        const L = this.launch[id];
        if (L && day - L.start < 6) p += (L.peak - p) * 0.35;
        else {
          if (L && day - L.start > 60) delete this.launch[id];
          p += (base - p) * 0.035 + rng.float(-1.2, 1.2);
        }
        p = Math.max(0, Math.min(100, p));
        this.trend[id] = p - this.pop[id];
        if (!this.launch[id] && Math.abs(p - base) < 0.6) delete this.pop[id];
        else this.pop[id] = p;
      }
      // (An old book found again: somebody's grandmother's copy, read
      // aloud at the inn, and passed round.)
      if (lib.length && rng.chance(0.12)) {
        const e = rng.pick(lib);
        const id = idOf(e);
        this.bump(id, rng.int(12, 26));
        this.trend[id] = 10;
      }
    }
    // What each book is, and the most read.
    BOOKS.clear();
    const all = [];
    for (const e of lib) {
      const id = idOf(e);
      const m = metaOf(lore, e);
      const info = { id, title: m.title, by: m.author.name, year: m.year, genre: e.genre, novel: e.genre === 'novel', town: e.subj.town ?? null, pop: Math.round(this.popOf(id)) };
      BOOKS.set(id, info);
      all.push(info);
    }
    all.sort((a, b) => b.pop - a.pop);
    TOP_BOOKS.length = 0;
    for (const b of all.slice(0, 8)) TOP_BOOKS.push(bookKey(b.id));
  }

  // The books, each with its weight to be picked (by how it stands, and
  // more for a writer of this town).
  weighted(L) {
    const out = [];
    for (const b of BOOKS.values()) {
      let w = Math.pow(Math.max(1, this.popOf(b.id)), 1.6);
      if (L && b.town === L.settlement.id) w *= 3;
      out.push([b.id, w]);
    }
    return out;
  }

  pickBook(L, rng) {
    const ws = this.weighted(L);
    let total = 0;
    for (const [, w] of ws) total += w;
    if (!total) return null;
    let r = rng.next() * total;
    for (const [id, w] of ws) if ((r -= w) <= 0) return id;
    return ws[ws.length - 1][0];
  }

  // ------------------------------------------------------------ a town's day
  townDay(L, day, rng) {
    this.worldDay(day);
    if (L.settlement.deserted) return;
    this.writers(L, day, rng);
    this.stock(L, day, rng);
    this.readers(L, day, rng);
  }

  // Who's writing, and who finishes.
  writers(L, day, rng) {
    const recent = [...this.series.filter((s) => s.home === L.settlement.id).flatMap((s) => s.books.map((b) => b.day || 0)), ...this.pieces.filter((p) => p.town === L.settlement.id).map((p) => p.day || 0)];
    const lately = recent.filter((d) => day - d < 30).length;
    for (const rec of L.npcs) {
      if (!alive(rec) || rec.away || rec.migrated || rec.visitor || rec.age === 'child' || rec.jailed) continue;
      if (rec.writing) {
        if (day >= rec.writing.done) {
          this.publish(L, rec, day, rng);
          rec.writing = null;
        }
        continue;
      }
      const bookish = LEARNED.has(rec.job) || (rec.hobbies || []).includes('reading') || (rec.traits || []).includes('bookish');
      if (!bookish || lately >= 1) continue;
      // (A writer of a series goes on with it, if the last did well
      // enough and a while has gone by; a new writer starts less often.)
      const mine = this.series.find((s) => s.author.sid === L.settlement.id && s.author.idx === rec.idx);
      let kind;
      if (mine) {
        const last = mine.books[mine.books.length - 1];
        const t = nextBookType(mine);
        if (!t || day - (last.day || 0) < 20 || this.popOf(`novel:${mine.id}:${mine.books.length - 1}`) < 26 || !rng.chance(1 / 30)) continue;
        kind = t;
      } else {
        if ((rec.wrote || 0) >= 2 || !rng.chance(1 / 500)) continue;
        kind = rng.chance(0.65) ? 'novel' : rng.pick(OF_TOWN);
      }
      rec.writing = { kind, start: day, done: day + rng.int(8, 26) };
    }
  }

  signOf(rec, L) {
    const town = L.settlement.name;
    const name = `${rec.name.first} ${rec.name.last}`;
    const T = this.lore().town(L.settlement);
    const f = T.faith;
    const what = rec.job === 'scholar' ? `scholar, of ${town}` : rec.job === 'priest' && f ? `${f.clergy} of ${f.god}, at ${town}` : rec.job === 'mayor' ? `mayor of ${town}` : rec.job === 'herbalist' ? `herbalist, of ${town}` : `of ${town}`;
    return `${name}, ${what}`;
  }

  // A book finished, and out.
  publish(L, rec, day, rng) {
    const lore = this.lore();
    const s0 = L.settlement;
    const year = lore.now;
    const name = `${rec.name.first} ${rec.name.last}`;
    const kind = rec.writing.kind;
    let id = null;
    let title = null;
    let what = 'book';
    if (kind === 'sequel' || kind === 'prequel') {
      const s = this.series.find((q) => q.author.sid === s0.id && q.author.idx === rec.idx);
      const t = s ? nextBookType(s) : null;
      if (!t) return null;
      const b = addBook(lore, s, t, year);
      b.day = day;
      id = `novel:${s.id}:${s.books.length - 1}`;
      title = b.title;
      what = t === 'sequel' ? `sequel to ${s.books[0].title}` : `novel of the years before ${s.books[0].title}`;
      // (A sequel to a book that did well starts where its first left off.)
      const firstPop = this.popOf(`novel:${s.id}:0`);
      this.launch[id] = { start: day, peak: Math.min(100, Math.max(firstPop * 0.95, 30 + rng.int(0, 25))) };
    } else if (kind === 'novel') {
      const sign = this.signOf(rec, L);
      // (Not a title the shelves have already: a few tries at another.)
      let s = null;
      for (let t = 0; t < 8; t++) {
        const seed = hash4(this.game.seed, s0.id, rec.idx, day + t * 7919) >>> 0;
        const author = { name, first: rec.name.first, sign, voice: voiceFor(hash4(this.game.seed, s0.id, rec.idx), sign), sid: s0.id, idx: rec.idx };
        s = newSeries(lore, { seed, home: s0, author, year });
        if (!this.titleTaken(s.books[0].title)) break;
      }
      s.books[0].day = day;
      this.series.push(s);
      id = `novel:${s.id}:0`;
      title = s.books[0].title;
      what = 'novel';
      // (A writer the town already reads starts higher.)
      const fame = Math.max(0, ...this.series.filter((q) => q !== s && q.author.sid === s0.id && q.author.idx === rec.idx).map((q) => this.popOf(`novel:${q.id}:0`)));
      this.launch[id] = { start: day, peak: Math.min(100, 32 + rng.int(0, 40) + fame * 0.3) };
    } else {
      const G = GENRES[kind];
      const list = G ? G.subjects(lore) : [];
      const T = lore.town(s0);
      const subj = list.find((q) => q.town === s0.id) || list.find((q) => q.style && q.style === T.style) || null;
      if (!subj) return null;
      const sign = this.signOf(rec, L);
      const author = { name, first: rec.name.first, sign, voice: voiceFor(hash4(this.game.seed, s0.id, rec.idx), sign), sid: s0.id, idx: rec.idx };
      // (A title of its own, as above: the number it's given picks it.)
      let n = 50 + this.pieces.length * 9;
      for (let t = 0; t < 8; t++, n++) {
        const m = metaOf(lore, { genre: kind, subj, n, meta: { author, year } });
        title = m.title;
        if (!this.titleTaken(title)) break;
      }
      const p = { genre: kind, subj: subj.id, n, author, year, town: s0.id, day };
      this.pieces.push(p);
      id = `${kind}:${subj.id}:${n}`;
      this.launch[id] = { start: day, peak: 15 + rng.int(0, 25) };
    }
    lore._library = null;
    this.pop[id] = 8;
    rec.reading = id;
    rec.wrote = (rec.wrote || 0) + 1;
    invAdd((rec.inv ||= []), bookKey(id), 1);
    this.day = -2;
    this.worldDay(day);
    ledger(L, day, `${name} has written a ${what}: "${title}".`);
    return id;
  }

  titleTaken(title) {
    for (const b of BOOKS.values()) if (b.title === title) return true;
    return false;
  }

  // The merchants and the shops of a town lay in what's being read.
  stock(L, day, rng) {
    const sellers = [];
    for (const r of stallKeepers(L)) if ((r.tier || 1) >= 2 || rng.chance(0.3)) sellers.push({ store: (r.stall ||= {}), rec: r });
    for (const b of L.buildings) {
      const biz = L.econ.biz[b.id];
      if (!biz || b.underConstruction || !biz.store) continue;
      if (Object.keys(biz.store).some((k) => READING.has(k) || k.startsWith('book~'))) sellers.push({ store: biz.store, biz });
    }
    for (const S of sellers) {
      const kinds = Object.keys(S.store).filter((k) => k.startsWith('book~') && S.store[k] > 0);
      // (What nobody reads any more is let go cheap.)
      for (const k of kinds) if (this.popOf(bookIdOf(k)) < 10 && rng.chance(0.08)) delete S.store[k];
      if (kinds.length >= 3 || !rng.chance(0.22)) continue;
      const id = this.pickBook(L, rng);
      if (!id) continue;
      const key = bookKey(id);
      if (S.rec) {
        const cost = Math.max(1, Math.round(price(key) * 0.45));
        if ((S.rec.coins || 0) < cost + 8) continue;
        S.rec.coins -= cost;
      }
      st.add(S.store, key, rng.int(1, 2));
    }
  }

  // The readers of a town pick up something new now and then (their own
  // copy, if they have one; else what everyone's talking of).
  readers(L, day, rng) {
    for (const rec of L.npcs) {
      if (!alive(rec) || rec.away || rec.migrated || rec.age === 'child') continue;
      if (!(rec.hobbies || []).includes('reading') && !(rec.traits || []).includes('bookish') && rec.job !== 'scholar') continue;
      if (rec.reading && day - (rec.readDay || 0) < 4) continue;
      if (!rng.chance(0.15)) continue;
      const own = (rec.inv || []).filter((s) => s && typeof s.item === 'string' && s.item.startsWith('book~')).map((s) => bookIdOf(s.item));
      const id = own.length && rng.chance(0.5) ? rng.pick(own) : this.pickBook(L, rng);
      if (!id) continue;
      rec.reading = id;
      rec.readDay = day;
      this.bump(id, 0.35);
    }
  }

  boughtBy(L, rec, item) {
    const id = bookIdOf(item);
    if (!id) return;
    rec.reading = id;
    rec.readDay = this.game.day;
    this.sold[id] = (this.sold[id] || 0) + 1;
    this.bump(id, 1.5);
  }

  // ------------------------------------------------------------ a word of it
  // A book's title, as it's spoken of (by its id).
  titleOf(id) {
    const b = BOOKS.get(id) || this.infoOf(id);
    return b ? b.title : null;
  }

  rising(id) {
    return (this.trend[id] || 0) > 0.5;
  }

  serialize() {
    return { series: this.series, pieces: this.pieces, pop: this.pop, launch: this.launch, sold: this.sold };
  }

  load(d) {
    if (!d) return;
    this.series = d.series || [];
    this.pieces = d.pieces || [];
    this.pop = d.pop || {};
    this.launch = d.launch || {};
    this.sold = d.sold || {};
    this.day = -1;
    BOOKS.clear();
  }
}
