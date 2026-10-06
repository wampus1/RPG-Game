// What a piece's modifiers do (what they are, and how a piece comes by
// them: see world/quality.js), in a blade, a bow, a shield, armour or a
// tool. Yours: the island's folk keep to plain gear.
import { ITEMS } from '../world/items.js';
import { B, BLOCKS, LOGS } from '../world/blocks.js';
import { burn, chill, mend, stun, knockBack, bleed } from './gems.js';
import { has as heroHas } from './hero.js';
import { dishFx } from './cooking.js';

const WORN = ['head', 'body', 'legs', 'feet'];
const EMPTY = Object.freeze({ blade: [], bow: [], shield: [], tool: [], armor: {} });
const POISON = ['#8ac040', '#c8f070', '#5a8a20'];
const FIRE = ['#ff6030', '#ffb040', '#fff0a0'];
const FROST = ['#a0d8ff', '#e0f4ff', '#60a0ff'];
const JADE = ['#60c890', '#a0f0c0', '#e0fff0'];
const SALT = ['#ffffff', '#f0e8f0', '#e0d8e8'];
const RUNE = ['#80e8ff', '#e0ffff', '#3080c0'];
const STORM = ['#ffffff', '#c8d8ff', '#6080ff'];

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
// (Round 68: Legion-forged, half again as hard on a foe mid-blow;
// Lantern-lit, a third harder on the dead.)
export function bladeMult(e, t) {
  let k = t && hasMod(e, 'blade', 'merciless') && t.hp <= (t.maxHp || t.hp) / 3 ? 1.5 : 1;
  if (t && t.windup && hasMod(e, 'blade', 'legion')) k *= 1.4;
  if (t && t.S && t.S.undead && hasMod(e, 'blade', 'lantern')) k *= 1.33;
  return k;
}

// Swung quicker.
export function swingModMult(e) {
  return hasMod(e, 'blade', 'swift') ? 0.8 : 1;
}

// A blow of yours has landed.
export function onBladeMods(game, a, t) {
  const ms = modsOf(a).blade;
  if (!ms.length || !t) return;
  // (Jade-set: a foe it fells mends you.)
  if (t.dead) {
    if (ms.includes('jade')) jadeMend(game, a, t, 2);
    return;
  }
  const r = game.renderer;
  landBlade(game, a, t, ms);
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
  if (hit && t) landArrow(game, a, t, ms);
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
  landShield(game, v, a, ms, parry);
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
  // (And a dish that quickens you, or weighs you down: see cooking.js.)
  const d = e && e.kind === 'player' ? Math.max(-0.4, Math.min(0.4, dishFx(e, 'speed'))) : 0;
  return (n ? 1 / (1 + Math.min(0.18, 0.06 * n)) : 1) / (1 + d);
}

// Health from hale armour.
export function gearHp(e) {
  return 2 * hasMod(e, 'armor', 'hale');
}

// Fireproof: the fire on you bites half as often.
// (And a fire-hardened hide, as much again.)
export function burnModSlow(e) {
  const d = e && e.kind === 'player' ? Math.min(0.8, Math.max(0, dishFx(e, 'heatproof'))) : 0;
  return ((hasMod(e, 'armor', 'fireproof') ? 2 : 1) * (heroOf(e, 'fire_hardened') ? 2 : 1)) / (1 - d);
}

// Fur-lined: cold slows you half as long.
// (Northern blood: as much again.)
export function chillModMult(e) {
  if (hasMod(e, 'armor', 'legion')) return chillBase(e) * 0.75;
  return chillBase(e);
}
function chillBase(e) {
  const d = e && e.kind === 'player' ? Math.min(0.8, Math.max(0, dishFx(e, 'coldproof'))) : 0;
  return (hasMod(e, 'armor', 'furred') ? 0.5 : 1) * (heroOf(e, 'northern_blood') ? 0.5 : 1) * (1 - d);
}

// A player's own trait (with others playing: theirs, see game/party.js).
function heroOf(e, k) {
  return !!(e && e.kind === 'player' && e.game && heroHas(e.game.hero, k));
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
  // (Storm-touched armour: now and then, lightning into whoever struck up
  // close.)
  const st = hasMod(wearer, 'armor', 'storm');
  if (st && Math.random() < 0.12 * st && Math.max(Math.abs(attacker.x - wearer.x), Math.abs(attacker.z - wearer.z)) <= 1 + (attacker.foot || 0)) {
    attacker.thorned = true;
    lightning(game, wearer, attacker, 2);
    attacker.thorned = false;
  }
  if (!hasMod(wearer, 'armor', 'spiked')) return;
  if (Math.max(Math.abs(attacker.x - wearer.x), Math.abs(attacker.z - wearer.z)) > 1 + (attacker.foot || 0)) return;
  attacker.thorned = true;
  game.damage(attacker, 1, wearer);
  attacker.thorned = false;
}

// ------------------------------------------------------------ a tool
const SMELTS = { iron_ore: 'iron_ingot', gold_ore: 'gold_ingot' };
const STONY = new Set(['stone', 'cobblestone', 'basalt', 'deepslate', 'granite', 'sandstone', 'mine_rock', 'cave_rock']);

// A block you've broken with a tool in hand: what comes of it (smelted,
// doubled, a find in the rubble, more logs from a tree). `drops`, as
// breakBlock gathered them, changed in place.
export function toolDrops(game, p, id, drops) {
  const ms = modsOf(p).tool;
  if (!ms.length || !drops.length) return;
  const b = BLOCKS[id];
  if (ms.includes('smelting')) {
    for (const d of drops) if (SMELTS[d.item]) d.item = SMELTS[d.item];
  }
  if (ms.includes('lumber') && LOGS.has(id)) {
    for (const d of drops) if (LOGS.has(B[d.item])) d.count += Math.ceil(d.count / 3);
  }
  if (ms.includes('prospect') && b && b.tool === 'pick' && STONY.has(b.name) && Math.random() < 0.12) {
    const find = Math.random() < 0.15 ? 'gem' : Math.random() < 0.5 ? 'coal' : 'iron_ore';
    drops.push({ item: ms.includes('smelting') && SMELTS[find] ? SMELTS[find] : find, count: 1 });
    game.renderer.floatText(p.x, p.y + 2.4, p.z, `found ${ITEMS[find] ? ITEMS[find].name.toLowerCase() : find}!`, '#ffe070');
  }
  if (ms.includes('brine') && b && b.tool === 'pick' && STONY.has(b.name) && Math.random() < 0.12) {
    drops.push({ item: 'salt', count: 1 + Math.floor(Math.random() * 2) });
    game.renderer.emit(p.x, p.y + 1.4, p.z, { n: 5, color: SALT, up: 14, speed: 14, life: 0.6, glow: true });
  }
  if (ms.includes('fortune') && Math.random() < 0.2 && b && b.interact !== 'container') {
    for (const d of [...drops]) drops.push({ ...d });
    game.renderer.emit(p.x, p.y + 1.6, p.z, { n: 6, color: ['#ffe070', '#ffffff'], up: 20, speed: 20, life: 0.5, shape: 'star', glow: true });
  }
}

// A clean-cutting pick or shovel: how much of the usual time the extra
// blocks of a dig take (the other half of a two-high gap: none; a step cut:
// half). It only ever speeds up what anyone can do; it never digs more.
export function extraDigMult(p, step) {
  if (!hasMod(p, 'tool', 'clean')) return 1;
  return step ? 0.5 : 0;
}

// ------------------------------------------------------------ the far lands'
// (Round 68) Each far land's own modifier, off its own old places only:
// see world/quality.LAND_MODS.

// A foe you've felled with jade about you: mended.
function jadeMend(game, a, t, n) {
  game.renderer.emit(t.x, t.y + 1, t.z, { n: 10, color: JADE, up: 20, speed: 20, life: 0.8, glow: true });
  mend(game, a, n);
}
// Lightning down on `t` (`by`'s doing).
function lightning(game, by, t, dmg) {
  const r = game.renderer;
  r.effect?.({ type: 'beam', wx: t.x, wy: t.y + 7, wz: t.z, tx: t.x, ty: t.y + 0.4, tz: t.z, life: 0.25, oy: -8, color: '#ffffff', halo: '#80a0ff', width: 2 });
  r.emit(t.x, t.y + 0.6, t.z, { n: 12, color: STORM, up: 30, speed: 40, life: 0.4, glow: true });
  game.damage(t, dmg, by);
  stun(t, 0.4);
  game.audio?.play('thunder', t);
}
// Its runes going off round `at`: everything hostile within a pace harmed
// (not `by`, nor its own).
function runeBurst(game, by, at, dmg) {
  const r = game.renderer;
  r.effect?.({ type: 'ring', wx: at.x, wy: at.y, wz: at.z, r0: 3, r1: 22, color: RUNE, life: 0.45, oy: 3, flat: 0.5, thick: 2 });
  r.emit(at.x, at.y + 0.6, at.z, { n: 14, color: RUNE, up: 24, speed: 30, life: 0.5, glow: true });
  for (const e of game.creatures) {
    if (e.dead || e === by || !e.hostileNow || Math.max(Math.abs(e.x - at.x), Math.abs(e.z - at.z)) > 1 || Math.abs(e.y - at.y) > 1) continue;
    game.damage(e, dmg, by);
  }
  game.audio?.play('rune', at);
}
// Parched by brine: slowed, and its next blow slower in coming.
function parch(game, t) {
  chill(t, 2.5);
  t.attackCd = (t.attackCd || 0) + 0.6;
  game.renderer.emit(t.x, t.y + 1, t.z, { n: 6, color: SALT, up: 10, speed: 14, life: 0.6, glow: true });
  game.renderer.floatText(t.x, t.y + 2.4, t.z, 'parched', '#f0e8f0');
}
// Hauled a pace toward `to`.
function haul(game, to, t) {
  if (t.foot || t.anchored || (t.S && t.S.anchored)) return;
  knockBack(game, { x: 2 * t.x - to.x, z: 2 * t.z - to.z }, t, 1);
}

function landBlade(game, a, t, ms) {
  if (ms.includes('whaler')) {
    bleed(game, t, a, 1);
    haul(game, a, t);
  }
  if (ms.includes('brine')) parch(game, t);
  if (ms.includes('rune') && Math.random() < 0.2) runeBurst(game, a, t, 3);
  if (ms.includes('storm') && Math.random() < 0.25) lightning(game, a, t, 3);
}
function landArrow(game, a, t, ms) {
  const by = a.from;
  if (t.dead) {
    if (ms.includes('jade') && by) {
      jadeMend(game, by, t, 1);
      if (by.give) by.give('arrow', 1);
    }
    return;
  }
  if (ms.includes('legion')) stun(t, 0.4);
  if (ms.includes('whaler') && by) {
    bleed(game, t, by, 1);
    haul(game, by, t);
  }
  if (ms.includes('brine')) parch(game, t);
  if (ms.includes('lantern') && t.S && t.S.undead) game.damage(t, Math.max(1, Math.round((a.dmg || 3) / 3)), by);
  if (ms.includes('rune') && Math.random() < 0.25) runeBurst(game, by, t, 3);
  if (ms.includes('storm') && Math.random() < 1 / 3) {
    // (Leaping to another foe near by.)
    const next = game.creatures.find((e) => e !== t && !e.dead && e.hostileNow && Math.max(Math.abs(e.x - t.x), Math.abs(e.z - t.z)) <= 4);
    if (next) {
      game.renderer.effect?.({ type: 'beam', wx: t.x, wy: t.y + 1, wz: t.z, tx: next.x, ty: next.y + 1, tz: next.z, life: 0.25, oy: -8, color: '#ffffff', halo: '#80a0ff', width: 2 });
      lightning(game, by, next, 3);
    }
  }
}
function landShield(game, v, a, ms, parry) {
  if (ms.includes('legion') && parry) stun(a, 1.2);
  if (ms.includes('jade') && Math.random() < 1 / 3) mend(game, v, 1);
  if (ms.includes('whaler') && !a.foot) {
    haul(game, v, a);
    stun(a, 0.4);
  }
  if (ms.includes('brine')) parch(game, a);
  if (ms.includes('lantern') && a.S && a.S.undead) {
    stun(a, 0.8);
    game.renderer.emit(a.x, a.y + 1.2, a.z, { n: 10, color: ['#fff0b0', '#ffd070'], up: 14, speed: 20, life: 0.5, glow: true });
  }
  if (ms.includes('rune') && parry) {
    runeBurst(game, v, v, 2);
    for (const e of game.creatures) if (!e.dead && e.hostileNow && !e.foot && Math.max(Math.abs(e.x - v.x), Math.abs(e.z - v.z)) <= 2) knockBack(game, v, e, 1);
  }
  if (ms.includes('storm') && parry) lightning(game, v, a, 3);
}

// Something of yours lit with a lantern's light (a Lantern-lit piece held
// or worn): how bright (0 if none).
export function lanternLight(e) {
  const ms = modsOf(e);
  if (ms.blade.includes('lantern') || ms.bow.includes('lantern') || ms.tool.includes('lantern') || ms.shield.includes('lantern') || ms.armor.lantern) return 9;
  return 0;
}

// Every moment: Jade-set armour mending you, slowly; Rune-cut armour's ward
// coming round again.
export function landArmorTick(game, p, dt) {
  const ms = modsOf(p);
  const jade = ms.armor.jade || 0;
  if (jade && p.hp < p.maxHp && !p.dead) {
    p.jadeT = (p.jadeT ?? 24 / jade) - dt;
    if (p.jadeT <= 0) {
      p.jadeT = 24 / jade;
      mend(game, p, 1);
    }
  }
  if (p.runeT > 0) p.runeT -= dt;
}

// A blow on you that Rune-cut armour's ward turns whole (true: turned).
export function runeWard(game, p) {
  const n = hasMod(p, 'armor', 'rune');
  if (!n || p.runeT > 0) return false;
  p.runeT = 40 / n;
  game.renderer.effect?.({ type: 'ring', wx: p.x, wy: p.y, wz: p.z, r0: 4, r1: 20, color: RUNE, life: 0.5, oy: -4, flat: 0.7, thick: 2 });
  game.renderer.floatText(p.x, p.y + 2.4, p.z, 'warded by runes', '#80e8ff');
  game.audio?.play('rune', p);
  return true;
}

// How much of a shove gets through Whaler's armour (0: none).
export function knockModMult(e) {
  const n = hasMod(e, 'armor', 'whaler');
  return n >= 2 ? 0 : n ? 0.5 : 1;
}

// How fast poison wears off you (Brine-cured armour: twice as fast).
export function poisonModRate(e) {
  return hasMod(e, 'armor', 'brine') ? 2 : 1;
}
