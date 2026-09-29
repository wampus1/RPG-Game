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

// Which way a set piece of gear works.
export function gearKind(key) {
  const it = ITEMS[key];
  if (!it) return null;
  if (it.kind === 'armor') return 'armor';
  if (it.ranged) return 'bow';
  return 'blade';
}

export function gemText(key) {
  const it = ITEMS[key];
  if (!it || !it.socket) return null;
  return `Set with a ${GEMS[it.socket].name}: ${GEM_EFFECTS[it.socket][gearKind(key)]}`;
}

// The stones someone carries into a fight: in the blade they swing, the
// bow they shoot, and the armour they wear.
export function gemsOf(e) {
  if (!e) return { blade: null, bow: null, armor: [] };
  if (e.kind === 'player') {
    const held = e.heldDef ? e.heldDef() : null;
    const armor = Object.values(e.equip || {}).map((k) => k && ITEMS[k] && ITEMS[k].socket).filter(Boolean);
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

function mend(game, e, n = 1) {
  if (!e || e.dead || e.hp >= e.maxHp) return;
  e.hp = Math.min(e.maxHp, e.hp + n);
  if (e.rec) e.rec.hp = e.hp;
  game.renderer.emit(e.x, e.y + 1, e.z, { n: 3, color: LIFE, up: 20, life: 0.5, gravity: -10 });
}

function knockBack(game, attacker, t, tiles = 1) {
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

// A swing, whether or not it lands: a ruby blade throws flame ahead.
export function onSwing(game, attacker, main = null) {
  const g = gemsOf(attacker);
  if (g.blade !== 'ruby') return;
  const DX = [0, -1, 0, 1];
  const DZ = [1, 0, -1, 0];
  const dx = DX[attacker.dir] ?? 0;
  const dz = DZ[attacker.dir] ?? 1;
  (game.flames ||= []).push({ from: attacker, main, x: attacker.x, y: attacker.y, z: attacker.z, dx, dz, n: 0, t: 0 });
}

// Flames from ruby blades travel a tile at a time and scorch the first foe.
export function updateFlames(game, dt) {
  if (!game.flames || !game.flames.length) return;
  for (const f of game.flames) {
    f.t -= dt;
    if (f.t > 0) continue;
    f.t = 0.07;
    f.n++;
    f.x += f.dx;
    f.z += f.dz;
    game.renderer.emit(f.x, f.y + 1, f.z, { n: 5, color: FIRE, up: 25, life: 0.35, oy: -6 });
    const hit = around(game, f.x, f.z, 0).find((e) => foeOf(game, f.from, e, f.main));
    if (hit) {
      game.damage(hit, 2, f.from);
      burn(game, hit, f.from, 2);
      f.done = true;
    } else if (f.n >= 4 || !game.world.regionAt(f.x, f.z) || BLOCKS[game.world.getBlock(f.x, f.y, f.z)]?.solid) f.done = true;
  }
  game.flames = game.flames.filter((f) => !f.done);
}

// A blade's blow has landed.
export function onBladeHit(game, attacker, target) {
  const g = gemsOf(attacker).blade;
  if (!g || target.dead) return;
  if (g === 'sapphire') {
    chill(target, 2);
    game.renderer.emit(target.x, target.y + 1, target.z, { n: 5, color: FROST, up: 20, life: 0.5, oy: -6 });
  } else if (g === 'emerald') mend(game, attacker, 1);
  else if (g === 'topaz' && Math.random() < 0.35) {
    const next = around(game, target.x, target.z, 3).find((e) => e !== target && foeOf(game, attacker, e, null));
    if (next) {
      game.renderer.emit(next.x, next.y + 1, next.z, { n: 8, color: BOLT, up: 40, life: 0.3, oy: -10 });
      game.damage(next, 2, attacker);
    }
  } else if (g === 'amethyst') {
    stun(target, 1.2);
    knockBack(game, attacker, target, 2);
    game.renderer.emit(target.x, target.y + 1, target.z, { n: 5, color: FORCE, up: 20, life: 0.4, oy: -6 });
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
    game.renderer.emit(a.tx, a.ty, a.tz, { n: 14, color: FIRE, up: 40, speed: 50, life: 0.6, oy: -6 });
    for (const e of around(game, Math.round(a.tx), Math.round(a.tz), 1)) {
      if (!foeOf(game, shooter, e, t)) continue;
      if (e !== t || !hit) game.damage(e, 2, shooter);
      burn(game, e, shooter, 3);
    }
    game.audio?.play('fire', t);
  } else if (!hit || t.dead) return;
  else if (g === 'sapphire') chill(t, 3);
  else if (g === 'emerald') mend(game, shooter, 1);
  else if (g === 'topaz') {
    game.renderer.emit(t.x, t.y + 2, t.z, { n: 10, color: BOLT, up: 50, life: 0.3, oy: -14 });
    game.damage(t, 2, shooter);
    stun(t, 1);
  } else if (g === 'amethyst') {
    knockBack(game, shooter, t, 2);
    stun(t, 0.6);
  }
}

// Someone wearing jewelled armour has been struck (in close).
export function onStruck(game, wearer, attacker, amount) {
  if (!attacker || attacker.dead || attacker === wearer) return;
  const close = Math.max(Math.abs(attacker.x - wearer.x), Math.abs(attacker.z - wearer.z)) <= 2;
  if (!close) return;
  for (const g of gemsOf(wearer).armor) {
    if (g === 'ruby') burn(game, attacker, wearer, 2);
    else if (g === 'sapphire') chill(attacker, 2);
    else if (g === 'topaz' && Math.random() < 0.25) {
      stun(attacker, 1);
      game.renderer.emit(wearer.x, wearer.y + 1, wearer.z, { n: 8, color: BOLT, up: 30, life: 0.3, oy: -8 });
    } else if (g === 'amethyst' && !attacker.thorned) {
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
      game.renderer.emit(e.x, e.y + 1, e.z, { n: 4, color: FIRE, up: 30, life: 0.4, oy: -8 });
      // (Water puts it out.)
      if (e.inWater) e.burnT = 0;
      else game.damage(e, 1, e.burnSrc || null);
    }
  }
  if (e.kind === 'player' || e.kind === 'npc') {
    e.regenT = (e.regenT || 0) - dt;
    if (e.regenT <= 0) {
      e.regenT = 10;
      if (gemsOf(e).armor.includes('emerald')) mend(game, e, 1);
    }
  }
}

// Whether an NPC is carrying anything jewelled (for talk).
export function jewelled(rec) {
  const all = [rec.equipment && rec.equipment.tool, ...Object.values(rec.wear || {}), ...((rec.equipment && rec.equipment.items) || []).map((i) => i.item)];
  return all.filter((k) => k && ITEMS[k] && ITEMS[k].socket);
}

