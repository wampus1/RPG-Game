// The great things at the heart of the far peoples' squares (round 68: see
// world/farlands.js and world/settlement.decorate), painted like the
// Dagoni Islands' own (see pieces.js), in twelve frames:
//   the Velari's triumphal column: two steps of travertine, a fluted shaft
// of marble wound with a carved frieze of the legions' march, braziers
// burning at its foot, crimson ribbons streaming from its capital, and a
// gilt eagle on top, the sun running along its wings;
//   the Rimeborn's frost hearth: a ring of standing stones each crowned
// with a reindeer's antlers, round a fire of blue ice that burns cold
// (frost glittering off it; dead, a heap of ice where nobody tends it);
//   the Jade Court's bell pagoda: three tiers of green-glazed roofs swept
// up at their corners on red-lacquered posts, red lanterns swinging from
// the eaves and a bronze bell swinging under the lowest;
//   the Keshari's sun wheel: a round kiva of red adobe, its ladder out of
// the roof hatch and smoke from it, the great wheel of turquoise and gold
// turning slowly over it, feathers fluttering from its rim;
//   the Bonewrights' whale-jaw arch: the two jawbones of a great whale
// met in a point over the square, scored with scrimshaw, oil lamps
// swinging from the apex, set in drystone;
//   the Saltfolk's salt obelisk: a spire of white salt crystal, glittering,
// standing in a pink lagoon pool (drawn from like a well) in a ring of
// salt brick, a flamingo wading in it;
//   the Hollowfolk's lantern tree: a gnarled old tree on a mossy mound, its
// roots over the ground, glowing pods hung all over it on threads,
// swaying, and moths about it;
//   the Wyrdfolk's ring of runestones round an altar stone, the runes
// glowing in turn, the aurora rippling over them;
//   the Skerrymen's beacon: a round drystone tower with an iron basket of
// fire on top (cold, in a town gone quiet), a bell under it.
import { hex, mix } from './pixel.js';
import { hash2 } from './paint.js';
import { outlineSel } from './people.js';
import { addPieces, PIECE_KIT } from './pieces.js';

const { edge, inside, frac, roundWall, water, fire, glow, CX, TAU } = PIECE_KIT;

// A lit vertical column (round): `col` at x0..x1, from y0 down to y1,
// fluted every `fl` pixels if asked.
function shaft(P, cx, r, y0, y1, col, fl = 0) {
  for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
    const u = (x + 0.5 - cx) / r;
    if (Math.abs(u) > 1) continue;
    let lv = 0.78 - u * 0.36 - (1 - Math.sqrt(1 - u * u)) * 0.2;
    if (fl && Math.floor(x - cx + 100) % fl === 0) lv -= 0.16;
    for (let y = y0; y <= y1; y++) P.set(x, y, P.tone(col, lv, x, y));
  }
}

// A sloped roof tier: from a ridge (half-width `rt`) at `top` down to the
// eave (half-width `rb`) at `bot`, its corners swept up by `lift`, glazed
// tile in rows; and the eave's dark underside.
function tier(P, top, bot, rt, rb, lift, col) {
  for (let y = top; y <= bot; y++) {
    const k = (y - top) / Math.max(1, bot - top);
    const hw = rt + (rb - rt) * k;
    for (let x = Math.floor(CX - hw); x <= Math.ceil(CX + hw); x++) {
      const u = (x + 0.5 - CX) / hw;
      const row = (y - top) % 3 === 2;
      const ch = Math.floor(x - CX + 64) % 3 === 0;
      let lv = 0.66 - u * 0.24 - k * 0.12;
      if (row) lv -= 0.16;
      if (ch) lv += 0.08;
      P.set(x, y, P.tone(col, lv, x, y));
    }
  }
  // The swept-up corners.
  for (const s of [-1, 1]) {
    for (let i = 0; i < lift + 2; i++) {
      const x = CX + s * (rb + i * 0.8);
      const y = bot - Math.round((i * i) / (lift + 1)) - 1;
      P.set(x, y, P.tone(col, 0.6 - s * 0.12, x, y));
      P.set(x, y + 1, P.tone(col, 0.3, x, y + 1));
    }
  }
  for (let x = Math.floor(CX - rb); x <= Math.ceil(CX + rb); x++) {
    P.set(x, bot + 1, P.tone('#6a1a1e', 0.4, x, bot + 1));
    if (Math.floor(x - CX + 64) % 4 === 0) P.set(x, bot + 1, hex('#e0b040'));
  }
}

// A paper lantern swinging on its cord from (x, y), `t` its phase.
function lantern(P, x, y, t, k = 1, col = '#d8282a') {
  const sw = Math.sin(TAU * t + x * 0.3) * 1.2 * k;
  const lx = x + sw;
  P.line(x, y, lx, y + 3, '#2a1a14');
  P.blob(lx, y + 5, 2.4, 2.8, col, { amb: 0.5, lift: 0.15 });
  P.set(lx, y + 2, hex('#e0b040'));
  P.set(lx, y + 8, hex('#e0b040'));
  P.fx(lx - 1, y + 4, '#ffe8a0', 0.7);
  return lx;
}

const PIECES = {};

// ------------------------------------------------------------- Velmarch
PIECES.triumph_column = {
  h: 104,
  paint(P, t) {
    const H = 104;
    const by = H - 24;
    const trav = '#e2d6bc';
    const marble = '#ece8e0';
    roundWall(P, CX, by - 4, 22, 14, 6, 3, trav, { joints: 4, course: 3, seed: 11 });
    roundWall(P, CX, by - 9, 14, 9, 6, 3, trav, { joints: 4, course: 3, seed: 12 });
    // (An inscription band on the upper step.)
    for (let x = CX - 10; x <= CX + 10; x++) {
      const yf = edge(CX, by - 9, 14, 9, x);
      if (yf !== null && Math.floor(x) % 2 === 0) P.set(x, Math.floor(yf) + 2, P.tone('#8a7a5a', 0.4, x, Math.floor(yf) + 2));
    }
    // The base and the shaft.
    const top = 26;
    P.blob(CX, by - 13, 7, 2.4, marble, { flat: 0.4 });
    shaft(P, CX, 5.5, top + 6, by - 14, marble, 3);
    // The frieze winding up it: a band of carving (darker), with tiny
    // figures marching in it.
    for (let y = top + 8; y < by - 15; y++) {
      const ph = frac((y - top) / 11);
      const x = CX - 5 + ph * 11;
      for (let k = 0; k < 2; k++) {
        const xx = Math.round(x) + k;
        if (Math.abs(xx + 0.5 - CX) > 5) continue;
        P.set(xx, y, P.tone('#b8b0a0', 0.42 - (xx - CX) * 0.04, xx, y));
      }
      if ((y + Math.floor(t * 12)) % 4 === 0) P.set(Math.round(x) + 1, y - 1, P.tone('#a89c88', 0.3, Math.round(x) + 1, y - 1));
    }
    // The capital: a block of carved leaves, and the abacus on it.
    P.rect(CX - 8, top + 2, 17, 4, hex('#d8d2c6'));
    for (let x = CX - 8; x <= CX + 8; x++) {
      P.set(x, top + 2, P.tone(marble, 0.9 - (x - CX) * 0.02, x, top + 2));
      if (x % 3 === 0) P.set(x, top + 4, P.tone('#9a9282', 0.4, x, top + 4));
    }
    P.blob(CX - 7, top + 6, 1.6, 1.6, marble);
    P.blob(CX + 7, top + 6, 1.6, 1.6, marble);
    outlineSel(P.p);
    // The eagle, gilt, its wings spread, the light running along them.
    const gold = '#e0b040';
    const ey = top - 4;
    P.blob(CX, ey, 3, 4, gold, { lift: 0.05 });
    P.blob(CX - 1, ey - 5, 1.8, 1.8, gold);
    P.set(CX - 3, ey - 5, hex('#c87a20'));
    for (const s of [-1, 1]) {
      const pts = [[CX + s * 2, ey - 2], [CX + s * 14, ey - 12], [CX + s * 16, ey - 9], [CX + s * 12, ey - 3], [CX + s * 4, ey + 2]];
      P.poly(pts, gold, { grad: [-s * 0.4, -0.7], lv: 0.6 });
      for (let i = 0; i < 4; i++) P.line(CX + s * (5 + i * 3), ey - 2 - i * 2, CX + s * (6 + i * 3), ey + 1 - i, '#a8761c');
    }
    P.poly([[CX - 2, ey + 3], [CX + 2, ey + 3], [CX + 3, ey + 7], [CX - 3, ey + 7]], gold, { lv: 0.5 });
    outlineSel(P.p);
    const run = frac(t);
    for (const s of [-1, 1]) {
      const x = CX + s * (3 + run * 12);
      P.fx(x, ey - 2 - run * 9, '#fffbe0', 0.9);
      P.fx(x + s, ey - 2 - run * 9, '#ffe890', 0.5);
    }
    // Ribbons from the capital, streaming in the wind.
    for (const s of [-1, 1]) {
      for (let i = 0; i < 16; i++) {
        const k = i / 16;
        const x = CX + s * (8 + i * 0.9);
        const y = top + 4 + i * 1.3 + Math.sin(TAU * (t * 2 - k)) * (1 + k * 2);
        P.fx(x, y, i % 5 === 0 ? '#e0b040' : '#b82a2a', 0.95);
        P.fx(x, y + 1, '#7a1a1a', 0.8);
      }
    }
    // Braziers at the foot.
    for (const s of [-1, 1]) {
      const x = CX + s * 17;
      const y = by + 2;
      P.tube(x, y, x, y - 7, 1.2, 1.2, '#8a6a3a');
      P.blob(x, y - 8, 3, 1.4, '#a8783a', { flat: 0.5 });
      fire(P, x, y - 9, 6, 9, t + (s > 0 ? 0.5 : 0), { n: 2, seed: 7 + s, sparks: 2 });
      glow(P, x, y - 12, 7, '#ffa040', 0.12);
    }
  },
};

PIECES.frost_hearth = {
  h: 74,
  paint(P, t, st) {
    const H = 74;
    const by = H - 24;
    // The hearth's floor: a ring of flat stones, frost on them.
    roundWall(P, CX, by - 2, 16, 10, 3, 4, '#7a7a84', { joints: 10, course: 3, seed: 21, top: '#9aa0ac' });
    for (let i = 0; i < 20; i++) {
      const a = (i / 20) * TAU;
      P.fx(CX + Math.cos(a) * 13, by - 2 + Math.sin(a) * 8, '#e8f4ff', 0.6);
    }
    // The standing stones round it, the back ones first, each crowned with
    // antlers.
    const stones = [];
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU + 0.3;
      stones.push({ x: CX + Math.cos(a) * 20, y: by - 2 + Math.sin(a) * 13, a, h: 12 + hash2(i, 3, 21) * 6 });
    }
    stones.sort((a, b) => a.y - b.y);
    const stone = (s) => {
      const w = 3.2;
      P.poly([[s.x - w, s.y], [s.x - w + 0.6, s.y - s.h], [s.x + w - 1, s.y - s.h - 1.5], [s.x + w, s.y]], '#6a6a74', { lv: 0.62 });
      for (let k = 0; k < 4; k++) P.fx(s.x - 2 + k, s.y - s.h, '#e8f0f8', 0.8);
      // Antlers.
      const ay = s.y - s.h - 1;
      for (const d of [-1, 1]) {
        P.line(s.x, ay, s.x + d * 4, ay - 5, '#e8dcc0');
        P.line(s.x + d * 2, ay - 2, s.x + d * 1, ay - 6, '#e8dcc0');
        P.line(s.x + d * 4, ay - 5, s.x + d * 6, ay - 7, '#d8ccb0');
        P.set(s.x + d * 3, ay - 4, hex('#d8ccb0'));
      }
    };
    for (const s of stones) if (s.y < by - 2) stone(s);
    // The ice at the heart: a heap of crystals.
    const ice = '#a8d8f8';
    for (let i = 0; i < 7; i++) {
      const x = CX - 7 + i * 2.3;
      const hgt = 5 + hash2(i, 5, 22) * 6;
      P.poly([[x - 1.8, by - 2], [x + 0.2, by - 2 - hgt], [x + 1.8, by - 2]], ice, { lv: 0.7, grad: [-0.6, -0.4] });
    }
    for (const s of stones) if (s.y >= by - 2) stone(s);
    outlineSel(P.p);
    if (st) {
      // The cold fire: blue-white, leaping.
      glow(P, CX, by - 18, 18, '#80c8ff', 0.16);
      fire(P, CX, by - 5, 18, 30, t, { n: 4, seed: 9, sparks: 0, pal: ['#ffffff', '#e0f6ff', '#9ad8ff', '#4a98e8', '#2a4aa0'] });
      // Frost glittering off it, drifting up.
      for (let i = 0; i < 9; i++) {
        const ph = hash2(i, 9, 23);
        const k = frac(t + ph);
        const x = CX + (hash2(i, 10, 23) - 0.5) * 22 + Math.sin(TAU * (k + ph)) * 2;
        const y = by - 10 - k * 40;
        const c = (i + Math.floor(t * 12)) % 3 === 0 ? '#ffffff' : '#bfe8ff';
        P.fx(x, y, c, 1 - k);
        if (k < 0.5) P.fx(x + 1, y, c, 0.4);
      }
    } else {
      // Gone out: the ice only, glinting now and then, and a cold mist
      // creeping off it over the stones.
      for (let i = 0; i < 6; i++) P.fx(CX - 5 + i * 2, by - 9 - hash2(i, 2, 24) * 3, (i + Math.floor(t * 12)) % 4 === 0 ? '#ffffff' : '#c8e0f0', 0.8);
      for (let k = 0; k < 14; k++) {
        const ph = frac(t + k / 14);
        const x = CX + Math.cos(TAU * (k / 14)) * (6 + ph * 14);
        const y = by - 4 + Math.sin(TAU * (k / 14)) * (3 + ph * 6);
        P.puff(x, y, 2.4, '#e8f4ff', 0.35 * (1 - ph));
      }
    }
  },
};

// --------------------------------------------------------------- Ostria
PIECES.bell_pagoda = {
  h: 108,
  paint(P, t) {
    const H = 108;
    const by = H - 24;
    const jade = '#2e9a62';
    const red = '#b8242a';
    // The platform: grey stone, a step, a balustrade of red.
    roundWall(P, CX, by - 3, 22, 14, 5, 3, '#9a9a94', { joints: 8, course: 3, seed: 31, top: '#b0b0aa' });
    // The posts, back pair then front.
    const posts = [[-11, -6], [11, -6], [-13, 3], [13, 3]];
    for (const [dx, dz] of posts.slice(0, 2)) shaft(P, CX + dx, 1.4, by - 34 + dz, by - 6 + dz, red);
    // The bell, swinging under the lowest roof.
    const sw = Math.sin(TAU * t) * 0.35;
    const bx = CX + Math.sin(sw) * 9;
    const byb = by - 30 + Math.cos(sw) * 9;
    P.line(CX, by - 38, bx, byb - 7, '#3a2a1a');
    for (let k = 0; k < 10; k++) {
      const hw = 2 + k * 0.55;
      for (let x = Math.floor(bx - hw); x <= Math.ceil(bx + hw); x++) {
        const u = (x + 0.5 - bx) / hw;
        const y = byb - 8 + k;
        P.set(x, y, P.tone('#b07a34', 0.78 - u * 0.4 - (k === 9 ? 0.2 : 0), x, y));
      }
    }
    P.set(bx - 2, byb - 4, hex('#3e8a6a'));
    P.set(bx + 1, byb - 2, hex('#3e8a6a'));
    for (const [dx, dz] of posts.slice(2)) shaft(P, CX + dx, 1.6, by - 34 + dz, by - 6 + dz, red);
    // The roofs, from the top down so each covers the one above's foot.
    tier(P, 8, 22, 1, 10, 3, jade);
    P.rect(CX - 5, 23, 11, 6, hex(red));
    for (let x = CX - 5; x <= CX + 5; x++) P.set(x, 26, P.tone('#e0b040', 0.6, x, 26));
    tier(P, 28, 42, 4, 17, 4, jade);
    P.rect(CX - 9, 43, 19, 5, hex(red));
    tier(P, 46, by - 36, 8, 23, 5, jade);
    // The finial: a gilt spire of rings and a pearl.
    for (let k = 0; k < 7; k++) {
      const w = k % 2 ? 1 : 2;
      for (let x = CX - w; x <= CX + w; x++) P.set(x, 7 - k, P.tone('#e0b040', 0.7 - (x - CX) * 0.15, x, 7 - k));
    }
    P.blob(CX, 1.5, 1.5, 1.5, '#f0e0a0');
    outlineSel(P.p);
    // The lanterns at the eaves' corners, swinging, lit.
    for (const [x, y, k] of [[CX - 20, by - 35, 1], [CX + 20, by - 35, 1], [CX - 15, 43, 0.8], [CX + 15, 43, 0.8]]) {
      const lx = lantern(P, x, y, t + x * 0.01, k);
      glow(P, lx, y + 5, 5, '#ffb060', 0.14);
    }
    // (A shimmer on the bell as it swings.)
    P.fx(bx - 1, byb - 6, '#ffe8a0', 0.7);
  },
};

PIECES.sun_wheel = {
  h: 96,
  paint(P, t) {
    const H = 96;
    const by = H - 24;
    const adobe = '#c4623c';
    // The kiva: a round drum of red adobe, sunk a little, its roof flat.
    roundWall(P, CX, by - 8, 20, 12, 10, 3, adobe, { joints: 22, course: 10, seed: 41, top: '#d8784e' });
    // A band of white zigzag round it.
    for (let x = CX - 20; x <= CX + 20; x++) {
      const yf = edge(CX, by - 8, 20, 12, x);
      if (yf === null) continue;
      const y = Math.floor(yf) + 4 + (Math.abs((Math.floor(x) % 6) - 3) > 1 ? 1 : 0);
      P.set(x, y, P.tone('#f0e8d8', 0.7, x, y));
      P.set(x, y + 3, P.tone('#1e1e24', 0.4, x, y + 3));
    }
    // The hatch, and the ladder up out of it.
    P.rect(CX - 5, by - 12, 10, 4, hex('#3a2014'));
    for (const dx of [-3, 3]) P.line(CX + dx, by - 10, CX + dx - 2, by - 28, '#8a6a3a');
    for (let k = 0; k < 5; k++) P.line(CX - 3 - k * 0.4, by - 13 - k * 3.5, CX + 3 - k * 0.4, by - 13 - k * 3.5, '#a8844a');
    // The pole and the wheel on it.
    P.tube(CX + 9, by - 10, CX + 9, 24, 1.2, 1, '#6a3a24');
    outlineSel(P.p);
    const wx = CX + 9;
    const wy = 20;
    const R = 13;
    // (An eighth of a turn a loop: its spokes and rim come round to where
    // they began.)
    const turn = TAU * t / 8;
    // (Its rim: turquoise and gold in turn.)
    for (let i = 0; i < 80; i++) {
      const a = (i / 80) * TAU + turn;
      const c = Math.floor((i / 80) * 16) % 2 ? '#2ab0a8' : '#e0b040';
      P.fx(wx + Math.cos(a) * R, wy + Math.sin(a) * R * 0.95, c, 1);
      P.fx(wx + Math.cos(a) * (R - 1), wy + Math.sin(a) * (R - 1) * 0.95, c, 0.8);
    }
    // Its spokes, turning.
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU + turn;
      for (let r = 4; r < R - 1; r += 0.5) P.fx(wx + Math.cos(a) * r, wy + Math.sin(a) * r * 0.95, i % 2 ? '#1e1e24' : '#e0704a', 0.95);
    }
    // The sun at its heart.
    P.blob(wx, wy, 3.6, 3.6, '#f0c040', { lift: 0.15 });
    glow(P, wx, wy, 9, '#ffd060', 0.12);
    // Feathers hung from the rim, fluttering.
    for (let i = 0; i < 4; i++) {
      const a = Math.PI * 0.25 + (i / 4) * Math.PI * 0.5;
      const fx0 = wx + Math.cos(a) * R;
      const fy0 = wy + Math.sin(a) * R * 0.95;
      const fl = Math.sin(TAU * (t * 2 + i * 0.3)) * 1.5;
      for (let k = 0; k < 6; k++) P.fx(fx0 + fl * (k / 6), fy0 + 1 + k, k > 3 ? '#1e1e24' : '#f4f0e8', 1);
    }
    // Smoke from the hatch.
    for (let k = 0; k < 16; k++) {
      const ph = frac(t + k / 16);
      P.fx(CX - 1 + Math.sin(TAU * ph + k) * (ph * 4), by - 14 - ph * 34, '#c8c0b8', 0.4 * (1 - ph));
    }
  },
};

// ------------------------------------------------------------ the isles
PIECES.jaw_arch = {
  h: 104,
  paint(P, t) {
    const H = 104;
    const by = H - 24;
    roundWall(P, CX, by - 2, 22, 13, 4, 3, '#8a8a86', { joints: 12, course: 2, seed: 51, top: '#a4a49e' });
    const bone = '#e8e0cc';
    // The two jawbones, each a long curved tube from its foot up to the
    // point where they meet.
    const apexY = 16;
    for (const s of [-1, 1]) {
      const pts = [];
      for (let i = 0; i <= 10; i++) {
        const k = i / 10;
        const x = CX + s * (18 * Math.cos(k * Math.PI * 0.5) ** 0.8 + 0.5);
        const y = by - 4 - (by - 4 - apexY) * Math.sin(k * Math.PI * 0.5);
        pts.push([x, y, 3.4 - k * 1.6]);
      }
      P.limb(pts, bone, { amb: 0.35 });
      // Scrimshaw: a scored line down its length, a little ship on it.
      for (let i = 2; i < 8; i++) P.set(pts[i][0] - s, pts[i][1] + 1, hex('#5a4a3a'));
      P.set(pts[4][0], pts[4][1] - 1, hex('#3a2a2a'));
    }
    // Ribs leaned against the foot, to either side.
    for (const s of [-1, 1]) for (let r = 0; r < 3; r++) {
      const x0 = CX + s * (8 + r * 4);
      P.tube(x0, by + 2, x0 + s * 3, by - 12 + r * 2, 1.2, 0.8, '#d8d0bc');
    }
    outlineSel(P.p);
    // The lamps swinging from the apex on chains.
    for (const [dx, len, ph] of [[-3, 12, 0], [3, 16, 0.5]]) {
      const sw = Math.sin(TAU * (t + ph)) * 2;
      const lx = CX + dx + sw;
      const ly = apexY + len;
      P.line(CX + dx * 0.3, apexY + 2, lx, ly - 3, '#4a4a48');
      P.blob(lx, ly, 2.4, 2, '#8a6a3a', { flat: 0.6 });
      fire(P, lx, ly - 1, 3, 5, t * 2 + ph, { n: 1, seed: 5, sparks: 0 });
      glow(P, lx, ly - 2, 6, '#ffc060', 0.16);
    }
  },
};

PIECES.salt_obelisk = {
  h: 112,
  paint(P, t) {
    const H = 112;
    const by = H - 24;
    roundWall(P, CX, by - 6, 22, 14, 6, 3, '#f2eee6', { joints: 16, seed: 61, top: '#ffffff' });
    water(P, CX, by - 6, 19, 11, t, { rings: 3, col: '#e890a8', glint: '#fff0f8' });
    // The flamingo, wading, its head going down to the water and up.
    const fx0 = CX - 11;
    const fy0 = by - 6;
    P.line(fx0, fy0, fx0, fy0 - 9, '#e06a7a');
    P.line(fx0 + 1, fy0, fx0 + 2, fy0 - 5, '#e06a7a');
    P.blob(fx0 + 1, fy0 - 11, 3.2, 2.2, '#f490a4');
    const dip = Math.max(0, Math.sin(TAU * t)) * 6;
    const hx = fx0 - 3;
    const hy = fy0 - 19 + dip;
    P.line(fx0, fy0 - 12, hx, hy + 2, '#f490a4');
    P.line(fx0 + 1, fy0 - 12, hx + 1, hy + 2, '#e8809a');
    P.blob(hx, hy, 1.4, 1.2, '#f490a4');
    P.set(hx - 2, hy + 1, hex('#1e1e24'));
    P.set(hx - 1, hy + 1, hex('#f0e8d8'));
    // The obelisk: a tall four-sided spire of salt crystal, one face lit,
    // one in shade, faceted.
    const base = by - 8;
    const top = 6;
    P.poly([[CX - 7, base], [CX - 3, top + 10], [CX, top], [CX, base + 2]], '#f4f4f8', { lv: 0.82, grad: [-0.2, -0.8], contrast: 0.3 });
    P.poly([[CX, base + 2], [CX, top], [CX + 3, top + 10], [CX + 7, base]], '#d8dce8', { lv: 0.45, grad: [0.2, -0.8], contrast: 0.3 });
    // Crystal facets: little bright and dark chips across it.
    for (let i = 0; i < 22; i++) {
      const y = top + 8 + hash2(i, 1, 62) * (base - top - 10);
      const k = (y - top) / (base - top);
      const x = CX + (hash2(i, 2, 62) - 0.5) * 2 * (2 + k * 5);
      P.set(x, y, hex(hash2(i, 3, 62) < 0.5 ? '#ffffff' : '#c0c8d8'));
    }
    outlineSel(P.p);
    // Glitter running up it.
    for (let i = 0; i < 5; i++) {
      const k = frac(t + i / 5);
      const y = base - k * (base - top - 4);
      const w = 2 + (1 - k) * 5;
      const x = CX + Math.sin(i * 2.3) * w * 0.6;
      P.fx(x, y, '#ffffff', 1 - k * 0.5);
      P.fx(x - 1, y, '#e8f8ff', 0.5);
      P.fx(x + 1, y, '#e8f8ff', 0.5);
      P.fx(x, y - 1, '#e8f8ff', 0.5);
    }
    glow(P, CX, top + 4, 6, '#ffffff', 0.12);
  },
};

PIECES.lantern_tree = {
  h: 118,
  paint(P, t) {
    const H = 118;
    const by = H - 24;
    // The mound, mossy.
    for (let y = by - 8; y <= by + 6; y++) {
      for (let x = CX - 22; x <= CX + 22; x++) {
        if (!inside(CX, by - 1, 22, 8, x, y) || y < by - 6 + Math.abs(x - CX) * 0.12) continue;
        const h = hash2(x, y, 71);
        P.set(x, y, P.tone(h < 0.15 ? '#8a6a48' : '#4a7a3a', 0.4 + (1 - (y - by + 8) / 14) * 0.3 + h * 0.1, x, y));
      }
    }
    // The trunk and its roots: gnarled, twisting.
    const bark = '#5a4430';
    for (const [x1, y1] of [[-18, 4], [-10, 6], [12, 5], [19, 2]]) P.limb([[CX, by - 6, 3], [CX + x1 * 0.5, by - 2 + y1 * 0.5, 2], [CX + x1, by + y1, 1]], bark);
    P.limb([[CX + 1, by - 4, 5], [CX - 2, by - 22, 4.2], [CX + 2, by - 40, 3.6], [CX - 1, by - 54, 3]], bark);
    P.limb([[CX - 1, by - 40, 2.6], [CX - 12, by - 52, 1.8], [CX - 17, by - 60, 1]], bark);
    P.limb([[CX + 2, by - 36, 2.6], [CX + 13, by - 48, 1.8], [CX + 19, by - 54, 1]], bark);
    // A round door in the trunk's foot, lit within.
    P.blob(CX, by - 10, 2.6, 3.4, '#2a1a10', { amb: 0.9 });
    P.fx(CX, by - 9, '#ffb060', 0.6);
    // The canopy: dark clumps of leaves.
    for (const [dx, dy, r] of [[-14, -62, 8], [14, -58, 8], [0, -70, 10], [-8, -56, 7], [8, -66, 8], [-20, -54, 5], [20, -50, 5]]) P.blob(CX + dx, by + dy, r, r * 0.75, '#2e5a3a', { amb: 0.3 });
    outlineSel(P.p);
    // The lantern pods, hung on threads, swaying, glowing.
    for (let i = 0; i < 11; i++) {
      const ax = CX + (hash2(i, 1, 72) - 0.5) * 42;
      const ay = by - 52 - hash2(i, 2, 72) * 16;
      const len = 4 + hash2(i, 3, 72) * 9;
      const sw = Math.sin(TAU * (t + hash2(i, 4, 72))) * 1.4;
      const px = ax + sw;
      const py = ay + len;
      P.line(ax, ay, px, py - 2, '#3a3020');
      const pulse = 0.5 + 0.5 * Math.sin(TAU * (t * 2 + i * 0.37));
      P.blob(px, py, 1.6, 2.2, mix(hex('#e0a030'), hex('#fff0a0'), pulse), { amb: 0.8 });
      glow(P, px, py, 5, '#ffd070', 0.1 + pulse * 0.08);
    }
    // Moths about the light.
    for (let i = 0; i < 4; i++) {
      const a = TAU * (t + i / 4) * (i % 2 ? 1 : -1);
      const x = CX + Math.cos(a) * (10 + i * 3);
      const y = by - 50 + Math.sin(a * 2) * 8 - i * 3;
      const flap = (Math.floor(t * 24) + i) % 2;
      P.fx(x, y, '#e8dcc0', 0.9);
      P.fx(x - 1, y - flap, '#d8ccb0', 0.8);
      P.fx(x + 1, y - flap, '#d8ccb0', 0.8);
    }
  },
};

PIECES.stone_ring = {
  h: 88,
  paint(P, t) {
    const H = 88;
    const by = H - 24;
    // Grass worn to a ring round it.
    for (let y = by - 16; y <= by + 10; y++) {
      for (let x = CX - 23; x <= CX + 23; x++) {
        if (!inside(CX, by - 3, 23, 13, x, y) || inside(CX, by - 3, 18, 9, x, y)) continue;
        P.set(x, y, P.tone('#7a6a4a', 0.45 + hash2(x, y, 81) * 0.15, x, y));
      }
    }
    const stones = [];
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * TAU + 0.2;
      stones.push({ i, x: CX + Math.cos(a) * 20, y: by - 3 + Math.sin(a) * 12, h: 14 + hash2(i, 1, 82) * 10 });
    }
    stones.sort((a, b) => a.y - b.y);
    const runeAt = Math.floor(t * 7);
    const draw = (s) => {
      const w = 3 + hash2(s.i, 2, 82);
      P.poly([[s.x - w, s.y + 1], [s.x - w + 1, s.y - s.h + 2], [s.x - 1, s.y - s.h], [s.x + w - 0.5, s.y - s.h + 3], [s.x + w, s.y + 1]], '#7a7a74', { lv: 0.6 });
      // Lichen.
      for (let k = 0; k < 3; k++) P.set(s.x - w + 1 + hash2(s.i, k, 83) * w * 2, s.y - hash2(s.i, k, 84) * s.h, hex('#a8b058'));
      // Its rune: lit in turn.
      const lit = s.i === runeAt || s.i === (runeAt + 3) % 7;
      const c = lit ? '#a8f0ff' : '#3a3a40';
      const ry = s.y - s.h * 0.55;
      P.set(s.x, ry - 2, hex(c));
      P.set(s.x, ry - 1, hex(c));
      P.set(s.x, ry, hex(c));
      P.set(s.x + 1, ry - 2 + (s.i % 3), hex(c));
      P.set(s.x - 1, ry - (s.i % 2), hex(c));
      return lit ? [s.x, ry - 1] : null;
    };
    const lights = [];
    for (const s of stones) if (s.y < by - 3) lights.push(draw(s));
    // The altar stone in the middle.
    P.poly([[CX - 8, by - 2], [CX - 7, by - 6], [CX + 7, by - 7], [CX + 8, by - 2]], '#8a8a84', { lv: 0.6 });
    P.poly([[CX - 7, by - 6], [CX + 7, by - 7], [CX + 5, by - 9], [CX - 6, by - 8]], '#a4a49e', { lv: 0.8 });
    for (const s of stones) if (s.y >= by - 3) lights.push(draw(s));
    outlineSel(P.p);
    for (const l of lights) if (l) glow(P, l[0], l[1], 5, '#80e0ff', 0.25);
    // The aurora: curtains of green and violet light rippling over the
    // ring, bright along their lower hems and fading upward.
    for (let x = 4; x < 44; x++) {
      for (let b = 0; b < 2; b++) {
        const hem = 16 + b * 5 + Math.sin(TAU * t + x * 0.22 + b * 2) * 3;
        const len = 7 + Math.sin(TAU * t + x * 0.4 + b) * 2;
        const k0 = 0.5 + 0.5 * Math.sin(x * 0.35 + b * 1.7 + TAU * t);
        for (let k = 0; k < len; k++) {
          const c = k === 0 ? (b ? '#f0d0ff' : '#d0ffe8') : b ? '#c090ff' : '#70ffb0';
          P.fx(x, hem - k, c, (k === 0 ? 0.5 : 0.22 * (1 - k / len)) * k0);
        }
      }
    }
  },
};

PIECES.beacon = {
  h: 124,
  paint(P, t, st) {
    const H = 124;
    const by = H - 24;
    // The tower: drystone, round, tapering, in courses.
    for (let k = 0; k < 8; k++) {
      const r = 15 - k * 0.8;
      roundWall(P, CX, by - 4 - k * 9, r, r * 0.6, 9, 2, '#8a8a86', { joints: 10, course: 3, seed: 91 + k, top: '#9a9a94', hollow: false });
    }
    const top = by - 4 - 8 * 9 + 9;
    // A door at its foot, and a slit window.
    P.rect(CX - 3, by - 6, 6, 8, hex('#2a2420'));
    P.rect(CX - 1, by - 40, 2, 5, hex('#2a2420'));
    // A bell hung off an iron arm.
    P.line(CX + 8, top + 8, CX + 14, top + 8, '#3a3a40');
    const sw = Math.sin(TAU * t) * 0.6;
    P.blob(CX + 14 + sw, top + 12, 2.4, 2.6, '#b07a34');
    // The iron basket on top.
    for (let x = CX - 8; x <= CX + 8; x++) {
      const yf = edge(CX, top - 2, 8, 3, x);
      if (yf === null) continue;
      for (let y = Math.floor(yf) - 4; y <= Math.floor(yf); y++) if ((x + y) % 3 === 0 || y === Math.floor(yf)) P.set(x, y, P.tone('#3a3a40', 0.5 - (x - CX) * 0.03, x, y));
    }
    outlineSel(P.p);
    if (st) {
      glow(P, CX, top - 18, 22, '#ffa040', 0.16);
      fire(P, CX, top - 3, 18, 30, t, { n: 5, seed: 13, sparks: 10 });
      // Smoke, blown off to one side.
      for (let k = 0; k < 18; k++) {
        const ph = frac(t * 0.5 + k / 18);
        P.fx(CX + ph * 18 + Math.sin(TAU * ph + k) * 2, top - 30 - ph * 20, '#6a6a6a', 0.35 * (1 - ph));
      }
    } else {
      for (let x = CX - 6; x <= CX + 6; x++) P.set(x, top - 4, hex(x % 2 ? '#3a2a24' : '#5a5050'));
    }
  },
};

addPieces(PIECES);
export const FAR_PIECE_NAMES = Object.keys(PIECES);
