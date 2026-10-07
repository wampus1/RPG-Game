// What the Kavorent left that still works: their arms (an Arc Lance that
// throws a line of light with each thrust, a Phase Blade that slips past
// shields and through armour, an Aegis that walls off arrows from every
// side), their gadgets (Blink Shard, Mending Cell, Field Projector,
// Lodestar, Everlight), and the alloy fittings that make a weapon or a
// piece of armour better for good.
import { ITEMS, enhanced, canEnhance } from '../world/items.js';
import { B, BLOCKS } from '../world/blocks.js';
import { mainWeapon } from './combat.js';
import { startLaser } from './laser.js';
import { useEvolvedGear } from './evolvedgear.js';

const DIRS = [[0, 1], [-1, 0], [0, -1], [1, 0]];

// The weapon someone's swinging, as an item.
function weaponOf(e) {
  const k = e && mainWeapon(e);
  return k ? ITEMS[k] : null;
}

// How much of a shield's or armour's worth a blow slips past.
export function pierceOf(e) {
  const w = weaponOf(e);
  return (w && w.pierce) || 0;
}

// Which way they're striking: where you're aiming, at their foe, or ahead.
function strikeAngle(game, a, main) {
  if (a.kind === 'player' && game.aimAngle) {
    const ang = game.aimAngle();
    if (ang !== null && ang !== undefined) return ang;
  }
  if (main && !main.dead) return Math.atan2(main.z - a.z, main.x - a.x);
  const [dx, dz] = DIRS[a.dir] || [0, 1];
  return Math.atan2(dz, dx);
}

// An Arc Lance thrust: a lance of light four paces out, through everything
// (hostile) in the line, stopped only by a wall.
export function lanceThrust(game, a, main = null) {
  const w = weaponOf(a);
  if (!w || !w.lance) return;
  const ang = strikeAngle(game, a, main);
  const dx = Math.cos(ang);
  const dz = Math.sin(ang);
  const wd = game.world;
  let range = 4;
  for (let d = 0.5; d <= 4; d += 0.5) {
    const x = Math.round(a.x + dx * d);
    const z = Math.round(a.z + dz * d);
    if (BLOCKS[wd.getBlock(x, a.y, z)]?.solid && BLOCKS[wd.getBlock(x, a.y + 1, z)]?.solid) {
      range = d - 0.4;
      break;
    }
  }
  const hit = new Set([a]);
  if (main) hit.add(main);
  const dmg = Math.max(1, Math.round((w.damage || 6) * 0.6));
  const foes = [...game.creatures, ...game.npcs];
  for (let d = 0.5; d <= range; d += 0.5) {
    const x = Math.round(a.x + dx * d);
    const z = Math.round(a.z + dz * d);
    for (const e of foes) {
      if (hit.has(e) || e.dead || e.down || e.x !== x || e.z !== z || Math.abs(e.y - a.y) > 1) continue;
      // (Yours catches what's fighting, or would: never the townsfolk.)
      const foe = e.kind === 'creature' || e.kind === 'monster' ? e.hostileNow || e.target === a : e.threat === a || e.hostile || e.bandit;
      if (!foe) continue;
      hit.add(e);
      game.damage(e, dmg, a);
      game.renderer.emit(e.x, e.y + 1, e.z, { n: 6, color: ['#c8fbff', '#5ad8f0', '#ffffff'], up: 20, speed: 40, life: 0.35, glow: true });
    }
  }
  game.renderer.effect?.({ type: 'beam', wx: a.x, wy: a.y + 0.9, wz: a.z, tx: a.x + dx * range, ty: a.y + 0.9, tz: a.z + dz * range, life: 0.3, oy: -8, color: '#c8fbff', halo: '#5ad8f0', width: 3 });
  game.audio?.play('beam', a);
}

// The Aegis raised: arrows stop at its wall of light, from any side.
export function aegisUp(e) {
  if (!e || !e.blocking) return false;
  const k = e.kind === 'player' ? e.equip && e.equip.shield : null;
  return !!(k && ITEMS[k] && (ITEMS[k].base || k) === 'kav_aegis');
}

// ---------------------------------------------------------------- gadgets
// Used from the belt (the right button). True if it was one.
export function useGadget(game, def) {
  if (!def || def.kind !== 'gadget') return false;
  const p = game.player;
  const now = performance.now() / 1000;
  p.gadgetCd ||= {};
  const k = def.key;
  if ((p.gadgetCd[k] || 0) > now) {
    game.ui.msg(`The ${def.name} is still gathering itself (${Math.ceil(p.gadgetCd[k] - now)}s).`, '#7ae0ff', true);
    game.audio?.play('error');
    return true;
  }
  let ok = false;
  if (k === 'kav_blink') ok = blink(game, p);
  else if (k === 'kav_mender') ok = mendCell(game, p);
  else if (k === 'kav_bulwark') ok = bulwark(game, p);
  else if (k === 'kav_lodestar') ok = lodestar(game, p);
  else if (k === 'overseer_eye') ok = overseerEye(game, p);
  else if (def.evolved) {
    // (Round 72) The evolved masters' things: see evolvedgear.js.
    const r = useEvolvedGear(game, p, k);
    ok = r === true;
  }
  else if (k === 'kav_everlight') {
    game.ui.msg('The Everlight needs nothing doing: hold it, or carry it in your off hand (right-click it in your pack), and it lights the way.', '#a8f4ff');
    return true;
  }
  if (ok && def.charge) p.gadgetCd[k] = now + def.charge;
  return true;
}

// The Overseer's Eye: its great beam, out of your hands, turned after
// where you point (see game/laser.js) for four seconds.
function overseerEye(game, p) {
  if ((game.lasers || []).some((L) => L.by === p)) return false;
  startLaser(game, {
    by: p, ang: strikeAngle(game, p, null), aim: () => strikeAngle(game, p, null), turn: 4, len: 12, charge: 0.45, dur: 4, dmg: 5, tick: 0.25, width: 0.6, foes: 'monsters', fire: true,
  });
  p.slowT = Math.max(p.slowT || 0, 4.4);
  game.ui.msg('The Eye opens, and its light pours out of your hands.', '#ff9070');
  return true;
}

// Six paces toward where you point, in a flash (not through walls).
function blink(game, p) {
  const ang = strikeAngle(game, p, null);
  const dx = Math.cos(ang);
  const dz = Math.sin(ang);
  const w = game.world;
  let best = null;
  for (let d = 1; d <= 6; d++) {
    const x = Math.round(p.x + dx * d);
    const z = Math.round(p.z + dz * d);
    const b1 = BLOCKS[w.getBlock(x, p.y, z)];
    const b2 = BLOCKS[w.getBlock(x, p.y + 1, z)];
    if (b1.solid && b2.solid) break;
    const y = w.findStandY(x, z, p.y);
    if (y < 0 || Math.abs(y - p.y) > 1 || !w.canStand(x, y, z) || game.occupiedBySolid?.(x, y, z, p)) continue;
    best = { x, y, z };
  }
  if (!best) {
    game.ui.msg('Nowhere to blink to that way.', '#7ae0ff', true);
    game.audio?.play('error');
    return false;
  }
  const r = game.renderer;
  // An after-image where you were, a streak of light to where you are.
  r.effect?.({ type: 'ghost', look: p.look, dir: p.dir, wx: p.x, wy: p.y, wz: p.z, life: 0.7, oy: 0, filter: 'brightness(0.6) sepia(1) hue-rotate(150deg) saturate(3)', glow: '#5ad8f0' });
  r.effect?.({ type: 'beam', wx: p.x, wy: p.y + 1, wz: p.z, tx: best.x, ty: best.y + 1, tz: best.z, life: 0.25, oy: -8, color: '#c8fbff', halo: '#5ad8f0', width: 2 });
  r.emit(p.x, p.y + 1, p.z, { n: 14, color: ['#5ad8f0', '#c8fbff', '#ffffff'], up: 20, speed: 50, life: 0.5, glow: true });
  p.teleport(best.x, best.y, best.z);
  r.emit(best.x, best.y + 1, best.z, { n: 18, color: ['#5ad8f0', '#c8fbff', '#ffffff'], up: 30, speed: 60, life: 0.5, glow: true });
  p.rollT = 0;
  p.grabbedT = 0;
  game.audio?.play('void');
  game.lightDirty = true;
  return true;
}

// Twelve health back over four seconds; three uses, filled again at dawn.
function mendCell(game, p) {
  const m = (p.mender ||= { day: game.day, n: 3 });
  if (m.day !== game.day && game.minute >= 300) {
    m.day = game.day;
    m.n = 3;
  }
  if (m.n <= 0) {
    game.ui.msg('The Mending Cell is dark. It fills again at dawn.', '#7ae0ff', true);
    game.audio?.play('error');
    return false;
  }
  if (p.hp >= p.maxHp) {
    game.ui.msg('You\'re not hurt.', '#7ae0ff', true);
    return false;
  }
  m.n--;
  p.mendT = 4;
  p.mendLeft = 12;
  game.ui.msg(`Light runs out of the cell and into your wounds. (${m.n} use${m.n === 1 ? '' : 's'} left today.)`, '#a8f4ff');
  game.audio?.play('moon');
  return true;
}

// A wall of light three wide, two paces ahead, for eight seconds.
function bulwark(game, p) {
  const [fx, fz] = DIRS[p.dir] || [0, 1];
  const w = game.world;
  const cx = p.x + fx * 2;
  const cz = p.z + fz * 2;
  const put = [];
  for (let s = -1; s <= 1; s++) {
    const x = cx + (fz ? s : 0);
    const z = cz + (fx ? s : 0);
    for (const y of [p.y, p.y + 1]) {
      if (w.getBlock(x, y, z) !== B.air) continue;
      if (game.occupiedAny?.(x, y, z)) continue;
      w.setBlock(x, y, z, B.kav_field);
      put.push({ x, y, z });
    }
  }
  if (!put.length) {
    game.ui.msg('No room for the field there.', '#7ae0ff', true);
    return false;
  }
  (game.bulwarks ||= []).push({ t: 8, life: 8, put });
  game.renderer.emit(cx, p.y + 1, cz, { n: 20, color: ['#5ad8f0', '#c8fbff'], up: 30, speed: 40, life: 0.6, glow: true });
  game.audio?.play('hum');
  game.lightDirty = true;
  return true;
}

// Which way: below, to the way down (or the master's hall); above, to the
// nearest old place not yet beaten.
function lodestar(game, p) {
  let to = null;
  let what = '';
  const dg = game.dungeon;
  if (dg && dg.data) {
    const d = dg.data;
    if (d.down) {
      to = d.down;
      what = 'the way down';
    } else if (d.bossRoom) {
      to = { x: Math.round((d.bossRoom.x0 + d.bossRoom.x1) / 2), z: Math.round((d.bossRoom.z0 + d.bossRoom.z1) / 2) };
      what = 'the heart of the place';
    }
  } else {
    let bd = Infinity;
    for (const r of game.sim.dungeons.all) {
      if (r.cleared || r.x === undefined) continue;
      const dd = Math.hypot(r.x - p.x, r.z - p.z);
      if (dd < bd) {
        bd = dd;
        to = { x: r.x, z: r.z };
        what = r.name;
        r.known = true;
      }
    }
  }
  if (!to) {
    game.ui.msg('The Lodestar turns, and turns, and settles nowhere.', '#7ae0ff', true);
    return false;
  }
  const dist = Math.round(Math.hypot(to.x - p.x, to.z - p.z));
  game.lodestar = { x: to.x, z: to.z, t: 4 };
  const ang = Math.atan2(to.z - p.z, to.x - p.x);
  const dirs = ['east', 'south-east', 'south', 'south-west', 'west', 'north-west', 'north', 'north-east'];
  const dir = dirs[(Math.round(ang / (Math.PI / 4)) + 8) % 8];
  game.ui.msg(`The Lodestar points ${dir}: ${what}, ${dist} paces off.${dg ? '' : ' (It\'s on your map now.)'}`, '#a8f4ff');
  game.audio?.play('rune');
  return true;
}

// Each frame: mending, the fields falling, the Lodestar's trail of light.
export function updateKavTech(game, dt) {
  const p = game.player;
  if (p && p.mendT > 0) {
    const step = Math.min(p.mendT, dt);
    p.mendT -= dt;
    const add = (p.mendLeft || 0) * (step / (p.mendT + step));
    p.mendLeft = Math.max(0, (p.mendLeft || 0) - add);
    p.hp = Math.min(p.maxHp, p.hp + add);
    if (Math.random() < dt * 14) game.renderer.emit(p.x, p.y + 0.8, p.z, { n: 1, color: ['#a8f4ff', '#ffffff'], up: 18, speed: 8, gravity: -10, life: 0.8, glow: true });
  }
  if (game.bulwarks && game.bulwarks.length) {
    for (const b of game.bulwarks) {
      b.t -= dt;
      if (b.t > 0) continue;
      for (const q of b.put) if (game.world.getBlock(q.x, q.y, q.z) === B.kav_field) game.world.setBlock(q.x, q.y, q.z, B.air);
      game.lightDirty = true;
      game.audio?.play('hum');
    }
    game.bulwarks = game.bulwarks.filter((b) => b.t > 0);
  }
  const L = game.lodestar;
  if (L && p) {
    L.t -= dt;
    if (L.t <= 0) game.lodestar = null;
    else if (Math.random() < dt * 30) {
      // Motes running from you toward it.
      const ang = Math.atan2(L.z - p.z, L.x - p.x);
      const d = 1 + Math.random() * 5;
      game.renderer.emit(p.x + Math.cos(ang) * d, p.y + 1, p.z + Math.sin(ang) * d, { n: 1, color: ['#a8f4ff', '#5ad8f0'], up: 4, speed: 4, gravity: 0, life: 0.6, glow: true });
    }
  }
}

// Before saving: the fields come down (they'd be kept in the world
// otherwise), to go up again after.
export function dropFields(game) {
  for (const b of game.bulwarks || []) for (const q of b.put) if (game.world.getBlock(q.x, q.y, q.z) === B.kav_field) game.world.setBlock(q.x, q.y, q.z, B.air);
}
export function raiseFields(game) {
  for (const b of game.bulwarks || []) for (const q of b.put) if (!q.down && game.world.getBlock(q.x, q.y, q.z) === B.air) game.world.setBlock(q.x, q.y, q.z, B.kav_field);
}

// ---------------------------------------------------------------- fittings
// An Alloy Edge or Plating used from the belt: fitted to the weapon at the
// top of your pack's weapons (the first in your belt), or the first piece
// of armour you wear that can take it.
export function fitEnhancer(game, def) {
  if (!def || def.kind !== 'enhancer') return false;
  const p = game.player;
  const kind = def.key === 'kav_edge' ? 'edge' : 'plating';
  const slot = p.inv[p.selected];
  let done = null;
  if (kind === 'edge') {
    // (A weapon in the belt: the nearest to this slot.)
    const order = [...p.inv.keys()].sort((a, b) => Math.abs(a - p.selected) - Math.abs(b - p.selected));
    for (const i of order) {
      const s = p.inv[i];
      if (s && canEnhance(s.item, 'edge')) {
        const name = ITEMS[s.item].name;
        p.inv[i] = { item: enhanced(s.item, 'edge'), count: 1 };
        done = name;
        break;
      }
    }
  } else {
    for (const k of ['body', 'head', 'legs', 'feet']) {
      const it = p.equip[k];
      if (it && canEnhance(it, 'plating')) {
        done = ITEMS[it].name;
        p.equip[k] = enhanced(it, 'plating');
        break;
      }
    }
  }
  if (!done) {
    game.ui.msg(kind === 'edge' ? 'You have no weapon that can take an alloy edge.' : 'You wear no armour that can take alloy plating.', '#7ae0ff', true);
    game.audio?.play('error');
    return true;
  }
  slot.count--;
  if (slot.count <= 0) p.inv[p.selected] = null;
  game.refreshBonus?.();
  game.ui.msg(`The ${def.name.toLowerCase()} flows over your ${done.toLowerCase()} like water and sets, seamless. ${kind === 'edge' ? '+3 to every blow.' : 'A twentieth more of each blow turned, and +1 endurance.'}`, '#a8f4ff');
  game.renderer.emit(p.x, p.y + 1, p.z, { n: 18, color: ['#5ad8f0', '#c8fbff', '#ffffff'], up: 30, speed: 30, life: 0.7, glow: true });
  game.audio?.play('rune');
  return true;
}
