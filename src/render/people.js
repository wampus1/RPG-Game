// People, drawn: sixteen pixels across and twenty-four high, four ways
// round and five frames (standing, two steps, a blow, sitting).
//   Everything is laid down flat first, each pixel marked with the part it
// belongs to (skin, hair, a sleeve, the left leg, a hat...), and then lit:
// every run of one part across a row is a rounded surface with the light
// on it from the upper left (a warmer, paler step on the lit edge, a
// cooler, darker one on the far edge), tops catch the light, and what's
// under a chin, a hem or a brim is in its shadow. The outline round it all
// is a dark of whatever colour it borders, not one flat black.
import { Px, hex, shade, mix } from './pixel.js';
import { ISLE_ROBES } from './islebossart.js';

const OUT = '#1c1622';
export const CHAR_W = 16;
export const CHAR_H = 24;
// Headroom above each figure for tall hats and hairdos (drawn above row 0).
export const SPR_PAD = 6;
export const SHEET_H = CHAR_H + SPR_PAD;
export const FRAMES = 5; // idle, walk A, walk B, action, sitting

// ---------------------------------------------------------------- light
// A step into the light (warmer and paler) or into shadow (darker and
// cooler), as a painter shifts the hue rather than just the brightness.
const WARM = [255, 238, 196];
const COOL = [34, 26, 76];
export function lit(c, k = 1) {
  return mix(shade(hex(c), 1 + 0.13 * k), WARM, Math.min(0.45, 0.08 * k));
}
export function dim(c, k = 1) {
  return mix(shade(hex(c), Math.max(0.25, 1 - 0.18 * k)), COOL, Math.min(0.45, 0.1 * k));
}

// The parts a figure is made of (see lightUp).
const SKIN = 1;
const HAIR = 2;
const CLOTH = 3;
const ARM_L = 4;
const ARM_R = 5;
const LEG_L = 6;
const LEG_R = 7;
const SHOE_L = 8;
const SHOE_R = 9;
const HAT = 10;
const FLAT = 11; // eyes, buttons, stitches: left as they are
const CAPE = 12;
const METAL = 13;
const BELT = 14;
const OVER = 15; // aprons, tabards, sashes: a layer over the cloth
const NECK = 16;
const TOP_LIT = new Set([HAT, HAIR, CLOTH, CAPE, METAL, ARM_L, ARM_R, OVER]);
const UNDER_HEAD = new Set([CLOTH, METAL, OVER, BELT, CAPE]);

// (`pm` holds each pixel's part; `flat` marks the details laid over it,
// which belong to the surface under them but aren't shaded themselves.)
function lightUp(p, pm, flat) {
  const W = p.w;
  const H = p.h;
  const k = new Float32Array(W * H);
  const at = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? 0 : pm[y * W + x]);
  const mid = W / 2;
  // Across each row: a run of one part is a curve, lit on its left.
  for (let y = 0; y < H; y++) {
    let x = 0;
    while (x < W) {
      const q = at(x, y);
      if (!q || q === NECK) {
        x++;
        continue;
      }
      let e = x;
      while (e + 1 < W && at(e + 1, y) === q) e++;
      const w = e - x + 1;
      const i0 = y * W + x;
      const i1 = y * W + e;
      if (q === METAL) {
        k[i0] += w > 1 ? 1.7 : x < mid ? 1 : -0.6;
        if (w >= 4) k[i0 + 1] += 0.7;
        if (w > 1) k[i1] -= 1.1;
      } else if (w === 1) k[i0] += x < mid ? 0.35 : -0.75;
      else if (w === 2) {
        k[i0] += 0.35;
        k[i1] -= 0.7;
      } else {
        k[i0] += 0.85;
        k[i1] -= 1;
        if (w >= 5) k[i1 - 1] -= 0.4;
      }
      x = e + 1;
    }
  }
  // Down each column: tops in the light; the shadows of a chin, a hem, a
  // brim; soles on the ground.
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const q = at(x, y);
      if (!q) continue;
      const up = at(x, y - 1);
      const dn = at(x, y + 1);
      const i = y * W + x;
      if (!up && TOP_LIT.has(q)) k[i] += 0.55;
      if ((up === SKIN || up === NECK) && UNDER_HEAD.has(q)) k[i] -= 0.8;
      if ((q === LEG_L || q === LEG_R) && (up === CLOTH || up === BELT || up === OVER || up === METAL)) k[i] -= 0.75;
      if (q === SKIN && up === HAT) k[i] -= 0.8;
      else if (q === SKIN && up === HAIR) k[i] -= 0.35;
      if ((q === SHOE_L || q === SHOE_R) && !dn) k[i] -= 0.7;
      if ((q === CLOTH || q === CAPE || q === OVER) && !dn) k[i] -= 0.35;
      if (q === HAT && dn && dn !== HAT && dn !== HAIR) k[i] -= 0.5;
    }
  }
  for (let i = 0; i < W * H; i++) {
    if (!k[i] || flat[i]) continue;
    const c = p.get(i % W, (i / W) | 0);
    if (!c[3]) continue;
    p.set(i % W, (i / W) | 0, k[i] > 0 ? lit(c, k[i]) : dim(c, -k[i]), c[3]);
  }
}

// The outline: each edge pixel a deep shade of what it borders (black
// under the feet, where it meets the ground).
export function outlineSel(p, base = OUT) {
  const W = p.w;
  const H = p.h;
  const src = new Uint8ClampedArray(p.d);
  const a = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? 0 : src[(y * W + x) * 4 + 3]);
  const col = (x, y) => {
    const i = (y * W + x) * 4;
    return [src[i], src[i + 1], src[i + 2]];
  };
  const b = hex(base);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (a(x, y)) continue;
      const n = [[x, y - 1], [x - 1, y], [x + 1, y], [x, y + 1]].filter(([u, v]) => a(u, v));
      if (!n.length) continue;
      // (Below the figure: plain dark.)
      if (n.length === 1 && n[0][1] === y - 1 && !a(x, y + 1)) {
        p.set(x, y, b);
        continue;
      }
      let best = null;
      let lum = 1e9;
      for (const [u, v] of n) {
        const c = col(u, v);
        const l = c[0] * 0.3 + c[1] * 0.59 + c[2] * 0.11;
        if (l < lum) {
          lum = l;
          best = c;
        }
      }
      p.set(x, y, mix(shade(best, 0.3), b, 0.6));
    }
  }
  return p;
}

// ---------------------------------------------------------------- clothes
const OUTFIT_COLORS = {
  guard: { chain: '#8a8a98', chain2: '#6a6a78' },
  smith: { apron: '#6a4a2e' },
  apron: { apron: '#e8e4d8' },
  baker: { apron: '#f0ece4' },
  robe_white: { robe: '#e8e4dc', trim: '#c8a030' },
  robe_blue: { robe: '#3a4a8a', trim: '#c8a030' },
  robe_green: { robe: '#4a6a3a', trim: '#a8c070' },
  robe_witch: { robe: '#2e2c24', trim: '#6a8a3a' },
  robe_saint: { robe: '#dcd8cc', trim: '#8a6ad8' },
  robe_poison: { robe: '#3a4a2a', trim: '#a8c040' },
  noble: { trim: '#e0b030' },
  fisher: { vest: '#4a5a6a' },
  farmer: { overall: '#4a6a9a' },
  plaid: { check: '#5a1e1a' },
  miner: { vest: '#5a4a3a' },
  hunter: { tunic: '#4a6a32', hood: '#6a4a2a' },
  tunic: { belt: '#4a2e1a', buckle: '#d8b040' },
  traveller: { coat: '#5a4a32', collar: '#7a6a4a' },
  // (The islands' masters' robes: see islebossart.js.)
  ...ISLE_ROBES,
  rags: { patch: '#6a5a4a' },
  vest: { vest: '#3a2a22' },
  // The other Dagoni Islands' dress (see npcgen.islandDress).
  ashwrap: { sash: '#c84a1a', hem: '#1e1a1c' },
  mistcloak: { mantle: '#7a8a6a', fringe: '#4a5a44' },
  tidewrap: { vest: '#e8dcc0', trim: '#2a8a9a' },
  skeleton: {},
};
export { OUTFIT_COLORS };

// Colours of worn armour and clothes (see items.js: look).
export const GEAR = {
  leather: { shirt: '#7a5232', pants: '#6a4a2e', shoes: '#4a2e1a' },
  chain: { shirt: '#8a8a98' },
  plate: { shirt: '#a8aab8', pants: '#9a9aa8' },
  coat: { shirt: '#3a2a4a' },
  linen: { shirt: '#e8e0cc' },
  cloth: { pants: '#4a4a6a' },
  iron: { shoes: '#8a8a98' },
  // The Kavorent's: dark alloy, seamed with cold light.
  kav: { shirt: '#2a2840', pants: '#24223a', shoes: '#1c1a2a' },
};

const GOLD = '#d8b040';

export function drawHumanoid(look, dir, frame) {
  const p = new Px(CHAR_W, SHEET_H);
  const pm = new Uint8Array(CHAR_W * SHEET_H);
  const flat = new Uint8Array(CHAR_W * SHEET_H);
  let part = CLOTH;
  const skin = hex(look.skin);
  const hair = hex(look.hair);
  let shirt = hex(look.shirt);
  let pants = hex(look.pants);
  let shoes = hex(look.shoes);
  const accent = hex(look.accent || '#b03030');
  const outfit = look.gear && look.gear.body && !(look.outfit || '').startsWith('robe') ? 'plain' : look.outfit || 'plain';
  const oc = OUTFIT_COLORS[outfit] || {};
  if (outfit === 'plaid') shirt = hex('#b03a2e');
  if (outfit === 'rags') {
    shirt = hex('#8a7a62');
    pants = hex('#5a4a3a');
  }
  if (outfit === 'noble') shirt = accent;
  if (outfit === 'hunter') shirt = hex(oc.tunic);
  if (outfit === 'farmer') pants = hex(oc.overall);
  // Worn gear, as "kind" or "kind:#tint": it changes the colours under it
  // (and covers the everyday outfit's details).
  const gear0 = look.gear || {};
  const gear = {};
  const tint = {};
  for (const k of Object.keys(gear0)) {
    const [kind, t] = String(gear0[k]).split(':');
    gear[k] = kind;
    if (t) tint[k] = t;
  }
  let shoesG = null;
  if (gear.body && (tint.body || GEAR[gear.body]?.shirt)) shirt = hex(gear.body === 'tabard' ? '#6a6a78' : tint.body || GEAR[gear.body].shirt);
  if (gear.legs && (tint.legs || GEAR[gear.legs]?.pants)) pants = hex(tint.legs || GEAR[gear.legs].pants);
  if (gear.feet && (tint.feet || GEAR[gear.feet]?.shoes)) shoesG = hex(tint.feet || GEAR[gear.feet].shoes);
  const skel = outfit === 'skeleton';
  const small = look.small;
  const sit = frame === 4;
  const top = (small ? 6 : look.stoop ? 1 : 0) + (sit ? 4 : 0); // children are shorter; sitting lowers the body
  const walk = frame === 1 ? 1 : frame === 2 ? -1 : 0;
  const bob = frame === 1 || frame === 2 ? -1 : 0;
  const hy = top + bob; // head top y
  const headH = 7;
  const torsoY = hy + headH + 1;
  const torsoH = small ? 4 : 6;
  const legY = torsoY + torsoH;
  const legH = CHAR_H - 2 - legY;
  const side = dir === 1 || dir === 3;
  const front = dir === 0;
  const back = dir === 2;
  const flip = dir === 3;
  const S = (x, y, c) => {
    const X = flip ? CHAR_W - 1 - x : x;
    const Y = y + SPR_PAD;
    if (X < 0 || Y < 0 || X >= CHAR_W || Y >= SHEET_H) return;
    p.set(X, Y, c);
    const i = Y * CHAR_W + X;
    if (part === FLAT) flat[i] = 1;
    else {
      pm[i] = part;
      flat[i] = 0;
    }
  };
  const R = (x, y, w, h, c) => {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) S(x + i, y + j, c);
  };
  const as = (q, fn) => {
    const was = part;
    part = q;
    fn();
    part = was;
  };
  if (shoesG) shoes = shoesG;
  const skinC = skel ? hex('#e8e4d4') : skin;
  const shirtC = skel ? hex('#d8d4c4') : shirt;
  const pantsC = skel ? hex('#c8c4b4') : pants;
  const shoeC = skel ? skinC : shoes;

  // ---------------------------------------------------------- legs & shoes
  if (sit && side) {
    // Thigh forward along the seat, shin down to the floor.
    part = LEG_R;
    R(2, legY, 7, 3, pantsC);
    part = LEG_L;
    R(2, legY + 3, 3, Math.max(1, legH - 3), shade(pantsC, 0.92));
    part = SHOE_L;
    R(1, legY + legH, 4, 2, shoeC);
  } else if (!side) {
    const lL = walk > 0 ? legH - 1 : legH;
    const rL = walk < 0 ? legH - 1 : legH;
    part = LEG_L;
    R(5, legY, 3, lL, pantsC);
    part = LEG_R;
    R(8, legY, 3, rL, pantsC);
    part = SHOE_L;
    R(5, legY + lL, 3, 2, shoeC);
    part = SHOE_R;
    R(8, legY + rL, 3, 2, shoeC);
    // (A toe catching the light.)
    if (front && !skel) {
      part = FLAT;
      S(5, legY + lL, lit(shoeC, 1.4));
      S(8, legY + rL, lit(shoeC, 1.4));
    }
  } else if (walk === 0) {
    part = LEG_L;
    R(6, legY, 4, legH, pantsC);
    part = SHOE_L;
    R(5, legY + legH, 5, 2, shoeC);
    if (!skel) as(FLAT, () => S(5, legY + legH, lit(shoeC, 1.4)));
  } else {
    const f = walk > 0 ? 1 : -1;
    part = LEG_L;
    R(6 - f, legY, 3, legH, dim(pantsC, 0.7));
    part = SHOE_L;
    R(5 - f, legY + legH, 4, 2, dim(shoeC, 0.7));
    part = LEG_R;
    R(7 + f, legY, 3, legH, pantsC);
    part = SHOE_R;
    R(6 + f, legY + legH, 4, 2, shoeC);
    if (!skel) as(FLAT, () => S(6 + f, legY + legH, lit(shoeC, 1.4)));
  }
  // (Knees: a crease across the trousers.)
  if (!skel && !sit && legH >= 5) {
    const ky = legY + Math.floor(legH / 2);
    part = FLAT;
    if (!side) {
      if (walk >= 0) S(6, ky, dim(pantsC, 0.6));
      if (walk <= 0) S(9, ky, dim(pantsC, 0.6));
    }
  }
  // (The Stiltfolk roll their trousers to the knee: bare shins.)
  if (outfit === 'tidewrap' && !skel && !sit) {
    const sy = legY + Math.ceil(legH / 2);
    const sh = legH - Math.ceil(legH / 2);
    if (!side) {
      part = LEG_L;
      R(5, sy, 3, sh - (walk > 0 ? 1 : 0), skinC);
      part = LEG_R;
      R(8, sy, 3, sh - (walk < 0 ? 1 : 0), skinC);
      part = FLAT;
      R(5, sy - 1, 3, 1, lit(pantsC, 0.6));
      R(8, sy - 1, 3, 1, lit(pantsC, 0.6));
    } else if (walk === 0) {
      part = LEG_L;
      R(6, sy, 4, sh, skinC);
      as(FLAT, () => R(6, sy - 1, 4, 1, lit(pantsC, 0.6)));
    } else {
      part = LEG_R;
      R(7 + (walk > 0 ? 1 : -1), sy, 3, sh, skinC);
    }
  }

  // ---------------------------------------------------------- the body
  const tx = side ? 5 : 4;
  const tw = side ? 6 : 8;
  const cx = tx + (tw >> 1); // (the middle of the chest, rounded right)
  part = CLOTH;
  R(tx, torsoY, tw, torsoH, shirtC);
  // (A neck, under the chin.)
  if (!skel) {
    part = NECK;
    if (front) R(7, torsoY - 1, 2, 1, dim(skinC, 0.5));
    else if (side) R(6, torsoY - 1, 2, 1, dim(skinC, 0.5));
    else R(7, torsoY - 1, 2, 1, dim(skinC, 0.3));
  }
  part = CLOTH;
  if (skel) {
    // Ribs, and the spine down the middle.
    part = FLAT;
    for (let y = torsoY + 1; y < torsoY + torsoH; y += 2) R(tx + 1, y, tw - 2, 1, hex('#8a8474'));
    if (!side) R(7, torsoY, 2, torsoH, hex('#b8b4a4'));
    part = CLOTH;
  } else if (front && torsoH >= 6) {
    // (A fold under the chest.)
    as(FLAT, () => S(cx + 1, torsoY + 3, dim(shirtC, 0.6)));
  }
  const robe = outfit.startsWith('robe');
  if (outfit === 'guard') {
    part = METAL;
    for (let y = torsoY; y < torsoY + torsoH; y++) for (let x = tx; x < tx + tw; x++) S(x, y, (x + y) % 2 ? hex(oc.chain) : hex(oc.chain2));
    if (!back) {
      // The watch's tabard, its device on the chest.
      part = OVER;
      R(side ? 7 : 6, torsoY, side ? 3 : 4, torsoH + 2, accent);
      as(FLAT, () => {
        if (front) {
          S(7, torsoY + 2, lit(accent, 2.5));
          S(8, torsoY + 2, lit(accent, 2.5));
          S(7, torsoY + 3, lit(accent, 1.5));
        }
        R(side ? 7 : 6, torsoY + torsoH + 1, side ? 3 : 4, 1, dim(accent, 1));
      });
    }
  } else if (outfit === 'smith' || outfit === 'apron' || outfit === 'baker') {
    const ap = hex(oc.apron);
    if (!back) {
      part = OVER;
      R(side ? 5 : 5, torsoY + 1, side ? 4 : 6, torsoH + 3, ap);
      as(FLAT, () => {
        // The strap round the neck, a pocket, the hem.
        if (front) {
          S(5, torsoY, dim(ap, 0.4));
          S(10, torsoY, dim(ap, 0.4));
          R(6, torsoY + 4, 3, 1, dim(ap, 0.9));
          S(6, torsoY + 5, dim(ap, 0.5));
          if (outfit === 'baker') S(9, torsoY + 2, lit(ap, 1));
          if (outfit === 'smith') {
            S(9, torsoY + 6, hex('#2a1a10'));
            S(6, torsoY + 2, lit(ap, 1.2));
          }
        }
        R(side ? 5 : 5, torsoY + torsoH + 3, side ? 4 : 6, 1, dim(ap, 0.9));
      });
    } else {
      // (Tied behind.)
      as(FLAT, () => {
        R(tx, legY - 2, tw, 1, dim(ap, 0.4));
        S(7, legY - 1, ap);
        S(8, legY - 1, dim(ap, 0.5));
      });
    }
  } else if (robe) {
    // Down to the ankles, flaring at the hem, folds falling from the waist;
    // a cord round the middle, and trim at the hem.
    const rc = hex(oc.robe);
    const trim = hex(oc.trim);
    const bot = torsoY + torsoH + legH;
    const sway = walk;
    R(tx, torsoY, tw, torsoH + legH, rc);
    R(tx - 1, bot - 3, tw + 2, 3, rc);
    if (sway) R(sway > 0 ? tx + tw + 1 : tx - 2, bot - 2, 1, 2, rc);
    as(FLAT, () => {
      // Folds falling from the cord (and swinging at the hem as you walk).
      if (!side) {
        for (let y = torsoY + 3; y < bot - 1; y++) S(6 + (y >= bot - 3 ? Math.min(0, sway) : 0), y, dim(rc, 0.7));
        for (let y = torsoY + 5; y < bot - 1; y++) S(9 + (y >= bot - 3 ? Math.max(0, sway) : 0), y, dim(rc, 0.55));
      } else {
        for (let y = torsoY + 3; y < bot - 1; y++) S(tx + 3 + (y >= bot - 3 ? sway : 0), y, dim(rc, 0.6));
      }
      // The cord, and its tassel.
      R(tx, torsoY + 2, tw, 1, trim);
      if (front) {
        S(7, torsoY + 3, trim);
        S(7, torsoY + 4, dim(trim, 0.8));
      }
      // The hem's trim.
      R(tx - 1, bot - 1, tw + 2, 1, trim);
      S(tx, bot - 1, lit(trim, 1.2));
      S(tx + tw, bot - 1, dim(trim, 0.8));
      // (The holy robes have their trim down the front, too.)
      if (front && (outfit === 'robe_white' || outfit === 'robe_saint' || outfit === 'robe_pearl')) {
        for (let y = torsoY + 3; y < bot - 1; y++) S(8, y, y % 2 ? trim : dim(trim, 0.5));
      }
    });
  } else if (outfit === 'noble') {
    // A doublet: puffed and slashed at the shoulder, gold down the front,
    // buttons, a gold belt.
    as(FLAT, () => {
      R(tx, torsoY + torsoH - 1, tw, 1, hex(oc.trim));
      if (!back) {
        R(7, torsoY, 2, torsoH, hex(oc.trim));
        for (let y = torsoY + 1; y < torsoY + torsoH - 1; y += 2) S(7, y, lit(hex(oc.trim), 1.6));
        if (front) {
          S(5, torsoY + 1, dim(accent, 1.2));
          S(10, torsoY + 1, dim(accent, 1.2));
          S(5, torsoY + 3, lit(accent, 0.8));
        }
      } else R(tx + 1, torsoY + 1, tw - 2, 1, dim(accent, 0.6));
    });
  } else if (outfit === 'vest' || outfit === 'fisher' || outfit === 'miner') {
    // An open vest over the shirt: lapels, buttons, a pocket.
    const v = hex(oc.vest);
    part = OVER;
    if (!back) {
      if (side) R(tx + 2, torsoY, tw - 2, torsoH, v);
      else {
        R(tx, torsoY, 2, torsoH, v);
        R(tx + tw - 2, torsoY, 2, torsoH, v);
        S(tx + 2, torsoY, v);
        S(tx + tw - 3, torsoY, v);
      }
      as(FLAT, () => {
        if (front) {
          S(tx + 1, torsoY + 2, lit(v, 1.6));
          S(tx + 1, torsoY + 4, lit(v, 1.6));
          if (outfit === 'fisher') R(10, torsoY + 3, 2, 1, dim(v, 0.9));
          if (outfit === 'miner') R(tx + tw - 2, torsoY + 1, 1, 1, hex('#c8a040'));
        } else R(tx + 3, torsoY + 3, 2, 1, dim(v, 0.8));
      });
    } else R(tx, torsoY, tw, torsoH, v);
  } else if (outfit === 'farmer') {
    // Overalls: the bib, its straps and buckles, a pocket.
    const o = hex(oc.overall);
    part = OVER;
    R(tx + 1, torsoY + 2, tw - 2, torsoH - 2, o);
    if (!back) {
      R(tx + 1, torsoY, 1, 2, o);
      R(tx + tw - 2, torsoY, 1, 2, o);
      as(FLAT, () => {
        if (front) {
          S(tx + 1, torsoY + 1, hex(GOLD));
          S(tx + tw - 2, torsoY + 1, hex(GOLD));
          R(7, torsoY + 3, 2, 2, dim(o, 0.8));
          S(7, torsoY + 3, dim(o, 1.3));
        }
      });
    } else {
      // (Crossed behind.)
      as(FLAT, () => {
        S(tx + 1, torsoY, o);
        S(tx + 2, torsoY + 1, o);
        S(tx + tw - 2, torsoY, o);
        S(tx + tw - 3, torsoY + 1, o);
      });
    }
  } else if (outfit === 'plaid') {
    // A tartan: dark bands crossing, darker where they cross, a pale thread.
    as(FLAT, () => {
      for (let y = torsoY; y < torsoY + torsoH; y++) {
        for (let x = tx; x < tx + tw; x++) {
          const v = x % 3 === 0;
          const h = y % 3 === 0;
          if (v && h) S(x, y, dim(hex(oc.check), 0.6));
          else if (v || h) S(x, y, hex(oc.check));
          else if ((x + y) % 6 === 2) S(x, y, lit(shirtC, 0.8));
        }
      }
    });
  } else if (outfit === 'rags') {
    // Patched, the stitches showing, the hem torn.
    as(FLAT, () => {
      R(tx + 1, torsoY + 1, 2, 2, hex(oc.patch));
      S(tx + 1, torsoY + 1, lit(hex(oc.patch), 1.5));
      R(tx + 5, torsoY + 3, 2, 2, dim(hex(oc.patch), 0.5));
      S(tx + 6, torsoY + 4, lit(hex(oc.patch), 1.5));
      for (let x = tx; x < tx + tw; x += 3) S(x, torsoY + torsoH, dim(shirtC, 0.3));
    });
  } else if (outfit === 'tunic') {
    // Down over the hips, belted; a stitched neck and hem.
    R(tx, torsoY, tw, torsoH + 2, shirtC);
    as(FLAT, () => {
      if (front) {
        S(7, torsoY + 1, dim(shirtC, 0.7));
        for (let x = tx + 1; x < tx + tw; x += 2) S(x, torsoY + torsoH + 1, lit(shirtC, 1));
      }
      R(tx, legY - 1, tw, 1, hex(oc.belt));
      if (front) S(7, legY - 1, hex(oc.buckle));
    });
  } else if (outfit === 'ashwrap') {
    // The Ashborn's wrap: soot-dark, down to the knee, folded over across
    // the chest; a sash of ember red over it, knotted at the hip; a dark
    // hem worked with a zigzag of ember thread.
    const len = torsoH + Math.min(4, legH - 2);
    R(tx, torsoY, tw, len, shirtC);
    as(FLAT, () => {
      if (front) for (let i = 0; i < 4; i++) S(tx + tw - 2 - i, torsoY + i, dim(shirtC, 0.7));
      R(tx, torsoY + len - 1, tw, 1, hex(oc.hem));
      for (let x = tx; x < tx + tw; x += 2) S(x, torsoY + len - 2, dim(hex(oc.sash), 0.5));
    });
    part = OVER;
    if (!back) {
      for (let i = 0; i < torsoH + 1; i++) S(tx + (side ? 1 + (i >> 1) : 1 + i), torsoY + i, hex(oc.sash));
      if (front) {
        as(FLAT, () => {
          S(tx + tw - 1, torsoY + torsoH, lit(hex(oc.sash), 1));
          S(tx + tw - 1, torsoY + torsoH + 1, hex(oc.sash));
          S(tx + tw - 2, torsoY + torsoH + 2, dim(hex(oc.sash), 0.5));
        });
      }
    } else R(tx, torsoY + 3, tw, 1, hex(oc.sash));
  } else if (outfit === 'mistcloak') {
    // The Mirefolk's long cloak: a mantle over the shoulders held at the
    // throat with a brass clasp, falling in folds to a fringe.
    const len = torsoH + legH - 2;
    part = CAPE;
    R(tx, torsoY, tw, len, shirtC);
    if (walk) R(walk > 0 ? tx + tw : tx - 1, torsoY + len - 3, 1, 2, shirtC);
    as(FLAT, () => {
      if (front) {
        R(7, torsoY + 3, 2, len - 4, dim(shirtC, 0.9));
        for (let y = torsoY + 4; y < torsoY + len; y += 2) S(5, y, dim(shirtC, 0.5));
      } else if (back) for (let y = torsoY + 4; y < torsoY + len; y++) if (y % 3) S(7, y, dim(shirtC, 0.6));
      for (let x = tx; x < tx + tw; x += 2) S(x, torsoY + len, hex(oc.fringe));
    });
    part = OVER;
    R(tx - (side ? 0 : 1), torsoY, tw + (side ? 1 : 2), 3, hex(oc.mantle));
    as(FLAT, () => {
      R(tx - (side ? 0 : 1), torsoY + 2, tw + (side ? 1 : 2), 1, dim(hex(oc.mantle), 0.7));
      if (front) S(7, torsoY + 1, hex('#c8a040'));
    });
  } else if (outfit === 'tidewrap') {
    // The Stiltfolk's open vest: bare chest and arms, a sea-blue trim, a
    // rope belt with its knot.
    const v = hex(oc.vest);
    if (front) {
      part = SKIN;
      R(6, torsoY, 4, torsoH, skinC);
      as(FLAT, () => {
        S(7, torsoY + 2, dim(skinC, 0.7));
        S(8, torsoY + 2, dim(skinC, 0.7));
      });
      part = OVER;
      R(tx, torsoY, 2, torsoH, v);
      R(tx + tw - 2, torsoY, 2, torsoH, v);
      as(FLAT, () => {
        R(tx + 1, torsoY, 1, torsoH, hex(oc.trim));
        R(tx + tw - 2, torsoY, 1, torsoH, hex(oc.trim));
      });
    } else {
      part = OVER;
      R(tx, torsoY, tw, torsoH, v);
      as(FLAT, () => R(tx, torsoY + torsoH - 1, tw, 1, hex(oc.trim)));
    }
  } else if (outfit === 'traveller') {
    // A long coat, open down the front over the shirt: its collar turned
    // up, two buttons, pockets.
    const coat = hex(oc.coat);
    part = OVER;
    R(tx, torsoY, tw, torsoH + 3, coat);
    if (walk) R(walk > 0 ? tx + tw : tx - 1, legY + 1, 1, 2, coat);
    as(FLAT, () => {
      R(tx, torsoY, tw, 1, hex(oc.collar));
      if (front) {
        R(7, torsoY + 1, 2, torsoH + 2, shirtC);
        S(6, torsoY + 1, hex(oc.collar));
        S(9, torsoY + 1, hex(oc.collar));
        S(6, torsoY + 3, hex(GOLD));
        S(6, torsoY + 5, hex(GOLD));
        S(tx, torsoY + torsoH + 1, dim(coat, 0.9));
        S(tx + tw - 1, torsoY + torsoH + 1, dim(coat, 0.9));
      } else if (back) {
        R(7, torsoY + 2, 1, torsoH + 1, dim(coat, 0.8));
        R(tx + 2, legY - 1, tw - 4, 1, dim(coat, 0.5));
      }
    });
  }
  // Shirt patterns on everyday clothes.
  const pat = look.pattern;
  if (pat && !skel && ['plain', 'vest', 'fisher', 'miner', 'apron', 'baker', 'smith', 'hunter', 'plaid', 'tunic'].includes(outfit)) {
    as(FLAT, () => {
      if (pat === 'stripes') for (let y = torsoY + 1; y < torsoY + torsoH; y += 2) for (let x = tx; x < tx + tw; x++) if (pm[(y + SPR_PAD) * CHAR_W + (flip ? CHAR_W - 1 - x : x)] === CLOTH) S(x, y, dim(shirtC, 0.9));
      if (pat === 'collar') {
        R(tx + 1, torsoY, tw - 2, 1, hex('#e8e0d0'));
        if (front) {
          S(6, torsoY + 1, hex('#d0c8b8'));
          S(9, torsoY + 1, hex('#d0c8b8'));
        }
      }
      if (pat === 'sash' && !back) {
        for (let i = 0; i < torsoH; i++) S(tx + (side ? 1 + (i >> 1) : 1 + i), torsoY + i, i % 2 ? dim(accent, 0.4) : accent);
      }
      if (pat === 'buttons' && front) for (let y = torsoY + 1; y < torsoY + torsoH; y += 2) S(7, y, hex('#e8d8a0'));
      if (pat === 'patches') {
        R(tx + 1, torsoY + 2, 2, 2, dim(shirtC, 1.4));
        S(tx + 1, torsoY + 2, dim(shirtC, 0.6));
        R(tx + tw - 3, torsoY + 3, 2, 2, lit(shirtC, 1.6));
        S(tx + tw - 2, torsoY + 4, lit(shirtC, 0.6));
      }
    });
  }
  // Belt, and its buckle.
  if (!robe && outfit !== 'farmer' && outfit !== 'tunic' && outfit !== 'ashwrap' && outfit !== 'mistcloak' && outfit !== 'tidewrap') {
    part = BELT;
    R(tx, legY - 1, tw, 1, skel ? dim(pantsC, 1.2) : dim(pantsC, 1.6));
    if (front && !skel) as(FLAT, () => S(7, legY - 1, hex('#c8a850')));
  }
  if (outfit === 'tidewrap' && !skel) {
    // (A rope belt, knotted.)
    as(FLAT, () => {
      for (let x = tx; x < tx + tw; x++) S(x, legY - 1, x % 2 ? hex('#c8a870') : hex('#a08850'));
      if (front) {
        S(9, legY, hex('#c8a870'));
        S(10, legY + 1, hex('#a08850'));
      }
    });
  }
  // Armour over the top.
  if (!skel) {
    const G = (x, y, w, h, c) => R(x, y, w, h, hex(c));
    if (gear.body === 'chain' || gear.body === 'tabard') {
      // Mail: rows of rings, each catching the light.
      const m1 = hex(tint.body && gear.body === 'chain' ? tint.body : '#8a8a98');
      part = METAL;
      for (let y = torsoY; y < torsoY + torsoH; y++) for (let x = tx; x < tx + tw; x++) S(x, y, (x + y) % 2 ? m1 : dim(m1, 1.1));
      as(FLAT, () => {
        for (let y = torsoY; y < torsoY + torsoH; y += 2) for (let x = tx + (y % 4 ? 1 : 0); x < tx + tw - 1; x += 3) S(x, y, lit(m1, 1.5));
      });
      part = BELT;
      G(tx, legY - 1, tw, 1, '#5a4030');
      if (front) as(FLAT, () => S(7, legY - 1, hex('#c8a850')));
      // The watch's tabard over the mail, in the town's colours.
      const tb = hex(tint.body || '#b03030');
      if (gear.body === 'tabard') {
        part = OVER;
        if (!back) {
          R(side ? 7 : 6, torsoY, side ? 3 : 4, torsoH + 2, tb);
          as(FLAT, () => {
            if (front) {
              S(7, torsoY + 2, lit(tb, 2.5));
              S(8, torsoY + 2, lit(tb, 2.5));
              S(7, torsoY + 3, lit(tb, 1.4));
              S(8, torsoY + 3, lit(tb, 1.4));
            }
            R(side ? 7 : 6, torsoY + torsoH + 1, side ? 3 : 4, 1, dim(tb, 0.9));
          });
        } else R(tx + 1, torsoY, tw - 2, torsoH, tb);
      }
    } else if (gear.body === 'plate') {
      // Plate: a breastplate with a ridge down it and a shine, rivets,
      // pauldrons at the shoulders, a fauld over the hips.
      const pl = shirt;
      part = METAL;
      R(tx, torsoY, tw, torsoH, pl);
      as(FLAT, () => {
        R(tx, torsoY + torsoH - 1, tw, 1, dim(pl, 1));
        if (front) {
          R(7, torsoY + 1, 1, torsoH - 2, lit(pl, 1.4));
          S(8, torsoY + 1, dim(pl, 0.5));
          S(5, torsoY + 1, lit(pl, 2.4));
          S(tx, torsoY + torsoH - 1, lit(pl, 0.4));
          S(tx + tw - 1, torsoY + torsoH - 1, dim(pl, 1.4));
        } else if (back) R(tx + 1, torsoY + 2, tw - 2, 1, dim(pl, 0.6));
      });
      if (!back && !side) {
        part = METAL;
        R(2, torsoY - 1, 3, 2, lit(pl, 0.4));
        R(11, torsoY - 1, 3, 2, pl);
        as(FLAT, () => {
          S(3, torsoY - 1, lit(pl, 2));
          S(12, torsoY, dim(pl, 1.4));
        });
      } else if (side) {
        part = METAL;
        R(6, torsoY - 1, 4, 2, lit(pl, 0.3));
      }
    } else if (gear.body === 'leather') {
      // Leather: laced up the front, a shoulder strap, stitched seams.
      const lc = shirt;
      as(FLAT, () => {
        if (front) {
          for (let y = torsoY + 1; y < torsoY + torsoH - 1; y++) S(y % 2 ? 7 : 8, y, hex('#3a2414'));
          for (let i = 0; i < torsoH; i++) S(tx + tw - 1 - i, torsoY + i, i % 2 ? dim(lc, 1.3) : dim(lc, 0.9));
        }
        for (let x = tx + 1; x < tx + tw; x += 2) S(x, torsoY + torsoH - 2, lit(lc, 1.2));
      });
      part = BELT;
      G(tx, legY - 1, tw, 1, '#3a2414');
    } else if (gear.body === 'coat') {
      // A fine coat, gold-braided, its skirts to the thigh.
      const cc = hex(GEAR.coat.shirt);
      part = OVER;
      R(tx, torsoY, tw, torsoH + 3, cc);
      if (walk) R(walk > 0 ? tx + tw : tx - 1, legY + 1, 1, 2, cc);
      as(FLAT, () => {
        if (!back) {
          R(7, torsoY, 2, torsoH + 3, hex('#c8a030'));
          for (let y = torsoY + 1; y < torsoY + torsoH + 2; y += 2) S(front ? 6 : 7, y, hex('#f0d060'));
        } else R(7, torsoY + 3, 1, torsoH, dim(cc, 0.8));
        R(tx, torsoY, tw, 1, hex('#c8a030'));
      });
    } else if (gear.body === 'linen' && front) as(FLAT, () => G(tx + 2, torsoY, tw - 4, 1, '#c8c0a8'));
    else if (gear.body === 'kav') {
      part = METAL;
      R(tx, torsoY, tw, torsoH, hex(GEAR.kav.shirt));
      as(FLAT, () => {
        G(tx, torsoY, tw, 1, '#4a4870');
        if (!back) {
          G(7, torsoY + 1, 2, torsoH - 1, '#24223a');
          G(side ? 8 : 7, torsoY + 2, 1, torsoH - 3, '#5ad8f0');
          G(side ? 8 : 7, torsoY + 2, 1, 1, '#c8fbff');
        } else G(tx + 1, torsoY + 3, tw - 2, 1, '#5ad8f0');
      });
    }
    if (!sit) {
      const ky = legY + Math.floor(legH / 2);
      const knee = (c, glow) => {
        as(glow ? FLAT : METAL, () => {
          if (!side) {
            G(5, ky, 3, 1, c);
            G(8, ky, 3, 1, c);
          } else G(6, ky, 4, 1, c);
        });
      };
      if (gear.legs === 'kav') knee('#5ad8f0', true);
      if (gear.legs === 'plate') knee('#d0d4e0', false);
    }
    if (gear.feet) {
      // Boots come up over the ankle, with a turned-down top.
      const bc = hex(GEAR[gear.feet]?.shoes || '#4a2e1a');
      if (!sit) {
        part = gear.feet === 'iron' || gear.feet === 'plate' ? METAL : SHOE_L;
        if (!side) {
          R(5, legY + legH - 2, 3, 2, bc);
          part = part === METAL ? METAL : SHOE_R;
          R(8, legY + legH - 2, 3, 2, bc);
          as(FLAT, () => {
            R(5, legY + legH - 2, 3, 1, lit(bc, 0.8));
            R(8, legY + legH - 2, 3, 1, lit(bc, 0.8));
          });
        } else {
          R(6, legY + legH - 2, 4, 2, bc);
          as(FLAT, () => R(6, legY + legH - 2, 4, 1, lit(bc, 0.8)));
        }
      }
    }
  }
  // ---------------------------------------------------------- arms
  const armC = robe ? hex(oc.robe) : outfit === 'traveller' ? hex(oc.coat) : gear.body === 'coat' ? hex(GEAR.coat.shirt) : outfit === 'guard' || gear.body === 'tabard' || gear.body === 'chain' ? hex(gear.body === 'chain' && tint.body ? tint.body : OUTFIT_COLORS.guard.chain2) : gear.body === 'plate' ? shirt : outfit === 'tidewrap' && !gear.body ? skinC : outfit === 'mistcloak' ? dim(shirtC, 0.4) : shirtC;
  const armMetal = !skel && (gear.body === 'plate' || gear.body === 'chain' || gear.body === 'tabard' || outfit === 'guard');
  // A kerchief at the neck.
  if (look.neck && !skel) {
    const nc = hex(look.neck);
    part = OVER;
    R(tx + 1, torsoY, tw - 2, 1, nc);
    as(FLAT, () => {
      if (front) {
        S(7, torsoY + 1, nc);
        S(8, torsoY + 1, dim(nc, 0.8));
        S(7, torsoY + 2, dim(nc, 0.6));
      } else if (back) S(side ? 8 : 7, torsoY + 1, dim(nc, 0.7));
    });
  }
  // A cloak: seen from the front, its edges behind your arms; from the
  // side, hanging behind you (and lifting behind as you walk); from
  // behind, all of it.
  const cape = look.cape && !skel && !sit ? hex(look.cape) : null;
  if (cape && front) {
    part = CAPE;
    R(3, torsoY, 1, torsoH + 3, dim(cape, 0.6));
    R(12, torsoY, 1, torsoH + 3, dim(cape, 1));
    as(FLAT, () => {
      S(tx + 1, torsoY, hex(GOLD));
      S(tx + tw - 2, torsoY, hex(GOLD));
    });
  } else if (cape && side) {
    part = CAPE;
    const fl = walk ? 1 : 0;
    R(tx + tw, torsoY, 2, torsoH + legH - 1 - fl, cape);
    if (fl) R(tx + tw + 2, torsoY + torsoH + legH - 5, 1, 3, cape);
    as(FLAT, () => R(tx + tw + 1, torsoY + 2, 1, torsoH + legH - 4 - fl, dim(cape, 0.7)));
  }
  // (Gloved hands.)
  const handC = look.gloves && !skel ? hex(look.gloves) : skinC;
  // A shield on the off arm (on the back, seen from behind).
  const shieldAt = (sx0, sy0) => {
    const kind = gear.shield;
    const face = hex(tint.shield || (kind === 'iron' ? '#9a9aa8' : kind === 'round' ? '#b83a32' : '#8a5a2a'));
    const rim = hex(kind === 'iron' ? '#c8c8d4' : '#5a3a1a');
    part = METAL;
    R(sx0, sy0, 4, 5, rim);
    part = FLAT;
    R(sx0 + 1, sy0 + 1, 2, 3, face);
    S(sx0 + 1, sy0 + 1, lit(face, 1.5));
    S(sx0 + 2, sy0 + 3, dim(face, 1));
    if (kind === 'round') S(sx0 + 1, sy0 + 2, hex('#e8d8a0'));
    if (kind !== 'iron') S(sx0 + 2, sy0 + 2, hex('#c8c8d4'));
  };
  if (!side) {
    const swing = frame === 3 ? -2 : walk;
    const ah = torsoH - 1;
    for (const [x, q, up] of [[3, ARM_L, swing > 0], [12, ARM_R, swing < 0]]) {
      const y0 = torsoY + (up ? -1 : 0);
      part = armMetal ? METAL : q;
      R(x, y0, 1, ah, armC);
      // A cuff, or the edge of a sleeve, and the hand.
      if (!skel && !armMetal && armC !== skinC) as(FLAT, () => S(x, y0 + ah - 1, dim(armC, 0.7)));
      if (robe && !skel) as(FLAT, () => S(x === 3 ? 2 : 13, y0 + ah - 1, armC));
      part = FLAT;
      S(x, y0 + ah, x === 3 ? handC : dim(handC, 0.5));
    }
  } else {
    const ax = frame === 3 ? 4 : 7 + walk;
    part = armMetal ? METAL : ARM_R;
    R(ax, torsoY + 1, 2, torsoH - 2, armC);
    as(FLAT, () => {
      S(ax + 1, torsoY + 1, dim(armC, 0.5));
      if (!armMetal && armC !== skinC && !skel) R(ax, torsoY + torsoH - 2, 2, 1, dim(armC, 0.6));
      R(ax, torsoY + torsoH - 1, 2, 1, handC);
      S(ax + 1, torsoY + torsoH - 1, dim(handC, 0.5));
      if (frame === 3) {
        R(2, torsoY + 2, 3, 2, handC);
        S(2, torsoY + 3, dim(handC, 0.6));
      }
    });
  }
  if (cape && back) {
    // The cloak from behind: gathered at the shoulders, falling in folds,
    // swinging as you walk.
    part = CAPE;
    const len = torsoH + legH - 2;
    R(tx - 1, torsoY, tw + 2, len, cape);
    if (walk) R(walk > 0 ? tx + tw + 1 : tx - 2, torsoY + len - 4, 1, 3, cape);
    as(FLAT, () => {
      R(tx - 1, torsoY, tw + 2, 1, lit(cape, 0.8));
      for (const fx of [tx + 1, tx + tw - 2]) for (let y = torsoY + 2; y < torsoY + len - 1; y++) if ((y + fx) % 4) S(fx + (walk && y > torsoY + len - 4 ? walk : 0), y, dim(cape, 0.8));
      R(tx - 1, torsoY + len - 1, tw + 2, 1, dim(cape, 0.6));
    });
  }
  if (gear.shield && !sit) {
    if (front) shieldAt(1, torsoY + 1);
    else if (back) shieldAt(6, torsoY);
    else shieldAt(1, torsoY + 1);
  }

  // ---------------------------------------------------------- the head
  const hx = 4;
  part = SKIN;
  R(hx, hy, 8, headH, skinC);
  // (The jaw rounded off at its corners.)
  if (!skel) {
    p.clear(flip ? CHAR_W - 1 - hx : hx, hy + headH - 1 + SPR_PAD);
    p.clear(flip ? CHAR_W - 1 - (hx + 7) : hx + 7, hy + headH - 1 + SPR_PAD);
    for (const x of [hx, hx + 7]) {
      const i = (hy + headH - 1 + SPR_PAD) * CHAR_W + (flip ? CHAR_W - 1 - x : x);
      pm[i] = 0;
      flat[i] = 0;
    }
  }
  const style = look.hairStyle;
  const hairC = skel ? skinC : hair;
  const hat = look.hat;
  const hiHair = lit(hairC, 1.6);
  if (!skel && style !== 'bald') {
    part = HAIR;
    if (back) {
      R(hx, hy, 8, headH - 1, hairC);
      if (style === 'long' || style === 'braids') R(hx, hy + headH - 1, 8, 3, hairC);
      if (style === 'ponytail') R(7, hy + headH - 1, 2, 4, hairC);
      if (style === 'bun') R(6, hy - 1, 4, 2, hairC);
      if (style === 'afro') R(hx - 1, hy - 2, 10, headH + 1, hairC);
      if (style === 'pigtails') {
        R(hx - 1, hy + 3, 1, 4, hairC);
        R(hx + 8, hy + 3, 1, 4, hairC);
      }
      // (Strands falling, and the crown's shine.)
      as(FLAT, () => {
        R(hx + 2, hy + 2, 1, 3, dim(hairC, 0.5));
        R(hx + 5, hy + 3, 1, 3, dim(hairC, 0.5));
        S(hx + 2, hy + 1, hiHair);
        S(hx + 3, hy + 1, lit(hairC, 0.8));
        if (style === 'braids') for (let y = hy + headH - 1; y < hy + headH + 2; y++) S(hx + (y % 2 ? 2 : 5), y, dim(hairC, 0.8));
      });
    } else if (side) {
      R(hx, hy, 8, 2, hairC);
      R(hx + 5, hy, 3, headH - 2, hairC);
      if (style === 'long' || style === 'braids') R(hx + 5, hy, 3, headH + 2, hairC);
      if (style === 'ponytail') R(hx + 7, hy + 2, 2, 4, hairC);
      if (style === 'bun') R(hx + 6, hy - 1, 3, 2, hairC);
      if (style === 'mohawk') R(hx + 2, hy - 2, 3, 2, hairC);
      if (style === 'afro') R(hx - 1, hy - 2, 10, 5, hairC);
      if (style === 'pigtails') R(hx + 6, hy + 3, 2, 4, hairC);
      as(FLAT, () => {
        S(hx + 2, hy, hiHair);
        S(hx + 6, hy + 2, dim(hairC, 0.6));
        S(hx + 5, hy + 3, dim(hairC, 0.4));
      });
    } else {
      R(hx, hy, 8, 2, hairC);
      R(hx, hy + 2, 1, 3, hairC);
      R(hx + 7, hy + 2, 1, 3, hairC);
      if (style === 'long' || style === 'braids') {
        R(hx, hy + 2, 1, headH + 2, hairC);
        R(hx + 7, hy + 2, 1, headH + 2, hairC);
      }
      if (style === 'curly') {
        R(hx - 1, hy, 1, 4, hairC);
        R(hx + 8, hy, 1, 4, hairC);
      }
      if (style === 'bun') R(6, hy - 2, 4, 2, hairC);
      if (style === 'mohawk') R(6, hy - 2, 4, 2, hairC);
      if (style === 'short') S(hx + 3, hy + 2, hairC);
      if (style === 'sidepart') R(hx, hy + 2, 3, 1, hairC);
      if (style === 'afro') {
        R(hx - 1, hy - 2, 10, 3, hairC);
        R(hx - 1, hy + 1, 1, 4, hairC);
        R(hx + 8, hy + 1, 1, 4, hairC);
      }
      if (style === 'pigtails') {
        R(hx - 1, hy + 3, 1, 4, hairC);
        R(hx + 8, hy + 3, 1, 4, hairC);
      }
      // (A parting, and the shine across the top.)
      as(FLAT, () => {
        S(hx + 2, hy, hiHair);
        S(hx + 3, hy, lit(hairC, 0.9));
        S(hx + 5, hy + 1, dim(hairC, 0.5));
        if (style === 'curly') {
          S(hx - 1, hy + 1, lit(hairC, 0.8));
          S(hx + 8, hy + 2, dim(hairC, 0.6));
        }
      });
    }
    if (style === 'spiky') for (let x = hx; x < hx + 8; x += 2) S(x + 1, hy - 1, x < hx + 4 ? lit(hairC, 0.6) : hairC);
    if (style === 'topknot') {
      R(side ? hx + 4 : 7, hy - 3, 2, 3, hairC);
      as(FLAT, () => S(side ? hx + 4 : 7, hy - 3, hiHair));
    }
    if (style === 'wavy') {
      // (Down to the jaw, in waves.)
      const wv = dim(hairC, 0.7);
      if (back) {
        R(hx, hy + headH - 1, 8, 2, hairC);
        for (let x = hx; x < hx + 8; x += 2) S(x, hy + headH + 1, hairC);
        as(FLAT, () => {
          for (let x = hx + 1; x < hx + 8; x += 3) R(x, hy + 1, 1, headH - 1, wv);
        });
      } else if (side) {
        R(hx + 5, hy, 3, headH + 1, hairC);
        S(hx + 8, hy + 2, hairC);
        S(hx + 8, hy + 5, hairC);
        as(FLAT, () => R(hx + 6, hy + 1, 1, headH - 1, wv));
      } else {
        for (const x of [hx - 1, hx + 8]) {
          R(x, hy + 1, 1, 3, hairC);
          S(x, hy + 5, hairC);
        }
        R(hx, hy + 2, 1, 5, hairC);
        R(hx + 7, hy + 2, 1, 5, hairC);
        as(FLAT, () => R(hx + 2, hy, 3, 1, lit(hairC, 0.9)));
      }
    }
    if (style === 'undercut') {
      // (Shaved at the sides, the top swept over.)
      const sh = dim(skinC, 0.6);
      as(FLAT, () => {
        if (back) R(hx, hy + 3, 8, headH - 4, sh);
        else if (side) {
          R(hx + 5, hy + 2, 3, headH - 4, sh);
          R(hx, hy - 1, 6, 1, hairC);
        } else {
          R(hx, hy + 2, 1, 3, sh);
          R(hx + 7, hy + 2, 1, 3, sh);
          R(hx + 1, hy - 1, 6, 1, hairC);
          S(hx + 6, hy + 2, hairC);
          S(hx + 2, hy - 1, hiHair);
        }
      });
    }
  }
  // Marks on the face (paint, ink, a blush, a mole), under the eyes.
  const mark = look.mark;
  part = FLAT;
  if (mark && !skel && !back) {
    const M = (x, y, c) => S(x, y, typeof c === 'string' ? hex(c) : c);
    if (mark === 'warpaint') {
      if (front) for (let x = hx + 1; x < hx + 7; x++) M(x, hy + 4, '#2a5aa8');
      else R(hx, hy + 4, 3, 1, hex('#2a5aa8'));
    } else if (mark === 'tattoo') {
      if (front) R(hx + 5, hy + 5, 1, 2, hex('#2a4a6a'));
      else R(hx + 1, hy + 5, 1, 2, hex('#2a4a6a'));
    } else if (mark === 'blush') {
      if (front) {
        M(hx + 1, hy + 5, '#e88a7a');
        M(hx + 6, hy + 5, '#e88a7a');
      } else M(hx + 2, hy + 5, '#e88a7a');
    } else if (mark === 'mole') {
      if (front) M(hx + 5, hy + 5, shade(skinC, 0.55));
      else M(hx + 1, hy + 5, shade(skinC, 0.55));
    } else if (mark === 'tidelines') {
      // (Blue waves under the eyes: a Stiltfolk's tattoo.)
      M(hx + 1, hy + 5, '#2a6a9a');
      M(hx + 2, hy + 6, '#2a6a9a');
      if (front) {
        M(hx + 6, hy + 5, '#2a6a9a');
        M(hx + 5, hy + 6, '#2a6a9a');
      }
    } else if (mark === 'stripes') {
      if (front) {
        R(hx + 1, hy + 5, 1, 2, hex('#c83a32'));
        R(hx + 6, hy + 5, 1, 2, hex('#c83a32'));
      } else R(hx + 2, hy + 5, 1, 2, hex('#c83a32'));
    }
  }
  // The face: brows, eyes with a catchlight, the nose's shadow, a mouth.
  const eye = skel ? hex('#1a1414') : hex(look.eyeColor || '#1e1a28');
  if (front) {
    if (skel) {
      R(hx + 2, hy + 3, 2, 2, eye);
      R(hx + 5, hy + 3, 2, 2, eye);
      S(hx + 4, hy + 5, eye);
      R(hx + 2, hy + 6, 4, 1, eye);
      for (let x = hx + 2; x < hx + 6; x += 2) S(x, hy + 6, hex('#e8e4d4'));
    } else {
      S(hx + 2, hy + 4, eye);
      S(hx + 5, hy + 4, eye);
      if (style !== 'bald' || look.beard) {
        S(hx + 2, hy + 3, mix(skinC, hairC, 0.45));
        S(hx + 5, hy + 3, mix(skinC, hairC, 0.45));
      }
      if (!look.beard || look.beardStyle === 'stubble' || look.beardStyle === 'chinstrap') S(hx + 3, hy + 6, dim(skinC, 1.1));
    }
  } else if (side) {
    if (skel) R(hx, hy + 3, 2, 2, eye);
    else {
      S(hx + 1, hy + 4, eye);
      if (style !== 'bald' || look.beard) S(hx + 1, hy + 3, dim(hairC, 0.4));
      S(hx - 1, hy + 4, skinC);
      S(hx, hy + 6, dim(skinC, 0.9));
    }
  }
  // A beard, worn one way or another.
  if (look.beard && !skel && !back) {
    const bs = look.beardStyle || 'full';
    part = HAIR;
    if (bs === 'full' || bs === 'long') {
      if (front) R(hx + 1, hy + 5, 6, 2, hairC);
      else R(hx, hy + 5, 4, 2, hairC);
      if (bs === 'long') {
        if (front) R(hx + 2, hy + 7, 4, 2, hairC);
        else R(hx, hy + 7, 3, 2, hairC);
      }
      as(FLAT, () => {
        if (front) {
          S(hx + 3, hy + 5, dim(hairC, 0.8));
          S(hx + 4, hy + 5, dim(hairC, 0.8));
          S(hx + 2, hy + 6, lit(hairC, 0.8));
        }
      });
    } else if (bs === 'goatee') {
      if (front) {
        R(hx + 2, hy + 5, 4, 1, hairC);
        R(hx + 3, hy + 6, 2, 2, hairC);
      } else R(hx, hy + 5, 2, 2, hairC);
    } else if (bs === 'stubble') {
      part = FLAT;
      const st = mix(skinC, hairC, 0.45);
      if (front) {
        for (let y = hy + 5; y < hy + 7; y++) for (let x = hx + 1; x < hx + 7; x++) if ((x + y) % 2 && !(x === hx + 3 && y === hy + 6)) S(x, y, st);
      } else for (let y = hy + 5; y < hy + 7; y++) for (let x = hx; x < hx + 4; x++) if ((x + y) % 2) S(x, y, st);
    } else if (bs === 'chinstrap') {
      if (front) {
        R(hx, hy + 3, 1, 3, hairC);
        R(hx + 7, hy + 3, 1, 3, hairC);
        R(hx + 1, hy + 6, 6, 1, hairC);
      } else {
        R(hx + 3, hy + 3, 1, 3, hairC);
        R(hx, hy + 6, 4, 1, hairC);
      }
    }
    part = FLAT;
  }
  // Eyes that burn in the dark (the dead, the drowned, constructs).
  if (look.eyes) {
    const ec = hex(look.eyes);
    part = FLAT;
    if (look.visor) {
      if (front) {
        R(hx + 1, hy + 4, 6, 1, ec);
        S(hx + 2, hy + 4, lit(ec, 2));
      } else if (side) R(hx, hy + 4, 3, 1, ec);
    } else if (front) {
      S(hx + 2, hy + 4, ec);
      S(hx + 5, hy + 4, ec);
    } else if (side) S(hx + 1, hy + 4, ec);
  }
  // Face details and accessories.
  const acc = look.acc;
  if (acc && !skel) {
    const A = (x, y, c) => S(x, y, hex(c));
    part = FLAT;
    if (acc === 'glasses') {
      if (front) {
        for (const x of [hx + 1, hx + 3, hx + 4, hx + 6]) A(x, hy + 4, '#c8c8d8');
        A(hx + 2, hy + 3, '#c8c8d8');
        A(hx + 5, hy + 3, '#c8c8d8');
      } else if (side) {
        A(hx, hy + 4, '#c8c8d8');
        A(hx + 2, hy + 4, '#c8c8d8');
      }
    } else if (acc === 'earring') {
      if (front) {
        A(hx, hy + 5, '#e8c030');
        A(hx + 7, hy + 5, '#e8c030');
      } else if (side) A(hx + 4, hy + 5, '#e8c030');
    } else if (acc === 'freckles' && front) {
      S(hx + 1, hy + 5, shade(skinC, 0.78));
      S(hx + 6, hy + 5, shade(skinC, 0.78));
      S(hx + 2, hy + 5, shade(skinC, 0.85));
    } else if (acc === 'mustache' && !look.beard) {
      if (front) {
        R(hx + 2, hy + 5, 4, 1, hairC);
        S(hx + 1, hy + 6, hairC);
        S(hx + 6, hy + 6, hairC);
      } else if (side) R(hx, hy + 5, 2, 1, hairC);
    } else if (acc === 'scar') {
      if (front) {
        A(hx + 5, hy + 3, '#a0584a');
        A(hx + 6, hy + 5, '#a0584a');
      } else if (side) A(hx + 2, hy + 3, '#a0584a');
    } else if (acc === 'ashmask') {
      // (The Ashborn's mask against the ash: dark cloth, two red vents.)
      if (front) {
        R(hx + 1, hy + 5, 6, 2, hex('#3a3436'));
        R(hx + 1, hy + 5, 6, 1, hex('#4a4446'));
        A(hx + 2, hy + 6, '#c84a1a');
        A(hx + 5, hy + 6, '#c84a1a');
      } else if (side) {
        R(hx, hy + 5, 4, 2, hex('#3a3436'));
        A(hx + 1, hy + 6, '#c84a1a');
      } else R(hx, hy + 5, 8, 1, hex('#3a3436'));
    } else if (acc === 'shells') {
      // (A string of shells round the neck.)
      if (front) for (let x = 5; x <= 10; x++) S(x, torsoY + (x === 5 || x === 10 ? 0 : 1), hex(x % 2 ? '#f0e8d8' : '#e8a8a0'));
      else if (side) for (let x = 5; x <= 8; x++) S(x, torsoY + 1, hex(x % 2 ? '#f0e8d8' : '#e8a8a0'));
    } else if (acc === 'eyepatch') {
      if (!back) R(hx, hy + 3, 8, 1, hex('#1a1414'));
      if (front) R(hx + 5, hy + 3, 2, 2, hex('#1a1414'));
      else if (side) R(hx, hy + 3, 2, 2, hex('#1a1414'));
    } else if (acc === 'goggles') {
      if (front) {
        R(hx, hy + 3, 8, 1, hex('#3a2a1e'));
        R(hx + 1, hy + 3, 2, 2, hex('#2a2430'));
        R(hx + 5, hy + 3, 2, 2, hex('#2a2430'));
        A(hx + 1, hy + 3, '#c87a40');
        A(hx + 5, hy + 3, '#c87a40');
      } else if (side) R(hx, hy + 3, 2, 2, hex('#2a2430'));
    }
  }
  // ---------------------------------------------------------- hats
  if (hat) {
    part = HAT;
    const H = (x, y, w, h, c) => R(x, y, w, h, hex(c));
    const F = (x, y, w, h, c) => as(FLAT, () => R(x, y, w, h, typeof c === 'string' ? hex(c) : c));
    switch (hat) {
      case 'straw':
        // (Woven: a weave of light and dark across the crown.)
        H(hx - 2, hy + 1, 12, 1, '#e8c860');
        H(hx + 1, hy - 1, 6, 2, '#d8b448');
        F(hx + 1, hy, 6, 1, '#a0602a');
        for (let x = hx - 2; x < hx + 10; x += 2) F(x, hy + 1, 1, 1, '#c8a040');
        break;
      case 'helmet':
        part = METAL;
        H(hx, hy - 1, 8, 4, '#9a9aa8');
        F(hx, hy - 1, 8, 1, '#d0d0dc');
        F(hx, hy + 2, 8, 1, '#6a6a78');
        if (front) {
          H(hx + 3, hy + 2, 2, 3, '#7a7a88');
          F(hx + 3, hy + 2, 1, 3, '#a8a8b8');
        }
        F(hx + 3, hy - 3, 2, 2, accent);
        F(hx + 3, hy - 3, 1, 1, lit(accent, 1.5));
        break;
      case 'chef':
        H(hx + 1, hy - 4, 6, 5, '#f4f4f0');
        H(hx - 0, hy - 5, 3, 2, '#f4f4f0');
        H(hx + 5, hy - 5, 3, 2, '#f4f4f0');
        F(hx + 3, hy - 3, 1, 3, '#d8d8d4');
        H(hx, hy, 8, 1, '#e0e0dc');
        break;
      case 'miner':
        H(hx, hy - 1, 8, 3, '#c8a030');
        F(hx - 1, hy + 1, 10, 1, '#a08020');
        if (front) {
          F(hx + 3, hy - 1, 2, 2, '#4a3a20');
          F(hx + 3, hy, 2, 1, '#fff8a0');
          F(hx + 3, hy - 1, 1, 1, '#ffffff');
        }
        break;
      case 'cap':
        H(hx, hy - 1, 8, 2, '#4a5a7a');
        F(hx + 3, hy - 1, 1, 1, '#6a7a9a');
        if (front || side) F(side ? hx - 2 : hx + 1, hy + 1, side ? 3 : 6, 1, '#2a3a5a');
        break;
      case 'feather':
        H(hx - 1, hy, 10, 1, '#3a2a4a');
        H(hx + 1, hy - 2, 6, 2, '#4a3a5a');
        F(hx + 1, hy - 1, 6, 1, '#c8a030');
        F(hx + 6, hy - 5, 1, 4, '#e8e0c0');
        F(hx + 7, hy - 6, 1, 2, '#ffffff');
        F(hx + 5, hy - 3, 1, 1, '#c8c0a0');
        break;
      case 'scarf':
        H(hx, hy - 1, 8, 3, '#e0d0b0');
        F(hx + 1, hy, 6, 1, '#c8b890');
        if (!front) H(hx + (side ? 5 : 0), hy + 2, side ? 3 : 8, 5, '#d0c0a0');
        if (back) F(hx + 3, hy + 4, 2, 3, '#b8a888');
        break;
      case 'fur':
        // (A round cap of hide, a thick roll of fur about it and flaps
        // over the ears: no points along the top, or it's a crown.)
        H(hx + 1, hy - 3, 6, 1, '#4a3222');
        H(hx, hy - 2, 8, 2, '#5a3e2a');
        F(hx + 2, hy - 3, 2, 1, '#6a4a34');
        F(hx + 1, hy - 2, 2, 1, '#7a5a40');
        H(hx - 1, hy, 10, 2, '#b8987a');
        for (const [x, y, c] of [[0, 0, '#d4b898'], [3, 0, '#d4b898'], [4, 0, '#c8aa8a'], [8, 0, '#d4b898'], [1, 1, '#9a7a5c'], [5, 1, '#a0805e'], [7, 1, '#9a7a5c']]) F(hx - 1 + x, hy + y, 1, 1, c);
        if (side) {
          H(hx + 3, hy + 2, 2, 3, '#b8987a');
          F(hx + 3, hy + 4, 2, 1, '#9a7a5c');
        } else {
          H(hx - 1, hy + 2, 2, 3, '#b8987a');
          H(hx + 7, hy + 2, 2, 3, '#b8987a');
          F(hx - 1, hy + 4, 2, 1, '#9a7a5c');
          F(hx + 7, hy + 4, 2, 1, '#9a7a5c');
        }
        break;
      case 'beret': {
        const bc = look.hatColor || '#8a2a3a';
        H(hx - 1, hy - 1, 9, 2, bc);
        H(hx + 6, hy - 2, 2, 1, bc);
        F(hx, hy - 1, 3, 1, lit(hex(bc), 1));
        F(hx + 4, hy - 2, 1, 1, dim(hex(bc), 0.5));
        break;
      }
      case 'bandana': {
        const bc = look.hatColor || '#c83a32';
        H(hx, hy, 8, 2, bc);
        for (let x = hx + 1; x < hx + 8; x += 3) F(x, hy, 1, 1, '#f0e8dc');
        if (back) H(hx + 3, hy + 2, 2, 2, bc);
        else if (side) H(hx + 7, hy + 1, 2, 2, bc);
        break;
      }
      case 'wide':
        H(hx - 2, hy, 12, 1, '#4a3424');
        H(hx + 1, hy - 3, 6, 3, '#5a4030');
        F(hx + 1, hy - 1, 6, 1, look.hatColor || '#8a2a2a');
        F(hx + 3, hy - 3, 2, 1, '#3a2818');
        break;
      case 'circlet':
        H(hx, hy + 1, 8, 1, '#e0b830');
        F(hx + 1, hy + 1, 1, 1, '#fff0a0');
        if (front) {
          F(hx + 3, hy + 1, 2, 1, '#50c0e0');
          F(hx + 3, hy, 2, 1, '#e0b830');
        }
        break;
      case 'goggles':
        // (Two smoked lenses on a leather strap.)
        H(hx, hy + 2, 8, 1, '#3a2a1e');
        if (front) {
          F(hx + 1, hy + 2, 2, 2, '#2a2430');
          F(hx + 5, hy + 2, 2, 2, '#2a2430');
          F(hx + 1, hy + 2, 1, 1, '#c87a40');
          F(hx + 5, hy + 2, 1, 1, '#c87a40');
        } else if (side) F(hx, hy + 2, 2, 2, '#2a2430');
        break;
      case 'flower':
        F(side ? hx + 5 : hx + 6, hy, 2, 1, '#f080b0');
        F(side ? hx + 6 : hx + 7, hy - 1, 1, 1, '#ffe070');
        F(side ? hx + 5 : hx + 6, hy + 1, 1, 1, '#4a8a3a');
        break;
      case 'lcap':
        H(hx, hy - 1, 8, 3, '#7a5232');
        F(hx, hy + 1, 8, 1, '#5a3a1e');
        for (let x = hx + 1; x < hx + 8; x += 3) F(x, hy, 1, 1, '#a07a50');
        if (side) H(hx + 7, hy + 2, 1, 3, '#7a5232');
        break;
      case 'kav':
        part = METAL;
        H(hx, hy - 1, 8, 4, '#2a2840');
        F(hx, hy - 1, 8, 1, '#4a4870');
        F(hx + 3, hy - 2, 2, 1, '#5ad8f0');
        if (front) {
          F(hx + 1, hy + 3, 6, 1, '#5ad8f0');
          F(hx + 2, hy + 3, 1, 1, '#c8fbff');
        } else if (side) F(hx, hy + 3, 3, 1, '#5ad8f0');
        break;
      case 'hood': {
        const hc = look.hatColor || '#6a4a2a';
        H(hx - 1, hy - 1, 10, 3, hc);
        H(hx - 1, hy + 2, 1, 5, hc);
        H(hx + 8, hy + 2, 1, 5, hc);
        F(hx, hy + 1, 8, 1, dim(hex(hc), 0.8));
        if (back) {
          H(hx, hy, 8, headH - 1, hc);
          F(hx + 3, hy + 2, 2, 3, dim(hex(hc), 0.6));
        }
        break;
      }
      case 'cowl': {
        // (A dark hood, and a cloth over the mouth and nose.)
        const cw = look.hatColor || '#2a2a32';
        H(hx - 1, hy - 1, 10, 3, cw);
        H(hx - 1, hy + 2, 1, 5, cw);
        H(hx + 8, hy + 2, 1, 5, cw);
        if (front) {
          H(hx, hy + 5, 8, 2, '#1e1e26');
          F(hx + 1, hy + 5, 6, 1, '#2a2a34');
        } else if (side) H(hx, hy + 5, 4, 2, '#1e1e26');
        else H(hx, hy, 8, headH - 1, cw);
        break;
      }
      case 'tricorn': {
        const tc = '#2a2430';
        H(hx - 2, hy, 12, 1, tc);
        H(hx - 2, hy - 1, 1, 1, tc);
        H(hx + 9, hy - 1, 1, 1, tc);
        H(hx + 1, hy - 3, 6, 3, tc);
        F(hx + 1, hy - 1, 6, 1, look.hatColor || '#c8a030');
        F(hx + 2, hy - 3, 2, 1, '#3e3646');
        break;
      }
      case 'ashhood': {
        // (A soot-black hood, its edge stitched in ember red.)
        const hc = look.hatColor || '#2a2426';
        H(hx - 1, hy - 1, 10, 3, hc);
        H(hx - 1, hy + 2, 1, 5, hc);
        H(hx + 8, hy + 2, 1, 5, hc);
        if (front) for (let x = hx; x < hx + 8; x++) F(x, hy + 1, 1, 1, x % 2 ? '#c84a1a' : '#8a2a10');
        else if (back) H(hx, hy, 8, headH - 1, hc);
        break;
      }
      case 'ashhelm':
        // (Black glass and iron: a crest like a flame.)
        part = METAL;
        H(hx, hy - 1, 8, 4, '#2a2628');
        F(hx, hy - 1, 8, 1, '#5a5458');
        F(hx + 3, hy - 4, 2, 3, '#c84a1a');
        F(hx + 3, hy - 4, 1, 1, '#ffd060');
        F(hx + 4, hy - 4, 1, 2, '#ffa040');
        if (front) {
          H(hx + 3, hy + 2, 2, 3, '#1a1618');
          F(hx + 1, hy + 2, 2, 1, '#8a4a2a');
          F(hx + 5, hy + 2, 2, 1, '#8a4a2a');
        }
        break;
      case 'mushcap': {
        // (A wide hat like a mushroom's cap, spotted, gills underneath.)
        const mc = hex(look.hatColor || '#a83a2a');
        H(hx - 2, hy + 1, 12, 1, dim(mc, 0.8));
        H(hx - 1, hy - 1, 10, 2, mc);
        H(hx + 1, hy - 2, 6, 1, mc);
        F(hx + 1, hy - 1, 1, 1, '#f0ece0');
        F(hx + 6, hy - 1, 1, 1, '#f0ece0');
        F(hx + 4, hy - 2, 1, 1, '#f0ece0');
        F(hx + 7, hy, 1, 1, '#d8d0c0');
        for (let x = hx - 1; x < hx + 9; x += 2) F(x, hy + 1, 1, 1, '#d8c8a8');
        break;
      }
      case 'conehat':
        // (A wide cone of woven reed, against sun and rain.)
        H(hx - 3, hy + 1, 14, 1, '#b89850');
        H(hx - 1, hy, 10, 1, '#d8b870');
        H(hx + 1, hy - 1, 6, 1, '#e0c880');
        H(hx + 3, hy - 2, 2, 1, '#e8d090');
        for (let x = hx - 2; x < hx + 10; x += 3) F(x, hy + 1, 1, 1, '#a08040');
        F(hx + 1, hy, 1, 1, '#f0d8a0');
        break;
      case 'shellhelm':
        // (A turtle's shell for a helm.)
        H(hx - 1, hy - 1, 10, 3, '#5a6a3a');
        H(hx, hy - 2, 8, 1, '#6a7a44');
        for (const x of [hx + 1, hx + 4, hx + 7]) F(x, hy - 1, 1, 2, '#3a4a2a');
        F(hx + 2, hy - 2, 2, 1, '#8a9a5a');
        break;
      case 'wreath':
        for (let x = hx; x < hx + 8; x++) F(x, hy + ((x - hx) % 3 === 1 ? -1 : 0), 1, 1, (x - hx) % 2 ? '#6ab04a' : '#3a7a32');
        if (front) F(hx + 2, hy, 1, 1, '#c83a32');
        F(side ? hx + 5 : hx + 6, hy - 1, 1, 1, '#c83a32');
        break;
    }
  }
  if (outfit === 'hunter' && !hat) {
    // (The hunter's hood, pushed back.)
    part = HAT;
    R(hx - 1, hy - 1, 10, 2, hex(oc.hood));
    as(FLAT, () => R(hx, hy, 8, 1, dim(hex(oc.hood), 0.7)));
  }
  if (outfit === 'hunter' && !back && !skel) {
    // (A quiver's strap across the chest.)
    part = FLAT;
    for (let i = 0; i < torsoH; i++) S(side ? tx + 1 + (i >> 1) : tx + tw - 1 - i, torsoY + i, hex('#5a3a1e'));
  }
  lightUp(p, pm, flat);
  return outlineSel(p);
}
