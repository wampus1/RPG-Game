// The Sleeper going up, painted (round 51; the scene, its timing and its
// words: see game/eruption.js). Seen two ways:
//   - from across the sea (`here` false): the volcano's island far off at
//     dusk, the sea between catching its glow, a beach in front with palms
//     and a few people standing watching;
//   - from on Kharos itself (`here` true): the mountain close and huge,
//     scorched ground and dead trees in front.
// Before it blows: the sky going red, its crater glowing and smoking, the
// ground trembling. Then: a column of fire out of the top, bombs of rock
// flung out on long arcs and trailing smoke, lava running down its sides
// in glowing channels, an ash cloud boiling up and spreading over the sky
// (lit red from under, lightning crawling in it), its glow on the sea, and
// later the ash falling.
import { VIEW_W, VIEW_H } from '../config.js';
import { Bmp, ramp, rgb, mixC, sky, ridged, palm, broadTree, meadow, hash2, fbm, rngOf } from './brush.js';
import { drawPerson } from './scenekit.js';

const PW = VIEW_W / 2;
const PH = VIEW_H / 2;

export function paintEruption(here) {
  const r = rngOf(here ? 77 : 41);
  const sea = here ? null : 100;
  const peak = { x: PW / 2, y: here ? 30 : 52 };
  const foot = here ? 150 : 98;
  const ground = here ? 132 : 100;
  // The sky at dusk (the glow comes later, laid over it), long streaks of
  // cloud lit from under.
  const skyB = new Bmp(PW, PH);
  sky(skyB, [[0, '#1a1430'], [30, '#3a1e40'], [60, '#7a2e3c'], [90, '#c8583a'], [110, '#e88a4a']]);
  for (let i = 0; i < 8; i++) {
    const y = Math.round(18 + r() * 60);
    const x0 = r() * PW;
    const len = 30 + r() * 70;
    for (let x = Math.round(x0); x < x0 + len; x++) {
      const e = Math.min(x - x0, x0 + len - x) / len;
      skyB.set(x, y, mixC('#ff9a6a', '#ffc070', y / 90), e < 0.1 ? 0.4 : 0.8);
      skyB.set(x, y - 1, rgb('#4a2440'), e < 0.1 ? 0.3 : 0.7);
    }
  }
  // The mountain: its slopes curving down from the crater's lip, ridges
  // running down them; dark, its upper ridges catching the glow.
  const mtn = new Bmp(PW, PH);
  const rock = ramp('#3a2a2a', 5, { spread: 0.3 });
  const glowR = [rgb('#5a2a20'), rgb('#8a3a24'), rgb('#c85a2a')];
  const halfW = (y) => {
    const k = (y - peak.y) / (ground - peak.y);
    return 9 + Math.pow(Math.max(0, k), 1.6) * (here ? 220 : 112);
  };
  for (let y = peak.y; y <= ground; y++) {
    const hw = halfW(y);
    for (let x = Math.floor(peak.x - hw); x <= Math.ceil(peak.x + hw); x++) {
      const dx = (x - peak.x) / hw;
      const edge = hash2(x, y, 3) < 0.3 && Math.abs(dx) > 0.96;
      if (edge) continue;
      // (Ridges: running down and out from the top.)
      const ang = Math.atan2(x - peak.x, (y - peak.y) + 6);
      const rr = ridged(ang * 6, (y - peak.y) * 0.05, 9);
      const g = rr * 1.1 - 0.55 - dx * 0.35;
      let c = g > 0.35 ? rock[3] : g > 0.05 ? rock[2] : g > -0.3 ? rock[1] : rock[0];
      // (High up, near the fire: lit red.)
      const hot = 1 - (y - peak.y) / 34;
      if (hot > 0 && g > -0.1) c = mixC(c, glowR[g > 0.3 ? 2 : g > 0.05 ? 1 : 0], hot * 0.8);
      mtn.set(x, y, c);
    }
  }
  // The crater's lip, notched; forest round its foot (and, from across
  // the sea, a town's lights on the shore).
  for (let x = peak.x - 9; x <= peak.x + 9; x++) mtn.set(x, peak.y, hash2(x, 1, 2) < 0.4 ? rock[0] : rock[2]);
  const wood = ramp('#2a3a2a', 4, { spread: 0.2 });
  for (let x = 0; x < PW; x++) {
    const hw = halfW(ground - 1);
    if (Math.abs(x - peak.x) > hw) continue;
    for (let y = ground - 12; y < ground; y++) {
      if (Math.abs(x - peak.x) > halfW(y) - 1) continue;
      const n = fbm(x * 0.2, y * 0.3, 4);
      if (n > 0.48 + (ground - y) * 0.02) mtn.set(x, y, n > 0.62 ? wood[2] : wood[1]);
    }
  }
  const lights = [];
  if (!here) for (let i = 0; i < 9; i++) lights.push({ x: Math.round(peak.x - 60 + r() * 120), y: ground - 1 - Math.floor(r() * 3) });
  // Front: from across the sea, a beach (sand, palms, the watchers); on
  // Kharos itself, ash and cinders, dead trees.
  const front = new Bmp(PW, PH);
  if (here) {
    meadow(front, 0, ground, PW, PH, ramp('#4a3e3a', 4, { spread: 0.24 }), 5, { tufts: 0.3 });
    const dead = [rgb('#1a1414'), rgb('#2a2020'), rgb('#3a2c28')];
    for (const [x, s] of [[16, 46], [236, 40], [60, 24]]) {
      const yb = PH + 2;
      for (let i = 0; i < s; i++) {
        front.set(x + Math.round(Math.sin(i * 0.2) * 1.5), yb - i, dead[1]);
        if (s > 30) front.set(x + 1 + Math.round(Math.sin(i * 0.2) * 1.5), yb - i, dead[0]);
        if (i > s * 0.4 && i % 6 === 0) for (let k = 1; k < 7; k++) front.set(x + (i % 12 ? k : -k), yb - i - Math.round(k * 0.6), dead[2]);
      }
    }
  } else {
    const sand = ramp('#8a6a4a', 4, { spread: 0.24 }).map((c) => mixC(c, [40, 20, 30], 0.35));
    for (let y = 116; y < PH; y++) for (let x = 0; x < PW; x++) {
      const yy = 117 + Math.sin(x * 0.03) * 2 + Math.abs(x - PW / 2) * 0.04;
      if (y < yy) continue;
      front.set(x, y, hash2(x, y, 6) < 0.1 ? sand[0] : y < yy + 1.5 ? sand[3] : sand[1]);
    }
    const leaf = ramp('#1a2a1a', 5, { spread: 0.2 });
    const bark = [rgb('#140e10'), rgb('#20181a'), rgb('#2a2024')];
    palm(front, 18, PH, 64, leaf, bark, 3);
    palm(front, 34, PH + 4, 46, leaf, bark, 5);
    palm(front, PW - 20, PH + 2, 58, leaf, bark, 7);
    broadTree(front, PW - 2, PH + 10, 44, leaf, bark, 9);
  }
  const watchers = here ? [] : [{ x: 98, y: 125, s: '#6a3a3a' }, { x: 107, y: 126, s: '#3a4a6a', small: true }, { x: 152, y: 124, s: '#5a5a3a' }];
  return {
    peak, foot, ground, sea, here,
    sky: skyB.canvas(), mountain: mtn.canvas(), front: front.canvas(), lights, watchers,
  };
}

// The sea under it all (from across it): rows of swell, darker toward you,
// the sky's colour and the fire's in it.
export function drawSea(g, art, t, glow) {
  const y0 = art.sea;
  for (let y = y0; y < PH; y++) {
    const d = (y - y0) / (PH - y0);
    g.fillStyle = `rgb(${Math.round(60 - d * 34 + glow * 40)},${Math.round(30 - d * 14 + glow * 10)},${Math.round(50 - d * 20)})`;
    g.fillRect(0, y, PW, 1);
    for (let x = 0; x < PW; x += 2) {
      const w = Math.sin(x * (0.12 - d * 0.06) + t * 1.1 + y * 1.3) + Math.sin(x * 0.05 - t * 0.6 + y * 0.4);
      // (The glow's path across the water, under the mountain: the swell
      // catching it; elsewhere the crests the sky's red, the troughs dark.)
      const near = Math.abs(x - art.peak.x) < 12 + d * 46;
      if (w > 1.15 - d * 0.35) {
        g.fillStyle = near ? (glow > 0.3 ? '#ffb868' : '#e08a5a') : '#9a5058';
        g.globalAlpha = near ? 0.55 + glow * 0.45 : 0.45;
        g.fillRect(x, y, 2 + (near ? 1 : 0), 1);
      } else if (w < -1.2) {
        g.fillStyle = '#100810';
        g.globalAlpha = 0.35;
        g.fillRect(x, y, 2, 1);
      }
      g.globalAlpha = 1;
    }
  }
}

// A watcher on the beach, from behind, the glow on them.
export function drawWatchers(g, art, t, after) {
  const pen = (x, y, col) => {
    g.fillStyle = col;
    g.fillRect(Math.round(x), Math.round(y), 1, 1);
  };
  for (const w of art.watchers) {
    drawPerson(pen, w.x, w.y, { size: w.small ? 'small' : 'normal', face: 'back', pose: after > 0 && !w.small ? 'point' : 'stand', dir: w.x < art.peak.x ? 1 : -1, shirt: w.s, hair: '#1a1210', skin: '#5a3a30', pants: '#1a1418', t, lit: 0 });
  }
}
