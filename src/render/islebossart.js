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
  // (Round 68) The far lands' dead and outlaws, below ground: Velmarch's
  // legion shades in bronze and red, their faces gone to cold light;
  // Ostria's clay soldiers, their plates fired with the rest of them, and
  // its jade corpses in an official's robe, a charm hung over the face;
  // Corrow's drowned whalers, bones in oilskin; Saltmere's salt-white
  // dead; the Wyrd Isle's fey knights in silver, antlered; the Skerries'
  // wreckers in dark oilskins with their false lanterns.
  legion_shade: { skin: '#a8c0d8', hair: '#c8d8f0', hairStyle: 'bald', shirt: '#8a2a2a', pants: '#6a2020', shoes: '#4a3a24', outfit: 'tunic', accent: '#c83030', hat: 'galea', hatColor: '#b89040', eyes: '#e0f4ff', gear: { body: 'plate:#b89040', legs: 'plate:#9a7a38' } },
  terracotta: { skin: '#b8643a', hair: '#8a4a2a', hairStyle: 'bald', shirt: '#a85a34', pants: '#9a5030', shoes: '#7a3e24', outfit: 'tunic', accent: '#d8946a', hat: 'clayhelm', hatColor: '#8a4a2a', eyes: '#3a1a10', gear: { body: 'plate:#a85a34' } },
  terracotta_archer: { skin: '#b8643a', hair: '#8a4a2a', hairStyle: 'bald', shirt: '#9a5434', pants: '#8a4a2c', shoes: '#7a3e24', outfit: 'tunic', accent: '#d8946a', hat: 'clayhelm', hatColor: '#7a4024', eyes: '#3a1a10' },
  jade_corpse: { skin: '#a8c8b0', hair: '#1a2a20', hairStyle: 'ponytail', shirt: '#1e3a5a', pants: '#162a44', shoes: '#0e1a2a', outfit: 'robe_jade', accent: '#d8b040', hat: 'guanmao', hatColor: '#1e2a24', eyes: '#80ffa0', stoop: true },
  bone_whaler: { skin: '#e8e4d4', hair: '#e8e4d4', hairStyle: 'bald', shirt: '#2a3a3a', pants: '#24302e', shoes: '#1a2220', outfit: 'skeleton', accent: '#d8b030', hat: 'souwester', hatColor: '#c8a028' },
  salt_wight: { skin: '#f0ecf0', hair: '#ffffff', hairStyle: 'long', shirt: '#e8e0e4', pants: '#d8d0d8', shoes: '#c8c0c8', outfit: 'robe_salt', accent: '#e8a0b8', hat: 'hood', hatColor: '#e0d8e0', eyes: '#a0c8ff', stoop: true },
  fey_knight: { skin: '#e0e8f0', hair: '#c8e0d0', hairStyle: 'long', shirt: '#3a5a4a', pants: '#2a4a3a', shoes: '#1e3a2a', outfit: 'plain', accent: '#80ffd0', hat: 'antlers', hatColor: '#e0d8c0', eyes: '#c8a0ff', gear: { body: 'plate:#c8d0e0', legs: 'plate:#a8b0c0' } },
  wrecker: { skin: '#b08868', hair: '#2a2420', hairStyle: 'short', shirt: '#2a2e34', pants: '#24282c', shoes: '#1a1c1e', outfit: 'traveller', accent: '#ffb040', hat: 'souwester', hatColor: '#2a3036', beard: true, beardStyle: 'stubble' },
  // (Round 68) The far lands' masters that walk as people do (painted
  // large: see farbosses.js; this is how they're dressed when they're not).
  frost_jarl: { skin: '#a8b8c8', hair: '#e8f0f8', hairStyle: 'long', shirt: '#3a4a5a', pants: '#2a3440', shoes: '#2a2a30', outfit: 'plain', accent: '#a0e8ff', hat: 'helmet', hatColor: '#8a9aa8', eyes: '#a0e8ff', beard: true, beardStyle: 'long', gear: { body: 'chain:#6a7a88' } },
  iron_legate: { skin: '#9ab0c8', hair: '#c8d8e8', hairStyle: 'bald', shirt: '#8a2020', pants: '#6a1a1a', shoes: '#4a3a24', outfit: 'tunic', accent: '#c82020', hat: 'galea', hatColor: '#c8a040', eyes: '#e0f4ff', gear: { body: 'plate:#c8a040', legs: 'plate:#b89040' } },
  pale_vestal: { skin: '#e8e4f0', hair: '#f0f0f8', hairStyle: 'long', shirt: '#f4f0e8', pants: '#f4f0e8', shoes: '#c8a040', outfit: 'robe_white', accent: '#c8a040', hat: 'hood', hatColor: '#f8f4ec', eyes: '#ffe8a0' },
  deserter_general: { skin: '#b08060', hair: '#3a2a20', hairStyle: 'short', shirt: '#6a2a2a', pants: '#3a2a24', shoes: '#2a2018', outfit: 'guard', accent: '#8a3a2a', hat: 'galea', hatColor: '#7a7060', beard: true, beardStyle: 'full', gear: { body: 'plate:#8a8070' } },
  last_emperor: { skin: '#c0c8d8', hair: '#e0e0e8', hairStyle: 'bald', shirt: '#d8b040', pants: '#5a1a6a', shoes: '#c8a040', outfit: 'robe_purple', accent: '#e0c050', hat: 'wreath', eyes: '#ffe080' },
  jade_corpse_lord: { skin: '#8ab8a0', hair: '#1a2a20', hairStyle: 'ponytail', shirt: '#1e3a5a', pants: '#162a44', shoes: '#0e1a2a', outfit: 'robe_jade', accent: '#d8b040', hat: 'guanmao', hatColor: '#1e2a24', eyes: '#80ffa0', stoop: true },
  bandit_khan: { skin: '#b07850', hair: '#1a1410', hairStyle: 'long', shirt: '#8a3a20', pants: '#4a3020', shoes: '#2a1a12', outfit: 'traveller', accent: '#40c0b8', hat: 'fur', beard: true, beardStyle: 'full' },
  terracotta_general: { skin: '#b8643a', hair: '#8a4a2a', hairStyle: 'bald', shirt: '#a85a34', pants: '#9a5030', shoes: '#7a3e24', outfit: 'tunic', accent: '#c83030', hat: 'clayhelm', hatColor: '#8a4a2a', eyes: '#3a1a10', gear: { body: 'plate:#9a5030', legs: 'plate:#8a4a2a' } },
  bone_thane: { skin: '#e8e4d4', hair: '#e8e4d4', hairStyle: 'bald', shirt: '#3a4a50', pants: '#2a3438', shoes: '#2a2620', outfit: 'skeleton', accent: '#80c8e0', hat: 'helmet', hatColor: '#e8e0cc', gear: { body: 'chain:#4a5a60' } },
  whale_priest: { skin: '#a8b8c0', hair: '#3a4a50', hairStyle: 'long', shirt: '#2a4a5a', pants: '#2a4a5a', shoes: '#1a2a30', outfit: 'robe_deep', accent: '#e8e0cc', hat: 'hood', hatColor: '#e8e0cc', eyes: '#80d8ff' },
  harpoon_queen: { skin: '#a87a58', hair: '#1a1410', hairStyle: 'long', shirt: '#2a3a3a', pants: '#24302e', shoes: '#1a2220', outfit: 'traveller', accent: '#e0c060', hat: 'tricorn', hatColor: '#1e2426' },
  salt_mummy: { skin: '#f0ecf0', hair: '#ffffff', hairStyle: 'bald', shirt: '#e8e0e4', pants: '#d8d0d8', shoes: '#c8c0c8', outfit: 'rags', accent: '#e8a0b8', hat: 'hood', hatColor: '#f0e8ec', eyes: '#a0c8ff', stoop: true },
  salt_bride: { skin: '#f4f0f8', hair: '#ffffff', hairStyle: 'long', shirt: '#ffffff', pants: '#ffffff', shoes: '#e0e8ff', outfit: 'robe_salt', accent: '#a0c8ff', hat: 'hood', hatColor: '#f0f4ff', eyes: '#a0c8ff' },
  salt_doge: { skin: '#d8b090', hair: '#e8e0d8', hairStyle: 'short', shirt: '#e0b040', pants: '#c8a030', shoes: '#8a6a20', outfit: 'noble', accent: '#ffffff', hat: 'conehat', beard: true, beardStyle: 'full' },
  salt_mother: { skin: '#f8f4f8', hair: '#ffffff', hairStyle: 'long', shirt: '#f8f0f4', pants: '#f0e8f0', shoes: '#e0d8e0', outfit: 'robe_salt', accent: '#f0a8c8', hat: 'circlet', hatColor: '#ffffff', eyes: '#f0a8c8' },
  root_witch: { skin: '#9a8a6a', hair: '#5a4a2a', hairStyle: 'long', shirt: '#4a5a2a', pants: '#3a4a22', shoes: '#2a2a18', outfit: 'robe_root', accent: '#a0c060', hat: 'wreath', eyes: '#ffd070' },
  lamplighter: { skin: '#c8c0b8', hair: '#2a2420', hairStyle: 'short', shirt: '#2a2430', pants: '#1e1a24', shoes: '#141018', outfit: 'traveller', accent: '#ffd070', hat: 'tricorn', hatColor: '#1a1620', eyes: '#ffd070' },
  burrow_baron: { skin: '#c89a74', hair: '#6a4a2a', hairStyle: 'short', shirt: '#7a5a2a', pants: '#4a3a2a', shoes: '#2a1a12', outfit: 'vest', accent: '#d8b040', hat: 'tricorn', hatColor: '#3a2a1a', beard: true, beardStyle: 'full' },
  raven_queen: { skin: '#c8c0d8', hair: '#14141e', hairStyle: 'long', shirt: '#1e1a2a', pants: '#1e1a2a', shoes: '#14141e', outfit: 'robe_raven', accent: '#6a5aa0', hat: 'circlet', hatColor: '#3a3a4a', eyes: '#c8a0ff' },
  antlered_one: { skin: '#8a7a5a', hair: '#3a2a1a', hairStyle: 'long', shirt: '#4a5a3a', pants: '#3a2a1a', shoes: '#2a1a12', outfit: 'hunter', accent: '#a0ff80', hat: 'antlers', hatColor: '#e0d8c0', eyes: '#a0ff80' },
  rune_witch: { skin: '#c8c0b8', hair: '#8a8a90', hairStyle: 'long', shirt: '#3a3a5a', pants: '#3a3a5a', shoes: '#2a2a3a', outfit: 'robe_rune', accent: '#80e8ff', hat: 'hood', hatColor: '#2a2a40', eyes: '#80e8ff' },
  fey_reaver: { skin: '#e0e8f0', hair: '#c8e0d0', hairStyle: 'long', shirt: '#3a5a4a', pants: '#2a4a3a', shoes: '#1e3a2a', outfit: 'plain', accent: '#80ffd0', hat: 'antlers', hatColor: '#e0e8f0', eyes: '#c8a0ff', gear: { body: 'plate:#c8d0e0', legs: 'plate:#a8b0c0' } },
  fair_king: { skin: '#f0f4f8', hair: '#f0e8c0', hairStyle: 'long', shirt: '#c8d0e0', pants: '#4a2a6a', shoes: '#3a1a5a', outfit: 'noble', accent: '#ffe080', hat: 'circlet', hatColor: '#e0e8f0', eyes: '#ffe080' },
  trow_king: { skin: '#7a8a6a', hair: '#3a3a2a', hairStyle: 'long', shirt: '#4a4a3a', pants: '#3a3a2a', shoes: '#2a2a1e', outfit: 'rags', accent: '#ffd070', hat: 'circlet', hatColor: '#a08a50', eyes: '#ffd070', beard: true, beardStyle: 'long', stoop: true },
  finnman: { skin: '#8aa0a8', hair: '#2a3a3a', hairStyle: 'long', shirt: '#2a3a40', pants: '#24302e', shoes: '#1a2220', outfit: 'tidewrap', accent: '#80e8ff', hat: 'hood', hatColor: '#2a3a40', eyes: '#80e8ff' },
  selkie_widow: { skin: '#d8d0c8', hair: '#1a1a1e', hairStyle: 'long', shirt: '#5a6a7a', pants: '#5a6a7a', shoes: '#3a4a5a', outfit: 'robe_seal', accent: '#e0f8ff', hat: 'hood', hatColor: '#6a7a8a' },
  the_wrecker: { skin: '#b08868', hair: '#2a2420', hairStyle: 'short', shirt: '#2a2e34', pants: '#24282c', shoes: '#1a1c1e', outfit: 'traveller', accent: '#ffb040', hat: 'tricorn', hatColor: '#1a1e22', beard: true, beardStyle: 'full' },
  beacon_keeper: { skin: '#a8b0b8', hair: '#c8c8c8', hairStyle: 'long', shirt: '#3a4a5a', pants: '#2a3440', shoes: '#1e2428', outfit: 'traveller', accent: '#ffd070', hat: 'hood', hatColor: '#3a4a5a', eyes: '#ffe8a0', beard: true, beardStyle: 'long' },
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
  robe_jade: { robe: '#1e3a5a', trim: '#d8b040' },
  robe_salt: { robe: '#e8e0e4', trim: '#e8a0b8' },
  robe_purple: { robe: '#5a1a6a', trim: '#e0c050' },
  robe_deep: { robe: '#2a4a5a', trim: '#e8e0cc' },
  robe_root: { robe: '#4a5a2a', trim: '#a0c060' },
  robe_raven: { robe: '#1e1a2a', trim: '#6a5aa0' },
  robe_rune: { robe: '#3a3a5a', trim: '#80e8ff' },
  robe_seal: { robe: '#5a6a7a', trim: '#e0f8ff' },
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
