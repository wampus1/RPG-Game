// The home town's picture (round 51; the scene, its words and its timing:
// see game/intros.js). Painted with brush.js, in layers:
//   - the sky (drawn each moment by the time of day, see intros.js), its
//     stars, the sun and moon;
//   - clouds, heaped and lit, drifting;
//   - the land, painted once: the mountains far off in the air, the hills
//     and their woods, a lake (or the sea, or an oasis, by the land), and
//     the meadow (or sand, or snow) the town stands on;
//   - the town itself, a moment at a time as it grows: lanes laid, fields
//     tilled, trees felled where houses are going up (frame first, then
//     walls, then the roof), people about the lanes once it's grown, the
//     wall round it last of all;
//   - trees close in front at the edges, moving in the wind;
//   - birds going over, smoke off the chimneys;
//   - the light of the hour over all of it (warm at dawn and dusk, blue at
//     night, its windows lit then).
import { VIEW_W, VIEW_H } from '../config.js';
import { Bmp, ramp, rgb, mixC, cloud, mountains, hills, broadTree, pine, palm, bush, meadow, house, cactus, rock, hash2, fbm, rngOf, poly } from './brush.js';
import { drawPerson } from './scenekit.js';

export const PW = VIEW_W / 2;
export const PH = VIEW_H / 2;
// The town's rows, back to front: where their feet are, how big.
export const ROWS = [
  { yb: 93, k: 0.6 },
  { yb: 103, k: 0.73 },
  { yb: 114, k: 0.87 },
  { yb: 126, k: 1 },
];
const GROUND = 86;

// The land about a town, by its biome.
const LANDS = {
  plains: { air: '#c4e4ee', mount: '#8a98cc', snow: 0.55, hill: '#5a8a78', forest: 'pine', wood: '#3e6e60', ground: '#79a84b', leaves: ['#e8a030', '#e2742c', '#d8c048', '#7aa83a'], tree: 'broad', bark: '#c4a090', water: 'lake', flowers: ['#f06a9a', '#ffffff', '#f8d040', '#a878e8'], crops: ['#e0c050', '#9ac048', '#c88a3a'], path: '#c8a878' },
  forest: { air: '#bfe0dc', mount: '#7a8ec4', snow: 0.5, hill: '#4a7a62', forest: 'pine', wood: '#2e5e48', ground: '#5e9a42', leaves: ['#4e9a3a', '#6aaa3a', '#3a8a40', '#e8a030'], tree: 'broad', many: true, bark: '#8a6a5a', water: 'lake', flowers: ['#ffffff', '#f8d040', '#e86a9a'], crops: ['#d8c050', '#8ab840'], path: '#b8986a' },
  taiga: { air: '#d4e2ee', mount: '#8a9ac4', snow: 0.8, hill: '#6a8a94', forest: 'pine', wood: '#2e5a52', ground: '#e6edf3', snowy: true, leaves: ['#2e5a46'], tree: 'pine', bark: '#5a4038', water: 'ice', flowers: [], crops: ['#c8b890'], path: '#a8988a' },
  tundra: { air: '#dde6f2', mount: '#9aa8cc', snow: 0.9, hill: '#9aaab8', forest: 'pine', wood: '#4a6a62', ground: '#e4ecf2', snowy: true, few: true, leaves: ['#3a5a4a'], tree: 'pine', bark: '#5a4038', water: 'ice', flowers: [], crops: ['#c8c0a0'], path: '#a8a098' },
  desert: { air: '#f2dab6', mount: '#c88a62', snow: 0, mesa: true, hill: '#d4a46c', forest: null, ground: '#e2c288', sandy: true, leaves: ['#4a8a3a'], tree: 'palm', cacti: true, bark: '#9a7a52', water: 'oasis', flowers: ['#f8a040'], crops: ['#c8b050', '#8aa040'], path: '#c89c6a' },
  savanna: { air: '#f0dcb4', mount: '#b08a78', snow: 0, hill: '#b8a060', forest: 'acacia', wood: '#6a7a3a', ground: '#c8b25a', leaves: ['#7a8a3a', '#9aa048', '#6a7a32'], tree: 'acacia', bark: '#6a4a3a', water: 'lake', flowers: ['#f8d040', '#e88a40'], crops: ['#d8b048', '#a8a040'], path: '#a88a5a' },
  jungle: { air: '#c4e6d6', mount: '#6a9a8a', snow: 0, hill: '#3a7a5a', forest: 'broad', wood: '#2a6a3a', ground: '#4a8a3a', leaves: ['#2e7a2e', '#3e9a3a', '#5aaa3a'], tree: 'broad', many: true, palms: true, bark: '#7a5a4a', water: 'river', flowers: ['#f04a6a', '#f8d040', '#ffffff'], crops: ['#8ab840', '#c8a040'], path: '#a8885a' },
  swamp: { air: '#c6ccb4', mount: '#7a8a8a', snow: 0, hill: '#4a5e4a', forest: 'broad', wood: '#3a4e38', ground: '#5a6e3a', leaves: ['#4a6a3a', '#5a7a3a', '#6a7a3a'], tree: 'broad', bark: '#5a4a3a', water: 'marsh', flowers: ['#d8d0f0'], crops: ['#8a9a50'], path: '#7a6a4a' },
  mountain: { air: '#cedfea', mount: '#8a92b8', snow: 0.5, near: true, hill: '#6a7a6a', forest: 'pine', wood: '#2e5a4a', ground: '#7a9a5a', leaves: ['#2e5a46'], tree: 'pine', rocks: true, bark: '#5a4038', water: 'lake', flowers: ['#ffffff', '#a878e8'], crops: ['#c8b050'], path: '#a89878' },
  beach: { air: '#c6eaf4', mount: '#8aa8c8', snow: 0, hill: '#5a9a7a', forest: 'palm', wood: '#3a7a4a', ground: '#7aa84a', leaves: ['#3a8a3a', '#5aa040'], tree: 'palm', bark: '#9a7a52', water: 'sea', flowers: ['#f8d040', '#ffffff'], crops: ['#c8b050'], path: '#d8c08a' },
};

// The town's houses, by its people (see LOOKS in intros.js): roof ramps,
// walls, timbers.
const R4 = (h) => ramp(h, 4, { spread: 0.34 });

export function paintHome(info, look) {
  const rng = rngOf((info.seed >>> 0) ^ 0x40e);
  const L = LANDS[info.biome] || LANDS.plains;
  const air = rgb(L.air);
  const land = new Bmp(PW, PH);
  // The mountains far off: lost in the air at their feet.
  const mpal = ramp(L.mount, 5, { spread: 0.4, shift: 14 });
  const snowPal = [rgb('#c4cce6'), rgb('#dce4f4'), rgb('#f2f6fc'), rgb('#ffffff')];
  if (L.mesa) {
    // (Flat-topped buttes in the desert, banded.)
    for (let i = 0; i < 4; i++) {
      const x0 = rng() * PW;
      const w = 30 + rng() * 50;
      const top = 44 + rng() * 22;
      const pal = mpal.map((c) => mixC(c, air, 0.35 + i * 0.05));
      for (let x = Math.floor(x0 - w / 2 - 8); x < x0 + w / 2 + 8; x++) {
        const edge = Math.min(x - (x0 - w / 2 - 8), x0 + w / 2 + 8 - x);
        const yt = edge < 8 ? top + (8 - edge) * 2.4 : top + (hash2(x, 1, i) < 0.2 ? 1 : 0);
        for (let y = Math.round(yt); y < GROUND; y++) {
          const band = Math.floor((y - top) / 4) % 2;
          const c = edge < 8 ? (x < x0 ? pal[3] : pal[1]) : band ? pal[2] : pal[3];
          land.set(x, y, mixC(c, air, (y - top) / (GROUND - top) * 0.3));
        }
        land.set(x, Math.round(yt), pal[4]);
      }
    }
  } else {
    mountains(land, { seed: info.seed % 9973, base: GROUND - 2, top: L.near ? 16 : 28, peaks: L.near ? 3 : 4, pal: mpal, snow: L.snow ? { y: 28 + (1 - L.snow) * 40, pal: snowPal } : null, air, airK: L.near ? 0.22 : 0.38 });
  }
  // The hills before them and their woods, a little bluer for the air.
  const hpal = R4(L.hill).map((c) => mixC(c, air, 0.32));
  const crest = (x) => GROUND - 9 + Math.sin(x * 0.028 + info.seed) * 4 + Math.sin(x * 0.09) * 1.6;
  hills(land, crest, GROUND + 6, hpal, { seed: 4 });
  const wpal = ramp(L.wood || L.hill, 5, { spread: 0.34 }).map((c) => mixC(c, air, 0.3));
  const bark = [rgb('#3a2a2a'), rgb('#4a3430'), rgb('#5a4038')];
  if (L.forest) {
    for (let x = -4; x < PW + 4; x += 3 + Math.floor(rng() * 3)) {
      if (L.few && rng() < 0.6) continue;
      const y = Math.round(crest(x) + 1 + rng() * 3);
      const s = 8 + rng() * 6;
      if (L.forest === 'pine') pine(land, x, y, s, wpal, bark, x * 7 + 1, { bare: false, snow: L.snowy ? [rgb('#f0f4f8'), rgb('#c8d4e4')] : null });
      else if (L.forest === 'palm') palm(land, x, y, s, wpal, bark, x);
      else broadTree(land, x, y + 2, s * 0.9, wpal, bark, x, { squash: L.forest === 'acacia' ? 0.45 : 1 });
    }
  }
  // Water: a lake off to the left (its far shore, the hills in it), the
  // sea along the front (for those who build on stilts), an oasis, pools.
  const water = L.water;
  const wcol = rgb(L.snowy ? '#b8cee0' : L.water === 'marsh' ? '#6a8a7a' : L.water === 'oasis' ? '#5ab0c8' : '#7cc2e4');
  const lake = water === 'sea' || look.stilts ? null : { x0: -10, x1: water === 'oasis' ? 50 : 96, y0: GROUND - 1, y1: GROUND + 9 };
  if (lake) {
    for (let y = lake.y0; y < lake.y1; y++) {
      const k = (y - lake.y0) / (lake.y1 - lake.y0);
      const xr = lake.x1 - k * k * 30 - (y % 2) * 1;
      for (let x = Math.max(0, lake.x0); x < xr; x++) {
        // (The hills and the sky in it, broken by ripples.)
        const src = land.get(x, 2 * lake.y0 - y - 2);
        const ripple = hash2(x >> 2, y, 3) < 0.15;
        let c = src ? mixC(src, wcol, 0.55) : mixC(air, wcol, 0.4);
        if (ripple) c = mixC(c, [255, 255, 255], 0.35);
        if (L.snowy && (x + y) % 5 === 0) c = mixC(c, [255, 255, 255], 0.4);
        land.set(x, y, c);
      }
      land.set(Math.round(xr), y, mixC(wcol, [255, 255, 255], 0.5));
    }
  }
  // The ground the town stands on: meadow, sand or snow, nearer and
  // greener toward you.
  const gpal = L.snowy ? [rgb('#b8c8d8'), rgb('#d4dfe9'), rgb('#e8eef4'), rgb('#ffffff')] : L.sandy ? R4(L.ground) : ramp(L.ground, 4, { spread: 0.3 });
  const top = (x) => GROUND + 3 + Math.sin(x * 0.05 + 1) * 1.5;
  for (let x = 0; x < PW; x++) {
    const y0 = Math.round(lake && x < lake.x1 - 20 ? lake.y1 : top(x));
    for (let y = y0; y < y0 + 3; y++) land.set(x, y, gpal[1]);
  }
  if (L.sandy) {
    // Sand: smooth, in long ripples the wind has drawn, the dips shaded.
    const sp = ramp(L.ground, 4, { spread: 0.16 });
    for (let y = GROUND + 4; y < PH; y++) {
      for (let x = 0; x < PW; x++) {
        const w = Math.sin(x * 0.11 + y * 0.9 + fbm(x * 0.03, y * 0.05, 3) * 6);
        const big = fbm(x * 0.015, y * 0.04, 8);
        land.set(x, y, w > 0.86 ? sp[3] : w < -0.92 ? sp[0] : big > 0.55 ? sp[2] : sp[1]);
      }
    }
    for (let i = 0; i < 40; i++) {
      const x = rng() * PW;
      const y = GROUND + 6 + rng() * 50;
      land.set(x, y, rgb('#8a7a5a'));
      land.set(x + 1, y, rgb('#b8a070'));
    }
  } else meadow(land, 0, GROUND + 4, PW, PH, gpal, info.seed % 997, { flowers: (L.flowers || []).map(rgb), tufts: 1, flowerK: 0.01 });
  if (lake) {
    // (The near shore: reeds, a strip of sand.)
    for (let x = 0; x < lake.x1 - 30; x++) {
      land.set(x, lake.y1, mixC(gpal[0], rgb('#c8b080'), 0.5));
      if (!L.snowy && hash2(x, 7, 1) < 0.25) for (let i = 1; i < 3 + (x % 3); i++) land.set(x, lake.y1 - i, rgb('#5a7a3a'));
    }
  }
  // (The sea in front, for the stilt folk: rows of waves.)
  if (water === 'sea' || look.stilts) {
    const sea = R4('#4a8ab8');
    for (let y = 118; y < PH; y++) {
      for (let x = 0; x < PW; x++) {
        const w = Math.sin(x * 0.2 + y * 1.3) + Math.sin(x * 0.07 - y * 0.6);
        land.set(x, y, w > 1.3 ? sea[3] : w > 0.4 ? sea[2] : sea[1]);
      }
      land.set(0, y, sea[1]);
    }
    for (let x = 0; x < PW; x++) for (let y = 116; y < 119; y++) land.set(x, y, rgb(y === 116 ? '#f0e0b0' : '#e0cc98'));
  }
  // Rocks here and there in the high country.
  if (L.rocks) for (let i = 0; i < 9; i++) rock(land, rng() * PW, GROUND + 8 + rng() * 40, 2 + rng() * 4, 2 + rng() * 3, R4('#8a8a90'), i);

  // ---- where the town will stand: the hall at its heart, a temple near
  // it, houses filling out from the middle row by row.
  const count = info.tier === 'city' ? 22 : info.tier === 'town' ? 14 : 8;
  const houses = [];
  const cx = PW / 2;
  houses.push({ kind: 'hall', row: 1, x: Math.round(cx - 14), w: 26, h: 15, t: 0.02 });
  if (info.temple) houses.push({ kind: 'temple', row: 0, x: Math.round(cx + 22), w: 15, h: 12, t: 0.12 });
  const slots = [];
  ROWS.forEach((R, ri) => {
    const w = Math.round(20 * R.k);
    const gap = Math.round(10 * R.k) + 3;
    const span = 180 + ri * 20;
    for (let x = Math.round(cx - span / 2); x + w < cx + span / 2; x += w + gap) slots.push({ row: ri, x, w });
  });
  slots.sort((a, b) => Math.abs(a.x + a.w / 2 - cx) * (1 + a.row * 0.15) - Math.abs(b.x + b.w / 2 - cx) * (1 + b.row * 0.15));
  const taken = (q) => houses.some((h) => h.row === q.row && q.x < h.x + h.w + Math.round(h.w * 0.4) + 3 && h.x < q.x + q.w + Math.round(q.w * 0.4) + 3);
  for (const q of slots) {
    if (houses.filter((h) => h.kind === 'house').length >= count) break;
    if (taken(q)) continue;
    const d = Math.abs(q.x + q.w / 2 - cx) / 110;
    const k = ROWS[q.row].k;
    houses.push({ kind: 'house', row: q.row, x: q.x + Math.round((rng() - 0.5) * 3), w: q.w + Math.round((rng() - 0.5) * 4), h: Math.round((11 + rng() * 4) * k), t: 0.08 + 0.74 * Math.min(1, d + (rng() - 0.5) * 0.1 + q.row * 0.04), roof: look.roofs[Math.floor(rng() * look.roofs.length)] });
  }
  const wallR = R4(look.wall);
  const timR = look.timber ? ramp(look.timber, 2, { spread: 0.16 }) : null;
  for (const h of houses) {
    h.t = Math.max(0.02, Math.min(0.88, h.t));
    h.roof ||= look.roofs[0];
    h.roofR = R4(h.roof);
    h.lit = rng() < 0.75;
    h.chimney = h.kind === 'house' && look.shape !== 'hut' && rng() < 0.65;
  }
  // Your family's: on the front row if it can be, near the middle.
  const front = houses.filter((h) => h.kind === 'house' && h.row >= 2).sort((a, b) => b.row - a.row || Math.abs(a.x - cx) - Math.abs(b.x - cx));
  const home = front[Math.floor(rng() * Math.min(2, front.length))] || houses[houses.length - 1];
  // Trees: woods round about, felled as the town comes to where they stand.
  const leaves = (L.leaves || ['#4e8a3a']).map((c) => ramp(c, 5, { spread: 0.46 }));
  const barkR = [rgb(L.bark), ...ramp(L.bark, 2, { spread: 0.3 })].map(rgb);
  const trees = [];
  const nTrees = L.many ? 34 : L.few ? 10 : 24;
  for (let i = 0; i < nTrees; i++) {
    const row = Math.floor(rng() * 4);
    const R = ROWS[row];
    const x = 6 + rng() * (PW - 12);
    const y = R.yb + Math.round((rng() - 0.5) * 6);
    const near = houses.find((h) => h.row === row && x > h.x - 8 && x < h.x + h.w + h.w * 0.4 + 6);
    trees.push({ x, y, s: (14 + rng() * 8) * R.k, kind: treeKind(L, rng), pal: leaves[Math.floor(rng() * leaves.length)], seed: i * 13 + 5, cut: near ? near.t - 0.02 : 2 });
  }
  for (const tr of trees) tr.sprite = treeSprite(tr, L, barkR);
  // Fields at the edges, tilled as it grows (not a city's).
  const fields = [];
  if (info.tier !== 'city' && !look.stilts && !L.snowy) {
    for (const side of [-1, 1]) fields.push({ x: side < 0 ? 4 : PW - 58, y: 104 + Math.floor(rng() * 6), w: 54, h: 13, t: 0.25 + rng() * 0.3, crop: rgb(L.crops[Math.floor(rng() * L.crops.length)]) });
  }
  // The folk about the lanes, today.
  const folk = Array.from({ length: info.tier === 'city' ? 16 : info.tier === 'town' ? 11 : 7 }, () => ({
    row: 1 + Math.floor(rng() * 3), x: 20 + rng() * (PW - 40), v: (3 + rng() * 4) * (rng() < 0.5 ? -1 : 1),
    shirt: ['#8f2f3a', '#2f6f8f', '#3a7a3a', '#7a5a2a', '#5a3a7a', '#c8a030', '#e0dccc'][Math.floor(rng() * 7)],
    hair: ['#1e1612', '#6e4424', '#c87a3a', '#c8c8c8', '#3a2418'][Math.floor(rng() * 5)],
    skin: ['#f4d0b0', '#d8a47c', '#b07a4a', '#8a5a34', '#e8b48c'][Math.floor(rng() * 5)],
  }));
  // Clouds (three shapes, drifting at their own speeds), birds.
  const cpal = [rgb('#b4d0e4'), rgb('#d4e6f0'), rgb('#eef4f4'), rgb('#fcfaf2'), rgb('#ffffff')];
  const clouds = Array.from({ length: 5 }, (_, i) => {
    const w = 34 + rng() * 40;
    const c = cloud(info.seed + i * 7, w, w * 0.38, cpal, { rim: rgb('#eaf8ff') });
    return { img: c.canvas(), x: rng() * (PW + 80), y: 22 + rng() * 26, v: 1.5 + rng() * 2.5 };
  });
  const birds = Array.from({ length: 4 }, () => ({ x: rng() * PW, y: 26 + rng() * 30, v: 9 + rng() * 6, ph: rng() * 6 }));
  // Trees close in front at either edge, in three moments of the wind.
  const fl = leaves[Math.floor(rng() * leaves.length)];
  const fr = leaves[Math.floor(rng() * leaves.length)];
  const framing = [0, 1, 2].map((k) => {
    const b = new Bmp(PW, PH);
    const sway = [0, 1, -0.6][k];
    if (L.tree === 'pine' || L.snowy) {
      pine(b, 6, PH + 4, 70, fl, barkR, 3, { snow: L.snowy ? [rgb('#f4f8fc'), rgb('#cfdae6')] : null });
      pine(b, PW - 8, PH + 6, 64, fr, barkR, 4, { snow: L.snowy ? [rgb('#f4f8fc'), rgb('#cfdae6')] : null });
    } else if (L.tree === 'palm') {
      palm(b, 4, PH + 2, 56, fl, barkR, 3 + k);
      palm(b, PW - 6, PH + 4, 50, fr, barkR, 4 + k);
    } else {
      broadTree(b, -4, PH + 8, 64, fl, barkR, 3, { sway, squash: L.tree === 'acacia' ? 0.5 : 1 });
      broadTree(b, PW + 2, PH + 10, 60, fr, barkR, 4, { sway: sway * 0.8, squash: L.tree === 'acacia' ? 0.5 : 1 });
    }
    bush(b, 30, PH - 2, 22, 10, fl, 5, { berries: L.snowy ? null : rgb('#e8504a') });
    bush(b, PW - 34, PH - 1, 18, 9, fr, 6);
    return b.canvas();
  });
  return { land: land.canvas(), L, look, houses, home, trees, fields, folk, clouds, birds, framing, wallR, timR, dyn: new Bmp(PW, PH), lake, walled: !!info.walled };
}

function treeKind(L, rng) {
  if (L.cacti && rng() < 0.6) return 'cactus';
  if (L.palms && rng() < 0.3) return 'palm';
  return L.tree;
}

// A tree of the town's, painted once (its sprite, its foot at the bottom
// middle).
function treeSprite(tr, L, bark) {
  const s = Math.round(tr.s);
  const b = new Bmp(s * 2 + 6, s * 2 + 6);
  const x = s + 3;
  const yb = b.h - 1;
  if (tr.kind === 'pine') pine(b, x, yb, s * 1.2, tr.pal, bark, tr.seed, { snow: L.snowy ? [rgb('#f4f8fc'), rgb('#cfdae6')] : null });
  else if (tr.kind === 'palm') palm(b, x, yb, s, tr.pal, bark, tr.seed);
  else if (tr.kind === 'cactus') cactus(b, x, yb, Math.round(s * 0.7), ramp('#5a9a4a', 4, { spread: 0.3 }), tr.seed);
  else broadTree(b, x, yb, s, tr.pal, bark, tr.seed, { squash: tr.kind === 'acacia' ? 0.45 : 1 });
  return { b, ox: x, oy: yb };
}

// ------------------------------------------------------------ each moment
// The town as it is at `prog` (0 bare land, 1 today), into `buf`'s context
// `g` (the sky already drawn behind). `tint`: [colour, alpha] of the hour
// over it; `night` 0-1 (the windows lit). Returns where your family's
// roof is (for the mark over it).
export function drawTown(g, art, { t, prog, today, tint, night, homeA }) {
  const { L, look } = art;
  // Clouds, drifting (faster while the years race).
  for (const c of art.clouds) {
    const x = ((c.x + t * c.v * (today ? 1 : 5)) % (PW + 100)) - 70;
    g.drawImage(c.img, Math.round(x), Math.round(c.y - c.img.height));
  }
  // Birds going over (today), their wings beating.
  if (today) {
    g.fillStyle = '#3a3a4a';
    for (const bd of art.birds) {
      const x = ((bd.x + t * bd.v) % (PW + 40)) - 20;
      const y = bd.y + Math.sin(t * 0.8 + bd.ph) * 3;
      const up = Math.floor(t * 6 + bd.ph) % 2;
      g.fillRect(Math.round(x), Math.round(y), 1, 1);
      g.fillRect(Math.round(x) - 1, Math.round(y) - up, 1, 1);
      g.fillRect(Math.round(x) + 1, Math.round(y) - up, 1, 1);
      g.fillRect(Math.round(x) - 2, Math.round(y) - up * 2 + (up ? 0 : 1), 1, 1);
      g.fillRect(Math.round(x) + 2, Math.round(y) - up * 2 + (up ? 0 : 1), 1, 1);
    }
  }
  g.drawImage(art.land, 0, 0);
  // The town, into its own bitmap: lanes, fields, then trees, houses and
  // people back to front, the wall, the trees in front.
  const b = art.dyn;
  b.d.fill(0);
  const road = rgb(L.path || '#c8a878');
  const roadR = ramp(road, 4, { spread: 0.25 });
  const lane = (x0, x1, y, w) => {
    for (let x = Math.floor(x0); x < x1; x++) {
      const end = Math.min(x - x0, x1 - x);
      for (let k = -1; k <= w; k++) {
        const n = hash2(x, y + k, 4);
        if (k === -1 || k === w) {
          if (n < 0.45) b.set(x, y + k, roadR[k === w ? 0 : 1]);
          continue;
        }
        if (end < 4 && hash2(x, y + k, 6) < 0.6 - end * 0.15) continue;
        b.set(x, y + k, n < 0.12 ? roadR[1] : n > 0.9 ? roadR[3] : k === 0 ? roadR[1] : roadR[2]);
      }
    }
  };
  if (prog > 0.03) {
    // The road up from the front to the hall.
    for (let y = ROWS[1].yb + 1; y < PH; y++) {
      const half = 2.5 + (y - ROWS[1].yb) * 0.12;
      for (let x = Math.round(PW / 2 - half); x < Math.round(PW / 2 + half); x++) {
        const edge = x === Math.round(PW / 2 - half) || x === Math.round(PW / 2 + half) - 1;
        b.set(x, y, edge ? roadR[0] : hash2(x, y, 4) < 0.15 ? roadR[1] : roadR[2]);
      }
    }
  }
  ROWS.forEach((R, ri) => {
    const built = art.houses.filter((h) => h.row === ri && prog >= h.t);
    if (!built.length) return;
    const x0 = Math.min(...built.map((h) => h.x)) - 6;
    const x1 = Math.max(...built.map((h) => h.x + h.w + h.w * 0.4)) + 6;
    lane(x0, x1, R.yb + 2, Math.max(2, Math.round(4 * R.k)));
  });
  for (const f of art.fields) {
    if (prog < f.t) continue;
    // (Rows of the crop running away from you, the earth between, a
    // hedge along the far side.)
    const cr = ramp(f.crop, 4, { spread: 0.3 });
    const soil = ramp('#8a6a48', 3, { spread: 0.2 });
    const mid = f.x + f.w / 2;
    poly(b, [[f.x + 6, f.y], [f.x + f.w - 6, f.y], [f.x + f.w, f.y + f.h], [f.x, f.y + f.h]], (x, y) => {
      const r = (y - f.y) / f.h;
      const u = (x - mid) / (f.w / 2 - 6 + r * 6);
      const row = Math.round(u * 6);
      const inRow = Math.abs(u * 6 - row) < 0.32;
      if (!inRow) return hash2(x, y, 2) < 0.3 ? soil[0] : soil[1];
      return hash2(x, y, 3) < 0.25 ? cr[3] : (y + row) % 3 ? cr[2] : cr[1];
    });
    for (let x = f.x + 6; x < f.x + f.w - 6; x++) {
      b.set(x, f.y - 1, ramp(art.L.hill, 3)[0]);
      if (hash2(x, 1, 5) < 0.6) b.set(x, f.y - 2, ramp(art.L.hill, 3)[1]);
    }
  }
  const items = [];
  for (const tr of art.trees) if (prog < tr.cut) items.push({ y: tr.y, x: tr.x, draw: () => b.blit(tr.sprite.b, Math.round(tr.x - tr.sprite.ox), Math.round(tr.y - tr.sprite.oy)) });
  const lit = [];
  const smoke = [];
  let homeRidge = null;
  for (const h of art.houses) {
    const rise = Math.max(0, Math.min(1, (prog - h.t) / 0.07));
    if (rise <= 0) continue;
    const R = ROWS[h.row];
    items.push({
      y: R.yb - 0.5, x: h.x,
      draw: () => {
        const mine = h === art.home && homeA > 0;
        const out = building(b, h, R, art, rise, mine, t);
        if (h === art.home) homeRidge = out.ridge;
        if (rise >= 1 && h.lit) lit.push(...out.wins);
        if (rise >= 1 && out.chimney) smoke.push(out.chimney);
      },
    });
  }
  if (today) {
    const pen = (x, y, col) => col && b.set(x, y, rgb(col));
    for (const f of art.folk) {
      const R = ROWS[f.row];
      let x = (f.x + t * f.v) % (PW + 20);
      if (x < -10) x += PW + 20;
      const y = R.yb + 2 + Math.max(1, Math.round(2 * R.k));
      items.push({ y: R.yb + 1, x, draw: () => drawPerson(pen, x, y + 1, { size: f.row >= 3 ? 'small' : 'tiny', pose: 'walk', frame: Math.floor(t * 5 + f.x), dir: f.v > 0 ? 1 : -1, shirt: f.shirt, hair: f.hair, skin: f.skin, lit: -1 }) });
    }
  }
  items.sort((p, q) => p.y - q.y || p.x - q.x);
  for (const it of items) it.draw();
  // The wall, last of all (a walled town's), across the front.
  if (art.walled) {
    const rise = Math.max(0, Math.min(1, (prog - 0.88) / 0.1));
    if (rise > 0) townWall(b, rise, look);
  }
  const dc = art.dynC || (art.dynC = document.createElement('canvas'));
  dc.width = PW;
  dc.height = PH;
  dc.getContext('2d').putImageData(new ImageData(b.d, PW, PH), 0, 0);
  g.drawImage(dc, 0, 0);
  // Your family's house, today: a warm light all round its edge.
  if (homeA > 0) homeGlow(g, art, homeA, t);
  // The trees in front, moving.
  const frame = art.framing[Math.floor(t * 1.4) % 3 === 2 ? 2 : Math.floor(t * 1.4) % 3];
  g.drawImage(frame, 0, 0);
  // The hour's light over all of it.
  if (tint && tint[1] > 0) {
    g.save();
    g.globalCompositeOperation = 'source-atop';
    g.globalAlpha = tint[1];
    g.fillStyle = tint[0];
    g.fillRect(0, 0, PW, PH);
    g.restore();
  }
  // Windows lit in the dark, a little of their light round them.
  if (night > 0.05) {
    const glow = look.glow || '#ffcc6a';
    g.save();
    g.globalCompositeOperation = 'lighter';
    for (const w of lit) {
      g.globalAlpha = night * 0.35;
      g.fillStyle = glow;
      g.fillRect(w.x - 1, w.y - 1, w.w + 2, w.h + 2);
      g.globalAlpha = night;
      g.fillRect(w.x, w.y, w.w, w.h);
    }
    g.restore();
  }
  // Smoke off the chimneys.
  if (prog > 0.1) {
    for (const c of smoke) {
      for (let i = 0; i < 4; i++) {
        const s = (t * 0.5 + i / 4 + c.x * 0.013) % 1;
        g.globalAlpha = 0.45 * (1 - s);
        g.fillStyle = night > 0.5 ? '#6a6a7a' : '#e0e0e4';
        const sx = c.x + Math.sin(s * 5 + c.x) * 1.5 + s * 6;
        const sy = c.y - s * 12;
        const r = 1 + Math.round(s * 2);
        g.fillRect(Math.round(sx), Math.round(sy), r, r);
      }
    }
    g.globalAlpha = 1;
  }
  return homeRidge;
}

// A light round the outside of your family's house (two pixels out from
// its edge), pulsing.
function homeGlow(g, art, a, t) {
  const h = art.home;
  const R = ROWS[h.row];
  const hb = art.homeB || (art.homeB = new Bmp(PW, PH));
  hb.d.fill(0);
  building(hb, h, R, art, 1, true, t);
  const gl = art.glowB || (art.glowB = new Bmp(PW, PH));
  gl.d.fill(0);
  const x0 = Math.max(0, h.x - 4);
  const x1 = Math.min(PW, h.x + h.w + Math.round(h.w * 0.5) + 6);
  const y0 = Math.max(0, R.yb - h.h - 30);
  const y1 = Math.min(PH, R.yb + 4);
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      if (hb.alpha(x, y)) continue;
      let near = 9;
      for (let dy = -2; dy <= 2 && near > 1; dy++) for (let dx = -2; dx <= 2; dx++) if (hb.alpha(x + dx, y + dy) > 200) near = Math.min(near, Math.max(Math.abs(dx), Math.abs(dy)));
      if (near <= 2) gl.set(x, y, near === 1 ? [255, 232, 150] : [255, 200, 110], near === 1 ? 1 : 0.55);
    }
  }
  const c = art.glowC || (art.glowC = document.createElement('canvas'));
  c.width = PW;
  c.height = PH;
  c.getContext('2d').putImageData(new ImageData(gl.d, PW, PH), 0, 0);
  g.save();
  g.globalAlpha = a * (0.7 + 0.3 * Math.sin(t * 3));
  g.drawImage(c, 0, 0);
  g.restore();
}

// One of the town's buildings, `rise` of the way up: a house; the hall (a
// bell tower on its ridge, a flag); a temple (a spire, or a dome in the
// sun).
function building(b, h, R, art, rise, mine, t) {
  const look = art.look;
  const hall = h.kind === 'hall';
  const temple = h.kind === 'temple';
  const shape = look.shape === 'hut' && (hall || temple) ? 'steep' : look.shape;
  const W = hall ? art.wallR.map((c) => mixC(c, [60, 50, 50], 0.12)) : temple ? art.wallR.map((c) => mixC(c, [255, 255, 255], 0.15)) : art.wallR;
  const tall = temple ? h.h + 4 : h.h;
  // (On stilts over the shallows.)
  if (look.stilts && h.row >= 2) for (let x = h.x + 1; x < h.x + h.w + 5; x += 4) for (let y = R.yb; y < R.yb + 5; y++) b.set(x, y, art.timR ? art.timR[y === R.yb ? 1 : 0] : [90, 64, 48]);
  const out = house(b, h.x, R.yb, h.w, tall, {
    wall: W, roof: h.roofR, timber: look.shape === 'flat' || look.shape === 'hut' ? null : art.timR, shape, thatch: look.shape === 'hut' || look.thatch,
    up: rise, windows: hall ? 4 : temple ? 2 : undefined, chimney: h.chimney, mine, glow: look.glow,
  });
  if (rise < 1 || !out.ridge) return out;
  const r = out.ridge;
  const cx = Math.round((r.x0 + r.x1) / 2);
  if (hall) {
    // The bell tower: its front lit, its side in shade, the bell in its
    // arch, a pointed cap, the flag.
    const ty = r.y - 9;
    for (let y = ty; y <= r.y + 2; y++) {
      for (let x = cx - 2; x <= cx + 2; x++) b.set(x, y, x === cx - 2 ? W[3] : W[2]);
      b.set(cx + 3, y - 1, W[1]);
      b.set(cx + 4, y - 1, W[0]);
    }
    for (let y = ty + 2; y < ty + 5; y++) for (let x = cx - 1; x <= cx + 1; x++) b.set(x, y, [40, 32, 40]);
    b.set(cx, ty + 4, [200, 160, 64]);
    for (let i = 0; i < 4; i++) for (let x = cx - 3 + i; x <= cx + 4 - i; x++) b.set(x, ty - 1 - i, x > cx ? h.roofR[0] : i % 2 ? h.roofR[3] : h.roofR[2]);
    for (let y = ty - 12; y < ty - 4; y++) b.set(cx, y, [58, 48, 48]);
    const wave = Math.round(Math.sin(t * 5));
    for (let y = ty - 12; y < ty - 9; y++) for (let x = cx + 1; x < cx + 6; x++) b.set(x, y + (x > cx + 3 ? wave : 0), y === ty - 11 ? [216, 74, 74] : [168, 48, 48]);
  } else if (temple) {
    if (look.shape === 'flat') {
      for (let dy = 0; dy < 6; dy++) {
        for (let dx = -5; dx <= 5; dx++) {
          if (dx * dx + dy * dy * 2 >= 30) continue;
          b.set(cx + dx, r.y - 1 - dy, rgb(dx < -2 ? '#f0e0b0' : dx > 2 ? '#b89858' : '#d8c088'));
        }
      }
      b.set(cx, r.y - 8, [255, 224, 112]);
      b.set(cx, r.y - 7, [200, 160, 64]);
    } else {
      for (let i = 0; i < 12; i++) {
        const half = Math.round((12 - i) / 4);
        for (let d = -half; d <= half; d++) b.set(cx + d, r.y - i, d > 0 ? h.roofR[0] : h.roofR[i % 3 === 0 ? 3 : 2]);
      }
      b.set(cx, r.y - 13, [255, 224, 112]);
      b.set(cx, r.y - 12, [200, 160, 64]);
    }
  }
  return out;
}

// A walled town's wall: stone in courses, a walk behind the battlements,
// towers at the ends and either side of the gate.
function townWall(b, rise, look) {
  const yb = 136;
  const hgt = Math.round(9 * rise);
  const S = R4(look.shape === 'flat' ? '#c8b488' : '#8a8a86');
  for (let x = 6; x < PW - 6; x++) {
    if (Math.abs(x - PW / 2) < 7) continue;
    for (let y = yb - hgt; y < yb; y++) {
      const course = (yb - y) % 3 === 0;
      const joint = (x + Math.floor((yb - y) / 3) * 2) % 5 === 0;
      b.set(x, y, course || joint ? S[0] : y === yb - hgt ? S[3] : S[2]);
    }
    if (rise >= 1) {
      b.set(x, yb - hgt - 1, S[3]);
      if (x % 4 < 2) {
        b.set(x, yb - hgt - 2, S[2]);
        b.set(x, yb - hgt - 3, S[3]);
      }
    }
  }
  if (rise < 1) return;
  for (const tx of [6, PW - 16, PW / 2 - 15, PW / 2 + 7]) {
    for (let y = yb - 16; y < yb; y++) {
      for (let x = tx; x < tx + 8; x++) b.set(x, y, x === tx ? S[3] : (x + y) % 4 === 0 ? S[0] : S[2]);
      for (let x = tx + 8; x < tx + 10; x++) b.set(x, y - (x - tx - 7), S[0]);
    }
    for (let x = tx; x < tx + 8; x++) b.set(x, yb - 17, S[3]);
    for (let x = tx; x < tx + 8; x += 2) {
      b.set(x, yb - 18, S[2]);
      b.set(x, yb - 19, S[3]);
    }
    for (let y = yb - 12; y < yb - 9; y++) b.set(tx + 3, y, [26, 26, 32]);
  }
  for (let y = yb - 7; y < yb; y++) {
    b.set(PW / 2 - 7, y, [74, 48, 32]);
    b.set(PW / 2 + 6, y, [74, 48, 32]);
  }
}
