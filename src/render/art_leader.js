// (Round 124) A leader's opening, painted (the scene, its words and its
// timing: see game/originintros.js). Three shots:
//   - the capital's square at the golden hour, from its far end: the great
//     hall across it (a palace for a realm: towers either end, gilt; a
//     town hall for a town: timbered wings), its belfry and its bell, its
//     stair, its great door open and lit; houses either side, bunting
//     strung across, banners down the front in the colours of how it's
//     governed; the square packed, an aisle left down the middle, the
//     watch at the foot of the stair; you walking up it, heads turning as
//     you pass, the bell swinging, doves going up off the roofs;
//   - the great doorway, close: the arch of it, the hall inside lit gold,
//     the banners either side; the chancellor (or the priest, or the
//     steward) before it; you kneeling, the crown (or the chain) coming
//     down; you rising, your hand up, the crowd's hands up below, the
//     petals coming down;
//   - the square again, at dusk, the windows and the lanterns lit, and
//     fireworks over the hall.
import { VIEW_W, VIEW_H } from '../config.js';
import { Bmp, ramp, rgb, mixC, sky, stars, cloud, mountains, hills, pine, broadTree, bush, house, poly, seg, hash2, fbm, rngOf } from './brush.js';
import { drawPerson } from './scenekit.js';

const PW = VIEW_W / 2;
const PH = VIEW_H / 2;
export const HALL = { cx: 128, x0: 74, x1: 182, top: 48, base: 88, door: { x0: 118, x1: 138, top: 70 }, stair: 6, bel: 24 };
// The aisle down the square to the stair: half its width at a row.
export const aisle = (y) => 5 + (y - HALL.base) * 0.22;
const R4 = (h, s = 0.34) => ramp(h, 4, { spread: s });
const R5 = (h, s = 0.4) => ramp(h, 5, { spread: s });

// ------------------------------------------------------------ painted once
export function paintLeader(info) {
  const seed = info.seed >>> 0;
  const r = rngOf(seed ^ 0x1ead);
  const realm = !!info.realm;
  const banner = rgb(info.color || '#d8a040');
  // Skies: the golden hour, and dusk (its first stars).
  const gold = new Bmp(PW, PH);
  sky(gold, [[0, '#4a6ab0'], [22, '#7a8cc8'], [44, '#e0a49a'], [62, '#ffc890'], [80, '#ffe2a8']]);
  const dusk = new Bmp(PW, PH);
  sky(dusk, [[0, '#0c1030'], [26, '#22205a'], [50, '#5a3a78'], [68, '#b8607a'], [84, '#f0a07a']]);
  stars(dusk, 46, seed, { band: false, n: 60 });
  // Clouds lit from under, low and warm.
  const cpal = [rgb('#a87a8a'), rgb('#d89a92'), rgb('#f4c09c'), rgb('#ffe0b4'), rgb('#fff4d8')];
  const clouds = Array.from({ length: 4 }, (_, i) => {
    const w = 40 + r() * 36;
    return { img: cloud(seed + i * 11, w, w * 0.34, cpal, { rim: rgb('#fff0d0') }).canvas(), x: r() * (PW + 60) - 30, y: 10 + r() * 28, v: 0.8 + r() * 1.2 };
  });
  // The land behind the town: mountains in the evening air, the wooded
  // hills.
  const land = new Bmp(PW, PH);
  const air = rgb('#e8b8a0');
  mountains(land, { seed: seed % 997, base: 70, top: 28, peaks: 4, pal: R5('#8a80b0', 0.42), snow: { y: 42, pal: [rgb('#c8b8d8'), rgb('#e8d4e0'), rgb('#fff0e8'), rgb('#ffffff')] }, air, airK: 0.4 });
  const crest = (x) => 66 + Math.sin(x * 0.04 + 1) * 3 + Math.sin(x * 0.11) * 1.2;
  hills(land, crest, 80, R4('#5a7a5a').map((c) => mixC(c, air, 0.35)), { seed: 5 });
  const fir = R5('#3a5a48', 0.36).map((c) => mixC(c, air, 0.28));
  const bark = [rgb('#3a2a2a'), rgb('#4a3430'), rgb('#5a4038')];
  for (let x = -4; x < PW + 4; x += 3 + Math.floor(r() * 3)) pine(land, x, Math.round(crest(x) + 2 + r() * 3), 8 + r() * 6, fir, bark, x * 5 + 1, { bare: false });

  // The town: the houses behind the hall, the hall, the houses either
  // side of the square, the square.
  const town = new Bmp(PW, PH);
  const wallR = R4(realm ? '#d8c8a4' : '#c8b088');
  const roofs = (realm ? ['#4a5a8a', '#3e4e7a', '#566892'] : ['#a8583a', '#9a4a32', '#b86a44']).map((h) => R4(h, 0.36));
  const timber = realm ? null : ramp('#4a3020', 2, { spread: 0.16 });
  const wins = [];
  const chimneys = [];
  // (A row of roofs behind the hall.)
  for (let i = 0; i < 9; i++) {
    const x = -6 + i * 30 + Math.round(r() * 8);
    if (x > HALL.x0 - 22 && x < HALL.x1 - 6) continue;
    const o = house(town, x, 80, 18 + Math.round(r() * 6), 12, { wall: wallR.map((c) => mixC(c, air, 0.25)), roof: roofs[i % 3].map((c) => mixC(c, air, 0.25)), timber, shape: 'gable', windows: 1, lit: 0 });
    wins.push(...o.wins.map((w) => ({ ...w, k: 0.6 })));
  }
  paintHall(town, info, wallR, roofs, wins, r);
  // The houses either side, three-quarters on, nearer and bigger.
  for (const [x, yb, w, h, ri] of [[-8, 104, 30, 22, 0], [20, 96, 24, 17, 1], [196, 96, 24, 17, 2], [222, 104, 32, 22, 1]]) {
    const o = house(town, x, yb, w, h, { wall: wallR, roof: roofs[ri], timber, shape: 'steep', windows: w > 26 ? 3 : 2, lit: 0, chimney: true });
    wins.push(...o.wins.map((q) => ({ ...q, k: 1 })));
    if (o.chimney) chimneys.push(o.chimney);
  }
  // The square: setts, in rows going away, worn paler down the middle.
  const sett = R4('#b8a88c', 0.28);
  for (let y = HALL.base + HALL.stair; y < PH; y++) {
    const d = (y - HALL.base) / (PH - HALL.base);
    const rowH = 1 + Math.floor(d * 3);
    const row = Math.floor((y - HALL.base) / rowH);
    for (let x = 0; x < PW; x++) {
      if (town.alpha(x, y) > 200 && y < 106) continue;
      const u = (x - HALL.cx) / (0.4 + d);
      const col = Math.floor((u + (row % 2) * 3) / (5 + d * 2));
      const edge = (y - HALL.base) % rowH === rowH - 1 || Math.abs(((u + (row % 2) * 3) % (5 + d * 2) + 99) % (5 + d * 2)) < 0.6;
      const worn = Math.abs(x - HALL.cx) < aisle(y) * 1.4 ? 1 : 0;
      const n = hash2(col, row, seed) * 0.6;
      town.set(x, y, edge ? sett[0] : n > 0.45 ? sett[2 + worn] : sett[1 + worn]);
    }
  }
  // (The light from the left: long shadows of the houses across it.)
  poly(town, [[22, 104], [60, 108], [78, 144], [0, 144], [0, 106]], [40, 30, 60], 0.22);
  poly(town, [[222, 104], [256, 106], [256, 120], [238, 118]], [40, 30, 60], 0.2);
  // Lamp posts down the square, a lantern on each.
  const lamps = [];
  for (const [x, y] of [[66, 112], [190, 112], [42, 134], [214, 134]]) {
    for (let k = 0; k < 16; k++) town.set(x, y - k, k < 2 ? [40, 34, 34] : [58, 52, 56]);
    town.set(x - 1, y - 16, [40, 34, 34]);
    town.set(x + 1, y - 16, [40, 34, 34]);
    for (let yy = y - 20; yy < y - 16; yy++) for (let xx = x - 1; xx <= x + 1; xx++) town.set(xx, yy, yy === y - 20 ? [40, 34, 34] : [90, 80, 60]);
    lamps.push({ x, y: y - 18 });
  }
  // The watch at the foot of the stair, in the colours, halberds up.
  const guards = [-24, -16, 16, 24].map((dx) => ({ x: HALL.cx + dx, y: HALL.base + HALL.stair + 2 }));
  // Bunting: strung from the hall's corners out to the houses either side.
  const strings = [
    { a: [HALL.x0 + 2, HALL.top + 6], b: [22, 80], sag: 10 },
    { a: [HALL.x1 - 2, HALL.top + 6], b: [234, 80], sag: 10 },
    { a: [HALL.x0 + 4, HALL.top + 16], b: [44, 94], sag: 8 },
    { a: [HALL.x1 - 4, HALL.top + 16], b: [212, 94], sag: 8 },
    { a: [22, 86], b: [234, 86], sag: 16 },
  ];
  // The crowd: the square full but for the aisle, row on row toward you.
  const shirts = ['#8f2f3a', '#2f6f8f', '#3a7a3a', '#7a5a2a', '#5a3a7a', '#c8a030', '#3a3a4a', '#e0dccc', '#a04a2a', '#4a6aa8', '#c86a3a', '#6a2a5a'];
  const skins = ['#f4d0b0', '#e8b48c', '#d49a6a', '#b07a4a', '#8a5a34', '#5a3a22'];
  const hairs = ['#1e1612', '#3a2418', '#6e4424', '#c87a3a', '#e8d8a0', '#8a8a92', '#a83a2a'];
  const crowd = [];
  for (let y = HALL.base + HALL.stair + 8; y < PH + 10; y += 5 + Math.floor((y - HALL.base) / 22)) {
    const big = y > 116;
    const gap = big ? 7 : 5;
    for (let x = 2 + (y % 3); x < PW - 2; x += gap + Math.floor(r() * 2)) {
      if (Math.abs(x - HALL.cx) < aisle(y) + 3) continue;
      if (y < 100 && (x < 40 || x > 216)) continue;
      crowd.push({ x, y: y + Math.round(r() * 2), big, small: !big && r() < 0.12, shirt: shirts[Math.floor(r() * shirts.length)], skin: skins[Math.floor(r() * skins.length)], hair: hairs[Math.floor(r() * hairs.length)], ph: r() * 6.28, flag: r() < 0.12 });
    }
  }
  crowd.sort((a, b) => a.y - b.y);
  // Doves on the roofs, to go up.
  const doves = Array.from({ length: 16 }, (_, i) => ({ x: HALL.x0 + 8 + r() * (HALL.x1 - HALL.x0 - 16), y: HALL.top - 2 + (i % 3), vx: (r() - 0.5) * 30, vy: -14 - r() * 10, ph: r() * 6, at: 6.5 + r() * 0.8 }));
  // What's lit at dusk: the same town, darker and bluer.
  const townC = town.canvas();
  const duskTown = document.createElement('canvas');
  duskTown.width = PW;
  duskTown.height = PH;
  const dg = duskTown.getContext('2d');
  dg.drawImage(townC, 0, 0);
  dg.globalCompositeOperation = 'source-atop';
  dg.fillStyle = 'rgba(24,20,62,0.55)';
  dg.fillRect(0, 0, PW, PH);
  const landC = land.canvas();
  const duskLand = document.createElement('canvas');
  duskLand.width = PW;
  duskLand.height = PH;
  const lg = duskLand.getContext('2d');
  lg.drawImage(landC, 0, 0);
  lg.globalCompositeOperation = 'source-atop';
  lg.fillStyle = 'rgba(30,24,70,0.6)';
  lg.fillRect(0, 0, PW, PH);
  return {
    gold: gold.canvas(), dusk: dusk.canvas(), land: landC, duskLand, town: townC, duskTown, clouds, wins, chimneys, lamps, guards, strings, crowd, doves, banner,
    deep: mixC(banner, [70, 30, 40], 0.45), door: paintDoorway(info, banner, seed), dyn: new Bmp(PW, PH),
    petals: Array.from({ length: 90 }, (_, i) => ({ x: r() * PW, v: 9 + r() * 14, ph: r() * 6.28, d: r() * 4, c: [info.color || '#ffd070', '#fff6e8', '#ff9ab0', '#ffd8e8'][i % 4] })),
  };
}

// The great hall across the square.
function paintHall(b, info, wallR, roofs, wins, r) {
  const realm = !!info.realm;
  const { cx, x0, x1, top, base, door } = HALL;
  const stone = R5(realm ? '#c2b090' : '#b09878', 0.42);
  const trim = realm ? R4('#e8b84a', 0.4) : R4('#8a5a34', 0.3);
  const roof = roofs[0];
  // The wings' roofs: hipped, slates (or tiles) in courses, lit along the
  // ridge, a dormer or two.
  for (let y = top - 14; y <= top; y++) {
    const k = (top - y) / 14;
    const xa = x0 - 2 + k * 10;
    const xb = x1 + 2 - k * 10;
    for (let x = Math.round(xa); x <= Math.round(xb); x++) {
      const side = x < xa + 6 * (1 - k) + 1 ? 2 : x > xb - 6 * (1 - k) - 1 ? 0 : (top - y) % 3 === 0 ? 1 : 2;
      b.set(x, y, y === top - 14 ? roof[3] : roof[side]);
    }
  }
  for (const dx of [-32, 32]) {
    const dxm = cx + dx;
    for (let y = top - 8; y <= top - 2; y++) for (let x = dxm - 3; x <= dxm + 3; x++) b.set(x, y, x === dxm - 3 ? stone[3] : stone[2]);
    for (let y = top - 6; y <= top - 3; y++) for (let x = dxm - 1; x <= dxm + 1; x++) b.set(x, y, [60, 52, 70]);
    for (let i = 0; i < 4; i++) for (let x = dxm - 4 + i; x <= dxm + 4 - i; x++) b.set(x, top - 9 - i, x > dxm ? roof[0] : roof[2]);
    wins.push({ x: dxm - 1, y: top - 6, w: 3, h: 4, k: 0.8 });
  }
  // The facade: ashlar in courses, lit from the left, a plinth.
  for (let y = top; y < base; y++) {
    for (let x = x0; x <= x1; x++) {
      const row = Math.floor((y - top) / 4);
      const joint = (y - top) % 4 === 3 || (x - x0 + (row % 2) * 5) % 10 === 9;
      const n = hash2(x >> 1, row, 7) * 0.5;
      let c = joint ? stone[1] : n > 0.35 ? stone[3] : stone[2];
      if (x < x0 + 2) c = stone[4];
      if (x > x1 - 2) c = stone[1];
      if (y > base - 4) c = joint ? stone[0] : stone[1];
      // (The low sun from the left; the shade of the houses at its foot.)
      const lit = 1.06 - ((x - x0) / (x1 - x0)) * 0.16 - clamp01((y - (base - 14)) / 14) * 0.12 - (y - top < 3 ? 0.14 : 0);
      b.set(x, y, c.map((v) => Math.min(255, Math.round(v * lit))));
    }
  }
  // A cornice under the roof; string courses.
  for (let x = x0 - 2; x <= x1 + 2; x++) {
    b.set(x, top, stone[4]);
    b.set(x, top + 1, stone[1]);
    b.set(x, top + 19, x % 2 ? stone[4] : stone[3]);
  }
  // Pilasters between the bays.
  for (const px of [x0 + 12, x0 + 30, cx - 16, cx + 16, x1 - 30, x1 - 12]) {
    for (let y = top + 2; y < base - 3; y++) {
      b.set(px, y, stone[4]);
      b.set(px + 1, y, stone[2]);
      b.set(px + 2, y, stone[1]);
    }
    for (let x = px - 1; x <= px + 3; x++) {
      b.set(x, top + 2, stone[3]);
      b.set(x, base - 4, stone[3]);
    }
  }
  // Tall windows in two rows, arched, their glass catching the evening.
  const bays = [x0 + 3, x0 + 19, cx - 12, cx + 6, x1 - 27, x1 - 9].filter((x) => x + 6 < door.x0 - 2 || x > door.x1 + 2);
  for (const wx of bays) {
    for (const [wy, wh] of [[top + 5, 11], [top + 23, 13]]) {
      for (let y = wy - 2; y < wy + wh; y++) {
        for (let x = wx; x < wx + 6; x++) {
          const arch = y < wy && Math.hypot(x - (wx + 2.5), (y - wy) * 1.3) > 3;
          if (arch) continue;
          const frame = x === wx || x === wx + 5 || y === wy + wh - 1;
          const glass = mixC([90, 100, 140], [255, 200, 140], clamp01((wy + wh - y) / wh) * 0.7);
          b.set(x, y, frame ? trim[1] : (x - wx) === 3 || (y - wy) % 4 === 3 ? trim[0] : glass);
        }
      }
      for (let x = wx - 1; x <= wx + 6; x++) b.set(x, wy + wh, stone[4]);
      wins.push({ x: wx + 1, y: wy, w: 4, h: wh - 1, k: 1 });
    }
  }
  // The great door: a deep arch, its voussoirs, the doors open on the lit
  // hall; the balcony over it.
  const dcx = (door.x0 + door.x1) / 2;
  const dr = (door.x1 - door.x0) / 2;
  for (let y = door.top - dr - 3; y < base; y++) {
    for (let x = door.x0 - 3; x <= door.x1 + 3; x++) {
      const inA = y >= door.top || Math.hypot(x - dcx, y - door.top) <= dr;
      const ring = y >= door.top - dr - 3 && (y >= door.top ? x < door.x0 || x > door.x1 : Math.hypot(x - dcx, y - door.top) <= dr + 3);
      if (inA) {
        const deep = clamp01((y - (door.top - dr)) / (base - door.top + dr));
        b.set(x, y, mixC([236, 178, 106], [120, 64, 40], deep * 0.75));
      } else if (ring) {
        const a = Math.atan2(y - door.top, x - dcx);
        const vous = Math.floor((a + Math.PI) / (Math.PI / 9)) % 2;
        b.set(x, y, y >= door.top ? stone[x < dcx ? 4 : 1] : vous ? stone[3] : stone[2]);
      }
    }
  }
  // (Inside: the far wall, a tapestry, candles: darker toward the edges.)
  for (let y = door.top - 4; y < base - 6; y++) for (let x = Math.round(dcx - 4); x <= Math.round(dcx + 4); x++) b.set(x, y, mixC(rgb(info.color || '#a03030'), [60, 30, 30], 0.35));
  for (const sx of [door.x0 + 2, door.x1 - 2]) for (let y = base - 10; y < base; y++) b.set(sx, y, [120, 70, 40]);
  // The doors, swung open against the jambs.
  for (const [sx, dir] of [[door.x0, 1], [door.x1, -1]]) {
    for (let y = door.top; y < base; y++) {
      for (let k = 0; k < 3; k++) b.set(sx + dir * k, y, k === 1 ? [74, 46, 26] : [52, 32, 20]);
      if ((y - door.top) % 5 === 0) b.set(sx + dir, y, [200, 160, 80]);
    }
  }
  // The keystone, carved; the realm's (or the town's) arms over it.
  for (let y = door.top - dr - 5; y < door.top - dr + 1; y++) for (let x = Math.round(dcx) - 2; x <= Math.round(dcx) + 2; x++) b.set(x, y, stone[4]);
  for (let y = door.top - dr - 12; y < door.top - dr - 5; y++) for (let x = Math.round(dcx) - 4; x <= Math.round(dcx) + 4; x++) {
    const sh = Math.abs(x - dcx) + (y - (door.top - dr - 12)) * 0.6;
    if (sh > 6) continue;
    b.set(x, y, x < dcx ? trim[3] : trim[2]);
  }
  // The stair: steps the width of the door bay and more, each lit along
  // its nosing.
  for (let s = 0; s < HALL.stair; s++) {
    const y = base + s;
    const half = 22 + s * 3;
    for (let x = cx - half; x <= cx + half; x++) b.set(x, y, s % 1 === 0 && (y - base) % 1 === 0 ? (x === cx - half ? stone[4] : stone[s % 2 ? 2 : 3]) : stone[2]);
    for (let x = cx - half; x <= cx + half; x++) if (s % 2 === 0) b.set(x, y, stone[4]);
  }
  // A carpet down the stair.
  for (let s = 0; s < HALL.stair; s++) for (let x = cx - 5; x <= cx + 5; x++) b.set(x, base + s, Math.abs(x - cx) === 5 ? trim[3] : s % 2 ? [150, 26, 40] : [176, 34, 50]);
  // The belfry over the middle: a square tower, its open arch, the
  // pointed cap (gilt for a realm), its weathervane.
  const tw = 9;
  const ttop = HALL.bel;
  for (let y = ttop; y < top; y++) {
    for (let x = cx - tw; x <= cx + tw; x++) {
      const c = x < cx - tw + 2 ? stone[4] : x > cx + tw - 2 ? stone[1] : (y + (x >> 2)) % 5 === 0 ? stone[1] : stone[2];
      b.set(x, y, c);
    }
  }
  for (let y = ttop + 2; y < ttop + 11; y++) for (let x = cx - 5; x <= cx + 5; x++) {
    if (y < ttop + 5 && Math.hypot(x - cx, y - (ttop + 5)) > 5) continue;
    b.set(x, y, [44, 36, 52]);
  }
  for (let x = cx - tw - 1; x <= cx + tw + 1; x++) {
    b.set(x, ttop, stone[4]);
    b.set(x, ttop + 11, stone[4]);
    b.set(x, ttop + 12, stone[1]);
  }
  // (A clock face under the belfry.)
  for (let y = ttop + 14; y < ttop + 22; y++) for (let x = cx - 4; x <= cx + 4; x++) {
    const d = Math.hypot(x - cx, y - (ttop + 18));
    if (d < 4) b.set(x, y, d < 3.2 ? [240, 232, 210] : trim[2]);
  }
  b.set(cx, ttop + 16, [40, 30, 30]);
  b.set(cx, ttop + 17, [40, 30, 30]);
  b.set(cx + 1, ttop + 18, [40, 30, 30]);
  const capC = realm ? trim : roof;
  for (let i = 1; i < 10; i++) {
    const half = Math.round(tw + 1 - i * 1.05);
    for (let x = cx - half; x <= cx + half; x++) b.set(x, ttop - i, x > cx ? capC[0] : x === cx - half ? capC[3] : capC[2]);
  }
  for (let y = ttop - 15; y < ttop - 9; y++) b.set(cx, y, [60, 50, 50]);
  // The towers at either end (a realm's palace): round, their cones.
  if (realm) {
    for (const tx of [x0 - 6, x1 + 6]) {
      for (let y = top - 18; y < base; y++) for (let x = tx - 7; x <= tx + 7; x++) {
        const k = (x - tx + 7) / 14;
        const c = mixC(stone[4], stone[0], Math.pow(k, 1.2));
        b.set(x, y, (y - top) % 5 === 4 ? mixC(c, stone[0], 0.3) : c);
      }
      for (const wy of [top - 8, top + 10]) for (let y = wy; y < wy + 6; y++) {
        b.set(tx - 1, y, [70, 60, 80]);
        b.set(tx, y, [70, 60, 80]);
      }
      wins.push({ x: tx - 1, y: top + 10, w: 2, h: 6, k: 1 });
      for (let i = 0; i < 14; i++) {
        const half = Math.round(8 - i * 0.58);
        for (let x = tx - half; x <= tx + half; x++) b.set(x, top - 18 - i, x > tx + 1 ? roof[0] : x < tx - half + 2 ? roof[3] : roof[2]);
      }
      b.set(tx, top - 32, trim[3]);
      b.set(tx, top - 33, trim[3]);
    }
  }
  void r;
}

// The great doorway, close (the second shot): the arch and the hall seen
// through it, going away, lit gold; the wall either side, its banners and
// sconces; the landing; the stair going down to the crowd. Who stands here
// is drawn over it (see drawDoorway).
export const DOOR = { cx: 128, hw: 30, ay: 60, floor: 112, back: 74 };
function paintDoorway(info, banner, seed) {
  const b = new Bmp(PW, PH);
  const { cx, hw, ay, floor, back } = DOOR;
  const stone = R5(info.realm ? '#9a8a70' : '#8e7a60', 0.44);
  const deep = rgb(mixC(banner, [70, 30, 40], 0.45));
  const inArch = (x, y) => Math.abs(x - cx) <= hw && (y >= ay || Math.hypot(x - cx, (y - ay) * 1.05) <= hw);
  // The hall inside: its back wall, the vault, the floor and the carpet
  // to the high seat, columns going away either side.
  const far = { x0: cx - 12, x1: cx + 12, y0: back - 22, y1: back + 12 };
  for (let y = 0; y < floor; y++) for (let x = cx - hw; x <= cx + hw; x++) {
    if (!inArch(x, y)) continue;
    let c;
    if (x >= far.x0 && x <= far.x1 && y >= far.y0 && y <= far.y1) {
      // (The far wall: a tapestry of the colours, candle-gold about it.)
      const tap = Math.abs(x - cx) < 7 && y > far.y0 + 3 && y < far.y1 - 6;
      c = tap ? mixC(deep, [40, 16, 20], (y - far.y0) / 40) : mixC([200, 140, 80], [150, 96, 56], (y - far.y0) / 34);
      if (tap && (y - far.y0) % 5 === 0) c = mixC(c, [255, 210, 120], 0.2);
    } else if (y > far.y1) {
      // (The floor: flags in perspective, warm, polished.)
      const d = (y - far.y1) / (floor - far.y1);
      const u = (x - cx) / (0.25 + d * 0.75);
      const row = Math.floor(Math.pow(d, 0.6) * 9);
      const col = Math.floor(u / 8);
      c = mixC([150, 96, 54], [196, 140, 82], ((row + col) & 1) * 0.35 + d * 0.3);
      if (Math.abs(u) < 7) c = Math.abs(u) > 6 ? [214, 168, 80] : mixC([120, 20, 34], [168, 32, 46], d);
    } else {
      // (The vault and the side walls, darker going up and out.)
      const up = y < far.y0 ? (far.y0 - y) / (far.y0 - (ay - hw)) : 0;
      const out = Math.abs(x - cx) / hw;
      c = mixC([176, 116, 66], [62, 36, 30], clamp01(up * 0.8 + out * 0.45));
      if (y < far.y0 && Math.abs(((x - cx) * 1.0 / Math.max(1, far.y0 - y + 6)) % 0.5) < 0.05) c = mixC(c, [40, 22, 20], 0.4);
    }
    b.set(x, y, c);
  }
  // (The high seat, under the tapestry, on its dais.)
  for (let y = far.y1 - 9; y <= far.y1; y++) for (let x = cx - 4; x <= cx + 4; x++) {
    const back2 = y < far.y1 - 4 && Math.abs(x - cx) < 4;
    b.set(x, y, back2 ? (x === cx - 3 ? [240, 190, 90] : [190, 130, 50]) : y >= far.y1 - 1 ? [110, 66, 40] : [150, 40, 50]);
  }
  for (let x = cx - 9; x <= cx + 9; x++) b.set(x, far.y1 + 1, [222, 176, 100]);
  // (Columns either side, going away: nearer ones bigger and darker.)
  for (const sx of [-1, 1]) for (let i = 3; i >= 0; i--) {
    const d = i / 3;
    const x = Math.round(cx + sx * (13 + (1 - d) * 0 + (3 - i) * 5));
    const w = 2 + (3 - i);
    const yTop = Math.round(far.y0 - 4 - (3 - i) * 5);
    const yBot = Math.round(far.y1 + 2 + (3 - i) * 6);
    for (let y = yTop; y < yBot; y++) for (let k = 0; k < w; k++) {
      if (!inArch(x + sx * k, y)) continue;
      const f = k / Math.max(1, w - 1);
      const c = mixC([214, 156, 90], [96, 56, 36], (sx < 0 ? f : 1 - f) * 0.8 + (3 - i) * 0.06);
      b.set(x + sx * k, y, y === yTop || y === yTop + 1 ? [226, 180, 96] : c);
    }
  }
  // The arch: a ring of voussoirs, the keystone carved with the arms;
  // the jambs, their capitals, shadowed inside.
  const ring = 8;
  for (let y = 0; y < floor; y++) for (let x = cx - hw - ring - 2; x <= cx + hw + ring + 2; x++) {
    if (inArch(x, y)) continue;
    const d = y < ay ? Math.hypot(x - cx, (y - ay) * 1.05) : Math.abs(x - cx);
    if (d > hw + ring) continue;
    const a = Math.atan2(y - ay, x - cx);
    const n = 15;
    const vk = ((a + Math.PI) / (Math.PI / n));
    const joint = y < ay ? Math.abs(vk - Math.round(vk)) < 0.07 : (y - ay) % 9 === 8;
    const lit = x < cx ? 1 : 0;
    let c = joint ? stone[0] : (Math.floor(vk) + (y >= ay ? Math.floor((y - ay) / 9) : 0)) % 2 ? stone[2 + lit] : stone[1 + lit];
    if (d < hw + 2) c = x < cx ? stone[0] : stone[1];
    if (d > hw + ring - 1) c = stone[lit ? 4 : 2];
    b.set(x, y, c);
  }
  for (let y = ay - hw - ring - 3; y < ay - hw + 3; y++) for (let x = cx - 6; x <= cx + 6; x++) {
    const w = 6 - (y - (ay - hw - ring - 3)) * 0.22;
    if (Math.abs(x - cx) > w) continue;
    b.set(x, y, x < cx ? stone[4] : stone[2]);
  }
  for (let y = ay - hw - ring + 1; y < ay - hw - ring + 9; y++) for (let x = cx - 4; x <= cx + 4; x++) {
    const m = Math.abs(x - cx) + Math.abs(y - (ay - hw - ring + 5));
    if (m > 4) continue;
    b.set(x, y, m === 4 ? [150, 110, 40] : x < cx ? [236, 196, 96] : [196, 150, 60]);
  }
  for (const sx of [-1, 1]) for (let y = ay - 1; y < ay + 3; y++) for (let k = -1; k <= ring + 1; k++) {
    const x = cx + sx * (hw + k);
    b.set(x, y, y === ay - 1 ? stone[4] : y === ay + 2 ? stone[0] : stone[3]);
  }
  // The doors, swung in against the jambs: oak, iron-banded, studded.
  for (const sx of [-1, 1]) for (let y = ay - 8; y < floor; y++) for (let k = 0; k < 6; k++) {
    const x = cx + sx * (hw - k);
    if (!inArch(x, y)) continue;
    const band = (y - ay) % 12 === 0 || (y - ay) % 12 === 1;
    let c = band ? [56, 52, 58] : k === 5 ? [40, 26, 18] : mixC([110, 70, 40], [70, 44, 26], k / 5);
    if (band && k % 2 === 0) c = [130, 120, 120];
    b.set(x, y, c);
  }
  // The wall about it: big ashlar in the evening light (warm from the
  // left, cool to the right), the grime of years low down.
  for (let y = 0; y < floor; y++) for (let x = 0; x < PW; x++) {
    if (Math.abs(x - cx) <= hw + ring + 2 && (y >= ay ? true : Math.hypot(x - cx, (y - ay) * 1.05) <= hw + ring)) continue;
    if (Math.abs(x - cx) <= 6 && y < ay - hw + 3 && y >= ay - hw - ring - 3) continue;
    const row = Math.floor(y / 8);
    const off = (row % 2) * 9;
    const joint = y % 8 === 7 || (x + off) % 18 === 17;
    const n = hash2(Math.floor((x + off) / 18), row, seed) * 0.5 + fbm(x * 0.08, y * 0.08, seed) * 0.4;
    let c = joint ? stone[0] : n > 0.62 ? stone[3] : n > 0.38 ? stone[2] : stone[1];
    if (!joint && (y % 8 === 0)) c = mixC(c, stone[4], 0.35);
    const warm = clamp01(1 - x / PW);
    c = mixC(c, [255, 190, 120], warm * 0.12);
    c = mixC(c, [40, 36, 60], clamp01(x / PW - 0.4) * 0.3 + clamp01((y - 86) / 26) * 0.25);
    b.set(x, y, c);
  }
  // A string course and a plinth.
  for (let x = 0; x < PW; x++) {
    if (Math.abs(x - cx) <= hw + ring) continue;
    b.set(x, 18, stone[4]);
    b.set(x, 19, stone[1]);
    for (let y = floor - 6; y < floor; y++) b.set(x, y, y === floor - 6 ? stone[3] : mixC(stone[1], [30, 26, 40], 0.3));
  }
  // The sconces either side: iron brackets (their flames are drawn live).
  for (const sx of [62, 194]) {
    for (let y = 66; y < 74; y++) b.set(sx, y, [36, 30, 34]);
    for (let x = sx - 2; x <= sx + 2; x++) b.set(x, 64, [46, 40, 44]);
    b.set(sx - 2, 63, [46, 40, 44]);
    b.set(sx + 2, 63, [46, 40, 44]);
    b.set(sx - 1, 74, [36, 30, 34]);
    b.set(sx + 1, 74, [36, 30, 34]);
  }
  // The landing: big flags, then the stair going down, step by step, each
  // nosing lit.
  for (let y = floor; y < PH; y++) for (let x = 0; x < PW; x++) {
    const step = y >= 124 ? Math.floor((y - 124) / 5) : -1;
    let c;
    if (step < 0) {
      const d = (y - floor) / 12;
      const u = (x - cx) / (1 + d * 0.3);
      const joint = (y - floor) % 6 === 5 || Math.abs(((u / 22) % 1 + 1) % 1) < 0.05;
      c = joint ? stone[0] : hash2(Math.floor(u / 22), Math.floor((y - floor) / 6), seed) > 0.5 ? stone[2] : stone[3];
    } else {
      const k = (y - 124) % 5;
      c = k === 0 ? stone[4] : k === 1 ? stone[2] : stone[1];
      c = mixC(c, [30, 26, 44], step * 0.12);
    }
    b.set(x, y, c);
  }
  for (let x = 0; x < PW; x++) b.set(x, floor, stone[0]);
  // The carpet out of the door, over the landing, down the stair.
  for (let y = floor; y < PH; y++) {
    const half = 12 + (y - floor) * 0.35;
    const edge = y >= 124 && (y - 124) % 5 === 0;
    for (let x = Math.round(cx - half); x <= Math.round(cx + half); x++) {
      const rim = Math.abs(x - cx) > half - 1.5;
      b.set(x, y, rim ? [210, 160, 70] : edge ? [190, 44, 58] : mixC([150, 26, 40], [110, 18, 30], clamp01((y - floor) / 30)));
    }
  }
  return b.canvas();
}

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

// ------------------------------------------------------------ each moment
// The square: `s` { t, dusk (0-1), walk (0-1: up the aisle and the stair),
// cheer, look (yours), bell, fireworks }.
export function drawSquare(g, art, s) {
  const { t, dusk } = s;
  g.drawImage(art.gold, 0, 0);
  if (dusk > 0) {
    g.globalAlpha = dusk;
    g.drawImage(art.dusk, 0, 0);
    g.globalAlpha = 1;
  }
  // (The sun going down, off to the left; then gone.)
  if (dusk < 1) {
    g.globalAlpha = 1 - dusk;
    const sg = g.createRadialGradient(18, 70, 0, 18, 70, 70);
    sg.addColorStop(0, 'rgba(255,236,190,0.75)');
    sg.addColorStop(1, 'rgba(255,190,130,0)');
    g.fillStyle = sg;
    g.fillRect(0, 0, 100, 100);
    g.globalAlpha = 1;
  }
  for (const c of art.clouds) {
    const x = ((c.x + t * c.v) % (PW + 90)) - 45;
    g.globalAlpha = 1 - dusk * 0.6;
    g.drawImage(c.img, Math.round(x), Math.round(c.y));
  }
  g.globalAlpha = 1;
  g.drawImage(dusk > 0.5 ? art.duskLand : art.land, 0, 0);
  if (dusk > 0 && dusk < 1) {
    g.globalAlpha = dusk < 0.5 ? dusk * 2 : 1;
    g.drawImage(art.duskLand, 0, 0);
    g.globalAlpha = 1;
  }
  g.drawImage(art.town, 0, 0);
  if (dusk > 0) {
    g.globalAlpha = dusk;
    g.drawImage(art.duskTown, 0, 0);
    g.globalAlpha = 1;
  }
  // The bell, swinging in its arch; its peals going out over the roofs.
  const bx = HALL.cx;
  const by = HALL.bel + 3;
  const sw = Math.sin(t * 3.2) * 0.5;
  g.fillStyle = '#c89a3a';
  g.save();
  g.translate(bx, by);
  g.rotate(sw);
  g.fillRect(-3, 0, 6, 5);
  g.fillRect(-4, 5, 8, 2);
  g.fillStyle = '#ffe08a';
  g.fillRect(-3, 0, 1, 6);
  g.fillStyle = '#5a3a1a';
  g.fillRect(0, 7, 1, 1);
  g.restore();
  for (let i = 0; i < 2; i++) {
    const k = ((t * 0.9 + i * 0.5) % 1);
    g.globalAlpha = (1 - k) * 0.3 * (1 - dusk * 0.5);
    g.strokeStyle = '#fff4d0';
    g.beginPath();
    g.ellipse(bx, by + 3, 8 + k * 30, 4 + k * 12, 0, Math.PI * 1.1, Math.PI * 1.9);
    g.stroke();
  }
  g.globalAlpha = 1;
  // The flag on the weathervane; the banners down the front, swaying.
  const fw = Math.sin(t * 6);
  for (let x = 0; x < 9; x++) {
    const dy = Math.round(Math.sin(t * 6 - x * 0.7) * 0.8 * (x / 9));
    g.fillStyle = x < 2 ? '#d8d8d8' : rgbS(art.banner, x % 2 ? -20 : 0);
    g.fillRect(HALL.cx + 1 + x, HALL.bel - 15 + dy, 1, 3);
  }
  void fw;
  for (const [i, x] of [HALL.x0 + 16, HALL.x0 + 34, HALL.cx - 22, HALL.cx + 20, HALL.x1 - 36, HALL.x1 - 18].entries()) {
    const sway = Math.sin(t * 1.3 + i) * 0.8;
    const y0 = HALL.top + 3;
    const len = 15;
    g.fillStyle = '#c8a040';
    g.fillRect(x - 3, y0 - 1, 7, 1);
    for (let y = 0; y < len; y++) {
      const dx = Math.round(sway * (y / len));
      const w = y > len - 3 ? (y === len - 1 ? 1 : 3) : 5;
      g.fillStyle = rgbS(art.deep, (y < 2 ? 20 : y > len - 4 ? -20 : 0) - dusk * 50);
      g.fillRect(x - Math.floor(w / 2) + dx, y0 + y, w, 1);
    }
    g.fillStyle = '#ffe080';
    g.fillRect(x + Math.round(sway * 0.4), y0 + 5, 1, 2);
  }
  // Bunting, strung across, its little flags fluttering.
  const cols = ['#e04848', '#f8d040', '#3a8ad8', '#ffffff', art.bannerHex || '#40a060'];
  for (const [si, S] of art.strings.entries()) {
    const n = Math.round(Math.hypot(S.b[0] - S.a[0], S.b[1] - S.a[1]) / 5);
    let px0 = null;
    for (let i = 0; i <= n; i++) {
      const k = i / n;
      const x = S.a[0] + (S.b[0] - S.a[0]) * k;
      const y = S.a[1] + (S.b[1] - S.a[1]) * k + Math.sin(k * Math.PI) * (S.sag + Math.sin(t * 1.4 + si) * 1);
      g.fillStyle = dusk > 0.5 ? '#3a3040' : '#5a4a40';
      if (px0) {
        g.fillRect(Math.round(x), Math.round(y), 1, 1);
        g.fillRect(Math.round((x + px0[0]) / 2), Math.round((y + px0[1]) / 2), 1, 1);
      }
      px0 = [x, y];
      if (i % 1 === 0 && i > 0 && i < n) {
        const flap = Math.sin(t * 7 + i + si) > 0.2 ? 1 : 0;
        g.fillStyle = cols[(i + si) % cols.length];
        g.globalAlpha = dusk > 0.5 ? 0.7 : 1;
        g.fillRect(Math.round(x) - 1, Math.round(y) + 1, 3, 1);
        g.fillRect(Math.round(x) - flap, Math.round(y) + 2, 2, 1);
        g.fillRect(Math.round(x), Math.round(y) + 3, 1, 1);
        g.globalAlpha = 1;
      }
    }
  }
  // The people, back to front (you among them, up the aisle).
  const b = art.dyn;
  b.d.fill(0);
  const pen = (x, y, col) => col && b.set(x, y, rgb(col));
  // Where you are, walking up the aisle then the stair.
  const wy = s.walk < 0.8 ? lerpN(PH + 8, HALL.base + HALL.stair + 4, s.walk / 0.8) : lerpN(HALL.base + HALL.stair + 4, HALL.base - 1, (s.walk - 0.8) / 0.2);
  const items = [];
  for (const q of art.crowd) {
    const passed = q.y > wy - 6;
    const turn = s.walk > 0 && s.walk < 1 && Math.abs(q.y - wy) < 24 ? (q.x < HALL.cx ? 1 : -1) : 0;
    const jump = s.cheer > 0 ? Math.max(0, Math.sin(t * 7 + q.ph)) * 2 * s.cheer : 0;
    items.push({ y: q.y, draw: () => {
      drawPerson(pen, q.x, q.y - jump, { size: q.big ? 'normal' : q.small ? 'tiny' : 'small', face: 'back', turn: passed ? turn : turn, pose: s.cheer > 0.3 ? 'wave' : q.flag && Math.sin(t + q.ph) > 0 ? 'wave' : 'stand', dir: q.x < HALL.cx ? 1 : -1, shirt: q.shirt, skin: q.skin, hair: q.hair, t: t + q.ph, lit: -1 });
    } });
  }
  for (const gd of art.guards) items.push({ y: gd.y, draw: () => {
    drawPerson(pen, gd.x, gd.y, { size: 'normal', face: 'front', pose: 'stand', shirt: '#6a6a78', pants: '#2a2a34', skin: '#d8a47c', hair: '#3a2418', lit: -1 });
    for (let k = 0; k < 4; k++) b.set(gd.x - 1, gd.y - 4 - k, art.banner);
    for (let k = 0; k < 16; k++) b.set(gd.x + 2, gd.y - 2 - k, [90, 64, 40]);
    b.set(gd.x + 2, gd.y - 18, [210, 210, 220]);
    b.set(gd.x + 3, gd.y - 17, [210, 210, 220]);
    b.set(gd.x + 1, gd.y - 17, [180, 180, 190]);
  } });
  if (s.walk > 0 && s.walk < 1.01) {
    const L = s.look || {};
    items.push({ y: wy, draw: () => {
      drawPerson(pen, HALL.cx, wy, { size: 'normal', face: s.walk >= 1 ? 'front' : 'back', pose: s.walk >= 1 ? (s.cheer > 0.3 ? 'wave' : 'stand') : 'walk', frame: Math.floor(t * 6), shirt: L.shirt || '#8f2f3a', pants: L.pants || '#3a3a4a', skin: L.skin || '#e8b48c', hair: L.hair || '#3a2418', t, lit: -1 });
      // (A cloak of the colours, on you.)
      for (let k = 0; k < 4; k++) b.set(HALL.cx + (k % 2 ? 1 : -1), wy - 3 - k, art.banner);
    } });
  }
  items.sort((p, q) => p.y - q.y);
  for (const it of items) it.draw();
  const dc = art.dynC || (art.dynC = document.createElement('canvas'));
  dc.width = PW;
  dc.height = PH;
  // (At dusk the crowd goes dark and blue; the lanterns pick them out.)
  if (dusk > 0) {
    const d = b.d;
    const k = 1 - dusk * 0.55;
    for (let i = 0; i < d.length; i += 4) {
      if (!d[i + 3]) continue;
      d[i] = d[i] * k;
      d[i + 1] = d[i + 1] * k + dusk * 4;
      d[i + 2] = d[i + 2] * k + dusk * 22;
    }
  }
  dc.getContext('2d').putImageData(new ImageData(b.d, PW, PH), 0, 0);
  g.drawImage(dc, 0, 0);
  // Doves going up off the roofs, wheeling away.
  for (const d of art.doves) {
    const k = t - d.at;
    if (k < 0) {
      g.fillStyle = '#f4f0e8';
      g.fillRect(Math.round(d.x), Math.round(d.y), 1, 1);
      continue;
    }
    const x = d.x + d.vx * k + Math.sin(k * 2 + d.ph) * 6;
    const y = d.y + d.vy * k + k * k * 1.2;
    if (y < -4) continue;
    const up = Math.floor(t * 9 + d.ph) % 2;
    g.fillStyle = '#f8f4ec';
    g.fillRect(Math.round(x), Math.round(y), 1, 1);
    g.fillRect(Math.round(x) - 1, Math.round(y) - up, 1, 1);
    g.fillRect(Math.round(x) + 1, Math.round(y) - up, 1, 1);
    g.fillRect(Math.round(x) - 2, Math.round(y) - (up ? 2 : 0), 1, 1);
    g.fillRect(Math.round(x) + 2, Math.round(y) - (up ? 2 : 0), 1, 1);
  }
  // Lights: the windows, the lanterns (lit at dusk), the door's glow.
  g.save();
  g.globalCompositeOperation = 'lighter';
  const dl = 0.15 + dusk * 0.55;
  for (const w of art.wins) {
    g.fillStyle = `rgba(255,190,100,${(dl * (w.k || 1) * (0.85 + 0.15 * Math.sin(t * 2 + w.x))).toFixed(3)})`;
    g.fillRect(w.x, w.y, w.w, w.h);
  }
  const dg = g.createRadialGradient(HALL.cx, HALL.base - 8, 2, HALL.cx, HALL.base - 8, 30);
  dg.addColorStop(0, `rgba(255,200,120,${(0.1 + dusk * 0.3).toFixed(3)})`);
  dg.addColorStop(1, 'rgba(255,160,80,0)');
  g.fillStyle = dg;
  g.fillRect(HALL.cx - 30, HALL.base - 38, 60, 60);
  for (const l of art.lamps) {
    const a = dusk * (0.5 + 0.1 * Math.sin(t * 9 + l.x));
    if (a <= 0.01) continue;
    const lg = g.createRadialGradient(l.x, l.y, 0, l.x, l.y, 16);
    lg.addColorStop(0, `rgba(255,210,120,${a.toFixed(3)})`);
    lg.addColorStop(1, 'rgba(255,160,80,0)');
    g.fillStyle = lg;
    g.fillRect(l.x - 16, l.y - 16, 32, 32);
    g.fillStyle = `rgba(255,240,180,${a.toFixed(3)})`;
    g.fillRect(l.x, l.y - 1, 1, 2);
  }
  g.restore();
  // Smoke off the chimneys.
  for (const c of art.chimneys) {
    for (let i = 0; i < 5; i++) {
      const k = (t * 0.3 + i / 5 + c.x * 0.01) % 1;
      g.globalAlpha = 0.25 * (1 - k);
      g.fillStyle = dusk > 0.5 ? '#5a5a6a' : '#c8c0c8';
      const rr = 1 + Math.round(k * 2);
      g.fillRect(Math.round(c.x + Math.sin(k * 4 + c.x) * 2 + k * 7), Math.round(c.y - k * 14), rr, rr);
    }
  }
  g.globalAlpha = 1;
  // Fireworks over the hall, at dusk.
  if (s.fireworks > 0) fireworks(g, t, s.fireworks);
  // Petals, in the cheering.
  if (s.cheer > 0) petals(g, art, t, s.cheer * (1 - dusk * 0.6));
}

// The doorway, close: `s` { t, crown (0-1: lifted, then down onto you),
// since (since it went on), risen (0-1), raise, cheer (0-1) }; `sprite`
// draws a character's own sprite (look, dir, frame, x, feet y).
const GUARD = { skin: '#d8a47c', hair: '#3a2418', hairStyle: 'short', shirt: '#5a5a6a', pants: '#2a2a34', shoes: '#1a1410', outfit: 'tunic', accent: '#c8a030', hat: 'helmet', beard: false, eyeColor: '#3a2a1a' };
export function drawDoorway(g, art, s, sprite, info) {
  const { t } = s;
  const { cx, hw, ay, floor, back } = DOOR;
  g.drawImage(art.door, 0, 0);
  // The hall's own light: candles on the far wall, the chandeliers, a
  // warm breath of it out of the door and over the landing.
  g.save();
  g.globalCompositeOperation = 'lighter';
  const fl = 0.9 + 0.1 * Math.sin(t * 7) * Math.sin(t * 3.1);
  const hg = g.createRadialGradient(cx, back, 2, cx, back, 46);
  hg.addColorStop(0, `rgba(255,190,110,${(0.32 * fl).toFixed(3)})`);
  hg.addColorStop(1, 'rgba(255,150,80,0)');
  g.fillStyle = hg;
  g.fillRect(cx - 46, back - 46, 92, 92);
  g.fillStyle = 'rgba(255,200,130,0.07)';
  g.beginPath();
  g.moveTo(cx - hw + 4, floor);
  g.lineTo(cx + hw - 4, floor);
  g.lineTo(cx + hw + 26, PH);
  g.lineTo(cx - hw - 26, PH);
  g.closePath();
  g.fill();
  g.restore();
  for (const [x, y, ph] of [[cx - 10, back - 8, 0], [cx + 10, back - 8, 1], [cx - 18, back - 14, 2], [cx + 18, back - 14, 3], [cx - 5, back - 30, 4], [cx, back - 31, 5], [cx + 5, back - 30, 6]]) {
    const on = Math.sin(t * 9 + ph * 2.3) > -0.6;
    g.fillStyle = on ? '#fff0b0' : '#ffc060';
    g.fillRect(x, y, 1, 1);
    g.fillStyle = 'rgba(255,190,90,0.35)';
    g.fillRect(x - 1, y, 3, 1);
  }
  g.fillStyle = '#3a2420';
  g.fillRect(cx - 6, back - 29, 13, 1);
  g.fillRect(cx, back - 36, 1, 7);
  // Dust turning in the light of the doorway.
  for (let i = 0; i < 22; i++) {
    const k = (t * 0.04 + i * 0.047) % 1;
    const x = cx - hw + 4 + ((i * 29) % (hw * 2 - 8)) + Math.sin(t * 0.6 + i) * 3;
    const y = ay - 16 + k * 70;
    g.fillStyle = `rgba(255,236,190,${(0.45 * Math.sin(k * Math.PI)).toFixed(3)})`;
    g.fillRect(Math.round(x), Math.round(y), 1, 1);
  }
  // The banners either side, long, in the colours, the arms on them in
  // gold, fringed, stirring in the draught from the door.
  const deep = mixC(art.banner, [70, 30, 40], 0.45);
  for (const [i, bx] of [22, PW - 36].entries()) {
    const sway = Math.sin(t * 1.1 + i * 2) * 1.0;
    g.fillStyle = '#4a3420';
    g.fillRect(bx - 2, 13, 18, 1);
    g.fillStyle = '#e0b050';
    g.fillRect(bx - 3, 12, 1, 3);
    g.fillRect(bx + 16, 12, 1, 3);
    const len = 76;
    for (let y = 0; y < len; y++) {
      const dx = Math.round(sway * (y / len));
      const tail = y > len - 8 ? (y - (len - 8)) * 0.9 : 0;
      for (let x = 0; x < 14; x++) {
        if (tail && Math.abs(x - 6.5) < tail - 0.5 && y > len - 8) {
          if (Math.abs(x - 6.5) > 7 - tail) continue;
        }
        const edge = x === 0 || x === 13;
        const fold = Math.sin((x + y * 0.05 + t * 0.4 + i) * 0.9) * 14;
        g.fillStyle = edge ? '#d8a848' : rgbS(deep, fold + (i ? -8 : 10));
        g.fillRect(bx + x + dx, 14 + y, 1, 1);
      }
    }
    for (let x = 0; x < 14; x += 2) {
      g.fillStyle = '#e8c060';
      g.fillRect(bx + x + Math.round(sway), 14 + len - (Math.abs(x - 6.5) < 2 ? 0 : 3), 1, 2);
    }
    g.fillStyle = '#c8983a';
    g.fillRect(bx + 1 + Math.round(sway * 0.2), 20, 12, 1);
    drawGlyph(g, info.glyph, bx + 4 + Math.round(sway * 0.4), 34, deep[0] + deep[1] + deep[2] > 360 ? '#5a2a14' : '#f0c860');
  }
  // The sconces' flames, and what they light.
  for (const [i, x] of [62, 194].entries()) {
    const f = Math.floor(t * 12 + i * 5) % 3;
    const gl = g.createRadialGradient(x, 60, 0, x, 60, 24);
    gl.addColorStop(0, `rgba(255,170,80,${(0.32 + f * 0.03).toFixed(3)})`);
    gl.addColorStop(1, 'rgba(255,140,60,0)');
    g.save();
    g.globalCompositeOperation = 'lighter';
    g.fillStyle = gl;
    g.fillRect(x - 24, 36, 48, 48);
    g.restore();
    g.fillStyle = '#ff8a30';
    g.fillRect(x - 1, 59 - f, 3, 4 + f);
    g.fillStyle = '#ffd060';
    g.fillRect(x, 60 - f, 1, 3 + f);
    g.fillStyle = '#fff6d0';
    g.fillRect(x, 62, 1, 1);
    if (f === 2) g.fillRect(x + (i ? -1 : 1), 56, 1, 1);
  }
  // The watch either side of the door, halberds grounded.
  for (const [i, x] of [84, 172].entries()) {
    const look = { ...GUARD, accent: rgbS(art.banner, 0), skin: i ? '#b07a4a' : '#e8b48c' };
    sprite(g, look, 0, 0, x, floor + 2);
    g.fillStyle = '#5a3e26';
    g.fillRect(x + 6, floor - 34, 1, 36);
    g.fillStyle = '#c8c8d0';
    g.fillRect(x + 4, floor - 36, 3, 4);
    g.fillRect(x + 7, floor - 35, 2, 2);
    g.fillStyle = '#f0f0f8';
    g.fillRect(x + 6, floor - 40, 1, 4);
    g.fillStyle = rgbS(art.banner, 0);
    g.fillRect(x + 4, floor - 31, 2, 3);
  }
  // You, kneeling on the carpet, then on your feet; and before you the
  // officiant, the crown (or the chain) held up, then brought down.
  const feet = floor + 1;
  const youX = cx - 15;
  const offX = cx + 16;
  sprite(g, art.robe, 1, s.crown > 0 && s.crown < 0.5 ? 3 : 0, offX, feet);
  const standing = s.risen > 0.5;
  sprite(g, info.look, standing ? 0 : 3, standing ? (s.raise && Math.sin(t * 5) > -0.2 ? 3 : 0) : 4, youX, feet);
  // (Where it goes: on the head, or about the neck.)
  const head = feet - (standing ? 24 : 20);
  const lift = ease(clamp01(s.crown / 0.35));
  const down = ease(clamp01((s.crown - 0.35) / 0.65));
  const hx = lerpN(offX - 4, youX, down);
  const hy = lerpN(lerpN(feet - 15, feet - 36, lift), info.crown ? head - 2 : head + 7, down);
  if (info.crown) drawCrown(g, standing ? youX : hx, standing ? head - 2 : hy, t);
  else drawChain(g, standing ? youX : hx, standing ? head + 7 : hy, t);
  // The moment it's on: a bloom, and sparks.
  if (s.crown >= 1 && s.since >= 0 && s.since < 1.6) {
    const a = 1 - s.since / 1.6;
    const lg = g.createRadialGradient(youX, head, 0, youX, head, 12 + s.since * 34);
    lg.addColorStop(0, `rgba(255,244,200,${(0.55 * a).toFixed(3)})`);
    lg.addColorStop(1, 'rgba(255,220,140,0)');
    g.save();
    g.globalCompositeOperation = 'lighter';
    g.fillStyle = lg;
    g.fillRect(youX - 60, head - 60, 120, 120);
    g.restore();
    for (let i = 0; i < 14; i++) {
      const ang = (i / 14) * Math.PI * 2 + s.since * 0.6;
      const rr = 4 + s.since * 26;
      g.globalAlpha = a;
      g.fillStyle = i % 2 ? '#ffffff' : '#ffe070';
      g.fillRect(Math.round(youX + Math.cos(ang) * rr), Math.round(head + Math.sin(ang) * rr * 0.8), 1, 1);
    }
    g.globalAlpha = 1;
  }
  // The crowd at the foot of the stair, near, their heads against the
  // light, hands going up.
  const rng = rngOf(77);
  for (let i = 0; i < 24; i++) {
    const x = 6 + i * 11 + Math.round(rng() * 5);
    if (Math.abs(x - cx) < 12) continue;
    const y = 128 + Math.round(rng() * 4);
    const jump = s.cheer > 0 ? Math.max(0, Math.sin(t * 6 + i * 1.7)) * 3 * s.cheer : 0;
    const hair = ['#1e1612', '#3a2418', '#6e4424', '#2a2020', '#8a8a92', '#a83a2a'][i % 6];
    const cloth = ['#3a2a3a', '#2a3040', '#3a3428', '#402a2a'][i % 4];
    const yy = y - jump;
    if (s.cheer > 0.2 && (i % 2 === 0 || s.cheer > 0.7)) {
      const ax = x + (i % 3 ? 5 : -6);
      const reach = 11 + Math.sin(t * 8 + i) * 2;
      g.fillStyle = cloth;
      g.fillRect(ax, yy - reach, 2, reach + 2);
      g.fillStyle = '#c8906a';
      g.fillRect(ax, yy - reach - 2, 2, 2);
    }
    g.fillStyle = cloth;
    g.fillRect(x - 7, yy + 3, 15, 10);
    g.fillStyle = hair;
    g.beginPath();
    g.ellipse(x, yy - 1, 4.5, 5, 0, 0, Math.PI * 2);
    g.fill();
    // (Rimmed by the hall's light.)
    g.fillStyle = 'rgba(255,200,130,0.55)';
    g.fillRect(x - 2, yy - 6, 5, 1);
    g.fillRect(x - 6, yy + 3, 13, 1);
  }
  if (s.cheer > 0) petals(g, art, t, s.cheer);
}

// A crown, at a person's scale: a gilt band, its points, its stones.
function drawCrown(g, x, y, t) {
  x = Math.round(x) - 3;
  y = Math.round(y);
  g.fillStyle = '#a8761e';
  g.fillRect(x, y, 8, 2);
  g.fillStyle = '#f0c040';
  g.fillRect(x, y, 8, 1);
  for (const dx of [0, 3, 4, 7]) {
    g.fillStyle = dx === 3 || dx === 4 ? '#f0c040' : '#d8a030';
    g.fillRect(x + dx, y - (dx === 3 || dx === 4 ? 2 : 1), 1, dx === 3 || dx === 4 ? 2 : 1);
  }
  g.fillStyle = '#e02848';
  g.fillRect(x + 3, y + 1, 2, 1);
  g.fillStyle = '#3070e0';
  g.fillRect(x + 1, y + 1, 1, 1);
  g.fillRect(x + 6, y + 1, 1, 1);
  if (Math.sin(t * 5) > 0.7) {
    g.fillStyle = '#ffffff';
    g.fillRect(x + 6, y - 3, 1, 3);
    g.fillRect(x + 5, y - 2, 3, 1);
  }
}

// A chain of office: links in a sweep, its medallion.
function drawChain(g, x, y, t) {
  x = Math.round(x);
  y = Math.round(y);
  for (let i = -4; i <= 4; i++) {
    g.fillStyle = i % 2 ? '#f0c040' : '#a8761e';
    g.fillRect(x + i, y + Math.round((16 - i * i) * 0.12), 1, 1);
  }
  g.fillStyle = '#d8a030';
  g.fillRect(x - 1, y + 3, 3, 3);
  g.fillStyle = '#fff0a0';
  g.fillRect(x, y + 4, 1, 1);
  if (Math.sin(t * 5) > 0.7) {
    g.fillStyle = '#ffffff';
    g.fillRect(x + 2, y + 2, 1, 1);
  }
}

// A glyph (★ ◆ Ω ✦ ¤ ♦...) drawn big on cloth, as a 5x5 shape.
function drawGlyph(g, glyph, x, y, col) {
  const shapes = {
    '★': ['..#..', '.###.', '#####', '.#.#.', '#...#'],
    '◆': ['..#..', '.###.', '#####', '.###.', '..#..'],
    Ω: ['.###.', '#...#', '#...#', '.#.#.', '##.##'],
    '✦': ['..#..', '..#..', '#####', '..#..', '..#..'],
    '¤': ['#...#', '.###.', '.#.#.', '.###.', '#...#'],
  };
  const sh = shapes[glyph] || shapes['◆'];
  g.fillStyle = col;
  sh.forEach((row, j) => [...row].forEach((c, i) => {
    if (c === '#') g.fillRect(x + i, y + j, 1, 1);
  }));
}

function fireworks(g, t, k) {
  // Rockets go up (a spark and its trail), burst (a ring of sparks
  // spreading, falling and fading, a few going on to crackle), the sky
  // and the roofs lit by each.
  for (let i = 0; i < 5; i++) {
    const period = 2.6 + (i % 3) * 0.5;
    const tt = t + i * 0.97;
    const ph = tt % period;
    const cycle = Math.floor(tt / period);
    const bx = 36 + ((i * 53 + cycle * 61) % 184);
    const by = 18 + ((i * 17 + cycle * 13) % 26);
    const cols = [['#ff5050', '#ffb0a0'], ['#ffd040', '#fff4b0'], ['#50b8ff', '#c0f0ff'], ['#ff70e0', '#ffd0f8'], ['#70ff90', '#d8ffe0'], ['#ffa040', '#ffe0a0']];
    const [col, hi] = cols[(i + cycle) % cols.length];
    const up = 0.8;
    if (ph < up) {
      const y = lerpN(104, by, ease(ph / up));
      g.globalAlpha = k;
      g.fillStyle = '#fff0c0';
      g.fillRect(Math.round(bx), Math.round(y), 1, 1);
      for (let j = 1; j < 6; j++) {
        g.globalAlpha = k * (0.6 - j * 0.1);
        g.fillStyle = '#ffb060';
        g.fillRect(Math.round(bx + Math.sin(y * 0.3 + j) * 0.5), Math.round(y) + j, 1, 1);
      }
      continue;
    }
    const s = ph - up;
    if (s > 1.8) continue;
    const a = Math.max(0, 1 - s / 1.8) * k;
    if (s < 0.35) {
      const [r0, g0, b0] = rgb(col);
      const lg = g.createRadialGradient(bx, by, 0, bx, by, 70);
      lg.addColorStop(0, `rgba(${r0},${g0},${b0},${(0.28 * (1 - s / 0.35) * k).toFixed(3)})`);
      lg.addColorStop(1, `rgba(${r0},${g0},${b0},0)`);
      g.save();
      g.globalCompositeOperation = 'lighter';
      g.fillStyle = lg;
      g.fillRect(bx - 70, by - 70, 140, 140);
      g.restore();
    }
    const n = 26;
    for (let j = 0; j < n; j++) {
      const ang = (j / n) * Math.PI * 2 + i;
      const sp = 26 * (0.75 + ((j * 7) % 5) * 0.06);
      const rr = sp * (1 - Math.exp(-s * 3));
      const x = bx + Math.cos(ang) * rr;
      const y = by + Math.sin(ang) * rr * 0.9 + s * s * 7;
      g.globalAlpha = a;
      g.fillStyle = s < 0.5 ? hi : col;
      g.fillRect(Math.round(x), Math.round(y), 1, 1);
      // (Their trails, back toward the burst.)
      g.globalAlpha = a * 0.45;
      g.fillStyle = col;
      for (let q = 1; q <= 2; q++) g.fillRect(Math.round(x - Math.cos(ang) * q * 2), Math.round(y - Math.sin(ang) * q * 2 - q * s), 1, 1);
      // (Some crackle as they go out.)
      if (s > 1.1 && j % 3 === 0 && Math.sin(t * 40 + j) > 0.3) {
        g.globalAlpha = a * 1.4;
        g.fillStyle = '#ffffff';
        g.fillRect(Math.round(x), Math.round(y) + 1, 1, 1);
      }
    }
  }
  g.globalAlpha = 1;
}

function petals(g, art, t, k) {
  for (const p of art.petals) {
    const s = t * 1 - p.d;
    if (s < 0) continue;
    const y = ((s * p.v) % (PH + 12)) - 6;
    const x = p.x + Math.sin(s * 1.8 + p.ph) * 6;
    g.globalAlpha = 0.9 * k;
    g.fillStyle = p.c;
    g.fillRect(Math.round(x), Math.round(y), 1, 1);
    if (Math.sin(s * 6 + p.ph) > 0) g.fillRect(Math.round(x) + 1, Math.round(y), 1, 1);
  }
  g.globalAlpha = 1;
}

const ease = (k) => (k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k));
const lerpN = (a, b, k) => a + (b - a) * (k < 0 ? 0 : k > 1 ? 1 : k);
function rgbS(c, d) {
  const [r, g, b] = Array.isArray(c) ? c : rgb(c);
  const f = (v) => Math.max(0, Math.min(255, Math.round(v + d)));
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}
export { broadTree, bush, seg };
