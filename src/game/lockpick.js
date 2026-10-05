// Picking a lock: a row of pin stacks in the plug, each a key pin under a
// driver pin, pushed down by a spring. Flick a pin up with the pick (each
// flick another push up; the spring brings it back down) and, just as the
// gap between its two pins crosses the shear line, turn the plug: the
// driver pin catches above the line and stays there. Set them all and the
// plug turns.
//   Turn at the wrong moment and the pick takes the strain; too much and it
//   snaps (another from your pack, if you have one).
//   Better locks (a town's, a city's, a manor's) have more pins, stiffer
//   springs and narrower gaps; and their pins bind in an order: only the
//   binding one will set (it's the one that's stiff to lift, and quivers
//   when it's flicked), the rest just spring back.
//   The best have spool pins too: set one and it gives a false set (the
//   plug gives a little, the pin drops back a way); it has to be set twice.
import { RNG, hash4 } from '../util/rng.js';

// Where the shear line sits, as a share of a chamber's height.
export const SHEAR = 0.6;

// How a lock of a given grade (1 a village's, to 4 a city manor's) is made.
export function lockGrade(tier) {
  const t = Math.max(1, Math.min(4, tier | 0));
  return {
    tier: t,
    pins: [3, 4, 5, 6][t - 1],
    // Half the gap's width (in chamber heights) and how hard the springs push.
    win: [0.085, 0.07, 0.058, 0.05][t - 1],
    spring: [2.6, 3.1, 3.6, 4.2][t - 1],
    binding: t >= 2,
    spools: t >= 3 ? t - 2 : 0,
    metal: ['iron', 'brass', 'brass', 'steel'][t - 1],
  };
}

export class Lock {
  // `seed`: the lock's own (a chest's always picks the same); `steady`:
  // steady hands (wider gaps, less strain on a slip); `heavy`: heavy
  // hands (narrower, more strain).
  constructor(tier, seed, { steady = false, heavy = false, agi = 2, rank = 1 } = {}) {
    const G = lockGrade(tier);
    const rng = new RNG(hash4(seed >>> 0, 0x10c4));
    this.grade = G;
    this.metal = G.metal;
    this.steady = steady;
    // (Wider with steady hands, quick ones, and practice: see mastery.js.)
    const wide = (steady ? 1.4 : 1) * (heavy ? 0.7 : 1) * (1 + 0.05 * (agi - 2)) * (1 + 0.04 * (rank - 1));
    this.pins = Array.from({ length: G.pins }, () => ({
      h: 0,
      v: 0,
      set: false,
      // (Each its own: some springs stiffer, some gaps narrower.)
      spring: G.spring * rng.float(0.8, 1.25),
      kick: rng.float(1.55, 1.95),
      win: G.win * wide * rng.float(0.85, 1.15),
      // How long its key pin is (drawn: they're cut to different lengths).
      cut: rng.float(0.22, 0.5),
      spool: false,
      falseSet: false,
      quiver: 0,
    }));
    // The order they bind in.
    this.order = rng.shuffle(this.pins.map((_, i) => i));
    if (!G.binding) this.order = null;
    for (const i of rng.shuffle(this.pins.map((_, k) => k)).slice(0, G.spools)) this.pins[i].spool = true;
    this.stress = 0;
    this.missStrain = (steady ? 0.22 : heavy ? 0.42 : 0.32) * (1 - 0.03 * (rank - 1));
    this.turn = 0;
    this.open = false;
  }

  // The pin that binds now (any unset one, in a plain lock).
  binding() {
    if (!this.order) return -1;
    return this.order.find((i) => !this.pins[i].set) ?? -1;
  }

  // Is that pin's gap on the shear line?
  aligned(i) {
    const p = this.pins[i];
    return !p.set && Math.abs(p.h - SHEAR) <= p.win;
  }

  // A flick of the pick under pin `i`: it jumps up (stiff, if it's the
  // binding one, and it quivers: that's how you tell).
  flick(i) {
    const p = this.pins[i];
    if (!p || p.set || this.open) return null;
    const bind = this.binding();
    const stiff = bind === i;
    p.v = Math.max(p.v, 0) + p.kick * (stiff ? 0.82 : 1);
    if (stiff) p.quiver = 0.35;
    return stiff ? 'stiff' : 'free';
  }

  // Turning the plug against pin `i`: 'set' (it catches), 'false' (a spool:
  // a false set), 'open' (the last one: it turns), 'loose' (not the one
  // binding: it springs back), 'miss' (the wrong moment: strain on the
  // pick) or 'snap' (too much: the pick breaks).
  tension(i) {
    const p = this.pins[i];
    if (!p || this.open) return null;
    if (p.set) return 'done';
    const bind = this.binding();
    if (bind >= 0 && bind !== i) {
      if (this.aligned(i)) {
        p.v = -1;
        this.stress += 0.08;
        return this.strain('loose');
      }
      return this.slip();
    }
    if (!this.aligned(i)) return this.slip();
    if (p.spool && !p.falseSet) {
      p.falseSet = true;
      p.h = SHEAR - 0.22;
      p.v = 0;
      this.turn = 0.4;
      return 'false';
    }
    p.set = true;
    p.h = SHEAR;
    p.v = 0;
    this.turn = Math.min(1, this.turn + 0.25);
    if (this.pins.every((q) => q.set)) {
      this.open = true;
      return 'open';
    }
    return 'set';
  }

  slip() {
    this.stress += this.missStrain;
    return this.strain('miss');
  }

  strain(r) {
    if (this.stress >= 1) {
      this.stress = 0;
      return 'snap';
    }
    return r;
  }

  update(dt) {
    for (const p of this.pins) {
      if (p.quiver > 0) p.quiver -= dt;
      if (p.set) continue;
      p.v -= p.spring * dt;
      p.h += p.v * dt;
      if (p.h <= 0) {
        p.h = 0;
        p.v = 0;
      } else if (p.h >= 1) {
        p.h = 1;
        p.v = -Math.abs(p.v) * 0.25;
      }
    }
    if (this.turn > 0 && !this.open) this.turn = Math.max(0, this.turn - dt * 0.5);
    // (Strain eases off while you're not turning against it.)
    if (this.stress > 0) this.stress = Math.max(0, this.stress - dt * 0.04);
  }
}

// How good a lock a household keeps: a village's plain iron, a town's
// brass, a city's better; a manor's a grade up on that. (1 to 4.)
export function chestTier(settlementType, buildingType) {
  const base = settlementType === 'city' ? 3 : settlementType === 'town' ? 2 : 1;
  return Math.min(4, base + (buildingType === 'manor' || buildingType === 'house_l' ? 1 : 0));
}

// The lock on a chest in a town: a household's or a shop's by the town and
// the building; the town hall's, over the treasury, an advanced one (a
// village's brass with spool pins, a town's or a city's steel).
export function lockTier(s, owner) {
  const type = s && s.type;
  if (owner && owner.b && owner.b.type === 'townhall') return type === 'village' ? 3 : 4;
  return chestTier(type, owner && owner.b && owner.b.type);
}

// How many days a picked lock stays open before its owners notice and lock
// it again.
export const RELOCK_DAYS = 2;
