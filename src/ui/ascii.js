// Character-grid UI primitives. Everything in the UI is a cell with a glyph,
// a foreground and an optional background, drawn with the bitmap font.
// Grids can be drawn with a dissolve/reform animation: each cell has its own
// threshold and flickers through noise glyphs before settling.
import { CHAR_W, CHAR_H } from '../config.js';
import { drawChar, drawText } from '../render/font.js';
import { itemIcon } from '../render/sprites.js';
import { hash4 } from '../util/rng.js';

export const C = {
  fg: '#e8d8b0',
  dim: '#8a7a62',
  faint: '#4e4638',
  hi: '#ffe070',
  cyan: '#70e0e0',
  red: '#ff5a50',
  green: '#80e070',
  blue: '#80a8ff',
  purple: '#c090ff',
  orange: '#ffa050',
  white: '#f4ecd8',
  gray: '#8a8490',
  border: '#c8a060',
  bg: 'rgba(12,10,18,0.93)',
  bg2: 'rgba(34,28,40,0.95)',
  bgHi: 'rgba(90,70,30,0.9)',
  bgSel: 'rgba(40,70,90,0.9)',
};

const GLITCH = '░▒▓#%&@*+=:;.<>/\\|?!$';

export class Grid {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.ch = new Array(w * h);
    this.fg = new Array(w * h);
    this.bg = new Array(w * h);
    this.icons = [];
    this.images = [];
    this.clear();
  }

  clear(bg = null) {
    this.ch.fill(' ');
    this.fg.fill(C.fg);
    this.bg.fill(bg);
    this.icons.length = 0;
    this.images.length = 0;
  }

  put(x, y, ch, fg = null, bg = undefined) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = y * this.w + x;
    this.ch[i] = ch;
    if (fg) this.fg[i] = fg;
    if (bg !== undefined) this.bg[i] = bg;
  }

  text(x, y, str, fg = C.fg, bg = undefined, maxW = 999) {
    str = String(str);
    for (let i = 0; i < str.length && i < maxW; i++) this.put(x + i, y, str[i], fg, bg);
    return Math.min(str.length, maxW);
  }

  center(y, str, fg = C.fg, bg = undefined, x0 = 0, w = this.w) {
    this.text(x0 + Math.floor((w - str.length) / 2), y, str, fg, bg);
  }

  fill(x, y, w, h, ch = ' ', fg = C.fg, bg = undefined) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.put(x + i, y + j, ch, fg, bg);
  }

  box(x, y, w, h, o = {}) {
    const fg = o.fg || C.border;
    const d = o.double;
    const [tl, tr, bl, br, hz, vt] = d ? ['╔', '╗', '╚', '╝', '═', '║'] : ['┌', '┐', '└', '┘', '─', '│'];
    if (o.bg !== undefined) this.fill(x, y, w, h, ' ', fg, o.bg);
    for (let i = 1; i < w - 1; i++) {
      this.put(x + i, y, hz, fg);
      this.put(x + i, y + h - 1, hz, fg);
    }
    for (let j = 1; j < h - 1; j++) {
      this.put(x, y + j, vt, fg);
      this.put(x + w - 1, y + j, vt, fg);
    }
    this.put(x, y, tl, fg);
    this.put(x + w - 1, y, tr, fg);
    this.put(x, y + h - 1, bl, fg);
    this.put(x + w - 1, y + h - 1, br, fg);
    if (o.title) {
      const t = ` ${o.title} `;
      const tx = x + Math.max(1, Math.floor((w - t.length) / 2));
      this.text(tx, y, t, o.titleFg || C.hi);
    }
  }

  icon(x, y, key, count = 0, px = 1, py = 0) {
    this.icons.push({ x, y, key, count, px, py });
  }

  image(x, y, canvas, px = 0, py = 0) {
    this.images.push({ x, y, canvas, px, py });
  }
}

export function wrap(text, width) {
  const words = String(text).split(' ');
  const lines = [];
  let cur = '';
  for (const w of words) {
    if (!cur.length) cur = w;
    else if (cur.length + 1 + w.length <= width) cur += ' ' + w;
    else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur.length) lines.push(cur);
  return lines;
}

// Draw a grid at cell offset (ox, oy). `p` in [0,1] is the reveal amount
// (1 = fully formed). Cells below their threshold are hidden; cells near it
// show random glyphs, giving the dissolve/reform effect.
export function drawGrid(ctx, g, ox, oy, p = 1, seed = 0, time = 0) {
  const full = p >= 1;
  const frame = Math.floor(time * 30);
  // Backgrounds (merged into horizontal runs).
  for (let y = 0; y < g.h; y++) {
    let runStart = -1;
    let runColor = null;
    for (let x = 0; x <= g.w; x++) {
      let col = null;
      if (x < g.w) {
        const i = y * g.w + x;
        col = g.bg[i];
        if (col && !full) {
          const th = cellThreshold(x, y, seed);
          if (p < th) col = null;
        }
      }
      if (col !== runColor) {
        if (runColor) {
          ctx.fillStyle = runColor;
          ctx.fillRect((ox + runStart) * CHAR_W, (oy + y) * CHAR_H, (x - runStart) * CHAR_W, CHAR_H);
        }
        runColor = col;
        runStart = x;
      }
    }
  }
  // Glyphs.
  for (let y = 0; y < g.h; y++) {
    for (let x = 0; x < g.w; x++) {
      const i = y * g.w + x;
      let ch = g.ch[i];
      let fg = g.fg[i];
      if (!full) {
        const th = cellThreshold(x, y, seed);
        if (p < th) continue;
        if (p < th + 0.28) {
          if (ch === ' ' && !g.bg[i]) continue;
          ch = GLITCH[hash4(x, y, frame, seed) % GLITCH.length];
          fg = (hash4(x, y, frame + 1) & 3) === 0 ? C.hi : fg;
        }
      }
      if (ch === ' ') continue;
      drawChar(ctx, ch, (ox + x) * CHAR_W, (oy + y) * CHAR_H, fg);
    }
  }
  // Pixel content (item icons, minimaps) appears once the cells have formed.
  if (p > 0.82) {
    ctx.globalAlpha = full ? 1 : (p - 0.82) / 0.18;
    for (const im of g.images) ctx.drawImage(im.canvas, (ox + im.x) * CHAR_W + im.px, (oy + im.y) * CHAR_H + im.py);
    for (const ic of g.icons) {
      const px = (ox + ic.x) * CHAR_W + ic.px;
      const py = (oy + ic.y) * CHAR_H + ic.py;
      ctx.drawImage(itemIcon(ic.key), px, py);
      if (ic.count > 1) {
        const s = ic.count > 999 ? '999' : String(ic.count);
        drawText(ctx, s, px + 17 - s.length * CHAR_W, py + 9, C.white, '#000');
      }
    }
    ctx.globalAlpha = 1;
  }
}

export function cellThreshold(x, y, seed) {
  // Mostly random with a slight top-left to bottom-right sweep.
  return (hash4(x, y, seed) % 1000) / 1000 * 0.52 + (x + y * 2) * 0.0012;
}
