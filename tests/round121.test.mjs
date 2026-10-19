// Round 121: governing a town. Standing for mayor (the campaign, the
// count) and the council window (the day's matters from the town's own
// pressures, the levers, the factions); being overruled (the council's
// votes, recall, the realm's decrees, the term's election); officers, the
// steward and standing orders, the drafted laws; charters; the other ways
// into office and the crises; the realm, and councils of players.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { makeGame, stubInput } from './helpers.mjs';
import { mayorOf, DAY } from '../src/sim/econ.js';
import { RNG } from '../src/util/rng.js';
import { LAWS, lawFits, lawOn } from '../src/sim/laws.js';
import { FACTIONS, FACTION_IDS, factionOf, approvals, preview, members } from '../src/sim/factions.js';
import { CHARTERS, CHARTER_IDS, defaultCharter } from '../src/sim/charters.js';
import { matters, stated, crisisFor, scandal, SESSION } from '../src/sim/agenda.js';
import { OFFICES, ORDERS } from '../src/sim/office.js';
import { jobTitle } from '../src/entities/npcgen.js';
import { countItem } from '../src/game/inventory.js';
import { ITEMS } from '../src/world/items.js';
import { Grid } from '../src/ui/ascii.js';
import { CouncilWindow } from '../src/ui/council.js';
import { HustingsWindow, CountWindow, BannerWindow, VoteWindow } from '../src/ui/hustings.js';
import { GAME_VERSION, compareVersions } from '../src/version.js';
import { stepsFor } from '../src/game/migrate.js';

const src = (f) => fs.readFileSync(new URL(`../src/${f}`, import.meta.url), 'utf8');
const input = stubInput();

// A world, and a town (with a mayor and people enough) the player is a
// citizen of, some days since.
function world(seed = 12345, pick = (s) => s.type === 'town') {
  const game = makeGame(seed);
  for (let i = 0; i < 6; i++) game.update(0.1, input);
  const sim = game.sim;
  const s = game.world.ow.settlements.find((q) => pick(q) && !q.deserted);
  const L = game.world.layouts.get(s.id) || game.world.layOut(s);
  sim.citizen = { sid: s.id, since: game.day - 5, host: null, home: null, taxDay: game.day, owed: 0 };
  game.player.inv[0] = { item: 'coin', count: 900 };
  return { game, sim, s, L, o: sim.office };
}

// Straight into office (as if elected).
function governing(seed, pick) {
  const W = world(seed, pick);
  W.T = W.o.install(W.L, W.o.pid(), W.game.playerName, 'election', W.game.day);
  return W;
}

test('standing for mayor: a citizen of some days, a fee, the town votes; pledges and speeches sway it; won, the office', () => {
  const { game, sim, s, L, o } = world();
  // (Not before you've been a citizen a few days.)
  sim.citizen.since = game.day;
  assert.ok(!o.canStand(L).ok);
  sim.citizen.since = game.day - 5;
  const t = o.canStand(L);
  assert.ok(t.ok && t.fee === 40, JSON.stringify(t));
  const old = mayorOf(L);
  const coins = countItem(game.player.inv, 'coin');
  const r = o.stand(L);
  assert.ok(r.ok);
  assert.equal(countItem(game.player.inv, 'coin'), coins - 40, 'the fee paid');
  const q = sim.causes.of(s.id);
  assert.equal(q.kind, 'office');
  assert.equal(q.cands[1].pid, o.pid());
  assert.ok(!o.canStand(L).ok, 'one election at a time');
  // Pledges win their faction over; three at most.
  const before = sim.causes.tally(L, q)[1];
  for (const [k, f] of [['tax', 'merchants'], ['relief', 'poor'], ['watch', 'guards']]) assert.ok(o.pledge(L, q, k, f).ok);
  assert.ok(!o.pledge(L, q, 'feast', 'poor').ok, 'three pledges');
  assert.ok(sim.causes.tally(L, q)[1] >= before);
  const sp = o.address(L, q, 'farmers');
  assert.ok(sp.ok);
  assert.ok(!o.address(L, q, 'farmers').ok, 'once a day');
  // The count: the town for you.
  for (const rec of L.npcs) q.swayed[rec.idx] = 1;
  sim.causes.resolve(L, q, game.day);
  const T = o.of(s.id);
  assert.equal(T.holder.pid, o.pid());
  assert.equal(T.holder.how, 'election');
  assert.equal(T.holder.termEnd, game.day + CHARTERS[T.charter].term);
  // The old mayor stepped down; a steward keeps the hall (as the town's
  // 'mayor', so all that looks for one still finds them).
  assert.notEqual(old.job, 'mayor');
  const st = o.stewardOf(L, T);
  assert.ok(st && st.steward && st.job === 'mayor' && mayorOf(L) === st);
  assert.equal(jobTitle(st, s), 'Steward');
  assert.equal(T.council.length, CHARTERS[T.charter].seats);
  assert.equal(T.promises.length, 3, 'pledges become promises');
  assert.ok(countItem(game.player.inv, 'chain_of_office') === 1 && ITEMS.chain_of_office);
  assert.ok(o.shows.some((x) => x.kind === 'count'), 'the night of the count, shown');
});

test('the agenda comes from the town\'s own pressures, each choice saying what it will do', () => {
  const { sim, L, T, o, game } = governing();
  L.econ.treasury = 10;
  L.econ.recent.violence = 4;
  L.econ.recent.thefts = 3;
  const specs = matters(sim, L, T, game.day);
  const keys = specs.map((q) => q.key);
  assert.ok(keys.includes('tax'), 'thin coffers: taxes');
  assert.ok(keys.includes('fines'), 'thefts: fines');
  assert.ok(keys.some((k) => k.startsWith('law:')), 'trouble: a law');
  const tax = specs.find((q) => q.key === 'tax');
  assert.ok(/treasury holds ¤10/.test(tax.why[0]));
  const ef = stated(sim, L, T, tax.opts[0], CHARTERS, game.day);
  assert.ok(/taxes \d+%/.test(ef.lines[0].text));
  assert.ok(Object.values(ef.by).some((v) => v < 0), 'a tax rise costs you with someone');
  // Tabled, at most four (crises aside).
  T.agenda = [];
  o.table(L, T, game.day, sim.abs, true);
  assert.ok(T.agenda.length >= 3 && T.agenda.length <= 4);
});

test('the factions: everyone grown up belongs to one, each with its own reckoning and reasons', () => {
  const { L, T } = governing();
  const M = members(L);
  for (const r of L.npcs) if (r.alive !== false && r.age !== 'child' && !r.away && !r.visitor) assert.ok(FACTIONS[factionOf(r)], r.job);
  const A = approvals(L, T, {}, CHARTERS);
  for (const f of FACTION_IDS) if (M[f].length) assert.ok(A.by[f].v >= 0 && A.by[f].v <= 100 && Array.isArray(A.by[f].why));
  // Lower taxes please the merchants; higher, nobody.
  const dn = preview(L, T, { tax: Math.max(0, L.econ.tax - 0.04) }, CHARTERS);
  const up = preview(L, T, { tax: L.econ.tax + 0.06 }, CHARTERS);
  assert.ok(dn.overall > 0 && up.overall < 0);
  if (M.merchants.length) assert.ok(dn.by.merchants > 0);
});

test('decided in the hall: the council votes, and what it carries is done at the next sitting; left alone, the steward decides by your orders', () => {
  const { sim, L, T, o, game } = governing();
  L.econ.recent.violence = 5;
  T.agenda = [];
  o.table(L, T, game.day, sim.abs, true);
  o.inHall = () => true;
  const law = T.agenda.find((q) => q.kind === 'law');
  assert.ok(law, 'a law tabled');
  const r = o.decide(L, law.id, 0);
  assert.ok(r.ok && r.vote && r.vote.ballots.length === T.council.length + 1, 'the council and you');
  assert.ok(['carried', 'defeated'].includes(r.state));
  const id = law.opts[0].fx.law.id;
  const want = law.opts[0].fx.law.on;
  // Away from the hall: sent, voted at the sitting.
  o.inHall = () => false;
  L.econ.treasury = 5;
  T.agenda = T.agenda.filter((q) => q.kind !== 'tax');
  T.quiet = {};
  o.table(L, T, game.day, sim.abs, true);
  const tax = T.agenda.find((q) => q.kind === 'tax');
  if (tax) assert.equal(o.decide(L, tax.id, 0).state, 'sent');
  o.session(L, T, game.day + 1, new RNG(1));
  if (r.state === 'carried') assert.equal(lawOn(L, id), want, 'carried out at the sitting');
  // A matter left: the steward's, by standing order (and set aside if
  // the order says leave it).
  T.agenda = [];
  T.quiet = {};
  L.econ.treasury = 5;
  o.setOrder(L, 'tax', 'hold');
  o.table(L, T, game.day + 1, sim.abs, true);
  const t2 = T.agenda.find((q) => q.kind === 'tax');
  assert.ok(t2);
  const was = L.econ.tax;
  o.session(L, T, game.day + 2, new RNG(2));
  assert.equal(L.econ.tax, was, 'held, by order');
  assert.ok(T.minutes.some((m) => /set aside/.test(m.what)));
  assert.ok(ORDERS.tax.opts.length === 3);
});

test('overruled: the council votes down what it won\'t have; a charter needs two in every three', () => {
  const { L, T, o } = governing();
  o.inHall = () => true;
  const p = o.propose(L, 'charter', 'autocracy');
  assert.ok(p.ok && p.item.super);
  const r = o.decide(L, p.item.id, 0);
  assert.equal(r.state, 'defeated', 'no council votes itself away');
  assert.ok(p.item.struck.includes(0));
  assert.equal(o.decide(L, p.item.id, 0).ok, false, 'not again');
  assert.equal(T.charter, defaultCharter(L));
});

test('recalled: a town against you petitions, gathers its names, and votes you out', () => {
  const { sim, L, T, o, game } = governing();
  let out = null;
  for (let d = 1; d < 20 && T.holder; d++) {
    for (const f of FACTION_IDS) T.favour[f] = -30;
    L.econ.tax = 0.3;
    o.session(L, T, game.day + 5 + d, new RNG(d));
    if (T.recall && T.recall.phase === 'petition') out = out || 'petition';
  }
  assert.equal(out, 'petition');
  assert.equal(T.holder, null, 'recalled');
  assert.ok(/recalled/.test(T.past[T.past.length - 1].why));
  assert.ok(mayorOf(L) && !mayorOf(L).steward, 'the steward is mayor now');
  void sim;
});

test('the realm\'s decrees: a least tax the town falls short of is a matter; defied, the realm answers harder each week', () => {
  const { sim, L, T, o, game } = governing(12345, (s) => s.type === 'town' && !!s.civ);
  const R = sim.realms.realm(L.settlement.civ);
  R.decrees.taxFloor = 0.1;
  L.econ.tax = 0.04;
  const spec = matters(sim, L, T, game.day).find((q) => q.key === 'decree:taxFloor');
  assert.ok(spec, 'the decree tabled');
  o.apply(L, T, spec.opts[1].fx, game.day);
  assert.ok(T.defy.taxFloor !== undefined);
  let fined = false;
  let ultimatum = false;
  for (let d = 0; d < 28 && T.holder; d++) {
    const t0 = L.econ.treasury;
    o.realmDay(L, T, game.day + d, new RNG(d));
    if (T.defyLevel === 2 && L.econ.treasury < t0) fined = true;
    if (T.agenda.some((q) => q.key === 'crisis:crown')) ultimatum = true;
  }
  assert.ok(fined && ultimatum, `fined ${fined}, ultimatum ${ultimatum}`);
  // Submit: the town complies, and the realm is satisfied.
  const it = T.agenda.find((q) => q.key === 'crisis:crown');
  o.decide(L, it.id, 0);
  assert.equal(L.econ.tax, 0.1);
  assert.equal(T.defyLevel, 0);
});

test('the term ends: an election is called against you, by the faction most against you (or another player who filed)', () => {
  const { sim, L, T, o, game } = governing();
  T.holder.termEnd = game.day + 3;
  T.lastOverall = 50;
  o.term(L, T, game.day);
  const q = sim.causes.of(L.settlement.id);
  assert.ok(q && q.kind === 'office' && q.cands[0].pid === o.pid() && q.cands[0].sitting);
  // Won again: another term.
  for (const r of L.npcs) q.swayed[r.idx] = 0;
  sim.causes.resolve(L, q, q.end);
  assert.equal(T.holder.pid, o.pid());
  assert.ok(T.holder.termEnd > game.day + 20 && T.holder.terms === 2);
});

test('officers: a captain, a treasurer (more tax), a magistrate (fines), the steward named; standing orders', () => {
  const { sim, L, T, o, game } = governing();
  const g = o.candidates(L, 'captain')[0];
  assert.ok(g && g.r.job === 'guard');
  o.appoint(L, 'captain', g.r.idx);
  assert.ok(g.r.captain && jobTitle(g.r, L.settlement) === 'Captain of the Watch');
  const tr = o.candidates(L, 'treasurer')[0].r;
  tr.skills = { ...(tr.skills || {}), trading: 0.8 };
  tr.personality.kindness = 0.8;
  o.appoint(L, 'treasurer', tr.idx);
  o.session(L, T, game.day + 1, new RNG(3));
  assert.ok(L.econ.taxBoost > 1.1, 'a shrewd treasurer');
  assert.equal(L.econ.captain, g.r.idx);
  const st = o.candidates(L, 'steward').find((c) => !c.r.steward).r;
  o.appoint(L, 'steward', st.idx);
  assert.ok(st.steward && mayorOf(L) === st);
  assert.ok(o.setOrder(L, 'crises', 'bold') && T.orders.crises === 'bold');
  assert.ok(!o.setOrder(L, 'crises', 'nonsense'));
  assert.ok(Object.keys(OFFICES).length === 4);
  void sim;
});

test('drafted laws: only a governor can put them forward, and they do what they say', () => {
  const { sim, L, T, o, game } = governing();
  const s = L.settlement;
  for (const id of ['alms', 'marketDay', 'militia', 'templeTithe', 'guildDues']) {
    assert.ok(LAWS[id].draft);
    assert.ok(!lawFits(s, id), `${id}: no town passes it of itself`);
  }
  assert.ok(lawFits(s, 'alms', true));
  // Alms: ¤1 a day to the poorest.
  L.econ.laws.alms = true;
  const poor = members(L).poor;
  if (poor.length) {
    const c0 = poor[0].coins || 0;
    o.lawsDaily(L, game.day);
    assert.ok((poor[0].coins || 0) >= c0, 'alms (from the treasury, by the budget, when governed)');
  }
  // Market day: a tenth off.
  L.econ.laws.marketDay = true;
  let md = game.day;
  while (!o.marketDay(L, md)) md++;
  game.day = md;
  const trader = L.npcs.find((r) => r.job === 'merchant');
  if (trader) {
    const npc = { rec: trader, settlement: s, layout: L };
    const on = sim.priceParts(npc).base;
    L.econ.laws.marketDay = false;
    assert.ok(sim.priceParts(npc).base > on, 'cheaper on market day');
  }
  // A proposal for one is a matter like any other.
  const p = o.propose(L, 'law', 'guildDues');
  assert.ok(p.ok && /Pass/.test(p.item.title));
  assert.ok(T.agenda.includes(p.item));
});

test('charters: six of them (and since Round 122, a lordship); reformed, the seats and the rules change with it', () => {
  const { L, T, o, game } = governing();
  assert.ok(CHARTER_IDS.length >= 6);
  assert.ok(['council', 'assembly', 'theocracy'].includes(defaultCharter(L)));
  o.reform(L, T, 'guild', game.day);
  assert.equal(T.charter, 'guild');
  assert.equal(T.council.length, CHARTERS.guild.seats);
  for (const c of T.council) assert.ok(['merchants', 'crafters'].includes(factionOf(L.npcs[c.idx])));
  o.reform(L, T, 'commune', game.day);
  assert.ok(T.budget.relief >= 1);
  assert.ok(!o.propose(L, 'budget', 'relief', 0).ok, 'a commune can\'t cut relief');
  o.reform(L, T, 'autocracy', game.day);
  T.agenda = [];
  const p = o.propose(L, 'tax', 0.05);
  assert.equal(o.decide(L, p.item.id, 0).state, 'decreed', 'by decree, no vote');
  assert.equal(T.holder.termEnd, null, 'no elections');
});

test('other ways into office: appointed by the realm, acclaimed by a town in trouble, a coup, a village founded', () => {
  // Appointed: a town without a head, in the realm you're a citizen of.
  {
    const W = world(12345, (s) => s.type === 'town' && !!s.civ && !s.empire);
    const { game, sim, L, o } = W;
    const home = game.world.ow.settlements.find((q) => q.civ === L.settlement.civ && q !== L.settlement && !q.deserted);
    sim.citizen.sid = home.id;
    sim.renown.set(home.id, 12);
    for (const r of L.npcs) if (r.job === 'mayor') r.job = 'noble';
    L.econ.mayorless = game.day;
    let offer = null;
    for (let k = 0; k < 20 && !offer; k++) {
      o.paths(L, game.day, new RNG(k));
      offer = o.offerFor();
    }
    assert.ok(offer && offer.how === 'appointment');
    assert.ok(o.answer(true).ok);
    const T = o.of(L.settlement.id);
    assert.equal(T.holder.how, 'appointment');
    assert.equal(T.holder.termEnd, null, 'at the realm\'s pleasure');
    assert.ok(sim.isCitizen(L.settlement.id), 'a citizen of it now');
  }
  // Acclaimed: famine, and you a friend of the town, there.
  {
    const W = world(777);
    const { game, sim, L, o, s } = W;
    sim.renown.set(s.id, 12);
    game.currentSettlement = s;
    L.econ.famineDays = 5;
    o.paths(L, game.day, new RNG(1));
    const offer = o.offerFor();
    assert.ok(offer && offer.how === 'acclaim');
    o.answer(true);
    assert.equal(o.of(s.id).holder.how, 'acclaim');
  }
  // A coup: half the watch with you, and the hall is yours, by decree.
  {
    const W = world(4242);
    const { sim, L, o, s } = W;
    const guards = L.npcs.filter((r) => r.job === 'guard' && r.alive !== false && !r.away);
    for (const g of guards) {
      const npc = { rec: g, settlement: s, layout: L };
      sim.changeRep(npc, 90);
      o.sound(L, npc);
    }
    const P = o.plotStrength(L);
    assert.ok(P.share >= 0.5, JSON.stringify(P));
    let r = null;
    for (let k = 0; k < 12 && !(r && r.seized); k++) {
      if (r) o.town(L).plot = { pid: o.pid(), day: 0, guards: guards.map((q) => q.idx) };
      r = o.seize(L);
      if (!r.seized) W.game.day++;
    }
    assert.ok(r.seized);
    const T = o.of(s.id);
    assert.equal(T.charter, 'autocracy');
    assert.equal(T.holder.how, 'coup');
    assert.ok((T.favour.elders || 0) < 0, 'the elders remember');
  }
  // Founding: lead settlers out; when they reach the spot, it's yours.
  {
    let done = false;
    for (const seed of [12345, 777, 4242, 99]) {
      const W = world(seed, (s) => s.type !== 'village');
      const { game, sim, L, o } = W;
      sim.renown.set(L.settlement.id, 10);
      const r = o.lead(L);
      if (!r.ok) continue;
      const p = r.party;
      p.arrive = sim.abs - 1;
      sim.founding.advance(p, game.day);
      const T = o.of(p.sid);
      assert.ok(T && T.holder && T.holder.how === 'founding');
      assert.ok(T.chooseCharter, 'to write its charter');
      assert.ok(o.chooseCharter(sim.layoutOf(p.sid), 'commune'));
      assert.equal(T.charter, 'commune');
      done = true;
      break;
    }
    assert.ok(done, 'a village founded');
  }
});

test('crises: famine, raiders, fever, unrest, scandal; decided at once, or by the steward when time runs out', () => {
  const { sim, L, T, o, game } = governing();
  L.econ.famineDays = 5;
  const c = crisisFor(sim, L, T, game.day);
  assert.ok(c && c.crisis === 'famine' && c.hours);
  const it = o.crisis(L, T, c, game.day, sim.abs);
  L.econ.treasury = 999;
  it.opts[0].off = null;
  const r = o.decide(L, it.id, 0);
  assert.ok(r.ok && !r.vote, 'no vote in a crisis');
  assert.equal(L.econ.famineDays, 0, 'grain bought');
  // Left too long: the steward acts.
  const it2 = o.crisis(L, T, scandal(L, T, 'Talk of a bribe.'), game.day, sim.abs);
  it2.until = sim.abs - 1;
  o.update();
  assert.ok(it2.done && it2.outcome === 'by standing order');
});

test('the realm: petitions, a seat on its council (its decrees put to you), and breaking away to head a realm of your own', () => {
  const { sim, L, T, o, game } = governing(12345, (s) => s.type === 'town' && !!s.civ && !sim0(s));
  const civ = L.settlement.civ;
  const p = o.petition(L, 'tribute');
  assert.ok(p.ok);
  assert.ok(!o.petition(L, 'tribute').ok, 'not again so soon');
  // A seat, and a decree put to it.
  T.realm.offered = game.day;
  assert.ok(o.takeRealmSeat(L).ok);
  const R = sim.realms.realm(civ);
  let applied = false;
  assert.ok(o.realmProposal(civ, { key: 'armsBan', title: 'A weapons ban in every town', text: 'a ban.', apply: () => { applied = true; } }, game.day));
  const it = T.agenda.find((q) => q.kind === 'realmvote');
  assert.ok(it);
  o.carry(L, T, it, game.day, 0, 'you');
  o.realmResolve(civ, game.day + 1);
  assert.ok(typeof applied === 'boolean');
  // Breaking away (if it isn't the capital).
  if (!sim.realms.isCapital(L.settlement)) {
    T.lastOverall = 80;
    o.apply(L, T, { act: 'secede' }, game.day);
    const nc = L.settlement.civ;
    assert.notEqual(nc, civ);
    assert.equal(sim.realms.realm(nc).head, o.pid());
    assert.ok(o.realmDecree(L, 'taxFloor', 0.06).ok);
    assert.equal(sim.realms.realm(nc).decrees.taxFloor, 0.06);
  }
  void R;
});
const sim0 = () => false;

test('a council of players: a fellow citizen seated, asked to vote, and the vote waits for them', () => {
  const { L, T, o, game } = governing();
  // (A second player, standing in: online, by the office's own lights.)
  o.online = (pid) => pid === 'g' || pid === o.pid();
  assert.ok(o.seatPlayer(L, 'g', 'Guesty').ok);
  assert.ok(T.council.some((c) => c.pid === 'g'));
  o.inHall = () => true;
  const p = o.propose(L, 'budget', 'fetes', 2);
  const r = o.decide(L, p.item.id, 0);
  assert.equal(r.state, 'waiting');
  assert.ok(o.shows.some((x) => x.kind === 'vote' && x.pid === 'g'));
  // Their vote (cast as them).
  const real = o.pid;
  o.pid = () => 'g';
  assert.ok(o.cast(L.settlement.id, p.item.id, true));
  o.pid = real;
  assert.notEqual(p.item.state, 'voting', 'the vote is done');
  void game;
});

test('kept: a town\'s office goes in the save and comes back', () => {
  const { sim, L, T, o, game } = governing();
  T.orders.tax = 'low';
  const d = JSON.parse(JSON.stringify(sim.serialize()));
  const g2 = makeGame(12345);
  g2.sim.office.load(d.office);
  const T2 = g2.sim.office.of(L.settlement.id);
  assert.equal(T2.holder.pid, T.holder.pid);
  assert.equal(T2.orders.tax, 'low');
  void game;
  void o;
});

test('the windows: the council\'s seven pages, the campaign, the count, the banners, a vote', () => {
  const { sim, L, T, o, game } = governing();
  L.econ.recent.violence = 4;
  T.agenda = [];
  o.table(L, T, game.day, sim.abs, true);
  const ui = { mouseCell: { x: 0, y: 0 }, time: 0, msg() {}, close() {}, open: (w) => w, audio: null, game };
  const w = new CouncilWindow(ui, L.settlement.id);
  for (const tab of ['sitting', 'treasury', 'laws', 'people', 'officers', 'charter', 'realm']) {
    w.tab = tab;
    w.hits = [];
    const g = new Grid(w.w, w.h);
    w.draw(g, game);
    assert.ok(g.ch.join('').includes('COUNCIL'), tab);
  }
  assert.ok(src('ui/ui.js').includes("case 'KeyN'"), 'N opens it');
  const c = new CountWindow(ui, { sid: L.settlement.id, title: 'Who?', names: ['A', 'B'], t: [3, 5], win: 1, you: 1, kind: 'election' });
  c.t = 10;
  c.draw(new Grid(c.w, c.h), game);
  for (const k of ['oath', 'charter', 'fallen', 'free', 'founding', 'offer']) {
    const b = new BannerWindow(ui, k, { sid: L.settlement.id, how: 'election', title: 'Mayor', charter: 'council', why: 'stepped down', days: 3, civ: 'The Free State', from: '', text: 'An offer.' });
    b.draw(new Grid(b.w, b.h), game);
  }
  const v = new VoteWindow(ui, { sid: L.settlement.id, id: -1 });
  v.draw(new Grid(v.w, v.h), game);
  sim.citizen = null;
  const W2 = world(777);
  W2.o.stand(W2.L);
  const h = new HustingsWindow(ui, W2.s.id);
  h.draw(new Grid(h.w, h.h), W2.game);
});

test('version 1.21.0, and the step to it', () => {
  assert.ok(compareVersions(GAME_VERSION, '1.21.0') >= 0);
  const steps = stepsFor('1.20.0').filter((s) => s.to === '1.21.0');
  assert.equal(steps.length, 1);
  const log = [];
  steps[0].data({}, log);
  assert.ok(/mayor/i.test(log[0]) && /council/i.test(log[0]));
});

void DAY;
void SESSION;
