// (Round 71) The ancient places: older than the old places, older than
// the Kavorent's spires, two on each of the great continents, each the
// lair of one of the evolved masters (see entities/evolved.js) and like
// nowhere else, down to its rooms (see dungeongen.js, the kits below) and
// what its halls do to you (see game/ancient.js).
//   Velmarch:
//     the Athanor, the furnace-vault of the Divine Alchemist: gilded
//       marble and glass, transmutation circles that turn under your feet,
//       stills breathing poison, pools of quicksilver, crucibles of fire,
//       vats with things growing in them;
//     the Hall of the Last Champion, where the Hero waits: a hero's barrow
//       of mossed stone, trial-halls that seal and fill with the dead,
//       armouries whose armour gets up, statues that swing their swords,
//       rows of pendulum blades, chapels;
//   Ostria:
//     the Sundered Reach, the Rift Crawler's: black glass and void-stone,
//       rifts that open in pairs and take you through, the floor cracked
//       to the nothing under it and spikes coming up out of the cracks,
//       halls where your own steps come back for you, wells that drag you
//       down;
//     the Gullet of the World, the Alinelidan's: earth and mud and bone,
//       pools of acid, clutches of eggs that hatch as you pass, halls that
//       quake and fall in, tunnels it dug.
import { B, META_STATE } from './blocks.js';
import { RNG, hash4 } from '../util/rng.js';
import { MAP_W, MAP_H, REGION_W, REGION_D } from '../config.js';

// The kinds of ancient place (as the far lands' own: see fardeep.js
// FAR_DTYPES), each with its one master.
export const ANCIENT_DTYPES = {
  athanor: {
    name: 'Athanor', isle: 'velmarch', ancient: true, wall: B.marble, floor: B.tile_blue, alt: B.kiln_tile, beam: null, regions: [2, 2], floors: [3, 3],
    kits: ['circle', 'distillery', 'mercury', 'crucibles', 'library', 'observatory', 'circle', 'vats', 'salt_garden', 'furnace', 'trap', 'treasure', 'guard', 'distillery', 'observatory'],
    // (Round 73: its own, and nothing borrowed: see entities/ancientmobs.js.)
    mobs: [['quicksilver_homunculus', 3], ['alembic_golem', 2], ['sulphur_imp', 3]], only: true,
    bosses: ['divine_alchemist'], torches: 0.3,
    shapes: { octagon: 3, round: 2, hex: 2, rect: 2, star: 1 }, wiggle: 0.2, decor: [['crucible', 2], ['candles', 3], ['glass_lamp', 2], ['statue', 1], ['marble_column', 1], ['bookshelf', 1]],
    dark: [0.1, 0.08, 0.12], motes: ['#ffd070', '#c8a0ff', '#80e8ff'], ambient: ['drone', 'drip', 'chime', 'hum'],
    loot: [['gem', 1, 2, 0.35], ['gold_ingot', 1, 2, 0.35], ['frost_crystal', 1, 2, 0.25], ['old_coin', 3, 8, 0.6]],
  },
  champion: {
    name: 'Hall of the Last Champion', isle: 'velmarch', ancient: true, wall: B.mossy_bricks, floor: B.flagstone, alt: B.cracked_bricks, beam: B.planks_dark, regions: [2, 2], floors: [3, 3],
    kits: ['trial', 'armory', 'statues', 'blades', 'chapel', 'tomb', 'arena', 'burial', 'reliquary', 'trial', 'trap', 'treasure', 'guard', 'statues', 'tomb'],
    mobs: [['oathbound_squire', 4], ['trial_sentinel', 2], ['banner_wraith', 2]], only: true,
    bosses: ['the_hero'], torches: 0.35,
    shapes: { rect: 3, octagon: 2, cross: 2, round: 1 }, wiggle: 0, decor: [['statue', 3], ['war_banner', 3], ['weapon_rack', 2], ['candles', 2], ['skull_pile', 1], ['triumph_column', 1], ['hanging_chains', 1]],
    dark: [0.09, 0.08, 0.07], motes: ['#ffe8a0', '#c8c8c8'], ambient: ['march', 'whisper', 'chains', 'drone'],
    loot: [['old_coin', 3, 8, 0.6], ['iron_ingot', 1, 3, 0.4], ['gold_ingot', 1, 1, 0.25], ['gem', 1, 1, 0.2]],
  },
  rift: {
    name: 'Sundered Reach', isle: 'ostria', ancient: true, wall: B.obsidian, floor: B.rock_void, alt: B.blight_floor, beam: null, regions: [2, 2], floors: [3, 3],
    kits: ['portals', 'fracture', 'echo', 'shards', 'shardstorm', 'portals', 'gravity', 'flicker', 'trap', 'treasure', 'guard', 'fracture', 'shardstorm', 'flicker'],
    mobs: [['void_stalker', 3], ['shard_mote', 3], ['echo_shade', 3]], only: true,
    bosses: ['rift_crawler'], torches: 0.05,
    shapes: { star: 2, diamond: 2, crescent: 2, zigzag: 1, teeth: 1, cave: 2 }, wiggle: 0.6, decor: [['glow_crystal', 4], ['void_bloom', 2], ['eye_stalk', 1], ['tendril', 2], ['obsidian', 1]],
    dark: [0.06, 0.04, 0.1], motes: ['#c8a0ff', '#5ad8f0', '#ffffff'], ambient: ['hum', 'whisper', 'pulse', 'drone'],
    loot: [['gem', 1, 3, 0.4], ['frost_crystal', 1, 2, 0.3], ['old_coin', 3, 8, 0.6], ['gold_ingot', 1, 1, 0.2]],
  },
  gullet: {
    name: 'Gullet of the World', isle: 'ostria', ancient: true, wall: B.cave_rock, floor: B.mud, alt: B.bone_sand, beam: B.log_acacia, regions: [2, 2], floors: [3, 3],
    kits: ['acid', 'eggs', 'quake', 'bones', 'leech_pool', 'acid', 'tunnel', 'throat', 'nest', 'trap', 'treasure', 'guard', 'eggs', 'throat'],
    mobs: [['gut_leech', 3], ['acid_spitter', 2], ['maw_larva', 4]], only: true,
    bosses: ['alinelidan'], torches: 0.05,
    shapes: { cave: 5, round: 3 }, wiggle: 1.6, decor: [['bones', 4], ['roots', 2], ['rubble', 2], ['skull_pile', 1], ['stalagmite', 2], ['whale_rib', 1]],
    dark: [0.07, 0.06, 0.04], motes: ['#c8e070', '#a07a50'], ambient: ['heart', 'rumble', 'drip', 'skitter'],
    loot: [['bone', 3, 6, 0.6], ['gem', 1, 2, 0.3], ['gold_ore', 1, 3, 0.35], ['old_coin', 3, 8, 0.5]],
  },
};
export const ANCIENT_TYPES = Object.keys(ANCIENT_DTYPES);
export const isAncient = (type) => !!ANCIENT_DTYPES[type];
// Its master (one each).
export const ANCIENT_BOSSES = { athanor: 'divine_alchemist', champion: 'the_hero', rift: 'rift_crawler', gullet: 'alinelidan' };
// Which great land each is on.
export const ANCIENT_LANDS = { velmarch: ['athanor', 'champion'], ostria: ['rift', 'gullet'] };
// (As hard as the hardest of the old places: and then their masters.)
export const ANCIENT_LEVEL = 4;

// What each is called after, and how the folk of its land speak of it.
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
export const ANCIENT_LORE = {
  athanor: {
    who: ['the Divine Alchemist', 'the First Transmuter', 'the Gilded Eye', 'the Twelve-Handed One'],
    name: (who) => `the Athanor of ${who}`,
    text: (y, who, where, tn) => `Before the emperors, before the first legion marched, ${who} built a furnace under the hills ${where} to make gold of lead and gods of men. In ${y} the hills there glowed for a night and a day, and ${tn ? `the shepherds of ${tn}` : 'the shepherds'} found their flocks turned to salt.`,
    short: (who, where) => `${cap(who)}'s furnace-vault lies under the hills ${where}; whatever goes in comes out something else, if it comes out.`,
    rumour: (d, where) => [`${cap(d.name)}, ${where}. They say it's still working: the great work, a thousand years in the making. They say it needs one more ingredient.`, `Don't drink from the springs ${where}. They run silver sometimes. ${d.origin.short}`],
  },
  champion: {
    who: ['the Last Champion', 'the Hero of the Nine Wars', 'the Unbroken', 'the Saviour of Velmarch'],
    name: (who) => `the Hall of ${who}`,
    text: (y, who, where, tn) => `${cap(who)} saved the world three times, and the fourth time the thing he fought cursed him as it died. In ${y} his companions sealed him in his own barrow ${where} while he could still beg them to. ${tn ? `${tn} still lays` : 'The folk still lay'} flowers at the door, and run.`,
    short: (who, where) => `${cap(who)} was sealed in his own barrow ${where}, cursed, while he could still ask them to.`,
    rumour: (d, where) => [`${cap(d.name)}, ${where}. They say he's still in there, and still himself, some of the time.`, `My grandfather's grandfather fought beside the Champion. He said he was the kindest man he ever knew. ${d.origin.short}`],
  },
  rift: {
    who: ['the Rift Crawler', 'the Thing Between', 'the Long-Legged Dark', 'the Sunderer'],
    name: (who) => `the Reach of ${who}`,
    text: (y, who, where, tn) => `In ${y} the sky over the red mesas ${where} split like a seam and something climbed down out of it on long legs. ${tn ? `The elders of ${tn}` : 'The elders'} say it cut a way under the earth, and that it can be in two places at once, and that it remembers what it was a moment ago and goes back to it.`,
    short: (who, where) => `Something came down out of a split in the sky ${where}, and dug in: ${who}.`,
    rumour: (d, where) => [`${cap(d.name)}, ${where}. Go in and you'll come out before you went in. Or after. Or not at all.`, `There are holes in the air ${where}, at night, if you look sideways. ${d.origin.short}`],
  },
  gullet: {
    who: ['the Alinelidan', 'the World-Worm', 'the Mother of Leeches', 'the Mouth Under the Mountain'],
    name: (who) => `the Gullet of ${who}`,
    text: (y, who, where, tn) => `${cap(who)} ate the first kingdom of Ostria whole, its cities and its fields and its river, and went down into the earth ${where} to sleep it off. In ${y} the ground there opened like a mouth. ${tn ? `${tn} feels it` : 'The land feels it'} turn over in its sleep.`,
    short: (who, where) => `${cap(who)} sleeps in the earth ${where}, full of a whole kingdom.`,
    rumour: (d, where) => [`${cap(d.name)}, ${where}. The ground's warm there, and it breathes. Leeches as long as your arm.`, `Whatever it touched it learned. It won't fall for the same trick twice, they say. ${d.origin.short}`],
  },
};

// ------------------------------------------------------------ where
// Two on each great continent, deep in it, far from its towns and from the
// other old places, and far from each other. (Their own stream, after
// everything else: a world made before them keeps every place it had, and
// gains these at the end.)
export function ancientSites(ow, sites, farFromTowns, farFromSites) {
  const rng = new RNG(hash4(ow.seed, 0xa7c1));
  for (const L of ow.lands || []) {
    const kinds = ANCIENT_LANDS[L.key];
    if (!kinds || L.kind !== 'continent') continue;
    const land = [];
    for (let cz = Math.max(1, Math.floor(L.z0 / REGION_D)); cz <= Math.min(MAP_H - 2, Math.ceil(L.z1 / REGION_D)); cz += 2) {
      for (let cx = Math.max(1, Math.floor(L.x0 / REGION_W)); cx <= Math.min(MAP_W - 2, Math.ceil(L.x1 / REGION_W)); cx += 2) {
        const c = ow.cell(cx, cz);
        if (c && c.island === L.key && c.biome !== 'ocean' && c.biome !== 'beach' && !c.lake && c.settlement === null && !c.bridge && c.cont > 0.2 && c.mountainness <= 0.55) land.push(c);
      }
    }
    // (Deepest in the land first: the furthest from its coast.)
    land.sort((a, b) => b.cont - a.cont + (rng.float(-0.05, 0.05)));
    const mine = [];
    for (const kind of kinds) {
      let put = null;
      for (const gap of [5, 3.6, 2.4]) {
        for (const c of land) {
          if (!farFromTowns(c, gap - 1) || !farFromSites(c, gap)) continue;
          if (mine.some((q) => Math.hypot(q.cx - c.cx, (q.cz - c.cz) * 1.4) < 18)) continue;
          put = c;
          break;
        }
        if (put) break;
      }
      // (Wherever there's room at all, as a last resort.)
      if (!put) put = land.find((c) => farFromSites(c, 1.5) && !mine.includes(c)) || null;
      if (!put) continue;
      const s = { id: sites.length, type: kind, cx: put.cx, cz: put.cz, island: L.key, seed: hash4(ow.seed, put.cx, put.cz, sites.length, 0xa7c), far: true, ancient: true, reach: GATE_REACH };
      sites.push(s);
      mine.push(put);
    }
  }
}

// ------------------------------------------------------------ the way in
// What stands over each, above ground (see sites.js FAR_GATE): `put(dx,
// y, dz, id, meta)` from its spot, `clear(r)` the air over it, `h` the
// ground, `state` what's happened to it (its master beaten: its fires
// out, its light gone). Each as grand as what's under it: a precinct
// thirty paces across, laid on a foundation of its own stone wherever the
// ground falls away, and the camera drawn back to take it in as you come
// (see Game.placeNearness). The door faces south (+dz); the way up to it
// runs from there.
// (Round 72: made over, each four times the size it was.)
export const GATE_REACH = 18;
const TAU = Math.PI * 2;
// A tile of ground at `h`, with its foundation under it.
function ground(put, h, dx, dz, id, under = B.stone, depth = 3) {
  put(dx, h, dz, id);
  for (let y = h - 1; y >= h - depth; y--) put(dx, y, dz, under);
}
// The shape of the Sundered Reach's rift: a seam torn across the ground
// from west to east, jagged, narrow at its ends and widest in the middle
// (where it opens on a basin, two deep, the way down at the bottom of
// it); the ground either side of it burnt black for paces, and cracked,
// the cracks running out from the seam (`fissures`: polylines, in paces
// from the site, which the renderer draws, lit from below). (Shared with
// the renderer, which draws the void in it: see render/ancientfx.js.)
const RIFT_SHAPES = new Map();
export function riftShape(seed) {
  let S = RIFT_SHAPES.get(seed);
  if (S) return S;
  const rng = new RNG(hash4(seed, 0x51f7));
  const pts = [];
  let z = rng.float(-2, 2);
  for (let x = -16; x <= 16; x += 4) {
    z += rng.float(-2.8, 2.8);
    z = Math.max(-7, Math.min(7, z));
    pts.push({ x, z: Math.abs(x) <= 4 ? z * 0.3 : z });
  }
  // Side cracks off it (sunk too), and the fissures in the ground round it.
  const cracks = [];
  for (let k = 0; k < 3; k++) {
    const i = rng.int(1, pts.length - 2);
    const a = rng.float(0.6, 1.3) * (rng.chance(0.5) ? 1 : -1);
    cracks.push({ x0: pts[i].x, z0: pts[i].z, x1: pts[i].x + Math.cos(a) * rng.float(4, 7), z1: pts[i].z + Math.sin(a) * rng.float(4, 7) * (rng.chance(0.5) ? 1 : -1) });
  }
  const fissures = [];
  for (let k = 0; k < 14; k++) {
    const i = rng.int(0, pts.length - 2);
    const t = rng.float(0, 1);
    const sx = pts[i].x + (pts[i + 1].x - pts[i].x) * t;
    const sz = pts[i].z + (pts[i + 1].z - pts[i].z) * t;
    const side = rng.chance(0.5) ? 1 : -1;
    let a = side * (Math.PI / 2) + rng.float(-0.9, 0.9);
    let x = sx;
    let zz = sz;
    const line = [{ x, z: zz }];
    const n = rng.int(3, 7);
    for (let j = 0; j < n; j++) {
      const len = rng.float(1, 2.2);
      x += Math.cos(a) * len;
      zz += Math.sin(a) * len;
      if (Math.hypot(x, zz) > 17) break;
      line.push({ x, z: zz });
      a += rng.float(-0.8, 0.8);
      // (A branch off it, now and then.)
      if (j > 0 && rng.chance(0.3)) {
        const ba = a + rng.float(0.6, 1.4) * (rng.chance(0.5) ? 1 : -1);
        const bl = [{ x, z: zz }];
        let bx = x;
        let bz = zz;
        for (let q = 0; q < rng.int(1, 3); q++) {
          bx += Math.cos(ba) * rng.float(0.8, 1.8);
          bz += Math.sin(ba) * rng.float(0.8, 1.8);
          bl.push({ x: bx, z: bz });
        }
        fissures.push({ pts: bl, phase: rng.float(0, 6.28), w: 1 });
      }
    }
    fissures.push({ pts: line, phase: rng.float(0, 6.28), w: 2 });
  }
  const tiles = new Map();
  const key = (x, z) => `${x},${z}`;
  const segDist = (px, pz, ax, az, bx, bz) => {
    const vx = bx - ax;
    const vz = bz - az;
    const L = vx * vx + vz * vz || 1;
    const t = Math.max(0, Math.min(1, ((px - ax) * vx + (pz - az) * vz) / L));
    return { d: Math.hypot(px - ax - vx * t, pz - az - vz * t), t };
  };
  for (let dz = -17; dz <= 17; dz++) {
    for (let dx = -17; dx <= 17; dx++) {
      let best = Infinity;
      let w = 1;
      for (let i = 0; i + 1 < pts.length; i++) {
        const { d, t } = segDist(dx, dz, pts[i].x, pts[i].z, pts[i + 1].x, pts[i + 1].z);
        if (d < best) {
          best = d;
          const k = (i + t) / (pts.length - 1);
          w = 0.45 + 2.1 * Math.sin(Math.PI * k) ** 1.3;
        }
      }
      for (const c of cracks) {
        const { d, t } = segDist(dx, dz, c.x0, c.z0, c.x1, c.z1);
        const cw = 0.9 - t * 0.6;
        if (d < best - 0.2 && d <= cw) {
          best = d;
          w = cw;
        }
      }
      const r0 = Math.hypot(dx, dz * 1.1);
      if (r0 < 3.9) {
        tiles.set(key(dx, dz), { dx, dz, depth: 2 });
        continue;
      }
      if (best <= w) tiles.set(key(dx, dz), { dx, dz, depth: best <= w * 0.5 && w > 1.4 ? 2 : 1 });
      else if (best <= w + 4.5 && r0 <= 17.5) tiles.set(key(dx, dz), { dx, dz, depth: 0, edge: (w + 4.5 - best) / 4.5 });
    }
  }
  const list = [...tiles.values()];
  S = { pts, cracks, fissures, tiles, list, sunk: list.filter((q) => q.depth > 0), edge: list.filter((q) => q.depth === 0) };
  RIFT_SHAPES.set(seed, S);
  return S;
}

export const ANCIENT_GATE = {
  // The Athanor: a precinct of marble thirty paces across, its floor laid
  // in rings of blue glaze and gold; in its midst a drum of marble, ringed
  // with columns, glass lamps burning on them, and over it a dome of
  // glass ribbed with copper, the great alembic's neck going up out of its
  // crown and bending over, its bulb hung over the door, smoking; four
  // towers at the corners; braziers down the avenue to its doors of
  // beaten gold.
  athanor(put, clear, h, rng, state = {}) {
    clear(16);
    const beaten = !!state.cleared;
    const C = { x: 0, z: -4 };
    const lit = beaten ? 0 : META_STATE;
    // The precinct floor.
    for (let dz = -16; dz <= 16; dz++) {
      for (let dx = -16; dx <= 16; dx++) {
        const d = Math.hypot(dx - C.x, (dz - C.z) * 1.15);
        if (d > 14.6) {
          if (Math.hypot(dx, dz) <= 16 && rng.chance(0.35)) put(dx, h, dz, rng.chance(0.5) ? B.salt_crust : B.grass_gold);
          continue;
        }
        const ring = Math.floor(d);
        const id = d < 1.6 ? B.kiln_tile : ring % 4 === 0 ? B.tile_blue : ring % 7 === 3 ? B.gilt_trim : B.marble;
        ground(put, h, dx, dz, id, B.marble);
      }
    }
    // The drum, and its ring of columns.
    for (let dz = -16; dz <= 16; dz++) {
      for (let dx = -16; dx <= 16; dx++) {
        const d = Math.hypot(dx - C.x, (dz - C.z) * 1.08);
        if (d < 8.7 || d > 9.7) continue;
        const a = Math.atan2((dz - C.z) * 1.08, dx - C.x);
        const k = Math.round((a / TAU) * 24);
        const col = ((k % 2) + 2) % 2 === 0;
        // (The doorway, south.)
        if (dz > C.z && Math.abs(dx) <= 1 && dz >= C.z + 8) continue;
        if (col) {
          for (let y = h + 1; y <= h + 5; y++) put(dx, y, dz, B.marble_column);
          put(dx, h + 6, dz, B.glass_lamp, 0);
        } else {
          for (let y = h + 1; y <= h + 4; y++) put(dx, y, dz, y >= h + 2 && y <= h + 3 && ((k % 4) + 4) % 4 === 1 ? B.glass : B.marble);
          put(dx, h + 5, dz, B.gilt_trim);
        }
      }
    }
    // The doorway: gilt posts, a lintel, the doors.
    const dz0 = C.z + 9;
    for (const dx of [-2, 2]) for (let y = h + 1; y <= h + 5; y++) put(dx, y, dz0, y === h + 5 ? B.gilt_trim : B.marble_column);
    for (let dx = -1; dx <= 1; dx++) {
      put(dx, h + 4, dz0, B.gilt_trim);
      put(dx, h + 5, dz0, B.marble);
      put(dx, h + 3, dz0, B.marble);
    }
    put(0, h + 1, dz0, B.athanor_door);
    put(0, h + 2, dz0, B.air);
    for (const dx of [-1, 1]) {
      put(dx, h + 1, dz0, B.marble);
      put(dx, h + 2, dz0, B.glass);
    }
    // The dome: glass ribbed with copper, course by course, capped.
    for (let k = 1; k <= 6; k++) {
      const y = h + 5 + k;
      const rr = 9.4 * Math.sqrt(Math.max(0, 1 - (k / 6.6) ** 2));
      for (let dz = -16; dz <= 16; dz++) {
        for (let dx = -16; dx <= 16; dx++) {
          const d = Math.hypot(dx - C.x, (dz - C.z) * 1.08);
          const inner = k === 6 ? 0 : rr - 1.1;
          if (d > rr + 0.2 || d < inner) continue;
          const a = Math.atan2((dz - C.z) * 1.08, dx - C.x);
          const rib = Math.abs(((a / (TAU / 8)) % 1 + 1) % 1 - 0.5) < 0.06 || Math.abs(d - rr) > 0.75;
          put(dx, y, dz, rib ? B.copper_roof : B.glass);
        }
      }
    }
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) put(dx + C.x, h + 12, dz + C.z, B.gilt_trim);
    // The alembic: its neck up out of the crown and over, its bulb hung
    // over the doors.
    for (let y = h + 13; y <= h + 19; y++) put(C.x, y, C.z, B.copper_sheath);
    const neck = [[0, 20, -3], [0, 20, -2], [0, 20, -1], [0, 19, 0], [0, 18, 1], [0, 17, 2]];
    for (const [dx, y, dz] of neck) put(dx, h + y, dz, B.copper_sheath);
    for (let dz = 2; dz <= 4; dz++) for (let dx = -1; dx <= 1; dx++) for (let y = h + 14; y <= h + 16; y++) {
      if (Math.abs(dx) + Math.abs(dz - 3) + Math.abs(y - h - 15) > 2) continue;
      put(dx, y, dz, B.glass);
    }
    put(0, h + 15, 3, B.glass_lamp, 0);
    // The four towers.
    for (const [tx, tz] of [[-12, C.z - 7], [12, C.z - 7], [-12, C.z + 7], [12, C.z + 7]]) {
      for (let y = h + 1; y <= h + 8; y++) put(tx, y, tz, B.marble_column);
      put(tx, h + 9, tz, B.glass_lamp, 0);
      for (const [ox, oz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) put(tx + ox, h + 1, tz + oz, B.gilt_trim);
      put(tx + (tx < 0 ? 1 : -1), h + 2, tz + (tz < C.z ? 1 : -1), B.brazier, lit);
    }
    // The avenue: braziers and columns down it to the doors, statues
    // either side of them.
    for (let dz = dz0 + 1; dz <= 16; dz++) {
      for (let dx = -3; dx <= 3; dx++) ground(put, h, dx, dz, Math.abs(dx) === 3 ? B.gilt_trim : (dz % 3 === 0 ? B.tile_blue : B.marble), B.marble);
    }
    for (const dz of [dz0 + 2, dz0 + 5, dz0 + 8]) for (const dx of [-3, 3]) put(dx, h + 1, dz, B.brazier, lit);
    for (const dz of [dz0 + 3, dz0 + 7]) for (const dx of [-5, 5]) {
      ground(put, h, dx, dz, B.marble, B.marble);
      put(dx, h + 1, dz, B.marble_column);
      put(dx, h + 2, dz, B.marble_column);
      put(dx, h + 3, dz, B.glass_lamp, 0);
    }
    for (const dx of [-4, 4]) {
      put(dx, h + 1, dz0 + 1, B.statue, 2);
      put(dx, h + 2, dz0 + 1, B.air);
    }
    for (const dx of [-2, 2]) put(dx, h + 1, dz0 + 1, B.candles);
  },

  // The Hall of the Last Champion: a barrow as big as a hill, grassed
  // over, a colossus of him on its summit with his sword raised, his
  // companions' banners round it; its south face cut away for a wall of
  // mossed stone with his door in it, triumphal columns and statues of
  // his companions before it; a ring of standing stones round the mound
  // with broken swords stood among them; an avenue of flagstones up to the
  // door, braziers along it, and the flowers the folk still leave there.
  champion(put, clear, h, rng, state = {}) {
    clear(16);
    const beaten = !!state.cleared;
    const lit = beaten ? 0 : META_STATE;
    const C = { x: 0, z: -7 };
    const menhir = B.standing_stone;
    // The mound.
    for (let dz = -16; dz <= 16; dz++) {
      for (let dx = -16; dx <= 16; dx++) {
        const d = Math.hypot(dx / 15.5, (dz - C.z) / 10.5);
        if (d > 1) continue;
        // (Cut away before its face, for the forecourt.)
        if (dz >= 1 && Math.abs(dx) <= 7) {
          ground(put, h, dx, dz, B.flagstone, B.barrow_earth);
          continue;
        }
        const top = h + Math.max(1, Math.round((1 - d * d) * 7));
        for (let y = h - 2; y <= top; y++) put(dx, y, dz, y === top ? B.grass : B.barrow_earth);
        if (d > 0.55 && rng.chance(0.05)) put(dx, top, dz, B.barrow_stone);
      }
    }
    // Its face: a wall of mossed stone across the south of it, the door
    // in the middle, a carved lintel, banners along the top.
    for (let dx = -7; dx <= 7; dx++) {
      for (let y = h + 1; y <= h + 5; y++) {
        const id = y === h + 5 ? B.cracked_bricks : (dx + y) % 5 === 0 ? B.cracked_bricks : B.mossy_bricks;
        put(dx, y, 0, id);
      }
      if (dx % 2 === 0 && Math.abs(dx) <= 6) put(dx, h + 6, 0, B.war_banner, 2);
    }
    for (const dx of [-7, 7]) for (let y = h + 1; y <= h + 6; y++) put(dx, y, 0, B.mossy_bricks);
    put(0, h + 1, 0, B.champion_door);
    put(0, h + 2, 0, B.air);
    for (const dx of [-1, 1]) {
      put(dx, h + 1, 0, B.marble_column);
      put(dx, h + 2, 0, B.marble_column);
    }
    for (let dx = -1; dx <= 1; dx++) put(dx, h + 3, 0, B.gilt_trim);
    // (Round 73) A brazier either side of the doors, burning for him while
    // he's unbeaten, and a hanging chain of his to each side of the lintel.
    for (const dx of [-3, 3]) put(dx, h + 1, 1, B.brazier, lit);
    for (const dx of [-2, 2]) put(dx, h + 4, 0, B.hanging_chains);
    // His companions before the door: statues on plinths, triumphal
    // columns beyond them.
    for (const dx of [-3, 3]) {
      put(dx, h + 1, 1, B.mossy_bricks);
      put(dx, h + 2, 1, B.statue, 2);
      put(dx, h + 3, 1, B.air);
    }
    for (const dx of [-6, 6]) {
      put(dx, h + 1, 2, B.triumph_column);
      put(dx, h + 2, 2, B.air);
    }
    // The colossus on the summit, and the banners round him.
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) put(dx + C.x, h + 8, dz + C.z, B.mossy_bricks);
    put(C.x, h + 9, C.z, B.statue, 2);
    put(C.x, h + 10, C.z, B.air);
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * TAU;
      const dx = C.x + Math.round(Math.cos(a) * 3.4);
      const dz = C.z + Math.round(Math.sin(a) * 2.6);
      const d = Math.hypot(dx / 15.5, (dz - C.z) / 10.5);
      const top = h + Math.max(1, Math.round((1 - d * d) * 7));
      put(dx, top + 1, dz, B.war_banner, k % 4);
    }
    // The ring of standing stones, and the broken swords among them.
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * TAU + 0.2;
      const dx = Math.round(Math.cos(a) * 16.2);
      const dz = Math.round(C.z + Math.sin(a) * 11.4);
      if (dz >= 1 && Math.abs(dx) <= 5) continue;
      if (Math.abs(dx) > 16 || Math.abs(dz) > 16) continue;
      ground(put, h, dx, dz, B.gravel, B.stone, 2);
      if (k % 2 === 0) {
        put(dx, h + 1, dz, menhir);
        put(dx, h + 2, dz, B.air);
      } else put(dx, h + 1, dz, B.weapon_rack, rng.int(0, 3));
    }
    // The avenue up to it: flagstones, braziers, flowers.
    for (let dz = 1; dz <= 16; dz++) {
      for (let dx = -3; dx <= 3; dx++) ground(put, h, dx, dz, Math.abs(dx) === 3 ? B.cracked_bricks : B.flagstone, B.stone);
      if (dz % 4 === 2 && dz > 2) for (const dx of [-3, 3]) put(dx, h + 1, dz, B.brazier, lit);
    }
    for (let i = 0; i < 26; i++) {
      const dx = rng.int(-7, 7);
      const dz = rng.int(1, 9);
      if (Math.abs(dx) <= 3) continue;
      put(dx, h + 1, dz, [B.flower_red, B.flower_white, B.flower_yellow][rng.int(0, 2)]);
    }
    for (const dx of [-2, 2]) put(dx, h + 1, 1, B.candles);
  },

  // The Sundered Reach: no door and no wall, only the ground torn open: a
  // rift across it thirty paces long, jagged, its floor fallen away to
  // the void-stone under it, deepest in the middle where it opens on a
  // basin, and the way down at the bottom of that; the ground either side
  // scorched black and glowing, crystals grown up along the seam. (What
  // moves in it, the dark and the light at its edges, is drawn over it:
  // see render/ancientfx.js.)
  rift(put, clear, h, rng, state = {}, s = null) {
    clear(17);
    const S = riftShape(s ? s.seed : 0);
    for (const q of S.list) {
      if (q.depth > 0) {
        put(q.dx, h - q.depth, q.dz, B.abyss_floor);
        for (let y = h - q.depth + 1; y <= h; y++) put(q.dx, y, q.dz, B.air);
        for (let y = h - q.depth - 1; y >= h - 4; y--) put(q.dx, y, q.dz, B.rock_void);
      } else {
        const k = q.edge;
        // (Burnt black right up to the lip, the lip itself void-stone and
        // glass; farther off the burn thins out into the ground.)
        const id = k > 0.8 ? (rng.chance(0.5) ? B.obsidian : B.rock_void) : k > 0.25 || rng.float(0, 1) < k * 3 ? B.scorched_earth : rng.chance(0.5) ? B.scorched : B.ash;
        ground(put, h, q.dx, q.dz, id, k > 0.5 ? B.rock_void : B.stone, 2);
        if (k > 0.55 && rng.chance(0.07 * k + 0.02)) put(q.dx, h + 1, q.dz, rng.chance(0.6) ? B.glow_crystal : B.void_bloom, rng.int(0, 3));
        else if (k > 0.7 && rng.chance(0.06)) {
          put(q.dx, h + 1, q.dz, B.obsidian);
          if (rng.chance(0.4)) put(q.dx, h + 2, q.dz, B.obsidian);
        } else if (k < 0.5 && rng.chance(0.03)) put(q.dx, h + 1, q.dz, B.bones);
      }
    }
    // The way down, at the bottom of the basin.
    put(0, h - 2, 0, B.rift_door);
    put(0, h - 1, 0, B.air);
    put(0, h, 0, B.air);
    void state;
  },

  // The Gullet of the World: a crater like a mouth, thirty paces across,
  // sunk in terraces to a throat at its heart ringed with teeth of stone
  // and bone as tall as a man; the ribs of what it ate standing round its
  // rim; the ground heaved up in a lip round it all, bones everywhere,
  // the mud warm; and at the bottom of the throat, its mouth.
  gullet(put, clear, h, rng, state = {}) {
    clear(16);
    const C = { x: 0, z: -3 };
    const ring = (d) => (d < 0.3 ? 3 : d < 0.56 ? 2 : d < 0.82 ? 1 : 0);
    for (let dz = -16; dz <= 16; dz++) {
      for (let dx = -16; dx <= 16; dx++) {
        const d = Math.hypot(dx / 14.5, (dz - C.z) / 11);
        if (d > 1.14) continue;
        if (d > 1) {
          // The lip, heaved up.
          put(dx, h, dz, B.mud);
          if (rng.chance(0.55)) put(dx, h + 1, dz, B.mud);
          if (rng.chance(0.2)) put(dx, h + (rng.chance(0.55) ? 2 : 1), dz, B.bones);
          continue;
        }
        const depth = ring(d);
        // (Each terrace its own ground: bone-sand on the rim, warm mud
        // below it, black peat lower, and the throat's rock, sulphured.)
        const id = depth === 3 ? (rng.chance(0.18) ? B.sulfur_crust : B.cave_rock) : depth === 2 ? (rng.chance(0.8) ? B.peat : B.mud) : depth === 1 ? (rng.chance(0.93) ? B.mud : B.bone_sand) : rng.chance(0.9) ? B.bone_sand : B.mud;
        put(dx, h - depth, dz, id);
        for (let y = h - depth + 1; y <= h; y++) put(dx, y, dz, B.air);
        for (let y = h - depth - 1; y >= h - 5; y--) put(dx, y, dz, B.cave_rock);
        // Bones on the terraces, skulls where they've rolled to.
        if (depth <= 1 && rng.chance(0.07)) put(dx, h - depth + 1, dz, B.bones);
        else if (depth === 2 && rng.chance(0.04)) put(dx, h - depth + 1, dz, B.skull_pile, rng.int(0, 3));
        // Teeth round the throat.
        if (d >= 0.3 && d < 0.42 && (dx * 3 + dz * 5 + 100) % 2 === 0) put(dx, h - depth + 1, dz, rng.chance(0.45) ? B.whale_rib : B.stalagmite, dx < 0 ? 0 : 1);
      }
    }
    // The ribs of what it ate, round the rim.
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * TAU + 0.26;
      const dx = Math.round(Math.cos(a) * 13);
      const dz = Math.round(C.z + Math.sin(a) * 9.6);
      if (dz > 2 && Math.abs(dx) <= 4) continue;
      const depth = ring(Math.hypot(dx / 14.5, (dz - C.z) / 11));
      put(dx, h - depth + 1, dz, B.whale_rib, Math.cos(a) < 0 ? 0 : 1);
      put(dx, h - depth + 2, dz, B.air);
    }
    // A ribcage of them either side of the way down: pairs of ribs, the
    // way between them, from the south rim to the throat.
    for (let dz = 2; dz <= 13; dz += 2) {
      for (const dx of [-3, 3]) {
        const depth = ring(Math.hypot(dx / 14.5, (dz - C.z) / 11));
        put(dx, h - depth + 1, dz, B.whale_rib, dx < 0 ? 0 : 1);
        put(dx, h - depth + 2, dz, B.air);
      }
    }
    for (const [dx, dz] of [[-5, 6], [5, 6], [-6, 10], [6, 10]]) {
      const depth = ring(Math.hypot(dx / 14.5, (dz - C.z) / 11));
      put(dx, h - depth, dz, B.whalebone);
      put(dx, h - depth + 1, dz, B.skull_pile, rng.int(0, 3));
    }
    // Its mouth, at the bottom of the throat (the north side of it): a jaw
    // of bone over it, teeth round it.
    for (let dx = -3; dx <= 3; dx++) {
      const top = h + 2 - Math.abs(dx);
      for (let y = h - 3; y <= top; y++) put(dx, y, C.z - 3, B.whalebone);
      if (Math.abs(dx) <= 2) put(dx, top + 1, C.z - 3, B.stalagmite, dx < 0 ? 0 : 1);
    }
    for (const dx of [-3, 3]) for (let y = h - 2; y <= h - 1; y++) put(dx, y, C.z - 2, B.whalebone);
    put(0, h - 2, C.z - 2, B.gullet_mouth);
    put(0, h - 1, C.z - 2, B.air);
    // (Round 73) Its spit pooled in the bottom of the throat, glowing, and
    // a second row of teeth over the mouth.
    for (const [dx, dz] of [[-1, C.z], [1, C.z], [0, C.z + 1], [-2, C.z + 1], [2, C.z + 1]]) put(dx, h - 3, dz, B.acid_pool);
    for (const dx of [-2, 0, 2]) put(dx, h + 3 - Math.abs(dx), C.z - 3, B.stalagmite, dx < 0 ? 0 : 1);
    for (const dx of [-1, 1]) {
      put(dx, h - 2, C.z - 2, B.cave_rock);
      put(dx, h - 1, C.z - 2, B.stalagmite, dx < 0 ? 0 : 1);
    }
    for (const dx of [-2, 2]) put(dx, h - 2, C.z - 2, B.stalagmite, dx < 0 ? 0 : 1);
    void state;
  },
};
