// What the far lands' peoples build with, drawn (round 68: see
// world/farlands.js and world/blocks.js), and the dishes of their tables
// as icons. Hooked into textures.js (cube faces) and sprites.js (icons)
// after the Dagoni Islands' own (isleart.js).
//   Each material drawn as what it is: travertine with its pits and warm
// banding; barrel tiles in rows of round backs and channels; a marble
// column's flutes; logs frosted along their tops; living turf over birch
// bark; red lacquer with its gloss; paper in a wooden lattice; green glaze;
// split bamboo with its nodes; red adobe with straw in it; a mosaic of
// turquoise; whalebone; sparkling salt brick; blue glaze; cob; drystone
// without a lick of mortar; thatch roped and weighted against the gales.
import { Px, hex, shade, mix } from './pixel.js';
import { speckle, frontify } from './textures.js';
import { LH } from '../config.js';

export const FAR_P = {
  travertine: ['#e2d6bc', '#cbbd9e', '#f0e8d4', '#a8987a'],
  roof_terracotta: ['#c45a34', '#9a3e22', '#e07a4a', '#5a2012'],
  marble_column: ['#ece8e0', '#d2ccc2', '#ffffff', '#aaa298'],
  log_frost: ['#3a3438', '#2a2428', '#4a4448', '#dce8f4'],
  roof_turf: ['#5a8a3a', '#467430', '#72a24c', '#33521f'],
  planks_lacquer: ['#a8202a', '#78141c', '#d24a44', '#e0b040'],
  paper_wall: ['#f4ecd8', '#e4d8bc', '#fffaf0', '#5a3a22'],
  roof_jade: ['#2e9a62', '#1e6e44', '#64cc92', '#0e3e24'],
  bamboo: ['#c8b060', '#a08a40', '#e2cf84', '#6e5e2a'],
  adobe_red: ['#c4623c', '#a64c2c', '#d8784e', '#7e3820'],
  turquoise_tile: ['#2ab0a8', '#1a7a7a', '#7ae0d0', '#1e1e24'],
  whalebone: ['#e8e0cc', '#cec4ac', '#f8f4e8', '#9a8e76'],
  salt_brick: ['#f2eee6', '#dcd6cc', '#ffffff', '#bcb4a8'],
  tile_blue: ['#3a7ab8', '#285a90', '#6eaae0', '#16365c'],
  cob: ['#a8845a', '#8c6a44', '#c09a6a', '#644a2e'],
  drystone: ['#8a8a86', '#6e6e6a', '#a4a49e', '#2e2e2c'],
  roof_rope: ['#a8925a', '#8a7442', '#c4ac72', '#5a4a2e'],
};

// A roof's top by which way its slope faces (0: toward you and lit, 2:
// away, in shadow; 1: along the ridge, its cap across the middle).
function roofTone(p, rot, pal) {
  if (rot === 2) p.tint(0.8);
  else if (rot === 1 || rot === 3) p.tint(0.94);
  if (rot === 1) {
    p.rect(0, 6, 16, 4, shade(pal[1], 0.92));
    p.hline(0, 15, 6, shade(pal[2], 0.95));
    p.hline(0, 15, 9, shade(pal[3], 1));
  }
  return p;
}

// Travertine: warm cream stone laid in long courses, pitted, with a faint
// banding running along each block.
function travertine(p, rand, v, h) {
  const pal = FAR_P.travertine;
  for (let y = 0; y < h; y++) {
    const row = Math.floor(y / 6);
    const off = row % 2 ? 6 : 0;
    for (let x = 0; x < 16; x++) {
      const bx = (x + off) % 12;
      const band = (y + Math.floor((x + off) / 12) * 2 + v) % 3 === 0;
      let c = band ? mix(pal[0], pal[1], 0.4) : pal[0];
      if (rand() < 0.08) c = pal[2];
      if (y % 6 === 5 || bx === 11) c = pal[3];
      else if (y % 6 === 0 || bx === 0) c = mix(c, pal[2], 0.5);
      p.set(x, y, c);
    }
  }
  // (Its pits: little dark holes, a lit lip under each.)
  for (let i = 0; i < 6; i++) {
    const x = Math.floor(rand() * 15);
    const y = Math.floor(rand() * (h - 1));
    if (y % 6 === 5) continue;
    p.set(x, y, shade(pal[3], 0.85));
    if (rand() < 0.5) p.set(x + 1, y, shade(pal[3], 1.05));
    p.set(x, y + 1, pal[2]);
  }
  return p;
}

// Barrel tiles: half-round tiles in long runs down the roof, the round
// backs (lit down their crowns) alternating with the channels between.
function barrels(p, pal, rand, v, h, w = 4) {
  for (let x = 0; x < 16; x++) {
    const k = x % w;
    const crown = k === 1;
    for (let y = 0; y < h; y++) {
      let c = k === 0 ? pal[3] : crown ? pal[2] : k === w - 1 ? pal[1] : pal[0];
      // (Each tile overlapping the one below: a dark line every few rows.)
      const step = (y + Math.floor(x / w) * 2 + v) % 5;
      if (step === 4 && k !== 0) c = shade(hex(c), 0.78);
      if (step === 0 && k !== 0) c = shade(hex(c), 1.08);
      if (rand() < 0.05) c = shade(hex(c), 0.9);
      p.set(x, y, c);
    }
  }
  return p;
}

// A fluted column's face: its flutes (shadowed hollows between lit
// ridges), a band of capital at the top, a base at the foot.
function flutes(p, rand, h) {
  const pal = FAR_P.marble_column;
  for (let x = 0; x < 16; x++) {
    // (Round: lit on the left, shaded to the right.)
    const u = (x + 0.5) / 16;
    const lv = 1.08 - u * 0.36;
    const k = x % 3;
    for (let y = 0; y < h; y++) {
      let c = k === 0 ? pal[3] : k === 1 ? pal[2] : pal[0];
      c = shade(hex(c), lv);
      if (rand() < 0.04) c = shade(hex(pal[1]), lv);
      p.set(x, y, c);
    }
  }
  // (Faint grey veins.)
  for (let i = 0; i < 2; i++) {
    let x = Math.floor(rand() * 16);
    for (let y = 0; y < h; y++) {
      if (rand() < 0.3) x += rand() < 0.5 ? -1 : 1;
      if (rand() < 0.6) p.set(x, y, shade(hex(FAR_P.marble_column[1]), 0.92));
    }
  }
  return p;
}

// Logs laid one on another, frost gathered along the top of each.
function frostLogs(p, rand, v, h) {
  const pal = FAR_P.log_frost;
  const logH = 4;
  for (let y = 0; y < h; y++) {
    const i = y % logH;
    for (let x = 0; x < 16; x++) {
      let c = i === 0 ? pal[2] : i === logH - 1 ? pal[1] : pal[0];
      if (rand() < 0.12) c = shade(hex(c), 0.85);
      if (i === 1 && rand() < 0.08) c = pal[2];
      p.set(x, y, c);
    }
    // Frost along the top of the log, thick in places.
    if (i === 0) for (let x = 0; x < 16; x++) if (rand() < 0.62) p.set(x, y, rand() < 0.3 ? '#ffffff' : pal[3]);
  }
  // (The ends of the logs at the corner notch, cut and frosted.)
  if (v % 2 === 0) {
    for (let r = 0; r * logH < h; r++) {
      const y = r * logH + 1;
      p.set(1, y, '#8a6a4a');
      p.set(2, y, '#a8845a');
      p.set(1, y + 1, '#6a4a32');
      p.set(2, y + 1, '#8a6a4a');
    }
  }
  return p;
}

// Living turf: grass over the roof, a flower or two in it.
function turf(p, rand, v) {
  const pal = FAR_P.roof_turf;
  speckle(p, pal, rand, 0.4);
  for (let i = 0; i < 12; i++) {
    const x = Math.floor(rand() * 16);
    const y = Math.floor(rand() * 15);
    p.set(x, y, pal[2]);
    p.set(x, y + 1, pal[3]);
  }
  const fl = ['#f0e070', '#f8f8f0', '#d070c0', '#70a0f0'];
  for (let i = 0; i < 2 + (v % 2); i++) p.set(Math.floor(rand() * 16), Math.floor(rand() * 16), fl[(v + i) % fl.length]);
  return p;
}

// Lacquered boards standing side by side, deep red, each with a long
// gleam where the light catches the lacquer.
function lacquer(p, rand, v, h, bands = true) {
  const pal = FAR_P.planks_lacquer;
  for (let x = 0; x < 16; x++) {
    const k = x % 4;
    for (let y = 0; y < h; y++) {
      let c = k === 3 ? pal[1] : pal[0];
      if (k === 1 && (y + v) % 7 > 1) c = mix(pal[0], pal[2], 0.55);
      if (rand() < 0.03) c = pal[2];
      p.set(x, y, c);
    }
  }
  // (Gilt bands near the top and foot.)
  if (bands) for (const y of [1, h - 3]) for (let x = 0; x < 16; x++) p.set(x, y, x % 4 === 3 ? shade(hex(pal[3]), 0.7) : pal[3]);
  return p;
}

// Paper in a lattice of dark wood: four panes, each glowing faintly
// (the paper's own warmth), the frame round them.
function paper(p, rand, v, h) {
  const pal = FAR_P.paper_wall;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < 16; x++) {
      let c = rand() < 0.1 ? pal[1] : pal[0];
      if ((x + y * 3) % 11 === 0) c = pal[2];
      p.set(x, y, c);
    }
  }
  const frame = pal[3];
  p.rect(0, 0, 16, 1, frame);
  p.rect(0, h - 1, 16, 1, frame);
  p.rect(0, 0, 1, h, frame);
  p.rect(15, 0, 1, h, frame);
  p.vline(8, 0, h - 1, frame);
  for (let y = 4; y < h - 1; y += 4) p.hline(1, 14, y, shade(hex(frame), 1.2));
  p.vline(4, 1, h - 2, shade(hex(frame), 1.25));
  p.vline(12, 1, h - 2, shade(hex(frame), 1.25));
  return p;
}

// Split bamboo laid side by side: pale strips, each with its nodes.
function bambooBoards(p, rand, v, h) {
  const pal = FAR_P.bamboo;
  for (let x = 0; x < 16; x++) {
    const k = x % 3;
    const node = (Math.floor(x / 3) * 5 + v * 3) % 7;
    for (let y = 0; y < h; y++) {
      let c = k === 0 ? pal[2] : k === 2 ? pal[1] : pal[0];
      if ((y + node) % 7 === 0) c = pal[3];
      else if ((y + node) % 7 === 1) c = shade(hex(c), 1.08);
      p.set(x, y, c);
    }
  }
  return p;
}

// Adobe: smooth, hand-laid, straw in it; a little darker toward its foot.
function adobe(p, rand, v, h, foot) {
  const pal = FAR_P.adobe_red;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < 16; x++) {
      const r = rand();
      let c = r < 0.1 ? pal[1] : r > 0.94 ? pal[2] : pal[0];
      if ((x * 3 + y * 7 + v) % 13 === 0) c = mix(pal[0], pal[2], 0.5);
      if (foot && y >= h - 2) c = shade(hex(c), 0.86);
      p.set(x, y, c);
    }
  }
  for (let i = 0; i < 5; i++) {
    const x = Math.floor(rand() * 14);
    const y = Math.floor(rand() * h);
    p.set(x, y, '#e0b070');
    p.set(x + 1, y, '#c89858');
  }
  return p;
}

// A mosaic: turquoise chips, set in black, with a stepped zig-zag of
// white and coral through it.
function mosaic(p, rand, v, h) {
  const pal = FAR_P.turquoise_tile;
  p.fill(pal[3]);
  for (let y = 0; y < h; y += 2) {
    for (let x = (y / 2) % 2; x < 16; x += 2) {
      const zig = Math.abs(((x + v * 3) % 8) - 4) + 4;
      const onZig = Math.floor(y / 2) % 6 === Math.floor(zig / 2) % 6;
      const c = onZig ? ((x >> 1) % 2 ? '#f4f0e8' : '#e0704a') : rand() < 0.3 ? pal[1] : rand() < 0.25 ? pal[2] : pal[0];
      p.set(x, y, c);
      p.set(x + 1, y, shade(hex(c), 0.9));
      if (y + 1 < h) p.set(x, y + 1, shade(hex(c), 0.85));
    }
  }
  return p;
}

// Whalebone: long ribs curving across, porous, yellowed in their hollows.
function bone(p, rand, v, h) {
  const pal = FAR_P.whalebone;
  p.fill(pal[3]);
  for (let r = 0; r < 4; r++) {
    const y0 = r * 4 + ((v + r) % 2);
    for (let x = 0; x < 16; x++) {
      const bow = Math.round(Math.sin((x / 16) * Math.PI) * 1.2);
      for (let k = 0; k < 3; k++) {
        const y = y0 + k - bow;
        if (y < 0 || y >= h) continue;
        const c = k === 0 ? pal[2] : k === 1 ? pal[0] : pal[1];
        p.set(x, y, rand() < 0.08 ? shade(hex(c), 0.88) : c);
      }
    }
  }
  if (h > 16) for (let y = 16; y < h; y++) for (let x = 0; x < 16; x++) p.set(x, y, p.get(x, y - 16));
  return p;
}

// Salt brick: white bricks, crystals glinting in them.
function saltBricks(p, rand, v, h) {
  const pal = FAR_P.salt_brick;
  for (let y = 0; y < h; y++) {
    const row = Math.floor(y / 4);
    const off = row % 2 ? 4 : 0;
    for (let x = 0; x < 16; x++) {
      const bx = (x + off) % 8;
      let c = pal[0];
      if (y % 4 === 3 || bx === 7) c = pal[3];
      else if (y % 4 === 0 || bx === 0) c = pal[2];
      else if (rand() < 0.12) c = pal[1];
      p.set(x, y, c);
    }
  }
  for (let i = 0; i < 4; i++) {
    const x = Math.floor(rand() * 16);
    const y = Math.floor(rand() * h);
    if (y % 4 === 3) continue;
    p.set(x, y, '#e8f8ff');
  }
  return p;
}

// Blue glaze: fish-scale tiles, each round at its foot, glossy.
function scales(p, pal, rand, v, h) {
  for (let y = 0; y < h; y++) {
    const row = Math.floor(y / 4);
    const off = row % 2 ? 2 : 0;
    for (let x = 0; x < 16; x++) {
      const tx = (x + off) % 4;
      const ty = y % 4;
      let c = pal[0];
      const edge = ty === 3 || (ty === 2 && (tx === 0 || tx === 3));
      if (edge) c = pal[3];
      else if (ty === 0 && tx === 1) c = pal[2];
      else if (tx === 3) c = pal[1];
      p.set(x, y, c);
    }
  }
  if (v % 2) p.set(5, 4, '#ffffff');
  return p;
}

// Cob: earth and straw, rounded and lumpy, finger-marked.
function cob(p, rand, v, h) {
  const pal = FAR_P.cob;
  speckle(p, pal, rand, 0.3);
  for (let i = 0; i < 6; i++) {
    const x = Math.floor(rand() * 13);
    const y = Math.floor(rand() * h);
    p.hline(x, x + 2, y, '#d8b880');
  }
  // (Lumps: lit tops, dark feet.)
  for (let i = 0; i < 4; i++) {
    const x = 1 + Math.floor(rand() * 12);
    const y = 1 + Math.floor(rand() * (h - 3));
    p.hline(x, x + 2, y, pal[2]);
    p.hline(x, x + 2, y + 2, pal[3]);
  }
  return p;
}

// Drystone: flat stones of all sizes stacked without mortar, the gaps
// between them dark, each lit along its top.
function drystone(p, rand, v, h) {
  const pal = FAR_P.drystone;
  p.fill(pal[3]);
  let y = 0;
  let row = 0;
  while (y < h) {
    const rh = 2 + Math.floor(((v * 7 + row * 5) % 3));
    let x = -Math.floor(((v + row) * 5) % 6);
    while (x < 16) {
      const w = 3 + Math.floor(rand() * 5);
      const tone = 0.86 + rand() * 0.24;
      for (let yy = y; yy < Math.min(h, y + rh); yy++) {
        for (let xx = Math.max(0, x); xx < Math.min(16, x + w - 1); xx++) {
          let c = shade(hex(pal[0]), tone);
          if (yy === y) c = shade(hex(pal[2]), tone);
          else if (yy === y + rh - 1) c = shade(hex(pal[1]), tone);
          if (rand() < 0.06) c = shade(hex('#8a9a6a'), tone);
          p.set(xx, yy, c);
        }
      }
      x += w;
    }
    y += rh + 1;
    row++;
  }
  return p;
}

// Thatch, with ropes run across it and weighted with stones.
function ropedThatch(p, rand, v, h) {
  const pal = FAR_P.roof_rope;
  p.fill(pal[0]);
  for (let i = 0; i < 46; i++) {
    const x = Math.floor(rand() * 16);
    const y = Math.floor(rand() * h);
    const len = 2 + Math.floor(rand() * 4);
    const c = rand() < 0.5 ? pal[1] : pal[2];
    for (let k = 0; k < len; k++) p.set(x, y + k, c);
  }
  // Ropes in a diamond net.
  for (let k = -16; k < 32; k += 6) {
    for (let x = 0; x < 16; x++) {
      const y1 = x + k + (v % 2) * 3;
      const y2 = -x + k + 15;
      if (y1 >= 0 && y1 < h) p.set(x, y1, pal[3]);
      if (y2 >= 0 && y2 < h) p.set(x, y2, shade(hex(pal[3]), 1.15));
    }
  }
  return p;
}

// ------------------------------------------------------------- cube tops
export function farTop(name, v, rand, rot = 0) {
  const p = new Px(16, 16);
  switch (name) {
    case 'travertine': return travertine(p, rand, v, 16);
    case 'roof_terracotta': return roofTone(barrels(p, FAR_P.roof_terracotta, rand, v, 16), rot, FAR_P.roof_terracotta);
    case 'roof_jade': {
      barrels(p, FAR_P.roof_jade, rand, v, 16);
      // (The glaze's gloss: a white glint on a crown now and then.)
      for (let x = 1; x < 16; x += 4) if ((x + v) % 3 === 0) p.set(x, 3 + (v % 9), '#e8fff0');
      return roofTone(p, rot, FAR_P.roof_jade);
    }
    case 'marble_column': {
      // The column's capital from above: a round abacus on a square slab.
      const pal = FAR_P.marble_column;
      p.fill(pal[1]);
      p.ellipse(8, 8, 7, 7, pal[0]);
      p.ellipse(7, 7, 4, 4, pal[2]);
      p.ellipse(8, 8, 2, 2, pal[0]);
      for (const [x, y] of [[0, 0], [15, 0], [0, 15], [15, 15]]) p.set(x, y, pal[3]);
      return p;
    }
    case 'log_frost': {
      frostLogs(p, rand, v, 16);
      // (Snow lying on top.)
      for (let x = 0; x < 16; x++) for (let y = 0; y < 16; y++) if (rand() < 0.45) p.set(x, y, rand() < 0.5 ? '#e8f0f8' : '#c8d4e4');
      return p;
    }
    case 'roof_turf': return roofTone(turf(p, rand, v), rot, FAR_P.roof_turf);
    case 'planks_lacquer': return lacquer(p, rand, v, 16, false);
    case 'paper_wall': {
      // The top rail of the screen: dark wood.
      const pal = FAR_P.paper_wall;
      p.fill(pal[3]);
      p.rect(0, 6, 16, 4, shade(hex(pal[3]), 1.3));
      p.hline(0, 15, 6, shade(hex(pal[3]), 1.6));
      return p;
    }
    case 'bamboo': return bambooBoards(p, rand, v, 16);
    case 'adobe_red': return adobe(p, rand, v, 16, false);
    case 'turquoise_tile': return mosaic(p, rand, v, 16);
    case 'whalebone': return bone(p, rand, v, 16);
    case 'salt_brick': return saltBricks(p, rand, v, 16);
    case 'tile_blue': return roofTone(scales(p, FAR_P.tile_blue, rand, v, 16), rot, FAR_P.tile_blue);
    case 'cob': return cob(p, rand, v, 16);
    case 'drystone': return drystone(p, rand, v, 16);
    case 'roof_rope': {
      ropedThatch(p, rand, v, 16);
      // A stone hung on the net here and there.
      const s = 3 + (v * 5) % 9;
      p.rect(s, 10, 3, 2, '#7a7a76');
      p.hline(s, s + 2, 10, '#9a9a94');
      return roofTone(p, rot, FAR_P.roof_rope);
    }
    default:
      return null;
  }
}

// ------------------------------------------------------------ cube fronts
export function farFront(name, v, rand) {
  const p = new Px(16, LH);
  switch (name) {
    case 'travertine': return frontify(travertine(p, rand, v, LH), 0.9);
    case 'roof_terracotta': case 'roof_jade': {
      // The eave: the round ends of the tiles over a fascia.
      const pal = FAR_P[name];
      p.fill(pal[1]);
      for (let x = 0; x < 16; x++) {
        const k = x % 4;
        p.set(x, 0, k === 0 ? pal[3] : k === 1 ? pal[2] : pal[0]);
        p.set(x, 1, k === 0 ? pal[3] : k === 1 ? pal[0] : pal[1]);
        p.set(x, 2, k === 0 ? pal[3] : pal[1]);
      }
      // (The jade roof's tile ends: round discs, each with a stamped boss.)
      if (name === 'roof_jade') for (let x = 1; x < 16; x += 4) p.set(x, 1, '#e8d070');
      const fascia = name === 'roof_jade' ? '#a8202a' : '#6a3a22';
      for (let y = 3; y < LH; y++) for (let x = 0; x < 16; x++) p.set(x, y, y === 3 ? shade(hex(fascia), 0.7) : (x + y) % 9 === 0 ? shade(hex(fascia), 1.2) : fascia);
      return frontify(p, 0.88);
    }
    case 'marble_column': {
      flutes(p, rand, LH);
      return frontify(p, 0.95);
    }
    case 'log_frost': return frontify(frostLogs(p, rand, v, LH), 0.9);
    case 'roof_turf': {
      // The turf's edge over the eave: grass hanging over, the birch bark
      // under it that keeps the wet out, the earth between.
      const pal = FAR_P.roof_turf;
      for (let x = 0; x < 16; x++) {
        const d = 2 + (rand() < 0.4 ? 1 : 0) + (rand() < 0.15 ? 2 : 0);
        for (let y = 0; y < LH; y++) {
          let c;
          if (y < d) c = y === d - 1 ? pal[1] : pal[0];
          else if (y < 7) c = rand() < 0.3 ? '#5a4030' : '#6e5038';
          else if (y < 9) c = (x + y) % 5 === 0 ? '#3a3430' : '#e8e2d4';
          else c = '#4a3a2a';
          p.set(x, y, c);
        }
      }
      return frontify(p, 0.86);
    }
    case 'planks_lacquer': return frontify(lacquer(p, rand, v, LH), 0.92);
    case 'paper_wall': return frontify(paper(p, rand, v, LH), 0.96);
    case 'bamboo': return frontify(bambooBoards(p, rand, v, LH), 0.88);
    case 'adobe_red': return frontify(adobe(p, rand, v, LH, true), 0.92);
    case 'turquoise_tile': return frontify(mosaic(p, rand, v, LH), 0.9);
    case 'whalebone': return frontify(bone(p, rand, v, LH), 0.92);
    case 'salt_brick': return frontify(saltBricks(p, rand, v, LH), 0.95);
    case 'tile_blue': {
      scales(p, FAR_P.tile_blue, rand, v, LH);
      p.rect(0, LH - 3, 16, 3, '#f2eee6');
      p.hline(0, 15, LH - 3, '#bcb4a8');
      return frontify(p, 0.9);
    }
    case 'cob': return frontify(cob(p, rand, v, LH), 0.9);
    case 'drystone': return frontify(drystone(p, rand, v, LH), 0.9);
    case 'roof_rope': {
      ropedThatch(p, rand, v, LH);
      p.rect(0, LH - 3, 16, 3, shade(hex(FAR_P.roof_rope[1]), 0.7));
      // Stones hung along the eave on their ropes.
      for (let x = 1 + (v % 3); x < 16; x += 5) {
        p.vline(x + 1, LH - 4, LH - 3, '#5a4a2e');
        p.rect(x, LH - 2, 3, 2, '#7a7a76');
        p.hline(x, x + 2, LH - 2, '#a4a49e');
      }
      return frontify(p, 0.85);
    }
    default:
      return null;
  }
}

// Roofs whose top is drawn by the way their slope faces.
export const FAR_ROT_TOP = ['roof_terracotta', 'roof_jade', 'roof_turf', 'tile_blue', 'roof_rope'];

// ------------------------------------------------------------------ icons
// The far peoples' dishes.
export function farIcon(key) {
  const p = new Px(16, 16);
  // A bowl of something hot (`top`: what's in it; bits on it).
  const bowl = (top, bits, rim = '#8a6a4a') => {
    p.ellipse(8, 10, 5, 3, rim);
    p.hline(4, 12, 11, shade(hex(rim), 0.7));
    p.hline(5, 11, 13, shade(hex(rim), 0.6));
    p.ellipse(8, 9, 4, 1, top);
    for (const [x, y, c] of bits) p.set(x, y, c);
    p.set(7, 6, '#e8e8f0');
    p.set(9, 5, '#d8d8e4');
  };
  // A cup (of tea) with steam.
  const cup = (body, tea, steam) => {
    p.rect(5, 8, 6, 6, body);
    p.hline(5, 10, 8, tea);
    p.vline(5, 8, 13, shade(hex(body), 1.15));
    p.rect(11, 9, 2, 3, shade(hex(body), 0.85));
    p.clear(12, 10);
    p.set(7, 6, steam);
    p.set(8, 4, steam);
    p.set(9, 5, steam);
  };
  switch (key) {
    case 'garum_stew': bowl('#b0703a', [[6, 9, '#e8d8b0'], [10, 9, '#5a8a3a'], [8, 8, '#f0e0c0']], '#c45a34'); break;
    case 'olive_bread':
      p.ellipse(8, 10, 6, 3, '#b8864a');
      p.ellipse(8, 9, 5, 2, '#d8a868');
      for (const [x, y] of [[5, 9], [8, 8], [11, 9]]) p.set(x, y, '#3a4a2a');
      p.ellipse(12, 5, 2, 2, '#6a2a5a');
      p.set(11, 4, '#9a5a8a');
      p.set(12, 3, '#3a5a2a');
      break;
    case 'reindeer_roast':
      p.ellipse(8, 10, 6, 3, '#d8d0c0');
      p.ellipse(8, 9, 4, 2, '#7a3a22');
      p.ellipse(7, 8, 2, 1, '#a85a3a');
      p.line(11, 8, 14, 5, '#f0e8d8');
      p.set(14, 4, '#f0e8d8');
      p.set(4, 9, '#c83040');
      p.set(5, 10, '#c83040');
      break;
    case 'cloudberry_cakes':
      p.ellipse(8, 11, 5, 2, '#d8b070');
      p.ellipse(8, 9, 5, 2, '#e8c888');
      for (const [x, y] of [[6, 8], [8, 7], [10, 8], [7, 9]]) {
        p.set(x, y, '#f0a030');
        p.set(x + 1, y, '#ffc860');
      }
      break;
    case 'dumplings':
      p.ellipse(8, 11, 6, 3, '#8a6a3a');
      p.hline(3, 13, 12, '#6a4a28');
      for (const [x, y] of [[5, 9], [10, 9], [8, 7]]) {
        p.ellipse(x, y, 2, 2, '#f4ece0');
        p.set(x, y - 2, '#d8ccbc');
        p.set(x - 1, y - 1, '#ffffff');
      }
      break;
    case 'jasmine_tea': cup('#3a8a5a', '#d8c870', '#f0f0f8'); p.set(7, 10, '#f8f8f0'); break;
    case 'chili_squash': bowl('#e0902a', [[6, 9, '#c82a1a'], [10, 8, '#c82a1a'], [8, 9, '#3a7a2a']], '#a64c2c'); break;
    case 'blue_corn_cakes':
      for (const [y, c] of [[12, '#3a3a6a'], [10, '#4a4a8a'], [8, '#5a5aa0']]) {
        p.ellipse(8, y, 5, 2, c);
        p.hline(5, 11, y - 1, shade(hex(c), 1.25));
      }
      p.set(8, 6, '#f0c040');
      break;
    case 'whale_stew': bowl('#6a4a3a', [[6, 9, '#3a2a2a'], [10, 9, '#e8e0cc'], [8, 8, '#8a6a4a']], '#7a7a74'); break;
    case 'oat_bannock':
      p.ellipse(8, 10, 6, 4, '#c8a068');
      p.line(2, 10, 14, 10, '#8a6a3a');
      p.line(8, 6, 8, 14, '#8a6a3a');
      p.ellipse(6, 8, 2, 1, '#e0bc84');
      break;
    case 'shrimp_soup': bowl('#f0a0a0', [[6, 9, '#e05a4a'], [10, 9, '#e05a4a'], [8, 8, '#ffffff']], '#3a7ab8'); break;
    case 'salt_fish':
      p.ellipse(8, 9, 6, 2, '#c8c0b0');
      p.ellipse(7, 8, 4, 1, '#e8e4dc');
      p.line(13, 9, 15, 7, '#a8a094');
      p.line(13, 9, 15, 11, '#a8a094');
      p.set(4, 8, '#2a2a2a');
      for (let i = 0; i < 4; i++) p.set(5 + i * 2, 10, '#ffffff');
      break;
    case 'root_stew': bowl('#7a5a3a', [[6, 9, '#c88a3a'], [10, 9, '#e0b070'], [8, 8, '#5a7a2a']], '#5a4a3a'); break;
    case 'glowberry_tart':
      p.ellipse(8, 11, 6, 2, '#a8783a');
      p.ellipse(8, 10, 5, 2, '#c89048');
      for (const [x, y] of [[6, 9], [9, 9], [8, 10], [11, 10], [5, 10]]) {
        p.set(x, y, '#60e0ff');
        p.set(x, y - 1, '#c8f8ff');
      }
      break;
    case 'seer_stew': bowl('#6a5a8a', [[6, 9, '#a88ad0'], [10, 9, '#3a7a5a'], [8, 8, '#e0d8f0']], '#5a5a54'); break;
    case 'heather_bread':
      p.ellipse(8, 10, 6, 3, '#9a7a5a');
      p.ellipse(8, 9, 5, 2, '#b89a72');
      for (const [x, y] of [[5, 8], [8, 8], [11, 9], [7, 9]]) p.set(x, y, '#a060c0');
      break;
    case 'fish_pie':
      p.ellipse(8, 11, 6, 3, '#8a6a3a');
      p.ellipse(8, 9, 6, 3, '#e0b868');
      p.line(4, 9, 12, 9, '#c89848');
      for (const x of [5, 8, 11]) p.set(x, 7, '#c89848');
      p.set(8, 6, '#a8c0d0');
      p.set(9, 5, '#a8c0d0');
      break;
    case 'seaweed_crisps':
      for (const [x, y] of [[4, 9], [8, 7], [11, 10], [7, 11]]) {
        p.rect(x, y, 3, 2, '#2a4a2a');
        p.set(x, y, '#4a7a3a');
        p.set(x + 2, y + 1, '#1a2a1a');
      }
      for (const [x, y] of [[6, 8], [10, 9], [9, 12]]) p.set(x, y, '#f8f8f0');
      break;
    default:
      return null;
  }
  return p.outline('#1a1420');
}
