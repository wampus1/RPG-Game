// The masters of the old places, painted (see bossfigs.js for the ones
// that walk as people do, bossbeasts.js for the rest): drawn one to one,
// not blown up from a small sheet, so every pixel is the size of every
// other; in eight frames of breath and their own moving parts (quicker
// when they're badly hurt), posed as a blow comes, turned the way they
// face, and rimmed in their colour (see bossart.js).
import { paintFigure, hasFigure, FIG_W, FIG_H, FIG_AX, FIG_AY } from './bossfigs.js';
import { paintBeast, beastOf } from './bossbeasts.js';
import { bossTint, rim } from './bossart.js';

const FRAMES = 8;
const cache = new Map();

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
const keyOf = (st) => Object.keys(st).map((k) => k + st[k]).join(',');

// One frame of a master in a state: [canvas, its anchor x, anchor y].
export function bossFrame(species, f, st) {
  const k = `${species}|${f}|${keyOf(st)}`;
  let v = cache.get(k);
  if (v) return v;
  const t = f / FRAMES;
  if (hasFigure(species)) v = [toCanvas(paintFigure(species, t, st)), FIG_AX, FIG_AY];
  else {
    const B = beastOf(species);
    v = [toCanvas(paintBeast(species, t, st)), B.ax, B.ay];
  }
  cache.set(k, v);
  return v;
}
export const hasBossArt = (species) => hasFigure(species) || !!beastOf(species);

// Draw `e` (a master) with its feet at (sx + 8, feetY); false if it has
// no painting (it's drawn the old way).
export function drawBossArt(r, ctx, e, sx, feetY) {
  if (!hasBossArt(e.species)) return false;
  if (e.burrowed) return true;
  const vd = r.viewDir(e.dir);
  if (vd === 1) e.faceR = false;
  else if (vd === 3) e.faceR = true;
  const st = artState(e);
  // (Faster breath, the worse it's hurt; and the moving parts with it.)
  // (An echo of the Hollow King doesn't breathe: that's how you know.)
  const fps = st.rage ? 11 : 7;
  const f = e.species === 'hollow_echo' ? 0 : Math.floor(r.time * fps + (e.id || 0) * 3) % FRAMES;
  const [img, ax, ay] = bossFrame(e.species, f, st);
  const lu = r.bodyLunge(e, vd);
  const x = Math.round(sx + 8 + lu.x);
  const y = Math.round(feetY + 1 + lu.y + (e.rise || 0));
  const a = ctx.globalAlpha;
  if (e.fade !== undefined && e.fade < 1) ctx.globalAlpha = a * Math.max(0.05, e.fade);
  // (Painted facing left: turned about for right.)
  const flip = e.faceR;
  ctx.save();
  if (flip) {
    ctx.translate(x, 0);
    ctx.scale(-1, 1);
    ctx.translate(-x, 0);
  }
  const dx = x - ax;
  const dy = y - ay;
  ctx.drawImage(img, dx, dy);
  rim(ctx, e, img, 0, 0, img.width, img.height, dx, dy, img.width, img.height, bossTint(e), r.time, e.flash > 0);
  ctx.restore();
  ctx.globalAlpha = a;
  return true;
}
export { FIG_W, FIG_H };
