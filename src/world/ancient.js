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
    kits: ['circle', 'distillery', 'mercury', 'crucibles', 'library', 'circle', 'vats', 'trap', 'treasure', 'guard', 'distillery'],
    mobs: [['slime', 3], ['wisp', 3], ['golem', 1], ['mite', 2]],
    swap: { skeleton: ['wisp'], wight: ['golem'], ghoul: ['slime'], crawler: ['mite'] },
    bosses: ['divine_alchemist'], torches: 0.3,
    shapes: { octagon: 3, round: 2, hex: 2, rect: 2, star: 1 }, wiggle: 0.2, decor: [['crucible', 2], ['candles', 3], ['glass_lamp', 2], ['statue', 1]],
    dark: [0.1, 0.08, 0.12], motes: ['#ffd070', '#c8a0ff', '#80e8ff'], ambient: ['drone', 'drip', 'chime', 'hum'],
    loot: [['gem', 1, 2, 0.35], ['gold_ingot', 1, 2, 0.35], ['frost_crystal', 1, 2, 0.25], ['old_coin', 3, 8, 0.6]],
  },
  champion: {
    name: 'Hall of the Last Champion', isle: 'velmarch', ancient: true, wall: B.mossy_bricks, floor: B.flagstone, alt: B.cracked_bricks, beam: B.planks_dark, regions: [2, 2], floors: [3, 3],
    kits: ['trial', 'armory', 'statues', 'blades', 'chapel', 'burial', 'trial', 'trap', 'treasure', 'guard', 'statues'],
    mobs: [['skeleton', 4], ['wight', 2], ['ghoul', 2], ['legion_shade', 1]],
    bosses: ['the_hero'], torches: 0.35,
    shapes: { rect: 3, octagon: 2, cross: 2, round: 1 }, wiggle: 0, decor: [['statue', 3], ['war_banner', 3], ['weapon_rack', 2], ['candles', 2], ['skull_pile', 1]],
    dark: [0.09, 0.08, 0.07], motes: ['#ffe8a0', '#c8c8c8'], ambient: ['march', 'whisper', 'chains', 'drone'],
    loot: [['old_coin', 3, 8, 0.6], ['iron_ingot', 1, 3, 0.4], ['gold_ingot', 1, 1, 0.25], ['gem', 1, 1, 0.2]],
  },
  rift: {
    name: 'Sundered Reach', isle: 'ostria', ancient: true, wall: B.obsidian, floor: B.rock_void, alt: B.blight_floor, beam: null, regions: [2, 2], floors: [3, 3],
    kits: ['portals', 'fracture', 'echo', 'shards', 'portals', 'gravity', 'trap', 'treasure', 'guard', 'fracture'],
    mobs: [['wisp', 3], ['mite', 3], ['drone', 2], ['crawler', 1]],
    swap: { skeleton: ['wisp'], wight: ['drone'], ghoul: ['mite'] },
    bosses: ['rift_crawler'], torches: 0.05,
    shapes: { star: 2, diamond: 2, crescent: 2, zigzag: 1, teeth: 1, cave: 2 }, wiggle: 0.6, decor: [['glow_crystal', 4], ['void_bloom', 2], ['eye_stalk', 1], ['tendril', 2]],
    dark: [0.06, 0.04, 0.1], motes: ['#c8a0ff', '#5ad8f0', '#ffffff'], ambient: ['hum', 'whisper', 'pulse', 'drone'],
    loot: [['gem', 1, 3, 0.4], ['frost_crystal', 1, 2, 0.3], ['old_coin', 3, 8, 0.6], ['gold_ingot', 1, 1, 0.2]],
  },
  gullet: {
    name: 'Gullet of the World', isle: 'ostria', ancient: true, wall: B.cave_rock, floor: B.mud, alt: B.bone_sand, beam: B.log_acacia, regions: [2, 2], floors: [3, 3],
    kits: ['acid', 'eggs', 'quake', 'bones', 'acid', 'tunnel', 'trap', 'treasure', 'guard', 'eggs'],
    mobs: [['slime', 3], ['crawler', 3], ['rat', 2], ['tunneler', 2]],
    swap: { skeleton: ['crawler'], wight: ['tunneler'], ghoul: ['slime'] },
    bosses: ['alinelidan'], torches: 0.05,
    shapes: { cave: 5, round: 3 }, wiggle: 1.6, decor: [['bones', 4], ['roots', 2], ['rubble', 2], ['skull_pile', 1]],
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
      const s = { id: sites.length, type: kind, cx: put.cx, cz: put.cz, island: L.key, seed: hash4(ow.seed, put.cx, put.cz, sites.length, 0xa7c), far: true, ancient: true };
      sites.push(s);
      mine.push(put);
    }
  }
}

// ------------------------------------------------------------ the way in
// What stands over each, above ground (see sites.js FAR_GATE): `put(dx,
// y, dz, id, meta)` from its spot, `clear(r)` the air over it, `h` the
// ground.
export const ANCIENT_GATE = {
  // A dome of glass and gilt on a drum of marble, its alembic's neck going
  // up through the top of it and bent over, still smoking; braziers either
  // side of the door; the ground round it turned to salt and gold.
  athanor(put, clear, h, rng) {
    clear(8);
    for (let dz = -7; dz <= 0; dz++) for (let dx = -4; dx <= 4; dx++) {
      const d = Math.hypot(dx / 4.6, (dz + 3.5) / 3.8);
      if (d > 1) continue;
      for (let y = h + 1; y <= h + 3; y++) put(dx, y, dz, d > 0.82 ? B.marble : B.air);
      put(dx, h, dz, B.tile_blue);
      if (d < 0.9) put(dx, h + 4, dz, d > 0.6 ? B.marble : B.glass);
      if (d < 0.6) put(dx, h + 5, dz, d > 0.35 ? B.glass : B.marble);
    }
    for (let y = h + 5; y <= h + 9; y++) put(0, y, -4, B.copper_roof);
    put(1, h + 9, -4, B.copper_roof);
    put(2, h + 9, -4, B.copper_roof);
    put(2, h + 8, -4, B.copper_roof);
    for (const dx of [-3, 3]) put(dx, h + 1, 1, B.brazier, META_STATE);
    for (let i = 0; i < 9; i++) {
      const dx = rng.int(-6, 6);
      const dz = rng.int(1, 6);
      put(dx, h, dz, rng.chance(0.5) ? B.salt_crust : B.grass_gold);
    }
    put(0, h + 1, 0, B.athanor_door);
    put(0, h + 2, 0, B.marble);
  },
  // A great barrow, long and high, a ring of broken swords stood in the
  // turf round it, and over its door a statue of the Champion with his
  // sword raised, cracked across.
  champion(put, clear, h, rng) {
    clear(8);
    for (let dz = -8; dz <= 0; dz++) for (let dx = -6; dx <= 6; dx++) {
      const d = Math.hypot(dx / 6.4, (dz + 4) / 4.6);
      if (d > 1) continue;
      const top = h + Math.max(1, Math.round((1 - d * d) * 5));
      for (let y = h + 1; y <= top; y++) put(dx, y, dz, y === top ? B.grass : B.barrow_earth);
    }
    for (const [dx, y] of [[-1, h + 1], [1, h + 1], [-1, h + 2], [1, h + 2], [-1, h + 3], [0, h + 3], [1, h + 3]]) put(dx, y, 0, B.mossy_bricks);
    put(0, h + 4, -1, B.statue, 2);
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * Math.PI * 2 + 0.3;
      const dx = Math.round(Math.cos(a) * 8);
      const dz = Math.round(-4 + Math.sin(a) * 6.4);
      if (dz >= 1 && Math.abs(dx) <= 1) continue;
      put(dx, h + 1, dz, rng.chance(0.6) ? B.weapon_rack : B.war_banner, rng.int(0, 3));
    }
    for (let dz = 1; dz <= 6; dz++) put(0, h, dz, B.flagstone);
    put(0, h + 1, 0, B.champion_door);
    put(0, h + 2, 0, B.mossy_bricks);
  },
  // An arch of black glass, jagged, standing on nothing much, the air in it
  // split open on the dark; shards of it hanging in the air round it, the
  // ground cracked and glowing.
  rift(put, clear, h, rng) {
    clear(8);
    for (let dz = -3; dz <= 0; dz++) for (let dx = -3; dx <= 3; dx++) put(dx, h, dz, B.rock_void);
    for (const dx of [-2, 2]) for (let y = h + 1; y <= h + 4 + (dx > 0 ? 1 : 0); y++) put(dx, y, 0, B.obsidian);
    for (let dx = -2; dx <= 2; dx++) put(dx, h + 5, 0, B.obsidian);
    put(-1, h + 5, 0, B.glow_crystal);
    for (let i = 0; i < 10; i++) {
      const dx = rng.int(-6, 6);
      const dz = rng.int(-6, 6);
      if (Math.abs(dx) <= 2 && dz >= -1 && dz <= 6) continue;
      put(dx, h, dz, B.blight_floor);
      if (rng.chance(0.4)) put(dx, h + 1, dz, rng.chance(0.5) ? B.glow_crystal : B.void_bloom);
    }
    for (let dz = 1; dz <= 6; dz++) put(0, h, dz, B.rock_void);
    put(0, h + 1, 0, B.rift_door);
    put(0, h + 2, 0, B.air);
  },
  // A hole in the earth like a mouth, as wide as a house, its lip ringed
  // with great teeth of stone and bone, the ground round it heaved up and
  // split, and a warm breath coming up out of it.
  gullet(put, clear, h, rng) {
    clear(8);
    for (let dz = -7; dz <= 2; dz++) for (let dx = -6; dx <= 6; dx++) {
      const d = Math.hypot(dx / 6.2, (dz + 2.5) / 4.8);
      if (d > 1) continue;
      put(dx, h, dz, d < 0.55 ? B.mud : B.bone_sand);
      if (d >= 0.55 && d < 0.75 && (dx * 3 + dz) % 2 === 0) put(dx, h + 1, dz, rng.chance(0.5) ? B.whale_rib : B.stalagmite, dx < 0 ? 0 : 1);
      if (d >= 0.85) put(dx, h + 1, dz, B.mud);
    }
    for (let dz = 3; dz <= 7; dz++) put(0, h, dz, B.mud);
    put(0, h + 1, 2, B.gullet_mouth);
    put(0, h + 2, 2, B.air);
    for (let i = 0; i < 6; i++) put(rng.int(-7, 7), h + 1, rng.int(3, 7), B.bones);
  },
};
