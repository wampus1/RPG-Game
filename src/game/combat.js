// How a fight goes, blow by blow. Nobody strikes in an instant: every
// attacker winds up first (a red "!" over them, and the ground they'll hit
// lit up red), so there's a moment to get out of the way, get a shield up,
// or hit them first and knock them off their stroke. You too: a quick jab
// with a fist, a long haul back with a greatsword, and once it's started
// you're committed to it. Each beast and each weapon has its own way:
//   a sword: a quick, honest cut;
//   a spear: a thrust that reaches two paces, in a straight line;
//   an axe: a slow, heavy chop that half breaks a guard;
//   a club or a mace: a blow that leaves you reeling;
//   a dagger: fast, and twice;
//   a flail: round the edge of a shield;
//   a staff, a greatsword, a battle axe: a sweep across everything in front;
//   a war hammer: slow, and it flattens you;
//   a halberd: a long hewing thrust;
//   wolves lunge in from a pace off (or snap, close in); slimes slam the
//   ground all round; skeletons hack twice (or bash); a boar charges.
// Bare hands: a jab, or now and then a big swing from the shoulder.
//
// A second weapon in the off hand (where a shield would go) strikes again
// on the heels of the first; a two-handed one leaves no hand for either.
// The watch fights hard: a guard follows you if you only step aside, and
// will string two or three blows together.
//
// You fight with stamina, counted in points: a punch costs one, a blade
// two, heavier arms more; every roll and every blow taken on a shield
// costs some too, and it comes back slowly when you ease off. Hold the
// mouse on a foe for a heavy blow; hold the right button to block (a
// shield takes most of it, a blade a little), and raise it just as the
// blow lands to parry: they're left reeling for a few seconds. SPACE rolls
// you clear.
import { ITEMS, twoHanded, offhandable } from '../world/items.js';
import { dishFx } from './cooking.js';
import { dishTrigger } from './dishacts.js';
import { has as heroHas, staminaBonus } from './hero.js';
import { relicBreath } from './relics.js';
import { onBlock, parryBonus, blockCostMult, rollCostMult, breathMult, onRoll, onDodge, bloodPrice, tickGuard } from './gems.js';
import { onTiles, apart, fits } from '../entities/footprint.js';
import { shakeSpores } from './afflict.js';
import { parryBonusOf, gainMastery } from './mastery.js';

// windup/recover: an enemy's timing; pw: yours (a wind-up you barely see,
// but feel); cost: stamina points a blow.
export const STYLES = {
  fist: { name: 'punch', windup: 0.4, recover: 0.7, reach: 1, mult: 1, cost: 1, pw: 0.07 },
  haymaker: { name: 'haymaker', windup: 0.66, recover: 0.95, reach: 1, mult: 1.6, stagger: 0.45, cost: 1, pw: 0.07 },
  sword: { name: 'cut', windup: 0.42, recover: 0.6, reach: 1, mult: 1, cost: 2, pw: 0.13 },
  spear: { name: 'thrust', windup: 0.55, recover: 0.85, reach: 2, mult: 1.05, thrust: true, cost: 3, pw: 0.2 },
  axe: { name: 'chop', windup: 0.75, recover: 1.0, reach: 1, mult: 1.45, heavy: true, cost: 3, pw: 0.27 },
  club: { name: 'blow', windup: 0.6, recover: 0.8, reach: 1, mult: 1.1, stagger: 0.6, cost: 3, pw: 0.2 },
  dagger: { name: 'stab', windup: 0.26, recover: 0.5, reach: 1, mult: 0.7, flurry: 2, cost: 2, pw: 0.08 },
  flail: { name: 'whirl', windup: 0.68, recover: 0.9, reach: 1, mult: 1.2, stagger: 0.4, pierce: 0.35, cost: 3, pw: 0.27 },
  staff: { name: 'sweep', windup: 0.45, recover: 0.65, reach: 1, mult: 0.95, stagger: 0.3, sweep: true, cost: 2, pw: 0.15 },
  great: { name: 'cleave', windup: 0.88, recover: 1.15, reach: 1, mult: 1.3, heavy: true, sweep: true, cost: 5, pw: 0.42 },
  maul: { name: 'crush', windup: 0.92, recover: 1.2, reach: 1, mult: 1.2, heavy: true, stagger: 1.0, pierce: 0.25, cost: 5, pw: 0.44 },
  halberd: { name: 'hew', windup: 0.78, recover: 1.05, reach: 2, mult: 1.15, thrust: true, heavy: true, cost: 4, pw: 0.34 },
  bite: { name: 'lunge', windup: 0.38, recover: 0.95, reach: 2, mult: 1, lunge: true },
  snap: { name: 'snap', windup: 0.24, recover: 0.6, reach: 1, mult: 0.6 },
  slam: { name: 'slam', windup: 0.65, recover: 1.0, reach: 1, mult: 1.2, area: true },
  bone: { name: 'hack', windup: 0.5, recover: 0.85, reach: 1, mult: 0.85, flurry: 2 },
  bash: { name: 'bash', windup: 0.72, recover: 0.9, reach: 1, mult: 1.3, stagger: 0.5 },
  gore: { name: 'charge', windup: 0.85, recover: 1.5, reach: 5, mult: 1.6, charge: true },
  // A ghoul's three quick rakes (each taken on a shield costs half again the
  // breath), and its spring from two paces off; a wisp's sting, up close.
  rake: { name: 'rake', windup: 0.32, recover: 0.95, reach: 1, mult: 0.55, flurry: 3, drain: 1.3 },
  pounce: { name: 'pounce', windup: 0.5, recover: 1.0, reach: 2, mult: 1.0, lunge: true },
  sting: { name: 'sting', windup: 0.3, recover: 0.8, reach: 1, mult: 0.6 },
};

const SPECIES_STYLE = { wolf: 'bite', slime: 'slam', skeleton: 'bone', boar: 'gore', ghoul: 'rake', wisp: 'sting' };
// (Now and then, another way: a wolf snaps close in, a skeleton bashes, a
// ghoul springs.)
const SPECIES_ALT = { wolf: ['snap', 0.4], skeleton: ['bash', 0.3], ghoul: ['pounce', 0.35] };

// Which way a weapon fights.
export function weaponStyle(key) {
  if (!key) return 'fist';
  const k = String(key).split(/[+~]/)[0];
  if (ITEMS[k] && ITEMS[k].style) return ITEMS[k].style;
  if (/spear|pitchfork|halberd|javelin/.test(k)) return 'spear';
  if (/axe/.test(k)) return 'axe';
  if (/club|mace|hammer|pickaxe|shovel|hoe/.test(k)) return 'club';
  if (/dagger|knife/.test(k)) return 'dagger';
  if (/sword|sabre/.test(k)) return 'sword';
  return ITEMS[k] && ITEMS[k].kind === 'weapon' ? 'sword' : 'fist';
}

// The weapon in someone's fighting hand.
export function mainWeapon(e) {
  if (e.kind === 'player') return e.heldItem ? e.heldItem() : null;
  return e.meleeWeapon ? e.meleeWeapon() : null;
}

// How they fight now. `pick`: choosing the next blow (a beast or a
// bare-handed brawler may mix it up).
export function styleOf(e, pick = false) {
  if (e.kind === 'creature' || e.kind === 'monster') {
    // (Its own way of striking, if it has one.)
    if (e.S && e.S.style && !e.arms) return STYLES[e.S.style];
    // A skeleton fights the way of what it picked up (a sword cuts, an axe
    // chops, a spear thrusts; a bow-skeleton up close bashes with it).
    if (e.arms && e.arms !== 'bow' && !(pick && e.rng && e.rng.chance(0.2))) return STYLES[weaponStyle(e.arms)] || STYLES.bone;
    if (e.arms === 'bow') return STYLES.bash;
    const alt = SPECIES_ALT[e.species];
    if (pick && alt && e.rng && e.rng.chance(alt[1])) return STYLES[alt[0]];
    return STYLES[SPECIES_STYLE[e.species]] || STYLES.bite;
  }
  const w = mainWeapon(e);
  const k = weaponStyle(w && ITEMS[w] && !ITEMS[w].ranged ? w : null);
  if (k === 'fist' && pick && e.kind !== 'player' && e.rng && e.rng.chance(0.3)) return STYLES.haymaker;
  return STYLES[k];
}

// How slow a weapon is beside others of its kind (1: middling).
export function heftOf(e) {
  const w = mainWeapon(e);
  return (w && ITEMS[w] && ITEMS[w].heft) || 1;
}

// A shield's stats (what's worn on the arm): none with a two-handed weapon
// out (it's slung on the back), nor with a blade on that arm instead.
export function shieldOf(e) {
  const k = e.kind === 'player' ? e.equip && e.equip.shield : e.rec && e.rec.equipment && e.rec.equipment.shield;
  const it = k && ITEMS[k];
  // (A torch in that hand is no shield, for all a block item has a `block`.)
  if (!it || !it.block || it.kind !== 'armor') return null;
  return twoHanded(mainWeapon(e)) ? null : it;
}

// A second weapon carried in the off hand (where a shield would be), if
// the main hand leaves room for it.
export function offhandOf(e) {
  const k = e.kind === 'player' ? e.equip && e.equip.shield : e.rec && e.rec.equipment && e.rec.equipment.shield;
  if (!offhandable(k)) return null;
  const main = mainWeapon(e);
  const m = main && ITEMS[main];
  if (twoHanded(main) || (m && m.ranged)) return null;
  // (Not with a pick or a shovel in the other hand: a fighting hand.)
  if (m && m.kind !== 'weapon') return null;
  return k;
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

// The arc a sweep cuts in front of someone: the tile ahead and those to
// either side of it.
export function sweepTiles(a, target) {
  const [hx, hz] = headingTo(a, target);
  return [{ x: a.x + hx, z: a.z + hz }, { x: a.x + hx - hz, z: a.z + hz + hx }, { x: a.x + hx + hz, z: a.z + hz - hx }];
}

// The ground a blow will land on.
// A tile as far toward another as a blow can reach (no further: a blow
// aimed at someone out of reach lands at the edge of it, and whiffs).
function reachToward(a, t, reach) {
  const r = Math.max(1, Math.floor(reach || 1));
  return { x: a.x + Math.max(-r, Math.min(r, t.x - a.x)), z: a.z + Math.max(-r, Math.min(r, t.z - a.z)) };
}
function withinReach(a, tiles, reach) {
  const out = [];
  for (const t of tiles) {
    const q = reachToward(a, t, reach);
    if (!out.some((o) => o.x === q.x && o.z === q.z)) out.push(q);
  }
  return out;
}

function tilesFor(a, target, st) {
  if (a.foot) return bigTiles(a, target, st);
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
  if (st.sweep) {
    const arc = sweepTiles(a, target);
    if (!arc.some((t) => t.x === target.x && t.z === target.z)) arc.push({ x: target.x, z: target.z });
    return withinReach(a, arc, st.reach);
  }
  out.push(reachToward(a, target, st.reach));
  return out;
}

// A great master's blows (see entities/footprint.js): off the whole of the
// side it's facing, as far out from its edge as the blow reaches (all the
// way round it for a blow that sweeps the ground about it).
function bigTiles(a, target, st) {
  const r = a.foot;
  const out = [];
  if (st.area) {
    for (let dz = -r - 1; dz <= r + 1; dz++) for (let dx = -r - 1; dx <= r + 1; dx++) if (Math.max(Math.abs(dx), Math.abs(dz)) === r + 1) out.push({ x: a.x + dx, z: a.z + dz });
    return out;
  }
  const [hx, hz] = headingTo(a, target);
  const reach = st.charge ? 1 : Math.max(1, Math.floor(st.reach || 1));
  for (let k = 1; k <= reach; k++) {
    for (let j = -r - (st.sweep ? 1 : 0); j <= r + (st.sweep ? 1 : 0); j++) out.push({ x: a.x + hx * (r + k) - hz * j, z: a.z + hz * (r + k) + hx * j });
  }
  return out;
}

// Close enough to start a blow at them? (Edge to edge, for a great master.)
export function inReach(a, target, st = styleOf(a)) {
  if (!target || target.dead || Math.abs(target.y - a.y) > 1) return false;
  const d = apart(a, target);
  const w = (a.foot || 0) + (target.foot || 0);
  const inLine = Math.abs(target.x - a.x) <= w || Math.abs(target.z - a.z) <= w;
  if (st.charge) return d >= 2 && d <= st.reach && inLine;
  if (st.thrust) return d <= st.reach && (d <= 1 || inLine);
  return d <= st.reach;
}

// Wind up a blow at the target. False if one's already coming. `opts`:
// combo (that many more blows to follow), press (a chance they follow
// you if you only step aside).
export function beginAttack(game, a, target, st = styleOf(a), opts = null) {
  if (a.windup || (a.attackCd || 0) > 0 || (a.stunT || 0) > 0) return false;
  a.face(target.x, target.z);
  // (A boar too close to charge just gores.)
  if (st.charge && Math.max(Math.abs(target.x - a.x), Math.abs(target.z - a.z)) <= 1) st = { ...st, charge: false, reach: 1, windup: 0.5, mult: 1.1 };
  const tiles = tilesFor(a, target, st);
  // Heavier arms come round slower; lighter ones quicker.
  // (A far island's master is quicker with its blows: see ISLE_BOSS_TEMPO.)
  let dur = st.windup * heftOf(a) * (a.slowT > 0 ? 1.3 : 1) * (a.tempo ? 1 / Math.sqrt(a.tempo) : 1);
  // (A master always gives you time to see a blow coming: a great one,
  // a bit more.)
  if (a.isBoss) dur = Math.max(dur, a.foot ? BOSS_MIN_WINDUP + 0.15 : BOSS_MIN_WINDUP);
  // (A master at tier 3 strings its blows together: see bosstier.js.)
  const combo = (opts && opts.combo) || (a.isBoss && a.tier >= 3 && Math.random() < 0.4 ? 1 + (Math.random() < 0.3 ? 1 : 0) : 0);
  a.windup = { t: 0, dur, st, target, tiles, y: a.y, heading: headingTo(a, target), combo, press: (opts && opts.press) || 0 };
  if ((st.heavy || st.charge || st === STYLES.haymaker) && speaks(a)) a.say?.(a.rng?.pick?.(['Hrrah!', 'Graaah!', 'Hyaah!']) || 'Hrah!', 0.6, '#ff9080');
  return true;
}

// Interrupted mid-swing (hit hard, or parried): no blow this time.
export function interrupt(a, stun = 0.5) {
  if (a.swing) {
    a.swing = null;
    a.stunT = Math.max(a.stunT || 0, stun);
    return true;
  }
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
  // The blade in the other hand, hard on the heels of the first.
  const off = !w.offDone && !w.off && !a.dead && offhandOf(a);
  if (off) {
    w.offDone = true;
    w.off = off;
    w.t = w.dur - 0.18;
    w.tiles = tilesFor(a, w.target, STYLES[weaponStyle(off)]);
    return true;
  }
  // Another, and another: a guard who won't let up.
  const t = w.target;
  if (w.combo > 0 && t && !t.dead && !t.down && !a.dead && Math.max(Math.abs(t.x - a.x), Math.abs(t.z - a.z)) <= w.st.reach + 1) {
    w.combo--;
    w.off = null;
    w.offDone = false;
    w.flurried = 0;
    w.t = 0;
    w.dur = w.st.windup * heftOf(a) * 0.75;
    a.face(t.x, t.z);
    w.heading = headingTo(a, t);
    w.tiles = tilesFor(a, t, w.st);
    return true;
  }
  a.windup = null;
  a.attackCd = w.st.recover * (a.kind === 'npc' && a.rec && a.rec.job === 'guard' && a.rec.drilled ? 0.85 : 1) / (a.tempo || 1);
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
  const r = a.foot || 0;
  const front = r ? bigTiles(a, { x: a.x + hx * 9, z: a.z + hz * 9 }, { reach: 1 }) : [{ x: nx, z: nz }];
  const victim = victimsAt(game, a, front)[0];
  if (victim) {
    d.hit = true;
    resolveHit(game, a, victim, w.st);
    return true;
  }
  const ny = game.world.stepTarget(a.x, a.y, a.z, nx, nz, false);
  if (ny < 0 || game.occupiedBySolid(nx, ny, nz, a) || (r && !fits(game, a, nx, ny, nz)) || (a.leash && (nx < a.leash.x0 || nx > a.leash.x1 || nz < a.leash.z0 || nz > a.leash.z1))) {
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
  const on = (e) => onTiles(e, tiles) && Math.abs(e.y - a.y) <= 1;
  const p = game.player;
  const target = a.windup && a.windup.target;
  if (!p.dead && on(p) && !a.petOf && (target === p || a.hostileNow || a.threat === p || a.kind === 'creature' || a.kind === 'monster')) out.push(p);
  // (Only what they're after, or its side: no cutting down bystanders.)
  if (target && target !== p && !target.dead && on(target)) out.push(target);
  return out;
}

// The blow, as it's drawn (see renderer.swingPose).
export function strikeAnim(e, st, off = false) {
  e.strike = { t: 0, dur: st && st.heavy ? 0.4 : 0.3, st: st || STYLES.fist, off };
}

function strike(game, a, w) {
  const st = w.off ? STYLES[weaponStyle(w.off)] : w.st;
  strikeAnim(a, st, !!w.off);
  if (!w.off) a.doAction?.(0.3);
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
      if (ny >= 0 && !game.occupiedBySolid(nx, ny, nz, a) && (!a.foot || fits(game, a, nx, ny, nz))) a.startMove(nx, ny, nz, 0.08);
    }
    if (!a.foot) w.tiles = [{ x: t.x, z: t.z }];
    // (Only if they're still within a bound of it.)
    if (d > 2) return;
  }
  // Pressing in: stepped aside? They follow you (a guard, a soldier) and
  // strike where you are now. Rolling still gets you clear.
  const t = w.target;
  if (w.press && t && !t.dead && !(t.rollT > 0) && !w.tiles.some((q) => q.x === t.x && q.z === t.z) && a.rng && a.rng.chance(w.press)) {
    const d = Math.max(Math.abs(t.x - a.x), Math.abs(t.z - a.z));
    if (d === 2 && !a.moving) {
      const [hx, hz] = headingTo(a, t);
      const ny = game.world.stepTarget(a.x, a.y, a.z, a.x + hx, a.z + hz, false);
      if (ny >= 0 && !game.occupiedBySolid(a.x + hx, ny, a.z + hz, a) && (!a.foot || fits(game, a, a.x + hx, ny, a.z + hz))) a.startMove(a.x + hx, ny, a.z + hz, 0.08);
    }
    if (d <= 2 && !a.foot) {
      a.face(t.x, t.z);
      w.tiles = [{ x: t.x, z: t.z }];
    }
  }
  // (However they've turned, a blow reaches as far as it reaches. A great
  // master's lands where it was shown coming, off its front.)
  if (!a.foot && !w.st.area && !w.st.charge) w.tiles = withinReach(a, w.tiles, w.st.lunge ? 1 : st.reach);
  // (A master's blow lands as hard as it was slow in coming: see
  // tellScale. The quick second blows of a flurry or the off hand, lighter.)
  const hard = a.isBoss ? bossBlowScale(w) : 1;
  const hit = hard === 1 ? st : { ...st, mult: st.mult * hard };
  for (const v of victimsAt(game, a, w.tiles)) resolveHit(game, a, v, hit, w.off ? { weapon: w.off } : null);
}

// A shield (or a blade) up toward a blow of `amount`: what gets through,
// and whether they were guarding; or 'parried', up just as it came.
export function guardBlow(game, a, v, amount, st, opts = null) {
  const text = (s, c) => game.renderer.floatText(v.x, v.y + 2, v.z, s, c);
  const sh = shieldOf(v);
  const guarding = v.kind === 'player' ? v.blocking : sh && v.state === 'fight' && v.rng && v.rng.chance(v.rec && v.rec.job === 'guard' ? 0.45 : 0.25);
  if (guarding && facing(v, a)) {
    // Up just as it came: parried, and they're left reeling.
    const hero = v.kind === 'player' ? game.hero : null;
    if (v.kind === 'player' && v.blockT !== undefined && v.blockT < parryWindow(game, a) && !st.charge) {
      parried(game, v, a);
      return 'parried';
    }
    const wall = sh && heroHas(hero, 'shieldbearer');
    // (A Phase Blade's edge is never quite where the shield is.)
    const phase = ITEMS[(opts && opts.weapon) || mainWeapon(a)]?.pierce || 0;
    const power = Math.min(0.95, Math.max(0.15, (sh ? sh.block : 0.4) + (wall ? 0.1 : 0) - (st.heavy ? 0.3 : 0) - (st.charge ? 0.25 : 0) - (st.pierce || 0) - phase * 0.7));
    const cost = (0.6 + amount * 0.3 * (st.heavy ? 1.5 : 1)) * (wall ? 0.6 : 1) * blockCostMult(v) * (st.drain || 1);
    const before = amount;
    if (v.kind === 'player') {
      if ((v.stamina || 0) >= cost) {
        v.stamina -= cost;
        amount *= 1 - power;
        text('blocked', '#a0c8ff');
      } else if (bloodPrice(game, v)) {
        // (A bloodstone shield takes it in blood instead, and holds.)
        v.stamina = 0;
        amount *= 1 - power;
      } else {
        // Too tired to hold it: the guard's broken and you stagger.
        v.stamina = 0;
        v.blocking = false;
        v.guardBroken = 1.0;
        amount *= 0.75;
        text('guard broken!', '#ff9060');
        game.shake = Math.min(1.2, (game.shake || 0) + 0.4);
      }
    } else {
      amount *= 1 - power;
      text('blocked', '#a0c8ff');
    }
    // Sparks off the shield (or the blade); and its stone at work. (It
    // jolts back on the arm; theirs stays up a moment after.)
    v.shieldJolt = 0.18;
    if (v.kind !== 'player') v.guardT = 0.7;
    game.renderer.emit(v.x, v.y + 1.1, v.z, { n: 8, color: ['#ffffff', '#ffe8a0', '#c8d8ff'], up: 30, speed: 60, life: 0.25, glow: true });
    if (!(v.guardBroken > 0)) onBlock(game, v, a, false, before - amount);
    if (v.kind === 'player') game.shake = Math.min(1.2, (game.shake || 0) + 0.18);
    game.audio?.play('armor_hit', v);
  }
  return { amount, guarding };
}

export const BOSS_MIN_WINDUP = 0.45;
// How hard a master's blow lands, by the warning it gave.
export function bossBlowScale(w) {
  const quick = w.off || (w.flurried || 0) > 1;
  return Math.max(0.4, Math.min(1.4, (quick ? 0.25 : w.dur) / 0.7));
}

// A blow lands (or doesn't). `opts.weapon`: struck with that (the off
// hand's blade) rather than the main one.
export function resolveHit(game, a, v, st, opts = null) {
  if (v.dead || v.down) return 'none';
  const text = (s, c) => game.renderer.floatText(v.x, v.y + 2, v.z, s, c);
  // Rolled clear.
  if (v.rollT > 0) {
    text('dodged', '#c8e8ff');
    onDodge(game, v);
    game.renderer.emit(v.x, v.y + 0.3, v.z, { n: 5, color: ['#c8e8ff', '#ffffff'], up: 10, speed: 30, life: 0.3 });
    return 'dodged';
  }
  const g = guardBlow(game, a, v, (opts && opts.weapon ? offDamage(a, opts.weapon) : baseDamage(a)) * st.mult, st, opts);
  if (g === 'parried') return 'parried';
  const { guarding } = g;
  let { amount } = g;
  amount = Math.max(guarding ? 0 : 1, Math.round(amount));
  // A ghoul's rake drinks your breath, whether it lands or not: a stream of
  // it torn out of you and into its mouth, and it's the stronger for it.
  if (st.drain && v.kind === 'player' && !v.dead) siphonBreath(game, a, v, guarding && amount === 0 ? 0.5 : 0.9);
  if (amount > 0) {
    game.damage(v, amount, a);
    if (a.windup && a.windup.onHit) a.windup.onHit();
    // (What its kind does to you besides: see islemobs.js.)
    if (a.S && a.S.onHit && !v.dead) a.S.onHit(game, a, v);
    // (Round 62) A mod's weapon, or one of a mod's creatures: its own.
    game.onModStruck?.(a, v, amount);
    // (A grab: held fast, till you roll free.)
    if (st.grab && v.kind === 'player' && !v.dead) {
      v.grabbedT = 1.4;
      text('grabbed! (roll free)', '#80d0c0');
    }
  }
  else game.audio?.play('armor_hit', v);
  // A heavy blow staggers (not if you're sure on your feet).
  if (v.kind === 'player' && heroHas(game.hero, 'sure_footed')) return amount > 0 ? 'hit' : 'blocked';
  // (A master of an old place isn't staggered: round 61.)
  if (st.stagger && amount > 0 && !v.dead && !(v.isBoss || v.S?.boss)) v.stunT = Math.max(v.stunT || 0, v.kind === 'player' ? st.stagger * 0.5 : st.stagger);
  if ((st.charge || st.heavy) && amount > 0 && !v.dead) knock(game, a, v, st.charge ? 2 : 1);
  return amount > 0 ? 'hit' : 'blocked';
}

// Breath torn out of someone (a ghoul's feeding): it shows going.
export function siphonBreath(game, a, v, n) {
  const had = v.stamina ?? MAX_STAMINA;
  const took = Math.min(had, n);
  if (took <= 0.05) return 0;
  v.stamina = had - took;
  v.restT = 0;
  v.drainFlash = 0.8;
  const r = game.renderer;
  r.effect?.({ type: 'siphon', wx: v.x, wy: v.y + 1.1, wz: v.z, tx: a.x, ty: a.y + 0.9, tz: a.z, life: 0.65, oy: -6, n: 18, amp: 5, color: ['#c8ffd0', '#7ce0a0', '#ffffff', '#4aa070'] });
  r.emit(v.x, v.y + 1.2, v.z, { n: 5, color: ['#c8ffd0', '#7ce0a0'], up: 14, speed: 18, gravity: -10, life: 0.5, oy: -8 });
  r.floatText(v.x, v.y + 1.6, v.z, `-${Math.round(took * 10) / 10} stamina`, '#9cf0b0');
  // (Fed: a little of its own strength back, and its eyes burn brighter.)
  a.fedT = 1.6;
  if (a.hp < a.maxHp) a.hp = Math.min(a.maxHp, a.hp + 1);
  r.emit(a.x, a.y + 1.3, a.z, { n: 4, color: ['#c8ffd0', '#ffffff'], up: 8, speed: 10, gravity: -16, life: 0.6, oy: -10, glow: true });
  game.audio?.play('drain', v);
  return took;
}

// How soon before the blow a raised guard turns it into a parry.
// (Round 61: a shield on your arm gives a little longer; a master at its
// hardest, `a` (see bosstier.js), a little less.)
export function parryWindow(game, a = null) {
  // (Round 54: and a little more for each rank of swordplay: see mastery.js.)
  const w = (heroHas(game.hero, 'duelist') ? 0.3 : 0.2) + parryBonus(game.player) + parryBonusOf(game) + (game.player && shieldOf(game.player) ? SHIELD_PARRY : 0);
  return w * (a && a.parryK ? a.parryK : 1);
}
// How much longer a shield holds the parry open (seconds).
export const SHIELD_PARRY = 0.07;

// A parry: the blow turned aside at the last instant with a crack of
// steel. The world holds its breath; they reel back, dazed for a few
// seconds and wide open; you've a moment for a riposte.
export function parried(game, v, a) {
  const r = game.renderer;
  r.floatText(v.x, v.y + 2.6, v.z, 'PARRY!', '#ffe070');
  // (Practice: see mastery.js.)
  if (v.kind === 'player' && v === game.player) gainMastery(game, 'dueling', 0.4);
  game.audio?.play('parry', v);
  game.audio?.play('armor_hit', v);
  interrupt(a, 2.8);
  a.stunT = Math.max(a.stunT || 0, 2.6 + Math.random() * 0.6);
  // (Some masters answer a parry in their own way: a shell prised open, a
  // fury cooled.)
  a.S?.onParried?.(game, a, v);
  onBlock(game, v, a, true);
  a.windup = null;
  a.attackCd = Math.max(a.attackCd || 0, 1.2);
  knock(game, v, a, 1);
  v.riposte = 1.6;
  v.stamina = Math.min(v.maxStamina || MAX_STAMINA, (v.stamina || 0) + 2);
  // Hit-stop, then a breath of slow motion.
  game.hitStop = Math.max(game.hitStop || 0, 0.16);
  game.slowMo = Math.max(game.slowMo || 0, 0.55);
  game.slowMoScale = 0.3;
  game.shake = Math.min(1.3, (game.shake || 0) + 0.8);
  r.flashScreen?.('#fff4c8', 0.22);
  const mx = (v.x + a.x) / 2;
  const mz = (v.z + a.z) / 2;
  r.emit(mx, v.y + 1.2, mz, { n: 26, color: ['#ffffff', '#fff8c0', '#ffe070', '#ffb040'], up: 40, speed: 110, life: 0.45, glow: true, gravity: 120 });
  r.emit(mx, v.y + 1.2, mz, { n: 8, color: ['#ffffff', '#ffe070'], up: 20, speed: 40, life: 0.8, shape: 'star', glow: true, gravity: -10 });
  r.effect?.({ type: 'ring', wx: mx, wy: v.y, wz: mz, r0: 2, r1: 24, color: '#ffe070', life: 0.45, oy: -14, flat: 0.55, thick: 2 });
  r.effect?.({ type: 'ring', wx: mx, wy: v.y, wz: mz, r0: 1, r1: 12, color: '#ffffff', life: 0.3, oy: -14, flat: 0.55, thick: 1 });
  // (Only someone with words to say says anything.)
  if (speaks(a)) a.say?.(a.rng?.pick?.(['Urgh!', 'What?!', 'Agh!', 'Nngh!']) || 'Agh!', 1.2, '#ffd0a0');
}

// People, and those who were people: not beasts, the dead, golems or the
// things of the deep, which have no words to cry out with.
export function speaks(a) {
  if (!a || a.kind === 'player') return false;
  if (a.kind === 'npc') return true;
  const S = a.S;
  if (!S) return false;
  if (S.bandit) return true;
  return !!(S.humanoid && !S.undead && !S.construct && !S.night && !S.mute && !S.infected);
}

// How hard their blows land (before the weapon's way of fighting).
function baseDamage(a) {
  if (a.kind === 'npc' && a.attackDamage) return a.attackDamage(false);
  if (a.S) return a.S.dmg * (a.dmgMult || 1);
  return 2;
}

// The off hand's blade: a little lighter than the main hand's.
function offDamage(a, key) {
  const it = ITEMS[key];
  const main = baseDamage(a);
  const mw = mainWeapon(a);
  const ratio = it && mw && ITEMS[mw] && ITEMS[mw].damage ? it.damage / ITEMS[mw].damage : 1;
  return Math.max(1, main * ratio * 0.75);
}

// Knocked back a pace or two.
export function knock(game, a, v, n = 1) {
  if (v.kind === 'player' && (v.raft || v.mount)) return;
  // (Nothing shoves one of the great masters about.)
  if (v.foot) return;
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
  if ((x !== v.x || z !== v.z) && !v.moving) {
    v.startMove(x, y, z, 0.12 * n);
    // (Dust kicked up where they're shoved.)
    game.renderer.emit(v.x, v.y, v.z, { n: 4, color: ['#a89878', '#8a7a5a'], up: 6, speed: 18, life: 0.4, oy: 6, shape: 'puff' });
  }
}

// ------------------------------------------------------------ the player
export const MAX_STAMINA = 10;
export const COST = { fist: 1, roll: 3 };

// A potion still working: how much it gives (0 if none).
export function buffOf(game, k) {
  const p = game.player;
  if (!p || !p.buffs) return 0;
  const now = game.day * 1440 + game.minute;
  let n = 0;
  for (const q of p.buffs) if (q.combat === k && q.until > now) n = Math.max(n, q.n);
  // (And what the dishes you've eaten give, or take: see cooking.js.)
  return n + dishFx(p, k);
}

// What a fighting potion does, in words.
export function combatBuffText(e) {
  return { breath: `+${e.n} stamina`, wind: `stamina back ${Math.round(e.n * 100)}% faster`, fury: `blows ${Math.round(e.n * 100)}% harder`, haste: `blows ${Math.round(e.n * 100)}% quicker` }[e.combat] || '';
}

// Stamina points a blow costs you.
export function staminaCost(st, heavy = false) {
  return (st.cost || 2) * (heavy ? 2 : 1);
}

// Each frame: stamina back when you ease off, the block held or dropped,
// the roll carried through, your own swing coming round.
// Days gone without a proper sleep (each one a point off your breath until
// you sleep it off).
export function sleepless(game, p) {
  if (p.awakeSince === undefined) return 0;
  const now = game.day * 1440 + game.minute;
  return Math.max(0, Math.min(6, Math.floor((now - p.awakeSince) / 1440)));
}

export function playerTick(game, p, dt, input, blocked) {
  const tired = sleepless(game, p);
  if (tired !== (p.sleepless || 0)) {
    if (tired > (p.sleepless || 0)) game.ui.msg(`${tired === 1 ? 'A whole day' : `${tired} days`} without sleep: your max stamina is down ${tired} until you sleep it off.`, '#c090ff');
    p.sleepless = tired;
  }
  p.maxStamina = Math.max(2, MAX_STAMINA + (game.hero && game.hero.stats ? (game.hero.stats.end || 0) * 0.6 : 0) + staminaBonus(game.hero) / 10 + buffOf(game, 'breath') - tired);
  if (p.stamina === undefined) p.stamina = p.maxStamina;
  p.restT = (p.restT || 0) + dt;
  if (p.riposte > 0) p.riposte -= dt;
  if (p.guardBroken > 0) p.guardBroken -= dt;
  if (p.rollT > 0) p.rollT -= dt;
  if (p.rollRecover > 0) p.rollRecover -= dt;
  if (p.rollCd > 0) p.rollCd -= dt;
  if (p.commitT > 0) p.commitT -= dt;
  if (p.swing) tickSwing(game, p, dt);
  if (p.offSwing) {
    p.offSwing.t -= dt;
    if (p.offSwing.t <= 0) {
      const o = p.offSwing;
      p.offSwing = null;
      if (!p.dead && !(p.stunT > 0)) o.land();
    }
  }
  const want = !blocked && input && input.mouse && input.mouse.rdown && canBlock(game, p) && !(p.guardBroken > 0) && !(p.rollT > 0) && !p.swing && !(p.commitT > 0);
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
  // (Back faster standing still behind a shield than swinging away; and
  // slowly at that.)
  const morning = (game.minute >= 300 && game.minute < 600 && heroHas(game.hero, 'early_riser')) || ((game.minute >= 1200 || game.minute < 120) && heroHas(game.hero, 'night_owl'));
  const regen = (p.blocking ? 0.9 : p.moving ? 1.7 : 2.6) * (heroHas(game.hero, 'tireless') ? 1.4 : 1) * (1 + buffOf(game, 'wind')) * breathMult(p) * (morning ? 2 : 1) * relicBreath(game, p);
  if (p.rollStrike > 0) p.rollStrike -= dt;
  tickGuard(game, p, dt);
  if (p.restT > 0.75) p.stamina = Math.min(p.maxStamina, p.stamina + dt * regen);
  if (p.stamina > p.maxStamina) p.stamina = Math.max(p.maxStamina, p.stamina - dt * 2);
}

// A shield on the arm, or a blade in hand, to take a blow on.
export function canBlock(game, p) {
  const h = p.heldDef && p.heldDef();
  // (Something in hand that the right button uses (food, a potion, a
  // gadget, a bucket...): it's used, shield or no shield.)
  if (usedByHand(h)) return false;
  return !!(shieldOf(p) || offhandOf(p) || (h && (h.kind === 'weapon' || (h.kind === 'tool' && h.damage >= 3)) && !h.ranged));
}

const HAND_USED = new Set(['bucket', 'water_bucket', 'hoe', 'dice', 'wagon', 'lead', 'saddle', 'raft', 'fishing_rod']);
export function usedByHand(h) {
  if (!h) return false;
  if (['food', 'potion', 'gadget', 'enhancer', 'relic'].includes(h.kind)) return true;
  if (h.kind === 'armor' && !h.block) return true;
  return !!(h.newspaper || h.raft || h.fishing || HAND_USED.has(h.key));
}

export function spend(p, n) {
  p.restT = 0;
  const had = p.stamina ?? MAX_STAMINA;
  p.stamina = Math.max(0, had - n);
  return had >= n;
}

// Your blow, begun: a wind-up by the weight of what's in your hand (none
// to speak of with a fist, a long haul back with a war hammer), then it
// lands, wherever they are by then. Once begun, you're committed: no
// stepping away, no rolling out of it.
export function playerSwing(game, p, target, heavy, land) {
  const st = styleOf(p);
  const quick = 1 / (1 + buffOf(game, 'haste'));
  const dur = st.pw * heftOf(p) * (heavy ? 0.6 : 1) * quick;
  p.swing = { t: 0, dur, target, heavy, st, land };
  p.blocking = false;
  p.sitting = null;
  if (dur <= 0.001) tickSwing(game, p, 0);
  return p.swing;
}

function tickSwing(game, p, dt) {
  const s = p.swing;
  if (!s) return;
  if (p.dead || p.stunT > 0 || p.down || p.guardBroken > 0) {
    p.swing = null;
    return;
  }
  s.t += dt;
  if (s.t < s.dur) return;
  p.swing = null;
  // (A moment's follow-through before you can move again.)
  p.commitT = 0.06 + s.st.pw * 0.6;
  s.land();
}

// SPACE: a roll in the way you're going (or facing), clear of a blow.
export function roll(game, p, dirv = null) {
  // A fallen star's wing: a second roll straight after the first (at its
  // end, or just after), or a roll when you've no breath left for one at
  // all: it costs no stamina, the wing's spent instead, and grows back
  // (see Player.update).
  const normalCost = COST.roll * (heroHas(game.hero, 'nimble') ? 0.5 : 1) * rollCostMult(p);
  const winded = (p.stamina ?? MAX_STAMINA) < normalCost * 0.6;
  const wingRoll = (p.rollCd > 0 || winded) && !!p.wing && p.wing.k >= 0.999 && !(p.rollT > 0.12);
  // (Not with an arrow on the string, drawing or holding it.)
  if ((p.rollCd > 0 && !wingRoll) || p.dead || p.down || p.restrained || p.raft || p.mount || p.sitting || p.sleeping || p.swing || p.commitT > 0 || p.bowDraw) return false;
  // (Swallowed: no room to roll in there.)
  if (p.swallowed) return false;
  if (p.grabbedT > 0) {
    p.grabbedT = 0;
    game.renderer.floatText(p.x, p.y + 2.4, p.z, 'wrenched free!', '#c8e8ff');
  }
  // (Mid-stride is fine: the roll carries on from where you are.)
  const from = p.moving ? p.renderPos() : null;
  const cost = wingRoll ? 0 : normalCost;
  if (!wingRoll && winded) {
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
  // Low and quick, under a swing and past whoever's in the way (you can't
  // end up on top of them, so on a pace further if that's free).
  let land = null;
  const start = { x: p.x, y: p.y, z: p.z };
  const past = [];
  for (let i = 0; i < far + 2; i++) {
    const ny = w.stepTarget(x, y, z, x + dx, z + dz, false);
    if (ny < 0 || w.isWaterAt(x + dx, ny, z + dz)) break;
    x += dx;
    z += dz;
    y = ny;
    n++;
    if (!game.occupiedBySolid(x, y, z, p)) land = { x, y, z, n };
    else {
      const e = game.entityAt ? game.entityAt(x, y, z) : null;
      if (e && e !== p) past.push(e);
    }
    if (n >= far && land && land.n === n) break;
  }
  if (cost) spend(p, cost);
  if (wingRoll) {
    // (The wing beats once, hard, and goes thin and grey: a burst of blue
    // light off it, a ring of wind over the ground, and the roll itself
    // a streak of light, see Renderer.drawTumble.)
    p.wing.k = 0;
    p._wingT = 0;
    p.wingDash = 0.55;
    const r = game.renderer;
    r.effect?.({ type: 'wingbeat', wx: p.x, wz: p.z, wy: p.y, oy: -9, dx, dz, life: 0.55 });
    r.effect?.({ type: 'ring', wx: p.x, wz: p.z, wy: p.y, oy: 2, r0: 4, r1: 26, flat: 0.45, thick: 1, color: ['#a8dcff', '#e0f4ff', '#4f8fe8'], life: 0.45 });
    r.effect?.({ type: 'ring', wx: p.x, wz: p.z, wy: p.y, oy: 2, r0: 2, r1: 14, flat: 0.45, thick: 1, color: ['#ffffff', '#a8dcff'], life: 0.3 });
    r.emit(p.x, p.y + 1.2, p.z, { n: 18, color: ['#a8dcff', '#e0f4ff', '#ffffff', '#5ea4f0'], up: 26, speed: 42, life: 0.7, gravity: 10, glow: true });
    r.emit(p.x, p.y + 1, p.z, { n: 8, color: ['#68aef4', '#3f7ad8'], up: 12, speed: 26, life: 1.0, gravity: 4, shape: 'puff', grow: 1 });
    game.audio?.play('flap', p);
    game.audio?.play('whoosh', p);
  }
  p.rollT = 0.36 + (far - 2) * 0.08;
  // (Tumbling shakes spores off you.)
  if (p.spores > 0) shakeSpores(game, p);
  p.rollDur = p.rollT;
  p.rollCd = 0.75;
  // (A breath to find your feet again after: a little slower for a moment.)
  p.rollRecover = p.rollT + 0.32;
  p.rollDir = [dx, dz];
  p.blocking = false;
  p.sitting = null;
  game.audio?.play('roll', p);
  game.renderer.emit(p.x, p.y, p.z, { n: 8, color: ['#a89878', '#8a7a5a'], up: 8, speed: 30, life: 0.45, oy: 6, shape: 'puff' });
  // (Round 53: a dish that answers a roll: see dishacts.js.)
  if (p.kind === 'player') dishTrigger(game, p, 'roll', {});
  if (land) {
    // Fast: twice a run's pace, quickest at the start.
    p.startMove(land.x, land.y, land.z, 0.075 * land.n + (from ? 0.04 : 0));
    p.moveEase = 'out';
    if (from) {
      p.fx = from.x;
      p.fy = from.y;
      p.fz = from.z;
    }
    game.onPlayerStep(land.x, land.y, land.z, false);
  }
  // (The armour's stones: flame left behind, those rolled past thrown
  // aside, a blow straight out of it.)
  onRoll(game, p, start, land ? past.filter((e) => Math.abs(e.x - start.x) + Math.abs(e.z - start.z) < land.n) : []);
  return true;
}
