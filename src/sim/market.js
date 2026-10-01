// The region's markets: what's plentiful and what's short, town by town.
//
// Sell a great deal of something in one place (or buy it all up) and its
// price moves there, and spreads to the towns round about over the days
// after. Merchants come to buy up what's going cheap and carry it off to
// where it's dear, and bring in what's short, which evens it out again;
// left alone, a market settles back. Keep a town supplied with something
// for weeks and it builds to use it: steady iron brings a new smithy,
// timber a carpenter's workshop, grain a bakery, cloth and leather a
// tailor's, herbs an herbalist's (if there's the stone and timber, and
// the coin, to build it).
import { ledger, alive } from './econ.js';
import { RNG, hash4, clamp } from '../util/rng.js';
import { ITEMS } from '../world/items.js';

// Goods that count as one on the market.
export function marketKey(k) {
  if (/^log_/.test(k)) return 'logs';
  if (/^planks/.test(k)) return 'planks';
  return String(k).split('+')[0];
}

// Steady deliveries of these, and what the town builds for them.
const FAMILY = { iron_ore: 'iron', iron_ingot: 'iron', coal: 'iron', logs: 'timber', planks: 'timber', wheat: 'grain', cloth: 'cloth', leather: 'cloth', herb: 'herbs' };
const BUILDS = {
  iron: { type: 'smithy', word: 'iron', what: 'a new smithy' },
  timber: { type: 'workshop', word: 'timber', what: 'a new carpenter\'s workshop' },
  grain: { type: 'bakery', word: 'grain', what: 'a new bakery' },
  cloth: { type: 'tailor', word: 'cloth and leather', what: 'a new tailor\'s shop' },
  herbs: { type: 'herbalist', word: 'herbs', what: 'a new herbalist\'s' },
};
const CAP = { village: 1, town: 2, city: 3 };
const WINDOW = 21; // days of deliveries remembered
const NEED_DAYS = 6; // deliveries on this many different days...
const NEED_UNITS = 15; // ...and this many in all

const nameOf = (key) => (key === 'logs' ? 'timber' : key === 'planks' ? 'planks' : (ITEMS[key]?.name || key).toLowerCase());

export class Market {
  constructor(game, sim) {
    this.game = game;
    this.sim = sim;
    this.lastDay = null;
  }

  of(L) {
    return (L.econ.market ||= {});
  }

  // How flooded (+) or short (-) something is in a town: about -1.5 to 1.5.
  level(L, k) {
    return L && L.econ && L.econ.market ? L.econ.market[marketKey(k)] || 0 : 0;
  }

  // What that does to its price there.
  factor(L, k) {
    return clamp(1 - 0.3 * this.level(L, k), 0.55, 1.45);
  }

  // Goods coming into a town's market (n > 0) or bought out of it (n < 0),
  // by you or by a merchant. (A town's own work is the baseline.)
  trade(L, k, n, who = 'npc') {
    if (!L || !L.econ || !n || !ITEMS[k]) return 0;
    const key = marketKey(k);
    const m = this.of(L);
    const per = (ITEMS[k].value || 1) >= 12 ? 0.06 : 0.035;
    m[key] = clamp((m[key] || 0) + n * per, -1.5, 1.5);
    // Deliveries are remembered, for what the town might build to use them.
    const fam = FAMILY[key];
    if (fam && n > 0) {
      const day = this.sim.simDay ?? this.game.day;
      const inflow = ((L.econ.inflow ||= {})[fam] ||= {});
      inflow[day] = (inflow[day] || 0) + n;
    }
    void who;
    return m[key];
  }

  // What's notable on a town's market, for the notice board and for talk.
  notes(L, max = 3) {
    const m = (L.econ && L.econ.market) || {};
    return Object.entries(m).filter(([, v]) => Math.abs(v) >= 0.35).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).slice(0, max)
      .map(([k, v]) => ({ k, v, name: nameOf(k), text: v > 0 ? `${nameOf(k)} cheap (plenty about)` : `${nameOf(k)} dear (short)` }));
  }

  talk(L, rng) {
    const n = this.notes(L, 2);
    if (!n.length) return null;
    const q = rng.pick(n);
    return q.v > 0
      ? rng.pick([`There's so much ${q.name} about, you can hardly give it away.`, `${q.name[0].toUpperCase()}${q.name.slice(1)}'s going for a song here just now.`, `Somebody flooded the market with ${q.name}. The merchants are rubbing their hands.`])
      : rng.pick([`You can't get ${q.name} for love nor money round here.`, `${q.name[0].toUpperCase()}${q.name.slice(1)}'s gone dear. Somebody's bought it all up.`, `We're short of ${q.name}. If you've any, you'd get a good price.`]);
  }

  update() {
    const day = this.game.day;
    if (this.lastDay === null) this.lastDay = day;
    if (day <= this.lastDay) return;
    for (let d = Math.max(this.lastDay + 1, day - 3); d <= day; d++) this.daily(d, new RNG(hash4(this.game.seed, d, 0x3a2c)));
    this.lastDay = day;
  }

  towns() {
    return [...this.game.world.layouts.values()].filter((L) => L.econ && !L.settlement.deserted && L.settlement.condition !== 'abandoned');
  }

  daily(day, rng) {
    const towns = this.towns();
    const dist = (a, b) => Math.hypot(a.settlement.cx - b.settlement.cx, a.settlement.cz - b.settlement.cz);
    // Word gets round: a town's gluts and shortages pull its neighbours'.
    const delta = new Map();
    for (const L of towns) {
      const m = L.econ.market;
      if (!m) continue;
      for (const O of towns) {
        if (O === L) continue;
        const d = dist(L, O);
        if (d > 10) continue;
        const w = 0.12 * (1 - d / 11);
        for (const [k, v] of Object.entries(m)) {
          if (Math.abs(v) < 0.05) continue;
          const dv = (v - ((O.econ.market || {})[k] || 0)) * w;
          if (Math.abs(dv) < 0.005) continue;
          const dm = delta.get(O) || {};
          dm[k] = (dm[k] || 0) + dv;
          delta.set(O, dm);
        }
      }
    }
    for (const [O, dm] of delta) {
      const m = this.of(O);
      for (const [k, dv] of Object.entries(dm)) m[k] = clamp((m[k] || 0) + dv, -1.5, 1.5);
    }
    // Merchants chase it: buyers come for what's going cheap (and carry it
    // off where it's dear), and bring in what's short.
    for (const L of towns) {
      const m = L.econ.market;
      if (!m) continue;
      for (const [k, v] of Object.entries(m)) {
        if (Math.abs(v) < 0.6 || !rng.chance(0.35)) continue;
        const near = towns.filter((O) => O !== L && dist(L, O) <= 12 && O.npcs.some((r) => alive(r) && r.traveler && !r.away && !r.migrated))
          .sort((a, b) => (v > 0 ? this.level(a, k) - this.level(b, k) : this.level(b, k) - this.level(a, k)));
        const O = near[0];
        if (!O) continue;
        const r = O.npcs.find((q) => alive(q) && q.traveler && !q.away && !q.migrated);
        const who = `${r.name.first} ${r.name.last}`;
        if (v > 0) {
          m[k] = v - 0.35;
          this.of(O)[k] = clamp((this.of(O)[k] || 0) + 0.15, -1.5, 1.5);
          r.coins = (r.coins || 0) + 8;
          ledger(L, day, `${who}, a merchant of ${O.settlement.name}, came to buy up cheap ${nameOf(k)}.`);
        } else {
          m[k] = v + 0.35;
          this.of(O)[k] = clamp((this.of(O)[k] || 0) - 0.15, -1.5, 1.5);
          r.coins = (r.coins || 0) + 8;
          ledger(L, day, `${who} brought ${nameOf(k)} from ${O.settlement.name}, where it's cheaper. It's been short here.`);
        }
      }
    }
    // Left alone, a market settles.
    for (const L of towns) {
      const m = L.econ.market;
      if (!m) continue;
      for (const k of Object.keys(m)) {
        m[k] *= 0.9;
        if (Math.abs(m[k]) < 0.03) delete m[k];
      }
      this.steady(L, day);
    }
  }

  // Weeks of something coming in: the town builds to use it.
  steady(L, day) {
    const e = L.econ;
    const inflow = e.inflow;
    if (!inflow) return null;
    for (const [fam, log] of Object.entries(inflow)) {
      for (const d of Object.keys(log)) if (day - d > WINDOW) delete log[d];
      const days = Object.keys(log).length;
      const units = Object.values(log).reduce((a, n) => a + n, 0);
      if (days < NEED_DAYS || units < NEED_UNITS) continue;
      const b = BUILDS[fam];
      const s = L.settlement;
      const have = L.buildings.filter((q) => q.type === b.type).length;
      const works = this.sim.works;
      const queued = () => (e.buildQueue || []).some((o) => o.kind === 'build' && o.type === b.type);
      const building = works.projects.some((p) => !p.done && p.sid === s.id && p.type === b.type) || queued();
      if (building || have >= (CAP[s.type] || 1) || e.treasury < 140) continue;
      // (With no lot free yet, it waits for the next street to be laid.)
      const p = works.startBuilding(L, b.type, `, for all the ${b.word} coming in`, false, 90);
      if (!p && !queued()) continue;
      e.treasury -= 90;
      delete inflow[fam];
      ledger(L, day, `With ${b.word} coming in week after week, the council of ${s.name} is putting up ${b.what}${p ? '' : ', as soon as there\'s a lot for it'}.`);
      this.sim.history?.add(L, `${s.name} built ${b.what}, for all the ${b.word} that came in.`, 'growth', day);
      return p || true;
    }
    return null;
  }

  serialize() {
    return { lastDay: this.lastDay };
  }

  load(d) {
    this.lastDay = d ? d.lastDay ?? null : null;
  }
}
