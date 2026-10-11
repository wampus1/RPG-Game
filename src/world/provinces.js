// (Round 84) The great continents parted into provinces. Velmarch and
// Ostria were one blob of ground picked splotch by splotch: now, in a
// world made from 0.84 on (world gen 8: see worldgen.WORLD_GEN), each is
// laid out in great tracts, each its own country (a frozen rimewood in
// Velmarch's north, olive hills along its warm south, red mesas in
// Ostria's dry heart, bamboo where its rain falls), with the borders
// between them wandering as borders do, and here and there a range of
// mountains along one. Each has a name, said as you cross into it.
import { RNG, hash4 } from '../util/rng.js';
import { landValue } from './geography.js';

// What a province can be, on each continent: `b` its ground (the first
// the most of it, the second in among it), `t` and `m` how warm (0 the
// land's coldest, 1 its warmest) and how wet (0 to 1) suits it best,
// `must` one the land always has, `about` what it's like, `names` what
// it may be called.
const THEMES = {
  velmarch: [
    { b: ['rimewood', 'taiga'], t: 0.08, m: 0.6, must: true, about: 'frost-bound woods of white birch', names: ['the Rimewood', 'the Hoarwood', 'Frostholt'] },
    { b: ['tundra', 'rune_heath'], t: 0.02, m: 0.25, about: 'a white waste under the north wind', names: ['the White Waste', 'the Pale Steppe', 'the Snowmarch'] },
    { b: ['taiga', 'forest'], t: 0.25, m: 0.7, about: 'deep pine forest', names: ['the Pinewold', 'the Darkfir', 'Tannenmark'] },
    { b: ['rune_heath', 'moor'], t: 0.22, m: 0.35, about: 'bare heath, and the old stones on it', names: ['the Stone Heath', 'the Runelands', 'the Old Rings'] },
    { b: ['moor', 'forest'], t: 0.45, m: 0.6, about: 'wide grey moorland', names: ['the Grey Moors', 'the Heathrise', 'Mistmoor'] },
    { b: ['forest', 'plains'], t: 0.5, m: 0.75, about: 'green woods and clearings', names: ['the Greenwold', 'the Oakshire', 'Elmdeep'] },
    { b: ['plains', 'moor'], t: 0.55, m: 0.35, about: 'rolling open grassland', names: ['the Downs', 'the Long Fields', 'Wheatmarch'] },
    { b: ['olive_hills', 'plains'], t: 0.85, m: 0.45, must: true, about: 'warm hills of olive and cypress', names: ['the Olive Coast', 'the Sunlit Terraces', 'Velmarch Vale'] },
    { b: ['savanna', 'olive_hills'], t: 0.95, m: 0.2, about: 'dry golden grassland', names: ['the Dry Reach', 'the Golden Steppe', 'the Tawny Plains'] },
    { b: ['mountain', 'taiga'], t: 0.3, m: 0.5, once: true, about: 'high mountains', names: ['the Crown Peaks', 'the High Fells', 'the Spine'] },
  ],
  ostria: [
    { b: ['bamboo_grove', 'jungle'], t: 0.55, m: 0.85, must: true, about: 'groves of bamboo and blossom', names: ['the Jade Groves', 'the Whispering Canes', 'the Green Hush'] },
    { b: ['jungle', 'bamboo_grove'], t: 0.9, m: 0.85, about: 'steaming jungle', names: ['the Deep Green', 'the Vinelands', 'the Steaming Wilds'] },
    { b: ['mangrove', 'swamp'], t: 0.7, m: 0.95, coast: true, about: 'mangrove and mire along the shore', names: ['the Rootwater', 'the Tangled Shore', 'the Mire Coast'] },
    { b: ['red_mesa', 'desert'], t: 0.75, m: 0.15, must: true, about: 'red mesas under a hard sun', names: ['the Red Mesas', 'the Burnt Tables', 'Kesh Highland'] },
    { b: ['desert', 'red_mesa'], t: 0.95, m: 0.05, about: 'open desert', names: ['the Glass Sands', 'the Empty Quarter', 'the Sun Waste'] },
    { b: ['savanna', 'red_mesa'], t: 0.6, m: 0.35, about: 'tall dry grass and thorn trees', names: ['the Lion Grass', 'the Amber Steppe', 'the Wide Grass'] },
    { b: ['salt_flats', 'desert'], t: 0.85, m: 0.2, once: true, about: 'white salt flats', names: ['the Salt Pans', 'the White Flats', 'the Bitter Plain'] },
    { b: ['lantern_hollows', 'forest'], t: 0.3, m: 0.65, once: true, about: 'hollows lit by glowing trees', names: ['the Lantern Vales', 'the Glimmer Hollows', 'the Lamplit Dells'] },
    { b: ['forest', 'plains'], t: 0.2, m: 0.55, about: 'quiet cedar woods', names: ['the Cedar Hills', 'the Northern Wood', 'the Quiet Forest'] },
    { b: ['mountain', 'savanna'], t: 0.5, m: 0.4, once: true, about: 'high red mountains', names: ['the Thunder Peaks', 'the Kesh Wall', 'the Red Spine'] },
  ],
};

// Which landmasses are parted so.
export const PROVINCE_LANDS = Object.keys(THEMES);

// The provinces of every continent that has them: [{ i, land, x, z,
// theme, name, about, ridge(set of neighbours a range of hills divides
// it from) }]. Made once, from the world's seed.
export function makeProvinces(ow) {
  const out = [];
  for (const L of ow.lands) {
    const themes = THEMES[L.key];
    if (!themes || L.kind !== 'continent') continue;
    const rng = new RNG(hash4(ow.seed, 0x9a0, L.key === 'velmarch' ? 1 : 2, 84));
    const area = Math.PI * L.trx * L.trz;
    const want = Math.max(6, Math.min(14, Math.round(area / 2.2e6)));
    const minD = Math.sqrt(area / want) * 0.55;
    const seeds = [];
    for (let tries = 0; seeds.length < want && tries < want * 400; tries++) {
      const x = rng.float(L.x - L.trx, L.x + L.trx);
      const z = rng.float(L.z - L.trz, L.z + L.trz);
      if (landValue(L, x, z, ow.nCont) < 0.05) continue;
      if (seeds.some((q) => Math.hypot(q.x - x, (q.z - z) * 1.6) < minD)) continue;
      seeds.push({ x, z });
    }
    // How warm and wet each is (across the land, not the world).
    const list = seeds.map((q, k) => {
      const t = Math.max(0, Math.min(1, (q.z - (L.z - L.trz)) / (2 * L.trz) + ow.nClimate(q.x / 900, q.z / 900) * 0.18));
      const lv = landValue(L, q.x, q.z, ow.nCont);
      const coast = lv < 0.35;
      // (Wetter by the sea, drier deep inland.)
      const m = Math.max(0, Math.min(1, 0.58 + ow.nClimate(q.x / 700 + 50, q.z / 700) * 0.45 + (coast ? 0.12 : 0) - Math.max(0, lv) * 0.3));
      return { i: out.length + k, land: L.key, x: q.x, z: q.z, t, m, coast, theme: null, near: [] };
    });
    // Who borders whom (near enough to: a rough guess, by distance).
    for (const p of list) {
      p.near = list.filter((q) => q !== p).sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z)).slice(0, 4);
    }
    const fit = (p, th) => (p.t - th.t) ** 2 * 2.2 + (p.m - th.m) ** 2 + (th.coast && !p.coast ? 0.6 : 0);
    const used = new Map();
    const take = (p, th) => {
      p.theme = th;
      used.set(th, (used.get(th) || 0) + 1);
    };
    // The land's own (its must-haves) first, each where it suits best.
    for (const th of themes.filter((q) => q.must)) {
      const free = list.filter((p) => !p.theme);
      if (!free.length) break;
      take(free.reduce((a, b) => (fit(b, th) < fit(a, th) ? b : a)), th);
    }
    // Then the rest: each the best fit not already its neighbour's, the
    // less used the better.
    const order = list.slice();
    for (let k = order.length - 1; k > 0; k--) {
      const j = Math.floor(rng.next() * (k + 1));
      [order[k], order[j]] = [order[j], order[k]];
    }
    for (const p of order) {
      if (p.theme) continue;
      let best = null;
      let bs = Infinity;
      for (const th of themes) {
        if (th.once && used.get(th)) continue;
        const s = fit(p, th) + (used.get(th) || 0) * 0.12 + (p.near.some((q) => q.theme === th) ? 0.8 : 0) + rng.float(0, 0.05);
        if (s < bs) {
          bs = s;
          best = th;
        }
      }
      take(p, best || themes[0]);
    }
    // Their names (no two the same), and the ranges between some.
    const taken = new Set();
    for (const p of list) {
      const names = p.theme.names.filter((n) => !taken.has(n));
      p.name = names.length ? names[Math.floor(rng.next() * names.length)] : `${p.theme.names[0]} ${['East', 'West', 'North', 'South'][p.i % 4]}`;
      taken.add(p.name);
      p.ridge = new Set();
    }
    for (const p of list) for (const q of p.near) if (p.i < q.i && rng.chance(0.35)) {
      p.ridge.add(q.i);
      q.ridge.add(p.i);
    }
    for (const p of list) delete p.near;
    out.push(...list);
  }
  return out;
}

// The province (x, z) is in (and the one beyond its nearest border, and
// how near that border is: 0 on it, 1 deep inside): null off the
// continents that have them.
export function provinceAt(ow, x, z, landKey = null) {
  const P = ow.provinces;
  if (!P || !P.length) return null;
  // (Borders that wander: the point looked up shifted by the lie of the
  // land.)
  const wx = x + ow.nWarpX(x / 1400 + 31, z / 1400) * 520 + ow.nFine(x / 300, z / 300 + 17) * 90;
  const wz = z + ow.nWarpZ(x / 1400, z / 1400 + 31) * 340 + ow.nFine(x / 300 + 17, z / 300) * 60;
  let a = null;
  let b = null;
  let da = Infinity;
  let db = Infinity;
  for (const p of P) {
    if (landKey && p.land !== landKey) continue;
    const d = Math.hypot(p.x - wx, (p.z - wz) * 1.5);
    if (d < da) {
      db = da;
      b = a;
      da = d;
      a = p;
    } else if (d < db) {
      db = d;
      b = p;
    }
  }
  if (!a) return null;
  return { p: a, q: b, edge: b ? (db - da) / (db + da) : 1 };
}

// A splotch's ground, in a province: mostly the province's own, some of
// its second ground in among it, a range of hills along a border that has
// one, and now and then whatever the climate would give.
export function provinceBiome(ow, L, x, z, rng, fallback) {
  const at = provinceAt(ow, x, z, L.key);
  if (!at) return fallback();
  const { p, q, edge } = at;
  if (q && edge < 0.07 && p.ridge.has(q.i) && rng.chance(0.75)) return 'mountain';
  const r = rng.next();
  if (r < 0.68) return p.theme.b[0];
  if (r < 0.9) return p.theme.b[1];
  if (r < 0.95) return q && edge < 0.2 ? q.theme.b[0] : p.theme.b[0];
  return fallback();
}
