import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGame, stubInput } from './helpers.mjs';
import { RNG } from '../src/util/rng.js';
import { alive } from '../src/sim/econ.js';
import { GROUND } from '../src/config.js';
import { NPC } from '../src/entities/npc.js';

function start(seed = 12345, opts = {}, minute = 10 * 60) {
  const game = makeGame(seed, opts);
  const input = stubInput();
  game.minute = minute;
  for (let i = 0; i < 20; i++) game.update(0.1, input);
  const [sid, a] = [...game.active][0];
  return { game, input, sid, a, L: a.layout, p: game.player };
}

function world(seed = 12345, opts = { learned: false }) {
  const game = makeGame(seed, opts);
  for (const s of game.world.ow.settlements) game.sim.layoutOf(s.id);
  return game;
}

const wetAt = (game, x, z) => {
  const t = game.world.terrain;
  return t.column(x, z, t.context(x, z, x, z), {}).water >= 0;
};

function atWar(game) {
  const [a, b] = game.world.ow.civs;
  game.sim.realms.shift(a, b, -100, game.day);
  const w = game.sim.war.declare(a, b, { k: 'land', text: 'the land between them' }, game.day, new RNG(1));
  return { a, b, w };
}

// ------------------------------------------------------------ visitors
test('a guest in town just looks about: no wares cried, none set out', () => {
  const { game, L, a } = start();
  const from = game.world.ow.settlements.find((s) => s.id !== L.settlement.id);
  const visit = { id: 'vg1', from: from.id, fromName: from.name, guest: true, traded: true, goods: {}, arrive: game.sim.abs - 10, leave: game.sim.abs + 600, coins: 0, earned: 0, name: 'A Guest' };
  const n = game.spawnVisitor(L, visit, 3);
  assert.ok(n && a.npcs.includes(n));
  assert.equal(n.wareStock(), null, 'nothing of theirs to sell');
  const said = [];
  n.say = (t) => said.push(t);
  n.activity = { entry: { act: 'visit', place: 'guest' }, key: 'x' };
  for (let i = 0; i < 40; i++) {
    n.lineCd = 0;
    game.update(0.25, stubInput());
  }
  assert.ok(!said.some((t) => /goods|wares|prices|Traded/.test(t)), said.join(' | '));
});

test('two people on one tile: when one walks off, the other still blocks the way', () => {
  const { game, a } = start();
  const [n1, n2] = a.npcs.filter((n) => !n.dead && !n.sleeping).slice(0, 2);
  const x = n1.x;
  const y = n1.y;
  const z = n1.z;
  game.moveEntity(n2, x, y, z);
  assert.equal(game.entityAt(x, y, z), n1);
  // n1 steps away: n2 is still standing there, and is on the map.
  game.moveEntity(n1, x + 40, y, z + 40);
  assert.equal(game.entityAt(x, y, z), n2);
  assert.equal(game.occupiedBySolid(x, y, z, game.player), n2, 'you can\'t walk through them');
});

test('travellers go round water by land, and down a finished road', () => {
  const game = world(777);
  const D = game.sim.diplomacy;
  const ss = game.world.ow.settlements;
  let best = null;
  for (const a of ss) {
    for (const b of ss) {
      if (a.id >= b.id || Math.hypot(a.cx - b.cx, a.cz - b.cz) > 8) continue;
      D.wayBudget = 1;
      const w = D.way(a, b);
      const c0 = w.pts[0];
      const c1 = w.pts[w.pts.length - 1];
      const L = Math.hypot(c1.x - c0.x, c1.z - c0.z);
      let ns = 0;
      for (let s = 0; s <= L; s += 2) if (wetAt(game, Math.round(c0.x + ((c1.x - c0.x) * s) / L), Math.round(c0.z + ((c1.z - c0.z) * s) / L))) ns++;
      let nw = 0;
      for (let s = 0; s <= w.len; s += 2) {
        const q = D.wayAt(w, s);
        if (wetAt(game, q.x, q.z)) nw++;
      }
      if (!best || ns - nw > best.ns - best.nw) best = { a, b, w, ns, nw };
    }
  }
  assert.ok(best.ns >= 20, `a straight line that crosses water (${best.ns})`);
  assert.ok(best.nw * 4 <= best.ns, `the way keeps to the land (${best.nw} wet vs ${best.ns})`);
  // (Cached; and one at a time: a second new way waits its turn.)
  assert.equal(D.way(best.a, best.b), best.w);
  D.wayBudget = 0;
  const other = ss.find((s) => s !== best.a && s !== best.b);
  assert.ok(D.way(best.a, other).rough, 'the straight line, for now');
  // A finished road is the way.
  D.wayBudget = 1;
  const road = D.startRoad(best.a, best.b);
  road.done = true;
  const rw = D.way(best.a, best.b);
  assert.ok(rw.road);
  // (A tile half way along the road is on the way.)
  const t = road.tiles[Math.floor(road.tiles.length / 2)];
  const q = D.wayAt(rw, D.wayNear(rw, t[0], t[2]));
  assert.ok(Math.hypot(q.x - t[0], q.z - t[2]) <= 2);
});

test('a traveller on the road walks the way round the lake, with dry feet', () => {
  const game = world(777);
  const D = game.sim.diplomacy;
  const input = stubInput();
  const ss = game.world.ow.settlements;
  const a = ss.find((s) => s.name === 'Zaresh');
  const b = ss.find((s) => s.name === 'Harim');
  assert.ok(a && b);
  D.wayBudget = 1;
  const w = D.way(a, b);
  const s0 = 120;
  const start = D.wayAt(w, s0);
  game.loadAround(start.x, start.z, true);
  const t = game.world.terrain;
  const col = t.column(start.x, start.z, t.context(start.x, start.z, start.x, start.z), {});
  const L0 = game.sim.layoutOf(a.id);
  const rec = L0.npcs.find((r) => r.age === 'adult' && alive(r));
  const n = new NPC(game, rec, L0);
  n.caravan = { tx: 0, tz: 0, way: w, to: b.name, from: a.name };
  n.state = 'caravan';
  n.teleport(start.x, game.world.findStandY(start.x, start.z, col.h + 1), start.z);
  game.npcs.push(n);
  let wet = 0;
  let steps = 0;
  let last = `${n.x},${n.z}`;
  for (let i = 0; i < 1200; i++) {
    const y = game.world.findStandY(n.x + 3, n.z, n.y);
    game.player.teleport(n.x + 3, y > 0 ? y : n.y, n.z);
    if (i % 50 === 0) game.loadAround(n.x, n.z, true);
    game.update(0.1, input);
    const k = `${n.x},${n.z}`;
    if (k !== last) {
      steps++;
      last = k;
      if (n.inWater) wet++;
    }
  }
  assert.ok(steps > 150, `on their way (${steps} steps)`);
  assert.ok(D.wayNear(w, n.x, n.z) - s0 > 120, 'along the way');
  assert.equal(wet, 0, 'dry feet');
});

// ------------------------------------------------------------ roads
test('every realm ties its towns together with roads, near you or far', () => {
  const game = world(12345);
  const R = game.sim.realms;
  const D = game.sim.diplomacy;
  const civs = game.world.ow.civs.filter((c) => R.members(c).length >= 2);
  assert.ok(civs.length >= 2);
  for (const civ of civs) {
    const cap = R.capitalOf(civ);
    const CL = game.sim.layoutOf(cap.id);
    CL.econ.treasury = 2000;
    const r = R.roadWorks(civ, CL, game.day);
    assert.ok(r, `${civ.name} starts a road`);
    const mine = new Set(R.members(civ).map((s) => s.id));
    assert.ok(mine.has(r.a), 'from one of its own towns');
    assert.ok(D.roads.some((q) => q.a === r.a && q.b === r.b));
    // One at a time (two for a big realm): not another straight away.
    if (mine.size < 6) assert.equal(R.roadWorks(civ, CL, game.day), null);
  }
});

test('road crews walk out to the road and home again: they never just appear or vanish', () => {
  const { game, input, L, a, sid } = start(12345, { learned: false }, 8 * 60);
  const D = game.sim.diplomacy;
  const ss = game.world.ow.settlements;
  const other = ss.filter((s) => s.id !== sid).sort((p, q) => D.dist(L.settlement, p) - D.dist(L.settlement, q))[0];
  const road = D.startRoad(L.settlement, other);
  assert.ok(road);
  const k = `${road.a}:${road.b}`;
  const crew = D.roadCrew(sid);
  assert.ok(crew.length >= 1);
  const ents = crew.map((r) => r.ent).filter((e) => e && !e.dead);
  assert.ok(ents.length >= 1, 'the builders are about town');
  // Watch for any hop.
  const hops = [];
  const tp = NPC.prototype.teleport;
  NPC.prototype.teleport = function (x, y, z) {
    if (crew.includes(this.rec)) hops.push([this.rec.name.first, x, z]);
    return tp.call(this, x, y, z);
  };
  try {
    D.crews(game.sim.abs);
    const n = ents[0];
    assert.equal(n.state, 'roadwork', 'off to the road');
    assert.ok(!a.npcs.includes(n));
    assert.equal(n.rec.ent, n, 'the same person, walking');
    const from = { x: n.x, z: n.z };
    for (let i = 0; i < 300; i++) {
      game.player.teleport(n.x + 2, game.world.findStandY(n.x + 2, n.z, n.y) > 0 ? game.world.findStandY(n.x + 2, n.z, n.y) : n.y, n.z);
      game.update(0.1, input);
    }
    assert.ok(Math.abs(n.x - from.x) + Math.abs(n.z - from.z) > 8, 'walked off down the road');
    // Evening: home along it.
    game.minute = 18 * 60;
    D.crews(game.sim.abs);
    assert.equal(n.state, 'roadhome');
    assert.ok(n.rec.walkHome && n.rec.away);
    for (let i = 0; i < 2400 && n.state === 'roadhome' && !n.dead; i++) {
      if (i % 4 === 0) game.player.teleport(n.x + 2, game.world.findStandY(n.x + 2, n.z, n.y) > 0 ? game.world.findStandY(n.x + 2, n.z, n.y) : n.y, n.z);
      game.update(0.1, input);
    }
    assert.ok(!n.dead && n.state === 'routine', `back in town (${n.state})`);
    assert.ok(a.npcs.includes(n) && !n.rec.away && !n.rec.walkHome);
    assert.deepEqual(hops, [], 'nobody hopped');
  } finally {
    NPC.prototype.teleport = tp;
  }
  assert.ok(D.roads.find((r) => `${r.a}:${r.b}` === k));
});

// ------------------------------------------------------------ the draft
test('a citizen is called up; stay away and you\'re a deserter, wanted in every town of the realm', () => {
  const game = world(12345);
  const { a, w } = atWar(game);
  const W = game.sim.war;
  const J = game.sim.justice;
  const home = game.world.ow.settlements.find((s) => s.civ === a);
  game.sim.citizen = { sid: home.id, since: game.day, host: null, hostBed: null, home: null, taxDay: game.day, owed: 0 };
  game.player.x = 0;
  game.player.z = 0;
  const plan = W.planBattle(w, game.day, new RNG(7));
  assert.ok(plan.draft && plan.draft.state === 'called');
  assert.ok(game.ui.msgs.some((m) => /Called to arms/.test(m)));
  W.battle(w, plan);
  assert.equal(plan.draft.state, 'deserted');
  assert.ok(W.isDeserter(a));
  const towns = game.sim.realms.members(a);
  assert.ok(towns.every((s) => game.isWanted(s.id) && J.pendingIn(s.id).some((c) => c.type === 'desertion')));
  // Answered for in one town: dropped everywhere.
  const L0 = game.sim.layoutOf(towns[0].id);
  J.jail = { sid: towns[0].id, phase: 'verdict', t: 0, how: 'surrender', party: [], lines: [], li: 0, lt: 0, release: null, cellless: true, guard: null, judge: null };
  const v = J.verdict();
  assert.ok(v.proven.some((c) => c.type === 'desertion'));
  J.convict(L0, v);
  assert.ok(!W.isDeserter(a));
  assert.ok(towns.every((s) => !game.isWanted(s.id)));
  // Saved and loaded: still a deserter, if you were.
  W.deserters[a.id] = { day: 1, war: w.id, battle: plan.name };
  const data = JSON.parse(JSON.stringify(game.serialize()));
  const g2 = new game.constructor({ seed: data.seed, renderer: game.renderer, audio: null, ui: game.ui, save: data });
  assert.ok(g2.sim.war.isDeserter(g2.world.ow.civs[0]));
});

test('called up and in the fight: paid for it; knocked senseless and the line breaks: taken prisoner, freed at the peace', () => {
  const game = world(12345);
  const input = stubInput();
  const { a, w } = atWar(game);
  const W = game.sim.war;
  const J = game.sim.justice;
  const home = game.world.ow.settlements.find((s) => s.civ === a);
  game.sim.citizen = { sid: home.id, since: game.day, host: null, hostBed: null, home: null, taxDay: game.day, owed: 0 };
  game.minute = 10 * 60;
  const plan = W.planBattle(w, game.day, new RNG(7));
  assert.ok(plan.draft);
  game.loadAround(plan.site.x, plan.site.z, true);
  const p = game.player;
  p.teleport(plan.site.x, game.world.findStandY(plan.site.x, plan.site.z, GROUND), plan.site.z);
  plan.at = game.sim.abs;
  W.update(0.1);
  const L = W.live;
  assert.ok(L && L.kind === 'battle', 'fought on the ground, with you there');
  const mine = plan.draft.side;
  const foe = mine === 'a' ? 'b' : 'a';
  assert.ok(L.sides[foe].hates, 'the other side knows which line you\'re in');
  for (let i = 0; i < 100; i++) {
    p.teleport(plan.site.x, game.world.findStandY(plan.site.x, plan.site.z, p.y), plan.site.z);
    W.liveTick(0.25);
  }
  assert.ok(plan.draft.present >= 20);
  // A soldier of theirs lays you out.
  const enemy = L.sides[foe].ents.find((n) => !n.dead);
  let down = false;
  for (let i = 0; i < 40 && !down; i++) {
    game.minute += 1;
    p.hp = 1;
    down = W.downPlayer(enemy);
  }
  assert.ok(down && p.down, 'knocked senseless, not killed');
  game.update(0.1, input);
  assert.ok(p.down, 'still out while the fight goes on');
  // Your side breaks.
  L.sides[mine].broken = true;
  W.battleTick(L);
  assert.ok(L.done);
  assert.equal(plan.draft.state, 'served', 'you were there');
  assert.ok(!p.down);
  assert.ok(J.jail && J.jail.pow, 'a prisoner of war');
  const cap = game.sim.realms.capitalOf(L.sides[foe].civ);
  assert.equal(J.jail.sid, cap.id, 'held in their capital');
  const CL = game.sim.layoutOf(cap.id);
  if (CL.jail) assert.ok(CL.jail.cell.some((c) => c.x === p.x && c.z === p.z), 'in the cell');
  // Peace: let go.
  W.peace(w, game.day + 1, new RNG(3), foe, false);
  assert.equal(J.jail, null);
  assert.ok(game.ui.msgs.some((m) => /Peace is made/.test(m)));
});
