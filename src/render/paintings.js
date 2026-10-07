// (Round 73) Paintings (see game/displays.js): each a little picture of
// what the painter saw, made once for its subject and size and kept. A
// small one fills its frame's 10x9 canvas; a large one is a broad framed
// canvas of its own, 30 across, hung over its spot.
import { creatureSheet, headSprite, itemIcon } from './sprites.js';
import { makeLook } from '../entities/npcgen.js';
import { RNG } from '../util/rng.js';

const cache = new Map();

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

const SKIES = [['#7ab0e0', '#c8e0f0'], ['#e8a070', '#f8d8a0'], ['#30385a', '#6a6890'], ['#9ac0c8', '#e0e8e0']];
const GROUNDS = ['#5a8a3a', '#7a9a48', '#a89058', '#d8d8e0', '#486a3a'];

function sky(g, w, h, r) {
  const [a, b] = SKIES[r.int(0, SKIES.length - 1)];
  const gr = g.createLinearGradient(0, 0, 0, h);
  gr.addColorStop(0, a);
  gr.addColorStop(1, b);
  g.fillStyle = gr;
  g.fillRect(0, 0, w, h);
}

function px(g, x, y, w, h, c) {
  g.fillStyle = c;
  g.fillRect(Math.round(x), Math.round(y), Math.max(1, Math.round(w)), Math.max(1, Math.round(h)));
}

// The picture itself, w x h, of `sub`.
function paint(g, w, h, sub, seed) {
  const r = new RNG((sub.v * 2654435761 + seed) >>> 0);
  const fit = (img, sw, sh, cx, cy, scale) => {
    const k = Math.min(scale * w / sw, scale * h / sh);
    const dw = Math.max(1, Math.round(sw * k));
    const dh = Math.max(1, Math.round(sh * k));
    g.drawImage(img, 0, 0, sw, sh, Math.round(cx - dw / 2), Math.round(cy - dh / 2), dw, dh);
  };
  switch (sub.kind) {
    case 'beast': {
      sky(g, w, h, r);
      px(g, 0, h * 0.62, w, h, GROUNDS[r.int(0, GROUNDS.length - 1)]);
      let img = null;
      try {
        img = creatureSheet(sub.beast);
      } catch {
        img = null;
      }
      if (img) fit(img, img.height, img.height, w / 2, h * 0.58, 0.95);
      break;
    }
    case 'face': {
      const bg = ['#5a3a48', '#3a4a5a', '#4a5a3a', '#6a5030'][r.int(0, 3)];
      px(g, 0, 0, w, h, bg);
      px(g, 0, 0, w, 1, 'rgba(255,255,255,0.12)');
      const styles = ['vale', 'north', 'high', 'sun', 'wild', 'mist', 'tide', 'ember'];
      let look = null;
      try {
        look = makeLook(r, styles[r.int(0, styles.length - 1)], r.chance(0.2) ? 'elder' : 'adult', r.chance(0.3) ? 'noble' : 'farmer', null);
      } catch {
        look = null;
      }
      if (look) {
        const head = headSprite(look);
        // (Shoulders, in their best coat.)
        px(g, w * 0.18, h * 0.8, w * 0.64, h * 0.3, look.shirt || '#6a4a3a');
        fit(head, head.width, head.height, w / 2, h * 0.48, 0.85);
      }
      break;
    }
    case 'place': {
      sky(g, w, h, r);
      // Hills far off, a nearer one, a house or a tower on it, trees.
      const far = ['#7a8aa8', '#8a9ab0', '#9a8aa0'][r.int(0, 2)];
      for (let x = 0; x < w; x++) {
        const y1 = h * (0.45 + 0.12 * Math.sin(x / w * 5 + sub.v));
        px(g, x, y1, 1, h, far);
      }
      const near = GROUNDS[r.int(0, GROUNDS.length - 1)];
      for (let x = 0; x < w; x++) {
        const y2 = h * (0.68 + 0.08 * Math.sin(x / w * 3 + sub.v * 0.7));
        px(g, x, y2, 1, h, near);
      }
      const hx = r.int(2, Math.max(2, w - 6));
      const hy = Math.round(h * 0.6);
      if (r.chance(0.5)) {
        px(g, hx, hy - 3, 4, 3, '#d8c8a8');
        px(g, hx - 1, hy - 4, 6, 1, '#8a3a2a');
        px(g, hx + 1, hy - 1, 1, 1, '#3a2a1a');
      } else {
        px(g, hx + 1, hy - 6, 2, 6, '#a8a8b0');
        px(g, hx, hy - 7, 4, 1, '#6a6a78');
      }
      for (let i = 0; i < 3; i++) {
        const tx = r.int(0, w - 2);
        const ty = Math.round(h * 0.72) + r.int(-1, 1);
        px(g, tx, ty - 3, 2, 3, '#2a5a2a');
        px(g, tx, ty, 1, 1, '#4a3a2a');
      }
      if (r.chance(0.6)) px(g, w * 0.8, h * 0.12, 2, 2, '#fff0a0');
      break;
    }
    case 'map': {
      px(g, 0, 0, w, h, '#e8d8a8');
      px(g, 0, 0, w, 1, '#c8b080');
      px(g, 0, h - 1, w, 1, '#c8b080');
      // A coast or two, a dotted way, and an X.
      for (let i = 0; i < 2 + (w > 12 ? 2 : 0); i++) {
        const cx = r.int(1, w - 2);
        const cy = r.int(1, h - 2);
        const rr = r.int(1, Math.max(2, Math.round(w / 6)));
        for (let y = -rr; y <= rr; y++) for (let x = -rr; x <= rr; x++) if (x * x + y * y <= rr * rr + r.int(0, 1)) px(g, cx + x, cy + y, 1, 1, '#a8b878');
      }
      let x = 1;
      let y = r.int(1, h - 2);
      for (let i = 0; i < w; i += 2) {
        px(g, x, y, 1, 1, '#8a3a2a');
        x += 2;
        y = Math.max(1, Math.min(h - 2, y + r.int(-1, 1)));
      }
      px(g, x - 2, y - 1, 1, 1, '#c02020');
      px(g, x - 1, y, 1, 1, '#c02020');
      px(g, x - 3, y, 1, 1, '#c02020');
      px(g, x - 2, y + 1, 1, 1, '#c02020');
      break;
    }
    case 'sea': {
      sky(g, w, h, r);
      px(g, 0, h * 0.55, w, h, '#2a5a8a');
      for (let i = 0; i < w; i += 3) px(g, i + (sub.v % 3), h * 0.55 + r.int(1, Math.max(1, Math.round(h * 0.4))), 2, 1, '#a8d0f0');
      // A ship under sail.
      const sx = r.int(2, Math.max(2, w - 7));
      const sy = Math.round(h * 0.55);
      px(g, sx, sy - 1, 6, 2, '#5a3a20');
      px(g, sx + 2, sy - 6, 1, 5, '#3a2a1a');
      px(g, sx + 3, sy - 6, 2, 4, '#f0e8d8');
      break;
    }
    case 'still':
    case 'thing':
    default: {
      const cloth = ['#6a2a3a', '#2a3a6a', '#3a5a3a', '#5a4a2a'][r.int(0, 3)];
      px(g, 0, 0, w, h, cloth);
      px(g, 0, h * 0.7, w, h, '#7a5a3a');
      px(g, 0, h * 0.7, w, 1, '#a07a4a');
      const a = itemIcon(sub.thing || 'apple');
      if (sub.kind === 'still' && w > 12) {
        fit(a, 16, 16, w * 0.35, h * 0.55, 0.6);
        fit(itemIcon(sub.thing2 || 'bread'), 16, 16, w * 0.68, h * 0.6, 0.55);
      } else fit(a, 16, 16, w / 2, h * 0.52, 0.85);
      break;
    }
  }
}

// A small painting's canvas (10 x 9), or a large one framed whole (30 x 20).
export function paintingArt(sub, size, seed = 0) {
  const key = `${size}:${sub.kind}:${sub.v}:${sub.beast || sub.thing || ''}`;
  let c = cache.get(key);
  if (c) return c;
  if (size === 'large') {
    c = canvas(30, 20);
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    // The gilt frame.
    px(g, 0, 0, 30, 20, '#b08a30');
    px(g, 0, 0, 30, 1, '#e8c860');
    px(g, 0, 0, 1, 20, '#e8c860');
    px(g, 0, 19, 30, 1, '#6a4a10');
    px(g, 29, 0, 1, 20, '#6a4a10');
    px(g, 1, 1, 28, 18, '#3a2a10');
    const inner = canvas(26, 16);
    const ig = inner.getContext('2d');
    ig.imageSmoothingEnabled = false;
    paint(ig, 26, 16, sub, seed);
    g.drawImage(inner, 2, 2);
  } else {
    c = canvas(10, 9);
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    paint(g, 10, 9, sub, seed);
  }
  if (cache.size > 300) cache.clear();
  cache.set(key, c);
  return c;
}
