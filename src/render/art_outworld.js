// (Round 124) An outworlder's opening, painted (the scene, its words and
// its timing: see game/originintros.js). Three shots:
//   - high over Thessa: the world below, its seas and lands, its clouds,
//     the storm-ring of the Wall round the islands, the night coming over
//     its edge with the lights of towns in it, the thin blue of its air
//     along the limb; your ship (long, ribbed, lit along her spine, her
//     drives burning) going by; the alarms; fire along her; the blast that
//     breaks her back; the pods flung out of her, yours tumbling away
//     toward the world;
//   - night over a lake in the hills of Thessa: the stars, a fisher's hut,
//     the forest along the far shore; something falling across the sky,
//     green and violet, breaking up, its light in the water; it comes down
//     beyond the hills, and the sky over them goes white;
//   - the crater, close: the earth thrown up about it, burning stumps,
//     embers going up; the pod in the bottom of it, its seams glowing and
//     cooling, steam off it; the hatch blown; you, hauling yourself out,
//     down onto the ground of a world not yours, looking about you; the
//     last of your ship, far up, still falling.
import { VIEW_W, VIEW_H } from '../config.js';
import { Bmp, ramp, rgb, mixC, sky, stars, mountains, hills, pine, poly, hash2, fbm, rngOf } from './brush.js';

const PW = VIEW_W / 2;
const PH = VIEW_H / 2;
const R4 = (h, s = 0.34) => ramp(h, 4, { spread: s });
const R5 = (h, s = 0.4) => ramp(h, 5, { spread: s });
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const ease = (k) => (k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k));
const lerp = (a, b, k) => a + (b - a) * k;

function glow(g, x, y, r, col, a) {
  if (a <= 0.003 || r <= 0) return;
  const [cr, cg, cb] = rgb(col);
  const gr = g.createRadialGradient(x, y, 0, x, y, r);
  gr.addColorStop(0, `rgba(${cr},${cg},${cb},${Math.min(1, a).toFixed(3)})`);
  gr.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
  g.save();
  g.globalCompositeOperation = 'lighter';
  g.fillStyle = gr;
  g.fillRect(x - r, y - r, r * 2, r * 2);
  g.restore();
}
function dot(g, x, y, col, a = 1) {
  g.globalAlpha = a;
  g.fillStyle = col;
  g.fillRect(Math.round(x), Math.round(y), 1, 1);
  g.globalAlpha = 1;
}

// ------------------------------------------------------------ the world
// Thessa from orbit: a great curve of it across the bottom of the frame.
export const PLANET = { cx: 150, cy: 330, r: 262 };
const SUN = [-0.92, 0.12, 0.36];
const WALL_C = (() => {
  const v = [0.08, -0.82, 0.57];
  const l = Math.hypot(...v);
  return v.map((q) => q / l);
})();
function paintPlanet(seed) {
  const b = new Bmp(PW, PH);
  const { cx, cy, r } = PLANET;
  const sl = Math.hypot(...SUN);
  const L = SUN.map((q) => q / sl);
  for (let y = 0; y < PH; y++) for (let x = 0; x < PW; x++) {
    const nx = (x - cx) / r;
    const ny = (y - cy) / r;
    const d2 = nx * nx + ny * ny;
    if (d2 > 1) {
      // (The air along the limb, outside it: thin blue, brighter sunward.)
      const out = (Math.sqrt(d2) - 1) * r;
      if (out < 7) {
        const lit = clamp01(0.4 + (-(nx * L[0] + ny * L[1])) * 0.9);
        b.set(x, y, mixC(rgb('#3a7aff'), rgb('#a8d8ff'), lit * 0.6), (1 - out / 7) * 0.75 * (0.25 + lit * 0.75));
      }
      continue;
    }
    const nz = Math.sqrt(1 - d2);
    // (Where on the world: turned a little, so the seas and lands lie as
    // they would going round.)
    const px = nx * 0.94 + nz * 0.34;
    const pz = -nx * 0.34 + nz * 0.94;
    const py = ny;
    const u = px * 2.6 + pz * 1.3;
    const v = py * 2.6 + pz * 0.8;
    const land = fbm(u + 7, v + 3, seed, 5);
    const wd = Math.acos(clamp01(px * WALL_C[0] + py * WALL_C[1] + pz * WALL_C[2]));
    const inRing = wd < 0.15;
    const isLand = inRing ? land > 0.6 : land > 0.56;
    let c;
    if (isLand) {
      const h = fbm(u * 2.4, v * 2.4, seed + 5);
      c = h > 0.62 ? rgb('#8a7a5a') : h > 0.48 ? rgb('#4a7a3a') : rgb('#3a6a34');
      if (land < 0.58) c = rgb('#d8c890');
    } else {
      const deep = clamp01((0.56 - land) * 4);
      c = mixC(rgb('#2a6ab0'), rgb('#0e2a6a'), deep);
    }
    // Clouds: drifts and swirls; the Wall, a ring of storm.
    const cl = fbm(u * 1.8 + 11, v * 3.2 + 2, seed + 9, 5);
    let cloud = clamp01((cl - 0.5) * 3.2) * 0.85;
    const ringK = Math.abs(wd - 0.16);
    if (ringK < 0.035) {
      // (The Wall: banded, torn, spiralling.)
      const sw = fbm(Math.atan2(py - WALL_C[1], px - WALL_C[0]) * 5 + wd * 40, wd * 60, seed + 13);
      cloud = Math.max(cloud, clamp01(1 - ringK / 0.035) * clamp01(sw * 1.4 - 0.1) * 0.85);
    }
    c = mixC(c, rgb('#e8ecf4'), cloud);
    // Lit by the sun; the night side, and the edge between.
    const lam = nx * L[0] + ny * L[1] + nz * L[2];
    const day = clamp01((lam + 0.08) * 3.2);
    c = mixC(mixC(rgb('#03060e'), rgb('#0a1020'), cloud * 0.5), c.map((q) => Math.min(255, q * (0.42 + lam * 0.55))), day);
    if (lam > -0.04 && lam < 0.1) c = mixC(c, rgb('#ff9a6a'), (1 - Math.abs(lam - 0.03) / 0.07) * 0.25);
    // (The lights of towns on the night side.)
    if (day < 0.3 && isLand && cloud < 0.3 && hash2(x, y, seed + 21) > 0.975) c = mixC(rgb('#ffd890'), c, day * 2);
    // (Toward the limb, the air thickens over it.)
    const limb = Math.pow(1 - nz, 3);
    c = mixC(c, rgb('#5a98f0'), limb * 0.5 * (0.15 + day * 0.85));
    b.set(x, y, c);
  }
  return b.canvas();
}

// Space behind it: stars thick, a wash of nebula, a far sun's glare.
function paintSpace(seed) {
  const b = new Bmp(PW, PH);
  sky(b, [[0, '#04020c'], [60, '#0a0818'], [100, '#0e0e24']]);
  for (let y = 0; y < PH; y++) for (let x = 0; x < PW; x++) {
    const n = fbm(x * 0.018 + 3, y * 0.03, seed + 31, 5);
    const m = fbm(x * 0.04, y * 0.05 + 9, seed + 33, 3);
    if (n > 0.52) b.set(x, y, mixC(rgb('#3a1a5a'), rgb('#1a4a6a'), m), clamp01((n - 0.52) * 3) * 0.55);
  }
  stars(b, PH, seed, { band: true, n: 320 });
  return b.canvas();
}

// Your ship, side on, heading right: long, ribbed, her spine lit; three
// drives aft. In two pieces (fore and aft of where she breaks).
export const SHIPX = { w: 150, h: 46, cut: 80 };
function paintShipX() {
  const b = new Bmp(SHIPX.w, SHIPX.h);
  const hull = R5('#5a5a7e', 0.48);
  const mid = 23;
  const half = (x) => {
    if (x < 10) return 0;
    if (x < 16) return 8;
    const k = (x - 16) / (SHIPX.w - 16);
    const swell = 8 + 4 * Math.sin(Math.min(1, k * 2) * Math.PI * 0.5);
    return k > 0.72 ? Math.max(0.5, swell * Math.pow(1 - (k - 0.72) / 0.28, 0.9)) : swell;
  };
  for (let x = 0; x < SHIPX.w; x++) {
    const h = half(x);
    for (let y = Math.round(mid - h); y <= Math.round(mid + h * 0.8); y++) {
      const v = (y - (mid - h)) / (h * 1.8);
      let c = v < 0.12 ? hull[4] : v < 0.4 ? hull[3] : v < 0.7 ? hull[2] : hull[1];
      if (x % 9 === 0 && x > 14) c = hull[0];
      if (Math.abs(y - mid) < 1 && x > 20 && x < SHIPX.w - 18) c = (x % 3) ? rgb('#40e8d0') : rgb('#1a8a8a');
      if (y > mid + h * 0.8 - 1) c = hull[0];
      b.set(x, y, c);
    }
  }
  // Ribs over the top of her, curving.
  for (let x = 24; x < SHIPX.w - 24; x += 9) {
    const h = half(x);
    for (let k = 0; k < 5; k++) b.set(x + Math.round(k * 0.6), Math.round(mid - h - k * 0.6 + 2), hull[4]);
  }
  // A ring about her middle, standing proud of the hull: her drive coil.
  for (let x = 52; x < 58; x++) {
    const h = half(x) + 3;
    for (let y = Math.round(mid - h); y <= Math.round(mid + h * 0.85); y++) b.set(x, y, x === 52 ? hull[4] : x === 57 ? hull[0] : (y % 3 === 0 ? rgb('#40e8d0') : hull[2]));
  }
  // The bridge, a fin up from her back, its windows.
  poly(b, [[96, mid - 10], [104, mid - 19], [116, mid - 19], [122, mid - 10]], hull[2]);
  poly(b, [[100, mid - 12], [106, mid - 18], [114, mid - 18], [119, mid - 12]], hull[3]);
  for (let x = 106; x < 116; x += 2) b.set(x, mid - 16, rgb('#a0fff0'));
  // A keel fin down, and an antenna mast forward.
  poly(b, [[54, mid + 8], [62, mid + 17], [72, mid + 17], [76, mid + 8]], hull[1]);
  for (let y = mid - 22; y < mid - 10; y++) b.set(128, y, hull[3]);
  b.set(128, mid - 23, rgb('#ff6060'));
  // The drives aft: three bells, dark in their mouths (their fire is
  // drawn live).
  for (const dy of [-6, 0, 6]) for (let x = 0; x < 10; x++) for (let y = mid + dy - 2; y <= mid + dy + 2; y++) {
    const edge = y === mid + dy - 2 || y === mid + dy + 2;
    b.set(x, y, x < 2 ? rgb('#1a1a28') : edge ? hull[3] : hull[1]);
  }
  const c = b.canvas();
  const piece = (x0, x1) => {
    const p = document.createElement('canvas');
    p.width = SHIPX.w;
    p.height = SHIPX.h;
    const g = p.getContext('2d');
    g.drawImage(c, 0, 0);
    g.globalCompositeOperation = 'destination-in';
    g.beginPath();
    // (A jagged break.)
    g.moveTo(x0, 0);
    for (let y = 0; y <= SHIPX.h; y += 4) g.lineTo(x1 === SHIPX.w ? SHIPX.cut + ((y / 4) % 2 ? 3 : -2) : x1 + ((y / 4) % 2 ? 3 : -2), y);
    g.lineTo(x0, SHIPX.h);
    g.closePath();
    g.fill();
    return p;
  };
  // aft: from 0 to the cut; fore: from the cut to her bow.
  const aft = piece(0, SHIPX.cut);
  const fore = document.createElement('canvas');
  fore.width = SHIPX.w;
  fore.height = SHIPX.h;
  const fg = fore.getContext('2d');
  fg.drawImage(c, 0, 0);
  fg.globalCompositeOperation = 'destination-out';
  fg.drawImage(aft, 0, 0);
  return { whole: c, aft, fore };
}

// A pod: a capsule, a porthole, its fins (`s` big: the one in the crater).
function drawPodSmall(g, x, y, ang, t, hot) {
  g.save();
  g.translate(Math.round(x), Math.round(y));
  g.rotate(ang);
  g.fillStyle = '#8a8aa8';
  g.fillRect(-3, -2, 6, 4);
  g.fillStyle = '#c8c8e0';
  g.fillRect(-3, -2, 6, 1);
  g.fillStyle = '#4a4a6a';
  g.fillRect(-4, -1, 1, 2);
  g.fillStyle = '#40e8d0';
  g.fillRect(1, -1, 1, 1);
  if (hot > 0) {
    g.globalAlpha = hot;
    g.fillStyle = '#ff9040';
    g.fillRect(-3, -2, 6, 4);
    g.globalAlpha = 1;
  }
  g.restore();
  void t;
}

// ------------------------------------------------------------ the lake
export const LAKE = { y: 106, hit: { x: 198, y: 94 } };
function paintLake(seed, r) {
  const sk = new Bmp(PW, PH);
  sky(sk, [[0, '#04061a'], [40, '#0c1236'], [80, '#1a2a52'], [104, '#2a4060']]);
  stars(sk, 100, seed + 1, { band: true, n: 220 });
  const far = new Bmp(PW, PH);
  mountains(far, { seed: (seed % 997) + 11, base: 100, top: 62, peaks: 4, pal: R5('#2a3456', 0.4), snow: { y: 70, pal: [rgb('#4a5478'), rgb('#6a7498'), rgb('#8a94b8'), rgb('#aab4d8')] }, air: rgb('#1a2a52'), airK: 0.35 });
  const near = new Bmp(PW, PH);
  // The hills on the far shore, the forest along them.
  const crest = (x) => 94 + Math.sin(x * 0.03 + 1) * 4 + Math.sin(x * 0.09) * 1.5;
  hills(near, crest, LAKE.y + 1, R4('#141e30'), { seed: seed + 3, texture: 0.4 });
  const fir = R5('#16243a', 0.3);
  const bark = [rgb('#0e0e14'), rgb('#14141c'), rgb('#1a1a24')];
  for (let x = -4; x < PW + 4; x += 3 + Math.floor(r() * 3)) pine(near, x, Math.round(crest(x) + 3 + r() * 3), 7 + r() * 7, fir, bark, x * 5 + seed, { bare: false });
  for (let x = 0; x < PW; x++) near.set(x, LAKE.y, rgb('#0a1018'));
  // The hut on the near shore at the left, its window lit; its jetty.
  const lake = new Bmp(PW, PH);
  for (let y = LAKE.y + 1; y < PH; y++) for (let x = 0; x < PW; x++) {
    const d = (y - LAKE.y) / (PH - LAKE.y);
    lake.set(x, y, mixC(rgb('#22385a'), rgb('#0a1428'), Math.pow(d, 0.7)));
  }
  const shore = new Bmp(PW, PH);
  const sh = (x) => 128 + Math.round(Math.pow(Math.max(0, 1 - x / 90), 1.4) * -16) + (fbm(x * 0.1, 7, seed) - 0.5) * 3;
  for (let x = 0; x < 100; x++) for (let y = Math.round(sh(x)); y < PH; y++) shore.set(x, y, y - sh(x) < 1.5 ? rgb('#2a3040') : rgb('#10141e'));
  for (let x = 170; x < PW; x++) {
    const top = Math.round(136 - Math.pow((x - 170) / 86, 1.2) * 14);
    for (let y = top; y < PH; y++) shore.set(x, y, y === top ? rgb('#2a3040') : rgb('#10141e'));
  }
  // (Reeds along it.)
  for (let x = 0; x < PW; x += 2) {
    const base = x < 100 ? Math.round(sh(x)) : x > 170 ? Math.round(136 - Math.pow((x - 170) / 86, 1.2) * 14) : null;
    if (base === null || hash2(x, 3, seed) < 0.35) continue;
    const h = 3 + Math.floor(hash2(x, 5, seed) * 6);
    for (let k = 0; k < h; k++) shore.set(x + (k > h - 2 && hash2(x, 9, seed) > 0.5 ? 1 : 0), base - k, rgb('#0c1018'));
  }
  const hut = { x: 26, y: 114 };
  for (let y = hut.y - 9; y < hut.y; y++) for (let x = hut.x - 8; x <= hut.x + 8; x++) shore.set(x, y, (y + x) % 4 === 0 ? rgb('#1a1a22') : rgb('#22222c'));
  for (let i = 0; i < 7; i++) for (let x = hut.x - 10 + i; x <= hut.x + 10 - i; x++) shore.set(x, hut.y - 10 - i, rgb(i === 0 ? '#2a2a34' : '#181820'));
  for (let y = hut.y - 7; y < hut.y - 4; y++) for (let x = hut.x + 2; x < hut.x + 5; x++) shore.set(x, y, rgb('#ffc870'));
  for (let x = hut.x + 10; x < hut.x + 34; x++) {
    shore.set(x, hut.y + 4, rgb('#2a2a30'));
    if (x % 6 === 0) for (let y = hut.y + 5; y < hut.y + 10; y++) shore.set(x, y, rgb('#14141a'));
  }
  return { sky: sk.canvas(), far: far.canvas(), near: near.canvas(), lake: lake.canvas(), shore: shore.canvas(), hut, crest };
}

// ------------------------------------------------------------ the crater
export const PIT = { cx: 128, floor: 120, pod: { x: 96, y: 96, w: 66, h: 32 }, hatch: { x: 132, y: 100 } };
function paintCrater(seed, r) {
  const sk = new Bmp(PW, PH);
  sky(sk, [[0, '#060814'], [50, '#141a30'], [90, '#3a2a3a'], [110, '#6a3a2a']]);
  stars(sk, 70, seed + 7, { band: false, n: 90 });
  // (Smoke hanging over it, lit from below.)
  for (let y = 10; y < 100; y++) for (let x = 0; x < PW; x++) {
    const n = fbm(x * 0.03, y * 0.06, seed + 41, 4);
    if (n > 0.5) sk.set(x, y, mixC(rgb('#2a2028'), rgb('#7a4a3a'), clamp01((y - 30) / 70)), clamp01((n - 0.5) * 3) * 0.7);
  }
  const back = new Bmp(PW, PH);
  // The woods beyond, burnt toward the crater.
  const tl = (x) => 86 + Math.sin(x * 0.05) * 3;
  const fir = R5('#10161e', 0.3);
  const bark = [rgb('#0a0a0e'), rgb('#101016'), rgb('#16161c')];
  for (let x = 0; x < PW; x++) for (let y = Math.round(tl(x)); y < 104; y++) back.set(x, y, rgb('#0c0e14'));
  for (let x = -4; x < PW + 4; x += 4 + Math.floor(r() * 3)) {
    const burnt = Math.abs(x - PIT.cx) < 70;
    if (burnt) {
      // (Stripped, black, snapped off.)
      const h = 6 + Math.floor(r() * 10);
      for (let k = 0; k < h; k++) back.set(x, Math.round(tl(x) + 2 - k), rgb('#0a0808'));
      if (r() < 0.5) back.set(x + 1, Math.round(tl(x) + 2 - h + 2), rgb('#0a0808'));
    } else pine(back, x, Math.round(tl(x) + 3), 10 + r() * 8, fir, bark, x * 7 + seed, { bare: false });
  }
  // The crater's far wall: the earth thrown back, lit orange from inside.
  const earth = R5('#5a3a2a', 0.42);
  const far = (x) => 96 - Math.max(0, 10 * Math.cos(((x - PIT.cx) / 130) * Math.PI * 0.5)) + (fbm(x * 0.12, 1, seed) - 0.5) * 3;
  for (let x = 0; x < PW; x++) {
    const top = Math.round(far(x));
    for (let y = top; y < PIT.floor + 4; y++) {
      const k = (y - top) / (PIT.floor - top + 4);
      const n = fbm(x * 0.15, y * 0.2, seed + 3);
      let c = n > 0.6 ? earth[3] : n > 0.4 ? earth[2] : earth[1];
      if (y - top < 2) c = earth[4];
      c = mixC(c, rgb('#ff7a3a'), (1 - Math.abs(x - PIT.cx) / 140) * 0.3 * (1 - k));
      c = mixC(c, rgb('#140c0c'), k * 0.5);
      back.set(x, y, c);
    }
  }
  // (Rays of thrown earth out from where it struck; molten bits.)
  for (let i = 0; i < 14; i++) {
    const a = Math.PI * (1.05 + (i / 13) * 0.9);
    for (let k = 10; k < 90; k++) {
      const x = Math.round(PIT.cx + Math.cos(a) * k * 1.6);
      const y = Math.round(PIT.floor + Math.sin(a) * k * 0.3);
      if (x < 0 || x >= PW || y < far(x) || hash2(i, k, seed) < 0.4) continue;
      back.set(x, y, mixC(earth[4], rgb('#d8a070'), 0.3), 0.5 * (1 - k / 90));
    }
  }
  for (let i = 0; i < 40; i++) {
    const x = Math.round(PIT.cx + (r() - 0.5) * 120);
    const y = Math.round(PIT.floor - 2 - r() * 14);
    if (y > far(x) + 1) back.set(x, y, r() > 0.5 ? rgb('#ff8a30') : rgb('#c83a10'));
  }
  // The near rim, in front: heaped earth, rocks, burnt stumps; darker,
  // lit along its inner lip.
  const front = new Bmp(PW, PH);
  const nr = (x) => 124 + Math.pow(Math.abs(x - PIT.cx) / 128, 1.5) * -16 + (fbm(x * 0.1, 4, seed) - 0.5) * 4;
  for (let x = 0; x < PW; x++) {
    const top = Math.round(nr(x));
    for (let y = top; y < PH; y++) {
      const n = fbm(x * 0.12, y * 0.18, seed + 5);
      let c = n > 0.62 ? earth[2] : n > 0.4 ? earth[1] : earth[0];
      if (y - top < 2) c = mixC(earth[4], rgb('#ff9a5a'), 0.35);
      c = mixC(c, rgb('#080606'), clamp01((y - top) / 24) * 0.6);
      front.set(x, y, c);
    }
  }
  for (const [x, w, h] of [[30, 5, 4], [62, 4, 3], [196, 6, 4], [226, 4, 3], [150, 3, 2]]) {
    const yb = Math.round(nr(x)) + 1;
    for (let y = yb - h; y <= yb; y++) for (let dx = -w; dx <= w; dx++) {
      if ((dx * dx) / (w * w) + ((y - yb) ** 2) / (h * h) > 1) continue;
      front.set(x + dx, y, dx < 0 ? rgb('#6a5a5a') : rgb('#3a3036'));
    }
  }
  const stumps = [];
  for (const [x, h, lean] of [[14, 16, 0.2], [44, 11, -0.3], [212, 14, 0.4], [240, 18, -0.1]]) {
    const yb = Math.round(nr(x)) + 1;
    for (let k = 0; k < h; k++) {
      const xx = Math.round(x + lean * k);
      front.set(xx, yb - k, rgb('#0a0606'));
      front.set(xx + 1, yb - k, k % 3 === 0 ? rgb('#3a1a10') : rgb('#140a08'));
    }
    stumps.push({ x: Math.round(x + lean * h), y: yb - h });
  }
  return { sky: sk.canvas(), back: back.canvas(), front: front.canvas(), stumps, nr };
}

// The pod, big, lying in the crater, nose down a little: a capsule of
// dark alloy in bands, its heat shield (the underside) black and blistered,
// streaks of char back from it; ribs; a porthole; two fins; the hatch on
// top (drawn live: it blows).
function paintPodBig() {
  const { w, h } = PIT.pod;
  const b = new Bmp(w, h);
  const hull = R5('#5a5a74', 0.5);
  const cx = w / 2;
  const cy = h * 0.56;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const nx = (x - cx) / (w / 2);
    const ny = (y - cy) / (h * 0.44);
    // (A capsule: rounded ends, a flatter middle.)
    const e = Math.pow(Math.abs(nx), 3) + ny * ny;
    if (e > 1) continue;
    const nz = Math.sqrt(Math.max(0, 1 - e));
    // Lit by the fires below and to the left; the sky's dim on top.
    const lit = clamp01(0.25 + nz * 0.35 - ny * 0.3 - nx * 0.15);
    let c = hull[Math.min(4, Math.max(0, Math.round(lit * 4.4)))];
    const band = Math.abs(((x - cx) % 11 + 11) % 11 - 5.5) < 0.6;
    if (band) c = hull[0];
    if (Math.abs(x - cx - 3) < 1 && ny < 0) c = mixC(hull[0], rgb('#40e8d0'), 0.35);
    // (The heat shield: char, blistered, the streaks it threw back.)
    const sc = ny * 0.9 + (fbm(x * 0.25, y * 0.35, 77) - 0.5) * 0.9 + (nx > 0 ? nx * 0.3 : 0);
    if (sc > 0.35) c = mixC(c, rgb('#100a0c'), clamp01((sc - 0.35) * 2.2));
    if (sc > 0.55 && hash2(x, y, 3) > 0.9) c = rgb('#3a2a24');
    // (A rim of light off the near fires along its lower edge.)
    if (e > 0.82 && ny > 0.2) c = mixC(c, rgb('#ff8a4a'), 0.45);
    // (And the sky's on its top edge.)
    if (e > 0.8 && ny < -0.4) c = mixC(c, rgb('#8a90b8'), 0.4);
    b.set(x, y, c);
  }
  // Fins, aft (to the left).
  poly(b, [[6, cy - 2], [-1, cy - 12], [2, cy - 12], [12, cy - 4]], hull[1]);
  poly(b, [[6, cy + 4], [-1, h - 1], [3, h - 1], [12, cy + 6]], hull[0]);
  // The porthole, a ring of bolts.
  const ox = Math.round(cx + 12);
  const oy = Math.round(cy - 3);
  for (let y = oy - 5; y <= oy + 5; y++) for (let x = ox - 5; x <= ox + 5; x++) {
    const d = Math.hypot(x - ox, y - oy);
    if (d > 4.8) continue;
    b.set(x, y, d > 3.6 ? (Math.round(Math.atan2(y - oy, x - ox) * 3) % 2 ? hull[4] : hull[1]) : d > 2.8 ? rgb('#0e1a1c') : rgb('#16403e'));
  }
  return b.canvas();
}

// A fire: tongues of flame, licking, the base white-hot.
function flame(g, x, y, t, size, ph) {
  for (let i = 0; i < 4; i++) {
    const dx = (i - 1.5) * size * 0.9;
    const hh = size * (2.2 + Math.sin(t * 9 + ph + i * 1.9) * 0.8 + (i === 1 || i === 2 ? 1 : 0));
    for (let k = 0; k < hh; k++) {
      const f = k / hh;
      const w = Math.max(1, Math.round((1 - f) * size * 0.9));
      const sway = Math.sin(t * 7 + ph + i + k * 0.4) * f * 1.2;
      g.fillStyle = f < 0.2 ? '#fff0b0' : f < 0.5 ? '#ffb030' : f < 0.8 ? '#f06018' : '#a02a10';
      g.fillRect(Math.round(x + dx + sway - w / 2), Math.round(y - k), w, 1);
    }
  }
}

// ------------------------------------------------------------ painted once
export function paintOutworld(info) {
  const seed = info.seed >>> 0;
  const r = rngOf(seed ^ 0x0d7);
  return {
    space: paintSpace(seed), planet: paintPlanet(seed), ship: paintShipX(),
    lake: paintLake(seed, r), crater: paintCrater(seed, r), pod: paintPodBig(),
    debris: Array.from({ length: 40 }, () => ({ a: r() * 6.28, v: 8 + r() * 30, spin: (r() - 0.5) * 8, s: 1 + Math.floor(r() * 3), c: ['#6a6a8a', '#a8a8c8', '#4a4a6a', '#ff9a40', '#40e8d0'][Math.floor(r() * 5)] })),
    pods: [{ a: -0.6, v: 26 }, { a: 2.4, v: 20 }, { a: -2.2, v: 18 }, { a: 1.2, v: 24 }],
    embers: Array.from({ length: 50 }, () => ({ x: r() * PW, ph: r(), v: 0.08 + r() * 0.12, sw: r() * 6 })),
    fires: [[22, 0], [70, 1], [188, 2], [232, 3], [150, 4]],
    streaks: Array.from({ length: 4 }, () => ({ x: 40 + r() * 180, y: 8 + r() * 30, at: r() * 4, len: 10 + r() * 16 })),
    sparks: Array.from({ length: 24 }, () => ({ k: r(), d: (r() - 0.5) * 2, v: r() })),
  };
}

// ------------------------------------------------------------ drawing
// High over Thessa: `s` { t, alarm (0-1), blast (since the blast, or <0),
// pod (since the pods went, or <0) }.
export function drawOrbit(g, art, s) {
  const { t } = s;
  g.drawImage(art.space, 0, 0);
  // (A far sun's glare, top left.)
  glow(g, 14, 10, 60, '#fff0d0', 0.22);
  glow(g, 14, 10, 14, '#ffffff', 0.5);
  // The world, slowly turning under its clouds (a drift of a pixel or two).
  g.drawImage(art.planet, Math.round(-t * 0.3), 0);
  // Your ship, going by; then broken, her halves turning apart.
  const sx = 40 + t * 3.2;
  const sy = 34;
  const S = art.ship;
  const drive = (x0, y0, ang, a) => {
    for (const dy of [-6, 0, 6]) {
      const fl = 0.8 + 0.2 * Math.sin(t * 30 + dy);
      const x = x0;
      const y = y0 + dy;
      g.save();
      g.translate(x, y);
      g.rotate(ang);
      g.globalCompositeOperation = 'lighter';
      g.globalAlpha = a * fl;
      g.fillStyle = '#80f0ff';
      g.fillRect(-10, -1, 10, 3);
      g.fillStyle = '#e0ffff';
      g.fillRect(-4, 0, 4, 1);
      g.restore();
      glow(g, x - 4, y, 8, '#60e0ff', 0.25 * a * fl);
    }
  };
  if (s.blast < 0) {
    g.drawImage(S.whole, Math.round(sx), sy);
    drive(sx + 1, sy + 23, 0, 1);
    // (Her alarm lights, red along her.)
    if (s.alarm > 0 && Math.floor(t * 4) % 2 === 0) for (const x of [24, 50, 76, 102, 128]) {
      dot(g, sx + x, sy + 17, '#ff3030');
      glow(g, sx + x, sy + 17, 5, '#ff3030', 0.4);
    }
    // (Fire breaking out along her, before the blast.)
    if (s.alarm > 0.3) for (let i = 0; i < 3; i++) {
      const k = (t * 1.5 + i * 0.33) % 1;
      const x = sx + SHIPX.cut - 14 + i * 12;
      glow(g, x, sy + 20, 6 + k * 8, '#ff9a40', (1 - k) * 0.6);
      dot(g, x, sy + 20 - k * 6, '#ffe0a0', 1 - k);
    }
  } else {
    const k = s.blast;
    const spin = Math.min(0.5, k * 0.12);
    const apart = k * 6 + k * k * 0.6;
    g.save();
    g.translate(sx + SHIPX.cut - apart, sy + 23 + k * 1.5);
    g.rotate(-spin);
    g.drawImage(S.aft, -SHIPX.cut, -23);
    g.restore();
    if (k < 1.2) drive(sx + 1 - apart, sy + 23, -spin, 1 - k / 1.2);
    g.save();
    g.translate(sx + SHIPX.cut + apart * 1.2, sy + 23 - k * 2);
    g.rotate(spin * 0.8);
    g.drawImage(S.fore, -SHIPX.cut, -23);
    g.restore();
    // (Fire inside the broken ends.)
    for (const side of [-1, 1]) {
      const x = sx + SHIPX.cut + side * apart * (side > 0 ? 1.2 : 1);
      glow(g, x, sy + 23, 10, '#ff8040', 0.5 * Math.max(0.3, 1 - k / 4));
    }
    // The blast: a white flash, a ball of fire swelling and going dull, a
    // ring going out, the debris.
    const bx = sx + SHIPX.cut;
    const by = sy + 23;
    if (k < 0.25) {
      g.fillStyle = `rgba(255,255,255,${(0.7 * (1 - k / 0.25)).toFixed(3)})`;
      g.fillRect(0, 0, PW, PH);
    }
    const fr = 6 + k * 26;
    if (k < 2.5) {
      glow(g, bx, by, fr * 1.8, '#ffb060', 0.8 * (1 - k / 2.5));
      glow(g, bx, by, fr * 0.8, '#fff4d0', 0.9 * (1 - k / 1.4));
      for (let i = 0; i < 26; i++) {
        const a = (i / 26) * Math.PI * 2;
        const rr = fr * (0.6 + ((i * 7) % 5) * 0.1);
        dot(g, bx + Math.cos(a) * rr, by + Math.sin(a) * rr * 0.8, i % 3 ? '#ffb060' : '#fff0c0', clamp01(1 - k / 2.2));
      }
      g.strokeStyle = `rgba(200,230,255,${(0.6 * clamp01(1 - k / 1.6)).toFixed(3)})`;
      g.beginPath();
      g.ellipse(bx, by, 4 + k * 70, 2 + k * 18, 0, 0, Math.PI * 2);
      g.stroke();
    }
    for (const d of art.debris) {
      const x = bx + Math.cos(d.a) * d.v * k;
      const y = by + Math.sin(d.a) * d.v * k * 0.7;
      g.save();
      g.translate(Math.round(x), Math.round(y));
      g.rotate(d.spin * k);
      g.fillStyle = d.c;
      g.globalAlpha = d.c === '#ff9a40' ? clamp01(1 - k / 2) : 1;
      g.fillRect(-1, -1, d.s, 1 + (d.s > 1 ? 1 : 0));
      g.restore();
    }
    g.globalAlpha = 1;
  }
  // The pods: flung out of her, their thrusters blinking; yours away
  // down toward the world, tumbling, the air beginning to burn about it.
  if (s.pod >= 0) {
    const k = s.pod;
    const bx = sx + SHIPX.cut;
    const by = sy + 26;
    for (const [i, p] of art.pods.entries()) {
      const x = bx + Math.cos(p.a) * p.v * k;
      const y = by + Math.sin(p.a) * p.v * k * 0.7;
      drawPodSmall(g, x, y, k * (1 + i), t, 0);
      if (Math.floor(t * 6 + i) % 3 === 0) dot(g, x - Math.cos(p.a) * 4, y - Math.sin(p.a) * 3, '#a0fff0');
    }
    // Yours.
    const yk = ease(clamp01(k / 3.7));
    const px = bx + 6 + yk * 60 + k * 2;
    const py = by + 4 + yk * yk * 62;
    const hot = clamp01((k - 1.8) / 1.8);
    if (hot > 0) {
      // (The first of the fire about it: a glow, a trail going back.)
      for (let j = 1; j < 12; j++) {
        const q = j / 12;
        dot(g, px - q * 14 * hot, py - q * 16 * hot, j < 4 ? '#ffe0a0' : '#ff8040', (1 - q) * hot);
      }
      glow(g, px, py, 6 + hot * 8, '#ff9a50', 0.6 * hot);
    }
    drawPodSmall(g, px, py, k * 3, t, hot * 0.6);
    // (A ring marking it, for a moment: that one is you.)
    if (k > 0.3 && k < 2.4) {
      const a = Math.sin(((k - 0.3) / 2.1) * Math.PI);
      g.strokeStyle = `rgba(160,255,240,${(0.7 * a).toFixed(3)})`;
      g.strokeRect(Math.round(px) - 6, Math.round(py) - 5, 12, 10);
    }
  }
}

// Night over the lake: `s` { t (since the cut), fall (0-1: across the
// sky to beyond the hills), hit (since it came down, or <0) }.
export function drawFall(g, art, s) {
  const { t } = s;
  const L = art.lake;
  g.drawImage(L.sky, 0, 0);
  // Where it is: coming in from high on the left, steepening, to beyond
  // the hills at the right.
  const at = (f) => {
    const e = f * f;
    return [lerp(-12, LAKE.hit.x, f), lerp(8, LAKE.hit.y + 4, e * 0.6 + f * 0.4)];
  };
  const f = s.fall;
  const [hx, hy] = at(f);
  const lit = s.hit < 0 ? 0.35 + f * 0.5 : 0;
  const head = (x, y, a, scale) => {
    // The trail: ionised air going back along its path, violet, then
    // green, fading; sparks breaking off.
    for (let j = 0; j < 40; j++) {
      const q = j / 40;
      const [tx, ty] = at(Math.max(0, f - q * 0.32));
      const ty2 = scale < 0 ? 2 * LAKE.y - ty : ty;
      const col = q < 0.12 ? '#f0fff0' : q < 0.4 ? '#90ffb0' : q < 0.7 ? '#b080ff' : '#5a3a9a';
      dot(g, tx, ty2, col, a * (1 - q) * 0.9);
      if (q < 0.3) dot(g, tx, ty2 + 1, col, a * (1 - q) * 0.5);
    }
    for (const sp of art.sparks) {
      const ff = Math.max(0, f - sp.k * 0.25);
      const [px0, py0] = at(ff);
      const age = (f - ff) * 6;
      const px1 = px0 + sp.d * age * 10;
      const py1 = py0 + age * age * 10 * sp.v;
      const yy = scale < 0 ? 2 * LAKE.y - py1 : py1;
      dot(g, px1, yy, sp.v > 0.5 ? '#ffd080' : '#a0ffc0', a * clamp01(1 - age / 1.5));
    }
    const yy = scale < 0 ? 2 * LAKE.y - y : y;
    glow(g, x, yy, 30, '#a0ffc0', 0.35 * a);
    glow(g, x, yy, 10, '#ffffff', 0.7 * a);
    dot(g, x, yy, '#ffffff', a);
    dot(g, x + 1, yy, '#e0ffe8', a);
    dot(g, x, yy + 1, '#e0ffe8', a);
  };
  if (s.hit < 0) {
    // (Its light over the whole sky.)
    glow(g, hx, hy, 140, '#80ffc0', 0.12 * lit);
    head(hx, hy, 1, 1);
  }
  g.drawImage(L.far, 0, 0);
  // It comes down: the sky beyond the hills goes white, a dome of fire
  // swells up over them and dulls, the shock goes out; the glow, and the
  // smoke going up.
  if (s.hit >= 0) {
    const k = s.hit;
    const { x, y } = LAKE.hit;
    if (k < 0.3) {
      g.fillStyle = `rgba(230,255,240,${(0.8 * (1 - k / 0.3)).toFixed(3)})`;
      g.fillRect(0, 0, PW, PH);
    }
    const dr = 6 + Math.min(1, k) * 26;
    const da = clamp01(1 - k / 2.2);
    glow(g, x, y, dr * 2.6, '#ffb070', 0.6 * da + 0.15);
    g.fillStyle = `rgba(255,${Math.round(200 - k * 60)},${Math.round(140 - k * 60)},${(0.85 * da).toFixed(3)})`;
    g.beginPath();
    g.arc(x, y, dr, Math.PI, 0);
    g.fill();
    g.fillStyle = `rgba(255,250,230,${(0.9 * clamp01(1 - k / 0.9)).toFixed(3)})`;
    g.beginPath();
    g.arc(x, y, dr * 0.55, Math.PI, 0);
    g.fill();
    g.strokeStyle = `rgba(220,240,255,${(0.5 * clamp01(1 - k / 1.4)).toFixed(3)})`;
    g.beginPath();
    g.ellipse(x, y, 6 + k * 90, 2 + k * 10, 0, Math.PI, 0);
    g.stroke();
    for (let i = 0; i < 10; i++) {
      const q = ((k * 0.25 + i / 10) % 1);
      const rr = 3 + q * 8;
      g.globalAlpha = 0.45 * (1 - q) * clamp01(k * 2);
      g.fillStyle = q < 0.3 ? '#6a4a40' : '#3a3038';
      g.beginPath();
      g.arc(x + Math.sin(i * 2 + k) * 3 + q * 10, y - 6 - q * 50, rr, 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 1;
  }
  g.drawImage(L.near, 0, 0);
  g.drawImage(L.lake, 0, 0);
  // The lake: the sky in it, broken by ripples; the fireball's light in it.
  g.save();
  g.beginPath();
  g.rect(0, LAKE.y + 1, PW, PH - LAKE.y);
  g.clip();
  g.globalAlpha = 0.35;
  g.translate(0, 2 * LAKE.y + 1);
  g.scale(1, -1);
  g.drawImage(L.sky, 0, 0);
  g.drawImage(L.far, 0, 0);
  g.drawImage(L.near, 0, 0);
  g.restore();
  g.save();
  g.beginPath();
  g.rect(0, LAKE.y + 1, PW, PH - LAKE.y);
  g.clip();
  if (s.hit < 0) head(hx + Math.sin(t * 9) * 1, hy, 0.55, -1);
  if (s.hit >= 0) glow(g, LAKE.hit.x, 2 * LAKE.y - LAKE.hit.y, 50, '#ffb070', 0.4 * clamp01(1 - s.hit / 3) + 0.1);
  for (let y = LAKE.y + 2; y < PH; y += 2) {
    for (let x = 0; x < PW; x += 1) {
      const w = Math.sin(x * 0.21 + y * 1.3 + t * 1.1) + Math.sin(x * 0.05 - t * 0.6 + y * 0.4);
      if (w > 1.55) dot(g, x, y, '#4a6a98', 0.5);
    }
  }
  g.restore();
  g.drawImage(L.shore, 0, 0);
  // (The hut's window, and its light on the water.)
  glow(g, L.hut.x + 3, L.hut.y - 5, 10, '#ffb060', 0.3);
  for (let i = 0; i < 4; i++) dot(g, L.hut.x + 3 + Math.sin(t * 2 + i) * 1.5, L.hut.y + 6 + i * 2, '#ffc070', 0.5 - i * 0.1);
  // The light of it on everything, as it passes.
  if (lit > 0) {
    g.save();
    g.globalCompositeOperation = 'lighter';
    g.fillStyle = `rgba(90,255,170,${(0.06 * lit).toFixed(3)})`;
    g.fillRect(0, 0, PW, PH);
    g.restore();
  }
  if (s.hit >= 0) {
    g.save();
    g.globalCompositeOperation = 'lighter';
    g.fillStyle = `rgba(255,170,110,${(0.12 * clamp01(1 - s.hit / 2.5)).toFixed(3)})`;
    g.fillRect(0, 0, PW, PH);
    g.restore();
  }
  // (Birds going up off the far woods when it hits.)
  if (s.hit > 0.2) for (let i = 0; i < 9; i++) {
    const k = s.hit - 0.2;
    const x = 150 + i * 7 - k * (10 + i * 3);
    const y = 96 - k * (16 + (i % 3) * 6) + Math.sin(k * 6 + i) * 2;
    const up = Math.floor(t * 8 + i) % 2;
    g.fillStyle = '#05060a';
    g.fillRect(Math.round(x), Math.round(y), 1, 1);
    g.fillRect(Math.round(x) - 1, Math.round(y) - up, 1, 1);
    g.fillRect(Math.round(x) + 1, Math.round(y) - up, 1, 1);
  }
}

// The crater: `s` { t (since the cut), cool (0-1: the pod's seams going
// dark), open (since the hatch blew, or <0), climb (0-1: up out of the
// hatch), stand (since you got down, or <0), look }; `sprite` draws a
// character's own sprite.
export function drawCrater(g, art, s, sprite) {
  const { t } = s;
  const C = art.crater;
  g.drawImage(C.sky, 0, 0);
  // The last of your ship, far up, still burning as it falls.
  for (const q of art.streaks) {
    const k = ((t * 0.3 + q.at) % 2.2) / 2.2;
    if (k > 0.6) continue;
    const a = Math.sin((k / 0.6) * Math.PI);
    for (let j = 0; j < q.len; j++) dot(g, q.x + k * 40 - j * 0.9, q.y + k * 30 - j * 0.7, j < 2 ? '#ffffff' : '#ffb070', a * (1 - j / q.len));
  }
  // The smoke going up off it, a column leaning away in the night air,
  // lit orange from under.
  for (let i = 0; i < 18; i++) {
    const q = (t * 0.06 + i / 18) % 1;
    const x = PIT.cx + 4 + q * q * 60 + Math.sin(i * 2.3 + t * 0.3) * 4 * q;
    const y = 96 - q * 96;
    const rr = 5 + q * 16;
    g.globalAlpha = 0.5 * (1 - q) * clamp01(q * 6);
    g.fillStyle = q < 0.25 ? '#6a3a2a' : q < 0.5 ? '#3a2a2e' : '#24202a';
    g.beginPath();
    g.arc(x, y, rr, 0, Math.PI * 2);
    g.fill();
  }
  g.globalAlpha = 1;
  g.drawImage(C.back, 0, 0);
  // The glow off the pod and the fires, up the crater walls.
  const heat = 1 - s.cool * 0.7;
  glow(g, PIT.cx, PIT.floor - 10, 110, '#ff7a3a', 0.28 * heat);
  // The pod, its seams glowing and cooling; steam going up off it.
  const P = PIT.pod;
  g.drawImage(art.pod, P.x, P.y);
  g.save();
  g.globalCompositeOperation = 'lighter';
  // (Its seams, and the char of the heat shield, still glowing.)
  for (let x = P.x + 5; x < P.x + P.w - 4; x++) {
    const u = (x - P.x - P.w / 2);
    if (Math.abs(((u % 11) + 11) % 11 - 5.5) < 0.6) {
      for (let y = P.y + 8; y < P.y + P.h - 4; y++) {
        const a = (0.35 + 0.15 * Math.sin(t * 3 + x)) * heat * clamp01((y - P.y - 8) / 14);
        g.fillStyle = `rgba(255,${Math.round(110 + 80 * (1 - heat))},50,${a.toFixed(3)})`;
        g.fillRect(x, y, 1, 1);
      }
    }
    if (hash2(x, 1, 5) > 0.55) {
      const a = (0.4 + 0.3 * Math.sin(t * 5 + x * 0.7)) * heat;
      g.fillStyle = `rgba(255,90,30,${a.toFixed(3)})`;
      g.fillRect(x, P.y + P.h - 5 + Math.round(hash2(x, 2, 5) * 3), 1, 1);
    }
  }
  g.restore();
  // (The porthole: lit from inside, a face in it before the hatch goes.)
  glow(g, P.x + P.w / 2 + 12, P.y + P.h * 0.56 - 3, 7, '#40e8d0', 0.3 + 0.1 * Math.sin(t * 2));
  // The hatch on top: shut and hot; then blown, spinning away, a burst of
  // steam; its rim left.
  const H = PIT.hatch;
  if (s.open < 0) {
    g.fillStyle = '#5a5a74';
    g.fillRect(H.x - 6, H.y - 1, 12, 3);
    g.fillStyle = '#a8a8c4';
    g.fillRect(H.x - 6, H.y - 1, 12, 1);
    g.fillStyle = `rgba(255,140,70,${(0.6 * heat).toFixed(3)})`;
    g.fillRect(H.x - 6, H.y + 2, 12, 1);
  } else {
    const k = s.open;
    const hx2 = H.x + k * 40;
    const hy2 = H.y - 1 - k * 50 + k * k * 40;
    if (hy2 < PH) {
      g.save();
      g.translate(hx2, hy2);
      g.rotate(k * 9);
      g.fillStyle = '#5a5a74';
      g.fillRect(-6, -1, 12, 3);
      g.fillStyle = '#a8a8c4';
      g.fillRect(-6, -1, 12, 1);
      g.restore();
    }
    g.fillStyle = '#2a2a3a';
    g.fillRect(H.x - 6, H.y, 12, 2);
  }
  // Steam: always a little, a burst when the hatch goes.
  for (let i = 0; i < 14; i++) {
    const q = (t * 0.35 + i / 14) % 1;
    const burst = s.open >= 0 && s.open < 1.2 ? 1 - s.open / 1.2 : 0;
    const x = P.x + 6 + ((i * 13) % (P.w - 12)) + Math.sin(q * 4 + i) * 3 + q * 8;
    const y = P.y + 4 - q * (30 + burst * 30);
    const rr = 1 + q * 5;
    g.globalAlpha = (0.25 + burst * 0.4) * (1 - q);
    g.fillStyle = q < 0.3 ? '#d8d0d8' : '#8a8090';
    g.beginPath();
    g.arc(x, y, rr, 0, Math.PI * 2);
    g.fill();
  }
  g.globalAlpha = 1;
  // You: hauling yourself up out of the hatch; then down onto the ground
  // beside it; then looking about you.
  const L = s.look;
  if (s.climb > 0 && s.stand < 0) {
    const k = ease(s.climb);
    g.save();
    g.beginPath();
    g.rect(0, 0, PW, H.y + 1);
    g.clip();
    sprite(g, L, 0, k < 0.9 ? 3 : 0, H.x, H.y + 24 - k * 22);
    g.restore();
  } else if (s.stand >= 0) {
    const k = s.stand;
    const jump = clamp01(k / 0.6);
    const x0 = H.x;
    const x1 = H.x - 30;
    const x = lerp(x0, x1, ease(jump));
    const y = lerp(H.y + 2, PIT.floor + 1, ease(jump)) - Math.sin(jump * Math.PI) * 6;
    // (Looking about: one way, the other, then up.)
    const dir = k < 0.6 ? 1 : k < 1.6 ? 0 : k < 2.4 ? 1 : k < 3.2 ? 3 : 2;
    sprite(g, L, dir, k < 0.6 ? 1 : 0, x, y);
    // (Your own light, if your skin gives it.)
    if (L && L.mut && L.mut.includes('glow')) glow(g, x, y - 12, 14, '#60ffd0', 0.25);
    glow(g, x + 8, y - 10, 18, '#ff8a4a', 0.2 * heat);
  }
  g.drawImage(C.front, 0, 0);
  // Fires on the rim and in the stumps; embers going up.
  for (const [i, [fx]] of art.fires.entries()) {
    const fy = Math.round(C.nr(fx));
    glow(g, fx, fy - 4, 18, '#ff8a3a', 0.32 + 0.05 * Math.sin(t * 7 + i));
    flame(g, fx, fy + 1, t, 1.6, i * 2.1);
  }
  for (const st of C.stumps) {
    glow(g, st.x, st.y - 2, 10, '#ff8a3a', 0.3);
    flame(g, st.x + 0.5, st.y + 1, t, 1, st.x);
  }
  for (const e of art.embers) {
    const q = (t * e.v + e.ph) % 1;
    dot(g, e.x + Math.sin(q * 8 + e.sw) * 4, PH - q * 120, q < 0.5 ? '#ffd070' : '#ff7a30', (1 - q) * 0.9);
  }
}
