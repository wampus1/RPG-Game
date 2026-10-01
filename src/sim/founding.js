// New villages. Now and then a crowded town sends a few families out to
// found a village of their own, somewhere open a few days' walk away. You
// can follow them: they set out with what they can carry (on a wagon if
// the town can spare one), walk the road and then the wilds, pitch their
// tents round the spot they've chosen, and their builder raises the first
// houses one by one. Once everyone has a roof, the tents come down and
// it's a village like any other (on your map, in its realm, with a name).
import { alive, ledger, stockOf } from './econ.js';
import { RNG, hash4 } from '../util/rng.js';
import { retrain } from '../entities/npcgen.js';
import { B } from '../world/blocks.js';
import { GROUND, REGION_W, REGION_D, MAP_W, MAP_H } from '../config.js';

const MAX_FOUNDED = 4;
const residents = (L) => L.npcs.filter((r) => alive(r) && !r.away && !r.migrated && !r.visitor);
const centre = (s) => ({ x: Math.floor((s.cx + (s.cw || 1) / 2) * REGION_W), z: Math.floor((s.cz + (s.cd || 1) / 2) * REGION_D) });

export class Founding {
  constructor(game, sim) {
    this.game = game;
    this.sim = sim;
    this.parties = [];
    this.made = []; // settlements founded, to be put back on load
    this.next = 1;
    this.lastFounded = -99;
    this.lastDay = null;
  }

  // Each tick: anyone arriving; each new day, the rest.
  update() {
    const day = this.game.day;
    for (const p of this.parties) if (!p.done && p.stage === 'travel' && this.sim.abs >= p.arrive) this.advance(p, day);
    if (this.lastDay === null) this.lastDay = day;
    if (day <= this.lastDay) return;
    for (let d = Math.max(this.lastDay + 1, day - 3); d <= day; d++) this.daily(d, new RNG(hash4(this.game.seed, d, 0xf0de)));
    this.lastDay = day;
  }

  // ------------------------------------------------------------ daily
  daily(day, rng) {
    for (const p of this.parties) if (!p.done) this.advance(p, day);
    if (this.made.length >= MAX_FOUNDED || day - this.lastFounded < 15 || this.parties.some((p) => !p.done) || !rng.chance(0.06)) return null;
    // A town bursting at the seams (more people than beds, and plenty of them).
    const towns = [...this.game.world.layouts.values()].filter((L) => L.econ && !L.settlement.deserted && L.settlement.condition !== 'abandoned' && !L.settlement.founding);
    const crowded = towns.filter((L) => {
      const people = residents(L);
      const beds = L.buildings.filter((b) => b.residential && !b.underConstruction).reduce((n, b) => n + b.beds.length, 0);
      return people.length >= 14 && people.length > beds && L.econ.treasury >= 60;
    });
    const L = crowded.length ? rng.pick(crowded) : null;
    return L ? this.found(L, day, rng) : null;
  }

  // Somewhere open: dry land a few days off, not too near anywhere else,
  // and not yet seen (so the land can be laid out for them).
  site(L, rng) {
    const ow = this.game.world.ow;
    const s = L.settlement;
    const opts = [];
    for (let cz = 1; cz < MAP_H - 1; cz++) {
      for (let cx = 1; cx < MAP_W - 1; cx++) {
        const d = Math.hypot(cx - s.cx, cz - s.cz);
        if (d < 4 || d > 9) continue;
        const c = ow.cell(cx, cz);
        if (!c || ['ocean', 'mountain', 'swamp'].includes(c.biome) || c.lake || c.settlement !== null || (c.mountainness || 0) > 0.3) continue;
        if (ow.settlements.some((o) => Math.hypot(o.cx - cx, o.cz - cz) < 3.2)) continue;
        if (ow.explored[cz * MAP_W + cx] || this.game.world.regions.has(this.game.world.regionKey(cx, cz))) continue;
        opts.push({ cx, cz, d });
      }
    }
    if (!opts.length) return null;
    opts.sort((a, b) => a.d - b.d);
    return rng.pick(opts.slice(0, 6));
  }

  found(L, day, rng) {
    const ow = this.game.world.ow;
    const s0 = L.settlement;
    const at = this.site(L, rng);
    if (!at) return null;
    // Who goes: a household or two from the most crowded homes.
    const people = residents(L).filter((r) => r.ruler === undefined && r.job !== 'mayor' && r.councillor === undefined && r.soldier === undefined && r.captive === undefined && !r.trip?.phase?.startsWith('away'));
    const byHome = new Map();
    for (const r of people) {
      const k = r.home ?? `x${r.idx}`;
      if (!byHome.has(k)) byHome.set(k, []);
      byHome.get(k).push(r);
    }
    const fams = [...byHome.values()].filter((f) => f.some((r) => r.age === 'adult')).sort((a, b) => b.length - a.length);
    const go = [];
    for (const f of fams) {
      if (go.length + f.length > 7) continue;
      go.push(...f);
      if (go.filter((r) => r.age === 'adult').length >= 3 || go.length >= 5) break;
    }
    if (go.filter((r) => r.age === 'adult').length < 2) return null;
    // The village itself: on the map, in the realm.
    const s = ow.makeSettlement('village', at.cx, at.cz, 1, 1, s0.civ || null, new RNG(hash4(s0.seed >>> 0, day, 0xf0d)));
    s.condition = 'normal';
    s.founding = { from: s0.id, day };
    this.register(s);
    this.made.push(this.describe(s));
    const NL = this.game.world.getLayout(s);
    // A start: the town sends tools, seed and timber with them.
    NL.econ.treasury = 70;
    for (const n of NL.econ.ledger || []) if (/keeps ¤0/.test(n.text)) n.text = `${s.name} keeps ¤70 in its coffers, sent by ${s0.name}.`;
    L.econ.treasury = Math.max(0, L.econ.treasury - 40);
    const k = stockOf(NL);
    k.wood = Math.max(k.wood || 0, 80);
    k.stone = Math.max(k.stone || 0, 40);
    const moved = this.sim.sendPeople(L, go, NL, 'to found a new village');
    const now = this.sim.abs;
    const back = this.sim.careers.returning.filter((q) => q.sid === s.id);
    const arrive = back.length ? Math.max(...back.map((q) => q.at)) : now + 600;
    // (They come in together, at the end of the road.)
    for (const q of back) q.at = arrive;
    const p = { id: this.next++, sid: s.id, from: s0.id, idxs: moved.map((r) => r.idx), depart: now, arrive, stage: 'travel', day };
    // A wagon, if the old town has one to spare.
    const wagon = this.sim.stables ? this.sim.stables.take(L, 'wagon') : null;
    if (wagon) p.mount = wagon;
    this.parties.push(p);
    this.lastFounded = day;
    const dir = this.dirFrom(s0, s);
    const names = moved.filter((r) => r.age === 'adult').map((r) => r.name.first);
    ledger(L, day, `${names.slice(0, -1).join(', ')}${names.length > 1 ? ' and ' : ''}${names[names.length - 1]} and their families are leaving ${s0.name} to found a new village, ${s.name}, out to the ${dir}. The town has sent them off with tools and seed.`);
    if (this.game.active.has(s0.id)) this.game.ui.msg(`Settlers are setting out from ${s0.name} to found ${s.name}.`, '#e8d8a0');
    return p;
  }

  dirFrom(a, b) {
    const ang = Math.atan2(-(b.cz - a.cz), b.cx - a.cx);
    const dirs = ['east', 'north-east', 'north', 'north-west', 'west', 'south-west', 'south', 'south-east'];
    return dirs[((Math.round(ang / (Math.PI / 4)) % 8) + 8) % 8];
  }

  // The new place, linked into the map's lookups (so the land is laid out
  // round it, and the map and the realm know it).
  register(s) {
    const ow = this.game.world.ow;
    for (let cz = s.cz; cz < s.cz + s.cd; cz++) {
      for (let cx = s.cx; cx < s.cx + s.cw; cx++) {
        const cell = ow.cell(cx, cz);
        if (cell) {
          cell.settlement = s.id;
          cell.civ = s.civ ? s.civ.id : cell.civ;
        }
      }
    }
    const b = s.bounds;
    const m = 14;
    for (let cz = Math.floor((b.z0 - m) / REGION_D); cz <= Math.floor((b.z1 + m) / REGION_D); cz++) {
      for (let cx = Math.floor((b.x0 - m) / REGION_W); cx <= Math.floor((b.x1 + m) / REGION_W); cx++) {
        const cell = ow.cell(cx, cz);
        if (cell && !cell.near.includes(s.id)) cell.near.push(s.id);
      }
    }
  }

  describe(s) {
    const { id, type, name, style, cx, cz, cw, cd, biome, condition, bounds, river, coast, lake, seed, founding } = s;
    return { id, type, name, style, cx, cz, cw, cd, biome, condition, bounds, river, coast, lake, seed, founding, civ: s.civ ? s.civ.id : null };
  }

  // ------------------------------------------------------------ the stages
  advance(p, day) {
    const NL = this.sim.layoutOf(p.sid);
    const s = NL && NL.settlement;
    if (!NL || !NL.econ) return;
    const now = this.sim.abs;
    const party = p.idxs.map((i) => NL.npcs[i]).filter((r) => r && alive(r));
    if (p.stage === 'travel' && now >= p.arrive) {
      p.stage = 'camp';
      // Somebody has to build, and somebody has to farm.
      const rng = new RNG(hash4(s.seed >>> 0, day, 0xb17d));
      const adults = party.filter((r) => r.age === 'adult');
      if (adults.length && !adults.some((r) => r.job === 'builder')) retrain(NL, adults[0], 'builder', rng);
      if (adults.length > 1 && !adults.some((r) => r.job === 'farmer')) retrain(NL, adults[1], 'farmer', rng);
      // And the eldest is the elder.
      if (adults.length > 2 && !NL.npcs.some((r) => r.job === 'mayor' && alive(r))) retrain(NL, adults[adults.length - 1], 'mayor', rng);
      this.pitch(p, NL);
      ledger(NL, day, `The settlers from ${this.sim.layoutOf(p.from)?.settlement.name || 'afar'} have reached the spot they chose, and pitched their tents. ${s.name} is begun.`);
      const home = this.sim.layoutOf(p.from);
      if (home && home.econ) ledger(home, day, `Word from the settlers: they've reached the place they'll call ${s.name}, and the first tents are up.`);
    }
    if (p.stage !== 'camp') return;
    // The builder raises a house at a time for whoever still has no roof.
    const homeless = party.filter((r) => r.home === null || r.home === undefined || !NL.buildings[r.home] || NL.buildings[r.home].underConstruction);
    const busy = this.sim.works.projects.some((q) => !q.done && q.sid === s.id && q.kind === 'build') || (NL.econ.buildQueue || []).some((o) => o.kind === 'build');
    if (homeless.length && !busy) {
      // (As big a house as there's a lot for.)
      const type = homeless.length > 3 && this.sim.works.freePlot(NL, 'house_m') ? 'house_m' : 'house_s';
      const q = this.sim.works.startBuilding(NL, type, ', the settlers\' first homes', false, 0);
      if (q && !p.firstHouse) {
        p.firstHouse = day;
        ledger(NL, day, 'The settlers have marked out their first house, and the builder has started on it.');
      }
    }
    if (!homeless.length) {
      p.stage = 'settled';
      p.done = day;
      this.strike(p);
      delete s.founding;
      const d = this.made.find((m) => m.id === s.id);
      if (d) delete d.founding;
      ledger(NL, day, `Everyone in ${s.name} has a roof over their heads now, and the tents have come down. It's a village.`);
      const home = this.sim.layoutOf(p.from);
      if (home && home.econ) ledger(home, day, `${s.name}, founded by settlers from here, is a proper village now.`);
    }
  }

  // Tents round the square for the families, till their houses are up.
  pitch(p, NL) {
    const c = NL.plaza ? { x: NL.plaza.cx, z: NL.plaza.cz } : centre(NL.settlement);
    const spots = [[-5, -3], [5, -3], [-5, 4], [5, 4], [0, -5], [0, 6]];
    const n = Math.min(spots.length, Math.max(2, Math.ceil(p.idxs.length / 2)));
    p.tents = spots.slice(0, n).map(([dx, dz]) => [c.x + dx, GROUND, c.z + dz]);
    this.sim.setBlocks(p.tents.map(([x, y, z]) => [x, y, z, B.tent, 0, true]));
    // (Soft: only on open ground; a campfire in the middle.)
    this.sim.setBlocks([[c.x + 2, GROUND, c.z + 1, B.campfire, 0, true]]);
    p.fire = [c.x + 2, GROUND, c.z + 1];
  }

  strike(p) {
    const w = this.game.world;
    const ops = [];
    for (const [x, y, z] of [...(p.tents || []), ...(p.fire ? [p.fire] : [])]) {
      if (!w.regionAt(x, z) || w.getBlock(x, y, z) === B.tent || w.getBlock(x, y, z) === B.campfire) ops.push([x, y, z, B.air, 0]);
    }
    if (ops.length) this.sim.setBlocks(ops);
  }

  // On the road: walking (or riding the wagon) toward the new place.
  roadTravellers() {
    const out = [];
    const now = this.sim.abs;
    const ow = this.game.world.ow;
    for (const p of this.parties) {
      if (p.done || p.stage !== 'travel' || now < p.depart || now >= p.arrive) continue;
      const NL = this.sim.layoutOf(p.sid);
      const from = ow.settlements[p.from];
      const to = ow.settlements[p.sid];
      if (!NL || !from || !to) continue;
      const way = this.sim.diplomacy.way(from, to);
      const f = (now - p.depart) / Math.max(1, p.arrive - p.depart);
      p.idxs.forEach((i, k) => {
        const rec = NL.npcs[i];
        if (!rec || !alive(rec)) return;
        // (Strung out along the road, a pace or two apart.)
        const pos = this.sim.diplomacy.wayAt(way, Math.max(0, f * way.len - k * 1.5));
        out.push({ key: `settler:${p.id}:${i}`, rec, L: NL, from, to, pos, way, target: centre(to), mount: k === 0 ? p.mount || null : null, settler: p.id });
      });
    }
    return out;
  }

  // ------------------------------------------------------------ save
  serialize() {
    return { parties: this.parties, made: this.made, next: this.next, lastFounded: this.lastFounded, lastDay: this.lastDay };
  }

  // The founded villages go back on the map before anything else is laid
  // out (in the order they were made, so their ids line up).
  load(d) {
    this.parties = (d && d.parties) || [];
    this.made = (d && d.made) || [];
    this.next = (d && d.next) || 1;
    this.lastFounded = d && d.lastFounded !== undefined ? d.lastFounded : -99;
    this.lastDay = d && d.lastDay !== undefined ? d.lastDay : null;
    const ow = this.game.world.ow;
    for (const m of this.made.slice().sort((a, b) => a.id - b.id)) {
      if (ow.settlements[m.id]) continue;
      if (m.id !== ow.settlements.length) break;
      const s = { ...m, civ: m.civ !== null && m.civ !== undefined ? ow.civs[m.civ] || null : null, layout: null };
      ow.settlements.push(s);
      this.register(s);
    }
  }
}

