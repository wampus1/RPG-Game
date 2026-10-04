// The masters that walk as people do (see bossbody.js, which draws them),
// sculpted rather than drawn (see sculpt.js): a body with weight to it,
// head, neck, a chest and a belly and hips, arms and legs that taper to
// the joint and swell to the muscle, the parts flowing into each other;
// over it what it wears, each stuff as it is (wool and linen in folds,
// leather, rings of mail, plate that mirrors the hall, gold), and in its
// hand what it fights with, forged and carved. Facing you three-quarters
// on (turned to your left), in twenty-four frames of breath, posed as a
// blow comes. What swings of its own (a cloak, a censer, a lantern, a
// flail's ball, the panes round the Abbess) moves on its own every frame
// (see the `rig` of each, and bossrig.js).
import { Paint, ramp, hash2 } from './paint.js';
import { hex, mix, shade, toHex } from './pixel.js';
import { Sculpt } from './sculpt.js';
import { Part, Cloth, drawChain, toCanvas } from './bossrig.js';

export const FIG_W = 46;
export const FIG_H = 60;
export const FIG_AX = 23;
export const FIG_AY = 57;

const TAU = Math.PI * 2;
const STEEL = '#9aa0b0';
const IRON = '#6a6a74';
const WOOD = '#7a5232';
const GOLD = '#d8b040';
const LEATHER = '#5a3a24';

// ------------------------------------------------------------ the body
// Where its joints are, at breath `t` (0..1) and in state `st`.
function joints(S, t, st) {
  const wind = !!st.wind;
  const b = (Math.sin(t * TAU) * 0.5 + 0.5) * 0.9; // (the chest rises and falls)
  const sway = Math.sin(t * TAU);
  const J = {
    t, st, b, sway, wind,
    head: { x: 21.5, y: 14 + b },
    neck: { x: 22.5, y: 20.5 + b },
    chest: { x: 22.5, y: 27 + b },
    belly: { x: 22.5, y: 33 + b * 0.5 },
    hip: { x: 22.5, y: 38.5 },
    shF: { x: 13.8, y: 24 + b },
    shN: { x: 31.2, y: 24 + b },
    hipF: { x: 19.2, y: 40 },
    hipN: { x: 25.8, y: 40 },
    knF: { x: 18.2, y: 47.8 },
    knN: { x: 27.2, y: 47.8 },
    anF: { x: 17.8, y: 55.2 },
    anN: { x: 27.6, y: 55.2 },
  };
  // Arms: hanging, a little swing; winding up, the weapon arm raised back
  // over the shoulder and the other thrown forward.
  J.elF = wind ? { x: 9, y: 27 + b } : { x: 11.6, y: 31.2 + b + sway * 0.4 };
  J.hdF = wind ? { x: 5.5, y: 30 + b } : { x: 12, y: 37.6 + b + sway * 0.5 };
  J.elN = wind ? { x: 36, y: 19 + b } : { x: 33.6, y: 31.2 + b - sway * 0.4 };
  J.hdN = wind ? { x: 33.5, y: 12 + b } : { x: 33.4, y: 37.6 + b - sway * 0.5 };
  if (S.arms === 'both') {
    // (Two hands on one weapon, held across the body.)
    J.hdF = wind ? { x: 27, y: 17 + b } : { x: 19, y: 34.5 + b };
    J.elF = wind ? { x: 19, y: 22 + b } : { x: 14, y: 31 + b };
    J.hdN = wind ? { x: 31, y: 15 + b } : { x: 27, y: 34.5 + b };
    J.elN = wind ? { x: 35, y: 20 + b } : { x: 31.5, y: 31 + b };
  }
  if (S.pose) S.pose(J);
  return J;
}

// The groups, back to front (see sculpt.js): what's behind, the far arm,
// the far leg, the near leg, the body and head, the near arm, the weapon.
const G = { back: 0, armF: 1, legF: 2, legN: 3, body: 4, head: 5, armN: 6, weapon: 7, front: 8 };

function body(S, X, J) {
  const skin = S.skin || '#c89a74';
  const skull = !!S.skull;
  const flesh = skull ? 'bone' : 'skin';
  // ---- the far arm, behind.
  X.in(G.armF, 2);
  arm(S, X, J, J.shF, J.elF, J.hdF, -3, true);
  // ---- legs (or a robe's skirts over them).
  for (const [g, hp, kn, an, z, far] of [[G.legF, J.hipF, J.knF, J.anF, -1, true], [G.legN, J.hipN, J.knN, J.anN, 0, false]]) {
    X.in(g, 2);
    if (S.robe) {
      // (Only the toes of the boots showing under the hem.)
      X.ball(an.x - 1.5, an.y + 1.5, 3, 1.6, S.boots || '#2a2018', 'leather', { z: z + 1, rz: 2 });
      continue;
    }
    const legs = S.legs || '#4a4038';
    const mat = S.legMat || 'cloth';
    X.limb([[hp.x, hp.y, 3.3, z], [kn.x, kn.y, 2.5, z + 0.5], [an.x, an.y, 2, z]], legs, mat, { seed: far ? 3 : 4 });
    // Boots: up the shin, a turned-down cuff; the foot forward (to your left).
    const boots = S.boots || '#2a2018';
    X.limb([[kn.x + 0.1, kn.y + 2.5, 2.9, z + 0.6], [an.x, an.y, 2.5, z + 0.5]], boots, 'leather');
    X.ball(an.x - 1.6, an.y + 1.6, 3.4, 1.7, boots, 'leather', { z: z + 1, rz: 2 });
    X.ball(kn.x + 0.1, kn.y + 2.7, 3.1, 1.1, toHex(shade(hex(boots), 1.15)), 'leather', { z: z + 1.4, rz: 1.5 });
    if (S.greaves) {
      X.ball(kn.x, kn.y - 0.4, 2.5, 2.2, S.greaves, 'metal', { z: z + 2.4, rz: 2 });
      X.tube(kn.x, kn.y + 1.6, an.x, an.y - 1.8, 2.9, 2.4, S.greaves, 'metal', { z0: z + 1.6, z1: z + 1.2 });
    }
  }
  // ---- the body: chest, belly, hips; and over it what it wears.
  X.in(G.body, 2.4);
  const top = S.body || '#5a4a3a';
  const topMat = S.mail ? 'mail' : S.bodyMat || 'cloth';
  const b = J.b;
  // The trunk: broad at the shoulders, drawn in at the waist, the chest
  // swelling out of it; the hips under.
  X.slab([[14, 22.4 + b], [31, 22.4 + b], [30, 28 + b], [28.2, 36.6], [16.8, 36.6], [15, 28 + b]], top, topMat, { rz: 4.6, bevel: 4.2, z: 0.6 });
  X.ball(J.chest.x, J.chest.y - 0.6, 6.8, 4.6, top, topMat, { rz: 2.4, z: 3.2 });
  X.slab([[16.6, 35.4], [28.4, 35.4], [29.6, 41.6], [15.4, 41.6]], S.robe ? S.robe : S.legs || top, 'cloth', { rz: 4.6, bevel: 3.6, z: 0.4 });
  // (The shoulders, rounded into the arms.)
  X.ball(J.shF.x + 0.6, J.shF.y + 0.8, 3.4, 3, top, topMat, { rz: 3.2, z: 1.4 });
  X.ball(J.shN.x - 0.6, J.shN.y + 0.8, 3.4, 3, top, topMat, { rz: 3.2, z: 2.2 });
  // A collar at the neck; a tunic's skirt below the belt, flaring.
  X.tube(18.6, 22.6 + b, 26.4, 22.6 + b, 1.3, 1.3, toHex(shade(hex(top), 0.8)), topMat, { z: 5.2 });
  if (!S.robe && !S.noTunic) {
    const hem = [];
    for (let i = 0; i <= 6; i++) hem.push([15.2 + i * 2.6 + (i === 0 ? -0.6 : i === 6 ? 0.6 : 0), 44.6 + (i % 2) * 0.6 + J.sway * 0.2]);
    X.slab([[16.8, 35.8], [28.2, 35.8], ...hem.reverse()], S.tunic || top, topMat === 'mail' ? 'mail' : topMat, { rz: 4.2, bevel: 2.6, z: 1.2 });
  }
  if (S.robe) {
    // The robe's skirts: falling from the hips, widening to the floor in
    // heavy folds (the hem ragged on some).
    const hem = [];
    const n = 9;
    for (let i = 0; i <= n; i++) {
      const k = i / n;
      const x = 12.5 + k * 21;
      const rag = S.robeRagged ? (hash2(i, 3, 7) - 0.3) * 3 : Math.sin(k * Math.PI * 4) * 0.6;
      hem.push([x + J.sway * 0.4 * k, 57 - Math.max(0, rag)]);
    }
    X.slab([[16, 34 + J.b * 0.5], [29, 34 + J.b * 0.5], ...hem.reverse()], S.robe, 'cloth', { rz: 5.5, bevel: 4.5, z: 0.5 });
    if (S.trim) X.slab(hem.map(([x, y], i) => [x, y - 1.6]).concat(hem.slice().reverse()), S.trim, 'cloth', { rz: 5.6, bevel: 1, z: 0.7 });
  }
  // Plate over the chest, pauldrons on the shoulders.
  if (S.plate) {
    X.slab([[15.2, 22.8 + b], [29.8, 22.8 + b], [29, 29 + b], [27, 34.6 + b * 0.5], [18, 34.6 + b * 0.5], [16, 29 + b]], S.plate, 'metal', { rz: 6, bevel: 4.4, z: 1.2 });
    X.ball(J.shF.x + 0.5, J.shF.y - 0.2, 3.6, 2.7, S.plate, 'metal', { rz: 3.8, z: 2.2 });
    X.ball(J.shN.x - 0.5, J.shN.y - 0.2, 4, 3, S.plate, 'metal', { rz: 4, z: 3.4 });
  }
  if (S.belt) {
    X.tube(16.6, 36.2 + J.b * 0.4, 28.4, 36.2 + J.b * 0.4, 1.3, 1.3, S.belt, 'leather', { z: 5.4 });
    if (S.buckle) X.ball(21.2, 36.2 + J.b * 0.4, 1.4, 1.2, S.buckle, 'gold', { z: 6.6, rz: 1 });
  }
  if (S.sash) X.limb([[16, 27 + J.b, 1.6, 6.6], [22, 33 + J.b, 1.6, 7], [28, 38, 1.6, 6]], S.sash, 'cloth');
  if (S.sculpt) S.sculpt(X, J);
  // ---- the head.
  X.in(G.head, 2);
  const h = J.head;
  X.tube(J.neck.x, J.neck.y + 1, h.x + 0.5, h.y + 3, 2.6, 2.3, skin, flesh);
  X.ball(h.x, h.y, 5, 5.6, skin, flesh, { rz: 5, z: 1 });
  // (Jaw and chin, cheekbone and brow; the nose, toward your left.)
  X.ball(h.x - 1.2, h.y + 3.2, 3.6, 2.6, skin, flesh, { rz: 3.4, z: 2 });
  if (!skull) {
    X.ball(h.x - 4.1, h.y + 0.8, 1.2, 1.6, skin, flesh, { z: 5, rz: 1.4 });
    X.ball(h.x + 3.8, h.y + 0.6, 1.1, 1.8, skin, flesh, { z: 3, rz: 1.2 });
  }
  if (S.beard) {
    X.ball(h.x - 1.2, h.y + 4.2 + (S.beardLong ? 1.5 : 0), 3.6, S.beardLong ? 4.2 : 2.6, S.beard, 'hair', { z: 3.4, rz: 3 });
  }
  if (S.hair && S.hairStyle !== 'bald') X.ball(h.x + 0.6, h.y - 2.4, 5.2, 3.6, S.hair, 'hair', { z: 1.4, rz: 4.2 });
  hat(S, X, J);
  // ---- the near arm, in front.
  X.in(G.armN, 2);
  arm(S, X, J, J.shN, J.elN, J.hdN, 4, false);
  // ---- what it carries.
  X.in(G.weapon, 1.2);
  if (S.weapon && !S.weaponBehind) weapon(S, X, J);
  if (S.shield) {
    X.in(G.front, 1.5);
    X.ball(J.hdF.x - 1, J.hdF.y - 3, 5.2, 6.6, S.shield, 'wood', { z: 9, rz: 3 });
    X.ball(J.hdF.x - 1, J.hdF.y - 3, 1.8, 1.8, S.shieldBoss || IRON, 'metal', { z: 12, rz: 1.5 });
  }
}

function arm(S, X, J, sh, el, hd, z, far) {
  const skin = S.skin || '#c89a74';
  const sleeve = S.slimSleeves ? S.body : S.sleeve || S.body || '#5a4a3a';
  const mat = S.mail ? 'mail' : S.bodyMat || 'cloth';
  X.limb([[sh.x, sh.y + 1, 2.9, z], [el.x, el.y, 2.3, z + 0.5], [hd.x, hd.y - 1, 1.9, z + 0.5]], sleeve, mat, { seed: far ? 11 : 12 });
  if (S.plate && !far) X.ball(el.x, el.y, 2.3, 2, S.plate, 'metal', { z: z + 2.4, rz: 2 });
  // Gloved, or the hand bare (bone for the dead).
  X.ball(hd.x, hd.y + 0.6, 2.1, 2.1, S.gloves || skin, S.gloves ? 'leather' : S.skull ? 'bone' : 'skin', { z: z + 1.2, rz: 2 });
}

// ------------------------------------------------------------ the hat
function hat(S, X, J) {
  const H = S.hat;
  if (!H) return;
  const h = J.head;
  const c = H.color || '#5a4a3a';
  switch (H.kind) {
    case 'crown': {
      // A band of gold, points standing up from it, a stone set in front.
      X.tube(h.x - 5, h.y - 3.4, h.x + 5, h.y - 3.8, 1.5, 1.5, c, 'gold', { z0: 6, z1: 4, flat: 0.8 });
      for (let i = 0; i < 5; i++) {
        const x = h.x - 4.6 + i * 2.3;
        X.tube(x, h.y - 4, x + 0.2, h.y - 7.8 - (i % 2) * 1.4, 0.9, 0.35, c, 'gold', { z: 5.5 - i * 0.4 });
      }
      if (H.gem) X.ball(h.x - 1.6, h.y - 3.6, 1, 1, H.gem, 'glass', { z: 7.6, rz: 1, lift: 0.3 });
      break;
    }
    case 'circlet':
      X.tube(h.x - 5, h.y - 2.2, h.x + 5, h.y - 2.8, 0.8, 0.8, c, 'gold', { z0: 6, z1: 4 });
      if (H.gem) X.ball(h.x - 2, h.y - 2.4, 1, 1.1, H.gem, 'glass', { z: 7.2, rz: 1, lift: 0.3 });
      break;
    case 'hood':
    case 'veil': {
      // Cloth over the head and down about the shoulders, the face in its
      // shadow.
      const long = H.kind === 'veil';
      X.ball(h.x + 1, h.y - 0.6, 6.6, 7, c, 'cloth', { z: -0.6, rz: 6.2 });
      X.ball(h.x + 0.6, h.y - 3.6, 5.8, 3.8, c, 'cloth', { z: 2.8, rz: 4.2 });
      X.slab([[h.x - 5, h.y + 4], [h.x + 7, h.y + 3], [h.x + 9, h.y + (long ? 16 : 10)], [h.x - 6, h.y + (long ? 15 : 9)]], c, 'cloth', { z: 0.2, rz: 5, bevel: 3 });
      if (H.trim) X.tube(h.x - 5.5, h.y - 1, h.x - 2.6, h.y - 5.6, 0.8, 0.8, H.trim, 'cloth', { z: 6.2 });
      break;
    }
    case 'helm': {
      X.ball(h.x + 0.3, h.y - 0.8, 5.8, 5.8, c, 'metal', { z: 1.6, rz: 5.4 });
      // (The nose guard and the cheek plates.)
      X.tube(h.x - 3.4, h.y - 2, h.x - 3.6, h.y + 3, 0.8, 0.7, c, 'metal', { z: 6.8 });
      X.ball(h.x + 2.4, h.y + 3, 2.2, 2.6, c, 'metal', { z: 4, rz: 2 });
      if (H.crest) X.limb([[h.x - 2, h.y - 6, 1.6, 4], [h.x + 2, h.y - 7.4, 1.8, 3], [h.x + 6, h.y - 5, 1.4, 1]], H.crest, 'fur');
      if (H.spikes) for (const dx of [-3, 0, 3]) X.tube(h.x + dx, h.y - 5, h.x + dx * 1.3, h.y - 9.5, 1, 0.3, H.spikes, 'bone', { z: 4 });
      break;
    }
    case 'tricorn': {
      X.slab([[h.x - 8, h.y - 3], [h.x + 1, h.y - 7], [h.x + 9, h.y - 3.4], [h.x + 1, h.y - 1.4]], c, 'cloth', { z: 4.6, rz: 2, bevel: 1.5 });
      X.ball(h.x + 0.5, h.y - 5, 4.6, 3, c, 'cloth', { z: 3.4, rz: 3 });
      if (H.trim) X.tube(h.x - 8, h.y - 3, h.x + 9, h.y - 3.4, 0.6, 0.6, H.trim, 'cloth', { z: 6.4 });
      break;
    }
    case 'cone':
      X.slab([[h.x - 5.5, h.y - 2], [h.x + 6, h.y - 2.4], [h.x + 1.2, h.y - 16], [h.x - 0.4, h.y - 16.2]], c, 'ceramic', { z: 3, rz: 4, bevel: 3 });
      X.tube(h.x - 5.6, h.y - 2.2, h.x + 6, h.y - 2.6, 1.1, 1.1, '#ffd060', 'gold', { z: 6.4 });
      break;
    case 'mushcap':
      X.ball(h.x + 0.5, h.y - 4.6, 8.4, 3.6, c, 'fungus', { z: 3, rz: 4 });
      for (const [dx, dy] of [[-4, -5], [1, -6.5], [4.5, -4.6]]) X.ball(h.x + dx, h.y + dy, 0.9, 0.7, '#c0f0e0', 'fungus', { z: 7, rz: 0.6, lift: 0.4 });
      break;
    case 'wreath':
      for (let i = 0; i < 9; i++) {
        const a = Math.PI + (i / 8) * Math.PI;
        X.ball(h.x + Math.cos(a) * 5.4, h.y - 2.2 + Math.sin(a) * 2.4, 1.6, 1.2, i % 2 ? c : H.color2 || c, 'moss', { z: 5.4 - Math.abs(Math.cos(a)) * 2, rz: 1.4, ang: a });
      }
      break;
    case 'thorns':
      for (let i = 0; i < 6; i++) {
        const a = Math.PI + (i / 5) * Math.PI;
        const x = h.x + Math.cos(a) * 5;
        const y = h.y - 2.4 + Math.sin(a) * 2.2;
        X.tube(x, y, x + Math.cos(a) * 2.6, y - 3 - (i % 2) * 1.2, 0.8, 0.25, c, 'bark', { z: 5 });
        if (H.flowers && i % 2 === 0) X.ball(x, y - 0.6, 1.2, 1.1, H.flowers, 'velvet', { z: 6.4, rz: 1 });
      }
      X.tube(h.x - 5.2, h.y - 2.2, h.x + 5.2, h.y - 2.8, 0.9, 0.9, c, 'bark', { z0: 6, z1: 4 });
      break;
    case 'bandana':
      X.ball(h.x + 0.4, h.y - 2.6, 5.4, 3.6, c, 'cloth', { z: 2.6, rz: 4.4 });
      X.limb([[h.x + 5, h.y - 1, 1, 2], [h.x + 7.6, h.y + 1.8 + J.sway * 0.4, 0.9, 1], [h.x + 8.4, h.y + 4.4 + J.sway * 0.8, 0.6, 0.5]], c, 'cloth');
      break;
    case 'miner':
      X.ball(h.x + 0.4, h.y - 2.6, 5.8, 4, c, 'metal', { z: 2.4, rz: 4.6 });
      X.tube(h.x - 6.4, h.y - 0.8, h.x + 6, h.y - 0.6, 0.8, 0.8, c, 'metal', { z: 5 });
      X.ball(h.x - 2.6, h.y - 4.4, 1.6, 1.5, '#fff0b0', 'glass', { z: 7.4, rz: 1.2, glow: '#fff0b0', glowK: 0.5 });
      break;
    case 'shell':
      for (let i = 0; i < 5; i++) {
        const a = Math.PI * (1.15 + i * 0.175);
        X.tube(h.x, h.y - 1.8, h.x + Math.cos(a) * 7.4, h.y - 1.8 + Math.sin(a) * 7.4, 0.9, 1.6, c, 'shell', { z0: 4, z1: 3.4 });
      }
      X.ball(h.x, h.y - 2.4, 2, 1.6, '#f8f4ff', 'shell', { z: 7, rz: 1.4 });
      break;
    case 'antlers':
      for (const s of [-1, 1]) {
        const bx = h.x + s * 3;
        X.limb([[bx, h.y - 4, 1, 4], [bx + s * 3.5, h.y - 9, 0.8, 3.4], [bx + s * 4.4, h.y - 15, 0.5, 3]], c, 'bone');
        X.tube(bx + s * 3.5, h.y - 9, bx + s * 7, h.y - 11, 0.6, 0.35, c, 'bone', { z: 3 });
        X.tube(bx + s * 2, h.y - 6.6, bx + s * 0.6, h.y - 11.6, 0.6, 0.3, c, 'bone', { z: 3.2 });
      }
      break;
    default:
      break;
  }
}

// ------------------------------------------------------------ the weapon
// In the near hand; `ang` the way it points from the grip (up, leaning
// forward a little; flung back over the shoulder as a blow comes).
function weapon(S, X, J) {
  const W = S.weapon;
  const hd = J.hdN;
  const z = 8;
  const a = J.wind ? -Math.PI * 0.62 : -Math.PI * 0.5 - 0.22 + J.sway * 0.04;
  const ux = Math.cos(a);
  const uy = Math.sin(a);
  const px = -uy;
  const py = ux;
  const at = (d, s = 0) => [hd.x + ux * d + px * s, hd.y + uy * d + py * s];
  switch (W.kind) {
    case 'greatsword': {
      const steel = W.color || STEEL;
      const blade = [at(3, -1.5), at(3, 1.5), at(21, 1.1), at(24, 0), at(21, -1.1)];
      X.slab(blade, steel, 'metal', { z, rz: 1.6, bevel: 1.4 });
      X.tube(...at(2.6, -4), ...at(2.6, 4), 0.9, 0.9, '#c8a040', 'gold', { z: z + 1 });
      X.tube(...at(-3, 0), ...at(2, 0), 1, 1, LEATHER, 'leather', { z: z + 0.5 });
      X.ball(...at(-3.6, 0), 1.3, 1.3, '#c8a040', 'gold', { z: z + 1, rz: 1.2 });
      if (W.glow) X.slab([at(5, -0.3), at(5, 0.3), at(21, 0.2), at(21, -0.2)], W.glow, 'glass', { z: z + 1.8, rz: 0.4, bevel: 0.3, glow: W.glow, glowK: 0.6 });
      break;
    }
    case 'sabre': {
      const steel = W.color || STEEL;
      const pts = [];
      for (let i = 0; i <= 6; i++) {
        const k = i / 6;
        pts.push(at(3 + k * 15, k * k * 3));
      }
      const back = pts.map(([x, y], i) => [x - px * (1.4 - i * 0.18), y - py * (1.4 - i * 0.18)]);
      X.slab([...pts, ...back.reverse()], steel, 'metal', { z, rz: 1.2, bevel: 1 });
      X.limb([[...at(2.4, -2.4), 0.7, z], [...at(0, -3), 0.6, z], [...at(-2.4, -2), 0.6, z]], '#d8b040', 'gold');
      X.tube(...at(-2.5, 0), ...at(2.4, 0), 0.9, 0.9, LEATHER, 'leather', { z });
      break;
    }
    case 'spear': {
      const len = W.len || 14;
      X.tube(...at(-10, 0), ...at(len + 4, 0), 0.8, 0.8, W.shaft || WOOD, 'wood', { z });
      X.slab([at(len + 2, -1.7), at(len + 2, 1.7), at(len + 9, 0)], W.color || STEEL, 'metal', { z: z + 0.3, rz: 1.2, bevel: 1 });
      if (W.barb) {
        X.tube(...at(len + 3, -1.5), ...at(len + 1.5, -3.2), 0.5, 0.25, W.color || STEEL, 'metal', { z: z + 0.4 });
        X.tube(...at(len + 3, 1.5), ...at(len + 1.5, 3.2), 0.5, 0.25, W.color || STEEL, 'metal', { z: z + 0.4 });
      }
      break;
    }
    case 'warhammer':
    case 'mace':
    case 'pick': {
      const len = W.len || 13;
      X.tube(...at(-4, 0), ...at(len, 0), 0.9, 0.9, W.shaft || WOOD, 'wood', { z });
      const [ex, ey] = at(len, 0);
      const metal = W.color || STEEL;
      if (W.kind === 'warhammer') {
        X.slab([at(len - 2.5, -4.5), at(len - 2.5, 4.5), at(len + 3, 4.5), at(len + 3, -4.5)], metal, 'metal', { z: z + 0.4, rz: 3, bevel: 1.6 });
        X.tube(...at(len + 0.2, -4.5), ...at(len + 0.2, -7.5), 1.2, 0.3, metal, 'metal', { z: z + 0.6 });
      } else if (W.kind === 'mace') {
        X.ball(ex, ey, 3, 3, metal, 'metal', { z: z + 0.6, rz: 3 });
        for (let i = 0; i < 6; i++) {
          const q = (i / 6) * TAU;
          X.tube(ex, ey, ex + Math.cos(q) * 4.4, ey + Math.sin(q) * 4.4, 0.9, 0.3, metal, 'metal', { z: z + 0.8 });
        }
      } else {
        X.limb([[...at(len - 1, -6), 0.5, z], [...at(len + 1.2, -2), 1.1, z + 0.5], [...at(len + 1.2, 2), 1.1, z + 0.5], [...at(len - 1.5, 5.5), 0.4, z]], metal, 'metal');
      }
      break;
    }
    case 'flail': {
      // (The ball swings on its own: see the rig.)
      X.tube(...at(-3, 0), ...at(7, 0), 1, 0.9, W.shaft || WOOD, 'wood', { z });
      X.ball(...at(7.4, 0), 1.2, 1.2, IRON, 'metal', { z: z + 0.4, rz: 1 });
      break;
    }
    case 'crossbow': {
      const [cx, cy] = [(J.hdF.x + hd.x) / 2, (J.hdF.y + hd.y) / 2];
      X.tube(cx - 9, cy + 0.5, cx + 6, cy - 0.5, 1.3, 1.1, W.stock || WOOD, 'wood', { z: z + 1 });
      X.limb([[cx - 9, cy - 6.5, 0.6, z + 2], [cx - 9.5, cy + 0.5, 1.1, z + 2], [cx - 9, cy + 7, 0.6, z + 2]], IRON, 'metal');
      X.ball(cx - 2, cy - 0.6, 1.4, 1, '#c8c0b0', 'bone', { z: z + 2.2, rz: 1 });
      break;
    }
    case 'longbow': {
      const bx = hd.x - 1;
      const by = hd.y - 2;
      X.limb([[bx + 1.5, by - 17, 0.5, z], [bx - 2.5, by - 9, 1, z], [bx - 3, by, 1.2, z], [bx - 2.5, by + 9, 1, z], [bx + 1.5, by + 17, 0.5, z]], W.color || WOOD, 'wood');
      break;
    }
    case 'daggers': {
      for (const h2 of [J.hdN, J.hdF]) {
        const b2 = [h2.x, h2.y];
        X.slab([[b2[0] - 1, b2[1] - 2], [b2[0] + 1, b2[1] - 2], [b2[0] + 0.3, b2[1] - 9], [b2[0] - 0.3, b2[1] - 9]], W.color || STEEL, 'metal', { z: h2 === J.hdN ? z : -2, rz: 1, bevel: 0.8 });
        X.tube(b2[0] - 2, b2[1] - 1.6, b2[0] + 2, b2[1] - 1.6, 0.6, 0.6, '#c8a040', 'gold', { z: h2 === J.hdN ? z + 0.6 : -1.4 });
      }
      break;
    }
    case 'staff': {
      const top = { x: hd.x - 1.5, y: hd.y - 20 };
      X.limb([[hd.x + 0.6, hd.y + 16, 0.8, z], [hd.x, hd.y, 1, z], [top.x, top.y, 0.9, z]], W.shaft || WOOD, 'wood');
      if (W.sculptHead) W.sculptHead(X, top, J);
      break;
    }
    case 'censer':
      // (The censer itself swings on its chain: see the rig.)
      X.ball(hd.x, hd.y + 0.6, 1.2, 1.2, W.color || '#a08a50', 'gold', { z: z + 1, rz: 1 });
      break;
    case 'horn': {
      X.limb([[hd.x - 1, hd.y - 1, 1, z], [hd.x - 4, hd.y - 6, 1.6, z], [hd.x - 4, hd.y - 12, 2.4, z], [hd.x - 1, hd.y - 15, 3.4, z]], W.color || '#d8c8a0', 'bone');
      X.ball(hd.x - 1, hd.y - 15.5, 3, 1.2, '#2a2020', 'leather', { z: z + 1.4, rz: 0.6 });
      break;
    }
    default:
      break;
  }
}

// ------------------------------------------------------------ the face
// Painted over the sculpted head: eyes (lit from inside, for the dead and
// the cursed), brows, a mouth.
function face(P, S, J) {
  const h = J.head;
  if (S.face) S.face(P, J);
  if (S.noFace) return;
  if (S.skull) {
    for (const ex of [h.x - 3, h.x + 0.4]) {
      P.rect(ex, h.y - 0.6, 2, 2, '#140c10');
      P.set(ex + (ex < h.x - 1 ? 0 : 1), h.y, hex(S.eyes || '#a0e8ff'));
    }
    P.rect(h.x - 2.6, h.y + 3.6, 3, 1, '#2a1e1e');
    for (let i = 0; i < 3; i++) P.set(h.x - 2.4 + i, h.y + 3.6, hex('#e8e0cc'));
    return;
  }
  if (S.hollow) {
    P.blob(h.x - 0.8, h.y + 1, 3.2, 3.6, S.hollow, { amb: 0 });
    P.eye(h.x - 2.6, h.y + 0.6, S.eyes || '#ff9050');
    P.eye(h.x + 0.6, h.y + 0.6, S.eyes || '#ff9050');
    return;
  }
  if (S.visor) {
    P.rect(h.x - 4, h.y, 7, 1, '#140c10');
    P.set(h.x - 3, h.y, hex(S.eyes || '#e0f0ff'));
    P.set(h.x, h.y, hex(S.eyes || '#e0f0ff'));
    return;
  }
  const ey = S.eyes || '#1e1418';
  const glow = !!S.eyes;
  // (Three-quarters on: the near eye a little larger, the far one at the
  // edge of the face.)
  for (const [ex, w] of [[h.x - 3.4, 1], [h.x - 0.2, 2]]) {
    P.rect(ex, h.y - 0.2, w, 1, glow ? ey : '#f4ece4');
    P.set(ex + w - 1, h.y - 0.2, hex(glow ? mix(hex(ey), [255, 255, 255], 0.5) : ey));
    P.rect(ex - 0.2, h.y - 1.4, w + 0.6, 1, shade(hex(S.hair || S.skin || '#6a4a3a'), 0.55));
  }
  P.rect(h.x - 3, h.y + 3.2, 2.4, 1, shade(hex(S.skin || '#c89a74'), 0.6));
}

// ------------------------------------------------------------ the rig
// What swings on its own: the cloak (drawn behind), a censer or lantern on
// its chain, a flail's ball; and each figure's own.
function capePart(S) {
  return new Part(() => {
    const X = new Sculpt(24, 36, { seed: 5 });
    const n = 8;
    const hem = [];
    for (let i = 0; i <= n; i++) {
      const k = i / n;
      const rag = S.capeRagged ? (hash2(i, 9, 3) * 4) : Math.sin(k * Math.PI * 3) * 0.6;
      hem.push([2 + k * 20, (S.capeShort ? 20 : 34) - rag]);
    }
    X.slab([[5, 1], [19, 1], ...hem.reverse()], S.cape, 'cloth', { rz: 4, bevel: 3 });
    return X.render();
  }, 12, 0);
}

const RIGS = new Map();
function rigOf(species, S) {
  let R = RIGS.get(species);
  if (R) return R;
  R = {};
  if (S.cape) R.cape = capePart(S);
  if (S.weapon && (S.weapon.kind === 'censer' || S.weapon.kind === 'flail')) {
    const flail = S.weapon.kind === 'flail';
    R.bob = new Part(() => {
      const X = new Sculpt(11, 11, { seed: 3 });
      if (flail) {
        X.ball(5.5, 5.5, 3.2, 3.2, S.weapon.color || IRON, 'metal', { rz: 3 });
        for (let i = 0; i < 8; i++) {
          const q = (i / 8) * TAU;
          X.tube(5.5, 5.5, 5.5 + Math.cos(q) * 5, 5.5 + Math.sin(q) * 5, 0.9, 0.3, S.weapon.color || IRON, 'metal', { z: 1 });
        }
      } else {
        X.ball(5.5, 6, 3.4, 3.2, S.weapon.color || '#a08a50', 'gold', { rz: 3 });
        X.ball(5.5, 3, 1.6, 1.2, S.weapon.color || '#a08a50', 'gold', { z: 1.5, rz: 1.2 });
        X.tube(3, 6.5, 8, 6.5, 0.5, 0.5, '#5a4020', 'metal', { z: 3.4 });
      }
      return X.render();
    }, 5.5, flail ? 5.5 : 2);
  }
  RIGS.set(species, R);
  return R;
}

// Each figure's rig, drawn about its picture (`R.ox`, `R.oy` the
// picture's top left, in the turned frame: see bossbody.js).
function behind(R) {
  const S = FIGS[R.e.species];
  if (!S) return;
  const rig = rigOf(R.e.species, S);
  const s = R.e.rig;
  if (rig.cape) {
    const img = rig.cape.at(0).img;
    if (img) {
      s.cloth ||= new Cloth(12);
      s.cloth.step(R.dt, R.drift, R.t, { trail: 1.2, breeze: S.capeRagged ? 1.4 : 0.9 });
      s.cloth.draw(R.ctx, img, R.ox + 23 - img.width / 2 + 0.5, R.oy + 21 + (R.b || 0), false);
    }
  }
  if (S.rigBehind) S.rigBehind(R);
}
function front(R) {
  const S = FIGS[R.e.species];
  if (!S) return;
  const rig = rigOf(R.e.species, S);
  const s = R.e.rig;
  if (rig.bob) {
    // A pendulum on its chain from the near hand, swinging with the
    // figure's moves and on its own (a censer swung, a flail's ball).
    const J = R.J;
    const hx = R.ox + J.hdN.x;
    const hy = R.oy + J.hdN.y + (S.weapon.kind === 'flail' ? -7 : 1);
    s.pend ||= { a: 0.3, v: 0 };
    const p = s.pend;
    const drive = S.weapon.kind === 'censer' ? Math.sin(R.t * 2.6) * 1.6 : Math.sin(R.t * 3.4) * (R.st.wind ? 6 : 1.4);
    p.v += (-Math.sin(p.a) * 30 - p.v * 1.4 + drive * 4 - R.drift * 30) * Math.min(R.dt, 1 / 30);
    p.a += p.v * Math.min(R.dt, 1 / 30);
    const len = S.weapon.kind === 'flail' ? 9 : 8;
    const bx = hx + Math.sin(p.a) * len;
    const by = hy + Math.cos(p.a) * len;
    drawChain(R.ctx, [{ x: hx, y: hy }, { x: bx, y: by }], S.weapon.kind === 'flail' ? '#6a6a74' : '#8a7a50');
    rig.bob.draw(R.ctx, bx, by, 0);
    if (S.weapon.fire) {
      R.ctx.fillStyle = '#ffb040';
      R.ctx.globalAlpha = 0.6 + 0.3 * Math.sin(R.t * 9);
      R.ctx.fillRect(Math.round(bx) - 1, Math.round(by) - 3, 2, 2);
      R.ctx.globalAlpha = 1;
    }
  }
  if (S.rigFront) S.rigFront(R);
}

// ------------------------------------------------------------ who's who
// Each: how it's dressed and armed, and its own: `sculpt` (more to its
// body), `face` and `paint` (painted over), `fx` (seen through: smoke,
// wisps, halos), `rigBehind`/`rigFront` (moving on its own).
const flame = (P, x, y, h, t) => {
  for (let i = 0; i < h; i++) {
    const k = i / h;
    const w = Math.sin(t * TAU * 2 + i * 0.7) * k * 1.2;
    P.fx(x + w, y - i, k < 0.3 ? '#fff0a0' : k < 0.7 ? '#ffb040' : '#ff6020', 1 - k * 0.5);
  }
};
const wisp = (P, x, y, dx, dy, c) => {
  for (let i = 0; i < 4; i++) P.fx(x - dx * i, y - dy * i, c, 0.9 - i * 0.22);
};
const drip = (P, x, y, len, t, c) => {
  const k = ((t % 1) + 1) % 1 * len;
  P.fx(x, y + k, c, 0.9);
  P.fx(x, y + k - 1, c, 0.5);
};

const FIGS = {
  // ---- Thessa's barrows, mines, crypts and holdouts.
  barrow_king: {
    skin: '#c8c4b0', eyes: '#a0e8ff', skull: true, body: '#3a3a52', plate: '#7a7464', legs: '#2a2a3a', greaves: '#7a7464', boots: '#2a2a30', cape: '#2a3a5a', capeRagged: true,
    hat: { kind: 'crown', color: '#c8a030', gem: '#a0e8ff' }, weapon: { kind: 'greatsword', color: '#b8c8d8', glow: '#a0e8ff' },
    fx: (P, J) => {
      for (let i = 0; i < 3; i++) {
        const k = (J.t * 2 + i / 3) % 1;
        P.puff(J.head.x - 4 - k * 7, J.head.y + 4 - k * 4, 1 + k * 1.6, '#e0f8ff', 0.55 * (1 - k));
      }
    },
  },
  mound_witch: {
    skin: '#9aa88a', hair: '#2a2a22', hairStyle: 'wild', eyes: '#a0ff70', robe: '#2e2c24', body: '#2e2c24', trim: '#6a8a3a', robeRagged: true,
    hat: { kind: 'hood', color: '#2a2a22' },
    weapon: { kind: 'staff', shaft: '#4a3a24', sculptHead: (X, top) => {
      X.ball(top.x, top.y, 2.6, 2.8, '#e8e0cc', 'bone', { z: 9, rz: 2.4 });
      X.ball(top.x - 0.6, top.y + 1.8, 1.8, 1.2, '#e8e0cc', 'bone', { z: 9.6, rz: 1.2 });
    } },
    paint: (P, J) => {
      const top = { x: J.hdN.x - 1.5, y: J.hdN.y - 20 };
      P.rect(top.x - 1.5, top.y - 0.5, 1, 1, '#1a1414');
      P.rect(top.x + 0.5, top.y - 0.5, 1, 1, '#1a1414');
    },
    fx: (P, J) => {
      P.around(22, 32, 15, 6, 3, J.t * TAU, (x, y, i, a) => wisp(P, x, y, -Math.sin(a) * 1.2, Math.cos(a) * 0.5, '#a0ff70'));
      const g = 0.5 + 0.5 * Math.sin(J.t * TAU * 2);
      P.fx(J.hdN.x - 1.5, J.hdN.y - 25 - g, '#a0ff70', 0.9);
    },
  },
  huntsman: {
    skin: '#8a9aa4', hair: '#c8ccc8', hairStyle: 'long', eyes: '#80e8ff', body: '#3a4a3a', bodyMat: 'leather', legs: '#2a3a2a', boots: '#1a2a1a', cape: '#4a5a4a', capeRagged: true,
    hat: { kind: 'antlers', color: '#d8d0b8' }, weapon: { kind: 'longbow', color: '#6a5a3a' }, belt: '#4a3a24',
    sculpt: (X, J) => {
      // A quiver of pale arrows over the shoulder.
      X.in(0, 1.5);
      X.tube(31, 22 + J.b, 27, 38, 1.9, 1.7, '#4a3a24', 'leather', { z: -3 });
      for (let i = 0; i < 3; i++) X.tube(30.5 + i * 0.8, 23 + J.b, 32 + i, 18 + J.b - i, 0.4, 0.4, '#e8e0c8', 'bone', { z: -2 });
      X.in(4, 3);
    },
    paint: (P, J) => {
      // The bow's string.
      P.line(J.hdN.x + 0.5, J.hdN.y - 19, J.hdN.x + 0.5, J.hdN.y + 15, '#d8d0c0');
    },
  },
  foreman: {
    skin: '#d8d4c4', eyes: '#ffb040', skull: true, body: '#5a4a3a', bodyMat: 'leather', legs: '#3a3226', boots: '#2a1e14', belt: '#2a1e14', buckle: '#c8a040',
    hat: { kind: 'miner', color: '#c8a030' }, weapon: { kind: 'pick', len: 13, color: '#8a8a98' },
    sculpt: (X, J) => {
      // His vest over the shirt.
      X.slab([[16, 23 + J.b], [20, 23 + J.b], [19, 37], [15.5, 36]], '#4a3a2a', 'leather', { z: 6.4, rz: 1, bevel: 1 });
      X.slab([[25, 23 + J.b], [29, 23 + J.b], [29.5, 36], [26, 37]], '#4a3a2a', 'leather', { z: 6.4, rz: 1, bevel: 1 });
    },
    fx: (P, J) => P.puff(J.head.x - 3, J.head.y - 5, 3, '#fff0b0', 0.25 + 0.1 * Math.sin(J.t * TAU * 2)),
  },
  priest: {
    skin: '#7aa098', hair: '#3a5a3a', hairStyle: 'long', eyes: '#c8ffd0', robe: '#2a4a5a', body: '#2a4a5a', trim: '#c8a030', robeRagged: true,
    hat: { kind: 'hood', color: '#24404e' }, weapon: { kind: 'censer', color: '#a08a50' },
    sculpt: (X, J) => {
      // Weed hanging off him.
      X.limb([[17, 30 + J.b, 0.8, 7], [16, 36, 0.7, 7], [16.5, 42, 0.5, 6]], '#3a6a3a', 'moss');
      X.limb([[27, 32 + J.b, 0.8, 7], [28.5, 38, 0.7, 7], [28, 44, 0.5, 6]], '#3a6a3a', 'moss');
    },
    fx: (P, J) => {
      for (const x of [15, 20, 28]) drip(P, x, 40, 14, J.t + x * 0.1, '#80c8e0');
    },
  },
  hollow_saint: {
    skin: '#d8d4e0', hair: '#f0f0f8', hairStyle: 'long', eyes: '#c8a0ff', robe: '#dcd8cc', body: '#dcd8cc', trim: '#8a6ad8', slimSleeves: true,
    hat: { kind: 'circlet', color: '#e0c050', gem: '#c8a0ff' }, noFace: true,
    face: (P, J) => {
      // Hollow: where her face was, only light.
      P.blob(J.head.x - 1, J.head.y + 1, 2.8, 3.2, '#2a2038', { amb: 0 });
      P.eye(J.head.x - 2.6, J.head.y, '#c8a0ff');
      P.eye(J.head.x + 0.4, J.head.y, '#c8a0ff');
    },
    // Her halo, turning slowly about her head of itself (the rig: never
    // caught up short when her breath comes round).
    rigFront: (R) => {
      const J = R.J;
      const ctx = R.ctx;
      const a0 = ctx.globalAlpha;
      ctx.globalAlpha = a0 * 0.85;
      for (let i = 0; i < 44; i++) {
        const a = (i / 44) * TAU + R.t * 0.8;
        if (Math.floor(((((a % TAU) + TAU) % TAU) / TAU) * 6) % 2 && i % 4 === 0) continue;
        ctx.fillStyle = i % 5 ? '#e8d8ff' : '#ffffff';
        ctx.fillRect(Math.round(R.ox + J.head.x + Math.cos(a) * 9), Math.round(R.oy + J.head.y - 2 + Math.sin(a) * 9), 1, 1);
      }
      ctx.globalAlpha = a0;
    },
  },
  warlord: {
    skin: '#a87a58', hair: '#1a1410', beard: '#1a1410', body: '#5a2020', plate: '#6a5a50', legs: '#3a3030', greaves: '#6a5a50', boots: '#2a2020', cape: '#7a2020',
    hat: { kind: 'helm', color: '#6a6060', spikes: '#c8c0b8' }, weapon: { kind: 'warhammer', len: 15, color: '#8a8a98' }, belt: '#2a1a14', buckle: GOLD,
  },
  twins: {
    skin: '#a87a58', hair: '#3a2a1a', body: '#4a3a3a', plate: '#5a5a62', legs: '#3a3030', greaves: '#5a5a62', boots: '#2a2020',
    hat: { kind: 'helm', color: '#5a5a62', crest: '#8a2020' }, weapon: { kind: 'warhammer', len: 14 }, shield: '#7a7a88', shieldBoss: '#8a2020',
  },
  twin_b: {
    skin: '#a87a58', hair: '#3a2a1a', hairStyle: 'long', body: '#2a2a2a', bodyMat: 'leather', legs: '#22221e', boots: '#1a1a16', cape: '#3a2020', capeShort: true, belt: '#3a2a1a',
    hat: { kind: 'bandana', color: '#8a2020' }, weapon: { kind: 'daggers' }, sash: '#8a2020',
  },
  poisoner: {
    skin: '#b8a07a', hair: '#4a5a2a', eyes: '#c8ff60', robe: '#3a4a2a', body: '#3a4a2a', trim: '#a8c040',
    hat: { kind: 'hood', color: '#2e3a22' }, weapon: { kind: 'daggers', color: '#a8c040' },
    sculpt: (X, J) => {
      // Her vials on a bandolier.
      X.limb([[16, 25 + J.b, 1, 6.6], [22, 31 + J.b, 1, 7], [28, 36, 1, 6.4]], '#3a2a1a', 'leather');
      for (let i = 0; i < 4; i++) X.ball(17.5 + i * 3, 27 + J.b + i * 2.6, 1, 1.6, i % 2 ? '#a8e040' : '#c84a8a', 'glass', { z: 8, rz: 1, lift: 0.2 });
    },
    fx: (P, J) => P.fx(18, 24 + J.b - (Math.round(J.t * 12) % 4), '#e8ff90', 0.9),
  },
  thorn_queen: {
    skin: '#a8c890', hair: '#3a5a2a', hairStyle: 'long', eyes: '#e05070', robe: '#4a2a3a', body: '#4a2a3a', trim: '#e05070', robeRagged: true,
    hat: { kind: 'thorns', color: '#5a7a3a', flowers: '#e05070' },
    weapon: { kind: 'staff', shaft: '#4a3a24', sculptHead: (X, top) => {
      X.ball(top.x, top.y, 2.6, 2.4, '#e05070', 'velvet', { z: 9, rz: 2.2 });
      X.ball(top.x - 0.8, top.y - 0.8, 1.3, 1, '#ff90a0', 'velvet', { z: 10.6, rz: 1 });
      X.tube(top.x - 2, top.y + 2, top.x - 4.4, top.y + 4, 0.8, 0.2, '#5a8a3a', 'moss', { z: 9 });
      X.tube(top.x + 2, top.y + 2, top.x + 4.4, top.y + 4, 0.8, 0.2, '#5a8a3a', 'moss', { z: 9 });
    } },
    sculpt: (X, J) => {
      // Briars climbing her skirts, roses on them.
      for (let i = 0; i < 4; i++) {
        const x = 14 + i * 5.2;
        X.limb([[x, 56, 0.7, 7], [x + 1.5 + J.sway * 0.4, 48, 0.6, 7], [x + 2.5 + J.sway * 0.8, 41 + i, 0.5, 7]], '#4a6a2a', 'bark');
        X.ball(x + 2.5 + J.sway * 0.8, 41 + i, 1.3, 1.2, i % 2 ? '#e05070' : '#c83a5a', 'velvet', { z: 8, rz: 1.2 });
      }
    },
  },

  // ---- Kharos.
  cinder_king: {
    skin: '#4a3a36', eyes: '#ff8030', robe: '#2a2020', body: '#2a2020', plate: '#4a3a34', trim: '#ff8030', cape: '#3a1810',
    hat: { kind: 'crown', color: '#a07020', gem: '#ff8030' }, weapon: { kind: 'greatsword', color: '#4a3a34', glow: '#ff8030' },
    paint: (P, J) => {
      // Cracks of fire in his skin.
      P.line(J.head.x - 3, J.head.y + 2, J.head.x - 1, J.head.y + 4, '#ff6020');
    },
    fx: (P, J) => {
      // His crown burns: flames off every point, flaring as he strikes.
      for (let i = 0; i < 5; i++) flame(P, Math.round(J.head.x - 4.6 + i * 2.3), Math.round(J.head.y - 8.6 - (i % 2) * 1.4), J.wind ? 7 : 5, J.t + i * 0.23);
      for (let i = 0; i < 4; i++) {
        const k = (J.t + i / 4) % 1;
        P.fx(13 + i * 6 + Math.sin(k * 6 + i) * 1.5, 52 - k * 40, k < 0.5 ? '#ffe070' : '#ff6020', 1 - k * 0.8);
      }
    },
  },
  smoke_herald: {
    skin: '#8a8484', eyes: '#ff9050', robe: '#3e3836', body: '#3e3836', trim: '#ff6030', robeRagged: true, hollow: '#1a1616',
    hat: { kind: 'hood', color: '#4a4240' }, weapon: { kind: 'horn', color: '#d8c8a0' }, belt: '#2a2220', buckle: '#ff6030',
    fx: (P, J) => {
      for (let i = 0; i < 6; i++) {
        const k = (J.t + i / 6) % 1;
        const side = i % 2 ? 1 : -1;
        P.puff(22 + side * (8 + k * 4) + Math.sin(k * 5 + i) * 1.5, 26 - k * 22, 2 + k * 3, i % 2 ? '#9a9490' : '#7a7470', 0.55 * (1 - k));
      }
      P.fx(J.head.x - 1, J.head.y + 4, '#ff6030', 0.35 + 0.2 * Math.sin(J.t * TAU));
    },
  },
  obsidian_abbess: {
    skin: '#c8c0d0', hair: '#140e1a', hairStyle: 'long', eyes: '#c8b8f0', robe: '#1e1824', body: '#1e1824', trim: '#c8b8f0', slimSleeves: true,
    hat: { kind: 'veil', color: '#2a2234', trim: '#c8b8f0' },
    sculpt: (X, J) => X.ball(J.hdN.x, J.hdN.y - 1.4, 1.6, 1.6, '#c8b8f0', 'glass', { z: 10, rz: 1.4, glow: '#c8b8f0', glowK: 0.3 }),
    // Panes of black glass drifting round her (see the rig).
    rigBehind: (R) => abbessPanes(R, false),
    rigFront: (R) => abbessPanes(R, true),
  },
  kiln_priest: {
    skin: '#a87a58', hair: '#e8e0d0', hairStyle: 'bald', eyes: '#ffd060', beard: '#e8e0d0', beardLong: true, robe: '#8a3a1a', body: '#8a3a1a', trim: '#ffd060',
    hat: { kind: 'cone', color: '#c86a2a' }, weapon: { kind: 'censer', color: '#8a5a2a', fire: true },
    fx: (P, J) => {
      drip(P, J.hdF.x, J.hdF.y + 2, 8, J.t, '#ffe8c0');
      drip(P, J.hdF.x + 1, J.hdF.y + 2, 8, J.t + 0.5, '#ffb040');
    },
  },
  ash_reaver: {
    skin: '#7a4a30', hair: '#0e0a08', beard: '#0e0a08', body: '#3a2a24', mail: true, legs: '#2a201c', boots: '#141010', belt: '#2a1a14', buckle: '#ff6030', cape: '#4a2a20', capeRagged: true,
    hat: { kind: 'helm', color: '#3a3436', crest: '#c84a1a' }, weapon: { kind: 'flail', color: '#5a4a44' }, sash: '#c84a1a',
    face: (P, J) => {
      const k = J.st.berserk ? '#ff3020' : '#ff7040';
      P.eye(J.head.x - 3, J.head.y + 0.6, k);
      P.eye(J.head.x, J.head.y + 0.6, k);
    },
    noFace: true,
    fx: (P, J) => {
      if (!J.st.berserk) return;
      for (let i = 0; i < 5; i++) {
        const k = (J.t + i / 5) % 1;
        P.puff(12 + i * 5 + Math.sin(k * 4 + i), 38 - k * 30, 1 + k * 1.5, '#ff3020', 0.6 * (1 - k));
      }
    },
  },
  bombard_queen: {
    skin: '#b07850', hair: '#c83a1a', hairStyle: 'long', body: '#5a3a2a', bodyMat: 'leather', legs: '#3a2a20', boots: '#2a1a12', gloves: '#2a2420', belt: '#3a2a1a', buckle: GOLD, arms: 'both',
    hat: { kind: 'bandana', color: '#ffb040' }, weapon: { kind: 'crossbow' },
    sculpt: (X, J) => {
      // Goggles pushed up on her brow; a bandolier of little bombs.
      X.in(5, 1);
      X.ball(J.head.x - 3, J.head.y - 3.4, 1.6, 1.3, '#c87a40', 'glass', { z: 7, rz: 1 });
      X.ball(J.head.x + 0.6, J.head.y - 3.6, 1.6, 1.3, '#c87a40', 'glass', { z: 6.4, rz: 1 });
      X.in(4, 3);
      X.limb([[16, 25 + J.b, 0.9, 6.6], [22, 31 + J.b, 0.9, 7], [28, 36, 0.9, 6.4]], '#3a2a1a', 'leather');
      for (let i = 0; i < 5; i++) X.ball(16.5 + i * 2.6, 26 + J.b + i * 2.2, 1.4, 1.4, '#2a2420', 'metal', { z: 8, rz: 1.3 });
    },
    fx: (P, J) => {
      for (let i = 0; i < 5; i++) if ((Math.floor(J.t * 12) + i) % 3 === 0) P.fx(16.5 + i * 2.6, 24 + J.b + i * 2.2, '#ffe070', 1);
    },
  },
  kiln_king: {
    skin: '#6a4030', hair: '#ff9030', beard: '#ff9030', eyes: '#ffb040', body: '#3a2a20', plate: '#5a4a40', legs: '#2a1e18', greaves: '#4a3a30', boots: '#1a1210', gloves: '#2a2020', belt: '#2a1a14', buckle: '#ffd060',
    hat: { kind: 'crown', color: '#ffd060', gem: '#ff6020' }, weapon: { kind: 'warhammer', len: 16, color: '#5a4a40' },
    sculpt: (X, J) => {
      // A leather apron, scorched.
      X.slab([[17, 34], [28, 34], [29, 51], [16, 51]], '#5a3a24', 'leather', { z: 7.2, rz: 1, bevel: 1.2 });
    },
    fx: (P, J) => P.puff(22, 31 + J.b, 2, '#ff9030', 0.3 + 0.15 * Math.sin(J.t * TAU)),
  },

  // ---- Myrrow.
  bog_king: {
    skin: '#8a6a48', hair: '#2a1e12', hairStyle: 'long', eyes: '#e0c870', body: '#3a2e20', mail: true, legs: '#2e2418', boots: '#1e1810', cape: '#3a3020', capeRagged: true,
    hat: { kind: 'crown', color: '#8a7020', gem: '#e0c870' }, weapon: { kind: 'mace', len: 12, color: '#6a5a40' },
    sculpt: (X, J) => {
      X.limb([[16, 28 + J.b, 0.8, 7], [15, 34, 0.7, 7], [15.5, 39, 0.5, 6]], '#4a5a2a', 'moss');
      X.limb([[28, 29 + J.b, 0.8, 7], [29, 35, 0.7, 7], [28.5, 40, 0.5, 6]], '#4a5a2a', 'moss');
    },
    fx: (P, J) => {
      for (const x of [14, 19, 26, 30]) drip(P, x, 38, 16, J.t + x * 0.07, '#5a4a30');
    },
  },
  willow_wight: {
    skin: '#9aa88a', hair: '#5a7a4a', hairStyle: 'wild', eyes: '#c8f0a0', robe: '#3a3228', body: '#3a3228', trim: '#a0d090', robeRagged: true,
    hat: { kind: 'wreath', color: '#5a8a3a', color2: '#3a6a2a' },
    sculpt: (X, J) => {
      // Moss hanging from her arms like a willow's.
      X.in(9, 1);
      for (const [h, n] of [[J.elF, 0], [J.hdF, 1], [J.elN, 2], [J.hdN, 3]]) {
        const len = 6 + (n % 2) * 4;
        const w = Math.sin(J.t * TAU + n) * 1.2;
        X.limb([[h.x, h.y + 1, 0.9, 9], [h.x + w * 0.5, h.y + 1 + len * 0.5, 0.8, 9], [h.x + w, h.y + 1 + len, 0.4, 9]], n % 2 ? '#8ab070' : '#5a8a4a', 'moss');
      }
    },
    fx: (P, J) => {
      const k = (J.t * 2) % 1;
      P.fx(J.head.x - 3, J.head.y + 1 + k * 6, '#a0e8ff', 1 - k * 0.6);
    },
  },
  lantern_lord: {
    skin: '#a8b8b0', hair: '#d0e0dc', hairStyle: 'long', eyes: '#80e8d0', robe: '#2a3a3a', body: '#2a3a3a', trim: '#80e8d0',
    hat: { kind: 'mushcap', color: '#3a5a5a' },
    weapon: { kind: 'staff', shaft: '#3a3a30', sculptHead: (X, top) => {
      X.tube(top.x, top.y, top.x - 4.4, top.y - 2.4, 0.9, 0.8, '#3a3a30', 'wood', { z: 9 });
    } },
    // His lantern swings from the crook (see the rig).
    rigFront: (R) => {
      const J = R.J;
      const s = R.e.rig;
      const hx = R.ox + J.hdN.x - 5.9;
      const hy = R.oy + J.hdN.y - 22.4;
      s.lamp ||= { a: 0.2, v: 0 };
      const p = s.lamp;
      p.v += (-Math.sin(p.a) * 26 - p.v * 1.2 + Math.sin(R.t * 1.7) * 3 - R.drift * 28) * Math.min(R.dt, 1 / 30);
      p.a += p.v * Math.min(R.dt, 1 / 30);
      const lx = hx + Math.sin(p.a) * 5;
      const ly = hy + Math.cos(p.a) * 5;
      drawChain(R.ctx, [{ x: hx, y: hy }, { x: lx, y: ly }], '#8a8a7a');
      lanternPart().draw(R.ctx, lx, ly, -p.a * 0.5);
      const ctx = R.ctx;
      ctx.globalAlpha = 0.35 + 0.15 * Math.sin(R.t * 5);
      ctx.fillStyle = '#80e8d0';
      ctx.beginPath();
      ctx.arc(Math.round(lx), Math.round(ly + 3), 6, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 1;
    },
    fx: (P, J) => {
      for (let i = 0; i < 6; i++) {
        const k = (J.t + i / 6) % 1;
        P.puff(6 + i * 7 + k * 4, 54 - k * 4, 3, '#c0d8d0', 0.45 * Math.sin(k * Math.PI));
      }
    },
  },
  hollow_king: {
    skin: '#2a2a32', eyes: '#e0f0ff', visor: true, hollow: '#1a1a22', body: '#4a5058', plate: '#5a6068', legs: '#3a4048', greaves: '#5a6068', boots: '#2a3038', cape: '#2a3040', capeRagged: true,
    hat: { kind: 'helm', color: '#5a6068', crest: '#a0b8c8' }, weapon: { kind: 'greatsword', color: '#a0b0c0' },
    fx: (P, J) => {
      for (const [x, y] of [[J.shF.x, J.shF.y + 2], [J.shN.x, J.shN.y + 2], [22, 36], [J.elF.x, J.elF.y], [18, 46], [J.head.x, J.head.y + 5]]) {
        const k = (J.t + x * 0.05) % 1;
        P.puff(x + k * 2, y - k * 5, 0.8 + k * 1.5, '#d0e0e8', 0.6 * (1 - k));
      }
    },
  },
  sharktooth: {
    skin: '#a87048', hair: '#3a2418', hairStyle: 'long', beard: '#4a2e1c', body: '#1e3a4a', legs: '#3a3020', boots: '#2a2014', belt: '#3a2a1a', buckle: GOLD, cape: '#2a2420', capeShort: true,
    hat: { kind: 'tricorn', color: '#3a3230', trim: '#d8c8a0' }, weapon: { kind: 'spear', len: 14, barb: true, color: '#c8c8c0' },
    sculpt: (X, J) => {
      // A necklace of sharks' teeth.
      for (let i = 0; i < 5; i++) X.tube(18.5 + i * 2, 25.6 + J.b + Math.abs(i - 2) * 0.5, 18.5 + i * 2, 28.4 + J.b + Math.abs(i - 2) * 0.5, 0.7, 0.2, '#f0e8dc', 'bone', { z: 8 });
    },
    fx: (P, J) => {
      if (J.st.loot) for (let i = 0; i < 3; i++) if ((Math.floor(J.t * 12) + i * 3) % 8 === 0) P.fx(18 + i * 3, 36, '#ffe070', 1);
    },
  },
  pearl_queen: {
    skin: '#a06a44', hair: '#1a1410', hairStyle: 'long', eyes: '#80c8e8', robe: '#e8e0d4', body: '#e8e0d4', bodyMat: 'velvet', trim: '#80c8e8',
    hat: { kind: 'shell', color: '#f0e8dc' }, weapon: { kind: 'sabre', color: '#c8d8e0' },
    sculpt: (X, J) => {
      for (let i = 0; i < 7; i++) X.ball(17.5 + i * 1.6, 25 + J.b + Math.sin((i / 6) * Math.PI) * 2.5, 0.9, 0.9, '#f8f4ff', 'shell', { z: 8, rz: 0.9 });
    },
    fx: (P, J) => {
      if (!J.st.shell) return;
      for (let y = 6; y < 58; y++) {
        for (let x = 3; x < 43; x++) {
          const d = ((x + 0.5 - 22.5) / 19) ** 2 + ((y + 0.5 - 33) / 25) ** 2;
          if (d > 1) continue;
          const hue = Math.sin(x * 0.3 + y * 0.2 + J.t * TAU) * 0.5 + 0.5;
          P.fx(x, y, hue > 0.5 ? '#f0d8ff' : '#d0f0ff', d > 0.86 ? 0.85 : 0.22);
        }
      }
      P.around(22.5, 33, 16, 21, 5, J.t * TAU, (x, y) => P.fx(x, y, '#ffffff', 1));
    },
  },
};
// (The second of them shares the first's looks.)
FIGS.saint_shade = FIGS.hollow_saint;
FIGS.hollow_echo = FIGS.hollow_king;

// The Abbess's panes: black glass, drifting round her on a tilted ring
// (those behind her drawn before her).
let PANE = null;
function abbessPanes(R, front) {
  PANE ||= new Part(() => {
    const X = new Sculpt(9, 11, { seed: 2 });
    X.slab([[1, 2], [6, 1], [8, 8], [2, 10]], '#2a2236', 'obsidian', { rz: 1.4, bevel: 1, cell: 4 });
    return X.render();
  }, 4.5, 5.5);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * TAU + R.t * 1.1;
    const s = Math.sin(a);
    if ((s > 0) !== front) continue;
    const x = R.ox + 23 + Math.cos(a) * 17;
    const y = R.oy + 28 + s * 7 + Math.sin(R.t * 2 + i) * 1.5;
    PANE.draw(R.ctx, x, y, Math.sin(R.t * 0.8 + i) * 0.5, false, front ? 1 : 0.75);
  }
}
let LANTERN = null;
function lanternPart() {
  LANTERN ||= new Part(() => {
    const X = new Sculpt(9, 11, { seed: 4 });
    X.ball(4.5, 6, 3.4, 4, '#3a4a40', 'metal', { rz: 3 });
    X.ball(4.5, 6.2, 2, 2.6, '#80e8d0', 'glass', { z: 1.6, rz: 2, glow: '#80e8d0', glowK: 0.6 });
    X.ball(4.5, 1.6, 1.4, 1, '#3a4a40', 'metal', { z: 1, rz: 1 });
    return X.render();
  }, 4.5, 1);
  return LANTERN;
}

// ------------------------------------------------------------ painting
export const FIG_SPECIES = Object.keys(FIGS);

// Paint one frame of `species` at breath `t`, in state `st`: the Px, and
// the joints it was posed with (for the rig).
export function paintFigure(species, t, st) {
  const S = FIGS[species];
  const J = joints(S, t, st);
  const X = new Sculpt(FIG_W, FIG_H, { seed: 7, t });
  body(S, X, J);
  const px = X.render();
  const P = new Paint(FIG_W, FIG_H);
  P.p = px;
  face(P, S, J);
  if (S.paint) S.paint(P, J);
  // (What's seen through, unoutlined: smoke, wisps, sparks, breath.)
  if (S.fx) S.fx(P, J);
  return P.p;
}
export const figureJoints = (species, t, st) => joints(FIGS[species], t, st);
export const hasFigure = (species) => !!FIGS[species];
export const figureRig = { behind, front };
export { ramp, toCanvas };
