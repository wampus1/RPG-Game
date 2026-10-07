// Settlement layout generation: roads, plazas, buildings (with interiors),
// farms, docks, walls and decoration. Output is a set of block placements
// bucketed per region, plus semantic data (buildings, spots) used by NPCs.
import { SURFACE, GROUND, REGION_W, REGION_D } from '../config.js';
import { RNG, hash4 } from '../util/rng.js';
import { B, BLOCKS, META_STATE, CROPS, cropMeta, CANOPY_SHIFT, planksOf } from './blocks.js';
import { TREE_BUILDERS } from './trees.js';
import { planPopulation, generateNPCs, JOBS } from '../entities/npcgen.js';
import { ISLE_TRADES, TRADE_BUILDINGS } from '../sim/isletrades.js';
import { empireQuarter } from './empire.js';
import { farTable } from './farlands.js';

export const M = { FREE: 0, ROAD: 1, BUILD: 2, WATER: 3, FIELD: 4, PLAZA: 5, YARD: 6, WALL: 7, BRIDGE: 8, DECOR: 9 };
const Y0 = GROUND; // first layer above the floor

const SPECS = {
  house_s: { size: [[5, 5], [6, 5]], beds: 2, residential: true },
  house_m: { size: [[7, 5], [7, 6]], beds: 3, residential: true },
  house_l: { size: [[9, 6], [9, 7]], beds: 6, residential: true },
  manor: { size: [[11, 8], [12, 8]], beds: 5, residential: true, tall: 3, civic: true },
  // (Round 68) An empire's palace, in its capital (see farlands.EMPIRE):
  // where its ruler and the court live, near the square.
  palace: { size: [[15, 11], [15, 11]], beds: 6, residential: true, tall: 3, civic: true },
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
  // Stalls for the town's horses, hay and a trough (see stables.js).
  stables: { size: [[9, 6], [8, 6]], tall: 3 },
  // Where the realm's researchers study (see tech.js).
  academy: { size: [[9, 6], [8, 6]], tall: 3, civic: true },
  // (Round 54) A great city's Academy: a hall down the middle and four
  // classrooms off it (a kitchen, a practice hall, a lecture room, a gem
  // workshop), where anyone who pays may study for a term. See
  // sim/college.js.
  college: { size: [[13, 13], [13, 13]], tall: 3, civic: true },
  // A village's (or a small town's) place of learning: a room of books
  // and a desk, so even the smallest free town can work out something new.
  study: { size: [[6, 5], [6, 6]] },
  // Cells for prisoners of war: a stockade (a few) and, once the realm has
  // learned to build them, a great prison (many). See war.js.
  stockade: { size: [[9, 6], [9, 6]], civic: true },
  prison: { size: [[13, 8], [12, 8]], tall: 3, civic: true },
  // A licensed trade's own workshop, built for the player (never staffed).
  player_workshop: { size: [[6, 5], [6, 6]] },
  // Each island people's own trade (see isletrades.js): Thessa's windmill
  // (a tall tower, its sails over the street), Kharos's glassworks, the
  // Mirefolk's spore cellar and the Stiltfolk's pearl house.
  windmill: { size: [[6, 6], [6, 6]], tall: 4 },
  glassworks: { size: [[7, 6], [7, 6]] },
  sporehouse: { size: [[7, 5], [6, 6]] },
  pearlhouse: { size: [[6, 5], [6, 6]] },
};

// (Round 68) How each far people builds (see world/farlands.js), as block
// ids: picked from by weight like everyone else's.
const FAR_BUILD = {};
for (const [k, F] of Object.entries(farTable('build'))) {
  const ids = (list) => list.map(([n, w]) => [B[n] ?? B.planks, w]);
  FAR_BUILD[k] = {
    wall: ids(F.wall), corner: B[F.corner], floor: B[F.floor], roof: ids(F.roof), flat: !!F.flat,
    civic: { wall: ids(F.civic.wall), corner: B[F.civic.corner], floor: B[F.civic.floor], roof: ids(F.civic.roof), flat: F.civic.flat ?? !!F.flat },
    road: F.road.map((n) => B[n]), plaza: F.plaza.map((n) => B[n]), cityWall: B[F.cityWall], barn: F.barn.map((n) => B[n]),
  };
}
const FAR_PIECE_BLOCKS = {};
for (const [k, piece] of Object.entries(farTable('piece'))) FAR_PIECE_BLOCKS[k] = B[piece];

export const BUILDING_NAMES = {
  house_s: 'Cottage', house_m: 'House', house_l: 'Family House', manor: 'Manor', palace: 'Palace', tavern: 'Tavern',
  shop: 'General Store', smithy: 'Smithy', temple: 'Temple', bakery: 'Bakery', library: 'Library',
  townhall: 'Town Hall', guardhouse: 'Guardhouse', tailor: 'Tailor', workshop: 'Carpentry',
  herbalist: 'Herbalist', warehouse: 'Warehouse', barn: 'Barn', player_workshop: 'Workshop', stables: 'Stables', academy: 'Research Hall', study: 'Scholar\'s Study', college: 'Academy',
  stockade: 'Stockade', prison: 'Prison',
  windmill: 'Windmill', glassworks: 'Glassworks', sporehouse: 'Spore Cellar', pearlhouse: 'Pearl House',
};

// What a trade works at, in its workshop.
export const TRADE_BENCHES = {
  smith: ['anvil', 'grindstone', 'furnace'], baker: ['oven'], tailor: ['loom'], herbalist: ['alembic'], scribe: ['writing_desk'], jeweller: ['jeweler_bench'],
};

const TAVERN_NAMES = ['Prancing Pony', 'Rusty Tankard', 'Sleeping Dragon', 'Golden Goose', 'Laughing Wolf', 'Salted Eel', 'Crooked Crown', 'Drunken Owl', 'Hearth & Horn', 'Wandering Star',
  'Three Barrels', 'Merry Miller', 'Black Boar', 'Silver Stag', 'Thirsty Crow', 'Fiddler\'s Rest', 'Jolly Tinker', 'Red Lantern', 'Old Oak', 'Wayfarer\'s Welcome', 'Copper Pot', 'Singing Swan', 'Foaming Flagon', 'Bent Horseshoe', 'Sly Fox', 'Weary Traveller'];
// Shops and halls with names of their own (the kind still shows on the board).
const SHOP_NAMES = {
  smithy: ['The Red Anvil', 'Ironside Forge', 'Hammer & Tongs', 'The Emberworks', 'The Bellows', 'Cinder & Iron', 'Stoutsteel Smithy', 'The Glowing Forge'],
  shop: ['The Copper Kettle', 'Odds & Ends', 'Barrel & Basket', 'The Well-Stocked Shelf', 'Sundries & Supplies', 'The Corner Store', 'The Open Door', 'Provisions'],
  bakery: ['The Golden Crust', 'The Warm Loaf', 'Flour & Fire', 'The Honey Bun', 'Rise & Shine Bakery', 'The Crusty Cob'],
  temple: ['Temple of the Dawn', 'Shrine of the Hearth', 'Temple of the Seven Stars', 'Chapel of the Quiet Light', 'Temple of the Harvest', 'Sanctuary of the Well'],
  library: ['Hall of Letters', 'The Inkwell Library', 'House of Scrolls', 'The Lantern Library'],
  guardhouse: ['The Watchhouse', 'The Wardens\' Post', 'The Barracks', 'Guardhouse'],
  tailor: ['Needle & Thread', 'The Silver Spool', 'The Stitchery', 'Fine Cloth & Fancy'],
  workshop: ['The Sawhorse', 'Plane & Chisel', 'The Oak Bench', 'The Joinery'],
  herbalist: ['The Green Remedy', 'Root & Leaf', 'Mortar & Pestle', 'The Healing Herb'],
  townhall: ['Town Hall', 'Council Hall', 'Moot Hall', 'Guildhall'],
  study: ['The Quiet Room', 'House of Questions', 'The Candle & Quill', 'The Little Library'],
  windmill: ['The Old Mill', 'The Four Sails', 'The White Sails', 'Grist & Grain', 'The Windward Mill', 'Millstone House'],
  glassworks: ['The Black Glass', 'The Ember Kiln', 'Cinder & Clear', 'The Blowpipe', 'The Mountain\'s Glass'],
  sporehouse: ['The Damp Cellar', 'The Glowcap Beds', 'Under the Moss', 'The Spore House', 'The Dark Garden'],
  pearlhouse: ['The Oyster Bed', 'Moonpearl House', 'The Deep Shelf', 'Shell & String', 'The Diver\'s Rest'],
};

const DIRS4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
// The narrowest way through a town wall.
const GATE_MIN = 4;

export function buildLayout(world, s) {
  const L = new Layout(world, s);
  L.generate();
  return L;
}

// The same, a piece at a time (see World.layOut): the layout, and the
// steps still to take in laying it out.
export function layoutJob(world, s) {
  const L = new Layout(world, s);
  return { L, steps: L.generateSteps() };
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
    this.plots = [];
    this.wells = []; // where townsfolk draw water
    this.bells = []; // alarm bells the watch rings at night
    this.graveyard = null;
    this.jail = null;
    this.prisonCells = []; // cells for prisoners of war
    this.plaza = null;
    this.npcs = [];
    this.collect = null;
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
    const i = lz * this.W + lx;
    // Things set on the square or a street keep its paving underneath.
    const old = this.mask[i];
    if (v === M.DECOR && (old === M.PLAZA || old === M.ROAD)) {
      if (!this.decorBase) this.decorBase = new Map();
      this.decorBase.set(i, old);
    }
    this.mask[i] = v;
  }
  inside(x, z, inset = 0) {
    const b = this.bounds;
    return x >= b.x0 + inset && x <= b.x1 - inset && z >= b.z0 + inset && z <= b.z1 - inset;
  }
  // Where a road out of town starts: the ends of its main streets (for a
  // city, its gateways), each with the way out of town from there.
  roadEnds() {
    let ents = this.entrances.length ? this.entrances : [{ x: this.plaza.cx, z: this.plaza.cz }];
    if (this.gates && this.gates.length) {
      const g = ents.filter((e) => this.gates.some((q) => Math.abs(q.x - e.x) + Math.abs(q.z - e.z) <= 3));
      if (g.length) ents = g;
    } else if (this.settlement.type === 'city') ents = ents.slice(0, 4);
    const b = this.bounds;
    return ents.map((e) => {
      const d = [[e.x - b.x0, -1, 0], [b.x1 - e.x, 1, 0], [e.z - b.z0, 0, -1], [b.z1 - e.z, 0, 1]].reduce((m, q) => (q[0] < m[0] ? q : m));
      return { x: e.x, z: e.z, dx: d[1], dz: d[2] };
    });
  }
  put(x, y, z, id, meta = 0) {
    if (this.collect) {
      this.collect.push([x, y, z, id, meta]);
      this.local.set(`${x},${y},${z}`, id);
      return;
    }
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
    const steps = this.generateSteps();
    while (!steps.next().done);
  }

  // Laying the town out, stage by stage (each a pause where the work can
  // be left for the next frame: see World.layOut).
  *generateSteps() {
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
    yield;
    yield* this.scanTerrainSteps();
    if (s.type === 'city') this.cityWalls();
    this.roads();
    yield;
    yield* this.placeBuildingsSteps();
    this.docks();
    yield;
    this.decorate();
    yield;
    this.wilds();
    yield;
    this.clearDoorways();
    this.paintGround();
    this.decorBase = null;
    if (s.condition !== 'abandoned') this.npcs = generateNPCs(this, this.plan, hash4(s.seed, 0x5eed));
    this.local = null; // free construction scratch
  }

  scanTerrain() {
    const steps = this.scanTerrainSteps();
    while (!steps.next().done);
  }

  *scanTerrainSteps() {
    const b = this.bounds;
    const terrain = this.world.terrain;
    const ctx = terrain.context(b.x0 - 16, b.z0 - 16, b.x1 + 16, b.z1 + 16);
    this.ctx = ctx;
    this.cols = new Array(this.W * this.D);
    yield;
    for (let lz = 0; lz < this.D; lz++) {
      for (let lx = 0; lx < this.W; lx++) {
        const c = terrain.column(b.x0 + lx, b.z0 + lz, ctx, {});
        this.cols[lz * this.W + lx] = c;
        if (c.water >= 0) this.mask[lz * this.W + lx] = M.WATER;
      }
      if (lz % 8 === 7) yield;
    }
  }
  col(x, z) {
    if (!this.inside(x, z)) {
      // (The ground round the edge, looked at over and over as the town
      // hunts for lots: worked out once a tile.)
      this.outCols ||= new Map();
      const k = x * 65536 + z;
      let c = this.outCols.get(k);
      if (!c) {
        c = this.world.terrain.column(x, z, this.ctx, {});
        if (this.outCols.size > 40000) this.outCols.clear();
        this.outCols.set(k, c);
      }
      return c;
    }
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
    // (The Ashborn pave with the black rock they live on, their squares
    // with it cut and dressed; the Mirefolk lay boardwalks of bogwood over
    // the bog; the Stiltfolk's whole town stands on driftwood planking.
    // Whatever's planked over water is in each people's own wood: see
    // blocks.planksOf.)
    const bridge = planksOf(s.style);
    if (s.style === 'ember') {
      plaza = T === 'village' ? B.gravel : B.basalt_bricks;
      road = T === 'village' ? B.gravel : B.basalt;
    }
    if (s.style === 'mist') {
      road = bridge;
      plaza = T === 'city' ? B.mossy_bricks : bridge;
    }
    if (s.style === 'tide') {
      road = bridge;
      plaza = bridge;
    }
    // (A far people's own roads and squares: see farlands.js.)
    const F = FAR_BUILD[s.style];
    if (F) {
      const k = T === 'village' ? 0 : T === 'town' ? 1 : 2;
      road = F.road[k];
      plaza = F.plaza[k];
    }
    if ((cond === 'poor' || cond === 'abandoned') && s.style !== 'mist' && s.style !== 'tide') {
      road = B.path;
      if (plaza === B.stone_bricks) plaza = B.cobblestone;
    }
    // On sand, a dirt track or sandstone paving is all but invisible: the
    // lanes are laid with baked clay slabs instead.
    if (s.biome === 'desert' || (hot && s.style === 'sun')) {
      if (road === B.path || road === B.sandstone || road === B.gravel) road = B.flagstone;
      if (plaza === B.sandstone) plaza = B.flagstone;
    }
    return { road, plaza, cold, hot, bridge };
  }

  buildingMats(type, rng) {
    const s = this.settlement;
    const T = s.type;
    const civic = SPECS[type]?.civic;
    const { cold, hot } = this.mats;
    let style = s.style;
    // (A far people builds its own way, whatever the weather.)
    const far = FAR_BUILD[style];
    if (far) {
      const F = civic && T !== 'village' ? far.civic : far;
      let wall = rng.weighted(F.wall);
      let corner = F.corner;
      let floor = F.floor;
      if (type === 'barn' || type === 'stables') {
        wall = far.barn[0];
        corner = far.barn[1];
        floor = B.dirt;
      }
      const roof = rng.weighted(F.roof);
      // (An empire's palace in its grandest.)
      if (type === 'palace') {
        wall = rng.weighted(far.civic.wall);
        corner = far.civic.corner;
        floor = far.civic.floor;
      }
      return { wall, corner, floor, roof, flat: F.flat && type !== 'barn' && type !== 'stables', style };
    }
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
      // The Ashborn build squat and square on the black rock, but never of
      // it: walls of pale ash plaster (washed white again every spring,
      // so a town shows from far off against the ash), corners of dressed
      // basalt, the halls of red kiln brick; flat roofs of terracotta tile
      // (green copper over the great halls) the ash can be swept off, with
      // a brazier kept burning up there for the mountain.
      case 'ember':
        wall = civic ? rng.weighted([[B.kiln_brick, 3], [B.ash_plaster, 2]]) : rng.weighted([[B.ash_plaster, 5], [B.kiln_brick, 1]]);
        corner = B.basalt_bricks;
        floor = B.kiln_brick;
        roof = civic && rng.chance(0.6) ? B.copper_roof : B.kiln_tile;
        flat = true;
        break;
      // The Mirefolk: dark bogwood on giant-mushroom posts, under roofs
      // like the caps of the mushrooms they live among (or deep moss).
      case 'mist':
        wall = rng.weighted([[B.planks_bog, 3], [B.log_wall, 2], [B.cobblestone, civic ? 2 : 0.4]]);
        corner = B.mushroom_stem;
        floor = B.planks_bog;
        roof = rng.weighted([[B.roof_mushroom, civic ? 4 : 3], [B.roof_moss, 2]]);
        break;
      // The Stiltfolk: pale driftwood on mangrove posts under reed thatch,
      // a deck of it all round.
      case 'tide':
        wall = rng.weighted([[B.planks_drift, 4], [B.planks_birch, 1], [B.log_wall, 0.6]]);
        corner = B.log_mangrove;
        floor = B.planks_drift;
        roof = rng.weighted([[B.roof_reed, 4], [B.thatch, 1]]);
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
    if (civic && T !== 'village' && !['sun', 'ember', 'mist', 'tide'].includes(style)) {
      if (type === 'temple') wall = s.condition === 'prosperous' || T === 'city' ? B.marble : B.stone_bricks;
      else if (rng.chance(0.6)) wall = rng.pick([B.stone_bricks, B.bricks]);
      corner = wall === B.marble ? B.marble : B.stone_bricks;
      floor = type === 'temple' ? B.marble : B.stone_bricks;
      if (!flat) roof = cold ? B.roof_snow : rng.chance(0.3) ? B.roof_green : B.roof_slate;
    }
    if (type === 'barn' || type === 'stables') {
      // (In each people's own wood: see blocks.planksOf.)
      wall = style === 'sun' ? B.adobe : planksOf(style);
      corner = style === 'sun' ? B.adobe : { ember: B.log_cinder, mist: B.log_mangrove, tide: B.log_mangrove }[style] || B.log_oak;
      floor = B.dirt;
    }
    if (cold && !flat && roof !== B.roof_snow && rng.chance(0.7)) roof = B.roof_snow;
    return { wall, corner, floor, roof, flat, style };
  }

  // ------------------------------------------------------------ walls
  cityWalls() {
    const b = this.bounds;
    // (A far people's in its own stone or timber.)
    const W = FAR_BUILD[this.settlement.style]?.cityWall ?? B.stone_bricks;
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
          for (let y = Y0; y < Y0 + 4; y++) this.put(x, y, z, this.wallBlock);
          if (Math.abs(dx) + Math.abs(dz) === 2 || (dx === 0 && dz === 0)) this.put(x, Y0 + 4, z, this.wallBlock);
        }
      }
      this.put(cx, Y0 + 5, cz, B.lantern, META_STATE);
    }
    // Real gates in the gateways (open by day), under a lintel.
    for (const [x, y, z, id, meta] of this.gateBlocks(this.gates)) this.put(x, y, z, id, meta);
  }

  // The blocks of the gates for gateway tiles: two leaves high, facing
  // across the wall, with the wall carried over the top.
  gateBlocks(gates) {
    const b = this.bounds;
    const out = [];
    for (const g of gates) {
      const rot = g.rot ?? (g.x === b.x0 || g.x === b.x1 ? 1 : 0);
      // (Open to the sky above, so the gate shows from any side.)
      out.push([g.x, Y0, g.z, B.city_gate, rot | META_STATE], [g.x, Y0 + 1, g.z, B.city_gate_top, rot | META_STATE]);
    }
    return out;
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
      // (Squares a little bigger than they were, so there's room to walk
      // across them round what stands in them: see isLane.)
      pw = 9;
      pd = 7;
      this.patrol.push({ x: b.x0 + 1, z: cz }, { x: b.x1 - 1, z: cz });
    } else if (s.type === 'town') {
      this.hRoad(cz, b.x0, b.x1, 3);
      this.vRoad(cx, b.z0, b.z1, 3);
      pw = 17;
      pd = 10;
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
      pw = 21;
      pd = 13;
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

  sizesFor(type) {
    if (type === 'townhall' && this.settlement.type === 'village') return [[8, 6], [7, 6]];
    return SPECS[type].size;
  }

  placeBuilding(type, cands, rng) {
    const allowWater = this.settlement.biome === 'swamp';
    for (const c of cands) {
      for (const [w, d] of this.sizesFor(type)) {
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
      tall: type === 'townhall' && this.settlement.type === 'village' ? 2 : SPECS[type].tall || 2,
    };
    const DX = [0, -1, 0, 1];
    const DZ = [1, 0, -1, 0];
    bld.inside = { x: r.door.x - DX[r.door.rot], z: r.door.z - DZ[r.door.rot] };
    if (type === 'tavern') bld.name = `The ${rng.pick(TAVERN_NAMES)}`;
    else this.nameShop(bld);
    if (type === 'townhall' && this.settlement.type === 'village') bld.name = 'Village Hall';
    this.buildings.push(bld);
    return bld;
  }

  placeBuildings() {
    const steps = this.placeBuildingsSteps();
    while (!steps.next().done);
  }

  *placeBuildingsSteps() {
    const s = this.settlement;
    const rng = this.rng.fork('bld');
    const plaza = this.plaza;
    const byPlaza = (list) => list.sort((a, b) => Math.hypot(a.x - plaza.cx, a.z - plaza.cz) - Math.hypot(b.x - plaza.cx, b.z - plaza.cz));
    // Work buildings first (near the plaza), then houses.
    const need = new Map();
    const count = (t, n = 1) => need.set(t, (need.get(t) || 0) + n);
    const jobs = this.plan.jobs;
    const jc = (j) => jobs.filter((x) => x === j).length;
    if (jc('innkeeper') || jc('barkeep') || jc('cook')) count('tavern', s.type === 'city' ? 2 : 1);
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
    // (Each island people's own trade.)
    for (const [job, T] of Object.entries(ISLE_TRADES)) if (jc(job)) count(T.building);
    let civicOrder = ['townhall', 'temple', 'tavern', 'shop', 'library', 'smithy', 'bakery', 'guardhouse', 'tailor', 'workshop', 'herbalist', 'warehouse', 'barn', 'stables', ...TRADE_BUILDINGS];
    if (s.type === 'village') {
      // Villages only support a handful of trades (their people's own
      // among them, and an herbalist, when they have one: see npcgen.js).
      const keep = new Set(['tavern', 'barn', 'townhall', ...TRADE_BUILDINGS]);
      if (need.has('herbalist')) keep.add('herbalist');
      for (const t of rng.shuffle(['temple', 'shop', 'smithy', 'bakery', 'workshop', 'guardhouse'].filter((t) => need.has(t))).slice(0, need.has('herbalist') ? 1 : 2)) keep.add(t);
      civicOrder = civicOrder.filter((t) => keep.has(t));
    }
    let cands = this.frontage();
    const nearCands = byPlaza([...cands]);
    // Essential civic buildings claim the plaza first; the rest are placed
    // after houses so everyone gets a home.
    // (And each island people's own trade: it's what the place is known for.)
    const essential = new Set(['townhall', 'temple', 'tavern', 'shop', 'guardhouse', ...TRADE_BUILDINGS]);
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
    // Cities are dense: their graveyard claims ground before the houses.
    if (s.type === 'city') this.cemetery(rng.fork('cemetery'));
    // Houses: one per household, sized to fit it; nobles get manors.
    const hhs = [...this.plan.households].sort((a, b) => b.members.length - a.members.length);
    let nobles = jc('noble');
    cands = rng.shuffle(this.frontage());
    let lanes = 0;
    for (const h of hhs) {
      const n = h.members.length;
      let t = n <= 2 ? 'house_s' : n === 3 ? 'house_m' : 'house_l';
      if (nobles > 0 && h.members.some((m) => m.age === 'adult')) {
        // (An empire's first noble house is its ruling family's: the
        // palace, by the square.)
        t = s.empire && !this.buildings.some((q) => q.type === 'palace') ? 'palace' : 'manor';
        nobles--;
      }
      let bld = null;
      if (t === 'palace') {
        bld = this.placeBuilding('palace', byPlaza(this.frontage()), rng);
        if (!bld) t = 'manor';
      }
      for (let attempt = 0; attempt < 4 && !bld; attempt++) {
        bld = this.placeBuilding(t, cands, rng);
        if (!bld && t === 'manor') bld = this.placeBuilding('house_l', cands, rng);
        if (!bld && n <= 5 && t === 'house_l') bld = this.placeBuilding('house_m', cands, rng);
        if (!bld && lanes < 24 && this.growLane(rng)) {
          lanes++;
          cands = rng.shuffle(this.frontage());
        } else if (!bld) break;
      }
      if (bld && cands.length > 50) cands = cands.filter((c) => this.maskAt(c.x + c.dx, c.z + c.dz) === M.FREE);
      yield;
    }
    // The graveyard, then the remaining trades, then fields on the outskirts.
    if (!this.graveyard && !this.cemetery(rng.fork('cemetery')) && this.growLane(rng)) this.cemetery(rng.fork('cemetery2'));
    yield;
    for (const t of late) {
      if (!this.placeBuilding(t, byPlaza(this.frontage()), rng) && this.growLane(rng)) this.placeBuilding(t, byPlaza(this.frontage()), rng);
      yield;
    }
    // (Round 70) An empire's city: its landmarks, and its streets built up
    // (see empire.js).
    if (s.empire && s.type === 'city' && s.condition !== 'abandoned' && (this.world.ow.wg || 1) >= 3) {
      empireQuarter(this, rng.fork('empire'));
      yield;
    }
    // Empty lots the town can build on later (e.g. for new citizens).
    if (s.condition !== 'abandoned') {
      for (let i = 0; i < 2; i++) if (!this.placePlot(rng) && !(this.growLane(rng) && this.placePlot(rng))) break;
      if (!this.plots.length) this.fringePlot();
    }
    yield;
    this.farms();
    // The jail goes in the guardhouse, else the town hall, else the tavern.
    const jailOrder = ['guardhouse', 'townhall', 'tavern', 'warehouse', 'barn'];
    for (const b of this.buildings) b.jailCand = s.condition !== 'abandoned' && jailOrder.includes(b.type);
    const order = [...this.buildings].sort((a, b) => (jailOrder.includes(a.type) ? jailOrder.indexOf(a.type) : 99) - (jailOrder.includes(b.type) ? jailOrder.indexOf(b.type) : 99));
    yield;
    for (const b of order) {
      this.construct(b, rng.fork(b.id + 7));
      yield;
    }
  }

  // Reserve a small lot beside a road; nothing is built there yet.
  placePlot(rng, sign = true, type = 'house_s') {
    const cands = rng.shuffle(this.frontage());
    const exits = this.exits();
    for (const c of cands.slice(0, 400)) {
      for (const [w, d] of (SPECS[type] || SPECS.house_s).size) {
        const r = this.rectFor(c, w, d, 1 + (hash4(c.x, c.z, 3) % Math.max(1, w - 2)));
        if (!this.rectOk(r, false) || !this.gateClear(r, exits)) continue;
        // Lots opened later keep a couple of blocks clear of the houses
        // already there.
        if (!sign && !this.clearAround(r, 3)) continue;
        const front = { x: c.x + c.dx, z: c.z + c.dz };
        const fm = this.maskAt(front.x, front.z);
        if (fm !== M.FREE && fm !== M.ROAD && fm !== M.YARD) continue;
        for (let z = r.z0 - 1; z <= r.z1 + 1; z++) {
          for (let x = r.x0 - 1; x <= r.x1 + 1; x++) {
            const inRect = x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1;
            if (inRect) this.setMask(x, z, M.BUILD);
            else if (this.maskAt(x, z) === M.FREE && this.settlement.type === 'village') this.setMask(x, z, M.YARD);
          }
        }
        this.setMask(front.x, front.z, M.ROAD);
        const plot = { id: this.plots.length, type: 'house_s', x0: r.x0, z0: r.z0, x1: r.x1, z1: r.z1, door: r.door, outside: front };
        this.plots.push(plot);
        if (!sign) return plot;
        // A little sign on the empty lot.
        const DX = [0, -1, 0, 1];
        const DZ = [1, 0, -1, 0];
        const inX = r.door.x - DX[r.door.rot];
        const inZ = r.door.z - DZ[r.door.rot];
        this.put(inX, Y0, inZ, B.sign, r.door.rot);
        this.signs.push({ x: inX, y: Y0, z: inZ, kind: 'plot', plot: plot.id });
        plot.signAt = { x: inX, y: Y0, z: inZ };
        return plot;
      }
    }
    return null;
  }

  // No other building (or lot) within `pad` tiles of a rectangle.
  clearAround(r, pad) {
    for (let z = r.z0 - pad; z <= r.z1 + pad; z++) {
      for (let x = r.x0 - pad; x <= r.x1 + pad; x++) {
        if (x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1) continue;
        if (this.inside(x, z) && this.maskAt(x, z) === M.BUILD) return false;
      }
    }
    const near = (q) => q.x0 <= r.x1 + pad && q.x1 >= r.x0 - pad && q.z0 <= r.z1 + pad && q.z1 >= r.z0 - pad;
    return !this.buildings.some(near) && !this.plots.some((q) => q && q !== r && near(q));
  }

  isRoadTile(x, z) {
    if (this.outRoads && this.outRoads.has(x * 65536 + z)) return true;
    if (!this.inside(x, z)) return false;
    const m = this.maskAt(x, z);
    return m === M.ROAD || m === M.PLAZA || m === M.BRIDGE;
  }

  // The street tile nearest a point (within `r`), or null.
  nearestRoad(cx, cz, r = 16, skip = null) {
    let best = null;
    for (let z = cz - r; z <= cz + r; z++) {
      for (let x = cx - r; x <= cx + r; x++) {
        if (skip && skip(x, z)) continue;
        if (!this.isRoadTile(x, z)) continue;
        const d = Math.abs(x - cx) + Math.abs(z - cz);
        if (!best || d < best.d) best = { x, z, d };
      }
    }
    return best;
  }

  // Can a road be laid over this tile (open ground, no building, no wall)?
  roadable(x, z, rect = null) {
    if (rect && x >= rect.x0 && x <= rect.x1 && z >= rect.z0 && z <= rect.z1) return false;
    if (this.inside(x, z)) {
      const m = this.maskAt(x, z);
      if (m !== M.FREE && m !== M.ROAD && m !== M.PLAZA && m !== M.BRIDGE) return false;
    } else if (this.buildings.some((q) => x >= q.x0 && x <= q.x1 && z >= q.z0 && z <= q.z1)) return false;
    const c = this.col(x, z);
    return !!c && c.h === SURFACE && c.water < 0;
  }

  // The nearest street a lot could actually be joined to (walking round
  // walls and buildings, not through them).
  reachableRoad(rect, max = 30) {
    const key = (x, z) => x * 65536 + z;
    const seen = new Set();
    const queue = [];
    for (let z = rect.z0 - 1; z <= rect.z1 + 1; z++) {
      for (let x = rect.x0 - 1; x <= rect.x1 + 1; x++) {
        const ring = x < rect.x0 || x > rect.x1 || z < rect.z0 || z > rect.z1;
        // Not from the corners: a door can't face those.
        const corner = (x === rect.x0 - 1 || x === rect.x1 + 1) && (z === rect.z0 - 1 || z === rect.z1 + 1);
        if (!ring || corner) continue;
        seen.add(key(x, z));
        queue.push([x, z, 0]);
      }
    }
    for (let i = 0; i < queue.length && i < 4000; i++) {
      const [x, z, d] = queue[i];
      if (this.isRoadTile(x, z)) return { x, z, d };
      if (d >= max || !this.roadable(x, z, rect)) continue;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const k = key(x + dx, z + dz);
        if (seen.has(k)) continue;
        seen.add(k);
        queue.push([x + dx, z + dz, d + 1]);
      }
    }
    return null;
  }

  // A way from a new lot's front step to the nearest street, laid before
  // the house goes up: the tiles, from the lot outwards. Marked as road so
  // nothing else is put on it.
  roadTo(plot) {
    const from = plot.outside;
    // (A lot already on a street needs no path.)
    if (!from || this.isRoadTile(from.x, from.z)) return [];
    const ok = (x, z) => this.roadable(x, z, plot);
    const key = (x, z) => x * 65536 + z;
    const prev = new Map([[key(from.x, from.z), null]]);
    const queue = [[from.x, from.z, 0]];
    let end = null;
    for (let i = 0; i < queue.length && i < 3000; i++) {
      const [x, z, d] = queue[i];
      if ((x !== from.x || z !== from.z) && this.isRoadTile(x, z)) {
        end = [x, z];
        break;
      }
      if (d >= 28) continue;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx;
        const nz = z + dz;
        const k = key(nx, nz);
        if (prev.has(k) || !ok(nx, nz)) continue;
        prev.set(k, key(x, z));
        queue.push([nx, nz, d + 1]);
      }
    }
    if (!end) return [];
    const tiles = [];
    for (let k = prev.get(key(end[0], end[1])); k !== null && k !== undefined; k = prev.get(k)) tiles.push([Math.floor(k / 65536), k % 65536]);
    tiles.reverse();
    const wide = this.widen(tiles, ok, from);
    for (const [x, z] of wide) this.markRoad(x, z);
    return wide;
  }

  // A path made two tiles wide: each tile gets a neighbour beside it (on
  // the same side all along where it can), never across a lot's doorstep.
  widen(tiles, ok, keep = null) {
    const have = new Set(tiles.map(([x, z]) => x * 65536 + z));
    const out = [...tiles];
    let side = null;
    for (let i = 0; i < tiles.length; i++) {
      const [x, z] = tiles[i];
      if (keep && x === keep.x && z === keep.z) continue;
      const [nx, nz] = tiles[Math.min(tiles.length - 1, i + 1)];
      const [px, pz] = tiles[Math.max(0, i - 1)];
      const dx = Math.sign(nx - px);
      const dz = Math.sign(nz - pz);
      const sides = dx && dz ? [[dx, 0], [0, dz]] : [[dz, dx], [-dz, -dx]];
      const order = side ? [side, ...sides.filter((q) => q[0] !== side[0] || q[1] !== side[1])] : sides;
      for (const [sx, sz] of order) {
        const ax = x + sx;
        const az = z + sz;
        const k = ax * 65536 + az;
        if (have.has(k)) break;
        if (this.isRoadTile(ax, az) || !ok(ax, az)) continue;
        have.add(k);
        out.push([ax, az]);
        side = [sx, sz];
        break;
      }
    }
    return out;
  }

  markRoad(x, z) {
    if (this.inside(x, z)) this.setMask(x, z, M.ROAD);
    else (this.outRoads ||= new Set()).add(x * 65536 + z);
  }

  // Blocks for a road over the given tiles (plants in the way cleared).
  roadOps(tiles) {
    const ops = [];
    for (const [x, z] of tiles) {
      const c = this.col(x, z);
      ops.push([x, SURFACE, z, c && c.water >= 0 ? this.mats.bridge : this.mats.road, 0]);
      ops.push([x, Y0, z, B.air, 0, true]);
    }
    return ops;
  }

  // A lot just outside the edge (on the flattened fringe) facing the town.
  fringePlot(sign = true, reach = 7, flat = 0.05, needRoad = true, spaced = true, side = 5) {
    // (A square lot `side` tiles across; h is its middle, e the far edge.)
    const e = side - 1;
    const h = Math.floor(side / 2);
    const b = this.bounds;
    const p = this.plaza;
    // (Each tile's answer kept for this look round: the lots overlap.)
    const pad0 = 2;
    const mx0 = b.x0 - reach - pad0;
    const mz0 = b.z0 - reach - pad0;
    const mw = b.x1 - b.x0 + 2 * (reach + pad0) + 1;
    const mh = b.z1 - b.z0 + 2 * (reach + pad0) + 1;
    const memo = new Int8Array(mw * mh);
    const at = (x, z) => (x - mx0 >= 0 && x - mx0 < mw && z - mz0 >= 0 && z - mz0 < mh ? (z - mz0) * mw + (x - mx0) : -1);
    const tileOk = (x, z) => {
      const i = at(x, z);
      if (i < 0) return tileAt(x, z);
      if (!memo[i]) memo[i] = tileAt(x, z) ? 1 : 2;
      return memo[i] === 1;
    };
    // (What's built, or marked out, within a tile of each: see builtNear.)
    let near = null;
    const builtNear = (x, z) => {
      const i = at(x, z);
      if (i < 0) return this.builtNear(x, z, null);
      if (!near) {
        near = new Uint8Array(mw * mh);
        const stamp = (r) => {
          for (let qz = Math.max(mz0, r.z0 - 1); qz <= Math.min(mz0 + mh - 1, r.z1 + 1); qz++) {
            for (let qx = Math.max(mx0, r.x0 - 1); qx <= Math.min(mx0 + mw - 1, r.x1 + 1); qx++) near[(qz - mz0) * mw + (qx - mx0)] = 1;
          }
        };
        for (const q of this.buildings) stamp(q);
        for (const p of this.plots) if (p && !p.taken) stamp(p);
      }
      return near[i] === 1;
    };
    const tileAt = (x, z) => {
      if (this.inside(x, z)) {
        const m = this.maskAt(x, z);
        return m === M.FREE || m === M.YARD;
      }
      // Later lots beyond the town's edge: never onto (or too far towards)
      // another town, or on top of what's been built out there already.
      if (!sign) {
        if (Math.max(b.x0 - x, x - b.x1, b.z0 - z, z - b.z1) > Math.max(12, reach + 1)) return false;
        const other = this.world.ow.settlementAt(x, z);
        if (other && other !== this.settlement) return false;
        if (builtNear(x, z)) return false;
        if (this.outRoads && this.outRoads.has(x * 65536 + z)) return false;
      }
      const c = this.col(x, z);
      return c.h === SURFACE && c.water < 0 && c.flat >= flat;
    };
    const cands = [];
    for (let z = b.z0 - reach; z <= b.z1 + reach - side; z++) {
      for (let x = b.x0 - reach; x <= b.x1 + reach - side; x++) {
        if (x >= b.x0 + 2 && x + side <= b.x1 - 2 && z >= b.z0 + 2 && z + side <= b.z1 - 2) continue;
        cands.push({ x, z, d: Math.hypot(x + h - p.cx, (z + h - p.cz) * 1.5) });
      }
    }
    cands.sort((a, c) => a.d - c.d);
    const exits = this.exits();
    for (const { x, z } of cands) {
      let ok = true;
      // Lots marked out later stand a little further from their neighbours.
      const pad = sign || !spaced ? 1 : 2;
      for (let dz = -pad; dz <= e + pad && ok; dz++) for (let dx = -pad; dx <= e + pad && ok; dx++) ok = tileOk(x + dx, z + dz);
      if (ok) ok = this.gateClear({ x0: x, z0: z, x1: x + e, z1: z + e }, exits);
      if (ok && !sign) ok = this.clearAround({ x0: x, z0: z, x1: x + e, z1: z + e }, spaced ? 3 : 2);
      if (!ok) continue;
      // Door on the side facing the nearest street (else the plaza), so a
      // house beside a road running north-south faces east or west.
      const rd = sign ? null : this.reachableRoad({ x0: x, z0: z, x1: x + e, z1: z + e });
      // A lot marked out later needs a way to the streets.
      if (!sign && !rd && needRoad) continue;
      const dx = (rd ? rd.x : p.cx) - (x + h);
      const dz = (rd ? rd.z : p.cz) - (z + h);
      let door;
      if (Math.abs(dx) > Math.abs(dz)) door = dx > 0 ? { x: x + e, z: z + h, rot: 3 } : { x, z: z + h, rot: 1 };
      else door = dz > 0 ? { x: x + h, z: z + e, rot: 0 } : { x: x + h, z, rot: 2 };
      const DX = [0, -1, 0, 1];
      const DZ = [1, 0, -1, 0];
      const outside = { x: door.x + DX[door.rot], z: door.z + DZ[door.rot] };
      for (let qz = z; qz <= z + e; qz++) for (let qx = x; qx <= x + e; qx++) this.setMask(qx, qz, M.BUILD);
      const plot = { id: this.plots.length, type: 'house_s', x0: x, z0: z, x1: x + e, z1: z + e, door, outside, fringe: true };
      this.plots.push(plot);
      this.addSuburb(plot);
      if (!sign) return plot;
      const inX = door.x - DX[door.rot];
      const inZ = door.z - DZ[door.rot];
      this.put(inX, Y0, inZ, B.sign, door.rot);
      this.signs.push({ x: inX, y: Y0, z: inZ, kind: 'plot', plot: plot.id });
      plot.signAt = { x: inX, y: Y0, z: inZ };
      return plot;
    }
    return null;
  }

  // Blocks for a house on a lot, in building order (used when builders
  // construct a home for a new citizen at runtime).
  blueprint(plot, id) {
    const rng = new RNG(hash4(this.settlement.seed, 0xb10c, plot.id));
    const r = plot;
    const DX = [0, -1, 0, 1];
    const DZ = [1, 0, -1, 0];
    const bld = {
      id, type: plot.type, name: BUILDING_NAMES[plot.type], x0: r.x0, z0: r.z0, x1: r.x1, z1: r.z1, door: r.door, outside: r.outside,
      residential: true, beds: [], work: [], seats: [], free: [], household: null, playerHome: true,
      mats: this.buildingMats(plot.type, rng), tall: 2, fringe: !!plot.fringe,
    };
    bld.inside = { x: r.door.x - DX[r.door.rot], z: r.door.z - DZ[r.door.rot] };
    const chim = this.chimneys.length;
    const spots = this.spots.length;
    const signs = this.signs.length;
    const mask = this.mask.slice();
    this.collect = [];
    this.local = new Map();
    const list = [];
    // Clear the lot's plants and its sign first.
    for (let z = r.z0; z <= r.z1; z++) for (let x = r.x0; x <= r.x1; x++) list.push([x, Y0, z, B.air, 0]);
    this.construct(bld, rng);
    const put = this.collect;
    this.collect = null;
    this.local = null;
    const chimneys = this.chimneys.splice(chim);
    const newSpots = this.spots.splice(spots);
    const newSigns = this.signs.splice(signs);
    this.mask = mask;
    // Floor first, then walls bottom-up, roof, and furniture last.
    const phase = (e) => (e[1] < Y0 ? 0 : BLOCKS[e[3]].render === 'cube' || BLOCKS[e[3]].render === 'door' ? 1 + e[1] : 50);
    put.sort((a, b) => phase(a) - phase(b));
    list.push(...put);
    return { bld, list, chimneys, spots: newSpots, signs: newSigns };
  }

  // Build a building's blocks without touching the world: returns the
  // final block for every cell (clearing the footprint first), ordered for
  // construction (clearing, floor, walls bottom-up, roof, furniture).
  planBuilding(bld, rng, clearTo = Y0 + 8) {
    const chim = this.chimneys.length;
    const spots = this.spots.length;
    const signs = this.signs.length;
    const mask = this.mask.slice();
    this.collect = [];
    this.local = new Map();
    const target = new Map();
    for (let z = bld.z0; z <= bld.z1; z++) for (let x = bld.x0; x <= bld.x1; x++) for (let y = Y0; y <= clearTo; y++) target.set(`${x},${y},${z}`, [x, y, z, B.air, 0]);
    this.construct(bld, rng);
    for (const e of this.collect) target.set(`${e[0]},${e[1]},${e[2]}`, e);
    this.collect = null;
    this.local = null;
    const chimneys = this.chimneys.splice(chim);
    const newSpots = this.spots.splice(spots);
    const newSigns = this.signs.splice(signs);
    this.mask = mask;
    const phase = (e) => (e[3] === B.air ? -1 : e[1] < Y0 ? 0 : BLOCKS[e[3]].render === 'cube' || BLOCKS[e[3]].render === 'door' ? 1 + e[1] : 50);
    const list = [...target.values()].sort((a, b) => phase(a) - phase(b) || b[1] - a[1]);
    return { bld, list, chimneys, spots: newSpots, signs: newSigns };
  }

  // A new work building on an empty lot (the town grows what it lacks).
  typedBlueprint(plot, type, id, extra = {}) {
    const rng = new RNG(hash4(this.settlement.seed, 0xb11d, plot.id, type.length));
    const DX = [0, -1, 0, 1];
    const DZ = [1, 0, -1, 0];
    const r = plot;
    const bld = {
      id, type, name: BUILDING_NAMES[type] || 'Workshop', x0: r.x0, z0: r.z0, x1: r.x1, z1: r.z1, door: r.door, outside: r.outside,
      residential: !!SPECS[type]?.residential, beds: [], work: [], seats: [], free: [], household: null,
      mats: this.buildingMats(type, rng), tall: 2, built: true, fringe: !!plot.fringe, ...extra,
    };
    bld.inside = { x: r.door.x - DX[r.door.rot], z: r.door.z - DZ[r.door.rot] };
    if (type === 'tavern') bld.name = `The ${rng.pick(TAVERN_NAMES)}`;
    else if (type === 'college') {
      bld.name = `The ${this.settlement.name} Academy`;
      bld.tall = 3;
    } else this.nameShop(bld);
    if (type === 'townhall' && this.settlement.type === 'village') bld.name = 'Village Hall';
    return this.planBuilding(bld, rng);
  }

  // Room to grow a house to the next size, keeping its door where it is.
  expansionBounds(b) {
    const next = { house_s: 'house_m', house_m: 'house_l' }[b.type];
    if (!next) return null;
    const rot = b.door.rot;
    const alongX = rot === 0 || rot === 2; // door wall runs along x
    const cw = alongX ? b.x1 - b.x0 + 1 : b.z1 - b.z0 + 1;
    const cd = alongX ? b.z1 - b.z0 + 1 : b.x1 - b.x0 + 1;
    // Villages have no walls to keep clear of, and a house on the edge of
    // town may grow out into the open (never onto another building).
    const lax = this.settlement.type === 'village' || b.fringe;
    const ok = (x, z, own) => {
      if (own(x, z)) return true;
      if (!this.inside(x, z, lax ? 0 : 2) && (!lax || this.builtNear(x, z, b))) return false;
      const m = this.maskAt(x, z);
      // Open ground, a yard, or a flower bed or garden (not on a street).
      if (m !== M.FREE && m !== M.YARD && !(m === M.DECOR && !this.onStreet(x, z))) return false;
      const c = this.col(x, z);
      return c && c.water < 0 && c.h === SURFACE;
    };
    const own = (x, z) => x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1;
    const exits = this.exits();
    for (const [w, d] of SPECS[next].size) {
      if (w < cw || d < cd) continue;
      const extraW = w - cw;
      const extraD = d - cd;
      for (let a = 0; a <= extraW; a++) {
        let r;
        if (rot === 0) r = { x0: b.x0 - a, x1: b.x1 + (extraW - a), z1: b.z1, z0: b.z0 - extraD };
        else if (rot === 2) r = { x0: b.x0 - a, x1: b.x1 + (extraW - a), z0: b.z0, z1: b.z1 + extraD };
        else if (rot === 1) r = { z0: b.z0 - a, z1: b.z1 + (extraW - a), x0: b.x0, x1: b.x1 + extraD };
        else r = { z0: b.z0 - a, z1: b.z1 + (extraW - a), x1: b.x1, x0: b.x0 - extraD };
        const d0 = b.door;
        if (alongX ? d0.x <= r.x0 || d0.x >= r.x1 : d0.z <= r.z0 || d0.z >= r.z1) continue;
        let fits = this.gateClear(r, exits);
        for (let z = r.z0 - 1; z <= r.z1 + 1 && fits; z++) {
          for (let x = r.x0 - 1; x <= r.x1 + 1 && fits; x++) {
            const inRect = x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1;
            if (inRect && !ok(x, z, own)) fits = false;
            if (!inRect && !own(x, z) && [M.BUILD, M.WALL, M.WATER].includes(this.maskAt(x, z))) fits = false;
          }
        }
        if (fits) return { ...r, type: next };
      }
    }
    return null;
  }

  // The blocks for a house grown to new bounds (same door, same family).
  rebuildPlan(b, nb, rev = 1) {
    const rng = new RNG(hash4(this.settlement.seed, 0xe4a, b.id, rev));
    const bld = {
      ...b, type: nb.type, x0: nb.x0, z0: nb.z0, x1: nb.x1, z1: nb.z1, beds: [], work: [], seats: [], free: [], homeSpots: [],
      name: b.playerHome ? b.name : BUILDING_NAMES[nb.type], tall: 2,
    };
    const oldTop = (b.roofBase || Y0 + 2) + Math.max(b.x1 - b.x0, b.z1 - b.z0);
    return this.planBuilding(bld, rng, Math.min(Y0 + 10, oldTop + 1));
  }

  // Outside the town's mask: is there a building or lot here already?
  builtNear(x, z, except) {
    const near = (r) => x >= r.x0 - 1 && x <= r.x1 + 1 && z >= r.z0 - 1 && z <= r.z1 + 1;
    return this.buildings.some((q) => q !== except && near(q)) || this.plots.some((p) => p && !p.taken && near(p));
  }

  // Where roads leave the town (city gates, or the open ends of streets),
  // and which way each runs out.
  exits() {
    const b = this.bounds;
    const out = [];
    const road = (x, z) => {
      const m = this.maskAt(x, z);
      return m === M.ROAD || m === M.BRIDGE;
    };
    for (let x = b.x0; x <= b.x1; x++) {
      if (road(x, b.z0)) out.push({ x, z: b.z0, dx: 0, dz: -1 });
      if (road(x, b.z1)) out.push({ x, z: b.z1, dx: 0, dz: 1 });
    }
    for (let z = b.z0 + 1; z < b.z1; z++) {
      if (road(b.x0, z)) out.push({ x: b.x0, z, dx: -1, dz: 0 });
      if (road(b.x1, z)) out.push({ x: b.x1, z, dx: 1, dz: 0 });
    }
    for (const g of this.gates) if (!out.some((q) => q.x === g.x && q.z === g.z)) out.push({ ...g, dx: 0, dz: 0 });
    return out;
  }

  // Nothing new goes up hard by a gate, or across the road running out of
  // it: a rectangle must keep two tiles clear of every gate, and of a lane
  // two tiles either side of the road beyond it.
  gateClear(r, exits = this.exits()) {
    const x0 = r.x0 - 1;
    const x1 = r.x1 + 1;
    const z0 = r.z0 - 1;
    const z1 = r.z1 + 1;
    for (const g of exits) {
      const dx = Math.max(x0 - g.x, 0, g.x - x1);
      const dz = Math.max(z0 - g.z, 0, g.z - z1);
      if (Math.max(dx, dz) <= 1) return false;
      // The road out: a lane two tiles either side, fourteen tiles long.
      if (g.dz && x1 >= g.x - 2 && x0 <= g.x + 2) {
        const a = g.dz < 0 ? g.z - 14 : g.z;
        const c = g.dz < 0 ? g.z : g.z + 14;
        if (z1 >= a && z0 <= c) return false;
      }
      if (g.dx && z1 >= g.z - 2 && z0 <= g.z + 2) {
        const a = g.dx < 0 ? g.x - 14 : g.x;
        const c = g.dx < 0 ? g.x : g.x + 14;
        if (x1 >= a && x0 <= c) return false;
      }
    }
    return true;
  }

  // Decorations set on the square or a street (their paving lies beneath).
  onStreet(x, z) {
    return !!this.decorBase && this.decorBase.has((z - this.bounds.z0) * this.W + (x - this.bounds.x0));
  }

  // Every lot taken: the town marks out a new one beside a road, else on
  // its edge (after founding, so no sign; the builders come straight away).
  openPlot(type = 'house_s', insideOnly = false) {
    const steps = this.openPlotSteps(type, insideOnly);
    let r;
    do r = steps.next();
    while (!r.done);
    return r.value;
  }

  // The same, a try at a time (each a place the work can be left for the
  // next frame: see Sim.civicSteps).
  *openPlotSteps(type = 'house_s', insideOnly = false) {
    const rng = new RNG(hash4(this.settlement.seed, 0x7a0e, this.plots.length));
    // A lot big enough for what's to go on it.
    const inner = this.placePlot(rng, false, type);
    if (inner || insideOnly) return inner;
    const side = Math.max(5, ...(SPECS[type] || SPECS.house_s).size[0]);
    // Further and further out, on rougher ground, and closer together.
    for (const [reach, flat, spaced] of [[7, 0.05, true], [12, 0, true], [17, 0, true], [12, 0, false]]) {
      yield;
      const plot = this.fringePlot(false, reach, flat, true, spaced, side);
      if (plot) return plot;
    }
    return null;
  }

  // Is the town walled (from its founding as a city, or built since)?
  get walled() {
    return !!this.wallBlock || !!(this.econ && this.econ.walled);
  }

  // A wall for a town that has grown into a city: round its edge, three
  // blocks high with a crenellated top, open where the roads run out, and
  // never across a building, a field or water.
  wallPlan() {
    const b = this.bounds;
    const list = [];
    const tiles = [];
    const gates = [];
    const seen = new Set();
    const ok = (x, z) => {
      const m = this.maskAt(x, z);
      return m === M.FREE || m === M.YARD || (m === M.DECOR && !this.onStreet(x, z));
    };
    const visit = (x, z, rot = 0) => {
      const k = x * 65536 + z;
      if (seen.has(k)) return;
      seen.add(k);
      const m = this.maskAt(x, z);
      const c = this.col(x, z);
      if (m === M.ROAD || m === M.BRIDGE || m === M.PLAZA) {
        // (A bridge out over the water needs no gate: no wall stands there.)
        if (m !== M.BRIDGE || !c || c.water < 0) gates.push({ x, z, rot });
        return;
      }
      if (!ok(x, z)) return;
      if (!c || c.water >= 0 || c.h !== SURFACE) return;
      tiles.push([x, z]);
      for (let y = Y0; y < Y0 + 3; y++) list.push([x, y, z, B.stone_bricks, 0]);
      if ((x + z) % 2 === 0) list.push([x, Y0 + 3, z, B.stone_bricks, 0]);
    };
    for (let x = b.x0; x <= b.x1; x++) {
      visit(x, b.z0, 0);
      visit(x, b.z1, 0);
    }
    for (let z = b.z0; z <= b.z1; z++) {
      visit(b.x0, z, 1);
      visit(b.x1, z, 1);
    }
    // A road through the wall gets a proper gateway (four tiles at least),
    // not a hole the width of the road.
    const open = new Set(gates.map((g) => g.x * 65536 + g.z));
    const wallAt = new Set(tiles.map(([x, z]) => x * 65536 + z));
    const along = (g) => (g.z === b.z0 || g.z === b.z1 ? [1, 0] : [0, 1]);
    for (const g of [...gates]) {
      const [ax, az] = along(g);
      let lo = 0;
      let hi = 0;
      while (open.has((g.x - ax * (lo + 1)) * 65536 + g.z - az * (lo + 1))) lo++;
      while (open.has((g.x + ax * (hi + 1)) * 65536 + g.z + az * (hi + 1))) hi++;
      for (let k = 1; lo + hi + 1 < GATE_MIN && k <= 2; k++) {
        for (const sgn of [1, -1]) {
          if (lo + hi + 1 >= GATE_MIN) break;
          const n = sgn > 0 ? hi + 1 : lo + 1;
          const x = g.x + ax * sgn * n;
          const z = g.z + az * sgn * n;
          const kk = x * 65536 + z;
          if (!wallAt.has(kk)) continue;
          wallAt.delete(kk);
          open.add(kk);
          gates.push({ x, z, rot: g.rot });
          if (sgn > 0) hi++;
          else lo++;
        }
      }
    }
    const keep = (x, z) => wallAt.has(x * 65536 + z);
    // A stretch at a time, course by course, working round the town: the
    // builders finish one bit before moving along to the next.
    const W = b.x1 - b.x0;
    const D = b.z1 - b.z0;
    const round = (x, z) => (z === b.z0 ? x - b.x0 : x === b.x1 ? W + (z - b.z0) : z === b.z1 ? W + D + (b.x1 - x) : 2 * W + D + (b.z1 - z));
    const stretch = (q) => Math.floor(round(q[0], q[2]) / 6);
    const kept = list.filter((q) => keep(q[0], q[2]));
    kept.sort((a, c) => stretch(a) - stretch(c) || a[1] - c[1] || round(a[0], a[2]) - round(c[0], c[2]));
    return { list: kept, tiles: tiles.filter(([x, z]) => keep(x, z)), gates };
  }

  // A city that has spread beyond its wall rings the new streets with a
  // wider one (`r`, a rectangle round them all): the old wall stays as the
  // inner ring. Roads through it get gates; buildings, water and other
  // towns' ground are left alone.
  outerWallPlan(r) {
    const list = [];
    const tiles = [];
    const gates = [];
    const seen = new Set();
    const other = (x, z) => {
      const o = this.world.ow.settlementAt(x, z);
      return o && o !== this.settlement;
    };
    const blocked = (x, z) => this.buildings.some((bd) => x >= bd.x0 - 1 && x <= bd.x1 + 1 && z >= bd.z0 - 1 && z <= bd.z1 + 1);
    const visit = (x, z, rot) => {
      const k = x * 65536 + z;
      if (seen.has(k)) return;
      seen.add(k);
      if (this.isRoadTile(x, z) || (this.inside(x, z) && this.maskAt(x, z) === M.BRIDGE)) {
        gates.push({ x, z, rot });
        return;
      }
      if (this.inside(x, z)) {
        const m = this.maskAt(x, z);
        if (m !== M.FREE && m !== M.YARD) return;
      } else if (blocked(x, z) || other(x, z)) return;
      const c = this.col(x, z);
      if (!c || c.water >= 0 || c.h !== SURFACE) return;
      tiles.push([x, z]);
      for (let y = Y0; y < Y0 + 3; y++) list.push([x, y, z, B.stone_bricks, 0]);
      if ((x + z) % 2 === 0) list.push([x, Y0 + 3, z, B.stone_bricks, 0]);
    };
    for (let x = r.x0; x <= r.x1; x++) {
      visit(x, r.z0, 0);
      visit(x, r.z1, 0);
    }
    for (let z = r.z0; z <= r.z1; z++) {
      visit(r.x0, z, 1);
      visit(r.x1, z, 1);
    }
    const W = r.x1 - r.x0;
    const D = r.z1 - r.z0;
    const round = (x, z) => (z === r.z0 ? x - r.x0 : x === r.x1 ? W + (z - r.z0) : z === r.z1 ? W + D + (r.x1 - x) : 2 * W + D + (r.z1 - z));
    list.sort((a, c) => Math.floor(round(a[0], a[2]) / 6) - Math.floor(round(c[0], c[2]) / 6) || a[1] - c[1] || round(a[0], a[2]) - round(c[0], c[2]));
    return { list, tiles, gates };
  }

  // Pull down a stretch of wall (five tiles) around an edge tile: a new way
  // out for a city that has run out of room inside.
  breachPlan(at) {
    const b = this.bounds;
    const alongX = at.z === b.z0 || at.z === b.z1;
    const list = [];
    const tiles = [];
    // Wide enough for a street and its verges; next to a gate, it widens
    // that gate instead.
    for (let k = -3; k <= 3; k++) {
      const x = alongX ? at.x + k : at.x;
      const z = alongX ? at.z : at.z + k;
      if (this.maskAt(x, z) !== M.WALL) continue;
      tiles.push([x, z]);
      for (let y = Y0 + 4; y >= Y0; y--) list.push([x, y, z, B.air, 0]);
    }
    return { list, tiles };
  }

  // Wall or breach finished (or restored): the layout mask follows.
  applyWall(tiles, open) {
    for (const [x, z] of tiles) {
      this.setMask(x, z, open ? M.ROAD : M.WALL);
      if (open) this.gates.push({ x, z });
    }
  }

  // A lot opened after founding, marked out again after a reload.
  reopenPlot(r) {
    if (this.plots[r.id]) return this.plots[r.id];
    const plot = { ...r, taken: false };
    this.plots[r.id] = plot;
    this.claimFootprint(plot);
    for (const [x, z] of r.step || []) this.markRoad(x, z);
    if (r.signAt && !this.signs.some((q) => q.kind === 'plot' && q.plot === r.id)) this.signs.push({ ...r.signAt, kind: 'plot', plot: r.id });
    return plot;
  }

  // Mark a grown or new building's footprint on the layout mask.
  claimFootprint(r) {
    for (let z = r.z0; z <= r.z1; z++) for (let x = r.x0; x <= r.x1; x++) this.setMask(x, z, M.BUILD);
    this.addSuburb(r);
  }

  // A lot or building beyond the town's first bounds still belongs to the
  // town (its chests, its beds, its law).
  addSuburb(r) {
    const b = this.bounds;
    if (r.x0 >= b.x0 && r.x1 <= b.x1 && r.z0 >= b.z0 && r.z1 <= b.z1) return;
    const s = this.settlement;
    const q = { x0: r.x0 - 1, z0: r.z0 - 1, x1: r.x1 + 1, z1: r.z1 + 1 };
    s.suburbs = s.suburbs || [];
    const has = s.suburbs.find((o) => o.x0 <= q.x0 && o.z0 <= q.z0 && o.x1 >= q.x1 && o.z1 >= q.z1);
    if (!has) s.suburbs.push(q);
  }

  // Extend a side lane off an existing road into open ground.
  growLane(rng) {
    // (Two wide everywhere: a cart and a walker can pass.)
    const w = 2;
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

  // A shop's own name (from its own seed: the town's layout doesn't change).
  nameShop(b) {
    const list = SHOP_NAMES[b.type];
    if (!list) return;
    const taken = new Set(this.buildings.map((q) => q.name));
    const r = new RNG(hash4(this.settlement.seed, 0x5a0e, b.id, b.type.length));
    const opts = list.filter((n) => !taken.has(n));
    if (opts.length) b.name = r.pick(opts);
  }

  // ------------------------------------------------------------ construction
  construct(b, rng) {
    const s = this.settlement;
    const spec = SPECS[b.type];
    const mats = b.mats;
    const cond = s.condition;
    const poor = cond === 'poor';
    const ruined = cond === 'abandoned';
    const wallH = b.tall || spec.tall || 2;
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
            if ((poor && rng.chance(0.3)) || ruined) id = rng.chance(0.5) ? B.air : this.mats.bridge;
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
    if (!ruined) this.cultureTouches(b, poor);
  }

  // Each people builds its own way, beyond what it builds with:
  //   northerners carve horns on the gable ends of their longhouses and
  //     keep their windows small and shuttered;
  //   the sun peoples hang striped awnings over their doors and keep pots
  //     of flowers up on their flat roofs;
  //   the wild folk let their thatch hang out well past the walls, grow
  //     vines up them, and set a carved post by the door;
  //   highlanders raise stone pinnacles at the corners of their roofs;
  //   the vale folk keep window boxes of flowers.
  // (Its own dice, so the rest of the town comes out the same.)
  cultureTouches(b, poor) {
    const rng = new RNG(hash4(this.settlement.seed >>> 0, b.id, 0xc17e));
    const { x0, z0, x1, z1, mats, door } = b;
    const style = mats.style;
    const DX = [0, -1, 0, 1];
    const DZ = [1, 0, -1, 0];
    const rot = door.rot;
    const o = b.outside;
    const px = DZ[rot] !== 0 ? 1 : 0;
    const pz = DX[rot] !== 0 ? 1 : 0;
    const sides = [1, -1].map((sg) => ({ x: o.x + px * sg, z: o.z + pz * sg }));
    const open = (x, z) => [M.FREE, M.YARD].includes(this.maskAt(x, z)) && this.inside(x, z, 0);
    const clearAbove = (x, z) => this.maskAt(x, z) !== M.BUILD && this.maskAt(x, z) !== M.WALL && !(x === o.x && z === o.z);
    const depth = z1 - z0 + 1;
    const layers = Math.ceil(depth / 2);
    const top = b.roofBase + layers - 1;
    // The windows: every other tile along the walls at the window row.
    const windows = [];
    for (let x = x0 + 1; x < x1; x++) for (const z of [z0, z1]) if ((x - x0) % 2 === 0) windows.push({ x, z, ox: x, oz: z === z0 ? z - 1 : z + 1 });
    for (let z = z0 + 1; z < z1; z++) for (const x of [x0, x1]) if ((z - z0) % 2 === 0) windows.push({ x, z, ox: x === x0 ? x - 1 : x + 1, oz: z });
    const isDoorish = (q) => Math.abs(q.x - door.x) + Math.abs(q.z - door.z) <= 1;
    if (style === 'north' && !mats.flat) {
      // Crossed horns on the ridge at either gable end.
      const zr = z0 + layers - 1;
      for (const x of [x0, x1]) this.put(x, top + 1, zr, mats.corner === B.cobblestone ? B.log_wall : mats.corner);
      // Shutters on some windows.
      for (const q of windows) if (!isDoorish(q) && rng.chance(0.4)) this.put(q.x, Y0 + 1, q.z, B.planks_dark);
    } else if (style === 'sun') {
      // An awning over the door.
      const cloth = rng.pick([B.awning_red, B.awning_blue, B.awning_yellow, B.awning_green]);
      for (const sd of sides) if (clearAbove(sd.x, sd.z)) this.put(sd.x, Y0 + 2, sd.z, cloth);
      // Pots of flowers along the parapet.
      if (mats.flat && !poor) {
        const flowers = [B.flower_red, B.flower_yellow, B.flower_purple, B.fern];
        for (let x = x0 + 1; x < x1; x++) {
          for (const z of [z0 + 1, z1 - 1]) if (rng.chance(0.18)) this.put(x, b.roofBase + 1, z, rng.pick(flowers));
        }
      }
    } else if (style === 'wild') {
      // The thatch overhangs the gable ends.
      if (!mats.flat) {
        for (let k = 0; k < layers; k++) {
          const zs = z0 + k;
          const ze = z1 - k;
          for (const x of [x0 - 1, x1 + 1]) {
            for (const z of zs === ze ? [zs] : [zs, ze]) {
              if (!clearAbove(x, z)) continue;
              this.put(x, b.roofBase + k, z, mats.roof, zs === ze ? 1 : z === zs ? 2 : 0);
            }
          }
        }
      }
      // Vines up the walls (you can push through them).
      for (const q of windows) if (!isDoorish(q) && open(q.ox, q.oz) && rng.chance(0.3)) this.put(q.ox, Y0 + 1, q.oz, B.leaves_jungle);
      // A carved post by the door.
      const sd = sides.find((p) => this.maskAt(p.x, p.z) === M.YARD);
      if (sd && (b.residential || SPECS[b.type]?.civic) && rng.chance(0.6)) {
        this.put(sd.x, Y0, sd.z, B.log_jungle);
        this.put(sd.x, Y0 + 1, sd.z, B.log_jungle);
        this.put(sd.x, Y0 + 2, sd.z, rng.chance(0.5) ? B.pumpkin : B.log_jungle);
        this.setMask(sd.x, sd.z, M.DECOR);
      }
    } else if (style === 'high' && !mats.flat) {
      // Stone pinnacles at the corners.
      for (const x of [x0, x1]) {
        for (const z of [z0, z1]) {
          this.put(x, b.roofBase, z, mats.corner);
          this.put(x, b.roofBase + 1, z, mats.corner);
        }
      }
    } else if (style === 'vale' && b.residential && !poor) {
      // Window boxes.
      const f = rng.pick([B.flower_red, B.flower_yellow, B.flower_white, B.flower_blue, B.flower_purple]);
      for (const q of windows) if (!isDoorish(q) && open(q.ox, q.oz) && rng.chance(0.55)) this.put(q.ox, Y0, q.oz, f);
    } else if (style === 'ember') {
      // A fire kept burning by the door (for the mountain), and fire lilies
      // under the windows.
      const sd = sides.find((p) => this.maskAt(p.x, p.z) === M.YARD);
      if (sd && (b.residential || SPECS[b.type]?.civic) && rng.chance(0.55)) {
        this.put(sd.x, Y0, sd.z, B.campfire, META_STATE);
        this.setMask(sd.x, sd.z, M.DECOR);
      }
      if (!poor) for (const q of windows) if (!isDoorish(q) && open(q.ox, q.oz) && rng.chance(0.3)) this.put(q.ox, Y0, q.oz, B.fire_lily);
    } else if (style === 'mist') {
      // Mushrooms grown up against the walls (a lucky glowcap or two).
      for (const q of windows) if (!isDoorish(q) && open(q.ox, q.oz) && rng.chance(0.35)) this.put(q.ox, Y0, q.oz, rng.chance(0.3) ? B.glowshroom : rng.chance(0.5) ? B.mushroom_red : B.mushroom_brown);
    } else if (style === 'tide') {
      // Barrels and crates of the catch stacked by the door; reeds drying.
      const sd = sides.find((p) => this.maskAt(p.x, p.z) === M.YARD);
      if (sd && b.residential && rng.chance(0.6)) {
        this.put(sd.x, Y0, sd.z, rng.chance(0.5) ? B.barrel : B.crate);
        this.setMask(sd.x, sd.z, M.DECOR);
      }
      for (const q of windows) if (!isDoorish(q) && open(q.ox, q.oz) && rng.chance(0.25)) this.put(q.ox, Y0, q.oz, B.reeds);
      // A plank deck all round the house, and mangrove posts at its corners
      // where the stilts come up.
      for (let z = z0 - 1; z <= z1 + 1; z++) {
        for (let x = x0 - 1; x <= x1 + 1; x++) {
          if (x >= x0 && x <= x1 && z >= z0 && z <= z1) continue;
          const m = this.maskAt(x, z);
          if (m !== M.YARD && m !== M.FREE) continue;
          this.put(x, SURFACE, z, this.mats.bridge);
          const cornerPost = (x === x0 - 1 || x === x1 + 1) && (z === z0 - 1 || z === z1 + 1);
          if (cornerPost && open(x, z)) {
            this.put(x, Y0, z, B.log_mangrove);
            this.put(x, Y0 + 1, z, B.fence);
            this.setMask(x, z, M.DECOR);
          }
        }
      }
    }
  }

  decay(id, rng) {
    if (id === B.stone_bricks || id === B.cobblestone || id === B.bricks || id === B.marble) return rng.chance(0.5) ? B.mossy_bricks : B.cracked_bricks;
    if (id === B.plaster || id === B.timber) return this.mats && this.mats.bridge ? this.mats.bridge : B.planks;
    if (id === B.planks || id === B.planks_dark || id === B.planks_birch || id === B.log_wall) return B.planks_dark;
    // (Ash plaster let go: fallen away to the basalt under it.)
    if (id === B.ash_plaster) return B.basalt_bricks;
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
          const ash = mats.style === 'ember';
          if (corner && ash && !ruined && x === x0 && z === z0) this.put(x, roofBase + 1, z, B.ash_brazier, META_STATE);
          else if (corner || (edge && (x + z) % 3 === 0)) this.put(x, roofBase + 1, z, b.mats.wall);
          else if (!edge && !ash && rng.chance(0.05)) this.put(x, roofBase + 1, z, rng.pick([B.barrel, B.crate, B.hay_bale]));
          else if (!edge && !ash && rng.chance(0.04)) this.put(x, roofBase + 1, z, rng.pick([B.rug_red, B.rug_blue]));
          else if (!edge && ash && rng.chance(0.06)) this.put(x, roofBase + 1, z, rng.pick([B.barrel, B.fire_lily]));
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
      // The gable ends: wall right up under the roof, no gap between.
      for (const x of [x0, x1]) {
        for (let z = zs + 1; z <= ze - 1; z++) {
          if (ruined && rng.chance(0.45)) continue;
          this.put(x, y, z, mats.wall);
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
      let list = interior.filter((t) => !occ.has(key(t.x, t.z)) && !reserved.has(key(t.x, t.z)) && (!opts.within || opts.within.has(key(t.x, t.z))));
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
    // The town's coffers: the treasury lives in these chests. (First of
    // all, before a cell or a table: a village's hall is small, and often
    // its jail too, but it must have them.)
    if (b.type === 'townhall' && !b.playerHome) {
      this.treasury = this.treasury || [];
      for (let i = 0; i < (s.type === 'village' ? 1 : 2); i++) {
        const ch = tryPlace(B.chest, 'wall', { access: true }) || tryPlace(B.chest, 'any', { access: true });
        if (ch) this.treasury.push({ x: ch.x, y: Y0, z: ch.z, building: b.id });
      }
    }
    if (b.jailCand && !this.jail && !b.playerHome) this.jailCell(b, { isIn, occ, reserved, key, connected, ix0, iz0, ix1, iz1 });
    // (Round 54) A tavern's room to let: two beds behind a wall and a door,
    // in a back corner (before the bar and the tables are set out).
    if (b.type === 'tavern' && !b.playerHome && s.condition !== 'abandoned') this.innRoom(b, { isIn, occ, reserved, key, connected, ix0, iz0, ix1, iz1 });

    if (b.residential) {
      const nBeds = t === 'house_s' ? 2 : t === 'house_m' ? 3 : t === 'manor' ? 5 : 6;
      const grand = t === 'manor' || t === 'palace';
      hearth();
      for (let i = 0; i < nBeds; i++) {
        const bed = tryPlace(B.bed, 'wall', { access: true, rot: 'wall' }) || tryPlace(B.bed, 'any', { access: true });
        if (bed) b.beds.push({ x: bed.x, z: bed.z, access: bed.access });
      }
      // (Every household keeps a chest, before the table if room's short:
      // against a wall if it'll go there, anywhere it'll go if not.)
      const chest = tryPlace(B.chest, 'wall', { access: true, rot: 'wall' }) || tryPlace(B.chest, 'any', { access: true });
      if (chest) b.chestPos = { x: chest.x, y: Y0, z: chest.z };
      const table = tryPlace(B.table, 'center', { access: true }) || tryPlace(B.table, 'any', { access: true });
      if (table) {
        seat(['eat', 'home'], table);
        seat(['eat', 'home'], table);
        if (rng.chance(0.5)) this.put(table.x, Y0 + 1, table.z, B.lantern, lit);
      }
      if (rng.chance(0.5)) tryPlace(B.barrel, 'wall');
      if (grand || rng.chance(0.3)) tryPlace(B.bookshelf, 'north', { rot: 0 });
      if (rng.chance(0.35)) tryPlace(B.stool, 'wall', { solid: false });
      if (grand) {
        tryPlace(B.bookshelf, 'north', { rot: 0 });
        tryPlace(B.chest, 'wall', { access: true, rot: 'wall' });
      }
      // (A palace's hall: its treasure, banners, the court's books, and
      // rugs from wall to wall.)
      if (t === 'palace') {
        for (let i = 0; i < 2; i++) tryPlace(B.chest, 'wall', { access: true, rot: 'wall' });
        for (let i = 0; i < 3; i++) tryPlace(B.bookshelf, 'north', { rot: 0 });
        for (let i = 0; i < 3; i++) tryPlace(rugId, 'center', { solid: false });
        for (let i = 0; i < 2; i++) tryPlace(B.war_banner, 'wall', { solid: false });
      }
      if (rng.chance(0.55) || grand) tryPlace(rugId, 'center', { solid: false });
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
        if (isIn(front.x, front.z) && !occ.has(key(front.x, front.z)) && !reserved.has(key(front.x, front.z))) {
          reserved.add(key(front.x, front.z));
          this.put(front.x, Y0, front.z, B.stool);
          b.seats.push(this.addSpot(front.x, front.z, 2, ['drink', 'social', 'eat', 'gossip'], { building: b.id, seat: true }));
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
    } else if (t === 'player_workshop') {
      // The trade's bench (or benches), a workbench, a chest and a lamp.
      for (const name of TRADE_BENCHES[b.trade] || ['workbench']) {
        const bt = tryPlace(B[name], 'north', { access: true, rot: 0 }) || tryPlace(B[name], 'wall', { access: true, rot: 'wall' });
        if (bt && (name === 'furnace' || name === 'oven') && !b.mats.flat) this.chimney(b, bt);
        if (bt) b.benches = [...(b.benches || []), { x: bt.x, z: bt.z, name }];
      }
      tryPlace(B.workbench, 'wall', { access: true });
      const ch = tryPlace(B.chest, 'wall', { access: true, rot: 'wall' });
      if (ch) b.chestPos = { x: ch.x, y: Y0, z: ch.z };
      tryPlace(B.stool, 'wall', { solid: false });
      lamp();
    } else if (TRADE_BUILDINGS.has(t)) {
      this.furnishTrade(b, { tryPlace, workAt, lamp, rng, Y0 });
    } else if (t === 'shop' || t === 'warehouse' || t === 'tailor' || t === 'workshop' || t === 'herbalist' || t === 'bakery' || t === 'smithy') {
      if (t === 'smithy') {
        const forge = tryPlace(B.furnace, 'north', { access: true, rot: 0 });
        if (forge) this.chimney(b, forge);
        workAt(tryPlace(B.anvil, 'any', { access: true, near: forge || undefined }), ['work', 'smith']);
        workAt(tryPlace(B.grindstone, 'wall', { access: true }), ['work', 'smith']);
        tryPlace(B.barrel, 'wall');
        tryPlace(B.chest, 'wall', { access: true, rot: 'wall' });
      } else if (t === 'bakery') {
        const oven = tryPlace(B.oven, 'north', { access: true, rot: 0 });
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
        workAt(tryPlace(B.loom, 'north', { access: true }));
        workAt(tryPlace(B.table, 'any', { access: true }));
        tryPlace(B.chest, 'wall', { access: true, rot: 'wall' });
        tryPlace(rugId, 'center', { solid: false });
      } else if (t === 'workshop') {
        workAt(tryPlace(B.workbench, 'north', { access: true }));
        workAt(tryPlace(B.workbench, 'wall', { access: true }));
        tryPlace(B.crate, 'wall');
        tryPlace(B.chest, 'wall', { access: true });
      } else {
        // The herbalist's still, and a table for sorting what's gathered.
        workAt(tryPlace(t === 'herbalist' ? B.alembic : B.workbench, 'north', { access: true }));
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
      // The scholar's desk, where the town's doings are written up.
      workAt(tryPlace(B.writing_desk, 'wall', { access: true }), ['work', 'read', 'study']);
      for (let i = 0; i < 2; i++) {
        const table = tryPlace(B.table, 'center', { access: true }) || tryPlace(B.table, 'any', { access: true });
        if (!table) break;
        this.put(table.x, Y0 + 1, table.z, B.lantern, lit);
        seat(['read', 'study', 'work'], table);
        seat(['read', 'study'], table);
      }
      b.work.push(...b.seats.filter((q) => q.tags.includes('work')));
      lamp();
    } else if (t === 'college') {
      this.furnishCollege(b, { tryPlace, workAt, lamp, occ, reserved, key, isIn, connected, lit, rugId, rng });
    } else if (t === 'academy' || t === 'study') {
      // Shelves of learning, desks for the researchers, a still for the
      // experiments, a table with charts spread on it. (A study: a couple
      // of shelves and a desk.)
      const big = t === 'academy';
      for (let i = 0; i < (big ? 4 : 2); i++) tryPlace(B.bookshelf, 'north', { rot: 0 });
      workAt(tryPlace(B.writing_desk, 'wall', { access: true }), ['work', 'read', 'study', 'research']);
      if (big) workAt(tryPlace(B.writing_desk, 'wall', { access: true }), ['work', 'read', 'study', 'research']);
      if (big) workAt(tryPlace(B.alembic, 'wall', { access: true }), ['work', 'research']);
      const table = tryPlace(B.table, 'center', { access: true });
      if (table) {
        this.put(table.x, Y0 + 1, table.z, B.lantern, lit);
        seat(['read', 'study', 'work', 'research'], table);
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
      tryPlace(rugId, 'center', { solid: false });
      lamp();
      lamp();
    } else if (t === 'stockade' || t === 'prison') {
      // Rows of cells along the long walls, a corridor between, a guard's
      // table and stool by the door.
      this.cellRows(b, { isIn, occ, reserved, key, connected, ix0, iz0, ix1, iz1 }, t === 'prison' ? 10 : 3);
      const table = tryPlace(B.table, 'any', { access: true });
      if (table) seat(['work', 'rest'], table);
      lamp();
      if (t === 'prison') lamp();
      b.work.push(...b.seats);
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
    } else if (t === 'stables') {
      // A row of stalls along the wall furthest from the door, a rail
      // between each; hay, a trough and the tack chest.
      const d = (q) => Math.abs(q.x - b.inside.x) + Math.abs(q.z - b.inside.z);
      const rows = [interior.filter((q) => q.z === iz0), interior.filter((q) => q.z === iz1), interior.filter((q) => q.x === ix0), interior.filter((q) => q.x === ix1)];
      const far = (r) => r.reduce((m, q) => m + d(q), 0) / r.length;
      const back = rows.filter((r) => r.length >= 3).sort((a, c) => far(c) - far(a))[0] || rows[0];
      b.stalls = [];
      back.forEach((q, i) => {
        if (reserved.has(key(q.x, q.z))) return;
        if (i % 2 === 1) {
          occ.add(key(q.x, q.z));
          if (!connected()) {
            occ.delete(key(q.x, q.z));
            return;
          }
          this.put(q.x, Y0, q.z, B.fence);
        } else {
          reserved.add(key(q.x, q.z));
          b.stalls.push({ x: q.x, z: q.z });
        }
      });
      for (let i = 0; i < 3; i++) tryPlace(B.hay_bale, 'wall');
      tryPlace(B.barrel, 'wall');
      tryPlace(B.chest, 'wall', { access: true });
      lamp();
      for (const f of interior.filter((q) => !occ.has(key(q.x, q.z)) && !reserved.has(key(q.x, q.z))).slice(0, 2)) addWork(f.x, f.z, 0);
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

  // A two-tile cell in a corner of the building behind iron bars.
  jailCell(b, f) {
    const { isIn, occ, reserved, key, connected, ix0, iz0, ix1, iz1 } = f;
    if (ix1 - ix0 < 3 || iz1 - iz0 < 2) return;
    for (const [cx, cz, sx, sz] of [[ix0, iz0, 1, 1], [ix1, iz0, -1, 1], [ix0, iz1, 1, -1], [ix1, iz1, -1, -1]]) {
      const cell = [{ x: cx, z: cz }, { x: cx + sx, z: cz }];
      const bars = [{ x: cx, z: cz + sz }, { x: cx + 2 * sx, z: cz }];
      const door = { x: cx + sx, z: cz + sz };
      const front = { x: cx + sx, z: cz + 2 * sz };
      const diag = { x: cx + 2 * sx, z: cz + sz };
      const solid = [...cell, ...bars, door];
      if (![...solid, diag].every((t) => isIn(t.x, t.z) && !occ.has(key(t.x, t.z)) && !reserved.has(key(t.x, t.z)))) continue;
      if (!isIn(front.x, front.z) || occ.has(key(front.x, front.z))) continue;
      for (const t of solid) occ.add(key(t.x, t.z));
      if (!connected()) {
        for (const t of solid) occ.delete(key(t.x, t.z));
        continue;
      }
      reserved.add(key(front.x, front.z));
      reserved.add(key(diag.x, diag.z));
      for (const t of bars) {
        this.put(t.x, Y0, t.z, B.iron_bars);
        this.put(t.x, Y0 + 1, t.z, B.iron_bars);
      }
      this.put(door.x, Y0, door.z, B.cell_door);
      this.put(door.x, Y0 + 1, door.z, B.cell_door_top);
      this.put(cell[0].x, Y0, cell[0].z, B.bed, sx > 0 ? 1 : 3);
      // No windows next to the cell.
      for (const t of cell) {
        for (const [dx, dz] of DIRS4) {
          const nx = t.x + dx;
          const nz = t.z + dz;
          if (isIn(nx, nz)) continue;
          this.put(nx, Y0, nz, b.mats.wall);
          this.put(nx, Y0 + 1, nz, b.mats.wall);
        }
      }
      // Everything a breakout could damage, for the guards to rebuild.
      const blocks = [];
      for (const t of bars) blocks.push([t.x, Y0, t.z, B.iron_bars, 0], [t.x, Y0 + 1, t.z, B.iron_bars, 0]);
      blocks.push([door.x, Y0, door.z, B.cell_door, 0], [door.x, Y0 + 1, door.z, B.cell_door_top, 0]);
      for (const t of cell) {
        for (const [dx, dz] of DIRS4) {
          const nx = t.x + dx;
          const nz = t.z + dz;
          if (isIn(nx, nz)) continue;
          blocks.push([nx, Y0, nz, b.mats.wall, 0], [nx, Y0 + 1, nz, b.mats.wall, 0]);
        }
      }
      this.jail = { building: b.id, cell, bed: cell[0], stand: cell[1], door, front, y: Y0, blocks };
      return;
    }
  }

  // (Round 54) The Academy: a hall from the door to the back, and off it,
  // behind walls with a door each, four classrooms: a kitchen (the oven, a
  // hearth, a table), a gem workshop (a jeweller's bench), a lecture room
  // (desks, shelves, a still) and a practice hall (dummies and a rack of
  // practice blades). Laid out from the door inward, whichever way the
  // building faces. Each room's tiles and door kept on the building
  // (b.rooms), for who's in class (see sim/college.js); the registrar's
  // desk at the back of the hall.
  furnishCollege(b, f) {
    const { tryPlace, workAt, lamp, occ, reserved, key, isIn, connected, lit, rugId } = f;
    const DX = [0, -1, 0, 1];
    const DZ = [1, 0, -1, 0];
    const fx = -DX[b.door.rot];
    const fz = -DZ[b.door.rot];
    const ux = fz;
    const uz = -fx;
    const o = b.inside;
    const W = (u, v) => ({ x: o.x + u * ux + v * fx, z: o.z + u * uz + v * fz });
    // How far the inside runs each way.
    let depth = 0;
    while (isIn(W(0, depth + 1).x, W(0, depth + 1).z)) depth++;
    let uMin = 0;
    while (isIn(W(uMin - 1, 0).x, W(uMin - 1, 0).z)) uMin--;
    let uMax = 0;
    while (isIn(W(uMax + 1, 0).x, W(uMax + 1, 0).z)) uMax++;
    const Dp = depth + 1;
    b.rooms = {};
    if (uMin > -4 || uMax < 4 || Dp < 7) {
      // (Too small to divide: one great room, a corner for each.)
      workAt(tryPlace(B.writing_desk, 'north', { access: true }), ['work', 'read', 'study', 'class']);
      workAt(tryPlace(B.jeweler_bench, 'wall', { access: true }), ['work', 'class']);
      workAt(tryPlace(B.oven, 'wall', { access: true }), ['work', 'class']);
      tryPlace(B.training_dummy, 'corner');
      lamp();
      return;
    }
    const mid = Math.floor(Dp / 2);
    const top = Y0 + (b.tall || 3) - 1;
    const wall = (u, v) => {
      const t = W(u, v);
      if (!isIn(t.x, t.z)) return;
      for (let y = Y0; y <= top; y++) this.put(t.x, y, t.z, b.mats.wall);
      occ.add(key(t.x, t.z));
    };
    const doorAt = (u, v, along) => {
      const t = W(u, v);
      // (The door's turned to the wall it's in: along the depth, or across.)
      const rot = along ? (b.door.rot + 1) & 3 : b.door.rot;
      this.put(t.x, Y0, t.z, B.door, rot);
      this.put(t.x, Y0 + 1, t.z, B.door_top, rot);
      for (let y = Y0 + 2; y <= top; y++) this.put(t.x, y, t.z, b.mats.wall);
      // (A way through the wall: not in the way.)
      occ.delete(key(t.x, t.z));
      reserved.add(key(t.x, t.z));
      return t;
    };
    // The two long walls either side of the hall, and the walls across each
    // wing between its front room and its back room.
    for (let v = 0; v < Dp; v++) {
      wall(-2, v);
      wall(2, v);
    }
    for (let u = uMin; u <= -3; u++) wall(u, mid);
    for (let u = 3; u <= uMax; u++) wall(u, mid);
    const fm = Math.floor(mid / 2);
    const bm = mid + 1 + Math.floor((Dp - mid - 1) / 2);
    const rooms = {
      kitchen: { u0: uMin, u1: -3, v0: 0, v1: mid - 1, door: [-2, fm] },
      gems: { u0: 3, u1: uMax, v0: 0, v1: mid - 1, door: [2, fm] },
      lecture: { u0: uMin, u1: -3, v0: mid + 1, v1: Dp - 1, door: [-2, bm] },
      yard: { u0: 3, u1: uMax, v0: mid + 1, v1: Dp - 1, door: [2, bm] },
    };
    for (const [name, R] of Object.entries(rooms)) {
      const tiles = [];
      for (let u = R.u0; u <= R.u1; u++) for (let v = R.v0; v <= R.v1; v++) tiles.push(W(u, v));
      const door = doorAt(R.door[0], R.door[1], true);
      // (In front of the door, inside and out: kept clear.)
      const sx = R.door[0] < 0 ? -1 : 1;
      for (const t of [W(R.door[0] + sx, R.door[1]), W(R.door[0] - sx, R.door[1])]) reserved.add(key(t.x, t.z));
      b.rooms[name] = { tiles, door, set: new Set(tiles.map((t) => key(t.x, t.z))) };
    }
    const inRoom = (name) => ({ within: b.rooms[name].set });
    // (What's walked over or sat on, a rug, a lamp, a chair: put down out
    // of the way of what's placed after, but not in anyone's way.)
    const deco = (id, name, o = {}) => {
      const set = name ? b.rooms[name].set : null;
      const list = [];
      for (let u = uMin; u <= uMax; u++) {
        for (let v = 0; v < Dp; v++) {
          const t = W(u, v);
          if (!isIn(t.x, t.z) || occ.has(key(t.x, t.z)) || reserved.has(key(t.x, t.z)) || (set && !set.has(key(t.x, t.z)))) continue;
          list.push(t);
        }
      }
      if (o.near) list.sort((a, c) => Math.abs(a.x - o.near.x) + Math.abs(a.z - o.near.z) - (Math.abs(c.x - o.near.x) + Math.abs(c.z - o.near.z)));
      else f.rng.shuffle(list);
      const t = list[0];
      if (!t) return null;
      this.put(t.x, Y0, t.z, id, (o.rot ?? 0) | (o.lit ? lit : 0));
      reserved.add(key(t.x, t.z));
      return t;
    };
    const seatIn = (tags, near, name) => {
      const t = deco(B.chair, name, { near, rot: faceToward(near.x, near.z, near.x, near.z) });
      if (t) b.seats.push(this.addSpot(t.x, t.z, faceToward(t.x, t.z, near.x, near.z), tags, { building: b.id, seat: true }));
      return t;
    };
    // The kitchen: the oven and a hearth, a table to work at, a barrel.
    workAt(tryPlace(B.oven, 'any', { access: true, ...inRoom('kitchen') }), ['work', 'class', 'cook']);
    const hearth = tryPlace(B.furnace, 'any', { access: true, ...inRoom('kitchen') });
    if (hearth) {
      workAt(hearth, ['work', 'class', 'cook']);
      if (!b.mats.flat) this.chimney(b, hearth);
    }
    const kt = tryPlace(B.table, 'any', { access: true, ...inRoom('kitchen') });
    if (kt) workAt(kt, ['work', 'class', 'cook']);
    tryPlace(B.barrel, 'any', inRoom('kitchen'));
    // The gem workshop: the bench, a table, a chest.
    workAt(tryPlace(B.jeweler_bench, 'any', { access: true, ...inRoom('gems') }), ['work', 'class', 'gems']);
    const gt = tryPlace(B.table, 'any', { access: true, ...inRoom('gems') });
    if (gt) {
      this.put(gt.x, Y0 + 1, gt.z, B.lantern, lit);
      seatIn(['class', 'study'], gt, 'gems');
    }
    tryPlace(B.chest, 'any', { access: true, ...inRoom('gems') });
    // The lecture room: desks, shelves, a still for the experiments.
    workAt(tryPlace(B.writing_desk, 'any', { access: true, ...inRoom('lecture') }), ['work', 'read', 'study', 'class', 'research']);
    tryPlace(B.bookshelf, 'any', { ...inRoom('lecture'), rot: 'wall' });
    tryPlace(B.bookshelf, 'any', { ...inRoom('lecture'), rot: 'wall' });
    workAt(tryPlace(B.alembic, 'any', { access: true, ...inRoom('lecture') }), ['work', 'class', 'research']);
    const lt = tryPlace(B.table, 'any', { access: true, ...inRoom('lecture') });
    if (lt) {
      this.put(lt.x, Y0 + 1, lt.z, B.lantern, lit);
      seatIn(['class', 'study', 'read'], lt, 'lecture');
      seatIn(['class', 'study', 'read'], lt, 'lecture');
    }
    // The practice hall: two dummies, a rack of practice blades, a rug to
    // fall on.
    tryPlace(B.training_dummy, 'any', inRoom('yard'));
    tryPlace(B.training_dummy, 'any', inRoom('yard'));
    tryPlace(B.weapon_rack, 'any', inRoom('yard'));
    deco(rugId, 'yard');
    // The hall: the registrar's desk at the back, benches down the sides,
    // the notice board by the door, lamps.
    const back = W(0, Dp - 1);
    this.put(back.x, Y0, back.z, B.writing_desk, (b.door.rot + 2) & 3);
    occ.add(key(back.x, back.z));
    const desk = W(0, Dp - 2);
    if (!connected()) {
      occ.delete(key(back.x, back.z));
      this.put(back.x, Y0, back.z, B.air);
    } else {
      reserved.add(key(desk.x, desk.z));
      b.work.push(this.addSpot(desk.x, desk.z, faceToward(desk.x, desk.z, back.x, back.z), ['work', 'registrar'], { building: b.id }));
      b.registrar = { x: desk.x, z: desk.z };
    }
    for (let v = 1; v < Dp - 2; v += 2) {
      for (const u of [-1, 1]) {
        const t = W(u, v);
        if (occ.has(key(t.x, t.z)) || reserved.has(key(t.x, t.z))) continue;
        this.put(t.x, Y0, t.z, B.bench, (b.door.rot + (u < 0 ? 1 : 3)) & 3);
        occ.add(key(t.x, t.z));
        b.seats.push(this.addSpot(t.x, t.z, 0, ['class', 'social', 'study'], { building: b.id, seat: true }));
      }
    }
    for (let v = 0; v < Dp; v++) {
      const t = W(0, v);
      if (!occ.has(key(t.x, t.z)) && !reserved.has(key(t.x, t.z))) this.put(t.x, Y0, t.z, rugId);
    }
    for (const name of [null, ...Object.keys(b.rooms)]) deco(B.torch, name, { lit: true });
    // (The rooms' sets aren't kept: Sets don't save. The tiles are.)
    for (const r of Object.values(b.rooms)) delete r.set;
  }

  // (Round 54) A tavern's room to let, in one of its corners: two beds
  // side by side against the outer wall, a strip of floor in front of
  // them, a wall round the rest with a door in it. Kept on the building
  // (b.inn) for whoever rents it (see Sim.bedOwner and dialogue.js), with
  // the blocks it's made of (for a tavern built before there were rooms:
  // see migrate.js).
  innRoom(b, f) {
    const { isIn, occ, reserved, key, connected, ix0, iz0, ix1, iz1 } = f;
    if (ix1 - ix0 < 3 || iz1 - iz0 < 3) return;
    const top = Y0 + (b.tall || 2) - 1;
    // (Each corner, the beds along the back wall or along the side.)
    const plans = [];
    for (const [cx, cz, sx, sz] of [[ix1, iz0, -1, 1], [ix0, iz0, 1, 1], [ix1, iz1, -1, -1], [ix0, iz1, 1, -1]]) {
      plans.push({
        beds: [{ x: cx, z: cz }, { x: cx + sx, z: cz }], floor: [{ x: cx, z: cz + sz }, { x: cx + sx, z: cz + sz }],
        door: { x: cx + sx, z: cz + 2 * sz }, walls: [{ x: cx, z: cz + 2 * sz }, { x: cx + 2 * sx, z: cz }, { x: cx + 2 * sx, z: cz + sz }, { x: cx + 2 * sx, z: cz + 2 * sz }],
        front: { x: cx + sx, z: cz + 3 * sz }, bedRot: sz > 0 ? 0 : 2, doorRot: sz > 0 ? 2 : 0,
      });
      plans.push({
        beds: [{ x: cx, z: cz }, { x: cx, z: cz + sz }], floor: [{ x: cx + sx, z: cz }, { x: cx + sx, z: cz + sz }],
        door: { x: cx + 2 * sx, z: cz + sz }, walls: [{ x: cx + 2 * sx, z: cz }, { x: cx, z: cz + 2 * sz }, { x: cx + sx, z: cz + 2 * sz }, { x: cx + 2 * sx, z: cz + 2 * sz }],
        front: { x: cx + 3 * sx, z: cz + sz }, bedRot: sx > 0 ? 3 : 1, doorRot: sx > 0 ? 1 : 3,
      });
    }
    for (const P of plans) {
      const { beds, floor, door, walls, front } = P;
      const all = [...beds, ...floor, door, ...walls];
      if (!all.every((t) => isIn(t.x, t.z) && !occ.has(key(t.x, t.z)) && !reserved.has(key(t.x, t.z)))) continue;
      if (!isIn(front.x, front.z) || occ.has(key(front.x, front.z))) continue;
      // (Not across the way in from the street.)
      if (all.some((t) => Math.abs(t.x - b.inside.x) + Math.abs(t.z - b.inside.z) <= 1)) continue;
      for (const t of all) occ.add(key(t.x, t.z));
      if (!connected()) {
        for (const t of all) occ.delete(key(t.x, t.z));
        continue;
      }
      reserved.add(key(front.x, front.z));
      const blocks = [];
      const put = (x, y, z, id, meta = 0) => {
        this.put(x, y, z, id, meta);
        blocks.push([x, y, z, id, meta]);
      };
      for (const t of walls) for (let y = Y0; y <= top; y++) put(t.x, y, t.z, b.mats.wall);
      put(door.x, Y0, door.z, B.door, P.doorRot);
      put(door.x, Y0 + 1, door.z, B.door_top, P.doorRot);
      for (let y = Y0 + 2; y <= top; y++) put(door.x, y, door.z, b.mats.wall);
      for (const t of beds) put(t.x, Y0, t.z, B.bed, P.bedRot);
      for (const t of floor) put(t.x, Y0, t.z, B.air);
      put(floor[0].x, Y0, floor[0].z, B.torch, META_STATE);
      b.inn = { beds, floor, door, front, blocks, y: Y0 };
      return;
    }
  }

  // Cells two tiles long against the north and south walls, each behind a
  // row of bars with a barred door, the corridor down the middle left
  // clear. Every cell is listed for the prisoners of war to be put in.
  cellRows(b, f, max) {
    const { isIn, occ, reserved, key, connected, ix0, iz0, ix1, iz1 } = f;
    let made = 0;
    for (const [row, front] of [[iz0, 1], [iz1, -1]]) {
      for (let x = ix0; x + 1 <= ix1 && made < max; x += 3) {
        const cell = [{ x, z: row }, { x: x + 1, z: row }];
        const bars = [{ x, z: row + front }];
        const door = { x: x + 1, z: row + front };
        const side = x + 2 <= ix1 ? [{ x: x + 2, z: row }, { x: x + 2, z: row + front }] : [];
        const aisle = { x: x + 1, z: row + 2 * front };
        const solid = [...cell, ...bars, door, ...side];
        if (!solid.every((q) => isIn(q.x, q.z) && !occ.has(key(q.x, q.z)) && !reserved.has(key(q.x, q.z)))) continue;
        if (!isIn(aisle.x, aisle.z) || occ.has(key(aisle.x, aisle.z))) continue;
        for (const q of solid) occ.add(key(q.x, q.z));
        if (!connected()) {
          for (const q of solid) occ.delete(key(q.x, q.z));
          continue;
        }
        reserved.add(key(aisle.x, aisle.z));
        for (const q of [...bars, ...side]) {
          this.put(q.x, Y0, q.z, B.iron_bars);
          this.put(q.x, Y0 + 1, q.z, B.iron_bars);
        }
        this.put(door.x, Y0, door.z, B.cell_door);
        this.put(door.x, Y0 + 1, door.z, B.cell_door_top);
        this.put(cell[0].x, Y0, cell[0].z, B.bed, 1);
        this.prisonCells.push({ building: b.id, tiles: cell, door, front: aisle, y: Y0 });
        made++;
      }
    }
    return made;
  }

  chimney(b, t) {
    // Chimney column rising through the roof above a hearth.
    const top = b.roofTop(t.z) + 1;
    for (let y = b.roofBase; y <= top; y++) this.put(t.x, y, t.z, B.bricks);
    if (this.settlement.condition !== 'abandoned') this.chimneys.push({ x: t.x, y: top + 1, z: t.z });
  }

  // Inside an island trade's building: its bench (or benches) to work at,
  // and what it keeps.
  furnishTrade(b, { tryPlace, workAt, lamp, rng }) {
    const t = b.type;
    if (t === 'windmill') {
      // The millstone, sacks of flour, wheat waiting to be ground.
      workAt(tryPlace(B.millstone, 'north', { access: true, rot: 0 }));
      workAt(tryPlace(B.millstone, 'wall', { access: true, rot: 'wall' }));
      for (let i = 0; i < 2; i++) tryPlace(B.hay_bale, 'corner');
      tryPlace(B.barrel, 'wall');
      tryPlace(B.chest, 'wall', { access: true, rot: 'wall' });
      lamp();
    } else if (t === 'glassworks') {
      // The kiln (never let go out), a bench to blow at, shelves of glass.
      const kiln = tryPlace(B.glass_kiln, 'north', { access: true, rot: 0 });
      if (kiln && !b.mats.flat) this.chimney(b, kiln);
      workAt(kiln);
      workAt(tryPlace(B.table, 'any', { access: true }));
      tryPlace(B.crate, 'wall');
      tryPlace(B.barrel, 'wall');
      tryPlace(B.chest, 'wall', { access: true, rot: 'wall' });
    } else if (t === 'sporehouse') {
      // Beds of peat in the dark, the glowcaps their only light.
      for (let i = 0; i < 3; i++) workAt(tryPlace(B.spore_bed, i ? 'wall' : 'north', { access: true, rot: i ? 'wall' : 0 }));
      tryPlace(B.barrel, 'corner');
      tryPlace(B.chest, 'wall', { access: true, rot: 'wall' });
      tryPlace(B.glowshroom, 'corner', { solid: false });
    } else {
      // The sorting table, baskets of oysters, nets.
      workAt(tryPlace(B.pearl_table, 'north', { access: true, rot: 0 }));
      workAt(tryPlace(B.table, 'any', { access: true }));
      tryPlace(B.barrel, 'wall');
      tryPlace(B.barrel, 'corner');
      tryPlace(B.chest, 'wall', { access: true, rot: 'wall' });
      lamp();
    }
    void rng;
  }

  // Outside it: a windmill's sails, turned to the street; heaps of sand by
  // a glassworks; a giant glowcap grown by the spore cellar's door; the
  // pearl house's baskets.
  tradeExterior(b, rng) {
    const s = this.settlement;
    if (s.condition === 'abandoned' && rng.chance(0.5)) return;
    if (b.type === 'windmill') {
      // The hub, set in the roof in the middle of one face, above the
      // eaves (on a gable end, in the gable itself), and four sails in an X
      // turning just out from the wall (none low enough to walk into, none
      // over a neighbour): on the south face if there's room (it faces the
      // way the street is mostly seen from), else the north, else a side.
      const hy = Y0 + (b.tall || 4) + 1;
      const sign = { x: b.outside.x, z: b.outside.z, y: Y0 + 2 };
      const clear = (x, z) => this.maskAt(x, z) !== M.BUILD && this.maskAt(x, z) !== M.WALL;
      // (`nx`, `nz`: the way the hub faces, out from the wall. The hub's on
      // the wall's own line; its sails in the row of tiles out from it.)
      const faces = [
        { hx: Math.round((b.x0 + b.x1) / 2), hz: b.z1, along: true, nx: 0, nz: 1 },
        { hx: Math.round((b.x0 + b.x1) / 2), hz: b.z0, along: true, nx: 0, nz: -1 },
        { hx: b.x1, hz: Math.round((b.z0 + b.z1) / 2), along: false, nx: 1, nz: 0 },
        { hx: b.x0, hz: Math.round((b.z0 + b.z1) / 2), along: false, nx: -1, nz: 0 },
      ];
      const tiles = (f) => {
        const ox = f.hx + f.nx;
        const oz = f.hz + f.nz;
        const out = [{ x: ox, z: oz, y: hy, hub: true }];
        for (const [a, v] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
          for (let k = 1; k <= 3; k++) {
            const t = { x: f.along ? ox + a * k : ox, z: f.along ? oz : oz + a * k, y: hy + v * k };
            if (t.y >= Y0 + 2 && !(t.x === sign.x && t.z === sign.z && t.y === sign.y)) out.push(t);
          }
        }
        return out;
      };
      const score = (f) => tiles(f).filter((t) => clear(t.x, t.z)).length;
      const face = faces.find((f) => score(f) === tiles(f).length) || faces.reduce((m, f) => (score(f) > score(m) ? f : m));
      // (Only the hub is built: the sails turn on it, drawn as they go
      // round; see renderer.drawSails.)
      this.put(face.hx, hy, face.hz, B.mill_hub);
      b.sails = { x: face.hx, y: hy, z: face.hz, along: face.along, nx: face.nx, nz: face.nz };
    } else if (b.type === 'glassworks') {
      for (let i = 0; i < 2; i++) {
        const q = this.findFreeNear(b.outside.x, b.outside.z, 4, rng);
        if (!q) break;
        this.put(q.x, Y0, q.z, i ? B.crate : B.sand);
        this.setMask(q.x, q.z, M.DECOR);
      }
    } else if (b.type === 'sporehouse') {
      const q = this.findFreeNear(b.outside.x, b.outside.z, 4, rng);
      if (q) {
        for (let y = Y0; y <= Y0 + 2; y++) this.put(q.x, y, q.z, B.mushroom_stem);
        this.put(q.x, Y0 + 3, q.z, B.glowcap_cap);
        for (const [dx, dz] of DIRS4) if (this.maskAt(q.x + dx, q.z + dz) !== M.BUILD) this.put(q.x + dx, Y0 + 3, q.z + dz, B.glowcap_cap);
        this.setMask(q.x, q.z, M.DECOR);
      }
    } else if (b.type === 'pearlhouse') {
      for (let i = 0; i < 2; i++) {
        const q = this.findFreeNear(b.outside.x, b.outside.z, 4, rng);
        if (!q) break;
        this.put(q.x, Y0, q.z, B.barrel);
        this.setMask(q.x, q.z, M.DECOR);
      }
    }
  }

  exterior(b, rng) {
    const s = this.settlement;
    if (TRADE_BUILDINGS.has(b.type)) this.tradeExterior(b, rng);
    const cond = s.condition;
    const o = b.outside;
    // A hanging sign over the street names the building (or the family home).
    if (cond !== 'abandoned' || rng.chance(0.4)) {
      this.put(o.x, Y0 + 2, o.z, B.hanging_sign, b.door.rot);
      this.signs.push({ x: o.x, y: Y0 + 2, z: o.z, kind: 'building', building: b.id });
    }
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
          const id = rng.pick(plants);
          this.put(x + dx, Y0, z + dz, id, cropMeta(id, 9));
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

  // A fenced graveyard with room to grow: rows of graves separated by
  // walkways, a central aisle and a gate on the south side. Space for extra
  // rows is reserved so the yard can expand as people die.
  cemetery(rng) {
    const s = this.settlement;
    const b = this.bounds;
    const temple = this.buildings.find((q) => q.type === 'temple');
    // Summed-area tables: free tiles, and tiles a graveyard may not touch.
    const Wd = this.W;
    const Dd = this.D;
    const sat = (fn) => {
      const t = new Int32Array((Wd + 1) * (Dd + 1));
      for (let z = 0; z < Dd; z++) {
        for (let x = 0; x < Wd; x++) {
          const v = fn(b.x0 + x, b.z0 + z) ? 1 : 0;
          t[(z + 1) * (Wd + 1) + x + 1] = v + t[z * (Wd + 1) + x + 1] + t[(z + 1) * (Wd + 1) + x] - t[z * (Wd + 1) + x];
        }
      }
      return (x0, z0, x1, z1) => {
        const a = x0 - b.x0;
        const c = z0 - b.z0;
        const e = x1 - b.x0 + 1;
        const f = z1 - b.z0 + 1;
        return t[f * (Wd + 1) + e] - t[c * (Wd + 1) + e] - t[f * (Wd + 1) + a] + t[c * (Wd + 1) + a];
      };
    };
    const free = sat((x, z) => this.maskAt(x, z) === M.FREE || this.maskAt(x, z) === M.YARD);
    const bad = sat((x, z) => {
      const m = this.maskAt(x, z);
      return m === M.BUILD || m === M.WALL || m === M.FIELD;
    });
    const rows = s.type === 'village' ? [3, 2] : s.type === 'town' ? [4, 3, 2] : [5, 4, 3, 2];
    // Wide yards first; a narrow one (two graves a row) squeezes in anywhere.
    const opts = [...rows.map((r) => [7, [1, 2, 4, 5], 3, r]), [5, [1, 3], 2, 3], [5, [1, 3], 2, 2]];
    const p = this.plaza;
    for (const [W, cols, gateDx, maxRows] of opts) {
      const D = 2 * maxRows + 2;
      let best = null;
      for (let z = b.z0 + 2; z + D <= b.z1 - 1; z++) {
        for (let x = b.x0 + 2; x + W <= b.x1 - 1; x++) {
          if (free(x, z, x + W - 1, z + D - 1) !== W * D) continue;
          if (bad(x - 1, z - 1, x + W, z + D) > 0) continue;
          const cx = x + W / 2;
          const cz = z + D / 2;
          let score = temple ? Math.hypot(cx - (temple.x0 + temple.x1) / 2, cz - (temple.z0 + temple.z1) / 2) : -Math.hypot((cx - p.cx) / this.W, (cz - p.cz) / this.D) * 40;
          score += rng.float(0, 4);
          if (!best || score < best.score) best = { x, z, score };
        }
      }
      // Last resort: just outside the edge, on the flattened fringe.
      if (!best && W === 5 && maxRows === 2) {
        const tileOk = (x, z) => {
          if (this.inside(x, z)) {
            const m = this.maskAt(x, z);
            return m === M.FREE || m === M.YARD;
          }
          const c = this.col(x, z);
          return c.h === SURFACE && c.water < 0 && c.flat > 0.6;
        };
        for (let z = b.z0 - D - 2; z <= b.z1 + 2 && !best; z++) {
          for (let x = b.x0 - W - 2; x <= b.x1 + 2 && !best; x++) {
            if (x >= b.x0 + 1 && x + W <= b.x1 - 1 && z >= b.z0 + 1 && z + D <= b.z1 - 1) continue;
            let ok = true;
            for (let dz = 0; dz < D && ok; dz++) for (let dx = 0; dx < W && ok; dx++) ok = tileOk(x + dx, z + dz);
            for (let dz = -1; dz <= D && ok; dz++) {
              for (let dx = -1; dx <= W && ok; dx++) {
                const m = this.maskAt(x + dx, z + dz);
                if (m === M.BUILD || m === M.WALL || m === M.FIELD || m === M.WATER) ok = false;
              }
            }
            if (ok) best = { x, z };
          }
        }
      }
      if (best) {
        const { x, z } = best;
        for (let dz = 0; dz < D; dz++) for (let dx = 0; dx < W; dx++) this.setMask(x + dx, z + dz, M.DECOR);
        const g = { x, z, W, maxRows, rows: 2, gateDx, y: Y0, slots: [] };
        for (let k = 0; k < maxRows; k++) for (const dx of cols) g.slots.push({ x: x + dx, z: z + 1 + 2 * k, row: k, grave: null });
        this.graveyard = g;
        for (const [px, pz, id] of graveyardFence(g)) this.put(px, Y0, pz, id);
        // A few old graves of the settlement's ancestors.
        const old = s.condition === 'abandoned' ? rng.int(5, 8) : rng.int(2, 5);
        const style = s.style;
        for (const slot of rng.shuffle(g.slots.filter((q) => q.row < g.rows)).slice(0, old)) {
          slot.grave = { name: ancestorName(rng, style), died: -rng.int(30, 4000), ancestor: true, epitaph: rng.pick(EPITAPHS) };
          this.put(slot.x, Y0, slot.z, B.gravestone);
        }
        for (const slot of g.slots) if (!slot.grave && slot.row < g.rows && rng.chance(0.3)) this.put(slot.x, Y0, slot.z, B.flower_white);
        this.addSpot(x + g.gateDx, z + 2, 2, ['pray', 'stroll']);
        const sx = x - 1;
        const sz = z + 2 * g.rows + 1;
        if (this.maskAt(sx, sz) === M.FREE || this.maskAt(sx, sz) === M.YARD) {
          this.put(sx, Y0, sz, B.sign, 0);
          this.setMask(sx, sz, M.DECOR);
          this.signs.push({ x: sx, y: Y0, z: sz, kind: 'graveyard' });
        }
        return g;
      }
    }
    return null;
  }

  // The town's name on a sign by the road where it comes in: on open ground
  // beside the road (never on it), kept clear of anything built later.
  entranceSign(pt) {
    const t = this.signSpot(pt);
    if (!t) return null;
    this.put(t.x, Y0, t.z, B.sign, 0);
    this.setMask(t.x, t.z, M.DECOR);
    const sg = { x: t.x, y: Y0, z: t.z, kind: 'entrance', at: { x: pt.x, z: pt.z } };
    this.signs.push(sg);
    return sg;
  }

  // Where the notice board goes: on the square, by a corner if one's free,
  // otherwise the nearest open spot to one, along the edge.
  // The ways across the square, kept clear of anything set down in it: a
  // street that runs on out of the far side carried straight across it
  // (as wide as the street); any other way in (a lane, a path to a door)
  // kept clear two paces in; and a ring two paces wide about the middle
  // (round the great thing that stands there, or the well), that all of
  // them meet. Benches, stalls, wells, boards, bells and a festival's
  // trappings keep off them.
  isLane(x, z) {
    const p = this.plaza;
    if (!p || x < p.x0 || x > p.x1 || z < p.z0 || z > p.z1) return false;
    if (!this.lanes) {
      const L = (this.lanes = new Set());
      const key = (u, v) => v * 65536 + u;
      const road = (u, v) => this.maskAt(u, v) === M.ROAD;
      for (let u = p.x0; u <= p.x1; u++) {
        const n = road(u, p.z0 - 1);
        const s = road(u, p.z1 + 1);
        for (let v = p.z0; v <= p.z1; v++) if ((n && s) || (n && v <= p.z0 + 1) || (s && v >= p.z1 - 1)) L.add(key(u, v));
      }
      for (let v = p.z0; v <= p.z1; v++) {
        const w = road(p.x0 - 1, v);
        const e = road(p.x1 + 1, v);
        for (let u = p.x0; u <= p.x1; u++) if ((w && e) || (w && u <= p.x0 + 1) || (e && u >= p.x1 - 1)) L.add(key(u, v));
      }
      for (let v = p.cz - 3; v <= p.cz + 3; v++) for (let u = p.cx - 3; u <= p.cx + 3; u++) if (Math.max(Math.abs(u - p.cx), Math.abs(v - p.cz)) >= 2) L.add(key(u, v));
    }
    return this.lanes.has(z * 65536 + x);
  }

  boardSpot(ok) {
    const p = this.plaza;
    if (!p) return null;
    const corners = [[p.x0, p.z0], [p.x1, p.z0], [p.x0, p.z1], [p.x1, p.z1]];
    let best = null;
    for (let z = p.z0; z <= p.z1; z++) {
      for (let x = p.x0; x <= p.x1; x++) {
        if (!ok(x, z) || this.isLane(x, z)) continue;
        // Not in the way of a street coming into the square.
        if (DIRS4.some(([ax, az]) => this.maskAt(x + ax, z + az) === M.ROAD)) continue;
        const edge = Math.min(x - p.x0, p.x1 - x, z - p.z0, p.z1 - z);
        const d = Math.min(...corners.map(([cx, cz]) => Math.abs(cx - x) + Math.abs(cz - z))) + edge * 4;
        if (!best || d < best.d) best = { x, z, d };
      }
    }
    return best;
  }

  signSpot(pt, ok = () => true) {
    let best = null;
    for (let r = 1; r <= 3 && !best; r++) {
      for (let dz = -r; dz <= r; dz++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
          const x = pt.x + dx;
          const z = pt.z + dz;
          const m = this.maskAt(x, z);
          if ((m !== M.FREE && m !== M.YARD) || !this.inside(x, z, 1) || !ok(x, z)) continue;
          if (!DIRS4.some(([ax, az]) => this.isRoadTile(x + ax, z + az))) continue;
          // Beside the road, not across the end of it (where it would go on).
          if (this.roadEndAhead(x, z)) continue;
          if (this.signs.some((q) => Math.abs(q.x - x) + Math.abs(q.z - z) < 3)) continue;
          const d = Math.abs(dx) + Math.abs(dz);
          if (!best || d < best.d) best = { x, z, d };
        }
      }
    }
    return best;
  }

  // Is a lot big enough for a building of this kind (give or take a tile:
  // buildings fit themselves to their lot)?
  fits(plot, type) {
    const alongX = !plot.door || plot.door.rot === 0 || plot.door.rot === 2;
    const w = alongX ? plot.x1 - plot.x0 + 1 : plot.z1 - plot.z0 + 1;
    const d = alongX ? plot.z1 - plot.z0 + 1 : plot.x1 - plot.x0 + 1;
    return (SPECS[type] || SPECS.house_s).size.some(([a, b]) => a - 1 <= w && b - 1 <= d);
  }

  // A small building on a bigger lot: its own size, at the street side, the
  // door where the lot's is. The rest of the lot is its yard, room to grow.
  trimLot(plot, type) {
    const [w, d] = (SPECS[type] || SPECS.house_s).size[0];
    const rot = plot.door.rot;
    const alongX = rot === 0 || rot === 2;
    const W = alongX ? plot.x1 - plot.x0 + 1 : plot.z1 - plot.z0 + 1;
    const D = alongX ? plot.z1 - plot.z0 + 1 : plot.x1 - plot.x0 + 1;
    if (W <= w && D <= d) return plot;
    const lo = alongX ? plot.x0 : plot.z0;
    const hi = alongX ? plot.x1 : plot.z1;
    const at = alongX ? plot.door.x : plot.door.z;
    const a0 = Math.max(lo, Math.min(at - Math.floor(w / 2), hi - Math.min(w, W) + 1));
    const r = { ...plot, lot: plot.id };
    if (alongX) {
      r.x0 = a0;
      r.x1 = a0 + Math.min(w, W) - 1;
    } else {
      r.z0 = a0;
      r.z1 = a0 + Math.min(w, W) - 1;
    }
    const dd = Math.min(d, D);
    if (rot === 2) r.z1 = plot.z0 + dd - 1;
    else if (rot === 0) r.z0 = plot.z1 - dd + 1;
    else if (rot === 1) r.x1 = plot.x0 + dd - 1;
    else r.x0 = plot.x1 - dd + 1;
    // What's left of the lot is the house's yard.
    for (let z = plot.z0; z <= plot.z1; z++) for (let x = plot.x0; x <= plot.x1; x++) if (this.inside(x, z) && !(x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1)) this.setMask(x, z, M.YARD);
    return r;
  }

  // The size of lot a kind of building wants (along the street, and deep).
  lotSize(type) {
    const [w, d] = (SPECS[type] || SPECS.house_s).size[0];
    return [Math.max(7, w), Math.max(6, d)];
  }

  // Is this tile straight ahead of the end of a road (in its way, should
  // the road ever be carried on)?
  roadEndAhead(x, z) {
    // A road running up to here from this side (a good way back: across
    // a wide road's width, beside it, doesn't count).
    return DIRS4.some(([dx, dz]) => [1, 2, 3, 4].every((k) => this.isRoadTile(x - k * dx, z - k * dz)));
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
      // Most fields stand ripe; some were sown more recently.
      const ripe = rng.chance(0.65);
      const stageOf = (id) => (CROPS[id] ? cropMeta(id, ripe ? 9 : rng.int(0, CROPS[id].stages - 2)) : 0);
      const field = { x0: x, z0: z, x1: x + w - 1, z1: z + d - 1, spots: [], crop };
      for (let dz = 0; dz < d; dz++) {
        for (let dx = 0; dx < w; dx++) {
          const fx = x + dx;
          const fz = z + dz;
          this.setMask(fx, fz, M.FIELD);
          const edge = dz === 0 || dz === d - 1 || dx === 0 || dx === w - 1;
          const gx = Math.floor(w / 2);
          const gate = dz === d - 1 && dx === gx;
          if (edge && !gate) {
            if (s.condition !== 'poor' || rng.chance(0.7)) this.put(fx, Y0, fz, B.fence);
            continue;
          }
          if (gate) continue;
          // Furrows line up with the gate, and a path runs along inside the
          // gate joining them all, so nobody is ever penned in by the crops.
          const furrow = (((dx - gx) % 3) + 3) % 3 === 0 || dz === d - 2;
          this.put(fx, SURFACE, fz, furrow ? B.path : B.farmland);
          if (!furrow) {
            const id = crop === B.pumpkin && rng.chance(0.6) ? B.carrot_crop : crop;
            this.put(fx, Y0, fz, id, stageOf(id));
          }
          else field.spots.push(this.addSpot(fx, fz, 2, ['farm']));
        }
      }
      if (rng.chance(0.7)) {
        const sx = x + 1 + rng.int(0, w - 3);
        const sz = z + 1;
        if ((((sx - x - Math.floor(w / 2)) % 3) + 3) % 3 !== 0 && d > 3) this.put(sx, Y0, sz, B.scarecrow);
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
        this.put(x, SURFACE, z, this.mats.bridge);
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
        // (Beside a rise tall enough to show bare rock at its foot: under a
        // low one's turf there's only earth. Facing it.)
        if (c.h === SURFACE) {
          for (const [dx, dz] of DIRS4) {
            const n = t.column(x + dx * 3, z + dz * 3, this.ctx, {});
            if (n.water < 0 && (n.h >= SURFACE + 3 || (c.biome === 'mountain' && n.h >= SURFACE + 2))) {
              mine.push({ x, z, face: dirOf(dx, dz) });
              break;
            }
          }
        }
      }
    }
    for (const p of rng.shuffle(chop).slice(0, 6)) this.addSpot(p.x, p.z, 0, ['chop'], { wild: true });
    for (const p of rng.shuffle(mine).slice(0, 4)) this.addSpot(p.x, p.z, p.face ?? 3, ['mine'], { wild: true });
    let traps = 0;
    for (const p of rng.shuffle(hunt).slice(0, 7)) {
      const near = Math.max(b.x0 - p.x, p.x - b.x1, b.z0 - p.z, p.z - b.z1) <= 10;
      const tc = t.column(p.x + 1, p.z, this.ctx, {});
      if (near && traps < 3 && tc.h === SURFACE && tc.water < 0 && this.settlement.condition !== 'abandoned') {
        this.put(p.x + 1, Y0, p.z, B.snare);
        this.addSpot(p.x, p.z, 3, ['hunt', 'trap'], { wild: true, trap: { x: p.x + 1, y: Y0, z: p.z } });
        traps++;
      } else this.addSpot(p.x, p.z, 0, ['hunt', 'stroll'], { wild: true });
    }
  }

  // ------------------------------------------------------------ decoration
  decorate() {
    const s = this.settlement;
    const rng = this.rng.fork('decor');
    const p = this.plaza;
    const cond = s.condition;
    const ruined = cond === 'abandoned';
    // Plaza centerpiece: a well or a statue on Thessa; on the far islands
    // each people's own great thing (see render/pieces.js), standing on
    // nine paces (the eight round it an unseen plinth): the Ashborn's
    // heartfire (cold in a deserted town), the Mirefolk's Old Glowcap, the
    // Stiltfolk's conch fountain (its water drawn like a well's).
    // (Round 68) The far peoples' own: see render/farpieces.js.
    const piece = { ember: B.heartfire, mist: B.great_glowcap, tide: B.conch_fountain, ...FAR_PIECE_BLOCKS }[s.style];
    const room = [];
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) room.push([p.cx + dx, p.cz + dz]);
    if (piece && room.every(([x, z]) => this.maskAt(x, z) === M.PLAZA)) {
      this.put(p.cx, Y0, p.cz, piece, (piece === B.heartfire || piece === B.frost_hearth || piece === B.beacon) && !ruined ? META_STATE : 0);
      for (const [x, z] of room) {
        if (x !== p.cx || z !== p.cz) this.put(x, Y0, z, B.plinth);
        this.setMask(x, z, M.DECOR);
      }
      if (piece === B.conch_fountain || piece === B.salt_obelisk) this.wells.push({ x: p.cx, z: p.cz + 1 });
      else {
        // (And a well of their own at the corner of the square.)
        const corner = [[p.x1, p.z1], [p.x0, p.z1], [p.x1, p.z0], [p.x0, p.z0]].find(([x, z]) => this.maskAt(x, z) === M.PLAZA
          && [[1, 0], [-1, 0], [0, 1], [0, -1]].every(([dx, dz]) => this.maskAt(x + dx, z + dz) !== M.ROAD));
        if (corner) {
          this.put(corner[0], Y0, corner[1], B.well);
          this.wells.push({ x: corner[0], z: corner[1] });
          this.setMask(corner[0], corner[1], M.DECOR);
        }
      }
    } else {
      const center = s.type === 'village' || rng.chance(0.4) ? B.well : B.statue;
      this.put(p.cx, Y0, p.cz, center);
      if (center === B.well) this.wells.push({ x: p.cx, z: p.cz });
      this.setMask(p.cx, p.cz, M.DECOR);
    }
    // (Where people stand about in the square: off its ways across.)
    let gathered = 0;
    for (const [dx, dz] of [[-4, -4], [4, -4], [-4, 4], [4, 4], [-3, -4], [3, 4], [-4, 3], [4, -3]]) {
      const x = p.cx + dx;
      const z = p.cz + dz;
      if (gathered >= 4 || this.maskAt(x, z) !== M.PLAZA || this.isLane(x, z)) continue;
      this.addSpot(x, z, Math.abs(dz) >= Math.abs(dx) ? dirOf(0, -Math.sign(dz)) : dirOf(-Math.sign(dx), 0), ['gossip', 'social', 'play', 'stroll', 'drink', 'music', 'sketch']);
      gathered++;
    }
    if (s.type === 'city') {
      for (const [dx, dz] of [[-6, -5], [6, -5], [-6, 5], [6, 5]]) {
        const x = p.cx + dx;
        const z = p.cz + dz;
        if (this.maskAt(x, z) !== M.PLAZA || this.isLane(x, z)) continue;
        const id = rng.chance(0.5) ? B.well : B.statue;
        this.put(x, Y0, z, id);
        if (id === B.well) this.wells.push({ x, z });
        this.setMask(x, z, M.DECOR);
      }
    }
    // Benches facing the centre, in the corners of the square between its
    // ways across.
    let benches = 0;
    for (const [dx, dz] of [[-3, -4], [3, -4], [-3, 4], [3, 4], [-5, -3], [5, -3], [-5, 3], [5, 3], [-4, -4], [4, 4]]) {
      const x = p.cx + dx;
      const z = p.cz + dz;
      if (benches >= 4 || this.maskAt(x, z) !== M.PLAZA || this.isLane(x, z)) continue;
      benches++;
      const rot = Math.abs(dz) >= Math.abs(dx) ? dirOf(0, -Math.sign(dz)) : dirOf(-Math.sign(dx), 0);
      this.put(x, Y0, z, B.bench, rot);
      this.setMask(x, z, M.DECOR);
      this.addSpot(x, z, rot, ['rest', 'read', 'smoke', 'social', 'sketch', 'music', 'stargaze'], { seat: true });
    }
    // Market stalls along the north and south edges of the plaza (towns &
    // cities): two counters with the stallholder behind, between a pair of
    // low posts carrying a striped canopy just over their head.
    if (s.type !== 'village' && !ruined) {
      const awning = s.civ ? B[s.civ.color.awning] : B.awning_red;
      const colour = [B.awning_red, B.awning_blue, B.awning_yellow, B.awning_green].indexOf(awning);
      // Along the edge of the square, or a row in where streets meet it.
      const spots = [];
      for (const depth of [0, 1]) {
        for (let x = p.x0 + 1; x <= p.x1 - 2; x++) {
          spots.push({ x, z: p.z0 + depth, dz: 1, depth });
          spots.push({ x, z: p.z1 - depth, dz: -1, depth });
        }
      }
      rng.shuffle(spots);
      spots.sort((a, b) => a.depth - b.depth);
      const placed = [];
      let n = 0;
      for (const st of spots) {
        if (n >= (s.type === 'city' ? 4 : 2)) break;
        if (placed.some((q) => q.dz === st.dz && Math.abs(q.x - st.x) < 5)) continue;
        const back = st.z;
        const front = st.z + st.dz;
        const tiles = [[st.x, front + st.dz]];
        for (let dx = -1; dx <= 2; dx++) tiles.push([st.x + dx, back]);
        for (let dx = 0; dx <= 1; dx++) tiles.push([st.x + dx, front]);
        if (!tiles.every(([x, z]) => this.maskAt(x, z) === M.PLAZA)) continue;
        // (Off the ways across the square, and, a row in, with the way
        // behind it open for the stallholder.)
        if (tiles.some(([x, z]) => this.isLane(x, z))) continue;
        // The stallholder must be able to get in from behind, and the posts
        // never stand across a street coming into the square.
        const behind = [0, 1].map((dx) => this.maskAt(st.x + dx, back - st.dz));
        if (st.depth === 0) {
          if ([-1, 2].some((dx) => this.maskAt(st.x + dx, back - st.dz) === M.ROAD)) continue;
          if (!behind.some((m) => m === M.FREE || m === M.YARD || m === M.ROAD)) continue;
        } else if (!behind.some((m) => m === M.PLAZA)) continue;
        placed.push(st);
        // (Facing the customers; the colour above the rotation bits.)
        const canopy = (st.dz > 0 ? 0 : 2) | (Math.max(0, colour) << CANOPY_SHIFT);
        for (let dx = -1; dx <= 2; dx++) this.put(st.x + dx, Y0 + 2, back, B.canopy, canopy);
        for (const dx of [-1, 2]) {
          for (let y = Y0; y < Y0 + 2; y++) this.put(st.x + dx, y, back, B.fence);
          this.setMask(st.x + dx, back, M.DECOR);
        }
        for (let dx = 0; dx <= 1; dx++) {
          this.put(st.x + dx, Y0, front, B.counter);
          this.setMask(st.x + dx, front, M.DECOR);
        }
        const face = st.dz > 0 ? 0 : 2;
        this.addSpot(st.x, back, face, ['market', 'work'], { stall: true });
        this.addSpot(st.x, front + st.dz, face === 0 ? 2 : 0, ['shop', 'social', 'stroll']);
        n++;
      }
    }
    // Notice board: a corner of the square, or the nearest free spot to one.
    const nb = this.boardSpot((x, z) => this.maskAt(x, z) === M.PLAZA && !this.at(x, Y0, z));
    if (nb) {
      this.put(nb.x, Y0, nb.z, B.notice_board);
      this.setMask(nb.x, nb.z, M.DECOR);
      this.signs.push({ x: nb.x, y: Y0, z: nb.z, kind: 'board' });
    }
    if (!ruined) this.placeBells(rng);
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
          if (!adjRoad || this.roadEndAhead(x, z)) continue;
          if ((hash4(x, z, s.seed) % every) !== 0) continue;
          if (this.lamps.some((l) => Math.abs(l.x - x) + Math.abs(l.z - z) < every - 2)) continue;
          // (Each people its own: a brazier on Kharos, a glowcap on a
          // mushroom stalk on the Mirefolk's moors, a torch on a mangrove post
          // where the Stiltfolk live, a lantern on a post elsewhere.)
          if (s.style === 'ember') this.put(x, Y0, z, B.ash_brazier, META_STATE);
          else if (s.style === 'mist') {
            this.put(x, Y0, z, B.mushroom_stem);
            this.put(x, Y0 + 1, z, B.glowcap_cap);
          } else if (s.style === 'tide') {
            this.put(x, Y0, z, B.log_mangrove);
            this.put(x, Y0 + 1, z, B.torch, META_STATE);
          } else {
            this.put(x, Y0, z, B.fence);
            this.put(x, Y0 + 1, z, B.lantern, META_STATE);
          }
          this.setMask(x, z, M.DECOR);
          this.lamps.push({ x, z });
        }
      }
    }
    // A few trees and a park in bigger places.
    const b = this.bounds;
    const treeType = { taiga: 'pine', tundra: 'snowpine', desert: 'palm', savanna: 'acacia', jungle: 'jungle', swamp: 'willow', ashland: 'cinder', cinderwood: 'cinder', geyser: 'cinder', volcano: 'cinder', mangrove: 'mangrove', fungal: 'mushroom', moor: 'birch' }[s.biome] || 'oak';
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
    for (const pt of this.entrances) this.entranceSign(pt);
    if (s.type === 'city') this.finishCityWalls();
  }

  tree(x, z, type, rng) {
    const r = () => rng.next();
    const cells = TREE_BUILDERS[type](r);
    for (const [dx, dy, dz, id] of cells) this.put(x + dx, Y0 + dy, z + dz, id);
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) if (this.maskAt(x + dx, z + dz) === M.FREE) this.setMask(x + dx, z + dz, M.DECOR);
  }

  // Alarm bells: one on the square, and more round a bigger town (spread
  // out, beside the roads) so the watch is never far from one.
  placeBells(rng) {
    const s = this.settlement;
    const p = this.plaza;
    const want = { village: 1, town: 2, city: 4 }[s.type] || 1;
    const put = (x, z) => {
      this.put(x, Y0, z, B.bell);
      this.setMask(x, z, M.DECOR);
      this.bells.push({ x, z });
    };
    for (const [x, z] of [[p.x1, p.z0], [p.x0, p.z1], [p.x1, p.z1]]) {
      if (this.maskAt(x, z) === M.PLAZA && !this.isLane(x, z)) {
        put(x, z);
        break;
      }
    }
    if (this.bells.length >= want) return;
    const b = this.bounds;
    const cands = [];
    for (let z = b.z0 + 2; z < b.z1 - 1; z++) {
      for (let x = b.x0 + 2; x < b.x1 - 1; x++) {
        const m = this.maskAt(x, z);
        if (m !== M.YARD && m !== M.FREE) continue;
        if (!DIRS4.some(([dx, dz]) => this.maskAt(x + dx, z + dz) === M.ROAD)) continue;
        cands.push({ x, z });
      }
    }
    while (this.bells.length < want && cands.length) {
      let best = null;
      for (const c of cands) {
        const d = this.bells.length ? Math.min(...this.bells.map((q) => Math.abs(q.x - c.x) + Math.abs(q.z - c.z))) : rng.next() * 10;
        if (!best || d > best.d) best = { c, d };
      }
      if (!best || (this.bells.length && best.d < 14)) break;
      put(best.c.x, best.c.z);
    }
  }

  // Nothing may stand in front of a door, inside or out: barrels, tables,
  // benches, lamp posts, stalls and wells are moved out of the way.
  clearDoorways() {
    const DX = [0, -1, 0, 1];
    const DZ = [1, 0, -1, 0];
    const inAnyBuilding = (x, z) => this.buildings.some((q) => x >= q.x0 && x <= q.x1 && z >= q.z0 && z <= q.z1);
    const cleared = new Set();
    const clear = (x, z, outside) => {
      if (outside && inAnyBuilding(x, z)) return;
      for (const y of [Y0, Y0 + 1]) {
        const id = this.at(x, y, z);
        if (id === undefined || id === B.air) continue;
        const bl = BLOCKS[id];
        if (bl.render === 'door' || bl.render === 'plant' || bl.render === 'flat') continue;
        if (!bl.solid && bl.render !== 'sprite') continue;
        this.put(x, y, z, B.air);
        cleared.add(`${x},${z}`);
      }
    };
    for (const b of this.buildings) {
      const d = b.door;
      if (!d) continue;
      const ox = DX[d.rot];
      const oz = DZ[d.rot];
      clear(d.x + ox, d.z + oz, true);
      clear(d.x + ox * 2, d.z + oz * 2, true);
      if (b.inside) {
        clear(b.inside.x, b.inside.z, false);
        clear(b.inside.x - ox, b.inside.z - oz, false);
      }
    }
    if (cleared.size) {
      this.spots = this.spots.filter((sp) => !(sp.seat && cleared.has(`${sp.x},${sp.z}`)));
      this.lamps = this.lamps.filter((l) => !cleared.has(`${l.x},${l.z}`));
      this.signs = this.signs.filter((sg) => sg.y !== Y0 || !cleared.has(`${sg.x},${sg.z}`));
    }
    this.doorsCleared = cleared.size;
  }

  paintGround() {
    const b = this.bounds;
    const mats = this.mats;
    for (let z = b.z0; z <= b.z1; z++) {
      for (let x = b.x0; x <= b.x1; x++) {
        let m = this.maskAt(x, z);
        if (m === M.DECOR && this.decorBase) m = this.decorBase.get((z - b.z0) * this.W + (x - b.x0)) ?? m;
        if (m === M.ROAD) this.put(x, SURFACE, z, this.col(x, z).water >= 0 ? mats.bridge : mats.road);
        else if (m === M.PLAZA) this.put(x, SURFACE, z, mats.plaza);
        else if (m === M.BRIDGE && !this.at(x, SURFACE, z)) {
          this.put(x, SURFACE, z, mats.bridge);
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
      case 'rounds':
        return this.buildings.length > 0;
      case 'wild':
        return this.spotsByTag(job === 'lumberjack' ? 'chop' : job === 'miner' ? 'mine' : 'hunt').length > 0;
      case 'guardhouse':
        return true; // guards patrol even without a guardhouse
      case 'stables':
        return true; // (the horses at the hitching post, till there are stables)
      case 'academy':
        return this.buildings.some((b) => (b.type === 'academy' || b.type === 'library' || b.type === 'study') && b.work.length + b.seats.length > 0);
      case 'shop':
        return this.buildings.some((b) => b.type === 'shop') || this.spotsByTag('market').length > 0;
      default:
        // (A noble's at home in a palace as in a manor.)
        return this.buildings.some((b) => (b.type === J.place || (J.place === 'manor' && b.type === 'palace')) && b.work.length + b.seats.length > 0);
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
    // (Researchers study at the library till the academy's built.)
    if (J.place === 'academy' && !this.buildings.some((b) => b.type === 'academy' && !b.underConstruction)) {
      const lib = this.buildings.find((b) => (b.type === 'library' || b.type === 'study') && !b.underConstruction && b.work.length);
      if (lib) return { kind: 'building', building: lib.id };
    }
    if (J.place === 'stables' && !this.buildings.some((b) => b.type === 'stables' && !b.underConstruction)) return { kind: 'tag', tag: 'farm', building: this.buildings.find((b) => b.type === 'barn')?.id ?? null };
    if (J.place === 'dock') return { kind: 'tag', tag: 'fish' };
    if (J.place === 'plaza') return { kind: 'plaza' };
    if (J.place === 'rounds') return { kind: 'rounds' };
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

const EPITAPHS = ['Beloved by all', 'Gone but not forgotten', 'At rest at last', 'Loved and missed', 'A true friend', 'Worked hard, rests well', 'Until we meet again', 'Forever in our hearts'];
const ANCESTOR_FIRST = {
  vale: ['Aldo', 'Berta', 'Corin', 'Dela', 'Emrys', 'Fenna', 'Galt', 'Hesse', 'Ines', 'Jorn'],
  north: ['Asgrim', 'Brynja', 'Egil', 'Frida', 'Halvar', 'Ingrid', 'Ketil', 'Sigrun'],
  sun: ['Amun', 'Bastet', 'Farid', 'Hanan', 'Idris', 'Layla', 'Nabil', 'Samira'],
  wild: ['Ayo', 'Chidi', 'Ekon', 'Imani', 'Kofi', 'Nia', 'Tendai', 'Zola'],
  high: ['Balin', 'Dagna', 'Durin', 'Helga', 'Thrain', 'Brunhild', 'Gimra', 'Orsik'],
  ember: ['Azkar', 'Brasa', 'Cendrik', 'Hestra', 'Ignar', 'Pyrrha', 'Tephros', 'Vulka'],
  mist: ['Aelwen', 'Bryn', 'Gloamwyn', 'Heth', 'Lune', 'Myrrin', 'Sorrel', 'Vell'],
  tide: ['Ahi', 'Kailani', 'Makoa', 'Nalu', 'Pelani', 'Reva', 'Tasi', 'Wahine'],
};
Object.assign(ANCESTOR_FIRST, farTable('founders'));
function ancestorName(rng, style) {
  return `${rng.pick(ANCESTOR_FIRST[style] || ANCESTOR_FIRST.vale)} ${rng.pick(['the Elder', 'the Founder', 'Oakheart', 'Stonebrook', 'Ashford', 'Millward', 'Greenhill', 'of the Old Road', 'Hearthkeeper', 'Longstride'])}`;
}

// Fence blocks for a graveyard with `g.rows` rows of graves: [x, z, id].
// Air entries clear fences left over from a smaller yard.
export function graveyardFence(g, prevRows = null) {
  const out = [];
  const { x, z, W } = g;
  const south = z + 2 * g.rows + 1;
  if (prevRows !== null) {
    const oldSouth = z + 2 * prevRows + 1;
    for (let dx = 1; dx < W - 1; dx++) out.push([x + dx, oldSouth, B.air]);
  }
  for (let dx = 0; dx < W; dx++) out.push([x + dx, z, B.fence]);
  for (let dz = 1; dz < south - z; dz++) {
    out.push([x, z + dz, B.fence]);
    out.push([x + W - 1, z + dz, B.fence]);
  }
  for (let dx = 0; dx < W; dx++) if (dx !== g.gateDx) out.push([x + dx, south, B.fence]);
  return out;
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
