// (Round 71) The masters of the Dagoni Islands' old places, forged anew
// (see forge.js, forgekit.js).
import { forge, tone } from './forge.js';
import { stance, legs, torso, breastplate, belt, pauldron, head, eyes, glow, glowLine, rivets, armPart, farArmPart, capePart, weaponPart, along, dk, lt, HG, figure, ribs, crease } from './forgekit.js';
import { hex, mix, shade } from './pixel.js';
import { strands } from './forgekit.js';
import { hash2 } from './paint.js';
const strandsOf = (P, m) => strands(P, m, { len: 3, density: 0.14 });

const TAU = Math.PI * 2;

// A head as a part: its hinge at the neck (`py` from its top), drawn with
// `head` (see forgekit) at its middle.
function headPart(o) {
  const w = o.w ?? 24;
  const h = o.h ?? 26;
  const cx = w / 2;
  const cy = o.cy ?? 12;
  return {
    w, h, px: cx + (o.pivotDx ?? 1), py: o.py ?? h - 4, role: 'head', layer: 'front', z: o.z ?? 3, at: o.at,
    body(X) {
      head(X, { x: cx, y: cy }, o.head);
      if (o.extra) o.extra(X, { x: cx, y: cy });
    },
    paint(P) {
      if (o.paint) o.paint(P, { x: cx, y: cy });
    },
    glow(P) {
      if (o.glow) o.glow(P, { x: cx, y: cy });
    },
  };
}

const KING_ARM = armPart({
  col: '#d8d0b8', bone: true, r: 3.6, gauntlet: '#5c6676', L1: 8.6, L2: 8.4, wang: 0.95, split: true,
  pauldron: { col: '#5c6676', r: 6, spikes: 3, spikeLen: 3.8, trim: '#b89040' },
  weapon: { kind: 'greatsword', len: 31 },
});

// Wisps going round (an arc of little lights, fading behind).
function wisps(ctx, x, y, t, n, rx, ry, col, speed = 1) {
  for (let i = 0; i < n; i++) {
    const a = t * speed + (i / n) * TAU;
    for (let k = 0; k < 4; k++) {
      const b = a - k * 0.12;
      ctx.globalAlpha = (0.85 - k * 0.2) * (Math.sin(b) > -0.2 ? 1 : 0.5);
      ctx.fillStyle = k ? col : '#ffffff';
      ctx.fillRect(Math.round(x + Math.cos(b) * rx), Math.round(y + Math.sin(b) * ry), k ? 1 : 2, k ? 1 : 2);
    }
  }
  ctx.globalAlpha = 1;
}
// Drops falling off it, now and then.
function drips(ctx, x, y, t, xs, col, len = 14) {
  xs.forEach((dx, i) => {
    const k = (t * 0.9 + i * 0.37) % 1;
    ctx.globalAlpha = 0.8 * (1 - k);
    ctx.fillStyle = col;
    ctx.fillRect(Math.round(x + dx), Math.round(y + k * len), 1, 2);
  });
  ctx.globalAlpha = 1;
}

forge({
  // ------------------------------------------------------------ barrows
  // The Barrow King: a dead king who would not lie down. Gaunt in his old
  // war-gear, iron gone the blue-grey of a winter sky and trimmed in
  // tarnished gold; a cape of drowned teal in rags; his crown of iron
  // spikes set with ice; a skull's face, the cold burning in its sockets,
  // his breath a frost. The greatsword he was buried with, runes of frost
  // down its blade.
  barrow_king: {
    size: 64,
    joints: (J) => stance(J, { w: 1.02 }),
    walk: true,
    body(X, J) {
      legs(X, J, { col: '#30343e', mat: 'mail', r: 4, greave: '#5c6676', thigh: '#4e5866', boot: '#3a3e4a', bootMat: 'metal' });
      torso(X, J, { col: '#2a2e38', mat: 'cloth', build: 'gaunt' });
      breastplate(X, J, { col: '#5c6676', skirt: '#4a5260', trim: '#b89040', emblem: '#9ee8ff', emblemMat: 'glass' });
      belt(X, J, { col: '#3a2a20', buckle: '#b89040' });
      X.in(HG.armor, 1);
      pauldron(X, J.shF, { col: '#5c6676', r: 5.4, z: 11, spikes: 2, spikeLen: 3, trim: '#b89040' });
      // A gorget of mail at the throat.
      X.ball(J.neck.x + 0.5, J.neck.y + 1.5, 4.6, 2.6, '#4a5260', 'mail', { z: 13, rz: 2 });
    },
    paint(P, J) {
      // Gold trim along the plate's edges, rivets down its middle, frost
      // creeping over it.
      const c = J.chest;
      const gold = hex('#c8a040');
      for (let i = 0; i < 8; i++) P.set(Math.round(c.x - 9 + i * 0.9), Math.round(c.y - 5.5 - i * 0.35), mix(gold, [255, 240, 180], i % 3 ? 0 : 0.4));
      for (let i = 0; i < 8; i++) P.set(Math.round(c.x + 3 + i * 0.9), Math.round(c.y - 8 + i * 0.3), mix(gold, [255, 240, 180], i % 3 ? 0 : 0.4));
      rivets(P, [[c.x - 7, c.y + 1], [c.x - 6, c.y + 5], [c.x + 7, c.y + 1], [c.x + 6, c.y + 5]], '#d8dce8');
    },
    parts: {
      cape: { ...capePart({ col: '#1c3a46', mat: 'velvet', ragged: true, w: 30, h: 40, lining: '#5a2a3a', clasp: '#c8a040' }), at: (J) => [J.neck.x + 1, J.neck.y] },
      armF: { ...farArmPart({ bone: true, col: '#d8d0b8', r: 3.4, gauntlet: '#5c6676', L1: 8.5, L2: 8 }), at: (J) => [J.shF.x + 1, J.shF.y + 1] },
      head: headPart({
        at: (J) => [J.neck.x, J.neck.y + 1],
        head: { kind: 'skull', r: 5.6, col: '#d8d0b8', crown: { col: '#6a7080', mat: 'metal', n: 5, tall: 4.4, gem: '#9ee8ff' } },
        extra(X, c) {
          // His beard of frost.
          X.in(HG.head, 1);
          X.limb([[c.x - 2.5, c.y + 5.8, 2.2, 15], [c.x - 2, c.y + 9.5, 1, 15]], '#c8e8f4', 'hair');
        },
        paint(P, c) {
          // The brow heavy over sockets deep and slanted, the nose's hollow,
          // the teeth bared.
          for (const [x, y, s] of [[c.x - 3, c.y, -1], [c.x + 1, c.y, 1]]) {
            P.rect(x - 1, y - 1, 3, 3, '#0a0610');
            P.set(x + s * 2, y - 1, hex('#0a0610'));
            P.set(x - s, y - 2, hex('#6a6050'));
            P.set(x, y - 2, hex('#6a6050'));
          }
          P.set(c.x - 1, c.y + 3, hex('#1a1018'));
          P.set(c.x - 2, c.y + 3, hex('#1a1018'));
          for (let i = 0; i < 6; i++) P.set(c.x - 4 + i, c.y + 5, hex(i % 2 ? '#e8e0c8' : '#2a2020'));
          for (let i = 0; i < 5; i++) P.set(c.x - 3.5 + i, c.y + 6, hex(i % 2 ? '#2a2020' : '#d8d0b8'));
        },
        glow(P, c) {
          eyes(P, [[c.x - 3, c.y], [c.x + 1, c.y]], '#9ee8ff', { big: true });
          glow(P, c.x - 2.5, c.y + 0.5, 2.6, '#9ee8ff', 0.55);
          glow(P, c.x + 1.5, c.y + 0.5, 2.6, '#9ee8ff', 0.55);
        },
      }),
      armN: { ...KING_ARM, at: (J) => [J.shN.x, J.shN.y + 1] },
      blade: weaponPart(KING_ARM, { kind: 'greatsword', len: 31, width: 2.8, col: '#a8b4c4', guard: '#5c6676', guardMat: 'metal', pommel: '#9ee8ff', grip: '#2a2030', gripMat: 'leather' }, {
        fist: { col: '#5c6676', r: 2.8 },
        glow(P, { H, wang }) {
          // Frost runes down the blade.
          for (let i = 0; i < 5; i++) {
            const a = along(H, wang, 7 + i * 4.2);
            const b = along(H, wang, 8.6 + i * 4.2, i % 2 ? 0.9 : -0.9);
            glowLine(P, a.x, a.y, b.x, b.y, '#9ee8ff', 0.85);
          }
        },
      }),
    },
    fx(R, ctx) {
      // Frost breathing off him, settling round his feet.
      const { x, y, r } = R;
      const t = r.time;
      for (let i = 0; i < 10; i++) {
        const s = (t * 0.35 + i * 0.1) % 1;
        const px = x + Math.sin(i * 2.3 + t * 0.6) * (14 + s * 10);
        const py = y - 1 - s * 4;
        ctx.globalAlpha = 0.28 * (1 - s);
        ctx.fillStyle = i % 3 ? '#c8ecff' : '#ffffff';
        ctx.fillRect(Math.round(px), Math.round(py), 3, 1);
      }
      ctx.globalAlpha = 1;
    },
  },

  // The Mound Witch: seven kings' widow, bent double over her staff, its head
  // the skull of a horse with the barrow-light in its sockets; grave-moss on
  // her rags, her hair a nest of grey and black, her hands claws; and her
  // husbands' lights going round her.
  mound_witch: figure({
    stance: { h: 0.94, w: 0.96, hunch: 3 },
    robe: { col: '#2e2c24', ragged: true, trim: '#5a7a34', trimMat: 'moss', flare: 1.1 },
    torso: { col: '#2e2c24', mat: 'cloth', build: 'gaunt' },
    belt: { col: '#3a2a1a' },
    sculpt(X, J) {
      // Grave-moss hanging off her shoulders, bone charms on cords.
      X.in(HG.armor, 1.4);
      X.limb([[J.shF.x, J.shF.y + 1, 2.6, 9], [J.chest.x, J.chest.y - 2, 2.2, 11], [J.shN.x, J.shN.y + 1, 2.6, 9]], '#4a5a2a', 'moss');
      for (let i = 0; i < 3; i++) X.ball(J.chest.x - 4 + i * 4, J.chest.y + 3 + (i % 2) * 2, 1.2, 1.6, '#e0d8c0', 'bone', { z: 13, rz: 1 });
    },
    head: { kind: 'man', r: 5.2, col: '#9aa88a', mat: 'flesh', hair: '#4a4a40', hairLong: true, cy: 14,
      extra(X, c) {
        // Wild hair, standing off her.
        for (let i = 0; i < 6; i++) X.tube(c.x + 1, c.y - 3, c.x + 1 + Math.cos(-2.6 + i * 0.5) * 8, c.y - 3 + Math.sin(-2.6 + i * 0.5) * 7, 1.4, 0.3, i % 2 ? '#3a3a32' : '#6a6a60', 'hair', { z: 13 });
        X.tube(c.x - 4.5, c.y + 1, c.x - 6.5, c.y + 3, 0.9, 0.4, '#8a9878', 'flesh', { z: 17 });
      },
      paint(P, c) {
        P.set(c.x - 3, c.y + 4, hex('#1a1414'));
        P.set(c.x - 2, c.y + 4, hex('#3a2a24'));
      },
      glow(P, c) {
        eyes(P, [[c.x - 3, c.y], [c.x + 1, c.y]], '#a0ff70');
      },
    },
    arm: { col: '#8a9878', mat: 'flesh', r: 2.8, sleeve: '#2e2c24', claw: '#e0d8c0', L1: 8, L2: 8, wang: -0.15 },
    weapon: { kind: 'staff', len: 30, grip: '#4a3a24', butt: 22,
      head(X, at, z) {
        // A horse's skull on the staff's head, a bundle of feathers under.
        X.ball(...at(31, 0), 3, 2.6, '#e8e0cc', 'bone', { z: z + 2, rz: 2.4 });
        X.limb([[...at(31, -1), 2, z + 2], [...at(36, -3), 1.4, z + 2.5]], '#e8e0cc', 'bone');
        for (let i = 0; i < 3; i++) X.tube(...at(28.5, 1), ...at(24, 2.5 + i * 1.2), 0.8, 0.3, i % 2 ? '#2a2a2a' : '#5a5a4a', 'cloth', { z: z + 1 });
      },
      glow(P, { H, wang }) {
        const a = along(H, wang, 31.5, -0.6);
        eyes(P, [[Math.round(a.x), Math.round(a.y)]], '#a0ff70');
        glow(P, a.x, a.y, 2.6, '#a0ff70', 0.6);
      },
    },
    armF: { col: '#8a9878', mat: 'flesh', r: 2.6, sleeve: '#2e2c24', claw: '#e0d8c0', L1: 8, L2: 7.5 },
    holds: { kind: 'orb', col: '#a0ff70', r: 2.6 },
    fx(R, ctx) {
      wisps(ctx, R.x, R.y - 26, R.r.time, 3, 20, 7, '#a0ff70', 0.9);
    },
  }),

  // The Pale Huntsman: the hunt's master, white as bone and as lean, antlers
  // grown out of his brow, long white hair under a cloak of moss-grey; his
  // longbow of yew and sinew, a quiver of pale arrows on his back.
  huntsman: figure({
    stance: { h: 1.04, w: 0.9 },
    legs: { col: '#2a3a2a', mat: 'leather', r: 3.6, boot: '#1a2a1a' },
    torso: { col: '#3a4a3a', mat: 'leather', build: 'lean' },
    belt: { col: '#4a3a24', buckle: '#d8d0b8', buckleMat: 'bone' },
    sculpt(X, J) {
      // The quiver behind, arrows standing out of it.
      X.in(HG.cape, 1);
      X.tube(J.shN.x - 2, J.shN.y - 2, J.waist.x + 6, J.waist.y + 3, 2.2, 2, '#4a3a24', 'leather', { z: -4 });
      for (let i = 0; i < 4; i++) X.tube(J.shN.x - 2 + i * 1.1, J.shN.y - 2, J.shN.x + 1 + i * 1.6, J.shN.y - 9 - i, 0.45, 0.45, '#e8e0c8', 'bone', { z: -3 });
      // A collar of fur, a strap across him.
      X.in(HG.armor, 1.2);
      X.ball(J.neck.x + 0.5, J.neck.y + 1.5, 6, 3, '#c8c4b8', 'fur', { z: 12, rz: 2.4 });
      X.limb([[J.shF.x + 2, J.shF.y, 0.9, 11], [J.waist.x + 6, J.waist.y + 2, 0.9, 11]], '#4a3a24', 'leather');
    },
    paint(P) {
      strandsOf(P, 'fur');
    },
    head: { kind: 'man', r: 5, col: '#6a7c88', hair: '#e8ecf0', hairLong: true, horns: 'antler', hornCol: '#d8ccb0', hornLen: 1.2, cy: 15, h: 32, face: { noEyes: true },
      paint(P, c) {
        P.set(c.x - 3, c.y + 3, hex('#7a8a90'));
      },
      glow(P, c) {
        eyes(P, [[c.x - 3, c.y], [c.x + 1, c.y]], '#80e8ff');
      },
    },
    cape: { col: '#4a5a4a', mat: 'cloth', ragged: true, w: 26, h: 40 },
    arm: { col: '#c8d0d4', r: 2.9, sleeve: '#3a4a3a', sleeveMat: 'leather', L1: 8.5, L2: 8, wang: -0.05 },
    weapon: { kind: 'bow', len: 30, col: '#6a5a3a', grip: '#2a1a12', string: '#e8e0d0' },
    armF: { col: '#c8d0d4', r: 2.7, sleeve: '#3a4a3a', sleeveMat: 'leather' },
    fx(R, ctx) {
      // His breath, cold.
      const t = R.r.time;
      const k = (t * 0.6) % 1;
      ctx.globalAlpha = 0.4 * (1 - k);
      ctx.fillStyle = '#e8f8ff';
      ctx.fillRect(Math.round(R.x + (R.flip ? 1 : -1) * (6 + k * 8)), Math.round(R.y - 50 - k * 3), 2, 1);
      ctx.globalAlpha = 1;
    },
  }),

  // Foreman Gask: dead in the fall of the deep gallery, still driving his
  // men: a skull under a brass lamp-helm burning on, his leather apron and
  // rolled sleeves, arms like hams, the great pick he dug them out with.
  foreman: figure({
    stance: { h: 0.98, w: 1.12 },
    legs: { col: '#3a3226', mat: 'cloth', r: 4.6, boot: '#2a1e14' },
    torso: { col: '#8a7a64', mat: 'cloth', build: 'fat', wide: 1.05 },
    belt: { col: '#2a1e14', buckle: '#c8a040', wide: 1.1 },
    sculpt(X, J) {
      // His apron of leather, burnt; tools at his belt; a coil of rope.
      X.in(HG.armor, 1.2);
      X.slab([[J.chest.x - 7, J.chest.y - 3], [J.chest.x + 7, J.chest.y - 3], [J.waist.x + 9, J.waist.y + 10], [J.waist.x - 9, J.waist.y + 10]], '#5a3e28', 'leather', { z: 10, rz: 2, bevel: 1.6 });
      X.tube(J.waist.x + 8, J.waist.y + 3, J.waist.x + 9.5, J.waist.y + 9, 0.8, 0.8, '#6a4a2a', 'wood', { z: 13 });
      X.ball(J.waist.x + 9.5, J.waist.y + 9.6, 1.6, 1.2, '#8a8a98', 'metal', { z: 13.5, rz: 1 });
      X.ball(J.waist.x - 9, J.waist.y + 4, 3, 3, '#a8885a', 'cloth', { z: 11, rz: 2 });
    },
    paint(P, J) {
      // Soot and burns across the apron.
      for (let i = 0; i < 10; i++) {
        const x = Math.round(J.chest.x - 6 + ((i * 5) % 13));
        const y = Math.round(J.waist.y - 2 + ((i * 7) % 11));
        const c = P.get(x, y);
        if (c[3]) P.set(x, y, mix(c, [20, 14, 10], 0.45));
      }
    },
    head: { kind: 'skull', r: 5.2, col: '#d8d4c4', cy: 15,
      extra(X, c) {
        // The brass helm, its lamp.
        X.in(HG.head, 0.8);
        X.ball(c.x + 0.8, c.y - 3.4, 6.6, 4.2, '#8a6a2a', 'gold', { z: 16, rz: 3.4 });
        X.tube(c.x + 6, c.y - 4, c.x - 3, c.y - 7.2, 0.9, 0.9, '#a8883a', 'gold', { z: 19 });
        X.slab([[c.x - 7.5, c.y - 1.6], [c.x + 8, c.y - 2], [c.x + 8, c.y - 0.4], [c.x - 7.5, c.y + 0.2]], '#6a4e1a', 'gold', { z: 16.5, rz: 1, bevel: 0.6 });
        X.ball(c.x - 5.2, c.y - 4, 2, 2.2, '#4a4a52', 'metal', { z: 18, rz: 1.6 });
        X.ball(c.x - 6, c.y - 4, 1.4, 1.6, '#fff0b0', 'glass', { z: 19.5, rz: 1.2, glow: '#ffd060', glowK: 0.9 });
      },
      paint(P, c) {
        P.rect(c.x - 4, c.y, 2, 2, '#0a0610');
        P.rect(c.x, c.y, 2, 2, '#0a0610');
        for (let i = 0; i < 5; i++) P.set(c.x - 4 + i, c.y + 5, hex(i % 2 ? '#e8e0c8' : '#2a2020'));
      },
      glow(P, c) {
        eyes(P, [[c.x - 3, c.y + 1], [c.x + 1, c.y + 1]], '#ffb040');
        glow(P, c.x - 6, c.y - 4, 3.6, '#ffd060', 0.75);
      },
    },
    arm: { col: '#d8d4c4', bone: true, r: 4.4, sleeve: '#8a7a64', L1: 8.6, L2: 8.4, wang: 0.7, gauntlet: '#5a3e28', gauntletMat: 'leather' },
    weapon: { kind: 'pick', len: 20, col: '#8a8a98', grip: '#5a3a1a' },
    armF: { col: '#d8d4c4', bone: true, r: 4.2, sleeve: '#8a7a64', gauntlet: '#5a3e28', gauntletMat: 'leather' },
    fx(R, ctx) {
      // Dust sifting down off him.
      const t = R.r.time;
      for (let i = 0; i < 5; i++) {
        const k = (t * 0.5 + i * 0.2) % 1;
        ctx.globalAlpha = 0.5 * (1 - k);
        ctx.fillStyle = '#a89878';
        ctx.fillRect(Math.round(R.x - 10 + i * 5), Math.round(R.y - 40 + k * 38), 1, 1);
      }
      ctx.globalAlpha = 1;
    },
  }),

  // The Drowned Priest: the last of the priests who stayed to save the
  // reliquary when the water came up, and stayed: bloated and grey-green,
  // weed hanging off his vestments, his hood dripping; the reliquary's
  // chain-flail in his fist, the sea running out of him.
  priest: figure({
    stance: { h: 1, w: 1.04, hunch: 1 },
    robe: { col: '#24404e', ragged: true, trim: '#c8a030', front: '#1a3240' },
    torso: { col: '#24404e', mat: 'cloth', build: 'fat' },
    belt: { col: '#c8a030', buckle: '#80c8e0', buckleMat: 'glass' },
    sculpt(X, J) {
      // A stole of gold-trimmed cloth; weed hanging off him.
      X.in(HG.armor, 1.4);
      X.limb([[J.shF.x + 2, J.shF.y + 1, 2, 10], [J.chest.x - 2, J.waist.y + 6, 2, 11], [J.chest.x - 3, J.waist.y + 14, 1.8, 11]], '#e0d8b0', 'cloth');
      X.limb([[J.shN.x - 2, J.shN.y + 1, 2, 10], [J.chest.x + 3, J.waist.y + 6, 2, 11], [J.chest.x + 4, J.waist.y + 14, 1.8, 11]], '#e0d8b0', 'cloth');
      for (const [x, y] of [[J.shF.x, J.shF.y + 2], [J.waist.x + 7, J.waist.y], [J.waist.x - 6, J.waist.y + 8]]) X.limb([[x, y, 1, 12], [x - 1, y + 5, 0.8, 12], [x, y + 9, 0.5, 12]], '#3a6a3a', 'moss');
    },
    head: { kind: 'hood', r: 5.6, col: '#24404e', cy: 14,
      extra(X, c) {
        // His face in the hood: swollen, green.
        X.in(HG.head, 1);
        X.ball(c.x - 2, c.y + 1.2, 3.2, 3.4, '#7aa098', 'flesh', { z: 16.2, rz: 2 });
      },
      paint(P, c) {
        P.set(c.x - 3, c.y + 3, hex('#2a4a40'));
        P.set(c.x - 2, c.y + 3, hex('#2a4a40'));
      },
      glow(P, c) {
        eyes(P, [[c.x - 3, c.y + 1], [c.x - 0.5, c.y + 1]], '#c8ffd0');
      },
    },
    arm: { col: '#7aa098', mat: 'flesh', r: 3.4, sleeve: '#24404e', L1: 8.6, L2: 8, wang: 0.6 },
    weapon: { kind: 'flail', len: 9, col: '#5a6e6a', grip: '#c8a030', gripMat: 'gold' },
    armF: { col: '#7aa098', mat: 'flesh', r: 3.2, sleeve: '#24404e' },
    holds: { kind: 'book', col: '#2a4a3a' },
    fx(R, ctx) {
      drips(ctx, R.x, R.y - 26, R.r.time, [-10, -4, 3, 9], '#80c8e0', 26);
    },
  }),

  // The Hollow Saint: a saint whose face is gone, and only light where it
  // was; robes of old white and violet, a circlet, her halo turning about
  // her head of itself; a staff of the sun in her hand.
  hollow_saint: figure({
    stance: { h: 1.04, w: 0.88 },
    robe: { col: '#dcd8cc', trim: '#8a6ad8', flare: 0.8, front: '#c8c0d8' },
    torso: { col: '#dcd8cc', mat: 'cloth', build: 'lean' },
    belt: { col: '#8a6ad8', buckle: '#e0c050' },
    head: { kind: 'man', r: 5, col: '#b8b0c8', hair: '#8a7aa8', hairLong: true, cy: 14, face: false, crown: { col: '#e0c050', n: 3, tall: 2, gem: '#c8a0ff' },
      paint(P, c) {
        // Hollow: where her face was, only dark.
        for (let y = -1; y <= 4; y++) for (let x = -4; x <= 0; x++) if (Math.hypot(x + 2, (y - 1.5) * 0.8) < 2.8) P.set(c.x + x, c.y + y, hex('#2a2038'));
      },
      glow(P, c) {
        glow(P, c.x - 2, c.y + 1.5, 3.4, '#c8a0ff', 0.75);
        eyes(P, [[c.x - 3, c.y + 1], [c.x - 0.5, c.y + 1]], '#ffffff');
      },
    },
    arm: { col: '#d8d4e0', r: 2.8, sleeve: '#dcd8cc', L1: 8.4, L2: 8, wang: -0.1 },
    weapon: { kind: 'staff', len: 30, grip: '#c8a040', gripMat: 'gold', butt: 20,
      head(X, at, z) {
        X.ball(...at(31), 3.2, 3.2, '#e0c050', 'gold', { z: z + 2, rz: 2 });
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * TAU;
          X.tube(...at(31 + Math.cos(a) * 3, Math.sin(a) * 3), ...at(31 + Math.cos(a) * 6.4, Math.sin(a) * 6.4), 0.8, 0.2, '#e8d070', 'gold', { z: z + 2 });
        }
      },
      glow(P, { H, wang }) {
        const a = along(H, wang, 31);
        glow(P, a.x, a.y, 4, '#ffe8a0', 0.8);
      },
    },
    armF: { col: '#d8d4e0', r: 2.6, sleeve: '#dcd8cc' },
    holds: { kind: 'orb', col: '#c8a0ff', r: 2.2 },
    fx(R, ctx) {
      // Her halo, turning.
      const { x, y, r } = R;
      const hx = x + (R.flip ? 1 : -1) * 1.5;
      const hy = y - 52;
      for (let i = 0; i < 48; i++) {
        const a = (i / 48) * TAU + r.time * 0.8;
        if (i % 6 === 0) continue;
        ctx.fillStyle = i % 4 ? '#e8d8ff' : '#ffffff';
        ctx.globalAlpha = 0.85;
        ctx.fillRect(Math.round(hx + Math.cos(a) * 10), Math.round(hy + Math.sin(a) * 3.2), 1, 1);
      }
      ctx.globalAlpha = 1;
    },
  }),

  // The Bandit Warlord: a bull of a man, black-bearded under a spiked helm,
  // a red tabard over scavenged plate, a red cape; the warhammer he took off
  // a dead knight.
  warlord: figure({
    stance: { h: 1, w: 1.16 },
    legs: { col: '#3a3030', mat: 'cloth', r: 4.8, greave: '#6a5a50', boot: '#2a2020' },
    torso: { col: '#a87a58', build: 'muscle', wide: 1.08 },
    plate: { col: '#6a5a50', skirt: '#5a2020', skirtMat: 'cloth', trim: '#c8a040' },
    belt: { col: '#2a1a14', buckle: '#c8a040' },
    pauldronF: { col: '#6a5a50', r: 6, spikes: 3, spikeLen: 4, spikeCol: '#c8c0b8' },
    sculpt(X, J) {
      // A tabard of red over the plate, a skull bound to it.
      X.in(HG.armor + 1, 1);
      X.slab([[J.chest.x - 3.5, J.chest.y + 1], [J.chest.x + 3.5, J.chest.y + 1], [J.waist.x + 4, J.pelvis.y + 7], [J.waist.x - 4, J.pelvis.y + 7]], '#8a2020', 'cloth', { z: 13, rz: 1.4, bevel: 1.2 });
      X.ball(J.waist.x, J.waist.y + 3, 2, 2, '#e0d8c0', 'bone', { z: 15, rz: 1.6 });
    },
    head: { kind: 'helm', r: 5.4, col: '#6a6060', cy: 14,
      extra(X, c) {
        X.in(HG.head, 0.8);
        for (let i = 0; i < 3; i++) X.tube(c.x - 2 + i * 3, c.y - 5, c.x - 3 + i * 3.4, c.y - 11, 1.2, 0.2, '#c8c0b8', 'metal', { z: 15 });
        X.limb([[c.x - 3, c.y + 5, 2.8, 17], [c.x - 3.5, c.y + 9, 1.4, 17]], '#1a1410', 'hair');
      },
      paint(P, c) {
        P.rect(c.x - 5, c.y, 5, 1, '#0a0606');
      },
      glow(P, c) {
        P.set(c.x - 4, c.y, hex('#ff5030'));
        P.set(c.x - 1, c.y, hex('#ff5030'));
      },
    },
    cape: { col: '#7a2020', mat: 'velvet', w: 30, h: 38, clasp: '#c8a040' },
    arm: { col: '#a87a58', r: 4, gauntlet: '#6a5a50', L1: 8.8, L2: 8.4, wang: 0.8, pauldron: { col: '#6a5a50', r: 6.2, spikes: 3, spikeLen: 4, spikeCol: '#c8c0b8' } },
    weapon: { kind: 'hammer', len: 20, col: '#8a8a98', grip: '#3a2a1a' },
    fist: { col: '#6a5a50', r: 2.8 },
    armF: { col: '#a87a58', r: 3.8, gauntlet: '#6a5a50' },
  }),

  // Rook, the bigger of the Twins: a wall of a man behind his shield, mail
  // and plate and a red-crested helm, a hammer to break you with.
  twins: figure({
    stance: { h: 1, w: 1.14 },
    legs: { col: '#3a3030', mat: 'mail', r: 4.6, greave: '#5a5a62', boot: '#2a2020' },
    torso: { col: '#4a3a3a', mat: 'mail', build: 'muscle', wide: 1.06 },
    plate: { col: '#5a5a62', skirt: '#4a4a52', trim: '#8a2020', trimMat: 'cloth' },
    belt: { col: '#2a1a14', buckle: '#8a8a98', buckleMat: 'metal' },
    pauldronF: { col: '#5a5a62', r: 5.8, trim: '#8a2020', trimMat: 'cloth' },
    head: { kind: 'helm', r: 5.4, col: '#5a5a62', cy: 14,
      extra(X, c) {
        // The crest, red horsehair.
        X.in(HG.head, 1);
        X.limb([[c.x - 4, c.y - 5, 1.8, 15], [c.x + 1, c.y - 8, 2.2, 15], [c.x + 6, c.y - 6, 1.8, 14], [c.x + 9, c.y - 1, 1.2, 13]], '#8a2020', 'hair');
      },
      paint(P, c) {
        P.rect(c.x - 5, c.y, 5, 1, '#0a0606');
        P.rect(c.x - 3, c.y + 1, 1, 3, '#0a0606');
      },
    },
    arm: { col: '#a87a58', r: 4, gauntlet: '#5a5a62', L1: 8.8, L2: 8.4, wang: 0.7, pauldron: { col: '#5a5a62', r: 6, trim: '#8a2020', trimMat: 'cloth' } },
    weapon: { kind: 'hammer', len: 17, col: '#7a7a88', grip: '#3a2a1a' },
    fist: { col: '#5a5a62', r: 2.8 },
    armF: { col: '#a87a58', r: 3.8, gauntlet: '#5a5a62' },
    holds: { kind: 'shield', r: 8, col: '#7a7a88', mat: 'metal', rim: '#5a5a62', boss: '#8a2020' },
  }),

  // Wren, the lesser of the Twins and the quicker: leather and a red
  // bandana and sash, a knife in either hand.
  twin_b: figure({
    stance: { h: 0.98, w: 0.9 },
    legs: { col: '#22221e', mat: 'leather', r: 3.6, boot: '#1a1a16' },
    torso: { col: '#2a2a2a', mat: 'leather', build: 'lean' },
    belt: { col: '#3a2a1a', buckle: '#c8c8d0', buckleMat: 'metal' },
    sculpt(X, J) {
      X.in(HG.armor, 1);
      X.limb([[J.waist.x - 7, J.waist.y + 1, 1.6, 12], [J.waist.x + 2, J.waist.y + 3, 1.8, 13], [J.waist.x + 6, J.pelvis.y + 6, 1.2, 12]], '#8a2020', 'cloth');
      for (let i = 0; i < 3; i++) X.tube(J.chest.x - 6 + i * 4, J.chest.y + 4, J.chest.x - 6 + i * 4, J.chest.y + 7, 0.7, 0.7, '#8a8a98', 'metal', { z: 12 });
    },
    head: { kind: 'man', r: 4.8, col: '#a87a58', hair: '#3a2a1a', hairLong: true, cy: 15,
      extra(X, c) {
        X.in(HG.head, 0.8);
        X.ball(c.x + 0.8, c.y - 3, 5.2, 2.6, '#8a2020', 'cloth', { z: 16, rz: 2 });
        X.limb([[c.x + 5, c.y - 3, 1.2, 15], [c.x + 9, c.y - 1, 0.8, 14], [c.x + 10, c.y + 3, 0.5, 13]], '#8a2020', 'cloth');
      },
      paint(P, c) {
        P.set(c.x - 3, c.y, hex('#1a1010'));
        P.set(c.x, c.y, hex('#1a1010'));
        P.set(c.x - 3, c.y + 3, hex('#6a4a38'));
      },
    },
    cape: { col: '#3a2020', mat: 'cloth', w: 22, h: 24, ragged: true },
    arm: { col: '#a87a58', r: 3, sleeve: '#2a2a2a', sleeveMat: 'leather', L1: 8.4, L2: 8, wang: -0.5 },
    weapon: { kind: 'sword', len: 11, width: 1.3, col: '#d0d4e0', guard: '#5a5a62', guardMat: 'metal', grip: '#2a1a12' },
    armF: { col: '#a87a58', r: 2.8, sleeve: '#2a2a2a', sleeveMat: 'leather' },
    holds: { kind: 'dagger', col: '#d0d4e0' },
  }),

  // Mother Nettle: the poisoner, her hood deep and green, vials on a
  // bandolier across her, a knife in either hand wet with what's in them.
  poisoner: figure({
    stance: { h: 0.96, w: 0.92, hunch: 1.5 },
    robe: { col: '#3a4a2a', trim: '#a8c040', ragged: true, flare: 0.9 },
    torso: { col: '#3a4a2a', mat: 'cloth', build: 'lean' },
    belt: { col: '#3a2a1a', buckle: '#a8c040', buckleMat: 'glass' },
    sculpt(X, J) {
      X.in(HG.armor, 1);
      X.limb([[J.shF.x + 2, J.shF.y + 2, 1, 12], [J.chest.x, J.chest.y + 4, 1, 13], [J.waist.x + 7, J.waist.y + 3, 1, 12]], '#3a2a1a', 'leather');
      for (let i = 0; i < 5; i++) X.ball(J.shF.x + 4 + i * 3.2, J.shF.y + 4 + i * 2.6, 1.1, 1.7, ['#a8e040', '#c84a8a', '#80c8e0', '#a8e040', '#e0a040'][i], 'glass', { z: 14, rz: 1, glow: i % 2 ? null : '#c8ff60', glowK: 0.2 });
      // Herbs at her belt.
      for (let i = 0; i < 3; i++) X.tube(J.waist.x - 6 + i * 2, J.waist.y + 4, J.waist.x - 7 + i * 2, J.waist.y + 10, 0.8, 0.4, i % 2 ? '#5a7a2a' : '#7a9a3a', 'moss', { z: 13 });
    },
    head: { kind: 'hood', r: 5.6, col: '#2e3a22', cy: 14,
      extra(X, c) {
        X.in(HG.head, 1);
        X.ball(c.x - 2, c.y + 1.6, 2.8, 3, '#b8a07a', 'skin', { z: 16.2, rz: 2 });
      },
      paint(P, c) {
        P.set(c.x - 3, c.y + 4, hex('#5a3a2a'));
        P.set(c.x - 2, c.y + 4, hex('#c84a6a'));
      },
      glow(P, c) {
        eyes(P, [[c.x - 3, c.y + 1], [c.x - 0.5, c.y + 1]], '#c8ff60');
      },
    },
    arm: { col: '#b8a07a', r: 2.8, sleeve: '#3a4a2a', L1: 8.2, L2: 8, wang: -0.6 },
    weapon: { kind: 'sword', len: 10, width: 1.3, col: '#a8c040', guard: '#3a2a1a', guardMat: 'leather', grip: '#3a2a1a',
      glow(P, { H, wang }) {
        const a = along(H, wang, 12);
        glow(P, a.x, a.y, 2, '#c8ff60', 0.6);
      },
    },
    armF: { col: '#b8a07a', r: 2.6, sleeve: '#3a4a2a' },
    holds: { kind: 'dagger', col: '#a8c040' },
    fx(R, ctx) {
      drips(ctx, R.x + (R.flip ? -14 : 14), R.y - 30, R.r.time, [0, 2], '#c8ff60', 12);
    },
  }),

  // The Thorn Queen: queen of the briars, pale and green, her crown of
  // thorns and roses, her gown the red of the roses, briars climbing its
  // skirts; a staff ending in a great rose.
  thorn_queen: figure({
    stance: { h: 1.04, w: 0.9 },
    robe: { col: '#4a2a3a', mat: 'velvet', ragged: true, trim: '#5a7a3a', trimMat: 'bark', flare: 1.3 },
    torso: { col: '#4a2a3a', mat: 'velvet', build: 'lean' },
    belt: { col: '#5a7a3a', buckle: '#e05070', buckleMat: 'velvet' },
    sculpt(X, J) {
      // Briars climbing her skirts, roses on them.
      X.in(HG.front, 1);
      for (let i = 0; i < 5; i++) {
        const x = J.waist.x - 11 + i * 5.5;
        X.limb([[x, 61, 0.8, 14], [x + 1.5, 53, 0.7, 14], [x + 2.5 + (i % 2), 45 + i, 0.6, 14]], '#4a6a2a', 'bark');
        X.ball(x + 2.5 + (i % 2), 45 + i, 1.6, 1.4, i % 2 ? '#e05070' : '#c83a5a', 'velvet', { z: 15, rz: 1.2 });
      }
    },
    paint(P, J) {
      // Thorns along the briars.
      for (let i = 0; i < 18; i++) {
        const x = Math.round(J.waist.x - 11 + (i % 5) * 5.5 + 2 + (i % 2));
        const y = Math.round(50 + (i % 4) * 2.6);
        if (P.get(x, y)[3]) P.set(x + 1, y, hex('#c8d0a0'));
      }
    },
    head: { kind: 'man', r: 4.9, col: '#a8c890', hair: '#3a5a2a', hairLong: true, cy: 15,
      extra(X, c) {
        // The crown of thorns, roses in it.
        X.in(HG.head, 0.8);
        for (let i = 0; i < 7; i++) {
          const a = -Math.PI + (i / 6) * Math.PI;
          X.tube(c.x + 1 + Math.cos(a) * 4.6, c.y - 3 + Math.sin(a) * 2, c.x + 1 + Math.cos(a) * 7.6, c.y - 4 + Math.sin(a) * 6, 0.8, 0.2, '#5a7a3a', 'bark', { z: 17 });
        }
        for (const dx of [-3, 2, 5]) X.ball(c.x + dx, c.y - 5, 1.6, 1.4, '#e05070', 'velvet', { z: 18, rz: 1.2 });
      },
      paint(P, c) {
        P.set(c.x - 3, c.y + 3, hex('#8a3a4a'));
      },
      glow(P, c) {
        eyes(P, [[c.x - 3, c.y], [c.x, c.y]], '#e05070');
      },
    },
    arm: { col: '#a8c890', r: 2.7, sleeve: '#4a2a3a', sleeveMat: 'velvet', L1: 8.4, L2: 8, wang: -0.1 },
    weapon: { kind: 'staff', len: 30, grip: '#4a3a24', butt: 20,
      head(X, at, z) {
        X.ball(...at(31), 3.4, 3.2, '#c83a5a', 'velvet', { z: z + 2, rz: 2.4 });
        X.ball(...at(31.5, -0.8), 1.8, 1.6, '#ff90a0', 'velvet', { z: z + 3.4, rz: 1.2 });
        for (const sd of [-1, 1]) X.tube(...at(29, sd * 2), ...at(27, sd * 5.4), 0.9, 0.2, '#5a8a3a', 'moss', { z: z + 1 });
      },
    },
    armF: { col: '#a8c890', r: 2.6, sleeve: '#4a2a3a', sleeveMat: 'velvet' },
    fx(R, ctx) {
      // Petals falling round her.
      const t = R.r.time;
      for (let i = 0; i < 6; i++) {
        const k = (t * 0.25 + i / 6) % 1;
        ctx.globalAlpha = 0.85 * (1 - k);
        ctx.fillStyle = i % 2 ? '#e05070' : '#ff90a0';
        ctx.fillRect(Math.round(R.x - 16 + i * 6 + Math.sin(k * 8 + i) * 3), Math.round(R.y - 50 + k * 48), 2, 1);
      }
      ctx.globalAlpha = 1;
    },
  }),
});

// ------------------------------------------------------------ the deep
forge({
  // The Brood Mother: a spider the size of a cart. Her abdomen a bristling
  // bag banded in rust and black, the hourglass on it glowing red as she
  // breathes; her head crowded with eyes, eight burning; fangs that work
  // (a part, opening as she strikes); egg-sacs strung on her back. Her legs
  // her own, every foot planted where it falls (see bossart.js).
  brood_mother: {
    size: 64, ax: 24, ay: 62, breath: 1.2,
    body(X, J) {
      const b = J.b;
      // Her abdomen: a great bag, bristled, banded.
      X.in(0, 3);
      X.ball(41, 33 - b * 0.6, 17 + b * 0.5, 13.5 + b * 0.5, '#4a3630', 'fur', { rz: 12, along: 'x' });
      X.ball(56, 35 - b * 0.4, 3.4, 3.8, '#2a1e1a', 'chitin', { z: 3, rz: 2 });
      // Egg-sacs webbed to her back.
      for (const [x, y, r] of [[36, 21, 3.4], [43, 20, 3], [49, 23, 2.6]]) X.ball(x, y - b * 0.6, r, r * 0.9, '#d8d0c0', 'slime', { z: 8, rz: r * 0.8 });
      // The waist, the head-and-body, the head.
      X.in(1, 1.6);
      X.ball(25.5, 40, 4.6, 4, '#2a1e1a', 'chitin', { rz: 3, z: 2 });
      X.ball(18, 41, 9.5, 7.6, '#3a2a24', 'chitin', { rz: 7, z: 3 });
      X.ball(9.5, 43, 6, 5.4, '#3a2a24', 'chitin', { rz: 5, z: 4 });
      // The pedipalps, feeling before her.
      X.limb([[8, 46, 1.6, 6], [4, 49, 1.3, 7], [3, 53, 0.9, 7]], '#4a3630', 'chitin');
      X.limb([[11, 47, 1.6, 7], [8, 51, 1.3, 8], [8, 55, 0.9, 8]], '#4a3630', 'chitin');
      // Her eyes: two great, six little, glossy black.
      X.in(2, 0.4);
      for (const [x, y, r] of [[6.5, 40, 1.9], [10, 38.4, 1.8], [13, 38, 1.1], [7.5, 43, 1.1], [11.4, 41.8, 1], [14.4, 41, 0.9], [5, 44, 0.8], [15.5, 38.8, 0.8]]) X.ball(x, y, r, r, '#1a0606', 'glass', { z: 11, rz: r * 0.8 });
    },
    paint(P, J) {
      const b = J.b;
      // The bands round her abdomen, light at their edges.
      P.over((x, y, c) => {
        if (x < 26 || y > 47) return null;
        const k = (x - Math.round(Math.abs(y - 33) * 0.3) + 64) % 7;
        return k === 0 ? shade(c, 0.55) : k === 1 ? mix(c, [200, 120, 70], 0.3) : null;
      });
      strandsOf(P, 'fur');
      // The hourglass.
      const g = 0.5 + 0.5 * Math.sin(J.t * TAU);
      const red = mix(hex('#c82a20'), hex('#ff6a40'), g);
      for (let y = 0; y < 5; y++) for (let x = -2 + Math.round(y * 0.5); x <= 2 - Math.round(y * 0.5); x++) P.set(41 + x, Math.round(27 - b * 0.6 + y), red);
      for (let y = 0; y < 5; y++) for (let x = -Math.round(y * 0.5); x <= Math.round(y * 0.5); x++) P.set(41 + x, Math.round(32 - b * 0.6 + y), red);
    },
    glow(P, J) {
      for (const [x, y, r] of [[6.5, 40, 1], [10, 38.4, 1], [13, 38, 0], [7.5, 43, 0], [11.4, 41.8, 0], [14.4, 41, 0], [5, 44, 0], [15.5, 38.8, 0]]) {
        P.set(Math.round(x), Math.round(y), hex('#ff4030'));
        if (r) glow(P, x, y, 2.2, '#ff3020', 0.5);
      }
      glow(P, 41, 31 - J.b * 0.6, 4, '#ff5030', 0.25 + 0.2 * Math.sin(J.t * TAU));
    },
    parts: {
      // Her fangs, working.
      fangs: {
        w: 14, h: 14, px: 8, py: 3, role: 'jaw', layer: 'front', z: 4, at: [8, 46], amp: 1.4,
        body(X) {
          X.in(0, 1);
          X.limb([[7, 3, 2.4, 3], [5, 7, 1.8, 4], [5, 10, 1, 5]], '#3a2a24', 'chitin');
          X.limb([[5, 9, 0.9, 6], [3.5, 12.5, 0.3, 6]], '#e8e0c8', 'bone');
          X.limb([[10, 3, 2.2, 2], [9.5, 7, 1.6, 3], [10, 10, 0.9, 4]], '#2a1e1a', 'chitin');
          X.limb([[10, 9.5, 0.8, 5], [11, 12.5, 0.3, 5]], '#e8e0c8', 'bone');
        },
        glow(P) {
          P.fx(3, 12, '#c8ff60', 0.8);
        },
      },
    },
    legs: {
      style: 'spider', L1: 21, L2: 24, stepT: 0.13, reach: 0.55, arc: 7,
      legs: [[1.55], [0.65], [-0.35], [-1.25]], vFar: -0.95, vNear: 0.8,
      hips: [[[15, 39], [15, 43]], [[18, 38], [18, 43]], [[21, 38], [21, 44]], [[24, 39], [24, 44]]],
    },
    fx(R, ctx) {
      // Strands of web trailing off her spinnerets.
      const { x, y, r, flip } = R;
      const sx = x + (flip ? -1 : 1) * 32;
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = '#e8e8f0';
      for (let i = 0; i < 12; i++) ctx.fillRect(Math.round(sx + (flip ? -1 : 1) * i * 1.2), Math.round(y - 26 + i * 2 + Math.sin(r.time * 2 + i * 0.5) * 1.2), 1, 1);
      ctx.globalAlpha = 1;
    },
  },
});

// ------------------------------------------------------------ the Kavorent's
const ALLOY = '#2e2c46';
const ALLOY_HI = '#4a4870';
const ALLOY_LO = '#1c1a2e';
const SEAM = '#5ad8f0';
// A seam of the Kavorent's cold light (pulsing along it, `k` its phase).
function seamLine(P, pts, t, k = 0) {
  for (let i = 0; i + 1 < pts.length; i++) {
    const [a, b] = [pts[i], pts[i + 1]];
    const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1])));
    for (let s = 0; s <= n; s++) {
      const x = a[0] + ((b[0] - a[0]) * s) / n;
      const y = a[1] + ((b[1] - a[1]) * s) / n;
      const pulse = 0.5 + 0.5 * Math.sin(t * TAU * 2 - (i * n + s) * 0.25 + k);
      P.fx(x, y, pulse > 0.75 ? '#ffffff' : pulse > 0.4 ? '#c8fbff' : SEAM, 0.95);
    }
  }
}
forge({
  // The Overseer: the facility's eye. A great sphere of riveted alloy in
  // rings, eight seams of cold light turning in it, fins along its crown,
  // an emitter slung under; its red eye turned on you, always (painted as
  // it's drawn); the shards of its shield wheeling round it; and two great
  // legs of plated alloy, every foot planted where it falls.
  overseer: {
    size: 128, ax: 64, ay: 126,
    body(X, J) {
      const c = { x: 64, y: 50 - J.b };
      // Its fins, along its crown, behind.
      X.in(0, 1);
      for (let i = -2; i <= 2; i++) X.slab([[c.x + i * 9 - 3, c.y - 30], [c.x + i * 9 + 3, c.y - 30], [c.x + i * 11 + 1, c.y - 46 + Math.abs(i) * 4], [c.x + i * 11 - 1, c.y - 46 + Math.abs(i) * 4]], ALLOY_LO, 'metal', { rz: 2, bevel: 1, z: -4 });
      // The sphere in its rings.
      X.in(1, 1.6);
      X.ball(c.x, c.y, 36, 34, ALLOY_HI, 'metal', { rz: 22 });
      X.ball(c.x, c.y, 29, 28, ALLOY, 'metal', { z: 4, rz: 8 });
      X.ball(c.x, c.y, 21, 20, ALLOY_LO, 'metal', { z: 8, rz: 4 });
      X.ball(c.x, c.y, 14, 14, '#120a14', 'metal', { z: 10, rz: 2 });
      // Rivets round its outer ring.
      X.in(2, 0.4);
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * TAU + TAU / 32;
        X.ball(c.x + Math.cos(a) * 32.5, c.y + Math.sin(a) * 31, 1.5, 1.5, '#8a88b0', 'metal', { z: 21, rz: 1.2 });
      }
      // The emitter slung under it.
      X.in(3, 1.4);
      X.ball(c.x, c.y + 36, 9, 5, ALLOY, 'metal', { z: 10, rz: 4 });
      X.tube(c.x, c.y + 38, c.x, c.y + 46, 3, 1.4, ALLOY_LO, 'metal', { z: 10 });
      X.ball(c.x, c.y + 47, 2.4, 2.4, '#c8fbff', 'glass', { z: 12, rz: 2, glow: '#5ad8f0', glowK: 0.7 });
    },
    paint(P, J) {
      const c = { x: 64, y: 50 - J.b };
      // Panel lines across its plates.
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU;
        crease(P, c.x + Math.cos(a) * 22, c.y + Math.sin(a) * 21, c.x + Math.cos(a) * 35, c.y + Math.sin(a) * 33, 0.6);
      }
    },
    glow(P, J) {
      const c = { x: 64, y: 50 - J.b };
      // Its eight seams, lit in turn.
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU + TAU / 16;
        seamLine(P, [[c.x + Math.cos(a) * 15, c.y + Math.sin(a) * 15], [c.x + Math.cos(a) * 28, c.y + Math.sin(a) * 27]], J.t, i * 0.8);
      }
      for (let i = 0; i < 64; i++) {
        const a = (i / 64) * TAU;
        const on = (i + Math.floor(J.t * 64)) % 16 < 3;
        P.fx(c.x + Math.cos(a) * 21.5, c.y + Math.sin(a) * 20.5, on ? '#ffffff' : SEAM, on ? 1 : 0.55);
      }
    },
    parts: Object.fromEntries([0, 1, 2, 3, 4, 5].flatMap((i) => ['back', 'front'].map((layer) => [`shard${i}${layer}`, {
      w: 18, h: 18, px: 9, py: 9, role: 'sway', layer, z: 1, depth: 0.05,
      at: (J, R) => {
        const a = (R ? R.t : 0) * 0.7 + (i / 6) * TAU;
        return [64 + Math.cos(a) * 52, 50 + Math.sin(a) * 14];
      },
      show: (R) => (Math.sin(R.t * 0.7 + (i / 6) * TAU) >= 0) === (layer === 'front'),
      extra: (R) => R.t * 0.7 + (i / 6) * TAU,
      body(X) {
        X.in(0, 0.8);
        X.slab([[2, 9], [9, 3], [16, 9], [9, 15]], '#4a4870', 'metal', { rz: 2.2, bevel: 1.4 });
        X.slab([[6, 9], [9, 6], [12, 9], [9, 12]], '#2e2c46', 'metal', { rz: 1, bevel: 0.6, z: 3 });
      },
      glow(P) {
        P.fx(9, 9, '#c8fbff', 0.9);
        P.fx(8, 9, SEAM, 0.7);
        P.fx(10, 9, SEAM, 0.7);
      },
    }]))),
    legs: {
      style: 'mech', L1: 50, L2: 58, stepT: 0.24, reach: 0.9, arc: 14, thud: true,
      legs: [[1.4], [-1.4]], vFar: -1.1, vNear: 1,
      hips: [[[46, 72], [44, 78]], [[82, 72], [84, 78]]],
    },
    fx(R, ctx) {
      // Its eye, turned on you.
      const { e, x, y, r } = R;
      const p = e.game && e.game.player;
      let ex = 0;
      let ey = 0;
      if (p) {
        const pp = p.renderPos();
        const wp = e.renderPos();
        const [pu, pv] = r.toView(pp.x, pp.z);
        const [eu, ev] = r.toView(wp.x, wp.z);
        const d = Math.hypot(pu - eu, pv - ev) || 1;
        ex = Math.round(((pu - eu) / d) * 5);
        ey = Math.round(((pv - ev) / d) * 4);
      }
      const cx = x + ex;
      const cy = y - 76 - Math.round(R.J.b) + ey;
      const hot = e.windup ? Math.min(1, e.windup.t / Math.max(0.05, e.windup.dur)) : 0;
      const blink = Math.floor(r.time * 14) % 2;
      for (let dy = -9; dy <= 9; dy++) for (let dx = -9; dx <= 9; dx++) {
        const d = Math.hypot(dx, dy);
        if (d > 9) continue;
        ctx.fillStyle = d < 3 ? (hot > 0.6 && blink ? '#ffffff' : '#ffd0d0') : d < 5.5 ? '#ff4050' : d < 7.5 ? '#c81a28' : '#6a0a14';
        ctx.fillRect(cx + dx, cy + dy, 1, 1);
      }
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(cx - 3, cy - 4, 2, 2);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.25 + hot * 0.4;
      ctx.fillStyle = '#ff4050';
      for (let dy = -14; dy <= 14; dy++) for (let dx = -14; dx <= 14; dx++) if (Math.hypot(dx, dy) < 14 && (dx + dy) % 2 === 0) ctx.fillRect(cx + dx, cy + dy, 1, 1);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    },
  },

  // The Crucible: the thermal spire's heart. A squat engine of alloy on
  // four piston legs, a great crucible drum open on molten metal, its heat
  // showing (the plate going red, white at the seams), gauges and pipes
  // round it, a grate in its belly with the fire behind the bars, stacks
  // venting; its two piston arms (parts) with their hammers. Spent, it
  // stands open, frosted with coolant.
  crucible: {
    size: 128, ax: 64, ay: 126,
    body(X, J, t, st) {
      const heat = st.heat || 0;
      const plate = heat >= 2 ? '#5a3040' : heat >= 1 ? '#40304a' : ALLOY;
      const b = J.b;
      X.in(0, 2.4);
      // Its legs: pistons, splayed, on broad feet.
      for (const [x, d] of [[30, -1], [50, -0.4], [78, 0.4], [98, 1]]) {
        X.limb([[x, 92, 6, 0], [x + d * 5, 108, 5, 0], [x + d * 7, 118, 5.6, 0]], ALLOY_LO, 'metal');
        X.tube(x + d * 2, 96, x + d * 5, 108, 2.4, 2.4, '#8a88b0', 'metal', { z: 4 });
        X.ball(x + d * 7, 122, 9, 3.6, ALLOY, 'metal', { rz: 3 });
      }
      X.in(1, 3);
      // The housing, plated, broad at its foot; pipes along it.
      X.slab([[18, 58 - b], [110, 58 - b], [118, 96], [10, 96]], plate, 'metal', { rz: 20, bevel: 6 });
      for (const y of [70, 82]) X.tube(14, y - b * 0.5, 114, y - b * 0.5, 2, 2, ALLOY_LO, 'metal', { z: 12 });
      // The crucible itself: a great drum, its lip rolled over, the metal in it.
      X.ball(64, 56 - b, 34, 28, plate, 'metal', { rz: 26, z: 4 });
      for (let i = 0; i < 3; i++) X.ball(64, 44 - b + i * 12, 34.5 - i * 1.5, 3.4, ALLOY_LO, 'metal', { rz: 3, z: 9 });
      X.ball(64, 31 - b, 29, 9, ALLOY, 'metal', { rz: 9, z: 8 });
      X.ball(64, 31 - b, 23, 6.4, st.vent ? '#a8e4f8' : heat >= 1 ? '#ff8a20' : '#ff6a10', st.vent ? 'glass' : 'molten', { rz: 1.5, z: 14, glow: st.vent ? null : '#ffd060', glowK: 0.6 });
      // Gauges on its flank, a valve wheel.
      X.in(2, 0.8);
      for (const [x, y] of [[30, 70], [98, 70]]) {
        X.ball(x, y - b, 5, 5, '#c8a040', 'gold', { z: 22, rz: 2 });
        X.ball(x, y - b, 3.8, 3.8, '#e8e0d0', 'ceramic', { z: 24, rz: 1 });
      }
      X.ball(64, 92, 7, 2.4, '#8a88b0', 'metal', { z: 22, rz: 1.6 });
      // Stacks at its back, venting.
      X.in(0, 2);
      for (const x of [40, 88]) X.tube(x, 40 - b, x, 10, 4.6, 4, ALLOY_LO, 'metal', { z: -4 });
    },
    paint(P, J, t, st) {
      const heat = st.heat || 0;
      const b = Math.round(J.b);
      // The grate in its belly: the molten behind the bars (frost, spent).
      for (let y = 72; y <= 88; y++) for (let x = 50; x <= 78; x++) {
        const bar = (x - 50) % 4 === 0 || y === 72 || y === 88;
        const hot = st.vent ? '#a8e4f8' : heat >= 2 ? '#fff0a0' : Math.sin(t * TAU * 3 + x * 0.7 + y) > 0.2 ? '#ffb040' : '#ff5a10';
        P.set(x, y - b, hex(bar ? '#1a1828' : hot));
      }
      // Gauge needles.
      for (const [x, y] of [[30, 70], [98, 70]]) P.line(x, y - b, x + Math.cos(-2.4 + heat * 0.8) * 3, y - b + Math.sin(-2.4 + heat * 0.8) * 3, '#c82020');
      if (heat >= 1 && !st.vent) P.over((x, y, c) => (hash2(x, y, 7) < 0.04 * heat ? mix(c, [255, 80, 32], 0.5) : null));
      if (st.vent) P.over((x, y, c) => (hash2(x, y, 5) < 0.12 ? mix(c, [224, 248, 255], 0.6) : null));
    },
    glow(P, J, t, st) {
      const heat = st.heat || 0;
      const b = J.b;
      const seam = st.vent ? '#e0f8ff' : heat >= 2 ? '#fff0a0' : heat >= 1 ? '#ffb040' : null;
      for (let i = 0; i < 21; i++) {
        const a = Math.PI * (0.1 + i * 0.04);
        P.fx(64 + Math.cos(a) * 33, 56 - b + Math.sin(a) * 27, seam || SEAM, 0.9);
      }
      if (!seam) seamLine(P, [[22, 95], [106, 95]], t);
      else for (let x = 22; x <= 106; x++) P.fx(x, 95, seam, 0.9);
      glow(P, 64, 80 - b, 10, st.vent ? '#a0e8ff' : '#ff8030', 0.25);
    },
    parts: Object.fromEntries([-1, 1].map((side) => [side < 0 ? 'armF' : 'armN', {
      w: 40, h: 46, px: side < 0 ? 32 : 8, py: 8, role: side < 0 ? 'offhand' : 'weapon', layer: side < 0 ? 'back' : 'front', sign: side, amp: 0.6,
      at: (J) => [64 + side * 44, 60 - J.b],
      body(X) {
        const x0 = side < 0 ? 32 : 8;
        X.in(0, 1.6);
        X.ball(x0, 8, 7, 7, ALLOY, 'metal', { rz: 5 });
        X.tube(x0, 10, x0 + side * 12, 26, 5, 4, ALLOY_LO, 'metal', { z: 2 });
        X.tube(x0 + side * 4, 12, x0 + side * 13, 26, 1.8, 1.8, '#8a88b0', 'metal', { z: 6 });
        X.in(1, 1.2);
        X.slab([[x0 + side * 6, 26], [x0 + side * 22, 26], [x0 + side * 22, 42], [x0 + side * 6, 42]], ALLOY_HI, 'metal', { rz: 9, bevel: 3, z: 6 });
        X.slab([[x0 + side * 8, 39], [x0 + side * 20, 39], [x0 + side * 20, 44], [x0 + side * 8, 44]], ALLOY_LO, 'metal', { rz: 3, bevel: 1, z: 10 });
      },
      glow(P) {
        const x0 = side < 0 ? 32 : 8;
        for (let y = 28; y <= 38; y += 5) for (let k = 0; k < 12; k++) P.fx(x0 + side * (8 + k), y, SEAM, 0.6);
      },
    }])),
    fx(R, ctx) {
      // The stacks venting; embers rising when it's hot.
      const { x, y, r, st, flip } = R;
      const heat = st.heat || 0;
      const sgn = flip ? -1 : 1;
      for (const sx of [-24, 24]) for (let i = 0; i < 5; i++) {
        const k = (r.time * 0.8 + i / 5 + sx * 0.01) % 1;
        const px = x + sgn * sx + Math.sin(k * 6 + sx) * 3;
        const py = y - 118 - k * 26;
        const rr = 2 + k * 5;
        ctx.globalAlpha = 0.45 * (1 - k);
        ctx.fillStyle = st.vent ? '#c8e8f0' : heat >= 1 ? '#ff9040' : '#6a6466';
        ctx.fillRect(Math.round(px - rr / 2), Math.round(py - rr / 2), Math.round(rr), Math.round(rr));
      }
      if (heat >= 1) for (let i = 0; i < 8; i++) {
        const k = (r.time * 1.2 + i / 8) % 1;
        ctx.globalAlpha = 0.9 * (1 - k);
        ctx.fillStyle = k < 0.4 ? '#fff0a0' : '#ff6020';
        ctx.fillRect(Math.round(x - 40 + i * 11 + Math.sin(k * 7 + i) * 3), Math.round(y - 30 - k * 70), 1, 2);
      }
      ctx.globalAlpha = 1;
    },
  },

  // The Condenser: the tidal spire's heart, wringing the sea into rain. A
  // hovering coil of alloy ringed in bands, a lens in its middle, a churning
  // storm cloud for its crown; three vanes about it, turning (parts); rain
  // off it always, and lightning running between its vanes.
  condenser: {
    size: 128, ax: 64, ay: 126,
    body(X, J, t) {
      const turn = t * TAU;
      const hov = Math.sin(t * TAU) * 2;
      // Its cloud crown.
      X.in(0, 2.4);
      for (let i = 0; i < 8; i++) {
        const a = turn * 0.5 + (i / 8) * TAU;
        X.ball(64 + Math.cos(a) * 24, 26 + Math.sin(a) * 6 + hov, 17, 11, i % 2 ? '#4a5468' : '#5a6478', 'ash', { rz: 10, z: Math.sin(a) * 4 });
      }
      X.ball(64, 22 + hov, 22, 13, '#6a7488', 'ash', { rz: 12, z: 6 });
      // The coil: a column ringed in alloy, tapering to a point below.
      X.in(1, 2.4);
      X.tube(64, 36 + hov, 64, 108 + hov, 15, 5, ALLOY, 'metal', { z: 2 });
      for (let y = 42; y <= 96; y += 9) X.ball(64, y + hov, 17 - (y - 42) * 0.17, 3.6, ALLOY_LO, 'metal', { rz: 3, z: 6 });
      X.ball(64, 114 + hov, 4.4, 7, ALLOY_LO, 'metal', { rz: 3, z: 4 });
      // The lens.
      X.in(2, 1);
      X.ball(64, 66 + hov, 9, 9, '#8a88b0', 'metal', { rz: 5, z: 16 });
      X.ball(64, 66 + hov, 7, 7, '#1a2a3a', 'glass', { rz: 5, z: 18 });
    },
    glow(P, J, t, st) {
      const hov = Math.sin(t * TAU) * 2;
      for (let y = 42; y <= 96; y += 9) {
        const w = 17 - (y - 42) * 0.17;
        for (let x = -w; x <= w; x++) P.fx(64 + x, y + hov, (Math.round(x + t * 40) % 9) < 2 ? '#ffffff' : '#8ad0ff', 0.75);
      }
      glow(P, 64, 66 + hov, 5.5, st.wind ? '#fff8a0' : '#8ad0ff', 0.85);
    },
    parts: Object.fromEntries([0, 1, 2].flatMap((i) => ['back', 'front'].map((layer) => [`vane${i}${layer}`, {
      w: 18, h: 52, px: 9, py: 26, role: 'sway', layer, z: 1, depth: 0.02,
      at: (J, R) => {
        const a = (R ? R.t : 0) * 0.6 + (i / 3) * TAU;
        return [64 + Math.cos(a) * 30, 68 + Math.sin(J.t * TAU) * 2];
      },
      show: (R) => (Math.sin(R.t * 0.6 + (i / 3) * TAU) >= 0) === (layer === 'front'),
      body(X) {
        X.in(0, 1);
        X.slab([[9, 2], [14, 8], [15, 44], [9, 50], [4, 44], [5, 8]], layer === 'front' ? '#3a3a5a' : ALLOY_LO, 'metal', { rz: 3, bevel: 2 });
      },
      glow(P) {
        for (let y = 8; y < 46; y += 2) P.fx(9, y, '#8ad0ff', 0.6);
      },
    }]))),
    fx(R, ctx) {
      const { x, y, r, st } = R;
      const t = r.time;
      // Rain off it, always.
      ctx.fillStyle = '#8ab8e0';
      for (let i = 0; i < 26; i++) {
        const k = (t * 1.6 + i / 26) % 1;
        const px = x - 34 + ((i * 37) % 68);
        ctx.globalAlpha = 0.6 * (1 - k);
        ctx.fillRect(Math.round(px), Math.round(y - 96 + k * 94), 1, 3);
      }
      // Lightning between its vanes.
      if (st.wind || Math.sin(t * 5) > 0.75) {
        ctx.globalAlpha = 0.9;
        ctx.fillStyle = Math.floor(t * 30) % 2 ? '#ffffff' : '#fff8a0';
        let px = x - 30;
        let py = y - 60;
        for (let s = 0; s < 20; s++) {
          px += 3;
          py += (Math.random() - 0.5) * 6;
          ctx.fillRect(Math.round(px), Math.round(py), 2, 1);
        }
      }
      ctx.globalAlpha = 1;
    },
  },

  // The Prime: the foundry's engine of war, the Kavorent's own. Plates of
  // violet stone over a core of orange fire, cold light running in its
  // seams, a visor slit burning; its fists like anvils (its arms, parts),
  // its shoulder-stones floating off it on their own (parts).
  prime: {
    size: 128, ax: 64, ay: 126, walk: true,
    body(X, J, t, st) {
      const stone = '#3e3050';
      const b = J.b;
      const walk = st.walk ? Math.sin(t * TAU) : 0;
      X.in(0, 2);
      // Legs: blocks of stone, stepping.
      for (const [x, s] of [[46, 1], [82, -1]]) {
        const lift = st.walk ? Math.max(0, s * walk) * 4 : 0;
        X.slab([[x - 10, 84], [x + 10, 84], [x + 9 + s * walk * 3, 112 - lift], [x - 9 + s * walk * 3, 112 - lift]], stone, 'rock', { rz: 10, bevel: 3, cell: 10 });
        X.slab([[x - 13 + s * walk * 3, 110 - lift], [x + 13 + s * walk * 3, 110 - lift], [x + 13 + s * walk * 3, 123 - lift], [x - 13 + s * walk * 3, 123 - lift]], tone(stone, 0.8), 'rock', { rz: 8, bevel: 2.5, cell: 10 });
        X.ball(x, 84, 12, 8, tone(stone, 0.9), 'rock', { rz: 8, cell: 10 });
      }
      // The trunk: broad at the shoulders, narrowing; its head sunk between.
      X.in(1, 2.4);
      X.slab([[22, 38 - b], [106, 38 - b], [92, 88], [36, 88]], stone, 'rock', { rz: 18, bevel: 7, cell: 12 });
      X.slab([[46, 14 - b], [82, 14 - b], [84, 38 - b], [44, 38 - b]], tone(stone, 1.08), 'rock', { rz: 14, bevel: 4, cell: 10, z: 4 });
      // Its core, in a ring of alloy.
      X.ball(64, 58 - b, 13, 13, ALLOY, 'metal', { rz: 6, z: 14 });
      X.ball(64, 58 - b, 9.5, 9.5, st.wind ? '#ffd090' : '#ff9050', 'molten', { rz: 4, z: 18, glow: '#ffb060', glowK: 0.7 });
    },
    paint(P, J) {
      const b = Math.round(J.b);
      // Cracks across its stone.
      for (const [a, c] of [[[30, 46], [38, 54]], [[96, 50], [90, 62]], [[50, 80], [56, 86]], [[76, 76], [70, 84]]]) crease(P, a[0], a[1] - b, c[0], c[1] - b, 0.45);
      P.rect(50, 24 - b, 28, 4, '#140e1e');
    },
    glow(P, J, t, st) {
      const b = J.b;
      seamLine(P, [[28, 42 - b], [64, 70 - b], [100, 42 - b]], t);
      seamLine(P, [[64, 70 - b], [64, 88 - b]], t, 1);
      seamLine(P, [[40, 86], [88, 86]], t, 2);
      for (let x = 52; x <= 76; x++) P.fx(x, 25 - b, st.wind ? '#ffffff' : '#ff9050', 0.95);
      glow(P, 64, 58 - b, 16, '#ff9050', 0.3);
    },
    parts: {
      ...Object.fromEntries([-1, 1].map((side) => [side < 0 ? 'armF' : 'armN', {
        w: 34, h: 62, px: 17, py: 8, role: side < 0 ? 'offhand' : 'weapon', layer: side < 0 ? 'back' : 'front', z: 2, amp: 0.8,
        at: (J) => [64 + side * 40, 44 - J.b],
        body(X) {
          X.in(0, 2);
          X.slab([[9, 6], [25, 6], [24, 34], [10, 34]], '#3e3050', 'rock', { rz: 9, bevel: 3, cell: 8 });
          X.in(1, 1.6);
          X.slab([[4, 32], [30, 32], [30, 58], [4, 58]], '#4a3a5e', 'rock', { rz: 12, bevel: 3, cell: 8, z: 4 });
        },
        glow(P) {
          seamLine(P, [[6, 45], [28, 45]], 0, side);
          seamLine(P, [[17, 34], [17, 56]], 0, side + 1);
        },
      }])),
      ...Object.fromEntries([-1, 1].map((side) => [side < 0 ? 'stoneF' : 'stoneN', {
        w: 30, h: 22, px: 15, py: 11, role: 'sway', layer: side < 0 ? 'back' : 'front', z: 6, depth: 0.08, rate: 1.4, phase: side,
        at: (J, R) => [64 + side * 44, 26 - J.b + Math.sin((R ? R.t : 0) * 2.2 + side) * 3],
        body(X) {
          X.in(0, 1.4);
          X.slab([[2, 6], [26, 3], [28, 16], [4, 20]], '#4e4060', 'rock', { rz: 8, bevel: 3, cell: 8 });
        },
        glow(P) {
          for (let x = 5; x < 26; x++) P.fx(x, 21, SEAM, 0.7);
        },
      }])),
    },
  },
});

forge({
  // The Ossuary Horror: the dead of the drowned crypt heaped into one
  // thing. A mound of grey-green rotten flesh knotted through with bones,
  // a ribcage arched over a heart of red light that throbs, skulls set in
  // it whose eyes come and go; two arms of bone ending in blades (parts);
  // and legs of bone under it, knobbed, a skull at every knee.
  horror: {
    size: 64, ax: 32, ay: 62, breath: 1.4,
    body(X, J, t) {
      const b = J.b;
      const beat = Math.max(0, Math.sin(t * TAU * 2)) ** 2;
      X.in(0, 3.2);
      X.ball(32, 30 - b, 23, 14, '#5a5a48', 'flesh', { rz: 12 });
      X.ball(16, 34 - b * 0.5, 10, 7, '#4a4a3a', 'flesh', { z: 3, rz: 5 });
      X.ball(48, 34 - b * 0.5, 10, 7, '#4a4a3a', 'flesh', { z: 3, rz: 5 });
      X.ball(32, 18 - b, 13, 7, '#6a6a54', 'flesh', { z: 2, rz: 6 });
      // Bones knotted through it.
      X.in(1, 0.8);
      for (let i = 0; i < 16; i++) {
        const a = (i * 2.399) % TAU;
        const rr = 8 + ((i * 7) % 12);
        const x = 32 + Math.cos(a) * rr * 1.15;
        const y = 30 - b + Math.sin(a) * rr * 0.55;
        if (Math.abs(x - 32) < 9 && Math.abs(y - 28 + b) < 7) continue;
        X.tube(x, y, x + Math.cos(a + 1.3) * 5, y + Math.sin(a + 1.3) * 3, 1.1, 0.9, i % 3 ? '#d8d0b8' : '#b8b098', 'bone', { z: 9 });
      }
      // The cavity, the heart.
      X.ball(32, 28 - b, 9, 6.5, '#1a0606', 'flesh', { z: 8, rz: 1 });
      X.ball(32, 28 - b, 4.4 + beat * 1.4, 3.4 + beat, '#ff4030', 'molten', { z: 10, rz: 2.4, glow: '#ff9060', glowK: 0.4 + beat * 0.4 });
      // Ribs arched over it.
      X.in(2, 0.6);
      for (let k = -2; k <= 2; k++) {
        const pts = [];
        for (let y = -7; y <= 7; y += 3.5) pts.push([32 + k * 3.8 + ((y * y) / 12) * Math.sign(k || 1), 28 - b + y, 1.1, 13 - Math.abs(y) * 0.3]);
        X.limb(pts, k === 0 ? '#c8c0a8' : '#d8d0b8', 'bone');
      }
      // Skulls set in it.
      for (const [x, y] of [[14, 24], [22, 17], [42, 17], [50, 24], [17, 35], [47, 35], [32, 14]]) {
        X.ball(x, y - b, 3.6, 3.3, '#e0d8c0', 'bone', { z: 14, rz: 3 });
        X.ball(x - 0.6, y + 2.4 - b, 2.3, 1.4, '#c8c0a8', 'bone', { z: 14.4, rz: 1.2 });
      }
    },
    paint(P, J, t) {
      const b = J.b;
      for (const [x, y, k] of [[14, 24, 0], [22, 17, 1], [42, 17, 2], [50, 24, 3], [17, 35, 4], [47, 35, 5], [32, 14, 6]]) {
        const lit = Math.floor(t * 8 + k) % 4 !== 0;
        for (const dx of [-2, 1]) P.rect(x + dx, Math.round(y - b), 1, 2, lit ? '#ff4030' : '#1a0a0a');
        P.set(x - 1, Math.round(y + 2 - b), hex('#3a2a20'));
      }
      P.over((x, y, c) => (hash2(x, y, 4) < 0.08 ? shade(c, 0.82) : null));
    },
    glow(P, J, t) {
      const beat = Math.max(0, Math.sin(t * TAU * 2)) ** 2;
      glow(P, 32, 28 - J.b, 7 + beat * 2, '#ff4030', 0.35 + beat * 0.3);
    },
    parts: Object.fromEntries([-1, 1].map((side) => [side < 0 ? 'armF' : 'armN', {
      w: 26, h: 34, px: side < 0 ? 20 : 6, py: 5, role: side < 0 ? 'offhand' : 'weapon', layer: side < 0 ? 'back' : 'front', sign: side < 0 ? 1 : -1, amp: 0.8,
      at: (J) => [32 + side * 18, 24 - J.b],
      body(X) {
        const x0 = side < 0 ? 20 : 6;
        const s = side < 0 ? -1 : 1;
        X.in(0, 1);
        X.limb([[x0, 5, 1.6, 2], [x0 + s * 6, 14, 1.4, 3]], '#d8d0b8', 'bone');
        X.ball(x0 + s * 6, 14, 2, 2, '#e0d8c0', 'bone', { z: 4, rz: 1.4 });
        X.limb([[x0 + s * 6, 14, 1.3, 3], [x0 + s * 4, 22, 1.1, 3]], '#d8d0b8', 'bone');
        // The blade: a shoulder-blade honed to an edge.
        X.slab([[x0 + s * 2, 21], [x0 + s * 7, 21], [x0 + s * 10, 26], [x0 + s * 4, 33]], '#e8e0c8', 'bone', { rz: 1.2, bevel: 1, z: 5 });
      },
    }])),
    legs: {
      style: 'bone', L1: 16, L2: 19, stepT: 0.2, reach: 0.5, arc: 5, thud: true,
      legs: [[1.15], [0], [-1.15]], vFar: -0.8, vNear: 0.65,
      hips: [[[22, 38], [22, 42]], [[32, 39], [32, 43]], [[42, 38], [42, 42]]],
    },
    fx(R, ctx) {
      // Flies, always.
      const t = R.r.time;
      ctx.fillStyle = '#1a1a14';
      for (let i = 0; i < 7; i++) {
        const a = t * (2 + i * 0.3) + i;
        ctx.fillRect(Math.round(R.x + Math.cos(a) * (14 + i * 2)), Math.round(R.y - 40 + Math.sin(a * 1.3) * 8), 1, 1);
      }
    },
  },

  // The Deep Worm: the thing the mine broke into. A great segmented column
  // rearing out of a ragged hole, ringed and bristled, its skin wet and
  // grey-pink; its head (a part, swaying, rearing back as it strikes) a
  // three-jawed beak that opens on rings of teeth (the jaws, parts of it).
  worm: {
    size: 64, ax: 32, ay: 60,
    body(X, J, t, st) {
      const heave = st.wind ? 2 : Math.max(0, Math.sin(t * TAU)) * 0.8;
      // The broken floor round its hole.
      X.in(0, 2);
      X.ball(32, 56 - heave * 0.5, 26 + heave, 6 + heave * 0.5, '#5a4a3a', 'rock', { rz: 3 + heave, cell: 3 });
      for (let i = 0; i < 6; i++) X.ball(10 + i * 9, 53 - heave - (i % 2), 3, 2.2, '#6a5a48', 'rock', { z: 3 + heave, rz: 2, cell: 2 });
      X.ball(32, 55.5, 16, 3.4, '#140e0a', 'ink', { z: 5 + heave, rz: 0.4 });
      // The lower body, coming up out of it.
      X.in(1, 1.4);
      for (let i = 0; i < 4; i++) {
        const y = 54 - i * 5.5;
        const x = 32 + Math.sin(t * TAU + i * 0.5) * (i * 0.5);
        X.ball(x, y, 10.5 - i * 0.3, 4, i % 2 ? '#9a6a6a' : '#a87878', 'flesh', { rz: 5, z: 6 + i });
        X.ball(x, y + 2.4, 10.7 - i * 0.3, 1.2, '#6a4a4a', 'flesh', { rz: 1, z: 6.4 + i });
      }
    },
    paint(P) {
      // Bristles along its rings.
      for (let y = 30; y < 56; y += 6) for (const s of [-1, 1]) {
        const x = 32 + s * 10;
        if (P.get(x - s, y)[3]) {
          P.set(x, y, hex('#3a2a28'));
          P.set(x + s, y - 1, hex('#3a2a28'));
        }
      }
    },
    parts: {
      neck: {
        w: 30, h: 34, px: 15, py: 30, role: 'head', layer: 'front', z: 2, amp: 1.6,
        at: (J) => [32, 36],
        body(X) {
          X.in(0, 1.4);
          for (let i = 0; i < 4; i++) {
            const y = 28 - i * 5.5;
            X.ball(15, y, 9.4 - i * 0.4, 4, i % 2 ? '#9a6a6a' : '#b88888', 'flesh', { rz: 5, z: i });
            X.ball(15, y + 2.4, 9.6 - i * 0.4, 1.2, '#6a4a4a', 'flesh', { rz: 1, z: i + 0.4 });
          }
          X.ball(15, 6, 8.4, 5.4, '#b89898', 'flesh', { rz: 5, z: 6 });
        },
      },
      jawL: {
        w: 12, h: 16, px: 9, py: 13, role: 'jaw', layer: 'front', parent: 'neck', at: [11, 6], z: 3, amp: 1.3,
        body(X) {
          X.in(0, 0.8);
          X.slab([[9, 13], [11, 10], [6, 2], [2, 1], [4, 8]], '#d8b8a8', 'chitin', { rz: 2, bevel: 1 });
        },
        paint(P) {
          for (let i = 0; i < 4; i++) P.set(6 + (i % 2), 4 + i * 2, hex('#f0e8d8'));
        },
      },
      jawR: {
        w: 12, h: 16, px: 3, py: 13, role: 'jaw', layer: 'front', parent: 'neck', sign: 1, at: [19, 6], z: 3, amp: 1.3,
        body(X) {
          X.in(0, 0.8);
          X.slab([[3, 13], [1, 10], [6, 2], [10, 1], [8, 8]], '#c8a898', 'chitin', { rz: 2, bevel: 1 });
        },
        paint(P) {
          for (let i = 0; i < 4; i++) P.set(5 - (i % 2), 4 + i * 2, hex('#f0e8d8'));
        },
      },
      maw: {
        w: 10, h: 8, px: 5, py: 6, role: 'none', layer: 'front', parent: 'neck', at: [15, 3], z: 2.5,
        body(X) {
          X.in(0, 0.6);
          X.ball(5, 4, 3.6, 2.6, '#3a0a10', 'flesh', { rz: 1 });
        },
        paint(P) {
          for (let i = 0; i < 6; i++) P.set(2 + i, i % 2 ? 3 : 5, hex('#f0e8d8'));
        },
      },
    },
    fx(R, ctx) {
      // Earth crumbling back into the hole.
      const t = R.r.time;
      for (let i = 0; i < 6; i++) {
        const k = (t * 1.6 + i / 6) % 1;
        ctx.globalAlpha = 1 - k;
        ctx.fillStyle = '#8a7a60';
        ctx.fillRect(Math.round(R.x - 14 + i * 6), Math.round(R.y - 8 + k * 6), 1, 1);
      }
      ctx.globalAlpha = 1;
    },
  },
});
