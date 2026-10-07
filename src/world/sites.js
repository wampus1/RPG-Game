// Where the old places are, and what shows of them above ground: a barrow
// mound with a stone door in it, a mine's headframe over its shaft, a
// ruined chapel round a sinkhole, a cave in a rock outcrop with a palisade
// before it, and the Kavorent's spires, five paces square and taller than
// anything men have built. (What's below: see dungeongen.js.)
import { REGION_W, REGION_D, MAP_W, MAP_H, WORLD_Y, SURFACE } from '../config.js';
import { B, BLOCKS } from './blocks.js';
import { RNG, hash4 } from '../util/rng.js';
import { OWN_TYPE } from './isledeep.js';
import { FAR_SITES, FAR_OWN_SHARE, FAR_OWN_TYPE } from './fardeep.js';
import { ancientSites, ANCIENT_GATE } from './ancient.js';
import { Region } from './region.js';
import { MODS } from '../mod/state.js';

// What kind of place suits a map square, if any: by its land and its
// neighbours.
function kindFor(ow, c, rng) {
  const near = (dx, dz) => ow.cell(c.cx + dx, c.cz + dz);
  let mtn = 0;
  let water = 0;
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
    const q = near(dx, dz);
    if (!q) continue;
    if (q.mountainness > 0.1 || q.biome === 'mountain') mtn++;
    if (q.lake || q.river || q.biome === 'ocean') water++;
  }
  if (mtn >= 2 && rng.chance(0.75)) return 'mine';
  // (The Ashborn dig deep for their forges; the old dead of Myrrow lie in
  // the wet ground.)
  if (['ashland', 'cinderwood', 'geyser'].includes(c.biome) && rng.chance(0.5)) return 'mine';
  if (['moor', 'fungal', 'mangrove'].includes(c.biome) && rng.chance(0.5)) return rng.chance(0.6) ? 'crypt' : 'barrow';
  if ((c.biome === 'swamp' || water >= 3) && rng.chance(0.7)) return 'crypt';
  if (['plains', 'tundra', 'taiga'].includes(c.biome) && rng.chance(0.6)) return 'barrow';
  if (['forest', 'jungle', 'savanna'].includes(c.biome) && rng.chance(0.6)) return 'holdout';
  return rng.pick(['barrow', 'crypt', 'holdout', 'mine']);
}

// What each island's spire is for (see entities/bosses_spire.js for its
// master): Thessa's, the facility that oversees the whole of the work of
// holding up the storm wall; Kharos's, the thermal spire, sunk in the
// lava of the mountain's crater, drawing on its heat to power the wall;
// Myrrow's, the tidal spire on the shore, wringing the sea into the
// storm's rain.
export const SPIRE_THEMES = { thessa: 'facility', kharos: 'thermal', myrrow: 'tidal' };

// The old places of the Dagoni Islands: on each, its own few dungeons and
// one of the Kavorent's spires (see SPIRE_THEMES): out where nobody lives,
// on Myrrow by the sea, on Kharos in the crater itself. Placed with the
// world.
export function genSites(ow) {
  const rng = new RNG(hash4(ow.seed, 0xd0e5));
  const sites = [];
  const sett = ow.settlements;
  const farFromTowns = (c, d) => sett.every((s) => Math.hypot(s.cx + (s.cw - 1) / 2 - c.cx, (s.cz + (s.cd - 1) / 2 - c.cz) * 1.4) >= d);
  const farFromSites = (c, d) => sites.every((q) => Math.hypot(q.cx - c.cx, (q.cz - c.cz) * 1.4) >= d);
  for (const I of ow.islands || []) {
    const land = ow.liveCells.filter((c) => c.island === I.key && c.biome !== 'ocean' && c.biome !== 'beach' && c.biome !== 'volcano' && !c.lake && c.settlement === null && !c.bridge && c.cont > 0.08 && c.cx > 0 && c.cz > 0 && c.cx < MAP_W - 1 && c.cz < MAP_H - 1);
    const mine = sett.filter((s) => s.island === I.key);
    // The Kavorent's first: the loneliest places (desert, ice, deep forest,
    // the feet of mountains; ash and moor on the other islands).
    const lonely = land
      .filter((c) => LONELY.has(c.biome) && c.mountainness < 0.4)
      .map((c) => ({ c, d: Math.min(99, ...mine.map((s) => Math.hypot(s.cx - c.cx, (s.cz - c.cz) * 1.4))) + rng.float(0, 3) }))
      .sort((a, b) => b.d - a.d);
    let n = 0;
    const theme = SPIRE_THEMES[I.key] || 'facility';
    const V = ow.volcano;
    if (theme === 'thermal' && V && V.island === I.key && I.spires > 0) {
      // (Kharos's: in the lava at the heart of the crater.)
      sites.push({ id: sites.length, type: 'kavorent', cx: V.cx, cz: V.cz, island: I.key, seed: hash4(ow.seed, V.cx, V.cz, 0x4a7), theme, fixed: { x: V.x, z: V.z, rx: V.r * V.crater, rz: (V.r * V.crater) / V.squash } });
      n++;
    }
    // (Myrrow's on the shore: the loneliest with the sea beside it.)
    const bySea = (c) => {
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) if (ow.cell(c.cx + dx, c.cz + dz)?.biome === 'ocean') return true;
      return false;
    };
    const order = theme === 'tidal' ? [...lonely.filter(({ c }) => bySea(c)), ...lonely.filter(({ c }) => !bySea(c))] : lonely;
    for (const { c } of order) {
      if (n >= I.spires) break;
      if (!farFromTowns(c, 4) || !farFromSites(c, 10)) continue;
      sites.push({ id: sites.length, type: 'kavorent', cx: c.cx, cz: c.cz, island: I.key, seed: hash4(ow.seed, c.cx, c.cz, 0x4a7), theme });
      n++;
    }
    // Then the dungeons, near enough to people that they have a story.
    n = 0;
    for (const c of rng.shuffle(land.slice())) {
      if (n >= I.dungeons) break;
      if (!farFromTowns(c, 2.4) || !farFromSites(c, 3.4)) continue;
      if (c.mountainness > 0.5) continue;
      const type = kindFor(ow, c, rng);
      sites.push({ id: sites.length, type, cx: c.cx, cz: c.cz, island: I.key, seed: hash4(ow.seed, c.cx, c.cz, sites.length, 0x5d1) });
      n++;
    }
    // A share of them the island's own kind of place (see isledeep.js):
    // where it best belongs (Thessa's hollows in its woods, Myrrow's
    // grottoes by the sea, Kharos's forges anywhere on the mountain).
    const own = OWN_TYPE[I.key];
    const here = sites.filter((q) => q.island === I.key && q.type !== 'kavorent');
    if (own && here.length) {
      const want = Math.max(1, Math.round(here.length * OWN_SHARE[I.key]));
      const score = (q) => ownSuits(ow, q, I.key) + (hash4(ow.seed, q.cx * 31 + q.cz, 0x15d) % 1000) / 1000;
      here.sort((a, b) => score(b) - score(a)).slice(0, want).forEach((q) => (q.type = own));
    }
    // (Where there are old places enough, one of every ordinary kind at the
    // least: a kind missing takes the place of one of the commonest.)
    const mixed = sites.filter((q) => q.island === I.key && KINDS.includes(q.type));
    if (mixed.length >= KINDS.length + 2) {
      for (const k of KINDS) {
        if (mixed.some((q) => q.type === k)) continue;
        const tally = (t) => mixed.filter((q) => q.type === t).length;
        const most = KINDS.reduce((b, t) => (tally(t) > tally(b) ? t : b), KINDS[0]);
        const swap = mixed.filter((q) => q.type === most).pop();
        if (swap && tally(most) > 1) swap.type = k;
      }
    }
  }
  // (Round 68) The far lands' old places, in a new world (where their
  // peoples live: see worldgen.settleFar): each land's own few, a share of
  // them its own kind (see fardeep.js); and never a Kavorent spire, out
  // beyond the storm. (Their own stream, after the islands', so the
  // islands' places come out as they always did.)
  if (ow.wg >= 2 && !ow.plan) farSites(ow, sites, farFromTowns, farFromSites);
  // (Round 71) The ancient places, two on each great continent: last of
  // all, so a world made before keeps all it had (see ancient.js).
  if (!ow.plan) ancientSites(ow, sites, farFromTowns, farFromSites);
  return sites;
}
function farSites(ow, sites, farFromTowns, farFromSites) {
  const rng = new RNG(hash4(ow.seed, 0xfa2d));
  for (const L of ow.lands) {
    const want = FAR_SITES[L.key];
    if (!want) continue;
    // (Its squares are made as they're wanted: every other one of a
    // continent's, as its towns were placed.)
    const step = L.kind === 'continent' ? 2 : 1;
    const land = [];
    for (let cz = Math.max(1, Math.floor(L.z0 / REGION_D)); cz <= Math.min(MAP_H - 2, Math.ceil(L.z1 / REGION_D)); cz += step) {
      for (let cx = Math.max(1, Math.floor(L.x0 / REGION_W)); cx <= Math.min(MAP_W - 2, Math.ceil(L.x1 / REGION_W)); cx += step) {
        const c = ow.cell(cx, cz);
        if (c && c.island === L.key && c.biome !== 'ocean' && c.biome !== 'beach' && !c.lake && c.settlement === null && !c.bridge && c.cont > 0.08) land.push(c);
      }
    }
    let n = 0;
    for (const gap of [3.4, 2.6]) {
      for (const c of rng.shuffle(land.slice())) {
        if (n >= want) break;
        if (!farFromTowns(c, gap - 1) || !farFromSites(c, gap) || c.mountainness > 0.5) continue;
        sites.push({ id: sites.length, type: kindFor(ow, c, rng), cx: c.cx, cz: c.cz, island: L.key, seed: hash4(ow.seed, c.cx, c.cz, sites.length, 0x5d1), far: true });
        n++;
      }
    }
    const own = FAR_OWN_TYPE[L.key];
    const here = sites.filter((q) => q.island === L.key);
    if (own && here.length) {
      const k = Math.max(1, Math.round(here.length * FAR_OWN_SHARE));
      const score = (q) => ownSuits(ow, q, L.key) + (hash4(ow.seed, q.cx * 31 + q.cz, 0x15d) % 1000) / 1000;
      here.sort((a, b) => score(b) - score(a)).slice(0, k).forEach((q) => (q.type = own));
    }
    const mixed = sites.filter((q) => q.island === L.key && KINDS.includes(q.type));
    if (mixed.length >= KINDS.length) {
      for (const k of KINDS) {
        if (mixed.some((q) => q.type === k)) continue;
        const tally = (t) => mixed.filter((q) => q.type === t).length;
        const most = KINDS.reduce((b, t) => (tally(t) > tally(b) ? t : b), KINDS[0]);
        const swap = mixed.filter((q) => q.type === most).pop();
        if (swap && tally(most) > 1) swap.type = k;
      }
    }
  }
}
const OWN_SHARE = { thessa: 0.25, kharos: 0.4, myrrow: 0.4 };
const KINDS = ['barrow', 'mine', 'crypt', 'holdout'];
function ownSuits(ow, c, isle) {
  const cell = ow.cell(c.cx, c.cz);
  if (isle === 'thessa') return cell && ['forest', 'taiga', 'jungle'].includes(cell.biome) ? 2 : 0;
  // (The sea's: Myrrow's grottoes, Corrow's whale, the Skerries' brochs,
  // Saltmere's salt pans.)
  if (isle === 'myrrow' || isle === 'corrow' || isle === 'skerries' || isle === 'saltmere') {
    for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) if (ow.cell(c.cx + dx, c.cz + dz)?.biome === 'ocean') return 2;
    return 0;
  }
  return 0;
}
const LONELY = new Set(['desert', 'tundra', 'jungle', 'mountain', 'taiga', 'savanna', 'swamp', 'ashland', 'geyser', 'moor', 'fungal', 'mangrove']);

// Find the exact spot for each: flat, dry ground near the middle of its
// square. Needs the terrain (see World).
export function settleSites(world, sites) {
  const t = world.terrain;
  for (const s of sites) {
    if (s.fixed) {
      settleThermal(world, s);
      continue;
    }
    const rng = new RNG(s.seed);
    const cx = Math.floor((s.cx + 0.5) * REGION_W);
    const cz = Math.floor((s.cz + 0.5) * REGION_D);
    let best = null;
    for (let i = 0; i < 70; i++) {
      const x = cx + rng.int(-22, 22);
      const z = cz + rng.int(-10, 10);
      const ctx = t.context(x - 6, z - 6, x + 6, z + 6);
      const col = t.column(x, z, ctx, {});
      if (col.water >= 0) continue;
      let bad = 0;
      for (let dz = -5; dz <= 5 && bad < 99; dz++) {
        for (let dx = -5; dx <= 5; dx++) {
          const q = t.column(x + dx, z + dz, ctx, {});
          if (q.water >= 0 || q.sett) bad += 99;
          else bad += Math.abs(q.h - col.h);
        }
      }
      if (!best || bad < best.bad) best = { x, z, h: col.h, bad };
      if (bad < 6) break;
    }
    s.x = best ? best.x : cx;
    s.z = best ? best.z : cz;
    s.h = best ? best.h : 5;
    // (The tidal spire's intakes run to the nearest water, that way.)
    if (s.theme === 'tidal') {
      const ctx = t.context(s.x - 30, s.z - 30, s.x + 30, s.z + 30);
      let sea = null;
      for (const [ux, uz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        for (let k = 4; k <= 28 && (!sea || k < sea[2]); k++) {
          if (t.column(s.x + ux * k, s.z + uz * k, ctx, {}).water >= 0) {
            sea = [ux, uz, k];
            break;
          }
        }
      }
      if (sea) {
        s.sea = sea;
        s.reach = Math.max(8, Math.min(14, sea[2]) + 2);
      }
    }
  }
}

// The thermal spire: stood in the crater's lava lake, a platform round
// its foot, and four causeways out across the lava to the crater's wall,
// cut up through it in steps to the mountainside (each step found from the
// ground there, so the way out's never a climb of more than one).
function settleThermal(world, s) {
  const t = world.terrain;
  s.x = s.fixed.x;
  s.z = s.fixed.z;
  // (Level with the lava's top: the lake's floor is a pace under it.)
  s.h = SURFACE + 5;
  s.spokes = [];
  const ctx = t.context(s.x - 40, s.z - 40, s.x + 40, s.z + 40);
  for (const [ux, uz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    let y = s.h;
    let easy = 0;
    // (Out past the crater's wall, whatever: its rim's a dip before it.)
    const wall = Math.ceil((ux ? s.fixed.rx : s.fixed.rz) || 18) + 4;
    for (let k = 6; k <= 40; k++) {
      const dx = ux * k;
      const dz = uz * k;
      const col = t.column(s.x + dx, s.z + dz, ctx, {});
      if (col.lava || col.h < s.h) {
        // (Over the lava: the causeway itself.)
        s.spokes.push([dx, dz, s.h, 1]);
        continue;
      }
      if (col.h <= y + 1) {
        // (Ground you can step up (or down) onto: a way cut through what's
        // over it, and done once the ground's going easily downhill.)
        y = col.h;
        s.spokes.push([dx, dz, y, 0]);
        if (++easy >= 3 && k > wall) break;
        continue;
      }
      // (The crater's wall: a step cut up into it.)
      easy = 0;
      y += 1;
      s.spokes.push([dx, dz, y, 1]);
    }
  }
  s.reach = 44;
}

// --------------------------------------------------------------- far lands
// (Round 68) What the usual kinds' ways in are built of in each far land:
// a Velmarch barrow under frost with drystone round it, a Saltmere crypt's
// ruin all salt, the Wyrd Isle's barrows ringed with standing stones.
const BASE_MAT = { stone: B.cobblestone, cap: B.stone, turf: B.grass, soil: B.dirt, path: B.gravel, brick: B.crypt_brick, floor: B.crypt_floor, rock: B.cave_rock, post: B.log_oak, beam: B.planks_dark, hpath: B.path };
const FAR_MAT = {
  velmarch: { stone: B.drystone, cap: B.travertine, turf: B.frost_grass, brick: B.travertine, floor: B.marble, beam: B.planks_dark, hpath: B.flagstone },
  ostria: { stone: B.red_rock, cap: B.red_rock, turf: B.grass_gold, soil: B.red_rock, brick: B.adobe_red, floor: B.flagstone, rock: B.red_rock, post: B.bamboo, beam: B.planks_lacquer, path: B.sand, hpath: B.sand },
  corrow: { stone: B.whalebone, cap: B.whalebone, soil: B.bone_sand, brick: B.drystone, floor: B.bone_sand, post: B.whalebone, beam: B.planks_drift, path: B.bone_sand, hpath: B.bone_sand },
  saltmere: { stone: B.salt_brick, cap: B.salt_brick, turf: B.salt_crust, soil: B.sand, brick: B.salt_brick, floor: B.tile_blue, rock: B.salt_brick, post: B.log_birch, beam: B.planks_birch, path: B.salt_crust, hpath: B.salt_crust },
  hollowmark: { stone: B.cob, cap: B.moss, brick: B.mossy_bricks, floor: B.cob, path: B.dirt, hpath: B.dirt },
  wyrd: { menhir: true, turf: B.heath, brick: B.drystone, floor: B.flagstone, beam: B.log_birch, post: B.log_birch, hpath: B.heath },
  skerries: { stone: B.drystone, cap: B.drystone, brick: B.drystone, floor: B.gravel, path: B.gravel, hpath: B.gravel },
};
// A roof stepped up from both eaves to its ridge, as the towns build them
// (the slope toward you lit, the far one in shadow, the ridge along).
function gable(put, x0, x1, z0, z1, y0, id) {
  for (let k = 0; z0 + k <= z1 - k; k++) {
    const zs = z0 + k;
    const ze = z1 - k;
    for (let x = x0; x <= x1; x++) for (const z of zs === ze ? [zs] : [zs, ze]) put(x, y0 + k, z, id, zs === ze ? 1 : z === zs ? 2 : 0);
  }
}
// Each far land's own kind of place, and its way in (see fardeep.js).
const FAR_GATE = {
  // A tomb-house of travertine over the stair down: a portico of marble
  // columns under a roof of red tile, a paved forecourt, a cypress either
  // side, statues of the legions' standard-bearers.
  catacomb(put, clear, h, rng) {
    clear(6);
    for (let dz = -4; dz <= 0; dz++) for (let dx = -3; dx <= 3; dx++) for (let y = h + 1; y <= h + 3; y++) put(dx, y, dz, dz === 0 && Math.abs(dx) < 3 && y === h + 3 ? B.marble : B.travertine);
    for (let dz = -4; dz <= 2; dz++) for (let dx = -3; dx <= 3; dx++) put(dx, h + 4, dz, B.marble);
    gable(put, -4, 4, -5, 3, h + 5, B.roof_terracotta);
    for (const dx of [-3, -1, 1, 3]) for (let y = h + 1; y <= h + 3; y++) put(dx, y, 2, B.marble_column);
    for (let dz = 1; dz <= 5; dz++) for (let dx = -3; dx <= 3; dx++) put(dx, h, dz, Math.abs(dx) + dz < 6 ? B.marble : B.flagstone);
    for (let dz = 1; dz <= 1; dz++) for (let dx = -2; dx <= 2; dx++) put(dx, h + 1, dz, B.air);
    for (const dx of [-5, 5]) {
      for (let y = h + 1; y <= h + 2; y++) put(dx, y, -1, B.log_olive);
      for (let y = h + 2; y <= h + 6; y++) put(dx, y, -1, B.leaves_cypress);
      put(dx, h + 7, -1, B.leaves_cypress);
    }
    for (const dx of [-4, 4]) put(dx, h + 1, 4, B.statue, dx < 0 ? 1 : 3);
    put(0, h + 1, 0, B.catacomb_door);
    put(0, h + 2, 0, B.travertine);
    put(-1, h + 1, 3, B.candles);
    put(1, h + 1, 3, B.candles);
  },
  // A gatehouse of red lacquer and green tile over the vault's stair:
  // posts of lacquer, a roof turned up at the eaves in two tiers, a lion
  // of stone either side, a walk of flags up to it.
  vault(put, clear, h, rng) {
    clear(6);
    for (let dz = -3; dz <= 0; dz++) for (let dx = -3; dx <= 3; dx++) for (let y = h + 1; y <= h + 3; y++) put(dx, y, dz, Math.abs(dx) === 3 || dz === -3 ? B.planks_lacquer : B.adobe_red);
    for (let dz = -4; dz <= 1; dz++) for (let dx = -4; dx <= 4; dx++) put(dx, h + 4, dz, B.roof_jade, Math.abs(dx) <= 1 ? 1 : dx < 0 ? 3 : 1);
    for (let dz = -3; dz <= 0; dz++) for (let dx = -2; dx <= 2; dx++) put(dx, h + 5, dz, B.planks_lacquer);
    for (let dz = -4; dz <= 1; dz++) for (let dx = -3; dx <= 3; dx++) put(dx, h + 6, dz, B.roof_jade, Math.abs(dx) <= 1 ? 1 : dx < 0 ? 3 : 1);
    for (const dx of [-4, 4]) put(dx, h + 5, 1, B.lantern);
    for (let dz = 1; dz <= 6; dz++) for (let dx = -1; dx <= 1; dx++) put(dx, h, dz, B.flagstone);
    for (const dx of [-2, 2]) put(dx, h + 1, 2, B.statue, dx < 0 ? 1 : 3);
    for (const dx of [-3, 3]) put(dx, h + 1, 4, B.lantern);
    put(0, h + 1, 0, B.vault_door);
    put(0, h + 2, 0, B.planks_lacquer);
  },
  // The whale's head itself, coming up out of a mound of bone sand: its
  // jaw for a doorway, ribs standing in two rows down the beach before it,
  // the bones of its back heaped behind.
  gut(put, clear, h, rng) {
    clear(6);
    for (let dz = -5; dz <= 0; dz++) for (let dx = -4; dx <= 4; dx++) {
      const d = Math.hypot(dx / 4.6, (dz + 2.4) / 3.2);
      if (d > 1) continue;
      for (let y = h + 1; y <= h + (d < 0.5 ? 4 : d < 0.8 ? 3 : 2); y++) put(dx, y, dz, d > 0.8 || y === h + 1 ? B.bone_sand : B.whalebone);
    }
    for (let dx = -2; dx <= 2; dx++) put(dx, h + 3, 0, B.whalebone);
    for (let dz = 1; dz <= 6; dz++) for (let dx = -2; dx <= 2; dx++) put(dx, h, dz, B.bone_sand);
    for (const dz of [2, 4, 6]) {
      put(-3, h + 1, dz, B.whale_rib, 0);
      put(3, h + 1, dz, B.whale_rib, 1);
    }
    for (let i = 0; i < 4; i++) put(rng.int(-5, 5), h + 1, rng.int(-6, -5), B.bones);
    put(0, h + 1, 0, B.gut_mouth);
    put(0, h + 2, 0, B.whalebone);
  },
  // A chapel cut out of a hill of salt, white as bone, its roof of blue
  // glaze, crystals grown up all round it and the ground a crust of salt.
  saltworks(put, clear, h, rng) {
    clear(6);
    for (let dz = -4; dz <= 0; dz++) for (let dx = -3; dx <= 3; dx++) for (let y = h + 1; y <= h + 3; y++) put(dx, y, dz, B.salt_brick);
    gable(put, -3, 3, -5, 1, h + 4, B.tile_blue);
    for (let y = h + 4; y <= h + 8; y++) put(0, y, -6, B.salt_brick);
    put(0, h + 9, -6, B.salt_crystal);
    for (let dz = -6; dz <= 5; dz++) for (let dx = -5; dx <= 5; dx++) if (Math.hypot(dx, dz) < 6.2) put(dx, h, dz, B.salt_crust);
    for (let i = 0; i < 7; i++) {
      const dx = rng.int(-5, 5);
      const dz = rng.int(1, 5) * (rng.chance(0.7) ? 1 : -1);
      if (Math.abs(dx) > 3 || dz > 0) put(dx, h + 1, dz, B.salt_crystal);
    }
    put(0, h + 1, 0, B.salt_door);
    put(0, h + 2, 0, B.salt_brick);
  },
  // A bank of earth with turf on it, a round hole in its face lined with
  // stones; roots over it, glowberries and lantern pods about.
  warren(put, clear, h, rng) {
    clear(6);
    for (let dz = -5; dz <= 0; dz++) for (let dx = -5; dx <= 5; dx++) {
      const d = Math.hypot(dx / 5.6, (dz + 2.5) / 3.4);
      if (d > 1) continue;
      const top = h + (d < 0.45 ? 4 : d < 0.75 ? 3 : 2);
      for (let y = h + 1; y <= top; y++) put(dx, y, dz, y === top ? B.roof_turf : B.cob);
    }
    for (const [dx, y] of [[-1, h + 1], [1, h + 1], [-1, h + 2], [1, h + 2], [0, h + 3]]) put(dx, y, 0, B.drystone);
    for (let dz = 1; dz <= 5; dz++) put(0, h, dz, B.dirt);
    for (const [dx, dz] of [[-3, 2], [3, 1], [-4, 4], [4, 3]]) put(dx, h + 1, dz, rng.chance(0.5) ? B.glowberry_bush : B.giant_fern);
    put(2, h + 1, 3, B.lantern_tree);
    put(0, h + 1, 0, B.warren_hole);
    put(0, h + 2, 0, B.cob);
  },
  // A green hill, round as a bowl turned over, a ring of standing stones
  // round it, toadstools in rings about its foot, and the door between two
  // great stones at its side.
  mound(put, clear, h, rng) {
    clear(7);
    for (let dz = -6; dz <= 1; dz++) for (let dx = -5; dx <= 5; dx++) {
      const d = Math.hypot(dx / 5.4, (dz + 2.5) / 3.8);
      if (d > 1) continue;
      const top = h + Math.max(1, Math.round((1 - d * d) * 4.5));
      for (let y = h + 1; y <= top; y++) put(dx, y, dz, y === top ? B.grass : B.dirt);
    }
    for (let k = 0; k < 9; k++) {
      const a = (k / 9) * Math.PI * 2 + 0.35;
      const dx = Math.round(Math.cos(a) * 6.6);
      const dz = Math.round(-2.5 + Math.sin(a) * 5.2);
      if (dz >= 2 && Math.abs(dx) <= 1) continue;
      put(dx, h + 1, dz, B.standing_stone);
    }
    for (let i = 0; i < 6; i++) put(rng.int(-6, 6), h + 1, rng.int(2, 5), B.fairy_ring);
    for (let dz = 2; dz <= 6; dz++) put(0, h, dz, B.heath);
    put(0, h + 1, 1, B.mound_door);
    put(0, h + 2, 1, B.dirt);
    put(0, h + 1, 2, B.air);
  },
  // The stump of a drystone tower, round, broken off at different heights
  // round its top, weed on its seaward side, its door low in the curve.
  broch(put, clear, h, rng) {
    clear(6);
    for (let dz = -6; dz <= 0; dz++) for (let dx = -3; dx <= 3; dx++) {
      const d = Math.hypot(dx, dz + 3);
      if (d > 3.4) continue;
      const top = h + 3 + (d > 2.4 ? rng.int(1, 4) : 0);
      for (let y = h + 1; y <= top; y++) put(dx, y, dz, d > 2.4 ? B.drystone : B.stone);
    }
    for (let dz = 1; dz <= 5; dz++) for (let dx = -2; dx <= 2; dx++) put(dx, h, dz, B.gravel);
    for (const [dx, dz] of [[-3, 2], [2, 4], [-1, 5], [4, 1]]) put(dx, h + 1, dz, rng.chance(0.5) ? B.cairn : B.thrift);
    put(0, h + 1, 0, B.broch_door);
    put(0, h + 2, 0, B.drystone);
  },
};
// (Round 71: and the ancient places' gates.)
Object.assign(FAR_GATE, ANCIENT_GATE);

// --------------------------------------------------------------- above ground
// The blocks of a site's entrance, as [dx, y, dz, id, meta] from its spot
// (y absolute). `state`: { cleared, open (a spire's open side) }.
export function siteBlocks(s, state = {}) {
  // (Round 62) A mod's place: built as its Builder says (see mod/build.js).
  if (s.mod) return MODS.siteBlocks ? MODS.siteBlocks(s, state) : [];
  const out = [];
  const h = s.h;
  const put = (dx, y, dz, id, meta = 0) => out.push([dx, y, dz, id, meta]);
  // (Right up to the sky: no tree's crown left hanging over it.)
  const clear = (r) => {
    for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) for (let y = h + 1; y < WORLD_Y; y++) put(dx, y, dz, B.air);
  };
  const rng = new RNG(hash4(s.seed, 0x51e));
  // (Round 68: a far land's in its own stone: see FAR_MAT.)
  const M = { ...BASE_MAT, ...(FAR_MAT[s.island] || {}) };
  if (s.type === 'kavorent') {
    clear(7);
    const theme = s.theme || 'facility';
    if (theme === 'thermal') {
      // A platform of alloy round its foot, over the lava, vents breathing
      // in it; and its causeways out to the crater's wall (see
      // settleThermal), lit every few paces.
      for (let dz = -5; dz <= 5; dz++) for (let dx = -5; dx <= 5; dx++) {
        if (Math.abs(dx) <= 2 && Math.abs(dz) <= 2) continue;
        if (Math.hypot(dx, dz) > 5.6) continue;
        put(dx, h, dz, B.kav_floor);
        if (Math.abs(dx) + Math.abs(dz) > 3 && rng.chance(0.08)) put(dx, h + 1, dz, B.kav_vent);
      }
      (s.spokes || []).forEach(([dx, dz, y, cut], i) => {
        for (const side of [-1, 0, 1]) {
          const ox = dz ? side : 0;
          const oz = dx ? side : 0;
          if (cut) put(dx + ox, y, dz + oz, side === 0 && i % 4 === 0 ? B.kav_glow : B.kav_floor);
          for (let yy = y + 1; yy <= Math.min(WORLD_Y - 1, y + 3); yy++) put(dx + ox, yy, dz + oz, B.air);
        }
      });
    } else {
      // Blighted ground round it (see blight, for further out), fallen
      // alloy, and the strange things that grow in it.
      for (let dz = -6; dz <= 6; dz++) for (let dx = -6; dx <= 6; dx++) {
        if (Math.abs(dx) <= 2 && Math.abs(dz) <= 2) continue;
        put(dx, h, dz, rng.chance(0.25) ? B.gravel : B.grass_void);
        if (rng.chance(0.07)) put(dx, h + 1, dz, B.kav_debris);
        else if (rng.chance(0.12)) put(dx, h + 1, dz, GROWTHS[rng.int(0, GROWTHS.length - 1)], rng.int(0, 3));
      }
    }
    if (theme === 'facility') {
      // The Overseer's: monoliths at its corners, light-screens and a
      // console before it, watching over the whole of the work.
      for (const [dx, dz] of [[-5, -5], [5, -5], [-5, 5], [5, 5]]) {
        put(dx, h, dz, B.kav_floor);
        put(dx, h + 1, dz, B.kav_monolith);
      }
      for (const [dx, dz] of [[-4, 0], [4, 0]]) {
        put(dx, h, dz, B.kav_floor);
        put(dx, h + 1, dz, B.kav_holo);
      }
      put(0, h, -4, B.kav_floor);
      put(0, h + 1, -4, B.kav_console);
    } else if (theme === 'tidal') {
      // Myrrow's: its intakes, a walk of alloy laid out from its foot to
      // the water with conduits either side of it (and coils of light up
      // its sides, below).
      const [ux, uz, far] = s.sea || [0, 1, 6];
      for (let k = 3; k <= Math.min(14, far - 1); k++) {
        put(ux * k, h, uz * k, k % 4 === 0 ? B.kav_glow : B.kav_floor);
        if (k % 2) for (const side of [-1, 1]) put(ux * k + uz * side, h + 1, uz * k + ux * side, B.kav_conduit);
      }
    }
    // The spire: five square, up as far as the world goes; hollow at the
    // foot round a lift.
    for (let dz = -2; dz <= 2; dz++) {
      for (let dx = -2; dx <= 2; dx++) {
        put(dx, h, dz, Math.abs(dx) <= 1 && Math.abs(dz) <= 1 ? B.kav_floor : B.kav_pillar);
        for (let y = h + 1; y < WORLD_Y; y++) {
          const inner = Math.abs(dx) <= 1 && Math.abs(dz) <= 1 && y <= h + 3;
          put(dx, y, dz, inner ? B.air : B.kav_pillar);
        }
      }
    }
    put(0, h, 0, B.kav_lift);
    // (Bands of light up its sides: the thermal and the tidal spires
    // humming with what they draw.)
    if (theme !== 'facility' && !state.beaten) {
      for (let y = h + 5; y < WORLD_Y; y += theme === 'thermal' ? 3 : 4) {
        for (let k = -2; k <= 2; k++) for (const [dx, dz] of [[k, -2], [k, 2], [-2, k], [2, k]]) put(dx, y, dz, B.kav_glow);
      }
    }
    // A keystone in each face at the height of your hand, with a hollow in
    // it the shape of a cut stone.
    for (const [ox, oz] of [[0, 2], [-2, 0], [0, -2], [2, 0]]) put(ox, h + 1, oz, B.kav_keystone);
    // Opened (whichever face the stone was set in): a doorway two high in
    // every face, all the way round.
    const side = state.open;
    if (side !== undefined && side !== null) {
      for (const [ox, oz] of [[0, 2], [-2, 0], [0, -2], [2, 0]]) {
        put(ox, h + 1, oz, B.kav_door);
        put(ox, h + 2, oz, B.air);
      }
    }
    return out;
  }
  if (state.cleared) {
    // Fallen in: a heap of rubble where the way down was.
    clear(2);
    put(0, h, 0, B.rubble_seal);
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (rng.chance(0.7)) put(dx, h + 1, dz, rng.chance(0.5) ? B.cobblestone : B.gravel);
    return out;
  }
  if (FAR_GATE[s.type]) {
    FAR_GATE[s.type](put, clear, h, rng);
    return out;
  }
  if (s.type === 'barrow') {
    clear(5);
    // The mound, grassed over, a little high in the middle.
    for (let dz = -3; dz <= 2; dz++) {
      for (let dx = -4; dx <= 4; dx++) {
        const d = Math.hypot(dx / 4.6, dz / 3.4);
        if (d > 1) continue;
        put(dx, h + 1, dz, d > 0.75 ? M.soil : M.turf);
        if (d < 0.55) put(dx, h + 2, dz, M.turf);
        if (d < 0.75 && d >= 0.55) put(dx, h + 1, dz, M.turf);
      }
    }
    // Standing stones round it, and the door at its foot.
    for (const [dx, dz] of [[-5, -1], [5, -1], [-4, 3], [4, 3], [0, -4]]) {
      if (M.menhir) put(dx, h + 1, dz, B.standing_stone);
      else {
        put(dx, h + 1, dz, M.stone);
        if (rng.chance(0.7)) put(dx, h + 2, dz, M.cap);
      }
    }
    put(0, h + 1, 3, B.barrow_door);
    put(0, h + 2, 3, B.air);
    put(0, h + 1, 4, B.air);
    put(0, h, 4, M.path);
    return out;
  }
  if (s.type === 'mine') {
    clear(4);
    for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) put(dx, h, dz, B.gravel);
    put(0, h, 0, B.mine_shaft);
    // The headframe: four posts and a beam over the shaft.
    for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) for (let y = h + 1; y <= h + 3; y++) put(dx, y, dz, M.post);
    for (let dx = -1; dx <= 1; dx++) put(dx, h + 4, 0, M.beam);
    put(0, h + 4, -1, M.beam);
    put(0, h + 4, 1, M.beam);
    // Spoil heaps, an old cart's planks, a barrel.
    for (let i = 0; i < 5; i++) put(rng.int(-4, 4), h + 1, rng.int(3, 4) * (rng.chance(0.5) ? 1 : -1), rng.chance(0.5) ? B.gravel : B.cobblestone);
    put(3, h + 1, 2, B.barrel);
    put(-3, h + 1, -2, B.crate);
    return out;
  }
  if (s.type === 'crypt') {
    clear(5);
    // A chapel's ruin round the sinkhole the crypt fell into.
    for (let dz = -3; dz <= 3; dz++) for (let dx = -4; dx <= 4; dx++) {
      const edge = Math.abs(dx) === 4 || Math.abs(dz) === 3;
      if (edge && rng.chance(0.65)) {
        put(dx, h + 1, dz, M.brick);
        if (rng.chance(0.4)) put(dx, h + 2, dz, M.brick);
      } else if (!edge && rng.chance(0.4)) put(dx, h, dz, M.floor);
    }
    put(0, h, 0, B.sinkhole);
    for (const [dx, dz] of [[-2, 4], [2, 4], [0, 5]]) put(dx, h + 1, dz, B.gravestone);
    put(0, h + 1, 3, B.air);
    return out;
  }
  if (s.type === 'grove') {
    clear(5);
    // An old tree's stump, wider than a house, roots heaving out of the
    // ground round it, and a dark hollow between two of them.
    for (let dz = -3; dz <= 1; dz++) for (let dx = -3; dx <= 3; dx++) {
      const d = Math.hypot(dx / 3.2, (dz + 1) / 2.4);
      if (d > 1) continue;
      for (let y = h + 1; y <= h + (d < 0.6 ? 4 : d < 0.85 ? 3 : 2); y++) put(dx, y, dz, B.log_oak);
      if (d < 0.6) put(dx, h + 5, dz, rng.chance(0.6) ? B.moss : B.leaves_oak);
    }
    for (const [dx, dz] of [[-4, 1], [4, 1], [-3, 2], [3, 2], [-5, -1], [5, -2]]) put(dx, h + 1, dz, B.root_wall);
    for (let i = 0; i < 6; i++) put(rng.int(-5, 5), h + 1, rng.int(2, 4), rng.chance(0.5) ? B.fern : B.mushroom_brown);
    put(0, h + 1, 1, B.hollow_door);
    put(0, h + 2, 1, B.log_oak);
    put(0, h + 1, 2, B.air);
    put(0, h, 2, B.moss);
    return out;
  }
  if (s.type === 'forge') {
    clear(5);
    // A great door of basalt brick in the mountainside, its seams aglow,
    // a chimney of brick smoking over it, slag heaped round.
    for (let dz = -3; dz <= 0; dz++) for (let dx = -3; dx <= 3; dx++) for (let y = h + 1; y <= h + 3; y++) put(dx, y, dz, Math.abs(dx) === 3 || dz === -3 ? B.basalt : B.forge_brick);
    for (let y = h + 4; y <= h + 7; y++) put(-2, y, -2, B.forge_brick);
    put(-2, h + 8, -2, B.ash_brazier, 1);
    for (let dx = -2; dx <= 2; dx++) put(dx, h, 1, B.slag);
    for (let i = 0; i < 5; i++) put(rng.int(-5, 5), h + 1, rng.int(2, 4) * (rng.chance(0.5) ? 1 : -1), rng.chance(0.5) ? B.slag : B.obsidian);
    put(0, h + 1, 0, B.forge_door);
    put(0, h + 2, 0, B.forge_brick);
    put(-2, h + 1, 1, B.ash_brazier, 1);
    put(2, h + 1, 1, B.ash_brazier, 1);
    return out;
  }
  if (s.type === 'grotto') {
    clear(5);
    // A sea cave's mouth in a rock arch crusted with coral and shells,
    // shell sand before it.
    for (let dz = -4; dz <= 0; dz++) for (let dx = -3; dx <= 3; dx++) {
      const d = Math.hypot(dx / 3.6, (dz + 2) / 2.6);
      if (d > 1) continue;
      put(dx, h + 1, dz, d > 0.8 && rng.chance(0.5) ? B.coral_rock : B.cave_rock);
      if (d < 0.8) put(dx, h + 2, dz, B.coral_rock);
      if (d < 0.45) put(dx, h + 3, dz, B.cave_rock);
    }
    for (let dz = 1; dz <= 4; dz++) for (let dx = -2; dx <= 2; dx++) put(dx, h, dz, B.shell_sand);
    for (const [dx, dz] of [[-3, 1], [3, 2], [-2, 3]]) put(dx, h + 1, dz, B.coral, rng.int(0, 3));
    put(0, h + 1, 0, B.grotto_mouth);
    put(0, h + 2, 0, B.air);
    return out;
  }
  // A holdout: a rock outcrop with a cave in its face, a palisade before it.
  clear(5);
  for (let dz = -4; dz <= 0; dz++) for (let dx = -3; dx <= 3; dx++) {
    const d = Math.hypot(dx / 3.6, (dz + 2) / 2.6);
    if (d > 1) continue;
    put(dx, h + 1, dz, M.rock);
    if (d < 0.8) put(dx, h + 2, dz, M.rock);
    if (d < 0.45) put(dx, h + 3, dz, M.rock);
  }
  // (The way in set into the face itself, flush with the rock round it.)
  put(0, h + 1, 0, B.cave_mouth);
  put(0, h + 2, 0, B.air);
  for (let dx = -3; dx <= 3; dx++) if (Math.abs(dx) > 1) put(dx, h + 1, 3, B.fence);
  put(2, h + 1, 2, B.campfire);
  for (let dz = 1; dz <= 4; dz++) put(0, h, dz, M.hpath);
  return out;
}

// What grows in a spire's blight.
const GROWTHS = [B.void_bloom, B.void_bloom, B.glow_crystal, B.tendril, B.eye_stalk];
// The ground it turns, whatever the land: soft ground to violet turf (the
// far islands' too: ash and cinders, moss, peat, mycelium), snow and ice
// lavender, and bare rock violet-black (a mountain's foot, sandstone,
// basalt).
const ids = (...names) => names.filter((k) => B[k] !== undefined).map((k) => B[k]);
const GRASSY = new Set(ids('grass', 'grass_lush', 'grass_dry', 'grass_jungle', 'grass_taiga', 'grass_void', 'dirt', 'mud', 'clay', 'sand', 'ash', 'cinder', 'scorched', 'moss', 'peat', 'mycelium'));
const SNOWY = new Set(ids('snow', 'snow_void', 'ice'));
const ROCKY = new Set(ids('stone', 'gravel', 'sandstone', 'basalt', 'obsidian', 'sulfur_crust', 'rock_void'));
export const BLIGHT_R = 16;

// How far the blight reaches round a spire, that way (`ang`, radians):
// never a neat circle, but a ragged one, lobed and fingered, the same each
// time for the same spire.
export function blightReach(s, ang) {
  const ph = (k) => ((hash4(s.seed, k, 0xb10) % 1000) / 1000) * Math.PI * 2;
  return BLIGHT_R - 1 + 2.4 * Math.sin(3 * ang + ph(1)) + 1.5 * Math.sin(5 * ang + ph(2)) + 0.9 * Math.sin(9 * ang + ph(3)) + 1.2 * Math.max(0, Math.sin(7 * ang + ph(4))) ** 6 * 3;
}

// Is (x, z) in a spire's blight? Inside its reach for sure; just past it,
// thinning out tile by tile (a feathered edge, not a hard one).
export function blighted(s, x, z) {
  const d = Math.hypot(x - s.x, z - s.z);
  if (d < 7) return false;
  const R = blightReach(s, Math.atan2(z - s.z, x - s.x));
  if (d <= R - 1.5) return true;
  if (d >= R + 2) return false;
  const k = (R + 2 - d) / 3.5;
  return (hash4(x, z, s.seed, 0xb1) % 1000) / 1000 < k * k * (3 - 2 * k);
}

// The Kavorent's blight round a spire, out past the cleared ground: the
// turf and the trees gone violet, the flowers turned to strange growths,
// and more of them the nearer you come.
function blight(region, s) {
  for (let lz = 0; lz < REGION_D; lz++) {
    for (let lx = 0; lx < REGION_W; lx++) {
      const x = region.x0 + lx;
      const z = region.z0 + lz;
      const d = Math.hypot(x - s.x, z - s.z);
      if (d > BLIGHT_R + 10 || d < 7 || !blighted(s, x, z)) continue;
      const roll = (hash4(x, z, s.seed, 0xb2) % 1000) / 1000;
      for (let y = WORLD_Y - 1; y >= 1; y--) {
        const id = region.get(lx, y, lz);
        if (id === B.air) continue;
        const b = BLOCKS[id];
        if (b.name.startsWith('leaves_')) {
          region.set(lx, y, lz, B.leaves_void);
          continue;
        }
        if (b.render === 'plant') {
          region.set(lx, y, lz, roll < 0.45 ? GROWTHS[Math.floor(roll * 100) % GROWTHS.length] : B.air);
          continue;
        }
        if (!b.solid) continue;
        // (Snow on the ground: the blight's lavender through it.)
        if (SNOWY.has(id)) {
          region.set(lx, y, lz, B.snow_void);
          const near = 1 - d / BLIGHT_R;
          if (y + 1 < WORLD_Y && region.get(lx, y + 1, lz) === B.air && roll < 0.03 + near * 0.08) region.set(lx, y + 1, lz, GROWTHS[Math.floor(roll * 997) % GROWTHS.length], Math.floor(roll * 40) % 4);
          break;
        }
        if (ROCKY.has(id)) {
          region.set(lx, y, lz, B.rock_void);
          const near = 1 - d / BLIGHT_R;
          if (y + 1 < WORLD_Y && region.get(lx, y + 1, lz) === B.air && roll < 0.02 + near * 0.06) region.set(lx, y + 1, lz, B.glow_crystal, Math.floor(roll * 40) % 4);
          break;
        }
        if (!GRASSY.has(id)) break;
        region.set(lx, y, lz, B.grass_void);
        const near = 1 - d / BLIGHT_R;
        if (y + 1 < WORLD_Y && region.get(lx, y + 1, lz) === B.air && roll < 0.04 + near * 0.1) region.set(lx, y + 1, lz, GROWTHS[Math.floor(roll * 997) % GROWTHS.length], Math.floor(roll * 40) % 4);
        break;
      }
    }
  }
}

// Write the bits of every site that fall in a region (when it's made).
export function stampSites(world, region) {
  const sites = world.sites || [];
  const x0 = region.x0;
  const z0 = region.z0;
  for (const s of sites) {
    const m = s.reach || 8;
    if (s.x === undefined || Math.abs(s.x - (x0 + REGION_W / 2)) > REGION_W / 2 + m || Math.abs(s.z - (z0 + REGION_D / 2)) > REGION_D / 2 + m) continue;
    for (const [dx, y, dz, id, meta] of siteBlocks(s, s.state || {})) {
      const x = s.x + dx;
      const z = s.z + dz;
      if (x < x0 || z < z0 || x >= x0 + REGION_W || z >= z0 + REGION_D || y < 0 || y >= WORLD_Y) continue;
      region.set(x - x0, y, z - z0, id, meta);
    }
  }
  // (The blight reaches further than any site's own ground.)
  for (const s of sites) {
    if (s.type !== 'kavorent' || s.x === undefined) continue;
    if (Math.abs(s.x - (x0 + REGION_W / 2)) > REGION_W / 2 + BLIGHT_R + 10 || Math.abs(s.z - (z0 + REGION_D / 2)) > REGION_D / 2 + BLIGHT_R + 10) continue;
    blight(region, s);
  }
}

// Change what shows above ground of a site (a dungeon beaten, a spire
// opened): where it's loaded, and where it was changed once and put away
// since (that ground comes back as it was put away, not made afresh, so
// it's put right where it's kept: see World.unloadRegion).
export function restamp(world, s) {
  const kept = new Map();
  for (const [dx, y, dz, id, meta] of siteBlocks(s, s.state || {})) {
    const x = s.x + dx;
    const z = s.z + dz;
    if (world.regionAt(x, z)) {
      if (world.getBlock(x, y, z) !== id) world.setBlock(x, y, z, id, meta);
      continue;
    }
    const rx = Math.floor(x / REGION_W);
    const rz = Math.floor(z / REGION_D);
    if (world.remote || !world.saved || y < 0 || y >= WORLD_Y || !world.inBounds(rx, rz)) continue;
    const key = world.regionKey(rx, rz);
    if (!kept.has(key)) {
      const d = world.saved.get(key);
      kept.set(key, d ? Region.deserialize(d) : null);
    }
    const r = kept.get(key);
    if (!r) continue;
    const i = Region.idx(x - r.x0, y, z - r.z0);
    if (BLOCKS[r.blocks[i]]?.interact === 'container' && BLOCKS[id]?.interact !== 'container') r.containers.delete(i);
    r.blocks[i] = id;
    r.meta[i] = meta || 0;
  }
  for (const [key, r] of kept) if (r) world.saved.set(key, r.serialize());
  // (Whoever else keeps a copy of the world is told: see net/host.js.)
  world.onSiteChange?.(s);
}

// The site at (x, z), if any's entrance is right there (within a pace or two).
export function siteAt(world, x, z, r = 3) {
  return (world.sites || []).find((s) => s.x !== undefined && Math.abs(s.x - x) <= r && Math.abs(s.z - z) <= r + 1) || null;
}

export { BLOCKS, MAP_H, REGION_D };
