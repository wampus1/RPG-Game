// The World owns the overworld map, lazily generated regions, settlement
// layouts, and exposes block access in global tile coordinates.
import { REGION_W, REGION_D, WORLD_Y, MAP_W, MAP_H } from '../config.js';
import { B, BLOCKS, META_STATE } from './blocks.js';
import { Overworld } from './worldgen.js';
import { Terrain } from './terrain.js';
import { generateRegion } from './regiongen.js';
import { Region } from './region.js';
import { buildLayout } from './settlement.js';
import { rollContainerLoot } from './loot.js';

export class World {
  constructor(seed) {
    this.seed = seed >>> 0;
    this.ow = new Overworld(this.seed);
    this.terrain = new Terrain(this.ow);
    this.regions = new Map();
    this.saved = new Map(); // serialized modified regions awaiting reload
    this.layouts = new Map();
    this.onChange = null; // (x, y, z, oldId, newId) => void
    this._lastKey = -1;
    this._lastRegion = null;
  }

  regionKey(rx, rz) {
    return rz * MAP_W + rx;
  }

  inBounds(rx, rz) {
    return rx >= 0 && rz >= 0 && rx < MAP_W && rz < MAP_H;
  }

  getLayout(s) {
    let L = this.layouts.get(s.id);
    if (!L) {
      L = buildLayout(this, s);
      this.layouts.set(s.id, L);
    }
    return L;
  }

  isLoaded(rx, rz) {
    return this.regions.has(this.regionKey(rx, rz));
  }

  loadRegion(rx, rz) {
    if (!this.inBounds(rx, rz)) return null;
    const key = this.regionKey(rx, rz);
    let r = this.regions.get(key);
    if (r) return r;
    const saved = this.saved.get(key);
    r = saved ? Region.deserialize(saved) : generateRegion(this, rx, rz);
    this.regions.set(key, r);
    return r;
  }

  unloadRegion(rx, rz) {
    const key = this.regionKey(rx, rz);
    const r = this.regions.get(key);
    if (!r) return;
    if (r.modified) this.saved.set(key, r.serialize());
    this.regions.delete(key);
    if (this._lastKey === key) {
      this._lastKey = -1;
      this._lastRegion = null;
    }
  }

  regionAt(x, z) {
    const rx = Math.floor(x / REGION_W);
    const rz = Math.floor(z / REGION_D);
    if (rx < 0 || rz < 0 || rx >= MAP_W || rz >= MAP_H) return null;
    const key = rz * MAP_W + rx;
    if (key === this._lastKey) return this._lastRegion;
    const r = this.regions.get(key) || null;
    if (r) {
      this._lastKey = key;
      this._lastRegion = r;
    }
    return r;
  }

  getBlock(x, y, z) {
    if (y < 0) return B.bedrock;
    if (y >= WORLD_Y) return B.air;
    const r = this.regionAt(x, z);
    if (!r) return B.bedrock;
    return r.blocks[((z - r.z0) * REGION_W + (x - r.x0)) * WORLD_Y + y];
  }

  getMeta(x, y, z) {
    if (y < 0 || y >= WORLD_Y) return 0;
    const r = this.regionAt(x, z);
    if (!r) return 0;
    return r.meta[((z - r.z0) * REGION_W + (x - r.x0)) * WORLD_Y + y];
  }

  setBlock(x, y, z, id, meta = 0) {
    if (y < 0 || y >= WORLD_Y) return false;
    const r = this.regionAt(x, z);
    if (!r) return false;
    const lx = x - r.x0;
    const lz = z - r.z0;
    const i = (lz * REGION_W + lx) * WORLD_Y + y;
    const old = r.blocks[i];
    r.blocks[i] = id;
    r.meta[i] = meta;
    r.modified = true;
    r.version++;
    if (old !== id) {
      const ti = lz * REGION_W + lx;
      if (id !== 0 && y + 1 > r.top[ti]) r.top[ti] = y + 1;
      else if (id === 0 && y + 1 === r.top[ti]) r.recomputeTop(lx, lz);
      if (BLOCKS[old].interact === 'container' && BLOCKS[id].interact !== 'container') r.containers.delete(i);
    }
    if (this.onChange) this.onChange(x, y, z, old, id);
    return true;
  }

  setMeta(x, y, z, meta) {
    const r = this.regionAt(x, z);
    if (!r || y < 0 || y >= WORLD_Y) return;
    r.meta[((z - r.z0) * REGION_W + (x - r.x0)) * WORLD_Y + y] = meta;
    r.modified = true;
    r.version++;
    if (this.onChange) this.onChange(x, y, z, -1, -1);
  }

  getState(x, y, z) {
    return (this.getMeta(x, y, z) & META_STATE) !== 0;
  }

  setState(x, y, z, on) {
    const m = this.getMeta(x, y, z);
    this.setMeta(x, y, z, on ? m | META_STATE : m & ~META_STATE);
  }

  // Highest non-air y+1 in a column (0 if unloaded).
  topAt(x, z) {
    const r = this.regionAt(x, z);
    if (!r) return 0;
    return r.top[(z - r.z0) * REGION_W + (x - r.x0)];
  }

  // Container inventories are created on first access; loot is rolled from
  // the block's position so it is stable per world seed.
  getContainer(x, y, z) {
    const r = this.regionAt(x, z);
    if (!r) return null;
    const i = ((z - r.z0) * REGION_W + (x - r.x0)) * WORLD_Y + y;
    let c = r.containers.get(i);
    if (!c) {
      const s = this.ow.settlementAt(x, z);
      c = rollContainerLoot(this, x, y, z, BLOCKS[r.blocks[i]].name, s);
      r.containers.set(i, c);
      r.modified = true;
    }
    return c;
  }

  // --- movement helpers -----------------------------------------------------
  // Feet cell: not solid (open doors count as open). Head cell: not solid and
  // not liquid. Below: standable surface.
  canStand(x, y, z, allowDoors = false) {
    if (y < 1 || y >= WORLD_Y - 1) return false;
    const feet = BLOCKS[this.getBlock(x, y, z)];
    if (feet.solid && !(allowDoors && feet.interact === 'door')) return false;
    const head = BLOCKS[this.getBlock(x, y + 1, z)];
    if (head.solid || head.liquid) return false;
    const below = BLOCKS[this.getBlock(x, y - 1, z)];
    return below.standable;
  }

  // Given an entity at height y moving into column (x, z), find the feet
  // height it would end up at (step up 1, level, or drop up to 2), or -1.
  stepTarget(fromX, fromY, fromZ, x, z, allowDoors = false) {
    if (this.canStand(x, fromY, z, allowDoors)) return fromY;
    // Step up needs head room above the current position.
    if (this.canStand(x, fromY + 1, z, allowDoors) && !BLOCKS[this.getBlock(fromX, fromY + 2, fromZ)].solid) return fromY + 1;
    if (this.canStand(x, fromY - 1, z, allowDoors)) return fromY - 1;
    if (this.canStand(x, fromY - 2, z, allowDoors) && !BLOCKS[this.getBlock(x, fromY - 1, z)].solid && !BLOCKS[this.getBlock(x, fromY, z)].solid) return fromY - 2;
    return -1;
  }

  // Find a standable feet height in a column, searching near a hint.
  findStandY(x, z, hint = null) {
    const top = this.topAt(x, z);
    if (hint !== null) {
      for (const d of [0, 1, -1, 2, -2, 3, -3]) if (this.canStand(x, hint + d, z)) return hint + d;
    }
    for (let y = Math.min(WORLD_Y - 2, top); y >= 1; y--) if (this.canStand(x, y, z)) return y;
    return -1;
  }

  isWaterAt(x, y, z) {
    return this.getBlock(x, y, z) === B.water;
  }
}

