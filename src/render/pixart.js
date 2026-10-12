// (Round 95) Pixel art drawn by hand: a picture as rows of characters,
// each one a colour from its palette ('.' or ' ' clear), as a pixel artist
// lays it down: the silhouette, the colours of each stuff, its texture,
// its light and shade, then its outline and highlights, every pixel of it
// placed. For the creatures, props, floors and walls of the old places,
// and their masters (see forge.js: a master drawn so wears its picture
// instead of being sculpted).
//
// A sheet of frames is a base picture and, for each frame, only the rows
// that change from it (`{ 20: '..##..', ... }`), or a whole picture of its
// own.
import { Px, hex, shade, mix } from './pixel.js';

// Rows of `def.rows` (strings, all as long as the first) in `def.pal`'s
// colours into a picture. `def.w`/`def.h` pad it (centred across, set on
// the bottom) when it's drawn smaller than its frame.
export function grid(def, rows = def.rows) {
  const w = def.w || Math.max(...rows.map((r) => r.length));
  const h = def.h || rows.length;
  const p = new Px(w, h);
  const ox = Math.floor((w - Math.max(...rows.map((r) => r.length))) / 2) + (def.ox || 0);
  const oy = h - rows.length + (def.oy || 0);
  const pal = palOf(def.pal);
  for (let y = 0; y < rows.length; y++) {
    const r = rows[y];
    for (let x = 0; x < r.length; x++) {
      const ch = r[x];
      if (ch === '.' || ch === ' ') continue;
      const c = pal[ch];
      if (!c) continue;
      p.set(ox + x, oy + y, c.rgb, c.a);
    }
  }
  return p;
}

// A palette of hex strings (or [hex, alpha]) by character, as rgb.
const PALS = new WeakMap();
function palOf(pal) {
  let out = PALS.get(pal);
  if (out) return out;
  out = {};
  for (const [k, v] of Object.entries(pal)) {
    const [c, a] = Array.isArray(v) ? v : [v, 255];
    out[k] = { rgb: hex(c), a };
  }
  PALS.set(pal, out);
  return out;
}

// A frame of a sheet: its base with the frame's own rows put over it.
export function frameRows(def, f) {
  const fr = def.frames ? def.frames[f] : null;
  if (!fr) return def.rows;
  if (Array.isArray(fr)) return fr;
  const rows = [...def.rows];
  for (const [k, v] of Object.entries(fr)) rows[+k] = v;
  return rows;
}
export const frameOf = (def, f) => grid(def, frameRows(def, f));

// What's wrong with a picture's rows (for the tests): rows of another
// length, characters not in its palette.
export function lint(def, name = '?') {
  const bad = [];
  const pal = def.pal || {};
  const n = def.frames ? def.frames.length : 1;
  for (let f = 0; f < n; f++) {
    const rows = frameRows(def, f);
    const w = rows[0].length;
    rows.forEach((r, y) => {
      if (r.length !== w) bad.push(`${name} frame ${f} row ${y}: ${r.length} long, not ${w}`);
      for (const ch of r) if (ch !== '.' && ch !== ' ' && !pal[ch]) bad.push(`${name} frame ${f} row ${y}: '${ch}' not in its palette`);
    });
    if (def.h && rows.length > def.h) bad.push(`${name} frame ${f}: ${rows.length} rows, more than ${def.h}`);
  }
  return bad;
}

// A colour ramp for a stuff, dark to light: its shadow, its body, its
// light (and a deeper shadow and a highlight), each a little toward its
// own hue's cool or warm side, as a painter would (shadows cooler, lights
// warmer).
export function ramp(base, n = 5) {
  const c = hex(base);
  const cool = [40, 50, 90];
  const warm = [255, 240, 200];
  const out = [];
  for (let i = 0; i < n; i++) {
    const k = i / (n - 1);
    const f = 0.45 + k * 0.9;
    let v = shade(c, f);
    v = k < 0.5 ? mix(v, cool, (0.5 - k) * 0.35) : mix(v, warm, (k - 0.5) * 0.3);
    out.push(`#${v.map((q) => Math.max(0, Math.min(255, Math.round(q))).toString(16).padStart(2, '0')).join('')}`);
  }
  return out;
}

// An outline put round a picture's edge where it hasn't one: each clear
// pixel beside the picture takes the darkest colour beside it, darker
// still (a selective outline: never flat black). `bottom` darker under it
// and to its right, where the light doesn't reach.
export function selout(p, k = 0.45) {
  const w = p.w;
  const h = p.h;
  const add = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (p.alpha(x, y) > 0) continue;
      let best = null;
      let bl = 999;
      for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + ox;
        const ny = y + oy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h || p.alpha(nx, ny) < 200) continue;
        const c = p.get(nx, ny);
        const l = c[0] * 0.3 + c[1] * 0.59 + c[2] * 0.11;
        if (l < bl) {
          bl = l;
          best = c;
        }
      }
      if (best) add.push([x, y, shade(best, k * (y > h / 2 ? 0.8 : 1))]);
    }
  }
  for (const [x, y, c] of add) p.set(x, y, c);
  return p;
}

// A picture as a creature's look (see sprites.CREATURE_LOOKS): its frames,
// square, and which of them it walks, stands, strikes and flinches with
// (see sprites.lookFrame): `groups` { walk: [first, n, seconds], ... }.
// `variant` (see VARIANTS) the same thing as another land makes it.
export function lookOf(def) {
  const n = def.frames ? def.frames.length : 1;
  const cache = new Map();
  return {
    frames: n,
    size: def.size,
    groups: def.groups || null,
    draw(f, variant = 0) {
      const k = `${f}:${variant}`;
      let p = cache.get(k);
      if (!p) {
        const pal = variant && VARIANTS[variant] ? recolour(def.pal, VARIANTS[variant]) : def.pal;
        cache.set(k, (p = frameOf({ ...def, pal, w: def.size, h: def.size }, f)));
      }
      return p.copy();
    },
  };
}

// The lands' own looks for the same thing: what everything of it is
// washed toward (`wash`, how far), and the colour of its lights (anything
// bright and strongly coloured: an eye, a flame) instead.
//   1: ash (black with soot, the light in it embers);
//   2: peat (stained bog-brown, its light marsh-green);
//   3: frost (rimed pale, its light white-blue).
export const VARIANTS = {
  1: { wash: [34, 28, 26], k: 0.32, glow: [255, 140, 50] },
  2: { wash: [58, 66, 34], k: 0.24, glow: [190, 230, 90] },
  3: { wash: [196, 218, 236], k: 0.26, glow: [210, 240, 255] },
};
function recolour(pal, V) {
  const out = {};
  for (const [ch, v] of Object.entries(pal)) {
    const [c, a] = Array.isArray(v) ? v : [v, 255];
    const rgb = hex(c);
    const mx = Math.max(...rgb);
    const mn = Math.min(...rgb);
    const glow = mx > 180 && mx - mn > 70;
    const t = glow ? mix(V.glow, rgb, 0.2) : mix(rgb, V.wash, V.k);
    const h = `#${t.map((q) => Math.max(0, Math.min(255, Math.round(q))).toString(16).padStart(2, '0')).join('')}`;
    out[ch] = a === 255 ? h : [h, a];
  }
  return out;
}
