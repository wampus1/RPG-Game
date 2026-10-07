// (Round 71) The far lands' masters that walk as people do, forged anew
// (see forge.js, forgekit.js figure): each in what it wears and carries,
// its hat or helm, its weapon swinging in its hand, its head turning and
// roaring, its cape, and what it gives off.
import { forge, inPose, partAt } from './forge.js';
import { eyes, glow, glowLine, along, HG, figure, hat } from './forgekit.js';
import { flame, embers, smoke, puff, drops, glowAt, motes, dot } from './forgefx.js';
import { hex, shade } from './pixel.js';

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
// Eyes that burn (a head's glow).
const burning = (col, k = 0.35) => (P, c, r) => {
  eyes(P, eyesOf(c, r), col);
  glow(P, c.x - r * 0.35, c.y, r * 0.55, col, k);
};
// A hat on a head (the head's extra), and anything else on it.
const wearing = (h, more) => (X, c, r) => {
  hat(X, c, r, h);
  if (more) more(X, c, r);
};
// Something held up on a staff (its head: see forgekit weapon `head`).
const staffOf = (len, top) => ({ kind: 'staff', len, butt: 12, head: top });
// Arms held out stiff before it (the jiangshi's).
function stiffArms(def) {
  def.parts.armN.a0 = 1.35;
  def.parts.armF.a0 = 1.45;
  if (def.parts.blade) def.parts.blade.a0 = 0;
  return def;
}

forge({
  // ------------------------------------------------------------ Velmarch
  // The Frost Jarl: a jarl of the north the cold kept, his skin gone the
  // blue of old ice, his hair and beard white and stiff with frost; mail
  // and a helm crowned with icicles; a cape of white fur in rags; his
  // greatsword of blue ice, runes alight in it; his breath a fog.
  frost_jarl: figure({
    stance: { h: 1.04, w: 1.14 },
    legs: { col: '#2a3440', mat: 'mail', r: 4.6, greave: '#6a7a88', boot: '#2a2a30', bootMat: 'leather' },
    torso: { col: '#3a4a5a', mat: 'mail', build: 'muscle' },
    plate: { col: '#6a7a88', skirt: '#2a3440', skirtMat: 'mail', trim: '#c8d8e8' },
    belt: { col: '#2a2018', buckle: '#c8d8e8' },
    pauldronF: { col: '#6a7a88', r: 5.8, spikes: 2, spikeLen: 3, spikeCol: '#e8f8ff', trim: '#c8d8e8' },
    head: {
      kind: 'man', r: 5.4, col: '#a8b8c8', hair: '#e8f0f8', hairStyle: 'long', beard: '#e8f0f8', beardLong: true, face: { eye: '#a0e8ff', white: '#e0f8ff' },
      extra: wearing({ kind: 'helm', col: '#8a9aa8', spikes: '#e8f8ff', spikeMat: 'glass' }),
      glow: burning('#a0e8ff'),
    },
    cape: { col: '#d8e0e8', mat: 'fur', ragged: true, w: 30, h: 40, clasp: '#c8d8e8' },
    arm: { col: '#a8b8c8', r: 4, gauntlet: '#6a7a88', L1: 8.8, L2: 8.4, wang: 0.95, pauldron: { col: '#6a7a88', r: 6.2, spikes: 2, spikeLen: 3.2, spikeCol: '#e8f8ff', trim: '#c8d8e8' } },
    weapon: {
      kind: 'greatsword', len: 30, width: 2.8, col: '#a8d0e8', mat: 'glass', guard: '#6a7a88', guardMat: 'metal', pommel: '#a0e8ff', grip: '#2a2018', gripMat: 'leather',
      glow(P, { H, wang }) {
        for (let i = 0; i < 4; i++) {
          const a = along(H, wang, 8 + i * 5.5);
          const b = along(H, wang, 10 + i * 5.5, i % 2 ? 0.9 : -0.9);
          glowLine(P, a.x, a.y, b.x, b.y, '#e0f8ff', 0.9);
        }
      },
    },
    fist: { col: '#6a7a88', r: 2.8 },
    armF: { col: '#a8b8c8', r: 3.8, gauntlet: '#6a7a88' },
    fx(R, ctx, pose) {
      const t = R.r.time;
      inPose(R, ctx, pose, () => {
        const m = onHead(R, -6, 4);
        smoke(ctx, m.x, m.y, t, { n: 3, rise: 4, drift: -8, col: '#ffffff', dark: '#d0e8f8', a: 0.4, r0: 1, grow: 2 });
        for (let i = 0; i < 6; i++) {
          const k = (t * 0.3 + i / 6) % 1;
          dot(ctx, R.ox + 10 + ((i * 0.618) % 1) * 44 + Math.sin(k * 5 + i) * 3, R.oy + 6 + k * 54, '#ffffff', 0.8 * (1 - k));
        }
      });
    },
  }),

  // The Iron Legate: a legate of the old empire still holding his post,
  // dead a thousand years: his skin the grey-blue of the drowned, a bronze
  // cuirass over a red tunic, a red cloak, his helm's red crest; his spear,
  // his great red shield with its boss; a cold breath about him.
  iron_legate: figure({
    stance: { h: 1.03, w: 1.1 },
    legs: { col: '#9ab0c8', mat: 'skin', r: 4.2, greave: '#c8a040', boot: '#4a3a24', bootMat: 'leather' },
    torso: { col: '#8a2020', mat: 'cloth', build: 'muscle' },
    plate: { col: '#c8a040', mat: 'gold', skirt: '#a02020', skirtMat: 'leather', trim: '#e0c060' },
    belt: { col: '#4a2a1a', buckle: '#e0c060' },
    pauldronF: { col: '#c8a040', r: 5.4, trim: '#e0c060' },
    head: {
      kind: 'man', r: 5.2, col: '#9ab0c8', hair: '#c8d8e8', hairStyle: 'short', face: { eye: '#e0f4ff', white: '#e8f8ff' },
      extra: wearing({ kind: 'helm', col: '#c8a040', mat: 'gold', crest: '#c82020' }),
      glow: burning('#e0f4ff', 0.25),
    },
    cape: { col: '#a02020', mat: 'cloth', w: 30, h: 40, clasp: '#e0c060' },
    arm: { col: '#9ab0c8', r: 3.8, sleeve: '#8a2020', L1: 8.6, L2: 8.4, wang: 0.25 },
    weapon: { kind: 'spear', len: 30, col: '#d8d8e0', grip: '#5a3a24' },
    fist: { col: '#9ab0c8', mat: 'skin', r: 2.5 },
    armF: { col: '#9ab0c8', r: 3.6, sleeve: '#8a2020' },
    parts: {},
    holds: { kind: 'shield', r: 8.5, col: '#a02020', mat: 'leather', rim: '#c8a040', boss: '#e0c060' },
    paint(P, J) {
      // The cuirass's muscles moulded in it.
      const c = J.chest;
      for (const [x0, y0, x1, y1] of [[c.x - 6, c.y - 2, c.x - 1, c.y], [c.x + 1, c.y, c.x + 6, c.y - 2], [c.x, c.y + 2, c.x, c.y + 8]]) {
        const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0));
        for (let i = 0; i <= n; i++) {
          const x = Math.round(x0 + ((x1 - x0) * i) / n);
          const y = Math.round(y0 + ((y1 - y0) * i) / n);
          const q = P.get(x, y);
          if (q[3]) P.set(x, y, shade(q, 0.7));
        }
      }
    },
    fx(R, ctx, pose) {
      const t = R.r.time;
      inPose(R, ctx, pose, () => {
        const m = onHead(R, 0, -2);
        glowAt(ctx, m.x, m.y, 6, '#c8e8ff', 0.15 + 0.08 * Math.sin(t * 3));
        smoke(ctx, R.ox + 32, R.oy + 60, t, { n: 4, rise: 6, spread: 10, col: '#c8e8ff', dark: '#a0c0d8', a: 0.25 });
      });
    },
  }),

  // The Pale Vestal: keeper of the empire's last fire, all in white, veiled
  // and edged in gold, pale as the ash she tends; her staff with its bowl
  // of fire at the top, never out.
  pale_vestal: figure({
    stance: { h: 1.04, w: 0.94 },
    robe: { col: '#f4f0e8', mat: 'velvet', trim: '#c8a040', front: '#e8e4dc', flare: 1.1 },
    torso: { col: '#f4f0e8', mat: 'velvet', build: 'lean' },
    belt: { col: '#c8a040', buckle: '#fff0b0' },
    head: {
      kind: 'man', r: 5, col: '#e8e4f0', face: { eye: '#ffe8a0', white: '#fff8e0', mouth: 2 },
      extra: wearing({ kind: 'veil', col: '#f8f4ec', trim: '#c8a040' }),
      glow: burning('#ffe8a0', 0.2),
    },
    arm: { col: '#e8e4f0', r: 2.8, sleeve: '#f4f0e8', sleeveMat: 'velvet', L1: 8.6, L2: 8, wang: 0.15 },
    weapon: staffOf(30, (X, at, z) => {
      X.ball(...at(30), 2.8, 1.6, '#c8a040', 'gold', { z, rz: 1.4 });
      X.tube(...at(28), ...at(30), 0.8, 2, '#c8a040', 'gold', { z });
    }),
    fist: { col: '#e8e4f0', mat: 'skin', r: 2.2 },
    armF: { col: '#e8e4f0', r: 2.8, sleeve: '#f4f0e8', sleeveMat: 'velvet' },
    fx(R, ctx, pose) {
      const t = R.r.time;
      inPose(R, ctx, pose, () => {
        const p = onBlade(R, 31);
        flame(ctx, p.x, p.y, R.A && R.A.k ? 9 : 6, t, { w: 3 });
        glowAt(ctx, p.x, p.y - 3, 8, '#ffb040', 0.3);
        embers(ctx, p.x - 3, p.y - 4, 6, t, { n: 3, rise: 14 });
      });
    },
  }),

  // The Deserter General: the general who left his legion to die, still in
  // his dented plate and the red of his rank gone brown, a sash, his helm's
  // crest torn, his sabre; a scar across his face.
  deserter_general: figure({
    stance: { h: 1.02, w: 1.12 },
    legs: { col: '#3a2a24', mat: 'cloth', r: 4.4, greave: '#7a7060', boot: '#2a2018', bootMat: 'leather' },
    torso: { col: '#6a2a2a', mat: 'cloth', build: 'muscle' },
    plate: { col: '#8a8070', skirt: '#4a2420', skirtMat: 'leather', trim: '#c8a040' },
    belt: { col: '#3a2418', buckle: '#c8a040' },
    pauldronF: { col: '#8a8070', r: 5.6, trim: '#c8a040' },
    sculpt(X, J) {
      X.in(HG.front, 1);
      X.limb([[J.shN.x - 1, J.shN.y + 2, 1.3, 18], [J.chest.x, J.chest.y + 4, 1.3, 18], [J.waist.x - 5, J.waist.y + 2, 1.3, 18]], '#8a3a2a', 'cloth');
    },
    head: {
      kind: 'man', r: 5.3, col: '#b08060', hair: '#3a2a20', beard: '#3a2a20', face: { eye: '#3a2a20', scar: true },
      extra: wearing({ kind: 'helm', col: '#7a7060', crest: '#4a2020' }),
    },
    cape: { col: '#5a1a1a', mat: 'cloth', ragged: true, w: 28, h: 38 },
    arm: { col: '#b08060', r: 3.8, gauntlet: '#7a7060', L1: 8.8, L2: 8.4, wang: 0.9, pauldron: { col: '#8a8070', r: 6, trim: '#c8a040' } },
    weapon: { kind: 'sabre', len: 20, col: '#c8c8d0', guard: '#c8a040' },
    fist: { col: '#7a7060', r: 2.6 },
    armF: { col: '#b08060', r: 3.6, gauntlet: '#7a7060' },
    paint(P, J) {
      // Dents in his plate.
      for (const [x, y] of [[J.chest.x - 4, J.chest.y - 1], [J.chest.x + 3, J.chest.y + 3]]) {
        P.set(x, y, shade(P.get(x, y), 0.6));
        P.set(x + 1, y, shade(P.get(x + 1, y), 1.25));
      }
    },
  }),

  // The Last Emperor: the last of them, kept alive by what he did to stay
  // emperor: bald and pale as a candle, in the purple and a cuirass of
  // gold, the white toga over it bordered in purple, a laurel of gold; his
  // sceptre with its eagle; motes of gold rising off him.
  last_emperor: figure({
    stance: { h: 1.02, w: 1.02 },
    robe: { col: '#5a1a6a', mat: 'velvet', trim: '#e0c050', flare: 1.1 },
    torso: { col: '#d8b040', mat: 'gold', build: 'lean' },
    belt: { col: '#5a1a6a', buckle: '#e0c050' },
    sculpt(X, J) {
      // The toga over the shoulder, purple-bordered.
      X.in(HG.front, 1);
      X.limb([[J.shF.x + 1, J.shF.y, 2.4, 17], [J.chest.x - 2, J.waist.y + 1, 2.6, 17], [J.waist.x + 5, J.pelvis.y + 6, 2.2, 17]], '#f0ece0', 'cloth');
      X.limb([[J.shF.x + 1.4, J.shF.y - 1.2, 0.8, 18], [J.chest.x - 1.6, J.waist.y - 0.6, 0.8, 18], [J.waist.x + 5.6, J.pelvis.y + 4.6, 0.8, 18]], '#7a2a8a', 'cloth');
    },
    head: {
      kind: 'man', r: 5.2, col: '#c0c8d8', face: { eye: '#ffe080', white: '#fff8d0' },
      extra: wearing({ kind: 'wreath', col: '#d8b040', col2: '#e8c860', mat: 'gold' }),
      glow: burning('#ffe080', 0.2),
    },
    cape: { col: '#6a1a7a', mat: 'velvet', w: 30, h: 42, clasp: '#e0c050', lining: '#e0c050' },
    arm: { col: '#c0c8d8', r: 3, sleeve: '#5a1a6a', sleeveMat: 'velvet', L1: 8.6, L2: 8, wang: 0.2 },
    weapon: staffOf(26, (X, at, z) => {
      X.ball(...at(26), 2.6, 2.6, '#e0c050', 'gold', { z, rz: 2.4 });
      X.tube(...at(27.5, -3.5), ...at(27.5, 3.5), 0.8, 0.8, '#e0c050', 'gold', { z: z + 1 });
      X.ball(...at(30), 1.8, 2.2, '#e0c050', 'gold', { z: z + 1, rz: 1.4 });
    }),
    fist: { col: '#c0c8d8', mat: 'skin', r: 2.3 },
    armF: { col: '#c0c8d8', r: 3, sleeve: '#5a1a6a', sleeveMat: 'velvet' },
    fx(R, ctx, pose) {
      const t = R.r.time;
      inPose(R, ctx, pose, () => {
        embers(ctx, R.ox + 12, R.oy + 50, 40, t, { n: 6, rise: 44, speed: 0.25, cols: ['#ffffff', '#ffe080', '#e0c050', '#a08020'] });
        const s = onBlade(R, 30);
        glowAt(ctx, s.x, s.y, 4, '#ffe080', 0.35);
      });
    },
  }),

  // ------------------------------------------------------------ Ostria
  // The Jade Corpse Lord: a lord buried in his court robes of night blue
  // and gold, sewn over with plates of jade to keep him whole, the
  // official's hat on his head; he does not bend: he hops, his arms held
  // stiff out before him, and the yellow paper charm that holds him hangs
  // over his face.
  jade_corpse_lord: stiffArms(figure({
    stance: { h: 1.04, w: 1 },
    robe: { col: '#1e3a5a', mat: 'velvet', trim: '#d8b040', front: '#1a3250', flare: 0.9 },
    torso: { col: '#1e3a5a', mat: 'velvet', build: 'lean' },
    belt: { col: '#d8b040', buckle: '#40a070' },
    sculpt(X, J) {
      // Plates of jade sewn over the robe in rows.
      X.in(HG.front, 1);
      for (let r = 0; r < 4; r++) for (let i = 0; i < 4; i++) X.ball(J.chest.x - 5 + i * 3.2, J.chest.y - 3 + r * 3.4, 1.3, 1.4, i % 2 ? '#60c890' : '#40a070', 'glass', { z: 18, rz: 0.8 });
      // The square of embroidery at his breast.
      X.slab([[J.chest.x - 3, J.waist.y + 1], [J.chest.x + 3, J.waist.y + 1], [J.chest.x + 3, J.waist.y + 7], [J.chest.x - 3, J.waist.y + 7]], '#d8b040', 'gold', { z: 18.4, rz: 0.8, bevel: 0.6 });
    },
    head: {
      kind: 'man', r: 5.2, col: '#8ab8a0', hair: '#1a2a20', hairStyle: 'long', face: { eye: '#80ffa0', white: '#c0ffd0', mouth: 2 },
      extra: wearing({ kind: 'cone', col: '#1e2a24', tall: 1.9, knob: '#c82020' }),
      paint(P, c, r) {
        // The paper charm over his face, its red seal-writing.
        P.rect(Math.round(c.x - r * 0.9), Math.round(c.y - r * 0.55), 3, 9, '#f0d860');
        P.rect(Math.round(c.x - r * 0.9) + 1, Math.round(c.y - r * 0.3), 1, 1, '#c82020');
        P.rect(Math.round(c.x - r * 0.9) + 1, Math.round(c.y + r * 0.2), 1, 2, '#c82020');
        P.rect(Math.round(c.x - r * 0.9), Math.round(c.y + r * 0.8), 2, 1, '#c82020');
      },
      glow: burning('#80ffa0', 0.3),
    },
    arm: { col: '#8ab8a0', r: 2.9, sleeve: '#1e3a5a', sleeveMat: 'velvet', L1: 8.6, L2: 8, claw: '#2a3a2a' },
    armF: { col: '#8ab8a0', r: 2.9, sleeve: '#1e3a5a', sleeveMat: 'velvet', claw: '#2a3a2a' },
    fx(R, ctx, pose) {
      const t = R.r.time;
      inPose(R, ctx, pose, () => {
        const m = onHead(R, -6, 3);
        smoke(ctx, m.x, m.y, t, { n: 3, rise: 5, drift: -5, col: '#a0ffc0', dark: '#60c890', a: 0.4, r0: 0.8, grow: 1.6 });
      });
    },
  })),

  // The Bandit Khan: the khan of the steppe riders turned to banditry, in
  // lamellar of red leather, a teal sash, an orange cloak; long black hair
  // and drooping moustaches under a spiked helm edged in fur; his sabre.
  bandit_khan: figure({
    stance: { h: 1.02, w: 1.12 },
    legs: { col: '#4a3020', mat: 'leather', r: 4.4, boot: '#2a1a12', bootMat: 'leather' },
    torso: { col: '#8a3a20', mat: 'leather', build: 'muscle' },
    plate: { col: '#8a3a20', mat: 'leather', skirt: '#6a2a18', skirtMat: 'leather', trim: '#d8c8a0' },
    belt: { col: '#3a2010', buckle: '#40c0b8' },
    sculpt(X, J) {
      X.in(HG.belt, 1);
      X.ball(J.waist.x, J.waist.y + 1.5, 8.6 * J.w, 2.2, '#40a0a0', 'cloth', { z: 15, rz: 2 });
      X.limb([[J.waist.x - 5, J.waist.y + 2, 1.2, 16], [J.waist.x - 6.5, J.pelvis.y + 7, 1, 16]], '#40a0a0', 'cloth');
    },
    paint(P, J) {
      // The rows of his lamellar.
      P.over((x, y, c) => (c[3] && y > J.chest.y - 6 && y < J.pelvis.y + 8 && c[0] > 100 && c[1] < 70 && (y % 3 === 0 || (x + Math.floor(y / 3) * 2) % 4 === 0) ? shade(c, 0.7) : null));
    },
    head: {
      kind: 'man', r: 5.3, col: '#b07850', hair: '#1a1410', hairStyle: 'long', beard: '#1a1410', face: { eye: '#2a1a10', grin: true },
      extra: wearing({ kind: 'helm', col: '#8a6a40', spikes: '#d8c8a0' }, (X, c, r) => {
        X.ball(c.x + r * 0.3, c.y - r * 0.15, r * 1.2, r * 0.3, '#5a4030', 'fur', { z: 19, rz: 1 });
      }),
    },
    cape: { col: '#c86030', mat: 'cloth', w: 26, h: 32 },
    arm: { col: '#b07850', r: 3.9, sleeve: '#8a3a20', sleeveMat: 'leather', L1: 8.8, L2: 8.4, wang: 0.9 },
    weapon: { kind: 'sabre', len: 21, col: '#d8d8e0', guard: '#40c0b8', guardMat: 'gold' },
    fist: { col: '#b07850', mat: 'skin', r: 2.6 },
    armF: { col: '#b07850', r: 3.7, sleeve: '#8a3a20', sleeveMat: 'leather' },
  }),

  // The Terracotta General: one of the clay army buried with the first
  // king, woken: baked clay all through, painted once in red and black and
  // the paint flaking; his armour of clay plates, his topknot, a red
  // tassel; the kiln's cracks across him; his halberd.
  terracotta_general: figure({
    stance: { h: 1.03, w: 1.12 },
    legs: { col: '#9a5030', mat: 'ceramic', r: 4.6, greave: '#8a4a2a', greaveMat: 'ceramic', boot: '#7a3e24', bootMat: 'ceramic' },
    torso: { col: '#a85a34', mat: 'ceramic', build: 'muscle' },
    plate: { col: '#9a5030', mat: 'ceramic', skirt: '#8a4a2a', skirtMat: 'ceramic', trim: '#c83030' },
    belt: { col: '#6a3018', buckle: '#c83030' },
    pauldronF: { col: '#9a5030', mat: 'ceramic', r: 5.4 },
    paint(P, J) {
      // His plates of clay in rows, studded; the kiln's cracks.
      P.over((x, y, c) => (c[3] && y > J.chest.y - 5 && y < J.pelvis.y + 9 && (y % 4 === 0) ? shade(c, 0.72) : null));
      for (const [x, y] of [[J.chest.x - 5, J.chest.y - 2], [J.chest.x - 1, J.chest.y + 2], [J.chest.x + 3, J.chest.y - 2], [J.chest.x + 1, J.chest.y + 6]]) P.set(x, y, hex('#e0b090'));
      for (const [x0, y0, x1, y1] of [[J.chest.x - 4, J.chest.y - 2, J.chest.x - 1, J.chest.y + 3], [J.waist.x + 3, J.waist.y, J.waist.x + 5, J.pelvis.y + 4]]) {
        const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0));
        for (let i = 0; i <= n; i++) {
          const x = Math.round(x0 + ((x1 - x0) * i) / n);
          const y = Math.round(y0 + ((y1 - y0) * i) / n);
          if (P.get(x, y)[3]) P.set(x, y, hex('#4a2010'));
        }
      }
    },
    head: {
      kind: 'man', r: 5.2, col: '#b8643a', mat: 'ceramic', hair: '#3a1a10', hairStyle: 'short', face: { eye: '#3a1a10', white: '#c87a50' },
      extra(X, c, r) {
        // His topknot, bound with a red tassel.
        X.in(HG.head, 1);
        X.ball(c.x + r * 0.5, c.y - r * 1.15, r * 0.45, r * 0.4, '#3a1a10', 'ceramic', { z: 19, rz: 1 });
        X.limb([[c.x + r * 0.7, c.y - r * 1.1, r * 0.2, 19], [c.x + r * 1.3, c.y - r * 0.7, r * 0.25, 19], [c.x + r * 1.5, c.y - r * 0.1, r * 0.1, 19]], '#c83030', 'hair');
      },
    },
    arm: { col: '#a85a34', mat: 'ceramic', r: 3.9, L1: 8.8, L2: 8.4, wang: 0.25, pauldron: { col: '#9a5030', mat: 'ceramic', r: 5.8 } },
    weapon: { kind: 'halberd', len: 30, col: '#a0886a', grip: '#6a3018' },
    fist: { col: '#a85a34', mat: 'ceramic', r: 2.6 },
    armF: { col: '#a85a34', mat: 'ceramic', r: 3.7 },
    fx(R, ctx, pose) {
      const t = R.r.time;
      if (!R.A || !R.A.k) return;
      inPose(R, ctx, pose, () => {
        // Clay dust shaken off him as he moves.
        for (let i = 0; i < 5; i++) {
          const k = (t * 1.2 + i / 5) % 1;
          dot(ctx, R.ox + 20 + i * 5, R.oy + 30 + k * 28, '#c87a50', 0.7 * (1 - k));
        }
      });
    },
  }),

  // ------------------------------------------------------------ Corrow
  // The Bone Thane: a thane of the whaling-folk dead and still holding his
  // hall: a skull's face, mail rusted grey, a helm of whalebone spiked with
  // teeth, a whale's rib bound on his shoulder; his hammer of bone.
  bone_thane: figure({
    stance: { h: 1.03, w: 1.12 },
    legs: { col: '#2a3438', mat: 'mail', r: 4.4, greave: '#e8e0cc', greaveMat: 'bone', boot: '#2a2620', bootMat: 'leather' },
    torso: { col: '#3a4a50', mat: 'mail', build: 'gaunt' },
    belt: { col: '#2a2018', buckle: '#e8e0cc' },
    sculpt(X, J) {
      // A whale's rib for a pauldron.
      X.in(HG.armor, 1);
      X.limb([[J.shF.x - 4, J.shF.y - 1, 1.4, 12], [J.shF.x, J.shF.y - 3.5, 1.4, 12], [J.shF.x + 4, J.shF.y - 1, 1.1, 12]], '#f0e8d8', 'bone');
      X.ball(J.chest.x, J.chest.y + 1, 3, 3.4, '#e8e0cc', 'bone', { z: 14, rz: 2 });
    },
    head: {
      kind: 'skull', r: 5.4, col: '#e8e0cc',
      extra: wearing({ kind: 'helm', col: '#e8e0cc', mat: 'bone', spikes: '#f0e8d8', spikeMat: 'bone' }),
      paint(P, c) {
        for (const x of [c.x - 3, c.x + 1]) P.rect(x - 1, c.y - 1, 3, 3, '#0a0610');
        for (let i = 0; i < 5; i++) P.set(c.x - 3.5 + i, c.y + 5, hex(i % 2 ? '#2a2020' : '#f0e8d8'));
      },
      glow(P, c) {
        eyes(P, [[c.x - 3, c.y], [c.x + 1, c.y]], '#80c8e0', { big: true });
      },
    },
    cape: { col: '#4a5a60', mat: 'cloth', ragged: true, w: 28, h: 38 },
    arm: { col: '#e8e0cc', bone: true, r: 3.6, gauntlet: '#5a6a70', L1: 8.6, L2: 8.4, wang: 0.85 },
    weapon: { kind: 'hammer', len: 19, col: '#e8e0cc', mat: 'bone', grip: '#5a4430' },
    fist: { col: '#5a6a70', r: 2.6 },
    armF: { col: '#e8e0cc', bone: true, r: 3.4, gauntlet: '#5a6a70' },
  }),

  // The Whale Priest: priest of the drowned whale-god, robed in sea-blue
  // ragged to the hem, a whale's skull for a mask over his white hood, its
  // sockets lit from inside; his censer of whale-oil smoking; brine always
  // running off him.
  whale_priest: figure({
    stance: { h: 1.04, w: 1 },
    robe: { col: '#2a4a5a', ragged: true, trim: '#e8e0cc', trimMat: 'bone', flare: 1.15 },
    torso: { col: '#2a4a5a', mat: 'cloth', build: 'lean' },
    belt: { col: '#1a2a30', buckle: '#e8e0cc' },
    head: {
      kind: 'hood', r: 5.6, col: '#e8e0cc',
      extra(X, c, r) {
        // The whale's skull over his face: its long snout, its brow.
        X.in(HG.head, 1);
        X.ball(c.x - r * 0.25, c.y + r * 0.1, r * 0.85, r * 0.78, '#f0e8d8', 'bone', { z: 18, rz: 2.4 });
        X.limb([[c.x - r * 0.5, c.y + r * 0.4, r * 0.55, 18.5], [c.x - r * 1.6, c.y + r * 0.7, r * 0.35, 18.5]], '#e8e0cc', 'bone');
      },
      paint(P, c, r) {
        for (const dx of [-0.6, 0]) P.rect(Math.round(c.x + dx * r) - 1, Math.round(c.y - r * 0.1), 2, 2, '#0a1018');
      },
      glow(P, c, r) {
        for (const dx of [-0.6, 0]) P.fx(Math.round(c.x + dx * r), Math.round(c.y - r * 0.1) + 1, '#80d8ff', 1);
        glow(P, c.x - r * 0.3, c.y, 3, '#80d8ff', 0.3);
      },
    },
    arm: { col: '#a8b8c0', r: 3, sleeve: '#2a4a5a', L1: 8.6, L2: 8, wang: 2.9 },
    weapon: { kind: 'censer', len: 9, col: '#e8e0cc', mat: 'bone', glow: '#80d8ff' },
    fist: { col: '#a8b8c0', mat: 'skin', r: 2.3 },
    armF: { col: '#a8b8c0', r: 3, sleeve: '#2a4a5a' },
    fx(R, ctx, pose) {
      const t = R.r.time;
      inPose(R, ctx, pose, () => {
        drops(ctx, R.ox + 18, R.oy + 46, t, [0, 7, 13, 22], { col: '#80c8e8', len: 14, speed: 0.7 });
        const m = onBlade(R, 11.5);
        smoke(ctx, m.x, m.y - 2, t, { n: 4, rise: 14, col: '#a0c0d0', dark: '#7090a0', a: 0.4 });
      });
    },
  }),

  // The Harpoon Queen: queen of the whalers, weathered and hard, in oiled
  // leather and a black tricorn trimmed with gold, a red sash; her harpoon
  // of whalebone and iron, barbed, a line coiled at its butt.
  harpoon_queen: figure({
    stance: { h: 1, w: 1.02 },
    legs: { col: '#24302e', mat: 'leather', r: 4.1, boot: '#1a2220', bootMat: 'leather' },
    torso: { col: '#2a3a3a', mat: 'leather', build: 'lean' },
    belt: { col: '#3a2418', buckle: '#e0c060' },
    sculpt(X, J) {
      X.in(HG.front, 1);
      X.limb([[J.shN.x - 1, J.shN.y + 1, 1.1, 18], [J.chest.x - 1, J.chest.y + 5, 1.1, 18], [J.waist.x - 5, J.pelvis.y + 1, 1.1, 18]], '#a83a2a', 'cloth');
    },
    head: {
      kind: 'man', r: 5.1, col: '#a87a58', hair: '#1a1410', hairStyle: 'long', face: { eye: '#2a2a20', scar: true },
      extra: wearing({ kind: 'tricorn', col: '#1e2426', trim: '#e0c060' }),
    },
    cape: { col: '#3a5a6a', mat: 'cloth', w: 24, h: 30 },
    arm: { col: '#a87a58', r: 3.3, sleeve: '#2a3a3a', sleeveMat: 'leather', L1: 8.6, L2: 8.2, wang: 0.45 },
    weapon: {
      kind: 'spear', len: 26, col: '#c8c8d0', grip: '#e8e0cc',
      head(X, at, z) {
        X.slab([at(25, -1.8), at(25, 1.8), at(32, 0)], '#c8c8d0', 'metal', { z: z + 1, rz: 1.2, bevel: 0.8 });
        X.slab([at(26, 1.5), at(23, 4.4), at(28, 1.2)], '#c8c8d0', 'metal', { z: z + 1, rz: 0.8, bevel: 0.6 });
      },
    },
    fist: { col: '#a87a58', mat: 'skin', r: 2.4 },
    armF: { col: '#a87a58', r: 3.2, sleeve: '#2a3a3a', sleeveMat: 'leather' },
  }),

  // ------------------------------------------------------------ Saltmere
  // The Salt Mummy: a lord of the salt-flats preserved in it, wound in
  // wrappings gone stiff and white with it, crystals of salt grown out of
  // him in clusters; the pale blue of his eyes deep in his hood; salt
  // sifting off him.
  salt_mummy: figure({
    stance: { h: 1.02, w: 1, hunch: 2 },
    robe: { col: '#e8e0e4', ragged: true, trim: '#e8a0b8', flare: 0.9 },
    torso: { col: '#e8e0e4', mat: 'cloth', build: 'gaunt' },
    sculpt(X, J) {
      // Wrappings, and salt grown on them.
      X.in(HG.front, 1);
      for (let i = 0; i < 6; i++) X.tube(J.chest.x - 7, J.chest.y - 4 + i * 4, J.chest.x + 6, J.chest.y - 2.5 + i * 4, 0.7, 0.7, '#dcd4d8', 'cloth', { z: 18 });
      for (const [x, y] of [[J.chest.x - 6, J.chest.y + 1], [J.chest.x + 3, J.chest.y + 6], [J.waist.x - 5, J.pelvis.y + 8], [J.waist.x + 4, J.pelvis.y + 16], [J.shN.x - 1, J.shN.y - 1]]) {
        X.tube(x, y, x - 1, y - 3.5, 1.2, 0.3, '#ffffff', 'glass', { z: 19 });
        X.tube(x + 1, y, x + 2.5, y - 2.5, 0.9, 0.2, '#f8e8f0', 'glass', { z: 19 });
      }
    },
    head: {
      kind: 'hood', r: 5.4, col: '#f0e8ec',
      paint(P, c, r) {
        // The wrappings across his face in the hood.
        for (let i = 0; i < 3; i++) for (let x = -4; x <= 1; x++) {
          const px = Math.round(c.x - r * 0.35 + x);
          const py = Math.round(c.y - r * 0.2 + i * 2.4);
          if (P.get(px, py)[3]) P.set(px, py, hex(i % 2 ? '#c8c0c4' : '#e0d8dc'));
        }
      },
      glow: (P, c, r) => eyes(P, [[Math.round(c.x - r * 0.65), Math.round(c.y + r * 0.1)], [Math.round(c.x - r * 0.1), Math.round(c.y + r * 0.1)]], '#a0c8ff'),
    },
    arm: { col: '#dcd4d8', mat: 'cloth', r: 2.8, L1: 8.8, L2: 8.4, wang: 0.4, claw: '#f0e8ec' },
    armF: { col: '#dcd4d8', mat: 'cloth', r: 2.8, claw: '#f0e8ec' },
    fx(R, ctx, pose) {
      const t = R.r.time;
      inPose(R, ctx, pose, () => {
        for (let i = 0; i < 7; i++) {
          const k = (t * 0.5 + i / 7) % 1;
          dot(ctx, R.ox + 16 + ((i * 0.618) % 1) * 32, R.oy + 22 + k * 38, '#ffffff', 0.8 * (1 - k));
        }
      });
    },
  }),

  // The Salt Bride: a bride who walked into the salt sea on her wedding
  // day and came back out of it white all through: her gown and veil, her
  // long hair, her skin; her bouquet of salt flowers; she drifts, and her
  // tears are salt.
  salt_bride: figure({
    stance: { h: 1.04, w: 0.94 },
    robe: { col: '#ffffff', mat: 'velvet', ragged: true, trim: '#a0c8ff', trimMat: 'glass', flare: 1.25 },
    torso: { col: '#f8f4f8', mat: 'velvet', build: 'lean' },
    belt: { col: '#e0e8f8', buckle: '#a0c8ff' },
    head: {
      kind: 'man', r: 5, col: '#f4f0f8', hair: '#ffffff', hairStyle: 'long', face: { eye: '#a0c8ff', white: '#e8f4ff', mouth: 2 },
      extra: wearing({ kind: 'veil', col: '#f0f4ff', trim: '#ffffff', trimMat: 'cloth' }),
      glow: burning('#a0c8ff', 0.25),
    },
    arm: { col: '#f4f0f8', r: 2.7, sleeve: '#ffffff', sleeveMat: 'velvet', L1: 8.6, L2: 8, wang: 0.3 },
    armF: {
      col: '#f4f0f8', r: 2.7, sleeve: '#ffffff', sleeveMat: 'velvet',
      extra(X, { H }) {
        // Her bouquet of salt flowers.
        X.in(4, 1);
        for (let i = 0; i < 6; i++) X.ball(H.x - 1 + Math.cos(i * 1.2) * 2, H.y - 2 + Math.sin(i * 1.2) * 2, 1.4, 1.4, i % 2 ? '#ffffff' : '#f8d8e8', 'glass', { z: 12, rz: 1.2 });
        X.limb([[H.x, H.y, 0.6, 11], [H.x + 1, H.y + 5, 0.4, 11]], '#a0b8a0', 'moss');
      },
    },
    fx(R, ctx, pose) {
      const t = R.r.time;
      inPose(R, ctx, pose, () => {
        const k = (t * 0.7) % 1;
        const e = onHead(R, -3.2, 0.5 + k * 7);
        dot(ctx, e.x, e.y, '#e0f0ff', 1 - k * 0.6);
        // Salt-mist off her hem; her shadow, as she drifts.
        for (let i = 0; i < 6; i++) {
          const q = (t * 0.3 + i / 6) % 1;
          puff(ctx, R.ox + 12 + i * 8 + q * 3, R.oy + 59 - q * 4, 2.6, '#ffffff', 0.25 * Math.sin(q * Math.PI));
        }
      });
    },
  }),

  // The Salt Doge: doge of the salt city, in its corno of cloth of gold
  // and a cope of gold velvet, an ermine collar, white beard and hair; the
  // sabre of the doges; gold glinting on him.
  salt_doge: figure({
    stance: { h: 1, w: 1.08 },
    robe: { col: '#c8a030', mat: 'velvet', trim: '#ffffff', trimMat: 'fur', front: '#e0b040', flare: 1.1 },
    torso: { col: '#e0b040', mat: 'velvet', build: 'fat' },
    belt: { col: '#8a6a20', buckle: '#ffffff' },
    sculpt(X, J) {
      // The ermine collar, its black tails.
      X.in(HG.front, 1);
      X.tube(J.shF.x, J.shF.y + 1, J.shN.x, J.shN.y + 1, 2.4, 2.4, '#ffffff', 'fur', { z: 17 });
      for (let i = 0; i < 5; i++) X.ball(J.shF.x + 2 + i * 4, J.shF.y + 1.6, 0.6, 0.8, '#1a1a1a', 'fur', { z: 19.4, rz: 0.4 });
    },
    head: {
      kind: 'man', r: 5.2, col: '#d8b090', hair: '#e8e0d8', hairStyle: 'short', beard: '#e8e0d8', face: { eye: '#3a2a20' },
      extra: wearing({ kind: 'doge', col: '#e0b040', trim: '#ffffff' }),
    },
    cape: { col: '#e0e0e8', mat: 'velvet', w: 30, h: 42, clasp: '#e0b040' },
    arm: { col: '#d8b090', r: 3.2, sleeve: '#e0b040', sleeveMat: 'velvet', L1: 8.6, L2: 8.2, wang: 0.9 },
    weapon: { kind: 'sabre', len: 19, col: '#e0d8c8', guard: '#e0b040' },
    fist: { col: '#d8b090', mat: 'skin', r: 2.4 },
    armF: { col: '#d8b090', r: 3.2, sleeve: '#e0b040', sleeveMat: 'velvet' },
    fx(R, ctx, pose) {
      const t = R.r.time;
      inPose(R, ctx, pose, () => {
        for (let i = 0; i < 3; i++) if ((Math.floor(t * 10) + i * 4) % 9 === 0) dot(ctx, R.ox + 24 + i * 6, R.oy + 30 + i * 6, '#ffffff', 1);
      });
    },
  }),

  // The Salt Mother: the salt sea's own, a woman of white crystal in robes
  // of pearl and pink, crowned in salt, crystals grown out of her shoulders
  // and hips; shards of salt going round her.
  salt_mother: figure({
    stance: { h: 1.04, w: 0.98 },
    robe: { col: '#f0e8f0', mat: 'velvet', trim: '#f0a8c8', trimMat: 'glass', flare: 1.15 },
    torso: { col: '#f8f0f4', mat: 'velvet', build: 'lean' },
    belt: { col: '#f0a8c8', buckle: '#ffffff' },
    sculpt(X, J) {
      // Crystals grown out of her, shoulder and hip.
      X.in(HG.front, 1);
      for (const [x, y, a] of [[J.shF.x - 1, J.shF.y - 2, -0.6], [J.shN.x + 1, J.shN.y - 3, 0.5], [J.waist.x - 9, J.pelvis.y + 8, -0.4], [J.waist.x + 9, J.pelvis.y + 10, 0.4]]) {
        X.tube(x, y, x + Math.sin(a) * 6, y - 7, 1.5, 0.3, '#ffffff', 'glass', { z: 19 });
        X.tube(x + 1.4, y, x + 1.4 + Math.sin(a) * 3.5, y - 4.5, 1.1, 0.2, '#f8d0e0', 'glass', { z: 19.4 });
      }
    },
    head: {
      kind: 'man', r: 5, col: '#f8f4f8', mat: 'glass', hair: '#ffffff', hairStyle: 'long', face: { eye: '#f0a8c8', white: '#ffe8f0', mouth: 2 },
      extra: wearing({ kind: 'crown', col: '#ffffff', mat: 'glass', gem: '#f0a8c8', tall: 4.6 }),
      glow: burning('#f0a8c8', 0.3),
    },
    cape: { col: '#ffffff', mat: 'velvet', w: 30, h: 42 },
    arm: { col: '#f8f4f8', mat: 'glass', r: 2.8, sleeve: '#f0e8f0', sleeveMat: 'velvet', L1: 8.6, L2: 8, wang: 0.3 },
    armF: { col: '#f8f4f8', mat: 'glass', r: 2.8, sleeve: '#f0e8f0', sleeveMat: 'velvet' },
    holds: { kind: 'orb', col: '#f8d0e0', r: 2.8 },
    fx(R, ctx, pose) {
      const t = R.r.time;
      inPose(R, ctx, pose, () => {
        motes(ctx, R.ox + 32, R.oy + 34, t * 1.4, { n: 6, rx: 22, ry: 7, col: '#f8c8dc' });
      });
    },
  }),

  // ------------------------------------------------------------ Hollowmark
  // The Root Witch: the witch of the barrow-roots, her skin like old wood,
  // her hair a wild nest with roots growing out of it down her back, a
  // crown of thorns in yellow bloom; robes of moss in rags; her staff of
  // twisted root with an amber light caught in it.
  root_witch: figure({
    stance: { h: 0.98, w: 0.98, hunch: 2 },
    robe: { col: '#4a5a2a', mat: 'moss', ragged: true, trim: '#a0c060', trimMat: 'moss', flare: 1.15 },
    torso: { col: '#4a5a2a', mat: 'cloth', build: 'gaunt' },
    head: {
      kind: 'man', r: 5, col: '#9a8a6a', mat: 'bark', hair: '#5a4a2a', hairStyle: 'wild', face: { eye: '#ffd070', white: '#fff0b0', teeth: true },
      extra: wearing({ kind: 'thorns', col: '#5a4430', flowers: '#ffd070' }, (X, c, r) => {
        for (let i = 0; i < 4; i++) X.limb([[c.x + r * 0.6 + i, c.y - r * 0.3, 0.9, 12], [c.x + r * 1.2 + i * 1.6, c.y + r * 1.5, 0.7, 12], [c.x + r * 1.1 + i * 2, c.y + r * 3.2, 0.4, 12]], '#5a4430', 'bark');
      }),
      glow: burning('#ffd070', 0.3),
    },
    arm: { col: '#9a8a6a', mat: 'bark', r: 2.8, L1: 8.6, L2: 8, wang: 0.2, claw: '#5a4430' },
    weapon: staffOf(28, (X, at, z) => {
      X.ball(...at(29), 2.6, 3, '#ffd070', 'glass', { z: z + 1, rz: 2, glow: '#ffd070', glowK: 0.7 });
      for (let i = 0; i < 3; i++) X.tube(...at(26, (i - 1) * 2), ...at(33, (i - 1) * 3.4), 0.6, 0.2, '#5a4430', 'bark', { z: z + 2 });
    }),
    fist: { col: '#9a8a6a', mat: 'bark', r: 2.2 },
    armF: { col: '#9a8a6a', mat: 'bark', r: 2.8, claw: '#5a4430' },
    fx(R, ctx, pose) {
      const t = R.r.time;
      inPose(R, ctx, pose, () => {
        const p = onBlade(R, 29);
        glowAt(ctx, p.x, p.y, 7, '#ffd070', 0.3 + 0.1 * Math.sin(t * 4));
        motes(ctx, p.x, p.y, t * 2, { n: 3, rx: 5, ry: 3, col: '#ffd070', trail: 2 });
      });
    },
  }),

  // The Lamplighter: who lit the lamps of the dead town's streets, and lights
  // them still: tall and thin in a long black coat, a tricorn; his lantern
  // swinging, burning; his long pole over his shoulder with its snuffer.
  lamplighter: figure({
    stance: { h: 1.08, w: 0.92 },
    legs: { col: '#1e1a24', mat: 'cloth', r: 3.6, boot: '#141018', bootMat: 'leather' },
    torso: { col: '#2a2430', mat: 'cloth', build: 'gaunt' },
    belt: { col: '#141018', buckle: '#ffd070' },
    sculpt(X, J) {
      // His long coat's skirts.
      X.in(HG.skirt, 1);
      X.slab([[J.waist.x - 7, J.waist.y], [J.waist.x + 7, J.waist.y], [J.waist.x + 9, J.pelvis.y + 16], [J.waist.x - 9, J.pelvis.y + 16]], '#2a2430', 'cloth', { z: 8, rz: 2, bevel: 1.6 });
    },
    head: {
      kind: 'man', r: 4.8, col: '#c8c0b8', hair: '#2a2420', hairStyle: 'short', face: { eye: '#ffd070', white: '#fff0c0' },
      extra: wearing({ kind: 'tricorn', col: '#1a1620' }),
      glow: burning('#ffd070', 0.2),
    },
    cape: { col: '#1e1a24', mat: 'cloth', ragged: true, w: 24, h: 38 },
    arm: { col: '#c8c0b8', r: 2.8, sleeve: '#2a2430', L1: 9, L2: 8.4, wang: 2.9 },
    weapon: { kind: 'lantern', len: 7, col: '#3a3438', glow: '#ffd070' },
    fist: { col: '#c8c0b8', mat: 'skin', r: 2.2 },
    armF: {
      col: '#c8c0b8', r: 2.8, sleeve: '#2a2430',
      extra(X, { H }) {
        // His pole over his shoulder, the snuffer's cone at its top.
        X.in(0, 1);
        X.tube(H.x, H.y + 4, H.x + 12, H.y - 26, 0.7, 0.6, '#4a3a2a', 'wood', { z: -2 });
        X.slab([[H.x + 10.6, H.y - 26], [H.x + 14, H.y - 25], [H.x + 13, H.y - 29]], '#8a8070', 'metal', { z: -1.6, rz: 1 });
      },
    },
    fx(R, ctx, pose) {
      const t = R.r.time;
      inPose(R, ctx, pose, () => {
        const m = onBlade(R, 9.5);
        glowAt(ctx, m.x, m.y, 8, '#ffd070', 0.3 + 0.08 * Math.sin(t * 7));
        flame(ctx, m.x, m.y + 1, 3, t, { w: 1.5 });
      });
    },
  }),

  // The Burrow Baron: lord of the warrens, round and well fed, in a velvet
  // coat of brown with gold buttons straining over his belly, a red sash, a
  // tricorn trimmed in gold; his mace; crumbs in his beard.
  burrow_baron: figure({
    stance: { h: 0.96, w: 1.16 },
    legs: { col: '#4a3a2a', mat: 'cloth', r: 4.4, boot: '#2a1a12', bootMat: 'leather' },
    torso: { col: '#7a5a2a', mat: 'velvet', build: 'fat', wide: 1.1 },
    belt: { col: '#2a1a12', buckle: '#d8b040' },
    sculpt(X, J) {
      X.in(HG.front, 1);
      for (let i = 0; i < 4; i++) X.ball(J.chest.x - 4, J.chest.y - 1 + i * 3.4, 0.7, 0.7, '#d8b040', 'gold', { z: 19, rz: 0.5 });
      X.limb([[J.shN.x - 1, J.shN.y + 1, 1.3, 18], [J.chest.x, J.chest.y + 5, 1.3, 18], [J.waist.x - 6, J.pelvis.y, 1.3, 18]], '#a83a2a', 'cloth');
    },
    head: {
      kind: 'man', r: 5.4, col: '#c89a74', hair: '#6a4a2a', hairStyle: 'short', beard: '#6a4a2a', face: { eye: '#3a2a20', grin: true },
      extra: wearing({ kind: 'tricorn', col: '#3a2a1a', trim: '#d8b040' }),
    },
    arm: { col: '#c89a74', r: 3.6, sleeve: '#7a5a2a', sleeveMat: 'velvet', L1: 8.4, L2: 8, wang: 0.9 },
    weapon: { kind: 'mace', len: 13, col: '#8a8a98', grip: '#3a2a1a' },
    fist: { col: '#c89a74', mat: 'skin', r: 2.6 },
    armF: { col: '#c89a74', r: 3.4, sleeve: '#7a5a2a', sleeveMat: 'velvet' },
  }),

  // ------------------------------------------------------------ the Wyrd Isle
  // The Raven Queen: queen of the carrion birds, pale as a moon in robes of
  // black, a mantle of raven feathers over her shoulders, a crown of black
  // iron with a violet stone; her ravens going round her.
  raven_queen: figure({
    stance: { h: 1.04, w: 0.96 },
    robe: { col: '#1e1a2a', mat: 'velvet', trim: '#6a5aa0', trimMat: 'glass', flare: 1.15 },
    torso: { col: '#1e1a2a', mat: 'velvet', build: 'lean' },
    sculpt(X, J) {
      // A mantle of raven feathers.
      X.in(HG.front, 1);
      for (let i = 0; i < 8; i++) {
        const x = J.shF.x - 2 + i * 3;
        X.slab([[x - 1.2, J.shF.y - 1], [x + 1.2, J.shF.y - 1], [x + 0.4, J.shF.y + 7 + (i % 2) * 2]], '#22223a', 'feather', { z: 17 + (i % 2) * 0.2, rz: 1, bevel: 0.6 });
      }
    },
    head: {
      kind: 'man', r: 5, col: '#c8c0d8', hair: '#14141e', hairStyle: 'long', face: { eye: '#c8a0ff', white: '#f0e8ff', mouth: 2 },
      extra: wearing({ kind: 'crown', col: '#3a3a4a', mat: 'metal', gem: '#c8a0ff', tall: 4.4 }),
      glow: burning('#c8a0ff', 0.3),
    },
    cape: { col: '#14141e', mat: 'feather', ragged: true, w: 32, h: 42 },
    arm: { col: '#c8c0d8', r: 2.8, sleeve: '#1e1a2a', sleeveMat: 'velvet', L1: 8.6, L2: 8, wang: 0.3, claw: '#14141e' },
    armF: { col: '#c8c0d8', r: 2.8, sleeve: '#1e1a2a', sleeveMat: 'velvet', claw: '#14141e' },
    fx(R, ctx, pose) {
      const t = R.r.time;
      inPose(R, ctx, pose, () => {
        // Her ravens wheeling round her, wings beating.
        for (let i = 0; i < 3; i++) {
          const a = t * 1.2 + (i / 3) * TAU;
          const x = R.ox + 32 + Math.cos(a) * 24;
          const y = R.oy + 10 + Math.sin(a) * 5 + Math.sin(t * 3 + i) * 2;
          const f = Math.sin(t * 14 + i * 2) > 0;
          ctx.globalAlpha = Math.sin(a) < 0 ? 0.7 : 1;
          ctx.fillStyle = '#14141e';
          ctx.fillRect(Math.round(x - 1), Math.round(y), 3, 1);
          ctx.fillRect(Math.round(x - 3), Math.round(y + (f ? -1 : 1)), 2, 1);
          ctx.fillRect(Math.round(x + 2), Math.round(y + (f ? -1 : 1)), 2, 1);
        }
        ctx.globalAlpha = 1;
      });
    },
  }),

  // The Antlered One: the hunter the wood made its own, antlers grown out
  // of his head, his skin brown as bark, a pelt over his shoulders, leather
  // and fur; his spear; his horn at his belt.
  antlered_one: figure({
    stance: { h: 1.06, w: 1.08 },
    legs: { col: '#3a2a1a', mat: 'fur', r: 4.2, boot: '#2a1a12', bootMat: 'leather' },
    torso: { col: '#4a5a3a', mat: 'leather', build: 'muscle' },
    belt: { col: '#2a1a12', buckle: '#e0d8c0' },
    sculpt(X, J) {
      // A pelt over the shoulders, and a horn at his belt.
      X.in(HG.front, 1);
      X.limb([[J.shF.x, J.shF.y - 1, 2.8, 16], [J.chest.x, J.chest.y - 3, 3, 16], [J.shN.x, J.shN.y - 1, 2.8, 16]], '#7a6a4a', 'fur');
      X.limb([[J.waist.x - 5, J.waist.y + 2, 0.8, 19], [J.waist.x - 3, J.pelvis.y + 3, 1.2, 19], [J.waist.x - 4, J.pelvis.y + 6, 1.6, 19]], '#e0d8c0', 'bone');
    },
    head: {
      kind: 'man', r: 5.2, col: '#8a7a5a', hair: '#3a2a1a', hairStyle: 'wild', face: { eye: '#a0ff80', white: '#e0ffc0' },
      extra: wearing({ kind: 'antlers', col: '#e0d8c0' }),
      glow: burning('#a0ff80', 0.3),
    },
    cape: { col: '#6a5a3a', mat: 'fur', ragged: true, w: 28, h: 36 },
    arm: { col: '#8a7a5a', r: 3.8, L1: 8.8, L2: 8.4, wang: 0.3 },
    weapon: { kind: 'spear', len: 28, col: '#b0b8a0', grip: '#5a4430' },
    fist: { col: '#8a7a5a', mat: 'skin', r: 2.6 },
    armF: { col: '#8a7a5a', r: 3.6 },
  }),

  // The Rune Witch: who keeps the old stones' runes, deep in her hood of
  // night, her long grey hair; her staff of runestone, a rune cut in it
  // that burns; runes turning round her.
  rune_witch: figure({
    stance: { h: 1.02, w: 0.96, hunch: 1 },
    robe: { col: '#3a3a5a', trim: '#80e8ff', trimMat: 'glass', flare: 1.1 },
    torso: { col: '#3a3a5a', mat: 'cloth', build: 'lean' },
    belt: { col: '#2a2a40', buckle: '#80e8ff' },
    head: {
      kind: 'hood', r: 5.6, col: '#2a2a40',
      glow: (P, c, r) => {
        eyes(P, [[Math.round(c.x - r * 0.65), Math.round(c.y + r * 0.1)], [Math.round(c.x - r * 0.1), Math.round(c.y + r * 0.1)]], '#80e8ff');
        glow(P, c.x - r * 0.35, c.y + r * 0.2, 3, '#80e8ff', 0.3);
      },
    },
    arm: { col: '#c8c0b8', r: 2.8, sleeve: '#3a3a5a', L1: 8.6, L2: 8, wang: 0.2 },
    weapon: staffOf(28, (X, at, z) => {
      X.ball(...at(30), 2.4, 3.6, '#8a8a86', 'rock', { z: z + 1, rz: 2 });
    }),
    fist: { col: '#c8c0b8', mat: 'skin', r: 2.2 },
    armF: { col: '#c8c0b8', r: 2.8, sleeve: '#3a3a5a' },
    fx(R, ctx, pose) {
      const t = R.r.time;
      inPose(R, ctx, pose, () => {
        // The rune on her staff; runes going round her.
        const p = onBlade(R, 30);
        for (const [dx, dy] of [[-1, -2], [0, -1], [1, 0], [0, 1], [-1, 2], [1, -2], [-1, 0]]) dot(ctx, p.x + dx, p.y + dy, '#80e8ff', 1);
        glowAt(ctx, p.x, p.y, 5, '#80e8ff', 0.3);
        for (let i = 0; i < 5; i++) {
          const a = t * 1.2 + (i / 5) * TAU;
          const x = R.ox + 32 + Math.cos(a) * 22;
          const y = R.oy + 40 + Math.sin(a) * 6;
          const back = Math.sin(a) < 0;
          const c = back ? '#3a8aa0' : '#80e8ff';
          dot(ctx, x, y - 1, c, 1, 1, 3);
          dot(ctx, x - 1, y - 1 + (i % 3), c, 1);
          dot(ctx, x + 1, y + (i % 2), c, 1);
        }
      });
    },
  }),

  // The Fey Reaver: a knight of the hollow hills, beautiful and cruel, in
  // armour of moon-silver over green, antlers of silver grown out of his
  // brow, his long pale hair; a ragged cape of the fey's mint-green light;
  // his sabre of moonlight; motes of fey-light off him.
  fey_reaver: figure({
    stance: { h: 1.06, w: 1.04 },
    legs: { col: '#2a4a3a', mat: 'cloth', r: 4, greave: '#a8b0c0', boot: '#1e3a2a', bootMat: 'metal' },
    torso: { col: '#3a5a4a', mat: 'cloth', build: 'lean' },
    plate: { col: '#c8d0e0', skirt: '#2a4a3a', skirtMat: 'cloth', trim: '#80ffd0', emblem: '#c8a0ff', emblemMat: 'glass' },
    belt: { col: '#1e3a2a', buckle: '#80ffd0' },
    pauldronF: { col: '#c8d0e0', r: 5, trim: '#80ffd0' },
    head: {
      kind: 'man', r: 5, col: '#e0e8f0', hair: '#c8e0d0', hairStyle: 'long', face: { eye: '#c8a0ff', white: '#f0e8ff', mouth: 2 },
      extra: wearing({ kind: 'antlers', col: '#e0e8f0', mat: 'metal' }),
      glow: burning('#c8a0ff', 0.3),
    },
    cape: { col: '#80ffd0', mat: 'velvet', ragged: true, w: 30, h: 40 },
    arm: { col: '#e0e8f0', r: 3.2, gauntlet: '#c8d0e0', L1: 8.8, L2: 8.4, wang: 0.9, pauldron: { col: '#c8d0e0', r: 5.4, trim: '#80ffd0' } },
    weapon: {
      kind: 'sabre', len: 22, col: '#e0f8ff', guard: '#80ffd0', guardMat: 'glass',
      glow(P, { H, wang }) {
        for (let d = 5; d < 22; d += 2) {
          const a = along(H, wang, d, ((d - 3) / 19) ** 2 * 4.5 - 1.4);
          P.fx(a.x, a.y, '#c8fff0', 0.7);
        }
      },
    },
    fist: { col: '#c8d0e0', r: 2.4 },
    armF: { col: '#e0e8f0', r: 3, gauntlet: '#c8d0e0' },
    fx(R, ctx, pose) {
      const t = R.r.time;
      inPose(R, ctx, pose, () => {
        for (let i = 0; i < 6; i++) {
          const k = (t * 0.5 + i / 6) % 1;
          dot(ctx, R.ox + 16 + ((i * 0.618) % 1) * 32 + Math.sin(k * 6 + i) * 3, R.oy + 50 - k * 44, i % 2 ? '#c8a0ff' : '#80ffd0', 0.9 * (1 - k));
        }
      });
    },
  }),

  // The Fair King: king of the hollow hills, terrible in his beauty: armour
  // of silver over robes of violet, a cloak of the mint-green fey-light, a
  // crown of moon-silver set with a green stone, golden hair to his
  // shoulders; his greatsword with violet fire in it; the fey-lights going
  // round him.
  fair_king: figure({
    stance: { h: 1.08, w: 1.06 },
    robe: { col: '#4a2a6a', mat: 'velvet', trim: '#ffe080', flare: 1.05 },
    torso: { col: '#c8d0e0', mat: 'metal', build: 'muscle' },
    plate: { col: '#c8d0e0', skirt: '#4a2a6a', skirtMat: 'velvet', trim: '#ffe080', emblem: '#80ffd0', emblemMat: 'glass' },
    belt: { col: '#3a1a4a', buckle: '#ffe080' },
    pauldronF: { col: '#c8d0e0', r: 5.4, trim: '#ffe080' },
    head: {
      kind: 'man', r: 5.1, col: '#f0f4f8', hair: '#f0e8c0', hairStyle: 'long', face: { eye: '#ffe080', white: '#fffbe0', mouth: 2 },
      extra: wearing({ kind: 'crown', col: '#e0e8f0', mat: 'metal', gem: '#80ffd0', tall: 4.8, n: 7 }),
      glow: burning('#ffe080', 0.3),
    },
    cape: { col: '#80ffd0', mat: 'velvet', w: 32, h: 44, clasp: '#ffe080', lining: '#4a2a6a' },
    arm: { col: '#f0f4f8', r: 3.4, gauntlet: '#c8d0e0', L1: 8.8, L2: 8.4, wang: 0.95, pauldron: { col: '#c8d0e0', r: 5.8, trim: '#ffe080' } },
    weapon: {
      kind: 'greatsword', len: 31, width: 2.8, col: '#e0f0ff', guard: '#ffe080', pommel: '#80ffd0',
      glow(P, { H, wang }) {
        for (let i = 0; i < 5; i++) {
          const a = along(H, wang, 7 + i * 4.6);
          const b = along(H, wang, 9 + i * 4.6, i % 2 ? 0.9 : -0.9);
          glowLine(P, a.x, a.y, b.x, b.y, '#c8a0ff', 0.9);
        }
      },
    },
    fist: { col: '#c8d0e0', r: 2.6 },
    armF: { col: '#f0f4f8', r: 3.2, gauntlet: '#c8d0e0' },
    fx(R, ctx, pose) {
      const t = R.r.time;
      inPose(R, ctx, pose, () => {
        motes(ctx, R.ox + 32, R.oy + 32, t * 0.9, { n: 6, rx: 24, ry: 22, col: '#c8a0ff' });
        motes(ctx, R.ox + 32, R.oy + 32, -t * 0.7, { n: 4, rx: 20, ry: 18, col: '#ffe080' });
      });
    },
  }),

  // ------------------------------------------------------------ the Grey Skerries
  // The Trow King: king of the trows under the skerries, squat and
  // hunched and grey-green, a great nose, wild hair and a beard to his
  // belt, a crown of tarnished gold with a sea-green stone, leathers; his
  // hammer of stone.
  trow_king: figure({
    stance: { h: 0.94, w: 1.18, hunch: 3 },
    legs: { col: '#3a3a2a', mat: 'leather', r: 4.8, boot: '#2a2a1e', bootMat: 'leather' },
    torso: { col: '#4a4a3a', mat: 'leather', build: 'fat', wide: 1.08 },
    belt: { col: '#2a2018', buckle: '#a08a50' },
    sculpt(X, J) {
      X.in(HG.cape, 1);
      X.ball(J.shN.x - 2, J.shN.y, 6, 5, '#4a4a3a', 'leather', { z: -1, rz: 3 });
    },
    head: {
      kind: 'man', r: 5.6, col: '#7a8a6a', hair: '#3a3a2a', hairStyle: 'wild', beard: '#3a3a2a', beardLong: true, face: { eye: '#ffd070', white: '#ffe8a0', teeth: true },
      extra: wearing({ kind: 'crown', col: '#a08a50', gem: '#80c080', tall: 3 }, (X, c, r) => {
        X.ball(c.x - r * 1.2, c.y + r * 0.25, r * 0.42, r * 0.36, '#7a8a6a', 'skin', { z: 18, rz: 1.2 });
      }),
      glow: burning('#ffd070', 0.25),
    },
    cape: { col: '#5a5a4a', mat: 'cloth', ragged: true, w: 28, h: 32 },
    arm: { col: '#7a8a6a', r: 4.2, L1: 8.6, L2: 8.2, wang: 0.85 },
    weapon: { kind: 'hammer', len: 18, col: '#8a8a86', mat: 'rock', grip: '#4a3a2a' },
    fist: { col: '#7a8a6a', mat: 'skin', r: 3 },
    armF: { col: '#7a8a6a', r: 4 },
  }),

  // The Finnman: a sea-sorcerer of the old people of the skerries, in a
  // hood and oiled leathers, weed hanging off him; the oar he rows his
  // skin-boat with, his staff; the sea running off him.
  finnman: figure({
    stance: { h: 1.02, w: 1 },
    legs: { col: '#24302e', mat: 'leather', r: 4, boot: '#1a2220', bootMat: 'leather' },
    torso: { col: '#2a3a40', mat: 'leather', build: 'lean' },
    belt: { col: '#1a2220', buckle: '#80e8ff' },
    sculpt(X, J) {
      X.in(HG.front, 1);
      for (let i = 0; i < 3; i++) X.limb([[J.chest.x - 6 + i * 5, J.chest.y + 1, 0.7, 18], [J.chest.x - 7 + i * 5, J.waist.y + 4, 0.6, 18], [J.chest.x - 6 + i * 5, J.pelvis.y + 6, 0.4, 18]], '#3a6a4a', 'moss');
    },
    head: {
      kind: 'hood', r: 5.4, col: '#2a3a40', hoodMat: 'leather',
      glow: (P, c, r) => eyes(P, [[Math.round(c.x - r * 0.65), Math.round(c.y + r * 0.1)], [Math.round(c.x - r * 0.1), Math.round(c.y + r * 0.1)]], '#80e8ff'),
    },
    cape: { col: '#3a5a5a', mat: 'leather', ragged: true, w: 26, h: 36 },
    arm: { col: '#8aa0a8', r: 3, sleeve: '#2a3a40', sleeveMat: 'leather', L1: 8.6, L2: 8, wang: 0.2 },
    weapon: staffOf(26, (X, at, z) => {
      X.slab([at(24, -2), at(24, 2), at(34, 2.6), at(36, 0), at(34, -2.6)], '#6a5a44', 'wood', { z: z + 1, rz: 1, bevel: 0.8 });
    }),
    fist: { col: '#8aa0a8', mat: 'skin', r: 2.3 },
    armF: { col: '#8aa0a8', r: 3, sleeve: '#2a3a40', sleeveMat: 'leather' },
    fx(R, ctx, pose) {
      const t = R.r.time;
      inPose(R, ctx, pose, () => {
        drops(ctx, R.ox + 20, R.oy + 40, t, [0, 6, 11, 19, 24], { col: '#80c8e8', len: 18, speed: 0.6 });
      });
    },
  }),

  // The Selkie Widow: a selkie whose husband hid her skin, and drowned; in
  // mourning greys, veiled, her long black hair, her sealskin grey and
  // spotted half off her shoulders; her tears.
  selkie_widow: figure({
    stance: { h: 1.03, w: 0.94 },
    robe: { col: '#5a6a7a', mat: 'velvet', trim: '#e0f8ff', trimMat: 'glass', flare: 1.1 },
    torso: { col: '#5a6a7a', mat: 'velvet', build: 'lean' },
    sculpt(X, J) {
      // Her sealskin.
      X.in(HG.front, 1);
      X.limb([[J.shF.x, J.shF.y, 2.6, 17], [J.chest.x - 2, J.waist.y + 2, 3, 17], [J.waist.x + 6, J.pelvis.y + 8, 2.6, 17]], '#8a9aa8', 'fur');
      for (const [x, y] of [[J.chest.x - 4, J.chest.y + 4], [J.chest.x - 1, J.waist.y + 2], [J.waist.x + 3, J.pelvis.y + 5]]) X.ball(x, y, 1, 0.8, '#4a5a68', 'fur', { z: 19.4, rz: 0.6 });
    },
    head: {
      kind: 'man', r: 5, col: '#d8d0c8', hair: '#1a1a1e', hairStyle: 'long', face: { eye: '#3a4a5a', white: '#e8f0f8', mouth: 2 },
      extra: wearing({ kind: 'veil', col: '#6a7a8a' }),
    },
    cape: { col: '#7a8a9a', mat: 'velvet', w: 28, h: 40 },
    arm: { col: '#d8d0c8', r: 2.7, sleeve: '#5a6a7a', sleeveMat: 'velvet', L1: 8.6, L2: 8, wang: 0.3 },
    armF: { col: '#d8d0c8', r: 2.7, sleeve: '#5a6a7a', sleeveMat: 'velvet' },
    fx(R, ctx, pose) {
      const t = R.r.time;
      inPose(R, ctx, pose, () => {
        for (let i = 0; i < 2; i++) {
          const k = (t * 0.7 + i / 2) % 1;
          const e = onHead(R, -3.2 + i * 2.6, 0.5 + k * 7);
          dot(ctx, e.x, e.y, '#c8e8ff', 1 - k * 0.6);
        }
      });
    },
  }),

  // The Wrecker: who hangs false lights on the rocks to bring ships onto
  // them, and takes what comes ashore: a hard man in black oilskins and a
  // tricorn, a cutlass at his hip; his lantern held high, its false light.
  the_wrecker: figure({
    stance: { h: 1.02, w: 1.1 },
    legs: { col: '#24282c', mat: 'leather', r: 4.3, boot: '#1a1c1e', bootMat: 'leather' },
    torso: { col: '#2a2e34', mat: 'leather', build: 'muscle' },
    belt: { col: '#2a1a12', buckle: '#c8a040' },
    sculpt(X, J) {
      // The cutlass at his hip.
      X.in(HG.front, 1);
      X.limb([[J.waist.x - 3, J.waist.y + 2, 0.8, 19], [J.waist.x - 9, J.pelvis.y + 10, 0.7, 19]], '#a8a8b0', 'metal');
      X.ball(J.waist.x - 2.6, J.waist.y + 1.4, 1.4, 1.2, '#c8a040', 'gold', { z: 19.4, rz: 1 });
    },
    head: {
      kind: 'man', r: 5.2, col: '#b08868', hair: '#2a2420', hairStyle: 'short', beard: '#2a2420', face: { eye: '#2a2420', scar: true, grin: true },
      extra: wearing({ kind: 'tricorn', col: '#1a1e22' }),
    },
    cape: { col: '#1e2226', mat: 'leather', ragged: true, w: 26, h: 36 },
    arm: { col: '#b08868', r: 3.6, sleeve: '#2a2e34', sleeveMat: 'leather', L1: 8.6, L2: 8.2, wang: 2.9 },
    weapon: { kind: 'lantern', len: 7, col: '#3a3a40', glow: '#ffb040' },
    fist: { col: '#b08868', mat: 'skin', r: 2.5 },
    armF: { col: '#b08868', r: 3.4, sleeve: '#2a2e34', sleeveMat: 'leather' },
    fx(R, ctx, pose) {
      const t = R.r.time;
      inPose(R, ctx, pose, () => {
        const m = onBlade(R, 9.5);
        glowAt(ctx, m.x, m.y, 10, '#ffd070', 0.3 + 0.1 * Math.sin(t * 6));
        flame(ctx, m.x, m.y + 1, 3, t, { w: 1.5 });
      });
    },
  }),

  // The Beacon Keeper: the old keeper of the skerry light, who let a ship
  // die on the rocks and keeps the light still, forever: hooded, his long
  // white beard, oiled leathers; his pole with the beacon's lamp on it,
  // its beam going round.
  beacon_keeper: figure({
    stance: { h: 1.02, w: 1, hunch: 2 },
    legs: { col: '#2a3440', mat: 'leather', r: 4, boot: '#1e2428', bootMat: 'leather' },
    torso: { col: '#3a4a5a', mat: 'leather', build: 'lean' },
    belt: { col: '#1e2428', buckle: '#ffe8a0' },
    head: {
      kind: 'hood', r: 5.6, col: '#3a4a5a', hoodMat: 'leather',
      extra(X, c, r) {
        // His beard out of the hood.
        X.in(HG.head, 1);
        X.limb([[c.x - r * 0.4, c.y + r * 0.7, r * 0.6, 17], [c.x - r * 0.3, c.y + r * 2.3, r * 0.25, 17]], '#c8c8c8', 'hair');
      },
      glow: (P, c, r) => eyes(P, [[Math.round(c.x - r * 0.65), Math.round(c.y)], [Math.round(c.x - r * 0.1), Math.round(c.y)]], '#ffe8a0'),
    },
    cape: { col: '#4a5a6a', mat: 'leather', ragged: true, w: 28, h: 36 },
    arm: { col: '#a8b0b8', r: 3, sleeve: '#3a4a5a', sleeveMat: 'leather', L1: 8.6, L2: 8, wang: 0.15 },
    weapon: staffOf(28, (X, at, z) => {
      X.slab([at(26, -3), at(26, 3), at(33, 2.4), at(33, -2.4)], '#3a3a40', 'metal', { z: z + 1, rz: 2, bevel: 0.8 });
      X.ball(...at(29.5), 1.8, 2.4, '#fff0b0', 'glass', { z: z + 2.6, rz: 1.2, glow: '#ffd070', glowK: 0.9 });
    }),
    fist: { col: '#a8b0b8', mat: 'skin', r: 2.3 },
    armF: { col: '#a8b0b8', r: 3, sleeve: '#3a4a5a', sleeveMat: 'leather' },
    fx(R, ctx, pose) {
      const t = R.r.time;
      inPose(R, ctx, pose, () => {
        const p = onBlade(R, 29.5);
        glowAt(ctx, p.x, p.y, 7, '#ffd070', 0.4);
        // The beam, turning.
        const a = t * 1.6;
        for (let k = 3; k < 22; k++) dot(ctx, p.x + Math.cos(a) * k, p.y + Math.sin(a) * k * 0.35, '#fff0b0', 0.5 * (1 - k / 22), 1, k > 12 ? 2 : 1);
      });
    },
  }),
});
