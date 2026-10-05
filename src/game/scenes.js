// Short scenes played in the middle of things: a Kavorent spire opening,
// a master of an old place rising to meet you, and its fall. Each runs on
// the real clock for a few seconds (see Game.update): it can hold you
// still, slow the world, take the camera somewhere (focus, zoom), set the
// music, and draw over the view (bars top and bottom, a line of words).
//
//   { kind, t, dur, lock, mood, zoom, focus(), timeScale(t),
//     update(game, dt), end(game), draw(ctx, game) }
import { VIEW_W, VIEW_H, TILE, LH } from '../config.js';
import { drawText, textWidth } from '../render/font.js';
import { FY } from '../world/dungeongen.js';
import { BLOCKS } from '../world/blocks.js';
import { bossTint } from '../render/bossart.js';
import { humanoidSheet, frameGlow, CHAR_W, SHEET_H } from '../render/sprites.js';
import { GLYPHS, glyph } from '../render/oldplaces.js';

export { bossTint };

const ease = (k) => k * k * (3 - 2 * k);
const clamp01 = (k) => Math.max(0, Math.min(1, k));
const lerp = (a, b, k) => a + (b - a) * k;

// Black bars in from the top and bottom, a caption in the lower one.
function letterbox(ctx, sc, caption, color = '#e8e0d0') {
  const inK = ease(clamp01(sc.t / 0.6));
  const outK = ease(clamp01((sc.dur - sc.t) / 0.6));
  const h = Math.round(26 * Math.min(inK, outK));
  if (h <= 0) return;
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, VIEW_W, h);
  ctx.fillRect(0, VIEW_H - h, VIEW_W, h);
  if (caption && h > 16) {
    ctx.globalAlpha = clamp01((h - 16) / 10);
    drawText(ctx, caption, Math.round(VIEW_W / 2 - textWidth(caption) / 2), VIEW_H - h + 9, color, '#000');
    ctx.globalAlpha = 1;
  }
}

// ------------------------------------------------------------ the spire
// A cut stone set in a spire's keystone: it sinks in; the runes quicken
// and burn every colour; the face before you comes apart into light; a
// swelling note; and the beacon at the top bursts out full, the camera
// drawn back and up the spire to see it.
export function spireOpening(game, rec, side, gemColor) {
  const p = game.player;
  const [ox, oz] = [[0, 2], [-2, 0], [0, -2], [2, 0]][side];
  const site = game.sim.dungeons.site(rec);
  const h = site && site.h ? site.h : 5;
  const top = h + 12;
  return {
    kind: 'spire', rec, side, gemColor, t: 0, dur: 8, lock: true,
    door: { x: rec.x + ox, z: rec.z + oz },
    OPEN_AT: 1.4, BURST_AT: 4.4,
    get mood() {
      // (Its own music as it wakes, a theremin over the rite; open, the
      // spire's own song.)
      return this.t < this.BURST_AT ? 'cs_spire' : 'spire_open';
    },
    // (From however far drawn back the camera already was, out to see the
    // spire whole, and smoothly back: never a jump.)
    z0: game.renderer ? game.renderer.zoom || 1 : 1,
    get zoom() {
      const peak = Math.max(this.z0, 1.6);
      return lerp(this.z0, peak, ease(clamp01(this.t / 2.4)) * (1 - ease(clamp01((this.t - 6.4) / 1.6))));
    },
    focus() {
      // Up the spire to its crown as it wakes, and back down after.
      const up = ease(clamp01((this.t - 1) / 2.6)) * (1 - ease(clamp01((this.t - 6.2) / 1.6)));
      const k = ease(clamp01(this.t / 1.2)) * (1 - ease(clamp01((this.t - 6.8) / 1.2)));
      return { x: lerp(p.x, rec.x, k * 0.6), y: lerp(p.y, top, up), z: lerp(p.z, rec.z, k * 0.6) };
    },
    update(g, dt) {
      const r = g.renderer;
      if (!this.started) {
        this.started = true;
        g.audio?.play('rune');
        g.audio?.play('riser');
        g.ui.msg('The stone sinks into the hollow. Light runs out from it through the spire\'s face...', '#c8fbff');
      }
      // The face coming apart into light.
      if (this.t >= this.OPEN_AT && !this.opened) {
        this.opened = true;
        g.sim.dungeons.openSpire(rec, side);
        g.audio?.play('gate');
        g.audio?.play('drone');
      }
      if (this.opened && this.t < this.BURST_AT && Math.random() < dt * 40) {
        r.emit(this.door.x + (Math.random() - 0.5), h + 1 + Math.random() * 2, this.door.z + (Math.random() - 0.5), { n: 1, color: ['#5ad8f0', '#ffffff', gemColor || '#c8fbff'], up: 20, speed: 30, life: 0.8, glow: true, gravity: -20 });
      }
      g.shake = Math.max(g.shake || 0, this.t < this.BURST_AT ? 0.12 + 0.25 * clamp01(this.t / this.BURST_AT) : 0);
      // The beacon bursts out.
      if (this.t >= this.BURST_AT && !this.burst) {
        this.burst = true;
        r.spireFlare = { id: rec.id, t: 0 };
        r.flashScreen?.('#e8fcff', 0.7);
        g.shake = 1.4;
        g.audio?.play('boom');
        g.audio?.play('thunder');
        g.audio?.play('fanfare');
        for (let i = 0; i < 3; i++) r.effect?.({ type: 'ring', wx: rec.x, wy: h + 1, wz: rec.z, r0: 8 + i * 6, r1: 120 + i * 40, color: ['#5ad8f0', '#ffffff', gemColor || '#c8fbff'], life: 1.0 + i * 0.3, oy: 4, flat: 0.5, thick: 3 });
      }
    },
    end(g) {
      g.ui.msg('The spire stands open, its beacon blazing into the sky. Inside, a lift waits.', '#c8fbff');
    },
    draw(ctx) {
      // A white bloom over everything as it bursts.
      if (this.t >= this.BURST_AT && this.t < this.BURST_AT + 1) {
        ctx.globalAlpha = 0.35 * (1 - (this.t - this.BURST_AT));
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, VIEW_W, VIEW_H);
        ctx.globalAlpha = 1;
      }
      letterbox(ctx, this, this.t < this.BURST_AT ? 'The spire wakes.' : 'Its way stands open.', '#c8fbff');
    },
  };
}

// The doorway's face coming apart, for the renderer: 0 whole, 1 gone.
export function spireDissolve(sc) {
  if (!sc || sc.kind !== 'spire' || sc.t < sc.OPEN_AT) return 0;
  return clamp01((sc.t - sc.OPEN_AT) / (sc.BURST_AT - sc.OPEN_AT - 0.3));
}

// ------------------------------------------------------------ the masters
// Into its hall: the camera goes to it as it rises (its braziers flaring
// up one after another), a roar, its name across the screen; then back to
// you, and the fight's on.
export function bossEntrance(game, run, boss) {
  const p = game.player;
  const lead = boss[0];
  return {
    kind: 'boss_in', t: 0, dur: 3.6, lock: true, boss, run,
    get mood() {
      return `dungeon_${run.rec.type}_boss:p1`;
    },
    get zoom() {
      return 1 - 0.18 * ease(clamp01((this.t - 0.4) / 1)) * (1 - ease(clamp01((this.t - 2.8) / 0.8)));
    },
    focus() {
      const k = ease(clamp01(this.t / 0.9)) * (1 - ease(clamp01((this.t - 2.6) / 1)));
      const lr = lead.renderPos ? lead.renderPos() : lead;
      return { x: lerp(p.x, lr.x, k), y: lerp(p.y, lr.y, k), z: lerp(p.z, lr.z, k) };
    },
    update(g) {
      const r = g.renderer;
      // The hall's fires catching, one after another, as it wakes.
      const fires = (this.fires ||= hallFires(g, run));
      const n = Math.floor(clamp01((this.t - 0.3) / 1.4) * fires.length);
      for (let i = this.lit || 0; i < n; i++) {
        const f = fires[i];
        r.emit(f.x, FY + 1, f.z, { n: 12, color: ['#ffb040', '#ffe070', '#ffffff'], up: 40, speed: 30, life: 0.6, glow: true });
        g.audio?.play('torch', f);
      }
      this.lit = Math.max(this.lit || 0, n);
      if (this.t > 1.1 && !this.roared) {
        this.roared = true;
        g.audio?.play('roar', lead);
        g.shake = Math.max(g.shake || 0, 0.9);
        r.effect?.({ type: 'ring', wx: lead.x, wy: lead.y, wz: lead.z, r0: 6, r1: 70, color: ['#ff6040', '#ffffff'], life: 0.7, oy: 2, flat: 0.5, thick: 2 });
        for (const c of boss) r.emit(c.x, c.y + 1.2, c.z, { n: 24, color: bossTint(c), up: 40, speed: 60, life: 0.8, glow: true });
      }
    },
    draw(ctx) {
      letterbox(ctx, this, null);
    },
  };
}

// Where a master's hall has its fires (to catch in turn as it wakes).
function hallFires(game, run) {
  const br = run.data.bossRoom;
  const out = [];
  if (!br) return out;
  for (let z = br.z0; z <= br.z1; z++) {
    for (let x = br.x0; x <= br.x1; x++) {
      const id = game.world.getBlock(x, FY, z);
      if (id && ['brazier', 'candles', 'kav_glow'].includes(BLOCKS[id].name)) out.push({ x, z });
    }
  }
  return out.sort((a, b) => Math.hypot(a.x - br.x0, a.z - br.z0) - Math.hypot(b.x - br.x0, b.z - br.z0));
}

// Its fall: the world slowed to a crawl, the camera on it as it comes
// apart in its own light, a flash, the words, the fanfare.
export function bossDefeat(game, run, boss) {
  const p = game.player;
  const at = { x: boss.x, y: boss.y, z: boss.z };
  const tint = bossTint(boss);
  return {
    kind: 'boss_down', t: 0, dur: 4.2, lock: true, at, tint, ghost: boss,
    // (A slow fanfare, the gong: see music.js.)
    mood: 'cs_victory',
    timeScale(t) {
      return t < 1.6 ? 0.18 : t < 2.4 ? 0.5 : 1;
    },
    get zoom() {
      return 1 - 0.22 * ease(clamp01(this.t / 0.8)) * (1 - ease(clamp01((this.t - 3) / 1.2)));
    },
    focus() {
      const k = ease(clamp01(this.t / 0.6)) * (1 - ease(clamp01((this.t - 3) / 1.2)));
      return { x: lerp(p.x, at.x, k), y: lerp(p.y, at.y, k), z: lerp(p.z, at.z, k) };
    },
    update(g) {
      const r = g.renderer;
      if (!this.started) {
        this.started = true;
        g.audio?.play('roar', at);
        g.audio?.play('sting');
      }
      // (It's drawn a while yet, flickering white and fading: see
      // Renderer.drawEntity.)
      boss.dying = clamp01(this.t / 2);
      // Coming apart: its light pouring out of it.
      if (this.t < 2.2 && Math.random() < 0.9) r.emit(at.x + (Math.random() - 0.5), at.y + 0.5 + Math.random() * 1.6, at.z + (Math.random() - 0.5), { n: 2, color: tint, up: 30, speed: 30, life: 0.9, glow: true, gravity: -30 });
      if (this.t >= 1.7 && !this.flashed) {
        this.flashed = true;
        r.flashScreen?.('#fff4c8', 0.6);
        g.shake = 1.4;
        g.audio?.play('boom', at);
        for (let i = 0; i < 3; i++) r.effect?.({ type: 'ring', wx: at.x, wy: at.y, wz: at.z, r0: 4 + i * 4, r1: 80 + i * 30, color: [tint[0], '#ffffff'], life: 0.8 + i * 0.25, oy: 2, flat: 0.5, thick: 3 });
        r.emit(at.x, at.y + 1, at.z, { n: 60, color: [...tint, '#ffffff'], up: 70, speed: 110, life: 1.2, glow: true });
      }
      if (this.t >= 2.2 && !this.cheered) {
        this.cheered = true;
        g.audio?.play('victory');
      }
    },
    draw(ctx) {
      letterbox(ctx, this, null);
    },
  };
}

// ------------------------------------------------------------ a bout
// A friendly bout's end: the last blow lands slow, the one beaten goes down
// on one knee, the winner says their piece and goes on their way, and the
// one on their knees takes a few seconds to get up. (No more blows land
// between you meanwhile: see Game.damage and duelAfter.)
// (With another player for `npc`, see bout.js: `opts.name`, theirs; `me`,
// whose scene it is; `quiet`, the going down done already.)
export function duelYield(game, npc, won, opts = {}) {
  const p = opts.me || game.player;
  const loser = won ? npc : p;
  const winner = won ? p : npc;
  const name = opts.name || npc.name;
  return {
    kind: 'yield', t: 0, dur: 3, lock: true, npc, won, foeName: name,
    timeScale(t) {
      return t < 0.45 ? 0.3 : 1;
    },
    get zoom() {
      return 1 - 0.12 * ease(clamp01(this.t / 0.5)) * (1 - ease(clamp01((this.t - 2.3) / 0.7)));
    },
    focus() {
      const k = 0.5 * ease(clamp01(this.t / 0.5)) * (1 - ease(clamp01((this.t - 2.3) / 0.7)));
      const a = p.renderPos ? p.renderPos() : p;
      const b = npc.renderPos ? npc.renderPos() : npc;
      return { x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k), z: lerp(a.z, b.z, k) };
    },
    update(g) {
      const r = g.renderer;
      if (!this.down) {
        this.down = true;
        if (opts.quiet) return;
        loser.kneelT = won ? 5.5 : 4.5;
        g.audio?.play('thud', loser);
        r.emit(loser.x, loser.y + 0.2, loser.z, { n: 10, color: ['#c8b898', '#8a7a60'], up: 14, speed: 24, life: 0.5 });
        r.floatText(loser.x, loser.y + 2.4, loser.z, won ? 'yields!' : 'you yield', '#ffe070');
        if (npc.face) npc.face(p.x, p.z);
      }
      // (Another player says what they like: only a townsperson's words.)
      if (this.t > 0.7 && !this.said && npc.kind === 'npc' && npc.rng) {
        this.said = true;
        if (won) npc.say?.(npc.rng.pick(['I yield! I yield. Well fought.', 'Enough... you have me.', 'Ha... down I go. You win.']), 3, '#a0ffa0');
        else npc.say?.(npc.rng.pick(['Stay down, friend. That\'s the bout.', 'Yield, and we\'re done. Good fight.', 'Up when you\'re ready. No shame in it.']), 3, '#ffe070');
      }
      // The winner turns away and goes about their business.
      if (!won && this.t > 1.6 && !this.off) {
        this.off = true;
        npc.walkAway?.(p, 6);
      }
    },
    end(g) {
      if (won) g.ui.msg(`${name} is on one knee. Leave them to get their breath back.`, '#c8d8ff');
      else g.ui.msg('You get your breath back...', '#c8d8ff');
    },
    draw(ctx) {
      letterbox(ctx, this, winner === p ? 'You win the bout' : `${name} wins the bout`, won ? '#a0ffa0' : '#ffb080');
    },
  };
}

// ------------------------------------------------------------ the lift
// A Kavorent lift isn't a step through a door: it's a ride. The world
// round you falls away into the dark of its shaft, and you stand on its
// platform (three paces by three, plated, its seams lit) as it sinks (or
// climbs): the shaft's walls sliding past, rails to either side, bands of
// light rushing by, a whole floor's slab going past half way; then it
// slows, settles with a clunk, and the floor you've come to opens out
// round you. `act` is the going there itself (done halfway, in the dark).
export const LIFT = { dur: 5.4, IN: 0.8, SWAP: 2.6, OUT: 4.5, TOP: 270 };
export function liftRide(game, dir, act, label = '') {
  return {
    kind: 'lift', t: 0, dur: LIFT.dur, lock: true, dir, act, label, travel: 0, passed: 0,
    // How fast it's going (px a second, on the shaft's walls).
    speed(t) {
      if (t < LIFT.IN || t > LIFT.OUT) return 0;
      const up = ease(clamp01((t - LIFT.IN) / 0.9));
      const down = ease(clamp01((LIFT.OUT - t) / 1.0));
      return LIFT.TOP * Math.min(up, down);
    },
    // The shaft over the world: in, held, out.
    get cover() {
      if (this.t < LIFT.IN) return ease(clamp01(this.t / LIFT.IN));
      if (this.t > LIFT.OUT) return 1 - ease(clamp01((this.t - LIFT.OUT) / (this.dur - LIFT.OUT)));
      return 1;
    },
    update(g, dt) {
      const p = g.player;
      if (!this.started) {
        this.started = true;
        p.sitting = null;
        g.queuedBlow = null;
        g.audio?.play('clank');
        g.audio?.play('lift_go');
      }
      const v = this.speed(this.t);
      this.travel += v * dt;
      // A band of light rushing past (every 150 px of shaft).
      const n = Math.floor(this.travel / 150);
      if (n > this.passed) {
        this.passed = n;
        g.audio?.play('whoosh');
      }
      if (v > 40 && Math.random() < dt * 3) g.audio?.play('hum');
      g.shake = Math.max(g.shake || 0, v > 0 ? 0.04 + 0.08 * (v / LIFT.TOP) : 0);
      // Halfway, in the dark: there.
      if (this.t >= LIFT.SWAP && !this.swapped) {
        this.swapped = true;
        this.act?.();
        g.renderer.camInit = false;
        g.lightDirty = true;
      }
      if (this.t >= LIFT.OUT - 0.55 && !this.slowing) {
        this.slowing = true;
        g.audio?.play('lift_stop');
      }
      // Down (or up): a clunk, dust and sparks off its edges.
      if (this.t >= LIFT.OUT && !this.landed) {
        this.landed = true;
        g.shake = Math.max(g.shake || 0, 0.45);
        const r = g.renderer;
        for (let i = 0; i < 16; i++) {
          const a = (i / 16) * Math.PI * 2;
          r.emit(p.x + Math.cos(a) * 1.6, p.y + 0.1, p.z + Math.sin(a) * 1.6, { n: 1, color: ['#8a8a9a', '#5a5a6a', '#c8fbff'], up: 10, speed: 30, life: 0.7, shape: 'puff' });
        }
        r.emit(p.x, p.y + 0.2, p.z, { n: 14, color: ['#5ad8f0', '#ffffff'], up: 30, speed: 60, life: 0.5, glow: true });
      }
    },
    draw(ctx, g) {
      const a = this.cover;
      if (a <= 0.001) return;
      const r = g.renderer;
      const p = g.player;
      const k = VIEW_W / (r.vw || VIEW_W);
      const rp = p.renderPos();
      const [u, v] = r.toView(rp.x, rp.z);
      const sx = u * TILE - r.camX;
      const fy = v * TILE - rp.y * LH + LH - r.camY;
      const cx = sx + 8;
      const cy = fy + 8;
      const W = r.vw || VIEW_W;
      const H = r.vh || VIEW_H;
      const T = this.t;
      const s = this.dir > 0 ? this.travel : -this.travel;
      ctx.save();
      ctx.globalAlpha = a;
      ctx.scale(k, k);
      // The dark of the shaft.
      ctx.fillStyle = '#04060c';
      ctx.fillRect(0, 0, W, H);
      const L = cx - 44;
      const R = cx + 44;
      // Its back wall: plates of alloy sliding past, glyphs cut in them.
      const PH = 46;
      const off = ((s % PH) + PH) % PH;
      for (let y = -PH - off; y < H + PH; y += PH) {
        const top = Math.round(y);
        ctx.fillStyle = '#161c2c';
        ctx.fillRect(L, top, R - L, PH - 2);
        ctx.fillStyle = '#20283c';
        ctx.fillRect(L + 3, top + 3, R - L - 6, PH - 8);
        ctx.fillStyle = '#0c1018';
        ctx.fillRect(L, top + PH - 2, R - L, 2);
        // (A line of glyphs down the middle, dim.)
        const row = Math.floor((y + off + s) / PH);
        ctx.fillStyle = 'rgba(90,216,240,0.22)';
        for (let i = 0; i < 6; i++) {
          const g2 = (row * 7 + i * 3) & 7;
          ctx.fillRect(cx - 18 + i * 7, top + 18 + (g2 & 3), 3, 1 + (g2 >> 1));
        }
        // Rivets.
        ctx.fillStyle = '#3a4560';
        for (const rx of [L + 5, R - 7]) {
          ctx.fillRect(rx, top + 6, 2, 2);
          ctx.fillRect(rx, top + PH - 10, 2, 2);
        }
      }
      // The side walls, darker, and the rails it rides on.
      for (const [x0, w0] of [[L - 18, 18], [R, 18]]) {
        ctx.fillStyle = '#0a0e16';
        ctx.fillRect(x0, 0, w0, H);
        ctx.fillStyle = '#121828';
        for (let y = -PH - off; y < H + PH; y += PH / 2) ctx.fillRect(x0 + 2, Math.round(y), w0 - 4, PH / 2 - 3);
      }
      for (const rx of [L - 3, R + 1]) {
        ctx.fillStyle = '#2a3448';
        ctx.fillRect(rx, 0, 2, H);
        ctx.fillStyle = `rgba(90,216,240,${0.35 + 0.2 * Math.sin(T * 6)})`;
        ctx.fillRect(rx + (rx < cx ? 1 : 0), 0, 1, H);
      }
      // Bands of light rushing past (and, halfway, a floor's slab).
      const BAND = 150;
      const bo = ((s % BAND) + BAND) % BAND;
      ctx.globalCompositeOperation = 'lighter';
      for (let y = -BAND - bo + H / 2; y < H + BAND; y += BAND) {
        const by = Math.round(y);
        for (let gi = 10; gi >= 1; gi -= 3) {
          ctx.fillStyle = `rgba(90,216,240,${0.05 * a})`;
          ctx.fillRect(L - 18, by - gi, R - L + 36, gi * 2 + 2);
        }
        ctx.fillStyle = `rgba(220,252,255,${0.75 * a})`;
        ctx.fillRect(L - 18, by, R - L + 36, 2);
      }
      ctx.globalCompositeOperation = 'source-over';
      // A floor's slab going past, halfway down (or up).
      const slabK = (T - LIFT.SWAP) * (this.dir > 0 ? -1 : 1);
      const slabY = Math.round(cy + slabK * LIFT.TOP * 1.1);
      if (slabY > -40 && slabY < H + 40) {
        ctx.fillStyle = '#1a2132';
        ctx.fillRect(L - 18, slabY - 14, R - L + 36, 28);
        ctx.fillStyle = '#2c3650';
        ctx.fillRect(L - 18, slabY - 14, R - L + 36, 3);
        ctx.fillStyle = 'rgba(255,190,90,0.8)';
        for (let x = L - 14; x < R + 16; x += 10) ctx.fillRect(x, slabY - 2, 4, 2);
      }
      // The platform: three by three plates, seams lit, lamps at its
      // corners, a ring turning under you.
      const px0 = sx - 16;
      const py0 = fy - 16;
      const pulse = 0.55 + 0.45 * Math.sin(T * 5);
      ctx.fillStyle = '#0c1018';
      ctx.fillRect(px0 - 1, py0 - 1, 50, 50 + 11);
      for (let j = 0; j < 3; j++) {
        for (let i = 0; i < 3; i++) {
          const x = px0 + i * 16;
          const y = py0 + j * 16;
          ctx.fillStyle = (i + j) % 2 ? '#2a3246' : '#262e40';
          ctx.fillRect(x, y, 16, 16);
          ctx.fillStyle = '#343e56';
          ctx.fillRect(x + 1, y + 1, 14, 1);
          ctx.fillStyle = '#1a2030';
          ctx.fillRect(x + 1, y + 14, 14, 1);
        }
      }
      ctx.fillStyle = `rgba(90,216,240,${0.45 + 0.4 * pulse})`;
      for (const q of [16, 32]) {
        ctx.fillRect(px0 + q, py0, 1, 48);
        ctx.fillRect(px0, py0 + q, 48, 1);
      }
      ctx.fillStyle = '#5ad8f0';
      ctx.fillRect(px0, py0, 48, 1);
      for (const [lx, ly] of [[px0 + 1, py0 + 1], [px0 + 45, py0 + 1], [px0 + 1, py0 + 45], [px0 + 45, py0 + 45]]) {
        ctx.fillStyle = Math.floor(T * 4) % 2 ? '#c8fbff' : '#5ad8f0';
        ctx.fillRect(lx, ly, 2, 2);
      }
      // The ring under you.
      for (let i = 0; i < 12; i++) {
        const ang = (i / 12) * Math.PI * 2 + T * 1.6 * this.dir;
        ctx.fillStyle = i % 3 ? 'rgba(90,216,240,0.7)' : '#e0fbff';
        ctx.fillRect(Math.round(cx + Math.cos(ang) * 10), Math.round(cy + Math.sin(ang) * 6), 1, 1);
      }
      // Its front edge, lights along it, and a glow underneath.
      ctx.fillStyle = '#1a2030';
      ctx.fillRect(px0, py0 + 48, 48, 9);
      ctx.fillStyle = '#2c3650';
      ctx.fillRect(px0, py0 + 48, 48, 1);
      for (let i = 0; i < 6; i++) {
        ctx.fillStyle = (Math.floor(T * 8) + i) % 6 === 0 ? '#ffffff' : '#5ad8f0';
        ctx.fillRect(px0 + 4 + i * 8, py0 + 52, 2, 1);
      }
      const glow = ctx.createLinearGradient(0, py0 + 57, 0, py0 + 80);
      glow.addColorStop(0, `rgba(90,216,240,${0.35 * a})`);
      glow.addColorStop(1, 'rgba(90,216,240,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(px0 + 2, py0 + 57, 44, 23);
      // A band going over the platform lights it up.
      for (let y = -BAND - bo + H / 2; y < H + BAND; y += BAND) {
        const d = Math.abs(y - (py0 + 24));
        if (d < 34) {
          ctx.fillStyle = `rgba(200,250,255,${0.22 * (1 - d / 34)})`;
          ctx.fillRect(px0, py0, 48, 57);
        }
      }
      // You, standing on it.
      r.drawEntity(ctx, p, { x: u, y: rp.y, z: v }, g);
      // Streaks of the shaft's dust going past.
      ctx.fillStyle = 'rgba(200,230,255,0.35)';
      const spd = this.speed(T) / LIFT.TOP;
      if (spd > 0.05) {
        for (let i = 0; i < 14; i++) {
          const x = L - 14 + ((i * 53) % (R - L + 28));
          const y = (((i * 97 + s * (1.4 + (i % 3) * 0.3)) % H) + H) % H;
          ctx.fillRect(x, Math.round(this.dir > 0 ? H - y : y), 1, Math.round(3 + spd * 9));
        }
      }
      // The top and bottom of the shaft lost in the dark.
      const vg = ctx.createLinearGradient(0, 0, 0, H);
      vg.addColorStop(0, 'rgba(0,0,0,0.92)');
      vg.addColorStop(0.28, 'rgba(0,0,0,0)');
      vg.addColorStop(0.72, 'rgba(0,0,0,0)');
      vg.addColorStop(1, 'rgba(0,0,0,0.92)');
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
      // Where it's taking you.
      if (this.label) {
        ctx.globalAlpha = a * clamp01((T - 0.6) / 0.5) * clamp01((LIFT.OUT + 0.4 - T) / 0.5);
        const arrow = this.dir > 0 ? 'v' : '^';
        const txt = `${arrow} ${this.label} ${arrow}`;
        drawText(ctx, txt, Math.round(VIEW_W / 2 - textWidth(txt) / 2), VIEW_H - 40, '#a0f4ff', '#000');
        ctx.globalAlpha = 1;
      }
    },
  };
}

// ------------------------------------------------------------ falling
// Fallen: the world slows and goes dark round you till there's nothing but
// you, crumpled where you fell (as you were, in what you wore). Then the
// Kavorent's rite: their glyphs cut themselves in light into the ground
// round you one by one, rings drawn between them, and the circle catches
// and turns, faster and faster, light pouring up out of it; you're lifted,
// slowly, back onto your feet and off the ground, and then white: and you
// stand where you last set your rest. (Enter, Space or R hurries it on.)
export const DEATH = { FALL: 0.7, DARK: 2.6, ETCH: 4.2, RING: 6.0, SPIN: 6.8, RISE: 7.6, FLASH: 10.2, dur: 11.8 };
export function deathRitual(game, cause, below = null) {
  const N = 12;
  return {
    kind: 'death', t: 0, dur: DEATH.dur, lock: true, cause, below, reborn: false, motes: [], sparks: [], etched: 0, spin: 0,
    get mood() {
      return this.t < DEATH.SPIN ? 'death' : 'ritual';
    },
    timeScale(t) {
      return t < DEATH.DARK ? 0.3 : 1;
    },
    // Hurried on: to the rite, then to the end of it.
    skip() {
      if (this.t < DEATH.ETCH - 0.2) this.t = DEATH.ETCH - 0.2;
      else if (this.t < DEATH.FLASH - 0.6) this.t = DEATH.FLASH - 0.6;
    },
    update(g, dt, pressed = []) {
      if (pressed.some((k) => k.code === 'Enter' || k.code === 'NumpadEnter' || k.code === 'Space' || k.code === 'KeyR')) this.skip();
      const T = this.t;
      if (!this.started) {
        this.started = true;
        g.audio?.play('death');
        g.queuedBlow = null;
      }
      // A glyph cut in light, one after another.
      const n = Math.min(N, Math.floor(clamp01((T - DEATH.ETCH) / (DEATH.RING - DEATH.ETCH)) * N + (T >= DEATH.ETCH ? 1 : 0)));
      while (this.etched < n) {
        this.etched++;
        g.audio?.play('etch');
        if (this.etched % 3 === 0) g.audio?.play('rune');
        // (Sparks thrown off as it's cut.)
        const an = ((this.etched - 1) / N) * Math.PI * 2 + this.spin - Math.PI / 2;
        for (let s = 0; s < 10; s++) this.sparks.push({ x: Math.cos(an) * 60, y: Math.sin(an) * 32, vx: (Math.random() - 0.5) * 70, vy: -20 - Math.random() * 60, life: 0.5 + Math.random() * 0.4 });
      }
      for (const q of this.sparks) {
        q.x += q.vx * dt;
        q.y += q.vy * dt;
        q.vy += 160 * dt;
        q.life -= dt;
      }
      this.sparks = this.sparks.filter((q) => q.life > 0);
      if (T >= DEATH.RING && !this.ringed) {
        this.ringed = true;
        g.audio?.play('hum');
        g.audio?.play('drone');
      }
      if (T >= DEATH.SPIN && !this.spun) {
        this.spun = true;
        g.audio?.play('riser');
        g.audio?.play('charge');
      }
      // The circle turning: slow, then faster and faster.
      const sp = T < DEATH.SPIN ? 0 : 0.6 + 7 * ease(clamp01((T - DEATH.SPIN) / (DEATH.FLASH - DEATH.SPIN)));
      this.spin += sp * dt;
      if (T >= DEATH.SPIN && T < DEATH.FLASH) g.shake = Math.max(g.shake || 0, 0.06 + 0.3 * clamp01((T - DEATH.RISE) / (DEATH.FLASH - DEATH.RISE)));
      // Motes of light drawn in toward you, spiralling.
      if (T >= DEATH.RING && T < DEATH.FLASH) {
        const rate = 30 + 120 * clamp01((T - DEATH.SPIN) / 3);
        for (let i = 0; i < Math.floor(rate * dt + Math.random()); i++) this.motes.push({ a: Math.random() * Math.PI * 2, r: 66 + Math.random() * 34, life: 1.4, c: Math.random() < 0.3 ? '#ffffff' : Math.random() < 0.5 ? '#5ad8f0' : '#b07aff' });
      }
      for (const m of this.motes) {
        m.a += dt * (2 + sp * 0.4);
        m.r -= dt * (24 + sp * 6);
        m.life -= dt * 0.9;
      }
      this.motes = this.motes.filter((m) => m.r > 2 && m.life > 0);
      // White: back on your feet where you last set your rest.
      if (T >= DEATH.FLASH && !this.reborn) {
        this.reborn = true;
        g.audio?.play('rebirth');
        g.audio?.play('boom');
        g.respawn();
        g.shake = 0.6;
        const p = g.player;
        g.renderer.emit(p.x, p.y + 1, p.z, { n: 30, color: ['#ffffff', '#c8fbff', '#5ad8f0'], up: 40, speed: 70, life: 0.9, glow: true });
        g.renderer.effect?.({ type: 'ring', wx: p.x, wy: p.y, wz: p.z, r0: 4, r1: 60, color: ['#ffffff', '#5ad8f0'], life: 0.7, oy: 2, flat: 0.5, thick: 2 });
      }
    },
    end(g) {
      if (!this.reborn) {
        this.reborn = true;
        g.respawn();
      }
      g.ui.msg('You wake where you last set your rest, the light of the rite still fading off you.', '#c8fbff');
    },
    // Where you lie, on the screen.
    where(g) {
      const r = g.renderer;
      const p = g.player;
      const k = VIEW_W / (r.vw || VIEW_W);
      const rp = p.renderPos();
      const [u, v] = r.toView(rp.x, rp.z);
      return { k, x: u * TILE - r.camX + 8, y: v * TILE - rp.y * LH + LH - r.camY + 10 };
    },
    draw(ctx, g) {
      const T = this.t;
      const W = VIEW_W;
      const H = VIEW_H;
      // After the white: just the white going, over the world you woke in.
      if (this.reborn) {
        const a = 1 - ease(clamp01((T - DEATH.FLASH - 0.12) / (this.dur - DEATH.FLASH - 0.12)));
        if (a > 0) {
          ctx.globalAlpha = a;
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, W, H);
          ctx.globalAlpha = 1;
        }
        return;
      }
      const { k, x: bx, y: by } = this.where(g);
      const dark = ease(clamp01((T - 0.3) / (DEATH.DARK - 0.3)));
      ctx.save();
      ctx.fillStyle = '#000000';
      ctx.globalAlpha = dark;
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
      ctx.scale(k, k);
      const cx = bx;
      const cy = by;
      const RX = 60;
      const RY = 32;
      // The rite: the ground lit under it, its glyphs, its rings, light up
      // out of it.
      if (T >= DEATH.ETCH) {
        const lit = clamp01((T - DEATH.ETCH) / 1.2) * (0.5 + 0.5 * clamp01((T - DEATH.SPIN) / 2));
        ctx.globalCompositeOperation = 'lighter';
        const gl = ctx.createRadialGradient(cx, cy, 2, cx, cy, RX * 1.5);
        gl.addColorStop(0, `rgba(120,220,255,${0.4 * lit})`);
        gl.addColorStop(0.6, `rgba(120,80,220,${0.18 * lit})`);
        gl.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = gl;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.scale(1, RY / RX);
        ctx.fillRect(-RX * 1.6, -RX * 1.6, RX * 3.2, RX * 3.2);
        ctx.restore();
        // Rings, drawn round as the glyphs finish, then turning.
        const ringK = clamp01((T - DEATH.RING) / 0.8);
        const ring = (rx, ry, rot, dash, col, a) => {
          if (ringK <= 0) return;
          const seg = 64;
          for (let i = 0; i < seg * ringK; i++) {
            if (dash && i % dash === dash - 1) continue;
            const an = (i / seg) * Math.PI * 2 + rot;
            ctx.fillStyle = col;
            ctx.globalAlpha = a;
            ctx.fillRect(Math.round(cx + Math.cos(an) * rx), Math.round(cy + Math.sin(an) * ry), 2, 1);
          }
        };
        ring(RX, RY, this.spin, 0, '#5ad8f0', 0.9);
        ring(RX + 5, RY + 3, -this.spin * 0.6, 4, '#b07aff', 0.7);
        ring(RX * 0.55, RY * 0.55, -this.spin * 1.4, 3, '#c8fbff', 0.85);
        // Spokes between the inner ring and the glyphs.
        if (ringK > 0) {
          ctx.globalAlpha = 0.5 * ringK;
          ctx.fillStyle = '#5ad8f0';
          for (let i = 0; i < 6; i++) {
            const an = (i / 6) * Math.PI * 2 - this.spin * 1.4;
            for (let s = 0.58; s < 0.92; s += 0.06) ctx.fillRect(Math.round(cx + Math.cos(an) * RX * s), Math.round(cy + Math.sin(an) * RY * s), 1, 1);
          }
        }
        // The glyphs, each cut in light as it comes: white-hot, then cooling
        // to the Kavorent's blue; a shaft of light up from each once it
        // turns.
        for (let i = 0; i < this.etched; i++) {
          const an = (i / N) * Math.PI * 2 + this.spin - Math.PI / 2;
          const gx = Math.round(cx + Math.cos(an) * RX - 4);
          const gy = Math.round(cy + Math.sin(an) * RY - 5);
          const born = DEATH.ETCH + (i / N) * (DEATH.RING - DEATH.ETCH);
          const age = T - born;
          const reveal = clamp01(age / 0.25);
          const hot = clamp01(1 - age / 0.9);
          ctx.globalAlpha = 1;
          ctx.save();
          ctx.beginPath();
          ctx.rect(gx - 2, gy - 2, 12, Math.max(1, 14 * reveal));
          ctx.clip();
          ctx.fillStyle = hot > 0.45 ? '#ffffff' : hot > 0.15 ? '#c8fbff' : i % 2 ? '#b07aff' : '#5ad8f0';
          glyph(ctx, (i * 5 + 3) % GLYPHS.length, gx, gy, 2);
          ctx.restore();
          // (The point of light cutting it, and its heat bleeding off.)
          if (reveal < 1) {
            ctx.globalAlpha = 1;
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(gx + 1 + Math.round(Math.sin(age * 60) * 3), gy - 2 + Math.round(14 * reveal), 2, 2);
          }
          if (hot > 0) {
            const hg = ctx.createRadialGradient(gx + 4, gy + 5, 0, gx + 4, gy + 5, 12);
            hg.addColorStop(0, `rgba(255,255,255,${0.55 * hot})`);
            hg.addColorStop(1, 'rgba(90,216,240,0)');
            ctx.globalAlpha = 1;
            ctx.fillStyle = hg;
            ctx.fillRect(gx - 8, gy - 7, 24, 24);
          }
          if (T >= DEATH.SPIN) {
            const beam = clamp01((T - DEATH.SPIN) / 1.5) * (0.55 + 0.45 * Math.sin(T * 9 + i));
            const bg = ctx.createLinearGradient(0, gy - 70, 0, gy + 4);
            bg.addColorStop(0, 'rgba(90,216,240,0)');
            bg.addColorStop(1, `rgba(200,250,255,${0.5 * beam})`);
            ctx.globalAlpha = 1;
            ctx.fillStyle = bg;
            ctx.fillRect(gx + 1, gy - 70, 5, 74);
          }
        }
        // A column of light up through the middle as you're lifted.
        if (T >= DEATH.RISE) {
          const c = ease(clamp01((T - DEATH.RISE) / 1.4));
          const w = 6 + 12 * c + Math.sin(T * 20) * 2 * c;
          const cg = ctx.createLinearGradient(0, -20, 0, cy);
          cg.addColorStop(0, 'rgba(200,250,255,0)');
          cg.addColorStop(1, `rgba(220,252,255,${0.75 * c})`);
          ctx.globalAlpha = 1;
          ctx.fillStyle = cg;
          ctx.fillRect(cx - w, -20, w * 2, cy + 20);
        }
        // Sparks off the glyphs as they're cut.
        for (const q of this.sparks) {
          ctx.globalAlpha = Math.min(1, q.life * 2);
          ctx.fillStyle = q.life > 0.4 ? '#ffffff' : '#ffe0a0';
          ctx.fillRect(Math.round(cx + q.x), Math.round(cy + q.y), 1, 1);
        }
        // Motes spiralling in.
        for (const m of this.motes) {
          ctx.globalAlpha = Math.min(1, m.life * 1.5);
          ctx.fillStyle = m.c;
          ctx.fillRect(Math.round(cx + Math.cos(m.a) * m.r), Math.round(cy - 6 + Math.sin(m.a) * m.r * 0.55), 1, 1);
        }
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1;
      }
      // You: crumpled where you fell, and lifted back up by the rite.
      const p = g.player;
      const sheet = humanoidSheet(p.look);
      const fall = ease(clamp01(T / DEATH.FALL));
      const rise = ease(clamp01((T - DEATH.RISE) / (DEATH.FLASH - DEATH.RISE - 0.6)));
      const tilt = (Math.PI / 2) * fall * (1 - rise);
      const lift = 14 * rise + (rise > 0 ? Math.sin(T * 3) * 1.5 * rise : 0);
      const bounce = T < DEATH.FALL + 0.25 && T > DEATH.FALL ? Math.sin(((T - DEATH.FALL) / 0.25) * Math.PI) * 2 : 0;
      ctx.save();
      ctx.translate(Math.round(bx), Math.round(by - lift - bounce));
      // (A shadow, and a dark pool under you while you lie.)
      ctx.globalAlpha = 0.45 * (1 - rise);
      ctx.fillStyle = '#000000';
      ctx.fillRect(-14, -2, 20, 4);
      ctx.globalAlpha = 1;
      ctx.rotate(-tilt);
      ctx.drawImage(sheet, 0, 0, CHAR_W, SHEET_H, -CHAR_W / 2, -SHEET_H + 1, CHAR_W, SHEET_H);
      // (Lifted: the rite's light round the edge of you, brighter as you
      // rise.)
      if (rise > 0) {
        ctx.globalAlpha = Math.min(1, 0.4 + 0.6 * rise) * (0.75 + 0.25 * Math.sin(T * 14));
        ctx.drawImage(frameGlow(sheet, 0, 0, CHAR_W, SHEET_H, rise > 0.7 ? '#ffffff' : '#5ad8f0'), -CHAR_W / 2 - 1, -SHEET_H);
        ctx.globalAlpha = 1;
      }
      ctx.restore();
      ctx.restore();
      // The words, in the dark.
      const words = clamp01((T - DEATH.DARK + 0.6) / 0.8) * (1 - clamp01((T - DEATH.SPIN) / 0.8));
      if (words > 0) {
        ctx.globalAlpha = words;
        ctx.save();
        ctx.scale(2, 2);
        const t1 = 'YOU HAVE FALLEN';
        drawText(ctx, t1, Math.round(W / 4 - textWidth(t1) / 2), 22, '#ff5050', '#000');
        ctx.restore();
        const t2 = `Slain by ${this.cause}`;
        drawText(ctx, t2, Math.round(W / 2 - textWidth(t2) / 2), 66, '#e8e0d0', '#000');
        const t3 = this.below === 'pack' ? 'What you found below lies in your pack where you fell.' : this.below === 'none' ? 'You lost nothing down here.' : 'You dropped half your coins.';
        drawText(ctx, t3, Math.round(W / 2 - textWidth(t3) / 2), 80, '#a09890', '#000');
        const t4 = '[Space] hasten the rite';
        ctx.globalAlpha = words * (0.5 + 0.3 * Math.sin(T * 3));
        drawText(ctx, t4, Math.round(W / 2 - textWidth(t4) / 2), H - 26, '#7a7470', '#000');
        ctx.globalAlpha = 1;
      }
      // The white.
      const wk = clamp01((T - (DEATH.FLASH - 0.35)) / 0.35);
      if (wk > 0) {
        ctx.globalAlpha = wk * wk;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, W, H);
        ctx.globalAlpha = 1;
      }
    },
  };
}
