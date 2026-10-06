// The World owns the overworld map, lazily generated regions, settlement
// layouts, and exposes block access in global tile coordinates.
import { REGION_W, REGION_D, WORLD_Y, MAP_W, MAP_H, INST_RX, INST_X0, instSlotOf } from '../config.js';
import { B, BLOCKS, META_STATE } from './blocks.js';
import { Overworld } from './worldgen.js';
import { Terrain } from './terrain.js';
import { generateRegion } from './regiongen.js';
import { Region } from './region.js';
import { layoutJob } from './settlement.js';
import { rollContainerLoot } from './loot.js';
import { settleSites } from './sites.js';

export class World {
  constructor(seed) {
    this.seed = seed >>> 0;
    this.ow = new Overworld(this.seed);
    this.terrain = new Terrain(this.ow);
    // The old places, each at its exact spot (see sites.js).
    this.sites = this.ow.sites;
    settleSites(this, this.sites);
    this.regions = new Map();
    this.saved = new Map(); // serialized modified regions awaiting reload
    this.layouts = new Map();
    this.onChange = null; // (x, y, z, oldId, newId) => void
    this.onLayout = null; // (layout) => void, after a settlement is laid out
    this.onRegionLoad = null; // (region) => void
    this._lastKey = -1;
    this._lastRegion = null;
    // Places apart (a dungeon floor, a ship at sea): their own regions, out
    // past the map's edge, kept only while someone's there. Each in its own
    // slot of that space (see config.INST_SLOT_RX): more than one can be
    // open at once.
    this.insts = new Map(); // slot -> { slot, regions: Map(rx * 4096 + rz -> Region), floor, maxY, ... }
    // (The one place apart opened last the old way: a ship at sea, or on a
    // player's screen in someone else's world, the one they're in.)
    this.inst = null;
  }

  // Open a place apart: its regions (already made) take over the space
  // beyond the map, in its slot (only the one open at a time this way).
  setInstance(inst) {
    if (this.inst && this.inst !== inst) this.closeInst(this.inst);
    this.inst = inst;
    if (inst) this.openInst(inst);
  }

  // Open (or close) one place apart of several, in its own slot.
  openInst(inst) {
    if (inst.slot === undefined) {
      const any = inst.regions && inst.regions.values().next().value;
      inst.slot = any ? instSlotOf(any.rx) : 0;
    }
    this.insts.set(inst.slot, inst);
  }

  closeInst(inst) {
    if (inst && this.insts.get(inst.slot) === inst) this.insts.delete(inst.slot);
    if (this.inst === inst) this.inst = null;
  }

  // The place apart (x, _) is in, if it's open.
  instAt(x) {
    const rx = Math.floor(x / REGION_W);
    if (rx < INST_RX) return null;
    return this.insts.get(instSlotOf(rx)) || null;
  }

  inInstance(x) {
    return Math.floor(x / REGION_W) >= INST_RX;
  }

  regionKey(rx, rz) {
    return rz * MAP_W + rx;
  }

  inBounds(rx, rz) {
    return rx >= 0 && rz >= 0 && rx < MAP_W && rz < MAP_H;
  }

  getLayout(s) {
    return this.layouts.get(s.id) || this.layOut(s);
  }

  // Lay a town out: as much of it as `ms` allows now, the rest on the
  // next call (so the far towns are laid out a little each frame, never
  // stalling one). The layout once it's done, else null.
  layOut(s, ms = Infinity) {
    const done = this.layouts.get(s.id);
    if (done) return done;
    this.layJobs ||= new Map();
    let job = this.layJobs.get(s.id);
    if (!job) this.layJobs.set(s.id, (job = layoutJob(this, s)));
    // A town is always laid out as it was founded; how it has grown since
    // is put back on top.
    const now = s.type;
    if (s.baseType) s.type = s.baseType;
    const t0 = performance.now();
    let r;
    try {
      do r = job.steps.next();
      while (!r.done && performance.now() - t0 < ms);
    } catch (e) {
      this.layJobs.delete(s.id);
      throw e;
    } finally {
      s.type = now;
    }
    if (!r.done) return null;
    this.layJobs.delete(s.id);
    const L = job.L;
    this.layouts.set(s.id, L);
    if (this.onLayout) this.onLayout(L);
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
    // (Someone else's world: the ground comes from them, as they have it.)
    if (this.remote) {
      const d = this.netRegions && this.netRegions.get(key);
      if (!d) {
        this.wantRegion?.(rx, rz);
        return null;
      }
      this.netRegions.delete(key);
      r = Region.deserialize(d);
      r.modified = false;
      this.regions.set(key, r);
      return r;
    }
    const saved = this.saved.get(key);
    r = saved ? Region.deserialize(saved) : generateRegion(this, rx, rz);
    this.regions.set(key, r);
    if (this.onRegionLoad) this.onRegionLoad(r);
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
    if (rx < 0 || rz < 0 || rx >= MAP_W || rz >= MAP_H) {
      if (rx < INST_RX || rz < 0) return null;
      const inst = this.insts.get(instSlotOf(rx));
      return inst ? inst.regions.get(rx * 4096 + rz) || null : null;
    }
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
  // What's in a container already filled, without filling or touching it
  // (null if it's never been: see getContainer).
  peekContainer(x, y, z) {
    const r = this.regionAt(x, z);
    return r ? r.containers.get(((z - r.z0) * REGION_W + (x - r.x0)) * WORLD_Y + y) || null : null;
  }

  getContainer(x, y, z) {
    const r = this.regionAt(x, z);
    if (!r) return null;
    const i = ((z - r.z0) * REGION_W + (x - r.x0)) * WORLD_Y + y;
    let c = r.containers.get(i);
    // (Opened below ground: that floor's kept as it now is, so what's taken
    // stays taken.)
    if (c && r.rx >= INST_RX) r.modified = true;
    if (!c) {
      const s = this.ow.settlementAt(x, z);
      const b = BLOCKS[r.blocks[i]];
      // (Round 62) A chest in a mod's structure fills from its loot table;
      // a mod's own chest starts empty, its size its own.
      c = this.modContainer?.(x, y, z, b) || (b.mod ? new Array(b.modSlots || 9).fill(null) : rollContainerLoot(this, x, y, z, b.name, s));
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
    // (Below ground, nobody climbs up onto the fittings, or the walls.)
    if (x >= INST_X0 && y > 1) {
      const inst = this.instAt(x);
      if (inst && inst.maxY !== undefined && y > inst.maxY) return false;
    }
    const feet = BLOCKS[this.getBlock(x, y, z)];
    // Doors are passable when open (NPCs path through closed ones and open them).
    if (feet.solid && !((feet.interact === 'door' || feet.interact === 'gate') && (allowDoors || this.getState(x, y, z)))) return false;
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

