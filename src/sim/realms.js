// Realms. Each civilization is ruled from its capital, its largest city, by
// a ruler whose title depends on the culture: a monarch (a jarl, a sultan,
// a thane...), a council under its speaker, or a high elder. Rulers are
// townsfolk of the capital like anyone else: they grow old and die, and
// someone succeeds them. The ruler issues decrees every town of the realm
// keeps on top of its own laws (a floor under taxes, a weapons ban, a
// tariff on another realm's merchants). Towns send a share of their taxes
// to the capital, and the capital spends it on its poorer towns: coin for
// the watch, a guard sent, a road, a wall.
//
// Realms also get on with each other, or don't: friendly, wary or hostile,
// moved by how much they trade, land their towns both want, and how each
// treats the other's merchants.
import { alive, ledger, stockOf } from './econ.js';
import { deserted } from './civic.js';
import { retrain } from '../entities/npcgen.js';
import { RNG, hash4, clamp } from '../util/rng.js';

// Titles of a realm's ruler, by what the realm calls itself.
const MONARCH_TITLES = { Jarldom: 'Jarl', Thanedom: 'Thane', Sultanate: 'Sultan', Emirate: 'Emir', Caliphate: 'Caliph', Satrapy: 'Satrap', Protectorate: 'Protector', Hegemony: 'Hegemon' };
const COUNCIL_WORDS = ['Free Towns', 'Free Cities', 'Republic', 'Confederacy', 'Commonwealth', 'League', 'Union', 'Compact', 'Alliance', 'Free State', 'Serpent Council'];
const ELDER_WORDS = ['Shire', 'Clans', 'Holds', 'Hold', 'Tribes'];

export function formOf(civ) {
  const n = civ.name || '';
  if (COUNCIL_WORDS.some((w) => n.includes(w))) return 'council';
  if (ELDER_WORDS.some((w) => new RegExp(`\\b${w}\\b`).test(n))) return 'elder';
  return 'monarch';
}

export function rulerTitle(civ) {
  const f = formOf(civ);
  if (f === 'council') return 'Speaker of the Council';
  if (f === 'elder') return 'High Elder';
  const k = Object.keys(MONARCH_TITLES).find((w) => (civ.name || '').includes(w));
  return k ? MONARCH_TITLES[k] : 'Monarch';
}

// Before a name: "Jarl Astrid Ironson", "Speaker Wafa al-Wahid".
export function shortTitle(civ) {
  const t = rulerTitle(civ);
  return t === 'Speaker of the Council' ? 'Speaker' : t;
}

// Who speaks for the realm in a decree: "the Crown", "the Council"...
export function authority(civ) {
  const f = formOf(civ);
  if (f === 'council') return 'the Council';
  if (f === 'elder') return 'the High Elder';
  const t = rulerTitle(civ);
  return t === 'Monarch' ? 'the Crown' : `the ${t}`;
}

export const STANDING = { friendly: 20, hostile: -20 };
// Colours for realms born by breaking away.
const FREE_COLORS = [
  { name: 'Teal', hex: '#2a9a9a', awning: 'awning_blue', rug: 'rug_blue' },
  { name: 'Umber', hex: '#9a6a3a', awning: 'awning_yellow', rug: 'rug_red' },
  { name: 'Rose', hex: '#c86a8a', awning: 'awning_red', rug: 'rug_red' },
  { name: 'Slate', hex: '#6a7a8a', awning: 'awning_blue', rug: 'rug_blue' },
];
export const TRIBUTE = { min: 0.06, max: 0.16 };
const TAX_FLOORS = [0, 0.04, 0.06, 0.08, 0.1];
const WALL_AID = { coins: 300, stone: 60 };

const residents = (L) => L.npcs.filter((r) => alive(r) && !r.away && !r.migrated && !r.visitor);
const fullName = (r) => `${r.name.first} ${r.name.last}`;
const respect = (r) => (r.personality?.kindness || 0) + (r.personality?.sociability || 0) * 0.6 + (r.skills?.trading || 0) + (r.age === 'elder' ? 0.5 : 0)
  + (r.job === 'noble' ? 1.5 : r.job === 'priest' ? 0.4 : r.job === 'merchant' ? 0.3 : 0);

export class Realms {
  constructor(game, sim) {
    this.game = game;
    this.sim = sim;
    this.extraCivs = []; // realms born since the world began (free states)
    this.allegiance = []; // [town id, realm id], in the order they changed
    this.state = {}; // civ id -> realm
    this.rel = {}; // "a:b" (a < b) -> { score, trade, contested, incidents }
    this.relDay = null;
  }

  get civs() {
    return this.game.world.ow.civs || [];
  }

  civOf(s) {
    return s && s.civ ? s.civ : null;
  }

  realm(civ) {
    if (!civ) return null;
    let R = this.state[civ.id];
    if (!R) {
      R = this.state[civ.id] = { capital: civ.capital, ruler: null, council: [], since: null, decrees: { taxFloor: 0, armsBan: false, tariffOn: [] }, share: 0.1, tribute: 0, aid: [], moved: null };
      if (civ.values && civ.values.includes('martial')) R.decrees.armsBan = true;
    }
    // (Towns read the realm's decrees straight off their civilization.)
    civ.decrees = R.decrees;
    return R;
  }

  members(civ) {
    return this.game.world.ow.settlements.filter((s) => s.civ === civ && !deserted(s) && s.condition !== 'abandoned');
  }

  // Towns of the realm whose books are open (laid out); others are left be.
  memberLayouts(civ) {
    const out = [];
    for (const s of this.members(civ)) {
      const L = this.game.world.layouts.get(s.id);
      if (L && L.econ) out.push(L);
    }
    return out;
  }

  popOf(s) {
    const L = this.game.world.layouts.get(s.id);
    if (L && L.econ) return residents(L).length + this.sim.playerCount(s.id);
    return { city: 40, town: 20, village: 10 }[s.type] || 10;
  }

  capitalOf(civ) {
    const R = this.realm(civ);
    return R ? this.game.world.ow.settlements[R.capital] : null;
  }

  isCapital(s) {
    const civ = this.civOf(s);
    return !!civ && this.realm(civ).capital === s.id;
  }

  // The largest city of the realm (a town, if it has no cities left). The
  // seat only moves when another place has clearly outgrown it, or the old
  // capital is gone.
  pickCapital(civ, day) {
    const R = this.realm(civ);
    const list = this.members(civ);
    if (!list.length) return null;
    const rank = (s) => (s.type === 'city' ? 1000 : s.type === 'town' ? 500 : 0) + this.popOf(s);
    const best = list.reduce((m, s) => (rank(s) > rank(m) ? s : m));
    const cur = this.game.world.ow.settlements[R.capital];
    const curOk = cur && list.includes(cur);
    if (curOk && (best === cur || rank(best) < rank(cur) * 1.3)) return cur;
    this.moveCourt(civ, cur && curOk ? cur : null, best, day);
    return best;
  }

  moveCourt(civ, from, to, day) {
    const R = this.realm(civ);
    const TL = this.sim.layoutOf(to.id);
    const who = [R.ruler, ...R.council].map((p) => this.recOf(p)).filter((r) => r && alive(r) && !r.migrated);
    R.capital = to.id;
    R.moved = day;
    if (from && who.length) {
      const FL = this.sim.layoutOf(from.id);
      const moved = this.sim.sendPeople(FL, who, TL, 'moving with the court');
      const map = new Map(who.map((r, i) => [r, moved[i]]));
      const ptr = (p) => {
        const r = this.recOf(p);
        const n = r && map.get(r);
        return n ? { sid: to.id, idx: n.idx } : p;
      };
      R.ruler = R.ruler ? ptr(R.ruler) : null;
      R.council = R.council.map(ptr);
    } else {
      R.ruler = null;
      R.council = [];
    }
    this.proclaim(civ, day, `The seat of the ${civ.name.replace(/^The /, '')} has moved to ${to.name}, now the realm's largest city.`);
  }

  recOf(p) {
    if (!p || !this.game.world.ow.settlements[p.sid]) return null;
    const L = this.game.world.layouts.get(p.sid) || this.sim.layoutOf(p.sid);
    return L ? L.npcs[p.idx] || null : null;
  }

  ruler(civ) {
    const R = this.realm(civ);
    if (R && !R.ruler) this.firstRuler(civ);
    const r = R && this.recOf(R.ruler);
    return r && alive(r) && !r.migrated ? r : null;
  }

  // The realm's first ruler, from the start of the world (no waiting for
  // the capital's first morning).
  firstRuler(civ) {
    const R = this.realm(civ);
    const capS = this.game.world.ow.settlements[R.capital];
    if (!capS || deserted(capS)) return null;
    const L = this.sim.layoutOf(capS.id);
    if (!L || !L.econ) return null;
    const next = this.successor(civ, L, null);
    if (!next) return null;
    const r = this.crown(civ, L, next.rec, this.sim.today(), null);
    ledger(L, this.sim.today(), `${shortTitle(civ)} ${fullName(r)} rules the ${civ.name.replace(/^The /, '')} from ${capS.name}.`);
    return r;
  }

  rulerName(civ) {
    const r = this.ruler(civ);
    return r ? `${shortTitle(civ)} ${fullName(r)}` : null;
  }

  // News for every town of the realm.
  proclaim(civ, day, text) {
    for (const L of this.memberLayouts(civ)) ledger(L, day, text);
  }

  // ------------------------------------------------------------ the court
  crown(civ, L, rec, day, how) {
    const R = this.realm(civ);
    const f = formOf(civ);
    for (const p of [R.ruler, ...R.council]) {
      const o = this.recOf(p);
      if (o && o !== rec && o.ruler === civ.id) delete o.ruler;
    }
    rec.ruler = civ.id;
    delete rec.councillor;
    R.council = R.council.filter((p) => !(p.sid === L.settlement.id && p.idx === rec.idx));
    // A ruler keeps a ruler's house: the town's work goes on without them.
    if (!['noble', 'mayor', 'priest'].includes(rec.job)) retrain(L, rec, 'noble', new RNG(hash4(rec.idx, day, 0xc0)));
    rec.look = { ...rec.look, outfit: 'noble', hat: f === 'monarch' ? 'circlet' : rec.look.hat === 'helmet' ? null : rec.look.hat };
    rec.retrained = true;
    const e = rec.ent;
    if (e && !e.dead) e.look = rec.look;
    R.ruler = { sid: L.settlement.id, idx: rec.idx };
    R.since = day;
    // How much the realm asks of its towns depends on the ruler.
    const k = rec.personality?.kindness ?? 0.5;
    R.share = Math.round(clamp(TRIBUTE.max - k * (TRIBUTE.max - TRIBUTE.min), TRIBUTE.min, TRIBUTE.max) * 100) / 100;
    if (how) this.proclaim(civ, day, how(`${shortTitle(civ)} ${fullName(rec)}`));
    return rec;
  }

  // Who comes next: a monarch's eldest grown child (or a noble of the
  // court), the council's most respected member, the oldest soul in the
  // capital for a high elder.
  successor(civ, L, old) {
    const f = formOf(civ);
    const people = residents(L).filter((r) => r.age !== 'child' && r !== old);
    if (!people.length) return null;
    if (f === 'monarch') {
      const kids = (old ? old.children || [] : []).map((i) => L.npcs[i]).filter((r) => r && people.includes(r)).sort((a, b) => (a.born ?? 0) - (b.born ?? 0));
      if (kids.length) return { rec: kids[0], why: 'heir' };
      const nobles = people.filter((r) => r.job === 'noble').sort((a, b) => respect(b) - respect(a));
      if (nobles.length) return { rec: nobles[0], why: 'noble' };
      return { rec: people.filter((r) => r.job !== 'guard').sort((a, b) => respect(b) - respect(a))[0] || people[0], why: 'chosen' };
    }
    if (f === 'elder') {
      const eldest = people.slice().sort((a, b) => (a.age === 'elder' ? 0 : 1) - (b.age === 'elder' ? 0 : 1) || (a.born ?? 0) - (b.born ?? 0))[0];
      return { rec: eldest, why: 'eldest' };
    }
    const council = this.realm(civ).council.map((p) => this.recOf(p)).filter((r) => r && people.includes(r));
    const pool = council.length ? council : people.filter((r) => r.job !== 'guard');
    return { rec: pool.sort((a, b) => respect(b) - respect(a))[0], why: council.length ? 'council' : 'chosen' };
  }

  // The capital's daily business: a ruler on the throne, a council filled,
  // decrees reviewed, and help for the realm's poorer towns.
  court(civ, L, day, rng) {
    const R = this.realm(civ);
    const f = formOf(civ);
    const title = shortTitle(civ);
    const cur = this.recOf(R.ruler);
    if (!this.ruler(civ)) {
      const first = !R.ruler;
      const next = this.successor(civ, L, cur);
      if (next) {
        const oldName = cur ? fullName(cur) : null;
        const why = { heir: 'eldest child', noble: 'the noble chosen by the court', council: 'chosen by the council', eldest: 'the eldest in', chosen: 'chosen by the people of' }[next.why];
        this.crown(civ, L, next.rec, day, first ? null : (nm) => (next.why === 'eldest' || next.why === 'chosen'
          ? `${title} ${oldName} is dead. ${nm}, ${why} ${L.settlement.name}, now leads the ${civ.name.replace(/^The /, '')}.`
          : `${title} ${oldName} is dead. ${nm}, ${why}${next.why === 'heir' ? ` of ${oldName.split(' ')[0]}` : ''}, now leads the ${civ.name.replace(/^The /, '')}.`));
        if (first) ledger(L, day, `${title} ${fullName(next.rec)} rules the ${civ.name.replace(/^The /, '')} from ${L.settlement.name}.`);
        else for (const r of residents(L)) r.mood = clamp((r.mood ?? 0.5) - 0.08, 0, 1);
      }
    }
    // A council keeps three seats (the speaker's among them).
    if (f === 'council') {
      R.council = R.council.filter((p) => {
        const r = this.recOf(p);
        return r && alive(r) && !r.migrated && p.sid === L.settlement.id;
      });
      const ruler = this.ruler(civ);
      while (R.council.length < 2) {
        const taken = new Set([ruler, ...R.council.map((p) => this.recOf(p))]);
        const pick = residents(L).filter((r) => r.age !== 'child' && !taken.has(r) && r.job !== 'guard' && r.job !== 'mayor').sort((a, b) => respect(b) - respect(a))[0];
        if (!pick) break;
        pick.councillor = civ.id;
        R.council.push({ sid: L.settlement.id, idx: pick.idx });
        if (R.since !== day) ledger(L, day, `${fullName(pick)} took a seat on the council of the ${civ.name.replace(/^The /, '')}.`);
      }
    }
    if ((day + civ.id) % 7 === 0) this.decree(civ, day, rng);
    if (day % 2 === 0) this.aid(civ, L, day);
    // (A merchant prince lays roads twice as often.)
    if ((day + civ.id) % 3 === 0 || (this.ambition(civ, day) === 'merchant' && (day + civ.id) % 3 === 1)) this.roadWorks(civ, L, day);
    if ((day + civ.id) % 5 === 2) this.pursue(civ, L, day, rng);
  }

  // ------------------------------------------------------------ ambitions
  // Some rulers (not all) have a dream they chase: a merchant prince wants
  // roads and markets; a zealot wants the faith carried everywhere; a
  // warlord wants a war. It's decided once, by who they are, and the court
  // hears of it.
  ambition(civ, day = this.sim.today()) {
    const r = this.ruler(civ);
    if (!r) return null;
    if (r.ambition !== undefined) return r.ambition;
    const p = r.personality || {};
    const vals = civ.values || [];
    const roll = (hash4(r.idx, civ.id, 0xa3b1) % 1000) / 1000;
    const score = {
      merchant: (vals.includes('mercantile') ? 0.4 : 0) + (p.diligence ?? 0.5) * 0.5 + ((r.traits || []).includes('shrewd') || (r.traits || []).includes('thrifty') ? 0.3 : 0),
      zealot: (vals.includes('pious') ? 0.5 : 0) + ((r.traits || []).includes('devout') ? 0.5 : 0) + (0.5 - (p.kindness ?? 0.5)) * 0.4,
      warlord: (vals.includes('martial') ? 0.4 : 0) + (p.temper ?? 0.5) * 0.5 + (p.bravery ?? 0.5) * 0.4,
    };
    const best = Object.entries(score).sort((a, b) => b[1] - a[1])[0];
    // (Most just rule.)
    r.ambition = roll < 0.45 && best[1] > 0.55 ? best[0] : null;
    if (r.ambition) {
      const title = shortTitle(civ);
      const text = {
        merchant: `${title} ${fullName(r)} means to make the ${civ.name.replace(/^The /, '')} rich: roads between every town, and a market in each.`,
        zealot: `${title} ${fullName(r)} has sworn to carry the faith to every corner of the land, and beyond its borders.`,
        warlord: `${title} ${fullName(r)} talks of little but war and glory. The neighbours had best watch their borders.`,
      }[r.ambition];
      this.proclaim(civ, day, text);
    }
    return r.ambition;
  }

  // Chasing it: a market for a town without one; missionaries over the
  // border (see religion.js); a warlord's quarrels (see war.js).
  pursue(civ, capL, day, rng) {
    const a = this.ambition(civ, day);
    if (a === 'merchant') {
      const L = this.memberLayouts(civ).find((q) => q.settlement.type !== 'village' && !q.buildings.some((b) => b.type === 'shop')
        && !this.sim.works.projects.some((pq) => !pq.done && pq.sid === q.settlement.id && pq.type === 'shop'));
      if (L && capL.econ.treasury >= 220) {
        const pq = this.sim.works.startBuilding(L, 'shop', `, paid for by ${shortTitle(civ).toLowerCase()} ${fullName(this.ruler(civ))}`, false, 120);
        if (pq) {
          capL.econ.treasury -= 120;
          ledger(L, day, `A market hall is going up in ${L.settlement.name}, paid for by the crown.`);
        }
      }
    } else if (a === 'zealot' && this.sim.religion) this.sim.religion.mission(civ, day, rng);
  }

  // ------------------------------------------------------------ roads
  // The realm ties itself together: the capital pays for a road at a time,
  // first from the capital out to each of its towns, then between towns of
  // the realm that sit near each other, and then to the nearest town of a
  // friendly neighbour. (Every realm does this, however far from you.)
  roadWorks(civ, capL, day) {
    const dip = this.sim.diplomacy;
    const mine = new Set(this.members(civ).map((s) => s.id));
    const building = dip.roads.filter((r) => !r.done && (mine.has(r.a) || mine.has(r.b))).length;
    const big = mine.size >= 6;
    if (building >= (big ? 2 : 1)) return null;
    const spare = capL.econ.treasury - residents(capL).length * 15;
    const COST = 120;
    if (spare < COST) return null;
    const capS = capL.settlement;
    const linked = (a, b) => dip.roads.some((r) => (r.a === a.id && r.b === b.id) || (r.a === b.id && r.b === a.id));
    const near = (a, b) => dip.dist(a, b);
    const towns = this.members(civ).filter((s) => s !== capS);
    let pair = null;
    // 1. Capital to its towns, nearest first.
    const out = towns.filter((s) => !linked(capS, s) && near(capS, s) < 12).sort((a, b) => near(capS, a) - near(capS, b))[0];
    if (out) pair = [capS, out];
    // 2. Neighbouring towns of the realm.
    if (!pair) {
      let best = null;
      for (const a of towns) {
        for (const b of towns) {
          if (a.id >= b.id || linked(a, b) || near(a, b) >= 8) continue;
          if (!best || near(a, b) < near(best[0], best[1])) best = [a, b];
        }
      }
      pair = best;
    }
    // 3. Over the border, to a friend.
    if (!pair) {
      let best = null;
      for (const a of [capS, ...towns]) {
        for (const b of this.game.world.ow.settlements) {
          if (mine.has(b.id) || deserted(b) || b.condition === 'abandoned' || linked(a, b) || near(a, b) >= 9) continue;
          const other = this.civOf(b);
          if (other && (this.standing(civ, other) !== 'friendly' || this.sim.war?.enemies?.(civ, other))) continue;
          if (!best || near(a, b) < near(best[0], best[1])) best = [a, b];
        }
      }
      pair = best;
    }
    if (!pair) return null;
    const [a, b] = pair;
    if (!dip.startRoad(a, b)) return null;
    capL.econ.treasury -= COST;
    const LA = this.sim.layoutOf(a.id);
    const LB = this.sim.layoutOf(b.id);
    if (LA && LA.econ) dip.rel(LA, b.id).road = true;
    if (LB && LB.econ) dip.rel(LB, a.id).road = true;
    const who = authority(civ);
    const Who = who[0].toUpperCase() + who.slice(1);
    const text = `${Who} is paying for a road from ${a.name} to ${b.name}. The builders start from both ends.`;
    ledger(capL, day, text);
    for (const L of [LA, LB]) if (L && L.econ && L !== capL) ledger(L, day, text);
    return { a: a.id, b: b.id };
  }

  // ------------------------------------------------------------ decrees
  // Once a week the ruler looks over the realm and may change one decree.
  decree(civ, day, rng) {
    const R = this.realm(civ);
    const ruler = this.ruler(civ);
    if (!ruler) return null;
    const d = R.decrees;
    const towns = this.memberLayouts(civ);
    if (!towns.length) return null;
    const who = authority(civ);
    const cap = (t) => t[0].toUpperCase() + t.slice(1);
    const p = ruler.personality || {};
    const violence = towns.reduce((n, L) => n + (L.econ.recent.violence || 0) + (L.econ.recent.raids || 0), 0);
    const poor = towns.filter((L) => L.econ.treasury < residents(L).length * 6).length;
    const i = TAX_FLOORS.indexOf(d.taxFloor);
    // Arms: trouble across the realm brings a ban; long calm (and a bold
    // ruler) lifts it (never in a martial realm).
    if (!d.armsBan && violence >= 3 + (p.bravery ?? 0.5) * 3) {
      d.armsBan = true;
      this.proclaim(civ, day, `By decree of ${who}: drawn weapons are forbidden in every town of the ${civ.name.replace(/^The /, '')}.`);
      return 'armsBan';
    }
    if (d.armsBan && violence === 0 && !(civ.values || []).includes('martial') && rng.chance(0.3 + (p.bravery ?? 0.5) * 0.4)) {
      d.armsBan = false;
      this.proclaim(civ, day, `${cap(who)} has lifted the realm's weapons ban.`);
      return 'armsBan';
    }
    // Tariffs follow how the realms get on.
    for (const o of this.civs) {
      if (o === civ) continue;
      const st = this.standing(civ, o);
      const on = d.tariffOn.includes(o.id);
      if (!on && st === 'hostile') {
        d.tariffOn.push(o.id);
        this.proclaim(civ, day, `By decree of ${who}: merchants of the ${o.name.replace(/^The /, '')} pay a tariff on all they sell here.`);
        return 'tariff';
      }
      if (on && st === 'friendly') {
        d.tariffOn = d.tariffOn.filter((q) => q !== o.id);
        this.proclaim(civ, day, `${cap(who)} has lifted the tariff on merchants of the ${o.name.replace(/^The /, '')}.`);
        return 'tariff';
      }
    }
    // A floor under every town's taxes when the realm is short; lower
    // again when it's flush (a kind ruler sooner).
    const capL = this.sim.layoutOf(R.capital);
    const flush = capL && capL.econ.treasury > residents(capL).length * 40;
    if (i < TAX_FLOORS.length - 1 && (poor * 2 > towns.length || (capL && capL.econ.treasury < residents(capL).length * 10)) && (p.kindness ?? 0.5) < 0.8) {
      d.taxFloor = TAX_FLOORS[i + 1];
      this.proclaim(civ, day, `By decree of ${who}: no town of the ${civ.name.replace(/^The /, '')} may tax less than ${Math.round(d.taxFloor * 100)}%.`);
      return 'taxFloor';
    }
    if (i > 0 && flush && rng.chance(0.3 + (p.kindness ?? 0.5) * 0.5)) {
      d.taxFloor = TAX_FLOORS[i - 1];
      this.proclaim(civ, day, d.taxFloor ? `${cap(who)} lowered the realm's least tax to ${Math.round(d.taxFloor * 100)}%.` : `${cap(who)} no longer sets a least tax for the towns.`);
      return 'taxFloor';
    }
    return null;
  }

  taxFloor(s) {
    const civ = this.civOf(s);
    return civ ? this.realm(civ).decrees.taxFloor : 0;
  }

  // Does this realm charge a tariff on merchants from `from`'s realm?
  tariffOn(host, from) {
    const a = this.civOf(host);
    const b = this.civOf(from);
    return !!(a && b && a !== b && this.realm(a).decrees.tariffOn.includes(b.id));
  }

  // ------------------------------------------------------------ tribute
  // After the morning's taxes, a share goes to the capital.
  tribute(L, day) {
    const s = L.settlement;
    const civ = this.civOf(s);
    if (!civ || deserted(s)) return 0;
    const R = this.realm(civ);
    if (R.capital === s.id || !L.econ.taxY) return 0;
    const capL = this.sim.layoutOf(R.capital);
    if (!capL || !capL.econ) return 0;
    const n = Math.min(L.econ.treasury, Math.floor(L.econ.taxY * R.share));
    if (n <= 0) return 0;
    L.econ.treasury -= n;
    capL.econ.treasury += n;
    L.econ.tributeY = n;
    L.econ.tributeDay = day;
    L.econ.tributeWeek = (L.econ.tributeWeek || 0) + n;
    R.tribute += n;
    return n;
  }

  // ------------------------------------------------------------ secession
  // Once a week a town weighs what it pays the capital against what it
  // gets back, how far off the capital is, and what's been decreed. Unrest
  // builds; when most of the town is for going it alone two weeks running,
  // it breaks away: free, or (near the border) to the neighbouring realm.
  unrestWeekly(L, day, rng) {
    const s = L.settlement;
    const civ = this.civOf(s);
    const e = L.econ;
    const R = this.realm(civ);
    const people = residents(L);
    const pop = people.length;
    const paid = e.tributeWeek || 0;
    e.tributeWeek = 0;
    const got = R.aid.filter((a) => a.sid === s.id && day - a.day <= 7).reduce((n, a) => n + (a.amount || 40), 0);
    const capS = this.game.world.ow.settlements[R.capital];
    const far = capS ? Math.hypot(capS.cx - s.cx, capS.cz - s.cz) : 0;
    const ruler = this.ruler(civ);
    let push = (paid - got) / Math.max(20, pop * 3);
    push += far > 9 ? 0.4 : far > 6 ? 0.15 : 0;
    push += R.decrees.taxFloor >= 0.08 ? 0.3 : R.decrees.taxFloor ? 0.1 : 0;
    push += R.share >= 0.13 ? 0.3 : 0;
    push -= got > 0 ? 0.6 : 0;
    push -= ruler ? ((ruler.personality?.kindness ?? 0.5) - 0.5) * 0.4 : 0;
    // A long war wears on everyone.
    push += this.sim.war ? this.sim.war.weariness(civ) * 0.5 : 0;
    e.unrest = Math.max(0, (e.unrest || 0) * 0.85 + push);
    e.independence = this.support(L);
    e.secedeVotes = e.independence > 0.3 ? (e.secedeVotes || 0) + 1 : 0;
    if (e.secedeVotes === 1) ledger(L, day, `There's talk in ${s.name} of breaking away from the ${civ.name.replace(/^The /, '')}.`);
    if (e.secedeVotes >= 2 && pop >= 12) return this.secede(L, day, rng);
    return null;
  }

  // How much of the town would go it alone (-1 none of it, 1 all of it).
  support(L) {
    const e = L.econ;
    const adults = residents(L).filter((r) => r.age !== 'child' && r.ruler === undefined);
    if (!adults.length) return 0;
    const lean = (r) => {
      const p = r.personality || {};
      const n = ((hash4(r.idx, 0x5ece) % 1000) / 1000 - 0.5) * 0.3;
      return clamp((e.unrest || 0) * 0.3 + ((p.bravery ?? 0.5) - 0.5) * 0.5 + (0.5 - (p.kindness ?? 0.5)) * 0.2 - 0.3 + n + (r.job === 'mayor' ? 0.1 : r.job === 'noble' ? -0.2 : 0), -1, 1);
    };
    return adults.reduce((n, r) => n + lean(r), 0) / adults.length;
  }

  // The nearest other realm with a town within reach of this one.
  neighbourRealm(s) {
    let best = null;
    for (const o of this.game.world.ow.settlements) {
      if (!o.civ || o.civ === s.civ || deserted(o) || o.condition === 'abandoned') continue;
      const d = Math.hypot(o.cx - s.cx, o.cz - s.cz);
      if (d <= 7 && (!best || d < best.d)) best = { civ: o.civ, d };
    }
    return best ? best.civ : null;
  }

  // The break: free (a realm of its own, and the old one hostile), or
  // (to = a neighbouring realm) sworn to another, which the old realm
  // takes harder still.
  secede(L, day, rng, to = undefined) {
    const s = L.settlement;
    const old = this.civOf(s);
    if (!old || this.realm(old).capital === s.id) return null;
    if (to === undefined) {
      const near = this.neighbourRealm(s);
      to = near && this.standing(old, near) !== 'friendly' && rng.chance(0.5) ? near : null;
    }
    const members = this.memberLayouts(old).filter((q) => q !== L);
    const civ = to || this.freeCiv(s, old);
    this.join(s, civ);
    this.allegiance.push([s.id, civ.id]);
    L.econ.secedeVotes = 0;
    L.econ.unrest = 0;
    L.econ.independence = null;
    if (to) {
      this.shift(old, to, -60, day);
      const text = `${s.name} has renounced the ${old.name.replace(/^The /, '')} and sworn itself to the ${to.name.replace(/^The /, '')}!`;
      for (const T of [...members, L, ...this.memberLayouts(to).filter((q) => q !== L)]) ledger(T, day, text);
    } else {
      const r = this.relation(old, civ);
      r.score = -45;
      r.standing = this.standingOf(r.score);
      for (const T of members) ledger(T, day, `${s.name} has declared itself free of the ${old.name.replace(/^The /, '')}. Treason, says ${authority(old)}.`);
      ledger(L, day, `${s.name} has declared its independence from the ${old.name.replace(/^The /, '')}! It is now the ${civ.name.replace(/^The /, '')}.`);
    }
    for (const r of residents(L)) r.mood = clamp((r.mood ?? 0.5) + 0.1, 0, 1);
    return { civ, from: old, joined: !!to };
  }

  freeCiv(s, old) {
    const ow = this.game.world.ow;
    const id = ow.civs.length;
    const civ = {
      id, style: old.style, values: (old.values || []).slice(), color: FREE_COLORS[id % FREE_COLORS.length], prosperity: old.prosperity || 0.5,
      name: `The ${s.name.replace(/^The /, '')} Free State`, people: old.people, capital: s.id, freed: { from: old.id, day: this.sim.today() },
    };
    ow.civs.push(civ);
    this.extraCivs.push(civ);
    this.realm(civ);
    return civ;
  }

  // A town under a new banner: its ground on the map goes with it.
  join(s, civ) {
    const ow = this.game.world.ow;
    const old = s.civ;
    s.civ = civ;
    // (Its gods don't change with its banner; see religion.js.)
    if (this.sim.religion && old && old !== civ) this.sim.religion.onConquest(s, old, civ, this.sim.today());
    const members = ow.settlements.filter((o) => o.civ === old && o !== s);
    for (let cz = s.cz - 5; cz <= s.cz + 5; cz++) {
      for (let cx = s.cx - 5; cx <= s.cx + 5; cx++) {
        const c = ow.cell(cx, cz);
        if (!c || (old && c.civ !== old.id && c.settlement !== s.id)) continue;
        const mine = Math.hypot(s.cx - cx, s.cz - cz);
        if (c.settlement === s.id || members.every((o) => Math.hypot(o.cx - cx, o.cz - cz) > mine)) c.civ = civ.id;
      }
    }
  }

  // ------------------------------------------------------------ aid
  // Every other day the capital looks for a town of the realm in need,
  // and pays from its own coffers (fed by everyone's tribute).
  aid(civ, capL, day) {
    const R = this.realm(civ);
    const who = authority(civ);
    const Who = who[0].toUpperCase() + who.slice(1);
    const capPop = residents(capL).length;
    const spare = capL.econ.treasury - capPop * 20;
    if (spare < 60) return null;
    const capS = capL.settlement;
    // (A town helped lately waits its turn.)
    const towns = this.memberLayouts(civ).filter((L) => L !== capL && !R.aid.some((a) => a.sid === L.settlement.id && day - a.day < 6));
    const pop = (L) => residents(L).length + this.sim.playerCount(L.settlement.id);
    const guards = (L) => residents(L).filter((r) => r.job === 'guard').length + this.sim.playerGuard(L.settlement.id);
    const note = (L, kind, text, amount = 0) => {
      R.aid.push({ day, sid: L.settlement.id, kind, amount });
      if (R.aid.length > 20) R.aid.shift();
      (L.econ.royalAid ||= []).push({ day, kind, amount });
      if (L.econ.royalAid.length > 8) L.econ.royalAid.shift();
      ledger(L, day, text);
      ledger(capL, day, `${Who} sent help to ${L.settlement.name}: ${kind === 'guard' ? 'a guard' : kind === 'road' ? 'a road' : kind === 'wall' ? 'a wall' : `¤${amount}`}.`);
      return { kind, sid: L.settlement.id, amount };
    };
    // 1. A town with no watch to speak of (or that can't pay it).
    const thin = towns.filter((L) => guards(L) < Math.max(1, Math.round(pop(L) / 14)) || L.econ.unpaid > 0).sort((a, b) => guards(a) - guards(b))[0];
    if (thin) {
      const capGuards = residents(capL).filter((r) => r.job === 'guard' && r.age === 'adult');
      if (guards(thin) === 0 && capGuards.length > 3) {
        const g = capGuards.sort((a, b) => b.personality.sociability - a.personality.sociability)[0];
        this.sim.sendPeople(capL, [g], thin, `sent by ${who}`);
        return note(thin, 'guard', `${Who} sent ${fullName(g)} of the ${capS.name.replace(/^The /, '')} watch to guard ${thin.settlement.name}.`);
      }
      const amount = Math.min(Math.round(spare * 0.4), 30 + pop(thin) * 3);
      if (amount >= 20) {
        capL.econ.treasury -= amount;
        thin.econ.treasury += amount;
        return note(thin, 'watch', `${Who} sent ¤${amount} to pay ${thin.settlement.name}'s watch.`, amount);
      }
    }
    // 2. A road to the capital for a town without one.
    const dip = this.sim.diplomacy;
    const noRoad = towns.filter((L) => !dip.roads.some((r) => (r.a === capS.id && r.b === L.settlement.id) || (r.b === capS.id && r.a === L.settlement.id)) && dip.dist(capS, L.settlement) < 10)
      .sort((a, b) => dip.dist(capS, a.settlement) - dip.dist(capS, b.settlement))[0];
    if (noRoad && spare >= 200) {
      if (dip.startRoad(capS, noRoad.settlement)) {
        capL.econ.treasury -= 150;
        dip.rel(capL, noRoad.settlement.id).road = true;
        dip.rel(noRoad, capS.id).road = true;
        return note(noRoad, 'road', `${Who} is paying for a road from ${capS.name} to ${noRoad.settlement.name}. The builders start from both ends.`, 150);
      }
    }
    // 3. A wall for a town beasts keep raiding (or a city without one).
    const exposed = towns.find((L) => !L.walled && L.settlement.type !== 'village' && ((L.econ.recent.raids || 0) >= 1 || L.settlement.type === 'city') && pop(L) >= 18
      && !this.sim.works.active(L.settlement.id).some((p) => p.kind === 'wall') && L.econ.treasury < WALL_AID.coins + 100);
    if (exposed && spare >= WALL_AID.coins + 60 && exposed.wallPlan && exposed.wallPlan().tiles.length) {
      // Coin, and stone from the capital's stores (bought in where short).
      const k = stockOf(capL);
      const fromCap = Math.min(k.stone, WALL_AID.stone);
      k.stone -= fromCap;
      capL.econ.treasury -= WALL_AID.coins + (WALL_AID.stone - fromCap) * 2;
      this.sim.works.add({ sid: exposed.settlement.id, kind: 'wall', bid: exposed.buildings.length - 0.5, label: `a wall for ${exposed.settlement.name}, paid for by ${who}` });
      return note(exposed, 'wall', `${Who} is paying for a wall round ${exposed.settlement.name}.`, WALL_AID.coins);
    }
    // 4. Coin for the poorest treasury.
    const poorest = towns.filter((L) => L.econ.treasury < pop(L) * 5).sort((a, b) => a.econ.treasury / Math.max(1, pop(a)) - b.econ.treasury / Math.max(1, pop(b)))[0];
    if (poorest) {
      const amount = Math.min(Math.round(spare * 0.3), pop(poorest) * 8);
      if (amount >= 20) {
        capL.econ.treasury -= amount;
        poorest.econ.treasury += amount;
        return note(poorest, 'coin', `${Who} sent ¤${amount} from the capital to help ${poorest.settlement.name}.`, amount);
      }
    }
    return null;
  }

  // ------------------------------------------------------------ relations
  key(a, b) {
    return a.id < b.id ? `${a.id}:${b.id}` : `${b.id}:${a.id}`;
  }

  relation(a, b) {
    if (!a || !b || a === b) return null;
    const k = this.key(a, b);
    let r = this.rel[k];
    if (!r) {
      // Realms that hold the same things dear start on better terms.
      const shared = (a.values || []).filter((v) => (b.values || []).includes(v)).length;
      const h = hash4(this.game.seed, a.id, b.id, 0x2e1) % 21 - 10;
      r = this.rel[k] = { score: shared * 14 - 4 + h, trade: 0, tradeWeek: 0, contested: [], incidents: 0, standing: null };
      r.standing = this.standingOf(r.score);
    }
    return r;
  }

  standingOf(score) {
    return score >= STANDING.friendly ? 'friendly' : score <= STANDING.hostile ? 'hostile' : 'wary';
  }

  standing(a, b) {
    const r = this.relation(a, b);
    return r ? r.standing : null;
  }

  shift(a, b, by, day) {
    const r = this.relation(a, b);
    if (!r) return null;
    r.score = clamp(r.score + by, -100, 100);
    const now = this.standingOf(r.score);
    if (now !== r.standing) {
      const was = r.standing;
      r.standing = now;
      const text = now === 'friendly' ? `The ${a.name.replace(/^The /, '')} and the ${b.name.replace(/^The /, '')} are on friendly terms now.`
        : now === 'hostile' ? `Relations between the ${a.name.replace(/^The /, '')} and the ${b.name.replace(/^The /, '')} have soured: the two realms are hostile.`
          : was === 'hostile' ? `The quarrel between the ${a.name.replace(/^The /, '')} and the ${b.name.replace(/^The /, '')} has cooled.` : `The ${a.name.replace(/^The /, '')} and the ${b.name.replace(/^The /, '')} are wary of each other now.`;
      if (day !== null && day !== undefined) {
        this.proclaim(a, day, text);
        this.proclaim(b, day, text);
      }
    }
    return r;
  }

  // A merchant of one realm did business in a town of another.
  noteTrade(fromS, hostS, coins) {
    const a = this.civOf(fromS);
    const b = this.civOf(hostS);
    if (!a || !b || a === b || coins <= 0) return;
    const r = this.relation(a, b);
    // (A trade league: every bargain counts for more.)
    const league = this.sim.tech && (this.sim.tech.has(a, 'trade_league') || this.sim.tech.has(b, 'trade_league')) ? 1.5 : 1;
    r.trade += coins;
    r.tradeWeek += coins * league;
  }

  // How a merchant from another realm is treated in town: welcomed where
  // the realms are friends, harried where they're not.
  welcome(hostL, fromS, day, rng) {
    const a = this.civOf(hostL.settlement);
    const b = this.civOf(fromS);
    if (!a || !b || a === b) return null;
    const st = this.standing(a, b);
    const e = hostL.econ;
    const risk = (st === 'hostile' ? 0.35 : st === 'wary' ? 0.12 : 0.03) + Math.min(0.2, (e.recent.violence || 0) * 0.05) - (hostL.npcs.some((r) => r.job === 'guard' && alive(r)) ? 0.04 : 0);
    if (rng.chance(Math.max(0, risk) * (this.sim.tech && this.sim.tech.has(fromS, 'caravan_law') ? 0.4 : 1))) {
      this.shift(a, b, -3, day);
      ledger(hostL, day, `A merchant of the ${b.name.replace(/^The /, '')} was jeered and short-changed in the market.`);
      const FL = this.game.world.layouts.get(fromS.id);
      if (FL && FL.econ) ledger(FL, day, `Our merchant came back from ${hostL.settlement.name} complaining of ill treatment by the ${a.name.replace(/^The /, '')}.`);
      return 'harried';
    }
    this.shift(a, b, st === 'friendly' ? 0.8 : 0.4, null);
    return 'welcomed';
  }

  // Something done to one realm's merchant in another's town.
  merchantHarmed(hostS, fromS, kind, day) {
    const a = this.civOf(hostS);
    const b = this.civOf(fromS);
    if (!a || !b || a === b) return;
    const r = this.relation(a, b);
    r.incidents++;
    const by = { killed: -14, robbed: -6, attacked: -5 }[kind] ?? -4;
    this.shift(a, b, by, day);
    const L = this.game.world.layouts.get(fromS.id);
    if (L && L.econ && kind === 'killed') ledger(L, day, `One of our merchants was killed in ${hostS.name}, a town of the ${a.name.replace(/^The /, '')}. People are angry.`);
  }

  // Towns of two realms whose streets reach towards the same ground.
  contested(a, b) {
    const out = [];
    for (const s of this.members(a)) {
      const ra = [...reachOf(s)];
      for (const o of this.members(b)) {
        if (Math.hypot(s.cx - o.cx, s.cz - o.cz) > 8) continue;
        const rb = [...reachOf(o)];
        const near = ra.some((k) => rb.some((q) => Math.abs((k % 10000) - (q % 10000)) <= 1 && Math.abs(Math.floor(k / 10000) - Math.floor(q / 10000)) <= 1));
        if (near) out.push([s.id, o.id]);
      }
    }
    return out;
  }

  // Once a day: trade warms, disputes and tariffs chill, and everything
  // drifts back toward where it started.
  relationsDaily(day) {
    if (this.relDay === day) return;
    this.relDay = day;
    const civs = this.civs;
    for (let i = 0; i < civs.length; i++) {
      for (let j = i + 1; j < civs.length; j++) {
        const a = civs[i];
        const b = civs[j];
        const r = this.relation(a, b);
        let by = Math.min(2, r.tradeWeek / 60);
        r.tradeWeek = Math.max(0, r.tradeWeek * 0.8 - 5);
        // Land both want.
        const now = this.contested(a, b).map(([x, y]) => `${x}:${y}`);
        for (const k of now) {
          if (r.contested.includes(k)) continue;
          const [x, y] = k.split(':').map(Number);
          const S = this.game.world.ow.settlements;
          const text = `${S[x].name} and ${S[y].name} both lay claim to the land between them.`;
          for (const sid of [x, y]) {
            const L = this.game.world.layouts.get(sid);
            if (L && L.econ) ledger(L, day, text);
          }
          // (A border dispute, as the realms remember it.)
          if (this.sim.politics) this.sim.politics.disputes.push({ a: a.id, b: b.id, kind: 'border', day, text });
          by -= 6;
        }
        r.contested = now;
        by -= now.length * 0.4;
        // Tariffs rankle.
        const sore = this.sim.tech && (this.sim.tech.has(a, 'trade_league') || this.sim.tech.has(b, 'trade_league')) ? 0.15 : 0.3;
        if (this.realm(a).decrees.tariffOn.includes(b.id)) by -= sore;
        if (this.realm(b).decrees.tariffOn.includes(a.id)) by -= sore;
        // Slowly back toward the old footing.
        const base = (a.values || []).filter((v) => (b.values || []).includes(v)).length * 14 - 4;
        by += (base - r.score) * 0.02;
        this.shift(a, b, by, day);
      }
    }
  }

  // ------------------------------------------------------------ daily
  daily(L, day, rng) {
    const s = L.settlement;
    const civ = this.civOf(s);
    this.relationsDaily(day);
    if (!civ || deserted(s)) return;
    const R = this.realm(civ);
    if ((day + civ.id) % 7 === 3 || !this.game.world.ow.settlements[R.capital] || deserted(this.game.world.ow.settlements[R.capital])) this.pickCapital(civ, day);
    if (R.capital === s.id) this.court(civ, L, day, rng);
    else if ((day + s.id) % 7 === 0 && this.unrestWeekly(L, day, rng)) return;
    // The realm's least tax holds in every town.
    const floor = R.decrees.taxFloor;
    if (floor && L.econ.tax < floor) {
      L.econ.tax = floor;
      ledger(L, day, `Taxes rose to ${Math.round(floor * 100)}%, the least ${authority(civ)} allows.`);
    }
  }

  // ------------------------------------------------------------ save
  serialize() {
    return { state: this.state, rel: this.rel, extraCivs: this.extraCivs, allegiance: this.allegiance };
  }

  load(d) {
    this.state = (d && d.state) || {};
    this.rel = (d && d.rel) || {};
    // Realms born since, and towns that changed sides, in the same order.
    const ow = this.game.world.ow;
    this.extraCivs = [];
    for (const c of (d && d.extraCivs) || []) {
      if (!ow.civs[c.id]) ow.civs[c.id] = c;
      this.extraCivs.push(ow.civs[c.id]);
    }
    this.allegiance = (d && d.allegiance) || [];
    for (const [sid, cid] of this.allegiance) if (ow.settlements[sid] && ow.civs[cid]) this.join(ow.settlements[sid], ow.civs[cid]);
    for (const civ of this.civs) if (this.state[civ.id]) civ.decrees = this.state[civ.id].decrees;
  }
}

function reachOf(s) {
  const out = new Set();
  for (let cz = s.cz; cz < s.cz + (s.cd || 1); cz++) for (let cx = s.cx; cx < s.cx + (s.cw || 1); cx++) out.add(cz * 10000 + cx);
  for (const k of s.reach || []) out.add(k);
  return out;
}
