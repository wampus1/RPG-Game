// Round 55: the notice board's tabs centred and nothing on it running past
// its edge; no "put that away!" from the watch while something's coming at
// you (or for a few seconds after); a story's dialogue no longer flickering
// between ways of asking; a quest log button under the map; dishes that do
// things doing them more often; and anything running away a touch slower.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGame, stubInput, stubUI } from './helpers.mjs';
import { LedgerWindow, DialogueWindow } from '../src/ui/windows.js';
import { MOTIFS } from '../src/sim/saga/core.js';
import { ACTS } from '../src/world/dishes.js';
import { FLEE } from '../src/config.js';
import { Creature } from '../src/entities/creature.js';
import { STEPS } from '../src/game/migrate.js';
import { GAME_VERSION, compareVersions } from '../src/version.js';
import { RNG } from '../src/util/rng.js';

function start(seed = 12345) {
  const game = makeGame(seed);
  const input = stubInput();
  game.minute = 10 * 60;
  for (let i = 0; i < 30; i++) game.update(0.1, input);
  return { game, input, S: game.sim.saga, p: game.player };
}
// A grid that keeps what's drawn on it.
function recorder() {
  const out = [];
  return {
    out,
    box() {},
    center(y, t) {
      out.push({ y, t, center: true });
    },
    fill() {},
    put() {},
    text(x, y, t) {
      out.push({ x, y, t: String(t) });
    },
  };
}
const ui = () => ({ ...stubUI(), mouseCell: { x: -1, y: -1 }, close() {}, open() {}, audio: null });

test('the notice board: its tabs centred, and nothing on the work side past the edge', () => {
  const { game, S } = start();
  const s = game.currentSettlement;
  const L = game.world.layouts.get(s.id);
  // Work to put up: a few stories begun in this town.
  for (const id of ['festival', 'stray', 'barn_raising', 'lost_child', 'haunting']) {
    const rng = new RNG(7);
    for (let i = 0; i < 400; i++) {
      const o = [].concat(MOTIFS[id].scan(S, rng, S.day) || [])[0];
      if (o && o.sid === s.id) {
        S.begin(id, o);
        break;
      }
    }
  }
  for (const th of S.live()) for (const t of th.tasks) t.known[s.id] = 0;
  const w = new LedgerWindow(ui(), game, s, L);
  for (const tab of ['town', 'news', 'work']) {
    w.tab = tab;
    w.hits = [];
    const g = recorder();
    w.draw(g, game);
    const tabs = g.out.filter((q) => q.y === 3 && /^ (TOWN|NEWS|WORK) $/.test(q.t));
    assert.equal(tabs.length, 3);
    const left = tabs[0].x;
    const right = w.w - (tabs[2].x + tabs[2].t.length);
    assert.ok(Math.abs(left - right) <= 1, `centred: ${left} / ${right}`);
    for (const q of g.out) if (!q.center && q.y > 4 && q.y < w.h - 1) assert.ok(q.x + q.t.length <= w.w - 3, `"${q.t}" runs to ${q.x + q.t.length} of ${w.w}`);
  }
});

test('the watch says nothing of your blade while something\'s coming at you, nor for five seconds after', () => {
  const { game, input, p } = start();
  const s = game.currentSettlement;
  const a = game.active.get(s.id);
  const L = a.layout;
  L.econ.laws ||= {};
  L.econ.laws.armsBan = true;
  const J = game.sim.justice;
  const guard = a.npcs.find((n) => n.rec.job === 'guard' && !n.dead);
  assert.ok(guard);
  guard.state = 'routine';
  guard.sleeping = false;
  assert.equal(game.currentSettlement && game.currentSettlement.id, s.id);
  void input;
  p.inv[0] = { item: 'iron_sword', count: 1 };
  p.selected = 0;
  // A wolf on you.
  const wolf = new Creature(game, 'wolf', p.x + 4, p.y, p.z);
  game.addCreature(wolf);
  wolf.angry = true;
  wolf.target = p;
  const said = [];
  guard.say = (t) => said.push(t);
  const keep = () => {
    guard.state = 'routine';
    guard.x = p.x - 2;
    guard.z = p.z;
  };
  for (let i = 0; i < 6; i++) {
    keep();
    J.patrol();
  }
  assert.equal(said.length, 0, 'not a word while it\'s on you');
  wolf.dead = true;
  for (let i = 0; i < 3; i++) {
    keep();
    J.patrol();
  }
  assert.equal(said.length, 0, 'nor straight after');
  for (let i = 0; i < 4; i++) {
    keep();
    J.patrol();
  }
  assert.ok(said.some((t) => /Put that weapon away/.test(t)), 'then they do');
});

test('a story\'s asking doesn\'t flicker from one way of saying it to another', () => {
  const { game, input, S } = start();
  const L = game.world.layouts.get(game.currentSettlement.id);
  let o = null;
  const rng = new RNG(1);
  for (let i = 0; i < 600 && !o; i++) {
    const q = MOTIFS.lost_child.scan(S, rng, S.day);
    if (q && q.sid === L.settlement.id) o = q;
  }
  assert.ok(o);
  const th = S.begin('lost_child', o);
  game.minute += 120;
  for (let i = 0; i < 60; i++) game.update(0.05, input);
  const parent = L.npcs[th.cast.parent.idx];
  const n = parent.ent || game.npcs.find((q) => q.rec === parent);
  if (!n) return;
  const d = new DialogueWindow(ui(), n, game);
  const seen = new Set();
  for (let i = 0; i < 10; i++) {
    seen.add(d.allOptions(game).map((q) => q.label).join('|'));
    game.update(0.016, input);
  }
  assert.equal(seen.size, 1, [...seen].join('\n'));
  assert.ok(d.allOptions(game).some((q) => q.id === 'sg_offer'));
});

test('a quest log button under the map opens the log', () => {
  const { game } = start();
  const u = game.ui;
  if (!u.drawQuestButton) return;
  const g = recorder();
  u.mouseCell = { x: -1, y: -1 };
  u.drawQuestButton(g, game, 40);
  const b = u.questBtn;
  assert.ok(b && b.w >= 12);
  assert.ok(g.out.some((q) => /QUEST LOG/.test(q.t) && /\[O\]/.test(q.t)));
  assert.ok(u.onQuestButton(b.x + 2, b.y));
  assert.ok(!u.onQuestButton(b.x + 2, b.y + 1));
});

test('a dish\'s good acts come round again soon; the old long waits are let go', () => {
  for (const [k, a] of Object.entries(ACTS)) {
    if (a.good) assert.ok(a.cd <= 35, `${k} waits ${a.cd}`);
    else assert.ok(a.cd <= 70, `${k} waits ${a.cd}`);
  }
  const step = STEPS.find((q) => q.to === '0.55.0');
  assert.ok(step);
  const d = { player: { dishState: { a: { next: 9999, cd: { blast: 9999 }, burst: 3 } } } };
  step.data(d, []);
  assert.equal(d.player.dishState.a.next, undefined);
  assert.equal(d.player.dishState.a.cd, undefined);
  assert.ok(compareVersions(GAME_VERSION, '0.55.0') >= 0);
});

test('anything running away runs 15% slower than it did', () => {
  assert.ok(Math.abs(FLEE - 1 / 0.85) < 1e-9);
  const { game } = start();
  const n = game.npcs.find((q) => q.rec && !q.dead && q.rec.age === 'adult' && q.rec.job !== 'guard');
  const durs = [];
  const orig = n.startMove.bind(n);
  n.startMove = (x, y, z, dur) => {
    durs.push(dur);
    return orig(x, y, z, dur);
  };
  n.state = 'flee';
  n.fleeGoal = { x: n.x + 8, y: n.y, z: n.z };
  n.path = null;
  for (let i = 0; i < 40 && !durs.length; i++) n.followPath(n.fleeGoal, 1);
  if (durs.length) assert.ok(Math.abs(durs[0] - n.step * 0.6 * FLEE) < 1e-6 || durs[0] > n.step * 0.6 * FLEE, `step ${durs[0]}`);
  // A hare, hit, bolts: each step the slower.
  const p = game.player;
  const c = new Creature(game, 'rabbit', p.x + 3, p.y, p.z);
  game.addCreature(c);
  const cd = [];
  const o2 = c.startMove.bind(c);
  c.startMove = (x, y, z, dur) => {
    cd.push(dur);
    return o2(x, y, z, dur);
  };
  c.fleeFrom = p;
  c.fleeT = 5;
  for (let i = 0; i < 30 && !cd.length; i++) c.update(0.05);
  if (cd.length) assert.ok(cd[0] >= c.S.step * 0.55 * FLEE - 1e-6, `hare step ${cd[0]}`);
});
