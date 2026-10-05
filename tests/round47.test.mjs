// Round 47: war call-ups for every player (not only whoever's hosting),
// cottages queued for the builders when more than one player wants one,
// the storm's clouds kept out of the turning pictures, and the thermal
// spire carried on up past the top of the world.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGame, stubInput, stubUI } from './helpers.mjs';
import { RNG } from '../src/util/rng.js';
import { drawStormSea } from '../src/render/stormfx.js';
import { spireRise } from '../src/render/oldplaces.js';

const keyInput = () => {
  const inp = stubInput();
  inp.keys = new Set();
  inp.isDown = (k) => inp.keys.has(k);
  return inp;
};

// The host and one other in the same world (no network), every town laid
// out.
function party(seed = 12345) {
  const game = makeGame(seed, { learned: false });
  const input = stubInput();
  game.minute = 10 * 60;
  for (let i = 0; i < 20; i++) game.update(0.1, input);
  for (const s of game.world.ow.settlements) game.sim.layoutOf(s.id);
  game.startParty({ id: 'h', name: 'Hosty' });
  const seat = game.addSeat({ id: 'g', name: 'Guesty' }, { ui: stubUI(), input: keyInput(), hero: null });
  return { game, input, seat, gp: seat.ent };
}

function atWar(game) {
  const [a, b] = game.world.ow.civs;
  game.sim.realms.shift(a, b, -100, game.day);
  const w = game.sim.war.declare(a, b, { k: 'land', text: 'the land between them' }, game.day, new RNG(1));
  return { a, b, w };
}

const citizenOf = (game, s) => ({ sid: s.id, since: game.day, host: null, hostBed: null, home: null, taxDay: game.day, owed: 0 });

// ------------------------------------------------------------ the draft
test('a guest who is a citizen of a realm at war is called up too, on their own', () => {
  const { game, gp } = party();
  const { a, w } = atWar(game);
  const W = game.sim.war;
  const home = game.world.ow.settlements.find((s) => s.civ === a);
  // Only the guest is a citizen.
  game.asPlayer(gp, () => {
    game.sim.citizen = citizenOf(game, home);
  });
  const plan = W.planBattle(w, game.day, new RNG(7));
  assert.ok(!plan.draft, 'the host isn\'t anyone\'s to call');
  const d = plan.drafts && plan.drafts.g;
  assert.ok(d && d.state === 'called', 'the guest is');
  assert.equal(game.asPlayer(gp, () => W.draftOf(plan)), d);
  // Nowhere near the field when it's fought: a deserter, theirs alone.
  game.player.x = 0;
  game.player.z = 0;
  gp.x = 0;
  gp.z = 0;
  W.battle(w, plan);
  assert.equal(d.state, 'deserted');
  assert.ok(!W.isDeserter(a), 'not the host');
  assert.ok(game.asPlayer(gp, () => W.isDeserter(a)), 'the guest');
  assert.ok(game.asPlayer(gp, () => game.isWanted(home.id)), 'wanted there');
  assert.ok(!game.isWanted(home.id), 'the host isn\'t');
  // Kept with them in the save.
  game.partyWorld = { name: 'Warland' };
  const save = JSON.parse(JSON.stringify(game.serialize()));
  const ch = new Map(save.party.chars).get('g');
  assert.ok(ch.deserters && ch.deserters[a.id], 'their desertion goes with their character');
});

test('host and guest both citizens: each called up, each answering for themselves', () => {
  const { game, gp } = party();
  const { a, w } = atWar(game);
  const W = game.sim.war;
  const home = game.world.ow.settlements.find((s) => s.civ === a);
  game.sim.citizen = citizenOf(game, home);
  game.asPlayer(gp, () => {
    game.sim.citizen = citizenOf(game, home);
  });
  const plan = W.planBattle(w, game.day, new RNG(7));
  assert.ok(plan.draft && plan.drafts && plan.drafts.g, 'both called');
  assert.notEqual(plan.draft, plan.drafts.g);
  // Both far from the field when it's fought: both desert.
  game.player.x = 0;
  game.player.z = 0;
  gp.x = 0;
  gp.z = 0;
  W.battle(w, plan);
  assert.equal(plan.draft.state, 'deserted');
  assert.equal(plan.drafts.g.state, 'deserted');
  // One answers for it: the other's still wanted.
  W.pardonDesertion(a);
  assert.ok(!W.isDeserter(a));
  assert.ok(game.asPlayer(gp, () => W.isDeserter(a)));
});

test('a guest who served in the fight is reckoned (and paid) as having done their part', () => {
  const { game, gp } = party();
  const { a, w } = atWar(game);
  const W = game.sim.war;
  const home = game.world.ow.settlements.find((s) => s.civ === a);
  game.asPlayer(gp, () => {
    game.sim.citizen = citizenOf(game, home);
  });
  const plan = W.planBattle(w, game.day, new RNG(7));
  const d = plan.drafts.g;
  d.present = 30;
  const coins = () => gp.inv.reduce((n, s) => n + (s && s.item === 'coin' ? s.count : 0), 0);
  const before = coins();
  W.reckonDraft({ plan });
  assert.equal(d.state, 'served');
  const cap = game.sim.realms.capitalOf(a);
  const CL = game.world.layouts.get(cap.id);
  if (CL && CL.econ && CL.econ.treasury >= 15) assert.ok(coins() > before, 'their pay goes to them');
});

// ------------------------------------------------------------ cottages in line
test('two players\' cottages: the second goes in line, and starts when the first is up', () => {
  const { game, gp } = party();
  const sim = game.sim;
  const s = game.world.ow.settlements.find((q) => q.type === 'village' && !q.deserted) || game.world.ow.settlements[0];
  const L = sim.layoutOf(s.id);
  const mayor = { layout: L };
  // The host is a citizen, and their house is going up.
  sim.citizen = citizenOf(game, s);
  game.player.give('coin', 500);
  let r = sim.ownHome(mayor);
  assert.ok(r.ok);
  if (!sim.construction) {
    // (No lot free in this town: theirs waits on one. Lay one on for the test.)
    sim.construction = { sid: s.id, plot: 0, bid: 0, done: false, owner: 'h', ownerName: game.playerName, placed: 0, need: 1, work: 0, last: sim.abs };
  }
  assert.equal(sim.construction.owner, 'h');
  // The guest asks too: not turned away, put in line after the host's.
  game.asPlayer(gp, () => {
    sim.citizen = citizenOf(game, s);
    gp.give('coin', 500);
    const t = sim.ownHomeTerms(mayor);
    assert.ok(t.ok, 'they can pay for one');
    assert.ok(t.after, 'after whose');
    r = sim.ownHome(mayor);
    assert.ok(r.ok && r.after);
    // Asking again: it's already in line.
    assert.equal(sim.ownHomeTerms(mayor).reason, 'inline');
    // What the builders tell them.
    assert.ok(sim.roads.yours(L).some((o) => o.what === 'home' && o.state === 'line'));
  });
  assert.equal(sim.homeQueue.length, 1);
  assert.equal(sim.construction.owner, 'h', 'the host\'s isn\'t touched');
  // The host's goes up: the guest's starts (or waits on a lot of its own).
  sim.construction.done = true;
  sim.nextHome();
  assert.equal(sim.homeQueue.length, 0);
  const started = sim.construction && !sim.construction.done && sim.construction.owner === 'g';
  const waiting = sim.roads.queue(L).some((o) => o.kind === 'home' && o.owner === 'g');
  assert.ok(started || waiting, 'theirs is next');
  if (started) assert.equal(sim.construction.ownerName, 'Guesty');
});

test('a queued cottage keeps its owner: a lot coming free starts it as them', () => {
  const { game, gp } = party();
  const sim = game.sim;
  const s = game.world.ow.settlements[0];
  const L = sim.layoutOf(s.id);
  game.asPlayer(gp, () => {
    sim.citizen = citizenOf(game, s);
  });
  // Two waiting on lots: the host's and the guest's are two, not one.
  sim.roads.enqueue(L, { kind: 'home', type: 'house_s', owner: null });
  sim.roads.enqueue(L, { kind: 'home', type: 'house_s', owner: 'g' });
  assert.equal(sim.roads.queue(L).filter((o) => o.kind === 'home').length, 2);
  // A lot for the guest's: started as them (whoever's turn it is).
  const plot = sim.works.freePlot(L);
  if (plot) {
    sim.startHome(L, 'g');
    assert.equal(sim.construction && sim.construction.owner, 'g');
  }
});

test('the queue of cottages is kept in the save', () => {
  const { game } = party();
  game.sim.homeQueue.push({ sid: 0, owner: 'g', ownerName: 'Guesty', day: 1 });
  const data = JSON.parse(JSON.stringify(game.serialize()));
  assert.equal(data.sim.homeQueue.length, 1);
  const g2 = new game.constructor({ seed: data.seed, renderer: game.renderer, audio: null, ui: game.ui, save: data });
  assert.equal(g2.sim.homeQueue[0].owner, 'g');
});

// ------------------------------------------------------------ the storm, turning
// A context that notes what's filled over the whole of the view.
function recorder(vw, vh) {
  const full = [];
  const grad = { addColorStop() {} };
  const ctx = {
    save() {}, restore() {}, translate() {}, scale() {}, drawImage() {},
    fillRect(x, y, w, h) {
      if (w >= vw && h >= vh * 0.5) full.push([x, y, w, h]);
    },
    createRadialGradient: () => grad,
    createLinearGradient: () => grad,
  };
  return { ctx, full };
}

test('the storm\'s clouds and its red are the view\'s: not drawn into a turn\'s pictures, drawn over them', () => {
  const vw = 640;
  const vh = 360;
  const { ctx, full } = recorder(vw, vh);
  const r = { ctx, vw, vh, time: 1, toView: (x, z) => [x, z], camX: 0, camY: 0 };
  const game = { player: { x: 0, z: 0 }, dungeon: null, stormSea: { cloud: 1, dark: 0, flash: 0, red: 1, depth: 0, phase: null } };
  drawStormSea(r, game, 'world');
  assert.equal(full.length, 0, 'nothing over the whole view in the pictures that turn');
  drawStormSea(r, game, 'sky');
  assert.ok(full.length > 0, 'the cloud and the red, upright over the turn');
  full.length = 0;
  drawStormSea(r, game);
  assert.ok(full.length > 0, 'and as ever when the camera is still');
});

// ------------------------------------------------------------ the thermal spire
test('the thermal spire goes on up past the top of the world; the others are as they were', () => {
  assert.ok(spireRise({ theme: 'thermal' }) >= 12);
  assert.equal(spireRise({ theme: 'facility' }), 0);
  assert.equal(spireRise({ theme: 'tidal' }), 0);
  assert.equal(spireRise(null), 0);
});
