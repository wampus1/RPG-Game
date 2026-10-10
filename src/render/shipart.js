// What the great ships are made of, drawn (round 68: see
// world/shipmodels.js): tarred hull planking with its caulked seams, the
// scrubbed deck with its treenails, the rail's varnished cap, the gunports'
// red lids, the stern's leaded windows in their gilt frames, the gilded
// carving, the masts, the green copper under the waterline. And what
// stands below deck: the guns on their carriages, the crew's hammocks, the
// bilge pump, the capstan. (The ships themselves, turned to any heading,
// are drawn in render/shipvox.js out of these same faces.)
import { Px, shade } from './pixel.js';
import { LH } from '../config.js';

const OUT = '#1c1622';
const SPR_H = 16 + LH;

export const SHIP_P = {
  hull_planks: ['#3e2c1e', '#22170f', '#54402c'],
  deck_planks: ['#b48c5a', '#6e5032', '#cca674'],
  ship_rail: ['#5a3c22', '#2e1e12', '#86603a'],
  gunport: ['#3e2c1e', '#22170f', '#54402c'],
  stern_window: ['#c8a040', '#7a5a1e', '#ffe890'],
  gilt_trim: ['#d0a838', '#8a6618', '#fff0a0'],
  ship_mast: ['#8a6438', '#5a3e20', '#a8804e'],
  copper_sheath: ['#4e8e70', '#2e5e48', '#7ab89a'],
};

// Planks in rows `rowH` high, each its own shade, butt joints staggered,
// a dark caulked seam under each: along x (rows across y).
function boards(p, pal, rand, rowH, caulk = pal[1]) {
  for (let r = 0; r * rowH < p.h; r++) {
    const f = 0.9 + rand() * 0.2;
    const base = shade(pal[0], f);
    const butt = (r * 7 + Math.floor(rand() * 5)) % p.w;
    for (let y = r * rowH; y < Math.min(p.h, (r + 1) * rowH); y++) {
      for (let x = 0; x < p.w; x++) {
        let c = base;
        if (rand() < 0.1) c = shade(pal[0], f * 0.88);
        else if (rand() < 0.05) c = shade(pal[2], f);
        if (y === r * rowH && rand() < 0.5) c = shade(base, 1.08);
        if (y === (r + 1) * rowH - 1) c = caulk;
        if (x === butt) c = caulk;
        p.set(x, y, c);
      }
    }
  }
  return p;
}

// The same, turned: planks running along y (columns across x).
function deckBoards(p, pal, rand) {
  const W = 4;
  for (let c = 0; c * W < p.w; c++) {
    const f = 0.92 + rand() * 0.16;
    const base = shade(pal[0], f);
    const butt = Math.floor(rand() * p.h);
    for (let x = c * W; x < Math.min(p.w, (c + 1) * W); x++) {
      for (let y = 0; y < p.h; y++) {
        let col = base;
        if (rand() < 0.1) col = shade(pal[0], f * 0.9);
        if (x === (c + 1) * W - 1) col = pal[1];
        if (y === butt) col = pal[1];
        p.set(x, y, col);
      }
    }
    // Treenails, a pair either side of the butt.
    for (const dy of [-2, 2]) p.set(c * W + 1, (butt + dy + p.h) % p.h, shade(pal[1], 1.2));
  }
  return p;
}

export function shipTop(name, v, rand) {
  const p = new Px(16, 16);
  const pal = SHIP_P[name];
  switch (name) {
    case 'hull_planks': case 'gunport': return boards(p, pal, rand, 4);
    case 'deck_planks': return deckBoards(p, pal, rand);
    case 'ship_rail': {
      // The cap rail, varnished, a highlight along it.
      p.fill(pal[0]);
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (rand() < 0.12) p.set(x, y, pal[1]);
      p.hline(0, 15, 0, pal[2]);
      p.hline(0, 15, 15, pal[1]);
      p.vline(0, 0, 15, pal[2]);
      p.vline(15, 0, 15, pal[1]);
      for (let i = 0; i < 3; i++) p.set(3 + i * 5, 7, '#c8a050');
      return p;
    }
    case 'stern_window': case 'gilt_trim': {
      p.fill(pal[0]);
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if ((x + y * 3 + v) % 7 === 0) p.set(x, y, pal[1]);
      p.hline(0, 15, 0, pal[2]);
      p.vline(0, 0, 15, pal[2]);
      return p;
    }
    case 'ship_mast': {
      // A mast's end: rings of a great spar, an iron band round it.
      p.fill('#3e3e46');
      p.ellipse(7.5, 7.5, 7, 7, pal[0]);
      p.ellipse(7.5, 7.5, 5, 5, pal[2]);
      p.ellipse(7.5, 7.5, 3, 3, pal[0]);
      p.ellipse(7.5, 7.5, 1, 1, pal[1]);
      return p;
    }
    case 'copper_sheath': return plates(p, pal, rand, 16);
    default: return null;
  }
}

// Copper plates, overlapping, riveted, gone green in places.
function plates(p, pal, rand, h) {
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < 16; x++) {
      const row = Math.floor(y / 4);
      const off = row % 2 ? 4 : 0;
      const edge = y % 4 === 3 || (x + off) % 8 === 7;
      let c = edge ? pal[1] : pal[0];
      if (!edge && rand() < 0.14) c = pal[2];
      if (!edge && rand() < 0.05) c = '#b87a48';
      p.set(x, y, c);
      if (!edge && y % 4 === 1 && (x + off) % 8 === 1) p.set(x, y, '#c8e0d0');
    }
  }
  return p;
}

export function shipFront(name, v, rand) {
  const p = new Px(16, LH);
  const pal = SHIP_P[name];
  switch (name) {
    case 'hull_planks': return boards(p, pal, rand, 3);
    case 'deck_planks': return boards(p, pal, rand, 3);
    case 'ship_rail': {
      boards(p, SHIP_P.hull_planks, rand, 3);
      // The cap along the top, and a moulding under it.
      p.rect(0, 0, 16, 2, pal[0]);
      p.hline(0, 15, 0, pal[2]);
      p.hline(0, 15, 3, pal[1]);
      return p;
    }
    case 'gunport': {
      boards(p, pal, rand, 3);
      // The port's lid, painted red inside its frame, the hinges at the top.
      p.rect(3, 2, 10, 8, '#1a120c');
      p.rect(4, 3, 8, 6, v % 2 ? '#8a2a1c' : '#7a2418');
      p.hline(4, 11, 3, '#a8402a');
      p.set(5, 2, '#5a5a62');
      p.set(10, 2, '#5a5a62');
      return p;
    }
    case 'stern_window': {
      // Leaded panes in a gilt frame, the sky's light in them.
      p.fill(pal[0]);
      p.rect(1, 1, 14, LH - 2, '#2a3a48');
      for (let y = 2; y < LH - 2; y++) for (let x = 2; x < 14; x++) p.set(x, y, (x + y) % 5 === 0 ? '#c8e8f8' : (x * 3 + y) % 7 === 0 ? '#5a7a90' : '#7aa8c8');
      p.vline(5, 1, LH - 2, pal[1]);
      p.vline(10, 1, LH - 2, pal[1]);
      p.hline(1, 14, 6, pal[1]);
      p.hline(0, 15, 0, pal[2]);
      return p;
    }
    case 'gilt_trim': {
      // Carved scrolls, gilded: a running vine of curls.
      p.fill(pal[1]);
      for (let x = 0; x < 16; x++) {
        const y = Math.round(5 + Math.sin((x + v * 2) * 0.9) * 3);
        p.set(x, y, pal[0]);
        p.set(x, y - 1, pal[2]);
        if (x % 4 === 1) p.set(x, y + 2, pal[0]);
      }
      p.hline(0, 15, 0, pal[2]);
      p.hline(0, 15, LH - 1, '#5a4010');
      return p;
    }
    case 'ship_mast': {
      for (let y = 0; y < LH; y++) for (let x = 0; x < 16; x++) p.set(x, y, x < 3 ? pal[2] : x > 12 ? pal[1] : rand() < 0.15 ? pal[1] : pal[0]);
      p.hline(0, 15, 4, '#3e3e46');
      return p;
    }
    case 'copper_sheath': return plates(p, pal, rand, LH);
    default: return null;
  }
}

function spr() {
  return new Px(16, SPR_H);
}

export const SHIP_SPRITES = {
  // A long gun on its truck carriage: run out (rot 0, barrel at you), or
  // side on, or its breech and the tackle (rot 2).
  ship_cannon(rot) {
    const p = spr();
    const wood = '#6a4426';
    const dark = '#3e2614';
    const iron = '#2e2e34';
    const hi = '#5a5a66';
    if (rot === 0 || rot === 2) {
      p.rect(2, 20, 12, 6, wood);
      p.hline(2, 13, 20, shade(wood, 1.2));
      p.rect(1, 24, 3, 3, dark);
      p.rect(12, 24, 3, 3, dark);
      if (rot === 0) {
        p.ellipse(7.5, 16, 4, 4, iron);
        p.ellipse(7.5, 16, 2, 2, '#0a0a0e');
        p.set(5, 13, hi);
      } else {
        p.rect(5, 14, 6, 7, iron);
        p.ellipse(7.5, 13, 2, 2, iron);
        p.set(7, 11, hi);
        p.hline(3, 12, 22, '#c8b890');
      }
    } else {
      const d = rot === 1 ? -1 : 1;
      p.rect(3, 21, 10, 5, wood);
      p.hline(3, 12, 21, shade(wood, 1.2));
      for (const x of [4, 11]) p.ellipse(x, 25, 1.5, 1.5, dark);
      for (let i = 0; i < 13; i++) {
        const x = 8 + d * (i - 4);
        p.vline(x, 16, 19, iron);
        p.set(x, 16, hi);
      }
      p.rect(8 + d * 9 - (d < 0 ? 1 : 0), 15, 2, 5, iron);
    }
    return p.outline(OUT);
  },
  // A canvas hammock slung between two hooks, a blanket in it.
  hammock(rot) {
    const p = spr();
    const along = rot % 2 === 0;
    const cloth = '#d8ccb0';
    if (along) {
      for (let x = 1; x < 15; x++) {
        const sag = Math.round(Math.sin((x / 14) * Math.PI) * 3);
        p.vline(x, 12 + sag, 14 + sag, cloth);
        p.set(x, 12 + sag, '#f0e8d4');
      }
      p.rect(5, 13, 6, 2, '#7a3a2a');
      p.vline(0, 6, 12, '#8a7a5a');
      p.vline(15, 6, 12, '#8a7a5a');
    } else {
      p.rect(6, 8, 4, 12, cloth);
      p.vline(6, 8, 19, '#b8ac90');
      p.rect(6, 12, 4, 4, '#7a3a2a');
      p.vline(8, 2, 8, '#8a7a5a');
    }
    return p.outline(OUT);
  },
  // The bilge pump: a stout wooden barrel-pump with its long brake handle.
  ship_pump(rot, st, f) {
    const p = spr();
    const wood = '#7a5432';
    p.rect(5, 12, 6, 15, wood);
    p.vline(5, 12, 26, shade(wood, 1.25));
    p.vline(10, 12, 26, shade(wood, 0.7));
    for (const y of [14, 20, 25]) p.hline(5, 10, y, '#3a3a42');
    const up = f % 2 ? 2 : 0;
    p.hline(1, 14, 10 + up, '#5a3c22');
    p.vline(8, 10 + up, 12, '#5a3c22');
    p.rect(12, 18, 3, 2, '#4a3a2a');
    return p.outline(OUT);
  },
  // The capstan: a drum with its bars stood in it.
  capstan() {
    const p = spr();
    const wood = '#8a6438';
    p.rect(4, 14, 8, 12, wood);
    p.vline(4, 14, 25, shade(wood, 1.25));
    p.vline(11, 14, 25, shade(wood, 0.7));
    p.ellipse(7.5, 14, 4, 2, shade(wood, 1.15));
    p.hline(0, 15, 13, '#5a3c22');
    p.hline(3, 12, 20, '#3a3a42');
    return p.outline(OUT);
  },
};
// (Round 69) The blueprint table: her plans spread on it, pinned at the
// corners, a pair of dividers lying across them.
SHIP_SPRITES.blueprint_table = function blueprintTable() {
  const p = new Px(16, SPR_H);
  const wood = '#6a4a2a';
  p.rect(1, 14, 14, 3, wood);
  p.hline(1, 14, 14, shade(wood, 1.25));
  for (const x of [2, 13]) p.vline(x, 17, 26, shade(wood, 0.8));
  p.rect(2, 11, 12, 4, '#9ab8d8');
  p.rect(2, 11, 12, 1, '#c8dcf0');
  for (let x = 3; x < 13; x += 2) p.set(x, 13, '#5a7aa8');
  p.hline(4, 10, 12, '#2a4a8a');
  p.line(5, 14, 9, 11, '#3a3a42');
  p.line(6, 14, 10, 12, '#5a5a62');
  for (const [x, y] of [[2, 11], [13, 11]]) p.set(x, y, '#c82020');
  return p.outline(OUT);
};
// (Round 78) The shipwright's bench: a long bench, a half-planked hull on
// its stocks, a plane and a rolled draught beside it.
SHIP_SPRITES.shipwright_bench = function shipwrightBench() {
  const p = new Px(16, SPR_H);
  const wood = '#7a5a34';
  p.rect(0, 16, 16, 3, wood);
  p.hline(0, 15, 16, shade(wood, 1.25));
  for (const x of [1, 14]) p.vline(x, 19, 26, shade(wood, 0.75));
  p.hline(1, 14, 23, shade(wood, 0.7));
  // The hull on its stocks: ribs, a few planks on.
  p.hline(3, 11, 15, '#4a3420');
  for (let x = 3; x <= 11; x += 2) p.vline(x, 10, 14, '#c8a070');
  p.hline(3, 11, 14, '#8a5a30');
  p.hline(4, 10, 13, '#9a6a3a');
  p.set(12, 11, '#c8a070');
  p.set(12, 12, '#c8a070');
  p.vline(7, 5, 12, '#5a3c22');
  // The plane, and the draught rolled up.
  p.rect(12, 14, 3, 1, '#a07040');
  p.set(13, 13, '#3a3a42');
  p.rect(0, 13, 2, 2, '#c8dcf0');
  p.set(1, 13, '#2a4a8a');
  return p.outline(OUT);
};
export const SHIP_ANIM = { ship_pump: 2 };

// ------------------------------------------------------------ item icons
// Shot for the guns, a sailor's articles, and the ships themselves (a ship
// in miniature, side on, her masts and canvas by her kind).
export function shipIcon(key) {
  const p = new Px(16, 16);
  if (key === 'cannonball') {
    for (const [x, y] of [[5, 10], [10, 10], [7, 6]]) {
      p.ellipse(x, y, 2.6, 2.6, '#26262c');
      p.set(x - 1, y - 1, '#6a6a78');
      p.set(x, y - 1, '#4a4a54');
    }
    return p.outline(OUT);
  }
  if (key === 'sailors_articles') {
    p.rect(3, 3, 10, 11, '#e8dcbc');
    p.hline(3, 12, 3, '#c8b890');
    p.hline(3, 12, 13, '#a89870');
    for (const y of [5, 7, 9]) p.hline(5, 10, y, '#8a7a5a');
    // (An anchor, and a mark.)
    p.vline(11, 8, 12, '#2a3a5a');
    p.hline(10, 12, 9, '#2a3a5a');
    p.set(10, 12, '#2a3a5a');
    p.set(12, 12, '#2a3a5a');
    p.line(5, 11, 8, 12, '#3a2a1a');
    return p.outline(OUT);
  }
  // (Round 69) Every ship's in a bottle: lying on its stand, corked, her
  // in miniature inside it (an empty one, a ship bottle, to put one in).
  if (key === 'ship_bottle') return bottle(p, null);
  // (Round 78: one of your own design, too: see game/shipdesign.js.)
  const m = /^ship_(sloop|brigantine|galleon|frigate|design)(?:_\d+)?$/.exec(key);
  if (!m) return null;
  return bottle(p, m[1]);
}

function bottle(p, type) {
  const GD = '#5a96aa';
  const IN = '#a8d4e6';
  // The glass: a long body, rounded at the ends, and its neck.
  for (let x = 1; x <= 12; x++) {
    const end = x === 1 || x === 12;
    const top = end ? 4 : 3;
    const bot = end ? 11 : 12;
    for (let y = top; y <= bot; y++) p.set(x, y, y === top || y === bot || end ? GD : IN);
  }
  for (let y = 6; y <= 9; y++) p.set(13, y, y === 6 || y === 9 ? GD : IN);
  // The cork.
  p.rect(14, 6, 2, 4, '#b08050');
  p.vline(15, 6, 9, '#7a5030');
  // The stand.
  p.hline(3, 4, 13, '#6a4a2a');
  p.hline(9, 10, 13, '#6a4a2a');
  p.hline(2, 11, 14, '#4a3020');
  if (type) {
    // A sea of blue putty, and her on it: her hull, her masts, her sails.
    p.hline(2, 11, 11, '#2e6a94');
    p.hline(3, 10, 9, '#7a4a28');
    p.hline(4, 9, 10, type === 'design' ? '#2a4a8a' : '#8a2a1e');
    if (type === 'galleon') p.rect(2, 7, 2, 2, '#7a4a28');
    const masts = { sloop: [6], brigantine: [5, 8], galleon: [5, 7, 9], frigate: [4, 7, 9], design: [5, 8] }[type];
    for (const x of masts) {
      p.vline(x, 4, 8, '#4a2e14');
      if (type === 'sloop') {
        p.set(x + 1, 5, '#ffffff');
        p.hline(x + 1, x + 2, 6, '#ffffff');
        p.hline(x + 1, x + 3, 7, '#f4ecd8');
      } else {
        p.set(x - 1, 5, '#ffffff');
        p.set(x + 1, 5, '#ffffff');
        p.set(x - 1, 7, '#f4ecd8');
        p.set(x + 1, 7, '#f4ecd8');
      }
    }
    p.set(masts[Math.floor(masts.length / 2)], 4, '#d82020');
  } else {
    // (Empty: the light through it.)
    p.hline(4, 10, 8, '#c4e4f0');
  }
  // The light on the glass.
  p.hline(2, 3, 4, '#ffffff');
  p.set(11, 4, '#ffffff');
  return p.outline(OUT);
}
