// Crops grow in stages over a few days. Each growing crop is remembered with
// the moment it was sown; its visible stage follows from how long it has been
// growing, so fields keep growing while you're away and catch up on return.
import { B, BLOCKS, CROPS, cropStage, cropMeta, META_AGE } from '../world/blocks.js';
import { REGION_W, REGION_D, WORLD_Y } from '../config.js';

export class CropGrowth {
  constructor(game) {
    this.game = game;
    this.list = new Map();
    this.t = 0;
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
    return c.hours * 60 * (0.85 + (j % 1000) / 1000 * 0.3);
  }

  sow(x, y, z, id, stage = 0) {
    const c = CROPS[id];
    if (!c || stage >= c.stages - 1) return;
    const per = this.perStage(id, x, z);
    this.list.set(this.key(x, y, z), { x, y, z, id, t0: this.abs - stage * per, per });
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
          const c = CROPS[id];
          if (!c) continue;
          const st = cropStage(r.meta[base + y]);
          const k = this.key(r.x0 + lx, y, r.z0 + lz);
          if (st < c.stages - 1 && !this.list.has(k)) this.sow(r.x0 + lx, y, r.z0 + lz, id, st);
        }
      }
    }
  }

  stageOf(e) {
    return Math.min(CROPS[e.id].stages - 1, Math.floor((this.abs - e.t0) / e.per));
  }

  update(dt) {
    this.t -= dt;
    if (this.t > 0) return;
    this.t = 1;
    const w = this.game.world;
    for (const [k, e] of this.list) {
      if (!w.regionAt(e.x, e.z)) continue;
      const id = w.getBlock(e.x, e.y, e.z);
      if (id !== e.id) {
        this.list.delete(k);
        continue;
      }
      const want = this.stageOf(e);
      const meta = w.getMeta(e.x, e.y, e.z);
      if (cropStage(meta) < want) w.setMeta(e.x, e.y, e.z, (meta & ~META_AGE) | cropMeta(id, want));
      if (want >= CROPS[id].stages - 1) this.list.delete(k);
    }
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
    return [...this.list.values()].map((e) => [e.x, e.y, e.z, e.id, Math.round(e.t0), Math.round(e.per)]);
  }

  load(arr) {
    for (const [x, y, z, id, t0, per] of arr || []) {
      if (BLOCKS[id] && CROPS[id]) this.list.set(this.key(x, y, z), { x, y, z, id, t0, per });
    }
  }
}
