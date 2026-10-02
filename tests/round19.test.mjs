import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGame, stubInput, lotsReady } from './helpers.mjs';
import { B } from '../src/world/blocks.js';
import { RNG } from '../src/util/rng.js';
import { alive, stockOf } from '../src/sim/econ.js';
import { TECHS, TECH_IDS } from '../src/sim/tech.js';
import { TechWindow, techPos } from '../src/ui/research.js';

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

const reload = (game) => {
  const data = JSON.parse(JSON.stringify(game.serialize()));
  return new game.constructor({ seed: data.seed, renderer: game.renderer, audio: null, ui: game.ui, save: data });
};

const people = (L) => L.npcs.filter((r) => alive(r) && !r.away && !r.migrated && !r.visitor);

function atWar(game) {
  const [a, b] = game.world.ow.civs;
  game.sim.realms.shift(a, b, -100, game.day);
  const w = game.sim.war.declare(a, b, { k: 'land', text: 'the land between them' }, game.day, new RNG(1));
  return { a, b, w };
}

// ------------------------------------------------------------ small things
test('a meal or a drink goes on the counter in front of someone, not off to the side', () => {
  const { game, L, p } = start();
  const n = game.npcs.find((q) => !q.dead && q.layout === L && q.rec.age === 'adult');
  const w = game.world;
  // Out in the open, counters on three sides of them.
  const x = p.x + 6;
  const z = p.z + 6;
  game.loadAround(x, z, true);
  const y = w.findStandY(x, z, 6);
  n.teleport(x, y, z);
  for (const [dx, dz] of [[-1, 0], [1, 0], [0, 1], [0, -1], [1, 1], [-1, -1]]) {
    w.setBlock(x + dx, y, z + dz, B.counter, 0);
    w.setBlock(x + dx, y + 1, z + dz, B.air, 0);
  }
  for (const [dir, dx, dz] of [[0, 0, 1], [1, -1, 0], [2, 0, -1], [3, 1, 0]]) {
    n.dir = dir;
    const at = n.surfaceNear(2);
    assert.deepEqual([at.x - x, at.z - z], [dx, dz], `facing ${dir}: the spot ahead`);
  }
});

// ------------------------------------------------------------ armies
test('armies draw on the watch and a levy, and the leader sends more or fewer by plan and people', () => {
  const game = world();
  const W = game.sim.war;
  const { w } = atWar(game);
  W.planBattle(w, game.day, new RNG(2));
  const pool = W.pool(w, 'a', w.plan);
  const guards = pool.recs.filter((q) => q.r.job === 'guard').length;
  const levy = pool.recs.filter((q) => q.levy).length;
  assert.ok(guards > 0 && levy > 0, `watch ${guards}, levy ${levy}`);
  assert.ok(pool.recs.every((q) => !['mayor', 'priest', 'researcher', 'child'].includes(q.r.job)), 'the levy spares those the realm can\'t');
  const civ = game.world.ow.civs[w.lead.a];
  const sent = (vals, tactic) => {
    civ.values = vals;
    return W.commit(w, 'a', pool, tactic, 1, w.plan);
  };
  const war = sent(['martial', 'pious'], 'pincer');
  const trade = sent(['mercantile', 'scholarly'], 'pincer');
  const dig = sent(['mercantile', 'scholarly'], 'works');
  const n = (q) => q.recs.length + q.extra;
  assert.ok(n(war) >= n(trade), 'a martial people sends more');
  assert.ok(n(trade) >= n(dig), 'a pincer needs more than a fortified line');
  for (const q of [war, trade, dig]) {
    assert.ok(n(q) >= q.min && n(q) <= q.max, 'between the least and the most');
    assert.ok(q.min >= Math.round(q.total * 0.35), 'at least a third');
  }
  // A levy fights with a spear, whatever their trade.
  const lv = pool.recs.find((q) => q.levy);
  const npc = game.spawnWarrior(lv.r, lv.L, { x: game.player.x + 3, y: game.player.y, z: game.player.z });
  npc.warband = { kind: 'battle', levy: true, side: 'a' };
  assert.equal(npc.weapon(), 'spear');
  // Muster rolls: a bigger levy.
  game.sim.tech.learn(civ, 'muster', game.day);
  const more = W.pool(w, 'a', w.plan).recs.filter((q) => q.levy).length;
  assert.ok(more > levy, `muster rolls (${levy} -> ${more})`);
});

// ------------------------------------------------------------ prisoners
test('the beaten are partly taken prisoner, marched to the victor\'s capital, and freed at the peace', () => {
  const game = world();
  const W = game.sim.war;
  const { a, b, w } = atWar(game);
  game.player.x = 0;
  game.player.z = 0;
  for (let i = 0; i < 12 && W.prisoners.length < 2; i++) {
    W.planBattle(w, game.day + i * 3, new RNG(10 + i));
    if (!w.plan) break;
    W.battle(w, w.plan);
  }
  assert.ok(W.prisoners.length > 0, 'prisoners taken');
  for (const p of W.prisoners) {
    const r = W.recOfPrisoner(p);
    assert.ok(r && alive(r) && r.captive && r.away, 'alive, held, away from home');
    const holder = game.world.ow.civs[p.by];
    assert.equal(p.at, game.sim.realms.realm(holder).capital, 'in the capital');
  }
  assert.ok(w.battles.some((q) => /taken prisoner/.test(q.text)), 'the news says so');
  W.peace(w, game.day + 40, new RNG(3), 'a', false);
  assert.equal(W.prisoners.filter((p) => [a.id, b.id].includes(p.by) && [a.id, b.id].includes(p.civ)).length, 0, 'everyone home at the peace');
});

test('prisoners are exchanged one for one, ransomed, or escape; full cells mean a stockade, a prison once it\'s known', () => {
  const game = world();
  const W = game.sim.war;
  const { a, b } = atWar(game);
  const La = game.sim.realms.memberLayouts(a);
  const Lb = game.sim.realms.memberLayouts(b);
  const take = (Ls, by, n) => {
    const out = [];
    for (const L of Ls) for (const r of people(L).filter((q) => q.age === 'adult' && q.ruler === undefined)) {
      if (out.length >= n) return out;
      const p = W.takePrisoner(r, L, by, game.day, 'test');
      if (p) out.push(p);
    }
    return out;
  };
  take(La, b, 6);
  take(Lb, a, 2);
  const capB = game.sim.realms.capitalOf(b);
  const CL = game.sim.layoutOf(capB.id);
  assert.ok(W.held(capB.id).length > W.capacity(CL), 'more than the cells hold');
  // One for one.
  for (let i = 0; i < 20 && W.prisoners.some((p) => p.by === a.id); i++) W.bargain(game.day + i * 7, new RNG(i));
  assert.equal(W.prisoners.filter((p) => p.by === a.id).length, 0, 'theirs all exchanged');
  assert.ok(W.prisoners.length < 8, 'ours exchanged for them');
  assert.ok(game.sim.realms.memberLayouts(a).some((L) => L.econ.ledger.some((n) => /exchanged prisoners/.test(n.text))));
  // Escapes (from crowded cells).
  const left = W.prisoners.length;
  for (let d = 0; d < 400 && W.prisoners.length === left; d++) W.prisonersDay(game.day + 1 + d, new RNG(d));
  assert.ok(W.prisoners.length < left, 'someone got out');
  // Room for more: a stockade; with Prisons, a great prison (a walled
  // capital with no room inside breaks out through its wall first).
  CL.econ.treasury = 2000;
  game.sim.works.projects = game.sim.works.projects.filter((q) => q.sid !== capB.id);
  game.sim.tech.learn(b, 'prisons', game.day);
  take(La, b, 10);
  const q = game.sim.works.projects.find((p) => !p.done && p.sid === capB.id && (p.type === 'prison' || p.type === 'stockade' || p.kind === 'breach'));
  assert.ok(q, 'making room');
  assert.ok(q.type === 'prison' || q.kind === 'breach', q.type || q.kind);
  // A prison where there's room for one: many cells.
  const town = game.world.ow.settlements.find((s) => s.type === 'town' && !game.sim.layoutOf(s.id).walled && lotsReady(game, game.sim.layoutOf(s.id), 'prison', 1).length);
  const TL = game.sim.layoutOf(town.id);
  TL.econ.treasury = 2000;
  stockOf(TL).stone = 200;
  stockOf(TL).wood = 200;
  const cap0 = W.capacity(TL);
  const pq = game.sim.works.startBuilding(TL, 'prison', '', false, 0);
  assert.ok(pq);
  game.sim.works.finishNow(TL, pq);
  assert.ok(W.capacity(TL) >= cap0 + 10, `a prison holds many (${cap0} -> ${W.capacity(TL)})`);
  assert.ok(TL.prisonCells.length >= 5);
  // (Saved and loaded.)
  const g2 = reload(game);
  assert.equal(g2.sim.war.prisoners.length, W.prisoners.length);
  const p0 = g2.sim.war.prisoners[0];
  if (p0) assert.ok(g2.sim.war.recOfPrisoner(p0).captive, 'still held after loading');
});

test('raiders knocked down in town are dragged to the cells, and prisoners sit in them while you\'re there', () => {
  const { game, input, L, p } = start(12345, { learned: false }, 22 * 60);
  const W = game.sim.war;
  const to = L.settlement;
  const from = game.world.ow.settlements.find((s) => s.civ && s.civ !== to.civ && game.sim.layoutOf(s.id) && people(game.sim.layoutOf(s.id)).filter((r) => r.job === 'guard').length >= 3);
  game.sim.realms.shift(from.civ, to.civ, -90, game.day);
  const raid = W.planRaid(from.civ, to.civ, from, to, game.day, new RNG(5));
  raid.at = game.sim.abs;
  W.update(0.1);
  assert.ok(W.live && W.live.kind === 'raid');
  // Knock them all down.
  const orig = Math.random;
  Math.random = () => 0;
  try {
    for (const n of W.live.ents) game.damage(n, 999, p);
  } finally {
    Math.random = orig;
  }
  assert.ok(W.live.ents.every((n) => n.down && !n.dead), 'down, not dead');
  for (let i = 0; i < 8 && W.live; i++) game.update(0.5, input);
  assert.equal(W.live, null, 'over');
  // A free town keeps its own prisoners; a realm's go to its capital.
  const held = W.prisoners.filter((q) => q.civ === (from.civ ? from.civ.id : null));
  assert.ok(held.length >= 2, 'raiders taken prisoner');
  // In the cells (when that town is the one you're in).
  const here = held.find((q) => q.at === to.id) || held[0];
  if (game.active.has(here.at)) {
    W.syncCaptives();
    const n = W.captiveEnts.get(here.id);
    assert.ok(n && n.state === 'captive', 'in a cell');
    assert.equal(n.heldItem(), null, 'no weapon');
  }
});

// ------------------------------------------------------------ the tree
test('the tree: four branches, lines that join again, new arts with real effects', () => {
  assert.equal(TECH_IDS.length, 48);
  for (const b of ['economy', 'warfare', 'society', 'engineering']) {
    const ids = TECH_IDS.filter((k) => TECHS[k].branch === b);
    assert.ok(ids.length >= 11);
    // (Engineering has two roots: masonry, and metalworking beside it.)
    const root = ids.filter((k) => !TECHS[k].req.length);
    assert.equal(root.length, b === 'engineering' ? 2 : 1, 'its roots');
    const cap = ids.find((k) => TECHS[k].tier >= 5);
    assert.ok(cap, 'a last step');
    for (const k of ids) for (const r of TECHS[k].req.flat()) assert.equal(TECHS[r].branch, b, 'needs only its own branch');
  }
  assert.ok(TECHS.trade_league.req.length === 2 && TECHS.embassies.req.length === 2 && TECHS.fortress.req.length === 2);
  const game = world();
  const T = game.sim.tech;
  const civ = game.world.ow.civs[0];
  const st = T.stateOf(civ);
  st.done = ['bookkeeping', 'guilds', 'gemcraft', 'banking'];
  assert.ok(!T.available(civ).includes('trade_league'), 'needs both lines');
  st.done.push('markets', 'caravan_law');
  assert.ok(T.available(civ).includes('trade_league'));
  // Embassies: allies made sooner.
  const [, b] = game.world.ow.civs;
  const P = game.sim.politics;
  b.values = civ.values.slice();
  game.sim.realms.shift(civ, b, 33 - game.sim.realms.relation(civ, b).score, game.day);
  for (let d = 1; d <= 20; d++) P.pacts([civ, b], game.day + d, new RNG(d));
  const before = P.allied(civ, b);
  T.learn(civ, 'embassies', game.day);
  for (let d = 21; d <= 60 && !P.allied(civ, b); d++) {
    game.sim.realms.shift(civ, b, 33 - game.sim.realms.relation(civ, b).score, null);
    P.pacts([civ, b], game.day + d, new RNG(d));
  }
  assert.ok(!before && P.allied(civ, b), 'envoys make friends sooner');
});

test('the tree window: steps on the map, zoom with the wheel, drag to move, click a step for the details', () => {
  const game = world();
  const s = game.world.ow.settlements.find((q) => q.civ && q.type === 'city');
  const ui = { mouseCell: { x: 0, y: 0 }, mouse: { x: 0, y: 0, down: false }, audio: null, msg() {} };
  const tw = new TechWindow(ui, game, s);
  tw.goal = { x: 0, y: 0, z: 1 };
  tw.cam = { x: 0, y: 0, z: 1 };
  // Each branch runs out its own way from the crest.
  const up = techPos('bookkeeping');
  const right = techPos('drill');
  const down = techPos('codex');
  const left = techPos('masonry');
  assert.ok(up.y < 0 && right.x > 0 && down.y > 0 && left.x < 0);
  // What's under the mouse.
  const q = tw.toScreen(techPos('archery'));
  assert.equal(tw.nodeAt(q.x, q.y), 'archery');
  // Zoom.
  ui.mouse = { x: q.x, y: q.y, down: false };
  tw.onWheel(-1);
  assert.ok(tw.goal.z > 1, 'in');
  tw.onWheel(1);
  tw.onWheel(1);
  assert.ok(tw.goal.z < 1, 'out');
  for (let i = 0; i < 40; i++) tw.update(0.05);
  // Drag.
  const c0 = { ...tw.cam };
  tw.onClick({ button: 0, x: 200, y: 150 });
  ui.mouse = { x: 240, y: 170, down: true };
  tw.update(0.016);
  assert.ok(tw.cam.x < c0.x && tw.cam.y < c0.y, 'the map moves with the mouse');
  ui.mouse.down = false;
  tw.update(0.016);
  assert.equal(tw.sel, null, 'a drag isn\'t a click');
  // Click a step: zoom in on it, the panel shows it.
  const r = tw.toScreen(techPos('alchemy'));
  tw.onClick({ button: 0, x: r.x, y: r.y });
  ui.mouse = { x: r.x, y: r.y, down: false };
  tw.update(0.016);
  assert.equal(tw.sel, 'alchemy');
  assert.ok(tw.goal.z >= 1.5);
  const texts = [];
  const g = new Proxy({}, { get: () => (...args) => { for (const x of args) if (typeof x === 'string' && x.length > 1) texts.push(x); } });
  tw.draw(g, game);
  assert.ok(texts.some((t) => t === 'ALCHEMY'));
  assert.ok(texts.some((t) => /Herbalists brew and sell/.test(t)));
  assert.ok(texts.some((t) => /Needs Written Law|Can be studied|Learned|Known/.test(t)));
});
