// (Round 81) The desktop app's icon and the installer's side picture, drawn
// as pixel art (`npm run icons` writes them to build/):
//   build/icon.png              512 x 512 (the window, Linux)
//   build/icon.ico              16-256 (Tessera.exe, its shortcuts, the installer)
//   favicon.png                 32 x 32 (the browser tab; beside index.html)
//   build/installerSidebar.bmp  164 x 314 (the installer's first and last pages)
// A tile of the title screen's night: a gold-framed tessera, the logo's
// "T" in amber and gold, stars above and the drifting land below (hills,
// forest, mountains and water, in little tiles of their own).
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16), 255];
const C = {
  ink: hex('#0b0910'),
  sky: [hex('#211a3c'), hex('#18122c'), hex('#110d1f'), hex('#0b0914')],
  star: hex('#d8d4f4'),
  starDim: hex('#6a6a8a'),
  frameOut: hex('#4a240c'),
  frameHi: hex('#ffd060'),
  frameLo: hex('#a85420'),
  w: hex('#fff4c0'),
  y: hex('#ffd060'),
  a: hex('#f0a040'),
  o: hex('#c86a28'),
  oD: hex('#9a4c1c'),
  grout: hex('#08070c'),
  mtn: hex('#6a6a7a'),
  mtnHi: hex('#a4a4b8'),
  tree: hex('#2e6a32'),
  treeHi: hex('#4a9442'),
  grass: hex('#3a5a2a'),
  dirt: hex('#2a3020'),
  water: hex('#1e3a6a'),
  waterHi: hex('#3c6cb0'),
};

class Pix {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.d = new Uint8ClampedArray(w * h * 4);
  }
  set(x, y, c) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h || !c) return;
    const i = (y * this.w + x) * 4;
    this.d.set(c, i);
  }
  get(x, y) {
    const i = (y * this.w + x) * 4;
    return this.d.slice(i, i + 4);
  }
  rect(x, y, w, h, c) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c);
  }
  // Each pixel `k` times as big.
  scale(k) {
    const o = new Pix(this.w * k, this.h * k);
    for (let y = 0; y < o.h; y++) for (let x = 0; x < o.w; x++) o.set(x, y, this.get(Math.floor(x / k), Math.floor(y / k)));
    return o;
  }
  // Smaller by averaging (for the sizes between).
  shrink(w, h) {
    const o = new Pix(w, h);
    const fx = this.w / w;
    const fy = this.h / h;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const s = [0, 0, 0, 0];
        let n = 0;
        for (let j = Math.floor(y * fy); j < Math.floor((y + 1) * fy); j++) {
          for (let i = Math.floor(x * fx); i < Math.floor((x + 1) * fx); i++) {
            const c = this.get(i, j);
            const a = c[3] / 255;
            s[0] += c[0] * a;
            s[1] += c[1] * a;
            s[2] += c[2] * a;
            s[3] += c[3];
            n++;
          }
        }
        const a = s[3] / n;
        o.set(x, y, a ? [s[0] / (a / 255) / n, s[1] / (a / 255) / n, s[2] / (a / 255) / n, a] : [0, 0, 0, 0]);
      }
    }
    return o;
  }
}

const mix = (a, b, f) => [0, 1, 2].map((i) => Math.round(a[i] + (b[i] - a[i]) * f)).concat(255);

// The tile itself: `n` pixels square (32, or 16 drawn plainer), for that
// size.
function tile(n) {
  const p = new Pix(n, n);
  const big = n >= 32;
  const r = big ? 3.2 : 2.2;
  const inside = (x, y) => {
    const cx = Math.min(Math.max(x + 0.5, r), n - r);
    const cy = Math.min(Math.max(y + 0.5, r), n - r);
    return x >= 0 && y >= 0 && x < n && y < n && Math.hypot(x + 0.5 - cx, y + 0.5 - cy) <= r;
  };
  // The T: the logo's, in its three bands (gold, amber, rust).
  const T = big ? { bx: 6, by: 5, bw: 20, bh: 5, sx: 13, sw: 6, sb: 24 } : { bx: 3, by: 2, bw: 10, bh: 3, sx: 6, sw: 4, sb: 12 };
  const inT = (x, y) => (y >= T.by && y < T.by + T.bh && x >= T.bx && x < T.bx + T.bw) || (y >= T.by && y < T.sb && x >= T.sx && x < T.sx + T.sw);
  // The night, in tesserae: 4-pixel tiles a shade apart, darker down; and
  // the torchlight round the T.
  const glow = (x, y) => {
    const dx = Math.max(T.bx - x, 0, x - (T.bx + T.bw - 1));
    const dy = Math.max(T.by - y, 0, y - (T.by + T.bh - 1));
    const d1 = Math.hypot(dx, dy);
    const ex = Math.max(T.sx - x, 0, x - (T.sx + T.sw - 1));
    const ey = Math.max(T.by - y, 0, y - (T.sb - 1));
    return Math.min(d1, Math.hypot(ex, ey));
  };
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (!inside(x, y)) continue;
      let c = C.sky[Math.min(3, Math.floor((y / n) * 4))];
      if (big && (Math.floor(x / 4) + Math.floor(y / 4)) % 2) c = mix(c, C.ink, 0.18);
      const g = glow(x, y);
      if (big && g < 5) c = mix(c, C.o, ((5 - g) / 5) * 0.3);
      else if (!big && g < 2.5) c = mix(c, C.o, (2.5 - g) / 2.5 * 0.4);
      p.set(x, y, c);
    }
  }
  // Stars (one bright, with its cross).
  if (big) {
    for (const [x, y, b] of [[27, 4, 1], [4, 13, 0], [28, 13, 0], [3, 3, 0], [24, 2, 0]]) p.set(x, y, b ? C.star : C.starDim);
    for (const [x, y] of [[27, 3], [27, 5], [26, 4], [28, 4]]) p.set(x, y, C.starDim);
  } else p.set(13, 2, C.star);
  // The land: mountains, a forest, the water.
  if (big) {
    const ground = 22;
    for (const [px, py, w] of [[7, 15, 9], [25, 14, 10]]) {
      for (let y = py; y < ground + 1; y++) {
        const half = Math.round(((y - py) / (ground - py)) * w * 0.55);
        for (let x = px - half; x <= px + half; x++) {
          if (!inside(x, y)) continue;
          let c = x <= px ? C.mtnHi : C.mtn;
          if (y - py < 2) c = C.star;
          p.set(x, y, c);
        }
      }
    }
    for (let x = 2; x < n - 2; x++) {
      const h = (x * 7) % 3 === 0 ? 3 : (x * 5) % 4 === 1 ? 2 : 1;
      for (let y = ground - h; y <= ground + 2; y++) p.set(x, y, y < ground ? ((x + y) % 2 ? C.tree : C.treeHi) : y === ground ? C.treeHi : C.tree);
    }
    for (let y = ground + 3; y < n - 2; y++) {
      for (let x = 2; x < n - 2; x++) {
        let c = (x + y * 3) % 7 === 0 ? C.waterHi : C.water;
        // (The T's light in the water.)
        const k = y - (ground + 3);
        if (x >= T.sx && x < T.sx + T.sw && (x + y) % 2 === 0 && k < 3 && (k < 2 || x % 3 === 0)) c = k === 0 ? C.a : k === 1 ? C.o : C.oD;
        p.set(x, y, c);
      }
    }
  } else {
    for (let x = 1; x < n - 1; x++) {
      p.set(x, 12, x % 2 ? C.tree : C.treeHi);
      p.set(x, 13, C.water);
      p.set(x, 14, x % 3 ? C.water : C.waterHi);
    }
  }
  // The T, its outline in ink.
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (inT(x, y) || !inside(x, y)) continue;
      if (inT(x - 1, y) || inT(x + 1, y) || inT(x, y - 1) || inT(x, y + 1)) p.set(x, y, C.ink);
    }
  }
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (!inT(x, y)) continue;
      const f = (y - T.by) / (T.sb - T.by);
      let c = y < T.by + T.bh ? C.y : f < 0.62 ? C.a : C.o;
      // (Lit from the top left; shadowed on its right.)
      if (y === T.by) c = C.w;
      else if ((x === T.bx && y < T.by + T.bh) || (x === T.sx && y >= T.by + T.bh)) c = y < T.by + T.bh ? C.w : C.y;
      else if (x === T.sx + T.sw - 1 && y >= T.by + T.bh) c = c === C.a ? C.o : C.oD;
      else if (y === T.by + T.bh - 1 && (x < T.sx || x >= T.sx + T.sw)) c = C.a;
      p.set(x, y, c);
    }
  }
  if (big) {
    // (A glint running across, as the title's logo has.)
    p.rect(9, 6, 3, 1, C.w);
    p.set(10, 7, C.w);
  }
  // The frame: an ink edge, gold lit from the top left.
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (!inside(x, y)) continue;
      if (!inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1)) p.set(x, y, C.frameOut);
      else if (big && (!inside(x - 2, y) || !inside(x + 2, y) || !inside(x, y - 2) || !inside(x, y + 2))) p.set(x, y, x + y < n - 1 ? C.frameHi : C.frameLo);
      else if (!big && (!inside(x - 2, y) || !inside(x, y - 2)) && x + y < n - 1) p.set(x, y, mix(p.get(x, y), C.frameHi, 0.35));
    }
  }
  return p;
}

// ------------------------------------------------------------ the files
const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
export function png(p) {
  const head = Buffer.alloc(13);
  head.writeUInt32BE(p.w, 0);
  head.writeUInt32BE(p.h, 4);
  head[8] = 8;
  head[9] = 6;
  const raw = Buffer.alloc((p.w * 4 + 1) * p.h);
  for (let y = 0; y < p.h; y++) {
    raw[y * (p.w * 4 + 1)] = 0;
    Buffer.from(p.d.buffer, y * p.w * 4, p.w * 4).copy(raw, y * (p.w * 4 + 1) + 1);
  }
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', head), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}
// A picture as an icon's BMP (32-bit, upside down, with its mask).
function dib(p) {
  const head = Buffer.alloc(40);
  head.writeUInt32LE(40, 0);
  head.writeInt32LE(p.w, 4);
  head.writeInt32LE(p.h * 2, 8);
  head.writeUInt16LE(1, 12);
  head.writeUInt16LE(32, 14);
  const px = Buffer.alloc(p.w * p.h * 4);
  for (let y = 0; y < p.h; y++) {
    for (let x = 0; x < p.w; x++) {
      const c = p.get(x, p.h - 1 - y);
      px.set([c[2], c[1], c[0], c[3]], (y * p.w + x) * 4);
    }
  }
  const row = Math.ceil(p.w / 32) * 4;
  const mask = Buffer.alloc(row * p.h);
  for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) if (p.get(x, p.h - 1 - y)[3] < 128) mask[y * row + (x >> 3)] |= 0x80 >> (x & 7);
  return Buffer.concat([head, px, mask]);
}
export function ico(pics) {
  const imgs = pics.map((p) => (p.w >= 256 ? png(p) : dib(p)));
  const head = Buffer.alloc(6 + 16 * pics.length);
  head.writeUInt16LE(1, 2);
  head.writeUInt16LE(pics.length, 4);
  let off = head.length;
  pics.forEach((p, i) => {
    const e = 6 + i * 16;
    head[e] = p.w >= 256 ? 0 : p.w;
    head[e + 1] = p.h >= 256 ? 0 : p.h;
    head.writeUInt16LE(1, e + 4);
    head.writeUInt16LE(32, e + 6);
    head.writeUInt32LE(imgs[i].length, e + 8);
    head.writeUInt32LE(off, e + 12);
    off += imgs[i].length;
  });
  return Buffer.concat([head, ...imgs]);
}
// A 24-bit BMP (the installer's pictures are these).
function bmp24(p) {
  const row = Math.ceil((p.w * 3) / 4) * 4;
  const size = 54 + row * p.h;
  const b = Buffer.alloc(size);
  b.write('BM', 0, 'ascii');
  b.writeUInt32LE(size, 2);
  b.writeUInt32LE(54, 10);
  b.writeUInt32LE(40, 14);
  b.writeInt32LE(p.w, 18);
  b.writeInt32LE(p.h, 22);
  b.writeUInt16LE(1, 26);
  b.writeUInt16LE(24, 28);
  b.writeUInt32LE(row * p.h, 34);
  for (let y = 0; y < p.h; y++) {
    for (let x = 0; x < p.w; x++) {
      const c = p.get(x, p.h - 1 - y);
      const a = c[3] / 255;
      const bg = C.sky[3];
      const o = 54 + y * row + x * 3;
      b[o] = Math.round(c[2] * a + bg[2] * (1 - a));
      b[o + 1] = Math.round(c[1] * a + bg[1] * (1 - a));
      b[o + 2] = Math.round(c[0] * a + bg[0] * (1 - a));
    }
  }
  return b;
}

// The title's logo, in its block letters (as ui/windows.js draws it).
const LOGO = [
  '█████ █████ ▄████ ▄████ █████ ████▄ ▄███▄',
  '  █   █     █     █     █     █   █ █   █',
  '  █   ████  ▀███▄ ▀███▄ ████  ████▀ █████',
  '  █   █         █     █ █     █  ▀▄ █   █',
  '  █   █████ ████▀ ████▀ █████ █   █ █   █',
];

// The installer's side picture: the night, the tile, the name, the land.
function sidebar() {
  const W = 164;
  const H = 314;
  const p = new Pix(W, H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) p.set(x, y, C.sky[Math.min(3, Math.floor((y / H) * 5))]);
  for (let i = 0; i < 40; i++) {
    const x = (i * 37 + 11) % W;
    const y = (i * 53 + 7) % 200;
    p.set(x, y, i % 5 ? C.starDim : C.star);
  }
  const t = tile(32).scale(3);
  for (let y = 0; y < t.h; y++) for (let x = 0; x < t.w; x++) if (t.get(x, y)[3]) p.set(34 + x, 34 + y, t.get(x, y));
  // The name: each letter-cell 3 wide, 4 tall.
  const lx = Math.floor((W - LOGO[0].length * 3) / 2);
  LOGO.forEach((row, r) => {
    for (let k = 0; k < row.length; k++) {
      const ch = row[k];
      if (ch === ' ') continue;
      const col = r < 2 ? C.y : r < 4 ? C.a : C.o;
      const x = lx + k * 3;
      const y = 150 + r * 4;
      if (ch === '█') p.rect(x, y, 3, 4, col);
      else if (ch === '▄') p.rect(x, y + 2, 3, 2, col);
      else if (ch === '▀') p.rect(x, y, 3, 2, col);
    }
  });
  // The land below, as on the tile: peaks, a forest, the water (in pixels
  // three times as big).
  const k = 3;
  const cw = Math.ceil(W / k);
  const top = 70;
  const ground = 86;
  const s = new Pix(cw, Math.ceil(H / k));
  for (const [px, py, w] of [[7, top, 14], [24, top + 4, 10], [40, top - 2, 16], [52, top + 5, 9]]) {
    for (let y = py; y <= ground; y++) {
      const half = Math.round(((y - py) / (ground - py)) * w * 0.55);
      for (let x = px - half; x <= px + half; x++) s.set(x, y, y - py < 2 ? C.star : x <= px ? C.mtnHi : C.mtn);
    }
  }
  for (let x = 0; x < cw; x++) {
    const h = (x * 7) % 3 === 0 ? 3 : (x * 5) % 4 === 1 ? 2 : 1;
    for (let y = ground - h; y <= ground + 2; y++) s.set(x, y, y < ground ? ((x + y) % 2 ? C.tree : C.treeHi) : y === ground ? C.treeHi : C.tree);
  }
  for (let y = ground + 3; y < s.h; y++) for (let x = 0; x < cw; x++) s.set(x, y, (x + y * 3) % 7 === 0 ? C.waterHi : C.water);
  const big = s.scale(k);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (big.get(x, y)[3]) p.set(x, y, big.get(x, y));
  return p;
}

export function makeIcons(outDir = path.join(root, 'build')) {
  fs.mkdirSync(outDir, { recursive: true });
  const t32 = tile(32);
  const t16 = tile(16);
  const sizes = [t16, t32.shrink(24, 24), t32, t16.scale(3), t32.scale(2), t32.scale(4), t32.scale(8)];
  fs.writeFileSync(path.join(outDir, 'icon.ico'), ico(sizes));
  fs.writeFileSync(path.join(outDir, 'icon.png'), png(t32.scale(16)));
  fs.writeFileSync(path.join(outDir === path.join(root, 'build') ? root : outDir, 'favicon.png'), png(t32));
  fs.writeFileSync(path.join(outDir, 'installerSidebar.bmp'), bmp24(sidebar()));
  return { t16, t32 };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  makeIcons(process.argv[2] ? path.resolve(process.argv[2]) : undefined);
  console.log('Icons written to build/.');
}
