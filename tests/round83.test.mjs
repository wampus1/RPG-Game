// Round 83: the essentials (one world shared where it can be): the
// effects under one setting and the bigger particle caps, chairs pushed in
// and pulled out, the odd jobs and positions on the boards, the Academy's
// lessons (questions, work set, the masters each their own, the registrar's
// hours), the curfew's warnings and the walk out of town, doors barred at
// night, the pace on foot, the trade window's reasons, and the version's
// step.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeGame, stubInput } from './helpers.mjs';
import { B, META_STATE } from '../src/world/blocks.js';
import { SETTING_ROWS, FX_CAPS, FX_ORDER, loadSettings, changeSetting } from '../src/game/settings.js';
import { chairTable, moveChair, tucked } from '../src/game/chairs.js';
import { LedgerWindow, TradeWindow } from '../src/ui/windows.js';
import { foundAcademy, academyOf, roomMid, roomAt } from '../src/sim/college.js';
import { LESSONS, TEMPERS, masterNature, shuffleQuestion } from '../src/sim/lessons.js';
import { staffHours } from '../src/entities/sagaman.js';
import { lockingCulture, nightLocking } from '../src/game/doorlocks.js';
import { PLAYER_STEP_TIME, FLEE_REST } from '../src/config.js';
import { RNG } from '../src/util/rng.js';
import { ITEMS } from '../src/world/items.js';
import { topicsFor } from '../src/game/dialogue.js';
import { GAME_VERSION } from '../src/version.js';
import { stepsFor } from '../src/game/migrate.js';

const input = stubInput();
const G = makeGame(777);
for (let i = 0; i < 5; i++) G.update(0.1, input);
const S = G.sim.saga;

test('one Environmental VFX setting (the old switches folded in), and two bigger particle caps', () => {
  const keys = SETTING_ROWS.map((r) => r.key);
  assert.ok(keys.includes('envFx'));
  for (const k of ['weatherFx', 'weatherGround', 'waterFx']) assert.ok(!keys.includes(k), k);
  const store = { getItem: () => JSON.stringify({ weatherFx: false }) };
  const s = loadSettings(store);
  assert.equal(s.envFx, false);
  assert.equal(s.weatherFx, undefined);
  assert.deepEqual(FX_CAPS.slice(3).map((c) => c.parts), [600, 1200]);
  // (Cycled in order of size: Few, Some, Many, Very Many, So Very Many.)
  const st = { fxCap: 0 };
  changeSetting(st, 'fxCap', 1);
  assert.equal(st.fxCap, FX_ORDER[FX_ORDER.indexOf(0) + 1]);
});

test('a chair at a table is pushed in, pulled out to sit on, and back in again', () => {
  const w = G.world;
  const p = G.player;
  const x = Math.round(p.x) + 3;
  const z = Math.round(p.z) + 3;
  const y = w.findStandY(x, z, p.y);
  w.setBlock(x, y, z, B.chair, 0);
  w.setBlock(x, y, z + 1, B.table, 0);
  assert.deepEqual(chairTable(w, x, y, z), { dx: 0, dz: 1 });
  assert.ok(tucked(w, x, y, z), 'pushed in to begin with');
  assert.ok(moveChair(G, x, y, z, true, true));
  assert.ok(w.getMeta(x, y, z) & META_STATE);
  assert.ok(!tucked(w, x, y, z));
  assert.ok(moveChair(G, x, y, z, false, true));
  assert.ok(tucked(w, x, y, z));
});

test('the boards: odd jobs of every kind (the director deciding how many), and the town\'s positions', () => {
  const kinds = new Set();
  for (let d = 1; d < 8; d++) {
    S.daily(G.day + d);
    for (const th of S.threads) if (th.m === 'help_wanted') kinds.add(th.vars.kind);
  }
  assert.ok(kinds.size >= 4, [...kinds].join(','));
  const s = G.world.ow.settlements.find((q) => q && q.type === 'city' && G.sim.layoutOf(q.id));
  const L = G.sim.layoutOf(s.id);
  const o = G.sim.careers.openings(L);
  assert.ok(o.watch, 'the watch is taking on guards');
  assert.ok(o.trades.length > 3);
  const lines = new LedgerWindow(G.ui, G, s, L).workLines(G).map((l) => l.t);
  assert.ok(lines.includes('POSITIONS'));
  assert.ok(lines.some((t) => /watch is taking on guards/.test(t)));
});

test('the Academy: bigger, the registrar\'s own room, and a lesson with a question and work set', () => {
  let L = null;
  let b = null;
  for (const s of G.world.ow.settlements.filter((q) => q && q.type === 'city')) {
    const L0 = G.sim.layoutOf(s.id) || G.world.getLayout(s);
    const b0 = L0 && (academyOf(L0) || foundAcademy(G.sim, L0));
    if (b0 && b0.quarters) {
      L = L0;
      b = b0;
      break;
    }
  }
  assert.ok(b, 'an Academy with a room for the registrar');
  assert.ok(b.x1 - b.x0 + 1 >= 15);
  assert.ok(b.registrar && b.registrarMeal);
  const th = S.begin('academy', { cast: {}, sid: L.settlement.id, vars: { bid: b.id, name: b.name, termName: 'the Ink Term' } });
  th.vars.players.host = { at: S.now, credited: [], att: {} };
  const c = th.vars.sched[0];
  G.day = c.day;
  G.minute = c.from + 1;
  const room = { cooking: 'kitchen', dueling: 'yard', research: 'lecture', gemcraft: 'gems' }[c.subject];
  const mid = roomMid(b, room);
  const y = G.world.findStandY(mid.x, mid.z, 20);
  S.go(th, 'term');
  let asked = null;
  G.ui.openQuestion = (spec) => {
    asked = spec;
    return true;
  };
  for (let k = 0; k < 900 && !(th.vars.les && th.vars.les.phase === 'work'); k++) {
    G.update(0.1, input);
    G.player.teleport(mid.x, y, mid.z);
    const q = th.vars.les && th.vars.les.q;
    if (q && !q.by && asked && q.tries.host === undefined) S.answer(th.id, 'host', q.right);
  }
  assert.equal(roomAt(b, mid.x, mid.z), room);
  assert.ok(asked && asked.opts.length === 3, 'a question put to the room');
  assert.ok(th.vars.les.merit.host >= 2, 'answered first, and right');
  assert.equal(th.vars.les.phase, 'work');
  // The work, done the way it's done (practice in the room).
  const craft = { cooking: 'cooking', dueling: 'dueling', research: 'study', gemcraft: 'setting' }[c.subject];
  S.emit('practised', { pid: 'host', craft, n: 1, x: mid.x, z: mid.z });
  for (let k = 0; k < 5; k++) S.emit('dummy_hit', { pid: 'host', x: mid.x, z: mid.z, heavy: k === 4 });
  G.update(0.1, input);
  assert.ok(th.vars.les.done.host, 'the work set, done');
  S.end(th, 'faded');
});

test('lessons: real questions (the right answer wherever it\'s shuffled), masters each their own, the registrar\'s hours', () => {
  for (const k of Object.keys(LESSONS)) {
    assert.ok(LESSONS[k].questions.length >= 6 && LESSONS[k].show.length >= 5, k);
    for (const q of LESSONS[k].questions) {
      const sq = shuffleQuestion(q, new RNG(k.length + q.q.length));
      assert.equal(sq.opts[sq.right], q.a[0]);
    }
  }
  const a = masterNature(5, 'dueling', 0);
  assert.deepEqual(masterNature(5, 'dueling', 0), a);
  assert.ok(TEMPERS[a.temper]);
  const seen = new Set();
  for (let i = 0; i < 40; i++) seen.add(masterNature(i, 'cooking', 0).temper);
  assert.ok(seen.size >= 4, 'not one kind of teacher');
  assert.equal(staffHours(12 * 60 + 10), 'eat');
  assert.equal(staffHours(23 * 60), 'sleep');
  assert.equal(staffHours(10 * 60), 'work');
});

test('the curfew: an outsider is told twice, then walked out of town on a rope (and no surrender from a cell)', () => {
  const J = G.sim.justice;
  const s = G.currentSettlement || G.world.ow.settlementAt(G.player.x, G.player.z);
  const L = G.sim.layoutOf(s.id);
  const a = G.active.get(s.id);
  const p = G.player;
  L.econ.laws.curfew = true;
  const pl = L.plaza;
  const y = G.world.findStandY(pl.cx, pl.cz, 20);
  p.teleport(pl.cx, y, pl.cz);
  const guard = a.npcs.find((n) => n.rec.job === 'guard');
  guard.teleport(pl.cx + 2, y, pl.cz);
  guard.sleeping = false;
  guard.state = 'routine';
  const wit = G.sim.witnesses;
  G.sim.witnesses = () => [guard];
  let chose = null;
  G.ui.openCurfew = (g, sid) => {
    chose = sid;
  };
  G.minute = 23 * 60;
  assert.ok(J.outsider(L));
  J.curfewT = null;
  for (let k = 0; k < 40; k++) {
    guard.teleport(pl.cx + 2, y, pl.cz);
    J.curfewWatch(a, L, p, null);
  }
  assert.equal(chose, s.id, 'offered the walk out, or arrest');
  assert.equal(J.pendingIn(s.id).length, 0, 'no crime yet');
  J.leadOut(s.id, guard);
  assert.ok(J.escort && J.escort.out && p.restrained);
  for (let k = 0; k < 1500 && J.escort; k++) G.update(0.1, input);
  assert.ok(!J.escort && !p.restrained, 'let go');
  const b = s.bounds;
  assert.ok(p.x < b.x0 || p.x > b.x1 || p.z < b.z0 || p.z > b.z1, 'outside the town');
  assert.ok(J.curfewOut && J.curfewOut.sid === s.id);
  G.sim.witnesses = wit;
  L.econ.laws.curfew = false;
  // (Wanted, a guard can be told "I surrender"; not from a cell.)
  G.wanted.set(s.id, 60);
  assert.ok(topicsFor(guard, G).some((t) => t.id === 'surrender'));
  J.jail = { sid: s.id, phase: 'serve' };
  assert.ok(!topicsFor(guard, G).some((t) => t.id === 'surrender'), 'no surrendering from a cell');
  J.jail = null;
  G.wanted.delete(s.id);
});

test('doors barred at night by most peoples; on foot a quarter slower; foes running off stop on each tile', () => {
  const towns = G.world.ow.settlements.filter((q) => q && !q.deserted);
  const full = towns.filter(lockingCulture).length;
  const night = towns.filter(nightLocking).length;
  assert.ok(night > full && night >= towns.length * 0.55, `${night} of ${towns.length}`);
  assert.ok(Math.abs(PLAYER_STEP_TIME - 0.16 / 0.75) < 1e-9);
  assert.ok(FLEE_REST > 0.15);
});

test('the trade window says why they won\'t buy, their purse shaking red when it\'s the money', () => {
  const n = G.npcs.find((q) => !q.dead && q.rec && G.sim.shopOf && G.sim.shopOf(q));
  assert.ok(n, 'a trader');
  const w = new TradeWindow(G.ui, n);
  const sh = w.shop(G);
  const k = Object.keys(ITEMS).find((q) => w.wants(q, G) && w.sellPrice(q, G) > 0 && q !== 'coin' && !ITEMS[q].exchange);
  assert.ok(k);
  const slot = G.player.inv.findIndex((q) => !q);
  // (Sold, with coin in their purse: every sale used to be turned down.)
  sh.purse.add(200);
  G.player.inv[slot] = { item: k, count: 2 };
  w.sell(slot, G, false);
  assert.equal(G.player.inv[slot].count, 1, 'one sold');
  assert.equal(w.notice, null);
  sh.purse.add(-sh.purse.get());
  w.sell(slot, G, false);
  assert.ok(w.notice && w.notice.purse, 'their purse, shaken');
  assert.match(w.notice.text, /can't afford/);
  w.update(5);
  assert.equal(w.notice, null);
  G.player.inv[slot] = null;
  G.talkingTo = null;
});

test('version 0.83.0 has its step', () => {
  assert.equal(GAME_VERSION, '0.83.0');
  assert.ok(stepsFor('0.82.0').some((s) => s.to === '0.83.0'));
});
