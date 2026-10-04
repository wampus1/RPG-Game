// The masters that aren't shaped like people, painted large (see
// bossbody.js, which draws them): side on and facing left, lit from the
// upper left with the painter's kit (see paint.js), in eight frames, each
// with parts of its own that move: the Urn-Mother's ash arms and her lid
// lifting, the Glass Wyrm's jaw, the Bellows Golem's bellows and smoke,
// the Molten Heart's beat, the Moth-Mother's wings and the eyes on them,
// the Clam's shell, the Hollow Oak's leaves in their season.
import { Paint, hash2 } from './paint.js';
import { hex, mix, shade } from './pixel.js';

const TAU = Math.PI * 2;
const sn = (t, k = 1, ph = 0) => Math.sin(t * TAU * k + ph);
const HOT = '#ff6a1a';
const CORE = '#ffe890';

// A glowing crack: a hot line, its corners white-hot.
function crack(P, pts, hot = HOT, core = CORE) {
  for (let i = 0; i + 1 < pts.length; i++) P.line(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], hot);
  for (let i = 1; i + 1 < pts.length; i++) P.set(pts[i][0], pts[i][1], hex(core));
}
// The grain of stone, glass, hide: specks a shade darker (or lighter).
function grain(P, seed, k = 0.12, f = 0.86, test) {
  P.over((x, y, c) => (hash2(x, y, seed) < k && (!test || test(x, y, c)) ? shade(c, f) : null));
}
// Paint over what's there (keeping its light) where `test` says.
function tint(P, test, col, k) {
  P.over((x, y, c) => (test(x, y, c) ? mix(c, hex(col), k) : null));
}
// A lit oval turned by `ang` (a wing, a leaf, a fin).
function oval(P, cx, cy, rx, ry, ang, col, o = {}) {
  const pts = [];
  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * TAU;
    const x = Math.cos(a) * rx;
    const y = Math.sin(a) * ry;
    pts.push([cx + x * Math.cos(ang) - y * Math.sin(ang), cy + x * Math.sin(ang) + y * Math.cos(ang)]);
  }
  P.poly(pts, col, o);
}
// A chain of links from a to b, sagging.
function chain(P, a, b, sag, col = '#6a6a74') {
  const n = Math.max(3, Math.round(Math.hypot(b.x - a.x, b.y - a.y) / 2.5));
  for (let i = 0; i <= n; i++) {
    const k = i / n;
    const x = a.x + (b.x - a.x) * k;
    const y = a.y + (b.y - a.y) * k + Math.sin(k * Math.PI) * sag;
    if (i % 2) P.blob(x, y, 1.4, 1, col, { flat: 0.5 });
    else P.blob(x, y, 0.9, 1.5, col, { flat: 0.5 });
  }
}

// ------------------------------------------------------------ Kharos
const BEASTS = {
  // A great burial urn, painted in bands, cracked and glowing; arms of
  // ash out of its sides, waving; a face painted on its belly; its lid
  // lifting on the smoke, and thrown back when she breathes in.
  urn_mother: {
    w: 60, h: 64, ax: 30, ay: 62,
    body(P, t, st) {
      const clay = '#b0603a';
      const lift = st.inhale ? 5 : Math.max(0, sn(t)) * 1.5;
      // Ash arms, behind her: out of her shoulders, up, waving, long
      // fingers spread (reaching higher as she rouses).
      for (const s of [-1, 1]) {
        const ph = s < 0 ? 0 : 2.4;
        const w = sn(t, 1, ph);
        const up = st.wind || st.inhale ? 6 : 0;
        const sh = [30 + s * 14, 30];
        const el = [30 + s * (24 + w), 26 - up * 0.5 + w * 1.5];
        const hd = [30 + s * (26 - w * 1.5), 13 - up + w * 2];
        P.limb([[sh[0], sh[1], 3.2], [el[0], el[1], 2.4], [hd[0], hd[1], 1.8]], '#7a7270');
        for (let i = 0; i < 4; i++) {
          const a = -Math.PI / 2 + s * (-0.5 + i * 0.4) + w * 0.15;
          P.tube(hd[0], hd[1], hd[0] + Math.cos(a) * 4.5, hd[1] + Math.sin(a) * 4.5, 0.8, 0.5, '#6a6260');
        }
        // (Embers in the ash.)
        P.set(el[0], el[1], hex(w > 0 ? '#ff8a30' : '#c84a1a'));
      }
      // The foot, the belly, the neck, the lip.
      P.poly([[20, 52], [40, 52], [42, 60], [18, 60]], shade(hex(clay), 0.85), { lv: 0.45 });
      P.blob(30, 38, 18, 17, clay);
      P.tube(30, 24, 30, 18, 8, 7, clay);
      P.blob(30, 17, 11, 3.2, shade(hex(clay), 0.9), { flat: 0.5 });
      P.blob(30, 17.5, 8, 1.6, '#1a0e0a', { amb: 0 });
      // The painted bands, round the curve of her.
      tint(P, (x, y) => y === 25 || y === 26 || y === 52 || y === 51, '#2a140e', 0.7);
      tint(P, (x, y) => y >= 28 && y <= 31 && (x + (y - 28) * 2) % 8 < 4 && Math.abs(x - 30) < 17, '#f0d090', 0.55);
      tint(P, (x, y) => y >= 46 && y <= 48 && (x % 4 < 2) && Math.abs(x - 30) < 15, '#2a140e', 0.5);
      // Her painted face: almond eyes, a mouth, glowing as she rouses.
      const hot = st.wind || st.inhale;
      for (const ex of [23, 36]) {
        P.poly([[ex - 4, 38], [ex, 35.5], [ex + 4, 38], [ex, 40.5]], '#e8d0a0', { lv: 0.7, contrast: 0.4 });
        P.blob(ex, 38, 1.5, 1.5, hot ? '#ffb040' : '#2a140e', { lift: hot ? 0.5 : 0 });
      }
      if (st.inhale) P.blob(30, 45, 3, 2.5, '#ffb040', { lift: 0.4 });
      else P.line(26, 45, 34, 45, '#2a140e');
      // Cracks, glowing.
      crack(P, [[41, 27], [43, 32], [41, 36], [44, 41]]);
      crack(P, [[17, 41], [19, 45], [17, 49]]);
      crack(P, [[28, 50], [30, 54], [29, 58]]);
      grain(P, 3, 0.1, 0.9);
      // The lid, riding the smoke.
      P.blob(30, 13 - lift, 10, 3, shade(hex(clay), 0.8), { flat: 0.7 });
      P.blob(30, 9.5 - lift, 2.6, 2, '#d8a050');
    },
    fx(P, t, st) {
      // Ash breathed out (or drawn in).
      for (let i = 0; i < 4; i++) {
        const k = (t + i / 4) % 1;
        if (st.inhale) P.puff(30 + Math.cos(i * 1.7) * (1 - k) * 22, 16 + Math.sin(i * 1.7) * (1 - k) * 10, 2, '#9a908a', 0.6 * k);
        else P.puff(30 + sn(k, 0.5, i) * 3, 13 - k * 12, 1.5 + k * 3, '#8a8280', 0.5 * (1 - k));
      }
      for (const [x, y] of [[43, 32], [19, 45]]) P.fx(x, y, CORE, 0.5 + 0.5 * sn(t, 2, x));
    },
  },

  // A serpent of black volcanic glass, up out of the sand in a curve,
  // crystal spines down its back; a jaw that drops wide as it strikes.
  glass_wyrm: {
    w: 70, h: 66, ax: 42, ay: 63,
    body(P, t, st) {
      const glass = '#3a3058';
      // The hole it's come up through: sand and rubble.
      P.blob(44, 60, 17, 4.5, '#5a4a3a', { flat: 0.3 });
      P.blob(44, 60, 11, 2.5, '#140e12', { amb: 0 });
      // Its body, from the hole round and up to the head.
      const pts = [];
      const path = [[46, 62, 7], [49, 52, 7], [47, 42, 6.8], [39, 34, 6.4], [29, 30, 5.8], [20, 27, 5.2], [13, 25, 4.6]];
      path.forEach(([x, y, r], i) => {
        const k = i / (path.length - 1);
        pts.push([x + sn(t, 1, i * 0.9) * 1.6 * k, y + sn(t, 1, i * 0.9 + 1.5) * 1.2 * k - (st.wind ? k * k * 6 : 0), r]);
      });
      // Spines down its back, behind it.
      for (let i = 1; i < pts.length - 1; i++) {
        const [x0, y0] = pts[i];
        const [x1, y1] = pts[i + 1];
        const nx = y1 - y0;
        const ny = -(x1 - x0);
        const n = Math.hypot(nx, ny) || 1;
        const a = Math.atan2(-Math.abs(ny / n) - 0.2, nx / n);
        P.spike(x0 - (nx / n) * 0, y0 - pts[i][2] + 1, a + (i % 2) * 0.2, 6 + (i % 2) * 2, 1.5, '#a8d8f0');
      }
      P.limb(pts, glass);
      // Belly scales: pale bands across its underside.
      for (let i = 0; i + 1 < pts.length; i++) {
        for (let k = 0.2; k < 1; k += 0.4) {
          const x = pts[i][0] + (pts[i + 1][0] - pts[i][0]) * k;
          const y = pts[i][1] + (pts[i + 1][1] - pts[i][1]) * k;
          P.line(x - 2, y + pts[i][2] - 2, x + 2, y + pts[i][2] - 1, '#6a5a8a');
        }
      }
      // Scales: a diamond lattice over the glass.
      P.over((x, y, c) => (c[2] > c[0] && c[2] < 140 && ((x + y * 2) % 7 === 0 || (x - y * 2 + 70) % 7 === 0) ? shade(c, 0.72) : null));
      // A streak of shine along it.
      for (let i = 0; i + 1 < pts.length; i++) P.line(pts[i][0] - 2, pts[i][1] - pts[i][2] + 2, pts[i + 1][0] - 2, pts[i + 1][1] - pts[i + 1][2] + 2, '#c8c0f0');
      // The head: a wedge, a jaw that drops.
      const [hx, hy] = pts[pts.length - 1];
      const open = st.wind ? 0.75 : 0.12 + Math.max(0, sn(t)) * 0.12;
      // (Its skull: a heavy brow, a long snout.)
      P.blob(hx + 3, hy - 1, 6, 5, glass);
      P.poly([[hx + 3, hy - 5], [hx - 13, hy - 1.5], [hx - 13, hy + 1.5], [hx + 5, hy + 3]], glass, { lv: 0.6 });
      const jx = hx - 12;
      const jy = hy + 2 + open * 10;
      P.poly([[hx + 4, hy + 2], [jx, jy], [jx + 1, jy + 2.5], [hx + 6, hy + 6]], shade(hex(glass), 0.8), { lv: 0.45 });
      // Its teeth, and the glow in its throat as it opens.
      for (let i = 0; i < 5; i++) {
        P.spike(hx - 12 + i * 3, hy + 1, Math.PI / 2, 2 + (i % 2), 0.7, '#e8f0ff');
        P.spike(jx + 2 + i * 3 * (1 - open * 0.15), jy - open * 2.5 + i * open * 0.6, -Math.PI / 2, 2, 0.7, '#e8f0ff');
      }
      if (open > 0.3) P.blob(hx + 1, hy + 4, 3, 2.5, '#ff4060', { lift: 0.5 });
      P.line(hx - 9, hy - 3, hx + 1, hy - 5, '#c8c0f0');
      for (const [a, l] of [[-2.7, 9], [-2.4, 7]]) P.spike(hx + 5, hy - 4, a, l, 1.4, '#a8d8f0');
      P.eye(hx - 2, hy - 2, st.wind ? '#ff6070' : '#ff3050', true);
      // Rubble at the lip of the hole, in front.
      for (const [x, r] of [[30, 2.2], [36, 1.6], [56, 2.4], [60, 1.5]]) P.blob(x, 60, r, r * 0.8, '#6a5a48');
    },
    fx(P, t) {
      // Sand running off it.
      for (let i = 0; i < 3; i++) {
        const k = (t + i / 3) % 1;
        P.fx(50 + i * 2, 46 + k * 14, '#c8a878', 0.8 * (1 - k));
      }
    },
  },

  // A great slug of cooling lava, its crust split in glowing seams that
  // pulse with its heart; eyes on stalks, swaying; a molten foot.
  magma_tender: {
    w: 66, h: 48, ax: 33, ay: 46,
    body(P, t, st) {
      const crust = '#4a3430';
      const swell = sn(t) * 0.8;
      // The molten foot under it.
      P.blob(35, 41, 25, 4, '#ff7a20', { lift: 0.35 });
      P.blob(35, 32, 25 + swell * 0.5, 11 + swell, crust);
      // Plates of crust over its back.
      for (const [x, y, r] of [[24, 25, 8], [36, 22, 9], [48, 26, 8], [56, 32, 5]]) P.blob(x, y + swell * 0.6, r, r * 0.7, shade(hex(crust), 1.1));
      grain(P, 11, 0.16, 0.82);
      // The seams between, glowing (brighter as the heat rises in it).
      const pulse = 0.5 + 0.5 * sn(t, 1);
      const hot = mix(hex(HOT), hex('#ffd060'), pulse * (st.wind ? 1 : 0.5));
      crack(P, [[16, 30], [22, 31], [30, 28], [34, 30], [42, 29], [47, 31], [54, 30]], hot);
      crack(P, [[20, 37], [27, 35], [33, 38], [40, 35], [48, 37], [56, 36]], hot);
      crack(P, [[30, 28], [29, 22]], hot);
      crack(P, [[42, 29], [43, 23]], hot);
      // The head, low at the front; eyes on stalks.
      P.blob(12, 34, 8, 7, crust);
      for (const [s, ph] of [[0, 0], [1, 1.6]]) {
        const bx = 10 + s * 5;
        const ex = bx - 4 + sn(t, 1, ph) * 2;
        const ey = 18 + s * 2 + sn(t, 1, ph + 1) * 1.5 - (st.wind ? 3 : 0);
        P.tube(bx, 30, ex, ey, 1.6, 1, shade(hex(crust), 1.15));
        P.blob(ex, ey, 2.4, 2.4, '#ffe070', { lift: 0.3 });
        P.set(ex - 1, ey, hex('#3a1408'));
      }
      P.line(5, 37, 10, 38, '#ffb040');
    },
    fx(P, t) {
      // Smoke off its back; a glow along its foot.
      for (let i = 0; i < 3; i++) {
        const k = (t + i / 3) % 1;
        P.puff(26 + i * 12, 20 - k * 16, 1.5 + k * 2.5, '#6a6060', 0.5 * (1 - k));
      }
      for (let x = 12; x < 60; x += 2) P.fx(x, 45, '#ff9a40', 0.25 + 0.15 * sn(t, 1, x * 0.3));
    },
  },

  // An iron boiler on legs: a furnace in its belly behind a grate, a
  // bellows on its side pumping, stacks smoking on its shoulders; red-hot
  // as the heat in it rises, and spouting steam as it vents.
  bellows_golem: {
    w: 62, h: 66, ax: 31, ay: 64,
    body(P, t, st) {
      const iron = '#545460';
      const pump = sn(t) * (st.vent ? 0 : 1);
      const heat = st.heat || 0;
      const wind = st.wind;
      // Legs.
      for (const [x, d] of [[23, -1], [39, 1]]) {
        P.tube(x, 46, x + d, 58, 4.4, 3.8, shade(hex(iron), 0.85));
        P.blob(x + d * 2, 61, 6, 2.6, '#3a3a44', { flat: 0.6 });
      }
      // The stacks.
      for (const [x, top] of [[19, 6], [43, 9]]) {
        P.tube(x, 26, x, top, 2.6, 2.4, '#3a3a44');
        P.blob(x, top, 3.6, 1.4, '#2a2a32', { flat: 0.4 });
      }
      // The far arm.
      P.tube(47, 26, 52, 38, 3.6, 3.2, iron);
      P.tube(52, 38, 50, 48, 3.2, 3, iron);
      P.blob(50, 50, 4.4, 4, '#3a3a44');
      // The boiler.
      P.blob(31, 34, 17, 16, iron);
      // Rivets, in rings round it.
      for (let a = 0; a < TAU; a += TAU / 16) {
        const x = 31 + Math.cos(a) * 13;
        const y = 34 + Math.sin(a) * 12;
        P.set(x, y, shade(hex(iron), 1.45));
        P.set(x + 1, y + 1, shade(hex(iron), 0.55));
      }
      P.line(14, 30, 48, 30, shade(hex(iron), 0.6));
      // The bellows on its side, pumping.
      const bw = 7 + pump * 1.5;
      P.poly([[14, 33], [14 - bw, 30], [14 - bw, 44], [14, 41]], '#6a4a30', { lv: 0.55 });
      for (let i = 1; i < 4; i++) P.line(14 - (bw * i) / 4, 31 + i * 0.2, 14 - (bw * i) / 4, 43 - i * 0.2, '#3a2418');
      P.tube(14 - bw, 37, 8 - bw * 0.3, 37, 1.2, 0.8, '#8a8a90');
      // The furnace grate, glowing as hot as it is.
      const fire = ['#c84a14', '#ff8a20', '#ffd060', '#fff0c0'][heat + (pump > 0.4 ? 1 : 0)];
      P.blob(31, 40, 7, 5, '#1a1214', { amb: 0 });
      P.blob(31, 41, 5.5, 3.5, fire, { lift: 0.3 });
      for (let x = 26; x <= 36; x += 2) P.line(x, 36, x, 45, '#2a2a32');
      // The little head, its eye-slit.
      P.blob(31, 17, 6, 4.5, iron, { clip: (x, y) => y < 19 });
      P.rect(28, 16, 7, 1, heat ? '#ffb040' : '#ff7030');
      // The near arm (a piston), raised to strike.
      const hand = wind ? [6, 14] : [9, 50];
      const elbow = wind ? [8, 26] : [7, 38];
      P.tube(15, 25, elbow[0], elbow[1], 3.8, 3.4, iron);
      P.tube(elbow[0], elbow[1], hand[0], hand[1], 3.4, 3, iron);
      P.line(elbow[0], elbow[1], hand[0], hand[1], '#a8a8b0');
      P.blob(hand[0], hand[1], 4.8, 4.4, '#3a3a44');
      grain(P, 21, 0.08, 0.85);
      // Red-hot plates as it nears its venting.
      if (heat) tint(P, (x, y, c) => (x - 31) ** 2 / 300 + (y - 34) ** 2 / 260 < 1 && Math.abs(c[0] - c[2]) < 30, heat > 1 ? '#ff4020' : '#c83a20', heat > 1 ? 0.4 : 0.2);
    },
    fx(P, t, st) {
      const vent = st.vent;
      for (const [x, top] of [[19, 6], [43, 9]]) {
        for (let i = 0; i < 3; i++) {
          const k = (t * (vent ? 2 : 1) + i / 3) % 1;
          P.puff(x + k * 4 * (x < 30 ? -1 : 1), top - 2 - k * (vent ? 6 : 5), 1.5 + k * 2.5, vent ? '#f0f0f0' : '#5a5458', (vent ? 0.75 : 0.5) * (1 - k));
        }
      }
      if (vent) for (let i = 0; i < 4; i++) P.puff(31 + (i - 1.5) * 4, 47 + ((t * 3 + i / 4) % 1) * 6, 2.5, '#ffffff', 0.5);
      P.puff(31, 41, 6, '#ff9a40', 0.18 + 0.08 * (st.heat || 0));
    },
  },

  // A heaving mass of fused glass, eyes in it, shards bristling out of it
  // and long crystals over it, light running through them.
  vitrified_horror: {
    w: 66, h: 56, ax: 33, ay: 54,
    body(P, t, st) {
      const glass = '#304a6a';
      const br = sn(t) * 0.8;
      // Shard legs.
      for (const [x, a] of [[16, 2.2], [24, 1.8], [42, 1.4], [50, 1]]) P.spike(x, 44, a, 10, 2, '#5a7090');
      // The crystals over it, behind.
      for (const [x, y, a, l] of [[18, 22, -2.2, 14], [28, 16, -1.75, 18], [40, 17, -1.35, 16], [50, 24, -0.9, 12]]) P.spike(x, y, a + sn(t, 1, x) * 0.05, l, 2, '#80b8e0');
      // The mass: lobes of glass, swelling and settling.
      for (const [x, y, rx, ry] of [[22, 36, 12, 10], [42, 36, 13, 10], [32, 30, 14, 11], [33, 42, 16, 7]]) P.blob(x, y + br * (x > 30 ? 1 : -1) * 0.5, rx + br * 0.4, ry + br * 0.3, glass);
      // Specular streaks: it's glass.
      for (const [x0, y0, x1, y1] of [[20, 28, 25, 25], [33, 22, 38, 21], [14, 36, 15, 32], [44, 30, 48, 29]]) P.line(x0, y0, x1, y1, '#d0f0ff');
      // Shards bristling out of it.
      for (let i = 0; i < 9; i++) {
        const a = Math.PI + 0.2 + (i / 8) * (Math.PI - 0.4);
        P.spike(32 + Math.cos(a) * 15, 34 + Math.sin(a) * 10, a, 4 + (i % 3) * 2, 1.2, '#a8d8f0');
      }
      // Eyes in it, blinking each in its own time.
      const eyes = [[20, 33], [27, 27], [36, 31], [43, 36], [30, 39], [24, 41]];
      eyes.forEach(([x, y], i) => {
        const shut = (t * 8 + i * 3) % 8 < 1;
        if (shut) P.line(x - 1, y, x + 1, y, '#1a2a3a');
        else {
          P.blob(x, y, 1.8, 1.6, '#e8f0f0', { lift: 0.3 });
          P.set(x - (st.wind ? 1 : 0), y, hex(st.wind ? '#ff3040' : '#1a1a2a'));
        }
      });
    },
    fx(P, t) {
      // Light running up its crystals.
      for (const [x, y, a, l] of [[18, 22, -2.2, 14], [28, 16, -1.75, 18], [40, 17, -1.35, 16], [50, 24, -0.9, 12]]) {
        const k = (t + x * 0.03) % 1;
        P.fx(x + Math.cos(a) * l * k, y + Math.sin(a) * l * k, '#ffffff', 0.9 * Math.sin(k * Math.PI));
      }
    },
  },

  // A drake, red and scarred, chained by the neck to a stake: wings half
  // spread and beating, a tail swinging, fire in its jaws as it rears.
  chained_drake: {
    w: 78, h: 64, ax: 40, ay: 62,
    body(P, t, st) {
      const hide = '#9a3420';
      const belly = '#d8985a';
      const flap = sn(t);
      const rear = st.wind ? 1 : 0;
      // The far wing.
      const wingTip = [54 + flap * 2, 6 + flap * 5];
      P.poly([[44, 30], [wingTip[0], wingTip[1]], [62, 18 + flap * 3], [60, 30]], '#5a1a14', { lv: 0.35 });
      // Far legs.
      P.limb([[34, 44, 3.2], [33, 52, 2.4], [31, 59, 2]], shade(hex(hide), 0.7));
      P.limb([[54, 44, 3.8], [57, 51, 2.6], [55, 59, 2]], shade(hex(hide), 0.7));
      // The tail, swinging.
      const tail = [];
      for (let i = 0; i <= 6; i++) {
        const k = i / 6;
        tail.push([58 + k * 16, 40 + k * 8 + sn(t, 1, k * 3) * k * 3, 5 - k * 4]);
      }
      P.limb(tail, hide);
      const tip = tail[tail.length - 1];
      P.spike(tip[0], tip[1], 0.5 + sn(t, 1, 3) * 0.3, 5, 2.2, '#5a1a14');
      // The body.
      P.blob(46, 39, 15, 10, hide);
      P.blob(44, 45, 11, 4, belly, { clip: (x, y) => y > 42 });
      for (let x = 36; x < 54; x += 3) P.line(x, 44, x + 1, 48, shade(hex(belly), 0.7));
      // Spines down its back.
      for (let i = 0; i < 6; i++) P.spike(36 + i * 4, 30 + Math.abs(i - 2) * 0.6, -Math.PI / 2 - 0.4, 3 + (i % 2), 1.1, '#3a0e0a');
      // Near legs.
      P.limb([[40, 44, 3.6], [38, 52, 2.6], [37, 59, 2.2]], hide);
      P.limb([[52, 44, 4.2], [50, 52, 2.8], [52, 59, 2.2]], hide);
      for (const fx of [37, 52]) for (let i = 0; i < 3; i++) P.spike(fx - 1 + i * 1.2, 60, Math.PI - 0.3 - i * 0.2, 2, 0.6, '#e8e0c8');
      // The neck, up and forward (rearing as it draws breath).
      const head = [14 + rear * 2, 22 - rear * 6 + sn(t, 1, 1) * 1];
      P.limb([[36, 36, 6], [26, 30 - rear * 3, 4.8], [head[0] + 4, head[1] + 2, 4]], hide);
      for (let i = 0; i < 4; i++) P.line(28 - i * 3, 33 - rear * 3 - i * 2, 30 - i * 3, 37 - rear * 3 - i * 2, shade(hex(belly), 0.8));
      // The head: brow, horns, snout, jaw.
      const [hx, hy] = head;
      P.blob(hx + 2, hy, 5.5, 4.2, hide);
      P.poly([[hx - 1, hy - 2], [hx - 10, hy + 1], [hx - 10, hy + 3], [hx, hy + 3]], hide, { lv: 0.55 });
      const open = rear ? 4 : 1 + Math.max(0, sn(t)) * 0.8;
      P.poly([[hx, hy + 3], [hx - 9, hy + 3 + open], [hx - 8, hy + 5 + open], [hx + 2, hy + 6]], shade(hex(hide), 0.8), { lv: 0.45 });
      if (rear) P.blob(hx - 4, hy + 4, 3, 1.6, '#ffd060', { lift: 0.5 });
      for (const [a, l] of [[-2.7, 9], [-2.3, 7]]) P.spike(hx + 5, hy - 2, a + Math.PI, l, 1.3, '#e8dcc0');
      P.eye(hx - 1, hy - 1, '#ffd040');
      P.set(hx - 9, hy + 1, hex('#3a0a08'));
      // Its collar, and the chain from it to the stake.
      P.blob(30, 32 - rear * 3, 3.5, 4.5, '#5a5a64', { flat: 0.4 });
      P.tube(8, 52, 8, 61, 1.8, 1.8, '#5a4a3a');
      chain(P, { x: 29, y: 35 - rear * 3 }, { x: 9, y: 52 }, rear ? 1 : 5 + flap);
      // The near wing, over all.
      const nTip = [36 + flap * 3, 2 + flap * 6];
      P.poly([[42, 30], [nTip[0], nTip[1]], [50 + flap, 12 + flap * 4], [58, 22 + flap * 2], [56, 32]], '#7a2418', { lv: 0.45, grad: [-0.3, -1] });
      for (const [x, y] of [[nTip[0], nTip[1]], [50 + flap, 12 + flap * 4], [58, 22 + flap * 2]]) P.line(42, 30, x, y, '#3a0e0a');
      P.spike(nTip[0], nTip[1], -2, 3, 0.8, '#e8dcc0');
      grain(P, 31, 0.08, 0.85);
    },
    fx(P, t, st) {
      // Smoke from its nostrils; fire as it rears.
      const k = (t * 2) % 1;
      P.puff(4 - k * 4, 22 - k * 4 - (st.wind ? 6 : 0), 1 + k * 2, st.wind ? '#ff9030' : '#7a7070', 0.6 * (1 - k));
    },
  },

  // A hulk of slag, knuckles to the floor: rock crusted on rock, molten
  // seams, a core of fire in its chest beating; iron flecks drawn to it
  // when its lodestone wakes.
  slag_titan: {
    w: 66, h: 66, ax: 33, ay: 64,
    body(P, t, st) {
      const rock = '#4e403c';
      const br = sn(t) * 0.8;
      const wind = st.wind;
      // Legs: stumps.
      for (const x of [24, 40]) {
        P.tube(x, 44, x, 58, 6, 5.5, shade(hex(rock), 0.85));
        P.blob(x, 60, 7, 3, shade(hex(rock), 0.75), { flat: 0.6 });
      }
      // The far arm.
      P.limb([[50, 22, 6], [56, 36, 5.5], [55, 50, 5]], shade(hex(rock), 0.8));
      P.blob(55, 53, 7, 6, shade(hex(rock), 0.8));
      // The trunk, the boulder shoulders.
      P.blob(33, 32 + br * 0.3, 18, 15 + br * 0.4, rock);
      P.blob(14, 20, 9, 8, rock);
      P.blob(50, 20, 9, 8, rock);
      // The head, sunk between them.
      P.blob(30, 13, 7, 6, shade(hex(rock), 1.05));
      P.rect(25, 13, 4, 1, '#ffb040');
      P.rect(31, 13, 4, 1, '#ffb040');
      grain(P, 41, 0.2, 0.8);
      // Seams and the core.
      const pulse = 0.5 + 0.5 * sn(t, 1);
      crack(P, [[20, 24], [24, 30], [22, 36], [26, 42]]);
      crack(P, [[44, 26], [40, 32], [44, 38]]);
      crack(P, [[10, 18], [14, 22], [12, 26]]);
      P.blob(33, 31, 5 + pulse, 5 + pulse, wind ? '#ffe070' : '#ff8a20', { lift: 0.3 + pulse * 0.3 });
      P.blob(33, 31, 2, 2, '#fff8d0', { lift: 0.6 });
      // The near arm: down to its knuckles, or up to smash.
      const fist = wind ? [10, 6] : [9, 54];
      const elbow = wind ? [6, 20] : [5, 38];
      P.limb([[15, 24, 6.4], [elbow[0], elbow[1], 5.6], [fist[0], fist[1], 5.4]], rock);
      P.blob(fist[0], fist[1], 7.5, 6.5, shade(hex(rock), 1.05));
      crack(P, [[elbow[0] + 2, elbow[1] - 4], [elbow[0], elbow[1]], [elbow[0] + 2, elbow[1] + 4]]);
      grain(P, 43, 0.12, 0.85, (x, y) => y > 30);
    },
    fx(P, t, st) {
      P.puff(33, 31, 9, '#ff8a20', 0.2 + 0.1 * sn(t));
      if (!st.wind) return;
      // Its lodestone wakes: iron flecks drawn into it.
      for (let i = 0; i < 6; i++) {
        const k = (t * 2 + i / 6) % 1;
        const a = (i / 6) * TAU;
        P.fx(33 + Math.cos(a) * (1 - k) * 28, 31 + Math.sin(a) * (1 - k) * 22, '#c8d8ff', 0.9 * k);
      }
    },
  },

  // A heart of rock and fire, hung in the air by its veins: it beats
  // (twice, and rests), the veins in it flaring with each beat.
  molten_heart: {
    w: 62, h: 64, ax: 31, ay: 62,
    body(P, t, st) {
      const crust = '#3e2622';
      // Two beats and a rest.
      const ph = t % 1;
      const beat = Math.max(0, 1 - Math.abs(ph - 0.05) * 10) + 0.6 * Math.max(0, 1 - Math.abs(ph - 0.25) * 10);
      const k = 1 + beat * 0.08;
      const cy = 26;
      // Its veins down to the floor, holding it.
      for (const [x0, x1, ph2] of [[22, 12, 0], [28, 24, 1], [36, 40, 2], [42, 52, 3]]) {
        const pts = [];
        for (let i = 0; i <= 5; i++) {
          const q = i / 5;
          pts.push([x0 + (x1 - x0) * q + sn(t, 1, ph2 + q * 3) * 1.5 * q, cy + 10 + q * (60 - cy - 10), 2.6 - q * 1.2]);
        }
        P.limb(pts, '#5a2a22');
        P.blob(x1, 61, 3.5, 1.4, '#3a1a16', { flat: 0.4 });
      }
      // The heart: two lobes and its point.
      P.blob(24, cy - 2, 11 * k, 10 * k, crust);
      P.blob(38, cy - 1, 12 * k, 11 * k, crust);
      P.poly([[14, cy + 2], [49, cy + 2], [31, cy + 22 * k]], crust, { lv: 0.4 });
      // Its vessels, up from the top.
      P.limb([[28, cy - 9, 3.6], [26, cy - 16, 3.2], [20, cy - 19, 2.8]], '#5a2a22');
      P.limb([[38, cy - 10, 4], [40, cy - 18, 3.4], [46, cy - 20, 3]], '#5a2a22');
      P.blob(20, cy - 19, 2.4, 2, '#ff8a20', { lift: 0.4 });
      P.blob(46, cy - 20, 2.6, 2, '#ff8a20', { lift: 0.4 });
      grain(P, 51, 0.16, 0.82);
      // Veins of fire in it, flaring with each beat.
      const hot = beat > 0.4 ? '#ffd060' : HOT;
      const core = beat > 0.4 ? '#ffffff' : CORE;
      crack(P, [[20, cy - 6], [24, cy - 1], [30, cy + 1], [34, cy + 7], [31, cy + 14]], hot, core);
      crack(P, [[40, cy - 7], [37, cy - 1], [41, cy + 4], [38, cy + 10]], hot, core);
      crack(P, [[16, cy + 2], [22, cy + 5], [26, cy + 10]], hot, core);
      crack(P, [[46, cy], [43, cy + 6], [44, cy + 11]], hot, core);
      if (st.wind) P.blob(31, cy + 2, 4, 4, '#fff0a0', { lift: 0.5 });
    },
    fx(P, t) {
      const ph = t % 1;
      const beat = Math.max(0, 1 - Math.abs(ph - 0.05) * 10);
      P.puff(31, 26, 18, '#ff6020', 0.12 + beat * 0.2);
      // A drip of fire off its point.
      const k = (t * 2) % 1;
      P.fx(31, 48 + k * 12, '#ffb040', 1 - k);
    },
  },
};

// ------------------------------------------------------------ Myrrow
Object.assign(BEASTS, {
  // A moth as big as a cart, hung in the air on wings of dusk-violet,
  // an eye on each; they open, and glow, as she fixes you with them.
  moth_mother: {
    w: 80, h: 64, ax: 40, ay: 62,
    body(P, t, st) {
      const flap = sn(t);
      const bob = Math.round(sn(t, 1, 1) * 1.5);
      const cx = 40;
      const cy = 28 + bob;
      const wing = '#6a4a8a';
      // Wings: the hind pair, then the fore, each side; raised and lowered.
      for (const s of [-1, 1]) {
        const up = flap * 6;
        oval(P, cx + s * 14, cy + 11 - up * 0.2, 12, 8, s * 0.5, shade(hex(wing), 0.85), { lv: 0.45, grad: [-s * 0.6, -0.8] });
        oval(P, cx + s * 20, cy - 7 - up * 0.75, 17, 11, s * -0.3 - up * s * 0.02, wing, { lv: 0.55, grad: [-s * 0.6, -0.8] });
        // Veins, and a pale band near the edge.
        for (const [x, y] of [[22, -17], [34, -12], [33, 0], [20, 16]]) P.line(cx + s * 4, cy - 1, cx + s * x, cy + y - up * (y < 0 ? 0.9 : 0.4), shade(hex(wing), 0.6));
        for (let a = -2.2; a < 0.6; a += 0.08) P.set(cx + s * (20 + Math.cos(a) * 14), cy - 7 - up * 0.75 + Math.sin(a) * 8.5, hex('#b898d8'));
        // The eye on the wing: a ring, an iris, a pupil (and its glow).
        const ex = cx + s * 22;
        const ey = cy - 6 - up * 0.75;
        const open = st.eyes;
        P.blob(ex, ey, 5, 4.5, '#2a1a3a', { amb: 0.4 });
        P.blob(ex, ey, 3.6, 3.2, open ? '#ffd060' : '#8a6a3a', { lift: open ? 0.3 : 0 });
        if (open) {
          P.blob(ex, ey, 1.8, 2.4, '#1a0a20', { amb: 0 });
          P.glint(ex - 1, ey - 1, '#ffffff');
        } else {
          // (Shut: a lid of wing over it, lashes along its seam.)
          P.blob(ex, ey, 3.6, 3.2, shade(hex(wing), 0.8), { amb: 0.4 });
          P.line(ex - 3, ey, ex + 3, ey, '#2a1a3a');
          for (const dx of [-2, 0, 2]) P.set(ex + dx, ey + 1, hex('#2a1a3a'));
        }
      }
      // Legs, dangling.
      for (let i = 0; i < 3; i++) P.limb([[cx - 2 + i * 2, cy + 6, 0.9], [cx - 5 + i * 3, cy + 12, 0.7], [cx - 4 + i * 3 + sn(t, 1, i) * 1, cy + 17, 0.6]], '#3a2a2a');
      // The body: a furred thorax, a banded abdomen.
      P.limb([[cx, cy + 4, 4.5], [cx + 1, cy + 12, 4], [cx + 2, cy + 19, 2.4]], '#c8b088');
      for (let y = cy + 7; y < cy + 19; y += 3) P.line(cx - 3, y, cx + 4, y + 1, '#8a7050');
      P.blob(cx, cy - 1, 6, 5.5, '#e0d0b0');
      grain(P, 61, 0.25, 0.85, (x, y, c) => c[0] > 150 && c[1] > 130);
      // The head: great dark eyes, plumed feelers.
      P.blob(cx, cy - 8, 4.5, 4, '#d8c8a8');
      for (const s of [-1, 1]) {
        P.blob(cx + s * 3, cy - 8, 2, 2.4, '#2a1a2a', { lift: 0.1 });
        P.glint(cx + s * 3 - 1, cy - 9, '#a8a0c8');
        const pts = [];
        for (let i = 0; i <= 5; i++) {
          const k = i / 5;
          pts.push([cx + s * (2 + k * 9), cy - 11 - k * 12 + k * k * 4 + sn(t, 1, s) * k, 0.7]);
        }
        P.limb(pts, '#c8b088');
        for (let i = 1; i < 6; i++) {
          const [x, y] = pts[i];
          P.line(x, y, x + s * 2, y - 1, '#a89068');
          P.line(x, y, x - s * 0, y - 2, '#a89068');
        }
      }
    },
    fx(P, t, st) {
      // Dust off her wings, drifting down.
      for (let i = 0; i < 6; i++) {
        const k = (t + i / 6) % 1;
        P.fx(14 + i * 10 + sn(k, 1, i) * 2, 20 + k * 40, st.eyes ? '#ffe0a0' : '#d8c8f0', 0.8 * (1 - k));
      }
      if (st.eyes) for (const s of [-1, 1]) P.puff(40 + s * 22, 22 - sn(t) * 4.5, 6, '#ffd060', 0.25);
    },
  },

  // A colossus of fungus: a great spotted cap over a pale stalk of a
  // body, gills under it shedding spores, arms of root, a skirt of roots
  // for legs; its cap claps down as it coughs.
  spore_colossus: {
    w: 70, h: 68, ax: 35, ay: 66,
    body(P, t, st) {
      const stalk = '#d8ccb4';
      const cough = st.wind ? 1 : 0;
      const sq = cough ? 3 : sn(t) * 0.8;
      // Root legs, a skirt of them.
      for (let i = 0; i < 7; i++) {
        const x = 20 + i * 5;
        P.limb([[x + (i - 3) * 0.5, 50, 2.6], [x + (i - 3) * 1.6, 58, 1.8], [x + (i - 3) * 2.4 + sn(t, 1, i) * 0.8, 64, 1]], i % 2 ? '#a8987a' : '#c8b898');
      }
      // The far arm.
      P.limb([[46, 36, 3], [52, 44, 2.6], [54, 52, 2]], '#b8a888');
      // The stalk-body.
      P.poly([[26, 24], [44, 24], [47, 52], [23, 52]], stalk, { lv: 0.55, grad: [-1, -0.2] });
      P.blob(35, 44, 12, 9, stalk, { flat: 0.5 });
      // Its ring (the veil a mushroom has), torn.
      P.blob(35, 30, 11, 2.6, '#e8e0cc', { flat: 0.4 });
      for (let x = 26; x < 45; x += 3) P.set(x, 33, hex('#a89878'));
      // A face in it: hollows for eyes, a mouth that gapes as it coughs.
      for (const ex of [30, 39]) P.blob(ex, 38, 2, 2.4, '#3a2a1a', { amb: 0.1 });
      P.set(30, 38, hex('#c8f070'));
      P.set(39, 38, hex('#c8f070'));
      P.blob(35, 45, 3, cough ? 3 : 1.4, '#2a1a10', { amb: 0 });
      grain(P, 71, 0.14, 0.88, (x, y) => y > 24);
      // The near arm.
      P.limb([[24, 36, 3.2], [16, 42 - cough * 4, 2.6], [12, 50 - cough * 10, 2]], '#c8b898');
      for (let i = 0; i < 3; i++) P.tube(12, 50 - cough * 10, 9 + i * 2, 55 - cough * 10, 0.8, 0.5, '#a8987a');
      // Gills under the cap.
      P.blob(35, 22 + sq * 0.5, 22, 4, '#c8a890', { flat: 0.3 });
      for (let x = 15; x < 56; x += 2) P.line(x, 20 + sq * 0.5, 35 + (x - 35) * 0.6, 24 + sq * 0.5, '#8a6a5a');
      // The cap: red, spotted white.
      P.blob(35, 15 + sq, 24, 11 - sq * 0.6, '#c83a2a', { clip: (x, y) => y < 21 + sq * 0.5 });
      for (const [x, y, r] of [[24, 10, 2.4], [34, 7, 2.8], [46, 10, 2.2], [17, 16, 1.8], [52, 16, 1.6], [40, 14, 1.4], [29, 15, 1.5]]) P.blob(x, y + sq, r, r * 0.8, '#f0e8dc', { flat: 0.4 });
    },
    fx(P, t, st) {
      // Spores, drifting from the gills (a cloud of them as it coughs).
      const n = st.wind ? 10 : 5;
      for (let i = 0; i < n; i++) {
        const k = (t + i / n) % 1;
        const x = 18 + ((i * 37) % 36) + sn(k, 1, i) * 3;
        P.fx(x, 24 + k * (st.wind ? 30 : 20), i % 2 ? '#e0f0a0' : '#c8e070', 0.9 * (1 - k));
        if (st.wind && i % 3 === 0) P.puff(x, 26 + k * 18, 2 + k * 3, '#c8d890', 0.4 * (1 - k));
      }
    },
  },

  // A lamprey grown huge, up out of the black water: a long grey-green
  // body, gills in a row, a round mouth all rings of teeth; under the
  // water, only its back-fin and the rings it makes.
  lamprey_queen: {
    w: 68, h: 66, ax: 34, ay: 64,
    body(P, t, st) {
      const hide = '#4a6a64';
      if (st.under) {
        // Only its fin, cutting the water, and the rings round it.
        P.poly([[26, 60], [36, 50 + sn(t) * 1.5], [44, 60]], shade(hex(hide), 0.9), { lv: 0.5 });
        P.blob(35, 61, 16, 2.4, '#1a2a30', { flat: 0.2, amb: 0.3 });
        return;
      }
      const rear = st.wind ? 1 : 0;
      // Water round its base.
      P.blob(38, 61, 18, 3, '#1a2a30', { flat: 0.2, amb: 0.3 });
      const pts = [];
      const path = [[42, 62, 6.5], [46, 52, 6.5], [44, 42, 6.2], [36, 34, 5.8], [27, 28, 5.6], [19, 22, 5.4]];
      path.forEach(([x, y, r], i) => {
        const k = i / (path.length - 1);
        pts.push([x + sn(t, 1, i * 0.8) * 2 * k - rear * k * 3, y + sn(t, 1, i * 0.8 + 1.4) * 1.2 * k - rear * k * k * 6, r]);
      });
      // A fin along its back.
      for (let i = 1; i < pts.length - 1; i++) P.spike(pts[i][0] + 2, pts[i][1] - pts[i][2] + 1, -Math.PI / 2 + 0.5, 4, 2.4, '#3a5450');
      P.limb(pts, hide);
      // Its pale belly, along the inside of the curve.
      for (let i = 0; i + 1 < pts.length; i++) P.line(pts[i][0] - pts[i][2] + 2, pts[i][1] + 2, pts[i + 1][0] - pts[i + 1][2] + 2, pts[i + 1][1] + 2, '#a8c0a8');
      // Slime-shine.
      for (let i = 0; i + 1 < pts.length; i++) P.line(pts[i][0] + 1, pts[i][1] - pts[i][2] + 2, pts[i + 1][0] + 1, pts[i + 1][1] - pts[i + 1][2] + 2, '#a8e0d0');
      grain(P, 81, 0.1, 0.8);
      // Gill-holes down its neck.
      const [hx, hy] = pts[pts.length - 1];
      for (let i = 0; i < 6; i++) P.set(hx + 7 + i * 2, hy + 2 + i * 1.3, hex('#1a2a28'));
      // The head, and its mouth: a disc, rings of teeth, gaping.
      P.blob(hx, hy, 6, 5.5, hide);
      const mr = rear ? 5.5 : 4.2 + Math.max(0, sn(t)) * 0.5;
      P.blob(hx - 5, hy + 1, 2.4, mr, '#c86a6a', { flat: 0.4 });
      P.blob(hx - 5, hy + 1, 1.6, mr - 1.4, '#3a0a10', { amb: 0 });
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU;
        P.set(hx - 5 + Math.cos(a) * 1.6, hy + 1 + Math.sin(a) * (mr - 1), hex('#f0e8d0'));
      }
      P.eye(hx + 1, hy - 3, '#e0ff90');
    },
    fx(P, t, st) {
      // Rings spreading on the water.
      const k = (t * 1.5) % 1;
      for (let a = 0; a < TAU; a += 0.25) P.fx(36 + Math.cos(a) * (10 + k * 12), 61 + Math.sin(a) * (1.5 + k * 2), '#a8d0e0', 0.5 * (1 - k));
      if (st.under) return;
      const d = (t * 2) % 1;
      P.fx(14, 26 + d * 30, '#a8e0d0', 1 - d);
    },
  },

  // A bloated sac of marsh-gas, floating, veined, pocked with blisters,
  // swelling and settling, its little face pinched in the middle of it,
  // feelers trailing; gas leaking from it.
  gas_bloat: {
    w: 64, h: 64, ax: 32, ay: 62,
    body(P, t, st) {
      const skin = '#7a9a48';
      const sw = (st.wind ? 2.5 : 0) + sn(t) * 1.4;
      const cy = 26 + Math.round(sn(t, 1, 1) * 1.5);
      // Feelers trailing below.
      for (let i = 0; i < 6; i++) {
        const x0 = 20 + i * 5;
        const pts = [];
        for (let j = 0; j <= 5; j++) {
          const k = j / 5;
          pts.push([x0 + sn(t, 1, i + k * 3) * 3 * k, cy + 14 + k * (20 + (i % 3) * 4), 1.6 - k]);
        }
        P.limb(pts, '#5a7a3a');
      }
      // The sac, in lumps.
      P.blob(32, cy, 19 + sw, 17 + sw * 0.8, skin);
      P.blob(20, cy + 6, 8 + sw * 0.3, 7, skin);
      P.blob(45, cy - 6, 8 + sw * 0.3, 7, skin);
      // Veins over it.
      for (const pts of [[[18, 14], [24, 18], [26, 26], [22, 34]], [[40, 12], [38, 20], [44, 28]], [[30, 40], [34, 34], [42, 36]]]) for (let i = 0; i + 1 < pts.length; i++) P.line(pts[i][0], pts[i][1] + cy - 26, pts[i + 1][0], pts[i + 1][1] + cy - 26, '#4a6a2a');
      // Blisters.
      for (const [x, y, r] of [[14, 22, 2.2], [46, 30, 2.6], [28, 12, 1.8], [38, 40, 2], [50, 18, 1.6]]) P.blob(x, y + cy - 26, r, r, '#c8d870', { lift: 0.1 });
      grain(P, 91, 0.12, 0.85);
      // The face: little eyes, a puckered mouth.
      P.eye(28, cy - 1, '#e8ff70');
      P.eye(36, cy - 1, '#e8ff70');
      P.blob(32, cy + 5, 2, st.wind ? 2.5 : 1.4, '#2a3a14', { amb: 0 });
    },
    fx(P, t, st) {
      for (let i = 0; i < 4; i++) {
        const k = (t + i / 4) % 1;
        P.puff(14 + i * 12 + sn(k, 1, i) * 2, 20 - k * 18, 2 + k * 3, '#b8d870', (st.wind ? 0.5 : 0.35) * (1 - k));
      }
    },
  },

  // Three drowned singers grown into one, up to their waists in black
  // water: hair streaming, eyes pale, mouths open; and when they sing,
  // their mouths glow and the notes rise.
  drowned_choir: {
    w: 70, h: 64, ax: 35, ay: 62,
    body(P, t, st) {
      const flesh = '#8aa0a8';
      const song = st.song || st.wind;
      P.blob(35, 58, 26, 4, '#141e24', { flat: 0.2, amb: 0.2 });
      // Three of them: left, right, and the tallest between.
      for (const [x, top, ph, robe] of [[19, 22, 0, '#2a4050'], [51, 20, 2, '#2a3a4a'], [35, 10, 4, '#1e3442']]) {
        const sway = sn(t, 1, ph) * 1.2;
        const hx = x + sway;
        const hy = top + 5;
        // Hair behind, long and wet, streaming.
        P.poly([[hx - 5, hy - 3], [hx + 5, hy - 3], [hx + 6 + sway, hy + 16], [hx - 6 + sway, hy + 16]], '#1a2a2a', { lv: 0.3 });
        // The body, robed in weed-rotted cloth, sunk in the water.
        P.poly([[hx - 7, hy + 7], [hx + 7, hy + 7], [x + 10, 58], [x - 10, 58]], robe, { lv: 0.45 });
        P.blob(hx, hy + 11, 7.5, 5, robe, { flat: 0.5 });
        // Arms, clasped across.
        P.tube(hx - 6, hy + 9, hx - 1, hy + 16, 2, 1.6, flesh);
        P.tube(hx + 6, hy + 9, hx + 1, hy + 16, 2, 1.6, flesh);
        // The head.
        P.blob(hx, hy, 4.6, 5.4, flesh);
        P.blob(hx, hy - 3, 5, 3, '#1a2a2a', { clip: (xx, yy) => yy < hy - 2 });
        P.rect(hx - 3, hy - 0, 2, 1, '#e0f8ff');
        P.rect(hx + 1, hy - 0, 2, 1, '#e0f8ff');
        // The mouth, open: a dark O (glowing as they sing).
        const o = song ? 2 : 1.2 + Math.max(0, sn(t, 2, ph)) * 0.6;
        P.blob(hx, hy + 3, 1.2, o, song ? '#a0e8ff' : '#0e1418', { amb: song ? 0.8 : 0 });
        // Weed hanging on them.
        P.line(hx - 4, hy + 8, hx - 5 + sway, hy + 20, '#3a6a3a');
      }
      grain(P, 101, 0.1, 0.85);
    },
    fx(P, t, st) {
      // Water dripping; and notes rising when they sing.
      for (const x of [16, 35, 53]) {
        const k = (t * 2 + x * 0.1) % 1;
        P.fx(x - 4, 30 + k * 26, '#a0d0e0', 0.8 * (1 - k));
      }
      if (!(st.song || st.wind)) return;
      for (let i = 0; i < 3; i++) {
        const k = (t + i / 3) % 1;
        const x = [19, 35, 51][i] + sn(k, 1, i) * 3;
        const y = [30, 18, 28][i] - k * 18;
        P.fx(x, y, '#c8f8ff', 1 - k);
        P.fx(x, y - 1, '#c8f8ff', 1 - k);
        P.fx(x + 1, y - 2, '#c8f8ff', 1 - k);
        P.fx(x - 1, y + 1, '#c8f8ff', 1 - k);
      }
    },
  },

  // A kraken off a smugglers' wreck: a great red mantle, one eye (the
  // other under a patch), arms curling and uncurling round a sea-chest
  // spilling gold, ink running from it.
  smugglers_kraken: {
    w: 72, h: 64, ax: 36, ay: 62,
    body(P, t, st) {
      const flesh = '#a8405a';
      const wind = st.wind ? 1 : 0;
      P.blob(36, 59, 26, 4, '#142030', { flat: 0.2, amb: 0.2 });
      // Its sea-chest, under it, spilling.
      P.poly([[40, 50], [56, 50], [56, 58], [40, 58]], '#6a4a2a', { lv: 0.5 });
      P.rect(40, 53, 16, 1, '#c8a040');
      for (const [x, y] of [[43, 49], [47, 48], [51, 49], [45, 47]]) P.blob(x, y, 1.4, 1, '#ffd050', { lift: 0.2 });
      // Arms: curling out from under the mantle, waving.
      // (Each from under the mantle, out along the floor and curling up at
      // its tip; raised to lash as it strikes.)
      const arms = [[28, -1, 0.5, 0], [24, -1, 1.1, 1.3], [32, -1, 0.15, 2.6], [40, 1, 0.15, 3.4], [44, 1, 0.5, 4.4], [48, 1, 1.0, 5.6]];
      arms.forEach(([bx, s, spread, ph], i) => {
        const pts = [[bx, 38, 3.4]];
        let a = s < 0 ? Math.PI / 2 + 0.4 + spread : Math.PI / 2 - 0.4 - spread;
        let [x, y] = [bx, 38];
        const curl = (0.32 + sn(t, 1, ph) * 0.12 + wind * 0.15) * -s;
        for (let j = 1; j <= 8; j++) {
          x += Math.cos(a) * 3;
          y += Math.sin(a) * 2.2;
          a += j > 3 ? curl : -curl * 0.3;
          pts.push([x, y, 3.2 - j * 0.33]);
        }
        P.limb(pts, i % 2 ? flesh : shade(hex(flesh), 0.85));
        for (let j = 2; j < 8; j += 2) P.set(pts[j][0], pts[j][1] + pts[j][2] - 0.5, hex('#f0c8d0'));
      });
      // The mantle.
      P.blob(36, 26, 15, 17, flesh);
      P.blob(36, 14, 10, 8, flesh);
      for (const [x, y] of [[30, 12], [40, 18], [28, 26], [44, 30], [34, 32]]) P.blob(x, y, 1.6, 1.4, '#c86a80', { lift: 0.1 });
      grain(P, 111, 0.12, 0.85);
      // The eye, and the patch.
      P.blob(30, 32, 4, 3.5, '#f0e0c0');
      P.rect(28, 32, 5, 1, '#1a0a10');
      P.glint(29, 31);
      P.blob(42, 32, 3.6, 3.2, '#1a1418');
      P.line(39, 30, 50, 22, '#1a1418');
      P.line(39, 34, 24, 38, '#1a1418');
    },
    fx(P, t) {
      // Ink, running from it into the water.
      for (let i = 0; i < 3; i++) {
        const k = (t + i / 3) % 1;
        P.puff(26 + i * 10, 44 + k * 14, 1.5 + k * 2.5, '#140a20', 0.6 * (1 - k * 0.6));
      }
      if (Math.floor(t * 8) % 4 === 0) P.fx(47, 47, '#ffffff', 1);
    },
  },

  // A sea-turtle as old as the reef: a domed shell grown over with coral
  // and weed and barnacles, a beaked head swaying, flippers rowing.
  tide_mother: {
    w: 80, h: 52, ax: 40, ay: 50,
    body(P, t, st) {
      const skin = '#6a8a6a';
      const shell = '#4a6a4a';
      const row = sn(t);
      // The far flippers.
      P.limb([[30, 38, 3], [22 + row * 2, 44, 3.4], [16 + row * 3, 47, 2]], shade(hex(skin), 0.75));
      P.limb([[56, 38, 2.6], [62, 44, 2.6], [66, 46, 1.4]], shade(hex(skin), 0.75));
      // The shell: a dome, its plates, its rim.
      P.blob(42, 32, 24, 14, shell, { clip: (x, y) => y < 40 });
      P.blob(42, 40, 25, 3, '#8a9a6a', { flat: 0.4 });
      // Plates.
      for (const [x, y] of [[32, 26], [42, 23], [52, 26], [27, 34], [37, 32], [47, 32], [57, 34]]) {
        P.p.line(x - 4, y, x - 2, y - 3, hex('#2a4030'));
        P.p.line(x - 2, y - 3, x + 2, y - 3, hex('#2a4030'));
        P.p.line(x + 2, y - 3, x + 4, y, hex('#2a4030'));
        P.p.line(x + 4, y, x + 2, y + 3, hex('#2a4030'));
        P.p.line(x + 2, y + 3, x - 2, y + 3, hex('#2a4030'));
        P.p.line(x - 2, y + 3, x - 4, y, hex('#2a4030'));
      }
      // Coral and weed and barnacles grown on it.
      for (const [x, h, c] of [[36, 9, '#f08a70'], [46, 12, '#e86a8a'], [52, 7, '#f0a040']]) {
        P.tube(x, 22, x, 22 - h, 1.2, 0.8, c);
        P.tube(x, 22 - h * 0.5, x - 3, 22 - h * 0.8, 0.8, 0.6, c);
        P.tube(x, 22 - h * 0.6, x + 3, 22 - h, 0.8, 0.6, c);
      }
      for (const [x, y] of [[28, 28], [56, 29], [60, 34], [24, 35], [44, 28]]) P.blob(x, y, 1.6, 1.3, '#d8d0c0', { lift: 0.1 });
      for (let i = 0; i < 3; i++) P.line(30 + i * 12, 20 + i, 28 + i * 12 + sn(t, 1, i) * 2, 12 + i, '#3a7a4a');
      grain(P, 121, 0.12, 0.85);
      // The near flippers, rowing.
      P.limb([[64, 40, 3], [70, 44 - row, 2.8], [76, 45 - row * 1.5, 1.4]], skin);
      P.limb([[28, 40, 3.6], [20, 46 + row * 1.5, 4], [11, 48 + row * 2, 2]], skin);
      // The head on its neck, swaying; a beak; an old eye.
      const hx = 10 + sn(t, 0.5) * 1.5;
      const hy = 30 + sn(t, 0.5, 1) * 1;
      P.tube(22, 34, hx + 4, hy + 1, 4.4, 4, skin);
      P.blob(hx, hy, 6, 5, skin);
      P.poly([[hx - 4, hy], [hx - 8, hy + 2], [hx - 4, hy + 4]], '#c8b070', { lv: 0.6 });
      P.line(hx - 7, hy + 2, hx - 2, hy + 2, '#3a3020');
      P.eye(hx - 1, hy - 2, st.wind ? '#80fff0' : '#c8e8a0');
      for (const [x, y] of [[hx + 2, hy + 3], [hx + 4, hy - 1], [18, 32]]) P.set(x, y, hex('#4a6a4a'));
    },
    fx(P, t) {
      for (let i = 0; i < 3; i++) {
        const k = (t + i / 3) % 1;
        P.fx(30 + i * 10, 20 - k * 16, '#c8f0ff', 0.8 * (1 - k));
      }
    },
  },

  // A clam the size of a boat: two ridged shells, closed, breathing
  // bubbles out of the lip; prised open, a tongue of blue flesh and a
  // pearl glowing in it.
  abyssal_clam: {
    w: 70, h: 54, ax: 35, ay: 52,
    body(P, t, st) {
      const shell = '#a8a0b0';
      const open = st.open || st.variant === 1;
      const gap = open ? 0 : Math.max(0, sn(t)) * 1;
      // The lower shell.
      P.blob(35, 42, 28, 9, shell, { clip: (x, y) => y >= 38 });
      for (let i = -6; i <= 6; i++) P.line(35 + i * 4, 40, 35 + i * 4.6, 50 - Math.abs(i) * 0.6, shade(hex(shell), 0.7));
      if (open) {
        // Prised open: the upper shell thrown back, the flesh in it, the
        // pearl.
        P.blob(35, 18, 27, 13, shade(hex(shell), 0.9), { clip: (x, y) => y <= 22 });
        for (let i = -6; i <= 6; i++) P.line(35 + i * 4.4, 21, 35 + i * 3.6, 7 + Math.abs(i) * 0.8, shade(hex(shell), 0.62));
        P.blob(35, 36, 24, 6, '#3a6a8a');
        P.blob(35, 32, 22, 9, '#5a8aa8', { clip: (x, y) => y > 25 });
        for (let x = 14; x < 57; x += 3) P.set(x, 30 + Math.round(sn(t, 1, x * 0.3)), hex('#a8d8f0'));
        P.blob(35, 33, 5, 5, '#f0f0ff', { lift: 0.3 });
        P.glint(33, 31);
      } else {
        // Shut: the upper shell over it, its wavy lip, the dark gap.
        P.blob(35, 38, 28, 13, shell, { clip: (x, y) => y < 39 - gap });
        for (let i = -6; i <= 6; i++) P.line(35 + i * 4.6, 26 + Math.abs(i) * 0.8, 35 + i * 4, 38 - gap, shade(hex(shell), 0.7));
        for (let x = 8; x < 63; x++) P.set(x, 38 - gap + Math.round(sn(x / 40, 3)), hex('#2a1a2a'));
      }
      // Barnacles and weed on it.
      for (const [x, y] of [[20, 44], [48, 46], [52, open ? 12 : 30], [16, open ? 14 : 32]]) P.blob(x, y, 1.6, 1.3, '#e0d8c8', { lift: 0.1 });
      grain(P, 131, 0.1, 0.86);
      // The shimmer of nacre along the ridges.
      tint(P, (x, y, c) => c[2] > 140 && hash2(x, y, 5) < 0.12, '#e8d0ff', 0.4);
    },
    fx(P, t, st) {
      if (st.open || st.variant === 1) {
        P.puff(35, 33, 9, '#e0f0ff', 0.3 + 0.1 * sn(t, 2));
        return;
      }
      for (let i = 0; i < 3; i++) {
        const k = (t + i / 3) % 1;
        P.fx(20 + i * 14 + sn(k, 1, i), 36 - k * 22, '#c8f0ff', 0.9 * (1 - k));
      }
    },
  },

  // A giant built of the reef: rock and coral, branches of it on its
  // shoulders like horns, anemones waving, eyes glowing in a crevice; a
  // shoal of little fish round it.
  coral_colossus: {
    w: 70, h: 68, ax: 35, ay: 66,
    body(P, t, st) {
      const rock = '#7a6a70';
      const wind = st.wind;
      for (const x of [26, 44]) {
        P.tube(x, 46, x, 60, 5.5, 5, shade(hex(rock), 0.85));
        P.blob(x, 62, 6.5, 2.6, shade(hex(rock), 0.75), { flat: 0.6 });
      }
      // The far arm.
      P.limb([[52, 24, 5], [57, 38, 4.6], [55, 50, 4.2]], shade(hex(rock), 0.8));
      P.blob(55, 52, 5.5, 5, shade(hex(rock), 0.8));
      // The trunk.
      P.blob(35, 34, 17, 15, rock);
      P.blob(35, 18, 9, 8, rock);
      // Coral on its shoulders and head, branching.
      for (const [x, y, h, c, s] of [[22, 20, 12, '#f07a6a', -1], [48, 20, 13, '#f0a040', 1], [32, 11, 9, '#e86aa8', -1], [40, 11, 8, '#70d8c8', 1]]) {
        P.tube(x, y, x + s * 3, y - h, 1.6, 1, c);
        P.tube(x + s * 1.5, y - h * 0.5, x + s * 7, y - h * 0.8, 1, 0.7, c);
        P.tube(x + s * 2.5, y - h * 0.8, x - s * 1, y - h * 1.2, 0.9, 0.6, c);
      }
      grain(P, 141, 0.2, 0.82, (x, y, c) => Math.abs(c[0] - c[2]) < 20);
      // Anemones on it, their tentacles waving.
      for (const [x, y] of [[26, 30], [44, 38], [36, 44]]) {
        P.blob(x, y, 2.6, 1.6, '#a83a6a');
        for (let i = 0; i < 5; i++) {
          const a = -Math.PI / 2 + (i - 2) * 0.4 + sn(t, 1, x + i) * 0.25;
          P.line(x, y - 1, x + Math.cos(a) * 3.5, y - 1 + Math.sin(a) * 3.5, '#f0a0c8');
        }
      }
      // Eyes in a crevice.
      P.rect(31, 18, 9, 3, '#1a1418');
      P.eye(33, 19, '#70fff0');
      P.eye(37, 19, '#70fff0');
      // The near arm.
      const fist = wind ? [10, 10] : [12, 52];
      const elbow = wind ? [8, 24] : [8, 38];
      P.limb([[19, 26, 5.4], [elbow[0], elbow[1], 4.8], [fist[0], fist[1], 4.4]], rock);
      P.blob(fist[0], fist[1], 6, 5.5, rock);
      P.tube(elbow[0], elbow[1], elbow[0] - 5, elbow[1] - 6, 1.1, 0.7, '#f07a6a');
    },
    fx(P, t) {
      // A little shoal, circling it.
      for (let i = 0; i < 5; i++) {
        const a = t * TAU + (i / 5) * 0.9;
        const x = 35 + Math.cos(a) * 26;
        const y = 30 + Math.sin(a) * 8 + i;
        P.fx(x, y, '#ffe070', 0.9);
        P.fx(x + Math.sin(a) * 1.5, y, '#f0a030', 0.7);
      }
    },
  },
});

// ------------------------------------------------------------ the grove, and Thessa's deep
// The Hollow Oak's leaves, by season: spring, summer, autumn, winter.
const LEAVES = [['#7ac050', '#f0a0c0'], ['#3a8a2a', null], ['#d8782a', '#c8401a'], [null, null]];
Object.assign(BEASTS, {
  // A stag as tall as a house, grey with age: antlers like a dead tree,
  // hung with moss; eyes green; head down to charge.
  elder_stag: {
    w: 80, h: 72, ax: 42, ay: 70,
    body(P, t, st) {
      const hide = '#8a6a4a';
      const low = st.wind ? 1 : 0;
      const br = sn(t) * 0.6;
      // Far legs.
      P.limb([[30, 44, 3], [28, 54, 2], [29, 63, 1.6], [28, 68, 1.4]], shade(hex(hide), 0.7));
      P.limb([[56, 44, 3.6], [59, 54, 2.2], [57, 63, 1.6], [58, 68, 1.4]], shade(hex(hide), 0.7));
      // The body, the rump, the tail flicking.
      P.blob(46, 38 + br * 0.3, 16, 10, hide);
      P.blob(58, 37, 8, 9, hide);
      P.blob(64, 32 + Math.max(0, sn(t, 2)) * -1, 2, 2.5, '#e8e0d0');
      P.blob(44, 45, 12, 3.5, '#c8b498', { clip: (x, y) => y > 43 });
      // Moss hanging along its back.
      for (let i = 0; i < 6; i++) P.line(36 + i * 4, 29 + Math.abs(i - 3) * 0.4, 36 + i * 4 + sn(t, 1, i), 33 + (i % 3) * 2, '#5a8a3a');
      // Near legs.
      P.limb([[36, 44, 3.4], [34, 54, 2.2], [35, 63, 1.7], [34, 68, 1.5]], hide);
      P.limb([[60, 44, 4], [62, 54, 2.4], [60, 63, 1.7], [61, 68, 1.5]], hide);
      for (const x of [28, 34, 58, 61]) P.blob(x, 69, 2, 1.2, '#2a2220', { flat: 0.4 });
      // The neck and head (lowered to charge).
      const hx = 18 - low * 2;
      const hy = 22 + low * 12 + sn(t, 1, 1) * 0.6;
      P.limb([[38, 34, 7], [28, 28 + low * 6, 5.5], [hx + 5, hy + 1, 4.5]], hide);
      P.blob(30, 34 + low * 4, 5, 4, '#c8b498', { clip: (x, y) => y > 32 + low * 4 });
      P.blob(hx + 3, hy, 5, 4.4, hide);
      P.poly([[hx + 1, hy - 2], [hx - 9, hy + 2], [hx - 8, hy + 5], [hx + 2, hy + 4]], hide, { lv: 0.55 });
      P.blob(hx - 8, hy + 3, 1.6, 1.4, '#2a1e1a');
      // An ear, flicking.
      P.spike(hx + 6, hy - 2, -0.6 - Math.max(0, sn(t, 1, 2)) * 0.6, 5, 1.3, hide);
      P.eye(hx, hy - 1, st.wind ? '#c8ff80' : '#80e870');
      // The antlers: a branching crown, moss and vines on them.
      const tine = (x, y, a, len, d) => {
        const x1 = x + Math.cos(a) * len;
        const y1 = y + Math.sin(a) * len;
        P.tube(x, y, x1, y1, 1.6 - d * 0.35, 1.2 - d * 0.35, '#d8ccb0');
        if (d < 3) {
          tine(x1, y1, a - 0.45, len * 0.72, d + 1);
          tine(x1, y1, a + 0.4, len * 0.62, d + 1);
        }
        return [x1, y1];
      };
      const base = low ? -2.4 : -1.9;
      const a1 = tine(hx + 4, hy - 3, base, 9, 0);
      tine(hx + 5, hy - 3, base + 0.5, 8, 1);
      // (Moss and a vine, hanging from them.)
      P.line(a1[0], a1[1], a1[0] + sn(t, 1) * 1.5, a1[1] + 9, '#5a8a3a');
      P.line(hx + 8, hy - 8, hx + 8 + sn(t, 1, 1), hy + 2, '#4a7a2a');
      P.blob(a1[0] + 1, a1[1] + 1, 2, 1.4, '#6a9a4a');
      grain(P, 151, 0.12, 0.86, (x, y, c) => c[0] > c[2]);
    },
    fx(P, t, st) {
      // Breath in the cold air; little lights (spirits of the grove) round
      // its antlers.
      const k = (t * 2) % 1;
      P.puff(8 - k * 6 - (st.wind ? 2 : 0), 26 + (st.wind ? 12 : 0) - k * 2, 1 + k * 2, '#e0f0f0', 0.5 * (1 - k));
      for (let i = 0; i < 3; i++) {
        const a = t * TAU + i * 2.1;
        P.fx(22 + Math.cos(a) * 10, 6 + (st.wind ? 10 : 0) + Math.sin(a) * 4, '#d0ff90', 0.8);
      }
    },
  },

  // An oak that walks, hollowed by age: a face in its trunk, branches for
  // arms, roots for feet, and its leaves as the season it's in (spring
  // blossom, summer green, autumn fire, winter bare and snowed on).
  hollow_oak: {
    w: 76, h: 78, ax: 38, ay: 76,
    body(P, t, st) {
      const bark = '#5a4430';
      const season = st.season ?? 1;
      const [leaf, bloom] = LEAVES[season];
      const sw = sn(t) * 1.5;
      const wind = st.wind;
      // Roots for feet.
      for (const [x, s] of [[28, -1], [34, -0.4], [44, 0.4], [50, 1]]) P.limb([[x, 60, 3.4], [x + s * 5, 68, 2.4], [x + s * 9, 74, 1.4]], shade(hex(bark), 0.8));
      // The trunk.
      P.poly([[26, 30], [50, 30], [53, 64], [23, 64]], bark, { lv: 0.5, grad: [-1, -0.2] });
      P.blob(38, 56, 15, 9, bark, { flat: 0.4 });
      // Its bark: furrows running down it.
      for (let x = 26; x < 52; x += 3) P.line(x, 32, x + Math.round(sn(x / 10, 1)) , 62, shade(hex(bark), 0.65));
      grain(P, 161, 0.18, 0.8, (x, y) => y > 28);
      // The face: hollows for eyes, a gaping hollow for a mouth, light in
      // them.
      for (const ex of [32, 44]) P.blob(ex, 40, 3, 3.6, '#140c08', { amb: 0 });
      P.eye(32, 40, '#c8ff70');
      P.eye(44, 40, '#c8ff70');
      P.blob(38, 51, 5, wind ? 5 : 3.5, '#140c08', { amb: 0 });
      // Branches for arms: the far one, the near one (raised to strike).
      P.limb([[50, 34, 4], [60, 30 + sw, 3], [68, 24 + sw * 1.5, 2], [72, 18 + sw * 2, 1.2]], shade(hex(bark), 0.85));
      const nh = wind ? [6, 12] : [6, 44];
      P.limb([[26, 34, 4.2], [16, wind ? 24 : 36 - sw, 3.2], [nh[0], nh[1] - sw, 2]], bark);
      for (const [a, b] of [[[16, wind ? 24 : 36 - sw], [10, wind ? 20 : 30]], [[nh[0], nh[1] - sw], [2, nh[1] - sw + 3]], [[nh[0], nh[1] - sw], [4, nh[1] - sw - 4]]]) P.tube(a[0], a[1], b[0], b[1], 1.2, 0.6, bark);
      // Its crown of boughs.
      for (const [x0, y0, x1, y1] of [[32, 30, 22, 14], [38, 30, 38, 8], [44, 30, 56, 14], [38, 20, 28, 6], [38, 20, 50, 6]]) P.tube(x0, y0, x1 + sw * 0.5, y1, 2.4, 1.2, bark);
      // And the leaves on them, as the season is.
      if (leaf) {
        for (const [x, y, r] of [[22, 14, 9], [38, 8, 10], [54, 14, 9], [30, 4, 7], [47, 5, 7], [38, 18, 8], [14, 22, 6], [62, 22, 6]]) P.blob(x + sw * 0.6, y, r, r * 0.8, leaf);
        // (Clumps of leaf: darker hollows in the canopy.)
        P.over((x, y, c) => (y < 30 && hash2(x >> 1, y >> 1, 9 + season) < 0.2 && c[1] > c[2] ? shade(c, 0.78) : null));
        if (bloom) for (const [x, y] of [[18, 10], [34, 2], [44, 10], [56, 16], [28, 16], [40, 4], [62, 20], [12, 20]]) P.blob(x + sw * 0.6, y, 1.4, 1.2, bloom, { lift: 0.2 });
      } else {
        // Winter: bare twigs, snow along the tops of the boughs.
        for (const [x, y, a] of [[22, 14, -2], [38, 8, -1.6], [56, 14, -1.1], [28, 6, -2.2], [50, 6, -0.9]]) {
          P.tube(x, y, x + Math.cos(a) * 6, y + Math.sin(a) * 6, 0.8, 0.5, bark);
          P.tube(x, y, x + Math.cos(a + 0.7) * 5, y + Math.sin(a + 0.7) * 5, 0.7, 0.4, bark);
        }
        P.over((x, y, c) => (y < 32 && c[0] > 40 && c[0] < 120 && c[0] > c[2] && !P.get(x, y - 1)[3] ? hex('#f0f8ff') : null));
      }
    },
    fx(P, t, st) {
      const season = st.season ?? 1;
      for (let i = 0; i < 4; i++) {
        const k = (t + i / 4) % 1;
        const x = 12 + i * 16 + sn(k, 1, i) * 4;
        const y = 12 + k * 60;
        if (season === 2) P.fx(x, y, i % 2 ? '#d8782a' : '#c8401a', 1 - k * 0.5);
        else if (season === 3) P.fx(x, y * 0.9, '#ffffff', 0.9 * (1 - k));
        else if (season === 0) P.fx(x, y * 0.8, '#f8c8e0', 0.8 * (1 - k));
      }
    },
  },

  // The Worm: up out of the floor, banded, bristled, its maw a ring of
  // teeth opening at the top of it as it rears.
  worm: {
    w: 54, h: 70, ax: 27, ay: 68,
    body(P, t, st) {
      const flesh = '#b08a68';
      const rear = st.wind ? 1 : 0;
      P.blob(27, 65, 17, 4, '#5a4a3a', { flat: 0.3 });
      P.blob(27, 65, 10, 2.2, '#1a120e', { amb: 0 });
      const pts = [];
      for (let i = 0; i <= 6; i++) {
        const k = i / 6;
        pts.push([27 + sn(t, 1, k * 3) * 3 * k - rear * k * 3, 66 - k * (46 + rear * 6), 9 - k * 1.5]);
      }
      P.limb(pts, flesh);
      // Its bands, and bristles at each.
      for (let i = 0; i < 12; i++) {
        const k = i / 12;
        const j = Math.min(5, Math.floor(k * 6));
        const q = k * 6 - j;
        const x = pts[j][0] + (pts[j + 1][0] - pts[j][0]) * q;
        const y = pts[j][1] + (pts[j + 1][1] - pts[j][1]) * q;
        const r = pts[j][2];
        for (let dx = -r; dx <= r; dx++) P.set(x + dx, y + Math.round((dx * dx) / (r * 3)), shade(hex(flesh), 0.62));
        if (i % 2) {
          P.set(x - r - 1, y, hex('#3a2a20'));
          P.set(x + r + 1, y, hex('#3a2a20'));
        }
      }
      grain(P, 171, 0.12, 0.86);
      // The maw: a ring of flesh, teeth all round it, a dark throat.
      const [mx, my] = pts[pts.length - 1];
      const open = rear ? 1 : 0.55 + Math.max(0, sn(t)) * 0.2;
      P.blob(mx, my, 8.5, 4 + open * 2, '#c86a5a', { flat: 0.4 });
      P.blob(mx, my + 0.5, 6 * open + 1, 2.5 * open + 1, '#2a0a0a', { amb: 0 });
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * TAU;
        P.spike(mx + Math.cos(a) * (6.5 * open + 1.5), my + Math.sin(a) * (3 * open + 1.6), a + Math.PI, 2.5, 0.6, '#f0e8d0');
      }
    },
    fx(P, t) {
      for (let i = 0; i < 3; i++) {
        const k = (t + i / 3) % 1;
        P.fx(14 + i * 13, 64 - k * 10, '#c8a878', 0.8 * (1 - k));
      }
    },
  },

  // The Prime: a Kavorent engine of war, plates of violet stone over a
  // core of orange fire, light running in its seams; its shoulder-stones
  // hang off it, floating.
  prime: {
    w: 66, h: 64, ax: 33, ay: 62,
    body(P, t, st) {
      const stone = '#3e3050';
      const bob = sn(t) * 1.2;
      const wind = st.wind;
      // Legs: blocks.
      for (const x of [24, 42]) {
        P.poly([[x - 5, 44], [x + 5, 44], [x + 4, 58], [x - 4, 58]], stone, { lv: 0.5 });
        P.poly([[x - 6, 57], [x + 6, 57], [x + 6, 61], [x - 6, 61]], shade(hex(stone), 0.8), { lv: 0.5 });
      }
      // The far arm.
      P.poly([[48, 24], [56, 26], [57, 46], [50, 46]], shade(hex(stone), 0.8), { lv: 0.45 });
      P.poly([[49, 46], [58, 46], [58, 53], [49, 53]], shade(hex(stone), 0.75), { lv: 0.45 });
      // The trunk: a wedge of plate, a waist.
      P.poly([[16, 20], [50, 20], [44, 44], [22, 44]], stone, { lv: 0.55, grad: [-0.8, -0.6] });
      P.poly([[22, 40], [44, 40], [42, 46], [24, 46]], shade(hex(stone), 0.8), { lv: 0.5 });
      // The head: a block, a visor.
      P.poly([[27, 8], [39, 8], [40, 19], [26, 19]], stone, { lv: 0.6 });
      P.rect(28, 13, 10, 2, '#140e1e');
      // The core, and the seams of light.
      const pulse = 0.5 + 0.5 * sn(t, 1);
      const seam = mix(hex('#3a9ab0'), hex('#c8fbff'), pulse);
      for (const [a, b] of [[[20, 22], [33, 34]], [[46, 22], [33, 34]], [[33, 34], [33, 43]], [[27, 10], [39, 10]], [[22, 44], [44, 44]]]) P.line(a[0], a[1], b[0], b[1], seam);
      P.blob(33, 29, 4 + pulse, 4 + pulse, wind ? '#ffd090' : '#ff9050', { lift: 0.3 + pulse * 0.3 });
      P.rect(29, 13, 8, 1, wind ? '#ffffff' : '#ff9050');
      grain(P, 181, 0.08, 0.85);
      // The shoulder-stones, floating.
      for (const [x, ph] of [[12, 0], [52, 2]]) {
        const y = 18 + sn(t, 1, ph) * 1.5 + bob * 0.3;
        P.poly([[x - 7, y - 4], [x + 6, y - 5], [x + 7, y + 4], [x - 6, y + 5]], shade(hex(stone), 1.15), { lv: 0.6 });
        P.line(x - 5, y, x + 5, y - 1, seam);
      }
      // The near arm, a hammer of a fist (raised to strike).
      const fy = wind ? 4 : 48;
      P.poly([[10, 26], [17, 26], [16, wind ? 16 : 46], [9, wind ? 16 : 46]], stone, { lv: 0.55 });
      P.poly([[6, fy - 4], [18, fy - 4], [18, fy + 5], [6, fy + 5]], shade(hex(stone), 1.1), { lv: 0.6 });
      P.line(7, fy, 17, fy, seam);
    },
    fx(P, t) {
      P.puff(33, 29, 8, '#ff9050', 0.18 + 0.1 * sn(t));
      for (let i = 0; i < 3; i++) {
        const k = (t + i / 3) % 1;
        P.fx(16 + i * 16, 56 - k * 40, '#5ad8f0', 0.8 * (1 - k));
      }
    },
  },
});

// ------------------------------------------------------------ painting
export function beastOf(species) {
  return BEASTS[species] || null;
}
export const BEAST_SPECIES = Object.keys(BEASTS);
export function paintBeast(species, t, st) {
  const B = BEASTS[species];
  const P = new Paint(B.w, B.h);
  B.body(P, t, st);
  P.done();
  if (B.fx) B.fx(P, t, st);
  return P.p;
}
