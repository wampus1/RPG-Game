// Round 147: the quarters gone over. Every seat, stall, stand and doorway
// in each can be walked to from its ways in (a work spot set down on a
// rail or a statue moved to the nearest place that can be got to, a way
// cut through hedge or crop where there's none); no sign or lamp across a
// gate; the maze a true maze; some laid out the other way about. In an
// older world they're built again to the new design over the old (once);
// in a newer one, the parts of the world kept as they were left are put
// right. Their days are called off for a siege (but the prayers go on,
// fuller) or for rain on what's held under the sky, wagers given back;
// busier on a festival; a grand day the council may pay for; and talked of
// about town. And quicker: the drawing of stairs kept, a town's buildings
// looked up by the tile, the ground out past an older town's edge looked
// over every other pace.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { makeGame } from './helpers.mjs';
import { QUARTER_V, FIX_WAYS } from '../src/world/quarters/index.js';
import { SHOWS } from '../src/sim/shows.js';
import { BLOCKS } from '../src/world/blocks.js';
import { buildingAt } from '../src/sim/sim.js';
import { matters } from '../src/sim/agenda.js';
import { factsFor } from '../src/game/talk/facts.js';
import { choose, allRules } from '../src/game/talk/rules.js';
import { RNG } from '../src/util/rng.js';
import { DAY } from '../src/sim/econ.js';
import { GROUND, REGION_W, REGION_D } from '../src/config.js';
import { GAME_VERSION, compareVersions } from '../src/version.js';
import { STEPS } from '../src/game/migrate.js';

const src = (f) => fs.readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');

// One world made the new way, every town laid out (and what the check of
// ways in and out made of each quarter as it was built).
const seen = [];
let W = null;
function world() {
  if (W) return W;
  FIX_WAYS.seen = (L, q, ways) => seen.push({ town: L.settlement.name, k: q.k, missing: ways.missing.length, goals: ways.goals, moved: ways.moved, cut: ways.cut, gates: q.gates.length });
  const game = makeGame(12345, { learned: true, wg: 10 });
  game.minute = 600;
  for (const s of game.world.ow.settlements) game.sim.layoutOf(s.id);
  FIX_WAYS.seen = null;
  W = game;
  return game;
}
const withQuarter = (game, k) => {
  for (const s of game.world.ow.settlements) {
    const L = game.world.layouts.get(s.id);
    const q = L && (L.quarters || []).find((o) => o.k === k);
    if (q) return { L, q, s };
  }
  return null;
};
// (What the plan has at each of some tiles: the last thing set there.)
function planned(L, tiles) {
  const want = new Set(tiles.map(([x, y, z]) => `${x},${y},${z}`));
  const got = new Map();
  for (const arr of L.placements.values()) {
    for (let i = 0; i < arr.length; i += 5) {
      const k = `${arr[i]},${arr[i + 1]},${arr[i + 2]}`;
      if (want.has(k)) got.set(k, arr[i + 3]);
    }
  }
  return got;
}

test('every seat, stall, stand and doorway in every quarter can be walked to from its ways in', () => {
  world();
  assert.ok(seen.length >= 30, `${seen.length} quarters built`);
  const bad = seen.filter((o) => o.missing);
  assert.equal(bad.length, 0, bad.map((o) => `${o.town} ${o.k}: ${o.missing}`).join('; '));
  // (Each with something to get to, and at least one way in.)
  for (const o of seen) {
    assert.ok(o.gates >= 1, `${o.town} ${o.k}: a way in`);
    assert.ok(o.goals > 0, `${o.town} ${o.k}: places to get to`);
  }
  // Nothing knocked through to manage it: it's the plans that are right.
  assert.equal(seen.reduce((a, o) => a + (o.cut || 0), 0), 0);
});

test('no gate is blocked: no sign, lamp or wall on a way in, or the tile inside it', () => {
  const game = world();
  let n = 0;
  for (const L of game.world.layouts.values()) {
    const tiles = [];
    for (const q of L.quarters || []) {
      for (const g of q.gates) {
        // (The way out from each side, and the tile just inside it.)
        const [ox, oz] = { n: [0, -1], s: [0, 1], w: [-1, 0], e: [1, 0] }[g.side];
        for (const [x, z] of [[g.x, g.z], [g.x - ox, g.z - oz]]) for (const y of [GROUND, GROUND + 1]) tiles.push([x, y, z, q.k]);
        n++;
      }
    }
    if (!tiles.length) continue;
    const got = planned(L, tiles);
    for (const [x, y, z, k] of tiles) {
      const id = got.get(`${x},${y},${z}`);
      if (id === undefined) continue;
      const d = BLOCKS[id];
      assert.ok(!d.solid || d.stair || ['door', 'gate', 'quarter'].includes(d.interact), `${L.settlement.name} ${k}: ${d.name} at its gate (${x},${y},${z})`);
    }
  }
  assert.ok(n >= 30);
});

test('the same kind of quarter is laid out both ways about, town to town', () => {
  const game = world();
  const sides = new Map();
  for (const L of game.world.layouts.values()) {
    for (const q of L.quarters || []) {
      if (!sides.has(q.k)) sides.set(q.k, new Set());
      sides.get(q.k).add(q.gates.map((g) => g.side).sort().join(''));
    }
  }
  // (Mirrored: a gate on the west in one, on the east in another.)
  const both = [...sides.entries()].filter(([, v]) => v.size > 1);
  assert.ok(both.length >= 3, `${both.length} kinds laid out more than one way`);
  assert.ok(/this\.flip = rng\.chance\(0\.5\)/.test(src('src/world/quarters/kit.js')));
});

test('the garden maze is a true maze, sized to its corner, the urn at its far end', () => {
  const game = world();
  const got = withQuarter(game, 'gardens');
  assert.ok(got, 'a garden somewhere');
  const text = src('src/world/quarters/leisure.js');
  assert.ok(/recursive|stack\.push/.test(text) && /odd\(/.test(text), 'carved cell by cell, odd sizes');
  for (const L of game.world.layouts.values()) {
    for (const q of L.quarters || []) {
      if (q.k !== 'gardens' || !q.fx.some((f) => f.kind === 'maze')) continue;
      // (Got to: see the first test, which counts the urn among its goals.)
      const urn = q.fx.find((f) => f.kind === 'maze');
      assert.ok(urn.x >= q.x0 && urn.x <= q.x1 && urn.z >= q.z0 && urn.z <= q.z1);
    }
  }
});

test('an older world raises its quarters once, and again only when their design changes', () => {
  const game = makeGame(12345, { learned: true, wg: 1 });
  const C = game.sim.cities;
  const s = game.world.ow.settlements.find((o) => (o.spec || []).length && !o.haven && o.condition !== 'abandoned');
  const L = game.sim.layoutOf(s.id);
  const Q = L.econ.q;
  assert.ok(Q.built && Q.bv === QUARTER_V, 'raised, to this design');
  let ops = 0;
  const keep = game.sim.setBlocks;
  game.sim.setBlocks = (o, ...a) => {
    ops += o.length;
    return keep.call(game.sim, o, ...a);
  };
  // (Loaded again: built to this design already, nothing set.)
  L.quarters = [];
  C.attach(L);
  assert.ok(L.quarters.length, 'its quarters known again');
  assert.equal(ops, 0, 'nothing built over');
  // (Loaded again, built to the old design: raised again over the old.)
  L.quarters = [];
  Q.bv = 1;
  C.attach(L);
  assert.ok(ops > 100, `${ops} blocks set`);
  assert.equal(Q.bv, QUARTER_V);
  game.sim.setBlocks = keep;
});

test('a newer world puts right only what it kept of its quarters as they were', () => {
  const game = world();
  const C = game.sim.cities;
  const { L, q } = withQuarter(game, 'arena') || withQuarter(game, 'bazaar');
  const w = game.world;
  const key = w.regionKey(Math.floor(q.x0 / REGION_W), Math.floor(q.z0 / REGION_D));
  const ops = [];
  const keep = game.sim.setBlocks;
  game.sim.setBlocks = (o) => ops.push(...o);
  L.econ.q.bv = 1;
  const had = w.saved.has(key);
  if (!had) w.saved.set(key, null);
  try {
    C.attach(L);
  } finally {
    if (!had) w.saved.delete(key);
    game.sim.setBlocks = keep;
  }
  assert.ok(ops.length > 50, `${ops.length} blocks put right`);
  assert.equal(L.econ.q.bv, QUARTER_V);
  // (Only within the town's quarters, and only in the part kept.)
  const inSome = (x, z) => L.quarters.some((o) => x >= o.x0 && x <= o.x1 && z >= o.z0 && z <= o.z1);
  assert.ok(ops.every(([x, , z]) => inSome(x, z) && w.regionKey(Math.floor(x / REGION_W), Math.floor(z / REGION_D)) === key));
});

test('a siege calls the day\'s doings off (the prayers go on, fuller); rain, those under the sky; wagers given back', () => {
  const game = world();
  const C = game.sim.cities;
  const got = withQuarter(game, 'racecourse') || withQuarter(game, 'arena');
  assert.ok(got);
  const { L, q } = got;
  const K = SHOWS[q.k];
  let ev = null;
  for (let d = game.day; d < game.day + 30 && !ev; d++) {
    ev = (K.events({ L, q, st: C.stateOf(L, q.i) }, d) || []).find((o) => o.type === 'races' || o.type === 'games') || null;
  }
  assert.ok(ev, 'a race day or games within the month');
  ev.id = 'test:147';
  // Under siege: off, all but the prayers and the drill.
  const war = game.sim.war;
  war.wars.push({ siege: { sid: L.settlement.id, phase: 'camp' } });
  try {
    assert.equal(C.trouble(L, ev), 'siege');
    assert.equal(C.trouble(L, { type: 'service' }), null);
    assert.equal(C.trouble(L, { type: 'drill' }), null);
  } finally {
    war.wars.pop();
  }
  assert.equal(C.trouble(L, ev), null, 'and on again once it\'s over');
  // Rain: races off, the games on (they fight in the rain).
  const was = game.weather;
  game.weather = { kind: 'rain', level: 1, t: 0 };
  try {
    assert.equal(C.trouble(L, { type: 'races' }), 'rain');
    assert.equal(C.trouble(L, { type: 'stars' }), 'rain');
    assert.equal(C.trouble(L, { type: 'games' }), null);
  } finally {
    game.weather = was;
  }
  // Called off: no crowd, the stakes given back, said why.
  const pid = 'host';
  const b = C.bet(pid, L, q.i, ev, 0, ev.type === 'games' ? 'a' : ev.data.races[0].field[0], 10);
  assert.ok(b && b.state === 'open');
  C.callOff(L, q.i, ev, 'rain');
  assert.ok(ev.done && ev.off === 'rain' && !ev.crowdN);
  assert.equal(b.state, 'won');
  assert.equal(b.pay, 10, 'the stake back, no more');
  assert.equal(C.bet(pid, L, q.i, ev, 0, 'a', 5), null, 'no wagers on what\'s off');
  const past = C.qs(L).past;
  assert.ok(/called off/.test(past[past.length - 1].res));
  // (Not played out before anyone: see cityplay.)
  assert.ok(/now >= e\.s && now < e\.e && !e\.off/.test(src('src/game/cityplay.js')));
});

test('the town talks of it: what\'s on, how it went, what was called off, and those who work there of their work', () => {
  const game = world();
  const rules = allRules().filter((r) => r.id.startsWith('q_'));
  assert.ok(rules.length >= 40, `${rules.length} lines of it`);
  for (const t of ['open', 'greet', 'bark', 'pair']) assert.ok(rules.some((r) => r.topic === t), t);
  // (Gladiators, delvers, players, jockeys, vintners and the rest.)
  const jobs = new Set(rules.flatMap((r) => [].concat(r.when.qJob || [])));
  for (const j of ['gladiator', 'delver', 'actor', 'jockey', 'vintner', 'beekeeper', 'monk', 'sellsword']) assert.ok(jobs.has(j), j);
  // Someone with the games on today, a fan of them: says so.
  const ent = game.npcs.find((n) => n.rec && n.settlement && n.rec.age === 'adult');
  assert.ok(ent);
  const F = factsFor(ent, game);
  for (const k of ['joy', 'grief', 'fear', 'anger', 'shame', 'pride', 'love', 'strain']) F[k] = 0;
  F.feel = 'calm';
  F.mem = null;
  for (const k of Object.keys(F)) if (/^(mem|heard)_/.test(k)) F[k] = null;
  Object.assign(F, { qOn: 'games', qNow: false, qCrowd: true, qFan: true, qOff: null, qPast: null, qJob: null });
  Object.assign(F.vars, { qShow: 'The Spring Games', qPlace: 'the Arena', qAt: '3pm' });
  const said = choose('open', F, new RNG(5), null, 2);
  assert.ok(said && said.rule.id.startsWith('q_'), said && said.rule.id);
  assert.ok(!/\{/.test(said.text.replace(/\{[^a-zA-Z][^}]*\}|\{[a-z]+:|\}/g, '')), said.text);
  // Called off for the siege: said, by anyone.
  Object.assign(F, { qOn: null, qOff: 'siege', qFan: false });
  F.vars.qOffShow = 'The Spring Games';
  const off = choose('open', F, new RNG(6), null, 2);
  assert.ok(off && off.rule.id === 'q_off_siege', off && off.rule.id);
  // Grief still comes first.
  F.grief = 0.9;
  F.feel = 'grief';
  F.mem_loss = { k: 'loss', n: 'Bram', s: 1 };
  F.vars.dead = 'Bram';
  const sad = choose('open', F, new RNG(7), null, 0);
  assert.ok(sad && !sad.rule.id.startsWith('q_'), sad && sad.rule.id);
});

test('quicker: stairs drawn once and kept, buildings found by the tile, the ground past an older town looked over sparingly', () => {
  // The renderer keeps each stair's look, drawn once, by atlas.
  const r = src('src/render/renderer.js');
  assert.ok(/const STAIRS = new WeakMap\(\)/.test(r) && /paintStair\(/.test(r));
  // A town's buildings, by the tile: the same answers as looking through
  // them all, and kept up as they change.
  const game = world();
  const L = [...game.world.layouts.values()].find((o) => o.buildings.length > 20);
  const scan = (x, z) => L.buildings.find((q) => x >= q.x0 && x <= q.x1 && z >= q.z0 && z <= q.z1) || null;
  const rng = new RNG(147);
  const b = L.bounds;
  for (let k = 0; k < 4000; k++) {
    const x = rng.int(b.x0 - 3, b.x1 + 3);
    const z = rng.int(b.z0 - 3, b.z1 + 3);
    assert.equal(buildingAt(L, x, z), scan(x, z), `${x},${z}`);
  }
  const extra = { x0: b.x0 + 1, z0: b.z0 + 1, x1: b.x0 + 2, z1: b.z0 + 2, type: 'test' };
  L.buildings.unshift(extra);
  try {
    assert.equal(buildingAt(L, b.x0 + 1, b.z0 + 1), extra, 'a new one found at once');
  } finally {
    L.buildings.shift();
  }
  assert.notEqual(buildingAt(L, b.x0 + 1, b.z0 + 1), extra, 'and gone when it\'s gone');
  // The ground out past an older town's edge: the lie of it cached for the
  // town, looked at every other pace.
  const i = src('src/world/quarters/index.js');
  assert.ok(/cols\.ctx \|\|= t\.context/.test(i) && /z \+= 2/.test(i));
});

test('on a festival day more come; a grand day the council pays for draws more still', () => {
  const game = world();
  const C = game.sim.cities;
  assert.ok(/festivalOf\(L, ev\.s\) \? 1\.5/.test(src('src/sim/cities.js')));
  // The council's matter, when the town's flush (and yours to govern: last
  // of the tests on this world, for that).
  const o = game.sim.office;
  // (A town whose quarter draws crowds: a citadel's drill draws none.)
  const L = [...game.world.layouts.values()].find((t) => t.econ && !t.settlement.haven && C.galaFor(t, game.day));
  assert.ok(L, 'a town with a crowd to draw');
  const T = o.install(L, o.pid(), game.playerName, 'election', game.day);
  T.budget.fetes = 1;
  L.econ.treasury = 100000;
  const m = matters(game.sim, L, T, game.day).find((q) => q.key === 'gala');
  assert.ok(m, 'a grand day to pay for');
  assert.ok(/^Pay for .+ at .+\?$/.test(m.title), m.title);
  const opt = m.opts[0];
  assert.ok(opt.fx.act === 'quarter_gala' && opt.fx.spend > 0);
  const before = L.econ.treasury;
  const words = game.sim.office.apply(L, T, opt.fx, game.day);
  assert.ok(/paid for/.test(words || ''), words);
  assert.equal(L.econ.treasury, before - opt.fx.spend);
  const Q = C.qs(L);
  assert.ok(Q.gala && Q.gala.q === opt.fx.q);
  // (Not again for a while.)
  assert.equal(C.galaFor(L, game.day), null);
  // The day comes: that quarter's crowd bigger.
  const d = Q.gala.day;
  const q = C.quarters(L)[Q.gala.q];
  let day = d;
  let ev = null;
  for (; day < d + 8 && !ev; day++) {
    Q.day = -1;
    Q.ev = [];
    const evs = C.today(L, day * DAY + 1);
    ev = (evs[q.i] || []).find((o) => o.gala) || null;
  }
  assert.ok(ev, 'a grand day held');
  const plain = (SHOWS[q.k].events({ L, q, st: C.stateOf(L, q.i) }, day - 1) || []).find((o) => o.type === ev.type);
  assert.ok(ev.crowd > plain.crowd, `${ev.crowd} over ${plain.crowd}`);
  assert.equal(Q.gala, null, 'spent');
});

test('version 1.47.0, its migration, and the README', () => {
  assert.ok(compareVersions('1.47.0', GAME_VERSION) <= 0);
  const step = STEPS.find((s) => s.to === '1.47.0');
  assert.ok(step && typeof step.game === 'function');
  const log = [];
  step.game({ sim: { cities: { players: null } } }, log);
  assert.ok(log.length && /rebuilt/.test(log[0]));
  const readme = src('README.md');
  const at = readme.indexOf('## Round 147');
  assert.ok(at > 0 && at < readme.indexOf('## Command console'));
});
