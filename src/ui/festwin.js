// (Round 129) A festival's games, played over the whole screen (see
// game/festplay.js for the contests themselves): the archery on the green,
// down the range at the butts with the wind tugging at the pennant; the
// eating match at the ale tables against two of the townsfolk; the riddling
// by lantern-light; the dance round the maypole (or the bonfire, or the
// lantern tree: each people's own) to a tune of their own; and the
// cook-off's judging, the three judges holding up their cards.
//
// Painted as the openings are (see ui/festpaint.js): a scene of 256 by 144
// pixels shown twice the size, its lasting parts painted once, what moves
// drawn a whole pixel at a time; the words and the boards over it in the
// view's own pixels, in the game's own letters.
//
// In someone else's world the game is played on the player's own screen (a
// mirror of the window the host opened for them: see net/uiwire.js), with
// their own keys, smoothly; how they did is sent back to the host (a
// 'FestAct' key), which checks it and sends back the standings.
import { Window } from './window.js';
import { C } from './ascii.js';
import { COLS, ROWS } from '../config.js';
import { itemIcon } from '../render/sprites.js';
import { drawPerson } from '../render/scenekit.js';
import { Rack, midiHz } from '../game/synth.js';
import { Bmp, rgb, hex, ramp, mixC, hash2, hills as paintHills, pine, broadTree, mountains, bush } from '../render/brush.js';
import {
  SW, SH, UW, UH, makeBuf, mixH, rand, festColours, landOf, paintSky, cloudShapes, drawClouds,
  rect, dot, line, disc, bunting, post, lantern, lanternString, folk, crowd, sprite, text, wrap, panel, parchment, meter, Sparks, Pops,
} from './festpaint.js';

// Someone to show when we don't know what they look like.
const DEFAULT_LOOK = { skin: '#e0b090', hair: '#5a3a1a', hairStyle: 'short', shirt: '#7a5a3a', pants: '#3a3a4a', shoes: '#2a1a10', outfit: 'plain', accent: '#c8a030', hat: null };

// How dark it is on someone (for their sprite at dusk, at night).
const dusk = (light) => Math.max(0, 0.55 - light * 0.62);
const tintOf = (light) => (dusk(light) > 0.02 ? `rgba(10,12,40,${dusk(light).toFixed(3)})` : null);

// Darken what's painted below `y0` of a bitmap (the land at dusk).
function darken(b, y0, light) {
  const k = dusk(light);
  if (k <= 0) return;
  const n = [10, 12, 40];
  for (let y = y0; y < b.h; y++) {
    for (let x = 0; x < b.w; x++) {
      const o = (y * b.w + x) * 4;
      if (!b.d[o + 3]) continue;
      for (let i = 0; i < 3; i++) b.d[o + i] = b.d[o + i] + (n[i] - b.d[o + i]) * k;
    }
  }
}

// Rain over the scene: streaks a few pixels long.
function rain(g, t, level = 1) {
  const r = rand(77);
  g.fillStyle = 'rgba(190,210,235,0.45)';
  for (let i = 0; i < 90 * level; i++) {
    const x = Math.floor((r() * SW + t * 30) % SW);
    const y = Math.floor((r() * SH + t * (160 + r() * 60)) % SH);
    g.fillRect(x, y, 1, 3);
  }
}

// ------------------------------------------------------------ the band
// The window's own instruments (the dance's tune, the twang of the bow).
class Band {
  constructor(ui) {
    this.music = ui.music || null;
    this.rack = null;
  }

  ready() {
    const m = this.music;
    if (!m || !m.ctx || m.ctx.state !== 'running' || !m.setup || !m.setup()) return false;
    if (!this.rack) {
      const out = (m.audio && m.audio.master) || m.ctx.destination;
      this.rack = new Rack(m, out, { space: 'hall', wet: 0.22, echo: 0.06 });
      this.ch = {
        lead: this.rack.chan('fest_lead', { vol: 1.5, verb: 0.3 }),
        harm: this.rack.chan('fest_harm', { vol: 0.9, verb: 0.35, pan: -0.3 }),
        bass: this.rack.chan('fest_bass', { vol: 1.3, verb: 0.12 }),
        drum: this.rack.chan('fest_drum', { vol: 1.4, verb: 0.18 }),
        fx: this.rack.chan('fest_fx', { vol: 1.2, verb: 0.2 }),
      };
    }
    return true;
  }

  now() {
    const m = this.music;
    return m && m.ctx && m.ctx.state === 'running' ? m.ctx.currentTime : performance.now() / 1000;
  }

  note(patch, ch, midi, t, dur, vel = 1) {
    if (!this.ready()) return;
    try {
      this.rack.play(patch, this.ch[ch], Array.isArray(midi) ? midi.map(midiHz) : midiHz(midi), t, dur, vel);
    } catch {
      // (A note that won't play: not heard.)
    }
  }

  hit(drum, t, vel = 1) {
    if (!this.ready()) return;
    try {
      this.rack.hit(drum, this.ch.drum, t, vel);
    } catch {
      // (Not heard.)
    }
  }

  dispose() {
    if (this.rack) this.rack.dispose();
    this.rack = null;
  }
}

// ------------------------------------------------------------ the window
export class FestWindow extends Window {
  // `cfg`: what's to be played (see festplay.windowCfg). `mirror`: played
  // here for the host (see net/uiwire.js).
  constructor(ui, cfg, { mirror = false } = {}) {
    super(ui, COLS, ROWS, { kind: 'fest', x: 0, y: 0 });
    this.fest = cfg;
    this.mirror = mirror;
    // (The host's copy of a window someone plays on their own screen: it
    // only waits to hear how they did.)
    this.passive = !!ui.remoteSeat && !mirror;
    this.t = 0;
    this.sent = false;
    this.sparks = new Sparks();
    this.pops = new Pops();
    if (this.passive) return;
    this.band = new Band(ui);
    this.colours = festColours(cfg.style);
    const G = GAMES[cfg.kind];
    this.play = G ? new G(this, cfg) : null;
    this.phase = cfg.kind === 'cookoff' ? 'play' : 'intro';
    this.countT = 0;
    if (ui.music && ui.music.hush) ui.music.hush(true);
  }

  // Done: how it went, to the host (or, at home, straight to the contest).
  finish(res) {
    if (this.sent) return;
    this.sent = true;
    this.phase = 'done';
    this.doneT = 0;
    this.res = res;
    const msg = { k: this.fest.kind, token: this.fest.token, ...res };
    if (this.mirror) (this.ui.forward ||= []).push({ code: 'FestAct', key: JSON.stringify(msg) });
    else {
      const game = this.ui.game;
      const reply = game && game.festResult ? game.festResult(this.fest, msg) : null;
      if (reply) this.fest.reply = reply;
    }
  }

  again() {
    if (this.mirror) {
      (this.ui.forward ||= []).push({ code: 'FestAct', key: JSON.stringify({ k: this.fest.kind, again: 1 }) });
      (this.ui.putDown ||= new Set()).add(this.mirrorOf);
      Window.prototype.close.call(this);
      this.cleanup();
      return;
    }
    const game = this.ui.game;
    this.close();
    if (game && game.festAgain) game.festAgain(this.fest);
  }

  close() {
    if (this.mirror && this.state !== 'closing') {
      (this.ui.forward ||= []).push({ code: 'Escape', key: 'Escape' });
      (this.ui.putDown ||= new Set()).add(this.mirrorOf);
    }
    this.cleanup();
    super.close();
  }

  cleanup() {
    if (this.cleaned) return;
    this.cleaned = true;
    if (this.band) this.band.dispose();
    if (this.play && this.play.stop) this.play.stop();
    if (!this.passive && this.ui.music && this.ui.music.hush) this.ui.music.hush(false);
  }

  contains() {
    return true;
  }

  draw() {}

  // Where the pointer is, in the view's pixels (`sx, sy`: the scene's).
  mouse() {
    const m = this.ui.mouse || { x: 0, y: 0 };
    return { x: m.x, y: m.y, sx: m.x / 2, sy: m.y / 2, down: !!m.down };
  }

  held(...codes) {
    const inp = this.ui.input;
    return !!inp && codes.some((c) => inp.isDown(c));
  }

  sfx(name) {
    this.ui.audio?.play(name);
  }

  update(dt) {
    if (this.passive) return;
    this.t += dt;
    this.sparks.update(dt);
    this.pops.update(dt);
    if (this.phase === 'count') {
      this.countT += dt;
      const n = 3 - Math.floor(this.countT / 0.7);
      if (n !== this.lastCount && n > 0) {
        this.lastCount = n;
        this.sfx('select');
      }
      if (this.countT >= 2.1) {
        this.phase = 'play';
        this.sfx('fanfare');
        this.play?.begin?.();
      }
    }
    if (this.phase === 'play' && this.play) this.play.update(dt);
    if (this.phase === 'done') this.doneT += dt;
  }

  onKey(k) {
    if (this.passive) {
      // How they did, from their own screen.
      if (k.code === 'FestAct') {
        let m = null;
        try {
          m = JSON.parse(k.key);
        } catch {
          return true;
        }
        const game = this.ui.game;
        if (m && m.again) {
          super.close();
          if (game && game.festAgain) game.festAgain(this.fest);
        } else if (m && game && game.festResult) {
          const reply = game.festResult(this.fest, m);
          if (reply) this.fest.reply = { ...reply };
          this.sent = true;
        }
        return true;
      }
      if (k.code === 'Escape') super.close();
      return true;
    }
    if (k.code === 'Escape') {
      // (Walking away mid-go: it's had, as far as it went.)
      if (this.phase === 'play' && !this.sent && this.play && this.play.partial) {
        const p = this.play.partial();
        if (p) this.finish(p);
      }
      this.close();
      return true;
    }
    if (this.phase === 'intro') {
      if (k.code === 'Space' || k.code === 'Enter' || k.code === 'KeyE') this.start();
      return true;
    }
    if (this.phase === 'done') {
      if ((k.code === 'Enter' || k.code === 'Space') && this.doneT > 0.6) {
        if (this.more()) this.again();
        else this.close();
      }
      return true;
    }
    if (this.phase === 'play' && this.play && this.play.onKey) this.play.onKey(k);
    return true;
  }

  more() {
    return (this.fest.tries || 0) > 1 && this.fest.kind !== 'cookoff';
  }

  start() {
    this.phase = 'count';
    this.countT = 0;
    this.lastCount = null;
    this.play?.ready?.();
  }

  onClick(ck) {
    if (this.passive) return true;
    if (ck && ck.button === 2) {
      this.onKey({ code: 'Escape', key: 'Escape' });
      return true;
    }
    const m = this.mouse();
    if (this.phase === 'intro') this.start();
    else if (this.phase === 'done' && this.doneT > 0.6) {
      if (this.againBtn && inRect(m, this.againBtn)) this.again();
      else if (this.leaveBtn && inRect(m, this.leaveBtn)) this.close();
    } else if (this.phase === 'play' && this.play && this.play.onClick) this.play.onClick(m, ck);
    return true;
  }

  // ------------------------------------------------------------ drawing
  // The scene (its pixels doubled), then the words over it.
  drawPixels(ctx) {
    if (this.passive || typeof document === 'undefined') return;
    this.scene ||= makeBuf(SW, SH);
    this.over ||= makeBuf(UW, UH);
    if (!this.scene || !this.over) return;
    const g = this.scene.getContext('2d');
    const u = this.over.getContext('2d');
    g.imageSmoothingEnabled = false;
    u.imageSmoothingEnabled = false;
    g.fillStyle = '#100c08';
    g.fillRect(0, 0, SW, SH);
    u.clearRect(0, 0, UW, UH);
    try {
      this.play?.paint(g, this.t);
      this.sparks.draw(g);
      this.play?.paintUI?.(u, this.t);
    } catch (e) {
      void e;
    }
    this.pops.draw(u);
    if (this.phase === 'intro') this.paintIntro(u);
    else if (this.phase === 'count') this.paintCount(u);
    else if (this.phase === 'done') this.paintDone(u);
    this.paintHint(u);
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.scene, 0, 0, UW, UH);
    ctx.drawImage(this.over, 0, 0);
    ctx.restore();
  }

  // The title card: what it is, how it's played.
  paintIntro(u) {
    const P = this.play;
    const f = this.fest;
    const rules = (P && P.rules) || [];
    const pw = 340;
    const ph = 96 + rules.length * 12;
    const x = (UW - pw) / 2;
    const y = Math.round((UH - ph) / 2) - 8;
    panel(u, x, y, pw, ph);
    text(u, f.title, UW / 2, y + 10, '#ffe070', { scale: 2, align: 'center' });
    text(u, `at the festival in ${f.town}`, UW / 2, y + 30, '#c8b890', { align: 'center' });
    rules.forEach((l, i) => text(u, l, UW / 2, y + 48 + i * 12, i === rules.length - 1 ? '#a8e0a0' : '#f0e0c0', { align: 'center' }));
    if (f.board && f.board.length) text(u, `TO BEAT: ${String(f.board[0].name).toUpperCase()}  ${f.board[0].score}`, UW / 2, y + ph - 30, '#ffd070', { align: 'center' });
    if (Math.floor(this.t * 2.5) % 3) text(u, 'SPACE OR CLICK TO BEGIN', UW / 2, y + ph - 16, '#ffe8a0', { align: 'center' });
  }

  paintCount(u) {
    const n = 3 - Math.floor(this.countT / 0.7);
    text(u, n > 0 ? String(n) : 'GO!', UW / 2, UH / 2 - 40, '#ffe070', { scale: 5, align: 'center' });
  }

  // How it went: your score, your place, the board as it stands.
  paintDone(u) {
    const f = this.fest;
    const r = f.reply || null;
    const pw = 300;
    const ph = 170;
    const x = (UW - pw) / 2;
    const y = (UH - ph) / 2 - 8;
    panel(u, x, y, pw, ph);
    if (f.kind === 'cookoff') text(u, 'THE JUDGES HAVE SPOKEN', UW / 2, y + 10, '#ffe070', { scale: 2, align: 'center' });
    else {
      text(u, this.play && this.play.headline ? this.play.headline() : 'WELL DONE', UW / 2, y + 10, '#ffe070', { scale: 2, align: 'center' });
      text(u, this.play && this.play.scoreLine ? this.play.scoreLine() : '', UW / 2, y + 30, '#f0e0c0', { align: 'center' });
    }
    const board = (r && r.board) || (this.play && this.play.finalBoard && this.play.finalBoard()) || null;
    if (board) {
      text(u, r && r.place ? `YOU'RE ${ordinal(r.place).toUpperCase()} SO FAR` : 'THE BOARD', UW / 2, y + 48, r && r.place === 1 ? '#ffe070' : '#c8b890', { align: 'center' });
      board.slice(0, 5).forEach((q, i) => {
        const yy = y + 64 + i * 13;
        const col = q.you ? '#ffe070' : i === 0 ? '#f0d090' : '#d8c8a8';
        if (i < 3) rosette(u, x + 22, yy + 3, i + 1);
        text(u, `${i + 1}. ${String(q.name).slice(0, 26)}`, x + 32, yy, col);
        text(u, String(q.score), x + pw - 14, yy, col, { align: 'right' });
      });
    } else text(u, this.mirror ? 'WAITING ON THE JUDGES...' : 'TALLYING...', UW / 2, y + 80, '#a89878', { align: 'center' });
    const more = this.more();
    this.againBtn = more ? { x: UW / 2 - 124, y: y + ph - 26, w: 116, h: 16 } : null;
    this.leaveBtn = { x: more ? UW / 2 + 8 : UW / 2 - 58, y: y + ph - 26, w: 116, h: 16 };
    const m = this.mouse();
    for (const [b, label] of [[this.againBtn, `GO AGAIN (${(f.tries || 1) - 1} LEFT)`], [this.leaveBtn, 'LEAVE']]) {
      if (!b) continue;
      const hov = inRect(m, b);
      rect(u, b.x, b.y, b.w, b.h, hov ? C.bgHi : 'rgba(40,30,20,0.95)');
      rect(u, b.x, b.y, b.w, 1, '#c8a060');
      rect(u, b.x, b.y + b.h - 1, b.w, 1, '#5a4a30');
      text(u, label, b.x + b.w / 2, b.y + 4, hov ? '#fff0c0' : '#e8d0a0', { align: 'center' });
    }
  }

  // The line of what to press, along the foot (as an opening's captions).
  paintHint(u) {
    const P = this.play;
    const hint = this.phase === 'play' && P && P.hint ? P.hint : this.phase === 'done' ? (this.more() ? 'ENTER: GO AGAIN  ·  ESC: LEAVE' : 'ENTER OR ESC: LEAVE') : 'ESC: LEAVE';
    rect(u, 0, UH - 14, UW, 14, 'rgba(0,0,0,0.85)');
    text(u, hint, UW / 2, UH - 11, '#c8b890', { align: 'center' });
  }
}

const inRect = (m, b) => m.x >= b.x && m.y >= b.y && m.x < b.x + b.w && m.y < b.y + b.h;
const ordinal = (n) => `${n}${n % 10 === 1 && n % 100 !== 11 ? 'st' : n % 10 === 2 && n % 100 !== 12 ? 'nd' : n % 10 === 3 && n % 100 !== 13 ? 'rd' : 'th'}`;

// A rosette (gold, silver, bronze), in pixels.
function rosette(g, x, y, place) {
  const [rim, mid, hi] = place === 1 ? ['#a87808', '#f0c030', '#fff0a0'] : place === 2 ? ['#70788a', '#c8d0dc', '#ffffff'] : ['#7a4018', '#c07838', '#f0b080'];
  rect(g, x - 2, y + 2, 2, 5, '#3060c0');
  rect(g, x + 1, y + 2, 2, 5, '#3060c0');
  disc(g, x, y, 3, rim);
  disc(g, x, y, 2, mid);
  dot(g, x - 1, y - 1, hi);
}

// ------------------------------------------------------------ the archery
// Down the range at the butt: aim with the pointer, hold to draw, let go
// to loose; hold SHIFT to hold your breath and steady the bow. The wind's
// on the pennant; the arrow falls short at less than a full draw. Six
// arrows: two at twenty paces, two at thirty, two at forty.
const DISTS = [20, 20, 30, 30, 40, 40];
const FOCAL = 373;
const CAM_H = 1.6;
const PACE = 0.8;
const HZ = 62;
const RINGS = ['#f2f0ea', '#f2f0ea', '#262626', '#262626', '#2a6ad0', '#2a6ad0', '#d8302a', '#d8302a', '#f0c020', '#f0c020'];
class Archery {
  constructor(win, cfg) {
    this.win = win;
    this.cfg = cfg;
    this.n = 0;
    this.scores = [];
    this.stuck = [];
    this.draw = 0;
    this.breath = 1;
    this.fullT = 0;
    this.flight = null;
    this.move = null;
    this.wobble = 0;
    this.excite = 0;
    this.aim = { x: SW / 2, y: 70 };
    this.windBase = (cfg.wind && cfg.wind.x) || 0;
    this.gust = (cfg.wind && cfg.wind.gust) || 0.3;
    this.D = DISTS[0] * PACE;
    this.folkL = folk(cfg.seed + 1, 40, win.colours);
    this.folkR = folk(cfg.seed + 2, 40, win.colours);
    this.clouds = cloudShapes(cfg.seed, cfg.wet ? 7 : 4, cfg.wet);
    this.rules = ['AIM WITH THE POINTER (OR THE ARROW KEYS)', 'HOLD THE BUTTON (OR SPACE) TO DRAW,', 'LET GO TO LOOSE', 'HOLD SHIFT TO HOLD YOUR BREATH', 'MIND THE WIND ON THE PENNANT', 'SIX ARROWS: 20, 30 AND 40 PACES'];
    this.hint = 'AIM: POINTER  ·  DRAW: HOLD BUTTON/SPACE  ·  STEADY: SHIFT  ·  ESC: LEAVE';
  }

  windNow() {
    const t = this.win.t;
    return this.windBase + Math.sin(t * 0.55) * this.gust * 0.35 + Math.sin(t * 1.7 + 1) * this.gust * 0.15;
  }

  // The butt's middle in the scene, its face's size, its foot, at a
  // distance.
  target(D = this.D) {
    return { x: SW / 2, y: HZ + (FOCAL * (CAM_H - 1.3)) / D, r: (FOCAL * 0.6) / D, base: HZ + (FOCAL * CAM_H) / D };
  }

  partial() {
    return { score: this.scores.reduce((a, b) => a + b, 0) };
  }

  update(dt) {
    const w = this.win;
    this.wobble = Math.max(0, this.wobble - dt * 4);
    this.excite = Math.max(0, this.excite - dt * 0.6);
    // Back to the next mark between the ends.
    if (this.move) {
      this.move.t += dt;
      const k = Math.max(0, Math.min(1, this.move.t / 1.4));
      const e = k < 0.5 ? 2 * k * k : 1 - 2 * (1 - k) * (1 - k);
      this.D = this.move.from + (this.move.to - this.move.from) * e;
      if (k >= 1) {
        this.move = null;
        this.stuck = [];
      }
      return;
    }
    if (this.flight) {
      this.flight.t += dt;
      if (this.flight.t >= this.flight.dur) this.land();
      return;
    }
    if (this.n >= DISTS.length) return;
    // The aim: the pointer, or the keys.
    const m = w.mouse();
    if (w.held('ArrowLeft', 'KeyA')) this.aim.x -= dt * 50;
    if (w.held('ArrowRight', 'KeyD')) this.aim.x += dt * 50;
    if (w.held('ArrowUp', 'KeyW')) this.aim.y -= dt * 50;
    if (w.held('ArrowDown', 'KeyS')) this.aim.y += dt * 50;
    if (this.lastM && (Math.abs(m.sx - this.lastM.sx) > 0.1 || Math.abs(m.sy - this.lastM.sy) > 0.1)) this.aim = { x: m.sx, y: m.sy };
    this.lastM = m;
    this.aim.x = Math.max(8, Math.min(SW - 8, this.aim.x));
    this.aim.y = Math.max(14, Math.min(SH - 20, this.aim.y));
    const pulling = m.down || w.held('Space');
    if (pulling) {
      if (this.draw === 0) w.sfx('draw');
      this.draw = Math.min(1, this.draw + dt * 1.25);
      if (this.draw >= 1) this.fullT += dt;
    } else if (this.draw > 0) {
      this.loose();
      return;
    }
    const hold = w.held('ShiftLeft', 'ShiftRight') && this.breath > 0 && this.draw > 0;
    this.holding = hold;
    if (hold) this.breath = Math.max(0, this.breath - dt * 0.55);
    else this.breath = Math.min(1, this.breath + dt * 0.25);
  }

  // How far the bow wanders now (scene pixels).
  sway() {
    const t = this.win.t;
    const tired = Math.max(0, this.fullT - 2.2) * 2.2;
    let a = 1.3 + tired + (this.draw > 0 ? 0 : 0.8);
    if (this.holding) a *= 0.22;
    if (this.breath <= 0) a *= 1.6;
    a = Math.min(a, 8.5);
    return { x: (Math.sin(t * 1.3) + Math.sin(t * 2.9 + 1) * 0.4) * a, y: (Math.sin(t * 1.7 + 0.6) + Math.cos(t * 3.3) * 0.35) * a * 0.8 };
  }

  loose() {
    const w = this.win;
    const s = this.sway();
    const power = this.draw;
    this.draw = 0;
    this.fullT = 0;
    const D = this.D;
    // Where it'll land: where you aimed, where the bow was, the wind, and
    // short of it if the draw wasn't full.
    const drift = this.windNow() * D * 0.31;
    const drop = (1 - power) * D * 1.25 + (power < 0.35 ? 100 : 0);
    this.flight = { t: 0, dur: 0.28 + D * 0.018, to: { x: this.aim.x + s.x + drift, y: this.aim.y + s.y + drop }, power };
    w.sfx('bow');
    if (w.band.ready()) w.band.note('pluck', 'fx', 40, w.band.now() + 0.005, 0.2, 0.6);
  }

  land() {
    const w = this.win;
    const f = this.flight;
    this.flight = null;
    const T = this.target();
    const dx = (f.to.x - T.x) / T.r;
    const dy = (f.to.y - T.y) / T.r;
    const rr = Math.hypot(dx, dy);
    const score = rr < 1 ? Math.max(1, 10 - Math.floor(rr * 10)) : 0;
    this.scores.push(score);
    this.n++;
    if (score) {
      this.stuck.push({ dx, dy });
      this.wobble = 1;
      w.sfx('thud');
      const col = score >= 9 ? '#ffe070' : score >= 7 ? '#ff7060' : score >= 5 ? '#70a0ff' : '#e0e0e0';
      w.pops.add(score === 10 ? 'BULLSEYE!' : String(score), T.x, T.y - T.r - 8, col, score >= 9 ? 3 : 2);
      w.sparks.burst(T.x + dx * T.r, T.y + dy * T.r, score >= 9 ? 22 : 8, score >= 9 ? ['#ffe070', '#ffffff', '#ffb040'] : ['#d8b860', '#a88a40'], 40, 0.6, 80);
      if (score >= 9) w.sfx('reveal_great');
      this.excite = score / 10;
    } else {
      w.pops.add(f.power < 0.35 ? 'TOO WEAK!' : 'MISS', T.x, T.y - T.r - 8, '#a0a0a0', 2);
      w.sfx('whoosh');
    }
    if (this.n >= DISTS.length) {
      setTimeout(() => w.finish({ score: this.scores.reduce((a, b) => a + b, 0) }), 1100);
      return;
    }
    if (DISTS[this.n] !== DISTS[this.n - 1]) {
      this.move = { t: -1.1, from: this.D, to: DISTS[this.n] * PACE };
      w.pops.add(`BACK TO ${DISTS[this.n]} PACES`, SW / 2, 30, '#f0e0c0', 2, 2);
    }
  }

  headline() {
    const s = this.scores.reduce((a, b) => a + b, 0);
    return s >= 50 ? 'A MASTER BOWMAN!' : s >= 38 ? 'FINE SHOOTING' : s >= 22 ? 'NOT BAD AT ALL' : 'BETTER LUCK NEXT TIME';
  }

  scoreLine() {
    return `${this.scores.reduce((a, b) => a + b, 0)} OF 60`;
  }

  // ------------------------------------------------------------ painting
  // The green, painted once: the sky, the hills and trees beyond, the
  // grass mown in stripes, the lane's chalk lines, the pegs.
  backdrop() {
    const cfg = this.cfg;
    const b = new Bmp(SW, SH);
    const S = paintSky(b, HZ, cfg.hour, cfg.wet, cfg.seed);
    this.S = S;
    const land = landOf(cfg.style);
    const air = rgb(S.low);
    mountains(b, { seed: cfg.seed % 997, base: HZ - 6, top: 28, peaks: 3, pal: ramp('#7a84a8', 5, { spread: 0.36 }), air, airK: 0.5 });
    const crest = (x) => HZ - 8 + Math.sin(x * 0.03 + cfg.seed) * 4 + Math.sin(x * 0.09) * 1.5;
    paintHills(b, crest, HZ + 2, ramp(land, 4, { spread: 0.3 }).map((c) => mixC(c, air, 0.3)), { seed: 3 });
    const fir = ramp('#3a5a3a', 5, { spread: 0.34 });
    const leaf = ramp(land, 5, { spread: 0.4 });
    const bark = [rgb('#3a2a20'), rgb('#4a3428'), rgb('#5a4030')];
    const r = rand(cfg.seed + 9);
    for (let x = -4; x < SW + 4; x += 5 + Math.floor(r() * 7)) {
      const yb = Math.round(crest(x) + 4 + r() * 3);
      if (r() < 0.5) pine(b, x, yb, 7 + r() * 6, fir.map((c) => mixC(c, air, 0.2)), bark, x * 7 + 1, { bare: false });
      else broadTree(b, x, yb, 8 + r() * 6, leaf.map((c) => mixC(c, air, 0.2)), bark, x * 3 + 5);
    }
    // The grass, mown in stripes, nearer stripes wider.
    const g1 = ramp(land, 4, { spread: 0.22 });
    for (let y = HZ; y < SH; y++) {
      const D = (FOCAL * CAM_H) / Math.max(0.5, y - HZ);
      const band = Math.floor(Math.log(D) / Math.log(1.25)) % 2;
      for (let x = 0; x < SW; x++) {
        const n = hash2(x, y, 4);
        b.set(x, y, band ? (n < 0.15 ? g1[0] : g1[1]) : n < 0.15 ? g1[1] : g1[2]);
      }
    }
    // The chalk lines down the lane, and the pegs at twenty, thirty, forty.
    for (const L of [-3, 3]) {
      for (let y = HZ + 2; y < SH; y++) {
        const D = (FOCAL * CAM_H) / (y - HZ);
        b.set(Math.round(SW / 2 + (FOCAL * L) / D), y, [236, 236, 220], 0.8);
      }
    }
    for (const p of [20, 30, 40]) {
      const D = p * PACE;
      const y = Math.round(HZ + (FOCAL * CAM_H) / D);
      for (const L of [-3.6, 3.6]) {
        const x = Math.round(SW / 2 + (FOCAL * L) / D);
        const h = Math.max(2, Math.round((FOCAL * 0.5) / D));
        for (let i = 0; i < h; i++) b.set(x, y - i, i === h - 1 ? [200, 60, 50] : [236, 230, 214]);
      }
    }
    darken(b, HZ - 30, S.light);
    return b.canvas();
  }

  paint(g, t) {
    const cfg = this.cfg;
    this.bg ||= this.backdrop();
    const S = this.S;
    g.drawImage(this.bg, 0, 0);
    drawClouds(g, this.clouds, t, S);
    // (The clouds behind the hills: the hills drawn again over them.)
    g.drawImage(this.bg, 0, HZ - 30, SW, 34, 0, HZ - 30, SW, 34);
    const T = this.target();
    this.paintButt(g, T, S.light, t);
    this.paintPennant(g, S.light, t);
    // The crowd down both sides, behind the ropes, facing in.
    crowd(g, 2, 66, 106, 3, this.folkL, t, this.excite, { face: 'front', light: S.light, gap: 6 });
    crowd(g, 192, 254, 106, 3, this.folkR, t, this.excite, { face: 'front', light: S.light, gap: 6 });
    rect(g, 0, 107, 72, 1, mixH('#c8b080', '#201810', 1 - S.light));
    rect(g, 186, 107, 70, 1, mixH('#c8b080', '#201810', 1 - S.light));
    for (const x of [4, 34, 66, 190, 222, 252]) rect(g, x, 104, 1, 6, mixH('#6a4a2a', '#100a06', 1 - S.light));
    post(g, 4, 6, 106, S.light);
    post(g, 250, 6, 106, S.light);
    bunting(g, 5, 8, 250, 8, 14, this.win.colours, t, Math.abs(this.windNow()));
    if (this.flight) this.paintFlight(g);
    this.paintBow(g);
    if (cfg.wet) rain(g, t, 0.8);
  }

  paintButt(g, T, light, t) {
    const jolt = this.wobble > 0.4 ? (Math.floor(t * 30) % 2 ? 1 : -1) : 0;
    const r = T.r;
    const k = dusk(light);
    const dk = (c) => (k > 0 ? mixH(c, '#0a0c22', k) : c);
    // Its shadow, its easel's legs.
    rect(g, T.x - r, T.base, r * 2, 1, 'rgba(0,0,0,0.25)');
    line(g, T.x - r * 0.8, T.base, T.x - r * 0.3, T.y - r * 0.6, dk('#5a3a1a'));
    line(g, T.x + r * 0.8, T.base, T.x + r * 0.3, T.y - r * 0.6, dk('#5a3a1a'));
    line(g, T.x, T.base, T.x, T.y, dk('#4a2e14'));
    // The straw boss, a pixel larger all round; the face on it.
    const cx = Math.round(T.x) + jolt;
    const cy = Math.round(T.y);
    disc(g, cx, cy + 1, Math.round(r) + 1, dk('#8a6a2a'));
    disc(g, cx, cy, Math.round(r) + 1, dk('#c8a858'));
    for (let i = 0; i < 10; i++) {
      const rr = r * (1 - i / 10);
      if (rr < 0.6) break;
      disc(g, cx, cy, Math.max(0, Math.round(rr - 0.2)), dk(RINGS[i]));
    }
    // The arrows in it: a shaft and its flight.
    for (const a of this.stuck) {
      const x = cx + Math.round(a.dx * r);
      const y = cy + Math.round(a.dy * r);
      dot(g, x, y, '#1a1008');
      dot(g, x + 1, y + 1, dk('#6a4a2a'));
      dot(g, x + 1, y + 2, dk('#e83a3a'));
    }
  }

  paintPennant(g, light, t) {
    const x = 204;
    const top = 40;
    post(g, x, top, 76, light);
    const wn = this.windNow();
    const len = Math.round(5 + Math.min(1, Math.abs(wn)) * 10);
    const dir = wn < 0 ? -1 : 1;
    const col = mixH('#e83a3a', '#200808', dusk(light));
    for (let i = 0; i < len; i++) {
      const wave = Math.sin(t * (6 + Math.abs(wn) * 6) - i * 0.8) > 0 ? 1 : 0;
      const hgt = Math.max(1, Math.round(4 * (1 - i / len)));
      rect(g, x + (dir > 0 ? 2 + i : -1 - i), top + wave + Math.floor((4 - hgt) / 2), 1, hgt, i % 4 === 3 ? mixH(col, '#ffffff', 0.3) : col);
    }
  }

  paintFlight(g) {
    const f = this.flight;
    const u = Math.min(1, f.t / f.dur);
    const from = { x: 180, y: 112 };
    const x = from.x + (f.to.x - from.x) * u;
    const y = from.y + (f.to.y - from.y) * u - Math.sin(u * Math.PI) * (6 + this.D * 0.6);
    const len = Math.max(1, Math.round(7 * (1 - u)));
    line(g, x, y, x + len * 0.4, y + len, '#3a2a1a');
    dot(g, x + len * 0.4, y + len, '#e83a3a');
  }

  // The bow, as you see it down the arrow: the bow held out, the string
  // drawn back to your cheek, the arrow pointing where you aim.
  paintBow(g) {
    const s = this.draw > 0 ? this.sway() : { x: 0, y: 0 };
    const gx = Math.round(176 + s.x * 0.3);
    const gy = Math.round(98 + s.y * 0.3);
    const pull = this.draw * 9;
    const nx = Math.round(gx + 24 + pull * 0.9);
    const ny = Math.round(gy + 38 + pull * 0.5);
    const bend = Math.round(this.draw * 3);
    const wood = ramp('#7a4a24', 3, { spread: 0.34 }).map(hex);
    // The limbs: a curve, two pixels thick, lit on the left.
    const pts = [];
    for (let i = 0; i <= 24; i++) {
      const k = i / 24;
      const bow = Math.sin(k * Math.PI) * (7 - bend) - (1 - Math.sin(k * Math.PI)) * 2;
      pts.push([gx + bow - 4 + bend, gy - 52 + k * 104]);
    }
    for (let i = 1; i < pts.length; i++) {
      line(g, pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], wood[0]);
      line(g, pts[i - 1][0] - 1, pts[i - 1][1], pts[i][0] - 1, pts[i][1], wood[2]);
    }
    // The grip, your hand round it, your sleeve.
    rect(g, gx + 1, gy - 6, 4, 12, '#2a1a0c');
    rect(g, gx + 1, gy - 2, 5, 6, '#c89068');
    rect(g, gx + 2, gy - 1, 3, 1, '#e0b090');
    // (The bow arm, out from your shoulder below.)
    for (let i = 0; i < 46; i++) {
      const ax = gx + 4 - i * 0.55;
      const ay = gy + 4 + i;
      rect(g, ax - 3, ay, 7, 1, i % 9 === 0 ? '#4a2e14' : '#5a3a1a');
      dot(g, ax - 3, ay, '#6a4a2a');
    }
    // The string.
    const [tx0, ty0] = pts[0];
    const [tx1, ty1] = pts[pts.length - 1];
    line(g, tx0, ty0, nx, ny, '#ece4cc');
    line(g, tx1, ty1, nx, ny, '#ece4cc');
    // The arrow: from the string past the rest, its head toward the mark.
    if (!this.flight && this.n < DISTS.length) {
      const sw = this.sway();
      const dx = this.aim.x + sw.x - nx;
      const dy = this.aim.y + sw.y - ny;
      const l = Math.hypot(dx, dy) || 1;
      const reach = Math.hypot(gx + 2 - nx, gy - 2 - ny) + 6;
      const hx = nx + (dx / l) * reach;
      const hy = ny + (dy / l) * reach;
      line(g, nx, ny, hx, hy, '#6a4a2a');
      line(g, nx + 1, ny, hx + 1, hy, '#8a6a3a');
      dot(g, hx, hy, '#c8d0d8');
      dot(g, hx + dx / l, hy + dy / l, '#ffffff');
      line(g, nx + (dx / l) * 3, ny + (dy / l) * 3, nx + (dx / l) * 7 - 2, ny + (dy / l) * 7, '#e83a3a');
    }
    // Your drawing hand, your sleeve off the bottom of it.
    rect(g, nx - 1, ny - 1, 4, 3, '#d8a878');
    rect(g, nx, ny - 2, 2, 1, '#f0c898');
    for (let i = 0; i < 12; i++) rect(g, nx + 1 + i, ny + 2 + Math.floor(i * 0.6), 6, 2, '#6a4424');
  }

  // The aim, the card, the close look at the butt, the wind, the meters.
  paintUI(u) {
    if (!this.flight && !this.move && this.n < DISTS.length && this.win.phase === 'play') {
      const s = this.sway();
      const x = Math.round((this.aim.x + s.x) * 2);
      const y = Math.round((this.aim.y + s.y) * 2);
      const c = this.draw >= 1 ? '#a0ff8c' : '#fff0c8';
      for (const [dx, dy] of [[-7, 0], [-6, 0], [-5, 0], [-4, 0], [4, 0], [5, 0], [6, 0], [7, 0], [0, -7], [0, -6], [0, -5], [0, -4], [0, 4], [0, 5], [0, 6], [0, 7]]) {
        dot(u, x + dx + 1, y + dy + 1, '#000000');
        dot(u, x + dx, y + dy, c);
      }
      dot(u, x, y, '#ff5040');
    }
    // The card.
    panel(u, 8, 8, 112, 66, { fill: 'rgba(30,22,14,0.92)' });
    text(u, 'SCORE CARD', 64, 13, '#ffe070', { align: 'center' });
    [20, 30, 40].forEach((p, i) => {
      const y = 26 + i * 11;
      text(u, `${p} PACES`, 14, y, '#d8c8a0');
      for (let j = 0; j < 2; j++) {
        const v = this.scores[i * 2 + j];
        text(u, v === undefined ? '-' : String(v), 90 + j * 14, y, v >= 9 ? '#ffe070' : v === 0 ? '#ff7060' : '#f0e0c0', { align: 'center' });
      }
    });
    text(u, `TOTAL ${this.scores.reduce((a, b) => a + b, 0)}`, 64, 61, '#f4ecd8', { align: 'center' });
    // The butt, close: this end's arrows.
    const cx = UW - 40;
    const cy = 40;
    panel(u, cx - 34, cy - 34, 68, 80, { fill: 'rgba(30,22,14,0.92)' });
    disc(u, cx, cy, 27, '#c8a858');
    for (let i = 0; i < 10; i++) disc(u, cx, cy, Math.round(25 * (1 - i / 10)), RINGS[i]);
    for (const a of this.stuck) {
      const x = cx + Math.round(a.dx * 25);
      const y = cy + Math.round(a.dy * 25);
      rect(u, x - 1, y - 1, 2, 2, '#000000');
      line(u, x + 1, y + 1, x + 4, y + 5, '#e83a3a');
    }
    text(u, `${Math.round(this.D / PACE)} PACES`, cx, cy + 32, '#f0e0c0', { align: 'center' });
    // The wind.
    const wn = this.windNow();
    const n = Math.round(Math.min(1, Math.abs(wn)) * 5);
    panel(u, UW - 74, 90, 68, 28, { fill: 'rgba(30,22,14,0.92)' });
    text(u, 'WIND', UW - 40, 95, '#c8b890', { align: 'center' });
    text(u, n === 0 ? 'CALM' : (wn < 0 ? '◄' : '►').repeat(n), UW - 40, 106, n >= 3 ? '#ff9060' : '#a0d8ff', { align: 'center' });
    meter(u, 12, UH - 46, 100, 7, this.draw, this.draw >= 1 ? (this.fullT > 2.2 ? '#ff7050' : '#80e070') : '#f0c040', 'DRAW');
    meter(u, 12, UH - 24, 100, 7, this.breath, this.holding ? '#80c8ff' : '#6a90b0', 'BREATH');
  }
}

// ------------------------------------------------------------ the eating
// At the long table by the tavern: A and D (or LEFT and RIGHT) in turn
// to take a bite; too fast and you choke (SPACE: a gulp of ale clears
// it). Thirty seconds; the most plates wins.
const EAT_SECS = 30;
const SEATS = [64, 128, 192];
class Eating {
  constructor(win, cfg) {
    this.win = win;
    this.cfg = cfg;
    this.left = EAT_SECS;
    this.plates = 0;
    this.bites = 0;
    this.lastKey = null;
    this.lastBite = -1;
    this.choke = 0;
    this.coughT = 0;
    this.gulpT = 0;
    this.bob = 0;
    this.running = false;
    this.rivals = (cfg.rivals || []).map((r, i) => ({ ...r, eaten: 0, next: 0.5 + i * 0.3, bob: 0 }));
    this.crumbs = new Sparks();
    this.folk = folk(cfg.seed + 5, 60, win.colours);
    this.rules = ['A AND D (OR LEFT AND RIGHT) IN TURN', 'TO TAKE A BITE. TOO FAST AND YOU CHOKE!', 'SPACE: A GULP OF ALE CLEARS YOUR THROAT', 'THIRTY SECONDS. THE MOST PLATES WINS'];
    this.hint = 'BITE: A / D IN TURN  ·  GULP: SPACE  ·  ESC: LEAVE';
  }

  begin() {
    this.running = true;
  }

  bitesFor(n) {
    return 6 + Math.min(6, n);
  }

  score() {
    return Math.round((this.plates + this.bites / this.bitesFor(this.plates)) * 10) / 10;
  }

  partial() {
    return { score: this.score() };
  }

  // Who's at the table: the one at the left, you, the one at the right.
  seats() {
    return [{ x: SEATS[0], r: this.rivals[0] }, { x: SEATS[1], you: true }, { x: SEATS[2], r: this.rivals[1] }].filter((s) => s.you || s.r);
  }

  onKey(k) {
    if (!this.running || this.left <= 0) return;
    const w = this.win;
    if (k.code === 'Space') {
      if (this.gulpT <= 0 && this.coughT <= 0) {
        this.gulpT = 0.7;
        this.choke = Math.max(0, this.choke - 0.65);
        w.sfx('gulp');
      }
      return;
    }
    const side = k.code === 'KeyA' || k.code === 'ArrowLeft' ? 'L' : k.code === 'KeyD' || k.code === 'ArrowRight' ? 'R' : null;
    if (!side || k.repeat || this.coughT > 0 || this.gulpT > 0 || side === this.lastKey) return;
    this.lastKey = side;
    const now = EAT_SECS - this.left;
    const gap = now - this.lastBite;
    this.lastBite = now;
    this.choke += gap < 0.13 ? 0.24 : gap < 0.2 ? 0.1 : 0.04;
    this.bites++;
    this.bob = 1;
    this.crumbs.burst(128 + (Math.random() - 0.5) * 6, 104, 4, ['#c89050', '#e8c080', '#8a5a2a'], 30, 0.5, 120);
    if (this.bites % 2 === 0) w.sfx('eat');
    if (this.bites >= this.bitesFor(this.plates)) {
      this.bites = 0;
      this.plates++;
      w.pops.add(`${this.plates}!`, 128, 64, '#ffe070', 3);
      w.sfx('coin');
    }
    if (this.choke >= 1) {
      this.coughT = 1.8;
      this.choke = 0.35;
      w.pops.add('COUGH! COUGH!', 128, 54, '#ff7060', 2);
      w.sfx('hurt');
    }
  }

  update(dt) {
    if (!this.running) return;
    this.crumbs.update(dt);
    this.bob = Math.max(0, this.bob - dt * 6);
    if (this.left <= 0) return;
    this.left -= dt;
    this.choke = Math.max(0, this.choke - dt * 0.32);
    if (this.coughT > 0) this.coughT -= dt;
    if (this.gulpT > 0) this.gulpT -= dt;
    // The others at the table, at their own pace.
    for (const r of this.rivals) {
      r.bob = Math.max(0, r.bob - dt * 5);
      r.next -= dt;
      if (r.next <= 0) {
        const rate = Math.max(0.05, (r.plates || 4) / EAT_SECS);
        const per = 1 / this.bitesFor(Math.floor(r.eaten));
        r.eaten = Math.min(r.plates || 4, r.eaten + per);
        r.bob = 1;
        r.next = (per / rate) * (0.7 + Math.random() * 0.6);
      }
    }
    if (this.left <= 5 && Math.floor(this.left + dt) !== Math.floor(this.left)) this.win.sfx('click');
    if (this.left <= 0) {
      this.left = 0;
      this.win.pops.add('TIME!', 128, 40, '#ffe070', 4, 1.4);
      this.win.sfx('fanfare');
      setTimeout(() => this.win.finish({ score: this.score() }), 1300);
    }
  }

  headline() {
    const s = this.score();
    return s >= 10 ? 'A BOTTOMLESS PIT!' : s >= 7 ? 'WHAT AN APPETITE' : s >= 4 ? 'A HEARTY EFFORT' : 'SMALL BITES...';
  }

  scoreLine() {
    return `${this.score().toFixed(1)} PLATES`;
  }

  // The tavern's front, painted once: timber and plaster, its windows
  // lit, the yard before it.
  backdrop() {
    const cfg = this.cfg;
    const b = new Bmp(SW, SH);
    const S = paintSky(b, 24, cfg.hour, cfg.wet, cfg.seed);
    this.S = S;
    const plaster = ramp('#c8b48c', 4, { spread: 0.24 });
    const timber = ramp('#5a3a20', 3, { spread: 0.24 });
    const glass = ramp('#f0a040', 4, { spread: 0.4 });
    for (let y = 20; y < 96; y++) for (let x = 0; x < SW; x++) {
      const n = hash2(x >> 1, y, 21);
      b.set(x, y, n < 0.08 ? plaster[1] : n > 0.95 ? plaster[3] : plaster[2]);
    }
    // The beams: posts, rails, the braces between.
    for (let x = 0; x <= SW; x += 64) for (let y = 20; y < 96; y++) for (let k = -1; k <= 1; k++) b.set(x + k, y, timber[k < 0 ? 2 : k > 0 ? 0 : 1]);
    for (const yy of [20, 21, 56, 57, 95]) for (let x = 0; x < SW; x++) b.set(x, yy, yy % 2 ? timber[0] : timber[1]);
    for (let x0 = 0; x0 < SW; x0 += 64) {
      for (let i = 0; i < 34; i++) {
        b.set(x0 + 2 + i, 22 + i, timber[1]);
        b.set(x0 + 3 + i, 22 + i, timber[0]);
      }
    }
    // The windows, lit from within, a glow round each in the dark.
    for (const wx of [22, 86, 154, 218]) {
      for (let y = 30; y < 50; y++) for (let x = wx - 9; x < wx + 9; x++) {
        const edge = x === wx - 9 || x === wx + 8 || y === 30 || y === 49 || x === wx || y === 40;
        b.set(x, y, edge ? timber[0] : glass[y < 35 ? 3 : y < 44 ? 2 : 1]);
      }
      if (S.light < 0.7) {
        for (let y = 24; y < 58; y++) for (let x = wx - 16; x < wx + 16; x++) {
          const d = Math.hypot(x - wx, (y - 40) * 1.3);
          if (d > 10 && d < 16 && hash2(x, y, 5) < (16 - d) / 12) b.set(x, y, [255, 200, 120], 0.3);
        }
      }
    }
    // Window boxes under them, flowers in the people's colours.
    const box = ramp('#6a4a2a', 3, { spread: 0.3 });
    const fl = this.win.colours.map(rgb);
    for (const wx of [22, 86, 154, 218]) {
      for (let x = wx - 10; x < wx + 10; x++) {
        b.set(x, 50, box[2]);
        b.set(x, 51, box[1]);
        b.set(x, 52, box[0]);
        if (hash2(x, 49, 3) < 0.7) b.set(x, 49, hash2(x, 48, 4) < 0.45 ? fl[Math.floor(hash2(x, 1, 5) * fl.length)] : [60, 120, 50]);
        if (hash2(x, 48, 6) < 0.35) b.set(x, 48, fl[Math.floor(hash2(x, 2, 7) * fl.length)]);
      }
    }
    // The door, its frame, under the sign; the stone footing along the wall.
    const oak = ramp('#5a3a1e', 4, { spread: 0.3 });
    for (let y = 58; y < 96; y++) for (let x = 117; x < 139; x++) {
      const frame = x < 119 || x > 136 || y < 60;
      const plank = (x - 119) % 4 === 0;
      b.set(x, y, frame ? timber[0] : plank ? oak[0] : y < 62 ? oak[3] : oak[2]);
    }
    for (const [x, y] of [[133, 78], [134, 78], [133, 79]]) b.set(x, y, [216, 176, 64]);
    const stone = ramp('#8a8478', 4, { spread: 0.3 });
    for (let y = 86; y < 96; y++) for (let x = 0; x < SW; x++) {
      if (x >= 117 && x < 139) continue;
      const row = Math.floor((y - 86) / 5);
      const seam = (y - 86) % 5 === 4 || (x + row * 6) % 12 === 0;
      b.set(x, y, seam ? stone[0] : hash2(x >> 2, y, 12) < 0.3 ? stone[1] : stone[2]);
    }
    // The yard before it.
    const yard = ramp('#8a7a5a', 4, { spread: 0.28 });
    for (let y = 96; y < SH; y++) for (let x = 0; x < SW; x++) {
      const n = hash2(x, y, 31);
      b.set(x, y, n < 0.2 ? yard[1] : n > 0.9 ? yard[3] : yard[2]);
    }
    darken(b, 20, S.light);
    return b.canvas();
  }

  paint(g, t) {
    const cfg = this.cfg;
    this.bg ||= this.backdrop();
    const L = this.S.light;
    g.drawImage(this.bg, 0, 0);
    // The sign over the door, swinging.
    const sw = Math.sin(t * 1.4) > 0.3 ? 1 : Math.sin(t * 1.4) < -0.3 ? -1 : 0;
    rect(g, 127, 20, 2, 6, '#2a1a0c');
    rect(g, 116 + sw, 26, 24, 14, mixH('#6a4220', '#100a06', dusk(L)));
    rect(g, 116 + sw, 26, 24, 1, '#d8b040');
    rect(g, 123 + sw, 29, 6, 8, '#f0c040');
    rect(g, 123 + sw, 28, 6, 2, '#ffffff');
    rect(g, 129 + sw, 31, 2, 4, '#d8a030');
    bunting(g, 0, 18, SW, 18, 6, this.win.colours, t, 0.2);
    lantern(g, 10, 30, t, '#ff9a3a', L < 0.6 ? 1 : 0.3);
    lantern(g, 246, 30, t + 1, '#ff9a3a', L < 0.6 ? 1 : 0.3);
    // The crowd behind the table.
    crowd(g, 4, 252, 98, 2, this.folk, t, 0.25 + (this.left < 6 ? 0.6 : 0), { face: 'front', light: Math.max(0.4, L), gap: 6 });
    // The three at the table: two of the townsfolk and you.
    for (const s of this.seats()) {
      const bob = s.you ? this.bob : s.r.bob;
      const shake = s.you && this.coughT > 0 ? (Math.floor(t * 30) % 2 ? 1 : -1) : 0;
      const tint = s.you && this.coughT > 0 ? 'rgba(220,40,30,0.35)' : tintOf(L);
      sprite(g, s.you ? cfg.look || DEFAULT_LOOK : s.r.look || DEFAULT_LOOK, s.x + shake, 120 + (bob > 0.3 ? 1 : 0), 0, bob > 0.3 ? 3 : 0, { tint });
      if (s.you && this.gulpT > 0) {
        // The mug up at the mouth.
        rect(g, s.x + 3, 98, 4, 5, '#c89030');
        rect(g, s.x + 3, 97, 4, 1, '#ffffff');
        rect(g, s.x + 7, 99, 1, 3, '#a87020');
      }
    }
    this.paintTable(g, L);
    for (const s of this.seats()) {
      const plates = s.you ? this.plates : Math.floor(s.r.eaten);
      const frac = s.you ? this.bites / this.bitesFor(this.plates) : s.r.eaten - Math.floor(s.r.eaten);
      this.paintPlate(g, s.x, 112, frac, cfg.seed + plates + s.x);
      for (let i = 0; i < Math.min(plates, 12); i++) {
        rect(g, s.x + 15, 113 - i * 2, 10, 1, '#f4f0e8');
        rect(g, s.x + 16, 114 - i * 2, 8, 1, '#a8a098');
      }
    }
    this.crumbs.draw(g);
    if (cfg.wet) rain(g, t, 0.6);
  }

  paintTable(g, L) {
    const k = dusk(L) * 0.6;
    const wood = ramp('#8a5a2a', 4, { spread: 0.3 }).map((c) => hex(mixC(c, [10, 12, 34], k)));
    for (let y = 108; y < 124; y++) rect(g, 0, y, SW, 1, y === 108 ? wood[3] : (y - 108) % 4 === 3 ? wood[0] : wood[2]);
    rect(g, 0, 118, SW, 2, mixH(this.win.colours[0], '#0a0c22', k));
    rect(g, 0, 124, SW, SH - 124, wood[0]);
    for (const x of [10, 120, 236]) rect(g, x, 124, 6, SH - 124, wood[1]);
  }

  // A plate of the town's dish, eaten so far (its bites cleared away).
  paintPlate(g, x, y, frac, seed) {
    rect(g, x - 9, y, 18, 3, '#f4f0e8');
    rect(g, x - 7, y + 3, 14, 1, '#c8c0b4');
    dot(g, x - 10, y + 1, '#d8d0c4');
    dot(g, x + 9, y + 1, '#d8d0c4');
    if (frac >= 1) return;
    let icon = null;
    try {
      icon = itemIcon(this.cfg.food || 'stew');
    } catch {
      icon = null;
    }
    if (!icon) return;
    const c = (this.foodC ||= makeBuf(16, 16));
    const fg = c.getContext('2d');
    fg.clearRect(0, 0, 16, 16);
    fg.drawImage(icon, 0, 0);
    const r = rand(seed * 17 + 1);
    const n = Math.floor(frac * 10);
    fg.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < n; i++) {
      const a = r() * Math.PI * 2;
      const d = 6 - i * 0.3;
      fg.fillRect(Math.round(8 + Math.cos(a) * d) - 2, Math.round(8 + Math.sin(a) * d) - 2, 3 + Math.floor(i / 3), 3 + Math.floor(i / 3));
    }
    fg.globalCompositeOperation = 'source-over';
    g.drawImage(c, x - 8, y - 13);
  }

  paintUI(u) {
    // The time, your throat; under each, their name and their plates.
    panel(u, UW / 2 - 34, 4, 68, 22, { fill: 'rgba(30,22,14,0.92)' });
    text(u, `0:${String(Math.ceil(this.left)).padStart(2, '0')}`, UW / 2, 8, this.left < 6 ? '#ff7060' : '#ffe8b0', { scale: 2, align: 'center' });
    meter(u, 12, 16, 100, 7, this.choke, this.choke > 0.7 ? '#ff5040' : this.choke > 0.4 ? '#f0a030' : '#80c070', 'THROAT');
    for (const s of this.seats()) {
      const name = s.you ? 'YOU' : String(s.r.name).split(' ')[0].toUpperCase();
      rect(u, s.x * 2 - 30, 252, 60, 22, 'rgba(0,0,0,0.6)');
      text(u, name, s.x * 2, 254, s.you ? '#ffe070' : '#f0e0c0', { align: 'center' });
      text(u, (s.you ? this.score() : Math.round(s.r.eaten * 10) / 10).toFixed(1), s.x * 2, 264, '#f0e0c0', { align: 'center' });
    }
    if (this.gulpT > 0) text(u, 'GLUG GLUG', UW / 2, 150, '#c8e0ff', { scale: 2, align: 'center' });
  }
}

// ------------------------------------------------------------ the riddles
// Five riddles at the ale tables by lantern-light, a candle burning down
// for each: 1 to 4 (or a click) to answer.
const RIDDLE_SECS = 22;
class Riddles {
  constructor(win, cfg) {
    this.win = win;
    this.cfg = cfg;
    this.items = cfg.items || [];
    this.i = 0;
    this.picks = [];
    this.left = RIDDLE_SECS;
    this.reveal = 0;
    this.running = false;
    this.cards = [];
    this.excite = 0;
    this.folk = folk(cfg.seed + 9, 50, win.colours);
    this.rules = ['THE KEEPER ASKS FIVE RIDDLES', 'PICK THE ANSWER: 1 TO 4, OR CLICK IT,', 'BEFORE THE CANDLE BURNS DOWN'];
    this.hint = 'ANSWER: 1-4 OR CLICK  ·  ESC: LEAVE';
  }

  begin() {
    this.running = true;
  }

  // (The right answer, so the crowd can say so: worked out from the seed.)
  rightOf(i) {
    const chk = this.cfg.chk || [];
    if (chk[i] === undefined) return -1;
    return (((chk[i] - ((this.cfg.seed >>> (i * 3)) & 3)) % 4) + 4) % 4;
  }

  partial() {
    return { picks: this.picks };
  }

  pick(n) {
    if (!this.running || this.reveal > 0 || this.i >= this.items.length) return;
    this.picks[this.i] = n;
    this.reveal = 1.6;
    if (n === this.rightOf(this.i)) {
      this.win.sfx('reveal_good');
      this.win.pops.add('AYE!', 52, 60, '#80e070', 3);
      this.excite = 1;
      this.win.sparks.burst(52, 84, 14, ['#ffe070', '#ffd060'], 30, 0.7, 40);
    } else {
      this.win.sfx(n < 0 ? 'error' : 'reveal_poor');
      this.win.pops.add(n < 0 ? 'TOO SLOW!' : 'WRONG!', 52, 60, '#ff7060', 2);
    }
  }

  onKey(k) {
    const n = { Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3, Numpad1: 0, Numpad2: 1, Numpad3: 2, Numpad4: 3 }[k.code];
    if (n !== undefined) this.pick(n);
  }

  onClick(m) {
    for (let i = 0; i < this.cards.length; i++) if (inRect(m, this.cards[i])) this.pick(i);
  }

  update(dt) {
    if (!this.running) return;
    this.excite = Math.max(0, this.excite - dt);
    if (this.reveal > 0) {
      this.reveal -= dt;
      if (this.reveal <= 0) {
        this.i++;
        this.left = RIDDLE_SECS;
        if (this.i >= this.items.length) this.win.finish({ picks: this.picks });
      }
      return;
    }
    if (this.i >= this.items.length) return;
    this.left -= dt;
    if (this.left <= 0) this.pick(-1);
  }

  right() {
    return this.picks.filter((p, i) => p === this.rightOf(i)).length;
  }

  headline() {
    const n = this.right();
    return n >= 5 ? 'A SAGE AMONG US!' : n >= 4 ? 'SHARP AS A TACK' : n >= 2 ? 'NOT BAD' : 'BAFFLED!';
  }

  scoreLine() {
    return `${this.right()} OF ${this.items.length} RIGHT`;
  }

  // The tavern's wall at night, painted once: boards, a lit window, the
  // barrel.
  backdrop() {
    const cfg = this.cfg;
    const b = new Bmp(SW, SH);
    this.S = paintSky(b, 16, Math.max(cfg.hour, 20), cfg.wet, cfg.seed);
    const plank = ramp('#5a4030', 4, { spread: 0.26 });
    for (let y = 14; y < SH; y++) for (let x = 0; x < SW; x++) {
      const n = hash2(Math.floor(x / 9), y >> 2, 3);
      b.set(x, y, x % 9 === 0 ? plank[0] : n < 0.2 ? plank[1] : hash2(x, y, 9) < 0.04 ? plank[3] : plank[2]);
    }
    for (let x = 0; x < SW; x++) {
      b.set(x, 14, [40, 26, 18]);
      b.set(x, 15, [60, 40, 28]);
    }
    // A window by the keeper, lit, a glow round it.
    const glass = ramp('#f0a040', 4, { spread: 0.4 });
    for (let y = 40; y < 64; y++) for (let x = 12; x < 36; x++) {
      const edge = x === 12 || x === 35 || y === 40 || y === 63 || x === 24 || y === 51;
      b.set(x, y, edge ? [40, 26, 18] : glass[y < 46 ? 3 : 2]);
    }
    for (let y = 30; y < 74; y++) for (let x = 2; x < 48; x++) {
      const d = Math.hypot(x - 24, (y - 52) * 1.2);
      if (d > 13 && d < 21 && hash2(x, y, 6) < (21 - d) / 14) b.set(x, y, [255, 200, 120], 0.3);
    }
    for (let x = 10; x < 38; x++) b.set(x, 64, [90, 60, 36]);
    // The barrel, the keeper behind it.
    const stave = ramp('#7a4e26', 4, { spread: 0.3 });
    for (let y = 104; y < 142; y++) for (let x = 30; x < 74; x++) {
      const k = (x - 30) / 44;
      const hoop = (y - 104) % 13 < 2;
      b.set(x, y, hoop ? [58, 58, 58] : k < 0.25 ? stave[3] : k > 0.8 ? stave[0] : (x - 30) % 7 === 0 ? stave[1] : stave[2]);
    }
    for (let x = 30; x < 74; x++) {
      b.set(x, 103, stave[3]);
      b.set(x, 102, stave[1]);
    }
    return b.canvas();
  }

  paint(g, t) {
    const cfg = this.cfg;
    this.bg ||= this.backdrop();
    // (In two: the wall behind the keeper, the barrel in front of them.)
    g.drawImage(this.bg, 0, 0, SW, 102, 0, 0, SW, 102);
    lanternString(g, 0, 18, SW, 18, 10, 8, t, ['#ff9a3a', '#ffcc50', '#ff6a40']);
    const keeper = cfg.riddler;
    const right = this.reveal > 0 && this.picks[this.i] === this.rightOf(this.i);
    sprite(g, keeper ? keeper.look : DEFAULT_LOOK, 52, 112, 0, right ? 3 : 0, { tint: 'rgba(40,20,10,0.15)' });
    g.drawImage(this.bg, 0, 102, SW, SH - 102, 0, 102, SW, SH - 102);
    this.paintCandle(g, 66, 102, this.i < this.items.length ? this.left / RIDDLE_SECS : 0, t);
    crowd(g, 84, 256, 138, 2, this.folk, t, this.excite, { face: 'back', light: 0.55, gap: 7 });
    if (cfg.wet) rain(g, t, 0.3);
  }

  paintCandle(g, x, y, f, t) {
    const h = Math.round(2 + f * 12);
    rect(g, x - 1, y - h, 3, h, '#f0e8d0');
    rect(g, x, y - h, 1, h, '#fff8e8');
    rect(g, x - 2, y - 1, 5, 1, '#c8b898');
    if (f <= 0) return;
    // Its light on the wall, the flame flickering.
    g.fillStyle = 'rgba(255,200,120,0.12)';
    for (let dy = -9; dy <= 9; dy++) for (let dx = -9; dx <= 9; dx++) if (Math.hypot(dx, dy) < 9 && (dx + dy) % 2 === 0) g.fillRect(x + dx, y - h - 3 + dy, 1, 1);
    rect(g, x, y - h - 3, 1, 3, '#ffd060');
    dot(g, x + (Math.floor(t * 12) % 2), y - h - 4, '#ffb040');
    dot(g, x, y - h - 2, '#fff4c0');
  }

  paintUI(u) {
    const it = this.items[Math.min(this.i, this.items.length - 1)];
    if (!it) return;
    // The riddle, on a scroll.
    const sx = 168;
    const sy = 40;
    const sw = 330;
    const lines = wrap(it.q, 50);
    const sh = 26 + lines.length * 11;
    parchment(u, sx, sy, sw, sh, this.i + 3);
    rect(u, sx - 4, sy - 3, sw + 8, 4, '#8a6a3a');
    rect(u, sx - 4, sy + sh - 1, sw + 8, 4, '#8a6a3a');
    text(u, `RIDDLE ${Math.min(this.i + 1, this.items.length)} OF ${this.items.length}`, sx + sw / 2, sy + 6, '#6a4a2a', { shadow: null, align: 'center' });
    lines.forEach((l, i) => text(u, l, sx + sw / 2, sy + 19 + i * 11, '#2a1a0c', { shadow: null, align: 'center' }));
    // The four answers, on plaques.
    this.cards = [];
    const m = this.win.mouse();
    const right = this.rightOf(this.i);
    it.opts.forEach((a, i) => {
      const b = { x: sx + (i % 2) * (sw / 2 + 4), y: sy + sh + 14 + Math.floor(i / 2) * 26, w: sw / 2 - 4, h: 20 };
      this.cards.push(b);
      const chosen = this.reveal > 0 && this.picks[this.i] === i;
      const hov = !this.reveal && inRect(m, b);
      let fill = hov ? '#8a6030' : '#5a3a1e';
      if (this.reveal > 0 && i === right) fill = '#3a7a2a';
      else if (chosen) fill = '#8a2a20';
      rect(u, b.x, b.y, b.w, b.h, fill);
      rect(u, b.x, b.y, b.w, 1, mixH(fill, '#ffffff', 0.35));
      rect(u, b.x, b.y + b.h - 1, b.w, 1, mixH(fill, '#000000', 0.45));
      dot(u, b.x + 2, b.y + 2, '#c8a060');
      dot(u, b.x + b.w - 3, b.y + 2, '#c8a060');
      text(u, String(i + 1), b.x + 10, b.y + 6, '#ffe8a0', { align: 'center' });
      text(u, a, b.x + b.w / 2 + 6, b.y + 6, '#fff4dc', { align: 'center' });
    });
    // The tally so far, in chalk on a slate.
    panel(u, 8, 8, 120, 34, { fill: 'rgba(34,38,34,0.95)', edge: '#8a7a5a', inner: null });
    text(u, 'RIGHT SO FAR', 68, 13, '#d8d8c8', { align: 'center' });
    for (let i = 0; i < this.items.length; i++) {
      const p = this.picks[i];
      const done = p !== undefined && (i < this.i || this.reveal > 0);
      const ok = done && p === this.rightOf(i);
      text(u, !done ? '·' : ok ? '✓' : 'X', 28 + i * 20, 26, !done ? '#6a6a60' : ok ? '#a8f0a0' : '#ff8070', { align: 'center' });
    }
    if (this.cfg.riddler) text(u, String(this.cfg.riddler.name).toUpperCase(), 104, 140, '#ffd890', { align: 'center' });
  }
}

// ------------------------------------------------------------ the dance
// Round the maypole (the bonfire, the lantern tree) to a tune of the
// people's own: the steps come down the four lanes; LEFT DOWN UP RIGHT
// (or A S W D) as each reaches the line.
const SCALES = {
  major: [0, 2, 4, 5, 7, 9, 11], dorian: [0, 2, 3, 5, 7, 9, 10], mixo: [0, 2, 4, 5, 7, 9, 10], hijaz: [0, 1, 4, 5, 7, 8, 10],
  pentaMaj: [0, 2, 4, 7, 9], pentaMin: [0, 3, 5, 7, 10], minor: [0, 2, 3, 5, 7, 8, 10],
};
// Each people's band: its tune's scale and key, what plays it, the drums,
// and what's danced round.
const BANDS = {
  vale: { scale: 'major', root: 62, lead: 'fiddle', harm: 'bouzouki', drums: ['tom', 'shaker'], piece: 'maypole' },
  north: { scale: 'dorian', root: 62, lead: 'pipes', harm: 'fiddle', drums: ['kick', 'tom'], piece: 'bonfire' },
  sun: { scale: 'hijaz', root: 64, lead: 'reed', harm: 'bouzouki', drums: ['conga', 'zill'], piece: 'lanterns' },
  wild: { scale: 'pentaMaj', root: 60, lead: 'ocarina', harm: 'marimba', drums: ['conga', 'shaker'], piece: 'firepit' },
  high: { scale: 'mixo', root: 60, lead: 'reel', harm: 'dulcimer', drums: ['kick', 'wood'], piece: 'maypole' },
  ember: { scale: 'minor', root: 57, lead: 'reed', harm: 'bouzouki', drums: ['taiko', 'rim'], piece: 'bonfire' },
  mist: { scale: 'minor', root: 62, lead: 'flute', harm: 'lyre', drums: ['wood', 'shaker'], piece: 'lanterns' },
  tide: { scale: 'pentaMaj', root: 62, lead: 'kalimba', harm: 'steel', drums: ['conga', 'shaker'], piece: 'lanterns' },
  jade: { scale: 'pentaMin', root: 62, lead: 'erhu', harm: 'koto', drums: ['wood', 'taiko'], piece: 'lanterns' },
};
const LANES = [
  { code: ['ArrowLeft', 'KeyA'], c: '#ff6a8a' },
  { code: ['ArrowDown', 'KeyS'], c: '#6ac8ff' },
  { code: ['ArrowUp', 'KeyW'], c: '#80f080' },
  { code: ['ArrowRight', 'KeyD'], c: '#ffd060' },
];
const HIT_Y = 122;
const LANE_X = 186;
const LANE_W = 18;
const FALL = 1.6;
const PIECE = { x: 84, y: 96 };
class Dance {
  constructor(win, cfg) {
    this.win = win;
    this.cfg = cfg;
    this.B = BANDS[cfg.style] || BANDS.vale;
    this.bpm = cfg.tempo || 120;
    this.beat = 60 / this.bpm;
    this.notes = [];
    this.song = [];
    this.compose();
    this.t0 = null;
    this.combo = 0;
    this.maxCombo = 0;
    this.pts = 0;
    this.lit = [0, 0, 0, 0];
    this.pose = 0;
    this.hop = 0;
    this.excite = 0;
    this.scheduled = 0;
    this.over = false;
    this.ring = folk(cfg.seed + 21, 10, win.colours).map((p, i) => ({ ...p, shirt: win.colours[i % win.colours.length] }));
    this.watch = folk(cfg.seed + 3, 40, win.colours);
    this.rules = ['THE STEPS COME DOWN THE FOUR LANES', 'PRESS EACH AS IT REACHES THE LINE:', 'LEFT DOWN UP RIGHT  (OR A S W D)', 'KEEP IN STEP FOR A BIGGER SCORE'];
    this.hint = 'STEP: ← ↓ ↑ →  OR  A S W D  ·  ESC: LEAVE';
  }

  // A tune of the people's own (the same for the same seed): a count-in,
  // then eight phrases, A A B A over again, the steps on its notes.
  compose() {
    const r = rand(this.cfg.seed || 1);
    const sc = SCALES[this.B.scale];
    const deg = (d) => this.B.root + sc[((d % sc.length) + sc.length) % sc.length] + Math.floor(d / sc.length) * 12;
    const motif = () => {
      const out = [];
      let d = Math.floor(r() * 3) * 2;
      for (let b = 0; b < 8; b++) {
        d += [-2, -1, -1, 0, 1, 1, 2, 3][Math.floor(r() * 8)];
        d = Math.max(-2, Math.min(9, d));
        out.push({ d, eighth: r() < 0.4 });
      }
      return out;
    };
    const A = motif();
    const Bm = motif();
    const parts = [A, A, Bm, A, A, Bm, Bm, A];
    const count = 4;
    const prog = [0, 3, 4, 0];
    let lastD = null;
    let lane = 0;
    parts.forEach((m, pi) => {
      m.forEach((n, i) => {
        const tt = (count + pi * 8 + i) * this.beat;
        this.song.push({ t: tt, kind: 'lead', midi: deg(n.d), dur: this.beat * (n.eighth ? 0.45 : 0.9) });
        if (n.eighth) this.song.push({ t: tt + this.beat / 2, kind: 'lead', midi: deg(n.d + 1), dur: this.beat * 0.45 });
        // The step for it: up for up, down for down, side to side if it stays.
        if (pi > 0 || i % 2 === 0) {
          if (lastD === null || n.d === lastD) lane = lane === 0 ? 3 : 0;
          else lane = n.d > lastD ? (n.d - lastD >= 2 ? 3 : 2) : 1;
          this.notes.push({ t: tt, lane, hit: null });
          if (n.eighth && pi >= 4) this.notes.push({ t: tt + this.beat / 2, lane: (lane + 2) % 4, hit: null });
        }
        lastD = n.d;
      });
      for (let b = 0; b < 8; b += 2) {
        const ch = prog[Math.floor(b / 2) % 4];
        const tt = (count + pi * 8 + b) * this.beat;
        this.song.push({ t: tt, kind: 'bass', midi: deg(ch) - 24, dur: this.beat * 1.6 });
        this.song.push({ t: tt, kind: 'harm', midi: [deg(ch), deg(ch + 2), deg(ch + 4)].map((x) => x - 12), dur: this.beat * 1.8 });
      }
    });
    const bars = count + parts.length * 8;
    for (let b = 0; b < bars; b++) {
      this.song.push({ t: b * this.beat, kind: 'drum', drum: b < count ? 'rim' : b % 2 ? this.B.drums[1] : this.B.drums[0], vel: b < count ? 0.8 : 1 });
      if (b >= count) this.song.push({ t: (b + 0.5) * this.beat, kind: 'drum', drum: 'shaker', vel: 0.45 });
    }
    this.song.sort((a, b) => a.t - b.t);
    this.length = bars * this.beat + 1.2;
  }

  begin() {
    this.win.band.ready();
    this.t0 = this.win.band.now() + 0.25;
  }

  stop() {
    this.over = true;
  }

  // The song's time now (by the music's own clock, so the steps keep to it).
  songT() {
    return this.t0 === null ? -10 : this.win.band.now() - this.t0;
  }

  partial() {
    return { score: this.finalScore() };
  }

  finalScore() {
    const n = this.notes.length || 1;
    return Math.round(Math.min(1000, ((1000 * this.pts) / n) * (0.85 + (0.15 * this.maxCombo) / n)));
  }

  laneX(i) {
    return LANE_X + i * LANE_W;
  }

  onKey(k) {
    if (this.t0 === null || k.repeat) return;
    const lane = LANES.findIndex((L) => L.code.includes(k.code));
    if (lane < 0) return;
    const now = this.songT();
    this.lit[lane] = 0.15;
    let best = null;
    for (const n of this.notes) {
      if (n.lane !== lane || n.hit !== null) continue;
      const d = Math.abs(n.t - now);
      if (d < 0.2 && (!best || d < Math.abs(best.t - now))) best = n;
    }
    if (!best) {
      // (A step out of time: the run's broken.)
      this.combo = 0;
      return;
    }
    const d = Math.abs(best.t - now);
    const x = this.laneX(lane);
    if (d <= 0.075) {
      best.hit = 'perfect';
      this.pts += 1;
      this.combo++;
      this.win.pops.add('PERFECT', x, HIT_Y - 12, '#ffe070', 1, 0.6);
      this.win.sparks.burst(x, HIT_Y, 8, [LANES[lane].c, '#ffffff'], 40, 0.45, 60);
    } else if (d <= 0.15) {
      best.hit = 'good';
      this.pts += 0.6;
      this.combo++;
      this.win.pops.add('GOOD', x, HIT_Y - 12, '#a0e0ff', 1, 0.6);
    } else {
      best.hit = 'miss';
      this.combo = 0;
    }
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    this.pose = lane;
    this.hop = 1;
    this.excite = Math.min(1, this.combo / 20);
  }

  update(dt) {
    if (this.t0 === null || this.over) return;
    this.lit = this.lit.map((v) => Math.max(0, v - dt));
    this.hop = Math.max(0, this.hop - dt * 4);
    const now = this.songT();
    const band = this.win.band;
    while (this.scheduled < this.song.length && this.song[this.scheduled].t < now + 0.25) {
      const s = this.song[this.scheduled++];
      const at = this.t0 + s.t;
      if (at < band.now() - 0.05) continue;
      if (s.kind === 'drum') band.hit(s.drum, at, s.vel);
      else if (s.kind === 'lead') band.note(this.B.lead, 'lead', s.midi, at, s.dur, 0.8);
      else if (s.kind === 'harm') band.note(this.B.harm, 'harm', s.midi, at, s.dur, 0.35);
      else band.note('pluckbass', 'bass', s.midi, at, s.dur, 0.7);
    }
    for (const n of this.notes) {
      if (n.hit === null && now - n.t > 0.18) {
        n.hit = 'miss';
        this.combo = 0;
      }
    }
    if (now > this.length && !this.over) {
      this.over = true;
      this.win.sfx('fanfare');
      this.win.finish({ score: this.finalScore() });
    }
  }

  headline() {
    const s = this.finalScore();
    return s >= 850 ? 'LIGHT ON YOUR FEET!' : s >= 650 ? 'A FINE DANCER' : s >= 400 ? 'NOT TWO LEFT FEET' : 'TWO LEFT FEET...';
  }

  scoreLine() {
    return `${this.finalScore()} POINTS`;
  }

  // The square of an evening, painted once: the sky, the houses round it
  // with their windows lit, the cobbles.
  backdrop() {
    const cfg = this.cfg;
    const b = new Bmp(SW, SH);
    const S = paintSky(b, 70, Math.max(cfg.hour, 18.6), cfg.wet, cfg.seed);
    this.S = S;
    const r = rand(cfg.seed + 41);
    const walls = ['#c8b088', '#b8a080', '#d8c8a4', '#a89070'];
    const roofs = ['#8a4a32', '#5a4a6a', '#6a3a2a', '#4a5a6a'];
    const glass = ramp('#f0a040', 3, { spread: 0.3 });
    let x = -6;
    while (x < SW) {
      const w = 18 + Math.floor(r() * 16);
      const h = 14 + Math.floor(r() * 16);
      const yb = 72;
      const Wr = ramp(walls[Math.floor(r() * walls.length)], 4, { spread: 0.24 });
      const Rr = ramp(roofs[Math.floor(r() * roofs.length)], 4, { spread: 0.3 });
      for (let y = yb - h; y < yb; y++) for (let i = 0; i < w; i++) b.set(x + i, y, i === 0 ? Wr[3] : i === w - 1 ? Wr[0] : hash2(x + i, y, 2) < 0.08 ? Wr[1] : Wr[2]);
      const rh = Math.round(w * 0.45);
      for (let j = 0; j < rh; j++) {
        const half = Math.round(((j + 1) / rh) * (w / 2 + 2));
        for (let i = -half; i <= half; i++) b.set(x + Math.round(w / 2) + i, yb - h - rh + j, i < -half + 2 ? Rr[3] : i > half - 2 ? Rr[0] : j % 3 === 2 ? Rr[1] : Rr[2]);
      }
      for (let wy = yb - h + 4; wy < yb - 5; wy += 8) {
        for (let wx = x + 3; wx < x + w - 4; wx += 7) {
          const lit = r() < 0.65;
          for (let yy = 0; yy < 4; yy++) for (let xx = 0; xx < 3; xx++) b.set(wx + xx, wy + yy, lit ? glass[yy < 1 ? 2 : 1] : [40, 34, 44]);
        }
      }
      x += w + 2;
    }
    darken(b, 26, S.light);
    // The cobbles.
    const stone = ramp('#8a7a64', 4, { spread: 0.3 });
    for (let y = 72; y < SH; y++) {
      const row = Math.floor((y - 72) / (2 + (y - 72) * 0.025));
      const cw = Math.round(3 + (y - 72) * 0.04);
      for (let x2 = 0; x2 < SW; x2++) {
        const n = hash2(Math.floor((x2 + row * 3) / cw), row, 13);
        b.set(x2, y, (x2 + row * 3) % cw === 0 ? stone[0] : n < 0.3 ? stone[1] : n > 0.85 ? stone[3] : stone[2]);
      }
    }
    darken(b, 72, Math.max(0.35, S.light));
    return b.canvas();
  }

  paint(g, t) {
    const cfg = this.cfg;
    this.bg ||= this.backdrop();
    const L = Math.max(0.3, this.S.light);
    g.drawImage(this.bg, 0, 0);
    lanternString(g, 0, 20, 128, 12, 10, 6, t, this.win.colours);
    lanternString(g, 128, 12, SW, 20, 10, 6, t + 3, this.win.colours);
    // The ring round the piece: the back half, the piece, the front half.
    const spin = t * (0.45 + this.excite * 0.35);
    const ring = this.ring.map((p, i) => {
      const a = spin + (i / this.ring.length) * Math.PI * 2;
      return { p, a, x: PIECE.x + Math.cos(a) * 54, y: PIECE.y + Math.sin(a) * 12 };
    });
    const pen = (x, y, c) => {
      if (c) dot(g, x, y, mixH(c, '#0a0c22', dusk(L) * 0.6));
    };
    const dancer = (d) => {
      const hop = Math.sin(t * 6 + d.a * 3) > 0.5 ? 1 : 0;
      drawPerson(pen, d.x, d.y - hop, { ...d.p, size: 'normal', pose: 'wave', t: t + d.p.ph, dir: Math.cos(d.a) > 0 ? -1 : 1 });
      if (this.B.piece === 'maypole') line(g, PIECE.x, PIECE.y - 58, d.x + 2, d.y - 9 - hop, d.p.shirt);
    };
    for (const d of ring.filter((q) => Math.sin(q.a) < 0)) dancer(d);
    this.paintPiece(g, L, t);
    for (const d of ring.filter((q) => Math.sin(q.a) >= 0)) dancer(d);
    this.paintBand(g, 150, 98, t);
    // You, at the front.
    const dirs = [1, 0, 2, 3];
    rect(g, PIECE.x - 6, 134, 12, 1, 'rgba(0,0,0,0.3)');
    sprite(g, cfg.look || DEFAULT_LOOK, PIECE.x, 135 - Math.round(this.hop * 3), dirs[this.pose], this.hop > 0.3 ? 1 : 0, { tint: tintOf(L) });
    crowd(g, 0, 44, 139, 2, this.watch, t, this.excite, { face: 'back', light: L, gap: 6 });
    crowd(g, 126, 172, 139, 2, this.watch, t + 2, this.excite, { face: 'back', light: L, gap: 6 });
    this.paintLanes(g);
    if (cfg.wet) rain(g, t, 0.7);
  }

  // The middle of it: the maypole, the bonfire, the lantern tree.
  paintPiece(g, L, t) {
    const { x, y } = PIECE;
    const p = this.B.piece;
    if (p === 'maypole') {
      rect(g, x - 1, y - 58, 2, 60, mixH('#a89880', '#202020', dusk(L)));
      rect(g, x - 1, y - 58, 1, 60, mixH('#d8ccb4', '#303030', dusk(L)));
      for (let k = 0; k < 60; k += 6) dot(g, x, y - 58 + k + (Math.floor(t * 2) % 6), this.win.colours[(k / 6) % this.win.colours.length]);
      disc(g, x, y - 58, 4, mixH('#3aa850', '#0a1a0a', dusk(L)));
      for (let i = 0; i < 8; i++) dot(g, x + Math.round(Math.cos(i + t) * 3), y - 58 + Math.round(Math.sin(i + t) * 2), this.win.colours[i % this.win.colours.length]);
    } else if (p === 'bonfire' || p === 'firepit') {
      const big = p === 'bonfire' ? 1.4 : 1;
      // Its light on the square: rings of dither.
      g.fillStyle = 'rgba(255,170,80,0.14)';
      for (let dy = -24; dy <= 12; dy++) for (let dx = -40; dx <= 40; dx++) if (Math.hypot(dx / 1.6, dy) < 24 && (dx + dy) % 2 === 0) g.fillRect(x + dx, y + dy, 1, 1);
      for (let i = -3; i <= 3; i++) line(g, x + i * 2, y + 2, x + i, y - 6 * big, '#3a2410');
      const flame = ['#e04a20', '#ff8030', '#ffb040', '#fff0a0'];
      for (let dx = -7; dx <= 7; dx++) {
        const hgt = Math.round((14 - Math.abs(dx) * 1.6) * big + Math.sin(t * 13 + dx * 1.7) * 2 + Math.sin(t * 7 + dx) * 1.5);
        for (let k = 0; k < hgt; k++) dot(g, x + dx, y - 2 - k, flame[Math.min(3, Math.floor((1 - k / Math.max(1, hgt)) * 3.2 + (Math.abs(dx) < 3 ? 1 : 0)))]);
      }
      if (Math.random() < 0.4) this.win.sparks.burst(x, y - 14 * big, 1, ['#ffd060', '#ff8030'], 14, 1.4, -10);
    } else {
      const wood = mixH('#5a3a1a', '#100a06', dusk(L));
      rect(g, x - 1, y - 50, 2, 52, wood);
      rect(g, x - 16, y - 46, 32, 1, wood);
      rect(g, x - 11, y - 34, 22, 1, wood);
      for (let i = 0; i < 5; i++) lantern(g, x - 14 + i * 7, y - 41, t + i, this.win.colours[i % this.win.colours.length]);
      for (let i = 0; i < 4; i++) lantern(g, x - 9 + i * 6, y - 29, t + i * 2, this.win.colours[(i + 2) % this.win.colours.length]);
    }
  }

  // The fiddler and the drummer, keeping time.
  paintBand(g, x, yb, t) {
    const pen = (px, py, c) => c && dot(g, px, py, c);
    const beat = this.t0 !== null ? (this.songT() / this.beat) % 1 : 0;
    drawPerson(pen, x, yb, { skin: '#e0b090', hair: '#5a3a1a', shirt: '#5a3a6a', size: 'normal', dir: 1 });
    // The fiddle under the chin, the bow across it.
    rect(g, x + 1, yb - 9, 3, 2, '#8a4a1a');
    line(g, x + 2 + (Math.floor(t * 8) % 2), yb - 12, x + 5 + (Math.floor(t * 8) % 2), yb - 6, '#e8e0c0');
    drawPerson(pen, x + 14, yb, { skin: '#c89068', hair: '#2a1a10', shirt: '#2a5a3a', size: 'normal', dir: -1 });
    // The drum, the beater coming down on the beat.
    disc(g, x + 18, yb - 4, 3, '#c8a878');
    dot(g, x + 18, yb - 4, '#a88858');
    line(g, x + 16, yb - 7, x + 18, yb - (beat < 0.2 ? 6 : 10), '#5a3a1a');
  }

  // The four lanes, the steps coming down them.
  paintLanes(g) {
    const now = this.songT();
    rect(g, LANE_X - 11, 2, LANE_W * 4 + 4, HIT_Y + 14, 'rgba(8,6,12,0.6)');
    LANES.forEach((Ln, i) => {
      const x = this.laneX(i);
      if (this.lit[i] > 0) rect(g, x - 8, 2, 16, HIT_Y + 14, 'rgba(255,255,255,0.12)');
      rect(g, x - 8, 2, 1, HIT_Y + 14, 'rgba(255,255,255,0.06)');
      // The ring at the line.
      const c = this.lit[i] > 0 ? '#ffffff' : Ln.c;
      for (let a = 0; a < 24; a++) dot(g, x + Math.round(Math.cos((a / 24) * Math.PI * 2) * 6), HIT_Y + Math.round(Math.sin((a / 24) * Math.PI * 2) * 6), c);
      arrowPix(g, i, x, HIT_Y, 'rgba(255,255,255,0.3)');
    });
    for (const n of this.notes) {
      const dtn = n.t - now;
      if (dtn > FALL || dtn < -0.3 || n.hit === 'perfect' || n.hit === 'good') continue;
      const x = this.laneX(n.lane);
      const y = Math.round(HIT_Y - (dtn / FALL) * (HIT_Y - 6));
      const c = n.hit === 'miss' ? '#4a4450' : LANES[n.lane].c;
      disc(g, x, y, 5, mixH(c, '#000000', 0.35));
      disc(g, x, y - 1, 5, c);
      dot(g, x - 2, y - 3, '#ffffff');
      arrowPix(g, n.lane, x, y - 1, '#1a1020');
    }
  }

  paintUI(u) {
    const now = this.songT();
    text(u, `${this.finalScore()} POINTS`, 12, 30, '#ffe8b0', { scale: 2 });
    if (this.combo >= 4) text(u, `${this.combo} IN STEP!`, (LANE_X + LANE_W * 1.5) * 2, (HIT_Y + 9) * 2, '#ffe070', { align: 'center' });
    meter(u, 12, 16, 120, 7, Math.max(0, Math.min(1, now / this.length)), '#c090ff', 'THE TUNE');
  }
}

// An arrow of pixels pointing a lane's way, centred on (x, y).
function arrowPix(g, lane, x, y, c) {
  const P = {
    0: [[-2, 0], [-1, -1], [-1, 0], [-1, 1], [0, 0], [1, 0], [2, 0], [0, -2], [0, 2]],
    1: [[0, 2], [-1, 1], [0, 1], [1, 1], [0, 0], [0, -1], [0, -2], [-2, 0], [2, 0]],
    2: [[0, -2], [-1, -1], [0, -1], [1, -1], [0, 0], [0, 1], [0, 2], [-2, 0], [2, 0]],
    3: [[2, 0], [1, -1], [1, 0], [1, 1], [0, 0], [-1, 0], [-2, 0], [0, -2], [0, 2]],
  }[lane];
  for (const [dx, dy] of P) dot(g, x + dx, y + dy, c);
}

// ------------------------------------------------------------ the cook-off
// The judging: each dish brought to the table in turn, tasted, and the
// three judges' cards held up; then the winners.
const PLATE_SECS = 4.2;
const JUDGE_X = [80, 128, 176];
class Cookoff {
  constructor(win, cfg) {
    this.win = win;
    this.cfg = cfg;
    this.plates = cfg.plates || [];
    this.judges = cfg.judges || [];
    this.i = 0;
    this.pt = 0;
    this.excite = 0;
    this.finished = false;
    this.flipped = -1;
    this.folk = folk(cfg.seed + 11, 70, win.colours);
    this.hint = 'SPACE: SKIP TO THE END  ·  ESC: LEAVE';
  }

  onKey(k) {
    if (k.code === 'Space' || k.code === 'Enter') this.end();
  }

  onClick() {
    this.end();
  }

  end() {
    if (this.finished) return;
    this.finished = true;
    this.i = this.plates.length;
    this.win.sfx('fanfare');
    this.win.finish({});
  }

  partial() {
    return null;
  }

  finalBoard() {
    return [...this.plates].sort((a, b) => sum(b.cards) - sum(a.cards)).map((p) => ({ name: p.name, score: sum(p.cards), you: p.who === this.cfg.you }));
  }

  update(dt) {
    if (this.finished) return;
    this.excite = Math.max(0, this.excite - dt * 0.5);
    if (this.pt === 0) this.win.sfx('roll');
    this.pt += dt;
    const p = this.plates[this.i];
    if (!p) return this.end();
    const f = Math.floor((this.pt - 1.4) / 0.5);
    if (f !== this.flipped && f >= 0 && f < 3) {
      this.flipped = f;
      this.win.sfx('click');
      if (f === 2) {
        const s = sum(p.cards);
        this.excite = s / 30;
        this.win.sfx(s >= 24 ? 'reveal_great' : s >= 16 ? 'reveal_good' : 'reveal_poor');
        if (s >= 24) this.win.sparks.burst(128, 70, 20, ['#ffe070', '#ffffff'], 45, 0.8, 60);
      }
    }
    if (this.pt >= PLATE_SECS) {
      this.pt = 0;
      this.flipped = -1;
      this.i++;
      if (this.i >= this.plates.length) this.end();
    }
  }

  // The square, painted once: the sky, the hills, the ground.
  backdrop() {
    const cfg = this.cfg;
    const b = new Bmp(SW, SH);
    const S = paintSky(b, 52, cfg.hour, cfg.wet, cfg.seed);
    this.S = S;
    const air = rgb(S.low);
    const crest = (x) => 46 + Math.sin(x * 0.04 + 2) * 3 + Math.sin(x * 0.13) * 1.5;
    paintHills(b, crest, 54, ramp(landOf(cfg.style), 4, { spread: 0.3 }).map((c) => mixC(c, air, 0.35)), { seed: 5 });
    const leaf = ramp(landOf(cfg.style), 5, { spread: 0.4 }).map((c) => mixC(c, air, 0.25));
    const r = rand(cfg.seed + 2);
    for (let x = 0; x < SW; x += 14 + Math.floor(r() * 18)) bush(b, x, Math.round(crest(x) + 6), 8 + r() * 6, 5, leaf, x + 3);
    const ground = ramp('#9a8a6a', 4, { spread: 0.26 });
    for (let y = 54; y < SH; y++) for (let x = 0; x < SW; x++) {
      const n = hash2(x >> 1, y, 8);
      b.set(x, y, n < 0.2 ? ground[1] : n > 0.92 ? ground[3] : ground[2]);
    }
    darken(b, 40, S.light);
    return b.canvas();
  }

  paint(g, t) {
    const cfg = this.cfg;
    this.bg ||= this.backdrop();
    const L = Math.max(0.3, this.S.light);
    g.drawImage(this.bg, 0, 0);
    // The banner over the table, on its posts, its words on it.
    post(g, 30, 10, 96, L);
    post(g, 224, 10, 96, L);
    const cloth = ramp(this.win.colours[0], 3, { spread: 0.3 }).map(hex);
    for (let x = 32; x < 224; x++) {
      const fold = Math.sin(x * 0.3 + t * 1.2) > 0.6 ? 0 : 1;
      const h = 14 + Math.round(Math.sin(((x - 32) / 192) * Math.PI) * 3);
      rect(g, x, 12, 1, h, cloth[fold + 1]);
      dot(g, x, 12 + h, cloth[0]);
    }
    text(g, 'THE COOK-OFF', 129, 16, '#2a1408', { shadow: null, align: 'center' });
    text(g, 'THE COOK-OFF', 128, 15, '#fff0c0', { shadow: null, align: 'center' });
    bunting(g, 30, 9, 226, 9, 4, this.win.colours, t, 0.2);
    // The judges behind the table.
    const p = this.plates[Math.min(this.i, this.plates.length - 1)];
    this.judges.forEach((j, n) => {
      const tasting = p && !this.finished && this.pt > 0.7 && this.pt < 1.4;
      sprite(g, j.look || DEFAULT_LOOK, JUDGE_X[n], 90 + (tasting && Math.floor(t * 8 + n) % 2 ? 1 : 0), 0, tasting ? 3 : 0, { tint: tintOf(L) });
    });
    // The table and its cloth.
    rect(g, 40, 84, 176, 4, mixH('#e0d8c4', '#0a0c22', dusk(L)));
    rect(g, 40, 84, 176, 1, mixH('#f4ecd8', '#0a0c22', dusk(L)));
    const c1 = this.win.colours[1] || '#c83030';
    for (let x = 40; x < 216; x++) {
      const stripe = Math.floor((x - 40) / 8) % 2 ? mixH(c1, '#2a1a10', 0.3) : mixH(c1, '#2a1a10', 0.55);
      rect(g, x, 88, 1, 18, mixH(stripe, '#0a0c22', dusk(L)));
      dot(g, x, 105 - (x % 3 === 0 ? 1 : 0), mixH(stripe, '#000000', 0.3));
    }
    rect(g, 40, 106, 176, 1, 'rgba(0,0,0,0.3)');
    if (p && !this.finished) this.paintDish(g, p, t);
    crowd(g, 0, 256, 140, 3, this.folk, t, this.excite, { face: 'back', light: L, gap: 6 });
    if (cfg.wet) rain(g, t, 0.6);
  }

  paintDish(g, p, t) {
    const slide = Math.min(1, this.pt / 0.6);
    const e = 1 - (1 - slide) * (1 - slide);
    const px = Math.round(SW + 20 - (SW + 20 - 128) * e);
    rect(g, px - 11, 84, 22, 3, '#ffffff');
    rect(g, px - 9, 87, 18, 1, '#b8b0a0');
    let icon = null;
    try {
      icon = itemIcon(p.dish);
    } catch {
      icon = null;
    }
    if (icon) g.drawImage(icon, px - 8, 71);
    // Steam off it.
    for (let s = 0; s < 3; s++) {
      for (let k = 0; k < 4; k++) {
        const ph = (t * 0.8 + k * 0.25 + s * 0.4) % 1;
        dot(g, px - 4 + s * 4 + Math.round(Math.sin(t * 3 + k + s) * 1.5), 70 - Math.round(ph * 14), `rgba(255,255,255,${(0.6 * (1 - ph)).toFixed(2)})`);
      }
    }
    // The cards, one by one, held up over each judge.
    p.cards.forEach((v, n) => {
      if (n > this.flipped) return;
      const up = Math.min(1, (this.pt - 1.4 - n * 0.5) / 0.2);
      const cx = JUDGE_X[n] + 12;
      const top = Math.round(50 - up * 6);
      line(g, cx, top + 12, cx - 2, 76, '#5a3a1a');
      rect(g, cx - 8, top, 16, Math.max(1, Math.round(12 * up)), '#fffaf0');
      rect(g, cx - 8, top + Math.round(12 * up) - 1, 16, 1, '#c8c0b0');
      if (up >= 1) text(g, String(v), cx, top + 2, v >= 8 ? '#208a20' : v <= 4 ? '#b02020' : '#1a1a1a', { shadow: null, align: 'center' });
    });
  }

  paintUI(u) {
    const p = this.plates[Math.min(this.i, this.plates.length - 1)];
    if (!p || this.finished) return;
    this.judges.forEach((j, n) => text(u, String(j.name).split(' ')[0].toUpperCase(), JUDGE_X[n] * 2, 120, '#f0e0c0', { align: 'center' }));
    // Whose it is.
    parchment(u, UW / 2 - 110, 220, 220, 30, this.i + 1);
    text(u, String(p.name).toUpperCase(), UW / 2, 226, p.who === this.cfg.you ? '#a06000' : '#2a1a0c', { shadow: null, align: 'center' });
    text(u, p.dishName || 'a dish', UW / 2, 238, '#5a3a1a', { shadow: null, align: 'center' });
    if (this.flipped >= 2) {
      panel(u, UW - 78, 120, 68, 36);
      text(u, 'TOTAL', UW - 44, 126, '#c8b890', { align: 'center' });
      text(u, String(sum(p.cards)), UW - 44, 137, '#ffe070', { scale: 2, align: 'center' });
    }
    text(u, `DISH ${this.i + 1} OF ${this.plates.length}`, 10, 8, '#f0e0c0');
  }
}

const sum = (a) => (a || []).reduce((x, y) => x + y, 0);

const GAMES = { archery: Archery, eating: Eating, riddles: Riddles, dance: Dance, cookoff: Cookoff };

// ------------------------------------------------------------ the board
// The festival's board (on the green): the day's programme, and the
// contests (when, where, the best so far), with a button to have a go.
export class FestBoardWindow extends Window {
  // `info`: { title, prog (lines), rows (see festplay.boardRows) }, or a
  // function of the game giving it (kept up to date).
  constructor(ui, info, onEnter) {
    super(ui, 74, 30, { kind: 'festboard' });
    this.info = info;
    this.onEnter = onEnter;
  }

  draw(g, game) {
    const I = typeof this.info === 'function' ? this.info(game) : this.info;
    if (!I) return;
    g.fill(0, 0, this.w, this.h, ' ', C.fg, 'rgba(26,30,24,0.97)');
    g.box(0, 0, this.w, this.h, { bg: 'rgba(26,30,24,0.97)', double: true, title: ' FESTIVAL BOARD ' });
    g.center(1, I.title.toUpperCase().slice(0, this.w - 4), C.hi);
    g.text(2, 3, 'THE DAY', C.cyan);
    (I.prog || []).slice(0, 6).forEach((l, i) => g.text(3, 4 + i, l.slice(0, this.w - 6), C.fg));
    let y = 11;
    g.text(2, y - 1, 'THE CONTESTS', C.cyan);
    for (const r of I.rows || []) {
      if (y > this.h - 4) break;
      const stCol = r.st === 'open' ? C.green : r.st === 'done' ? C.dim : C.fg;
      g.text(3, y, r.name, C.hi);
      g.text(18, y, r.where.slice(0, 20), C.dim);
      g.text(40, y, r.when, stCol);
      const can = r.st === 'open' && (r.left > 0 || r.k === 'race') && !(r.k === 'race' && r.entered);
      if (can) {
        const label = r.k === 'race' ? '[SIGN UP]' : r.k === 'cookoff' ? '[PUT IN]' : '[HAVE A GO]';
        const x = this.w - label.length - 2;
        const hov = this.hovering(x, y, label.length, 1);
        g.text(x, y, label, hov ? C.white : C.green, hov ? C.bgHi : undefined);
        this.hit(x, y, label.length, 1, () => this.onEnter && this.onEnter(r.k, game));
      } else if (r.entered) g.text(this.w - 10, y, 'ENTERED', C.dim);
      const top = r.top.map((q, i) => `${i + 1}.${q.name.split(' ')[0]} ${q.score}`).join('  ');
      g.text(5, y + 1, (top || (r.st === 'done' ? 'nobody' : 'nobody yet')).slice(0, this.w - 8), r.top.some((q) => q.you) ? C.hi : C.gray);
      y += 2;
    }
    g.center(this.h - 2, 'ESC: close', C.faint);
  }

  onKey(k) {
    if (k.code === 'Escape' || k.code === 'KeyE') {
      this.close();
      return true;
    }
    return true;
  }
}
