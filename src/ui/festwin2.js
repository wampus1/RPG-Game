// (Round 129) Each people's own game at its festival (see festwin.js for
// the window they're played in, and game/festplay.js for the contests):
//   - ringing the bell: the hammer brought down on the striker, the puck
//     up the tower (the vales, the fire peoples, the jungle, the south);
//   - the log toss: the run with the log held up, the heave, the flip (the
//     north, the highlands);
//   - the raft race across the harbour, paddling, steering round what's
//     floating (the island and salt peoples);
//   - the lantern walk through the mist, keeping the flame alive against
//     the gusts (the mist peoples, the jade court).
// Painted the same way: a scene of 256 by 144, lasting parts once, what
// moves a pixel at a time; the words in the view's pixels.
import { Bmp, rgb, hex, ramp, mixC, hash2, hills as paintHills, pine, broadTree } from '../render/brush.js';
import { drawPerson } from '../render/scenekit.js';
import {
  SW, SH, UW, mixH, rand, landOf, paintSky, cloudShapes, drawClouds, rect, dot, line, disc, bunting, post, lantern, folk, crowd, sprite, text, panel, meter,
  DEFAULT_LOOK, dusk, tintOf, darken, rain,
} from './festpaint.js';

// The green or the square by day: sky, hills, trees, grass (painted once).
function fieldBackdrop(cfg, horizon) {
  const b = new Bmp(SW, SH);
  const S = paintSky(b, horizon, cfg.hour, cfg.wet, cfg.seed);
  const land = landOf(cfg.style);
  const air = rgb(S.low);
  const crest = (x) => horizon - 7 + Math.sin(x * 0.035 + cfg.seed) * 4 + Math.sin(x * 0.11) * 1.4;
  paintHills(b, crest, horizon + 2, ramp(land, 4, { spread: 0.3 }).map((c) => mixC(c, air, 0.35)), { seed: 7 });
  const leaf = ramp(land, 5, { spread: 0.4 }).map((c) => mixC(c, air, 0.2));
  const fir = ramp('#3a5a3a', 5, { spread: 0.34 }).map((c) => mixC(c, air, 0.2));
  const bark = [rgb('#3a2a20'), rgb('#4a3428'), rgb('#5a4030')];
  const r = rand(cfg.seed + 13);
  for (let x = -4; x < SW + 4; x += 6 + Math.floor(r() * 9)) {
    const yb = Math.round(crest(x) + 4 + r() * 2);
    if (r() < 0.45) pine(b, x, yb, 7 + r() * 6, fir, bark, x * 7 + 1, { bare: false });
    else broadTree(b, x, yb, 8 + r() * 6, leaf, bark, x * 3 + 5);
  }
  const g = ramp(land, 4, { spread: 0.24 });
  for (let y = horizon; y < SH; y++) for (let x = 0; x < SW; x++) {
    const n = hash2(x, y, 4) + (hash2(x >> 2, y >> 1, 5) - 0.5) * 0.4;
    b.set(x, y, n < 0.15 ? g[0] : n < 0.6 ? g[1] : n < 0.95 ? g[2] : g[3]);
  }
  darken(b, horizon - 20, S.light);
  return { canvas: b.canvas(), S };
}

// ------------------------------------------------------------ the bell
// The striker: a swinging needle for how hard; SPACE (or a click) to bring
// the hammer down at the top of it. Three swings, the best counts; ring
// the bell at the top for a hundred.
const TOWER = { x: 162, top: 22, base: 120 };
class Hammer {
  constructor(win, cfg) {
    this.win = win;
    this.cfg = cfg;
    this.swings = [];
    this.p = 0;
    this.state = 'aim';
    this.st = 0;
    this.power = 0;
    this.ring = 0;
    this.excite = 0;
    this.running = false;
    this.folk = folk(cfg.seed + 31, 50, win.colours);
    this.clouds = cloudShapes(cfg.seed + 3, 4, cfg.wet);
    this.rules = ['THE NEEDLE SWINGS: BRING THE HAMMER DOWN', 'AT THE TOP OF IT (SPACE OR A CLICK)', 'RING THE BELL FOR A HUNDRED', 'THREE SWINGS: THE BEST COUNTS'];
    this.hint = 'SWING: SPACE OR CLICK  ·  ESC: LEAVE';
  }

  begin() {
    this.running = true;
  }

  best() {
    return this.swings.length ? Math.max(...this.swings) : 0;
  }

  partial() {
    return { score: this.best() };
  }

  needle() {
    const q = this.p % 2;
    return q < 1 ? q : 2 - q;
  }

  swing() {
    if (!this.running || this.state !== 'aim' || this.swings.length >= 3) return;
    this.power = this.needle();
    this.state = 'swing';
    this.st = 0;
  }

  onKey(k) {
    if (k.code === 'Space' && !k.repeat) this.swing();
  }

  onClick() {
    this.swing();
  }

  update(dt) {
    if (!this.running) return;
    this.excite = Math.max(0, this.excite - dt * 0.6);
    this.ring = Math.max(0, this.ring - dt);
    this.st += dt;
    if (this.state === 'aim') this.p += dt * (1.5 + this.swings.length * 0.45);
    if (this.state === 'swing' && this.st >= 0.25) {
      this.state = 'up';
      this.st = 0;
      this.win.sfx('impact');
    }
    if (this.state === 'up' && this.st >= 0.7) {
      const score = Math.round(this.power * 100);
      this.swings.push(score);
      if (this.power >= 0.96) {
        this.ring = 1.2;
        this.win.sfx('bell');
        this.win.sfx('reveal_great');
        this.win.sparks.burst(TOWER.x + 1, TOWER.top - 8, 24, ['#ffe070', '#ffffff', '#ffb040'], 40, 0.9, 50);
        this.win.pops.add('DING!', TOWER.x, TOWER.top - 14, '#ffe070', 3);
        this.excite = 1;
      } else {
        this.win.pops.add(String(score), TOWER.x + 18, this.puckY() - 6, score >= 75 ? '#ffd060' : '#f0e0c0', 2);
        this.excite = this.power * 0.7;
        if (score < 40) this.win.sfx('reveal_poor');
      }
      this.state = 'down';
      this.st = 0;
    }
    if (this.state === 'down' && this.st >= 0.8) {
      this.state = 'aim';
      this.st = 0;
      if (this.swings.length >= 3) setTimeout(() => this.win.finish({ score: this.best() }), 600);
    }
  }

  // Where the puck is up the tower.
  puckY() {
    const H = TOWER.base - TOWER.top;
    let f = 0;
    if (this.state === 'up') {
      const k = Math.min(1, this.st / 0.55);
      f = this.power * (1 - (1 - k) * (1 - k));
    } else if (this.state === 'down') f = this.power * Math.max(0, 1 - this.st / 0.6) ** 2;
    return Math.round(TOWER.base - 3 - f * (H - 4));
  }

  headline() {
    const s = this.best();
    return s >= 96 ? 'YOU RANG THE BELL!' : s >= 75 ? 'A MIGHTY BLOW' : s >= 50 ? 'NOT BAD' : 'PUT YOUR BACK INTO IT!';
  }

  scoreLine() {
    return `BEST ${this.best()} OF 100`;
  }

  paint(g, t) {
    const cfg = this.cfg;
    if (!this.bg) {
      const f = fieldBackdrop(cfg, 70);
      this.bg = f.canvas;
      this.S = f.S;
    }
    const L = this.S.light;
    g.drawImage(this.bg, 0, 0);
    drawClouds(g, this.clouds, t, this.S);
    g.drawImage(this.bg, 0, 50, SW, 22, 0, 50, SW, 22);
    post(g, 20, 14, 112, L);
    post(g, 234, 14, 112, L);
    bunting(g, 21, 16, 234, 16, 10, this.win.colours, t, 0.3);
    crowd(g, 4, 110, 116, 3, this.folk, t, this.excite, { face: 'front', light: L, gap: 6 });
    crowd(g, 196, 252, 116, 3, this.folk, t + 3, this.excite, { face: 'front', light: L, gap: 6 });
    this.paintTower(g, L, t);
    // You, and the hammer.
    const x = 140;
    const yb = 124;
    const up = this.state === 'aim' ? 0.4 + Math.sin(t * 3) * 0.05 : this.state === 'swing' ? 1 - this.st / 0.25 : 0;
    sprite(g, cfg.look || DEFAULT_LOOK, x, yb, 3, this.state === 'swing' ? 3 : 0, { tint: tintOf(L) });
    const hx = x + 6;
    const hy = yb - 14;
    const ang = -Math.PI / 2 - up * 1.4 + 0.2;
    const ex = hx + Math.cos(ang + Math.PI / 2) * 14;
    const ey = hy + Math.sin(ang + Math.PI / 2) * 14;
    line(g, hx, hy, ex, ey, '#8a6a3a');
    line(g, hx + 1, hy, ex + 1, ey, '#5a3a1a');
    rect(g, ex - 4, ey - 3, 8, 6, '#3a3a42');
    rect(g, ex - 4, ey - 3, 8, 1, '#9a9aa2');
    rect(g, ex - 4, ey - 2, 1, 4, '#6a6a72');
    if (cfg.wet) rain(g, t, 0.6);
  }

  paintTower(g, L, t) {
    const { x, top, base } = TOWER;
    const H = base - top;
    const k = dusk(L);
    // The board, its bands in colours, the marks up it.
    for (let y = top; y < base; y++) {
      const f = (base - y) / H;
      const c = f > 0.85 ? '#d83a2a' : f > 0.65 ? '#e88a2a' : f > 0.4 ? '#e8c840' : '#5aa040';
      rect(g, x - 3, y, 8, 1, mixH(c, '#0a0c22', k));
      if ((base - y) % 8 === 0) rect(g, x - 3, y, 3, 1, mixH('#ffffff', '#0a0c22', k));
    }
    rect(g, x - 4, top, 1, H, '#3a2410');
    rect(g, x + 5, top, 1, H, '#3a2410');
    rect(g, x, top, 2, H, 'rgba(0,0,0,0.25)');
    // The pad at its foot.
    rect(g, x - 8, base, 18, 3, '#5a5a62');
    rect(g, x - 8, base, 18, 1, '#9a9aa2');
    rect(g, x - 10, base + 3, 22, 2, '#3a2410');
    // The bell, shaking when it's rung.
    const sh = this.ring > 0 ? (Math.floor(t * 30) % 2 ? 1 : -1) : 0;
    rect(g, x - 1, top - 4, 4, 4, '#3a2410');
    disc(g, x + 1 + sh, top - 8, 4, '#a87808');
    disc(g, x + 1 + sh, top - 9, 3, '#f0c030');
    dot(g, x + sh, top - 10, '#fff0a0');
    // The puck.
    const py = this.puckY();
    rect(g, x - 1, py, 4, 3, '#2a2a30');
    dot(g, x, py, '#8a8a92');
  }

  paintUI(u) {
    // The needle: how hard, now.
    const w = 180;
    const x0 = UW / 2 - w / 2;
    const y0 = UH_ - 44;
    panel(u, x0 - 8, y0 - 14, w + 16, 34);
    text(u, 'HOW HARD', UW / 2, y0 - 10, '#c8b890', { align: 'center' });
    for (let i = 0; i < w; i++) {
      const f = i / w;
      rect(u, x0 + i, y0, 1, 10, f > 0.95 ? '#ff4030' : f > 0.75 ? '#f0a030' : f > 0.45 ? '#e8d040' : '#5aa040');
    }
    const n = this.state === 'aim' ? this.needle() : this.power;
    const nx = Math.round(x0 + n * (w - 1));
    rect(u, nx - 1, y0 - 3, 3, 16, '#ffffff');
    rect(u, nx, y0 - 2, 1, 14, '#000000');
    panel(u, 8, 8, 100, 46, { fill: 'rgba(30,22,14,0.92)' });
    text(u, 'SWINGS', 58, 13, '#ffe070', { align: 'center' });
    for (let i = 0; i < 3; i++) {
      const v = this.swings[i];
      text(u, v === undefined ? '-' : String(v), 28 + i * 30, 30, v >= 96 ? '#ffe070' : '#f0e0c0', { align: 'center' });
    }
  }
}
const UH_ = 288;

// ------------------------------------------------------------ the log toss
// Hold SPACE to run up with the log (let go before it gets away from you),
// then SPACE again as the angle's right: the further it flips, the better.
// Three throws.
const FT = 3; // pixels to a foot
const LINE_X = 56;
class LogToss {
  constructor(win, cfg) {
    this.win = win;
    this.cfg = cfg;
    this.throws = [];
    this.state = 'ready';
    this.speed = 0;
    this.heldT = 0;
    this.angT = 0;
    this.ang = 0;
    this.fly = null;
    this.excite = 0;
    this.running = false;
    this.folk = folk(cfg.seed + 41, 50, win.colours);
    this.clouds = cloudShapes(cfg.seed + 5, 4, cfg.wet);
    this.rules = ['HOLD SPACE TO RUN UP WITH THE LOG,', 'LET GO BEFORE IT GETS AWAY FROM YOU', 'THEN SPACE AGAIN AS THE ANGLE IS RIGHT', 'THREE THROWS: THE FURTHEST COUNTS'];
    this.hint = 'RUN: HOLD SPACE  ·  HEAVE: SPACE  ·  ESC: LEAVE';
  }

  begin() {
    this.running = true;
  }

  best() {
    return this.throws.length ? Math.max(...this.throws) : 0;
  }

  partial() {
    return { score: this.best() };
  }

  onKey(k) {
    if (!this.running || k.code !== 'Space' || k.repeat) return;
    if (this.state === 'angle') this.heave();
  }

  heave() {
    const th = this.ang;
    const r = rand((this.cfg.seed || 1) + this.throws.length * 13)();
    const d = Math.max(2, Math.round(60 * this.speed * Math.sin(2 * th) * (0.9 + r * 0.1)));
    this.fly = { t: 0, dur: 0.9 + d / 80, d };
    this.state = 'fly';
    this.win.sfx('whoosh');
  }

  update(dt) {
    if (!this.running) return;
    this.excite = Math.max(0, this.excite - dt * 0.6);
    const w = this.win;
    if (this.state === 'ready' || this.state === 'run') {
      if (w.held('Space') || w.mouse().down) {
        this.state = 'run';
        this.heldT += dt;
        this.speed = Math.min(1, this.heldT / 1.4);
        if (this.heldT > 2.3) {
          // (Too long: it's away from you.)
          this.throws.push(0);
          w.pops.add('DROPPED IT!', 70, 70, '#ff7060', 2);
          w.sfx('thud');
          this.reset();
        }
      } else if (this.state === 'run') {
        this.state = 'angle';
        this.angT = 0;
      }
    } else if (this.state === 'angle') {
      this.angT += dt;
      const q = (this.angT * 1.3) % 2;
      this.ang = (15 + (q < 1 ? q : 2 - q) * 65) * (Math.PI / 180);
      if (this.angT > 4) this.heave();
    } else if (this.state === 'fly') {
      this.fly.t += dt;
      if (this.fly.t >= this.fly.dur) {
        const d = this.fly.d;
        this.throws.push(d);
        w.sfx('thud');
        w.sparks.burst(LINE_X + d * FT, 124, 14, ['#8a7a5a', '#b8a888', '#5a4a30'], 30, 0.6, 80);
        w.pops.add(`${d} FT`, LINE_X + d * FT, 100, d >= 40 ? '#ffe070' : '#f0e0c0', 2);
        this.excite = Math.min(1, d / 45);
        if (d >= 40) w.sfx('reveal_great');
        this.reset();
      }
    }
  }

  reset() {
    this.fly = null;
    this.speed = 0;
    this.heldT = 0;
    this.state = this.throws.length >= 3 ? 'done' : 'ready';
    if (this.state === 'done') setTimeout(() => this.win.finish({ score: this.best() }), 900);
  }

  headline() {
    const s = this.best();
    return s >= 45 ? 'A MIGHTY HEAVE!' : s >= 32 ? 'A FINE THROW' : s >= 18 ? 'NOT BAD AT ALL' : 'TOO HEAVY FOR YOU?';
  }

  scoreLine() {
    return `BEST ${this.best()} FEET`;
  }

  paint(g, t) {
    const cfg = this.cfg;
    if (!this.bg) {
      const f = fieldBackdrop(cfg, 74);
      // The marks along the ground, every ten feet.
      const c = f.canvas.getContext('2d');
      for (let d = 0; d <= 60; d += 10) {
        const x = LINE_X + d * FT;
        c.fillStyle = d === 0 ? '#f0f0e0' : 'rgba(240,240,224,0.6)';
        c.fillRect(x, 120, 1, d === 0 ? 10 : 4);
      }
      this.bg = f.canvas;
      this.S = f.S;
    }
    const L = this.S.light;
    g.drawImage(this.bg, 0, 0);
    drawClouds(g, this.clouds, t, this.S);
    g.drawImage(this.bg, 0, 54, SW, 22, 0, 54, SW, 22);
    post(g, 6, 20, 112, L);
    post(g, 248, 20, 112, L);
    bunting(g, 7, 22, 248, 22, 10, this.win.colours, t, 0.3);
    crowd(g, 50, 250, 94, 2, this.folk, t, this.excite, { face: 'front', light: L, gap: 6 });
    rect(g, 44, 95, 210, 1, mixH('#c8b080', '#201810', dusk(L)));
    // Where the best throw so far came down.
    const best = this.best();
    if (best > 0) {
      const bx = LINE_X + best * FT;
      rect(g, bx, 116, 1, 8, '#3a2410');
      rect(g, bx + 1, 116, 4, 3, '#e83a3a');
    }
    // You, with the log; running up, it bobs.
    const run = this.state === 'run' ? Math.round(this.speed * 10) : 0;
    const x = 30 + run;
    const yb = 126;
    const step = this.state === 'run' ? 1 + (Math.floor(t * 10) % 2) : this.state === 'angle' ? 3 : 0;
    sprite(g, cfg.look || DEFAULT_LOOK, x, yb, 3, step, { tint: tintOf(L) });
    if (this.state !== 'fly') {
      const lean = this.state === 'angle' ? (Math.PI / 2 - this.ang) : this.state === 'run' ? Math.sin(t * 9) * 0.06 : 0;
      this.paintLog(g, x + 6, yb - 12, lean, 36);
    } else {
      const f = this.fly;
      const k = f.t / f.dur;
      const x1 = LINE_X + f.d * FT;
      const lx = x + 6 + (x1 - x - 6) * k;
      const ly = yb - 20 - Math.sin(k * Math.PI) * (16 + f.d * 0.8) + k * 14;
      this.paintLog(g, lx, ly, k * Math.PI * 1.5, 36, true);
    }
    if (cfg.wet) rain(g, t, 0.6);
  }

  // The log: four pixels thick, its bark in bands, held at its foot (or by
  // its middle, in the air), at `a` from upright.
  paintLog(g, x, y, a, len, mid = false) {
    const bark = ramp('#6a4a2a', 4, { spread: 0.34 }).map(hex);
    const ux = Math.sin(a);
    const uy = -Math.cos(a);
    const ox = mid ? -ux * len / 2 : 0;
    const oy = mid ? -uy * len / 2 : 0;
    for (let i = 0; i < len; i++) {
      const px = x + ox + ux * i;
      const py = y + oy + uy * i;
      for (let k = -2; k <= 1; k++) dot(g, px - uy * k, py + ux * k, k === -2 ? bark[3] : k === 1 ? bark[0] : i % 5 === 0 ? bark[1] : bark[2]);
    }
    dot(g, x + ox + ux * (len - 1), y + oy + uy * (len - 1), '#d8b888');
  }

  paintUI(u) {
    if (this.state === 'run' || this.state === 'ready') meter(u, UW / 2 - 70, UH_ - 34, 140, 8, this.speed, this.heldT > 1.8 ? '#ff5040' : '#80e070', 'RUN UP');
    if (this.state === 'angle') {
      const cx = 100;
      const cy = 230;
      panel(u, cx - 40, cy - 46, 80, 56);
      text(u, 'ANGLE', cx, cy - 42, '#c8b890', { align: 'center' });
      for (let a = 15; a <= 80; a += 1) {
        const r = a > 38 && a < 52 ? '#80e070' : '#a89878';
        const t2 = (a * Math.PI) / 180;
        dot(u, cx - 20 + Math.cos(t2) * 34, cy + 4 - Math.sin(t2) * 34, r);
      }
      line(u, cx - 20, cy + 4, cx - 20 + Math.cos(this.ang) * 30, cy + 4 - Math.sin(this.ang) * 30, '#ffffff');
    }
    panel(u, 8, 8, 100, 46, { fill: 'rgba(30,22,14,0.92)' });
    text(u, 'THROWS', 58, 13, '#ffe070', { align: 'center' });
    for (let i = 0; i < 3; i++) {
      const v = this.throws[i];
      text(u, v === undefined ? '-' : `${v}`, 28 + i * 30, 30, v >= 40 ? '#ffe070' : v === 0 ? '#ff7060' : '#f0e0c0', { align: 'center' });
    }
  }
}

// ------------------------------------------------------------ the raft race
// Across the harbour: A and D (or LEFT and RIGHT) in turn to paddle, W and
// S (UP, DOWN) to steer round what's floating in the way. The quickest
// across wins.
const COURSE = 620;
const LANE_Y = [64, 84, 104];
class Raft {
  constructor(win, cfg) {
    this.win = win;
    this.cfg = cfg;
    this.x = 20;
    this.dy = 0;
    this.v = 0;
    this.time = 0;
    this.lastKey = null;
    this.stroke = 0;
    this.done = false;
    this.running = false;
    this.excite = 0;
    const r = rand(cfg.seed + 7);
    this.junk = [];
    for (let x = 90; x < COURSE - 30; x += 40 + Math.floor(r() * 50)) this.junk.push({ x, dy: Math.round((r() - 0.5) * 10), kind: r() < 0.5 ? 'log' : 'crate', hit: false });
    this.rivals = (cfg.rivals || []).slice(0, 2).map((q) => ({ ...q, x: 20, time: Math.max(24, q.time || 40), stroke: 0 }));
    this.folk = folk(cfg.seed + 51, 70, win.colours);
    this.rules = ['A AND D (OR LEFT AND RIGHT) IN TURN TO PADDLE', 'W AND S (UP, DOWN) TO STEER ROUND', 'WHAT\'S FLOATING IN THE WAY', 'FIRST ACROSS THE HARBOUR WINS'];
    this.hint = 'PADDLE: A / D IN TURN  ·  STEER: W / S  ·  ESC: LEAVE';
  }

  begin() {
    this.running = true;
  }

  partial() {
    return { score: 120 };
  }

  onKey(k) {
    if (!this.running || this.done || k.repeat) return;
    const side = k.code === 'KeyA' || k.code === 'ArrowLeft' ? 'L' : k.code === 'KeyD' || k.code === 'ArrowRight' ? 'R' : null;
    if (!side || side === this.lastKey) return;
    this.lastKey = side;
    this.v = Math.min(48, this.v + 7);
    this.stroke = side === 'L' ? -1 : 1;
    if (Math.random() < 0.3) this.win.sfx('splash');
  }

  update(dt) {
    if (!this.running) return;
    const w = this.win;
    this.excite = Math.max(0, this.excite - dt * 0.5);
    for (const q of this.rivals) {
      // (Each at their own pace, a stroke at a time.)
      const pace = COURSE / q.time;
      q.x = Math.min(COURSE, q.x + pace * dt * (0.85 + Math.sin(this.time * 3 + q.x) * 0.25));
      q.stroke = Math.sin(this.time * 7 + q.x) > 0 ? 1 : -1;
    }
    if (this.done) return;
    this.time += dt;
    if (w.held('KeyW', 'ArrowUp')) this.dy = Math.max(-7, this.dy - dt * 18);
    if (w.held('KeyS', 'ArrowDown')) this.dy = Math.min(7, this.dy + dt * 18);
    // The water's drag, and the wind's gusts against you.
    const gust = Math.max(0, Math.sin(this.time * 0.7)) * 4;
    this.v = Math.max(0, this.v - (this.v * 0.9 + gust) * dt);
    this.x += this.v * dt;
    for (const j of this.junk) {
      if (j.hit || Math.abs(j.x - this.x) > 6 || Math.abs(j.dy - this.dy) > 4) continue;
      j.hit = true;
      this.v *= 0.25;
      w.sfx('thud');
      w.sparks.burst(j.x - this.cam(), LANE_Y[1] + j.dy, 10, ['#e0f0ff', '#a8d0f0'], 30, 0.5, 80);
      w.pops.add('BUMP!', j.x - this.cam(), LANE_Y[1] - 10, '#ff9060', 2);
    }
    if (this.x >= COURSE) {
      this.done = true;
      const tm = Math.round(this.time * 10) / 10;
      w.pops.add(`${tm}s!`, 128, 40, '#ffe070', 3, 1.5);
      w.sfx('fanfare');
      this.excite = 1;
      setTimeout(() => w.finish({ score: tm }), 1200);
    }
  }

  cam() {
    return Math.max(0, Math.min(COURSE + 40 - SW, this.x - 70));
  }

  headline() {
    const t = this.time;
    return t < 30 ? 'SWIFT AS A GULL!' : t < 40 ? 'A FINE CROSSING' : t < 55 ? 'YOU MADE IT ACROSS' : 'A LONG ROW...';
  }

  scoreLine() {
    return `${(Math.round(this.time * 10) / 10).toFixed(1)} SECONDS`;
  }

  backdrop() {
    const cfg = this.cfg;
    const b = new Bmp(SW, 48);
    const S = paintSky(b, 40, cfg.hour, cfg.wet, cfg.seed);
    this.S = S;
    const land = landOf(cfg.style);
    const air = rgb(S.low);
    const crest = (x) => 36 + Math.sin(x * 0.05 + 1) * 3 + Math.sin(x * 0.17) * 1.2;
    paintHills(b, crest, 46, ramp(land, 4, { spread: 0.3 }).map((c) => mixC(c, air, 0.4)), { seed: 9 });
    // Little houses along the far shore.
    const r = rand(cfg.seed + 3);
    for (let x = 6; x < SW; x += 14 + Math.floor(r() * 20)) {
      const h = 3 + Math.floor(r() * 3);
      const yb = Math.round(crest(x) + 4);
      for (let y = yb - h; y < yb; y++) for (let i = 0; i < 5; i++) b.set(x + i, y, mixC([230, 220, 200], air, 0.4));
      for (let i = -1; i < 6; i++) b.set(x + i, yb - h - 1, mixC([160, 70, 50], air, 0.4));
    }
    darken(b, 24, S.light);
    return b.canvas();
  }

  paint(g, t) {
    const cfg = this.cfg;
    this.bg ||= this.backdrop();
    const L = this.S.light;
    const k = dusk(L);
    g.drawImage(this.bg, 0, 0);
    const cam = this.cam();
    // The water: bands of it, the swell moving, glints.
    const water = ramp('#2a6a9a', 4, { spread: 0.34 }).map((c) => hex(mixC(c, [10, 12, 40], k)));
    for (let y = 44; y < 128; y++) {
      const band = Math.floor((y - 44) / 6 + Math.sin(y * 0.4 + t) * 0.3);
      rect(g, 0, y, SW, 1, water[1 + (band % 2)]);
    }
    for (let i = 0; i < 160; i++) {
      const wx = Math.floor((hash2(i, 1, 3) * 900 - cam * (0.6 + hash2(i, 2, 3) * 0.4) + t * 6) % SW + SW) % SW;
      const wy = 46 + Math.floor(hash2(i, 3, 3) * 80);
      if (Math.sin(t * 2 + i) > 0.2) rect(g, wx, wy, 2 + Math.floor(hash2(i, 4, 3) * 3), 1, water[3]);
    }
    // The buoys along the lanes, the finish flags.
    for (let bx = 60; bx < COURSE; bx += 60) {
      const sx = bx - cam;
      if (sx < -4 || sx > SW + 4) continue;
      for (const ly of [74, 94]) {
        rect(g, sx - 1, ly - 2 + (Math.floor(t * 2 + bx) % 2), 3, 3, bx % 120 ? '#e83a3a' : '#f4f0e0');
        dot(g, sx, ly - 3, '#ffffff');
      }
    }
    const fx = COURSE - cam;
    if (fx < SW + 4) {
      for (const ly of [52, 116]) {
        rect(g, fx, ly - 14, 1, 16, '#3a2410');
        for (let i = 0; i < 6; i++) rect(g, fx + 1 + i, ly - 14 + (Math.floor(t * 4) % 2), 1, 4, (i + Math.floor(t * 4)) % 2 ? '#ffffff' : '#1a1a1a');
      }
    }
    // What's floating in your lane.
    for (const j of this.junk) {
      const sx = j.x - cam;
      if (sx < -10 || sx > SW + 10) continue;
      const y = LANE_Y[1] + j.dy;
      if (j.kind === 'log') {
        rect(g, sx - 5, y, 10, 2, '#5a3a1a');
        rect(g, sx - 5, y, 10, 1, '#7a5a2a');
      } else {
        rect(g, sx - 2, y - 2, 5, 4, '#8a6a3a');
        rect(g, sx - 2, y - 2, 5, 1, '#b8945a');
      }
    }
    // The rafts: the others, and yours.
    this.rivals.forEach((q, i) => this.paintRaft(g, q.x - cam, LANE_Y[i === 0 ? 0 : 2], q.stroke, this.win.colours[(i + 1) % this.win.colours.length], t, L));
    this.paintRaft(g, this.x - cam, LANE_Y[1] + this.dy, this.stroke, this.win.colours[0], t, L, true);
    // The quay along the bottom, and those cheering on it.
    const stone = ramp('#8a8478', 3, { spread: 0.3 }).map((c) => hex(mixC(c, [10, 12, 40], k)));
    for (let y = 128; y < SH; y++) rect(g, 0, y, SW, 1, y === 128 ? stone[2] : stone[1]);
    for (let x = -((cam * 1) % 12); x < SW; x += 12) rect(g, x, 129, 1, 15, stone[0]);
    crowd(g, 0, 256, 140, 2, this.folk, t, this.excite, { face: 'back', light: Math.max(0.35, L), gap: 6 });
    if (cfg.wet) rain(g, t, 0.7);
  }

  paintRaft(g, x, y, stroke, sail, t, L, you = false) {
    x = Math.round(x);
    y = Math.round(y);
    if (x < -20 || x > SW + 20) return;
    const bob = Math.floor(t * 3 + x * 0.1) % 2;
    // Its wake.
    for (let i = 1; i < 6; i++) dot(g, x - 8 - i * 2, y + 2 + (i % 2), 'rgba(255,255,255,0.5)');
    // The planks, the mast, the sail.
    const wood = ramp('#8a5a2a', 3, { spread: 0.3 }).map(hex);
    rect(g, x - 8, y + bob, 16, 3, wood[1]);
    rect(g, x - 8, y + bob, 16, 1, wood[2]);
    for (let i = -8; i < 8; i += 4) rect(g, x + i, y + bob, 1, 3, wood[0]);
    rect(g, x - 1, y - 14 + bob, 1, 14, '#3a2410');
    for (let j = 0; j < 10; j++) rect(g, x, y - 13 + j + bob, Math.max(1, Math.round(j * 0.7)), 1, j % 3 === 2 ? mixH(sail, '#000000', 0.2) : sail);
    // Whoever's paddling, the paddle on one side and then the other.
    const pen = (px, py, c) => c && dot(g, px, py, mixH(c, '#0a0c22', dusk(L) * 0.6));
    drawPerson(pen, x - 4, y + bob, { size: 'small', shirt: you ? '#e8d8a0' : '#6a4a3a', skin: '#e0b090', hair: '#3a2418', pose: 'stand' });
    line(g, x - 4 + stroke * 3, y - 4 + bob, x - 4 + stroke * 5, y + 4 + bob, '#c8a060');
    if (you) dot(g, x - 4, y - 9 + bob, '#ffe070');
  }

  paintUI(u) {
    text(u, `${(Math.round(this.time * 10) / 10).toFixed(1)}s`, UW - 12, 8, '#ffe8b0', { scale: 2, align: 'right' });
    meter(u, 12, 16, 140, 7, this.x / COURSE, '#70c8ff', 'ACROSS');
    meter(u, 12, 36, 80, 6, this.v / 48, '#80e070', null);
    // Who's ahead.
    const order = [{ n: 'YOU', x: this.x, you: true }, ...this.rivals.map((q) => ({ n: String(q.name).split(' ')[0].toUpperCase(), x: q.x }))].sort((a, b) => b.x - a.x);
    order.forEach((q, i) => text(u, `${i + 1}. ${q.n}`, UW - 12, 30 + i * 10, q.you ? '#ffe070' : '#d8c8a8', { align: 'right' }));
  }
}

// ------------------------------------------------------------ the lantern walk
// Through the mist behind the procession, the lantern held out: when a gust
// comes (from the left or the right) shield the flame on that side (LEFT,
// RIGHT); let it go out and you'll need to light it again (hold SPACE).
const WALK_SECS = 36;
class Lantern {
  constructor(win, cfg) {
    this.win = win;
    this.cfg = cfg;
    this.t = 0;
    this.flame = 1;
    this.sum = 0;
    this.outs = 0;
    this.shield = null;
    this.shieldT = 0;
    this.relight = 0;
    this.running = false;
    this.gusts = [];
    const r = rand(cfg.seed + 61);
    for (let at = 3; at < WALK_SECS - 2; at += 2.2 + r() * 2) this.gusts.push({ at, side: r() < 0.5 ? -1 : 1, done: false });
    this.rules = ['WALK WITH THE LANTERN THROUGH THE MIST', 'A GUST COMES FROM THE LEFT OR THE RIGHT:', 'SHIELD THE FLAME THAT SIDE (LEFT, RIGHT)', 'IF IT GOES OUT, HOLD SPACE TO RELIGHT IT'];
    this.hint = 'SHIELD: ← / →  ·  RELIGHT: HOLD SPACE  ·  ESC: LEAVE';
  }

  begin() {
    this.running = true;
  }

  score() {
    return Math.max(0, Math.min(100, Math.round((this.sum / Math.max(0.1, Math.min(this.t, WALK_SECS))) * 100 - this.outs * 8)));
  }

  partial() {
    return { score: this.score() };
  }

  onKey(k) {
    if (!this.running || k.repeat) return;
    const side = k.code === 'ArrowLeft' || k.code === 'KeyA' ? -1 : k.code === 'ArrowRight' || k.code === 'KeyD' ? 1 : 0;
    if (side) {
      this.shield = side;
      this.shieldT = 0.6;
    }
  }

  update(dt) {
    if (!this.running || this.t >= WALK_SECS) return;
    const w = this.win;
    this.t += dt;
    this.sum += this.flame * dt;
    if (this.shieldT > 0) this.shieldT -= dt;
    else this.shield = null;
    if (this.flame <= 0) {
      if (w.held('Space')) {
        this.relight += dt;
        if (this.relight >= 1.5) {
          this.flame = 0.6;
          this.relight = 0;
          w.sfx('torch');
        }
      } else this.relight = 0;
    } else this.flame = Math.min(1, this.flame + dt * 0.04);
    for (const q of this.gusts) {
      if (q.done || this.t < q.at) continue;
      q.done = true;
      if (this.flame <= 0) continue;
      if (this.shield === q.side) {
        w.pops.add('SHIELDED', 128 + q.side * 18, 92, '#a8f0a0', 1, 0.8);
        w.sfx('click');
      } else {
        this.flame = Math.max(0, this.flame - 0.42);
        w.sfx('gust');
        if (this.flame <= 0) {
          this.outs++;
          w.pops.add('IT\'S OUT!', 128, 80, '#ff7060', 2);
        } else w.pops.add('FLICKER!', 128, 86, '#ffd070', 1, 0.8);
      }
    }
    if (this.t >= WALK_SECS) {
      w.sfx('fanfare');
      setTimeout(() => w.finish({ score: this.score() }), 900);
    }
  }

  headline() {
    const s = this.score();
    return s >= 85 ? 'THE FLAME HELD!' : s >= 60 ? 'A STEADY HAND' : s >= 35 ? 'IT FLICKERED, BUT...' : 'LOST IN THE MIST';
  }

  scoreLine() {
    return `${this.score()} OF 100`;
  }

  backdrop() {
    const cfg = this.cfg;
    const b = new Bmp(SW, SH);
    this.S = paintSky(b, 60, Math.max(cfg.hour, 21), cfg.wet, cfg.seed);
    // Trees either side, darker the nearer; the path between, receding.
    const fir = ramp('#1a2a24', 5, { spread: 0.2 });
    const bark = [rgb('#141010'), rgb('#1a1414'), rgb('#201818')];
    const r = rand(cfg.seed + 17);
    for (let i = 0; i < 40; i++) {
      const side = i % 2 ? 1 : -1;
      const dz = r();
      const x = Math.round(128 + side * (24 + dz * 110) + (r() - 0.5) * 14);
      const yb = Math.round(64 + dz * 70);
      pine(b, x, yb, 12 + dz * 40, fir.map((c) => mixC(c, [90, 110, 120], (1 - dz) * 0.55)), bark, i * 11 + 3, { bare: true });
    }
    const ground = ramp('#3a4038', 4, { spread: 0.2 });
    for (let y = 60; y < SH; y++) {
      const half = 2 + (y - 60) * 0.9;
      for (let x = 0; x < SW; x++) {
        const onPath = Math.abs(x - 128) < half;
        if (!onPath && b.alpha(x, y)) continue;
        const n = hash2(x, y, 9);
        b.set(x, y, onPath ? (n < 0.3 ? ground[2] : ground[3]) : n < 0.5 ? ground[0] : ground[1]);
      }
    }
    return b.canvas();
  }

  paint(g, t) {
    const cfg = this.cfg;
    this.bg ||= this.backdrop();
    g.drawImage(this.bg, 0, 0);
    // The others' lanterns ahead, up the path into the mist.
    for (let i = 0; i < 6; i++) {
      const d = ((i * 0.17 + t * 0.012) % 1);
      const y = Math.round(126 - d * 64);
      const x = Math.round(128 + Math.sin(i * 2.1 + t * 0.3) * (6 + (1 - d) * 18));
      if (Math.sin(t * 9 + i * 3) > -0.8) dot(g, x, y, d > 0.6 ? '#a07a40' : '#ffd070');
      if (d < 0.5) dot(g, x, y - 1, 'rgba(255,220,140,0.5)');
    }
    // The mist, drifting in bands.
    for (let band = 0; band < 5; band++) {
      const y0 = 58 + band * 14;
      for (let i = 0; i < 90; i++) {
        const x = Math.floor((hash2(i, band, 5) * 400 + t * (4 + band * 2)) % SW);
        const y = y0 + Math.floor(hash2(i, band, 6) * 10);
        g.fillStyle = `rgba(190,200,210,${(0.18 + band * 0.04).toFixed(2)})`;
        g.fillRect(x, y, 3 + band, 1);
      }
    }
    // A gust coming: leaves and mist blown in from its side.
    for (const q of this.gusts) {
      const dt = q.at - this.t;
      if (dt < -0.3 || dt > 1) continue;
      const k = 1 - dt;
      for (let i = 0; i < 26; i++) {
        const x = q.side < 0 ? Math.round(-20 + k * 150 + hash2(i, 1, q.at * 10) * 60) : Math.round(SW + 20 - k * 150 - hash2(i, 1, q.at * 10) * 60);
        const y = 84 + Math.floor(hash2(i, 2, q.at * 10) * 40);
        dot(g, x, y, i % 3 ? 'rgba(220,230,240,0.6)' : '#8a6a2a');
        dot(g, x - q.side, y, 'rgba(220,230,240,0.3)');
      }
    }
    // You, walking, the lantern held out to the right.
    const step = 1 + (Math.floor(t * 4) % 2);
    sprite(g, cfg.look || DEFAULT_LOOK, 128, 134, 2, step, { tint: 'rgba(10,12,40,0.35)' });
    const lx = 138;
    const ly = 116 + (step === 1 ? 0 : 1);
    line(g, 133, 108, lx, ly - 3, '#2a1a10');
    if (this.flame > 0) {
      // Its light on the path round you, as bright as the flame.
      const R = 6 + this.flame * 12;
      g.fillStyle = `rgba(255,200,120,${(0.08 + this.flame * 0.1).toFixed(3)})`;
      for (let dy = -R * 0.5; dy <= R * 0.5; dy++) for (let dx = -R; dx <= R; dx++) if ((dx * dx) / (R * R) + (dy * dy * 4) / (R * R) < 1 && (dx + dy) % 2 === 0) g.fillRect(lx + dx, 134 + dy, 1, 1);
      lantern(g, lx, ly, t, '#ffb050', 0.4 + this.flame * 1.2);
    }
    else {
      rect(g, lx - 1, ly - 1, 3, 3, '#3a3020');
      if (this.relight > 0 && Math.floor(t * 12) % 2) dot(g, lx, ly, '#ffd070');
    }
    // Your hand cupped round it, the side you're shielding.
    if (this.shield) rect(g, lx + this.shield * 3 - (this.shield < 0 ? 1 : 0), ly - 2, 2, 4, '#c89068');
    if (cfg.wet) rain(g, t, 0.4);
  }

  paintUI(u) {
    meter(u, 12, 16, 120, 7, this.flame, this.flame > 0.5 ? '#ffc050' : this.flame > 0 ? '#f07030' : '#5a4a3a', 'THE FLAME');
    meter(u, UW - 132, 16, 120, 7, Math.min(1, this.t / WALK_SECS), '#a0a8d0', 'THE WALK');
    // The gust that's coming, and from where.
    const q = this.gusts.find((g2) => !g2.done && g2.at - this.t < 1);
    if (q && Math.floor(this.t * 8) % 2) text(u, q.side < 0 ? '◄ GUST' : 'GUST ►', q.side < 0 ? 60 : UW - 60, 140, '#e0f0ff', { scale: 2, align: 'center' });
    if (this.flame <= 0) {
      text(u, 'HOLD SPACE TO RELIGHT IT', UW / 2, 120, '#ffd070', { align: 'center' });
      meter(u, UW / 2 - 50, 134, 100, 6, this.relight / 1.5, '#ffd070', null);
    }
  }
}

export const GAMES2 = { hammer: Hammer, logtoss: LogToss, raft: Raft, lantern: Lantern };
