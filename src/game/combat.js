// How a fight goes, blow by blow. Nobody strikes in an instant: every
// attacker winds up first (a red "!" over them, and the ground they'll hit
// lit up red), so there's a moment to get out of the way, get a shield up,
// or hit them first and knock them off their stroke. Each beast and each
// weapon has its own way of fighting:
//   a sword: a quick, honest cut;
//   a spear: a thrust that reaches two paces, in a straight line;
//   an axe: a slow, heavy chop that half breaks a guard;
//   a club or a mace: a blow that leaves you reeling;
//   a dagger: fast, and twice;
//   wolves lunge in from a pace off; slimes slam the ground all round;
//   skeletons hack twice; a boar lowers its head and charges.
//
// You fight with stamina: every swing, every roll, every blow taken on a
// shield costs some, and it comes back when you ease off. Hold the mouse
// on a foe for a heavy blow; hold the right button to block (a shield
// takes most of it, a blade a little), and raise it just as the blow
// lands to parry and leave them open; SPACE rolls you clear.
import { ITEMS } from '../world/items.js';
import { has as heroHas, staminaBonus } from './hero.js';

export const STYLES = {
  fist: { name: 'punch', windup: 0.4, recover: 0.7, reach: 1, mult: 1 },
  sword: { name: 'cut', windup: 0.42, recover: 0.6, reach: 1, mult: 1 },
  spear: { name: 'thrust', windup: 0.55, recover: 0.85, reach: 2, mult: 1.05, thrust: true },
  axe: { name: 'chop', windup: 0.75, recover: 1.0, reach: 1, mult: 1.45, heavy: true },
  club: { name: 'blow', windup: 0.6, recover: 0.8, reach: 1, mult: 1.1, stagger: 0.6 },
  dagger: { name: 'stab', windup: 0.26, recover: 0.5, reach: 1, mult: 0.7, flurry: 2 },
  bite: { name: 'lunge', windup: 0.38, recover: 0.95, reach: 2, mult: 1, lunge: true },
  slam: { name: 'slam', windup: 0.65, recover: 1.0, reach: 1, mult: 1.2, area: true },
  bone: { name: 'hack', windup: 0.5, recover: 0.85, reach: 1, mult: 0.85, flurry: 2 },
  gore: { name: 'charge', windup: 0.85, recover: 1.5, reach: 5, mult: 1.6, charge: true },
};

const SPECIES_STYLE = { wolf: 'bite', slime: 'slam', skeleton: 'bone', boar: 'gore' };

// Which way a weapon fights.
export function weaponStyle(key) {
  if (!key) return 'fist';
  const k = String(key).split('+')[0];
  if (/spear|pitchfork|halberd/.test(k)) return 'spear';
  if (/axe/.test(k)) return 'axe';
  if (/club|mace|hammer|pickaxe|shovel|hoe/.test(k)) return 'club';
  if (/dagger|knife/.test(k)) return 'dagger';
  if (/sword/.test(k)) return 'sword';
  return ITEMS[k] && ITEMS[k].kind === 'weapon' ? 'sword' : 'fist';
}

export function styleOf(e) {
  if (e.kind === 'creature' || e.kind === 'monster') return STYLES[SPECIES_STYLE[e.species]] || STYLES.bite;
  return STYLES[weaponStyle(e.meleeWeapon ? e.meleeWeapon() : null)];
}

// A shield's stats (what's worn on the arm).
export function shieldOf(e) {
  const k = e.kind === 'player' ? e.equip && e.equip.shield : e.rec && e.rec.equipment && e.rec.equipment.shield;
  const it = k && ITEMS[k];
  return it && it.block ? it : null;
}

const DIRS = [[0, 1], [-1, 0], [0, -1], [1, 0]];
const sgn = (v) => (v > 0 ? 1 : v < 0 ? -1 : 0);
// The four-way direction from a toward b.
function headingTo(a, b) {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  if (Math.abs(dx) >= Math.abs(dz)) return [sgn(dx) || 1, 0];
  return [0, sgn(dz)];
}

// Is someone facing toward a (to take a blow on their shield)?
export function facing(v, a) {
  const [fx, fz] = DIRS[v.dir] || [0, 1];
  const dx = sgn(a.x - v.x);
  const dz = sgn(a.z - v.z);
  return fx * dx + fz * dz > 0 || (dx === 0 && dz === 0);
}

// The ground a blow will land on.
function tilesFor(a, target, st) {
  const out = [];
  if (st.area) {
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) if (dx || dz) out.push({ x: a.x + dx, z: a.z + dz });
    return out;
  }
  const [hx, hz] = headingTo(a, target);
  if (st.thrust || st.charge) {
    for (let k = 1; k <= st.reach; k++) out.push({ x: a.x + hx * k, z: a.z + hz * k });
    return out;
  }
  if (st.lunge) {
    out.push({ x: target.x, z: target.z });
    return out;
  }
  out.push({ x: target.x, z: target.z });
  return out;
}

// Close enough to start a blow at them?
export function inReach(a, target, st = styleOf(a)) {
  if (!target || target.dead || Math.abs(target.y - a.y) > 1) return false;
  const d = Math.max(Math.abs(target.x - a.x), Math.abs(target.z - a.z));
  if (st.charge) return d >= 2 && d <= st.reach && (target.x === a.x || target.z === a.z);
  if (st.thrust) return d <= st.reach && (d <= 1 || target.x === a.x || target.z === a.z);
  return d <= st.reach;
}

// Wind up a blow at the target. False if one's already coming.
export function beginAttack(game, a, target, st = styleOf(a)) {
  if (a.windup || (a.attackCd || 0) > 0 || (a.stunT || 0) > 0) return false;
  a.face(target.x, target.z);
  // (A boar too close to charge just gores.)
  if (st.charge && Math.max(Math.abs(target.x - a.x), Math.abs(target.z - a.z)) <= 1) st = { ...st, charge: false, reach: 1, windup: 0.5, mult: 1.1 };
  const tiles = tilesFor(a, target, st);
  a.windup = { t: 0, dur: st.windup * (a.slowT > 0 ? 1.3 : 1), st, target, tiles, y: a.y, heading: headingTo(a, target) };
  if (st.heavy || st.charge) a.say?.(a.rng?.pick?.(['Hrrah!', 'Graaah!']) || 'Hrah!', 0.6, '#ff9080');
  return true;
}

// Interrupted mid-swing (hit hard, or parried): no blow this time.
export function interrupt(a, stun = 0.5) {
  if (!a.windup) return false;
  a.windup = null;
  a.stunT = Math.max(a.stunT || 0, stun);
  a.attackCd = Math.max(a.attackCd || 0, 0.4);
  return true;
}

// Each update while winding up (true: still busy, don't move).
export function tickAttack(game, a, dt) {
  const w = a.windup;
  if (!w) return false;
  if (a.dead || (a.stunT || 0) > 0 || a.sleeping || a.down) {
    a.windup = null;
    return false;
  }
  w.t += dt;
  if (w.dash) return dashTick(game, a, w, dt);
  if (w.t < w.dur) return true;
  if (w.st.charge) {
    // Head down and away: across the ground in a straight line.
    w.dash = { i: 0, hit: false };
    return dashTick(game, a, w, dt);
  }
  strike(game, a, w);
  if (w.st.flurry && (w.flurried || 1) < w.st.flurry && !a.dead) {
    // A second one, quick on the first (no warning this time but the swing).
    w.flurried = (w.flurried || 1) + 1;
    w.t = w.dur - 0.22;
    w.tiles = tilesFor(a, w.target, w.st);
    return true;
  }
  a.windup = null;
  a.attackCd = w.st.recover * (a.kind === 'npc' && a.rec && a.rec.job === 'guard' && a.rec.drilled ? 0.85 : 1);
  return false;
}

function dashTick(game, a, w, dt) {
  if (a.moving) return true;
  const d = w.dash;
  const [hx, hz] = w.heading;
  if (d.i >= w.st.reach || d.hit) {
    a.windup = null;
    a.attackCd = w.st.recover;
    return false;
  }
  const nx = a.x + hx;
  const nz = a.z + hz;
  const victim = victimsAt(game, a, [{ x: nx, z: nz }])[0];
  if (victim) {
    d.hit = true;
    resolveHit(game, a, victim, w.st);
    return true;
  }
  const ny = game.world.stepTarget(a.x, a.y, a.z, nx, nz, false);
  if (ny < 0 || game.occupiedBySolid(nx, ny, nz, a)) {
    // Into a wall (or a tree): stunned for a moment.
    d.hit = true;
    a.stunT = 0.8;
    game.renderer.emit(a.x, a.y + 1, a.z, { n: 6, color: ['#c8b890', '#8a7a5a'], up: 20, speed: 30, life: 0.4 });
    return true;
  }
  a.face(nx, nz);
  a.startMove(nx, ny, nz, 0.09);
  d.i++;
  return true;
}

// Whoever's standing on those tiles (that a blow from `a` could hurt).
function victimsAt(game, a, tiles) {
  const out = [];
  const on = (e) => tiles.some((t) => t.x === e.x && t.z === e.z) && Math.abs(e.y - a.y) <= 1;
  const p = game.player;
  const target = a.windup && a.windup.target;
  if (!p.dead && on(p) && (target === p || a.hostileNow || a.threat === p || a.kind === 'creature' || a.kind === 'monster')) out.push(p);
  // (Only what they're after, or its side: no cutting down bystanders.)
  if (target && target !== p && !target.dead && on(target)) out.push(target);
  return out;
}

function strike(game, a, w) {
  a.doAction?.(0.3);
  game.audio?.play('swing', a);
  // A lunge: a bound forward, then the bite.
  if (w.st.lunge && w.target && !w.target.dead) {
    const t = w.target;
    const d = Math.max(Math.abs(t.x - a.x), Math.abs(t.z - a.z));
    if (d === 2) {
      const [hx, hz] = headingTo(a, t);
      const nx = a.x + hx;
      const nz = a.z + hz;
      const ny = game.world.stepTarget(a.x, a.y, a.z, nx, nz, false);
      if (ny >= 0 && !game.occupiedBySolid(nx, ny, nz, a)) a.startMove(nx, ny, nz, 0.08);
    }
    w.tiles = [{ x: t.x, z: t.z }];
    // (Only if they're still within a bound of it.)
    if (d > 2) return;
  }
  for (const v of victimsAt(game, a, w.tiles)) resolveHit(game, a, v, w.st);
}

// A blow lands (or doesn't).
export function resolveHit(game, a, v, st) {
  if (v.dead || v.down) return 'none';
  const text = (s, c) => game.renderer.floatText(v.x, v.y + 2, v.z, s, c);
  // Rolled clear.
  if (v.rollT > 0) {
    text('dodged', '#c8e8ff');
    return 'dodged';
  }
  let amount = baseDamage(a) * st.mult;
  const sh = shieldOf(v);
  // A shield (or a blade) up toward the blow.
  const guarding = v.kind === 'player' ? v.blocking : sh && v.state === 'fight' && v.rng && v.rng.chance(v.rec && v.rec.job === 'guard' ? 0.4 : 0.25);
  if (guarding && facing(v, a)) {
    // Up just as it came: parried, and they're left wide open.
    const hero = v.kind === 'player' ? game.hero : null;
    if (v.kind === 'player' && v.blockT !== undefined && v.blockT < (heroHas(hero, 'duelist') ? 0.45 : 0.3) && !st.charge) {
      text('PARRY!', '#ffe070');
      game.audio?.play('parry', v);
      interrupt(a, 1.1);
      a.stunT = Math.max(a.stunT || 0, 1.1);
      v.riposte = 1.2;
      v.stamina = Math.min(v.maxStamina || 100, (v.stamina || 0) + 10);
      game.renderer.emit(v.x, v.y + 1.2, v.z, { n: 10, color: ['#fff8c0', '#ffe070', '#ffffff'], up: 25, speed: 50, life: 0.35 });
      return 'parried';
    }
    const wall = sh && heroHas(hero, 'shieldbearer');
    const power = Math.min(0.95, Math.max(0.15, (sh ? sh.block : 0.4) + (wall ? 0.1 : 0) - (st.heavy ? 0.3 : 0) - (st.charge ? 0.25 : 0)));
    const cost = (6 + amount * 3 * (st.heavy ? 1.5 : 1)) * (wall ? 0.6 : 1) * (heroHas(hero, 'clumsy') ? 1.35 : 1);
    if (v.kind === 'player') {
      if ((v.stamina || 0) >= cost) {
        v.stamina -= cost;
        amount *= 1 - power;
        text('blocked', '#a0c8ff');
      } else {
        // Too tired to hold it: the guard's broken and you stagger.
        v.stamina = 0;
        v.blocking = false;
        v.guardBroken = 1.0;
        amount *= 0.75;
        text('guard broken!', '#ff9060');
      }
    } else {
      amount *= 1 - power;
      text('blocked', '#a0c8ff');
    }
    game.audio?.play('armor_hit', v);
  }
  amount = Math.max(guarding ? 0 : 1, Math.round(amount));
  if (amount > 0) {
    game.damage(v, amount, a);
    if (a.windup && a.windup.onHit) a.windup.onHit();
  }
  else game.audio?.play('armor_hit', v);
  // A heavy blow staggers (not if you're sure on your feet).
  if (v.kind === 'player' && heroHas(game.hero, 'sure_footed')) return amount > 0 ? 'hit' : 'blocked';
  if (st.stagger && amount > 0 && !v.dead) v.stunT = Math.max(v.stunT || 0, v.kind === 'player' ? st.stagger * 0.5 : st.stagger);
  if ((st.charge || st.heavy) && amount > 0 && !v.dead) knock(game, a, v, st.charge ? 2 : 1);
  return amount > 0 ? 'hit' : 'blocked';
}

// How hard their blows land (before the weapon's way of fighting).
function baseDamage(a) {
  if (a.kind === 'npc' && a.attackDamage) return a.attackDamage(false);
  if (a.S) return a.S.dmg;
  return 2;
}

// Knocked back a pace or two.
export function knock(game, a, v, n = 1) {
  if (v.kind === 'player' && (v.raft || v.mount)) return;
  const kx = sgn(v.x - a.x);
  const kz = sgn(v.z - a.z);
  if (!kx && !kz) return;
  const dx = Math.abs(kx) >= Math.abs(kz) ? kx : 0;
  const dz = Math.abs(kx) >= Math.abs(kz) ? 0 : kz;
  let x = v.x;
  let z = v.z;
  let y = v.y;
  for (let i = 0; i < n; i++) {
    const ny = game.world.stepTarget(x, y, z, x + dx, z + dz, false);
    if (ny < 0 || game.occupiedBySolid(x + dx, ny, z + dz, v)) break;
    x += dx;
    z += dz;
    y = ny;
  }
  if ((x !== v.x || z !== v.z) && !v.moving) v.startMove(x, y, z, 0.12 * n);
}

// ------------------------------------------------------------ the player
export const MAX_STAMINA = 100;
export const COST = { swing: 7, attack: 12, heavy: 24, roll: 26 };

// Each frame: stamina back when you ease off, the block held or dropped,
// the roll carried through.
export function playerTick(game, p, dt, input, blocked) {
  p.maxStamina = MAX_STAMINA + (game.hero && game.hero.stats ? (game.hero.stats.end || 0) * 6 : 0) + staminaBonus(game.hero);
  if (p.stamina === undefined) p.stamina = p.maxStamina;
  p.restT = (p.restT || 0) + dt;
  if (p.riposte > 0) p.riposte -= dt;
  if (p.guardBroken > 0) p.guardBroken -= dt;
  if (p.rollT > 0) p.rollT -= dt;
  if (p.rollCd > 0) p.rollCd -= dt;
  const want = !blocked && input && input.mouse && input.mouse.rdown && canBlock(game, p) && !(p.guardBroken > 0) && !(p.rollT > 0);
  if (want && !p.blocking) {
    p.blocking = true;
    p.blockT = 0;
  } else if (!want && p.blocking) p.blocking = false;
  if (p.blocking) {
    p.blockT += dt;
    p.restT = 0;
    // Shield toward whoever's about to strike.
    let best = null;
    let bd = 4;
    for (const e of [...game.npcs, ...game.creatures]) {
      if (e.dead || !e.windup || e.windup.target !== p) continue;
      const d = Math.max(Math.abs(e.x - p.x), Math.abs(e.z - p.z));
      if (d < bd) {
        best = e;
        bd = d;
      }
    }
    if (best && !p.moving) p.face(best.x, best.z);
  }
  // (Back faster standing still behind a shield than swinging away.)
  if (p.restT > 0.6) p.stamina = Math.min(p.maxStamina, p.stamina + dt * (p.blocking ? 12 : p.moving ? 22 : 32) * (heroHas(game.hero, 'tireless') ? 1.4 : 1));
}

// A shield on the arm, or a blade in hand, to take a blow on.
export function canBlock(game, p) {
  const h = p.heldDef && p.heldDef();
  return !!(shieldOf(p) || (h && (h.kind === 'weapon' || (h.kind === 'tool' && h.damage >= 3)) && !h.ranged));
}

export function spend(p, n) {
  p.restT = 0;
  const had = p.stamina ?? MAX_STAMINA;
  p.stamina = Math.max(0, had - n);
  return had >= n;
}

// SPACE: a roll in the way you're going (or facing), clear of a blow.
export function roll(game, p, dirv = null) {
  if (p.rollCd > 0 || p.moving || p.dead || p.down || p.restrained || p.raft || p.mount || p.sitting || p.sleeping) return false;
  const cost = COST.roll * (heroHas(game.hero, 'nimble') ? 0.5 : 1) * (heroHas(game.hero, 'clumsy') ? 1.35 : 1);
  if ((p.stamina ?? MAX_STAMINA) < cost * 0.6) {
    game.ui.msg('Too winded to roll.', '#c8c8c8', true);
    return false;
  }
  let [dx, dz] = DIRS[p.dir] || [0, 1];
  if (dirv) [dx, dz] = dirv;
  const w = game.world;
  let x = p.x;
  let z = p.z;
  let y = p.y;
  let n = 0;
  const far = heroHas(game.hero, 'nimble') ? 3 : 2;
  for (let i = 0; i < far; i++) {
    const ny = w.stepTarget(x, y, z, x + dx, z + dz, false);
    if (ny < 0 || game.occupiedBySolid(x + dx, ny, z + dz, p) || w.isWaterAt(x + dx, ny, z + dz)) break;
    x += dx;
    z += dz;
    y = ny;
    n++;
  }
  spend(p, cost);
  p.rollT = 0.42 + (far - 2) * 0.1;
  p.rollCd = 0.75;
  p.blocking = false;
  p.sitting = null;
  game.audio?.play('roll', p);
  game.renderer.emit(p.x, p.y, p.z, { n: 6, color: ['#a89878', '#8a7a5a'], up: 6, speed: 20, life: 0.4, oy: 6, shape: 'puff' });
  if (n) {
    p.startMove(x, y, z, 0.16 * n);
    game.onPlayerStep(x, y, z, false);
  }
  return true;
}
