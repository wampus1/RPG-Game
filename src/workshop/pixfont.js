// The game's own lettering for the Workshop (round 63): its bitmap font
// (see render/font.js), every glyph traced into outlines and packed into a
// TrueType font in memory, so the Workshop's headings, tabs, buttons and
// menus can be set in it like any other font. Each pixel of a glyph is
// 128 units, a glyph's cell 6 by 8 pixels, so at 16px (or 24, 32) every
// pixel lands on whole screen pixels.
import { CHARSET, glyphBitmap } from '../render/font.js';
import { CHAR_W, CHAR_H } from '../config.js';

export const PIXEL_FONT = 'Tessera Pixel';
const U = 128; // units a pixel
const ASC = 7; // pixels above the baseline (the last row hangs below it)

// A few more the Workshop's text uses, drawn the font's way.
const EXTRA = {
  '’': "'", // ’
  '‘': "'", // ‘
  '“': '"', // “
  '”': '"', // ”
  '—': '......|......|......|######|......|......|......', // —
  '–': '.....|.....|.....|#####|.....|.....|.....', // –
  '▸': '.....|.#...|.##..|.###.|.##..|.#...|.....', // ▸
  '▾': '.....|.....|#####|.###.|..#..|.....|.....', // ▾
  '▴': '.....|.....|..#..|.###.|#####|.....|.....', // ▴
  '●': '.....|.###.|#####|#####|#####|.###.|.....', // ●
  '↔': '.....|.#.#.|#...#|#####|#...#|.#.#.|.....', // ↔
  '↕': '..#..|.###.|..#..|..#..|..#..|.###.|..#..', // ↕
  'é': '...#.|..#..|.###.|#...#|#####|#....|.###.', // é
  'è': '.#...|..#..|.###.|#...#|#####|#....|.###.', // è
  'à': '.#...|..#..|.###.|....#|.####|#...#|.####', // à
};

function bitmapOf(ch) {
  const e = EXTRA[ch];
  if (e === undefined) return glyphBitmap(ch);
  if (e.length === 1) return glyphBitmap(e);
  const bmp = new Uint8Array(CHAR_W * CHAR_H);
  e.split('|').forEach((row, y) => {
    for (let x = 0; x < row.length && x < CHAR_W; x++) if (row[x] === '#') bmp[y * CHAR_W + x] = 1;
  });
  return bmp;
}

// The outline of a glyph's pixels: closed loops of corner points (in
// pixels, y up from the baseline), clockwise round the ink (so holes go
// the other way), straight runs merged.
export function traceGlyph(bmp, w = CHAR_W, hgt = CHAR_H) {
  const on = (x, y) => x >= 0 && y >= 0 && x < w && y < hgt && bmp[y * w + x] === 1;
  // Edges, each from one corner to the next (corners in pixel units, y up).
  const edges = [];
  for (let r = 0; r < hgt; r++) {
    for (let c = 0; c < w; c++) {
      if (!on(c, r)) continue;
      const Y = ASC - 1 - r;
      if (!on(c - 1, r)) edges.push([c, Y, c, Y + 1]); // left, going up
      if (!on(c, r - 1)) edges.push([c, Y + 1, c + 1, Y + 1]); // top, going right
      if (!on(c + 1, r)) edges.push([c + 1, Y + 1, c + 1, Y]); // right, going down
      if (!on(c, r + 1)) edges.push([c + 1, Y, c, Y]); // bottom, going left
    }
  }
  const from = new Map();
  const key = (x, y) => `${x},${y}`;
  edges.forEach((e, i) => {
    const k = key(e[0], e[1]);
    if (!from.has(k)) from.set(k, []);
    from.get(k).push(i);
  });
  const used = new Uint8Array(edges.length);
  const loops = [];
  for (let i = 0; i < edges.length; i++) {
    if (used[i]) continue;
    const pts = [];
    let cur = i;
    while (cur >= 0 && !used[cur]) {
      used[cur] = 1;
      const e = edges[cur];
      pts.push([e[0], e[1]]);
      const outs = (from.get(key(e[2], e[3])) || []).filter((j) => !used[j]);
      if (!outs.length) break;
      // (Where two loops meet at a corner: keep turning the same way.)
      if (outs.length > 1) {
        const dx = e[2] - e[0];
        const dy = e[3] - e[1];
        outs.sort((a, b) => turnOf(dx, dy, edges[a]) - turnOf(dx, dy, edges[b]));
      }
      cur = outs[0];
    }
    // Straight runs made one.
    const out = [];
    for (let k = 0; k < pts.length; k++) {
      const p = pts[(k - 1 + pts.length) % pts.length];
      const q = pts[k];
      const n = pts[(k + 1) % pts.length];
      if ((q[0] - p[0]) * (n[1] - q[1]) - (q[1] - p[1]) * (n[0] - q[0]) !== 0) out.push(q);
    }
    if (out.length >= 3) loops.push(out);
  }
  return loops;
}
// (Right turns first: -1 right, 0 straight, 1 left.)
function turnOf(dx, dy, e) {
  const ex = e[2] - e[0];
  const ey = e[3] - e[1];
  return Math.sign(dx * ey - dy * ex);
}

// ------------------------------------------------------------ the font file
class Bin {
  constructor() {
    this.b = [];
  }
  u8(v) {
    this.b.push(v & 255);
    return this;
  }
  u16(v) {
    this.b.push((v >> 8) & 255, v & 255);
    return this;
  }
  i16(v) {
    return this.u16(v < 0 ? v + 65536 : v);
  }
  u32(v) {
    this.b.push((v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255);
    return this;
  }
  tag(s) {
    for (let i = 0; i < 4; i++) this.u8(s.charCodeAt(i));
    return this;
  }
  pad4() {
    while (this.b.length % 4) this.b.push(0);
    return this;
  }
  get length() {
    return this.b.length;
  }
}
const sum32 = (bytes) => {
  let s = 0;
  for (let i = 0; i < bytes.length; i += 4) s = (s + (((bytes[i] << 24) | ((bytes[i + 1] || 0) << 16) | ((bytes[i + 2] || 0) << 8) | (bytes[i + 3] || 0)) >>> 0)) >>> 0;
  return s;
};

// The font, as the bytes of a .ttf.
export function buildPixelFont() {
  const chars = [...new Set([...CHARSET, ...Object.keys(EXTRA)])].filter((c) => c.length === 1 && c.charCodeAt(0) >= 32 && c.charCodeAt(0) < 0xfffe);
  chars.sort((a, b) => a.charCodeAt(0) - b.charCodeAt(0));
  // Glyph 0 is .notdef (a hollow box); then one a character.
  const glyphs = [{ loops: [[[0, -1], [0, 7], [5, 7], [5, -1]], [[1, 0], [4, 0], [4, 6], [1, 6]]] }];
  for (const ch of chars) glyphs.push({ ch, loops: ch === ' ' ? [] : traceGlyph(bitmapOf(ch)) });
  const adv = CHAR_W * U;
  // glyf and loca.
  const glyf = new Bin();
  const loca = [];
  let maxPts = 0;
  let maxCont = 0;
  let fx0 = 0;
  let fy0 = 0;
  let fx1 = 0;
  let fy1 = 0;
  for (const g of glyphs) {
    loca.push(glyf.length);
    g.lsb = 0;
    if (!g.loops.length) continue;
    const pts = g.loops.flat();
    const xs = pts.map((p) => p[0] * U);
    const ys = pts.map((p) => p[1] * U);
    const x0 = Math.min(...xs);
    const y0 = Math.min(...ys);
    const x1 = Math.max(...xs);
    const y1 = Math.max(...ys);
    g.lsb = x0;
    fx0 = Math.min(fx0, x0);
    fy0 = Math.min(fy0, y0);
    fx1 = Math.max(fx1, x1);
    fy1 = Math.max(fy1, y1);
    maxPts = Math.max(maxPts, pts.length);
    maxCont = Math.max(maxCont, g.loops.length);
    glyf.i16(g.loops.length).i16(x0).i16(y0).i16(x1).i16(y1);
    let end = -1;
    for (const L of g.loops) {
      end += L.length;
      glyf.u16(end);
    }
    glyf.u16(0); // no instructions
    for (let i = 0; i < pts.length; i++) glyf.u8(1); // all on the curve
    let px = 0;
    for (const x of xs) {
      glyf.i16(x - px);
      px = x;
    }
    let py = 0;
    for (const y of ys) {
      glyf.i16(y - py);
      py = y;
    }
    glyf.pad4();
  }
  loca.push(glyf.length);
  const n = glyphs.length;
  const T = {};
  // head
  T.head = new Bin().u32(0x00010000).u32(0x00010000).u32(0).u32(0x5f0f3cf5).u16(0x000b).u16(CHAR_H * U)
    .u32(0).u32(0).u32(0).u32(0).i16(fx0).i16(fy0).i16(fx1).i16(fy1).u16(0).u16(8).i16(2).i16(1).i16(0);
  T.hhea = new Bin().u32(0x00010000).i16(ASC * U).i16(-(CHAR_H - ASC) * U).i16(0).u16(adv).i16(0).i16(0).i16(fx1)
    .i16(1).i16(0).i16(0).i16(0).i16(0).i16(0).i16(0).i16(0).u16(n);
  T.maxp = new Bin().u32(0x00010000).u16(n).u16(maxPts).u16(maxCont).u16(0).u16(0).u16(2).u16(0).u16(0).u16(0).u16(0).u16(0).u16(0).u16(0).u16(0);
  T.hmtx = new Bin();
  for (const g of glyphs) T.hmtx.u16(adv).i16(g.lsb);
  T.loca = new Bin();
  for (const o of loca) T.loca.u32(o);
  T.glyf = glyf;
  // cmap: format 4, runs of characters whose glyphs follow on.
  const segs = [];
  chars.forEach((ch, i) => {
    const c = ch.charCodeAt(0);
    const gid = i + 1;
    const last = segs[segs.length - 1];
    if (last && c === last.end + 1 && gid - c === last.delta) last.end = c;
    else segs.push({ start: c, end: c, delta: gid - c });
  });
  segs.push({ start: 0xffff, end: 0xffff, delta: 1 });
  const sc = segs.length;
  const sr = 2 * 2 ** Math.floor(Math.log2(sc));
  const sub = new Bin().u16(4).u16(16 + sc * 8).u16(0).u16(sc * 2).u16(sr).u16(Math.floor(Math.log2(sc))).u16(sc * 2 - sr);
  for (const s of segs) sub.u16(s.end);
  sub.u16(0);
  for (const s of segs) sub.u16(s.start);
  for (const s of segs) sub.u16((s.delta + 65536) % 65536);
  for (let i = 0; i < sc; i++) sub.u16(0);
  T.cmap = new Bin().u16(0).u16(1).u16(3).u16(1).u32(12);
  T.cmap.b.push(...sub.b);
  // OS/2 (version 4)
  const first = chars[0].charCodeAt(0);
  const lastC = chars[chars.length - 1].charCodeAt(0);
  T['OS/2'] = new Bin().u16(4).i16(adv).u16(400).u16(5).u16(0)
    .i16(512).i16(512).i16(0).i16(128).i16(512).i16(512).i16(0).i16(384).i16(U).i16(3 * U).i16(0);
  for (let i = 0; i < 10; i++) T['OS/2'].u8(0);
  T['OS/2'].u32(1).u32(0).u32(0).u32(0).tag('NONE').u16(0x0040).u16(first).u16(Math.min(0xffff, lastC))
    .i16(ASC * U).i16(-(CHAR_H - ASC) * U).i16(0).u16(ASC * U).u16((CHAR_H - ASC) * U).u32(1).u32(0)
    .i16(5 * U).i16(ASC * U).u16(0).u16(32).u16(1);
  T.post = new Bin().u32(0x00030000).u32(0).i16(-U).i16(U).u32(1).u32(0).u32(0).u32(0).u32(0);
  // name
  const names = [[1, PIXEL_FONT], [2, 'Regular'], [3, `${PIXEL_FONT} Regular`], [4, PIXEL_FONT], [5, 'Version 1.0'], [6, 'TesseraPixel-Regular']];
  const strs = names.map(([, s]) => {
    const b = [];
    for (const ch of s) b.push(0, ch.charCodeAt(0) & 255);
    return b;
  });
  T.name = new Bin().u16(0).u16(names.length).u16(6 + 12 * names.length);
  let off = 0;
  names.forEach(([id], i) => {
    T.name.u16(3).u16(1).u16(0x0409).u16(id).u16(strs[i].length).u16(off);
    off += strs[i].length;
  });
  for (const s of strs) T.name.b.push(...s);
  // The file: its table of tables, then each (on 4-byte boundaries).
  const tags = Object.keys(T).sort();
  const nt = tags.length;
  const esel = Math.floor(Math.log2(nt));
  const srange = 16 * 2 ** esel;
  const head = new Bin().u32(0x00010000).u16(nt).u16(srange).u16(esel).u16(nt * 16 - srange);
  let at = 12 + nt * 16;
  const body = [];
  const recs = [];
  for (const t of tags) {
    const bytes = T[t].b.slice();
    const len = bytes.length;
    while (bytes.length % 4) bytes.push(0);
    recs.push({ t, sum: sum32(bytes), at, len });
    body.push(bytes);
    at += bytes.length;
  }
  for (const r of recs) head.tag(r.t).u32(r.sum).u32(r.at).u32(r.len);
  const all = new Uint8Array(at);
  all.set(head.b, 0);
  let p = 12 + nt * 16;
  for (const b of body) {
    all.set(b, p);
    p += b.length;
  }
  // head's checkSumAdjustment: the whole file sums to B1B0AFBA.
  const hr = recs.find((r) => r.t === 'head');
  const adj = (0xb1b0afba - sum32(all)) >>> 0;
  all[hr.at + 8] = adj >>> 24;
  all[hr.at + 9] = (adj >>> 16) & 255;
  all[hr.at + 10] = (adj >>> 8) & 255;
  all[hr.at + 11] = adj & 255;
  return all;
}

// Load it into the page, once (it's ready a moment later; until then the
// text shows in the fallback).
let loading = null;
export function ensurePixelFont() {
  if (loading) return loading;
  loading = (async () => {
    try {
      const FF = window.FontFace;
      if (!FF || !document.fonts) return false;
      const face = new FF(PIXEL_FONT, buildPixelFont().buffer, { style: 'normal', weight: '400' });
      await face.load();
      document.fonts.add(face);
      return true;
    } catch (e) {
      console.warn('The Workshop\'s pixel font couldn\'t be made:', e);
      return false;
    }
  })();
  return loading;
}
