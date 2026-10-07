// (Round 71) The forge's kit (see forge.js): what the masters are built of.
// Each builds onto the sculptor's (see sculpt.js) in the master's own
// picture, sixty-four pixels square (or a hundred and twenty-eight), facing
// left, three-quarters on, its feet at the bottom middle; or onto a part's
// own little picture, its hinge where it hangs.
//   For those that stand as people do: where everything is (`stance`, a
// build tall or squat, broad or gaunt, hunched, mid-stride as it walks),
// legs, a body (muscled, gaunt, skeletal, fat, armoured), heads (a skull,
// a man's, a helm, a hood, a beast's, horned), what's worn (plate, mail,
// a cape, a robe, belts, pauldrons spiked or not, crowns), and the arms
// as parts, the one with its weapon (swords, axes, hammers, spears,
// staves, scythes, maces, censers, lanterns, claws) and the other.
import { hex, mix, shade, toHex } from './pixel.js';
import { hash2 } from './paint.js';

const TAU = Math.PI * 2;
export const dk = (c, k = 0.72) => toHex(shade(hex(c), k));
export const lt = (c, k = 1.25) => toHex(shade(hex(c), k));
export const mx = (a, b, k) => toHex(mix(hex(a), hex(b), k));

// The groups of a standing figure, back to front.
export const HG = { cape: 0, armF: 1, legF: 2, legN: 3, skirt: 4, torso: 5, armor: 6, belt: 7, neck: 8, head: 9, front: 10 };

// ------------------------------------------------------------ stance
// Where its joints are (on J), for a figure `h` tall and `w` broad (1: the
// whole height of its picture, shoulders a good third of it), `hunch`ed
// forward, mid-stride as it walks.
export function stance(J, o = {}) {
  const h = (o.h ?? 1) * 1.03;
  const w = (o.w ?? 1) * 1.12;
  const b = J.b * (o.breath ?? 1);
  const hunch = o.hunch ?? 0;
  const G = 62;
  const P = (x, y, lift = 0) => ({ x: 32 + (x - 32) * w, y: G - (G - y) * h - lift });
  const walk = J.st && J.st.walk;
  const s = walk ? Math.sin(J.t * TAU) : 0;
  const c = walk ? Math.cos(J.t * TAU) : 0;
  const lf = walk ? Math.max(0, c) * 2.5 : 0;
  const ln = walk ? Math.max(0, -c) * 2.5 : 0;
  const bob = walk ? Math.abs(s) * 1.2 : 0;
  J.anF = { x: P(25.5, 59.5).x + s * 4.5, y: G - 2.5 - lf };
  J.anN = { x: P(38.5, 59.5).x - s * 4.5, y: G - 2.5 - ln };
  J.knF = { x: P(26, 48.5).x + s * 2.5 - (o.knees ?? 0), y: P(25, 48.5).y - lf * 0.6 };
  J.knN = { x: P(38, 48.5).x - s * 2.5 + (o.knees ?? 0), y: P(39, 48.5).y - ln * 0.6 };
  J.hipF = P(27.8, 37.5, bob);
  J.hipN = P(36.2, 37.5, bob);
  J.pelvis = P(32, 35, bob);
  J.waist = P(32, 30.5, b * 0.4 + bob);
  J.chest = P(32.5, 22.5, b + bob);
  J.neck = { x: P(31, 15).x - hunch * 0.6, y: P(31, 15, b + bob).y + hunch * 0.5 };
  J.head = { x: P(30.5, 9.5).x - hunch * 1.4, y: P(30.5, 9.5, b + bob).y + hunch * 1.1 };
  J.shF = P(21.5, 17.5, b + bob);
  J.shN = P(42.5, 17.5, b + bob);
  J.elF = P(18, 27, b + bob);
  J.hdF = P(16.5, 35, b + bob);
  J.elN = P(46, 27, b + bob);
  J.hdN = P(46.5, 35, b + bob);
  J.h = h;
  J.w = w;
  return J;
}

// ------------------------------------------------------------ the body
// Two legs, hip to knee to foot: `col`/`mat` the leg (skin, cloth, mail,
// bone...), `r` how thick, `boot` and `greave` worn over them, `claw` toes,
// `hoof`.
export function legs(X, J, o = {}) {
  const r = o.r ?? 4.2;
  const col = o.col || '#6a5a4a';
  const mat = o.mat || 'cloth';
  for (const [g, hp, kn, an, far] of [[HG.legF, J.hipF, J.knF, J.anF, true], [HG.legN, J.hipN, J.knN, J.anN, false]]) {
    X.in(g, 1.6);
    const z = far ? -2 : 1;
    const c = far ? dk(col, 0.82) : col;
    if (o.bone) {
      X.limb([[hp.x, hp.y, r * 0.45, z + 2], [kn.x, kn.y, r * 0.38, z + 3]], c, 'bone');
      X.ball(kn.x, kn.y, r * 0.55, r * 0.5, c, 'bone', { z: z + 4, rz: 2 });
      X.limb([[kn.x, kn.y, r * 0.36, z + 3], [an.x, an.y, r * 0.3, z + 3]], c, 'bone');
    } else {
      // Thigh, swelling to the muscle; the knee; the calf.
      X.limb([[hp.x, hp.y, r, z + 2], [(hp.x + kn.x) / 2, (hp.y + kn.y) / 2 - 0.5, r * 1.02, z + 3], [kn.x, kn.y, r * 0.72, z + 3]], c, mat);
      X.ball(kn.x, kn.y, r * 0.66, r * 0.6, c, mat, { z: z + 4, rz: r * 0.5 });
      X.limb([[kn.x, kn.y, r * 0.7, z + 3], [kn.x + (an.x - kn.x) * 0.35, kn.y + (an.y - kn.y) * 0.35, r * 0.8, z + 3.5], [an.x, an.y - 0.5, r * 0.48, z + 3]], c, mat);
    }
    if (o.greave) {
      X.limb([[kn.x, kn.y + 0.5, r * 0.82, z + 5], [kn.x + (an.x - kn.x) * 0.3, kn.y + (an.y - kn.y) * 0.3, r * 0.88, z + 5.4], [an.x, an.y - 1.2, r * 0.62, z + 5]], o.greave, o.greaveMat || 'metal');
      X.ball(kn.x - 0.4, kn.y, r * 0.78, r * 0.7, lt(o.greave, 1.06), o.greaveMat || 'metal', { z: z + 6.5, rz: 2.2 });
      X.tube(kn.x - 0.8, kn.y - 0.4, kn.x - 2.6, kn.y - 0.8, 0.8, 0.2, o.greave, o.greaveMat || 'metal', { z: z + 7 });
      if (o.thigh) X.limb([[hp.x, hp.y + 1, r * 1.05, z + 4], [kn.x, kn.y - 1.4, r * 0.82, z + 4.5]], o.thigh, o.thighMat || o.greaveMat || 'metal');
    }
    // The foot.
    const fc = o.boot || (o.bone ? c : col);
    const fm = o.boot ? o.bootMat || 'leather' : o.bone ? 'bone' : mat;
    if (o.hoof) {
      X.ball(an.x - 0.6, an.y + 1.3, r * 0.8, r * 0.55, o.hoof, 'chitin', { z: z + 4, rz: 1.6 });
    } else {
      X.limb([[an.x + 0.8, an.y, r * 0.62, z + 3], [an.x - r * 0.9, an.y + 1.6, r * 0.55, z + 4], [an.x - r * 1.5, an.y + 2, r * 0.42, z + 4]], fc, fm);
      if (o.claw) for (let i = 0; i < 3; i++) X.tube(an.x - r * 1.4, an.y + 1.5 + i * 0.4, an.x - r * 2.1, an.y + 2.4 + i * 0.3, 0.6, 0.2, o.claw, 'bone', { z: z + 5 });
    }
  }
}

// The trunk of it: chest, belly, hips, neck. `build`: 'muscle' (great
// pectorals and a belly of muscle), 'lean', 'gaunt' (ribs showing),
// 'skeletal' (a ribcage and spine and nothing else), 'fat'.
export function torso(X, J, o = {}) {
  const col = o.col || '#c89a74';
  const mat = o.mat || 'skin';
  const w = (o.wide ?? 1) * J.w;
  const build = o.build || 'muscle';
  X.in(HG.torso, 2.4);
  const c = J.chest;
  const wa = J.waist;
  const pv = J.pelvis;
  if (build === 'skeletal') {
    // The spine, the pelvis, the ribs in arcs, the breastbone.
    X.limb([[pv.x + 1, pv.y, 1.6, 2], [wa.x + 1.5, wa.y, 1.5, 2], [c.x + 1, c.y, 1.5, 2], [J.neck.x + 0.5, J.neck.y, 1.3, 2]], o.bone || '#e0d8c0', 'bone');
    X.ball(pv.x, pv.y + 0.5, 6.5 * w, 3.4, o.bone || '#e0d8c0', 'bone', { z: 3, rz: 2 });
    for (let i = 0; i < 6; i++) {
      const y = c.y - 6 + i * 2.4;
      const half = (9.5 - Math.abs(i - 2) * 0.9) * w;
      X.limb([[c.x - half, y + 1.5, 0.9, 5], [c.x - half * 0.55, y - 0.6, 1, 6], [c.x, y + 0.3, 0.9, 7]], o.bone || '#e0d8c0', 'bone');
      X.limb([[c.x + half, y + 1.5, 0.9, 5], [c.x + half * 0.55, y - 0.6, 1, 6], [c.x, y + 0.3, 0.9, 7]], o.bone || '#e0d8c0', 'bone');
    }
    X.limb([[c.x, c.y - 7, 1.2, 8], [c.x, c.y + 4, 1, 8]], o.bone || '#e0d8c0', 'bone');
    return;
  }
  const fat = build === 'fat';
  const gaunt = build === 'gaunt' || build === 'lean';
  // Chest and its two great muscles, the belly, the hips.
  X.ball(c.x, c.y + 0.5, (gaunt ? 8.6 : 10.5) * w, 8, col, mat, { rz: 7 });
  if (!gaunt) {
    X.ball(c.x - 4.6 * w, c.y - 1, 5.2 * w, 4.2, col, mat, { z: 3, rz: 3.2 });
    X.ball(c.x + 4.6 * w, c.y - 0.8, 5.6 * w, 4.4, col, mat, { z: 3.5, rz: 3.4 });
  }
  X.ball(wa.x, wa.y, (fat ? 10 : gaunt ? 6.4 : 7.6) * w, fat ? 7 : 5.6, col, mat, { z: fat ? 4 : 2, rz: fat ? 7 : 4 });
  X.ball(pv.x, pv.y, (gaunt ? 6.6 : 7.8) * w, 4.6, col, mat, { rz: 4 });
  // The neck, and the muscle from it to the shoulders.
  X.limb([[c.x - 0.5, c.y - 4, (gaunt ? 2.6 : 3.6) * w, 2], [J.neck.x, J.neck.y, (gaunt ? 2.2 : 3) * w, 2]], col, mat);
  if (!gaunt) {
    X.limb([[J.neck.x - 1, J.neck.y + 1, 1.8, 3], [J.shF.x + 2, J.shF.y, 2.4, 3]], col, mat);
    X.limb([[J.neck.x + 1, J.neck.y + 1, 1.8, 3], [J.shN.x - 2, J.shN.y, 2.4, 3]], col, mat);
  }
  if (build === 'muscle' && !o.covered) {
    // The belly's muscle in its blocks.
    for (let r = 0; r < 3; r++) for (const s of [-1, 1]) X.ball(wa.x + s * 2.1 * w, wa.y - 4 + r * 2.6, 1.9 * w, 1.3, col, mat, { z: 5, rz: 1 });
  }
}
// Paint the ribs showing through a gaunt one's skin.
export function ribs(P, J, col = '#3a2a24', n = 4) {
  for (let i = 0; i < n; i++) {
    const y = Math.round(J.chest.y - 1 + i * 2.2);
    for (let k = 0; k < 4; k++) {
      P.set(J.chest.x - 6 + k, y + (k > 1 ? 1 : 0), shade(hex(col), 1));
      P.set(J.chest.x + 3 + k, y + (k < 2 ? 1 : 0), shade(hex(col), 1));
    }
  }
}

// A plate over the chest (and belly), ridged down its middle; `skirt`, the
// plates hung from it over the hips.
export function breastplate(X, J, o = {}) {
  const col = o.col || '#8a8a98';
  const mat = o.mat || 'metal';
  const c = J.chest;
  const w = (o.wide ?? 1) * J.w;
  X.in(HG.armor, 1.2);
  // The cuirass over the chest, swelling over the muscle under it.
  X.slab([[c.x - 10 * w, c.y - 5], [c.x - 3, c.y - 7.5], [c.x + 4, c.y - 7.5], [c.x + 10.5 * w, c.y - 4.5], [c.x + 9.5 * w, c.y + 4], [c.x + 6, c.y + 6.5], [c.x - 6, c.y + 6.5], [c.x - 9.5 * w, c.y + 4]], col, mat, { z: 9, rz: 3.4, bevel: 2.6 });
  // Its trim along the neck, raised.
  if (o.trim) X.limb([[c.x - 9 * w, c.y - 4.8, 0.8, 12], [c.x - 3, c.y - 7.2, 0.8, 12.6], [c.x + 4, c.y - 7.2, 0.8, 12.6], [c.x + 9.6 * w, c.y - 4.4, 0.8, 12]], o.trim, o.trimMat || 'gold');
  // The lames over the belly, each a little in under the one above.
  const lames = o.lames ?? 3;
  for (let i = 0; i < lames; i++) {
    const y0 = c.y + 5.5 + i * 2.6;
    const half = (8.8 - i * 0.6) * w;
    X.slab([[c.x - half, y0], [c.x + half, y0 - 0.2], [c.x + half - 0.4, y0 + 3], [c.x - half + 0.4, y0 + 3.2]], i % 2 ? dk(col, 0.92) : col, mat, { z: 8.6 - i * 0.3, rz: 1.6, bevel: 1.1 });
  }
  if (o.ridge !== false) X.tube(c.x, c.y - 6.5, c.x, c.y + 5, 0.8, 0.8, lt(col, 1.1), mat, { z: 12.5 });
  if (o.emblem) X.ball(c.x, c.y - 1.5, 2.2, 2.2, o.emblem, o.emblemMat || 'gold', { z: 13, rz: 1.4 });
  if (o.skirt) {
    // Tassets over the thighs, in lames.
    for (const s of [-1, 1]) {
      const x = J.pelvis.x + s * 4.4 * w;
      for (let k = 0; k < 3; k++) {
        const y = J.waist.y + 2.6 + k * 2.4;
        X.slab([[x - 3.6, y], [x + 3.6, y], [x + 3.4 + s * 0.6, y + 3], [x - 3.4 + s * 0.6, y + 3]], k % 2 ? dk(o.skirt, 0.88) : o.skirt, o.skirtMat || mat, { z: 8 - k * 0.3 + (s > 0 ? 0.5 : 0), rz: 1.3, bevel: 0.9 });
      }
    }
  }
}
// A belt round its waist, a buckle on it.
export function belt(X, J, o = {}) {
  X.in(HG.belt, 1);
  const w = J.w * (o.wide ?? 1);
  X.limb([[J.waist.x - 8.4 * w, J.waist.y + 2.6, 1.6, 9], [J.waist.x, J.waist.y + 3.4, 1.7, 11], [J.waist.x + 8.6 * w, J.waist.y + 2.6, 1.6, 9]], o.col || '#4a3020', 'leather');
  if (o.buckle) X.ball(J.waist.x + 1, J.waist.y + 3.4, 2, 1.8, o.buckle, o.buckleMat || 'gold', { z: 13, rz: 1 });
}
// A shoulder's plate (and spikes off it).
export function pauldron(X, at, o = {}) {
  const col = o.col || '#8a8a98';
  const mat = o.mat || 'metal';
  const r = o.r ?? 5.6;
  X.ball(at.x, at.y - 0.6, r, r * 0.78, col, mat, { z: o.z ?? 12, rz: r * 0.7 });
  X.ball(at.x, at.y + r * 0.42, r * 1.02, r * 0.38, dk(col, 0.9), mat, { z: (o.z ?? 12) - 0.4, rz: 1.5 });
  X.ball(at.x + 0.3, at.y + r * 0.8, r * 0.92, r * 0.32, dk(col, 0.82), mat, { z: (o.z ?? 12) - 0.8, rz: 1.3 });
  if (o.trim) X.ball(at.x - 0.3, at.y - r * 0.55, r * 0.7, r * 0.22, o.trim, o.trimMat || 'gold', { z: (o.z ?? 12) + 1.4, rz: 0.8 });
  for (let i = 0; i < (o.spikes || 0); i++) {
    const a = -Math.PI / 2 + (i - (o.spikes - 1) / 2) * 0.55;
    X.tube(at.x + Math.cos(a) * r * 0.6, at.y + Math.sin(a) * r * 0.6, at.x + Math.cos(a) * (r + (o.spikeLen || 4)), at.y + Math.sin(a) * (r + (o.spikeLen || 4)), 1.3, 0.15, o.spikeCol || lt(col, 1.15), o.spikeMat || mat, { z: (o.z ?? 12) + 1 });
  }
}
// A cape from the shoulders, falling behind it, its hem ragged (`ragged`)
// or straight; drawn whole here (or see capePart, to sway).
export function capeShape(o, w, h) {
  const n = o.ragged ? 7 : 3;
  const top = [[w * 0.18, 2], [w * 0.5, 0], [w * 0.82, 2]];
  const hem = [];
  for (let i = n; i >= 0; i--) {
    const x = w * 0.06 + (w * 0.88 * i) / n;
    const y = h - 2 - (o.ragged ? (i % 2 ? 5 : 0) + hash2(i, 3, 9) * 3 : 0);
    hem.push([x, y]);
  }
  return [...top, [w * 0.96, h * 0.6], ...hem, [w * 0.04, h * 0.6]];
}

// ------------------------------------------------------------ heads
// A head at `at` (its middle): `kind` 'man' (a face: brow, nose, jaw,
// ears), 'skull', 'beast' (a muzzle: a wolf's, a bull's, a boar's: `snout`),
// 'helm' (a closed helm: `visor`), 'hood' (a hood, its face in shadow);
// `r` its size; `horns`, `crown`, `hair` worn or grown on it.
export function head(X, at, o = {}) {
  const r = o.r ?? 5.4;
  const kind = o.kind || 'man';
  const col = o.col || '#c89a74';
  const mat = o.mat || (kind === 'skull' ? 'bone' : 'skin');
  X.in(HG.head, 1.6);
  if (kind === 'skull') {
    X.ball(at.x + 0.4, at.y - 0.6, r * 1.02, r * 0.98, col, 'bone', { rz: r * 0.9, z: 14 });
    X.ball(at.x - r * 0.45, at.y + r * 0.35, r * 0.62, r * 0.55, col, 'bone', { z: 15.5, rz: r * 0.4 });
    X.ball(at.x - r * 0.25, at.y + r * 0.95, r * 0.66, r * 0.34, dk(col, 0.92), 'bone', { z: 14.5, rz: r * 0.3 });
  } else if (kind === 'beast') {
    const sn = o.snout ?? 1;
    X.ball(at.x + 0.6, at.y - 0.4, r, r * 0.92, col, mat, { rz: r * 0.85, z: 14 });
    X.limb([[at.x - r * 0.2, at.y + r * 0.1, r * 0.7, 15], [at.x - r * (0.9 + 0.5 * sn), at.y + r * 0.45, r * 0.5, 16.5]], col, mat);
    X.ball(at.x - r * (1.05 + 0.5 * sn), at.y + r * 0.4, r * 0.42, r * 0.38, o.nose || dk(col, 0.5), 'flesh', { z: 18, rz: 1.2 });
    X.limb([[at.x - r * 0.1, at.y + r * 0.6, r * 0.5, 14], [at.x - r * (0.7 + 0.4 * sn), at.y + r * 0.95, r * 0.32, 15]], dk(col, 0.92), mat);
  } else if (kind === 'helm') {
    // A closed helm: its bowl, a ridge over it, the face-plate with its
    // eye-slit and breaths, a rim at the neck.
    const hm = o.helmMat || 'metal';
    X.ball(at.x + 0.3, at.y - 0.3, r * 1.05, r * 1.08, col, hm, { rz: r * 0.9, z: 14 });
    X.tube(at.x + r * 0.9, at.y - r * 0.4, at.x - r * 0.5, at.y - r * 1.05, r * 0.16, r * 0.16, lt(col, 1.12), hm, { z: 17 });
    X.slab([[at.x - r * 1.08, at.y - r * 0.2], [at.x + r * 0.15, at.y - r * 0.3], [at.x + r * 0.1, at.y + r * 1.15], [at.x - r * 0.85, at.y + r * 1.05]], dk(col, 0.94), hm, { z: 15.5, rz: 2, bevel: 1.2 });
    X.ball(at.x + 0.3, at.y + r * 0.95, r * 1.0, r * 0.32, dk(col, 0.85), hm, { z: 14.6, rz: 1 });
  } else if (kind === 'hood') {
    // A hood: its peak falling back, the cloth draped on the shoulders, its
    // rim turned back about the dark it hides the face in.
    const hm = o.hoodMat || 'cloth';
    X.ball(at.x + 1.2, at.y - 0.4, r * 1.12, r * 1.08, col, hm, { rz: r, z: 13 });
    X.limb([[at.x + r * 0.6, at.y - r * 0.8, r * 0.55, 13], [at.x + r * 1.3, at.y - r * 0.6, r * 0.32, 12.5], [at.x + r * 1.8, at.y + r * 0.2, r * 0.12, 12]], col, hm);
    X.slab([[at.x - r * 1.1, at.y + r * 0.6], [at.x + r * 1.6, at.y + r * 0.5], [at.x + r * 2, at.y + r * 1.7], [at.x - r * 1.5, at.y + r * 1.8]], dk(col, 0.9), hm, { z: 12, rz: 2, bevel: 1.6 });
    const opening = [];
    for (let i = 0; i <= 10; i++) {
      const a = Math.PI * 0.5 + (i / 10) * Math.PI * 1.2;
      opening.push([at.x - r * 0.3 + Math.cos(a) * r * 0.78, at.y + r * 0.2 + Math.sin(a) * r * 0.9, r * 0.16, 15.4]);
    }
    X.limb(opening, lt(col, 1.12), hm);
    X.ball(at.x - r * 0.35, at.y + r * 0.2, r * 0.66, r * 0.8, '#0c0810', 'ink', { z: 15.6, rz: 0.4 });
  } else {
    // A man's head: the skull, the brow, the cheek and jaw, the nose
    // standing off the face, an ear.
    X.ball(at.x + 0.6, at.y - 0.8, r, r * 0.95, col, mat, { rz: r * 0.85, z: 14 });
    X.ball(at.x - r * 0.35, at.y + r * 0.42, r * 0.72, r * 0.62, col, mat, { z: 15, rz: r * 0.5 });
    X.tube(at.x - r * 0.9, at.y - r * 0.32, at.x - r * 0.2, at.y - r * 0.36, r * 0.2, r * 0.2, col, mat, { z: 16.4 });
    X.ball(at.x + r * 0.64, at.y + 0.2, r * 0.26, r * 0.36, dk(col, 0.88), mat, { z: 14.6, rz: 0.8 });
    X.tube(at.x - r * 0.88, at.y - r * 0.2, at.x - r * 1.12, at.y + r * 0.28, r * 0.17, r * 0.22, col, mat, { z: 16.8 });
  }
  if (o.hair) {
    const st = o.hairStyle || (o.hairLong ? 'long' : 'short');
    if (st !== 'bald') {
      // A cap of hair over the crown and back of the head, its fringe.
      X.ball(at.x + r * 0.35, at.y - r * 0.62, r * 1.02, r * 0.58, o.hair, 'hair', { z: 15.6, rz: 2.4 });
      X.ball(at.x + r * 0.75, at.y - r * 0.1, r * 0.55, r * 0.75, o.hair, 'hair', { z: 15.2, rz: 2 });
      for (let i = 0; i < 3; i++) X.tube(at.x - r * 0.2 - i * r * 0.28, at.y - r * 0.9, at.x - r * 0.45 - i * r * 0.3, at.y - r * 0.42, r * 0.22, r * 0.08, o.hair, 'hair', { z: 16.6 });
    }
    if (st === 'long') X.limb([[at.x + r * 0.7, at.y - r * 0.2, r * 0.6, 13], [at.x + r * 1.1, at.y + r * 1.6, r * 0.55, 12], [at.x + r * 1.25, at.y + r * 2.9, r * 0.3, 11]], o.hair, 'hair');
    if (st === 'wild') for (let i = 0; i < 7; i++) X.tube(at.x + r * 0.3, at.y - r * 0.5, at.x + r * 0.3 + Math.cos(-2.8 + i * 0.5) * r * 1.6, at.y - r * 0.5 + Math.sin(-2.8 + i * 0.5) * r * 1.4, r * 0.26, r * 0.06, i % 2 ? o.hair : dk(o.hair, 0.8), 'hair', { z: 13 });
  }
  if (o.beard) X.limb([[at.x - r * 0.45, at.y + r * 0.8, r * 0.62, 16], [at.x - r * 0.4, at.y + r * (o.beardLong ? 2.3 : 1.5), r * 0.3, 16]], o.beard, 'hair');
  if (o.horns) {
    const hc = o.hornCol || '#d8ccb0';
    for (const s of [-1, 1]) {
      const bx = at.x + s * r * 0.55 + 0.4;
      const by = at.y - r * 0.6;
      const len = o.hornLen ?? 1;
      if (o.horns === 'ram') X.limb([[bx, by, r * 0.3, 15], [bx + s * r * 0.9, by - r * 0.5, r * 0.26, 15], [bx + s * r * 1.2, by + r * 0.4, r * 0.18, 15], [bx + s * r * 0.7, by + r * 0.8, r * 0.1, 15]], hc, 'bone');
      else if (o.horns === 'antler') {
        X.limb([[bx, by, r * 0.16, 15], [bx + s * r * 0.5, by - r * 1.4 * len, r * 0.13, 15], [bx + s * r * 1.1, by - r * 2.4 * len, r * 0.08, 15]], hc, 'bone');
        X.tube(bx + s * r * 0.3, by - r * 0.9 * len, bx + s * r * 1.2, by - r * 1.3 * len, r * 0.1, r * 0.06, hc, 'bone', { z: 15 });
        X.tube(bx + s * r * 0.7, by - r * 1.8 * len, bx + s * r * 0.4, by - r * 2.7 * len, r * 0.09, r * 0.05, hc, 'bone', { z: 15 });
      } else X.limb([[bx, by, r * 0.3, 15], [bx + s * r * 0.6, by - r * 0.8 * len, r * 0.2, 15], [bx + s * r * 0.4, by - r * 1.7 * len, r * 0.06, 15]], hc, 'bone');
    }
  }
  if (o.crown) crown(X, { x: at.x + 0.6, y: at.y - r * 0.85 }, { r: r * 0.95, ...o.crown });
}
// A crown: a band and its points (`n`), gold or iron, gems in it.
export function crown(X, at, o = {}) {
  const col = o.col || '#d8b040';
  const mat = o.mat || 'gold';
  const r = o.r ?? 5;
  X.in(HG.head, 0.8);
  X.slab([[at.x - r, at.y - 1], [at.x + r, at.y - 1.6], [at.x + r, at.y + 1.4], [at.x - r, at.y + 1.8]], col, mat, { z: 18, rz: 1.5, bevel: 0.8 });
  const n = o.n ?? 5;
  for (let i = 0; i < n; i++) {
    const x = at.x - r + 0.8 + (i * (2 * r - 1.6)) / (n - 1);
    const hgt = (o.tall ?? 3.6) * (i % 2 ? 0.7 : 1);
    X.slab([[x - 1.1, at.y - 1], [x + 1.1, at.y - 1.1], [x, at.y - 1 - hgt]], col, mat, { z: 18.5, rz: 1, bevel: 0.6 });
  }
  if (o.gem) X.ball(at.x, at.y + 0.2, 1.1, 1, o.gem, 'glass', { z: 20, rz: 0.8, glow: o.gem, glowK: 0.4 });
}
// Eyes that burn (painted after): a hot middle and its colour about it.
export function eyes(P, pts, c, o = {}) {
  const k = hex(c);
  for (const [x, y] of pts) {
    if (o.socket) {
      P.set(x - 1, y, [10, 6, 14]);
      P.set(x, y - 1, [10, 6, 14]);
      P.set(x + 1, y, [10, 6, 14]);
      P.set(x, y + 1, [10, 6, 14]);
    }
    P.set(x, y, mix(k, [255, 255, 255], 0.6));
    if (o.big) {
      P.set(x + 1, y, k);
      P.set(x, y + 1, shade(k, 0.7));
    }
  }
}
// A glow laid over (after the outline): a hot core, falling away.
export function glow(P, x, y, r, c, k = 0.8) {
  for (let yy = Math.floor(y - r); yy <= Math.ceil(y + r); yy++) {
    for (let xx = Math.floor(x - r); xx <= Math.ceil(x + r); xx++) {
      const d = Math.hypot(xx + 0.5 - x, yy + 0.5 - y) / (r + 0.01);
      if (d >= 1) continue;
      P.fx(xx, yy, d < 0.3 ? '#ffffff' : c, k * (d < 0.3 ? 0.9 : (1 - d) * 0.9));
    }
  }
}
// A line of light (a rune's stroke, a crack with fire in it).
export function glowLine(P, x0, y0, x1, y1, c, k = 0.9, core = true) {
  const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0)));
  for (let i = 0; i <= n; i++) {
    const x = x0 + ((x1 - x0) * i) / n;
    const y = y0 + ((y1 - y0) * i) / n;
    P.fx(x, y, core ? mix(hex(c), [255, 255, 255], 0.5) : c, k);
  }
}
// Strands of fur (or hair) over what's painted as `mat`: each lock a run of
// lighter pixels down the way it lies, its tip lightest, a darker one
// beside it.
export function strands(P, mat = 'fur', o = {}) {
  const X = P.X;
  if (!X || !X.owner) return;
  const W = P.w;
  const H = P.h;
  const dens = o.density ?? 0.11;
  const len = o.len ?? 4;
  const dir = o.dir ?? [0.35, 1];
  const dl = Math.hypot(dir[0], dir[1]);
  const ux = dir[0] / dl;
  const uy = dir[1] / dl;
  const isMat = (x, y) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return false;
    const i = X.owner[y * W + x];
    return i >= 0 && X.prims[i].mat === mat;
  };
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!isMat(x, y) || hash2(x, y, 77) > dens) continue;
      const base = P.get(x, y);
      const L = len * (0.6 + hash2(x, y, 78) * 0.8);
      for (let s = 0; s < L; s++) {
        const px = Math.round(x + ux * s);
        const py = Math.round(y + uy * s);
        if (!isMat(px, py)) break;
        const k = s / L;
        P.set(px, py, shade(base, 1.18 + 0.18 * k));
        if (isMat(px + 1, py)) P.set(px + 1, py, shade(P.get(px + 1, py), 0.82));
      }
    }
  }
}
// Its edge broken into tufts and points (fur standing off it, feathers'
// tips, a ragged hem): spikes out from the edge of what's `mat`.
export function fringe(P, mat, o = {}) {
  const X = P.X;
  if (!X || !X.owner) return;
  const W = P.w;
  const H = P.h;
  const dens = o.density ?? 0.35;
  const isMat = (x, y) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return false;
    const i = X.owner[y * W + x];
    return i >= 0 && X.prims[i].mat === mat;
  };
  const empty = (x, y) => x >= 0 && y >= 0 && x < W && y < H && !P.get(x, y)[3];
  const adds = [];
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      if (!isMat(x, y)) continue;
      for (const [dx, dy] of [[0, -1], [-1, 0], [1, 0], [0, 1]]) {
        if (!empty(x + dx, y + dy) || hash2(x, y, 31 + dx * 3 + dy) > dens) continue;
        if (o.up && dy > 0) continue;
        const L = 1 + Math.floor(hash2(x, y, 41) * (o.len ?? 2.4));
        const lean = o.lean ?? 0.4;
        const c = P.get(x, y);
        for (let s = 1; s <= L; s++) adds.push([Math.round(x + dx * s + (dy ? lean * s * (hash2(x, y, 5) > 0.5 ? 1 : -1) : 0)), Math.round(y + dy * s + (dx ? lean * s : 0)), shade(c, 1 - s * 0.08)]);
      }
    }
  }
  for (const [x, y, c] of adds) if (empty(x, y)) P.set(x, y, c);
}
// Rivets along a line (dots of light with a shadow under).
export function rivets(P, pts, c = '#e0e0e8') {
  for (const [x, y] of pts) {
    P.set(x, y, hex(c));
    P.set(x, y + 1, shade(hex(c), 0.45));
  }
}

// ------------------------------------------------------------ weapons
// A weapon held at `hand`, pointing `ang` (radians: 0 right, -π/2 up) on
// the part's picture. Kinds: sword, greatsword, axe, greataxe, hammer,
// mace, spear, staff, scythe, club, cleaver, trident, lantern, censer,
// torch. `col` its blade or head, `grip`, `glow` (a light in it).
export function weapon(X, hand, ang, o = {}) {
  const kind = o.kind || 'sword';
  const c = Math.cos(ang);
  const s = Math.sin(ang);
  const at = (d, side = 0) => [hand.x + c * d - s * side, hand.y + s * d + c * side];
  const col = o.col || '#c8ccd8';
  const grip = o.grip || '#4a3020';
  const z = o.z ?? 6;
  X.in(o.g ?? 3, 0.6);
  const haft = (from, to, r = 1) => X.tube(...at(from), ...at(to), r, r, grip, o.gripMat || 'wood', { z });
  if (kind === 'sword' || kind === 'greatsword' || kind === 'cleaver') {
    const L = o.len ?? (kind === 'greatsword' ? 26 : 17);
    const wd = o.width ?? (kind === 'greatsword' ? 2.4 : kind === 'cleaver' ? 3.4 : 1.7);
    haft(-3.5, 2.5, 1);
    X.ball(...at(-4.2), 1.5, 1.5, o.pommel || '#c8a040', 'gold', { z: z + 1, rz: 1 });
    X.tube(...at(2.4, -wd - 2.6), ...at(2.4, wd + 2.6), 1, 1, o.guard || '#b89040', o.guardMat || 'gold', { z: z + 1.5 });
    const tipSide = kind === 'cleaver' ? wd * 0.8 : 0;
    X.slab([at(3, -wd), at(3, wd), at(L - wd * 1.2, wd), at(L, tipSide), at(L - wd * 1.6, -wd * 0.9)], col, o.mat || 'metal', { z: z + 1, rz: 1.6, bevel: 1.2 });
    // (The fuller down it, a groove.)
    if (kind !== 'cleaver' && wd >= 1.6) X.tube(...at(4), ...at(L * 0.72), 0.45, 0.35, dk(col, 0.6), o.mat || 'metal', { z: z + 2.4 });
  } else if (kind === 'axe' || kind === 'greataxe') {
    const L = o.len ?? (kind === 'greataxe' ? 24 : 16);
    haft(-4, L, 1.1);
    const h = kind === 'greataxe' ? 7 : 5;
    X.slab([at(L - 7, 1), at(L - 8, h), at(L - 2, h + 2), at(L + 1, h - 1), at(L - 1, 1)], col, o.mat || 'metal', { z: z + 1, rz: 1.4, bevel: 1 });
    if (kind === 'greataxe') X.slab([at(L - 6, -1), at(L - 7, -h + 1), at(L - 2, -h - 1), at(L + 0.5, -h + 1.5), at(L - 1, -1)], col, o.mat || 'metal', { z: z + 1, rz: 1.4, bevel: 1 });
  } else if (kind === 'hammer' || kind === 'mace' || kind === 'club') {
    const L = o.len ?? 18;
    haft(-4, L, kind === 'club' ? 1.6 : 1.1);
    if (kind === 'hammer') X.slab([at(L - 3, -5), at(L + 3, -5), at(L + 3, 5), at(L - 3, 5)], col, o.mat || 'metal', { z: z + 1, rz: 2.4, bevel: 1.2 });
    else if (kind === 'mace') {
      X.ball(...at(L), 3.4, 3.4, col, o.mat || 'metal', { z: z + 1, rz: 3 });
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU;
        X.tube(...at(L + Math.cos(a) * 2.6, Math.sin(a) * 2.6), ...at(L + Math.cos(a) * 5.2, Math.sin(a) * 5.2), 1, 0.2, col, o.mat || 'metal', { z: z + 2 });
      }
    } else {
      X.limb([[...at(L - 9), 2, z + 1], [...at(L), 3.4, z + 1]], o.col || '#6a4a2a', 'wood');
      for (let i = 0; i < 4; i++) X.tube(...at(L - 6 + i * 2, i % 2 ? 2.5 : -2.5), ...at(L - 5 + i * 2, i % 2 ? 5 : -5), 0.8, 0.2, '#c8c8c0', 'metal', { z: z + 2 });
    }
  } else if (kind === 'spear' || kind === 'trident' || kind === 'staff' || kind === 'scythe' || kind === 'halberd') {
    const L = o.len ?? 30;
    haft(-(o.butt ?? 8), L, kind === 'staff' ? 1.2 : 1);
    if (kind === 'spear') X.slab([at(L - 1, -1.8), at(L - 1, 1.8), at(L + 7, 0)], col, o.mat || 'metal', { z: z + 1, rz: 1.2, bevel: 0.8 });
    else if (kind === 'trident') {
      X.tube(...at(L, -4), ...at(L, 4), 0.9, 0.9, col, o.mat || 'metal', { z: z + 1 });
      for (const sd of [-4, 0, 4]) X.slab([at(L, sd - 1), at(L, sd + 1), at(L + (sd ? 5 : 7), sd)], col, o.mat || 'metal', { z: z + 1, rz: 1, bevel: 0.6 });
    } else if (kind === 'scythe') {
      const pts = [];
      for (let i = 0; i <= 8; i++) {
        const k = i / 8;
        pts.push(at(L - k * 2, k * 15 + Math.sin(k * Math.PI) * 1));
      }
      for (let i = 8; i >= 0; i--) {
        const k = i / 8;
        pts.push(at(L - 4 - k * 1 + Math.sin(k * Math.PI) * 3, k * 15 * 0.92));
      }
      X.slab(pts, col, o.mat || 'metal', { z: z + 1, rz: 1.2, bevel: 0.8 });
    } else if (kind === 'halberd') {
      X.slab([at(L - 1, -1.5), at(L - 1, 1.5), at(L + 7, 0)], col, o.mat || 'metal', { z: z + 1, rz: 1.2, bevel: 0.8 });
      X.slab([at(L - 6, 0), at(L - 7, 6), at(L - 1, 6), at(L - 2, 0)], col, o.mat || 'metal', { z: z + 1, rz: 1.2, bevel: 0.8 });
    } else if (o.head) o.head(X, at, z);
  } else if (kind === 'bow') {
    // Held at its grip, its limbs along `ang` either way, bowed forward.
    const L = o.len ?? 26;
    const pts = [];
    for (let i = 0; i <= 10; i++) {
      const k = i / 10 - 0.5;
      pts.push([...at(k * L, -Math.cos(k * Math.PI) * 4.5), 1.2 - Math.abs(k) * 1.2 + 0.4, z]);
    }
    X.limb(pts.map(([x, y, r, zz]) => [x, y, r, zz]), col, o.mat || 'wood');
    X.tube(...at(-L / 2, -0.4), ...at(L / 2, -0.4), 0.3, 0.3, o.string || '#e8e0d0', 'cloth', { z: z - 1 });
    X.ball(...at(0, -4.2), 1.3, 1.6, grip, 'leather', { z: z + 1, rz: 1 });
  } else if (kind === 'pick') {
    const L = o.len ?? 18;
    haft(-4, L + 1, 1.1);
    const head = [];
    for (let i = 0; i <= 8; i++) {
      const k = i / 8 - 0.5;
      head.push([...at(L - Math.abs(k) * 4, k * 15), 1.6 - Math.abs(k) * 2.4 + 0.3, z + 1]);
    }
    X.limb(head, col, o.mat || 'metal');
  } else if (kind === 'flail') {
    const L = o.len ?? 10;
    haft(-3, L, 1.1);
    for (let i = 1; i <= 4; i++) X.ball(...at(L + i * 1.6, i * 0.6), 0.7, 0.7, '#7a7a84', 'metal', { z: z + 1 });
    X.ball(...at(L + 8.4, 3.2), 2.8, 2.8, col, o.mat || 'metal', { z: z + 1, rz: 2.4 });
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU;
      X.tube(...at(L + 8.4 + Math.cos(a) * 2.2, 3.2 + Math.sin(a) * 2.2), ...at(L + 8.4 + Math.cos(a) * 4.4, 3.2 + Math.sin(a) * 4.4), 0.8, 0.15, lt(col, 1.1), o.mat || 'metal', { z: z + 2 });
    }
  } else if (kind === 'lantern' || kind === 'censer') {
    // Hung on a chain from the hand.
    const L = o.len ?? 9;
    for (let i = 0; i < L; i += 2) X.ball(...at(i), 0.7, 0.7, '#8a8070', 'metal', { z });
    X.ball(...at(L + 2.5), 3, 3.4, col, o.mat || 'metal', { z: z + 1, rz: 2.4 });
    X.ball(...at(L + 2.5), 1.8, 2.1, o.glow || '#ffd060', 'glass', { z: z + 3, rz: 1, glow: o.glow || '#ffd060', glowK: 0.85 });
  } else if (kind === 'torch') {
    haft(-3, 10, 1.2);
    X.ball(...at(11), 2.4, 2.4, '#3a2a1a', 'wood', { z: z + 1, rz: 1.6 });
  }
}
// Where along it a weapon's light or edge is (for painting after).
export function along(hand, ang, d, side = 0) {
  const c = Math.cos(ang);
  const s = Math.sin(ang);
  return { x: hand.x + c * d - s * side, y: hand.y + s * d + c * side };
}

// ------------------------------------------------------------ arms (parts)
// The arm that swings its weapon, as a part (see forge.js): its shoulder
// the hinge. `r` how thick, `col`/`mat` the arm (or `sleeve`), `pauldron`,
// `gauntlet`, `hand` ('fist', 'bone', 'claw'), and its `weapon` (see
// weapon), held pointing `wang` (radians off straight up; + back).
export function armPart(o = {}) {
  const r = o.r ?? 3.4;
  const L1 = o.L1 ?? 9;
  const L2 = o.L2 ?? 8.5;
  const wk = o.weapon || null;
  const wang = -Math.PI / 2 + (o.wang ?? 0.42);
  const wl = wk ? (wk.len ?? (wk.kind === 'greatsword' ? 26 : wk.kind === 'spear' || wk.kind === 'staff' || wk.kind === 'scythe' || wk.kind === 'halberd' || wk.kind === 'trident' ? 30 : 18)) + 8 : 4;
  // Laid out about the shoulder (0, 0): the elbow, the hand, the tip.
  const el = { x: 1.6, y: L1 };
  const hd = { x: 0.4, y: L1 + L2 };
  const tip = along(hd, wang, wl);
  const butt = along(hd, wang, -10);
  const xs = [0, el.x, hd.x, tip.x, butt.x, -r - 6, r + 6];
  const ys = [0, el.y, hd.y, tip.y, butt.y, -r - 6, hd.y + r + 6];
  const x0 = Math.floor(Math.min(...xs)) - 3;
  const y0 = Math.floor(Math.min(...ys)) - 3;
  const w = Math.ceil(Math.max(...xs)) - x0 + 4;
  const h = Math.ceil(Math.max(...ys)) - y0 + 4;
  const S = { x: -x0, y: -y0 };
  const E = { x: el.x - x0, y: el.y - y0 };
  const H = { x: hd.x - x0, y: hd.y - y0 };
  return {
    w, h, px: S.x, py: S.y, role: o.role || 'weapon', layer: o.layer || 'front', at: o.at, z: o.z ?? 5,
    hand: H, wang,
    body(X) {
      const col = o.col || '#c89a74';
      const mat = o.mat || 'skin';
      X.in(1, 1.8);
      if (o.bone) {
        X.limb([[S.x, S.y, r * 0.45, 2], [E.x, E.y, r * 0.4, 3]], col, 'bone');
        X.ball(E.x, E.y, r * 0.5, r * 0.5, col, 'bone', { z: 4, rz: 1.5 });
        X.limb([[E.x, E.y, r * 0.38, 3], [H.x, H.y, r * 0.32, 3]], col, 'bone');
      } else {
        X.ball(S.x, S.y + 0.5, r * 1.25, r * 1.15, col, mat, { rz: r, z: 1 });
        X.limb([[S.x, S.y + 1, r, 2], [S.x + (E.x - S.x) * 0.5 + 0.6, S.y + (E.y - S.y) * 0.5, r * 1.05, 3], [E.x, E.y, r * 0.75, 3]], col, mat);
        X.limb([[E.x, E.y, r * 0.78, 3], [E.x + (H.x - E.x) * 0.3, E.y + (H.y - E.y) * 0.3, r * 0.85, 3.4], [H.x, H.y - 1, r * 0.6, 3]], o.sleeve && !o.bareArm ? o.sleeve : col, o.sleeve && !o.bareArm ? o.sleeveMat || 'cloth' : mat);
      }
      if (o.sleeve && !o.bareArm) X.limb([[S.x, S.y + 1, r * 1.12, 3], [E.x, E.y, r * 0.95, 4]], o.sleeve, o.sleeveMat || 'cloth');
      if (o.gauntlet) X.limb([[E.x + (H.x - E.x) * 0.35, E.y + (H.y - E.y) * 0.35, r * 0.9, 5], [H.x, H.y - 0.8, r * 0.78, 5]], o.gauntlet, o.gauntletMat || 'metal');
      // The hand round the grip.
      const hc = o.handCol || (o.gauntlet ? o.gauntlet : col);
      const hm = o.handMat || (o.gauntlet ? o.gauntletMat || 'metal' : o.bone ? 'bone' : mat);
      X.ball(H.x, H.y + 0.6, r * 0.78, r * 0.72, hc, hm, { z: 6, rz: r * 0.6 });
      if (o.claw) for (let i = 0; i < 3; i++) X.tube(H.x - 1 + i, H.y + 1.5, H.x - 2 + i * 1.4, H.y + 5, 0.6, 0.2, o.claw, 'bone', { z: 7 });
      if (wk && !o.split) weapon(X, H, wang, { g: 2, z: 5, ...wk });
      if (o.pauldron) {
        X.in(3, 1);
        pauldron(X, S, { z: 9, ...o.pauldron });
      }
      if (o.extra) o.extra(X, { S, E, H, wang });
    },
    paint(P) {
      if (o.paint) o.paint(P, { S, E, H, wang });
    },
    glow(P) {
      if (o.glow) o.glow(P, { S, E, H, wang });
    },
  };
}
// The other arm (behind the body), as a part: it hangs, or holds `holds`
// (a shield, an orb, a book), its hinge at the shoulder.
export function farArmPart(o = {}) {
  return armPart({ role: 'offhand', layer: 'back', z: 0, wang: 0.2, ...o, weapon: o.weapon || null, col: o.col ? dk(o.col, 0.85) : '#a07a5a', sleeve: o.sleeve ? dk(o.sleeve, 0.85) : null });
}
// A cape as a part (hung at the neck, swaying behind).
export function capePart(o = {}) {
  const w = o.w ?? 30;
  const h = o.h ?? 44;
  return {
    w: w + 4, h: h + 4, px: (w + 4) / 2, py: 3, role: 'cape', layer: 'back', z: -5, at: o.at, sign: 1,
    body(X) {
      X.in(0, 2);
      const pts = capeShape(o, w, h).map(([x, y]) => [x + 2, y + 2]);
      X.slab(pts, o.col || '#5a1a2a', o.mat || 'velvet', { rz: 3, bevel: 3, z: 0 });
      if (o.lining) X.slab([[pts[0][0] + 2, 4], [pts[2][0] - 2, 4], [pts[2][0] - 4, 9], [pts[0][0] + 4, 9]], o.lining, 'cloth', { rz: 1, bevel: 1, z: 2 });
      if (o.clasp) X.ball((w + 4) / 2, 4, 2.2, 2, o.clasp, 'gold', { z: 5, rz: 1.4 });
    },
    paint(P) {
      // Its folds: long dark runs down it.
      const base = hex(o.col || '#5a1a2a');
      for (let i = 1; i < 5; i++) {
        const fx = Math.round(4 + (i * (w - 4)) / 5 + Math.sin(i * 1.7) * 1.5);
        for (let y = 8; y < h - 2; y++) {
          const x = fx + Math.round(Math.sin(y * 0.15 + i) * 0.8 + (y / h) * (i - 2.5) * 1.6);
          const c = P.get(x, y);
          if (c[3]) P.set(x, y, mix(shade(c, 0.72), shade(base, 0.5), 0.3));
        }
      }
      if (o.paint) o.paint(P);
    },
  };
}

// A weapon as a part of its own, hung at the hand of an arm part (`parent`)
// and turned at the wrist (role 'blade'): `arm` the arm part (armPart, with
// split: true), `wk` the weapon (see weapon).
export function weaponPart(arm, wk, o = {}) {
  const wang = arm.wang;
  const wl = (wk.len ?? 26) + 8;
  const tip = along({ x: 0, y: 0 }, wang, wl);
  const butt = along({ x: 0, y: 0 }, wang, -12);
  const xs = [tip.x, butt.x, -8, 8];
  const ys = [tip.y, butt.y, -8, 8];
  const x0 = Math.floor(Math.min(...xs)) - 4;
  const y0 = Math.floor(Math.min(...ys)) - 4;
  const w = Math.ceil(Math.max(...xs)) - x0 + 5;
  const h = Math.ceil(Math.max(...ys)) - y0 + 5;
  const H = { x: -x0, y: -y0 };
  return {
    w, h, px: H.x, py: H.y, role: 'blade', layer: o.layer || 'front', parent: o.parent || 'armN', at: [arm.hand.x, arm.hand.y + 0.4], z: (arm.z ?? 5) + 0.5,
    body(X) {
      weapon(X, H, wang, { g: 2, z: 5, ...wk });
      // (The fist round its grip, in front of it.)
      if (o.fist) X.ball(H.x, H.y + 0.6, o.fist.r ?? 2.6, (o.fist.r ?? 2.6) * 0.92, o.fist.col, o.fist.mat || 'metal', { z: 9, rz: 2 });
    },
    paint(P) {
      if (o.paint) o.paint(P, { H, wang });
    },
    glow(P) {
      if (o.glow) o.glow(P, { H, wang });
    },
  };
}

// ------------------------------------------------------------ robes
// A robe from the waist to the floor over the legs, flaring, in folds; its
// hem ragged or not, trimmed (`trim`).
export function robe(X, J, o = {}) {
  const col = o.col || '#3a3a4a';
  const mat = o.mat || 'cloth';
  const w = J.w * (o.wide ?? 1);
  const top = J.waist.y - 1;
  const g = 61.5;
  X.in(HG.skirt, 2);
  const flare = o.flare ?? 1;
  const pts = [[J.waist.x - 8.5 * w, top], [J.waist.x + 8.5 * w, top], [J.waist.x + (12 + 3 * flare) * w, g - 2]];
  const n = o.ragged ? 9 : 4;
  for (let i = 0; i <= n; i++) {
    const k = i / n;
    const x = J.waist.x + ((12 + 3 * flare) - k * 2 * (12 + 3 * flare)) * w;
    const y = g - (o.ragged ? (i % 2 ? 3.5 : 0) + hash2(i, 7, 3) * 2 : 0.5);
    pts.push([x, y]);
  }
  pts.push([J.waist.x - (12 + 3 * flare) * w, g - 2]);
  X.slab(pts, col, mat, { z: 6, rz: 5, bevel: 5 });
  if (o.trim) X.limb([[J.waist.x - (11.5 + 3 * flare) * w, g - 1.5, 0.9, 10], [J.waist.x, g - 0.8, 0.9, 11], [J.waist.x + (11.5 + 3 * flare) * w, g - 1.5, 0.9, 10]], o.trim, o.trimMat || 'gold');
  if (o.front) X.slab([[J.waist.x - 3, top + 1], [J.waist.x + 3, top + 1], [J.waist.x + 4, g - 1], [J.waist.x - 4, g - 1]], o.front, o.frontMat || 'cloth', { z: 10, rz: 1.4, bevel: 1.2 });
}
// Its folds, painted down it.
export function robeFolds(P, J, o = {}) {
  const top = Math.round(J.waist.y + 2);
  const w = J.w * (o.wide ?? 1);
  for (let i = -3; i <= 3; i++) {
    if (!i) continue;
    for (let y = top; y < 61; y++) {
      const k = (y - top) / (61 - top);
      const x = Math.round(J.waist.x + i * (2.2 + k * 2.4) * w + Math.sin(y * 0.2 + i) * 0.6);
      const c = P.get(x, y);
      if (!c[3]) continue;
      P.set(x, y, shade(c, i < 0 ? 1.12 : 0.74));
    }
  }
}
// Something held in the far hand (drawn on an arm part at H): a round
// shield, an orb, a book, a dagger, a skull.
export function held(X, H, o = {}) {
  const kind = o.kind;
  X.in(4, 1);
  if (kind === 'shield') {
    const r = o.r ?? 7;
    X.ball(H.x - 1, H.y, r, r * 1.08, o.col || '#6a4a2a', o.mat || 'wood', { z: 12, rz: 2.2 });
    X.ball(H.x - 1, H.y, r * 0.98, r * 1.06, o.rim || '#8a8a98', 'metal', { z: 11.8, rz: 2 });
    X.ball(H.x - 1, H.y, r * 0.85, r * 0.92, o.col || '#6a4a2a', o.mat || 'wood', { z: 12.6, rz: 2 });
    X.ball(H.x - 1.4, H.y - 0.4, r * 0.3, r * 0.3, o.boss || '#c8a040', 'gold', { z: 14, rz: 1.6 });
  } else if (kind === 'orb') {
    X.ball(H.x, H.y - 3, o.r ?? 3, o.r ?? 3, o.col || '#a0e8ff', 'glass', { z: 12, rz: 2.6, glow: o.col || '#a0e8ff', glowK: 0.55 });
  } else if (kind === 'book') {
    X.slab([[H.x - 4, H.y - 3], [H.x + 3, H.y - 4], [H.x + 4, H.y + 4], [H.x - 3, H.y + 5]], o.col || '#5a2a2a', 'leather', { z: 12, rz: 2, bevel: 1 });
    X.slab([[H.x - 3, H.y - 2], [H.x + 2.5, H.y - 3], [H.x + 3, H.y + 3.2], [H.x - 2.6, H.y + 4]], '#e8e0c8', 'cloth', { z: 13.2, rz: 0.6, bevel: 0.6 });
  } else if (kind === 'skull') {
    X.ball(H.x - 1, H.y - 2, 3, 2.8, '#e0d8c0', 'bone', { z: 12, rz: 2.4 });
  } else if (kind === 'dagger') {
    weapon(X, H, -Math.PI / 2 - 0.6, { kind: 'sword', len: 9, width: 1.1, col: o.col || '#c8ccd8', g: 4, z: 12 });
  }
}

// ------------------------------------------------------------ a figure
// A master that stands as people do, from a spec (see the forge_ files):
// its build, legs or robe, its trunk, what it wears, its head (a part, to
// nod and roar), its arms (parts: the weapon's, swinging, its weapon at the
// wrist; the other), a cape (a part, swaying), and whatever's its own.
export function figure(S) {
  const near = armPart({ ...S.arm, split: !!S.weapon, weapon: S.weapon ? { kind: S.weapon.kind, len: S.weapon.len } : null, wang: S.arm?.wang ?? S.weapon?.wang ?? 0.95 });
  const far = farArmPart({ ...(S.armF || S.arm || {}), extra: S.holds ? (X, q) => held(X, q.H, S.holds) : S.armF?.extra });
  const parts = {
    armF: { ...far, at: (J) => [J.shF.x + 1, J.shF.y + 1] },
    armN: { ...near, at: (J) => [J.shN.x, J.shN.y + 1] },
  };
  if (S.weapon) parts.blade = weaponPart(near, S.weapon, { fist: S.fist, paint: S.weapon.paint, glow: S.weapon.glow });
  if (S.cape) parts.cape = { ...capePart(S.cape), at: (J) => [J.neck.x + 1, J.neck.y + (S.cape.dy ?? 0)] };
  const hw = S.head?.w ?? 28;
  const hh = S.head?.h ?? 30;
  const hr = (S.head?.r ?? 5.4) * 1.15;
  const hc = { x: hw / 2, y: (S.head?.cy ?? 13) + 1 };
  parts.head = {
    w: hw, h: hh, px: hw / 2 + 1, py: hc.y + 6.5, role: 'head', layer: 'front', z: 3, at: (J) => [J.neck.x, J.neck.y + 0.5],
    body(X) {
      head(X, hc, { ...(S.head || {}), r: hr });
      if (S.head?.extra) S.head.extra(X, hc, hr);
    },
    paint(P) {
      if (S.head?.hair) strands(P, 'hair', { dir: [0.25, 1], len: 3, density: 0.22 });
      if ((S.head?.kind || 'man') === 'man' && S.head?.face !== false) face(P, hc, { r: hr, ...(S.head?.face || {}) });
      if (S.head?.paint) S.head.paint(P, hc, hr);
    },
    glow(P) {
      if (S.head?.glow) S.head.glow(P, hc, hr);
    },
  };
  Object.assign(parts, S.parts || {});
  return {
    size: 64, walk: S.walk !== false && !S.robe, fps: S.fps,
    joints: (J) => {
      stance(J, S.stance || {});
      if (S.joints) S.joints(J);
    },
    body(X, J) {
      if (S.robe) robe(X, J, S.robe);
      else legs(X, J, S.legs || {});
      torso(X, J, S.torso || {});
      if (S.plate) breastplate(X, J, S.plate);
      if (S.belt) belt(X, J, S.belt);
      if (S.pauldronF) {
        X.in(HG.armor, 1);
        pauldron(X, J.shF, { z: 11, ...S.pauldronF });
      }
      if (S.gorget) {
        X.in(HG.armor, 1);
        X.ball(J.neck.x + 0.5, J.neck.y + 1.5, 4.6, 2.6, S.gorget, S.gorgetMat || 'mail', { z: 13, rz: 2 });
      }
      if (S.sculpt) S.sculpt(X, J);
    },
    paint(P, J) {
      if (S.robe && S.robe.folds !== false) robeFolds(P, J, S.robe);
      if (S.paint) S.paint(P, J);
    },
    glow: S.glow,
    parts,
    fx: S.fx,
    under: S.under,
    over: S.over,
  };
}

// ------------------------------------------------------------ faces
// A face painted onto a head at `c` (its middle), `r` its size, turned to
// the left: brows, eyes in their sockets (`eye`: their colour; `glowing`
// ones are painted after, as a glow), the nose and the shadow under it,
// the mouth (`teeth`), a scar.
export function face(P, c, o = {}) {
  const r = o.r ?? 5.4;
  const at = (dx, dy) => [Math.round(c.x + dx * r), Math.round(c.y + dy * r)];
  const skinAt = (x, y) => {
    const q = P.get(x, y);
    return q[3] ? q : null;
  };
  const darker = (x, y, k) => {
    const q = skinAt(x, y);
    if (q) P.set(x, y, shade(q, k));
  };
  const lighter = (x, y, k) => {
    const q = skinAt(x, y);
    if (q) P.set(x, y, mix(q, [255, 240, 220], k));
  };
  const [ex1, ey] = at(-0.62, -0.08);
  const [ex2] = at(-0.08, -0.08);
  // Brows, heavy.
  for (const ex of [ex1, ex2]) {
    for (let i = -1; i <= 1; i++) darker(ex + i, ey - 2, o.browK ?? 0.5);
    // The socket's shadow.
    darker(ex, ey - 1, 0.72);
    darker(ex + 1, ey, 0.7);
  }
  if (!o.noEyes) {
    for (const ex of [ex1, ex2]) {
      P.set(ex, ey, hex(o.white || '#f0e8e0'));
      P.set(ex - 1, ey, hex(o.eye || '#3a2a20'));
    }
  }
  // The nose, catching the light; its shadow.
  const [nx, ny] = at(-0.98, 0.22);
  lighter(nx, ny - 1, 0.25);
  darker(nx + 1, ny + 1, 0.6);
  darker(nx, ny + 1, 0.75);
  // The cheekbone's shadow, the jaw's.
  const [cx, cy] = at(0.15, 0.45);
  darker(cx, cy, 0.78);
  darker(cx + 1, cy + 1, 0.74);
  // The mouth.
  const [mx0, my] = at(-0.78, 0.66);
  const len = o.mouth ?? 3;
  for (let i = 0; i < len; i++) {
    if (o.teeth && i % 2 === 0) P.set(mx0 + i, my, hex('#e8e0c8'));
    else darker(mx0 + i, my, 0.42);
  }
  if (o.grin) {
    darker(mx0 - 1, my - 1, 0.5);
    darker(mx0 + len, my - 1, 0.5);
  }
  if (o.scar) for (let i = 0; i < 4; i++) {
    const [sx, sy] = at(-0.5 + i * 0.12, -0.5 + i * 0.32);
    P.set(sx, sy, mix(skinAt(sx, sy) || [200, 150, 140], [220, 120, 120], 0.5));
  }
}
// Stitches along a line (a seam), every other pixel a little lighter.
export function seam(P, x0, y0, x1, y1, k = 1.25) {
  const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0)));
  for (let i = 0; i <= n; i += 2) {
    const x = Math.round(x0 + ((x1 - x0) * i) / n);
    const y = Math.round(y0 + ((y1 - y0) * i) / n);
    const q = P.get(x, y);
    if (q[3]) P.set(x, y, shade(q, k));
  }
}
// A dark line along it (a crease, the edge of a plate, a crack).
export function crease(P, x0, y0, x1, y1, k = 0.55) {
  const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0)));
  for (let i = 0; i <= n; i++) {
    const x = Math.round(x0 + ((x1 - x0) * i) / n);
    const y = Math.round(y0 + ((y1 - y0) * i) / n);
    const q = P.get(x, y);
    if (q[3]) P.set(x, y, shade(q, k));
  }
}
