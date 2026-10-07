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
import { bossTint } from './bossart.js';
import { beginTex, makeTex, drawTex, drawRim, texScale, bigTex, paletteFor, TEXEL } from './bosstex.js';
import { mapWorld } from './bossrig.js';
import { rigUpdate, drawLeg } from './bossart.js';
import { TILE, LH } from '../config.js';
import { FORGE, FRAMES as FORGE_FRAMES, forgeFrame, drawParts, breathOf } from './forge.js';
import { drawScratch, drawScratchRim, snapScratch } from './bosstex.js';
import { animOf } from './bossanim.js';
import { poseOf, drawPoseFx, drawPoseBehind } from './bossanim.js';
// (Round 68: the far lands' masters, registered: see farbosses.js.)
import './farbosses.js';
// (Round 71: the masters forged anew: see forge.js.)
import './forge_base.js';

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
// (Round 71: drawn whole onto a scratch canvas, rig and all, and made a
// texture of, thirty-two texels square or sixty-four, each two pixels: see
// bosstex.js. One with nothing moving on it of itself is made once a frame
// of its breath; one with a rig, afresh thirty times a second. And posed
// as it fights: see bossanim.js.)
const TEX_BY_IMG = new WeakMap();
// How big it's painted: what of its first frame isn't empty (so each fills
// its texture, however much room its painting left round it).
const BOXES = new Map();
function bodyBox(species, img) {
  let b = BOXES.get(species);
  if (b) return b;
  const [c0] = bossFrame(species, 0, {});
  const cv = c0.getContext ? c0 : img;
  const w = cv.width;
  const h = cv.height;
  const d = cv.getContext('2d').getImageData(0, 0, w, h).data;
  let x0 = w;
  let y0 = h;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (d[(y * w + x) * 4 + 3] < 40) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  b = x1 < 0 ? { w, h } : { w: x1 - x0 + 1, h: y1 - y0 + 1 };
  BOXES.set(species, b);
  return b;
}
export function drawBossArt(r, ctx, e, sx, feetY) {
  if (FORGE[e.species]) return drawForged(r, ctx, e, sx, feetY);
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
  const hooks = fig ? figureRig : def.rig || {};
  if (e.burrowed && !(def && def.burrowed)) return true;
  const flip = !!e.faceR;
  const big = bigTex(e);
  const box = bodyBox(e.species, img);
  const s = texScale(e, box.w, box.h);
  const K = s * TEXEL;
  const rigged = !!(hooks.under || hooks.behind || hooks.front || hooks.over);
  let tex = null;
  if (!rigged) {
    const m = TEX_BY_IMG.get(img);
    tex = m && m[flip ? 1 : 0];
  } else if (e.texMade && e.texMade.flip === flip && r.time - e.texMade.t < 1 / 30 && r.time >= e.texMade.t) tex = e.texMade.tex;
  if (!tex) {
    const sc = beginTex(x, y, big);
    // The rig's own state, and how it's moved since it was last drawn.
    const rig = (e.rig ||= {});
    const dt = rig.lastT === undefined ? 0 : Math.max(0, Math.min(0.1, r.time - rig.lastT));
    rig.lastT = r.time;
    // (How far it's moved across the world as you see it, not the screen:
    // the camera following you, or turned with Q and E, swings nothing.)
    const wx = x + (r.camX || 0);
    const turned = rig.view !== r.view;
    rig.view = r.view;
    const drift = rig.lastX === undefined || turned ? 0 : Math.max(-6, Math.min(6, wx - rig.lastX));
    rig.lastX = wx;
    const dx = x - ax;
    const dy = y - ay;
    const R = { r, ctx: sc, e, st, t: r.time, dt, drift: flip ? -drift : drift, x, y, flip, ox: dx, oy: dy, phase: (e.artPhase % 1), b: 0 };
    if (fig) R.J = figureJoints(e.species, f / FRAMES, st);
    mapWorld(x, y, K);
    // (In the world, below it: a serpent's coils, a chain to its stake.)
    if (hooks.under) hooks.under(R);
    sc.save();
    // (Painted facing left: turned about for right.)
    if (flip) {
      sc.translate(x, 0);
      sc.scale(-1, 1);
      sc.translate(-x, 0);
    }
    if (hooks.behind) hooks.behind(R);
    if (!(def && def.noBody && def.noBody(e, st))) sc.drawImage(img, dx, dy);
    if (hooks.front) hooks.front(R);
    sc.restore();
    // (In the world, over it.)
    if (hooks.over) hooks.over(R);
    mapWorld(0, 0, 1);
    tex = makeTex(e.species, s, big);
    if (!tex) return true;
    if (!rigged) {
      // (Kept, once its palette's made: till then each is made afresh.)
      if (paletteFor(e.species)) {
        const m = TEX_BY_IMG.get(img) || [];
        m[flip ? 1 : 0] = tex;
        TEX_BY_IMG.set(img, m);
      }
    } else e.texMade = { t: r.time, tex, flip };
  }
  const pose = poseOf(r, e, K);
  const a = ctx.globalAlpha;
  drawPoseBehind(r, ctx, e, tex, x, y, pose);
  ctx.globalAlpha = a * pose.alpha * (e.fade !== undefined && e.fade < 1 ? Math.max(0.05, e.fade) : 1);
  drawTex(ctx, tex, x, y, pose);
  rimTex(ctx, e, tex, x, y, pose, r.time);
  ctx.globalAlpha = a;
  drawPoseFx(r, ctx, e, tex, x, y, pose);
  return true;
}
// Its edge lit in its colour (brighter as a blow comes, white-hot as it's
// struck).
export function rimTex(ctx, e, tex, x, y, pose, time) {
  const wind = e.windup ? Math.min(1, e.windup.t / Math.max(0.05, e.windup.dur)) : 0;
  const tint = bossTint(e);
  const k = Math.min(1, 0.22 + 0.14 * Math.sin(time * 3 + (e.id || 0)) + wind * 0.6 + (e.flash > 0 ? 0.5 : 0));
  drawRim(ctx, tex, x, y, wind > 0.6 && Math.floor(time * 12) % 2 ? '#ffffff' : tint[0], k, pose);
}
export { FIG_W, FIG_H };

// ------------------------------------------------------------ forged
// (Round 71) A master forged anew (see forge.js): its body, a frame of its
// breath (or of its stride, going), and its parts each turned about its
// hinge as what it's doing has them, all of it drawn one pixel to one onto
// the scratch canvas; then drawn posed, rimmed in its light.
function drawForged(r, ctx, e, sx, feetY) {
  const D = FORGE[e.species];
  const vd = r.viewDir(e.dir);
  if (vd === 1) e.faceR = false;
  else if (vd === 3) e.faceR = true;
  const st = artState(e);
  if (D.walk && e.moving) st.walk = 1;
  const fps = D.fps || 12;
  const rate = st.walk ? (D.walkFps || 16) : st.rage ? fps * 1.5 : fps;
  e.artPhase = (e.artPhase ?? (e.id || 0) * 0.37) + (r.frameDt || 0) * (rate / FORGE_FRAMES);
  const f = Math.floor((e.artPhase % 1) * FORGE_FRAMES) % FORGE_FRAMES;
  const img = forgeFrame(e.species, f, st, r.time);
  const lu = r.bodyLunge(e, vd);
  const x = Math.round(sx + 8 + lu.x);
  const y = Math.round(feetY + 1 + lu.y + (e.rise || 0));
  if (e.burrowed && !D.burrowed) return true;
  const flip = !!e.faceR;
  const big = D.size > 64;
  const A = animOf(r, e);
  const sc = beginTex(x, y, big);
  const rig = (e.rig ||= {});
  const dt = rig.lastT === undefined ? 0 : Math.max(0, Math.min(0.1, r.time - rig.lastT));
  rig.lastT = r.time;
  const wx = x + (r.camX || 0);
  const turned = rig.view !== r.view;
  rig.view = r.view;
  const drift = rig.lastX === undefined || turned ? 0 : Math.max(-6, Math.min(6, wx - rig.lastX));
  rig.lastX = wx;
  const t = f / FORGE_FRAMES;
  const J = { t, st, f, b: breathOf(t, D.breath ?? 1), sway: Math.sin(t * Math.PI * 2) };
  if (D.joints) D.joints(J, t, st);
  const R = { r, ctx: sc, e, st, J, A, t: r.time, dt, drift: flip ? -drift : drift, x, y, flip, ox: x - D.ax, oy: y - D.ay, phase: e.artPhase % 1, D };
  mapWorld(x, y, 1);
  if (D.under) D.under(R);
  // (Legs of its own, each foot planted in the world: see bossart.js.)
  const legs = D.legs ? forgedLegs(r, e, D, R, flip, dt) : null;
  if (legs) legs(0);
  sc.save();
  if (flip) {
    sc.translate(x, 0);
    sc.scale(-1, 1);
    sc.translate(-x, 0);
  }
  if (D.behind) D.behind(R);
  drawParts(R, D, 'back');
  sc.drawImage(img, R.ox, R.oy);
  drawParts(R, D, 'front');
  if (D.front) D.front(R);
  sc.restore();
  if (legs) legs(1);
  if (D.over) D.over(R);
  const pose = poseOf(r, e, D.size / 64, true);
  const box = { w: D.size, h: D.size, tx0: -D.ax, ty0: -D.ay, img: null, forged: true, big };
  if (e.dying !== undefined && e.dying >= 0.55 && !(e._anim && e._anim.dust)) Object.assign(box, snapScratch(-D.ax - 8, -D.ay - 8, D.size + 16, D.size + 16));
  const a = ctx.globalAlpha;
  drawPoseBehind(r, ctx, e, box, x, y, pose);
  const fade = pose.alpha * (e.fade !== undefined && e.fade < 1 ? Math.max(0.05, e.fade) : 1);
  ctx.globalAlpha = a * fade;
  const wind = e.windup ? Math.min(1, e.windup.t / Math.max(0.05, e.windup.dur)) : 0;
  const tint = bossTint(e);
  const k = Math.min(1, 0.2 + 0.12 * Math.sin(r.time * 3 + (e.id || 0)) + wind * 0.6 + (e.flash > 0 ? 0.5 : 0));
  drawScratchRim(ctx, x, y, pose, big, wind > 0.6 && Math.floor(r.time * 12) % 2 ? '#ffffff' : tint[0], k);
  drawScratch(ctx, x, y, pose, big);
  ctx.globalAlpha = a;
  // (What it gives off, over it: mist, embers, a glow.)
  if (D.fx) {
    ctx.save();
    D.fx(R, ctx, pose);
    ctx.restore();
  }
  drawPoseFx(r, ctx, e, box, x, y, pose);
  return true;
}

// A forged master's legs (D.legs: as bossart's RIGS, with `hips`: for each
// leg, [far hip, near hip] on its picture), stepping as it goes.
function forgedLegs(r, e, D, R, flip, dt) {
  const L = D.legs;
  const front = flip ? 1 : -1;
  const wp = e.renderPos();
  const homes = rigUpdate(r, e, L, wp, front, dt, e.game, 1);
  const tint = bossTint(e);
  const toScreen = (cx, cy) => ({ x: flip ? 2 * R.x - (R.ox + cx) : R.ox + cx, y: R.oy + cy + (R.J.b * (L.breathK ?? 0.5)) });
  return (side) => {
    homes.forEach((h, i) => {
      if (h.side !== side) return;
      const hp = L.hips[h.j][side];
      const a = toScreen(hp[0], hp[1]);
      const f = e.legRig.feet[i];
      const [u, v] = r.toView(f.x, f.z);
      const lift = f.t < 1 ? Math.sin(Math.PI * f.t) * L.arc : 0;
      const bx = u * TILE - r.camX + 8;
      const by = v * TILE - wp.y * LH + LH - r.camY + 10 - lift;
      drawLeg(R.ctx, L.style, a.x, a.y, bx, by, L, r.time, i, tint[0], ((e.legCv ||= [])[i] ||= {}), flip);
    });
  };
}
