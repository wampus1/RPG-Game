// (Round 132) The forge's games, played over the whole screen (see
// game/smithing.js for what comes of them): iron heated in the hearth with
// the bellows, beaten out on the anvil stroke by stroke, quenched in the tub
// at the colour it wants; wood and stone shaped at the bench with mallet and
// chisel and their grips bound; a bow's stave bent on the tillering post
// notch by notch and its string tuned; leather cut along the chalk and
// stitched to a beat; a cast's mould poured from the crucible.
//
// (Round 133) The workshops are built and lit rather than painted (see
// ui/forgepaint.js, ui/forgelight.js): rooms in perspective, solid things
// standing in them casting their shadows, lit afresh each moment by the
// fire, the lamp, the window, the hot iron; and what moves (the bar, the
// hammer, the bellows, the bow, the hide) laid into the same light. The
// words and the boards over it are in the view's own pixels, in the game's
// own letters.
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
import { hex, rgb, mixC } from '../render/brush.js';
import { UW, UH, makeBuf, rand, rect, disc, text, wrap, panel, meter, Sparks, Pops } from './festpaint.js';
import { FW, FH, SMITHY, BENCH, BOWYER, TABLE, Shop, shopOf, heatColour, fire, bellows, ironBar, billet, hammer, quenchPiece, water, tubMouth, crucible, motes, blank, chisel, binding, lamp, bowOnPost, lantern, hide, seam } from './forgepaint.js';
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
// Where things are on the scene (the cameras never move).
const FIRE_AT = SMITHY.cam.p(...SMITHY.fire);
const sp = (cam, x, y, d) => cam.p(x, y, d);

// Steam (or smoke): puffs that rise, swell and thin, in steps.
class Puffs {
  constructor() {
    this.list = [];
  }

  add(x, y, n, { col = '#dfe6ea', speed = 18, life = 1.6, r = 2 } = {}) {
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

  // (Lit from below and the side by the fire: a warm rim on a cool puff.)
  draw(g) {
    g.save();
    for (const p of this.list) {
      const k = p.t / p.life;
      g.globalAlpha = Math.round((1 - k) * 4) * 0.11;
      disc(g, p.x, p.y, Math.round(p.r), '#8a98a8');
      disc(g, p.x - 1, p.y - 1, Math.max(1, Math.round(p.r * 0.75)), p.col);
      g.globalAlpha *= 0.8;
      disc(g, p.x - Math.round(p.r * 0.4), p.y + Math.round(p.r * 0.3), Math.max(1, Math.round(p.r * 0.35)), '#ffc890');
    }
    g.restore();
  }
}

// A ring of pixels on the scene (a timing mark).
function ring(g, x, y, r, col, n = null) {
  const steps = n || Math.max(12, Math.round(r * 6));
  g.fillStyle = col;
  for (let a = 0; a < steps; a++) {
    const an = (a / steps) * Math.PI * 2;
    g.fillRect(Math.round(x + Math.cos(an) * r), Math.round(y + Math.sin(an) * r), 1, 1);
  }
}

// ------------------------------------------------------------ the stages
// Each stage: `rules` (its card), `hint` (along the foot); update; paint
// (into the shop's light), over (marks on the scene), paintUI (the view's
// boards); when it's done, `done` and its `score` (0 to 1).
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
    if (hold) {
      this.cyc += dt * 4.2;
      const s = (1 - Math.cos(this.cyc)) / 2;
      if (s > 0.95 && !this.puffed) {
        this.puffed = true;
        w.sfx('whoosh');
        w.sparks.burst(FIRE_AT[0], FIRE_AT[1] + 4, 7, ['#ffd060', '#ff8030', '#fff0b0'], 32, 1.2, -40);
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
      if (Math.random() < dt * 14) w.sparks.burst(FIRE_AT[0] + 10, FIRE_AT[1] + 6, 2, ['#ffffff', '#fff0a0'], 40, 0.5, 40);
    }
    if (Math.random() < dt * (2 + this.fire * 6)) w.sparks.burst(FIRE_AT[0] + (Math.random() - 0.5) * 22, FIRE_AT[1] + 2, 1, ['#ffb040', '#ff6020'], 18, 1.6, -22);
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

  paint(S, t, st) {
    fire(S, t, this.fire);
    bellows(S, this.squeeze);
    st.fire = this.fire;
    st.iron = ironBar(S, this.heat);
    water(S, t);
  }

  paintUI(u) {
    // The colour of the iron, from cold to white, and the band it wants.
    const x = 470;
    const y0 = 40;
    const h = 180;
    gauge(u, x, y0, h);
    for (let j = 0; j < h; j++) rect(u, x, y0 + h - 1 - j, 14, 1, hx(heatColour(j / h)));
    const [lo, hi] = this.band();
    const by0 = y0 + h - Math.round(hi * h);
    const by1 = y0 + h - Math.round(lo * h);
    rect(u, x - 6, by0, 26, 1, '#a8f0a0');
    rect(u, x - 6, by1, 26, 1, '#a8f0a0');
    rect(u, x - 6, by0, 1, by1 - by0, '#a8f0a0');
    rect(u, x + 19, by0, 1, by1 - by0, '#a8f0a0');
    pointer(u, x - 12, y0 + h - Math.round(clamp(this.heat) * h));
    text(u, 'HEAT', x + 7, y0 - 14, '#e8d0a0', { align: 'center' });
    meter(u, 24, 40, 140, 8, this.soak / this.need, '#ff9a40', 'SOAKED THROUGH');
    if (this.burn > 0 && this.heat > this.band()[1] + 0.08 && Math.floor(this.t * 6) % 2) text(u, 'TOO HOT! IT\'S BURNING', 256, 56, '#ff7050', { scale: 2, align: 'center' });
  }
}
// A gauge's frame: iron, riveted.
function gauge(u, x, y0, h) {
  rect(u, x - 4, y0 - 4, 22, h + 8, '#1a1820');
  rect(u, x - 3, y0 - 3, 20, h + 6, '#4a4a56');
  rect(u, x - 3, y0 - 3, 20, 1, '#8a8a9a');
  rect(u, x - 1, y0 - 1, 16, h + 2, '#0c0a10');
  for (const yy of [y0 - 2, y0 + h + 1]) {
    rect(u, x - 2, yy, 1, 1, '#c8c8d8');
    rect(u, x + 15, yy, 1, 1, '#c8c8d8');
  }
}
// A pointer at a gauge's side.
function pointer(u, x, y) {
  for (let i = 0; i < 5; i++) rect(u, x + i, y - 4 + i, 1, 9 - i * 2, i === 4 ? '#ffe070' : '#ffffff');
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
    this.flash = 0;
    this.next();
  }

  next() {
    const [x, y] = sp(SMITHY.cam, this.r.float(-1, 19), SMITHY.anvil.face - 2, 71);
    this.ring = { x, y, r: 22, dur: Math.max(0.65, 1.15 - this.i * 0.06) };
    this.rt = 0;
  }

  update(dt) {
    const w = this.win;
    this.t += dt;
    this.heat = Math.max(0.1, this.heat - dt * 0.035);
    this.swing = Math.min(1, this.swing + dt * 5);
    this.flash = Math.max(0, this.flash - dt * 8);
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
    w.sparks.burst(R.x, R.y, q >= 1 ? 28 : q >= 0.7 ? 18 : 9, ['#fff8d0', '#ffd060', '#ff9030', '#ffffff'], q >= 1 ? 85 : 58, 0.6, 140);
    w.pops.add(cold ? 'TOO COLD' : q >= 1 ? 'TRUE!' : q >= 0.7 ? 'GOOD' : q >= 0.4 ? 'OFF' : 'WILD', R.x, R.y - 14, cold ? '#90b0f0' : grade(q)[1]);
    this.flash = 1;
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

  paint(S, t, st) {
    fire(S, t, 0.35);
    bellows(S, 0);
    water(S, t);
    st.fire = 0.35;
    st.iron = billet(S, this.cfg.out, this.heat, this.i / this.n, this.flash);
    hammer(S, this.swing < 0.15 ? 1 : 1 - (this.swing - 0.15) / 0.85);
  }

  over(g, t) {
    if (this.gap > 0 || this.i >= this.n) return;
    const R = this.ring;
    const rad = R.r * (1 - this.rt / R.dur);
    ring(g, R.x, R.y, 3, '#a8f0a0', 24);
    if (rad > 0) ring(g, R.x, R.y, rad, Math.abs(rad - 3) <= 1.6 * this.win.ease ? '#ffffff' : '#ffd060');
    void t;
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

// The quench: the piece held over the tub, cooling; plunge it at the
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
      const [mx, my] = tubMouth(w.shopArt || { p: (...a) => SMITHY.cam.p(...a) });
      if (this.after < 1.2 && Math.random() < dt * 30) w.puffs.add(mx + (Math.random() - 0.5) * 20, my - 2, 1, { speed: 24, life: 1.8, r: 2.5 });
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
    const [mx, my] = SMITHY.cam.p(SMITHY.tub.cx, SMITHY.tub.water, SMITHY.tub.cz - 3);
    w.puffs.add(mx, my - 4, 18, { speed: 34, life: 2, r: 3 });
    w.pops.add(grade(this.q)[0], mx - 20, my - 46, grade(this.q)[1]);
  }

  paint(S, t, st) {
    fire(S, t, 0.3);
    bellows(S, 0);
    st.fire = 0.3;
    st.iron = quenchPiece(S, this.heat, this.dip);
    water(S, t, this.plunged ? Math.max(0, 1 - this.after * 0.7) : 0, this.plunged ? Math.max(0, 0.8 - this.after) : 0);
  }

  paintUI(u) {
    text(u, 'QUENCH IT AT', 24, 30, '#e8d0a0');
    rect(u, 24, 42, 24, 16, '#000000');
    rect(u, 25, 43, 22, 14, hx(heatColour(this.target[0])));
    text(u, this.target[1], 56, 46, hx(mixC(heatColour(this.target[0]), rgb('#ffffff'), 0.3)));
    text(u, 'IT\'S NOW', 24, 66, '#e8d0a0');
    rect(u, 24, 78, 24, 16, '#000000');
    rect(u, 25, 79, 22, 14, hx(heatColour(this.heat)));
    for (let i = 0; i < 160; i++) rect(u, 24 + i, 102, 1, 6, hx(heatColour(1 - i / 160)));
    rect(u, 24 + Math.round((1 - this.target[0]) * 160), 98, 1, 14, '#a8f0a0');
    rect(u, 24 + Math.round((1 - this.heat) * 160), 100, 2, 10, '#ffffff');
  }
}

// The shaping: the chisel slides along the blank; strike with the mallet as
// it passes over each chalk mark. (Room units along the blank.)
class Shape extends Stage {
  constructor(win) {
    super(win);
    this.rules = ['THE CHISEL SLIDES ALONG THE BLANK', 'STRIKE (SPACE OR CLICK) AS IT PASSES OVER A MARK', 'MISS AND YOU GOUGE IT'];
    this.hint = 'STRIKE: SPACE OR CLICK  ·  ESC: LEAVE';
    const B = BENCH.blank;
    this.x0 = B.x0 + 3;
    this.x1 = B.x1 - 3;
    const n = 6;
    this.marks = [];
    for (let i = 0; i < n; i++) this.marks.push({ u: (i + 0.25 + this.r.float(0, 0.5)) / n, hit: null });
    this.cuts = [];
    this.gouges = [];
    this.pos = 0;
    this.limit = 14;
    this.swing = 1;
  }

  // Where the chisel is along the blank (0..1), and in the room.
  cu() {
    const sp0 = 0.32 + this.t * 0.018;
    const k = (this.pos * sp0) % 2;
    return k < 1 ? k : 2 - k;
  }

  cx() {
    const B = BENCH.blank;
    return B.x0 + this.cu() * (B.x1 - B.x0);
  }

  update(dt) {
    const w = this.win;
    this.t += dt;
    this.pos += dt;
    this.swing = Math.min(1, this.swing + dt * 5);
    if (w.tapped()) {
      const B = BENCH.blank;
      const L = B.x1 - B.x0;
      const u = this.cu();
      const open = this.marks.filter((m) => m.hit === null);
      const m = open.sort((a, b) => Math.abs(a.u - u) - Math.abs(b.u - u))[0];
      this.swing = 0;
      w.sfx('chop');
      const d = m ? Math.abs(m.u - u) * L : 99;
      const [px, py] = sp(BENCH.cam, B.x0 + u * L, B.y0, B.d0);
      if (d > 5 * w.ease) {
        this.gouges.push(u);
        w.pops.add('GOUGED', px, py - 16, '#f09070');
        w.sparks.burst(px, py, 5, ['#8a5a30', '#c89a60'], 30, 0.5, 120);
      } else {
        m.hit = d <= 1 * w.ease ? 1 : d <= 2.5 * w.ease ? 0.72 : 0.42;
        this.cuts.push(m.u);
        w.pops.add(m.hit >= 1 ? 'CLEAN!' : m.hit >= 0.7 ? 'GOOD' : 'ROUGH', px, py - 16, grade(m.hit)[1]);
        w.sparks.burst(px, py, 14, ['#e8c890', '#d8b070', '#b88a50', '#fff0d0'], 46, 0.8, 140);
      }
    }
    if (this.marks.every((m) => m.hit !== null) || this.t >= this.limit) {
      this.finish(this.marks.reduce((a, m) => a + (m.hit || 0), 0) / this.marks.length - this.gouges.length * 0.07);
    }
  }

  partial() {
    return this.marks.reduce((a, m) => a + (m.hit || 0), 0) / this.marks.length;
  }

  paint(S, t) {
    motes(S, t);
    blank(S, this.marks.filter((m) => m.hit === null).map((m) => m.u), this.cuts, this.gouges);
    chisel(S, this.cx(), this.swing < 0.15 ? 1 : 1 - (this.swing - 0.15) / 0.85);
  }

  paintUI(u) {
    text(u, `MARKS LEFT: ${this.marks.filter((m) => m.hit === null).length}`, 24, 30, '#e8d0a0');
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
    if (got) this.turn(got !== want ? 0.2 : this.pt <= 0.65 * w.ease ? 1 : 0.7);
    else if (this.pt > this.limitEach) this.turn(0);
  }

  turn(q) {
    const w = this.win;
    this.turns.push(q);
    w.sfx(q >= 0.7 ? 'select' : 'error');
    const [px, py] = sp(BENCH.cam, -16 + this.i * 2.6, BENCH.bench.y - 3, 55);
    w.pops.add(q >= 1 ? 'TIGHT' : q >= 0.7 ? 'GOOD' : q > 0 ? 'LOOSE' : 'SLIPPED', px, py - 12, grade(q)[1], 1, 0.7);
    this.i++;
    this.pt = 0;
  }

  partial() {
    return this.turns.reduce((a, b) => a + b, 0) / this.n;
  }

  paint(S, t) {
    motes(S, t);
    binding(S, this.cfg.out, this.turns, this.n, t);
  }

  paintUI(u) {
    text(u, `TURN ${Math.min(this.n, this.i + 1)} OF ${this.n}`, 24, 30, '#e8d0a0');
    if (this.i >= this.n) return;
    const [, glyph] = this.seq[this.i];
    panel(u, 226, 40, 160, 54);
    text(u, glyph, 256, 52, Math.floor(this.t * 6) % 2 ? '#ffffff' : '#ffe070', { scale: 5, align: 'center' });
    this.seq.slice(this.i + 1, this.i + 5).forEach(([, gl], k) => text(u, gl, 302 + k * 18, 62, '#a89878', { scale: 2 }));
    meter(u, 226, 100, 60, 6, 1 - this.pt / this.limitEach, '#d8b070');
  }
}

// The tillering: the stave bent on the post, notch by notch; let go at the
// notch, not past it (past it and it cracks).
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
    const [gx, gy] = sp(BOWYER.cam, ...BOWYER.grip);
    if (w.holding()) {
      if (!this.drawing) w.sfx('draw');
      this.drawing = true;
      this.v = Math.min(0.55, this.v + dt * 0.5);
      this.bend += this.v * dt;
      if (this.bend > tgt + 0.15) {
        this.pulls.push(0.05);
        const side = this.r.int(0, 1) ? -1 : 1;
        this.cracks.push(side);
        w.sfx('crumble');
        w.sparks.burst(gx + side * 30, gy + 8, 12, ['#c89a60', '#8a5a30'], 40, 0.7, 120);
        w.pops.add('CRACKED!', gx, gy - 14, '#f09070');
        this.release();
      }
    } else if (this.drawing) {
      const q = clamp(1 - Math.max(0, Math.abs(this.bend - tgt) - this.tol) / 0.16);
      this.pulls.push(q);
      w.pops.add(grade(q)[0], gx, gy - 14, grade(q)[1]);
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

  paint(S, t) {
    lamp(S, t);
    const tgt = this.targets[Math.min(this.i, this.targets.length - 1)];
    bowOnPost(S, this.bend + Math.sin(t * 22) * 0.012 * this.wob, this.cracks, false, 0, t, this.i < this.targets.length ? tgt : -1);
  }

  paintUI(u) {
    text(u, `PULL ${Math.min(this.targets.length, this.i + 1)} OF ${this.targets.length}`, 24, 30, '#e8d0a0');
    const x = 470;
    const y0 = 40;
    const h = 180;
    gauge(u, x, y0, h);
    rect(u, x, y0, 14, h, '#2a2430');
    const tgt = this.targets[Math.min(this.i, this.targets.length - 1)];
    const ty0 = y0 + Math.round((tgt - this.tol) * h);
    const ty1 = y0 + Math.round((tgt + this.tol) * h);
    rect(u, x, ty0, 14, Math.max(2, ty1 - ty0), '#4a9a40');
    const cy = y0 + Math.round((tgt + 0.15) * h);
    if (cy < y0 + h) rect(u, x, cy, 14, y0 + h - cy, '#7a2a20');
    const by = y0 + Math.round(clamp(this.bend) * h);
    rect(u, x, y0, 14, by - y0, 'rgba(232,208,160,0.5)');
    pointer(u, x - 12, by);
    text(u, 'BEND', x + 7, y0 - 14, '#e8d0a0', { align: 'center' });
  }
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
      const [gx, gy] = sp(BOWYER.cam, ...BOWYER.grip);
      w.pops.add(q >= 1 ? 'TRUE!' : q >= 0.7 ? 'NEAR' : q >= 0.4 ? 'SHARP' : 'SOUR', gx, gy - 14, grade(q)[1]);
      this.i++;
    }
  }

  partial() {
    return this.plucks.reduce((a, b) => a + b, 0) / this.n;
  }

  paint(S, t) {
    lamp(S, t);
    bowOnPost(S, 0.35, [], true, this.vib, t);
  }

  paintUI(u) {
    text(u, `PLUCK ${Math.min(this.n, this.i + 1)} OF ${this.n}`, 24, 30, '#e8d0a0');
    // The dial: a brass arc, its true point in the middle, the needle.
    const cx = 256;
    const cy = 258;
    const R = 60;
    disc(u, cx, cy, R + 8, 'rgba(12,10,18,0.85)');
    for (let a = -64; a <= 64; a++) {
      const an = ((a - 90) * Math.PI) / 180;
      rect(u, cx + Math.cos(an) * (R + 4), cy + Math.sin(an) * (R + 4), 2, 2, '#8a6a30');
    }
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

// The cutting: the hide drawn along under the knife; keep the knife on the
// chalk. (The knife's depth on the table, in room units.)
class Cut extends Stage {
  constructor(win) {
    super(win);
    this.rules = ['THE HIDE IS DRAWN ALONG UNDER YOUR KNIFE', 'KEEP THE KNIFE ON THE CHALK LINE:', 'THE POINTER, OR UP AND DOWN (W AND S)'];
    this.hint = 'STEER: POINTER OR UP/DOWN  ·  ESC: LEAVE';
    this.kx = -24;
    this.seed = this.r.float(0, 50);
    this.scroll = 0;
    this.kd = this.chalk(this.kx);
    this.dur = 7;
    this.sum = 0;
    this.tot = 0;
    this.slit = [];
  }

  // The chalk line's depth on the table at `w` along the hide.
  chalk(w) {
    const s = this.seed || 0;
    return 72 + Math.sin(w * 0.06 + s) * 10 + Math.sin(w * 0.15 + s * 2) * 3;
  }

  update(dt) {
    const w = this.win;
    this.t += dt;
    this.scroll += dt * 16;
    const m = w.mouse();
    if (w.held('ArrowUp', 'KeyW')) this.kd += dt * 26;
    if (w.held('ArrowDown', 'KeyS')) this.kd -= dt * 26;
    // (The pointer: where on the table it's over.)
    if (this.lastM !== undefined && Math.abs(m.sy - this.lastM) > 0.2) {
      const c = TABLE.cam;
      const ay = (m.sy + 0.5 - c.vy) / c.D;
      if (ay > 0) this.kd = (TABLE.top.y - 0.3) / ay;
    }
    this.lastM = m.sy;
    this.kd = clamp(this.kd, 50, 96);
    const e = Math.abs(this.kd - this.chalk(this.kx + this.scroll));
    const q = clamp(1 - Math.max(0, e - 2 * w.ease) / (9 * w.ease));
    this.sum += q * dt;
    this.tot += dt;
    this.slit.push([this.kx + this.scroll, this.kd, q]);
    if (this.slit.length > 500) this.slit.shift();
    if (q < 0.3 && Math.random() < dt * 4) {
      const [px, py] = sp(TABLE.cam, this.kx, TABLE.top.y, this.kd);
      w.pops.add('OFF THE LINE', px, py - 12, '#f09070', 1, 0.6);
    }
    if (this.t >= this.dur) this.finish(this.sum / Math.max(0.01, this.tot));
  }

  partial() {
    return this.tot ? (this.sum / this.tot) * (this.t / this.dur) : 0;
  }

  paint(S, t) {
    lantern(S, t);
    hide(S, this.scroll, (w) => this.chalk(w), this.slit, this.kx, this.kd);
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
      this.sew(got !== want ? 0.25 : e <= this.win2 ? 1 : e <= this.win2 * 2.2 ? 0.72 : 0.38);
    } else if (off > this.beat * 0.45) this.sew(0);
  }

  sew(q) {
    const w = this.win;
    this.st.push(q);
    w.sfx(q >= 0.7 ? 'select' : 'error');
    const [px, py] = sp(TABLE.cam, -60 + this.i * 12, TABLE.top.y, 62);
    w.pops.add(q >= 1 ? 'TRUE' : q >= 0.7 ? 'GOOD' : q > 0 ? 'WONKY' : 'MISSED', px, py - 16, grade(q)[1], 1, 0.7);
    this.i++;
  }

  partial() {
    return this.st.reduce((a, b) => a + b, 0) / this.n;
  }

  paint(S, t) {
    lantern(S, t);
    const ph = ((this.t - this.lead) / this.beat) % 1;
    seam(S, this.n, this.st, this.i, Math.abs(Math.sin(Math.max(0, ph) * Math.PI)));
  }

  paintUI(u) {
    text(u, `STITCH ${Math.min(this.n, this.i + 1)} OF ${this.n}`, 24, 30, '#e8d0a0');
    if (this.i >= this.n) return;
    const ly = 40;
    const lx = 120;
    panel(u, 100, ly - 8, 320, 34);
    rect(u, 110, ly + 8, 300, 2, '#5a4a30');
    rect(u, lx, ly - 2, 2, 22, '#a8f0a0');
    for (let k = this.i; k < Math.min(this.n, this.i + 6); k++) {
      const x = lx + (this.due(k) - this.t) * 90;
      if (x > 410) continue;
      text(u, k % 2 ? '→' : '←', x - 6, ly + 2, k === this.i ? '#ffe070' : '#c8b890', { scale: 2 });
    }
  }
}

// The pour: the crucible tipped over the cast's mould; fill it to the line.
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
    const [ax, ay] = sp(SMITHY.cam, 9, SMITHY.anvil.face - 5, 72);
    if (rate > 0 && Math.random() < dt * 20) w.sparks.burst(ax, ay, 1, ['#fff0a0', '#ffa030'], 25, 0.5, 120);
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

  paint(S, t, st) {
    fire(S, t, 0.4);
    bellows(S, 0);
    water(S, t);
    st.fire = 0.4;
    st.iron = crucible(S, this.tilt, this.fill, t);
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
    this.shop = shopOf(cfg.kind);
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
      if (Math.random() < dt * 3) this.sparks.burst(FIRE_AT[0] + (Math.random() - 0.5) * 20, FIRE_AT[1] + 2, 1, ['#ffb040', '#ff6020'], 18, 1.6, -22);
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
    const g = this.scene.getContext('2d');
    const u = this.over.getContext('2d');
    g.imageSmoothingEnabled = false;
    u.imageSmoothingEnabled = false;
    u.clearRect(0, 0, UW, UH);
    try {
      // The shop built once (its shadows cast), then each moment the moving
      // things laid into it and the whole lit.
      this.shopArt ||= new Shop(this.shop, (this.forge.token || 1) % 7);
      const S = this.shopArt;
      S.begin();
      const st = { fire: 0.4 };
      const working = this.play && (this.phase === 'play' || this.phase === 'between' || this.phase === 'intro');
      if (working) this.play.paint(S, this.t, st);
      else this.paintIdle(S, this.t, st);
      S.render(g, this.t, st);
      if (working && this.play.over) this.play.over(g, this.t);
      this.puffs.draw(g);
      this.sparks.draw(g);
      // (The boards over it read better on a darkened scene.)
      if (!working) {
        g.fillStyle = 'rgba(8,6,10,0.42)';
        g.fillRect(0, 0, FW, FH);
      }
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
  paintIdle(S, t, st) {
    if (this.shop === 'forge') {
      fire(S, t, 0.4);
      bellows(S, 0);
      water(S, t);
      st.fire = 0.4;
    } else if (this.shop === 'carve') motes(S, t);
    else if (this.shop === 'bow') {
      lamp(S, t);
      bowOnPost(S, 0, [], false, 0, t);
    } else lantern(S, t);
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
