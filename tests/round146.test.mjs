// Round 146: towns known for something. Each town (now and then a
// village) is given one of nineteen specialties (an arena, a great
// library, a holy seat, a bazaar, a forge, a citadel, baths, a theatre, a
// racecourse, a fair, old ruins, a winery, a shipyard, gardens, a
// monastery, an apiary, a stone circle, a quarry, a delve into the old
// places beneath), rarely the same twice and never close together, each
// built in its people's own way with features of its own; the town's own
// people taken on to work it; its days (the games, race days, plays,
// feasts, auctions, launches...) with crowds that come for them and
// outcomes that go round the realm; wagers, fights on the sands, and a
// service or a thing to do at nearly everything in it, each player their
// own; and in an older world, its quarters raised in or just outside the
// town the first time it's visited.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { makeGame, stubInput } from './helpers.mjs';
import { SPECIALTIES, famousFor } from '../src/world/specialties.js';
import { SHOWS, fighterOf } from '../src/sim/shows.js';
import { qtagIdx, qtagJob } from '../src/sim/cities.js';
import { quarterView, quarterAct, quarterInteract, cityFestResult } from '../src/game/cityplay.js';
import { QuarterWindow } from '../src/ui/citywin.js';
import { BLOCKS, B } from '../src/world/blocks.js';
import { countItem } from '../src/game/inventory.js';
import { activityFor, DAY } from '../src/sim/econ.js';
import { GAME_VERSION } from '../src/version.js';
import { STEPS } from '../src/game/migrate.js';
import { GROUND } from '../src/config.js';

const input = stubInput();
const src = (f) => fs.readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');

// One world made the 1.46 way, every town laid out (shared by the tests
// below: it takes a few seconds).
let W = null;
function world() {
  if (W) return W;
  const game = makeGame(12345, { learned: true, wg: 10 });
  game.minute = 600;
  for (const s of game.world.ow.settlements) game.sim.layoutOf(s.id);
  W = game;
  return game;
}
const townWith = (game, k, type = null) => game.world.ow.settlements.find((s) => (s.spec || []).some((q) => q.k === k) && (!type || s.type === type));

test('every place is given what it is known for: rarely the same, never close, each its own', () => {
  const game = world();
  const ow = game.world.ow;
  const all = ow.settlements.filter((s) => s.spec && s.spec.length);
  assert.ok(all.length >= 15, `${all.length} places known for something`);
  const by = new Map();
  for (const s of all) for (const q of s.spec) {
    assert.ok(SPECIALTIES[q.k], q.k);
    assert.ok(q.name && q.form, 'a name and a form');
    if (!by.has(q.k)) by.set(q.k, []);
    by.get(q.k).push({ s, q });
  }
  // (A good spread of kinds, none past its cap, none near another of itself.)
  assert.ok(by.size >= 12, `${by.size} kinds in one world`);
  for (const [k, list] of by) {
    assert.ok(list.length <= SPECIALTIES[k].cap, `${k}: ${list.length}`);
    for (const a of list) for (const b of list) if (a !== b) assert.ok(Math.hypot(a.s.cx - b.s.cx, a.s.cz - b.s.cz) >= SPECIALTIES[k].spacing, `${k} too close`);
    // (Two of a kind never quite alike: their names, or their features.)
    if (list.length > 1) assert.ok(new Set(list.map((o) => `${o.q.name}|${o.q.f.join(',')}`)).size === list.length, `${k} copies`);
  }
  // The same every time the world's made.
  const again = makeGame(12345, { learned: true, wg: 10 });
  for (const s of all) assert.deepEqual(again.world.ow.settlements[s.id].spec.map((q) => q.name), s.spec.map((q) => q.name));
  assert.ok(famousFor(all[0]).length);
});

test('a new world lays out every quarter with its town, things to use and places for its people', () => {
  const game = world();
  let want = 0;
  let got = 0;
  for (const s of game.world.ow.settlements) {
    if (!(s.spec || []).length || s.haven) continue;
    const L = game.sim.layoutOf(s.id);
    want += s.spec.length;
    got += (L.quarters || []).length;
    for (const q of L.quarters || []) {
      assert.ok(q.fx.length || q.seats.length || Object.keys(q.roles).length, `${q.k} has something in it`);
      // (Clear of the town's buildings.)
      for (const b of L.buildings) assert.ok(b.x1 < q.x0 || b.x0 > q.x1 || b.z1 < q.z0 || b.z0 > q.z1, `${q.k} over ${b.type}`);
      assert.ok(L.signs.some((g) => g.kind === 'quarter' && g.q === q.i), 'a sign at its way in');
    }
  }
  assert.ok(got >= want * 0.9, `${got} of ${want} quarters laid out`);
  // An arena has its pit and its stands; a racecourse its track.
  const arena = game.sim.layoutOf(townWith(game, 'arena').id).quarters.find((q) => q.k === 'arena');
  assert.ok(arena.pit && arena.seats.length > 10);
  const rc = townWith(game, 'racecourse');
  if (rc) {
    const q = game.sim.layoutOf(rc.id).quarters.find((o) => o.k === 'racecourse');
    if (q.form !== 'horse_fair') assert.ok(q.track && q.track.pts.length > 20);
  }
});

test('the town\'s own people are taken on to work its quarters, each at their post', () => {
  const game = world();
  let staff = 0;
  for (const L of game.world.layouts.values()) {
    for (const r of L.npcs) {
      if (!r.qtag) continue;
      staff++;
      const q = (L.quarters || [])[qtagIdx(r.qtag)];
      assert.ok(q, 'a quarter of the town');
      assert.equal(qtagJob(r.qtag), r.job);
      assert.equal(r.work.kind, 'tag');
      assert.ok(L.spots.some((sp) => sp.tags.includes(r.qtag)), `a post for the ${r.job}`);
    }
  }
  assert.ok(staff >= 20, `${staff} at work in the quarters`);
});

test('a quarter keeps its days: the games are fought, the crowd comes, the wagers are settled', () => {
  const game = world();
  const C = game.sim.cities;
  const s = townWith(game, 'arena', 'city') || townWith(game, 'arena');
  const L = game.sim.layoutOf(s.id);
  const q = L.quarters.find((o) => o.k === 'arena');
  const S = C.stateOf(L, q.i);
  assert.ok(S.roster.length >= 4 && S.condemned.length);
  let d = game.day;
  while (!SHOWS.arena.events({ L, q, st: S }, d).length) d++;
  game.day = d;
  game.minute = 600;
  game.sim.catchUp(L);
  const ev = C.eventsOf(L, q.i).find((e) => e.type === 'games');
  assert.ok(ev && ev.data.bouts.length >= 2);
  // A wager, as the host: on the first bout, both ways.
  const p = game.player;
  p.give('coin', 100);
  const c0 = countItem(p.inv, 'coin');
  quarterAct(game, s.id, q.i, 'bet:0:a:5');
  quarterAct(game, s.id, q.i, 'bet:0:b:5');
  assert.equal(countItem(p.inv, 'coin'), c0 - 10);
  // The day goes by.
  game.minute = 1200;
  game.sim.catchUp(L);
  assert.ok(ev.done && ev.data.bouts.every((b) => b.result), 'every bout fought');
  assert.ok(ev.crowdN > 0, 'a crowd came');
  const P = C.mine('host');
  assert.equal(P.bets.filter((b) => b.state === 'won').length, 1);
  assert.equal(P.bets.filter((b) => b.state === 'lost').length, 1);
  const owed = C.owed('host', s.id);
  assert.ok(owed > 0);
  quarterAct(game, s.id, q.i, 'collect');
  assert.equal(C.owed('host', s.id), 0);
  // What came of it, on the boards.
  assert.ok(C.qs(L).past.some((o) => o.type === 'games' && o.res));
  assert.ok(fighterOf(S, ev.data.bouts[0].a));
});

test('people with time to spare go to what\'s on: a seat in the stands, a pew, the water', () => {
  const game = world();
  const C = game.sim.cities;
  const s = townWith(game, 'holy');
  const L = game.sim.layoutOf(s.id);
  const q = L.quarters.find((o) => o.k === 'holy');
  const ev = { type: 'service', title: 'Evensong', s: game.day * DAY + 1080 + DAY, e: game.day * DAY + 1125 + DAY, crowd: 0.5, act: 'pray', id: 'test' };
  C.call(L, q.i, ev);
  const going = L.npcs.filter((r) => r.override && r.override.act === 'show' && r.override.ev === 'test');
  assert.ok(going.length > 0, 'some come');
  for (const r of going) {
    assert.equal(r.override.tag, 'pray');
    const a = activityFor(r, Math.floor(ev.s / DAY), (ev.s % DAY) + 5);
    assert.equal(a.entry.act, 'show');
  }
});

test('the things of a quarter do something, each player for themselves; its window draws', () => {
  const game = world();
  const s = townWith(game, 'arena');
  const L = game.sim.layoutOf(s.id);
  const q = L.quarters.find((o) => o.k === 'arena');
  const p = game.player;
  p.teleport(q.at.x, GROUND, q.at.z + 2);
  for (let i = 0; i < 120 && !game.active.has(s.id); i++) game.update(0.1, input);
  assert.ok(game.active.has(s.id));
  const opened = [];
  game.ui.open = (w) => opened.push(w);
  game.ui.find = () => null;
  let used = 0;
  for (let x = q.x0; x <= q.x1; x++) for (let z = q.z0; z <= q.z1; z++) for (let y = GROUND; y < GROUND + 6; y++) {
    const b = BLOCKS[game.world.getBlock(x, y, z)];
    if (!b || b.interact !== 'quarter') continue;
    quarterInteract(game, x, y, z, b);
    used++;
  }
  assert.ok(used > 0, 'things to use');
  assert.ok(opened.some((w) => w.kind === 'quarter'), 'the window on it');
  for (const page of ['main', 'board', 'story']) {
    const v = quarterView(game, s.id, q.i, page);
    assert.ok(v && v.title && v.tabs.length >= 2, page);
  }
  const w = new QuarterWindow(game.ui, s.id, q.i, 'story');
  w.ui.mouseCell = { x: 0, y: 0 };
  w.draw(w.grid, game);
  assert.ok(w.grid.ch.join('').includes('Its story'));
  // A once-a-day service: the second time, nothing more.
  const lib = townWith(game, 'library');
  if (lib) {
    const LL = game.sim.layoutOf(lib.id);
    const lq = LL.quarters.find((o) => o.k === 'library');
    const n0 = game.ui.msgs.length;
    quarterAct(game, lib.id, lq.i, 'study');
    quarterAct(game, lib.id, lq.i, 'study');
    assert.match(game.ui.msgs.slice(n0).at(-1), /full for today/);
  }
});

test('onto the sands: a bout with one of the school, a purse and a name for the winner', () => {
  const game = world();
  const C = game.sim.cities;
  const s = townWith(game, 'arena');
  const L = game.sim.layoutOf(s.id);
  const q = L.quarters.find((o) => o.k === 'arena');
  const p = game.player;
  p.teleport(q.at.x, GROUND, q.at.z + 2);
  for (let i = 0; i < 120 && !game.active.has(s.id); i++) game.update(0.1, input);
  const glad = L.npcs.find((r) => r.qtag === `q${q.i}:gladiator` && r.ent && !r.ent.dead);
  if (!glad) return;
  glad.ent.sleeping = false;
  quarterAct(game, s.id, q.i, 'fight');
  assert.ok(game.duel && game.duel.arena, 'a bout on the sands');
  const c0 = countItem(p.inv, 'coin');
  game.endDuel('won');
  assert.ok(countItem(p.inv, 'coin') > c0, 'a purse');
  assert.ok(C.fameOf('host', s.id) >= 1, 'a name in the arena');
  // The striker at the fair, through the festival's own window.
  const cfg = { kind: 'bell', token: 77, quarter: { sid: s.id, i: q.i } };
  C.mine('host').game = { token: 77 };
  const r = cityFestResult(game, cfg, { k: 'bell', token: 77, score: 98 });
  assert.match(r.text, /bell/);
});

test('a town\'s quarters and the players\' wagers are kept with the save', () => {
  const game = world();
  const data = game.sim.serialize();
  assert.ok(data.cities && data.cities.players);
  const s = townWith(game, 'arena');
  const sv = data.settlements.find((o) => o.sid === s.id);
  assert.ok(sv.econ.q && sv.econ.q.st.length, 'quarter state with the town');
  // Staff stay staff.
  const staffed = sv.recs.filter((r) => r.qtag);
  assert.ok(staffed.length && staffed.every((r) => r.retrained && r.job));
});

test('an older world raises its quarters on open ground in or just outside each town, once', () => {
  const game = makeGame(12345, { learned: true, wg: 1 });
  let got = 0;
  let want = 0;
  for (const s of game.world.ow.settlements) {
    if (!(s.spec || []).length || s.haven || s.condition === 'abandoned') continue;
    const L = game.sim.layoutOf(s.id);
    want += s.spec.length;
    got += (L.quarters || []).length;
    const Q = L.econ.q;
    assert.ok(Q && Q.built && Array.isArray(Q.lots), 'its lots kept');
  }
  assert.ok(got >= want * 0.6, `${got} of ${want} raised`);
});

test('a builders\' catch-up never goes round forever on a repair that won\'t take', () => {
  const game = world();
  const W2 = game.sim.works;
  const s = game.world.ow.settlements.find((o) => game.world.layouts.get(o.id)?.buildings.some((b) => b.type === 'tavern'));
  const L = game.sim.layoutOf(s.id);
  const b = L.buildings.find((o) => o.type === 'tavern');
  // (Every block it's given just vanishes.)
  const keep = [game.sim.setBlocks, W2.damageOf, W2.planOf];
  game.sim.setBlocks = () => {};
  W2.damageOf = () => [[b.x0, GROUND, b.z0, B.planks, 0]];
  W2.planOf = () => ({ list: [[b.x0, GROUND, b.z0, B.planks, 0]] });
  W2.noteDamage(L, b);
  const t0 = Date.now();
  W2.catchUp(L, game.sim.abs + DAY * 2);
  [game.sim.setBlocks, W2.damageOf, W2.planOf] = keep;
  assert.ok(Date.now() - t0 < 5000);
});

test('version, the step for older saves, and the README', () => {
  assert.equal(GAME_VERSION, '1.46.0');
  assert.ok(STEPS.some((s) => s.to === '1.46.0'));
  const md = src('README.md');
  assert.ok(md.indexOf('## Round 146') > 0 && md.indexOf('## Round 146') < md.indexOf('## Command console'));
  assert.equal(JSON.parse(src('package.json')).version, '1.46.0');
});
