// Mods' effects (round 62): what the VFX tool makes, played in the game
// just as it's previewed there. An effect is a few layers over a stretch
// of time:
//   sprite   a mod's art (its frames, or one of its tags), moved by
//            keyframes and by simple simulated motion (bobbing, swaying,
//            spinning, pulsing, flickering, rising, orbiting, a springy
//            pop as it appears, after-images trailing it), tinted, glowing
//   emitter  particles: a burst and a stream from a point, a circle, a
//            ring, a line or a box; their life, speed, direction, gravity,
//            drag, wind and swirl; their size, colours and fading over
//            their life; squares, soft blobs, sparks, stars, rings, or art
//   ring     a ring spreading out (a shockwave on the ground, a ripple)
//   glow     a soft light that pulses and flickers
// and, for the whole: how long, looping or not, a shake of the screen, a
// flash, a sound. Drawn in screen pixels from an anchor (the feet of
// whatever it's on), y going down the screen as the game's does.
export const LAYER_TYPES = ['sprite', 'emitter', 'ring', 'glow'];
export const EASES = ['linear', 'in', 'out', 'inout', 'pop'];
export const LOOKS = ['pixel', 'soft', 'spark', 'star', 'ring', 'sprite'];
export const SHAPES = ['point', 'circle', 'ring', 'line', 'box'];
export const TRACKS = ['x', 'y', 'scale', 'rot', 'alpha'];

// ------------------------------------------------------------ numbers
export function ease(k, e) {
  k = Math.max(0, Math.min(1, k));
  switch (e) {
    case 'in': return k * k;
    case 'out': return 1 - (1 - k) * (1 - k);
    case 'inout': return k < 0.5 ? 2 * k * k : 1 - 2 * (1 - k) * (1 - k);
    case 'pop': {
      const c = 2.2;
      return 1 + (c + 1) * (k - 1) ** 3 + c * (k - 1) ** 2;
    }
    default: return k;
  }
}
const lerp = (a, b, k) => a + (b - a) * k;
export function hexRgb(h) {
  const s = String(h || '#ffffff').replace('#', '');
  return [parseInt(s.slice(0, 2), 16) || 0, parseInt(s.slice(2, 4), 16) || 0, parseInt(s.slice(4, 6), 16) || 0];
}
// A colour along stops [c0, c1, c2] at k (0..1).
function grad(stops, k) {
  if (stops.length === 1) return stops[0];
  const f = Math.max(0, Math.min(1, k)) * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(f));
  const q = f - i;
  const a = stops[i];
  const b = stops[i + 1];
  return [lerp(a[0], b[0], q), lerp(a[1], b[1], q), lerp(a[2], b[2], q)];
}
// A little seeded random.
export function rng(seed) {
  let s = (seed >>> 0) || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}
const range = (r, v) => (Array.isArray(v) ? lerp(v[0], v[1] ?? v[0], r()) : v);

// A keyframed track at t: { t, v, e } sorted by t.
export function trackAt(keys, t, def) {
  if (!keys || !keys.length) return def;
  if (t <= keys[0].t) return keys[0].v;
  const last = keys[keys.length - 1];
  if (t >= last.t) return last.v;
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i];
    const b = keys[i + 1];
    if (t >= a.t && t <= b.t) return lerp(a.v, b.v, ease((t - a.t) / Math.max(1e-6, b.t - a.t), b.e || 'linear'));
  }
  return def;
}

// ------------------------------------------------------------ what's new
export const EMITTER_PRESETS = {
  sparks: { name: 'Sparks', shape: 'point', burst: 18, rate: 0, life: [0.25, 0.6], speed: [40, 110], dir: -90, spread: 160, gravity: 220, drag: 1, size: [2, 1], colors: ['#ffffff', '#ffe070', '#ff8030'], alpha: [1, 0.2], look: 'spark', blend: 'add' },
  fire: { name: 'Fire', shape: 'line', w: 8, burst: 0, rate: 40, life: [0.4, 0.8], speed: [14, 30], dir: -90, spread: 30, gravity: -30, drag: 0.6, size: [4, 1], colors: ['#fff0a0', '#ff9020', '#a02010'], alpha: [1, 0], look: 'soft', blend: 'add', wind: 0 },
  smoke: { name: 'Smoke', shape: 'circle', r: 3, burst: 0, rate: 10, life: [1.2, 2.2], speed: [6, 14], dir: -90, spread: 40, gravity: -6, drag: 0.4, size: [3, 8], colors: ['#8a8090', '#4a4450'], alpha: [0.6, 0], look: 'soft', blend: 'normal', wind: 6 },
  magic: { name: 'Magic', shape: 'circle', r: 8, burst: 0, rate: 24, life: [0.6, 1.2], speed: [4, 14], dir: -90, spread: 360, gravity: -10, drag: 0.8, size: [2, 0], colors: ['#ffffff', '#c090ff', '#6040ff'], alpha: [1, 0], look: 'star', blend: 'add', swirl: 90 },
  heal: { name: 'Healing', shape: 'circle', r: 8, burst: 10, rate: 10, life: [0.7, 1.2], speed: [8, 18], dir: -90, spread: 30, gravity: -12, drag: 0.5, size: [2, 1], colors: ['#e0ffe0', '#60e070'], alpha: [1, 0], look: 'star', blend: 'add' },
  poison: { name: 'Poison', shape: 'circle', r: 6, burst: 0, rate: 12, life: [0.8, 1.4], speed: [4, 10], dir: -90, spread: 60, gravity: -8, drag: 0.6, size: [2, 4], colors: ['#c0ff60', '#40a020'], alpha: [0.9, 0], look: 'soft', blend: 'normal' },
  frost: { name: 'Frost', shape: 'circle', r: 9, burst: 16, rate: 6, life: [0.6, 1.2], speed: [10, 30], dir: -90, spread: 360, gravity: 20, drag: 1.2, size: [2, 1], colors: ['#ffffff', '#a0e0ff'], alpha: [1, 0], look: 'star', blend: 'add' },
  snow: { name: 'Snow', shape: 'line', w: 60, y: -60, burst: 0, rate: 16, life: [2, 3], speed: [6, 12], dir: 90, spread: 30, gravity: 4, drag: 0.2, size: [1, 1], colors: ['#ffffff'], alpha: [1, 0.6], look: 'pixel', blend: 'normal', wind: 6 },
  rain: { name: 'Rain', shape: 'line', w: 80, y: -80, burst: 0, rate: 60, life: [0.5, 0.7], speed: [140, 180], dir: 100, spread: 4, gravity: 0, drag: 0, size: [1, 1], colors: ['#a0c8ff'], alpha: [0.7, 0.5], look: 'spark', blend: 'normal' },
  blood: { name: 'Blood', shape: 'point', burst: 14, rate: 0, life: [0.3, 0.7], speed: [30, 80], dir: -90, spread: 140, gravity: 260, drag: 0.6, size: [2, 1], colors: ['#ff4040', '#801010'], alpha: [1, 0.8], look: 'pixel', blend: 'normal', floor: 0.2 },
  leaves: { name: 'Leaves', shape: 'line', w: 40, y: -40, burst: 0, rate: 4, life: [2, 3.5], speed: [4, 10], dir: 90, spread: 50, gravity: 6, drag: 0.4, size: [2, 2], colors: ['#80c040', '#c0a030', '#c06020'], alpha: [1, 0.6], look: 'pixel', blend: 'normal', wind: 10, spin: 180 },
  dust: { name: 'Dust', shape: 'line', w: 12, burst: 12, rate: 0, life: [0.4, 0.9], speed: [10, 30], dir: -90, spread: 170, gravity: 10, drag: 2, size: [2, 4], colors: ['#c8b890', '#8a7a60'], alpha: [0.7, 0], look: 'soft', blend: 'normal' },
  bubbles: { name: 'Bubbles', shape: 'circle', r: 5, burst: 0, rate: 6, life: [1, 1.8], speed: [8, 16], dir: -90, spread: 30, gravity: -10, drag: 0.4, size: [2, 3], colors: ['#c0f0ff'], alpha: [0.9, 0.3], look: 'ring', blend: 'normal', wind: 0 },
  embers: { name: 'Embers', shape: 'circle', r: 6, burst: 0, rate: 10, life: [1, 2], speed: [8, 22], dir: -90, spread: 50, gravity: -14, drag: 0.4, size: [1, 1], colors: ['#ffe070', '#ff6020'], alpha: [1, 0], look: 'pixel', blend: 'add', wind: 8 },
  explosion: { name: 'Explosion', shape: 'point', burst: 40, rate: 0, life: [0.3, 0.8], speed: [40, 140], dir: -90, spread: 360, gravity: 40, drag: 2.2, size: [5, 1], colors: ['#ffffff', '#ffd040', '#ff5010', '#401008'], alpha: [1, 0], look: 'soft', blend: 'add' },
  portal: { name: 'Swirl', shape: 'ring', r: 12, burst: 0, rate: 30, life: [0.6, 1], speed: [0, 4], dir: -90, spread: 360, gravity: 0, drag: 0.5, size: [2, 0], colors: ['#ffffff', '#60e0ff', '#4040ff'], alpha: [1, 0], look: 'pixel', blend: 'add', swirl: 240, pull: 12 },
  confetti: { name: 'Confetti', shape: 'point', burst: 30, rate: 0, life: [1, 1.8], speed: [40, 90], dir: -90, spread: 70, gravity: 90, drag: 1.4, size: [2, 2], colors: ['#ff4060', '#ffe040', '#40c0ff', '#80ff60'], alpha: [1, 1], look: 'pixel', blend: 'normal', spin: 360, random: true },
  lightning: { name: 'Crackle', shape: 'circle', r: 8, burst: 6, rate: 20, life: [0.06, 0.16], speed: [80, 160], dir: -90, spread: 360, gravity: 0, drag: 0, size: [1, 1], colors: ['#ffffff', '#a0d0ff'], alpha: [1, 0.4], look: 'spark', blend: 'add' },
};

export function newLayer(type, o = {}) {
  const base = { id: o.id || `l${Math.random().toString(36).slice(2, 7)}`, type, name: o.name || { sprite: 'Sprite', emitter: 'Particles', ring: 'Ring', glow: 'Glow' }[type], start: 0, end: null, x: 0, y: 0, blend: 'normal', hidden: false };
  if (type === 'sprite') Object.assign(base, { asset: null, tag: null, fps: 0, play: 'loop', scale: 1, rot: 0, alpha: 1, flip: false, tint: '#ffffff', tintAmt: 0, glow: null, glowR: 10, y: -8, anim: { bob: 0, bobHz: 1, sway: 0, swayHz: 1, spin: 0, pulse: 0, pulseHz: 1, flicker: 0, rise: 0, orbit: 0, orbitHz: 0.5, shake: 0, fadeIn: 0, fadeOut: 0, pop: false, ghosts: 0, ghostGap: 0.05 }, keys: {} });
  if (type === 'emitter') Object.assign(base, { ...EMITTER_PRESETS.sparks, name: o.name || 'Particles', preset: 'sparks', r: 6, w: 16, h: 8, max: 300, swirl: 0, pull: 0, wind: 0, spin: 0, floor: null, local: false, asset: null });
  if (type === 'ring') Object.assign(base, { from: 2, to: 24, width: 2, color: '#ffffff', alpha: 0.9, squash: 0.55, dur: 0.5, ease: 'out', blend: 'add', y: 0 });
  if (type === 'glow') Object.assign(base, { r: 18, color: '#ffd070', alpha: 0.5, pulse: 0.15, pulseHz: 1.5, flicker: 0.1, blend: 'add', y: -8 });
  return Object.assign(base, o);
}

export function newEffect(o = {}) {
  return { name: 'Effect', dur: 1.2, loop: true, shake: 0, flash: null, sound: null, bg: 'grass', layers: [newLayer('emitter', { preset: 'sparks' })], ...o };
}

// ------------------------------------------------------------ playing one
// art(assetId) -> { frames: [canvas], durs: [ms], tags: [{ name, from,
// to }] } | null.
export class VfxPlayer {
  constructor(def, o = {}) {
    this.def = def;
    this.art = o.art || (() => null);
    this.scale = o.scale || 1;
    this.loop = o.loop ?? def.loop;
    this.seed = o.seed ?? 1;
    this.reset();
  }

  reset() {
    this.t = 0;
    this.done = false;
    this.cycle = 0;
    this.r = rng(this.seed);
    this.em = new Map();
  }

  get dur() {
    return Math.max(0.05, +this.def.dur || 1);
  }

  // Forward by dt seconds (particles simulated in steps).
  step(dt) {
    if (this.done) return;
    let left = Math.min(dt, 0.25);
    while (left > 1e-6) {
      const h = Math.min(left, 1 / 60);
      this.tick(h);
      left -= h;
    }
  }

  tick(h) {
    const D = this.dur;
    this.t += h;
    if (this.t >= D) {
      if (this.loop) {
        this.t -= D;
        this.cycle++;
        for (const e of this.em.values()) e.burst = false;
      } else if (!this.anyAlive()) {
        this.done = true;
        return;
      }
    }
    for (const L of this.def.layers || []) {
      if (L.type !== 'emitter' || L.hidden) continue;
      let e = this.em.get(L.id);
      if (!e) this.em.set(L.id, (e = { parts: [], acc: 0, burst: false }));
      this.emit(L, e, h);
      this.simulate(L, e, h);
    }
  }

  anyAlive() {
    for (const e of this.em.values()) if (e.parts.length) return true;
    return false;
  }

  active(L) {
    const t = this.t;
    const end = L.end === null || L.end === undefined ? this.dur : L.end;
    return t >= (L.start || 0) && t <= end && (this.loop || this.t < this.dur);
  }

  emit(L, e, h) {
    if (!this.active(L) || (this.t >= this.dur && !this.loop)) return;
    const r = this.r;
    const max = Math.min(600, L.max || 300);
    let n = 0;
    if (!e.burst && L.burst) {
      n += L.burst;
      e.burst = true;
    }
    e.acc += (L.rate || 0) * h;
    n += Math.floor(e.acc);
    e.acc -= Math.floor(e.acc);
    const cols = (L.colors && L.colors.length ? L.colors : ['#ffffff']).map(hexRgb);
    for (let i = 0; i < n && e.parts.length < max; i++) {
      // Where on the shape.
      let x = 0;
      let y = 0;
      const a = r() * Math.PI * 2;
      if (L.shape === 'circle') {
        const d = Math.sqrt(r()) * (L.r || 6);
        x = Math.cos(a) * d;
        y = Math.sin(a) * d * 0.6;
      } else if (L.shape === 'ring') {
        x = Math.cos(a) * (L.r || 6);
        y = Math.sin(a) * (L.r || 6) * 0.6;
      } else if (L.shape === 'line') x = (r() - 0.5) * (L.w || 16);
      else if (L.shape === 'box') {
        x = (r() - 0.5) * (L.w || 16);
        y = (r() - 0.5) * (L.h || 8);
      }
      const dir = (((L.dir ?? -90) + (r() - 0.5) * (L.spread ?? 0)) * Math.PI) / 180;
      const sp = range(r, L.speed ?? [20, 40]);
      const col = L.random ? cols[Math.floor(r() * cols.length)] : null;
      e.parts.push({ x: x + (L.x || 0), y: y + (L.y || 0), vx: Math.cos(dir) * sp, vy: Math.sin(dir) * sp, age: 0, life: Math.max(0.02, range(r, L.life ?? [0.5, 1])), rot: r() * 360, col, fr: Math.floor(r() * 64) });
    }
  }

  simulate(L, e, h) {
    const g = L.gravity || 0;
    const drag = L.drag || 0;
    const wind = L.wind || 0;
    const swirl = ((L.swirl || 0) * Math.PI) / 180;
    const pull = L.pull || 0;
    const cx = L.x || 0;
    const cy = L.y || 0;
    const out = [];
    for (const p of e.parts) {
      p.age += h;
      if (p.age >= p.life) continue;
      p.vy += g * h;
      p.vx += wind * h;
      if (drag) {
        const k = Math.max(0, 1 - drag * h);
        p.vx *= k;
        p.vy *= k;
      }
      if (swirl || pull) {
        const dx = p.x - cx;
        const dy = (p.y - cy) / 0.6;
        const d = Math.hypot(dx, dy) || 1;
        p.vx += (-dy / d) * swirl * d * h * 0.9 - (dx / d) * pull * h;
        p.vy += (dx / d) * swirl * d * h * 0.6 - (dy / d) * pull * h;
      }
      p.x += p.vx * h;
      p.y += p.vy * h;
      if (L.floor !== null && L.floor !== undefined && p.y > 0) {
        p.y = 0;
        p.vy = -p.vy * L.floor;
        p.vx *= 0.7;
      }
      p.rot += (L.spin || 0) * h;
      out.push(p);
    }
    e.parts = out;
  }

  // What it's on moved (dx, dy screen pixels): particles let go of stay
  // where they were (unless the emitter carries them with it).
  shift(dx, dy) {
    for (const L of this.def.layers || []) {
      if (L.type !== 'emitter' || L.local) continue;
      const e = this.em.get(L.id);
      if (e) for (const p of e.parts) {
        p.x -= dx;
        p.y -= dy;
      }
    }
  }

  // Seek to time t from the start (for scrubbing; deterministic).
  seek(t) {
    this.reset();
    const D = this.dur;
    const target = this.loop ? t % D : Math.min(t, D + 3);
    let left = target;
    while (left > 1e-6) {
      const h = Math.min(left, 1 / 60);
      this.tick(h);
      left -= h;
    }
  }

  // A sprite layer's look at time t (its own transform).
  spriteAt(L, t) {
    const A = L.anim || {};
    const T0 = L.start || 0;
    const T1 = L.end === null || L.end === undefined ? this.dur : L.end;
    const lt = t - T0;
    const K = L.keys || {};
    let x = (L.x || 0) + trackAt(K.x, lt, 0);
    let y = (L.y || 0) + trackAt(K.y, lt, 0);
    let s = (L.scale ?? 1) * trackAt(K.scale, lt, 1);
    let rot = (L.rot || 0) + trackAt(K.rot, lt, 0);
    let a = (L.alpha ?? 1) * trackAt(K.alpha, lt, 1);
    const TAU = Math.PI * 2;
    if (A.bob) y += Math.sin(lt * TAU * (A.bobHz || 1)) * A.bob;
    if (A.sway) rot += Math.sin(lt * TAU * (A.swayHz || 1)) * A.sway;
    if (A.spin) rot += A.spin * lt;
    if (A.pulse) s *= 1 + Math.sin(lt * TAU * (A.pulseHz || 1)) * A.pulse;
    if (A.rise) y -= A.rise * lt;
    if (A.orbit) {
      x += Math.cos(lt * TAU * (A.orbitHz || 0.5)) * A.orbit;
      y += Math.sin(lt * TAU * (A.orbitHz || 0.5)) * A.orbit * 0.6;
    }
    if (A.shake) {
      x += Math.sin(lt * 91.7) * A.shake;
      y += Math.cos(lt * 73.3) * A.shake;
    }
    if (A.flicker) a *= 1 - A.flicker * (0.5 + 0.5 * Math.sin(lt * 61.3) * Math.sin(lt * 23.9));
    if (A.fadeIn && lt < A.fadeIn) a *= lt / A.fadeIn;
    if (A.fadeOut && T1 - t < A.fadeOut) a *= Math.max(0, (T1 - t) / A.fadeOut);
    if (A.pop) s *= Math.max(0.05, 1 - Math.exp(-lt * 9) * Math.cos(lt * 22));
    return { x, y, s, rot, a: Math.max(0, Math.min(1, a)) };
  }

  // Which frame of a sprite layer's art at time t.
  frameAt(L, art, t) {
    const lt = Math.max(0, t - (L.start || 0));
    let from = 0;
    let to = art.frames.length - 1;
    const tag = L.tag && (art.tags || []).find((q) => q.name === L.tag);
    if (tag) {
      from = Math.max(0, Math.min(to, tag.from));
      to = Math.max(from, Math.min(to, tag.to));
    }
    const n = to - from + 1;
    if (n <= 1) return from;
    let f;
    if (L.fps) f = Math.floor(lt * L.fps);
    else {
      // (The art's own timing.)
      let total = 0;
      for (let i = from; i <= to; i++) total += art.durs[i] || 100;
      let ms = (lt * 1000) % total;
      if (L.play === 'once' && lt * 1000 >= total) return to;
      for (let i = from; i <= to; i++) {
        ms -= art.durs[i] || 100;
        if (ms < 0) return i;
      }
      return to;
    }
    if (L.play === 'once') return from + Math.min(n - 1, f);
    if (L.play === 'pingpong') {
      const m = f % (2 * n - 2 || 1);
      return from + (m < n ? m : 2 * n - 2 - m);
    }
    return from + (f % n);
  }

  // Draw at the anchor (ax, ay) in screen pixels.
  draw(ctx, ax, ay) {
    const k = this.scale;
    const t = this.t;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    for (const L of this.def.layers || []) {
      if (L.hidden) continue;
      ctx.globalCompositeOperation = L.blend === 'add' ? 'lighter' : 'source-over';
      if (L.type === 'emitter') this.drawParts(ctx, L, ax, ay, k);
      else if (this.active(L)) {
        if (L.type === 'sprite') this.drawSprite(ctx, L, ax, ay, k, t);
        else if (L.type === 'ring') this.drawRing(ctx, L, ax, ay, k, t);
        else if (L.type === 'glow') this.drawGlow(ctx, L, ax, ay, k, t);
      }
    }
    ctx.restore();
  }

  drawSprite(ctx, L, ax, ay, k, t) {
    const art = L.asset ? this.art(L.asset) : null;
    if (!art || !art.frames.length) return;
    // (After-images first, fainter the further behind.)
    const A = L.anim || {};
    const ghosts = Math.min(8, A.ghosts | 0);
    for (let g = ghosts; g >= 0; g--) {
      const tt = t - g * (A.ghostGap || 0.05);
      if (tt < (L.start || 0)) continue;
      const q = this.spriteAt(L, tt);
      const img = this.tinted(art.frames[this.frameAt(L, art, tt)], L);
      if (!img || q.a <= 0) continue;
      const alpha = q.a * (g ? 0.5 * (1 - g / (ghosts + 1)) : 1);
      if (!g && L.glow) {
        const R = (L.glowR || 10) * q.s * k;
        const [r, gg, b] = hexRgb(L.glow);
        const G = ctx.createRadialGradient(ax + q.x * k, ay + q.y * k, 0, ax + q.x * k, ay + q.y * k, R);
        G.addColorStop(0, `rgba(${r},${gg},${b},${0.55 * q.a})`);
        G.addColorStop(1, `rgba(${r},${gg},${b},0)`);
        const op = ctx.globalCompositeOperation;
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = G;
        ctx.fillRect(ax + q.x * k - R, ay + q.y * k - R, R * 2, R * 2);
        ctx.globalCompositeOperation = op;
      }
      ctx.globalAlpha = alpha;
      ctx.save();
      ctx.translate(Math.round(ax + q.x * k), Math.round(ay + q.y * k));
      if (q.rot) ctx.rotate((q.rot * Math.PI) / 180);
      ctx.scale(q.s * k * (L.flip ? -1 : 1), q.s * k);
      ctx.drawImage(img, -img.width / 2, -img.height / 2);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  tinted(img, L) {
    if (!img || !L.tintAmt) return img;
    img._tint ||= new Map();
    const key = `${L.tint}:${L.tintAmt}`;
    if (img._tint.has(key)) return img._tint.get(key);
    const c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    const x = c.getContext('2d');
    x.drawImage(img, 0, 0);
    x.globalCompositeOperation = 'source-atop';
    x.globalAlpha = Math.max(0, Math.min(1, L.tintAmt));
    x.fillStyle = L.tint || '#ffffff';
    x.fillRect(0, 0, c.width, c.height);
    img._tint.set(key, c);
    return c;
  }

  drawParts(ctx, L, ax, ay, k) {
    const e = this.em.get(L.id);
    if (!e || !e.parts.length) return;
    const stops = (L.colors && L.colors.length ? L.colors : ['#ffffff']).map(hexRgb);
    const [s0, s1] = Array.isArray(L.size) ? L.size : [L.size || 2, L.size || 2];
    const [a0, a1] = Array.isArray(L.alpha) ? L.alpha : [L.alpha ?? 1, L.alpha ?? 1];
    const art = L.look === 'sprite' && L.asset ? this.art(L.asset) : null;
    for (const p of e.parts) {
      const q = p.age / p.life;
      const size = Math.max(0, lerp(s0, s1, q)) * k;
      const al = Math.max(0, Math.min(1, lerp(a0, a1, q)));
      if (al <= 0.01 || size <= 0.05) continue;
      const c = p.col || grad(stops, q);
      const x = ax + p.x * k;
      const y = ay + p.y * k;
      const css = `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;
      ctx.globalAlpha = al;
      switch (L.look) {
        case 'soft': {
          ctx.globalAlpha = al * 0.35;
          ctx.fillStyle = css;
          const S = size * 2;
          ctx.fillRect(Math.round(x - S / 2), Math.round(y - S / 2), Math.ceil(S), Math.ceil(S));
          ctx.globalAlpha = al;
          ctx.fillRect(Math.round(x - size / 2), Math.round(y - size / 2), Math.ceil(size), Math.ceil(size));
          break;
        }
        case 'spark': {
          ctx.strokeStyle = css;
          ctx.lineWidth = Math.max(1, size);
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x - p.vx * 0.035 * k, y - p.vy * 0.035 * k);
          ctx.stroke();
          break;
        }
        case 'star': {
          ctx.fillStyle = css;
          const S = Math.max(1, Math.round(size));
          ctx.fillRect(Math.round(x - S), Math.round(y), S * 2 + 1, 1);
          ctx.fillRect(Math.round(x), Math.round(y - S), 1, S * 2 + 1);
          break;
        }
        case 'ring': {
          ctx.strokeStyle = css;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(x, y, Math.max(1, size), 0, Math.PI * 2);
          ctx.stroke();
          break;
        }
        case 'sprite': {
          if (!art || !art.frames.length) break;
          const img = art.frames[(p.fr + Math.floor(q * art.frames.length)) % art.frames.length];
          const sc = size / Math.max(img.width, img.height) * 2;
          ctx.save();
          ctx.translate(Math.round(x), Math.round(y));
          if (L.spin) ctx.rotate((p.rot * Math.PI) / 180);
          ctx.scale(sc, sc);
          ctx.drawImage(img, -img.width / 2, -img.height / 2);
          ctx.restore();
          break;
        }
        default: {
          ctx.fillStyle = css;
          const S = Math.max(1, Math.round(size));
          ctx.fillRect(Math.round(x - S / 2), Math.round(y - S / 2), S, S);
        }
      }
    }
    ctx.globalAlpha = 1;
  }

  drawRing(ctx, L, ax, ay, k, t) {
    const lt = t - (L.start || 0);
    const d = Math.max(0.05, L.dur || 0.5);
    if (lt > d) return;
    const q = ease(lt / d, L.ease || 'out');
    const R = lerp(L.from ?? 2, L.to ?? 24, q) * k;
    const [r, g, b] = hexRgb(L.color);
    ctx.globalAlpha = Math.max(0, (L.alpha ?? 0.9) * (1 - lt / d));
    ctx.strokeStyle = `rgb(${r},${g},${b})`;
    ctx.lineWidth = Math.max(1, (L.width || 2) * k * (1 - q * 0.6));
    ctx.beginPath();
    ctx.ellipse(ax + (L.x || 0) * k, ay + (L.y || 0) * k, R, R * (L.squash ?? 0.55), 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  drawGlow(ctx, L, ax, ay, k, t) {
    const lt = t - (L.start || 0);
    let a = L.alpha ?? 0.5;
    let R = (L.r || 18) * k;
    if (L.pulse) R *= 1 + Math.sin(lt * Math.PI * 2 * (L.pulseHz || 1)) * L.pulse;
    if (L.flicker) a *= 1 - L.flicker * (0.5 + 0.5 * Math.sin(lt * 53.1) * Math.sin(lt * 17.7));
    const [r, g, b] = hexRgb(L.color);
    const x = ax + (L.x || 0) * k;
    const y = ay + (L.y || 0) * k;
    const G = ctx.createRadialGradient(x, y, 0, x, y, R);
    G.addColorStop(0, `rgba(${r},${g},${b},${a})`);
    G.addColorStop(0.5, `rgba(${r},${g},${b},${a * 0.4})`);
    G.addColorStop(1, `rgba(${r},${g},${b},0)`);
    ctx.fillStyle = G;
    ctx.fillRect(x - R, y - R, R * 2, R * 2);
  }
}
