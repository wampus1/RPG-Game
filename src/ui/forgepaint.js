// (Round 133) The forge's four workshops, built and lit (see forgelight.js):
// rooms seen in one-point perspective, their furniture standing solid in
// them, everything lit by the light that's really there.
//   The smithy: rough ashlar walls, a flagged floor sooted toward the fire;
//     the brick hearth with its coal bed, the plastered hood narrowing up
//     into the chimney; the great bellows in the near corner, piped into
//     the hearth; the anvil on its elm stump; the quench tub banded with
//     iron; tongs and hammers on a rack, horseshoes over it; a deep-set
//     window letting the moon in across the flags. Lit by the fire (and
//     what it throws back off the floor), the moon, a hot bar's own glow.
//   The carpenter's: boarded walls, wide floorboards strewn with shavings,
//     the long bench with its vise, saws and chisels on the wall, timber
//     stacked by the window; daylight pouring in, motes hanging in it.
//   The bowyer's: limewashed wattle between dark timbers, a hanging lamp,
//     dusk at the window; the tillering post; staves in the corner, a
//     barrel of arrows, a pot of feathers.
//   The cutting table: dark panelling and shelves of hides and spools; the
//     long table seen from above, its top worn smooth; a lantern on it.
// Each scene's lasting part is laid down once (and its shadows cast); what
// moves (the fire, the work, the hammer, the bow) is laid into it fresh each
// moment (the functions below), then the whole lit.
import { Cam, GBuf, mat, room, box, extrude, cyl, lump, rod, face, put, emit, halo, light, castShadows, shade, shafts, bayer, W, H } from './forgelight.js';
import { hash2, vnoise, mixC, rgb } from '../render/brush.js';
import { itemIcon } from '../render/sprites.js';

export const FW = W;
export const FH = H;

// ------------------------------------------------------------ materials
const M = {
  stone: mat('#6e6258'),
  stoneB: mat('#5e6066'),
  mortar: mat('#3c3432', { wrap: 0.3 }),
  brick: mat('#9a4a34'),
  plaster: mat('#8a7a6a', { wrap: 0.3 }),
  flag: mat('#6a625c'),
  joint: mat('#2e2828', { wrap: 0.3 }),
  oak: mat('#6e4a2e', { wrap: 0.26 }),
  oakD: mat('#4a3122', { wrap: 0.26 }),
  elm: mat('#7a5a3a', { wrap: 0.26 }),
  yew: mat('#c08a4a', { wrap: 0.3, spec: 0.25, gloss: 10 }),
  bark: mat('#4e3a2a', { wrap: 0.3 }),
  pine: mat('#b0885a', { wrap: 0.28 }),
  board: mat('#8a6440', { wrap: 0.28 }),
  boardD: mat('#5a4434', { wrap: 0.28 }),
  grey: mat('#7a7064', { wrap: 0.28 }),
  pale: mat('#c89c66', { wrap: 0.36 }),
  endgrain: mat('#c49a66', { wrap: 0.28 }),
  iron: mat('#555a66', { spec: 0.9, gloss: 14 }),
  steel: mat('#7a8292', { spec: 1.5, gloss: 26 }),
  brass: mat('#b08a3a', { spec: 1.1, gloss: 16 }),
  leather: mat('#7a4a2c', { wrap: 0.34, spec: 0.12, gloss: 6 }),
  hide: mat('#a8743e', { wrap: 0.36 }),
  hideD: mat('#7a5230', { wrap: 0.36 }),
  cloth: mat('#c4b490', { wrap: 0.42 }),
  sleeve: mat('#6a4a3a', { wrap: 0.42 }),
  skin: mat('#c89070', { wrap: 0.4 }),
  string: mat('#e0d4b0', { wrap: 0.5 }),
  coal: mat('#2c2a32', { spec: 0.7, gloss: 9 }),
  water: mat('#1e3644', { spec: 1.8, gloss: 46 }),
  lime: mat('#d4c8ae', { wrap: 0.3 }),
  timber: mat('#4a3424', { wrap: 0.26 }),
  earth: mat('#5e4a3a', { wrap: 0.3 }),
  clay: mat('#9a5a3a', { wrap: 0.3 }),
  feather: mat('#e8e4d8', { wrap: 0.5 }),
  red: mat('#a8302a', { wrap: 0.4 }),
  blue: mat('#3a5a9a', { wrap: 0.4 }),
  chalk: mat('#e8e4dc', { wrap: 0.5 }),
  panel: mat('#5a3c28', { wrap: 0.24, spec: 0.15, gloss: 8 }),
  table: mat('#5e3e28', { wrap: 0.26, spec: 0.2, gloss: 10 }),
  // (What shines of itself.)
  fire: mat(['#140403', '#380905', '#721505', '#b02808', '#e0500e', '#f48a26', '#fbc44a', '#ffeca8', '#ffffff'], { unlit: true }),
  hot: mat(['#2a2426', '#4a1a14', '#8a1a10', '#c8300c', '#e8601a', '#f8a030', '#fde070', '#fffbe8'], { unlit: true }),
  night: mat(['#04060f', '#080e24', '#0e1838', '#16244e', '#223668', '#30487e'], { unlit: true }),
  moon: mat(['#8c96b4', '#c8d0e4', '#f0f4fc', '#ffffff'], { unlit: true }),
  day: mat(['#7aa8d8', '#9cc4e8', '#c4dcf2', '#e8f2fa', '#fffaf0'], { unlit: true }),
  dusk: mat(['#2a2648', '#4a3c68', '#8a5478', '#d07a78', '#f0aa78', '#f8d098'], { unlit: true }),
  flame: mat(['#a83a10', '#f08a20', '#ffd060', '#fff4c8', '#ffffff'], { unlit: true }),
  glass: mat(['#6a5a3a', '#c8a060', '#ffe8a8', '#fffbe8'], { unlit: true }),
};
export { M as MATERIALS };

const HEAT = ['#2a2426', '#4a1a14', '#8a1a10', '#c8300c', '#e8601a', '#f8a030', '#fde070', '#fffbe8'];
// The colour of hot iron, `k` from cold (0) to white (1).
export function heatColour(k) {
  const f = Math.max(0, Math.min(1, k)) * (HEAT.length - 1);
  const i = Math.floor(f);
  return mixC(rgb(HEAT[i]), rgb(HEAT[Math.min(HEAT.length - 1, i + 1)]), f - i);
}
export const HEAT_RAMP = HEAT;
const hexOf = (c) => `#${c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;

// ------------------------------------------------------------ texture
const h2 = hash2;
// Coursed stone on a plane (a, b across it): which block, and where in it.
function courses(a, b, s, ch = 8, w0 = 12, wv = 9) {
  const row = Math.floor(b / ch);
  const fb = b - row * ch;
  const w = w0 + Math.floor(h2(row, 3, s) * wv);
  const off = h2(row, 5, s) * w;
  const col = Math.floor((a + off) / w);
  const fa = a + off - col * w;
  return { row, col, fa, fb, w, ch, id: h2(col, row, s) };
}
// A stone's face: its tone, clusters of wear, a chip now and then.
function stoneTone(c, a, b, s) {
  let v = 0.86 + (c.id - 0.5) * 0.34 + (vnoise(a * 0.32, b * 0.32, s) - 0.5) * 0.24;
  if (h2(Math.floor(a / 2), Math.floor(b / 2), s + 9) < 0.06) v *= 0.78;
  if (h2(Math.floor(a), Math.floor(b), s + 11) < 0.02) v *= 1.14;
  return v;
}
// A stone's edges rounded: they lean toward the light, or away (a nudge to
// the plane's facing `N`, along its two directions `ta` and `tb`).
function bevel(c, N, ta, tb, k = 0.85) {
  const e = (t, f) => [N[0] + t[0] * f, N[1] + t[1] * f, N[2] + t[2] * f];
  if (c.fb < 1.9) return e(tb, -k);
  if (c.fb > c.ch - 1.4) return e(tb, k * 0.8);
  if (c.fa < 1.9) return e(ta, -k * 0.8);
  if (c.fa > c.w - 1.4) return e(ta, k * 0.8);
  return null;
}
// Boards running along `a`, `bw` wide: their seams, grain, knots.
function boards(a, b, s, bw = 7) {
  const idx = Math.floor(b / bw);
  const fb = b - idx * bw;
  // (Board ends, staggered.)
  const len = 38 + Math.floor(h2(idx, 2, s) * 40);
  const off = h2(idx, 3, s) * len;
  const seg = Math.floor((a + off) / len);
  const fa = a + off - seg * len;
  const sid = h2(idx, seg, s + 4);
  let v = 0.84 + (sid - 0.5) * 0.3;
  // Grain: long wavy streaks, a few tones.
  const gr = Math.sin(fb * 1.7 + vnoise(a * 0.05, idx * 3.1, s) * 6 + a * 0.02);
  if (gr > 0.72) v *= 0.84;
  else if (gr < -0.85) v *= 1.08;
  // A knot.
  const kx = h2(idx, seg, s + 7) * len;
  const ky = bw * (0.3 + h2(idx, seg, s + 8) * 0.4);
  const kd = Math.hypot((fa - kx) * 0.6, fb - ky);
  if (h2(idx, seg, s + 9) < 0.5 && kd < 1.6) v *= kd < 0.8 ? 0.5 : 0.72;
  return { v, fb, fa, bw, seam: fb < 0.8 || fa < 0.6, edge: fb > bw - 1.2 };
}
// The night (or day, or dusk) through a window: whatever the room left
// empty.
function sky(gb, m, val) {
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (gb.mat[i]) continue;
      gb.mat[i] = m;
      gb.z[i] = 400;
      gb.val[i] = val(x, y);
    }
  }
}
// A window's wall, solid round its hole (for the light through it).
function windowWall(S, Wn, d0, d1) {
  S.solids.push({ t: 'box', x0: -300, x1: Wn.x0, y0: -300, y1: 300, d0, d1 });
  S.solids.push({ t: 'box', x0: Wn.x1, x1: 300, y0: -300, y1: 300, d0, d1 });
  S.solids.push({ t: 'box', x0: Wn.x0, x1: Wn.x1, y0: -300, y1: Wn.y0, d0, d1 });
  S.solids.push({ t: 'box', x0: Wn.x0, x1: Wn.x1, y0: Wn.y1, y1: 300, d0, d1 });
}

// ------------------------------------------------------------ the shop
// A workshop: its lasting part laid down once and its shadows cast; then
// each moment copied, the moving things laid in, and the whole lit.
export class Shop {
  constructor(kind, seed = 1) {
    const B = SHOPS[kind] || SHOPS.forge;
    this.kind = kind;
    this.seed = seed;
    this.def = B;
    this.cam = B.cam;
    this.base = new GBuf(this.cam);
    this.solids = [];
    this.px = {};
    B.build(this);
    for (const L of B.shadowLights) castShadows(this.base, this.solids, L, L.slot, L.soft || 3);
    if (B.air) B.air(this);
    this.gb = new GBuf(this.cam);
  }

  begin() {
    this.gb.copy(this.base);
    return this.gb;
  }

  // Lit and put up: `state` says how the lights are just now.
  render(g, t, state = {}) {
    if (!this.img) this.img = g.createImageData(W, H);
    const lights = this.def.lights(this, t, state);
    shade(this.gb, lights, this.def.amb, this.img.data);
    g.putImageData(this.img, 0, 0);
  }

  p(x, y, d) {
    return this.cam.p(x, y, d);
  }
}

// ------------------------------------------------------------ the smithy
const SMI = {
  cam: new Cam(128, 40, 120),
  room: { fy: 50, cy: -60, lx: -104, rx: 104 },
  hearth: { x0: -70, x1: -24, y0: 28, y1: 50, d0: 90, d1: 116 },
  pit: { x0: -62, x1: -32, d0: 95, d1: 112 },
  fire: [-47, 12, 103],
  anvil: { d0: 67, d1: 76, face: 20, x0: -4, x1: 24 },
  stump: { cx: 12, cz: 72, r: 9, y0: 30, y1: 50 },
  tub: { cx: 58, cz: 77, r: 11, y0: 32, y1: 50, water: 33 },
  window: { x0: 48, x1: 74, y0: -18, y1: 4 },
  bellows: { x0: -100, x1: -72, y: 33, d0: 94, d1: 106 },
};
SMI.moon = [61 + 21 * 7, -7 - 57 * 7, 120 + 28 * 7];
export const SMITHY = SMI;

function buildSmithy(S) {
  const gb = S.base;
  const s = S.seed;
  const Wn = SMI.window;
  room(gb, SMI.room, (pl, wx, wy, d) => {
    if (pl === 'floor') {
      // Flags, laid in courses across the room, sooted toward the hearth,
      // scattered with scale round the anvil.
      const c = courses(wx, d, s + 2, 13, 16, 10);
      if (c.fb < 0.8 || c.fa < 0.8) return [M.joint, 0.8];
      let v = stoneTone(c, wx, d, s + 3) * 0.94;
      const soot = Math.max(0, 1 - Math.hypot(wx + 47, (d - 100) * 1.4) / 60);
      v *= 1 - soot * 0.35;
      if (Math.hypot(wx - 12, d - 66) < 16 && h2(Math.floor(wx), Math.floor(d), 21) < 0.08) v *= 0.7;
      return [M.flag, v, bevel(c, [0, -1, 0], [1, 0, 0], [0, 0, 1], 0.6)];
    }
    if (pl === 'ceil') return [M.oakD, 0.6];
    if (pl === 'back' && wx >= Wn.x0 && wx <= Wn.x1 && wy >= Wn.y0 && wy <= Wn.y1) return null;
    const N = pl === 'back' ? [0, 0, -1] : pl === 'left' ? [1, 0, 0] : [-1, 0, 0];
    const a = pl === 'back' ? wx : d;
    const ta = pl === 'back' ? [1, 0, 0] : [0, 0, 1];
    const c = courses(a, wy + 60, s + (pl === 'back' ? 0 : 7), 8, 12, 9);
    if (c.fb < 0.9 || c.fa < 0.9) return [M.mortar, 0.75];
    let v = stoneTone(c, a, wy, s);
    // (Soot, thick over the hearth and up into the dark.)
    const soot = Math.max(0, 1 - Math.hypot((wx + 47) * 0.9, (wy + 10) * 0.7) / 70);
    v *= (1 - soot * 0.45) * (0.84 + Math.min(1, (wy + 60) / 90) * 0.18);
    return [c.id < 0.3 ? M.stoneB : M.stone, v, bevel(c, N, ta, [0, 1, 0])];
  });
  // The night through the window, the moon, a star or two.
  sky(gb, M.night, (x, y) => {
    const mx = x - 196;
    const my = y - 28;
    if (mx * mx + my * my <= 10) {
      gb.mat[y * W + x] = M.moon;
      return mx * mx + my * my <= 4 ? 1 : 0.55 + (mx < 0 ? 0.2 : 0);
    }
    if (h2(x, y, 41) < 0.025) {
      gb.mat[y * W + x] = M.moon;
      return 0.3;
    }
    return 0.75 - ((y - 22) / 26) * 0.6;
  });
  // Its deep reveal, its sill, its cross of oak.
  const reveal = (shade0) => (P) => {
    const c = courses(P[0] + P[2] * 2, P[1] + P[2], s + 5, 6, 9, 5);
    return [M.stone, stoneTone(c, P[0], P[2], s) * shade0];
  };
  face(gb, [[Wn.x1, Wn.y0, 120], [Wn.x1, Wn.y1, 120], [Wn.x1, Wn.y1, 130], [Wn.x1, Wn.y0, 130]], reveal(0.9));
  face(gb, [[Wn.x0, Wn.y1, 120], [Wn.x1, Wn.y1, 120], [Wn.x1, Wn.y1, 130], [Wn.x0, Wn.y1, 130]], reveal(1));
  face(gb, [[Wn.x0, Wn.y0, 120], [Wn.x1, Wn.y0, 120], [Wn.x1, Wn.y0, 130], [Wn.x0, Wn.y0, 130]], reveal(0.7));
  const mid = (Wn.x0 + Wn.x1) / 2;
  const midy = (Wn.y0 + Wn.y1) / 2;
  const frame = (sv) => [M.oakD, 0.8 + sv * 0.2];
  rod(gb, [mid, Wn.y0, 128], [mid, Wn.y1, 128], 1.6, frame);
  rod(gb, [Wn.x0, midy, 128], [Wn.x1, midy, 128], 1.6, frame);
  windowWall(S, Wn, 120, 130);
  S.solids.push({ t: 'box', x0: mid - 0.8, x1: mid + 0.8, y0: Wn.y0, y1: Wn.y1, d0: 127, d1: 129 });
  S.solids.push({ t: 'box', x0: Wn.x0, x1: Wn.x1, y0: midy - 0.8, y1: midy + 0.8, d0: 127, d1: 129 });

  // A heavy beam across the wall, the hood's lintel.
  box(gb, -104, 104, -40, -34, 112, 120, (side, P) => [M.oakD, boards(P[0], side === 'front' ? P[1] * 2 : P[2], s + 30, 6).v * (side === 'bottom' ? 0.7 : 1)]);

  // The hearth: brick, its coal bed sunk in its top, an iron rim along its
  // front, its ash pit an arch at its foot.
  const Hh = SMI.hearth;
  const pit = SMI.pit;
  S.px.coal = [];
  box(gb, Hh.x0, Hh.x1, Hh.y0, Hh.y1, Hh.d0, Hh.d1, (side, P, u, v, x, y) => {
    if (side === 'top') {
      if (P[0] > pit.x0 && P[0] < pit.x1 && P[2] > pit.d0 && P[2] < pit.d1) {
        S.px.coal.push([x, y, (P[0] - pit.x0) / (pit.x1 - pit.x0), (P[2] - pit.d0) / (pit.d1 - pit.d0)]);
        return [M.coal, 0.6 + h2(x, y, 3) * 0.5];
      }
      if (P[2] < Hh.d0 + 2.2 || P[0] > Hh.x1 - 2.2) return [M.iron, 0.9];
      const c = courses(P[0], P[2] * 1.4, s + 12, 4, 7, 2);
      return c.fb < 0.7 || c.fa < 0.7 ? [M.mortar, 0.6] : [M.brick, stoneTone(c, P[0], P[2], s) * 0.75];
    }
    const a = side === 'front' ? P[0] : P[2];
    const c = courses(a, P[1], s + 13, 3.4, 7, 1);
    if (side === 'front') {
      const ax = (u - 0.5) / 0.16;
      const ay = (v - 0.98) / 0.42;
      if (ax * ax + ay * ay < 1) return [M.joint, 0.5 + (ay > -0.4 ? 0.2 : 0)];
    }
    if (c.fb < 0.7 || c.fa < 0.8) return [M.mortar, 0.7];
    const soot = side === 'front' ? Math.max(0, 1 - v * 1.6) * 0.3 : 0;
    return [M.brick, stoneTone(c, a, P[1], s + 1) * (1 - soot), bevel(c, side === 'front' ? [0, 0, -1] : [1, 0, 0], side === 'front' ? [1, 0, 0] : [0, 0, 1], [0, 1, 0], 0.7)];
  }, S.solids);
  // The hood: plaster gone black with soot, a riveted iron band round its
  // rim, narrowing up into the chimney.
  face(gb, [[-76, -6, 98], [-18, -6, 98], [-34, -30, 110], [-60, -30, 110]], (P) => {
    const k = (P[1] + 30) / 24;
    let v = (0.5 + k * 0.45) * (0.9 + (vnoise(P[0] * 0.3, P[1] * 0.3, s + 20) - 0.5) * 0.3);
    if (P[1] > -9) return [M.iron, 1.1 + (Math.round(P[0]) % 6 === 0 ? 0.45 : 0), [0, 0.5, -1]];
    if (h2(Math.floor(P[0] / 2), Math.floor(P[1] / 2), 22) < 0.05) v *= 0.8;
    return [M.plaster, v * 0.85, [0, 0.25, -1]];
  });
  face(gb, [[-18, -6, 98], [-18, -6, 120], [-34, -30, 120], [-34, -30, 110]], (P) => (P[1] > -9 ? [M.iron, 0.8] : [M.plaster, 0.55 + ((P[1] + 30) / 24) * 0.3]));
  face(gb, [[-76, -6, 98], [-18, -6, 98], [-18, -6, 120], [-76, -6, 120]], () => [M.plaster, 0.35]);
  box(gb, -60, -34, -60, -30, 110, 120, (side, P) => {
    const c = courses(side === 'front' ? P[0] : P[2], P[1], s + 23, 3.4, 7, 1);
    return c.fb < 0.7 || c.fa < 0.8 ? [M.mortar, 0.5] : [M.brick, stoneTone(c, P[0], P[1], s) * 0.55];
  });
  S.solids.push({ t: 'box', x0: -76, x1: -18, y0: -9, y1: -5, d0: 98, d1: 120 });

  // The tool rack: a board on pegs, tongs and hammers hung from it.
  box(gb, -10, 34, -8, -4, 116, 118, (side, P) => [M.oakD, boards(P[0], P[1] * 3, s + 40, 4).v * 0.9], S.solids);
  const hang = (x, kind, len) => {
    const top = -4;
    const d = 115.5;
    rod(gb, [x, top - 1, d + 0.5], [x, top + 0.5, d], 0.8, () => [M.oakD, 0.6]);
    if (kind === 'tongs') {
      rod(gb, [x - 0.4, top, d], [x - 2, top + len, d], 0.9, (sv) => [M.iron, 0.95 + sv * 0.1]);
      rod(gb, [x + 0.4, top, d], [x + 2.2, top + len, d], 0.9, (sv) => [M.iron, 0.95 + sv * 0.1]);
      S.solids.push({ t: 'box', x0: x - 2, x1: x + 2, y0: top, y1: top + len, d0: d - 0.5, d1: d + 0.5 });
    } else {
      rod(gb, [x, top, d], [x, top + len, d], 1.1, () => [M.oak, 0.95]);
      box(gb, x - 3, x + 3, top + len - 0.5, top + len + 2.6, d - 1.2, d + 1.2, () => [M.iron, 1]);
      S.solids.push({ t: 'box', x0: x - 3, x1: x + 3, y0: top, y1: top + len + 2.6, d0: d - 1.2, d1: d + 1.2 });
    }
  };
  hang(-4, 'tongs', 16);
  hang(3, 'tongs', 18);
  hang(11, 'hammer', 10);
  hang(19, 'hammer', 12);
  hang(27, 'hammer', 9);
  // Horseshoes nailed in a row above.
  for (let i = 0; i < 4; i++) {
    const hx = -6 + i * 10;
    for (let a = 0; a < 16; a++) {
      const an = Math.PI * (0.05 + (a / 15) * 0.9);
      const [sx, sy] = S.p(hx + Math.cos(an) * 2.4, -14 - Math.sin(an) * 2.6, 117.5);
      put(gb, Math.round(sx), Math.round(sy), M.iron, 0.95, Math.cos(an), -Math.sin(an), -0.6, 117.5);
    }
  }

  // The anvil's stump: elm, its bark ridged, its top cut and ringed.
  const St = SMI.stump;
  cyl(gb, St.cx, St.cz, St.r, St.y0, St.y1, (part, P, a, f) => {
    if (part === 'top') {
      const rr = Math.hypot(a, f);
      if (rr > 0.86) return [M.bark, 0.8];
      return [M.endgrain, 0.78 + (Math.floor(rr * 9) % 2 ? 0.1 : -0.05) + (h2(Math.floor(P[0] * 2), Math.floor(P[2] * 2), 4) - 0.5) * 0.12];
    }
    const ridge = Math.sin(a * 23 + vnoise(a * 4, f * 6, s) * 3);
    return [M.bark, 0.82 + (ridge > 0.5 ? -0.24 : ridge < -0.6 ? 0.12 : 0) + (f > 0.9 ? -0.2 : 0)];
  }, S.solids);
  // The anvil: horn toward the fire, its face polished bright, its waist
  // and feet dark with the hammer's scale.
  const A = SMI.anvil;
  const f = A.face;
  const pts = [[-18, f + 2.5], [-11, f + 0.6], [-4, f], [24, f], [26, f + 0.6], [26, f + 4], [21, f + 5.5], [18, f + 7.5], [22, f + 9], [24, f + 10], [-4, f + 10], [-2, f + 9], [2, f + 7.5], [0, f + 5.5], [-6, f + 5], [-12, f + 4]];
  extrude(gb, pts, A.d0, A.d1, (side, P, i, u, x, y, t) => {
    if (side === 'edge' && i === 2) {
      // The face: steel, bright; the hardy hole near the heel.
      if (P[0] > 18 && P[0] < 21 && t > 0.35 && t < 0.65) return [M.joint, 0.4];
      return [M.steel, 1.05 + (h2(x, y, 5) - 0.5) * 0.06];
    }
    if (side === 'front') {
      let v = 0.8 + (vnoise(P[0] * 0.5, P[1] * 0.5, s + 31) - 0.5) * 0.16;
      if (P[1] > f + 8.6) v *= 0.85;
      return [M.iron, v];
    }
    return [i === 1 || i === 3 ? M.steel : M.iron, 0.86];
  }, S.solids);
  // Tongs leaning on the stump.
  rod(gb, [St.cx - 10, 50, 64], [St.cx - 6.5, 33, 63], 0.9, (sv) => [M.iron, 0.9 + sv * 0.1]);
  rod(gb, [St.cx - 8.5, 50, 63.5], [St.cx - 5.5, 33, 63], 0.9, (sv) => [M.iron, 0.9 + sv * 0.1]);

  // The quench tub: oak staves, two iron hoops, dark water.
  const T = SMI.tub;
  S.px.water = [];
  cyl(gb, T.cx, T.cz, T.r, T.y0, T.y1, (part, P, a, ff, x, y) => {
    if (part === 'top') {
      const rr = Math.hypot(a, ff);
      if (rr > 0.86) return [M.endgrain, 0.7 + (Math.floor((Math.atan2(ff, a) + 4) * 4.5) % 2 ? 0.12 : 0)];
      S.px.water.push([x, y, a, ff]);
      return [M.water, 0.9];
    }
    if ((ff > 0.16 && ff < 0.25) || (ff > 0.74 && ff < 0.83)) return [M.iron, 0.9];
    const st = Math.floor((a + 1) * 7.5);
    const seam = Math.abs((a + 1) * 7.5 - st - 0.5) > 0.44;
    return [M.oak, seam ? 0.55 : 0.82 + (h2(st, 1, s) - 0.5) * 0.22 + (ff > 0.92 ? -0.25 : 0)];
  }, S.solids);

  // Coal spilled by the hearth.
  for (let i = 0; i < 9; i++) {
    const cx = -26 + h2(i, 1, s) * 14;
    const cz = 84 + h2(i, 2, s) * 5;
    const r = 1.2 + h2(i, 3, s) * 1.4;
    lump(gb, [cx, 50 - r * 0.6, cz], [r, r * 0.7, r], () => [M.coal, 0.9], i < 3 ? S.solids : null);
  }
  // The bellows' post (the bellows themselves move: see bellows()).
  box(gb, -98, -95, 4, 50, 104, 107, (side, P) => [M.oakD, boards(P[1], P[0] * 3, s + 50, 3).v], S.solids);
  box(gb, -78, -75, 36, 50, 104, 107, (side, P) => [M.oakD, boards(P[1], P[0] * 3, s + 51, 3).v], S.solids);
}

function smithyLights(S, t, st) {
  const k = st.fire ?? 0.4;
  const fl = 0.9 + Math.sin(t * 13) * 0.05 + Math.sin(t * 5.3 + 1) * 0.05 + Math.sin(t * 29) * 0.02;
  const F = SMI.fire;
  const out = [
    light(F[0] + Math.sin(t * 7) * 0.6, F[1] - k * 2, F[2], 230 + k * 60, (1.3 + k * 1.9) * fl, '#ff8a3a', 0),
    // (A lamp hung somewhere behind you: the near side of things, dimly.)
    light(30, -30, 20, 170, 0.5, '#ffc890'),
    // (What the fire throws back off the floor and the hearth.)
    light(-34, 46, 84, 110, 0.18 + k * 0.22, '#ff7030'),
    light(SMI.moon[0], SMI.moon[1], SMI.moon[2], 900, 2.6, '#7c9cff', 1),
  ];
  const I = st.iron;
  if (I && I.heat > 0.3) out.push(light(I.x, I.y, I.z, 40 + I.heat * 50, (I.heat - 0.25) * 1.6, hexOf(heatColour(Math.min(1, I.heat + 0.1)))));
  return out;
}

// ---- the smithy's moving things
// The fire on the hearth: the coal bed glowing, tongues of flame rising,
// `k` how fierce (0..1).
export function fire(S, t, k) {
  const gb = S.gb;
  for (const [x, y, u, v] of S.px.coal) {
    const cx = Math.abs(u - 0.5) * 2;
    const cz = Math.abs(v - 0.5) * 2;
    const heart = 1 - Math.min(1, Math.hypot(cx, cz * 0.8));
    const fl = vnoise(x * 0.5, y * 0.5 + t * 2.5, 13) * 0.5 + vnoise(x * 0.9 + t * 3, y, 17) * 0.3;
    const dark = h2(x >> 1, y, 19) < 0.3 ? 0.25 : 0;
    const val = Math.max(0, heart * (0.42 + k * 0.5) + fl * (0.25 + k * 0.3) - dark);
    if (val > 0.16) put(gb, x, y, M.fire, Math.min(1, val), 0, -1, 0, gb.z[y * W + x], true);
  }
  // The flames: tongues over the pit, white at their roots.
  const P = SMI.pit;
  const dm = (P.d0 + P.d1) / 2;
  const [xa, ya] = S.p(P.x0 + 2, SMI.hearth.y0, dm);
  const [xb] = S.p(P.x1 - 2, SMI.hearth.y0, dm);
  const span = xb - xa;
  for (let x = Math.floor(xa); x <= Math.ceil(xb); x++) {
    const u = (x - xa) / span;
    const prof = Math.sin(Math.PI * Math.max(0, Math.min(1, u)));
    const n = 0.5 + 0.3 * Math.sin(x * 0.85 + t * 10) + 0.25 * vnoise(x * 0.4, t * 6, 3);
    const h = Math.round((3 + 22 * k) * prof * n);
    for (let j = 0; j < h; j++) {
      const y = Math.round(ya) - j;
      const fv = 1 - j / Math.max(1, h);
      if (j === h - 1 && h2(x, Math.floor(t * 18), 9) < 0.45) continue;
      // (Tongues licking sideways as they rise.)
      const sx = x + Math.round(Math.sin(j * 0.45 + t * 8 + x) * (j / 9));
      put(gb, sx, y, M.fire, 0.28 + fv * (0.5 + 0.22 * k), 0, 0, -1, 100);
    }
  }
  halo(gb, (xa + xb) / 2, ya - 4 - k * 5, 18 + k * 18, '#ff7a28', 0.7 + k * 0.5);
}
// The bellows: two boards hinged at the nozzle, the leather between them in
// folds, `c` how far squeezed (0 to 1); the lever over them.
export function bellows(S, c) {
  const gb = S.gb;
  const B = SMI.bellows;
  const open = 2 + (1 - c) * 10;
  const y = B.y;
  const dm = (B.d0 + B.d1) / 2;
  // The nozzle and its pipe into the hearth.
  rod(gb, [B.x1 + 1, y, dm], [SMI.hearth.x0 + 1, 38, SMI.hearth.d0 + 6], 2.2, (sv) => [M.iron, 0.9 + sv * 0.1]);
  rod(gb, [B.x1 - 2, y, dm], [B.x1 + 3, y, dm], 3, () => [M.brass, 1]);
  // The lower board.
  box(gb, B.x0, B.x1, y + 1, y + 2.6, B.d0, B.d1, (side, P) => [M.oak, boards(P[0], P[2], 61, 4).v]);
  // The leather: folds that bunch as it closes.
  const L = B.x1 - B.x0;
  const top = (x) => y + 1 - open * Math.min(1, (B.x1 - x) / L) ** 0.9;
  face(gb, [[B.x0, top(B.x0), B.d0 + 0.4], [B.x1, top(B.x1), B.d0 + 0.4], [B.x1, y + 1, B.d0 + 0.4], [B.x0, y + 1, B.d0 + 0.4]], (Pp) => {
    const tt = top(Pp[0]);
    const fr = (Pp[1] - tt) / Math.max(0.5, y + 1 - tt);
    const fold = (fr * 4) % 1;
    return [M.leather, 0.85 + (fold < 0.15 ? -0.25 : 0), fold < 0.5 ? [0, -0.8, -1] : [0, 0.8, -1]];
  });
  // The upper board, and the lever.
  face(gb, [[B.x1, top(B.x1) - 0.3, B.d0], [B.x0, top(B.x0) - 0.3, B.d0], [B.x0, top(B.x0) - 0.3, B.d1], [B.x1, top(B.x1) - 0.3, B.d1]], (Pp) => [M.oak, boards(Pp[0], Pp[2], 62, 4).v * 1.02, [0, -1, -0.15]]);
  const pv = [-96, 8, 100];
  rod(gb, [B.x0 + 3, top(B.x0) - 1, dm], pv, 1.4, (sv) => [M.iron, 0.9 + sv * 0.1]);
  rod(gb, [pv[0] - 6, pv[1] - 4 + c * 8, dm], [pv[0] + 18, pv[1] + 2 - c * 6, dm], 1.8, (sv) => [M.oak, 0.9 + sv * 0.1]);
  rod(gb, [pv[0] + 18, pv[1] + 2 - c * 6, dm], [pv[0] + 19, 2 - c * 6, dm - 4], 1.4, (sv) => [M.leather, 0.9 + sv * 0.1]);
}
// The bar in the fire, its end out over the hearth's rim, the tongs on it.
export function ironBar(S, heat) {
  const gb = S.gb;
  rod(gb, [-50, 26.5, 103], [-14, 25.2, 86], 1.7, (sv, a) => {
    const k = a < 0.55 ? heat : heat * Math.max(0, 1 - (a - 0.55) / 0.3);
    if (k > 0.18) return [M.hot, Math.min(1, k * (1 + sv * 0.08 - 0.04))];
    return [M.iron, 0.9];
  });
  rod(gb, [-17, 25, 87], [6, 18, 77], 1, (sv) => [M.iron, 0.95 + sv * 0.1]);
  rod(gb, [-16, 25.6, 86.5], [7, 21, 77.5], 1, (sv) => [M.iron, 0.95 + sv * 0.1]);
  if (heat > 0.3) {
    const [x, y] = S.p(-30, 26, 95);
    halo(gb, x, y, 6 + heat * 8, hexOf(heatColour(heat)), heat);
  }
  return { x: -32, y: 25, z: 95, heat };
}
// The billet on the anvil's face, being drawn out into the piece: a bar
// (fading as it takes shape) and the piece itself, lying on the face, as
// hot as it is. `flash`: a blow just landed.
export function billet(S, key, heat, p, flash = 0) {
  const gb = S.gb;
  const f = SMI.anvil.face;
  const h = heat + flash * 0.25;
  if (p < 0.98) {
    const len = 24 - p * 8;
    const x0 = 9 - len / 2;
    box(gb, x0, x0 + len, f - 1.6, f, 70, 73.5, (side) => (h > 0.2 ? [M.hot, Math.min(1, h * (side === 'top' ? 1.06 : 0.9))] : [M.steel, 0.9]));
  }
  if (p > 0.02) {
    // (Lying flat on the face: its picture laid on the anvil's top,
    // coming through as the bar goes.)
    const D = iconData(key);
    if (D) {
      const y = f - 0.25;
      face(gb, [[-3, y, 69], [21, y, 69], [21, y, 75], [-3, y, 75]], (P, x, yy) => {
        const c = D.px(Math.floor(((P[0] + 3) / 24) * 16), Math.floor(((P[2] - 69) / 6) * 16));
        if (!c || bayer(x, yy) > p * 1.1) return null;
        if (h > 0.2) return [M.hot, Math.min(1, h * (0.75 + c.l * 0.35))];
        return [c.m, 0.6 + c.l * 0.8, [0, -1, -0.2]];
      });
    }
  }
  return { x: 9, y: f - 2, z: 71, heat: h };
}
// The smith's hammer, swung from off to the right: `s` 0 raised, 1 struck.
export function hammer(S, s) {
  const gb = S.gb;
  const f = SMI.anvil.face;
  const e = s * s * (3 - 2 * s);
  const head = [10 + 20 * (1 - e), f - 2.2 - (1 - e) * 26, 71 - (1 - e) * 2];
  const hand = [34 + (1 - e) * 6, f - 12 - (1 - e) * 22, 66];
  rod(gb, hand, head, 1.3, (sv) => [M.oak, 0.95 + sv * 0.1]);
  const dx = head[0] - hand[0];
  const dy = head[1] - hand[1];
  const l = Math.hypot(dx, dy) || 1;
  const px = -dy / l;
  const py = dx / l;
  rod(gb, [head[0] + px * 3.4, head[1] + py * 3.4, head[2]], [head[0] - px * 2.6, head[1] - py * 2.6, head[2]], 3.2, (sv, a) => [M.iron, a > 0.86 ? 1.15 : 0.95]);
  lump(gb, [hand[0] + 1, hand[1], hand[2]], [2.2, 2, 2], () => [M.skin, 0.95]);
  rod(gb, [hand[0] + 2, hand[1] + 0.5, hand[2]], [hand[0] + 26, hand[1] - 6, hand[2] - 6], 5.5, (sv) => [M.sleeve, 0.9 + sv * 0.05]);
}
// The piece over the tub in the tongs (`dip` 0 held over, 1 under), hot as
// it is; under the water's face it's hidden.
export function quenchPiece(S, heat, dip) {
  const gb = S.gb;
  const T = SMI.tub;
  const y = T.water - 9 + dip * 13;
  const under = (P) => P[1] > T.water + 0.1 && (P[0] - T.cx) ** 2 + (P[2] - T.cz) ** 2 < (T.r - 1) ** 2;
  rod(gb, [T.cx - 8, y, T.cz - 2], [T.cx + 6, y - 1.5, T.cz - 2], 1.8, (sv, a, P) => {
    if (under(P)) return null;
    return heat > 0.18 ? [M.hot, Math.min(1, heat * (1 + sv * 0.06))] : [M.steel, 0.95];
  });
  rod(gb, [T.cx + 5, y - 1.5, T.cz - 2], [T.cx + 30, y - 16, T.cz - 8], 1, (sv, a, P) => (under(P) ? null : [M.iron, 0.95 + sv * 0.1]));
  rod(gb, [T.cx + 5, y - 0.4, T.cz - 2.5], [T.cx + 31, y - 13, T.cz - 8], 1, (sv, a, P) => (under(P) ? null : [M.iron, 0.95 + sv * 0.1]));
  if (heat > 0.3 && dip < 0.5) {
    const [x, yy] = S.p(T.cx - 1, y, T.cz - 2);
    halo(gb, x, yy, 6 + heat * 8, hexOf(heatColour(heat)), heat);
  }
  return { x: T.cx - 1, y, z: T.cz - 2, heat };
}
// The water in the tub: still, or stirred into rings (`stir` 0..1); a
// glow under it where hot iron went in.
export function water(S, t, stir = 0, glow = 0) {
  const gb = S.gb;
  for (const [x, y, a, f] of S.px.water) {
    const r = Math.hypot(a, f);
    const ring = Math.sin(r * 18 - t * 9) * stir;
    const wob = Math.sin(a * 6 + t * 1.3) * 0.15 + ring * 0.6;
    const i = y * W + x;
    gb.nx[i] = Math.round(wob * 60);
    gb.ny[i] = -100;
    gb.nz[i] = -Math.round(Math.sqrt(Math.max(0, 1 - wob * wob * 0.25)) * 127 * 0.6);
    if (glow > 0.05 && r < 0.5) emit(gb, x, y, [255, 120, 40], glow * (0.5 - r) * 0.6);
  }
}
// Where a puff of steam over the tub starts, on the scene.
export function tubMouth(S) {
  return S.p(SMI.tub.cx, SMI.tub.water, SMI.tub.cz - 3);
}
// A crucible tipped over a mould on the anvil (`tilt` 0..1), the mould
// filling (`fill` 0..1.2), the stream of metal between.
export function crucible(S, tilt, fill, t) {
  const gb = S.gb;
  const f = SMI.anvil.face;
  box(gb, -1, 19, f - 5, f, 69.5, 74.5, (side, P, u, v) => {
    if (side === 'top' && u > 0.15 && u < 0.85 && v > 0.2 && v < 0.8) {
      if (fill > 0.02) return [M.hot, Math.min(1, 0.55 + Math.min(1, fill) * 0.35 + (fill > 1.02 ? 0.1 : 0))];
      return [M.joint, 0.4];
    }
    return [M.clay, 0.9 + (h2(Math.floor(P[0] * 2), Math.floor(P[1] * 2), 3) - 0.5) * 0.15];
  });
  const cx = 16;
  const cy = f - 20;
  const ang = -tilt * 1.5;
  const ax = Math.cos(ang);
  const ay = Math.sin(ang);
  const mouth = [cx - ax * 4, cy - ay * 4, 71];
  rod(gb, [cx + ax * 4, cy + ay * 4, 71], mouth, 6, (sv, a) => [M.clay, 0.8 + (a > 0.85 ? 0.25 : 0)]);
  const [mx, my] = S.p(...mouth);
  put(gb, Math.round(mx), Math.round(my), M.hot, 0.95, 0, 0, -1, 69, true);
  rod(gb, [cx + 3, cy, 71], [cx + 30, cy - 14, 66], 1, (sv) => [M.iron, 0.95 + sv * 0.1]);
  if (tilt > 0.35) {
    const [sx, sy] = S.p(mouth[0], mouth[1], 71);
    const [, ey] = S.p(9, f - 5 + Math.min(1, fill) * 4, 72);
    for (let y = Math.round(sy); y < ey; y++) {
      const w = Math.round(Math.sin(y * 0.7 + t * 22) * 0.6);
      put(gb, Math.round(sx) + w, y, M.hot, 0.92, 0, 0, -1, 68, true);
      put(gb, Math.round(sx) + w + 1, y, M.hot, 0.75, 0, 0, -1, 68, true);
    }
    halo(gb, sx, ey - 2, 10, '#ff9030', 0.9);
  }
  return { x: 9, y: f - 6, z: 72, heat: fill > 0.02 || tilt > 0.35 ? 0.85 : 0 };
}

// ------------------------------------------------------------ the bench
const BEN = {
  cam: new Cam(128, 38, 120),
  room: { fy: 52, cy: -60, lx: -104, rx: 104 },
  bench: { x0: -46, x1: 46, y: 18, d0: 50, d1: 64 },
  window: { x0: -94, x1: -42, y0: -32, y1: 8 },
  blank: { x0: -30, x1: 30, y0: 13.5, d0: 53, d1: 58 },
};
BEN.sun = [-68 - 68 * 6, -12 - 30 * 6, 120 + 62 * 6];
export const BENCH = BEN;

function buildBench(S) {
  const gb = S.base;
  const s = S.seed + 100;
  const Wn = BEN.window;
  room(gb, BEN.room, (pl, wx, wy, d) => {
    if (pl === 'floor') {
      const b0 = boards(d * 1.2, wx, s, 9);
      if (b0.seam) return [M.joint, 0.7];
      // Shavings, curled and pale.
      if (h2(Math.floor(wx * 0.8), Math.floor(d * 0.8), s + 3) < 0.03 && Math.hypot(wx - 10, d - 70) < 40) return [M.endgrain, 1.15];
      return [M.boardD, b0.v * 0.92, b0.edge ? [0.6, -1, 0] : null];
    }
    if (pl === 'ceil') return [M.oakD, 0.6];
    if (pl === 'back' && wx >= Wn.x0 && wx <= Wn.x1 && wy >= Wn.y0 && wy <= Wn.y1) return null;
    // Upright boards, a batten across them.
    const a = pl === 'back' ? wx : d;
    const b0 = boards(wy * 0.7, a, s + (pl === 'back' ? 1 : 2), 8);
    if (Math.abs(wy + 10) < 2) return [M.oakD, 0.9, [0, -0.4, -1]];
    if (b0.seam) return [M.joint, 0.6];
    return [M.grey, b0.v * 0.9];
  });
  sky(gb, M.day, (x, y) => 0.35 + (y / 60) * 0.5);
  const mid = (Wn.x0 + Wn.x1) / 2;
  const midy = (Wn.y0 + Wn.y1) / 2;
  const fr = (sv) => [M.oak, 0.85 + sv * 0.15];
  for (const x of [Wn.x0, mid, Wn.x1]) rod(gb, [x, Wn.y0, 121], [x, Wn.y1, 121], 2, fr);
  for (const y of [Wn.y0, midy, Wn.y1]) rod(gb, [Wn.x0, y, 121], [Wn.x1, y, 121], 2, fr);
  face(gb, [[Wn.x0 - 2, Wn.y1 + 1, 118], [Wn.x1 + 2, Wn.y1 + 1, 118], [Wn.x1 + 2, Wn.y1 + 1, 122], [Wn.x0 - 2, Wn.y1 + 1, 122]], () => [M.oak, 0.9]);
  windowWall(S, Wn, 120, 124);
  S.solids.push({ t: 'box', x0: mid - 1, x1: mid + 1, y0: Wn.y0, y1: Wn.y1, d0: 120, d1: 122 });
  S.solids.push({ t: 'box', x0: Wn.x0, x1: Wn.x1, y0: midy - 1, y1: midy + 1, d0: 120, d1: 122 });

  // Tools on the wall: a board, a saw, chisels, a mallet, a square.
  box(gb, -20, 70, -26, -2, 117, 118.5, (side, P) => [M.oakD, boards(P[0], P[1], s + 9, 6).v * 0.9]);
  face(gb, [[-12, -22, 116.5], [8, -21, 116.5], [8, -15, 116.5], [-12, -12, 116.5]], (P) => {
    if (P[1] > -12.8 - ((P[0] + 12) / 20) * 2.6 && Math.floor(P[0] * 2) % 2 === 0) return null;
    return [M.steel, 0.85];
  });
  box(gb, -16, -11.5, -23, -14, 116, 117, () => [M.oak, 0.9]);
  S.solids.push({ t: 'box', x0: -16, x1: 8, y0: -23, y1: -12, d0: 116, d1: 117 });
  for (let i = 0; i < 5; i++) {
    const x = 18 + i * 4;
    rod(gb, [x, -22, 116.5], [x, -16, 116.5], 1.6, (sv) => [M.oak, 0.9 + sv * 0.1]);
    rod(gb, [x, -16, 116.5], [x, -9 - (i % 2) * 2, 116.5], 0.9 + i * 0.15, (sv) => [M.steel, 0.9 + sv * 0.1]);
    S.solids.push({ t: 'box', x0: x - 0.8, x1: x + 0.8, y0: -22, y1: -9, d0: 116, d1: 117 });
  }
  rod(gb, [46, -24, 116.5], [46, -12, 116.5], 1.4, () => [M.oak, 0.9]);
  box(gb, 42, 50, -12, -7, 115, 117.5, (side) => [M.elm, 0.9 + (side === 'top' ? 0.1 : 0)]);
  S.solids.push({ t: 'box', x0: 42, x1: 50, y0: -24, y1: -7, d0: 115, d1: 117.5 });
  face(gb, [[56, -22, 116.5], [66, -22, 116.5], [66, -19, 116.5], [59, -19, 116.5], [59, -6, 116.5], [56, -6, 116.5]], () => [M.brass, 0.9]);

  // The bench: a thick top, its legs, a shelf under it; the vise at its
  // end.
  const Bn = BEN.bench;
  box(gb, Bn.x0, Bn.x1, Bn.y, Bn.y + 4, Bn.d0, Bn.d1, (side, P) => {
    if (side === 'top') {
      if (Math.hypot(P[0] - 38, P[2] - 54) < 1.1 || Math.hypot(P[0] - 26, P[2] - 54) < 1.1) return [M.joint, 0.3];
      const b0 = boards(P[0], P[2] * 1.3, s + 30, 6);
      return [M.pine, b0.v * (b0.seam ? 0.85 : 1) * 1.02];
    }
    return [M.pine, boards(P[0], P[1] * 2, s + 31, 2).v * 0.9];
  }, S.solids);
  for (const [x0, d0] of [[Bn.x0 + 4, Bn.d0 + 1], [Bn.x1 - 9, Bn.d0 + 1], [Bn.x0 + 4, Bn.d1 - 6], [Bn.x1 - 9, Bn.d1 - 6]]) {
    box(gb, x0, x0 + 5, Bn.y + 4, BEN.room.fy, d0, d0 + 5, (side, P) => [M.pine, boards(P[1], P[0] * 2 + P[2], s + 32, 3).v * 0.9], S.solids);
  }
  box(gb, Bn.x0 + 4, Bn.x1 - 4, 40, 42.5, Bn.d0 + 2, Bn.d1 - 2, (side, P) => [M.pine, boards(P[0], P[2], s + 33, 5).v * 0.85], S.solids);
  box(gb, -36, -24, 34, 40, Bn.d0 + 3, Bn.d0 + 10, (side) => [M.oakD, side === 'top' ? 0.7 : 0.9], S.solids);
  box(gb, 14, 28, 36, 40, Bn.d0 + 3, Bn.d0 + 8, (side) => [M.elm, side === 'top' ? 1 : 0.85], S.solids);
  box(gb, 19, 23, 33, 36, Bn.d0 + 4, Bn.d0 + 6, () => [M.steel, 0.9]);
  box(gb, Bn.x1 - 2, Bn.x1 + 3, Bn.y - 4, Bn.y + 12, Bn.d0 - 2, Bn.d0 + 8, (side) => [M.elm, side === 'top' ? 1 : 0.85], S.solids);
  rod(gb, [Bn.x1 + 3, Bn.y + 6, Bn.d0 + 3], [Bn.x1 + 8, Bn.y + 6, Bn.d0 + 3], 1.6, (sv) => [M.iron, 0.9 + sv * 0.1]);
  rod(gb, [Bn.x1 + 8, Bn.y + 1, Bn.d0 + 3], [Bn.x1 + 8, Bn.y + 11, Bn.d0 + 3], 1.3, (sv) => [M.oak, 0.9 + sv * 0.1]);
}

function benchLights() {
  return [
    light(BEN.sun[0], BEN.sun[1], BEN.sun[2], 1100, 4.4, '#fff0d0', 0),
    // (The day's light thrown back off the bench and the floor.)
    light(-10, 10, 74, 120, 0.45, '#f0d8a8'),
    light(0, 52, 70, 160, 0.25, '#e8c898'),
    light(-60, -20, 110, 120, 0.35, '#c8d8f0'),
  ];
}
// Motes turning in the shaft of daylight.
export function motes(S, t) {
  const gb = S.gb;
  for (let i = 0; i < 26; i++) {
    const k = (h2(i, 1, 7) + t * 0.015 * (0.5 + h2(i, 2, 7))) % 1;
    const [x, y] = S.p(-60 + k * 70 + Math.sin(t * 0.6 + i) * 3, -6 + h2(i, 3, 7) * 22 + k * 10, 84 + h2(i, 4, 7) * 26);
    const xi = Math.round(x);
    const yi = Math.round(y);
    if (xi < 0 || yi < 0 || xi >= W || yi >= H || gb.sh[(yi * W + xi) * 4] > 128) continue;
    if (Math.floor(t * 2 + i) % 7) emit(gb, xi, yi, [255, 240, 200], 0.4);
  }
}
// The blank on the bench: its chalk marks still to cut, its notches cut,
// gouges where the chisel slipped (each 0..1 along it).
export function blank(S, marks, cuts, gouges) {
  const gb = S.gb;
  const Bk = BEN.blank;
  const L = Bk.x1 - Bk.x0;
  const near = (list, x, w) => list.some((c) => Math.abs(Bk.x0 + c * L - x) < w);
  box(gb, Bk.x0, Bk.x1, Bk.y0, BEN.bench.y, Bk.d0, Bk.d1, (side, P, u, v) => {
    const cut = near(cuts, P[0], 1.6);
    if (side === 'top') {
      if (cut) return [M.endgrain, 1.2, [0, -1, -0.6]];
      if (near(gouges, P[0], 0.9)) return [M.joint, 0.5];
      if (near(marks, P[0], 0.35)) return [M.chalk, 1];
      return [M.pine, boards(P[0], P[2] * 2, 71, 3).v * 1.05];
    }
    if (side === 'front' && cut && v < 0.4) return [M.endgrain, 1.1];
    if (side === 'front' && near(marks, P[0], 0.35)) return [M.chalk, 0.95];
    return [M.pine, boards(P[0], P[1] * 3, 72, 3).v * 0.92];
  });
  return Bk;
}
// The chisel over the blank at room `x`, the mallet over it (`s`: 0
// raised, 1 struck).
export function chisel(S, x, s) {
  const gb = S.gb;
  const Bk = BEN.blank;
  const e = s * s * (3 - 2 * s);
  const y = Bk.y0 - 0.3 - (1 - e) * 1.5;
  const d = Bk.d0 + 1;
  rod(gb, [x, y, d], [x + 1, y - 6, d - 1], 1.1, (sv, a) => [M.steel, a < 0.15 ? 1.3 : 0.95 + sv * 0.1]);
  rod(gb, [x + 1, y - 6, d - 1], [x + 1.8, y - 12, d - 2], 1.8, (sv) => [M.oak, 0.95 + sv * 0.1]);
  const my = y - 13 - (1 - e) * 8;
  const mx = x + 2 + (1 - e) * 5;
  rod(gb, [mx - 3.5, my, d - 2], [mx + 3.5, my, d - 2], 3.6, (sv, a) => [M.elm, a < 0.08 || a > 0.92 ? 1.1 : 0.9]);
  rod(gb, [mx, my, d - 2], [mx + 8, my - 7, d - 5], 1.4, (sv) => [M.oak, 0.95 + sv * 0.1]);
}
// The haft laid on the bench and its binding wound on a turn at a time
// (`turns`: how tight each was), the strap's loose end, the piece's head
// at the haft's end.
export function binding(S, key, turns, n, t) {
  const gb = S.gb;
  const y = BEN.bench.y - 1.2;
  const d = 55;
  rod(gb, [-34, y, d], [22, y, d], 2.4, (sv, a) => [M.pine, 0.9 + sv * 0.1 + (Math.floor(a * 40) % 7 === 0 ? -0.08 : 0)]);
  const x0 = -16;
  const step = 2.6;
  turns.forEach((q, i) => {
    const x = x0 + i * step;
    const off = q >= 0.7 ? 0 : 0.7;
    rod(gb, [x + off, y - 1.4, d - 1], [x + 1.6 + off, y + 1.4, d - 1], 1.1, (sv) => [M.leather, (q >= 0.7 ? 0.95 : 0.75) + sv * 0.1]);
  });
  if (turns.length < n) {
    const ex = x0 + turns.length * step;
    const sw = Math.sin(t * 3) * 1.5;
    rod(gb, [ex, y + 1, d - 1], [ex + 6 + sw, BEN.bench.y - 0.2, d - 3], 1, () => [M.leather, 0.85]);
    cyl(gb, ex + 8 + sw, d - 3, 2.2, BEN.bench.y - 2, BEN.bench.y, (part) => [M.leather, part === 'top' ? 1 : 0.8]);
  }
  const D = iconData(key);
  if (D) {
    face(gb, [[18, y - 0.6, 51], [40, y - 0.6, 51], [40, y - 0.6, 61], [18, y - 0.6, 61]], (P) => {
      const c = D.px(Math.floor(((P[0] - 18) / 22) * 16), Math.floor(((P[2] - 51) / 10) * 16));
      return c ? [c.m, 0.6 + c.l * 0.8, [0, -1, -0.25]] : null;
    });
  }
  return { x0, step, y, d };
}

// ------------------------------------------------------------ the bowyer
const BOW = {
  cam: new Cam(128, 40, 120),
  room: { fy: 50, cy: -60, lx: -100, rx: 100 },
  lamp: [-34, -10, 98],
  post: { x: 0, d: 96 },
  grip: [0, -18, 94],
  window: { x0: 52, x1: 70, y0: -20, y1: -4 },
};
export const BOWYER = BOW;

function buildBowyer(S) {
  const gb = S.base;
  const s = S.seed + 200;
  const Wn = BOW.window;
  // Timber framing: posts, a rail, braces; wattle and daub between,
  // limewashed.
  const frame = (a, wy) => {
    for (const p of [-80, -40, 0, 40, 80]) if (Math.abs(a - p) < 3) return 'post';
    if (Math.abs(wy + 8) < 2.5) return 'rail';
    if (Math.abs(wy - 46) < 3.5) return 'sill';
    const cell = Math.floor((a + 80) / 40);
    const lx = a - (-80 + cell * 40);
    if (wy > -8 && ((cell % 2 === 0 && Math.abs(lx - (wy + 8) * 0.7) < 2) || (cell % 2 === 1 && Math.abs(40 - lx - (wy + 8) * 0.7) < 2))) return 'brace';
    return null;
  };
  room(gb, BOW.room, (pl, wx, wy, d) => {
    if (pl === 'floor') {
      const b0 = boards(d * 1.2, wx, s, 8);
      if (b0.seam) return [M.joint, 0.7];
      // (Rushes strewn.)
      if (h2(Math.floor(wx * 0.6), Math.floor(d * 1.4), s + 4) < 0.012) return [M.feather, 0.5];
      return [M.board, b0.v * 0.85];
    }
    if (pl === 'ceil') return [M.timber, 0.6];
    if (pl === 'back' && wx >= Wn.x0 && wx <= Wn.x1 && wy >= Wn.y0 && wy <= Wn.y1) return null;
    const a = pl === 'back' ? wx : d * 1.4;
    const f = frame(a, wy);
    if (f) return [M.timber, boards(wy, a, s + 3, 5).v * 0.95, f === 'rail' || f === 'sill' ? [0, -0.5, -1] : null];
    // Limewash over the daub: broad soft patches, worn through here and
    // there to the wattle.
    if (vnoise(a / 3, wy / 3, s + 2) > 0.86 && vnoise(a / 11, wy / 11, s + 5) > 0.55) return [M.earth, 0.8 + (Math.floor(a + wy) % 3 === 0 ? 0.15 : 0)];
    return [M.lime, 0.9 + (vnoise(a / 14, wy / 10, s) - 0.5) * 0.16 + (vnoise(a / 4, wy / 4, s + 1) - 0.5) * 0.06];
  });
  sky(gb, M.dusk, (x, y) => 0.15 + (y - 18) / 22);
  rod(gb, [(Wn.x0 + Wn.x1) / 2, Wn.y0, 121], [(Wn.x0 + Wn.x1) / 2, Wn.y1, 121], 1.4, () => [M.timber, 0.9]);
  windowWall(S, Wn, 120, 124);

  // The tillering post: a stout upright on a foot, notched down its face.
  const P = BOW.post;
  box(gb, P.x - 3, P.x + 3, -14, 50, P.d, P.d + 6, (side, Pp) => [M.oak, boards(Pp[1], side === 'front' ? Pp[0] * 3 : Pp[2] * 3, s + 10, 4).v], S.solids);
  box(gb, P.x - 14, P.x + 14, 46, 50, P.d - 6, P.d + 12, (side, Pp) => [M.oakD, boards(Pp[0], Pp[2], s + 11, 5).v], S.solids);
  for (let k = 0; k < 9; k++) {
    const y = 2 + k * 4.6;
    box(gb, P.x - 3.2, P.x - 0.5, y, y + 1, P.d - 0.6, P.d, () => [M.joint, 0.4]);
  }
  // Staves leaning in the corner, a barrel of arrows, feathers in a pot.
  for (let i = 0; i < 6; i++) {
    const x = 66 + i * 4;
    rod(gb, [x + 6, -30 + (i % 2) * 4, 110 - i], [x, 50, 100 - i], 2.2, (sv) => [M.elm, 0.85 + sv * 0.15 + (i % 2 ? 0.08 : 0)]);
    S.solids.push({ t: 'box', x0: x - 1, x1: x + 7, y0: -30, y1: 50, d0: 98 - i, d1: 111 - i });
  }
  cyl(gb, 54, 76, 9, 30, 50, (part, Pp, a, f) => {
    if (part === 'top') return [M.joint, 0.4];
    if ((f > 0.15 && f < 0.24) || (f > 0.76 && f < 0.85)) return [M.iron, 0.9];
    const st = Math.floor((a + 1) * 6.5);
    return [M.oak, Math.abs((a + 1) * 6.5 - st - 0.5) > 0.42 ? 0.55 : 0.85 + (h2(st, 2, s) - 0.5) * 0.2];
  }, S.solids);
  for (let i = 0; i < 14; i++) {
    const ax = 49 + h2(i, 1, s) * 10;
    const az = 72 + h2(i, 2, s) * 8;
    const top = 16 + h2(i, 3, s) * 5;
    const lean = (h2(i, 4, s) - 0.5) * 3;
    rod(gb, [ax, 31, az], [ax + lean, top, az], 0.7, () => [M.pine, 1]);
    rod(gb, [ax + lean, top + 3.5, az], [ax + lean, top, az], 1.6, () => [[M.feather, M.red, M.blue][i % 3], 1]);
  }
  // A low bench by the wall, a pot of feathers and a coil of string on it.
  box(gb, -92, -50, 34, 37, 86, 100, (side, Pp) => [M.oak, boards(Pp[0], Pp[2], s + 20, 5).v], S.solids);
  for (const [lx0, ld] of [[-90, 87], [-56, 87], [-90, 96], [-56, 96]]) box(gb, lx0, lx0 + 3, 37, 50, ld, ld + 3, () => [M.oakD, 0.8], S.solids);
  cyl(gb, -80, 92, 4, 26, 34, (part) => [M.clay, part === 'top' ? 0.5 : 0.9], S.solids);
  for (let i = 0; i < 7; i++) {
    const fx = -82 + i * 0.8;
    rod(gb, [fx, 26, 92], [fx - 3 + i, 14 + (i % 3) * 2, 91], 1.5, () => [[M.feather, M.red, M.feather, M.blue][i % 4], 1]);
  }
  cyl(gb, -62, 92, 3.5, 32, 34, (part, Pp, a) => [M.string, 0.9 + (Math.floor((a + 1) * 10) % 2 ? 0.1 : -0.1)], S.solids);
}

function bowyerLights(S, t) {
  const fl = 0.93 + Math.sin(t * 9) * 0.04 + Math.sin(t * 3.7) * 0.03;
  const L = BOW.lamp;
  return [
    light(L[0] + Math.sin(t * 0.8) * 0.8, L[1] + 2, L[2], 220, 1.6 * fl, '#ffb060', 0),
    light(61, -12, 135, 260, 0.9, '#8090d0', 1),
    light(0, 50, 80, 120, 0.16, '#e0a060'),
    light(24, -34, 30, 200, 0.5, '#ffd0a0'),
  ];
}
// The hanging lamp: its chain, its horn panes lit, its flame.
export function lamp(S, t) {
  const gb = S.gb;
  const L = BOW.lamp;
  const x0 = L[0] + Math.sin(t * 0.8) * 0.8;
  rod(gb, [L[0], -60, L[2]], [x0, L[1] - 3, L[2]], 0.5, () => [M.iron, 0.8]);
  box(gb, x0 - 2.5, x0 + 2.5, L[1] - 3, L[1] - 2, L[2] - 2.5, L[2] + 2.5, () => [M.iron, 0.9]);
  box(gb, x0 - 2.5, x0 + 2.5, L[1] + 4, L[1] + 5, L[2] - 2.5, L[2] + 2.5, () => [M.iron, 0.9]);
  box(gb, x0 - 2, x0 + 2, L[1] - 2, L[1] + 4, L[2] - 2, L[2] + 2, (side, P, u) => [M.glass, 0.55 + (1 - Math.abs(u - 0.5) * 2) * 0.35]);
  const [x, y] = S.p(x0, L[1] + 1, L[2] - 2.1);
  put(gb, Math.round(x), Math.round(y), M.flame, 1, 0, 0, -1, 1, true);
  put(gb, Math.round(x), Math.round(y) - 1, M.flame, 0.6 + (Math.floor(t * 9) % 2) * 0.3, 0, 0, -1, 1, true);
  halo(gb, x, y, 16, '#ffb060', 0.8);
}
// A bow (or its stave) on the tillering post: bent `b` (0..1), cracked
// where `cracks` say, strung or not, its string trembling `vib`; the notch
// it's to come down to lit (`notch` 0..1, or -1).
export function bowOnPost(S, b, cracks = [], strung = false, vib = 0, t = 0, notch = -1) {
  const gb = S.gb;
  const G = BOW.grip;
  const half = 50;
  const seg = 16;
  const tip = 5 + b * 26;
  const at = (k) => [G[0] + k * half, G[1] + tip * k * k, G[2] - 1 - Math.abs(k) * 2];
  for (let i = -seg; i < seg; i++) {
    const k0 = i / seg;
    const k1 = (i + 1) / seg;
    const w = 3.4 - Math.abs(k0 + k1) * 1.1;
    const cracked = cracks.some((c) => Math.sign(c) === Math.sign(k0 + k1) && Math.abs(Math.abs(k0 + k1) / 2 - 0.45) < 0.05);
    rod(gb, at(k0), at(k1), w, (sv) => [cracked ? M.joint : M.yew, cracked ? 0.6 : 0.95 + sv * 0.12 - (sv > 0.5 ? 0.12 : 0)]);
  }
  rod(gb, [G[0] - 3, G[1], G[2] - 1.5], [G[0] + 3, G[1], G[2] - 1.5], 3.4, (sv, a) => [M.leather, 0.9 + (Math.floor(a * 6) % 2 ? 0.08 : -0.04)]);
  const L = at(-1);
  const R = at(1);
  if (strung) {
    const n = 24;
    const off = (a) => Math.sin(a * Math.PI) * Math.sin(t * 70) * vib * 2.4;
    for (let i = 0; i < n; i++) {
      const a0 = i / n;
      const a1 = (i + 1) / n;
      rod(gb, [L[0] + (R[0] - L[0]) * a0, L[1] + (R[1] - L[1]) * a0 + off(a0), L[2] - 0.5], [L[0] + (R[0] - L[0]) * a1, L[1] + (R[1] - L[1]) * a1 + off(a1), L[2] - 0.5], 0.35, () => [M.string, 1.1]);
    }
  } else if (b > 0.02) {
    const py = G[1] + 6 + b * 52;
    const Pp = [G[0], py, G[2] - 1.5];
    rod(gb, L, Pp, 0.35, () => [M.string, 1.1]);
    rod(gb, R, Pp, 0.35, () => [M.string, 1.1]);
    box(gb, -1.5, 1.5, py - 1, py + 1, G[2] - 2.5, G[2] - 0.5, () => [M.oak, 0.9]);
  }
  if (notch >= 0) {
    const y = G[1] + 6 + notch * 52;
    box(gb, -3.4, -0.4, y - 0.5, y + 0.6, BOW.post.d - 1, BOW.post.d - 0.4, () => [M.chalk, 1.1]);
  }
}
// Where on the scene the bow's grip is (for words over it).
export function bowGrip(S) {
  return S.p(...BOW.grip);
}

// ------------------------------------------------------------ the table
const TAB = {
  cam: new Cam(128, 22, 120),
  room: { fy: 72, cy: -60, lx: -100, rx: 100 },
  top: { x0: -96, x1: 96, y: 36, d0: 40, d1: 112 },
  lantern: [62, 28, 104],
};
export const TABLE = TAB;

function buildTable(S) {
  const gb = S.base;
  const s = S.seed + 300;
  room(gb, TAB.room, (pl, wx, wy, d) => {
    if (pl === 'floor') return [M.board, boards(d, wx, s, 8).v * 0.8];
    if (pl === 'ceil') return [M.panel, 0.5];
    // Panelling: raised fields in their frames.
    const a = pl === 'back' ? wx : d * 1.2;
    const fx = ((a + 200) % 24) / 24;
    const fyy = ((wy + 200) % 20) / 20;
    const inField = fx > 0.18 && fx < 0.82 && fyy > 0.2 && fyy < 0.8;
    const N0 = pl === 'back' ? [0, 0, -1] : pl === 'left' ? [1, 0, 0] : [-1, 0, 0];
    let n = null;
    if (inField && fyy < 0.28) n = [N0[0], N0[1] - 0.7, N0[2]];
    else if (inField && fyy > 0.72) n = [N0[0], N0[1] + 0.7, N0[2]];
    return [M.panel, (0.92 + (boards(wy * 0.5, a, s + 1, 5).v - 0.84) * 0.4) * (inField ? 1 : 0.82), n];
  });
  // Shelves on the back wall: hides rolled, spools of thread.
  for (const sy of [-28, -8]) {
    box(gb, -60, 60, sy, sy + 2, 112, 120, (side, P) => [M.oakD, boards(P[0], P[2], s + 5, 4).v * (side === 'top' ? 1.05 : 0.9)], S.solids);
    for (let i = 0; i < 8; i++) {
      const cx = -54 + i * 15;
      if ((i + (sy > -20 ? 1 : 0)) % 3 === 0) {
        cyl(gb, cx, 116, 3, sy - 7, sy, (part, P, a, f) => {
          if (part === 'top' || f < 0.12 || f > 0.88) return [M.oakD, 0.85];
          return [[M.red, M.blue, M.cloth, M.string][i % 4], 0.85 + (Math.floor(f * 12) % 2 ? 0.08 : -0.04)];
        }, S.solids);
      } else {
        lump(gb, [cx, sy - 4, 116], [6.5, 4, 3.5], (P, n) => [i % 2 ? M.hide : M.hideD, 0.85 + (Math.sin(Math.atan2(n[1], n[0] + 0.001) * 3 + (P[0] - cx) * 0.4) > 0.7 ? -0.2 : 0)], S.solids);
      }
    }
  }
  // Hides hung to dry on the left wall.
  for (const [hz, c] of [[96, M.hide], [82, M.hideD]]) {
    face(gb, [[-99.5, -40, hz - 8], [-99.5, -40, hz + 8], [-99.5, 0, hz + 9], [-99.5, 4, hz], [-99.5, 0, hz - 9]], (P) => [c, 0.85 + (vnoise(P[2] * 0.4, P[1] * 0.3, 3) - 0.5) * 0.3, [1, 0, (vnoise(P[2] * 0.2, P[1] * 0.2, 5) - 0.5) * 0.8]]);
  }
  // The long table, its top worn smooth, scored by knives.
  const T = TAB.top;
  box(gb, T.x0, T.x1, T.y, T.y + 4, T.d0, T.d1, (side, P) => {
    if (side === 'top') {
      const b0 = boards(P[2] * 2.2, P[0], s + 7, 12);
      let v = b0.v * (b0.seam ? 0.75 : 1);
      if (h2(Math.floor(P[0] * 1.5), Math.floor(P[2] * 3), s + 8) < 0.02) v *= 0.75;
      return [M.table, v];
    }
    return [M.table, boards(P[0], P[1] * 2, s + 9, 2).v * 0.85];
  }, S.solids);
  // An awl, a spool by the work.
  rod(gb, [72, T.y - 0.7, 64], [82, T.y - 0.7, 60], 0.7, (sv) => [M.steel, 0.95 + sv * 0.1]);
  rod(gb, [82, T.y - 1, 60], [88, T.y - 1.2, 58], 1.8, (sv) => [M.oak, 0.95 + sv * 0.1]);
  cyl(gb, -80, 66, 3.4, T.y - 5, T.y, (part, P, a, f) => (part === 'top' || f < 0.15 || f > 0.85 ? [M.oakD, 0.88] : [M.string, 0.95 + (Math.floor(f * 10) % 2 ? 0.06 : -0.04)]), S.solids);
  // The lantern stood on the table.
  const L = TAB.lantern;
  box(gb, L[0] - 3, L[0] + 3, L[1] - 1, L[1] + 8, L[2] - 3, L[2] + 3, () => [M.iron, 0.8]);
  rod(gb, [L[0] - 2, L[1] - 1, L[2]], [L[0], L[1] - 5, L[2]], 0.5, () => [M.iron, 0.8]);
  rod(gb, [L[0], L[1] - 5, L[2]], [L[0] + 2, L[1] - 1, L[2]], 0.5, () => [M.iron, 0.8]);
}

function tableLights(S, t) {
  const fl = 0.93 + Math.sin(t * 8.3) * 0.04 + Math.sin(t * 3.1) * 0.03;
  const L = TAB.lantern;
  return [
    light(L[0], L[1] + 3, L[2] - 4, 240, 2.1 * fl, '#ffb468', 0),
    light(-40, -40, 60, 260, 0.55, '#7488c0'),
  ];
}
// The lantern's panes lit, its flame.
export function lantern(S, t) {
  const gb = S.gb;
  const L = TAB.lantern;
  box(gb, L[0] - 2.4, L[0] + 2.4, L[1], L[1] + 7, L[2] - 3.05, L[2] + 2.4, (side, P, u) => [M.glass, 0.5 + (1 - Math.abs(u - 0.5) * 2) * 0.4]);
  const [x, y] = S.p(L[0], L[1] + 3.5, L[2] - 3.1);
  put(gb, Math.round(x), Math.round(y), M.flame, 1, 0, 0, -1, 1, true);
  put(gb, Math.round(x), Math.round(y) - 1, M.flame, 0.6 + (Math.floor(t * 9) % 2) * 0.3, 0, 0, -1, 1, true);
  halo(gb, x, y, 18, '#ffb060', 0.8);
}
// The hide laid on the table and drawn along under the knife (`scroll`,
// room units), the chalk line (`chalk(w)`: its depth on the table at `w`
// along the hide), the cut already made (`slit`: [w, depth, how true]), the
// knife at (kx, kd).
export function hide(S, scroll, chalk, slit, kx, kd) {
  const gb = S.gb;
  const y = TAB.top.y - 0.3;
  face(gb, [[-80, y, 46], [80, y, 46], [80, y, 100], [-80, y, 100]], (P) => {
    const w = P[0] + scroll;
    const edge = 98 - Math.abs(Math.sin(w * 0.07) * 3 + vnoise(w * 0.2, 1, 3) * 3);
    if (P[2] > edge) return null;
    let v = 0.9 + (vnoise(w * 0.25, P[2] * 0.3, 5) - 0.5) * 0.28;
    if (h2(Math.floor(w * 0.7), Math.floor(P[2] * 0.7), 9) < 0.05) v *= 0.82;
    if (P[0] > kx && Math.abs(P[2] - chalk(w)) < 0.45 && Math.floor(w / 2.2) % 2 === 0) return [M.chalk, 1.05];
    return [M.pale, v, [0, -1, (vnoise(w * 0.1, P[2] * 0.1, 8) - 0.5) * 0.5]];
  });
  for (const [w, d, q] of slit) {
    const x = w - scroll;
    if (x > kx || x < -80) continue;
    const [sx, sy] = S.p(x, y - 0.1, d);
    put(gb, Math.round(sx), Math.round(sy), q > 0.5 ? M.joint : M.red, 0.35, 0, -1, 0, d - 0.5, true);
  }
  rod(gb, [kx, y - 0.2, kd], [kx + 3, y - 6, kd - 4], 1.4, (sv, a) => [M.steel, a < 0.2 ? 1.25 : 0.95 + sv * 0.1]);
  rod(gb, [kx + 3, y - 6, kd - 4], [kx + 7, y - 13, kd - 9], 2.2, (sv) => [M.oakD, 0.95 + sv * 0.1]);
}
// Two pieces laid over each other, the seam's holes along them (`n` + 1),
// the stitches made (`st`: how true each), the needle at hole `i`, lifted
// `bob` (0..1).
export function seam(S, n, st, i, bob) {
  const gb = S.gb;
  const y = TAB.top.y - 0.3;
  const x0 = -60;
  const step = 120 / n;
  const d = 62;
  face(gb, [[-70, y, 50], [70, y, 50], [70, y, 63.5], [-70, y, 63.5]], (P) => [M.pale, 0.9 + (vnoise(P[0] * 0.2, P[2] * 0.3, 2) - 0.5) * 0.2]);
  face(gb, [[-70, y - 0.5, 60.5], [70, y - 0.5, 60.5], [70, y - 0.5, 74], [-70, y - 0.5, 74]], (P) => [M.hideD, 0.95 + (vnoise(P[0] * 0.2, P[2] * 0.3, 4) - 0.5) * 0.2]);
  for (let k = 0; k <= n; k++) {
    for (const dd of [d - 2.5, d + 2.5]) {
      const [hx, hy] = S.p(x0 + k * step, y - 0.6, dd);
      put(gb, Math.round(hx), Math.round(hy), M.joint, 0.25, 0, -1, 0, dd - 1, true);
    }
  }
  st.forEach((q, k) => {
    if (q <= 0) return;
    const up = k % 2 === 0;
    rod(gb, [x0 + k * step, y - 0.8, up ? d - 2.5 : d + 2.5], [x0 + (k + 1) * step, y - 0.8, (up ? d + 2.5 : d - 2.5) + (q >= 0.7 ? 0 : 1.2)], 0.5, () => [M.string, q >= 0.7 ? 1.1 : 0.8]);
  });
  if (i < n) {
    const hx = x0 + i * step;
    const lift = bob * 6;
    rod(gb, [hx, y - 1 - lift, d - 2.5], [hx + 2, y - 8 - lift, d - 5], 0.7, (sv, a) => [M.steel, a < 0.2 ? 1.3 : 1]);
    rod(gb, [hx + 2, y - 8 - lift, d - 5], [hx + 14, y - 18, d - 16], 0.4, () => [M.string, 1.05]);
  }
  return { x0, step, d, y };
}

// ------------------------------------------------------------ the shops
const SHOPS = {
  forge: {
    cam: SMI.cam, build: buildSmithy, lights: smithyLights, amb: { k: 0.075, c: [70, 86, 140] },
    air: (S) => {
      const Wn = SMI.window;
      shafts(S.base, { ...Wn, d: 120 }, SMI.moon, '#6a88d8', 0.9, [{ x: (Wn.x0 + Wn.x1) / 2, w: 0.9 }, { y: (Wn.y0 + Wn.y1) / 2, w: 0.9 }]);
    },
    shadowLights: [{ ...light(SMI.fire[0], SMI.fire[1], SMI.fire[2], 1, 1, '#fff', 0), soft: 4 }, { ...light(SMI.moon[0], SMI.moon[1], SMI.moon[2], 1, 1, '#fff', 1), soft: 10 }],
  },
  carve: {
    cam: BEN.cam, build: buildBench, lights: benchLights, amb: { k: 0.11, c: [140, 160, 210] },
    air: (S) => {
      const Wn = BEN.window;
      shafts(S.base, { ...Wn, d: 120 }, BEN.sun, '#fff0c8', 1.25, [{ x: (Wn.x0 + Wn.x1) / 2, w: 1 }, { y: (Wn.y0 + Wn.y1) / 2, w: 1 }]);
    },
    shadowLights: [{ ...light(BEN.sun[0], BEN.sun[1], BEN.sun[2], 1, 1, '#fff', 0), soft: 9 }],
  },
  bow: {
    cam: BOW.cam, build: buildBowyer, lights: bowyerLights, amb: { k: 0.1, c: [90, 100, 150] },
    shadowLights: [{ ...light(BOW.lamp[0], BOW.lamp[1] + 2, BOW.lamp[2], 1, 1, '#fff', 0), soft: 2 }, { ...light(61, -12, 135, 1, 1, '#fff', 1), soft: 6 }],
  },
  stitch: {
    cam: TAB.cam, build: buildTable, lights: tableLights, amb: { k: 0.1, c: [90, 100, 150] },
    shadowLights: [{ ...light(TAB.lantern[0], TAB.lantern[1] + 3, TAB.lantern[2] - 4, 1, 1, '#fff', 0), soft: 2 }],
  },
};
// Which shop each work's done in.
export function shopOf(kind) {
  return kind === 'carve' ? 'carve' : kind === 'bow' ? 'bow' : kind === 'stitch' ? 'stitch' : 'forge';
}

// ------------------------------------------------------------ an icon's pixels
// A piece's picture as pixels, each given a material by its colour (iron
// grey, wood brown, leather red...) and its lightness.
const ICONS = new Map();
export function iconData(key) {
  if (ICONS.has(key)) return ICONS.get(key);
  let out = null;
  try {
    const c = itemIcon(key);
    const d = c.getContext('2d').getImageData(0, 0, 16, 16).data;
    const px = [];
    for (let i = 0; i < 256; i++) {
      if (d[i * 4 + 3] < 100) {
        px.push(null);
        continue;
      }
      const r = d[i * 4] / 255;
      const g = d[i * 4 + 1] / 255;
      const b = d[i * 4 + 2] / 255;
      const mx = Math.max(r, g, b);
      const mn = Math.min(r, g, b);
      let m = M.steel;
      if (mx - mn > 0.12) {
        if (r > g && g > b && r - b > 0.15) m = r > 0.7 && g > 0.55 ? M.brass : M.oak;
        else if (r > g && r > b) m = M.leather;
        else if (b > r) m = M.blue;
        else m = M.cloth;
      }
      px.push({ m, l: (mx + mn) / 2 });
    }
    out = { px: (x, y) => (x < 0 || y < 0 || x > 15 || y > 15 ? null : px[y * 16 + x]) };
  } catch {
    out = null;
  }
  ICONS.set(key, out);
  return out;
}
