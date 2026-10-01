// What the realm knows (the tree, from the mayor), and the study desk
// where a licensed researcher works at the problems the scholars set.
import { CHAR_W, CHAR_H } from '../config.js';
import { Window } from './window.js';
import { C, wrap } from './ascii.js';
import { TECHS, BRANCHES, branchTechs } from '../sim/tech.js';

const pct = (a, b) => Math.max(0, Math.min(100, Math.floor((a / Math.max(1, b)) * 100)));
const bar = (f, n) => '█'.repeat(Math.round(f * n)) + '░'.repeat(n - Math.round(f * n));

// ---------------------------------------------------------------- the tree
export class TechWindow extends Window {
  constructor(ui, game, s) {
    super(ui, 80, 32, { kind: 'tech' });
    this.game = game;
    this.s = s;
    this.closeOnOutside = true;
    this.col = 0;
    this.row = 0;
  }
  draw(g, game) {
    const s = this.s;
    const T = game.sim.tech;
    const st = T.stateOf(s);
    const civ = s.civ;
    g.box(0, 0, this.w, this.h, { bg: 'rgba(16,14,24,0.96)', double: true, title: 'WHAT THE REALM KNOWS' });
    const who = T.leaderOf(s);
    const realm = civ ? civ.name.replace(/^The /, '') : `free town of ${s.name}`;
    g.center(1, `${realm.toUpperCase()}${who ? ` · ${who.name.first} ${who.name.last} decides` : ''}`, '#f0e0c0');
    if (st.current) {
      const t = TECHS[st.current];
      const f = st.progress / t.cost;
      g.text(3, 3, 'Studying:', C.dim);
      g.text(13, 3, t.name, C.hi);
      g.text(13 + t.name.length + 2, 3, `${bar(f, 20)} ${pct(st.progress, t.cost)}%`, '#c8a060');
    } else g.text(3, 3, st.done.length >= 20 ? 'Everything there is to know, the scholars know.' : 'Nothing under study just now.', C.dim);
    g.text(3, 4, `${st.done.length} of 20 learned`, C.faint);
    // Four columns, five steps down each.
    const cw = 19;
    BRANCHES.forEach((b, ci) => {
      const x = 2 + ci * cw;
      g.text(x + 1, 6, b.name.toUpperCase().slice(0, cw - 2), b.color);
      branchTechs(b.id).forEach((k, ri) => {
        const y = 8 + ri * 4;
        const t = TECHS[k];
        const done = st.done.includes(k);
        const cur = st.current === k;
        const pre = T.prereq(k);
        const open = !pre || st.done.includes(pre);
        const sel = this.col === ci && this.row === ri;
        const hov = this.hovering(x, y, cw - 1, 2);
        if (hov) {
          this.col = ci;
          this.row = ri;
        }
        const bg = sel ? 'rgba(70,60,40,0.95)' : done ? 'rgba(30,50,30,0.9)' : cur ? 'rgba(60,50,20,0.9)' : 'rgba(26,22,32,0.9)';
        g.fill(x, y, cw - 1, 2, ' ', C.fg, bg);
        const mark = done ? '■' : cur ? '►' : open ? '·' : ' ';
        const col = done ? C.green : cur ? C.hi : open ? C.fg : C.faint;
        g.text(x, y, `${mark} ${t.name}`.slice(0, cw - 1), col);
        g.text(x + 2, y + 1, done ? 'learned' : cur ? `${bar(st.progress / t.cost, 8)} ${pct(st.progress, t.cost)}%` : `tier ${t.tier}`, done ? '#5a9a4a' : cur ? '#c8a060' : C.faint);
        if (ri < 4) g.text(x + 8, y + 2, '│', done ? '#5a9a4a' : C.faint);
        if (ri < 4) g.text(x + 8, y + 3, '▼', done ? '#5a9a4a' : C.faint);
      });
    });
    // What the one picked does.
    const k = branchTechs(BRANCHES[this.col].id)[this.row];
    const t = TECHS[k];
    const lines = wrap(`${t.name}: ${t.desc}`, this.w - 6);
    lines.slice(0, 2).forEach((l, i) => g.text(3, this.h - 4 + i, l, C.white));
    g.text(3, this.h - 1, ' arrows look · [ESC] close ', C.faint);
  }
  onKey(k) {
    if (k.code === 'ArrowLeft' || k.code === 'KeyA') this.col = (this.col + 3) % 4;
    else if (k.code === 'ArrowRight' || k.code === 'KeyD') this.col = (this.col + 1) % 4;
    else if (k.code === 'ArrowUp' || k.code === 'KeyW') this.row = (this.row + 4) % 5;
    else if (k.code === 'ArrowDown' || k.code === 'KeyS') this.row = (this.row + 1) % 5;
    else if (k.code === 'Enter' || k.code === 'Space') this.close();
    else return false;
    return true;
  }
}

// ---------------------------------------------------------------- the desk
// An astrolabe of three brass rings, each with eight glyphs round it and
// one of them marked. The rings drift; you turn one at a time (and the one
// inside it turns half as far the other way). When all three marks sit
// under the pointer at once, the thought comes clear: record it before
// the candle burns down.
const RING_R = [62, 46, 30];
const GLYPHS = 8;
const STEP = (Math.PI * 2) / GLYPHS;
const WINDOW = 0.17;

export class ResearchWindow extends Window {
  constructor(ui, game, s) {
    super(ui, 64, 34, { kind: 'research' });
    this.game = game;
    this.s = s;
    this.t = 0;
    this.insights = 0;
    this.fx = [];
    this.newPuzzle();
  }
  newPuzzle() {
    const R = () => Math.random();
    this.rings = RING_R.map((r, i) => ({
      r,
      rot: R() * Math.PI * 2,
      speed: (R() < 0.5 ? -1 : 1) * (0.05 + R() * 0.07) * (i === 1 ? 1.4 : 1),
      mark: Math.floor(R() * GLYPHS),
      glyphs: Array.from({ length: GLYPHS }, () => Math.floor(R() * 8)),
    }));
    this.sel = 0;
    this.candle = 1;
    this.phase = 'work';
    this.flash = 0;
  }
  // Where a ring's mark sits now (radians off the top).
  off(ring) {
    let a = ring.mark * STEP + ring.rot;
    a = ((a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    return a > Math.PI ? a - Math.PI * 2 : a;
  }
  aligned(ring) {
    return Math.abs(this.off(ring)) <= WINDOW;
  }
  allAligned() {
    return this.rings.every((r) => this.aligned(r));
  }
  update(dt) {
    this.t += dt;
    if (this.flash > 0) this.flash -= dt;
    for (const f of this.fx) {
      f.life -= dt;
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      f.vy += (f.g ?? 30) * dt;
    }
    this.fx = this.fx.filter((f) => f.life > 0);
    if (this.phase !== 'work') return;
    for (const r of this.rings) r.rot += r.speed * dt * (this.allAligned() ? 0.25 : 1);
    this.candle -= dt / 55;
    if (this.candle <= 0) {
      this.candle = 0;
      this.phase = 'out';
      this.ui.msg('The candle gutters out, and the thought escapes you.', C.dim);
      this.burst(0, -70, ['#9a9aa2', '#6a6a72'], 10, 14, -20);
    }
  }
  burst(x, y, colors, n, speed, g = 40) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.3 + Math.random() * 0.7);
      this.fx.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 8, life: 0.6 + Math.random() * 0.6, max: 1.2, c: colors[i % colors.length], g });
    }
  }
  turn(dir) {
    const r = this.rings[this.sel];
    r.rot += dir * STEP * 0.5;
    const inner = this.rings[this.sel + 1];
    if (inner) inner.rot -= dir * STEP * 0.25;
    this.ui.audio?.play('select');
  }
  record() {
    const game = this.game;
    if (!this.allAligned()) {
      // Not yet: a blot of ink, and the candle burns on.
      this.candle = Math.max(0, this.candle - 0.08);
      this.burst(0, 0, ['#1a1a2a', '#2a2a4a'], 8, 30);
      this.ui.audio?.play('error');
      return;
    }
    const pts = 4 + Math.round(this.candle * 4);
    const T = game.sim.tech;
    const st = T.stateOf(this.s);
    const was = st.current;
    const learned = T.addPoints(this.s, pts, game.day);
    // Paid by the town for the work.
    const L = game.sim.layoutOf(this.s.id);
    const pay = L && L.econ.treasury >= 6 ? 6 : 0;
    if (pay) {
      L.econ.treasury -= pay;
      game.player.give('coin', pay);
      const j = game.sim.careers.job;
      if (j) j.earned = (j.earned || 0) + pay;
    }
    this.insights++;
    this.phase = 'insight';
    this.flash = 1.2;
    this.burst(0, 0, ['#fff4b0', '#ffe070', '#ffffff', '#a0d8ff'], 40, 90, 0);
    this.ui.audio?.play('fanfare');
    this.ui.msg(learned ? `Your insight completes the work on ${TECHS[learned].name}!` : `An insight! (+${pts} toward ${was ? TECHS[was].name : 'the realm\'s study'}${pay ? `, ¤${pay}` : ''})`, learned ? '#ffe070' : '#c8e0ff');
  }
  draw(g, game) {
    g.box(0, 0, this.w, this.h, { bg: 'rgba(14,12,20,0.97)', double: true, title: 'THE STUDY' });
    const st = game.sim.tech.stateOf(this.s);
    const t = st.current ? TECHS[st.current] : null;
    g.center(1, t ? `Working on: ${t.name}` : 'Nothing set to study', t ? C.hi : C.dim);
    if (t) g.center(2, `${bar(st.progress / t.cost, 24)} ${pct(st.progress, t.cost)}%`, '#c8a060');
    const status = this.phase === 'out' ? 'The candle is out.  [ENTER] light another'
      : this.phase === 'insight' ? 'It comes clear!  [ENTER] the next problem'
        : this.allAligned() ? 'The marks line up: [SPACE] write it down!' : 'Bring the three gold marks under the pointer';
    g.center(this.h - 4, status, this.phase === 'out' ? C.dim : this.allAligned() || this.phase === 'insight' ? C.hi : C.fg);
    g.center(this.h - 3, `Insights this sitting: ${this.insights}`, C.dim);
    g.text(2, this.h - 1, ' ←→ turn · ↑↓ ring · SPACE record · ESC leave ', C.faint);
  }
  // The desk, the astrolabe, the candle: in pixels.
  drawPixels(ctx) {
    const ox = this.x * CHAR_W;
    const oy = this.y * CHAR_H;
    const W = this.w * CHAR_W;
    const cx = ox + Math.round(W / 2);
    const cy = oy + 3 * CHAR_H + 96;
    const t = this.t;
    const px = (x, y, c, w = 1, h = 1) => {
      ctx.fillStyle = c;
      ctx.fillRect(Math.round(x), Math.round(y), w, h);
    };
    // The desk top (wood grain) behind it all.
    for (let y = cy + 74; y < oy + (this.h - 5) * CHAR_H; y++) px(ox + 8, y, (y >> 1) % 3 ? '#4a3220' : '#563a26', W - 16, 1);
    // The sky inside the rings: deep blue, stars twinkling.
    const SKY = 74;
    for (let y = -SKY; y <= SKY; y++) {
      const half = Math.floor(Math.sqrt(SKY * SKY - y * y));
      const d = Math.abs(y) / SKY;
      px(cx - half, cy + y, `rgb(${Math.round(18 + d * 6)},${Math.round(20 + d * 8)},${Math.round(44 - d * 10)})`, half * 2 + 1, 1);
    }
    for (let i = 0; i < 40; i++) {
      const a = (i * 2.399) % (Math.PI * 2);
      const r = 8 + ((i * 37) % 64);
      const tw = 0.5 + 0.5 * Math.sin(t * 2 + i);
      if (tw > 0.35) px(cx + Math.cos(a) * r, cy + Math.sin(a) * r, tw > 0.8 ? '#ffffff' : '#8a9ac8');
    }
    // Brass rim.
    for (let a = 0; a < Math.PI * 2; a += 0.01) {
      px(cx + Math.cos(a) * (SKY + 1), cy + Math.sin(a) * (SKY + 1), '#c89a3a');
      px(cx + Math.cos(a) * (SKY + 3), cy + Math.sin(a) * (SKY + 3), '#7a5a1e');
    }
    const all = this.allAligned();
    // The rings.
    this.rings.forEach((ring, i) => {
      const sel = i === this.sel;
      const ok = this.aligned(ring);
      const band = sel ? '#f0c060' : ok ? '#d8b860' : '#a07a30';
      const dark = sel ? '#8a6a20' : '#5a4418';
      for (let a = 0; a < Math.PI * 2; a += 1.4 / ring.r) {
        px(cx + Math.cos(a) * (ring.r + 5), cy + Math.sin(a) * (ring.r + 5), dark);
        px(cx + Math.cos(a) * (ring.r - 5), cy + Math.sin(a) * (ring.r - 5), dark);
        // (A bright rim inside the dark one: gold, brighter when chosen or aligned.)
        if (Math.floor(a * ring.r) % 3 === 0) px(cx + Math.cos(a) * (ring.r + 4), cy + Math.sin(a) * (ring.r + 4), band);
        if (sel && Math.sin(a * 6 + t * 3) > 0.92) px(cx + Math.cos(a) * ring.r, cy + Math.sin(a) * ring.r, '#fff4c0');
      }
      for (let k = 0; k < GLYPHS; k++) {
        const a = k * STEP + ring.rot - Math.PI / 2;
        const gx = cx + Math.cos(a) * ring.r;
        const gy = cy + Math.sin(a) * ring.r;
        const mark = k === ring.mark;
        const col = mark ? (ok ? (Math.sin(t * 10) > 0 ? '#c8ffb0' : '#ffe070') : '#ffd040') : sel ? '#c8d0e8' : '#7a88a8';
        glyph(px, ring.glyphs[k], gx, gy, col);
        if (mark) {
          // A glow round the marked one.
          for (const [dx, dy] of [[-3, 0], [3, 0], [0, -3], [0, 3]]) px(gx + dx, gy + dy, ok ? '#a0ff80' : '#8a6a20');
        }
      }
    });
    // The pointer at the top.
    for (let i = 0; i < 6; i++) px(cx - 5 + i, cy - SKY - 10 + i, '#ffe070', 11 - i * 2, 1);
    px(cx, cy - SKY - 4, '#fff4c0', 1, 6);
    // All lined up: light pours out of the centre.
    if (all || this.flash > 0) {
      const k = this.flash > 0 ? this.flash : 0.5 + 0.5 * Math.sin(t * 6);
      ctx.globalAlpha = Math.min(1, k) * 0.6;
      for (let r = 0; r < 12; r++) {
        const a = r * (Math.PI / 6) + t * 0.4;
        for (let d = 6; d < SKY; d += 2) px(cx + Math.cos(a) * d, cy + Math.sin(a) * d, '#fff4c0');
      }
      ctx.globalAlpha = 1;
    }
    // The hub.
    px(cx - 3, cy - 3, '#c89a3a', 7, 7);
    px(cx - 2, cy - 2, '#f0d070', 5, 5);
    px(cx - 1, cy - 1, '#ffffff', 2, 2);
    // The candle, burning down.
    const kx = ox + W - 46;
    const base = cy + 66;
    const hgt = Math.round(10 + this.candle * 60);
    px(kx - 6, base, '#8a7a5a', 16, 3);
    px(kx, base - hgt, '#f0e8d0', 5, hgt);
    px(kx + 4, base - hgt, '#d8ccb0', 1, hgt);
    if (this.phase !== 'out') {
      const fl = Math.sin(t * 13) + Math.sin(t * 7.3);
      // A soft round glow about the flame.
      for (let r = 18; r > 2; r -= 3) {
        ctx.globalAlpha = 0.07 + 0.015 * fl;
        ctx.fillStyle = '#ffb040';
        ctx.beginPath();
        ctx.arc(kx + 2.5, base - hgt - 4, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      px(kx + 1 + (fl > 1 ? 1 : 0), base - hgt - 7, '#ffd060', 3, 6);
      px(kx + 2, base - hgt - 5, '#fff8d0', 1, 3);
      px(kx + 2, base - hgt - 1, '#3a2a1a', 1, 1);
    } else if (Math.floor(t * 3) % 2) px(kx + 2, base - hgt - 4 - ((t * 10) % 6), '#8a8a92');
    // Papers on the desk: notes in a cramped hand, a book or two.
    const nx = ox + 18;
    px(nx, cy + 82, '#e8dcc0', 70, 34);
    px(nx + 2, cy + 84, '#f4ecd8', 66, 30);
    for (let i = 0; i < 6; i++) for (let j = 0; j < 9; j++) if ((i * 7 + j * 3) % 5) px(nx + 6 + j * 7, cy + 88 + i * 4, '#7a6a5a', 4 + ((i + j) % 3), 1);
    px(ox + W - 92, cy + 84, '#6a2a2a', 26, 6);
    px(ox + W - 92, cy + 90, '#2a4a6a', 24, 6);
    px(ox + W - 90, cy + 84, '#c8a060', 1, 12);
    // Ink and quill.
    const ix = ox + 26;
    px(ix, base - 8, '#1a1a2a', 9, 8);
    px(ix + 1, base - 9, '#3a3a5a', 7, 1);
    for (let i = 0; i < 18; i++) px(ix + 4 + i * 0.5, base - 10 - i, i < 4 ? '#e8e0d0' : '#f4f0e4');
    // Sparks and blots.
    for (const f of this.fx) {
      ctx.globalAlpha = Math.max(0, Math.min(1, f.life / (f.max * 0.5)));
      px(cx + f.x, cy + f.y, f.c, 1, 1);
    }
    ctx.globalAlpha = 1;
  }
  onKey(k) {
    if (k.code === 'Escape') this.close();
    else if (this.phase !== 'work') {
      if (k.code === 'Enter' || k.code === 'Space') this.newPuzzle();
      else return true;
    } else if (k.code === 'ArrowLeft' || k.code === 'KeyA') this.turn(-1);
    else if (k.code === 'ArrowRight' || k.code === 'KeyD') this.turn(1);
    else if (k.code === 'ArrowUp' || k.code === 'KeyW') this.sel = (this.sel + 2) % 3;
    else if (k.code === 'ArrowDown' || k.code === 'KeyS') this.sel = (this.sel + 1) % 3;
    else if (k.code === 'Space' || k.code === 'Enter') this.record();
    else return false;
    return true;
  }
}

// Eight little marks for the rings (each 5x5 at most).
function glyph(px, k, x, y, c) {
  x = Math.round(x);
  y = Math.round(y);
  switch (k) {
    case 0: // a dot in a ring
      px(x - 1, y - 2, c, 3, 1); px(x - 1, y + 2, c, 3, 1); px(x - 2, y - 1, c, 1, 3); px(x + 2, y - 1, c, 1, 3); px(x, y, c);
      break;
    case 1: // a crescent moon
      px(x - 1, y - 2, c, 2, 1); px(x - 2, y - 1, c, 1, 3); px(x - 1, y + 2, c, 2, 1); px(x + 1, y - 1, c);
      break;
    case 2: // a cross
      px(x - 2, y, c, 5, 1); px(x, y - 2, c, 1, 5);
      break;
    case 3: // a triangle
      px(x, y - 2, c); px(x - 1, y - 1, c, 3, 1); px(x - 2, y, c, 5, 1); px(x - 2, y + 1, c, 5, 1);
      break;
    case 4: // a star
      px(x, y - 2, c, 1, 5); px(x - 2, y, c, 5, 1); px(x - 1, y - 1, c); px(x + 1, y + 1, c); px(x + 1, y - 1, c); px(x - 1, y + 1, c);
      break;
    case 5: // a wave
      px(x - 2, y, c); px(x - 1, y - 1, c); px(x, y, c); px(x + 1, y + 1, c); px(x + 2, y, c);
      break;
    case 6: // an eye
      px(x - 2, y, c); px(x + 2, y, c); px(x - 1, y - 1, c, 3, 1); px(x - 1, y + 1, c, 3, 1); px(x, y, c);
      break;
    default: // a key
      px(x - 2, y - 1, c, 2, 2); px(x, y, c, 3, 1); px(x + 2, y + 1, c);
  }
}
