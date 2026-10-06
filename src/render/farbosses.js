// The far lands' masters, painted large (round 68: see
// entities/bosses_far.js): the ones that walk as people do dressed as
// figures (see bossfigs.js: what they wear, their hats and arms), the rest
// sculpted from a few kinds of body, each made its own by what it's made
// of and what it has (see bossbeasts.js, sculpt.js):
//   four-legged: wolves, foxes, lions, bears, moles, harts, a walrus, a
//     mammoth, each with its own head, coat, horns, tusks, tails, mane;
//   winged: eagles, a roc, the thunderbird, a petrel, the flamingo seraph,
//     the moth queen, wings beating on their own hinges (the rig);
//   serpents: wyrms, a dragon, the hydra's three necks, the glowworm and
//     the gut wyrm, their bodies strung out behind them along the way
//     they came (the rig);
//   golems and giants: marble, turquoise, deep stone, runes, a hill, a
//     storm, a sea trow, seams and runes glowing in them;
//   crawlers: crabs (one crowned, one with a sea-stack on its back) and
//     the crystal matriarch;
//   wraiths: the banshee and the hungry ghost, drifting;
//   and the shapeless: a heart still beating, an oil bloat, the kraken's
//     spawn, the thing below, the scrimshaw horror, a drowned bell.
import { hex, mix, shade, toHex } from './pixel.js';
import { addFigures } from './bossfigs.js';
import { addBeasts, beastPart as part, beastSerpent as serpent, beastCurl as curl } from './bossbeasts.js';
import { drawStrand } from './bossrig.js';
import { hash2 } from './paint.js';

const TAU = Math.PI * 2;
const sn = (t, k = 1, ph = 0) => Math.sin(t * TAU * k + ph);
const dark = (c, k = 0.75) => toHex(shade(hex(c), k));
const lite = (c, k = 1.25) => toHex(shade(hex(c), k));

// ------------------------------------------------------------ figures
addFigures({
  // ---- Velmarch.
  frost_jarl: {
    skin: '#a8b8c8', hair: '#e8f0f8', hairStyle: 'long', beard: '#e8f0f8', beardLong: true, eyes: '#a0e8ff', body: '#3a4a5a', mail: true, legs: '#2a3440', boots: '#2a2a30', cape: '#d8e0e8', capeRagged: true,
    hat: { kind: 'helm', color: '#8a9aa8', spikes: '#e8f0f8' }, weapon: { kind: 'greatsword', color: '#c8e0f0', glow: '#a0e8ff' }, belt: '#2a2018', buckle: '#c8d8e8',
    fx: (P, J) => {
      for (let i = 0; i < 4; i++) {
        const k = (J.t * 2 + i / 4) % 1;
        P.fx(14 + i * 5, 54 - k * 30, '#e0f8ff', 0.7 * (1 - k));
      }
      P.puff(J.head.x - 5, J.head.y + 4, 1.4 + J.b, '#ffffff', 0.4);
    },
  },
  iron_legate: {
    skin: '#9ab0c8', eyes: '#e0f4ff', hair: '#c8d8e8', hairStyle: 'bald', body: '#8a2020', plate: '#c8a040', legs: '#6a1a1a', greaves: '#b89040', boots: '#4a3a24', cape: '#a02020',
    hat: { kind: 'helm', color: '#c8a040', crest: '#c82020' }, weapon: { kind: 'spear', len: 15, color: '#d8d8e0' }, shield: '#a02020', shieldBoss: '#e0c060', belt: '#4a2a1a', buckle: '#e0c060',
    fx: (P, J) => P.puff(J.head.x - 2, J.head.y - 2, 3, '#c8e8ff', 0.25 + 0.1 * Math.sin(J.t * TAU)),
  },
  pale_vestal: {
    skin: '#e8e4f0', hair: '#f0f0f8', hairStyle: 'long', eyes: '#ffe8a0', robe: '#f4f0e8', body: '#f4f0e8', trim: '#c8a040', slimSleeves: true,
    hat: { kind: 'veil', color: '#f8f4ec', trim: '#c8a040' },
    weapon: { kind: 'staff', shaft: '#c8a040', sculptHead: (X, top) => {
      X.ball(top.x, top.y + 1, 2.6, 1.6, '#c8a040', 'gold', { z: 9, rz: 1.4 });
      X.ball(top.x, top.y - 1.5, 1.6, 2.4, '#fff0b0', 'glass', { z: 10, rz: 1.4, glow: '#ffb040', glowK: 0.8 });
    } },
    fx: (P, J) => {
      const top = { x: J.hdN.x - 1.5, y: J.hdN.y - 22 };
      for (let i = 0; i < 4; i++) {
        const k = (J.t * 3 + i / 4) % 1;
        P.fx(top.x + Math.sin(k * 6 + i) * 1.5, top.y - k * 8, k < 0.4 ? '#fff0a0' : '#ff9030', 0.9 * (1 - k));
      }
    },
  },
  deserter_general: {
    skin: '#b08060', hair: '#3a2a20', beard: '#3a2a20', body: '#6a2a2a', plate: '#8a8070', legs: '#3a2a24', greaves: '#7a7060', boots: '#2a2018', cape: '#5a1a1a', capeRagged: true,
    hat: { kind: 'helm', color: '#7a7060', crest: '#4a2020' }, weapon: { kind: 'sabre', color: '#c8c8d0' }, belt: '#3a2418', buckle: '#c8a040', sash: '#8a3a2a',
  },
  last_emperor: {
    skin: '#c0c8d8', eyes: '#ffe080', hair: '#e0e0e8', hairStyle: 'bald', robe: '#5a1a6a', body: '#d8b040', bodyMat: 'gold', trim: '#e0c050', cape: '#6a1a7a',
    hat: { kind: 'wreath', color: '#d8b040', color2: '#e8c860' },
    weapon: { kind: 'staff', shaft: '#d8b040', sculptHead: (X, top) => {
      X.ball(top.x, top.y, 2.6, 2.6, '#e0c050', 'gold', { z: 9, rz: 2.4 });
      X.tube(top.x - 3, top.y - 1, top.x + 3, top.y - 1, 0.7, 0.7, '#e0c050', 'gold', { z: 10 });
      X.ball(top.x, top.y - 3.6, 1.6, 2, '#e0c050', 'gold', { z: 10, rz: 1.4 });
    } },
    sculpt: (X, J) => {
      // The toga over the shoulder, purple-bordered.
      X.limb([[J.shF.x + 1, J.shF.y, 2.2, 6], [22, 32 + J.b, 2.4, 7], [28, 40, 2.2, 6]], '#f0ece0', 'cloth');
      X.limb([[J.shF.x + 1.4, J.shF.y - 0.8, 0.8, 7.6], [22.4, 31 + J.b, 0.8, 8.4], [28.6, 39, 0.8, 7.6]], '#7a2a8a', 'cloth');
    },
    fx: (P, J) => {
      for (let i = 0; i < 3; i++) {
        const k = (J.t + i / 3) % 1;
        P.fx(J.head.x - 6 + i * 6, J.head.y - 8 - k * 6, '#ffe080', 0.7 * (1 - k));
      }
    },
  },
  // ---- Ostria.
  jade_corpse_lord: {
    skin: '#8ab8a0', eyes: '#80ffa0', hair: '#1a2a20', hairStyle: 'long', robe: '#1e3a5a', body: '#1e3a5a', trim: '#d8b040', slimSleeves: true,
    hat: { kind: 'cone', color: '#1e2a24' },
    pose: (J) => {
      // (Arms held out stiff before it.)
      J.elF = { x: 10, y: 26 + J.b };
      J.hdF = { x: 4, y: 26 + J.b };
      J.elN = { x: 14, y: 27 + J.b };
      J.hdN = { x: 7, y: 27.5 + J.b };
    },
    sculpt: (X, J) => {
      // Plates of jade sewn over the robe in rows.
      for (let r = 0; r < 4; r++) for (let i = 0; i < 4; i++) X.ball(17.5 + i * 3, 25 + J.b + r * 3.4, 1.3, 1.4, i % 2 ? '#60c890' : '#40a070', 'glass', { z: 7.6, rz: 0.8, lift: 0.2 });
    },
    paint: (P, J) => {
      // The paper charm hung down over its face.
      P.rect(J.head.x - 3, J.head.y - 4, 3, 9, '#f0d860');
      P.rect(J.head.x - 2, J.head.y - 2, 1, 1, '#c82020');
      P.rect(J.head.x - 2, J.head.y + 1, 1, 2, '#c82020');
    },
    fx: (P, J) => P.puff(J.head.x - 6, J.head.y + 3, 1.6 + J.b, '#a0ffc0', 0.35),
  },
  bandit_khan: {
    skin: '#b07850', hair: '#1a1410', hairStyle: 'long', beard: '#1a1410', body: '#8a3a20', bodyMat: 'leather', legs: '#4a3020', boots: '#2a1a12', cape: '#c86030', capeShort: true,
    hat: { kind: 'helm', color: '#8a6a40', crest: '#3a2a1a', spikes: '#d8c8a0' }, weapon: { kind: 'sabre', color: '#d8d8e0' }, belt: '#3a2010', buckle: '#40c0b8', sash: '#40a0a0',
  },
  terracotta_general: {
    skin: '#b8643a', eyes: '#3a1a10', hair: '#8a4a2a', hairStyle: 'bald', body: '#a85a34', bodyMat: 'ceramic', plate: '#9a5030', legs: '#9a5030', legMat: 'ceramic', greaves: '#8a4a2a', boots: '#7a3e24', cape: '#8a2a20',
    hat: { kind: 'helm', color: '#8a4a2a', crest: '#c83030' }, weapon: { kind: 'spear', len: 16, color: '#c8a070', barb: true },
    paint: (P, J) => {
      // The kiln's cracks across it.
      P.line(J.chest.x - 4, J.chest.y - 2, J.chest.x - 1, J.chest.y + 3, '#5a2a14');
      P.line(J.head.x + 1, J.head.y - 3, J.head.x + 3, J.head.y + 1, '#5a2a14');
    },
  },
  // ---- Corrow.
  bone_thane: {
    skin: '#e8e0cc', eyes: '#80c8e0', skull: true, body: '#3a4a50', mail: true, legs: '#2a3438', boots: '#2a2620', cape: '#4a5a60', capeRagged: true,
    hat: { kind: 'helm', color: '#e8e0cc', spikes: '#f0e8d8' }, weapon: { kind: 'warhammer', len: 14, color: '#e8e0cc' }, belt: '#2a2018', buckle: '#e8e0cc',
    sculpt: (X, J) => {
      // A whale's rib for a pauldron.
      X.limb([[J.shN.x - 3, J.shN.y - 2, 1.2, 9], [J.shN.x + 1, J.shN.y - 4, 1.2, 9], [J.shN.x + 4, J.shN.y - 1, 1, 9]], '#f0e8d8', 'bone');
    },
  },
  whale_priest: {
    skin: '#a8b8c0', eyes: '#80d8ff', hair: '#3a4a50', hairStyle: 'long', robe: '#2a4a5a', body: '#2a4a5a', trim: '#e8e0cc', robeRagged: true,
    hat: { kind: 'hood', color: '#e8e0cc', trim: '#80c8e0' }, weapon: { kind: 'censer', color: '#e8e0cc' },
    sculpt: (X, J) => {
      // A whale's skull for a mask, over the hood.
      X.ball(J.head.x - 1, J.head.y - 1, 5, 4.4, '#f0e8d8', 'bone', { z: 7, rz: 3.4 });
      X.ball(J.head.x - 5, J.head.y + 1, 3, 2, '#e8e0cc', 'bone', { z: 7.6, rz: 1.6 });
    },
    paint: (P, J) => {
      P.eye(J.head.x - 3, J.head.y - 1, '#80d8ff');
      P.eye(J.head.x + 0.5, J.head.y - 1, '#80d8ff');
    },
    fx: (P, J) => {
      for (const x of [16, 22, 28]) {
        const k = (J.t * 1.5 + x * 0.07) % 1;
        P.fx(x, 44 + k * 12, '#80c8e8', 0.7 * (1 - k));
      }
    },
  },
  harpoon_queen: {
    skin: '#a87a58', hair: '#1a1410', hairStyle: 'long', body: '#2a3a3a', bodyMat: 'leather', legs: '#24302e', boots: '#1a2220', cape: '#3a5a6a', capeShort: true,
    hat: { kind: 'tricorn', color: '#1e2426', trim: '#e0c060' }, weapon: { kind: 'spear', len: 13, color: '#c8c8d0', barb: true, shaft: '#e8e0cc' }, belt: '#3a2418', buckle: '#e0c060', sash: '#a83a2a',
  },
  // ---- Saltmere.
  salt_mummy: {
    skin: '#f0ecf0', eyes: '#a0c8ff', hair: '#ffffff', hairStyle: 'bald', robe: '#e8e0e4', body: '#e8e0e4', trim: '#e8a0b8', robeRagged: true,
    hat: { kind: 'hood', color: '#f0e8ec' },
    sculpt: (X, J) => {
      // Wrappings, crusted, and salt grown on them in clusters.
      for (let i = 0; i < 6; i++) X.tube(15, 24 + J.b + i * 4, 30, 26 + J.b + i * 4, 0.7, 0.7, '#dcd4d8', 'cloth', { z: 7.4 });
      for (const [x, y] of [[17, 28], [27, 34], [20, 44], [26, 50], [J.shN.x - 1, J.shN.y - 1]]) X.ball(x, y + J.b, 1.6, 1.4, '#ffffff', 'glass', { z: 8, rz: 1.2, lift: 0.3 });
    },
    fx: (P, J) => {
      for (let i = 0; i < 4; i++) {
        const k = (J.t + i / 4) % 1;
        P.fx(14 + i * 6, 56 - k * 14, '#ffffff', 0.7 * (1 - k));
      }
    },
  },
  salt_bride: {
    skin: '#f4f0f8', eyes: '#a0c8ff', hair: '#ffffff', hairStyle: 'long', robe: '#ffffff', body: '#f8f4f8', trim: '#a0c8ff', robeRagged: true, slimSleeves: true,
    hat: { kind: 'veil', color: '#f0f4ff', trim: '#ffffff' },
    weapon: { kind: 'staff', shaft: '#e0d8e8', sculptHead: (X, top) => {
      // A bouquet of salt flowers.
      for (let i = 0; i < 5; i++) X.ball(top.x + Math.cos(i * 1.3) * 2, top.y + Math.sin(i * 1.3) * 2, 1.4, 1.4, i % 2 ? '#ffffff' : '#f8d8e8', 'glass', { z: 9, rz: 1.2 });
    } },
    fx: (P, J) => {
      for (let i = 0; i < 3; i++) {
        const k = (J.t * 1.4 + i / 3) % 1;
        P.fx(J.head.x - 3 + i * 2, J.head.y + 2 + k * 30, '#e0f0ff', 0.8 * (1 - k));
      }
    },
  },
  salt_doge: {
    skin: '#d8b090', hair: '#e8e0d8', hairStyle: 'short', beard: '#e8e0d8', robe: '#c8a030', body: '#e0b040', bodyMat: 'velvet', trim: '#ffffff', cape: '#e0e0e8',
    hat: { kind: 'cone', color: '#e0b040' }, weapon: { kind: 'sabre', color: '#e0d8c8' },
    sculpt: (X, J) => {
      // An ermine collar.
      X.tube(15, 23 + J.b, 30, 23 + J.b, 2.2, 2.2, '#ffffff', 'fur', { z: 7 });
      for (const x of [17, 21, 25, 29]) X.ball(x, 23.6 + J.b, 0.6, 0.8, '#1a1a1a', 'fur', { z: 9.4, rz: 0.4 });
    },
  },
  salt_mother: {
    skin: '#f8f4f8', eyes: '#f0a8c8', hair: '#ffffff', hairStyle: 'long', robe: '#f0e8f0', body: '#f8f0f4', trim: '#f0a8c8', slimSleeves: true, cape: '#ffffff',
    hat: { kind: 'crown', color: '#ffffff', gem: '#f0a8c8' },
    sculpt: (X, J) => {
      // Crystals grown out of her, shoulder and hip.
      for (const [x, y, a] of [[J.shF.x - 1, J.shF.y - 2, -0.6], [J.shN.x + 1, J.shN.y - 3, 0.5], [14, 44, -0.4], [31, 46, 0.4]]) {
        X.tube(x, y + J.b, x + Math.sin(a) * 5, y - 6 + J.b, 1.4, 0.3, '#ffffff', 'glass', { z: 6 });
        X.tube(x + 1.4, y + J.b, x + 1.4 + Math.sin(a) * 3, y - 4 + J.b, 1, 0.2, '#f8d0e0', 'glass', { z: 6.4 });
      }
    },
    fx: (P, J) => {
      for (let i = 0; i < 6; i++) {
        const a = J.t * TAU + (i / 6) * TAU;
        P.fx(22 + Math.cos(a) * 16, 34 + Math.sin(a) * 6, i % 2 ? '#ffffff' : '#f8c8dc', 0.8);
      }
    },
  },
  // ---- Hollowmark.
  root_witch: {
    skin: '#9a8a6a', eyes: '#ffd070', hair: '#5a4a2a', hairStyle: 'wild', robe: '#4a5a2a', body: '#4a5a2a', trim: '#a0c060', robeRagged: true,
    hat: { kind: 'thorns', color: '#5a4430', flowers: '#ffd070' },
    weapon: { kind: 'staff', shaft: '#5a4430', sculptHead: (X, top) => {
      X.ball(top.x, top.y, 2.4, 2.8, '#ffd070', 'glass', { z: 9, rz: 2, glow: '#ffd070', glowK: 0.7 });
      for (let i = 0; i < 3; i++) X.tube(top.x, top.y + 2, top.x - 3 + i * 3, top.y - 4, 0.5, 0.2, '#5a4430', 'bark', { z: 10 });
    } },
    sculpt: (X, J) => {
      // Roots for hair, hanging down her back, and twined round her arms.
      for (let i = 0; i < 4; i++) X.limb([[J.head.x + 2 + i, J.head.y - 2, 0.9, -1], [J.head.x + 4 + i * 1.6, J.head.y + 8, 0.7, -1], [J.head.x + 3 + i * 2, J.head.y + 18, 0.4, -1]], '#5a4430', 'bark');
    },
  },
  lamplighter: {
    skin: '#c8c0b8', eyes: '#ffd070', hair: '#2a2420', hairStyle: 'short', body: '#2a2430', legs: '#1e1a24', boots: '#141018', cape: '#1e1a24', capeRagged: true,
    hat: { kind: 'tricorn', color: '#1a1620' }, weapon: { kind: 'censer', color: '#ffd070' },
    sculpt: (X, J) => {
      // His long pole over the shoulder, its snuffer's cone at the top.
      X.tube(J.hdF.x, J.hdF.y + 4, J.hdF.x + 14, J.hdF.y - 26, 0.7, 0.6, '#4a3a2a', 'wood', { z: -2 });
      X.slab([[J.hdF.x + 12.6, J.hdF.y - 26], [J.hdF.x + 16, J.hdF.y - 25], [J.hdF.x + 15, J.hdF.y - 29]], '#8a8070', 'metal', { z: -1.6, rz: 1 });
    },
  },
  burrow_baron: {
    skin: '#c89a74', hair: '#6a4a2a', hairStyle: 'short', beard: '#6a4a2a', body: '#7a5a2a', bodyMat: 'velvet', legs: '#4a3a2a', boots: '#2a1a12', belt: '#2a1a12', buckle: '#d8b040',
    hat: { kind: 'tricorn', color: '#3a2a1a', trim: '#d8b040' }, weapon: { kind: 'mace', len: 12, color: '#8a8a98' }, sash: '#a83a2a',
    sculpt: (X, J) => {
      // A belly that's had its second breakfast.
      X.ball(J.belly.x - 1, J.belly.y + 1, 6.6, 5.4, '#7a5a2a', 'velvet', { z: 4, rz: 4 });
      for (let i = 0; i < 3; i++) X.ball(J.belly.x - 4.5, J.belly.y - 2 + i * 3, 0.6, 0.6, '#d8b040', 'gold', { z: 8.6, rz: 0.4 });
    },
  },
  // ---- the Wyrd Isle.
  raven_queen: {
    skin: '#c8c0d8', eyes: '#c8a0ff', hair: '#14141e', hairStyle: 'long', robe: '#1e1a2a', body: '#1e1a2a', trim: '#6a5aa0', cape: '#14141e', capeRagged: true,
    hat: { kind: 'crown', color: '#3a3a4a', gem: '#c8a0ff' },
    sculpt: (X, J) => {
      // A mantle of raven feathers over her shoulders.
      for (let i = 0; i < 7; i++) X.slab([[14 + i * 2.4, 22 + J.b], [16 + i * 2.4, 22 + J.b], [15.4 + i * 2.4, 29 + J.b + (i % 2) * 2]], '#22223a', 'feather', { z: 7, rz: 1, bevel: 0.6 });
    },
    fx: (P, J) => {
      for (let i = 0; i < 3; i++) {
        const a = J.t * TAU * 0.5 + (i / 3) * TAU;
        const x = 22 + Math.cos(a) * 18;
        const y = 12 + Math.sin(a) * 4;
        P.rect(x - 1, y, 3, 1, '#14141e');
        P.set(x + 1, y - 1, hex('#14141e'));
      }
    },
  },
  antlered_one: {
    skin: '#8a7a5a', eyes: '#a0ff80', hair: '#3a2a1a', hairStyle: 'wild', body: '#4a5a3a', bodyMat: 'leather', legs: '#3a2a1a', legMat: 'fur', boots: '#2a1a12', cape: '#6a5a3a', capeRagged: true,
    hat: { kind: 'antlers', color: '#e0d8c0' }, weapon: { kind: 'spear', len: 15, color: '#b0b8a0', shaft: '#5a4430' }, belt: '#2a1a12',
    sculpt: (X, J) => {
      // A pelt over the shoulders, and a horn at his belt.
      X.limb([[J.shF.x, J.shF.y - 1, 2.6, 6], [22, 22 + J.b, 2.8, 7], [J.shN.x, J.shN.y - 1, 2.6, 6]], '#7a6a4a', 'fur');
      X.limb([[28, 37, 0.8, 8], [30, 40, 1.2, 8], [29, 43, 1.6, 8]], '#e0d8c0', 'bone');
    },
  },
  rune_witch: {
    skin: '#c8c0b8', eyes: '#80e8ff', hair: '#8a8a90', hairStyle: 'long', robe: '#3a3a5a', body: '#3a3a5a', trim: '#80e8ff',
    hat: { kind: 'hood', color: '#2a2a40', trim: '#80e8ff' },
    weapon: { kind: 'staff', shaft: '#6a5a4a', sculptHead: (X, top) => {
      X.ball(top.x, top.y, 2.2, 3.2, '#8a8a86', 'rock', { z: 9, rz: 2 });
    } },
    paint: (P, J) => {
      const top = { x: J.hdN.x - 1.5, y: J.hdN.y - 20 };
      P.line(top.x - 1, top.y - 2, top.x + 1, top.y + 1, '#80e8ff');
      P.line(top.x + 1, top.y - 2, top.x - 1, top.y + 1, '#80e8ff');
    },
    fx: (P, J) => {
      // Runes turning round her.
      for (let i = 0; i < 5; i++) {
        const a = J.t * TAU + (i / 5) * TAU;
        const x = 22 + Math.cos(a) * 15;
        const y = 36 + Math.sin(a) * 5;
        P.fx(x, y, '#80e8ff', 0.9);
        P.fx(x, y - 1, '#e0ffff', 0.6);
      }
    },
  },
  fey_reaver: {
    skin: '#e0e8f0', eyes: '#c8a0ff', hair: '#c8e0d0', hairStyle: 'long', body: '#3a5a4a', plate: '#c8d0e0', legs: '#2a4a3a', greaves: '#a8b0c0', boots: '#1e3a2a', cape: '#80ffd0', capeRagged: true,
    hat: { kind: 'antlers', color: '#e0e8f0' }, weapon: { kind: 'sabre', color: '#e0f8ff' },
    fx: (P, J) => {
      for (let i = 0; i < 4; i++) {
        const k = (J.t * 2 + i / 4) % 1;
        P.fx(J.hdN.x - 2 - k * 4, J.hdN.y - 6 - k * 10, i % 2 ? '#c8a0ff' : '#80ffd0', 0.8 * (1 - k));
      }
    },
  },
  fair_king: {
    skin: '#f0f4f8', eyes: '#ffe080', hair: '#f0e8c0', hairStyle: 'long', robe: '#4a2a6a', body: '#c8d0e0', bodyMat: 'metal', trim: '#ffe080', cape: '#80ffd0',
    hat: { kind: 'crown', color: '#e0e8f0', gem: '#80ffd0' }, weapon: { kind: 'greatsword', color: '#e0f0ff', glow: '#c8a0ff' },
    fx: (P, J) => {
      for (let i = 0; i < 6; i++) {
        const a = J.t * TAU * 0.5 + (i / 6) * TAU;
        P.fx(22 + Math.cos(a) * 17, 30 + Math.sin(a) * 18, i % 2 ? '#c8a0ff' : '#ffe080', 0.7);
      }
    },
  },
  // ---- the Grey Skerries.
  trow_king: {
    skin: '#7a8a6a', eyes: '#ffd070', hair: '#3a3a2a', hairStyle: 'wild', beard: '#3a3a2a', beardLong: true, body: '#4a4a3a', bodyMat: 'leather', legs: '#3a3a2a', boots: '#2a2a1e', cape: '#5a5a4a', capeRagged: true,
    hat: { kind: 'crown', color: '#a08a50', gem: '#80c080' }, weapon: { kind: 'warhammer', len: 14, color: '#8a8a86', shaft: '#4a3a2a' }, belt: '#2a2018',
    sculpt: (X, J) => {
      // A great nose; a hunch.
      X.ball(J.head.x - 5, J.head.y + 1.6, 2, 1.6, '#7a8a6a', 'skin', { z: 7, rz: 1.6 });
      X.ball(28, 24 + J.b, 5, 4, '#4a4a3a', 'leather', { z: -1, rz: 3 });
    },
  },
  finnman: {
    skin: '#8aa0a8', eyes: '#80e8ff', hair: '#2a3a3a', hairStyle: 'long', body: '#2a3a40', bodyMat: 'leather', legs: '#24302e', boots: '#1a2220', cape: '#3a5a5a', capeRagged: true,
    hat: { kind: 'hood', color: '#2a3a40' },
    weapon: { kind: 'staff', shaft: '#5a4a3a', sculptHead: (X, top) => {
      // An oar's blade.
      X.slab([[top.x - 1.6, top.y + 4], [top.x + 1.6, top.y + 4], [top.x + 2, top.y - 5], [top.x - 2, top.y - 5]], '#6a5a44', 'wood', { z: 9, rz: 1, bevel: 0.8 });
    } },
    sculpt: (X, J) => {
      for (let i = 0; i < 3; i++) X.limb([[16 + i * 5, 28 + J.b, 0.6, 7], [15 + i * 5, 36, 0.5, 7], [16 + i * 5, 42, 0.4, 6]], '#3a6a4a', 'moss');
    },
    fx: (P, J) => {
      for (const x of [15, 24, 29]) {
        const k = (J.t * 1.4 + x * 0.1) % 1;
        P.fx(x, 40 + k * 16, '#80c8e8', 0.6 * (1 - k));
      }
    },
  },
  selkie_widow: {
    skin: '#d8d0c8', eyes: '#3a4a5a', hair: '#1a1a1e', hairStyle: 'long', robe: '#5a6a7a', body: '#5a6a7a', trim: '#e0f8ff', slimSleeves: true, cape: '#7a8a9a',
    hat: { kind: 'veil', color: '#6a7a8a' },
    sculpt: (X, J) => {
      // Her sealskin, grey and spotted, half off her shoulders.
      X.limb([[J.shF.x, J.shF.y, 2.4, 6], [20, 34 + J.b, 2.8, 7], [30, 44, 2.4, 6]], '#8a9aa8', 'fur');
      for (const [x, y] of [[18, 30], [23, 37], [27, 41]]) X.ball(x, y + J.b, 1, 0.8, '#4a5a68', 'fur', { z: 9.4, rz: 0.6 });
    },
    fx: (P, J) => {
      for (let i = 0; i < 3; i++) {
        const k = (J.t + i / 3) % 1;
        P.fx(J.head.x - 3, J.head.y + 1 + k * 10, '#c8e8ff', 0.7 * (1 - k));
      }
    },
  },
  the_wrecker: {
    skin: '#b08868', hair: '#2a2420', hairStyle: 'short', beard: '#2a2420', body: '#2a2e34', bodyMat: 'leather', legs: '#24282c', boots: '#1a1c1e', cape: '#1e2226', capeRagged: true,
    hat: { kind: 'tricorn', color: '#1a1e22' }, weapon: { kind: 'censer', color: '#ffb040' }, belt: '#2a1a12', buckle: '#c8a040',
    fx: (P, J) => P.puff(J.hdN.x, J.hdN.y + 8, 3 + J.b, '#ffd070', 0.3),
  },
  beacon_keeper: {
    skin: '#a8b0b8', eyes: '#ffe8a0', hair: '#c8c8c8', hairStyle: 'long', beard: '#c8c8c8', beardLong: true, body: '#3a4a5a', bodyMat: 'leather', legs: '#2a3440', boots: '#1e2428', cape: '#4a5a6a', capeRagged: true,
    hat: { kind: 'hood', color: '#3a4a5a' },
    weapon: { kind: 'staff', shaft: '#5a4a3a', sculptHead: (X, top) => {
      // The beacon's lamp on a pole.
      X.slab([[top.x - 2.6, top.y + 2], [top.x + 2.6, top.y + 2], [top.x + 2, top.y - 4], [top.x - 2, top.y - 4]], '#3a3a40', 'metal', { z: 9, rz: 2, bevel: 0.8 });
      X.ball(top.x, top.y - 1, 1.8, 2.4, '#fff0b0', 'glass', { z: 10.6, rz: 1.2, glow: '#ffd070', glowK: 0.9 });
    } },
    fx: (P, J) => {
      const top = { x: J.hdN.x - 1.5, y: J.hdN.y - 21 };
      // The beam, turning.
      const a = J.t * TAU;
      for (let k = 2; k < 14; k++) P.fx(top.x + Math.cos(a) * k, top.y + Math.sin(a) * k * 0.35, '#fff0b0', 0.5 * (1 - k / 14));
    },
  },
});

// ------------------------------------------------------------ beasts
// Four legs: facing left, body over its legs, neck up to its head; what
// it has besides as its `o` says.
function quad(o) {
  const k = o.k || 1;
  const W = Math.round(68 * k);
  const H = Math.round(58 * k);
  const S = (v) => v * k;
  return {
    w: W, h: H, ax: Math.round(W / 2), ay: H - 2,
    sculpt(X, t, st) {
      const fur = o.coat;
      const mat = o.mat || 'fur';
      const gy = H - 2;
      const b = sn(t) * 0.6 * k;
      const wind = st.wind ? 1 : 0;
      const heavy = o.heavy || 0;
      const legL = S(o.legs ?? 15);
      const by = gy - legL - S(6 + heavy * 2) - b;
      const bx = S(38);
      const brx = S(15 + heavy * 3);
      const bry = S(9 + heavy * 3);
      const lt = S(3 + heavy * 1.6);
      const fx = bx - brx * 0.62;
      const hx2 = bx + brx * 0.62;
      // Far legs.
      X.in(0, 2);
      if (!o.noLegs) {
        for (const x of [fx + S(3), hx2 + S(3)]) X.limb([[x, by + S(4), lt * 1.1, -2], [x - S(1) + wind * S(1), by + legL * 0.6, lt * 0.8, -2], [x, gy, lt * 0.7, -2]], dark(fur, 0.78), mat);
      }
      // Tail(s).
      const tails = o.tails || 1;
      for (let i = 0; i < tails; i++) {
        const spread = tails > 1 ? (i - (tails - 1) / 2) * 0.32 : 0;
        const sw = sn(t, 1, i * 0.7) * 1.2;
        const a = -0.6 + spread;
        const L = S(o.tailLen ?? 12);
        const x0 = bx + brx * 0.9;
        const y0 = by - bry * 0.2;
        X.limb([[x0, y0, S(o.tailW ?? 1.6), -1], [x0 + Math.cos(a) * L * 0.5 + sw, y0 + Math.sin(a) * L * 0.5, S((o.tailW ?? 1.6) * 1.2), -1], [x0 + Math.cos(a) * L + sw * 2, y0 + Math.sin(a) * L, S((o.tailW ?? 1.6) * 0.5), -1]], o.tailCol || fur, o.tailMat || mat);
        if (o.tailTip) X.ball(x0 + Math.cos(a) * L + sw * 2, y0 + Math.sin(a) * L, S(1.4), S(1.4), o.tailTip, mat, { z: 0.5 });
      }
      // The body.
      X.in(1, 3.5);
      X.ball(bx, by, brx, bry, fur, mat, { rz: bry, along: 'x' });
      X.ball(fx + S(2), by - S(1), S(7 + heavy * 2), S(7 + heavy * 2), fur, mat, { rz: S(6), z: 1 });
      if (o.belly) X.ball(bx, by + bry * 0.55, brx * 0.7, bry * 0.4, o.belly, mat, { rz: S(3), z: 3 });
      // Neck and head.
      const hd = o.head || 'canine';
      const low = hd === 'mammoth' || hd === 'bear' || hd === 'walrus' || hd === 'mole' ? 1 : 0;
      const nx = fx - S(5);
      const ny = by - S(low ? 1 : 5) + wind * S(4);
      const hx = fx - S(low ? 10 : 12);
      const hy = by - S(low ? 2 : 11) + wind * S(5);
      X.limb([[fx + S(1), by - S(2), S(6 + heavy), 3], [nx, ny, S(5 + heavy), 5], [hx + S(3), hy + S(1), S(4.4 + heavy), 6]], fur, mat);
      const hr = S(o.headR ?? 5.4);
      X.ball(hx, hy, hr, hr * 0.85, o.headCol || fur, mat, { rz: hr * 0.9, z: 7 });
      if (o.mane) {
        // A mane: tufts all round the head and down the neck.
        for (let i = 0; i < 9; i++) {
          const a = -Math.PI * 0.15 + (i / 8) * Math.PI * 1.5;
          X.ball(hx + S(2) + Math.cos(a) * hr * 1.15, hy + S(1) + Math.sin(a) * hr * 1.1, hr * 0.62, hr * 0.62, i % 2 ? o.mane : dark(o.mane, 0.85), 'hair', { rz: hr * 0.5, z: 5, k: 1 });
        }
        X.ball(hx + S(5), hy + S(5), hr * 0.9, hr * 1.1, o.mane, 'hair', { rz: hr * 0.6, z: 4 });
      }
      // The muzzle, by kind.
      if (hd === 'canine' || hd === 'fox') X.ball(hx - S(5), hy + S(2), S(hd === 'fox' ? 4 : 4.4), S(2.2), o.headCol || fur, mat, { rz: S(2.4), z: 8, ang: -0.1 });
      if (hd === 'cat') X.ball(hx - S(4), hy + S(2.2), S(3.4), S(2.8), o.headCol || fur, mat, { rz: S(2.6), z: 8 });
      if (hd === 'deer') X.ball(hx - S(4.6), hy + S(2.6), S(3.8), S(2.2), o.headCol || fur, mat, { rz: S(2.2), z: 8, ang: -0.3 });
      if (hd === 'bear') X.ball(hx - S(4.6), hy + S(2), S(3.6), S(2.8), dark(fur, 0.9), mat, { rz: S(2.6), z: 8 });
      if (hd === 'mole') {
        X.ball(hx - S(5.6), hy + S(1.6), S(3.4), S(2.6), '#e8a0a0', 'skin', { rz: S(2.4), z: 8 });
        for (let i = 0; i < 6; i++) X.tube(hx - S(7.6), hy + S(1.6), hx - S(7.6) + Math.cos(i) * S(2.4), hy + S(1.6) + Math.sin(i) * S(2.4), S(0.6), S(0.3), '#f0b0b0', 'skin', { z: 9 });
      }
      if (hd === 'walrus') {
        X.ball(hx - S(4), hy + S(2.6), S(4.6), S(3.4), dark(fur, 0.92), mat, { rz: S(3), z: 8 });
        for (const dx of [-1, 1.4]) X.limb([[hx - S(4.6) + S(dx), hy + S(4.4), S(1.2), 9], [hx - S(5) + S(dx), hy + S(11), S(0.9), 9], [hx - S(4) + S(dx), hy + S(16), S(0.4), 9]], o.tusk || '#f0e8d8', 'bone');
      }
      if (hd === 'mammoth') {
        // The trunk, swinging; tusks curving out and up.
        const sw = sn(t, 1, 0.5) * S(1.5);
        X.limb([[hx - S(3), hy + S(3), S(3), 8], [hx - S(6) + sw, hy + S(12), S(2.4), 8], [hx - S(5) + sw * 1.5, hy + S(20) - wind * S(8), S(1.6), 8], [hx - S(8) + sw * 2, hy + S(25) - wind * S(14), S(1.2), 8]], fur, mat);
        for (const [dz, dy] of [[-1, 0], [10, 1]]) X.limb([[hx - S(2), hy + S(5) + S(dy), S(1.8), dz], [hx - S(10), hy + S(12) + S(dy), S(1.6), dz], [hx - S(18), hy + S(8) + S(dy), S(1.2), dz], [hx - S(19), hy + S(1) + S(dy), S(0.6), dz]], o.tusk || '#f0e8d8', 'bone');
      }
      // Ears.
      if (o.ears !== false && hd !== 'walrus' && hd !== 'mole') {
        const er = hd === 'fox' ? 2.4 : hd === 'mammoth' ? 6 : 1.8;
        X.ball(hx + S(2.6), hy - hr * 0.9, S(er * 0.7), S(er), dark(o.headCol || fur, 0.85), mat, { rz: S(1.2), z: 6 });
      }
      // Near legs (great claws, for a digger).
      X.in(2, 2);
      if (!o.noLegs) {
        for (const x of [fx, hx2]) {
          X.limb([[x, by + S(4), lt * 1.2, 6], [x + (x === fx ? -wind * S(3) : 0), by + legL * 0.6, lt * 0.9, 7], [x, gy, lt * 0.75, 7]], fur, mat);
          X.ball(x - S(0.6), gy, lt * 0.9, S(1.4), o.hoof || dark(fur, 0.6), o.hoof ? 'bone' : mat, { z: 8, rz: S(1.2) });
        }
        if (o.claws) for (let i = 0; i < 4; i++) X.tube(fx - S(1), gy - S(2), fx - S(8) + i * S(1.2), gy - S(5) + i * S(2), S(1.3), S(0.35), o.claws, 'bone', { z: 9 });
      } else {
        // (Flippers.)
        X.slab([[fx - S(2), by + bry * 0.6], [fx + S(6), by + bry * 0.6], [fx + S(2), gy], [fx - S(6), gy]], dark(fur, 0.8), 'leather', { z: 7, rz: S(1.6), bevel: S(1) });
      }
      // Horns, antlers.
      X.in(3, 1.2);
      if (o.antlers) {
        const ry = hy - hr * 0.7;
        for (const s of [-1, 1]) {
          const rx = hx + S(1 + s * 1.6);
          const c = o.antlers;
          X.limb([[rx, ry, S(1.3), 9], [rx + s * S(3), ry - S(8), S(1.1), 9], [rx + s * S(2), ry - S(16), S(0.8), 9], [rx + s * S(5), ry - S(22), S(0.5), 9]], c, 'bone');
          X.limb([[rx + s * S(3), ry - S(8), S(0.8), 9], [rx + s * S(9), ry - S(11), S(0.6), 9], [rx + s * S(12), ry - S(16), S(0.35), 9]], c, 'bone');
          X.limb([[rx + s * S(2), ry - S(16), S(0.6), 9], [rx - s * S(3), ry - S(20), S(0.4), 9]], c, 'bone');
        }
      }
      if (o.horns) for (const s of [-1, 1]) X.limb([[hx + S(1 + s), hy - hr * 0.7, S(1.2), 9], [hx - S(2) + s * S(2), hy - hr - S(3), S(0.8), 9], [hx - S(5), hy - hr - S(4), S(0.3), 9]], o.horns, 'bone');
      if (o.crown) {
        X.tube(hx - S(3), hy - hr * 0.8, hx + S(3), hy - hr * 0.9, S(1), S(1), o.crown, 'gold', { z: 9 });
        for (let i = 0; i < 4; i++) X.tube(hx - S(2.6) + i * S(1.8), hy - hr * 0.9, hx - S(2.6) + i * S(1.8), hy - hr * 0.9 - S(2.6), S(0.6), S(0.25), o.crown, 'gold', { z: 9 });
      }
      if (o.mask) X.ball(hx - S(1.5), hy, hr * 0.9, hr * 0.8, o.mask, 'bone', { z: 9.5, rz: S(2) });
      if (o.shaggy) for (let i = 0; i < 7; i++) X.limb([[bx - brx * 0.8 + i * brx * 0.28, by + bry * 0.6, S(1.6), 4], [bx - brx * 0.8 + i * brx * 0.28 + sn(t, 1, i) * 0.6, by + bry * 1.05 + (i % 2) * S(2), S(1), 4]], dark(fur, 0.85), 'fur');
      if (o.extra) o.extra(X, { t, st, S, hx, hy, hr, bx, by, brx, bry, gy, fx, hx2 });
    },
    paint(P, t, st) {
      const gy = H - 2;
      const b = sn(t) * 0.6 * k;
      const wind = st.wind ? 1 : 0;
      const heavy = o.heavy || 0;
      const legL = S(o.legs ?? 15);
      const by = gy - legL - S(6 + heavy * 2) - b;
      const fx = S(38) - S(15 + heavy * 3) * 0.62;
      const low = ['mammoth', 'bear', 'walrus', 'mole'].includes(o.head || 'canine');
      const hx = fx - S(low ? 10 : 12);
      const hy = by - S(low ? 2 : 11) + wind * S(5);
      if (o.eyes !== false) P.eye(hx - S(2), hy - S(1), st.rage ? (o.rageEye || '#ff4030') : o.eyes || '#ffd070', k > 1.1);
      if (o.paint) o.paint(P, { t, st, S, hx, hy, by, gy });
    },
    fx(P, t, st) {
      if (o.fx) o.fx(P, t, st, S, W, H);
    },
  };
}

// Wings: a pair of feathered (or velvet) wings on their hinges at the
// shoulder, beating (held up as it dives).
function wingPair(key, o) {
  const w = (near) => part(`${key}_wing${near ? 1 : 0}`, 36, 26, 4, 22, (X) => {
    const c = near ? o.wing : dark(o.wing, 0.78);
    if (o.moth) {
      X.slab([[4, 22], [12, 6], [24, 1], [34, 4], [33, 12], [24, 20], [14, 25]], c, 'velvet', { rz: 1.4, bevel: 2 });
      X.ball(22, 10, 4, 3.6, o.spot || '#1a1420', 'velvet', { z: 1.5, rz: 0.6 });
      X.ball(22, 10, 2, 1.8, o.spot2 || '#ffe060', 'velvet', { z: 1.8, rz: 0.4 });
    } else {
      X.slab([[4, 22], [10, 9], [20, 3], [33, 1], [35, 5], [30, 10], [33, 13], [26, 16], [28, 20], [18, 22], [14, 25]], c, 'feather', { rz: 1.6, bevel: 1.4 });
      // The flight feathers, darker along the trailing edge.
      for (let i = 0; i < 5; i++) X.tube(12 + i * 4, 21 - i * 2, 18 + i * 4, 23 - i * 3, 1.3, 0.5, o.tips || dark(c, 0.7), 'feather', { z: 1.4 });
    }
  });
  return (R, near) => {
    const rate = R.st.wind ? 9 : o.rate || 4.2;
    const beat = Math.sin(R.t * rate + (near ? 0 : 0.6));
    const sy = R.st.wind ? 1 : 0.3 + 0.7 * (beat * 0.5 + 0.5);
    const bob = Math.sin(R.phase * TAU) * 1.4;
    w(near).flapY(R.ctx, R.ox + (near ? o.hx : o.hx + 4), R.oy + o.hy + bob, near ? -0.15 : 0.05, sy * (near ? 1 : 0.86), near ? 1 : 0.8);
    if (o.extraWings) w(near).flapY(R.ctx, R.ox + (near ? o.hx - 2 : o.hx + 2), R.oy + o.hy + 8 + bob, near ? 0.5 : 0.6, sy * 0.7, near ? 0.9 : 0.7);
  };
}
// A bird (or a moth), flying: body, head and beak, tail, talons hanging.
function bird(key, o) {
  const W = 64;
  const H = 62;
  const wings = wingPair(key, { hx: 34, hy: 30, ...o });
  return {
    w: W, h: H, ax: 32, ay: 60,
    sculpt(X, t, st) {
      const bob = sn(t) * 1.4;
      const dive = st.wind ? 1 : 0;
      const c = o.body;
      X.in(0, 2);
      // Tail.
      if (o.moth) X.limb([[40, 34 + bob, 5, 0], [47, 37 + bob, 4.4, 0], [54, 41 + bob, 2.6, 0]], dark(c, 0.85), 'fur');
      else X.slab([[42, 32 + bob], [58, 30 + bob], [60, 36 + bob], [44, 38 + bob]], o.tail || dark(c, 0.8), 'feather', { rz: 1.4, bevel: 1 });
      // Talons, hanging (or reaching, as it dives).
      if (!o.moth) for (const dx of [0, 4]) X.limb([[32 + dx, 38 + bob, 1.4, 1], [30 + dx - dive * 4, 46 + bob + dive * 2, 1, 1], [29 + dx - dive * 6, 50 + bob, 0.7, 1]], o.legs || '#e0b040', 'leather');
      else for (let i = 0; i < 3; i++) X.limb([[30 + i * 4, 37 + bob, 0.8, 1], [28 + i * 4, 43 + bob, 0.6, 1], [29 + i * 4 + sn(t, 1, i), 47 + bob, 0.4, 1]], '#3a2e20', 'chitin');
      if (o.longLegs) for (const dx of [0, 3]) X.limb([[33 + dx, 38 + bob, 1, 1], [34 + dx, 48 + bob, 0.8, 1], [32 + dx, 58, 0.6, 1]], o.longLegs, 'leather');
      X.in(1, 3);
      X.ball(33, 31 + bob, o.moth ? 7 : 10, o.moth ? 6.4 : 7, c, o.moth ? 'fur' : 'feather', { rz: 7 });
      if (o.breast) X.ball(29, 34 + bob, 6, 4.4, o.breast, 'feather', { rz: 4, z: 3 });
      // Neck and head (a flamingo's long and curving).
      const hx = o.longNeck ? 14 + dive * 4 : 21 - dive * 2;
      const hy = o.longNeck ? 12 + bob : 24 + bob + dive * 4;
      if (o.longNeck) X.limb([[28, 26 + bob, 3, 3], [24, 18 + bob, 2.4, 4], [20, 12 + bob, 2.2, 5], [hx + 2, hy, 2.2, 6]], o.neck || c, 'feather');
      else X.limb([[28, 27 + bob, 5, 3], [hx + 2, hy, 4, 5]], o.neck || c, o.bald ? 'skin' : 'feather');
      X.ball(hx, hy, o.moth ? 4.4 : 4.6, 4.2, o.headCol || c, o.bald ? 'skin' : o.moth ? 'fur' : 'feather', { rz: 4, z: 6 });
      X.in(2, 1);
      if (o.moth) {
        for (const [dx, ph] of [[0, 0], [2, 1]]) {
          const sw = sn(t, 1, ph) * 1.5;
          X.limb([[hx - 1 + dx, hy - 3, 0.7, 7], [hx - 4 + dx + sw, hy - 10, 0.6, 7], [hx - 7 + dx + sw * 1.5, hy - 15, 0.4, 7]], o.feelers || '#c8b8a0', 'feather');
        }
      } else {
        // The beak: hooked for a raptor, a flamingo's bent and black-tipped.
        const bc = o.beak || '#e0b040';
        if (o.longNeck) X.limb([[hx - 2, hy + 1, 1.4, 7], [hx - 6, hy + 2, 1.2, 7], [hx - 7, hy + 5, 0.7, 7]], bc, 'bone');
        else {
          X.slab([[hx - 3, hy - 1], [hx - 9, hy + 1], [hx - 10, hy + 3.4], [hx - 7, hy + 2.6], [hx - 3, hy + 2.4]], bc, 'bone', { z: 7, rz: 1.8, bevel: 1 });
        }
        if (o.crest) for (let i = 0; i < 3; i++) X.tube(hx + 2, hy - 2, hx + 6 + i * 2, hy - 6 - i * 1.6, 0.8, 0.3, o.crest, 'feather', { z: 5 });
      }
    },
    paint(P, t, st) {
      const bob = sn(t) * 1.4;
      const dive = st.wind ? 1 : 0;
      const hx = o.longNeck ? 14 + dive * 4 : 21 - dive * 2;
      const hy = o.longNeck ? 12 + bob : 24 + bob + dive * 4;
      P.eye(hx - 1.5, hy - 1, st.rage ? '#ff4030' : o.eyes || '#ffd070', true);
      if (o.paint) o.paint(P, t, st);
    },
    fx(P, t, st) {
      if (o.fx) o.fx(P, t, st);
    },
    rig: {
      behind(R) {
        wings(R, false);
        if (o.halo) {
          const ctx = R.ctx;
          const a0 = ctx.globalAlpha;
          ctx.globalAlpha = a0 * 0.8;
          for (let i = 0; i < 30; i++) {
            const a = (i / 30) * TAU + R.t * 0.6;
            ctx.fillStyle = i % 4 ? o.halo : '#ffffff';
            ctx.fillRect(Math.round(R.ox + 22 + Math.cos(a) * 12), Math.round(R.oy + 10 + Math.sin(a) * 3), 1, 1);
          }
          ctx.globalAlpha = a0;
        }
      },
      front(R) {
        wings(R, true);
      },
    },
  };
}

// A serpent: its head up on its neck out of the floor, the rest of it
// strung out behind along the way it came (the rig). `heads`: more than
// one neck (the hydra's).
function wyrm(key, o) {
  const scale = hex(o.scale);
  const belly = hex(o.belly || lite(o.scale, 1.4));
  const cfg = {
    n: o.n || 12, gap: 0.5, wave: o.wave || 3, amp: 0.22, gloss: o.gloss ?? 0.7,
    lift: (i) => Math.max(0, 3 - i) * 0.8,
    rad: (k) => (o.thin ? 0.8 : 1.2) + (o.rad || 5) * Math.pow(1 - k, 0.8),
    skin(k, u, v, ny) {
      if (ny > 0.45) return Math.floor(u / 3) % 2 ? shade(belly, 0.82) : belly;
      if (o.bands && Math.floor(u / 5) % 2) return shade(scale, 0.72);
      const r = Math.sin(u * 0.9 + v * 2 + hash2(Math.floor(u / 4), 1, 7) * 5);
      return r > 0.85 ? mix(scale, [255, 255, 255], 0.25) : r < -0.9 ? shade(scale, 0.7) : scale;
    },
    crest(i) {
      if (o.legs) {
        return part(`${key}_legs`, 12, 10, 6, 2, (X) => {
          X.limb([[6, 2, 0.7, 0], [2, 6, 0.6, 0], [1, 9, 0.4, 0]], o.legs, 'chitin');
          X.limb([[6, 2, 0.7, 0], [10, 6, 0.6, 0], [11, 9, 0.4, 0]], o.legs, 'chitin');
        });
      }
      if (!o.spines || i % 2 || i > 10) return null;
      const kk = Math.min(3, Math.floor(i / 3));
      return part(`${key}_spine${kk}`, 7, 10, 3.5, 9, (X) => {
        const h = 7.5 - kk * 1.5;
        X.slab([[1.5, 9.5], [3.2, 9.5 - h], [4.2, 9.5 - h * 0.6], [5.5, 9.5]], o.spines, o.spineMat || 'bone', { rz: 1.4, bevel: 0.8 });
      });
    },
  };
  const heads = o.heads || 1;
  return {
    w: 48, h: 50, ax: 32, ay: 48,
    sculpt(X, t, st) {
      const gape = st.wind ? 1 : 0.15 + Math.max(0, sn(t)) * 0.12;
      const mat = o.mat || 'scales';
      for (let h = 0; h < heads; h++) {
        const off = heads > 1 ? (h - 1) * 7 : 0;
        const sway = sn(t, 1, h * 1.3) * 1.5;
        const hx = 14 + off * 0.6 + sway;
        const hy = 18 + Math.abs(off) * 0.6;
        X.in(h * 3, 3);
        X.limb([[32, 48, (o.rad || 5) + 1.5, 2], [31 + off * 0.3, 38, (o.rad || 5) + 0.8, 4], [26 + off * 0.5, 28, (o.rad || 5), 6], [hx + 5, hy + 3, (o.rad || 5) - 0.6, 7]], o.scale, mat);
        X.ball(hx, hy, 7, 4.8, o.head || o.scale, mat, { rz: 5, z: 6 + h, ang: -0.15 });
        X.ball(hx - 6.5, hy + 1 + gape * 2, 4.4, 2.4, o.head || o.scale, mat, { rz: 2.6, z: 7 + h, ang: -0.1 });
        X.in(h * 3 + 1, 1.5);
        X.slab([[hx - 9, hy + 4 + gape * 3], [hx + 2, hy + 3.5], [hx + 4, hy + 6 + gape * 2], [hx - 7, hy + 7 + gape * 6]], dark(o.head || o.scale, 0.85), mat, { rz: 2, bevel: 1.2, z: 5 + h });
        X.in(h * 3 + 2, 1);
        if (o.horns) for (const s of [0, 1]) X.limb([[hx + 2, hy - 3, 1.1, 7 + s], [hx + 7, hy - 7, 0.8, 7 + s], [hx + 11, hy - 8, 0.3, 7 + s]], o.horns, 'bone');
        if (o.whiskers) for (const s of [0, 1]) X.limb([[hx - 9, hy + 1 + s, 0.4, 8], [hx - 14, hy + 4 + s * 3 + sn(t, 1, s) * 2, 0.3, 8], [hx - 18, hy + 2 + s * 4 + sn(t, 1, s + 1) * 3, 0.2, 8]], o.whiskers, 'hair');
        if (o.mane) for (let i = 0; i < 4; i++) X.tube(hx + 3 + i * 3, hy - 2 + i * 2, hx + 7 + i * 3, hy - 6 + i * 2.6, 1.4, 0.4, o.mane, 'hair', { z: 5 });
        if (o.crystals) for (let i = 0; i < 4; i++) X.tube(hx + 2 + i * 4, hy - 1 + i * 3, hx + 4 + i * 4, hy - 7 + i * 3, 1.3, 0.3, o.crystals, 'glass', { z: 6 });
      }
    },
    paint(P, t, st) {
      for (let h = 0; h < heads; h++) {
        const off = heads > 1 ? (h - 1) * 7 : 0;
        const sway = sn(t, 1, h * 1.3) * 1.5;
        P.eye(11 + off * 0.6 + sway, 16 + Math.abs(off) * 0.6, st.rage ? '#ff4030' : o.eyes || '#ffd070', true);
        if (o.blind) P.rect(10 + off * 0.6 + sway, 15 + Math.abs(off) * 0.6, 3, 2, '#e8d8c8');
      }
      if (o.paint) o.paint(P, t, st);
    },
    fx(P, t, st) {
      if (o.fx) o.fx(P, t, st);
    },
    rig: {
      under(R) {
        serpent(R, cfg, false);
      },
      over(R) {
        serpent(R, cfg, true);
      },
    },
  };
}

// A golem, or a giant: legs like pillars, a great trunk, arms hanging to
// its knees with fists like boulders, a small head sunk between its
// shoulders; seams or runes glowing in it.
function golem(o) {
  const W = 74;
  const H = 80;
  return {
    w: W, h: H, ax: 37, ay: 78,
    sculpt(X, t, st) {
      const c = o.stone;
      const mat = o.mat || 'rock';
      const b = sn(t) * 0.7;
      const up = st.wind ? 1 : 0;
      X.in(0, 3);
      // Legs.
      for (const [x, z] of [[30, -2], [44, 2]]) {
        X.limb([[x, 52, 6, z], [x - 1, 64, 5.4, z], [x, 76, 5.6, z]], z < 0 ? dark(c, 0.8) : c, mat);
        X.ball(x - 1.5, 76, 7, 2.6, dark(c, 0.7), mat, { rz: 2, z: z + 2 });
      }
      X.in(1, 3.5);
      // The trunk: a great chest, the belly under.
      X.ball(37, 38 - b, 18, 14, c, mat, { rz: 12 });
      X.ball(37, 50 - b * 0.5, 13, 8, dark(c, 0.92), mat, { rz: 9, z: 1 });
      X.ball(21, 28 - b, 8, 7, c, mat, { rz: 7, z: 3 });
      X.ball(53, 28 - b, 8, 7, c, mat, { rz: 7, z: 3 });
      // The head, sunk between them.
      X.ball(33, 22 - b, 7, 6.4, o.headCol || c, mat, { rz: 6, z: 6 });
      if (o.beard) X.ball(31, 28 - b, 6, 4.4, o.beard, 'hair', { rz: 4, z: 7 });
      if (o.moss) for (const [x, y, r] of [[21, 22, 4], [53, 22, 4], [37, 25, 5], [28, 32, 2.6]]) X.ball(x, y - b, r, r * 0.6, o.moss, o.mossMat || 'moss', { rz: r * 0.5, z: 8 });
      if (o.hump) X.ball(44, 22 - b, 12, 7, o.hump, o.humpMat || 'moss', { rz: 6, z: -2 });
      X.in(2, 2.5);
      // Arms: hanging, or raised to bring down.
      for (const [sx, near] of [[21, false], [53, true]]) {
        const z = near ? 9 : -3;
        const fx2 = up ? sx + (near ? -6 : 6) : sx + (near ? 2 : -2);
        const fy = up ? 6 : 58 + sn(t, 1, near ? 0 : 1) * 1;
        X.limb([[sx, 30 - b, 6, z], [sx + (near ? 3 : -3), up ? 18 : 44, 5.4, z], [fx2, fy, 5, z]], near ? c : dark(c, 0.82), mat);
        X.ball(fx2, fy + (up ? -2 : 3), 7, 6.4, near ? (o.fist || c) : dark(o.fist || c, 0.82), mat, { rz: 6, z: z + 1 });
      }
      if (o.extra) o.extra(X, t, st);
    },
    paint(P, t, st) {
      const b = sn(t) * 0.7;
      P.eye(30, 21 - b, st.rage ? '#ff4030' : o.eyes || '#ffd070', true);
      P.eye(35, 21 - b, st.rage ? '#ff4030' : o.eyes || '#ffd070', true);
      const g = o.glow;
      if (g && o.seams) {
        const pulse = 0.5 + 0.5 * Math.sin(t * TAU);
        const col = mix(hex(g), [255, 255, 255], pulse * 0.4);
        for (const [x0, y0, x1, y1] of [[28, 32, 34, 40], [34, 40, 31, 48], [44, 30, 41, 38], [41, 38, 46, 46], [37, 44, 37, 52]]) P.line(x0, y0 - b, x1, y1 - b, toHex(col));
      }
      if (g && o.runes) {
        for (let i = 0; i < 6; i++) {
          const on = Math.floor(t * 6 + i) % 6 < 3;
          const x = 27 + (i % 3) * 7;
          const y = 33 + Math.floor(i / 3) * 8 - b;
          const col = on ? g : dark(g, 0.5);
          P.line(x, y, x + 2, y + 3, col);
          P.line(x + 2, y, x, y + 3, col);
          P.line(x + 1, y - 1, x + 1, y + 4, col);
        }
      }
      if (o.inlay) for (let i = 0; i < 9; i++) P.rect(25 + (i % 3) * 8 + (Math.floor(i / 3) % 2) * 3, 30 + Math.floor(i / 3) * 6 - b, 2, 2, o.inlay);
      if (o.cracks) for (const [x0, y0, x1, y1] of [[26, 30, 30, 37], [30, 37, 28, 42], [46, 34, 50, 40]]) P.line(x0, y0 - b, x1, y1 - b, o.cracks);
      if (o.paint) o.paint(P, t, st);
    },
    fx(P, t, st) {
      if (o.fx) o.fx(P, t, st);
    },
  };
}

// A crab (or a crawler like one): a shell, eyes on stalks, claws, legs.
function crab(o) {
  const W = 72;
  const H = 54;
  return {
    w: W, h: H, ax: 36, ay: 52,
    sculpt(X, t, st) {
      const c = o.shell;
      const b = sn(t) * 0.6;
      const up = st.wind ? 1 : 0;
      X.in(0, 2);
      // Far legs.
      for (let i = 0; i < 3; i++) X.limb([[42 + i * 5, 36 - b, 1.8, -2], [52 + i * 5, 32 - b + sn(t, 1, i) * 1, 1.4, -2], [56 + i * 4, 50, 1, -2]], dark(c, 0.75), o.mat || 'shell');
      X.in(1, 3);
      X.ball(38, 36 - b, 20, 9, c, o.mat || 'shell', { rz: 9 });
      X.ball(38, 31 - b, 16, 6, lite(c, 1.08), o.mat || 'shell', { rz: 7, z: 2 });
      // Eyes on their stalks.
      for (const dx of [0, 5]) X.limb([[26 + dx, 30 - b, 0.9, 6], [24 + dx, 24 - b, 0.7, 6]], c, o.mat || 'shell');
      for (const dx of [0, 5]) X.ball(24 + dx, 23 - b, 1.6, 1.6, '#1a1420', 'glass', { z: 7, rz: 1.4 });
      X.in(2, 2);
      // Near legs.
      for (let i = 0; i < 3; i++) X.limb([[34 + i * 5, 40 - b, 2, 6], [30 + i * 6, 44 - b + sn(t, 1, i + 1) * 1, 1.6, 6], [28 + i * 6, 52, 1.1, 6]], c, o.mat || 'shell');
      // Claws: the near one great, raised to snap.
      for (const [near, s] of [[false, 0.8], [true, 1.15]]) {
        const z = near ? 9 : -1;
        const ex = near ? 12 : 16;
        const ey = (near ? 30 : 34) - up * 8;
        X.limb([[24, 38 - b, 2.6 * s, z], [16 + (near ? 0 : 2), 38 - up * 4, 2.2 * s, z], [ex, ey, 2 * s, z]], near ? c : dark(c, 0.82), o.mat || 'shell');
        X.ball(ex - 2, ey - 1, 5 * s, 3.6 * s, near ? c : dark(c, 0.82), o.mat || 'shell', { rz: 3 * s, z: z + 1 });
        X.slab([[ex - 6 * s, ey - 2 - up * 3], [ex - 12 * s, ey - 5 - up * 4], [ex - 11 * s, ey - 1 - up * 3], [ex - 6 * s, ey + 1]], o.claw || dark(c, 0.9), o.mat || 'shell', { z: z + 1.5, rz: 1.6, bevel: 1 });
      }
      X.in(3, 1.5);
      if (o.crown) {
        X.tube(32, 25 - b, 44, 25 - b, 1, 1, o.crown, 'gold', { z: 6 });
        for (let i = 0; i < 5; i++) X.tube(32 + i * 3, 25 - b, 32 + i * 3, 21 - b - (i % 2) * 2, 0.7, 0.25, o.crown, 'gold', { z: 6 });
      }
      if (o.stack) {
        // A sea-stack on its back: rock, ledges, turf on top.
        X.ball(44, 22 - b, 8, 10, o.stack, 'rock', { rz: 6, z: -1 });
        X.ball(46, 10 - b, 6, 8, o.stack, 'rock', { rz: 5, z: -1 });
        X.ball(46, 3 - b, 6, 2, '#5a8a3a', 'moss', { rz: 2, z: 0 });
      }
      if (o.crystals) for (const [x, h2, a] of [[30, 12, -0.4], [36, 16, -0.1], [42, 14, 0.2], [48, 10, 0.5], [39, 9, 0.1]]) {
        X.tube(x, 30 - b, x + Math.sin(a) * h2, 30 - b - h2, 2, 0.4, o.crystals, 'glass', { z: 1 });
      }
      if (o.barnacles) for (let i = 0; i < 6; i++) X.ball(28 + i * 4, 30 - b + (i % 2) * 3, 1.4, 1.2, '#e0d8cc', 'shell', { z: 9, rz: 1 });
    },
    paint(P, t, st) {
      if (o.paint) o.paint(P, t, st);
    },
    fx(P, t, st) {
      if (o.fx) o.fx(P, t, st);
    },
  };
}

// Something drifting with no legs to it: a head, arms, a body that
// trails away into rags of mist; or a hungry ghost's swollen belly on a
// thread of a neck.
function wraith(key, o) {
  const W = 56;
  const H = 68;
  return {
    w: W, h: H, ax: 28, ay: 64,
    sculpt(X, t, st) {
      const c = o.body;
      const bob = sn(t) * 1.6;
      const reach = st.wind ? 1 : 0;
      X.in(0, 3);
      if (o.belly) {
        X.ball(30, 40 + bob, 13, 12, c, 'flesh', { rz: 11 });
        X.limb([[28, 28 + bob, 1.6, 4], [25, 20 + bob, 1.4, 5], [22, 14 + bob, 1.6, 6]], c, 'flesh');
        X.ball(21, 11 + bob, 5, 5, c, 'flesh', { rz: 5, z: 6 });
      } else {
        X.slab([[20, 18 + bob], [36, 18 + bob], [40, 40 + bob], [44, 58 + bob + sn(t, 1, 1) * 2], [36, 62 + bob], [28, 58 + bob + sn(t, 1, 2) * 2], [20, 63 + bob], [16, 40 + bob]], c, 'cloth', { rz: 5, bevel: 4 });
        X.ball(26, 12 + bob, 5.4, 6, o.face || c, 'flesh', { rz: 5, z: 4 });
      }
      X.in(1, 2);
      // Arms: long, thin, reaching.
      for (const [sx, near] of [[18, false], [34, true]]) {
        const z = near ? 8 : -2;
        X.limb([[sx, 22 + bob, 1.6, z], [sx - 6 - reach * 4, 30 + bob - reach * 6, 1.2, z], [sx - 12 - reach * 6, 34 + bob - reach * 10, 0.9, z]], near ? c : dark(c, 0.8), o.belly ? 'flesh' : 'cloth');
        for (let i = 0; i < 3; i++) X.tube(sx - 12 - reach * 6, 34 + bob - reach * 10, sx - 15 - reach * 6, 35 + bob - reach * 10 + i, 0.4, 0.2, o.face || c, 'flesh', { z: z + 1 });
      }
      if (o.hair) X.ball(28, 9 + bob, 6, 4, o.hair, 'hair', { rz: 4, z: 3 });
    },
    paint(P, t, st) {
      const bob = sn(t) * 1.6;
      const hx = o.belly ? 21 : 26;
      const hy = o.belly ? 11 : 12;
      P.eye(hx - 2.5, hy + bob, o.eyes || '#e0ffff', true);
      P.eye(hx + 0.5, hy + bob, o.eyes || '#e0ffff', true);
      // The mouth: a wail, or a needle's eye.
      if (o.belly) P.rect(hx - 1, hy + 3 + bob, 1, 1, '#140c10');
      else P.rect(hx - 2, hy + 3 + bob, 3, st.wind ? 4 : 2, '#140c10');
    },
    fx(P, t) {
      for (let i = 0; i < 5; i++) {
        const k = (t + i / 5) % 1;
        P.fx(18 + i * 5 + sn(k, 1, i) * 2, 60 - k * 12, o.mist || '#e0f0ff', 0.6 * (1 - k));
      }
    },
    rig: o.hair ? {
      behind(R) {
        // Her hair streaming out behind on the wind she brings.
        for (let i = 0; i < 6; i++) {
          const pts = [];
          for (let j = 0; j <= 6; j++) {
            const f = j / 6;
            pts.push({ x: R.ox + 30 + f * 22 + Math.sin(R.t * 3 + i + f * 3) * 2 * f, y: R.oy + 8 + i * 1.2 + f * (6 + i) + Math.sin(R.t * 2 + i) * f * 2 });
          }
          drawStrand(R.ctx, pts, i % 2 ? o.hair : lite(o.hair, 1.1), 2, 1);
        }
      },
    } : undefined,
  };
}

// Shapeless things, each its own.
const BLOBS = {
  // A heart as big as a cart, red and wet, its great vessels running up
  // out of it, swelling and clenching as it beats.
  heart: {
    w: 66, h: 64, ax: 33, ay: 62,
    sculpt(X, t) {
      const k = (t * 2) % 1;
      const beat = Math.max(0, Math.sin(k * TAU * 2)) * (k < 0.5 ? 1 : 0);
      const s = 1 + beat * 0.08;
      X.in(0, 3);
      for (const [x0, x1, y1, c] of [[26, 18, 6, '#a02030'], [34, 36, 2, '#3a5a9a'], [40, 50, 8, '#a02030']]) X.limb([[x0, 24, 4, 0], [(x0 + x1) / 2, 14, 3.4, 0], [x1, y1, 3, 0]], c, 'flesh');
      X.in(1, 4);
      X.ball(25, 32, 14 * s, 13 * s, '#c02838', 'flesh', { rz: 12 });
      X.ball(41, 32, 13 * s, 12 * s, '#b02434', 'flesh', { rz: 11, z: 1 });
      X.ball(33, 46, 10 * s, 12 * s, '#a01e2e', 'flesh', { rz: 9, z: 2 });
      X.ball(33, 58, 5, 4, '#8a1a28', 'flesh', { rz: 4, z: 2 });
      X.in(2, 1.5);
      for (const [x0, y0, x1, y1] of [[18, 28, 26, 44], [30, 22, 34, 50], [44, 26, 40, 46]]) X.tube(x0, y0, x1, y1, 0.9, 0.7, '#5a3a9a', 'flesh', { z: 10 });
    },
    paint(P, t) {
      const k = (t * 2) % 1;
      if (k < 0.15) P.puff(33, 38, 14, '#ff8090', 0.25);
    },
    fx(P, t) {
      for (let i = 0; i < 3; i++) {
        const k = (t * 1.5 + i / 3) % 1;
        P.fx(20 + i * 12, 60 + k * 2, '#a8c040', 0.6 * (1 - k));
      }
    },
  },
  // An oil sac swollen near to bursting, rainbows sliding over it,
  // little eyes, feelers trailing.
  bloat: {
    w: 60, h: 64, ax: 30, ay: 62,
    sculpt(X, t) {
      const bob = sn(t) * 2;
      X.in(0, 3);
      X.ball(30, 30 + bob, 20, 18, '#4a3e2a', 'slime', { rz: 17 });
      X.ball(24, 24 + bob, 8, 6, '#6a5a3a', 'slime', { rz: 5, z: 6 });
      X.in(1, 1);
      for (let i = 0; i < 5; i++) X.limb([[18 + i * 6, 46 + bob, 1.2, 4], [17 + i * 6 + sn(t, 1, i) * 2, 54 + bob, 0.9, 4], [18 + i * 6 + sn(t, 1, i + 1) * 3, 60, 0.5, 4]], '#3a3020', 'slime');
    },
    paint(P, t) {
      const bob = sn(t) * 2;
      for (const [x, y] of [[16, 26], [21, 22], [26, 27]]) P.eye(x, y + bob, '#ffd070');
      // The sheen, sliding.
      const k = (t * 1.2) % 1;
      for (let i = 0; i < 8; i++) P.fx(14 + k * 30 + i, 18 + i * 0.6 + bob, ['#ff80c0', '#80c0ff', '#c0ff80', '#ffe080'][i % 4], 0.35);
    },
    fx(P, t) {
      const k = (t * 2) % 1;
      P.fx(40, 50 + k * 10, '#3a3020', 0.8 * (1 - k));
    },
  },
  // The kraken's spawn: a mantle, a beak, eyes like plates, eight arms
  // curling about it (the rig).
  kraken: {
    w: 70, h: 60, ax: 35, ay: 58,
    sculpt(X, t) {
      const bob = sn(t) * 1;
      X.in(0, 3);
      X.ball(38, 24 + bob, 13, 16, '#c05080', 'slime', { rz: 12, ang: 0.3 });
      X.ball(30, 38 + bob, 11, 9, '#a84070', 'slime', { rz: 9, z: 2 });
      X.in(1, 1);
      X.slab([[22, 42 + bob], [27, 41 + bob], [24, 47 + bob]], '#2a1a14', 'chitin', { z: 9, rz: 1 });
    },
    paint(P, t, st) {
      const bob = sn(t) * 1;
      P.eye(26, 34 + bob, st.rage ? '#ff4030' : '#ffe070', true);
      P.eye(34, 33 + bob, st.rage ? '#ff4030' : '#ffe070', true);
      for (let i = 0; i < 6; i++) P.fx(36 + i * 2, 16 + (i % 2) * 3 + bob, '#ffb0d0', 0.4);
    },
    rig: {
      front(R) {
        const ctx = R.ctx;
        for (let i = 0; i < 8; i++) {
          const near = i % 2 === 0;
          const a0 = Math.PI * 0.5 + (i - 3.5) * 0.32;
          const pts = curl(R.ox + 30 + (i - 3.5) * 2.6, R.oy + 44, a0, 9, 2.4, R.t, i * 0.9, 0.42);
          drawStrand(ctx, pts, near ? '#c05080' : '#8a3060', 4, 1, { alpha: near ? 1 : 0.85 });
        }
      },
    },
  },
  // The thing below: a mass rising out of the floor, mouths and eyes all
  // over it, tendrils feeling about.
  thing: {
    w: 74, h: 66, ax: 37, ay: 64,
    sculpt(X, t) {
      const b = sn(t) * 1.2;
      X.in(0, 4);
      X.ball(37, 50, 26, 14, '#3a2a48', 'flesh', { rz: 10 });
      X.ball(36, 34 + b, 18, 16, '#4a3458', 'flesh', { rz: 14, z: 2 });
      X.ball(28, 22 + b, 9, 8, '#5a4068', 'flesh', { rz: 8, z: 5 });
      X.in(1, 1.5);
      for (let i = 0; i < 6; i++) {
        const a = -Math.PI + (i / 5) * Math.PI;
        const sw = sn(t, 1, i) * 2;
        X.limb([[37 + Math.cos(a) * 18, 40 + Math.sin(a) * 10 + b, 2, 3], [37 + Math.cos(a) * 28 + sw, 30 + Math.sin(a) * 14 + b, 1.4, 3], [37 + Math.cos(a) * 34 + sw * 1.5, 22 + Math.sin(a) * 16 + b, 0.6, 3]], '#5a4068', 'flesh');
      }
    },
    paint(P, t, st) {
      const b = sn(t) * 1.2;
      const eyes = [[24, 20], [31, 18], [28, 26], [40, 30], [46, 36], [34, 38], [22, 40], [50, 46]];
      eyes.forEach(([x, y], i) => {
        const open = Math.floor(t * 8 + i * 3) % 7 !== 0;
        if (open) P.eye(x, y + b, st.rage ? '#ff4030' : '#ffe070', i < 2);
        else P.rect(x - 1, y + b, 3, 1, '#2a1a30');
      });
    },
    fx(P, t) {
      for (let i = 0; i < 4; i++) {
        const k = (t + i / 4) % 1;
        P.fx(16 + i * 14, 56 - k * 8, '#a060c0', 0.6 * (1 - k));
      }
    },
  },
  // A heap of bones that moves as one, every bone carved with names in
  // blue ink, the carvings glowing one after another.
  scrimshaw: {
    w: 70, h: 66, ax: 35, ay: 64,
    sculpt(X, t, st) {
      const b = sn(t) * 0.8;
      const up = st.wind ? 1 : 0;
      X.in(0, 3);
      X.ball(36, 46, 22, 15, '#e0d8c4', 'bone', { rz: 12 });
      X.ball(34, 30 + b, 15, 13, '#e8e0cc', 'bone', { rz: 11, z: 2 });
      X.ball(24, 18 + b, 8, 7, '#f0e8d8', 'bone', { rz: 7, z: 5 });
      X.in(1, 1);
      for (let i = 0; i < 9; i++) {
        const a = hash2(i, 3, 5) * TAU;
        const r = 10 + hash2(i, 7, 1) * 10;
        X.tube(36 + Math.cos(a) * r, 40 + Math.sin(a) * r * 0.5 + b, 36 + Math.cos(a + 1) * (r + 6), 40 + Math.sin(a + 1) * (r + 6) * 0.5 + b, 1.4, 0.9, i % 2 ? '#f0e8d8' : '#d8ccb4', 'bone', { z: 8 });
      }
      // Arms of rib, raised as it comes on.
      for (const [sx, near] of [[16, false], [52, true]]) X.limb([[sx, 32 + b, 2.6, near ? 9 : -1], [sx + (near ? 6 : -6), 22 - up * 10 + b, 2, near ? 9 : -1], [sx + (near ? 4 : -10), 12 - up * 12 + b, 1.2, near ? 9 : -1]], '#e8e0cc', 'bone');
    },
    paint(P, t) {
      const b = sn(t) * 0.8;
      P.rect(20, 16 + b, 2, 2, '#140c10');
      P.rect(25, 16 + b, 2, 2, '#140c10');
      P.set(20, 16 + b, hex('#5a9ad8'));
      P.set(26, 16 + b, hex('#5a9ad8'));
      for (let i = 0; i < 8; i++) {
        const on = Math.floor(t * 8) % 8 === i;
        const x = 22 + (i % 4) * 7;
        const y = 30 + Math.floor(i / 4) * 12 + b;
        P.line(x, y, x + 4, y + 1, on ? '#a0e0ff' : '#3a6a9a');
        P.line(x, y + 2, x + 3, y + 3, on ? '#a0e0ff' : '#3a6a9a');
      }
    },
  },
  // A bronze bell from a drowned kirk, green with the sea, weed hanging off
  // its lip, the clapper swinging inside; it hangs in the air and tolls.
  bell: {
    w: 56, h: 66, ax: 28, ay: 64,
    sculpt(X, t, st) {
      const sw = sn(t, 0.5) * 0.12 + (st.wind ? 0.2 : 0);
      X.in(0, 3);
      X.slab([[20, 12], [36, 12], [40, 26], [46, 46], [48, 52], [8, 52], [10, 46], [16, 26]], '#a88838', 'gold', { rz: 10, bevel: 8, ang: sw });
      X.ball(28, 10, 7, 4, '#a88838', 'gold', { rz: 4, z: 2 });
      X.tube(8, 52, 48, 52, 2.2, 2.2, '#c8a848', 'gold', { z: 6 });
      X.in(1, 1);
      for (let i = 0; i < 6; i++) X.limb([[10 + i * 7, 52, 0.8, 8], [10 + i * 7 + sn(t, 1, i), 58, 0.6, 8], [11 + i * 7 + sn(t, 1, i + 1) * 1.5, 62, 0.4, 8]], '#3a6a3a', 'moss');
      X.ball(28 + sn(t, 1) * 4, 56, 3, 3, '#6a5a2a', 'metal', { z: -2, rz: 2 });
    },
    paint(P) {
      // Verdigris.
      for (let i = 0; i < 18; i++) P.fx(12 + hash2(i, 1, 1) * 32, 16 + hash2(i, 2, 2) * 34, '#5aa890', 0.5);
    },
    fx(P, t, st) {
      if (st.wind) for (let i = 0; i < 3; i++) P.fx(28 + (i - 1) * 16, 30, '#fff0b0', 0.6);
      for (let i = 0; i < 3; i++) {
        const k = (t * 1.6 + i / 3) % 1;
        P.fx(14 + i * 14, 54 + k * 10, '#80c8e8', 0.7 * (1 - k));
      }
    },
  },
};

const snowFx = (P, t, st, S, W, H) => {
  for (let i = 0; i < 5; i++) {
    const k = (t + i / 5) % 1;
    P.fx(W * (0.2 + i * 0.15), H * 0.2 + k * H * 0.7, '#ffffff', 0.7 * (1 - k));
  }
};
const glowFx = (col) => (P, t, st, S, W, H) => {
  for (let i = 0; i < 6; i++) {
    const a = t * TAU + (i / 6) * TAU;
    P.fx(W / 2 + Math.cos(a) * W * 0.38, H * 0.45 + Math.sin(a) * H * 0.2, col, 0.7);
  }
};

addBeasts({
  // ---- Velmarch.
  barrow_mammoth: quad({ k: 1.25, coat: '#7a6a5a', head: 'mammoth', heavy: 1.2, legs: 16, tusk: '#f0ecdc', shaggy: true, eyes: '#a0e8ff', fx: snowFx }),
  bronze_wolf: quad({ k: 1.1, coat: '#c08038', mat: 'metal', head: 'canine', eyes: '#ffe080', belly: '#d8a050', tailLen: 14, fx: glowFx('#ffd090') }),
  silver_wyrm: wyrm('silver_wyrm', { scale: '#c8d0dc', belly: '#f0f4f8', mat: 'metal', gloss: 1, spines: '#e8f0ff', spineMat: 'metal', eyes: '#80e0ff', rad: 5.4 }),
  marble_colossus: golem({ stone: '#ece8e0', mat: 'rock', eyes: '#ffe080', glow: '#ffd060', seams: true, cracks: '#c8a040' }),
  war_eagle: bird('war_eagle', { body: '#8a5a2a', breast: '#a87a3a', headCol: '#f0ece0', neck: '#f0ece0', wing: '#7a4a24', tips: '#3a2414', beak: '#f0c040', legs: '#f0c040', eyes: '#ffd040' }),
  // ---- Ostria.
  skinwalker: quad({ k: 1.05, coat: '#8a7058', head: 'canine', legs: 17, mask: '#e8e0cc', antlers: '#d8ccb0', eyes: '#ff4030', belly: '#6a5040', tailLen: 10 }),
  turquoise_golem: golem({ stone: '#b8603a', mat: 'rock', eyes: '#40e0d0', inlay: '#40d0c8', glow: '#40e0d0', seams: true }),
  great_centipede: wyrm('great_centipede', { scale: '#a83418', belly: '#e0a040', mat: 'chitin', legs: '#e08030', bands: true, eyes: '#ffe060', rad: 4.2, n: 14, gloss: 0.9 }),
  nine_tailed_fox: quad({ k: 1.1, coat: '#e08030', head: 'fox', tails: 9, tailLen: 15, tailW: 1.8, tailTip: '#fff8e8', belly: '#fff0d8', eyes: '#ffe080', fx: glowFx('#ffb040') }),
  hungry_ghost: wraith('hungry_ghost', { body: '#90b8a0', belly: true, eyes: '#e0fff0', mist: '#a0e0c0' }),
  thunderbird: bird('thunderbird', { body: '#2a3a7a', breast: '#c83a2a', headCol: '#2a3a7a', wing: '#1e2a6a', tips: '#e0b030', beak: '#e0b030', crest: '#e0b030', eyes: '#ffffff', fx: (P, t) => {
    const k = Math.floor(t * 12) % 6;
    if (k < 2) for (let i = 0; i < 5; i++) P.fx(30 + i * 3 - k * 4, 8 + i * 4, '#ffffff', 0.9);
  } }),
  jade_dragon: wyrm('jade_dragon', { scale: '#40b878', belly: '#e8d070', mat: 'scales', horns: '#f0e8c8', whiskers: '#e8d070', mane: '#e0c050', spines: '#e0c050', eyes: '#ffe060', gloss: 0.9, rad: 5 }),
  // ---- Corrow.
  carrion_roc: bird('carrion_roc', { body: '#3a3028', breast: '#5a4a3a', headCol: '#c87a6a', neck: '#c87a6a', bald: true, wing: '#2e2620', tips: '#14100c', beak: '#d8c8a0', legs: '#8a7a6a', eyes: '#ffd040' }),
  scrimshaw_horror: BLOBS.scrimshaw,
  oil_bloat: BLOBS.bloat,
  kraken_spawn: BLOBS.kraken,
  bull_walrus: quad({ k: 1.3, coat: '#a07860', head: 'walrus', heavy: 1.6, legs: 6, noLegs: true, ears: false, tusk: '#f4ecdc', eyes: '#3a2a20', tails: 0 }),
  leviathan_heart: BLOBS.heart,
  gut_wyrm: wyrm('gut_wyrm', { scale: '#d8b8a0', belly: '#f0d8c8', mat: 'flesh', bands: true, eyes: '#a8c040', blind: true, rad: 5.4, gloss: 1 }),
  // ---- Saltmere.
  brine_crab_king: crab({ shell: '#e06040', claw: '#c84030', crown: '#f0f0f8', barnacles: true }),
  crystal_matriarch: crab({ shell: '#d8d0e8', mat: 'glass', claw: '#c8b8e8', crystals: '#ffffff', fx: glowFx('#e0d0ff') }),
  salt_wyrm: wyrm('salt_wyrm', { scale: '#f0ece8', belly: '#ffffff', mat: 'rock', crystals: '#ffffff', spines: '#ffffff', spineMat: 'glass', eyes: '#f0a8c8', rad: 5.2 }),
  flamingo_seraph: bird('flamingo_seraph', { body: '#ff90b8', breast: '#ffb8d0', headCol: '#ff9ac0', neck: '#ff9ac0', wing: '#ff80b0', tips: '#1a1420', beak: '#2a2020', longNeck: true, longLegs: '#e07090', extraWings: true, halo: '#fff0a0', eyes: '#ffffff' }),
  lagoon_hydra: wyrm('lagoon_hydra', { scale: '#3a9098', belly: '#ff9ac0', mat: 'scales', heads: 3, eyes: '#ffe060', rad: 4, gloss: 1 }),
  mirage_lion: quad({ k: 1.15, coat: '#e0b060', head: 'cat', mane: '#c87a30', belly: '#f0d8a0', tailTip: '#8a4a20', eyes: '#ffe080', fx: (P, t, st, S, W, H) => {
    for (let i = 0; i < 6; i++) {
      const k = (t * 2 + i / 6) % 1;
      P.fx(W * 0.15 + i * W * 0.13, H * 0.85 - k * H * 0.3, '#fff8e0', 0.4 * (1 - k));
    }
  } }),
  // ---- Hollowmark.
  mole_king: quad({ k: 1.15, coat: '#5a4a48', head: 'mole', heavy: 1, legs: 8, claws: '#e8e0cc', crown: '#e0c050', eyes: false, tails: 1, tailLen: 6, tailW: 0.8 }),
  glowworm_queen: wyrm('glowworm_queen', { scale: '#5a8aa0', belly: '#c8f0ff', mat: 'slime', eyes: '#c8ffff', rad: 4.6, gloss: 1, fx: (P, t) => {
    for (let i = 0; i < 7; i++) {
      const k = (t + i / 7) % 1;
      P.fx(8 + i * 5, 26 + k * 20, '#80e8ff', 0.8 * (1 - k));
    }
  } }),
  deep_golem: golem({ stone: '#4a4048', mat: 'rock', eyes: '#ffb040', glow: '#ff8020', seams: true }),
  moth_queen: bird('moth_queen', { moth: true, body: '#a87830', headCol: '#c89040', wing: '#e0a030', spot: '#2a1a0a', spot2: '#ffe060', feelers: '#e0c070', eyes: '#1a1420', fx: (P, t) => {
    for (let i = 0; i < 6; i++) {
      const k = (t + i / 6) % 1;
      P.fx(20 + i * 5, 40 + k * 18, '#ffd070', 0.7 * (1 - k));
    }
  } }),
  cave_bear: quad({ k: 1.3, coat: '#6a5038', head: 'bear', heavy: 1.4, legs: 13, eyes: '#ffb040', tails: 0, belly: '#5a4430' }),
  first_digger: quad({ k: 1.35, coat: '#b88a7a', mat: 'skin', head: 'mole', heavy: 1.2, legs: 9, claws: '#f0e8d8', eyes: false, tails: 1, tailLen: 8, tailW: 1, fx: (P, t, st, S, W, H) => {
    for (let i = 0; i < 4; i++) {
      const k = (t + i / 4) % 1;
      P.fx(W * 0.15 + i * 5, H - 4 - k * 6, '#7a5a3a', 0.8 * (1 - k));
    }
  } }),
  thing_below: BLOBS.thing,
  // ---- the Wyrd Isle.
  rune_golem: golem({ stone: '#8a8a86', mat: 'rock', eyes: '#80e8ff', glow: '#80e8ff', runes: true, moss: '#5a7a4a' }),
  ninth_wyrm: wyrm('ninth_wyrm', { scale: '#4a3a7a', belly: '#a0ffd0', mat: 'scales', horns: '#c8c0b0', spines: '#a0ffd0', eyes: '#a0ffd0', rad: 5.2, gloss: 0.8 }),
  banshee: wraith('banshee', { body: '#c8d8e8', face: '#e0e8f0', hair: '#f0f4f8', eyes: '#80ffff', mist: '#e0f0ff' }),
  white_hart: quad({ k: 1.15, coat: '#f4f4f0', head: 'deer', legs: 19, antlers: '#f8f0d8', eyes: '#80ffd0', hoof: '#c8c8b8', belly: '#ffffff', tailLen: 5, fx: glowFx('#c8ffe8') }),
  hill_sleeper: golem({ stone: '#6a7a4a', mat: 'moss', mossMat: 'moss', eyes: '#c8a0ff', moss: '#5a8a3a', hump: '#4a7a32', glow: '#c8a0ff', runes: true }),
  // ---- the Grey Skerries.
  storm_giant: golem({ stone: '#7a8a9a', mat: 'skin', headCol: '#8a9aa8', beard: '#c8d8e8', eyes: '#e0e8ff', glow: '#c8d8ff', seams: true, fx: (P, t) => {
    for (let i = 0; i < 5; i++) P.puff(22 + i * 8, 6 + Math.sin(t * TAU + i) * 2, 5, '#6a7a8a', 0.4);
    if (Math.floor(t * 12) % 7 === 0) for (let i = 0; i < 6; i++) P.fx(30 + i * 2, 4 + i * 3, '#ffffff', 0.9);
  } }),
  stack_crab: crab({ shell: '#8a8a7a', claw: '#e08060', stack: '#7a7a72', barnacles: true }),
  storm_petrel: bird('storm_petrel', { body: '#5a6070', breast: '#e0e4ec', headCol: '#3a4050', wing: '#3a4050', tips: '#1a1e24', beak: '#2a2a30', legs: '#2a2a30', eyes: '#ffffff', fx: (P, t) => {
    for (let i = 0; i < 4; i++) {
      const k = (t * 2 + i / 4) % 1;
      P.fx(56 - k * 50, 20 + i * 8, '#c8e0f0', 0.6 * (1 - k));
    }
  } }),
  drowned_bell: BLOBS.bell,
  sea_trow: golem({ stone: '#5a8a6a', mat: 'skin', headCol: '#6a9a7a', eyes: '#e0f0ff', moss: '#2a5a3a', mossMat: 'moss', beard: '#3a6a4a', fx: (P, t) => {
    for (let i = 0; i < 5; i++) {
      const k = (t * 1.4 + i / 5) % 1;
      P.fx(22 + i * 8, 50 + k * 20, '#80c8e8', 0.7 * (1 - k));
    }
  } }),
});
