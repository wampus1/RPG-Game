// The icons, made the way the masters of the old places are (see
// sculpt.js): each piece built up out of rounded masses (a blade a ridged
// slab, a grip a wrapped rod, a pommel a ball), each surfaced as what it's
// made of (steel and iron and gold with their shine, wood with its grain,
// leather, cloth, stone, bone, black glass, the Kavorent's glowing seams),
// lit from the upper left onto a ramp of its own colour (shadows going
// violet, lights going gold), a cool rim of light from behind on the far
// edge, and an outline round it darker than whatever it borders.
//   Weapons and tools lie corner to corner, grip at the lower left, as
// they always have; armour's seen from the front, filling the square.
//   Anything not drawn here (food, stuff, oddments) keeps its own picture,
// relit the same way: given a body (its middle stands out toward you, its
// edges fall away), shaded from the upper left onto hue-shifted ramps, with
// a glint where something shiny catches the light, and the same outline.
import { Px, hex, mix, shade } from './pixel.js';
import { ramp, hash2 } from './paint.js';
import { outlineSel } from './people.js';

const N = 16;
const norm = (x, y, z) => {
  const n = Math.hypot(x, y, z) || 1;
  return [x / n, y / n, z / n];
};
const LIGHT = norm(-0.6, -0.7, 0.62);
const HALF = norm(LIGHT[0], LIGHT[1], LIGHT[2] + 1);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const BAYER = [0, 0.5, 0.75, 0.25];

// How each stuff takes the light: contrast, shine (how sharp and how
// bright), a texture, a rim of back light.
const MATS = {
  steel: { con: 1.35, spec: 0.75, sharp: 14, rim: 0.4 },
  iron: { con: 1.25, spec: 0.55, sharp: 10, rim: 0.32 },
  gold: { con: 1.25, spec: 0.8, sharp: 12, rim: 0.2, warm: true },
  stone: { con: 1, spec: 0.1, sharp: 4, rim: 0.12, speck: 0.14 },
  wood: { con: 0.95, spec: 0.08, sharp: 4, rim: 0.12, grain: 0.13 },
  leather: { con: 0.9, spec: 0.16, sharp: 6, rim: 0.15, speck: 0.05 },
  cloth: { con: 0.75, spec: 0.02, sharp: 3, rim: 0.22, weave: 0.05 },
  bone: { con: 0.9, spec: 0.22, sharp: 6, rim: 0.15 },
  glass: { con: 1.4, spec: 0.95, sharp: 18, rim: 0.4 },
  string: { con: 0.6, spec: 0, sharp: 2, rim: 0 },
  glow: { glow: true },
};
const RIM = [170, 205, 255];

// ------------------------------------------------------------ the sculpt
class Sculpt {
  constructor() {
    this.h = new Float32Array(N * N).fill(-1);
    this.part = new Int16Array(N * N).fill(-1);
    this.parts = [];
  }
  // A part: what it's made of, its colour, how high it stands.
  add(mat, col, z = 0, extra = {}) {
    this.parts.push({ mat, col: hex(col), z, ...extra });
    return this.parts.length - 1;
  }
  // Put down a shape: `inside(x, y)` gives how far in from its edge a
  // point is (<0 outside), and `prof` how that becomes height.
  shape(id, inside, rad = 1.5, prof = 'round') {
    const P = this.parts[id];
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const d = inside(x + 0.5, y + 0.5);
        if (d < 0) continue;
        const k = clamp(d / rad, 0, 1);
        const hh = prof === 'ridge' ? k : prof === 'flat' ? Math.min(1, k * 2.2) : Math.sqrt(1 - (1 - k) * (1 - k));
        const H = P.z + hh * (P.amp ?? 1);
        const i = y * N + x;
        if (this.part[i] < 0 || this.parts[this.part[i]].z <= P.z || this.part[i] === id) {
          if (this.part[i] === id && this.h[i] >= H) continue;
          this.h[i] = H;
          this.part[i] = id;
        }
      }
    }
    return this;
  }
  capsule(id, x0, y0, x1, y1, r, prof = 'round') {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const L = dx * dx + dy * dy || 1;
    return this.shape(id, (x, y) => {
      const t = clamp(((x - x0) * dx + (y - y0) * dy) / L, 0, 1);
      return r - Math.hypot(x - (x0 + dx * t), y - (y0 + dy * t));
    }, r, prof);
  }
  ellipse(id, cx, cy, rx, ry, prof = 'round') {
    return this.shape(id, (x, y) => (1 - Math.hypot((x - cx) / rx, (y - cy) / ry)) * Math.min(rx, ry), Math.min(rx, ry), prof);
  }
  poly(id, pts, rad = 1.5, prof = 'round') {
    return this.shape(id, (x, y) => {
      let inside = false;
      let best = 1e9;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const [xi, yi] = pts[i];
        const [xj, yj] = pts[j];
        if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
        const ex = xi - xj;
        const ey = yi - yj;
        const t = clamp(((x - xj) * ex + (y - yj) * ey) / (ex * ex + ey * ey || 1), 0, 1);
        best = Math.min(best, Math.hypot(x - (xj + ex * t), y - (yj + ey * t)));
      }
      return inside ? best : -best;
    }, rad, prof);
  }
  // A single pixel of something (a rivet, a stitch, a jewel).
  dot(id, x, y, hgt = 1) {
    const i = (y | 0) * N + (x | 0);
    if (x < 0 || y < 0 || x >= N || y >= N) return this;
    this.part[i] = id;
    this.h[i] = this.parts[id].z + hgt;
    return this;
  }
  // Lit and coloured, outlined.
  render() {
    const p = new Px(N, N);
    const at = (x, y) => (x < 0 || y < 0 || x >= N || y >= N ? -1 : this.part[y * N + x]);
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const i = y * N + x;
        const id = this.part[i];
        if (id < 0) continue;
        const P = this.parts[id];
        const M = MATS[P.mat] || MATS.iron;
        if (M.glow) {
          p.set(x, y, P.col);
          continue;
        }
        const hh = this.h[i];
        // (Across a seam into another part, or off the edge: it falls away.)
        const hn = (u, v) => (at(u, v) === id ? this.h[v * N + u] : at(u, v) >= 0 && this.parts[at(u, v)].z > P.z ? hh : hh - 0.9);
        const nx = (hn(x - 1, y) - hn(x + 1, y)) * 0.9;
        const ny = (hn(x, y - 1) - hn(x, y + 1)) * 0.9;
        const n = norm(nx, ny, 1);
        let l = n[0] * LIGHT[0] + n[1] * LIGHT[1] + n[2] * LIGHT[2];
        l = clamp(0.5 + (l - 0.62) * 1.6 * M.con, 0, 1);
        // Its stuff.
        if (M.grain) {
          const ax = P.axis || [1, -1];
          const along = (x * ax[0] + y * ax[1]) * 0.5;
          const across = x * ax[1] - y * ax[0];
          l += Math.sin(across * 1.7 + hash2(Math.round(along), Math.round(across), 7) * 2.4) * M.grain;
        }
        if (M.speck) l += (hash2(x, y, P.col[0]) - 0.5) * 2 * M.speck;
        if (M.weave) l += ((x + y) % 2 ? 1 : -1) * M.weave;
        if (P.rings && (x + y * 2) % 3 === 0) l -= 0.22;
        if (P.bands) {
          const ax = P.axis || [1, -1];
          if (Math.round(x * ax[0] + y * ax[1]) % 3 === 0) l -= 0.2;
        }
        // Ramp it (dithered only right on the seam between two steps).
        const R = P.ramp || ramp(P.col, 7);
        const f = clamp(l, 0, 0.999) * (R.length - 1);
        let k = Math.floor(f);
        if (f - k > 0.5 + (BAYER[(x & 1) + 2 * (y & 1)] - 0.375) * 0.5) k++;
        let c = R[clamp(k, 0, R.length - 1)];
        // A glint.
        const s = Math.pow(Math.max(0, n[0] * HALF[0] + n[1] * HALF[1] + n[2] * HALF[2]), M.sharp);
        if (s * M.spec > 0.42) c = mix(c, M.warm ? [255, 248, 210] : [250, 252, 255], Math.min(1, (s * M.spec - 0.42) * 2.4));
        // A cool rim on the far edge.
        if (M.rim && (at(x + 1, y) !== id || at(x, y + 1) !== id) && at(x + 1, y) < 0 && l < 0.7) c = mix(c, RIM, M.rim);
        p.set(x, y, c);
      }
    }
    // A dark line where one part passes in front of another.
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const id = at(x, y);
        if (id < 0) continue;
        const z = this.parts[id].z;
        for (const [u, v] of [[x - 1, y], [x, y - 1]]) {
          const o = at(u, v);
          if (o >= 0 && o !== id && this.parts[o].z > z + 0.5) p.set(x, y, shade(p.get(x, y), 0.62));
        }
      }
    }
    outlineSel(p);
    return p;
  }
}

// ------------------------------------------------------------ materials
// What a tier's head or blade is made of, and its colour.
const TIER = {
  wood: ['wood', '#9a6e40'],
  stone: ['stone', '#8e8e98'],
  iron: ['iron', '#a8acbc'],
  gold: ['gold', '#e8be38'],
  steel: ['steel', '#b4c4dc'],
};
const HAFT = '#8a5a30';
const GRIP = '#5a3820';

// Along the diagonal: `s` from the lower left up toward the upper right,
// `t` across it (+ toward the lower right).
const O = [2.2, 13.8];
const U = [Math.SQRT1_2, -Math.SQRT1_2];
const V = [Math.SQRT1_2, Math.SQRT1_2];
const at = (s, t = 0) => [O[0] + U[0] * s + V[0] * t, O[1] + U[1] * s + V[1] * t];

function haft(S, s0, s1, r = 0.85, col = HAFT, mat = 'wood', z = 0) {
  const id = S.add(mat, col, z, { axis: [1, -1] });
  const [a, b] = [at(s0), at(s1)];
  S.capsule(id, a[0], a[1], b[0], b[1], r);
  return id;
}
function grip(S, s0, s1, r = 0.95, col = GRIP) {
  const id = S.add('leather', col, 0.4, { bands: true, axis: [1, -1] });
  const [a, b] = [at(s0), at(s1)];
  S.capsule(id, a[0], a[1], b[0], b[1], r);
  return id;
}
function knob(S, s, r, mat, col, z = 0.6) {
  const id = S.add(mat, col, z);
  const [x, y] = at(s);
  S.ellipse(id, x, y, r, r);
  return id;
}
// A crossguard across the blade at `s`.
function guard(S, s, half, mat = 'iron', col = '#8a8a98', r = 0.8) {
  const id = S.add(mat, col, 0.8);
  const [a, b] = [at(s, -half), at(s, half)];
  S.capsule(id, a[0], a[1], b[0], b[1], r);
  return id;
}
// A blade from s0 to s1: `w0` wide at the hilt, `w1` at the shoulder of the
// point, a ridge down its middle; `curve` bends it (a sabre).
function blade(S, s0, s1, w0, w1, mat, col, { tip = 2.4, curve = 0, z = 0.5 } = {}) {
  const id = S.add(mat, col, z);
  const pts = [];
  const steps = 6;
  const off = (s) => curve * ((s - s0) / (s1 - s0)) ** 2;
  for (let i = 0; i <= steps; i++) {
    const s = s0 + ((s1 - tip - s0) * i) / steps;
    const w = w0 + (w1 - w0) * (i / steps);
    pts.push(at(s, -w / 2 + off(s)));
  }
  pts.push(at(s1, off(s1) + w1 * 0.15));
  for (let i = steps; i >= 0; i--) {
    const s = s0 + ((s1 - tip - s0) * i) / steps;
    const w = w0 + (w1 - w0) * (i / steps);
    pts.push(at(s, w / 2 + off(s)));
  }
  S.poly(id, pts, Math.max(w0, w1) / 2, 'ridge');
  return id;
}

// ------------------------------------------------------------ the arms
function sword(S, mat, col, { len = 15, w = 2.6, grip0 = 0.4, grip1 = 3.6, gw = 2.4, pommel = '#c8a040', curve = 0, tip = 2.4, guardMat = 'iron', guardCol = '#7a7a88' } = {}) {
  grip(S, grip0 + 0.6, grip1);
  knob(S, grip0, 1.15, 'gold', pommel);
  blade(S, grip1 + 0.4, len, w, w * 0.92, mat, col, { curve, tip });
  guard(S, grip1 + 0.2, gw, guardMat, guardCol);
}

const WEAPONS = {
  dagger: (S) => {
    grip(S, 3.2, 6.6, 0.9);
    knob(S, 2.6, 1, 'iron', '#8a8a98');
    blade(S, 7, 13.6, 2.2, 1.6, 'steel', '#b8c4d8', { tip: 2.2 });
    guard(S, 6.9, 1.8, 'iron', '#7a7a88', 0.7);
  },
  short_sword: (S) => sword(S, 'iron', '#b0b4c4', { len: 14, w: 2.5 }),
  sabre: (S) => sword(S, 'steel', '#c0ccdc', { len: 15.5, w: 2.4, curve: 1.6, gw: 2, pommel: '#a8a8b8', guardMat: 'gold', guardCol: '#d8b040' }),
  greatsword: (S) => {
    grip(S, 0.6, 5, 1);
    knob(S, 0.2, 1.2, 'iron', '#8a8a98');
    blade(S, 5.4, 17.6, 3.4, 3, 'steel', '#b8c6dc', { tip: 3 });
    guard(S, 5.2, 3.2, 'iron', '#7a7a88', 0.9);
  },
  obsidian_blade: (S) => {
    haft(S, 0.4, 6.2, 0.9, '#6a4426');
    const id = S.add('glass', '#3a2c4a', 0.5);
    const pts = [at(5.6, -1.6), at(9, -1.9), at(12.5, -1.2), at(15.8, 0), at(12.5, 1.4), at(9, 1.8), at(5.6, 1.5)];
    S.poly(id, pts, 1.6, 'ridge');
    // (Knapped: its facets catch the light here and there.)
    const f = S.add('glow', '#a088d8', 1.6);
    for (const [s, t] of [[8, -0.6], [11, 0.4], [13.5, -0.2]]) {
      const [x, y] = at(s, t);
      S.dot(f, x, y);
    }
    for (let k = 0; k < 3; k++) {
      const [x, y] = at(5.4, -1.4 + k * 1.2);
      S.dot(S.add('leather', '#c8a870', 1.2), x, y);
    }
  },
  spear: (S) => {
    haft(S, 0.2, 13, 0.75);
    const id = S.add('steel', '#b8c4d8', 0.6);
    S.poly(id, [at(11.2, -1.4), at(14, -1.5), at(17.4, 0), at(14, 1.5), at(11.2, 1.4)], 1.4, 'ridge');
    const b = S.add('leather', '#5a3820', 0.8, { bands: true });
    const [a, c] = [at(10.2), at(11.4)];
    S.capsule(b, a[0], a[1], c[0], c[1], 1);
  },
  wooden_spear: (S) => {
    haft(S, 0.2, 13.4, 0.75, '#9a6a3a');
    const id = S.add('wood', '#c49a62', 0.5, { axis: [1, -1] });
    S.poly(id, [at(12.4, -1.1), at(17.2, 0), at(12.4, 1.1)], 1, 'ridge');
  },
  javelin: (S) => {
    haft(S, 1, 14, 0.65, '#a07040');
    const id = S.add('iron', '#a8acbc', 0.6);
    S.poly(id, [at(13, -1), at(17.2, 0), at(13, 1)], 1, 'ridge');
    const f = S.add('cloth', '#d8d0c0', 0.4);
    S.poly(f, [at(1, -1.6), at(3.4, -0.4), at(3.4, 0.4), at(1, 1.6)], 0.8);
  },
  harpoon: (S) => {
    haft(S, 0.2, 13, 0.75, '#7a5a3a');
    const id = S.add('iron', '#9aa0b0', 0.6);
    S.poly(id, [at(12, -0.8), at(17.2, 0), at(12, 0.8)], 0.9, 'ridge');
    S.poly(id, [at(13.4, -0.6), at(12.2, -2.4), at(14.4, -0.4)], 0.6);
    S.poly(id, [at(13.4, 0.6), at(12.2, 2.4), at(14.4, 0.4)], 0.6);
    const r = S.add('string', '#d8c8a0', 0.9);
    for (let k = 0; k < 5; k++) {
      const [x, y] = at(2 + k * 0.9, 1.2 + Math.sin(k) * 0.5);
      S.dot(r, x, y);
    }
  },
  club: (S) => {
    const id = S.add('wood', '#8a5e34', 0.3, { axis: [1, -1] });
    S.poly(id, [at(0.6, -0.9), at(8, -1.6), at(14.6, -2.5), at(16, 0), at(14.6, 2.5), at(8, 1.6), at(0.6, 0.9)], 2.2);
    const k = S.add('wood', '#5a3a1e', 0.9);
    for (const [s, t] of [[10, -1.2], [13, 1.4], [12, -1.8]]) {
      const [x, y] = at(s, t);
      S.ellipse(k, x, y, 0.75, 0.75);
    }
  },
  quarterstaff: (S) => {
    const id = S.add('wood', '#9a6a3a', 0.2, { axis: [1, -1] });
    const [a, b] = [at(-1.2), at(19)];
    S.capsule(id, a[0], a[1], b[0], b[1], 0.9);
    for (const s of [1.5, 15.8]) {
      const c = S.add('iron', '#8a8a98', 0.8);
      const [x0, y0] = at(s - 0.6);
      const [x1, y1] = at(s + 0.6);
      S.capsule(c, x0, y0, x1, y1, 1.1);
    }
    grip(S, 7.2, 9.6, 1);
  },
  mace: (S) => {
    haft(S, 0.4, 11.4, 0.8, '#6a4a2a');
    grip(S, 0.6, 3.4);
    const [x, y] = at(13);
    // Flanges first, then the ball over them.
    const fl = S.add('steel', '#b8c0d0', 0.6);
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
      S.capsule(fl, x, y, x + Math.cos(a) * 3.5, y + Math.sin(a) * 3.5, 0.8, 'ridge');
    }
    const head = S.add('iron', '#9a9eae', 0.9);
    S.ellipse(head, x, y, 2.3, 2.3);
  },
  flail: (S) => {
    haft(S, 0.4, 7.4, 0.8, '#6a4a2a');
    grip(S, 0.6, 3.2);
    const ch = S.add('iron', '#7a7e8a', 0.6);
    for (let k = 0; k < 4; k++) {
      const [x, y] = at(8 + k * 1.1, Math.sin(k * 1.4) * 0.8);
      S.ellipse(ch, x, y, 0.6, 0.6);
    }
    const [x, y] = at(13.4, 0.8);
    const sp = S.add('steel', '#c8d0e0', 0.7);
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2 + 0.3;
      S.capsule(sp, x, y, x + Math.cos(a) * 3.3, y + Math.sin(a) * 3.3, 0.55, 'ridge');
    }
    const ball = S.add('iron', '#8a8e9c', 0.9);
    S.ellipse(ball, x, y, 2.2, 2.2);
  },
  hand_axe: (S) => {
    haft(S, 0.4, 12.4, 0.8);
    axeHead(S, 10.4, 'iron', '#a8acbc', 4.2, 1);
  },
  battle_axe: (S) => {
    haft(S, -0.6, 15.6, 0.85, '#6a4a2a');
    grip(S, 0, 3.6);
    axeHead(S, 12.6, 'steel', '#b4c0d4', 5, 1.4);
    axeHead(S, 12.6, 'steel', '#b4c0d4', -3.4, 1.1);
  },
  warhammer: (S) => {
    haft(S, -0.6, 14.4, 0.85, '#6a4a2a');
    grip(S, 0, 3.6);
    const id = S.add('iron', '#8e92a2', 0.8);
    S.poly(id, [at(11.2, -4.2), at(14.4, -4.2), at(14.4, 3), at(11.2, 3)], 1.6);
    const sp = S.add('steel', '#c8d0e0', 1);
    S.poly(sp, [at(11.8, 3), at(13, 5.6), at(13.8, 3)], 0.7, 'ridge');
  },
  halberd: (S) => {
    haft(S, -1.2, 17, 0.75, '#6a4a2a');
    axeHead(S, 13, 'steel', '#b4c0d4', 4.2, 1.2);
    const sp = S.add('steel', '#c0cadc', 0.7);
    S.poly(sp, [at(15, -0.8), at(19, 0), at(15, 0.8)], 0.8, 'ridge');
    S.poly(sp, [at(13, -1), at(12.6, -3), at(14, -0.8)], 0.6);
  },
  bow: (S) => bowShape(S, 6.4, '#8a5a2e'),
  longbow: (S) => bowShape(S, 7.6, '#6a4422', true),
  crossbow: (S) => {
    const stock = S.add('wood', '#7a5030', 0.3, { axis: [1, -1] });
    const [a, b] = [at(0.8, 0.4), at(13.4, 0)];
    S.capsule(stock, a[0], a[1], b[0], b[1], 1.1);
    const prod = S.add('steel', '#a8b4c8', 0.8);
    const pts = [];
    for (let k = -5; k <= 5; k++) pts.push(at(11.6 - (k * k) * 0.09, k * 0.9));
    for (let i = 0; i < pts.length - 1; i++) S.capsule(prod, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], 0.7);
    const st = S.add('string', '#e8e0c8', 0.5);
    const [s0, s1] = [at(9.4, -4.4), at(9.4, 4.4)];
    S.capsule(st, s0[0], s0[1], s1[0], s1[1], 0.4);
    const bolt = S.add('iron', '#c8b890', 1);
    const [c0, c1] = [at(6.4, 0), at(14.6, 0)];
    S.capsule(bolt, c0[0], c0[1], c1[0], c1[1], 0.45);
  },
  sling: (S) => {
    const c = S.add('string', '#c8a878', 0.4);
    const pts = [[3, 2], [4.4, 6], [6.2, 9.4], [8.6, 11.6], [11.6, 12.4], [13.4, 10.6], [12.6, 7.6], [10.4, 4.6], [8, 2.6]];
    for (let i = 0; i < pts.length - 1; i++) S.capsule(c, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], 0.45);
    const pouch = S.add('leather', '#7a4e2c', 0.8);
    S.ellipse(pouch, 11.4, 11.6, 2.4, 1.8);
    const stone = S.add('stone', '#9a9aa4', 1.4);
    S.ellipse(stone, 11.2, 10.8, 1.2, 1);
  },
  kav_blade: (S) => {
    grip(S, 0.6, 3.8, 0.95, '#2a2e3a');
    knob(S, 0.2, 1.1, 'steel', '#5a6478');
    const id = blade(S, 4.2, 16, 3, 2.4, 'steel', '#4a5468', { tip: 3 });
    guard(S, 4, 2.6, 'steel', '#3a4252');
    const g = S.add('glow', '#7af0ff', 1.4);
    for (let s = 5; s < 14.4; s += 0.7) {
      const [x, y] = at(s, 0);
      S.dot(g, x, y);
    }
    return id;
  },
  kav_lance: (S) => {
    haft(S, -0.4, 14, 0.8, '#3a4252', 'steel');
    const id = S.add('steel', '#5a6478', 0.6);
    S.poly(id, [at(11.6, -1.8), at(13.4, -2), at(18, 0), at(13.4, 2), at(11.6, 1.8)], 1.6, 'ridge');
    const g = S.add('glow', '#7af0ff', 1.4);
    for (let s = 1; s < 16.6; s += 1.6) {
      const [x, y] = at(s, 0);
      S.dot(g, x, y);
    }
  },
  kav_caster: (S) => {
    const body = S.add('steel', '#4a5468', 0.4);
    S.poly(body, [[2, 9], [12.6, 6.4], [14.4, 8.4], [13.4, 10.6], [6, 11.6], [5, 13.8], [2.6, 14], [3.4, 11]], 1.6);
    const g = S.add('glow', '#7af0ff', 1.2);
    for (let x = 4; x < 13; x++) S.dot(g, x, 9 - (x - 4) * 0.22);
    S.dot(g, 14, 8);
    S.dot(g, 14, 9);
  },
};

// An axe's bit, curved, on the haft at `s`, standing out to `t` (negative:
// the back side).
function axeHead(S, s, mat, col, t, half) {
  const id = S.add(mat, col, 0.7);
  const sg = Math.sign(t);
  const T = Math.abs(t);
  // (The bit flares out from a narrow neck to a broad curved edge.)
  const pts = [at(s - half * 0.8, 0), at(s - half * 0.7, sg * T * 0.45), at(s - half - 2.2, sg * T * 0.9), at(s - half - 1.6, sg * T * 1.08), at(s, sg * T * 1.16), at(s + half + 1.8, sg * T * 1.06), at(s + half + 2.2, sg * T * 0.82), at(s + half * 0.7, sg * T * 0.4), at(s + half * 0.8, 0)];
  S.poly(id, pts, 1.4, 'ridge');
  return id;
}

function bowShape(S, bend, col, long = false) {
  const id = S.add('wood', col, 0.5, { axis: [1, 1] });
  const pts = [];
  const len = long ? 9.4 : 8.4;
  for (let k = -len; k <= len + 0.01; k += 1.2) pts.push(at(8 + bend * (1 - (k / len) ** 2) * 0.55, k));
  for (let i = 0; i < pts.length - 1; i++) S.capsule(id, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], 0.85);
  const st = S.add('string', '#ece4cc', 0.2);
  const [a, b] = [pts[0], pts[pts.length - 1]];
  S.capsule(st, a[0], a[1], b[0], b[1], 0.35);
  const g = S.add('leather', '#5a3820', 1, { bands: true });
  const [c0, c1] = [at(8 + bend * 0.55, -1.2), at(8 + bend * 0.55, 1.2)];
  S.capsule(g, c0[0], c0[1], c1[0], c1[1], 1);
}

// A tool of a tier.
function tool(S, kind, tier) {
  const [mat, col] = TIER[tier] || TIER.iron;
  switch (kind) {
    case 'pickaxe': {
      haft(S, 0.4, 13.6, 0.8);
      const id = S.add(mat, col, 0.7);
      const pts = [];
      for (let k = -6; k <= 6; k++) pts.push(at(12.2 - (k * k) * 0.075, k * 0.95));
      for (let i = 0; i < pts.length - 1; i++) S.capsule(id, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], i === 0 || i === pts.length - 2 ? 0.55 : 0.95);
      break;
    }
    case 'axe':
      haft(S, 0.4, 13, 0.8);
      axeHead(S, 10.8, mat, col, 4, 1);
      break;
    case 'shovel': {
      haft(S, 0.4, 11.4, 0.75);
      const id = S.add(mat, col, 0.6);
      S.poly(id, [at(10.4, -2.2), at(14.8, -2.2), at(17, 0), at(14.8, 2.2), at(10.4, 2.2)], 1.8);
      break;
    }
    case 'sword':
      sword(S, mat, col, { len: 14.6, w: 2.4, pommel: tier === 'gold' ? '#e8be38' : '#a07a40', guardMat: mat === 'wood' ? 'wood' : 'iron', guardCol: mat === 'wood' ? '#7a5030' : '#7a7a88' });
      break;
    case 'hoe': {
      haft(S, 0.4, 14, 0.75);
      const id = S.add(mat, col, 0.7);
      S.poly(id, [at(12.2, 0), at(13.8, -0.2), at(13.4, 4), at(11.6, 4)], 1);
      break;
    }
    case 'hammer': {
      haft(S, 0.4, 12, 0.8);
      const id = S.add('iron', '#8e92a2', 0.8);
      S.poly(id, [at(11, -3.2), at(14.2, -3.2), at(14.2, 3.2), at(11, 3.2)], 1.6);
      break;
    }
  }
}

// ------------------------------------------------------------ armour
const LOOK_COL = { lcap: '#7a5232', helmet: '#9a9eac', straw: '#e2c062', hood: '#6a4a2a', circlet: '#e0b830', goggles: '#3a2a1e', leather: '#7a5232', chain: '#8a8e9c', plate: '#a8acbc', linen: '#e4dcc8', coat: '#3a2a4a', cloth: '#4a4a6a', iron: '#8e92a2' };
const KAV = '#4a5468';
const KGLOW = '#7af0ff';

function armour(S, it) {
  const [lk, tint] = String(it.look).split(':');
  const col = tint || (lk === 'leather' && it.slot === 'feet' ? '#5a3820' : LOOK_COL[lk]) || '#888888';
  const slot = it.slot;
  const mat = { plate: 'iron', iron: 'iron', helmet: 'iron', chain: 'iron', circlet: 'gold', leather: 'leather', lcap: 'leather', kav: 'steel' }[lk] || 'cloth';
  if (slot === 'head') {
    if (lk === 'straw') {
      const brim = S.add('wood', col, 0, { axis: [1, 0] });
      S.ellipse(brim, 8, 10.4, 7.2, 2.6);
      const crown = S.add('wood', shade(col, 0.95), 1, { axis: [1, 0] });
      S.poly(crown, [[4.6, 10], [5.2, 5.4], [10.8, 5.4], [11.4, 10]], 2);
      const band = S.add('cloth', '#a83a2a', 1.6);
      S.poly(band, [[4.8, 8.2], [11.2, 8.2], [11.3, 9.6], [4.7, 9.6]], 0.6, 'flat');
    } else if (lk === 'circlet') {
      const id = S.add('gold', col, 0.5);
      for (let a = 0; a < Math.PI * 2; a += 0.12) S.dot(id, 8 + Math.cos(a) * 6, 9 + Math.sin(a) * 2.6);
      S.ellipse(id, 8, 6.4, 1.4, 1.6);
      const gem = S.add('glass', '#50c0e0', 1.6);
      S.ellipse(gem, 8, 6.4, 0.9, 1);
    } else if (lk === 'goggles') {
      const strap = S.add('leather', col, 0, { bands: true, axis: [0, 1] });
      S.poly(strap, [[0.6, 7.2], [15.4, 7.2], [15.4, 9.6], [0.6, 9.6]], 1);
      for (const cx of [4.8, 11.2]) {
        const rim = S.add('iron', '#8a6a3a', 0.8);
        S.ellipse(rim, cx, 8.4, 3.2, 3.2);
        const lens = S.add('glass', '#e08a40', 1.2);
        S.ellipse(lens, cx, 8.4, 2.2, 2.2);
      }
    } else if (lk === 'hood') {
      const id = S.add('cloth', col, 0);
      S.poly(id, [[8, 1.2], [12.4, 3.6], [14, 9], [13, 14.6], [3, 14.6], [2, 9], [3.6, 3.6]], 3.4);
      const face = S.add('cloth', shade(col, 0.28), 0.6);
      S.ellipse(face, 8, 9.6, 3.2, 3.6, 'flat');
      // (A glimpse of a face in its shadow.)
      const skin = S.add('cloth', '#8a6450', 0.9);
      S.ellipse(skin, 8, 10.6, 1.6, 1.6, 'flat');
    } else if (lk === 'kav') {
      const id = S.add('steel', KAV, 0);
      S.poly(id, [[8, 1.6], [13, 4], [14, 10], [12, 14], [4, 14], [2, 10], [3, 4]], 3.4);
      const g = S.add('glow', KGLOW, 1.6);
      for (let x = 4; x <= 11; x++) S.dot(g, x, 8);
    } else {
      // A cap or a helm: a dome, a brim; an iron one rivetted, with a nasal.
      const id = S.add(mat, col, 0);
      S.poly(id, [[2.4, 12], [2.6, 7.6], [4.6, 3.8], [8, 2.4], [11.4, 3.8], [13.4, 7.6], [13.6, 12]], 4.4);
      const rim = S.add(mat, shade(col, 0.85), 1.2);
      S.poly(rim, [[1.6, 10.6], [14.4, 10.6], [14.4, 13], [1.6, 13]], 1, 'round');
      if (lk === 'helmet') {
        const nasal = S.add('iron', col, 1.4);
        S.poly(nasal, [[7.2, 9], [8.8, 9], [8.6, 15], [7.4, 15]], 0.8);
        const rv = S.add('steel', '#d8dce8', 2);
        for (const x of [3.4, 6, 10, 12.6]) S.dot(rv, x, 11.6);
      } else {
        const st = S.add('leather', shade(col, 0.6), 1.4);
        for (let y = 4; y < 11; y += 2) S.dot(st, 8, y);
      }
    }
    return;
  }
  if (slot === 'body') {
    const sleeves = lk === 'tabard' ? ['iron', '#8a8e9c'] : [mat, col];
    const torso = S.add(lk === 'tabard' ? 'iron' : mat, lk === 'tabard' ? '#8a8e9c' : col, 0, { rings: lk === 'chain' || lk === 'tabard' });
    S.poly(torso, [[4.2, 1.6], [11.8, 1.6], [12.6, 4], [12.2, 14.6], [3.8, 14.6], [3.4, 4]], 4);
    const sl = S.add(sleeves[0], sleeves[1], -0.2, { rings: lk === 'chain' || lk === 'tabard' });
    S.poly(sl, [[4.2, 1.6], [3.4, 4], [1.2, 10.4], [3.2, 11], [4.4, 6]], 1.4);
    S.poly(sl, [[11.8, 1.6], [12.6, 4], [14.8, 10.4], [12.8, 11], [11.6, 6]], 1.4);
    if (lk !== 'tabard' && lk !== 'kav') {
      // The neck.
      const nk = S.add('cloth', shade(col, 0.35), 0.9);
      S.ellipse(nk, 8, 1.8, 2.2, 1.4, 'flat');
    }
    if (lk === 'plate') {
      const ridge = S.add('iron', col, 0.8);
      S.poly(ridge, [[6.6, 3], [9.4, 3], [8.8, 13.6], [7.2, 13.6]], 1.4, 'ridge');
      const pau = S.add('steel', shade(col, 1.05), 1.2);
      S.ellipse(pau, 3.6, 3.6, 2.4, 1.8);
      S.ellipse(pau, 12.4, 3.6, 2.4, 1.8);
    } else if (lk === 'tabard') {
      const tb = S.add('cloth', col, 0.8);
      S.poly(tb, [[5.4, 1.8], [10.6, 1.8], [10.8, 15], [5.2, 15]], 1.4);
      const em = S.add('gold', '#f0d070', 1.4);
      S.poly(em, [[8, 4.4], [10.2, 7], [8, 10.4], [5.8, 7]], 1.2);
    } else if (lk === 'coat') {
      const trim = S.add('gold', '#d0a030', 1);
      for (let y = 2; y < 15; y++) S.dot(trim, 7.5, y);
      for (const y of [4.5, 7.5, 10.5]) S.dot(trim, 9, y);
      const coll = S.add('cloth', shade(col, 1.25), 0.9);
      S.poly(coll, [[5, 1.4], [8, 4.6], [11, 1.4]], 0.8);
    } else if (lk === 'leather') {
      const lace = S.add('string', '#e0c890', 1);
      for (let y = 3; y < 11; y += 2) {
        S.dot(lace, 7, y);
        S.dot(lace, 9, y + 1);
      }
      const belt = S.add('leather', '#3a2414', 0.9);
      S.poly(belt, [[3.8, 11], [12.2, 11], [12.2, 12.6], [3.8, 12.6]], 0.8, 'flat');
      S.dot(S.add('gold', '#d8b040', 1.4), 8, 11.8);
    } else if (lk === 'linen') {
      const v = S.add('cloth', shade(col, 0.7), 0.5);
      S.poly(v, [[6.4, 1.6], [8, 5.4], [9.6, 1.6]], 0.6);
    } else if (lk === 'kav') {
      const g = S.add('glow', KGLOW, 1.4);
      for (let y = 3; y < 14; y++) S.dot(g, 8, y);
      for (let x = 5; x <= 11; x++) S.dot(g, x, 7);
    }
    return;
  }
  if (slot === 'legs') {
    const id = S.add(mat, col, 0);
    S.poly(id, [[3.6, 1.6], [12.4, 1.6], [12.8, 15], [9, 15], [8, 6], [7, 15], [3.2, 15]], 2.4);
    const belt = S.add(lk === 'plate' || lk === 'kav' ? 'leather' : mat, lk === 'cloth' ? shade(col, 0.7) : '#4a2e1a', 0.8);
    S.poly(belt, [[3.4, 1.4], [12.6, 1.4], [12.6, 3.2], [3.4, 3.2]], 0.8, 'flat');
    if (lk === 'plate') {
      const kn = S.add('steel', shade(col, 1.08), 1.2);
      S.ellipse(kn, 5.4, 9, 1.8, 1.4);
      S.ellipse(kn, 10.6, 9, 1.8, 1.4);
    } else if (lk === 'kav') {
      const g = S.add('glow', KGLOW, 1.2);
      for (let y = 5; y < 14; y += 2) {
        S.dot(g, 5, y);
        S.dot(g, 11, y);
      }
    } else if (lk === 'leather') {
      const st = S.add('string', '#c8a878', 1);
      for (let y = 5; y < 14; y += 2) {
        S.dot(st, 4.6, y);
        S.dot(st, 11.4, y);
      }
    }
    return;
  }
  if (slot === 'feet') {
    for (const [x0, flip] of [[1, 1], [9, 1]]) {
      const id = S.add(mat, col, 0);
      S.poly(id, [[x0 + 0.6, 3], [x0 + 4.4, 3], [x0 + 4.6, 10], [x0 + 6.4 * flip, 11], [x0 + 6.6, 14], [x0 + 0.4, 14]], 2);
      const cuff = S.add(lk === 'iron' || lk === 'kav' ? 'steel' : mat, shade(col, 1.15), 0.8);
      S.poly(cuff, [[x0 + 0.2, 2.4], [x0 + 4.8, 2.4], [x0 + 4.8, 4.4], [x0 + 0.2, 4.4]], 0.8);
      if (lk === 'kav') S.dot(S.add('glow', KGLOW, 1.4), x0 + 3, 9);
      const sole = S.add('leather', '#2a1a10', 0.4);
      S.poly(sole, [[x0 + 0.2, 13.2], [x0 + 6.8, 13.2], [x0 + 6.8, 14.6], [x0 + 0.2, 14.6]], 0.6, 'flat');
    }
    return;
  }
  if (slot === 'shield') {
    if (lk === 'round') {
      const rim = S.add('iron', '#7a5a3a', 0);
      S.ellipse(rim, 8, 8, 7.2, 7.2);
      const face = S.add('wood', '#b8322c', 0.6, { axis: [1, 0] });
      S.ellipse(face, 8, 8, 6, 6);
      const cross = S.add('cloth', '#e8d8a0', 1);
      S.poly(cross, [[7, 2.4], [9, 2.4], [9, 13.6], [7, 13.6]], 0.8, 'flat');
      S.poly(cross, [[2.4, 7], [13.6, 7], [13.6, 9], [2.4, 9]], 0.8, 'flat');
      const boss = S.add('steel', '#c8ccd8', 1.6);
      S.ellipse(boss, 8, 8, 1.8, 1.8);
    } else if (lk === 'kav') {
      const id = S.add('steel', KAV, 0);
      S.poly(id, [[8, 0.8], [14.4, 3.6], [14.4, 11], [8, 15.4], [1.6, 11], [1.6, 3.6]], 4);
      const g = S.add('glow', KGLOW, 1.6);
      for (let a = 0; a < 6; a++) {
        const x = 8 + Math.cos((a / 6) * Math.PI * 2) * 3.4;
        const y = 8 + Math.sin((a / 6) * Math.PI * 2) * 3.4;
        S.dot(g, x, y);
      }
      S.dot(g, 8, 8);
    } else {
      const iron = lk === 'iron';
      const rim = S.add('iron', iron ? '#c8ccd8' : '#5a5e6a', 0);
      S.poly(rim, [[2, 1.4], [14, 1.4], [14, 8], [8, 15.2], [2, 8]], 3.2);
      const face = S.add(iron ? 'iron' : 'wood', iron ? '#9a9eae' : '#8a6038', 0.6, { axis: [0, 1] });
      S.poly(face, [[3.2, 2.6], [12.8, 2.6], [12.8, 7.6], [8, 13.6], [3.2, 7.6]], 3);
      if (iron) {
        const ridge = S.add('steel', '#b8c0d0', 1);
        S.poly(ridge, [[7.2, 2.6], [8.8, 2.6], [8.6, 13], [7.4, 13]], 0.8, 'ridge');
      } else {
        const boss = S.add('iron', '#8a8e9c', 1.4);
        S.ellipse(boss, 8, 7, 1.8, 1.8);
      }
    }
  }
}

// ------------------------------------------------------------ the way in
// A new icon for this, if it's one drawn here (else null).
export function smithIcon(key, it) {
  const S = new Sculpt();
  const m = key.match(/^(wood|stone|iron|gold|steel)_(pickaxe|axe|shovel|sword)$/);
  if (m) tool(S, m[2], m[1]);
  else if (key === 'hoe' || key === 'hammer') tool(S, key, 'iron');
  else if (WEAPONS[key]) WEAPONS[key](S);
  else if (it && it.kind === 'armor' && it.slot) armour(S, it);
  else return null;
  return S.render();
}

// Anything else: its own picture given a body and lit (see the top).
export function relight(src, outline = '#1a1420') {
  const out = hex(outline);
  const W = src.w;
  const H = src.h;
  const isOut = (c) => Math.abs(c[0] - out[0]) + Math.abs(c[1] - out[1]) + Math.abs(c[2] - out[2]) < 24;
  const solid = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const c = src.get(x, y);
    if (c[3] > 0 && !isOut(c)) solid[y * W + x] = 1;
  }
  // How far in from the edge (a few passes of a chamfer), as height.
  const d = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) d[i] = solid[i] ? 9 : 0;
  for (let pass = 0; pass < 2; pass++) {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (!solid[i]) continue;
      const n = (u, v) => (u < 0 || v < 0 || u >= W || v >= H ? 0 : d[v * W + u]);
      d[i] = Math.min(d[i], n(x - 1, y) + 1, n(x, y - 1) + 1, n(x - 1, y - 1) + 1.4, n(x + 1, y - 1) + 1.4);
    }
    for (let y = H - 1; y >= 0; y--) for (let x = W - 1; x >= 0; x--) {
      const i = y * W + x;
      if (!solid[i]) continue;
      const n = (u, v) => (u < 0 || v < 0 || u >= W || v >= H ? 0 : d[v * W + u]);
      d[i] = Math.min(d[i], n(x + 1, y) + 1, n(x, y + 1) + 1, n(x + 1, y + 1) + 1.4, n(x - 1, y + 1) + 1.4);
    }
  }
  const hgt = (x, y) => (x < 0 || y < 0 || x >= W || y >= H || !solid[y * W + x] ? -0.6 : Math.sqrt(Math.min(3, d[y * W + x]) / 3));
  const p = new Px(W, H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!solid[y * W + x]) continue;
      const c = src.get(x, y);
      const n = norm((hgt(x - 1, y) - hgt(x + 1, y)) * 1.1, (hgt(x, y - 1) - hgt(x, y + 1)) * 1.1, 1);
      const l = clamp((n[0] * LIGHT[0] + n[1] * LIGHT[1] + n[2] * LIGHT[2] - 0.62) * 2.2, -1, 1);
      let col = l < 0 ? mix(shade(c, 1 + 0.42 * l), [38, 24, 72], -0.24 * l) : mix(shade(c, 1 + 0.22 * l), [255, 240, 196], 0.16 * l);
      // (Something shiny, pale and grey or glassy: a glint on its lit shoulder.)
      const mx = Math.max(c[0], c[1], c[2]);
      const mn = Math.min(c[0], c[1], c[2]);
      if (mx > 150 && mx - mn < 60 && l > 0.6) col = mix(col, [255, 255, 255], 0.45);
      p.set(x, y, col, c[3]);
    }
  }
  outlineSel(p);
  return p;
}
