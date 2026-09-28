// Settlement layout generation: roads, plazas, buildings (with interiors),
// farms, docks, walls and decoration. Output is a set of block placements
// bucketed per region, plus semantic data (buildings, spots) used by NPCs.
import { SURFACE, GROUND, REGION_W, REGION_D } from '../config.js';
import { RNG, hash4 } from '../util/rng.js';
import { B, META_STATE } from './blocks.js';
import { TREE_BUILDERS } from './trees.js';
import { planPopulation, generateNPCs, JOBS } from '../entities/npcgen.js';

export const M = { FREE: 0, ROAD: 1, BUILD: 2, WATER: 3, FIELD: 4, PLAZA: 5, YARD: 6, WALL: 7, BRIDGE: 8, DECOR: 9 };
const Y0 = GROUND; // first layer above the floor

const SPECS = {
  house_s: { size: [[5, 5], [6, 5]], beds: 2, residential: true },
  house_m: { size: [[7, 5], [7, 6]], beds: 3, residential: true },
  house_l: { size: [[9, 6], [9, 7]], beds: 6, residential: true },
  manor: { size: [[11, 8], [12, 8]], beds: 5, residential: true, tall: 3, civic: true },
  tavern: { size: [[11, 7], [10, 7]], tall: 3 },
  shop: { size: [[7, 6], [7, 5]] },
  smithy: { size: [[7, 6], [8, 6]] },
  temple: { size: [[9, 9], [9, 8]], tall: 3, civic: true },
  bakery: { size: [[6, 6], [7, 5]] },
  library: { size: [[9, 6], [8, 6]], tall: 3, civic: true },
  townhall: { size: [[11, 8], [10, 8]], tall: 3, civic: true },
  guardhouse: { size: [[7, 6], [6, 6]] },
  tailor: { size: [[6, 5], [6, 6]] },
  workshop: { size: [[7, 5], [7, 6]] },
  herbalist: { size: [[6, 5], [6, 6]] },
  warehouse: { size: [[9, 6], [8, 6]] },
  barn: { size: [[7, 6], [8, 6]], tall: 3 },
};

export const BUILDING_NAMES = {
  house_s: 'Cottage', house_m: 'House', house_l: 'Family House', manor: 'Manor', tavern: 'Tavern',
  shop: 'General Store', smithy: 'Smithy', temple: 'Temple', bakery: 'Bakery', library: 'Library',
  townhall: 'Town Hall', guardhouse: 'Guardhouse', tailor: 'Tailor', workshop: 'Carpentry',
  herbalist: 'Herbalist', warehouse: 'Warehouse', barn: 'Barn',
};

const TAVERN_NAMES = ['Prancing Pony', 'Rusty Tankard', 'Sleeping Dragon', 'Golden Goose', 'Laughing Wolf', 'Salted Eel', 'Crooked Crown', 'Drunken Owl', 'Hearth & Horn', 'Wandering Star'];

const DIRS4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];

export function buildLayout(world, s) {
  const L = new Layout(world, s);
  L.generate();
  return L;
}

class Layout {
  constructor(world, s) {
    this.world = world;
    this.settlement = s;
    this.rng = new RNG(hash4(s.seed, 0x1a70));
    const b = s.bounds;
    this.bounds = b;
    this.W = b.x1 - b.x0 + 1;
    this.D = b.z1 - b.z0 + 1;
    this.mask = new Uint8Array(this.W * this.D);
    this.placements = new Map();
    this.local = new Map();
    this.buildings = [];
    this.spots = [];
    this.fields = [];
    this.patrol = [];
    this.chimneys = [];
    this.lamps = [];
    this.gates = [];
    this.signs = [];
    this.plaza = null;
    this.npcs = [];
  }

  // ------------------------------------------------------------ basics
  maskAt(x, z) {
    const lx = x - this.bounds.x0;
    const lz = z - this.bounds.z0;
    if (lx < 0 || lz < 0 || lx >= this.W || lz >= this.D) return M.FREE;
    return this.mask[lz * this.W + lx];
  }
  setMask(x, z, v) {
    const lx = x - this.bounds.x0;
    const lz = z - this.bounds.z0;
    if (lx < 0 || lz < 0 || lx >= this.W || lz >= this.D) return;
    this.mask[lz * this.W + lx] = v;
  }
  inside(x, z, inset = 0) {
    const b = this.bounds;
    return x >= b.x0 + inset && x <= b.x1 - inset && z >= b.z0 + inset && z <= b.z1 - inset;
  }
  put(x, y, z, id, meta = 0) {
    const rk = this.world.regionKey(Math.floor(x / REGION_W), Math.floor(z / REGION_D));
    let arr = this.placements.get(rk);
    if (!arr) {
      arr = [];
      this.placements.set(rk, arr);
    }
    arr.push(x, y, z, id, meta);
    this.local.set(`${x},${y},${z}`, id);
  }
  at(x, y, z) {
    return this.local.get(`${x},${y},${z}`);
  }
  addSpot(x, z, face, tags, extra = {}) {
    const sp = { x, y: Y0, z, face, tags, ...extra };
    this.spots.push(sp);
    return sp;
  }
  spotsByTag(tag) {
    return this.spots.filter((s) => s.tags.includes(tag));
  }

  // ------------------------------------------------------------ generation
  generate() {
    const s = this.settlement;
    const rng = this.rng;
    const ow = this.world.ow;
    s.nearMountain = false;
    for (let dz = -2; dz <= s.cd + 1; dz++) {
      for (let dx = -2; dx <= s.cw + 1; dx++) {
        if ((ow.cell(s.cx + dx, s.cz + dz)?.mountainness || 0) > 0.3) s.nearMountain = true;
      }
    }
    this.plan = planPopulation(s, rng.fork('plan'));
    this.mats = this.pickSettlementMats();
    this.scanTerrain();
    if (s.type === 'city') this.cityWalls();
    this.roads();
    this.placeBuildings();
    this.docks();
    this.decorate();
    this.wilds();
    this.paintGround();
    if (s.condition !== 'abandoned') this.npcs = generateNPCs(this, this.plan, hash4(s.seed, 0x5eed));
    this.local = null; // free construction scratch
  }

  scanTerrain() {
    const b = this.bounds;
    const terrain = this.world.terrain;
    const ctx = terrain.context(b.x0 - 16, b.z0 - 16, b.x1 + 16, b.z1 + 16);
    this.ctx = ctx;
    this.cols = new Array(this.W * this.D);
    for (let lz = 0; lz < this.D; lz++) {
      for (let lx = 0; lx < this.W; lx++) {
        const c = terrain.column(b.x0 + lx, b.z0 + lz, ctx, {});
        this.cols[lz * this.W + lx] = c;
        if (c.water >= 0) this.mask[lz * this.W + lx] = M.WATER;
      }
    }
  }
  col(x, z) {
    return this.cols[(z - this.bounds.z0) * this.W + (x - this.bounds.x0)];
  }

  pickSettlementMats() {
    const s = this.settlement;
    const cond = s.condition;
    const T = s.type;
    const cold = ['taiga', 'tundra'].includes(s.biome);
    const hot = ['desert', 'savanna'].includes(s.biome);
    let road = T === 'village' ? B.path : T === 'town' ? (cond === 'prosperous' ? B.cobblestone : B.gravel) : B.cobblestone;
    let plaza = T === 'city' ? B.stone_bricks : T === 'town' ? B.cobblestone : B.gravel;
    if (s.style === 'sun' && T !== 'village') {
      road = B.sandstone;
      plaza = B.sandstone;
    }
    if (cond === 'poor' || cond === 'abandoned') {
      road = B.path;
      if (plaza === B.stone_bricks) plaza = B.cobblestone;
    }
    return { road, plaza, cold, hot };
  }

  buildingMats(type, rng) {
    const s = this.settlement;
    const T = s.type;
    const civic = SPECS[type]?.civic;
    const { cold, hot } = this.mats;
    let style = s.style;
    if (hot && style !== 'high' && rng.chance(0.6)) style = 'sun';
    if (cold && style === 'vale' && rng.chance(0.5)) style = 'north';
    let wall;
    let corner;
    let floor;
    let roof;
    let flat = false;
    switch (style) {
      case 'north':
        wall = rng.weighted([[B.log_wall, 3], [B.planks_dark, 2], [B.cobblestone, civic ? 2 : 0.5]]);
        corner = B.log_pine;
        floor = B.planks_dark;
        roof = cold ? B.roof_snow : B.roof_wood;
        break;
      case 'sun':
        wall = rng.weighted([[B.adobe, 3], [B.sandstone, 2], [B.plaster, civic ? 2 : 0.5]]);
        corner = wall;
        floor = B.sandstone;
        roof = wall === B.sandstone ? B.adobe : B.sandstone;
        if (rng.chance(0.3)) roof = B.bricks;
        flat = true;
        break;
      case 'wild':
        wall = rng.weighted([[B.planks_birch, 3], [B.log_jungle, 1], [B.adobe, 1]]);
        corner = B.log_jungle;
        floor = B.planks_birch;
        roof = rng.chance(0.75) ? B.thatch : B.roof_green;
        break;
      case 'high':
        wall = rng.weighted([[B.stone_bricks, 3], [B.cobblestone, 2], [B.bricks, 1]]);
        corner = B.stone_bricks;
        floor = B.stone_bricks;
        roof = rng.chance(0.7) ? B.roof_slate : B.roof_green;
        break;
      default:
        wall = rng.weighted([[B.timber, 3], [B.plaster, 2], [B.planks, 2], [B.cobblestone, 1], [B.bricks, T === 'city' ? 2 : 0.3]]);
        corner = wall === B.timber || wall === B.plaster ? B.log_oak : wall === B.planks ? B.log_oak : wall;
        floor = B.planks;
        roof = T === 'village'
          ? rng.weighted([[B.thatch, 3], [B.roof_wood, 2], [B.roof_red, 0.5]])
          : T === 'town'
            ? rng.weighted([[B.roof_red, 3], [B.roof_wood, 2], [B.thatch, 1], [B.roof_slate, 0.5]])
            : rng.weighted([[B.roof_slate, 3], [B.roof_red, 3], [B.roof_green, 0.5]]);
    }
    if (civic && T !== 'village' && style !== 'sun') {
      if (type === 'temple') wall = s.condition === 'prosperous' || T === 'city' ? B.marble : B.stone_bricks;
      else if (rng.chance(0.6)) wall = rng.pick([B.stone_bricks, B.bricks]);
      corner = wall === B.marble ? B.marble : B.stone_bricks;
      floor = type === 'temple' ? B.marble : B.stone_bricks;
      if (!flat) roof = cold ? B.roof_snow : rng.chance(0.3) ? B.roof_green : B.roof_slate;
    }
    if (type === 'barn') {
      wall = style === 'sun' ? B.adobe : B.planks;
      corner = style === 'sun' ? B.adobe : B.log_oak;
      floor = B.dirt;
    }
    if (cold && !flat && roof !== B.roof_snow && rng.chance(0.7)) roof = B.roof_snow;
    return { wall, corner, floor, roof, flat, style };
  }

  // ------------------------------------------------------------ walls
  cityWalls() {
    const b = this.bounds;
    const W = B.stone_bricks;
    const edge = (x, z) => x === b.x0 || x === b.x1 || z === b.z0 || z === b.z1;
    for (let z = b.z0; z <= b.z1; z++) {
      for (let x = b.x0; x <= b.x1; x++) {
        if (!edge(x, z)) continue;
        this.setMask(x, z, M.WALL);
      }
    }
    this.wallBlock = W;
  }

  finishCityWalls() {
    const b = this.bounds;
    const cond = this.settlement.condition;
    const rng = this.rng.fork('walls');
    for (let z = b.z0; z <= b.z1; z++) {
      for (let x = b.x0; x <= b.x1; x++) {
        if (this.maskAt(x, z) !== M.WALL) continue;
        const water = this.col(x, z).water >= 0;
        if (water) this.put(x, SURFACE, z, B.stone_bricks);
        for (let y = Y0; y < Y0 + 3; y++) {
          let id = this.wallBlock;
          if (cond === 'poor' && rng.chance(0.15)) id = rng.chance(0.5) ? B.mossy_bricks : B.cracked_bricks;
          this.put(x, y, z, id);
        }
        if ((x + z) % 2 === 0) this.put(x, Y0 + 3, z, this.wallBlock);
      }
    }
    // Corner towers.
    for (const [cx, cz] of [[b.x0, b.z0], [b.x1, b.z0], [b.x0, b.z1], [b.x1, b.z1]]) {
      for (let dz = -1; dz <= 1; dz++) {
        for (let dx = -1; dx <= 1; dx++) {
          const x = cx + dx;
          const z = cz + dz;
          for (let y = Y0; y < Y0 + 4; y++) this.put(x, y, z, B.stone_bricks);
          if (Math.abs(dx) + Math.abs(dz) === 2 || (dx === 0 && dz === 0)) this.put(x, Y0 + 4, z, B.stone_bricks);
        }
      }
      this.put(cx, Y0 + 5, cz, B.lantern, META_STATE);
    }
  }

  // ------------------------------------------------------------ roads
  paveRoad(x, z) {
    if (!this.inside(x, z)) return;
    const m = this.maskAt(x, z);
    if (m === M.WALL) {
      // Gate through the city wall.
      this.setMask(x, z, M.ROAD);
      this.gates.push({ x, z });
      return;
    }
    if (m === M.WATER) this.setMask(x, z, M.BRIDGE);
    else if (m === M.FREE || m === M.YARD) this.setMask(x, z, M.ROAD);
  }

  hRoad(z, xa, xb, w) {
    for (let x = Math.min(xa, xb); x <= Math.max(xa, xb); x++) for (let k = 0; k < w; k++) this.paveRoad(x, z + k);
  }
  vRoad(x, za, zb, w) {
    for (let z = Math.min(za, zb); z <= Math.max(za, zb); z++) for (let k = 0; k < w; k++) this.paveRoad(x + k, z);
  }

  roads() {
    const s = this.settlement;
    const b = this.bounds;
    const rng = this.rng.fork('roads');
    const cx = b.x0 + Math.floor(this.W / 2) + rng.int(-3, 3);
    const cz = b.z0 + Math.floor(this.D / 2) + rng.int(-2, 2);
    let pw;
    let pd;
    if (s.type === 'village') {
      this.hRoad(cz, b.x0, b.x1, 2);
      if (rng.chance(0.75)) this.vRoad(cx, b.z0, b.z1, 2);
      else this.vRoad(cx, cz, rng.chance(0.5) ? b.z0 : b.z1, 2);
      pw = 7;
      pd = 6;
      this.patrol.push({ x: b.x0 + 1, z: cz }, { x: b.x1 - 1, z: cz });
    } else if (s.type === 'town') {
      this.hRoad(cz, b.x0, b.x1, 3);
      this.vRoad(cx, b.z0, b.z1, 3);
      pw = 11;
      pd = 8;
      this.patrol.push({ x: b.x0 + 1, z: cz + 1 }, { x: b.x1 - 1, z: cz + 1 }, { x: cx + 1, z: b.z0 + 1 }, { x: cx + 1, z: b.z1 - 1 });
    } else {
      // City: ring road inside the walls plus a street grid.
      this.hRoad(b.z0 + 2, b.x0 + 2, b.x1 - 2, 2);
      this.hRoad(b.z1 - 3, b.x0 + 2, b.x1 - 2, 2);
      this.vRoad(b.x0 + 2, b.z0 + 2, b.z1 - 2, 2);
      this.vRoad(b.x1 - 3, b.z0 + 2, b.z1 - 2, 2);
      for (let x = b.x0 + 18; x < b.x1 - 10; x += rng.int(16, 19)) this.vRoad(x, b.z0 + 2, b.z1 - 2, 2);
      for (let z = b.z0 + 15; z < b.z1 - 8; z += rng.int(13, 15)) this.hRoad(z, b.x0 + 2, b.x1 - 2, 2);
      this.hRoad(cz, b.x0, b.x1, 3);
      this.vRoad(cx, b.z0, b.z1, 3);
      pw = 15;
      pd = 10;
      for (const g of [[b.x0 + 1, cz + 1], [b.x1 - 1, cz + 1], [cx + 1, b.z0 + 1], [cx + 1, b.z1 - 1]]) this.patrol.push({ x: g[0], z: g[1] });
      this.patrol.push({ x: b.x0 + 3, z: b.z0 + 3 }, { x: b.x1 - 4, z: b.z1 - 4 }, { x: b.x1 - 4, z: b.z0 + 3 }, { x: b.x0 + 3, z: b.z1 - 4 });
    }
    // Plaza around the main intersection.
    const px0 = cx + 1 - Math.floor(pw / 2);
    const pz0 = cz + 1 - Math.floor(pd / 2);
    for (let z = pz0; z < pz0 + pd; z++) {
      for (let x = px0; x < px0 + pw; x++) {
        if (!this.inside(x, z, 1)) continue;
        const m = this.maskAt(x, z);
        if (m === M.WATER) this.setMask(x, z, M.BRIDGE);
        else if (m !== M.WALL) this.setMask(x, z, M.PLAZA);
      }
    }
    this.plaza = { x0: px0, z0: pz0, x1: px0 + pw - 1, z1: pz0 + pd - 1, cx: cx + 1, cz: cz + 1 };
    this.entrances = this.patrol.slice();
    this.patrol.push({ x: cx + 1, z: cz + 3 });
  }

  // ------------------------------------------------------------ buildings
  frontage() {
    const out = [];
    const b = this.bounds;
    for (let z = b.z0; z <= b.z1; z++) {
      for (let x = b.x0; x <= b.x1; x++) {
        const m = this.maskAt(x, z);
        if (m !== M.ROAD && m !== M.PLAZA) continue;
        for (const [dx, dz] of DIRS4) {
          const n = this.maskAt(x + dx, z + dz);
          if (n === M.FREE && this.inside(x + dx, z + dz, 1)) out.push({ x, z, dx, dz });
        }
      }
    }
    return out;
  }

  rectFor(c, w, d, off) {
    if (c.dz === -1) return { x0: c.x - off, x1: c.x - off + w - 1, z1: c.z - 2, z0: c.z - 2 - d + 1, door: { x: c.x, z: c.z - 2, rot: 0 } };
    if (c.dz === 1) return { x0: c.x - off, x1: c.x - off + w - 1, z0: c.z + 2, z1: c.z + 2 + d - 1, door: { x: c.x, z: c.z + 2, rot: 2 } };
    if (c.dx === -1) return { x1: c.x - 2, x0: c.x - 2 - d + 1, z0: c.z - off, z1: c.z - off + w - 1, door: { x: c.x - 2, z: c.z, rot: 3 } };
    return { x0: c.x + 2, x1: c.x + 2 + d - 1, z0: c.z - off, z1: c.z - off + w - 1, door: { x: c.x + 2, z: c.z, rot: 1 } };
  }

  rectOk(r, allowWater) {
    const inset = this.settlement.type === 'city' ? 2 : 1;
    if (!this.inside(r.x0, r.z0, inset) || !this.inside(r.x1, r.z1, inset)) return false;
    for (let z = r.z0 - 1; z <= r.z1 + 1; z++) {
      for (let x = r.x0 - 1; x <= r.x1 + 1; x++) {
        const m = this.maskAt(x, z);
        const ring = x < r.x0 || x > r.x1 || z < r.z0 || z > r.z1;
        if (ring) {
          // Towns and cities allow terraced buildings that share a wall line.
          if ((m === M.BUILD && this.settlement.type === 'village') || m === M.WALL || m === M.FIELD) return false;
        } else if (!(m === M.FREE || (allowWater && m === M.WATER && !this.col(x, z).deep))) return false;
      }
    }
    return true;
  }

  placeBuilding(type, cands, rng) {
    const spec = SPECS[type];
    const allowWater = this.settlement.biome === 'swamp';
    for (const c of cands) {
      for (const [w, d] of spec.size) {
        const offs = rng.shuffle([...Array(Math.max(1, w - 2)).keys()].map((i) => i + 1)).slice(0, 3);
        for (const off of offs) {
          const r = this.rectFor(c, w, d, off);
          if (!this.rectOk(r, allowWater)) continue;
          const front = { x: c.x + c.dx, z: c.z + c.dz };
          const fm = this.maskAt(front.x, front.z);
          if (fm !== M.FREE && fm !== M.ROAD && fm !== M.YARD) continue;
          return this.commitBuilding(type, r, front, rng);
        }
      }
    }
    return null;
  }

  commitBuilding(type, r, front, rng) {
    for (let z = r.z0 - 1; z <= r.z1 + 1; z++) {
      for (let x = r.x0 - 1; x <= r.x1 + 1; x++) {
        const inRect = x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1;
        if (inRect) this.setMask(x, z, M.BUILD);
        else if (this.maskAt(x, z) === M.FREE && this.settlement.type === 'village') this.setMask(x, z, M.YARD);
      }
    }
    this.setMask(front.x, front.z, M.ROAD);
    const bld = {
      id: this.buildings.length,
      type,
      name: BUILDING_NAMES[type],
      x0: r.x0, z0: r.z0, x1: r.x1, z1: r.z1,
      door: r.door,
      outside: front,
      residential: !!SPECS[type].residential,
      beds: [],
      work: [],
      seats: [],
      free: [],
      household: null,
      mats: this.buildingMats(type, rng),
    };
    const DX = [0, -1, 0, 1];
    const DZ = [1, 0, -1, 0];
    bld.inside = { x: r.door.x - DX[r.door.rot], z: r.door.z - DZ[r.door.rot] };
    if (type === 'tavern') bld.name = `The ${rng.pick(TAVERN_NAMES)}`;
    this.buildings.push(bld);
    return bld;
  }

  placeBuildings() {
    const s = this.settlement;
    const rng = this.rng.fork('bld');
    const plaza = this.plaza;
    const byPlaza = (list) => list.sort((a, b) => Math.hypot(a.x - plaza.cx, a.z - plaza.cz) - Math.hypot(b.x - plaza.cx, b.z - plaza.cz));
    // Work buildings first (near the plaza), then houses.
    const need = new Map();
    const count = (t, n = 1) => need.set(t, (need.get(t) || 0) + n);
    const jobs = this.plan.jobs;
    const jc = (j) => jobs.filter((x) => x === j).length;
    if (jc('innkeeper') || jc('barkeep')) count('tavern', s.type === 'city' ? 2 : 1);
    if (jc('mayor')) count('townhall');
    if (jc('priest')) count('temple');
    if (jc('merchant')) count('shop', Math.max(1, Math.ceil(jc('merchant') / 2)));
    if (jc('blacksmith')) count('smithy', Math.ceil(jc('blacksmith') / 2));
    if (jc('baker')) count('bakery');
    if (jc('scholar')) count('library');
    if (jc('guard') && s.type !== 'village') count('guardhouse', s.type === 'city' ? 2 : 1);
    if (jc('guard') && s.type === 'village' && rng.chance(0.5)) count('guardhouse');
    if (jc('tailor')) count('tailor');
    if (jc('carpenter')) count('workshop');
    if (jc('herbalist')) count('herbalist');
    if (jc('laborer')) count('warehouse', Math.max(1, Math.ceil(jc('laborer') / 4)));
    if (jc('farmer')) count('barn', s.type === 'village' ? 1 : Math.ceil(jc('farmer') / 5));
    let civicOrder = ['townhall', 'temple', 'tavern', 'shop', 'library', 'smithy', 'bakery', 'guardhouse', 'tailor', 'workshop', 'herbalist', 'warehouse', 'barn'];
    if (s.type === 'village') {
      // Villages only support a handful of trades.
      const keep = new Set(['tavern', 'barn']);
      for (const t of rng.shuffle(['temple', 'shop', 'smithy', 'bakery', 'workshop', 'herbalist', 'guardhouse'].filter((t) => need.has(t))).slice(0, 2)) keep.add(t);
      civicOrder = civicOrder.filter((t) => keep.has(t));
    }
    let cands = this.frontage();
    const nearCands = byPlaza([...cands]);
    // Essential civic buildings claim the plaza first; the rest are placed
    // after houses so everyone gets a home.
    const essential = new Set(['townhall', 'temple', 'tavern', 'shop', 'guardhouse']);
    const late = [];
    for (const t of civicOrder) {
      for (let i = 0; i < (need.get(t) || 0); i++) {
        if (!essential.has(t) || i > 0) {
          late.push(t);
          continue;
        }
        this.placeBuilding(t, nearCands, rng);
      }
    }
    // Houses: one per household, sized to fit it; nobles get manors.
    const hhs = [...this.plan.households].sort((a, b) => b.members.length - a.members.length);
    let nobles = jc('noble');
    cands = rng.shuffle(this.frontage());
    let lanes = 0;
    for (const h of hhs) {
      const n = h.members.length;
      let t = n <= 2 ? 'house_s' : n === 3 ? 'house_m' : 'house_l';
      if (nobles > 0 && h.members.some((m) => m.age === 'adult')) {
        t = 'manor';
        nobles--;
      }
      let bld = null;
      for (let attempt = 0; attempt < 4 && !bld; attempt++) {
        bld = this.placeBuilding(t, cands, rng);
        if (!bld && t === 'manor') bld = this.placeBuilding('house_l', cands, rng);
        if (!bld && n <= 5 && t === 'house_l') bld = this.placeBuilding('house_m', cands, rng);
        if (!bld && lanes < 10 && this.growLane(rng)) {
          lanes++;
          cands = rng.shuffle(this.frontage());
        } else if (!bld) break;
      }
      if (bld && cands.length > 50) cands = cands.filter((c) => this.maskAt(c.x + c.dx, c.z + c.dz) === M.FREE);
    }
    // Remaining trades, then fields on the outskirts.
    for (const t of late) {
      if (!this.placeBuilding(t, byPlaza(this.frontage()), rng) && this.growLane(rng)) this.placeBuilding(t, byPlaza(this.frontage()), rng);
    }
    this.farms();
    for (const b of this.buildings) this.construct(b, rng.fork(b.id + 7));
  }

  // Extend a side lane off an existing road into open ground.
  growLane(rng) {
    const w = this.settlement.type === 'city' ? 2 : 1;
    const opts = rng.shuffle(this.frontage());
    for (const c of opts.slice(0, 120)) {
      const len = rng.int(7, 14);
      const tiles = [];
      for (let i = 1; i <= len; i++) {
        const x = c.x + c.dx * i;
        const z = c.z + c.dz * i;
        let ok = this.inside(x, z, 3);
        for (let k = 0; k < w && ok; k++) {
          const px = x + (c.dz !== 0 ? k : 0);
          const pz = z + (c.dx !== 0 ? k : 0);
          if (this.maskAt(px, pz) !== M.FREE) ok = false;
          // Keep a clear tile either side so buildings can front onto the lane.
          for (const s of [-1, w]) {
            const sx = x + (c.dz !== 0 ? s : 0);
            const sz = z + (c.dx !== 0 ? s : 0);
            const m = this.maskAt(sx, sz);
            if (m === M.BUILD || m === M.FIELD) ok = false;
          }
        }
        if (!ok) break;
        tiles.push({ x, z });
      }
      if (tiles.length < 6) continue;
      for (const t of tiles) {
        for (let k = 0; k < w; k++) {
          this.setMask(t.x + (c.dz !== 0 ? k : 0), t.z + (c.dx !== 0 ? k : 0), M.ROAD);
        }
      }
      return true;
    }
    return false;
  }

  // ------------------------------------------------------------ construction
  construct(b, rng) {
    const s = this.settlement;
    const spec = SPECS[b.type];
    const mats = b.mats;
    const cond = s.condition;
    const poor = cond === 'poor';
    const ruined = cond === 'abandoned';
    const wallH = spec.tall || 2;
    const topWall = Y0 + wallH - 1;
    const roofBase = topWall + 1;
    b.floorY = SURFACE;
    b.roofBase = roofBase;
    const { x0, z0, x1, z1 } = b;
    const door = b.door;
    // Stilts over water in swamps: supports under the floor.
    for (let z = z0; z <= z1; z++) {
      for (let x = x0; x <= x1; x++) {
        const c = this.col(x, z);
        if (c.water >= 0) for (let y = c.h + 1; y < SURFACE; y++) if ((x === x0 || x === x1) && (z === z0 || z === z1)) this.put(x, y, z, B.log_oak);
        this.put(x, SURFACE, z, mats.floor);
      }
    }
    const isCorner = (x, z) => (x === x0 || x === x1) && (z === z0 || z === z1);
    const onWall = (x, z) => x === x0 || x === x1 || z === z0 || z === z1;
    const doorAdj = (x, z) => Math.abs(x - door.x) + Math.abs(z - door.z) === 1;
    for (let z = z0; z <= z1; z++) {
      for (let x = x0; x <= x1; x++) {
        if (!onWall(x, z)) continue;
        for (let y = Y0; y <= topWall; y++) {
          let id = isCorner(x, z) ? mats.corner : mats.wall;
          const windowRow = y === Y0 + 1 || (wallH === 3 && y === Y0 + 2 && rng.chance(0.5));
          const alongX = z === z0 || z === z1;
          const k = alongX ? x - x0 : z - z0;
          if (!isCorner(x, z) && windowRow && k % 2 === 0 && !doorAdj(x, z) && !(x === door.x && z === door.z)) {
            id = cond === 'prosperous' || rng.chance(0.75) ? B.glass : mats.wall;
            if ((poor && rng.chance(0.3)) || ruined) id = rng.chance(0.5) ? B.air : B.planks;
          }
          if (poor && id !== B.glass && rng.chance(0.12)) id = this.decay(id, rng);
          if (ruined && y >= Y0 + 1 && rng.chance(0.35)) id = B.air;
          if (ruined && id !== B.air && rng.chance(0.2)) id = this.decay(id, rng);
          this.put(x, y, z, id);
        }
      }
    }
    // Door (two halves).
    if (!ruined || rng.chance(0.4)) {
      this.put(door.x, Y0, door.z, B.door, door.rot);
      this.put(door.x, Y0 + 1, door.z, B.door_top, door.rot);
    } else {
      this.put(door.x, Y0, door.z, B.air);
      this.put(door.x, Y0 + 1, door.z, B.air);
    }
    for (let y = Y0 + 2; y <= topWall; y++) this.put(door.x, y, door.z, mats.wall);
    // Roof.
    this.roof(b, roofBase, rng, poor, ruined);
    // Interior.
    this.furnish(b, rng);
    // Exterior touches.
    this.exterior(b, rng);
  }

  decay(id, rng) {
    if (id === B.stone_bricks || id === B.cobblestone || id === B.bricks || id === B.marble) return rng.chance(0.5) ? B.mossy_bricks : B.cracked_bricks;
    if (id === B.plaster || id === B.timber) return B.planks;
    if (id === B.planks || id === B.planks_dark || id === B.planks_birch || id === B.log_wall) return B.planks_dark;
    return id;
  }

  roof(b, roofBase, rng, poor, ruined) {
    const { x0, z0, x1, z1, mats } = b;
    if (mats.flat) {
      for (let z = z0; z <= z1; z++) {
        for (let x = x0; x <= x1; x++) {
          if (ruined && rng.chance(0.4)) continue;
          this.put(x, roofBase, z, mats.roof);
          const edge = x === x0 || x === x1 || z === z0 || z === z1;
          const corner = (x === x0 || x === x1) && (z === z0 || z === z1);
          if (corner || (edge && (x + z) % 3 === 0)) this.put(x, roofBase + 1, z, b.mats.wall);
          else if (!edge && rng.chance(0.05)) this.put(x, roofBase + 1, z, rng.pick([B.barrel, B.crate, B.hay_bale]));
          else if (!edge && rng.chance(0.04)) this.put(x, roofBase + 1, z, rng.pick([B.rug_red, B.rug_blue]));
        }
      }
      b.roofTop = (z) => roofBase;
      return;
    }
    const depth = z1 - z0 + 1;
    const layers = Math.ceil(depth / 2);
    for (let k = 0; k < layers; k++) {
      const y = roofBase + k;
      const zs = z0 + k;
      const ze = z1 - k;
      for (let x = x0; x <= x1; x++) {
        for (const z of zs === ze ? [zs] : [zs, ze]) {
          if ((poor && rng.chance(0.06)) || (ruined && rng.chance(0.45))) continue;
          const rot = zs === ze ? 1 : z === zs ? 2 : 0;
          this.put(x, y, z, mats.roof, rot);
        }
      }
    }
    b.roofTop = (z) => roofBase + Math.min(z - z0, z1 - z);
  }

  // Furnish interior: place items so all free tiles stay connected to the door.
  furnish(b, rng) {
    const s = this.settlement;
    const ruined = s.condition === 'abandoned';
    const lit = ruined ? 0 : META_STATE;
    const { x0, z0, x1, z1 } = b;
    const ix0 = x0 + 1;
    const iz0 = z0 + 1;
    const ix1 = x1 - 1;
    const iz1 = z1 - 1;
    const occ = new Set();
    const key = (x, z) => x * 100000 + z;
    const reserved = new Set([key(b.inside.x, b.inside.z)]);
    const DX = [0, -1, 0, 1];
    const DZ = [1, 0, -1, 0];
    const inward2 = { x: b.inside.x - DX[b.door.rot], z: b.inside.z - DZ[b.door.rot] };
    if (inward2.x >= ix0 && inward2.x <= ix1 && inward2.z >= iz0 && inward2.z <= iz1) reserved.add(key(inward2.x, inward2.z));
    const interior = [];
    for (let z = iz0; z <= iz1; z++) for (let x = ix0; x <= ix1; x++) interior.push({ x, z });
    const isIn = (x, z) => x >= ix0 && x <= ix1 && z >= iz0 && z <= iz1;
    const connected = () => {
      const start = b.inside;
      if (occ.has(key(start.x, start.z))) return false;
      const seen = new Set([key(start.x, start.z)]);
      const q = [start];
      while (q.length) {
        const c = q.pop();
        for (const [dx, dz] of DIRS4) {
          const nx = c.x + dx;
          const nz = c.z + dz;
          const k = key(nx, nz);
          if (!isIn(nx, nz) || occ.has(k) || seen.has(k)) continue;
          seen.add(k);
          q.push({ x: nx, z: nz });
        }
      }
      return seen.size === interior.length - occ.size;
    };
    const wallSide = (t) => {
      // Returns which wall a tile touches (for rotation), or -1.
      if (t.z === iz0) return 2;
      if (t.x === ix0) return 1;
      if (t.x === ix1) return 3;
      if (t.z === iz1) return 0;
      return -1;
    };
    const freeNeighbor = (t) => DIRS4.some(([dx, dz]) => isIn(t.x + dx, t.z + dz) && !occ.has(key(t.x + dx, t.z + dz)));
    // pref: 'north' | 'wall' | 'center' | 'any' | 'corner'
    const tryPlace = (id, pref, opts = {}) => {
      let list = interior.filter((t) => !occ.has(key(t.x, t.z)) && !reserved.has(key(t.x, t.z)));
      if (pref === 'north') list = list.filter((t) => t.z === iz0);
      else if (pref === 'wall') list = list.filter((t) => wallSide(t) >= 0 && t.z !== iz1);
      else if (pref === 'corner') list = list.filter((t) => (t.x === ix0 || t.x === ix1) && (t.z === iz0 || t.z === iz1));
      else if (pref === 'center') list = list.filter((t) => wallSide(t) < 0);
      else if (pref === 'back') list = list.filter((t) => t.z !== iz1);
      if (opts.near) list.sort((a, c) => Math.abs(a.x - opts.near.x) + Math.abs(a.z - opts.near.z) - (Math.abs(c.x - opts.near.x) + Math.abs(c.z - opts.near.z)));
      else rng.shuffle(list);
      for (const t of list) {
        if (opts.adjTo && Math.abs(t.x - opts.adjTo.x) + Math.abs(t.z - opts.adjTo.z) !== 1) continue;
        const solid = opts.solid !== false;
        if (solid) {
          occ.add(key(t.x, t.z));
          if (!connected() || (opts.access && !freeNeighbor(t))) {
            occ.delete(key(t.x, t.z));
            continue;
          }
        } else occ.add(key(t.x, t.z));
        // Keep one neighbour free forever so the item stays reachable.
        if (opts.access) {
          for (const [dx, dz] of DIRS4) {
            const nx = t.x + dx;
            const nz = t.z + dz;
            if (isIn(nx, nz) && !occ.has(key(nx, nz))) {
              reserved.add(key(nx, nz));
              t.access = { x: nx, z: nz };
              break;
            }
          }
        }
        let rot = opts.rot ?? 0;
        if (opts.rot === 'wall') {
          const w = wallSide(t);
          rot = w < 0 ? 0 : (w + 2) % 4;
        }
        this.put(t.x, Y0, t.z, id, (rot & 3) | (opts.lit && !ruined ? META_STATE : 0));
        return t;
      }
      return null;
    };
    const accessOf = (t) => {
      for (const [dx, dz] of rng.shuffle([...DIRS4])) {
        const nx = t.x + dx;
        const nz = t.z + dz;
        if (isIn(nx, nz) && !occ.has(key(nx, nz))) return { x: nx, z: nz, face: faceToward(nx, nz, t.x, t.z) };
      }
      return null;
    };
    // Work spots are reserved so later furniture never blocks them.
    const addWork = (x, z, face, tags = ['work'], extra = {}) => {
      reserved.add(key(x, z));
      b.work.push(this.addSpot(x, z, face, tags, { building: b.id, ...extra }));
    };
    const workAt = (t, tags = ['work']) => {
      if (!t) return;
      const a = t.access ? { ...t.access, face: faceToward(t.access.x, t.access.z, t.x, t.z) } : accessOf(t);
      if (a) addWork(a.x, a.z, a.face, tags, { target: t });
    };
    const seat = (tag, near) => {
      const t = tryPlace(B.chair, 'any', { solid: false, near, rot: 'wall' });
      if (t) b.seats.push(this.addSpot(t.x, t.z, near ? faceToward(t.x, t.z, near.x, near.z) : 0, tag, { building: b.id, seat: true }));
      return t;
    };
    const lamp = () => {
      const t = tryPlace(B.torch, 'corner', { solid: false, lit: true }) || tryPlace(B.torch, 'wall', { solid: false, lit: true });
      return t;
    };
    const hearth = () => {
      const t = tryPlace(B.furnace, 'north', { access: true, rot: 0 }) || tryPlace(B.furnace, 'wall', { access: true, rot: 'wall' });
      if (t && !b.mats.flat) this.chimney(b, t);
      return t;
    };
    const rugId = s.civ ? B[s.civ.color.rug] : B.rug_red;
    const t = b.type;

    if (b.residential) {
      const nBeds = t === 'house_s' ? 2 : t === 'house_m' ? 3 : t === 'manor' ? 5 : 6;
      hearth();
      for (let i = 0; i < nBeds; i++) {
        const bed = tryPlace(B.bed, 'wall', { access: true, rot: 'wall' }) || tryPlace(B.bed, 'any', { access: true });
        if (bed) b.beds.push({ x: bed.x, z: bed.z, access: bed.access });
      }
      const table = tryPlace(B.table, 'center', { access: true }) || tryPlace(B.table, 'any', { access: true });
      if (table) {
        seat(['eat', 'home'], table);
        seat(['eat', 'home'], table);
        if (rng.chance(0.5)) this.put(table.x, Y0 + 1, table.z, B.lantern, lit);
      }
      tryPlace(B.chest, 'wall', { access: true, rot: 'wall' });
      if (rng.chance(0.5)) tryPlace(B.barrel, 'wall');
      if (t === 'manor' || rng.chance(0.3)) tryPlace(B.bookshelf, 'north', { rot: 0 });
      if (t === 'manor') {
        tryPlace(B.bookshelf, 'north', { rot: 0 });
        tryPlace(B.chest, 'wall', { access: true, rot: 'wall' });
      }
      if (rng.chance(0.55) || t === 'manor') tryPlace(rugId, 'center', { solid: false });
      lamp();
    } else if (t === 'tavern') {
      hearth();
      // Bar counter row along the back wall with the barkeep behind it.
      const bar = [];
      for (let x = ix0 + 1; x <= Math.min(ix1 - 1, ix0 + 4); x++) {
        const tl = tryPlace(B.counter, 'any', { near: { x, z: iz0 + 1 }, adjTo: bar.length ? bar[bar.length - 1] : null });
        if (tl) bar.push(tl);
      }
      for (const c of bar) {
        const behind = { x: c.x, z: c.z - 1 };
        if (isIn(behind.x, behind.z) && !occ.has(key(behind.x, behind.z))) addWork(behind.x, behind.z, 0);
        const front = { x: c.x, z: c.z + 1 };
        if (isIn(front.x, front.z) && !occ.has(key(front.x, front.z))) {
          reserved.add(key(front.x, front.z));
          b.seats.push(this.addSpot(front.x, front.z, 2, ['drink', 'social', 'eat', 'gossip'], { building: b.id }));
        }
      }
      tryPlace(B.barrel, 'corner');
      tryPlace(B.barrel, 'corner');
      for (let i = 0; i < 3; i++) {
        const table = tryPlace(B.table, 'center', { access: true });
        if (!table) break;
        this.put(table.x, Y0 + 1, table.z, B.lantern, lit);
        seat(['drink', 'social', 'eat', 'dice', 'gossip', 'music'], table);
        seat(['drink', 'social', 'eat', 'dice', 'gossip'], table);
      }
      tryPlace(rugId, 'center', { solid: false });
      lamp();
    } else if (t === 'shop' || t === 'warehouse' || t === 'tailor' || t === 'workshop' || t === 'herbalist' || t === 'bakery' || t === 'smithy') {
      if (t === 'smithy') {
        const forge = tryPlace(B.furnace, 'north', { access: true, rot: 0 });
        if (forge) this.chimney(b, forge);
        workAt(tryPlace(B.anvil, 'any', { access: true, near: forge || undefined }), ['work', 'smith']);
        tryPlace(B.barrel, 'wall');
        tryPlace(B.chest, 'wall', { access: true, rot: 'wall' });
      } else if (t === 'bakery') {
        const oven = tryPlace(B.furnace, 'north', { access: true, rot: 0 });
        if (oven) this.chimney(b, oven);
        workAt(oven);
        workAt(tryPlace(B.table, 'any', { access: true }));
        tryPlace(B.barrel, 'wall');
        tryPlace(B.barrel, 'wall');
      } else if (t === 'shop') {
        const c1 = tryPlace(B.counter, 'center', { access: true });
        workAt(c1);
        if (c1) tryPlace(B.counter, 'any', { adjTo: c1 });
        tryPlace(B.chest, 'wall', { access: true, rot: 'wall' });
        tryPlace(B.chest, 'wall', { access: true, rot: 'wall' });
        tryPlace(B.barrel, 'wall');
        tryPlace(B.crate, 'wall');
      } else if (t === 'warehouse') {
        for (let i = 0; i < 8; i++) tryPlace(rng.chance(0.5) ? B.crate : B.barrel, 'wall');
        tryPlace(B.chest, 'wall', { access: true });
        for (const f of interior.filter((q) => !occ.has(key(q.x, q.z)) && !reserved.has(key(q.x, q.z))).slice(0, 3)) addWork(f.x, f.z, 0);
      } else if (t === 'tailor') {
        workAt(tryPlace(B.workbench, 'north', { access: true }));
        workAt(tryPlace(B.table, 'any', { access: true }));
        tryPlace(B.chest, 'wall', { access: true, rot: 'wall' });
        tryPlace(rugId, 'center', { solid: false });
      } else if (t === 'workshop') {
        workAt(tryPlace(B.workbench, 'north', { access: true }));
        workAt(tryPlace(B.workbench, 'wall', { access: true }));
        tryPlace(B.crate, 'wall');
        tryPlace(B.chest, 'wall', { access: true });
      } else {
        workAt(tryPlace(B.workbench, 'north', { access: true }));
        workAt(tryPlace(B.table, 'any', { access: true }));
        tryPlace(B.barrel, 'wall');
        tryPlace(B.chest, 'wall', { access: true });
      }
      lamp();
    } else if (t === 'temple') {
      const mid = Math.round((ix0 + ix1) / 2);
      const altar = tryPlace(B.altar, 'north', { near: { x: mid, z: iz0 }, access: true });
      if (altar) {
        const a = altar.access || { x: altar.x, z: altar.z + 1 };
        addWork(a.x, a.z, 2);
        this.put(altar.x - 1, Y0, altar.z, B.lantern, lit);
        occ.add(key(altar.x - 1, altar.z));
      }
      for (let z = iz0 + 2; z <= iz1 - 1; z += 2) {
        for (let x = ix0; x <= ix1; x++) {
          if (x === mid || Math.abs(x - b.inside.x) === 0) continue;
          if (occ.has(key(x, z)) || reserved.has(key(x, z))) continue;
          this.put(x, Y0, z, B.bench, 2);
          occ.add(key(x, z));
          b.seats.push(this.addSpot(x, z, 2, ['pray'], { building: b.id, seat: true }));
        }
      }
      for (let z = iz0 + 1; z <= iz1; z++) if (!occ.has(key(mid, z))) this.put(mid, Y0, z, rugId);
      tryPlace(B.torch, 'corner', { solid: false, lit: true });
      tryPlace(B.torch, 'corner', { solid: false, lit: true });
    } else if (t === 'library') {
      for (let i = 0; i < 7; i++) tryPlace(B.bookshelf, i < 4 ? 'north' : 'wall', { rot: 'wall' });
      for (let i = 0; i < 2; i++) {
        const table = tryPlace(B.table, 'center', { access: true }) || tryPlace(B.table, 'any', { access: true });
        if (!table) break;
        this.put(table.x, Y0 + 1, table.z, B.lantern, lit);
        seat(['read', 'study', 'work'], table);
        seat(['read', 'study'], table);
      }
      b.work.push(...b.seats.filter((q) => q.tags.includes('work')));
      lamp();
    } else if (t === 'townhall') {
      const table = tryPlace(B.table, 'center', { access: true });
      if (table) {
        this.put(table.x, Y0 + 1, table.z, B.lantern, lit);
        const t2 = tryPlace(B.table, 'center', { adjTo: table });
        for (let i = 0; i < 3; i++) seat(['work', 'social'], table);
        if (t2) seat(['work'], t2);
      }
      b.work.push(...b.seats);
      tryPlace(B.bookshelf, 'north', { rot: 0 });
      tryPlace(B.bookshelf, 'north', { rot: 0 });
      tryPlace(B.chest, 'wall', { access: true });
      tryPlace(rugId, 'center', { solid: false });
      lamp();
      lamp();
    } else if (t === 'guardhouse') {
      const table = tryPlace(B.table, 'center', { access: true });
      if (table) {
        seat(['work', 'rest'], table);
        seat(['work', 'rest'], table);
      }
      tryPlace(B.chest, 'wall', { access: true, rot: 'wall' });
      tryPlace(B.barrel, 'wall');
      tryPlace(B.bed, 'wall', { access: true, rot: 'wall' });
      lamp();
      b.work.push(...b.seats);
    } else if (t === 'barn') {
      for (let i = 0; i < 6; i++) tryPlace(B.hay_bale, 'wall');
      tryPlace(B.barrel, 'wall');
      tryPlace(B.chest, 'wall', { access: true });
      tryPlace(B.workbench, 'wall', { access: true });
      lamp();
      for (const f of interior.filter((q) => !occ.has(key(q.x, q.z)) && !reserved.has(key(q.x, q.z))).slice(0, 2)) addWork(f.x, f.z, 0);
    }
    if (ruined) {
      for (const f of interior) {
        if (occ.has(key(f.x, f.z))) continue;
        if (rng.chance(0.18)) this.put(f.x, Y0 + 1, f.z, B.cobweb);
        else if (rng.chance(0.12)) this.put(f.x, Y0, f.z, rng.pick([B.tall_grass, B.fern, B.mushroom_brown]));
      }
    }
    b.free = interior.filter((q) => !occ.has(key(q.x, q.z)) || this.at(q.x, Y0, q.z) === B.chair || this.at(q.x, Y0, q.z) === B.torch || (this.at(q.x, Y0, q.z) || 0) >= B.rug_red && this.at(q.x, Y0, q.z) <= B.rug_green);
    b.homeSpots = b.free.map((q) => ({ x: q.x, y: Y0, z: q.z }));
  }

  chimney(b, t) {
    // Chimney column rising through the roof above a hearth.
    const top = b.roofTop(t.z) + 1;
    for (let y = b.roofBase; y <= top; y++) this.put(t.x, y, t.z, B.bricks);
    if (this.settlement.condition !== 'abandoned') this.chimneys.push({ x: t.x, y: top + 1, z: t.z });
  }

  exterior(b, rng) {
    const s = this.settlement;
    const cond = s.condition;
    const o = b.outside;
    // Lantern beside the door in nice places.
    const side = [];
    const DX = [0, -1, 0, 1];
    const DZ = [1, 0, -1, 0];
    const rot = b.door.rot;
    const px = DZ[rot] !== 0 ? 1 : 0;
    const pz = DX[rot] !== 0 ? 1 : 0;
    for (const sgn of [1, -1]) side.push({ x: o.x + px * sgn, z: o.z + pz * sgn });
    if ((cond === 'prosperous' || (cond === 'normal' && rng.chance(0.35))) && s.condition !== 'abandoned') {
      const sd = side.find((p) => this.maskAt(p.x, p.z) === M.YARD);
      if (sd) {
        this.put(sd.x, Y0, sd.z, B.lantern, META_STATE);
        this.setMask(sd.x, sd.z, M.DECOR);
      }
    }
    if (['shop', 'tavern', 'bakery', 'warehouse'].includes(b.type)) {
      const sd = side.find((p) => this.maskAt(p.x, p.z) === M.YARD);
      if (sd) {
        this.put(sd.x, Y0, sd.z, rng.chance(0.5) ? B.barrel : B.crate);
        this.setMask(sd.x, sd.z, M.DECOR);
      }
    }
    // Flower beds along the front wall for prosperous places.
    if (cond === 'prosperous' && b.residential) {
      const flowers = [B.flower_red, B.flower_yellow, B.flower_blue, B.flower_white, B.flower_purple];
      const f = rng.pick(flowers);
      for (let i = -3; i <= 3; i++) {
        const x = o.x + px * i;
        const z = o.z + pz * i;
        if (this.maskAt(x, z) === M.YARD && rng.chance(0.6) && i !== 0) {
          this.put(x, Y0, z, f);
          this.setMask(x, z, M.DECOR);
        }
      }
    }
    // Herb garden for herbalists; smithy gets a training dummy for martial civs.
    if (b.type === 'herbalist') this.garden(b, [B.herb, B.herb, B.flower_purple], ['garden', 'work'], rng);
    if (b.type === 'guardhouse') {
      for (let i = 0; i < 2; i++) {
        const spot = this.findFreeNear(b.outside.x, b.outside.z, 6, rng);
        if (!spot) break;
        this.put(spot.x, Y0, spot.z, B.training_dummy);
        this.setMask(spot.x, spot.z, M.DECOR);
        const a = this.freeAdj(spot.x, spot.z);
        if (a) this.addSpot(a.x, a.z, faceToward(a.x, a.z, spot.x, spot.z), ['train']);
      }
    }
    if (b.type === 'temple' && s.condition !== 'abandoned') this.graveyard(b, rng);
    if (b.residential && s.type === 'village' && rng.chance(0.35)) {
      this.garden(b, [B.cabbage_crop, B.carrot_crop, B.flower_yellow], ['garden'], rng);
    }
  }

  garden(b, plants, tags, rng) {
    // Find a 3x2 free patch next to the building.
    for (let tries = 0; tries < 30; tries++) {
      const x = rng.int(b.x0 - 4, b.x1 + 1);
      const z = rng.int(b.z0 - 3, b.z1 + 1);
      let ok = true;
      for (let dz = 0; dz < 2 && ok; dz++) for (let dx = 0; dx < 3 && ok; dx++) {
        const m = this.maskAt(x + dx, z + dz);
        if ((m !== M.FREE && m !== M.YARD) || !this.inside(x + dx, z + dz, 2)) ok = false;
      }
      if (!ok) continue;
      for (let dz = 0; dz < 2; dz++) {
        for (let dx = 0; dx < 3; dx++) {
          this.put(x + dx, SURFACE, z + dz, B.farmland);
          this.put(x + dx, Y0, z + dz, rng.pick(plants));
          this.setMask(x + dx, z + dz, M.FIELD);
        }
      }
      const a = this.freeAdj(x + 1, z + 1) || this.freeAdj(x, z);
      if (a) this.addSpot(a.x, a.z, faceToward(a.x, a.z, x + 1, z), tags, { building: b.id });
      this.addSpot(x + 1, z, 0, tags, { building: b.id });
      return true;
    }
    return false;
  }

  graveyard(b, rng) {
    for (let tries = 0; tries < 40; tries++) {
      const w = 5;
      const d = 4;
      const x = rng.int(b.x0 - w - 1, b.x1 + 2);
      const z = rng.int(b.z0 - d - 1, b.z1 + 2);
      let ok = true;
      for (let dz = -1; dz <= d && ok; dz++) for (let dx = -1; dx <= w && ok; dx++) {
        const m = this.maskAt(x + dx, z + dz);
        if (!this.inside(x + dx, z + dz, 2)) ok = false;
        else if (dz >= 0 && dz < d && dx >= 0 && dx < w && m !== M.FREE) ok = false;
        else if (m === M.BUILD || m === M.WALL) ok = false;
      }
      if (!ok) continue;
      for (let dz = 0; dz < d; dz++) {
        for (let dx = 0; dx < w; dx++) {
          this.setMask(x + dx, z + dz, M.DECOR);
          const edge = dz === 0 || dz === d - 1 || dx === 0 || dx === w - 1;
          if (edge && !(dz === d - 1 && dx === 2)) this.put(x + dx, Y0, z + dz, B.fence);
          else if (!edge && dx % 2 === 1) this.put(x + dx, Y0, z + dz, B.gravestone);
          else if (!edge) this.put(x + dx, Y0, z + dz, rng.chance(0.4) ? B.flower_white : B.air);
        }
      }
      this.addSpot(x + 2, z + d - 2, 2, ['pray', 'stroll']);
      return;
    }
  }

  findFreeNear(x, z, r, rng) {
    const opts = [];
    for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
      const m = this.maskAt(x + dx, z + dz);
      if ((m === M.FREE || m === M.YARD) && this.inside(x + dx, z + dz, 2) && this.freeAdj(x + dx, z + dz)) opts.push({ x: x + dx, z: z + dz });
    }
    return opts.length ? rng.pick(opts) : null;
  }

  freeAdj(x, z) {
    for (const [dx, dz] of DIRS4) {
      const m = this.maskAt(x + dx, z + dz);
      if ((m === M.FREE || m === M.YARD || m === M.ROAD || m === M.PLAZA) && this.inside(x + dx, z + dz, 1)) return { x: x + dx, z: z + dz };
    }
    return null;
  }

  // ------------------------------------------------------------ farms
  farms() {
    const s = this.settlement;
    const rng = this.rng.fork('farms');
    if (!this.plan.jobs.includes('farmer')) return;
    const want = s.type === 'village' ? rng.int(2, 3) : s.type === 'town' ? rng.int(2, 3) : rng.int(2, 4);
    const b = this.bounds;
    const crops = [B.wheat_crop, B.wheat_crop, B.carrot_crop, B.cabbage_crop, B.pumpkin];
    let placed = 0;
    const p = this.plaza;
    for (let tries = 0; tries < 600 && placed < want; tries++) {
      const w = rng.int(6, 10);
      const d = rng.int(4, 6);
      const x = rng.int(b.x0 + 2, b.x1 - w - 2);
      const z = rng.int(b.z0 + 2, b.z1 - d - 2);
      // Keep fields away from the centre (early tries insist on the outskirts).
      const far = Math.max(Math.abs(x + w / 2 - p.cx) / this.W, Math.abs(z + d / 2 - p.cz) / this.D);
      if (tries < 400 && far < 0.3) continue;
      let ok = true;
      for (let dz = -1; dz <= d && ok; dz++) {
        for (let dx = -1; dx <= w && ok; dx++) {
          const m = this.maskAt(x + dx, z + dz);
          const ring = dz < 0 || dz === d || dx < 0 || dx === w;
          if (ring ? m === M.BUILD || m === M.FIELD || m === M.WALL || m === M.WATER : m !== M.FREE) ok = false;
        }
      }
      if (!ok) continue;
      const crop = rng.pick(crops);
      const field = { x0: x, z0: z, x1: x + w - 1, z1: z + d - 1, spots: [] };
      for (let dz = 0; dz < d; dz++) {
        for (let dx = 0; dx < w; dx++) {
          const fx = x + dx;
          const fz = z + dz;
          this.setMask(fx, fz, M.FIELD);
          const edge = dz === 0 || dz === d - 1 || dx === 0 || dx === w - 1;
          const gate = dz === d - 1 && dx === Math.floor(w / 2);
          if (edge && !gate) {
            if (s.condition !== 'poor' || rng.chance(0.7)) this.put(fx, Y0, fz, B.fence);
            continue;
          }
          if (gate) continue;
          const furrow = dx % 3 === 0;
          this.put(fx, SURFACE, fz, furrow ? B.path : B.farmland);
          if (!furrow) this.put(fx, Y0, fz, crop === B.pumpkin && rng.chance(0.6) ? B.carrot_crop : crop);
          else field.spots.push(this.addSpot(fx, fz, 2, ['farm']));
        }
      }
      if (rng.chance(0.7)) {
        const sx = x + 1 + rng.int(0, w - 3);
        const sz = z + 1;
        if (sx % 3 !== x % 3) this.put(sx, Y0, sz, B.scarecrow);
      }
      this.fields.push(field);
      placed++;
    }
  }

  // ------------------------------------------------------------ water
  docks() {
    const b = this.bounds;
    const rng = this.rng.fork('docks');
    const shore = [];
    for (let z = b.z0 + 1; z < b.z1; z++) {
      for (let x = b.x0 + 1; x < b.x1; x++) {
        const m = this.maskAt(x, z);
        if (m !== M.FREE && m !== M.YARD && m !== M.ROAD) continue;
        for (const [dx, dz] of DIRS4) if (this.maskAt(x + dx, z + dz) === M.WATER) shore.push({ x, z, dx, dz });
      }
    }
    rng.shuffle(shore);
    let piers = 0;
    for (const s of shore) {
      if (piers >= (this.settlement.type === 'village' ? 1 : 2)) break;
      let len = 0;
      while (len < 5 && this.maskAt(s.x + s.dx * (len + 1), s.z + s.dz * (len + 1)) === M.WATER) len++;
      if (len < 2) continue;
      for (let i = 1; i <= len; i++) {
        const x = s.x + s.dx * i;
        const z = s.z + s.dz * i;
        this.setMask(x, z, M.BRIDGE);
        this.put(x, SURFACE, z, B.planks);
      }
      const ex = s.x + s.dx * len;
      const ez = s.z + s.dz * len;
      this.addSpot(ex, ez, dirOf(s.dx, s.dz), ['fish', 'dock', 'stroll']);
      piers++;
    }
    // Plain shore fishing spots (plus a scan outside the bounds for rivers nearby).
    let n = 0;
    for (const s of shore) {
      if (n >= 8) break;
      if (this.maskAt(s.x, s.z) !== M.FREE && this.maskAt(s.x, s.z) !== M.YARD) continue;
      if (this.spots.some((sp) => Math.abs(sp.x - s.x) + Math.abs(sp.z - s.z) < 3)) continue;
      this.addSpot(s.x, s.z, dirOf(s.dx, s.dz), ['fish', 'stroll', 'sketch']);
      n++;
    }
    if (this.spotsByTag('fish').length === 0) this.outsideWaterSpots(rng);
  }

  outsideWaterSpots(rng) {
    const b = this.bounds;
    const t = this.world.terrain;
    const found = [];
    for (let z = b.z0 - 14; z <= b.z1 + 14; z += 2) {
      for (let x = b.x0 - 16; x <= b.x1 + 16; x += 2) {
        if (this.inside(x, z)) continue;
        const c = t.column(x, z, this.ctx, {});
        if (c.water >= 0 || c.h !== SURFACE) continue;
        for (const [dx, dz] of DIRS4) {
          const n = t.column(x + dx, z + dz, this.ctx, {});
          if (n.water >= 0) {
            found.push({ x, z, face: dirOf(dx, dz) });
            break;
          }
        }
      }
    }
    for (const f of rng.shuffle(found).slice(0, 5)) this.addSpot(f.x, f.z, f.face, ['fish', 'stroll']);
  }

  // Work spots outside the settlement for lumberjacks, miners and hunters.
  wilds() {
    const b = this.bounds;
    const t = this.world.terrain;
    const rng = this.rng.fork('wild');
    const chop = [];
    const mine = [];
    const hunt = [];
    for (let z = b.z0 - 18; z <= b.z1 + 18; z += 3) {
      for (let x = b.x0 - 22; x <= b.x1 + 22; x += 3) {
        if (x > b.x0 - 8 && x < b.x1 + 8 && z > b.z0 - 8 && z < b.z1 + 8) continue;
        const c = t.column(x, z, this.ctx, {});
        if (c.water >= 0 || c.h > SURFACE + 1) continue;
        if (['forest', 'taiga', 'jungle'].includes(c.biome)) chop.push({ x, z });
        hunt.push({ x, z });
        const n = t.column(x + 3, z, this.ctx, {});
        if (c.h === SURFACE && (n.h >= SURFACE + 2 || c.biome === 'mountain')) mine.push({ x, z });
      }
    }
    for (const p of rng.shuffle(chop).slice(0, 6)) this.addSpot(p.x, p.z, 0, ['chop'], { wild: true });
    for (const p of rng.shuffle(mine).slice(0, 4)) this.addSpot(p.x, p.z, 3, ['mine'], { wild: true });
    for (const p of rng.shuffle(hunt).slice(0, 6)) this.addSpot(p.x, p.z, 0, ['hunt', 'stroll'], { wild: true });
  }

  // ------------------------------------------------------------ decoration
  decorate() {
    const s = this.settlement;
    const rng = this.rng.fork('decor');
    const p = this.plaza;
    const cond = s.condition;
    const ruined = cond === 'abandoned';
    // Plaza centerpiece.
    const center = s.type === 'village' || rng.chance(0.4) ? B.well : B.statue;
    this.put(p.cx, Y0, p.cz, center);
    this.setMask(p.cx, p.cz, M.DECOR);
    for (const [dx, dz] of DIRS4) this.addSpot(p.cx + dx * 2, p.cz + dz * 2, dirOf(-dx, -dz), ['gossip', 'social', 'play', 'stroll', 'drink', 'music', 'sketch']);
    if (s.type === 'city') {
      for (const [dx, dz] of [[-5, -3], [5, -3], [-5, 3], [5, 3]]) {
        const x = p.cx + dx;
        const z = p.cz + dz;
        if (this.maskAt(x, z) !== M.PLAZA) continue;
        this.put(x, Y0, z, rng.chance(0.5) ? B.well : B.statue);
        this.setMask(x, z, M.DECOR);
      }
    }
    // Benches facing the centre.
    const benchPos = [[0, -3], [0, 3], [-4, 0], [4, 0]];
    for (const [dx, dz] of benchPos) {
      const x = p.cx + dx;
      const z = p.cz + dz;
      if (this.maskAt(x, z) !== M.PLAZA) continue;
      const rot = dirOf(-Math.sign(dx), -Math.sign(dz));
      this.put(x, Y0, z, B.bench, rot);
      this.setMask(x, z, M.DECOR);
      this.addSpot(x, z, rot, ['rest', 'read', 'smoke', 'social', 'sketch', 'music', 'stargaze'], { seat: true });
    }
    // Market stalls around the plaza edges (towns & cities).
    if (s.type !== 'village' && !ruined) {
      const awning = s.civ ? B[s.civ.color.awning] : B.awning_red;
      const spots = [];
      for (let x = p.x0 + 1; x < p.x1; x += 3) spots.push({ x, z: p.z0, face: 0 });
      for (let x = p.x0 + 1; x < p.x1; x += 3) spots.push({ x, z: p.z1, face: 2 });
      let n = 0;
      for (const st of rng.shuffle(spots)) {
        if (n >= (s.type === 'city' ? 4 : 2)) break;
        if (this.maskAt(st.x, st.z) !== M.PLAZA) continue;
        const inner = { x: st.x, z: st.z + (st.face === 0 ? 1 : -1) };
        const back = { x: st.x, z: st.z - (st.face === 0 ? 1 : -1) };
        if (this.maskAt(back.x, back.z) === M.BUILD || this.maskAt(back.x, back.z) === M.WALL) continue;
        this.put(st.x, Y0, st.z, B.counter);
        this.put(st.x, Y0 + 2, st.z, awning);
        this.put(back.x, Y0 + 2, back.z, awning);
        this.put(back.x, Y0, back.z, B.air);
        this.setMask(st.x, st.z, M.DECOR);
        const behind = this.maskAt(back.x, back.z) === M.WATER ? null : back;
        if (behind) this.addSpot(behind.x, behind.z, st.face, ['market', 'work'], { stall: true });
        this.addSpot(inner.x, inner.z, st.face === 0 ? 2 : 0, ['shop', 'social', 'stroll']);
        n++;
      }
    }
    // Notice board.
    const nb = { x: p.x0, z: p.z0 };
    if (this.maskAt(nb.x, nb.z) === M.PLAZA) {
      this.put(nb.x, Y0, nb.z, B.notice_board);
      this.setMask(nb.x, nb.z, M.DECOR);
      this.signs.push({ x: nb.x, y: Y0, z: nb.z, kind: 'board' });
    }
    // Lamp posts along roads.
    if (!ruined && cond !== 'poor') {
      const every = s.type === 'city' ? 7 : cond === 'prosperous' ? 8 : 11;
      const b = this.bounds;
      for (let z = b.z0 + 1; z < b.z1; z++) {
        for (let x = b.x0 + 1; x < b.x1; x++) {
          const m = this.maskAt(x, z);
          if (m !== M.YARD && m !== M.FREE) continue;
          let adjRoad = false;
          for (const [dx, dz] of DIRS4) if (this.maskAt(x + dx, z + dz) === M.ROAD) adjRoad = true;
          if (!adjRoad) continue;
          if ((hash4(x, z, s.seed) % every) !== 0) continue;
          if (this.lamps.some((l) => Math.abs(l.x - x) + Math.abs(l.z - z) < every - 2)) continue;
          this.put(x, Y0, z, B.fence);
          this.put(x, Y0 + 1, z, B.lantern, META_STATE);
          this.setMask(x, z, M.DECOR);
          this.lamps.push({ x, z });
        }
      }
    }
    // A few trees and a park in bigger places.
    const b = this.bounds;
    const treeType = { taiga: 'pine', tundra: 'snowpine', desert: 'palm', savanna: 'acacia', jungle: 'jungle', swamp: 'willow' }[s.biome] || 'oak';
    let trees = 0;
    for (let tries = 0; tries < 200 && trees < (s.type === 'village' ? 4 : 8); tries++) {
      const x = rng.int(b.x0 + 3, b.x1 - 3);
      const z = rng.int(b.z0 + 3, b.z1 - 3);
      let ok = true;
      for (let dz = -2; dz <= 2 && ok; dz++) for (let dx = -2; dx <= 2 && ok; dx++) if (this.maskAt(x + dx, z + dz) !== M.FREE) ok = false;
      if (!ok) continue;
      this.tree(x, z, treeType, rng);
      trees++;
      this.addSpot(x, z + 2, 2, ['stroll', 'sketch', 'stargaze', 'music', 'rest']);
    }
    // Signs at the settlement's road entrances.
    for (const pt of this.entrances) {
      const a = this.freeAdj(pt.x, pt.z);
      if (!a || this.maskAt(a.x, a.z) === M.ROAD) continue;
      this.put(a.x, Y0, a.z, B.sign, 0);
      this.setMask(a.x, a.z, M.DECOR);
      this.signs.push({ x: a.x, y: Y0, z: a.z, kind: 'entrance' });
    }
    if (s.type === 'city') this.finishCityWalls();
  }

  tree(x, z, type, rng) {
    const r = () => rng.next();
    const cells = TREE_BUILDERS[type](r);
    for (const [dx, dy, dz, id] of cells) this.put(x + dx, Y0 + dy, z + dz, id);
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) if (this.maskAt(x + dx, z + dz) === M.FREE) this.setMask(x + dx, z + dz, M.DECOR);
  }

  paintGround() {
    const b = this.bounds;
    const mats = this.mats;
    for (let z = b.z0; z <= b.z1; z++) {
      for (let x = b.x0; x <= b.x1; x++) {
        const m = this.maskAt(x, z);
        if (m === M.ROAD) this.put(x, SURFACE, z, this.col(x, z).water >= 0 ? B.planks : mats.road);
        else if (m === M.PLAZA) this.put(x, SURFACE, z, mats.plaza);
        else if (m === M.BRIDGE && !this.at(x, SURFACE, z)) {
          this.put(x, SURFACE, z, B.planks);
        }
      }
    }
  }

  // ------------------------------------------------------------ jobs
  hasWorkplaceFor(job) {
    const J = JOBS[job];
    if (!J) return false;
    if (job === 'child' || job === 'retired') return true;
    switch (J.place) {
      case 'farm':
        return this.fields.length > 0 || this.buildings.some((b) => b.type === 'barn');
      case 'dock':
        return this.spotsByTag('fish').length > 0;
      case 'plaza':
        return !!this.plaza;
      case 'wild':
        return this.spotsByTag(job === 'lumberjack' ? 'chop' : job === 'miner' ? 'mine' : 'hunt').length > 0;
      case 'guardhouse':
        return true; // guards patrol even without a guardhouse
      case 'shop':
        return this.buildings.some((b) => b.type === 'shop') || this.spotsByTag('market').length > 0;
      default:
        return this.buildings.some((b) => b.type === J.place && b.work.length + b.seats.length > 0);
    }
  }

  assignWork(npc, rng) {
    const job = npc.job;
    const J = JOBS[job];
    if (!J || job === 'child' || job === 'retired') return { kind: 'none' };
    this.workLoad = this.workLoad || new Map();
    const load = (k) => this.workLoad.get(k) || 0;
    const bump = (k) => this.workLoad.set(k, load(k) + 1);
    if (job === 'guard') {
      const gh = this.buildings.filter((b) => b.type === 'guardhouse');
      const post = rng.chance(0.4) && this.gates.length ? rng.pick(this.gates) : null;
      return { kind: 'patrol', building: gh.length ? rng.pick(gh).id : null, post };
    }
    if (J.place === 'farm') return { kind: 'tag', tag: 'farm', building: this.buildings.find((b) => b.type === 'barn')?.id ?? null };
    if (J.place === 'dock') return { kind: 'tag', tag: 'fish' };
    if (J.place === 'plaza') return { kind: 'plaza' };
    if (J.place === 'wild') return { kind: 'tag', tag: job === 'lumberjack' ? 'chop' : job === 'miner' ? 'mine' : 'hunt' };
    if (job === 'merchant') {
      const stalls = this.spotsByTag('market');
      const shops = this.buildings.filter((b) => b.type === 'shop');
      const stallLoad = load('stall');
      if (stalls.length > stallLoad && (!shops.length || rng.chance(0.5))) {
        bump('stall');
        return { kind: 'spot', spot: this.spots.indexOf(stalls[stallLoad]) };
      }
    }
    const opts = this.buildings.filter((b) => b.type === J.place);
    if (!opts.length) return { kind: 'plaza' };
    opts.sort((a, b) => load(a.id) - load(b.id));
    bump(opts[0].id);
    return { kind: 'building', building: opts[0].id };
  }
}

function dirOf(dx, dz) {
  if (dz > 0) return 0;
  if (dx < 0) return 1;
  if (dz < 0) return 2;
  return 3;
}

export function faceToward(x, z, tx, tz) {
  const dx = tx - x;
  const dz = tz - z;
  if (Math.abs(dx) > Math.abs(dz)) return dx < 0 ? 1 : 3;
  return dz < 0 ? 2 : 0;
}
