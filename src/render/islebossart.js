// What comes with the islands' masters, drawn (see the bosses_ files):
// the little ones, sixteen pixels square (the masters themselves are
// painted large: see bossbeasts.js and bossfigs.js). And how the ones
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
// A keg of black powder, rolling: staves and iron hoops turning over, its
// fuse fizzing.
function rollingKeg(f) {
  const p = new Px(16, 16);
  p.ellipse(8, 9, 6, 5.5, '#5a3a22');
  p.ellipse(7, 8, 4.5, 4, '#7a5232');
  p.ellipse(6, 7, 2, 1.5, '#9a6a42');
  // (The hoops, turned as it rolls.)
  const a = f * 0.9;
  for (const k of [-1, 1]) {
    const dx = Math.round(Math.cos(a) * 3.5 * k);
    p.vline(8 + dx, 5, 13, '#4a4a54');
    p.set(8 + dx, 5, '#8a8a94');
  }
  p.line(8, 4, 10 + f, 1, '#3a2a1a');
  p.set(10 + f, 1, f % 2 ? '#ffe070' : '#ff8030');
  p.set(11 + f, 0, '#ffffff');
  return p.outline(OUT);
}
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
    reef_crab: { frames: 2, draw: (f) => reefCrab(f) },
    forge_hound: { frames: 2, draw: (f) => forgeHound(f) },
    thornling: { frames: 2, draw: (f) => thornling(f) },
    glass_shard: { frames: 2, draw: (f) => glassShard(f) },
    heart_anchor: { frames: 1, draw: () => heartAnchor() },
    rolling_keg: { frames: 2, draw: (f) => rollingKeg(f) },
    lure_light: { frames: 2, draw: (f) => lureLight(f) },
    grave_lantern: { frames: 2, draw: (f) => graveLantern(f) },
    kraken_arm: { frames: 2, draw: (f) => krakenArm(f) },
    taproot: { frames: 2, draw: (f) => taproot(f) },
    // (Others' pictures.)
    slag_crab: base.magma_crab,
    shroom_brute: base.shroom_crawler,
  };
}
