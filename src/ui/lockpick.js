// Picking a lock (see game/lockpick.js for how a lock works): the lock cut
// away so you can see into it, a row of chambers each with its spring,
// driver pin and key pin, the shear line across them; your pick in the
// keyway under the pin you're on, the tension wrench at the mouth of it.
//   ←/→ (or the mouse) picks a pin, ↑ (or a click) flicks it up, SPACE (or
//   the right button) turns the plug.
import { CHAR_W, CHAR_H } from '../config.js';
import { Window } from './window.js';
import { C } from './ascii.js';
import { Lock, SHEAR } from '../game/lockpick.js';
import { countItem, removeItem } from '../game/inventory.js';
import { mastery, gainMastery, rankText } from '../game/mastery.js';

const METALS = {
  iron: { body: '#6e6e78', hi: '#a4a4b0', lo: '#40404a', plug: '#5a5a64', trim: '#8a8a96' },
  brass: { body: '#a8822a', hi: '#e8c868', lo: '#6a4e14', plug: '#8e6c22', trim: '#f0d890' },
  steel: { body: '#8a96a4', hi: '#dce4ec', lo: '#4a525e', plug: '#727e8c', trim: '#e0b840' },
};

const SAY = {
  set: ['Click.', 'It catches.', 'One down.', 'Set.'],
  false: ['The plug gives... a false set. That one\'s a spool.', 'A false set: the pin drops back. Again.'],
  loose: ['It springs back: not the one binding.', 'Nothing: another pin\'s binding first.'],
  miss: ['The pick bends: wrong moment.', 'Too early. Or too late.', 'The pick strains.'],
  snap: ['Snap! The pick breaks.'],
};

export class LockWindow extends Window {
  // `spec`: { tier, seed, label, onOpen, watched } (watched(): true when
  // someone can see you at it).
  constructor(ui, game, spec) {
    super(ui, 58, 25, { kind: 'lockpick' });
    this.game = game;
    this.spec = spec;
    this.closeOnOutside = false;
    const h = game.hero;
    const has = (k) => !!h && ((h.traits || []).includes(k) || (h.specialties || []).includes(k));
    this.lock = new Lock(spec.tier, spec.seed, { steady: has('steady_hands'), agi: (h && h.stats && h.stats.agi) || 2, rank: mastery(game, 'lockpick').rank });
    this.sel = 0;
    this.t = 0;
    this.say = { text: this.lock.order ? 'Find the pin that binds: it\'s stiff, and it quivers.' : 'Flick a pin up; turn as its gap meets the line.', color: C.dim, t: 0 };
    this.fx = [];
    this.pickLift = 0;
    this.wrenchT = 0;
    this.watchT = 0;
    this.shake = 0;
  }

  picks() {
    return countItem(this.game.player.inv, 'lockpick');
  }

  draw(g) {
    const L = this.lock;
    g.fill(0, 0, this.w, this.h, ' ', C.fg, '#0c0a10');
    g.box(0, 0, this.w, this.h, { bg: '#0c0a10', double: true, title: 'PICK THE LOCK' });
    const grade = ['a plain iron', 'a sturdy brass', 'a good brass', 'a fine steel'][L.grade.tier - 1];
    g.center(1, `${this.spec.label || 'A chest'} · ${grade} lock`.slice(0, this.w - 4), C.dim);
    // (The lock itself is drawn in pixels: see drawPixels.)
    g.center(17, this.say.text, this.say.color);
    const n = Math.round(L.stress * 12);
    g.text(4, 19, 'Strain', C.dim);
    g.text(11, 19, '■'.repeat(n) + '·'.repeat(12 - n), n > 8 ? C.red : n > 4 ? C.orange : C.green);
    g.text(30, 19, `Lockpicks: ${this.picks()}`, this.picks() ? C.fg : C.red);
    const done = L.pins.filter((p) => p.set).length;
    g.text(46, 19, `Set ${done}/${L.pins.length}`, done ? C.hi : C.dim);
    g.text(4, 20, rankText(this.game, 'lockpick', 6), '#8a6a40');
    g.center(21, '←→ pin · ↑ flick it up · SPACE turn the plug · ESC stop', C.faint);
    g.center(22, 'or: click a pin to flick it, right-click to turn', C.faint);
    // A pin's column, to click.
    const lay = this.layout();
    L.pins.forEach((_, i) => {
      const cx = Math.floor((lay.px0 + i * lay.step - this.x * CHAR_W) / CHAR_W);
      this.hit(cx - 1, 3, 4, 13, (ck) => {
        this.sel = i;
        if (ck && ck.button === 2) this.turn();
        else this.flick();
      });
    });
  }

  // Where things go, in pixels.
  layout() {
    const n = this.lock.pins.length;
    const W = this.w * CHAR_W;
    const ox = this.x * CHAR_W;
    const oy = this.y * CHAR_H;
    const step = Math.min(36, Math.floor(210 / n));
    const left = 44;
    const bodyW = left + n * step + 16;
    const x0 = ox + Math.round((W - bodyW) / 2);
    const shearY = oy + 3 * CHAR_H + 48;
    return { ox, oy, W, step, x0, bodyW, px0: x0 + left + 8, shearY, top: shearY - 44, bot: shearY + 58 };
  }

  drawPixels(ctx) {
    const L = this.lock;
    const lay = this.layout();
    const { x0, bodyW, shearY, top, bot, step } = lay;
    const M = METALS[L.metal] || METALS.brass;
    const t = this.t;
    const R = (x, y, w, h, c) => {
      ctx.fillStyle = c;
      ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
    };
    const sh = this.shake > 0 ? Math.round((Math.random() - 0.5) * 3 * this.shake * 4) : 0;
    ctx.save();
    ctx.translate(sh, 0);
    // A pool of lamplight on dark wood behind it.
    const cx = x0 + bodyW / 2;
    const cy = (top + bot) / 2;
    const glow = ctx.createRadialGradient(cx, cy, 10, cx, cy, bodyW * 0.75);
    glow.addColorStop(0, 'rgba(90,64,34,0.55)');
    glow.addColorStop(1, 'rgba(20,14,10,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(x0 - 40, top - 20, bodyW + 80, bot - top + 40);
    // The housing: a block of metal, bevelled; rivets at its corners and an
    // engraved line round it.
    R(x0, top, bodyW, shearY - top, M.body);
    R(x0, top, bodyW, 2, M.hi);
    R(x0, top, 2, shearY - top, M.hi);
    R(x0 + bodyW - 2, top, 2, shearY - top, M.lo);
    ctx.globalAlpha = 0.5;
    R(x0 + 5, top + 5, bodyW - 10, 1, M.lo);
    R(x0 + 5, top + 5, 1, shearY - top - 8, M.lo);
    R(x0 + bodyW - 6, top + 5, 1, shearY - top - 8, M.hi);
    ctx.globalAlpha = 1;
    for (const [rx, ry] of [[x0 + 8, top + 9], [x0 + bodyW - 11, top + 9]]) {
      R(rx, ry, 3, 3, M.lo);
      R(rx, ry, 2, 2, M.hi);
    }
    if (L.metal === 'steel') {
      // (A fine one: gold filigree along its top.)
      for (let x = x0 + 14; x < x0 + bodyW - 14; x += 6) {
        R(x, top + 3, 3, 1, M.trim);
        R(x + 1, top + 2 + ((x / 6) % 2 ? 0 : 2), 1, 1, M.trim);
      }
    }
    // The plug: a cylinder seen side on (shaded round). As it turns (a
    // little under the wrench, all the way when it opens) its half of each
    // chamber slides out of line with the housing's.
    const turn = L.open ? Math.min(1, (t - (this.openAt ?? t)) * 2.5) : L.turn;
    const slide = L.open ? Math.round(turn * 6) : Math.round(turn * 1.5);
    const plugTop = shearY + 1;
    const plugH = bot - shearY - 9;
    for (let y = 0; y < plugH; y++) {
      const k = y / plugH;
      const f = 0.62 + 0.58 * Math.sin(Math.PI * (k * 0.9 + 0.1));
      ctx.fillStyle = shade(M.plug, f);
      ctx.fillRect(x0 + 6, plugTop + y, bodyW - 12, 1);
    }
    // Its face at the left, round, a keyhole in it.
    R(x0 - 8, plugTop - 3, 16, plugH + 6, M.lo);
    R(x0 - 6, plugTop - 1, 12, plugH + 2, M.body);
    R(x0 - 6, plugTop - 1, 12, 1, M.hi);
    R(x0 - 3, plugTop + 8, 6, 6, '#120c06');
    R(x0 - 2, plugTop + 7, 4, 8, '#120c06');
    R(x0 - 1, plugTop + 14, 2, plugH - 18, '#120c06');
    // The keyway, along the bottom of the plug.
    const keyY = plugTop + plugH - 15;
    R(x0 + 6, keyY, bodyW - 12, 7, '#140e08');
    R(x0 + 6, keyY, bodyW - 12, 1, '#2a1e12');
    R(x0 + 6, keyY + 7, bodyW - 12, 1, shade(M.plug, 1.25));
    // The shear line, where the plug meets the housing: a dark seam, lit
    // below.
    R(x0 + 6, shearY - 1, bodyW - 12, 1, shade(M.body, 0.4));
    R(x0 + 6, shearY, bodyW - 12, 1, shade(M.plug, 1.35));
    // Each chamber: drilled through the housing and the plug; a spring, a
    // driver pin over a key pin, the gap between them on the shear line
    // when it's at the right height.
    const sel = this.sel;
    // (A key pin rests with its point down in the keyway; lifted till its
    // top meets the shear line, it's at SHEAR of the way.)
    const keyLenOf = (p) => Math.round(10 + p.cut * 32);
    const gapOf = (p) => {
      const rest = keyY + 4 - keyLenOf(p);
      return p.set || L.open ? shearY : rest - p.h * ((rest - shearY) / SHEAR);
    };
    L.pins.forEach((p, i) => {
      const qx = (p.quiver > 0 ? Math.round(Math.sin(t * 90) * 1.5) : 0);
      const x = lay.px0 + i * step + qx;
      const cTop = top + 8;
      const cBot = keyY;
      // (Your light on the one you're at.)
      if (i === sel && !L.open) {
        ctx.globalAlpha = 0.16 + 0.06 * Math.sin(t * 4);
        R(x - 8, top + 2, 26, keyY - top + 8, '#ffe8a0');
        ctx.globalAlpha = 1;
      }
      // The bore: in the housing, and (slid round with the plug) below.
      R(x - 1, cTop, 12, shearY - 1 - cTop, '#120c08');
      R(x - 1, cTop, 1, shearY - 1 - cTop, '#24180e');
      R(x - 1 + slide, shearY + 1, 12, cBot - shearY - 1, '#120c08');
      R(x - 1 + slide, shearY + 1, 1, cBot - shearY - 1, '#24180e');
      const gapY = gapOf(p);
      const keyLen = keyLenOf(p);
      // Spring, squeezed as the pins go up.
      const drvTop = gapY - 16;
      const sTop = cTop + 1;
      const sLen = Math.max(4, drvTop - sTop);
      for (let k = 0; k < sLen; k++) {
        const ph = (k / sLen) * 7 * Math.PI;
        const sx = x + 5 + Math.round(Math.sin(ph) * 3);
        R(sx, sTop + k, 1, 1, k % 2 ? '#9a9aa6' : '#d0d0dc');
      }
      // Driver pin (above the gap): silver; gold-edged once it's set.
      R(x + 1, drvTop, 8, 16, '#b8bcc8');
      R(x + 1, drvTop, 2, 16, '#eef2fa');
      R(x + 8, drvTop, 1, 16, '#6e7280');
      R(x + 1, drvTop, 8, 1, '#dce0ea');
      if (p.set) R(x + 1, drvTop + 15, 8, 1, '#ffd860');
      if (p.spool) {
        // (A spool: waisted in the middle.)
        R(x + 1, drvTop + 6, 1, 4, '#120c08');
        R(x + 8, drvTop + 6, 1, 4, '#120c08');
      }
      // Key pin (below): brass, pointed at the bottom where the key (or
      // your pick) meets it; carried round with the plug.
      const kx = x + (p.set || L.open ? slide : 0);
      const ky = gapY;
      R(kx + 1, ky, 8, keyLen - 3, '#d8b058');
      R(kx + 1, ky, 2, keyLen - 3, '#f8e0a0');
      R(kx + 8, ky, 1, keyLen - 3, '#9a7430');
      R(kx + 2, ky + keyLen - 3, 6, 2, '#a88034');
      R(kx + 3, ky + keyLen - 1, 4, 1, '#8a6424');
      // The gap meeting the shear line: a glint on the line (fainter on
      // the better locks).
      if (!p.set && L.aligned(i)) {
        ctx.globalAlpha = [0.95, 0.8, 0.55, 0.4][L.grade.tier - 1];
        R(x - 3, shearY - 1, 16, 2, '#fff4c0');
        R(x - 1, shearY - 3, 12, 6, 'rgba(255,240,170,0.3)');
        ctx.globalAlpha = 1;
      }
      if (p.set) {
        // (A tiny star where it caught.)
        const tw = 0.5 + 0.5 * Math.sin(t * 5 + i);
        ctx.globalAlpha = tw;
        R(x + 4, shearY - 4, 1, 7, '#fff8d0');
        R(x + 1, shearY - 1, 7, 1, '#fff8d0');
        ctx.globalAlpha = 1;
      }
    });
    // The tension wrench at the mouth of the keyway: an L of steel, turned a
    // little as you put weight on it.
    const wr = Math.min(1, this.wrenchT / 0.18) + turn;
    const wx = x0 - 16;
    const wy = keyY + 6;
    R(wx, wy - Math.round(wr * 3), 18, 2, '#9aa0ac');
    R(wx, wy - Math.round(wr * 3), 2, 12, '#7a808c');
    R(wx + 16, wy - Math.round(wr * 3) - 1, 3, 3, '#c8ccd8');
    // The pick: in along the keyway to the pin you're at, its hook up under
    // the key pin (lifting on a flick); it bends, and reddens, under strain.
    if (!L.open || t - this.openAt < 0.3) {
      const p = L.pins[sel];
      const tipX = lay.px0 + sel * step + 5;
      const tipY = Math.min(keyY + 4, gapOf(p) + keyLenOf(p)) - Math.round(this.pickLift * 3);
      const bend = L.stress * 4;
      const col = mix('#c8ccd8', '#ff6a50', Math.min(1, L.stress * 1.2));
      const sx = x0 - 46;
      const sy = keyY + 3;
      for (let x = sx; x < tipX - 3; x++) {
        const k = (x - sx) / (tipX - sx);
        const y = sy + Math.sin(k * Math.PI) * bend - (k > 0.85 ? (k - 0.85) / 0.15 * (sy - tipY - 3) * 0.3 : 0);
        R(x, y, 1, 2, col);
      }
      // (The hook, up under the pin.)
      R(tipX - 4, Math.min(sy, tipY + 2), 2, Math.abs(sy - tipY) + 1, col);
      R(tipX - 3, tipY, 4, 2, col);
      // The handle, wrapped.
      R(sx - 20, sy - 2, 20, 6, '#5a3a22');
      for (let k = 0; k < 20; k += 3) R(sx - 20 + k, sy - 2, 1, 6, '#3a2414');
    }
    // Sparks and shards.
    for (const f of this.fx) {
      ctx.globalAlpha = Math.max(0, f.life / f.max);
      R(f.x, f.y, f.s, f.s, f.c);
    }
    ctx.globalAlpha = 1;
    // Open: light through the gap as the plug turns.
    if (L.open) {
      const k = Math.min(1, (t - this.openAt) * 2);
      ctx.globalAlpha = 0.35 * k;
      R(x0 + 6, shearY - 2, bodyW - 12, 3, '#fff0b0');
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  burst(x, y, colors, n = 10, speed = 40) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.4 + Math.random() * 0.6);
      this.fx.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 15, life: 0.4 + Math.random() * 0.4, max: 0.8, c: colors[i % colors.length], s: Math.random() < 0.3 ? 2 : 1 });
    }
  }

  tell(kind, color) {
    const list = SAY[kind];
    if (list) this.say = { text: list[Math.floor(Math.random() * list.length)], color, t: this.t };
  }

  flick() {
    const L = this.lock;
    if (L.open || this.gone) return;
    const r = L.flick(this.sel);
    if (!r) return;
    this.pickLift = 1;
    this.ui.audio?.play(r === 'stiff' ? 'pick_bind' : 'pick_tick');
  }

  turn() {
    const L = this.lock;
    if (L.open || this.gone) return;
    const r = L.tension(this.sel);
    this.wrenchT = 0.18;
    const lay = this.layout();
    const x = lay.px0 + this.sel * lay.step + 5;
    const a = this.ui.audio;
    if (r === 'set' || r === 'open') {
      a?.play('pick_set');
      this.burst(x, lay.shearY, ['#fff4b0', '#ffd040', '#ffffff'], 10, 40);
      this.tell('set', C.green);
      // (On to the next pin not yet set.)
      const nx = L.pins.findIndex((p, i) => !p.set && i > this.sel);
      if (nx >= 0) this.sel = nx;
    }
    if (r === 'false') {
      a?.play('pick_bind');
      this.shake = 0.15;
      this.tell('false', C.orange);
    } else if (r === 'loose') {
      a?.play('pick_tick');
      this.tell('loose', C.dim);
    } else if (r === 'miss') {
      a?.play('pick_strain');
      this.shake = 0.12;
      this.tell('miss', C.orange);
    } else if (r === 'snap') {
      a?.play('pick_snap');
      this.shake = 0.3;
      this.burst(x - 10, lay.shearY + 40, ['#c8ccd8', '#8a8e9a', '#ffffff'], 14, 50);
      removeItem(this.game.player.inv, 'lockpick', 1);
      if (this.picks() <= 0) {
        this.say = { text: 'Snap! That was your last pick.', color: C.red, t: this.t };
        this.gone = 'out';
        this.endAt = this.t;
      } else this.tell('snap', C.red);
    }
    if (r === 'open') {
      this.openAt = this.t;
      gainMastery(this.game, 'lockpick', L.grade.tier);
      this.say = { text: 'The plug turns. It\'s open!', color: C.hi, t: this.t };
      a?.play('unlock');
      this.burst(lay.x0 + lay.bodyW / 2, lay.shearY, ['#fff4b0', '#ffd040', '#ffffff', '#f0c060'], 30, 70);
    }
  }

  update(dt, game) {
    this.t += dt;
    const L = this.lock;
    L.update(dt);
    if (this.pickLift > 0) this.pickLift = Math.max(0, this.pickLift - dt * 8);
    if (this.wrenchT > 0) this.wrenchT -= dt;
    if (this.shake > 0) this.shake -= dt;
    for (const f of this.fx) {
      f.life -= dt;
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      f.vy += 90 * dt;
    }
    this.fx = this.fx.filter((f) => f.life > 0);
    if (L.open && this.t - this.openAt > 0.9 && !this.done) {
      this.done = true;
      this.close();
      this.spec.onOpen?.();
      return;
    }
    if (this.gone && this.t - this.endAt > 1.4) {
      this.close();
      return;
    }
    // Someone coming: out with the pick, and away from it.
    this.watchT += dt;
    if (!L.open && !this.gone && this.watchT > 0.5) {
      this.watchT = 0;
      if (this.spec.watched && this.spec.watched(game || this.game)) {
        this.gone = 'seen';
        this.endAt = this.t;
        this.say = { text: 'Someone\'s coming! You slip the pick out.', color: C.red, t: this.t };
        this.ui.msg('Someone\'s coming! You slip the pick out of the lock.', '#ffb080', true);
      }
    }
  }

  onKey(k) {
    const n = this.lock.pins.length;
    if (k.code === 'Escape') this.close();
    else if (k.code === 'ArrowLeft' || k.code === 'KeyA') this.sel = (this.sel + n - 1) % n;
    else if (k.code === 'ArrowRight' || k.code === 'KeyD') this.sel = (this.sel + 1) % n;
    else if (k.code === 'ArrowUp' || k.code === 'KeyW') this.flick();
    else if (k.code === 'Space' || k.code === 'Enter' || k.code === 'ArrowDown' || k.code === 'KeyS') this.turn();
    return true;
  }
}

function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, Math.round(((n >> 16) & 255) * f)));
  const g = Math.max(0, Math.min(255, Math.round(((n >> 8) & 255) * f)));
  const b = Math.max(0, Math.min(255, Math.round((n & 255) * f)));
  return `rgb(${r},${g},${b})`;
}

function mix(a, b, k) {
  const A = parseInt(a.slice(1), 16);
  const B = parseInt(b.slice(1), 16);
  const ch = (s) => Math.round(((A >> s) & 255) * (1 - k) + ((B >> s) & 255) * k);
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}

export { SHEAR };
