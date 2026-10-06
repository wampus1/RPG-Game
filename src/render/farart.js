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
import { speckle, frontify, cobble, spr, OUT, TALL_H } from './textures.js';
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
  // The far lands' ground (see world/biomes.js).
  grass_gold: ['#c8a848', '#a88a34', '#e0c460', '#7a6a2a'],
  frost_grass: ['#9ab8c8', '#7a98aa', '#d8ecf8', '#ffffff'],
  red_rock: ['#b85a34', '#984628', '#d0744a', '#6a2e1a'],
  salt_crust: ['#f4f0ea', '#dcd6cc', '#ffffff', '#c8bcb8'],
  bone_sand: ['#e8dcc0', '#d0c4a6', '#f6eedc', '#a89a80'],
  heath: ['#7a6a88', '#5e5070', '#9a88a8', '#4a6a3a'],
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
    case 'grass_gold': {
      speckle(p, FAR_P.grass_gold, rand, 0.4);
      // Long dry stems lying every which way in the wind.
      for (let i = 0; i < 9; i++) {
        const x = Math.floor(rand() * 14);
        const y = Math.floor(rand() * 15);
        p.set(x, y, FAR_P.grass_gold[2]);
        p.set(x + 1, y + 1, FAR_P.grass_gold[2]);
        p.set(x + 2, y + 1, FAR_P.grass_gold[3]);
      }
      return p;
    }
    case 'frost_grass': {
      speckle(p, FAR_P.frost_grass, rand, 0.45);
      // Rime crystals, white, catching the light.
      for (let i = 0; i < 12; i++) p.set(Math.floor(rand() * 16), Math.floor(rand() * 16), rand() < 0.4 ? '#ffffff' : FAR_P.frost_grass[2]);
      return p;
    }
    case 'red_rock': {
      // Bedded red sandstone: bands, a crack or two.
      const pal = FAR_P.red_rock;
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        const band = (y + Math.floor(Math.sin((x + v * 5) * 0.4) * 1.5)) % 5;
        p.set(x, y, band === 0 ? pal[2] : band === 4 ? pal[1] : rand() < 0.1 ? pal[1] : pal[0]);
      }
      for (let i = 0; i < 2; i++) {
        let x = Math.floor(rand() * 16);
        for (let y = Math.floor(rand() * 8); y < 16; y++) {
          if (rand() < 0.3) x += rand() < 0.5 ? 1 : -1;
          if (rand() < 0.6) p.set(x, y, pal[3]);
        }
      }
      return p;
    }
    case 'salt_crust': {
      // Polygons of crust, their raised white rims.
      const pal = FAR_P.salt_crust;
      cobble(p, [pal[0], pal[3], pal[2]], rand, 6);
      for (let i = 0; i < 6; i++) p.set(Math.floor(rand() * 16), Math.floor(rand() * 16), '#ffffff');
      return p;
    }
    case 'bone_sand': {
      speckle(p, FAR_P.bone_sand, rand, 0.35);
      // Chips and splinters of bone, a shell.
      for (let i = 0; i < 4; i++) {
        const x = Math.floor(rand() * 14);
        const y = Math.floor(rand() * 15);
        p.hline(x, x + 1 + Math.floor(rand() * 2), y, '#fffaf0');
        p.set(x, y + 1, FAR_P.bone_sand[3]);
      }
      if (v % 3 === 0) p.set(3 + (v * 5) % 10, 8, '#f0b0a0');
      return p;
    }
    case 'heath': {
      speckle(p, FAR_P.heath, rand, 0.4);
      for (let i = 0; i < 10; i++) p.set(Math.floor(rand() * 16), Math.floor(rand() * 16), rand() < 0.5 ? '#b088d0' : FAR_P.heath[3]);
      return p;
    }
    case 'bamboo_stalk': {
      // A cut cane from above: a green ring round a pale hollow.
      p.ellipse(8, 8, 6, 6, '#4a8a36');
      p.ellipse(8, 8, 5, 5, '#6ab04a');
      p.ellipse(8, 8, 3, 3, '#e8e0b0');
      p.ellipse(8, 8, 2, 2, '#c8b880');
      return p;
    }
    case 'leaves_lantern': return lanternLeaves(p, rand, v, 16);
    default:
      return null;
  }
}

// Dark leaves hung thick with lantern pods, glowing amber.
function lanternLeaves(p, rand, v, h) {
  const pal = ['#2e5a3a', '#1e4028', '#447a4e'];
  p.fill(pal[1]);
  for (let i = 0; i < 9; i++) {
    const cx = rand() * 16;
    const cy = rand() * h;
    const r = 2 + rand() * 2;
    for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) {
      const d = Math.hypot(x - cx, y - cy);
      if (d > r) continue;
      p.set(((x % 16) + 16) % 16, y, -(x - cx + y - cy) / r > 0.4 ? pal[2] : pal[0]);
    }
  }
  for (let i = 0; i < 4; i++) {
    const x = 1 + Math.floor(rand() * 13);
    const y = 1 + Math.floor(rand() * (h - 3));
    p.set(x, y, '#ffd060');
    p.set(x, y + 1, '#f0a030');
    p.set(x + 1, y, '#fff0a0');
  }
  return p;
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
    case 'grass_gold': case 'frost_grass': case 'heath': {
      // The turf's edge: the grass over the dirt under it.
      const pal = FAR_P[name];
      speckle(p, ['#7a5a3a', '#5e4430', '#8a6a48'], rand, 0.3);
      for (let x = 0; x < 16; x++) {
        const d = 2 + (rand() < 0.4 ? 1 : 0) + (rand() < 0.15 ? 2 : 0);
        for (let y = 0; y < d; y++) p.set(x, y, y === d - 1 ? pal[1] : pal[0]);
        if (name === 'frost_grass' && rand() < 0.5) p.set(x, 0, '#ffffff');
      }
      return frontify(p, 0.9);
    }
    case 'red_rock': {
      const pal = FAR_P.red_rock;
      for (let y = 0; y < LH; y++) for (let x = 0; x < 16; x++) {
        const band = (y + v) % 4;
        p.set(x, y, band === 0 ? pal[2] : band === 3 ? pal[1] : rand() < 0.08 ? pal[3] : pal[0]);
      }
      return frontify(p, 0.85);
    }
    case 'salt_crust': {
      const pal = FAR_P.salt_crust;
      speckle(p, ['#d8c8b0', '#c8b498', '#e8dcc8'], rand, 0.3);
      for (let x = 0; x < 16; x++) for (let y = 0; y < 2 + (x % 3 === 0 ? 1 : 0); y++) p.set(x, y, y === 0 ? pal[2] : pal[0]);
      return frontify(p, 0.92);
    }
    case 'bone_sand': return frontify(speckle(p, FAR_P.bone_sand, rand, 0.35), 0.88);
    case 'bamboo_stalk': {
      // A cane's side: green, lit down its left, a node every few rows.
      for (let x = 0; x < 16; x++) {
        const u = Math.abs(x - 7.5) / 8;
        if (u > 0.9) continue;
        for (let y = 0; y < LH; y++) {
          let c = x < 6 ? '#8ed064' : x < 11 ? '#6ab04a' : '#4a8a36';
          if ((y + v * 3) % 8 === 0) c = '#c8d890';
          else if ((y + v * 3) % 8 === 1) c = shade(hex(c), 0.8);
          p.set(x, y, c);
        }
      }
      return p;
    }
    case 'leaves_lantern': return frontify(lanternLeaves(p, rand, v, LH), 0.82);
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

// ----------------------------------------------------------------- plants
// The far lands' plants (base: the ground line in a one-cell sprite).
export function farPlant(name, v, rand) {
  const p = spr();
  const base = 25;
  const blade = (x, h, c, lean = 0) => {
    for (let k = 0; k < h; k++) p.set(x + Math.round((k / h) * lean), base - k, c);
  };
  switch (name) {
    case 'vine': {
      // A vine on a stake, leaves, a bunch of purple grapes hanging.
      p.vline(8, base - 12, base, '#8a6a40');
      for (let k = 0; k < 12; k += 3) {
        p.set(7 + (k % 2 ? 2 : -1), base - k - 2, '#4a7a2a');
        p.set(6 + (k % 2 ? 4 : 0), base - k - 3, '#5a9a34');
      }
      for (const [dx, dy] of [[0, 0], [1, 0], [-1, 1], [0, 1], [1, 1], [0, 2]]) p.set(10 + dx, base - 9 + dy, dy === 0 && dx === 0 ? '#9a5ac0' : '#6a2a8a');
      if (v % 2) for (const [dx, dy] of [[0, 0], [1, 0], [0, 1]]) p.set(5 + dx, base - 6 + dy, '#7a3a9a');
      return p;
    }
    case 'ice_flower': {
      // Petals of clear ice on a frosted stem, glowing pale blue.
      const n = 1 + (v % 2);
      for (let i = 0; i < n; i++) {
        const x = 5 + Math.floor(rand() * 6);
        const h = 5 + Math.floor(rand() * 3);
        blade(x, h, '#a8c8d8');
        const y = base - h;
        for (const [dx, dy] of [[0, -2], [-2, 0], [2, 0], [0, 1], [-1, -1], [1, -1]]) p.set(x + dx, y + dy, '#c8f0ff');
        p.set(x, y, '#ffffff');
        p.set(x - 1, y + 1, '#88c8f0');
        p.set(x + 1, y + 1, '#88c8f0');
      }
      return p;
    }
    case 'peony': {
      for (let i = 0; i < 2; i++) {
        const x = 4 + i * 6 + Math.floor(rand() * 2);
        const h = 5 + Math.floor(rand() * 3);
        blade(x, h, '#3a6a2a');
        p.set(x - 1, base - 2, '#4a8a36');
        p.set(x + 1, base - 3, '#4a8a36');
        const y = base - h;
        const c = (v + i) % 2 ? '#f080a8' : '#ffffff';
        p.ellipse(x, y, 2, 2, c);
        p.set(x, y, '#ffd060');
        p.set(x - 1, y - 1, shade(hex(c), 1.1));
      }
      return p;
    }
    case 'prickly_pear': {
      // Flat green pads, spined, with red fruit on their rims.
      const pad = (x, y, rx, ry) => {
        p.ellipse(x, y, rx, ry, '#5a9a4a');
        p.set(x - 1, y - 1, '#7ab860');
        p.set(x + 1, y, '#e8e8c8');
        p.set(x - 1, y + 1, '#e8e8c8');
      };
      pad(8, base - 3, 3, 3);
      pad(5, base - 8, 2, 3);
      pad(11, base - 7, 2, 3);
      p.set(5, base - 12, '#d83a4a');
      p.set(11, base - 11, '#d83a4a');
      return p;
    }
    case 'sea_grass': {
      for (let i = 0; i < 6; i++) blade(2 + Math.floor(rand() * 12), 4 + Math.floor(rand() * 6), rand() < 0.5 ? '#8a9a5a' : '#a8b070', Math.floor(rand() * 5) - 2);
      return p;
    }
    case 'saltbush': {
      for (let i = 0; i < 14; i++) {
        const x = 3 + Math.floor(rand() * 10);
        const y = base - Math.floor(rand() * 6);
        p.set(x, y, rand() < 0.5 ? '#a0b0a0' : '#c0ccc0');
      }
      p.vline(8, base - 2, base, '#7a6a5a');
      for (let i = 0; i < 3; i++) p.set(4 + Math.floor(rand() * 8), base - 2 - Math.floor(rand() * 4), '#ffffff');
      return p;
    }
    case 'giant_fern': {
      // Fronds as long as a man is tall, arching out of a crown.
      for (const lean of [-6, -3, 0, 3, 6]) {
        for (let k = 0; k < 12; k++) {
          const t = k / 12;
          const x = 8 + Math.round(lean * t * 1.2);
          const y = base - Math.round(k * (1 - t * 0.35));
          p.set(x, y, '#3a7a3a');
          if (k > 2 && k % 2 === 0) {
            p.set(x - 1, y, '#5aa04a');
            p.set(x + 1, y, '#5aa04a');
          }
        }
      }
      return p;
    }
    case 'glowberry_bush': {
      p.ellipse(8, base - 3, 5, 3, '#2e5a3a');
      p.ellipse(7, base - 4, 3, 2, '#3e7448');
      for (const [x, y] of [[5, base - 4], [9, base - 2], [11, base - 4], [7, base - 1]]) {
        p.set(x, y, '#60e0ff');
        p.set(x, y - 1, '#c8f8ff');
      }
      return p;
    }
    case 'fairy_ring': {
      // A ring of little pale toadstools, glowing faintly.
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2;
        const x = Math.round(8 + Math.cos(a) * 6);
        const y = Math.round(base - 2 + Math.sin(a) * 2);
        p.set(x, y, '#e8e0d0');
        p.set(x, y - 1, i % 3 === 0 ? '#c8a8ff' : '#f0e8ff');
      }
      return p;
    }
    case 'thrift': {
      // Cushions of grassy leaves, pink pompom flowers on wiry stems.
      p.ellipse(8, base - 1, 5, 1, '#4a6a3a');
      for (let i = 0; i < 4; i++) {
        const x = 4 + Math.floor(rand() * 9);
        const h = 4 + Math.floor(rand() * 3);
        blade(x, h, '#6a7a4a');
        p.set(x, base - h, '#f088b0');
        p.set(x - 1, base - h, '#e070a0');
        p.set(x, base - h - 1, '#ffb0d0');
      }
      return p;
    }
    default:
      return null;
  }
}

// ---------------------------------------------------------------- sprites
export const FAR_SPRITES = {};
// A great whale's rib, curving up out of the sand, taller than a man.
FAR_SPRITES.whale_rib = (rot) => {
  const p = spr(TALL_H);
  const H = TALL_H;
  const dir = rot % 2 ? -1 : 1;
  for (let k = 0; k < 30; k++) {
    const t = k / 30;
    const x = 8 + dir * Math.round(Math.sin(t * Math.PI * 0.8) * 5 - 2);
    const y = H - 3 - k;
    const w = t < 0.8 ? 2 : 1;
    for (let i = 0; i < w; i++) p.set(x + i, y, i === 0 ? '#f6eedc' : '#d0c4a6');
  }
  p.set(8, H - 4, '#a89a80');
  p.ellipse(8, H - 2, 3, 1, '#c8bc9e');
  return p.outline(OUT);
};
// Clusters of white salt crystal, cubes on cubes.
FAR_SPRITES.salt_crystal = () => {
  const p = spr();
  for (const [x, y, s] of [[5, 24, 4], [10, 25, 3], [8, 20, 3], [12, 21, 2]]) {
    p.rect(x - s / 2, y - s, s, s, '#f4f4f8');
    p.hline(Math.round(x - s / 2), Math.round(x + s / 2) - 1, y - s, '#ffffff');
    p.vline(Math.round(x + s / 2) - 1, y - s, y - 1, '#c8ccd8');
  }
  p.set(8, 18, '#e8f8ff');
  return p.outline(OUT);
};
// A tall standing stone, lichened, a rune cut in it that glows faintly.
FAR_SPRITES.standing_stone = () => {
  const p = spr(TALL_H);
  const H = TALL_H;
  for (let y = H - 30; y < H - 1; y++) {
    const w = y < H - 26 ? 3 : 4;
    for (let x = 8 - w; x < 8 + w; x++) p.set(x, y, x < 7 ? '#8a8a84' : x < 9 ? '#7a7a74' : '#64645e');
  }
  for (const [x, y] of [[5, H - 20], [9, H - 12], [6, H - 7]]) p.set(x, y, '#a8b058');
  for (const [x, y] of [[7, H - 22], [7, H - 21], [7, H - 20], [8, H - 21], [6, H - 19]]) p.set(x, y, '#a8f0ff');
  return p.outline(OUT);
};
// A cairn: stones heaped by hand, one on another.
FAR_SPRITES.cairn = () => {
  const p = spr();
  for (const [x, y, rx, ry, c] of [[8, 24, 6, 2, '#7a7a76'], [7, 21, 5, 2, '#8a8a84'], [9, 18, 4, 2, '#7a7a74'], [8, 15, 3, 2, '#9a9a94'], [8, 12, 2, 1, '#8a8a84']]) {
    p.ellipse(x, y, rx, ry, c);
    p.hline(x - rx + 1, x, y - ry, '#b0b0aa');
  }
  return p.outline(OUT);
};

// The ways into the far lands' own old places (see world/sites.js).
// An arch's opening: round-headed (`point`: pointed, as Saltmere builds).
function archIn(x, y, cx, half, spring, rise, point = false) {
  const dx = (x - cx) / half;
  if (y >= spring) return Math.abs(dx) <= 1;
  if (point) return Math.abs(dx) <= 1 && spring - y <= rise * (1 - Math.abs(dx) ** 1.4) * 1.05;
  return dx * dx + ((y - spring) / rise) ** 2 <= 1;
}
function arch(p, cx, half, spring, rise, put, point = false) {
  for (let y = 0; y < TALL_H; y++) for (let x = 0; x < 16; x++) if (archIn(x, y, cx, half, spring, rise, point)) put(x, y);
}
function archRim(p, cx, half, spring, rise, c, point = false) {
  const inn = (x, y) => archIn(x, y, cx, half, spring, rise, point);
  for (let y = 0; y < TALL_H; y++) for (let x = 0; x < 16; x++) if (!inn(x, y) && (inn(x - 1, y) || inn(x + 1, y) || inn(x, y + 1) || inn(x - 1, y + 1) || inn(x + 1, y + 1))) p.set(x, y, typeof c === 'function' ? c(x, y) : c);
}
// The Imperial Catacomb: a gate of bronze gone green in a travertine
// arch, its keystone carved, a wreath of laurel over it, an oil lamp
// burning in a niche either side.
FAR_SPRITES.catacomb_door = (rot, st, f) => {
  const p = spr(TALL_H);
  const T = FAR_P.travertine;
  for (let y = 0; y < TALL_H; y++) for (let x = 0; x < 16; x++) {
    const row = Math.floor(y / 5);
    const j = (x + (row % 2) * 4) % 8 === 0;
    p.set(x, y, y % 5 === 0 ? T[3] : j ? T[1] : (x * 3 + y * 7) % 13 === 0 ? T[1] : T[0]);
  }
  arch(p, 7.5, 4.6, 20, 6, (x, y) => {
    const leaf = x <= 7 ? 0 : 1;
    const edge = x === 7 || x === 8;
    let c = edge ? '#24382a' : (x + y) % 9 === 0 ? '#7aa088' : y % 6 === 2 ? '#3e5a48' : '#5a7a62';
    if (!edge && (x === 4 || x === 11) && y % 4 === 0) c = '#d8b048';
    if (y === 27 && (x === 6 + leaf * 3)) c = '#e8c858';
    p.set(x, y, c);
  });
  archRim(p, 7.5, 4.6, 20, 6, (x, y) => (y < 16 && Math.abs(x - 7.5) < 1.2 ? '#fff8e8' : T[2]));
  p.rect(7, 12, 2, 2, '#f8f0dc');
  for (let a = 0; a < 12; a++) {
    const t = (a / 12) * Math.PI * 2;
    const x = Math.round(7.5 + Math.cos(t) * 3);
    const y = Math.round(5 + Math.sin(t) * 2.6);
    p.set(x, y, a % 2 ? '#7a9a3a' : '#5a7a2a');
  }
  p.set(7, 8, '#c84030');
  p.set(8, 8, '#c84030');
  for (const x of [1, 14]) {
    p.rect(x - 1, 26, 2, 4, '#3a3226');
    const fl = f % 2 ? '#ffd070' : '#ffb040';
    p.set(x, 27, fl);
    p.set(x - (f % 2), 26, '#fff0b0');
    p.set(x - 1, 29, '#a8987a');
  }
  return p;
};
// The Terracotta Vault: red lacquered doors studded with gold in rows, a
// lion's head with a ring in its jaws on each, under a little roof of
// green glaze with its eaves turned up.
FAR_SPRITES.vault_door = (rot, st, f) => {
  const p = spr(TALL_H);
  const A = FAR_P.adobe_red;
  for (let y = 0; y < TALL_H; y++) for (let x = 0; x < 16; x++) p.set(x, y, (x * 5 + y * 3) % 11 === 0 ? A[1] : (x + y * 2) % 17 === 0 ? A[2] : A[0]);
  const J = FAR_P.roof_jade;
  for (let y = 4; y < 10; y++) {
    const w = 8 + Math.floor((y - 4) * 0.4);
    for (let x = 8 - w; x < 8 + w; x++) if (x >= 0 && x < 16) p.set(x, y, y === 4 ? J[2] : (x + y) % 3 === 0 ? J[1] : J[0]);
  }
  p.set(0, 3, J[2]);
  p.set(15, 3, J[2]);
  p.hline(0, 15, 10, J[3]);
  p.rect(1, 11, 14, 29, '#5a1418');
  p.rect(2, 12, 12, 28, '#a8202a');
  p.vline(7, 12, 39, '#4a0e12');
  p.vline(8, 12, 39, '#6a1820');
  const glint = f % 2;
  for (let y = 14; y < 38; y += 3) for (const x of [3, 5, 10, 12]) p.set(x, y, (x + y + glint) % 4 === 0 ? '#fff0a0' : '#e0b040');
  for (const cx of [5.5, 10.5]) {
    p.ellipse(cx, 25, 1.6, 1.6, '#c89030');
    p.set(Math.round(cx), 25, '#5a3a10');
    p.ellipse(cx, 28, 1.2, 1, '#e0b040');
    p.set(Math.round(cx), 28, '#a8202a');
  }
  for (const x of [0, 15]) {
    const lit = f % 2 ? '#ff8a40' : '#ff6a30';
    p.rect(x === 0 ? 0 : 14, 15, 2, 3, lit);
    p.set(x === 0 ? 0 : 15, 14, '#3a2a10');
  }
  return p;
};
// The Leviathan's Gut: the whale's own jaw for a door, bone white,
// baleen hanging like a curtain, and the dark beyond it breathing.
FAR_SPRITES.gut_mouth = (rot, st, f) => {
  const p = spr(TALL_H);
  for (let y = 0; y < TALL_H; y++) for (let x = 0; x < 16; x++) p.set(x, y, (x * 7 + y * 3) % 11 === 0 ? '#86867e' : (x + y) % 6 === 0 ? '#5a5a54' : '#6e6e66');
  const breathe = f % 2 ? 0.95 : 1.08;
  arch(p, 7.5, 6, 24, 10, (x, y) => p.set(x, y, shade(y > 30 ? '#2a0a10' : '#4a141c', breathe)));
  archRim(p, 7.5, 6, 24, 10, (x, y) => ((x + y) % 3 ? '#f2ead6' : '#d6ccb2'));
  for (let x = 3; x <= 12; x++) {
    const len = 3 + ((x * 5) % 4);
    for (let y = 15 + Math.abs(x - 7.5) * 0.5; y < 15 + Math.abs(x - 7.5) * 0.5 + len; y++) if (x % 2 === 0) p.set(x, Math.round(y), y % 2 ? '#3a3226' : '#5a4a36');
  }
  for (let x = 2; x <= 13; x += 2) {
    p.set(x, 38, '#f8f4e8');
    p.set(x, 37, '#f8f4e8');
    p.set(x, 36, '#e8e0cc');
  }
  p.hline(2, 13, 39, '#c84a5a');
  p.set(6, 30, '#c8d880');
  p.set(9, 33, '#a8c070');
  return p;
};
// The Salt Cathedral: a pointed door cut in white salt, a rose window of
// coloured salt glass over it, crystals grown up round its foot,
// glittering.
FAR_SPRITES.salt_door = (rot, st, f) => {
  const p = spr(TALL_H);
  const S = FAR_P.salt_brick;
  for (let y = 0; y < TALL_H; y++) for (let x = 0; x < 16; x++) {
    const row = Math.floor(y / 4);
    const j = (x + (row % 2) * 3) % 6 === 0;
    p.set(x, y, y % 4 === 0 || j ? S[1] : (x * 5 + y) % 19 === 0 ? '#f0d0dc' : S[0]);
  }
  p.ellipse(7.5, 6, 4, 4, '#bcb4a8');
  const panes = ['#e88aa8', '#7ab8e8', '#f8f0a0', '#a8e0c8'];
  for (let y = 3; y <= 9; y++) for (let x = 4; x <= 11; x++) {
    const d = Math.hypot(x - 7.5, y - 6);
    if (d > 3.2) continue;
    p.set(x, y, d < 1 ? '#ffffff' : panes[Math.floor(((Math.atan2(y - 6, x - 7.5) + Math.PI) / (Math.PI * 2)) * 8) % 4]);
  }
  arch(p, 7.5, 3.8, 22, 9, (x, y) => p.set(x, y, y > 34 ? '#182030' : (x + y) % 7 === 0 ? '#3a4a68' : '#26324a'), true);
  archRim(p, 7.5, 3.8, 22, 9, S[2], true);
  const g = f % 2;
  for (const [x, y, h] of [[1, 39, 5], [2, 39, 3], [13, 39, 6], [14, 39, 3], [0, 39, 2], [15, 39, 4]]) {
    for (let k = 0; k < h; k++) p.set(x, y - k, k === h - 1 ? '#ffffff' : (k + g) % 3 === 0 ? '#ffd8e8' : '#f4eef8');
  }
  p.set(3 + g * 9, 20 + g * 4, '#ffffff');
  return p;
};
// The Deep Warren: a hole, perfectly round, in a bank of earth, stones
// set round its rim; roots hang over it, lantern pods glowing in them.
FAR_SPRITES.warren_hole = (rot, st, f) => {
  const p = spr(TALL_H);
  for (let y = 0; y < TALL_H; y++) for (let x = 0; x < 16; x++) p.set(x, y, y < 6 ? ((x + y) % 3 ? '#5a8a3a' : '#467430') : (x * 3 + y * 5) % 13 === 0 ? '#644a2e' : (x + y) % 7 === 0 ? '#8c6a44' : '#7a5a3a');
  const cx = 7.5;
  const cy = 28;
  for (let y = 18; y < TALL_H; y++) for (let x = 0; x < 16; x++) {
    const d = Math.hypot(x - cx, y - cy);
    if (d <= 5.4) p.set(x, y, d < 3 ? '#0a0806' : d < 4.4 ? '#160e0a' : '#22160e');
    else if (d <= 6.6) p.set(x, y, (Math.round(Math.atan2(y - cy, x - cx) * 3) % 2) ? '#9a9a90' : '#7a7a72');
  }
  for (const [x0, len] of [[3, 12], [6, 9], [10, 14], [13, 8]]) {
    for (let y = 6; y < 6 + len; y++) p.set(x0 + Math.round(Math.sin(y * 0.4 + x0) * 0.8), y, '#4a3420');
  }
  const lit = f % 2 ? ['#ffe890', '#ffd060'] : ['#ffd060', '#ffe890'];
  for (const [x, y, k] of [[3, 17, 0], [10, 19, 1], [13, 14, 0], [6, 14, 1]]) {
    p.set(x, y, lit[k]);
    p.set(x, y + 1, lit[1 - k]);
  }
  return p;
};
// The Hollow Hill: three great stones, two standing and one laid over
// them, in a green hillside; a spiral cut in the lintel glows, and the
// dark between the stones shimmers like a curtain.
FAR_SPRITES.mound_door = (rot, st, f) => {
  const p = spr(TALL_H);
  const H = FAR_P.heath;
  for (let y = 0; y < TALL_H; y++) for (let x = 0; x < 16; x++) {
    if (y <= 3 + Math.abs(x - 7.5) * 0.4) continue;
    p.set(x, y, (x * 5 + y * 3) % 9 === 0 ? H[1] : (x + y) % 5 === 0 ? H[2] : y < 14 ? '#5a8a3a' : '#4a7a32');
  }
  for (let y = 14; y < TALL_H; y++) for (let x = 3; x <= 12; x++) {
    const s = Math.sin(y * 0.5 + x * 0.9 + f * 1.7);
    p.set(x, y, s > 0.75 ? '#c8a0ff' : s > 0.3 ? '#2a1a48' : '#160e2a');
  }
  for (const x0 of [1, 13]) for (let y = 14; y < TALL_H; y++) for (let x = x0; x < x0 + 2; x++) p.set(x, y, (x + y) % 4 === 0 ? '#64645e' : x === x0 ? '#8a8a84' : '#76766e');
  for (let y = 10; y < 14; y++) for (let x = 0; x < 16; x++) p.set(x, y, y === 10 ? '#a4a49e' : (x + y) % 5 === 0 ? '#6e6e6a' : '#8a8a86');
  const glow = f % 2 ? '#a8fff0' : '#70e8d0';
  for (let a = 0; a < 14; a++) {
    const t = a * 0.7;
    const r = 0.3 + a * 0.12;
    p.set(Math.round(7.5 + Math.cos(t) * r * 1.6), Math.round(12 + Math.sin(t) * r * 0.9), glow);
  }
  for (const [x, y] of [[4, 6], [11, 5], [2, 9]]) p.set(x, y, '#ffffff');
  return p;
};
// The Drowned Broch: a low door in the curve of a drystone tower, the
// lintel one great stone, weed hanging off it, the sea washing in and out
// over the step.
FAR_SPRITES.broch_door = (rot, st, f) => {
  const p = spr(TALL_H);
  const D = FAR_P.drystone;
  for (let y = 0; y < TALL_H; y++) {
    const row = Math.floor(y / 3);
    for (let x = 0; x < 16; x++) {
      const curve = Math.round(Math.abs(x - 7.5) ** 2 * 0.04);
      const j = (x + row * 5 + curve) % 6 === 0;
      p.set(x, y, (y + curve) % 3 === 0 || j ? D[3] : (x * 7 + row * 3) % 5 === 0 ? D[2] : (x + row) % 3 === 0 ? D[1] : D[0]);
    }
  }
  p.rect(4, 20, 8, 20, '#0e1418');
  p.rect(5, 21, 6, 19, '#141c22');
  p.rect(3, 17, 10, 3, '#9a9a94');
  p.hline(3, 12, 17, '#b0b0aa');
  for (const [x, len] of [[4, 4], [6, 6], [9, 3], [11, 5]]) for (let y = 20; y < 20 + len; y++) p.set(x + ((y + f) % 3 === 0 ? 1 : 0), y, y % 2 ? '#2a5a3a' : '#3a6a42');
  const wave = f % 2;
  for (let x = 2; x < 14; x++) {
    p.set(x, 37 - ((x + wave) % 3 === 0 ? 1 : 0), (x + wave) % 2 ? '#a0d0e8' : '#6aa0c0');
    p.set(x, 38, '#3a6a8a');
    p.set(x, 39, '#2a4a6a');
  }
  for (const [x, y] of [[2, 30], [13, 26], [1, 34], [14, 33]]) p.set(x, y, '#d8d8cc');
  return p;
};

// (Their frames.)
export const FAR_ANIM = { catacomb_door: 2, vault_door: 2, gut_mouth: 2, salt_door: 2, warren_hole: 2, mound_door: 4, broch_door: 2 };

// --------------------------------------------------------------- creatures
// The far lands' beasts (16 x 16, facing left, two frames).
function beast(f, o) {
  const p = new Px(16, 16);
  o(p, f);
  return p.outline(OUT);
}
// A white bull of the Velari: broad, short-horned, garlanded on feast days.
function whiteBull(f, v) {
  return beast(f, (p) => {
    const body = hex(['#f0ece0', '#e0d8c8', '#f8f4ec'][v % 3]);
    p.rect(4, 6, 10, 5, body);
    p.hline(4, 13, 6, shade(body, 1.05));
    p.hline(4, 13, 10, shade(body, 0.8));
    p.rect(1, 5, 4, 4, body);
    p.set(1, 7, '#d8a8a0');
    p.set(2, 6, '#1a1420');
    p.line(1, 4, 0, 2, '#e8dcc0');
    p.line(4, 4, 5, 2, '#e8dcc0');
    for (const [x, o] of [[5, f], [7, -f], [11, f], [13, -f]]) p.vline(x + o, 11, 14, shade(body, 0.75));
    p.line(14, 7, 15, 10, shade(body, 0.8));
  });
}
// A reindeer: brown, pale-necked, its antlers branching back.
function reindeer(f, v) {
  return beast(f, (p) => {
    const body = hex(['#8a6a4a', '#7a5a3e', '#9a7a58'][v % 3]);
    p.rect(5, 7, 8, 4, body);
    p.rect(3, 5, 3, 4, '#e0d8c8');
    p.rect(1, 4, 3, 3, body);
    p.set(1, 6, '#2a1a14');
    p.set(2, 4, '#1a1420');
    for (const [x0, y0, x1, y1] of [[3, 3, 5, 0], [4, 1, 6, 1], [2, 3, 1, 0], [1, 1, 0, 1]]) p.line(x0, y0, x1, y1, '#d8c8a8');
    for (const [x, o] of [[6, f], [8, -f], [11, f], [12, -f]]) p.vline(x + o, 11, 14, shade(body, 0.7));
    p.set(13, 7, '#e0d8c8');
  });
}
// A frost wolf: white-grey, blue-eyed, frost on its ruff.
function frostWolf(f) {
  return beast(f, (p) => {
    const body = hex('#c8d4e0');
    p.rect(4, 7, 9, 4, body);
    p.rect(1, 6, 4, 3, body);
    p.set(0, 8, '#4a5868');
    p.set(2, 6, '#40c0ff');
    p.set(3, 5, body);
    p.set(4, 5, body);
    p.line(13, 8, 15, 6 + f, body);
    for (const [x, o] of [[5, f], [7, -f], [10, f], [12, -f]]) p.vline(x + o, 11, 14, shade(body, 0.75));
    for (const x of [4, 6, 8]) p.set(x, 7, '#ffffff');
  });
}
// A red-crowned crane, stepping high on long legs.
function crane(f) {
  return beast(f, (p) => {
    p.ellipse(9, 7, 4, 2, '#f4f4f0');
    p.hline(11, 14, 8, '#1e1e24');
    p.line(6, 6, 4, 2, '#1e1e24');
    p.set(3, 1, '#d82a2a');
    p.set(4, 1, '#f4f4f0');
    p.hline(1, 2, 2, '#c8b060');
    p.line(8, 9, 7 + f, 14, '#3a3a3a');
    p.line(10, 9, 11 - f, 14, '#3a3a3a');
  });
}
// A tiger, gold and striped, low and heavy.
function tiger(f) {
  return beast(f, (p) => {
    const body = hex('#e08a2a');
    p.rect(4, 7, 9, 4, body);
    p.rect(1, 6, 4, 4, body);
    p.hline(4, 12, 10, '#f4e8d0');
    p.set(1, 8, '#f4e8d0');
    p.set(2, 7, '#1a1420');
    p.set(2, 5, body);
    p.set(4, 5, body);
    for (const x of [5, 7, 9, 11]) p.vline(x, 7, 9, '#2a1a14');
    p.line(13, 8, 15, 5 + f, body);
    p.set(15, 5 + f, '#2a1a14');
    for (const [x, o] of [[5, f], [7, -f], [10, f], [12, -f]]) p.vline(x + o, 11, 14, shade(body, 0.75));
  });
}
// A coyote: lean, sandy, big-eared.
function coyote(f) {
  return beast(f, (p) => {
    const body = hex('#b89a6a');
    p.rect(5, 7, 8, 3, body);
    p.rect(2, 6, 4, 3, body);
    p.set(1, 8, '#4a3a2a');
    p.set(3, 6, '#1a1420');
    p.line(3, 5, 3, 3, body);
    p.line(5, 5, 5, 3, body);
    p.line(13, 8, 15, 10, '#8a7050');
    for (const [x, o] of [[6, f], [8, -f], [11, f], [12, -f]]) p.vline(x + o, 10, 14, shade(body, 0.7));
  });
}
// A rattlesnake, coiled to strike, its rattle up.
function rattlesnake(f) {
  return beast(f, (p) => {
    p.ellipse(9, 12, 5, 2, '#a88a5a');
    p.ellipse(9, 11, 3, 1, '#8a6a40');
    for (const x of [6, 9, 12]) p.set(x, 12, '#5a3a24');
    p.line(5, 11, 3, 8 - f, '#a88a5a');
    p.rect(2, 7 - f, 2, 2, '#a88a5a');
    p.set(2, 7 - f, '#1a1420');
    p.set(1, 8 - f, '#d82a2a');
    p.vline(14, 9 - f, 11, '#e8dcc0');
  });
}
// A bone crab: a crab grown a back of old bone, pale and pitted.
function boneCrab(f) {
  return beast(f, (p) => {
    p.ellipse(8, 10, 5, 3, '#e8dcc0');
    p.hline(4, 12, 8, '#fffaf0');
    for (const [x, y] of [[6, 10], [9, 9], [10, 11]]) p.set(x, y, '#a89a80');
    for (let k = 0; k < 3; k++) {
      p.set(4 + k * 2 + f, 13, '#c87a5a');
      p.set(9 + k * 2 - f, 13, '#c87a5a');
    }
    p.rect(1, 6 - f, 3, 2, '#d8805a');
    p.rect(12, 6 + f, 3, 2, '#d8805a');
    p.set(6, 6, '#1a1420');
    p.set(10, 6, '#1a1420');
  });
}
// A gull, standing, head cocked.
function gull(f) {
  return beast(f, (p) => {
    p.ellipse(8, 9, 4, 2, '#f4f4f0');
    p.hline(9, 13, 8, '#9aa0a8');
    p.ellipse(4, 6 + f, 2, 2, '#f4f4f0');
    p.set(3, 6 + f, '#1a1420');
    p.hline(1, 2, 7 + f, '#e8b030');
    p.vline(7, 11, 14, '#e8a060');
    p.vline(9, 11, 14, '#e8a060');
  });
}
// A flamingo: pink, on one leg (and then the other).
function flamingo(f) {
  return beast(f, (p) => {
    p.ellipse(9, 6, 4, 2, '#f490a4');
    p.hline(11, 13, 6, '#2a1a20');
    p.line(6, 5, 5, 1, '#f490a4');
    p.ellipse(4, 1, 1, 1, '#f490a4');
    p.set(3, 2, '#1a1420');
    p.vline(9, 8, 14, '#e06a7a');
    if (f) p.line(10, 8, 11, 11, '#e06a7a');
    else p.vline(10, 8, 14, '#e06a7a');
  });
}
// A brine scorpion: pale as the salt it hides in, its sting raised.
function brineScorpion(f) {
  return beast(f, (p) => {
    p.ellipse(7, 11, 4, 2, '#d8c8b0');
    for (let k = 0; k < 3; k++) {
      p.set(4 + k * 2 + f, 13, '#a89a80');
      p.set(5 + k * 2 - f, 13, '#a89a80');
    }
    p.line(11, 11, 13, 8, '#d8c8b0');
    p.line(13, 8, 12, 5 + f, '#d8c8b0');
    p.set(11, 5 + f, '#c84a3a');
    p.rect(1, 9, 2, 2, '#c8b8a0');
    p.set(4, 10, '#1a1420');
  });
}
// A lantern moth, the size of a hand, its wings lit like paper lamps.
function lanternMoth(f) {
  return beast(f, (p) => {
    const up = f ? -1 : 1;
    p.ellipse(8, 8, 1, 3, '#6a4a2a');
    for (const s of [-1, 1]) {
      p.ellipse(8 + s * 4, 7 + up, 3, 2 + (f ? 0 : 1), '#f0b040');
      p.set(8 + s * 4, 7 + up, '#fff0a0');
    }
    p.line(7, 5, 6, 3, '#6a4a2a');
    p.line(9, 5, 10, 3, '#6a4a2a');
  });
}
// A badger: grey, striped face, digging claws.
function badger(f) {
  return beast(f, (p) => {
    p.ellipse(9, 10, 5, 3, '#6a6a68');
    p.hline(5, 13, 8, '#8a8a88');
    p.rect(2, 9, 4, 3, '#f0f0e8');
    p.hline(2, 5, 10, '#1a1a1a');
    p.set(2, 11, '#1a1420');
    for (const [x, o] of [[6, f], [8, -f], [11, f], [12, -f]]) p.vline(x + o, 13, 14, '#3a3a38');
  });
}
// A white hare of the Wyrd Isle, long-eared (one of them is a witch).
function whiteHare(f) {
  return beast(f, (p) => {
    p.ellipse(9, 11 - f, 4, 2, '#f4f4f0');
    p.ellipse(5, 9 - f, 2, 2, '#f4f4f0');
    p.line(5, 7 - f, 6, 3 - f, '#f4f4f0');
    p.line(4, 7 - f, 4, 4 - f, '#e8e0e8');
    p.set(4, 9 - f, '#c83a4a');
    p.set(13, 10 - f, '#ffffff');
    p.vline(7, 12 - f, 14, '#d8d8d4');
    p.vline(11, 12 - f, 14, '#d8d8d4');
  });
}
// A raven, black with a sheen of blue, hopping.
function raven(f) {
  return beast(f, (p) => {
    p.ellipse(9, 10 - f, 4, 2, '#1e1e2a');
    p.hline(6, 11, 9 - f, '#3a3a5a');
    p.ellipse(5, 8 - f, 2, 2, '#1e1e2a');
    p.set(4, 7 - f, '#e8e8ff');
    p.hline(2, 3, 8 - f, '#3a3a40');
    p.line(12, 10 - f, 15, 9 - f, '#1e1e2a');
    p.vline(8, 12 - f, 14, '#3a3a40');
    p.vline(10, 12 - f, 14, '#3a3a40');
  });
}
// A puffin: black back, white face, the striped beak.
function puffin(f) {
  return beast(f, (p) => {
    p.ellipse(9, 10, 3, 3, '#1e1e24');
    p.ellipse(8, 11, 2, 2, '#f4f4f0');
    p.ellipse(6, 6, 2, 2, '#1e1e24');
    p.set(6, 6, '#f4f4f0');
    p.set(5, 6, '#1a1420');
    p.rect(2, 6, 2, 2, '#e8702a');
    p.set(3, 6, '#f0c040');
    p.set(8 + f, 14, '#e8702a');
    p.set(10 - f, 14, '#e8702a');
  });
}
// A grey seal, sleek, flippers flapping.
function seal(f) {
  return beast(f, (p) => {
    p.ellipse(8, 11, 6, 2, '#7a8088');
    p.hline(3, 12, 10, '#9aa0a8');
    p.ellipse(3, 9, 2, 2, '#7a8088');
    p.set(2, 9, '#1a1420');
    p.set(1, 10, '#3a3a40');
    p.line(13, 11, 15, 9 + f, '#6a7078');
    p.set(7, 13 - f, '#6a7078');
  });
}

// (Round 68) Below ground. A tunneler: a blind digger, bald and pink,
// all shoulders and spade-claws, its snout feeling the air.
function tunneler(f) {
  return beast(f, (p) => {
    const hide = hex('#b88a7a');
    p.ellipse(9, 9, 6, 4, hide);
    p.hline(5, 13, 6, shade(hide, 1.15));
    p.hline(5, 13, 12, shade(hide, 0.75));
    for (let x = 6; x < 13; x += 2) p.set(x, 8, shade(hide, 0.85));
    p.ellipse(3, 9, 3, 2, shade(hide, 1.05));
    p.set(0, 9, '#e8a0a0');
    p.set(1, 8, '#e8a0a0');
    p.set(1, 10, '#e8a0a0');
    for (const [x, o] of [[4, f], [12, -f]]) {
      p.rect(x - 1, 12, 3, 2, shade(hide, 0.85));
      p.hline(x - 2 + o, x + 2 + o, 14, '#e8e0cc');
      p.set(x - 2 + o, 15, '#e8e0cc');
      p.set(x + o, 15, '#e8e0cc');
    }
    p.line(15, 9, 14, 11 + f, shade(hide, 0.8));
  });
}
// A grave raven: a raven, but bigger, ragged, its eye red.
function graveRaven(f) {
  return beast(f, (p) => {
    const up = f ? -2 : 1;
    p.ellipse(9, 9, 4, 2, '#14141e');
    p.line(6, 8, 3 + f, 4 + up, '#22223a');
    p.line(11, 8, 14 - f, 4 + up, '#22223a');
    p.line(7, 8, 5 + f, 5 + up, '#14141e');
    p.line(10, 8, 12 - f, 5 + up, '#14141e');
    p.ellipse(5, 8, 2, 2, '#14141e');
    p.set(4, 7, '#ff3030');
    p.hline(1, 3, 8, '#3a3a40');
    p.line(12, 9, 15, 11, '#14141e');
  });
}
// A cave moth: a lantern moth gone strange in the dark, eyes on its wings.
function caveMoth(f) {
  return beast(f, (p) => {
    const up = f ? -1 : 1;
    p.ellipse(8, 8, 1, 3, '#4a2a1a');
    for (const s of [-1, 1]) {
      p.ellipse(8 + s * 4, 7 + up, 3, 2 + (f ? 0 : 1), '#e08a20');
      p.set(8 + s * 4, 7 + up, '#1a1420');
      p.set(8 + s * 4 + 1, 7 + up, '#ffe060');
    }
    p.line(7, 5, 5, 2, '#4a2a1a');
    p.line(9, 5, 11, 2, '#4a2a1a');
  });
}

export const FAR_CREATURES = {
  tunneler: { frames: 2, draw: (f) => tunneler(f) },
  grave_raven: { frames: 2, draw: (f) => graveRaven(f) },
  cave_moth: { frames: 2, draw: (f) => caveMoth(f) },
  white_bull: { frames: 2, draw: (f, v) => whiteBull(f, v) },
  reindeer: { frames: 2, draw: (f, v) => reindeer(f, v) },
  frost_wolf: { frames: 2, draw: (f) => frostWolf(f) },
  crane: { frames: 2, draw: (f) => crane(f) },
  tiger: { frames: 2, draw: (f) => tiger(f) },
  coyote: { frames: 2, draw: (f) => coyote(f) },
  rattlesnake: { frames: 2, draw: (f) => rattlesnake(f) },
  bone_crab: { frames: 2, draw: (f) => boneCrab(f) },
  gull: { frames: 2, draw: (f) => gull(f) },
  flamingo: { frames: 2, draw: (f) => flamingo(f) },
  brine_scorpion: { frames: 2, draw: (f) => brineScorpion(f) },
  lantern_moth: { frames: 2, draw: (f) => lanternMoth(f) },
  badger: { frames: 2, draw: (f) => badger(f) },
  white_hare: { frames: 2, draw: (f) => whiteHare(f) },
  raven: { frames: 2, draw: (f) => raven(f) },
  puffin: { frames: 2, draw: (f) => puffin(f) },
  seal: { frames: 2, draw: (f) => seal(f) },
};
