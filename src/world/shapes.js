// Each landmass's shape for a world (round 68): picked by the world's seed,
// so no two worlds have quite the same Thessa or the same Velmarch. Each
// land is one of these (now and then with a second touch on top):
//   as of old (the rounded blob it always was);
//   bigger, or smaller;
//   longer north to south, or east to west;
//   more broken along its coast (deep bays, long capes, winding);
//   split into two or three pieces with straits between them (bridged:
//     see bridges.js);
//   with a great bay bitten into one side, or bent round a bay into a
//     crescent;
// each turned a little its own way. (A mod's world map sets the lands
// itself: none of this then.) The Dagoni Islands stay inside the storm and
// clear of each other, and every land clear of the rest and on the map.
import { RNG, hash4, hashString } from '../util/rng.js';
import { MAP_W, MAP_H, REGION_W, REGION_D } from '../config.js';
import { STORM, CORE } from './geography.js';

// What a land's shape is called (for the world map, and folk's talk).
export const SHAPE_WORDS = {
  classic: null,
  big: 'larger than the old charts have it',
  small: 'smaller than the old charts have it',
  tall: 'long from north to south',
  wide: 'long from east to west',
  curvy: 'all bays and capes',
  split: (n) => `in ${n === 3 ? 'three' : 'two'} pieces, bridged across the straits`,
  bay: 'with a great bay bitten into it',
  crescent: 'bent round a bay like a new moon',
};

const DAGONI_W = [['classic', 2.2], ['big', 0.8], ['small', 0.9], ['tall', 1], ['wide', 1], ['curvy', 1.6], ['split', 1.1], ['bay', 1]];
const FAR_W = [['classic', 0.8], ['big', 1.3], ['small', 0.9], ['tall', 1.1], ['wide', 1], ['curvy', 1.4], ['split', 1.8], ['bay', 1], ['crescent', 0.8]];
// (The fire island keeps its mountain whole: never split, never bitten.)
const KEEP_WHOLE = new Set(['kharos']);

// Where a rounded blob of half-sizes (trx, trz) in tiles reaches along a
// direction (cos, sin), turned by `ang`: its edge, in tiles.
function reach(trx, trz, ang, dc, ds) {
  const c = Math.cos(ang);
  const sn = Math.sin(ang);
  const u = (dc * c + ds * sn) / trx;
  const w = (-dc * sn + ds * c) / trz;
  return CORE / Math.cbrt(Math.abs(u) ** 3 + Math.abs(w) ** 3);
}

// The pieces of a land as blobs in tiles: [{ x, z, trx, trz, ang }].
function blobsOf(S) {
  const cx = (S.cx + 0.5) * REGION_W;
  const cz = (S.cz + 0.5) * REGION_D;
  if (!S.parts) return [{ x: cx, z: cz, trx: S.rx * REGION_W, trz: S.rz * REGION_D, ang: 0 }];
  return S.parts.map((P) => ({ x: cx + P.ox * REGION_W, z: cz + P.oz * REGION_D, trx: P.rx * REGION_W, trz: P.rz * REGION_D, ang: P.ang || 0 }));
}

// Points round each piece's edge, stretched by `k` (for the checks below).
function rim(S, k, n = 20) {
  const out = [];
  const warp = (S.warp || 0) * REGION_D;
  for (const b of blobsOf(S)) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const dc = Math.cos(a);
      const ds = Math.sin(a);
      const r = reach(b.trx, b.trz, b.ang, dc, ds) * k + warp;
      out.push([b.x + dc * r, b.z + ds * r]);
    }
  }
  return out;
}

// The storm's ellipse at (x, z) in tiles: below 1 inside it.
function stormR(x, z) {
  return Math.hypot((x / REGION_W - STORM.cx) / STORM.rx, (z / REGION_D - STORM.cz) / STORM.rz);
}

// How far past its blobs' edges a land's coast can run (its roughness).
const spread = (S) => 1 + (S.rough || 0.3) * 0.5;

// Is the shaped land somewhere it may be? `others`: those settled already.
function fits(S, others) {
  const outer = 1 + (STORM.band + 2) / STORM.rx;
  for (const [x, z] of rim(S, 1)) {
    if (x < REGION_W || z < REGION_D || x > (MAP_W - 1) * REGION_W || z > (MAP_H - 1) * REGION_D) return false;
  }
  for (const [x, z] of rim(S, spread(S) + 0.08)) {
    const r = stormR(x, z);
    // (The Dagoni Islands well inside the storm; the rest of the world well
    // out beyond it.)
    if (S.kind === 'dagoni' ? r > 0.9 : r < outer) return false;
  }
  const kS = spread(S);
  for (const o of others) {
    const ob = blobsOf(o);
    const ko = spread(o);
    for (const [x, z] of rim(S, kS, 14)) {
      for (const b of ob) {
        const dx = x - b.x;
        const dz = z - b.z;
        const d = Math.hypot(dx, dz) || 1;
        if (d < reach(b.trx, b.trz, b.ang, dx / d, dz / d) * ko + (o.warp || 0) * REGION_D) return false;
      }
    }
  }
  return true;
}

// Split into `n` pieces along a line at angle `phi`, a strait of `gap`
// tiles between each and the next (the whole about as big as it was).
function split(S, rng, n, gap) {
  const trx = S.rx * REGION_W;
  const trz = S.rz * REGION_D;
  const phi = (trx >= trz * 1.15 ? 0 : trz >= trx * 1.15 ? Math.PI / 2 : rng.float(0, Math.PI)) + rng.float(-0.45, 0.45);
  const dc = Math.cos(phi);
  const ds = Math.sin(phi);
  const w = [];
  for (let i = 0; i < n; i++) w.push(rng.float(0.65, 1.35));
  const tot = w.reduce((a, b) => a + b, 0);
  const pieces = w.map((wi) => {
    const k = Math.sqrt(wi / tot) * (n === 2 ? 1.06 : 1.1);
    return { trx: trx * k * rng.float(0.9, 1.1), trz: trz * k * rng.float(0.9, 1.1), ang: rng.float(-0.5, 0.5), t: 0, side: 0 };
  });
  // Laid end to end along the line, a strait between each and the next.
  let t = 0;
  pieces.forEach((P, i) => {
    if (i > 0) {
      const prev = pieces[i - 1];
      t += reach(prev.trx, prev.trz, prev.ang, dc, ds) + gap + reach(P.trx, P.trz, P.ang, dc, ds);
    }
    P.t = t;
    P.side = rng.float(-0.28, 0.28) * Math.min(P.trx, P.trz);
  });
  // (Their middle where the land's middle was.)
  const area = pieces.reduce((a, P) => a + P.trx * P.trz, 0);
  const mid = pieces.reduce((a, P) => a + P.t * P.trx * P.trz, 0) / area;
  S.parts = pieces.map((P) => {
    const along = P.t - mid;
    const x = dc * along - ds * P.side;
    const z = ds * along + dc * P.side;
    return { ox: x / REGION_W, oz: z / REGION_D, rx: P.trx / REGION_W, rz: P.trz / REGION_D, ang: P.ang };
  });
  S.chain = pieces.slice(1).map((_, i) => [i, i + 1]);
}

// One land, shaped (a new object: the old one's left as it was).
function shapeOne(L, seed, scale = 1) {
  const rng = new RNG(hash4(seed >>> 0, hashString(L.key), 0x5a9e));
  const dag = L.kind === 'dagoni';
  const whole = KEEP_WHOLE.has(L.key);
  const list = (dag ? DAGONI_W : FAR_W).filter(([k]) => !(whole && (k === 'split' || k === 'bay' || k === 'crescent')));
  const kind = rng.weighted(list);
  const S = { ...L, shape: { kind } };
  let k = scale;
  if (kind === 'big') k *= dag ? rng.float(1.04, 1.1) : rng.float(1.12, 1.3);
  if (kind === 'small') k *= dag ? rng.float(0.84, 0.92) : rng.float(0.7, 0.86);
  S.rx *= k;
  S.rz *= k;
  if (kind === 'tall') {
    S.rz *= rng.float(1.22, 1.45);
    S.rx *= rng.float(0.74, 0.86);
  }
  if (kind === 'wide') {
    S.rx *= rng.float(1.22, 1.42);
    S.rz *= rng.float(0.74, 0.86);
  }
  // (A touch more on top, now and then: a long land broken along its
  // coast, a big one split.)
  const more = kind !== 'classic' && rng.chance(0.3) ? rng.pick(['curvy', 'turn']) : 'turn';
  const curvy = kind === 'curvy' || more === 'curvy';
  if (curvy) {
    S.rough = (S.rough || 0.3) * rng.float(1.45, 1.85);
    S.warp = rng.float(0.16, 0.26) * Math.min(S.rx * (REGION_W / REGION_D), S.rz);
    S.shape.curvy = true;
  }
  const ang = rng.float(-0.42, 0.42) * (dag ? 0.6 : 1);
  if (kind === 'split') {
    const n = !dag && (L.kind === 'continent' || rng.chance(0.3)) && rng.chance(0.55) ? 3 : 2;
    const gap = dag ? rng.float(26, 48) : L.kind === 'continent' ? rng.float(60, 120) : rng.float(30, 64);
    split(S, rng, n, gap);
    S.shape.n = n;
  } else {
    S.parts = [{ ox: 0, oz: 0, rx: S.rx, rz: S.rz, ang }];
    if (kind === 'bay' || kind === 'crescent') {
      const a = rng.float(0, Math.PI * 2);
      const into = kind === 'crescent' ? rng.float(0.22, 0.38) : rng.float(0.62, 0.78);
      const r = kind === 'crescent' ? rng.float(0.55, 0.68) : rng.float(0.32, 0.46);
      S.bites = [{ ox: Math.cos(a) * S.rx * into, oz: Math.sin(a) * S.rz * into, rx: S.rx * r, rz: S.rz * r }];
    }
  }
  return S;
}

// Every landmass of `defs`, shaped for `seed`. Each tries its shape at
// full size, then a little smaller, and keeps the old one if it can't be
// made to fit.
export function shapeLands(defs, seed) {
  // (The Dagoni Islands first, then the great lands, then the far isles:
  // the bigger have the first pick of the sea, but leave room for those
  // still to come as they always were, so the old shape's always there to
  // fall back on.)
  const order = defs.map((L, i) => ({ L, i, w: L.kind === 'dagoni' ? 0 : L.kind === 'continent' ? 1 : 2 })).sort((a, b) => a.w - b.w || a.i - b.i);
  const out = new Array(defs.length);
  const done = [];
  order.forEach(({ L, i }, n) => {
    const others = [...done, ...order.slice(n + 1).map((q) => q.L)];
    let S = null;
    for (const k of [1, 0.92, 0.84, 0.76, 0.68]) {
      const t = shapeOne(L, seed, k);
      if (fits(t, others)) {
        S = t;
        break;
      }
    }
    // (No room for it as it'd be: as it always was.)
    if (!S) S = { ...L, shape: { kind: 'classic' } };
    done.push(S);
    out[i] = S;
  });
  return out;
}

// What's to be said of a land's shape (or null: as the old charts have it).
export function shapeWords(L) {
  const sh = L && L.shape;
  if (!sh || sh.kind === 'classic') return sh && sh.curvy ? SHAPE_WORDS.curvy : null;
  const w = SHAPE_WORDS[sh.kind];
  const main = typeof w === 'function' ? w(sh.n) : w;
  return sh.curvy && sh.kind !== 'curvy' ? `${main}, and all bays and capes` : main;
}
