// Towns and their people, for mods' graphs (round 65): which town a place
// or a person is in, what's known of it (its coffers, its people, its
// laws, its mood), and changing it (taxes, laws, stores, a feast day, a
// newcomer, someone's trade). Everything a graph does to a town goes
// through here (see the Towns nodes in nodes.js, and SVC in hooks.js).
import { ITEMS } from '../world/items.js';
import { alive, ledger, mayorOf, stockOf, initEcon } from '../sim/econ.js';
import { LAWS, LAW_IDS, lawOn } from '../sim/laws.js';
import { JOBS, jobTitle, retrain } from '../entities/npcgen.js';
import { newcomer } from '../sim/civic.js';
import { personName, familyName } from '../world/names.js';
import { RNG, hash4, hashString } from '../util/rng.js';
import { townMid } from '../sim/saga/refs.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const DAY = 24 * 60;
export { TOWN_FACTS, TOWN_CHANGES, PERSON_FACTS, PERSON_CHANGES, LAW_LIST, JOB_LIST } from './townlists.js';

const mid = (s) => townMid(s);

// A town as a graph hands it about: { t: 'town', sid, name, x, y, z }
// (a place too: its middle).
export function townValue(game, s) {
  if (!s) return null;
  const m = mid(s);
  const y = game && game.world ? game.world.findStandY(m.x, m.z) : 6;
  return { t: 'town', sid: s.id, name: s.name, x: m.x, y: y > 0 ? y : 6, z: m.z };
}

// The town meant by `v`: a town, a person of one, a place in one, a name.
export function townOf(game, v) {
  const ow = game && game.world && game.world.ow;
  if (!ow || v === null || v === undefined) return null;
  const S = ow.settlements;
  if (typeof v === 'object') {
    if (v.t === 'town') return S[v.sid] || null;
    if (v.kind === 'npc' && v.settlement) return v.settlement;
    if (v.rec && v.rec.sid !== undefined) return S[v.rec.sid] || null;
    if (typeof v.x === 'number' && typeof v.z === 'number') return ow.settlementAt(Math.round(v.x), Math.round(v.z)) || null;
    return null;
  }
  if (typeof v === 'number') return S[v] || null;
  const name = String(v).trim().toLowerCase();
  return S.find((s) => s && !s.deserted && s.name.toLowerCase() === name) || null;
}

// The nearest town to a place (of a kind, if `kind`), and how far.
export function nearestTown(game, at, kind = null) {
  if (!at) return null;
  let best = null;
  let bd = Infinity;
  for (const s of game.world.ow.settlements) {
    if (!s || s.deserted || (kind && kind !== 'any' && s.type !== kind)) continue;
    const m = mid(s);
    const d = Math.hypot(m.x - at.x, m.z - at.z);
    if (d < bd) {
      bd = d;
      best = s;
    }
  }
  return best;
}

// Its layout (laid out if it isn't yet) and its books.
function layoutOf(game, s) {
  const L = game.world.getLayout(s);
  if (L && !L.econ) initEcon(L);
  return L;
}
const living = (L) => L.npcs.filter((r) => alive(r) && !r.migrated && !r.away);

// What's known of a town.
export function townFact(game, s, what) {
  if (!s) return what === 'at war' || what === 'wanted' ? false : what === 'name' ? '' : 0;
  switch (what) {
    case 'name': return s.name;
    case 'kind': return s.type;
    case 'island': return s.island || '';
    case 'realm': return s.civ ? s.civ.name : '';
    case 'condition': return s.condition || 'normal';
    case 'at war': return !!(game.sim && game.sim.war && s.civ && game.sim.war.atWar(s.civ));
    case 'wanted': return !!game.isWanted?.(s.id);
    case 'weather': return game.weatherIn ? game.weatherIn(s) : 'clear';
    case 'your standing': return game.sim ? Math.round(game.sim.areaMod(s.id) + (game.sim.saga ? game.sim.saga.townMod(s.id) : 0)) : 0;
    default:
  }
  const L = layoutOf(game, s);
  if (!L) return 0;
  const e = L.econ;
  const live = living(L);
  switch (what) {
    case 'people': return live.length;
    case 'coffers': return Math.round(e.treasury || 0);
    case 'tax %': return Math.round((e.tax || 0) * 100);
    case 'mood': return live.length ? Math.round((100 * live.reduce((a, r) => a + (r.mood ?? 0.5), 0)) / live.length) : 0;
    case 'wood': return Math.round(stockOf(L).wood);
    case 'stone': return Math.round(stockOf(L).stone);
    case 'guards': return live.filter((r) => r.job === 'guard').length;
    case 'ruler': {
      const m = mayorOf(L);
      return m ? `${m.name.first} ${m.name.last}` : '';
    }
    case 'laws': return LAW_IDS.filter((k) => lawOn(L, k)).map((k) => LAWS[k].name).join(', ');
    case 'feast days ago': return Math.max(0, game.day - (e.festival ?? -99));
    default: return 0;
  }
}

// A change to a town; true if it took. `how` 'set' | 'add' for numbers.
export function changeTown(game, s, what, o = {}) {
  if (!s) return false;
  const L = layoutOf(game, s);
  if (!L) return false;
  const e = L.econ;
  const n = typeof o.value === 'number' ? o.value : parseFloat(o.value) || 0;
  const by = (cur) => (o.how === 'set' ? n : cur + n);
  const say = (t) => ledger(L, game.day, t);
  switch (what) {
    case 'coffers':
      e.treasury = Math.max(0, Math.round(by(e.treasury || 0)));
      return true;
    case 'tax %':
      e.tax = clamp(by(Math.round((e.tax || 0) * 100)), 0, 60) / 100;
      return true;
    case 'everyone\'s mood':
      for (const r of living(L)) r.mood = clamp(o.how === 'set' ? n / 100 : (r.mood ?? 0.5) + n / 100, 0, 1);
      return true;
    case 'wood':
    case 'stone': {
      const k = stockOf(L);
      k[what] = clamp(Math.round(by(k[what] || 0)), 0, 999);
      return true;
    }
    case 'a law': {
      if (!LAWS[o.law]) return false;
      e.laws ||= {};
      e.laws[o.law] = !!o.on;
      if (o.say !== false) say(o.on ? `Law: ${LAWS[o.law].desc}` : `The law is lifted: ${LAWS[o.law].name.toLowerCase()}.`);
      game.sim?.areaCache?.clear?.();
      return true;
    }
    case 'name': {
      const nm = String(o.text || '').trim().slice(0, 32);
      if (!nm) return false;
      say(`${s.name} is to be called ${nm} from now on.`);
      s.name = nm;
      return true;
    }
    case 'a feast day': {
      const spend = Math.max(0, Math.round(n));
      e.festival = game.day;
      if (game.sim && game.sim.events && game.sim.events.feast) game.sim.events.feast(L, game.day, spend);
      else for (const r of living(L)) r.mood = clamp((r.mood ?? 0.5) + 0.12, 0, 1);
      return true;
    }
    case 'your standing': {
      const saga = game.sim && game.sim.saga;
      if (!saga) return false;
      for (const { pid } of saga.players()) saga.townSay(pid, s.id, Math.round(n), false);
      game.sim.areaCache?.delete?.(s.id);
      return true;
    }
    case 'wanted': {
      if (o.how === 'set' && n <= 0) game.wanted.delete(s.id);
      else game.wanted.set(s.id, Math.max(0, Math.round(by(game.wanted.get(s.id) || 0))));
      if ((game.wanted.get(s.id) || 0) <= 0) game.wanted.delete(s.id);
      return true;
    }
    case 'a line in its records':
      if (!o.text) return false;
      say(String(o.text).slice(0, 200));
      return true;
    case 'stock a shop': {
      const it = o.item;
      if (!it || !ITEMS[it]) return false;
      // (The first shop that deals in it, else the general store, else any.)
      const biz = Object.entries(e.biz || {}).map(([id, b]) => ({ id: +id, b, bld: L.buildings[+id] })).filter((q) => q.bld);
      const pick = biz.find((q) => q.bld.type === o.shop) || biz.find((q) => q.bld.type === 'shop') || biz[0];
      if (!pick) return false;
      pick.b.store[it] = (pick.b.store[it] || 0) + Math.max(1, Math.round(n || 1));
      return true;
    }
    default:
      return false;
  }
}

// ------------------------------------------------------------ people
// Whose record an entity (or a record) is, with its town.
export function personOf(game, v) {
  if (!v || typeof v !== 'object') return null;
  if (v.kind === 'npc' && v.rec) return { rec: v.rec, ent: v, L: v.layout || game.world.layouts.get(v.settlement?.id) };
  if (v.idx !== undefined && v.sid !== undefined && v.name) return { rec: v, ent: v.ent || null, L: game.world.layouts.get(v.sid) };
  return null;
}

export function personFact(game, v, what) {
  const P = personOf(game, v);
  if (!P) return what === 'alive' || what === 'married' ? false : what === 'home' || what === 'work' || what === 'town' ? null : '';
  const r = P.rec;
  const L = P.L;
  const s = L ? L.settlement : null;
  switch (what) {
    case 'name': return `${r.name.first} ${r.name.last}`;
    case 'first name': return r.name.first;
    case 'trade': return jobTitle(r, s);
    case 'trade (its key)': return r.job;
    case 'age': return r.age;
    case 'mood': return Math.round((r.mood ?? 0.5) * 100);
    case 'coins': return Math.round(r.coins || 0);
    case 'thinks of you': return P.ent && game.sim ? Math.round(game.sim.opinion(P.ent)) : game.sim && s ? game.sim.repEntry(s.id, r.idx).v : 0;
    case 'traits': return (r.traits || []).join(', ');
    case 'town': return s ? townValue(game, s) : null;
    case 'alive': return alive(r);
    case 'married': return r.partner !== null && r.partner !== undefined;
    case 'children': return (r.children || []).length;
    case 'home':
    case 'work': {
      const b = L && (what === 'home' ? L.buildings[r.home] : r.work && r.work.building !== null && r.work.building !== undefined ? L.buildings[r.work.building] : null);
      if (!b) return null;
      // (At its door: where someone would go to it.)
      const x = b.door ? b.door.x : Math.round((b.x0 + b.x1) / 2);
      const z = b.door ? b.door.z : Math.round((b.z0 + b.z1) / 2);
      const y = game.world.findStandY(x, z);
      return { x, y: y > 0 ? y : 6, z };
    }
    default: return '';
  }
}

export function changePerson(game, v, what, o = {}) {
  const P = personOf(game, v);
  if (!P) return false;
  const r = P.rec;
  const n = typeof o.value === 'number' ? o.value : parseFloat(o.value) || 0;
  switch (what) {
    case 'trade': {
      if (!JOBS[o.job] || !P.L || r.age !== 'adult') return false;
      retrain(P.L, r, o.job, new RNG(hash4(r.idx, game.day, hashString(o.job))));
      if (P.ent && P.ent.look) P.ent.look = r.look;
      ledger(P.L, game.day, `${r.name.first} ${r.name.last} is a ${JOBS[o.job].title.toLowerCase()} now.`);
      return true;
    }
    case 'coins':
      r.coins = Math.max(0, Math.round(o.how === 'set' ? n : (r.coins || 0) + n));
      return true;
    case 'mood':
      r.mood = clamp(o.how === 'set' ? n / 100 : (r.mood ?? 0.5) + n / 100, 0, 1);
      return true;
    case 'what they think of you':
      if (!game.sim) return false;
      if (P.ent) game.sim.changeRep(P.ent, n);
      else game.sim.changeRep(r, n);
      return true;
    case 'add a trait':
    case 'take a trait': {
      const t = String(o.text || '').trim().toLowerCase();
      if (!t) return false;
      r.traits ||= [];
      if (what === 'add a trait' && !r.traits.includes(t)) r.traits.push(t);
      if (what === 'take a trait') r.traits = r.traits.filter((q) => q !== t);
      return true;
    }
    case 'first name': {
      const t = String(o.text || '').trim().slice(0, 20);
      if (!t) return false;
      r.name = { ...r.name, first: t };
      if (P.ent) P.ent.name = `${t} ${r.name.last}`;
      return true;
    }
    default:
      return false;
  }
}

// Someone new comes to live in a town (a trade of theirs if it has work
// for one). Their record, or null.
export function newcomerIn(game, s, o = {}) {
  const L = s && layoutOf(game, s);
  if (!L || !game.sim) return null;
  const rng = new RNG(hash4(s.seed, L.npcs.length, game.day, 0x6d0d));
  const style = s.style || 'vale';
  const name = o.first ? { first: String(o.first).slice(0, 20), last: familyName(rng, style) } : personName(rng, style, familyName(rng, style));
  const r = newcomer(game.sim, L, { name, job: JOBS[o.job] ? o.job : undefined, why: 'arrived' });
  if (r) ledger(L, game.day, `${r.name.first} ${r.name.last} came to live in ${s.name}.`);
  return r;
}

// The people of a town (live ones, as entities, where they're about; else
// their records), of a trade if `job`.
export function peopleOf(game, s, job = null) {
  if (!s) return [];
  const act = game.active && game.active.get(s.id);
  if (act) return act.npcs.filter((n) => !n.dead && (!job || job === 'anyone' || n.rec.job === job));
  const L = game.world.layouts.get(s.id);
  return L ? living(L).filter((r) => !job || job === 'anyone' || r.job === job) : [];
}

export { DAY };
