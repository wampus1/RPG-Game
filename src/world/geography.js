// The lie of the world: what land there is and where. The Dagoni Islands
// (three of them, in the south-west, ringed by a storm no raft gets
// through) are where everything lives and happens; far off over the open
// sea lie two great continents and a scatter of lonelier islands, as yet
// only land and its biomes.
//
// Each landmass is a rounded blob (a superellipse, its coast roughened by
// noise at its own scale), placed in map squares; the land value at a tile
// is the best of them (above zero is land, the way the old single island's
// was).
import { MAP_W, MAP_H, REGION_W, REGION_D } from '../config.js';
import { fbm } from '../util/noise.js';

// Landmasses, in map squares: centre, half-size, how rough its coast is,
// and which way its biomes run (see worldgen.pickBiome).
//   kind: 'dagoni' (one of the three; lived on, simulated), 'continent',
//   'isle' (the far ones: land and biomes only).
export const LANDMASSES = [
  {
    key: 'thessa', name: 'Thessa', kind: 'dagoni', cx: 52, cz: 170, rx: 17, rz: 12.5, rough: 0.34,
    about: 'the greenest of the Dagoni Islands, with snow on its north and sand on its south',
    civs: 3, towns: 5, villages: 11, rivers: 8, lakes: 6, spires: 3, dungeons: 14,
  },
  {
    key: 'kharos', name: 'Kharos', kind: 'dagoni', cx: 87, cz: 151, rx: 11.5, rz: 8.6, rough: 0.28,
    about: 'the fire island: ash, black glass and the smoking mountain at its heart',
    civs: 1, towns: 2, villages: 5, rivers: 2, lakes: 1, spires: 1, dungeons: 5, volcano: true,
  },
  {
    key: 'myrrow', name: 'Myrrow', kind: 'dagoni', cx: 86, cz: 189, rx: 12.5, rz: 8.4, rough: 0.3,
    about: 'the misty island: mangroves, moor and forests of giant mushrooms',
    civs: 2, towns: 2, villages: 5, rivers: 3, lakes: 3, spires: 1, dungeons: 5,
  },
  { key: 'velmarch', name: 'Velmarch', kind: 'continent', cx: 212, cz: 64, rx: 98, rz: 50, rough: 0.5, about: 'a great continent across the northern sea' },
  { key: 'ostria', name: 'Ostria', kind: 'continent', cx: 236, cz: 188, rx: 70, rz: 40, rough: 0.48, about: 'a great continent across the eastern sea' },
  { key: 'corrow', name: 'Corrow', kind: 'isle', cx: 136, cz: 130, rx: 6, rz: 4.5, rough: 0.3, about: 'a lonely isle between the continents' },
  { key: 'saltmere', name: 'Saltmere', kind: 'isle', cx: 154, cz: 224, rx: 8, rz: 5, rough: 0.3, about: 'a low isle off the shores of Ostria' },
  { key: 'hollowmark', name: 'Hollowmark', kind: 'isle', cx: 300, cz: 132, rx: 7, rz: 5.5, rough: 0.3, about: 'an isle off the far east of the world' },
  { key: 'wyrd', name: 'the Wyrd Isle', kind: 'isle', cx: 92, cz: 32, rx: 9, rz: 6.5, rough: 0.32, about: 'an isle in the cold north-western sea' },
  { key: 'skerries', name: 'the Grey Skerries', kind: 'isle', cx: 38, cz: 98, rx: 6.5, rz: 5.5, rough: 0.34, about: 'a scatter of rock and heath far north of the storm' },
];
export const DAGONI = LANDMASSES.filter((L) => L.kind === 'dagoni');
export const DAGONI_KEYS = new Set(DAGONI.map((L) => L.key));
// The islands, their name all together.
export const ARCHIPELAGO = 'the Dagoni Islands';

// The storm round the Dagoni Islands: an ellipse of wild water (in map
// squares) no raft gets across. Inside it, the islands' own seas.
export const STORM = { cx: 70, cz: 170, rx: 50, rz: 39, band: 5 };

const SPAN = 1280; // (the half-width, in tiles, coastlines are scaled to)
const CORE = 0.88;

// In tiles, with what's worked out once.
export function buildLandmasses() {
  return LANDMASSES.map((L, i) => {
    const rx = L.rx * REGION_W;
    const rz = L.rz * REGION_D;
    return {
      ...L, i,
      x: (L.cx + 0.5) * REGION_W,
      z: (L.cz + 0.5) * REGION_D,
      trx: rx,
      trz: rz,
      // (Coastline features in proportion to its size.)
      s: Math.max(0.45, Math.max(rx, rz * 1.6) / SPAN),
      off: i * 1717.3,
      x0: (L.cx - L.rx * 1.6) * REGION_W,
      x1: (L.cx + L.rx * 1.6 + 1) * REGION_W,
      z0: (L.cz - L.rz * 1.6) * REGION_D,
      z1: (L.cz + L.rz * 1.6 + 1) * REGION_D,
    };
  });
}

// How far into landmass `L` (x, z) is: above 0 is land.
export function landValue(L, x, z, noise) {
  if (x < L.x0 || x > L.x1 || z < L.z0 || z > L.z1) return -1;
  const nx = (x - L.x) / L.trx;
  const nz = (z - L.z) / L.trz;
  const d = Math.cbrt(Math.abs(nx) ** 3 + Math.abs(nz) ** 3);
  return CORE - d + fbm(noise, (x + L.off) / (380 * L.s), (z - L.off) / (380 * L.s), 4) * L.rough + fbm(noise, x / 55 + 300 + L.off, z / 55, 2) * 0.05;
}

// The landmass (x, z) is on, or nearest to being on.
export function landmassAt(list, x, z, noise) {
  let best = null;
  let bv = -Infinity;
  for (const L of list) {
    const v = landValue(L, x, z, noise);
    if (v > bv) {
      bv = v;
      best = L;
    }
  }
  return bv > -1 ? best : null;
}

// Out in the storm round the Dagoni Islands? (0 outside it; up to 1 in
// the thick of it.)
export function stormAt(x, z) {
  const ex = (x / REGION_W - STORM.cx) / STORM.rx;
  const ez = (z / REGION_D - STORM.cz) / STORM.rz;
  const r = Math.sqrt(ex * ex + ez * ez);
  const w = STORM.band / STORM.rx;
  if (r < 1 || r > 1 + w) return 0;
  return Math.sin(((r - 1) / w) * Math.PI);
}

// How near the storm (x, z) is: 1 in it, falling to 0 a few map squares
// either side (for the weather: it rains harder and the wind rises as you
// come up to it).
export function stormNear(x, z, reach = 4) {
  const ex = (x / REGION_W - STORM.cx) / STORM.rx;
  const ez = (z / REGION_D - STORM.cz) / STORM.rz;
  const r = Math.sqrt(ex * ex + ez * ez);
  const w = STORM.band / STORM.rx;
  const f = reach / STORM.rx;
  if (r >= 1 && r <= 1 + w) return 1;
  const d = r < 1 ? 1 - r : r - 1 - w;
  return Math.max(0, 1 - d / f);
}

// Inside the storm (the Dagoni seas), or out beyond it?
export function insideStorm(x, z) {
  const ex = (x / REGION_W - STORM.cx) / STORM.rx;
  const ez = (z / REGION_D - STORM.cz) / STORM.rz;
  return ex * ex + ez * ez < 1;
}

// The map squares worked out in full when the world's made: the storm and
// all inside it. (The rest of the world's squares are worked out as
// they're wanted.)
export const DETAIL = {
  cx0: Math.max(0, Math.floor(STORM.cx - STORM.rx - STORM.band - 1)),
  cz0: Math.max(0, Math.floor(STORM.cz - STORM.rz - STORM.band - 1)),
  cx1: Math.min(MAP_W - 1, Math.ceil(STORM.cx + STORM.rx + STORM.band + 1)),
  cz1: Math.min(MAP_H - 1, Math.ceil(STORM.cz + STORM.rz + STORM.band + 1)),
};
