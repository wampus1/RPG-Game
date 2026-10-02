// Pictures of what's found below ground: the things that live (or don't)
// in dungeons and the Kavorent's halls, and what you bring back up.
import { Px, shade, hex } from './pixel.js';

const OUT = '#1c1622';
const K = { dark: '#1c1a2a', plate: '#2a2840', edge: '#4a4870', seam: '#5ad8f0', glow: '#c8fbff', red: '#ff4050' };

// ---------------------------------------------------------------- creatures
// All side on, facing left (the renderer flips them for right); frames
// across. Most are 16 square; the great ones 32.

// A crypt rat: low, quick, a long tail.
function rat(frame) {
  const p = new Px(16, 16);
  const fur = hex('#6a5e58');
  const dark = shade(fur, 0.7);
  const w = frame % 2;
  p.ellipse(9, 12, 3.5, 2, fur);
  p.ellipse(5, 12, 2, 1.6, fur);
  p.set(3, 12, '#c89090');
  p.set(4, 11, '#ff5040');
  p.set(6, 10, dark);
  p.line(12, 12, 15, 10 + w, '#c89090');
  for (const x of [6 + w, 8 - w, 10 + w, 11 - w]) p.set(x, 14, dark);
  return p.outline(OUT);
}

// A tunnel crawler: a long armoured body in plates, many legs, mandibles.
function crawler(frame) {
  const p = new Px(16, 16);
  const shell = hex('#7a5a3a');
  const dark = shade(shell, 0.65);
  const w = frame % 2;
  for (let i = 0; i < 5; i++) {
    const x = 3 + i * 2.6;
    const y = 10 + Math.round(Math.sin(i + frame) * 0.6);
    p.ellipse(x, y, 2, 2.4, i % 2 ? shell : shade(shell, 1.12));
    p.set(Math.round(x), y + 3, dark);
    p.set(Math.round(x) + (w ? 1 : -1), y + 4, dark);
  }
  p.ellipse(2, 9, 2.2, 2.2, shade(shell, 1.2));
  p.set(0, 11, '#e8d8a0');
  p.set(1, 12, '#e8d8a0');
  p.set(1, 8, '#ffb040');
  return p.outline(OUT);
}

// A gloom moth: grey-brown wings, drawn to any light (no outline: dusty).
function moth(frame) {
  const p = new Px(16, 16);
  const up = frame % 2;
  const wing = hex('#8a8070');
  p.ellipse(8, 7, 1, 2.5, hex('#3a3428'));
  if (up) {
    p.ellipse(5, 4, 3, 2.5, wing);
    p.ellipse(11, 4, 3, 2.5, wing);
  } else {
    p.ellipse(4.5, 7, 3.5, 2, wing);
    p.ellipse(11.5, 7, 3.5, 2, wing);
  }
  p.set(5, 5 + (up ? -1 : 2), '#e8d8a8');
  p.set(11, 5 + (up ? -1 : 2), '#e8d8a8');
  p.set(7, 4, '#3a3428');
  p.set(9, 4, '#3a3428');
  return p;
}

// A sentinel drone: a hovering ball of alloy, one red eye, fins.
function drone(frame) {
  const p = new Px(16, 16);
  const bob = frame % 2;
  const cy = 6 + bob;
  p.ellipse(8, cy, 4.5, 4, hex(K.plate));
  p.ellipse(8, cy - 1, 3.5, 2.5, hex('#3a3858'));
  p.rect(2, cy, 3, 1, hex(K.edge));
  p.rect(11, cy, 3, 1, hex(K.edge));
  p.ellipse(6, cy, 1.6, 1.6, hex('#3a1018'));
  p.set(6, cy, K.red);
  p.set(5, cy - 1, '#ffc0c0');
  p.hline(5, 11, cy + 3, hex(K.seam));
  // Its downwash: a faint glow under it.
  p.set(8, cy + 6, hex(K.seam), 120);
  p.set(7, cy + 7, hex(K.seam), 70);
  p.set(9, cy + 7, hex(K.seam), 70);
  return p.outline(OUT);
}

// A mender: a spider of alloy with a glowing welding arm.
function mender(frame) {
  const p = new Px(16, 16);
  const w = frame % 2;
  p.ellipse(9, 10, 3.5, 2.5, hex(K.plate));
  p.hline(7, 11, 9, hex(K.seam));
  for (let i = 0; i < 3; i++) {
    p.line(7 + i * 2, 11, 5 + i * 3 + (w ? 1 : 0), 15, hex(K.edge));
    p.line(9 + i, 11, 11 + i * 2 - (w ? 1 : 0), 15, hex(K.edge));
  }
  p.line(6, 9, 3, 6, hex(K.edge));
  p.set(2, 5, K.glow);
  p.set(3, 5, K.seam);
  return p.outline(OUT);
}

// An arc mite: a crackling little bug of alloy and lightning.
function mite(frame) {
  const p = new Px(16, 16);
  const w = frame % 2;
  p.ellipse(8, 11, 3, 2.2, hex('#3a3858'));
  p.set(6, 10, '#fff8a0');
  p.set(9, 10, '#fff8a0');
  for (const x of [5 + w, 8 - w, 11 + w]) p.set(x, 14, hex(K.edge));
  if (w) {
    p.line(8, 8, 6, 5, '#fff0a0');
    p.line(9, 8, 12, 6, '#ffe060');
  } else p.line(7, 8, 9, 5, '#fff0a0');
  return p.outline(OUT);
}

// A Kavorent golem (32 square): a great hunched body of dark alloy plates,
// arms like pillars, a core of light in its chest.
function golem(frame, variant = 0) {
  const p = new Px(32, 32);
  const prime = variant === 1;
  const plate = hex(prime ? '#3a2a48' : K.plate);
  const hi = shade(plate, 1.35);
  const w = frame % 2;
  // Legs.
  p.rect(9, 22 + w, 5, 9 - w, shade(plate, 0.8));
  p.rect(18, 22 + (1 - w), 5, 9 - (1 - w), shade(plate, 0.8));
  // Body.
  p.rect(7, 9, 18, 14, plate);
  p.hline(7, 24, 9, hi);
  p.rect(10, 4, 12, 7, plate);
  p.hline(10, 21, 4, hi);
  // The head: a visor slit.
  p.hline(12, 19, 7, prime ? '#ff7040' : K.seam);
  // The core.
  p.ellipse(16, 15, 3, 3, hex('#0e2a38'));
  p.ellipse(16, 15, 2, 2, hex(prime ? '#ff9050' : K.seam));
  p.set(16, 15, '#ffffff');
  // Arms.
  p.rect(2, 10 + w, 5, 14, plate);
  p.rect(25, 10 + (1 - w), 5, 14, plate);
  p.rect(1, 22 + w, 7, 4, shade(plate, 1.2));
  p.rect(24, 22 + (1 - w), 7, 4, shade(plate, 1.2));
  // Seams.
  p.vline(16, 19, 22, hex(K.seam));
  p.hline(8, 23, 20, hex(K.edge));
  return p.outline(OUT);
}

// The Ossuary Horror (32): a heaving mound of bones with many skulls.
function horror(frame) {
  const p = new Px(32, 32);
  const bone = hex('#d8d0b8');
  const dark = hex('#8a8270');
  const w = frame % 2;
  p.ellipse(16, 20 - w, 13, 11, dark);
  for (let i = 0; i < 40; i++) {
    const a = (i * 2.399) % (Math.PI * 2);
    const r = (i * 7) % 11;
    const x = 16 + Math.cos(a) * r;
    const y = 20 - w + Math.sin(a) * r * 0.8;
    p.line(x, y, x + 2, y + 1, bone);
  }
  for (const [x, y] of [[10, 12], [18, 10], [23, 16], [13, 20]]) {
    p.rect(x, y - w, 4, 3, bone);
    p.set(x + 1, y + 1 - w, '#ff4030');
    p.set(x + 3, y + 1 - w, '#ff4030');
  }
  return p.outline(OUT);
}

// The Deep Worm (32): a vast segmented head reared up out of the ground.
function worm(frame) {
  const p = new Px(32, 32);
  const hide = hex('#8a6a4a');
  const w = frame % 2;
  p.ellipse(16, 30, 12, 3, hex('#3a2c20'));
  for (let i = 0; i < 4; i++) p.ellipse(16 + (i % 2 ? 1 : -1) * w, 26 - i * 5, 7 - i * 0.6, 3.5, i % 2 ? hide : shade(hide, 1.15));
  // The mouth: a ring of teeth.
  p.ellipse(16, 7, 6, 4, shade(hide, 0.6));
  p.ellipse(16, 7, 4, 2.5, hex('#3a0c10'));
  for (let x = 12; x <= 20; x += 2) p.set(x, 5 + (x % 4 ? 0 : 1), '#f0e8c8');
  return p.outline(OUT);
}

// The Overseer (32): a floating ring of alloy round a single great eye,
// shards circling it.
function overseer(frame) {
  const p = new Px(32, 32);
  const t = frame % 4;
  p.ellipse(16, 14, 11, 11, hex(K.plate));
  p.ellipse(16, 14, 8, 8, hex(K.dark));
  p.ellipse(16, 14, 5, 5, hex('#3a1018'));
  p.ellipse(16, 14, 3, 3, hex(K.red));
  p.set(15, 13, '#ffe0e0');
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + t * 0.26;
    p.rect(16 + Math.cos(a) * 13 - 1, 14 + Math.sin(a) * 13 - 1, 3, 3, hex(K.edge));
    p.set(16 + Math.cos(a) * 13, 14 + Math.sin(a) * 13, hex(K.seam));
  }
  p.hline(10, 22, 26, hex(K.seam));
  return p.outline(OUT);
}

export const DUNGEON_CREATURES = {
  rat: { frames: 2, draw: (f) => rat(f) },
  crawler: { frames: 2, draw: (f) => crawler(f) },
  moth: { frames: 2, draw: (f) => moth(f) },
  drone: { frames: 2, draw: (f) => drone(f) },
  mender: { frames: 2, draw: (f) => mender(f) },
  mite: { frames: 2, draw: (f) => mite(f) },
  golem: { frames: 2, size: 32, draw: (f, v) => golem(f, v) },
  prime: { frames: 2, size: 32, draw: (f) => golem(f, 1) },
  horror: { frames: 2, size: 32, draw: (f) => horror(f) },
  worm: { frames: 2, size: 32, draw: (f) => worm(f) },
  overseer: { frames: 4, size: 32, draw: (f) => overseer(f) },
};

// How the things that walk like people look (drawn as people are).
export const MONSTER_LOOKS = {
  wight: { skin: '#8a9aa4', hair: '#c8ccc8', hairStyle: 'long', shirt: '#4a4a52', pants: '#3a3a42', shoes: '#2a2a30', outfit: 'plain', accent: '#5a6a8a', hat: 'helmet', gear: { body: 'chain:#6a6458', legs: 'plate:#5a5a62' }, eyes: '#80d8ff' },
  wight_king: { skin: '#9aa8b0', hair: '#e0e4e0', hairStyle: 'long', shirt: '#3a3a52', pants: '#2a2a3a', shoes: '#2a2a30', outfit: 'plain', accent: '#c8a030', hat: 'circlet', gear: { body: 'plate:#7a7464', legs: 'plate:#6a6458' }, eyes: '#a0e8ff' },
  captain: { skin: '#e8e4d4', hair: '#e8e4d4', hairStyle: 'bald', shirt: '#d8d4c4', pants: '#c8c4b4', shoes: '#c8c4b4', outfit: 'skeleton', accent: '#a02828', hat: 'helmet', eyes: '#ff5040' },
  drowned: { skin: '#7aa098', hair: '#3a5a3a', hairStyle: 'long', shirt: '#4a5e58', pants: '#3a4a46', shoes: '#2a3a36', outfit: 'rags', accent: '#3a5a3a', hat: null, eyes: '#c8ffd0' },
  priest: { skin: '#7aa098', hair: '#3a5a3a', hairStyle: 'long', shirt: '#2a4a5a', pants: '#2a3a46', shoes: '#1a2a36', outfit: 'robe_blue', accent: '#c8a030', hat: 'hood', eyes: '#c8ffd0' },
  cutthroat: { skin: '#c8946a', hair: '#2a1e14', hairStyle: 'short', shirt: '#3a2e26', pants: '#2a2420', shoes: '#1a1410', outfit: 'vest', accent: '#8a2020', hat: 'hood' },
  holdout_archer: { skin: '#b07a50', hair: '#4a2e1a', hairStyle: 'ponytail', shirt: '#4a5a32', pants: '#3a3226', shoes: '#2a1e14', outfit: 'hunter', accent: '#6a4a2a', hat: null },
  warlord: { skin: '#a87a58', hair: '#1a1410', hairStyle: 'short', shirt: '#5a2020', pants: '#3a3030', shoes: '#2a2020', outfit: 'plain', accent: '#c8a030', hat: 'helmet', gear: { body: 'plate:#6a5a50', legs: 'plate:#5a4a40' } },
  warden: { skin: '#3a3858', hair: '#2a2840', hairStyle: 'bald', shirt: '#2a2840', pants: '#24223a', shoes: '#1c1a2a', outfit: 'plain', accent: '#5ad8f0', hat: 'kav', gear: { body: 'kav', legs: 'kav', feet: 'kav' }, eyes: '#5ad8f0', visor: true },
};

// ---------------------------------------------------------------- items
export function dungeonIcon(key, it) {
  const p = new Px(16, 16);
  if (it.kind === 'shard') {
    const c = hex(it.color || '#ffffff');
    p.line(5, 12, 8, 3, c);
    p.line(6, 12, 9, 4, c);
    p.line(7, 12, 10, 6, shade(c, 0.75));
    p.set(8, 4, '#ffffff');
    p.line(9, 13, 12, 9, shade(c, 1.2));
    p.set(12, 9, '#ffffff');
    return p.outline(OUT);
  }
  if (it.kind === 'relic') {
    const c = hex(it.color || '#ffffff');
    p.ellipse(8, 8, 5, 5, shade(c, 0.35), 160);
    p.ellipse(8, 8, 3.5, 3.5, c);
    p.ellipse(7, 7, 1.5, 1.5, '#ffffff');
    for (let a = 0; a < 8; a++) {
      const t = (a / 8) * Math.PI * 2;
      p.set(8 + Math.cos(t) * 6.5, 8 + Math.sin(t) * 6.5, shade(c, 0.8));
    }
    return p;
  }
  switch (key) {
    case 'old_coin':
      p.ellipse(6, 9, 3.5, 3.5, '#8a8a98');
      p.ellipse(6, 9, 2.5, 2.5, '#b8b8c4');
      p.ellipse(10, 7, 3.5, 3.5, '#a08a40');
      p.ellipse(10, 7, 2.5, 2.5, '#c8b060');
      p.set(10, 7, '#6a5a20');
      p.set(6, 9, '#5a5a66');
      return p.outline(OUT);
    case 'old_blueprint':
      p.rect(2, 3, 12, 10, '#2a4a8a');
      p.rect(3, 4, 10, 8, '#3a5aa0');
      p.rect(5, 6, 4, 4, '#3a5aa0');
      p.hline(4, 11, 5, '#c8d8f0');
      p.vline(5, 6, 10, '#c8d8f0');
      p.hline(5, 9, 10, '#c8d8f0');
      p.vline(9, 6, 10, '#c8d8f0');
      p.line(9, 6, 12, 9, '#c8d8f0');
      p.rect(13, 3, 1, 10, '#d8c8a0');
      return p.outline(OUT);
    case 'sigil':
      p.ellipse(8, 8, 5, 5, '#8a6a2a');
      p.ellipse(8, 8, 4, 4, '#c89a40');
      for (const [x, y] of [[8, 5], [8, 11], [5, 8], [11, 8], [8, 8]]) p.set(x, y, '#fff0a0');
      p.rect(7, 1, 2, 3, '#8a6a2a');
      return p.outline(OUT);
    case 'kav_key':
      p.rect(4, 3, 8, 10, K.plate);
      p.rect(6, 5, 4, 6, K.seam);
      p.rect(7, 6, 2, 4, K.glow);
      p.vline(4, 3, 12, K.edge);
      return p.outline(OUT);
    case 'kav_scrap':
      p.line(3, 11, 9, 5, K.plate);
      p.line(4, 12, 10, 6, '#3a3858');
      p.rect(8, 8, 5, 4, K.plate);
      p.hline(8, 12, 8, K.edge);
      p.set(10, 10, K.seam);
      p.set(6, 8, K.seam);
      return p.outline(OUT);
    case 'kav_core':
      p.ellipse(8, 8, 5.5, 5.5, K.dark);
      p.ellipse(8, 8, 4.5, 4.5, '#24223a');
      p.ellipse(8, 8, 3, 3, '#2a6a80');
      p.ellipse(8, 8, 1.8, 1.8, K.seam);
      p.set(7, 7, '#ffffff');
      for (const [x, y] of [[3, 8], [13, 8], [8, 3], [8, 13]]) p.set(x, y, K.edge);
      return p.outline(OUT);
    case 'kav_blade':
      p.line(3, 13, 12, 4, K.seam);
      p.line(4, 13, 13, 4, K.glow);
      p.line(5, 13, 13, 5, '#3a8aa0');
      p.rect(2, 11, 4, 2, K.plate);
      p.line(1, 15, 3, 13, K.edge);
      return p.outline(OUT);
    case 'kav_lance':
      p.line(2, 14, 13, 3, K.plate);
      p.line(3, 14, 14, 3, K.edge);
      p.rect(12, 1, 3, 3, K.seam);
      p.set(13, 2, K.glow);
      return p.outline(OUT);
    case 'kav_caster':
      p.rect(2, 7, 11, 4, K.plate);
      p.hline(2, 12, 7, K.edge);
      p.rect(12, 8, 3, 2, K.seam);
      p.rect(4, 11, 2, 3, K.plate);
      p.hline(4, 10, 9, K.seam);
      return p.outline(OUT);
    case 'kav_blink':
      p.line(8, 2, 5, 9, K.seam);
      p.line(5, 9, 10, 8, K.seam);
      p.line(10, 8, 7, 14, K.glow);
      p.set(8, 2, '#ffffff');
      return p.outline(OUT);
    case 'kav_everlight':
      p.rect(6, 9, 4, 6, K.plate);
      p.ellipse(8, 6, 3, 3, K.glow);
      p.ellipse(8, 6, 1.6, 1.6, '#ffffff');
      return p.outline(OUT);
    case 'kav_mender':
      p.rect(4, 3, 8, 11, K.plate);
      p.rect(5, 5, 6, 7, '#1a4a3a');
      p.rect(7, 6, 2, 5, '#7affb0');
      p.rect(6, 8, 4, 1, '#7affb0');
      return p.outline(OUT);
    case 'kav_bulwark':
      p.rect(5, 9, 6, 5, K.plate);
      for (let x = 2; x < 14; x++) p.set(x, 4 + Math.round(Math.abs(x - 8) * 0.3), K.seam);
      p.vline(8, 5, 8, K.glow);
      return p.outline(OUT);
    case 'kav_lodestar':
      p.ellipse(8, 8, 5, 5, K.plate);
      p.ellipse(8, 8, 4, 4, '#24223a');
      p.line(8, 4, 8, 8, K.red);
      p.line(8, 8, 8, 12, K.seam);
      p.set(8, 8, '#ffffff');
      return p.outline(OUT);
    case 'kav_visor':
      p.rect(3, 4, 10, 8, K.plate);
      p.hline(3, 12, 4, K.edge);
      p.rect(4, 7, 8, 2, K.seam);
      p.hline(5, 10, 7, K.glow);
      return p.outline(OUT);
    case 'kav_carapace':
      p.rect(3, 3, 10, 11, K.plate);
      p.rect(1, 3, 2, 6, K.plate);
      p.rect(13, 3, 2, 6, K.plate);
      p.hline(3, 12, 3, K.edge);
      p.vline(8, 5, 12, K.seam);
      p.hline(4, 11, 9, K.edge);
      return p.outline(OUT);
    case 'kav_greaves':
      p.rect(4, 3, 3, 11, K.plate);
      p.rect(9, 3, 3, 11, K.plate);
      p.hline(4, 6, 8, K.seam);
      p.hline(9, 11, 8, K.seam);
      return p.outline(OUT);
    case 'kav_treads':
      p.rect(2, 9, 5, 5, K.plate);
      p.rect(9, 9, 5, 5, K.plate);
      p.hline(2, 6, 13, K.seam);
      p.hline(9, 13, 13, K.seam);
      return p.outline(OUT);
    case 'kav_aegis':
      p.rect(4, 2, 8, 12, K.plate);
      p.rect(5, 3, 6, 10, '#24223a');
      for (let y = 3; y < 13; y++) p.set(8 + Math.round(Math.sin(y) * 1.5), y, K.seam);
      p.hline(4, 11, 2, K.edge);
      return p.outline(OUT);
    case 'kav_edge':
      p.line(3, 12, 12, 3, K.edge);
      p.line(4, 12, 13, 3, K.seam);
      p.line(3, 11, 12, 2, K.glow);
      return p.outline(OUT);
    case 'kav_plating':
      p.rect(3, 4, 10, 8, K.plate);
      p.hline(3, 12, 4, K.edge);
      p.hline(4, 11, 8, K.seam);
      p.set(5, 6, K.edge);
      p.set(10, 6, K.edge);
      return p.outline(OUT);
  }
  return null;
}

// A piece with a Kavorent fitting: its own picture with a seam of cold
// light along it.
export function edgeOverlay(px) {
  const out = new Px(16, 16);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const c = px.get(x, y);
    if (c[3]) out.set(x, y, c, c[3]);
  }
  // A line of light along the upper-right edge of what's there.
  for (let y = 0; y < 16; y++) {
    for (let x = 15; x >= 0; x--) {
      const c = out.get(x, y);
      if (c[3] && !(c[0] === 0x1c && c[1] === 0x16 && c[2] === 0x22)) {
        if ((x + y) % 2 === 0) out.set(x, y, K.seam);
        break;
      }
    }
  }
  return out;
}
