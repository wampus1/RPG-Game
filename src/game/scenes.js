// Short scenes played in the middle of things: a Kavorent spire opening,
// a master of an old place rising to meet you, and its fall. Each runs on
// the real clock for a few seconds (see Game.update): it can hold you
// still, slow the world, take the camera somewhere (focus, zoom), set the
// music, and draw over the view (bars top and bottom, a line of words).
//
//   { kind, t, dur, lock, mood, zoom, focus(), timeScale(t),
//     update(game, dt), end(game), draw(ctx, game) }
import { VIEW_W, VIEW_H } from '../config.js';
import { drawText, textWidth } from '../render/font.js';
import { FY } from '../world/dungeongen.js';
import { BLOCKS } from '../world/blocks.js';

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
      return this.t < this.BURST_AT ? 'spire_swell' : 'spire_open';
    },
    get zoom() {
      return 1 + 0.6 * ease(clamp01(this.t / 2)) * (1 - ease(clamp01((this.t - 6.6) / 1.4)));
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
      return `dungeon_${run.rec.type}_boss`;
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
    kind: 'boss_down', t: 0, dur: 4.2, lock: true, at, tint,
    mood: null,
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

// The colours a master shines in (its aura, its end).
const TINTS = {
  barrow_king: ['#a0e8ff', '#e0f8ff'], mound_witch: ['#a0ff70', '#3a5a2a'], huntsman: ['#80e8ff', '#c8fbff'],
  worm: ['#c8a070', '#8a6a4a'], foreman: ['#ffb040', '#ff7020'], brood_mother: ['#c83a30', '#8ac040'],
  priest: ['#80c8e0', '#c8e8f8'], horror: ['#e8e0c8', '#ff4030'], hollow_saint: ['#c8a0ff', '#ffffff'],
  warlord: ['#ff6040', '#ffb080'], twins: ['#ff5040', '#c8c0b8'], twin_b: ['#c8c0b8', '#ff5040'], poisoner: ['#a8e040', '#e8ff90'],
  overseer: ['#5ad8f0', '#ffffff'], prime: ['#ff9050', '#5ad8f0'],
};
export function bossTint(c) {
  return TINTS[c.species] || ['#ffe070', '#ffffff'];
}
