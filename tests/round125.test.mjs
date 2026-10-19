// Round 125: governing, smoothed. A leader's opening no longer has the
// oath's banner over it; townsfolk speak to the one who governs them as
// such; their status says so; the hall's chests are theirs to open; a
// vote being shown doesn't hold the pages shut. Small notes in the corner
// for a matter tabled, a vote called, how it went; a record of everything
// decided; rates set to the point on a slider (the least tax, the tribute,
// the watch's pay); officers' traits, two or three each, at work wherever
// they serve, and a look at a candidate before they're named; how a war
// goes, at a glance; sittings and crises that keep pace with sleep and
// long waits. And letters and pages held up to read, in their writers' own
// hands.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGame, stubInput, stubRenderer, stubUI } from './helpers.mjs';
import { Game } from '../src/game/game.js';
import { randomHero } from '../src/game/hero.js';
import { Grid } from '../src/ui/ascii.js';
import { CouncilWindow } from '../src/ui/council.js';
import { CrownWindow } from '../src/ui/crown.js';
import { leaderOf } from '../src/game/dialogue.js';
import { playerProfile } from '../src/ui/windows.js';
import { traitsOf, OTRAITS, suits } from '../src/sim/officertraits.js';
import { WAGE } from '../src/sim/office.js';
import { FLOOR_MAX } from '../src/sim/crown.js';
import { DocumentWindow } from '../src/ui/document.js';
import { handFor, signerOf, HANDS } from '../src/ui/hands.js';
import { GAME_VERSION, compareVersions } from '../src/version.js';
import { stepsFor } from '../src/game/migrate.js';

const input = stubInput();
function world(seed = 12345) {
  const game = makeGame(seed);
  for (let i = 0; i < 6; i++) game.update(0.1, input);
  return { game, sim: game.sim, o: game.sim.office, crown: game.sim.crown };
}
function governing(W) {
  const s = W.game.world.ow.settlements.find((q) => q.type === 'town' && q.civ);
  const L = W.sim.layoutOf(s.id);
  W.o.install(L, W.o.pid(), 'Anwen', 'election', W.game.day);
  return { s, L, T: W.o.of(s.id) };
}
const uiFor = (game) => ({ mouseCell: { x: 0, y: 0 }, time: 0, msg() {}, close() {}, open: (w) => w, audio: null, game });

test('a leader\'s opening: the oath\'s banner waits till it\'s over; their status, and how they\'re spoken to, say what they are', () => {
  const game = new Game({ seed: 12345, renderer: stubRenderer(), audio: null, ui: { ...stubUI(), showOffice() {} }, hero: { ...randomHero(12345), name: 'Anwen', origin: 'leader', lead: { scope: 'town', style: 'council' } }, intro: true });
  const o = game.sim.office;
  assert.ok(game.scene && game.scene.kind === 'leader_intro');
  o.show(o.pid(), 'oath', { sid: o.heldBy(o.pid()).sid });
  const n = o.shows.length;
  o.update();
  assert.equal(o.shows.length, n, 'not over the opening');
  game.scene = null;
  o.update();
  assert.ok(o.shows.length < n, 'shown once it\'s over');
  const T = o.heldBy(o.pid());
  const s = game.world.ow.settlements[T.sid];
  const lead = leaderOf(game, s);
  assert.ok(lead && lead.scope === 'town' && lead.title);
  assert.ok(playerProfile(game).title.includes(`of ${s.name}`));
  assert.ok(playerProfile(game).leader);
});

test('the hall\'s chests: open to the one who governs, no theft; coin drawn goes in the minutes', () => {
  const W = world();
  const { s, L, T } = governing(W);
  const t = L.treasury && L.treasury[0];
  assert.ok(t, 'the treasury\'s chests');
  const owner = W.game.containerOwner(t.x, t.y, t.z);
  assert.equal(owner.kind, 'office');
  assert.equal(W.game.chestLocked(t.x, t.y, t.z, owner), false);
  assert.equal(W.game.onContainerTake({ owner }, [{ item: 'coin', count: 30 }]), false, 'no theft');
  assert.ok(T.minutes.some((m) => /drew ¤30/.test(m.what)));
  // (Not a town of yours: locked, and theirs.)
  W.o.unseat(L, 'test', W.game.day, null, true);
  assert.notEqual(W.game.containerOwner(t.x, t.y, t.z).kind, 'office');
  void s;
});

test('a vote being shown doesn\'t hold the pages shut', () => {
  const W = world();
  const civ = W.game.world.ow.civs.find((c) => c && W.sim.realms.members(c).length >= 2);
  W.crown.crownPlayer(civ, W.o.pid(), W.game.playerName, 'succession', W.game.day, { form: 'monarchy' });
  const w = new CrownWindow(uiFor(W.game), civ.id);
  w.reveal = { id: 1, vote: { state: 'decreed', ballots: [] }, t: 0, label: 'x', it: { title: 'x', opts: [] } };
  w.goTab('decrees');
  assert.equal(w.tab, 'decrees');
  assert.equal(w.reveal, null);
});

test('notes for a matter tabled and a vote\'s result; a record of what was decided, and how', () => {
  const W = world();
  const { L, T } = governing(W);
  W.o.notes = [];
  T.agenda = [];
  T.quiet = {};
  W.o.table(L, T, W.game.day, W.sim.abs);
  assert.ok(W.o.notes.some((n) => /new matter/.test(n.text)), 'a matter tabled');
  const it = T.agenda.find((q) => !q.done && !q.crisis);
  assert.ok(it);
  W.o.carry(L, T, it, W.game.day, 0, 'steward');
  const rec = T.record[T.record.length - 1];
  assert.equal(rec.outcome, 'standing');
  assert.equal(rec.title, it.title);
  // (The record page draws it.)
  const w = new CouncilWindow(uiFor(W.game), L.settlement.id, 'record');
  const g = new Grid(w.w, w.h);
  w.draw(g, W.game);
  assert.ok(g.ch.join('').includes('BY ORDER'));
});

test('rates to the point: the least tax and the tribute, and the watch\'s pay', () => {
  const W = world();
  const civ = W.game.world.ow.civs.find((c) => c && W.sim.realms.members(c).length >= 2);
  W.crown.crownPlayer(civ, W.o.pid(), W.game.playerName, 'succession', W.game.day, { form: 'monarchy' });
  const R = W.sim.realms.realm(civ);
  W.crown.decree(civ, 'taxFloor', 0.07);
  assert.equal(R.decrees.taxFloor, 0.07);
  W.crown.decree(civ, 'taxFloor', 0.5);
  assert.equal(R.decrees.taxFloor, FLOOR_MAX);
  W.crown.decree(civ, 'share', 0.11);
  assert.equal(R.share, 0.11);
  const { L, T } = governing(W);
  const r = W.o.propose(L, 'wage', 8);
  assert.ok(r.ok, r.why);
  W.o.apply(L, T, r.item.opts[0].fx, W.game.day, r.item);
  assert.equal(T.wage, 8);
  assert.equal(T.budget.watch, 2);
  T.today = { relief: 0, alms: 0, stipend: 0, decided: [] };
  W.o.routine(L, T, W.game.day, { chance: () => false, int: () => 0, next: () => 0.5 }, 'x');
  assert.equal(L.econ.guardWage, 8);
  assert.ok(WAGE.min < 5 && WAGE.max > 7);
});

test('officers\' traits: two or three each, never both of a pair, at work in office; a candidate looked over first', () => {
  const W = world();
  const { L, T } = governing(W);
  const against = [['diligent', 'careless'], ['honest', 'grasping'], ['brave', 'timid'], ['stern', 'merciful'], ['ambitious', 'loyal']];
  for (const r of L.npcs.filter((q) => q.age !== 'child').slice(0, 30)) {
    const t = traitsOf(r);
    assert.ok(t.length >= 2 && t.length <= 3, `${t}`);
    for (const [a, b] of against) assert.ok(!(t.includes(a) && t.includes(b)));
    for (const k of t) assert.ok(OTRAITS[k]);
    assert.deepEqual(traitsOf(r), t, 'the same every time');
  }
  const c = W.o.candidates(L, 'treasurer');
  assert.ok(c.length && c[0].traits.length && c[0].stars >= 0 && c[0].stars <= 4);
  assert.equal(suits('treasurer', c[0].r), c[0].stars);
  // A grasping treasurer skims; an honest one never.
  const tr = c[0].r;
  tr.otraits = { v: 1, list: ['honest', 'shrewd'] };
  W.o.appoint(L, 'treasurer', tr.idx);
  T.today = { relief: 0, alms: 0, stipend: 0, decided: [] };
  W.o.routine(L, T, W.game.day, { chance: () => true, int: () => 0, next: () => 0.5 }, 'x');
  assert.ok(L.econ.taxBoost > 1);
  assert.ok(!T.skimmed);
  // The card: who they are, before they're named.
  const w = new CouncilWindow(uiFor(W.game), L.settlement.id, 'officers');
  w.officeSel = 'captain';
  w.inspect = tr.idx;
  const g = new Grid(w.w, w.h);
  w.draw(g, W.game);
  const text = g.ch.join('');
  assert.ok(text.includes('Traits') && text.includes('Honest'));
});

test('how a war goes, at a glance', () => {
  const W = world();
  const civs = W.game.world.ow.civs.filter((c) => c && W.sim.realms.members(c).length >= 1);
  const [a, b] = civs;
  W.crown.crownPlayer(a, W.o.pid(), W.game.playerName, 'succession', W.game.day, { form: 'monarchy' });
  const war = W.sim.war.declare(a, b, { k: 'land', text: 'the old border' }, W.game.day, { chance: () => false, int: () => 0, next: () => 0.5 });
  war.battles.push({ day: W.game.day, name: 'the Battle of the Ford', na: 20, nb: 14, la: 3, lb: 6, winner: W.sim.war.sideOf(war, a), decisive: false });
  const w = new CrownWindow(uiFor(W.game), a.id, 'war');
  const g = new Grid(w.w, w.h);
  w.draw(g, W.game);
  const text = g.ch.join('');
  assert.ok(text.includes('AT WAR') && text.includes('the Battle of the Ford') && text.includes('WON'));
});

test('time racing by: a crisis rouses whoever must answer it, and gives them its hours from now', () => {
  const W = world();
  const { L, T } = governing(W);
  W.game.waiting = { until: W.sim.abs + 600, hp: 20, t: 0, hours: 10 };
  const spec = { key: 'test', kind: 'crisis', title: 'A test crisis', why: ['Because.'], opts: [{ label: 'Act', fx: {} }], crisis: 'test', hours: 6 };
  const it = W.o.crisis(L, T, spec, W.game.day - 1, (W.game.day - 1) * 1440 + 600);
  assert.equal(W.game.waiting, null, 'woken');
  assert.ok(it.until >= W.sim.abs + 6 * 60 - 1, 'hours from now');
});

test('letters held up to read: each writer\'s own hand; signed, the signer\'s', () => {
  assert.ok(HANDS.length >= 6);
  assert.deepEqual(handFor('Mags'), handFor('Mags'));
  const fonts = new Set(['Mags', 'Wren', 'Silas', 'Bess', 'Corwin', 'Nell', 'Tam', 'Jory'].map((n) => handFor(n).font));
  assert.ok(fonts.size >= 3, 'different writers, different hands');
  assert.equal(signerOf(['Come alone.', '- Mags']), 'Mags');
  assert.equal(signerOf(['Yours, Wren']), 'Wren');
  const ui = { close() {}, audio: null };
  const w = new DocumentWindow(ui, { title: 'A letter', lines: ['Come alone.', '- Mags'], kind: 'letter' });
  assert.equal(w.signer, 'Mags');
  assert.equal(w.hand.font, handFor('Mags').font);
  const b = new DocumentWindow(ui, { title: 'ON MINING', lines: ['Iron sleeps in deep stone.'], kind: 'book' });
  assert.equal(b.hand.font, 'IM Fell English');
  assert.ok(w.onKey({ code: 'Space' }) && w.easy, 'the easier reading');
});

test('version 1.25.0, and the step to it', () => {
  assert.ok(compareVersions(GAME_VERSION, '1.25.0') >= 0);
  const steps = stepsFor('1.24.0').filter((s) => s.to === '1.25.0');
  assert.equal(steps.length, 1);
  const log = [];
  steps[0].data({}, log);
  assert.ok(/record/i.test(log[0]));
});
