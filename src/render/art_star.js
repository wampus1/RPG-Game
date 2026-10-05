// The fallen star's opening, painted (round 51; the scene, its words and
// its timing: see game/starfall.js). A village on Thessa on a clear night:
// the moon up, the river of stars across the sky; mountains far off, pale
// where the moon catches them; dark woods on the hills behind the village;
// its houses round a square, their windows lit, lanterns by the lane; and
// its people out round a bonfire in the square, looking up. The star comes
// down behind the hills (its light over everything as it comes), the
// shockwave rises out of them, and the dust comes rolling through the
// village and knocks everyone flat.
import { VIEW_W, VIEW_H } from '../config.js';
import { Bmp, ramp, rgb, mixC, sky, stars, mountains, hills, pine, broadTree, bush, meadow, house, hash2, rngOf } from './brush.js';
import { drawPerson } from './scenekit.js';

const PW = VIEW_W / 2;
const PH = VIEW_H / 2;
// Where the bonfire burns, in the square; the square round it.
export const FIRE = { x: 128, y: 123 };
export const SQUARE = { rx: 46, ry: 11 };
// The village's houses: [x, feet, width, height, roof] (the back row
// smaller, the front ones either side of the square, clear of it).
export const HOMES = [
  [40, 104, 15, 9, 0], [62, 103, 13, 8, 1], [170, 103, 14, 8, 2], [192, 105, 17, 9, 0],
  [4, 126, 30, 16, 1], [48, 117, 22, 13, 2], [178, 117, 22, 13, 0], [212, 129, 30, 16, 1],
];
const NIGHT = rgb('#161c3c');
// A colour as it looks by moonlight (darker, bluer).
const moonlit = (c, k = 0.5) => mixC(c, NIGHT, k);
const nightR = (h, n = 4, k = 0.5, spread = 0.34) => ramp(h, n, { spread }).map((c) => moonlit(c, k));

// What doesn't move, painted once, in layers (so what happens behind the
// hills stays behind them).
export function paintStarfall(seed, land) {
  const rng = rngOf(seed);
  // The sky: deep at the top, a violet glow low down; the stars; the moon.
  const skyB = new Bmp(PW, PH);
  sky(skyB, [[0, '#04061a'], [36, '#0a1032'], [64, '#18204c'], [88, '#2c2a5c']]);
  stars(skyB, 84, seed, { n: 170 });
  const mx = 214;
  const my = 30;
  for (let y = -12; y <= 12; y++) {
    for (let x = -12; x <= 12; x++) {
      const d = Math.hypot(x, y);
      if (d < 5.2) {
        // (Its face, lit from the right, a few darker seas on it.)
        const k = (x + 2) / 6 - y * 0.05;
        let c = k > 0.3 ? [248, 246, 232] : k > -0.3 ? [222, 224, 230] : [176, 182, 210];
        if (hash2(x + 9, y + 9, 3) < 0.18 && d < 4) c = mixC(c, [140, 150, 190], 0.4);
        skyB.set(mx + x, my + y, c);
      } else if (d < 12) skyB.set(mx + x, my + y, [190, 200, 240], (12 - d) / 7 * 0.22);
    }
  }
  // Mountains far off (one standing over where the star will come down),
  // their faces toward the moon pale.
  const far = new Bmp(PW, PH);
  const air = rgb('#28305c');
  mountains(far, { seed: seed % 997, base: 86, top: 44, peaks: 4, pal: ramp('#3a4678', 5, { spread: 0.34 }), snow: { y: 56, pal: [rgb('#5a6898'), rgb('#7a88b8'), rgb('#a4b0d8'), rgb('#c8d0ec')] }, air, airK: 0.28 });
  for (let x = land.x - 26; x < land.x + 26; x++) {
    const top = land.y - 9 + Math.abs(x - land.x) * 0.45;
    for (let y = Math.round(top); y < 88; y++) if (!far.alpha(x, y)) far.set(x, y, ramp('#3a4678', 5)[1]);
  }
  // The wooded hills behind the village: firs, their tips catching the
  // moon.
  const mid = new Bmp(PW, PH);
  const crest = (x) => 90 + Math.sin(x * 0.035 + 1) * 3 + Math.sin(x * 0.12) * 1.2;
  hills(mid, crest, 108, nightR('#2e4a48', 4, 0.42), { seed: 3 });
  const fir = ramp('#2a4a46', 5, { spread: 0.36 }).map((c) => moonlit(c, 0.38));
  const bark = [rgb('#1a1418'), rgb('#241c20'), rgb('#2e2428')];
  for (let x = -4; x < PW + 4; x += 3 + Math.floor(rng() * 3)) {
    if (Math.abs(x - 124) < 8) continue;
    pine(mid, x, Math.round(crest(x) + 3 + rng() * 4), 12 + rng() * 9, fir, bark, x * 3 + 1, { bare: false });
  }
  // The village: the ground, the lane up through it, the square, the
  // houses round it (their windows lit), a well, a fence.
  const vil = new Bmp(PW, PH);
  meadow(vil, 0, 100, PW, PH, nightR('#3e6a3a', 4, 0.5, 0.3), seed % 991, { tufts: 1.2, flowers: [] });
  const earth = nightR('#8a7454', 4, 0.42, 0.3);
  for (let y = 100; y < PH; y++) {
    const w = 4 + (y - 100) * 0.7;
    for (let x = Math.round(124 - w); x <= Math.round(124 + w); x++) {
      const edge = Math.abs(x - 124) > w - 1.2;
      if (edge && hash2(x, y, 6) < 0.5) continue;
      const rut = Math.abs(Math.abs(x - 124) - w * 0.45) < 0.7;
      vil.set(x, y, rut ? earth[0] : hash2(x, y, 7) < 0.15 ? earth[1] : earth[2]);
    }
  }
  for (let y = FIRE.y - SQUARE.ry; y <= FIRE.y + SQUARE.ry; y++) {
    for (let x = FIRE.x - SQUARE.rx; x <= FIRE.x + SQUARE.rx; x++) {
      const e = ((x - FIRE.x) / SQUARE.rx) ** 2 + ((y - FIRE.y) / SQUARE.ry) ** 2;
      if (e > 1 || (e > 0.85 && hash2(x, y, 8) < 0.5)) continue;
      vil.set(x, y, hash2(x, y, 9) < 0.12 ? earth[1] : earth[2]);
    }
  }
  const wall = nightR('#a8946e', 4, 0.48, 0.3);
  const roofs = ['#7a6438', '#6e5a32', '#806a3c'].map((h) => nightR(h, 4, 0.45, 0.32));
  const timber = nightR('#3a2a1c', 2, 0.4, 0.14);
  const homes = HOMES.slice();
  const wins = [];
  const chimneys = [];
  homes.sort((a, b) => a[1] - b[1]);
  for (const [x, yb, w, h, ri] of homes) {
    const out = house(vil, x, yb, w, h, { wall, roof: roofs[ri], timber, thatch: true, shape: 'steep', chimney: true, lit: 0.9, glow: '#ffc060', windows: w > 20 ? 3 : 1 });
    wins.push(...out.wins);
    if (out.chimney) chimneys.push(out.chimney);
  }
  // The well behind the square, lanterns either side of it, a fence.
  const stone = nightR('#8a8a90', 4, 0.45);
  const wood = nightR('#6a4a2a', 3, 0.4);
  const wx = 92;
  const wy = 112;
  for (let y = wy - 5; y < wy; y++) for (let x = wx; x < wx + 8; x++) vil.set(x, y, y === wy - 5 ? stone[3] : x < wx + 2 ? stone[2] : (x + y) % 3 ? stone[1] : stone[0]);
  for (let x = wx + 1; x < wx + 7; x++) vil.set(x, wy - 5, [14, 14, 22]);
  for (let y = wy - 12; y < wy - 4; y++) {
    vil.set(wx, y, wood[1]);
    vil.set(wx + 7, y, wood[0]);
  }
  for (let i = 0; i < 3; i++) for (let x = wx - 2 + i; x < wx + 10 - i; x++) vil.set(x, wy - 12 - i, i === 2 ? wood[2] : wood[1]);
  const lamps = [{ x: 86, y: 118 }, { x: 170, y: 118 }];
  for (const l of lamps) {
    for (let y = l.y - 9; y < l.y; y++) vil.set(l.x, y, wood[0]);
    vil.set(l.x + 1, l.y - 9, wood[0]);
    vil.set(l.x + 1, l.y - 8, [255, 214, 120]);
    vil.set(l.x + 1, l.y - 7, [255, 190, 90]);
  }
  for (let x = 236; x < PW; x++) {
    if (x % 5 === 0) for (let y = 128; y < 136; y++) vil.set(x, y, wood[0]);
    vil.set(x, 130, wood[1]);
    vil.set(x, 133, wood[0]);
  }
  // In front: the near dark (bushes, a tree's low boughs at each corner,
  // tall grass), framing it.
  const front = new Bmp(PW, PH);
  const dark = ramp('#1e3a2a', 5, { spread: 0.24 }).map((c) => moonlit(c, 0.35));
  broadTree(front, -10, PH + 12, 58, dark, bark, 4);
  pine(front, PW + 2, PH + 6, 62, dark, bark, 5);
  bush(front, 26, PH, 26, 12, dark, 6);
  bush(front, PW - 30, PH + 1, 24, 11, dark, 7);
  for (let x = 0; x < PW; x++) {
    if (hash2(x, 3, 3) > 0.35) continue;
    const h = 2 + Math.floor(hash2(x, 4, 3) * 5);
    for (let i = 0; i < h; i++) front.set(x, PH - 10 - i + (x % 3), dark[i === h - 1 ? 2 : 1]);
  }
  return {
    sky: skyB.canvas(), far: far.canvas(), mid: mid.canvas(), village: vil.canvas(), front: front.canvas(),
    wins, chimneys, lamps, dyn: new Bmp(PW, PH),
    flies: Array.from({ length: 14 }, () => ({ x: rng() * PW, y: 96 + rng() * 20, ph: rng() * 6 })),
  };
}

// The villagers round the fire: where each stands, what they wear, which
// of them point (the third is a child, who shouts).
export function villagers(rng) {
  const spots = [[100, 118], [111, 115], [145, 115], [156, 118], [96, 129], [118, 132], [139, 132], [162, 128], [128, 114]];
  return spots.map(([x, y], i) => ({
    x, y,
    shirt: ['#8f2f3a', '#2f6f8f', '#3a7a3a', '#7a5a2a', '#5a3a7a', '#c8a030', '#e0dccc'][Math.floor(rng.float(0, 7))],
    skin: ['#f4d0b0', '#d8a47c', '#b07a4a', '#8a5a34', '#e8b48c'][Math.floor(rng.float(0, 5))],
    hair: ['#1e1612', '#6e4424', '#c87a3a', '#c8c8c8', '#3a2418'][Math.floor(rng.float(0, 5))],
    small: i === 2 || rng.chance(0.2),
    points: i === 2 || rng.chance(0.35),
    look: rng.float(0, 0.8),
  }));
}

// ------------------------------------------------------------ each moment
// The layers in front of what's in the sky: the hills, the village, its
// people and its fire, the lights, the dust, the near dark. `s`: { t, pre,
// after, glow (the star's light, 0-1), star ({x, y}: where it is), folk,
// horizon }.
export function drawVillage(g, art, s) {
  const { t, pre, after, glow, star, folk, horizon } = s;
  g.drawImage(art.far, 0, 0);
  g.drawImage(art.mid, 0, 0);
  g.drawImage(art.village, 0, 0);
  // Fireflies along the edge of the woods (before it comes).
  if (pre) {
    for (const f of art.flies) {
      const a = Math.max(0, Math.sin(t * 1.3 + f.ph));
      if (a < 0.3) continue;
      g.globalAlpha = a * (1 - glow);
      g.fillStyle = '#d8f078';
      g.fillRect(Math.round(f.x + Math.sin(t * 0.7 + f.ph) * 3), Math.round(f.y + Math.cos(t * 0.5 + f.ph) * 2), 1, 1);
    }
    g.globalAlpha = 1;
  }
  // The people and the fire, back to front.
  const b = art.dyn;
  b.d.fill(0);
  const pen = (x, y, col) => col && b.set(x, y, rgb(col));
  const items = folk.map((f) => {
    const hitAt = (f.y - horizon) / 30;
    const down = !pre && after > hitAt;
    return { y: f.y, draw: () => person(pen, f, star, down, t, glow) };
  });
  items.push({ y: FIRE.y, draw: () => bonfire(b, t, !pre ? Math.max(0, 1 - after * 0.6) : 1) });
  items.sort((p, q) => p.y - q.y);
  for (const it of items) it.draw();
  const dc = art.dynC || (art.dynC = document.createElement('canvas'));
  dc.width = PW;
  dc.height = PH;
  dc.getContext('2d').putImageData(new ImageData(b.d, PW, PH), 0, 0);
  g.drawImage(dc, 0, 0);
  // The lights: the fire's (flickering, warm on the ground and on them),
  // the lanterns', the windows'.
  const fl = 0.85 + 0.15 * Math.sin(t * 11) * Math.sin(t * 7.3);
  const fireK = !pre ? Math.max(0, 1 - after * 0.6) : 1;
  g.save();
  g.globalCompositeOperation = 'lighter';
  const fg = g.createRadialGradient(FIRE.x, FIRE.y - 3, 1, FIRE.x, FIRE.y - 3, 44 * fl);
  fg.addColorStop(0, `rgba(255,170,80,${(0.42 * fireK).toFixed(3)})`);
  fg.addColorStop(0.5, `rgba(200,90,40,${(0.16 * fireK).toFixed(3)})`);
  fg.addColorStop(1, 'rgba(120,40,20,0)');
  g.fillStyle = fg;
  g.fillRect(FIRE.x - 50, FIRE.y - 50, 100, 80);
  for (const l of art.lamps) {
    const lg = g.createRadialGradient(l.x + 1, l.y - 8, 0, l.x + 1, l.y - 8, 12);
    lg.addColorStop(0, 'rgba(255,200,110,0.35)');
    lg.addColorStop(1, 'rgba(255,160,80,0)');
    g.fillStyle = lg;
    g.fillRect(l.x - 12, l.y - 20, 26, 26);
  }
  g.fillStyle = 'rgba(255,190,90,0.22)';
  for (const w of art.wins) g.fillRect(w.x - 1, w.y - 1, w.w + 2, w.h + 2);
  g.restore();
  // Smoke off the chimneys (and the fire), drifting.
  for (const c of [...art.chimneys, { x: FIRE.x, y: FIRE.y - 12, big: true }]) {
    for (let i = 0; i < 5; i++) {
      const k = (t * 0.35 + i / 5 + c.x * 0.01) % 1;
      g.globalAlpha = (c.big ? 0.35 : 0.28) * (1 - k);
      g.fillStyle = '#7a7a8a';
      const r = 1 + Math.round(k * (c.big ? 4 : 2));
      g.fillRect(Math.round(c.x + Math.sin(k * 4 + c.x) * 2 + k * 8), Math.round(c.y - k * (c.big ? 26 : 14)), r, r);
    }
  }
  g.globalAlpha = 1;
  // The star's light over all of it, from where it is.
  if (glow > 0.01) {
    const lg = g.createRadialGradient(star.x, star.y, 0, star.x, star.y, pre ? 230 : 300);
    lg.addColorStop(0, `rgba(255,236,190,${(glow * 0.75).toFixed(3)})`);
    lg.addColorStop(1, `rgba(200,190,255,${(glow * 0.18).toFixed(3)})`);
    g.save();
    g.globalCompositeOperation = 'lighter';
    g.fillStyle = lg;
    g.fillRect(0, 0, PW, PH);
    g.restore();
  }
  // The dust, rolling in from the hills through the village to you: a
  // bank of churning billows, lit along their tops by the blast behind
  // them, the air behind thick with it.
  if (!pre && after < 5) {
    const frontY = horizon + after * 30;
    const fade = Math.max(0, 1 - after / 5);
    // (The haze it leaves.)
    g.globalAlpha = 0.45 * fade;
    g.fillStyle = '#8a7058';
    g.fillRect(0, horizon - 8, PW, Math.max(0, frontY - horizon - 2));
    for (let x = -6; x < PW + 6; x += 5) {
      const n = Math.sin(x * 0.13 + after * 3) + Math.sin(x * 0.047 - after * 2);
      const r = 7 + n * 2.5 + (x % 3);
      const cy = frontY - r * 0.4 + Math.sin(x * 0.3 + after * 6) * 1.5;
      g.globalAlpha = 0.9 * fade;
      g.fillStyle = '#9a7e60';
      g.beginPath();
      g.ellipse(x, cy, r * 1.2, r * 0.8, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#c8a880';
      g.beginPath();
      g.ellipse(x - r * 0.2, cy - r * 0.35, r * 0.8, r * 0.45, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#f0d8b0';
      g.fillRect(Math.round(x - r * 0.5), Math.round(cy - r * 0.75), Math.round(r * 0.8), 1);
    }
    g.globalAlpha = 1;
  }
  // The near dark, shaken by the blast.
  const sh = !pre && after < 2 ? Math.round(Math.sin(after * 40) * 2 * (1 - after / 2)) : 0;
  g.drawImage(art.front, sh, 0);
}

// The bonfire: logs crossed, flames licking up (never twice the same),
// sparks going up off it.
function bonfire(b, t, k) {
  const { x, y } = FIRE;
  const logs = [[90, 58, 36], [120, 80, 50], [70, 44, 28]];
  for (let i = -5; i <= 5; i++) {
    b.set(x + i, y, logs[0]);
    b.set(x + i, y - 1, i % 2 ? logs[1] : logs[0]);
    b.set(x + i * 0.6, y - 2 - Math.abs(i) * 0.2, logs[2]);
  }
  for (const dx of [-6, 6]) for (let i = 0; i < 3; i++) b.set(x + dx, y - i + 1, [110, 110, 120]);
  if (k <= 0) return;
  const hgt = 10 * k;
  for (let dy = 0; dy < hgt; dy++) {
    const f = dy / hgt;
    const w = (1 - f) * 4.5 * k;
    for (let dx = -Math.ceil(w); dx <= Math.ceil(w); dx++) {
      const n = hash2(dx, dy, Math.floor(t * 12));
      if (Math.abs(dx) > w || (f > 0.5 && n < f * 0.7)) continue;
      const hot = 1 - f - Math.abs(dx) / (w + 1) * 0.6;
      b.set(x + dx + Math.round(Math.sin(t * 9 + dy) * f), y - 2 - dy, hot > 0.6 ? [255, 244, 180] : hot > 0.35 ? [255, 190, 70] : hot > 0.15 ? [240, 110, 40] : [180, 50, 30]);
    }
  }
  for (let i = 0; i < 4; i++) {
    const s = (t * 0.9 + i / 4) % 1;
    b.set(x + Math.sin(i * 2.3 + t * 2) * 4 * s, y - 10 - s * 18, s < 0.6 ? [255, 210, 120] : [220, 120, 60], 1 - s);
  }
}

// One of the villagers, seen from behind, looking up at the star (head
// turned toward it), some pointing; arms over their heads as it comes
// down on them; flat on the ground after the dust, thrown away from it.
// (Their feet on the ground they stand on, lit on the fire's side.)
function person(pen, f, star, down, t, glow) {
  const side = star.x > f.x ? 1 : -1;
  const turn = Math.abs(star.x - f.x) > 20 ? side : 0;
  const lit = glow > 0.25 ? side : f.x < FIRE.x ? 1 : -1;
  const pose = down ? 'down' : glow > 0.85 ? 'cower' : f.points ? 'point' : 'stand';
  drawPerson(pen, f.x, f.y + 1, {
    size: f.small ? 'small' : 'normal', face: 'back', pose, dir: down ? -side : side, turn, lit,
    shirt: f.shirt, skin: f.skin, hair: f.hair, t: t + f.look,
  });
}
