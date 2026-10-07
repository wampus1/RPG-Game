// (Round 71) The masters of Kharos's old places, forged anew (see forge.js,
// forgekit.js): the burning kings and priests of the kilns, the Urn-Mother
// on her smoke, the Glass Wyrm, the slug that tends the magma, the boiler
// on legs, the Abbess in her panes of black glass, the Horror of fused
// glass and bone, the Reaver, the Bombard Queen, the chained Drake, the
// Slag Titan and the Molten Heart in its chains.
import { forge, inPose, partAt } from './forge.js';
import { eyes, glow, glowLine, rivets, along, dk, lt, mx, HG, figure, crease, quadruped, beastHead, jawPart, tailPart, wingPart, orbit } from './forgekit.js';
import { flame, embers, smoke, puff, drops, glowAt, sparks, dot } from './forgefx.js';
import { hex, mix, shade, toHex } from './pixel.js';
import { hash2 } from './paint.js';
import { bodyOf, drawBody, drawStrand } from './bossrig.js';
import { beastCurl, beastSerpent, ashSkin, wyrmCfg, drakeChain, heartChains, beatOf } from './bossbeasts.js';

const TAU = Math.PI * 2;
const HOT = '#ff6a1a';
const CORE = '#ffe890';
// A glowing crack (a hot line, white at its corners), painted after.
function crack(P, pts, hot = HOT, core = CORE, k = 1) {
  for (let i = 0; i + 1 < pts.length; i++) glowLine(P, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], hot, 0.9 * k, false);
  for (let i = 1; i + 1 < pts.length; i++) P.fx(pts[i][0], pts[i][1], core, k);
}
// Seams of fire through a crust: the edges of cells (each about `cell`
// across) between rows y0..y1, where the crust is.
function seams(P, y0, y1, cell, col, o = {}) {
  const pts = [];
  for (let gy = Math.floor(y0 / cell) - 1; gy <= Math.ceil(y1 / cell) + 1; gy++) {
    for (let gx = -1; gx <= Math.ceil(64 / cell) + 1; gx++) pts.push([(gx + hash2(gx, gy, 5)) * cell, (gy + hash2(gx, gy, 6)) * cell, gx * 31 + gy]);
  }
  const dark = o.dark ?? 0.6;
  P.over((x, y, c) => {
    if (y < y0 || y > y1 || !c[3]) return null;
    let d1 = 1e9;
    let d2 = 1e9;
    let i1 = 0;
    let i2 = 0;
    for (const [px, py, id] of pts) {
      const d = Math.hypot(x - px, y - py);
      if (d < d1) {
        d2 = d1;
        i2 = i1;
        d1 = d;
        i1 = id;
      } else if (d < d2) {
        d2 = d;
        i2 = id;
      }
    }
    const e = d2 - d1;
    if (e < 0.55) {
      // (Some seams hot, some only warm.)
      const k = hash2(Math.min(i1, i2), Math.max(i1, i2), 9);
      return k < (o.hot ?? 0.55) ? col : mix(shade(c, 0.6), col, 0.35);
    }
    // (The crust darker along each seam's lip.)
    return e < 1.4 ? shade(c, dark + (e - 0.55) * 0.3) : null;
  });
}
// The head of a figure (see forgekit.figure): where its middle is on its
// own picture, for partAt.
const HC = { x: 14, y: 14 };
const onHead = (R, dx, dy) => partAt(R, 'head', HC.x + dx, HC.y + dy);
// Where the tip of a figure's weapon is, `d` along it.
const onBlade = (R, d, side = 0) => {
  const q = R.D.parts.blade;
  const wang = R.D.parts.armN.wang;
  const a = along({ x: q.px, y: q.py }, wang, d, side);
  return partAt(R, 'blade', a.x, a.y);
};

const DRAKE_HEAD = beastHead({ kind: 'dragon', r: 6, col: '#8a2a1e', mat: 'scales', horns: 'swept', hornCol: '#e8d8b0', eye: '#ffd060', at: [17, 26], z: 6, w: 34, h: 28, cx: 18, cy: 14, nose: '#2a0a08' });
const ABBESS = figure({
      stance: { h: 1.06, w: 0.94 },
      robe: { col: '#1e1824', mat: 'velvet', trim: '#c8b8f0', trimMat: 'glass', front: '#2a2234', flare: 1.1 },
      torso: { col: '#1e1824', mat: 'velvet', build: 'lean' },
      belt: { col: '#140e1a', buckle: '#c8b8f0' },
      head: {
        kind: 'man', r: 5, col: '#c8c0d0', face: { eye: '#c8b8f0', white: '#e8e0ff', mouth: 2 },
        extra(X, c, r) {
          // Her veil: over her crown and down her back to her shoulders,
          // the white band of the wimple at her brow.
          X.in(HG.head, 1);
          X.ball(c.x + r * 0.4, c.y - r * 0.5, r * 1.18, r * 0.88, '#2a2234', 'velvet', { z: 16, rz: 3 });
          X.limb([[c.x + r * 0.7, c.y - r * 0.3, r * 0.95, 13], [c.x + r * 1.2, c.y + r * 1.4, r * 0.9, 12], [c.x + r * 1.3, c.y + r * 2.6, r * 0.7, 11]], '#2a2234', 'velvet');
          X.tube(c.x - r * 0.95, c.y - r * 0.55, c.x + r * 0.9, c.y - r * 0.85, r * 0.2, r * 0.2, '#e8e0f0', 'cloth', { z: 17.5 });
          X.limb([[c.x - r * 0.2, c.y + r * 0.95, r * 0.55, 15], [c.x + r * 0.5, c.y + r * 1.2, r * 0.6, 15]], '#e8e0f0', 'cloth');
        },
        glow(P, c, r) {
          eyes(P, [[Math.round(c.x - r * 0.62), Math.round(c.y - r * 0.08)], [Math.round(c.x - r * 0.08), Math.round(c.y - r * 0.08)]], '#c8b8f0');
        },
      },
      arm: { col: '#c8c0d0', r: 2.8, sleeve: '#1e1824', sleeveMat: 'velvet', L1: 8.6, L2: 8, wang: 0.3 },
      armF: { col: '#c8c0d0', r: 2.8, sleeve: '#1e1824', sleeveMat: 'velvet' },
      holds: { kind: 'orb', col: '#c8b8f0', r: 2.6 },
      sculpt(X, J) {
        // The stone of her order at her throat, on its chain.
        X.in(HG.front, 1);
        X.ball(J.neck.x - 0.5, J.neck.y + 5, 1.8, 2.2, '#c8b8f0', 'glass', { z: 20, rz: 1.6, glow: '#c8b8f0', glowK: 0.4 });
        X.limb([[J.neck.x - 3, J.neck.y + 1, 0.4, 19], [J.neck.x - 0.5, J.neck.y + 3.2, 0.4, 19], [J.neck.x + 2.5, J.neck.y + 1, 0.4, 19]], '#c8b8f0', 'gold');
      },
    });

forge({
  // ------------------------------------------------------------ the Cinder Court
  // The Cinder King: a king who sat his throne while his hall burned round
  // him and never got up. His skin gone to charcoal, split with fire; his
  // hair and beard flame; plate blackened with soot, edged in hot copper;
  // a crown burning at every point; and the greatsword he holds, its edge
  // glowing, runes of fire down it.
  cinder_king: {
    ...figure({
      stance: { h: 1.02, w: 1.12 },
      legs: { col: '#2a2020', mat: 'cloth', r: 4.5, greave: '#3e302c', thigh: '#2e2420', boot: '#1e1612', bootMat: 'metal' },
      torso: { col: '#3a2e2c', build: 'muscle', wide: 1.04 },
      plate: { col: '#3e302c', skirt: '#2a1810', skirtMat: 'cloth', trim: '#c86a20', emblem: '#ff8030', emblemMat: 'glass' },
      belt: { col: '#1e1410', buckle: '#c86a20' },
      pauldronF: { col: '#3e302c', r: 5.8, spikes: 2, spikeLen: 3.4, trim: '#c86a20' },
      gorget: '#3e302c',
      gorgetMat: 'metal',
      head: {
        kind: 'man', r: 5.3, col: '#5a4440', hair: '#2a2220', hairStyle: 'short', beard: '#3a2a24',
        crown: { col: '#8a6020', n: 5, tall: 4.4, gem: '#ff8030' },
        face: { eye: '#ff6010', white: '#ffd080', teeth: true },
        paint(P, c) {
          // Fire in the cracks of his face.
          crack(P, [[c.x - 2, c.y - 4], [c.x - 1, c.y - 2], [c.x - 2, c.y]], '#ff7a20', '#ffe070', 0.8);
          crack(P, [[c.x + 2, c.y + 1], [c.x + 3, c.y + 3]], '#ff7a20', '#ffe070', 0.7);
        },
        glow(P, c, r) {
          eyes(P, [[Math.round(c.x - r * 0.62), Math.round(c.y - r * 0.08)], [Math.round(c.x - r * 0.08), Math.round(c.y - r * 0.08)]], '#ffb040');
          glow(P, c.x - r * 0.35, c.y, 3, '#ff6010', 0.35);
        },
      },
      cape: { col: '#2a1410', mat: 'velvet', ragged: true, w: 30, h: 40, lining: '#a03a10', clasp: '#c86a20' },
      arm: { col: '#3a2e2c', r: 3.9, gauntlet: '#3e302c', L1: 8.8, L2: 8.4, wang: 0.95, pauldron: { col: '#3e302c', r: 6, spikes: 3, spikeLen: 3.8, trim: '#c86a20' } },
      weapon: {
        kind: 'greatsword', len: 30, width: 2.8, col: '#4a3a34', guard: '#8a6020', pommel: '#ff8030', grip: '#1e1410', gripMat: 'leather',
        glow(P, { H, wang }) {
          // Its edge white-hot, its runes of fire.
          for (let d = 5; d < 30; d++) {
            const a = along(H, wang, d, -2.3);
            P.fx(a.x, a.y, d % 3 ? '#ff8030' : '#ffe070', 0.8);
          }
          for (let i = 0; i < 4; i++) {
            const a = along(H, wang, 8 + i * 5);
            const b = along(H, wang, 10 + i * 5, i % 2 ? 0.8 : -0.8);
            glowLine(P, a.x, a.y, b.x, b.y, '#ffb040', 0.9);
          }
        },
      },
      fist: { col: '#3e302c', r: 2.8 },
      armF: { col: '#3a2e2c', r: 3.7, gauntlet: '#3e302c' },
      paint(P, J) {
        // Seams of fire between his plates, rivets.
        const c = J.chest;
        crack(P, [[c.x - 6, c.y + 4], [c.x - 3, c.y + 6], [c.x - 4, c.y + 9]], '#ff6a1a', '#ffe070', 0.75);
        rivets(P, [[c.x - 7, c.y - 1], [c.x + 6, c.y - 1], [c.x - 6, c.y + 3], [c.x + 5, c.y + 3]], '#e0a060');
      },
    }),
    fx(R, ctx, pose) {
      const t = R.r.time;
      const hot = R.st.wind || (R.A && R.A.k);
      inPose(R, ctx, pose, () => {
        // His crown burns: a flame off every point.
        for (let i = 0; i < 5; i++) {
          const p = onHead(R, -5.2 + i * 2.6, -9.6 + (i % 2) * 1.4);
          flame(ctx, p.x, p.y, (hot ? 7 : 5) - (i % 2), t, { ph: i * 1.3, w: 2 });
        }
        // His blade's edge, smouldering.
        for (let i = 0; i < 3; i++) {
          const p = onBlade(R, 12 + i * 7, -2);
          flame(ctx, p.x, p.y, hot ? 5 : 3, t, { ph: i * 2.1, w: 1.5, a: 0.8 });
        }
        embers(ctx, R.ox + 14, R.oy + 56, 36, t, { n: 7, rise: 40 });
      });
    },
  },

  // The Urn-Mother: a great burial urn, glazed and painted in bands, a face
  // painted on her belly that opens its eyes; cracked through and glowing
  // within; arms of ash out of her sides, waving, embers in them; her lid
  // riding on the smoke, thrown back as she breathes in.
  urn_mother: {
    size: 64, ay: 62, breath: 0.6,
    body(X, J) {
      const clay = '#b0603a';
      const b = J.b;
      X.in(0, 3);
      // The foot she stands on.
      X.slab([[21, 53], [43, 53], [45, 61.5], [19, 61.5]], dk(clay, 0.8), 'ceramic', { rz: 5, bevel: 3 });
      X.ball(32, 54, 12, 2, dk(clay, 0.6), 'ceramic', { z: 3, rz: 1 });
      // Her belly, swelling as she breathes; her shoulder, her neck.
      X.ball(32, 39 - b * 0.3, 19 + b * 0.3, 16 + b * 0.4, clay, 'ceramic', { rz: 15 });
      X.ball(32, 27, 14, 5, lt(clay, 1.05), 'ceramic', { rz: 6, z: 8 });
      X.tube(32, 25, 32, 19, 8.6, 7.2, clay, 'ceramic', { z: 6 });
      X.in(1, 1);
      // The lip, and the dark mouth under her lid.
      X.ball(32, 17.6, 11, 3.2, dk(clay, 0.9), 'ceramic', { rz: 3, z: 8 });
      X.ball(32, 17.6, 8, 1.6, '#1a0e0a', 'ink', { z: 11, rz: 0.4 });
      // Handles, lugs on her shoulders.
      for (const s of [-1, 1]) X.limb([[32 + s * 13, 25, 1.6, 10], [32 + s * 17, 27, 1.6, 10], [32 + s * 16, 31, 1.4, 10]], dk(clay, 0.9), 'ceramic');
    },
    paint(P, J, t, st) {
      // The painted bands round the curve of her: black, a meander in
      // cream, a frieze of figures (little dancing dark people).
      P.over((x, y, c) => {
        const dx = x - 32;
        if (Math.abs(dx) > 18) return null;
        const curve = Math.round((dx * dx) / 90);
        const yy = y - curve;
        if (yy === 25 || yy === 26 || yy === 50 || yy === 51) return mix(c, [42, 20, 14], 0.75);
        if (yy >= 28 && yy <= 31 && (x + (yy - 28) * 2) % 8 < 3) return mix(c, [240, 208, 144], 0.6);
        if (yy >= 46 && yy <= 48 && ((x % 6 < 1) || (yy === 47 && x % 3 === 0))) return mix(c, [42, 20, 14], 0.6);
        return null;
      });
      // Her face: almond eyes (lit as she wakes), the line of a mouth.
      const hot = st.wind || st.inhale;
      // (Slanted, heavy-lidded, painted in black and cream; a brow of
      // black over each.)
      for (const [ex, s] of [[24, 1], [40, -1]]) {
        P.poly([[ex - 4, 38 + s], [ex, 36.5], [ex + 4, 38 - s], [ex, 40.5]], '#e8d0a0', { lv: 0.7, contrast: 0.4 });
        P.rect(ex - 1, 38, 2, 2, hot ? '#ffb040' : '#1a0a06');
        for (let i = -4; i <= 4; i++) P.set(ex + i, Math.round(35.5 + s * i * 0.35), hex('#2a140e'));
      }
      if (st.inhale) P.blob(32, 46, 3.4, 3, '#1a0a06', { lift: 0 });
      else {
        // A mouth of jagged black, as if it had cracked open there.
        const m = [[26, 45], [28, 47], [30, 45], [32, 47], [34, 45], [36, 47], [38, 45]];
        for (let i = 0; i + 1 < m.length; i++) P.line(m[i][0], m[i][1], m[i + 1][0], m[i + 1][1], '#1a0a06');
      }
      // Old chips and glaze runs.
      for (let i = 0; i < 14; i++) {
        const x = 16 + Math.floor(hash2(i, 3, 7) * 32);
        const y = 28 + Math.floor(hash2(i, 5, 7) * 24);
        const q = P.get(x, y);
        if (q[3]) P.set(x, y, shade(q, i % 3 ? 1.18 : 0.7));
      }
    },
    glow(P, J, t, st) {
      crack(P, [[44, 28], [46, 33], [44, 37], [47, 42]]);
      crack(P, [[16, 42], [18, 46], [16, 50]]);
      crack(P, [[30, 52], [32, 55], [31, 60]]);
      if (st.wind || st.inhale) for (const ex of [24, 40]) glow(P, ex, 39, 3, '#ffb040', 0.5);
      if (st.inhale) glow(P, 32, 46, 4, '#ff8030', 0.5);
    },
    parts: {
      // The lid, riding the smoke: bobbing, tilting; thrown back as she
      // breathes in.
      lid: {
        w: 28, h: 14, px: 14, py: 9, role: 'none', layer: 'front', z: 2,
        at: (J, R) => {
          const inh = R && R.st.inhale;
          const lift = inh ? 10 : 2 + Math.max(0, Math.sin((R ? R.t : 0) * 2.2)) * 2.5;
          return [32 + (inh ? 5 : 0), 15 - lift];
        },
        extra: (R) => (R.st.inhale ? 0.55 : Math.sin(R.t * 1.3) * 0.1),
        body(X) {
          X.in(0, 1);
          X.ball(14, 9, 11, 3.2, '#8a4a2c', 'ceramic', { rz: 3 });
          X.ball(14, 8, 9, 2, '#a05a34', 'ceramic', { rz: 2, z: 2 });
          X.ball(14, 5.5, 3, 2.8, '#d8a050', 'gold', { z: 3, rz: 2 });
        },
        paint(P) {
          for (let x = 5; x < 24; x += 3) P.set(x, 9, hex('#2a140e'));
        },
      },
    },
    behind(R) {
      // Her ash arms: out of her shoulders and up, waving, fingers spread,
      // embers in the ash; up and grasping as she works.
      const up = R.st.wind || R.st.inhale || (R.A && R.A.k) ? 1 : 0;
      for (const s of [-1, 1]) {
        const bx = R.ox + 32 + s * 15;
        const by = R.oy + 30;
        const pts = beastCurl(bx, by, -Math.PI / 2 + s * (0.9 - up * 0.35), 9, 2.8, R.t, s * 1.7, 0.22, 1.8);
        const cv = (R.e.rig.ashCv ||= [{}, {}])[s > 0 ? 1 : 0];
        const arm = bodyOf([...pts].reverse(), { rad: (k) => 1.2 + 2 * k, skin: ashSkin(R.t), gloss: 0 }, cv);
        drawBody(R.ctx, arm.back);
        const tip = pts[pts.length - 1];
        for (let i = 0; i < 4; i++) {
          const a = -Math.PI / 2 + s * (-0.5 + i * 0.4) + Math.sin(R.t * 3 + i) * 0.15;
          drawStrand(R.ctx, [tip, { x: tip.x + Math.cos(a) * 4.5, y: tip.y + Math.sin(a) * 4.5 }], '#6a6260', 1, 1);
        }
      }
    },
    fx(R, ctx, pose) {
      const t = R.r.time;
      inPose(R, ctx, pose, () => {
        if (R.st.inhale) {
          // Smoke drawn into her mouth from all round.
          for (let i = 0; i < 8; i++) {
            const k = (t * 1.2 + i / 8) % 1;
            const a = i * 0.8;
            puff(ctx, R.ox + 32 + Math.cos(a) * (1 - k) * 26, R.oy + 16 + Math.sin(a) * (1 - k) * 12, 1.5, '#9a908a', 0.6 * k);
          }
        } else smoke(ctx, R.ox + 32, R.oy + 12, t, { n: 6, rise: 22, col: '#8a8280', dark: '#5a5250', a: 0.45 });
        for (const [x, y] of [[46, 33], [18, 46]]) dot(ctx, R.ox + x, R.oy + y, CORE, 0.5 + 0.5 * Math.sin(t * 5 + x));
        embers(ctx, R.ox + 14, R.oy + 40, 36, t, { n: 4, rise: 30, speed: 0.3 });
      });
    },
  },

  // The Smoke Herald: tall in robes of ash, his face lost in his hood but
  // for the coals of his eyes; smoke pouring off him from under his hem;
  // and the great horn he blows to call the smoke down on you.
  smoke_herald: {
    ...figure({
      stance: { h: 1.05, w: 0.98 },
      robe: { col: '#3e3836', ragged: true, trim: '#6a2a14', trimMat: 'cloth', front: '#2e2826', flare: 1.2 },
      torso: { col: '#3e3836', mat: 'cloth', build: 'lean' },
      belt: { col: '#2a2220', buckle: '#ff6030' },
      head: {
        kind: 'hood', r: 5.8, col: '#4a4240',
        glow(P, c, r) {
          eyes(P, [[Math.round(c.x - r * 0.62), Math.round(c.y + r * 0.1)], [Math.round(c.x - r * 0.1), Math.round(c.y + r * 0.1)]], '#ff9050');
          glow(P, c.x - r * 0.35, c.y + r * 0.2, 3.4, '#ff6030', 0.3);
        },
      },
      arm: { col: '#8a8484', r: 3, sleeve: '#3e3836', L1: 8.6, L2: 8, wang: 0.5 },
      weapon: { kind: 'horn', len: 15, col: '#d8c8a0', band: '#8a6a3a' },
      fist: { col: '#8a8484', mat: 'skin', r: 2.4 },
      armF: { col: '#8a8484', r: 3, sleeve: '#3e3836' },
      sculpt(X, J) {
        // A stole of red over his shoulders, falling down his front.
        X.in(HG.armor, 1);
        X.limb([[J.neck.x - 3, J.neck.y + 2, 1.6, 12], [J.chest.x - 4, J.waist.y, 1.5, 12], [J.chest.x - 4.5, J.pelvis.y + 10, 1.3, 12]], '#6a2a14', 'velvet');
      },
      paint(P, J) {
        // Ash on his robe, burn-holes glowing at their edges.
        for (let i = 0; i < 10; i++) {
          const x = Math.round(J.waist.x - 10 + hash2(i, 2, 9) * 20);
          const y = Math.round(J.waist.y + 6 + hash2(i, 4, 9) * 22);
          const q = P.get(x, y);
          if (q[3]) P.set(x, y, mix(q, [150, 140, 136], 0.4));
        }
      },
      glow(P, J) {
        for (const [x, y] of [[J.waist.x + 6, J.pelvis.y + 14], [J.waist.x - 8, J.pelvis.y + 20]]) {
          P.fx(x, y, '#ff6030', 0.9);
          P.fx(x + 1, y, '#ffb040', 0.6);
        }
      },
    }),
    fx(R, ctx, pose) {
      const t = R.r.time;
      const blow = R.A && (R.A.k === 'cast' || R.A.k === 'summon' || R.A.k === 'roar');
      inPose(R, ctx, pose, () => {
        // Smoke off his hem, both sides; out of the horn as he blows it.
        for (const s of [-1, 1]) smoke(ctx, R.ox + 32 + s * 14, R.oy + 58, t + (s > 0 ? 0.5 : 0), { n: 5, rise: 26, spread: 4, drift: s * 6, col: '#8a8484', dark: '#5a5454', a: 0.45, grow: 4 });
        const m = onBlade(R, 15);
        smoke(ctx, m.x, m.y, t * (blow ? 3 : 1), { n: blow ? 8 : 3, rise: blow ? 26 : 10, drift: blow ? -14 : 0, col: '#a09a96', a: blow ? 0.7 : 0.3, grow: blow ? 5 : 2 });
      });
    },
  },

  // The Glass Wyrm: a serpent of black volcanic glass. It rears out of its
  // coils on a neck like a drawn bow, its head a long wedge of a skull with
  // brows like blades and a jaw that drops to strike; crystal spines down
  // its back with light running up them; and the rest of it strung out
  // behind over the floor along the way it came.
  glass_wyrm: {
    size: 64, ay: 60,
    body(X, J) {
      const glass = '#3a3058';
      X.in(0, 2.4);
      // Its coils where its neck comes up out of them.
      X.ball(34, 55, 15, 5.4, dk(glass, 0.85), 'obsidian', { rz: 5, along: 'x', cell: 4 });
      X.ball(28, 52 - J.b * 0.3, 11, 5, glass, 'obsidian', { rz: 5, z: 3, along: 'x', cell: 4 });
      X.ball(40, 51, 7, 4.4, glass, 'obsidian', { rz: 4, z: 2, cell: 4 });
      X.in(1, 1);
      for (let i = 0; i < 4; i++) X.tube(20 + i * 6, 49 - (i % 2), 22 + i * 6, 44 - (i % 2) * 2, 1.2, 0.3, '#8a78c8', 'glass', { z: 6 });
    },
    paint(P) {
      // Its belly plates along the coils.
      for (let x = 18; x < 48; x += 3) for (let y = 56; y < 60; y++) {
        const q = P.get(x, y);
        if (q[3]) P.set(x, y, shade(q, 0.7));
      }
    },
    parts: {
      neck: {
        w: 30, h: 42, px: 18, py: 39, role: 'head', layer: 'front', z: 2, amp: 2.2, phase: 0.5,
        at: [30, 52],
        body(X) {
          const glass = '#3a3058';
          X.in(0, 2);
          X.limb([[18, 40, 6.4, 2], [19, 30, 6, 4], [15, 18, 5.4, 6], [9, 8, 4.8, 7]], glass, 'obsidian', { cell: 5 });
          // Its throat plates, lighter.
          X.limb([[14, 38, 3, 8], [14, 28, 2.8, 9], [10, 18, 2.4, 10], [5, 10, 2, 10]], '#2a2240', 'obsidian', { cell: 3 });
          X.in(1, 1);
          for (let i = 0; i < 4; i++) X.tube(22 - i * 2.5, 33 - i * 7, 28 - i * 2.4, 30 - i * 7 - (i % 2) * 2, 1.4, 0.3, '#8a78c8', 'glass', { z: 6 });
        },
        paint(P) {
          for (let y = 12; y < 40; y += 3) for (let x = 2; x < 18; x++) {
            const q = P.get(x, y);
            if (q[3] && q[2] < 80) P.set(x, y, shade(q, 0.7));
          }
        },
      },
      head: {
        w: 28, h: 20, px: 19, py: 12, role: 'head', layer: 'front', parent: 'neck', at: [9, 8], z: 3, amp: 1.4,
        body(X) {
          const glass = '#3a3058';
          X.in(0, 2.4);
          X.ball(15, 9, 8.4, 5.4, glass, 'obsidian', { rz: 5, ang: -0.15, cell: 4 });
          X.ball(7, 10.5, 5.6, 2.8, glass, 'obsidian', { rz: 2.6, z: 2, ang: -0.1 });
          X.in(1, 1);
          // Brows like blades, swept back; crystal horns behind.
          X.slab([[6, 6], [16, 3.5], [24, 1], [17, 6.5]], '#4a3e70', 'obsidian', { rz: 1.6, bevel: 0.8, z: 6 });
          for (let i = 0; i < 3; i++) X.tube(18 + i * 2.6, 6 - i * 0.4, 25 + i * 1.4, 2 - i * 1.2, 1.3, 0.25, '#8a78c8', 'glass', { z: 5 });
        },
        paint(P) {
          // Nostril, the line of its mouth.
          P.set(3, 9, hex('#140e20'));
          for (let x = 3; x < 14; x++) P.set(x, 12 + (x > 10 ? 1 : 0), hex('#140e20'));
        },
        glow(P) {
          eyes(P, [[11, 7]], '#ff6040', { big: true });
          glow(P, 11, 7, 2.6, '#ff4020', 0.45);
        },
      },
      jaw: {
        w: 20, h: 10, px: 16, py: 3, role: 'jaw', layer: 'front', parent: 'head', at: [16, 12], z: 3.5, amp: 1.6,
        body(X) {
          X.in(0, 1);
          X.slab([[1, 4], [16, 2], [17, 5], [4, 7]], '#2e2648', 'obsidian', { rz: 2, bevel: 1.2 });
        },
        paint(P) {
          for (let x = 3; x < 15; x += 2) P.set(x, 3, hex('#e8e0ff'));
        },
      },
    },
    under(R) {
      beastSerpent(R, wyrmCfg, false);
    },
    over(R) {
      beastSerpent(R, wyrmCfg, true);
    },
    fx(R, ctx, pose) {
      const t = R.r.time;
      inPose(R, ctx, pose, () => {
        // Light running up through its spines and its neck.
        const k = (t * 1.5) % 1;
        const a = partAt(R, 'neck', 26 - k * 10, 34 - k * 30);
        dot(ctx, a.x, a.y, '#ffffff', 0.9);
        dot(ctx, a.x + 1, a.y, '#c8b8ff', 0.6);
        if (R.st.wind) {
          const m = partAt(R, 'head', 2, 11);
          sparks(ctx, m.x, m.y, t, { n: 5, col: '#c8b8ff', a0: Math.PI, spread: 0.6, v: 8, fall: 4 });
        }
      });
    },
  },

  // The Magma Tender: a great slug of cooling lava, its crust split in
  // seams that glow with every slow beat of the heat in it, steaming; its
  // eyes on stalks, swaying, peering; its foot molten, leaving fire.
  magma_tender: {
    size: 64, ay: 61,
    body(X, J) {
      const crust = '#3a2420';
      const b = J.b;
      X.in(0, 4);
      // The molten foot spread on the floor.
      X.ball(33, 56, 28, 5.5, '#7a2a0a', 'molten', { rz: 4, cell: 3, flow: 0.8 });
      // Its body: a hump of crust, its head end low and round.
      X.ball(38, 42 - b, 21, 13 + b, crust, 'rock', { rz: 12, cell: 5 });
      X.ball(16, 46, 11, 9.5, crust, 'rock', { rz: 9, cell: 4.5, z: 2 });
      X.ball(56, 51, 8, 5, crust, 'rock', { rz: 5, cell: 4 });
      X.in(1, 1.4);
      // Plates of crust standing proud along its back.
      for (let i = 0; i < 5; i++) X.ball(26 + i * 6, 33 - b - Math.sin((i / 4) * Math.PI) * 2, 4, 2.4, '#4a302a', 'rock', { rz: 2.4, z: 10, cell: 2.5 });
      // Its mouth, a glowing slit under its head.
      X.ball(9, 51, 4, 1.4, '#ff7a20', 'molten', { z: 12, rz: 0.6, glow: '#ffb040', glowK: 0.5 });
    },
    paint(P, J, t) {
      // Its seams of fire, pulsing.
      const k = 0.5 + 0.5 * Math.sin(t * TAU);
      const col = mix(hex('#ff4a10'), hex('#ffd060'), k);
      seams(P, 28, 56, 8, col);
    },
    glow(P, J, t) {
      const k = 0.5 + 0.5 * Math.sin(t * TAU);
      glow(P, 33, 56, 7, '#ff6a1a', 0.25 + k * 0.2);
      glow(P, 9, 51, 3, '#ffb040', 0.4);
    },
    parts: Object.fromEntries([[0, 13, 40, 0], [1, 20, 38, 1.4]].map(([i, x, y, ph]) => [`stalk${i}`, {
      w: 12, h: 20, px: 6, py: 18, role: 'sway', layer: i ? 'back' : 'front', z: i ? -1 : 3, depth: 0.25, rate: 1.4, phase: ph, amp: 1.4,
      at: [x, y],
      body(X) {
        const crust = i ? '#2e1c18' : '#3a2420';
        X.in(0, 1.2);
        X.limb([[6, 18, 1.8, 1], [5, 11, 1.4, 2], [4, 5, 1.1, 2]], crust, 'molten', { cell: 2.5 });
        X.ball(4, 4, 2.6, 2.6, crust, 'molten', { z: 4, rz: 2, cell: 2 });
      },
      glow(P) {
        eyes(P, [[3, 4]], i ? '#c8a040' : '#ffd060', { big: true });
        glow(P, 3, 4, 2.4, '#ffb040', 0.35);
      },
    }])),
    fx(R, ctx, pose) {
      const t = R.r.time;
      inPose(R, ctx, pose, () => {
        // Steam off its back, embers off its foot, fire left where it goes.
        smoke(ctx, R.ox + 38, R.oy + 32, t, { n: 4, rise: 18, col: '#9a8a88', dark: '#6a5a58', a: 0.35 });
        embers(ctx, R.ox + 8, R.oy + 58, 50, t, { n: 6, rise: 14 });
        if (R.e.moving) for (let i = 0; i < 4; i++) flame(ctx, R.ox + 50 + i * 4, R.oy + 59, 3 + (i % 2) * 2, t, { ph: i * 1.7, w: 2, a: 0.8 });
      });
    },
  },

  // The Bellows Golem: an iron boiler on stumps of legs, riveted plate and
  // banded drum, a furnace in its belly behind a grate, a leather bellows
  // on its flank pumping the fire, stacks on its shoulders smoking; its
  // arm a great piston ending in a pincer; red-hot as the heat in it
  // climbs, steam bursting from its seams as it vents.
  bellows_golem: {
    size: 64, ay: 62,
    body(X, J, t, st) {
      const heat = st.heat || 0;
      const iron = heat >= 2 ? '#7a4a3e' : heat >= 1 ? '#5e4a48' : '#4a4a54';
      const pump = Math.max(0, Math.sin(t * TAU * 2)) * 3;
      X.in(0, 2);
      // Stumps of legs, riveted, splayed feet.
      for (const [x, z] of [[24, 0], [42, 0]]) {
        X.limb([[x, 48, 4.4, z], [x - 0.5, 55, 3.8, z], [x - 1, 59, 4.2, z]], dk(iron, 0.9), 'metal');
        X.ball(x - 2, 60.5, 6.4, 2.2, dk(iron, 0.75), 'metal', { rz: 2 });
      }
      X.in(1, 3);
      // The boiler: a drum, banded; its dome.
      X.ball(33, 37, 19, 15.5, iron, 'metal', { rz: 15 });
      X.ball(33, 23, 13, 6, lt(iron, 1.05), 'metal', { rz: 8, z: 3 });
      X.ball(33, 18.5, 4, 2.4, dk(iron, 0.8), 'metal', { rz: 2, z: 5 });
      for (const y of [28, 47]) X.ball(33, y, 19.4, 1.4, dk(iron, 0.75), 'metal', { rz: 1.4, z: 14 });
      // Stacks on its shoulders.
      for (const x of [21, 45]) {
        X.tube(x, 24, x + (x < 33 ? -2 : 2), 9, 3.2, 2.8, dk(iron, 0.8), 'metal', { z: 2 });
        X.ball(x + (x < 33 ? -2 : 2), 9, 3.8, 1.4, dk(iron, 0.65), 'metal', { z: 4, rz: 1 });
      }
      X.in(2, 1);
      // The bellows on its flank, pumping.
      X.slab([[46, 30 - pump], [57, 26 - pump * 1.3], [58, 46 + pump * 0.3], [47, 45]], '#6a4a2a', 'leather', { z: 12, rz: 3, bevel: 2 });
      X.slab([[55, 25 - pump * 1.3], [59, 24 - pump * 1.3], [60, 47 + pump * 0.3], [56, 47]], '#5a3a20', 'wood', { z: 14, rz: 1.4, bevel: 1 });
      X.tube(47, 38, 51, 38, 1.4, 1.2, '#3a2a1a', 'metal', { z: 15 });
      // A gauge on its chest, a pipe running round to the stack.
      X.ball(23, 30, 2.6, 2.6, '#c8a040', 'gold', { z: 16, rz: 2 });
      X.limb([[25, 30, 0.9, 15], [30, 26, 0.9, 15], [21, 22, 0.9, 15]], '#8a6a40', 'gold');
    },
    paint(P, J, t, st) {
      const heat = st.heat || 0;
      // Rivets in rows; the grate over the fire; the gauge's face.
      for (let i = 0; i < 10; i++) for (const y of [29, 46]) {
        const x = 16 + i * 3.6;
        if (P.get(Math.round(x), y)[3]) P.set(Math.round(x), y, hex('#b8b8c0'));
      }
      const fire = heat >= 2 ? '#fff0a0' : heat >= 1 ? '#ffb040' : '#ff7a20';
      for (let y = 34; y <= 43; y++) for (let x = 26; x <= 40; x++) {
        const bar = (x - 26) % 3 === 0 || y === 34 || y === 43;
        P.set(x, y, hex(bar ? '#24242a' : Math.sin(t * TAU * 3 + x * 0.7 + y) > 0.2 ? fire : '#ff5a10'));
      }
      P.set(23, 30, hex('#f0e8d0'));
      P.set(22, 29 + Math.round(Math.sin(t * TAU) * 1), hex('#2a1a10'));
      if (heat >= 1) P.over((x, y, c) => (hash2(x, y, 9) < 0.06 * heat && c[3] ? mix(c, [255, 96, 48], 0.6) : null));
    },
    glow(P, J, t, st) {
      const heat = st.heat || 0;
      glow(P, 33, 38.5, 9, heat >= 2 ? '#fff0a0' : '#ff7a20', 0.3 + heat * 0.12);
    },
    parts: {
      // Its arm: a great piston, a pincer at its end, swinging as it
      // strikes.
      arm: {
        w: 22, h: 32, px: 14, py: 4, role: 'weapon', layer: 'front', z: 4, amp: 0.8,
        at: [16, 30],
        body(X) {
          X.in(0, 1.4);
          X.ball(14, 4, 4.6, 4.2, '#3e3e48', 'metal', { rz: 4 });
          X.tube(13, 6, 11, 17, 3, 2.6, '#4a4a54', 'metal', { z: 2 });
          X.tube(11, 16, 9, 24, 1.6, 1.6, '#a8a8b8', 'metal', { z: 3 });
          X.ball(9, 24, 3.4, 2.6, '#3e3e48', 'metal', { z: 4, rz: 2 });
          // The pincer's jaws.
          X.slab([[7, 25], [3, 30], [5, 31], [9, 27]], '#5a5a64', 'metal', { z: 5, rz: 1.2, bevel: 0.8 });
          X.slab([[10, 25], [13, 31], [11, 31.5], [8, 27]], '#4a4a54', 'metal', { z: 4.6, rz: 1.2, bevel: 0.8 });
        },
        paint(P) {
          for (const y of [8, 12]) P.set(12, y, hex('#b8b8c0'));
        },
      },
    },
    fx(R, ctx, pose) {
      const t = R.r.time;
      const heat = R.st.heat || 0;
      inPose(R, ctx, pose, () => {
        for (const x of [19, 47]) smoke(ctx, R.ox + x, R.oy + 7, t * (1 + heat * 0.5) + x * 0.01, { n: 5, rise: 20, col: '#6a6466', dark: '#3a3436', a: 0.55, grow: 3.5 });
        if (heat >= 1) sparks(ctx, R.ox + 33, R.oy + 35, t, { n: heat * 3, col: '#ffb040', v: 10 });
        if (R.st.vent) {
          // Steam bursting from its seams.
          for (const [x, y, d] of [[14, 30, -1], [52, 30, 1], [33, 16, 0]]) smoke(ctx, R.ox + x, R.oy + y, t * 3, { n: 7, rise: d ? 6 : 22, drift: d * 16, col: '#f0f0f0', dark: '#d0d0d8', a: 0.75, grow: 5 });
        }
      });
    },
  },

  // The Obsidian Abbess: a nun of the black glass, tall and still, veiled,
  // her face pale as a moth under it and her eyes alight; a habit of black
  // velvet to the floor, its edge in pale violet; the stone of her order at
  // her throat; and panes of black glass drifting round her, catching the
  // light as they turn.
  obsidian_abbess: {
    ...ABBESS,
    parts: {
      ...ABBESS.parts,
      ...orbit('pane', 4, {
        cx: 32, cy: 34, rx: 24, ry: 7, speed: 0.6, spin: 0.4, bob: 2, w: 14, h: 18, depth: 0.06,
        body(X, i, layer) {
          X.in(0, 0.8);
          const pts = [[[2, 4], [9, 1], [12, 12], [5, 16]], [[3, 2], [11, 3], [10, 15], [2, 12]], [[1, 8], [7, 1], [13, 7], [7, 17]], [[4, 1], [12, 5], [8, 16], [2, 10]]][i];
          X.slab(pts, layer === 'front' ? '#2a2236' : '#1a1422', 'obsidian', { rz: 1.4, bevel: 1, cell: 3 });
        },
        glow(P, i, layer) {
          // The light catching an edge of it.
          if (layer === 'front') for (let k = 0; k < 4; k++) P.fx(5 + k, 4 + k * 2, '#e8e0ff', 0.6);
        },
      }),
    },
    fx(R, ctx, pose) {
      const t = R.r.time;
      inPose(R, ctx, pose, () => {
        // Her stone's light; motes of violet sinking round her.
        const cast = R.A && (R.A.k === 'cast' || R.A.k === 'summon' || R.A.k === 'beam');
        for (let i = 0; i < 6; i++) {
          const k = (t * 0.3 + i / 6) % 1;
          dot(ctx, R.ox + 14 + ((i * 0.618) % 1) * 36, R.oy + 14 + k * 46, i % 2 ? '#c8b8f0' : '#8a78c8', 0.7 * (1 - k));
        }
        if (cast) glowAt(ctx, R.ox + 28, R.oy + 26, 6, '#c8b8f0', 0.5);
      });
    },
  },
});

forge({
  // The Kiln Priest: keeper of the great kiln's fires, old and broad, in
  // robes of fired orange trimmed in gold, a tall cone of a hat, his beard
  // to his belt; swinging his censer of coals on its chain, smoke and
  // sparks trailing off it.
  kiln_priest: figure({
    stance: { h: 1, w: 1.1 },
    robe: { col: '#8a3a1a', trim: '#ffd060', front: '#6a2a12', flare: 1.25, wide: 1.06 },
    torso: { col: '#8a3a1a', mat: 'cloth', build: 'fat' },
    belt: { col: '#3a1a0a', buckle: '#ffd060' },
    head: {
      kind: 'man', r: 5.3, col: '#a87a58', beard: '#e8e0d0', beardLong: true, face: { eye: '#ffd060', white: '#fff0c0' },
      extra(X, c, r) {
        // The cone of his hat, banded.
        X.in(HG.head, 1);
        X.slab([[c.x - r * 1.05, c.y - r * 0.55], [c.x + r * 1.25, c.y - r * 0.7], [c.x + r * 0.35, c.y - r * 3.1]], '#c86a2a', 'cloth', { z: 17, rz: 2.4, bevel: 1.6 });
        X.tube(c.x - r * 1.05, c.y - r * 0.6, c.x + r * 1.25, c.y - r * 0.75, r * 0.2, r * 0.2, '#ffd060', 'gold', { z: 19 });
        X.ball(c.x + r * 0.35, c.y - r * 3.1, r * 0.25, r * 0.25, '#ffd060', 'gold', { z: 19, rz: 0.8 });
      },
      glow(P, c, r) {
        eyes(P, [[Math.round(c.x - r * 0.62), Math.round(c.y - r * 0.08)], [Math.round(c.x - r * 0.08), Math.round(c.y - r * 0.08)]], '#ffd060');
      },
    },
    arm: { col: '#a87a58', r: 3.2, sleeve: '#8a3a1a', L1: 8.6, L2: 8, wang: 2.9 },
    weapon: { kind: 'censer', len: 9, col: '#8a5a2a', glow: '#ffb040' },
    fist: { col: '#a87a58', mat: 'skin', r: 2.4 },
    armF: { col: '#a87a58', r: 3.2, sleeve: '#8a3a1a' },
    holds: { kind: 'book', col: '#5a2010' },
    paint(P, J) {
      // A sun of gold on his breast.
      const c = J.chest;
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU;
        P.set(Math.round(c.x - 1 + Math.cos(a) * 3), Math.round(c.y + 2 + Math.sin(a) * 3), hex('#ffd060'));
      }
      P.rect(c.x - 2, c.y + 1, 2, 2, '#ffe890');
    },
    fx(R, ctx, pose) {
      const t = R.r.time;
      inPose(R, ctx, pose, () => {
        const m = onBlade(R, 11.5);
        glowAt(ctx, m.x, m.y, 5, '#ff8030', 0.35);
        smoke(ctx, m.x, m.y - 2, t, { n: 5, rise: 16, col: '#c8b8a8', dark: '#8a7a6a', a: 0.45 });
        sparks(ctx, m.x, m.y, t, { n: 3, col: '#ffd060', v: 6 });
      });
    },
  }),

  // The Vitrified Horror: what the glass-fire made of those it caught — a
  // heaving mass of fused glass and bone, ribs and skulls half sunk in it,
  // its eyes in it everywhere, long crystals standing out of it with light
  // running up them; shards of it wheeling round it.
  vitrified_horror: {
    size: 64, ay: 62,
    body(X, J) {
      const glass = '#3a4a70';
      const b = J.b;
      X.in(0, 4);
      X.ball(32, 50, 25, 12 + b * 0.5, glass, 'glass', { rz: 12 });
      X.ball(25, 39 - b * 0.5, 15, 12, glass, 'glass', { rz: 11, z: 2 });
      X.ball(42, 41, 12, 10, mx(glass, '#6a4a88', 0.35), 'glass', { rz: 9, z: 1 });
      X.in(1, 1.5);
      // Bone sunk in the glass: ribs, an arm, a skull.
      for (let i = 0; i < 5; i++) X.limb([[20 + i * 5, 45, 1, 9], [18 + i * 5.4, 51, 0.9, 10], [22 + i * 5, 56, 0.8, 9]], '#e8e0c8', 'bone');
      X.limb([[44, 46, 1.2, 9], [50, 52, 1, 9], [53, 58, 0.9, 9]], '#d8d0b8', 'bone');
      X.ball(35, 34 - b * 0.5, 4.4, 4.2, '#e8e0c8', 'bone', { z: 10, rz: 3.6 });
      X.ball(14, 51, 3, 2.8, '#d8d0b8', 'bone', { z: 9, rz: 2.4 });
      X.in(2, 1);
      // Its crystals.
      for (const [x, y, a, l] of [[18, 32, -2.2, 15], [28, 27, -1.7, 19], [42, 32, -1.1, 13], [51, 42, -0.4, 10], [12, 42, -2.8, 9], [36, 29, -1.4, 9]]) {
        X.tube(x, y - b * 0.5, x + Math.cos(a) * l, y - b * 0.5 + Math.sin(a) * l, 2.4, 0.4, '#a8c8ff', 'glass', { z: 6 });
      }
    },
    paint(P, J) {
      const b = Math.round(J.b * 0.5);
      // The skull's sockets and teeth.
      P.rect(33, 33 - b, 2, 2, '#1a1420');
      P.rect(36, 33 - b, 2, 2, '#1a1420');
      for (let i = 0; i < 4; i++) P.set(33 + i, 37 - b, hex(i % 2 ? '#1a1420' : '#f0e8d8'));
      P.rect(13, 51, 1, 1, '#1a1420');
    },
    glow(P, J, t, st) {
      const b = Math.round(J.b * 0.5);
      const c = st.wind ? '#ffffff' : '#ff6040';
      eyes(P, [[24, 40 - b], [31, 47], [43, 43], [19, 52], [47, 50]], c, { big: true });
      for (const [x, y] of [[24, 40 - b], [43, 43]]) glow(P, x, y, 2.6, '#ff4020', 0.4);
      // Light running up a crystal.
      const k = (t * 2) % 1;
      P.fx(28 + Math.cos(-1.7) * 19 * k, 27 - b + Math.sin(-1.7) * 19 * k, '#ffffff', 0.9);
    },
    parts: orbit('shard', 6, {
      cx: 33, cy: 40, rx: 28, ry: 8, speed: 0.9, spin: 1.6, bob: 2, w: 10, h: 10,
      body(X, i, layer) {
        X.in(0, 0.8);
        X.slab([[1, 4], [4.5, 0.5], [9, 3], [5, 9]], layer === 'front' ? '#a8c8ff' : '#7a98c8', 'glass', { rz: 1.5, bevel: 1 });
      },
      glow(P) {
        P.fx(4, 3, '#ffffff', 0.8);
      },
    }),
    fx(R, ctx, pose) {
      const t = R.r.time;
      inPose(R, ctx, pose, () => {
        for (let i = 0; i < 5; i++) {
          const k = (t * 0.8 + i / 5) % 1;
          dot(ctx, R.ox + 20 + i * 6 + Math.sin(k * 6 + i), R.oy + 30 - k * 18, '#e0f0ff', 0.8 * (1 - k));
        }
      });
    },
  },

  // The Ash Reaver: a raider out of the ash wastes, broad and scarred, in
  // mail and wrappings gone grey with ash, a red sash, a ragged cloak; his
  // helm crested in red horsehair, his eyes burning in its slit; a flail of
  // three spiked heads. Berserk, he steams red.
  ash_reaver: figure({
    stance: { h: 1, w: 1.16 },
    legs: { col: '#2a201c', mat: 'cloth', r: 4.7, greave: '#4a4440', boot: '#141010' },
    torso: { col: '#7a4a30', build: 'muscle', wide: 1.06 },
    plate: { col: '#4a4440', mat: 'mail', skirt: '#3a2a24', skirtMat: 'leather', trim: '#5a4e48' },
    belt: { col: '#2a1a14', buckle: '#ff6030' },
    pauldronF: { col: '#5a4e48', r: 5.6, spikes: 2, spikeLen: 3, spikeCol: '#c8c0b8' },
    sculpt(X, J) {
      // His sash, red, knotted at his hip, its ends hanging.
      X.in(HG.belt, 1);
      X.ball(J.waist.x, J.waist.y + 1.5, 8.6 * J.w, 2.2, '#a02a14', 'cloth', { z: 15, rz: 2 });
      X.limb([[J.waist.x - 5, J.waist.y + 2, 1.2, 16], [J.waist.x - 6.5, J.pelvis.y + 6, 1, 16], [J.waist.x - 6, J.pelvis.y + 11, 0.6, 16]], '#8a2010', 'cloth');
    },
    head: {
      kind: 'helm', r: 5.4, col: '#3a3436', cy: 14,
      extra(X, c, r) {
        // His crest of red horsehair, front to back over the helm.
        X.in(HG.head, 1);
        const pts = [];
        for (let i = 0; i <= 6; i++) {
          const a = -2.6 + (i / 6) * 2.6;
          pts.push([c.x + 0.6 + Math.cos(a) * r * 1.25, c.y - 0.6 + Math.sin(a) * r * 1.3, r * (0.26 + Math.sin((i / 6) * Math.PI) * 0.22), 19]);
        }
        X.limb(pts, '#c84a1a', 'hair');
        X.limb([[c.x + r * 1.2, c.y - r * 0.2, r * 0.3, 18], [c.x + r * 1.6, c.y + r * 1.4, r * 0.2, 17]], '#a03a14', 'hair');
        // His beard out from under it.
        X.limb([[c.x - r * 0.4, c.y + r * 1.05, r * 0.55, 17], [c.x - r * 0.3, c.y + r * 1.8, r * 0.3, 17]], '#1a1210', 'hair');
      },
      paint(P, c, r) {
        P.rect(Math.round(c.x - r), Math.round(c.y), Math.round(r * 1.1), 1, '#0a0606');
      },
      glow(P, c, r) {
        P.set(Math.round(c.x - r * 0.7), Math.round(c.y), hex('#ff7040'));
        P.set(Math.round(c.x - r * 0.15), Math.round(c.y), hex('#ff7040'));
      },
    },
    cape: { col: '#4a2a20', mat: 'cloth', ragged: true, w: 28, h: 36 },
    arm: { col: '#7a4a30', r: 4, gauntlet: '#3a3436', L1: 8.8, L2: 8.4, wang: 0.9, pauldron: { col: '#5a4e48', r: 6, spikes: 2, spikeLen: 3.2, spikeCol: '#c8c0b8' } },
    weapon: { kind: 'flail', len: 11, col: '#5a4a44', grip: '#2a1a14' },
    fist: { col: '#3a3436', r: 2.8 },
    armF: { col: '#7a4a30', r: 3.9, gauntlet: '#3a3436' },
    paint(P, J) {
      // Old scars across his arms and chest; ash streaks.
      crease(P, J.chest.x - 6, J.chest.y - 6, J.chest.x - 2, J.chest.y - 3, 0.7);
    },
    fx(R, ctx, pose) {
      const t = R.r.time;
      if (!R.st.berserk) return;
      inPose(R, ctx, pose, () => {
        // Berserk: red steam off him, his eyes flaring.
        smoke(ctx, R.ox + 32, R.oy + 22, t * 2, { n: 8, rise: 26, spread: 10, col: '#ff3020', dark: '#a01810', a: 0.45 });
        const e = onHead(R, -4, 0);
        glowAt(ctx, e.x, e.y, 4, '#ff3020', 0.6);
      });
    },
  }),

  // The Bombard Queen: captain of the kiln-town's guns, quick and grinning,
  // in leather and a smith's gloves, her red hair tied back under a yellow
  // bandana, goggles pushed up on her brow, a bandolier of little bombs
  // across her, their fuses spitting; her crossbow cocked.
  bombard_queen: figure({
    stance: { h: 0.98, w: 1.02 },
    legs: { col: '#3a2a20', mat: 'leather', r: 4.1, boot: '#2a1a12', bootMat: 'leather' },
    torso: { col: '#5a3a2a', mat: 'leather', build: 'lean' },
    belt: { col: '#3a2a1a', buckle: '#c8a030' },
    sculpt(X, J) {
      // The bandolier, bombs along it.
      X.in(HG.front, 1);
      const a = { x: J.shN.x - 1, y: J.shN.y + 1 };
      const b = { x: J.waist.x + 6, y: J.pelvis.y };
      X.limb([[a.x, a.y, 0.9, 18], [b.x, b.y, 0.9, 18]], '#3a2a1a', 'leather');
      for (let i = 0; i < 5; i++) {
        const k = 0.12 + i * 0.19;
        X.ball(a.x + (b.x - a.x) * k, a.y + (b.y - a.y) * k, 1.6, 1.6, '#2a2420', 'metal', { z: 19, rz: 1.4 });
      }
    },
    head: {
      kind: 'man', r: 5.1, col: '#b07850', hair: '#c83a1a', hairStyle: 'long', face: { eye: '#3a2a20', grin: true, teeth: true },
      extra(X, c, r) {
        // The bandana over her hair; her goggles pushed up.
        X.in(HG.head, 1);
        X.ball(c.x + r * 0.35, c.y - r * 0.7, r * 1.08, r * 0.55, '#ffb040', 'cloth', { z: 17, rz: 2 });
        X.limb([[c.x + r * 1.1, c.y - r * 0.4, r * 0.3, 16], [c.x + r * 1.7, c.y + r * 0.2, r * 0.2, 16]], '#e09a30', 'cloth');
        X.ball(c.x - r * 0.65, c.y - r * 0.62, r * 0.32, r * 0.28, '#c87a40', 'glass', { z: 19, rz: 1 });
        X.ball(c.x - r * 0.05, c.y - r * 0.66, r * 0.32, r * 0.28, '#c87a40', 'glass', { z: 18.6, rz: 1 });
      },
    },
    arm: { col: '#b07850', r: 3.2, gauntlet: '#2a2420', gauntletMat: 'leather', L1: 8.4, L2: 8, wang: 1.6 },
    weapon: { kind: 'crossbow', len: 13, col: '#5a4a40', grip: '#5a3a24' },
    fist: { col: '#2a2420', mat: 'leather', r: 2.4 },
    armF: { col: '#b07850', r: 3.1, gauntlet: '#2a2420', gauntletMat: 'leather' },
    fx(R, ctx, pose) {
      const t = R.r.time;
      inPose(R, ctx, pose, () => {
        // Her fuses spitting, one after another.
        const J = R.J;
        const a = { x: J.shN.x - 1, y: J.shN.y + 1 };
        const b = { x: J.waist.x + 6, y: J.pelvis.y };
        for (let i = 0; i < 5; i++) {
          const k = 0.12 + i * 0.19;
          if ((Math.floor(t * 10) + i) % 3) continue;
          const x = R.ox + a.x + (b.x - a.x) * k;
          const y = R.oy + a.y + (b.y - a.y) * k - 2;
          dot(ctx, x, y, '#ffe070', 1);
          dot(ctx, x + Math.sin(t * 30 + i), y - 1, '#ffffff', 0.8);
        }
      });
    },
  }),

  // The Chained Drake: a drake, red and scarred, the gate-beast of the
  // kiln-town, chained by an iron collar to a stake in its hall: scales and
  // a pale banded belly, horns swept back, its wings of torn leather
  // beating, its tail lashing; fire in its jaws.
  chained_drake: {
    size: 64, ay: 62, walk: true,
    body(X, J) {
      const scale = '#8a2a1e';
      const q = quadruped(X, J, { cx: 36, cy: 41, len: 26, girth: 9.5, legLen: 17, lr: 3.4, col: scale, mat: 'scales', belly: '#b86a40', bellyMat: 'scales', paw: 'claw', claws: '#e8d8b0', neck: [17, 27] });
      // The collar at its throat, riveted iron.
      X.in(4, 1);
      X.ball(q.neck[0] + 4, q.neck[1] + 4, 4, 5.4, '#5a5a62', 'metal', { rz: 3, z: 12, ang: 0.5 });
      X.ball(q.neck[0] + 2, q.neck[1] + 8.5, 1.6, 1.6, '#7a7a84', 'metal', { z: 14, rz: 1.2 });
      // Spines along its back.
      for (let i = 0; i < 6; i++) X.tube(24 + i * 5, 32 - J.b * 0.5, 26 + i * 5, 27 - J.b * 0.5 - (i % 2), 1.1, 0.2, '#e8d8b0', 'bone', { z: 2 });
    },
    paint(P) {
      // Scars across its flank; the rivets of its collar.
      crease(P, 34, 36, 42, 43, 0.5);
      crease(P, 38, 34, 45, 40, 0.5);
      for (const [x, y] of [[19, 30], [21, 34]]) P.set(x, y, hex('#c8c8d0'));
    },
    parts: {
      wingF: { ...wingPart({ kind: 'membrane', len: 30, col: '#5a1e16', bone: '#7a3a2a', skin: '#4a1a12', ang: -1.3, bend: 0.8, depth: 0.3, rate: 1.4 }), at: [34, 33], layer: 'back', z: -3, phase: 0.6 },
      tail: { ...tailPart({ n: 7, seg: 4.4, r0: 4, curl: -0.12, ang: -0.1, col: '#8a2a1e', mat: 'scales', tip: 'spade', tipCol: '#6a1e14', spikes: '#e8d8b0' }), at: [57, 40], layer: 'back', z: -1 },
      head: DRAKE_HEAD,
      jaw: jawPart(DRAKE_HEAD, { col: '#7a2418', mat: 'scales', tongue: '#ff8030', amp: 1.3 }),
      wingN: { ...wingPart({ kind: 'membrane', len: 32, col: '#7a2a20', bone: '#9a4a34', skin: '#6a2418', ang: -1.2, bend: 0.8, depth: 0.32, rate: 1.4 }), at: [38, 32], layer: 'front', z: 8 },
    },
    under(R) {
      drakeChain(R, false);
    },
    over(R) {
      drakeChain(R, true);
    },
    fx(R, ctx, pose) {
      const t = R.r.time;
      const breath = R.st.wind || (R.A && R.A.k === 'breath');
      inPose(R, ctx, pose, () => {
        const m = partAt(R, 'head', 18 - 6 * 2.3, 14 + 6 * 0.35);
        if (breath) {
          for (let i = 0; i < 10; i++) {
            const k = (t * 3 + i / 10) % 1;
            puff(ctx, m.x - k * 14, m.y + Math.sin(k * 8 + i) * 2 + k * 3, 1 + k * 2.4, k < 0.35 ? '#fff0a0' : k < 0.7 ? '#ffa030' : '#c83a10', 0.85 * (1 - k));
          }
        } else {
          flame(ctx, m.x, m.y + 1, 3, t, { w: 1.5, a: 0.8 });
          smoke(ctx, m.x + 2, m.y - 2, t, { n: 3, rise: 8, a: 0.3 });
        }
      });
    },
  },

  // The Kiln King: lord of the kiln-town, a smith-king, broad as a door, in
  // plate he forged himself and a scorched leather apron over it, his beard
  // and hair like a forge's fire, a crown of gold with a coal for a jewel;
  // his hammer, the light of the forge still in its head.
  kiln_king: figure({
    stance: { h: 1, w: 1.18 },
    legs: { col: '#2a1e18', mat: 'cloth', r: 4.8, greave: '#4a3a30', boot: '#1a1210', bootMat: 'metal' },
    torso: { col: '#6a4030', build: 'muscle', wide: 1.1 },
    plate: { col: '#5a4a40', skirt: '#3a2a20', skirtMat: 'leather', trim: '#ffd060' },
    belt: { col: '#2a1a14', buckle: '#ffd060' },
    pauldronF: { col: '#5a4a40', r: 6, trim: '#ffd060' },
    sculpt(X, J) {
      // The apron, scorched leather, over his plate from the chest down.
      X.in(HG.front, 1);
      X.slab([[J.waist.x - 4, J.waist.y - 1], [J.waist.x + 4, J.waist.y - 1], [J.waist.x + 5.5, J.pelvis.y + 13], [J.waist.x - 5.5, J.pelvis.y + 13]], '#5a3a24', 'leather', { z: 18, rz: 1.4, bevel: 1.2 });
      X.limb([[J.waist.x - 4, J.waist.y - 1, 0.5, 19], [J.chest.x - 2, J.chest.y - 3, 0.5, 19]], '#3a2414', 'leather');
    },
    paint(P, J) {
      // Scorch marks on the apron; its stitched hem.
      const y = Math.round(J.pelvis.y + 12);
      for (let x = Math.round(J.waist.x - 6); x < J.waist.x + 6; x += 2) {
        const q = P.get(x, y);
        if (q[3]) P.set(x, y, shade(q, 1.4));
      }
      for (let i = 0; i < 6; i++) {
        const x = Math.round(J.waist.x - 4 + hash2(i, 1, 4) * 8);
        const yy = Math.round(J.waist.y + hash2(i, 2, 4) * 12);
        const q = P.get(x, yy);
        if (q[3]) P.set(x, yy, shade(q, 0.55));
      }
    },
    head: {
      kind: 'man', r: 5.4, col: '#6a4030', hair: '#ff9030', hairStyle: 'wild', beard: '#ff8020', face: { eye: '#ffb040', white: '#ffe0a0' },
      crown: { col: '#ffd060', n: 5, tall: 3.4, gem: '#ff4010' },
      glow(P, c, r) {
        eyes(P, [[Math.round(c.x - r * 0.62), Math.round(c.y - r * 0.08)], [Math.round(c.x - r * 0.08), Math.round(c.y - r * 0.08)]], '#ffb040');
      },
    },
    arm: { col: '#6a4030', r: 4.2, gauntlet: '#2a2020', gauntletMat: 'leather', L1: 8.8, L2: 8.6, wang: 0.85, pauldron: { col: '#5a4a40', r: 6.4, trim: '#ffd060' } },
    weapon: {
      kind: 'hammer', len: 20, col: '#5a4a40', grip: '#3a2a1a',
      glow(P, { H, wang }) {
        // The forge's heat still in its head.
        const a = along(H, wang, 20);
        glow(P, a.x, a.y, 4.6, '#ff6a1a', 0.55);
      },
    },
    fist: { col: '#2a2020', mat: 'leather', r: 3 },
    armF: { col: '#6a4030', r: 4, gauntlet: '#2a2020', gauntletMat: 'leather' },
    fx(R, ctx, pose) {
      const t = R.r.time;
      inPose(R, ctx, pose, () => {
        const h = onBlade(R, 20);
        sparks(ctx, h.x, h.y, t, { n: R.A && R.A.k ? 8 : 3, col: '#ffb040', v: 10 });
        embers(ctx, h.x - 3, h.y, 6, t, { n: 3, rise: 12 });
      });
    },
  }),

  // The Slag Titan: a hulk of the slag the kilns threw out, rock crusted on
  // rock, molten seams through it, hunched with its great knuckles to the
  // floor; a core of fire in its chest, and in it a lodestone heart that
  // wakes, blue, when it draws.
  slag_titan: {
    size: 64, ay: 62,
    body(X, J) {
      const rock = '#5a4a44';
      const b = J.b;
      X.in(0, 3);
      // Legs, short and thick.
      for (const x of [30, 46]) X.limb([[x, 46, 6.4, 0], [x - 1, 55, 5.6, 0], [x - 1, 60, 6.4, 0]], dk(rock, 0.9), 'rock', { cell: 4 });
      X.in(1, 4);
      // The bulk of it, hunched; its head sunk low between its shoulders.
      X.ball(38, 33 - b, 19, 15, rock, 'rock', { rz: 14, cell: 6 });
      X.ball(30, 21 - b, 12, 8, rock, 'rock', { rz: 8, z: 4, cell: 5 });
      X.ball(14, 30 - b, 7, 6, dk(rock, 0.85), 'rock', { rz: 5, z: 9, cell: 3 });
      X.ball(9, 33 - b, 4, 3, dk(rock, 0.75), 'rock', { rz: 3, z: 10, cell: 2 });
      // Its brow, a shelf of rock.
      X.ball(12, 27 - b, 5.4, 2, dk(rock, 0.7), 'rock', { rz: 2, z: 11, cell: 2 });
      X.in(3, 0.5);
      // Molten seams.
      for (const [x0, y0, x1, y1] of [[30, 24, 40, 42], [44, 20, 48, 36], [26, 38, 34, 48]]) X.tube(x0, y0 - b, x1, y1 - b, 1.2, 0.8, '#ff6a1a', 'molten', { z: 16, glow: '#ffb040', glowK: 0.5, cell: 2 });
    },
    paint(P, J, t, st) {
      const b = Math.round(J.b);
      const wake = st.wind || st.eyes;
      // The core in its chest; its eye under the brow.
      P.blob(34, 32 - b, 4.4 + Math.sin(t * TAU) * 0.6, 4.4, wake ? '#5ac8ff' : '#ff8030', { lift: 0.6 });
      P.blob(34, 32 - b, 2, 2, wake ? '#e0f8ff' : '#ffe070', { lift: 0.8 });
    },
    glow(P, J, t, st) {
      const b = Math.round(J.b);
      const wake = st.wind || st.eyes;
      glow(P, 34, 32 - b, 7, wake ? '#5ac8ff' : '#ff6a1a', 0.45);
      eyes(P, [[10, 29 - b]], wake ? '#a0e8ff' : '#ffd060', { big: true });
      glow(P, 10, 29 - b, 2.4, wake ? '#5ac8ff' : '#ff8030', 0.4);
    },
    parts: {
      // Its arms: the far one behind, the near one swinging, both down to
      // its knuckles.
      armF: {
        w: 22, h: 40, px: 12, py: 5, role: 'offhand', layer: 'back', z: -2, amp: 0.7,
        at: [48, 26],
        body(X) {
          X.in(0, 2);
          X.limb([[12, 5, 6, 1], [14, 18, 5, 2], [12, 31, 6, 2]], '#463a36', 'rock', { cell: 4 });
          X.ball(11, 34, 6.4, 4.4, '#463a36', 'rock', { z: 3, rz: 4, cell: 3 });
        },
      },
      armN: {
        w: 24, h: 42, px: 14, py: 5, role: 'weapon', layer: 'front', z: 5, amp: 0.7,
        at: [30, 25],
        body(X) {
          X.in(0, 2);
          X.ball(14, 6, 7, 6.4, '#5a4a44', 'rock', { rz: 6, cell: 4 });
          X.limb([[14, 7, 6.4, 1], [10, 20, 5.4, 2], [11, 33, 6.6, 2]], '#5a4a44', 'rock', { cell: 4 });
          X.ball(11, 36, 7.4, 5, '#5a4a44', 'rock', { z: 3, rz: 4.4, cell: 3 });
          X.in(1, 0.5);
          X.tube(15, 8, 11, 22, 1, 0.6, '#ff6a1a', 'molten', { z: 12, glow: '#ffb040', glowK: 0.5, cell: 2 });
        },
        paint(P) {
          for (let i = 0; i < 4; i++) P.set(6 + i * 3, 38, hex('#2a2020'));
        },
      },
    },
    fx(R, ctx, pose) {
      const t = R.r.time;
      const wake = R.st.wind || R.st.eyes;
      inPose(R, ctx, pose, () => {
        if (wake) {
          // Iron filings drawn to its heart, wheeling in.
          for (let i = 0; i < 10; i++) {
            const a = (i / 10) * TAU + t * 2;
            const k = (t * 1.5 + i / 10) % 1;
            dot(ctx, R.ox + 34 + Math.cos(a) * (22 - k * 18), R.oy + 32 + Math.sin(a) * (14 - k * 10), '#a0e8ff', 0.9);
          }
        }
        embers(ctx, R.ox + 24, R.oy + 40, 24, t, { n: 4, rise: 30, speed: 0.35 });
        smoke(ctx, R.ox + 42, R.oy + 18, t, { n: 3, rise: 14, a: 0.3 });
      });
    },
  },

  // The Molten Heart: a heart of rock and fire, the kiln-mountain's own,
  // hung in the air by four chains to the anchors of its hall: it beats,
  // twice and rests, the veins in it flaring with every beat, its great
  // vessels torn off short and glowing within, and it bleeds fire.
  molten_heart: {
    size: 64, ay: 62,
    body(X, J, t) {
      const beat = beatOf(t);
      const s = 1 + beat * 0.07;
      const cy = 30;
      const crust = '#4a2a24';
      X.in(0, 4);
      // The heart: its two great chambers and their meeting, narrowing to
      // the point below, a crust of cooled rock on it.
      X.ball(28, cy - 2, 12 * s, 12 * s, crust, 'rock', { rz: 11, cell: 4 });
      X.ball(38, cy, 10 * s, 11 * s, dk(crust, 0.9), 'rock', { rz: 10, cell: 4, z: -1 });
      X.ball(31, cy + 10, 9 * s, 8 * s, crust, 'rock', { rz: 8, cell: 4, z: 1 });
      X.ball(31, cy + 17, 4.4 * s, 4.4 * s, crust, 'rock', { rz: 4, cell: 3, z: 1 });
      X.ball(24, cy - 12, 6 * s, 5 * s, '#5a2a22', 'flesh', { rz: 5, z: 3 });
      X.in(1, 1.5);
      // Its great vessels, torn off short: the arch rising out of the top
      // of it and over, the trunk beside it, a vein behind; each open end
      // dark, glowing within.
      X.limb([[29, cy - 12, 3.6, 4], [28, cy - 19, 3.4, 5], [31, cy - 24, 3.2, 6], [36, cy - 25, 3, 6], [40, cy - 21, 2.8, 6]], '#7a3428', 'flesh');
      X.limb([[34, cy - 12, 2.8, 8], [35, cy - 17, 2.5, 8], [34, cy - 20, 2.2, 8]], '#6a3024', 'flesh');
      X.limb([[20, cy - 9, 2.4, 2], [17, cy - 15, 2, 2]], '#5a2620', 'flesh');
      for (const [x, y, r] of [[40.4, cy - 19.4, 2.2], [34, cy - 21, 1.8], [17, cy - 16, 1.5]]) X.ball(x, y, r, r * 0.6, '#ff6a1a', 'molten', { z: 10, rz: 0.5, glow: '#ffb040', glowK: 0.5 });
      // An iron band about it where its chains are fast, rings on it.
      X.in(2, 1);
      X.ball(32, cy + 2, 16 * s, 1.6, '#4a4448', 'metal', { z: 14, rz: 1.4 });
      for (const x of [17, 47]) X.ball(x, cy + 2, 1.6, 2, '#6a6468', 'metal', { z: 15, rz: 1 });
    },
    paint(P, J, t) {
      const beat = beatOf(t);
      seams(P, 14, 52, 7, mix(hex('#c83a10'), hex('#ffd060'), beat), { hot: 0.45 });
    },
    glow(P, J, t) {
      const beat = beatOf(t);
      const h = toHex(mix(hex('#ff5a10'), hex('#fff0a0'), beat));
      const k = 0.6 + beat * 0.4;
      for (const pts of [[[24, 24], [27, 31], [25, 38]], [[38, 22], [35, 30], [39, 37]], [[31, 18], [32, 28], [32, 38], [32, 46]]]) crack(P, pts, h, '#ffffff', k);
      glow(P, 32, 30, 9, '#ff6020', 0.12 + beat * 0.3);
    },
    under(R) {
      heartChains(R, false);
    },
    over(R) {
      heartChains(R, true);
    },
    fx(R, ctx, pose) {
      const t = R.r.time;
      const beat = beatOf((R.e.artPhase || 0) % 1);
      inPose(R, ctx, pose, () => {
        glowAt(ctx, R.ox + 32, R.oy + 28, 18, '#ff6020', 0.12 + beat * 0.25);
        // It bleeds fire: drops falling off it, splashing below.
        drops(ctx, R.ox + 28, R.oy + 48, t, [0, 3, 7], { col: '#ffb040', len: 12, speed: 0.8 });
        embers(ctx, R.ox + 18, R.oy + 44, 28, t, { n: 5, rise: 30 });
      });
    },
  },
});
