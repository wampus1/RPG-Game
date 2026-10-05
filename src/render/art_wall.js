// The Wall coming down, painted (round 51; the scene, its timing and its
// words: see game/wallfall.js). The Dagoni Islands seen from high over the
// sea and a little to the south, the whole ring of the storm round them:
//   - the sea, slate-grey under the storm (blue and glittering after),
//     paler toward the horizon;
//   - the islands as the map has them, each bit of land its own colour,
//     raised by how high it stands (the mountains, the volcano), lit from
//     the north-west, shallows and surf round the coasts; the lands beyond
//     the Wall far off in the haze;
//   - the Wall: banks of storm cloud heaped all round, the far side behind
//     the islands, the near side in front of them, lightning in it;
//   - the spires' light going up into the sky, each going out in turn.
import { VIEW_W, VIEW_H, REGION_W, REGION_D } from '../config.js';
import { STORM } from '../world/geography.js';
import { Bmp, ramp, rgb, mixC, sky, cloud, hash2, fbm, rngOf } from './brush.js';

const PW = VIEW_W / 2;
const PH = VIEW_H / 2;
export const HZ = 28;
const RX = STORM.rx + STORM.band + 10;
const RZ = STORM.rz + STORM.band + 10;

// A map square (cx, cz) to the picture: further north, higher up the
// picture and narrower (the view's perspective).
export function project(cx, cz) {
  const u = (cx - STORM.cx) / RX;
  const v = Math.max(-1.2, Math.min(1.2, (cz - STORM.cz) / RZ));
  const n = (v + 1) / 2;
  return { x: PW / 2 + u * (96 + n * 70), y: HZ + 8 + Math.pow(Math.max(0, n), 1.2) * (PH - HZ - 6), s: 0.55 + n * 0.75 };
}

const LAND = {
  beach: '#d8c890', plains: '#6aa04a', forest: '#3a7a3a', jungle: '#2a6a30', taiga: '#3a6a5a', tundra: '#b8c4c0', desert: '#d8b878', savanna: '#b0a050',
  mountain: '#8a8484', swamp: '#4e6a40', ashland: '#5a5250', cinderwood: '#6e3e2e', geyser: '#9a8a48', volcano: '#4a2a24', moor: '#6a6a50', fungal: '#7a4a7a', mangrove: '#3a6a46',
};
const HIGH = { mountain: 7, volcano: 9, tundra: 3, taiga: 2, forest: 1.5, jungle: 1.5, moor: 2, ashland: 2.5, cinderwood: 2, geyser: 1.5, fungal: 1 };

export function paintWallScene(ow, seed) {
  const r = rngOf(seed);
  // The sea: storm-dark, and clear (crossed between as it breaks); the sky
  // over it.
  const seaOf = (top, horizon, near) => {
    const b = new Bmp(PW, PH);
    sky(b, [[0, top], [HZ, horizon]], 0, PW);
    for (let y = HZ; y < PH; y++) {
      const k = (y - HZ) / (PH - HZ);
      for (let x = 0; x < PW; x++) {
        const n = Math.sin(x * (0.3 - k * 0.15) + y * 2.1 + fbm(x * 0.05, y * 0.1, 3) * 5);
        const c = mixC(horizon, near, Math.pow(k, 0.7));
        b.set(x, y, n > 0.92 ? mixC(c, [255, 255, 255], 0.18) : n < -0.9 ? mixC(c, [0, 0, 20], 0.15) : c);
      }
    }
    return b.canvas();
  };
  const seaDark = seaOf(rgb('#1c2230'), rgb('#4a5262'), rgb('#141e2c'));
  const seaClear = seaOf(rgb('#6ab0e8'), rgb('#c8e8f4'), rgb('#1e5a8e'));
  // The land, from the north (far) to the south (near), each square raised
  // by how high it stands, its slopes lit from the north-west.
  const land = new Bmp(PW, PH);
  const shallows = new Bmp(PW, PH);
  if (ow && ow.mapBiome) {
    const x0 = Math.floor(STORM.cx - RX);
    const x1 = Math.ceil(STORM.cx + RX);
    const z0 = Math.floor(STORM.cz - RZ * 1.2);
    const z1 = Math.ceil(STORM.cz + RZ * 1.2);
    const bio = (cx, cz) => {
      try {
        return ow.mapBiome(cx, cz);
      } catch {
        return null;
      }
    };
    const hOf = (b, cx, cz) => (!b || b === 'ocean' ? 0 : (HIGH[b] || 0.6) * (0.6 + fbm(cx * 0.15, cz * 0.15, 5) * 0.8));
    for (let cz = z0; cz <= z1; cz++) {
      for (let cx = x0; cx <= x1; cx++) {
        const b = bio(cx, cz);
        const p = project(cx, cz);
        const q = project(cx + 1, cz + 1);
        if (!b || b === 'ocean') {
          // (Shallows round a coast.)
          const coast = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => {
            const n = bio(cx + dx, cz + dz);
            return n && n !== 'ocean';
          });
          if (coast) for (let y = Math.floor(p.y); y < Math.ceil(q.y) + 1; y++) for (let x = Math.floor(p.x); x < Math.ceil(q.x); x++) shallows.set(x, y, [90, 170, 190], 0.45);
          continue;
        }
        const inside = ow.insideStorm ? ow.insideStorm((cx + 0.5) * REGION_W, (cz + 0.5) * REGION_D) : true;
        const h = hOf(b, cx, cz);
        const lit = h - hOf(bio(cx - 1, cz - 1), cx - 1, cz - 1);
        let c = rgb(LAND[b] || '#5a7a4a');
        const pal = ramp(c, 4, { spread: 0.3 });
        c = lit > 0.8 ? pal[3] : lit > 0.1 ? pal[2] : lit > -0.6 ? pal[1] : pal[0];
        if (b === 'mountain' && h > 6) c = mixC(c, [240, 244, 250], 0.6);
        if (!inside) c = mixC(rgb('#7a6a50'), [120, 130, 150], 0.4);
        const lift = Math.round(h * p.s * 1.4);
        const ya = Math.floor(p.y) - lift;
        const yb = Math.ceil(q.y);
        for (let y = ya; y <= yb; y++) {
          for (let x = Math.floor(p.x); x < Math.ceil(q.x); x++) {
            // (The face down toward you, below its top, in shade.)
            const face = y > Math.ceil(q.y) - lift;
            land.set(x, y, face ? pal[0] : c);
          }
        }
        // (Surf where it meets the sea, south side.)
        const s = bio(cx, cz + 1);
        if ((!s || s === 'ocean') && h < 2) for (let x = Math.floor(p.x); x < Math.ceil(q.x); x++) land.set(x, yb + 1, [230, 240, 245], 0.8);
      }
    }
  }
  // The Wall's banks of cloud: a few shapes, painted once (in the storm's
  // greys, their tops lit faintly).
  const cp = [rgb('#1a1e28'), rgb('#262c3a'), rgb('#343c4e'), rgb('#4a5468'), rgb('#68748a')];
  const banks = [0, 1, 2, 3, 4, 5].map((i) => cloud(seed + i * 11, 20 + i * 4, 14 + i * 3, cp, { rim: rgb('#7a86a0'), flat: 0.2 }).canvas());
  const ring = [];
  const n = 52;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + (r() - 0.5) * 0.06;
    ring.push({ a, k: Math.floor(r() * banks.length), off: (r() - 0.5) * 0.4, out: 0.7 + r() * 0.8, ph: r() * 6 });
  }
  return { seaDark, seaClear, land: land.canvas(), shallows: shallows.canvas(), banks, ring, sparkles: Array.from({ length: 90 }, () => ({ x: r() * PW, y: HZ + 4 + r() * (PH - HZ - 4), ph: r() * 6 })) };
}

// Where a bank of the Wall stands (at angle `a` round the ring, `brk` of
// the way blown outward): on the picture, and how big.
function bankAt(q, brk) {
  const rr = 1 + q.off * 0.12 + brk * q.out * 0.9;
  const cx = STORM.cx + Math.cos(q.a) * (STORM.rx + STORM.band * 0.4) * rr;
  const cz = STORM.cz + Math.sin(q.a) * (STORM.rz + STORM.band * 0.4) * rr;
  return project(cx, cz);
}

// The Wall's banks on one side of the ring (far: behind the islands).
export function drawBanks(g, art, { t, brk, far, flash, boltAng, shake }) {
  for (const q of art.ring) {
    if ((Math.sin(q.a) < 0) !== far) continue;
    const p = bankAt(q, brk);
    const img = art.banks[q.k];
    // (The far side towers up behind the islands; the near side, seen
    // from above, lies low, so the islands show over it.)
    const s = p.s * (far ? 1 : 0.8) * (1 + brk * 0.6);
    const w = Math.round(img.width * s);
    const h = Math.round(img.height * s * (far ? 1.3 : 0.5) * (1 - brk * 0.3));
    const a = (1 - brk) * (shake > 0.5 && Math.sin(q.ph + t * 4) > 0.75 ? 0.45 : 1);
    if (a <= 0.02) continue;
    g.globalAlpha = a;
    const jx = shake ? Math.round(Math.sin(t * 30 + q.ph) * shake) : 0;
    g.drawImage(img, Math.round(p.x - w / 2) + jx, Math.round(p.y - h + 4), w, h);
    // (Lit from inside where the lightning is.)
    const d = Math.abs(Math.atan2(Math.sin(q.a - boltAng), Math.cos(q.a - boltAng)));
    if (flash > 0 && d < 0.5) {
      g.save();
      g.globalCompositeOperation = 'lighter';
      g.globalAlpha = a * flash * (1 - d * 2) * 0.6;
      const lg = g.createRadialGradient(p.x, p.y - h * 0.4, 1, p.x, p.y - h * 0.4, w * 0.6);
      lg.addColorStop(0, 'rgba(200,210,255,0.9)');
      lg.addColorStop(1, 'rgba(120,130,220,0)');
      g.fillStyle = lg;
      g.fillRect(p.x - w, p.y - h * 1.2, w * 2, h * 1.4);
      g.restore();
    }
  }
  g.globalAlpha = 1;
}

// A bolt down out of the Wall onto the sea.
export function drawBolt(g, a, alpha, t) {
  const p = bankAt({ a, off: 0, out: 0 }, 0);
  let x = p.x;
  g.globalAlpha = alpha;
  g.fillStyle = '#f4f6ff';
  for (let y = p.y - 34 * p.s; y < p.y; y++) {
    x += (hash2(Math.round(y), Math.floor(t * 12), 3) - 0.5) * 2.2;
    g.fillRect(Math.round(x), Math.round(y), 1, 1);
  }
  g.globalAlpha = 1;
}

// After: the sun breaking through, beams of it slanting down from the
// north-west, the sea glittering.
export function drawSunlight(g, art, t, k) {
  if (k <= 0) return;
  g.save();
  g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 5; i++) {
    const x0 = 20 + i * 52 + Math.sin(t * 0.3 + i) * 6;
    g.globalAlpha = k * 0.12;
    g.fillStyle = '#fff4c8';
    g.beginPath();
    g.moveTo(x0, 0);
    g.lineTo(x0 + 14, 0);
    g.lineTo(x0 + 60, PH);
    g.lineTo(x0 + 34, PH);
    g.closePath();
    g.fill();
  }
  g.restore();
  g.fillStyle = '#ffffff';
  for (const s of art.sparkles) {
    const a = Math.sin(t * 3 + s.ph);
    if (a < 0.6) continue;
    g.globalAlpha = k * (a - 0.6) * 2.5;
    g.fillRect(Math.round(s.x), Math.round(s.y), 1, 1);
    if (a > 0.95) {
      g.fillRect(Math.round(s.x) - 1, Math.round(s.y), 3, 1);
      g.fillRect(Math.round(s.x), Math.round(s.y) - 1, 1, 3);
    }
  }
  g.globalAlpha = 1;
}
