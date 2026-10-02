// Tiny software pixel canvas used to author procedural pixel art.

export function hex(s) {
  if (Array.isArray(s)) return s;
  const n = parseInt(s.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function shade(c, f) {
  c = hex(c);
  return [Math.min(255, Math.round(c[0] * f)), Math.min(255, Math.round(c[1] * f)), Math.min(255, Math.round(c[2] * f))];
}

export function mix(a, b, t) {
  a = hex(a);
  b = hex(b);
  return [0, 1, 2].map((i) => Math.round(a[i] + (b[i] - a[i]) * t));
}

export function toHex(c) {
  return '#' + c.slice(0, 3).map((v) => v.toString(16).padStart(2, '0')).join('');
}

export class Px {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.d = new Uint8ClampedArray(w * h * 4);
  }
  set(x, y, c, a = 255) {
    x |= 0;
    y |= 0;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    c = hex(c);
    const i = (y * this.w + x) * 4;
    this.d[i] = c[0];
    this.d[i + 1] = c[1];
    this.d[i + 2] = c[2];
    this.d[i + 3] = c.length > 3 ? c[3] : a;
  }
  get(x, y) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return [0, 0, 0, 0];
    const i = (y * this.w + x) * 4;
    return [this.d[i], this.d[i + 1], this.d[i + 2], this.d[i + 3]];
  }
  alpha(x, y) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return 0;
    return this.d[(y * this.w + x) * 4 + 3];
  }
  clear(x, y) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.d[(y * this.w + x) * 4 + 3] = 0;
  }
  rect(x, y, w, h, c, a = 255) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c, a);
  }
  fill(c, a = 255) {
    this.rect(0, 0, this.w, this.h, c, a);
  }
  hline(x0, x1, y, c) {
    for (let x = x0; x <= x1; x++) this.set(x, y, c);
  }
  vline(x, y0, y1, c) {
    for (let y = y0; y <= y1; y++) this.set(x, y, c);
  }
  line(x0, y0, x1, y1, c) {
    x0 |= 0;
    y0 |= 0;
    x1 |= 0;
    y1 |= 0;
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.set(x0, y0, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x0 += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y0 += sy;
      }
    }
  }
  ellipse(cx, cy, rx, ry, c, a = 255) {
    for (let y = -ry; y <= ry; y++) {
      for (let x = -rx; x <= rx; x++) {
        if ((x * x) / (rx * rx + 0.3) + (y * y) / (ry * ry + 0.3) <= 1) this.set(cx + x, cy + y, c, a);
      }
    }
  }
  // Multiply RGB of all opaque pixels.
  tint(f) {
    for (let i = 0; i < this.d.length; i += 4) {
      this.d[i] *= f;
      this.d[i + 1] *= f;
      this.d[i + 2] *= f;
    }
    return this;
  }
  // Dark outline around opaque shapes (for sprites).
  outline(c = '#1a1420', diag = false) {
    const src = new Uint8ClampedArray(this.d);
    const at = (x, y) => (x < 0 || y < 0 || x >= this.w || y >= this.h ? 0 : src[(y * this.w + x) * 4 + 3]);
    const col = hex(c);
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (at(x, y) > 0) continue;
        let n = at(x - 1, y) || at(x + 1, y) || at(x, y - 1) || at(x, y + 1);
        if (!n && diag) n = at(x - 1, y - 1) || at(x + 1, y - 1) || at(x - 1, y + 1) || at(x + 1, y + 1);
        if (n) this.set(x, y, col);
      }
    }
    return this;
  }
  blit(src, dx, dy, flipX = false) {
    for (let y = 0; y < src.h; y++) {
      for (let x = 0; x < src.w; x++) {
        const p = src.get(flipX ? src.w - 1 - x : x, y);
        if (p[3] > 0) this.set(dx + x, dy + y, p, p[3]);
      }
    }
  }
  copy() {
    const p = new Px(this.w, this.h);
    p.d.set(this.d);
    return p;
  }
  toImageData() {
    return new ImageData(this.d, this.w, this.h);
  }
}
