// (Round 124) A brigand's opening, painted (the scene, its words and its
// timing: see game/originintros.js). Three shots:
//   - an hour before dawn on a moonlit sea: a fat merchantman (the same
//     ship-painting as the wreck's opening, turned about and in the
//     moon's light), her stern lanterns lit, and your sloop coming up
//     on her quarter under black canvas, the Black Gull at her masthead;
//     a lighthouse sweeping on the headland; the bow gun's flash and its
//     smoke, a ball's splash across her bow; a second; her colours coming
//     down;
//   - the cove at sunrise: the haven under its cliffs, the palms, the
//     patched tents and the upturned hull they meet under, the fire, the
//     black flag on its pole, two of the Brethren's ships at anchor; your
//     sloop coming in, sails coming down, the anchor going; the boat
//     rowing you in to the jetty; the brethren crowding down to it;
//   - the jetty, close: you walking up it, the brethren cheering, pistols
//     fired in the air, the chief stepping out to meet you.
import { VIEW_W, VIEW_H } from '../config.js';
import { Bmp, ramp, rgb, mixC, sky, stars, cloud, mountains, hills, palm, bush, poly, seg, hash2, fbm, rngOf } from './brush.js';
import { drawPerson } from './scenekit.js';
import { paintShip, SHIP, MASTS, sheer } from '../game/intros.js';

const PW = VIEW_W / 2;
const PH = VIEW_H / 2;
export const NIGHT_HZ = 84;
const COVE_SEA = 100;
const R4 = (h, s = 0.34) => ramp(h, 4, { spread: s });
const R5 = (h, s = 0.4) => ramp(h, 5, { spread: s });
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const ease = (k) => (k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k));
const lerp = (a, b, k) => a + (b - a) * k;
const css = (c) => `rgb(${c[0]},${c[1]},${c[2]})`;
const hashf = (x, y, s) => hash2(x, y, s);

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}
// A canvas tinted (the moon's blue; the dawn's).
function tint(src, col, a) {
  const c = makeCanvas(src.width, src.height);
  const g = c.getContext('2d');
  g.drawImage(src, 0, 0);
  g.globalCompositeOperation = 'source-atop';
  g.fillStyle = `rgba(${col[0]},${col[1]},${col[2]},${a})`;
  g.fillRect(0, 0, c.width, c.height);
  return c;
}

// ------------------------------------------------------------ the sloop
// Your sloop, side on, heading right: a low black hull, a red strake, her
// gunports; one tall mast, the gaff mainsail and the jib, both black and
// patched; or (`furled`) at anchor, her canvas down and stowed. In two:
// what's behind her people on deck, and her side in front of them.
export const SLOOP = { w: 86, h: 80, water: 64, mast: 42, gun: 68 };
export function sloopSheer(x) {
  const W = SLOOP.water;
  if (x > 52) {
    const u = (x - 52) / 24;
    return W - 9 - Math.round(4 * u * u);
  }
  const u = (52 - x) / 44;
  return W - 9 - Math.round(2.5 * u * u);
}
function paintSloop(furled) {
  const back = new Bmp(SLOOP.w, SLOOP.h);
  const front = new Bmp(SLOOP.w, SLOOP.h);
  const W = SLOOP.water;
  const M = SLOOP.mast;
  const rope = rgb('#141012');
  const canvasR = [rgb('#16141a'), rgb('#1e1c24'), rgb('#26242e'), rgb('#302e3a'), rgb('#4a4c62')];
  const rim = rgb('#7a84aa');
  // The stays and the shrouds.
  seg(back, M, 3, 84, sloopSheer(76) - 7, rope, 0.9);
  seg(back, M, 4, 7, sloopSheer(7) - 1, rope, 0.7);
  for (const d of [-7, -4, 4, 7]) seg(back, M + Math.sign(d), 9, M + d, sloopSheer(M + d) + 1, rope, 0.55);
  // The bowsprit.
  seg(back, 70, sloopSheer(70) - 1, 85, sloopSheer(76) - 7, rgb('#3a2618'));
  seg(back, 70, sloopSheer(70), 84, sloopSheer(76) - 6, rgb('#24180e'));
  // The mast, lit down its right side; its cap.
  for (let y = 2; y <= sloopSheer(M) + 1; y++) {
    back.set(M, y, rgb('#2a1c12'));
    back.set(M + 1, y, rgb(y < 8 ? '#3a2818' : '#6a5038'));
  }
  for (let x = M - 1; x <= M + 2; x++) back.set(x, 2, rgb('#140c08'));
  const fill = (pts, edgeLit) => {
    const ys = pts.map((p) => p[1]);
    const y0 = Math.min(...ys);
    const y1 = Math.max(...ys);
    for (let y = y0; y <= y1; y++) {
      const xs = [];
      for (let i = 0; i < pts.length; i++) {
        const [ax, ay] = pts[i];
        const [bx, by] = pts[(i + 1) % pts.length];
        if ((ay <= y && by > y) || (by <= y && ay > y)) xs.push(ax + ((y - ay) / (by - ay)) * (bx - ax));
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const xl = Math.round(xs[k]);
        const xr = Math.round(xs[k + 1]);
        for (let x = xl; x <= xr; x++) {
          const u = (x - xl) / Math.max(1, xr - xl);
          // (The belly of it; seams; patches; the moon along one edge.)
          let c = canvasR[1 + Math.round(Math.sin(u * Math.PI) * 1.4)];
          if ((x + Math.round(y * 0.25)) % 5 === 0) c = canvasR[0];
          const pa = hash2(Math.floor(x / 6), Math.floor(y / 5), 31);
          if (pa > 0.86) c = pa > 0.93 ? rgb('#3a3028') : rgb('#2a2a3a');
          if (x === xr && edgeLit) c = rim;
          else if (x === xl || x === xr) c = canvasR[3];
          back.set(x, y, c);
        }
      }
    }
  };
  if (!furled) {
    // The gaff and the boom; the mainsail between; the jib.
    fill([[M - 1, 9], [M - 30, 1], [5, W - 15], [M - 1, W - 15]], true);
    seg(back, M, 9, M - 31, 1, rgb('#2a1c12'));
    seg(back, M, W - 15, 3, W - 14, rgb('#2a1c12'));
    for (let y = 9; y < W - 15; y += 4) back.set(M - 1, y, rgb('#7a7a8a'));
    fill([[M + 2, 5], [83, sloopSheer(76) - 7], [M + 6, W - 15]], true);
    // (A reef band across the main.)
    seg(back, M - 26, 12, M - 1, 17, canvasR[0], 0.8);
  } else {
    // Stowed: the main along the boom, gaff down on it, ties round; the
    // jib on the bowsprit.
    seg(back, M, W - 15, 3, W - 14, rgb('#2a1c12'));
    for (let x = 4; x < M; x++) for (let y = W - 18; y < W - 15; y++) back.set(x, y, (x % 6 === 0) ? rgb('#5a4a3a') : canvasR[y === W - 18 ? 3 : 1]);
    seg(back, M, W - 19, 6, W - 18, rgb('#2a1c12'));
    for (let x = 70; x < 84; x++) back.set(x, sloopSheer(76) - 7 + Math.round((x - 84) * -0.35) - 1, canvasR[2]);
  }
  // The hull: her rail, lit along the top; a red strake; planking; the
  // gunports, lids up; tarred below; the transom, a lantern on it.
  for (let x = 4; x <= 77; x++) {
    const top = sloopSheer(x);
    let bottom = W + 4;
    if (x > 66) bottom = Math.min(bottom, top + Math.round((77 - x) * 1.6));
    if (x < 9) bottom = Math.round(W + 4 - (9 - x) * 1.5);
    for (let y = top; y <= bottom; y++) {
      const r = y - top;
      let c;
      if (r === 0) c = rgb('#8a7a6a');
      else if (r === 1) c = rgb('#3a2a24');
      else if (y === W - 5 || y === W - 4) c = rgb(y === W - 5 ? '#8a2a24' : '#5a1a18');
      else if (y >= W) c = rgb('#14201e');
      else c = (y - top) % 3 === 0 ? rgb('#1a1418') : rgb('#241c20');
      if (x > 74 || x < 6) c = mixC(c, [0, 0, 0], 0.3);
      front.set(x, y, c);
    }
  }
  for (const gx of [28, 44, 58]) {
    const gy = W - 8;
    for (let y = gy; y < gy + 2; y++) for (let x = gx; x < gx + 2; x++) front.set(x, y, rgb('#0a0606'));
    front.set(gx, gy - 1, rgb('#6a2a24'));
    front.set(gx + 1, gy - 1, rgb('#6a2a24'));
  }
  // The bow chaser, its muzzle over the rail.
  for (let x = SLOOP.gun - 3; x <= SLOOP.gun + 2; x++) front.set(x, sloopSheer(SLOOP.gun) - 1, rgb(x === SLOOP.gun + 2 ? '#0a0a0c' : '#2a2a30'));
  front.set(SLOOP.gun - 2, sloopSheer(SLOOP.gun) - 2, rgb('#4a4a54'));
  // (The lantern on her stern.)
  front.set(5, sloopSheer(5) - 2, rgb('#3a2a1a'));
  front.set(5, sloopSheer(5) - 3, rgb('#ffcc6a'));
  return { back: back.canvas(), front: front.canvas() };
}

// A ship of the Brethren at anchor, small and far: hull, two bare masts,
// her yards with the canvas furled on them.
function paintBrig(b, x0, wl, w, seed) {
  const r = rngOf(seed);
  const hull = [rgb('#1e1a1e'), rgb('#2a2228'), rgb('#3a3036'), rgb('#6a5a50')];
  const top = (x) => wl - 5 - Math.round(Math.pow(Math.abs(x - (x0 + w * 0.55)) / (w * 0.5), 2) * 2);
  for (let x = x0; x < x0 + w; x++) {
    const t = top(x);
    const bot = x > x0 + w - 6 ? t + (x0 + w - x) : wl + 1;
    for (let y = t; y <= bot; y++) b.set(x, y, y === t ? hull[3] : y === wl - 3 ? rgb('#5a2420') : y % 2 ? hull[0] : hull[1]);
  }
  seg(b, x0 + w - 2, top(x0 + w - 2) - 1, x0 + w + 9, top(x0 + w - 2) - 5, hull[2]);
  for (const [mx, mh] of [[x0 + Math.round(w * 0.36), Math.round(w * 0.82)], [x0 + Math.round(w * 0.7), Math.round(w * 0.9)]]) {
    for (let y = wl - 5 - mh; y < wl - 5; y++) b.set(mx, y, hull[2]);
    for (const k of [0.3, 0.6]) {
      const yy = Math.round(wl - 5 - mh * (1 - k));
      const half = Math.round(w * (0.18 + k * 0.08));
      for (let x = mx - half; x <= mx + half; x++) {
        b.set(x, yy, hull[2]);
        b.set(x, yy + 1, rgb('#8a8070'), 0.7);
      }
    }
    seg(b, mx, wl - 5 - mh, x0 + 2, top(x0 + 2), hull[1], 0.5);
    seg(b, mx, wl - 5 - mh, x0 + w + 8, top(x0 + w) - 4, hull[1], 0.5);
  }
  void r;
}

// ------------------------------------------------------------ painted once
export function paintBrigand(info) {
  const seed = info.seed >>> 0;
  const r = rngOf(seed ^ 0xb1a);
  // ---- the night sea
  const night = new Bmp(PW, NIGHT_HZ + 1);
  sky(night, [[0, '#04081a'], [30, '#0a1430'], [62, '#16254a'], [84, '#24365e']]);
  stars(night, 74, seed, { band: true, n: 170 });
  const MOON = { x: 194, y: 26 };
  // (The moon's glow in the sky about it.)
  for (let y = 0; y <= NIGHT_HZ; y++) for (let x = 120; x < PW; x++) {
    const d = Math.hypot(x - MOON.x, (y - MOON.y) * 1.1);
    if (d < 60) night.set(x, y, rgb('#4a5a8a'), (1 - d / 60) * 0.5);
  }
  for (let y = MOON.y - 9; y <= MOON.y + 9; y++) for (let x = MOON.x - 9; x <= MOON.x + 9; x++) {
    const d = Math.hypot(x - MOON.x, y - MOON.y);
    if (d > 8.6) continue;
    const n = fbm(x * 0.35, y * 0.35, 4);
    const lit = clamp01(1 - (x - MOON.x + 9) / 30);
    let c = n > 0.58 ? rgb('#c8cce0') : rgb('#eef0fa');
    if (d > 7.6) c = rgb('#d8dcef');
    night.set(x, y, mixC(c, rgb('#fffef4'), lit * 0.3));
  }
  // Cloud streaks lit along their lower edges by the moon.
  for (let i = 0; i < 8; i++) {
    const y = Math.round(14 + r() * 56);
    const x0 = r() * PW * 0.95;
    const len = 26 + r() * 70;
    const th = 1 + Math.floor(r() * 3);
    const near = clamp01(1 - Math.abs(x0 + len / 2 - MOON.x) / 120);
    const top = mixC(rgb('#0c1228'), rgb('#1e2a4c'), near);
    const lit = mixC(rgb('#3a4a74'), rgb('#a8b8e0'), near);
    for (let x = Math.round(x0); x < x0 + len; x++) {
      const e = Math.min(x - x0, x0 + len - x) / len;
      const h = Math.max(1, Math.round(th * Math.min(1, e * 6) + (hashf(x, y, seed) < 0.3 ? 1 : 0)));
      for (let j = 0; j < h; j++) night.set(x, y - j, j === 0 ? lit : top, e < 0.08 ? 0.5 : 0.9);
    }
  }
  // The headland on the left, black against the sky, its lighthouse.
  const head = (x) => NIGHT_HZ - Math.max(0, 26 * Math.pow(Math.max(0, 1 - x / 104), 0.8) + (fbm(x * 0.07, 3, seed) - 0.5) * 6 - (x > 92 ? (x - 92) * 2 : 0));
  for (let x = 0; x < 112; x++) {
    const top = Math.round(head(x));
    for (let y = top; y <= NIGHT_HZ; y++) night.set(x, y, y === top ? rgb('#2a3656') : y - top < 3 && hashf(x, y, 5) < 0.4 ? rgb('#1a2238') : rgb('#0c1020'));
  }
  const LH = { x: 30, y: Math.round(head(30)) };
  for (let y = LH.y - 20; y < LH.y + 1; y++) for (let x = LH.x - 2; x <= LH.x + 2; x++) {
    const band = Math.floor((LH.y - y) / 5) % 2;
    night.set(x, y, x === LH.x + 2 ? rgb('#3a4058') : band ? rgb('#6a2a30') : rgb('#9aa0b8'));
  }
  for (let x = LH.x - 3; x <= LH.x + 3; x++) night.set(x, LH.y - 21, rgb('#2a2a34'));
  for (let y = LH.y - 25; y < LH.y - 21; y++) for (let x = LH.x - 2; x <= LH.x + 2; x++) night.set(x, y, x === LH.x - 2 || x === LH.x + 2 ? rgb('#2a2a34') : rgb('#ffe6a0'));
  for (let i = 0; i < 3; i++) for (let x = LH.x - 2 + i; x <= LH.x + 2 - i; x++) night.set(x, LH.y - 26 - i, rgb('#2a2a34'));
  // (A light or two of a village under it.)
  for (const [x, y] of [[52, Math.round(head(52)) + 2], [58, Math.round(head(58)) + 3], [12, Math.round(head(12)) + 4]]) night.set(x, y, rgb('#ffc870'));
  // The sea's rows, far to near.
  const rows = [];
  const N = 20;
  for (let i = 0; i <= N; i++) {
    const y = Math.round(NIGHT_HZ + 1 + (PH - NIGHT_HZ) * Math.pow(i / N, 1.45));
    if (!rows.length || y > rows[rows.length - 1].y) rows.push({ y, ph: r() * 6.28, f: 0.9 + r() * 0.2 });
  }
  for (const row of rows) {
    const dz = (row.y - NIGHT_HZ) / (PH - NIGHT_HZ);
    row.body = css(mixC(rgb('#1a2a52'), rgb('#08101e'), dz * 0.8));
    row.deep = css(mixC(rgb('#122040'), rgb('#04080e'), dz * 0.8));
    row.crest = css(mixC(rgb('#3a5080'), rgb('#1e2c4a'), dz * 0.5));
    row.lip = css(mixC(rgb('#6a80b4'), rgb('#4a5a84'), dz * 0.5));
  }
  // The merchantman, turned about (heading right), in the moon's light;
  // and your sloop.
  const ship = paintShip(false);
  const moonBlue = [18, 28, 64];
  const merchant = { back: tint(ship.back, moonBlue, 0.6), front: tint(ship.front, moonBlue, 0.55) };
  const sloop = paintSloop(false);
  const sloopF = paintSloop(true);
  // ---- the cove at sunrise
  const cove = paintCove(seed, r);
  const jetty = paintJetty(seed, r);
  return {
    night: night.canvas(), moon: MOON, lh: LH, rows, merchant, sloop, sloopF,
    nightClouds: Array.from({ length: 3 }, (_, i) => ({ img: cloud(seed + i * 7, 46 + r() * 30, 14, [rgb('#0a1024'), rgb('#101830'), rgb('#18223e'), rgb('#22304e'), rgb('#34446a')]).canvas(), x: r() * PW, y: 6 + r() * 30, v: 1 + r() * 1.5 })),
    ...cove, ...jetty,
    gulls: Array.from({ length: 6 }, () => ({ x: r() * PW, y: 14 + r() * 40, v: 4 + r() * 6, ph: r() * 6.28, r: 8 + r() * 14 })),
    crew: [
      { x: 22, s: '#5a2a2a', h: '#1e1612', k: '#b07a4a' }, { x: 34, s: '#2a3a4a', h: '#c87a3a', k: '#e8b48c' }, { x: 50, s: '#3a3a3a', h: '#3a2418', k: '#8a5a34' },
    ],
    mCrew: [{ x: 30 }, { x: 52 }, { x: 70 }, { x: 96 }],
    dyn: new Bmp(PW, PH),
  };
}

// The cove, from the bay: cliffs either side, the haven on its beach, the
// jungle going up behind, the hills, the sky of sunrise.
function paintCove(seed, r) {
  const b = new Bmp(PW, PH);
  const sk = new Bmp(PW, PH);
  sky(sk, [[0, '#2e3c7a'], [24, '#6a5a94'], [48, '#d88a8a'], [64, '#ffc090'], [80, '#ffe6b8']]);
  const air = rgb('#f0b8a0');
  // Hills going back, hazed in the dawn.
  mountains(b, { seed: (seed % 991) + 3, base: 86, top: 40, peaks: 3, pal: R5('#6a6a9a', 0.4), air, airK: 0.5, x0: 40, x1: 230 });
  const crest = (x) => 70 + Math.sin(x * 0.035 + 2) * 5 + Math.sin(x * 0.1) * 1.5;
  hills(b, crest, 96, R4('#3a6a4a').map((c) => mixC(c, air, 0.3)), { seed: seed + 3, texture: 0.7 });
  // The jungle along the back of the beach: bushes and palms.
  const leaf = R5('#3a7a3a', 0.4).map((c) => mixC(c, air, 0.12));
  const bark = [rgb('#4a3424'), rgb('#6a4a30'), rgb('#8a6a48')];
  for (let x = 40; x < 220; x += 5 + Math.floor(r() * 4)) bush(b, x, 92 + Math.round(r() * 2), 5 + r() * 4, 4 + r() * 3, leaf, x * 3 + seed);
  const palms = [];
  for (let x = 46; x < 214; x += 9 + Math.floor(r() * 10)) palms.push({ x, yb: 95 + Math.round(r() * 2), h: 14 + Math.round(r() * 10) });
  // The beach: a crescent of sand, wet and darker at the water.
  const sandTop = (x) => 93 + Math.round(Math.sin(((x - 40) / 180) * Math.PI) * -2) + (hashf(x >> 2, 1, seed) < 0.3 ? 1 : 0);
  const sand = R4('#e8c890', 0.3).map((c) => mixC(c, air, 0.1));
  for (let x = 30; x < 230; x++) for (let y = sandTop(x); y < COVE_SEA + 1; y++) {
    const wet = y >= COVE_SEA - 1;
    const n = hashf(x, y, seed);
    b.set(x, y, wet ? mixC(sand[0], rgb('#7a6a5a'), 0.4) : n > 0.8 ? sand[1] : n < 0.1 ? sand[3] : sand[2]);
  }
  // The haven: the hull-hall (an old ship, keel up, on posts), the tents,
  // the shack, barrels and crates; the lookout; the flagpole.
  const hall = { x: 104, w: 36, yb: 95 };
  for (let x = hall.x; x < hall.x + hall.w; x++) {
    const u = (x - hall.x) / hall.w;
    const h = Math.round(Math.sqrt(Math.max(0, 1 - Math.pow(u * 2 - 1, 2))) * 12);
    for (let y = hall.yb - 6 - h; y < hall.yb - 6; y++) {
      const row = (y - (hall.yb - 6 - h));
      b.set(x, y, row === 0 ? rgb('#8a6a4a') : (y % 3 === 0) ? rgb('#3a2a20') : u < 0.5 ? rgb('#5a3e2a') : rgb('#4a3224'));
    }
    b.set(x, hall.yb - 18, rgb('#2a1a12'), h >= 12 ? 1 : 0);
  }
  for (let x = hall.x + 2; x < hall.x + hall.w - 2; x++) for (let y = hall.yb - 6; y < hall.yb; y++) {
    const post = (x - hall.x) % 8 === 2;
    const door = Math.abs(x - (hall.x + hall.w / 2)) < 3;
    b.set(x, y, post ? rgb('#3a2818') : door ? rgb('#140c08') : rgb('#24180e'));
  }
  const tents = [[66, 95, 14, '#c8b890'], [84, 96, 11, '#b8a070'], [150, 96, 12, '#a8b0a0'], [168, 95, 15, '#c8a888']];
  for (const [tx, ty, tw, tc] of tents) {
    const pal = R4(tc, 0.3);
    for (let y = ty - Math.round(tw * 0.6); y < ty; y++) {
      const k = (y - (ty - tw * 0.6)) / (tw * 0.6);
      const half = Math.round(k * tw / 2);
      for (let x = tx - half; x <= tx + half; x++) {
        const patch = hash2(Math.floor(x / 3), Math.floor(y / 3), seed + tx) > 0.82;
        b.set(x, y, Math.abs(x - tx) < 2 && y > ty - 4 ? rgb('#2a1e14') : patch ? pal[0] : x < tx ? pal[2] : pal[1]);
      }
    }
    seg(b, tx, ty - Math.round(tw * 0.6) - 2, tx, ty - Math.round(tw * 0.6), rgb('#4a3424'));
  }
  // (The lookout on its legs, at the left; barrels and crates.)
  for (let y = 70; y < 96; y++) {
    b.set(52, y, rgb('#4a3424'));
    b.set(60, y, rgb('#4a3424'));
    if (y % 6 === 0) seg(b, 52, y, 60, y + 5, rgb('#3a2818'), 0.7);
  }
  for (let x = 50; x <= 62; x++) for (let y = 66; y < 71; y++) b.set(x, y, y === 66 ? rgb('#8a6a4a') : rgb('#5a3e2a'));
  for (let x = 49; x <= 63; x++) for (let y = 62; y < 66; y++) if (Math.abs(x - 56) <= (y - 61) * 2) b.set(x, y, rgb('#a88a50'));
  for (const [bx, by] of [[96, 98], [99, 98], [142, 98], [190, 97], [193, 98], [187, 98]]) {
    for (let y = by - 4; y < by; y++) for (let x = bx - 1; x <= bx + 1; x++) b.set(x, y, y === by - 3 ? rgb('#2a2a2a') : x === bx + 1 ? rgb('#4a3020') : rgb('#7a5434'));
  }
  for (const [cx0, cy0] of [[180, 98], [146, 99]]) for (let y = cy0 - 3; y < cy0; y++) for (let x = cx0; x < cx0 + 4; x++) b.set(x, y, (x + y) % 3 === 0 ? rgb('#5a4028') : rgb('#8a6a40'));
  const pole = { x: 122, top: 44, yb: 94 };
  for (let y = pole.top; y < pole.yb; y++) {
    b.set(pole.x, y, rgb('#3a2818'));
    b.set(pole.x + 1, y, rgb('#7a5a3a'));
  }
  b.set(pole.x, pole.top - 1, rgb('#c8a040'));
  for (const p of palms) palm(b, p.x, p.yb, p.h, leaf, bark, p.x * 7 + seed);
  // The cliffs either side, coming down into the sea: rock in its beds,
  // lit from the right (the sunrise), grass and palms on top.
  const rock = R5('#7a6a6a', 0.42).map((c) => mixC(c, air, 0.08));
  const lc = (x) => 30 + (x < 36 ? x * 0.12 : 4 + Math.pow((x - 36) / 27, 0.55) * 70) + (fbm(x * 0.1, 1, seed) - 0.5) * 6;
  for (let x = 0; x < 64; x++) {
    const top = Math.round(lc(x));
    for (let y = top; y < COVE_SEA + 4; y++) {
      const bed = Math.floor((y + x * 0.25) / 5);
      const n = fbm(x * 0.12, y * 0.2, seed + 7);
      let c = n > 0.62 ? rock[3] : n > 0.45 ? rock[2] : n > 0.3 ? rock[1] : rock[0];
      if ((y + Math.round(x * 0.25)) % 5 === 0) c = rock[0];
      if (x > 54 - (y - top) * 0.1) c = mixC(c, rgb('#ffd0a0'), 0.25);
      if (y - top < 2) c = rgb(y === top ? '#6aa04a' : '#4a7a3a');
      b.set(x, y, c);
      void bed;
    }
  }
  const rc = (x) => 54 + (x > PW - 26 ? (PW - x) * 0.15 : 4 + Math.pow((PW - 26 - x) / 20, 0.55) * 46) + (fbm(x * 0.1, 2, seed) - 0.5) * 5;
  for (let x = PW - 46; x < PW; x++) {
    const top = Math.round(rc(x));
    for (let y = top; y < COVE_SEA + 4; y++) {
      const n = fbm(x * 0.12, y * 0.2, seed + 9);
      let c = n > 0.6 ? rock[3] : n > 0.42 ? rock[2] : n > 0.3 ? rock[1] : rock[0];
      if ((y - Math.round(x * 0.3)) % 6 === 0) c = rock[0];
      if (x < PW - 40 + (y - top) * 0.1) c = mixC(c, rgb('#2a2440'), 0.3);
      if (y - top < 2) c = rgb(y === top ? '#6aa04a' : '#4a7a3a');
      b.set(x, y, c);
    }
  }
  for (const [x, h] of [[10, 18], [22, 14], [236, 16]]) palm(b, x, Math.round(x < 128 ? lc(x) : rc(x)) + 1, h, leaf, bark, x * 13 + seed);
  // Two of the Brethren's ships at anchor.
  const brigs = [{ x: 190, wl: 108, w: 36 }, { x: 22, wl: 105, w: 24 }];
  // (The jetty: planks out from the beach, on posts.)
  const J = { x0: 150, y0: 99, x1: 170, y1: 124 };
  return {
    cove: b.canvas(), coveSky: sk.canvas(), coveClouds: Array.from({ length: 4 }, (_, i) => ({ img: cloud(seed + 50 + i * 9, 36 + r() * 34, 12, [rgb('#9a6a8a'), rgb('#c88a92'), rgb('#f0aa98'), rgb('#ffd4b0'), rgb('#fff0d8')], { rim: rgb('#fff4e0') }).canvas(), x: r() * PW, y: 8 + r() * 30, v: 0.6 + r() })), brigs, sandTop, pole, hall, J, coveRows: coveRows(r),
    brigImg: (() => {
      const bb = new Bmp(PW, PH);
      for (const s of brigs) paintBrig(bb, s.x, s.wl, s.w, seed + s.x);
      return bb.canvas();
    })(),
    fires: [{ x: 132, y: 99 }],
    brethren: [
      { x: 140, y: 101, s: '#8a2a2a', h: '#1e1612', k: '#b07a4a' }, { x: 147, y: 102, s: '#2a4a6a', h: '#c87a3a', k: '#e8b48c' }, { x: 128, y: 101, s: '#3a3a3a', h: '#8a8a92', k: '#8a5a34' },
      { x: 158, y: 101, s: '#6a5a2a', h: '#3a2418', k: '#5a3a22' }, { x: 120, y: 100, s: '#5a2a5a', h: '#1e1612', k: '#d49a6a' }, { x: 176, y: 101, s: '#2a5a3a', h: '#a83a2a', k: '#f4d0b0' },
      { x: 112, y: 101, s: '#c8a030', h: '#3a2418', k: '#b07a4a' }, { x: 166, y: 102, s: '#4a2a1a', h: '#6e4424', k: '#e8b48c' },
    ],
  };
}

function coveRows(r) {
  const rows = [];
  const N = 16;
  for (let i = 0; i <= N; i++) {
    const y = Math.round(COVE_SEA + (PH - COVE_SEA) * Math.pow(i / N, 1.3));
    if (!rows.length || y > rows[rows.length - 1].y) rows.push({ y, ph: r() * 6.28, f: 0.9 + r() * 0.2 });
  }
  for (const row of rows) {
    const dz = (row.y - COVE_SEA) / (PH - COVE_SEA);
    row.body = css(mixC(rgb('#4a6a9a'), rgb('#1a3a5a'), dz));
    row.deep = css(mixC(rgb('#3a5a88'), rgb('#10283e'), dz));
    row.crest = css(mixC(rgb('#8a9ac0'), rgb('#3a6088'), dz * 0.7));
    row.lip = css(mixC(rgb('#c8c8d8'), rgb('#7090b8'), dz * 0.6));
  }
  return rows;
}

// The jetty, close: planks across, its posts going down into the water;
// the beach behind, the tents and the hall, the palms, the flagpole.
function paintJetty(seed, r) {
  const b = new Bmp(PW, PH);
  sky(b, [[0, '#4a5a9a'], [30, '#a07a9a'], [52, '#f0a890'], [70, '#ffd8a8']]);
  const air = rgb('#f0b8a0');
  hills(b, (x) => 52 + Math.sin(x * 0.03) * 6 + Math.sin(x * 0.09 + 1) * 2, 80, R4('#3a6a4a').map((c) => mixC(c, air, 0.35)), { seed: seed + 5, texture: 0.7 });
  const leaf = R5('#3a7a3a', 0.4).map((c) => mixC(c, air, 0.1));
  const bark = [rgb('#4a3424'), rgb('#6a4a30'), rgb('#8a6a48')];
  for (let x = 0; x < PW; x += 6 + Math.floor(r() * 4)) bush(b, x, 76 + Math.round(r() * 2), 7 + r() * 5, 5 + r() * 4, leaf, x * 5 + seed);
  // The beach, then the water's edge.
  const sand = R4('#e8c890', 0.3).map((c) => mixC(c, air, 0.08));
  for (let y = 76; y < 96; y++) for (let x = 0; x < PW; x++) {
    const n = hashf(x, y, seed + 2);
    b.set(x, y, y > 93 ? mixC(sand[0], rgb('#7a6a5a'), 0.5) : n > 0.82 ? sand[1] : n < 0.08 ? sand[3] : sand[2]);
  }
  // A tent, big; the hall's end; barrels; the fire's stones.
  for (let y = 52; y < 82; y++) {
    const half = Math.round((y - 52) * 0.75);
    for (let x = 196 - half; x <= 196 + half; x++) {
      const patch = hash2(Math.floor(x / 5), Math.floor(y / 4), seed + 3) > 0.8;
      b.set(x, y, Math.abs(x - 196) < 4 && y > 66 ? rgb('#2a1e14') : patch ? rgb('#a8906a') : x < 196 ? rgb('#d8c8a0') : rgb('#b8a47a'));
    }
  }
  for (let x = 0; x < 64; x++) {
    const h = Math.round(Math.sqrt(Math.max(0, 1 - Math.pow((x - 10) / 54, 2))) * 30);
    for (let y = 80 - h; y < 80; y++) b.set(x, y, (y % 4 === 0) ? rgb('#3a2a20') : x > 40 ? rgb('#4a3224') : rgb('#5a3e2a'));
  }
  for (const [bx, by] of [[70, 84], [76, 84], [73, 79], [230, 86]]) for (let y = by - 7; y < by; y++) for (let x = bx - 2; x <= bx + 2; x++) b.set(x, y, y === by - 6 || y === by - 2 ? rgb('#2a2a2a') : x === bx + 2 ? rgb('#4a3020') : rgb('#8a5e38'));
  for (let y = 18; y < 84; y++) {
    b.set(150, y, rgb('#3a2818'));
    b.set(151, y, rgb('#7a5a3a'));
  }
  b.set(150, 17, rgb('#c8a040'));
  b.set(151, 17, rgb('#c8a040'));
  for (const [x, h] of [[30, 46], [110, 40], [240, 48]]) palm(b, x, 82, h, leaf, bark, x * 11 + seed);
  // The water under the jetty.
  for (let y = 96; y < PH; y++) for (let x = 0; x < PW; x++) {
    const d = (y - 96) / 48;
    b.set(x, y, mixC(rgb('#5a7aa0'), rgb('#1e3a5a'), d));
  }
  // The jetty: its deck, planks across, lit along their edges; the posts.
  const deck = 108;
  for (let x = 0; x < PW; x++) for (let y = deck; y < deck + 6; y++) {
    const plank = Math.floor((x + 3) / 7);
    const gap = (x + 3) % 7 === 0;
    const n = hash2(plank, y, seed + 9);
    b.set(x, y, gap ? rgb('#2a1a10') : y === deck ? rgb('#c8a070') : y === deck + 5 ? rgb('#4a3020') : n > 0.5 ? rgb('#8a6440') : rgb('#7a5636'));
  }
  for (let x = 4; x < PW; x += 22) for (let y = deck + 6; y < PH; y++) {
    b.set(x, y, rgb('#3a2818'));
    b.set(x + 1, y, rgb('#5a3e26'));
    b.set(x + 2, y, rgb('#2a1a10'));
  }
  return { jetty: b.canvas(), deck };
}

// ------------------------------------------------------------ drawing
// The sea's rows between y0 and y1 (each row's waves over the one behind
// it); a path of light (the moon's, the sun's) on the crests about `gx`.
function seaRows(g, rows, t, y0, y1, { glintX, glint, amp = 1, sp = 1.1, darkX = null }) {
  for (let i = 0; i < rows.length - 1; i++) {
    const row = rows[i];
    if (row.y < y0 || row.y >= y1) continue;
    const nextY = rows[i + 1].y;
    const dz = (row.y - rows[0].y) / (PH - rows[0].y);
    const a = (0.8 + dz * 3.2) * amp;
    const fr = (0.11 - dz * 0.06) * row.f;
    for (let x = 0; x < PW; x++) {
      const w = 0.5 + 0.5 * Math.sin(x * fr + row.ph + t * sp) * 0.75 + 0.5 * 0.25 * Math.sin(x * fr * 2.3 - t * sp * 0.7 + row.ph);
      const cy = Math.round(row.y - a * w);
      g.fillStyle = darkX && darkX(x, row.y) ? row.deep : row.body;
      g.fillRect(x, cy, 1, nextY - cy + 1);
      g.fillStyle = w > 0.62 ? row.lip : row.crest;
      g.fillRect(x, cy, 1, 1);
      if (nextY - cy > 2) {
        g.fillStyle = row.deep;
        g.fillRect(x, nextY, 1, 1);
      }
      if (glint && w > 0.42 && Math.abs(x - glintX - Math.sin(row.y * 1.7 + t * 2) * (1 + dz * 6)) < 1 + dz * 6) {
        g.fillStyle = glint;
        g.fillRect(x, cy, 1, 1);
      }
    }
  }
}

function gull(g, x, y, t, ph, col) {
  const up = Math.floor(t * 4 + ph) % 2;
  g.fillStyle = col;
  x = Math.round(x);
  y = Math.round(y);
  g.fillRect(x, y, 1, 1);
  g.fillRect(x - 1, y - up, 1, 1);
  g.fillRect(x + 1, y - up, 1, 1);
  g.fillRect(x - 2, y - 1 + (up ? -1 : 1), 1, 1);
  g.fillRect(x + 2, y - 1 + (up ? -1 : 1), 1, 1);
}

// The Black Gull: a black flag, a white gull on it, streaming.
function blackFlag(g, x, y, t, w = 9, h = 6, dir = -1) {
  for (let i = 0; i < w; i++) {
    const dy = Math.round(Math.sin(t * 7 - i * 0.8) * 0.9 * (i / w));
    for (let j = 0; j < h; j++) {
      g.fillStyle = (j + i) % 5 === 0 ? '#1e1c22' : '#0e0c10';
      g.fillRect(x + dir * i, y + j + dy, 1, 1);
    }
  }
  // (The gull, in white, about the middle.)
  const mx = x + dir * Math.round(w * 0.45);
  const my = y + Math.floor(h / 2) + Math.round(Math.sin(t * 7 - w * 0.4) * 0.5);
  g.fillStyle = '#f0ece0';
  g.fillRect(mx, my, 1, 1);
  g.fillRect(mx - 1, my - 1, 1, 1);
  g.fillRect(mx + 1, my - 1, 1, 1);
  if (w > 10) {
    g.fillRect(mx - 2, my - 1, 1, 1);
    g.fillRect(mx + 2, my - 1, 1, 1);
    g.fillRect(mx - 3, my, 1, 1);
    g.fillRect(mx + 3, my, 1, 1);
  }
}

function puff(g, x, y, k, col = '#c8ccd8', size = 1) {
  if (k <= 0 || k >= 1) return;
  for (let i = 0; i < 6; i++) {
    const ang = i * 1.1;
    const rr = (2 + k * 9) * size;
    const px0 = x + Math.cos(ang) * rr * 0.6 + k * 10 * size;
    const py0 = y + Math.sin(ang) * rr * 0.4 - k * 5 * size;
    const s = Math.round((2 + k * 4) * size);
    g.globalAlpha = 0.5 * (1 - k);
    g.fillStyle = i % 2 ? col : '#9aa0b0';
    g.fillRect(Math.round(px0 - s / 2), Math.round(py0 - s / 2), s, s);
  }
  g.globalAlpha = 1;
}

function splash(g, x, y, k) {
  if (k <= 0 || k >= 1) return;
  const h = Math.sin(k * Math.PI) * 16;
  for (let i = -3; i <= 3; i++) {
    const hh = h * (1 - Math.abs(i) * 0.22);
    for (let j = 0; j < hh; j++) {
      g.globalAlpha = (1 - k * 0.6) * (j > hh - 2 ? 0.6 : 0.9);
      g.fillStyle = j > hh - 3 ? '#ffffff' : '#c8d8f0';
      g.fillRect(Math.round(x + i + Math.sin(j * 0.5 + i) * k * 2), Math.round(y - j), 1, 1);
    }
  }
  for (let i = 0; i < 10; i++) {
    const ang = -Math.PI * (0.15 + (i / 10) * 0.7);
    const rr = k * 14;
    g.globalAlpha = 1 - k;
    g.fillStyle = '#e8f0ff';
    g.fillRect(Math.round(x + Math.cos(ang) * rr), Math.round(y - h * 0.7 + Math.sin(ang) * -rr * 0.3 + k * k * 12), 1, 1);
  }
  g.globalAlpha = 1;
}

// The chase, by moonlight: `s` { t, gain (0-1: how far up on her you've
// come), shot1, shot2 (seconds since each gun, or <0), struck (seconds
// since her colours started down, or <0), look }.
export function drawChase(g, art, s) {
  const { t } = s;
  g.drawImage(art.night, 0, 0);
  // (The moon's halo.)
  g.save();
  g.globalCompositeOperation = 'lighter';
  const mg = g.createRadialGradient(art.moon.x, art.moon.y, 6, art.moon.x, art.moon.y, 34);
  mg.addColorStop(0, 'rgba(200,214,255,0.28)');
  mg.addColorStop(1, 'rgba(120,140,220,0)');
  g.fillStyle = mg;
  g.fillRect(art.moon.x - 34, art.moon.y - 34, 68, 68);
  g.restore();
  for (const c of art.nightClouds) {
    const x = ((c.x + t * c.v) % (PW + 80)) - 40;
    g.globalAlpha = 0.55;
    g.drawImage(c.img, Math.round(x), Math.round(c.y));
  }
  g.globalAlpha = 1;
  // The lighthouse's beam, sweeping: long when it points along the coast,
  // a flare when it comes round to you.
  const la = t * 1.1;
  const reach = Math.cos(la);
  const toward = Math.sin(la);
  const { x: lx, y: ly } = art.lh;
  const lampY = ly - 23;
  g.save();
  g.globalCompositeOperation = 'lighter';
  if (Math.abs(reach) > 0.08) {
    const len = 120 * Math.abs(reach);
    const dir = Math.sign(reach);
    const gr = g.createLinearGradient(lx, lampY, lx + dir * len, lampY);
    gr.addColorStop(0, `rgba(255,236,170,${(0.35 * Math.abs(reach)).toFixed(3)})`);
    gr.addColorStop(1, 'rgba(255,236,170,0)');
    g.fillStyle = gr;
    g.beginPath();
    g.moveTo(lx, lampY - 1);
    g.lineTo(lx + dir * len, lampY - 6 - len * 0.04);
    g.lineTo(lx + dir * len, lampY + 5 + len * 0.04);
    g.lineTo(lx, lampY + 1);
    g.closePath();
    g.fill();
  }
  const fl = Math.max(0, toward) ** 6;
  const lg = g.createRadialGradient(lx, lampY, 0, lx, lampY, 6 + fl * 20);
  lg.addColorStop(0, `rgba(255,240,190,${(0.6 + fl * 0.4).toFixed(3)})`);
  lg.addColorStop(1, 'rgba(255,200,120,0)');
  g.fillStyle = lg;
  g.fillRect(lx - 30, lampY - 30, 60, 60);
  g.restore();
  // Where they are: the merchantman ahead, your sloop coming up astern.
  const mx = 128 + Math.sin(t * 0.13) * 2 + s.gain * 6;
  const mwl = 102 + Math.sin(t * 0.9) * 0.8;
  const sx = lerp(-60, 40, ease(s.gain));
  const swl = 120 + Math.sin(t * 1.1 + 1) * 1.4;
  const mAng = Math.sin(t * 0.8) * 0.018;
  const sAng = Math.sin(t * 1.15 + 0.5) * 0.035;
  const glint = 'rgba(232,238,255,0.9)';
  seaRows(g, art.rows, t, 0, mwl - 1, { glintX: art.moon.x, glint });
  // The merchantman (her picture faces left: turned about).
  g.save();
  g.translate(mx + SHIP.w / 2, mwl);
  g.rotate(mAng);
  g.scale(-1, 1);
  const ox = -SHIP.w / 2;
  const oy = -SHIP.water;
  g.drawImage(art.merchant.back, ox, oy);
  // Her colours at the mizzen (the stern: on the left now): a red ensign,
  // coming down after she strikes.
  const down = s.struck >= 0 ? ease(clamp01(s.struck / 1.6)) : 0;
  const fy = oy + lerp(22, sheer(MASTS.mizzen) - 6, down);
  for (let x = 0; x < 8; x++) {
    const dy = Math.round(Math.sin(t * 6 - x * 0.8) * 0.8 * (x / 8) * (1 - down));
    for (let y = 0; y < 4; y++) {
      g.fillStyle = y === 1 ? '#a8a090' : x > 5 ? '#6a2030' : '#8a2a38';
      g.fillRect(ox + MASTS.mizzen - 1 - x, fy + y + dy, 1, 1);
    }
  }
  // (Her people: at their watch; then, after the shot, crowding the rail,
  // their hands up.)
  for (const c of art.mCrew) {
    const pen = (x, y, col) => {
      g.fillStyle = col;
      g.fillRect(Math.round(x), Math.round(y), 1, 1);
    };
    const run = s.shot1 > 0 && s.struck < 0 ? Math.sin(t * 3 + c.x) * 6 : 0;
    drawPerson(pen, ox + c.x + run, oy + sheer(Math.round(c.x)) + 3, { size: 'tiny', pose: s.struck > 0.4 ? 'wave' : s.shot1 > 0 ? 'run' : 'stand', frame: Math.floor(t * 8 + c.x), shirt: '#4a4a5a', hair: '#2a2020', skin: '#8a7a80' });
  }
  g.drawImage(art.merchant.front, ox, oy);
  g.restore();
  // (Her stern windows and a lantern, warm in the dark.)
  g.save();
  g.globalCompositeOperation = 'lighter';
  const swx = mx + SHIP.w - 95;
  const sgr = g.createRadialGradient(swx, mwl - 16, 0, swx, mwl - 16, 12);
  sgr.addColorStop(0, 'rgba(255,190,100,0.35)');
  sgr.addColorStop(1, 'rgba(255,160,80,0)');
  g.fillStyle = sgr;
  g.fillRect(swx - 12, mwl - 28, 24, 24);
  g.restore();
  seaRows(g, art.rows, t, mwl - 1, swl - 1, { glintX: art.moon.x, glint });
  // Splashes across her bow.
  const bowX = mx + SHIP.w - 4;
  if (s.shot1 > 0.7) splash(g, bowX + 14, mwl + 2, (s.shot1 - 0.7) / 1.2);
  if (s.shot2 > 0.7) splash(g, bowX + 6, mwl + 3, (s.shot2 - 0.7) / 1.2);
  // Your sloop.
  const S = art.sloop;
  g.save();
  g.translate(sx + SLOOP.w / 2, swl);
  g.rotate(sAng);
  const sox = -SLOOP.w / 2;
  const soy = -SLOOP.water;
  g.drawImage(S.back, sox, soy);
  blackFlag(g, sox + SLOOP.mast, soy + 1, t, 10, 6, -1);
  // (Her people on deck; you at the bow, your arm out.)
  const pen = (x, y, col) => {
    g.fillStyle = col;
    g.fillRect(Math.round(x), Math.round(y), 1, 1);
  };
  for (const c of art.crew) drawPerson(pen, sox + c.x + (s.shot1 > 0 ? Math.sin(t * 2 + c.x) * 2 : 0), soy + sloopSheer(c.x) + 3, { size: 'tiny', pose: s.struck > 0.6 ? 'wave' : 'stand', shirt: c.s, hair: c.h, skin: c.k, frame: Math.floor(t * 6) });
  const L = s.look || {};
  drawPerson(pen, sox + 62, soy + sloopSheer(62) + 3, { size: 'small', pose: s.shot1 > -1.5 && s.shot1 < 1 ? 'wave' : s.struck > 0.6 ? 'wave' : 'stand', dir: 1, shirt: L.shirt || '#8f2f3a', hair: L.hair || '#3a2418', skin: L.skin || '#e8b48c', pants: L.pants || '#2a2a34', frame: Math.floor(t * 6) });
  g.drawImage(S.front, sox, soy);
  // The bow chaser's flash, and its smoke drifting off downwind.
  const gx = sox + SLOOP.gun + 3;
  const gy = soy + sloopSheer(SLOOP.gun) - 1;
  for (const k of [s.shot1, s.shot2]) {
    if (k < 0) continue;
    if (k < 0.18) {
      g.save();
      g.globalCompositeOperation = 'lighter';
      const fg = g.createRadialGradient(gx + 2, gy, 0, gx + 2, gy, 26);
      fg.addColorStop(0, `rgba(255,220,140,${(0.9 * (1 - k / 0.18)).toFixed(3)})`);
      fg.addColorStop(1, 'rgba(255,140,60,0)');
      g.fillStyle = fg;
      g.fillRect(gx - 26, gy - 26, 52, 52);
      g.restore();
      g.fillStyle = '#fff6d0';
      g.fillRect(gx, gy - 1, 5, 3);
      g.fillStyle = '#ffb040';
      g.fillRect(gx + 5, gy, 3, 1);
      g.fillRect(gx + 2, gy - 2, 1, 1);
      g.fillRect(gx + 2, gy + 2, 1, 1);
    }
    puff(g, gx + 4, gy - 1, k / 3.4, '#b8bccc', 1.2);
  }
  g.restore();
  seaRows(g, art.rows, t, swl - 1, PH + 1, { glintX: art.moon.x, glint });
  // Foam along her side, her bow wave, her wake.
  for (let x = Math.round(sx + 8); x < sx + 76; x++) if (hashf(x, Math.floor(t * 6), 2) < 0.5) {
    g.fillStyle = 'rgba(220,230,255,0.6)';
    g.fillRect(x, Math.round(swl) - 1 + (hashf(x, 3, Math.floor(t * 4)) < 0.3 ? -1 : 0), 1, 1);
  }
  for (let i = 0; i < 8; i++) {
    const k = (t * 1.6 + i / 8) % 1;
    g.globalAlpha = (1 - k) * 0.7;
    g.fillStyle = '#e8f0ff';
    g.fillRect(Math.round(sx + 78 + k * 6 + Math.sin(i * 1.7) * 2), Math.round(swl - 2 - Math.sin(k * Math.PI) * 4), 1, 1);
  }
  for (let i = 0; i < 36; i++) {
    const k = i / 36;
    for (const side of [-1, 1]) {
      if (hashf(i, side + 2, Math.floor(t * 5)) > 0.75 - k * 0.4) continue;
      g.globalAlpha = (1 - k) * 0.5;
      g.fillStyle = '#d8e4ff';
      g.fillRect(Math.round(sx + 4 - k * 60), Math.round(swl + side * k * 4 + Math.sin(t * 2 - i * 0.6) * 0.6), 1, 1);
    }
  }
  g.globalAlpha = 1;
}

// The cove at sunrise: `s` { t (since the cut), come (0-1: the sloop in to
// her mooring), furled, anchor (since the anchor went, or <0), boat (0-1:
// rowed in to the jetty), cheer (0-1), look }.
export function drawCove(g, art, s) {
  const { t } = s;
  // The sun coming up over the hills at the right; its glow.
  const sunY = 70 - ease(clamp01(t / 7)) * 10;
  g.drawImage(art.coveSky, 0, 0);
  for (const c of art.coveClouds) g.drawImage(c.img, Math.round(((c.x + t * c.v) % (PW + 80)) - 40), Math.round(c.y));
  g.save();
  g.globalCompositeOperation = 'lighter';
  const sg = g.createRadialGradient(186, sunY, 2, 186, sunY, 70);
  sg.addColorStop(0, 'rgba(255,224,170,0.3)');
  sg.addColorStop(1, 'rgba(255,170,110,0)');
  g.fillStyle = sg;
  g.fillRect(116, sunY - 70, 140, 140);
  g.restore();
  g.fillStyle = '#fff4d0';
  g.beginPath();
  g.arc(186, sunY, 6, 0, Math.PI * 2);
  g.fill();
  g.drawImage(art.cove, 0, 0);
  // Gulls wheeling over the haven.
  for (const q of art.gulls) {
    const a = t * q.v * 0.08 + q.ph;
    gull(g, 130 + Math.cos(a) * (40 + q.r) + q.x * 0.1, q.y + Math.sin(a * 1.3) * 6, t, q.ph, '#f8f0e8');
  }
  // The flag on its pole, the fire and its smoke, going up straight in the
  // still of the morning, bending off higher.
  blackFlag(g, art.pole.x + 2, art.pole.top, t, 14, 9, 1);
  for (const f of art.fires) {
    for (let i = 0; i < 9; i++) {
      const k = (t * 0.25 + i / 9) % 1;
      g.globalAlpha = 0.35 * (1 - k);
      g.fillStyle = k < 0.3 ? '#8a8a90' : '#b8b0b8';
      const rr = 1 + Math.round(k * 4);
      g.fillRect(Math.round(f.x + Math.sin(k * 3 + i) * 1.5 + k * k * 18), Math.round(f.y - 4 - k * 40), rr, rr);
    }
    g.globalAlpha = 1;
    const fl = Math.floor(t * 10) % 3;
    g.fillStyle = '#ff7a20';
    g.fillRect(f.x - 2, f.y - 3 - fl, 4, 3 + fl);
    g.fillStyle = '#ffd050';
    g.fillRect(f.x - 1, f.y - 3, 2, 2 + (fl > 0 ? 1 : 0));
    g.fillStyle = '#3a2a20';
    g.fillRect(f.x - 3, f.y, 6, 1);
  }
  // The water of the bay, the brigs at anchor on it, their flags.
  const glint = 'rgba(255,224,170,0.95)';
  const dark = (x) => x < 60 || x > PW - 44;
  seaRows(g, art.coveRows, t, 0, 104, { glintX: 186, glint, amp: 0.45, sp: 0.8, darkX: dark });
  g.drawImage(art.brigImg, 0, Math.round(Math.sin(t * 0.9) * 0.6));
  for (const b of art.brigs) blackFlag(g, b.x + Math.round(b.w * 0.7), b.wl - 5 - Math.round(b.w * 0.9) - 1, t + b.x, 6, 4, -1);
  seaRows(g, art.coveRows, t, 104, 112, { glintX: 186, glint, amp: 0.45, sp: 0.8, darkX: dark });
  // The surf along the beach.
  for (let x = 30; x < 230; x++) {
    const k = (Math.sin(x * 0.2 + t * 1.6) + 1) / 2;
    if (k < 0.5) continue;
    g.globalAlpha = (k - 0.5) * 1.6;
    g.fillStyle = '#f8f4ec';
    g.fillRect(x, COVE_SEA - 1 + Math.round(Math.sin(t * 1.6 + x * 0.05)), 1, 1);
  }
  g.globalAlpha = 1;
  // The jetty, out from the beach.
  const J = art.J;
  for (let y = J.y0; y < J.y1; y++) {
    const k = (y - J.y0) / (J.y1 - J.y0);
    const xl = Math.round(lerp(J.x0, J.x1 - 8, k));
    const w = Math.round(lerp(5, 10, k));
    for (let x = xl; x < xl + w; x++) {
      g.fillStyle = (y - J.y0) % 2 === 0 ? '#9a7450' : '#7a5636';
      g.fillRect(x, y, 1, 1);
    }
    if ((y - J.y0) % 6 === 0) {
      g.fillStyle = '#3a2818';
      g.fillRect(xl, y + 1, 1, 3);
      g.fillRect(xl + w - 1, y + 1, 1, 3);
    }
  }
  // The brethren on the beach: about the fire, then down to the jetty as
  // the boat comes in, jumping, waving.
  const pen = (x, y, col) => {
    g.fillStyle = col;
    g.fillRect(Math.round(x), Math.round(y), 1, 1);
  };
  for (const [i, q] of art.brethren.entries()) {
    const go = ease(clamp01((s.boat - 0.2 - i * 0.04) * 1.6));
    const x = lerp(q.x, 150 + (i % 4) * 4 - 6, go * 0.7);
    const y = lerp(q.y, 100 + (i % 3), go);
    const jump = s.cheer > 0 ? Math.max(0, Math.sin(t * 7 + i * 1.3)) * 2 * s.cheer : 0;
    drawPerson(pen, x, y - jump, { size: 'small', pose: s.cheer > 0.2 || go > 0.05 && go < 1 ? (s.cheer > 0.2 ? 'wave' : 'walk') : 'stand', dir: x < 150 ? 1 : -1, frame: Math.floor(t * 6 + i), shirt: q.s, hair: q.h, skin: q.k, lit: 1 });
  }
  seaRows(g, art.coveRows, t, 112, 117, { glintX: 186, glint, amp: 0.45, sp: 0.8, darkX: dark });
  // Your sloop, coming in from the left and rounding up to her mooring;
  // then her canvas down.
  const sx = lerp(-90, 60, ease(s.come));
  const swl = 124 + Math.sin(t * 1.0) * 0.7;
  g.save();
  g.translate(Math.round(sx), Math.round(swl - SLOOP.water));
  const S = s.furled ? art.sloopF : art.sloop;
  g.drawImage(S.back, 0, 0);
  blackFlag(g, SLOOP.mast, 1, t, 10, 6, -1);
  for (const c of art.crew) drawPerson(pen, c.x, sloopSheer(c.x) + 3, { size: 'tiny', pose: s.furled ? 'wave' : 'stand', shirt: c.s, hair: c.h, skin: c.k, frame: Math.floor(t * 6) });
  if (s.boat <= 0) {
    const L = s.look || {};
    drawPerson(pen, 60, sloopSheer(60) + 3, { size: 'small', pose: 'stand', dir: 1, shirt: L.shirt || '#8f2f3a', hair: L.hair || '#3a2418', skin: L.skin || '#e8b48c', pants: L.pants || '#2a2a34' });
  }
  g.drawImage(S.front, 0, 0);
  g.restore();
  // (The anchor going: a splash at her bow, rings spreading.)
  if (s.anchor >= 0 && s.anchor < 2) {
    const ax = sx + 78;
    splash(g, ax, swl + 1, s.anchor / 0.8);
    g.strokeStyle = `rgba(230,240,255,${(0.5 * (1 - s.anchor / 2)).toFixed(3)})`;
    g.beginPath();
    g.ellipse(ax, swl + 2, 2 + s.anchor * 10, 1 + s.anchor * 2.4, 0, 0, Math.PI * 2);
    g.stroke();
  }
  // The boat, rowed in to the jetty's end: you in the stern.
  if (s.boat > 0 && s.boat < 1.2) {
    const k = ease(clamp01(s.boat));
    const bx = lerp(sx + 60, J.x1 - 2, k);
    const by = lerp(swl + 2, J.y1 + 1, k) + Math.sin(t * 2) * 0.5;
    g.fillStyle = '#5a3a24';
    g.fillRect(Math.round(bx - 6), Math.round(by - 1), 13, 2);
    g.fillStyle = '#8a6440';
    g.fillRect(Math.round(bx - 6), Math.round(by - 2), 13, 1);
    const L = s.look || {};
    drawPerson(pen, bx - 3, by - 2, { size: 'small', pose: 'stand', shirt: L.shirt || '#8f2f3a', hair: L.hair || '#3a2418', skin: L.skin || '#e8b48c', pants: L.pants || '#2a2a34' });
    const c = art.crew[0];
    drawPerson(pen, bx + 3, by - 2, { size: 'tiny', pose: 'stand', shirt: c.s, hair: c.h, skin: c.k });
    const ph = Math.sin(t * 5);
    g.fillStyle = '#c8a070';
    g.fillRect(Math.round(bx + 3 + ph * 3), Math.round(by), 1, 2);
    g.fillRect(Math.round(bx + 4 - ph * 3), Math.round(by), 1, 2);
  }
  seaRows(g, art.coveRows, t, 117, PH + 1, { glintX: 186, glint, amp: 0.45, sp: 0.8, darkX: dark });
}

// The jetty, close: `s` { t (since the cut), walk (0-1), cheer, look,
// chief (0-1: stepping out to you) }; `sprite` draws a character's own
// sprite.
const PIRATES = [
  { skin: '#b07a4a', hair: '#1e1612', hairStyle: 'long', shirt: '#8a2a2a', pants: '#2a2a34', shoes: '#1a1410', outfit: 'traveller', accent: '#c8a030', hat: 'tricorn', beard: true, beardStyle: 'full', eyeColor: '#2a1a10' },
  { skin: '#e8b48c', hair: '#c87a3a', hairStyle: 'ponytail', shirt: '#e0d8c0', pants: '#3a3a4a', shoes: '#1a1410', outfit: 'vest', accent: '#8a2a2a', hat: 'bandana', beard: false, eyeColor: '#3a5a2a' },
  { skin: '#8a5a34', hair: '#1e1612', hairStyle: 'bald', shirt: '#2a4a6a', pants: '#4a3a2a', shoes: '#1a1410', outfit: 'fisher', accent: '#c8a030', hat: null, beard: true, beardStyle: 'goatee', eyeColor: '#2a1a10' },
  { skin: '#d49a6a', hair: '#3a2418', hairStyle: 'braids', shirt: '#5a2a5a', pants: '#2a2a34', shoes: '#1a1410', outfit: 'plain', accent: '#e0c060', hat: 'bandana', beard: false, eyeColor: '#2a1a10' },
  { skin: '#5a3a22', hair: '#8a8a92', hairStyle: 'curly', shirt: '#6a5a2a', pants: '#2a2a34', shoes: '#1a1410', outfit: 'apron', accent: '#c8a030', hat: 'wide', beard: true, beardStyle: 'long', eyeColor: '#2a1a10' },
];
export function drawJetty(g, art, s, sprite, info) {
  const { t } = s;
  g.drawImage(art.jetty, 0, 0);
  // The sun's light over it; gulls; the flag, big now.
  g.save();
  g.globalCompositeOperation = 'lighter';
  const sg = g.createRadialGradient(220, 40, 4, 220, 40, 120);
  sg.addColorStop(0, 'rgba(255,220,160,0.3)');
  sg.addColorStop(1, 'rgba(255,170,110,0)');
  g.fillStyle = sg;
  g.fillRect(100, 0, 156, 144);
  g.restore();
  for (const q of art.gulls) {
    const a = t * q.v * 0.1 + q.ph;
    gull(g, 128 + Math.cos(a) * (70 + q.r), 12 + q.y * 0.5 + Math.sin(a * 1.3) * 5, t, q.ph, '#fffaf0');
  }
  blackFlag(g, 152, 18, t, 22, 14, 1);
  // The water: ripples and the sun's glints, moving under the jetty.
  for (let y = 98; y < PH; y += 3) {
    for (let x = 0; x < PW; x++) {
      const w = Math.sin(x * 0.18 + y * 0.7 + t * 1.4) + Math.sin(x * 0.07 - t * 0.9 + y);
      if (w > 1.3) {
        g.fillStyle = w > 1.7 && x > 150 ? '#ffe8c0' : '#a8c0dc';
        g.fillRect(x, y, 1, 1);
      }
    }
  }
  // The brethren on the jetty to the right, facing you, cheering; the
  // chief out in front.
  const deck = art.deck + 1;
  const crowd = [[236, 4], [222, 1], [208, 3], [194, 2]];
  for (const [i, [x, li]] of crowd.entries()) {
    const jump = s.cheer > 0 ? Math.round(Math.max(0, Math.sin(t * 6 + i * 1.9)) * 3 * s.cheer) : 0;
    const raise = s.cheer > 0.2 && Math.sin(t * 5 + i) > -0.3;
    sprite(g, PIRATES[li], 1, raise ? 3 : 0, x, deck - jump);
  }
  // (A pistol fired in the air, now and then.)
  if (s.cheer > 0.3) {
    const k = (t * 0.7) % 1;
    if (k < 0.08) {
      g.fillStyle = '#fff4c0';
      g.fillRect(212, deck - 34, 2, 2);
      g.fillStyle = '#ffb040';
      g.fillRect(212, deck - 36, 1, 2);
    }
    puff(g, 212, deck - 36, k * 1.6, '#d8d8e0', 0.6);
  }
  // You, walking up the jetty from the boat; then stopped, your hand up.
  const youX = lerp(20, 128, ease(s.walk));
  const walking = s.walk > 0 && s.walk < 1;
  sprite(g, info.look, 3, walking ? 1 + (Math.floor(t * 6) % 2) : s.cheer > 0.4 && Math.sin(t * 4) > 0 ? 3 : 0, youX, deck);
  const chiefX = lerp(182, 150, ease(s.chief));
  sprite(g, PIRATES[0], 1, s.chief > 0 && s.chief < 1 ? 1 + (Math.floor(t * 6) % 2) : s.chief >= 1 && Math.sin(t * 3) > 0 ? 3 : 0, chiefX, deck);
  // (The boat tied up at the jetty's foot, bobbing.)
  const by = 124 + Math.sin(t * 1.8) * 1;
  g.fillStyle = '#4a3020';
  g.fillRect(2, Math.round(by), 30, 3);
  g.fillStyle = '#8a6440';
  g.fillRect(2, Math.round(by) - 1, 30, 1);
  g.fillStyle = '#3a2818';
  g.fillRect(30, Math.round(by) - 6, 1, 6);
  void poly;
}
