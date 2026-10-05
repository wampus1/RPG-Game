// Hard times. A town that goes hungry for days on end, or stays poor for
// weeks, doesn't just sit and suffer: families pack up and leave in waves
// for somewhere with food on the table; tempers fray (a crowd at the town
// hall, windows broken, the council's coffers raided for bread); a few of
// the desperate take to the hills and join the bandits; and a realm whose
// towns are starving looks hard at its neighbours' fields (a war over
// farmland, if its ruler has the stomach for it).
import { alive, ledger } from './econ.js';
import { RNG, hash4, clamp } from '../util/rng.js';
import { fortuneOf } from './prosperity.js';

const residents = (L) => L.npcs.filter((r) => alive(r) && !r.away && !r.migrated && !r.visitor);
const fullName = (r) => `${r.name.first} ${r.name.last}`;

export function hungerShare(L) {
  const people = residents(L);
  return people.length ? people.filter((r) => (r.hungry || 0) >= 1).length / people.length : 0;
}

export class Hardship {
  constructor(game, sim) {
    this.game = game;
    this.sim = sim;
  }

  // Daily, for each town.
  daily(L, day) {
    const s = L.settlement;
    const e = L.econ;
    if (!e || s.deserted || s.condition === 'abandoned' || s.founding) return null;
    const rng = new RNG(hash4(s.seed >>> 0, day, 0x4a2d));
    const hungry = hungerShare(L);
    e.famineDays = hungry > 0.2 ? (e.famineDays || 0) + 1 : Math.max(0, (e.famineDays || 0) - 2);
    e.poorDays = fortuneOf(L) === 'struggling' ? (e.poorDays || 0) + 1 : Math.max(0, (e.poorDays || 0) - 1);
    // (Granaries: the stores hold out longer, and feed the poorest first.)
    const granary = this.sim.tech && this.sim.tech.has(s, 'granaries');
    const onset = granary ? 6 : 4;
    const famine = e.famineDays >= onset;
    const poor = e.poorDays >= 8;
    if (e.famineDays === onset) {
      ledger(L, day, `Famine in ${s.name}: the stores are bare, and families are going to bed hungry.`);
      this.sim.saga?.emit('famine', { sid: s.id });
    }
    // Tempers rise while it lasts (and cool slowly after).
    if (famine || poor) e.unrest = clamp((e.unrest || 0) + (famine ? 0.25 : 0.1) * (granary ? 0.5 : 1), 0, 3);
    const out = {};
    if (!famine && !poor) return out;
    // A crowd at the town hall.
    if ((e.unrest || 0) >= 1.5 && day - (e.riotDay ?? -99) >= 8 && rng.chance(0.25)) {
      e.riotDay = day;
      const loss = Math.min(Math.round(e.treasury * 0.15), 40);
      e.treasury -= loss;
      for (const r of residents(L)) r.mood = clamp((r.mood ?? 0.5) - 0.05, 0, 1);
      ledger(L, day, famine
        ? `A crowd gathered at the town hall in ${s.name}, crying out for bread. Windows were broken, and the council handed out ¤${loss} to calm them.`
        : `Angry words at the town hall in ${s.name}: folk want work, and fair taxes. The council spent ¤${loss} to settle things.`);
      out.riot = true;
      this.sim.saga?.emit('riot', { sid: s.id, famine: !!famine });
    }
    // A wave of families leaving for somewhere better off.
    if (day - (e.waveDay ?? -99) >= 12 && rng.chance(famine ? 0.25 : 0.12)) {
      const T = this.refuge(L);
      if (T) {
        const fams = new Map();
        for (const r of residents(L)) {
          if (r.ruler !== undefined || r.job === 'mayor' || r.job === 'guard' || r.councillor !== undefined || r.captive !== undefined || r.soldier !== undefined) continue;
          const k = r.home ?? `x${r.idx}`;
          if (!fams.has(k)) fams.set(k, []);
          fams.get(k).push(r);
        }
        const go = [];
        for (const f of rng.shuffle([...fams.values()])) {
          if (go.length + f.length > 9) continue;
          go.push(...f);
          if (go.length >= 5) break;
        }
        if (go.length >= 2) {
          e.waveDay = day;
          const moved = this.sim.sendPeople(L, go, T, famine ? 'fleeing the famine' : 'looking for work');
          const n = new Set(go.map((r) => r.home)).size;
          ledger(L, day, `${famine ? 'Hunger' : 'Want'} has driven ${n > 1 ? `${n} families` : 'a family'} out of ${s.name}; they've gone to ${T.settlement.name}.`);
          ledger(T, day, `${moved.length} people have come from ${s.name}, ${famine ? 'fleeing the famine there' : 'looking for work'}.`);
          out.wave = moved.length;
        }
      }
    }
    // The desperate take to the hills.
    if (this.sim.bandits && day - (e.outlawDay ?? -99) >= 10 && rng.chance(famine ? 0.15 : 0.08)) {
      const r = residents(L).find((q) => q.age === 'adult' && ['laborer', 'beggar', 'farmer'].includes(q.job) && (q.coins || 0) < 10 && q.partner === null && (q.personality?.kindness ?? 0.5) < 0.55);
      if (r) {
        const band = this.sim.bandits.recruit(r, L, day, rng);
        if (band) {
          e.outlawDay = day;
          r.migrated = true;
          r.away = true;
          r.outlaw = band.id;
          if (r.ent && !r.ent.dead) this.game.despawnNpc(r.ent);
          ledger(L, day, `${fullName(r)} has disappeared. Folk say they've gone to the hills to join ${band.name}; hunger makes thieves of honest people.`);
          out.outlaw = r;
        }
      }
    }
    return out;
  }

  // Somewhere better off within a few days' walk (its own realm first).
  refuge(L) {
    const s = L.settlement;
    const opts = [...this.game.world.layouts.values()].filter((T) => T !== L && T.econ && !T.settlement.deserted && T.settlement.condition !== 'abandoned' && !T.settlement.founding
      && Math.hypot(T.settlement.cx - s.cx, T.settlement.cz - s.cz) <= 10 && hungerShare(T) < 0.1 && fortuneOf(T) !== 'struggling');
    opts.sort((a, b) => (b.settlement.civ === s.civ) - (a.settlement.civ === s.civ) || Math.hypot(a.settlement.cx - s.cx, a.settlement.cz - s.cz) - Math.hypot(b.settlement.cx - s.cx, b.settlement.cz - s.cz));
    return opts[0] || null;
  }

  // A realm that's starving, next to one that's fed: a reason for war.
  hungryFor(a, b) {
    const R = this.sim.realms;
    const starving = R.memberLayouts(a).filter((L) => (L.econ.famineDays || 0) >= 5);
    if (!starving.length) return null;
    const fields = R.memberLayouts(b).filter((L) => L.fields && L.fields.length && hungerShare(L) < 0.1);
    for (const H of starving) for (const F of fields) if (Math.hypot(H.settlement.cx - F.settlement.cx, H.settlement.cz - F.settlement.cz) <= 9) return { from: H, field: F };
    return null;
  }
}
