// Procedural character, creature and item sprites.
import { Px, hex, shade } from './pixel.js';
import { TEX, SPR_H } from './textures.js';
import { ITEMS } from '../world/items.js';
import { BLOCKS } from '../world/blocks.js';
import { mulberry32, hashString } from '../util/rng.js';

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
  noble: { trim: '#e0b030' },
  fisher: { vest: '#4a5a6a' },
  farmer: { overall: '#4a6a9a' },
  plaid: { check: '#5a1e1a' },
  miner: { vest: '#5a4a3a' },
  hunter: { tunic: '#4a6a32', hood: '#6a4a2a' },
  rags: { patch: '#6a5a4a' },
  vest: { vest: '#3a2a22' },
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
  }
  // Shirt patterns on everyday clothes.
  const pat = look.pattern;
  if (pat && !skel && ['plain', 'vest', 'fisher', 'miner', 'apron', 'baker', 'smith', 'hunter', 'plaid'].includes(outfit)) {
    if (pat === 'stripes') for (let y = torsoY + 1; y < torsoY + torsoH; y += 2) for (let x = tx; x < tx + tw; x++) if (p.get(flip ? CHAR_W - 1 - x : x, y + SPR_PAD)[3]) S(x, y, shade(shirtC, 0.78));
    if (pat === 'collar') R(tx + 1, torsoY, tw - 2, 1, hex('#e8e0d0'));
    if (pat === 'sash' && dir !== 2) for (let i = 0; i < torsoH; i++) S(tx + (side ? 1 + (i >> 1) : 1 + i), torsoY + i, accent);
    if (pat === 'buttons' && dir === 0) for (let y = torsoY + 1; y < torsoY + torsoH; y += 2) S(7, y, hex('#e8d8a0'));
  }
  // Belt.
  if (!outfit.startsWith('robe') && outfit !== 'farmer') R(tx, legY - 1, tw, 1, shade(pantsC, 0.7));
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
  const armC = outfit.startsWith('robe') ? hex(oc.robe) : outfit === 'guard' || gear.body === 'tabard' ? hex(OUTFIT_COLORS.guard.chain2) : shirtC;
  if (!side) {
    const swing = frame === 3 ? -2 : walk;
    R(3, torsoY + (swing > 0 ? -1 : 0), 1, torsoH - 1, armC);
    R(12, torsoY + (swing < 0 ? -1 : 0), 1, torsoH - 1, armC);
    S(3, torsoY + torsoH - 1 + (swing > 0 ? -1 : 0), skinC);
    S(12, torsoY + torsoH - 1 + (swing < 0 ? -1 : 0), skinC);
  } else {
    const ax = frame === 3 ? 4 : 7 + walk;
    R(ax, torsoY + 1, 2, torsoH - 2, shade(armC, 0.9));
    R(ax, torsoY + torsoH - 1, 2, 1, skinC);
    if (frame === 3) R(2, torsoY + 2, 3, 2, skinC);
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
  }
  // Face.
  const eye = skel ? hex('#1a1414') : hex('#1e1a28');
  if (dir === 0) {
    S(hx + 2, hy + 4, eye);
    S(hx + 5, hy + 4, eye);
    if (skel) {
      S(hx + 3, hy + 4, eye);
      S(hx + 6, hy + 4, eye);
      R(hx + 2, hy + 6, 4, 1, eye);
    } else if (look.beard) R(hx + 1, hy + 5, 6, 2, hairC);
    else S(hx + 3, hy + 6, shade(skinC, 0.8));
  } else if (side) {
    S(hx + 1, hy + 4, eye);
    S(hx - 1 + 0, hy + 4, skinC);
    if (look.beard && !skel) R(hx, hy + 5, 4, 2, hairC);
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
      case 'flower':
        H(side ? hx + 5 : hx + 6, hy, 2, 1, '#f080b0');
        H(side ? hx + 6 : hx + 7, hy - 1, 1, 1, '#ffe070');
        break;
      case 'lcap':
        H(hx, hy - 1, 8, 3, '#7a5232');
        H(hx, hy + 1, 8, 1, '#5a3a1e');
        if (side) H(hx + 7, hy + 2, 1, 3, '#7a5232');
        break;
      case 'hood':
        H(hx - 1, hy - 1, 10, 3, '#6a4a2a');
        H(hx - 1, hy + 2, 1, 5, '#6a4a2a');
        H(hx + 8, hy + 2, 1, 5, '#6a4a2a');
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

export const CREATURE_LOOKS = {
  slime: { frames: 2, draw: (f, v) => slime(f, ['#58c048', '#4a8ae0', '#c04ad0'][v % 3]) },
  wolf: { frames: 2, draw: (f) => quadruped(f, ['#6a6a74', '#4a4a54', '#8a8a94'], 'wolf') },
  boar: { frames: 2, draw: (f) => quadruped(f, ['#6a4a34', '#4a3224', '#8a6448'], 'boar') },
  deer: { frames: 2, draw: (f) => quadruped(f, ['#a8744a', '#7a5434', '#c89a6a'], 'deer') },
  rabbit: { frames: 2, draw: (f) => quadruped(f, ['#c8b8a0', '#a89880', '#e8dcc8'], 'rabbit') },
  chicken: { frames: 2, draw: (f) => quadruped(f, ['#f4f0e8', '#c8c0b0', '#ffffff'], 'chicken') },
};

// Creature sheet: frames in a row; left-facing, renderer flips for right.
export function creatureSheet(kind, variant = 0) {
  const key = `c:${kind}:${variant}`;
  let c = sheetCache.get(key);
  if (c) return c;
  const L = CREATURE_LOOKS[kind];
  const sheet = new Px(16 * L.frames * 2, 16);
  for (let f = 0; f < L.frames; f++) {
    const img = L.draw(f, variant);
    sheet.blit(img, f * 16, 0);
    sheet.blit(img, (L.frames + f) * 16, 0, true);
  }
  c = toCanvas(sheet);
  sheetCache.set(key, c);
  return c;
}

// ---------------------------------------------------------------- items
const TIER = { wood: ['#a07a4a', '#7a5a34'], stone: ['#9a9aa4', '#6a6a74'], iron: ['#d8d8e4', '#9a9aa8'], gold: ['#f0d040', '#b89820'] };
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
  const p = new Px(16, 16);
  const rand = mulberry32(hashString(key));
  switch (key) {
    case 'stick':
      p.line(4, 13, 12, 3, '#8a6038');
      p.line(5, 13, 13, 3, '#5e4024');
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
    case 'club':
      p.line(3, 13, 9, 7, HANDLE[0]);
      p.ellipse(11, 5, 3, 3, '#7a5430');
      break;
    case 'dagger':
      p.line(6, 10, 12, 4, '#d8d8e4');
      p.line(4, 9, 7, 12, '#6a5030');
      p.line(3, 13, 5, 11, HANDLE[1]);
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
    lcap: '#7a5232', helmet: '#9a9aa8', straw: '#e8c860', hood: '#6a4a2a', circlet: '#e0b830',
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
export function itemIcon(key) {
  let c = iconCache.get(key);
  if (c) return c;
  const it = ITEMS[key];
  let px;
  if (!it) px = simpleIcon('?');
  else if (it.block !== undefined && it.kind === 'block') px = blockIcon(it.block);
  else {
    const m = key.match(/^(wood|stone|iron|gold)_(pickaxe|axe|shovel|sword)$/);
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
