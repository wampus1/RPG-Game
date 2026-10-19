// (Round 121) Holding office. A player can come to govern a town: elected
// (standing against its mayor, a citizen of some days' standing, with a fee
// to file), appointed by the realm's ruler to a town without a head,
// acclaimed by its people in a time of trouble, by seizing its hall with the
// watch behind you, or by leading settlers out to found a village of your
// own. However you come by it, the town keeps its own life: its old mayor
// steps down, a steward (your deputy, one of the townsfolk) keeps the hall
// and the town's daily business, and the council sits every morning at ten.
//
// At each sitting what you decided since the last is carried out and the
// day's matters are tabled (see agenda.js); whatever you leave undecided
// your steward decides by your standing orders. You decide in the council
// window (N, or at the hall): a matter is put to the vote under the town's
// charter (see charters.js) and may be carried, or voted down; a crisis is
// decided there and then. The factions (see factions.js) watch it all, and
// you can lose the office as you won it: voted out at the end of a term,
// recalled by petition, removed by the temple or the guilds, deposed by the
// realm you defy, or risen against.
//
// You can name the town's officers (steward, captain of the watch,
// treasurer, magistrate), set its standing orders, pass laws only a
// governor can draft, reform its charter, petition the realm, take a seat on
// its council, and (if the town will follow you) break away from it. In a
// shared world, other players who are citizens can sit on your council and
// vote, and stand against you when the term is up.
import { alive, ledger, mayorOf, kitchenOf, DAY } from './econ.js';
import { LAWS, LAW_IDS, lawFits, lawOn, byDecree, stance } from './laws.js';
import { FACTIONS, FACTION_IDS, BUDGET, BUDGET_USUAL, approvals, members, factionOf, preview } from './factions.js';
import { CHARTERS, CHARTER_IDS, defaultCharter, headTitle, charterFits } from './charters.js';
import { matters, crisisFor, scandal, ultimatum, uprising, stated, feedHungry, nextSession, whoOf, sums, raidOdds, overOf, forChange, SESSION, MAX_OPEN, WORKS_COST, full } from './agenda.js';
import { authority, formOf } from './realms.js';
import { retrain } from '../entities/npcgen.js';
import { RNG, hash4, clamp } from '../util/rng.js';
import { pidOf, playerOf } from './saga/refs.js';
import { countItem, removeItem, addItem } from '../game/inventory.js';
import { isOutworlder } from '../game/hero.js';
import { traitsOf, hasTrait, suits, OTRAITS } from './officertraits.js';

export const FEE = { village: 20, town: 40, city: 80 };
export const CITIZEN_DAYS = 3; // a citizen this long before standing
const PROMISE_DAYS = 10; // to keep a pledge
const MAX_PLEDGES = 3;
const VOTE_WAIT = 120; // game minutes a vote waits on councillors who play
const FAVOUR_MAX = 30;

// The town's officers.
export const OFFICES = {
  steward: { name: 'Steward', short: 'Your deputy: decides what you leave.', about: 'Your deputy. Keeps the hall and the town\'s business, and decides by your standing orders whatever you leave undecided. A diligent one forgets nothing.' },
  captain: { name: 'Captain of the watch', short: 'Leads the watch: one stronger.', about: 'Leads the guards: the watch counts one stronger against raiders, and the guards think better of you.', from: 'guard' },
  treasurer: { name: 'Treasurer', short: 'Gathers more tax, if shrewd.', about: 'Keeps the books: a shrewd one gathers up to a fifth more tax. A dishonest one skims it.' },
  magistrate: { name: 'Magistrate', short: 'Sets the fines, not the council.', about: 'Sets the fines without troubling the council: a stern one raises them after thefts, a lenient one eases them.' },
};
export const OFFICE_IDS = Object.keys(OFFICES);
// (Round 125) The watch's pay, to the coin: and the level of it the
// factions reckon by.
export const WAGE = { min: 3, max: 10 };
export const wageLevel = (w) => (w < 5 ? 0 : w < 7 ? 1 : 2);

// Standing orders: what the steward does with matters you leave.
// (Each choice: its key, what it means, and a word for it.)
export const ORDERS = {
  tax: { name: 'Taxes', opts: [['balance', 'Keep the coffers healthy', 'Balance'], ['low', 'Lower them when we can', 'Keep low'], ['hold', 'Leave them be', 'Leave']] },
  relief: { name: 'The hungry', opts: [['feed', 'Feed them', 'Feed'], ['none', 'Leave them', 'Leave']] },
  laws: { name: 'Laws', opts: [['people', 'As the town wishes', 'As wished'], ['leave', 'Change nothing', 'Leave']] },
  works: { name: 'Building', opts: [['ask', 'Wait for me', 'Ask me'], ['needed', 'Build what\'s needed', 'Build']] },
  feasts: { name: 'Feast days', opts: [['flush', 'When we can afford it', 'If flush'], ['never', 'Never', 'Never']] },
  justice: { name: 'Fines', opts: [['stern', 'Raise them after thefts', 'Stern'], ['mild', 'Ease them when calm', 'Mild']] },
  crises: { name: 'In a crisis', opts: [['cautious', 'Play it safe', 'Cautious'], ['bold', 'Act boldly', 'Bold']] },
  realm: { name: 'Realm decrees', opts: [['comply', 'Comply with them', 'Comply'], ['defy', 'Defy them', 'Defy']] },
};
export const ORDER_IDS = Object.keys(ORDERS);
const DEFAULT_ORDERS = { tax: 'balance', relief: 'feed', laws: 'people', works: 'ask', feasts: 'flush', justice: 'stern', crises: 'cautious', realm: 'comply' };

// Pledges a candidate can make, and how a pledge is judged once in office.
export const PLEDGES = {
  tax: { text: 'Lower taxes', for: ['merchants', 'poor', 'farmers', 'crafters'] },
  relief: { text: 'Bread for the hungry', for: ['poor', 'clergy', 'farmers'] },
  watch: { text: 'Better pay for the watch', for: ['guards'] },
  works: { text: 'Build what the town lacks', for: ['crafters', 'merchants'] },
  feast: { text: 'Feast days', for: ['poor', 'farmers', 'crafters'] },
  law: { text: 'A law of theirs', for: FACTION_IDS },
};

const residents = (L) => L.npcs.filter((r) => alive(r) && !r.away && !r.migrated && !r.visitor);
const adults = (L) => residents(L).filter((r) => r.age !== 'child');
const pc = (v) => `${Math.round(v * 100)}%`;
const an = (w) => (/^[aeiou]/i.test(w) ? `an ${w}` : `a ${w}`);
const noise = (...k) => (hash4(...k) % 1000) / 1000 - 0.5;
const respect = (r) => (r.personality?.kindness || 0) + (r.personality?.sociability || 0) * 0.6 + (r.skills?.trading || 0) + (r.age === 'elder' ? 0.4 : 0) + (r.job === 'noble' ? 0.6 : 0);

export class Office {
  constructor(game, sim) {
    this.game = game;
    this.sim = sim;
    this.towns = {}; // sid -> the town's office (see town())
    this.offers = []; // { pid, sid, how, from, text, until }
    this.shows = []; // windows to open for a player: { pid, kind, data }
    this.notes = []; // (Round 125) small notes in the corner for a player: { pid, text, color }
    this.realmVotes = {}; // civ id -> { change, day, votes, text }
  }

  // ------------------------------------------------------------ records
  of(sid) {
    return this.towns[sid] || null;
  }

  town(L) {
    const sid = L.settlement.id;
    let T = this.towns[sid];
    if (!T) {
      T = this.towns[sid] = {
        sid, charter: defaultCharter(L), holder: null, council: [], offices: {}, orders: { ...DEFAULT_ORDERS }, budget: { ...BUDGET_USUAL },
        agenda: [], seq: 1, favour: {}, regard: {}, loyal: {}, hist: [], minutes: [], promises: [], recall: null, defy: {}, defyLevel: 0,
        past: [], purse: 0, lowDays: 0, unrest: 0, quiet: {}, crises: {}, filed: null, goals: {}, realm: {}, bribed: {}, petitions: {},
        lastApproval: null, lastOverall: null, highDays: 0, streak: 0,
      };
    }
    return T;
  }

  governs(L) {
    const T = L && this.towns[L.settlement.id];
    return !!(T && T.holder);
  }

  holder(sid) {
    const T = this.towns[sid];
    return T && T.holder ? T.holder : null;
  }

  // The town a player governs (one at a time).
  heldBy(pid) {
    for (const T of Object.values(this.towns)) if (T.holder && T.holder.pid === pid) return T;
    return null;
  }

  // The town whose council a player sits on, or governs.
  councilOf(pid) {
    const mine = this.heldBy(pid);
    if (mine) return mine;
    for (const T of Object.values(this.towns)) if (T.holder && T.council.some((c) => c.pid === pid)) return T;
    return null;
  }

  pid() {
    return pidOf(this.game.player);
  }

  isHolder(sid, pid = this.pid()) {
    const h = this.holder(sid);
    return !!h && h.pid === pid;
  }

  layout(T) {
    return this.sim.layoutOf(T.sid);
  }

  // (Only if it's laid out already: never worth laying a town out for.)
  laid(T) {
    const L = this.game.world.layouts.get(T.sid);
    return L && L.econ ? L : null;
  }

  title(L, T = this.of(L.settlement.id)) {
    return headTitle(T ? T.charter : defaultCharter(L), L.settlement, T && T.holder && T.holder.style);
  }

  stewardOf(L, T = this.of(L.settlement.id)) {
    const i = T && T.offices.steward;
    const r = i !== undefined && i !== null ? L.npcs[i] : null;
    return r && alive(r) && !r.migrated && r.steward ? r : null;
  }

  officer(L, T, k) {
    const i = T.offices[k];
    const r = i !== undefined && i !== null ? L.npcs[i] : null;
    return r && alive(r) && !r.migrated ? r : null;
  }

  // ------------------------------------------------------------ players
  online(pid) {
    return !!playerOf(this.game, pid);
  }

  // Do `fn` as the player `pid` (if they're in the world); null if not.
  asPid(pid, fn) {
    const p = playerOf(this.game, pid);
    if (!p) return null;
    return this.game.asPlayer(p, fn);
  }

  nameOf(pid) {
    return this.asPid(pid, () => this.game.playerName) || null;
  }

  tell(pid, text, color = '#e8d8a0') {
    this.asPid(pid, () => this.game.ui && this.game.ui.msg && this.game.ui.msg(text, color));
  }

  show(pid, kind, data) {
    this.shows.push({ pid, kind, data });
    if (this.shows.length > 12) this.shows.shift();
  }

  // (Round 125) A small note in the corner of a player's screen: a matter
  // tabled, a vote called, how it went. Kept till they're about to see it
  // (not over an opening scene).
  note(pid, text, color = '#e8d8a0') {
    if (pid === null || pid === undefined) return;
    this.notes.push({ pid, text, color });
    if (this.notes.length > 24) this.notes.shift();
  }

  // (Round 125) Something only the player can answer (a crisis, a vote
  // that waits on them): if they're asleep, or waiting out the hours,
  // time stops racing and they're roused for it.
  wake(pid, why) {
    this.asPid(pid, () => {
      const g = this.game;
      if (g.waiting || (g.sleep && g.sleep.phase !== 'out')) g.disturb?.(why);
      return true;
    });
  }

  // (Round 125) How a matter went, kept for the record (the council
  // window's Record page): { day, title, choice, outcome, aye, nay, by }.
  // `outcome`: carried, decreed, decided, defeated, vetoed, standing (the
  // steward, by standing orders), set aside.
  record(T, it, outcome, o = {}) {
    const opt = it && it.choice !== undefined && it.choice !== null ? it.opts[it.choice] : null;
    (T.record ||= []).push({ day: o.day ?? this.dayNow ?? this.sim.crown?.dayNow ?? this.game.day, title: it ? it.title : o.title || '', choice: o.choice ?? (opt ? opt.label : null), outcome, aye: o.aye ?? null, nay: o.nay ?? null, by: o.by || null, crisis: !!(it && it.crisis) });
    if (T.record.length > 240) T.record.shift();
  }

  // What townsperson `r` thinks of player `pid` (the current player's own
  // reckoning, or what was last known of another's).
  opinionOf(pid, L, r) {
    if (pid === this.pid()) return this.sim.opinion({ rec: r, settlement: L.settlement, layout: L });
    const c = this.opCache && this.opCache[pid];
    const v = c && c[`${L.settlement.id}:${r.idx}`];
    return v ?? 0;
  }

  // Remember what everyone in a town thinks of `pid` (while they're here).
  noteOpinions(pid, L) {
    const out = this.asPid(pid, () => {
      const m = {};
      for (const r of adults(L)) m[`${L.settlement.id}:${r.idx}`] = this.sim.opinion({ rec: r, settlement: L.settlement, layout: L });
      return m;
    });
    if (!out) return false;
    this.opCache ||= {};
    this.opCache[pid] = { ...(this.opCache[pid] || {}), ...out };
    return true;
  }

  // ------------------------------------------------------------ elections
  // Can the current player stand for office here? { ok, why, fee }.
  canStand(L) {
    const s = L.settlement;
    const sim = this.sim;
    const pid = this.pid();
    const T = this.of(s.id);
    const fee = FEE[s.type] || 40;
    if (this.isHolder(s.id, pid)) return { ok: false, why: 'You already hold the office here.' };
    if (this.heldBy(pid)) return { ok: false, why: `You already govern ${this.sim.layoutOf(this.heldBy(pid).sid).settlement.name}. One town at a time.` };
    if (!sim.isCitizen(s.id)) return { ok: false, why: `Only a citizen of ${s.name} can stand.` };
    const days = this.game.day - (sim.citizen.since ?? this.game.day);
    // (Round 123) An outworlder: the town wants to know them a good deal
    // longer first, and asks twice the fee.
    const alien = isOutworlder(this.game.hero);
    const need = alien ? CITIZEN_DAYS * 3 : CITIZEN_DAYS;
    if (days < need) return { ok: false, why: `You've been a citizen only ${days} day${days === 1 ? '' : 's'}; the town wants ${need} at least${alien ? ' from someone not of this world' : ''}.` };
    if (this.game.isWanted(s.id) || sim.justice.pendingIn(s.id).length) return { ok: false, why: 'Not with charges against you.' };
    if (sim.justice.notoriety(s.id) >= 3) return { ok: false, why: 'Your record here is too long: nobody would vote for you.' };
    const q = sim.causes.of(s.id);
    if (q) return { ok: false, why: q.kind === 'office' ? 'An election is already under way.' : 'The town is voting on something else just now. Wait till it\'s done.' };
    if (T && T.holder) {
      const ch = CHARTERS[T.charter];
      if (!ch.term) return { ok: false, why: `${s.name} has no elections under ${ch.short}.` };
      if (T.filed && T.filed.pid !== pid) return { ok: false, why: `${T.filed.name} has already filed to stand at the next election.` };
      return { ok: true, fee: alien ? fee * 2 : fee, against: T.holder.name, filing: true, when: T.holder.termEnd };
    }
    if (T && T.lostDay !== undefined && T.lostBy === pid && this.game.day - T.lostDay < 10) return { ok: false, why: 'You lost here not long ago. Give the town time.' };
    const m = mayorOf(L);
    if (!m) return { ok: false, why: 'The town is choosing a new mayor already.' };
    if (adults(L).length < 4) return { ok: false, why: 'There are too few people here to hold an election.' };
    return { ok: true, fee: alien ? fee * 2 : fee, against: full(m) };
  }

  // Stand: against the town's mayor (the town votes in a few days), or, in
  // a town another player governs, to be the challenger when the term is up.
  stand(L) {
    const t = this.canStand(L);
    if (!t.ok) return t;
    const p = this.game.player;
    if (countItem(p.inv, 'coin') < t.fee) return { ok: false, why: `The fee to file is ¤${t.fee}.` };
    removeItem(p.inv, 'coin', t.fee);
    L.econ.treasury += t.fee;
    const day = this.game.day;
    const pid = this.pid();
    const name = this.game.playerName;
    const T = this.town(L);
    if (t.filing) {
      T.filed = { pid, name, day };
      ledger(L, day, `${name} has filed to stand against ${whoOf(L, T)} at the election on day ${T.holder.termEnd}.`);
      return { ok: true, filing: true, fee: t.fee, when: T.holder.termEnd };
    }
    const m = mayorOf(L);
    const q = this.sim.causes.office(L, day, [{ idx: m.idx, sitting: true }, { pid, name }], new RNG(hash4(L.settlement.id, day, 0x57a)));
    this.noteOpinions(pid, L);
    return { ok: true, fee: t.fee, q };
  }

  // Which way someone leans in an election for office (-1: the first
  // candidate, the sitting one; +1: the second).
  lean(L, q, r) {
    const T = this.of(L.settlement.id);
    const f = factionOf(r) || 'crafters';
    const hard = (L.econ.treasury || 0) < residents(L).length * 10 ? 0.2 : 0;
    const pull = (c) => {
      if (c.idx !== undefined && c.idx !== null) {
        const x = L.npcs[c.idx];
        if (!x || !alive(x)) return -2;
        if (x === r) return 3;
        const P = r.personality || {};
        const near = -Math.abs((P.kindness ?? 0.5) - (x.personality.kindness ?? 0.5)) - Math.abs((P.bravery ?? 0.5) - (x.personality.bravery ?? 0.5));
        return 0.35 + near * 1.2 + (c.sitting ? 0.15 - hard : 0) + (factionOf(x) === f ? 0.15 : 0);
      }
      let v = (this.opinionOf(c.pid, L, r) - 15) / 100 * 1.2;
      // (Round 123) Not of this world: folk hesitate to put one in charge.
      if (this.asPid(c.pid, () => isOutworlder(this.game.hero))) v -= 0.35;
      const pl = (q.pledges && q.pledges[c.pid]) || [];
      v += Math.min(2, pl.filter((k) => k.f === f).length) * 0.25;
      if (c.sitting && T && T.lastApproval) v += ((T.lastApproval[f] ?? 50) - 50) / 60 - hard;
      return v;
    };
    return clamp(pull(q.cands[1]) - pull(q.cands[0]) + noise(r.idx, q.id, 0x0ff1) * 0.5, -1, 1);
  }

  // A pledge to a faction, made while campaigning.
  pledge(L, q, kind, f, law = null) {
    const pid = this.pid();
    q.pledges ||= {};
    const list = (q.pledges[pid] ||= []);
    if (list.length >= MAX_PLEDGES) return { ok: false, why: `You've made ${MAX_PLEDGES} pledges already.` };
    if (list.some((k) => k.kind === kind && k.f === f && k.law === law)) return { ok: false, why: 'You\'ve pledged that already.' };
    const text = kind === 'law' && law ? (lawOn(L, law) ? `Throw out the ${LAWS[law].name.toLowerCase()}` : `Pass ${an(LAWS[law].name.toLowerCase())}`) : PLEDGES[kind].text;
    list.push({ kind, f, law, text, at: { tax: L.econ.tax }, wasOn: law ? lawOn(L, law) : undefined });
    return { ok: true, text };
  }

  // Speak in the square, once a day: the undecided of one faction may come
  // round to you.
  address(L, q, f) {
    const pid = this.pid();
    const day = this.game.day;
    q.spoke ||= {};
    if (q.spoke[pid] === day) return { ok: false, why: 'You\'ve spoken once today.' };
    q.spoke[pid] = day;
    const side = q.cands.findIndex((c) => c.pid === pid);
    if (side < 0) return { ok: false, why: 'You aren\'t standing.' };
    const people = adults(L).filter((r) => factionOf(r) === f && q.swayed[r.idx] === undefined);
    let won = 0;
    let heard = 0;
    for (const r of people) {
      const lean = this.lean(L, q, r) * (side ? 1 : -1);
      if (lean > 0.35 || lean < -0.55) continue;
      heard++;
      const op = this.sim.opinion({ rec: r, settlement: L.settlement, layout: L });
      const ok = (hash4(r.idx, day, q.id, 0x5be) % 1000) / 1000 < clamp(0.45 + op / 300, 0.15, 0.8);
      if (!ok) continue;
      q.swayed[r.idx] = side;
      won++;
      if (r.ent && !r.ent.dead && r.ent.emoteShow) r.ent.emoteShow('♥', '#ff80a0', 2);
    }
    if (won) ledger(L, day, `${this.game.playerName} spoke to the ${FACTIONS[f].name.toLowerCase()} in the square, and won ${won} of them over.`);
    return { ok: true, won, heard };
  }

  // Projected result: [for the first, for the second].
  projection(L, q) {
    return this.sim.causes.tally(L, q);
  }

  // The town has voted (see causes.resolve).
  elected(L, q, win, t, day) {
    const s = L.settlement;
    const T = this.town(L);
    const cw = q.cands[win];
    const cl = q.cands[1 - win];
    const nameOf = (c) => (c.pid ? c.name : full(L.npcs[c.idx]));
    let what;
    if (cw.pid) {
      if (T.holder && T.holder.pid === cw.pid) {
        T.holder.termEnd = CHARTERS[T.charter].term ? day + CHARTERS[T.charter].term : null;
        T.holder.terms = (T.holder.terms || 1) + 1;
        what = `${cw.name} is returned as ${this.title(L, T).toLowerCase()} for another term`;
        T.goals.term = T.goals.term ?? day;
      } else {
        this.install(L, cw.pid, cw.name, 'election', day, { pledges: (q.pledges || {})[cw.pid] || [], quiet: true });
        what = `${cw.name} is the new ${this.title(L, T).toLowerCase()}`;
      }
    } else {
      const rec = L.npcs[cw.idx];
      if (cl.pid && T.holder && T.holder.pid === cl.pid) {
        this.unseat(L, 'voted out', day, rec, true);
        what = `${nameOf(cw)} is the new mayor; ${cl.name} is voted out`;
      } else what = `${nameOf(cw)} stays on as mayor`;
      if (cl.pid) {
        T.lostDay = day;
        T.lostBy = cl.pid;
      }
    }
    if (T.filed && q.cands.some((c) => c.pid === T.filed.pid)) T.filed = null;
    // The night of the count, for whoever stood.
    for (const c of q.cands) {
      if (!c.pid) continue;
      this.show(c.pid, 'count', { sid: s.id, title: q.title, names: q.cands.map(nameOf), t, win, you: q.cands.indexOf(c), kind: 'election' });
    }
    return what;
  }

  // ------------------------------------------------------------ in and out
  // A player takes office (`how`: election, appointment, acclaim, coup,
  // founding). The old mayor steps down; a steward is named.
  install(L, pid, name, how, day, o = {}) {
    const s = L.settlement;
    const other = this.heldBy(pid);
    if (other && other.sid !== s.id) this.unseat(this.layout(other), `took office in ${s.name}`, day);
    const T = this.town(L);
    const prev = T.holder;
    if (prev && prev.pid !== pid) this.unseat(L, how === 'coup' ? 'overthrown' : 'replaced', day, null, true);
    if (o.charter && charterFits(L, o.charter)) T.charter = o.charter;
    if (how === 'coup') T.charter = 'autocracy';
    if (!charterFits(L, T.charter)) T.charter = 'council';
    const ch = CHARTERS[T.charter];
    T.holder = { pid, name, since: day, how, termEnd: ch.term && how !== 'appointment' ? day + ch.term : null, terms: 1 };
    T.agenda = [];
    T.recall = null;
    T.lowDays = 0;
    T.unrest = 0;
    T.highDays = 0;
    T.defy = how === 'coup' ? { coup: day } : {};
    T.defyLevel = 0;
    // (A town gives a new head a little goodwill to start with, the more
    // so for those it chose itself; a usurper, none.)
    const warm = { election: 5, acclaim: 8, founding: 8, appointment: 2, birthright: 6 }[how] || 0;
    T.favour = how === 'coup' ? { elders: -15, clergy: -10, merchants: -5 } : Object.fromEntries(FACTION_IDS.map((f) => [f, warm]));
    for (const k of o.pledges || []) if (FACTIONS[k.f]) T.favour[k.f] += 3;
    // The old mayor steps aside (or, where they weren't voted out or
    // thrown out, stays on as your steward); a steward keeps the hall.
    const old = L.npcs.find((r) => r.job === 'mayor' && alive(r) && !r.migrated && !r.steward);
    if (old && ['appointment', 'acclaim', 'founding', 'birthright'].includes(how)) {
      old.stewardWas = old.stewardWas || 'noble';
      old.steward = true;
      T.offices.steward = old.idx;
      this.syncEnt(old);
    } else if (old) this.retire(L, old, day);
    this.ensureSteward(L, day, true);
    this.seatCouncil(L, T, day, true);
    // What was pledged becomes a promise.
    T.promises = (o.pledges || []).map((k) => ({ ...k, made: day, due: day + PROMISE_DAYS, state: 'open', base: k.at, built: T.built || 0 }));
    // A citizen of the town, if not already.
    this.asPid(pid, () => this.grantCitizen(L, day));
    // The chain of office.
    this.asPid(pid, () => {
      const p = this.game.player;
      if (!countItem(p.inv, 'chain_of_office')) addItem(p.inv, 'chain_of_office', 1);
    });
    const how2 = { election: ', elected by the town', appointment: `, appointed by ${s.civ ? authority(s.civ) : 'the realm'}`, acclaim: ', acclaimed by its people', coup: ', having seized the town hall', founding: ', its founder', birthright: ', as was always meant' }[how] || '';
    ledger(L, day, `${name} is now ${headTitle(T.charter, s, T.holder && T.holder.style)} of ${s.name}${how2}.`);
    this.asPid(pid, () => this.sim.addRenown?.(s.id, 2, 'taking up the town\'s office'));
    this.sim.saga?.emit('office_won', { pid, sid: s.id, how });
    if (!o.quiet) this.show(pid, 'oath', { sid: s.id, how, title: headTitle(T.charter, s, T.holder && T.holder.style), charter: T.charter });
    this.table(L, T, day, this.sim.abs, true);
    this.recordApproval(L, T, day);
    return T;
  }

  // The town's head is gone: why, and (if someone takes over at once) who.
  unseat(L, why, day, next = null, quiet = false) {
    const s = L.settlement;
    const T = this.of(s.id);
    if (!T || !T.holder) return null;
    const h = T.holder;
    T.past.push({ pid: h.pid, name: h.name, from: h.since, to: day, how: h.how, why, approval: T.lastOverall });
    if (T.past.length > 12) T.past.shift();
    const title = headTitle(T.charter, s, T.holder && T.holder.style);
    T.holder = null;
    T.agenda = [];
    T.recall = null;
    T.promises = [];
    T.defy = {};
    T.defyLevel = 0;
    T.realm.seat = false;
    const st = this.stewardOf(L, T);
    if (next && alive(next)) {
      if (st && st !== next) this.retire(L, st, day);
      if (next.steward) delete next.steward;
      retrain(L, next, 'mayor', new RNG(hash4(next.idx, day, 0x4e3)));
      this.syncEnt(next);
    } else if (st) delete st.steward;
    for (const k of OFFICE_IDS) {
      const r = this.officer(L, T, k);
      if (r && k === 'captain') delete r.captain;
    }
    T.offices = {};
    // (The town's pay and books back as its own mayor keeps them.)
    L.econ.guardWage = 5;
    L.econ.taxBoost = 1;
    L.econ.captain = null;
    // A long and well-loved tenure is remembered on the square.
    if (day - h.since >= 20 && (T.lastOverall || 0) >= 70) this.sim.history?.raiseStatue(L, h.name, `governing ${s.name} well`, day, 'player');
    const after = next ? `${full(next)} is mayor now.` : st ? `${full(st)} keeps the hall till a new mayor is chosen.` : '';
    ledger(L, day, `${h.name} is no longer ${title} of ${s.name}: ${why}. ${after}`.trim());
    if (!quiet || why !== 'voted out') this.tell(h.pid, `You are no longer ${title} of ${s.name}: ${why}.`, '#ffb080');
    this.show(h.pid, 'fallen', { sid: s.id, why, title, days: day - h.since });
    this.sim.saga?.emit('office_lost', { pid: h.pid, sid: s.id, why });
    // (Off their council too.)
    this.asPid(h.pid, () => {
      const p = this.game.player;
      if (countItem(p.inv, 'chain_of_office')) removeItem(p.inv, 'chain_of_office', 1);
    });
    return h;
  }

  // A mayor or steward steps down to what they were (a noble in a town of
  // any size, an elder retires).
  retire(L, r, day) {
    const was = r.stewardWas;
    delete r.steward;
    delete r.stewardWas;
    const job = was && was !== 'mayor' ? was : r.age === 'elder' ? 'retired' : L.settlement.type === 'village' ? 'farmer' : 'noble';
    retrain(L, r, job, new RNG(hash4(r.idx, day, 0x2e7)));
    this.syncEnt(r);
  }

  syncEnt(r) {
    const e = r.ent;
    if (e && !e.dead) {
      e.look = r.look;
      e.activity = null;
    }
  }

  // A steward for the hall (the most diligent and respected of the town,
  // or the one named).
  ensureSteward(L, day, quiet = false, pick = null) {
    const T = this.of(L.settlement.id);
    if (!T || !T.holder) return null;
    const cur = this.stewardOf(L, T);
    if (cur && !pick && cur.ruler === undefined) return cur;
    if (cur) this.retire(L, cur, day);
    const cands = adults(L).filter((r) => r.job !== 'guard' && r.ruler === undefined && !r.hired && r.soldier === undefined && r.captive === undefined);
    // (Not the town's only smith or cook, if it can be helped: a steward
    // works at the hall.)
    const only = (r) => !['laborer', 'noble', 'retired', 'beggar', 'farmer', 'mayor'].includes(r.job) && residents(L).filter((o) => o.job === r.job).length <= 1;
    const score = (r) => respect(r) + (r.personality.diligence ?? 0.5) - (only(r) ? 2 : 0);
    const best = pick || cands.sort((a, b) => score(b) - score(a))[0];
    if (!best) return null;
    best.stewardWas = best.job;
    best.steward = true;
    retrain(L, best, 'mayor', new RNG(hash4(best.idx, day, 0x57e)));
    this.syncEnt(best);
    T.offices.steward = best.idx;
    if (!quiet) ledger(L, day, `${full(best)} is steward of the town hall now, for ${whoOf(L, T)}.`);
    return best;
  }

  grantCitizen(L, day) {
    const sim = this.sim;
    const s = L.settlement;
    if (sim.isCitizen(s.id)) return false;
    if (sim.citizen) sim.revoke('moved', true);
    const host = sim.pickHost(L);
    sim.citizen = { sid: s.id, since: day, host: host ? host.house.id : null, hostBed: host ? host.bed : null, home: null, taxDay: day, owed: 0 };
    ledger(L, day, `${this.game.playerName} became a citizen of ${s.name}.`);
    return true;
  }

  // Revoked, renounced: you can't govern a town you're no citizen of.
  onRevoke(sid) {
    const T = this.of(sid);
    if (T && T.holder && T.holder.pid === this.pid()) {
      const L = this.sim.layoutOf(sid);
      if (L) this.unseat(L, 'no longer a citizen', this.game.day);
    }
    if (T) T.council = T.council.filter((c) => c.pid !== this.pid());
  }

  // How the head of the town is styled (under a charter that lets them
  // choose: a lordship).
  setStyle(L, style) {
    const T = this.of(L.settlement.id);
    const ch = T && CHARTERS[T.charter];
    if (!T || !T.holder || !ch || !ch.styles || !ch.styles.includes(style)) return false;
    T.holder.style = style;
    ledger(L, this.game.day, `${T.holder.name} is to be known as ${style} of ${L.settlement.name}.`);
    return true;
  }

  stepDown(L) {
    if (!this.isHolder(L.settlement.id)) return false;
    this.unseat(L, 'stepped down', this.game.day);
    return true;
  }

  // ------------------------------------------------------------ the council
  // The council's seats, filled as the charter has them.
  seatCouncil(L, T, day, fresh = false) {
    const ch = CHARTERS[T.charter];
    const keep = fresh ? [] : T.council.filter((c) => (c.pid ? true : (() => {
      const r = L.npcs[c.idx];
      return r && alive(r) && !r.migrated && !r.steward;
    })()));
    if (fresh) for (const c of T.council) if (!c.pid && L.npcs[c.idx]) delete L.npcs[c.idx].townCouncil;
    const players = keep.filter((c) => c.pid);
    const want = ch.seats;
    const taken = new Set(keep.filter((c) => !c.pid).map((c) => c.idx));
    const pool = adults(L).filter((r) => !taken.has(r.idx) && !r.steward && r.job !== 'mayor' && r.ruler === undefined && r.soldier === undefined && r.captive === undefined);
    let order;
    if (ch.vote === 'guild') order = pool.filter((r) => ['merchants', 'crafters'].includes(factionOf(r))).sort((a, b) => (b.coins || 0) - (a.coins || 0));
    else if (ch.vote === 'temple') order = [...pool.filter((r) => r.job === 'priest'), ...pool.filter((r) => r.job !== 'priest' && factionOf(r) === 'clergy').sort((a, b) => respect(b) - respect(a)), ...pool.filter((r) => factionOf(r) === 'elders').sort((a, b) => respect(b) - respect(a))];
    else {
      // One of each of the larger factions first, the most respected.
      const M = members(L);
      const facs = FACTION_IDS.filter((f) => M[f].length).sort((a, b) => M[b].length - M[a].length);
      order = [];
      for (const f of facs) {
        const r = pool.filter((q) => factionOf(q) === f && !order.includes(q)).sort((a, b) => respect(b) - respect(a))[0];
        if (r) order.push(r);
      }
      order.push(...pool.filter((q) => !order.includes(q)).sort((a, b) => respect(b) - respect(a)));
    }
    const out = keep.filter((c) => !c.pid);
    for (const r of order) {
      if (out.length + players.length >= want) break;
      if (out.some((c) => c.idx === r.idx)) continue;
      out.push({ idx: r.idx });
      r.townCouncil = true;
      if (!fresh) ledger(L, day, `${full(r)} took a seat on the council of ${L.settlement.name}.`);
    }
    T.council = [...out.slice(0, Math.max(0, want - players.length)), ...players];
    if (!want) T.council = [];
    return T.council;
  }

  // Seat a fellow player (a citizen of the town) on the council, in place
  // of a townsperson.
  seatPlayer(L, pid, name) {
    const T = this.of(L.settlement.id);
    const ch = CHARTERS[T.charter];
    if (!ch.seats) return { ok: false, why: `${ch.name} has no council seats.` };
    if (T.council.some((c) => c.pid === pid)) return { ok: false, why: 'Already on the council.' };
    const npc = T.council.findIndex((c) => !c.pid);
    if (npc < 0 && T.council.length >= ch.seats) return { ok: false, why: 'Every seat is a player\'s already.' };
    if (npc >= 0) {
      const r = L.npcs[T.council[npc].idx];
      if (r) delete r.townCouncil;
      T.council.splice(npc, 1);
    }
    T.council.push({ pid, name });
    ledger(L, this.game.day, `${name} took a seat on the council of ${L.settlement.name}.`);
    this.tell(pid, `You have a seat on the council of ${L.settlement.name}. When it votes, you'll be asked (N opens the council).`, '#a0e8a0');
    return { ok: true };
  }

  unseatPlayer(L, pid) {
    const T = this.of(L.settlement.id);
    if (!T) return false;
    T.council = T.council.filter((c) => c.pid !== pid);
    this.seatCouncil(L, T, this.game.day);
    return true;
  }

  // ------------------------------------------------------------ the sitting
  // Every town, each morning at ten (see econ.mayorReview). The town's own
  // drafted laws at work; offers of office looked for; and, where a player
  // governs, the council's sitting. Whether the sitting was held (if so
  // the old mayor's review is not).
  daily(L, day, rng) {
    if (!L.econ) return false;
    if (L.settlement.deserted || L.settlement.condition === 'abandoned') {
      if (this.governs(L)) this.unseat(L, 'the town was abandoned', day);
      return false;
    }
    this.lawsDaily(L, day);
    this.paths(L, day, rng);
    const T = this.of(L.settlement.id);
    if (!T || !T.holder) return false;
    // (Round 125: the sitting's own day, whatever the clock says: a town
    // caught up after a long sleep or a long wait sits each day it missed.)
    this.dayNow = day;
    try {
      this.session(L, T, day, rng);
    } finally {
      this.dayNow = null;
    }
    return true;
  }

  session(L, T, day, rng) {
    const e = L.econ;
    const abs = day * DAY + SESSION;
    const who = whoOf(L, T);
    T.lastSession = day;
    T.today = { relief: 0, alms: 0, stipend: 0, decided: [] };
    // Keep the hall staffed and the seats filled.
    this.ensureSteward(L, day);
    this.seatCouncil(L, T, day);
    for (const k of ['captain', 'treasurer', 'magistrate']) if (T.offices[k] !== undefined && !this.officer(L, T, k)) delete T.offices[k];
    if (this.online(T.holder.pid)) {
      this.noteOpinions(T.holder.pid, L);
      this.noteRegard(L, T);
    }
    // 1. What was decided since the last sitting is carried out; what
    //    wasn't is left to the steward.
    const sent = T.agenda.filter((it) => !it.done && (it.state === 'sent' || it.state === 'voting')).length;
    if (sent) this.note(T.holder.pid, `${L.settlement.name} · The council sits: ${sent} matter${sent > 1 ? 's' : ''} put to the vote.`, '#a0e8ff');
    for (const it of T.agenda.slice()) {
      if (it.done) continue;
      if (it.state === 'sent' || it.state === 'voting') {
        const v = this.vote(L, T, it, it.choice, true);
        this.settle(L, T, it, v, day, true);
      }
      if (it.state === 'carried' && !it.done) this.carry(L, T, it, day, it.choice, 'you');
      else if (it.state === 'open' && it.until <= abs) this.lapse(L, T, it, day);
    }
    T.agenda = T.agenda.filter((it) => !it.done);
    // 2. The town's routine: relief, alms, feasts, the kitchen, the
    //    officers' work, the stipend.
    this.routine(L, T, day, rng, who);
    // 3. How the town takes it all.
    this.recordApproval(L, T, day);
    for (const f of FACTION_IDS) T.favour[f] = Math.round((T.favour[f] || 0) * 0.93 * 10) / 10;
    this.promisesDue(L, T, day);
    // 4. Being overruled: a recall, the temple, the guilds, an uprising,
    //    the realm; and the term's election.
    this.overrule(L, T, day, rng);
    if (!T.holder) return;
    this.term(L, T, day);
    this.realmDay(L, T, day, rng);
    if (!T.holder) return;
    // 5. The day's matters.
    this.table(L, T, day, abs);
    this.goalsCheck(L, T, day);
    void e;
  }

  // New matters for the agenda (and a crisis, now and then).
  table(L, T, day, abs, first = false) {
    const open = T.agenda.filter((q) => !q.crisis && !q.done && ['open', 'sent', 'voting'].includes(q.state));
    const busy = (key) => T.agenda.some((q) => q.key === key && !q.done) || (T.quiet[key] ?? -99) > day - 3;
    const specs = matters(this.sim, L, T, day).filter((q) => !busy(q.key)).sort((a, b) => b.prio - a.prio);
    const fresh = [];
    for (const spec of specs) {
      if (open.length >= MAX_OPEN) break;
      const it = this.addItem(T, spec, day, abs);
      open.push(it);
      fresh.push(it);
    }
    // (Round 125) A note in the corner for the one who governs.
    if (fresh.length) this.note(T.holder.pid, `${L.settlement.name}: ${fresh.length === 1 ? `a new matter: ${fresh[0].title}` : `${fresh.length} new matters: ${fresh[0].title} and more`} (N)`, '#ffd890');
    if (!first) {
      const c = crisisFor(this.sim, L, T, day);
      if (c && !busy(c.key)) this.crisis(L, T, c, day, abs);
    }
  }

  addItem(T, spec, day, abs) {
    const it = {
      id: T.seq++, key: spec.key, kind: spec.kind, title: spec.title, why: spec.why.filter(Boolean), by: spec.by || null, opts: spec.opts,
      order: spec.order || null, day, until: spec.until ?? (spec.hours ? abs + spec.hours * 60 : nextSession(abs + 1)), state: 'open', struck: [], crisis: spec.crisis || null, super: !!spec.super, mine: !!spec.mine,
    };
    T.agenda.push(it);
    return it;
  }

  crisis(L, T, spec, day, abs) {
    const it = this.addItem(T, spec, day, abs);
    // (Round 125) A crisis come up while the hours raced by (a long sleep,
    // a long wait, a town caught up): its hours count from now, so there's
    // time to answer it.
    const now = this.sim.abs;
    if (spec.hours && it.until < now + spec.hours * 60 * 0.5) it.until = now + spec.hours * 60;
    T.crisisDay = day;
    T.crises[spec.crisis] = day;
    ledger(L, day, `${spec.title}. ${spec.why[0]}`);
    this.tell(T.holder.pid, `CRISIS in ${L.settlement.name}: ${spec.title}. Decide within ${spec.hours} hours (N: the council).`, '#ff8070');
    this.note(T.holder.pid, `CRISIS in ${L.settlement.name}: ${spec.title}. ${spec.hours} hours to decide (N).`, '#ff8070');
    this.wake(T.holder.pid, `You're roused: a crisis in ${L.settlement.name} needs you (N).`);
    this.asPid(T.holder.pid, () => this.game.audio?.play('alarm'));
    return it;
  }

  // A matter you left: the steward decides, by your standing orders.
  lapse(L, T, it, day) {
    const st = this.stewardOf(L, T);
    let k = -1;
    if (it.order) {
      const [key, map] = Object.entries(it.order)[0];
      k = map[T.orders[key]] ?? -1;
    } else if (it.crisis) k = 0;
    // (A careless steward forgets the odd one.)
    // (Round 125: by their traits: a careless one, now and then; a
    // diligent one, never.)
    if (k >= 0 && !it.crisis && st && hasTrait(st, 'careless') && !hasTrait(st, 'diligent') && noise(it.id, day, st.idx) < -0.2) k = -1;
    if (k >= 0 && it.opts[k] && it.opts[k].off) k = it.opts.findIndex((o) => o.trivial);
    // (Nor what the council has voted down.)
    if (k >= 0 && it.struck.includes(k)) k = -1;
    if (k < 0) {
      it.done = true;
      it.outcome = 'set aside';
      T.quiet[it.key] = day;
      this.minute(T, day, it.title, 'set aside: left undecided');
      this.record(T, it, 'set aside', { choice: null });
      return null;
    }
    return this.carry(L, T, it, day, k, 'steward');
  }

  // A decision carried out.
  carry(L, T, it, day, k, by) {
    const opt = it.opts[k];
    if (!opt) return null;
    it.done = true;
    it.choice = k;
    it.outcome = by === 'steward' ? 'by standing order' : it.vote ? it.vote.state : 'decided';
    const text = this.apply(L, T, opt.fx || {}, day, it, by);
    const who = by === 'steward' ? `${(this.stewardOf(L, T) && full(this.stewardOf(L, T))) || 'The steward'}, by standing order,` : whoOf(L, T);
    if (text) ledger(L, day, `${who} ${text}`);
    this.minute(T, day, it.title, `${opt.label}${by === 'steward' ? ' (the steward, by your standing orders)' : ''}`);
    const vs = it.vote && it.vote.state;
    this.record(T, it, by === 'steward' ? 'standing' : vs === 'decreed' ? 'decreed' : vs === 'carried' ? 'carried' : 'decided', { aye: it.vote && it.vote.ballots && it.vote.ballots.length ? it.vote.aye : null, nay: it.vote && it.vote.ballots && it.vote.ballots.length ? it.vote.nay : null, by });
    if (it.by && FACTIONS[it.by] && !opt.trivial) T.favour[it.by] = clamp((T.favour[it.by] || 0) + 2, -FAVOUR_MAX, FAVOUR_MAX);
    T.quiet[it.key] = day;
    if (T.today) T.today.decided.push(it.title);
    return text;
  }

  minute(T, day, title, what) {
    T.minutes.push({ day, title, what });
    if (T.minutes.length > 40) T.minutes.shift();
  }

  // (Round 125) Coin drawn from the hall's chests by the one who governs:
  // the treasury's, and noted in the minutes (the guilds and the poor see
  // the books).
  drawn(sid, n) {
    const T = this.of(sid);
    if (!T || !T.holder || n <= 0) return;
    const day = this.game.day;
    const L = this.laid(T);
    const title = L ? this.title(L, T) : 'The head';
    this.minute(T, day, 'The coffers', `The ${title} drew ¤${n} from the treasury.`);
    T.drawnDay = day;
    T.drawn = (T.drawn || 0) + n;
    this.tell(T.holder.pid, `You draw ¤${n} from the town's coffers. It's in the minutes: the guilds and the poor will hear of it.`, '#ffd890');
    if (L) for (const f of ['merchants', 'poor']) T.favour[f] = clamp((T.favour[f] || 0) - Math.min(8, Math.ceil(n / 25)), -FAVOUR_MAX, FAVOUR_MAX);
  }

  // ------------------------------------------------------------ deciding
  // The current player decides a matter: put to the vote (or, away from the
  // hall, sent to the steward for the next sitting; under a protectorate,
  // decreed). { ok, state, vote }.
  decide(L, itemId, k) {
    const T = this.of(L.settlement.id);
    if (!T || !T.holder || T.holder.pid !== this.pid()) return { ok: false, why: 'Only the town\'s head can decide.' };
    const it = T.agenda.find((q) => q.id === itemId);
    if (!it || it.done || !['open'].includes(it.state)) return { ok: false, why: 'That\'s been decided.' };
    const opt = it.opts[k];
    if (!opt || it.struck.includes(k)) return { ok: false, why: 'The council has voted that down.' };
    if (opt.off) return { ok: false, why: `Not possible: ${opt.off}.` };
    const day = this.game.day;
    it.choice = k;
    // (A crisis is the head's to decide, there and then: the town can call
    // them to account after.)
    if (opt.trivial || CHARTERS[T.charter].vote === 'decree' || it.crisis) {
      it.state = 'carried';
      it.vote = opt.trivial || it.crisis ? null : { kind: 'decree', state: 'decreed', ballots: [] };
      if (it.crisis) this.carry(L, T, it, day, k, 'you');
      T.agenda = T.agenda.filter((q) => !q.done);
      return { ok: true, state: it.vote ? 'decreed' : 'decided' };
    }
    if (!this.inHall(L) && !it.crisis) {
      it.state = 'sent';
      return { ok: true, state: 'sent' };
    }
    const v = this.vote(L, T, it, k);
    if (v.state === 'waiting') {
      it.state = 'voting';
      it.vote = v;
      for (const b of v.ballots) if (b.pid && b.v === null) {
        this.show(b.pid, 'vote', { sid: L.settlement.id, id: it.id });
        this.note(b.pid, `${L.settlement.name} · A VOTE IS CALLED: ${it.title.replace(/\?$/, '')}: ${opt.label}`, '#a0e8ff');
        this.wake(b.pid, `You're roused: the council of ${L.settlement.name} is voting, and waits on you.`);
      }
      this.note(T.holder.pid, `${L.settlement.name} · Put to the vote: ${opt.label}. Waiting on ${v.ballots.filter((b) => b.pid && b.v === null).length} councillor(s).`, '#a0e8ff');
      return { ok: true, state: 'waiting', vote: v };
    }
    this.settle(L, T, it, v, day);
    return { ok: true, state: v.state, vote: v };
  }

  inHall(L) {
    const g = this.game;
    const s = g.currentSettlement;
    if (!s || s.id !== L.settlement.id) return false;
    const b = g.buildingAtPlayer ? g.buildingAtPlayer() : null;
    return !!b && b.type === 'townhall';
  }

  // The vote's outcome, acted on.
  settle(L, T, it, v, day, atSession = false) {
    it.vote = v;
    if (v.state === 'carried' || v.state === 'decreed') {
      it.state = 'carried';
      // (Round 125) How it went, for those who'd want to know: at a
      // sitting, or a vote that waited on players.
      if (v.state === 'carried' && (atSession || v.ballots.some((b) => b.pid))) for (const pid of this.voters(T, v)) this.note(pid, `${L.settlement.name} · CARRIED: ${it.title.replace(/\?$/, '')}: ${it.opts[it.choice].label} (${v.aye}-${v.nay})`, '#90e890');
      if (it.crisis && !atSession) this.carry(L, T, it, day, it.choice, 'you');
    } else {
      it.state = 'open';
      if (!it.struck.includes(it.choice)) it.struck.push(it.choice);
      const opt = it.opts[it.choice];
      if (!atSession) this.tell(T.holder.pid, `The council voted down "${opt.label}" (${v.aye} to ${v.nay}).`, '#ffb080');
      this.record(T, it, v.state === 'vetoed' ? 'vetoed' : 'defeated', { aye: v.aye, nay: v.nay });
      if (atSession || v.ballots.some((b) => b.pid)) for (const pid of this.voters(T, v)) this.note(pid, `${L.settlement.name} · ${v.state === 'vetoed' ? 'VETOED' : 'DEFEATED'}: ${it.title.replace(/\?$/, '')}: ${opt.label} (${v.aye}-${v.nay})`, '#ff9070');
      else ledger(L, day, `The council of ${L.settlement.name} voted down ${whoOf(L, T)}'s proposal: ${it.title.replace(/\?$/, '')}: ${opt.label.toLowerCase()} (${v.aye} to ${v.nay}).`);
      this.minute(T, day, it.title, `${opt.label}: ${v.state === 'vetoed' ? 'vetoed by the priest' : 'voted down'} (${v.aye} to ${v.nay})`);
      // Nothing left that the council would carry: it lapses at the sitting.
    }
    T.agenda = T.agenda.filter((q) => !q.done);
    return v;
  }

  // (Round 125) Whom a vote's result is news to: the head, and any player
  // who sat on it.
  voters(T, v) {
    const out = new Set();
    if (T.holder) out.add(T.holder.pid);
    for (const b of (v && v.ballots) || []) if (b.pid) out.add(b.pid);
    return [...out];
  }

  // A player councillor's vote on a matter waiting for them.
  cast(sid, itemId, aye) {
    const L = this.sim.layoutOf(sid);
    const T = this.of(sid);
    const it = T && T.agenda.find((q) => q.id === itemId);
    if (!it || it.state !== 'voting' || !it.vote) return false;
    const b = it.vote.ballots.find((q) => q.pid === this.pid());
    if (!b || b.v !== null) return false;
    b.v = aye ? 1 : 0;
    b.why = aye ? 'for it' : 'against it';
    this.tallyVote(T, it.vote);
    if (!it.vote.ballots.some((q) => q.pid && q.v === null)) this.finishVote(L, T, it);
    return true;
  }

  finishVote(L, T, it) {
    for (const b of it.vote.ballots) if (b.v === null) {
      b.v = -1;
      b.why = 'did not vote';
    }
    this.tallyVote(T, it.vote);
    this.settle(L, T, it, it.vote, this.game.day);
    this.show(T.holder.pid, 'voted', { sid: L.settlement.id, id: it.id });
  }

  // Put a choice to the vote, as the charter has it: { kind, state
  // (carried, defeated, vetoed, decreed, waiting), aye, nay, ballots }.
  vote(L, T, it, k, atSession = false) {
    const ch = CHARTERS[T.charter];
    const opt = it.opts[k];
    const day = this.game.day;
    const pv = preview(L, T, overOf(L, T, opt.fx || {}), CHARTERS, day);
    const need = it.super ? 2 / 3 : 0.5;
    const v = { kind: ch.vote, ballots: [], aye: 0, nay: 0, need, state: 'carried', at: this.sim.abs };
    const holderBallot = { who: T.holder.name, you: true, v: 1, w: 1, why: 'your proposal' };
    if (ch.vote === 'decree') {
      v.state = 'decreed';
      return v;
    }
    if (ch.vote === 'council' || ch.vote === 'guild' || ch.vote === 'temple') {
      v.ballots.push(holderBallot);
      for (const c of T.council) {
        if (c.pid) {
          const here = this.online(c.pid) && !atSession;
          v.ballots.push({ who: c.name, pid: c.pid, v: here ? null : -1, w: 1, why: here ? 'deciding' : 'away' });
          continue;
        }
        const r = L.npcs[c.idx];
        if (!r || !alive(r)) continue;
        const b = this.seatBallot(L, T, it, k, r, pv);
        if (ch.vote === 'guild') b.w = Math.max(1, Math.round((r.coins || 0) / 20));
        v.ballots.push(b);
      }
      if (ch.vote === 'guild') holderBallot.w = Math.max(1, Math.round(v.ballots.slice(1).reduce((n, b) => n + b.w, 0) / Math.max(1, v.ballots.length - 1)));
      // The priest's veto, under the temple.
      if (ch.vote === 'temple') {
        const pr = v.ballots.find((b) => b.idx !== undefined && L.npcs[b.idx] && L.npcs[b.idx].job === 'priest');
        if (pr && ((pv.by.clergy ?? 0) < -2 || (opt.fx && opt.fx.charter && opt.fx.charter !== 'theocracy'))) {
          pr.v = 0;
          pr.why = 'vetoes it';
          v.veto = pr.who;
        }
      }
    } else if (ch.vote === 'assembly') {
      for (const r of adults(L)) {
        const f = factionOf(r) || 'crafters';
        const u = (pv.by[f] || 0) / 6 + (T.regard[f] || 0) / 30 + this.taste(L, T, opt, r) + (opt.sense || 0) * 0.6 + noise(r.idx, it.id, k, 0xa55) * 0.6;
        v.ballots.push({ who: full(r), idx: r.idx, f, v: u > 0 ? 1 : 0, w: 1, crowd: true });
      }
      v.ballots.push(holderBallot);
    } else if (ch.vote === 'factions') {
      const M = members(L);
      for (const f of FACTION_IDS) {
        if (!M[f].length) continue;
        const d = pv.by[f] || 0;
        v.ballots.push({ who: FACTIONS[f].name, f, v: d > -1 ? 1 : 0, w: 1, why: d > -1 ? 'it does them no harm' : 'it costs them' });
      }
    }
    this.tallyVote(T, v);
    if (v.ballots.some((b) => b.v === null)) v.state = 'waiting';
    return v;
  }

  tallyVote(T, v) {
    let aye = 0;
    let nay = 0;
    for (const b of v.ballots) {
      if (b.v === 1) aye += b.w;
      else if (b.v === 0) nay += b.w;
    }
    v.aye = aye;
    v.nay = nay;
    if (v.state === 'waiting' && !v.ballots.some((b) => b.v === null)) v.state = 'carried';
    if (v.state === 'decreed' || v.ballots.some((b) => b.v === null)) return v;
    if (v.veto) v.state = 'vetoed';
    else {
      const total = aye + nay;
      // (A simple majority, the head's vote deciding a tie; two in every
      // three for the charter itself.)
      v.state = v.need > 0.5 ? (total && aye / total >= v.need - 1e-9 ? 'carried' : 'defeated') : aye >= nay ? 'carried' : 'defeated';
    }
    return v;
  }

  // How a councillor votes: their faction's good, the town's, what they
  // think of you, their own character, and any coin that's changed hands.
  seatBallot(L, T, it, k, r, pv) {
    const f = factionOf(r) || 'crafters';
    const opt = it.opts[k];
    const terms = [];
    const t = (v, why) => {
      terms.push({ v, why });
      return v;
    };
    let u = 0;
    // (Round 125) Their traits: the learned weigh the town before their
    // faction; the ambitious want your seat; the steadfast stand by you;
    // a bribe sways the grasping twice as far, and the honest not at all.
    const learned = hasTrait(r, 'learned');
    u += t(((pv.by[f] || 0) / 9) * (learned ? 0.6 : 1), (pv.by[f] || 0) >= 0 ? `good for the ${FACTIONS[f].name.toLowerCase()}` : `bad for the ${FACTIONS[f].name.toLowerCase()}`);
    u += t(((pv.overall || 0) / 15) * (learned ? 1.6 : 1), (pv.overall || 0) >= 0 ? 'good for the town' : 'bad for the town');
    if (hasTrait(r, 'ambitious')) u += t(-0.3, 'wants your seat');
    if (hasTrait(r, 'loyal')) u += t(0.3, 'stands by you');
    u += t(((T.loyal[r.idx] ?? 0) / 100) * 0.7, (T.loyal[r.idx] ?? 0) >= 0 ? 'thinks well of you' : 'thinks ill of you');
    u += t(this.taste(L, T, opt, r), 'their own convictions');
    if (opt.sense) u += t(opt.sense * (0.7 + (r.personality?.diligence ?? 0.5) * 0.8), 'the town needs it');
    if (T.bribed[`${it.id}:${r.idx}`] && !hasTrait(r, 'honest')) u += t(hasTrait(r, 'grasping') ? 1.8 : 0.9, 'paid for');
    u += noise(r.idx, it.id, k, 0xb07) * 0.35;
    terms.sort((a, b) => Math.abs(b.v) - Math.abs(a.v));
    const v = u > 0 ? 1 : 0;
    const why = (terms.find((q) => (q.v > 0) === (v === 1)) || terms[0]).why;
    return { who: full(r), idx: r.idx, f, v, w: 1, why, u };
  }

  // Someone's own leanings on a choice (beyond their faction's good).
  taste(L, T, opt, r) {
    const fx = opt.fx || {};
    const P = r.personality || {};
    let u = 0;
    const spend = (fx.spend || 0) + (fx.cost || 0) + (fx.feast || 0);
    if (spend) u -= (spend / Math.max(60, L.econ.treasury)) * (0.3 + (P.diligence ?? 0.5) * 0.4);
    if (fx.relief || fx.act === 'famine_buy' || fx.act === 'fever_heal' || (fx.budget && fx.budget.relief !== undefined)) u += ((P.kindness ?? 0.5) - 0.5) * 0.8;
    if (fx.defy || fx.act === 'crown_defy' || fx.act === 'secede') u += ((P.bravery ?? 0.5) - 0.55) * 1.2;
    if (fx.law) u += stance(r, fx.law.id) * (fx.law.on ? 1 : -1) * 0.5;
    if (fx.charter) u += fx.charter === 'autocracy' ? -1 : fx.charter === 'lordship' ? -0.6 : fx.charter === T.charter ? 0 : -0.15;
    return u;
  }

  // Win a councillor round with coin before a vote (it may come out).
  lobby(L, itemId, idx) {
    const T = this.of(L.settlement.id);
    const it = T && T.agenda.find((q) => q.id === itemId);
    const r = L.npcs[idx];
    if (!it || !r || !T.council.some((c) => c.idx === idx)) return { ok: false, why: 'Not a councillor.' };
    const key = `${it.id}:${idx}`;
    if (T.bribed[key]) return { ok: false, why: 'Already paid.' };
    const cost = 15 + Math.round((r.coins || 0) / 10);
    const p = this.game.player;
    if (countItem(p.inv, 'coin') < cost) return { ok: false, why: `That would take ¤${cost}.` };
    removeItem(p.inv, 'coin', cost);
    r.coins = (r.coins || 0) + cost;
    T.bribed[key] = this.game.day;
    // (Honest folk talk: an honest one takes it, and tells. Round 125.)
    const leak = hasTrait(r, 'honest') ? 0.6 : hasTrait(r, 'grasping') ? 0.05 : 0.12 + ((r.personality?.kindness ?? 0.5) > 0.7 ? 0.15 : 0);
    if ((hash4(idx, it.id, this.game.day, 0xb21) % 1000) / 1000 < leak) T.leak = { day: this.game.day, who: full(r), cost };
    return { ok: true, cost };
  }

  // ------------------------------------------------------------ effects
  // A decision carried out: what it does, and the ledger's words for it.
  apply(L, T, fx, day, it = null, by = 'you') {
    const e = L.econ;
    const s = L.settlement;
    const words = [];
    const sim = this.sim;
    if (fx.spend) e.treasury = Math.max(0, e.treasury - fx.spend);
    if (fx.tax !== undefined) {
      const cap = CHARTERS[T.charter].taxCap || 0.3;
      const was = e.tax;
      e.tax = Math.round(clamp(fx.tax, 0, cap) * 100) / 100;
      if (e.tax !== was) words.push(`${e.tax > was ? 'raised' : 'lowered'} taxes to ${pc(e.tax)}`);
    }
    if (fx.law) {
      const law = LAWS[fx.law.id];
      e.laws ||= {};
      if (!!e.laws[fx.law.id] !== fx.law.on && !byDecree(L, fx.law.id)) {
        e.laws[fx.law.id] = fx.law.on;
        words.push(fx.law.on ? `passed a new law: ${law.desc}` : `repealed the ${law.name.toLowerCase()}`);
        const reset = { armsBan: 'violence', curfew: 'night', poaching: 'poached', felling: 'felled', horseLaw: 'riding', sporeLaw: 'picked' }[fx.law.id];
        if (reset) e.recent[reset] = 0;
      }
    }
    if (fx.budget) for (const [k, v] of Object.entries(fx.budget)) {
      if (T.charter === 'commune' && k === 'relief' && v < 1) continue;
      if (T.budget[k] !== v) words.push(`set ${BUDGET[k].name.toLowerCase()} to ${BUDGET[k].levels[v].toLowerCase()}`);
      T.budget[k] = v;
      // (A level of the watch's pay: its own wage, not one set to the point.)
      if (k === 'watch') delete T.wage;
    }
    // (Round 125) The watch's pay set to the coin.
    if (fx.wage !== undefined) {
      const w = clamp(Math.round(fx.wage), WAGE.min, WAGE.max);
      if (T.wage !== w) words.push(`set the watch's pay at ¤${w} a day`);
      T.wage = w;
      T.budget.watch = wageLevel(w);
    }
    if (fx.fines) {
      words.push(`${fx.fines > e.fineScale ? 'raised' : 'eased'} fines (×${fx.fines})`);
      e.fineScale = fx.fines;
      if (fx.fines > 1) e.recent.thefts = 0;
      else e.recent.calm = 0;
    }
    if (fx.relief) {
      const r = feedHungry(L, day, whoOf(L, T), true);
      if (r.spent) words.push(`paid ¤${r.spent} to feed ${r.fed} hungry ${r.fed === 1 ? 'person' : 'folk'}`);
    }
    if (fx.feast) {
      e.treasury = Math.max(0, e.treasury - fx.feast);
      e.festival = day;
      sim.events.feast(L, day, fx.feast);
    }
    if (fx.build) {
      const cost = fx.cost || WORKS_COST[fx.build] || 120;
      const p = sim.works.startBuilding(L, fx.build, `, commissioned by ${whoOf(L, T)}`, false, cost);
      if (p) {
        e.treasury = Math.max(0, e.treasury - cost);
        words.push(`commissioned a new ${fx.build === 'shop' ? 'market hall' : fx.build} (¤${cost})`);
        T.built = (T.built || 0) + 1;
      } else if (sim.roads.waiting(L, 'build', { type: fx.build })) {
        words.push(`commissioned a new ${fx.build}, to be started when a lot is ready`);
        T.built = (T.built || 0) + 1;
      } else words.push(`wanted a new ${fx.build}, but the stores are short`);
    }
    if (fx.favour) for (const [f, v] of Object.entries(fx.favour)) T.favour[f] = clamp((T.favour[f] || 0) + v, -FAVOUR_MAX, FAVOUR_MAX);
    if (fx.defy) {
      T.defy[fx.defy] = day;
      words.push(`refused the realm's decree (${fx.defy === 'taxFloor' ? 'its least tax' : fx.defy})`);
    }
    if (fx.promise) T.promises.push({ ...fx.promise, text: fx.promise.kind === 'relief' ? 'Relief kept on' : fx.promise.kind, made: day, due: day + (fx.promise.days || 7), state: 'open', base: { tax: e.tax } });
    if (fx.charter) {
      this.reform(L, T, fx.charter, day);
      words.push(`reformed the charter: ${s.name} is governed as ${CHARTERS[fx.charter].short} now`);
    }
    if (fx.appoint) words.push(this.appoint(L, fx.appoint.office, fx.appoint.idx, day, true) || '');
    if (fx.act && ACTS[fx.act]) {
      const w = ACTS[fx.act](this, L, T, day, it, fx);
      if (w) words.push(w);
    }
    if (fx.realmVote !== undefined) this.realmBallot(L, T, fx.realmVote, it);
    void by;
    return words.filter(Boolean).length ? `${words.filter(Boolean).join('; ')}.` : null;
  }

  // A new charter: the seats refilled, the term begun again, and what the
  // charter itself requires.
  reform(L, T, id, day) {
    const was = T.charter;
    T.charter = id;
    const ch = CHARTERS[id];
    if (T.holder) T.holder.termEnd = ch.term && T.holder.how !== 'appointment' ? day + ch.term : null;
    this.seatCouncil(L, T, day, true);
    if (id === 'theocracy') {
      L.econ.laws ||= {};
      if (lawFits(L.settlement, 'templeTithe', true)) L.econ.laws.templeTithe = true;
    }
    if (id === 'commune' && T.budget.relief < 1) T.budget.relief = 1;
    if (ch.taxCap && L.econ.tax > ch.taxCap) L.econ.tax = ch.taxCap;
    if (id !== 'autocracy' && id !== 'lordship') T.unrest = 0;
    // (A lordship: how its holder is styled is theirs to choose.)
    if (id === 'lordship' && T.holder) {
      T.holder.style ||= 'Liege';
      this.show(T.holder.pid, 'style', { sid: L.settlement.id, styles: CHARTERS.lordship.styles, scope: 'town' });
    } else if (T.holder) T.holder.style = null;
    T.recall = null;
    ledger(L, day, `${L.settlement.name} has a new charter: it is governed as ${ch.short} now (it was ${CHARTERS[was].short}).`);
    if (T.holder) this.show(T.holder.pid, 'charter', { sid: L.settlement.id, charter: id, was });
    return ch;
  }

  // ------------------------------------------------------------ routine
  routine(L, T, day, rng, who) {
    const e = L.econ;
    const S = sums(this.sim, L, T);
    e.recent.calm = (e.recent.calm || 0) + 1;
    // Relief: the hungry fed (unless cut), and alms besides.
    if (T.budget.relief >= 1 && (S.hungry.length >= Math.max(2, S.pop * 0.12) || S.hungry.some((r) => r.hungry >= 2)) && e.treasury > 25) {
      const r = feedHungry(L, day, who);
      T.today.relief = r.spent;
    }
    if (T.budget.relief >= 2) {
      let n = 0;
      for (const r of members(L).poor) {
        if (e.treasury < 1 || n >= 16) break;
        r.coins = (r.coins || 0) + 1;
        e.treasury -= 1;
        n++;
      }
      T.today.alms = n;
    }
    // Feast days, often.
    if (T.budget.fetes === 2 && e.treasury > S.pop * 35 && day - (e.festival ?? -99) > 4 && !this.sim.events.upcoming(L).length) {
      const spend = Math.round(e.treasury * 0.12);
      e.treasury -= spend;
      e.festival = day;
      this.sim.events.feast(L, day, spend);
    }
    // The watch's pay (see econ.payWages), and its spirits.
    e.guardWage = T.wage ?? [4, 5, 7][T.budget.watch ?? 1];
    if (T.budget.watch !== 1) for (const r of S.living) if (r.job === 'guard') r.mood = clamp((r.mood ?? 0.55) + (T.budget.watch === 2 ? 0.02 : -0.02), 0, 1);
    // A kitchen with no money to buy food: a small grant.
    const k = kitchenOf(L);
    if (k && k.till < 10 && e.treasury > 60) {
      k.till += 20;
      e.treasury -= 20;
    }
    // The officers at their work.
    const cap = this.officer(L, T, 'captain');
    L.econ.captain = cap ? cap.idx : null;
    // (Round 125) How much stronger the watch counts for its captain.
    L.econ.captainBonus = cap ? Math.max(0, 1 + (hasTrait(cap, 'stern') ? 0.5 : 0) + (hasTrait(cap, 'brave') ? 1 : 0) - (hasTrait(cap, 'timid') ? 1 : 0)) : 0;
    const tr = this.officer(L, T, 'treasurer');
    // (Round 125: by their traits: shrewd, diligent or careless with it; a
    // grasping one skims, an honest one never.)
    e.taxBoost = tr ? 1 + Math.min(0.2, (tr.skills?.trading || 0) * 0.2 + (hasTrait(tr, 'shrewd') ? 0.08 : 0)) + (hasTrait(tr, 'diligent') ? 0.05 : 0) - (hasTrait(tr, 'careless') ? 0.05 : 0) : 1;
    if (tr && hasTrait(tr, 'grasping') && !hasTrait(tr, 'honest') && rng.chance(0.08) && e.taxY) {
      const n = Math.max(2, Math.round(e.taxY * 0.25));
      e.treasury = Math.max(0, e.treasury - n);
      tr.coins = (tr.coins || 0) + n;
      T.skimmed = (T.skimmed || 0) + n;
      if (T.skimmed >= 15 && !T.agenda.some((q) => q.crisis)) {
        this.crisis(L, T, scandal(L, T, `The treasurer, ${full(tr)}, has been skimming the tax: ¤${T.skimmed} gone from the books.`, tr.idx), day, day * DAY + SESSION);
        T.skimmed = 0;
      }
    }
    const mg = this.officer(L, T, 'magistrate');
    if (mg) {
      // (Round 125: by their traits.)
      const stern = hasTrait(mg, 'stern') || hasTrait(mg, 'grasping');
      const most = hasTrait(mg, 'learned') ? 1.3 : 1.6;
      if ((e.recent.thefts || 0) >= 2 && e.fineScale < most && stern) {
        e.fineScale = Math.round(Math.min(most, e.fineScale * 1.25) * 100) / 100;
        e.recent.thefts = 0;
        ledger(L, day, `The magistrate, ${full(mg)}, raised fines after a spate of thefts.`);
      } else if ((e.recent.calm || 0) >= (stern ? 9 : hasTrait(mg, 'merciful') ? 3 : 5) && e.fineScale > (stern ? 1 : 0.85)) {
        e.fineScale = Math.max(stern ? 1 : 0.85, Math.round(e.fineScale * 0.85 * 100) / 100);
        e.recent.calm = 0;
        ledger(L, day, `The magistrate, ${full(mg)}, eased the fines: the streets have been calm.`);
      }
    }
    // A bribe that came out.
    if (T.leak && !T.agenda.some((q) => q.crisis)) {
      this.crisis(L, T, scandal(L, T, `Word is out that ${T.leak.who} took ¤${T.leak.cost} to vote ${whoOf(L, T)}'s way.`), day, day * DAY + SESSION);
      T.leak = null;
    }
    // The head's pay.
    const pay = CHARTERS[T.charter].stipend;
    if (pay && e.treasury >= pay + 10) {
      e.treasury -= pay;
      T.today.stipend = pay;
      const got = this.asPid(T.holder.pid, () => {
        addItem(this.game.player.inv, 'coin', pay + T.purse);
        return true;
      });
      if (got) T.purse = 0;
      else T.purse += pay;
    }
    // (Under a protectorate: unrest, when the town's unhappy.)
    if (T.charter === 'autocracy') T.unrest = clamp((T.unrest || 0) + ((T.lastOverall ?? 50) < 30 ? 0.5 : -0.25), 0, 5);
    // (A lordship's people are slower to rise: it's how things have
    // always been.)
    if (T.charter === 'lordship') T.unrest = clamp((T.unrest || 0) + ((T.lastOverall ?? 50) < 25 ? 0.3 : -0.25), 0, 5);
  }

  // The town's drafted laws, at work (in any town that has them, governed
  // or not).
  lawsDaily(L, day) {
    const e = L.econ;
    const laws = e.laws || {};
    const people = adults(L);
    if (laws.alms && !this.governs(L)) {
      let n = 0;
      for (const r of people) {
        if (factionOf(r) !== 'poor' || e.treasury < 1 || n >= 16) continue;
        r.coins = (r.coins || 0) + 1;
        e.treasury -= 1;
        n++;
      }
    }
    if (laws.marketDay && this.marketDay(L, day)) {
      const stalls = people.filter((r) => ['merchant', 'farmer', 'fisher', 'baker', 'tailor', 'carpenter', 'blacksmith', 'trapper', 'herbalist'].includes(r.job)).length;
      e.treasury += stalls;
      for (const r of people) if (['merchant', 'farmer', 'fisher'].includes(r.job)) r.coins = Math.max(0, (r.coins || 0) - 1);
      if (stalls) ledger(L, day, `Market day in ${L.settlement.name}: ${stalls} stalls in the square (¤${stalls} to the treasury).`);
    }
    if (laws.militia && (day + L.settlement.id) % 7 === 0) {
      let n = 0;
      for (const r of people) if (r.age === 'adult' && (r.coins || 0) >= 1) {
        r.coins--;
        n++;
      }
      e.treasury += Math.floor(n / 2);
    }
    if (laws.templeTithe) {
      const priest = people.find((r) => r.job === 'priest');
      let got = 0;
      for (const r of people) if (r !== priest && (r.coins || 0) >= 4) {
        r.coins--;
        got++;
      }
      if (priest) {
        priest.coins = (priest.coins || 0) + got;
        // The priest feeds the hungry from it.
        for (const r of people) {
          if ((r.hungry || 0) < 1 || priest.coins < 3) continue;
          priest.coins -= 3;
          r.fed = Math.max(r.fed || 0, 1);
          r.hungry = Math.max(0, r.hungry - 1);
          r.mood = clamp((r.mood ?? 0.55) + 0.03, 0, 1);
        }
      } else e.treasury += got;
      for (const r of people) if (factionOf(r) === 'clergy') r.mood = clamp((r.mood ?? 0.55) + 0.01, 0, 1);
    }
    if (laws.guildDues) {
      for (const r of people) if (['merchants', 'crafters'].includes(factionOf(r)) && (r.coins || 0) >= 2) {
        r.coins--;
        e.treasury++;
      }
    }
  }

  marketDay(L, day = this.sim.today()) {
    return (day + L.settlement.id) % 7 === 3;
  }

  // ------------------------------------------------------------ approval
  recordApproval(L, T, day) {
    const A = approvals(L, T, {}, CHARTERS, day);
    T.lastApproval = Object.fromEntries(FACTION_IDS.map((f) => [f, A.by[f].v]));
    T.counts = Object.fromEntries(FACTION_IDS.map((f) => [f, A.by[f].n]));
    T.lastOverall = A.overall;
    const last = T.hist[T.hist.length - 1];
    if (!last || last.day !== day) T.hist.push({ day, overall: A.overall, treasury: Math.floor(L.econ.treasury), by: { ...T.lastApproval } });
    else Object.assign(last, { overall: A.overall, treasury: Math.floor(L.econ.treasury), by: { ...T.lastApproval } });
    if (T.hist.length > 21) T.hist.shift();
    return A;
  }

  approvals(L, T = this.of(L.settlement.id)) {
    return approvals(L, T, {}, CHARTERS, this.game.day);
  }

  // What the holder's own standing with each faction adds (person to
  // person), and the councillors' loyalty.
  noteRegard(L, T) {
    const pid = T.holder.pid;
    const M = members(L);
    for (const f of FACTION_IDS) {
      if (!M[f].length) continue;
      const avg = M[f].reduce((n, r) => n + this.opinionOf(pid, L, r), 0) / M[f].length;
      T.regard[f] = Math.round(clamp((avg / 100) * 15, -15, 15) * 10) / 10;
    }
    for (const c of T.council) if (!c.pid && L.npcs[c.idx]) T.loyal[c.idx] = this.opinionOf(pid, L, L.npcs[c.idx]);
  }

  // Promises come due: kept, or broken.
  promisesDue(L, T, day) {
    for (const p of T.promises) {
      if (p.state !== 'open') continue;
      const kept = this.promiseKept(L, T, p);
      if (!kept && day < p.due) continue;
      p.state = kept ? 'kept' : 'broken';
      const fac = FACTIONS[p.f] ? p.f : null;
      if (kept) {
        if (fac) T.favour[fac] = clamp((T.favour[fac] || 0) + 8, -FAVOUR_MAX, FAVOUR_MAX);
        ledger(L, day, `${whoOf(L, T)} kept a promise to the ${fac ? FACTIONS[fac].name.toLowerCase() : 'town'}: ${p.text.toLowerCase()}.`);
      } else {
        if (fac) T.favour[fac] = clamp((T.favour[fac] || 0) - 12, -FAVOUR_MAX, FAVOUR_MAX);
        for (const f of FACTION_IDS) T.favour[f] = clamp((T.favour[f] || 0) - 2, -FAVOUR_MAX, FAVOUR_MAX);
        ledger(L, day, `${whoOf(L, T)} broke a promise to the ${fac ? FACTIONS[fac].name.toLowerCase() : 'town'}: ${p.text.toLowerCase()}.`);
        this.tell(T.holder.pid, `You broke your promise to the ${fac ? FACTIONS[fac].name.toLowerCase() : 'town'} (${p.text.toLowerCase()}). They won't forget it soon.`, '#ff9070');
      }
    }
  }

  promiseKept(L, T, p) {
    const e = L.econ;
    switch (p.kind) {
      case 'tax': return e.tax <= (p.base ? p.base.tax : e.tax) - 0.02 + 1e-9;
      case 'relief': return T.budget.relief >= 1 && this.game.day >= p.due;
      case 'watch': return T.budget.watch >= 2;
      case 'works': return (T.built || 0) > (p.built || 0);
      case 'feast': return (e.festival ?? -99) >= p.made;
      case 'law': return p.law ? lawOn(L, p.law) !== !!(p.wasOn) : false;
      default: return false;
    }
  }

  // ------------------------------------------------------------ overruled
  overrule(L, T, day, rng) {
    const ch = CHARTERS[T.charter];
    const A = T.lastApproval || {};
    const overall = T.lastOverall ?? 50;
    T.lowDays = overall < 32 ? (T.lowDays || 0) + 1 : 0;
    T.highDays = overall >= 75 ? (T.highDays || 0) + 1 : 0;
    // A recall petition.
    if (ch.recall) this.recallDay(L, T, day, rng);
    if (!T.holder) return null;
    // The temple's faith in its hierarch.
    if (T.charter === 'theocracy') {
      T.templeDays = (A.clergy ?? 50) < 25 ? (T.templeDays || 0) + 1 : 0;
      if (T.templeDays === 3) this.tell(T.holder.pid, `The clergy of ${L.settlement.name} are losing faith in you.`, '#ffb080');
      if (T.templeDays >= 5) return this.unseat(L, 'the temple withdrew its blessing', day);
    }
    // The guild masters.
    if (T.charter === 'guild') {
      const M = T.counts || {};
      const g = ((A.merchants ?? 50) * (M.merchants || 0) + (A.crafters ?? 50) * (M.crafters || 0)) / Math.max(1, (M.merchants || 0) + (M.crafters || 0));
      T.guildDays = g < 30 ? (T.guildDays || 0) + 1 : 0;
      if (T.guildDays === 3) this.tell(T.holder.pid, `The guild masters of ${L.settlement.name} are talking of replacing you.`, '#ffb080');
      if (T.guildDays >= 5) return this.unseat(L, 'the guild masters voted you out', day);
    }
    // An appointee the realm thinks has lost the town.
    if (T.holder.how === 'appointment' && T.lowDays >= 5) return this.unseat(L, `dismissed by ${L.settlement.civ ? authority(L.settlement.civ) : 'the realm'}, the town being against you`, day);
    // A protectorate risen against.
    if ((T.charter === 'autocracy' || T.charter === 'lordship') && (T.unrest || 0) >= 3.5 && !T.agenda.some((q) => q.key === 'crisis:uprising')) this.crisis(L, T, uprising(L, T), day, day * DAY + SESSION);
    return null;
  }

  recallDay(L, T, day, rng) {
    const ch = CHARTERS[T.charter];
    const R = T.recall;
    const people = adults(L);
    if (!R) {
      if (T.lowDays >= 3 && day - T.holder.since >= 5 && day - (T.recallDay ?? -99) >= 10) {
        // Led by the most aggrieved faction's best-known voice.
        const A = T.lastApproval || {};
        const f = FACTION_IDS.filter((q) => (T.counts || {})[q]).sort((a, b) => (A[a] ?? 50) - (A[b] ?? 50))[0];
        const lead = people.filter((r) => factionOf(r) === f && !r.steward).sort((a, b) => respect(b) - respect(a))[0];
        if (!lead) return;
        T.recall = { start: day, end: day + 5, f, by: lead.idx, signers: [lead.idx], need: Math.max(3, Math.ceil(people.length * ch.recall)), phase: 'petition' };
        T.recallDay = day;
        ledger(L, day, `${full(lead)} is gathering names to recall ${whoOf(L, T)}: ${T.recall.need} are needed by day ${day + 5}.`);
        this.tell(T.holder.pid, `${full(lead)} of the ${FACTIONS[f].name.toLowerCase()} has started a petition to recall you! (N: the council)`, '#ff8070');
        this.addItem(T, {
          key: 'recall', kind: 'recall', prio: 9, by: f, title: 'A petition to recall you',
          why: [`${full(lead)} is going door to door: ${T.recall.need} names and the town votes on whether you stay.`, `The ${FACTIONS[f].name.toLowerCase()} want: ${this.wishOf(L, T, f)}.`],
          opts: [
            { label: `Give the ${FACTIONS[f].name.toLowerCase()} what they want`, fx: { ...this.wishFx(L, T, f), favour: { [f]: 6 }, act: 'recall_concede' } },
            { label: `Pay ${full(lead).split(' ')[0]} to drop it (¤30)`, fx: { spend: 0, act: 'recall_buy' }, note: 'from your own purse; it may get out' },
            { label: 'Let it run', fx: {}, trivial: true },
          ],
          until: day * DAY + SESSION + 5 * DAY,
        }, day, day * DAY + SESSION);
      }
      return;
    }
    if (R.phase === 'petition') {
      const A = T.lastApproval || {};
      for (const r of people) {
        if (R.signers.includes(r.idx)) continue;
        const a = A[factionOf(r)] ?? 50;
        if (a < 42 && rng.chance((60 - a) / 90)) R.signers.push(r.idx);
      }
      if (R.signers.length >= R.need) {
        R.phase = 'vote';
        R.voteDay = day + 2;
        ledger(L, day, `The petition to recall ${whoOf(L, T)} has ${R.signers.length} names: the town votes on day ${R.voteDay} whether ${T.holder.name} stays.`);
        this.tell(T.holder.pid, `The recall petition has its ${R.need} names. ${L.settlement.name} votes on day ${R.voteDay}: win the town back before then!`, '#ff8070');
      } else if (day >= R.end) {
        ledger(L, day, `The petition to recall ${whoOf(L, T)} fell short (${R.signers.length} of ${R.need} names).`);
        T.recall = null;
        T.agenda = T.agenda.filter((q) => q.key !== 'recall');
      }
      return;
    }
    if (R.phase === 'vote' && day >= R.voteDay) {
      const A = T.lastApproval || {};
      const t = [0, 0]; // [stay, go]
      for (const r of people) {
        const a = (A[factionOf(r)] ?? 50) + (T.loyal[r.idx] ?? 0) / 5 + noise(r.idx, day, 0x2ec) * 24;
        t[a < 45 ? 1 : 0]++;
      }
      const go = t[1] > t[0];
      T.recall = null;
      this.show(T.holder.pid, 'count', { sid: L.settlement.id, title: `Should ${T.holder.name} be recalled?`, names: ['Stay', 'Go'], t, win: go ? 1 : 0, you: 0, kind: 'recall' });
      ledger(L, day, `The town has voted on the recall, ${t[0]} to ${t[1]}: ${go ? `${T.holder.name} must go` : `${T.holder.name} stays`}.`);
      if (go) this.unseat(L, 'recalled by the town', day);
      else for (const f of FACTION_IDS) T.favour[f] = clamp((T.favour[f] || 0) + 3, -FAVOUR_MAX, FAVOUR_MAX);
    }
  }

  // What a faction wants (as a short line, and as a decision).
  wishOf(L, T, f) {
    const fx = this.wishFx(L, T, f);
    if (fx.tax !== undefined) return `lower taxes (${pc(fx.tax)})`;
    if (fx.law) return `${fx.law.on ? an(LAWS[fx.law.id].name.toLowerCase()) : `the ${LAWS[fx.law.id].name.toLowerCase()}`} ${fx.law.on ? 'passed' : 'thrown out'}`;
    if (fx.budget) {
      const [k, v] = Object.entries(fx.budget)[0];
      return `${BUDGET[k].name.toLowerCase()}: ${BUDGET[k].levels[v].toLowerCase()}`;
    }
    return 'to be listened to';
  }

  wishFx(L, T, f) {
    const e = L.econ;
    const floor = this.sim.realms ? this.sim.realms.taxFloor(L.settlement) : 0;
    if (e.tax - FACTIONS[f].tax >= 0.03 && e.tax - 0.02 >= floor - 1e-9) return { tax: Math.round((e.tax - 0.02) * 100) / 100 };
    let best = null;
    const M = members(L);
    for (const id of LAW_IDS) {
      if (!lawFits(L.settlement, id, true) || byDecree(L, id)) continue;
      const on = lawOn(L, id);
      const v = M[f].reduce((n, r) => n + stance(r, id), 0) / Math.max(1, M[f].length) * (on ? -1 : 1);
      if (v > 0.3 && (!best || v > best.v)) best = { id, on, v };
    }
    if (best) return { law: { id: best.id, on: !best.on } };
    for (const k of Object.keys(BUDGET)) if ((BUDGET[k].likes[f] || 0) >= 4 && (T.budget[k] ?? 1) < 2) return { budget: { [k]: (T.budget[k] ?? 1) + 1 } };
    return {};
  }

  // ------------------------------------------------------------ terms
  term(L, T, day) {
    const h = T.holder;
    if (!h.termEnd) return;
    const q = this.sim.causes.of(L.settlement.id);
    if (q && q.kind === 'office') return;
    if (day < h.termEnd - 4) return;
    if (q) {
      // (Something else is being voted on: the election waits for it.)
      h.termEnd = Math.max(h.termEnd, q.end + 2);
      return;
    }
    const me = { pid: h.pid, name: h.name, sitting: true };
    let rival = null;
    if (T.filed && T.filed.pid !== h.pid) rival = { pid: T.filed.pid, name: T.filed.name };
    else {
      // The most aggrieved faction puts someone up.
      const A = T.lastApproval || {};
      const facs = FACTION_IDS.filter((f) => (T.counts || {})[f]).sort((a, b) => (A[a] ?? 50) - (A[b] ?? 50));
      for (const f of facs) {
        const r = adults(L).filter((x) => factionOf(x) === f && !x.steward && x.age === 'adult' && x.job !== 'guard').sort((a, b) => respect(b) + (b.personality.bravery ?? 0.5) - respect(a) - (a.personality.bravery ?? 0.5))[0];
        if (r) {
          rival = { idx: r.idx };
          break;
        }
      }
    }
    if (!rival || (T.lastOverall ?? 50) >= 85) {
      h.termEnd = CHARTERS[T.charter].term ? day + 4 + CHARTERS[T.charter].term : null;
      h.terms = (h.terms || 1) + 1;
      ledger(L, day, `Nobody would stand against ${whoOf(L, T)}: ${h.name} is returned unopposed for another term.`);
      this.tell(h.pid, `Nobody stood against you: you're returned unopposed as ${this.title(L, T).toLowerCase()} of ${L.settlement.name}.`, '#a0e8a0');
      T.goals.term = T.goals.term ?? day;
      return;
    }
    const end = Math.max(day + 3, h.termEnd);
    this.sim.causes.office(L, day, [me, rival], new RNG(hash4(L.settlement.id, day, 0xe1e)), end);
    this.tell(h.pid, `Your term is nearly up: ${L.settlement.name} votes on day ${end + 1}. ${rival.pid ? rival.name : full(L.npcs[rival.idx])} stands against you.`, '#ffe070');
    if (rival.pid) this.tell(rival.pid, `The election in ${L.settlement.name} is called: you stand against ${h.name}. The town votes on day ${end + 1}.`, '#ffe070');
  }

  // ------------------------------------------------------------ offices
  candidates(L, k) {
    const T = this.of(L.settlement.id);
    const pool = adults(L).filter((r) => r.ruler === undefined && r.soldier === undefined && r.captive === undefined && !r.hired && (k === 'captain' ? r.job === 'guard' : r.job !== 'guard' || k === 'magistrate'));
    const score = {
      steward: (r) => respect(r) + (r.personality.diligence ?? 0.5) * 1.2,
      captain: (r) => (r.personality.bravery ?? 0.5) * 1.5 + (r.skills?.combat || 0),
      treasurer: (r) => (r.skills?.trading || 0) * 2 + (r.personality.kindness ?? 0.5) * 0.5,
      magistrate: (r) => (r.age === 'elder' ? 0.6 : 0) + (r.personality.kindness ?? 0.5) * 0.3 + respect(r) * 0.5,
    }[k];
    // (Round 125: how well their traits suit it, too.)
    const sc = (r) => score(r) + suits(k, r) * 0.5;
    return pool.filter((r) => !(k !== 'steward' && r.steward)).sort((a, b) => sc(b) - sc(a)).slice(0, 12).map((r) => ({ r, score: sc(r), stars: suits(k, r), traits: traitsOf(r), loyal: T ? T.loyal[r.idx] ?? null : null }));
  }

  appoint(L, k, idx, day = this.game.day, quiet = false) {
    const T = this.of(L.settlement.id);
    if (!T || !T.holder) return null;
    const r = L.npcs[idx];
    if (!r || !alive(r)) return null;
    const old = this.officer(L, T, k);
    if (old === r) return null;
    if (k === 'steward') {
      this.ensureSteward(L, day, true, r);
    } else {
      if (old) {
        if (k === 'captain') delete old.captain;
        const of = factionOf(old);
        if (of) T.favour[of] = clamp((T.favour[of] || 0) - 3, -FAVOUR_MAX, FAVOUR_MAX);
      }
      for (const q of OFFICE_IDS) if (q !== 'steward' && T.offices[q] === idx) delete T.offices[q];
      T.offices[k] = idx;
      if (k === 'captain') r.captain = true;
    }
    const f = factionOf(r);
    // (Round 125: one who's well liked, the more so; a merciful one, the
    // poor too.)
    if (f) T.favour[f] = clamp((T.favour[f] || 0) + (hasTrait(r, 'popular') ? 6 : 3), -FAVOUR_MAX, FAVOUR_MAX);
    if (hasTrait(r, 'merciful')) T.favour.poor = clamp((T.favour.poor || 0) + 2, -FAVOUR_MAX, FAVOUR_MAX);
    if (k === 'captain') T.favour.guards = clamp((T.favour.guards || 0) + 2, -FAVOUR_MAX, FAVOUR_MAX);
    this.sim.changeRep?.(r.ent || { rec: r, settlement: L.settlement }, 6, { why: 'office' });
    const text = `named ${full(r)} ${OFFICES[k].name.toLowerCase()}`;
    if (!quiet) ledger(L, day, `${whoOf(L, T)} ${text}.`);
    return text;
  }

  dismiss(L, k) {
    const T = this.of(L.settlement.id);
    const r = T && this.officer(L, T, k);
    if (!r || k === 'steward') return false;
    if (k === 'captain') delete r.captain;
    delete T.offices[k];
    const f = factionOf(r);
    if (f) T.favour[f] = clamp((T.favour[f] || 0) - (hasTrait(r, 'popular') ? 6 : 3), -FAVOUR_MAX, FAVOUR_MAX);
    this.sim.changeRep?.(r.ent || { rec: r, settlement: L.settlement }, -6, { why: 'office' });
    ledger(L, this.game.day, `${whoOf(L, T)} dismissed ${full(r)} as ${OFFICES[k].name.toLowerCase()}.`);
    return true;
  }

  setOrder(L, k, v) {
    const T = this.of(L.settlement.id);
    if (!T || !ORDERS[k] || !ORDERS[k].opts.some((o) => o[0] === v)) return false;
    T.orders[k] = v;
    return true;
  }

  // ------------------------------------------------------------ proposals
  // Something you put before the council yourself: a tax, a budget line, a
  // law, a new charter, breaking away from the realm.
  propose(L, kind, a, b) {
    const T = this.of(L.settlement.id);
    if (!T || !T.holder || T.holder.pid !== this.pid()) return { ok: false, why: 'Only the town\'s head can.' };
    const day = this.game.day;
    const abs = this.sim.abs;
    const e = L.econ;
    const s = L.settlement;
    let spec = null;
    if (kind === 'tax') {
      const floor = this.sim.realms.taxFloor(s);
      const cap = CHARTERS[T.charter].taxCap || 0.3;
      const v = Math.round(clamp(a, 0, cap) * 100) / 100;
      if (v === e.tax) return { ok: false, why: 'That\'s the rate already.' };
      const below = v < floor - 1e-9;
      const S = sums(this.sim, L, T);
      const sense = v > e.tax ? clamp((S.reserve - e.treasury) / Math.max(1, S.reserve), 0, 1) * 0.7 : e.treasury > S.pop * 35 ? 0.2 : -0.1;
      spec = { key: 'tax', kind: 'tax', title: `Set taxes at ${pc(v)}?`, why: [`Taxes are ${pc(e.tax)} now; the treasury holds ¤${Math.floor(e.treasury)} (the town should keep ¤${S.reserve} in hand).`, ...(below ? [`That's under the realm's least tax of ${pc(floor)}: it defies the decree.`] : [])], opts: [{ label: `Set them at ${pc(v)}`, fx: below ? { tax: v, defy: 'taxFloor' } : { tax: v }, sense }, { label: 'Withdraw it', fx: {}, trivial: true }] };
    } else if (kind === 'wage') {
      const w = clamp(Math.round(a), WAGE.min, WAGE.max);
      const now = T.wage ?? [4, 5, 7][T.budget.watch ?? 1];
      if (w === now) return { ok: false, why: 'That\'s their pay already.' };
      const g = residents(L).filter((r) => r.job === 'guard').length;
      spec = { key: 'budget:watch', kind: 'budget', title: `Pay the watch ¤${w} a day?`, why: [`Each guard is paid ¤${now} a day now: ¤${now * g} a day for ${g}. At ¤${w}, it would be ¤${w * g}.`, w > now ? 'Better paid, the watch is keener, and thinks better of you.' : 'Cheaper, but the watch will grumble.'], opts: [{ label: `Pay them ¤${w}`, fx: { wage: w } }, { label: 'Withdraw it', fx: {}, trivial: true }] };
    } else if (kind === 'budget') {
      if (T.charter === 'commune' && a === 'relief' && b < 1) return { ok: false, why: 'A commune can never cut relief.' };
      if ((T.budget[a] ?? 1) === b) return { ok: false, why: 'That\'s how it stands already.' };
      spec = { key: `budget:${a}`, kind: 'budget', title: `${BUDGET[a].name}: ${BUDGET[a].levels[b].toLowerCase()}?`, why: [BUDGET[a].about, `It stands at: ${BUDGET[a].levels[T.budget[a] ?? 1].toLowerCase()}.`], opts: [{ label: `Make it ${BUDGET[a].levels[b].toLowerCase()}`, fx: { budget: { [a]: b } } }, { label: 'Withdraw it', fx: {}, trivial: true }] };
    } else if (kind === 'law') {
      if (byDecree(L, a)) return { ok: false, why: 'That law is the realm\'s decree: no town can repeal it.' };
      const on = lawOn(L, a);
      const law = LAWS[a];
      spec = { key: `law:${a}`, kind: 'law', title: on ? `Throw out the ${law.name.toLowerCase()}?` : `Pass ${an(law.name.toLowerCase())}?`, why: [law.desc, `${pc(forChange(L, a, !on))} of the town would back it.`], opts: [{ label: on ? 'Throw it out' : 'Pass it', fx: { law: { id: a, on: !on } }, sense: clamp((forChange(L, a, !on) - 0.45) * 1.2, -0.3, 0.5) }, { label: 'Withdraw it', fx: {}, trivial: true }] };
    } else if (kind === 'charter') {
      if (a === T.charter) return { ok: false, why: 'That\'s the charter already.' };
      if (!charterFits(L, a)) return { ok: false, why: `${CHARTERS[a].name} needs a temple and a priest.` };
      spec = { key: 'charter', kind: 'charter', super: true, title: `Reform the charter: ${CHARTERS[a].name.toLowerCase()}?`, why: [`${s.name} is governed as ${CHARTERS[T.charter].short}.`, ...CHARTERS[a].rules, 'A charter is changed only by two in every three.'], opts: [{ label: `Reform it: ${CHARTERS[a].name.toLowerCase()}`, fx: { charter: a } }, { label: 'Withdraw it', fx: {}, trivial: true }] };
    } else if (kind === 'secede') {
      const civ = s.civ;
      if (!civ) return { ok: false, why: `${s.name} answers to no realm.` };
      if (this.sim.realms.isCapital(s)) return { ok: false, why: 'The realm\'s own capital can\'t break away from it.' };
      spec = { key: 'secede', kind: 'secede', super: true, title: `Break away from the ${civ.name.replace(/^The /, '')}?`, why: [`${s.name} would be a free state, and you its head.`, `The realm will call it treason, and take it badly.`, 'Only two in every three can carry it.'], opts: [{ label: 'Declare the town free', fx: { act: 'secede' } }, { label: 'Withdraw it', fx: {}, trivial: true }] };
    }
    if (!spec) return { ok: false, why: '?' };
    // (One of a kind at a time: a new proposal replaces the old.)
    T.agenda = T.agenda.filter((q) => !(q.key === spec.key && !q.done && q.state === 'open' && q.mine));
    spec.prio = 6;
    spec.mine = true;
    const it = this.addItem(T, spec, day, abs);
    return { ok: true, item: it };
  }

  // (Round 122) The town wants to break away from its realm: its head who
  // plays decides.
  secessionCall(L, day) {
    const T = this.of(L.settlement.id);
    if (!T || !T.holder || T.agenda.some((q) => q.key === 'secede' && !q.done)) return null;
    const civ = L.settlement.civ;
    const ruler = civ ? this.sim.realms.rulerName(civ) : null;
    return this.addItem(T, {
      key: 'secede', kind: 'secede', prio: 9, title: `${L.settlement.name} wants to break away`,
      why: [`The town has had enough of the ${civ ? civ.name.replace(/^The /, '') : 'realm'}${ruler ? ` and ${ruler}` : ''}: most would go it alone.`, 'Lead it out, and you head a free state; hold it, and the town will resent you for it.'],
      opts: [{ label: 'Declare the town free', fx: { act: 'secede' } }, { label: 'Keep the town in the realm', fx: { favour: Object.fromEntries(FACTION_IDS.map((f) => [f, -4])), act: 'stay' }, trivial: true }],
    }, day, day * DAY + SESSION);
  }

  // A petition a player brought, with its signatures, to a town another
  // player governs: it goes before their council.
  petitionItem(L, pet, name) {
    const T = this.of(L.settlement.id);
    if (!T || !T.holder) return null;
    const law = LAWS[pet.law];
    const M = members(L);
    let by = null;
    for (const f of FACTION_IDS) {
      if (!M[f].length) continue;
      const v = M[f].filter((r) => pet.signers.includes(r.idx)).length / M[f].length;
      if (!by || v > by.v) by = { f, v };
    }
    const f = by ? by.f : null;
    const day = this.game.day;
    const it = this.addItem(T, {
      key: `law:${pet.law}`, kind: 'law', prio: 7, by: f, title: `A petition: ${pet.enact ? 'pass' : 'repeal'} the ${law.name.toLowerCase()}?`,
      why: [`${name} and ${pet.signers.length} townsfolk have put their names to it.`, law.desc],
      opts: [
        { label: pet.enact ? 'Grant it: pass the law' : 'Grant it: repeal the law', fx: { law: { id: pet.law, on: pet.enact }, favour: f ? { [f]: 3 } : {} }, sense: 0.4 },
        { label: 'Refuse it', fx: { favour: f ? { [f]: -4 } : {} }, trivial: true },
      ],
    }, day, this.sim.abs);
    this.tell(T.holder.pid, `${name} has brought a petition before your council in ${L.settlement.name} (N).`, '#ffe070');
    return it;
  }

  // (For the console: a crisis of a kind, now, if it can come on.)
  crisisNow(L, T, day, kind) {
    const spec = crisisFor(this.sim, L, T, day, kind);
    return spec && spec.crisis === kind ? spec : null;
  }

  scandalSpec(L, T, what) {
    return scandal(L, T, what);
  }

  // ------------------------------------------------------------ the realm
  realmDay(L, T, day, rng) {
    const s = L.settlement;
    const civ = s.civ;
    if (!civ) return;
    const realms = this.sim.realms;
    // Defying the realm: it answers, once a week, harder each time.
    const live = Object.keys(T.defy).filter((k) => T.defy[k] !== undefined);
    if (T.defy.taxFloor !== undefined && L.econ.tax >= realms.taxFloor(s) - 1e-9) delete T.defy.taxFloor;
    // (Round 122) A realm a player rules: its ruler hears of it, and answers.
    if (live.length && realms.realm(civ).head && this.sim.crown) {
      if (realms.realm(civ).head !== T.holder.pid && !(T.defyGrace > day)) this.sim.crown.defiance(L, live[0], day);
    } else if (live.length && (day + s.id) % 7 === 0 && !(T.defyGrace > day)) {
      T.defyLevel = (T.defyLevel || 0) + 1;
      const capL = realms.capitalOf(civ) && this.sim.layoutOf(realms.capitalOf(civ).id);
      if (T.defyLevel === 1) {
        ledger(L, day, `A letter from ${authority(civ)}: ${s.name} is reminded of its duty to the realm's decrees.`);
        this.tell(T.holder.pid, `${cap(authority(civ))} has written: ${s.name} is to obey the realm's decrees.`, '#ffb080');
      } else if (T.defyLevel === 2) {
        const fine = Math.min(60, Math.round(L.econ.treasury * 0.2));
        L.econ.treasury -= fine;
        if (capL && capL.econ) capL.econ.treasury += fine;
        ledger(L, day, `${cap(authority(civ))} has fined ${s.name} ¤${fine} for defying the realm's decrees.`);
        if (T.holder.how === 'appointment') return this.unseat(L, `dismissed by ${authority(civ)} for defying the realm`, day);
      } else if (!T.agenda.some((q) => q.key === 'crisis:crown')) this.crisis(L, T, ultimatum(L, T, civ), day, day * DAY + SESSION);
    }
    // A seat on the realm's council (a realm ruled by one).
    if (formOf(civ) === 'council' && !T.realm.seat && !T.realm.offered && (T.lastOverall ?? 0) >= 55 && day - T.holder.since >= 7 && T.charter !== 'autocracy') {
      T.realm.offered = day;
      this.tell(T.holder.pid, `The council of the ${civ.name.replace(/^The /, '')} offers you a seat among them (N: the council, Realm).`, '#a0e8ff');
    }
    // A realm council vote waiting on you.
    const RV = this.realmVotes[civ.id];
    if (RV && day > RV.day) this.realmResolve(civ, day);
    // Heading a realm of your own: towns may swear themselves to it (see
    // politics.fealty), and the realm's decrees are yours to set.
    void rng;
  }

  // Ask the realm for something. { ok, granted, text }.
  petition(L, kind) {
    const T = this.of(L.settlement.id);
    const s = L.settlement;
    const civ = s.civ;
    const realms = this.sim.realms;
    if (!T || !T.holder || !civ) return { ok: false, why: 'No realm to petition.' };
    const R = realms.realm(civ);
    if (R.head === T.holder.pid) return { ok: false, why: 'The realm is yours.' };
    const day = this.game.day;
    const last = T.petitions[kind];
    const wait = kind === 'floor' ? 14 : 7;
    if (last !== undefined && day - last < wait) return { ok: false, why: `The realm heard you on that ${day - last} day${day - last === 1 ? '' : 's'} ago. (Ask again after day ${last + wait}.)` };
    T.petitions[kind] = day;
    // (Round 122) A realm another player rules: it goes to them.
    if (R.head && this.sim.crown) {
      if (this.sim.crown.realms[civ.id]?.agenda.some((q) => q.key === `petition:${s.id}:${kind}` && !q.done)) return { ok: false, why: 'Your petition is before the throne already.' };
      this.sim.crown.petitionFrom(L, kind, T.holder.name);
      return { ok: true, granted: null, pending: true, text: `Your petition goes to ${realms.rulerName(civ)}, who will answer it.` };
    }
    const ruler = realms.ruler(civ);
    const capS = realms.capitalOf(civ);
    const capL = capS && this.sim.layoutOf(capS.id);
    const kind_ = ruler ? ruler.personality.kindness ?? 0.5 : 0.5;
    const renown = Math.min(1, (this.sim.renown.get(s.id) || 0) / 30);
    const defying = Object.keys(T.defy).length > 0;
    const chance = clamp(0.25 + kind_ * 0.3 + renown * 0.2 + ((T.lastOverall ?? 50) - 50) / 200 - (defying ? 0.4 : 0), 0.05, 0.9);
    const yes = (hash4(s.id, day, kind.length, 0x9e7) % 1000) / 1000 < chance;
    const who = cap(authority(civ));
    let text;
    if (!yes) text = `${who} has declined ${s.name}'s petition${defying ? ', the town being in defiance of the realm' : ''}.`;
    else if (kind === 'aid') {
      const spare = capL && capL.econ ? capL.econ.treasury - residents(capL).length * 15 : 0;
      const n = Math.max(0, Math.min(80, Math.round(spare * 0.3)));
      if (n < 20) text = `${who} would help ${s.name}, but the realm's own coffers are empty.`;
      else {
        capL.econ.treasury -= n;
        L.econ.treasury += n;
        R.aid.push({ sid: s.id, day, kind: 'coins', amount: n });
        text = `${who} has sent ¤${n} in aid to ${s.name}, at the petition of ${whoOf(L, T)}.`;
      }
    } else if (kind === 'floor') {
      const FL = [0, 0.04, 0.06, 0.08, 0.1];
      const i = FL.indexOf(R.decrees.taxFloor);
      if (i <= 0) text = `${who} sets no least tax already.`;
      else {
        R.decrees.taxFloor = FL[i - 1];
        realms.proclaim(civ, day, `At the petition of ${whoOf(L, T)}, ${authority(civ)} has lowered the realm's least tax to ${pc(R.decrees.taxFloor)}.`);
        text = `${who} has lowered the realm's least tax to ${pc(R.decrees.taxFloor)}.`;
      }
    } else if (kind === 'tribute') {
      T.tributeCut = day + 14;
      text = `${who} has halved what ${s.name} sends to the capital, for a fortnight.`;
    } else if (kind === 'road') {
      const dip = this.sim.diplomacy;
      if (!capS || capS === s) text = 'The capital needs no road to itself.';
      else if (dip.roads.some((r) => (r.a === s.id && r.b === capS.id) || (r.b === s.id && r.a === capS.id))) text = `There's a road to ${capS.name} already.`;
      else if (!capL || capL.econ.treasury < 150 || !dip.startRoad(capS, s)) text = `${who} can't pay for a road just now.`;
      else {
        capL.econ.treasury -= 120;
        text = `${who} is paying for a road from ${capS.name} to ${s.name}, at the petition of ${whoOf(L, T)}.`;
      }
    }
    if (text && yes) ledger(L, day, text);
    if (yes) T.granted = (T.granted || 0) + 1;
    return { ok: true, granted: yes, text };
  }

  // Take the seat the realm's council offered.
  takeRealmSeat(L) {
    const T = this.of(L.settlement.id);
    const civ = L.settlement.civ;
    if (!T || !T.holder || !civ || !T.realm.offered) return { ok: false, why: 'No seat has been offered.' };
    T.realm.seat = true;
    this.sim.realms.proclaim(civ, this.game.day, `${whoOf(L, T)} of ${L.settlement.name} takes a seat on the council of the ${civ.name.replace(/^The /, '')}.`);
    T.goals.seat = T.goals.seat ?? this.game.day;
    return { ok: true };
  }

  // Those who sit on a realm's council from a town of theirs.
  realmSeats(civ) {
    return Object.values(this.towns).filter((T) => T.holder && T.realm.seat && this.game.world.ow.settlements[T.sid]?.civ === civ);
  }

  // The realm's ruler would change a decree: if any player sits on its
  // council, it's put to them (and the realm's own councillors) first.
  // `change`: { key, text, apply() }. Whether it was held for a vote.
  realmProposal(civ, change, day) {
    if (this.sim.crown && this.sim.crown.ruled(civ)) return false;
    const seats = this.realmSeats(civ);
    if (!seats.length || this.realmVotes[civ.id]) return false;
    this.realmVotes[civ.id] = { change, day, votes: {}, text: change.text };
    for (const T of seats) {
      const L = this.layout(T);
      this.addItem(T, {
        key: 'realmvote', kind: 'realmvote', prio: 8, by: 'realm', title: `The realm's council: ${change.title}`,
        why: [`${cap(authority(civ))} proposes: ${change.text}`, 'Your vote counts with the realm\'s own councillors. The council decides at tomorrow\'s sitting.'],
        opts: [{ label: 'Vote for it', fx: { realmVote: 1 }, trivial: true }, { label: 'Vote against it', fx: { realmVote: 0 }, trivial: true }],
      }, day, day * DAY + SESSION);
      this.tell(T.holder.pid, `The realm's council votes on: ${change.title} (N: the council).`, '#a0e8ff');
      void L;
    }
    return true;
  }

  realmBallot(L, T, v, it) {
    const civ = L.settlement.civ;
    const RV = civ && this.realmVotes[civ.id];
    if (!RV) return;
    RV.votes[T.holder.pid] = v;
    void it;
  }

  realmResolve(civ, day) {
    const RV = this.realmVotes[civ.id];
    if (!RV) return;
    delete this.realmVotes[civ.id];
    const realms = this.sim.realms;
    const R = realms.realm(civ);
    let aye = 0;
    let nay = 0;
    for (const v of Object.values(RV.votes)) {
      if (v === 1) aye++;
      else nay++;
    }
    for (const p of R.council) {
      const r = realms.recOf(p);
      if (!r || !alive(r)) continue;
      const u = noise(r.idx, day, RV.change.key.length, 0x7ea) + (RV.change.lean ? RV.change.lean(r) : 0);
      if (u > 0) aye++;
      else nay++;
    }
    const pass = aye >= nay;
    if (pass) RV.change.apply();
    realms.proclaim(civ, day, `The council of the ${civ.name.replace(/^The /, '')} has voted ${aye} to ${nay} ${pass ? 'for' : 'against'} it: ${RV.change.title.toLowerCase()}.`);
  }

  // Heading a realm of your own: set one of its decrees.
  realmDecree(L, key, v) {
    const civ = L.settlement.civ;
    const T = this.of(L.settlement.id);
    if (!civ || !T || !T.holder) return { ok: false };
    const R = this.sim.realms.realm(civ);
    if (R.head !== T.holder.pid) return { ok: false, why: 'The realm isn\'t yours to command.' };
    // (Round 122: the crown's own decree, when the realm is a crown's.)
    if (this.sim.crown && this.sim.crown.isRuler(civ, T.holder.pid)) {
      const w = key === 'tariff' ? this.sim.crown.decree(civ, 'tariff', !R.decrees.tariffOn.includes(v), v) : this.sim.crown.decree(civ, key, v);
      return { ok: !!w };
    }
    const day = this.game.day;
    const who = `${whoOf(L, T)}, head of the ${civ.name.replace(/^The /, '')}`;
    if (key === 'taxFloor') {
      R.decrees.taxFloor = v;
      this.sim.realms.proclaim(civ, day, v ? `By decree of ${who}: no town of the realm may tax less than ${pc(v)}.` : `${who} sets no least tax for the realm's towns.`);
    } else if (key === 'armsBan') {
      R.decrees.armsBan = !!v;
      this.sim.realms.proclaim(civ, day, v ? `By decree of ${who}: drawn weapons are forbidden in every town of the realm.` : `${who} has lifted the realm's weapons ban.`);
    } else if (key === 'tariff') {
      const other = this.game.world.ow.civs[v];
      if (!other) return { ok: false };
      const on = R.decrees.tariffOn.includes(v);
      R.decrees.tariffOn = on ? R.decrees.tariffOn.filter((q) => q !== v) : [...R.decrees.tariffOn, v];
      this.sim.realms.proclaim(civ, day, on ? `${who} has lifted the tariff on merchants of the ${other.name.replace(/^The /, '')}.` : `By decree of ${who}: merchants of the ${other.name.replace(/^The /, '')} pay a tariff on all they sell here.`);
    }
    return { ok: true };
  }

  // ------------------------------------------------------------ ambitions
  // What a head of the town might set their sights on, and how far along.
  goals(L, T = this.of(L.settlement.id)) {
    if (!T || !T.holder) return [];
    const s = L.settlement;
    const h = T.holder;
    const day = this.game.day;
    const ch = CHARTERS[T.charter];
    const civ = s.civ;
    const R = civ ? this.sim.realms.realm(civ) : null;
    const out = [];
    const span = ch.term || 30;
    out.push({ id: 'term', name: ch.term ? 'Win a second term' : 'Govern for thirty days', v: Math.min(1, (day - h.since) / span), done: T.goals.term !== undefined });
    out.push({ id: 'beloved', name: 'Beloved: approval 75 or more, 7 sittings running', v: Math.min(1, (T.highDays || 0) / 7), done: T.goals.beloved !== undefined });
    out.push({ id: 'coffers', name: 'A treasury of ¤1000', v: Math.min(1, L.econ.treasury / 1000), done: T.goals.coffers !== undefined });
    out.push({ id: 'grow', name: s.type === 'city' ? 'A city of 60 souls' : `Grow ${s.name} into a ${s.type === 'village' ? 'town' : 'city'}`, v: s.type === 'city' ? Math.min(1, residents(L).length / 60) : Math.min(0.95, residents(L).length / (s.type === 'village' ? 20 : 40)), done: T.goals.grow !== undefined });
    if (civ && R && !R.head) {
      if (formOf(civ) === 'council') out.push({ id: 'seat', name: 'A seat on the realm\'s council', v: T.realm.seat ? 1 : Math.min(0.9, (T.lastOverall ?? 0) / 55 * 0.9), done: T.goals.seat !== undefined });
      else out.push({ id: 'favour', name: 'The realm\'s favour: three petitions granted', v: Math.min(1, (T.granted || 0) / 3), done: T.goals.favour !== undefined });
      out.push({ id: 'free', name: `Lead ${s.name} to independence`, v: 0, done: T.goals.free !== undefined });
    } else if (R && R.head === h.pid) out.push({ id: 'realm', name: 'Three towns in your realm', v: Math.min(1, this.sim.realms.members(civ).length / 3), done: T.goals.realm !== undefined });
    else out.push({ id: 'free', name: `Keep ${s.name} free`, v: 1, done: true });
    return out;
  }

  goalsCheck(L, T, day) {
    for (const g of this.goals(L, T)) {
      if (g.done || g.v < 1) continue;
      T.goals[g.id] = day;
      ledger(L, day, `${whoOf(L, T)} has realised an ambition: ${g.name.toLowerCase()}.`);
      this.tell(T.holder.pid, `Ambition realised: ${g.name}!`, '#ffe070');
      this.asPid(T.holder.pid, () => this.sim.addRenown?.(L.settlement.id, 3, 'governing the town well'));
      this.asPid(T.holder.pid, () => this.game.audio?.play('fanfare'));
    }
  }

  // ------------------------------------------------------------ other paths
  // Offers of office looked for (each morning, in every town): the realm
  // appointing someone to a town without a head; a town in trouble
  // acclaiming someone it trusts.
  paths(L, day, rng) {
    const s = L.settlement;
    const T = this.of(s.id);
    if (T && T.holder) return;
    if (this.offers.some((o) => o.sid === s.id && o.until > this.sim.abs)) return;
    const players = this.game.seats ? this.game.seats.map((q) => (q.host ? 'host' : String(q.id))) : ['host'];
    const free = players.filter((pid) => !this.heldBy(pid));
    if (!free.length) return;
    const e = L.econ;
    // A town without a head, in a realm: its ruler may appoint someone.
    if (s.civ && e.mayorless !== null && e.mayorless !== undefined && !this.sim.realms.isCapital(s)) {
      for (const pid of free) {
        const ok = this.asPid(pid, () => {
          const home = this.sim.citizen && this.game.world.ow.settlements[this.sim.citizen.sid];
          if (!home || home.civ !== s.civ || this.game.isWanted(s.id) || isOutworlder(this.game.hero)) return false;
          return this.sim.goodStanding(home.id) || (this.sim.renown.get(home.id) || 0) >= 10;
        });
        if (ok && rng.chance(0.6)) return this.offer(pid, L, 'appointment', `${cap(authority(s.civ))} has written to you: ${s.name} is without a head, and the realm would have you govern it.`);
      }
    }
    // A town in trouble, someone it trusts in its streets.
    const trouble = (e.famineDays || 0) >= 4 || (e.riotDay !== undefined && day - e.riotDay <= 2) || (e.mayorless !== null && e.mayorless !== undefined);
    if (trouble && day - ((T && T.acclaimDay) ?? -99) >= 20) {
      for (const pid of free) {
        const ok = this.asPid(pid, () => {
          const here = this.game.currentSettlement;
          if (!here || here.id !== s.id || this.game.isWanted(s.id)) return false;
          // (An outworlder only by a town that's come to love them.)
          if (isOutworlder(this.game.hero)) return (this.sim.renown.get(s.id) || 0) >= 40;
          return !!this.sim.renownTitle(s.id);
        });
        if (ok) {
          this.town(L).acclaimDay = day;
          return this.offer(pid, L, 'acclaim', `The people of ${s.name}, in their trouble, are calling for you to lead them.`);
        }
      }
    }
    return null;
  }

  offer(pid, L, how, text, days = 2, extra = {}) {
    const o = { pid, sid: L.settlement.id, how, text, until: this.sim.abs + days * DAY, day: this.game.day, ...extra };
    this.offers.push(o);
    this.tell(pid, `${text} (N: answer)`, '#ffe070');
    this.show(pid, 'offer', { sid: o.sid, how, text });
    // (The townsfolk round you say so.)
    if (how === 'acclaim') this.asPid(pid, () => {
      const a = this.game.active.get(L.settlement.id);
      const p = this.game.player;
      for (const n of a ? a.npcs : []) if (!n.dead && Math.hypot(n.x - p.x, n.z - p.z) < 10 && n.say) n.say(['Lead us!', 'You! You could set this right!', 'We want you at the hall!'][n.rec.idx % 3], 3, '#ffe070');
    });
    return o;
  }

  offerFor(pid = this.pid()) {
    return this.offers.find((o) => o.pid === pid && o.until > this.sim.abs) || null;
  }

  answer(yes, pid = this.pid()) {
    const o = this.offerFor(pid);
    if (!o) return { ok: false };
    this.offers = this.offers.filter((q) => q !== o);
    const L = this.sim.layoutOf(o.sid);
    if (!L || !L.econ) return { ok: false };
    if (!yes) {
      ledger(L, this.game.day, `${this.game.playerName} declined ${o.how === 'heir' ? 'to be named heir' : o.how === 'crown' ? 'to lead the realm' : `to take office in ${L.settlement.name}`}.`);
      return { ok: true, declined: true };
    }
    // (Round 122) The realm's throne, or the promise of it.
    const civ = o.civ !== undefined ? this.game.world.ow.civs[o.civ] : null;
    if (o.how === 'crown' && civ && this.sim.crown) {
      this.sim.crown.crownPlayer(civ, pid, this.game.playerName, 'election', this.game.day);
      return { ok: true, L, crown: true };
    }
    if (o.how === 'heir' && civ && this.sim.crown) {
      this.sim.crown.heirs[civ.id] = { pid, name: this.game.playerName };
      this.sim.realms.proclaim(civ, this.game.day, `${this.sim.realms.rulerName(civ)} has named ${this.game.playerName} heir to the ${civ.name.replace(/^The /, '')}.`);
      return { ok: true, L, heir: true };
    }
    this.install(L, pid, this.game.playerName, o.how === 'governor' ? 'appointment' : o.how, this.game.day);
    return { ok: true, L };
  }

  // A coup: the watch asked, one guard at a time, whether it will stand
  // with you. { yes, text }.
  sound(L, guard) {
    const T = this.town(L);
    const r = guard.rec;
    const pid = this.pid();
    T.plot ||= { pid, day: this.game.day, guards: [] };
    if (T.plot.pid !== pid) return { yes: false, text: 'I\'ve heard that kind of talk before. I\'ll not hear it again.' };
    const op = this.sim.opinion(guard);
    const A = T.lastApproval || {};
    const unrest = L.econ.unrest || 0;
    const sitting = this.governs(L) ? (A.guards ?? 50) : 50 + ((L.econ.treasury || 0) > residents(L).length * 10 ? 10 : -10);
    const lean = op / 100 + unrest * 0.25 + (50 - sitting) / 100 + noise(r.idx, this.game.day, 0xc0f) * 0.3;
    if (lean > 0.35) {
      if (!T.plot.guards.includes(r.idx)) T.plot.guards.push(r.idx);
      return { yes: true, text: ['The town needs a firmer hand. When you move, I\'ll be with you.', 'Say the word, and the watch is yours. Some of us, anyway.', 'I\'ve had enough of how things are run. I\'m with you.'][r.idx % 3] };
    }
    // (Someone loyal may report it.)
    if (lean < -0.2 && (r.personality.kindness ?? 0.5) > 0.5) {
      T.plotNoticed = (T.plotNoticed || 0) + 1;
      this.sim.changeRep(guard, -10, { why: 'plot' });
    }
    return { yes: false, text: lean < -0.2 ? 'That\'s treason talk. Walk away, and I\'ll forget I heard it.' : 'I don\'t know. Times aren\'t that bad. Not yet.' };
  }

  plotStrength(L) {
    const T = this.of(L.settlement.id);
    const guards = residents(L).filter((r) => r.job === 'guard');
    const n = T && T.plot && T.plot.pid === this.pid() ? T.plot.guards.filter((i) => guards.some((g) => g.idx === i)).length : 0;
    return { n, of: guards.length, share: guards.length ? n / guards.length : 0 };
  }

  // Seize the hall: with half the watch behind you, it's yours (and the
  // town is ruled by decree); without, it's treason.
  seize(L) {
    const s = L.settlement;
    const day = this.game.day;
    const pid = this.pid();
    const P = this.plotStrength(L);
    const T = this.town(L);
    if (this.isHolder(s.id)) return { ok: false, why: 'It\'s yours already.' };
    const odds = clamp(P.share * 1.3 - (T.plotNoticed || 0) * 0.15, 0, 0.95);
    const ok = P.of > 0 && (hash4(s.id, day, 0x5e12) % 1000) / 1000 < odds;
    T.plot = null;
    T.plotNoticed = 0;
    if (!ok) {
      this.sim.justice.commit(s.id, 'assault', { known: true, sev: 'severe', desc: 'Plotting to seize the town hall' });
      ledger(L, day, `${this.game.playerName} tried to seize the town hall of ${s.name}, and the watch would not follow.`);
      return { ok: true, seized: false, odds };
    }
    this.install(L, pid, this.game.playerName, 'coup', day);
    for (const r of residents(L)) r.mood = clamp((r.mood ?? 0.55) - 0.06, 0, 1);
    return { ok: true, seized: true, odds };
  }

  // Lead settlers out of a crowded town to found a village: its first head,
  // once they're there (see founding.js).
  canLead(L) {
    const s = L.settlement;
    if (!this.sim.isCitizen(s.id)) return { ok: false, why: `Only a citizen of ${s.name} can lead its settlers.` };
    if (this.heldBy(this.pid())) return { ok: false, why: 'Not while you govern a town.' };
    if (this.sim.founding.parties.some((p) => !p.done)) return { ok: false, why: 'Settlers are already on the road somewhere.' };
    if (residents(L).length < 10) return { ok: false, why: `${s.name} has too few people to spare any.` };
    if (!this.sim.goodStanding(s.id) && !(this.sim.renown.get(s.id) || 0)) return { ok: false, why: 'Folk would want to know you better before they followed you.' };
    return { ok: true, cost: 100 };
  }

  lead(L) {
    const t = this.canLead(L);
    if (!t.ok) return t;
    const p = this.game.player;
    if (countItem(p.inv, 'coin') < t.cost) return { ok: false, why: `It would take ¤${t.cost} for tools, seed and timber.` };
    const party = this.sim.founding.found(L, this.game.day, new RNG(hash4(L.settlement.id, this.game.day, 0x1ead)), { leader: this.pid(), name: this.game.playerName });
    if (!party) return { ok: false, why: 'There\'s nowhere open within a few days\' walk to settle.' };
    removeItem(p.inv, 'coin', t.cost);
    return { ok: true, party };
  }

  // The settlers have reached their spot (see founding.advance): the
  // leader is the village's head, and writes its charter.
  founded(NL, party, day) {
    if (!party.leader) return;
    this.install(NL, party.leader, party.leaderName || 'the founder', 'founding', day, { charter: 'assembly', quiet: true });
    const T = this.of(NL.settlement.id);
    T.chooseCharter = true;
    this.show(party.leader, 'founding', { sid: NL.settlement.id });
    this.tell(party.leader, `Your settlers have reached the spot: ${NL.settlement.name} is begun, and you are its head. Write its charter (N).`, '#ffe070');
  }

  chooseCharter(L, id) {
    const T = this.of(L.settlement.id);
    if (!T || !T.chooseCharter || !charterFits(L, id)) return false;
    T.chooseCharter = false;
    if (id !== T.charter) this.reform(L, T, id, this.game.day);
    return true;
  }

  // ------------------------------------------------------------ each frame
  update() {
    const now = this.sim.abs;
    // Crises that weren't decided in time: the steward decides.
    for (const T of Object.values(this.towns)) {
      if (!T.holder || !T.agenda.length) continue;
      const L = this.laid(T);
      if (!L) continue;
      for (const it of T.agenda) {
        if (it.done) continue;
        if (it.crisis && it.state === 'open' && it.until <= now) {
          this.lapse(L, T, it, this.game.day);
          this.tell(T.holder.pid, `${L.settlement.name}: "${it.title}" wasn't decided in time; the steward acted by your standing orders.`, '#ffb080');
        } else if (it.state === 'voting' && it.vote && now - it.vote.at >= VOTE_WAIT) this.finishVote(L, T, it);
      }
      T.agenda = T.agenda.filter((q) => !q.done);
    }
    this.offers = this.offers.filter((o) => o.until > now);
    // Windows to open for whoever they're for (if they're here, with a
    // screen to show them on).
    for (const sh of this.shows.slice()) {
      const done = this.asPid(sh.pid, () => {
        const ui = this.game.ui;
        // (Not over an opening scene: once it's done. Round 125.)
        if (!ui || !ui.showOffice || this.game.player.dead || this.game.scene) return false;
        ui.showOffice(sh.kind, sh.data);
        return true;
      });
      if (done) this.shows.splice(this.shows.indexOf(sh), 1);
    }
    for (const n of this.notes.slice()) {
      const done = this.asPid(n.pid, () => {
        const ui = this.game.ui;
        if (!ui || !ui.notify || this.game.scene || this.game.player.dead) return false;
        ui.notify(n.text, null, n.color);
        return true;
      });
      if (done) this.notes.splice(this.notes.indexOf(n), 1);
    }
  }

  // Windows waiting to be opened for the current player.
  takeShows(pid = this.pid()) {
    const mine = this.shows.filter((q) => q.pid === pid);
    if (mine.length) this.shows = this.shows.filter((q) => q.pid !== pid);
    return mine;
  }

  // What shows on the HUD for the current player.
  hudLines() {
    const pid = this.pid();
    const T = this.councilOf(pid);
    const out = [];
    const o = this.offerFor(pid);
    if (o) out.push({ text: o.how === 'acclaim' ? 'ACCLAIMED · N: ANSWER' : 'OFFER OF OFFICE · N', color: Math.floor(this.sim.abs) % 2 ? '#ffe070' : '#ffd040' });
    if (!T || !T.holder) return out;
    const L = this.laid(T);
    if (!L) return out;
    const mine = T.holder.pid === pid;
    const cr = T.agenda.find((q) => q.crisis && !q.done && q.state === 'open');
    if (cr && mine) {
      const left = Math.max(0, cr.until - this.sim.abs);
      out.push({ text: `!! CRISIS ${Math.floor(left / 60)}h${String(Math.floor(left % 60)).padStart(2, '0')} · N`, color: '#ff7060', blink: true });
    }
    const n = T.agenda.filter((q) => !q.done && (mine ? q.state === 'open' && !q.crisis : q.state === 'voting')).length;
    const title = mine ? this.title(L, T) : 'Councillor';
    out.push({ text: `${title} · ${n ? `${n} matter${n > 1 ? 's' : ''} (N)` : 'N: council'}`.slice(0, 24), color: mine ? '#ffd070' : '#a0e8ff' });
    return out;
  }

  // ------------------------------------------------------------ kept
  serialize() {
    return { towns: this.towns, offers: this.offers, realmVotes: Object.fromEntries(Object.entries(this.realmVotes).map(([k, v]) => [k, { ...v, change: { key: v.change.key, title: v.change.title, text: v.change.text, redo: v.change.redo || null } }])), opCache: this.opCache || {} };
  }

  load(d) {
    if (!d) return;
    this.towns = d.towns || {};
    this.offers = d.offers || [];
    this.opCache = d.opCache || {};
    // (A realm vote under way: the change is the ruler's to propose again.)
    this.realmVotes = {};
    for (const T of Object.values(this.towns)) {
      T.agenda = (T.agenda || []).filter((q) => q.kind !== 'realmvote');
      T.bribed ||= {};
      T.petitions ||= {};
      T.realm ||= {};
      T.goals ||= {};
      T.quiet ||= {};
      T.crises ||= {};
      T.record ||= [];
    }
  }
}

const cap = (t) => t[0].toUpperCase() + t.slice(1);

// ------------------------------------------------------------ crisis acts
// What each crisis choice does when carried out (beyond its cost and the
// factions' favour, already applied). Returns the ledger's words.
const ACTS = {
  raid_pay: () => 'paid the raiders to leave the town be',
  raid_hire: (o, L, T, day) => raidOutcome(o, L, T, day, true),
  raid_fight: (o, L, T, day) => raidOutcome(o, L, T, day, false),
  raid_none: (o, L, T, day) => raided(o, L, T, day, 'barred the doors; the raiders came in the night'),
  famine_buy: (o, L, T, day) => {
    for (const r of residents(L)) if ((r.hungry || 0) >= 1) {
      r.inv ||= [];
      r.inv.push({ item: 'bread', count: 2 });
      r.hungry = 0;
      r.fed = Math.max(r.fed || 0, 1);
    }
    L.econ.famineDays = 0;
    return 'bought grain from the neighbours: the hungry are fed';
  },
  famine_ration: (o, L) => {
    let n = 0;
    for (const r of residents(L)) if ((r.hungry || 0) >= 2) {
      r.hungry = 1;
      n++;
    }
    L.econ.famineDays = Math.max(0, (L.econ.famineDays || 0) - 2);
    return `rationed the stores: ${n} of the hungriest fed`;
  },
  famine_pray: () => 'called the town to pray for a better harvest',
  fever_heal: (o, L) => {
    const h = residents(L).find((r) => r.job === 'herbalist');
    if (h) h.coins = (h.coins || 0) + 20;
    return 'paid for draughts for every house: the fever passed with no one lost';
  },
  fever_quarantine: (o, L, T, day) => feverDeaths(o, L, day, 0.25, 'shut the sick away'),
  fever_pray: (o, L, T, day) => feverDeaths(o, L, day, 0.5, 'called the town to pray'),
  fever_none: (o, L, T, day) => feverDeaths(o, L, day, 0.7, 'did nothing for the fever', 2),
  unrest_hear: () => 'heard the crowd out, and promised them relief',
  unrest_disperse: (o, L, T, day) => {
    const rng = new RNG(hash4(L.settlement.id, day, 0xd15));
    const hurt = residents(L).filter((r) => r.age !== 'child' && factionOf(r) === 'poor');
    if (hurt.length && rng.chance(0.5)) {
      const r = rng.pick(hurt);
      r.hp = Math.max(2, (r.hp ?? 12) - 6);
    }
    T.unrest = Math.max(0, (T.unrest || 0) - 1);
    return 'sent the watch to break up the crowd';
  },
  unrest_buy: (o, L, T, day) => {
    if ((hash4(L.settlement.id, day, 0xb0b) % 100) < 20) T.leak = { day, who: 'the crowd\'s ringleaders', cost: 40 };
    return 'paid the crowd\'s ringleaders to send everyone home';
  },
  scandal_confess: () => 'owned up to the scandal before the town',
  scandal_deny: (o, L, T, day) => {
    if ((hash4(L.settlement.id, day, 0xde9) % 100) < 45) {
      for (const f of FACTION_IDS) T.favour[f] = clamp((T.favour[f] || 0) - 8, -FAVOUR_MAX, FAVOUR_MAX);
      return 'denied the scandal, and was found out';
    }
    return 'denied the scandal, and was believed';
  },
  scandal_blame: (o, L, T, day, it, fx) => {
    const r = L.npcs[fx.who];
    if (!r) return null;
    for (const k of OFFICE_IDS) if (T.offices[k] === fx.who && k !== 'steward') delete T.offices[k];
    const f = factionOf(r);
    if (f) T.favour[f] = clamp((T.favour[f] || 0) - 6, -FAVOUR_MAX, FAVOUR_MAX);
    return `laid the blame on ${full(r)}, and dismissed them`;
  },
  crown_submit: (o, L, T) => {
    const floor = o.sim.realms.taxFloor(L.settlement);
    if (L.econ.tax < floor) L.econ.tax = floor;
    T.defy = {};
    T.defyLevel = 0;
    return 'submitted to the realm\'s decrees';
  },
  crown_pay: (o, L, T, day) => {
    const capS = o.sim.realms.capitalOf(L.settlement.civ);
    const capL = capS && o.sim.layoutOf(capS.id);
    if (capL && capL.econ) capL.econ.treasury += 100;
    T.defyGrace = day + 14;
    T.defyLevel = 1;
    return 'paid the realm ¤100 to look the other way';
  },
  crown_defy: (o, L, T, day) => {
    if ((T.lastOverall ?? 0) >= 55 && !o.sim.realms.isCapital(L.settlement)) return ACTS.secede(o, L, T, day);
    o.unseat(L, `deposed by ${authority(L.settlement.civ)}`, day);
    return null;
  },
  secede: (o, L, T, day) => {
    const old = L.settlement.civ;
    const res = o.sim.realms.secede(L, day, new RNG(hash4(L.settlement.id, day, 0x5ece)), null);
    if (!res) return null;
    // (Round 122) Its head is the free state's ruler: see crown.js.
    if (T.holder && o.sim.crown && !res.joined) o.sim.crown.crownPlayer(res.civ, T.holder.pid, T.holder.name, 'secession', day, { form: 'republic' });
    T.defy = {};
    T.defyLevel = 0;
    T.realm = {};
    T.goals.free = day;
    // (A realm another player ruled hears of it.)
    const OC = old && o.sim.crown ? o.sim.crown.of(old) : null;
    if (OC) o.tell(OC.holder.pid, `${L.settlement.name} has broken away from your realm!`, '#ff7060');
    return `declared ${L.settlement.name} free of the ${old ? old.name.replace(/^The /, '') : 'realm'}`;
  },
  stay: (o, L) => {
    L.econ.secedeVotes = 0;
    L.econ.unrest = Math.max(0, (L.econ.unrest || 0) - 0.5);
    return 'kept the town in the realm';
  },
  uprising_charter: (o, L, T, day) => {
    o.reform(L, T, 'council', day);
    return 'granted the town a charter, to quiet the rising';
  },
  uprising_crush: (o, L, T, day) => {
    if ((T.lastApproval?.guards ?? 50) >= 50) {
      T.unrest = 0;
      const rng = new RNG(hash4(L.settlement.id, day, 0xc705));
      const cands = residents(L).filter((r) => r.age === 'adult' && factionOf(r) === 'poor');
      if (cands.length && rng.chance(0.4)) o.sim.recordDeath(L, rng.pick(cands), 'the crushing of the rising', null, day);
      return 'had the watch crush the rising';
    }
    o.unseat(L, 'overthrown: the watch would not fight the town', day);
    return null;
  },
  uprising_yield: (o, L, T, day) => {
    o.unseat(L, 'stepped down before the rising', day);
    return null;
  },
  recall_concede: (o, L, T) => {
    if (T.recall) {
      T.recall.signers = T.recall.signers.slice(0, Math.ceil(T.recall.signers.length / 2));
      T.recall.end = Math.min(T.recall.end, o.game.day + 2);
    }
    return 'met the petitioners\' demands';
  },
  recall_buy: (o, L, T, day) => {
    const lead = T.recall && L.npcs[T.recall.by];
    const paid = o.asPid(T.holder.pid, () => {
      const p = o.game.player;
      if (countItem(p.inv, 'coin') < 30) return false;
      removeItem(p.inv, 'coin', 30);
      return true;
    });
    if (!paid || !lead) return 'could not pay the petitioners off';
    lead.coins = (lead.coins || 0) + 30;
    T.recall = null;
    if ((hash4(L.settlement.id, day, 0x2b1) % 100) < 30) T.leak = { day, who: full(lead), cost: 30 };
    return null;
  },
};

function raidOutcome(o, L, T, day, hired) {
  const S = sums(o.sim, L, T);
  const odds = raidOdds(L, S, hired);
  const rng = new RNG(hash4(L.settlement.id, day, 0xa1d));
  if (rng.chance(odds)) {
    for (const f of FACTION_IDS) T.favour[f] = clamp((T.favour[f] || 0) + 3, -FAVOUR_MAX, FAVOUR_MAX);
    if (!hired) T.favour.guards = clamp((T.favour.guards || 0) + 4, -FAVOUR_MAX, FAVOUR_MAX);
    const g = S.living.filter((r) => r.job === 'guard');
    if (!hired && g.length && rng.chance(0.3)) {
      const r = rng.pick(g);
      r.hp = Math.max(4, (r.hp ?? 24) - rng.int(4, 10));
    }
    if (T.holder) o.asPid(T.holder.pid, () => o.sim.addRenown?.(L.settlement.id, 1, 'seeing off the raiders'));
    return hired ? 'hired adventurers, who saw the raiders off' : 'called out the watch, which saw the raiders off';
  }
  return raided(o, L, T, day, hired ? 'hired adventurers, but the raiders got past them' : 'called out the watch, but the raiders broke through');
}

function raided(o, L, T, day, how) {
  const e = L.econ;
  const rng = new RNG(hash4(L.settlement.id, day, 0x4a1d));
  const loss = Math.min(60, Math.round(e.treasury * 0.15));
  e.treasury -= loss;
  e.recent.raids = (e.recent.raids || 0) + 1;
  e.recent.violence = (e.recent.violence || 0) + 1;
  for (const r of residents(L)) r.mood = clamp((r.mood ?? 0.55) - 0.06, 0, 1);
  const people = residents(L).filter((r) => r.age !== 'child');
  let dead = null;
  if (people.length && rng.chance(0.3)) {
    dead = rng.pick(people);
    o.sim.recordDeath(L, dead, 'a raid on the town', null, day);
  }
  return `${how}: ¤${loss} taken${dead ? `, and ${full(dead)} killed` : ''}`;
}

function feverDeaths(o, L, day, p, how, most = 1) {
  const rng = new RNG(hash4(L.settlement.id, day, 0xfe7e));
  const weak = residents(L).filter((r) => r.age === 'elder' || r.age === 'child');
  const lost = [];
  for (let i = 0; i < most && weak.length; i++) {
    if (!rng.chance(p)) continue;
    const r = weak.splice(rng.int(0, weak.length - 1), 1)[0];
    o.sim.recordDeath(L, r, 'the fever', null, day);
    lost.push(full(r));
  }
  return `${how}; ${lost.length ? `the fever took ${lost.join(' and ')}` : 'the fever passed, and nobody was lost'}`;
}

export { OTRAITS };
export { CHARTERS, CHARTER_IDS, FACTIONS, FACTION_IDS, BUDGET, stated, whoOf, sums, nextSession, residents };
