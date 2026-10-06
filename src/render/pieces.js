// The great things at the heart of each people's square (see
// world/settlement.decorate): bigger than a pace, each stands on nine of
// them (the eight round the middle an unseen stone: see blocks.plinth),
// and is drawn whole from whichever of those is nearest you on screen, so
// it stands where it is whichever way you look.
//   A Thessan town that has learned to bring water in (aqueducts) has a
// fountain where its well stood; the Ashborn keep a heartfire burning on
// a basalt dais (set in a heart-crystal once they raise the ember ward);
// the Mirefolk grow the Old Glowcap (greater, and brighter, once they
// know the heart of the mire); the Stiltfolk pour water from a great
// conch on a coral spire (its pearls alight with the heart of the mire).
//   Painted rather than drawn from a sheet, in twelve frames so the water
// runs and the fire burns smoothly, each part lit and textured as what
// it's made of: dressed stone in courses, bronze gone green, glass with
// fire in it, a mushroom's fibrous stalk and spotted cap, coral, shell.
import { GROUND } from '../config.js';
import { hex, shade, mix } from './pixel.js';
import { Paint, hash2 } from './paint.js';
import { outlineSel } from './people.js';

export const PIECE_W = 48;
export const PIECE_FRAMES = 12;
export const PIECE_FPS = 10;
const TAU = Math.PI * 2;
const W = PIECE_W;
const CX = W / 2;

// ---------------------------------------------------------------- helpers
// An ellipse's edge at column x: its front (sign 1) or back (-1), or null
// outside it.
function edge(cx, cy, rx, ry, x, sign = 1) {
  const u = (x + 0.5 - cx) / rx;
  if (Math.abs(u) > 1) return null;
  return cy + sign * ry * Math.sqrt(1 - u * u);
}
function inside(cx, cy, rx, ry, x, y) {
  const u = (x + 0.5 - cx) / rx;
  const v = (y + 0.5 - cy) / ry;
  return u * u + v * v <= 1;
}
const frac = (v) => v - Math.floor(v);

// A round wall of dressed stone `hgt` high, its top the ellipse (cx, cy,
// rx, ry): the face toward you laid in courses of blocks (each block its
// own shade, the joints dark, lit from the left and darker at its foot),
// then its top, a ring `rim` wide, its joints running in toward the middle.
function roundWall(P, cx, cy, rx, ry, hgt, rim, col, o = {}) {
  const joints = o.joints ?? 16;
  const course = o.course ?? 4;
  const seed = o.seed ?? 1;
  const top = o.top || col;
  const at = (x) => {
    const u = Math.max(-1, Math.min(1, (x + 0.5 - cx) / rx));
    return Math.asin(u) / Math.PI + 0.5;
  };
  for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
    const yf = edge(cx, cy, rx, ry, x);
    if (yf === null) continue;
    const u = (x + 0.5 - cx) / rx;
    for (let k = 0; k < hgt; k++) {
      const y = Math.floor(yf) + k;
      const c = Math.floor(k / course);
      const off = (c % 2) * 0.5;
      const f0 = at(x - 1) * joints + off;
      const f1 = at(x) * joints + off;
      let lv = 0.56 - u * 0.24 - (k / hgt) * 0.2;
      if (k % course === course - 1 && k < hgt - 1) lv -= 0.24;
      else if (Math.floor(f0) !== Math.floor(f1)) lv -= 0.22;
      else {
        lv += (hash2(Math.floor(f1), c, seed) - 0.5) * 0.16;
        // (The top of each block catches the light.)
        if (k % course === 0) lv += 0.08;
      }
      if (o.stain && k >= hgt - 2) lv -= 0.08;
      P.set(x, y, P.tone(col, lv, x, y));
    }
  }
  // The top: a ring of capstones.
  const irx = rx - rim;
  const iry = ry - rim * (ry / rx);
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      if (!inside(cx, cy, rx, ry, x, y) || (o.hollow !== false && inside(cx, cy, irx, iry, x, y))) continue;
      const a = Math.atan2((y + 0.5 - cy) / ry, (x + 0.5 - cx) / rx);
      const s = Math.floor(((a / TAU) + 1) * joints * 1.5);
      const s0 = Math.floor(((Math.atan2((y + 0.5 - cy) / ry, (x - 0.5 - cx) / rx) / TAU) + 1) * joints * 1.5);
      let lv = 0.8 - ((x - cx) / rx) * 0.14 - ((y - cy) / ry) * 0.08 + (hash2(s, 7, seed) - 0.5) * 0.12;
      if (s !== s0) lv -= 0.2;
      // (Its outer edge rounded off toward you.)
      if (!inside(cx, cy + 0.8, rx, ry, x, y)) lv -= 0.12;
      P.set(x, y, P.tone(top, lv, x, y));
    }
  }
}

// Water in a basin (the ellipse cx, cy, rx, ry), at phase t: the sky in it
// at the back, darker under the near wall, rings spreading from where the
// water falls (rx0, ry0: the ring nearest the middle), and glints.
function water(P, cx, cy, rx, ry, t, o = {}) {
  const col = o.col || '#4a8ac8';
  const rings = o.rings ?? 5;
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      if (!inside(cx, cy, rx, ry, x, y)) continue;
      const depth = (y + 0.5 - (cy - ry)) / (2 * ry);
      let lv = 0.78 - depth * 0.42;
      // (The near wall's shadow on the water.)
      if (!inside(cx, cy - 1.5, rx, ry, x, y)) lv -= 0.18;
      const d = Math.hypot((x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry);
      const ph = frac(d * rings - t * 2);
      if (d > (o.calm ?? 0.18) && ph < 0.1) lv += 0.16 * (1 - d * 0.6);
      let c = P.tone(col, lv, x, y);
      // (A few glints, toward the back, where the sky is in it.)
      if (depth < 0.45 && hash2(x, y, Math.floor(t * PIECE_FRAMES)) > 0.992) c = hex(o.glint || '#e8f8ff');
      if (o.glow) c = mix(c, hex(o.glow), o.glowK ?? 0.3);
      P.set(x, y, c);
    }
  }
}

// A thread of falling water from (x0, y0) down to y1, bowed out by `bow`,
// its drops running down at phase t.
function fall(P, x0, y0, x1, y1, t, o = {}) {
  const n = Math.max(2, Math.round(Math.abs(y1 - y0)));
  const lite = hex(o.lite || '#d8f0ff');
  const mid = hex(o.mid || '#7ab8e8');
  for (let i = 0; i <= n; i++) {
    const k = i / n;
    // (A curve: out first, then down.)
    const x = x0 + (x1 - x0) * Math.sin((k * Math.PI) / 2);
    const y = y0 + (y1 - y0) * k * k * 0.4 + (y1 - y0) * k * 0.6;
    const ph = frac(k * 2.5 - t * 3);
    P.fx(x, y, ph < 0.35 ? lite : mid, ph < 0.35 ? 0.95 : 0.7);
    if (o.wide) P.fx(x + 1, y, mid, 0.5);
  }
  // A splash where it lands.
  const s = frac(t * 3);
  P.fx(x1 - 1, y1 - 1 - (s < 0.5 ? 1 : 0), lite, 0.8);
  P.fx(x1 + 1, y1 - 1 - (s >= 0.5 ? 1 : 0), lite, 0.8);
}

// Fire over (cx, base): `n` tongues `w` across at the foot, up to `hgt`
// tall, each leaping and swaying in its own time (phase t), white at the
// heart, yellow, orange, and red at the tips; sparks rising out of it.
function fire(P, cx, base, w, hgt, t, o = {}) {
  const n = o.n ?? 4;
  const seed = o.seed ?? 3;
  // The body of it: broad and round at the foot, drawn up to a point.
  // And on it the tongues, each leaping in its own time.
  const tongues = [];
  for (let i = 0; i < n; i++) {
    const k = n === 1 ? 0.5 : i / (n - 1);
    const mid = Math.abs(k - 0.5) * 2;
    const ph = hash2(i, seed, 5);
    const lift = 0.5 + 0.5 * Math.sin(TAU * (t * (1 + (i % 2)) + ph));
    tongues.push({
      x: cx + (k - 0.5) * w * 0.55,
      foot: hgt * 0.18,
      h: hgt * (1 - mid * 0.35) * (0.62 + 0.38 * lift),
      w: w * 0.34 * (1.1 - mid * 0.3),
      ph,
      k: 1 + ((i + 1) % 2),
    });
  }
  const pal = o.pal || ['#fffbe0', '#ffe060', '#ffa020', '#f05818', '#a02010'];
  const bodyH = hgt * (0.5 + 0.06 * Math.sin(TAU * t * 2));
  for (let y = Math.floor(base - hgt - 2); y <= base; y++) {
    for (let x = Math.floor(cx - w); x <= Math.ceil(cx + w); x++) {
      const px = x + 0.5;
      let I = 0;
      {
        const hh = (base - y + 0.5) / bodyH;
        if (hh >= 0 && hh <= 1) {
          const sway = Math.sin(TAU * t + hh * 2.5) * hh * w * 0.06;
          const hw = (w / 2) * Math.pow(1 - hh, 1.15) * Math.min(1, 0.8 + hh * 1.5);
          const d = Math.abs(px - (cx + sway)) / Math.max(0.6, hw);
          if (d < 1) I = (1 - d * d) * (1 - hh * 0.25);
        }
      }
      for (const tg of tongues) {
        const hh = (base - tg.foot - y + 0.5) / tg.h;
        if (hh < 0 || hh > 1) continue;
        const sway = Math.sin(TAU * (t * tg.k + tg.ph) + hh * 2) * hh * tg.w * 0.35;
        const hw = (tg.w / 2) * Math.pow(1 - hh, 1.1) * Math.min(1, 0.6 + hh * 2.5);
        const d = Math.abs(px - (tg.x + sway)) / Math.max(0.6, hw);
        if (d >= 1) continue;
        I = Math.max(I, (1 - d * d) * (0.95 - hh * 0.5));
      }
      if (I <= 0) continue;
      // (Flicker: slow licks of brightness running up through it.)
      I += Math.sin(px * 0.45 - y * 0.35 + TAU * t * 2) * 0.06;
      const hh = (base - y) / hgt;
      if (I > 0.8 && hh < 0.4) P.fx(x, y, pal[0], 1);
      else if (I > 0.56) P.fx(x, y, pal[1], 1);
      else if (I > 0.33) P.fx(x, y, pal[2], 1);
      else if (I > 0.15) P.fx(x, y, pal[3], 0.95);
      else P.fx(x, y, pal[4], 0.65);
    }
  }
  // Sparks.
  for (let i = 0; i < (o.sparks ?? 6); i++) {
    const ph = hash2(i, seed, 9);
    const k = frac(t * (1 + (i % 2)) + ph);
    const x = cx + (hash2(i, seed, 11) - 0.5) * w * 1.2 + Math.sin(TAU * (k + ph)) * 2;
    const y = base - hgt * 0.4 - k * hgt * 1.1;
    if (y < 1) continue;
    P.fx(x, y, k < 0.5 ? '#fff0a0' : '#ff9030', 1 - k * 0.6);
  }
}

// A soft glow round a point: a light laid over what's there, fading out.
function glow(P, cx, cy, r, c, k) {
  P.puff(cx, cy, r, c, k);
}

// ---------------------------------------------------------------- pieces
// Each: its height, and how to paint it at phase t (0..1) in state st
// (0 or 1: see blocks.js), its foot at the bottom of the picture, the
// middle of its nine paces at (24, h - 24).
const PIECES = {};

// The fountain: a round basin of pale dressed limestone, a carved column
// in it carrying a bowl, a jet leaping from the bowl's crown and the bowl
// brimming over in threads into the basin, the water in it rippling.
PIECES.fountain = {
  h: 66,
  paint(P, t) {
    const H = 66;
    const by = H - 24;
    const stone = '#cfc6b2';
    // The basin, and the water in it.
    roundWall(P, CX, by - 6, 22, 14, 8, 3, stone, { joints: 14, seed: 4, stain: true });
    water(P, CX, by - 6, 19, 11, t, { rings: 4 });
    // The column: fluted, a band about it, a foot in the water.
    P.blob(CX, by - 4, 5, 2.4, '#b8b0a0', { flat: 0.4 });
    P.tube(CX, by - 6, CX, H - 50, 3.6, 3, stone);
    for (const dx of [-2, 0, 2]) for (let y = H - 50; y < by - 7; y++) if ((y + dx) % 5 !== 0) P.set(CX + dx, y, P.tone(stone, dx < 0 ? 0.52 : dx > 0 ? 0.32 : 0.42, CX + dx, y));
    P.tube(CX - 4, by - 18, CX + 4, by - 18, 1.2, 1.2, '#a89878');
    // The lion's heads on the column, spouting.
    for (const [dx, dir] of [[-3, -1], [3, 1]]) {
      P.blob(CX + dx, by - 18, 1.6, 1.4, '#b89a5a');
      fall(P, CX + dx + dir * 2, by - 18, CX + dx + dir * 9, by - 6, t + (dir > 0 ? 0.5 : 0), { wide: false });
    }
    // The bowl, its lip, and the water in it.
    const bowlY = H - 51;
    for (let x = CX - 10; x <= CX + 10; x++) {
      const yf = edge(CX, bowlY, 10, 4, x);
      if (yf === null) continue;
      const u = (x + 0.5 - CX) / 10;
      const d = Math.round(3 + (1 - Math.abs(u)) * 3);
      for (let k = 0; k < d; k++) P.set(x, Math.floor(yf) + k, P.tone(stone, 0.55 - u * 0.25 - k * 0.06, x, Math.floor(yf) + k));
    }
    roundWall(P, CX, bowlY, 10, 4, 1, 1.6, stone, { joints: 8, seed: 5 });
    water(P, CX, bowlY, 8.4, 2.6, t, { rings: 2, calm: 0.3 });
    // It brims over, in threads, all round.
    for (const [x0, x1] of [[-9, -13], [9, 13], [-5, -7], [5, 7]]) fall(P, CX + x0, bowlY + 3, CX + x1, by - 7, t + x0 * 0.07);
    // The finial: a stone pine-cone, and the jet from its crown.
    P.blob(CX, bowlY - 3, 2.4, 3, '#b8ac94');
    for (let i = 0; i < 3; i++) P.set(CX - 1 + i, bowlY - 4 + (i % 2), P.tone('#b8ac94', 0.3, CX - 1 + i, bowlY - 4));
    outlineSel(P.p);
    const jet = 9 + Math.sin(TAU * t * 2) * 1.5;
    for (let k = 0; k < jet; k++) P.fx(CX, bowlY - 6 - k, k > jet - 3 ? '#ffffff' : '#bfe6ff', 0.85);
    for (const s of [-1, 1]) {
      for (let k = 0; k < 6; k++) {
        const a = k / 6;
        P.fx(CX + s * (1 + a * 7), bowlY - 6 - jet + a * a * 8, frac(a * 2 - t * 3) < 0.4 ? '#ffffff' : '#9fd2f4', 0.75);
      }
    }
    // (Spray where the threads land.)
    for (let i = 0; i < 6; i++) {
      const k = frac(t * 2 + i / 6);
      P.fx(CX - 15 + i * 6, by - 8 - Math.sin(k * Math.PI) * 2, '#e8f8ff', 0.6 * (1 - k));
    }
  },
};

// The Ashborn's dais: two octagonal steps of dressed basalt banded with
// red kiln brick, ash in the corners; the bronze bowl on it.
function dais(P, H) {
  const by = H - 24;
  const basalt = '#3e3a3e';
  roundWall(P, CX, by - 4, 23, 15, 6, 4, basalt, { joints: 8, course: 3, seed: 6, top: '#4a4448' });
  // (The kiln-brick band round the lower step.)
  for (let x = CX - 23; x <= CX + 23; x++) {
    const yf = edge(CX, by - 4, 23, 15, x);
    if (yf === null) continue;
    const y = Math.floor(yf) + 2;
    const u = (x + 0.5 - CX) / 23;
    P.set(x, y, P.tone('#9a4a2c', 0.62 - u * 0.25 + ((x >> 1) % 2) * 0.08, x, y));
  }
  roundWall(P, CX, by - 9, 16, 10, 5, 3, basalt, { joints: 8, course: 3, seed: 7, top: '#4a4448' });
  // Ash drifted against the risers.
  for (let i = 0; i < 18; i++) {
    const x = CX - 20 + Math.floor(hash2(i, 3, 2) * 40);
    const y0 = edge(CX, by - 9, 16, 10, x);
    const y = y0 !== null && hash2(i, 4, 2) < 0.5 ? Math.floor(y0) + 4 : Math.floor(edge(CX, by - 4, 23, 15, x) ?? by) + 5;
    P.set(x, y, P.tone('#8a8284', 0.5 + hash2(i, 5, 2) * 0.3, x, y));
  }
}
// The great bowl of bronze on its foot, gone green in its hollows, a band
// of rays round its belly; `fill` paints what's in it.
function bowl(P, H, t, fill) {
  const by = H - 24;
  const bronze = '#b07a3a';
  const top = by - 26;
  // Its foot.
  P.tube(CX, by - 12, CX, top + 6, 3, 2.4, '#8a5a2a');
  P.blob(CX, by - 11, 6, 2.6, '#8a5a2a', { flat: 0.5 });
  // Its belly: a half-sphere under the rim.
  for (let y = top; y <= top + 9; y++) {
    const k = (y - top) / 9;
    const rx = 12 * Math.sqrt(Math.max(0, 1 - k * k * 0.92));
    for (let x = Math.floor(CX - rx); x <= Math.ceil(CX + rx); x++) {
      const u = (x + 0.5 - CX) / (rx + 0.3);
      if (Math.abs(u) > 1) continue;
      let lv = Paint.lum(u * 0.9, k * 0.6, Math.sqrt(Math.max(0, 1 - u * u)) * 0.8) + 0.08;
      // (A band of rays in relief, and the verdigris in the hollows.)
      if (y === top + 3 || y === top + 6) lv -= 0.15;
      if (y === top + 4 || y === top + 5) lv += ((x >> 1) % 2 ? 0.14 : -0.06);
      let c = P.tone(bronze, lv, x, y);
      if (hash2(x, y, 31) < 0.12 + k * 0.2 && lv < 0.5) c = mix(c, hex('#4a9a7a'), 0.55);
      P.set(x, y, c);
    }
  }
  // The rim, and what's in it.
  for (let y = top - 5; y <= top + 5; y++) {
    for (let x = CX - 13; x <= CX + 13; x++) {
      if (!inside(CX, top, 13, 4.6, x, y)) continue;
      if (inside(CX, top, 11, 3.4, x, y)) continue;
      const lv = 0.82 - ((x - CX) / 13) * 0.2 - ((y - top) / 4.6) * 0.12;
      P.set(x, y, P.tone(bronze, lv, x, y));
    }
  }
  fill(top);
  // Studs round the rim.
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * TAU + 0.3;
    const x = CX + Math.cos(a) * 12;
    const y = top + Math.sin(a) * 4;
    if (Math.sin(a) > -0.3) P.set(x, y, hex('#f0c070'));
  }
}

// The heartfire: the bowl full of coals and a great fire leaping from it
// (cold, and full of ash, where nobody tends it any more: st 0).
PIECES.heartfire = {
  h: 74,
  paint(P, t, st) {
    const H = 74;
    dais(P, H);
    bowl(P, H, t, (top) => {
      for (let y = top - 3; y <= top + 3; y++) {
        for (let x = CX - 11; x <= CX + 11; x++) {
          if (!inside(CX, top, 11, 3.4, x, y)) continue;
          const h = hash2(x, y, 41);
          if (st) {
            // Coals, glowing through.
            const glow = 0.5 + 0.5 * Math.sin(TAU * t * 2 + h * 6);
            P.set(x, y, hex(h < 0.35 ? '#2a1a14' : glow > 0.6 ? '#ffb040' : h < 0.7 ? '#e05a18' : '#8a2a10'));
          } else P.set(x, y, P.tone('#7a7274', 0.35 + h * 0.4, x, y));
        }
      }
    });
    outlineSel(P.p);
    const top = H - 24 - 26;
    if (st) {
      glow(P, CX, top - 12, 16, '#ff9a30', 0.18);
      fire(P, CX, top + 1, 26, 40, t, { n: 5, seed: 3, sparks: 8 });
      // (The heat's own light on the bowl's lip.)
      for (let x = CX - 10; x <= CX + 10; x++) P.fx(x, top - 3, '#ffd080', 0.35);
    } else {
      // A thread of smoke.
      for (let k = 0; k < 14; k++) P.fx(CX + Math.sin(TAU * t + k * 0.4) * (k / 5), top - 2 - k * 1.5, '#8a8488', 0.35 * (1 - k / 14));
    }
  },
};

// The heart-crystal: set in the bowl in bronze claws, a great six-sided
// spar of red glass with the fire in it, its light coming and going, and
// a ring of bronze runes turning about it (the ward).
PIECES.heart_crystal = {
  h: 84,
  paint(P, t) {
    const H = 84;
    dais(P, H);
    const top = H - 24 - 26;
    bowl(P, H, t, () => {
      for (let y = top - 3; y <= top + 3; y++) {
        for (let x = CX - 11; x <= CX + 11; x++) {
          if (!inside(CX, top, 11, 3.4, x, y)) continue;
          const h = hash2(x, y, 43);
          P.set(x, y, hex(h < 0.4 ? '#3a1a14' : h < 0.75 ? '#c84818' : '#ffa040'));
        }
      }
    });
    const pulse = 0.5 + 0.5 * Math.sin(TAU * t);
    const base = top + 1;
    const peak = 3;
    const R = 10;
    const ringY = peak + (base - peak) * 0.5;
    // The ring the runes run on: its far half behind the spar.
    const ring = (front) => {
      for (let i = 0; i < 96; i++) {
        const a = (i / 96) * TAU;
        if ((Math.sin(a) > 0) !== front) continue;
        P.fx(CX + Math.cos(a) * 19, ringY + Math.sin(a) * 5, '#e0a050', front ? 0.55 : 0.3);
      }
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU + TAU * t * 0.25;
        const s = Math.sin(a);
        if ((s > 0) !== front) continue;
        const x = Math.round(CX + Math.cos(a) * 19);
        const y = Math.round(ringY + s * 5);
        // A rune: a little bronze plate with a glowing mark on it.
        const lv = front ? 0.75 : 0.4;
        for (let dy = -2; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) P.set(x + dx, y + dy, P.tone('#b07a34', lv - dy * 0.06 - dx * 0.08, x + dx, y + dy));
        const g = front ? '#ffe0a0' : '#c87a40';
        if (i % 2) {
          P.set(x, y - 1, hex(g));
          P.set(x, y, hex(g));
        } else {
          P.set(x - 1, y - 1, hex(g));
          P.set(x + 1, y, hex(g));
        }
      }
    };
    ring(false);
    // The spar: three faces toward you, pointed at the top, the fire in
    // it rising in streaks and its heart breathing.
    for (let y = peak; y <= base; y++) {
      const k = (y - peak) / (base - peak);
      const hw = k < 0.26 ? Math.max(1, (k / 0.26) * R) : R - (k - 0.26) * 2;
      for (let x = Math.floor(CX - hw); x <= Math.ceil(CX + hw); x++) {
        const u = (x + 0.5 - CX) / Math.max(1, hw);
        if (Math.abs(u) > 1) continue;
        const face = u < -0.42 ? 0 : u > 0.42 ? 2 : 1;
        let lv = [0.8, 0.56, 0.32][face];
        const streak = frac(y * 0.16 + x * 0.04 - t * 2 + face * 0.3);
        if (streak < 0.1) lv += 0.2;
        const hd = Math.hypot((x + 0.5 - CX) / 5, (y - (peak + (base - peak) * 0.58)) / 10);
        let c = P.tone('#d8402a', lv, x, y);
        if (hd < 1) c = mix(c, hex(pulse > 0.5 ? '#fff4c0' : '#ffc060'), (1 - hd) * (0.5 + pulse * 0.45));
        if (Math.abs(Math.abs(u) - 0.42) < 0.08) c = mix(c, hex('#ffd8c0'), 0.4);
        if (k < 0.26 && u < 0 && u > -0.35) c = mix(c, hex('#fff0e8'), 0.35);
        P.set(x, y, c);
      }
    }
    // The bronze claws that hold it.
    for (const dx of [-8, 0, 8]) {
      P.tube(CX + dx * 1.15, top + 1, CX + dx * 0.95, top - 10, 1.5, 1, '#a8722e');
      P.set(CX + dx * 0.95, top - 11, hex('#f0c070'));
    }
    outlineSel(P.p);
    ring(true);
    // Its light about it, and motes of fire drifting up.
    glow(P, CX, ringY, 20, '#ff7040', 0.1 + pulse * 0.08);
    for (let i = 0; i < 7; i++) {
      const k = frac(t + i / 7);
      P.fx(CX + Math.sin(TAU * (k + i * 0.3)) * (5 + i * 1.5), base - 6 - k * 44, k < 0.5 ? '#ffd080' : '#ff8040', 0.85 * (1 - k));
    }
  },
};

// The Old Glowcap: a mushroom grown as tall as a house, its roots spread
// over the moss, its pale stalk fibrous and swollen at the foot and ringed
// with a frilled skirt, its broad cap the blue of the bog at night, spotted
// with lights that come and go, its gills glowing under it, its spores
// drifting down. Grown greater (st 1): the cap wider still, its gills and
// the veins of its stalk alight, shelves of fungus up the stalk, the
// spores thicker.
PIECES.great_glowcap = {
  h: 92,
  paint(P, t, st) {
    const H = 92;
    const by = H - 24;
    const big = !!st;
    const stalk = '#c8bccc';
    const capC = big ? '#3a4a8e' : '#2e3a74';
    const glowC = big ? '#a8f8ff' : '#7ae8ff';
    // Moss over the nine paces, and the roots running out over it.
    for (let y = by - 16; y <= H - 2; y++) {
      for (let x = 1; x < W - 1; x++) {
        if (!inside(CX, by - 2, 22, 16, x, y)) continue;
        const h = hash2(x, y, 51);
        // (Ragged at its edge.)
        if (!inside(CX, by - 2, 19, 13.5, x, y) && h < 0.5) continue;
        P.set(x, y, P.tone('#4a6a3a', 0.35 + h * 0.3 - ((y - by) / 16) * 0.1, x, y));
      }
    }
    for (let i = 0; i < 8; i++) {
      const a = Math.PI * (-0.15 + (i / 7) * 1.3);
      const len = 12 + hash2(i, 1, 8) * 8;
      const ex = CX + Math.cos(a) * len * 1.2;
      const ey = by - 4 + Math.sin(a) * len * 0.6;
      const mx = (CX + ex) / 2 + (hash2(i, 2, 8) - 0.5) * 4;
      const my = (by - 6 + ey) / 2 - 1;
      P.limb([[CX + Math.cos(a) * 5, by - 6, 2.6], [mx, my, 1.8], [ex, ey, 0.8]], '#8a7a86');
    }
    for (let i = 0; i < 30; i++) {
      const x = CX - 18 + hash2(i, 2, 9) * 36;
      const y = by - 12 + hash2(i, 3, 9) * 22;
      if (inside(CX, by - 2, 19, 13.5, x, y)) P.set(x, y, P.tone('#6a9a50', 0.55 + hash2(i, 4, 9) * 0.4, x, y));
    }
    // The stalk: swollen at its foot, a little bent, fibrous.
    const top = big ? 28 : 32;
    P.blob(CX, by - 9, 9, 6, stalk);
    const pts = [];
    for (let k = 0; k <= 6; k++) {
      const v = k / 6;
      pts.push([CX + Math.sin(v * 2.4) * 2, by - 9 - v * (by - 9 - top), 7 - v * 2]);
    }
    P.limb(pts, stalk);
    P.over((x, y, c) => {
      if (y < top || y > by - 4 || Math.abs(x - CX) > 11) return null;
      if ((x * 3 + Math.floor(y / 7)) % 4 === 0 && hash2(x, y >> 2, 21) < 0.7) return shade(c, 0.88);
      return null;
    });
    if (big) {
      for (const [dx, y] of [[-7, by - 22], [6, by - 30], [-6, by - 38]]) P.blob(CX + dx, y, 4.2, 1.7, '#c89a5a', { flat: 0.5 });
    }
    // The skirt: a frilled ring hung round the stalk.
    const ry0 = top + (by - top) * 0.3;
    for (let x = CX - 9; x <= CX + 10; x++) {
      const yf = edge(CX + 1, ry0, 9, 3, x);
      if (yf === null) continue;
      const u = (x + 0.5 - CX) / 9;
      const fr = 2 + ((x * 7) % 3 === 0 ? 1 : 0);
      for (let k = -2; k < fr; k++) P.set(x, Math.floor(yf) + k, P.tone('#e4dce8', 0.66 - u * 0.25 - k * 0.07, x, Math.floor(yf) + k));
    }
    // The gills under the cap: the ring of them seen under its rim.
    const capY = top - 1;
    const crx = big ? 23.5 : 22;
    const gry = big ? 6 : 5;
    for (let y = Math.floor(capY - gry); y <= Math.ceil(capY + gry); y++) {
      for (let x = Math.floor(CX - crx); x <= Math.ceil(CX + crx); x++) {
        if (!inside(CX, capY, crx, gry, x, y)) continue;
        const a = Math.atan2((y - capY) / gry, (x + 0.5 - CX) / crx);
        const g = Math.floor((a / TAU) * 72 + 72) % 2;
        let c = P.tone('#8a7a9a', 0.35 + g * 0.2 - ((y - capY) / gry) * 0.12, x, y);
        c = mix(c, hex(glowC), big ? 0.4 + g * 0.15 : 0.12 + g * 0.1);
        P.set(x, y, c);
      }
    }
    // The cap: a broad dome, lit from the left, a paler band at its rim.
    const capH = big ? 27 : 23;
    for (let y = capY - capH; y <= capY + 1; y++) {
      const k = (capY + 1 - y) / (capH + 1);
      const hw = crx * Math.sqrt(Math.max(0, 1 - Math.pow(k, 2.2)));
      for (let x = Math.floor(CX - hw); x <= Math.ceil(CX + hw); x++) {
        const u = (x + 0.5 - CX) / Math.max(1, hw);
        if (Math.abs(u) > 1) continue;
        const nx = u * Math.sqrt(1 - k * k * 0.5);
        const ny = -k;
        const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny * 0.6));
        let lv = Paint.lum(nx, ny, nz) + 0.04;
        if (k < 0.1) lv += 0.08;
        // (Fine streaks running down from its crown.)
        if (hash2(Math.round(u * 20), 3, 61) < 0.25 && k > 0.15) lv -= 0.06;
        P.set(x, y, P.tone(capC, lv, x, y));
      }
    }
    // Its spots, round and pale, glowing (each breathing in its own time).
    const spots = big ? 15 : 12;
    for (let i = 0; i < spots; i++) {
      const u = hash2(i, 1, 13) * 1.7 - 0.85;
      const k = 0.14 + hash2(i, 2, 13) * 0.72;
      const hw = crx * Math.sqrt(Math.max(0, 1 - Math.pow(k, 2.2)));
      const x = CX + u * hw;
      const y = capY + 1 - k * (capH + 1);
      const r = 1 + hash2(i, 3, 13) * (big ? 2.2 : 1.8);
      const br = 0.5 + 0.5 * Math.sin(TAU * (t + hash2(i, 4, 13)));
      for (let yy = Math.floor(y - r); yy <= Math.ceil(y + r); yy++) {
        for (let xx = Math.floor(x - r * 1.3); xx <= Math.ceil(x + r * 1.3); xx++) {
          if (Math.hypot((xx + 0.5 - x) / 1.3, yy + 0.5 - y) > r) continue;
          if (P.get(xx, yy)[3] === 0) continue;
          const edgeK = Math.hypot((xx + 0.5 - x) / 1.3, yy + 0.5 - y) / r;
          P.set(xx, yy, mix(hex(edgeK < 0.5 ? '#f0fcff' : '#c8f0ff'), hex(glowC), 0.25 + br * 0.45));
        }
      }
    }
    // Little glowcaps about its foot.
    for (const [dx, dy, s] of [[-15, 1, 1], [-11, 5, 0.8], [13, 2, 1.1], [17, -2, 0.7], [8, 7, 0.75], [-18, -3, 0.65]]) {
      const x = CX + dx;
      const y = by + dy - 4;
      P.tube(x, y, x, y - 4 * s, 0.9, 0.7, stalk);
      P.blob(x, y - 4 * s, 2.6 * s, 1.8 * s, capC);
      P.set(x - 1, y - 5 * s, hex(glowC));
    }
    outlineSel(P.p);
    // Its glow, and the spores drifting.
    glow(P, CX, capY + 3, big ? 22 : 18, glowC, big ? 0.16 : 0.1);
    for (const [dx, dy, s] of [[-15, 1, 1], [13, 2, 1.1], [8, 7, 0.75]]) glow(P, CX + dx, by + dy - 8 * s, 3, glowC, 0.3);
    const n = big ? 16 : 9;
    for (let i = 0; i < n; i++) {
      const ph = hash2(i, 5, 13);
      const k = frac(t + ph);
      const x = CX + (hash2(i, 6, 13) - 0.5) * 44 + Math.sin(TAU * (k * 2 + ph)) * 2;
      const y = capY + 4 + k * 38;
      if (y > H - 2) continue;
      P.fx(x, y, glowC, (1 - k) * 0.9);
    }
  },
};

// The conch fountain: a low ring of pale coral rock set with shells, the
// water in it green as the shallows; a spire of branching coral in the
// middle, and on its top a great conch, tipped toward you, pouring the
// water out of its mouth into the pool. Pearls are set in the coral (st 1:
// alight).
PIECES.conch_fountain = {
  h: 80,
  paint(P, t, st) {
    const H = 80;
    const by = H - 24;
    const lit = !!st;
    roundWall(P, CX, by - 5, 22, 14, 6, 3, '#c8b8a0', { joints: 11, course: 3, seed: 9, top: '#e4d8c4' });
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * TAU + 0.2;
      const x = CX + Math.cos(a) * 20.5;
      const y = by - 5 + Math.sin(a) * 12.7;
      P.set(x, y, hex(i % 3 ? '#f4c8b8' : '#fff0e8'));
      P.set(x + 1, y, hex('#d89a88'));
    }
    water(P, CX, by - 5, 19, 11, t, { col: '#3aa8a0', rings: 4, glow: lit ? '#80fff0' : null, glowK: 0.18 });
    // The spire: staghorn coral, branching, pink running to orange tips.
    const coral = '#e07868';
    P.blob(CX, by - 6, 5, 2.4, '#c86858', { flat: 0.5 });
    P.limb([[CX, by - 6, 3.4], [CX - 1, by - 18, 2.8], [CX + 1, by - 30, 2.4]], coral);
    const branches = [
      [[CX - 1, by - 14, 2], [CX - 6, by - 19, 1.6], [CX - 9, by - 26, 1.2]],
      [[CX, by - 19, 1.9], [CX + 5, by - 23, 1.5], [CX + 8, by - 30, 1.1]],
      [[CX - 6, by - 19, 1.3], [CX - 11, by - 21, 0.9]],
      [[CX + 5, by - 23, 1.2], [CX + 10, by - 24, 0.9]],
      [[CX - 1, by - 24, 1.5], [CX - 5, by - 30, 1]],
    ];
    for (const b of branches) {
      P.limb(b, coral);
      const [ex, ey, er] = b[b.length - 1];
      P.blob(ex, ey, er + 0.4, er + 0.4, '#f8a878');
    }
    P.over((x, y, c) => (Math.abs(x - CX) < 13 && y > by - 34 && y < by - 4 && hash2(x, y, 17) < 0.14 ? shade(c, 0.8) : null));
    const pearls = [[-2, by - 11], [2, by - 21], [-6, by - 20], [6, by - 26], [-4, by - 28]];
    for (const [dx, y] of pearls) {
      P.set(CX + dx, y, hex(lit ? '#f8fffe' : '#f4f0ec'));
      P.set(CX + dx + 1, y, hex(lit ? '#b0fff4' : '#c8c0c0'));
      P.set(CX + dx, y + 1, hex(lit ? '#90e8e0' : '#b8b0b0'));
    }
    // The conch, perched on the coral: its spire of whorls up to the right,
    // knobbed at the shoulder, its body whorl banded, and the flared pink
    // lip of its mouth turned down to the left.
    const cx = CX + 2;
    const cy = by - 39;
    const shell = '#ecd2b0';
    // (The whorls of its spire, smaller and smaller.)
    const whorls = [[cx + 7, cy - 6, 4.6, 3.6], [cx + 11, cy - 9.5, 3.2, 2.6], [cx + 14, cy - 12, 2, 1.7], [cx + 15.5, cy - 13.5, 1, 1]];
    for (let i = whorls.length - 1; i >= 0; i--) {
      const [x, y, rx, ry] = whorls[i];
      P.blob(x, y, rx, ry, shell);
      // (The groove of the spiral along each.)
      for (let a = 0.4; a < 2.6; a += 0.12) P.set(x + Math.cos(a) * rx * 0.8, y + Math.sin(a) * ry * 0.75, P.tone(shell, 0.25, x, y));
    }
    // The body whorl.
    P.blob(cx, cy, 10, 7.5, shell);
    P.over((x, y, c) => {
      if (!inside(cx, cy, 10, 7.5, x, y)) return null;
      const band = frac(((x - cx) * 0.55 - (y - cy) * 0.8) * 0.16);
      return band < 0.18 ? mix(c, hex('#b07850'), 0.45) : null;
    });
    // Knobs along its shoulder.
    for (let i = 0; i < 5; i++) {
      const a = -2.5 + i * 0.42;
      P.blob(cx + Math.cos(a) * 9.4, cy + Math.sin(a) * 7, 1.4, 1.3, '#f8e4c8');
    }
    // Its mouth: the flared lip, pink, the dark of the shell inside it.
    P.blob(cx - 8, cy + 4, 6, 4.6, '#f4b0a0');
    P.blob(cx - 8.6, cy + 4.8, 3.6, 2.8, '#b05a5a');
    P.set(cx - 10, cy + 3, hex('#ffe0d8'));
    outlineSel(P.p);
    // The water pours from its mouth, in a thick rope, into the pool.
    fall(P, cx - 11, cy + 6, cx - 13, by - 9, t, { wide: true, lite: lit ? '#e0fff8' : '#e0f6ff', mid: lit ? '#70e8d8' : '#68c0d8' });
    fall(P, cx - 9, cy + 7, cx - 10, by - 8, t + 0.33, { lite: '#e0f6ff', mid: '#58b0c8' });
    if (lit) {
      for (const [dx, y] of pearls) glow(P, CX + dx, y, 3, '#c0fff4', 0.45);
      glow(P, CX, by - 6, 18, '#80fff0', 0.08);
    }
  },
};

export const PIECE_NAMES = Object.keys(PIECES);
export const pieceHeight = (name) => (PIECES[name] ? PIECES[name].h : 0);
// (Round 68) More of them, painted elsewhere (see farpieces.js), with the
// painter's helpers here.
export function addPieces(more) {
  for (const [k, d] of Object.entries(more)) {
    if (!PIECES[k]) PIECE_NAMES.push(k);
    PIECES[k] = d;
  }
}
export const PIECE_KIT = { edge, inside, frac, roundWall, water, fall, fire, glow, W, CX, TAU };

// One frame of a great thing (f of PIECE_FRAMES) in a state, as pixels.
export function paintPiece(name, f = 0, st = 0) {
  const d = PIECES[name];
  if (!d) return null;
  const P = new Paint(W, d.h);
  d.paint(P, (f % PIECE_FRAMES) / PIECE_FRAMES, st ? 1 : 0);
  return P.p;
}

// The same, ready to draw (kept).
const cache = new Map();
export function pieceFrame(name, f, st) {
  const k = `${name}|${f}|${st ? 1 : 0}`;
  let c = cache.get(k);
  if (c) return c;
  const p = paintPiece(name, f, st);
  c = document.createElement('canvas');
  c.width = p.w;
  c.height = p.h;
  c.getContext('2d').putImageData(p.toImageData(), 0, 0);
  cache.set(k, c);
  return c;
}

// ---------------------------------------------------------------- the ward
// The ember ward (see tech.ember_ward, game.wards): over each town that has
// raised it, a dome of heat as wide as the town, seen through: the
// faintest warmth over all it covers, its crown's edge bright where it's
// seen side on; where it comes down to the ground, a curtain of shimmering
// heat rising, waves of light running round it; a shaft of light going up
// from the heart-crystal into it; embers drifting up inside it; and where
// burning rock strikes it, a ring of fire spreading out from the blow.
// Drawn over the lit world, so it glows at night.
const WARD_H = 0.75; // its height, as a share of its reach
const CURTAIN = 30; // how high the heat-curtain shows at its foot (pixels)
let curtainImg = null;
function curtain() {
  if (curtainImg) return curtainImg;
  const c = document.createElement('canvas');
  c.width = 1;
  c.height = CURTAIN;
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0, CURTAIN, 0, 0);
  g.addColorStop(0, 'rgba(255,190,110,0.9)');
  g.addColorStop(0.25, 'rgba(255,150,70,0.45)');
  g.addColorStop(1, 'rgba(255,120,50,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 1, CURTAIN);
  curtainImg = c;
  return c;
}
export function drawWards(r, ctx, game) {
  const list = !game.dungeon && game.wards ? game.wards() : null;
  if (!list || !list.length) return;
  const t = r.time;
  const k = Math.sqrt(1 + WARD_H * WARD_H);
  const img = curtain();
  ctx.save();
  for (const w of list) {
    const g = r.worldToScreen(w.cx, GROUND - 1, w.cz);
    const gx = g.x + 8;
    const gy = g.y + 8;
    const R = w.r * 16;
    if (gx + R < 0 || gx - R > r.vw || gy + R + CURTAIN < 0 || gy - R * k > r.vh) continue;
    // Its body: the faintest warmth over everything under it.
    ctx.globalAlpha = 0.05 + 0.015 * Math.sin(t * 1.3);
    ctx.fillStyle = '#ff9a50';
    ctx.beginPath();
    ctx.ellipse(gx, gy, R, R * k, 0, Math.PI, Math.PI * 2);
    ctx.ellipse(gx, gy, R, R, 0, 0, Math.PI);
    ctx.fill();
    // Its crown's edge, where it shows against what's beyond it.
    ctx.fillStyle = '#ffc878';
    const x0 = Math.max(-R, -gx);
    const x1 = Math.min(R, r.vw - gx);
    for (let X = Math.ceil(x0); X <= x1; X++) {
      const rho = Math.sqrt(Math.max(0, R * R - X * X));
      const top = Math.round(gy - rho * k);
      if (top < -2 || top > r.vh) continue;
      const sh = 0.5 + 0.5 * Math.sin(t * 2.2 - X * 0.09);
      ctx.globalAlpha = 0.25 + sh * 0.25;
      ctx.fillRect(Math.round(gx + X), top, 1, 1);
      ctx.globalAlpha = 0.08 + sh * 0.06;
      ctx.fillRect(Math.round(gx + X), top + 1, 1, 3);
    }
    // Its foot: a curtain of heat rising from the ground all round, waves
    // of light running round it.
    const n = Math.ceil(Math.PI * 2 * R);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const sx = Math.round(gx + Math.cos(a) * R);
      const sy = Math.round(gy + Math.sin(a) * R);
      if (sx < 0 || sx >= r.vw || sy < 0 || sy - CURTAIN > r.vh) continue;
      const wave = 0.5 + 0.5 * Math.sin(a * R * 0.05 - t * 3) * Math.sin(a * R * 0.013 + t * 0.7);
      const h = Math.round(CURTAIN * (0.55 + 0.45 * wave));
      ctx.globalAlpha = (Math.sin(a) > 0 ? 0.32 : 0.18) * (0.5 + wave * 0.6);
      ctx.drawImage(img, 0, CURTAIN - h, 1, h, sx, sy - h, 1, h);
    }
    // The shaft of light from the heart-crystal (its point is 37 pixels
    // over the top of its pace: see heart_crystal above), pulses running
    // up it.
    const c = r.worldToScreen(w.cx, GROUND, w.cz);
    const bx = Math.round(c.x + 8);
    const by = Math.round(c.y - 37);
    if (bx > -8 && bx < r.vw + 8 && by > 0) {
      const top = Math.max(0, Math.round(gy - R * WARD_H));
      for (let y = by; y >= top; y--) {
        const f = (by - y) / Math.max(1, by - top);
        const pulse = ((by - y) * 0.04 - t * 1.6) % 1;
        const p = pulse < 0 ? pulse + 1 : pulse;
        const lit = p < 0.12 ? 0.35 : 0;
        ctx.fillStyle = '#ffe0a0';
        ctx.globalAlpha = (0.32 + lit) * (1 - f * 0.85);
        ctx.fillRect(bx - 1, y, 2, 1);
        ctx.fillStyle = '#ff9040';
        ctx.globalAlpha = (0.1 + lit * 0.3) * (1 - f);
        ctx.fillRect(bx - 3, y, 6, 1);
      }
      // (Where it meets the crown, a soft bloom.)
      ctx.globalAlpha = 0.18 + 0.08 * Math.sin(t * 2);
      ctx.fillStyle = '#ffc070';
      ctx.beginPath();
      ctx.ellipse(bx, top, 10, 4, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // Embers drifting up inside it, about where you are.
    ctx.fillStyle = '#ffb060';
    for (let i = 0; i < 46; i++) {
      const u = (i * 0.618034) % 1;
      const v = (i * 0.414214) % 1;
      const kk = (t * (0.12 + (i % 5) * 0.02) + i * 0.137) % 1;
      const px = Math.round(u * r.vw + Math.sin(t * 0.8 + i) * 6);
      const py = Math.round(((v - kk * 0.35) % 1 + 1) % 1 * r.vh);
      // (Only within it.)
      const X = px - gx;
      const Z = py - gy;
      if (X * X + Z * Z > R * R * 1.1) continue;
      ctx.globalAlpha = 0.5 * Math.sin(kk * Math.PI);
      ctx.fillRect(px, py, 1, 1);
    }
  }
  // Where burning rock struck it: a ring of fire spreading from the blow.
  const hits = game.wardHits;
  if (hits && hits.length) {
    for (let i = hits.length - 1; i >= 0; i--) {
      const h = hits[i];
      const age = t - h.t0;
      if (age > 0.9 || age < 0) {
        hits.splice(i, 1);
        continue;
      }
      const p = r.worldToScreen(h.x, h.y, h.z);
      const rad = 3 + age * 26;
      ctx.globalAlpha = 0.7 * (1 - age / 0.9);
      ctx.strokeStyle = '#ffb050';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(p.x + 8, p.y + 8, rad, rad * 0.6, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 0.5 * (1 - age / 0.9);
      ctx.fillStyle = '#fff0c0';
      ctx.fillRect(Math.round(p.x + 6), Math.round(p.y + 6), 4, 3);
    }
  }
  ctx.restore();
}
