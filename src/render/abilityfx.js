// (Round 137) How a forged piece's abilities look (see game/abilities.js):
// effects placed in the world (a sigil flaring under you as one is cast,
// a shockwave, ice bursting up, a meteor's fall, a crack running through
// the ground, roots, a lance of sunlight, wisps, a cloud of rot, a ring of
// slowed time, falling stars, a whirlwind, a shell of light), and the
// ones that stay on you a while, drawn on you as you move (a healing ring,
// blades circling, a shell, a red rage, thorns, after-images).
// All of it plain data going in (it goes over the wire to the others
// playing as it is: see net/host.js), worked out each frame here.
import { humanoidSheet, CHAR_W, CHAR_H, SHEET_H, SPR_PAD } from './sprites.js';

const TAU = Math.PI * 2;
const ease = (k) => 1 - (1 - k) * (1 - k);

function hash(a, b) {
  let h = (a * 374761393 + b * 668265263) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function spark(r, x, y, color, o = {}) {
  if (r.room && !r.room(1)) return;
  r.particles.push({
    x, y, vx: o.vx ?? (Math.random() - 0.5) * 30, vy: o.vy ?? -(10 + Math.random() * 25), g: o.g ?? -20,
    life: o.life ?? 0.4 + Math.random() * 0.3, max: o.life ?? 0.6, color, size: o.size ?? 1, shape: o.shape,
  });
}

// A soft glow: a radial gradient, added on (light on light).
function glow(ctx, x, y, rad, color, a) {
  if (rad <= 0 || a <= 0) return;
  const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
  g.addColorStop(0, color);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  const op = ctx.globalCompositeOperation;
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = Math.min(1, a);
  ctx.fillStyle = g;
  ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  ctx.globalCompositeOperation = op;
}

// An ellipse on the ground, stroked (`flat`: how flat it lies).
function ring(ctx, x, y, R, flat, color, w, a) {
  if (R <= 0 || a <= 0) return;
  ctx.globalAlpha = Math.min(1, a);
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  ctx.beginPath();
  ctx.ellipse(x, y, R, R * flat, 0, 0, TAU);
  ctx.stroke();
}

const COLS = (f, d) => (Array.isArray(f.color) ? f.color : f.color ? [f.color, '#ffffff'] : d);

// ------------------------------------------------------------ the effects
// Each: (r, ctx, f, k (0 to 1 through its life), ox, oy, dt). True if it
// was one of these.
export function drawAbilityFx(r, ctx, f, k, ox, oy, dt) {
  const fn = FX[f.type];
  if (!fn) return false;
  ctx.save();
  try {
    fn(r, ctx, f, k, f.cx + ox, f.cy + oy, dt, ox, oy);
  } finally {
    ctx.restore();
  }
  return true;
}

const FX = {
  // A circle of runes flaring under you as an ability's cast: it opens,
  // turns, and fades, a ring of glyph-ticks and a star drawn through it.
  sigil(r, ctx, f, k, x, y) {
    const [c0, c1] = COLS(f, ['#ffe080', '#ffffff']);
    const R = 6 + 12 * ease(Math.min(1, k * 2.2));
    const a = k < 0.7 ? 1 : (1 - k) / 0.3;
    glow(ctx, x, y, R * 1.6, c0, 0.35 * a);
    ring(ctx, x, y, R, 0.42, c0, 1, 0.9 * a);
    ring(ctx, x, y, R * 0.72, 0.42, c1, 1, 0.6 * a);
    const spin = f.t * 2.4;
    ctx.fillStyle = c1;
    for (let i = 0; i < 12; i++) {
      const q = spin + (i / 12) * TAU;
      ctx.globalAlpha = a * (i % 3 === 0 ? 1 : 0.55);
      ctx.fillRect(Math.round(x + Math.cos(q) * R * 0.86), Math.round(y + Math.sin(q) * R * 0.86 * 0.42), i % 3 === 0 ? 2 : 1, 1);
    }
    // The five-pointed figure inside.
    ctx.globalAlpha = 0.7 * a;
    ctx.strokeStyle = c0;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i <= 5; i++) {
      const q = -spin * 0.6 + ((i * 2) % 5) * (TAU / 5);
      const px = x + Math.cos(q) * R * 0.7;
      const py = y + Math.sin(q) * R * 0.7 * 0.42;
      if (i) ctx.lineTo(px, py);
      else ctx.moveTo(px, py);
    }
    ctx.stroke();
    // A column of light rising off it at the start.
    if (k < 0.45) {
      const h = 34 * ease(k / 0.45);
      const op = ctx.globalCompositeOperation;
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createLinearGradient(x, y, x, y - h);
      g.addColorStop(0, c0);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalAlpha = 0.45 * (1 - k / 0.45);
      ctx.fillStyle = g;
      ctx.fillRect(x - R * 0.6, y - h, R * 1.2, h);
      ctx.globalCompositeOperation = op;
    }
  },

  // A shockwave: a bright, thick ring rushing out and thinning, a softer
  // one behind it, and a flash at the heart.
  shock(r, ctx, f, k, x, y) {
    const [c0, c1] = COLS(f, ['#ffd080', '#ffffff']);
    const R1 = (f.r1 ?? 40) * ease(k);
    const flat = f.flat ?? 0.5;
    if (k < 0.25) glow(ctx, x, y, 22 * (1 - k * 2), c1, 0.8 * (1 - k / 0.25));
    glow(ctx, x, y, R1 * 1.1, c0, 0.25 * (1 - k));
    ring(ctx, x, y, R1, flat, c0, Math.max(1, 4 * (1 - k)), (1 - k) * 0.95);
    ring(ctx, x, y, R1 * 0.82, flat, c1, 1, (1 - k) * 0.7);
    ring(ctx, x, y, R1 * 0.55, flat, c0, 1, (1 - k) * 0.35);
  },

  // Spikes of ice bursting up out of the ground in a ring, glinting, then
  // shattering away.
  spikes(r, ctx, f, k, x, y, dt) {
    const n = f.n ?? 9;
    const R = f.r1 ?? 22;
    const up = k < 0.2 ? ease(k / 0.2) : k > 0.75 ? 1 - (k - 0.75) / 0.25 : 1;
    for (let i = 0; i < n; i++) {
      const q = (i / n) * TAU + f.seed;
      const rr = R * (0.55 + 0.45 * hash(f.seed, i));
      const px = x + Math.cos(q) * rr;
      const py = y + Math.sin(q) * rr * 0.45;
      const h = (8 + 10 * hash(i, f.seed)) * up;
      const w = 2 + Math.round(2 * hash(f.seed + 3, i));
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = '#5a9ad0';
      ctx.beginPath();
      ctx.moveTo(px - w, py);
      ctx.lineTo(px, py - h);
      ctx.lineTo(px + w, py);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#c8ecff';
      ctx.beginPath();
      ctx.moveTo(px - w, py);
      ctx.lineTo(px, py - h);
      ctx.lineTo(px, py);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(Math.round(px), Math.round(py - h), 1, Math.max(1, Math.round(h * 0.4)));
      if (k > 0.75 && Math.random() < dt * 20) spark(r, px - ox0(ctx), py, '#e0f4ff', { vx: (Math.random() - 0.5) * 40, vy: -30, g: 120, shape: 'shard', life: 0.5 });
    }
    glow(ctx, x, y, R * 1.2, '#a0d8ff', 0.3 * up);
  },

  // A burning stone out of the sky: its trail of fire, a glow round it,
  // falling at a slant to where it strikes (the strike itself: a shock
  // and a blast, sent when it lands).
  meteor(r, ctx, f, k, x, y, dt) {
    const p = Math.min(1, k * 1.05);
    const sx = x + 70 * (1 - p);
    const sy = y - 150 * (1 - p);
    const tx = x + 70;
    const ty = y - 150;
    const op = ctx.globalCompositeOperation;
    ctx.globalCompositeOperation = 'lighter';
    const tail = ctx.createLinearGradient(sx, sy, sx + (tx - sx) * 0.35, sy + (ty - sy) * 0.35);
    tail.addColorStop(0, 'rgba(255,220,120,0.9)');
    tail.addColorStop(1, 'rgba(255,60,0,0)');
    ctx.strokeStyle = tail;
    ctx.lineWidth = 5;
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx + (tx - sx) * 0.35, sy + (ty - sy) * 0.35);
    ctx.stroke();
    ctx.globalCompositeOperation = op;
    glow(ctx, sx, sy, 16, '#ff9030', 0.9);
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#3a2a24';
    ctx.beginPath();
    ctx.arc(sx, sy, 3.5, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#ffb040';
    ctx.fillRect(Math.round(sx - 1), Math.round(sy - 2), 2, 1);
    ctx.fillStyle = '#fff0b0';
    ctx.fillRect(Math.round(sx - 2), Math.round(sy - 1), 1, 1);
    if (Math.random() < dt * 60) spark(r, sx - ox0(ctx), sy - oy0(ctx), ['#ffe070', '#ff9030', '#ff5020'][Math.floor(Math.random() * 3)], { vx: 10 + Math.random() * 20, vy: -20 - Math.random() * 20, g: 30, life: 0.5 });
    if (Math.random() < dt * 25) spark(r, sx - ox0(ctx), sy - oy0(ctx), '#4a4040', { vx: 15, vy: -10, g: -10, life: 0.8, size: 2 });
    // Its shadow on the ground, growing as it comes.
    ctx.globalAlpha = 0.35 * p;
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.ellipse(x, y, 4 + 10 * p, (4 + 10 * p) * 0.4, 0, 0, TAU);
    ctx.fill();
    ring(ctx, x, y, 22 * (1 - p * 0.3), 0.42, '#ff6020', 1, 0.5 * Math.sin(f.t * 30) ** 2);
  },

  // The ground split open from (cx, cy) toward (ex, ey): a jagged crack
  // running out, molten light down in it, rubble thrown up along it.
  fissure(r, ctx, f, k, x, y, dt, ox, oy) {
    const ex = f.ex + ox;
    const ey = f.ey + oy;
    if (!f.path) {
      f.path = [];
      const n = 14;
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        const j = i === 0 || i === n ? 0 : (hash(f.seed, i) - 0.5) * 8;
        f.path.push([t, j]);
      }
    }
    const run = Math.min(1, k * 3.5);
    const fade = k > 0.6 ? 1 - (k - 0.6) / 0.4 : 1;
    const dx = ex - x;
    const dy = ey - y;
    const len = Math.max(1, Math.hypot(dx, dy));
    const px = -dy / len;
    const py = dx / len;
    const pts = f.path.filter(([t]) => t <= run).map(([t, j]) => [x + dx * t + px * j, y + dy * t + py * j * 0.5]);
    const line = (w, c, a) => {
      ctx.globalAlpha = a * fade;
      ctx.strokeStyle = c;
      ctx.lineWidth = w;
      ctx.beginPath();
      pts.forEach(([a1, b1], i) => (i ? ctx.lineTo(a1, b1) : ctx.moveTo(a1, b1)));
      ctx.stroke();
    };
    line(4, '#2a1a10', 0.9);
    line(2, '#ff7020', 0.95);
    line(1, '#fff0a0', 0.9);
    const op = ctx.globalCompositeOperation;
    ctx.globalCompositeOperation = 'lighter';
    for (const [a1, b1] of pts) glow(ctx, a1, b1, 6, '#ff8030', 0.18 * fade);
    ctx.globalCompositeOperation = op;
    if (run < 1 && pts.length) {
      const [hx, hy] = pts[pts.length - 1];
      for (let i = 0; i < 2; i++) spark(r, hx - ox, hy - oy, ['#a89878', '#8a7a5a', '#ffb040'][i], { vx: (Math.random() - 0.5) * 50, vy: -40 - Math.random() * 30, g: 160, life: 0.6, size: 2 });
    }
  },

  // Roots bursting up round where someone stands: tendrils climbing and
  // curling, then sinking back.
  roots(r, ctx, f, k, x, y) {
    const n = 6;
    const grow = k < 0.25 ? ease(k / 0.25) : k > 0.8 ? 1 - (k - 0.8) / 0.2 : 1;
    ctx.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      const q = (i / n) * TAU + f.seed;
      const bx = x + Math.cos(q) * 7;
      const by = y + Math.sin(q) * 3;
      const h = (12 + 8 * hash(f.seed, i)) * grow;
      const sway = Math.sin(f.t * 4 + i) * 2;
      for (const [w, c] of [[3, '#2e4a1a'], [1.5, '#5a8a30']]) {
        ctx.globalAlpha = 0.95;
        ctx.strokeStyle = c;
        ctx.lineWidth = w;
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.quadraticCurveTo(bx - Math.cos(q) * 8 + sway, by - h * 0.6, x + Math.cos(q) * 2 + sway, by - h);
        ctx.stroke();
      }
      ctx.fillStyle = '#90d060';
      ctx.globalAlpha = grow;
      ctx.fillRect(Math.round(x + Math.cos(q) * 2 + sway), Math.round(by - h), 2, 1);
    }
    ring(ctx, x, y, 9, 0.4, '#4a3020', 2, 0.6 * grow);
  },

  // A lance of sunlight out of the sky: a narrow white core in a gold
  // sheath, widening as it strikes, rays at its foot.
  pillar(r, ctx, f, k, x, y, dt) {
    const [c0] = COLS(f, ['#ffe070']);
    const w = (k < 0.15 ? k / 0.15 : 1 - (k - 0.15) / 0.85) * (f.w ?? 7);
    const top = y - 170;
    const op = ctx.globalCompositeOperation;
    ctx.globalCompositeOperation = 'lighter';
    for (const [ww, c, a] of [[w * 2.2, c0, 0.25], [w, c0, 0.6], [Math.max(1, w * 0.35), '#ffffff', 1]]) {
      const g = ctx.createLinearGradient(x, top, x, y);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(0.3, c);
      g.addColorStop(1, c);
      ctx.globalAlpha = a;
      ctx.fillStyle = g;
      ctx.fillRect(x - ww / 2, top, ww, y - top);
    }
    ctx.globalCompositeOperation = op;
    glow(ctx, x, y, 20 * (1 - k * 0.5), c0, 0.9 * (1 - k));
    for (let i = 0; i < 8; i++) {
      const q = (i / 8) * TAU + f.t * 1.5;
      const L = 10 + 8 * (1 - k);
      ctx.globalAlpha = (1 - k) * 0.8;
      ctx.strokeStyle = '#fff8c0';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(q) * 4, y + Math.sin(q) * 2);
      ctx.lineTo(x + Math.cos(q) * L, y + Math.sin(q) * L * 0.45);
      ctx.stroke();
    }
    if (Math.random() < dt * 40) spark(r, x - ox0(ctx) + (Math.random() - 0.5) * w * 2, y - oy0(ctx) - Math.random() * 60, '#fff8c0', { vx: 0, vy: -20, g: 0, life: 0.5, shape: 'star' });
  },

  // A wisp: a glowing mote flying a curved way from one to another, a
  // tail of light behind it.
  wisp(r, ctx, f, k, x, y, dt, ox, oy) {
    const [c0] = COLS(f, ['#80ffe0']);
    const ex = f.ex + ox;
    const ey = f.ey + oy;
    const bend = (f.bend ?? 1) * 40;
    const at = (t) => {
      const mx = (x + ex) / 2 + Math.cos(f.seed) * bend;
      const my = (y + ey) / 2 - Math.abs(Math.sin(f.seed)) * bend - 20;
      const u = 1 - t;
      return [u * u * x + 2 * u * t * mx + t * t * ex, u * u * y + 2 * u * t * my + t * t * ey];
    };
    const p = ease(k);
    for (let i = 8; i >= 0; i--) {
      const t = Math.max(0, p - i * 0.025);
      const [px, py] = at(t);
      ctx.globalAlpha = (1 - i / 9) * 0.9;
      ctx.fillStyle = i ? c0 : '#ffffff';
      const s = i ? 1 : 2;
      ctx.fillRect(Math.round(px - s / 2), Math.round(py - s / 2), s, s);
    }
    const [hx, hy] = at(p);
    glow(ctx, hx, hy, 9, c0, 0.8);
    if (Math.random() < dt * 30) spark(r, hx - ox, hy - oy, c0, { vx: 0, vy: 4, g: 0, life: 0.4, shape: 'star' });
  },

  // A cloud of rot that hangs where it was called: puffs swelling and
  // churning, green motes in it, a sick glow under it.
  cloud(r, ctx, f, k, x, y, dt) {
    const a = k < 0.1 ? k / 0.1 : k > 0.85 ? (1 - k) / 0.15 : 1;
    const R = f.r1 ?? 26;
    glow(ctx, x, y, R * 1.2, '#406010', 0.35 * a);
    for (let i = 0; i < 9; i++) {
      const q = (i / 9) * TAU + f.t * 0.6 * (i % 2 ? 1 : -1);
      const rr = R * (0.3 + 0.5 * hash(f.seed, i));
      const px = x + Math.cos(q) * rr;
      const py = y - 6 + Math.sin(q) * rr * 0.4 + Math.sin(f.t * 2 + i) * 2;
      const s = 6 + 4 * Math.sin(f.t * 1.7 + i);
      ctx.globalAlpha = 0.28 * a;
      ctx.fillStyle = ['#7a9a30', '#a0c040', '#5a7a20'][i % 3];
      ctx.beginPath();
      ctx.arc(px, py, s, 0, TAU);
      ctx.fill();
    }
    if (Math.random() < dt * 14 * a) spark(r, x - ox0(ctx) + (Math.random() - 0.5) * R * 1.6, y - oy0(ctx) - Math.random() * 10, '#c8f070', { vx: 0, vy: -8, g: -4, life: 0.8, shape: 'star' });
  },

  // A ring of slowed time: a great clock-face laid on the ground, its
  // hours ticking round, a hand sweeping back, a violet haze over it.
  clock(r, ctx, f, k, x, y) {
    const [c0, c1] = COLS(f, ['#c0a0ff', '#ffffff']);
    const a = k < 0.12 ? k / 0.12 : k > 0.85 ? (1 - k) / 0.15 : 1;
    const R = (f.r1 ?? 50) * (k < 0.12 ? ease(k / 0.12) : 1);
    glow(ctx, x, y, R, c0, 0.18 * a);
    ring(ctx, x, y, R, 0.42, c0, 2, 0.85 * a);
    ring(ctx, x, y, R * 0.9, 0.42, c1, 1, 0.4 * a);
    ctx.fillStyle = c1;
    for (let i = 0; i < 12; i++) {
      const q = (i / 12) * TAU;
      ctx.globalAlpha = a * 0.9;
      const px = x + Math.cos(q) * R * 0.8;
      const py = y + Math.sin(q) * R * 0.8 * 0.42;
      ctx.fillRect(Math.round(px), Math.round(py), i % 3 ? 1 : 2, i % 3 ? 1 : 2);
    }
    // The hand, sweeping backward, and a slower one.
    const sweep = -f.t * 1.4;
    for (const [len, w, sp] of [[0.75, 2, 1], [0.5, 1, 0.25]]) {
      ctx.globalAlpha = a;
      ctx.strokeStyle = c1;
      ctx.lineWidth = w;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(sweep * sp) * R * len, y + Math.sin(sweep * sp) * R * len * 0.42);
      ctx.stroke();
    }
  },

  // A star falling on someone: a streak of white out of the dark at a
  // slant, a burst of light where it lands.
  star(r, ctx, f, k, x, y) {
    const land = 0.55;
    if (k < land) {
      const p = ease(k / land);
      const sx = x - 50 * (1 - p);
      const sy = y - 130 * (1 - p);
      const op = ctx.globalCompositeOperation;
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createLinearGradient(sx, sy, sx - 20, sy - 52);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(1, 'rgba(160,180,255,0)');
      ctx.strokeStyle = g;
      ctx.lineWidth = 2;
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx - 20, sy - 52);
      ctx.stroke();
      ctx.globalCompositeOperation = op;
      glow(ctx, sx, sy, 8, '#fff8c0', 1);
    } else {
      const q = (k - land) / (1 - land);
      glow(ctx, x, y, 18 * (1 - q * 0.5), '#fff8c0', 1 - q);
      ring(ctx, x, y, 4 + 16 * ease(q), 0.45, '#fff8c0', 1, 1 - q);
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 4; i++) {
        const L = 4 + 10 * (1 - q);
        const qq = (i / 4) * TAU + 0.4;
        ctx.globalAlpha = 1 - q;
        ctx.fillRect(Math.round(x + Math.cos(qq) * L), Math.round(y - 4 + Math.sin(qq) * L * 0.6), 1, 1);
      }
    }
  },

  // A whirlwind: streaks of wind spiralling in round a centre, and dust
  // caught up in it.
  vortex(r, ctx, f, k, x, y, dt) {
    const a = k < 0.15 ? k / 0.15 : k > 0.8 ? (1 - k) / 0.2 : 1;
    const R = f.r1 ?? 40;
    for (let i = 0; i < 18; i++) {
      const base = (i / 18) * TAU + f.t * 7;
      const rr = R * (1 - ((f.t * 0.9 + i / 18) % 1));
      ctx.globalAlpha = 0.75 * a;
      ctx.strokeStyle = i % 3 ? '#e0f4f0' : '#a8c8c0';
      ctx.lineWidth = i % 4 === 0 ? 2 : 1;
      ctx.beginPath();
      ctx.ellipse(x, y - 6 - (1 - rr / R) * 10, rr, rr * 0.4, 0, base, base + 0.9);
      ctx.stroke();
    }
    if (Math.random() < dt * 30 * a) spark(r, x - ox0(ctx) + (Math.random() - 0.5) * R * 1.4, y - oy0(ctx), ['#a89878', '#c8b898'][Math.floor(Math.random() * 2)], { vx: (Math.random() - 0.5) * 60, vy: -30, g: 20, life: 0.6, shape: 'puff' });
  },

  // A shell of light snapping up round someone: a dome, a bright rim, a
  // shimmer running over it, hexes flashing.
  dome(r, ctx, f, k, x, y) {
    const [c0, c1] = COLS(f, ['#80c8ff', '#ffffff']);
    const R = 16 * (k < 0.3 ? ease(k / 0.3) : 1) * (f.big ?? 1);
    const a = k < 0.3 ? 1 : 1 - (k - 0.3) / 0.7;
    drawShell(ctx, x, y, R, c0, c1, a, f.t);
  },

  // A ghost of you striking: a crescent of violet light carved across a
  // foe, and the cut flashing.
  slash(r, ctx, f, k, x, y) {
    const [c0, c1] = COLS(f, ['#b8a8ff', '#ffffff']);
    const ang = f.ang ?? -0.6;
    const p = ease(Math.min(1, k * 2.5));
    const R = 14;
    const a = 1 - Math.max(0, (k - 0.4) / 0.6);
    for (const [w, c, al] of [[4, c0, 0.5], [2, c1, 1]]) {
      ctx.globalAlpha = al * a;
      ctx.strokeStyle = c;
      ctx.lineWidth = w;
      ctx.beginPath();
      ctx.arc(x, y - 8, R, ang - 1.4 * p, ang + 1.4 * p * 0.2);
      ctx.stroke();
    }
    glow(ctx, x, y - 8, 14, c0, 0.6 * a);
  },
};

// (Where the camera is, for a spark thrown off an effect: sparks live in
// view pixels, as the effects' own centres do.)
let CAM = { x: 0, y: 0 };
const ox0 = () => -CAM.x;
const oy0 = () => -CAM.y;
export function setCam(r) {
  CAM = { x: r.camX || 0, y: r.camY || 0 };
}

// A shell of light (an aegis, a ward): its dome, rim and shimmer.
function drawShell(ctx, x, y, R, c0, c1, a, t) {
  if (R <= 0 || a <= 0) return;
  const op = ctx.globalCompositeOperation;
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(x, y - R * 0.6, R * 0.2, x, y - R * 0.6, R * 1.1);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(0.75, c0);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.globalAlpha = 0.35 * a;
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(x, y - R * 0.6, R, R * 1.15, 0, 0, TAU);
  ctx.fill();
  ctx.globalCompositeOperation = op;
  ctx.globalAlpha = 0.8 * a;
  ctx.strokeStyle = c0;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.ellipse(x, y - R * 0.6, R, R * 1.15, 0, 0, TAU);
  ctx.stroke();
  // A shimmer running round it.
  const q = (t * 2.2) % TAU;
  ctx.globalAlpha = 0.9 * a;
  ctx.strokeStyle = c1;
  ctx.beginPath();
  ctx.ellipse(x, y - R * 0.6, R, R * 1.15, 0, q, q + 0.7);
  ctx.stroke();
  // Hexes flashing on it, here and there.
  ctx.fillStyle = c1;
  for (let i = 0; i < 6; i++) {
    const qq = i * 1.7 + Math.floor(t * 3) * 0.9;
    const fl = (Math.sin(t * 6 + i * 2) + 1) / 2;
    ctx.globalAlpha = 0.6 * a * fl;
    ctx.fillRect(Math.round(x + Math.cos(qq) * R * 0.8), Math.round(y - R * 0.6 + Math.sin(qq) * R * 0.9), 2, 1);
  }
}

// ------------------------------------------------------------ on someone
// What's working on someone a while (their `abOn`: "halo,blades"), drawn
// with them as they move: `sx` the left of their sprite, `feetY` their
// feet, on screen.
export function drawAuras(r, ctx, e, sx, feetY, tall, dt) {
  const on = String(e.abOn || '');
  if (!on) return;
  const t = r.time || 0;
  const x = sx + 8;
  const y = feetY;
  const h = tall ? 24 : 14;
  ctx.save();
  try {
    if (on.includes('halo')) {
      // A ring of golden light at their feet, pulsing; motes and crosses
      // rising off it; a soft light up through them.
      const pulse = 0.75 + 0.25 * Math.sin(t * 5);
      glow(ctx, x, y - h / 2, 22, '#f0d060', 0.22 * pulse);
      ring(ctx, x, y, 13 * pulse, 0.42, '#ffe070', 2, 0.85);
      ring(ctx, x, y, 9, 0.42, '#fff8d0', 1, 0.5);
      for (let i = 0; i < 6; i++) {
        const q = t * 1.6 + (i / 6) * TAU;
        const rise = (t * 0.8 + i / 6) % 1;
        ctx.globalAlpha = 1 - rise;
        ctx.fillStyle = i % 2 ? '#fff0a0' : '#a0f0a0';
        const px = Math.round(x + Math.cos(q) * 11);
        const py = Math.round(y + Math.sin(q) * 4.5 - rise * h * 1.2);
        if (i % 3 === 0) {
          ctx.fillRect(px, py - 1, 1, 3);
          ctx.fillRect(px - 1, py, 3, 1);
        } else ctx.fillRect(px, py, 1, 1);
      }
    }
    if (on.includes('bramble')) {
      // A ring of thorny vines round their feet, writhing.
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 10; i++) {
        const q = (i / 10) * TAU + Math.sin(t * 2 + i) * 0.1;
        const px = x + Math.cos(q) * 10;
        const py = y + Math.sin(q) * 4;
        ctx.globalAlpha = 0.9;
        ctx.strokeStyle = '#3a6a20';
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px + Math.cos(q + 1.2) * 3, py - 4 - Math.sin(t * 3 + i));
        ctx.stroke();
        ctx.fillStyle = '#c8e8a0';
        ctx.fillRect(Math.round(px + Math.cos(q + 1.2) * 3), Math.round(py - 4), 1, 1);
      }
      ring(ctx, x, y, 10, 0.4, '#5a8a30', 1, 0.8);
    }
    if (on.includes('rage')) {
      // A red heat round them, flickering, and embers.
      const fl = 0.6 + 0.4 * Math.random();
      glow(ctx, x, y - h / 2, 18, '#ff2010', 0.4 * fl);
      ring(ctx, x, y, 10, 0.42, '#ff4020', 1, 0.6 * fl);
      if (Math.random() < dt * 18) spark(r, x - ox0() + (Math.random() - 0.5) * 12, y - oy0() - Math.random() * h, Math.random() < 0.5 ? '#ff4020' : '#ffb040', { vx: (Math.random() - 0.5) * 10, vy: -25, g: -10, life: 0.5 });
    }
    if (on.includes('quicken')) {
      // Streaks of light behind them, and after-images.
      if (e.look && tall) {
        const sheet = humanoidSheet(e.look);
        const dir = r.viewDir ? r.viewDir(e.dir ?? 0) : e.dir ?? 0;
        const back = [[0, 1], [-1, 0], [0, -1], [1, 0]][dir] || [0, 1];
        for (let i = 1; i <= 2; i++) {
          ctx.globalAlpha = 0.22 / i;
          ctx.filter = 'brightness(1.6) sepia(1) saturate(3) hue-rotate(5deg)';
          ctx.drawImage(sheet, 0, dir * SHEET_H, CHAR_W, SHEET_H, sx - back[0] * 3 * i, feetY - CHAR_H + 1 - SPR_PAD - back[1] * 2 * i, CHAR_W, SHEET_H);
        }
        ctx.filter = 'none';
      }
      if (Math.random() < dt * 20) spark(r, x - ox0() + (Math.random() - 0.5) * 10, y - oy0() - Math.random() * h, '#ffe060', { vx: (Math.random() - 0.5) * 40, vy: 0, g: 0, life: 0.3 });
    }
    if (on.includes('blades')) {
      // Three blades of light circling at the waist, a trail behind each.
      const cy = y - h * 0.45;
      for (let i = 0; i < 3; i++) {
        const q = t * 6 + (i / 3) * TAU;
        for (let j = 4; j >= 0; j--) {
          const qq = q - j * 0.12;
          const bx = x + Math.cos(qq) * 13;
          const by = cy + Math.sin(qq) * 5.5;
          ctx.globalAlpha = j ? 0.18 * (5 - j) / 5 : 1;
          ctx.strokeStyle = j ? '#a0b8ff' : '#ffffff';
          ctx.lineWidth = j ? 1 : 1.5;
          ctx.beginPath();
          ctx.moveTo(bx - Math.sin(qq) * 4, by + Math.cos(qq) * 1.5);
          ctx.lineTo(bx + Math.sin(qq) * 4, by - Math.cos(qq) * 1.5);
          ctx.stroke();
        }
      }
      glow(ctx, x, cy, 16, '#8098ff', 0.18);
    }
    if (on.includes('aegis')) drawShell(ctx, x, y, tall ? 13 : 9, '#80c8ff', '#ffffff', 0.75, t);
    if (on.includes('stasis')) ring(ctx, x, y, 12, 0.42, '#c0a0ff', 1, 0.4 + 0.3 * Math.sin(t * 8));
  } finally {
    ctx.restore();
  }
}
