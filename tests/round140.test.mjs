// Round 140: citizens and pardons. The head of a town makes others its
// citizens (the others playing, if they accept; nomads, adventurers and
// merchants staying in town) and pardons the others playing (a realm's
// ruler, throughout the realm); the council sits on the stroke of ten, so
// what was sent to it is voted on then; a guest lodging in a town keeps
// their HUD; and the version's step.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { makeGame, stubInput, stubUI } from './helpers.mjs';
import { asSeat } from '../src/game/party.js';
import { makeVisitor } from '../src/sim/econ.js';
import { topicsFor, respond, leaderOf } from '../src/game/dialogue.js';
import { CouncilWindow } from '../src/ui/council.js';
import { CrownWindow } from '../src/ui/crown.js';
import { BannerWindow } from '../src/ui/hustings.js';
import { Grid } from '../src/ui/ascii.js';
import { RNG } from '../src/util/rng.js';
import { GAME_VERSION, compareVersions } from '../src/version.js';
import { stepsFor } from '../src/game/migrate.js';

const src = (f) => fs.readFileSync(new URL(`../src/${f}`, import.meta.url), 'utf8');
const text = (g) => g.ch.join('');

// A world with two playing: the host heads a town (of a realm); the other
// is seated beside them.
function two(seed = 12345) {
  const input = stubInput();
  const game = makeGame(seed);
  game.startParty({ id: 'h', name: 'Hosty' });
  const gui = stubUI();
  const shown = [];
  gui.showOffice = (k, d) => shown.push([k, d]);
  const seat = game.addSeat({ id: 'g', name: 'Guesty' }, { ui: gui, input: stubInput(), hero: null });
  for (let i = 0; i < 6; i++) game.update(0.1, input);
  const sim = game.sim;
  const s = game.world.ow.settlements.find((q) => q.type === 'town' && !q.deserted && q.civ);
  const L = game.world.layouts.get(s.id) || game.world.layOut(s);
  const o = sim.office;
  sim.citizen = { sid: s.id, since: game.day - 5, host: null, home: null, taxDay: game.day, owed: 0 };
  o.install(L, o.pid(), 'Hosty', 'election', game.day);
  const as = (fn) => asSeat(game, seat, fn);
  const step = (n) => {
    for (let i = 0; i < n; i++) game.update(0.25, input);
  };
  return { game, sim, s, L, o, seat, as, step, shown };
}

test('the council sits on the stroke of ten: what was sent to it is voted on then, not an hour after', () => {
  const input = stubInput();
  const game = makeGame(12345);
  for (let i = 0; i < 6; i++) game.update(0.1, input);
  const sim = game.sim;
  const s = game.world.ow.settlements.find((q) => q.type === 'town' && !q.deserted);
  const L = game.world.layouts.get(s.id) || game.world.layOut(s);
  sim.citizen = { sid: s.id, since: game.day - 5, host: null, home: null, taxDay: game.day, owed: 0 };
  const o = sim.office;
  game.teleportPlayer(L.plaza.cx, 6, L.plaza.cz + 2);
  // (In the town, so its hours are kept as they pass: see Sim.update.)
  for (let i = 0; i < 200 && !game.active.has(s.id); i++) game.update(0.25, input);
  assert.ok(game.active.has(s.id));
  const T = o.install(L, o.pid(), game.playerName, 'election', game.day);
  const it = T.agenda.find((q) => q.state === 'open' && !q.crisis && q.opts.some((p) => !p.trivial && !p.off));
  const k = it.opts.findIndex((p) => !p.trivial && !p.off);
  assert.ok(game.minute < 9 * 60, 'decided before the sitting');
  assert.equal(o.decide(L, it.id, k).state, 'sent', 'away from the hall: sent');
  // Ten minutes to ten: still waiting.
  game.advanceTime(9 * 60 + 50 - game.minute);
  for (let i = 0; i < 3; i++) game.update(0.25, input);
  assert.equal(it.state, 'sent');
  assert.ok(!it.done);
  // Ten o'clock: voted on, there and then (not when the hour is out).
  game.advanceTime(10 * 60 + 1 - game.minute);
  for (let i = 0; i < 3; i++) game.update(0.25, input);
  assert.ok(game.minute < 11 * 60);
  assert.ok(it.done || it.state !== 'sent', `voted on at ten (${it.state})`);
  assert.equal(T.lastSession, game.day);
  // And the hour's own business, at eleven, doesn't hold it a second time.
  const notes = o.notes.length;
  game.advanceTime(11 * 60 + 5 - game.minute);
  for (let i = 0; i < 3; i++) game.update(0.25, input);
  assert.ok(!o.notes.slice(notes).some((n) => /The council sits/.test(n.text)), 'one sitting a day');
  assert.ok(src('sim/office.js').includes('sitOnTime(now)'));
});

test('a guest lodging in a town keeps their HUD: the family\'s name and their title come from the host', () => {
  // (On a guest's screen no town is laid out: the lookup is null, not an
  // error that took the whole HUD with it.)
  const game = makeGame(12345);
  const sim = game.sim;
  const s = game.world.ow.settlements.find((q) => q.type === 'town' && !q.deserted);
  sim.citizen = { sid: s.id, since: 1, host: 3, home: null, taxDay: 1, owed: 0 };
  sim.layoutOf = () => null;
  assert.equal(sim.hostName(), null);
  // The host sends them, with the rest of their own (see net/host.js);
  // their screen uses them (net/guest.js, dialogue.leaderOf).
  const host = src('net/host.js');
  assert.ok(/hn: sim\.citizen/.test(host) && /ld: leaderHere\(game\)/.test(host));
  const guest = src('net/guest.js');
  assert.ok(/sim\.hostName = \(\) => hn/.test(guest) && /game\.leaderHere = o\.ld/.test(guest));
  const remote = { remote: {}, leaderHere: { sid: s.id, scope: 'town', title: 'Mayor', address: 'Mayor' }, sim };
  assert.equal(leaderOf(remote, s).title, 'Mayor');
  assert.equal(leaderOf(remote, game.world.ow.settlements.find((q) => q !== s)), null);
  // The status lines and the minimap's picture, each on its own; the
  // minimap read at whole squares.
  const ui = src('ui/ui.js');
  assert.ok(ui.includes("this.quiet('status line'") && ui.includes("this.quiet('minimap picture'"));
  assert.ok(ui.includes('const wx = Math.floor(p.x) + ox;'));
});

test('the minimap, drawn off a whole square, doesn\'t fail', async () => {
  const ctx = { createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }), putImageData() {}, drawImage() {}, fillRect() {}, clearRect() {} };
  globalThis.document ??= { createElement: () => ({ getContext: () => ctx, width: 0, height: 0 }) };
  const { UI } = await import('../src/ui/ui.js');
  const game = makeGame(12345);
  const ui = new UI(null);
  game.player.x += 0.37;
  game.player.z += 0.5;
  assert.doesNotThrow(() => ui.renderMinimap(game));
});

test('the head of a town offers another player citizenship: theirs to accept or decline', () => {
  const { game, sim, s, L, o, as, step, shown } = two();
  assert.deepEqual(o.others().map((q) => q.pid), ['g']);
  // Charged here: pardoned first.
  as(() => {
    sim.justice.pending.set(s.id, [{ type: 'theft', sev: 'minor' }]);
    game.wanted.set(s.id, 5);
  });
  const no = o.offerCitizen(L, 'g');
  assert.ok(!no.ok && /pardon them first/.test(no.why));
  assert.ok(o.pardon(L, 'g').ok);
  // Offered: on their HUD, a window for them.
  assert.ok(o.offerCitizen(L, 'g').ok);
  assert.ok(!o.offerCitizen(L, 'g').ok, 'once');
  assert.ok(o.standing('g', s.id).offered);
  assert.ok(as(() => o.hudLines()).some((l) => /CITIZENSHIP OFFERED/.test(l.text)));
  step(2);
  assert.ok(shown.some(([k]) => k === 'citizenship'));
  // Declined: the head is told; the offer's gone.
  assert.ok(as(() => o.answerCitizen(s.id, false)).declined);
  assert.ok(!as(() => o.citOfferFor()));
  assert.ok(!as(() => sim.citizen));
  // Offered again and accepted: a citizen, lodging with a family.
  assert.ok(o.offerCitizen(L, 'g').ok);
  assert.ok(as(() => o.answerCitizen(s.id, true)).ok);
  const cz = as(() => sim.citizen);
  assert.equal(cz.sid, s.id);
  assert.ok(o.standing('g', s.id).citizen);
  // (The host's own citizenship untouched.)
  assert.equal(sim.citizen.sid, s.id);
  assert.ok(L.econ.ledger.some((q) => /Guesty became a citizen/.test(q.text)));
  // Only the town's head can.
  assert.ok(!as(() => o.offerCitizen(L, 'h')).ok);
  // Kept with the world.
  o.offerCitizen(L, 'g');
  assert.ok(Array.isArray(JSON.parse(JSON.stringify(o.serialize())).citOffers));
});

test('a pardon: the charges dropped, the watch called off, the exile lifted, the record wiped, the cell opened', () => {
  const { game, sim, s, L, o, as, step, shown } = two();
  assert.ok(!o.pardon(L, 'g').ok, 'nothing to pardon');
  as(() => {
    sim.justice.pending.set(s.id, [{ type: 'assault', sev: 'moderate', witnesses: [], day: game.day, minute: 0 }]);
    game.wanted.set(s.id, 9);
    sim.justice.exiled.add(s.id);
    sim.justice.recordOf(s.id).convictions = 2;
    sim.justice.jail = { sid: s.id, phase: 'serving', t: 0, how: 'surrender', party: [], lines: [], li: 0, lt: 0, release: sim.abs + 600, cellless: true };
  });
  const st = o.standing('g', s.id);
  assert.ok(st.jailed && st.exiled && st.wanted && st.charges && st.record);
  const r = o.pardon(L, 'g');
  assert.ok(r.ok);
  for (const k of ['charges', 'wanted', 'exile', 'record', 'cell']) assert.ok(r.what.includes(k), k);
  const after = o.standing('g', s.id);
  assert.ok(!after.jailed && !after.exiled && !after.wanted && !after.charges && !after.record);
  assert.equal(as(() => sim.justice.jail), null);
  step(2);
  assert.ok(shown.some(([k, d]) => k === 'pardoned' && d.what.includes('exile')));
  assert.ok(L.econ.ledger.some((q) => /pardoned Guesty/.test(q.text)));
  assert.ok(!as(() => o.pardon(L, 'h')).ok, 'only the head');
  assert.ok(!o.pardon(L, o.pid()).ok, 'not yourself');
});

test('a realm\'s ruler pardons throughout the realm', () => {
  const { sim, s, L, o, as } = two();
  const towns = sim.realms.members(s.civ);
  assert.ok(towns.length >= 2);
  as(() => {
    for (const t of towns) sim.justice.exiled.add(t.id);
  });
  assert.equal(o.realmStanding('g', s.civ).exiled, towns.length);
  sim.crown.crownPlayer(s.civ, o.pid(), 'Hosty', 'election', sim.game.day, {});
  const r = o.pardon(L, 'g', true);
  assert.ok(r.ok);
  assert.equal(r.towns, towns.length);
  assert.equal(o.realmStanding('g', s.civ).towns.length, 0);
});

test('newcomers made citizens: a family of nomads, an adventurer, a travelling merchant, one of another town\'s own', () => {
  const { game, sim, s, L, o, step } = two();
  game.teleportPlayer(L.plaza.cx, 6, L.plaza.cz + 2);
  step(20);
  const b = sim.nomads.arrive(L, game.day, { chance: () => true }) || sim.nomads.bands.find((q) => q.sid === s.id && !q.done);
  b.arrive = sim.abs - 10;
  const a = sim.adventurers.list[0];
  Object.assign(a, { state: 'stay', at: s.id, dest: s.id, leave: sim.abs + 600 });
  const other = game.world.ow.settlements.find((q) => q !== s && !q.deserted && game.world.layouts.get(q.id));
  const OL = game.world.layouts.get(other.id);
  const v1 = makeVisitor(other, new RNG(5), sim.abs - 30, {});
  Object.assign(v1, { leave: sim.abs + 600, traded: true, told: true });
  const r = OL.npcs.find((q) => q.age === 'adult' && q.job !== 'mayor' && !q.away);
  const v2 = { id: 'vt', from: other.id, fromName: other.name, fromIdx: r.idx, name: r.name, style: other.style, goods: {}, arrive: sim.abs - 20, leave: sim.abs + 600, coins: 12, traded: true, told: true };
  r.visit = v2;
  // (Folk on a day's trip from home aren't asked.)
  const v3 = { ...v2, id: 'vo', outing: 7 };
  sim.visits.set(s.id, [...(sim.visits.get(s.id) || []), v1, v2, v3]);
  step(10);
  const list = o.newcomers(L);
  const keys = list.map((q) => q.key);
  for (const k of [`n:${b.id}`, `a:${a.id}`, `v:${v1.id}`, 'v:vt']) assert.ok(keys.includes(k), k);
  assert.ok(!keys.includes('v:vo'));
  const n0 = L.npcs.length;
  // Face to face: a topic for the town's head.
  const ae = sim.adventurers.ents.get(a.id);
  if (ae) {
    assert.ok(topicsFor(ae, game).some((t) => t.id === 'naturalise'));
    assert.ok(respond(ae, game, 'naturalise').choices.some((c) => c.arg === 'yes'));
    assert.ok(respond(ae, game, 'naturalise', 'yes').close);
  } else assert.ok(o.welcome(L, `a:${a.id}`).ok);
  for (const k of [`n:${b.id}`, `v:${v1.id}`, 'v:vt']) assert.ok(o.welcome(L, k).ok, k);
  assert.equal(L.npcs.length, n0 + b.people.length + 3);
  const made = L.npcs.slice(n0);
  assert.ok(made.every((q) => q.naturalised && !q.visitor && !q.away && q.sid === s.id && q.id === `${s.id}:${q.idx}`));
  assert.ok(made.every((q) => q.schedule && q.work));
  assert.ok(!sim.adventurers.list.includes(a));
  assert.ok(b.done && b.stayed);
  assert.ok(r.migrated, 'gone from their old town');
  assert.equal(o.newcomers(L).length, 0);
  assert.ok(!o.welcome(L, 'v:vt').ok, 'once');
  // In the ledger, once each.
  const lines = L.econ.ledger.map((q) => q.text);
  assert.ok(lines.some((t) => t.includes(`made the ${b.family} family citizens`)));
  assert.ok(lines.some((t) => t.includes(`made ${a.name.first} ${a.name.last} citizen`)));
  // Only the head of the town can.
  const nb = sim.nomads.arrive(L, game.day + 1, { chance: () => true });
  if (nb) {
    nb.arrive = sim.abs - 1;
    o.unseat(L, 'stepped down', game.day);
    assert.ok(!o.welcome(L, `n:${nb.id}`).ok);
  }
  step(10);
});

test('the windows: the council\'s citizens and pardons, the crown\'s pardons, the offer and the pardon', () => {
  const { game, sim, s, L, o, as } = two();
  sim.crown.crownPlayer(s.civ, o.pid(), 'Hosty', 'election', game.day, {});
  as(() => game.wanted.set(s.id, 5));
  const a = sim.adventurers.list[0];
  Object.assign(a, { state: 'stay', at: s.id, dest: s.id, leave: sim.abs + 600 });
  const ui = { mouseCell: { x: 0, y: 0 }, time: 0, msg() {}, close() {}, open: (w) => w, audio: null, game };
  const w = new CouncilWindow(ui, s.id, 'people');
  let g = new Grid(w.w, w.h);
  w.draw(g, game);
  assert.ok(text(g).includes('Citizens and pardons'));
  w.pview = 'folk';
  g = new Grid(w.w, w.h);
  w.draw(g, game);
  const t = text(g);
  for (const k of ['Guesty', 'WANTED', 'Make a citizen', 'Pardon', 'Realm pardon', 'Newcomers in town', `${a.name.first} ${a.name.last}`]) assert.ok(t.includes(k), k);
  const c = new CrownWindow(ui, s.civ.id, 'court');
  c.view.court = 'pardons';
  g = new Grid(c.w, c.h);
  c.draw(g, game);
  assert.ok(text(g).includes('in trouble in'));
  o.pardon(L, 'g');
  o.offerCitizen(L, 'g');
  const banner = (k, d) => as(() => {
    const b = new BannerWindow(ui, k, d);
    const gb = new Grid(b.w, b.h);
    b.draw(gb, game);
    return text(gb);
  });
  const offer = banner('citizenship', { sid: s.id });
  assert.ok(offer.includes('CITIZENSHIP OFFERED') && offer.includes('Accept') && offer.includes('Decline'));
  assert.ok(banner('pardoned', { sid: s.id, by: 'Mayor Hosty', what: ['wanted'] }).includes('The watch is no longer after you.'));
  // N opens the offer.
  assert.ok(src('ui/ui.js').includes("new BannerWindow(this, 'citizenship', { sid: cit.sid })"));
});

test('version 1.40.0', () => {
  assert.ok(compareVersions('1.40.0', GAME_VERSION) <= 0);
  assert.ok(stepsFor('1.39.0').some((q) => q.to === '1.40.0'));
});
