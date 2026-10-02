// What a set stone does depends on what it's set in: a blade, a bow or a
// piece of armour. The same effects work for anyone who carries them (you,
// or a guard who bought a jewelled sword).
import { ITEMS, GEMS } from '../world/items.js';
import { BLOCKS } from '../world/blocks.js';

export const GEM_EFFECTS = {
  ruby: {
    blade: 'each swing throws a lick of flame a few paces ahead',
    bow: 'arrows burst into flame where they land, scorching all around',
    armor: 'whoever strikes you catches fire',
  },
  sapphire: {
    blade: 'swings faster, and chills what it cuts (slowing it)',
    bow: 'arrows fly faster and frost what they hit',
    armor: 'whoever strikes you is chilled and slowed',
  },
  emerald: {
    blade: 'each hit mends you a little',
    bow: 'each arrow that strikes mends you a little',
    armor: 'your wounds slowly close on their own',
  },
  topaz: {
    blade: 'hits sometimes leap as lightning to another foe nearby',
    bow: 'arrows call down a flash of lightning that dazzles',
    armor: 'whoever strikes you may be dazzled by the glare',
  },
  amethyst: {
    blade: 'blows stagger and throw foes back',
    bow: 'arrows knock their target back and stagger it',
    armor: 'part of every blow is turned back on the one who struck',
  },
};

// In a shield, a stone works when the shield turns a blow (and more so
// when it parries one); in armour, as well as what it does when you're
// struck, when you roll and catch your breath.
export const SHIELD_EFFECTS = {
  ruby: 'a blow it turns singes whoever struck it (a parry sets them alight)',
  sapphire: 'parries come a little easier, and a blow it turns chills whoever struck it',
  emerald: 'turning a blow takes half the breath, and mends you a little',
  topaz: 'a parry dazzles them twice as long, and a blow it turns may dazzle them',
  amethyst: 'a blow it turns throws whoever struck it back a pace',
};
export const ROLL_EFFECTS = {
  ruby: 'a roll leaves a burst of flame where you were',
  sapphire: 'rolling takes less breath',
  emerald: 'your breath comes back quicker',
  topaz: 'a blow struck straight out of a roll lands hard and true',
  amethyst: 'rolling past someone knocks them aside',
};

// Which way a set piece of gear works.
export function gearKind(key) {
  const it = ITEMS[key];
  if (!it) return null;
  if (it.block) return 'shield';
  if (it.kind === 'armor') return 'armor';
  if (it.ranged) return 'bow';
  return 'blade';
}

export function gemText(key) {
  const it = ITEMS[key];
  if (!it || !it.socket) return null;
  const k = gearKind(key);
  if (k === 'shield') return `Set with a ${GEMS[it.socket].name}: ${SHIELD_EFFECTS[it.socket]}`;
  return `Set with a ${GEMS[it.socket].name}: ${GEM_EFFECTS[it.socket][k]}${k === 'armor' ? `; ${ROLL_EFFECTS[it.socket]}` : ''}`;
}

// The stone in someone's shield, if it's a shield they carry.
export function shieldGem(e) {
  const k = e && (e.kind === 'player' ? e.equip && e.equip.shield : e.rec && e.rec.equipment && e.rec.equipment.shield);
  const it = k && ITEMS[k];
  return it && it.block ? it.socket || null : null;
}

// The stones someone carries into a fight: in the blade they swing, the
// bow they shoot, and the armour they wear.
export function gemsOf(e) {
  if (!e) return { blade: null, bow: null, armor: [] };
  if (e.kind === 'player') {
    const held = e.heldDef ? e.heldDef() : null;
    // (A shield's stone works its own way: see onBlock.)
    const armor = Object.entries(e.equip || {}).filter(([slot]) => slot !== 'shield').map(([, k]) => k && ITEMS[k] && ITEMS[k].socket).filter(Boolean);
    return { blade: held && !held.ranged ? held.socket || null : null, bow: held && held.ranged ? held.socket || null : null, armor };
  }
  if (e.kind === 'npc') {
    const mw = e.meleeWeapon ? e.meleeWeapon() : null;
    const w = e.weapon ? e.weapon() : null;
    const armor = Object.values(e.rec.wear || {}).map((k) => ITEMS[k] && ITEMS[k].socket).filter(Boolean);
    return { blade: mw ? ITEMS[mw].socket || null : null, bow: w && ITEMS[w].ranged ? ITEMS[w].socket || null : null, armor };
  }
  return { blade: null, bow: null, armor: [] };
}

// Is this someone the attacker's stones may hurt (the thing they're
// fighting, or any beast; never a bystander)?
function foeOf(game, attacker, e, main) {
  if (!e || e.dead || e === attacker) return false;
  if (e === main) return true;
  if (e.kind === 'creature') return true;
  if (attacker.kind === 'player') return e.kind === 'npc' && e.state === 'fight' && e.threat === attacker;
  if (attacker.kind === 'npc') return e === attacker.threat || e === attacker.prey;
  return false;
}

function around(game, x, z, r) {
  const out = [];
  for (const n of game.npcs) if (!n.dead && Math.max(Math.abs(n.x - x), Math.abs(n.z - z)) <= r) out.push(n);
  for (const c of game.creatures || []) if (!c.dead && Math.max(Math.abs(c.x - x), Math.abs(c.z - z)) <= r) out.push(c);
  const p = game.player;
  if (p && !p.dead && Math.max(Math.abs(p.x - x), Math.abs(p.z - z)) <= r) out.push(p);
  return out;
}

const FIRE = ['#ff6030', '#ffb040', '#fff0a0'];
const FROST = ['#a0d8ff', '#e0f4ff', '#60a0ff'];
const BOLT = ['#fff8a0', '#ffe040', '#ffffff'];
const LIFE = ['#60e080', '#c0ffc0'];
const FORCE = ['#c080ff', '#e0c0ff'];

export function burn(game, e, src, secs = 3) {
  if (!e || e.dead) return;
  e.burnT = Math.max(e.burnT || 0, secs);
  e.burnSrc = src;
}

export function chill(e, secs = 2) {
  if (!e || e.dead) return;
  e.slowT = Math.max(e.slowT || 0, secs);
}

export function stun(e, secs = 1) {
  if (!e || e.dead) return;
  e.stunT = Math.max(e.stunT || 0, secs);
}

export function mend(game, e, n = 1) {
  if (!e || e.dead || e.hp >= e.maxHp) return;
  e.hp = Math.min(e.maxHp, e.hp + n);
  if (e.rec) e.rec.hp = e.hp;
  // Little green crosses rising, and a glow at their feet.
  game.renderer.emit(e.x, e.y + 1, e.z, { n: 4, color: LIFE, up: 16, speed: 14, life: 0.8, gravity: -14, shape: 'plus', oy: -4 });
  game.renderer.effect?.({ type: 'ring', wx: e.x, wy: e.y, wz: e.z, r0: 2, r1: 9, color: LIFE, life: 0.6, oy: 4, flat: 0.45 });
}

// Frost: a ring of rime spreading out, and glinting ice.
function frostBurst(game, t) {
  game.renderer.effect?.({ type: 'ring', wx: t.x, wy: t.y, wz: t.z, r0: 3, r1: 13, color: FROST, life: 0.5, oy: 3, flat: 0.5 });
  game.renderer.emit(t.x, t.y + 1, t.z, { n: 7, color: FROST, up: 18, speed: 36, life: 0.55, oy: -6, shape: 'star', gravity: 20 });
}

// Force: a violet shock ring and dust thrown up.
function forceBurst(game, t) {
  game.renderer.effect?.({ type: 'ring', wx: t.x, wy: t.y, wz: t.z, r0: 2, r1: 16, color: FORCE, life: 0.4, oy: -6, flat: 0.8, thick: 2 });
  game.renderer.emit(t.x, t.y, t.z, { n: 6, color: ['#a89880', '#c8b8a0'], up: 10, speed: 40, life: 0.4, oy: 2 });
}

export function knockBack(game, attacker, t, tiles = 1) {
  const kx = Math.sign(t.x - attacker.x);
  const kz = Math.sign(t.z - attacker.z);
  if (t.moving || t.dead || t.sleeping || (!kx && !kz)) return;
  let x = t.x;
  let z = t.z;
  let y = t.y;
  for (let i = 0; i < tiles; i++) {
    const nx = x + (Math.abs(kx) >= Math.abs(kz) ? kx : 0);
    const nz = z + (Math.abs(kx) >= Math.abs(kz) ? 0 : kz);
    const ny = game.world.stepTarget(x, y, z, nx, nz, false);
    if (ny < 0 || game.occupiedBySolid(nx, ny, nz, t)) break;
    x = nx;
    z = nz;
    y = ny;
  }
  if (x !== t.x || z !== t.z) t.startMove(x, y, z, 0.14);
}

// How much quicker a sapphire blade swings.
export function swingMult(e) {
  return gemsOf(e).blade === 'sapphire' ? 0.8 : 1;
}

// A swing, whether or not it lands: a ruby blade throws an arc of flame
// the way it's swung (toward the mouse, for you; at their foe, for anyone
// else). It sweeps out a few paces, and whoever it catches is set alight.
export function onSwing(game, attacker, main = null) {
  const g = gemsOf(attacker);
  if (g.blade !== 'ruby') return;
  let ang = null;
  if (attacker.kind === 'player' && game.aimAngle) ang = game.aimAngle();
  if (ang === null && main && !main.dead) ang = Math.atan2(main.z - attacker.z, main.x - attacker.x);
  if (ang === null) {
    const DX = [0, -1, 0, 1];
    const DZ = [1, 0, -1, 0];
    ang = Math.atan2(DZ[attacker.dir] ?? 1, DX[attacker.dir] ?? 0);
  }
  const dx = Math.cos(ang);
  const dz = Math.sin(ang);
  // As far as it can go before a wall stops it.
  let range = 3.4;
  for (let d = 1; d <= 3; d++) {
    const x = Math.round(attacker.x + dx * d);
    const z = Math.round(attacker.z + dz * d);
    // (A step up it licks over; a wall stops it.)
    if (BLOCKS[game.world.getBlock(x, attacker.y, z)]?.solid && BLOCKS[game.world.getBlock(x, attacker.y + 1, z)]?.solid) {
      range = d - 0.3;
      break;
    }
  }
  (game.flames ||= []).push({ from: attacker, main, x: attacker.x, y: attacker.y, z: attacker.z, ang, r: 0.4, range, hit: new Set() });
  game.renderer.effect?.({ type: 'arc', wx: attacker.x, wy: attacker.y, wz: attacker.z, dx, dz, range, life: 0.5, oy: -8 });
  game.audio?.play('fire', attacker);
}

// Who a ruby's flame may catch: for you, anyone in its path (so mind where
// you swing it in town); for anyone else, only what they're fighting.
function flameCatches(game, attacker, e, main) {
  if (!e || e.dead || e === attacker || e.hired || e.kind === 'item') return false;
  if (attacker.kind === 'player') return e.kind === 'creature' || e.kind === 'npc';
  return foeOf(game, attacker, e, main);
}

// The arc spreads out a pace at a time, catching whoever is in its sweep.
export function updateFlames(game, dt) {
  if (!game.flames || !game.flames.length) return;
  for (const f of game.flames) {
    f.r += dt * 9;
    const R = Math.min(f.r, f.range);
    for (const e of around(game, f.x, f.z, Math.ceil(R))) {
      if (f.hit.has(e) || !flameCatches(game, f.from, e, f.main)) continue;
      const d = Math.hypot(e.x - f.x, e.z - f.z);
      if (d > R || d < 0.5) continue;
      let da = Math.abs(Math.atan2(e.z - f.z, e.x - f.x) - f.ang);
      if (da > Math.PI) da = Math.PI * 2 - da;
      if (da > 1.0) continue;
      f.hit.add(e);
      game.damage(e, 2, f.from);
      burn(game, e, f.from, 3);
      game.renderer.emit(e.x, e.y + 1, e.z, { n: 8, color: FIRE, up: 30, speed: 30, life: 0.45, oy: -6 });
    }
    if (f.r >= f.range) f.done = true;
  }
  game.flames = game.flames.filter((f) => !f.done);
}

// A blade's blow has landed.
export function onBladeHit(game, attacker, target) {
  const g = gemsOf(attacker).blade;
  if (!g || target.dead) return;
  if (g === 'sapphire') {
    chill(target, 2);
    frostBurst(game, target);
  } else if (g === 'emerald') mend(game, attacker, 1);
  else if (g === 'topaz' && Math.random() < 0.35) {
    const next = around(game, target.x, target.z, 3).find((e) => e !== target && foeOf(game, attacker, e, null));
    if (next) {
      game.renderer.effect?.({ type: 'bolt', wx: target.x, wy: target.y, wz: target.z, tx: next.x, ty: next.y, tz: next.z, life: 0.35, oy: -10 });
      game.renderer.emit(next.x, next.y + 1, next.z, { n: 8, color: BOLT, up: 40, life: 0.3, oy: -10 });
      game.damage(next, 2, attacker);
      stun(next, 0.6);
    }
  } else if (g === 'amethyst') {
    stun(target, 1.2);
    knockBack(game, attacker, target, 2);
    forceBurst(game, target);
  }
}

// How fast an arrow flies (sapphire: quicker).
export function arrowSpeed(shooter) {
  return gemsOf(shooter).bow === 'sapphire' ? 0.6 : 1;
}

// An arrow has come down (on its target, if it hit).
export function onArrowLand(game, a, hit) {
  const g = a.gem;
  if (!g) return;
  const shooter = a.from;
  const t = a.target;
  if (g === 'ruby') {
    game.renderer.effect?.({ type: 'blast', wx: Math.round(a.tx), wy: a.ty, wz: Math.round(a.tz), r1: 18, life: 0.6, oy: 2 });
    game.renderer.emit(a.tx, a.ty, a.tz, { n: 14, color: FIRE, up: 40, speed: 50, life: 0.6, oy: -6 });
    for (const e of around(game, Math.round(a.tx), Math.round(a.tz), 1)) {
      if (!foeOf(game, shooter, e, t)) continue;
      if (e !== t || !hit) game.damage(e, 2, shooter);
      burn(game, e, shooter, 3);
    }
    game.audio?.play('fire', t);
  } else if (!hit || t.dead) return;
  else if (g === 'sapphire') {
    chill(t, 3);
    frostBurst(game, t);
  } else if (g === 'emerald') mend(game, shooter, 1);
  else if (g === 'topaz') {
    game.renderer.effect?.({ type: 'bolt', from: 'sky', wx: t.x, wy: t.y, wz: t.z, tx: t.x, ty: t.y, tz: t.z, life: 0.4, oy: -4 });
    game.renderer.emit(t.x, t.y + 2, t.z, { n: 10, color: BOLT, up: 50, life: 0.3, oy: -14 });
    game.damage(t, 2, shooter);
    stun(t, 1);
  } else if (g === 'amethyst') {
    knockBack(game, shooter, t, 2);
    stun(t, 0.6);
    forceBurst(game, t);
  }
}

// A blow turned on a shield (`parry`: at the last instant): its stone at
// work on whoever struck.
export function onBlock(game, v, a, parry = false) {
  const g = shieldGem(v);
  if (!g || !a || a.dead) return;
  if (g === 'ruby' && (parry || Math.random() < 0.35)) {
    burn(game, a, v, parry ? 3 : 2);
    game.renderer.emit(a.x, a.y + 1, a.z, { n: 8, color: FIRE, up: 30, speed: 30, life: 0.45, oy: -6 });
  } else if (g === 'sapphire') {
    chill(a, parry ? 3 : 1.5);
    frostBurst(game, a);
  } else if (g === 'emerald') {
    v.gemMendT2 = (v.gemMendT2 || 0);
    if (parry || game.sim.abs - v.gemMendT2 >= 2) {
      v.gemMendT2 = game.sim.abs;
      mend(game, v, 1);
    }
  } else if (g === 'topaz' && (parry || Math.random() < 0.25)) {
    stun(a, parry ? 2.6 : 0.6);
    game.renderer.effect?.({ type: 'bolt', wx: v.x, wy: v.y, wz: v.z, tx: a.x, ty: a.y, tz: a.z, life: 0.3, oy: -10 });
  } else if (g === 'amethyst') {
    forceBurst(game, a);
    knockBack(game, v, a, parry ? 2 : 1);
  }
}

// What a parry window gains from a stone (sapphire, in a shield).
export function parryBonus(e) {
  return shieldGem(e) === 'sapphire' ? 0.06 : 0;
}

// How much breath turning a blow costs (an emerald shield: half).
export function blockCostMult(e) {
  return shieldGem(e) === 'emerald' ? 0.5 : 1;
}

// A roll's cost, and how fast breath comes back, by the armour's stones.
export function rollCostMult(e) {
  return gemsOf(e).armor.includes('sapphire') ? 0.7 : 1;
}
export function breathMult(e) {
  return gemsOf(e).armor.includes('emerald') ? 1.25 : 1;
}

// A roll, done (from where to where, past whom): the armour's stones.
export function onRoll(game, p, from, past) {
  const g = gemsOf(p).armor;
  if (g.includes('ruby')) {
    game.renderer.effect?.({ type: 'blast', wx: from.x, wy: from.y, wz: from.z, r1: 14, life: 0.5, oy: 2 });
    game.renderer.emit(from.x, from.y + 0.5, from.z, { n: 12, color: FIRE, up: 30, speed: 30, life: 0.5, oy: -4 });
    for (const e of around(game, from.x, from.z, 1)) {
      if (e === p || !(e.kind === 'creature' || e.kind === 'monster' || (e.kind === 'npc' && e.state === 'fight' && e.threat === p) || (e.warband && e.hostileNow))) continue;
      burn(game, e, p, 2);
    }
  }
  if (g.includes('amethyst')) {
    for (const e of past) {
      if (e.dead || e === p) continue;
      knockBack(game, p, e, 1);
      stun(e, 0.4);
      forceBurst(game, e);
    }
  }
  // (A blow straight out of it: hard and true.)
  if (g.includes('topaz')) p.rollStrike = 1.1;
}

// Someone wearing jewelled armour has been struck (in close).
export function onStruck(game, wearer, attacker, amount) {
  if (!attacker || attacker.dead || attacker === wearer) return;
  const close = Math.max(Math.abs(attacker.x - wearer.x), Math.abs(attacker.z - wearer.z)) <= 2;
  if (!close) return;
  for (const g of gemsOf(wearer).armor) {
    if (g === 'ruby') {
      burn(game, attacker, wearer, 2);
      game.renderer.emit(attacker.x, attacker.y + 1, attacker.z, { n: 8, color: FIRE, up: 30, speed: 30, life: 0.45, oy: -6 });
    } else if (g === 'sapphire') {
      chill(attacker, 2);
      frostBurst(game, attacker);
    } else if (g === 'topaz' && Math.random() < 0.25) {
      stun(attacker, 1);
      game.renderer.effect?.({ type: 'bolt', wx: wearer.x, wy: wearer.y, wz: wearer.z, tx: attacker.x, ty: attacker.y, tz: attacker.z, life: 0.3, oy: -10 });
    } else if (g === 'amethyst' && !attacker.thorned) {
      forceBurst(game, attacker);
      // (No endless back-and-forth between two thorny coats.)
      attacker.thorned = true;
      game.damage(attacker, Math.max(1, Math.round(amount * 0.3)), wearer);
      attacker.thorned = false;
    }
  }
}

// Every so often: fire burns, frost wears off, and an emerald in armour
// closes a wound.
export function tickStatus(game, e, dt) {
  if (e.dead) return;
  if (e.slowT > 0) e.slowT -= dt;
  if (e.kind !== 'creature' && e.stunT > 0) e.stunT -= dt;
  if (e.burnT > 0) {
    e.burnT -= dt;
    e.burnTick = (e.burnTick || 0) - dt;
    if (e.burnTick <= 0) {
      e.burnTick = 1;
      // (Water puts it out.)
      if (e.inWater) e.burnT = 0;
      else game.damage(e, 1, e.burnSrc || null);
    }
  }
  if (e.kind === 'player' || e.kind === 'npc') {
    // (Its own clock: the player's natural regeneration keeps another.)
    e.gemMendT = (e.gemMendT || 0) - dt;
    if (e.gemMendT <= 0) {
      e.gemMendT = 10;
      if (gemsOf(e).armor.includes('emerald')) mend(game, e, 1);
    }
  }
}

// Whether an NPC is carrying anything jewelled (for talk).
export function jewelled(rec) {
  const all = [rec.equipment && rec.equipment.tool, ...Object.values(rec.wear || {}), ...((rec.equipment && rec.equipment.items) || []).map((i) => i.item)];
  return all.filter((k) => k && ITEMS[k] && ITEMS[k].socket);
}

