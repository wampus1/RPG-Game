// (Round 122) Ruling a realm. As a town's office is held (see office.js), so
// a realm's throne (or its speaker's chair, or its high elder's seat) can be
// a player's:
//   - breaking a town away from its realm makes you head of a free state;
//   - an heirless monarch may name you heir, and you're crowned when they
//     die; a realm ruled by a council may choose you, if you sit on it and
//     your town thinks well of you, or elect you speaker if you stand;
//   - holding the capital, with half its watch behind you, you can seize
//     the throne.
// Then the realm is yours to run from the crown window (N): its own matters
// every morning (what the privy council advises the realm decree, towns
// asking for aid or lighter tribute, roads, a quarrel worth a war, peace
// when it's offered, an alliance, a town on the brink of breaking away),
// its decrees (the least tax, the weapons ban, tariffs, the watch, the
// draft, the tribute every town sends), its towns (each one's loyalty to
// you, and why), its court (its form of government, its council, your
// heir, your title), and its neighbours (war, peace, alliances).
//   How the realm decides with you is its form's (see realmforms.js): a
//   monarch decrees; a republic's council votes; a clan moot or a merchant
//   league is the vote of its towns' heads (fellow players among them); a
//   holy realm's high priest can veto. And how it can be rid of you, too:
//   pretenders, a council's no confidence, the moot's, the towns'.
// The realm's old ruler stays on as your chancellor, who sees to whatever
// you leave by your standing orders.
//   With others playing: the heads of your realm's towns (players among
// them) bring their petitions to you, and their defiance of your decrees;
// you can offer a town's governorship to a fellow player, raise a town's
// head to a lordship, or depose them; another player ruling a neighbour
// answers your offers of alliance and peace.
import { alive, ledger, mayorOf, DAY } from './econ.js';
import { support } from './laws.js';
import { REALM_FORMS, FORM_IDS, formFromLegacy, renameFor } from './realmforms.js';
import { formOf, govOf, authority, shortTitle, rulerTitle, nameForm } from './realms.js';
import { full, SESSION, nextSession } from './agenda.js';
import { RNG, hash4, clamp } from '../util/rng.js';
import { countItem, removeItem, addItem } from '../game/inventory.js';
import { isOutworlder } from '../game/hero.js';

const FAVOUR_MAX = 30;
const MAX_OPEN = 4;
const SHARES = [0.06, 0.08, 0.1, 0.12, 0.14, 0.16];
export const FLOORS = [0, 0.04, 0.06, 0.08, 0.1];
export const WATCHES = ['light', 'standard', 'heavy'];
export const DRAFTS = ['none', 'elders', 'all'];
export const CROWN_ORDERS = {
  aid: { name: 'Towns in need', opts: [['ask', 'Ask me first', 'Ask me'], ['auto', 'Help them as the realm can', 'Help']] },
  roads: { name: 'Roads', opts: [['ask', 'Ask me first', 'Ask me'], ['auto', 'Build them as the realm can', 'Build']] },
  advice: { name: 'The council\'s advice', opts: [['leave', 'Leave things as they are', 'Leave'], ['heed', 'Heed it', 'Heed']] },
  pleas: { name: 'Pleas for lighter tribute', opts: [['refuse', 'Refuse them', 'Refuse'], ['grant', 'Grant them', 'Grant']] },
  crises: { name: 'In a crisis', opts: [['cautious', 'Play it safe', 'Cautious'], ['bold', 'Act boldly', 'Bold']] },
};
export const CROWN_ORDER_IDS = Object.keys(CROWN_ORDERS);

const pc = (v) => `${Math.round(v * 100)}%`;
const plain = (civ) => (civ ? civ.name.replace(/^The /, '') : 'realm');
const cap = (t) => (t ? t[0].toUpperCase() + t.slice(1) : t);
const noise = (...k) => (hash4(...k) % 1000) / 1000 - 0.5;
const residents = (L) => L.npcs.filter((r) => alive(r) && !r.away && !r.migrated && !r.visitor);

export class Crown {
  constructor(game, sim) {
    this.game = game;
    this.sim = sim;
    this.realms = {}; // civ id -> the realm's crown, when a player rules it
    this.heirs = {}; // civ id -> { pid, name }: a player a ruler has named heir
  }

  get office() {
    return this.sim.office;
  }

  civ(id) {
    return this.game.world.ow.civs[id] || null;
  }

  pid() {
    return this.office.pid();
  }

  R(civ) {
    return this.sim.realms.realm(civ);
  }

  // A realm a player rules?
  ruled(civ) {
    return !!(civ && this.R(civ) && this.R(civ).head);
  }

  of(civ) {
    if (!civ) return null;
    const C = this.realms[civ.id];
    return C && C.holder ? C : null;
  }

  rec(civ) {
    let C = this.realms[civ.id];
    if (!C) {
      C = this.realms[civ.id] = {
        civ: civ.id, holder: null, agenda: [], seq: 1, minutes: [], favour: {}, hist: [], orders: { aid: 'ask', roads: 'ask', advice: 'leave', pleas: 'refuse', crises: 'cautious' },
        lowDays: 0, quiet: {}, crisisDay: -99, crises: {}, past: [], purse: 0, lastLoyalty: null, lastOverall: null, relief: {}, trust: {}, granted: 0,
      };
    }
    return C;
  }

  // The realm a player rules.
  heldBy(pid) {
    for (const C of Object.values(this.realms)) if (C.holder && C.holder.pid === pid) return C;
    return null;
  }

  civOf(C) {
    return this.civ(C.civ);
  }

  capitalL(civ) {
    const s = this.sim.realms.capitalOf(civ);
    const L = s && this.game.world.layouts.get(s.id);
    return L && L.econ ? L : null;
  }

  title(civ) {
    return shortTitle(civ);
  }

  who(civ) {
    const R = this.R(civ);
    return `${shortTitle(civ)} ${R.headName || 'the ruler'}`;
  }

  // Under half a tribute, for a while (see realms.tribute).
  relieved(civ, sid, day) {
    const C = this.realms[civ.id];
    return !!(C && C.holder && (C.relief[sid] ?? -1) > day);
  }

  // ------------------------------------------------------------ loyalty
  // How loyal a town is to the crown (0 to 100), and why. `over`: the
  // realm as it would be (another tribute, least tax, ban; a war).
  loyalty(civ, L, over = {}, C = this.realms[civ.id]) {
    const R = this.R(civ);
    const e = L.econ;
    const s = L.settlement;
    const day = this.sim.today ? this.sim.today() : this.game.day;
    const why = [];
    const add = (v, text) => {
      if (Math.abs(v) >= 0.5) why.push({ v, text });
      return v;
    };
    let v = 55;
    const share = over.share ?? R.share;
    v += add(clamp((0.1 - share) * 150, -12, 8), share > 0.1 ? `tribute at ${pc(share)}` : 'light tribute');
    const floor = over.taxFloor ?? R.decrees.taxFloor ?? 0;
    if (floor) v += add(-floor * 80, `a least tax of ${pc(floor)}`);
    const ban = over.armsBan ?? R.decrees.armsBan;
    if (ban) v += add(support(L, 'armsBan') * 10, 'the weapons ban');
    if (R.aid.some((a) => a.sid === s.id && day - a.day <= 10)) v += add(10, 'aid from the crown');
    if (C && (C.relief[s.id] ?? -1) > day) v += add(6, 'lighter tribute');
    if (R.capital === s.id) v += add(8, 'the seat of the realm');
    const war = this.sim.war;
    if (war) {
      const w = war.weariness(civ);
      if (w) v += add(-w * 25, 'a long war');
      else if (over.war) v += add(-6, 'a war to come');
    }
    if (e.unrest) v += add(-Math.min(20, e.unrest * 8), 'restless');
    if ((e.famineDays || 0) >= 3) v += add(-Math.min(12, e.famineDays * 2), 'hunger');
    const form = REALM_FORMS[over.form || govOf(civ)];
    if (form && form.loyalty) v += add(form.loyalty, `governed as a ${form.name.toLowerCase()}`);
    const fav = (C ? C.favour[s.id] || 0 : 0) + ((over.favour && over.favour[s.id]) || 0);
    if (fav) v += add(fav, fav > 0 ? 'what the crown has done for it' : 'what the crown has done to it');
    why.sort((a, b) => Math.abs(b.v) - Math.abs(a.v));
    return { v: Math.round(clamp(v, 0, 100)), why };
  }

  loyaltyOf(civ, L) {
    return this.loyalty(civ, L).v;
  }

  // Every town's, and the realm's (each town counted by its people).
  approvals(civ, over = {}) {
    const by = {};
    let n = 0;
    let sum = 0;
    for (const L of this.sim.realms.memberLayouts(civ)) {
      const r = this.loyalty(civ, L, over);
      const pop = Math.max(1, residents(L).length);
      by[L.settlement.id] = { ...r, pop, name: L.settlement.name };
      n += pop;
      sum += r.v * pop;
    }
    return { by, overall: n ? Math.round(sum / n) : 50 };
  }

  preview(civ, over) {
    const a = this.approvals(civ);
    const b = this.approvals(civ, over);
    const by = {};
    for (const k of Object.keys(b.by)) by[k] = b.by[k].v - (a.by[k] ? a.by[k].v : 50);
    return { by, overall: b.overall - a.overall };
  }

  // ------------------------------------------------------------ the throne
  // A player takes the realm (`how`: secession, succession, election,
  // usurpation, inheritance). The old ruler stays on as chancellor.
  crownPlayer(civ, pid, name, how, day, o = {}) {
    const realms = this.sim.realms;
    const R = this.R(civ);
    const other = this.heldBy(pid);
    if (other && other.civ !== civ.id) this.depose(this.civ(other.civ), `took the throne of the ${plain(civ)}`, day, true);
    const prev = R.head;
    if (prev && prev !== pid) this.depose(civ, how === 'usurpation' ? 'overthrown' : 'replaced', day, true);
    const C = this.rec(civ);
    R.form = o.form || R.form || formFromLegacy(formOf(civ));
    R.head = pid;
    R.headName = name;
    R.headStyle = R.form === 'monarchy' ? o.style || 'Monarch' : null;
    realms.realm(civ);
    this.rename(civ, day);
    const F = REALM_FORMS[R.form];
    C.holder = { pid, name, since: day, how, termEnd: F.term ? day + F.term : null };
    C.agenda = [];
    C.lowDays = 0;
    C.favour = how === 'usurpation' ? {} : {};
    if (how === 'usurpation') for (const L of realms.memberLayouts(civ)) C.favour[L.settlement.id] = -12;
    if (how === 'secession' || how === 'election') for (const L of realms.memberLayouts(civ)) C.favour[L.settlement.id] = 6;
    delete this.heirs[civ.id];
    // (The chancellor: whoever ruled, or would have.)
    const ch = realms.ruler(civ);
    if (ch) ch.chancellor = civ.id;
    const words = { secession: 'leads the free realm it has become', succession: 'has come to the throne', inheritance: 'has come to the throne, heir to the last ruler', election: 'has been chosen to lead it', usurpation: 'has seized the throne', granted: 'rules it now', birthright: 'has come into their own: the realm is theirs to rule' }[how] || 'rules it now';
    realms.proclaim(civ, day, `${this.who(civ)} ${words}: the ${plain(civ)} answers to them now.`);
    this.office.asPid(pid, () => this.sim.addRenown?.(R.capital, 3, 'coming to the throne'));
    this.office.show(pid, 'crowned', { civ: civ.id, sid: R.capital, how, form: R.form });
    this.sim.saga?.emit('crowned_player', { pid, civ: civ.id, how });
    this.table(civ, C, day);
    this.record(civ, C, day);
    return C;
  }

  // The throne lost: why. A named heir who plays comes after.
  depose(civ, why, day, quiet = false) {
    const C = this.realms[civ.id];
    const R = this.R(civ);
    if (!C || !C.holder) {
      if (R.head) R.head = null;
      return null;
    }
    const h = C.holder;
    const title = shortTitle(civ);
    C.past.push({ pid: h.pid, name: h.name, from: h.since, to: day, why, approval: C.lastOverall });
    if (C.past.length > 8) C.past.shift();
    C.holder = null;
    C.agenda = [];
    R.head = null;
    R.headName = null;
    R.headStyle = null;
    this.sim.realms.realm(civ);
    const ch = this.sim.realms.ruler(civ);
    if (ch) delete ch.chancellor;
    this.sim.realms.proclaim(civ, day, `${title} ${h.name} no longer rules the ${plain(civ)}: ${why}.${ch ? ` ${full(ch)} rules in their place.` : ''}`);
    if (!quiet) this.office.tell(h.pid, `You no longer rule the ${plain(civ)}: ${why}.`, '#ffb080');
    this.office.show(h.pid, 'fallen', { sid: R.capital, why, title: `${title} of the ${plain(civ)}`, days: day - h.since });
    // An heir who plays.
    const heir = C.heir;
    C.heir = null;
    if (heir && heir.pid && heir.pid !== h.pid && /abdicat|died|stepped/.test(why)) this.crownPlayer(civ, heir.pid, heir.name, 'succession', day, { style: null });
    return h;
  }

  abdicate(civ) {
    if (!this.isRuler(civ)) return false;
    this.depose(civ, 'abdicated', this.game.day);
    return true;
  }

  isRuler(civ, pid = this.pid()) {
    const C = civ && this.realms[civ.id];
    return !!(C && C.holder && C.holder.pid === pid);
  }

  setStyle(civ, style) {
    const R = this.R(civ);
    const F = REALM_FORMS[R.form];
    const ok = F && [...(F.styles || []), ...(this.sim.realms.members(civ).length >= 5 ? F.grand || [] : [])].includes(style);
    if (!ok || !this.isRuler(civ)) return false;
    R.headStyle = style;
    this.sim.realms.realm(civ);
    this.rename(civ, this.game.day);
    this.sim.realms.proclaim(civ, this.game.day, `${R.headName} is to be known as ${style} of the ${plain(civ)}.`);
    return true;
  }

  // The realm's name, to fit its form (and an emperor's realm, an empire).
  rename(civ, day) {
    const R = this.R(civ);
    const n = renameFor(civ.name, R.form, R.headStyle, (name) => nameForm({ name }));
    if (n === civ.name) return false;
    const was = civ.name;
    R.name = n;
    civ.name = n;
    this.sim.realms.proclaim(civ, day, `The ${plain({ name: was })} is the ${plain(civ)} now.`);
    return true;
  }

  // Raise a town's head (a fellow player) to a lordship, under a monarch.
  grantLordship(civ, sid) {
    if (!this.isRuler(civ) || this.R(civ).form !== 'monarchy') return { ok: false, why: 'Only a monarch grants lordships.' };
    const L = this.sim.layoutOf(sid);
    const T = this.office.of(sid);
    if (!L || !T || !T.holder) return { ok: false, why: 'Only a town a player governs.' };
    if (T.charter === 'lordship') return { ok: false, why: 'It is a lordship already.' };
    this.office.reform(L, T, 'lordship', this.game.day);
    this.sim.realms.proclaim(civ, this.game.day, `${this.who(civ)} has raised ${T.holder.name} to the lordship of ${L.settlement.name}.`);
    if (T.holder.pid !== this.pid()) this.office.tell(T.holder.pid, `${this.who(civ)} has made you lord of ${L.settlement.name}: you rule it by right now (choose how you're styled).`, '#ffe070');
    return { ok: true };
  }

  // Offer a town no player governs to a fellow player, as its governor
  // (they answer it like any offer of office: see office.answer).
  offerGovernor(civ, sid, pid) {
    if (!this.isRuler(civ)) return { ok: false, why: 'Only the ruler can.' };
    const L = this.sim.layoutOf(sid);
    if (!L || !L.econ || L.settlement.civ !== civ) return { ok: false, why: 'Not a town of the realm.' };
    const T = this.office.of(sid);
    if (T && T.holder) return { ok: false, why: `${T.holder.name} governs it already.` };
    if (this.office.heldBy(pid)) return { ok: false, why: 'They govern a town already.' };
    if (this.office.offerFor(pid)) return { ok: false, why: 'They have an offer to answer already.' };
    this.office.offer(pid, L, 'governor', `${this.who(civ)} would have you govern ${L.settlement.name}, at the crown's pleasure.`, 2, { civ: civ.id });
    return { ok: true };
  }

  // The players who could be offered a town (not the ruler; not already
  // governing one).
  governorCandidates(civ) {
    const out = [];
    for (const seat of this.game.seats || []) {
      const pid = seat.host ? 'host' : String(seat.id);
      if (this.isRuler(civ, pid) || this.office.heldBy(pid)) continue;
      out.push({ pid, name: seat.name });
    }
    return out;
  }

  // Name an heir: a noble of the court, or a fellow player of the realm.
  nameHeir(civ, heir) {
    const C = this.realms[civ.id];
    if (!C || !this.isRuler(civ)) return false;
    C.heir = heir;
    this.sim.realms.proclaim(civ, this.game.day, `${this.who(civ)} has named ${heir.name} heir to the ${plain(civ)}.`);
    if (heir.pid) this.office.tell(heir.pid, `${this.who(civ)} has named you heir to the ${plain(civ)}.`, '#ffe070');
    return true;
  }

  // Candidates for heir: the court's nobles and the realm's players.
  heirCandidates(civ) {
    const out = [];
    const capL = this.capitalL(civ);
    if (capL) for (const r of residents(capL).filter((q) => q.age === 'adult' && (q.job === 'noble' || q.chancellor !== undefined)).slice(0, 4)) out.push({ sid: capL.settlement.id, idx: r.idx, name: full(r) });
    for (const seat of this.game.seats || []) {
      const pid = seat.host ? 'host' : String(seat.id);
      if (this.isRuler(civ, pid)) continue;
      const home = this.office.asPid(pid, () => this.sim.citizen && this.game.world.ow.settlements[this.sim.citizen.sid]);
      if (home && home.civ === civ) out.push({ pid, name: seat.name });
    }
    return out;
  }

  // ------------------------------------------------------------ the sitting
  // Each morning, at the capital (see realms.court).
  session(civ, capL, day, rng) {
    const C = this.rec(civ);
    if (!C.holder) {
      // (A realm whose ruling player is gone: its own ruler again.)
      this.R(civ).head = null;
      return false;
    }
    const abs = day * DAY + SESSION;
    C.lastSession = day;
    for (const it of C.agenda.slice()) {
      if (it.done) continue;
      if (it.state === 'voting') this.finishVote(civ, C, it, true);
      else if (it.state === 'open' && it.until <= abs) this.lapse(civ, C, it, day);
    }
    C.agenda = C.agenda.filter((q) => !q.done);
    // The chancellor's rounds, by your orders.
    const realms = this.sim.realms;
    if (C.orders.aid === 'auto' && day % 2 === 0) realms.aid(civ, capL, day);
    if (C.orders.roads === 'auto' && (day + civ.id) % 3 === 0) realms.roadWorks(civ, capL, day);
    // Your pay, from the realm's coffers (the capital's).
    const pay = (REALM_FORMS[this.R(civ).form] || REALM_FORMS.monarchy).stipend;
    if (capL.econ.treasury >= pay + 40) {
      capL.econ.treasury -= pay;
      const got = this.office.asPid(C.holder.pid, () => {
        addItem(this.game.player.inv, 'coin', pay + C.purse);
        return true;
      });
      if (got) C.purse = 0;
      else C.purse += pay;
    }
    // How the realm takes it all.
    this.record(civ, C, day);
    for (const k of Object.keys(C.favour)) C.favour[k] = Math.round(C.favour[k] * 0.93 * 10) / 10;
    // Being overruled.
    this.overrule(civ, C, day, rng);
    if (!C.holder) return true;
    this.table(civ, C, day);
    return true;
  }

  record(civ, C, day) {
    const A = this.approvals(civ);
    C.lastLoyalty = Object.fromEntries(Object.entries(A.by).map(([k, q]) => [k, q.v]));
    C.lastOverall = A.overall;
    const last = C.hist[C.hist.length - 1];
    const capL = this.capitalL(civ);
    const row = { day, overall: A.overall, treasury: capL ? Math.floor(capL.econ.treasury) : 0 };
    if (!last || last.day !== day) C.hist.push(row);
    else Object.assign(last, row);
    if (C.hist.length > 21) C.hist.shift();
    C.lowDays = A.overall < 32 ? (C.lowDays || 0) + 1 : 0;
    return A;
  }

  // ------------------------------------------------------------ matters
  table(civ, C, day) {
    const abs = day * DAY + SESSION;
    const open = C.agenda.filter((q) => !q.crisis && !q.done && q.state === 'open');
    const busy = (key) => C.agenda.some((q) => q.key === key && !q.done) || (C.quiet[key] ?? -99) > day - 3;
    const specs = this.matters(civ, C, day).filter((q) => !busy(q.key)).sort((a, b) => b.prio - a.prio);
    for (const spec of specs) {
      if (open.length >= MAX_OPEN) break;
      open.push(this.addItem(C, spec, day, abs));
    }
    const cr = this.crisisFor(civ, C, day);
    if (cr && !busy(cr.key)) this.crisis(civ, C, cr, day, abs);
  }

  addItem(C, spec, day, abs = this.sim.abs) {
    const it = {
      id: C.seq++, key: spec.key, kind: spec.kind, title: spec.title, why: (spec.why || []).filter(Boolean), by: spec.by ?? null, opts: spec.opts, order: spec.order || null,
      day, until: spec.until ?? (spec.hours ? abs + spec.hours * 60 : nextSession(abs + 1)), state: 'open', struck: [], crisis: spec.crisis || null, super: !!spec.super, mine: !!spec.mine, from: spec.from || null,
    };
    C.agenda.push(it);
    return it;
  }

  crisis(civ, C, spec, day, abs) {
    const it = this.addItem(C, spec, day, abs);
    C.crisisDay = day;
    C.crises[spec.crisis] = day;
    this.sim.realms.proclaim(civ, day, `${spec.title}. ${spec.why[0]}`);
    this.office.tell(C.holder.pid, `CRISIS in the ${plain(civ)}: ${spec.title}. Decide within ${spec.hours} hours (N).`, '#ff8070');
    return it;
  }

  matters(civ, C, day) {
    const realms = this.sim.realms;
    const R = this.R(civ);
    const out = [];
    const capL = this.capitalL(civ);
    const towns = realms.memberLayouts(civ);
    const treasury = capL ? Math.floor(capL.econ.treasury) : 0;
    // What the privy council advises the realm decree.
    const change = realms.decree(civ, day, new RNG(hash4(civ.id, day, 0xadc)), true);
    if (change && change.fx) {
      out.push({
        key: `decree:${change.key}`, kind: 'decree', prio: 6, title: `The council advises: ${change.title.toLowerCase()}`,
        why: [`Your ${R.form === 'republic' ? 'council' : 'privy council'} would have it: ${change.text}`],
        opts: [{ label: 'Decree it', fx: change.fx, sense: 0.4 }, { label: 'Leave things as they are', fx: {}, trivial: true }],
        order: { advice: { heed: 0, leave: 1 } },
      });
    }
    // Towns in need.
    for (const L of towns) {
      if (L === capL) continue;
      const pop = residents(L).length;
      const poor = L.econ.treasury < pop * 6 || (L.econ.famineDays || 0) >= 3;
      if (!poor || R.aid.some((a) => a.sid === L.settlement.id && day - a.day < 6)) continue;
      const n = Math.min(80, 20 + pop * 2);
      out.push({
        key: `aid:${L.settlement.id}`, kind: 'aid', prio: 5, by: L.settlement.id, title: `${L.settlement.name} asks the crown for help`,
        why: [(L.econ.famineDays || 0) >= 3 ? `${L.settlement.name} is going hungry.` : `${L.settlement.name}'s treasury is down to ¤${Math.floor(L.econ.treasury)}.`, `The realm's coffers (in ${capL ? capL.settlement.name : 'the capital'}) hold ¤${treasury}.`],
        opts: [
          { label: `Send ¤${n}`, fx: { aid: { sid: L.settlement.id, n }, favour: { [L.settlement.id]: 8 } }, off: treasury >= n + 40 ? null : 'the realm\'s coffers are too low', sense: 0.3 },
          { label: 'Refuse', fx: { favour: { [L.settlement.id]: -5 } }, trivial: true },
        ],
        order: { aid: { auto: 0, ask: -1 } },
      });
      break;
    }
    // A plea for lighter tribute, from a town that's lost faith.
    const A = C.lastLoyalty || {};
    const sore = towns.filter((L) => L !== capL && (A[L.settlement.id] ?? 50) < 38 && !((C.relief[L.settlement.id] ?? -1) > day)).sort((a, b) => (A[a.settlement.id] ?? 50) - (A[b.settlement.id] ?? 50))[0];
    if (sore) {
      out.push({
        key: `plea:${sore.settlement.id}`, kind: 'plea', prio: 5, by: sore.settlement.id, title: `${sore.settlement.name} begs lighter tribute`,
        why: [`${sore.settlement.name} sends ${pc(R.share)} of its taxes to the capital, and resents it: its loyalty is ${A[sore.settlement.id] ?? '?'}.`],
        opts: [
          { label: 'Halve its tribute for a fortnight', fx: { relief: sore.settlement.id, favour: { [sore.settlement.id]: 8 } } },
          { label: 'Refuse', fx: { favour: { [sore.settlement.id]: -4 } }, trivial: true },
        ],
        order: { pleas: { grant: 0, refuse: 1 } },
      });
    }
    // A road the realm lacks.
    if (capL && treasury >= 170) {
      const dip = this.sim.diplomacy;
      const capS = capL.settlement;
      const linked = (s) => dip.roads.some((r) => (r.a === capS.id && r.b === s.id) || (r.b === capS.id && r.a === s.id));
      const t = towns.map((L) => L.settlement).filter((s) => s !== capS && !linked(s) && dip.dist(capS, s) < 12).sort((a, b) => dip.dist(capS, a) - dip.dist(capS, b))[0];
      if (t) out.push({
        key: `road:${t.id}`, kind: 'road', prio: 3, by: t.id, title: `A road from ${capS.name} to ${t.name}?`,
        why: [`No road joins ${t.name} to the capital. Building one would cost the realm ¤120.`],
        opts: [{ label: 'Build it (¤120)', fx: { road: t.id, favour: { [t.id]: 5 } }, sense: 0.3 }, { label: 'Not now', fx: {}, trivial: true }],
        order: { roads: { auto: 0, ask: -1 } },
      });
    }
    // A quarrel worth a war.
    const war = this.sim.war;
    if (war && !war.atWar(civ)) {
      for (const o of realms.civs) {
        if (o === civ || !realms.members(o).length || this.sim.politics.bound(civ, o) || war.truce(civ, o, day)) continue;
        const why = war.reasons(civ, o, day);
        if (!why.length || realms.relation(civ, o).score > -25) continue;
        out.push({
          key: `war:${o.id}`, kind: 'war', prio: 4, title: `War with the ${plain(o)}?`,
          why: [`The ${plain(o)} has given cause: ${why[0].text}.`, `Your strength ${this.sim.politics.strength(civ)}, theirs ${this.sim.politics.strength(o)}.`],
          opts: [{ label: `Declare war on the ${plain(o)}`, fx: { war: o.id, why: why[0] } }, { label: 'Not now', fx: {}, trivial: true }],
        });
        break;
      }
    }
    if (war && war.atWar(civ)) {
      const w = war.warOf(civ);
      const side = war.sideOf(w, civ);
      const behind = side === 'a' ? w.score < -20 : w.score > 20;
      if (behind || war.weariness(civ) > 0.4) {
        const foe = this.civ(w.lead[side === 'a' ? 'b' : 'a']);
        out.push({
          key: 'sue', kind: 'sue', prio: 6, title: `Sue for peace with the ${plain(foe)}?`,
          why: [`The war has gone on ${day - w.start} days, and ${behind ? 'it goes badly' : 'the realm is weary of it'}.`],
          opts: [{ label: 'Ask for terms', fx: { sue: true } }, { label: 'Fight on', fx: {}, trivial: true }],
        });
      }
    }
    return out;
  }

  crisisFor(civ, C, day) {
    if (C.agenda.some((q) => q.crisis && q.state === 'open') || day - (C.crisisDay ?? -99) < 3) return null;
    const form = this.R(civ).form;
    const recent = (k, d) => C.crises[k] !== undefined && day - C.crises[k] < d;
    // A pretender, in a realm that's had enough of its monarch.
    if ((form === 'monarchy' || form === 'theocracy') && C.lowDays >= 4 && !recent('pretender', 12)) {
      const capL = this.capitalL(civ);
      const noble = capL && residents(capL).filter((r) => r.job === 'noble' && r.age === 'adult' && r.chancellor === undefined).sort((a, b) => (b.personality.bravery ?? 0.5) - (a.personality.bravery ?? 0.5))[0];
      const name = noble ? full(noble) : 'a noble of the court';
      return {
        key: 'crisis:pretender', kind: 'crisis', crisis: 'pretender', prio: 12, hours: 18, title: `${cap(name)} claims the throne`,
        why: [`With the realm against you, ${name} has declared themselves the rightful ruler of the ${plain(civ)}, and towns are listening.`],
        opts: [
          { label: 'Buy them off (¤150)', fx: { act: 'pretender_pay' } },
          { label: 'Arrest them', fx: { act: 'pretender_crush' }, note: 'only if the capital\'s watch stands by you' },
          { label: 'Abdicate', fx: { act: 'abdicate' } },
        ],
        order: { crises: { cautious: 0, bold: 1 } },
      };
    }
    return null;
  }

  // A town on the brink of breaking away (see realms.unrestWeekly).
  rebelTown(civ, L, day) {
    const C = this.realms[civ.id];
    if (!C || !C.holder || C.agenda.some((q) => q.key === `rebel:${L.settlement.id}`)) return null;
    const sid = L.settlement.id;
    return this.crisis(civ, C, {
      key: `rebel:${sid}`, kind: 'crisis', crisis: 'rebel', prio: 11, hours: 24, by: sid, title: `${L.settlement.name} talks of breaking away`,
      why: [`${L.settlement.name} has lost faith in the crown (loyalty ${this.loyaltyOf(civ, L)}). Unless something is done, it will declare itself free within the week.`],
      opts: [
        { label: 'Win it back: halve its tribute, send ¤40', fx: { relief: sid, aid: { sid, n: 40 }, favour: { [sid]: 18 }, act: 'calm' } },
        { label: 'Send the capital\'s watch', fx: { act: 'garrison', favour: { [sid]: -6 } }, note: 'the talk stops, for now' },
        { label: 'Let it go', fx: { act: 'release' } },
      ],
      order: { crises: { cautious: 0, bold: 1 } },
    }, day, this.sim.abs);
  }

  // ------------------------------------------------------------ others
  // A realm offers alliance to one a player rules (or the other way about,
  // when both are): the ruler answers.
  allianceOffer(a, b, day, against = null) {
    for (const [mine, them] of [[a, b], [b, a]]) {
      const C = this.realms[mine.id];
      if (!C || !C.holder || C.agenda.some((q) => q.key === `ally:${them.id}`)) continue;
      this.addItem(C, {
        key: `ally:${them.id}`, kind: 'ally', prio: 7, title: `The ${plain(them)} offers an alliance`,
        why: [`Envoys of the ${plain(them)} propose an alliance: friends in trade, and in war${against ? `, against the ${plain(against)}` : ''}.`, `Its strength: ${this.sim.politics.strength(them)}.`],
        opts: [{ label: 'Accept', fx: { ally: them.id } }, { label: 'Decline', fx: {}, trivial: true }],
      }, day);
      this.office.tell(C.holder.pid, `The ${plain(them)} offers the ${plain(mine)} an alliance (N).`, '#a0e8ff');
      return true;
    }
    return false;
  }

  // The enemy asks for terms.
  peaceOffer(mine, asker, w, day) {
    const C = this.realms[mine.id];
    if (!C || !C.holder || C.agenda.some((q) => q.key === `peace:${w.id}`)) return null;
    const side = this.sim.war.sideOf(w, mine);
    const ahead = side === 'a' ? w.score > 0 : w.score < 0;
    this.addItem(C, {
      key: `peace:${w.id}`, kind: 'peace', prio: 9, title: `The ${plain(asker)} asks for peace`,
      why: [`After ${day - w.start} days of war, the ${plain(asker)} asks for terms.`, ahead ? 'The war goes your way: peace now would be on your terms.' : 'Neither side has the better of it.'],
      opts: [{ label: 'Make peace', fx: { peace: w.id } }, { label: 'Fight on', fx: {}, trivial: true }],
    }, day);
    this.office.tell(C.holder.pid, `The ${plain(asker)} asks the ${plain(mine)} for peace (N).`, '#a0e8a0');
    return true;
  }

  // A town's head who plays brings a petition to the crown.
  petitionFrom(L, kind, name) {
    const civ = L.settlement.civ;
    const C = civ && this.realms[civ.id];
    if (!C || !C.holder) return null;
    const sid = L.settlement.id;
    const what = { aid: 'help for its treasury', floor: 'a lower least tax', tribute: 'lighter tribute', road: 'a road to the capital' }[kind];
    const fx = kind === 'aid' ? { aid: { sid, n: 60 }, favour: { [sid]: 8 } } : kind === 'floor' ? { decree: 'taxFloor', v: FLOORS[Math.max(0, FLOORS.indexOf(this.R(civ).decrees.taxFloor) - 1)] } : kind === 'tribute' ? { relief: sid, favour: { [sid]: 6 } } : { road: sid, favour: { [sid]: 5 } };
    const it = this.addItem(C, {
      key: `petition:${sid}:${kind}`, kind: 'petition', prio: 7, by: sid, from: { sid, kind }, title: `${name} of ${L.settlement.name} asks for ${what}`,
      why: [`${name}, who governs ${L.settlement.name}, petitions the crown.`],
      opts: [{ label: 'Grant it', fx: { ...fx, petition: { sid, kind, yes: true } } }, { label: 'Refuse', fx: { petition: { sid, kind, yes: false }, favour: { [sid]: -4 } }, trivial: true }],
    }, this.game.day);
    this.office.tell(C.holder.pid, `${name} of ${L.settlement.name} petitions you (N).`, '#ffe070');
    return it;
  }

  // A town's head who plays defies a decree of the crown's.
  defiance(L, key, day) {
    const civ = L.settlement.civ;
    const C = civ && this.realms[civ.id];
    const T = this.office.of(L.settlement.id);
    if (!C || !C.holder || !T || !T.holder || C.agenda.some((q) => q.key === `defy:${L.settlement.id}`)) return null;
    const sid = L.settlement.id;
    const fine = Math.min(60, Math.round(L.econ.treasury * 0.2));
    this.addItem(C, {
      key: `defy:${sid}`, kind: 'defy', prio: 8, by: sid, title: `${T.holder.name} of ${L.settlement.name} defies you`,
      why: [`${L.settlement.name} refuses the crown's ${key === 'taxFloor' ? 'least tax' : 'decree'}.`],
      opts: [
        { label: `Fine the town ¤${fine}`, fx: { fine: { sid, n: fine }, favour: { [sid]: -6 } } },
        { label: 'Let it be', fx: { forgive: sid }, trivial: true },
        { label: `Depose ${T.holder.name}`, fx: { depose: sid, favour: { [sid]: -10 } }, off: this.office.isHolder(sid, C.holder.pid) ? 'it is your own town' : null },
      ],
    }, day);
    this.office.tell(C.holder.pid, `${T.holder.name} of ${L.settlement.name} defies your decree (N).`, '#ff9070');
    return true;
  }

  // ------------------------------------------------------------ deciding
  // The ruler decides. Under a monarchy, decreed; else put to the realm's
  // vote (its council, its moot, its league).
  decide(civ, itemId, k) {
    const C = this.realms[civ.id];
    if (!C || !C.holder || C.holder.pid !== this.pid()) return { ok: false, why: 'Only the ruler can decide.' };
    const it = C.agenda.find((q) => q.id === itemId);
    if (!it || it.done || it.state !== 'open') return { ok: false, why: 'That\'s been decided.' };
    const opt = it.opts[k];
    if (!opt || it.struck.includes(k)) return { ok: false, why: 'The realm has voted that down.' };
    if (opt.off) return { ok: false, why: `Not possible: ${opt.off}.` };
    it.choice = k;
    const v = opt.trivial || it.crisis ? null : this.vote(civ, C, it, k);
    if (!v || v.state === 'decreed') {
      this.carry(civ, C, it, k, 'you', v);
      return { ok: true, state: v ? 'decreed' : 'decided', vote: v };
    }
    if (v.state === 'waiting') {
      it.state = 'voting';
      it.vote = v;
      for (const b of v.ballots) if (b.pid && b.v === null) this.office.show(b.pid, 'vote', { civ: civ.id, id: it.id });
      return { ok: true, state: 'waiting', vote: v };
    }
    this.settle(civ, C, it, v);
    return { ok: true, state: v.state, vote: v };
  }

  settle(civ, C, it, v) {
    it.vote = v;
    if (v.state === 'carried' || v.state === 'decreed') return this.carry(civ, C, it, it.choice, 'you', v);
    it.state = 'open';
    if (!it.struck.includes(it.choice)) it.struck.push(it.choice);
    this.minute(C, `${it.title}: ${it.opts[it.choice].label}: ${v.state === 'vetoed' ? 'vetoed' : 'voted down'} (${v.aye} to ${v.nay})`);
    return null;
  }

  // Who votes with the ruler, by the realm's form.
  vote(civ, C, it, k) {
    const R = this.R(civ);
    const F = REALM_FORMS[R.form] || REALM_FORMS.monarchy;
    const opt = it.opts[k];
    const pv = this.preview(civ, this.overOf(civ, opt.fx || {}));
    const v = { kind: F.vote, ballots: [], aye: 0, nay: 0, need: it.super ? 2 / 3 : 0.5, state: 'carried', at: this.sim.abs };
    if (F.vote === 'decree' || F.vote === 'temple') {
      v.state = 'decreed';
      if (F.vote === 'temple') {
        const fx = opt.fx || {};
        const holy = fx.why && fx.why.k === 'holy';
        if ((fx.war !== undefined && !holy) || (fx.decree === 'share' && fx.v > R.share)) {
          v.state = 'vetoed';
          v.ballots.push({ who: 'The high priest', v: 0, w: 1, why: 'forbids it' });
          v.veto = 'the high priest';
        }
      }
      return v;
    }
    v.ballots.push({ who: C.holder.name, you: true, v: 1, w: 1, why: 'your proposal' });
    const realms = this.sim.realms;
    if (F.vote === 'council') {
      for (const p of R.council) {
        const r = realms.recOf(p);
        if (!r || !alive(r)) continue;
        const u = (pv.overall || 0) / 8 + (opt.sense || 0) + (C.trust[r.idx] ?? 0) / 100 + noise(r.idx, it.id, k, 0xc0c) * 0.6 + this.taste(r, opt);
        v.ballots.push({ who: full(r), idx: r.idx, v: u > 0 ? 1 : 0, w: 1, why: u > 0 ? ((pv.overall || 0) > 0 ? 'good for the realm' : 'trusts you') : 'against it' });
      }
      // Fellow players with a seat on the realm's council.
      for (const T of this.office.realmSeats(civ)) {
        if (T.holder.pid === C.holder.pid) continue;
        v.ballots.push({ who: T.holder.name, pid: T.holder.pid, v: this.office.online(T.holder.pid) ? null : -1, w: 1, why: 'deciding' });
      }
    } else {
      // The heads of the realm's towns: a moot, one each; a league, by
      // the weight of their treasuries.
      for (const L of realms.memberLayouts(civ)) {
        const sid = L.settlement.id;
        const T = this.office.of(sid);
        const w = F.vote === 'league' ? Math.max(1, Math.round(L.econ.treasury / 200)) : 1;
        if (T && T.holder) {
          if (T.holder.pid === C.holder.pid) continue;
          v.ballots.push({ who: `${T.holder.name} (${L.settlement.name})`, pid: T.holder.pid, sid, v: this.office.online(T.holder.pid) ? null : -1, w, why: 'deciding' });
          continue;
        }
        const m = mayorOf(L);
        if (!m) continue;
        const loy = (C.lastLoyalty || {})[sid] ?? 50;
        const u = (pv.by[sid] || 0) / 6 + (loy - 50) / 80 + (opt.sense || 0) + noise(m.idx, it.id, k, sid, 0x3007) * 0.5;
        v.ballots.push({ who: `${full(m)} (${L.settlement.name})`, idx: m.idx, sid, v: u > 0 ? 1 : 0, w, why: u > 0 ? ((pv.by[sid] || 0) > 0 ? 'good for their town' : 'loyal to you') : (pv.by[sid] || 0) < 0 ? 'bad for their town' : 'no friend of yours' });
      }
    }
    this.tally(v);
    if (v.ballots.some((b) => b.v === null)) v.state = 'waiting';
    return v;
  }

  taste(r, opt) {
    const fx = opt.fx || {};
    const P = r.personality || {};
    let u = 0;
    if (fx.war !== undefined) u += ((P.bravery ?? 0.5) - 0.55) + ((P.temper ?? 0.5) - 0.5) * 0.5;
    if (fx.peace !== undefined || fx.sue) u += ((P.kindness ?? 0.5) - 0.4);
    if (fx.form) u += fx.form === 'monarchy' ? -0.8 : -0.15;
    return u;
  }

  tally(v) {
    let aye = 0;
    let nay = 0;
    for (const b of v.ballots) {
      if (b.v === 1) aye += b.w;
      else if (b.v === 0) nay += b.w;
    }
    v.aye = aye;
    v.nay = nay;
    if (v.ballots.some((b) => b.v === null)) return v;
    if (v.veto) v.state = 'vetoed';
    else {
      const t = aye + nay;
      v.state = v.need > 0.5 ? (t && aye / t >= v.need - 1e-9 ? 'carried' : 'defeated') : aye >= nay ? 'carried' : 'defeated';
    }
    return v;
  }

  // A fellow player's vote in the realm's council or moot.
  cast(civId, itemId, aye) {
    const civ = this.civ(civId);
    const C = civ && this.realms[civ.id];
    const it = C && C.agenda.find((q) => q.id === itemId);
    if (!it || it.state !== 'voting' || !it.vote) return false;
    const b = it.vote.ballots.find((q) => q.pid === this.pid() && q.v === null);
    if (!b) return false;
    b.v = aye ? 1 : 0;
    b.why = aye ? 'for it' : 'against it';
    this.tally(it.vote);
    if (!it.vote.ballots.some((q) => q.v === null)) this.finishVote(civ, C, it);
    return true;
  }

  finishVote(civ, C, it) {
    for (const b of it.vote.ballots) if (b.v === null) {
      b.v = -1;
      b.why = 'did not vote';
    }
    it.vote.state = 'carried';
    this.tally(it.vote);
    this.settle(civ, C, it, it.vote);
    C.agenda = C.agenda.filter((q) => !q.done);
    if (C.holder) this.office.show(C.holder.pid, 'voted', { civ: civ.id, id: it.id });
  }

  // Left undecided: the chancellor, by your orders.
  lapse(civ, C, it, day) {
    let k = -1;
    if (it.order) {
      const [key, map] = Object.entries(it.order)[0];
      k = map[C.orders[key]] ?? -1;
    } else if (it.crisis) k = 0;
    if (k >= 0 && (it.opts[k]?.off || it.struck.includes(k))) k = it.opts.findIndex((o) => o.trivial);
    if (k < 0) {
      it.done = true;
      C.quiet[it.key] = day;
      this.minute(C, `${it.title}: set aside`);
      return null;
    }
    return this.carry(civ, C, it, k, 'chancellor');
  }

  carry(civ, C, it, k, by, v = null) {
    const opt = it.opts[k];
    it.done = true;
    it.choice = k;
    it.state = 'carried';
    if (v) it.vote = v;
    const day = this.game.day;
    const text = this.apply(civ, C, opt.fx || {}, day, it);
    const ch = this.sim.realms.ruler(civ);
    const who = by === 'chancellor' ? `${ch ? `Chancellor ${full(ch)}` : 'The chancellor'}, for ${this.who(civ)},` : this.who(civ);
    if (text) this.sim.realms.proclaim(civ, day, `${who} ${text}`);
    this.minute(C, `${it.title}: ${opt.label}${by === 'chancellor' ? ' (the chancellor, by your orders)' : ''}`);
    C.quiet[it.key] = day;
    C.agenda = C.agenda.filter((q) => !q.done);
    return text;
  }

  minute(C, what) {
    C.minutes.push({ day: this.game.day, what });
    if (C.minutes.length > 40) C.minutes.shift();
  }

  // A choice as a change to the realm (for the towns' reckoning).
  overOf(civ, fx) {
    const over = {};
    if (fx.decree === 'taxFloor') over.taxFloor = fx.v;
    if (fx.decree === 'share') over.share = fx.v;
    if (fx.decree === 'armsBan') over.armsBan = fx.v;
    if (fx.war !== undefined) over.war = true;
    if (fx.form) over.form = fx.form;
    if (fx.favour) over.favour = fx.favour;
    return over;
  }

  // What a choice would do, said plainly.
  stated(civ, opt) {
    const fx = opt.fx || {};
    const bits = [];
    if (fx.decree === 'taxFloor') bits.push(`least tax ${pc(fx.v)}`);
    if (fx.decree === 'share') bits.push(`tribute ${pc(fx.v)}`);
    if (fx.decree === 'armsBan') bits.push(fx.v ? 'weapons banned' : 'ban lifted');
    if (fx.decree === 'tariff') bits.push(`${fx.v ? 'a tariff on' : 'no tariff on'} the ${plain(this.civ(fx.civ))}`);
    if (fx.decree === 'watch') bits.push(`watch: ${fx.v}`);
    if (fx.decree === 'draft') bits.push(`draft: ${fx.v}`);
    if (fx.aid) bits.push(`¤${fx.aid.n} from the realm`);
    if (fx.road !== undefined) bits.push('¤120 from the realm');
    if (fx.relief !== undefined) bits.push('half tribute, a fortnight');
    if (fx.war !== undefined) bits.push('war');
    if (fx.form) bits.push(`the realm becomes a ${REALM_FORMS[fx.form].name.toLowerCase()}`);
    if (opt.note) bits.push(opt.note);
    const pv = this.preview(civ, this.overOf(civ, fx));
    return { text: bits.join(' · '), by: pv.by, overall: pv.overall };
  }

  // ------------------------------------------------------------ effects
  apply(civ, C, fx, day, it = null) {
    const realms = this.sim.realms;
    const R = this.R(civ);
    const capL = this.capitalL(civ);
    const words = [];
    const ow = this.game.world.ow;
    if (fx.decree) {
      const w = this.decree(civ, fx.decree, fx.v, fx.civ, true);
      if (w) words.push(w);
    }
    if (fx.aid && capL) {
      const L = this.sim.layoutOf(fx.aid.sid);
      const n = Math.min(fx.aid.n, Math.max(0, Math.floor(capL.econ.treasury) - 20));
      if (L && L.econ && n > 0) {
        capL.econ.treasury -= n;
        L.econ.treasury += n;
        R.aid.push({ day, sid: fx.aid.sid, kind: 'coins', amount: n });
        ledger(L, day, `The crown sent ¤${n} to ${L.settlement.name}.`);
        words.push(`sent ¤${n} to ${L.settlement.name}`);
      }
    }
    if (fx.relief !== undefined) {
      C.relief[fx.relief] = day + 14;
      words.push(`halved what ${ow.settlements[fx.relief].name} sends the capital, for a fortnight`);
    }
    if (fx.road !== undefined && capL) {
      const s = ow.settlements[fx.road];
      if (capL.econ.treasury >= 120 && this.sim.diplomacy.startRoad(capL.settlement, s)) {
        capL.econ.treasury -= 120;
        words.push(`is paying for a road from ${capL.settlement.name} to ${s.name}`);
      }
    }
    if (fx.favour) for (const [k, v] of Object.entries(fx.favour)) C.favour[k] = clamp((C.favour[k] || 0) + v, -FAVOUR_MAX, FAVOUR_MAX);
    if (fx.war !== undefined && this.sim.war) {
      const o = this.civ(fx.war);
      if (o && !this.sim.war.atWar(civ)) {
        this.sim.war.declare(civ, o, fx.why || { k: 'crown', text: 'the crown\'s quarrel' }, day, new RNG(hash4(civ.id, o.id, day)));
        // (A neighbour another player rules hears it from you.)
        const OC = this.of(o);
        if (OC) this.office.tell(OC.holder.pid, `The ${plain(civ)} has declared war on your realm!`, '#ff7060');
      }
    }
    if (fx.peace !== undefined && this.sim.war) {
      const w = this.sim.war.wars.find((q) => q.id === fx.peace);
      if (w) {
        const side = this.sim.war.sideOf(w, civ);
        const ahead = side === 'a' ? w.score > 15 : w.score < -15;
        this.sim.war.peace(w, day, new RNG(hash4(w.id, day)), ahead ? side : null, false);
        words.push('made peace');
      }
    }
    if (fx.sue && this.sim.war) {
      const w = this.sim.war.warOf(civ);
      if (w) {
        const side = this.sim.war.sideOf(w, civ);
        const foe = this.civ(w.lead[side === 'a' ? 'b' : 'a']);
        const OC = this.of(foe);
        if (OC) {
          this.peaceOffer(foe, civ, w, day);
          words.push(`asked the ${plain(foe)} for peace`);
        } else {
          const theirs = w.weary[foe.id] || 0;
          const ahead = side === 'a' ? w.score < -40 : w.score > 40;
          if (theirs > 0.3 || !ahead || hash4(w.id, day, 0x5ee) % 100 < 40) {
            this.sim.war.peace(w, day, new RNG(hash4(w.id, day)), w.score > 0 ? 'a' : w.score < 0 ? 'b' : null, false);
            words.push(`asked the ${plain(foe)} for peace, and got it`);
          } else words.push(`asked the ${plain(foe)} for peace, and was refused`);
        }
      }
    }
    if (fx.ally !== undefined) {
      const o = this.civ(fx.ally);
      if (o && !this.sim.politics.allied(civ, o)) {
        this.sim.politics.ally(civ, o, day);
        words.push(`swore an alliance with the ${plain(o)}`);
      }
    }
    if (fx.fine) {
      const L = this.sim.layoutOf(fx.fine.sid);
      if (L && L.econ && capL) {
        const n = Math.min(fx.fine.n, Math.floor(L.econ.treasury));
        L.econ.treasury -= n;
        capL.econ.treasury += n;
        const T = this.office.of(fx.fine.sid);
        if (T) T.defyLevel = Math.max(T.defyLevel || 0, 2);
        words.push(`fined ${L.settlement.name} ¤${n} for defying the crown`);
        if (T && T.holder) this.office.tell(T.holder.pid, `${this.who(civ)} has fined ${L.settlement.name} ¤${n} for its defiance.`, '#ff9070');
      }
    }
    if (fx.forgive !== undefined) {
      const T = this.office.of(fx.forgive);
      if (T) {
        T.defyGrace = day + 30;
        T.defyLevel = 0;
        if (T.holder) this.office.tell(T.holder.pid, `${this.who(civ)} lets ${ow.settlements[fx.forgive].name}'s defiance pass.`, '#a0e8a0');
      }
    }
    if (fx.depose !== undefined) {
      const L = this.sim.layoutOf(fx.depose);
      if (L && this.office.governs(L)) {
        const T = this.office.of(fx.depose);
        const name = T.holder.name;
        this.office.unseat(L, `deposed by ${this.who(civ)}`, day);
        words.push(`deposed ${name} as head of ${L.settlement.name}`);
      }
    }
    if (fx.petition) {
      const T = this.office.of(fx.petition.sid);
      if (T && T.holder) {
        this.office.tell(T.holder.pid, `${this.who(civ)} has ${fx.petition.yes ? 'granted' : 'refused'} ${ow.settlements[fx.petition.sid].name}'s petition.`, fx.petition.yes ? '#a0e8a0' : '#ffb080');
        T.petitions[fx.petition.kind] = day;
        if (fx.petition.yes) T.granted = (T.granted || 0) + 1;
      }
    }
    if (fx.form) {
      this.reform(civ, C, fx.form, day);
      words.push(`made the realm a ${REALM_FORMS[fx.form].name.toLowerCase()}`);
    }
    if (fx.act && CROWN_ACTS[fx.act]) {
      const w = CROWN_ACTS[fx.act](this, civ, C, day, it, fx);
      if (w) words.push(w);
    }
    void realms;
    return words.length ? `${words.join('; ')}.` : null;
  }

  // Set one of the realm's decrees (decreed, or as the vote carried it).
  // Returns the words for it (null: nothing changed).
  decree(civ, key, v, other = null, quiet = false) {
    const R = this.R(civ);
    const d = R.decrees;
    const day = this.game.day;
    const who = this.who(civ);
    let text = null;
    if (key === 'taxFloor' && d.taxFloor !== v) {
      d.taxFloor = v;
      text = v ? `set a least tax of ${pc(v)} for every town of the realm` : 'no longer sets a least tax for the towns';
    } else if (key === 'armsBan' && !!d.armsBan !== !!v) {
      d.armsBan = !!v;
      text = v ? 'forbade drawn weapons in every town of the realm' : 'lifted the realm\'s weapons ban';
    } else if (key === 'tariff') {
      const o = this.civ(other);
      const on = d.tariffOn.includes(other);
      if (o && on !== !!v) {
        d.tariffOn = v ? [...d.tariffOn, other] : d.tariffOn.filter((q) => q !== other);
        text = v ? `set a tariff on merchants of the ${plain(o)}` : `lifted the tariff on merchants of the ${plain(o)}`;
      }
    } else if (key === 'share') {
      const cap = REALM_FORMS[R.form]?.shareCap || 0.16;
      const nv = Math.min(cap, v);
      if (R.share !== nv) {
        R.share = nv;
        text = `set the tribute every town sends the capital at ${pc(nv)} of its taxes`;
      }
    } else if (key === 'watch' && d.watch !== v) {
      d.watch = v;
      text = { light: 'cut the watch back to one in ten grown folk', standard: 'returned the watch to its usual strength', heavy: 'ordered one in four grown folk to stand watch' }[v];
    } else if (key === 'draft' && d.draft !== v) {
      d.draft = v;
      text = { none: 'ended the draft', elders: 'called the hale elders to the watch', all: 'called the young to the watch as well' }[v];
    }
    if (text && !quiet) this.sim.realms.proclaim(civ, day, `${cap(who)} ${text}.`);
    // A decree a town governed by another player falls short of: it's theirs
    // to answer (see office.js).
    return text;
  }

  // The realm's form changed.
  reform(civ, C, form, day) {
    const R = this.R(civ);
    const was = R.form;
    R.form = form;
    if (form !== 'monarchy') R.headStyle = null;
    else R.headStyle ||= 'Monarch';
    this.sim.realms.realm(civ);
    this.rename(civ, day);
    const F = REALM_FORMS[form];
    if (C.holder) C.holder.termEnd = F.term ? day + F.term : null;
    if (F.shareCap && R.share > F.shareCap) R.share = F.shareCap;
    // A holy realm keeps the temple tithe in every town.
    if (form === 'theocracy') for (const L of this.sim.realms.memberLayouts(civ)) {
      L.econ.laws ||= {};
      L.econ.laws.templeTithe = true;
    }
    this.sim.realms.proclaim(civ, day, `The ${plain(civ)} is a ${F.name.toLowerCase()} now${was && was !== form ? ` (it was a ${REALM_FORMS[was].name.toLowerCase()})` : ''}.`);
    if (C.holder) this.office.show(C.holder.pid, 'realmform', { civ: civ.id, form, sid: R.capital });
  }

  // Something the ruler puts forward: a decree, a reform. Decreed at once
  // under a monarch; else a matter for the vote.
  propose(civ, kind, a, b) {
    const C = this.realms[civ.id];
    if (!C || !C.holder || C.holder.pid !== this.pid()) return { ok: false, why: 'Only the ruler can.' };
    let spec = null;
    if (kind === 'decree') {
      const cur = this.decreeNow(civ, a, b);
      if (cur === b || (a === 'tariff' && cur === !!b.v)) return { ok: false, why: 'So it stands already.' };
      const fx = a === 'tariff' ? { decree: 'tariff', civ: b.civ, v: b.v } : { decree: a, v: b };
      spec = { key: `decree:${a}${a === 'tariff' ? `:${b.civ}` : ''}`, kind: 'decree', title: `Decree: ${this.stated(civ, { fx }).text}?`, why: ['Your own proposal.'], opts: [{ label: 'Decree it', fx }, { label: 'Withdraw it', fx: {}, trivial: true }] };
    } else if (kind === 'form') {
      if (a === this.R(civ).form) return { ok: false, why: 'So it is already.' };
      spec = { key: 'form', kind: 'form', super: true, title: `Make the realm a ${REALM_FORMS[a].name.toLowerCase()}?`, why: REALM_FORMS[a].rules, opts: [{ label: `Make it a ${REALM_FORMS[a].name.toLowerCase()}`, fx: { form: a } }, { label: 'Withdraw it', fx: {}, trivial: true }] };
    } else if (kind === 'aid' || kind === 'road' || kind === 'relief') {
      const s = this.game.world.ow.settlements[a];
      const fx = kind === 'aid' ? { aid: { sid: a, n: 60 }, favour: { [a]: 8 } } : kind === 'road' ? { road: a, favour: { [a]: 5 } } : { relief: a, favour: { [a]: 6 } };
      spec = { key: `${kind}:${a}`, kind, title: kind === 'aid' ? `Send ¤60 to ${s.name}?` : kind === 'road' ? `A road to ${s.name}?` : `Lighter tribute for ${s.name}?`, why: ['Your own proposal.'], opts: [{ label: 'Do it', fx }, { label: 'Withdraw it', fx: {}, trivial: true }] };
    } else if (kind === 'war' || kind === 'ally' || kind === 'sue') {
      const o = this.civ(a);
      const fx = kind === 'war' ? { war: a } : kind === 'ally' ? { allyAsk: a } : { sue: true };
      spec = { key: `${kind}:${a}`, kind, title: kind === 'war' ? `War with the ${plain(o)}?` : kind === 'ally' ? `Offer the ${plain(o)} an alliance?` : 'Sue for peace?', why: ['Your own proposal.'], opts: [{ label: kind === 'war' ? 'Declare war' : kind === 'ally' ? 'Send envoys' : 'Ask for terms', fx: kind === 'ally' ? { act: 'envoys', to: a } : fx }, { label: 'Withdraw it', fx: {}, trivial: true }] };
    } else if (kind === 'depose') {
      const T = this.office.of(a);
      if (!T || !T.holder) return { ok: false, why: 'Nobody governs it who plays.' };
      spec = { key: `depose:${a}`, kind, title: `Depose ${T.holder.name} of ${this.game.world.ow.settlements[a].name}?`, why: ['Your own proposal.'], opts: [{ label: 'Depose them', fx: { depose: a, favour: { [a]: -8 } } }, { label: 'Withdraw it', fx: {}, trivial: true }] };
    }
    if (!spec) return { ok: false, why: '?' };
    C.agenda = C.agenda.filter((q) => !(q.key === spec.key && !q.done && q.mine));
    spec.prio = 6;
    spec.mine = true;
    const it = this.addItem(C, spec, this.game.day);
    // (A monarch's word is law: decreed there and then.)
    const F = REALM_FORMS[this.R(civ).form] || REALM_FORMS.monarchy;
    if (F.vote === 'decree' || F.vote === 'temple') return { ok: true, item: it, ...this.decide(civ, it.id, 0) };
    return { ok: true, item: it };
  }

  decreeNow(civ, key, b) {
    const R = this.R(civ);
    if (key === 'share') return R.share;
    if (key === 'tariff') return R.decrees.tariffOn.includes(b.civ);
    if (key === 'watch') return R.decrees.watch || 'standard';
    if (key === 'draft') return R.decrees.draft || 'none';
    return R.decrees[key];
  }

  // ------------------------------------------------------------ overruled
  overrule(civ, C, day, rng) {
    const form = this.R(civ).form;
    const F = REALM_FORMS[form] || REALM_FORMS.monarchy;
    // A council's or moot's or league's patience.
    if ((F.vote === 'council' || F.vote === 'moot' || F.vote === 'league') && C.lowDays >= 5) {
      const v = this.confidence(civ, C);
      if (v.state !== 'carried') return this.depose(civ, `${F.vote === 'council' ? 'the council' : F.vote === 'moot' ? 'the moot' : 'the league'} voted no confidence (${v.aye} to ${v.nay})`, day);
      C.lowDays = 0;
    }
    // A term's end: the council (or the league) chooses again.
    if (C.holder.termEnd && day >= C.holder.termEnd) {
      const v = this.confidence(civ, C);
      if (v.state !== 'carried') return this.depose(civ, `not chosen again at the term's end (${v.aye} to ${v.nay})`, day);
      C.holder.termEnd = day + F.term;
      this.sim.realms.proclaim(civ, day, `${this.who(civ)} is chosen to lead the ${plain(civ)} for another term (${v.aye} to ${v.nay}).`);
    }
    void rng;
    return null;
  }

  // Does the realm (its council, moot or league) still back its ruler?
  confidence(civ, C) {
    const it = { id: -1, opts: [{ label: 'Confidence', fx: {}, sense: ((C.lastOverall ?? 50) - 45) / 50 }] };
    const v = this.vote(civ, C, it, 0);
    for (const b of v.ballots) if (b.v === null) b.v = -1;
    this.tally(v);
    return v;
  }

  // ------------------------------------------------------------ the ways
  // When a realm's ruler dies (see realms.court): a player named heir comes
  // to the throne; a council may choose a player who sits on it. Whether a
  // player was crowned.
  succession(civ, capL, old, day) {
    const heir = this.heirs[civ.id];
    if (heir && heir.pid) {
      // (Someone of the court keeps the realm's daily business: the
      // chancellor.)
      const next = this.sim.realms.successor(civ, capL, old);
      if (next) this.sim.realms.crown(civ, capL, next.rec, day, null);
      this.crownPlayer(civ, heir.pid, heir.name, 'inheritance', day);
      return true;
    }
    if (formOf(civ) === 'council') {
      const seats = this.office.realmSeats(civ).filter((T) => (T.lastOverall ?? 0) >= 50 && !this.heldBy(T.holder.pid) && !this.office.asPid(T.holder.pid, () => isOutworlder(this.game.hero)));
      if (seats.length && (hash4(civ.id, day, 0x5cc) % 100) < 60) {
        const T = seats.sort((a, b) => (b.lastOverall ?? 0) - (a.lastOverall ?? 0))[0];
        this.office.offer(T.holder.pid, capL, 'crown', `The council of the ${plain(civ)} would have you lead the realm as its speaker.`, 2, { civ: civ.id });
      }
    }
    return false;
  }

  // An heirless monarch may name a player heir: one who governs a town of
  // the realm well, and is known at court. (Each sitting, at the capital.)
  heirCheck(civ, capL, day) {
    if (this.ruled(civ) || this.heirs[civ.id] || formOf(civ) !== 'monarch') return null;
    const ruler = this.sim.realms.ruler(civ);
    if (!ruler || (ruler.children || []).some((i) => capL.npcs[i] && alive(capL.npcs[i]) && capL.npcs[i].age !== 'child')) return null;
    if (this.office.offers.some((o) => o.how === 'heir' && o.civ === civ.id)) return null;
    for (const T of Object.values(this.office.towns)) {
      if (!T.holder || (T.highDays || 0) < 5) continue;
      const s = this.game.world.ow.settlements[T.sid];
      if (!s || s.civ !== civ || this.heldBy(T.holder.pid)) continue;
      // (Round 123: never one not of this world.)
      const known = this.office.asPid(T.holder.pid, () => !isOutworlder(this.game.hero) && ((this.sim.renown.get(capL.settlement.id) || 0) >= 10 || (this.sim.renown.get(T.sid) || 0) >= 25));
      if (!known || (hash4(civ.id, day, 0x4e1) % 100) >= 20) continue;
      return this.office.offer(T.holder.pid, capL, 'heir', `${this.sim.realms.rulerName(civ)} has no heir, and would name you: you'd rule the ${plain(civ)} when they die.`, 3, { civ: civ.id });
    }
    return null;
  }

  // Seize the throne: hold the capital, with half its watch behind you.
  canUsurp(civ) {
    const capS = this.sim.realms.capitalOf(civ);
    if (!capS || this.ruled(civ)) return { ok: false, why: 'Not now.' };
    if (!this.office.isHolder(capS.id)) return { ok: false, why: `Only whoever governs ${capS.name} could.` };
    const L = this.sim.layoutOf(capS.id);
    const P = this.office.plotStrength(L);
    if (P.share < 0.5) return { ok: false, why: `Half the watch of ${capS.name} must stand with you (${P.n} of ${P.of} do).` };
    return { ok: true };
  }

  usurp(civ) {
    const t = this.canUsurp(civ);
    if (!t.ok) return t;
    const capS = this.sim.realms.capitalOf(civ);
    const L = this.sim.layoutOf(capS.id);
    this.office.town(L).plot = null;
    this.crownPlayer(civ, this.pid(), this.game.playerName, 'usurpation', this.game.day, { form: 'monarchy' });
    return { ok: true };
  }

  // Stand for speaker, sitting on a republic's council: the council
  // decides there and then.
  standForSpeaker(civ) {
    const T = this.office.heldBy(this.pid());
    if (formOf(civ) !== 'council' || this.ruled(civ) || !T || !T.realm.seat) return { ok: false, why: 'Only a member of the realm\'s council can stand.' };
    const day = this.game.day;
    if ((T.speakerTry ?? -99) > day - 10) return { ok: false, why: 'The council heard you not long ago.' };
    T.speakerTry = day;
    const R = this.R(civ);
    let aye = 1;
    let nay = 0;
    for (const p of R.council) {
      const r = this.sim.realms.recOf(p);
      if (!r || !alive(r)) continue;
      const u = ((T.lastOverall ?? 50) - 55) / 40 + noise(r.idx, day, 0x5be) * 0.8 - (isOutworlder(this.game.hero) ? 0.5 : 0);
      if (u > 0) aye++;
      else nay++;
    }
    const sitting = this.sim.realms.ruler(civ);
    if (sitting) nay++;
    const won = aye > nay;
    if (won) this.crownPlayer(civ, this.pid(), this.game.playerName, 'election', day);
    else this.sim.realms.proclaim(civ, day, `${this.game.playerName} stood for speaker of the ${plain(civ)}, and the council would not have them (${aye} to ${nay}).`);
    return { ok: true, won, aye, nay };
  }

  // ------------------------------------------------------------ each frame
  update() {
    const now = this.sim.abs;
    for (const C of Object.values(this.realms)) {
      if (!C.holder || !C.agenda.length) continue;
      const civ = this.civ(C.civ);
      if (!civ) continue;
      for (const it of C.agenda) {
        if (it.done) continue;
        if (it.crisis && it.state === 'open' && it.until <= now) this.lapse(civ, C, it, this.game.day);
        else if (it.state === 'voting' && it.vote && now - it.vote.at >= 120) this.finishVote(civ, C, it);
      }
      C.agenda = C.agenda.filter((q) => !q.done);
    }
  }

  hudLines() {
    const C = this.heldBy(this.pid());
    if (!C) return [];
    const civ = this.civ(C.civ);
    const cr = C.agenda.find((q) => q.crisis && !q.done && q.state === 'open');
    const out = [];
    if (cr) {
      const left = Math.max(0, cr.until - this.sim.abs);
      out.push({ text: `!! REALM ${Math.floor(left / 60)}h${String(Math.floor(left % 60)).padStart(2, '0')} · N`, color: '#ff7060', blink: true });
    }
    const n = C.agenda.filter((q) => !q.done && q.state === 'open' && !q.crisis).length;
    out.push({ text: `${shortTitle(civ)} · ${n ? `${n} matter${n > 1 ? 's' : ''} (N)` : 'N: the crown'}`.slice(0, 24), color: '#ffd070' });
    return out;
  }

  // ------------------------------------------------------------ kept
  serialize() {
    return { realms: this.realms, heirs: this.heirs };
  }

  load(d) {
    if (!d) return;
    this.realms = d.realms || {};
    this.heirs = d.heirs || {};
  }
}

// ------------------------------------------------------------ crisis acts
const CROWN_ACTS = {
  pretender_pay: (c, civ, C, day) => {
    const capL = c.capitalL(civ);
    if (!capL || capL.econ.treasury < 150) return CROWN_ACTS.pretender_crush(c, civ, C, day);
    capL.econ.treasury -= 150;
    C.lowDays = 0;
    return 'paid the pretender ¤150 to renounce their claim';
  },
  pretender_crush: (c, civ, C, day) => {
    const capL = c.capitalL(civ);
    const loy = capL ? c.loyaltyOf(civ, capL) : 0;
    if (loy >= 45 || hash4(civ.id, day, 0xc2e) % 100 < loy) {
      C.lowDays = 0;
      for (const k of Object.keys(C.favour)) C.favour[k] = (C.favour[k] || 0) - 3;
      return 'had the pretender arrested';
    }
    c.depose(civ, 'overthrown by a pretender: the capital\'s watch would not arrest them', day);
    return null;
  },
  abdicate: (c, civ, C, day) => {
    c.depose(civ, 'abdicated', day);
    return null;
  },
  calm: () => 'won the town back with concessions',
  garrison: (c, civ, C, day, it) => {
    const L = it && it.by !== null ? c.sim.layoutOf(it.by) : null;
    if (L) {
      L.econ.unrest = 0;
      L.econ.secedeVotes = 0;
    }
    return L ? `sent the capital's watch to ${L.settlement.name}` : null;
  },
  release: (c, civ, C, day, it) => {
    const L = it && it.by !== null ? c.sim.layoutOf(it.by) : null;
    if (!L || c.sim.realms.isCapital(L.settlement)) return null;
    c.sim.realms.secede(L, day, new RNG(hash4(L.settlement.id, day, 0x2e1)), null);
    return `let ${L.settlement.name} go`;
  },
  envoys: (c, civ, C, day, it, fx) => {
    const o = c.civ(fx.to);
    if (!o) return null;
    const OC = c.of(o);
    if (OC) {
      c.allianceOffer(o, civ, day);
      return `sent envoys to offer the ${plain(o)} an alliance`;
    }
    const r = c.sim.realms.relation(civ, o);
    if (r.score >= 25 && !c.sim.politics.clash(civ, o)) {
      c.sim.politics.ally(civ, o, day);
      return `sent envoys, and the ${plain(o)} swore an alliance`;
    }
    return `sent envoys to the ${plain(o)}, who would not ally with the realm`;
  },
};

export { REALM_FORMS, FORM_IDS, SHARES, rulerTitle, authority, countItem, removeItem };
