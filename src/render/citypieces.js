// (Round 146) The greatest thing in each of a few of the places known for
// something (see world/quarters/), nine paces round and painted whole as
// the squares' great things are (see pieces.js): the champion in bronze
// on the arena's square, braziers burning at its foot; the orrery in the
// grand library's court, its worlds wheeling round the sun; the fair's
// carousel, its horses going round and up and down under the striped
// canopy; and the colossus's head, fallen long ago, lying in the grass of
// the ruins the town grew up among.
import { hex, mix } from './pixel.js';
import { hash2 } from './paint.js';
import { outlineSel } from './people.js';
import { addPieces, PIECE_KIT } from './pieces.js';

const { edge, frac, roundWall, fire, glow, CX, TAU } = PIECE_KIT;
const PIECES = {};

// ------------------------------------------------------------- the champion
// A fighter in bronze on a round plinth of marble steps: a stride, the
// shield up, the blade raised to the crowd, the crest of the helm; the
// green of years in the folds; a wreath laid at the foot and a brazier
// burning either side.
PIECES.champion_bronze = {
  h: 96,
  paint(P, t) {
    const H = 96;
    const by = H - 24;
    const marble = '#e6e0d4';
    const bronze = '#a8743a';
    roundWall(P, CX, by - 3, 21, 13, 5, 3, marble, { joints: 6, course: 3, seed: 31 });
    roundWall(P, CX, by - 8, 13, 8, 7, 2, marble, { joints: 4, course: 3, seed: 32 });
    // (The name cut in the step, and the wreath laid on it.)
    for (let x = CX - 8; x <= CX + 8; x++) {
      const yf = edge(CX, by - 8, 13, 8, x);
      if (yf !== null && Math.floor(x) % 2 === 0) P.set(x, Math.floor(yf) + 3, P.tone('#8a8070', 0.35, x, Math.floor(yf) + 3));
    }
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * TAU;
      P.set(CX + Math.cos(a) * 4, by - 1 + Math.sin(a) * 1.6, hex(i % 2 ? '#3a7a3a' : '#5aa04a'));
    }
    const foot = by - 13;
    // The legs: one forward, one back.
    P.tube(CX - 2, foot - 16, CX - 6, foot, 2.4, 1.8, bronze);
    P.tube(CX + 2, foot - 16, CX + 5, foot - 1, 2.4, 1.8, bronze);
    P.blob(CX - 6, foot, 2.4, 1.2, bronze);
    P.blob(CX + 5, foot - 1, 2.4, 1.2, bronze);
    // The kilt of strips, the body, the shoulders.
    P.poly([[CX - 5, foot - 18], [CX + 5, foot - 18], [CX + 6, foot - 12], [CX - 6, foot - 12]], bronze, { lv: 0.5 });
    for (let x = CX - 5; x <= CX + 5; x += 2) P.line(x, foot - 17, x, foot - 12, '#6a4418');
    P.blob(CX, foot - 25, 5.4, 7.5, bronze);
    P.blob(CX - 5, foot - 30, 2.6, 2.4, bronze);
    P.blob(CX + 5, foot - 30, 2.6, 2.4, bronze);
    // The sword arm, raised; the blade catching the light.
    P.tube(CX + 6, foot - 30, CX + 10, foot - 40, 1.8, 1.5, bronze);
    P.line(CX + 10, foot - 41, CX + 14, foot - 58, '#e0d8c8');
    P.line(CX + 11, foot - 41, CX + 15, foot - 58, '#a8a098');
    P.rect(CX + 8, foot - 42, 5, 1, hex('#6a4418'));
    // The shield arm, the great oval shield with its boss.
    P.tube(CX - 6, foot - 30, CX - 10, foot - 22, 1.8, 1.6, bronze);
    P.blob(CX - 11, foot - 22, 5, 8.5, '#946232', { flat: 0.35 });
    P.blob(CX - 11, foot - 22, 1.6, 1.6, '#d8a860');
    for (let y = -7; y <= 7; y += 7) P.line(CX - 14, foot - 22 + y, CX - 8, foot - 22 + y, '#6a4418');
    // The helm, its crest.
    P.blob(CX, foot - 36, 3.6, 3.8, bronze);
    P.rect(CX - 2, foot - 36, 4, 1, hex('#3a2410'));
    for (let i = 0; i < 9; i++) P.blob(CX - 4 + i, foot - 40 - Math.sin((i / 8) * Math.PI) * 3, 1.2, 1.2, '#b8442a');
    // The green of years in the hollows.
    P.over((x, y, c) => (c[1] > c[0] * 0.6 && c[0] > 90 && c[0] < 200 && c[2] < 90 && hash2(x, y, 7) < 0.12 ? mix(c, [70, 150, 120], 0.6) : null));
    outlineSel(P.p);
    // The sun along the blade.
    const run = frac(t);
    P.fx(CX + 10 + run * 4, foot - 41 - run * 17, '#ffffff', 0.9);
    // Braziers either side, burning.
    for (const s of [-1, 1]) {
      const x = CX + s * 18;
      const y = by + 1;
      P.tube(x, y, x, y - 8, 1.2, 1.2, '#4a4048');
      P.blob(x, y - 9, 3.2, 1.4, '#7a6a5a', { flat: 0.5 });
      fire(P, x, y - 10, 6, 10, t + (s > 0 ? 0.5 : 0), { n: 2, seed: 9 + s, sparks: 2 });
      glow(P, x, y - 13, 7, '#ffa040', 0.12);
    }
  },
};

// ------------------------------------------------------------- the orrery
// The worlds about the sun in brass, on a pedestal of dark stone: the
// sun lit gold at the heart, the rings of their roads tilted, each world
// on its arm going round at its own pace, a moon round the third.
PIECES.orrery = {
  h: 84,
  paint(P, t) {
    const H = 84;
    const by = H - 24;
    roundWall(P, CX, by - 3, 15, 9, 5, 2, '#5a5468', { joints: 6, course: 3, seed: 41, top: '#7a7488' });
    P.tube(CX, by - 8, CX, by - 26, 3, 2, '#5a5468');
    P.blob(CX, by - 26, 5, 2, '#c89a3a', { flat: 0.4 });
    const cy = by - 40;
    // The rings, back halves first.
    const rings = [[9, 3.4, 1.0, '#e0c070'], [14, 5.2, 0.62, '#9ab8d8'], [19, 7, 0.4, '#d8784a'], [23, 8.6, 0.27, '#c8b890']];
    const ring = (rx, ry, back) => {
      for (let i = 0; i < 90; i++) {
        const a = (i / 90) * TAU;
        if ((Math.sin(a) < 0) !== back) continue;
        P.set(CX + Math.cos(a) * rx, cy + Math.sin(a) * ry, P.tone('#b8862e', back ? 0.35 : 0.75, i, 0));
      }
    };
    for (const [rx, ry] of rings) ring(rx, ry, true);
    // The worlds behind the sun.
    const worlds = rings.map(([rx, ry, sp, col], i) => {
      const a = TAU * (t * sp + i * 0.27);
      return { x: CX + Math.cos(a) * rx, y: cy + Math.sin(a) * ry, back: Math.sin(a) < 0, col, r: 1.4 + (i % 3) * 0.5, i };
    });
    const world = (w) => {
      P.line(CX, cy, w.x, w.y, '#8a6420');
      P.blob(w.x, w.y, w.r, w.r, w.col, { amb: 0.35 });
      if (w.i === 1) {
        const ma = TAU * t * 3;
        P.blob(w.x + Math.cos(ma) * 3, w.y + Math.sin(ma) * 1.4, 0.8, 0.8, '#e8e8f0');
      }
    };
    for (const w of worlds) if (w.back) world(w);
    // The sun.
    P.blob(CX, cy, 4.2, 4.2, '#f0b830', { amb: 0.6, lift: 0.15 });
    glow(P, CX, cy, 9, '#ffd060', 0.1);
    for (const w of worlds) if (!w.back) world(w);
    for (const [rx, ry] of rings) ring(rx, ry, false);
    outlineSel(P.p);
    P.fx(CX - 1, cy - 2, '#ffffff', 0.8);
  },
};

// ------------------------------------------------------------- the carousel
// Round and round: a painted platform, its pole of gilt at the middle, a
// canopy striped red and cream with a pennant at the top, scalloped at the
// edge with lamps hung; and the horses on their brass poles, going round
// and rising and falling as they go.
PIECES.carousel = {
  h: 88,
  paint(P, t) {
    const H = 88;
    const by = H - 24;
    roundWall(P, CX, by - 2, 21, 12, 4, 2, '#a83a3a', { joints: 12, course: 4, seed: 51, top: '#c8a060' });
    const top = by - 44;
    const turn = t;
    // The horses: those behind the pole first.
    const horses = [];
    for (let i = 0; i < 8; i++) {
      const a = TAU * (i / 8 + turn / 4);
      horses.push({ a, x: CX + Math.cos(a) * 16, y: by - 6 + Math.sin(a) * 8, bob: Math.sin(TAU * (t * 2 + i * 0.25)) * 2.5, i });
    }
    const cols = ['#f0ece0', '#5a3a2a', '#c8a060', '#2a2a30'];
    const horse = (h) => {
      const back = Math.sin(h.a) < 0;
      const yb = h.y - 9 - h.bob;
      P.line(h.x, top + 10, h.x, h.y - 1, back ? '#8a6a2a' : '#e0b040');
      const dir = Math.cos(h.a + Math.PI / 2) > 0 ? 1 : -1;
      const col = cols[h.i % 4];
      P.blob(h.x, yb, 4, 2.4, col, { amb: back ? 0.2 : 0.35 });
      P.tube(h.x + dir * 3, yb - 1, h.x + dir * 5, yb - 5, 1.2, 1, col);
      P.blob(h.x + dir * 6, yb - 5, 1.6, 1.1, col);
      P.line(h.x - 2, yb + 1, h.x - 3 + dir, yb + 4, col);
      P.line(h.x + 2, yb + 1, h.x + 3 + dir, yb + 4, col);
      P.set(h.x, yb - 2, hex(h.i % 2 ? '#c03030' : '#3060c0'));
    };
    for (const h of horses) if (Math.sin(h.a) < 0) horse(h);
    // The pole.
    P.tube(CX, top + 8, CX, by - 4, 2.2, 2.2, '#e0b040');
    for (const h of horses) if (Math.sin(h.a) >= 0) horse(h);
    // The canopy, striped, turning with it.
    for (let y = top; y <= top + 10; y++) {
      const k = (y - top) / 10;
      const hw = 4 + k * 20;
      for (let x = Math.floor(CX - hw); x <= Math.ceil(CX + hw); x++) {
        const u = (x + 0.5 - CX) / hw;
        const ang = Math.asin(Math.max(-1, Math.min(1, u))) / Math.PI + turn / 4;
        const red = Math.floor(ang * 16 + 64) % 2 === 0;
        P.set(x, y, P.tone(red ? '#c83a3a' : '#f0e8d0', 0.75 - u * 0.25 - k * 0.1, x, y));
      }
    }
    for (let x = CX - 24; x <= CX + 24; x++) {
      const sc = Math.floor(x - CX + 64) % 4 < 2 ? 1 : 0;
      P.set(x, top + 11, hex('#e0b040'));
      if (sc) P.set(x, top + 12, hex('#c83a3a'));
    }
    for (const s of [-1, 1]) for (const d of [8, 18]) {
      const x = CX + s * d;
      P.blob(x, top + 14, 1.2, 1.4, '#ffe090', { amb: 0.8 });
      glow(P, x, top + 14, 4, '#ffd070', 0.12);
    }
    P.line(CX, top, CX, top - 8, '#8a6a3a');
    const fl = Math.sin(TAU * t * 2) * 1.5;
    P.poly([[CX, top - 8], [CX + 7, top - 6 + fl], [CX, top - 4]], '#3a6ac8', { lv: 0.6 });
    outlineSel(P.p);
  },
};

// ------------------------------------------------------------- the colossus
// The head of the colossus that stood here before the town: fallen on its
// cheek and half sunk in the turf, great as a house, its crown of rays
// broken, its stone eye open to the sky, cracked, the moss on it; a bird on
// its brow.
PIECES.colossus_head = {
  h: 70,
  paint(P, t) {
    const H = 70;
    const by = H - 24;
    // Bronze gone green with the years (darker in the hollows, the old
    // gold showing where it's been rubbed).
    const bronze = '#5e9a86';
    const deep = '#2e5a50';
    const gold = '#c8a050';
    const hx = CX + 1;
    const hy = by - 17;
    // The turf it's sunk in, behind it.
    for (let x = 2; x < 46; x++) {
      const yf = edge(CX, by - 2, 22, 11, x);
      if (yf === null) continue;
      for (let y = Math.floor(by - 2 - (yf - (by - 2))); y <= yf; y++) P.set(x, y, P.tone('#5a8a3a', 0.45 + hash2(x, y, 3) * 0.2, x, y));
    }
    // The crown of rays, broken off short, behind the head.
    for (let i = 0; i < 7; i++) {
      const a = -Math.PI * 0.92 + i * 0.3;
      const len = [9, 5, 11, 3, 10, 6, 8][i];
      const x0 = hx + Math.cos(a) * 12;
      const y0 = hy - 3 + Math.sin(a) * 14;
      P.spike(x0, y0, a, len, 1.6, bronze, { lv: 0.6 });
    }
    // The head: the face's great oval, the cheek turned to the light.
    P.blob(hx, hy, 13, 16, bronze, { flat: 0.75, amb: 0.3 });
    // The hair: a band of curls across the brow.
    for (let k = 0; k < 9; k++) {
      const a = -Math.PI + 0.25 + k * 0.33;
      P.blob(hx + Math.cos(a) * 11, hy - 3 + Math.sin(a) * 13, 3, 2.6, bronze, { lift: -0.08 });
    }
    // The brow ridge and the shadow under it.
    P.poly([[hx - 10, hy - 6], [hx + 10, hy - 6], [hx + 9, hy - 3.5], [hx - 9, hy - 3.5]], bronze, { lv: 0.7 });
    for (let x = hx - 9; x <= hx + 9; x++) if (Math.abs(x - hx) > 1) P.set(x, hy - 3, P.tone(deep, 0.35, x, hy - 3));
    // The eyes: heavy-lidded, blank, the pupils cut in.
    for (const ex of [hx - 5, hx + 5]) {
      P.blob(ex, hy - 0.5, 3.4, 1.6, '#9ac8b4', { flat: 0.4, lift: 0.1 });
      P.line(ex - 3, hy - 2, ex + 3, hy - 2, deep);
      P.set(ex, hy - 0.5, P.tone(deep, 0.2, ex, hy));
      P.set(ex + 1, hy - 0.5, P.tone(deep, 0.3, ex + 1, hy));
    }
    // The nose: a straight ridge, lit down its side, the nostrils.
    P.poly([[hx - 1, hy - 3], [hx + 1, hy - 3], [hx + 2.5, hy + 6], [hx - 2.5, hy + 6]], bronze, { lv: 0.62, grad: [0.9, -0.2] });
    P.set(hx - 2, hy + 6, P.tone(deep, 0.25, hx - 2, hy + 6));
    P.set(hx + 2, hy + 6, P.tone(deep, 0.25, hx + 2, hy + 6));
    // The lips, closed; the line of the mouth.
    P.blob(hx, hy + 9, 4.5, 1.6, bronze, { flat: 0.5, lift: 0.05 });
    P.line(hx - 4, hy + 9, hx + 4, hy + 9, deep);
    P.blob(hx, hy + 10.5, 3.5, 1.2, bronze, { flat: 0.5, lift: 0.1 });
    // The old gold where hands have rubbed it for luck: the nose, the brow.
    for (const [x, y] of [[hx + 1, hy + 2], [hx + 1, hy + 3], [hx - 2, hy - 5], [hx + 3, hy - 5]]) P.set(x, y, P.tone(gold, 0.65, x, y));
    // Green weeping down from the eyes, a crack across the brow.
    for (const ex of [hx - 5, hx + 6]) for (let y = hy + 1; y < hy + 6 + (ex & 1) * 2; y++) if (hash2(ex, y, 5) < 0.75) P.set(ex, y, P.tone('#7ac8a8', 0.75, ex, y));
    P.line(hx - 9, hy - 9, hx - 3, hy - 6, deep);
    P.line(hx - 3, hy - 6, hx + 1, hy - 8, deep);
    // The turf in front, up to the chin, tufts of grass against the bronze.
    for (let x = 4; x < 44; x++) {
      const top = by - 4 + Math.round(Math.sin(x * 0.7) * 1.2 + hash2(x, 1, 7) * 1.5);
      for (let y = top; y <= by + 2; y++) {
        const yf = edge(CX, by - 2, 22, 11, x);
        if (yf === null || y > yf) continue;
        P.set(x, y, P.tone('#5a8a3a', 0.5 + hash2(x, y, 9) * 0.25, x, y));
      }
      // (The tufts lean with the wind as it goes over.)
      const lean = Math.round(Math.sin(t * Math.PI * 2 + x * 0.55) * 0.9);
      if (hash2(x, 2, 8) < 0.35) for (let k = 1; k <= 2; k++) P.set(x + (k === 2 ? lean : 0), top - k, P.tone('#7aaa4a', 0.7, x, top - k));
    }
    outlineSel(P.p);
    // The sun on the bronze: a glint that slides over the face and back as
    // the light moves, brightest down the nose and the brow.
    const gx = hx + Math.sin(t * Math.PI * 2) * 9;
    const shine = hex('#e4f4dc');
    for (let y = hy - 16; y <= hy + 14; y++) {
      for (let x = hx - 13; x <= hx + 13; x++) {
        const e = ((x - hx) / 13) ** 2 + ((y - hy) / 16) ** 2;
        if (e > 0.92 || P.p.alpha(x, y) < 200) continue;
        const w = 1 - Math.abs(x - gx + (y - hy) * 0.45) / 3;
        if (w <= 0.25) continue;
        const c = P.get(x, y);
        P.set(x, y, mix(c, shine, w > 0.7 ? 0.42 : w > 0.45 ? 0.26 : 0.12));
      }
    }
    // A crow on the crown, pecking at the moss.
    const bx = hx - 4;
    const byy = hy - 17;
    const peck = frac(t * 3) < 0.5 ? 1 : 0;
    P.set(bx, byy, hex('#2a2a30'));
    P.set(bx + 1, byy, hex('#2a2a30'));
    P.set(bx - 1, byy - 1 + peck, hex('#2a2a30'));
    P.set(bx - 2, byy - 1 + peck * 2, hex('#c89030'));
  },
};

addPieces(PIECES);
export const CITY_PIECE_NAMES = Object.keys(PIECES);
