// Round 127: books written better, and written by the people of the world.
// Every writer has a voice of their own (the chronicler, the storyteller,
// the scholar, the devout, the plain, the lyrical), and one sentence leads
// on to the next; cookery books give what a dish needs and how it's made;
// there are novels (quests, mysteries, romances, each with its cast, its
// town, its old place and its war), with sequels that pick up the thread
// and prequels that go back to the war; and the bookish of every town
// write and publish, their books rising and falling in favour, sold by the
// merchants, bought and read by the townsfolk.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGame, stubInput } from './helpers.mjs';
import { loreOf } from '../src/game/books/lore.js';
import { library, writeBook, metaOf, bookById, idOf } from '../src/game/books/books.js';
import { Writer } from '../src/game/books/write.js';
import { VOICES, voiceFor, asideFits } from '../src/game/books/voice.js';
import { newSeries, addBook, writeNovel, nextBookType, prose } from '../src/game/books/novels.js';
import { FICTION, PLOTS } from '../src/game/books/corpus/fiction.js';
import { RECIPES } from '../src/game/books/corpus/recipes.js';
import { DISHES } from '../src/game/books/corpus/table.js';
import { wellMade } from '../src/game/talk/grammar.js';
import { paginate } from '../src/ui/bookview.js';
import { ITEMS } from '../src/world/items.js';
import { BOOKS, TOP_BOOKS, bookKey } from '../src/world/bookreg.js';
import { needsOf, buyAt } from '../src/sim/shops.js';
import { RNG } from '../src/util/rng.js';
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
const rngOf = (seed) => new RNG(seed);

test('every writer has a voice, and asides fit what is said', () => {
  for (const [id, v] of Object.entries(VOICES)) {
    assert.ok(v.aim > 8 && v.link >= 0 && v.link < 1, id);
    for (const rel of ['then', 'result', 'contrast', 'add']) assert.ok(Array.isArray(v.links[rel]), `${id} ${rel}`);
  }
  // (A writer of the clergy leans devout.)
  let pious = 0;
  for (let i = 0; i < 200; i++) if (voiceFor(i, 'Ada Quill, vicar of the Hearth-Father, at Redford') === 'pious') pious++;
  assert.ok(pious > 100, `${pious}`);
  // ("The gods be thanked" for good news only, and never on the writer's own word.)
  assert.ok(asideFits('+, the gods be thanked,', 'The harvest was so great the barns would not hold it.'));
  assert.ok(!asideFits('+, the gods be thanked,', 'Half the town died of the fever that winter.'));
  assert.ok(!asideFits(', so they say,', 'I have set down what I could find.'));
});

test('sentences are joined in the writer\'s way, and paragraphs read on', () => {
  const { lore } = world();
  // A town's annals: each thing that happened leads on from the last.
  const e = library(lore).find((q) => q.genre === 'annals');
  const b = writeBook(lore, e);
  const text = b.lines.join(' ');
  assert.ok(/(That same year|The very next year|years later|years after that|years on|quiet years|lull of|long peace|record little|scarcely begun to recover|In \d{3,4}|It was in \d{3,4})/.test(text), 'events linked in time');
  // The same paragraph, two voices: not the same words.
  const facts = { town: 'Redford', people: 'Valeborn', ground: 'deep forest', founder: 'Jorn', year: '1100' };
  const a = new Writer(rngOf(7), 'plain').para('land', facts, { min: 2, max: 3 });
  const c = new Writer(rngOf(7), 'lyrical').para('land', facts, { min: 2, max: 3 });
  assert.ok(a && c && a !== c);
  // Every book in the world still writes whole, with no blank unfilled.
  for (const q of library(lore).slice(0, 60)) {
    const w = writeBook(lore, q);
    assert.ok(w.lines.length > 4, w.title);
    for (const l of w.lines) assert.ok(!/\{\w+\}/.test(l), `${w.title}: ${l}`);
  }
});

test('a cookery book gives what each dish needs, and the method, numbered', () => {
  const { lore } = world();
  for (const k of Object.keys(DISHES)) {
    const R = RECIPES[k];
    assert.ok(R && R.needs.length >= 2 && R.steps.length >= 3 && R.serves, k);
  }
  const e = library(lore).find((q) => q.genre === 'table');
  const b = writeBook(lore, e);
  assert.ok(b.lines.includes('## You Will Need'));
  assert.ok(b.lines.some((l) => /^- [A-Z]/.test(l)));
  assert.ok(b.lines.some((l) => /^1\. [A-Z]/.test(l)) && b.lines.some((l) => /^3\. [A-Z]/.test(l)));
  // The reader sets a list with its mark hung in the margin.
  const pages = paginate(['# I. Of Bread', 'A loaf.', '## You Will Need', '- Flour', '- Water', '## The Method', '1. Mix it.', '2. Bake it.'], { w: 300, h: 400, size: 12, measure: (t, s) => t.length * s * 0.5 });
  const rows = pages.flatMap((p) => p.rows).filter((r) => r.mark);
  assert.deepEqual(rows.map((r) => r.mark), ['•', '•', '1.', '2.']);
});

test('the fiction corpus is well made, and every plot\'s beats have words', () => {
  for (const [k, list] of Object.entries(FICTION)) for (const t of list) assert.ok(wellMade(t), `${k}: ${t.slice(0, 60)}`);
  for (const [k, plot] of Object.entries(PLOTS)) assert.ok(plot.length >= 3, k);
  assert.equal(prose('"the lamp," {he} said. {thing} was gone.', { he: 'she', thing: 'the bell' }), '"The lamp," she said. The bell was gone.');
});

test('a novel: chapters of one story, its cast and setting from the world', () => {
  const { game, lore } = world();
  for (const kind of ['quest', 'mystery', 'romance']) {
    const home = game.world.ow.settlements[1];
    const s = newSeries(lore, { seed: 99 + kind.length, home, author: { name: 'Ada Quill', sign: 'Ada Quill, of ' + home.name, voice: 'storyteller' }, year: 1176, kind });
    const b = writeNovel(lore, s, 0);
    const chapters = b.lines.filter((l) => /^# Chapter /.test(l));
    assert.ok(chapters.length >= 4, `${kind}: ${chapters.length} chapters`);
    const text = b.lines.join(' ');
    assert.ok(!/\{\w+\}/.test(text), `${kind}: a blank unfilled`);
    // The same hero and town all the way through, and the elder's war.
    assert.ok(text.split(s.cast.hero.first).length > 6, `${kind}: hero`);
    assert.ok(text.includes(home.name), `${kind}: town`);
    assert.ok(text.split(s.cast.mentor.first).length > 2, `${kind}: elder`);
    // Paragraphs of story, and people talking.
    assert.ok(b.lines.some((l) => /"[^"]+," (said|[a-z]+ said)/.test(l) || /said [A-Z][a-z]+\./.test(l)), `${kind}: dialogue`);
    // (Written the same every time it's opened.)
    assert.deepEqual(writeNovel(lore, s, 0).lines, b.lines);
  }
});

test('a sequel picks up the thread; a prequel goes back to the war', () => {
  const { game, lore } = world();
  const home = game.world.ow.settlements[2];
  let seen = 0;
  for (let i = 0; i < 12; i++) {
    const s = newSeries(lore, { seed: 500 + i, home, author: { name: 'Ada Quill', sign: 'Ada Quill', voice: 'plain' }, year: 1178, kind: ['quest', 'mystery', 'romance'][i % 3] });
    const o = s.books[0];
    assert.equal(nextBookType(s), 'sequel');
    addBook(lore, s, 'sequel', 1185);
    const sq = writeNovel(lore, s, 1).lines.join(' ');
    // (Seven years on, and it says so; the first book named in the front.)
    assert.ok(/seven years/i.test(sq), 'years since');
    assert.ok(sq.includes(s.books[0].title), 'the first book');
    // What became of them: the elder dead is mourned, the villain who fled
    // comes back, the one who died has a child.
    if (o.mfate === 'dead') assert.ok(sq.includes(`candle for ${s.cast.mentor.first}`) || sq.includes(`${s.cast.mentor.first} had sat`), 'elder remembered');
    if (o.call === 'villain' || o.call === 'caught') assert.ok(sq.includes(s.cast.villain.first), 'the villain again');
    if (o.call === 'kin' && s.kind !== 'romance') assert.ok(sq.includes(s.cast.villain2.first), 'the villain\'s kin');
    if (s.war) {
      assert.equal(nextBookType(s), 'prequel');
      addBook(lore, s, 'prequel', 1190);
      const pq = writeNovel(lore, s, 2).lines.join(' ');
      assert.ok(pq.includes(s.war) || pq.includes(s.battle) || pq.toLowerCase().includes(s.battle.toLowerCase()), 'the war');
      assert.ok(pq.includes(`young ${s.cast.mentor.first}`) || pq.includes(s.cast.mentor.first), 'the elder young');
      assert.equal(nextBookType(s), null);
      seen++;
    }
  }
  assert.ok(seen > 0, 'a prequel at least once');
});

test('novels are on the shelves already: old series, with their sequels', () => {
  const { lore } = world();
  const novels = library(lore).filter((e) => e.genre === 'novel');
  assert.ok(novels.length >= 3);
  const m = metaOf(lore, novels[0]);
  assert.equal(m.title, novels[0].subj.series.books[novels[0].n].title);
  assert.ok(bookById(lore, idOf(novels[0])).lines.length > 6);
});

test('the bookish write and publish; books rise and fall; merchants stock them; townsfolk buy and read them', () => {
  const game = makeGame(777);
  for (let i = 0; i < 4; i++) game.update(0.1, input);
  const Ls = game.world.ow.settlements.slice(0, 5).map((s) => game.sim.layoutOf(s.id));
  const pub = game.sim.publishing;
  // (A writer set to finish today: out it comes, and the town hears of it.)
  const L = Ls[0];
  const rec = L.npcs.find((r) => r.age !== 'child' && r.alive !== false);
  rec.writing = { kind: 'novel', start: 0, done: 1 };
  const rng = rngOf(3);
  pub.townDay(L, 1, rng);
  assert.equal(pub.series.length, 1);
  const s = pub.series[0];
  const id = `novel:${s.id}:0`;
  assert.ok(L.econ.ledger.some((q) => q.text.includes(s.books[0].title) && q.text.includes(rec.name.first)));
  assert.equal(rec.reading, id);
  // On the shelves of the world now, and an item of its own.
  game._bookLore = null;
  const lore = loreOf(game);
  assert.ok(library(lore).some((e) => idOf(e) === id));
  const it = ITEMS[bookKey(id)];
  assert.equal(it.name, s.books[0].title.length > 34 ? it.name : s.books[0].title);
  assert.equal(it.kind, 'book');
  // New, it climbs; then it falls away again.
  const p0 = pub.popOf(id);
  for (let d = 2; d < 8; d++) pub.worldDay(d);
  const peak = pub.popOf(id);
  assert.ok(peak > p0 + 10, `${p0} -> ${peak}`);
  for (let d = 8; d < 120; d++) pub.worldDay(d);
  assert.ok(pub.popOf(id) < peak - 5, `${peak} -> ${pub.popOf(id)}`);
  // What's read most, the readers go to the shops for.
  assert.ok(TOP_BOOKS.length > 0 && TOP_BOOKS.every((k) => BOOKS.has(k.slice(5))));
  const reader = L.npcs.find((r) => r.age !== 'child' && r.alive !== false && r !== rec);
  reader.hobbies = ['reading'];
  const need = needsOf(L, reader).find((n) => n.key === 'reading');
  assert.ok(need.items.some((k) => k.startsWith('book~')));
  // Merchants and shops lay in copies of what's read.
  for (let d = 120; d < 160; d++) for (const T of Ls) pub.townDay(T, d, rngOf(d * 7 + T.settlement.id));
  let stocked = 0;
  for (const T of Ls) {
    for (const r of T.npcs) for (const k of Object.keys(r.stall || {})) if (k.startsWith('book~')) stocked++;
    for (const b of Object.values(T.econ.biz)) for (const k of Object.keys(b.store || {})) if (k.startsWith('book~')) stocked++;
  }
  assert.ok(stocked > 0, 'stocked');
  // Bought: a copy in hand, a sale to its name, and something to read.
  const store = { [bookKey(id)]: 2 };
  const seller = L.npcs.find((r) => r.job === 'merchant') || rec;
  seller.stall = store;
  reader.coins = 500;
  const before = pub.popOf(id);
  const got = buyAt(L, reader, { seller: L.npcs.indexOf(seller), item: bookKey(id), items: [bookKey(id)] }, 160);
  assert.ok(got && got.item === bookKey(id));
  assert.equal(reader.reading, id);
  assert.ok(pub.popOf(id) > before);
  // Kept with the world.
  const saved = JSON.parse(JSON.stringify(pub.serialize()));
  const g2 = makeGame(777);
  g2.sim.publishing.load(saved);
  assert.equal(g2.sim.publishing.series[0].books[0].title, s.books[0].title);
  assert.ok(Math.abs(g2.sim.publishing.popOf(id) - pub.popOf(id)) < 0.01);
});

test('version 1.27.0, and a world from 1.26 is brought up to it', () => {
  assert.equal(GAME_VERSION, '1.27.0');
  assert.ok(compareVersions('1.26.0', GAME_VERSION) < 0);
  assert.ok(stepsFor('1.26.0').some((q) => q.to === '1.27.0'));
});
