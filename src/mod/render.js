// Mods drawn (round 62): their blocks' faces and sprites put in the
// game's atlas, their items' icons, their creatures' pictures made afresh;
// and, each frame, their shots in the air and their effects (see vfx.js).
import { MODS } from './state.js';
import { assetPixels, composite, resample } from './format.js';
import { TEX, addLate, resetLate, avgOf, SPR_H, TALL_H } from '../render/textures.js';
import { forgetModArt, toCanvas } from '../render/sprites.js';
import { Px, shade } from '../render/pixel.js';
import { TILE, LH } from '../config.js';
import { VfxPlayer } from './vfx.js';

const toPx = (pix) => {
  const p = new Px(pix.w, pix.h);
  p.d.set(pix.d);
  return p;
};
const blank = (w, h) => new Px(w, h);

// A face darkened as the game's fronts are (lit from above).
function frontOf(top) {
  const p = new Px(16, LH);
  for (let y = 0; y < LH; y++) for (let x = 0; x < 16; x++) {
    const sy = Math.min(15, y + 4);
    const c = top.get(x, sy);
    if (!c[3]) continue;
    const k = 0.78 - (y / LH) * 0.12;
    const d = shade([c[0], c[1], c[2]], k);
    p.set(x, y, d, c[3]);
  }
  // (A dark seam along the top edge, as the game's blocks have.)
  for (let x = 0; x < 16; x++) {
    const c = p.get(x, 0);
    if (c[3]) p.set(x, 0, shade([c[0], c[1], c[2]], 0.8), c[3]);
  }
  return p;
}

// One frame of art set in a prop's frame (16 across, 28 or 40 high),
// standing on the middle of its pace.
function propFrame(mod, assetId, frame, tall) {
  const H = tall ? TALL_H : SPR_H;
  const a = mod.assets[assetId];
  const p = blank(16, H);
  if (!a) return p;
  const maxH = tall ? 36 : 24;
  const pix = assetPixels(mod, assetId, frame, 16, maxH, 'contain', true);
  const src = toPx(pix);
  // (Its foot a little in from the front of the pace.)
  const oy = H - 3 - maxH;
  for (let y = 0; y < maxH; y++) for (let x = 0; x < 16; x++) {
    const c = src.get(x, y);
    if (c[3]) p.set(x, y + oy, c, c[3]);
  }
  return p;
}

function flatFrame(mod, assetId, frame) {
  const pix = assetPixels(mod, assetId, frame, 16, 16, 'stretch');
  return pix ? toPx(pix) : blank(16, 16);
}

function frameCount(mod, assetId) {
  const a = mod.assets[assetId];
  return a ? Math.max(1, a.frames.length) : 1;
}

// A placeholder face: the mod's colour, checked, so it shows something.
function missingFace(color, w = 16, h = 16) {
  const p = new Px(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) p.set(x, y, ((x >> 2) + (y >> 2)) % 2 ? color : shade(color, 0.6));
  return p;
}

// ------------------------------------------------------------ install
function install() {
  forgetModArt();
  if (!TEX.atlas) return;
  resetLate();
  for (const [id, rec] of MODS.blocks) {
    const b = rec.f;
    const m = rec.mod;
    const shape = b.shape || 'cube';
    const tex = b.texture && m.assets[b.texture] ? b.texture : null;
    if (shape === 'cube') {
      const n = tex ? Math.min(4, frameCount(m, tex)) : 1;
      const tops = [];
      const fronts = [];
      for (let f = 0; f < n; f++) {
        const top = tex ? flatFrame(m, tex, f) : missingFace(m.color || '#ff40ff');
        tops.push(top);
        const side = b.side && m.assets[b.side] ? toPx(assetPixels(m, b.side, Math.min(f, frameCount(m, b.side) - 1), 16, LH, 'stretch')) : frontOf(top);
        fronts.push(side);
      }
      const slotsT = addLate(tops);
      const slotsF = addLate(fronts);
      for (let rot = 0; rot < 4; rot++) {
        TEX.top[id * 4 + rot] = slotsT;
        TEX.front[id * 4 + rot] = slotsF;
      }
      TEX.avg[id] = avgOf(tops[0].d);
    } else if (shape === 'flat') {
      const n = tex ? Math.min(4, frameCount(m, tex)) : 1;
      const imgs = [];
      for (let f = 0; f < n; f++) imgs.push(tex ? flatFrame(m, tex, f) : missingFace(m.color || '#ff40ff'));
      const slots = addLate(imgs);
      for (let rot = 0; rot < 4; rot++) TEX.sprite[id * 4 + rot] = slots;
      TEX.avg[id] = avgOf(imgs[0].d);
    } else {
      // Props, tall props and plants: four frames of its art, as it
      // animates (the same again lit, for one with a state).
      const tall = shape === 'tall';
      const n = tex ? frameCount(m, tex) : 1;
      const frames = [];
      for (let f = 0; f < 4; f++) frames.push(tex ? propFrame(m, tex, f % n, tall) : missingFace(m.color || '#ff40ff', 16, tall ? TALL_H : SPR_H));
      const slots = addLate(frames);
      const arr = [...slots, ...slots];
      for (let rot = 0; rot < 4; rot++) TEX.sprite[id * 4 + rot] = arr;
      TEX.avg[id] = avgOf(frames[0].d);
    }
  }
}

function uninstall() {
  forgetModArt();
  if (TEX.atlas) resetLate();
}

MODS.hooks.install.push(install);
MODS.hooks.uninstall.push(uninstall);

// An item's icon (16 across): its own art, or its block's.
MODS.iconFor = (key, it) => {
  const rec = MODS.ents.get(key);
  if (!rec) return null;
  const m = rec.mod;
  const f = rec.f;
  const id = f.icon || f.texture || null;
  if (!id || !m.assets[id]) {
    if (rec.kind === 'block' && TEX.atlas) return null;
    return toCanvas(missingFace(m.color || '#ff40ff'));
  }
  const pix = assetPixels(m, id, 0, 16, 16, 'contain');
  return toCanvas(toPx(pix));
};

// ------------------------------------------------------------ each frame
// What a mod's shots and effects look like in the air.
const shotImgs = new Map();
function shotImg(mod, id) {
  const k = `${mod.id}:${id}`;
  if (shotImgs.has(k)) return shotImgs.get(k);
  const pix = assetPixels(mod, id, 0, null, null);
  const img = pix ? toCanvas(toPx(pix)) : null;
  shotImgs.set(k, img);
  return img;
}

MODS.draw = (r, ctx, game, dt) => {
  // Effects (see vfx.js).
  MODS.drawVfx?.(r, ctx, game, dt);
  // Shots in flight.
  for (const s of game.modShots || []) {
    const [u, v] = r.toView(s.x, s.z);
    const sx = Math.round(u * TILE + 8 - r.camX);
    const sy = Math.round(v * TILE - s.y * LH + LH - r.camY);
    if (sx < -20 || sy < -20 || sx > r.vw + 20 || sy > r.vh + 20) continue;
    const img = s.look ? shotImg(s.mod, s.look) : null;
    if (img) {
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(Math.atan2(s.vz, s.vx));
      ctx.drawImage(img, -img.width / 2, -img.height / 2);
      ctx.restore();
    } else {
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = s.color;
      ctx.fillRect(sx - 2, sy - 2, 5, 5);
      ctx.globalAlpha = 1;
      ctx.fillRect(sx - 1, sy - 1, 3, 3);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(sx, sy, 1, 1);
    }
  }
  // Someone made untouchable: a shimmer round them.
  for (const c of game.creatures) {
    if (!(c.modGuardT > 0) || c.dead) continue;
    const [u, v] = r.toView(c.x, c.z);
    const sx = Math.round(u * TILE + 8 - r.camX);
    const sy = Math.round(v * TILE - c.y * LH + LH - r.camY);
    const R = 9 + (c.foot ? 16 : 0);
    ctx.globalAlpha = 0.35 + 0.2 * Math.sin(r.time * 12);
    ctx.strokeStyle = c.S.modColor || '#c8e0ff';
    ctx.beginPath();
    ctx.ellipse(sx, sy - 6 - (c.foot ? 10 : 0), R, R * 1.1, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
};

// ------------------------------------------------------------ effects
// A mod's art as an effect wants it: each frame a canvas, how long each
// lasts, its tags.
const vfxArt = new Map();
export function effectArt(mod, id) {
  const k = `${mod.id}:${id}:${MODS.serial}`;
  if (vfxArt.has(k)) return vfxArt.get(k);
  const a = mod.assets[id];
  let out = null;
  if (a) {
    const frames = a.frames.map((f, i) => {
      const pix = assetPixels(mod, id, i, null, null);
      return pix ? toCanvas(toPx(pix)) : null;
    }).filter(Boolean);
    out = { frames, durs: a.frames.map((f) => f.dur || 100), tags: a.tags || [] };
  }
  if (vfxArt.size > 400) vfxArt.clear();
  vfxArt.set(k, out);
  return out;
}

// An effect played: at a place, or on someone (following them if
// `o.follow`). Returns a handle (set .done to stop it).
MODS.playVfx = (game, mod, id, at, o = {}) => {
  if (!game || !mod || !id || !at) return null;
  const rec = MODS.vfx.get(`${mod.id}:${id}`);
  if (!rec) return null;
  const def = rec.v;
  const ent = typeof at.hp === 'number' ? at : null;
  const list = (game.modVfx ||= []);
  if (list.length > 160) list.shift().done = true;
  const inst = {
    player: new VfxPlayer(def, { art: (aid) => effectArt(mod, aid), scale: o.scale || 1, loop: o.loop ?? !!def.loop, seed: (Math.random() * 2 ** 31) | 0 }),
    ent: ent && (o.follow || o.loop) ? ent : null,
    pos: { x: ent ? ent.x : at.x, y: ent ? ent.y : at.y, z: ent ? ent.z : at.z },
    done: false,
    last: null,
  };
  list.push(inst);
  const near = game.player && Math.abs(game.player.x - inst.pos.x) < 40 && Math.abs(game.player.z - inst.pos.z) < 30;
  if (def.sound) game.audio?.play(def.sound, inst.pos);
  if (near && def.shake) game.shake = Math.min(1.4, (game.shake || 0) + def.shake * 0.12);
  if (near && def.flash) game.renderer?.flashScreen?.(def.flash, 0.25);
  return inst;
};

MODS.drawVfx = (r, ctx, game, dt) => {
  const list = game.modVfx;
  if (!list || !list.length) return;
  const keep = [];
  for (const q of list) {
    if (q.done || q.player.done || (q.ent && (q.ent.dead || q.ent.removed))) continue;
    q.player.step(dt || 1 / 60);
    if (q.player.done) continue;
    const e = q.ent;
    const rp = e && e.renderPos ? e.renderPos() : e || q.pos;
    const { x, y, z } = rp;
    const [u, v] = r.toView(x, z);
    const sx = u * TILE + 8 - r.camX;
    const sy = v * TILE - y * LH + LH + 10 - r.camY;
    if (q.last && e) q.player.shift(sx + r.camX - q.last[0], sy + r.camY - q.last[1]);
    q.last = [sx + r.camX, sy + r.camY];
    keep.push(q);
    if (sx < -120 || sy < -120 || sx > r.vw + 120 || sy > r.vh + 120) continue;
    q.player.draw(ctx, Math.round(sx), Math.round(sy));
  }
  game.modVfx = keep;
};
MODS.hooks.uninstall.push(() => vfxArt.clear());

export { composite, resample };
