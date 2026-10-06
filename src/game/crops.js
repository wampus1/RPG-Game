// Crops grow in stages over a few days. Each growing crop is remembered with
// the moment it was sown; its visible stage follows from how long it has been
// growing, so fields keep growing while you're away and catch up on return.
import { B, BLOCKS, CROPS, cropStage, cropMeta, META_AGE, isFarmland } from '../world/blocks.js';
import { REGION_W, REGION_D, WORLD_Y } from '../config.js';
import { weatherAt, SPELL } from '../world/weather.js';
import { relicGrowth } from './relics.js';
import { rule } from '../mod/rules.js';

const WET_HOURS = 24; // how long soaked soil stays moist once the rain stops

export class CropGrowth {
  constructor(game) {
    this.game = game;
    this.list = new Map();
    this.t = 0;
    // Moisture: every patch of farmland in memory, and when wet soil dries.
    this.fields = new Map();
    this.wet = new Map();
    this.moistT = 0;
  }

  get abs() {
    return this.game.day * 1440 + this.game.minute;
  }

  key(x, y, z) {
    return `${x},${y},${z}`;
  }

  // Minutes per stage for one plant (a little uneven, like real rows).
  perStage(id, x, z) {
    const c = CROPS[id];
    const j = ((x * 73856093) ^ (z * 19349663)) >>> 0;
    return (c.hours * 60 * (0.85 + (j % 1000) / 1000 * 0.3)) / rule('growth');
  }

  sow(x, y, z, id, stage = 0) {
    const c = CROPS[id];
    if (!c || stage >= c.stages - 1) return;
    const per = this.perStage(id, x, z);
    this.list.set(this.key(x, y, z), { x, y, z, id, t0: this.abs - stage * per, per, bonus: 0, last: this.abs });
  }

  // Plant a crop at its first stage and start it growing.
  plant(x, y, z, id) {
    this.game.world.setBlock(x, y, z, id, cropMeta(id, 0));
    this.sow(x, y, z, id, 0);
  }

  // A region came into memory: pick up crops there that are still growing.
  scanRegion(r) {
    for (let lz = 0; lz < REGION_D; lz++) {
      for (let lx = 0; lx < REGION_W; lx++) {
        const base = (lz * REGION_W + lx) * WORLD_Y;
        for (let y = 1; y < WORLD_Y; y++) {
          const id = r.blocks[base + y];
          if (isFarmland(id)) this.trackSoil(r.x0 + lx, y, r.z0 + lz, id);
          const c = CROPS[id];
          if (!c) continue;
          const st = cropStage(r.meta[base + y]);
          const k = this.key(r.x0 + lx, y, r.z0 + lz);
          if (st < c.stages - 1 && !this.list.has(k)) this.sow(r.x0 + lx, y, r.z0 + lz, id, st);
        }
      }
    }
  }

  // Moist soil counts double: `bonus` is the extra growing time it gave.
  stageOf(e) {
    return Math.min(CROPS[e.id].stages - 1, Math.floor((this.abs - e.t0 + (e.bonus || 0)) / e.per));
  }

  // ------------------------------------------------------------ moisture
  trackSoil(x, y, z, id) {
    const k = this.key(x, y, z);
    if (!this.fields.has(k)) this.fields.set(k, { x, y, z });
    // Wet soil found on loading: it stays moist a while longer at most.
    if (id === B.farmland_wet && !this.wet.has(k)) this.wet.set(k, this.abs + 6 * 60);
  }

  // Soak farmland (rain, or a bucket from the well).
  wetten(x, y, z, hours = WET_HOURS) {
    const w = this.game.world;
    if (!isFarmland(w.getBlock(x, y, z))) return false;
    const k = this.key(x, y, z);
    this.fields.set(k, { x, y, z });
    this.wet.set(k, Math.max(this.wet.get(k) || 0, this.abs + hours * 60));
    if (w.getBlock(x, y, z) !== B.farmland_wet) w.setBlock(x, y, z, B.farmland_wet);
    return true;
  }

  isWetAt(x, y, z) {
    return this.game.world.getBlock(x, y, z) === B.farmland_wet;
  }

  // Rain soaks the fields around you; dry weather dries them out again.
  moisture() {
    const g = this.game;
    const w = g.world;
    const now = this.abs;
    const raining = g.weather && g.weather.kind === 'rain' && g.weather.level > 0.5;
    for (const [k, f] of this.fields) {
      if (!w.regionAt(f.x, f.z)) continue;
      const id = w.getBlock(f.x, f.y, f.z);
      if (!isFarmland(id)) {
        this.fields.delete(k);
        this.wet.delete(k);
        continue;
      }
      if (raining) {
        this.wet.set(k, now + WET_HOURS * 60);
        if (id !== B.farmland_wet) w.setBlock(f.x, f.y, f.z, B.farmland_wet);
      } else if (id === B.farmland_wet) {
        const until = this.wet.get(k);
        if (until === undefined) this.wet.set(k, now + 6 * 60);
        else if (now >= until) {
          w.setBlock(f.x, f.y, f.z, B.farmland);
          this.wet.delete(k);
        }
      }
    }
  }

  // Minutes of moist soil a crop had while nobody was around to see: any
  // spell with rain in the day before it.
  wetEstimate(e, from, to) {
    if (e.biome === undefined) e.biome = this.game.world.ow.biomeAt(e.x, e.z).biome;
    const seed = this.game.seed;
    let wet = 0;
    for (let sp = Math.floor(from / SPELL); sp * SPELL < to; sp++) {
      let rained = false;
      for (let back = 0; back <= WET_HOURS * 60 / SPELL && !rained; back++) rained = weatherAt(seed, e.x, e.z, (sp - back) * SPELL, e.biome) === 'rain';
      if (rained) wet += Math.min(to, (sp + 1) * SPELL) - Math.max(from, sp * SPELL);
    }
    return wet;
  }

  update(dt) {
    this.moistT -= dt;
    if (this.moistT <= 0) {
      this.moistT = 2;
      this.moisture();
    }
    this.t -= dt;
    if (this.t > 0) return;
    this.t = 1;
    const w = this.game.world;
    const now = this.abs;
    for (const [k, e] of this.list) {
      if (!w.regionAt(e.x, e.z)) continue;
      const id = w.getBlock(e.x, e.y, e.z);
      if (id !== e.id) {
        this.list.delete(k);
        continue;
      }
      // Growing in moist soil: twice as fast.
      const gap = now - (e.last ?? now);
      e.last = now;
      if (gap > 90) e.bonus = (e.bonus || 0) + this.wetEstimate(e, now - gap, now);
      else if (gap > 0 && w.getBlock(e.x, e.y - 1, e.z) === B.farmland_wet) e.bonus = (e.bonus || 0) + gap;
      // (And twice again in a seed of plenty's circle, or under a realm's
      // growth lattices.)
      if (gap > 0 && relicGrowth(this.game, e.x, e.y, e.z)) e.bonus = (e.bonus || 0) + gap;
      if (gap > 0 && this.latticed(e)) e.bonus = (e.bonus || 0) + gap;
      const want = this.stageOf(e);
      const meta = w.getMeta(e.x, e.y, e.z);
      if (cropStage(meta) < want) w.setMeta(e.x, e.y, e.z, (meta & ~META_AGE) | cropMeta(id, want));
      if (want >= CROPS[id].stages - 1) this.list.delete(k);
    }
  }

  // In a town whose realm has the Growth Lattice?
  latticed(e) {
    const A = this.game.sim && this.game.sim.ancient;
    if (!A) return false;
    if (e.sid === undefined) {
      const s = this.game.world.ow.settlementAt(e.x, e.z);
      e.sid = s ? s.id : -1;
    }
    return e.sid >= 0 && A.has(this.game.world.ow.settlements[e.sid], 'lattice');
  }

  // What breaking a crop gives: seeds back if it wasn't ready, the full
  // harvest if it was (more with a hoe).
  harvest(id, meta, withHoe, rand = Math.random) {
    const c = CROPS[id];
    if (!c) return null;
    const st = cropStage(meta);
    if (st < c.stages - 1) return [{ item: c.seed, count: 1 }];
    const out = [];
    const base = id === B.wheat_crop ? 1 + Math.floor(rand() * 2) : id === B.carrot_crop ? 2 + Math.floor(rand() * 2) : 1;
    out.push({ item: c.produce, count: base + (withHoe ? 1 + Math.floor(rand() * 2) : 0) });
    const seedChance = id === B.carrot_crop ? 0 : withHoe ? 0.9 : 0.5;
    if (rand() < seedChance) out.push({ item: c.seed, count: withHoe && rand() < 0.4 ? 2 : 1 });
    return out;
  }

  serialize() {
    return {
      crops: [...this.list.values()].map((e) => [e.x, e.y, e.z, e.id, Math.round(e.t0), Math.round(e.per), Math.round(e.bonus || 0), Math.round(e.last ?? this.abs)]),
      wet: [...this.wet].map(([k, t]) => [k, Math.round(t)]),
    };
  }

  load(data) {
    const arr = Array.isArray(data) ? data : data ? data.crops : [];
    for (const [x, y, z, id, t0, per, bonus = 0, last] of arr || []) {
      if (BLOCKS[id] && CROPS[id]) this.list.set(this.key(x, y, z), { x, y, z, id, t0, per, bonus, last: last ?? this.abs });
    }
    for (const [k, t] of (data && data.wet) || []) this.wet.set(k, t);
  }
}
