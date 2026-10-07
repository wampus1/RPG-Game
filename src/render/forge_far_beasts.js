// (Round 71) The far lands' masters that aren't shaped like people, forged
// anew (see forge.js, forgekit.js): each built on one of a few kinds of
// body, and made its own by what it is and what it has.
//   four-legged (fquad): a barrel and a deep chest, four legs trotting,
//     its head a part on its neck (a jaw that opens in it), its tails;
//   winged (fbird): a body hung in the air on its wings (parts, beating),
//     its head turning on its neck, talons hanging;
//   serpents (fwyrm): its neck rearing out of its coils (a part, and its
//     head and jaw on it), the rest of it strung out behind in the world;
//   golems and giants (fgolem): pillars of legs, a great trunk, a head sunk
//     between its shoulders, its arms (parts) swinging fists like boulders;
//   crawlers (fcrab): a shell, eyes on stalks, legs, claws (parts) that
//     snap (their pincers parts of their own);
//   wraiths (fwraith): drifting, rags of mist for a body, reaching arms;
//   and the shapeless, each its own.
import { forge, inPose, partAt } from './forge.js';
import { eyes, glow, glowLine, dk, lt, quadruped, beastHead, jawPart, tailPart, wingPart, crown } from './forgekit.js';
import { flame, embers, smoke, puff, drops, glowAt, motes, bolt, dot } from './forgefx.js';
import { hex, mix, shade, toHex } from './pixel.js';
import { hash2 } from './paint.js';
import { drawStrand } from './bossrig.js';
import { beastPart, beastSerpent, beastCurl } from './bossbeasts.js';

const TAU = Math.PI * 2;
const bobOf = (J, k = 1.4) => Math.sin(J.t * TAU) * k;
// A shadow on the floor under something that hangs in the air.
function shadow(R, ctx, w = 22) {
  ctx.globalAlpha = 0.25;
  ctx.fillStyle = '#000000';
  ctx.fillRect(Math.round(R.x - w / 2), Math.round(R.y - 1), w, 2);
  ctx.globalAlpha = 1;
}

// ------------------------------------------------------------ four legs
// `o`: k (its size), coat, mat, head ('canine', 'fox', 'cat', 'deer',
// 'bear', 'mole', 'walrus', 'mammoth'), heavy, legs (how long), belly,
// eyes, tails (how many), tailLen, tailW, tailTip, mane, antlers, horns,
// tusk, crown, mask, claws, hoof, shaggy, noLegs (flippers);
// body/paint/glow/fx/headExtra its own besides.
function fquad(o) {
  const k = o.k || 1;
  const coat = o.coat;
  const mat = o.mat || 'fur';
  const kind = o.head || 'canine';
  const low = ['mammoth', 'bear', 'walrus', 'mole'].includes(kind);
  const heavy = o.heavy || 0;
  const girth = (8.4 + heavy * 2.2) * k;
  const len = (21 + heavy * 3) * k;
  const legLen = (o.legs ?? 15) * Math.min(1.1, k);
  const cx = 36;
  const cy = 61 - legLen - girth * 0.4;
  const neck = low ? [cx - len * 0.62, cy - girth * 0.15] : [cx - len * 0.56, cy - girth * 1.25];
  const r = (o.headR ?? 5.2) * Math.min(1.25, k) * (low ? 1.15 : 1);
  const hk = { canine: 'dog', fox: 'dog', cat: 'cat', deer: 'horse', bear: 'bear', mole: 'bear', walrus: 'ox', mammoth: 'ox' }[kind];
  const HEAD = beastHead({
    kind: hk, r, col: o.headCol || coat, mat, eye: o.eyes === false ? null : o.eyes || '#ffd070', bigEye: k > 1.1,
    ears: o.ears !== false && kind !== 'walrus' && kind !== 'mole' ? (kind === 'fox' || kind === 'canine' ? 'tall' : true) : false,
    horns: o.horns ? 'default' : null, hornCol: o.horns,
    at: neck, z: 6, w: 52, h: 48, cx: 24, cy: 28, nose: kind === 'mole' ? '#e8a0a0' : o.nose || '#1a1414',
    extra(X, c, rr) {
      X.in(3, 1);
      if (o.antlers) {
        for (const s of [0, 1]) {
          const rx = c.x + rr * (0.1 + s * 0.45);
          const ry = c.y - rr * 0.65;
          const col = s ? o.antlers : dk(o.antlers, 0.8);
          X.limb([[rx, ry, rr * 0.28, 9 + s], [rx + 3, ry - 8, rr * 0.22, 9 + s], [rx + 2, ry - 16, rr * 0.16, 9 + s], [rx + 6, ry - 23, rr * 0.08, 9 + s]], col, 'bone');
          X.limb([[rx + 3, ry - 8, rr * 0.16, 9 + s], [rx + 10, ry - 12, rr * 0.12, 9 + s], [rx + 15, ry - 18, rr * 0.06, 9 + s]], col, 'bone');
          X.limb([[rx + 2, ry - 15, rr * 0.12, 9 + s], [rx - 5, ry - 20, rr * 0.07, 9 + s]], col, 'bone');
        }
      }
      if (o.mask) {
        // A skull worn for a face.
        X.ball(c.x - rr * 0.3, c.y + rr * 0.1, rr * 0.95, rr * 0.8, o.mask, 'bone', { z: 12, rz: 2 });
        X.limb([[c.x - rr * 0.6, c.y + rr * 0.3, rr * 0.5, 12.5], [c.x - rr * 1.8, c.y + rr * 0.55, rr * 0.3, 12.5]], o.mask, 'bone');
      }
      if (kind === 'mole') {
        // Its star of a nose, pink, feeling.
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * TAU;
          X.tube(c.x - rr * 2.1, c.y + rr * 0.3, c.x - rr * 2.1 + Math.cos(a) * rr * 0.55, c.y + rr * 0.3 + Math.sin(a) * rr * 0.55, rr * 0.13, rr * 0.06, '#f0b0b0', 'flesh', { z: 12 });
        }
      }
      if (kind === 'walrus') {
        X.ball(c.x - rr * 1.2, c.y + rr * 0.55, rr * 0.9, rr * 0.7, dk(coat, 0.9), mat, { z: 9, rz: 2 });
        for (const dx of [-0.4, 0.3]) X.limb([[c.x - rr * (1.3 + dx), c.y + rr * 1.0, rr * 0.22, 11], [c.x - rr * (1.45 + dx), c.y + rr * 2.3, rr * 0.17, 11], [c.x - rr * (1.25 + dx), c.y + rr * 3.2, rr * 0.06, 11]], o.tusk || '#f4ecdc', 'bone');
      }
      if (kind === 'mammoth') {
        for (const dz of [0, 1]) X.limb([[c.x - rr * 0.8, c.y + rr * 0.9, rr * 0.3, 10 + dz * 4], [c.x - rr * 2.4, c.y + rr * 2, rr * 0.27, 10 + dz * 4], [c.x - rr * 3.6, c.y + rr * 1.3, rr * 0.2, 10 + dz * 4], [c.x - rr * 3.8, c.y + rr * 0.1, rr * 0.08, 10 + dz * 4]], o.tusk || '#f0e8d8', 'bone');
        X.ball(c.x + rr * 0.9, c.y - rr * 0.1, rr * 0.9, rr * 1.2, dk(coat, 0.85), mat, { z: 4, rz: 2 });
      }
      if (o.crown) crown(X, { x: c.x + rr * 0.2, y: c.y - rr * 0.95 }, { r: rr * 0.8, col: o.crown, n: 4, tall: rr * 0.6 });
      if (o.headExtra) o.headExtra(X, c, rr);
    },
    paint(P, c, rr) {
      if (o.headPaint) o.headPaint(P, c, rr);
    },
    glow(P, c, rr) {
      if (o.mask && o.eyes) {
        const ex = Math.round(c.x - rr * 0.3);
        const ey = Math.round(c.y - rr * 0.1);
        eyes(P, [[ex, ey]], o.eyes, { big: true });
      }
      if (o.headGlow) o.headGlow(P, c, rr);
    },
  });
  const parts = { head: HEAD };
  if (['canine', 'fox', 'cat', 'bear'].includes(kind)) parts.jaw = jawPart(HEAD, { col: dk(o.headCol || coat, 0.9), mat, tongue: '#c84a4a', amp: 1.2, len: r * (kind === 'cat' ? 1.05 : kind === 'bear' ? 1.25 : 1.9), at: kind === 'cat' || kind === 'bear' ? [HEAD.c.x - r * 0.1, HEAD.c.y + r * 0.7] : undefined });
  if (kind === 'mammoth') {
    // Its trunk, swinging (a part hung on its head).
    parts.trunk = {
      w: 16, h: 30, px: 8, py: 3, role: 'sway', layer: 'front', parent: 'head', z: 6.5, depth: 0.25, rate: 1.3, amp: 1.4,
      at: [HEAD.c.x - r * 1.5, HEAD.c.y + r * 0.6],
      body(X) {
        X.in(0, 1.4);
        X.limb([[8, 3, r * 0.55, 1], [7, 12, r * 0.45, 1], [8, 20, r * 0.35, 1], [5, 27, r * 0.25, 1]], o.headCol || coat, mat);
      },
      paint(P) {
        for (let y = 6; y < 27; y += 2) {
          const q = P.get(7, y);
          if (q[3]) P.set(7, y, shade(q, 0.75));
        }
      },
    };
  }
  const tails = o.tails ?? 1;
  for (let i = 0; i < tails; i++) {
    const spread = tails > 1 ? (i - (tails - 1) / 2) * 0.3 : 0;
    parts[`tail${i}`] = {
      ...tailPart({ n: 6, seg: ((o.tailLen ?? 12) / 6) * k, r0: (o.tailW ?? 1.6) * 1.4 * k, curl: -0.08, ang: -0.5 + spread, col: o.tailCol || coat, mat: o.tailMat || mat, tip: o.tailTip ? 'tuft' : null, tipCol: o.tailTip, depth: 0.2, rate: 1.6 }),
      at: [cx + len * 0.6, cy - girth * 0.3], layer: 'back', z: -2 - i * 0.01, phase: i * 0.7,
    };
  }
  return {
    size: 64, ay: 62, walk: !o.noLegs,
    body(X, J) {
      if (o.noLegs) {
        // Lying low on its flippers.
        X.in(0, 3);
        X.ball(cx, 50 - J.b * 0.5, len * 0.75, girth * 0.95, coat, mat, { rz: girth * 0.9, along: 'x' });
        X.ball(cx - len * 0.35, 45 - J.b * 0.5, girth * 1.05, girth, coat, mat, { rz: girth * 0.9, z: 2 });
        X.in(1, 1);
        X.slab([[cx - len * 0.3, 54], [cx - len * 0.05, 54], [cx - len * 0.2, 61.5], [cx - len * 0.55, 61.5]], dk(coat, 0.8), 'leather', { z: 8, rz: 1.6, bevel: 1 });
        X.slab([[cx + len * 0.55, 52], [cx + len * 0.75, 56], [cx + len * 0.95, 61.5], [cx + len * 0.6, 61.5]], dk(coat, 0.8), 'leather', { z: 4, rz: 1.6, bevel: 1 });
      } else {
        quadruped(X, J, { cx, cy, len, girth, lr: (2.6 + heavy * 1.1) * Math.min(1.2, k), col: coat, mat, belly: o.belly, paw: o.hoof ? 'hoof' : 'paw', hoof: o.hoof, claws: o.claws, neck });
      }
      if (o.mane) {
        X.in(5, 1);
        for (let i = 0; i < 8; i++) {
          const f = i / 7;
          const x = neck[0] + (cx - len * 0.25 - neck[0]) * f;
          const y = neck[1] - 2 + (cy - girth * 0.6 - neck[1]) * f;
          X.ball(x + 2, y, 3.6 * k, 3.2 * k, i % 2 ? o.mane : dk(o.mane, 0.85), 'hair', { rz: 2.4, z: 6 + i * 0.1 });
        }
      }
      if (o.shaggy) {
        X.in(6, 1);
        for (let i = 0; i < 8; i++) {
          const x = cx - len * 0.7 + i * len * 0.2;
          X.limb([[x, cy + girth * 0.4, 1.6 * k, 6], [x + Math.sin(J.t * TAU + i) * 0.6, cy + girth * 1.05 + (i % 2) * 2, 0.9 * k, 6]], dk(coat, 0.85), 'fur');
        }
      }
      if (o.body) o.body(X, J, { cx, cy, len, girth, neck });
    },
    paint(P, J, t, st) {
      if (mat === 'fur' && !o.noStrands) {
        P.over((x, y, c) => (c[3] && hash2(x, y, 31) > 0.86 ? shade(c, 0.78) : null));
      }
      if (o.paint) o.paint(P, J, { cx, cy, len, girth, neck }, st);
    },
    glow(P, J, t, st) {
      if (o.glow) o.glow(P, J, { cx, cy, len, girth, neck }, st);
    },
    parts,
    fx(R, ctx, pose) {
      if (o.fx) inPose(R, ctx, pose, () => o.fx(R, ctx, R.r.time, { cx, cy, len, girth, neck }));
    },
  };
}

// ------------------------------------------------------------ wings
// `o`: body, breast, headCol, neck, wing, tips, cover, beak, legs, eyes,
// crest, bald, longNeck, longLegs, extraWings, halo, moth (spot, spot2,
// feelers), span (its wings' length); fx/paint its own.
function mothWing(o, near, hind) {
  const c = near ? o.wing : dk(o.wing, 0.78);
  const L = (hind ? 0.75 : 1) * 1.3;
  const pts = hind ? [[2, 2], [-6, 4], [-12, 10], [-12, 16], [-6, 18], [0, 12]] : [[2, 2], [-6, -6], [-16, -14], [-26, -16], [-28, -12], [-24, -4], [-14, 2], [-4, 4]];
  const sx = pts.map((p) => [p[0] * L, p[1] * L]);
  const x0 = Math.min(...sx.map((p) => p[0])) - 3;
  const y0 = Math.min(...sx.map((p) => p[1])) - 3;
  const P0 = sx.map(([x, y]) => [x - x0, y - y0]);
  const w = Math.ceil(Math.max(...sx.map((p) => p[0])) - x0 + 4);
  const h = Math.ceil(Math.max(...sx.map((p) => p[1])) - y0 + 4);
  const eye = hind ? [P0[3][0] + 3, P0[3][1] - 3] : [P0[3][0] + 6, P0[3][1] + 3];
  return {
    w, h, px: -x0, py: -y0, role: 'wing', layer: near ? 'front' : 'back', z: near ? 3 - (hind ? 1 : 0) : -1 - (hind ? 1 : 0), depth: 0.4, rate: 2.4, squash: 1.2, lift: 0.4, phase: (near ? 0 : 0.6) + (hind ? 0.4 : 0),
    body(X) {
      X.in(0, 1);
      X.slab(P0, c, 'velvet', { rz: 1.6, bevel: 2 });
      X.ball(eye[0], eye[1], hind ? 2.4 : 3.6, hind ? 2.2 : 3.2, o.spot || '#1a1420', 'velvet', { z: 1.5, rz: 0.6 });
      X.ball(eye[0], eye[1], hind ? 1.2 : 1.8, hind ? 1.1 : 1.6, o.spot2 || '#ffe060', 'velvet', { z: 1.8, rz: 0.4 });
    },
    paint(P) {
      // Veins out from the root; a pale band along its edge.
      P.over((x, y, q) => {
        if (!q[3]) return null;
        const a = Math.atan2(y - P0[0][1], x - P0[0][0]);
        if (Math.abs(Math.sin(a * 6)) < 0.1 && Math.hypot(x - P0[0][0], y - P0[0][1]) > 4) return shade(q, 0.7);
        return hash2(x, y, 3) > 0.92 ? shade(q, 1.18) : null;
      });
    },
  };
}
function fbird(o) {
  const span = o.span ?? 30;
  const bodyY = 32;
  const hingeAt = (dx, dy) => (J) => [34 + dx, bodyY - 3 + dy + bobOf(J)];
  const parts = {};
  if (o.moth) {
    parts.foreF = { ...mothWing(o, false, false), at: hingeAt(3, 0) };
    parts.hindF = { ...mothWing(o, false, true), at: hingeAt(4, 3) };
    parts.foreN = { ...mothWing(o, true, false), at: hingeAt(0, 0) };
    parts.hindN = { ...mothWing(o, true, true), at: hingeAt(1, 3) };
  } else {
    const wing = (near, extra) => ({
      ...wingPart({ kind: 'feather', len: span * (extra ? 0.75 : 1), col: near ? o.wing : dk(o.wing, 0.78), cover: near ? o.cover || o.wing : dk(o.cover || o.wing, 0.78), tip: o.tips ? (near ? o.tips : dk(o.tips, 0.8)) : null, ang: extra ? -0.6 : -1.25, bend: 0.75, depth: 0.45, rate: 2.2, squash: 0.35, lift: 0.5 }),
      at: hingeAt(near ? (extra ? -2 : 0) : (extra ? 2 : 4), extra ? 8 : 0), layer: near ? 'front' : 'back', z: near ? 4 - (extra ? 1 : 0) : -2 - (extra ? 1 : 0), phase: near ? 0 : 0.6,
    });
    parts.wingF = wing(false);
    parts.wingN = wing(true);
    if (o.extraWings) {
      parts.wing2F = wing(false, true);
      parts.wing2N = wing(true, true);
    }
  }
  // Its head (and a long neck, if it has one), hinged on its body.
  const hc = o.longNeck ? { x: 8, y: 6 } : { x: 10, y: 9 };
  parts.head = {
    w: o.longNeck ? 30 : 24, h: o.longNeck ? 32 : 18, px: o.longNeck ? 22 : 17, py: o.longNeck ? 28 : 12, role: 'head', layer: 'front', z: 5, amp: 1.5,
    at: (J) => [o.longNeck ? 30 : 26, (o.longNeck ? 26 : 28) + bobOf(J)],
    body(X) {
      const c = o.body;
      const mat = o.moth ? 'fur' : 'feather';
      X.in(0, 2);
      if (o.longNeck) X.limb([[22, 28, 3, 1], [18, 20, 2.4, 2], [14, 12, 2.2, 3], [hc.x + 2, hc.y, 2.2, 4]], o.neck || c, 'feather');
      else X.limb([[17, 12, 4.4, 1], [hc.x + 2, hc.y, 3.8, 2]], o.neck || c, o.bald ? 'skin' : mat);
      X.ball(hc.x, hc.y, o.moth ? 4.4 : 4.6, 4.2, o.headCol || c, o.bald ? 'skin' : mat, { rz: 4, z: 4 });
      X.in(1, 1);
      if (o.moth) {
        for (const [dx, ph] of [[0, 0], [2, 1]]) X.limb([[hc.x - 1 + dx, hc.y - 3, 0.7, 7], [hc.x - 4 + dx + ph, hc.y - 10, 0.6, 7], [hc.x - 7 + dx + ph * 1.5, hc.y - 15, 0.4, 7]], o.feelers || '#c8b8a0', 'feather');
        X.ball(hc.x - 2.5, hc.y, 2, 2.2, o.eyes || '#1a1420', 'glass', { z: 6, rz: 1.6 });
      } else {
        const bc = o.beak || '#e0b040';
        if (o.longNeck) X.limb([[hc.x - 2, hc.y + 1, 1.4, 7], [hc.x - 6, hc.y + 2, 1.2, 7], [hc.x - 7, hc.y + 5, 0.7, 7]], bc, 'bone');
        else X.slab([[hc.x - 3, hc.y - 1], [hc.x - 9, hc.y + 1], [hc.x - 10, hc.y + 3.4], [hc.x - 7, hc.y + 2.6], [hc.x - 3, hc.y + 2.4]], bc, 'bone', { z: 7, rz: 1.8, bevel: 1 });
        if (o.crest) for (let i = 0; i < 3; i++) X.tube(hc.x + 2, hc.y - 2, hc.x + 6 + i * 2, hc.y - 6 - i * 1.6, 0.8, 0.3, o.crest, 'feather', { z: 5 });
      }
    },
    paint(P) {
      if (!o.moth) {
        P.set(hc.x - 1, hc.y - 1, hex('#1a1414'));
        if (o.longNeck) P.set(hc.x - 7, hc.y + 4, hex('#1a1414'));
      }
    },
    glow(P) {
      if (!o.moth) eyes(P, [[hc.x - 2, hc.y - 1]], o.eyes || '#ffd070', { big: true });
    },
  };
  return {
    size: 64, ay: 62, breath: 1.4,
    body(X, J, t, st) {
      const bob = bobOf(J);
      const dive = st.wind ? 1 : 0;
      const c = o.body;
      X.in(0, 2);
      // Its tail.
      if (o.moth) X.limb([[38, bodyY + 2 + bob, 5, 0], [45, bodyY + 5 + bob, 4.4, 0], [52, bodyY + 9 + bob, 2.6, 0]], dk(c, 0.85), 'fur');
      else X.slab([[40, bodyY + bob], [57, bodyY - 3 + bob], [60, bodyY + 3 + bob], [42, bodyY + 6 + bob]], o.tail || dk(c, 0.8), 'feather', { rz: 1.4, bevel: 1 });
      // Talons, hanging (reaching, as it dives).
      if (!o.moth && !o.longLegs) for (const dx of [0, 4]) {
        X.limb([[32 + dx, bodyY + 6 + bob, 1.4, 1], [30 + dx - dive * 4, bodyY + 14 + bob + dive * 2, 1, 1], [29 + dx - dive * 6, bodyY + 18 + bob, 0.7, 1]], o.legs || '#e0b040', 'leather');
        for (let i = 0; i < 3; i++) X.tube(29 + dx - dive * 6, bodyY + 18 + bob, 27 + dx + i * 1.4 - dive * 6, bodyY + 21 + bob, 0.5, 0.2, '#2a2420', 'bone', { z: 2 });
      }
      if (o.moth) for (let i = 0; i < 3; i++) X.limb([[30 + i * 4, bodyY + 5 + bob, 0.8, 1], [28 + i * 4, bodyY + 11 + bob, 0.6, 1], [29 + i * 4 + Math.sin(t * TAU + i), bodyY + 15 + bob, 0.4, 1]], '#3a2e20', 'chitin');
      if (o.longLegs) for (const dx of [0, 3]) X.limb([[33 + dx, bodyY + 6 + bob, 1, 1], [34 + dx, bodyY + 16 + bob, 0.8, 1], [32 + dx, 60, 0.6, 1]], o.longLegs, 'leather');
      X.in(1, 3);
      X.ball(33, bodyY + bob, o.moth ? 7 : 10, o.moth ? 6.4 : 7, c, o.moth ? 'fur' : 'feather', { rz: 7 });
      if (o.breast) X.ball(28, bodyY + 3 + bob, 6, 4.6, o.breast, 'feather', { rz: 4, z: 3 });
    },
    paint(P, J) {
      const bob = Math.round(bobOf(J));
      // The barring on its breast.
      if (!o.moth) for (let x = 24; x < 34; x += 2) for (let y = bodyY + bob; y < bodyY + 8 + bob; y += 2) {
        const q = P.get(x, y);
        if (q[3]) P.set(x, y, shade(q, 0.86));
      }
      if (o.paint) o.paint(P, J);
    },
    parts,
    fx(R, ctx, pose) {
      const t = R.r.time;
      inPose(R, ctx, pose, () => {
        if (o.halo) {
          for (let i = 0; i < 30; i++) {
            const a = (i / 30) * TAU + t * 0.6;
            const h = partAt(R, 'head', hc.x, hc.y - 6);
            dot(ctx, h.x + Math.cos(a) * 7, h.y + Math.sin(a) * 2, i % 4 ? o.halo : '#ffffff', 0.85);
          }
        }
        if (o.fx) o.fx(R, ctx, t);
      });
      shadow(R, ctx, 20);
    },
  };
}

// ------------------------------------------------------------ serpents
// `o`: scale, belly, mat, gloss, rad, n, bands, spines, spineMat, legs (a
// centipede's), horns, whiskers, mane, crystals, eyes, blind, heads (the
// hydra's), head (its head's colour), mandibles; fx its own.
function fwyrm(key, o) {
  const scale = hex(o.scale);
  const belly = hex(o.belly || toHex(shade(scale, 1.4)));
  const cfg = {
    n: o.n || 12, gap: 0.5, wave: o.wave || 3, amp: 0.22, gloss: o.gloss ?? 0.7,
    lift: (i) => Math.max(0, 3 - i) * 0.8,
    rad: (k) => 1.2 + (o.rad || 5) * Math.pow(1 - k, 0.8),
    skin(k, u, v, ny) {
      if (ny > 0.45) return Math.floor(u / 3) % 2 ? shade(belly, 0.82) : belly;
      if (o.bands && Math.floor(u / 5) % 2) return shade(scale, 0.72);
      const rr = Math.sin(u * 0.9 + v * 2 + hash2(Math.floor(u / 4), 1, 7) * 5);
      return rr > 0.85 ? mix(scale, [255, 255, 255], 0.25) : rr < -0.9 ? shade(scale, 0.7) : scale;
    },
    crest(i) {
      if (o.legs) {
        return beastPart(`${key}_legs`, 12, 10, 6, 2, (X) => {
          X.limb([[6, 2, 0.7, 0], [2, 6, 0.6, 0], [1, 9, 0.4, 0]], o.legs, 'chitin');
          X.limb([[6, 2, 0.7, 0], [10, 6, 0.6, 0], [11, 9, 0.4, 0]], o.legs, 'chitin');
        });
      }
      if (!o.spines || i % 2 || i > 10) return null;
      const kk = Math.min(3, Math.floor(i / 3));
      return beastPart(`${key}_spine${kk}`, 7, 10, 3.5, 9, (X) => {
        const h = 7.5 - kk * 1.5;
        X.slab([[1.5, 9.5], [3.2, 9.5 - h], [4.2, 9.5 - h * 0.6], [5.5, 9.5]], o.spines, o.spineMat || 'bone', { rz: 1.4, bevel: 0.8 });
      });
    },
  };
  const heads = o.heads || 1;
  const rad = o.rad || 5;
  const mat = o.mat || 'scales';
  const hcol = o.head || o.scale;
  const parts = {};
  for (let h = 0; h < heads; h++) {
    const off = heads > 1 ? (h - 1) : 0;
    parts[`neck${h}`] = {
      w: 30, h: 42, px: 18, py: 39, role: 'head', layer: 'front', z: 2 + (h === 1 ? 1 : 0) - Math.abs(off) * 0.2, amp: 2, phase: h * 1.3,
      at: [32 + off * 6, 52],
      body(X) {
        X.in(0, 2);
        X.limb([[18, 40, rad + 1.2, 2], [19 + off, 30, rad + 0.6, 4], [15 + off * 2, 18, rad, 6], [9 + off * 2, 8, rad - 0.6, 7]], o.scale, mat);
        X.limb([[14, 38, rad * 0.5, 8], [14 + off, 28, rad * 0.5, 9], [10 + off * 2, 18, rad * 0.44, 10], [5 + off * 2, 10, rad * 0.4, 10]], toHex(belly), mat === 'scales' ? 'leather' : mat);
        if (o.mane) for (let i = 0; i < 5; i++) X.tube(20 + off - i * 2, 34 - i * 6, 25 + off - i * 2, 31 - i * 6, 1.6, 0.4, o.mane, 'hair', { z: 1 });
        if (o.crystals) for (let i = 0; i < 4; i++) X.tube(21 - i * 2.5, 33 - i * 7, 26 - i * 2.4, 29 - i * 7, 1.4, 0.3, o.crystals, 'glass', { z: 1 });
      },
      paint(P) {
        if (o.bands) for (let y = 10; y < 40; y += 5) for (let x = 0; x < 30; x++) {
          const q = P.get(x, y);
          if (q[3]) P.set(x, y, shade(q, 0.7));
        }
      },
    };
    parts[`head${h}`] = {
      w: 30, h: 22, px: 20, py: 12, role: 'head', layer: 'front', parent: `neck${h}`, at: [9 + off * 2, 8], z: 3 + (h === 1 ? 1 : 0), amp: 1.3, phase: h * 1.3 + 0.4,
      body(X) {
        X.in(0, 2.4);
        X.ball(16, 10, 7.4, 5, hcol, mat, { rz: 5, ang: -0.15 });
        X.ball(9, 11, 5, 2.6, hcol, mat, { rz: 2.6, z: 2, ang: -0.1 });
        X.in(1, 1);
        if (o.horns) for (const s of [0, 1]) X.limb([[18 + s, 6, 1.2, 4 + s * 3], [23 + s, 2, 0.8, 4 + s * 3], [27 + s, 1, 0.3, 4 + s * 3]], o.horns, 'bone');
        if (o.whiskers) for (const s of [0, 1]) X.limb([[5, 11 + s, 0.4, 8], [1, 14 + s * 3, 0.3, 8], [-2, 13 + s * 4, 0.2, 8]], o.whiskers, 'hair');
        if (o.mane) for (let i = 0; i < 3; i++) X.tube(20 + i * 2, 7 + i * 2, 25 + i * 2, 4 + i * 2.6, 1.4, 0.4, o.mane, 'hair', { z: 5 });
        if (o.crystals) for (let i = 0; i < 3; i++) X.tube(18 + i * 3, 7, 21 + i * 3, 1 - (i % 2) * 2, 1.3, 0.3, o.crystals, 'glass', { z: 6 });
        if (o.mandibles) for (const s of [0, 1]) X.limb([[6, 12 + s, 1, 6 - s], [2, 15 + s, 0.8, 6 - s], [3, 18, 0.4, 6 - s]], o.mandibles, 'chitin');
        if (o.headExtra) o.headExtra(X);
      },
      paint(P) {
        P.set(5, 10, hex('#1a1414'));
        if (o.blind) P.rect(12, 7, 3, 2, '#e8d8c8');
      },
      glow(P) {
        if (!o.blind) eyes(P, [[13, 8]], o.eyes || '#ffd070', { big: true });
      },
    };
    parts[`jaw${h}`] = {
      w: 22, h: 10, px: 18, py: 3, role: 'jaw', layer: 'front', parent: `head${h}`, at: [18, 13], z: 3.5 + (h === 1 ? 1 : 0), amp: 1.5,
      body(X) {
        X.in(0, 1);
        X.slab([[2, 4], [18, 2], [19, 5], [5, 7]], dk(hcol, 0.82), mat, { rz: 2, bevel: 1.2 });
      },
      paint(P) {
        for (let x = 4; x < 17; x += 2) P.set(x, 3, hex(o.teeth || '#f0e8d8'));
      },
    };
  }
  return {
    size: 64, ay: 60,
    body(X, J) {
      X.in(0, 2.4);
      // Its coils, where its neck comes up out of them.
      X.ball(34, 55, 15, 5.4, dk(o.scale, 0.85), mat, { rz: 5, along: 'x' });
      X.ball(28, 52 - J.b * 0.3, 11, 5, o.scale, mat, { rz: 5, z: 3, along: 'x' });
      X.ball(41, 51, 7, 4.4, o.scale, mat, { rz: 4, z: 2 });
      if (o.legs) for (let i = 0; i < 5; i++) X.limb([[20 + i * 6, 56, 0.7, 6], [17 + i * 6, 59 + Math.sin(J.t * TAU * 2 + i) * 0.6, 0.5, 6], [16 + i * 6, 61.5, 0.4, 6]], o.legs, 'chitin');
    },
    paint(P) {
      if (o.bands) for (let x = 14; x < 52; x += 5) for (let y = 46; y < 61; y++) {
        const q = P.get(x, y);
        if (q[3]) P.set(x, y, shade(q, 0.7));
      }
    },
    parts,
    under(R) {
      beastSerpent(R, cfg, false);
    },
    over(R) {
      beastSerpent(R, cfg, true);
    },
    fx(R, ctx, pose) {
      if (o.fx) inPose(R, ctx, pose, () => o.fx(R, ctx, R.r.time));
    },
  };
}

// ------------------------------------------------------------ giants
// `o`: stone, mat, headCol, beard, moss, mossMat, hump, fist, eyes, glow,
// seams, runes, inlay, cracks; body/paint/fx its own.
function fgolem(o) {
  const c = o.stone;
  const mat = o.mat || 'rock';
  const cell = mat === 'rock' ? { cell: 4 } : {};
  const arm = (near) => ({
    w: 26, h: 40, px: 13, py: 5, role: near ? 'weapon' : 'offhand', layer: near ? 'front' : 'back', z: near ? 6 : -3, amp: 0.75,
    at: near ? [24, 27] : [46, 25],
    body(X) {
      const col = near ? c : dk(c, 0.82);
      X.in(0, 2);
      X.ball(13, 6, 6.4, 6, col, mat, { rz: 5, ...cell });
      X.limb([[13, 6, 5.6, 1], [11, 19, 4.8, 2], [12, 30, 4.6, 2]], col, mat, cell);
      X.ball(12, 33, 6.4, 5.8, near ? o.fist || col : dk(o.fist || c, 0.82), mat, { rz: 5, z: 3, ...cell });
      if (o.moss && near) X.ball(14, 3, 4, 2.4, o.moss, o.mossMat || 'moss', { z: 6, rz: 1.4 });
      if (o.armExtra) o.armExtra(X, near);
    },
    paint(P) {
      if (o.glow && o.seams) glowSeam(P, [[14, 8], [11, 18], [13, 28]], o.glow);
      if (o.glow && o.runes && near) rune(P, 12, 17, o.glow);
    },
  });
  return {
    size: 64, ay: 62,
    body(X, J) {
      const b = J.b;
      X.in(0, 3);
      // Legs like pillars.
      for (const [x, z] of [[27, -2], [41, 2]]) {
        X.limb([[x, 44, 5.6, z], [x - 0.6, 53, 5, z], [x, 59.5, 5.2, z]], z < 0 ? dk(c, 0.8) : c, mat, cell);
        X.ball(x - 1.5, 60, 6.4, 2.4, dk(c, 0.7), mat, { rz: 2, z: z + 2 });
      }
      X.in(1, 3.5);
      // The trunk: a great chest, the belly under; shoulders like hills.
      X.ball(34, 31 - b, 17, 13, c, mat, { rz: 12, ...cell });
      X.ball(34, 42 - b * 0.5, 12, 7, dk(c, 0.92), mat, { rz: 8, z: 1, ...cell });
      X.ball(20, 23 - b, 7.4, 6.4, c, mat, { rz: 6, z: 3, ...cell });
      X.ball(48, 23 - b, 7.4, 6.4, c, mat, { rz: 6, z: 3, ...cell });
      if (o.hump) X.ball(42, 17 - b, 12, 7, o.hump, o.humpMat || 'moss', { rz: 6, z: -2 });
      if (o.moss) for (const [x, y, r] of [[20, 18, 4], [48, 18, 4], [36, 20, 4.6], [30, 30, 2.6]]) X.ball(x, y - b, r, r * 0.6, o.moss, o.mossMat || 'moss', { rz: r * 0.5, z: 8 });
      if (o.body) o.body(X, J);
    },
    paint(P, J, t) {
      const b = Math.round(J.b);
      const g = o.glow;
      if (g && o.seams) {
        const pulse = 0.5 + 0.5 * Math.sin(t * TAU);
        const col = toHex(mix(hex(g), [255, 255, 255], pulse * 0.4));
        for (const pts of [[[26, 26], [31, 33], [28, 40]], [[40, 24], [37, 31], [42, 38]], [[34, 36], [34, 46]]]) glowSeam(P, pts.map(([x, y]) => [x, y - b]), col);
      }
      if (g && o.runes) for (let i = 0; i < 4; i++) rune(P, 26 + (i % 2) * 10, 27 + Math.floor(i / 2) * 9 - b, Math.floor(t * 6 + i) % 6 < 3 ? g : dk(g, 0.5));
      if (o.inlay) for (let i = 0; i < 9; i++) P.rect(24 + (i % 3) * 7 + (Math.floor(i / 3) % 2) * 3, 24 + Math.floor(i / 3) * 6 - b, 2, 2, o.inlay);
      if (o.cracks) for (const [x0, y0, x1, y1] of [[24, 24, 28, 31], [28, 31, 26, 36], [43, 28, 47, 34]]) P.line(x0, y0 - b, x1, y1 - b, o.cracks);
      if (o.paint) o.paint(P, J, t);
    },
    parts: { armF: arm(false), head: golemHead(o, c, mat, cell), armN: arm(true), ...(o.parts || {}) },
    fx(R, ctx, pose) {
      if (o.fx) inPose(R, ctx, pose, () => o.fx(R, ctx, R.r.time));
    },
  };
}
// A giant's head (a part, on top of its arms): sunk on its shoulders, a
// heavy brow, a jaw like a step, its beard; its eyes alight.
function golemHead(o, c, mat, cell) {
  const hc = o.headCol || c;
  return {
    w: 22, h: 26, px: 12, py: 18, role: 'head', layer: 'front', z: 7, amp: 1.2,
    at: (J) => [25, 22 - J.b],
    body(X) {
      X.in(0, 2);
      X.ball(11, 10, 6.6, 6.2, hc, mat, { rz: 6, ...cell });
      X.ball(7, 15, 5, 3.6, dk(hc, 0.92), mat, { rz: 3, z: 2, ...cell });
      X.ball(8, 7.5, 5.6, 2, dk(hc, 0.72), mat, { rz: 1.6, z: 4 });
      if (o.beard) X.limb([[8, 15, 4.6, 5], [8, 20, 3.6, 5], [9, 24, 1.6, 5]], o.beard, 'hair');
      if (o.moss) X.ball(13, 4.5, 5, 2.4, o.moss, o.mossMat || 'moss', { rz: 1.4, z: 6 });
    },
    paint(P) {
      if (o.beard) for (let y = 15; y < 24; y += 2) for (let x = 5; x < 12; x += 2) {
        const q = P.get(x, y);
        if (q[3]) P.set(x, y, shade(q, 0.85));
      }
      P.rect(4, 15, 4, 1, '#1a1414');
    },
    glow(P) {
      eyes(P, [[6, 10], [11, 10]], o.eyes || '#ffd070', { big: true });
      for (const x of [6, 11]) glow(P, x, 10, 2.2, o.eyes || '#ffd070', 0.35);
    },
  };
}
// A seam of light through stone (painted, glowing).
function glowSeam(P, pts, col) {
  for (let i = 0; i + 1 < pts.length; i++) glowLine(P, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], col, 0.9, false);
}
// A rune cut in it (an upright and its strokes), alight.
function rune(P, x, y, col) {
  for (let i = 0; i < 5; i++) P.fx(x, y + i, col, 0.95);
  P.fx(x + 1, y + 1, col, 0.9);
  P.fx(x + 2, y + 2, col, 0.9);
  P.fx(x - 1, y + 3, col, 0.9);
}

// ------------------------------------------------------------ crawlers
// `o`: shell, mat, claw, crown, stack, crystals, barnacles; fx its own.
function fcrab(o) {
  const c = o.shell;
  const mat = o.mat || 'shell';
  const claw = (near) => {
    const s = near ? 1.45 : 1.05;
    const col = near ? c : dk(c, 0.82);
    const cc = near ? o.claw || dk(c, 0.9) : dk(o.claw || c, 0.78);
    return {
      w: 34, h: 28, px: 28, py: 16, role: near ? 'weapon' : 'offhand', layer: near ? 'front' : 'back', z: near ? 7 : -2, amp: 0.6, a0: -0.5,
      at: near ? [22, 40] : [26, 38],
      body(X) {
        X.in(0, 2);
        X.limb([[26, 16, 2.4 * s, 1], [18, 15, 2 * s, 2], [12, 12, 1.8 * s, 2]], col, mat);
        X.ball(9, 11, 4.4 * s, 3.4 * s, col, mat, { rz: 3 * s, z: 3 });
        // (The fixed finger of the claw.)
        X.slab([[7, 13], [9 - 7 * s, 15 + s], [9 - 6.4 * s, 12], [6, 10]], cc, mat, { z: 4, rz: 1.4, bevel: 0.8 });
      },
    };
  };
  const pincer = (near) => ({
    w: 14, h: 10, px: 11, py: 7, role: 'jaw', layer: near ? 'front' : 'back', parent: near ? 'clawN' : 'clawF', z: near ? 7.5 : -1.5, amp: 1.6, sign: 1,
    at: [7, 9],
    body(X) {
      X.in(0, 1);
      X.slab([[11, 7], [4, 5], [0, 7], [3, 3], [10, 3]], near ? o.claw || dk(c, 0.9) : dk(o.claw || c, 0.78), mat, { rz: 1.4, bevel: 0.8 });
    },
  });
  return {
    size: 64, ay: 61, walk: true,
    body(X, J) {
      const b = J.b * 0.6;
      const walk = J.st && J.st.walk;
      const legY = (i) => (walk ? Math.max(0, Math.sin(J.t * TAU * 2 + i * 1.7)) * 2 : 0);
      X.in(0, 2);
      // Far legs.
      for (let i = 0; i < 3; i++) X.limb([[38 + i * 4, 44 - b, 1.8, -2], [48 + i * 4, 38 - b - legY(i), 1.4, -2], [54 + i * 3, 61 - legY(i), 1, -2]], dk(c, 0.75), mat);
      X.in(1, 3);
      X.ball(36, 44 - b, 20, 9, c, mat, { rz: 9 });
      X.ball(36, 39 - b, 16, 6, lt(c, 1.08), mat, { rz: 7, z: 2 });
      // Eyes on their stalks.
      for (const dx of [0, 5]) X.limb([[24 + dx, 38 - b, 0.9, 6], [22 + dx, 32 - b, 0.7, 6]], c, mat);
      for (const dx of [0, 5]) X.ball(22 + dx, 31 - b, 1.6, 1.6, '#1a1420', 'glass', { z: 7, rz: 1.4 });
      // A mouth of little working parts.
      X.ball(18, 44 - b, 3, 3.4, dk(c, 0.7), mat, { z: 4, rz: 2 });
      X.in(2, 2);
      // Near legs.
      for (let i = 0; i < 3; i++) X.limb([[32 + i * 5, 48 - b, 2, 6], [28 + i * 6, 52 - b - legY(i + 3), 1.6, 6], [26 + i * 6, 61 - legY(i + 3), 1.1, 6]], c, mat);
      X.in(3, 1.5);
      if (o.crown) {
        X.tube(30, 33 - b, 42, 33 - b, 1, 1, o.crown, 'gold', { z: 6 });
        for (let i = 0; i < 5; i++) X.tube(30 + i * 3, 33 - b, 30 + i * 3, 29 - b - (i % 2) * 2, 0.7, 0.25, o.crown, 'gold', { z: 6 });
      }
      if (o.stack) {
        // A sea-stack on its back: rock, ledges, turf on top, a gull.
        X.ball(42, 30 - b, 8, 10, o.stack, 'rock', { rz: 6, z: -1, cell: 4 });
        X.ball(44, 18 - b, 6, 8, o.stack, 'rock', { rz: 5, z: -1, cell: 4 });
        X.ball(44, 11 - b, 6, 2, '#5a8a3a', 'moss', { rz: 2, z: 0 });
        X.ball(46, 8 - b, 1.4, 1, '#f0f0f0', 'feather', { rz: 1, z: 1 });
      }
      if (o.crystals) for (const [x, h2, a] of [[28, 12, -0.4], [34, 16, -0.1], [40, 14, 0.2], [46, 10, 0.5], [37, 9, 0.1]]) {
        X.tube(x, 38 - b, x + Math.sin(a) * h2, 38 - b - h2, 2, 0.4, o.crystals, 'glass', { z: 1 });
      }
      if (o.barnacles) for (let i = 0; i < 6; i++) X.ball(26 + i * 4, 38 - b + (i % 2) * 3, 1.4, 1.2, '#e0d8cc', 'shell', { z: 9, rz: 1 });
    },
    paint(P, J) {
      const b = Math.round(J.b * 0.6);
      // The ridges of its shell.
      for (let i = 0; i < 6; i++) for (let y = 38; y < 50; y++) {
        const x = Math.round(24 + i * 5 + (y - 44) * 0.3 * (i - 2.5));
        const q = P.get(x, y - b);
        if (q[3]) P.set(x, y - b, shade(q, 0.8));
      }
      if (o.paint) o.paint(P, J);
    },
    glow(P, J, t, st) {
      const b = Math.round(J.b * 0.6);
      for (const dx of [0, 5]) P.fx(22 + dx, 31 - b, st.rage ? '#ff4030' : '#ffffff', 0.7);
      if (o.glow) o.glow(P, J);
    },
    parts: { clawF: claw(false), pincerF: pincer(false), clawN: claw(true), pincerN: pincer(true) },
    fx(R, ctx, pose) {
      if (o.fx) inPose(R, ctx, pose, () => o.fx(R, ctx, R.r.time));
    },
  };
}

// ------------------------------------------------------------ wraiths
// `o`: body, face, hair, eyes, mist, belly (a hungry ghost's).
function fwraith(o) {
  const c = o.body;
  const arm = (near) => ({
    w: 28, h: 28, px: 22, py: 4, role: near ? 'weapon' : 'offhand', layer: near ? 'front' : 'back', z: near ? 6 : -2, amp: 0.9, a0: 0.3,
    at: (J) => [near ? 34 : 22, 24 + bobOf(J, 1.6)],
    body(X) {
      const col = near ? c : dk(c, 0.8);
      X.in(0, 1);
      X.limb([[22, 4, 1.8, 1], [16, 12, 1.4, 1], [8, 18, 1, 1]], col, o.belly ? 'flesh' : 'cloth');
      for (let i = 0; i < 4; i++) X.tube(8, 18, 3 + i * 0.6, 22 + i * 0.8, 0.4, 0.15, o.face || c, 'flesh', { z: 2 });
      if (!o.belly) X.slab([[22, 2], [26, 6], [14, 18], [10, 16]], dk(col, 0.9), 'cloth', { z: -1, rz: 1, bevel: 0.8 });
    },
  });
  const head = {
    w: 24, h: 24, px: 13, py: 18, role: 'head', layer: 'front', z: 4, amp: 1.4,
    at: (J) => (o.belly ? [22, 16 + bobOf(J, 1.6)] : [27, 20 + bobOf(J, 1.6)]),
    variant: (R) => (R.st.wind ? 'wail' : ''),
    body(X) {
      X.in(0, 1.5);
      if (o.hair) X.limb([[14, 9, 5.4, 0], [16, 14, 4.4, 0]], o.hair, 'hair');
      X.ball(11, 11, o.belly ? 5 : 5.4, o.belly ? 5 : 6, o.face || c, 'flesh', { rz: 5, z: 2 });
      if (o.hair) X.ball(13, 7, 5.4, 3.4, o.hair, 'hair', { rz: 2.4, z: 4 });
    },
    paint(P, v) {
      for (const x of [8, 12]) P.rect(x - 1, 10, 2, 2, '#140c10');
      if (o.belly) P.set(10, 15, hex('#140c10'));
      else P.rect(9, 14, 2, v === 'wail' ? 5 : 2, '#140c10');
    },
    glow(P) {
      eyes(P, [[8, 11], [12, 11]], o.eyes || '#e0ffff');
    },
  };
  return {
    size: 64, ay: 62, breath: 1.6,
    body(X, J, t) {
      const bob = bobOf(J, 1.6);
      X.in(0, 3);
      if (o.belly) {
        X.ball(30, 40 + bob, 13, 12, c, 'flesh', { rz: 11 });
        X.limb([[28, 28 + bob, 1.6, 4], [25, 21 + bob, 1.4, 5], [23, 16 + bob, 1.6, 6]], c, 'flesh');
        X.ball(30, 46 + bob, 9, 4, dk(c, 0.85), 'flesh', { rz: 3, z: 2 });
      } else {
        const sw = (i) => Math.sin(t * TAU + i) * 2;
        X.slab([[22, 20 + bob], [36, 20 + bob], [40, 38 + bob], [46, 54 + bob + sw(1)], [38, 58 + bob], [32, 54 + bob + sw(2)], [26, 60 + bob], [20, 54 + bob + sw(3)], [16, 38 + bob]], c, 'cloth', { rz: 5, bevel: 4 });
        X.ball(29, 22 + bob, 7, 3, dk(c, 0.9), 'cloth', { rz: 2, z: 3 });
      }
    },
    paint(P, J, t) {
      if (o.belly) return;
      const bob = Math.round(bobOf(J, 1.6));
      // Its rags, in long dark folds.
      for (const fx of [24, 30, 36]) for (let y = 26 + bob; y < 58 + bob; y++) {
        const x = Math.round(fx + Math.sin(y * 0.25 + t * TAU) * 1.2);
        const q = P.get(x, y);
        if (q[3]) P.set(x, y, shade(q, 0.75));
      }
    },
    parts: { armF: arm(false), head, armN: arm(true) },
    behind(R) {
      if (!o.hair) return;
      // Her hair streaming out behind on the wind she brings.
      const h = partAt(R, 'head', 15, 8);
      for (let i = 0; i < 6; i++) {
        const pts = [];
        for (let j = 0; j <= 6; j++) {
          const f = j / 6;
          pts.push({ x: h.x + f * 22 + Math.sin(R.t * 3 + i + f * 3) * 2 * f, y: h.y + i * 1.2 + f * (6 + i) + Math.sin(R.t * 2 + i) * f * 2 });
        }
        drawStrand(R.ctx, pts, i % 2 ? o.hair : lt(o.hair, 1.1), 2, 1);
      }
    },
    fx(R, ctx, pose) {
      const t = R.r.time;
      inPose(R, ctx, pose, () => {
        for (let i = 0; i < 6; i++) {
          const k = (t * 0.6 + i / 6) % 1;
          puff(ctx, R.ox + 18 + i * 5 + Math.sin(k * 6 + i) * 2, R.oy + 60 - k * 14, 1.5 + k * 2, o.mist || '#e0f0ff', 0.4 * (1 - k));
        }
        if (o.fx) o.fx(R, ctx, t);
      });
      shadow(R, ctx, 16);
    },
  };
}

// ------------------------------------------------------------ the masters
const snowFx = (R, ctx, t) => {
  for (let i = 0; i < 6; i++) {
    const k = (t * 0.35 + i / 6) % 1;
    dot(ctx, R.ox + 8 + ((i * 0.618) % 1) * 48 + Math.sin(k * 5 + i) * 3, R.oy + 8 + k * 50, '#ffffff', 0.8 * (1 - k));
  }
};
const glowFx = (col, rx = 24, ry = 8, cy = 36) => (R, ctx, t) => motes(ctx, R.ox + 32, R.oy + cy, t, { n: 6, rx, ry, col });

forge({
  // ---- Velmarch.
  // The Barrow Mammoth: woken out of the ice of a king's barrow, its shaggy
  // coat frozen in ropes, its tusks curving up, eyes cold blue; snow
  // falling off it.
  barrow_mammoth: fquad({ k: 1.25, coat: '#7a6a5a', head: 'mammoth', heavy: 1.2, legs: 15, tusk: '#f0ecdc', shaggy: true, eyes: '#a0e8ff', tails: 1, tailLen: 7, tailW: 0.8, fx: snowFx,
    body(X, J, q) {
      // Ice in its coat.
      X.in(7, 1);
      for (let i = 0; i < 5; i++) X.tube(q.cx - q.len * 0.5 + i * 7, q.cy + q.girth * 0.8, q.cx - q.len * 0.5 + i * 7, q.cy + q.girth * 1.2 + (i % 2) * 2, 0.8, 0.2, '#e0f4ff', 'glass', { z: 8 });
    },
  }),
  // The Bronze Wolf: a wolf of hammered bronze from a fallen emperor's
  // gate, its plates riveted, its eyes molten gold, light in its seams.
  bronze_wolf: fquad({ k: 1.1, coat: '#c08038', mat: 'metal', head: 'canine', eyes: '#ffe080', belly: '#d8a050', tailLen: 14, fx: glowFx('#ffd090'),
    paint(P, J, q) {
      // The plates of it, riveted.
      for (let x = Math.round(q.cx - q.len * 0.6); x < q.cx + q.len * 0.6; x += 5) for (let y = Math.round(q.cy - q.girth); y < q.cy + q.girth; y++) {
        const c = P.get(x, y);
        if (c[3]) P.set(x, y, shade(c, 0.7));
      }
      for (let i = 0; i < 8; i++) P.set(Math.round(q.cx - q.len * 0.5 + i * 4), Math.round(q.cy - q.girth * 0.5), hex('#ffe0a0'));
    },
  }),
  // The Silver Wyrm: a wyrm of the old emperors' hoard, scaled in silver,
  // spined with it, eyes of ice.
  silver_wyrm: fwyrm('silver_wyrm', { scale: '#c8d0dc', belly: '#f0f4f8', mat: 'metal', gloss: 1, spines: '#e8f0ff', spineMat: 'metal', eyes: '#80e0ff', rad: 5.4, horns: '#e8f0ff',
    fx(R, ctx, t) {
      const h = partAt(R, 'head0', 4, 10);
      if (Math.floor(t * 8) % 5 === 0) dot(ctx, h.x + 6, h.y - 4, '#ffffff', 1);
    },
  }),
  // The Marble Colossus: an emperor's statue walked off its plinth, white
  // marble veined in gold where it's cracked and mended, its eyes gold.
  marble_colossus: fgolem({ stone: '#ece8e0', mat: 'rock', eyes: '#ffe080', glow: '#ffd060', seams: true, cracks: '#c8a040',
    body(X, J) {
      // A laurel carved on its head, and a drape over its shoulder.
      X.in(9, 1);
      for (let i = 0; i < 5; i++) X.ball(23 + i * 2.6, 11.5 - J.b - Math.sin((i / 4) * Math.PI) * 1.4, 1.2, 0.8, '#d8d4c8', 'rock', { z: 9, rz: 0.6 });
      X.limb([[20, 22 - J.b, 3, 9], [30, 34 - J.b, 3.4, 9], [40, 44 - J.b, 2.6, 9]], '#e0dcd0', 'cloth');
    },
  }),
  // The War Eagle: the empire's own standard come alive, an eagle the size
  // of a horse, brown and gold, its white head, its talons.
  war_eagle: fbird({ body: '#8a5a2a', breast: '#a87a3a', headCol: '#f0ece0', neck: '#f0ece0', wing: '#7a4a24', cover: '#8a5a2a', tips: '#3a2414', beak: '#f0c040', legs: '#f0c040', eyes: '#ffd040', span: 32 }),

  // ---- Ostria.
  // The Skinwalker: a thing wearing a coyote's hide and a deer's skull,
  // antlered, walking on four legs that aren't quite right; its eyes red.
  skinwalker: fquad({ k: 1.05, coat: '#8a7058', head: 'canine', legs: 18, mask: '#e8e0cc', antlers: '#d8ccb0', eyes: '#ff4030', belly: '#6a5040', tailLen: 10,
    paint(P) {
      // Its hide hanging off it in strips.
      P.over((x, y, c) => (c[3] && y > 40 && (x * 7 + y) % 11 === 0 ? shade(c, 0.55) : null));
    },
    fx(R, ctx, t) {
      const h = partAt(R, 'head', 24, 28);
      glowAt(ctx, h.x - 2, h.y - 1, 4, '#ff4030', 0.3 + 0.15 * Math.sin(t * 5));
    },
  }),
  // The Turquoise Golem: a golem of red rock inlaid with turquoise, the
  // stone of the mesa's people, the light of the sky in its seams.
  turquoise_golem: fgolem({ stone: '#b8603a', mat: 'rock', eyes: '#40e0d0', inlay: '#40d0c8', glow: '#40e0d0', seams: true,
    armExtra(X, near) {
      if (near) for (let i = 0; i < 3; i++) X.ball(10 + i * 2, 22 + i * 3, 1.2, 1.2, '#40d0c8', 'glass', { z: 6, rz: 0.8 });
    },
  }),
  // The Great Centipede: as long as a hall, banded red and gold, its
  // hundred legs rippling along it, mandibles working.
  great_centipede: fwyrm('great_centipede', { scale: '#a83418', belly: '#e0a040', mat: 'chitin', legs: '#e08030', bands: true, eyes: '#ffe060', rad: 4.2, n: 14, gloss: 0.9, mandibles: '#e08030' }),
  // The Nine-Tailed Fox: an old fox spirit, orange as fire, nine tails
  // fanned behind it each tipped white, foxfire round it.
  nine_tailed_fox: fquad({ k: 1.1, coat: '#e08030', head: 'fox', tails: 9, tailLen: 15, tailW: 1.8, tailTip: '#fff8e8', belly: '#fff0d8', eyes: '#ffe080',
    fx(R, ctx, t) {
      for (let i = 0; i < 4; i++) {
        const a = t * 1.3 + (i / 4) * TAU;
        const x = R.ox + 32 + Math.cos(a) * 26;
        const y = R.oy + 34 + Math.sin(a) * 8;
        flame(ctx, x, y, 4, t, { ph: i, w: 2, cols: ['#ffffff', '#c8f0ff', '#80c0ff', '#4060c0', '#203080'], a: 0.85 });
      }
    },
  }),
  // The Hungry Ghost: a ghost that ate nothing all its life for greed and
  // starves for ever: a swollen belly on a neck like a thread, a mouth like
  // a needle's eye, green and pale.
  hungry_ghost: fwraith({ body: '#90b8a0', belly: true, eyes: '#e0fff0', mist: '#a0e0c0' }),
  // The Thunderbird: the storm's own bird, dark blue and red, its wings
  // edged with gold, lightning crackling in its feathers.
  thunderbird: fbird({ body: '#2a3a7a', breast: '#c83a2a', headCol: '#2a3a7a', wing: '#1e2a6a', cover: '#2a3a7a', tips: '#e0b030', beak: '#e0b030', crest: '#e0b030', eyes: '#ffffff', span: 34,
    fx(R, ctx, t) {
      if (Math.floor(t * 12) % 6 < 2) {
        const a = partAt(R, 'wingN', 20, 6);
        bolt(ctx, a.x, a.y, a.x - 6, a.y + 14, t, { col: '#c8e0ff' });
      }
      glowAt(ctx, R.ox + 33, R.oy + 30, 12, '#8090ff', 0.1 + 0.08 * Math.sin(t * 9));
    },
  }),
  // The Jade Dragon: a dragon of the eastern kind, long and jade-green,
  // gold-bellied, maned and whiskered, its horns like a stag's, a pearl of
  // light it chases.
  jade_dragon: fwyrm('jade_dragon', { scale: '#40b878', belly: '#e8d070', mat: 'scales', horns: '#f0e8c8', whiskers: '#e8d070', mane: '#e0c050', spines: '#e0c050', eyes: '#ffe060', gloss: 0.9, rad: 5,
    fx(R, ctx, t) {
      const h = partAt(R, 'head0', 4, 10);
      const x = h.x - 8 + Math.cos(t * 1.5) * 4;
      const y = h.y - 6 + Math.sin(t * 2) * 3;
      glowAt(ctx, x, y, 4, '#fff0b0', 0.5);
      dot(ctx, x - 1, y - 1, '#ffffff', 1, 2, 2);
    },
  }),

  // ---- Corrow.
  // The Carrion Roc: a vulture as big as a boat, bald red head and neck,
  // its wings black and ragged.
  carrion_roc: fbird({ body: '#3a3028', breast: '#5a4a3a', headCol: '#c87a6a', neck: '#c87a6a', bald: true, wing: '#2e2620', cover: '#3a3028', tips: '#14100c', beak: '#d8c8a0', legs: '#8a7a6a', eyes: '#ffd040', span: 36 }),
  // The Bull Walrus: the old bull of the whale-coast, scarred and huge,
  // whiskered, its tusks long as spears.
  bull_walrus: fquad({ k: 1.3, coat: '#a07860', mat: 'leather', head: 'walrus', heavy: 1.6, legs: 6, noLegs: true, ears: false, tusk: '#f4ecdc', eyes: '#3a2a20', tails: 0, noStrands: true,
    paint(P) {
      P.over((x, y, c) => (c[3] && hash2(x, y, 4) > 0.94 ? shade(c, 0.6) : null));
    },
  }),
  // The Gut Wyrm: a worm that lived in the great whale's gut and ate its
  // way out, pale and blind and banded, glistening.
  gut_wyrm: fwyrm('gut_wyrm', { scale: '#d8b8a0', belly: '#f0d8c8', mat: 'flesh', bands: true, eyes: '#a8c040', blind: true, rad: 5.4, gloss: 1, teeth: '#f8f0c0',
    fx(R, ctx, t) {
      const h = partAt(R, 'head0', 6, 14);
      drops(ctx, h.x, h.y, t, [0, 3], { col: '#c8d880', len: 10, speed: 0.9 });
    },
  }),
  // ---- Saltmere.
  // The Salt Wyrm: a wyrm of the salt-flats, white as them, crusted with
  // salt crystals, its eyes pink.
  salt_wyrm: fwyrm('salt_wyrm', { scale: '#f0ece8', belly: '#ffffff', mat: 'rock', crystals: '#ffffff', spines: '#ffffff', spineMat: 'glass', eyes: '#f0a8c8', rad: 5.2 }),
  // The Flamingo Seraph: a flamingo with six wings, pink as dawn, a halo
  // of gold over its head.
  flamingo_seraph: fbird({ body: '#ff90b8', breast: '#ffb8d0', headCol: '#ff9ac0', neck: '#ff9ac0', wing: '#ff80b0', cover: '#ff90b8', tips: '#1a1420', beak: '#2a2020', longNeck: true, longLegs: '#e07090', extraWings: true, halo: '#fff0a0', eyes: '#ffffff', span: 28 }),
  // The Lagoon Hydra: three necks out of the lagoon, teal and pink.
  lagoon_hydra: fwyrm('lagoon_hydra', { scale: '#3a9098', belly: '#ff9ac0', mat: 'scales', heads: 3, eyes: '#ffe060', rad: 4, gloss: 1 }),
  // The Mirage Lion: a lion of the shimmering flats, golden, its mane of
  // fire-red, a haze rising off it.
  mirage_lion: fquad({ k: 1.15, coat: '#e0b060', head: 'cat', mane: '#c87a30', belly: '#f0d8a0', tailTip: '#8a4a20', eyes: '#ffe080', tailLen: 13,
    headExtra(X, c, r) {
      for (let i = 0; i < 9; i++) {
        const a = -Math.PI * 0.2 + (i / 8) * Math.PI * 1.3;
        X.ball(c.x + r * 0.5 + Math.cos(a) * r * 1.15, c.y + Math.sin(a) * r * 1.1, r * 0.6, r * 0.6, i % 2 ? '#c87a30' : '#a85a20', 'hair', { rz: r * 0.4, z: 1 });
      }
    },
    fx(R, ctx, t) {
      for (let i = 0; i < 8; i++) {
        const k = (t * 0.8 + i / 8) % 1;
        dot(ctx, R.ox + 10 + i * 6, R.oy + 56 - k * 26, '#fff8e0', 0.35 * (1 - k), 2, 1);
      }
    },
  }),
  // The Brine Crab King: a crab red as a boiled one, barnacled, wearing a
  // crown of white coral.
  brine_crab_king: fcrab({ shell: '#e06040', claw: '#c84030', crown: '#f0f0f8', barnacles: true }),
  // The Crystal Matriarch: a crawler of living salt crystal, lilac and
  // white, crystals standing out of her back, a glow in them.
  crystal_matriarch: fcrab({ shell: '#d8d0e8', mat: 'glass', claw: '#c8b8e8', crystals: '#ffffff', fx: glowFx('#e0d0ff', 24, 6, 40) }),

  // ---- Hollowmark.
  // The Mole King: a mole the size of a cart, velvet-black, its pink star
  // of a nose feeling the air, claws like spades, a crown of gold.
  mole_king: fquad({ k: 1.15, coat: '#5a4a48', mat: 'velvet', head: 'mole', heavy: 1, legs: 8, claws: '#e8e0cc', crown: '#e0c050', eyes: false, tails: 1, tailLen: 6, tailW: 0.8 }),
  // The Glowworm Queen: a worm of the deep caves, translucent blue, lights
  // glowing down her, dripping threads of light.
  glowworm_queen: fwyrm('glowworm_queen', { scale: '#5a8aa0', belly: '#c8f0ff', mat: 'slime', eyes: '#c8ffff', rad: 4.6, gloss: 1,
    fx(R, ctx, t) {
      for (let i = 0; i < 6; i++) {
        const k = (t * 0.6 + i / 6) % 1;
        const h = partAt(R, 'neck0', 16 - i * 1.5, 36 - i * 5);
        dot(ctx, h.x, h.y + k * 18, '#80e8ff', 0.8 * (1 - k), 1, 2);
        glowAt(ctx, h.x + 2, h.y, 2, '#80e8ff', 0.3);
      }
    },
  }),
  // The Deep Golem: a golem of the deep stone, dark, fire in its seams.
  deep_golem: fgolem({ stone: '#4a4048', mat: 'rock', eyes: '#ffb040', glow: '#ff8020', seams: true,
    fx(R, ctx, t) {
      embers(ctx, R.ox + 20, R.oy + 40, 24, t, { n: 5, rise: 24 });
    },
  }),
  // The Moth Queen: a moth of gold and amber, eyes on her wings, dust of
  // light sifting off her.
  moth_queen: fbird({ moth: true, body: '#a87830', headCol: '#c89040', wing: '#e0a030', spot: '#2a1a0a', spot2: '#ffe060', feelers: '#e0c070', eyes: '#1a1420',
    fx(R, ctx, t) {
      for (let i = 0; i < 7; i++) {
        const k = (t * 0.4 + i / 7) % 1;
        dot(ctx, R.ox + 18 + i * 5 + Math.sin(k * 6 + i) * 2, R.oy + 40 + k * 20, '#ffd070', 0.8 * (1 - k));
      }
    },
  }),
  // The Cave Bear: a bear of the deep caves, huge and old, its coat dark,
  // its eyes reflecting the light.
  cave_bear: fquad({ k: 1.3, coat: '#6a5038', head: 'bear', heavy: 1.4, legs: 12, eyes: '#ffb040', tails: 0, belly: '#5a4430', claws: '#e0d8c0' }),
  // The First Digger: the mole-thing that dug the first warren, naked,
  // pink and wrinkled, blind, with claws of bone; earth falling off it.
  first_digger: fquad({ k: 1.3, coat: '#b88a7a', mat: 'flesh', head: 'mole', heavy: 1.2, legs: 9, claws: '#f0e8d8', eyes: false, tails: 1, tailLen: 8, tailW: 1, noStrands: true,
    paint(P) {
      // Its wrinkles.
      P.over((x, y, c) => (c[3] && (x + Math.round(Math.sin(y * 0.6) * 2)) % 5 === 0 ? shade(c, 0.8) : null));
    },
    fx(R, ctx, t) {
      for (let i = 0; i < 5; i++) {
        const k = (t * 0.8 + i / 5) % 1;
        dot(ctx, R.ox + 12 + i * 8, R.oy + 40 + k * k * 20, '#7a5a3a', 0.9 * (1 - k), 2, 2);
      }
    },
  }),

  // ---- the Wyrd Isle.
  // The Rune Golem: a golem of the standing stones, grey and mossed, runes
  // cut deep in it lighting one after another.
  rune_golem: fgolem({ stone: '#8a8a86', mat: 'rock', eyes: '#80e8ff', glow: '#80e8ff', runes: true, moss: '#5a7a4a' }),
  // The Ninth Wyrm: the last of nine wyrms, violet-black, its belly pale
  // green, its spines and eyes the green of witch-fire.
  ninth_wyrm: fwyrm('ninth_wyrm', { scale: '#4a3a7a', belly: '#a0ffd0', mat: 'scales', horns: '#c8c0b0', spines: '#a0ffd0', eyes: '#a0ffd0', rad: 5.2, gloss: 0.8,
    fx(R, ctx, t) {
      const h = partAt(R, 'head0', 4, 12);
      smoke(ctx, h.x, h.y, t, { n: 3, rise: 6, drift: -6, col: '#a0ffd0', dark: '#60c090', a: 0.4, r0: 0.8 });
    },
  }),
  // The Banshee: a woman of mist in grey-white rags, her hair streaming,
  // her mouth open in the wail.
  banshee: fwraith({ body: '#c8d8e8', face: '#e0e8f0', hair: '#f0f4f8', eyes: '#80ffff', mist: '#e0f0ff' }),
  // The White Hart: the hart that is never caught, white as snow, its
  // antlers like silver branches, light about it.
  white_hart: fquad({ k: 1.15, coat: '#f4f4f0', head: 'deer', legs: 19, antlers: '#f8f0d8', eyes: '#80ffd0', hoof: '#c8c8b8', belly: '#ffffff', tailLen: 5, fx: glowFx('#c8ffe8', 26, 10, 30) }),
  // The Hill Sleeper: a giant so long asleep a hill grew on him, turf and
  // stone and moss, violet light in his runes.
  hill_sleeper: fgolem({ stone: '#6a7a4a', mat: 'moss', moss: '#5a8a3a', hump: '#4a7a32', eyes: '#c8a0ff', glow: '#c8a0ff', runes: true,
    body(X, J) {
      // A little tree on his hump, a stone or two.
      X.in(9, 1);
      X.limb([[46, 12 - J.b, 0.8, -1], [47, 4 - J.b, 0.6, -1]], '#4a3a2a', 'bark');
      X.ball(47, 3 - J.b, 3.4, 2.6, '#3a6a2a', 'moss', { z: -1, rz: 2 });
      X.ball(36, 12 - J.b, 2.6, 2, '#8a8a86', 'rock', { z: -1, rz: 1.4 });
    },
  }),

  // ---- the Grey Skerries.
  // The Storm Giant: a giant of the sea-storms, grey-skinned, beard like
  // spray, clouds round his head and lightning in them.
  storm_giant: fgolem({ stone: '#7a8a9a', mat: 'skin', headCol: '#8a9aa8', beard: '#c8d8e8', eyes: '#e0e8ff', glow: '#c8d8ff', seams: true,
    fx(R, ctx, t) {
      for (let i = 0; i < 5; i++) puff(ctx, R.ox + 14 + i * 8, R.oy + 6 + Math.sin(t * 2 + i) * 2, 4.5, '#6a7a8a', 0.4);
      if (Math.floor(t * 10) % 7 === 0) bolt(ctx, R.ox + 30, R.oy + 6, R.ox + 24, R.oy + 22, t);
    },
  }),
  // The Stack Crab: a crab old as the skerries, a sea-stack grown on its
  // back with turf on top.
  stack_crab: fcrab({ shell: '#8a8a7a', claw: '#e08060', stack: '#7a7a72', barnacles: true }),
  // The Storm Petrel: the bird that rides the storm, grey and white, the
  // spray going past it.
  storm_petrel: fbird({ body: '#5a6070', breast: '#e0e4ec', headCol: '#3a4050', wing: '#3a4050', cover: '#5a6070', tips: '#1a1e24', beak: '#2a2a30', legs: '#2a2a30', eyes: '#ffffff', span: 34,
    fx(R, ctx, t) {
      for (let i = 0; i < 5; i++) {
        const k = (t * 1.4 + i / 5) % 1;
        dot(ctx, R.ox + 60 - k * 56, R.oy + 14 + i * 7, '#c8e0f0', 0.6 * (1 - k), 3, 1);
      }
    },
  }),
  // The Sea Trow: a trow of the sea, green-skinned, weed for hair and
  // beard, dripping.
  sea_trow: fgolem({ stone: '#5a8a6a', mat: 'skin', headCol: '#6a9a7a', eyes: '#e0f0ff', moss: '#2a5a3a', mossMat: 'moss', beard: '#3a6a4a',
    fx(R, ctx, t) {
      drops(ctx, R.ox + 18, R.oy + 40, t, [0, 7, 14, 22, 28], { col: '#80c8e8', len: 18, speed: 0.6 });
    },
  }),
});

// ------------------------------------------------------------ the shapeless
const beatOf = (t) => {
  const k = (t * 2) % 1;
  return Math.max(0, Math.sin(k * TAU * 2)) * (k < 0.5 ? 1 : 0);
};
forge({
  // The Leviathan's Heart: a heart as big as a cart, cut out of the great
  // whale and still beating, red and wet, its vessels running up out of
  // it; bile dripping off it.
  leviathan_heart: {
    size: 64, ay: 62,
    body(X, J, t) {
      const beat = beatOf(t);
      const s = 1 + beat * 0.08;
      X.in(0, 3);
      for (const [x0, x1, y1, c] of [[24, 16, 4, '#a02030'], [32, 34, 1, '#3a5a9a'], [38, 48, 6, '#a02030']]) X.limb([[x0, 22, 4, 0], [(x0 + x1) / 2, 12, 3.4, 0], [x1, y1, 3, 0]], c, 'flesh');
      X.in(1, 4);
      X.ball(23, 30, 13 * s, 12 * s, '#c02838', 'flesh', { rz: 12 });
      X.ball(39, 30, 12 * s, 11 * s, '#b02434', 'flesh', { rz: 11, z: 1 });
      X.ball(31, 44, 10 * s, 11 * s, '#a01e2e', 'flesh', { rz: 9, z: 2 });
      X.ball(31, 55, 5, 4, '#8a1a28', 'flesh', { rz: 4, z: 2 });
      X.in(2, 1.5);
      for (const [x0, y0, x1, y1] of [[17, 26, 24, 42], [29, 20, 32, 48], [42, 24, 38, 44]]) X.tube(x0, y0, x1, y1, 0.9, 0.7, '#5a3a9a', 'flesh', { z: 10 });
      // Fat on it, yellowed.
      X.ball(28, 20, 6, 3, '#e8d0a0', 'flesh', { rz: 2, z: 11 });
    },
    paint(P) {
      P.over((x, y, c) => (c[3] && hash2(x, y, 9) > 0.93 ? mix(c, [255, 200, 210], 0.4) : null));
    },
    fx(R, ctx, pose) {
      const t = R.r.time;
      const beat = beatOf((R.e.artPhase || 0) % 1);
      inPose(R, ctx, pose, () => {
        glowAt(ctx, R.ox + 31, R.oy + 36, 14, '#ff8090', beat * 0.25);
        drops(ctx, R.ox + 20, R.oy + 52, t, [0, 6, 14, 22], { col: '#a8c040', len: 9, speed: 0.8 });
      });
    },
  },
  // The Oil Bloat: a sac of whale-oil swollen near to bursting, rainbows
  // sliding over it, little eyes, feelers trailing, oil dripping.
  oil_bloat: {
    size: 64, ay: 62, breath: 1.6,
    body(X, J) {
      const bob = bobOf(J, 2);
      X.in(0, 3);
      X.ball(32, 28 + bob, 20 + J.b * 0.5, 18 + J.b * 0.5, '#4a3e2a', 'slime', { rz: 17 });
      X.ball(25, 21 + bob, 8, 6, '#6a5a3a', 'slime', { rz: 5, z: 6 });
      X.ball(42, 33 + bob, 5, 4, '#5a4a30', 'slime', { rz: 4, z: 6 });
      X.in(1, 1);
      for (let i = 0; i < 5; i++) X.limb([[20 + i * 6, 44 + bob, 1.2, 4], [19 + i * 6 + Math.sin(J.t * TAU + i) * 2, 52 + bob, 0.9, 4], [20 + i * 6 + Math.sin(J.t * TAU + i + 1) * 3, 58, 0.5, 4]], '#3a3020', 'slime');
    },
    paint(P, J, t) {
      const bob = Math.round(bobOf(J, 2));
      const k = t % 1;
      for (let i = 0; i < 10; i++) P.fx(14 + k * 30 + i, 16 + i * 0.6 + bob, ['#ff80c0', '#80c0ff', '#c0ff80', '#ffe080'][i % 4], 0.4);
      for (let i = 0; i < 10; i++) P.fx(20 + k * 24 + i, 34 + i * 0.4 + bob, ['#80c0ff', '#c0ff80', '#ffe080', '#ff80c0'][i % 4], 0.3);
    },
    glow(P, J) {
      const bob = Math.round(bobOf(J, 2));
      eyes(P, [[17, 26 + bob], [22, 22 + bob], [27, 27 + bob]], '#ffd070');
    },
    fx(R, ctx, pose) {
      const t = R.r.time;
      inPose(R, ctx, pose, () => drops(ctx, R.ox + 24, R.oy + 46, t, [0, 9, 17], { col: '#2a2418', len: 14, speed: 0.6 }));
      shadow(R, ctx, 22);
    },
  },
  // The Kraken's Spawn: a young kraken, pink and slick, eyes like plates,
  // its beak; eight arms curling about it.
  kraken_spawn: {
    size: 64, ay: 60,
    body(X, J) {
      const bob = J.b;
      X.in(0, 3);
      X.ball(38, 22 + bob, 13, 16, '#c05080', 'slime', { rz: 12, ang: 0.3 });
      X.ball(30, 36 + bob, 11, 9, '#a84070', 'slime', { rz: 9, z: 2 });
      X.in(1, 1);
      X.slab([[22, 40 + bob], [27, 39 + bob], [24, 45 + bob]], '#2a1a14', 'chitin', { z: 9, rz: 1 });
    },
    paint(P, J) {
      const bob = Math.round(J.b);
      for (let i = 0; i < 8; i++) P.fx(36 + i * 2, 14 + (i % 2) * 3 + bob, '#ffb0d0', 0.4);
    },
    glow(P, J, t, st) {
      const bob = Math.round(J.b);
      eyes(P, [[26, 32 + bob], [34, 31 + bob]], st.rage ? '#ff4030' : '#ffe070', { big: true });
    },
    front(R) {
      for (let i = 0; i < 8; i++) {
        const near = i % 2 === 0;
        const a0 = Math.PI * 0.5 + (i - 3.5) * 0.32;
        const pts = beastCurl(R.ox + 30 + (i - 3.5) * 2.6, R.oy + 42, a0, 9, 2.4, R.t, i * 0.9, R.st.wind ? 0.6 : 0.42);
        drawStrand(R.ctx, pts, near ? '#c05080' : '#8a3060', 4, 1, { alpha: near ? 1 : 0.85 });
      }
    },
  },
  // The Thing Below: a mass rising out of the floor, mouths and eyes all
  // over it, opening and shutting, tendrils feeling about.
  thing_below: {
    size: 64, ay: 62,
    body(X, J, t) {
      const b = J.b * 1.2;
      X.in(0, 4);
      X.ball(32, 54, 26, 9, '#2a1e38', 'flesh', { rz: 7 });
      X.ball(32, 40 + b * 0.5, 18, 15, '#3a2a48', 'flesh', { rz: 13, z: 2 });
      X.ball(25, 27 + b, 9, 8, '#4a3458', 'flesh', { rz: 8, z: 5 });
      X.ball(40, 30 + b, 7, 6, '#4a3458', 'flesh', { rz: 6, z: 4 });
    },
    paint(P, J, t, st) {
      const b = Math.round(J.b * 1.2);
      // Mouths, lined with teeth.
      for (const [x, y] of [[30, 44], [40, 48], [22, 50]]) {
        P.rect(x - 2, y + b, 5, 2, '#140810');
        for (let i = 0; i < 5; i += 2) P.set(x - 2 + i, y + b, hex('#e0d8c0'));
      }
      void st;
    },
    glow(P, J, t, st) {
      const b = Math.round(J.b * 1.2);
      [[23, 25], [29, 23], [27, 31], [40, 30], [44, 38], [34, 38], [20, 40], [48, 46]].forEach(([x, y], i) => {
        const open = Math.floor(t * 8 + i * 3) % 7 !== 0;
        if (open) eyes(P, [[x, y + b]], st.rage ? '#ff4030' : '#ffe070', { big: i < 2 });
        else P.rect(x - 1, y + b, 3, 1, '#1a0e20');
      });
    },
    parts: Object.fromEntries([0, 1, 2, 3, 4, 5].map((i) => {
      const a = -Math.PI + (i / 5) * Math.PI;
      return [`tendril${i}`, {
        w: 12, h: 26, px: 6, py: 24, role: 'sway', layer: i % 2 ? 'back' : 'front', z: i % 2 ? -1 : 3, depth: 0.35, rate: 1.3, phase: i * 1.1, amp: 1.4, a0: a + Math.PI / 2,
        at: [32 + Math.cos(a) * 16, 42 + Math.sin(a) * 10],
        body(X) {
          X.in(0, 1);
          X.limb([[6, 24, 2, 1], [5, 14, 1.4, 1], [7, 5, 0.8, 1], [6, 1, 0.3, 1]], '#5a4068', 'flesh');
        },
      }];
    })),
    fx(R, ctx, pose) {
      const t = R.r.time;
      inPose(R, ctx, pose, () => {
        for (let i = 0; i < 4; i++) {
          const k = (t * 0.6 + i / 4) % 1;
          dot(ctx, R.ox + 14 + i * 12, R.oy + 56 - k * 10, '#a060c0', 0.6 * (1 - k));
        }
      });
    },
  },
  // The Scrimshaw Horror: a heap of whalebones that moves as one, every
  // bone carved with the names of the drowned in blue ink, the carvings
  // glowing one after another; its arms of rib.
  scrimshaw_horror: {
    size: 64, ay: 62,
    body(X, J) {
      const b = J.b * 0.8;
      X.in(0, 3);
      X.ball(33, 48, 22, 12, '#e0d8c4', 'bone', { rz: 10 });
      X.ball(31, 33 + b, 15, 12, '#e8e0cc', 'bone', { rz: 11, z: 2 });
      X.ball(21, 21 + b, 8, 7, '#f0e8d8', 'bone', { rz: 7, z: 5 });
      X.in(1, 1);
      for (let i = 0; i < 9; i++) {
        const a = hash2(i, 3, 5) * TAU;
        const r = 9 + hash2(i, 7, 1) * 9;
        X.tube(33 + Math.cos(a) * r, 42 + Math.sin(a) * r * 0.5 + b, 33 + Math.cos(a + 1) * (r + 6), 42 + Math.sin(a + 1) * (r + 6) * 0.5 + b, 1.4, 0.9, i % 2 ? '#f0e8d8' : '#d8ccb4', 'bone', { z: 8 });
      }
      // A jaw, a whale's, hung open under its skull.
      X.limb([[15, 26 + b, 1.4, 7], [9, 30 + b, 1.2, 7], [6, 34 + b, 0.8, 7]], '#e8e0cc', 'bone');
    },
    paint(P, J, t) {
      const b = Math.round(J.b * 0.8);
      P.rect(17, 19 + b, 2, 2, '#140c10');
      P.rect(22, 19 + b, 2, 2, '#140c10');
      for (let i = 0; i < 8; i++) {
        const on = Math.floor(t * 8) % 8 === i;
        const x = 20 + (i % 4) * 7;
        const y = 33 + Math.floor(i / 4) * 11 + b;
        P.line(x, y, x + 4, y + 1, on ? '#a0e0ff' : '#3a6a9a');
        P.line(x, y + 2, x + 3, y + 3, on ? '#a0e0ff' : '#3a6a9a');
      }
    },
    glow(P, J) {
      const b = Math.round(J.b * 0.8);
      P.fx(17, 19 + b, '#5a9ad8', 1);
      P.fx(23, 19 + b, '#5a9ad8', 1);
    },
    parts: {
      armF: {
        w: 22, h: 30, px: 6, py: 26, role: 'offhand', layer: 'back', z: -1, amp: 1, at: [46, 34],
        body(X) {
          X.in(0, 1);
          X.limb([[6, 26, 2.4, 1], [12, 16, 1.8, 1], [10, 6, 1.2, 1], [6, 2, 0.6, 1]], '#c8bca4', 'bone');
        },
      },
      armN: {
        w: 24, h: 32, px: 18, py: 28, role: 'weapon', layer: 'front', z: 9, amp: 1, a0: 0, at: [22, 34],
        body(X) {
          X.in(0, 1);
          X.limb([[18, 28, 2.6, 1], [12, 18, 2, 1], [12, 8, 1.4, 1], [16, 2, 0.6, 1]], '#e8e0cc', 'bone');
          for (let i = 0; i < 3; i++) X.tube(12, 10 + i * 4, 7, 9 + i * 4, 0.6, 0.2, '#f0e8d8', 'bone', { z: 2 });
        },
      },
    },
  },
  // The Drowned Bell: a bronze bell from a drowned kirk, green with the
  // sea, weed hanging off its lip, its clapper swinging inside; it hangs in
  // the air, and tolls.
  drowned_bell: {
    size: 64, ay: 62,
    body(X, J) {
      const bob = bobOf(J, 1);
      X.in(0, 3);
      X.ball(32, 6 + bob, 6, 3, '#8a7030', 'gold', { rz: 3 });
      X.slab([[24, 8 + bob], [40, 8 + bob], [44, 22 + bob], [50, 40 + bob], [52, 46 + bob], [12, 46 + bob], [14, 40 + bob], [20, 22 + bob]], '#a88838', 'gold', { rz: 10, bevel: 8 });
      X.tube(12, 46 + bob, 52, 46 + bob, 2.2, 2.2, '#c8a848', 'gold', { z: 6 });
      X.in(1, 1);
      for (let i = 0; i < 7; i++) X.limb([[13 + i * 6.4, 47 + bob, 0.8, 8], [13 + i * 6.4 + Math.sin(J.t * TAU + i), 53 + bob, 0.6, 8], [14 + i * 6.4 + Math.sin(J.t * TAU + i + 1) * 1.5, 57 + bob, 0.4, 8]], '#3a6a3a', 'moss');
      // Bands cast round it.
      for (const y of [18, 34]) X.ball(32, y + bob, 15 + (y - 18) * 0.35, 1, '#c8a848', 'gold', { z: 10, rz: 0.8 });
    },
    paint(P, J) {
      const bob = Math.round(bobOf(J, 1));
      for (let i = 0; i < 22; i++) {
        const x = 16 + Math.floor(hash2(i, 1, 1) * 32);
        const y = 12 + Math.floor(hash2(i, 2, 2) * 32) + bob;
        const q = P.get(x, y);
        if (q[3]) P.set(x, y, mix(q, [90, 168, 144], 0.6));
      }
    },
    parts: {
      clapper: {
        w: 10, h: 26, px: 5, py: 2, role: 'sway', layer: 'back', z: -1, depth: 0.25, rate: 1.4, amp: 1.5,
        at: (J) => [32, 12 + bobOf(J, 1)],
        body(X) {
          X.in(0, 1);
          X.tube(5, 2, 5, 18, 0.9, 0.9, '#5a4a2a', 'metal');
          X.ball(5, 21, 3.2, 3.4, '#6a5a2a', 'metal', { z: 2, rz: 2 });
        },
      },
    },
    fx(R, ctx, pose) {
      const t = R.r.time;
      inPose(R, ctx, pose, () => {
        // As it tolls, rings of sound going out from it.
        if (R.st.wind || (R.A && R.A.k)) {
          const k = (t * 1.5) % 1;
          ctx.globalAlpha = 0.6 * (1 - k);
          ctx.strokeStyle = '#fff0b0';
          ctx.beginPath();
          ctx.ellipse(R.ox + 32, R.oy + 30, 10 + k * 26, (10 + k * 26) * 0.6, 0, 0, TAU);
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
        drops(ctx, R.ox + 16, R.oy + 50, t, [0, 8, 16, 24, 32], { col: '#80c8e8', len: 10, speed: 0.6 });
      });
      shadow(R, ctx, 24);
    },
  },
});
