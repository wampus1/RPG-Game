// A region is one world-map square: REGION_W x REGION_D columns of WORLD_Y cells.
import { REGION_W, REGION_D, WORLD_Y } from '../config.js';
import { BLOCKS } from './blocks.js';

export class Region {
  constructor(rx, rz) {
    this.rx = rx;
    this.rz = rz;
    this.x0 = rx * REGION_W;
    this.z0 = rz * REGION_D;
    this.blocks = new Uint8Array(REGION_W * REGION_D * WORLD_Y);
    this.meta = new Uint8Array(REGION_W * REGION_D * WORLD_Y);
    this.top = new Uint8Array(REGION_W * REGION_D); // highest non-air y + 1
    this.containers = new Map(); // cell index -> slots array
    this.modified = false;
    this.version = 0; // bumped on every edit (for caches)
  }

  static idx(lx, y, lz) {
    return (lz * REGION_W + lx) * WORLD_Y + y;
  }

  get(lx, y, lz) {
    return this.blocks[(lz * REGION_W + lx) * WORLD_Y + y];
  }

  set(lx, y, lz, id, meta = 0) {
    const i = (lz * REGION_W + lx) * WORLD_Y + y;
    this.blocks[i] = id;
    this.meta[i] = meta;
  }

  recomputeTops() {
    for (let lz = 0; lz < REGION_D; lz++) {
      for (let lx = 0; lx < REGION_W; lx++) this.recomputeTop(lx, lz);
    }
  }

  recomputeTop(lx, lz) {
    const base = (lz * REGION_W + lx) * WORLD_Y;
    let t = 0;
    for (let y = WORLD_Y - 1; y >= 0; y--) {
      if (this.blocks[base + y] !== 0) {
        t = y + 1;
        break;
      }
    }
    this.top[lz * REGION_W + lx] = t;
  }

  // Serialize edits compactly for save games (RLE over blocks+meta).
  serialize() {
    const out = [];
    const n = this.blocks.length;
    let i = 0;
    while (i < n) {
      const b = this.blocks[i];
      const m = this.meta[i];
      let run = 1;
      while (i + run < n && run < 65535 && this.blocks[i + run] === b && this.meta[i + run] === m) run++;
      out.push(run, b, m);
      i += run;
    }
    const containers = [];
    for (const [k, v] of this.containers) containers.push([k, v]);
    return { rx: this.rx, rz: this.rz, rle: out, containers };
  }

  static deserialize(data) {
    const r = new Region(data.rx, data.rz);
    let i = 0;
    const rle = data.rle;
    for (let k = 0; k < rle.length; k += 3) {
      const run = rle[k];
      r.blocks.fill(rle[k + 1], i, i + run);
      r.meta.fill(rle[k + 2], i, i + run);
      i += run;
    }
    for (const [k, v] of data.containers || []) r.containers.set(k, v);
    r.modified = true;
    r.recomputeTops();
    return r;
  }
}

export function blockDef(id) {
  return BLOCKS[id];
}
