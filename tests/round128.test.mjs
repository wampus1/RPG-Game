// Round 128: books in multiplayer; library shelves to take books from (and
// the theft of walking out with one unpaid); wagons clicked and walked
// into; the jail cell made room in; bigger city inns; acacias felled whole;
// rafts in the wind; books that don't repeat themselves, recipes the game's
// own, and each people's books set in their own type.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { makeGame, stubUI, stubInput } from './helpers.mjs';
import { B } from '../src/world/blocks.js';
import { REGION_W, REGION_D, GROUND } from '../src/config.js';
import { ITEMS } from '../src/world/items.js';
import { addItem, countItem } from '../src/game/inventory.js';
import { shelfSlots, shelfOwner, duesIn, payDues, libraryTick } from '../src/game/library.js';
import { shelfBooks, library, writeBook, retell } from '../src/game/books/books.js';
import { loreOf } from '../src/game/books/lore.js';
import { Writer } from '../src/game/books/write.js';
import { RNG } from '../src/util/rng.js';
import { RECIPES } from '../src/game/books/corpus/recipes.js';
import { DISH_RECIPES, recipesFor } from '../src/world/recipes.js';
import { TYPES, FACES, typeFor } from '../src/ui/booktype.js';
import { paginate } from '../src/ui/bookview.js';
import { TREE_BUILDERS } from '../src/world/trees.js';
import { steer } from '../src/entities/raft.js';
import { windOf } from '../src/game/ships3d.js';
import { HostNet } from '../src/net/host.js';
import { uiFrame } from '../src/net/uiwire.js';
import { Grid } from '../src/ui/ascii.js';
import { asSeat } from '../src/game/party.js';
import { BOOKS } from '../src/world/bookreg.js';
import { GAME_VERSION, compareVersions } from '../src/version.js';
import { stepsFor } from '../src/game/migrate.js';

// A town's library and one of its shelves (the region it's in loaded).
function aLibrary(g) {
  const w = g.world;
  for (const s of w.ow.settlements) {
    const L = w.getLayout(s);
    const b = L.buildings.find((q) => q.type === 'library');
    if (!b) continue;
    w.loadRegion(Math.floor(b.x0 / REGION_W), Math.floor(b.z0 / REGION_D));
    for (let z = b.z0; z <= b.z1; z++) for (let x = b.x0; x <= b.x1; x++) for (let y = 1; y < 64; y++) if (w.getBlock(x, y, z) === B.bookshelf) return { s, L, b, x, y, z };
  }
  return null;
}

test('a library shelf holds a few books of its own, the same each time, to take down', () => {
  const g = makeGame();
  const at = aLibrary(g);
  assert.ok(at, 'a library with shelves');
  const slots = shelfSlots(g, at.x, at.y, at.z);
  const books = slots.filter(Boolean);
  assert.ok(books.length >= 2 && books.length <= 4, `${books.length} books`);
  assert.equal(new Set(books.map((q) => q.item)).size, books.length, 'each a different book');
  for (const q of books) assert.ok(q.item.startsWith('book~') && ITEMS[q.item].kind === 'book');
  assert.equal(shelfSlots(g, at.x, at.y, at.z), slots, 'kept as it is');
  assert.deepEqual(shelfBooks(g, at.x, at.y, at.z, books.length), books.map((q) => q.item.slice(5)));
  const o = shelfOwner(g, at.x, at.y, at.z);
  assert.equal(o.kind, 'library');
  assert.equal(o.id, at.b.id);
});

test('taken down in the library it is no theft; walked out with, unpaid, it is', () => {
  const g = makeGame();
  const at = aLibrary(g);
  const p = g.player;
  p.teleport(Math.round((at.b.x0 + at.b.x1) / 2), at.y, Math.round((at.b.z0 + at.b.z1) / 2));
  const owner = shelfOwner(g, at.x, at.y, at.z);
  const t = shelfSlots(g, at.x, at.y, at.z).find(Boolean);
  addItem(p.inv, t.item, 1);
  assert.equal(g.onContainerTake({ owner }, [{ item: t.item, count: 1 }]), false, 'not a theft');
  assert.equal(g.sim.justice.unsolved.length, 0);
  assert.equal(duesIn(g, at.s.id).n, 1);
  libraryTick(g, 1);
  assert.equal(p.loans.length, 1, 'still the library\'s, read inside it');
  // Put back: owed for no more.
  g.onContainerPut({ owner }, [{ item: t.item, count: 1 }]);
  assert.equal(p.loans.length, 0);
  // Taken again, and out of the door with it.
  g.onContainerTake({ owner }, [{ item: t.item, count: 1 }]);
  p.teleport(at.b.x0 - 3, at.y, at.b.z0 - 3);
  libraryTick(g, 1);
  assert.equal(p.loans.length, 0);
  const crime = g.sim.justice.unsolved.find((u) => /library/i.test(u.desc));
  assert.ok(crime && crime.type === 'theft' && crime.items[0].item === t.item, 'a theft, noticed later');
});

test('paid for with a scholar of the town, a book goes out of the library with you', () => {
  const g = makeGame();
  const at = aLibrary(g);
  const p = g.player;
  p.teleport(Math.round((at.b.x0 + at.b.x1) / 2), at.y, Math.round((at.b.z0 + at.b.z1) / 2));
  const owner = shelfOwner(g, at.x, at.y, at.z);
  const t = shelfSlots(g, at.x, at.y, at.z).find(Boolean);
  addItem(p.inv, t.item, 1);
  g.onContainerTake({ owner }, [{ item: t.item, count: 1 }]);
  const cost = duesIn(g, at.s.id).cost;
  assert.equal(cost, ITEMS[t.item].value);
  addItem(p.inv, 'coin', cost + 5);
  const had = countItem(p.inv, 'coin');
  assert.ok(payDues(g, at.s.id, null));
  assert.equal(countItem(p.inv, 'coin'), had - cost);
  p.teleport(at.b.x0 - 3, at.y, at.b.z0 - 3);
  libraryTick(g, 1);
  assert.equal(g.sim.justice.unsolved.length, 0, 'no theft');
  assert.equal(countItem(p.inv, t.item), 1);
});

test('books taken down are kept with the save', () => {
  const g = makeGame();
  g.player.loans = [{ item: 'book~annals:t0:0', count: 1, sid: 0, bid: 3 }];
  const d = JSON.parse(JSON.stringify(g.serialize()));
  const g2 = makeGame();
  g2.applySave(d);
  assert.deepEqual(g2.player.loans, g.player.loans);
});

test('a guest is sent the names of the books they carry, and a book is sent to their screen once', () => {
  const g = makeGame();
  g.startParty({ id: 'h', name: 'Hosty' });
  const seat = g.addSeat({ id: 'g', name: 'Guesty' }, { ui: stubUI(), input: stubInput(), hero: null });
  const lore = loreOf(g);
  const e = library(lore)[3];
  const id = `${e.genre}:${e.subj.id}:${e.n}`;
  asSeat(g, seat, () => addItem(g.player.inv, `book~${id}`, 1));
  const net = Object.create(HostNet.prototype);
  net.game = g;
  const own = asSeat(g, seat, () => net.ownState({ seat }, 1));
  assert.ok(own.books && own.books[id], 'its title and writer sent');
  assert.equal(own.books[id].title, writeBook(lore, e).title);
  BOOKS.delete(id);
  // (What the guest does with it.)
  for (const [k, b] of Object.entries(own.books)) BOOKS.set(k, b);
  assert.equal(ITEMS[`book~${id}`].name.slice(0, 20), own.books[id].title.slice(0, 20));
  // A whole book to read goes to the screen once, not again with every
  // frame.
  const ui = { windows: [{ doc: { title: 'T', lines: ['a', 'b'] }, grid: new Grid(4, 4), w: 4, h: 4, x: 0, y: 0, draw() {} }], cursorStack: null };
  const last = {};
  const f1 = uiFrame(ui, g, last);
  const f2 = uiFrame(ui, g, last);
  assert.ok(f1.wins[0].doc && !f1.wins[0].docd);
  assert.ok(!f2.wins[0].doc && f2.wins[0].docd);
});

test('a guest who walks out of a library with a book unpaid is the one who stole it', () => {
  const g = makeGame();
  const at = aLibrary(g);
  g.startParty({ id: 'h', name: 'Hosty' });
  const seat = g.addSeat({ id: 'g', name: 'Guesty' }, { ui: stubUI(), input: stubInput(), hero: null });
  const owner = shelfOwner(g, at.x, at.y, at.z);
  const t = shelfSlots(g, at.x, at.y, at.z).find(Boolean);
  asSeat(g, seat, () => {
    g.player.teleport(Math.round((at.b.x0 + at.b.x1) / 2), at.y, Math.round((at.b.z0 + at.b.z1) / 2));
    addItem(g.player.inv, t.item, 1);
    g.onContainerTake({ owner }, [{ item: t.item, count: 1 }]);
    g.player.teleport(at.b.x0 - 3, at.y, at.b.z0 - 3);
  });
  assert.ok(!g.player.loans || !g.player.loans.length, 'the host owes nothing');
  asSeat(g, seat, () => libraryTick(g, 1));
  const crime = asSeat(g, seat, () => g.sim.justice.unsolved.find((u) => /library/i.test(u.desc)));
  assert.ok(crime, 'the guest\'s theft');
});

test('a parked wagon is solid to walk into (not to the townsfolk, who go round it as ever)', () => {
  const g = makeGame();
  const p = g.player;
  const q = { kind: 'prop', type: 'wagon', x: p.x + 6, y: p.y, z: p.z, face: 0, ang: 0, horse: true };
  g.props.set('test-wagon', q);
  assert.ok(g.wagonAt(q.x, q.y, q.z, p), 'its bed');
  assert.ok(g.occupiedBySolid(q.x, q.y, q.z, p));
  assert.ok(!g.occupiedBySolid(q.x, q.y, q.z + 6, p), 'nothing far off');
  q.moving = true;
  assert.ok(!g.wagonAt(q.x, q.y, q.z, p), 'a moving one: driven round you, as before');
});

test('the town\'s cell made room in: whoever is doing time there is let out by its door', () => {
  const g = makeGame();
  let found = null;
  for (const s of g.world.ow.settlements) {
    const L = g.world.getLayout(s);
    if (L.jail && L.npcs.some((r) => r.ent)) { found = { s, L }; break; }
    if (L.jail) { g.activateSettlement?.(s); if (L.npcs.some((r) => r.ent)) { found = { s, L }; break; } }
  }
  if (!found) return;
  const { L } = found;
  const r = L.npcs.find((q) => q.ent && !q.ent.dead);
  const J = L.jail;
  g.world.loadRegion(Math.floor(J.front.x / REGION_W), Math.floor(J.front.z / REGION_D));
  r.ent.state = 'jailed';
  r.ent.teleport(J.cell[0].x, J.y, J.cell[0].z);
  assert.equal(g.sim.justice.makeRoom(L), 1);
  assert.notEqual(r.ent.state, 'jailed');
  assert.ok(!J.cell.some((c) => c.x === r.ent.x && c.z === r.ent.z), 'not in the cell');
});

test('a city\'s tavern is laid out bigger, for the crowds', () => {
  const g = makeGame(12345, { wg: 9 });
  // (Where there's the room: the old size, 11 by 7, where there isn't.)
  let seen = 0;
  let big = 0;
  for (const s of g.world.ow.settlements) {
    if (s.type !== 'city' && !s.empire) continue;
    const L = g.world.getLayout(s);
    for (const b of L.buildings.filter((q) => q.type === 'tavern')) {
      seen++;
      if ((b.x1 - b.x0 + 1) * (b.z1 - b.z0 + 1) > 11 * 7) big++;
    }
    if (seen >= 6) break;
  }
  assert.ok(seen > 0 && big > 0, `${big} of ${seen} bigger`);
});

test('an acacia comes down whole from its bottom log, crooked bough and all', () => {
  const g = makeGame();
  const w = g.world;
  const p = g.player;
  let r = 0.3;
  const rand = () => (r = ((r * 9301 + 49297) % 233280) / 233280);
  for (const kind of ['acacia', 'oak', 'palm']) {
    const x = p.x + 10;
    const z = p.z + 10;
    const y = GROUND;
    // (Cleared well round, so no tree of the world's own holds a leaf up.)
    for (let dy = 0; dy < 10; dy++) for (let dz = -7; dz <= 7; dz++) for (let dx = -7; dx <= 7; dx++) w.setBlock(x + dx, y + dy, z + dz, B.air);
    const cells = TREE_BUILDERS[kind](rand);
    for (const [dx, dy, dz, id] of cells) w.setBlock(x + dx, y + dy, z + dz, id);
    assert.ok(g.isTreeLog(x, y, z), `${kind}: a tree`);
    g.fellTree(x, y, z, []);
    let left = 0;
    for (let dy = 0; dy < 10; dy++) for (let dz = -4; dz <= 4; dz++) for (let dx = -4; dx <= 4; dx++) if (w.getBlock(x + dx, y + dy, z + dz) !== B.air) left++;
    assert.equal(left, 0, `${kind}: nothing left standing`);
  }
});

test('a raft runs faster with the wind behind it than into it, and a gale more so', () => {
  const g = makeGame();
  const W = windOf(g);
  const run = (ang) => {
    const p = { kind: 'npc', game: g, raft: { x: 0, z: 0, ang, v: 0 }, x: 0, z: 0, fx: 0, fz: 0, dir: 0 };
    let top = 0;
    const input = { isDown: (k) => k === 'KeyW' };
    const orig = g.occupiedBySolid;
    for (let i = 0; i < 200; i++) {
      p.raft.x = 0;
      p.raft.z = 0;
      try {
        steer(p, 0.05, input);
      } catch {
        // (Only its speed is wanted here.)
      }
      top = Math.max(top, p.raft.v);
    }
    g.occupiedBySolid = orig;
    return top;
  };
  const down = run(W.ang);
  const up = run(W.ang + Math.PI);
  assert.ok(down > up, `${down} with, ${up} against`);
  g.weather = { kind: 'rain', level: 1, blow: 1, gust: 1 };
  assert.ok(windOf(g).k > W.k, 'the gale fills the sails');
  g.weather = { kind: 'fog', level: 1 };
  assert.ok(windOf(g).k < W.k + 0.01, 'still air in a fog');
});

test('a book says nothing twice in the same words, in a later chapter', () => {
  const g = makeGame();
  const lore = loreOf(g);
  const by = {};
  let books = 0;
  let worse = 0;
  for (const e of library(lore)) {
    if ((by[e.genre] = (by[e.genre] || 0) + 1) > 12) continue;
    const b = writeBook(lore, e);
    books++;
    const words = b.lines.filter((l) => !/^(#|>|~|\f|- |\d+\. )/.test(l)).join(' ').toLowerCase().replace(/[^a-z' ]+/g, ' ').split(/\s+/).filter(Boolean);
    const seen = new Map();
    let rep = 0;
    for (let i = 0; i + 8 <= words.length; i++) {
      const k = words.slice(i, i + 8).join(' ');
      if (seen.has(k) && i - seen.get(k) > 8) rep++;
      if (!seen.has(k)) seen.set(k, i);
    }
    if (rep > 3) worse++;
  }
  assert.ok(books > 40);
  assert.ok(worse <= Math.ceil(books * 0.05), `${worse} of ${books} books repeat themselves`);
  // Two mines that fell in, told in the one book: the second in other words.
  const W = new Writer(new RNG(5));
  const a = retell(W, 'In 954, Atatepec\'s silver mine a half day south of Atatepec fell in on its deepest gallery, and nineteen miners were lost. Nobody would work it after.');
  const b2 = retell(W, 'In 988, Redfield\'s copper mine a half day south of Redfield fell in on its deepest gallery, and twelve miners were lost. Nobody would work it after.');
  assert.ok(a.includes('fell in on its deepest gallery'));
  assert.ok(!b2.includes('fell in on its deepest gallery'), b2);
  assert.ok(b2.includes('Redfield') && b2.includes('988') && b2.includes('twelve'));
  assert.ok(!b2.includes('Nobody would work it after'), 'the same colour not told twice');
});

test('a cookery book gives the game\'s own recipe, and it can be cooked', () => {
  const g = makeGame();
  const lore = loreOf(g);
  const furnace = recipesFor('furnace');
  for (const [k, D] of Object.entries(DISH_RECIPES)) {
    assert.ok(ITEMS[k], k);
    for (const i of Object.keys(D.in)) assert.ok(ITEMS[i], `${k}: ${i}`);
    assert.ok(furnace.some((r) => r.out === k && JSON.stringify(r.in) === JSON.stringify(D.in)), `${k} at the furnace`);
    if (D.bake) assert.ok(recipesFor('baker').some((r) => r.out === k), `${k} at the baker's`);
    assert.ok(RECIPES[k] && RECIPES[k].steps.length >= 3, `${k}: its method`);
  }
  for (const e of library(lore).filter((q) => q.genre === 'table')) {
    const b = writeBook(lore, e);
    const lines = b.lines;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i] !== '## You Will Need') continue;
      const list = [];
      for (let j = i + 1; lines[j] && lines[j].startsWith('- '); j++) list.push(lines[j]);
      assert.ok(list.length >= 1 && list.length <= 3, list.join(' / '));
      assert.ok(/furnace/.test(lines[i + list.length + 1]), 'where it\'s made');
    }
  }
  // (Nothing a book's method calls for that isn't in the list: no leeks,
  // no barley, no milk.)
  for (const R of Object.values(RECIPES)) for (const s of R.steps) assert.ok(!/\b(leek|barley|milk|butter|onion|paprika|lentil|maize|beef|ginger)s?\b/i.test(s), s);
});

test('each people sets its books in its own type, and each writer\'s a little their own', () => {
  const names = new Set(['IM Fell English', ...FACES.map((f) => f.font)]);
  for (const f of FACES) assert.ok(fs.existsSync(new URL(`../src/fonts/${f.file}.woff2`, import.meta.url)), f.file);
  for (const [k, T] of Object.entries(TYPES)) {
    for (const f of [...T.body, T.head, T.cap]) assert.ok(names.has(f), `${k}: ${f}`);
  }
  const looks = new Set(Object.keys(TYPES).map((k) => { const t = typeFor({ style: k, by: 'Ann Reed' }); return `${t.body}|${t.head}|${t.paper}`; }));
  assert.ok(looks.size >= 10, `${looks.size} different settings`);
  const a = typeFor({ style: 'vale', by: 'Ann Reed' });
  const others = ['Bo Lark', 'Cy Moss', 'Di Fenn', 'Ed Holt', 'Flo Wren', 'Gil Ash'].map((by) => typeFor({ style: 'vale', by }));
  assert.ok(others.some((t) => t.capInk !== a.capInk || t.orn !== a.orn || t.body !== a.body || t.drop !== a.drop), 'writers differ');
  // A people that spaces its paragraphs and drops no capital.
  const jade = typeFor({ style: 'jade', by: 'Lu Ma' });
  const m = (t, s) => t.length * s * 0.5;
  const pages = paginate(['# I. One', 'A first paragraph here.', 'A second one.'], { w: 300, h: 400, size: 12, measure: m, type: jade });
  const rows = pages[0].rows;
  assert.ok(!rows.some((q) => q.cap), 'no drop cap');
  assert.ok(rows.some((q) => q.t === 'head' && q.text === q.text.toUpperCase()), 'its heads in capitals');
  const textRows = rows.filter((q) => q.t === 'text');
  assert.equal(textRows[0].x0, 0, 'not indented');
  assert.ok(rows.some((q, i) => q.t === 'gap' && rows[i - 1] && rows[i - 1].t === 'text'), 'a space between paragraphs');
  // And one that drops its capital three lines deep.
  const deep = paginate(['# I. One', 'Words '.repeat(80)], { w: 300, h: 400, size: 12, measure: m, type: { ...typeFor({ style: 'vale', by: 'x' }), drop: 3 } });
  const cap = deep[0].rows.find((q) => q.cap);
  assert.equal(cap.cap.lines, 3);
});

test('version 1.28.0, and a world from 1.27 is brought up to it', () => {
  assert.equal(GAME_VERSION, '1.28.0');
  assert.ok(compareVersions('1.27.0', GAME_VERSION) < 0);
  assert.ok(stepsFor('1.27.0').some((q) => q.to === '1.28.0'));
});
