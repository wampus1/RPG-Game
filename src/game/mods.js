// What a piece's modifiers do (what they are, and how a piece comes by
// them: see world/quality.js), in a blade, a bow, a shield, armour or a
// tool. Yours: the island's folk keep to plain gear.
import { ITEMS } from '../world/items.js';
import { B, BLOCKS, LOGS } from '../world/blocks.js';
import { RECIPES } from '../world/recipes.js';
import { burn, chill, mend, stun, knockBack } from './gems.js';

const WORN = ['head', 'body', 'legs', 'feet'];
const EMPTY = Object.freeze({ blade: [], bow: [], shield: [], tool: [], armor: {} });
const POISON = ['#8ac040', '#c8f070', '#5a8a20'];
const FIRE = ['#ff6030', '#ffb040', '#fff0a0'];
const FROST = ['#a0d8ff', '#e0f4ff', '#60a0ff'];

// The modifiers someone has about them: on the blade, bow or tool in their
// hand, on their shield, and on the armour they wear (counted, piece by
// piece).
export function modsOf(e) {
  if (!e || e.kind !== 'player') return EMPTY;
  const held = e.heldItem ? e.heldItem() : null;
  const eq = e.equip || {};
  const key = `${held || ''}|${eq.shield || ''}|${WORN.map((k) => eq[k] || '').join('|')}`;
  if (e._modsKey === key) return e._mods;
  const out = { blade: [], bow: [], shield: [], tool: [], armor: {} };
  const h = held && ITEMS[held];
  if (h && h.mods && out[h.gear]) out[h.gear] = h.mods;
  const sh = eq.shield && ITEMS[eq.shield];
  if (sh && sh.gear === 'shield') out.shield = sh.mods;
  for (const slot of WORN) {
    const it = eq[slot] && ITEMS[eq[slot]];
    if (it && it.gear === 'armor') for (const m of it.mods) out.armor[m] = (out.armor[m] || 0) + 1;
  }
  e._modsKey = key;
  e._mods = out;
  return out;
}

// Has it (and for armour, on how many pieces)?
export function hasMod(e, kind, m) {
  const ms = modsOf(e);
  return kind === 'armor' ? ms.armor[m] || 0 : ms[kind].includes(m);
}

// ------------------------------------------------------------ a blade
// More of your blows strike true.
export function critBonus(e) {
  return hasMod(e, 'blade', 'keen') ? 0.15 : 0;
}

// Half again as hard on a foe worn down to a third.
export function bladeMult(e, t) {
  return t && hasMod(e, 'blade', 'merciless') && t.hp <= (t.maxHp || t.hp) / 3 ? 1.5 : 1;
}

// Swung quicker.
export function swingModMult(e) {
  return hasMod(e, 'blade', 'swift') ? 0.8 : 1;
}

// A blow of yours has landed.
export function onBladeMods(game, a, t) {
  const ms = modsOf(a).blade;
  if (!ms.length || !t || t.dead) return;
  const r = game.renderer;
  if (ms.includes('venom')) {
    t.poisonT = Math.max(t.poisonT || 0, 4);
    t.poisonSrc = a;
    r.emit(t.x, t.y + 1, t.z, { n: 5, color: POISON, up: 14, speed: 16, life: 0.6, gravity: -6 });
  }
  if (ms.includes('searing') && Math.random() < 1 / 3) {
    burn(game, t, a, 2);
    r.emit(t.x, t.y + 1, t.z, { n: 7, color: FIRE, up: 26, speed: 26, life: 0.45, oy: -6 });
  }
  if (ms.includes('frost')) {
    chill(t, 2);
    r.emit(t.x, t.y + 1, t.z, { n: 5, color: FROST, up: 16, speed: 24, life: 0.5, shape: 'star', oy: -6 });
  }
  if (ms.includes('thirst') && Math.random() < 0.25) mend(game, a, 1);
  if (ms.includes('brutal') && !t.foot) {
    knockBack(game, a, t, 1);
    stun(t, 0.4);
  }
}

// ------------------------------------------------------------ a bow
// How long a draw takes (a quick-drawn bow, a third less).
export function drawModMult(e) {
  return hasMod(e, 'bow', 'quick') ? 0.67 : 1;
}

// Is this shot free (a thrifty bow, one in three)?
export function thriftyShot(e) {
  return hasMod(e, 'bow', 'thrifty') && Math.random() < 1 / 3;
}

// How fast an arrow flies (far-flying: quicker).
export function arrowModSpeed(e) {
  return hasMod(e, 'bow', 'far') ? 0.75 : 1;
}

// A twin-strung bow: two more arrows with each, fanned out either side,
// half as hard.
export function twinShot(game, from, aim, o, shoot) {
  if (o.split || o.twin || !hasMod(from, 'bow', 'twin')) return;
  const ang = Math.atan2(aim.z - from.z, aim.x - from.x);
  const d = Math.max(3, Math.hypot(aim.x - from.x, aim.z - from.z));
  for (const s of [-0.2, 0.2]) shoot(game, from, { x: from.x + Math.cos(ang + s) * d, z: from.z + Math.sin(ang + s) * d }, { ...o, twin: true, dmg: Math.max(1, Math.round(o.dmg * 0.5)) });
}

// An arrow of yours has come down (on someone, if `hit`).
export function onArrowMods(game, a, hit) {
  const ms = a.mods;
  if (!ms || !ms.length) return;
  const t = a.target;
  const r = game.renderer;
  if (hit && t && !t.dead) {
    if (ms.includes('fire')) {
      burn(game, t, a.from, 3);
      r.emit(t.x, t.y + 1, t.z, { n: 8, color: FIRE, up: 30, speed: 30, life: 0.45, oy: -6 });
    }
    if (ms.includes('rime')) {
      chill(t, 3);
      r.emit(t.x, t.y + 1, t.z, { n: 6, color: FROST, up: 16, speed: 24, life: 0.5, shape: 'star', oy: -6 });
    }
    if (ms.includes('barbed')) {
      t.poisonT = Math.max(t.poisonT || 0, 5);
      t.poisonSrc = a.from;
    }
  }
  // Piercing: on through whoever it struck, into whoever stands behind
  // (a couple of paces).
  if (hit && t && ms.includes('piercing') && a.ux !== undefined && !a.pierced) {
    a.pierced = true;
    const d0 = Math.hypot(t.x - a.x0, t.z - a.z0);
    for (let k = d0 + 0.5; k <= d0 + 2.5; k += 0.5) {
      const x = Math.round(a.x0 + a.ux * k);
      const z = Math.round(a.z0 + a.uz * k);
      const v = [...game.npcs, ...game.creatures, ...game.everyone()].find((e) => e && e !== t && e !== a.from && !e.dead && !e.down && e.x === x && e.z === z && Math.abs(e.y - t.y) <= 1);
      if (!v) continue;
      game.damage(v, Math.max(1, Math.round(a.dmg * 0.7)), a.from);
      r.floatText(v.x, v.y + 2.4, v.z, 'pierced!', '#e8d8b0');
      break;
    }
  }
}

// ------------------------------------------------------------ a shield
// How much breath holding it up costs (a light one, a third less).
export function blockModMult(e) {
  return hasMod(e, 'shield', 'light') ? 0.67 : 1;
}

// A wider moment to parry.
export function parryModBonus(e) {
  return hasMod(e, 'shield', 'duel') ? 0.08 : 0;
}

// A blow turned on your shield (`turned`: how much of it).
export function onBlockMods(game, v, a, parry = false, turned = 1) {
  const ms = modsOf(v).shield;
  if (!ms.length || !a || a.dead) return;
  const r = game.renderer;
  if (ms.includes('thorns') && !a.thorned) {
    a.thorned = true;
    game.damage(a, Math.max(1, Math.round((parry ? 3 : turned) / 3)), v);
    a.thorned = false;
    r.emit(a.x, a.y + 1, a.z, { n: 6, color: ['#c8a070', '#ffffff'], up: 20, speed: 30, life: 0.35 });
  }
  if (ms.includes('repel') && !a.foot) knockBack(game, v, a, 1);
  if (ms.includes('smoulder') && (parry || Math.random() < 0.5)) {
    burn(game, a, v, 2);
    r.emit(a.x, a.y + 1, a.z, { n: 6, color: FIRE, up: 24, speed: 24, life: 0.4, oy: -6 });
  }
  if (ms.includes('rally')) {
    v.stamina = Math.min(v.maxStamina || 6, (v.stamina || 0) + 1);
    if (parry) mend(game, v, 1);
  }
}

// An arrow caught on an arrow-catching shield: into your quiver.
export function catchArrow(game, t, a) {
  if (!a || a.kind !== 'arrow' || !hasMod(t, 'shield', 'catch')) return false;
  if (t.give && t.give('arrow', 1) === 0) {
    game.renderer.floatText(t.x, t.y + 2.4, t.z, '+1 arrow', '#e8d8b0');
    return true;
  }
  return false;
}

// ------------------------------------------------------------ armour
// How long each pace takes (fleet armour: a little less, piece by piece).
export function stepModMult(e) {
  const n = hasMod(e, 'armor', 'fleet');
  return n ? 1 / (1 + Math.min(0.18, 0.06 * n)) : 1;
}

// Health from hale armour.
export function gearHp(e) {
  return 2 * hasMod(e, 'armor', 'hale');
}

// Fireproof: the fire on you bites half as often.
export function burnModSlow(e) {
  return hasMod(e, 'armor', 'fireproof') ? 2 : 1;
}

// Fur-lined: cold slows you half as long.
export function chillModMult(e) {
  return hasMod(e, 'armor', 'furred') ? 0.5 : 1;
}

// Featherweight: a roll costs less breath.
export function rollModMult(e) {
  const n = hasMod(e, 'armor', 'feather');
  return n ? Math.max(0.55, 1 - 0.2 * n) : 1;
}

// Tireless: your breath comes back quicker.
export function breathModMult(e) {
  const n = hasMod(e, 'armor', 'tireless');
  return n ? 1 + Math.min(0.5, 0.2 * n) : 1;
}

// Spiked: struck up close, the one who struck you takes a point back.
export function onStruckMods(game, wearer, attacker) {
  if (!attacker || attacker.dead || attacker === wearer || attacker.thorned) return;
  if (!hasMod(wearer, 'armor', 'spiked')) return;
  if (Math.max(Math.abs(attacker.x - wearer.x), Math.abs(attacker.z - wearer.z)) > 1 + (attacker.foot || 0)) return;
  attacker.thorned = true;
  game.damage(attacker, 1, wearer);
  attacker.thorned = false;
}

// ------------------------------------------------------------ a tool
// What a log is sawn into (as the recipes have it: four planks of its
// wood).
let PLANKS = null;
function planksOf(log) {
  if (!PLANKS) {
    PLANKS = {};
    for (const r of RECIPES) {
      const ins = Object.keys(r.in || {});
      if (r.station === 'hand' && ins.length === 1 && ins[0].startsWith('log_') && r.out.startsWith('planks')) PLANKS[ins[0]] = [r.out, r.n];
    }
  }
  return PLANKS[log] || null;
}
const SMELTS = { iron_ore: 'iron_ingot', gold_ore: 'gold_ingot' };
const STONY = new Set(['stone', 'cobblestone', 'basalt', 'deepslate', 'granite', 'sandstone', 'mine_rock', 'cave_rock']);

// A block you've broken with a tool in hand: what comes of it (smelted,
// doubled, a find in the rubble, logs sawn into planks). `drops`, as
// breakBlock gathered them, changed in place.
export function toolDrops(game, p, id, drops) {
  const ms = modsOf(p).tool;
  if (!ms.length || !drops.length) return;
  const b = BLOCKS[id];
  if (ms.includes('smelting')) {
    for (const d of drops) if (SMELTS[d.item]) d.item = SMELTS[d.item];
  }
  if (ms.includes('sawing') && LOGS.has(id)) {
    for (const d of drops) {
      const pl = planksOf(d.item);
      if (pl) {
        d.item = pl[0];
        d.count *= pl[1];
      }
    }
  }
  if (ms.includes('prospect') && b && b.tool === 'pick' && STONY.has(b.name) && Math.random() < 0.12) {
    const find = Math.random() < 0.15 ? 'gem' : Math.random() < 0.5 ? 'coal' : 'iron_ore';
    drops.push({ item: ms.includes('smelting') && SMELTS[find] ? SMELTS[find] : find, count: 1 });
    game.renderer.floatText(p.x, p.y + 2.4, p.z, `found ${ITEMS[find] ? ITEMS[find].name.toLowerCase() : find}!`, '#ffe070');
  }
  if (ms.includes('fortune') && Math.random() < 0.2 && b && b.interact !== 'container') {
    for (const d of [...drops]) drops.push({ ...d });
    game.renderer.emit(p.x, p.y + 1.6, p.z, { n: 6, color: ['#ffe070', '#ffffff'], up: 20, speed: 20, life: 0.5, shape: 'star', glow: true });
  }
}

// A wide pick or shovel: the block over the one you've dug comes out too.
export function wideDig(game, p, x, y, z) {
  if (!hasMod(p, 'tool', 'wide') || game.wideDigging) return;
  const above = game.world.getBlock(x, y + 1, z);
  const b = BLOCKS[above];
  if (above === B.air || !b || !b.solid || !isFinite(b.hardness) || b.interact || b.liquid) return;
  const held = p.heldDef && p.heldDef();
  if (!held || held.tool !== b.tool) return;
  game.wideDigging = true;
  try {
    game.breakBlock(x, y + 1, z, true);
  } finally {
    game.wideDigging = false;
  }
}
