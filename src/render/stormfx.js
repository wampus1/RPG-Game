// How the storm round the islands looks (see game/stormsea.js): black cloud
// gathering overhead as you come up to it; under it, what lightning shows
// of the ships that tried before you (a hull's broken ribs out of the
// water, a bow standing up out of it, a mast and its rag of sail, barrels
// bobbing, planks); deeper, the sea gone red; and at the last, white, then
// black.
import { TILE, LH, GROUND } from '../config.js';
import { floatable } from '../entities/raft.js';

const hash = (x, z, k = 0) => {
  let h = (x * 374761393 + z * 668265263 + k * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

// ------------------------------------------------------------ the wrecks
// Drawn once each, pixel by pixel, to a little canvas: shaded wet timber,
// the grain, nails and ribs, a waterline with foam where the sea laps at
// it (the water hides the rest).
const art = {};
function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}
function px(g, x, y, c) {
  g.fillStyle = c;
  g.fillRect(x, y, 1, 1);
}
const WOOD = ['#2a1a10', '#3e2818', '#54382a', '#6a4a34', '#8a6444'];
// A plank's colour across it (dark at the edges, a lit top) and its grain.
function plank(g, x0, y0, len, thick, ang, rand, wet = 0) {
  const c = Math.cos(ang);
  const s = Math.sin(ang);
  for (let i = 0; i < len; i++) {
    for (let j = 0; j < thick; j++) {
      const x = Math.round(x0 + c * i - s * j);
      const y = Math.round(y0 + s * i + c * j);
      const edge = j === 0 ? 3 : j === thick - 1 ? 0 : 2;
      const grain = (Math.sin(i * 0.7 + j * 2.3 + rand * 9) > 0.75 ? -1 : 0) + (rand > 0.5 && i % 11 === 3 ? -1 : 0);
      px(g, x, y, WOOD[Math.max(0, Math.min(4, edge + grain - wet))]);
    }
  }
  // (Nail heads.)
  px(g, Math.round(x0 + c * 2), Math.round(y0 + s * 2 + c), '#1a1410');
}
function waterline(g, w, y, ripple = 0) {
  g.clearRect(0, y + 1, w, 99);
  for (let x = 0; x < w; x++) {
    const yy = y + (Math.sin(x * 0.6 + ripple) > 0.4 ? 0 : 1);
    if (Math.sin(x * 1.3 + ripple * 2) > -0.2) px(g, x, yy, 'rgba(220,235,245,0.85)');
  }
}

// A ship's broken hull, keeled over, its ribs out of the water, a mast
// snapped off with a rag of sail.
function hullArt() {
  const W = 46;
  const H = 34;
  const c = canvas(W, H);
  const g = c.getContext('2d');
  // The hull's side, planked, curving up to the gunwale (tilted).
  for (let k = 0; k < 7; k++) plank(g, 4 + k, 24 - k * 3, 34 - k * 2, 3, -0.18, k * 0.37, k > 4 ? 1 : 0);
  // Stove in: a hole, the ribs showing through.
  g.clearRect(16, 12, 9, 8);
  for (let r = 0; r < 4; r++) for (let y = 10; y < 22; y++) px(g, 16 + r * 3, y, y % 3 ? '#4a3020' : '#2a1a10');
  // The gunwale's rail.
  plank(g, 9, 6, 30, 2, -0.18, 0.9);
  // The mast, snapped and leaning, a rag of sail off it.
  for (let i = 0; i < 22; i++) {
    const x = Math.round(30 - i * 0.35);
    const y = 8 - i;
    if (y < 0) break;
    px(g, x, y, '#3a2414');
    px(g, x + 1, y, i % 4 ? '#5a3c24' : '#3a2414');
  }
  for (let y = 0; y < 9; y++) for (let x = 0; x < 6 - (y >> 1); x++) if (hash(x, y, 7) > 0.18) px(g, 31 + x, 1 + y, y % 2 ? '#a89c80' : '#c8bc9c');
  waterline(g, W, 27);
  return c;
}

// A ship's bow standing up out of the sea, a stump of bowsprit.
function bowArt() {
  const W = 26;
  const H = 38;
  const c = canvas(W, H);
  const g = c.getContext('2d');
  for (let k = 0; k < 6; k++) plank(g, 3 + k * 3, 34, 30 - k * 2, 3, -1.36 + k * 0.05, k * 0.21, k > 3 ? 1 : 0);
  // The stem post and bowsprit.
  for (let i = 0; i < 30; i++) px(g, 12 + Math.round(i * 0.08), 34 - i, '#2a1a10');
  for (let i = 0; i < 9; i++) {
    px(g, 13 + i, 5 - Math.round(i * 0.4), '#4a3020');
    px(g, 13 + i, 6 - Math.round(i * 0.4), '#2a1a10');
  }
  // Barnacles and weed.
  for (let i = 0; i < 18; i++) {
    const x = 4 + Math.floor(hash(i, 3, 1) * 16);
    const y = 22 + Math.floor(hash(i, 5, 2) * 10);
    px(g, x, y, i % 3 ? '#4a5a40' : '#c8c8b8');
  }
  waterline(g, W, 32, 1.3);
  return c;
}

// A barrel afloat, bobbing upright: staves, iron hoops, its lid catching
// the light.
function barrelArt() {
  const W = 14;
  const H = 16;
  const c = canvas(W, H);
  const g = c.getContext('2d');
  const BR = ['#3a2412', '#5a3a1e', '#7a5028', '#9a6a36', '#b8844a'];
  for (let y = 3; y < 15; y++) {
    // (Bellied in the middle.)
    const half = 5 + (y > 5 && y < 12 ? 1 : 0);
    for (let x = 7 - half; x < 7 + half; x++) {
      const rel = (x - (7 - half)) / (half * 2);
      let k = rel < 0.15 ? 0 : rel < 0.35 ? 2 : rel < 0.6 ? 3 : rel < 0.85 ? 2 : 1;
      if ((x - 1) % 3 === 0) k = Math.max(0, k - 1);
      px(g, x, y, BR[k]);
    }
  }
  // Hoops.
  for (const hy of [5, 11]) for (let x = 1; x < 13; x++) px(g, x, hy, x < 4 ? '#2a2a30' : x < 9 ? '#6a6a74' : '#3a3a42');
  // The lid, an ellipse, lit.
  for (let x = 3; x < 11; x++) {
    px(g, x, 2, '#c8965a');
    px(g, x, 3, x < 5 || x > 8 ? '#8a5e30' : '#d8a868');
  }
  px(g, 2, 3, '#5a3a1e');
  px(g, 11, 3, '#5a3a1e');
  px(g, 6, 2, '#3a2412');
  waterline(g, W, 12, 2.1);
  return c;
}

// A few planks afloat.
function planksArt() {
  const W = 26;
  const H = 12;
  const c = canvas(W, H);
  const g = c.getContext('2d');
  plank(g, 1, 5, 20, 3, -0.08, 0.3);
  plank(g, 6, 2, 15, 2, 0.22, 0.7, 1);
  plank(g, 12, 8, 12, 2, -0.3, 0.1);
  waterline(g, W, 9, 0.4);
  return c;
}

function artOf(kind) {
  if (!art[kind]) art[kind] = kind === 'hull' ? hullArt() : kind === 'bow' ? bowArt() : kind === 'barrel' ? barrelArt() : planksArt();
  return art[kind];
}

// What wreckage there is round (x, z): in cells of 7 tiles, now and then
// one thing, in the water, deeper in the storm the more of it.
export function wrecksNear(game, x, z, R = 16) {
  const ow = game.world.ow;
  const out = [];
  const C = 7;
  for (let cz = Math.floor((z - R) / C); cz <= Math.floor((z + R) / C); cz++) {
    for (let cx = Math.floor((x - R) / C); cx <= Math.floor((x + R) / C); cx++) {
      const h = hash(cx, cz, 31);
      const wx = cx * C + Math.floor(hash(cx, cz, 2) * C);
      const wz = cz * C + Math.floor(hash(cx, cz, 3) * C);
      const s = ow.stormAt(wx, wz);
      if (s < 0.08 || h > 0.25 + s * 0.35) continue;
      if (!floatable(game.world, wx, wz)) continue;
      const k = hash(cx, cz, 4);
      out.push({ x: wx, z: wz, kind: k < 0.16 ? 'hull' : k < 0.3 ? 'bow' : k < 0.68 ? 'barrel' : 'planks', seed: h * 100, flip: hash(cx, cz, 5) < 0.5 });
    }
  }
  return out;
}

// ------------------------------------------------------------ drawing
// Under the lights' pass: the wreckage (seen only by lightning, or dimly in
// the red), the black clouds, the red sea. (`part`: 'world', only what's
// on the sea, for the pictures a turn of the camera swings round; 'sky',
// only what's over the view, drawn upright over the turn: the clouds are
// the screen's, and a picture of them turning, made in pieces, showed them
// doubled and swinging about.)
export function drawStormSea(r, game, part = 'all') {
  const S = game.stormSea;
  if (!S || game.dungeon || (S.cloud < 0.01 && !S.phase)) return;
  const ctx = r.ctx;
  const p = game.player;
  const t = r.time;
  // The wrecks.
  const seen = Math.max(S.flash, S.red * 0.22);
  if (part !== 'sky' && seen > 0.02 && S.depth > 0.05) {
    if (!r.wreckList || r.wreckAt !== `${p.x >> 2},${p.z >> 2}`) {
      r.wreckAt = `${p.x >> 2},${p.z >> 2}`;
      r.wreckList = wrecksNear(game, p.x, p.z);
    }
    for (const w of r.wreckList) {
      if (Math.abs(w.x - p.x) < 2 && Math.abs(w.z - p.z) < 2) continue;
      const img = artOf(w.kind);
      const [u, v] = r.toView(w.x, w.z);
      const bob = w.kind === 'barrel' || w.kind === 'planks' ? Math.round(Math.sin(t * 1.7 + w.seed) * 1.5) : 0;
      const floorY = v * TILE - GROUND * LH + LH - r.camY;
      const x = Math.round(u * TILE + 8 - r.camX - img.width / 2);
      const y = Math.round(floorY + 10 - img.height + bob);
      ctx.save();
      ctx.globalAlpha = Math.min(1, seen);
      if (w.flip) {
        ctx.translate(x + img.width, y);
        ctx.scale(-1, 1);
        ctx.drawImage(img, 0, 0);
      } else ctx.drawImage(img, x, y);
      ctx.restore();
    }
  }
  if (part === 'world') return;
  // The sea gone red, and churning.
  if (S.red > 0.01) {
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = S.red * 0.26;
    ctx.fillStyle = '#7a0a04';
    ctx.fillRect(0, 0, r.vw, r.vh);
    // Crests of froth rolling and breaking where it seethes.
    for (let i = 0; i < 90; i++) {
      const life = (t * (0.9 + hash(i, 0, 21) * 0.8) + hash(i, 1, 21)) % 1;
      const x = Math.round(hash(i, 2, 21) * r.vw + Math.sin(t + i) * 6);
      const y = Math.round(hash(i, 3, 21) * r.vh);
      ctx.globalAlpha = S.red * 0.5 * Math.sin(life * Math.PI);
      ctx.fillStyle = i % 3 ? '#ff5a30' : '#ffb080';
      ctx.fillRect(x, y, 2 + Math.round(life * 4), 1);
    }
    ctx.restore();
  }
  // Cloud: dark banks billowing in over the top of the view as you come up
  // to it, lower and lower (under it, it's all black anyway; and a flash
  // lights them up rather than hiding it).
  const cover = S.cloud * (1 - 0.7 * S.dark) * (1 - 0.85 * S.flash);
  if (cover > 0.01) {
    ctx.save();
    const banks = 7;
    for (let i = 0; i < banks; i++) {
      const sp = 0.01 + (i % 3) * 0.005;
      const bx = ((hash(i, 1, 9) * 1.5 + t * sp) % 1.5 - 0.25) * r.vw;
      const by = (hash(i, 2, 9) * (0.12 + S.cloud * 0.42) - 0.06) * r.vh;
      const size = (0.12 + hash(i, 3, 9) * 0.1) * r.vw;
      // Each bank a heap of billows, dark below, a dull grey on top.
      for (let k = 0; k < 6; k++) {
        const ox = (hash(i, k, 11) - 0.5) * size * 1.6;
        const oy = (hash(i, k, 12) - 0.6) * size * 0.45;
        const rad = size * (0.35 + hash(i, k, 13) * 0.35);
        const cx = bx + ox;
        const cy = by + oy;
        const g = ctx.createRadialGradient(cx, cy - rad * 0.35, rad * 0.1, cx, cy, rad);
        const red = S.red;
        g.addColorStop(0, `rgba(${Math.round(70 + red * 60)},${Math.round(72 - red * 30)},${Math.round(84 - red * 40)},${(0.7 * cover).toFixed(3)})`);
        g.addColorStop(0.55, `rgba(${Math.round(16 + red * 50)},${Math.round(18)},${Math.round(28)},${(0.75 * cover).toFixed(3)})`);
        g.addColorStop(1, 'rgba(10,12,20,0)');
        ctx.fillStyle = g;
        ctx.fillRect(cx - rad, cy - rad, rad * 2, rad * 2);
      }
    }
    // (And a pall over the whole sky, thickening.)
    const pall = ctx.createLinearGradient(0, 0, 0, r.vh);
    pall.addColorStop(0, `rgba(8,10,18,${(0.5 * cover).toFixed(3)})`);
    pall.addColorStop(0.6, `rgba(8,10,18,${(0.18 * cover).toFixed(3)})`);
    pall.addColorStop(1, 'rgba(8,10,18,0)');
    ctx.fillStyle = pall;
    ctx.fillRect(0, 0, r.vw, r.vh);
    ctx.restore();
  }
  // (A flash lights the clouds' undersides: brightest overhead.)
  if (S.flash > 0.05 && S.cloud > 0.05) {
    ctx.save();
    const g = ctx.createLinearGradient(0, 0, 0, r.vh * 0.6);
    g.addColorStop(0, S.red > 0.3 ? `rgba(255,200,180,${(S.flash * 0.3).toFixed(3)})` : `rgba(225,235,255,${(S.flash * 0.3).toFixed(3)})`);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, r.vw, r.vh * 0.6);
    ctx.restore();
  }
}

// Over everything: at the last, a white flash going to black, and out of
// the black, slowly, the beach.
export function drawStormCover(r, game) {
  const S = game.stormSea;
  if (!S || !S.phase) return;
  const ctx = r.ctx;
  ctx.save();
  if (S.phase === 'strike') {
    const k = Math.min(1, S.t / 0.7);
    ctx.globalAlpha = Math.min(1, k * 1.4);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, r.vw, r.vh);
    ctx.globalAlpha = Math.max(0, 1 - k);
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, r.vw, r.vh);
  } else if (S.phase === 'black') {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, r.vw, r.vh);
  } else if (S.phase === 'wake') {
    ctx.globalAlpha = Math.max(0, 1 - S.t / 2.4);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, r.vw, r.vh);
  }
  ctx.restore();
}
