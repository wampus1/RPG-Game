// Procedural character, creature and item sprites.
import { Px, hex, shade } from './pixel.js';
import { TEX, SPR_H } from './textures.js';
import { ITEMS, GEMS } from '../world/items.js';
import { BLOCKS } from '../world/blocks.js';
import { mulberry32, hashString } from '../util/rng.js';
import { DUNGEON_CREATURES, dungeonIcon, edgeOverlay } from './dungeonart.js';
import { isleIcon, ISLE_CREATURES } from './isleart.js';
import { isleBossArt, ISLE_ROBES } from './islebossart.js';

const OUT = '#1c1622';
export const CHAR_W = 16;
export const CHAR_H = 24;
// Headroom above each figure for tall hats and hairdos (drawn above row 0).
export const SPR_PAD = 6;
export const SHEET_H = CHAR_H + SPR_PAD;
export const FRAMES = 5; // idle, walk A, walk B, action, sitting

function toCanvas(px) {
  const c = document.createElement('canvas');
  c.width = px.w;
  c.height = px.h;
  c.getContext('2d').putImageData(px.toImageData(), 0, 0);
  return c;
}

// ---------------------------------------------------------------- humanoids
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

// Colours of worn armour and clothes (see items.js: look).
const GEAR = {
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

function drawHumanoid(look, dir, frame) {
  const p = new Px(CHAR_W, SHEET_H);
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
  // Worn armour and clothes change the colours underneath (and cover the
  // everyday outfit's details).
  // Worn gear, as "kind" or "kind:#tint".
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
  const flip = dir === 3;
  const S = (x, y, c) => p.set(flip ? CHAR_W - 1 - x : x, y + SPR_PAD, c);
  const R = (x, y, w, h, c) => {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) S(x + i, y + j, c);
  };
  if (shoesG) shoes = shoesG;
  const skinC = skel ? hex('#e8e4d4') : skin;
  const shirtC = skel ? hex('#d8d4c4') : shirt;
  const pantsC = skel ? hex('#c8c4b4') : pants;

  // Legs & shoes.
  if (sit && side) {
    // Thigh forward along the seat, shin down to the floor.
    R(2, legY, 7, 3, pantsC);
    R(2, legY + 3, 3, Math.max(1, legH - 3), shade(pantsC, 0.9));
    R(1, legY + legH, 4, 2, skel ? skinC : shoes);
  } else if (!side) {
    const lL = walk > 0 ? legH - 1 : legH;
    const rL = walk < 0 ? legH - 1 : legH;
    R(5, legY, 3, lL, pantsC);
    R(8, legY, 3, rL, pantsC);
    R(5, legY + lL, 3, 2, skel ? skinC : shoes);
    R(8, legY + rL, 3, 2, skel ? skinC : shoes);
  } else {
    if (walk === 0) {
      R(6, legY, 4, legH, pantsC);
      R(5, legY + legH, 5, 2, skel ? skinC : shoes);
    } else {
      const f = walk > 0 ? 1 : -1;
      R(6 - f, legY, 3, legH, shade(pantsC, 0.85));
      R(7 + f, legY, 3, legH, pantsC);
      R(5 - f, legY + legH, 4, 2, shade(skel ? skinC : shoes, 0.85));
      R(6 + f, legY + legH, 4, 2, skel ? skinC : shoes);
    }
  }
  // (The Stiltfolk roll their trousers to the knee: bare shins.)
  if (outfit === 'tidewrap' && !skel && !sit) {
    const sy = legY + Math.ceil(legH / 2);
    const sh = legH - Math.ceil(legH / 2);
    if (!side) {
      R(5, sy, 3, sh - (walk > 0 ? 1 : 0), skinC);
      R(8, sy, 3, sh - (walk < 0 ? 1 : 0), skinC);
    } else if (walk === 0) R(6, sy, 4, sh, skinC);
    else R(7 + (walk > 0 ? 1 : -1), sy, 3, sh, skinC);
  }
  // Torso.
  const tx = side ? 5 : 4;
  const tw = side ? 6 : 8;
  R(tx, torsoY, tw, torsoH, shirtC);
  R(tx, torsoY, tw, 1, shade(shirtC, 1.15));
  if (skel) for (let y = torsoY + 1; y < torsoY + torsoH; y += 2) R(tx + 1, y, tw - 2, 1, hex('#8a8474'));
  if (outfit === 'guard') {
    for (let y = torsoY; y < torsoY + torsoH; y++) for (let x = tx; x < tx + tw; x++) S(x, y, (x + y) % 2 ? hex(oc.chain) : hex(oc.chain2));
    if (dir !== 2) R(side ? 7 : 6, torsoY, side ? 3 : 4, torsoH + 2, accent);
  } else if (outfit === 'smith' || outfit === 'apron' || outfit === 'baker') {
    if (dir !== 2) R(side ? 5 : 5, torsoY + 1, side ? 4 : 6, torsoH + 3, hex(oc.apron));
  } else if (outfit.startsWith('robe')) {
    R(tx, torsoY, tw, torsoH + legH, hex(oc.robe));
    R(tx, torsoY + 2, tw, 1, hex(oc.trim));
    if (!side) R(7, torsoY + 3, 2, torsoH + legH - 3, shade(hex(oc.robe), 0.85));
  } else if (outfit === 'noble') {
    R(tx, torsoY + torsoH - 1, tw, 1, hex(oc.trim));
    if (dir !== 2) R(7, torsoY, 2, torsoH, hex(oc.trim));
  } else if (outfit === 'vest' || outfit === 'fisher' || outfit === 'miner') {
    if (dir !== 2) {
      R(tx, torsoY, 2, torsoH, hex(oc.vest));
      R(tx + tw - 2, torsoY, 2, torsoH, hex(oc.vest));
    } else R(tx, torsoY, tw, torsoH, hex(oc.vest));
  } else if (outfit === 'farmer') {
    R(tx + 1, torsoY + 2, tw - 2, torsoH - 2, hex(oc.overall));
    R(tx + 1, torsoY, 1, 2, hex(oc.overall));
    R(tx + tw - 2, torsoY, 1, 2, hex(oc.overall));
  } else if (outfit === 'plaid') {
    for (let y = torsoY; y < torsoY + torsoH; y++) for (let x = tx; x < tx + tw; x++) if (x % 3 === 0 || y % 3 === 0) S(x, y, hex(oc.check));
  } else if (outfit === 'rags') {
    S(tx + 2, torsoY + 2, hex(oc.patch));
    S(tx + 5, torsoY + 4, hex(oc.patch));
  } else if (outfit === 'tunic') {
    // (Down over the hips, belted.)
    R(tx, torsoY, tw, torsoH + 2, shirtC);
    R(tx, torsoY, tw, 1, shade(shirtC, 1.15));
    R(tx, torsoY + torsoH + 1, tw, 1, shade(shirtC, 0.85));
    R(tx, legY - 1, tw, 1, hex(oc.belt));
    if (dir === 0) S(7, legY - 1, hex(oc.buckle));
  } else if (outfit === 'ashwrap') {
    // (The Ashborn's wrap: soot-dark, down to the knee, a sash of ember
    // red across it, a dark hem.)
    R(tx, torsoY, tw, torsoH + Math.min(4, legH - 2), shirtC);
    R(tx, torsoY + torsoH + Math.min(4, legH - 2) - 1, tw, 1, hex(oc.hem));
    if (dir !== 2) for (let i = 0; i < torsoH + 1; i++) S(tx + (side ? 1 + (i >> 1) : tw - 2 - i), torsoY + i, hex(oc.sash));
    else R(tx, torsoY + 3, tw, 1, hex(oc.sash));
  } else if (outfit === 'mistcloak') {
    // (The Mirefolk's long cloak, a mantle over the shoulders, fringed.)
    R(tx, torsoY, tw, torsoH + legH - 2, shirtC);
    R(tx - (side ? 0 : 1), torsoY, tw + (side ? 1 : 2), 3, hex(oc.mantle));
    for (let x = tx; x < tx + tw; x += 2) S(x, torsoY + torsoH + legH - 2, hex(oc.fringe));
    if (dir === 0) R(7, torsoY + 3, 2, torsoH + legH - 5, shade(shirtC, 0.82));
  } else if (outfit === 'tidewrap') {
    // (The Stiltfolk's open vest, bare chest and arms, a sea-blue trim.)
    if (dir === 0) {
      R(6, torsoY, 4, torsoH, skinC);
      R(tx, torsoY, 2, torsoH, hex(oc.vest));
      R(tx + tw - 2, torsoY, 2, torsoH, hex(oc.vest));
      R(tx, torsoY + torsoH - 1, tw, 1, hex(oc.trim));
    } else R(tx, torsoY, tw, torsoH, hex(oc.vest));
  } else if (outfit === 'traveller') {
    // (A long coat, open down the front.)
    R(tx, torsoY, tw, torsoH + 3, hex(oc.coat));
    R(tx, torsoY, tw, 1, hex(oc.collar));
    if (dir === 0) R(7, torsoY + 1, 2, torsoH + 2, shirtC);
    else if (dir === 2) R(7, torsoY + 2, 2, torsoH + 1, shade(hex(oc.coat), 0.85));
  }
  // Shirt patterns on everyday clothes.
  const pat = look.pattern;
  if (pat && !skel && ['plain', 'vest', 'fisher', 'miner', 'apron', 'baker', 'smith', 'hunter', 'plaid', 'tunic'].includes(outfit)) {
    if (pat === 'stripes') for (let y = torsoY + 1; y < torsoY + torsoH; y += 2) for (let x = tx; x < tx + tw; x++) if (p.get(flip ? CHAR_W - 1 - x : x, y + SPR_PAD)[3]) S(x, y, shade(shirtC, 0.78));
    if (pat === 'collar') R(tx + 1, torsoY, tw - 2, 1, hex('#e8e0d0'));
    if (pat === 'sash' && dir !== 2) for (let i = 0; i < torsoH; i++) S(tx + (side ? 1 + (i >> 1) : 1 + i), torsoY + i, accent);
    if (pat === 'buttons' && dir === 0) for (let y = torsoY + 1; y < torsoY + torsoH; y += 2) S(7, y, hex('#e8d8a0'));
    if (pat === 'patches') {
      R(tx + 1, torsoY + 2, 2, 2, shade(shirtC, 0.72));
      R(tx + tw - 3, torsoY + 3, 2, 2, shade(shirtC, 1.3));
    }
  }
  // Belt.
  if (!outfit.startsWith('robe') && outfit !== 'farmer' && outfit !== 'tunic' && outfit !== 'ashwrap' && outfit !== 'mistcloak') R(tx, legY - 1, tw, 1, shade(pantsC, 0.7));
  // Armour details over the top.
  if (!skel) {
    const G = (x, y, w, h, c) => R(x, y, w, h, hex(c));
    if (gear.body === 'chain' || gear.body === 'tabard') {
      for (let y = torsoY; y < torsoY + torsoH; y++) for (let x = tx; x < tx + tw; x++) S(x, y, hex((x + y) % 2 ? '#8a8a98' : '#6a6a78'));
      G(tx, legY - 1, tw, 1, '#5a4030');
      // The watch's tabard over the mail, in the town's colours.
      if (gear.body === 'tabard' && dir !== 2) G(side ? 7 : 6, torsoY, side ? 3 : 4, torsoH + 2, tint.body || '#b03030');
      if (gear.body === 'tabard' && dir === 2) G(tx + 1, torsoY, tw - 2, torsoH, tint.body || '#b03030');
    } else if (gear.body === 'plate') {
      G(tx, torsoY, tw, 1, '#d8dce8');
      G(tx, torsoY + torsoH - 1, tw, 1, '#7a7c88');
      if (dir === 0) G(7, torsoY + 1, 2, torsoH - 2, '#c0c4d0');
      if (dir !== 2 && !side) {
        G(3, torsoY, 2, 2, '#b8bcc8');
        G(11, torsoY, 2, 2, '#b8bcc8');
      }
    } else if (gear.body === 'leather') {
      if (dir === 0) for (let y = torsoY + 1; y < torsoY + torsoH - 1; y += 2) G(7, y, 2, 1, '#3a2414');
      G(tx, legY - 1, tw, 1, '#3a2414');
    } else if (gear.body === 'coat') {
      G(tx, torsoY, tw, torsoH + 3, GEAR.coat.shirt);
      if (dir !== 2) G(7, torsoY, 2, torsoH + 3, '#c8a030');
      G(tx, torsoY, tw, 1, '#c8a030');
    } else if (gear.body === 'linen' && dir === 0) G(tx + 2, torsoY, tw - 4, 1, '#c8c0a8');
    else if (gear.body === 'kav') {
      G(tx, torsoY, tw, 1, '#4a4870');
      if (dir !== 2) {
        G(side ? 7 : 7, torsoY + 1, 2, torsoH - 1, '#24223a');
        G(side ? 8 : 7, torsoY + 2, 1, torsoH - 3, '#5ad8f0');
      } else G(tx + 1, torsoY + 3, tw - 2, 1, '#5ad8f0');
    }
    if (gear.legs === 'kav' && !sit) {
      const ky = legY + Math.floor(legH / 2);
      if (!side) {
        G(5, ky, 3, 1, '#5ad8f0');
        G(8, ky, 3, 1, '#5ad8f0');
      } else G(6, ky, 4, 1, '#5ad8f0');
    }
    if (gear.legs === 'plate') {
      const ky = legY + Math.floor(legH / 2);
      if (!side) {
        G(5, ky, 3, 1, '#d0d4e0');
        G(8, ky, 3, 1, '#d0d4e0');
      } else G(6, ky, 4, 1, '#d0d4e0');
    }
    if (gear.feet) {
      // Boots come up over the ankle.
      const bc = GEAR[gear.feet]?.shoes || '#4a2e1a';
      if (!side && !sit) {
        G(5, legY + legH - 1, 3, 1, bc);
        G(8, legY + legH - 1, 3, 1, bc);
      } else if (side && !sit) G(6, legY + legH - 1, 4, 1, bc);
    }
  }
  // Arms.
  const armC = outfit.startsWith('robe') ? hex(oc.robe) : outfit === 'traveller' ? hex(oc.coat) : outfit === 'guard' || gear.body === 'tabard' ? hex(OUTFIT_COLORS.guard.chain2) : outfit === 'tidewrap' && !gear.body ? skinC : outfit === 'mistcloak' ? shade(shirtC, 0.9) : shirtC;
  // A kerchief at the neck.
  if (look.neck && !skel) {
    const nc = hex(look.neck);
    R(tx + 1, torsoY, tw - 2, 1, nc);
    if (dir === 0) R(7, torsoY + 1, 2, 1, shade(nc, 0.85));
    else if (dir === 2) S(side ? 8 : 7, torsoY + 1, shade(nc, 0.85));
  }
  // A cloak: seen from the front, its edges behind your arms; from the
  // side, hanging behind you; from behind, all of it.
  const cape = look.cape && !skel && !sit ? hex(look.cape) : null;
  if (cape && dir === 0) {
    R(3, torsoY, 1, torsoH + 3, shade(cape, 0.8));
    R(12, torsoY, 1, torsoH + 3, shade(cape, 0.8));
    S(tx + 1, torsoY, hex('#d8b040'));
    S(tx + tw - 2, torsoY, hex('#d8b040'));
  } else if (cape && side) {
    R(tx + tw, torsoY, 2, torsoH + legH - 1, cape);
    R(tx + tw + 1, torsoY + 2, 1, torsoH + legH - 3, shade(cape, 0.8));
  }
  // (Gloved hands.)
  const handC = look.gloves && !skel ? hex(look.gloves) : skinC;
  // A shield on the off arm (on the back, seen from behind).
  const shieldAt = (sx0, sy0) => {
    const kind = gear.shield;
    const face = hex(tint.shield || (kind === 'iron' ? '#9a9aa8' : kind === 'round' ? '#b83a32' : '#8a5a2a'));
    const rim = hex(kind === 'iron' ? '#c8c8d4' : '#5a3a1a');
    R(sx0, sy0, 4, 5, rim);
    R(sx0 + 1, sy0 + 1, 2, 3, face);
    if (kind === 'round') S(sx0 + 1, sy0 + 2, hex('#e8d8a0'));
  };
  if (!side) {
    const swing = frame === 3 ? -2 : walk;
    R(3, torsoY + (swing > 0 ? -1 : 0), 1, torsoH - 1, armC);
    R(12, torsoY + (swing < 0 ? -1 : 0), 1, torsoH - 1, armC);
    S(3, torsoY + torsoH - 1 + (swing > 0 ? -1 : 0), handC);
    S(12, torsoY + torsoH - 1 + (swing < 0 ? -1 : 0), handC);
  } else {
    const ax = frame === 3 ? 4 : 7 + walk;
    R(ax, torsoY + 1, 2, torsoH - 2, shade(armC, 0.9));
    R(ax, torsoY + torsoH - 1, 2, 1, handC);
    if (frame === 3) R(2, torsoY + 2, 3, 2, handC);
  }
  if (cape && dir === 2) {
    R(tx - 1, torsoY, tw + 2, torsoH + legH - 2, cape);
    R(tx - 1, torsoY, tw + 2, 1, shade(cape, 1.2));
    for (const fx of [tx + 1, tx + tw - 2]) R(fx, torsoY + 2, 1, torsoH + legH - 4, shade(cape, 0.82));
  }
  if (gear.shield && !sit) {
    if (dir === 0) shieldAt(1, torsoY + 1);
    else if (dir === 2) shieldAt(6, torsoY);
    else shieldAt(1, torsoY + 1);
  }
  // Head.
  const hx = side ? 4 : 4;
  R(hx, hy, 8, headH, skinC);
  if (!skel) R(hx, hy + headH - 1, 8, 1, shade(skinC, 0.9));
  const style = look.hairStyle;
  const hairC = skel ? skinC : hair;
  const hat = look.hat;
  if (!skel && style !== 'bald') {
    if (dir === 2) {
      R(hx, hy, 8, headH - 1, hairC);
      if (style === 'long' || style === 'braids') R(hx, hy + headH - 1, 8, 3, hairC);
      if (style === 'ponytail') R(7, hy + headH - 1, 2, 4, hairC);
      if (style === 'bun') R(6, hy - 1, 4, 2, hairC);
      if (style === 'afro') R(hx - 1, hy - 2, 10, headH + 1, hairC);
      if (style === 'pigtails') {
        R(hx - 1, hy + 3, 1, 4, hairC);
        R(hx + 8, hy + 3, 1, 4, hairC);
      }
    } else if (side) {
      R(hx, hy, 8, 2, hairC);
      R(hx + 5, hy, 3, headH - 2, hairC);
      if (style === 'long' || style === 'braids') R(hx + 5, hy, 3, headH + 2, hairC);
      if (style === 'ponytail') R(hx + 7, hy + 2, 2, 4, hairC);
      if (style === 'bun') R(hx + 6, hy - 1, 3, 2, hairC);
      if (style === 'mohawk') R(hx + 2, hy - 2, 3, 2, hairC);
      if (style === 'afro') R(hx - 1, hy - 2, 10, 5, hairC);
      if (style === 'pigtails') R(hx + 6, hy + 3, 2, 4, hairC);
    } else {
      R(hx, hy, 8, 2, hairC);
      R(hx, hy + 2, 1, 3, hairC);
      R(hx + 7, hy + 2, 1, 3, hairC);
      if (style === 'long' || style === 'braids') {
        R(hx - 1 + 1, hy + 2, 1, headH + 2, hairC);
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
    }
    if (style === 'spiky') for (let x = hx; x < hx + 8; x += 2) S(x + 1, hy - 1, hairC);
    if (style === 'topknot') R(side ? hx + 4 : 7, hy - 3, 2, 3, hairC);
    if (style === 'wavy') {
      // (Down to the jaw, in waves.)
      const wv = shade(hairC, 0.82);
      if (dir === 2) {
        R(hx, hy + headH - 1, 8, 2, hairC);
        for (let x = hx; x < hx + 8; x += 2) S(x, hy + headH + 1, hairC);
        for (let x = hx + 1; x < hx + 8; x += 3) R(x, hy + 1, 1, headH - 1, wv);
      } else if (side) {
        R(hx + 5, hy, 3, headH + 1, hairC);
        S(hx + 8, hy + 2, hairC);
        S(hx + 8, hy + 5, hairC);
        R(hx + 6, hy + 1, 1, headH - 1, wv);
      } else {
        for (const x of [hx - 1, hx + 8]) {
          R(x, hy + 1, 1, 3, hairC);
          S(x, hy + 5, hairC);
        }
        R(hx, hy + 2, 1, 5, hairC);
        R(hx + 7, hy + 2, 1, 5, hairC);
        R(hx + 2, hy, 3, 1, wv);
      }
    }
    if (style === 'undercut') {
      // (Shaved at the sides, the top swept over.)
      const sh = shade(skinC, 0.86);
      if (dir === 2) R(hx, hy + 3, 8, headH - 4, sh);
      else if (side) {
        R(hx + 5, hy + 2, 3, headH - 4, sh);
        R(hx, hy - 1, 6, 1, hairC);
      } else {
        R(hx, hy + 2, 1, 3, sh);
        R(hx + 7, hy + 2, 1, 3, sh);
        R(hx + 1, hy - 1, 6, 1, hairC);
        S(hx + 6, hy + 2, hairC);
      }
    }
  }
  // Marks on the face (paint, ink, a blush, a mole), under the eyes.
  const mark = look.mark;
  if (mark && !skel && dir !== 2) {
    const M = (x, y, c) => S(x, y, typeof c === 'string' ? hex(c) : c);
    if (mark === 'warpaint') {
      if (dir === 0) for (let x = hx + 1; x < hx + 7; x++) M(x, hy + 4, '#2a5aa8');
      else R(hx, hy + 4, 3, 1, hex('#2a5aa8'));
    } else if (mark === 'tattoo') {
      // (A teardrop under the eye.)
      if (dir === 0) R(hx + 5, hy + 5, 1, 2, hex('#2a4a6a'));
      else R(hx + 1, hy + 5, 1, 2, hex('#2a4a6a'));
    } else if (mark === 'blush') {
      if (dir === 0) {
        M(hx + 1, hy + 5, '#e88a7a');
        M(hx + 6, hy + 5, '#e88a7a');
      } else M(hx + 2, hy + 5, '#e88a7a');
    } else if (mark === 'mole') {
      if (dir === 0) M(hx + 5, hy + 5, shade(skinC, 0.55));
      else M(hx + 1, hy + 5, shade(skinC, 0.55));
    } else if (mark === 'tidelines') {
      // (Blue waves under the eyes: a Stiltfolk's tattoo.)
      if (dir === 0) {
        M(hx + 1, hy + 5, '#2a6a9a');
        M(hx + 2, hy + 6, '#2a6a9a');
        M(hx + 6, hy + 5, '#2a6a9a');
        M(hx + 5, hy + 6, '#2a6a9a');
      } else {
        M(hx + 1, hy + 5, '#2a6a9a');
        M(hx + 2, hy + 6, '#2a6a9a');
      }
    } else if (mark === 'stripes') {
      if (dir === 0) {
        R(hx + 1, hy + 5, 1, 2, hex('#c83a32'));
        R(hx + 6, hy + 5, 1, 2, hex('#c83a32'));
      } else R(hx + 2, hy + 5, 1, 2, hex('#c83a32'));
    }
  }
  // Face.
  const eye = skel ? hex('#1a1414') : hex(look.eyeColor || '#1e1a28');
  if (dir === 0) {
    S(hx + 2, hy + 4, eye);
    S(hx + 5, hy + 4, eye);
    if (skel) {
      S(hx + 3, hy + 4, eye);
      S(hx + 6, hy + 4, eye);
      R(hx + 2, hy + 6, 4, 1, eye);
    } else if (!look.beard || look.beardStyle === 'stubble' || look.beardStyle === 'chinstrap') S(hx + 3, hy + 6, shade(skinC, 0.8));
  } else if (side) {
    S(hx + 1, hy + 4, eye);
    S(hx - 1 + 0, hy + 4, skinC);
  }
  // A beard, worn one way or another.
  if (look.beard && !skel && dir !== 2) {
    const bs = look.beardStyle || 'full';
    if (bs === 'full' || bs === 'long') {
      if (dir === 0) R(hx + 1, hy + 5, 6, 2, hairC);
      else R(hx, hy + 5, 4, 2, hairC);
      if (bs === 'long') {
        if (dir === 0) R(hx + 2, hy + 7, 4, 2, hairC);
        else R(hx, hy + 7, 3, 2, hairC);
      }
    } else if (bs === 'goatee') {
      if (dir === 0) {
        R(hx + 2, hy + 5, 4, 1, hairC);
        R(hx + 3, hy + 6, 2, 2, hairC);
      } else R(hx, hy + 5, 2, 2, hairC);
    } else if (bs === 'stubble') {
      const st = shade(hairC, 1.1);
      if (dir === 0) {
        for (let y = hy + 5; y < hy + 7; y++) for (let x = hx + 1; x < hx + 7; x++) if ((x + y) % 2 && !(x === hx + 3 && y === hy + 6)) S(x, y, st);
      } else for (let y = hy + 5; y < hy + 7; y++) for (let x = hx; x < hx + 4; x++) if ((x + y) % 2) S(x, y, st);
    } else if (bs === 'chinstrap') {
      if (dir === 0) {
        R(hx, hy + 3, 1, 4, hairC);
        R(hx + 7, hy + 3, 1, 4, hairC);
        R(hx + 1, hy + 6, 6, 1, hairC);
        S(hx + 3, hy + 6, hairC);
      } else {
        R(hx + 3, hy + 3, 1, 3, hairC);
        R(hx, hy + 6, 4, 1, hairC);
      }
    }
  }
  // Eyes that burn in the dark (the dead, the drowned, constructs).
  if (look.eyes) {
    const ec = hex(look.eyes);
    if (look.visor) {
      if (dir === 0) R(hx + 1, hy + 4, 6, 1, ec);
      else if (side) R(hx, hy + 4, 3, 1, ec);
    } else if (dir === 0) {
      S(hx + 2, hy + 4, ec);
      S(hx + 5, hy + 4, ec);
    } else if (side) S(hx + 1, hy + 4, ec);
  }
  // Face details and accessories.
  const acc = look.acc;
  if (acc && !skel) {
    const A = (x, y, c) => S(x, y, hex(c));
    if (acc === 'glasses') {
      if (dir === 0) for (const x of [hx + 1, hx + 3, hx + 4, hx + 6]) A(x, hy + 4, '#c8c8d8');
      else if (side) {
        A(hx, hy + 4, '#c8c8d8');
        A(hx + 2, hy + 4, '#c8c8d8');
      }
    } else if (acc === 'earring') {
      if (dir === 0) {
        A(hx, hy + 5, '#e8c030');
        A(hx + 7, hy + 5, '#e8c030');
      } else if (side) A(hx + 4, hy + 5, '#e8c030');
    } else if (acc === 'freckles' && dir === 0) {
      S(hx + 1, hy + 5, shade(skinC, 0.78));
      S(hx + 6, hy + 5, shade(skinC, 0.78));
      S(hx + 2, hy + 5, shade(skinC, 0.85));
    } else if (acc === 'mustache' && !look.beard) {
      if (dir === 0) R(hx + 2, hy + 5, 4, 1, hairC);
      else if (side) R(hx, hy + 5, 2, 1, hairC);
    } else if (acc === 'scar') {
      if (dir === 0) {
        A(hx + 5, hy + 3, '#a0584a');
        A(hx + 6, hy + 5, '#a0584a');
      } else if (side) A(hx + 2, hy + 3, '#a0584a');
    } else if (acc === 'ashmask') {
      // (The Ashborn's mask against the ash: dark cloth, two red vents.)
      if (dir === 0) {
        R(hx + 1, hy + 5, 6, 2, hex('#3a3436'));
        A(hx + 2, hy + 6, '#c84a1a');
        A(hx + 5, hy + 6, '#c84a1a');
      } else if (side) {
        R(hx, hy + 5, 4, 2, hex('#3a3436'));
        A(hx + 1, hy + 6, '#c84a1a');
      } else R(hx, hy + 5, 8, 1, hex('#3a3436'));
    } else if (acc === 'shells') {
      // (A string of shells round the neck.)
      if (dir === 0) for (let x = 5; x <= 10; x++) S(x, torsoY + ((x === 5 || x === 10) ? 0 : 1), hex(x % 2 ? '#f0e8d8' : '#e8a8a0'));
      else if (side) for (let x = 5; x <= 8; x++) S(x, torsoY + 1, hex(x % 2 ? '#f0e8d8' : '#e8a8a0'));
    } else if (acc === 'eyepatch') {
      if (dir !== 2) R(hx, hy + 3, 8, 1, hex('#1a1414'));
      if (dir === 0) R(hx + 5, hy + 3, 2, 2, hex('#1a1414'));
      else if (side) R(hx, hy + 3, 2, 2, hex('#1a1414'));
    }
  }
  // Hats.
  if (hat) {
    const H = (x, y, w, h, c) => R(x, y, w, h, hex(c));
    switch (hat) {
      case 'straw':
        H(hx - 2, hy + 1, 12, 1, '#e8c860');
        H(hx + 1, hy - 1, 6, 2, '#d8b448');
        break;
      case 'helmet':
        H(hx, hy - 1, 8, 4, '#9a9aa8');
        H(hx, hy - 1, 8, 1, '#c0c0cc');
        if (dir === 0) H(hx + 3, hy + 2, 2, 3, '#7a7a88');
        H(hx + 3, hy - 3, 2, 2, accent);
        break;
      case 'chef':
        H(hx + 1, hy - 4, 6, 5, '#f4f4f0');
        H(hx, hy, 8, 1, '#e0e0dc');
        break;
      case 'miner':
        H(hx, hy - 1, 8, 3, '#c8a030');
        if (dir === 0) H(hx + 3, hy, 2, 1, '#fff8a0');
        break;
      case 'cap':
        H(hx, hy - 1, 8, 2, '#4a5a7a');
        if (dir === 0 || side) H(side ? hx - 2 : hx + 1, hy + 1, side ? 3 : 6, 1, '#3a4a6a');
        break;
      case 'feather':
        H(hx - 1, hy, 10, 1, '#3a2a4a');
        H(hx + 1, hy - 2, 6, 2, '#4a3a5a');
        H(hx + 6, hy - 5, 1, 4, '#e8e0c0');
        break;
      case 'scarf':
        H(hx, hy - 1, 8, 3, '#e0d0b0');
        if (dir !== 0) H(hx + (side ? 5 : 0), hy + 2, side ? 3 : 8, 5, '#d0c0a0');
        break;
      case 'fur':
        H(hx - 1, hy - 1, 10, 3, '#8a6a4a');
        H(hx - 1, hy - 1, 10, 1, '#a8886a');
        break;
      case 'beret':
        H(hx - 1, hy - 1, 9, 2, look.hatColor || '#8a2a3a');
        H(hx + 6, hy - 2, 2, 1, look.hatColor || '#8a2a3a');
        break;
      case 'bandana':
        H(hx, hy, 8, 2, look.hatColor || '#c83a32');
        if (dir === 2) H(hx + 3, hy + 2, 2, 2, look.hatColor || '#c83a32');
        else if (side) H(hx + 7, hy + 1, 2, 2, look.hatColor || '#c83a32');
        break;
      case 'wide':
        H(hx - 2, hy, 12, 1, '#4a3424');
        H(hx + 1, hy - 3, 6, 3, '#5a4030');
        H(hx + 1, hy - 1, 6, 1, look.hatColor || '#8a2a2a');
        break;
      case 'circlet':
        H(hx, hy + 1, 8, 1, '#e0b830');
        if (dir === 0) H(hx + 3, hy + 1, 2, 1, '#50c0e0');
        break;
      case 'goggles':
        // (Two smoked lenses on a leather strap.)
        H(hx, hy + 2, 8, 1, '#3a2a1e');
        if (dir === 0) {
          H(hx + 1, hy + 2, 2, 2, '#2a2430');
          H(hx + 5, hy + 2, 2, 2, '#2a2430');
          H(hx + 1, hy + 2, 1, 1, '#c87a40');
          H(hx + 5, hy + 2, 1, 1, '#c87a40');
        } else if (side) H(hx, hy + 2, 2, 2, '#2a2430');
        break;
      case 'flower':
        H(side ? hx + 5 : hx + 6, hy, 2, 1, '#f080b0');
        H(side ? hx + 6 : hx + 7, hy - 1, 1, 1, '#ffe070');
        break;
      case 'lcap':
        H(hx, hy - 1, 8, 3, '#7a5232');
        H(hx, hy + 1, 8, 1, '#5a3a1e');
        if (side) H(hx + 7, hy + 2, 1, 3, '#7a5232');
        break;
      case 'kav':
        H(hx, hy - 1, 8, 4, '#2a2840');
        H(hx, hy - 1, 8, 1, '#4a4870');
        H(hx + 3, hy - 2, 2, 1, '#5ad8f0');
        if (dir === 0) H(hx + 1, hy + 3, 6, 1, '#5ad8f0');
        else if (side) H(hx, hy + 3, 3, 1, '#5ad8f0');
        break;
      case 'hood':
        H(hx - 1, hy - 1, 10, 3, '#6a4a2a');
        H(hx - 1, hy + 2, 1, 5, '#6a4a2a');
        H(hx + 8, hy + 2, 1, 5, '#6a4a2a');
        break;
      case 'cowl': {
        // (A dark hood, and a cloth over the mouth and nose.)
        const cw = look.hatColor || '#2a2a32';
        H(hx - 1, hy - 1, 10, 3, cw);
        H(hx - 1, hy + 2, 1, 5, cw);
        H(hx + 8, hy + 2, 1, 5, cw);
        if (dir === 0) H(hx, hy + 5, 8, 2, '#1e1e26');
        else if (side) H(hx, hy + 5, 4, 2, '#1e1e26');
        else H(hx, hy, 8, headH - 1, cw);
        break;
      }
      case 'tricorn':
        H(hx - 2, hy, 12, 1, '#2a2430');
        H(hx - 2, hy - 1, 1, 1, '#2a2430');
        H(hx + 9, hy - 1, 1, 1, '#2a2430');
        H(hx + 1, hy - 3, 6, 3, '#2a2430');
        H(hx + 1, hy - 1, 6, 1, look.hatColor || '#c8a030');
        break;
      case 'ashhood': {
        // (A soot-black hood, its edge stitched in ember red.)
        const hc = look.hatColor || '#2a2426';
        H(hx - 1, hy - 1, 10, 3, hc);
        H(hx - 1, hy + 2, 1, 5, hc);
        H(hx + 8, hy + 2, 1, 5, hc);
        if (dir === 0) H(hx, hy + 1, 8, 1, '#c84a1a');
        else if (dir === 2) H(hx, hy, 8, headH - 1, hc);
        break;
      }
      case 'ashhelm':
        // (Black glass and iron: a crest like a flame.)
        H(hx, hy - 1, 8, 4, '#2a2628');
        H(hx, hy - 1, 8, 1, '#4a4448');
        H(hx + 3, hy - 4, 2, 3, '#c84a1a');
        H(hx + 3, hy - 4, 2, 1, '#ffa040');
        if (dir === 0) H(hx + 3, hy + 2, 2, 3, '#1a1618');
        break;
      case 'mushcap': {
        // (A wide hat like a mushroom's cap, spotted.)
        const mc = look.hatColor || '#a83a2a';
        H(hx - 2, hy + 1, 12, 1, shade(hex(mc), 0.8));
        H(hx - 1, hy - 1, 10, 2, mc);
        H(hx + 1, hy - 2, 6, 1, mc);
        H(hx + 1, hy - 1, 1, 1, '#f0ece0');
        H(hx + 6, hy - 1, 1, 1, '#f0ece0');
        H(hx + 4, hy - 2, 1, 1, '#f0ece0');
        break;
      }
      case 'conehat':
        // (A wide cone of woven reed, against sun and rain.)
        H(hx - 3, hy + 1, 14, 1, '#c8a860');
        H(hx - 1, hy, 10, 1, '#d8b870');
        H(hx + 1, hy - 1, 6, 1, '#e0c880');
        H(hx + 3, hy - 2, 2, 1, '#e8d090');
        H(hx - 3, hy + 1, 14, 1, '#b89850');
        break;
      case 'shellhelm':
        // (A turtle's shell for a helm.)
        H(hx - 1, hy - 1, 10, 3, '#5a6a3a');
        H(hx, hy - 2, 8, 1, '#6a7a44');
        for (const x of [hx + 1, hx + 4, hx + 7]) H(x, hy - 1, 1, 2, '#3a4a2a');
        break;
      case 'wreath':
        for (let x = hx; x < hx + 8; x++) H(x, hy + ((x - hx) % 3 === 1 ? -1 : 0), 1, 1, (x - hx) % 2 ? '#6ab04a' : '#3a7a32');
        if (dir === 0) H(hx + 2, hy, 1, 1, '#c83a32');
        H(side ? hx + 5 : hx + 6, hy - 1, 1, 1, '#c83a32');
        break;
    }
  }
  if (outfit === 'hunter' && !hat) {
    R(hx - 1, hy - 1, 10, 2, hex(oc.hood));
  }
  p.outline(OUT);
  return p;
}

const sheetCache = new Map();

// Sprite sheet: 4 directions (rows) x FRAMES columns.
export function humanoidSheet(look) {
  const key = JSON.stringify(look);
  let c = sheetCache.get(key);
  if (c) return c;
  const sheet = new Px(CHAR_W * FRAMES, SHEET_H * 4);
  for (let d = 0; d < 4; d++) for (let f = 0; f < FRAMES; f++) sheet.blit(drawHumanoid(look, d, f), f * CHAR_W, d * SHEET_H);
  c = toCanvas(sheet);
  sheetCache.set(key, c);
  return c;
}

export function headSprite(look) {
  const full = drawHumanoid(look, 0, 0);
  const p = new Px(12, 10);
  const top = look.small ? 6 : 0;
  for (let y = 0; y < 10; y++) for (let x = 0; x < 12; x++) {
    const c = full.get(x + 2, y + top - 1 + SPR_PAD);
    if (c[3]) p.set(x, y, c);
  }
  return toCanvas(p);
}

// ---------------------------------------------------------------- creatures
function slime(frame, col) {
  const p = new Px(16, 16);
  const c = hex(col);
  const squash = frame % 2;
  const rx = 6 + squash;
  const ry = 4 - squash;
  p.ellipse(7.5, 12 - ry + 2, rx, ry + 1, c);
  p.ellipse(5.5, 10 - ry + 2, 2, 1, shade(c, 1.35));
  p.set(5, 12 - ry + 2, '#1a1420');
  p.set(9, 12 - ry + 2, '#1a1420');
  for (let i = 0; i < p.d.length; i += 4) if (p.d[i + 3]) p.d[i + 3] = 225;
  return p.outline(OUT);
}

function quadruped(frame, pal, kind) {
  const p = new Px(16, 16);
  const [body, dark, light] = pal.map(hex);
  const walk = frame % 2;
  if (kind === 'wolf' || kind === 'boar' || kind === 'deer') {
    const by = kind === 'deer' ? 6 : 8;
    const bh = kind === 'boar' ? 5 : 4;
    p.rect(3, by, 10, bh, body);
    p.hline(3, 12, by, light);
    // legs
    const ly = by + bh;
    const lh = kind === 'deer' ? 6 : 4;
    p.rect(4 + walk, ly, 1, lh, dark);
    p.rect(6 - walk, ly, 1, lh, dark);
    p.rect(10 + walk, ly, 1, lh, dark);
    p.rect(12 - walk, ly, 1, lh, dark);
    // head (facing left)
    if (kind === 'wolf') {
      p.rect(0, by - 2, 4, 4, body);
      p.set(1, by - 3, dark);
      p.set(3, by - 3, dark);
      p.set(1, by - 1, '#f0d040');
      p.rect(13, by - 1, 3, 1, body);
    } else if (kind === 'boar') {
      p.rect(0, by, 4, 4, body);
      p.set(0, by + 3, '#f0ece0');
      p.set(1, by + 1, '#1a1420');
      for (let x = 4; x < 12; x += 2) p.set(x, by - 1, dark);
    } else {
      p.rect(1, by - 4, 3, 4, body);
      p.rect(0, by - 3, 2, 2, body);
      p.set(1, by - 3, '#1a1420');
      p.line(2, by - 5, 0, by - 8, dark);
      p.line(3, by - 5, 5, by - 8, dark);
      p.set(13, by, '#f0ece0');
      for (let x = 5; x < 12; x += 3) p.set(x, by + 1, light);
    }
  } else if (kind === 'rabbit') {
    p.ellipse(8, 12, 4, 3, body);
    p.ellipse(4, 10, 2, 2, body);
    p.rect(3, 5 + walk, 1, 4, body);
    p.rect(5, 5 + walk, 1, 4, light);
    p.set(3, 10, '#1a1420');
    p.set(12, 11, '#f8f8f8');
  } else if (kind === 'chicken') {
    p.ellipse(8, 10, 4, 3, body);
    p.rect(3, 5, 3, 4, body);
    p.set(3, 6, '#1a1420');
    p.set(2, 7, '#e8a020');
    p.set(4, 4, '#d02a2a');
    p.rect(6 + walk, 13, 1, 2, '#e8a020');
    p.rect(9 - walk, 13, 1, 2, '#e8a020');
    p.set(11, 8, light);
  }
  return p.outline(OUT);
}

// A ghoul, side on (facing left): hunched low on long arms, grey-green
// and bony along the spine, eyes like coals; frame 1 reaches forward.
function ghoul(frame) {
  const p = new Px(16, 16);
  const skin = hex('#7a9478');
  const dark = shade(skin, 0.68);
  const pale = shade(skin, 1.22);
  const reach = frame % 2;
  // The hunched back and haunches.
  p.ellipse(9.5, 8.5, 4.5, 3.2, skin);
  p.ellipse(12, 10, 2.5, 2.5, skin);
  p.hline(7, 12, 6, pale);
  for (let x = 7; x <= 12; x += 2) p.set(x, 5, dark);
  // Hind legs folded under it, long arms down to the ground.
  p.rect(11, 12, 1, 3, dark);
  p.rect(13, 11, 1, 4, dark);
  p.line(6, 9, 4 - reach, 14, skin);
  p.line(7, 9, 6 - reach, 14, dark);
  p.set(3 - reach, 14, dark);
  p.set(5 - reach, 15, dark);
  // The head thrust low and forward, a gash of a mouth, burning eyes.
  p.ellipse(4, 8.5 + reach * 0.5, 2.5, 2, skin);
  p.hline(2, 4, 10 + reach, '#3a2224');
  p.set(2, 8 + reach, '#ff6030');
  p.set(4, 8 + reach, '#ffb040');
  p.set(5, 6, dark);
  return p.outline(OUT);
}

// A will-o'-the-wisp: a hanging ball of pale blue fire with a tail of it
// trailing below, bobbing (no outline: it's light).
function wisp(frame) {
  const p = new Px(16, 16);
  const bob = frame % 2;
  const cy = 5 + bob;
  p.ellipse(8, cy, 4.5, 4.5, hex('#80c8ff'), 70);
  p.ellipse(8, cy, 3, 3, hex('#a0dcff'), 150);
  p.ellipse(8, cy, 1.6, 1.6, hex('#f0fcff'), 255);
  for (let k = 0; k < 4; k++) p.set(8 + (k % 2 ? 1 : -1) * (bob ? 1 : 0), cy + 4 + k, hex('#a0dcff'), 160 - k * 35);
  p.set(7, cy + 6, hex('#80c8ff'), 90);
  p.set(9, cy + 7, hex('#80c8ff'), 70);
  return p;
}

// Farm beasts, side on (facing left).
function farmBeast(frame, kind, variant = 0) {
  const p = new Px(16, 16);
  const walk = frame % 2;
  if (kind === 'pig') {
    const pink = hex(['#f0a8a8', '#e8b8a0', '#c89090'][variant % 3]);
    const dark = shade(pink, 0.72);
    p.ellipse(9, 10, 5.5, 3.2, pink);
    p.hline(5, 13, 7, shade(pink, 1.1));
    p.rect(1, 8, 4, 4, pink);
    p.rect(0, 9, 1, 2, dark);
    p.set(0, 9, '#5a3030');
    p.set(2, 9, '#1a1420');
    p.set(3, 7, dark);
    p.set(4, 7, dark);
    for (const x of [5 + walk, 7 - walk, 11 + walk, 13 - walk]) p.rect(x, 13, 1, 2, dark);
    p.set(15, 8, pink);
    p.set(14, 7, pink);
  } else if (kind === 'sheep') {
    const wool = hex(['#f0ece0', '#e0dccc', '#8a8078'][variant % 3]);
    const face = hex('#3a3434');
    p.ellipse(9, 9.5, 5.2, 3.8, wool);
    for (const [x, y] of [[6, 6], [9, 5], [12, 6], [13, 9], [5, 11]]) p.set(x, y, shade(wool, 1.08));
    for (const [x, y] of [[8, 8], [11, 10], [7, 11]]) p.set(x, y, shade(wool, 0.88));
    p.rect(1, 7, 3, 4, face);
    p.set(1, 8, '#e8e0d0');
    p.set(4, 7, face);
    for (const x of [5 + walk, 7 - walk, 11 + walk, 13 - walk]) p.rect(x, 13, 1, 2, face);
  } else {
    // A cow: black and white, or brown.
    const brown = variant % 3 === 2;
    const hide = hex(brown ? '#8a5a34' : '#f0ece4');
    const patch = hex(brown ? '#5a3a20' : '#2a2428');
    p.rect(3, 6, 11, 6, hide);
    p.hline(3, 13, 6, shade(hide, 1.08));
    if (!brown) {
      p.rect(6, 7, 3, 2, patch);
      p.rect(10, 9, 2, 2, patch);
      p.set(12, 7, patch);
    }
    p.rect(0, 4, 4, 5, hide);
    p.rect(0, 7, 2, 2, hex('#e8a8a0'));
    p.set(1, 5, '#1a1420');
    p.set(0, 3, '#e8e0c8');
    p.set(3, 3, '#e8e0c8');
    p.set(9, 12, hex('#e8a8a0'));
    for (const x of [4 + walk, 6 - walk, 11 + walk, 13 - walk]) p.rect(x, 12, 1, 3, shade(hide, 0.7));
    p.line(14, 7, 15, 11, patch);
  }
  return p.outline(OUT);
}

export const CREATURE_LOOKS = {
  ghoul: { frames: 2, draw: (f) => ghoul(f) },
  wisp: { frames: 2, draw: (f) => wisp(f) },
  pig: { frames: 2, draw: (f, v) => farmBeast(f, 'pig', v) },
  sheep: { frames: 2, draw: (f, v) => farmBeast(f, 'sheep', v) },
  cow: { frames: 2, draw: (f, v) => farmBeast(f, 'cow', v) },
  slime: { frames: 2, draw: (f, v) => slime(f, ['#58c048', '#4a8ae0', '#c04ad0'][v % 3]) },
  wolf: { frames: 2, draw: (f) => quadruped(f, ['#6a6a74', '#4a4a54', '#8a8a94'], 'wolf') },
  boar: { frames: 2, draw: (f) => quadruped(f, ['#6a4a34', '#4a3224', '#8a6448'], 'boar') },
  deer: { frames: 2, draw: (f) => quadruped(f, ['#a8744a', '#7a5434', '#c89a6a'], 'deer') },
  rabbit: { frames: 2, draw: (f) => quadruped(f, ['#c8b8a0', '#a89880', '#e8dcc8'], 'rabbit') },
  chicken: { frames: 2, draw: (f) => quadruped(f, ['#f4f0e8', '#c8c0b0', '#ffffff'], 'chicken') },
};

Object.assign(CREATURE_LOOKS, DUNGEON_CREATURES, ISLE_CREATURES);
// (And the islands' own masters, below ground: see islebossart.js.)
Object.assign(CREATURE_LOOKS, isleBossArt(CREATURE_LOOKS));

// Creature sheet: frames in a row; left-facing, renderer flips for right.
// (Square frames: 16 across, or 32 for the great ones.)
export function creatureSheet(kind, variant = 0) {
  const key = `c:${kind}:${variant}`;
  let c = sheetCache.get(key);
  if (c) return c;
  const L = CREATURE_LOOKS[kind];
  const sz = L.size || 16;
  const sheet = new Px(sz * L.frames * 2, sz);
  for (let f = 0; f < L.frames; f++) {
    const img = L.draw(f, variant);
    sheet.blit(img, f * sz, 0);
    sheet.blit(img, (L.frames + f) * sz, 0, true);
  }
  c = toCanvas(sheet);
  sheetCache.set(key, c);
  return c;
}

// ---------------------------------------------------------------- horses & wagons
export const HORSE_COATS = ['#8a5a34', '#a0602e', '#3a3034', '#a8a8a8', '#e0dcd0', '#6a4a2a'];
export const HORSE_W = 30;
export const HORSE_H = 22;

// A horse from the side, facing left (the renderer flips it): `coat` an
// index into HORSE_COATS, `banner` a trade banner's colour on the saddle
// cloth (null for none), `saddle` a riding saddle of its own, `frame` 0
// standing, 1-2 walking.
export function horseSprite(frame, coat = 0, banner = null, saddle = false) {
  const key = `h:${frame}:${coat}:${banner || ''}:${saddle ? 1 : 0}`;
  let c = sheetCache.get(key);
  if (c) return c;
  const p = new Px(HORSE_W, HORSE_H);
  const base = hex(HORSE_COATS[coat % HORSE_COATS.length]);
  const dark = shade(base, 0.68);
  const light = shade(base, 1.2);
  const mane = coat === 4 ? hex('#c8c0b0') : coat === 3 ? hex('#e8e8e8') : hex('#2a2024');
  const hoof = '#1a1420';
  // Legs, the far pair darker (walking: they swing in turn).
  const w = frame === 0 ? 0 : frame === 1 ? 1 : -1;
  for (const [x, o, far] of [[9, w, true], [11, -w, false], [20, -w, true], [22, w, false]]) {
    const c2 = far ? dark : base;
    p.rect(x + o, 14, 2, 6, c2);
    p.set(x + o + (far ? 0 : 1), 16, shade(c2, 0.85));
    p.rect(x + o, 20, 2, 1, hoof);
  }
  // Barrel of a body, a rounded chest and rump, light along the back.
  p.ellipse(16, 11, 8.5, 4, base);
  p.ellipse(9.5, 11, 3, 3.5, base);
  p.ellipse(22.5, 10.5, 3, 3.5, base);
  p.hline(11, 22, 7, light);
  p.hline(10, 22, 14, dark);
  p.hline(12, 20, 15, dark);
  // Neck rising to the head, ears pricked, a white blaze on some.
  for (let k = 0; k < 7; k++) p.rect(8 - k * 0.6, 9 - k, 3, 2, base);
  p.rect(1, 1, 6, 4, base);
  p.rect(0, 4, 4, 2, shade(base, 0.85));
  p.set(0, 5, hoof);
  p.set(5, 0, dark);
  p.set(6, 0, dark);
  p.set(4, 2, '#1a1420');
  if (coat % 3 === 1) p.vline(2, 1, 4, '#f0ece0');
  // Mane down the crest of the neck, a full tail.
  for (let k = 0; k < 7; k++) p.set(7 - Math.round(k * 0.6) + 2, 2 + k, mane);
  for (let k = 0; k < 7; k++) p.set(8 - Math.round(k * 0.6) + 2, 2 + k, mane);
  p.line(25, 8, 27, 12, mane);
  p.line(26, 8, 28, 15, mane);
  p.line(27, 9, 27, 16, mane);
  // Saddle cloth: a trader's banner colours, with a gold coin sewn on.
  if (banner) {
    const b = hex(banner);
    p.rect(12, 7, 8, 6, b);
    p.hline(12, 19, 12, shade(b, 0.7));
    p.set(16, 9, '#f0d040');
    p.set(16, 10, '#c8a020');
  }
  // A riding saddle: leather seat, pommel and cantle, a stirrup down.
  if (saddle) {
    const lea = hex('#6a3a1c');
    p.rect(13, 6, 6, 3, lea);
    p.set(12, 5, shade(lea, 1.2));
    p.rect(18, 4, 2, 3, shade(lea, 0.8));
    p.hline(13, 18, 6, shade(lea, 1.3));
    p.vline(15, 9, 13, '#3a2a1a');
    p.hline(14, 16, 14, '#a8a8b0');
  }
  c = toCanvas(p.outline(OUT));
  sheetCache.set(key, c);
  return c;
}

// A tent, the size of one you could stand up in: canvas over a ridge pole,
// two and a half paces across, pegged out with guy ropes. `rot` is the way
// its opening faces on screen (0 toward you, 1 left, 2 away, 3 right): end
// on, its gable (the doorway with its flaps tied back, or the laced-up
// back) under the two slopes of its roof running back; side on, the long
// slope of the near side, the far one beyond the ridge, and the doorway at
// the end. A merchant's (`striped`) is striped; a nomad family's plain,
// patched and weathered. (Drawn bottom-centred on its tile.)
export const TENT_W = 44;
export const TENT_H = 34;
const TENT_COLS = ['#c8b890', '#a0503a', '#3a6a9a', '#8a6a48'];
export function tentSprite(rot = 0, colour = 0, striped = false) {
  const key = `tent:${rot & 3}:${colour & 3}:${striped ? 1 : 0}`;
  let c = sheetCache.get(key);
  if (c) return c;
  const p = new Px(TENT_W, TENT_H);
  const col = hex(TENT_COLS[colour & 3]);
  const lite = shade(col, 1.14);
  const mid = col;
  const dk = shade(col, 0.8);
  const seam = shade(col, 0.66);
  const stripe = hex('#f0ece0');
  const dark = '#1c1622';
  const pole = '#6a4a2a';
  // A pixel of canvas, striped or patched as it should be.
  const cloth = (x, y, base) => {
    let c2 = base;
    if (striped && ((x >> 1) % 3 === 0)) c2 = shade(stripe, base === lite ? 1 : base === mid ? 0.92 : 0.82);
    else if (!striped && (x * 7 + y * 3) % 13 === 0) c2 = shade(base, 0.86);
    p.set(x, y, c2);
  };
  const B0 = TENT_H - 2;
  if ((rot & 1) === 0) {
    // End on: the roof's slopes running back from the gable.
    const L = 3;
    const R = TENT_W - 4;
    const mid0 = (L + R) / 2;
    const apexF = 11;
    const back = 9;
    for (let y = 0; y <= B0; y++) {
      for (let x = L; x <= R; x++) {
        const k = Math.abs(x - mid0) / ((R - L) / 2);
        const front = apexF + k * (B0 - apexF);
        const rear = front - back;
        if (y < rear || y > B0) continue;
        if (y >= front) cloth(x, y, rot === 0 ? mid : dk);
        else cloth(x, y, x < mid0 ? lite : dk);
      }
    }
    // The ridge, and the gable's edges.
    p.line(Math.round(mid0), apexF - back, Math.round(mid0), apexF, seam);
    p.line(L, B0, Math.round(mid0), apexF, seam);
    p.line(R, B0, Math.round(mid0), apexF, seam);
    if (rot === 0) {
      // The doorway, its flaps tied back.
      for (let y = apexF + 6; y <= B0; y++) {
        const w = ((y - apexF - 6) / (B0 - apexF - 6)) * 7;
        for (let x = Math.ceil(mid0 - w); x <= Math.floor(mid0 + w); x++) p.set(x, y, dark);
      }
      p.line(Math.round(mid0) - 1, apexF + 6, Math.round(mid0) - 9, B0 - 1, shade(col, 1.3));
      p.line(Math.round(mid0) + 1, apexF + 6, Math.round(mid0) + 9, B0 - 1, shade(col, 1.05));
      p.set(Math.round(mid0) - 8, B0 - 6, pole);
      p.set(Math.round(mid0) + 8, B0 - 6, pole);
    } else {
      // The back, laced up.
      p.vline(Math.round(mid0), apexF + 2, B0, seam);
      for (let y = apexF + 5; y < B0; y += 3) p.set(Math.round(mid0) + 1, y, shade(col, 1.25));
    }
    p.hline(L, R, B0, seam);
    // Pole tip.
    p.vline(Math.round(mid0), apexF - back - 3, apexF - back, pole);
    // Guy ropes out to their pegs.
    p.line(L + 2, B0 - 6, 0, B0 + 1, '#b0a080');
    p.line(R - 2, B0 - 6, TENT_W - 1, B0 + 1, '#b0a080');
    p.set(0, B0 + 1, pole);
    p.set(TENT_W - 1, B0 + 1, pole);
  } else {
    // Side on: the near slope from the hem up to the ridge, the far one
    // beyond it, and the doorway at the end it faces.
    const L = 4;
    const R = TENT_W - 5;
    const ridge = 13;
    const far = 5;
    for (let y = far; y <= B0; y++) {
      for (let x = L; x <= R; x++) {
        // (Its ends lean in, a little, to the ridge.)
        const inset = y < ridge ? Math.round((ridge - y) / 3) : Math.round((y - ridge) / 8);
        if (x < L + (y < ridge ? inset : 0) || x > R - (y < ridge ? inset : 0)) continue;
        cloth(x, y, y < ridge ? lite : y < ridge + 3 ? mid : (y - ridge) % 7 === 0 ? dk : mid);
      }
    }
    p.hline(L, R, ridge, seam);
    p.hline(L, R, B0, seam);
    // The end it opens at: the gable's edge and the doorway in it.
    const left = rot === 1;
    const ex = left ? L : R;
    const dir = left ? 1 : -1;
    for (let y = ridge + 4; y <= B0; y++) {
      const w = Math.round(((y - ridge - 4) / (B0 - ridge - 4)) * 4);
      for (let i = 0; i <= w; i++) p.set(ex + dir * i, y, dark);
    }
    p.line(ex + dir * 5, ridge + 5, ex + dir * 7, B0 - 1, shade(col, 1.3));
    // The far end, closed.
    p.vline(left ? R : L, ridge, B0, seam);
    // Poles at either end, and the guy ropes.
    p.vline(L, ridge - 3, ridge, pole);
    p.vline(R, ridge - 3, ridge, pole);
    p.line(L, ridge, 0, B0 + 1, '#b0a080');
    p.line(R, ridge, TENT_W - 1, B0 + 1, '#b0a080');
    p.set(0, B0 + 1, pole);
    p.set(TENT_W - 1, B0 + 1, pole);
  }
  c = toCanvas(p.outline(OUT));
  sheetCache.set(key, c);
  return c;
}

export const WAGON_W = 38;
export const WAGON_H = 26;
// Where the driver sits (from the wagon's left, pulled to the left) and
// how high; where passengers sit in the bed behind.
export const WAGON_SEAT = { x: 9, lift: 9 };
export const WAGON_BED = [{ x: 18, lift: 8 }, { x: 25, lift: 8 }, { x: 31, lift: 8 }];

// A wagon from the side (pulled to the left): a driver's bench at the
// front, and a covered bed behind: a trader's has its banner on the
// canvas; a nomad family's is plain, patched and weathered; a plain cart
// (`hood` false) is open for passengers. With people riding in the back
// (`hood` 'open'), the canvas stays up over them with its sides rolled up.
export function wagonSprite(banner = null, frame = 0, hood = true) {
  const key = `w:${banner || ''}:${frame}:${hood === 'open' ? 2 : hood ? 1 : 0}`;
  let c = sheetCache.get(key);
  if (c) return c;
  const p = new Px(WAGON_W, WAGON_H);
  const wood = hex('#7a5430');
  const woodD = shade(wood, 0.7);
  const woodL = shade(wood, 1.2);
  const canvas = banner ? hex('#ece4cc') : hex('#c8bc9c');
  // The hood on its hoops, over the back of the bed (the front is open,
  // with the bench).
  if (hood === 'open') {
    // The canvas rolled back to a bundle at the tail for passengers, the
    // bare hoops arching over them, a rail round the bed.
    for (let i = 0; i <= 8; i++) {
      const a = (i / 8) * Math.PI;
      for (const hx of [17, 26]) p.set(Math.round(hx + 4 - Math.cos(a) * 4), Math.round(10 - Math.sin(a) * 8), woodD);
    }
    for (let y = 3; y <= 12; y++) {
      p.set(35, y, y % 3 ? canvas : shade(canvas, 0.8));
      p.set(36, y, shade(canvas, 0.78));
    }
    p.rect(34, 2, 3, 2, shade(canvas, 0.9));
    if (banner) {
      const b = hex(banner);
      p.rect(33, 5, 2, 5, b);
      p.set(33, 7, '#f0d040');
    }
    p.hline(14, 36, 10, woodL);
    for (let x = 14; x <= 34; x += 4) p.vline(x, 10, 13, wood);
  } else if (hood) {
    for (let x = 14; x <= 36; x++) {
      const top = 2 + Math.round(Math.abs(x - 25) > 9 ? (Math.abs(x - 25) - 9) * 1.3 : 0);
      for (let y = top; y <= 13; y++) p.set(x, y, (x - 14) % 6 === 0 ? shade(canvas, 0.82) : canvas);
    }
    p.vline(14, 5, 13, shade(canvas, 0.7));
    if (banner) {
      const b = hex(banner);
      p.rect(19, 5, 12, 7, b);
      p.hline(19, 30, 11, shade(b, 0.7));
      // A pair of scales, the traders' mark.
      p.hline(22, 28, 7, '#f0d040');
      p.vline(25, 6, 10, '#f0d040');
      p.set(22, 9, '#f0d040');
      p.set(28, 9, '#f0d040');
    } else {
      p.rect(18, 6, 3, 3, shade(canvas, 0.75));
      p.rect(29, 8, 4, 2, hex('#8a6a48'));
    }
  } else {
    // Open sides, a rail round the bed.
    p.hline(14, 36, 10, woodL);
    for (let x = 14; x <= 36; x += 4) p.vline(x, 10, 13, wood);
  }
  // The bench at the front, with its back rest.
  p.rect(6, 11, 7, 2, woodL);
  p.vline(12, 7, 12, wood);
  p.vline(13, 7, 12, woodD);
  // The bed, and the shafts out front.
  p.rect(4, 13, 33, 5, wood);
  p.hline(4, 36, 13, woodL);
  p.hline(4, 36, 17, woodD);
  for (let x = 8; x <= 34; x += 6) p.vline(x, 14, 16, woodD);
  p.line(0, 15, 4, 15, woodD);
  p.line(0, 16, 4, 16, wood);
  // Wheels (the spokes turn as it rolls).
  for (const cx of [9, 30]) {
    p.ellipse(cx, 20.5, 5, 5, woodD);
    p.ellipse(cx, 20.5, 3.5, 3.5, wood);
    p.ellipse(cx, 20.5, 2, 2, woodD);
    p.set(cx, 20, '#2a2024');
    const a = (frame % 4) * (Math.PI / 4);
    for (let k = 0; k < 4; k++) {
      const t = a + (k * Math.PI) / 2;
      p.set(Math.round(cx + Math.cos(t) * 3), Math.round(20.5 + Math.sin(t) * 3), woodL);
    }
  }
  c = toCanvas(p.outline(OUT));
  sheetCache.set(key, c);
  return c;
}

// ---------------------------------------------------------------- siege engines
// A catapult from the side, throwing to the left: a wheeled bed, an A-frame
// with a padded crossbar, and the arm on its axle at the back. Cocked
// (frame 0) the arm lies back along the bed, its sling cup loaded with a
// stone; loosed (2) it slams up against the crossbar; 1 is halfway.
export const CATAPULT_W = 40;
export const CATAPULT_H = 34;
export function catapultSprite(frame = 0, banner = null) {
  const key = `cat:${frame}:${banner || ''}`;
  let c = sheetCache.get(key);
  if (c) return c;
  const p = new Px(CATAPULT_W, CATAPULT_H);
  const wood = hex('#7a5430');
  const woodD = shade(wood, 0.68);
  const woodL = shade(wood, 1.22);
  const rope = hex('#c8b080');
  // The bed.
  p.rect(4, 22, 32, 4, wood);
  p.hline(4, 35, 22, woodL);
  p.hline(4, 35, 25, woodD);
  // The A-frame and its crossbar (padded with a sack).
  p.line(12, 22, 17, 8, woodD);
  p.line(22, 22, 17, 8, woodD);
  p.line(13, 22, 18, 8, wood);
  p.line(23, 22, 18, 8, wood);
  p.rect(14, 7, 8, 2, woodL);
  p.rect(15, 5, 6, 2, rope);
  // The arm, from its axle at the back of the bed.
  const ax = 29;
  const ay = 21;
  const ang = [Math.PI * 0.94, Math.PI * 0.72, Math.PI * 0.55][Math.max(0, Math.min(2, frame))];
  const len = 22;
  const ex = Math.round(ax + Math.cos(ang) * len);
  const ey = Math.round(ay - Math.sin(ang) * len);
  p.line(ax, ay, ex, ey, woodL);
  p.line(ax + 1, ay, ex + 1, ey, woodD);
  // The cup at its end, with a stone in it while cocked.
  p.rect(ex - 2, ey - 2, 4, 3, woodD);
  if (frame === 0) p.rect(ex - 1, ey - 3, 3, 2, hex('#9a9aa4'));
  // The winch and its rope, back to the arm.
  p.ellipse(33, 21, 2, 2, woodD);
  if (frame === 0) p.line(33, 20, ex + 1, ey + 1, rope);
  // Wheels.
  for (const cx of [9, 31]) {
    p.ellipse(cx, 28, 4.5, 4.5, woodD);
    p.ellipse(cx, 28, 3, 3, wood);
    p.set(cx, 28, '#2a2024');
  }
  // The realm's pennant on a staff at the back.
  if (banner) {
    p.vline(37, 6, 22, woodD);
    p.rect(38, 6, 2, 4, hex(banner));
  }
  c = toCanvas(p.outline(OUT));
  sheetCache.set(key, c);
  return c;
}

// A battering ram from the side, its head to the left: a log with an iron
// cap slung on chains inside a wheeled shed, roofed with wet hides against
// fire. `frame` swings the log back (-2) and forward (2).
export const RAM_W = 46;
export const RAM_H = 26;
export function ramSprite(frame = 0, banner = null) {
  const key = `ram:${frame}:${banner || ''}`;
  let c = sheetCache.get(key);
  if (c) return c;
  const p = new Px(RAM_W, RAM_H);
  const wood = hex('#6e4c2c');
  const woodD = shade(wood, 0.66);
  const woodL = shade(wood, 1.2);
  const hide = hex('#8a6a4a');
  // The log (behind the shed's front post), swung on its chains.
  const off = Math.max(-3, Math.min(3, frame));
  p.rect(2 + off, 12, 34, 4, hex('#8a6438'));
  p.hline(2 + off, 35 + off, 12, woodL);
  p.hline(2 + off, 35 + off, 15, woodD);
  // Its iron head.
  p.rect(0 + off, 11, 4, 6, hex('#8a8a96'));
  p.vline(0 + off, 12, 15, hex('#c8c8d4'));
  // The shed: posts, a sloped roof of hides.
  for (const x of [8, 22, 38]) p.vline(x, 6, 20, woodD);
  for (let x = 6; x <= 41; x++) {
    const top = 2 + Math.round(Math.abs(x - 23) * 0.12);
    for (let y = top; y <= top + 3; y++) p.set(x, y, (x + y) % 5 === 0 ? shade(hide, 0.8) : hide);
  }
  p.hline(6, 41, 6, shade(hide, 0.6));
  // Chains from the roof beam to the log.
  for (const x of [14, 30]) for (let y = 7; y < 12; y += 2) p.set(x + Math.round(off / 2), y, hex('#a0a0aa'));
  // The bed and wheels.
  p.rect(6, 19, 36, 3, wood);
  p.hline(6, 41, 19, woodL);
  for (const cx of [12, 36]) {
    p.ellipse(cx, 22, 3.5, 3.5, woodD);
    p.ellipse(cx, 22, 2, 2, wood);
  }
  if (banner) {
    p.vline(42, 0, 6, woodD);
    p.rect(43, 0, 2, 3, hex(banner));
  }
  c = toCanvas(p.outline(OUT));
  sheetCache.set(key, c);
  return c;
}

// A trade ship from the side, her bow to the left: a long dark hull with a
// raised stem and stern, a row of shields along the rail in the realm's
// colours, one mast and a great square sail (furled on its yard while she's
// tied up), a pennant at the masthead.
export const SHIP_W = 76;
export const SHIP_H = 58;
export const SHIP_DECK = 38;
export function shipSprite(banner = null, sail = true) {
  const key = `ship:${banner || ''}:${sail ? 1 : 0}`;
  let c = sheetCache.get(key);
  if (c) return c;
  const p = new Px(SHIP_W, SHIP_H);
  const wood = hex('#6a4426');
  const woodD = shade(wood, 0.62);
  const woodL = shade(wood, 1.25);
  const col = banner ? hex(banner) : hex('#b03030');
  const cloth = hex('#ece4cc');
  // The hull: a long curve, deepest amidships, stem and stern swept up.
  for (let x = 2; x <= 73; x++) {
    const u = (x - 37.5) / 35.5;
    const top = SHIP_DECK - Math.round(Math.pow(Math.abs(u), 3) * 12);
    const bottom = SHIP_DECK + 10 - Math.round(Math.pow(Math.abs(u), 2) * 9);
    for (let y = top; y <= bottom; y++) p.set(x, y, y === top ? woodL : y >= bottom - 1 ? woodD : (y - top) % 3 === 0 ? shade(wood, 0.85) : wood);
  }
  // A carved stem post, and the stern's.
  p.line(2, 26, 5, 30, woodL);
  p.line(73, 26, 70, 30, woodL);
  // Shields along the rail.
  for (let x = 12; x <= 62; x += 7) {
    p.ellipse(x, SHIP_DECK + 2, 2.5, 2.5, x % 2 ? col : shade(col, 0.8));
    p.set(x, SHIP_DECK + 2, hex('#e0d090'));
  }
  // The mast and its yard.
  p.vline(37, 4, SHIP_DECK, woodD);
  p.vline(38, 4, SHIP_DECK, wood);
  p.hline(18, 57, 8, woodD);
  if (sail) {
    // The sail, full of wind: the realm's colour in broad stripes.
    for (let y = 9; y <= 30; y++) {
      const bulge = Math.round(Math.sin(((y - 9) / 21) * Math.PI) * 3);
      for (let x = 19 - bulge; x <= 56 - bulge; x++) {
        const stripe = Math.floor((x + bulge - 19) / 6) % 2 === 0;
        p.set(x, y, stripe ? col : cloth);
      }
    }
    p.hline(19, 56, 30, shade(cloth, 0.7));
  } else {
    // Furled: a bundle along the yard.
    p.rect(19, 9, 38, 3, cloth);
    p.hline(19, 56, 11, shade(cloth, 0.7));
    for (let x = 22; x <= 54; x += 8) p.vline(x, 9, 11, shade(col, 0.9));
  }
  // Rigging to stem and stern.
  p.line(37, 5, 4, 27, hex('#4a3a2a'));
  p.line(38, 5, 71, 27, hex('#4a3a2a'));
  // The pennant.
  p.rect(39, 1, 6, 2, col);
  p.set(45, 2, col);
  c = toCanvas(p.outline(OUT));
  sheetCache.set(key, c);
  return c;
}

// ---------------------------------------------------------------- items
const TIER = { wood: ['#a07a4a', '#7a5a34'], stone: ['#9a9aa4', '#6a6a74'], iron: ['#d8d8e4', '#9a9aa8'], gold: ['#f0d040', '#b89820'], steel: ['#b8c8e0', '#6a7a98'] };
const HANDLE = ['#8a6038', '#5e4024'];

function toolIcon(kind, tier) {
  const p = new Px(16, 16);
  const [m, md] = TIER[tier] || TIER.iron;
  const handle = (len = 9) => {
    for (let i = 0; i < len; i++) {
      p.set(3 + i, 13 - i, HANDLE[0]);
      p.set(3 + i, 14 - i, HANDLE[1]);
    }
  };
  switch (kind) {
    case 'pickaxe':
      handle(10);
      p.line(5, 3, 9, 2, m);
      p.line(9, 2, 13, 6, m);
      p.line(13, 6, 14, 10, m);
      p.line(5, 4, 8, 3, md);
      p.line(12, 7, 13, 10, md);
      break;
    case 'axe':
      handle(10);
      p.rect(9, 2, 4, 5, m);
      p.rect(12, 3, 2, 4, md);
      p.set(9, 2, shade(m, 1.2));
      break;
    case 'shovel':
      handle(9);
      p.rect(10, 2, 4, 4, m);
      p.set(13, 1, m);
      p.rect(10, 5, 3, 1, md);
      break;
    case 'sword':
      for (let i = 0; i < 9; i++) {
        p.set(5 + i, 10 - i, m);
        p.set(6 + i, 10 - i, md);
      }
      p.set(14, 1, shade(m, 1.2));
      p.line(2, 10, 6, 14, '#6a5030');
      p.line(3, 12, 1, 14, HANDLE[1]);
      p.set(4, 12, HANDLE[0]);
      break;
    case 'hoe':
      handle(10);
      p.rect(10, 2, 4, 2, m);
      p.rect(13, 2, 1, 3, md);
      break;
    case 'hammer':
      handle(9);
      p.rect(8, 2, 6, 4, '#6a6a74');
      p.hline(8, 13, 2, '#9a9aa4');
      break;
  }
  return p.outline(OUT);
}

function simpleIcon(key) {
  // (The other Dagoni Islands' goods: see isleart.js.)
  const isle = isleIcon(key);
  if (isle) return isle;
  const p = new Px(16, 16);
  const rand = mulberry32(hashString(key));
  switch (key) {
    case 'stick':
      p.line(4, 13, 12, 3, '#8a6038');
      p.line(5, 13, 13, 3, '#5e4024');
      break;
    case 'dynamite':
      // A red stick, banded, its fuse curling off the top.
      p.line(4, 13, 10, 5, '#c83a2a');
      p.line(5, 13, 11, 5, '#e85a3a');
      p.line(5, 14, 11, 6, '#8a2418');
      p.set(6, 11, '#e8d8a0');
      p.set(7, 11, '#e8d8a0');
      p.set(8, 8, '#e8d8a0');
      p.set(9, 8, '#e8d8a0');
      p.set(11, 4, '#6a5a3a');
      p.set(12, 3, '#6a5a3a');
      p.set(12, 2, '#6a5a3a');
      p.set(13, 1, '#ffd060');
      break;
    case 'lockpick':
      // A thin steel pick and a tension wrench, crossed.
      p.line(3, 13, 12, 4, '#9a9aa8');
      p.line(4, 13, 13, 4, '#d8d8e4');
      p.set(13, 3, '#d8d8e4');
      p.set(14, 3, '#9a9aa8');
      p.line(4, 5, 11, 12, '#7a7a88');
      p.set(3, 4, '#7a7a88');
      p.set(3, 5, '#7a7a88');
      p.rect(2, 12, 3, 3, '#6a4a2a');
      break;
    case 'coal':
      p.ellipse(8, 9, 4, 3, '#2a2a30');
      p.set(6, 8, '#5a5a66');
      p.set(9, 7, '#4a4a54');
      break;
    case 'iron_ingot': case 'gold_ingot': {
      const c = key === 'iron_ingot' ? ['#d8d8e4', '#9a9aa8', '#f4f4ff'] : ['#f0c830', '#b08a10', '#fff4a0'];
      p.rect(3, 7, 10, 5, c[0]);
      p.rect(4, 6, 8, 1, c[2]);
      p.rect(3, 11, 10, 1, c[1]);
      break;
    }
    case 'gem':
      p.ellipse(8, 8, 4, 5, '#30d8c8');
      p.line(6, 5, 8, 3, '#c0fff8');
      p.set(9, 9, '#1a9a90');
      break;
    case 'string':
      for (let i = 0; i < 10; i++) p.set(3 + i, 8 + Math.round(Math.sin(i) * 2), '#e8e4d8');
      break;
    case 'leather':
      p.rect(4, 4, 8, 8, '#8a5a34');
      p.rect(5, 5, 6, 6, '#a8703e');
      break;
    case 'cloth':
      p.rect(3, 5, 10, 7, '#d8d0c0');
      p.hline(3, 12, 8, '#b8b0a0');
      p.line(12, 5, 13, 12, '#a89e8e');
      break;
    case 'seeds':
      for (let i = 0; i < 6; i++) p.set(4 + rand() * 8, 6 + rand() * 6, '#c8a860');
      break;
    case 'cabbage_seeds':
      for (let i = 0; i < 7; i++) p.set(4 + rand() * 8, 6 + rand() * 6, i % 2 ? '#3a2a1a' : '#6a5a3a');
      p.set(8, 5, '#6ab84a');
      break;
    case 'wheat':
      for (let i = 0; i < 3; i++) {
        p.line(5 + i * 2, 14, 7 + i * 2, 4, '#c8a040');
        p.rect(6 + i * 2, 2, 2, 4, '#e8c850');
      }
      break;
    case 'reeds':
      p.line(6, 14, 7, 2, '#6a9a3a');
      p.line(9, 14, 10, 3, '#6a9a3a');
      p.rect(6, 2, 2, 4, '#7a4a28');
      break;
    case 'herb':
      p.line(8, 14, 8, 6, '#3e8a3a');
      p.ellipse(6, 6, 2, 2, '#58b84a');
      p.ellipse(10, 8, 2, 2, '#58b84a');
      break;
    case 'bone':
      p.line(4, 11, 11, 4, '#e8e4d4');
      p.line(4, 12, 12, 4, '#d0ccbc');
      p.ellipse(4, 12, 1, 1, '#e8e4d4');
      p.ellipse(12, 4, 1, 1, '#e8e4d4');
      break;
    case 'slime_gel':
      p.ellipse(8, 9, 4, 3, '#58c048');
      p.set(7, 8, '#b8f0a0');
      break;
    case 'feather':
      p.line(4, 13, 12, 3, '#f0f0f0');
      p.line(6, 12, 12, 5, '#d8d8e0');
      break;
    case 'book': case 'ledger': case 'sketchbook': case 'scroll': {
      if (key === 'scroll') {
        p.rect(4, 5, 8, 6, '#e8dcc0');
        p.vline(4, 4, 11, '#b8a880');
        p.vline(11, 4, 11, '#b8a880');
        p.hline(5, 10, 7, '#8a7a5a');
        break;
      }
      const cc = { book: '#a83232', ledger: '#3a5a2a', sketchbook: '#8a7a5a' }[key];
      p.rect(4, 3, 8, 10, cc);
      p.rect(11, 4, 1, 9, '#f0e8d0');
      p.vline(4, 3, 12, shade(cc, 0.7));
      p.hline(6, 9, 6, '#e0c060');
      break;
    }
    case 'coin':
      p.ellipse(8, 8, 4, 4, '#e8c030');
      p.ellipse(8, 8, 2, 2, '#f8e070');
      p.set(8, 8, '#b08a10');
      break;
    case 'apple':
      p.ellipse(8, 9, 4, 4, '#d02a2a');
      p.set(6, 7, '#ff8080');
      p.line(8, 5, 9, 3, '#5a3a1e');
      p.set(10, 4, '#4aa83a');
      break;
    case 'berries':
      for (const [x, y] of [[6, 8], [9, 7], [8, 10], [11, 10], [5, 11]]) p.ellipse(x, y, 1, 1, '#c02a4a');
      p.set(8, 5, '#4aa83a');
      break;
    case 'coconut':
      p.ellipse(8, 9, 4, 4, '#6a4a2a');
      p.set(7, 7, '#1e1410');
      p.set(9, 7, '#1e1410');
      break;
    case 'carrot':
      p.line(5, 12, 10, 6, '#f07a20');
      p.line(6, 12, 11, 6, '#e06a10');
      p.line(10, 5, 12, 2, '#4aa83a');
      p.line(11, 6, 14, 4, '#4aa83a');
      break;
    case 'cabbage':
      p.ellipse(8, 9, 5, 4, '#6ab84a');
      p.ellipse(8, 9, 2, 2, '#9ad870');
      break;
    case 'mushroom':
      p.rect(7, 8, 2, 5, '#f0e8d8');
      p.ellipse(8, 7, 4, 2, '#d03a3a');
      p.set(6, 6, '#ffffff');
      break;
    case 'bread':
      p.ellipse(8, 9, 5, 3, '#c8883a');
      p.hline(5, 10, 7, '#e8b060');
      p.set(6, 9, '#a86a2a');
      p.set(9, 9, '#a86a2a');
      break;
    case 'raw_meat': case 'cooked_meat':
      p.ellipse(8, 8, 4, 3, key === 'raw_meat' ? '#d85a5a' : '#8a4a24');
      p.ellipse(7, 7, 1, 1, key === 'raw_meat' ? '#f0a0a0' : '#b8743a');
      p.rect(11, 10, 3, 2, '#f0e8d8');
      break;
    case 'fish': case 'cooked_fish':
      p.ellipse(7, 8, 4, 2, key === 'fish' ? '#7a9ab8' : '#b8844a');
      p.line(11, 8, 14, 6, key === 'fish' ? '#5a7a98' : '#8a5a2a');
      p.line(11, 8, 14, 10, key === 'fish' ? '#5a7a98' : '#8a5a2a');
      p.set(4, 7, '#1a1420');
      break;
    case 'stew':
      p.ellipse(8, 10, 5, 3, '#6a4a2e');
      p.ellipse(8, 9, 4, 1, '#c8702a');
      p.set(7, 9, '#f07a20');
      break;
    case 'pie':
      p.ellipse(8, 9, 5, 3, '#d8a050');
      p.ellipse(8, 8, 3, 1, '#a02a4a');
      break;
    // The regional dishes: a bowl of something hot, or a bite to carry.
    case 'pottage': case 'chowder': case 'spiced_lentils': case 'goulash': {
      const top = { pottage: '#7a9a3a', chowder: '#e8dcc0', spiced_lentils: '#c87a2a', goulash: '#8a2a1a' }[key];
      p.ellipse(8, 10, 5, 3, '#8a6a48');
      p.hline(4, 12, 11, '#6a4a2e');
      p.ellipse(8, 9, 4, 1, top);
      p.set(6, 9, key === 'chowder' ? '#c8b080' : '#f0e0a0');
      p.set(10, 9, key === 'goulash' ? '#c8702a' : '#f8f0d8');
      break;
    }
    case 'apple_tart':
      p.ellipse(8, 10, 5, 2, '#c8883a');
      p.ellipse(8, 9, 4, 1, '#e8c060');
      p.set(6, 9, '#a8c040');
      p.set(9, 9, '#a8c040');
      break;
    case 'smoked_fish':
      p.ellipse(7, 8, 4, 2, '#a86a2a');
      p.line(11, 8, 14, 6, '#7a4a1a');
      p.line(11, 8, 14, 10, '#7a4a1a');
      p.hline(4, 9, 8, '#c8883a');
      break;
    case 'flatbread':
      p.ellipse(8, 9, 6, 3, '#e8c890');
      p.set(6, 8, '#c8a060');
      p.set(10, 10, '#c8a060');
      p.set(7, 11, '#5a2a1a');
      p.set(11, 8, '#5a2a1a');
      break;
    case 'tamales':
      p.ellipse(6, 9, 3, 2, '#c8b060');
      p.ellipse(10, 10, 3, 2, '#b8a050');
      p.vline(6, 7, 11, '#8a7a3a');
      p.vline(10, 8, 12, '#8a7a3a');
      break;
    case 'cocoa':
      p.rect(5, 7, 6, 7, '#e8e0d0');
      p.rect(5, 7, 6, 1, '#5a2a1a');
      p.rect(11, 9, 2, 3, '#c8c0b0');
      p.set(7, 5, '#f8f0e8');
      p.set(9, 4, '#f8f0e8');
      break;
    case 'oatcakes':
      p.ellipse(7, 10, 4, 2, '#d8b070');
      p.ellipse(9, 8, 4, 2, '#e0bc80');
      p.set(8, 8, '#b08a4a');
      break;
    case 'saddle':
      p.ellipse(8, 9, 6, 3, '#6a3a1c');
      p.rect(3, 6, 2, 4, '#4a2812');
      p.rect(12, 5, 2, 4, '#8a5028');
      p.hline(4, 12, 8, '#9a6034');
      p.vline(8, 11, 14, '#3a2a1a');
      p.hline(7, 9, 14, '#a8a8b0');
      break;
    case 'wagon':
      p.rect(2, 4, 12, 5, '#ece4cc');
      p.vline(5, 4, 8, '#c8bc9c');
      p.vline(9, 4, 8, '#c8bc9c');
      p.rect(1, 9, 14, 2, '#7a5430');
      p.ellipse(4, 12, 2, 2, '#4a3018');
      p.ellipse(12, 12, 2, 2, '#4a3018');
      break;
    case 'lead':
      // A coil of rope with a loop at the end.
      p.ellipse(7, 9, 4, 3, '#a87c48');
      p.ellipse(7, 9, 2, 1, '#2a1e14');
      p.ellipse(7, 8, 4, 3, '#c8a064');
      p.ellipse(7, 8, 2, 1, '#2a1e14');
      p.line(11, 8, 13, 12, '#c8a064');
      p.ellipse(13, 13, 1, 1, '#d8b478');
      break;
    case 'ale':
    case 'empty_mug':
      // A wooden tankard, a head of foam on a full one.
      p.rect(4, 6, 7, 8, '#8a5a30');
      p.vline(5, 6, 13, '#a87444');
      p.hline(4, 10, 9, '#5a3a1c');
      p.hline(4, 10, 12, '#5a3a1c');
      p.rect(11, 8, 2, 1, '#6a4422');
      p.rect(12, 8, 1, 4, '#6a4422');
      p.rect(11, 11, 2, 1, '#6a4422');
      if (key === 'ale') {
        p.rect(4, 4, 7, 2, '#f4ecd8');
        p.set(5, 3, '#f4ecd8');
        p.set(8, 3, '#ffffff');
        p.set(10, 6, '#e8c060');
      } else p.rect(5, 6, 5, 1, '#3a2614');
      break;
    case 'dirty_dish':
      p.ellipse(8, 11, 6, 2, '#d8d4c8');
      p.ellipse(8, 10, 4, 1, '#b8b0a0');
      p.set(6, 10, '#7a5a3a');
      p.set(9, 11, '#8a6a42');
      p.set(10, 10, '#6a4a2e');
      p.line(11, 6, 13, 10, '#a8a8b0');
      break;
    case 'gruel':
      p.ellipse(8, 10, 5, 3, '#5a5046');
      p.ellipse(8, 9, 4, 1, '#8a8068');
      p.set(6, 9, '#3a3226');
      p.set(10, 9, '#3a3226');
      p.set(8, 6, '#7a7a7a');
      p.set(9, 5, '#9a9a9a');
      break;
    case 'feast':
      p.ellipse(8, 11, 6, 3, '#e8e4d8');
      p.ellipse(7, 9, 3, 2, '#9a5424');
      p.ellipse(6, 8, 1, 1, '#c8844a');
      p.rect(11, 8, 2, 3, '#e8b060');
      p.set(10, 10, '#4aa83a');
      p.set(4, 10, '#f07a20');
      break;
    case 'bow':
      for (let i = 0; i < 12; i++) p.set(4 + Math.round(Math.sin((i / 11) * Math.PI) * 4), 2 + i, i % 5 === 0 ? '#5e4024' : '#8a6038');
      p.vline(4, 2, 13, '#e8e4d8');
      break;
    case 'arrow':
      p.line(3, 13, 12, 4, '#8a6038');
      p.line(11, 3, 13, 5, '#c0c0c8');
      p.set(13, 3, '#e0e0e8');
      p.set(3, 12, '#f0f0f0');
      p.set(4, 14, '#f0f0f0');
      break;
    case 'ladle':
      p.line(4, 3, 9, 10, '#9a9aa4');
      p.ellipse(10, 11, 2, 2, '#c0c0c8');
      break;
    case 'spear':
      p.line(2, 14, 12, 4, HANDLE[0]);
      p.line(12, 4, 14, 2, '#d8d8e4');
      p.set(13, 2, '#f4f4ff');
      p.set(14, 3, '#9a9aa8');
      break;
    case 'wooden_spear':
      p.line(2, 14, 12, 4, HANDLE[0]);
      p.line(12, 4, 14, 2, '#5a3a1e');
      p.set(14, 2, '#3a2412');
      break;
    case 'club':
      p.line(3, 13, 9, 7, HANDLE[0]);
      p.ellipse(11, 5, 3, 3, '#7a5430');
      break;
    case 'mace':
      p.line(3, 13, 9, 7, HANDLE[1]);
      p.ellipse(11, 5, 3, 3, '#8a8a98');
      p.set(11, 1, '#c8c8d4');
      p.set(14, 5, '#c8c8d4');
      p.set(11, 8, '#c8c8d4');
      p.set(8, 5, '#c8c8d4');
      p.set(10, 4, '#d8d8e4');
      break;
    case 'dagger':
      p.line(6, 10, 12, 4, '#d8d8e4');
      p.line(4, 9, 7, 12, '#6a5030');
      p.line(3, 13, 5, 11, HANDLE[1]);
      break;
    case 'short_sword':
      for (let i = 0; i < 6; i++) {
        p.set(6 + i, 10 - i, '#d8d8e4');
        p.set(7 + i, 10 - i, '#9a9aa8');
      }
      p.set(12, 4, '#f4f4ff');
      p.line(3, 9, 7, 13, '#7a6040');
      p.line(4, 12, 2, 14, HANDLE[1]);
      p.set(1, 15, '#c8a040');
      break;
    case 'sabre':
      // A curved blade, a brass hilt.
      for (let i = 0; i < 9; i++) {
        const bow = Math.round(Math.sin((i / 8) * Math.PI) * 1.5);
        p.set(5 + i, 10 - i - bow, '#e0e0ec');
        p.set(5 + i, 11 - i - bow, '#9a9aa8');
      }
      p.line(3, 9, 6, 12, '#c8a040');
      p.set(6, 13, '#c8a040');
      p.line(4, 12, 2, 14, HANDLE[1]);
      break;
    case 'hand_axe':
      p.line(3, 14, 10, 7, HANDLE[0]);
      p.line(4, 14, 11, 7, HANDLE[1]);
      p.rect(9, 3, 3, 4, '#c8c8d4');
      p.rect(11, 2, 2, 6, '#9a9aa8');
      p.set(12, 2, '#f4f4ff');
      break;
    case 'flail':
      p.line(2, 14, 7, 9, HANDLE[0]);
      p.line(3, 14, 8, 9, HANDLE[1]);
      for (let i = 0; i < 3; i++) p.set(8 + i, 8 - i, '#8a8a98');
      p.ellipse(12, 4, 2, 2, '#7a7a88');
      p.set(12, 1, '#c8c8d4');
      p.set(15, 4, '#c8c8d4');
      p.set(9, 4, '#c8c8d4');
      p.set(12, 7, '#c8c8d4');
      p.set(11, 3, '#d8d8e4');
      break;
    case 'quarterstaff':
      p.line(1, 15, 14, 1, '#9a6a3a');
      p.line(2, 15, 15, 1, '#6a4422');
      p.set(4, 12, '#4a3018');
      p.set(11, 5, '#4a3018');
      break;
    case 'greatsword':
      // Long and broad: a two-handed grip and a wide cross-guard.
      for (let i = 0; i < 11; i++) {
        p.set(4 + i, 11 - i, '#e0e0ec');
        p.set(5 + i, 11 - i, '#b0b0c0');
        p.set(4 + i, 10 - i, '#c8c8d8');
      }
      p.set(15, 0, '#ffffff');
      p.line(1, 9, 6, 14, '#8a7050');
      p.line(1, 10, 5, 14, '#5a4428');
      p.line(3, 12, 0, 15, HANDLE[1]);
      break;
    case 'battle_axe':
      p.line(1, 15, 11, 5, HANDLE[0]);
      p.line(2, 15, 12, 5, HANDLE[1]);
      // A wide double bit.
      p.rect(9, 1, 2, 9, '#9a9aa8');
      p.rect(11, 1, 4, 4, '#d8d8e4');
      p.rect(12, 0, 3, 1, '#c8c8d4');
      p.rect(6, 2, 3, 4, '#c8c8d4');
      p.set(14, 1, '#ffffff');
      break;
    case 'warhammer':
      p.line(1, 15, 10, 6, HANDLE[0]);
      p.line(2, 15, 11, 6, HANDLE[1]);
      p.rect(8, 1, 7, 4, '#7a7a88');
      p.hline(8, 14, 1, '#b0b0bc');
      p.rect(14, 2, 1, 2, '#5a5a66');
      p.set(7, 3, '#5a5a66');
      break;
    case 'halberd':
      p.line(1, 15, 13, 3, HANDLE[0]);
      p.line(2, 15, 14, 3, HANDLE[1]);
      p.line(13, 3, 15, 0, '#e0e0ec');
      // The axe blade on one side, a hook on the other.
      p.rect(10, 2, 2, 5, '#c8c8d4');
      p.rect(9, 3, 1, 3, '#9a9aa8');
      p.set(14, 6, '#9a9aa8');
      p.set(15, 7, '#9a9aa8');
      break;
    case 'longbow':
      for (let i = 0; i < 15; i++) p.set(3 + Math.round(Math.sin((i / 14) * Math.PI) * 5), 1 + i, i % 7 === 0 ? '#4a3018' : '#7a5028');
      p.vline(3, 1, 15, '#e8e4d8');
      p.rect(6, 7, 2, 2, '#c8a060');
      break;
    case 'crossbow':
      // The stock, the bow across it, a bolt laid ready.
      p.line(3, 13, 11, 5, '#8a5a30');
      p.line(4, 13, 12, 5, '#5e3a1c');
      p.line(6, 2, 14, 10, '#9a9aa8');
      p.line(6, 2, 7, 1, '#c8c8d4');
      p.line(14, 10, 15, 9, '#c8c8d4');
      p.line(7, 3, 13, 9, '#e8e4d8');
      p.set(12, 4, '#d8d8e4');
      p.set(2, 14, '#3a2414');
      break;
    case 'bolt':
      p.line(3, 13, 12, 4, '#7a5028');
      p.line(11, 4, 13, 2, '#9a9aa8');
      p.set(13, 2, '#e0e0e8');
      p.set(3, 12, '#c8b890');
      p.set(4, 14, '#c8b890');
      break;
    case 'sling':
      p.line(2, 3, 8, 10, '#a08050');
      p.line(13, 2, 9, 10, '#a08050');
      p.ellipse(9, 11, 2, 1.5, '#7a5a34');
      p.set(9, 10, '#9a9aa4');
      p.set(2, 3, '#5e4024');
      break;
    case 'javelin':
      p.line(1, 15, 13, 3, '#b08a54');
      p.line(13, 3, 15, 1, '#d8d8e4');
      p.set(14, 1, '#f4f4ff');
      p.set(5, 11, '#8a3a2a');
      p.set(6, 10, '#8a3a2a');
      break;
    case 'raft':
      for (let i = 0; i < 5; i++) {
        p.rect(2 + i * 2 + (i > 2 ? 1 : 0), 3 + (i % 2), 2, 10 - (i === 4 ? 1 : 0), ['#9a6a38', '#8a5c30', '#a8743e', '#8e602f', '#9c6c3a'][i]);
        p.set(3 + i * 2 + (i > 2 ? 1 : 0), 6 + i, '#6a4420');
      }
      p.hline(2, 13, 5, '#d8c890');
      p.hline(2, 13, 11, '#d8c890');
      break;
    case 'fishing_rod':
      p.line(2, 14, 13, 2, HANDLE[0]);
      p.line(13, 2, 13, 11, '#e8e8f0');
      p.set(13, 12, '#d02a2a');
      break;
    case 'lute':
      p.ellipse(6, 10, 4, 3, '#b8743a');
      p.set(6, 10, '#3a2a1a');
      p.line(8, 8, 13, 3, '#6a4a2a');
      break;
    case 'flute':
      p.line(3, 12, 12, 3, '#c8a878');
      for (let i = 0; i < 3; i++) p.set(6 + i * 2, 9 - i * 2, '#5a4a3a');
      break;
    case 'dice':
      p.rect(4, 5, 7, 7, '#f0ece0');
      p.set(6, 7, '#1a1420');
      p.set(8, 9, '#1a1420');
      p.rect(9, 3, 4, 4, '#e8e4d8');
      p.set(10, 4, '#c02a2a');
      break;
    case 'prayer_beads':
      for (let a = 0; a < 10; a++) p.set(8 + Math.cos(a / 1.6) * 4, 8 + Math.sin(a / 1.6) * 4, '#8a5a8a');
      p.set(8, 13, '#e0c040');
      break;
    case 'guard_badge':
      p.rect(4, 3, 8, 7, '#c8a030');
      p.rect(5, 10, 6, 2, '#c8a030');
      p.rect(6, 12, 4, 1, '#c8a030');
      p.set(7, 13, '#c8a030');
      p.rect(5, 4, 6, 6, '#3a5a9a');
      p.vline(8, 4, 11, '#f0e070');
      p.hline(5, 10, 6, '#f0e070');
      break;
    case 'bucket':
    case 'water_bucket':
      p.rect(4, 6, 8, 8, '#8e6a3a');
      p.hline(4, 11, 6, '#b08a50');
      p.hline(4, 11, 10, '#5a4020');
      p.hline(5, 10, 13, '#6e5030');
      p.line(4, 6, 8, 2, '#9a9aa4');
      p.line(8, 2, 11, 6, '#9a9aa4');
      if (key === 'water_bucket') {
        p.hline(5, 10, 7, '#58a8e8');
        p.hline(6, 9, 8, '#8cc8f8');
      }
      break;
    case 'dispatch':
      p.rect(3, 4, 11, 8, '#e8dcb0');
      p.line(3, 4, 8, 8, '#a89868');
      p.line(13, 4, 8, 8, '#a89868');
      p.ellipse(8, 8, 1.5, 1.5, '#c8a030');
      p.set(8, 8, '#8a2a2a');
      break;
    case 'letter':
      p.rect(3, 5, 11, 7, '#ece4cc');
      p.line(3, 5, 8, 9, '#b0a888');
      p.line(13, 5, 8, 9, '#b0a888');
      p.ellipse(8, 9, 1, 1, '#b02a2a');
      break;
    case 'pipe':
      p.line(4, 7, 10, 9, '#5a3a1e');
      p.rect(10, 6, 3, 4, '#8a5a34');
      break;
    case 'paper':
      p.rect(4, 3, 8, 10, '#f0ead8');
      p.hline(5, 10, 5, '#c8c0a8');
      p.hline(5, 10, 7, '#c8c0a8');
      p.hline(5, 9, 9, '#c8c0a8');
      break;
    case 'ink':
      p.rect(5, 7, 6, 6, '#2a2a3a');
      p.rect(6, 5, 4, 2, '#3a3a4a');
      p.hline(6, 9, 8, '#4a4a6a');
      break;
    // (For the tree of learning: a catapult with its stone up, and a mine
    // cart heaped with ore.)
    case 'catapult': {
      const w = ['#8a6038', '#5e4024', '#b08050'];
      p.hline(2, 13, 12, w[1]);
      p.hline(3, 12, 11, w[0]);
      p.line(5, 11, 8, 6, w[0]);
      p.line(11, 11, 8, 6, w[0]);
      p.line(8, 7, 3, 2, w[2]);
      p.ellipse(3, 2, 1.6, 1.6, '#8a8a90');
      p.set(2, 1, '#c8c8d0');
      for (const cx of [4, 11]) {
        p.ellipse(cx, 13, 1.8, 1.8, '#3a2a1a');
        p.set(cx, 13, '#8a6038');
      }
      break;
    }
    case 'mine_cart': {
      p.rect(3, 7, 10, 5, '#6a6a72');
      p.hline(3, 12, 7, '#9a9aa4');
      p.vline(3, 7, 11, '#8a8a94');
      p.ellipse(6, 6, 2.5, 1.6, '#2a2a30');
      p.ellipse(10, 6, 2.2, 1.4, '#3a3a40');
      p.set(6, 5, '#d8d8e4');
      p.set(10, 5, '#e0a050');
      p.set(8, 6, '#c8c8d0');
      for (const cx of [5, 11]) {
        p.ellipse(cx, 13, 1.6, 1.6, '#2a2a2a');
        p.set(cx, 13, '#8a8a94');
      }
      p.hline(1, 14, 15, '#5e4024');
      break;
    }
    case 'newspaper':
      p.rect(2, 3, 12, 10, '#ece6d4');
      p.rect(3, 4, 10, 2, '#2a2630');
      for (let y = 7; y < 12; y += 2) {
        p.hline(3, 7, y, '#8a8478');
        p.hline(9, 12, y, '#8a8478');
      }
      p.vline(8, 7, 12, '#c8c0b0');
      break;
    default:
      p.rect(4, 4, 8, 8, '#ff00ff');
  }
  return p.outline(OUT);
}

function blockIcon(id) {
  const b = BLOCKS[id];
  const atlasC = TEX.atlas;
  const ctx = atlasC.getContext('2d');
  const p = new Px(16, 16);
  const read = (slot, sx, sy, w, h) => ctx.getImageData(slot.x + sx, slot.y + sy, w, h).data;
  if (b.render === 'fence') {
    const f = TEX.misc.fence;
    for (const part of [f.west, f.post, f.east]) {
      const d = read(part, 0, 0, part.w, part.h);
      for (let y = 4; y < 26; y++) for (let x = 0; x < 16; x++) {
        const i = (y * 16 + x) * 4;
        if (d[i + 3]) p.set(x, Math.round((y - 4) * 0.7), [d[i], d[i + 1], d[i + 2]], 255);
      }
    }
    return p;
  }
  if (b.render === 'cube' || b.render === 'door') {
    const top = TEX.top[id * 4][0];
    const front = TEX.front[id * 4][0];
    // Squash the 16x16 top into 14x8 and put the front below it.
    const td = read(top, 0, 0, 16, 16);
    for (let y = 0; y < 8; y++) for (let x = 0; x < 14; x++) {
      const sx = Math.floor(x * 16 / 14);
      const sy = y * 2;
      const i = (sy * 16 + sx) * 4;
      if (td[i + 3]) p.set(x + 1, y + 1, [td[i], td[i + 1], td[i + 2]], 255);
    }
    const fd = read(front, 0, 0, 16, 12);
    for (let y = 0; y < 6; y++) for (let x = 0; x < 14; x++) {
      const sx = Math.floor(x * 16 / 14);
      const sy = y * 2;
      const i = (sy * 16 + sx) * 4;
      if (fd[i + 3]) p.set(x + 1, y + 9, [fd[i], fd[i + 1], fd[i + 2]], 255);
    }
    return p.outline(OUT);
  }
  // Sprites / plants / flats: crop the opaque bounds and fit into 16x16.
  const slots = TEX.sprite[id * 4];
  if (!slots || !slots[0]) return simpleIcon('?');
  const s = slots[0];
  const d = read(s, 0, 0, s.w, s.h);
  let x0 = 99, y0 = 99, x1 = -1, y1 = -1;
  for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) if (d[(y * s.w + x) * 4 + 3] > 0) {
    x0 = Math.min(x0, x);
    y0 = Math.min(y0, y);
    x1 = Math.max(x1, x);
    y1 = Math.max(y1, y);
  }
  if (x1 < 0) return p;
  const w = x1 - x0 + 1;
  const h = y1 - y0 + 1;
  const scale = Math.max(w / 16, h / 16, 1);
  const ow = Math.round(w / scale);
  const oh = Math.round(h / scale);
  const ox = Math.floor((16 - ow) / 2);
  const oy = Math.floor((16 - oh) / 2);
  for (let y = 0; y < oh; y++) for (let x = 0; x < ow; x++) {
    const sx = x0 + Math.floor(x * scale);
    const sy = y0 + Math.floor(y * scale);
    const i = (sy * s.w + sx) * 4;
    if (d[i + 3]) p.set(ox + x, oy + y, [d[i], d[i + 1], d[i + 2]], d[i + 3]);
  }
  return p;
}

// Worn things: a little picture of the piece in its colours.
function armorIcon(it) {
  const p = new Px(16, 16);
  const [lk, tintCol] = String(it.look).split(':');
  const col = tintCol || {
    lcap: '#7a5232', helmet: '#9a9aa8', straw: '#e8c860', hood: '#6a4a2a', circlet: '#e0b830', goggles: '#3a2a1e',
    leather: it.slot === 'feet' ? '#4a2e1a' : '#7a5232', chain: '#8a8a98', plate: '#a8aab8', linen: '#e8e0cc', coat: '#3a2a4a', cloth: '#4a4a6a', iron: '#8a8a98',
  }[lk] || '#888888';
  const c = hex(col);
  const hi = shade(c, 1.25);
  const lo = shade(c, 0.75);
  if (it.slot === 'head') {
    if (lk === 'straw') {
      p.rect(2, 9, 12, 2, c);
      p.rect(5, 5, 6, 4, shade(c, 0.9));
      p.hline(5, 10, 8, hex('#a83a2a'));
    } else if (lk === 'circlet') {
      p.ellipse(8, 9, 5, 2, c);
      for (let x = 6; x <= 10; x++) p.clear(x, 9);
      p.set(8, 7, hex('#50c0e0'));
    } else if (lk === 'goggles') {
      p.hline(1, 14, 8, c);
      p.ellipse(5, 8, 3, 3, hex('#2a2430'));
      p.ellipse(11, 8, 3, 3, hex('#2a2430'));
      p.set(4, 7, hex('#e09050'));
      p.set(10, 7, hex('#e09050'));
    } else {
      p.rect(4, 4, 8, 7, c);
      p.hline(4, 11, 4, hi);
      p.rect(3, 10, 10, 2, lo);
      if (lk === 'helmet') p.rect(7, 7, 2, 5, lo);
      if (lk === 'hood') p.rect(3, 6, 2, 8, c);
    }
  } else if (it.slot === 'body') {
    p.rect(4, 3, 8, 10, c);
    p.rect(2, 3, 2, 6, c);
    p.rect(12, 3, 2, 6, c);
    p.hline(4, 11, 3, hi);
    if (lk === 'chain') for (let y = 4; y < 13; y++) for (let x = 4; x < 12; x++) if ((x + y) % 2) p.set(x, y, lo);
    if (lk === 'plate') p.rect(7, 4, 2, 8, hi);
    if (lk === 'leather') for (let y = 5; y < 12; y += 2) p.set(8, y, hex('#3a2414'));
    if (lk === 'coat') p.rect(7, 3, 2, 11, hex('#c8a030'));
    if (lk === 'tabard') {
      // Mail sleeves and a coloured tabard down the front.
      const m = hex('#8a8a98');
      p.rect(2, 3, 2, 6, m);
      p.rect(12, 3, 2, 6, m);
      p.rect(4, 3, 8, 10, m);
      for (let y = 4; y < 13; y++) for (let x = 4; x < 12; x++) if ((x + y) % 2) p.set(x, y, hex('#6a6a78'));
      p.rect(5, 3, 6, 11, c);
      p.hline(5, 10, 3, hi);
      p.rect(7, 6, 2, 3, hex('#f0e0a0'));
    }
    p.hline(4, 11, 12, lo);
  } else if (it.slot === 'shield') {
    // A shield, face on.
    const face = lk === 'round' ? hex('#b83a32') : c;
    const rim = lk === 'iron' ? hex('#c8c8d4') : hex('#5a3a1a');
    if (lk === 'round') {
      p.ellipse(8, 8, 6, 6, rim);
      p.ellipse(8, 8, 5, 5, face);
      p.rect(7, 3, 2, 11, hex('#e8d8a0'));
      p.rect(3, 7, 11, 2, hex('#e8d8a0'));
      p.ellipse(8, 8, 1, 1, rim);
    } else {
      p.rect(3, 2, 10, 9, rim);
      p.rect(4, 3, 8, 8, face);
      p.rect(5, 11, 6, 2, rim);
      p.rect(6, 11, 4, 1, face);
      p.rect(7, 13, 2, 1, rim);
      if (lk === 'iron') p.rect(7, 3, 2, 9, hi);
      else for (let y = 3; y < 11; y += 2) p.hline(4, 11, y, lo);
    }
  } else if (it.slot === 'legs') {
    p.rect(4, 3, 8, 2, lo);
    p.rect(4, 5, 3, 9, c);
    p.rect(9, 5, 3, 9, c);
    if (lk === 'plate') {
      p.hline(4, 6, 9, hi);
      p.hline(9, 11, 9, hi);
    }
  } else {
    p.rect(3, 6, 3, 6, c);
    p.rect(3, 11, 5, 2, c);
    p.rect(9, 6, 3, 6, c);
    p.rect(9, 11, 5, 2, c);
    p.hline(3, 5, 6, hi);
    p.hline(9, 11, 6, hi);
  }
  return p.outline(OUT);
}

const iconCache = new Map();
// A glass bottle with a coloured draught.
function potionIcon(it) {
  const p = new Px(16, 16);
  const e = it.effect || {};
  const col = e.sight ? '#7ae0c8' : e.blue ? '#58a8ff' : e.heal ? '#e05050' : e.combat ? { breath: '#f0e060', wind: '#70f0c0', fury: '#d01838', haste: '#d8d8ff' }[e.combat] : { str: '#e0603a', agi: '#50c0e0', end: '#60c050', cha: '#e070c0' }[e.stat] || '#c0a0e0';
  if (e.heal) {
    // A salve: a little pot.
    p.rect(4, 7, 8, 6, '#c8b890');
    p.rect(4, 6, 8, 2, hex(col));
    p.hline(4, 11, 8, '#a89870');
    return p.outline(OUT);
  }
  p.rect(7, 2, 2, 3, '#c8e0e8');
  p.rect(6, 1, 4, 1, '#8a6a4a');
  // (A fighting draught comes in a squat flask, a bubble or two in it.)
  if (e.combat) {
    p.rect(4, 6, 8, 8, '#d8eef4');
    p.rect(5, 8, 6, 5, hex(col));
    p.set(7, 10, '#ffffff');
    p.set(9, 9, '#ffffff');
    p.set(5, 6, '#ffffff');
    return p.outline(OUT);
  }
  p.ellipse(8, 10, 4, 4, '#d8eef4');
  p.ellipse(8, 11, 3, 2.5, hex(col));
  p.set(6, 8, '#ffffff');
  return p.outline(OUT);
}

// A cut stone.
function gemIcon(it) {
  const p = new Px(16, 16);
  const g = GEMS[it.key] || { color: '#50c0e0' };
  // The rarer stones are cut their own ways: onyx a black cabochon with a
  // violet gleam, moonstone a pearly round with light inside it,
  // bloodstone a dark green stone flecked with red.
  if (it.key === 'onyx' || it.key === 'moonstone' || it.key === 'bloodstone') {
    const b = hex(g.body);
    p.ellipse(8, 8, 4.5, 3.6, b);
    p.ellipse(8, 9, 4, 2.6, shade(b, 0.8));
    p.ellipse(8, 7.2, 3.4, 2.2, shade(b, it.key === 'moonstone' ? 1.04 : 1.2));
    if (it.key === 'onyx') {
      p.rect(5, 6, 3, 1, hex('#9a6ad8'));
      p.set(6, 5, hex('#d8c0ff'));
    } else if (it.key === 'moonstone') {
      p.ellipse(8, 8, 2.2, 1.6, hex('#bcd8ff'));
      p.set(9, 7, '#ffffff');
      p.set(6, 6, '#ffffff');
    } else {
      for (const [x, y] of [[6, 7], [9, 8], [10, 6], [7, 10], [5, 9]]) p.set(x, y, hex('#e83848'));
      p.set(6, 6, '#c8f0d0');
    }
    return p.outline(OUT);
  }
  const c = hex(g.color);
  p.rect(5, 5, 6, 2, shade(c, 1.3));
  p.rect(4, 7, 8, 2, c);
  p.rect(5, 9, 6, 1, shade(c, 0.8));
  p.rect(6, 10, 4, 1, shade(c, 0.7));
  p.rect(7, 11, 2, 1, shade(c, 0.6));
  p.set(6, 5, '#ffffff');
  return p.outline(OUT);
}

// A glow in the colour of a set stone, round the outline of a piece: a
// bright rim a pixel out and a softer one beyond it.
const glowCache = new Map();
function glowOf(icon, color, tag, thin = false) {
  const k = `${tag}:${icon.width}:${color}:${thin}`;
  let g = glowCache.get(k);
  if (g) return g;
  const w = icon.width;
  const h = icon.height;
  const src = icon.getContext('2d').getImageData(0, 0, w, h).data;
  const solid = (x, y) => x >= 0 && y >= 0 && x < w && y < h && src[(y * w + x) * 4 + 3] > 40;
  g = document.createElement('canvas');
  g.width = w + 4;
  g.height = h + 4;
  const ctx = g.getContext('2d');
  const out = ctx.createImageData(w + 4, h + 4);
  const [r, gg, b] = [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16));
  for (let y = -2; y < h + 2; y++) {
    for (let x = -2; x < w + 2; x++) {
      if (solid(x, y)) continue;
      let d = 9;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (solid(x + dx, y + dy)) d = Math.min(d, Math.max(Math.abs(dx), Math.abs(dy)));
      if (d > (thin ? 1 : 2)) continue;
      const i = ((y + 2) * (w + 4) + x + 2) * 4;
      out.data[i] = r;
      out.data[i + 1] = gg;
      out.data[i + 2] = b;
      out.data[i + 3] = thin ? 170 : d === 1 ? 230 : 110;
    }
  }
  ctx.putImageData(out, 0, 0);
  glowCache.set(k, g);
  return g;
}

// Draw an item's icon; a jewelled one pulses with its stone's colour, with
// a glint running round it.
// A jewelled piece with its stone's glow round it: a broad glow in your pack
// (`thin` false), a slighter one out in the world.
export function drawJewelled(ctx, icon, key, x, y, t = 0, thin = false) {
  const it = ITEMS[key];
  if (it && it.socket && GEMS[it.socket]) {
    const color = GEMS[it.socket].color;
    const g = glowOf(icon, color, key, thin);
    const a = ctx.globalAlpha;
    const phase = (key.length * 1.7) % 6;
    ctx.globalAlpha = a * (0.35 + 0.55 * (0.5 + 0.5 * Math.sin(t * 3.2 + phase)));
    ctx.drawImage(g, x - 2, y - 2);
    ctx.globalAlpha = a;
  }
  ctx.drawImage(icon, x, y);
}

// Food with bites taken out of it (1-3): bites nibbled from the edges in.
const bitten = new Map();
export function bittenIcon(key, bites) {
  const k = `${key}:${bites}`;
  let c = bitten.get(k);
  if (c) return c;
  const src = itemIcon(key);
  c = document.createElement('canvas');
  c.width = 16;
  c.height = 16;
  const ctx = c.getContext('2d');
  ctx.drawImage(src, 0, 0);
  const img = ctx.getImageData(0, 0, 16, 16);
  const d = img.data;
  // Round bites out of the right-hand side, one a little further in each time.
  for (let b = 0; b < Math.min(3, bites); b++) {
    const cx = 13 - b * 3;
    const cy = 6 + ((b * 5) % 6);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= 6) d[(y * 16 + x) * 4 + 3] = 0;
  }
  ctx.putImageData(img, 0, 0);
  bitten.set(k, c);
  return c;
}

export function itemIcon(key) {
  let c = iconCache.get(key);
  if (c) return c;
  const it = ITEMS[key];
  // A piece with a stone set in it looks like the plain piece: the stone
  // shows as a glow round it (see drawJewelled).
  if (it && it.socket) {
    c = itemIcon(it.base);
    iconCache.set(key, c);
    return c;
  }
  let px;
  // (A Kavorent fitting: the piece's own picture, a seam of light along it.)
  const dIcon = it && !it.enhanced ? dungeonIcon(key, it) : null;
  if (it && it.enhanced) {
    const base = itemIcon(it.base);
    const d = base.getContext('2d').getImageData(0, 0, 16, 16).data;
    const bp = new Px(16, 16);
    for (let i = 0; i < 256; i++) if (d[i * 4 + 3]) bp.set(i % 16, Math.floor(i / 16), [d[i * 4], d[i * 4 + 1], d[i * 4 + 2]], d[i * 4 + 3]);
    px = edgeOverlay(bp);
  } else if (dIcon) px = dIcon;
  else if (!it) px = simpleIcon(key);
  else if (it.kind === 'potion') px = potionIcon(it);
  else if (it.kind === 'gem') px = gemIcon(it);
  else if (it.block !== undefined && it.kind === 'block') px = blockIcon(it.block);
  else {
    const m = key.match(/^(wood|stone|iron|gold|steel)_(pickaxe|axe|shovel|sword)$/);
    if (m) px = toolIcon(m[2], m[1]);
    else if (key === 'hoe') px = toolIcon('hoe', 'iron');
    else if (key === 'hammer') px = toolIcon('hammer', 'iron');
    else if (it.kind === 'armor') px = armorIcon(it);
    else px = simpleIcon(key);
  }
  c = toCanvas(px);
  iconCache.set(key, c);
  return c;
}

export { toCanvas };
export const SPRITE_FRAME_H = SPR_H;

// A faint outline of a stone's colour round one frame of a sheet (someone
// in jewelled armour), one pixel wide.
const frameGlows = new WeakMap();
export function frameGlow(sheet, fx, fy, w, h, color) {
  let m = frameGlows.get(sheet);
  if (!m) frameGlows.set(sheet, (m = new Map()));
  const k = `${fx}:${fy}:${color}`;
  let g = m.get(k);
  if (g) return g;
  const src = sheet.getContext('2d').getImageData(fx, fy, w, h).data;
  const solid = (x, y) => x >= 0 && y >= 0 && x < w && y < h && src[(y * w + x) * 4 + 3] > 40;
  g = document.createElement('canvas');
  g.width = w + 2;
  g.height = h + 2;
  const ctx = g.getContext('2d');
  const out = ctx.createImageData(w + 2, h + 2);
  const [r, gg, b] = [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16));
  for (let y = -1; y <= h; y++) {
    for (let x = -1; x <= w; x++) {
      if (solid(x, y)) continue;
      if (!(solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1))) continue;
      const i = ((y + 1) * (w + 2) + x + 1) * 4;
      out.data[i] = r;
      out.data[i + 1] = gg;
      out.data[i + 2] = b;
      out.data[i + 3] = 200;
    }
  }
  ctx.putImageData(out, 0, 0);
  m.set(k, g);
  return g;
}
