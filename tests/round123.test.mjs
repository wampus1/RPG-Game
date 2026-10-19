// Round 123: three new origins. A leader (at the head of a town, or ruling
// a realm, governed as they chose); a brigand (sworn to the Black Gulls,
// at their haven with a sloop and crew of their own, and a bad name in
// the realms nearby); an outworlder (fallen from space in an escape pod,
// with mutations of their choosing, slow to be trusted and slower to be
// let lead). Each with its own painted opening.
import test from 'node:test';
import assert from 'node:assert/strict';
import { stubRenderer, stubUI } from './helpers.mjs';
import { Game } from '../src/game/game.js';
import { ORIGINS, MUTATIONS, MUTATION_IDS, MUTATION_MAX, normalizeHero, randomHero, has, hpBonus, damageMult, opinionBonus, repGainMult, staminaBonus, leadOf } from '../src/game/hero.js';
import { shipsOf } from '../src/game/ships3d.js';
import { piracyOf, isKnownPirate, pirateTo } from '../src/game/piracy.js';
import { INFAMY } from '../src/game/origins.js';
import { introFrom } from '../src/game/intros.js';
import { drawHumanoid } from '../src/render/people.js';
import { CharacterWindow } from '../src/ui/create.js';
import { Grid } from '../src/ui/ascii.js';
import { GAME_VERSION, compareVersions } from '../src/version.js';
import { stepsFor } from '../src/game/migrate.js';

const begin = (hero, seed = 12345) => new Game({ seed, renderer: stubRenderer(), audio: null, ui: stubUI(), hero: { ...randomHero(seed), name: 'Anwen', ...hero }, intro: true });

test('three new origins; an outworlder\'s mutations, each a gift and a cost, three at most, worn on the body', () => {
  for (const k of ['leader', 'brigand', 'outworlder']) assert.ok(ORIGINS[k] && ORIGINS[k].name && ORIGINS[k].about.length <= 144, k);
  assert.equal(MUTATION_IDS.length, 7);
  for (const k of MUTATION_IDS) assert.ok(MUTATIONS[k].gift && MUTATIONS[k].cost && MUTATIONS[k].grants, k);
  const h = normalizeHero({ origin: 'outworlder', mutations: ['chitin', 'glow', 'dense', 'gills'] });
  assert.equal(h.mutations.length, MUTATION_MAX);
  assert.deepEqual(h.look.mut, h.mutations);
  // The gifts and the costs, where they count.
  assert.ok(has(h, 'night_eyes') && has(h, 'notorious'), 'glowing spots');
  assert.equal(hpBonus(h), hpBonus({ ...h, mutations: [] }) + 4, 'chitin: tough');
  assert.ok(damageMult(h) > damageMult({ ...h, mutations: [] }), 'a dense frame: stronger');
  const g = normalizeHero({ origin: 'outworlder', mutations: ['gills'] });
  assert.equal(staminaBonus(g), staminaBonus({ ...g, mutations: [] }) - 20);
  // Not an outworlder: no mutations at all.
  const n = normalizeHero({ origin: 'crash', mutations: ['chitin'] });
  assert.equal(n.mutations.length, 0);
  assert.ok(!n.look.mut);
  // Folk are slow to warm to them.
  assert.ok(opinionBonus(h) < opinionBonus(n));
  assert.ok(repGainMult(h) < repGainMult(n));
  // Seen on the body: the sprite isn't the same with them as without.
  const a = drawHumanoid({ ...h.look, mut: ['third_eye', 'antennae'] }, 0, 0);
  const b = drawHumanoid({ ...h.look, mut: [] }, 0, 0);
  assert.notDeepEqual(Array.from(a.d), Array.from(b.d));
  // (A random character is still one of the first three.)
  for (let s = 0; s < 20; s++) assert.ok(['crash', 'native', 'star'].includes(randomHero(s).origin));
});

test('a leader of a town: at its head from the first morning, under the charter chosen, its opening a coronation of sorts', () => {
  const game = begin({ origin: 'leader', lead: { scope: 'town', style: 'guild' } });
  const o = game.sim.office;
  const T = o.heldBy(o.pid());
  assert.ok(T, 'governs a town');
  assert.equal(T.charter, 'guild');
  assert.equal(T.holder.how, 'birthright');
  assert.ok(game.sim.isCitizen(T.sid));
  assert.equal(game.currentSettlement && game.currentSettlement.id, T.sid);
  assert.ok(game.scene && game.scene.kind === 'leader_intro');
  assert.equal(game.scene.info.title, 'Guildmaster');
  // (A guest's screen makes it again from what's told.)
  const again = introFrom(game, { kind: 'leader_intro', info: game.scene.info });
  assert.equal(again.kind, 'leader_intro');
  game.scene.end(game);
  assert.ok(game.ui.msgs.some((m) => /You govern/.test(m)));
});

test('a leader of a realm: the throne, governed as chosen, and its capital too', () => {
  const game = begin({ origin: 'leader', lead: { scope: 'realm', style: 'theocracy' } });
  const C = game.sim.crown.heldBy(game.sim.office.pid());
  assert.ok(C, 'rules a realm');
  const civ = game.world.ow.civs[C.civ];
  assert.equal(game.sim.realms.realm(civ).form, 'theocracy');
  assert.equal(game.sim.office.heldBy(game.sim.office.pid()).sid, game.sim.realms.capitalOf(civ).id);
  assert.equal(game.scene.kind, 'leader_intro');
  assert.ok(game.scene.info.realm);
  assert.equal(leadOf({ lead: { scope: 'realm', style: 'nonsense' } }).style, 'monarchy');
});

test('a brigand: sworn to the Black Gulls, a sloop and a hand or two, the haven and its people, and a bad name nearby', () => {
  const game = begin({ origin: 'brigand' });
  const p = game.player;
  const r = piracyOf(game, p);
  assert.equal(r.guild, 0);
  assert.ok(isKnownPirate(game, p));
  const civs = Object.keys(game.hero.infamy || {});
  assert.ok(civs.length >= 1);
  for (const c of civs) {
    assert.equal(game.hero.infamy[c], INFAMY);
    assert.ok(pirateTo(game, p, Number(c)), 'their warships know you');
  }
  const mine = shipsOf(game).filter((S) => S.owner && S.type === 'sloop');
  assert.equal(mine.length, 1);
  assert.ok(mine[0].crewRecs.length >= 1 && mine[0].crewRecs.length <= 2);
  assert.ok(Math.hypot(mine[0].x - p.x, mine[0].z - p.z) < 100, 'off the beach');
  const th = game.sim.saga.live().find((t) => t.m === 'pirate_haven');
  assert.ok(th && th.actors.length === 5, 'the brethren of the haven');
  assert.ok(th.actors.some((a) => a.role === 'quartermaster') && th.actors.some((a) => a.role === 'chief'));
  assert.equal(game.scene.kind, 'brigand_intro');
  assert.equal(game.scene.info.ship, mine[0].name);
  // A town of a realm that knows your name thinks the worse of you.
  const sid = game.world.ow.settlements.find((s) => s.civ && String(s.civ.id) === civs[0]).id;
  const L = game.sim.layoutOf(sid);
  const rec = L.npcs.find((q) => q.age === 'adult');
  const v = game.sim.opinion({ rec, settlement: L.settlement, layout: L });
  game.hero.infamy = {};
  const w = game.sim.opinion({ rec, settlement: L.settlement, layout: L });
  assert.ok(v < w);
});

test('an outworlder: an escape pod in a crater in the wilds; slow to be let stand for office, never offered it', () => {
  const game = begin({ origin: 'outworlder', mutations: ['third_eye', 'antennae'] });
  assert.ok(game.hero.podAt, 'the pod');
  assert.equal(game.originAt.kind, 'outworlder');
  assert.ok(!game.currentSettlement, 'not in a town');
  assert.deepEqual(game.player.baseLook.mut, ['third_eye', 'antennae']);
  assert.equal(game.scene.kind, 'outworld_intro');
  assert.ok(game.scene.info.muts.length === 2);
  // Standing for mayor: wanted known far longer.
  const sim = game.sim;
  const s = game.world.ow.settlements.find((q) => q.type === 'town' && q.civ);
  const L = sim.layoutOf(s.id);
  sim.citizen = { sid: s.id, since: game.day - 5, host: null, home: null, taxDay: game.day, owed: 0 };
  const t = sim.office.canStand(L);
  assert.ok(!t.ok && /not of this world/.test(t.why), t.why);
  sim.citizen.since = game.day - 30;
  const t2 = sim.office.canStand(L);
  assert.ok(t2.ok);
  game.hero.origin = 'crash';
  const fee = sim.office.canStand(L).fee;
  game.hero.origin = 'outworlder';
  assert.equal(t2.fee, fee * 2, 'and twice the fee');
});

test('the character screen: a leader\'s choices on the basics; a mutations tab for an outworlder only', () => {
  const ui = { mouseCell: { x: 0, y: 0 }, time: 0, msg() {}, close() {}, open: (w) => w, audio: null };
  const w = new CharacterWindow(ui, 7, () => {});
  w.setOrigin(w.origins().find((o) => o.game === 'leader'));
  assert.ok(!w.tabs.some((t) => t.id === 'mutations'));
  assert.ok(w.rows.some((r) => r.id === 'leadScope') && w.rows.some((r) => r.id === 'leadStyle'));
  w.rows.find((r) => r.id === 'leadScope').set(1);
  assert.equal(leadOf(w.hero).scope, 'realm');
  let g = new Grid(w.w, w.h);
  w.draw(g);
  assert.ok(g.ch.join('').includes('Governed as'));
  w.setOrigin(w.origins().find((o) => o.game === 'outworlder'));
  const i = w.tabs.findIndex((t) => t.id === 'mutations');
  assert.ok(i >= 0);
  for (const k of ['third_eye', 'glow', 'chitin']) assert.ok(w.mutate(k));
  assert.ok(!w.mutate('gills'), 'three at most');
  assert.ok(w.mutate('glow'), 'taken off again');
  assert.deepEqual(w.hero.look.mut, ['third_eye', 'chitin']);
  w.setTab(i);
  g = new Grid(w.w, w.h);
  w.draw(g);
  assert.ok(g.ch.join('').includes('MUTATIONS'));
  w.setOrigin(w.origins().find((o) => o.game === 'crash'));
  assert.ok(!w.tabs.some((t) => t.id === 'mutations'));
});

test('version 1.23.0, and the step to it', () => {
  assert.ok(compareVersions(GAME_VERSION, '1.23.0') >= 0);
  const steps = stepsFor('1.22.0').filter((s) => s.to === '1.23.0');
  assert.equal(steps.length, 1);
  const log = [];
  steps[0].data({}, log);
  assert.ok(/Leader/.test(log[0]) && /Brigand/.test(log[0]) && /Outworlder/.test(log[0]));
});
