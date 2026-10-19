// Round 126: books, written. Every shelf holds one of the world's own books
// (a town's annals, a realm's history, a war, a traveller's road, a
// people's table, the old places, the beasts of a land, the Kavorent, a
// faith), many pages long, walked out of word chains learned from a library
// of good sentences and filled in from the world: the same long past in
// every book (when each people came, the kings, the old wars and the towns
// they gave away), cited from one book to another, and read held open, two
// pages at a time, the leaves turning.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGame, stubInput } from './helpers.mjs';
import { loreOf } from '../src/game/books/lore.js';
import { library, writeBook, metaOf, bookAt, GENRES, plural } from '../src/game/books/books.js';
import { Ngram, compose } from '../src/game/books/ngram.js';
import { plan } from '../src/game/books/write.js';
import { paginate, isBookDoc } from '../src/ui/bookview.js';
import { DocumentWindow } from '../src/ui/document.js';
import { GAME_VERSION, compareVersions } from '../src/version.js';
import { stepsFor } from '../src/game/migrate.js';

const input = stubInput();
let W = null;
function world() {
  if (W) return W;
  const game = makeGame(12345);
  for (let i = 0; i < 4; i++) game.update(0.1, input);
  for (const s of game.world.ow.settlements.slice(0, 6)) game.sim.layoutOf(s.id);
  game._bookLore = null;
  W = { game, lore: loreOf(game) };
  return W;
}

test('the long past: one for the world, and it agrees with the world as it is', () => {
  const { game, lore } = world();
  assert.ok(lore.realms.length >= 2);
  for (const R of lore.realms) {
    // A line of rulers from the founding to now, one after another.
    assert.ok(R.kings.length >= 2);
    assert.equal(R.kings[0].from, R.founded);
    for (let i = 1; i < R.kings.length; i++) assert.equal(R.kings[i].from, R.kings[i - 1].to + 1);
    assert.ok(R.came < R.founded && R.founded < lore.now);
    for (const k of R.kings) if (k.how === 'died in battle') assert.ok(k.war, 'nobody dies in battle without a war');
  }
  assert.ok(lore.wars.length >= 1);
  for (const w of lore.wars.filter((q) => !q.live)) {
    assert.ok(w.start <= w.end && w.end < lore.now);
    for (const b of w.battles) assert.ok(b.y >= w.start && b.y <= w.end);
    // A town given up in a war is the winner's now.
    if (w.ceded) assert.equal(w.ceded.civ, w.victor.civ);
  }
  // The same past, asked for again.
  game._bookLore = null;
  const again = loreOf(game);
  assert.deepEqual(again.wars.map((w) => `${w.name}:${w.start}`), lore.wars.map((w) => `${w.name}:${w.start}`));
  game._bookLore = { key: `${game.seed}:${game.day}`, lore };
});

test('the library: every kind of book, each written the same every time, many pages long, nothing left blank', () => {
  const { lore } = world();
  const lib = library(lore);
  const kinds = new Set(lib.map((e) => e.genre));
  for (const g of ['annals', 'realm', 'war', 'road', 'table', 'deeps', 'elders', 'beasts', 'faith']) assert.ok(kinds.has(g), `a book of kind ${g}`);
  for (const g of kinds) {
    const e = lib.find((q) => q.genre === g);
    const a = writeBook(lore, e);
    const b = writeBook(lore, e);
    assert.deepEqual(a.lines, b.lines, `${g}: the same book every time`);
    assert.ok(a.title && a.by && a.year);
    assert.ok(a.lines.filter((l) => l === '\f').length >= 3, `${g}: several chapters, a page each`);
    const text = a.lines.join(' ');
    assert.ok(!/\{\w+\}/.test(text), `${g}: no blank left unfilled`);
    assert.ok(!/undefined|null|NaN/.test(text), g);
    // No sentence twice.
    const seen = new Set();
    for (const l of a.lines) for (const s of l.match(/[^.!?]+[.!?]+/g) || []) {
      const t = s.trim();
      if (t.length > 25) assert.ok(!seen.has(t), `${g}: said twice: ${t}`);
      seen.add(t);
    }
  }
});

test('a book tells of nothing after it was written, and cites only older books that are in the library', () => {
  const { lore } = world();
  const lib = library(lore);
  // (Two books may share a title: two accounts of one war.)
  const titles = new Map();
  for (const e of lib) {
    const m = metaOf(lore, e);
    if (!titles.has(m.title)) titles.set(m.title, []);
    titles.get(m.title).push(m);
  }
  for (const e of lib.filter((q) => q.genre === 'annals' || q.genre === 'war')) {
    const b = writeBook(lore, e);
    for (const l of b.lines) for (const y of l.match(/\b(\d{3,4})\b/g) || []) if (+y > 700) assert.ok(+y <= b.year, `${b.title} (${b.year}) tells of ${y}`);
  }
  let cites = 0;
  for (const e of lib) {
    const b = writeBook(lore, e);
    for (const [t, ms] of titles) {
      if (t === b.title) continue;
      if (b.lines.some((l) => !/^#/.test(l) && l.includes(` ${t},`))) {
        cites++;
        assert.ok(ms.some((m) => m.year < b.year), `${b.title} cites ${t}, written before it`);
      }
    }
  }
  assert.ok(cites > 0, 'books cite one another');
});

test('the realm\'s history, its wars and its towns\' annals tell the same past', () => {
  const { lore } = world();
  const lib = library(lore);
  const w = lore.wars.find((q) => !q.live && q.terms === 'ceded');
  if (!w) return;
  const book = writeBook(lore, lib.find((e) => e.genre === 'war' && e.subj.war === w));
  assert.ok(book.lines.some((l) => l.includes(`${w.ceded.name} passed from ${w.loser.name} to ${w.victor.name}`)));
  for (const b of w.battles) assert.ok(book.lines.some((l) => l.toLowerCase().includes(b.name.toLowerCase())), b.name);
  const rb = lib.filter((e) => e.genre === 'realm' && e.subj.R === w.victor).map((e) => writeBook(lore, e)).find((b) => b.year > w.end);
  if (rb) assert.ok(rb.lines.some((l) => l.includes(w.name)), 'the victor\'s history tells of the war');
});

test('the chains: sentences walked from the library, joined only where a clause ends, never repeating a turn of phrase', () => {
  const m = new Ngram();
  const lines = [
    'The fire began in a baker\'s shop near the square, and the wind carried it from roof to roof.',
    'The flood came in the night, and the wind carried the boats from the river to the square.',
    'The plague came with the traders, and it spread from house to house faster than word of it.',
  ];
  lines.forEach((l, i) => m.train(l, 1, i));
  let rng = 1;
  const R = { next: () => ((rng = (rng * 16807) % 2147483647) / 2147483647) };
  const ban = new Set();
  const outs = [];
  for (let i = 0; i < 40; i++) {
    const s = compose(m, R, { min: 6, max: 30, tries: 8, ban: new Set() });
    if (s) outs.push(s);
  }
  assert.ok(outs.length > 10);
  for (const s of outs) {
    // A join falls after a comma, or an "and": every sentence starts as one
    // of the library's begins.
    assert.ok(lines.some((l) => l.split(' ').slice(0, 2).join(' ') === s.words.slice(0, 2).join(' ')));
    assert.ok(/[.!?]$/.test(s.line));
  }
  const s1 = compose(m, R, { min: 6, max: 30, tries: 8, ban });
  assert.ok(s1);
  const s2 = compose(m, R, { min: 6, max: 30, tries: 8, ban });
  if (s2) assert.ok(!s1.ph.some((p) => s2.ph.includes(p)), 'no turn of phrase twice');
  // The moves of a paragraph, walked in an order the library's writers used.
  const mv = plan('event', { next: Math.random }, () => true, { min: 2, max: 5 });
  assert.equal(mv[0], 'when');
});

test('plurals as they\'re said', () => {
  assert.equal(plural('wolf'), 'wolves');
  assert.equal(plural('sheep'), 'sheep');
  assert.equal(plural('keeper of the well'), 'keepers of the well');
  assert.equal(plural('spore-wife'), 'spore-wives');
  assert.equal(plural('maw larva'), 'maw larvae');
});

test('a book set in pages: chapters on fresh pages, a drop cap, no line alone, two pages to a spread', () => {
  const { lore } = world();
  const b = writeBook(lore, library(lore).find((e) => e.genre === 'annals'));
  const measure = (t, size) => t.length * size * 0.48;
  const pages = paginate(b.lines, { w: 330, h: 390, size: 17, measure });
  assert.ok(pages.length >= 6, `${pages.length} pages`);
  for (const p of pages) assert.ok(p.rows.some((r) => r.t !== 'gap'), 'no empty page');
  assert.ok(pages.some((p) => p.rows.some((r) => r.t === 'text' && r.cap)), 'a drop cap');
  assert.ok(pages.every((p) => p.rows.every((r) => r.y + r.h <= 390 + 0.01)), 'nothing past the foot of the page');
  // (Not a lone last line of a paragraph at the top of a page.)
  for (const p of pages.slice(1)) {
    const first = p.rows.find((r) => r.t !== 'gap');
    const second = p.rows.filter((r) => r.t !== 'gap')[1];
    if (first && first.t === 'text' && first.last && !first.cap) assert.ok(!second || second.t !== 'text' || second.x0 > 0, 'a widow');
  }
  const doc = { title: b.title, lines: b.lines, kind: 'book', by: b.by, year: b.year };
  assert.ok(isBookDoc(doc));
  assert.ok(!isBookDoc({ kind: 'letter', lines: ['Dear Wren,', '- Mags'] }));
  const ui = { mouse: { x: 0, y: 0 }, audio: null, close() {}, windows: [] };
  const d = new DocumentWindow(ui, doc);
  assert.ok(d.bookMode);
  assert.equal(d.spread, 0);
});

test('a shelf in a town holds that town\'s books more often than not', () => {
  const { game, lore } = world();
  const s = game.world.ow.settlements.find((q) => lore.town(q).hist && q.type !== 'village') || game.world.ow.settlements[0];
  const T = lore.town(s);
  let local = 0;
  let n = 0;
  for (let i = 0; i < 30; i++) {
    const b = bookAt(game, s.bounds.x0 + i, 64, s.bounds.z0 + (i % 5));
    assert.ok(b && b.lines.length > 5);
    n++;
    if (b.lines.join(' ').includes(T.name) || b.title.includes(T.name)) local++;
  }
  assert.ok(local >= n * 0.4, `${local}/${n} about ${T.name}`);
});

test('version 1.26.0, and a world from 1.25 is brought up to it', () => {
  assert.equal(GAME_VERSION, '1.26.0');
  assert.ok(compareVersions('1.25.0', GAME_VERSION) < 0);
  assert.ok(stepsFor('1.25.0').some((s) => s.to === '1.26.0'));
  assert.ok(Object.keys(GENRES).length >= 9);
});
