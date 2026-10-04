// Shooting, for you: hold the mouse button to draw a bow (or wind a sling,
// or crank a crossbow), aim with the mouse, let go to loose. A full draw
// flies further and hits harder; let go early and it's a feeble shot.
// Drawing slows you down and costs a little stamina, and holding a full
// draw costs more as the arm tires (a cocked crossbow holds for free);
// there's no rolling with an arrow on the string. The arrow flies the way
// you aimed and strikes the first thing in its way (a wall stops it), and
// one that takes someone in the head (aim at it) strikes half as hard
// again. A javelin's thrown the same way, at once.
//
// Arrows in general: a shield turned toward the archer stops one easily (a
// crossbow bolt often goes through), and a shot to the head, whoever looses
// it, does half as much again.
import { ITEMS } from '../world/items.js';
import { BLOCKS } from '../world/blocks.js';
import { countItem, removeItem } from './inventory.js';
import { gemsOf, arrowSpeed, splitShot, mirrorShot } from './gems.js';
import { has as heroHas, cooldownMult } from './hero.js';
import { buffOf, shieldOf, facing, strikeAnim, STYLES, MAX_STAMINA } from './combat.js';
import { aegisUp } from './kavtech.js';
import { covers, padded, padOf } from '../entities/footprint.js';
import { shielded } from '../entities/monsters.js';

const DIRS = [[0, 1], [-1, 0], [0, -1], [1, 0]];

// Weapons drawn before they're loosed (a javelin's just thrown).
export const drawable = (def) => !!(def && def.ranged && !def.thrown);

// How long a full draw takes, what it costs (stamina points over the draw),
// and what holding it costs each second: by weapon (anything else draws
// like a hunting bow).
// (The Kavorent's caster has nothing to pull: it charges from your breath.)
const DRAW = { bow: [0.75, 1, 0.5], longbow: [1.05, 2, 0.7], crossbow: [1.2, 2, 0], sling: [0.6, 1, 0.35], kav_caster: [0.55, 2, 0.5] };
export function drawSpec(key) {
  const base = (ITEMS[key] && ITEMS[key].base) || key;
  const [full, cost, hold] = DRAW[base] || DRAW.bow;
  return { full, cost, hold };
}

// The least of a draw that's worth loosing (less, and it's let down again).
export const MIN_DRAW = 0.2;

const ammoName = (ammo) => (ammo === 'cobblestone' ? 'stones to sling' : `${ITEMS[ammo].name.toLowerCase()}s`);

// Start drawing (the button's gone down with a bow in hand).
export function beginDraw(game) {
  const p = game.player;
  const key = p.heldItem();
  const def = ITEMS[key];
  if (!drawable(def) || p.bowDraw || p.attackCd > 0 || p.swing || p.commitT > 0 || p.rollT > 0 || p.stunT > 0 || p.guardBroken > 0 || p.dead || p.down) return false;
  const ammo = def.ammo || 'arrow';
  if (ammo !== 'none' && countItem(p.inv, ammo) <= 0) {
    game.ui.msg(`You have no ${ammoName(ammo)}.`, '#ffb080', true);
    game.audio?.play('error');
    p.attackCd = 0.4;
    return false;
  }
  const spec = drawSpec(key);
  const quick = (heroHas(game.hero, 'marksman') ? 0.85 : 1) / (1 + buffOf(game, 'haste'));
  p.bowDraw = { t: 0, key, ammo, full: spec.full * quick, cost: spec.cost, hold: spec.hold, power: 0 };
  p.blocking = false;
  p.sitting = null;
  game.audio?.play('draw', p);
  return true;
}

// Each frame while drawing: the pull, its cost, and your aim. `down`: the
// button's still held.
export function tickDraw(game, dt, down) {
  const p = game.player;
  const d = p.bowDraw;
  if (!d) return;
  // (Lost: weapon put away, knocked about, or a window opened.)
  if (p.heldItem() !== d.key || p.dead || p.down || p.stunT > 0 || p.guardBroken > 0 || p.rollT > 0 || p.sleeping) {
    cancelDraw(game);
    return;
  }
  if (!down) {
    releaseDraw(game);
    return;
  }
  const was = d.t;
  d.t += dt;
  // The pull's cost, spread over the draw; then the strain of holding it.
  let use = ((Math.min(d.t, d.full) - Math.min(was, d.full)) / d.full) * d.cost;
  if (d.t > d.full) use += (d.t - Math.max(was, d.full)) * d.hold;
  p.stamina = Math.max(0, (p.stamina ?? MAX_STAMINA) - use);
  if (use > 0) p.restT = 0;
  d.power = Math.min(1, d.t / d.full);
  if (was < d.full && d.t >= d.full) game.audio?.play('select');
  // Turned the way you're aiming (you can step while you draw, slowly);
  // where it would go, and how far, for the aiming line (see renderer).
  const aim = aimPoint(game);
  d.aim = aim;
  d.range = ((ITEMS[d.key] && ITEMS[d.key].range) || 8) * (0.45 + 0.55 * d.power);
  const ax = aim.x - p.x;
  const az = aim.z - p.z;
  if (ax || az) p.face(p.x + (Math.abs(ax) >= Math.abs(az) ? Math.sign(ax) : 0), p.z + (Math.abs(az) > Math.abs(ax) ? Math.sign(az) : 0));
  // Out of breath: the arm gives, and off it goes, weakly.
  if (p.stamina <= 0 && d.t > 0.1) {
    game.ui.msg('Your arm gives out!', '#ffb080', true);
    releaseDraw(game, 0.5);
  }
}

// Let it down without loosing (the arrow goes back in the quiver).
export function cancelDraw(game) {
  const p = game.player;
  if (!p.bowDraw) return;
  p.bowDraw = null;
}

// Let go: loosed where you're aiming, as hard as it's drawn.
export function releaseDraw(game, scale = 1) {
  const p = game.player;
  const d = p.bowDraw;
  if (!d) return false;
  p.bowDraw = null;
  const def = ITEMS[d.key];
  if (!def || d.power < MIN_DRAW) return false;
  if (d.ammo !== 'none') {
    if (countItem(p.inv, d.ammo) <= 0) return false;
    removeItem(p.inv, d.ammo, 1);
  }
  const power = Math.min(1, d.power * scale);
  const mark = heroHas(game.hero, 'marksman');
  const kind = d.ammo === 'none' ? 'pulse' : d.ammo === 'bolt' ? 'bolt' : d.ammo === 'cobblestone' ? 'stone' : 'arrow';
  let dmg = (def.damage + (mark ? 2 : 0)) * (0.3 + 0.7 * power) * (1 + buffOf(game, 'fury'));
  // (A clean loose at full draw, now and then: it flies true and deep.)
  if (power >= 0.98 && Math.random() < (mark ? 0.22 : 0.12)) dmg *= 1.6;
  const range = (def.range || 8) * (0.45 + 0.55 * power);
  shootAimed(game, p, aimPoint(game), { dmg: Math.max(1, Math.round(dmg)), kind, range, power });
  p.attackCd = (def.cooldown || 0.8) * 0.35 * cooldownMult(game.hero) / (1 + buffOf(game, 'haste'));
  p.doAction(0.3);
  return true;
}

// A javelin: thrown at once, where you're aiming.
export function throwAimed(game) {
  const p = game.player;
  const s = p.inv[p.selected];
  const def = s && ITEMS[s.item];
  if (!def || !def.thrown || p.attackCd > 0 || p.swing || p.rollT > 0 || p.stunT > 0 || p.guardBroken > 0 || p.dead) return false;
  s.count--;
  if (s.count <= 0) p.inv[p.selected] = null;
  const mark = heroHas(game.hero, 'marksman');
  strikeAnim(p, STYLES.spear);
  p.doAction(0.3);
  shootAimed(game, p, aimPoint(game), { dmg: Math.round((def.damage + (mark ? 2 : 0)) * (1 + buffOf(game, 'fury'))), kind: 'javelin', range: def.range || 7, power: 1 });
  p.attackCd = (def.cooldown || 1) * cooldownMult(game.hero) / (1 + buffOf(game, 'haste'));
  return true;
}

// Where you're aiming: whoever's under the mouse (and whether it's their
// head), else the spot on the ground, else straight ahead.
export function aimPoint(game) {
  const p = game.player;
  const c = game.cursor;
  if (c && c.entity && c.entity !== p && !c.entity.dead) {
    const e = c.entity;
    const person = e.kind === 'npc' || e.kind === 'player';
    return { x: e.x, z: e.z, at: e, head: person && (c.entUp ?? 0) >= 0.62 };
  }
  if (c && c.x !== undefined && (c.x !== p.x || c.z !== p.z)) return { x: c.x, z: c.z };
  const ang = game.aimAngle ? game.aimAngle() : null;
  if (ang !== null && ang !== undefined) return { x: p.x + Math.cos(ang) * 8, z: p.z + Math.sin(ang) * 8 };
  const [fx, fz] = DIRS[p.dir] || [0, 1];
  return { x: p.x + fx * 8, z: p.z + fz * 8 };
}

// An arrow loosed toward a spot (not at anyone in particular): straight,
// as far as it carries or to the first wall in its way, striking the first
// thing it meets on the way.
export function shootAimed(game, from, aim, o) {
  const dx = aim.x - from.x;
  const dz = aim.z - from.z;
  const len = Math.hypot(dx, dz) || 1;
  const ux = dx / len;
  const uz = dz / len;
  const y = from.y + 1;
  const w = game.world;
  let end = o.range;
  for (let k = 0.5; k <= o.range; k += 0.5) {
    const x = Math.round(from.x + ux * k);
    const z = Math.round(from.z + uz * k);
    if (x === from.x && z === from.z) continue;
    if (!w.regionAt(x, z)) {
      end = k;
      break;
    }
    const b = BLOCKS[w.getBlock(x, y, z)];
    if (b && b.solid) {
      end = Math.max(0.5, k - 0.4);
      break;
    }
  }
  const pace = { bolt: 0.7, stone: 0.85, javelin: 1.35, pulse: 0.55 }[o.kind] || 1;
  const a = {
    from, target: null, aimed: true, ux, uz, end, k: 0.5,
    x0: from.x, y0: y, z0: from.z, tx: from.x + ux * end, ty: y - 0.6, tz: from.z + uz * end,
    t: 0, dur: ((0.08 + end * 0.045) * arrowSpeed(from) * pace) / (0.7 + 0.3 * (o.power ?? 1)),
    dmg: o.dmg, gem: gemsOf(from).bow, kind: o.kind, head: !!aim.head, aimAt: aim.at || null,
  };
  game.projectiles.push(a);
  // (A pulse leaves the caster in a flash of cold light.)
  if (o.kind === 'pulse') game.renderer.emit(from.x + ux * 0.6, y - 0.1, from.z + uz * 0.6, { n: 8, color: ['#ffffff', '#a8f4ff', '#5ad8f0'], up: 10, speed: 30, life: 0.25, glow: true, gravity: 0 });
  game.audio?.play(o.kind === 'pulse' ? 'beam' : o.kind === 'stone' || o.kind === 'javelin' ? 'swing' : 'bow', from);
  // (An onyx bow: two shades of it either side.)
  splitShot(game, from, aim, o, shootAimed);
  return a;
}

// An aimed arrow, this frame: whoever it's reached, if anyone.
export function flyAimed(game, a) {
  const reach = Math.min(1, a.t / a.dur) * a.end;
  while (a.k <= reach) {
    const x = Math.round(a.x0 + a.ux * a.k);
    const z = Math.round(a.z0 + a.uz * a.k);
    const v = victimAt(game, a, x, z, a.x0 + a.ux * a.k, a.z0 + a.uz * a.k);
    if (v) {
      a.tx = x;
      a.tz = z;
      a.ty = v.y + 1;
      return v;
    }
    a.k += 0.5;
  }
  return null;
}

function victimAt(game, a, x, z, px = x, pz = z) {
  if (x === a.x0 && z === a.z0) return null;
  const y = a.y0 - 1;
  for (const e of [game.player, ...game.npcs, ...game.creatures]) {
    if (!e || e === a.from || e.dead || e.down || Math.abs(e.y - y) > 1) continue;
    // (A master's a little more to hit than its one pace.)
    if (!covers(e, x, z) && !(padded(e) && Math.hypot(px - e.x, pz - e.z) <= padOf(e))) continue;
    return e;
  }
  return null;
}

// How likely a shot of theirs takes someone in the head.
function headChance(from) {
  if (!from || from.kind !== 'npc') return 0;
  const r = from.rec || {};
  return r.adventurer !== undefined ? 0.16 : r.job === 'guard' ? (r.drilled ? 0.16 : 0.12) : 0.08;
}

// An arrow (or bolt, stone, javelin) reaches someone: turned aside, taken on
// a shield, rolled under, or home (in the head, half as hard again). True
// if it struck.
export function arrowStrikes(game, a, t) {
  const r = game.renderer;
  let hit = true;
  // The Overseer's shield (held up by its sentinels): arrows, bolts and
  // stones glance off it in a ripple of light (as a blade does: see
  // monsters.guardFront).
  if (t.species === 'overseer' && shielded(t)) {
    const fx = a.from ? a.from.x : a.x0;
    const fz = a.from ? a.from.z : a.z0;
    const ang = Math.atan2(fz - t.z, fx - t.x);
    t.shieldHit = { t: 0, ang };
    const hx = t.x + Math.cos(ang) * 1.8;
    const hz = t.z + Math.sin(ang) * 1.8;
    r.emit(hx, t.y + 1.6, hz, { n: 12, color: ['#ffffff', '#c8fbff', '#5ad8f0'], up: 30, speed: 70, life: 0.35, glow: true });
    r.effect?.({ type: 'ring', wx: hx, wy: t.y + 1.4, wz: hz, r0: 2, r1: 14, color: ['#c8fbff', '#5ad8f0'], life: 0.3, oy: -12, flat: 0.8 });
    r.floatText(t.x, t.y + 3.4, t.z, 'deflected', '#5ad8f0');
    game.audio?.play('armor_hit', t);
    game.audio?.play('hum', t);
    return false;
  }
  // A glasshide stalker's black glass: arrows glance off it.
  if (t.S && t.S.glancing) {
    r.emit(t.x, t.y + 1.2, t.z, { n: 6, color: ['#c8b8f0', '#ffffff', '#6a5a8a'], up: 20, speed: 50, life: 0.3, glow: true });
    r.floatText(t.x, t.y + 2.6, t.z, 'glances off', '#c8b8f0');
    game.audio?.play('armor_hit', t);
    return false;
  }
  // An adventurer turns the arrow aside with a blade.
  if (t.adventurer && t.tryDeflect && t.tryDeflect(a)) hit = false;
  // Rolled under it.
  if (hit && t.kind === 'player' && t.rollT > 0) {
    hit = false;
    r.floatText(t.x, t.y + 2, t.z, 'dodged', '#c8e8ff');
  }
  // Caught on a shield: you, with it raised toward them; anyone else
  // carrying one and facing the archer, as often as not.
  const from = a.from || { x: a.x0, z: a.z0 };
  let shield = false;
  // (The Aegis's wall of light stops them from any side.)
  const aegis = t.kind === 'player' && aegisUp(t);
  if (hit && t.kind === 'player' && t.blocking && shieldOf(t) && (facing(t, from) || aegis)) shield = true;
  else if (hit && t.kind === 'npc' && !t.sleeping && shieldOf(t)) {
    const toward = facing(t, from);
    if (Math.random() < (toward ? 0.8 : 0.2)) {
      shield = true;
      if (!toward && !t.moving) t.face(from.x, from.z);
    }
  }
  if (shield) {
    // (Up it comes, and jolts with the hit.)
    t.shieldJolt = 0.18;
    if (t.kind !== 'player') t.guardT = 0.8;
    // (A moonstone shield sends it straight back; a crossbow bolt goes
    // through any other, mostly.)
    if (mirrorShot(game, t, a, t.kind === 'player' && t.blockT !== undefined && t.blockT < 0.3)) hit = false;
    else if (a.kind === 'bolt' && !aegis && Math.random() < 0.6) a.dmg = Math.max(1, Math.round(a.dmg * 0.4));
    else hit = false;
    r.floatText(t.x, t.y + 2, t.z, 'blocked', '#a0c8ff');
    r.emit(t.x, t.y + 1.1, t.z, { n: 5, color: aegis ? ['#ffffff', '#5ad8f0', '#c8fbff'] : ['#ffffff', '#ffe8a0'], up: 20, speed: 40, life: 0.25, glow: true });
    if (aegis) r.effect?.({ type: 'ring', wx: t.x, wy: t.y + 1, wz: t.z, r0: 8, r1: 16, color: ['#5ad8f0', '#e0fbff'], life: 0.3, oy: -10, flat: 0.8 });
    game.audio?.play('armor_hit', t);
  }
  if (!hit) return false;
  let dmg = a.dmg;
  // In the head (a person, not a beast): half as hard again.
  const person = t.kind === 'npc' || t.kind === 'player';
  const head = person && (a.aimed ? a.head && a.aimAt === t : Math.random() < headChance(a.from));
  if (head) {
    dmg = Math.round(dmg * 1.5);
    r.floatText(t.x, t.y + 2.6, t.z, 'headshot!', '#ffd060');
  }
  game.damage(t, dmg, a.from);
  return true;
}
