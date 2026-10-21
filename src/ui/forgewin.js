// (Round 132) The forge's games, played over the whole screen (see
// game/smithing.js for what comes of them): iron heated in the furnace with
// the bellows, beaten out on the anvil stroke by stroke, quenched in the
// barrel at the colour it wants; wood and stone shaped at the bench with
// mallet and chisel and their grips bound; a bow's stave bent on the
// tillering board notch by notch and its string tuned; leather cut along
// the chalk and stitched to a beat; a cast's mould poured from the crucible.
//
// Painted as the openings are (see ui/forgepaint.js, render/brush.js): a
// scene of 256 by 144 pixels shown twice the size, its lasting parts painted
// once, what moves (the fire, the work, the light, the steam) drawn over it
// a whole pixel at a time; the words and the boards over that in the view's
// own pixels, in the game's own letters.
//
// Before the work, what's to go into it (its additives, a pattern); after,
// the piece as it came out, and what's to be done with it (written down as
// a pattern, pressed into a cast, made again).
//
// In someone else's world it's all played on the player's own screen (a
// mirror of the window the host opened for them: see net/uiwire.js), and
// how each stage went sent back (a 'ForgeAct' key); the host works out the
// piece and sends it back to be shown.
import { Window } from './window.js';
import { C } from './ascii.js';
import { COLS, ROWS } from '../config.js';
import { ITEMS } from '../world/items.js';
import { itemIcon } from '../render/sprites.js';
import { hex, rgb, mixC, hash2 } from '../render/brush.js';
import { UW, UH, makeBuf, rand, rect, dot, line, disc, text, wrap, panel, meter, Sparks, Pops } from './festpaint.js';
import { FW, FH, SMITHY, BENCH, BOWYER, TABLE, paintWork, heatColour } from './forgepaint.js';
import { forgeCfg, forgeResult, writePattern, pressCast, materialCap, masteryCap, WORK_NAMES, MAX_ADDS } from '../game/smithing.js';
import { RARITY, lifts } from '../world/smithmats.js';
import { mastery } from '../game/mastery.js';
import { craftSources, countFrom } from '../game/invtools.js';

const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const inRect = (m, b) => b && m.x >= b.x && m.y >= b.y && m.x < b.x + b.w && m.y < b.y + b.h;
const hx = (c) => hex(c);
// How a stage went, in a word.
const grade = (q) => (q >= 0.92 ? ['MASTERLY!', '#ffe070'] : q >= 0.76 ? ['FINE WORK', '#a8f0a0'] : q >= 0.56 ? ['GOOD', '#d8e8a0'] : q >= 0.36 ? ['FAIR', '#e8c890'] : ['POOR', '#f09070']);
// Each stage's name, at its head.
const STAGE_NAMES = { heat: 'THE HEAT', hammer: 'THE HAMMER', quench: 'THE QUENCH', shape: 'THE SHAPING', bind: 'THE BINDING', bend: 'THE TILLERING', string: 'THE STRINGING', cut: 'THE CUTTING', stitch: 'THE STITCHING', pour: 'THE POUR' };
// Which workshop each work's done in.
const SHOP = { forge: 'forge', reforge: 'forge', temper: 'forge', cast: 'forge', carve: 'carve', bow: 'bow', stitch: 'stitch' };

// ------------------------------------------------------------ pixels
// Light, in stepped rings (as the openings' lamps), added to what's there.
function glow(g, x, y, r, col, a) {
  g.save();
  g.globalCompositeOperation = 'lighter';
  g.globalAlpha = a;
  for (let i = 4; i >= 1; i--) disc(g, x, y, Math.max(1, Math.round((r * i) / 4)), col);
  g.restore();
}
// A line a few pixels thick.
function thick(g, x0, y0, x1, y1, w, col) {
  const d = Math.hypot(x1 - x0, y1 - y0) || 1;
  const nx = -(y1 - y0) / d;
  const ny = (x1 - x0) / d;
  for (let i = 0; i < w; i++) {
    const o = i - (w - 1) / 2;
    line(g, x0 + nx * o, y0 + ny * o, x1 + nx * o, y1 + ny * o, col);
  }
}
// An icon drawn in the scene at a whole-number size, hot iron's glow over
// it (`heat` 0, as it is; 1, white-hot) and `alpha` of it.
function hotIcon(win, g, key, x, y, s, heat = 0, alpha = 1) {
  let icon = null;
  try {
    icon = itemIcon(key);
  } catch {
    icon = null;
  }
  if (!icon) return;
  const c = (win.tintC ||= makeBuf(16, 16));
  if (!c) return;
  const t = c.getContext('2d');
  t.clearRect(0, 0, 16, 16);
  t.globalCompositeOperation = 'source-over';
  t.globalAlpha = 1;
  t.drawImage(icon, 0, 0);
  if (heat > 0.05) {
    t.globalCompositeOperation = 'source-atop';
    t.globalAlpha = clamp(0.25 + heat * 0.85);
    t.fillStyle = hx(heatColour(heat));
    t.fillRect(0, 0, 16, 16);
  }
  g.save();
  g.globalAlpha = alpha;
  g.imageSmoothingEnabled = false;
  g.drawImage(c, Math.round(x), Math.round(y), 16 * s, 16 * s);
  g.restore();
}

// Steam (or smoke): puffs that rise, swell and thin.
class Puffs {
  constructor() {
    this.list = [];
  }

  add(x, y, n, { col = '#e8eef0', speed = 18, life = 1.6, r = 2 } = {}) {
    for (let i = 0; i < n; i++) this.list.push({ x: x + (Math.random() - 0.5) * 10, y, vx: (Math.random() - 0.5) * speed * 0.6, vy: -speed * (0.5 + Math.random() * 0.6), r: r * (0.6 + Math.random() * 0.8), t: 0, life: life * (0.6 + Math.random() * 0.6), col });
  }

  update(dt) {
    for (const p of this.list) {
      p.t += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.98;
      p.vy *= 0.985;
      p.r += dt * 3.2;
    }
    this.list = this.list.filter((p) => p.t < p.life);
  }

  draw(g) {
    g.save();
    for (const p of this.list) {
      const k = p.t / p.life;
      // (In steps, as the openings' mists thin.)
      g.globalAlpha = Math.round((1 - k) * 4) * 0.12;
      disc(g, p.x, p.y, Math.round(p.r), p.col);
      g.globalAlpha *= 0.8;
      disc(g, p.x - 1, p.y - 1, Math.max(1, Math.round(p.r * 0.5)), '#ffffff');
    }
    g.restore();
  }
}

// ------------------------------------------------------------ the shops' life
// The furnace's fire, `k` how fierce (0 to 1): its coals and its tongues,
// flickering, white at their roots, red at their tips.
function drawFire(g, t, k) {
  const M = SMITHY.mouth;
  const floor = M.y + M.ry - 1;
  for (let x = M.x - M.rx + 1; x <= M.x + M.rx - 1; x++) {
    const dx = (x - M.x) / M.rx;
    const edge = Math.sqrt(Math.max(0, 1 - dx * dx));
    const n = 0.55 + 0.25 * Math.sin(x * 0.9 + t * 11) + 0.2 * hash2(x, Math.floor(t * 14), 3);
    const h = Math.round((5 + 20 * k) * edge * n);
    for (let j = 0; j < h; j++) {
      const y = floor - 3 - j;
      if ((x - M.x) ** 2 / M.rx ** 2 + Math.min(0, y - M.y) ** 2 / M.ry ** 2 > 1) break;
      const f = 1 - j / Math.max(1, h);
      // (A tongue's tip breaks off now and then.)
      if (j === h - 1 && hash2(x, Math.floor(t * 20), 9) < 0.4) continue;
      dot(g, x, y, hx(heatColour(0.28 + f * (0.5 + 0.22 * k))));
    }
    for (let j = 0; j < 3; j++) {
      const fl = hash2(x, j + Math.floor(t * 3), 5);
      dot(g, x, floor - j, hx(heatColour(0.18 + (0.25 + 0.35 * k) * fl * (1 - j * 0.2))));
    }
  }
}
// The light the fire throws on the wall and the floor.
function fireLight(g, t, k) {
  const M = SMITHY.mouth;
  const fl = 0.85 + Math.sin(t * 13) * 0.08 + Math.sin(t * 5.3) * 0.07;
  glow(g, M.x, M.y + 2, Math.round(30 + 40 * k * fl), '#ff7a20', 0.035 + 0.04 * k);
  glow(g, M.x, M.y + M.ry + 6, Math.round(22 + 24 * k), '#ffa040', 0.03 + 0.03 * k);
}
// The bellows, hinged at their brass nozzle, `c` how far squeezed (0 to
// 1): two boards, the leather between them pleated, folding as they close.
function drawBellows(g, c) {
  const B = SMITHY.bellows;
  const hxp = B.x - 16;
  const hy = B.y;
  const L = 34;
  const open = Math.round(12 * (1 - c)) + 2;
  // The pipe to the furnace, and the nozzle.
  rect(g, 80, hy, hxp - 80, 3, '#2e2e36');
  rect(g, 80, hy, hxp - 80, 1, '#6a6a78');
  rect(g, hxp - 4, hy - 1, 5, 5, '#a87830');
  rect(g, hxp - 4, hy - 1, 5, 1, '#e8c060');
  for (let x = 0; x <= L; x++) {
    // (The boards widen from the nozzle, rounded at the far end.)
    const k = x / L;
    const round = x > L - 4 ? Math.round((x - (L - 4)) ** 2 / 5) : 0;
    const top = hy - Math.round(open * k) + round;
    const bot = hy + 3 + Math.round(k * 3) - round;
    // The leather: pleats that bunch as it closes.
    const pleat = Math.max(2, Math.round(3 + (1 - c) * 3));
    for (let y = top + 2; y < bot; y++) {
      const f = (y - top) % pleat;
      dot(g, hxp + x, y, f === 0 ? '#4a2a18' : f === 1 ? '#a86a3a' : '#7a4a2a');
    }
    dot(g, hxp + x, top, '#c8925a');
    dot(g, hxp + x, top + 1, '#8a5a30');
    dot(g, hxp + x, bot, '#8a5a30');
    dot(g, hxp + x, bot + 1, '#4a2e18');
    if (x % 9 === 4) dot(g, hxp + x, top, '#e8c060');
  }
  // The handles, the top one leaned on.
  const ex = hxp + L - 2;
  const ey = hy - open + 1;
  thick(g, ex, ey, ex + 9, ey - 9, 2, '#6a4428');
  disc(g, ex + 10, ey - 10, 1, '#9a6a3a');
  thick(g, ex, hy + 5, ex + 9, hy + 8, 2, '#5a3a20');
}
// The anvil's work: a billet, or the piece it's becoming.
function drawBillet(win, g, key, heat, p) {
  const A = SMITHY.anvil;
  if (p < 1) {
    const w = 30 - Math.round(p * 6);
    const x0 = A.x - Math.round(w / 2);
    const y0 = A.y - 4;
    for (let x = 0; x < w; x++) for (let y = 0; y < 4; y++) {
      const k = clamp(heat * (y === 0 ? 1.08 : y === 3 ? 0.78 : 0.95) + (hash2(x, y, 4) - 0.5) * 0.04);
      dot(g, x0 + x, y0 + y, hx(heatColour(k)));
    }
  }
  if (p > 0) hotIcon(win, g, key, A.x - 16, A.y - 30, 2, heat, clamp(p * 1.3));
  if (heat > 0.35) glow(g, A.x, A.y - 3, Math.round(8 + heat * 14), '#ff8030', 0.03 + heat * 0.04);
}
// A smith's hammer swung from off to the right: `s` 0 raised, 1 struck.
function drawHammer(g, s, head = '#4a4a56') {
  const A = SMITHY.anvil;
  const px = A.x + 46;
  const py = A.y - 46;
  const a = 3.95 + (2.36 - 3.95) * s;
  const hxp = px + Math.cos(a) * 40;
  const hyp = py + Math.sin(a) * 40;
  thick(g, px, py, hxp, hyp, 2, '#7a5030');
  line(g, px, py, hxp, hyp, '#a87448');
  const nx = Math.cos(a + Math.PI / 2);
  const ny = Math.sin(a + Math.PI / 2);
  const dx = Math.cos(a);
  const dy = Math.sin(a);
  for (let i = -5; i <= 5; i++) {
    for (let j = -2; j <= 3; j++) {
      const c = j === -2 ? '#8a8a98' : j === 3 ? '#26262e' : i === -5 || i === 5 ? '#3a3a44' : head;
      dot(g, hxp + nx * i + dx * j, hyp + ny * i + dy * j, c);
    }
  }
  // (The hand on its haft, the sleeve off the edge.)
  disc(g, px - 2, py + 1, 3, '#c89070');
  dot(g, px - 3, py - 1, '#e8b090');
  thick(g, px + 1, py + 1, px + 30, py - 12, 6, '#5a3a2a');
  thick(g, px + 1, py - 2, px + 30, py - 15, 1, '#7a5a40');
}
// The quench barrel's water, still or stirred.
function drawWater(g, t, stir) {
  const B = SMITHY.barrel;
  for (let x = B.x - 15; x < B.x + 15; x++) {
    const e = ((x - B.x) / 15) ** 2;
    const yy = B.y - 2 + Math.round(Math.sin(x * 0.6 + t * (3 + stir * 10)) * (0.3 + stir * 1.2));
    if (e < 0.85 && (x + Math.floor(t * 4)) % 7 === 0) dot(g, x, yy, stir > 0.1 ? '#c8e0f0' : '#5a7a8a');
  }
}
// The bench's light: a shaft from the window, motes drifting in it.
function benchLight(g, t) {
  const W = BENCH.window;
  g.save();
  g.globalCompositeOperation = 'lighter';
  g.globalAlpha = 0.05;
  for (let y = W.y + W.h; y < BENCH.top + 8; y++) {
    const k = (y - W.y - W.h) / (BENCH.top + 8 - W.y - W.h);
    rect(g, W.x + 4 + k * 70, y, W.w - 2 + k * 40, 1, '#fff0c0');
  }
  g.restore();
  for (let i = 0; i < 14; i++) {
    const k = (hash2(i, 1, 7) + t * 0.02 * (0.5 + hash2(i, 2, 7))) % 1;
    const x = W.x + 8 + k * 90 + Math.sin(t * 0.7 + i) * 3;
    const y = W.y + W.h + 4 + hash2(i, 3, 7) * 40 + k * 14;
    if (Math.floor(t * 3 + i) % 5) dot(g, x, y, '#fff4d0');
  }
}
// A lamp hung from a chain (the bowyer's), or a lantern stood on a shelf
// (the cutter's): its flame and its light.
function lamp(g, x, y, t, hang) {
  if (hang) for (let j = 0; j < y - 8; j += 2) dot(g, x, 6 + j, '#4a4038');
  rect(g, x - 3, y - 2, 7, 1, '#3a3028');
  rect(g, x - 2, y - 1, 5, 6, '#c89a40');
  rect(g, x - 1, y, 3, 4, '#ffe8a0');
  rect(g, x - 3, y + 5, 7, 1, '#3a3028');
  const f = Math.floor(t * 9) % 3;
  dot(g, x, y + 1 - (f === 0 ? 1 : 0), '#ffffff');
  const fl = 0.9 + Math.sin(t * 11) * 0.06 + Math.sin(t * 4.1) * 0.05;
  glow(g, x, y + 2, Math.round(40 * fl), '#ffb050', 0.035);
}

// ------------------------------------------------------------ the stages
// Each stage: `rules` (its card), `hint` (along the foot), update/paint, and
// when it's done, `done` and its `score` (0 to 1).
class Stage {
  constructor(win) {
    this.win = win;
    this.cfg = win.forge;
    this.done = false;
    this.score = 0;
    this.t = 0;
    const f = rand((win.forge.token || 1) * 131 + win.si * 17 + 7);
    this.r = { float: (a, b) => a + f() * (b - a), int: (a, b) => a + Math.floor(f() * (b - a + 1)) };
  }

  finish(score) {
    if (this.done) return;
    this.done = true;
    this.score = clamp(score);
  }

  // As far as it went (walked away from).
  partial() {
    return 0;
  }
}

// The heat: hold to work the bellows; the iron toward the fire's heat;
// keep it in the band till it's soaked through.
class Heat extends Stage {
  constructor(win) {
    super(win);
    this.rules = ['HOLD SPACE (OR THE BUTTON) TO WORK THE BELLOWS', 'THE FIRE ROARS, AND THE IRON COMES UP TO HEAT', 'KEEP IT IN THE BAND TILL IT\'S SOAKED THROUGH', 'LET IT GO TOO HOT AND IT BURNS'];
    this.hint = 'BELLOWS: HOLD SPACE OR THE BUTTON  ·  ESC: LEAVE';
    this.heat = 0.06;
    this.fire = 0.3;
    this.squeeze = 0;
    this.cyc = 0;
    this.soak = 0;
    this.burn = 0;
    this.need = 3.2;
    this.limit = 12;
    this.half = 0.07 * win.ease;
    this.mid0 = this.cfg.mode === 'temper' ? 0.52 : 0.68;
  }

  band() {
    const mid = this.mid0 + Math.sin(this.t * 0.55) * 0.05;
    return [mid - this.half, mid + this.half];
  }

  update(dt) {
    const w = this.win;
    this.t += dt;
    const hold = w.holding();
    // (The bellows' strokes: down as you lean on them, up as you ease.)
    if (hold) {
      this.cyc += dt * 4.2;
      const s = (1 - Math.cos(this.cyc)) / 2;
      if (s > 0.95 && !this.puffed) {
        this.puffed = true;
        w.sfx('whoosh');
        w.sparks.burst(SMITHY.mouth.x + 4, SMITHY.mouth.y + 4, 6, ['#ffd060', '#ff8030', '#fff0b0'], 30, 1.2, -40);
      }
      if (s < 0.5) this.puffed = false;
      this.squeeze = s;
    } else this.squeeze = Math.max(0, this.squeeze - dt * 2);
    this.fire += ((hold ? 1 : 0.28) - this.fire) * dt * 1.5;
    this.heat += (0.12 + this.fire * 0.92 - this.heat) * dt * 0.5;
    const [lo, hi] = this.band();
    if (this.heat >= lo && this.heat <= hi) this.soak += dt;
    if (this.heat > hi + 0.08) {
      this.burn += dt;
      if (Math.random() < dt * 14) w.sparks.burst(SMITHY.mouth.x + 10, SMITHY.mouth.y + 6, 2, ['#ffffff', '#fff0a0'], 40, 0.5, 40);
    }
    if (Math.random() < dt * (2 + this.fire * 6)) w.sparks.burst(SMITHY.mouth.x + (Math.random() - 0.5) * 20, SMITHY.mouth.y - 4, 1, ['#ffb040', '#ff6020'], 18, 1.6, -22);
    if (this.soak >= this.need || this.t >= this.limit) {
      const soaked = clamp(this.soak / this.need);
      const quick = clamp(1 - Math.max(0, this.t - (this.need + 3)) / 7);
      this.finish(soaked * (0.78 + 0.22 * quick) - Math.min(0.55, this.burn * 0.35));
      w.ironHeat = this.heat;
    }
  }

  partial() {
    return clamp(this.soak / this.need) * 0.6;
  }

  paint(g, t) {
    const M = SMITHY.mouth;
    drawFire(g, t, this.fire);
    // The iron in the fire, held in tongs: hot where it's in the coals,
    // cooler toward your hand.
    const y = M.y + 7;
    for (let x = M.x - 8; x < M.x + 34; x++) {
      const inside = x < M.x + M.rx - 2;
      const k = inside ? this.heat : this.heat * clamp(1 - (x - (M.x + M.rx - 2)) / 10);
      for (let j = 0; j < 3; j++) dot(g, x, y + j, hx(heatColour(clamp(k * (j === 0 ? 1.06 : j === 2 ? 0.8 : 0.95)))));
    }
    line(g, M.x + 30, y, M.x + 58, y - 8, '#3a3a42');
    line(g, M.x + 30, y + 2, M.x + 58, y + 6, '#4a4a52');
    if (this.heat > 0.4) glow(g, M.x + 4, y + 1, Math.round(6 + this.heat * 10), '#ffb040', 0.05);
    fireLight(g, t, this.fire);
    drawBellows(g, this.squeeze);
  }

  paintUI(u) {
    // The colour of the iron, from cold to white, and the band it wants.
    const x = 470;
    const y0 = 40;
    const h = 180;
    rect(u, x - 3, y0 - 3, 20, h + 6, '#000000');
    for (let j = 0; j < h; j++) rect(u, x, y0 + h - 1 - j, 14, 1, hx(heatColour(j / h)));
    const [lo, hi] = this.band();
    const by0 = y0 + h - Math.round(hi * h);
    const by1 = y0 + h - Math.round(lo * h);
    rect(u, x - 6, by0, 26, 1, '#a8f0a0');
    rect(u, x - 6, by1, 26, 1, '#a8f0a0');
    rect(u, x - 6, by0, 1, by1 - by0, '#a8f0a0');
    rect(u, x + 19, by0, 1, by1 - by0, '#a8f0a0');
    const my = y0 + h - Math.round(clamp(this.heat) * h);
    for (let i = 0; i < 5; i++) rect(u, x - 12 + i, my - 4 + i, 1, 9 - i * 2, '#ffffff');
    text(u, 'HEAT', x + 7, y0 - 14, '#e8d0a0', { align: 'center' });
    meter(u, 24, 40, 140, 8, this.soak / this.need, '#ff9a40', 'SOAKED THROUGH');
    if (this.burn > 0 && this.heat > this.band()[1] + 0.08 && Math.floor(this.t * 6) % 2) text(u, 'TOO HOT! IT\'S BURNING', 256, 56, '#ff7050', { scale: 2, align: 'center' });
  }
}

// The hammer: the billet on the anvil; strike as each ring closes on its
// mark (the iron cooling as you go: too cold and the blows don't take).
class Hammer extends Stage {
  constructor(win) {
    super(win);
    this.rules = ['STRIKE (SPACE OR CLICK) AS EACH RING CLOSES ON ITS MARK', 'TRUE BLOWS DRAW THE IRON OUT INTO ITS SHAPE', 'WORK QUICKLY: THE IRON COOLS AS YOU GO'];
    this.hint = 'STRIKE: SPACE OR CLICK  ·  ESC: LEAVE';
    this.n = this.cfg.mode === 'reforge' ? 6 : 7;
    this.i = 0;
    this.hits = [];
    this.heat = clamp(win.ironHeat || 0.65, 0.3, 0.95);
    this.swing = 1;
    this.gap = 0.5;
    this.next();
  }

  next() {
    const A = SMITHY.anvil;
    this.ring = { x: A.x - 10 + this.r.int(0, 20), y: A.y - 3 - this.r.int(0, 8), r: 22, dur: Math.max(0.65, 1.15 - this.i * 0.06) };
    this.rt = 0;
  }

  update(dt) {
    const w = this.win;
    this.t += dt;
    this.heat = Math.max(0.1, this.heat - dt * 0.035);
    this.swing = Math.min(1, this.swing + dt * 5);
    if (this.gap > 0) {
      this.gap -= dt;
      return;
    }
    if (this.i >= this.n) {
      this.finish(this.hits.reduce((a, b) => a + b, 0) / this.n);
      w.ironHeat = this.heat;
      return;
    }
    this.rt += dt;
    const R = this.ring;
    const rad = R.r * (1 - this.rt / R.dur);
    if (w.tapped()) this.strike(rad);
    else if (rad < -3) {
      this.hits.push(0);
      w.pops.add('MISSED', R.x, R.y - 14, '#f09070');
      this.after();
    }
  }

  strike(rad) {
    const w = this.win;
    const R = this.ring;
    const e = Math.abs(rad - 3);
    let q = e <= 1.6 * w.ease ? 1 : e <= 4 * w.ease ? 0.72 : e <= 7.5 * w.ease ? 0.42 : 0.15;
    const cold = this.heat < 0.32;
    if (cold) q *= 0.6;
    this.hits.push(q);
    this.swing = 0;
    w.sfx('clang');
    w.shake = 0.12;
    const n = q >= 1 ? 26 : q >= 0.7 ? 16 : 8;
    w.sparks.burst(R.x, R.y, n, ['#fff8d0', '#ffd060', '#ff9030', '#ffffff'], q >= 1 ? 80 : 55, 0.6, 140);
    w.pops.add(cold ? 'TOO COLD' : q >= 1 ? 'TRUE!' : q >= 0.7 ? 'GOOD' : q >= 0.4 ? 'OFF' : 'WILD', R.x, R.y - 14, cold ? '#90b0f0' : grade(q)[1]);
    this.flash = 0.08;
    this.after();
  }

  after() {
    this.i++;
    this.gap = 0.28;
    if (this.i < this.n) this.next();
  }

  partial() {
    return this.hits.reduce((a, b) => a + b, 0) / this.n;
  }

  paint(g, t) {
    drawFire(g, t, 0.35);
    fireLight(g, t, 0.35);
    drawBellows(g, 0);
    const p = this.i / this.n;
    this.flash = Math.max(0, (this.flash || 0) - 1 / 60);
    drawBillet(this.win, g, this.cfg.out, clamp(this.heat + (this.flash > 0 ? 0.3 : 0)), p);
    // The ring closing on its mark.
    if (this.gap <= 0 && this.i < this.n) {
      const R = this.ring;
      const rad = R.r * (1 - this.rt / R.dur);
      for (let a = 0; a < 40; a++) {
        const an = (a / 40) * Math.PI * 2;
        dot(g, R.x + Math.cos(an) * 3, R.y + Math.sin(an) * 3, '#a8f0a0');
      }
      if (rad > 0) {
        const near = Math.abs(rad - 3) <= 1.6 * this.win.ease;
        const steps = Math.max(12, Math.round(rad * 6));
        for (let a = 0; a < steps; a++) {
          const an = (a / steps) * Math.PI * 2 + t;
          dot(g, R.x + Math.cos(an) * rad, R.y + Math.sin(an) * rad, near ? '#ffffff' : '#ffd060');
        }
      }
    }
    drawHammer(g, this.swing < 0.15 ? 1 : 1 - (this.swing - 0.15) / 0.85);
  }

  paintUI(u) {
    text(u, `STROKE ${Math.min(this.n, this.i + 1)} OF ${this.n}`, 24, 30, '#e8d0a0');
    meter(u, 24, 50, 140, 8, this.heat, hx(heatColour(this.heat)), 'THE IRON\'S HEAT');
    for (let k = 0; k < this.n; k++) {
      const q = this.hits[k];
      rect(u, 24 + k * 14, 66, 10, 10, '#000000');
      rect(u, 25 + k * 14, 67, 8, 8, q === undefined ? '#2a2430' : grade(q)[1]);
    }
  }
}

// The quench: the piece held over the barrel, cooling; plunge it at the
// colour it wants.
const QUENCH_AT = [[0.66, 'ORANGE'], [0.54, 'CHERRY RED'], [0.43, 'BLOOD RED']];
class Quench extends Stage {
  constructor(win) {
    super(win);
    this.target = QUENCH_AT[this.r.int(0, QUENCH_AT.length - 1)];
    if (this.cfg.mode === 'temper') this.target = [0.36, 'DULL RED'];
    this.rules = ['THE PIECE COOLS AS YOU HOLD IT OVER THE WATER', `PLUNGE IT (SPACE OR CLICK) WHEN IT'S ${this.target[1]}`, 'TOO HOT AND IT CRACKS; TOO COLD AND IT\'S SOFT'];
    this.hint = 'PLUNGE: SPACE OR CLICK  ·  ESC: LEAVE';
    this.heat = 0.97;
    this.dip = 0;
    this.plunged = false;
    this.after = 0;
  }

  update(dt) {
    const w = this.win;
    this.t += dt;
    if (!this.plunged) {
      this.heat = Math.max(0, this.heat - dt * (0.07 + this.heat * 0.09));
      if (w.tapped() || this.heat < 0.12) this.plunge();
    } else {
      this.dip = Math.min(1, this.dip + dt * 5);
      this.heat = Math.max(0, this.heat - dt * 1.6);
      this.after += dt;
      const B = SMITHY.barrel;
      if (this.after < 1.2 && Math.random() < dt * 30) w.puffs.add(B.x + (Math.random() - 0.5) * 20, B.y - 4, 1, { speed: 24, life: 1.8, r: 2.5 });
      if (this.after > 1.6) this.finish(this.q);
    }
  }

  plunge() {
    const w = this.win;
    this.plunged = true;
    const e = Math.abs(this.heat - this.target[0]);
    this.q = clamp(1 - Math.max(0, e - 0.025 * w.ease) / (0.16 * w.ease));
    w.sfx('hiss');
    w.sfx('splash');
    const B = SMITHY.barrel;
    w.puffs.add(B.x, B.y - 6, 16, { speed: 34, life: 2, r: 3 });
    w.pops.add(grade(this.q)[0], B.x - 20, B.y - 50, grade(this.q)[1]);
  }

  partial() {
    return 0;
  }

  paint(g, t) {
    drawFire(g, t, 0.3);
    fireLight(g, t, 0.3);
    drawBellows(g, 0);
    const B = SMITHY.barrel;
    const y = B.y - 40 + Math.round(this.dip * 34) + (this.plunged ? 0 : Math.round(Math.sin(t * 2) * 1));
    g.save();
    g.beginPath();
    g.rect(0, 0, FW, B.y - 2);
    g.clip();
    hotIcon(this.win, g, this.cfg.out, B.x - 16, y, 2, this.heat);
    g.restore();
    // The tongs, off to the upper right.
    thick(g, B.x + 6, y + 10, B.x + 44, y - 26, 2, '#3a3a44');
    line(g, B.x + 8, y + 14, B.x + 46, y - 20, '#5a5a66');
    if (this.heat > 0.35 && !this.plunged) glow(g, B.x, y + 16, Math.round(8 + this.heat * 12), '#ff8030', 0.05);
    drawWater(g, t, this.plunged ? Math.max(0, 1 - this.after) : 0);
  }

  paintUI(u) {
    text(u, 'QUENCH IT AT', 24, 30, '#e8d0a0');
    rect(u, 24, 42, 24, 16, '#000000');
    rect(u, 25, 43, 22, 14, hx(heatColour(this.target[0])));
    text(u, this.target[1], 56, 46, hx(mixC(heatColour(this.target[0]), rgb('#ffffff'), 0.3)));
    text(u, 'IT\'S NOW', 24, 66, '#e8d0a0');
    rect(u, 24, 78, 24, 16, '#000000');
    rect(u, 25, 79, 22, 14, hx(heatColour(this.heat)));
    // The colours it'll pass through, and where it is.
    for (let i = 0; i < 160; i++) rect(u, 24 + i, 102, 1, 6, hx(heatColour(1 - i / 160)));
    rect(u, 24 + Math.round((1 - this.target[0]) * 160), 98, 1, 14, '#a8f0a0');
    rect(u, 24 + Math.round((1 - this.heat) * 160), 100, 2, 10, '#ffffff');
  }
}

// The shaping: the chisel slides along the blank; strike with the mallet
// as it passes over each chalk mark.
class Shape extends Stage {
  constructor(win) {
    super(win);
    this.rules = ['THE CHISEL SLIDES ALONG THE BLANK', 'STRIKE (SPACE OR CLICK) AS IT PASSES OVER A MARK', 'MISS AND YOU GOUGE IT'];
    this.hint = 'STRIKE: SPACE OR CLICK  ·  ESC: LEAVE';
    this.x0 = 74;
    this.x1 = 182;
    this.marks = [];
    const n = 6;
    for (let i = 0; i < n; i++) this.marks.push({ x: this.x0 + 8 + Math.round(((i + 0.2 + this.r.float(0, 0.6)) / n) * (this.x1 - this.x0 - 16)), hit: null });
    this.cuts = [];
    this.gouges = [];
    this.pos = 0;
    this.limit = 14;
    this.swing = 1;
  }

  cx() {
    const sp = 0.32 + this.t * 0.018;
    const k = (this.pos * sp) % 2;
    return this.x0 + (k < 1 ? k : 2 - k) * (this.x1 - this.x0);
  }

  update(dt) {
    const w = this.win;
    this.t += dt;
    this.pos += dt;
    this.swing = Math.min(1, this.swing + dt * 5);
    if (w.tapped()) {
      const x = this.cx();
      const open = this.marks.filter((m) => m.hit === null);
      const m = open.sort((a, b) => Math.abs(a.x - x) - Math.abs(b.x - x))[0];
      this.swing = 0;
      w.sfx('chop');
      const d = m ? Math.abs(m.x - x) : 99;
      if (d > 8 * w.ease) {
        this.gouges.push(Math.round(x));
        w.pops.add('GOUGED', x, BENCH.top - 26, '#f09070');
        w.sparks.burst(x, BENCH.top - 9, 5, ['#8a5a30', '#c89a60'], 30, 0.5, 120);
      } else {
        m.hit = d <= 1.6 * w.ease ? 1 : d <= 4 * w.ease ? 0.72 : 0.42;
        this.cuts.push(m.x);
        w.pops.add(m.hit >= 1 ? 'CLEAN!' : m.hit >= 0.7 ? 'GOOD' : 'ROUGH', m.x, BENCH.top - 26, grade(m.hit)[1]);
        w.sparks.burst(m.x, BENCH.top - 9, 12, ['#e8c890', '#d8b070', '#b88a50', '#fff0d0'], 45, 0.8, 140);
      }
    }
    if (this.marks.every((m) => m.hit !== null) || this.t >= this.limit) {
      const sum = this.marks.reduce((a, m) => a + (m.hit || 0), 0);
      this.finish(sum / this.marks.length - this.gouges.length * 0.07);
    }
  }

  partial() {
    return this.marks.reduce((a, m) => a + (m.hit || 0), 0) / this.marks.length;
  }

  paint(g, t) {
    benchLight(g, t);
    const y0 = BENCH.top - 10;
    // The blank: its grain, lit along its top, carved where it's been cut.
    for (let x = this.x0; x < this.x1; x++) {
      const cut = this.cuts.some((c) => Math.abs(c - x) <= 2);
      const gouge = this.gouges.some((c) => Math.abs(c - x) <= 1);
      for (let y = y0; y < BENCH.top; y++) {
        if (cut && y < y0 + 3) continue;
        if (gouge && y < y0 + 2) continue;
        const grain = (x + Math.round(Math.sin(y * 0.9 + x * 0.05) * 2)) % 9 === 0;
        let c = y === y0 || (cut && y === y0 + 3) ? '#f0d098' : y === BENCH.top - 1 ? '#7a5028' : grain ? '#a87440' : '#c89458';
        if (cut && y === y0 + 3) c = '#f8e0b0';
        if (gouge && y === y0 + 2) c = '#6a4020';
        dot(g, x, y, c);
      }
      if (x === this.x0 || x === this.x1 - 1) for (let y = y0; y < BENCH.top; y++) dot(g, x, y, '#8a5a30');
    }
    // The chalk marks still to cut.
    for (const m of this.marks) if (m.hit === null) for (let y = y0 - 4; y < y0 + 2; y += 1) if (y % 2 || y >= y0) dot(g, m.x, y, '#f4f0e8');
    // The chisel, and the mallet over it.
    const x = Math.round(this.cx());
    const s = this.swing < 0.15 ? 1 : 1 - (this.swing - 0.15) / 0.85;
    const cy = y0 - 2 - Math.round((1 - s) * 2);
    for (let y = cy - 14; y < cy - 6; y++) {
      dot(g, x, y, '#9a6a3a');
      dot(g, x + 1, y, '#6a4428');
    }
    for (let y = cy - 6; y <= cy; y++) {
      dot(g, x, y, y === cy ? '#ffffff' : '#a8a8b8');
      dot(g, x + 1, y, '#6a6a78');
    }
    const my = cy - 16 - Math.round((1 - s) * 12);
    const mx = x + 1 + Math.round((1 - s) * 6);
    rect(g, mx - 5, my - 5, 11, 6, '#9a6a3a');
    rect(g, mx - 5, my - 5, 11, 1, '#c89a60');
    rect(g, mx - 5, my, 11, 1, '#5a3a1e');
    thick(g, mx, my - 5, mx + 14, my - 18, 2, '#7a5030');
  }

  paintUI(u) {
    const left = this.marks.filter((m) => m.hit === null).length;
    text(u, `MARKS LEFT: ${left}`, 24, 30, '#e8d0a0');
    meter(u, 24, 50, 140, 8, 1 - this.t / this.limit, '#d8b070', 'TIME');
  }
}

// The binding: the grip wrapped, a turn at a time, at the arrows shown.
const ARROWS = [['ArrowLeft', '←'], ['ArrowRight', '→'], ['ArrowUp', '↑'], ['ArrowDown', '↓']];
const ALT = { ArrowLeft: 'KeyA', ArrowRight: 'KeyD', ArrowUp: 'KeyW', ArrowDown: 'KeyS' };
class Bind extends Stage {
  constructor(win) {
    super(win);
    this.rules = ['WRAP THE GRIP A TURN AT A TIME:', 'PRESS EACH ARROW AS IT\'S SHOWN (OR W A S D)', 'QUICK AND TRUE MAKES A TIGHT GRIP'];
    this.hint = 'WRAP: THE ARROW KEYS (OR W A S D)  ·  ESC: LEAVE';
    this.n = 8;
    this.seq = Array.from({ length: this.n }, () => ARROWS[this.r.int(0, 3)]);
    this.i = 0;
    this.turns = [];
    this.pt = 0;
    this.limitEach = 1.7 * win.ease;
  }

  update(dt) {
    const w = this.win;
    this.t += dt;
    if (this.i >= this.n) {
      this.endT = (this.endT || 0) + dt;
      if (this.endT > 0.5) this.finish(this.turns.reduce((a, b) => a + b, 0) / this.n);
      return;
    }
    this.pt += dt;
    const want = this.seq[this.i][0];
    let got = null;
    for (const [code] of ARROWS) if (w.pressed(code) || w.pressed(ALT[code])) got = code;
    if (got) {
      const q = got !== want ? 0.2 : this.pt <= 0.65 * w.ease ? 1 : 0.7;
      this.turn(q);
    } else if (this.pt > this.limitEach) this.turn(0);
  }

  turn(q) {
    const w = this.win;
    this.turns.push(q);
    w.sfx(q >= 0.7 ? 'select' : 'error');
    const gx = 104 + this.i * 6;
    w.pops.add(q >= 1 ? 'TIGHT' : q >= 0.7 ? 'GOOD' : q > 0 ? 'LOOSE' : 'SLIPPED', gx, BENCH.top - 30, grade(q)[1], 1, 0.7);
    this.i++;
    this.pt = 0;
  }

  partial() {
    return this.turns.reduce((a, b) => a + b, 0) / this.n;
  }

  paint(g, t) {
    benchLight(g, t);
    const y0 = BENCH.top - 8;
    // The haft laid along the bench, the piece's head at its end.
    for (let x = 64; x < 172; x++) for (let y = y0 + 1; y < y0 + 6; y++) dot(g, x, y, y === y0 + 1 ? '#f0d098' : y === y0 + 5 ? '#7a5028' : '#c89458');
    hotIcon(this.win, g, this.cfg.out, 168, BENCH.top - 34, 2, 0);
    // The turns of the binding.
    this.turns.forEach((q, i) => {
      const x = 104 + i * 6;
      const off = q >= 0.7 ? 0 : 1;
      const col = q >= 0.7 ? ['#5a3a20', '#7a5030', '#9a6a40'] : ['#4a2a18', '#6a4428', '#7a5030'];
      for (let j = 0; j < 7; j++) {
        dot(g, x + Math.floor(j / 2) + off, y0 + j, col[j % 3]);
        dot(g, x + Math.floor(j / 2) + 1 + off, y0 + j, col[(j + 1) % 3]);
      }
      if (q < 0.7) dot(g, x + 5, y0 - 1, '#6a4428');
    });
    // The strap's end, and the spool of it.
    const ex = 104 + this.i * 6;
    if (this.i < this.n) {
      const sway = Math.round(Math.sin(t * 3) * 2);
      line(g, ex, y0 + 6, ex + 10 + sway, y0 + 22, '#7a5030');
      disc(g, ex + 12 + sway, y0 + 24, 3, '#5a3a20');
      dot(g, ex + 12 + sway, y0 + 24, '#9a6a40');
    }
  }

  paintUI(u) {
    text(u, `TURN ${Math.min(this.n, this.i + 1)} OF ${this.n}`, 24, 30, '#e8d0a0');
    if (this.i >= this.n) return;
    // The arrows to come, the one to press now large.
    const [, glyph] = this.seq[this.i];
    panel(u, 226, 40, 160, 54);
    const pulse = Math.floor(this.t * 6) % 2;
    text(u, glyph, 256, 52, pulse ? '#ffffff' : '#ffe070', { scale: 5, align: 'center' });
    this.seq.slice(this.i + 1, this.i + 5).forEach(([, gl], k) => text(u, gl, 302 + k * 18, 62, '#a89878', { scale: 2 }));
    meter(u, 226, 100, 60, 6, 1 - this.pt / this.limitEach, '#d8b070');
  }
}

// The tillering: the stave bent on the board, notch by notch; let go in
// the green, not past it (past it and it cracks).
class Bend extends Stage {
  constructor(win) {
    super(win);
    this.rules = ['HOLD SPACE (OR THE BUTTON) TO DRAW THE STAVE DOWN', 'LET GO WHEN IT REACHES THE NOTCH (THE GREEN)', 'THREE PULLS, EACH A NOTCH DEEPER', 'TOO FAR AND THE STAVE CRACKS'];
    this.hint = 'DRAW: HOLD SPACE OR THE BUTTON  ·  LET GO AT THE NOTCH  ·  ESC: LEAVE';
    this.targets = [0.42, 0.62, 0.82];
    this.i = 0;
    this.bend = 0;
    this.v = 0;
    this.pulls = [];
    this.cracks = [];
    this.tol = 0.04 * win.ease;
    this.rest = 0;
    this.wob = 0;
    this.drawing = false;
  }

  update(dt) {
    const w = this.win;
    this.t += dt;
    this.wob = Math.max(0, this.wob - dt * 1.5);
    if (this.i >= this.targets.length) {
      this.bend += (0 - this.bend) * dt * 6;
      this.endT = (this.endT || 0) + dt;
      if (this.endT > 0.8) this.finish(this.pulls.reduce((a, b) => a + b, 0) / this.targets.length);
      return;
    }
    if (this.rest > 0) {
      this.rest -= dt;
      this.bend += (0 - this.bend) * dt * 8;
      return;
    }
    const tgt = this.targets[this.i];
    if (w.holding()) {
      if (!this.drawing) w.sfx('draw');
      this.drawing = true;
      this.v = Math.min(0.55, this.v + dt * 0.5);
      this.bend += this.v * dt;
      if (this.bend > tgt + 0.15) {
        this.pulls.push(0.05);
        this.cracks.push(this.r.int(0, 1) ? -1 : 1);
        w.sfx('crumble');
        w.sparks.burst(BOWYER.tiller.x + 40 * this.cracks[this.cracks.length - 1], 40, 10, ['#c89a60', '#8a5a30'], 40, 0.7, 120);
        w.pops.add('CRACKED!', BOWYER.tiller.x, 20, '#f09070');
        this.release();
      }
    } else if (this.drawing) {
      const e = Math.abs(this.bend - tgt);
      const q = clamp(1 - Math.max(0, e - this.tol) / 0.16);
      this.pulls.push(q);
      w.pops.add(grade(q)[0], BOWYER.tiller.x, 20, grade(q)[1]);
      w.sfx(q >= 0.56 ? 'bow' : 'error');
      this.release();
    }
  }

  release() {
    this.drawing = false;
    this.v = 0;
    this.i++;
    this.rest = 0.6;
    this.wob = 1;
  }

  partial() {
    return this.pulls.reduce((a, b) => a + b, 0) / this.targets.length;
  }

  paint(g, t) {
    lamp(g, BOWYER.lamp.x, BOWYER.lamp.y, t, true);
    const T = BOWYER.tiller;
    const gy = 30;
    const tgt = this.targets[Math.min(this.i, this.targets.length - 1)];
    // The notch it's to come down to, lit.
    const ny = gy + 10 + Math.round(tgt * 70);
    if (this.i < this.targets.length) for (let x = T.x - 6; x < T.x - 1; x++) dot(g, x, ny, Math.floor(t * 4) % 2 ? '#a8f0a0' : '#5a9a50');
    const b = this.bend + Math.sin(t * 22) * 0.012 * this.wob;
    paintBow(g, T.x, gy, b, this.cracks, false, 0, t);
    // The cord from the stave's middle to the notch, when it's drawn.
    if (b > 0.02) {
      const tipY = gy + Math.round(4 + b * 34);
      const py = gy + 10 + Math.round(b * 70);
      line(g, T.x - 62, tipY, T.x, py, '#e8e0c8');
      line(g, T.x + 62, tipY, T.x, py, '#e8e0c8');
      rect(g, T.x - 2, py - 1, 4, 3, '#8a5a30');
    }
  }

  paintUI(u) {
    text(u, `PULL ${Math.min(this.targets.length, this.i + 1)} OF ${this.targets.length}`, 24, 30, '#e8d0a0');
    // How far it's bent, the notch, and the breaking point.
    const x = 470;
    const y0 = 40;
    const h = 180;
    rect(u, x - 3, y0 - 3, 20, h + 6, '#000000');
    rect(u, x, y0, 14, h, '#2a2430');
    const tgt = this.targets[Math.min(this.i, this.targets.length - 1)];
    const ty0 = y0 + Math.round((tgt - this.tol) * h);
    const ty1 = y0 + Math.round((tgt + this.tol) * h);
    rect(u, x, ty0, 14, Math.max(2, ty1 - ty0), '#4a9a40');
    const cy = y0 + Math.round((tgt + 0.15) * h);
    if (cy < y0 + h) rect(u, x, cy, 14, y0 + h - cy, '#7a2a20');
    const by = y0 + Math.round(clamp(this.bend) * h);
    rect(u, x, y0, 14, by - y0, 'rgba(232,208,160,0.5)');
    for (let i = 0; i < 5; i++) rect(u, x - 12 + i, by - 4 + i, 1, 9 - i * 2, '#ffffff');
    text(u, 'BEND', x + 7, y0 - 14, '#e8d0a0', { align: 'center' });
  }
}
// A bow (or its stave) on the tillering board: its grip at (x, y), bent
// `b` (0 to 1), its cracks; strung (`string`), the string trembling `vib`.
function paintBow(g, x, y, b, cracks = [], strung = false, vib = 0, t = 0) {
  const half = 62;
  const tipDy = 4 + b * 34;
  for (let dx = -half; dx <= half; dx++) {
    const k = Math.abs(dx) / half;
    const yy = y + Math.round(tipDy * k * k);
    const th = k < 0.15 ? 4 : k < 0.6 ? 3 : k < 0.9 ? 2 : 1;
    for (let j = 0; j < th; j++) dot(g, x + dx, yy + j, j === 0 ? '#d8a868' : j === th - 1 ? '#6a4428' : '#a87440');
  }
  // The grip, bound.
  rect(g, x - 4, y - 1, 9, 6, '#5a3a20');
  for (let i = 0; i < 9; i += 2) dot(g, x - 4 + i, y, '#8a5a30');
  for (const side of cracks) {
    const cx = x + side * 34;
    const cy = y + Math.round(tipDy * 0.3);
    line(g, cx - 3, cy - 1, cx + 3, cy + 2, '#2a1a10');
    dot(g, cx, cy - 1, '#f0d098');
  }
  if (strung) {
    const ty = y + Math.round(tipDy);
    for (let dx = -half + 1; dx < half; dx++) {
      const k = 1 - Math.abs(dx) / half;
      const off = Math.round(Math.sin(dx * 0.3 + t * 60) * vib * 3 * k);
      dot(g, x + dx, ty + off, '#f0e8d0');
    }
  }
  dot(g, x - half, y + Math.round(tipDy), '#2a1a10');
  dot(g, x + half, y + Math.round(tipDy), '#2a1a10');
}

// The stringing: the bow strung, and its string tuned, a pluck at a time,
// as the needle on the dial comes true.
class StringIt extends Stage {
  constructor(win) {
    super(win);
    this.rules = ['THE BOW\'S STRUNG: NOW TUNE THE STRING', 'PLUCK IT (SPACE OR CLICK) AS THE NEEDLE COMES TRUE', 'FIVE PLUCKS, EACH QUICKER'];
    this.hint = 'PLUCK: SPACE OR CLICK  ·  ESC: LEAVE';
    this.n = 5;
    this.i = 0;
    this.plucks = [];
    this.vib = 0;
    this.ph = this.r.float(0, 6);
  }

  needle() {
    return Math.sin(this.ph);
  }

  update(dt) {
    const w = this.win;
    this.t += dt;
    this.vib = Math.max(0, this.vib - dt * 0.9);
    if (this.i >= this.n) {
      this.endT = (this.endT || 0) + dt;
      if (this.endT > 0.8) this.finish(this.plucks.reduce((a, b) => a + b, 0) / this.n);
      return;
    }
    this.ph += dt * (2.1 + this.i * 0.45);
    if (w.tapped()) {
      const e = Math.abs(this.needle());
      const q = e < 0.1 * w.ease ? 1 : e < 0.26 * w.ease ? 0.72 : e < 0.5 ? 0.4 : 0.15;
      this.plucks.push(q);
      this.vib = 1;
      w.sfx('bow');
      w.pluck(q);
      w.pops.add(q >= 1 ? 'TRUE!' : q >= 0.7 ? 'NEAR' : q >= 0.4 ? 'SHARP' : 'SOUR', BOWYER.tiller.x, 20, grade(q)[1]);
      this.i++;
    }
  }

  partial() {
    return this.plucks.reduce((a, b) => a + b, 0) / this.n;
  }

  paint(g, t) {
    lamp(g, BOWYER.lamp.x, BOWYER.lamp.y, t, true);
    paintBow(g, BOWYER.tiller.x, 30, 0.35, [], true, this.vib, t);
  }

  paintUI(u) {
    text(u, `PLUCK ${Math.min(this.n, this.i + 1)} OF ${this.n}`, 24, 30, '#e8d0a0');
    // The dial: an arc, its true point in the middle, the needle.
    const cx = 256;
    const cy = 250;
    const R = 60;
    for (let a = -60; a <= 60; a++) {
      const an = ((a - 90) * Math.PI) / 180;
      const good = Math.abs(a) <= 6 * this.win.ease;
      rect(u, cx + Math.cos(an) * R, cy + Math.sin(an) * R, 2, 2, good ? '#a8f0a0' : Math.abs(a) < 18 * this.win.ease ? '#d8e8a0' : '#8a7a60');
    }
    const an = ((this.needle() * 60 - 90) * Math.PI) / 180;
    for (let r = 0; r < R - 4; r++) rect(u, cx + Math.cos(an) * r, cy + Math.sin(an) * r, 2, 2, '#ffffff');
    disc(u, cx, cy, 4, '#c8a060');
  }
}

// The cutting: the hide drawn under the knife; keep the knife on the
// chalk.
class Cut extends Stage {
  constructor(win) {
    super(win);
    this.rules = ['THE HIDE IS DRAWN UNDER YOUR KNIFE', 'KEEP THE KNIFE ON THE CHALK LINE:', 'THE POINTER, OR UP AND DOWN (W AND S)'];
    this.hint = 'STEER: POINTER OR UP/DOWN  ·  ESC: LEAVE';
    this.kx = 96;
    this.ky = this.lineY(this.kx);
    this.scroll = 0;
    this.dur = 7;
    this.sum = 0;
    this.tot = 0;
    this.slit = [];
    this.seed = this.r.float(0, 50);
  }

  lineY(xw) {
    const s = this.seed || 0;
    return 108 + Math.sin(xw * 0.045 + s) * 11 + Math.sin(xw * 0.12 + s * 2) * 4;
  }

  update(dt) {
    const w = this.win;
    this.t += dt;
    this.scroll += dt * 24;
    const m = w.mouse();
    if (w.held('ArrowUp', 'KeyW')) this.ky -= dt * 42;
    if (w.held('ArrowDown', 'KeyS')) this.ky += dt * 42;
    if (this.lastM && Math.abs(m.sy - this.lastM) > 0.2) this.ky = m.sy;
    this.lastM = m.sy;
    this.ky = clamp(this.ky, 84, 136);
    const want = this.lineY(this.kx + this.scroll);
    const e = Math.abs(this.ky - want);
    const q = clamp(1 - Math.max(0, e - 1.2 * w.ease) / (6 * w.ease));
    this.sum += q * dt;
    this.tot += dt;
    this.slit.push([this.kx + this.scroll, this.ky, q]);
    if (this.slit.length > 400) this.slit.shift();
    if (q < 0.3 && Math.random() < dt * 4) w.pops.add('OFF THE LINE', this.kx, this.ky - 12, '#f09070', 1, 0.6);
    if (this.t >= this.dur) this.finish(this.sum / Math.max(0.01, this.tot));
  }

  partial() {
    return this.tot ? (this.sum / this.tot) * (this.t / this.dur) : 0;
  }

  paint(g, t) {
    lamp(g, TABLE.lantern.x, TABLE.lantern.y, t, false);
    // The hide, its edge ragged, mottled.
    for (let x = 0; x < FW; x++) {
      const xw = x + this.scroll;
      const top = 84 + Math.round(Math.sin(xw * 0.07) * 2 + hash2(Math.floor(xw / 3), 1, 3) * 2);
      for (let y = top; y < 140; y++) {
        const n = hash2(Math.floor(xw / 2), y >> 1, 5);
        dot(g, x, y, y === top ? '#d8a870' : n < 0.12 ? '#8a5a30' : n < 0.5 ? '#a87444' : '#b88250');
      }
      // The chalk, dashed.
      if (Math.floor(xw / 3) % 2 === 0 && x > this.kx) dot(g, x, Math.round(this.lineY(xw)), '#f4f0e8');
    }
    // What's been cut.
    for (const [xw, y, q] of this.slit) {
      const x = Math.round(xw - this.scroll);
      if (x < 0 || x > this.kx) continue;
      dot(g, x, Math.round(y), q > 0.5 ? '#2a1408' : '#5a1a10');
      dot(g, x, Math.round(y) + 1, '#6a4020');
    }
    // The knife: its blade down in the hide, its haft up to the right.
    const kx = this.kx;
    const ky = Math.round(this.ky);
    for (let i = 0; i < 9; i++) {
      dot(g, kx + i, ky - i, '#d8d8e0');
      dot(g, kx + i + 1, ky - i, '#8a8a98');
    }
    thick(g, kx + 9, ky - 9, kx + 20, ky - 20, 3, '#5a3a20');
    line(g, kx + 9, ky - 10, kx + 20, ky - 21, '#8a5a30');
  }

  paintUI(u) {
    meter(u, 24, 40, 140, 8, this.t / this.dur, '#d8b070', 'THE CUT');
    meter(u, 24, 64, 140, 8, this.tot ? this.sum / this.tot : 1, '#a8f0a0', 'HOW TRUE');
  }
}

// The stitching: through the holes in turn, to a beat; left and right by
// turns.
class Stitch extends Stage {
  constructor(win) {
    super(win);
    this.rules = ['STITCH TO THE BEAT, LEFT AND RIGHT BY TURNS:', 'PRESS THE ARROW SHOWN AS THE BEAD REACHES THE LINE', '(OR A AND D)'];
    this.hint = 'STITCH: LEFT / RIGHT (A / D) ON THE BEAT  ·  ESC: LEAVE';
    this.n = 10;
    this.beat = 0.68;
    this.i = 0;
    this.st = [];
    this.lead = 1.2;
    this.win2 = 0.09 * win.ease;
  }

  due(i) {
    return this.lead + i * this.beat;
  }

  update(dt) {
    const w = this.win;
    this.t += dt;
    if (this.i >= this.n) {
      this.endT = (this.endT || 0) + dt;
      if (this.endT > 0.6) this.finish(this.st.reduce((a, b) => a + b, 0) / this.n);
      return;
    }
    const tick = Math.floor((this.t - this.lead) / this.beat);
    if (tick !== this.lastTick && this.t >= this.lead - 0.01) {
      this.lastTick = tick;
      w.sfx('click');
    }
    const want = this.i % 2 ? 'ArrowRight' : 'ArrowLeft';
    let got = null;
    for (const c of ['ArrowLeft', 'ArrowRight']) if (w.pressed(c) || w.pressed(ALT[c])) got = c;
    const off = this.t - this.due(this.i);
    if (got) {
      if (off < -this.beat * 0.5) return;
      const e = Math.abs(off);
      const q = got !== want ? 0.25 : e <= this.win2 ? 1 : e <= this.win2 * 2.2 ? 0.72 : 0.38;
      this.sew(q);
    } else if (off > this.beat * 0.45) this.sew(0);
  }

  sew(q) {
    const w = this.win;
    this.st.push(q);
    w.sfx(q >= 0.7 ? 'select' : 'error');
    const hx0 = 40 + this.i * 18;
    w.pops.add(q >= 1 ? 'TRUE' : q >= 0.7 ? 'GOOD' : q > 0 ? 'WONKY' : 'MISSED', hx0, 86, grade(q)[1], 1, 0.7);
    this.i++;
  }

  partial() {
    return this.st.reduce((a, b) => a + b, 0) / this.n;
  }

  paint(g, t) {
    lamp(g, TABLE.lantern.x, TABLE.lantern.y, t, false);
    // Two pieces laid over each other, the seam's holes along them.
    for (let x = 20; x < 236; x++) {
      for (let y = 90; y < 106; y++) dot(g, x, y, y === 90 ? '#d8a870' : hash2(x >> 1, y >> 1, 2) < 0.15 ? '#8a5a30' : '#a87444');
      for (let y = 100; y < 118; y++) dot(g, x, y, y === 100 ? '#e0b880' : y === 117 ? '#5a3a1e' : hash2(x >> 1, y >> 1, 4) < 0.15 ? '#7a4a28' : '#946234');
    }
    for (let k = 0; k <= this.n; k++) {
      const x = 40 + k * 18;
      dot(g, x, 98, '#2a1408');
      dot(g, x, 106, '#2a1408');
    }
    // The stitches made.
    this.st.forEach((q, k) => {
      const x0 = 40 + k * 18;
      const up = k % 2 === 0;
      const col = q >= 0.7 ? '#f0e8c8' : q > 0 ? '#c8a878' : null;
      if (!col) return;
      const wob = q >= 0.7 ? 0 : 2;
      line(g, x0, up ? 98 : 106, x0 + 18, (up ? 106 : 98) + wob, col);
    });
    // The needle at the hole it's to go through, bobbing to the beat.
    if (this.i < this.n) {
      const x = 40 + this.i * 18;
      const ph = ((this.t - this.lead) / this.beat) % 1;
      const bob = Math.round(Math.abs(Math.sin(ph * Math.PI)) * 6);
      line(g, x, 96 - bob, x + 4, 84 - bob, '#d8d8e0');
      dot(g, x + 4, 84 - bob, '#8a8a98');
      line(g, x + 4, 84 - bob, x + 18, 70, '#f0e8c8');
    }
  }

  paintUI(u) {
    text(u, `STITCH ${Math.min(this.n, this.i + 1)} OF ${this.n}`, 24, 30, '#e8d0a0');
    if (this.i >= this.n) return;
    // The beats to come along a rail, sliding toward the line.
    const ly = 40;
    const lx = 120;
    panel(u, 100, ly - 8, 320, 34);
    rect(u, 110, ly + 8, 300, 2, '#5a4a30');
    rect(u, lx, ly - 2, 2, 22, '#a8f0a0');
    for (let k = this.i; k < Math.min(this.n, this.i + 6); k++) {
      const dtk = this.due(k) - this.t;
      const x = lx + dtk * 90;
      if (x > 410) continue;
      const glyph = k % 2 ? '→' : '←';
      text(u, glyph, x - 6, ly + 2, k === this.i ? '#ffe070' : '#c8b890', { scale: 2 });
    }
  }
}

// The pour: the crucible tipped over the cast's mould; fill it to the
// line.
class Pour extends Stage {
  constructor(win) {
    super(win);
    this.rules = ['HOLD SPACE (OR THE BUTTON) TO TIP THE CRUCIBLE', 'LET GO WHEN THE MOULD\'S FILLED TO THE LINE', 'THE CAST DOES THE REST'];
    this.hint = 'POUR: HOLD SPACE OR THE BUTTON  ·  ESC: LEAVE';
    this.tilt = 0;
    this.fill = 0;
    this.poured = false;
  }

  update(dt) {
    const w = this.win;
    this.t += dt;
    const hold = w.holding() && !this.poured;
    this.tilt = clamp(this.tilt + (hold ? dt * 1.4 : -dt * 2.5));
    const rate = Math.max(0, this.tilt - 0.35) * 0.55;
    this.fill += rate * dt;
    if (rate > 0 && Math.random() < dt * 20) w.sparks.burst(SMITHY.anvil.x + 2, SMITHY.anvil.y - 8, 1, ['#fff0a0', '#ffa030'], 25, 0.5, 120);
    if (rate > 0 && !this.pouring) {
      this.pouring = true;
      w.sfx('pour');
    }
    if (rate <= 0) this.pouring = false;
    if (!hold && this.fill > 0.15 && !this.poured) this.poured = true;
    if (this.fill > 1.15) this.poured = true;
    if (this.poured && this.tilt <= 0) {
      this.endT = (this.endT || 0) + dt;
      if (this.endT > 0.6) this.finish(1 - Math.abs(this.fill - 1) * 3);
    }
  }

  partial() {
    return 0.5;
  }

  paint(g, t) {
    drawFire(g, t, 0.4);
    fireLight(g, t, 0.4);
    drawBellows(g, 0);
    const A = SMITHY.anvil;
    // The mould on the anvil: clay, its gate, the metal in it.
    const mx = A.x - 14;
    const my = A.y - 14;
    rect(g, mx, my, 28, 14, '#8a5a3a');
    rect(g, mx, my, 28, 1, '#b8845a');
    rect(g, mx + 2, my + 2, 24, 10, '#3a2418');
    const fh = Math.round(clamp(this.fill, 0, 1.2) * 10);
    for (let y = 0; y < Math.min(10, fh); y++) rect(g, mx + 2, my + 11 - y, 24, 1, hx(heatColour(0.75 + (y === fh - 1 ? 0.15 : 0))));
    rect(g, mx + 1, my + 2, 1, 1, '#a8f0a0');
    rect(g, mx + 26, my + 2, 1, 1, '#a8f0a0');
    if (this.fill > 1.02) for (let i = 0; i < 4; i++) dot(g, mx - 1 - i, my + 3 + i * 3, hx(heatColour(0.7)));
    if (fh > 0) glow(g, A.x, my + 6, 16, '#ff9030', 0.05);
    // The crucible, held over it in tongs, tipping.
    const cx = A.x + 18;
    const cy = A.y - 34;
    const a = -this.tilt * 1.4;
    for (let i = -6; i <= 6; i++) for (let j = -7; j <= 7; j++) {
      const rx = cx + Math.cos(a) * i - Math.sin(a) * j;
      const ry = cy + Math.sin(a) * i + Math.cos(a) * j;
      const edge = Math.abs(i) === 6 || j === 7;
      dot(g, rx, ry, edge ? '#5a4a40' : j < -4 ? hx(heatColour(0.85)) : '#7a6a5a');
    }
    thick(g, cx + 6, cy, cx + 40, cy - 16, 2, '#3a3a44');
    if (this.tilt > 0.35 && !(this.poured && this.tilt < 0.4)) {
      const lipX = cx + Math.cos(a) * -6 - Math.sin(a) * -7;
      const lipY = cy + Math.sin(a) * -6 + Math.cos(a) * -7;
      for (let y = Math.round(lipY); y < my + 12 - fh; y++) {
        const wob = Math.round(Math.sin(y * 0.6 + t * 20) * 0.6);
        dot(g, lipX + wob, y, hx(heatColour(0.9)));
        dot(g, lipX + wob + 1, y, hx(heatColour(0.75)));
      }
    }
  }

  paintUI(u) {
    meter(u, 24, 40, 140, 8, clamp(this.fill / 1.15), this.fill > 1.02 ? '#f09070' : '#ffb040', 'THE MOULD');
    rect(u, 24 + Math.round((1 / 1.15) * 140), 36, 1, 16, '#a8f0a0');
  }
}

const GAMES = { heat: Heat, hammer: Hammer, quench: Quench, shape: Shape, bind: Bind, bend: Bend, string: StringIt, cut: Cut, stitch: Stitch, pour: Pour };

// ------------------------------------------------------------ the window
export class ForgeWindow extends Window {
  // `cfg`: what's to be done (see smithing.forgeCfg). `mirror`: played here
  // for the host (see net/uiwire.js). `o.r`, `o.o`: the recipe and the
  // forge's options, to make it again.
  constructor(ui, cfg, { mirror = false, r = null, o = null } = {}) {
    super(ui, COLS, ROWS, { kind: 'forge', x: 0, y: 0 });
    this.forge = cfg;
    this.mirror = mirror;
    this.again0 = r ? { r, o } : null;
    this.passive = !!ui.remoteSeat && !mirror;
    this.t = 0;
    this.sent = false;
    if (this.passive) return;
    this.sparks = new Sparks();
    this.pops = new Pops();
    this.puffs = new Puffs();
    this.shop = SHOP[cfg.kind] || 'forge';
    this.ease = 1 + (cfg.rank || 0) * 0.06;
    this.adds = [];
    this.pattern = null;
    this.si = 0;
    this.scores = [];
    this.scroll = 0;
    this.prevKeys = {};
    this.lockTap = true;
    this.shake = 0;
    // (Pouring a cast wants nothing chosen first.)
    this.phase = cfg.mode === 'cast' ? 'intro' : 'prep';
    if (this.phase === 'intro') this.startStage();
  }

  // ---------------------------------------------------------- input
  held(...codes) {
    const inp = this.ui.input;
    return !!inp && codes.some((c) => inp.isDown(c));
  }

  mouse() {
    const m = this.ui.mouse || { x: 0, y: 0 };
    return { x: m.x, y: m.y, sx: m.x / 2, sy: m.y / 2, down: !!m.down };
  }

  // Held down: the space bar, or the button.
  holding() {
    return this.held('Space') || this.mouse().down;
  }

  // Struck this frame (the space bar, Enter or the button, from up).
  tapped() {
    return !this.lockTap && this.tapNow;
  }

  // A key struck this frame.
  pressed(code) {
    return this.held(code) && !this.prevKeys[code];
  }

  sfx(name) {
    this.ui.audio?.play(name);
  }

  // A string plucked, its note truer the truer the pluck.
  pluck(q) {
    const a = this.ui.audio;
    if (a && a.tone) {
      try {
        a.tone(330 * (1 + (1 - q) * 0.06 * (Math.random() < 0.5 ? -1 : 1)), 0.5, 'triangle', 0.06);
      } catch {
        // (Not heard.)
      }
    }
  }

  // ---------------------------------------------------------- the flow
  startStage() {
    const name = this.forge.stages[this.si];
    const G = GAMES[name];
    this.play = G ? new G(this) : null;
    this.phase = 'intro';
    this.lockTap = true;
  }

  begin() {
    this.phase = 'play';
    this.lockTap = true;
    this.sfx('select');
  }

  // How the stage went: a word for it, then the next (or the piece).
  stageDone() {
    const q = this.play.score;
    this.scores.push(Math.round(q * 1000) / 1000);
    this.phase = 'between';
    this.betweenT = 0;
    this.lastGrade = grade(q);
    this.sfx(q >= 0.56 ? 'fanfare' : 'select');
  }

  // All done: how it went, to the host (or, at home, straight to the
  // forge).
  finish() {
    if (this.sent) return;
    this.sent = true;
    const scores = this.forge.stages.map((_, i) => this.scores[i] || 0);
    this.msgSent = { k: 'forge', token: this.forge.token, scores, adds: this.adds.slice(), pattern: this.pattern };
    this.phase = 'wait';
    if (this.mirror) (this.ui.forward ||= []).push({ code: 'ForgeAct', key: JSON.stringify(this.msgSent) });
    else this.forge.reply = this.work(this.msgSent);
  }

  // (At the host.) The piece made of how it went.
  work(m) {
    const game = this.ui.game;
    if (!game || !m || m.token !== this.forge.token) return null;
    const reply = forgeResult(game, this.forge, m);
    this.sentAdds = m.adds || [];
    if (reply.ok) {
      game.audio?.play(reply.failed ? 'error' : 'craft');
      if (reply.key && ITEMS[reply.key]) this.ui.msg?.(`${reply.made > 1 ? `${reply.made}× ` : ''}${'★'.repeat(ITEMS[reply.key].stars || 0)} ${ITEMS[reply.key].name}`, reply.failed ? '#c8b890' : '#ffd060');
      if (reply.rankUp) this.ui.msg?.(`Your smithing's come on: ${mastery(game, 'smithing').title}.`, '#a8f0a0');
    }
    return reply;
  }

  // (At the host.) What's done with the piece after: written down,
  // pressed into a cast.
  after(act) {
    const game = this.ui.game;
    const r = this.forge.reply;
    if (!game || !r || !r.ok || !r.key) return;
    let res = null;
    if (act === 'pattern') res = writePattern(game, r.key, this.sentAdds || []);
    else if (act === 'cast') res = pressCast(game, r.key);
    if (!res) return;
    this.forge.reply = { ...r, note: res.text, noteOk: res.ok, [`did_${act}`]: res.ok ? 1 : 0 };
    if (res.ok) game.audio?.play('craft');
    else game.audio?.play('error');
  }

  act(a) {
    if (this.mirror) {
      (this.ui.forward ||= []).push({ code: 'ForgeAct', key: JSON.stringify({ k: 'forge', token: this.forge.token, act: a }) });
      return;
    }
    this.after(a);
  }

  again() {
    if (this.mirror) {
      (this.ui.forward ||= []).push({ code: 'ForgeAct', key: JSON.stringify({ k: 'forge', token: this.forge.token, again: 1 }) });
      (this.ui.putDown ||= new Set()).add(this.mirrorOf);
      Window.prototype.close.call(this);
      return;
    }
    this.reopen();
  }

  // (At the host.) The same again, if there's the makings for it.
  reopen() {
    const game = this.ui.game;
    Window.prototype.close.call(this);
    if (game && this.again0) openForge(this.ui, game, this.again0.r, this.again0.o);
  }

  close() {
    if (this.mirror && this.state !== 'closing') {
      (this.ui.forward ||= []).push({ code: 'Escape', key: 'Escape' });
      (this.ui.putDown ||= new Set()).add(this.mirrorOf);
    }
    super.close();
  }

  contains() {
    return true;
  }

  draw() {}

  update(dt) {
    if (this.passive) return;
    this.t += dt;
    this.sparks.update(dt);
    this.pops.update(dt);
    this.puffs.update(dt);
    this.shake = Math.max(0, this.shake - dt);
    const tapNow = this.held('Space', 'Enter') || this.mouse().down;
    this.tapNow = tapNow && !this.prevTap;
    if (!tapNow) this.lockTap = false;
    if (this.phase === 'play' && this.play) {
      this.play.update(dt);
      if (this.play.done) this.stageDone();
    } else if (this.phase === 'between') {
      this.betweenT += dt;
      if (this.betweenT > 1.3) {
        this.si++;
        if (this.si < this.forge.stages.length) this.startStage();
        else this.finish();
      }
    } else if (this.phase === 'wait') {
      if (this.forge.reply) {
        this.phase = 'reveal';
        this.revealT = 0;
        this.shownStars = 0;
      }
    } else if (this.phase === 'reveal') {
      this.revealT += dt;
      const r = this.forge.reply;
      const n = r && r.ok ? r.stars || 0 : 0;
      const due = Math.min(n, Math.floor((this.revealT - 0.5) / 0.28) + 1);
      if (due > this.shownStars) {
        this.shownStars = due;
        this.sfx('select');
        this.pops.add('★', 128 - (n - 1) * 9 + (due - 1) * 18, 70, '#ffe070', 2, 0.6);
      }
    } else if (this.phase === 'intro' && this.shop === 'forge') {
      if (Math.random() < dt * 3) this.sparks.burst(SMITHY.mouth.x + (Math.random() - 0.5) * 20, SMITHY.mouth.y - 4, 1, ['#ffb040', '#ff6020'], 18, 1.6, -22);
    }
    this.prevTap = tapNow;
    for (const c of ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'KeyA', 'KeyD', 'KeyW', 'KeyS']) this.prevKeys[c] = this.held(c);
  }

  // ---------------------------------------------------------- keys
  onKey(k) {
    if (this.passive) {
      if (k.code === 'ForgeAct') {
        let m = null;
        try {
          m = JSON.parse(k.key);
        } catch {
          return true;
        }
        if (!m || m.token !== this.forge.token) return true;
        if (m.again) this.reopen();
        else if (m.act) this.after(m.act);
        else if (!this.sent) {
          this.sent = true;
          const reply = this.work(m);
          if (reply) this.forge.reply = { ...reply };
        }
        return true;
      }
      if (k.code === 'Escape') super.close();
      return true;
    }
    if (k.code === 'Escape') {
      // (Walked away mid-work: it's had as far as it went, and the
      // makings with it. Asked first.)
      if ((this.phase === 'play' || this.phase === 'between' || (this.phase === 'intro' && this.si > 0)) && !this.sent) {
        if (!this.leaving) {
          this.leaving = 1.6;
          this.sfx('error');
          return true;
        }
        if (this.phase === 'play' && this.play) this.scores[this.si] = this.play.partial();
        this.finish();
        return true;
      }
      this.close();
      return true;
    }
    this.leaving = 0;
    if (this.phase === 'prep') {
      if (k.code === 'Enter' || k.code === 'Space') this.prepGo();
      return true;
    }
    if (this.phase === 'intro') {
      if (k.code === 'Space' || k.code === 'Enter' || k.code === 'KeyE') this.begin();
      return true;
    }
    if (this.phase === 'reveal' && this.revealT > 0.8 && (k.code === 'Enter' || k.code === 'Space')) this.close();
    return true;
  }

  onClick(ck) {
    if (this.passive) return true;
    if (ck && ck.button === 2) return this.onKey({ code: 'Escape', key: 'Escape' });
    const m = this.mouse();
    if (this.phase === 'prep') {
      for (const b of this.btns || []) if (inRect(m, b)) {
        b.fn();
        return true;
      }
    } else if (this.phase === 'intro') this.begin();
    else if (this.phase === 'reveal' && this.revealT > 0.6) {
      for (const b of this.btns || []) if (inRect(m, b)) {
        b.fn();
        return true;
      }
    }
    return true;
  }

  onWheel(d) {
    if (this.phase === 'prep') this.scroll = Math.max(0, this.scroll + Math.sign(d));
  }

  // The work begun (the additives chosen; a temper wants its material).
  prepGo() {
    const f = this.forge;
    if (f.mode === 'temper' && !this.adds.some((k) => lifts(k))) {
      this.sfx('error');
      this.flashNeed = 1.2;
      return;
    }
    this.si = 0;
    this.startStage();
  }

  toggleAdd(k) {
    if (this.pattern) return;
    const i = this.adds.indexOf(k);
    if (i >= 0) this.adds.splice(i, 1);
    else if (this.adds.length < (this.forge.mode === 'temper' ? 1 : MAX_ADDS)) this.adds.push(k);
    else {
      this.sfx('error');
      return;
    }
    this.sfx('select');
  }

  togglePattern(p) {
    if (this.pattern === p.k) {
      this.pattern = null;
      this.adds = [];
    } else {
      this.pattern = p.k;
      this.adds = (p.adds || []).filter((k) => this.forge.adds.some((a) => a.k === k));
    }
    this.sfx('select');
  }

  // ---------------------------------------------------------- drawing
  drawPixels(ctx) {
    if (this.passive || typeof document === 'undefined') return;
    this.scene ||= makeBuf(FW, FH);
    this.over ||= makeBuf(UW, UH);
    if (!this.scene || !this.over) return;
    if (!this.back) {
      try {
        this.back = paintWork(this.shop, (this.forge.token || 1) % 7).canvas();
      } catch {
        this.back = null;
      }
    }
    const g = this.scene.getContext('2d');
    const u = this.over.getContext('2d');
    g.imageSmoothingEnabled = false;
    u.imageSmoothingEnabled = false;
    g.fillStyle = '#100c08';
    g.fillRect(0, 0, FW, FH);
    if (this.back) g.drawImage(this.back, 0, 0);
    u.clearRect(0, 0, UW, UH);
    try {
      if (this.play && (this.phase === 'play' || this.phase === 'between' || this.phase === 'intro')) this.play.paint(g, this.t);
      else this.paintIdle(g, this.t);
      this.puffs.draw(g);
      this.sparks.draw(g);
      if (this.phase === 'play' && this.play && this.play.paintUI) this.play.paintUI(u, this.t);
    } catch (e) {
      void e;
    }
    this.pops.draw(u);
    if (this.phase === 'prep') this.paintPrep(u);
    else if (this.phase === 'intro') this.paintIntro(u);
    else if (this.phase === 'between') this.paintBetween(u);
    else if (this.phase === 'wait') text(u, 'THE PIECE COOLS...', UW / 2, UH / 2 - 8, '#e8d0a0', { scale: 2, align: 'center' });
    else if (this.phase === 'reveal') this.paintReveal(u);
    this.paintHead(u);
    this.paintHint(u);
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    const sx = this.shake > 0 ? Math.round((Math.random() - 0.5) * 4) : 0;
    const sy = this.shake > 0 ? Math.round((Math.random() - 0.5) * 4) : 0;
    ctx.drawImage(this.scene, sx, sy, UW, UH);
    ctx.drawImage(this.over, 0, 0);
    ctx.restore();
  }

  // The shop at rest (behind the boards before and after the work).
  paintIdle(g, t) {
    if (this.shop === 'forge') {
      drawFire(g, t, 0.4);
      fireLight(g, t, 0.4);
      drawBellows(g, 0);
      if (this.phase === 'reveal' && this.forge.reply && this.forge.reply.key) drawWater(g, t, 0);
    } else if (this.shop === 'carve') benchLight(g, t);
    else if (this.shop === 'bow') {
      lamp(g, BOWYER.lamp.x, BOWYER.lamp.y, t, true);
      paintBow(g, BOWYER.tiller.x, 30, 0, [], false);
    } else lamp(g, TABLE.lantern.x, TABLE.lantern.y, t, false);
    // (The boards over it read better on a darkened scene.)
    g.fillStyle = 'rgba(8,6,10,0.45)';
    g.fillRect(0, 0, FW, FH);
  }

  // The work's name and its stages along the top, done and to do.
  paintHead(u) {
    const f = this.forge;
    rect(u, 0, 0, UW, 16, 'rgba(0,0,0,0.78)');
    text(u, `${WORK_NAMES[f.kind] || 'AT THE FORGE'} · ${String(f.name || '').toUpperCase()}`, 8, 4, '#ffe070');
    if (this.phase === 'prep') return;
    let x = UW - 8;
    for (let i = f.stages.length - 1; i >= 0; i--) {
      const nm = f.stages[i].toUpperCase();
      const w = nm.length * 6 + 8;
      x -= w;
      const done = this.scores[i] !== undefined;
      const now = i === this.si && !done;
      const col = done ? grade(this.scores[i])[1] : now ? '#ffffff' : '#7a6a58';
      text(u, nm, x, 4, col);
      if (i > 0) text(u, '·', x - 7, 4, '#5a4a38');
    }
  }

  paintHint(u) {
    let hint = 'ESC: LEAVE';
    if (this.phase === 'prep') hint = 'CLICK TO ADD TO IT  ·  ENTER: BEGIN  ·  ESC: CANCEL';
    else if (this.phase === 'intro') hint = 'SPACE OR CLICK TO BEGIN  ·  ESC: LEAVE';
    else if (this.phase === 'play' && this.play) hint = this.play.hint;
    else if (this.phase === 'reveal') hint = 'ENTER: DONE';
    if (this.leaving > 0) {
      this.leaving = Math.max(0, this.leaving - 1 / 60);
      hint = 'LEAVE NOW AND THE PIECE IS SPOILT AS IT IS: ESC AGAIN TO LEAVE';
    }
    rect(u, 0, UH - 14, UW, 14, 'rgba(0,0,0,0.85)');
    text(u, hint, UW / 2, UH - 11, this.leaving > 0 ? '#ff9070' : '#c8b890', { align: 'center' });
  }

  // A button in the view's pixels (kept for the click).
  button(u, b, label, { on = true, hi = false } = {}) {
    const m = this.mouse();
    const hov = on && inRect(m, b);
    rect(u, b.x, b.y, b.w, b.h, !on ? 'rgba(30,26,30,0.9)' : hov ? C.bgHi || '#3a3050' : hi ? 'rgba(40,60,30,0.95)' : 'rgba(40,30,20,0.95)');
    rect(u, b.x, b.y, b.w, 1, on ? '#c8a060' : '#4a4038');
    rect(u, b.x, b.y + b.h - 1, b.w, 1, '#5a4a30');
    text(u, label, b.x + b.w / 2, b.y + Math.round((b.h - 7) / 2), !on ? '#6a6058' : hov ? '#fff0c0' : '#e8d0a0', { align: 'center' });
    if (on) this.btns.push(b);
  }

  // Before the work: what you are, what it allows, what's to go in.
  paintPrep(u) {
    const f = this.forge;
    this.btns = [];
    const pw = 360;
    const ph = 250;
    const x = (UW - pw) / 2;
    const y = 22;
    panel(u, x, y, pw, ph);
    // The piece, large, and what's known of it.
    rect(u, x + 12, y + 12, 52, 52, 'rgba(0,0,0,0.5)');
    let icon = null;
    try {
      icon = itemIcon(f.piece || f.out);
    } catch {
      icon = null;
    }
    if (icon) u.drawImage(icon, x + 14, y + 14, 48, 48);
    const nm = f.piece && ITEMS[f.piece] ? ITEMS[f.piece].name : f.name;
    text(u, String(nm).slice(0, 44), x + 74, y + 14, '#ffe8a0');
    text(u, `SMITHING: ${String(f.title || '').toUpperCase()} (RANK ${f.rank})`, x + 74, y + 28, '#c8b890');
    const mcap = f.mode === 'make' ? materialCap({ in: f.ins }, this.adds) : 5;
    if (f.mode === 'make') {
      text(u, `YOUR HAND: UP TO ${'★'.repeat(masteryCap(f.rank))}`, x + 74, y + 40, '#ffd060');
      text(u, `ITS MAKINGS: UP TO ${'★'.repeat(mcap)}${mcap < 5 && !this.adds.some((k) => lifts(k)) ? ' (A RARE MATERIAL: MORE)' : ''}`, x + 74, y + 52, '#ffd060');
    } else if (f.mode === 'reforge') {
      text(u, 'ITS STARS KEPT; ITS MODIFIERS BEATEN OUT AFRESH', x + 74, y + 40, '#e8d0a0');
      text(u, 'DONE WELL, ITS FLAWS BEATEN OUT TOO', x + 74, y + 52, '#a8e0a0');
      if (f.cost) text(u, `IT COSTS ¤${f.cost.coin} AND ${f.cost.name.toUpperCase()}`, x + 74, y + 64, '#c8b890');
    } else if (f.mode === 'temper') {
      text(u, `A RARE MATERIAL WORKED IN: ONE STAR MORE (UP TO ${masteryCap(f.rank)})`, x + 74, y + 40, '#e8d0a0');
      text(u, 'THE MATERIAL\'S SPENT WHETHER IT TAKES OR NOT', x + 74, y + 52, '#c8a080');
    }
    let yy = y + 72;
    // Patterns written for it.
    if (f.patterns && f.patterns.length) {
      text(u, 'FROM A PATTERN:', x + 14, yy, '#c8b890');
      yy += 12;
      for (const p of f.patterns.slice(0, 2)) {
        const on = this.pattern === p.k;
        const b = { x: x + 12, y: yy - 2, w: pw - 24, h: 14 };
        const hov = inRect(this.mouse(), b);
        rect(u, b.x, b.y, b.w, b.h, on ? 'rgba(60,50,90,0.95)' : hov ? 'rgba(50,40,60,0.9)' : 'rgba(30,24,34,0.8)');
        text(u, `${on ? '◆' : '·'} ${String(p.name).slice(0, 50)}`, x + 18, yy + 1, on ? '#ffffff' : '#d8c8f0');
        this.btns.push({ ...b, fn: () => this.togglePattern(p) });
        yy += 16;
      }
      yy += 2;
    }
    // The additives to hand.
    const limit = f.mode === 'temper' ? 1 : MAX_ADDS;
    text(u, f.mode === 'temper' ? 'THE MATERIAL TO WORK IN:' : `ADD TO IT (UP TO ${limit}):`, x + 14, yy, this.flashNeed > 0 && Math.floor(this.t * 8) % 2 ? '#ff9070' : '#c8b890');
    this.flashNeed = Math.max(0, (this.flashNeed || 0) - 1 / 60);
    yy += 12;
    const list = f.adds || [];
    const per = Math.max(1, Math.floor((y + ph - 34 - yy) / 17));
    this.scroll = Math.min(this.scroll, Math.max(0, list.length - per));
    if (!list.length) text(u, f.mode === 'temper' ? 'YOU HAVEN\'T A RARE MATERIAL ABOUT YOU.' : 'NOTHING ABOUT YOU THAT WOULD GO IN.', x + 18, yy + 2, '#7a6a58');
    list.slice(this.scroll, this.scroll + per).forEach((a, k) => {
      const ry = yy + k * 17;
      const on = this.adds.includes(a.k);
      const b = { x: x + 12, y: ry - 1, w: pw - 24, h: 16 };
      const hov = inRect(this.mouse(), b) && !this.pattern;
      rect(u, b.x, b.y, b.w, b.h, on ? 'rgba(70,56,30,0.95)' : hov ? 'rgba(50,40,30,0.9)' : k % 2 ? 'rgba(24,20,26,0.8)' : 'rgba(30,26,32,0.8)');
      let ic = null;
      try {
        ic = itemIcon(a.k);
      } catch {
        ic = null;
      }
      if (ic) u.drawImage(ic, x + 16, ry - 1, 16, 16);
      const col = RARITY[a.rarity] ? RARITY[a.rarity].color : '#e8e0d0';
      text(u, `${on ? '◆ ' : ''}${a.name}`.slice(0, 22), x + 36, ry + 4, on ? '#ffffff' : col);
      text(u, `×${a.n}`, x + 176, ry + 4, '#a89878');
      text(u, a.traits === '?' ? '? (NOT YET WORKED)' : String(a.traits).slice(0, 26), x + 200, ry + 4, a.traits === '?' ? '#7a6a58' : '#a8d8a0');
      if (!this.pattern) this.btns.push({ ...b, fn: () => this.toggleAdd(a.k) });
    });
    if (list.length > per) text(u, `${this.scroll + 1}-${Math.min(list.length, this.scroll + per)} OF ${list.length} (WHEEL)`, x + pw - 14, y + ph - 44, '#7a6a58', { align: 'right' });
    const bw = 120;
    this.button(u, { x: UW / 2 - bw - 6, y: y + ph - 26, w: bw, h: 16, fn: () => this.prepGo() }, f.mode === 'reforge' ? 'REFORGE IT' : f.mode === 'temper' ? 'TEMPER IT' : 'BEGIN THE WORK', { hi: true, on: f.mode !== 'temper' || list.length > 0 });
    this.button(u, { x: UW / 2 + 6, y: y + ph - 26, w: bw, h: 16, fn: () => this.close() }, 'NOT NOW');
  }

  // Each stage's card: its name, how it's played.
  paintIntro(u) {
    const P = this.play;
    const rules = (P && P.rules) || [];
    const pw = 360;
    const ph = 74 + rules.length * 12;
    const x = (UW - pw) / 2;
    const y = Math.round((UH - ph) / 2) - 10;
    panel(u, x, y, pw, ph);
    const name = STAGE_NAMES[this.forge.stages[this.si]] || '';
    text(u, name, UW / 2, y + 10, '#ffe070', { scale: 2, align: 'center' });
    text(u, `STAGE ${this.si + 1} OF ${this.forge.stages.length}${this.ease > 1.01 ? `  ·  YOUR PRACTISED HAND: ${Math.round((this.ease - 1) * 100)}% MORE LEEWAY` : ''}`, UW / 2, y + 30, '#c8b890', { align: 'center' });
    rules.forEach((l, i) => text(u, l, UW / 2, y + 46 + i * 12, '#f0e0c0', { align: 'center' }));
    if (Math.floor(this.t * 2.5) % 3) text(u, 'SPACE OR CLICK TO BEGIN', UW / 2, y + ph - 16, '#ffe8a0', { align: 'center' });
  }

  paintBetween(u) {
    const [word, col] = this.lastGrade || ['', '#ffffff'];
    const k = Math.min(1, this.betweenT / 0.2);
    text(u, word, UW / 2, UH / 2 - 30, col, { scale: k < 1 ? 3 : 4, align: 'center' });
  }

  // After: the piece as it came out.
  paintReveal(u) {
    const f = this.forge;
    const r = f.reply || {};
    this.btns = [];
    const pw = 380;
    const ph = 236;
    const x = (UW - pw) / 2;
    const y = 22;
    panel(u, x, y, pw, ph);
    if (!r.ok) {
      wrap(r.text || 'Something went wrong at the forge.', 56).forEach((l, i) => text(u, l, UW / 2, y + 40 + i * 12, '#f0b090', { align: 'center' }));
      this.button(u, { x: UW / 2 - 60, y: y + ph - 26, w: 120, h: 16, fn: () => this.close() }, 'DONE');
      return;
    }
    const t = this.revealT;
    const it = ITEMS[r.key];
    // Rays behind the piece, turning, and the piece growing in.
    const cx = UW / 2;
    const cy = y + 50;
    u.save();
    u.globalAlpha = 0.16;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 + t * 0.4;
      for (let rr = 18; rr < 60; rr += 2) rect(u, cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, 2, 2, r.failed ? '#a89878' : '#ffe070');
    }
    u.restore();
    const s = t < 0.12 ? 1 : t < 0.24 ? 2 : t < 0.36 ? 3 : 4;
    let icon = null;
    try {
      icon = itemIcon(r.key);
    } catch {
      icon = null;
    }
    if (icon) u.drawImage(icon, cx - 8 * s, cy - 8 * s, 16 * s, 16 * s);
    const nm = `${r.made > 1 ? `${r.made}× ` : ''}${it ? it.name : r.name}`;
    text(u, nm.length > 28 ? nm : nm.toUpperCase(), cx, y + 88, '#ffe8a0', { scale: nm.length > 28 ? 1 : 2, align: 'center' });
    // Its stars, popped in one by one.
    const n = r.stars || 0;
    for (let i = 0; i < 5; i++) {
      const on = i < this.shownStars;
      text(u, i < n ? (on ? '★' : '☆') : '', cx - (n - 1) * 9 + i * 18 - 6, y + 106, on ? '#ffe070' : '#5a4a30', { scale: 2 });
    }
    let yy = y + 128;
    const showMods = t > 0.5 + n * 0.28;
    if (showMods) {
      if (r.failed && r.text) wrap(r.text, 58).forEach((l) => {
        text(u, l, cx, yy, '#d8b890', { align: 'center' });
        yy += 11;
      });
      for (const m of r.mods || []) {
        const col = m.flaw ? '#f08060' : m.cond ? '#90c8f8' : '#f0c070';
        const ln = `${m.flaw ? '× ' : '◆ '}${m.name}${m.about ? `: ${m.about}` : ''}`;
        wrap(ln, 60).slice(0, 2).forEach((l, j) => {
          text(u, j ? `  ${l}` : l, x + 16, yy, col);
          yy += 10;
        });
      }
      if (!(r.mods || []).length && !r.failed) {
        text(u, 'NO MODIFIERS: A PLAIN, HONEST PIECE', cx, yy, '#a89878', { align: 'center' });
        yy += 11;
      }
      for (const l of r.learned || []) {
        text(u, `YOU'VE LEARNT WHAT ${String(l.name).toUpperCase()} IS: ${String(l.traits).toUpperCase()}`.slice(0, 62), cx, yy + 2, '#a8f0a0', { align: 'center' });
        yy += 11;
      }
      if (r.rankUp) text(u, 'YOUR SMITHING HAS COME ON!', cx, yy + 2, '#a8f0a0', { align: 'center' });
      if (r.note) wrap(String(r.note), 58).slice(0, 2).forEach((l, i, a) => text(u, l, cx, y + ph - 38 - (a.length - 1 - i) * 10, r.noteOk ? '#a8f0a0' : '#f0b090', { align: 'center' }));
    }
    // What's to be done with it now.
    const make = f.mode === 'make' && !r.failed;
    const btns = [];
    if (make) btns.push(['WRITE PATTERN', () => this.act('pattern'), !r.did_pattern]);
    if (make) btns.push(['PRESS A CAST', () => this.act('cast'), !r.did_cast]);
    if (f.mode === 'make' || f.mode === 'cast') btns.push(['AGAIN', () => this.again(), true]);
    btns.push(['DONE', () => this.close(), true]);
    const bw = 86;
    const gap = 6;
    let bx = cx - (btns.length * bw + (btns.length - 1) * gap) / 2;
    for (const [label, fn, on] of btns) {
      this.button(u, { x: bx, y: y + ph - 24, w: bw, h: 16, fn }, label, { on: on && t > 0.6 });
      bx += bw + gap;
    }
  }
}

// Opened from a bench (see ui/windows.js CraftWindow, ui/reforge.js):
// what's to be done, and the window to do it in.
export function openForge(ui, game, r, o = {}) {
  // (Not begun without the makings for it: told now, not after the work.)
  if (r && (!o.mode || o.mode === 'make' || o.mode === 'cast')) {
    const src = craftSources(game);
    const n = o.mode === 'cast' ? o.times || 1 : 1;
    const short = Object.entries(r.in).find(([k, c]) => countFrom(src, k) < c * n) || (o.mode === 'cast' && countFrom(src, 'relic_shard') < n ? ['relic_shard'] : null);
    if (short) {
      ui.msg?.(`You haven't the ${ITEMS[short[0]] ? ITEMS[short[0]].name.toLowerCase() : short[0]} for it.`, '#ffb080');
      game.audio?.play('error');
      return false;
    }
  }
  const cfg = forgeCfg(game, r, o);
  if (!cfg.kind || !cfg.stages.length) return false;
  ui.open(new ForgeWindow(ui, cfg, { r, o }));
  return true;
}
