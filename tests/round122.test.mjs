// Round 122: ruling a realm. The five forms of government (and the names
// and titles they give), the ways to the throne (breaking away, an heir,
// the council's choice, seizing it), the crown's sittings and decrees, the
// towns' loyalty, being overruled (a council's no confidence, a
// pretender, the high priest's veto), the realm and its towns' heads when
// others play (petitions, defiance, votes, lordships, governorships,
// alliances between player rulers), the crown window and the decluttered
// council window.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { makeGame, stubInput } from './helpers.mjs';
import { RNG } from '../src/util/rng.js';
import { REALM_FORMS, FORM_IDS, renameFor, formFromLegacy } from '../src/sim/realmforms.js';
import { CHARTERS, headTitle } from '../src/sim/charters.js';
import { formOf, govOf, rulerTitle, shortTitle, authority } from '../src/sim/realms.js';
import { Grid } from '../src/ui/ascii.js';
import { CouncilWindow } from '../src/ui/council.js';
import { CrownWindow } from '../src/ui/crown.js';
import { BannerWindow, VoteWindow } from '../src/ui/hustings.js';
import { runCommand } from '../src/game/commands.js';
import { GAME_VERSION, compareVersions } from '../src/version.js';
import { stepsFor } from '../src/game/migrate.js';

const src = (f) => fs.readFileSync(new URL(`../src/${f}`, import.meta.url), 'utf8');
const input = stubInput();

function world(seed = 12345) {
  const game = makeGame(seed);
  for (let i = 0; i < 6; i++) game.update(0.1, input);
  return { game, sim: game.sim, o: game.sim.office, crown: game.sim.crown };
}

// A realm of some towns, all laid out, and its capital.
function realmOf(W, min = 3) {
  const { game, sim } = W;
  const civ = game.world.ow.civs.find((c) => c && sim.realms.members(c).length >= min);
  for (const s of sim.realms.members(civ)) sim.layoutOf(s.id);
  return civ;
}

// Ruling it at once (as the console's "crown" does).
function ruling(form = 'monarchy', seed = 12345) {
  const W = world(seed);
  W.civ = realmOf(W);
  W.C = W.crown.crownPlayer(W.civ, W.o.pid(), W.game.playerName, 'succession', W.game.day, { form });
  W.R = W.sim.realms.realm(W.civ);
  return W;
}

// A second player, standing in: online, by the office's own lights.
function guest(o) {
  o.online = (pid) => pid === 'g' || pid === o.pid();
}
function as(o, pid, fn) {
  const real = o.pid;
  o.pid = () => pid;
  try {
    return fn();
  } finally {
    o.pid = real;
  }
}

test('five forms of government, each with its rules; a realm\'s name and its ruler\'s title follow its form', () => {
  assert.deepEqual(FORM_IDS, ['monarchy', 'republic', 'elder', 'theocracy', 'league']);
  for (const id of FORM_IDS) {
    const F = REALM_FORMS[id];
    assert.ok(F.name && F.glyph && F.title && F.rules.length >= 3 && F.stipend > 0, id);
    assert.ok(['decree', 'council', 'moot', 'temple', 'league'].includes(F.vote), id);
  }
  assert.deepEqual(REALM_FORMS.monarchy.styles, ['King', 'Queen', 'Monarch']);
  assert.equal(formFromLegacy('council'), 'republic');
  assert.equal(formFromLegacy('elder'), 'elder');
  assert.equal(formFromLegacy('monarch'), 'monarchy');
  const lf = (n) => formOf({ name: n });
  assert.equal(renameFor('Republic of Tansyley', 'monarchy', 'Queen', lf), 'Kingdom of Tansyley');
  assert.equal(renameFor('Kingdom of Ash', 'monarchy', 'Empress', lf), 'Empire of Ash');
  assert.equal(renameFor('Empire of Ash', 'monarchy', 'King', lf), 'Kingdom of Ash');
  assert.equal(renameFor('The Ash Jarldom', 'monarchy', 'King', lf), 'The Ash Jarldom', 'a jarldom is a monarchy already');
  assert.equal(renameFor('Sultanate of Qar', 'league', null, lf), 'League of Qar');
  assert.equal(renameFor('Kingdom of Ash', 'theocracy', null, lf), 'Holy Realm of Ash');
  // A realm the world began with: its government from its name.
  const civ = { name: 'Republic of Foo' };
  assert.equal(govOf(civ), 'republic');
  assert.equal(rulerTitle(civ), 'Speaker of the Council');
  // A lordship, among the town charters: its holder chooses their style.
  assert.equal(CHARTERS.lordship.vote, 'decree');
  assert.equal(headTitle('lordship', { type: 'town' }, 'Lady'), 'Lady');
  assert.equal(headTitle('lordship', { type: 'town' }, 'Queen'), 'Lord', 'not a style a lordship has');
});

test('breaking away makes you head of a free republic; reformed into a monarchy, you are styled King or Queen and decree', () => {
  const W = world();
  const { game, sim, o, crown } = W;
  const civ0 = realmOf(W);
  const s = sim.realms.members(civ0).find((q) => !sim.realms.isCapital(q));
  const L = sim.layoutOf(s.id);
  const T = o.install(L, o.pid(), 'Anwen', 'election', game.day);
  T.lastOverall = 80;
  o.apply(L, T, { act: 'secede' }, game.day);
  const civ = L.settlement.civ;
  assert.notEqual(civ, civ0);
  assert.ok(crown.isRuler(civ));
  assert.equal(govOf(civ), 'republic');
  assert.equal(shortTitle(civ), 'Speaker');
  assert.ok(o.shows.some((q) => q.kind === 'crowned'));
  // A republic's council votes on what you put to it.
  const p = crown.propose(civ, 'decree', 'taxFloor', 0.06);
  assert.ok(p.ok && p.item && !p.item.done, 'on the agenda');
  const C = crown.of(civ);
  crown.reform(civ, C, 'monarchy', game.day);
  assert.equal(govOf(civ), 'monarchy');
  assert.ok(crown.setStyle(civ, 'Queen'));
  assert.equal(shortTitle(civ), 'Queen');
  assert.equal(authority(civ), 'the Crown');
  assert.ok(sim.realms.rulerName(civ).startsWith('Queen'));
  assert.ok(!crown.setStyle(civ, 'Pharaoh'), 'not a style a monarchy has');
  // A monarch's word is law, there and then.
  const r = crown.propose(civ, 'decree', 'share', 0.08);
  assert.equal(r.state, 'decreed');
  assert.equal(sim.realms.realm(civ).share, 0.08);
  // Giving it up: the realm is its own again.
  assert.ok(crown.abdicate(civ));
  assert.ok(!crown.ruled(civ));
});

test('the crown sits each morning: the privy council\'s advice, towns in need; what you leave, the chancellor does by your orders', () => {
  const { game, sim, crown, civ, C } = ruling('monarchy');
  const capL = crown.capitalL(civ);
  for (const L of sim.realms.memberLayouts(civ)) if (L !== capL) L.econ.treasury = 1;
  capL.econ.treasury = 2000;
  C.agenda = [];
  crown.session(civ, capL, game.day + 1, new RNG(1));
  assert.ok(C.agenda.length >= 1, 'matters before the crown');
  const aid = C.agenda.find((q) => q.kind === 'aid');
  assert.ok(aid, 'a town asks for help');
  // Left undecided, with the order to help: the chancellor helps.
  C.orders.aid = 'auto';
  const before = sim.layoutOf(aid.by).econ.treasury;
  crown.lapse(civ, C, aid, game.day + 1);
  assert.ok(sim.layoutOf(aid.by).econ.treasury > before);
  assert.ok(C.minutes.some((m) => /chancellor/.test(m.what)));
  // (The old ruler is the chancellor.)
  const ch = sim.realms.ruler(civ);
  assert.ok(!ch || ch.chancellor === civ.id);
  assert.ok(crown.hudLines().some((l) => /N/.test(l.text)));
});

test('the towns\' loyalty: heavier tribute and a least tax cost it, aid and a lighter share win it', () => {
  const { crown, civ } = ruling('monarchy');
  const now = crown.approvals(civ).overall;
  assert.ok(crown.approvals(civ, { share: 0.16 }).overall < now);
  assert.ok(crown.approvals(civ, { taxFloor: 0.1 }).overall < now);
  assert.ok(crown.approvals(civ, { share: 0.06 }).overall >= now);
  const pv = crown.preview(civ, { share: 0.16 });
  assert.ok(pv.overall < 0 && Object.values(pv.by).every((v) => v <= 0));
});

test('overruled: a republic\'s council votes no confidence; a holy realm\'s high priest vetoes; a monarch faces a pretender', () => {
  // A republic.
  let W = ruling('republic');
  W.C.lowDays = 5;
  W.crown.confidence = () => ({ state: 'defeated', aye: 1, nay: 4, ballots: [] });
  W.crown.overrule(W.civ, W.C, W.game.day, new RNG(1));
  assert.ok(!W.crown.ruled(W.civ), 'voted out');
  // A holy realm: no war that isn't holy, no rise in tribute.
  W = ruling('theocracy');
  const other = W.sim.realms.civs.find((c) => c !== W.civ && W.sim.realms.members(c).length);
  const p = W.crown.propose(W.civ, 'decree', 'share', Math.min(0.16, W.R.share + 0.04));
  assert.equal(p.state, 'vetoed');
  const lower = W.crown.propose(W.civ, 'decree', 'share', 0.06);
  assert.equal(lower.state, 'decreed');
  void other;
  // A monarch the realm has turned against: a pretender.
  W = ruling('monarchy');
  W.C.lowDays = 5;
  const spec = W.crown.crisisFor(W.civ, W.C, W.game.day);
  assert.ok(spec && spec.crisis === 'pretender' && /claims the throne/.test(spec.title));
  assert.ok(/^[A-Z]/.test(spec.title));
});

test('an heir who plays comes to the throne when you abdicate', () => {
  const { crown, civ, C, o } = ruling('monarchy');
  assert.ok(crown.nameHeir(civ, { pid: 'g', name: 'Guesty' }));
  assert.equal(C.heir.pid, 'g');
  crown.abdicate(civ);
  assert.ok(crown.isRuler(civ, 'g'), 'the heir rules');
  assert.equal(crown.R(civ).headName, 'Guesty');
  void o;
});

test('seizing the throne: only whoever governs the capital, with half its watch behind them', () => {
  const W = world();
  const civ = realmOf(W);
  assert.ok(!W.crown.canUsurp(civ).ok);
  const capS = W.sim.realms.capitalOf(civ);
  const L = W.sim.layoutOf(capS.id);
  W.o.install(L, W.o.pid(), 'Anwen', 'election', W.game.day);
  W.o.plotStrength = () => ({ share: 0.6, n: 3, of: 5 });
  assert.ok(W.crown.usurp(civ).ok);
  assert.ok(W.crown.isRuler(civ));
  assert.equal(govOf(civ), 'monarchy');
});

test('with others playing: a town\'s head petitions the ruler, defies a decree, votes in the moot; raised to a lordship, offered a town', () => {
  const { game, sim, o, crown, civ, C } = ruling('elder');
  guest(o);
  const towns = sim.realms.memberLayouts(civ).filter((L) => !sim.realms.isCapital(L.settlement));
  const L = towns[0];
  const T = o.install(L, 'g', 'Guesty', 'election', game.day);
  // A petition, from the guest's town to the throne.
  const pr = as(o, 'g', () => o.petition(L, 'aid'));
  assert.ok(pr.ok && pr.pending, JSON.stringify(pr));
  const it = C.agenda.find((q) => q.kind === 'petition' && q.by === L.settlement.id);
  assert.ok(it, 'before the throne');
  // Defiance of the crown's decree.
  assert.ok(crown.defiance(L, 'taxFloor', game.day));
  const defy = C.agenda.find((q) => q.kind === 'defy');
  assert.ok(defy && defy.opts.some((x) => /Depose/.test(x.label)));
  // The moot votes: the guest's voice waits for them.
  const p = crown.propose(civ, 'decree', 'armsBan', !sim.realms.realm(civ).decrees.armsBan);
  const r = crown.decide(civ, p.item.id, 0);
  assert.equal(r.state, 'waiting');
  assert.ok(o.shows.some((q) => q.kind === 'vote' && q.pid === 'g' && q.data.civ === civ.id));
  assert.ok(as(o, 'g', () => crown.cast(civ.id, p.item.id, true)));
  assert.notEqual(p.item.state, 'voting');
  // A lordship needs a monarch.
  assert.ok(!crown.grantLordship(civ, L.settlement.id).ok);
  crown.reform(civ, C, 'monarchy', game.day);
  assert.ok(crown.grantLordship(civ, L.settlement.id).ok);
  assert.equal(T.charter, 'lordship');
  assert.ok(o.shows.some((q) => q.kind === 'style' && q.pid === 'g'));
  assert.ok(as(o, 'g', () => o.setStyle(L, 'Lady')));
  assert.equal(o.title(L, T), 'Lady');
  // A town no player governs, offered to a fellow player.
  o.unseat(L, 'stepped down', game.day);
  const r2 = crown.offerGovernor(civ, L.settlement.id, 'g');
  assert.ok(r2.ok, r2.why);
  const off = o.offerFor('g');
  assert.ok(off && off.how === 'governor');
  const ans = as(o, 'g', () => o.answer(true, 'g'));
  assert.ok(ans.ok);
  assert.equal(o.of(L.settlement.id).holder.pid, 'g');
});

test('two players\' realms: envoys from one bring the other an offer of alliance to decide', () => {
  const { game, sim, crown, civ, o } = ruling('monarchy');
  guest(o);
  const other = sim.realms.civs.find((c) => c !== civ && sim.realms.members(c).length >= 2 && !sim.politics.bound(civ, c));
  for (const s of sim.realms.members(other)) sim.layoutOf(s.id);
  crown.crownPlayer(other, 'g', 'Guesty', 'succession', game.day, { form: 'monarchy' });
  const p = crown.propose(civ, 'ally', other.id);
  assert.ok(p.ok);
  const OC = crown.of(other);
  assert.ok(OC.agenda.some((q) => q.kind === 'ally'), 'the other ruler decides it');
});

test('kept: the crown, a realm\'s new form and name, go in the save and come back', () => {
  const { sim, crown, civ, C, game } = ruling('monarchy');
  crown.reform(civ, C, 'league', game.day);
  C.orders.aid = 'auto';
  const name = civ.name;
  const d = JSON.parse(JSON.stringify(sim.serialize()));
  const g2 = makeGame(12345);
  g2.sim.realms.load(d.realms);
  g2.sim.crown.load(d.crown);
  const civ2 = g2.world.ow.civs[civ.id];
  assert.equal(civ2.name, name);
  assert.equal(govOf(civ2), 'league');
  assert.equal(g2.sim.crown.of(civ2).orders.aid, 'auto');
});

test('the crown window: five pages and their views, the throne room, the banners and a vote of the realm', () => {
  const { sim, crown, civ, game, o } = ruling('monarchy');
  const ui = { mouseCell: { x: 0, y: 0 }, time: 0, msg() {}, close() {}, open: (w) => w, audio: null, game };
  const w = new CrownWindow(ui, civ.id);
  const draw = () => {
    w.hits = [];
    const g = new Grid(w.w, w.h);
    w.draw(g, game);
    return g.ch.join('');
  };
  for (const tab of ['matters', 'decrees', 'towns', 'court', 'realms']) {
    w.tab = tab;
    assert.ok(draw().includes(civ.name.replace(/^The /, '').toUpperCase()), tab);
  }
  w.tab = 'court';
  for (const v of ['form', 'heir', 'orders', 'chron']) {
    w.view.court = v;
    draw();
  }
  // A matter decided: the decree sealed.
  w.tab = 'matters';
  const p = crown.propose(civ, 'decree', 'watch', 'heavy');
  assert.equal(p.state, 'decreed');
  w.reveal = { id: p.item.id, vote: p.vote, t: 9, label: 'Decree it', it: p.item };
  assert.ok(draw().includes('SO DECREED'));
  // The banners.
  for (const k of ['crowned', 'realmform']) {
    const b = new BannerWindow(ui, k, { sid: crown.R(civ).capital, civ: civ.id, how: 'succession', form: 'monarchy' });
    const g = new Grid(b.w, b.h);
    b.draw(g, game);
    assert.ok(g.ch.join('').length);
  }
  const b = new BannerWindow(ui, 'style', { sid: crown.R(civ).capital, styles: ['Lord', 'Lady', 'Liege'] });
  const g = new Grid(b.w, b.h);
  b.draw(g, game);
  assert.ok(g.ch.join('').includes('Lady'));
  const v = new VoteWindow(ui, { civ: civ.id, id: -1 });
  v.draw(new Grid(v.w, v.h), game);
  // N: the crown, for a ruler.
  assert.ok(src('ui/ui.js').includes('openCrown(game, K.civ)'));
  void sim;
  void o;
});

test('the council window, decluttered: six pages; the realm and ambitions are views of the charter\'s', () => {
  const W = world();
  const s = W.game.world.ow.settlements.find((q) => q.type === 'town' && q.civ);
  const L = W.sim.layoutOf(s.id);
  W.o.install(L, W.o.pid(), 'Anwen', 'election', W.game.day);
  const ui = { mouseCell: { x: 0, y: 0 }, time: 0, msg() {}, close() {}, open: (w) => w, audio: null, game: W.game };
  const w = new CouncilWindow(ui, s.id, 'realm');
  const g = new Grid(w.w, w.h);
  w.draw(g, W.game);
  assert.equal(w.tab, 'charter');
  assert.equal(w.view, 'realm');
  // (Round 125: and a seventh, the record.)
  assert.ok(g.ch.join('').includes('1-7: pages'));
  assert.ok(!g.ch.join('').includes('8·'));
});

test('the console: "crown" takes a realm\'s throne, sits, brings on a crisis, and abdicates', () => {
  const W = world();
  const civ = realmOf(W);
  const out = runCommand(W.game, `crown ${civ.name} theocracy`).join(' ');
  assert.ok(/rule/.test(out), out);
  assert.equal(govOf(civ), 'theocracy');
  assert.ok(/sits/.test(runCommand(W.game, 'crown sit').join(' ')));
  assert.ok(/Crisis/.test(runCommand(W.game, 'crown crisis').join(' ')));
  runCommand(W.game, 'crown leave');
  assert.ok(!W.crown.ruled(civ));
});

test('version 1.22.0, and the step to it', () => {
  assert.ok(compareVersions(GAME_VERSION, '1.22.0') >= 0);
  const steps = stepsFor('1.21.0').filter((s) => s.to === '1.22.0');
  assert.equal(steps.length, 1);
  const log = [];
  const d = { sim: {} };
  steps[0].data(d, log);
  assert.deepEqual(d.sim.crown, { realms: {}, heirs: {} });
  assert.ok(/realm/i.test(log[0]) && /crown/i.test(log[0]));
});
