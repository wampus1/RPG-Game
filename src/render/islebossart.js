// The islands' own masters and what comes with them, drawn (see the
// bosses_ files): the great ones forty pixels square (half as big again
// on screen, as every master is: see bossart.js), side on and facing
// left, a few frames of breath; the little ones sixteen. And how the ones
// shaped like people are dressed (see sprites.js, which draws people).
import { Px, hex, shade } from './pixel.js';

const OUT = '#1a1420';

// --------------------------------------------------------------- people
export const ISLE_LOOKS = {
  // Below ground: the peat-kept dead of Myrrow, Kharos's ash-raiders,
  // Myrrow's pearl pirates.
  bog_body: { skin: '#6a5038', hair: '#3a2a1a', hairStyle: 'long', shirt: '#4a3a28', pants: '#3a2e20', shoes: '#2a2018', outfit: 'rags', accent: '#5a4a30', hat: null, eyes: '#e0c870', stoop: true },
  ash_raider: { skin: '#8a5a3a', hair: '#1a1410', hairStyle: 'short', shirt: '#4a3a34', pants: '#2e2826', shoes: '#1a1614', outfit: 'ashwrap', accent: '#c8502a', hat: 'ashhood', hatColor: '#5a4e48', acc: 'goggles', mark: 'stripes' },
  ash_archer: { skin: '#8a5a3a', hair: '#2a1e14', hairStyle: 'ponytail', shirt: '#5a4a40', pants: '#2e2826', shoes: '#1a1614', outfit: 'ashwrap', accent: '#c8502a', hat: 'scarf', hatColor: '#8a3a20' },
  reef_raider: { skin: '#b07850', hair: '#1a1410', hairStyle: 'long', shirt: '#2a4a5a', pants: '#3a3226', shoes: '#2a2018', outfit: 'tidewrap', accent: '#e0c870', hat: 'bandana', hatColor: '#a02828', beard: true, beardStyle: 'stubble', neck: '#f0e8dc' },
  reef_archer: { skin: '#a06a44', hair: '#2a1e14', hairStyle: 'curly', shirt: '#3a5a6a', pants: '#3a3226', shoes: '#2a2018', outfit: 'tidewrap', accent: '#e0c870', hat: 'tricorn', hatColor: '#2a2420' },
  // Kharos's masters.
  cinder_king: { skin: '#3a3030', hair: '#ff8030', hairStyle: 'long', shirt: '#2a2020', pants: '#1e1818', shoes: '#141010', outfit: 'robe_ember', accent: '#ffb040', hat: 'circlet', hatColor: '#ff9030', eyes: '#ff8030', gear: { body: 'plate:#4a3a34', legs: 'plate:#3a2e2a' } },
  smoke_herald: { skin: '#8a8484', hair: '#5a5454', hairStyle: 'bald', shirt: '#5a5454', pants: '#3a3636', shoes: '#2a2626', outfit: 'robe_ash', accent: '#ff6030', hat: 'ashhood', hatColor: '#4a4444', eyes: '#ff9050' },
  obsidian_abbess: { skin: '#c8c0d0', hair: '#140e1a', hairStyle: 'long', shirt: '#1e1824', pants: '#140e1a', shoes: '#0e0a12', outfit: 'robe_obsidian', accent: '#c8b8f0', hat: 'hood', hatColor: '#1e1824', eyes: '#c8b8f0' },
  kiln_priest: { skin: '#a87a58', hair: '#e8e0d0', hairStyle: 'bald', shirt: '#8a3a1a', pants: '#5a2a14', shoes: '#2a1810', outfit: 'robe_kiln', accent: '#ffd060', hat: 'conehat', hatColor: '#c86a2a', eyes: '#ffd060', beard: true, beardStyle: 'long' },
  ash_reaver: { skin: '#7a4a30', hair: '#0e0a08', hairStyle: 'short', shirt: '#3a2a24', pants: '#2a201c', shoes: '#141010', outfit: 'ashwrap', accent: '#ff6030', hat: 'ashhelm', hatColor: '#5a4e48', mark: 'stripes', beard: true, beardStyle: 'full', gear: { body: 'chain:#4a4440' } },
  bombard_queen: { skin: '#b07850', hair: '#c83a1a', hairStyle: 'ponytail', shirt: '#5a3a2a', pants: '#3a2a20', shoes: '#2a1a12', outfit: 'smith', accent: '#ffb040', hat: 'bandana', hatColor: '#ffb040', acc: 'goggles', gloves: '#2a2420', neck: '#c8a030' },
  kiln_king: { skin: '#6a4030', hair: '#ff9030', hairStyle: 'short', shirt: '#3a2a20', pants: '#2a1e18', shoes: '#1a1210', outfit: 'smith', accent: '#ffd060', hat: 'circlet', hatColor: '#ffd060', eyes: '#ffb040', beard: true, beardStyle: 'full', gloves: '#2a2020', gear: { body: 'plate:#5a4a40', legs: 'plate:#4a3a30' } },
  // Myrrow's masters.
  bog_king: { skin: '#5a4430', hair: '#2a1e12', hairStyle: 'long', shirt: '#3a2e20', pants: '#2e2418', shoes: '#1e1810', outfit: 'rags', accent: '#c8a030', hat: 'circlet', hatColor: '#a8882a', eyes: '#e0c870', stoop: true, gear: { body: 'chain:#5a5040' } },
  willow_wight: { skin: '#9aa88a', hair: '#5a7a4a', hairStyle: 'long', shirt: '#3a4a30', pants: '#2a3a22', shoes: '#1a2414', outfit: 'robe_willow', accent: '#a0d090', hat: 'wreath', hatColor: '#5a8a3a', eyes: '#c8f0a0' },
  lantern_lord: { skin: '#a8b8b0', hair: '#d0e0dc', hairStyle: 'long', shirt: '#2a3a3a', pants: '#1e2a2a', shoes: '#141e1e', outfit: 'robe_mist', accent: '#80e8d0', hat: 'mushcap', hatColor: '#3a5a5a', eyes: '#80e8d0' },
  hollow_king: { skin: '#2a2a32', hair: '#a0b8c8', hairStyle: 'bald', shirt: '#4a5058', pants: '#3a4048', shoes: '#2a3038', outfit: 'plain', accent: '#a0b8c8', hat: 'helmet', hatColor: '#5a6068', eyes: '#e0f0ff', visor: true, gear: { body: 'plate:#5a6068', legs: 'plate:#4a5058', feet: 'plate:#4a5058' } },
  fog_knight: { skin: '#a0b0b8', hair: '#c8d8e0', hairStyle: 'bald', shirt: '#7a8a90', pants: '#6a7a80', shoes: '#5a6a70', outfit: 'plain', accent: '#c8d8e0', hat: 'helmet', hatColor: '#8a9aa0', eyes: '#ffffff', visor: true, gear: { body: 'plate:#8a9aa0', legs: 'plate:#7a8a90' } },
  sharktooth: { skin: '#8a5a38', hair: '#1a1410', hairStyle: 'long', shirt: '#1e3a4a', pants: '#3a3020', shoes: '#2a2014', outfit: 'tidewrap', accent: '#f0e8dc', hat: 'tricorn', hatColor: '#1e1a18', beard: true, beardStyle: 'full', neck: '#f0e8dc', mark: 'stripes' },
  pearl_queen: { skin: '#a06a44', hair: '#1a1410', hairStyle: 'long', shirt: '#e8e0d4', pants: '#3a6a7a', shoes: '#2a3a40', outfit: 'robe_pearl', accent: '#80c8e8', hat: 'shellhelm', hatColor: '#f0e8dc', neck: '#f0e8dc', eyes: '#80c8e8' },
  // Thessa's.
  thorn_queen: { skin: '#a8c890', hair: '#3a5a2a', hairStyle: 'long', shirt: '#2a4a2a', pants: '#1e3a1e', shoes: '#142a14', outfit: 'robe_thorn', accent: '#e05070', hat: 'wreath', hatColor: '#e05070', eyes: '#e05070' },
};
// (Their robes' colours, for sprites.js.)
export const ISLE_ROBES = {
  robe_ember: { robe: '#2a2020', trim: '#ff8030' },
  robe_ash: { robe: '#5a5454', trim: '#ff6030' },
  robe_obsidian: { robe: '#1e1824', trim: '#c8b8f0' },
  robe_kiln: { robe: '#8a3a1a', trim: '#ffd060' },
  robe_willow: { robe: '#3a4a30', trim: '#a0d090' },
  robe_mist: { robe: '#2a3a3a', trim: '#80e8d0' },
  robe_pearl: { robe: '#e8e0d4', trim: '#80c8e8' },
  robe_thorn: { robe: '#2a4a2a', trim: '#e05070' },
};

// --------------------------------------------------------------- helpers
// A round mass, lit from the upper left.
function orb(p, cx, cy, rx, ry, col, hi = 1.25, lo = 0.7) {
  const c = hex(col);
  p.ellipse(cx, cy, rx, ry, shade(c, lo));
  p.ellipse(cx - rx * 0.1, cy - ry * 0.1, rx * 0.86, ry * 0.86, c);
  p.ellipse(cx - rx * 0.35, cy - ry * 0.38, rx * 0.36, ry * 0.3, shade(c, hi));
}
// A thick stroke.
function stroke(p, x0, y0, x1, y1, w, col) {
  for (let k = -Math.floor(w / 2); k <= Math.floor((w - 1) / 2); k++) {
    p.line(x0 + k, y0, x1 + k, y1, col);
    p.line(x0, y0 + k, x1, y1 + k, col);
  }
}
// Glowing cracks running over a body.
function cracks(p, pts, col, hot = '#ffe070') {
  for (let i = 0; i + 1 < pts.length; i++) p.line(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], col);
  for (const [x, y] of pts) p.set(x, y, hot);
}
const eye = (p, x, y, col, big = false) => {
  p.set(x, y, col);
  if (big) {
    p.set(x + 1, y, col);
    p.set(x, y + 1, shade(hex(col), 0.7));
  }
};

// --------------------------------------------------------------- Kharos
// A great burial urn, painted in bands, cracked and glowing; ash arms out
// of its sides, a face painted on its belly, ash smoking from its mouth.
function urnMother(f) {
  const p = new Px(40, 40);
  const clay = '#8a6a4a';
  // Ash arms, reaching.
  const sw = f % 2;
  stroke(p, 10, 20, 3, 14 - sw, 2, '#6a6262');
  stroke(p, 3, 14 - sw, 2, 22, 2, '#5a5454');
  for (const [x, y] of [[1, 23], [2, 24], [3, 23]]) p.set(x, y, '#8a8484');
  stroke(p, 30, 20, 37, 15 + sw, 2, '#6a6262');
  stroke(p, 37, 15 + sw, 38, 23, 2, '#5a5454');
  // The body, the neck, the rim.
  orb(p, 20, 25, 12, 12, clay);
  p.rect(14, 9, 12, 6, shade(hex(clay), 0.85));
  p.ellipse(20, 9, 8, 2.5, shade(hex(clay), 1.15));
  p.ellipse(20, 9, 6, 1.5, '#1a1210');
  // Bands: a black meander between red.
  p.hline(9, 31, 18, '#8a2a1a');
  for (let x = 10; x <= 30; x += 3) {
    p.set(x, 19, '#1a1210');
    p.set(x + 1, 20, '#1a1210');
    p.set(x, 21, '#1a1210');
  }
  p.hline(9, 31, 22, '#8a2a1a');
  p.hline(10, 30, 32, '#5a2a1a');
  // The painted face: hollow eyes, glowing.
  const eyeC = f % 2 ? '#ffb040' : '#ff7020';
  p.rect(14, 24, 3, 3, '#1a1210');
  p.rect(23, 24, 3, 3, '#1a1210');
  p.set(15, 25, eyeC);
  p.set(24, 25, eyeC);
  p.hline(16, 24, 29, '#1a1210');
  // Cracks, glowing.
  cracks(p, [[27, 12], [29, 17], [27, 23], [30, 28]], '#ff6020');
  cracks(p, [[11, 27], [13, 31], [11, 34]], '#ff6020');
  // Ash smoking up out of it.
  for (let i = 0; i < 6; i++) p.set(18 + ((i * 3 + f) % 5), 7 - i, i % 2 ? '#a8a2a0' : '#8a8484', 200 - i * 25);
  return p.outline(OUT);
}

// A serpent of black glass coming up out of the floor: faceted coils,
// spines of glass along its back, red eyes, a maw ringed in glass teeth.
function glassWyrm(f) {
  const p = new Px(40, 40);
  const g = hex('#2e2638');
  const sw = f % 2;
  // Coils, from the floor at the right up to the head at the upper left.
  const path = [[34, 37], [33, 31], [30, 26], [25, 23], [21, 22], [18, 19], [15, 15], [12, 11]];
  path.forEach(([x, y], i) => {
    const r = 5 - i * 0.35;
    p.ellipse(x + (i % 2 ? sw : -sw) * 0.5, y, r, r * 0.9, i % 2 ? g : shade(g, 1.2));
    p.set(x - 1, y - Math.round(r) + 1, '#8a7aaa');
    // Spines.
    p.line(x, y - Math.round(r), x + 2, y - Math.round(r) - 3, '#6a5a8a');
    p.set(x + 2, y - Math.round(r) - 3, '#c8b8f0');
  });
  // Facets glinting.
  for (const [x, y] of [[31, 29], [26, 24], [19, 20]]) p.set(x, y, '#c8b8f0');
  // The head.
  p.ellipse(9, 10, 6, 4.5, shade(g, 1.15));
  p.ellipse(8, 8, 3.5, 1.5, '#4a3e5a');
  eye(p, 7, 8, '#ff3030', true);
  // The maw: open, glass teeth round it.
  p.ellipse(4, 12, 3, 2.5, '#0e0812');
  for (const [x, y] of [[2, 10], [4, 10], [6, 11], [2, 14], [4, 14]]) p.set(x, y, '#e0d8ff');
  // Horns of glass.
  p.line(11, 6, 15, 1, '#6a5a8a');
  p.line(9, 6, 11, 1, '#8a7aaa');
  p.set(15, 1, '#e0d8ff');
  // Where it comes up through the floor.
  p.ellipse(34, 38, 6, 1.6, '#1a1210');
  for (const [x, y] of [[29, 37], [38, 37], [31, 36]]) p.set(x, y, '#5a5050');
  return p.outline(OUT);
}

// A bloated slug-mother of magma: a long crusted body split with glowing
// cracks, vents on her back smoking, eyestalks, a slick of fire under her.
function magmaTender(f) {
  const p = new Px(40, 40);
  const crust = '#3a2e2c';
  const br = f % 2;
  p.ellipse(21, 35, 18, 3.5, '#ff6020', 160);
  orb(p, 22, 27 - br, 17, 9 + br, crust, 1.3, 0.75);
  // Cracks across her, glowing.
  cracks(p, [[9, 26], [14, 23], [19, 27], [24, 22], [30, 26], [35, 24]], '#ff6020');
  cracks(p, [[12, 31], [18, 30], [26, 32], [33, 30]], '#ff8030', '#ffd060');
  // Vents on her back, glowing and smoking.
  for (const x of [16, 24, 31]) {
    p.ellipse(x, 19 - br, 2, 1.5, '#5a3a2a');
    p.set(x, 19 - br, '#ffd060');
    p.set(x + (f % 3) - 1, 16 - br, '#8a8484', 180);
    p.set(x, 14 - br, '#a8a2a0', 120);
  }
  // Her head and eyestalks.
  p.ellipse(7, 27, 5, 4, shade(hex(crust), 1.2));
  stroke(p, 6, 24, 3, 17 - br, 1, '#4a3a36');
  stroke(p, 9, 24, 9, 16 + br, 1, '#4a3a36');
  p.ellipse(3, 16 - br, 1.5, 1.5, '#ffd060');
  p.ellipse(9, 15 + br, 1.5, 1.5, '#ffd060');
  p.set(3, 16 - br, '#1a1210');
  p.set(9, 15 + br, '#1a1210');
  p.hline(3, 7, 29, '#ff6020');
  return p.outline(OUT);
}

// An engine of iron: a furnace in its belly behind a grate, a leather
// bellows for a chest, chimneys on its shoulders smoking, fists like
// anvils.
function bellowsGolem(f) {
  const p = new Px(40, 40);
  const iron = hex('#4a4a52');
  const dk = shade(iron, 0.65);
  const sw = f % 2;
  // Legs.
  p.rect(13, 31, 5, 8, dk);
  p.rect(23, 31, 5, 8, dk);
  p.rect(12, 37, 7, 2, shade(iron, 0.5));
  p.rect(22, 37, 7, 2, shade(iron, 0.5));
  // The body.
  p.rect(10, 13, 21, 19, iron);
  p.rect(10, 13, 21, 2, shade(iron, 1.3));
  for (const [x, y] of [[11, 16], [29, 16], [11, 29], [29, 29]]) p.set(x, y, '#8a8a92');
  // The bellows: folds of leather, drawn in and out.
  for (let k = 0; k < 4; k++) p.rect(13 + (sw ? 0 : 1), 16 + k * 2, 15 - (sw ? 0 : 2), 1, k % 2 ? '#6a4a2e' : '#8a6038');
  // The furnace grate, glowing.
  p.rect(14, 24, 13, 6, '#2a1a14');
  for (let x = 15; x < 26; x += 2) p.vline(x, 25, 28, f % 2 ? '#ff9030' : '#ffb040');
  p.hline(14, 26, 24, '#6a6a72');
  // Chimneys, smoking.
  p.rect(10, 6, 3, 8, dk);
  p.rect(28, 8, 3, 6, dk);
  p.set(11, 4 - sw, '#8a8484', 200);
  p.set(12, 2, '#a8a2a0', 140);
  p.set(29, 6 - sw, '#8a8484', 200);
  // The head, small, set low: one glowing slot.
  p.rect(16, 9, 9, 5, shade(iron, 1.1));
  p.hline(17, 23, 11, '#ffb040');
  // Arms and anvil fists.
  stroke(p, 9, 15, 4, 25 + sw, 3, dk);
  p.rect(1, 25 + sw, 7, 5, shade(iron, 0.8));
  p.hline(1, 7, 25 + sw, '#8a8a92');
  stroke(p, 31, 15, 35, 25 - sw, 3, dk);
  p.rect(33, 25 - sw, 6, 5, shade(iron, 0.8));
  return p.outline(OUT);
}

// The dead the mountain melted together: a heap of black and blue glass
// with bones and skulls fused in it, shards bristling out of it.
function vitrifiedHorror(f) {
  const p = new Px(40, 40);
  const glass = '#3a4a6a';
  const br = f % 2;
  orb(p, 20, 26 - br, 17, 12, glass, 1.4, 0.6);
  // Bones caught in it.
  for (const [x0, y0, x1, y1] of [[8, 24, 15, 21], [22, 30, 30, 27], [12, 31, 18, 33], [26, 19, 33, 22]]) p.line(x0, y0 - br, x1, y1 - br, '#d8d0b8');
  // Skulls, their sockets lit.
  for (const [x, y, k] of [[11, 18, 0], [25, 22, 1], [17, 28, 2]]) {
    p.rect(x, y - br, 4, 3, '#e8e0c8');
    p.set(x + 1, y + 1 - br, (f + k) % 3 ? '#80c8ff' : '#ffffff');
    p.set(x + 3, y + 1 - br, (f + k) % 3 ? '#80c8ff' : '#ffffff');
    p.hline(x + 1, x + 2, y + 3 - br, '#c8c0a8');
  }
  // Shards bristling.
  for (const [x, y, dx, dy] of [[6, 18, -4, -6], [14, 14, -1, -8], [24, 14, 2, -9], [33, 18, 5, -6], [36, 26, 4, -2], [4, 28, -4, -1]]) {
    p.line(x, y - br, x + dx, y + dy - br, '#6a8ab8');
    p.set(x + dx, y + dy - br, '#e0f0ff');
  }
  // Highlights.
  for (const [x, y] of [[9, 22], [17, 18], [29, 24]]) p.set(x, y - br, '#c8e0ff');
  return p.outline(OUT);
}

// A drake on a chain: horned head, a throat glowing with the fire in it,
// wings folded high, a collar and a length of chain.
function chainedDrake(f) {
  const p = new Px(40, 40);
  const hide = hex('#7a2a1a');
  const belly = '#c8803a';
  const sw = f % 2;
  // Tail.
  stroke(p, 30, 28, 38, 24 - sw, 3, shade(hide, 0.8));
  p.set(39, 23 - sw, '#ffb040');
  // Legs.
  for (const [x, o] of [[13, 0], [17, 1], [26, 0], [30, 1]]) p.rect(x, 30 + (o ^ sw), 3, 8 - (o ^ sw), shade(hide, 0.7));
  // Body.
  orb(p, 22, 26, 11, 7, '#7a2a1a', 1.3, 0.7);
  p.ellipse(21, 30, 8, 2.5, belly);
  // Wings folded up.
  p.line(18, 20, 26, 5 - sw, shade(hide, 0.9));
  p.line(26, 5 - sw, 34, 14, shade(hide, 0.9));
  for (let k = 0; k < 4; k++) p.line(26, 5 - sw, 20 + k * 4, 19, shade(hide, 0.6 + k * 0.08));
  p.line(26, 5 - sw, 35, 15, '#2a0e08');
  // Neck and head.
  stroke(p, 13, 23, 7, 16, 4, hide);
  p.ellipse(5, 14, 5, 3.5, shade(hide, 1.15));
  p.rect(0, 14, 4, 3, shade(hide, 1.05));
  // The throat glowing; the jaw open.
  p.line(9, 21, 11, 24, f % 2 ? '#ffd060' : '#ff9030');
  p.hline(0, 3, 17, '#ff9030');
  p.set(0, 16, '#ffe070');
  eye(p, 5, 13, '#ffe070');
  // Horns.
  p.line(7, 11, 11, 6, '#e8d8b0');
  p.line(5, 11, 7, 6, '#c8b890');
  // Collar and chain.
  p.rect(11, 20, 3, 5, '#6a6a72');
  for (let k = 0; k < 5; k++) p.rect(10 - k * 2, 26 + k * 2, 2, 2, k % 2 ? '#8a8a92' : '#5a5a62');
  return p.outline(OUT);
}

// A giant of slag: a hunched blocky body cracked with fire, a molten core
// in its chest, its head sunk between its shoulders, arms like slag-heaps.
function slagTitan(f) {
  const p = new Px(40, 40);
  const slag = hex('#4a3e3a');
  const br = f % 2;
  // Legs.
  p.rect(12, 30, 6, 9, shade(slag, 0.7));
  p.rect(23, 30, 6, 9, shade(slag, 0.7));
  // Body.
  p.rect(9, 12 - br, 23, 20, slag);
  for (const [x, y, w, h] of [[9, 12, 6, 5], [24, 14, 8, 6], [11, 24, 7, 6]]) p.rect(x, y - br, w, h, shade(slag, 1.18));
  // Its core.
  p.ellipse(20, 21 - br, 4, 4, '#2a0e08');
  p.ellipse(20, 21 - br, 3 - (f % 2 ? 0 : 1), 3 - (f % 2 ? 0 : 1), '#ff7020');
  p.set(19, 20 - br, '#ffe070');
  cracks(p, [[11, 15], [15, 19], [16, 25]], '#ff6020');
  cracks(p, [[29, 16], [26, 22], [28, 28]], '#ff6020');
  // Head, sunk low.
  p.rect(15, 8 - br, 10, 6, shade(slag, 1.1));
  p.hline(16, 18, 10 - br, '#ffb040');
  p.hline(21, 23, 10 - br, '#ffb040');
  // Arms of heaped slag, knuckles dragging.
  p.rect(3, 13 - br, 6, 17, shade(slag, 0.9));
  p.rect(1, 28, 8, 6, shade(slag, 0.8));
  p.rect(32, 13 - br, 6, 17, shade(slag, 0.9));
  p.rect(32, 28, 8, 6, shade(slag, 0.8));
  cracks(p, [[4, 18], [6, 24], [3, 30]], '#ff6020');
  cracks(p, [[35, 17], [34, 25], [37, 31]], '#ff6020');
  return p.outline(OUT);
}

// A heart of magma held up in the air: a crusted sphere split with
// pulsing veins, chains hanging off it, lava dripping (four frames: its
// beat).
function moltenHeart(f) {
  const p = new Px(40, 40);
  const beat = [0, 1, 2, 1][f % 4];
  p.ellipse(20, 18, 13 + beat * 0.4, 13 + beat * 0.4, '#ff6020', 60);
  orb(p, 20, 18, 11 + beat * 0.3, 11 + beat * 0.3, '#3a2420', 1.3, 0.7);
  // Veins, brighter on the beat.
  const vein = beat === 2 ? '#ffe070' : beat === 1 ? '#ffb040' : '#ff7020';
  cracks(p, [[11, 14], [15, 17], [20, 15], [25, 19], [29, 16]], vein);
  cracks(p, [[13, 23], [18, 21], [23, 25], [28, 22]], vein);
  cracks(p, [[20, 8], [19, 12], [21, 15]], vein);
  // Chains off it.
  for (const [x0, y0, x1, y1] of [[10, 22, 3, 36], [30, 22, 37, 36], [16, 28, 13, 39], [24, 28, 27, 39]]) {
    const n = 6;
    for (let k = 0; k <= n; k++) p.set(Math.round(x0 + ((x1 - x0) * k) / n), Math.round(y0 + ((y1 - y0) * k) / n), k % 2 ? '#8a8a92' : '#5a5a62');
  }
  // Lava dripping.
  p.set(20, 30 + (f % 4), '#ff9030');
  p.set(17, 29 + ((f + 2) % 4), '#ff7020');
  return p.outline(OUT);
}

// --------------------------------------------------------------- Myrrow
// A moth the size of a cart, her wings spread wide, eye-spots on them,
// feathered feelers, glowing eyes (wings beating across her frames).
function mothMother(f) {
  const p = new Px(40, 40);
  const up = f % 2;
  const wing = hex('#8a6aa0');
  // Wings, up or down.
  const wy = up ? -6 : 2;
  p.ellipse(10, 16 + wy, 10, 8, wing);
  p.ellipse(30, 16 + wy, 10, 8, shade(wing, 0.9));
  p.ellipse(11, 27 - wy * 0.3, 7, 6, shade(wing, 0.8));
  p.ellipse(29, 27 - wy * 0.3, 7, 6, shade(wing, 0.75));
  // Eye-spots.
  for (const [x, y] of [[9, 15 + wy], [31, 15 + wy]]) {
    p.ellipse(x, y, 3, 3, '#f0e0ff');
    p.ellipse(x, y, 2, 2, '#2a1a3a');
    p.set(x, y, '#ffe070');
  }
  // Veins on the wings.
  for (const [x0, y0, x1, y1] of [[18, 18, 2, 12 + wy], [22, 18, 38, 12 + wy], [18, 22, 6, 30], [22, 22, 34, 30]]) p.line(x0, y0, x1, y1, shade(wing, 0.6));
  // Her body: furred, banded.
  p.ellipse(20, 22, 4, 9, '#c8b8a0');
  for (let y = 16; y < 31; y += 3) p.hline(17, 23, y, '#8a7a68');
  // Head and feelers.
  p.ellipse(20, 12, 3.5, 3, '#d8c8b0');
  eye(p, 18, 11, '#ffe070');
  eye(p, 21, 11, '#ffe070');
  for (const dx of [-1, 1]) {
    p.line(20 + dx, 10, 20 + dx * 6, 3, '#c8b8a0');
    for (let k = 1; k < 5; k++) p.set(20 + dx * (1 + k), 9 - k * 1.5, '#e8dcc8');
  }
  return p.outline(OUT);
}

// A colossus of fungus: a hulking body of pale flesh and gills, caps grown
// on its shoulders and head (one glowing), tendrils of mycelium for legs,
// spores drifting off it.
function sporeColossus(f) {
  const p = new Px(40, 40);
  const flesh = hex('#c8bca8');
  const br = f % 2;
  // Tendril legs.
  for (const x of [12, 16, 24, 28]) p.line(x, 30, x + (x < 20 ? -2 : 2), 39, '#a89a88');
  // The body.
  orb(p, 20, 24 - br, 12, 10, '#c8bca8', 1.15, 0.72);
  for (let x = 12; x <= 28; x += 2) p.vline(x, 26 - br, 31 - br, shade(flesh, 0.8));
  // Arms: thick stalks.
  stroke(p, 9, 20, 4, 31, 4, shade(flesh, 0.9));
  stroke(p, 31, 20, 36, 31, 4, shade(flesh, 0.85));
  // Caps: on its head (a great red one, spotted), its shoulders (one glowing blue).
  p.ellipse(20, 10 - br, 10, 5, '#b8402a');
  p.ellipse(20, 12 - br, 9, 2, '#f0e0d0');
  for (const [x, y] of [[15, 8], [21, 7], [25, 10], [18, 10]]) p.rect(x, y - br, 2, 1, '#f4e8d8');
  p.ellipse(8, 16, 5, 3, '#3a8ad0');
  p.ellipse(8, 17, 4, 1, '#7ad0ff');
  p.ellipse(33, 17, 4, 2.5, '#8a6aa0');
  // Its face, under the cap: hollows, glowing.
  eye(p, 16, 17 - br, '#c8f070', true);
  eye(p, 23, 17 - br, '#c8f070', true);
  p.hline(17, 23, 21 - br, '#5a4a3a');
  // Spores drifting off.
  for (let i = 0; i < 5; i++) p.set((i * 9 + f * 3) % 40, (i * 7 + f * 5) % 12, '#c8f070', 180);
  return p.outline(OUT);
}

// A lamprey grown huge: a long grey-green body coiled on itself, a round
// sucker of a mouth ringed with rows of teeth, gill slits, a pale belly.
function lampreyQueen(f) {
  const p = new Px(40, 40);
  const skin = hex('#5a6a6a');
  const sw = f % 2;
  // Coils.
  p.ellipse(25, 31, 13, 6, shade(skin, 0.8));
  p.ellipse(25, 30, 11, 4, skin);
  p.ellipse(25, 33, 9, 2, '#a8b0a0');
  // The body rising to the head.
  stroke(p, 30, 26, 22, 14, 7, skin);
  stroke(p, 22, 14, 13, 9 + sw, 7, shade(skin, 1.1));
  p.line(27, 26, 20, 15, '#a8b0a0');
  // Fins along its back.
  for (let k = 0; k < 5; k++) p.line(26 - k * 3, 13 - k * 0.5, 28 - k * 3, 9 - k * 0.5, '#8a9a98');
  // Gill slits.
  for (let k = 0; k < 4; k++) p.vline(17 + k * 2, 11 + sw, 13 + sw, '#2a3434');
  // The sucker-mouth, ringed with teeth.
  p.ellipse(7, 11 + sw, 6, 6, shade(skin, 1.2));
  p.ellipse(6, 11 + sw, 4.5, 4.5, '#5a1a20');
  p.ellipse(6, 11 + sw, 2, 2, '#1a0a0e');
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    p.set(6 + Math.cos(a) * 3.5, 11 + sw + Math.sin(a) * 3.5, '#f0e8d8');
  }
  eye(p, 12, 6 + sw, '#ff8090');
  return p.outline(OUT);
}

// A floating bladder of marsh gas, sickly green and see-through, veined,
// a gaping face on it, tendrils trailing, gas wisping off.
function gasBloat(f) {
  const p = new Px(40, 40);
  const sac = hex('#7a9a40');
  const sw = [0, 1, 2, 1][f % 4];
  p.ellipse(20, 16, 15 + sw * 0.4, 13 + sw * 0.3, sac, 200);
  p.ellipse(18, 13, 10, 8, shade(sac, 1.2), 200);
  p.ellipse(13, 8, 3, 2, '#e0ff90', 220);
  // Veins.
  for (const [x0, y0, x1, y1] of [[8, 14, 16, 20], [24, 6, 30, 16], [14, 24, 22, 26], [28, 20, 33, 24]]) p.line(x0, y0, x1, y1, shade(sac, 0.6));
  // The face: two glowing eyes, a gaping mouth.
  eye(p, 12, 15, '#e0ff90', true);
  eye(p, 21, 15, '#e0ff90', true);
  p.ellipse(16, 21, 4, 2.5 + sw * 0.4, '#1a2a0e');
  // Tendrils trailing.
  for (const x of [10, 15, 21, 27, 31]) {
    for (let y = 28; y < 38; y++) p.set(x + Math.round(Math.sin(y * 0.7 + f + x) * 1.2), y, shade(sac, 0.75));
  }
  // Gas wisping off.
  for (let i = 0; i < 4; i++) p.set(6 + i * 9, 2 + ((f + i) % 3), '#c8f090', 140);
  return p.outline(OUT);
}

// Three drowned singers, as one: robed and dripping, hair hanging wet,
// mouths open in their song, their eyes the pale light of deep water.
function drownedChoir(f) {
  const p = new Px(40, 40);
  const sway = [0, 1, 0, -1];
  const singer = (x, top, k, robe) => {
    const s = sway[(f + k) % 4];
    p.rect(x - 4 + s, top + 7, 9, 39 - top - 7, hex(robe));
    p.rect(x - 4 + s, top + 7, 9, 2, shade(hex(robe), 1.2));
    for (let y = top + 10; y < 39; y += 4) p.set(x - 3 + s + ((y + k) % 6), y, shade(hex(robe), 0.7));
    p.ellipse(x + s, top + 4, 3.5, 4, '#7aa098');
    // Wet hair, hanging.
    p.rect(x - 4 + s, top, 9, 3, '#2a3a32');
    p.vline(x - 4 + s, top + 2, top + 9, '#2a3a32');
    p.vline(x + 4 + s, top + 2, top + 9, '#2a3a32');
    eye(p, x - 1 + s, top + 3, '#c8fff0');
    eye(p, x + 2 + s, top + 3, '#c8fff0');
    // Singing.
    p.ellipse(x + s, top + 6, 1, 1 + (f % 2), '#0e1a18');
    // Drips.
    p.set(x - 2 + s, 39 - ((f * 3 + k * 5) % 8), '#80c8e0');
  };
  singer(29, 12, 2, '#2a4a5a');
  singer(10, 13, 1, '#3a4a58');
  singer(20, 7, 0, '#2a3a4a');
  return p.outline(OUT);
}

// The smugglers' kraken: its great head up out of its pool, one huge eye,
// arms curling up either side of it, suckers pale along them.
function smugglersKraken(f) {
  const p = new Px(40, 40);
  const skin = hex('#a04060');
  const sw = f % 2;
  // Water round it.
  p.ellipse(20, 36, 19, 3.5, '#2a6a8a');
  p.hline(3, 37, 34, '#80c8e8');
  // Arms curling up.
  for (const [x0, dir, k] of [[6, -1, 0], [12, -1, 1], [28, 1, 0], [34, 1, 1]]) {
    let x = x0;
    for (let y = 35; y > 14 + k * 4; y--) {
      x += dir * (Math.sin((y + sw * 3 + k) * 0.4) * 0.6);
      p.rect(Math.round(x) - 1, y, 3, 1, shade(skin, 0.85 + k * 0.1));
      if (y % 3 === 0) p.set(Math.round(x) - dir, y, '#f0c8d0');
    }
  }
  // The mantle.
  orb(p, 20, 18 - sw, 9, 12, '#a04060', 1.3, 0.7);
  for (const [x, y] of [[16, 10], [23, 13], [18, 21]]) p.set(x, y - sw, '#d870a0');
  // Its eye.
  p.ellipse(15, 22 - sw, 3.5, 3, '#f0e0a0');
  p.hline(13, 17, 22 - sw, '#1a0a0e');
  p.ellipse(15, 22 - sw, 1, 2, '#1a0a0e');
  return p.outline(OUT);
}

// The Tide-Mother: a sea turtle older than the island, her shell grown
// over with coral and barnacles, flippers, an ancient head, eyes lit
// like the deep.
function tideMother(f) {
  const p = new Px(40, 40);
  const shell = hex('#3a6a5a');
  const sw = f % 2;
  // Flippers.
  stroke(p, 10, 30, 3, 35 + sw, 3, '#6a8a7a');
  stroke(p, 30, 30, 37, 35 - sw, 3, '#5a7a6a');
  stroke(p, 12, 32, 9, 38, 2, '#5a7a6a');
  // The shell, domed, in plates.
  orb(p, 21, 25, 15, 10, '#3a6a5a', 1.25, 0.7);
  for (const [x, y] of [[15, 21], [21, 18], [27, 21], [18, 27], [25, 27]]) {
    p.ellipse(x, y, 3, 2, shade(shell, 1.15));
    p.set(x, y, shade(shell, 0.7));
  }
  p.hline(7, 35, 32, '#c8b890');
  // Coral and barnacles on it.
  for (const [x, y, c] of [[14, 15, '#ff8a8a'], [26, 14, '#f0b060'], [30, 19, '#ff8a8a']]) {
    p.vline(x, y - 3, y, c);
    p.set(x - 1, y - 2, c);
    p.set(x + 1, y - 3, c);
  }
  for (const [x, y] of [[18, 16], [23, 22], [11, 24]]) p.set(x, y, '#e8e0d0');
  // Her head.
  stroke(p, 9, 27, 4, 24 - sw, 4, '#6a8a7a');
  p.ellipse(3, 23 - sw, 4, 3, '#7a9a88');
  eye(p, 2, 22 - sw, '#80fff0');
  p.hline(0, 3, 25 - sw, '#3a4a40');
  return p.outline(OUT);
}

// The Abyssal Clam: a clam as wide as a hall's doorway, its shells
// scalloped and ridged; shut, or open on the glowing pearl inside (its
// variant: see bosses_myrrow.js).
function abyssalClam(f, v) {
  const p = new Px(40, 40);
  const sh = hex('#c8b8b0');
  const open = v === 1;
  const g = open ? 7 + (f % 2) : 0;
  // The lower shell.
  p.ellipse(20, 30, 18, 7, shade(sh, 0.85));
  for (let k = -3; k <= 3; k++) p.line(20 + k * 5, 37, 20 + k * 4, 26, shade(sh, 0.65));
  // Inside: its flesh, and the pearl.
  if (open) {
    p.ellipse(20, 26 - g / 2, 15, g / 2 + 1, '#d870a0');
    p.ellipse(20, 25 - g / 2, 4, 4, '#fff8f0');
    p.set(19, 23 - g / 2, '#ffffff');
    p.ellipse(20, 25 - g / 2, 5, 5, '#e0d0ff', 90);
  }
  // The upper shell, raised.
  p.ellipse(20, 23 - g, 18, 8, sh);
  p.ellipse(18, 20 - g, 10, 4, shade(sh, 1.15));
  for (let k = -3; k <= 3; k++) p.line(20 + k * 5, 15 - g, 20 + k * 4, 28 - g, shade(sh, 0.75));
  // The scalloped edge.
  for (let x = 3; x <= 37; x += 3) p.set(x, 29 - g + (x % 2), shade(sh, 0.6));
  // Barnacles and weed.
  for (const [x, y] of [[9, 19], [28, 17], [33, 22]]) p.set(x, y - g, '#8a8070');
  p.vline(36, 26, 33, '#3a6a3a');
  return p.outline(OUT);
}

// A reef that walks: a giant of coral rock, branching coral grown up off
// its head and shoulders (pink, orange, teal), barnacles, weed hanging.
function coralColossus(f) {
  const p = new Px(40, 40);
  const rock = hex('#8a7a78');
  const br = f % 2;
  // Legs.
  p.rect(13, 30, 5, 9, shade(rock, 0.7));
  p.rect(23, 30, 5, 9, shade(rock, 0.7));
  // The body.
  orb(p, 20, 22 - br, 12, 11, '#8a7a78', 1.2, 0.7);
  for (const [x, y] of [[13, 18], [25, 24], [17, 28], [27, 16]]) p.ellipse(x, y - br, 2, 1.5, '#e8e0d0');
  // Arms.
  stroke(p, 9, 18, 3, 30, 4, shade(rock, 0.85));
  stroke(p, 31, 18, 37, 30, 4, shade(rock, 0.8));
  // Coral branching off it.
  const branch = (x, y, c, h) => {
    p.vline(x, y - h, y, c);
    p.line(x, y - h + 2, x - 2, y - h - 1, c);
    p.line(x, y - h + 3, x + 2, y - h, c);
    p.set(x - 2, y - h - 1, shade(hex(c), 1.3));
    p.set(x + 2, y - h, shade(hex(c), 1.3));
  };
  branch(16, 12 - br, '#ff7a8a', 8);
  branch(22, 11 - br, '#f0a050', 9);
  branch(28, 14 - br, '#40c8b0', 7);
  branch(8, 17, '#ff7a8a', 5);
  branch(33, 17, '#f0a050', 5);
  // Its eyes, deep in the rock.
  eye(p, 15, 21 - br, '#80fff0');
  eye(p, 22, 21 - br, '#80fff0');
  // Weed hanging.
  for (const x of [11, 19, 29]) p.vline(x, 30 - br, 34 - br, '#3a7a4a');
  return p.outline(OUT);
}

// --------------------------------------------------------------- Thessa
// The Elder Stag: a stag as tall as a horse is long, antlers like a
// winter oak spread over him, leaves and moss hung on them, eyes of green
// light.
function elderStag(f) {
  const p = new Px(40, 40);
  const coat = hex('#8a6a42');
  const sw = f % 2;
  // Legs, long.
  for (const [x, o] of [[14, 0], [17, 1], [27, 0], [30, 1]]) {
    p.rect(x, 26 + (o ^ sw ? 1 : 0), 2, 13 - (o ^ sw ? 1 : 0), shade(coat, 0.7));
    p.set(x, 38, '#2a1e14');
  }
  // Body.
  orb(p, 23, 23, 11, 6, '#8a6a42', 1.2, 0.72);
  p.ellipse(22, 27, 7, 2, '#c8b090');
  // Moss on his back.
  for (const x of [17, 21, 25, 29]) p.set(x, 17, '#5a8a3a');
  // Neck and head.
  stroke(p, 14, 20, 9, 13, 4, coat);
  p.ellipse(7, 12, 4, 3, shade(coat, 1.1));
  p.rect(2, 12, 4, 3, shade(coat, 1.05));
  p.set(2, 13, '#1a1210');
  eye(p, 7, 11, '#a0ff70');
  // Antlers, spread wide over him.
  const tine = (x0, y0, x1, y1) => p.line(x0, y0, x1, y1, '#e8dcc0');
  tine(8, 9, 4, 1);
  tine(6, 5, 2, 4);
  tine(5, 3, 7, 0);
  tine(9, 9, 16, 2);
  tine(12, 6, 13, 1);
  tine(14, 4, 19, 1);
  tine(16, 2, 17, 0);
  // Leaves and moss hung on them.
  for (const [x, y] of [[4, 2], [13, 2], [18, 1], [3, 5]]) p.set(x, y + 1, '#5a8a3a');
  return p.outline(OUT);
}

// The Hollow Oak: an oak that walks on its roots, its trunk split by a
// hollow with a face in it (eyes of green fire), branches for arms, its
// crown in leaf.
function hollowOak(f) {
  const p = new Px(40, 40);
  const bark = hex('#5a4430');
  const sw = f % 2;
  // Roots for legs.
  for (const [x, dx] of [[13, -5], [17, -2], [23, 2], [27, 5]]) stroke(p, x, 30, x + dx, 39, 2, shade(bark, 0.8));
  // The trunk.
  p.rect(12, 14, 16, 18, bark);
  for (let x = 13; x < 28; x += 3) p.vline(x, 15, 31, shade(bark, 0.75));
  // The hollow: a face in it, lit within.
  p.ellipse(20, 22, 5, 6, '#140e08');
  eye(p, 18, 20, f % 2 ? '#c8f070' : '#a0e050', true);
  eye(p, 21, 20, f % 2 ? '#c8f070' : '#a0e050', true);
  p.hline(18, 22, 25, '#3a2a14');
  // Branch arms.
  stroke(p, 12, 17, 4, 12 + sw, 3, shade(bark, 0.9));
  stroke(p, 4, 12 + sw, 2, 22, 2, shade(bark, 0.85));
  stroke(p, 28, 17, 36, 11 - sw, 3, shade(bark, 0.9));
  stroke(p, 36, 11 - sw, 38, 20, 2, shade(bark, 0.85));
  // The crown, in leaf.
  for (const [x, y, r] of [[14, 9, 6], [24, 8, 7], [19, 4, 6], [8, 11 + sw, 3], [35, 9 - sw, 3]]) orb(p, x, y, r, r * 0.8, '#4a7a34', 1.25, 0.7);
  for (const [x, y] of [[13, 6], [22, 3], [27, 8]]) p.set(x, y, '#a0d070');
  return p.outline(OUT);
}

// --------------------------------------------------------------- the small
// A reef crab: coral-pink, its claws up.
function reefCrab(f) {
  const p = new Px(16, 16);
  const shell = hex('#d8705a');
  p.ellipse(8, 10, 5, 3, shell);
  p.hline(4, 12, 8, shade(shell, 1.3));
  for (const [x, y] of [[6, 9], [10, 9]]) p.set(x, y, '#f0d0a0');
  for (let k = 0; k < 3; k++) {
    p.set(4 + k * 2 + f, 13, shade(shell, 0.7));
    p.set(9 + k * 2 - f, 13, shade(shell, 0.7));
  }
  p.rect(1, 6 - f, 3, 2, shade(shell, 1.1));
  p.rect(12, 6 + f, 3, 2, shade(shell, 1.1));
  p.set(5, 6, '#1a1420');
  p.set(10, 6, '#1a1420');
  p.vline(5, 7, 7, shade(shell, 0.8));
  p.vline(10, 7, 7, shade(shell, 0.8));
  return p.outline(OUT);
}
// A forge hound: a dog of riveted iron, its belly a little furnace.
function forgeHound(f) {
  const p = new Px(16, 16);
  const iron = hex('#4a4a52');
  p.rect(4, 7, 9, 5, iron);
  p.hline(4, 12, 7, shade(iron, 1.3));
  p.rect(6, 10, 5, 2, f % 2 ? '#ff9030' : '#ffb040');
  for (const [x, o] of [[4, 0], [6, 1], [10, 0], [12, 1]]) p.vline(x, 12, 14 - (o ^ (f % 2)), shade(iron, 0.7));
  p.rect(1, 5, 4, 4, shade(iron, 1.1));
  p.set(1, 8, '#ff9030');
  p.set(2, 6, '#ffe070');
  p.line(13, 8, 15, 5 + (f % 2), shade(iron, 0.8));
  p.set(4, 4, shade(iron, 0.8));
  return p.outline(OUT);
}
// A thornling: a ball of briar on spindly legs, two little eyes in it.
function thornling(f) {
  const p = new Px(16, 16);
  p.ellipse(8, 8, 5, 4.5, '#3a5a2a');
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + f * 0.3;
    p.line(8 + Math.cos(a) * 4, 8 + Math.sin(a) * 4, 8 + Math.cos(a) * 6.5, 8 + Math.sin(a) * 6, i % 2 ? '#6a8a3a' : '#8a6a3a');
  }
  p.set(6, 7, '#ffe070');
  p.set(9, 7, '#ffe070');
  p.set(7, 9, '#e05070');
  for (const x of [5, 8, 11]) p.line(x, 12, x + (f % 2 ? 1 : -1), 15, '#5a4a2a');
  return p.outline(OUT);
}
// A glass shard, broken off the Horror: jagged, a light caught in it.
function glassShard(f) {
  const p = new Px(16, 16);
  const y = f % 2;
  for (const [x0, y0, x1, y1] of [[8, 2, 4, 12], [8, 2, 12, 11], [4, 12, 12, 11]]) p.line(x0, y0 + y, x1, y1 + y, '#6a8ab8');
  p.ellipse(8, 8 + y, 2.5, 3, '#3a4a6a');
  p.set(8, 7 + y, '#c8e0ff');
  p.set(7, 5 + y, '#e0f0ff');
  return p.outline(OUT);
}
// A chain anchor: an iron post driven into the floor, a ring on it, the
// chain going taut up from it.
function heartAnchor() {
  const p = new Px(16, 16);
  p.rect(6, 6, 4, 9, '#4a4a52');
  p.hline(6, 9, 6, '#8a8a92');
  p.rect(5, 13, 6, 2, '#2a2a30');
  p.ellipse(8, 4, 2.5, 2.5, '#8a8a92');
  p.ellipse(8, 4, 1.2, 1.2, '#1a1420');
  for (let k = 0; k < 3; k++) p.set(9 + k, 1 - k * 0.5, k % 2 ? '#8a8a92' : '#5a5a62');
  return p.outline(OUT);
}
// A false light: a glowing mote, pulsing (no outline: it's light).
function lureLight(f) {
  const p = new Px(16, 16);
  p.ellipse(8, 8, 5 + (f % 2), 5 + (f % 2), '#fff0a0', 70);
  p.ellipse(8, 8, 3, 3, '#fff8d0');
  p.ellipse(8, 8, 1.5, 1.5, '#ffffff');
  return p;
}
// A grave-lantern: a lantern hung from a crooked stake, a pale green-blue
// flame in it.
function graveLantern(f) {
  const p = new Px(16, 16);
  p.vline(7, 3, 15, '#4a3a2a');
  p.line(7, 3, 11, 3, '#4a3a2a');
  p.vline(11, 3, 5, '#5a5a62');
  p.rect(9, 5, 5, 6, '#2a3a3a');
  p.rect(10, 6, 3, 4, f % 2 ? '#80e8d0' : '#c8fff0');
  p.hline(9, 13, 11, '#5a5a62');
  return p.outline(OUT);
}
// A kraken's arm, up through the floor, curling.
function krakenArm(f) {
  const p = new Px(16, 16);
  let x = 8;
  for (let y = 15; y > 2; y--) {
    x += Math.sin(y * 0.6 + f) * 0.5;
    const w = y > 9 ? 3 : 2;
    p.rect(Math.round(x) - 1, y, w, 1, '#a04060');
    if (y % 3 === 0) p.set(Math.round(x) - 1, y, '#f0c8d0');
  }
  p.ellipse(8, 15, 4, 1, '#2a6a8a');
  return p.outline(OUT);
}
// A taproot: a thick root driven down into the floor, sap glowing in it.
function taproot(f) {
  const p = new Px(16, 16);
  p.rect(6, 3, 4, 12, '#5a4430');
  p.line(6, 5, 3, 2, '#5a4430');
  p.line(9, 4, 12, 1, '#5a4430');
  for (let y = 5; y < 14; y += 3) p.set(7 + (y % 2), y, f % 2 ? '#c8f070' : '#a0e050');
  p.set(3, 1, '#5a8a3a');
  p.set(12, 0, '#5a8a3a');
  p.hline(4, 11, 15, '#3a2a1a');
  return p.outline(OUT);
}

// --------------------------------------------------------------- registry
// (Merged into sprites.js's CREATURE_LOOKS; aliases share another's
// picture.)
export function isleBossArt(base) {
  return {
    urn_mother: { frames: 2, size: 40, draw: (f) => urnMother(f) },
    glass_wyrm: { frames: 2, size: 40, draw: (f) => glassWyrm(f) },
    magma_tender: { frames: 2, size: 40, draw: (f) => magmaTender(f) },
    bellows_golem: { frames: 2, size: 40, draw: (f) => bellowsGolem(f) },
    vitrified_horror: { frames: 2, size: 40, draw: (f) => vitrifiedHorror(f) },
    chained_drake: { frames: 2, size: 40, draw: (f) => chainedDrake(f) },
    slag_titan: { frames: 2, size: 40, draw: (f) => slagTitan(f) },
    molten_heart: { frames: 4, size: 40, draw: (f) => moltenHeart(f) },
    moth_mother: { frames: 2, size: 40, draw: (f) => mothMother(f) },
    spore_colossus: { frames: 2, size: 40, draw: (f) => sporeColossus(f) },
    lamprey_queen: { frames: 2, size: 40, draw: (f) => lampreyQueen(f) },
    gas_bloat: { frames: 4, size: 40, draw: (f) => gasBloat(f) },
    drowned_choir: { frames: 4, size: 40, draw: (f) => drownedChoir(f) },
    smugglers_kraken: { frames: 2, size: 40, draw: (f) => smugglersKraken(f) },
    tide_mother: { frames: 2, size: 40, draw: (f) => tideMother(f) },
    abyssal_clam: { frames: 2, size: 40, draw: (f, v) => abyssalClam(f, v) },
    coral_colossus: { frames: 2, size: 40, draw: (f) => coralColossus(f) },
    elder_stag: { frames: 2, size: 40, draw: (f) => elderStag(f) },
    hollow_oak: { frames: 2, size: 40, draw: (f) => hollowOak(f) },
    reef_crab: { frames: 2, draw: (f) => reefCrab(f) },
    forge_hound: { frames: 2, draw: (f) => forgeHound(f) },
    thornling: { frames: 2, draw: (f) => thornling(f) },
    glass_shard: { frames: 2, draw: (f) => glassShard(f) },
    heart_anchor: { frames: 1, draw: () => heartAnchor() },
    lure_light: { frames: 2, draw: (f) => lureLight(f) },
    grave_lantern: { frames: 2, draw: (f) => graveLantern(f) },
    kraken_arm: { frames: 2, draw: (f) => krakenArm(f) },
    taproot: { frames: 2, draw: (f) => taproot(f) },
    // (Others' pictures.)
    slag_crab: base.magma_crab,
    shroom_brute: base.shroom_crawler,
  };
}
