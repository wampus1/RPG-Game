// (Round 73) The ancient places' own creatures, drawn (see
// entities/ancientmobs.js): 16 x 16, facing left, two frames. (The ones
// that walk as people do are dressed in islebossart.js's way instead.)
import { Px, hex, shade } from './pixel.js';
import { OUT } from './textures.js';

function beast(o, f) {
  const p = new Px(16, 16);
  o(p, f);
  return p.outline(OUT);
}

// A homunculus of quicksilver: a little running figure of liquid metal,
// its outline never quite still.
function homunculus(f, small) {
  return beast((p) => {
    const m = hex('#c8d0dc');
    const lo = shade(m, 0.7);
    const hi = hex('#ffffff');
    if (small) {
      p.ellipse(8, 12 - f, 3, 2 + f, m);
      p.set(7, 11 - f, hi);
      p.hline(6, 10, 14, lo);
      return;
    }
    p.ellipse(8, 11, 4, 4, m);
    p.ellipse(8, 5 - f, 3, 3, m);
    p.set(7, 4 - f, '#1a2030');
    p.set(9, 4 - f, '#1a2030');
    p.set(6, 3 - f, hi);
    p.line(4, 9, 2, 12 + f, m);
    p.line(12, 9, 14, 12 - f, m);
    p.hline(5, 11, 15, lo);
    p.set(10, 9, hi);
    p.set(6, 13, hi);
  }, f);
}
// An alembic golem: a glass belly with something green sloshing in it,
// copper limbs and a still's crooked neck for a head.
function alembic(f) {
  return beast((p) => {
    const cu = hex('#c87a3a');
    p.ellipse(8, 9, 5, 4, hex('#a8e0f0'));
    p.ellipse(8, 10 + f, 4, 2, hex('#70d070'));
    p.set(6, 7, '#ffffff');
    p.rect(6, 3, 4, 2, cu);
    p.line(10, 3, 13, 1, cu);
    p.set(7, 4, '#ffd040');
    for (const [x, o] of [[5, f], [11, -f]]) p.rect(x - 1, 13, 2, 3 + o, shade(cu, 0.8));
    p.line(3, 8, 1, 11 + f, cu);
    p.line(13, 8, 15, 11 - f, cu);
  }, f);
}
// A sulphur imp: small, yellow and smoking, with a lit tail.
function imp(f) {
  return beast((p) => {
    const y = hex('#e0c030');
    p.ellipse(8, 10, 3, 3, y);
    p.ellipse(7, 6 - f, 3, 2, y);
    p.set(5, 4 - f, shade(y, 0.6));
    p.set(9, 4 - f, shade(y, 0.6));
    p.set(6, 6 - f, '#ff3010');
    p.set(8, 6 - f, '#ff3010');
    p.line(11, 11, 14, 8 + f, shade(y, 0.75));
    p.set(14, 7 + f, '#ff8020');
    p.set(15, 6 + f, '#ffe060');
    p.vline(6, 13, 15, shade(y, 0.7));
    p.vline(9, 13, 15 - f, shade(y, 0.7));
  }, f);
}
// A banner wraith: a grey shape that's mostly cloak, a tattered banner
// on a pole held high.
function bannerWraith(f) {
  return beast((p) => {
    const g = hex('#9aa0b0');
    p.ellipse(8, 9, 3, 4, g);
    for (let x = 5; x <= 11; x++) p.set(x, 13 + ((x + f) % 2), shade(g, 0.8));
    p.ellipse(8, 5, 2, 2, g);
    p.set(7, 5, '#ffe8a0');
    p.set(9, 5, '#ffe8a0');
    p.vline(12, 0, 12, '#5a4030');
    p.rect(13, 1, 3, 5, hex('#8a2a2a'));
    p.set(15, 6 + f, hex('#8a2a2a'));
    p.set(14, 3, '#e0c060');
  }, f);
}
// A void stalker: lean, low and shadow-black, violet eyes, its edges
// coming apart into the dark.
function stalker(f) {
  return beast((p) => {
    const k = hex('#1e1630');
    p.ellipse(9, 9, 6, 3, k);
    p.ellipse(3, 8, 3, 2, k);
    p.set(2, 7, '#c8a0ff');
    p.set(4, 7, '#c8a0ff');
    for (const [x, o] of [[5, f], [8, -f], [11, f], [13, -f]]) p.vline(x + o, 11, 14, k);
    p.line(15, 8, 15, 5 + f, k);
    p.set(12, 6, '#5ad8f0');
    p.set(7, 12, '#5ad8f0');
  }, f);
}
// A shard mote: a floating splinter of the rift, turning.
function shard(f) {
  return beast((p) => {
    const c = hex(f ? '#c8a0ff' : '#a0e8ff');
    p.line(8, 2, 5, 9, c);
    p.line(8, 2, 11, 9, c);
    p.line(5, 9, 8, 13, c);
    p.line(11, 9, 8, 13, c);
    p.vline(8, 3, 12, '#ffffff');
    p.set(6, 7, '#5ad8f0');
    p.set(10, 6, '#ffffff');
  }, f);
}
// A gut leech: a fat ringed slug of a thing, its round mouth all teeth.
function leech(f) {
  return beast((p) => {
    const r = hex('#7a3a3a');
    p.ellipse(9, 11, 6, 3 - f, r);
    for (let x = 5; x <= 13; x += 2) p.vline(x, 9, 13, shade(r, 0.8));
    p.ellipse(3, 10, 2, 2, shade(r, 1.15));
    p.set(2, 10, '#e8e0cc');
    p.set(3, 9, '#e8e0cc');
    p.set(3, 11, '#1a0a0a');
  }, f);
}
// An acid spitter: a squat, many-legged thing with a swollen green sac.
function spitter(f) {
  return beast((p) => {
    const b = hex('#5a5a2a');
    p.ellipse(9, 10, 4, 3, b);
    p.ellipse(11, 7, 3, 3, hex('#90d040'));
    p.set(12, 6, '#e0ff90');
    p.ellipse(4, 10, 2, 2, b);
    p.set(3, 9, '#ff4020');
    for (const [x, o] of [[6, f], [8, -f], [10, f], [12, -f]]) p.line(x, 12, x - 1 + o, 15, shade(b, 0.8));
  }, f);
}
// A maw larva: a pale grub with a mouth too big for it.
function larva(f) {
  return beast((p) => {
    const w = hex('#e0d8b8');
    p.ellipse(9, 12, 5, 2, w);
    for (let x = 6; x <= 13; x += 2) p.set(x, 11, shade(w, 0.8));
    p.ellipse(4, 11 - f, 2, 2, w);
    p.set(3, 11 - f, '#5a1010');
    p.set(2, 12 - f, '#5a1010');
  }, f);
}

export const ANCIENT_CREATURES = {
  quicksilver_homunculus: { frames: 2, draw: (f) => homunculus(f, false) },
  quicksilver_bead: { frames: 2, draw: (f) => homunculus(f, true) },
  alembic_golem: { frames: 2, draw: (f) => alembic(f) },
  sulphur_imp: { frames: 2, draw: (f) => imp(f) },
  banner_wraith: { frames: 2, draw: (f) => bannerWraith(f) },
  void_stalker: { frames: 2, draw: (f) => stalker(f) },
  shard_mote: { frames: 2, draw: (f) => shard(f) },
  gut_leech: { frames: 2, draw: (f) => leech(f) },
  acid_spitter: { frames: 2, draw: (f) => spitter(f) },
  maw_larva: { frames: 2, draw: (f) => larva(f) },
};
