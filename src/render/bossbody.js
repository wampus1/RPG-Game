// The masters of the old places, sculpted (see bossfigs.js for the ones
// that walk as people do, bossbeasts.js for the rest; sculpt.js for how
// they're made): drawn one to one, every pixel the size of every other,
// in twenty-four frames of breath (quicker when they're badly hurt), posed
// as a blow comes, turned the way they face, and rimmed in their colour
// (see bossart.js). And what moves on them of itself (wings, a serpent's
// body, chains, cloaks, a swinging lantern) moving every frame, not frame
// by frame (see each one's `rig`, and bossrig.js).
//   Frames are painted as they're first wanted, a few each frame drawn
// (the nearest one already painted shown till then), so meeting a master
// never stalls the game.
import { paintFigure, hasFigure, figureJoints, figureRig, FIG_W, FIG_H, FIG_AX, FIG_AY } from './bossfigs.js';
import { paintBeast, beastOf } from './bossbeasts.js';
import { bossTint, rim } from './bossart.js';

export const FRAMES = 24;
const cache = new Map();
let budgetT = -1;
let budget = 0;

function toCanvas(px) {
  const c = document.createElement('canvas');
  c.width = px.w;
  c.height = px.h;
  c.getContext('2d').putImageData(px.toImageData(), 0, 0);
  return c;
}

// What of its state shows in how it's drawn (each a few values at most,
// so the frames can be kept).
export function artState(e) {
  const st = {};
  const wd = e.windup && !e.windup.dash;
  if (wd || e.charge || e.inhale || e.gaze || e.decree) st.wind = 1;
  if (e.hp < e.maxHp * 0.35) st.rage = 1;
  if (e.berserkT > 0) st.berserk = 1;
  if (e.loot && e.loot.length) st.loot = 1;
  if (e.shellT > 0) st.shell = 1;
  if (e.open) st.open = 1;
  if (e.eyes) st.eyes = 1;
  if (e.season !== undefined && e.season !== null) st.season = e.season;
  if (e.ventT > 0) st.vent = 1;
  if (e.heat !== undefined) st.heat = e.heat >= 80 ? 2 : e.heat >= 50 ? 1 : 0;
  if (e.submerged) st.under = 1;
  if (e.inhale) st.inhale = 1;
  if (e.song) st.song = 1;
  if (e.variant) st.variant = e.variant;
  return st;
}
const keyOf = (st) => Object.keys(st).filter((k) => k !== 'rage').map((k) => k + st[k]).join(',');

function paintFrame(species, f, st) {
  const t = f / FRAMES;
  if (hasFigure(species)) return [paintFigure(species, t, st), FIG_AX, FIG_AY];
  const B = beastOf(species);
  return [paintBeast(species, t, st), B.ax, B.ay];
}

// One frame of a master in a state: [canvas, its anchor x, anchor y]. Not
// painted yet and the frame's budget spent: the nearest painted one.
export function bossFrame(species, f, st, now = null) {
  const sk = keyOf(st);
  const k = `${species}|${sk}|${f}`;
  let v = cache.get(k);
  if (v) return v;
  if (now !== null) {
    if (now !== budgetT) {
      budgetT = now;
      budget = 3;
    }
    if (budget <= 0) {
      for (let d = 1; d < FRAMES; d++) {
        for (const g of [f - d, f + d]) {
          const w = cache.get(`${species}|${sk}|${(g + FRAMES) % FRAMES}`);
          if (w) return w;
        }
      }
    }
    budget--;
  }
  const [px, ax, ay] = paintFrame(species, f, st);
  v = [typeof document !== 'undefined' ? toCanvas(px) : px, ax, ay];
  cache.set(k, v);
  return v;
}
export const hasBossArt = (species) => hasFigure(species) || !!beastOf(species);

// Draw `e` (a master) with its feet at (sx + 8, feetY); false if it has
// no painting (it's drawn the old way).
export function drawBossArt(r, ctx, e, sx, feetY) {
  const fig = hasFigure(e.species);
  const def = fig ? null : beastOf(e.species);
  if (!fig && !def) return false;
  const vd = r.viewDir(e.dir);
  if (vd === 1) e.faceR = false;
  else if (vd === 3) e.faceR = true;
  const st = artState(e);
  // (Faster breath, the worse it's hurt.)
  // (An echo of the Hollow King doesn't breathe: that's how you know.)
  const fps = (def && def.fps) || 12;
  const rate = st.rage ? fps * 1.5 : fps;
  e.artPhase = (e.artPhase ?? (e.id || 0) * 0.37) + (r.frameDt || 0) * (rate / FRAMES);
  const f = e.species === 'hollow_echo' ? 0 : Math.floor((e.artPhase % 1) * FRAMES) % FRAMES;
  const [img, ax, ay] = bossFrame(e.species, f, st, r.time);
  const lu = r.bodyLunge(e, vd);
  const x = Math.round(sx + 8 + lu.x);
  const y = Math.round(feetY + 1 + lu.y + (e.rise || 0));
  // The rig's own state, and how it's moved since the last frame.
  const rig = (e.rig ||= {});
  const dt = rig.lastT === undefined ? 0 : Math.max(0, Math.min(0.1, r.time - rig.lastT));
  rig.lastT = r.time;
  const drift = rig.lastX === undefined ? 0 : x - rig.lastX;
  rig.lastX = x;
  const flip = e.faceR;
  const dx = x - ax;
  const dy = y - ay;
  const R = { r, ctx, e, st, t: r.time, dt, drift: flip ? -drift : drift, x, y, flip, ox: dx, oy: dy, phase: (e.artPhase % 1), b: 0 };
  if (fig) R.J = figureJoints(e.species, f / FRAMES, st);
  const hooks = fig ? figureRig : def.rig || {};
  if (e.burrowed && !(def && def.burrowed)) return true;
  const a = ctx.globalAlpha;
  if (e.fade !== undefined && e.fade < 1) ctx.globalAlpha = a * Math.max(0.05, e.fade);
  // (In the world, below it: a serpent's coils, a chain to its stake.)
  if (hooks.under) hooks.under(R);
  ctx.save();
  // (Painted facing left: turned about for right.)
  if (flip) {
    ctx.translate(x, 0);
    ctx.scale(-1, 1);
    ctx.translate(-x, 0);
  }
  if (hooks.behind) hooks.behind(R);
  if (!(def && def.noBody && def.noBody(e, st))) {
    ctx.drawImage(img, dx, dy);
    rim(ctx, e, img, 0, 0, img.width, img.height, dx, dy, img.width, img.height, bossTint(e), r.time, e.flash > 0);
  }
  if (hooks.front) hooks.front(R);
  ctx.restore();
  // (In the world, over it.)
  if (hooks.over) hooks.over(R);
  ctx.globalAlpha = a;
  return true;
}
export { FIG_W, FIG_H };
