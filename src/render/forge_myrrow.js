// (Round 71) The masters of Myrrow's old places and of Thessa's grove,
// forged anew (see forge.js, forgekit.js): the Bog King in his rotted
// gold, the Moth-Mother on her four wings, the Willow Wight, the Spore
// Colossus, the Lamprey Queen, the Bloat, the Lantern Lord, the Hollow
// King, the Drowned Choir, Sharktooth, the Pearl Queen, the Smugglers'
// Kraken, the Tide Mother, the Abyssal Clam and the Coral Colossus; the
// Elder Stag and the Hollow Oak.
import { FORGE, forge, inPose, partAt, forgePart } from './forge.js';
import { eyes, glow, along, dk, HG, figure, quadruped, beastHead, strands as kitStrands } from './forgekit.js';
const strands = (P) => kitStrands(P, 'hair', { dir: [0.2, 1], len: 3, density: 0.25 });
import { smoke, puff, drops, glowAt, motes, dot } from './forgefx.js';
import { hex, mix, shade } from './pixel.js';
import { hash2 } from './paint.js';
import { drawChain, drawStrand } from './bossrig.js';
import { beastSerpent, krakenArms, lampreyCfg, lampreyUnder, bloatFeelers, shoal, mothMarks } from './bossbeasts.js';

const TAU = Math.PI * 2;
const HC = { x: 14, y: 14 };
const onHead = (R, dx, dy) => partAt(R, 'head', HC.x + dx, HC.y + dy);
const onBlade = (R, d, side = 0) => {
  const q = R.D.parts.blade;
  const wang = R.D.parts.armN.wang;
  const a = along({ x: q.px, y: q.py }, wang, d, side);
  return partAt(R, 'blade', a.x, a.y);
};
const eyesOf = (c, r) => [[Math.round(c.x - r * 0.62), Math.round(c.y - r * 0.08)], [Math.round(c.x - r * 0.08), Math.round(c.y - r * 0.08)]];
// Moss or weed hanging in strands (sculpted), from each of `pts`.
function hanging(X, pts, len, cols, z, mat = 'moss') {
  pts.forEach(([x, y], i) => {
    const l = len * (0.6 + hash2(i, 3, 8) * 0.6);
    X.limb([[x, y, 0.9, z], [x + 0.6, y + l * 0.5, 0.7, z], [x + 0.2, y + l, 0.35, z]], cols[i % cols.length], mat);
  });
}

// (The Moth-Mother's wings, bigger than they were.)
const MK = 1.35;
const mk = (pts) => pts.map(([x, y]) => [x * MK, y * MK]);

// ------------------------------------------------------------ figures
const LANTERN_LORD = figure({
  stance: { h: 1.04, w: 0.98 },
  robe: { col: '#2a3a3a', ragged: true, trim: '#80e8d0', trimMat: 'glass', front: '#1e2c2c', flare: 1.15 },
  torso: { col: '#2a3a3a', mat: 'cloth', build: 'lean' },
  belt: { col: '#1a2424', buckle: '#80e8d0' },
  head: {
    kind: 'man', r: 5, col: '#a8b8b0', hair: '#d0e0dc', hairStyle: 'long', face: { eye: '#80e8d0', white: '#d0fff0' },
    extra(X, c, r) {
      // His hat: the wide cap of a toadstool, its gills under it.
      X.in(HG.head, 1);
      X.ball(c.x + r * 0.2, c.y - r * 0.85, r * 1.9, r * 0.75, '#3a5a5a', 'fungus', { z: 19, rz: 2.4 });
      X.ball(c.x + r * 0.2, c.y - r * 0.45, r * 1.75, r * 0.22, '#c8d8c0', 'fungus', { z: 18.5, rz: 0.6 });
    },
    paint(P, c, r) {
      // Pale spots on the cap; its gills.
      for (const [dx, dy] of [[-1.2, -1.1], [0.3, -1.3], [1.4, -0.9], [-0.4, -0.8]]) P.set(Math.round(c.x + dx * r), Math.round(c.y + dy * r), hex('#c8f0e0'));
      for (let i = -8; i <= 9; i += 2) {
        const x = Math.round(c.x + r * 0.2 + i);
        const y = Math.round(c.y - r * 0.45);
        const q = P.get(x, y);
        if (q[3]) P.set(x, y, shade(q, 0.6));
      }
    },
    glow(P, c, r) {
      eyes(P, eyesOf(c, r), '#80e8d0');
    },
  },
  arm: { col: '#a8b8b0', r: 2.9, sleeve: '#2a3a3a', L1: 8.6, L2: 8, wang: 0.2 },
  weapon: {
    kind: 'staff', len: 30, grip: '#3a3a30', butt: 12,
    head(X, at, z) {
      // A shepherd's crook at its top.
      X.limb([[...at(29), 1.1, z], [...at(32.5, -1), 1, z], [...at(33.5, -3.5), 0.9, z], [...at(31.5, -5.5), 0.8, z], [...at(29.5, -5), 0.7, z]], '#3a3a30', 'wood');
    },
  },
  fist: { col: '#a8b8b0', mat: 'skin', r: 2.3 },
  armF: { col: '#a8b8b0', r: 2.9, sleeve: '#2a3a3a' },
  parts: {
    // (Drawn by hand, swinging: see front.)
    lantern: {
      w: 11, h: 13, px: 5.5, py: 1, role: 'none', layer: 'front', at: [0, 0], show: () => false,
      body(X) {
        X.in(0, 1);
        X.ball(5.5, 7, 3.6, 4.4, '#3a4a40', 'metal', { rz: 3 });
        X.ball(5.5, 7.2, 2.2, 3, '#80e8d0', 'glass', { z: 1.6, rz: 2, glow: '#80e8d0', glowK: 0.7 });
        X.ball(5.5, 2.2, 1.6, 1.2, '#3a4a40', 'metal', { z: 1, rz: 1 });
        X.ball(5.5, 11.6, 2.4, 1, '#3a4a40', 'metal', { z: 1, rz: 1 });
      },
      glow(P) {
        glow(P, 5.5, 7, 3, '#c8fff0', 0.6);
      },
    },
  },
});

const HOLLOW_KING = figure({
  stance: { h: 1.04, w: 1.12 },
  legs: { col: '#3a4048', mat: 'mail', r: 4.4, greave: '#5a6068', thigh: '#4a5058', boot: '#2a3038', bootMat: 'metal' },
  torso: { col: '#2a2a32', mat: 'cloth', build: 'gaunt' },
  plate: { col: '#5a6068', skirt: '#3a4048', skirtMat: 'mail', trim: '#a0b8c8' },
  belt: { col: '#2a2a32', buckle: '#a0b8c8' },
  pauldronF: { col: '#5a6068', r: 5.8, spikes: 1, spikeLen: 3, trim: '#a0b8c8' },
  head: {
    kind: 'helm', r: 5.4, col: '#5a6068', cy: 14,
    extra(X, c, r) {
      // A crest of pale plumes, and nothing inside the helm but the dark.
      X.in(HG.head, 1);
      const pts = [];
      for (let i = 0; i <= 5; i++) {
        const a = -2.2 + (i / 5) * 2.4;
        pts.push([c.x + 1 + Math.cos(a) * r * 1.2, c.y - 0.6 + Math.sin(a) * r * 1.25, r * (0.2 + Math.sin((i / 5) * Math.PI) * 0.2), 19]);
      }
      X.limb(pts, '#a0b8c8', 'feather');
      X.limb([[c.x + r * 1.2, c.y - r * 0.1, r * 0.3, 18], [c.x + r * 1.9, c.y + r * 1.6, r * 0.12, 17]], '#8098a8', 'feather');
    },
    paint(P, c, r) {
      P.rect(Math.round(c.x - r), Math.round(c.y - 1), Math.round(r * 1.1), 3, '#08080e');
    },
    glow(P, c, r) {
      for (const x of [c.x - r * 0.75, c.x - r * 0.15]) {
        P.fx(Math.round(x), Math.round(c.y), '#ffffff', 1);
        glow(P, x, c.y, 2.2, '#e0f0ff', 0.5);
      }
    },
  },
  cape: { col: '#2a3040', mat: 'velvet', ragged: true, w: 30, h: 42, clasp: '#a0b8c8' },
  arm: { col: '#2a2a32', r: 3.6, gauntlet: '#5a6068', L1: 8.8, L2: 8.4, wang: 0.95, pauldron: { col: '#5a6068', r: 6, spikes: 1, spikeLen: 3, trim: '#a0b8c8' } },
  weapon: {
    kind: 'greatsword', len: 31, width: 2.8, col: '#a0b0c0', guard: '#5a6068', guardMat: 'metal', pommel: '#e0f0ff', grip: '#2a2a32', gripMat: 'leather',
    glow(P, { H, wang }) {
      for (let i = 0; i < 4; i++) {
        const a = along(H, wang, 9 + i * 5);
        P.fx(a.x, a.y, '#e0f0ff', 0.7);
      }
    },
  },
  fist: { col: '#5a6068', r: 2.8 },
  armF: { col: '#2a2a32', r: 3.4, gauntlet: '#5a6068' },
  fx(R, ctx, pose) {
    const t = R.r.time;
    inPose(R, ctx, pose, () => {
      // Mist leaking from the joints of the armour, there being nothing in
      // it.
      const J = R.J;
      for (const [x, y, i] of [[J.shF.x, J.shF.y + 2, 0], [J.shN.x, J.shN.y + 2, 1], [J.waist.x - 6, J.waist.y, 2], [J.knF.x, J.knF.y, 3], [J.waist.x + 6, J.pelvis.y + 4, 4]]) {
        smoke(ctx, R.ox + x, R.oy + y, t + i * 0.3, { n: 2, rise: 7, col: '#d0e0e8', dark: '#a0b0c0', a: 0.4, r0: 0.6, grow: 1.6 });
      }
      const n = onHead(R, -2, 4);
      smoke(ctx, n.x, n.y, t, { n: 3, rise: 10, col: '#e0f0ff', dark: '#a0b8c8', a: 0.35, r0: 0.8, grow: 2 });
    });
  },
});

forge({
  // ------------------------------------------------------------ the Mire
  // The Bog King: king of the drowned hall in the mire, risen out of it in
  // his rotted mail and plate, slime and moss hanging off him, his crown of
  // tarnished gold, his eyes yellow as marsh-lights; his mace caked in mud;
  // mud dripping off him, flies round him.
  bog_king: figure({
    stance: { h: 1.02, w: 1.14, hunch: 1 },
    legs: { col: '#2e2418', mat: 'mail', r: 4.6, greave: '#4a4a30', thigh: '#3a3626', boot: '#1e1810' },
    torso: { col: '#5a4a34', mat: 'mail', build: 'muscle' },
    plate: { col: '#4a4a30', skirt: '#3a3020', skirtMat: 'cloth', trim: '#8a7020', emblem: '#e0c870', emblemMat: 'glass' },
    belt: { col: '#2a2014', buckle: '#8a7020' },
    pauldronF: { col: '#4a4a30', r: 5.8, trim: '#8a7020' },
    head: {
      kind: 'man', r: 5.4, col: '#7a6a48', hair: '#2a1e12', hairStyle: 'long', beard: '#3a3a22', beardLong: true,
      crown: { col: '#8a7020', n: 4, tall: 3.8, gem: '#e0c870' },
      face: { eye: '#e0c870', white: '#f0e8a0' },
      glow(P, c, r) {
        eyes(P, eyesOf(c, r), '#f0e070');
      },
    },
    cape: { col: '#3a3020', mat: 'cloth', ragged: true, w: 30, h: 40, lining: '#4a5a2a' },
    arm: { col: '#7a6a48', r: 4, gauntlet: '#4a4a30', L1: 8.8, L2: 8.4, wang: 0.9, pauldron: { col: '#4a4a30', r: 6, trim: '#8a7020' } },
    weapon: { kind: 'mace', len: 14, col: '#5a5038', grip: '#3a2a1a' },
    fist: { col: '#4a4a30', r: 2.8 },
    armF: { col: '#7a6a48', r: 3.8, gauntlet: '#4a4a30' },
    sculpt(X, J) {
      // Moss and weed hanging off his plate and his belt.
      X.in(HG.front, 1);
      hanging(X, [[J.chest.x - 7, J.chest.y + 4], [J.chest.x - 3, J.chest.y + 6], [J.chest.x + 4, J.chest.y + 5], [J.waist.x - 6, J.waist.y + 3], [J.waist.x + 2, J.waist.y + 3], [J.waist.x + 7, J.waist.y + 2]], 6, ['#4a5a2a', '#5a6a32', '#3a4a22'], 18);
    },
    paint(P) {
      // Mud on him, thicker the lower it goes.
      P.over((x, y, c) => (c[3] && y > 40 && hash2(x, y, 13) < (y - 40) / 40 ? mix(c, [74, 58, 36], 0.55) : null));
    },
    fx(R, ctx, pose) {
      const t = R.r.time;
      inPose(R, ctx, pose, () => {
        drops(ctx, R.ox + 20, R.oy + 42, t, [0, 6, 13, 19, 24], { col: '#5a4a30', len: 16, speed: 0.6 });
        // Flies round his head.
        const h = onHead(R, 0, -2);
        for (let i = 0; i < 4; i++) {
          const a = t * (5 + i) + i * 1.7;
          dot(ctx, h.x + Math.cos(a) * (6 + i), h.y + Math.sin(a * 1.3) * 4, '#1a1a10', 0.9);
        }
      });
    },
  }),

  // The Moth-Mother: a moth as big as a cart, furred and soft, her body
  // hung on four great wings of dusk-violet, each beating on its own hinge,
  // an eye on each forewing; they open wide and glow as she fixes you with
  // them. Plumed feelers, dangling legs, scales falling off her like dust.
  moth_mother: {
    size: 64, ay: 62, breath: 1.4,
    body(X, J, t) {
      const fur = '#6a5a7a';
      const bob = Math.sin(t * TAU) * 1.4;
      X.in(0, 3);
      // Her abdomen, banded, long; her thorax, thick with fur; her head.
      X.limb([[34, 30 + bob, 6.4, 2], [42, 33 + bob, 5.8, 2], [50, 38 + bob, 4, 2], [54, 42 + bob, 2, 2]], '#4a3a5a', 'fur');
      X.ball(28, 29 + bob, 8.4, 7.4, fur, 'fur', { rz: 7 });
      X.ball(25, 34 + bob, 6, 4, '#8a7a9a', 'fur', { rz: 3, z: 2 });
      X.ball(19, 27 + bob, 5.4, 5, fur, 'fur', { rz: 4.6, z: 3 });
      // Her eyes, great and dark, faceted.
      X.ball(16, 26 + bob, 2.8, 3, '#1a1028', 'glass', { z: 6, rz: 2.4 });
      X.in(1, 1);
      // Plumed feelers.
      for (const [dx, ph] of [[0, 0], [2.5, 1]]) {
        const sw = Math.sin(t * TAU + ph) * 1.5;
        X.limb([[17 + dx, 22 + bob, 0.7, 5], [13 + dx + sw, 15 + bob, 0.6, 5], [10 + dx + sw * 1.5, 9 + bob, 0.4, 5]], '#c8b8a0', 'feather');
        for (let k = 0; k < 5; k++) {
          const y = 17 + bob - k * 1.4;
          const x = 13.5 + dx + sw - k * 0.8;
          X.tube(x, y, x - 2.4, y - 1, 0.4, 0.2, '#c8b8a0', 'feather', { z: 5 });
          X.tube(x, y, x + 1.6, y - 2, 0.4, 0.2, '#b8a890', 'feather', { z: 5 });
        }
      }
      // Legs, dangling, furred at the top.
      X.in(2, 1);
      for (let i = 0; i < 3; i++) X.limb([[24 + i * 4, 35 + bob, 1, 6], [22 + i * 4, 42 + bob, 0.8, 6], [23 + i * 4 + Math.sin(t * TAU + i), 48 + bob, 0.5, 6]], '#3a2e48', 'chitin');
    },
    paint(P, J, t) {
      const bob = Math.sin(t * TAU) * 1.4;
      // Bands down the abdomen; a ruff of pale fur at her neck.
      P.over((x, y, c) => (c[3] && x > 35 && (x - 35) % 4 === 0 && Math.abs(y - (33 + bob + (x - 37) * 0.45)) < 6 ? shade(c, 0.6) : null));
      for (let i = 0; i < 6; i++) P.set(22 + i, Math.round(23 + bob + Math.abs(i - 2.5)), hex('#c8b8d8'));
    },
    glow(P, J, t, st) {
      const bob = Math.round(Math.sin(t * TAU) * 1.4);
      P.fx(15, 25 + bob, st.eyes ? '#ffe070' : '#c8a0ff', 0.9);
      P.fx(16, 27 + bob, st.eyes ? '#ffe070' : '#c8a0ff', 0.6);
    },
    parts: Object.fromEntries([['F', 0], ['N', 1]].flatMap(([s, near]) => [
      [`hind${s}`, {
        w: Math.ceil(24 * MK), h: Math.ceil(22 * MK), px: 20 * MK, py: 3 * MK, role: 'wing', layer: near ? 'front' : 'back', z: near ? 2 : -2, a0: near ? 0.15 : 0.3, depth: 0.35, rate: 2.2, squash: 1.2, lift: 0.4, phase: near ? 0.5 : 1.1,
        at: (J) => [near ? 29 : 32, 31 + Math.sin(J.t * TAU) * 1.4],
        variant: (R) => (R.st.eyes ? 'eyes' : ''),
        body(X) {
          const c = near ? '#7a4a7a' : '#4a3a5a';
          X.in(0, 1);
          X.slab(mk([[20, 3], [14, 1], [8, 3], [3, 8], [2, 14], [5, 19], [10, 20], [15, 17], [19, 10]]), c, 'velvet', { rz: 1.6, bevel: 2.4 });
          X.ball(18 * MK, 5 * MK, 3 * MK, 2.4 * MK, '#8a7a9a', 'fur', { z: 1.4, rz: 1 });
        },
        paint(P, v) {
          mothMarks(P, [20 * MK, 3 * MK], mk([[8, 3], [3, 8], [2, 14], [5, 19], [10, 20], [15, 17]]), [8 * MK, 13 * MK, 2.6 * MK], hex(near ? '#7a4a7a' : '#4a3a5a'), v === 'eyes');
        },
      }],
      [`fore${s}`, {
        w: Math.ceil(34 * MK), h: Math.ceil(30 * MK), px: 30 * MK, py: 27 * MK, role: 'wing', layer: near ? 'front' : 'back', z: near ? 3 : -1, a0: near ? -0.1 : 0.05, depth: 0.4, rate: 2.2, squash: 1.3, lift: 0.4, phase: near ? 0 : 0.6,
        at: (J) => [near ? 27 : 30, 29 + Math.sin(J.t * TAU) * 1.4],
        variant: (R) => (R.st.eyes ? 'eyes' : ''),
        body(X) {
          const c = near ? '#6a4a8a' : '#4a3a6a';
          X.in(0, 1);
          X.slab(mk([[30, 27], [27, 21], [21, 13], [13, 6], [5, 2], [1, 2], [1, 6], [3, 12], [8, 18], [15, 23], [23, 27]]), c, 'velvet', { rz: 1.6, bevel: 2.6 });
          X.ball(27 * MK, 24 * MK, 4 * MK, 3 * MK, '#8a7a9a', 'fur', { z: 1.6, rz: 1 });
        },
        paint(P, v) {
          mothMarks(P, [30 * MK, 27 * MK], mk([[1, 2], [1, 6], [3, 12], [8, 18], [15, 23], [23, 27]]), [12 * MK, 11 * MK, 4.6 * MK], hex(near ? '#6a4a8a' : '#4a3a6a'), v === 'eyes');
        },
      }],
    ])),
    fx(R, ctx, pose) {
      const t = R.r.time;
      inPose(R, ctx, pose, () => {
        // Dust of her wings sifting down, glittering.
        for (let i = 0; i < 8; i++) {
          const k = (t * 0.4 + i / 8) % 1;
          dot(ctx, R.ox + 14 + ((i * 0.618) % 1) * 36 + Math.sin(k * 6 + i) * 3, R.oy + 34 + k * 26, k < 0.3 ? '#ffffff' : '#d8c8f0', 0.8 * (1 - k));
        }
        if (R.st.eyes) {
          for (const [x, y] of [[14, 12], [42, 12]]) glowAt(ctx, R.ox + x, R.oy + y, 5, '#ffe070', 0.35);
        }
        // Her shadow on the floor, as she hangs over it.
        ctx.globalAlpha = 0.25;
        ctx.fillStyle = '#000000';
        ctx.fillRect(Math.round(R.x - 12), Math.round(R.y - 1), 24, 2);
        ctx.globalAlpha = 1;
      });
    },
  },

  // The Willow Wight: a drowned girl the willows took in, her skin gone to
  // grey-green bark, her hair weed, a wreath of willow on it; her rags; moss
  // hanging from her arms like a willow's fronds, swaying; and tears that
  // shine running down her face.
  willow_wight: figure({
    stance: { h: 1.02, w: 0.94, hunch: 1 },
    robe: { col: '#3a3228', ragged: true, trim: '#5a7a4a', trimMat: 'moss', flare: 1.1 },
    torso: { col: '#3a3228', mat: 'cloth', build: 'gaunt' },
    head: {
      kind: 'man', r: 5, col: '#9aa88a', mat: 'bark', hair: '#5a7a4a', hairStyle: 'wild', face: { eye: '#c8f0a0', white: '#e8ffd0', mouth: 2 },
      extra(X, c, r) {
        // A wreath of willow leaves round her brow.
        X.in(HG.head, 1);
        for (let i = 0; i < 9; i++) {
          const a = Math.PI + (i / 8) * Math.PI;
          X.ball(c.x + 0.6 + Math.cos(a) * r * 1.05, c.y - r * 0.55 + Math.sin(a) * r * 0.35, 1.3, 0.8, i % 2 ? '#5a8a3a' : '#3a6a2a', 'moss', { z: 19, rz: 0.8 });
        }
      },
      glow(P, c, r) {
        eyes(P, eyesOf(c, r), '#c8f0a0');
      },
    },
    arm: {
      col: '#9aa88a', mat: 'bark', r: 2.7, L1: 8.8, L2: 8.4, wang: 0.4, claw: '#c8d0a0',
      extra(X, { E, H }) {
        X.in(5, 1);
        hanging(X, [[E.x, E.y + 1], [E.x + 1.5, E.y + 4], [H.x, H.y + 1], [H.x - 1, H.y]], 9, ['#5a8a4a', '#8ab070', '#4a7a3a'], 8);
      },
    },
    armF: {
      col: '#9aa88a', mat: 'bark', r: 2.7, claw: '#c8d0a0',
      extra(X, { E, H }) {
        X.in(5, 1);
        hanging(X, [[E.x, E.y + 1], [H.x, H.y + 1]], 8, ['#4a6a3a', '#6a8a50'], 8);
      },
    },
    sculpt(X, J) {
      X.in(HG.front, 1);
      hanging(X, [[J.chest.x - 6, J.chest.y], [J.chest.x + 4, J.chest.y + 1]], 7, ['#5a8a4a', '#3a6a2a'], 18);
    },
    fx(R, ctx, pose) {
      const t = R.r.time;
      inPose(R, ctx, pose, () => {
        // Her tears.
        const k = (t * 0.8) % 1;
        const e = onHead(R, -3.5, 0.5 + k * 6);
        dot(ctx, e.x, e.y, '#a0e8ff', 1 - k * 0.6);
        // Water dripping off her, rings where it falls.
        drops(ctx, R.ox + 22, R.oy + 40, t, [0, 9, 17], { col: '#a0d8e8', len: 20, speed: 0.5 });
      });
    },
  }),

  // The Spore Colossus: a giant of the fungus that eats the cuttings — a
  // great spotted cap over a pale fibrous stalk of a body, gills under it
  // shedding spores, a face sunk in the stalk; arms and a skirt of roots;
  // its cap claps down as it coughs its spores at you.
  spore_colossus: {
    size: 64, ay: 62,
    body(X, J, t) {
      X.in(0, 3);
      // The skirt of roots it walks on.
      for (let i = 0; i < 7; i++) {
        const x = 18 + i * 4.6;
        X.limb([[32 + (i - 3) * 2, 50, 2.6, 1], [x, 57, 2, 1], [x + (i - 3) * 1.4, 62, 1.2, 1]], i % 2 ? '#8a7060' : '#7a6050', 'bark');
      }
      // The stalk, fibrous, swelling to its shoulders.
      X.ball(32, 44 - J.b * 0.3, 11, 12, '#d8ccc0', 'fungus', { rz: 10 });
      X.ball(32, 32 - J.b * 0.5, 9.4, 7, '#e0d4c8', 'fungus', { rz: 8, z: 1 });
      // A ring round its neck, torn.
      X.ball(32, 28 - J.b * 0.5, 10.6, 2, '#c8b8a8', 'fungus', { rz: 1.4, z: 4 });
    },
    paint(P, J) {
      const b = Math.round(J.b * 0.5);
      // The fibres down it; its face, sunk in it.
      for (let x = 22; x < 43; x += 2) for (let y = 32; y < 56; y++) {
        const q = P.get(x, y);
        if (q[3] && q[0] > 170) P.set(x, y, shade(q, 0.86));
      }
      for (const x of [27, 35]) P.rect(x, 35 - b, 3, 3, '#3a2a28');
      for (let x = 28; x < 36; x++) P.set(x, 41 - b + (x % 2), hex('#3a2a28'));
    },
    glow(P, J) {
      const b = Math.round(J.b * 0.5);
      eyes(P, [[28, 36 - b], [36, 36 - b]], '#e8ff80');
    },
    parts: {
      armF: {
        w: 22, h: 28, px: 6, py: 4, role: 'offhand', layer: 'back', z: -2, amp: 0.8,
        at: [42, 32],
        body(X) {
          X.in(0, 1.4);
          X.limb([[6, 4, 3.2, 1], [12, 12, 2.6, 2], [14, 21, 2, 2], [12, 26, 1.2, 2]], '#6a5040', 'bark');
          X.limb([[14, 21, 1.2, 3], [18, 25, 0.6, 3]], '#6a5040', 'bark');
        },
      },
      armN: {
        w: 24, h: 30, px: 18, py: 4, role: 'weapon', layer: 'front', z: 3, amp: 0.8,
        at: [23, 32],
        body(X) {
          X.in(0, 1.4);
          X.limb([[18, 4, 3.4, 1], [11, 12, 2.8, 2], [7, 22, 2.2, 2], [5, 27, 1.2, 2]], '#8a7060', 'bark');
          X.limb([[7, 22, 1.4, 3], [2, 25, 0.7, 3]], '#8a7060', 'bark');
          X.limb([[8, 23, 1.2, 3], [10, 28, 0.6, 3]], '#8a7060', 'bark');
        },
      },
      // The cap: clapping down as it coughs, thrown back as it roars.
      cap: {
        w: 60, h: 28, px: 30, py: 22, role: 'head', layer: 'front', z: 5, amp: 1.2,
        at: (J) => [32, 27 - J.b * 0.5],
        extra: (R) => (R.st.wind ? Math.sin(R.t * 18) * 0.06 : 0),
        body(X) {
          X.in(0, 2.5);
          X.ball(30, 21, 25, 4.4, '#c8a8a0', 'fungus', { rz: 3 });
          X.ball(30, 13, 27, 11, '#6a3a5a', 'fungus', { rz: 12, z: 3 });
        },
        paint(P) {
          for (let i = 0; i < 11; i++) {
            const x = 8 + hash2(i, 1, 5) * 44;
            const y = 6 + hash2(i, 2, 5) * 10;
            P.blob(x, y, 1.8 + hash2(i, 3, 5) * 1.6, 1.3 + hash2(i, 3, 5), '#f0e0c8', { lift: 0.3 });
          }
          for (let x = 7; x < 54; x += 2) P.set(x, 22, hex('#8a6060'));
        },
      },
    },
    fx(R, ctx, pose) {
      const t = R.r.time;
      const cough = R.st.wind;
      inPose(R, ctx, pose, () => {
        // Spores sifting down out of its gills; a cloud of them as it coughs.
        const n = cough ? 22 : 9;
        for (let i = 0; i < n; i++) {
          const k = (t * (cough ? 0.9 : 0.35) + i / n) % 1;
          const x = R.ox + 8 + hash2(i, 4, 5) * 48 + Math.sin(k * 6 + i) * 2 - (cough ? k * 14 : 0);
          dot(ctx, x, R.oy + 28 + k * 32, i % 2 ? '#e8e0a0' : '#c0d880', 0.85 * (1 - k));
        }
      });
    },
  },

  // The Lamprey Queen: a lamprey grown huge, up out of the black water of
  // the flooded cuttings: slick grey-green and mottled, gills in a row
  // behind her head, and her mouth a round sucker all rings of hooked teeth,
  // gaping as she strikes; the long rest of her strung out through the
  // water behind. Under it, only her back-fin cutting along.
  lamprey_queen: {
    size: 64, ay: 60,
    body(X, J, t, st) {
      // The water broken where she comes up out of it.
      X.in(0, 1);
      if (st.under) return;
      X.ball(32, 57, 13, 3, '#2a4a5a', 'glass', { rz: 1 });
      X.ball(32, 56.5, 9, 2, '#4a6a5a', 'slime', { rz: 1.5, z: 2 });
    },
    paint(P, J, t, st) {
      if (st.under) return;
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * TAU + t * TAU;
        P.set(Math.round(32 + Math.cos(a) * 12), Math.round(57 + Math.sin(a) * 2.6), hex('#c8e0e8'));
      }
    },
    parts: {
      neck: {
        w: 28, h: 40, px: 18, py: 37, role: 'head', layer: 'front', z: 2, amp: 2.2, phase: 0.4, show: (R) => !R.st.under,
        at: [32, 56],
        body(X) {
          const skin = '#4a5a48';
          X.in(0, 2);
          X.limb([[18, 38, 6, 2], [18, 28, 6, 4], [14, 18, 5.6, 6], [9, 10, 5.4, 7]], skin, 'slime');
          X.limb([[13, 36, 3, 8], [13, 27, 3, 9], [10, 18, 2.6, 10]], '#9aa888', 'slime');
          // A fin along her back.
          X.limb([[22, 34, 1.2, 1], [23, 24, 1.4, 1], [19, 14, 1, 1]], '#3a4a38', 'slime');
        },
        paint(P) {
          for (let y = 14; y < 38; y += 3) for (let x = 14; x < 24; x++) {
            const q = P.get(x, y);
            if (q[3] && hash2(x, y, 7) > 0.7) P.set(x, y, shade(q, 0.65));
          }
        },
      },
      head: {
        w: 22, h: 22, px: 14, py: 14, role: 'head', layer: 'front', parent: 'neck', at: [9, 10], z: 3, amp: 1.2, show: (R) => !R.st.under,
        variant: (R) => (R.st.wind ? 'gape' : ''),
        body(X, v) {
          const skin = '#4a5a48';
          const g = v === 'gape' ? 1.2 : 1;
          X.in(0, 2);
          X.ball(11, 10, 7, 7.4, skin, 'slime', { rz: 6 });
          X.in(1, 0.5);
          // The sucker: a round mouth of red flesh facing you.
          X.ball(5, 10, 4.4 * g, 5.4 * g, '#8a4a48', 'flesh', { rz: 1.6, z: 9 });
        },
        paint(P, v) {
          const g = v === 'gape' ? 1.2 : 1;
          const r = 4.4 * g;
          P.blob(5, 10, r * 0.5, r * 0.62, '#1a0a0a', { amb: 0 });
          for (let k = 0; k < 2; k++) for (let i = 0; i < 12; i++) {
            const a = (i / 12) * TAU + k * 0.26;
            P.set(Math.round(5 + Math.cos(a) * r * (0.82 - k * 0.3)), Math.round(10 + Math.sin(a) * r * 1.2 * (0.82 - k * 0.3)), hex('#f0e8d0'));
          }
          // Her gills, a row of slits behind.
          for (let i = 0; i < 5; i++) P.rect(13 + i * 1.6, 12 + i * 0.8, 1, 2, '#1a2018');
        },
        glow(P) {
          eyes(P, [[11, 6]], '#e0f070');
        },
      },
    },
    under(R) {
      if (R.st.under) lampreyUnder(R);
      else beastSerpent(R, lampreyCfg, false);
    },
    over(R) {
      if (!R.st.under) beastSerpent(R, lampreyCfg, true);
    },
  },

  // The Bloat: a sac of marsh-gas, floating, veined and pocked with
  // blisters, swelling and settling as it breathes, its little pinched face
  // in the middle of it; feelers trailing under it; gas leaking from it.
  gas_bloat: {
    size: 64, ay: 62, breath: 1.6,
    body(X, J) {
      const sw = J.b;
      X.in(0, 4);
      X.ball(32, 26, 20 + sw, 18 + sw, '#7a8a50', 'slime', { rz: 17 });
      X.ball(23, 17, 7, 6, '#8a9a5a', 'slime', { rz: 5, z: 12 });
      X.ball(42, 32, 6, 5, '#8a9a5a', 'slime', { rz: 5, z: 12 });
      X.ball(16, 32, 4, 4, '#6a7a44', 'slime', { rz: 3, z: 11 });
      X.ball(32, 44, 6, 3, '#5a6a3a', 'flesh', { rz: 3, z: 6 });
    },
    paint(P) {
      for (const pts of [[[17, 20], [23, 26], [21, 35]], [[40, 14], [38, 22], [44, 28]], [[32, 9], [32, 18]], [[46, 20], [50, 28]]]) for (let i = 0; i + 1 < pts.length; i++) P.line(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], '#4a3a2a');
      for (const [x, y] of [[21, 30], [40, 20], [46, 34], [27, 38], [36, 10]]) P.blob(x, y, 1.4, 1.2, '#c8d070', { lift: 0.3 });
      // The little pinched face.
      P.blob(32, 28, 3.6, 2.8, '#4a4a2a', { amb: 0.4 });
      P.line(31, 31, 33, 31, '#2a1a10');
    },
    glow(P) {
      P.fx(30, 27, '#ffe070', 1);
      P.fx(34, 27, '#ffe070', 1);
    },
    behind(R) {
      bloatFeelers(R);
    },
    fx(R, ctx, pose) {
      const t = R.r.time;
      inPose(R, ctx, pose, () => {
        smoke(ctx, R.ox + 26, R.oy + 9, t, { n: 4, rise: 12, col: '#b0c070', dark: '#8a9a50', a: 0.4, drift: -4 });
        smoke(ctx, R.ox + 42, R.oy + 14, t + 0.4, { n: 3, rise: 10, col: '#b0c070', dark: '#8a9a50', a: 0.35, drift: 4 });
        ctx.globalAlpha = 0.25;
        ctx.fillStyle = '#000000';
        ctx.fillRect(Math.round(R.x - 10), Math.round(R.y - 1), 20, 2);
        ctx.globalAlpha = 1;
      });
    },
  },

  // The Lantern Lord: keeper of the marsh-lights, pale as a corpse-candle,
  // long white hair under a toadstool cap; robes the green-black of deep
  // water edged in the lights' own glow; his crook, his lantern swinging
  // from it, its light cold; mist at his feet.
  lantern_lord: {
    ...LANTERN_LORD,
    front(R) {
      // His lantern, swinging on its chain from the crook.
      const top = onBlade(R, 31.5, -5.5);
      const s = R.e.rig;
      s.lamp ||= { a: 0.2, v: 0 };
      const p = s.lamp;
      const dt = Math.min(R.dt || 1 / 60, 1 / 30);
      p.v += (-Math.sin(p.a) * 26 - p.v * 1.2 + Math.sin(R.t * 1.7) * 3 - R.drift * 28) * dt;
      p.a += p.v * dt;
      const lx = top.x + Math.sin(p.a) * 5;
      const ly = top.y + Math.cos(p.a) * 5;
      drawChain(R.ctx, [{ x: top.x, y: top.y }, { x: lx, y: ly }], '#8a8a7a');
      forgePart(R.e.species, 'lantern').draw(R.ctx, lx, ly, -p.a * 0.5);
      s.lampAt = { x: lx, y: ly + 7 };
    },
    fx(R, ctx, pose) {
      const t = R.r.time;
      inPose(R, ctx, pose, () => {
        const L = R.e.rig.lampAt;
        if (L) glowAt(ctx, L.x, L.y, 9, '#80e8d0', 0.3 + 0.1 * Math.sin(t * 5));
        // Mist at his feet.
        for (let i = 0; i < 6; i++) {
          const k = (t * 0.25 + i / 6) % 1;
          puff(ctx, R.ox + 8 + i * 9 + k * 4, R.oy + 59 - k * 3, 3, '#c0d8d0', 0.3 * Math.sin(k * Math.PI));
        }
      });
    },
  },

  // The Hollow King: a king's armour with no king in it, walking: plate of
  // a cold blue-grey, crested in pale plumes, a ragged cape of night blue,
  // the dark in his helm and two cold lights in it; mist leaking from every
  // joint of it; his greatsword.
  hollow_king: HOLLOW_KING,

  // The Drowned Choir: three singers drowned together and grown into one,
  // up to their waists in black water: grey-blue skin, hair streaming wet,
  // pale eyes; they sway as one, and when they sing their mouths glow and
  // the notes rise off them.
  drowned_choir: {
    size: 64, ay: 61,
    body(X, J, t) {
      X.in(0, 2);
      // The black water they stand in.
      X.ball(32, 56, 30, 5, '#1e3a4a', 'glass', { rz: 2 });
      X.in(1, 2.4);
      // Their bodies, shrouded in rotted grey, rising out of it close
      // together; the outer two reaching out, the middle one's hands
      // crossed on her breast.
      for (const [cx, h, ph, i] of [[15, 2, 0, 0], [49, 2, 2.4, 2], [32, -4, 1.2, 1]]) {
        const sway = Math.sin(t * TAU + ph) * 0.8;
        X.ball(cx, 47 + h, 8.4, 10, '#2e3e44', 'cloth', { rz: 7, z: i === 1 ? 2 : 0 });
        X.ball(cx + sway * 0.3, 38 + h, 7, 4.4, '#3a4a50', 'cloth', { rz: 4, z: 1 + (i === 1 ? 2 : 0) });
        X.tube(cx + sway * 0.3, 35 + h, cx + sway, 31 + h, 2.2, 2, '#8a9aa0', 'skin', { z: 3 + (i === 1 ? 2 : 0) });
        if (i === 1) X.limb([[cx - 5, 39 + h, 1.6, 6], [cx, 43 + h, 1.4, 7], [cx + 4, 40 + h, 1.2, 7]], '#7a8a90', 'skin');
        else {
          const s = i ? 1 : -1;
          const lift = Math.sin(t * TAU + ph) * 1.5;
          X.limb([[cx + s * 5, 37 + h, 1.7, 2], [cx + s * 9, 32 + h - lift, 1.3, 2], [cx + s * 11, 26 + h - lift * 1.5, 1, 2]], '#7a8a90', 'skin');
        }
        // Weed hanging off their shrouds.
        hanging(X, [[cx - 4, 40 + h], [cx + 3, 41 + h]], 6, ['#3a5a3a', '#2a4a3a'], 4 + (i === 1 ? 2 : 0));
      }
    },
    paint(P) {
      for (let x = 3; x < 62; x += 3) P.set(x, 53 + (x % 2), hex('#5a8a9a'));
      // The tatters of their shrouds, darker in their folds.
      P.over((x, y, c) => (c[3] && y > 36 && y < 54 && c[2] < 90 && (x + Math.round(y * 0.3)) % 4 === 0 ? shade(c, 0.7) : null));
    },
    parts: Object.fromEntries([[15, 2, 0], [32, -4, 1.2], [49, 2, 2.4]].map(([cx, h, ph], i) => [`head${i}`, {
      w: 24, h: 30, px: 12, py: 20, role: 'head', layer: 'front', z: 2 + (i === 1 ? 1 : 0), amp: 1.4, phase: ph,
      at: (J) => [cx + Math.sin(J.t * TAU + ph), 31 + h],
      variant: (R) => (R.st.song ? 'sing' : ''),
      body(X) {
        X.in(0, 1.5);
        // Hair, long and streaming wet, down her back; her face; the wet
        // hair plastered over her crown and falling past her cheek.
        X.limb([[13, 8, 5.4, 0], [16, 17, 4.6, -1], [17, 27, 3, -2]], '#1a2a2a', 'hair');
        X.ball(11, 12, 5.4, 6, '#8a9aa0', 'skin', { rz: 5, z: 2 });
        X.ball(9.5, 15.5, 3.6, 3, '#8a9aa0', 'skin', { rz: 2.4, z: 2.6 });
        X.ball(13, 8, 5.6, 3.6, '#1a2a2a', 'hair', { rz: 2.4, z: 4 });
        X.limb([[14, 10, 2, 4], [15, 16, 1.6, 4], [14, 22, 0.8, 4]], '#223434', 'hair');
      },
      paint(P, v) {
        // Hollow eyes with a pale light in them; the mouth open in song.
        for (const x of [7, 11]) {
          P.rect(x - 1, 11, 2, 2, '#2a3a40');
          P.set(x, 12, hex('#c8f0ff'));
        }
        P.set(5, 14, hex('#6a7a80'));
        if (v === 'sing') P.blob(8.5, 17, 1.2, 1.8, '#a0f0ff', { lift: 0.6 });
        else P.rect(7, 17, 3, 1, '#1a1418');
        strands(P);
      },
      glow(P, v) {
        if (v === 'sing') glow(P, 8.5, 17, 2.6, '#a0f0ff', 0.6);
      },
    }])),
    fx(R, ctx, pose) {
      const t = R.r.time;
      inPose(R, ctx, pose, () => {
        // Ripples on the water round them; the notes rising as they sing.
        for (let i = 0; i < 5; i++) {
          const k = (t * 0.5 + i / 5) % 1;
          dot(ctx, R.ox + 4 + ((i * 17) % 56) + k * 4, R.oy + 56, '#a0d0e0', 0.5 * (1 - k), 2, 1);
        }
        if (R.st.song) for (let i = 0; i < 9; i++) {
          const k = (t + i / 9) % 1;
          const x = R.ox + 16 + (i % 3) * 16 + Math.sin(k * 6 + i) * 3;
          const y = R.oy + 22 - k * 22;
          dot(ctx, x, y, '#a0f0ff', 1 - k, 2, 1);
          dot(ctx, x + 1, y - 2, '#a0f0ff', 1 - k, 1, 2);
        }
      });
    },
  },

  // ------------------------------------------------------------ the wrecks
  // Sharktooth: the smugglers' captain, a big man gone to salt, in a coat
  // of faded sea-blue, a tricorn with its braid; long hair and a beard
  // like old rope; a necklace of sharks' teeth; his harpoon, barbed.
  sharktooth: figure({
    stance: { h: 1.02, w: 1.12 },
    legs: { col: '#3a3020', mat: 'leather', r: 4.4, boot: '#2a2014', bootMat: 'leather' },
    torso: { col: '#1e3a4a', mat: 'cloth', build: 'muscle' },
    belt: { col: '#3a2a1a', buckle: '#d8b040' },
    sculpt(X, J) {
      // The coat's skirts; the sharks' teeth at his throat.
      X.in(HG.skirt, 1);
      X.slab([[J.waist.x - 8, J.waist.y], [J.waist.x + 8, J.waist.y], [J.waist.x + 10, J.pelvis.y + 13], [J.waist.x - 10, J.pelvis.y + 13]], '#1e3a4a', 'cloth', { z: 8, rz: 2, bevel: 1.6 });
      X.in(HG.front, 1);
      for (let i = 0; i < 6; i++) X.tube(J.neck.x - 3.5 + i * 1.6, J.neck.y + 3 + Math.abs(i - 2.5) * 0.5, J.neck.x - 3.5 + i * 1.6, J.neck.y + 5.6 + Math.abs(i - 2.5) * 0.5, 0.7, 0.2, '#f0e8dc', 'bone', { z: 20 });
      // Brass buttons down his front.
      for (let i = 0; i < 4; i++) X.ball(J.chest.x - 3, J.chest.y - 2 + i * 3.4, 0.8, 0.8, '#d8b040', 'gold', { z: 19, rz: 0.6 });
    },
    head: {
      kind: 'man', r: 5.3, col: '#a87048', hair: '#3a2418', hairStyle: 'long', beard: '#4a2e1c', beardLong: true, face: { eye: '#2a2a20', scar: true, teeth: true },
      extra(X, c, r) {
        // His tricorn, braided.
        X.in(HG.head, 1);
        X.ball(c.x + r * 0.4, c.y - r * 0.85, r * 1.1, r * 0.55, '#3a3230', 'leather', { z: 19, rz: 2 });
        X.slab([[c.x - r * 1.5, c.y - r * 0.6], [c.x + r * 0.4, c.y - r * 0.95], [c.x + r * 2.1, c.y - r * 0.5], [c.x + r * 0.4, c.y - r * 0.25]], '#3a3230', 'leather', { z: 18.4, rz: 1.4, bevel: 1 });
        X.tube(c.x - r * 1.4, c.y - r * 0.6, c.x + r * 2, c.y - r * 0.5, r * 0.12, r * 0.12, '#d8c8a0', 'gold', { z: 20 });
      },
    },
    cape: { col: '#2a2420', mat: 'leather', w: 26, h: 30 },
    arm: { col: '#a87048', r: 3.8, sleeve: '#1e3a4a', L1: 8.8, L2: 8.4, wang: 0.5 },
    weapon: {
      kind: 'spear', len: 26, col: '#c8c8c0', grip: '#5a4a30',
      head(X, at, z) {
        X.slab([at(25, -1.8), at(25, 1.8), at(33, 0)], '#c8c8c0', 'metal', { z: z + 1, rz: 1.2, bevel: 0.8 });
        X.slab([at(26, -1.5), at(23, -4), at(28, -1.4)], '#c8c8c0', 'metal', { z: z + 1, rz: 0.8, bevel: 0.6 });
        X.slab([at(26, 1.5), at(23, 4), at(28, 1.4)], '#c8c8c0', 'metal', { z: z + 1, rz: 0.8, bevel: 0.6 });
      },
    },
    fist: { col: '#a87048', mat: 'skin', r: 2.6 },
    armF: { col: '#a87048', r: 3.6, sleeve: '#1e3a4a' },
    fx(R, ctx, pose) {
      if (!R.st.loot) return;
      const t = R.r.time;
      inPose(R, ctx, pose, () => {
        for (let i = 0; i < 3; i++) if ((Math.floor(t * 12) + i * 3) % 8 === 0) dot(ctx, R.ox + 26 + i * 3, R.oy + 38, '#ffe070', 1);
      });
    },
  }),

  // The Pearl Queen: queen of the pearl-divers' wreck, dark-skinned and
  // proud, her black hair long under a crown that is a great fanned shell;
  // a gown of pearl-white edged in sea-blue, ropes of pearls at her throat;
  // her sabre. Her shell shield shimmers round her like the inside of a
  // shell.
  pearl_queen: figure({
    stance: { h: 1.03, w: 0.98 },
    robe: { col: '#e8e0d4', mat: 'velvet', trim: '#80c8e8', trimMat: 'glass', front: '#d8d0c4', flare: 1.15 },
    torso: { col: '#e8e0d4', mat: 'velvet', build: 'lean' },
    belt: { col: '#80c8e8', buckle: '#f8f4ff' },
    sculpt(X, J) {
      X.in(HG.front, 1);
      for (let i = 0; i < 8; i++) X.ball(J.neck.x - 4 + i * 1.2, J.neck.y + 3 + Math.sin((i / 7) * Math.PI) * 2.5, 0.8, 0.8, '#f8f4ff', 'shell', { z: 20, rz: 0.8 });
      for (let i = 0; i < 6; i++) X.ball(J.neck.x - 3 + i * 1.2, J.neck.y + 5 + Math.sin((i / 5) * Math.PI) * 3, 0.7, 0.7, '#f0e8f8', 'shell', { z: 20, rz: 0.7 });
    },
    head: {
      kind: 'man', r: 5, col: '#a06a44', hair: '#1a1410', hairStyle: 'long', face: { eye: '#80c8e8', white: '#e8f8ff' },
      extra(X, c, r) {
        // Her crown: a fanned shell, its ribs.
        X.in(HG.head, 1);
        const pts = [];
        for (let i = 0; i <= 8; i++) {
          const a = Math.PI + 0.3 + (i / 8) * (Math.PI - 0.6);
          pts.push([c.x + 0.6 + Math.cos(a) * r * 1.3, c.y - r * 0.8 + Math.sin(a) * r * 1.2]);
        }
        X.slab([[c.x + 0.6, c.y - r * 0.55], ...pts], '#f0e8dc', 'shell', { z: 19, rz: 1.6, bevel: 1 });
        X.ball(c.x + 0.6, c.y - r * 0.7, 1.2, 1.2, '#f8f4ff', 'shell', { z: 21, rz: 1, glow: '#c0f0ff', glowK: 0.3 });
      },
      paint(P, c, r) {
        for (let i = 0; i < 5; i++) {
          const a = Math.PI + 0.5 + (i / 4) * (Math.PI - 1);
          for (let k = 0.3; k < 1; k += 0.15) {
            const x = Math.round(c.x + 0.6 + Math.cos(a) * r * 1.2 * k);
            const y = Math.round(c.y - r * 0.75 + Math.sin(a) * r * 1.1 * k);
            const q = P.get(x, y);
            if (q[3]) P.set(x, y, shade(q, 0.82));
          }
        }
      },
      glow(P, c, r) {
        eyes(P, eyesOf(c, r), '#80c8e8');
      },
    },
    arm: { col: '#a06a44', r: 3, sleeve: '#e8e0d4', sleeveMat: 'velvet', L1: 8.6, L2: 8, wang: 0.8 },
    weapon: { kind: 'sword', len: 20, width: 1.8, col: '#c8d8e0', guard: '#80c8e8', guardMat: 'glass', pommel: '#f8f4ff' },
    fist: { col: '#a06a44', mat: 'skin', r: 2.3 },
    armF: { col: '#a06a44', r: 3, sleeve: '#e8e0d4', sleeveMat: 'velvet' },
    fx(R, ctx, pose) {
      if (!R.st.shell) return;
      const t = R.r.time;
      inPose(R, ctx, pose, () => {
        // Her shield: a shell of light round her, shimmering.
        for (let i = 0; i < 64; i++) {
          const a = (i / 64) * TAU;
          const x = R.ox + 32 + Math.cos(a) * 21;
          const y = R.oy + 36 + Math.sin(a) * 26;
          const hue = Math.sin(a * 3 + t * 4) * 0.5 + 0.5;
          dot(ctx, x, y, hue > 0.5 ? '#f0d8ff' : '#d0f0ff', 0.8);
        }
        glowAt(ctx, R.ox + 32, R.oy + 36, 20, '#c0f0ff', 0.12);
        motes(ctx, R.ox + 32, R.oy + 36, t * 2, { n: 4, rx: 20, ry: 25, col: '#ffffff' });
      });
    },
  }),

  // The Smugglers' Kraken: a kraken off a smugglers' wreck, a great red
  // mantle, one eye (the other under a patch), a sea-chest spilling gold in
  // its grip; its eight arms curling and uncurling, suckers along them; ink
  // running from it.
  smugglers_kraken: {
    size: 64, ay: 62,
    body(X, J) {
      const red = '#a03a30';
      const b = J.b;
      X.in(0, 4);
      X.ball(38, 24 - b, 15, 18 + b * 0.4, red, 'flesh', { rz: 14, ang: 0.35 });
      X.ball(32, 40, 13, 9, red, 'flesh', { rz: 10, z: 2 });
      X.in(1, 1.5);
      // The sea-chest, banded, its lid sprung, gold spilling.
      X.slab([[10, 47], [30, 47], [29, 59], [11, 59]], '#6a4a2a', 'wood', { rz: 6, bevel: 2, z: 8 });
      X.slab([[10, 44], [30, 42], [30, 46], [10, 48]], '#5a3a20', 'wood', { rz: 4, bevel: 1.5, z: 10 });
      X.tube(10, 53, 30, 53, 1, 1, '#c8a040', 'gold', { z: 14 });
      for (let i = 0; i < 6; i++) X.ball(13 + i * 3, 45 + (i % 2), 1.6, 1.2, '#ffd050', 'gold', { z: 12 + (i % 2), rz: 1.2 });
    },
    paint(P, J) {
      const b = Math.round(J.b);
      // Its skin, mottled; the patch and its strap.
      P.over((x, y, c) => (c[3] && c[0] > 120 && c[1] < 90 && hash2(x >> 1, y >> 1, 3) > 0.8 ? shade(c, 0.75) : null));
      P.blob(36, 33 - b, 3, 2.4, '#1a1414', { amb: 0.3 });
      P.line(33, 28 - b, 44, 38 - b, '#1a1414');
    },
    glow(P, J, t, st) {
      const b = Math.round(J.b);
      eyes(P, [[28, 34 - b]], st.wind ? '#ffffff' : '#ffe060', { big: true });
    },
    behind(R) {
      krakenArms(R, false);
    },
    front(R) {
      krakenArms(R, true);
    },
    fx(R, ctx, pose) {
      const t = R.r.time;
      inPose(R, ctx, pose, () => {
        for (let i = 0; i < 4; i++) {
          const k = (t * 0.5 + i / 4) % 1;
          puff(ctx, R.ox + 46 + i * 4, R.oy + 52 + k * 8, 2 + k * 3, '#1a1420', 0.45 * (1 - k));
        }
        if (Math.floor(t * 12) % 3 === 0) dot(ctx, R.ox + 14 + (Math.floor(t * 12) % 12), R.oy + 44, '#ffffff', 1);
      });
    },
  },

  // The Tide Mother: a sea-turtle as old as the reef, her domed shell grown
  // over with coral and weed and barnacles, plated; her beaked head swaying
  // on her old neck; flippers rowing.
  tide_mother: {
    size: 64, ay: 60,
    body(X, J) {
      const skin = '#6a7a5a';
      const b = J.b * 0.5;
      X.in(0, 2);
      // The far flippers.
      X.limb([[46, 46, 3.4, -2], [53, 50, 2.6, -2], [58, 52, 1.4, -2]], dk(skin, 0.8), 'leather');
      X.in(1, 3);
      // The shell, domed; the plastron under it.
      X.ball(36, 38 - b, 22, 14, '#4a6a5a', 'shell', { rz: 15 });
      X.ball(36, 48, 20, 4.6, '#c8b890', 'leather', { rz: 4, z: 4 });
      X.ball(36, 44, 22.5, 2, '#3a5048', 'shell', { rz: 1.4, z: 6 });
      // Coral and weed grown on it; barnacles.
      X.in(2, 1);
      for (const [x, y, c] of [[28, 26, '#e07868'], [42, 25, '#f0a060'], [50, 31, '#e07868']]) {
        X.tube(x, y + 2 - b, x - 2, y - 5 - b, 1.6, 0.8, c, 'coral', { z: 12 });
        X.tube(x, y - b, x + 3, y - 4 - b, 1.2, 0.6, c, 'coral', { z: 12 });
      }
      for (let i = 0; i < 7; i++) X.ball(22 + i * 4.6, 32 - b + (i % 2) * 6, 1.4, 1.2, '#d8d0c0', 'shell', { z: 13, rz: 1.2 });
      hanging(X, [[18, 40], [24, 42], [52, 42]], 5, ['#4a7a3a', '#3a6a3a'], 14, 'moss');
    },
    paint(P, J) {
      const b = Math.round(J.b * 0.5);
      // The plates of the shell.
      for (const [x, y] of [[30, 31], [40, 31], [35, 38], [26, 39], [46, 39]]) {
        P.line(x - 4, y - b, x + 4, y - b, '#2a3a30');
        P.line(x - 4, y - b, x - 5, y + 4 - b, '#2a3a30');
      }
    },
    parts: {
      head: {
        w: 26, h: 20, px: 20, py: 12, role: 'head', layer: 'front', z: 4, amp: 1.4,
        at: [17, 42],
        body(X) {
          const skin = '#6a7a5a';
          X.in(0, 2);
          X.limb([[20, 12, 5, 1], [13, 10, 4.4, 2]], skin, 'leather');
          X.ball(8, 9, 6, 4.6, skin, 'leather', { rz: 4.6, z: 3 });
          // Her beak.
          X.slab([[2, 8], [6, 7], [6, 12], [2, 11]], '#3a3a2a', 'chitin', { z: 5, rz: 1, bevel: 0.8 });
        },
        paint(P) {
          for (let i = 0; i < 6; i++) P.set(7 + i * 2, 6 + (i % 2), hex('#4a5a3a'));
          P.line(2, 10, 7, 11, '#1a1a10');
        },
        glow(P) {
          eyes(P, [[7, 7]], '#e0d080', { big: true });
        },
      },
      flipper: {
        w: 22, h: 18, px: 16, py: 3, role: 'wing', layer: 'front', z: 6, depth: 0.35, rate: 1.1, lift: 0,
        at: [26, 46],
        body(X) {
          X.in(0, 1);
          X.slab([[16, 2], [20, 3], [10, 15], [2, 16], [4, 12]], '#6a7a5a', 'leather', { rz: 2.4, bevel: 1.6 });
        },
        paint(P) {
          for (let i = 0; i < 4; i++) P.set(8 + i * 3, 12 - i * 2, hex('#4a5a3a'));
        },
      },
    },
    fx(R, ctx, pose) {
      const t = R.r.time;
      inPose(R, ctx, pose, () => {
        for (let i = 0; i < 5; i++) {
          const k = (t * 0.6 + i / 5) % 1;
          dot(ctx, R.ox + 12 + i * 10, R.oy + 52 - k * 6, '#a0d8e0', 0.6 * Math.sin(k * Math.PI));
        }
      });
    },
  },

  // The Abyssal Clam: a clam the size of a boat, its two shells ridged and
  // grown with weed, breathing bubbles out at the lip; prised open, a
  // tongue of blue flesh and the great pearl glowing on it.
  abyssal_clam: {
    size: 64, ay: 58,
    body(X, J, t, st) {
      X.in(0, 2);
      // The lower shell.
      X.ball(32, 46, 28, 9, '#5a5a6a', 'shell', { rz: 10 });
      X.in(1, 2);
      // Its flesh, and the pearl.
      X.ball(32, 42, 21, 5, '#5a7aa8', 'slime', { rz: 4, z: 3 });
      X.ball(30, 39, 4.4, 4.4, '#f0f8ff', 'shell', { rz: 4, z: 6, glow: '#c0f0ff', glowK: st.open ? 0.6 : 0.2 });
    },
    paint(P) {
      for (let i = 0; i < 8; i++) {
        const x = 8 + i * 6.4;
        for (let y = 44; y < 55; y++) {
          const q = P.get(Math.round(x + (y - 44) * 0.1 * (i - 3.5)), y);
          if (q[3]) P.set(Math.round(x + (y - 44) * 0.1 * (i - 3.5)), y, shade(q, 0.75));
        }
      }
    },
    parts: {
      shell: {
        w: 62, h: 28, px: 58, py: 22, role: 'none', layer: 'front', z: 4,
        at: [60, 44],
        extra: (R) => -(R.st.open ? 0.55 : 0.03 + Math.max(0, Math.sin(R.t * 1.4)) * 0.06) - (R.A && R.A.k === 'slam' ? 0.25 * Math.sin(Math.PI * Math.min(1, R.A.t / R.A.dur)) : 0),
        body(X) {
          X.in(0, 2);
          X.ball(31, 15, 28, 11, '#6a6a7c', 'shell', { rz: 11 });
          for (let i = 0; i < 7; i++) X.tube(31, 22, 8 + i * 7.6, 6 + Math.abs(i - 3) * 2, 1.4, 1, '#7a7a8c', 'shell', { z: 10 });
          hanging(X, [[10, 22], [20, 24], [36, 25], [48, 23]], 4, ['#4a6a4a', '#3a5a3a'], 12, 'moss');
        },
        paint(P) {
          for (let i = 0; i < 18; i++) {
            const x = 8 + Math.floor(hash2(i, 2, 9) * 46);
            const y = 6 + Math.floor(hash2(i, 3, 9) * 14);
            const q = P.get(x, y);
            if (q[3]) P.set(x, y, hex('#d8d0c0'));
          }
        },
      },
    },
    fx(R, ctx, pose) {
      const t = R.r.time;
      inPose(R, ctx, pose, () => {
        for (let i = 0; i < 5; i++) {
          const k = (t * 0.5 + i / 5) % 1;
          dot(ctx, R.ox + 14 + i * 9 + Math.sin(k * 6 + i) * 2, R.oy + 42 - k * 26, '#c0e8f8', 0.8 * (1 - k));
        }
        if (R.st.open) glowAt(ctx, R.ox + 30, R.oy + 39, 10, '#c0f0ff', 0.3 + 0.1 * Math.sin(t * 4));
      });
    },
  },

  // The Coral Colossus: a giant built of the reef — rock and coral, branches
  // of it on its shoulders like horns, anemones waving on its chest, its
  // eyes glowing in a crevice; a shoal of little fish wheeling round it.
  coral_colossus: {
    size: 64, ay: 62,
    body(X, J, t) {
      const rock = '#6a6a70';
      const b = J.b;
      X.in(0, 3);
      for (const x of [26, 42]) X.limb([[x, 46, 6, 0], [x - 1, 55, 5.4, 0], [x - 1, 60, 6, 0]], rock, 'rock', { cell: 4.5 });
      X.ball(36, 33 - b, 18, 15, rock, 'rock', { rz: 14, cell: 6 });
      X.ball(19, 24 - b, 9, 7.4, rock, 'rock', { rz: 7, z: 6, cell: 4 });
      X.in(1, 2);
      // Coral on its shoulders, and its back.
      for (const [x, y, s] of [[18, 20, -1], [46, 18, 1]]) {
        X.limb([[x, y - b, 2.4, 6], [x + s * 4, y - 8 - b, 1.8, 6], [x + s * 3, y - 15 - b, 1.2, 6]], '#e07868', 'coral');
        X.limb([[x + s * 4, y - 8 - b, 1.4, 6], [x + s * 9, y - 12 - b, 1, 6]], '#f0a060', 'coral');
      }
      X.ball(44, 28 - b, 5, 4, '#c8a0d8', 'coral', { z: 7, rz: 3 });
      // Anemones on its chest, waving.
      for (let i = 0; i < 4; i++) {
        const x = 24 + i * 5;
        const w = Math.sin(t * TAU + i) * 1.4;
        X.limb([[x, 42 - b, 1.4, 14], [x + w, 38 - b, 1, 14], [x + w * 1.6, 35 - b, 0.6, 14]], i % 2 ? '#f080c0' : '#80e0c0', 'slime');
      }
    },
    paint(P, J) {
      const b = Math.round(J.b);
      P.blob(17, 24 - b, 5, 2, '#1a1418', { amb: 0 });
    },
    glow(P, J, t, st) {
      const b = Math.round(J.b);
      eyes(P, [[15, 24 - b], [19, 24 - b]], st.wind ? '#ffffff' : '#ff8a8a', { big: true });
      for (const x of [15, 19]) glow(P, x, 24 - b, 2, '#ff6a6a', 0.35);
    },
    parts: {
      armF: {
        w: 20, h: 36, px: 10, py: 4, role: 'offhand', layer: 'back', z: -2, amp: 0.7,
        at: [48, 26],
        body(X) {
          X.in(0, 2);
          X.limb([[10, 4, 5.4, 1], [12, 16, 4.6, 2], [10, 28, 5.6, 2]], '#56565c', 'rock', { cell: 4 });
          X.limb([[12, 14, 1, 4], [17, 10, 0.6, 4]], '#c86a5a', 'coral');
        },
      },
      armN: {
        w: 22, h: 38, px: 14, py: 4, role: 'weapon', layer: 'front', z: 5, amp: 0.7,
        at: [30, 26],
        body(X) {
          X.in(0, 2);
          X.limb([[14, 4, 6, 1], [9, 17, 5, 2], [9, 30, 6.2, 2]], '#6a6a70', 'rock', { cell: 4 });
          X.limb([[10, 16, 1.2, 4], [4, 12, 0.8, 4], [3, 8, 0.4, 4]], '#e07868', 'coral');
          X.ball(14, 26, 2, 1.6, '#f0a060', 'coral', { z: 4, rz: 1 });
        },
      },
    },
    behind(R) {
      shoal(R, false);
    },
    front(R) {
      shoal(R, true);
    },
  },

  // ------------------------------------------------------------ Thessa's grove
  // The Elder Stag: a stag as tall as a house, grey with age, shaggy, its
  // antlers like a dead tree, moss hanging off them swaying and trailing;
  // its eyes green; its head down to charge.
  elder_stag: {
    size: 64, ay: 62, walk: true,
    body(X, J) {
      const fur = '#7a7468';
      const q = quadruped(X, J, { cx: 36, cy: 39, len: 24, girth: 9, legLen: 18, lr: 2.8, col: fur, mat: 'fur', belly: '#9a9488', paw: 'hoof', hoof: '#2a2420', neck: [19, 27] });
      // A ruff of shaggy fur at its throat and chest.
      X.in(4, 1);
      X.ball(q.neck[0] + 4, q.neck[1] + 8, 5, 6, '#9a9488', 'fur', { z: 10, rz: 4 });
      X.ball(52, 33 - J.b * 0.5, 3, 2.4, '#e8e0d0', 'fur', { z: 4, rz: 2 });
    },
    parts: {
      head: beastHead({
        kind: 'horse', r: 6, col: '#7a7468', mat: 'fur', eye: '#80ff80', ears: true, at: [19, 26], z: 6, w: 44, h: 42, cx: 16, cy: 28, nose: '#2a2420',
        extra(X, c, r) {
          // (Its crown of antlers, bigger than the kit's: gnarled as dead
          // wood.)
          X.in(2, 1.2);
          for (const s of [0, 1]) {
            const rx = c.x + r * (0.2 + s * 0.4);
            const ry = c.y - r * 0.6;
            const col = s ? '#b8a888' : '#8a7a62';
            X.limb([[rx, ry, 1.8, 9 + s], [rx + 3, ry - 8, 1.5, 9 + s], [rx + 2, ry - 16, 1.1, 9 + s], [rx + 6, ry - 24, 0.6, 9 + s]], col, 'bark');
            X.limb([[rx + 3, ry - 8, 1.1, 9 + s], [rx + 10, ry - 12, 0.8, 9 + s], [rx + 16, ry - 18, 0.5, 9 + s]], col, 'bark');
            X.limb([[rx + 2, ry - 15, 0.9, 9 + s], [rx - 5, ry - 21, 0.5, 9 + s]], col, 'bark');
            X.limb([[rx + 10, ry - 12, 0.6, 9 + s], [rx + 11, ry - 19, 0.4, 9 + s]], col, 'bark');
          }
        },
      }),
    },
    front(R) {
      // Moss hanging from its antlers, swaying and trailing.
      for (const [x, y, len, k] of [[22, 14, 9, 0], [28, 12, 7, 1], [18, 12, 8, 2], [21, 6, 6, 3], [32, 6, 5, 4]]) {
        const top = partAt(R, 'head', x, y);
        const pts = [];
        for (let i = 0; i <= 5; i++) {
          const f = i / 5;
          pts.push({ x: top.x + Math.sin(R.t * 1.8 + k + f * 2) * f * 1.6 - R.drift * 4 * f, y: top.y + f * len });
        }
        drawStrand(R.ctx, pts, k % 2 ? '#6a8a4a' : '#4a6a3a', 2, 1);
      }
    },
    fx(R, ctx, pose) {
      const t = R.r.time;
      if (!R.st.wind && !(R.A && R.A.k === 'charge')) return;
      inPose(R, ctx, pose, () => {
        // Its breath, hard, as it lowers its head to charge.
        const m = partAt(R, 'head', 16 - 6 * 2.6, 28 + 6 * 0.35);
        smoke(ctx, m.x, m.y, t * 3, { n: 3, rise: 3, drift: -8, col: '#e0e8e0', dark: '#c0c8c0', a: 0.55, r0: 1 });
      });
    },
  },

  // The Hollow Oak: an oak that walks, hollowed by age, a face in its
  // trunk with a light deep in it, branches for arms, roots for feet; its
  // leaves as the season it's in (spring blossom, summer green, autumn
  // fire, winter bare and snowed on), falling.
  hollow_oak: {
    size: 64, ay: 62,
    body(X, J, t, st) {
      const bark = '#5a4a3a';
      const b = J.b * 0.5;
      X.in(0, 3);
      for (const [x, s] of [[24, -1], [40, 1], [32, 0]]) X.limb([[x, 50, 4, 0], [x + s * 6, 57, 3, 0], [x + s * 10, 61, 1.6, 0]], bark, 'bark');
      X.ball(32, 42, 12, 15, bark, 'bark', { rz: 11 });
      X.ball(32, 28 - b, 11, 9, bark, 'bark', { rz: 10, z: 1 });
      if (st.season === 3) {
        // Ice on its trunk in winter.
        X.in(1, 1);
        for (let i = 0; i < 4; i++) X.tube(24 + i * 5, 22 - b, 24 + i * 5, 27 - b, 0.9, 0.2, '#e0f0ff', 'glass', { z: 12 });
      }
    },
    paint(P, J, t, st) {
      const b = Math.round(J.b * 0.5);
      // The grain of the bark; the hollow face.
      P.over((x, y, c) => (c[3] && (x + Math.round(Math.sin(y * 0.3) * 1.5)) % 4 === 0 ? shade(c, 0.78) : null));
      for (const x of [28, 36]) P.blob(x, 35 - b, 2.2, 2.8, '#140c08', { amb: 0 });
      P.blob(32, 43 - b, 3.4, 4.2, '#140c08', { amb: 0 });
      if (st.season === 3) P.over((x, y, c) => (c[3] && y < 34 && hash2(x, y, 4) < 0.25 ? mix(c, [240, 244, 255], 0.7) : null));
    },
    glow(P, J, t, st) {
      const b = Math.round(J.b * 0.5);
      for (const x of [28, 36]) {
        P.fx(x, 35 - b, st.wind ? '#ffe080' : '#a0e070', 1);
        glow(P, x, 35 - b, 2, st.wind ? '#ffe080' : '#a0e070', 0.4);
      }
    },
    parts: {
      branchF: {
        w: 30, h: 30, px: 4, py: 24, role: 'offhand', layer: 'back', z: -2, amp: 0.8,
        at: [40, 26],
        body(X) {
          X.in(0, 1.4);
          X.limb([[4, 24, 3.4, 1], [12, 18, 2.6, 1], [20, 10, 1.8, 1], [24, 3, 1, 1]], '#4a3a2c', 'bark');
          X.limb([[12, 18, 1.4, 2], [20, 18, 0.8, 2]], '#4a3a2c', 'bark');
        },
      },
      branchN: {
        w: 30, h: 30, px: 26, py: 24, role: 'weapon', layer: 'front', z: 3, amp: 0.8,
        at: [24, 26],
        body(X) {
          X.in(0, 1.4);
          X.limb([[26, 24, 3.6, 1], [18, 18, 2.8, 1], [10, 10, 1.9, 1], [6, 3, 1, 1]], '#5a4a3a', 'bark');
          X.limb([[18, 18, 1.4, 2], [10, 19, 0.8, 2]], '#5a4a3a', 'bark');
          X.limb([[10, 10, 1, 2], [3, 9, 0.5, 2]], '#5a4a3a', 'bark');
        },
      },
      crown: {
        w: 60, h: 34, px: 30, py: 30, role: 'sway', layer: 'front', z: 4, depth: 0.05, rate: 0.8,
        at: (J) => [32, 26 - J.b * 0.5],
        variant: (R) => String(R.st.season ?? 1),
        body(X, v) {
          if (v === '3') {
            // Bare, in winter: only its boughs.
            X.in(0, 1.2);
            for (const s of [-1, 1]) X.limb([[30, 30, 2.4, 1], [30 + s * 9, 20, 1.8, 1], [30 + s * 16, 12, 1.1, 1], [30 + s * 22, 6, 0.6, 1]], '#4a3a2c', 'bark');
            X.limb([[30, 30, 2, 1], [31, 16, 1.4, 1], [29, 6, 0.8, 1]], '#4a3a2c', 'bark');
            return;
          }
          const leaf = v === '0' ? '#c8e090' : v === '2' ? '#c86a2a' : '#4a7a3a';
          X.in(0, 4);
          for (const [x, y, r] of [[30, 12, 13], [17, 16, 10], [43, 16, 10], [7, 12, 6], [53, 12, 6], [30, 22, 9]]) X.ball(x, y, r, r * 0.75, leaf, 'moss', { rz: r * 0.7, z: 4 });
        },
        paint(P, v) {
          if (v === '0') for (let i = 0; i < 14; i++) P.set(Math.round(4 + hash2(i, 1, 3) * 52), Math.round(4 + hash2(i, 2, 3) * 22), hex('#fff0f4'));
          if (v === '2') P.over((x, y, c) => (c[3] && hash2(x, y, 5) < 0.2 ? mix(c, [255, 200, 60], 0.5) : null));
          if (v === '3') P.over((x, y, c) => (c[3] && hash2(x, y, 4) < 0.35 ? mix(c, [240, 244, 255], 0.75) : null));
        },
      },
    },
    fx(R, ctx, pose) {
      const t = R.r.time;
      const season = R.st.season ?? 1;
      const col = season === 0 ? '#ffe0ec' : season === 2 ? '#e08030' : season === 3 ? '#ffffff' : '#6aa04a';
      inPose(R, ctx, pose, () => {
        for (let i = 0; i < 7; i++) {
          const k = (t * 0.3 + i / 7) % 1;
          dot(ctx, R.ox + 8 + i * 8 + Math.sin(k * 6 + i) * 4, R.oy + 10 + k * 50, col, 0.9 * (1 - k * 0.6));
        }
      });
    },
  },
});

// (Those that share another's looks: the Hollow Saint's shade, the
// Hollow King's echo.)
FORGE.saint_shade = FORGE.hollow_saint;
FORGE.hollow_echo = FORGE.hollow_king;
