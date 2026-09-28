// Deterministic random numbers and hashing. Every generator in the game is
// seeded from the world seed so the same seed always yields the same world.

export function hashString(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// Integer hash of up to four ints (fast, well mixed).
export function hash4(a, b = 0, c = 0, d = 0) {
  let h = Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h ^= Math.imul(c | 0, 0xc2b2ae35) ^ Math.imul(d | 0, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

// Float in [0,1) from integer coordinates.
export function hashf(a, b = 0, c = 0, d = 0) {
  return hash4(a, b, c, d) / 4294967296;
}

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class RNG {
  constructor(seed) {
    this.seed = typeof seed === 'string' ? hashString(seed) : seed >>> 0;
    this._next = mulberry32(this.seed);
  }
  next() {
    return this._next();
  }
  float(a = 0, b = 1) {
    return a + (b - a) * this._next();
  }
  int(a, b) {
    // inclusive
    return a + Math.floor(this._next() * (b - a + 1));
  }
  chance(p) {
    return this._next() < p;
  }
  pick(arr) {
    return arr[Math.floor(this._next() * arr.length)];
  }
  // items: array of [value, weight] or objects with .w
  weighted(items) {
    let total = 0;
    for (const it of items) total += Array.isArray(it) ? it[1] : it.w;
    let r = this._next() * total;
    for (const it of items) {
      const w = Array.isArray(it) ? it[1] : it.w;
      if ((r -= w) <= 0) return Array.isArray(it) ? it[0] : it;
    }
    const last = items[items.length - 1];
    return Array.isArray(last) ? last[0] : last;
  }
  shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this._next() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
  gauss(mean = 0, sd = 1) {
    const u = 1 - this._next();
    const v = this._next();
    return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
  fork(tag) {
    return new RNG(hash4(this.seed, typeof tag === 'string' ? hashString(tag) : tag));
  }
}

export function clamp(v, a, b) {
  return v < a ? a : v > b ? b : v;
}
export function lerp(a, b, t) {
  return a + (b - a) * t;
}
export function smoothstep(a, b, t) {
  const x = clamp((t - a) / (b - a), 0, 1);
  return x * x * (3 - 2 * x);
}
