// Politics. A realm's land on the map isn't fixed: as its towns grow (and
// its scholars learn) it pushes its borders out, and when it shrinks, or a
// war wears it down, it draws them back in. Pushing into land another
// realm calls its own is a border dispute, and enough of those sour the two
// for good. Realms on good terms, whose ways don't clash, swear alliances
// (and fall out again, over tariffs, broken promises or a border); a small
// realm long allied to a large one may join it outright, and a realm that
// lost a war may serve the victor, paying tribute until it can throw the
// yoke off. At home, the ruler decides how many of the realm's people
// stand watch (once laws are written down) and, in a bad war, may draft
// the old and even the young into the watch (once the realm has learned
// conscription).
import { alive, ledger } from './econ.js';
import { deserted } from './civic.js';
import { retrain } from '../entities/npcgen.js';
import { RNG, hash4, clamp } from '../util/rng.js';
import { authority } from './realms.js';

// How friendly two realms must be to swear an alliance, and how far it can
// fall before the alliance breaks.
export const ALLY_AT = 40;
export const ALLY_BREAK = 8;
// Things two peoples can't both hold dear and still stand side by side.
const CLASH = [
  ['pious', 'scholarly', 'the priests would not stand beside a people who put their books above the gods'],
  ['martial', 'mercantile', 'the war-chiefs would not bind themselves to a realm of shopkeepers'],
  ['agrarian', 'seafaring', 'the farmers and the sea-traders could not agree on anything'],
];
// How many grown folk stand watch, by decree (towns keep the usual
// number up themselves, taking on someone when the watch runs short).
export const WATCH = { light: 0.1, standard: 0.15, heavy: 0.28 };
const WATCH_TEXT = {
  light: 'the watch is cut back: one in ten grown folk is enough to keep the peace',
  standard: 'the watch returns to its usual strength',
  heavy: 'one in every four grown folk shall stand watch',
};
// Who can be spared for the watch (and how many of a trade must be left).
const SPARE = { laborer: 0, farmer: 2, fisher: 1, trapper: 1, lumberjack: 1, miner: 1, merchant: 2, carpenter: 1, builder: 1, handler: 1, cook: 1 };
const KEEP = new Set(['mayor', 'noble', 'priest', 'researcher', 'innkeeper', 'barkeep', 'blacksmith', 'herbalist', 'jeweller', 'scribe', 'tailor', 'baker']);

const residents = (L) => L.npcs.filter((r) => alive(r) && !r.away && !r.migrated && !r.visitor);
const plain = (civ) => civ.name.replace(/^The /, '');
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

export class Politics {
  constructor(game, sim) {
    this.game = game;
    this.sim = sim;
    this.alliances = []; // { a, b, since }
    this.vassals = {}; // civ id -> { lord, since, paid }
    this.disputes = []; // { a, b, kind: 'border' | 'pact', day, text }
    this.base = (game.world.ow.cells || []).map((c) => c.civ); // the map as the world began
    this.str0 = {}; // civ id -> strength when first counted
    this.land0 = {}; // civ id -> land then
    this.talks = {}; // pair key -> day an alliance was last talked of
    this.lastDay = null; // (set on the first tick: the game's clock isn't running yet)
  }

  get ow() {
    return this.game.world.ow;
  }

  // Realms that still hold a town.
  live() {
    return this.sim.realms.civs.filter((c) => this.sim.realms.members(c).length);
  }

  key(a, b) {
    return a.id < b.id ? `${a.id}:${b.id}` : `${b.id}:${a.id}`;
  }

  // ------------------------------------------------------------ queries
  alliance(a, b) {
    if (!a || !b || a === b) return null;
    return this.alliances.find((q) => (q.a === a.id && q.b === b.id) || (q.a === b.id && q.b === a.id)) || null;
  }

  allied(a, b) {
    return !!this.alliance(a, b);
  }

  allies(civ) {
    if (!civ) return [];
    const C = this.ow.civs;
    return this.alliances.filter((q) => q.a === civ.id || q.b === civ.id).map((q) => C[q.a === civ.id ? q.b : q.a]).filter(Boolean);
  }

  lordOf(civ) {
    const v = civ && this.vassals[civ.id];
    return v ? this.ow.civs[v.lord] || null : null;
  }

  vassalsOf(civ) {
    return Object.entries(this.vassals).filter(([, v]) => v.lord === civ.id).map(([id]) => this.ow.civs[id]).filter(Boolean);
  }

  // Bound together: allies, or a lord and the realm that serves it.
  bound(a, b) {
    return this.allied(a, b) || this.lordOf(a) === b || this.lordOf(b) === a;
  }

  // What would keep two peoples apart, whatever they think of each other.
  clash(a, b) {
    const va = a.values || [];
    const vb = b.values || [];
    for (const [x, y, why] of CLASH) if ((va.includes(x) && vb.includes(y)) || (va.includes(y) && vb.includes(x))) return why;
    if (a.freed && a.freed.from === b.id) return `the ${plain(a)} has not forgiven the ${plain(b)} for the years it ruled them`;
    if (b.freed && b.freed.from === a.id) return `the ${plain(b)} has not forgiven the ${plain(a)} for the years it ruled them`;
    return null;
  }

  // Quarrels between two realms lately (for war, and for the board).
  grievances(a, b, day, within = 30) {
    return this.disputes.filter((d) => ((d.a === a.id && d.b === b.id) || (d.a === b.id && d.b === a.id)) && day - d.day <= within);
  }

  // How strong a realm is: its people, its watch, its towns.
  strength(civ) {
    let n = 0;
    for (const s of this.sim.realms.members(civ)) {
      const L = this.game.world.layouts.get(s.id);
      const guards = L && L.econ ? residents(L).filter((r) => r.job === 'guard').length : { city: 7, town: 4, village: 2 }[s.type] || 2;
      n += this.sim.realms.popOf(s) * 0.05 + guards + (s.type === 'city' ? 3 : s.type === 'town' ? 1.5 : 0.5);
    }
    return Math.round(n * 10) / 10;
  }

  // ------------------------------------------------------------ the day
  // Once a day (on the world's clock, wherever you are).
  update() {
    const day = this.game.day;
    if (this.lastDay === null || this.lastDay === undefined) this.lastDay = day;
    if (day <= this.lastDay) return;
    // (A long sleep: each day in turn, a week at most.)
    for (let d = Math.max(this.lastDay + 1, day - 6); d <= day; d++) this.realmDay(d, new RNG(hash4(this.game.seed, d, 0x9011)));
    this.lastDay = day;
  }

  realmDay(day, rng) {
    const civs = this.live();
    this.disputes = this.disputes.filter((d) => day - d.day <= 90);
    this.pacts(civs, day, rng);
    for (const civ of civs) {
      if ((day + civ.id * 2) % 7 === 1) this.borders(civ, day, rng);
      if ((day + civ.id) % 7 === 4) this.policy(civ, day, rng);
    }
    if (day % 7 === 5) {
      this.vassalWeek(day, rng);
      this.merges(day, rng);
      this.fealty(day, rng);
    }
  }

  // ------------------------------------------------------------ disputes
  dispute(a, b, kind, day, text, by = -4) {
    this.disputes.push({ a: a.id, b: b.id, kind, day, text });
    if (this.disputes.length > 80) this.disputes.shift();
    this.sim.realms.shift(a, b, by, day);
  }

  // News for the towns of both realms near a place (or all of them).
  tell(civs, day, text, near = null) {
    for (const civ of civs) {
      for (const L of this.sim.realms.memberLayouts(civ)) {
        const s = L.settlement;
        if (near && Math.hypot(s.cx - near.cx, s.cz - near.cz) > 12 && !this.sim.realms.isCapital(s)) continue;
        ledger(L, day, text);
      }
    }
  }

  // ------------------------------------------------------------ borders
  ready(civ) {
    return this.sim.realms.members(civ).every((s) => {
      const L = this.game.world.layouts.get(s.id);
      return L && L.econ;
    });
  }

  land(civ) {
    return this.ow.cells.filter((c) => c.civ === civ.id);
  }

  // How much land a realm can hold now, against what it held when first
  // counted: more as it grows, less as it shrinks (or wears itself out in
  // a war).
  wantLand(civ) {
    const st = this.strength(civ);
    const id = civ.id;
    if (this.str0[id] === undefined) {
      this.str0[id] = st;
      this.land0[id] = this.land(civ).length;
    }
    const tech = this.sim.tech.stateOf(civ);
    const known = this.sim.tech.cheat ? 4 : tech ? tech.done.length : 0;
    const cap = this.sim.realms.capitalOf(civ);
    const capL = cap && this.game.world.layouts.get(cap.id);
    const flush = capL && capL.econ && capL.econ.treasury > 600 ? 1.06 : 1;
    const weary = this.sim.war ? this.sim.war.weariness(civ) : 0;
    const r = clamp(st / Math.max(1, this.str0[id]), 0.4, 2.2);
    return Math.round(Math.max(4, this.land0[id]) * (0.6 + r * 0.4) * (1 + known * 0.012) * flush * (1 - weary * 0.25));
  }

  // Weekly: out a little, or in a little.
  borders(civ, day, rng) {
    if (!this.ready(civ)) return null;
    const have = this.land(civ);
    const want = this.wantLand(civ);
    if (want - have.length >= 1) return this.grow(civ, Math.min(3, want - have.length), day, rng);
    if (have.length - want >= 2) return this.shrink(civ, Math.min(2, Math.ceil((have.length - want) / 2)), day);
    return null;
  }

  townsOf(civ) {
    return this.sim.realms.members(civ);
  }

  nearestTown(civ, cx, cz) {
    let best = null;
    for (const s of this.townsOf(civ)) {
      const d = Math.hypot(s.cx + (s.cw || 1) / 2 - 0.5 - cx, s.cz + (s.cd || 1) / 2 - 0.5 - cz);
      if (!best || d < best.d) best = { s, d };
    }
    return best;
  }

  setCell(c, civ) {
    c.civ = civ ? civ.id : null;
  }

  grow(civ, n, day, rng) {
    const ow = this.ow;
    const realms = this.sim.realms;
    const took = [];
    const pushed = new Map(); // other civ id -> cells
    const st = this.strength(civ);
    for (let i = 0; i < n; i++) {
      const cand = [];
      const seen = new Set();
      for (const c of this.land(civ)) {
        for (const [dx, dz] of DIRS) {
          const o = ow.cell(c.cx + dx, c.cz + dz);
          if (!o || o.civ === civ.id || o.biome === 'ocean' || seen.has(o)) continue;
          seen.add(o);
          // (A town's own ground is the town's.)
          if (o.settlement !== null && o.settlement !== undefined) continue;
          const near = this.nearestTown(civ, o.cx, o.cz);
          if (!near || near.d > 9) continue;
          const other = o.civ !== null && o.civ !== undefined ? ow.civs[o.civ] : null;
          if (other && (this.bound(civ, other) || (this.sim.war && this.sim.war.truce(civ, other, day)))) continue;
          const theirs = other ? this.nearestTown(other, o.cx, o.cz) : null;
          // Land another realm holds is pushed into only by the stronger,
          // and only where it's nearer our towns than theirs.
          if (other && (!theirs || theirs.d < near.d - 1 || st < this.strength(other) * 1.1)) continue;
          // (Land right by our own towns that someone else holds is wanted
          // most of all.)
          cand.push({ o, other, score: -near.d + (other ? (near.d <= 5 ? 4 : -2) : 3) + (o.biome === 'mountain' ? -2 : 0) + (o.river ? 1 : 0) + rng.float(0, 1.5) });
        }
      }
      if (!cand.length) break;
      const pick = cand.reduce((m, q) => (q.score > m.score ? q : m));
      if (pick.other) {
        // Boundary stones in someone else's field: a dispute, and maybe the land.
        const list = pushed.get(pick.other.id) || [];
        list.push(pick.o);
        pushed.set(pick.other.id, list);
        if (!rng.chance(0.55)) continue;
      }
      this.setCell(pick.o, civ);
      took.push(pick.o);
    }
    for (const [oid, cells] of pushed) {
      const other = ow.civs[oid];
      const at = this.nearestTown(other, cells[0].cx, cells[0].cz);
      const place = at ? at.s.name : 'the border';
      const text = `Surveyors of the ${plain(civ)} have set boundary stones in land near ${place} that the ${plain(other)} calls its own.`;
      this.dispute(civ, other, 'border', day, text, -5);
      this.tell([civ, other], day, text, at ? at.s : null);
    }
    if (took.length >= 2) {
      const cap = realms.capitalOf(civ);
      const dir = cap ? this.direction(cap, took) : null;
      if (cap) this.tell([civ], day, dir === 'all about' ? `The borders of the ${plain(civ)} have spread.` : `The borders of the ${plain(civ)} have spread ${dir}.`, cap);
    }
    return { took: took.length, disputed: pushed.size };
  }

  shrink(civ, n, day) {
    const ow = this.ow;
    const gave = [];
    for (let i = 0; i < n; i++) {
      let best = null;
      for (const c of this.land(civ)) {
        if (c.settlement !== null && c.settlement !== undefined) continue;
        if (!DIRS.some(([dx, dz]) => {
          const o = ow.cell(c.cx + dx, c.cz + dz);
          return !o || o.civ !== civ.id;
        })) continue;
        const near = this.nearestTown(civ, c.cx, c.cz);
        const d = near ? near.d : 99;
        if (!best || d > best.d) best = { c, d };
      }
      if (!best) break;
      this.setCell(best.c, null);
      gave.push(best.c);
    }
    if (gave.length >= 2) {
      const cap = this.sim.realms.capitalOf(civ);
      const dir = cap ? this.direction(cap, gave) : null;
      if (cap) this.tell([civ], day, dir === 'all about' ? `The ${plain(civ)} can no longer hold its outlying marches; its borders have been drawn back.` : `The ${plain(civ)} can no longer hold its far ${dir.replace(/^to the /, '')} marches; the border there has been drawn back.`, cap);
    }
    return { gave: gave.length };
  }

  direction(from, cells) {
    const mx = cells.reduce((n, c) => n + c.cx, 0) / cells.length - from.cx;
    const mz = cells.reduce((n, c) => n + c.cz, 0) / cells.length - from.cz;
    const ns = mz < -1 ? 'north' : mz > 1 ? 'south' : '';
    const ew = mx < -1 ? 'west' : mx > 1 ? 'east' : '';
    return ns || ew ? `to the ${ns}${ew}` : 'all about';
  }

  // A free village or town ringed by a realm's land may swear itself to it.
  fealty(day, rng) {
    const ow = this.ow;
    for (const s of ow.settlements) {
      if (s.civ || deserted(s) || s.condition === 'abandoned') continue;
      const c = ow.cell(s.cx, s.cz);
      const around = DIRS.map(([dx, dz]) => ow.cell(s.cx + dx, s.cz + dz)).filter((o) => o && o.civ !== null && o.civ !== undefined);
      if (around.length < 3 || !c) continue;
      const civ = ow.civs[around[0].civ];
      if (!civ || !around.every((o) => o.civ === civ.id) || !this.sim.realms.members(civ).length) continue;
      const near = this.nearestTown(civ, s.cx, s.cz);
      if (!near || near.d > 8 || !rng.chance(0.1)) continue;
      this.sim.realms.join(s, civ);
      this.sim.realms.allegiance.push([s.id, civ.id]);
      const L = this.game.world.layouts.get(s.id);
      const text = `The people of ${s.name} have sworn themselves to the ${plain(civ)}.`;
      if (L && L.econ) ledger(L, day, text);
      this.tell([civ], day, text, s);
      return s;
    }
    return null;
  }

  // ------------------------------------------------------------ pacts
  pacts(civs, day, rng) {
    const realms = this.sim.realms;
    const war = this.sim.war;
    for (let i = 0; i < civs.length; i++) {
      for (let j = i + 1; j < civs.length; j++) {
        const a = civs[i];
        const b = civs[j];
        const r = realms.relation(a, b);
        const al = this.alliance(a, b);
        if (al) {
          if (war && war.enemies(a, b)) {
            this.breakAlliance(a, b, day, 'they are at war with each other');
            continue;
          }
          if (r.score < ALLY_BREAK) {
            this.breakAlliance(a, b, day, 'their friendship has soured past mending');
            continue;
          }
          // Allies grow closer; a tariff on an ally's merchants rankles.
          realms.shift(a, b, 0.3, null);
          for (const [x, y] of [[a, b], [b, a]]) {
            if (!realms.realm(x).decrees.tariffOn.includes(y.id)) continue;
            if (!this.grievances(x, y, day, 14).some((d) => d.kind === 'pact')) {
              const text = `The ${plain(y)} protests that the ${plain(x)}'s tariff on its merchants breaks the terms of their alliance.`;
              this.dispute(y, x, 'pact', day, text, -3);
              this.tell([x, y], day, text);
            }
          }
          continue;
        }
        if (war && (war.enemies(a, b) || war.truce(a, b, day))) continue;
        if (this.lordOf(a) === b || this.lordOf(b) === a) continue;
        // Enemies of the same realm make easier friends.
        const common = civs.find((c) => c !== a && c !== b && ((war && war.enemies(a, c) && war.enemies(b, c)) || (realms.standing(a, c) === 'hostile' && realms.standing(b, c) === 'hostile')));
        const need = common ? ALLY_AT - 18 : ALLY_AT;
        if (r.score < need) continue;
        const why = this.clash(a, b);
        const k = this.key(a, b);
        if (why) {
          if (this.talks[k] === undefined || day - this.talks[k] > 45) {
            this.talks[k] = day;
            this.tell([a, b], day, `Envoys of the ${plain(a)} and the ${plain(b)} talked of an alliance, but nothing came of it: ${why}.`);
          }
          continue;
        }
        if (rng.chance(common ? 0.3 : 0.15)) this.ally(a, b, day, common);
      }
    }
  }

  ally(a, b, day, against = null) {
    if (this.allied(a, b)) return null;
    const al = { a: a.id, b: b.id, since: day };
    this.alliances.push(al);
    this.sim.realms.shift(a, b, 6, day);
    this.tell([a, b], day, against
      ? `The ${plain(a)} and the ${plain(b)} have sworn an alliance against the ${plain(against)}.`
      : `The ${plain(a)} and the ${plain(b)} have sworn an alliance: friends in trade, and in war.`);
    return al;
  }

  breakAlliance(a, b, day, why, by = -10) {
    const al = this.alliance(a, b);
    if (!al) return false;
    this.alliances = this.alliances.filter((q) => q !== al);
    const text = `The alliance between the ${plain(a)} and the ${plain(b)} is broken: ${why}.`;
    this.dispute(a, b, 'pact', day, text, by);
    this.tell([a, b], day, text);
    return true;
  }

  // ------------------------------------------------------------ merging
  // A small realm long allied to a much larger one (and of a like mind)
  // joins it; a vassal content with its lord may too.
  merges(day, rng) {
    const C = this.ow.civs;
    const war = this.sim.war;
    for (const al of this.alliances.slice()) {
      const a = C[al.a];
      const b = C[al.b];
      if (!a || !b || day - al.since < 30) continue;
      if (war && (war.atWar(a) || war.atWar(b))) continue;
      const r = this.sim.realms.relation(a, b);
      if (r.score < 60) continue;
      const [small, big] = this.strength(a) <= this.strength(b) ? [a, b] : [b, a];
      const like = (small.values || []).some((v) => (big.values || []).includes(v)) || small.style === big.style;
      if (!like || this.townsOf(small).length > 2 || this.strength(small) > this.strength(big) * 0.6) continue;
      if (rng.chance(0.2)) return this.merge(small, big, day, 'by long friendship');
    }
    for (const [id, v] of Object.entries(this.vassals)) {
      const small = C[id];
      const lord = C[v.lord];
      if (!small || !lord || day - v.since < 45 || (war && war.atWar(small))) continue;
      if (this.sim.realms.relation(small, lord).score >= 30 && this.townsOf(small).length <= 2 && rng.chance(0.1)) return this.merge(small, lord, day, 'after long years of service');
    }
    return null;
  }

  merge(small, big, day, how) {
    const realms = this.sim.realms;
    const old = realms.ruler(small);
    const towns = this.townsOf(small);
    for (const s of towns) {
      realms.join(s, big);
      realms.allegiance.push([s.id, big.id]);
    }
    // The land goes with the towns.
    for (const c of this.ow.cells) if (c.civ === small.id) c.civ = big.id;
    this.sim.tech.inherit(big, small);
    if (old) delete old.ruler;
    const R = realms.realm(small);
    R.ruler = null;
    R.council = [];
    small.merged = { into: big.id, day };
    this.alliances = this.alliances.filter((q) => q.a !== small.id && q.b !== small.id);
    delete this.vassals[small.id];
    for (const v of Object.values(this.vassals)) if (v.lord === small.id) v.lord = big.id;
    const lord = realms.rulerName(big);
    this.tell([big], day, `The ${plain(small)} has joined the ${plain(big)} ${how}: ${towns.map((s) => s.name).join(' and ')} now ${towns.length > 1 ? 'answer' : 'answers'} to ${lord || authority(big)}.`);
    return { into: big, from: small, towns };
  }

  // ------------------------------------------------------------ vassals
  makeVassal(loser, lord, day) {
    this.vassals[loser.id] = { lord: lord.id, since: day, paid: 0 };
    this.alliances = this.alliances.filter((q) => q.a !== loser.id && q.b !== loser.id);
    return this.vassals[loser.id];
  }

  // Weekly: tribute from each vassal to its lord; a vassal that has grown
  // strong (or come to hate its lord) throws the yoke off.
  vassalWeek(day, rng) {
    const C = this.ow.civs;
    const realms = this.sim.realms;
    for (const [id, v] of Object.entries(this.vassals)) {
      const vs = C[id];
      const lord = C[v.lord];
      if (!vs || !lord || !this.townsOf(vs).length || !this.townsOf(lord).length) {
        delete this.vassals[id];
        continue;
      }
      const vc = realms.capitalOf(vs);
      const lc = realms.capitalOf(lord);
      const VL = vc && this.game.world.layouts.get(vc.id);
      const LL = lc && this.game.world.layouts.get(lc.id);
      if (VL && VL.econ && LL && LL.econ) {
        const n = Math.min(80, Math.floor(VL.econ.treasury * 0.12));
        if (n > 0) {
          VL.econ.treasury -= n;
          LL.econ.treasury += n;
          v.paid += n;
          ledger(VL, day, `¤${n} went to the ${plain(lord)} in tribute.`);
        }
      }
      const r = realms.relation(vs, lord);
      const weary = this.sim.war ? this.sim.war.weariness(lord) : 0;
      if (day - v.since >= 21 && (r.score < -30 || this.strength(vs) > this.strength(lord) * 0.9 || weary > 0.6) && rng.chance(0.2)) {
        delete this.vassals[id];
        const text = `The ${plain(vs)} has thrown off the rule of the ${plain(lord)}, and pays tribute no more!`;
        this.dispute(lord, vs, 'pact', day, text, -25);
        this.tell([vs, lord], day, text);
      }
    }
  }

  // ------------------------------------------------------------ the watch
  // Weekly: the ruler sets how many stand watch (once laws are written
  // down), and whether the old and the young are drafted (once the realm
  // knows conscription).
  policy(civ, day, rng) {
    const realms = this.sim.realms;
    const R = realms.realm(civ);
    const d = R.decrees;
    const cap = realms.capitalOf(civ);
    const ruler = realms.ruler(civ);
    if (!cap || !ruler) return null;
    d.watch ||= 'standard';
    d.draft ||= 'none';
    const war = this.sim.war;
    const tech = this.sim.tech;
    const towns = realms.memberLayouts(civ);
    const raids = towns.reduce((n, L) => n + (L.econ.recent.raids || 0), 0);
    const fighting = war && war.atWar(civ);
    const hostile = this.live().some((o) => o !== civ && realms.standing(civ, o) === 'hostile');
    const who = authority(civ);
    const p = ruler.personality || {};
    let out = null;
    if (tech.has(cap, 'codex')) {
      const poor = towns.filter((L) => L.econ.treasury < residents(L).length * 6).length * 2 > towns.length;
      const want = fighting || raids >= 2 || (hostile && (p.bravery ?? 0.5) > 0.7) ? 'heavy' : !hostile && raids === 0 && poor && (p.kindness ?? 0.5) > 0.4 ? 'light' : 'standard';
      if (want !== d.watch) {
        d.watch = want;
        realms.proclaim(civ, day, `By decree of ${who}: ${WATCH_TEXT[want]}.`);
        out = 'watch';
      }
    }
    if (tech.has(cap, 'conscription')) {
      const w = fighting ? war.warOf(civ) : null;
      const side = w ? war.sideOf(w, civ) : null;
      const losing = w && (side === 'a' ? w.score < -15 : w.score > 15);
      const dire = w && (side === 'a' ? w.score < -45 : w.score > 45);
      const want = !w ? 'none' : dire && (p.kindness ?? 0.5) < 0.55 ? 'all' : losing || this.weary(civ) > 0.45 ? 'elders' : d.draft;
      if (want !== d.draft) {
        const was = d.draft;
        d.draft = want;
        realms.proclaim(civ, day, want === 'none' ? `${who[0].toUpperCase()}${who.slice(1)} has ended the draft. Those called up may go home.`
          : want === 'elders' ? `By decree of ${who}: the war needs every arm. Elders still hale enough shall stand watch.`
            : `By decree of ${who}: the young too must take up spears. ${was === 'none' ? 'Elders and children alike' : 'Children'} are called to the watch.`);
        out = 'draft';
      }
    }
    return out;
  }

  weary(civ) {
    return this.sim.war ? this.sim.war.weariness(civ) : 0;
  }

  // Every few days in each town: the watch brought up (or down) to what's
  // decreed.
  townDay(L, day, rng) {
    const s = L.settlement;
    const civ = s.civ;
    if (deserted(s) || s.condition === 'abandoned' || (day + s.id) % 3 !== 0) return null;
    const d = (civ && civ.decrees) || {};
    const people = residents(L);
    const guards = people.filter((r) => r.job === 'guard');
    const adults = people.filter((r) => r.age === 'adult');
    const drafted = guards.filter((r) => r.drafted !== undefined);
    const ratio = WATCH[d.watch || 'standard'];
    // Draftees go home when the draft ends.
    if ((d.draft || 'none') === 'none' && drafted.length) return this.release(L, drafted[0], day);
    if ((d.draft || 'none') === 'elders') {
      const kid = drafted.find((r) => r.age === 'child');
      if (kid) return this.release(L, kid, day);
    }
    const watch = d.watch || 'standard';
    const target = Math.max(1, Math.round((adults.length + this.sim.playerCount(s.id)) * ratio)) - this.sim.playerGuard(s.id);
    // (Under the usual watch, a town only takes people on once it's well
    // short; by decree it keeps to the number.)
    if (guards.length < (watch === 'standard' ? Math.floor(target * 0.7) : target)) {
      const first = this.recruit(L, people, day, rng, d.draft || 'none', true);
      const second = first && target - guards.length >= 3 ? this.recruit(L, residents(L), day, rng, d.draft || 'none', true) : null;
      // (One notice for the lot.)
      const all = [first, second].filter(Boolean);
      if (all.length) this.noteRecruits(L, day, all);
      return first;
    }
    if (watch === 'light' && guards.length > target + 1) {
      const go = drafted[0] || guards.filter((r) => !r.ruler && r.age === 'adult').sort((a, b) => a.personality.bravery - b.personality.bravery)[0];
      if (go) return this.release(L, go, day);
    }
    return null;
  }

  recruit(L, people, day, rng, draft, quiet = false) {
    const many = (job) => people.filter((q) => q.job === job && q.age === 'adult').length;
    const free = (r) => r.ruler === undefined && r.councillor === undefined && !r.trip?.phase?.startsWith('away') && !r.raid && !r.soldier;
    let pick = people.filter((r) => r.age === 'adult' && free(r) && !KEEP.has(r.job) && SPARE[r.job] !== undefined && many(r.job) > SPARE[r.job])
      .sort((a, b) => b.personality.bravery - a.personality.bravery)[0];
    let how = 'joined';
    if (!pick && draft !== 'none') {
      pick = people.filter((r) => r.age === 'elder' && free(r) && r.job !== 'guard').sort((a, b) => (a.born ?? 0) - (b.born ?? 0)).pop();
      how = 'elder';
    }
    if (!pick && draft === 'all') {
      // The eldest of the children first.
      pick = people.filter((r) => r.age === 'child' && free(r)).sort((a, b) => (a.born ?? 0) - (b.born ?? 0))[0];
      how = 'child';
    }
    if (!pick) return null;
    const was = pick.job;
    retrain(L, pick, 'guard', new RNG(hash4(pick.idx, day, 0xd4a)));
    if (how !== 'joined') {
      pick.drafted = day;
      pick.maxHp = how === 'child' ? 12 : 16;
      pick.hp = Math.min(pick.hp ?? pick.maxHp, pick.maxHp);
      // (Back to a proper routine, with a shift at the guardhouse.)
      pick.schedule = makeDraftSchedule(pick);
    }
    if (this.sim.tech) this.sim.tech.equipGuard(L, pick);
    const e = pick.ent;
    if (e && !e.dead) {
      e.look = pick.look;
      e.maxHp = pick.maxHp;
      e.hp = Math.min(e.maxHp, Math.max(e.hp, pick.hp));
      e.activity = null;
    }
    if (quiet) return { recruited: pick, how, was };
    const nm = `${pick.name.first} ${pick.name.last}`;
    if (how === 'child') {
      ledger(L, day, `Young ${nm} was handed a spear under the draft. ${pick.parents.length ? 'Their family wept to see it.' : ''}`.trim());
      for (const i of pick.parents) if (L.npcs[i]) L.npcs[i].mood = clamp((L.npcs[i].mood ?? 0.5) - 0.12, 0, 1);
    } else if (how === 'elder') ledger(L, day, `${nm}, grey as they are, was called up to stand watch under the draft.`);
    else ledger(L, day, L.settlement.civ && (L.settlement.civ.decrees || {}).watch === 'heavy' ? `${nm} (once a ${was}) joined the watch, as ${authority(L.settlement.civ)} has decreed.` : `The watch was short-handed: ${nm} (once a ${was}) joined it.`);
    return { recruited: pick, how };
  }

  noteRecruits(L, day, list) {
    const civ = L.settlement.civ;
    const heavy = civ && (civ.decrees || {}).watch === 'heavy';
    const nm = (q) => `${q.recruited.name.first} ${q.recruited.name.last}`;
    const plainOnes = list.filter((q) => q.how === 'joined');
    if (plainOnes.length) {
      const names = plainOnes.map((q) => `${nm(q)} (once a ${q.was})`).join(' and ');
      ledger(L, day, heavy ? `${names} joined the watch, as ${authority(civ)} has decreed.` : `The watch was short-handed: ${names} joined it.`);
    }
    for (const q of list) {
      if (q.how === 'child') {
        ledger(L, day, `Young ${nm(q)} was handed a spear under the draft. ${q.recruited.parents.length ? 'Their family wept to see it.' : ''}`.trim());
        for (const i of q.recruited.parents) if (L.npcs[i]) L.npcs[i].mood = clamp((L.npcs[i].mood ?? 0.5) - 0.12, 0, 1);
      } else if (q.how === 'elder') ledger(L, day, `${nm(q)}, grey as they are, was called up to stand watch under the draft.`);
    }
  }

  release(L, r, day) {
    const job = r.drafted !== undefined ? (r.age === 'child' ? 'child' : r.age === 'elder' ? 'retired' : 'laborer') : 'laborer';
    const wasDrafted = r.drafted !== undefined;
    delete r.drafted;
    retrain(L, r, job, new RNG(hash4(r.idx, day, 0x4e1)));
    r.look = { ...r.look, hat: null };
    r.maxHp = r.age === 'child' ? 6 : r.age === 'elder' ? 8 : 12;
    r.hp = Math.min(r.hp ?? r.maxHp, r.maxHp);
    if (r.equipment) r.equipment.items = (r.equipment.items || []).filter((i) => !['spear', 'iron_sword', 'steel_sword', 'bow'].includes(i.item));
    const e = r.ent;
    if (e && !e.dead) {
      e.look = r.look;
      e.maxHp = r.maxHp;
      e.hp = Math.min(e.hp, e.maxHp);
      e.activity = null;
    }
    ledger(L, day, wasDrafted ? `${r.name.first} ${r.name.last} was sent home from the watch, the draft over.` : `${r.name.first} ${r.name.last} left the watch to work as a ${job}.`);
    return { released: r };
  }

  // ------------------------------------------------------------ board
  // A line or two for the notice board's Town tab.
  summary(civ) {
    if (!civ) return [];
    const out = [];
    const allies = this.allies(civ);
    if (allies.length) out.push(`Allies: ${allies.map(plain).join(', ')}`);
    const lord = this.lordOf(civ);
    if (lord) out.push(`Serves the ${plain(lord)} (tribute)`);
    const vs = this.vassalsOf(civ);
    if (vs.length) out.push(`Vassals: ${vs.map(plain).join(', ')}`);
    return out;
  }

  // ------------------------------------------------------------ save
  serialize() {
    const cells = [];
    this.ow.cells.forEach((c, i) => {
      if (c.civ !== this.base[i]) cells.push([i, c.civ]);
    });
    return { alliances: this.alliances, vassals: this.vassals, disputes: this.disputes, str0: this.str0, land0: this.land0, talks: this.talks, lastDay: this.lastDay, cells, merged: this.sim.realms.civs.filter((c) => c.merged).map((c) => [c.id, c.merged]) };
  }

  load(d) {
    if (!d) return;
    this.alliances = d.alliances || [];
    this.vassals = d.vassals || {};
    this.disputes = d.disputes || [];
    this.str0 = d.str0 || {};
    this.land0 = d.land0 || {};
    this.talks = d.talks || {};
    this.lastDay = d.lastDay ?? this.lastDay;
    const cells = this.ow.cells;
    for (const [i, civ] of d.cells || []) if (cells[i]) cells[i].civ = civ;
    for (const [id, m] of d.merged || []) if (this.ow.civs[id]) this.ow.civs[id].merged = m;
  }
}

// A draftee's day: the watch's hours (the young and the old aren't put on
// the night shift).
function makeDraftSchedule(r) {
  const rest = r.schedule && r.schedule.rest;
  const work = [
    { s: 0, e: 420, act: 'sleep', place: 'bed' },
    { s: 420, e: 470, act: 'eat', place: 'home' },
    { s: 470, e: 720, act: 'work', place: 'work' },
    { s: 720, e: 770, act: 'eat', place: 'home' },
    { s: 770, e: 1050, act: 'work', place: 'work' },
    { s: 1050, e: 1110, act: 'eat', place: 'home' },
    { s: 1110, e: r.age === 'child' ? 1240 : 1300, act: 'home', place: 'home' },
    { s: r.age === 'child' ? 1240 : 1300, e: 1440, act: 'sleep', place: 'bed' },
  ];
  return { work, rest: rest || work };
}

