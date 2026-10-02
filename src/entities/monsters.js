// What lives below ground, and how it fights. Each kind has its own way
// (a "brain", run before the plain chase-and-strike every creature has):
//   barrow wights stare a line of grave-cold at you from a few paces off;
//   a skeleton captain carries a shield and rallies the dead round it
//   (and the sigil to the sealed door); crypt rats come in a rush;
//   the drowned lie under black water till you're close, and grab;
//   tunnel crawlers dig under you and burst up where you stand;
//   gloom moths are drawn to your torch, and snuff it;
//   holdout bandits fight like bandits, archers hanging back.
// The Kavorent's constructs work together:
//   sentinel drones keep their distance and fire a beam down a line (two
//   near each other join theirs into a wall of light); a warden's shield
//   turns any blow from the front, and shelters the drones near it;
//   menders scuttle to whatever's hurt and weld it whole again (kill
//   them first); golems slam the ground round them, and are open to a
//   blow for a moment after; arc mites run at you and burst.
// And each kind of place has its master (see BOSSES).
//
// Attacks you see coming are "hazards": the ground they'll hit, lit up
// (red for a blow, blue for cold, cyan for the Kavorent's light), going
// off when the time's up. Traps use them too (see game/dungeon.js).
import { beginAttack, styleOf, knock, STYLES } from '../game/combat.js';
import { burn, chill, stun, mend } from '../game/gems.js';
import { BLOCKS } from '../world/blocks.js';
import { pierceOf } from '../game/kavtech.js';

// --------------------------------------------------------------- species
// (Merged into creature.js's SPECIES.) `under`: lives below ground (no
// burning away by day). `style`: how it strikes up close. `big`: drawn 32
// square. `construct`: one of the Kavorent's. `boss`: a master of its place.
export const MONSTER_SPECIES = {
  wight: { light: 2, name: 'Barrow Wight', hp: 26, dmg: 4, step: 0.42, mode: 'hostile', aggro: 9, humanoid: true, look: 'wight', arms: 'iron_sword', under: true, undead: true, brain: 'wight', drops: [['bone', 1, 3, 1], ['old_coin', 1, 5, 0.7]] },
  skel_captain: { name: 'Skeleton Captain', hp: 30, dmg: 4, step: 0.36, mode: 'hostile', aggro: 10, humanoid: true, look: 'captain', arms: 'iron_sword', shield: 'wooden_shield', shieldBlock: 0.5, under: true, undead: true, brain: 'captain', drops: [['bone', 2, 4, 1], ['old_coin', 2, 8, 1]] },
  rat: { name: 'Crypt Rat', hp: 3, dmg: 1, step: 0.2, mode: 'hostile', aggro: 9, under: true, packs: true, style: 'snap', drops: [['raw_meat', 1, 1, 0.3]] },
  drowned: { name: 'Drowned One', hp: 16, dmg: 3, step: 0.34, mode: 'hostile', aggro: 7, humanoid: true, look: 'drowned', under: true, undead: true, brain: 'drowned', style: 'grab', drops: [['old_coin', 1, 4, 0.6], ['bone', 1, 2, 0.5]] },
  crawler: { name: 'Tunnel Crawler', hp: 22, dmg: 4, step: 0.3, mode: 'hostile', aggro: 10, under: true, brain: 'crawler', style: 'bite', drops: [['leather', 1, 2, 0.6], ['iron_ore', 1, 2, 0.4]] },
  moth: { name: 'Gloom Moth', hp: 4, dmg: 1, step: 0.26, mode: 'hostile', aggro: 12, under: true, floats: true, brain: 'moth', style: 'snap', drops: [] },
  cutthroat: { name: 'Holdout Cutthroat', hp: 15, dmg: 3, step: 0.3, mode: 'hostile', aggro: 9, humanoid: true, look: 'cutthroat', arms: 'dagger', offhand: 'dagger', dodge: 0.2, under: true, drops: [['coin', 3, 12, 1], ['old_coin', 1, 3, 0.3]] },
  holdout_archer: { name: 'Holdout Archer', hp: 11, dmg: 3, step: 0.32, mode: 'hostile', aggro: 11, humanoid: true, look: 'holdout_archer', arms: 'bow', ranged: true, under: true, drops: [['arrow', 3, 8, 1], ['coin', 2, 8, 1]] },
  // The masters of their places.
  barrow_king: { name: 'The Barrow King', hp: 110, dmg: 6, step: 0.46, mode: 'hostile', aggro: 14, humanoid: true, look: 'wight_king', arms: 'greatsword', under: true, undead: true, boss: true, brain: 'barrowKing', drops: [['old_coin', 10, 25, 1], ['gold_ingot', 1, 3, 1]] },
  horror: { name: 'The Ossuary Horror', hp: 120, dmg: 5, step: 0.6, mode: 'hostile', aggro: 14, big: true, under: true, undead: true, boss: true, brain: 'horror', style: 'slam', drops: [['bone', 6, 12, 1], ['old_coin', 8, 20, 1]] },
  worm: { name: 'The Deep Worm', hp: 130, dmg: 6, step: 0.4, mode: 'hostile', aggro: 16, big: true, under: true, boss: true, brain: 'worm', style: 'bite', drops: [['gem', 2, 4, 1], ['gold_ore', 3, 6, 1], ['iron_ore', 4, 8, 1]] },
  priest: { name: 'The Drowned Priest', hp: 100, dmg: 4, step: 0.4, mode: 'hostile', aggro: 14, humanoid: true, look: 'priest', under: true, undead: true, boss: true, brain: 'priest', drops: [['old_coin', 8, 20, 1], ['gold_ingot', 1, 2, 1]] },
  warlord: { name: 'The Bandit Warlord', hp: 120, dmg: 6, step: 0.42, mode: 'hostile', aggro: 14, humanoid: true, look: 'warlord', arms: 'warhammer', under: true, boss: true, brain: 'warlord', drops: [['coin', 30, 70, 1], ['gold_ingot', 1, 3, 1]] },
  // The Kavorent's constructs.
  drone: { light: 4, name: 'Sentinel Drone', hp: 14, dmg: 3, step: 0.34, mode: 'hostile', aggro: 12, floats: true, under: true, construct: true, brain: 'drone', style: 'sting', drops: [['kav_scrap', 1, 2, 0.8]] },
  warden: { name: 'Warden', hp: 34, dmg: 4, step: 0.44, mode: 'hostile', aggro: 11, humanoid: true, look: 'warden', arms: 'mace', shield: 'kav_aegis', under: true, construct: true, brain: 'warden', drops: [['kav_scrap', 2, 3, 1]] },
  mender: { light: 2, name: 'Mender', hp: 8, dmg: 1, step: 0.24, mode: 'hostile', aggro: 12, under: true, construct: true, brain: 'mender', style: 'snap', drops: [['kav_scrap', 1, 1, 0.8]] },
  golem: { light: 3, name: 'Kavorent Golem', hp: 80, dmg: 7, step: 0.6, mode: 'hostile', aggro: 11, big: true, under: true, construct: true, armoured: true, brain: 'golem', style: 'slam', drops: [['kav_scrap', 3, 6, 1]] },
  mite: { light: 2, name: 'Arc Mite', hp: 5, dmg: 5, step: 0.22, mode: 'hostile', aggro: 12, under: true, construct: true, packs: true, brain: 'mite', drops: [['kav_scrap', 1, 1, 0.3]] },
  prime: { light: 5, name: 'Prime Golem', hp: 170, dmg: 8, step: 0.58, mode: 'hostile', aggro: 14, big: true, under: true, construct: true, armoured: true, boss: true, brain: 'golem', style: 'slam', drops: [['kav_scrap', 6, 10, 1]] },
  overseer: { light: 9, name: 'The Overseer', hp: 320, dmg: 6, step: 0.5, mode: 'hostile', aggro: 18, big: true, floats: true, anim: true, under: true, construct: true, boss: true, brain: 'overseer', drops: [['kav_scrap', 8, 14, 1]] },
};

// A strike that grabs and holds you (the drowned): roll to break free.
STYLES.grab = { name: 'grab', windup: 0.6, recover: 1.0, reach: 1, mult: 0.8, grab: true };

const COLORS = { blow: [255, 70, 50], cold: [90, 170, 255], kav: [90, 216, 240], earth: [200, 150, 90], fire: [255, 140, 40], void: [160, 100, 220] };

// --------------------------------------------------------------- hazards
// Something coming down on that ground in `dur` seconds (see the header).
export function addHazard(game, h) {
  h.t = 0;
  h.y ??= h.by ? h.by.y : game.player.y;
  (game.hazards ||= []).push(h);
  return h;
}

export function updateHazards(game, dt) {
  if (!game.hazards || !game.hazards.length) return;
  for (const h of game.hazards) {
    h.t += dt;
    if (h.by && h.by.dead && !h.keep) h.done = true;
    if (h.done || h.t < h.dur) continue;
    h.done = true;
    fireHazard(game, h);
  }
  game.hazards = game.hazards.filter((h) => !h.done);
}

function fireHazard(game, h) {
  const r = game.renderer;
  const on = (e) => !e.dead && !e.down && !e.burrowed && h.tiles.some((t) => t.x === e.x && t.z === e.z) && Math.abs(e.y - h.y) <= 1;
  const hit = [];
  for (const e of [game.player, ...game.npcs, ...game.creatures]) {
    if (!e || !on(e) || e === h.by) continue;
    // (Its own kind are spared its blows, unless it's a trap.)
    if (h.by && !h.trap && e.kind !== 'player' && e.kind !== 'npc' && e.S && e.S.construct === h.by.S?.construct && e.S.undead === h.by.S?.undead) continue;
    if (e.kind === 'player' && e.rollT > 0) {
      r.floatText(e.x, e.y + 2, e.z, 'dodged', '#c8e8ff');
      continue;
    }
    hit.push(e);
    if (h.dmg) game.damage(e, h.dmg, h.by || null);
    if (h.chill) chill(e, h.chill);
    if (h.burn) burn(game, e, h.by, h.burn);
    if (h.stun) stun(e, h.stun);
    if (h.knock && h.from) knock(game, h.from, e, h.knock);
    if (h.drain && e.kind === 'player') e.stamina = Math.max(0, (e.stamina || 0) - h.drain);
  }
  // How it looks going off.
  const mid = h.tiles[Math.floor(h.tiles.length / 2)] || h.tiles[0];
  if (h.kind === 'beam' && h.from && h.to) {
    r.effect?.({ type: 'beam', wx: h.from.x, wy: h.y + 0.6, wz: h.from.z, tx: h.to.x, ty: h.y + 0.6, tz: h.to.z, life: 0.35, oy: -8, color: h.beamColor || '#ffd0d0', halo: h.halo || '#ff4040', width: h.width || 3 });
    game.audio?.play('beam', mid);
  } else if (h.kind === 'slam') {
    r.effect?.({ type: 'ring', wx: h.center.x, wy: h.y, wz: h.center.z, r0: 4, r1: 10 + h.radius * 14, color: ['#d8c8a0', '#ffffff'], life: 0.45, oy: 4, flat: 0.5, thick: 2 });
    for (const t of h.tiles) if (Math.random() < 0.5) r.emit(t.x, h.y, t.z, { n: 2, color: ['#a89878', '#8a7a5a'], up: 14, speed: 30, life: 0.5, oy: 6, shape: 'puff' });
    game.shake = Math.min(1.2, (game.shake || 0) + 0.45);
    game.audio?.play('boom', mid);
  } else if (h.kind === 'rocks') {
    for (const t of h.tiles) r.emit(t.x, h.y + 2.5, t.z, { n: 5, color: ['#8a8478', '#6a645a', '#a8a090'], up: -30, speed: 20, gravity: 260, life: 0.5, oy: -10 });
    game.shake = Math.min(1.2, (game.shake || 0) + 0.3);
    game.audio?.play('crumble', mid);
  } else if (h.kind === 'erupt') {
    for (const t of h.tiles) r.emit(t.x, h.y, t.z, { n: 4, color: ['#7a5a3a', '#5a4430', '#a8885a'], up: 40, speed: 40, gravity: 200, life: 0.6, oy: 4 });
    game.shake = Math.min(1.2, (game.shake || 0) + 0.4);
    game.audio?.play('crumble', mid);
  } else if (h.kind === 'burst') {
    r.effect?.({ type: 'ring', wx: h.center.x, wy: h.y, wz: h.center.z, r0: 3, r1: 26, color: ['#fff8a0', '#ffe040', '#ffffff'], life: 0.35, oy: -6, flat: 0.6, thick: 2 });
    r.emit(h.center.x, h.y + 1, h.center.z, { n: 16, color: ['#fff8a0', '#ffe040', '#ffffff'], up: 40, speed: 80, life: 0.4, glow: true });
    game.audio?.play('thunder', mid);
  } else if (h.kind === 'fire') {
    r.effect?.({ type: 'blast', wx: h.center.x, wy: h.y, wz: h.center.z, r1: 20, life: 0.6, oy: 2 });
    game.audio?.play('fire', mid);
  } else if (h.kind === 'dart') {
    if (h.from && h.to) r.effect?.({ type: 'beam', wx: h.from.x, wy: h.y + 0.7, wz: h.from.z, tx: h.to.x, ty: h.y + 0.7, tz: h.to.z, life: 0.15, oy: -8, color: '#d8c8a0', halo: '#6a5a40', width: 1 });
    game.audio?.play('dart', mid);
  } else if (h.kind === 'cold') {
    for (const t of h.tiles) r.emit(t.x, h.y + 0.6, t.z, { n: 3, color: ['#a0d8ff', '#e0f4ff'], up: 12, speed: 20, life: 0.6, shape: 'star', oy: -4 });
    game.audio?.play('freeze', mid);
  }
  if (h.onFire) h.onFire(game, h, hit);
  return hit;
}

// A straight line of ground from one spot toward another, stopping at a
// wall (up to `len` paces).
export function lineTiles(game, from, to, len, y = from.y) {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const d = Math.max(1e-6, Math.hypot(dx, dz));
  const out = [];
  const seen = new Set();
  for (let k = 1; k <= len; k += 0.5) {
    const x = Math.round(from.x + (dx / d) * k);
    const z = Math.round(from.z + (dz / d) * k);
    const key = x * 65536 + z;
    if (seen.has(key)) continue;
    seen.add(key);
    if (solidAt(game, x, y, z)) break;
    out.push({ x, z });
  }
  return out;
}

function solidAt(game, x, y, z) {
  const b = BLOCKS[game.world.getBlock(x, y, z)];
  const b2 = BLOCKS[game.world.getBlock(x, y + 1, z)];
  return !!(b && b.solid && b.opaque) && !!(b2 && b2.solid);
}

export function areaTiles(cx, cz, r, round = false) {
  const out = [];
  for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) if (!round || dx * dx + dz * dz <= r * r + r) out.push({ x: cx + dx, z: cz + dz });
  return out;
}

const dist = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.z - b.z));
const sees = (game, a, b) => !game.sim || !game.sim.lineOfSight || game.sim.lineOfSight(a.x, a.z, b.x, b.z, a.y + 1);

// Others of its kind nearby.
function allies(game, c, r, pred = null) {
  return game.creatures.filter((o) => o !== c && !o.dead && dist(o, c) <= r && (!pred || pred(o)));
}

// Raise something new at a spot near `at` (a summoning, a call for help).
export function summon(game, species, at, near = 2, opts = {}) {
  for (let i = 0; i < 12; i++) {
    const x = at.x + Math.round((Math.random() - 0.5) * 2 * near);
    const z = at.z + Math.round((Math.random() - 0.5) * 2 * near);
    const y = game.world.findStandY(x, z, at.y);
    if (y < 0 || Math.abs(y - at.y) > 1 || game.occupiedAny?.(x, y, z) || game.entityAt(x, y, z)) continue;
    const c = game.spawnMonster(species, x, y, z, opts);
    if (c) {
      game.renderer.emit(x, y + 0.5, z, { n: 10, color: opts.color || ['#a0e0ff', '#e0f8ff', '#5a8aa0'], up: 30, speed: 20, life: 0.8, gravity: -20 });
      return c;
    }
  }
  return null;
}

// --------------------------------------------------------------- brains
// Each returns true if it's taken care of this turn (else the plain
// chase-and-strike goes on).
export const BRAINS = {
  // A long cold stare: a line of frost toward you, a few paces off.
  wight(c, dt) {
    const game = c.game;
    const t = c.target;
    c.gazeCd = (c.gazeCd ?? 3) - dt;
    if (!t || t.dead || c.windup) return false;
    const d = dist(c, t);
    if (c.gazeCd <= 0 && d >= 2 && d <= 7 && sees(game, c, t)) {
      c.gazeCd = 7 + Math.random() * 3;
      c.face(t.x, t.z);
      const tiles = lineTiles(game, c, t, 7);
      addHazard(game, { by: c, tiles, dur: 1.0, dmg: Math.round(3 * (c.dmgMult || 1)), chill: 2.5, kind: 'beam', from: { x: c.x, z: c.z }, to: tiles[tiles.length - 1] || t, color: COLORS.cold, beamColor: '#e0f4ff', halo: '#60a0ff' });
      c.stunT = 1.05;
      c.say?.('...', 1);
      game.audio?.play('freeze', c);
      return true;
    }
    return false;
  },

  // A captain: rallies the dead about it now and then (quicker on their
  // feet and blows for a while), and fights behind its shield.
  captain(c, dt) {
    const game = c.game;
    c.rallyCd = (c.rallyCd ?? 4) - dt;
    if (c.target && c.rallyCd <= 0) {
      const near = allies(game, c, 7, (o) => o.S.undead);
      if (near.length) {
        c.rallyCd = 10;
        for (const o of near) {
          o.hasteT = 5;
          game.renderer.emit(o.x, o.y + 1.5, o.z, { n: 4, color: ['#ff6040', '#ffb080'], up: 16, life: 0.6, shape: 'star', oy: -10 });
        }
        game.renderer.floatText(c.x, c.y + 2.6, c.z, 'rallies the dead!', '#ff9070');
        game.renderer.effect?.({ type: 'ring', wx: c.x, wy: c.y, wz: c.z, r0: 3, r1: 40, color: ['#ff6040', '#ffb080'], life: 0.6, oy: 4, flat: 0.5 });
        game.audio?.play('horn', c);
      }
    }
    return false;
  },

  // Under black water till you're near; then up, and a grab.
  drowned(c) {
    const game = c.game;
    const wet = game.world.isWaterAt(c.x, c.y, c.z);
    const t = game.findPrey(c, 3);
    if (c.submerged) {
      if (t || c.hp < c.maxHp) {
        c.submerged = false;
        c.target = t || c.target;
        game.renderer.emit(c.x, c.y + 0.5, c.z, { n: 14, color: ['#80b8d8', '#c8e8f8', '#ffffff'], up: 40, speed: 40, gravity: 160, life: 0.7 });
        game.audio?.play('splash', c);
        c.stunT = 0.35;
        return true;
      }
      return true;
    }
    if (wet && !c.target && !c.windup) {
      c.submerged = true;
      return true;
    }
    return false;
  },

  // Down into the earth, and along under it toward you; up again where
  // you stand (the ground cracking first); dazed a moment after.
  crawler(c, dt) {
    const game = c.game;
    const t = c.target;
    c.digCd = (c.digCd ?? 2) - dt;
    if (c.burrowed) {
      c.solid = false;
      if (!t || t.dead) return surface(c, null);
      if (Math.random() < dt * 8) game.renderer.emit(c.x, c.y, c.z, { n: 2, color: ['#7a5a3a', '#5a4430'], up: 10, speed: 14, life: 0.5, oy: 6, shape: 'puff' });
      if (c.erupting) return true;
      if (dist(c, t) <= 1 || c.dugT > 4) {
        c.erupting = true;
        const big = c.S.big;
        const tiles = areaTiles(t.x, t.z, big ? 1 : 1);
        addHazard(game, { by: c, keep: true, tiles, dur: big ? 1.0 : 0.85, dmg: Math.round((big ? 7 : 4) * (c.dmgMult || 1)), stun: 0.4, knock: 1, from: { x: t.x, z: t.z + 0.001 }, kind: 'erupt', color: COLORS.earth, onFire: () => surface(c, t) });
        return true;
      }
      c.dugT = (c.dugT || 0) + dt;
      if (!c.moving) {
        const sx = Math.sign(t.x - c.x);
        const sz = Math.sign(t.z - c.z);
        const nx = c.x + (Math.abs(t.x - c.x) >= Math.abs(t.z - c.z) ? sx : 0);
        const nz = c.z + (Math.abs(t.x - c.x) >= Math.abs(t.z - c.z) ? 0 : sz);
        const ny = game.world.findStandY(nx, nz, c.y);
        if (ny > 0 && Math.abs(ny - c.y) <= 1) {
          c.face(nx, nz);
          c.startMove(nx, ny, nz, 0.14);
        }
      }
      return true;
    }
    if (t && !c.windup && c.digCd <= 0 && dist(c, t) >= 2 && dist(c, t) <= 9) {
      c.digCd = c.S.big ? 7 : 9;
      c.burrowed = true;
      c.dugT = 0;
      c.solid = false;
      game.removeOcc(c);
      game.renderer.emit(c.x, c.y, c.z, { n: 12, color: ['#7a5a3a', '#5a4430', '#a8885a'], up: 30, speed: 30, gravity: 160, life: 0.6 });
      game.audio?.play('crumble', c);
      return true;
    }
    return false;
  },

  // Drawn to a light (yours, if you carry one): it flutters in and puts it
  // out; with none, it drifts.
  moth(c, dt) {
    const game = c.game;
    const p = game.player;
    const lit = p.heldLightKind && p.heldLightKind() === 'fire';
    c.flutter = (c.flutter || 0) - dt;
    if (!lit || p.dead || dist(c, p) > 12) {
      c.target = null;
      if (c.flutter <= 0 && !c.moving) {
        c.flutter = 0.6 + Math.random();
        c.tryStep(c.x + Math.round(Math.random() * 2 - 1), c.z + Math.round(Math.random() * 2 - 1), c.S.step * 1.5);
      }
      return true;
    }
    c.target = p;
    if (dist(c, p) <= 1 && !(c.attackCd > 0)) {
      c.attackCd = 4;
      if (p.snuff) p.snuff(6);
      game.damage(p, 1, c);
      return true;
    }
    // Erratic: now straight at you, now aside.
    if (!c.moving && c.flutter <= 0) {
      c.flutter = 0.15 + Math.random() * 0.25;
      const sx = Math.sign(p.x - c.x);
      const sz = Math.sign(p.z - c.z);
      const odd = Math.random() < 0.3;
      if (!c.tryStep(c.x + (odd ? sz : sx), c.z + (odd ? -sx : sz), c.S.step)) c.tryStep(c.x + sx, c.z, c.S.step);
    }
    return true;
  },

  // ------------------------------------------------ the masters
  // The Barrow King: a greatsword, a slam that shakes the barrow, the cold
  // stare, and the dead called up round him as he weakens.
  barrowKing(c, dt) {
    const game = c.game;
    phaseSummons(c, [0.66, 0.33], () => {
      for (let i = 0; i < 3; i++) summon(game, i === 0 ? 'wight' : 'skeleton', c, 3, { level: c.level });
      game.renderer.floatText(c.x, c.y + 3, c.z, 'RISE!', '#a0e8ff');
      game.audio?.play('scream', c);
    });
    if (bossSlam(c, dt, 1, 1.1, 6, 9)) return true;
    return BRAINS.wight(c, dt);
  },

  // A heaving mound of bones: slams, a storm of bones flung down round you,
  // and it sheds the dead as it's broken up.
  horror(c, dt) {
    const game = c.game;
    const t = c.target;
    phaseSummons(c, [0.75, 0.5, 0.25], () => {
      for (let i = 0; i < 2; i++) summon(game, i ? 'rat' : 'skeleton', c, 2, { level: c.level });
      game.renderer.emit(c.x, c.y + 1, c.z, { n: 20, color: ['#d8d0b8', '#a8a088'], up: 40, speed: 60, gravity: 200, life: 0.7 });
    });
    c.stormCd = (c.stormCd ?? 4) - dt;
    if (t && !c.windup && c.stormCd <= 0 && dist(c, t) <= 9) {
      c.stormCd = 6;
      const tiles = [];
      for (let i = 0; i < 7; i++) tiles.push({ x: t.x + Math.round((Math.random() - 0.5) * 5), z: t.z + Math.round((Math.random() - 0.5) * 5) });
      tiles.push({ x: t.x, z: t.z });
      addHazard(game, { by: c, tiles, dur: 1.2, dmg: Math.round(4 * (c.dmgMult || 1)), kind: 'rocks', color: COLORS.blow });
      return false;
    }
    return bossSlam(c, dt, 1, 1.0, 5, 7);
  },

  // The Deep Worm: under, and up beneath you (wider than any crawler), and
  // the roof coming down where it's been.
  worm(c, dt) {
    const game = c.game;
    const t = c.target;
    c.roofCd = (c.roofCd ?? 6) - dt;
    if (t && c.roofCd <= 0 && !c.burrowed) {
      c.roofCd = 8;
      const tiles = [];
      for (let i = 0; i < 6; i++) tiles.push({ x: t.x + Math.round((Math.random() - 0.5) * 7), z: t.z + Math.round((Math.random() - 0.5) * 7) });
      addHazard(game, { by: c, tiles, dur: 1.3, dmg: Math.round(5 * (c.dmgMult || 1)), stun: 0.5, kind: 'rocks', color: COLORS.earth });
      game.renderer.floatText(t.x, t.y + 3, t.z, 'the roof shakes!', '#e0c8a0');
    }
    phaseSummons(c, [0.5], () => {
      for (let i = 0; i < 2; i++) summon(game, 'crawler', c, 3, { level: c.level });
    });
    return BRAINS.crawler(c, dt);
  },

  // The Drowned Priest: keeps off, throws cold, sends the tide across the
  // floor, and calls the drowned up out of the water.
  priest(c, dt) {
    const game = c.game;
    const t = c.target;
    phaseSummons(c, [0.7, 0.4], () => {
      for (let i = 0; i < 3; i++) summon(game, 'drowned', c, 4, { level: c.level, color: ['#80b8d8', '#c8e8f8'] });
      game.renderer.floatText(c.x, c.y + 3, c.z, 'from the deep, come!', '#a0e8d0');
    });
    c.tideCd = (c.tideCd ?? 5) - dt;
    if (t && c.tideCd <= 0) {
      c.tideCd = 7;
      // A wave rolling across: a row of the floor, then the next.
      for (let k = -2; k <= 2; k++) {
        const tiles = [];
        for (let dx = -6; dx <= 6; dx++) tiles.push({ x: t.x + dx, z: t.z + k });
        addHazard(game, { by: c, tiles, dur: 1.1 + (k + 2) * 0.25, dmg: 2, chill: 2, knock: 1, from: { x: t.x, z: t.z - 3 }, kind: 'cold', color: COLORS.cold });
      }
      game.audio?.play('splash', c);
    }
    c.castCd = (c.castCd ?? 2) - dt;
    if (t && c.castCd <= 0 && dist(c, t) <= 9 && !c.windup) {
      c.castCd = 2.6;
      game.lobOrb(c, t.x, t.y, t.z, Math.round(3 * (c.dmgMult || 1)));
      c.doAction?.(0.3);
    }
    // Hangs back, out of reach.
    if (t && dist(c, t) <= 2 && !c.moving) {
      const sx = Math.sign(c.x - t.x) || 1;
      const sz = Math.sign(c.z - t.z) || 1;
      if (c.tryStep(c.x + sx, c.z, c.S.step) || c.tryStep(c.x, c.z + sz, c.S.step)) return true;
    }
    return !!t && dist(c, t) > 1;
  },

  // The Bandit Warlord: a war hammer, fire pots thrown at you, and the
  // holdout's archers called in when it goes badly.
  warlord(c, dt) {
    const game = c.game;
    const t = c.target;
    phaseSummons(c, [0.5], () => {
      for (let i = 0; i < 2; i++) summon(game, 'holdout_archer', c, 5, { level: c.level, color: ['#c8a070', '#8a6a4a'] });
      c.say?.('To me! Shoot them down!', 3, '#ff9070');
    });
    c.potCd = (c.potCd ?? 4) - dt;
    if (t && c.potCd <= 0 && dist(c, t) >= 2 && dist(c, t) <= 8 && !c.windup) {
      c.potCd = 6;
      const tiles = areaTiles(t.x, t.z, 1);
      addHazard(game, { by: c, tiles, dur: 1.1, dmg: 3, burn: 3, kind: 'fire', center: { x: t.x, z: t.z }, color: COLORS.fire });
      c.say?.(Math.random() < 0.5 ? 'Burn!' : 'Catch!', 1.2, '#ffb080');
      c.doAction?.(0.3);
      game.renderer.emit(c.x, c.y + 1.5, c.z, { n: 6, color: ['#ff9030', '#ffe070'], up: 20, life: 0.4 });
    }
    return bossSlam(c, dt, 1, 1.0, 6, 10);
  },

  // ------------------------------------------------ the Kavorent's
  // A drone: off at a distance, and a beam down a line at you (the line
  // lit first). Two near each other join theirs into a wall of light.
  drone(c, dt) {
    const game = c.game;
    const t = c.target;
    if (!t || t.dead) return false;
    wardenCover(c);
    c.beamCd = (c.beamCd ?? 1.5 + Math.random() * 2) - dt;
    c.linkCd = (c.linkCd ?? 4 + Math.random() * 4) - dt;
    const d = dist(c, t);
    // Linked with another drone: the line between them burns.
    if (c.linkCd <= 0) {
      c.linkCd = 9 + Math.random() * 3;
      const mate = allies(game, c, 6, (o) => o.species === 'drone' && !(o.linkCd < 0.5)).find((o) => sees(game, c, o));
      if (mate) {
        mate.linkCd = c.linkCd;
        const tiles = lineTiles(game, c, mate, 6).filter((q) => !(q.x === mate.x && q.z === mate.z));
        for (let k = 0; k < 4; k++) addHazard(game, { by: c, tiles, dur: 0.9 + k * 0.5, dmg: 2, kind: 'beam', from: { x: c.x, z: c.z }, to: { x: mate.x, z: mate.z }, color: COLORS.kav, beamColor: '#e0fbff', halo: '#5ad8f0', width: 2 });
        game.renderer.floatText(c.x, c.y + 2.4, c.z, 'linked', '#5ad8f0');
        game.audio?.play('hum', c);
      }
    }
    if (c.beamCd <= 0 && d >= 2 && d <= 8 && sees(game, c, t) && !c.windup) {
      c.beamCd = 3.4 + Math.random();
      c.face(t.x, t.z);
      const tiles = lineTiles(game, c, t, 9);
      addHazard(game, { by: c, tiles, dur: 0.9, dmg: Math.round(3 * (c.dmgMult || 1)), kind: 'beam', from: { x: c.x, z: c.z }, to: tiles[tiles.length - 1] || t, color: COLORS.blow });
      c.stunT = 0.95;
      game.audio?.play('charge', c);
      return true;
    }
    // Keep at range.
    if (!c.moving) {
      if (d <= 3) {
        const sx = Math.sign(c.x - t.x) || (Math.random() < 0.5 ? 1 : -1);
        const sz = Math.sign(c.z - t.z) || (Math.random() < 0.5 ? 1 : -1);
        if (c.tryStep(c.x + sx, c.z, c.S.step) || c.tryStep(c.x, c.z + sz, c.S.step)) return true;
      } else if (d > 7) return false;
      else if (Math.random() < dt * 1.5) c.tryStep(c.x + Math.round(Math.random() * 2 - 1), c.z + Math.round(Math.random() * 2 - 1), c.S.step);
    }
    return true;
  },

  // A warden: its shield turns any blow from in front (see guardFront),
  // and shelters drones and menders near it; a bash that sends you
  // reeling.
  warden(c, dt) {
    c.shieldUp = !!c.target;
    c.bashCd = (c.bashCd ?? 3) - dt;
    const t = c.target;
    if (t && c.bashCd <= 0 && dist(c, t) <= 1 && !c.windup && !(c.attackCd > 0)) {
      c.bashCd = 5;
      beginAttack(c.game, c, t, { ...STYLES.bash, windup: 0.7, mult: 1.3, stagger: 1.0, heavy: true });
      return true;
    }
    return false;
  },

  // A mender: to whatever of its kind is hurt, and welds it; away from you.
  mender(c, dt) {
    const game = c.game;
    wardenCover(c);
    const hurt = allies(game, c, 10, (o) => o.S.construct && o.hp < o.maxHp && o.species !== 'mender').sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
    const p = game.player;
    if (hurt) {
      if (dist(c, hurt) <= 1) {
        c.face(hurt.x, hurt.z);
        c.weldT = (c.weldT || 0) + dt;
        if (c.weldT >= 0.5) {
          c.weldT = 0;
          hurt.hp = Math.min(hurt.maxHp, hurt.hp + 2);
          game.renderer.effect?.({ type: 'siphon', wx: c.x, wy: c.y + 0.5, wz: c.z, tx: hurt.x, ty: hurt.y + 1, tz: hurt.z, life: 0.45, oy: -4, n: 8, amp: 2, color: ['#7affb0', '#5ad8f0', '#ffffff'] });
          game.renderer.emit(hurt.x, hurt.y + 1, hurt.z, { n: 3, color: ['#fff8c0', '#5ad8f0'], up: 14, speed: 30, life: 0.3, glow: true });
          if (Math.random() < 0.3) game.renderer.floatText(hurt.x, hurt.y + 2.4, hurt.z, '+2', '#7affb0');
        }
        return true;
      }
      if (!c.moving) {
        const sx = Math.sign(hurt.x - c.x);
        const sz = Math.sign(hurt.z - c.z);
        if (!(sx && c.tryStep(c.x + sx, c.z, c.S.step)) && !(sz && c.tryStep(c.x, c.z + sz, c.S.step))) c.tryStep(c.x + Math.round(Math.random() * 2 - 1), c.z + Math.round(Math.random() * 2 - 1), c.S.step);
      }
      return true;
    }
    // Nothing to mend: keep away from you.
    if (!p.dead && dist(c, p) <= 4 && !c.moving) {
      const sx = Math.sign(c.x - p.x) || 1;
      const sz = Math.sign(c.z - p.z) || 1;
      if (c.tryStep(c.x + sx, c.z, c.S.step) || c.tryStep(c.x, c.z + sz, c.S.step)) return true;
    }
    return dist(c, p) > 1;
  },

  // A golem: a slam that shakes the hall (open to a blow for a moment
  // after: its core shows), a charge down a line.
  golem(c, dt) {
    const game = c.game;
    const t = c.target;
    if (c.exposedT > 0) {
      c.exposedT -= dt;
      if (Math.random() < dt * 10) game.renderer.emit(c.x, c.y + 1.4, c.z, { n: 1, color: ['#5ad8f0', '#ffffff'], up: 10, speed: 10, life: 0.4, glow: true, oy: -10 });
    }
    if (c.species === 'prime') {
      phaseSummons(c, [0.6, 0.3], () => {
        for (let i = 0; i < 3; i++) summon(game, 'mite', c, 3, { level: c.level, color: ['#fff8a0', '#5ad8f0'] });
      });
      c.beamCd = (c.beamCd ?? 4) - dt;
      if (t && c.beamCd <= 0 && dist(c, t) >= 2 && dist(c, t) <= 9 && sees(game, c, t) && !c.windup) {
        c.beamCd = 6;
        const tiles = lineTiles(game, c, t, 10);
        addHazard(game, { by: c, tiles, dur: 1.1, dmg: Math.round(5 * (c.dmgMult || 1)), kind: 'beam', from: { x: c.x, z: c.z }, to: tiles[tiles.length - 1] || t, color: COLORS.blow, width: 4 });
        c.stunT = 1.2;
        return true;
      }
    }
    c.chargeCd = (c.chargeCd ?? 5) - dt;
    if (t && c.chargeCd <= 0 && dist(c, t) >= 3 && dist(c, t) <= 6 && (t.x === c.x || t.z === c.z) && !c.windup) {
      c.chargeCd = 8;
      beginAttack(game, c, t, { ...STYLES.gore, reach: 6, mult: 1.2, windup: 1.0 });
      return true;
    }
    return bossSlam(c, dt, 1, 1.2, c.species === 'prime' ? 8 : 6, 6, () => {
      c.exposedT = 2.5;
      game.renderer.floatText(c.x, c.y + 3, c.z, 'core exposed!', '#5ad8f0');
    });
  },

  // An arc mite: straight at you, then it arms (crackling) and bursts,
  // setting off any others near it.
  mite(c, dt) {
    const game = c.game;
    const t = c.target;
    if (c.armed) return true;
    if (t && dist(c, t) <= 1) {
      detonate(game, c, 0.8);
      return true;
    }
    return false;
  },

  // The Overseer: shielded while the power nodes round its hall burn (put
  // them out: see game/dungeon.js), a sweeping beam, drones called in; the
  // grid of the floor lit and fired as it weakens.
  overseer(c, dt) {
    const game = c.game;
    const t = c.target;
    const nodes = game.dungeon ? game.dungeon.liveNodes() : 0;
    c.shieldUp = nodes > 0;
    if (!t || t.dead) return true;
    const frac = c.hp / c.maxHp;
    c.callCd = (c.callCd ?? 6) - dt;
    if (c.callCd <= 0) {
      c.callCd = frac < 0.33 ? 9 : 14;
      summon(game, frac < 0.33 ? 'mite' : 'drone', c, 4, { level: c.level });
      if (frac < 0.66) summon(game, frac < 0.33 ? 'mite' : 'mender', c, 4, { level: c.level });
    }
    c.beamCd = (c.beamCd ?? 3) - dt;
    if (c.beamCd <= 0 && sees(game, c, t)) {
      c.beamCd = frac < 0.33 ? 2.4 : 3.6;
      // Three beams fanned at you.
      const ang = Math.atan2(t.z - c.z, t.x - c.x);
      for (const s of frac < 0.66 ? [-0.35, 0, 0.35] : [0]) {
        const to = { x: c.x + Math.cos(ang + s) * 12, z: c.z + Math.sin(ang + s) * 12 };
        const tiles = lineTiles(game, c, to, 12);
        addHazard(game, { by: c, tiles, dur: 1.0, dmg: 5, kind: 'beam', from: { x: c.x, z: c.z }, to: tiles[tiles.length - 1] || to, color: COLORS.blow, width: 4 });
      }
      game.audio?.play('charge', c);
    }
    c.gridCd = (c.gridCd ?? 8) - dt;
    if (frac < 0.66 && c.gridCd <= 0) {
      c.gridCd = 10;
      // Every other row of the hall, then the rows between.
      for (let k = -8; k <= 8; k++) {
        const tiles = [];
        for (let dx = -10; dx <= 10; dx++) tiles.push({ x: c.x + dx, z: c.z + k });
        addHazard(game, { by: c, tiles, dur: 1.4 + (Math.abs(k) % 2) * 1.2, dmg: 4, kind: 'beam', from: { x: c.x - 10, z: c.z + k }, to: { x: c.x + 10, z: c.z + k }, color: COLORS.kav, beamColor: '#e0fbff', halo: '#5ad8f0', width: 2 });
      }
      game.renderer.floatText(c.x, c.y + 3, c.z, 'GRID ALIGNING', '#5ad8f0');
    }
    // Drifts to keep its distance.
    if (!c.moving && dist(c, t) <= 3) {
      const sx = Math.sign(c.x - t.x) || 1;
      const sz = Math.sign(c.z - t.z) || 1;
      c.tryStep(c.x + sx, c.z, c.S.step) || c.tryStep(c.x, c.z + sz, c.S.step);
    }
    return true;
  },
};

// Out of the ground again (a crawler, the worm), dazed a moment.
function surface(c) {
  const game = c.game;
  c.burrowed = false;
  c.erupting = false;
  c.solid = true;
  // (Somewhere free to come up.)
  if (game.occupiedBySolid(c.x, c.y, c.z, c)) {
    const s = game.findFreeSpot(c.x, c.z, c.y);
    if (s) c.teleport(s.x, s.y, s.z);
  }
  game.moveEntity(c, c.x, c.y, c.z);
  c.stunT = Math.max(c.stunT || 0, c.S.big ? 1.2 : 1.6);
  return true;
}

// A great slam all round: the ground for `r` paces lit, and then it lands.
function bossSlam(c, dt, r, windup, dmg, every, after = null) {
  const game = c.game;
  const t = c.target;
  c.slamCd = (c.slamCd ?? 2) - dt;
  if (!t || t.dead || c.windup || c.slamCd > 0 || dist(c, t) > r + 1) return false;
  c.slamCd = every;
  const tiles = areaTiles(c.x, c.z, r + (c.S.big ? 1 : 0));
  addHazard(game, { by: c, tiles, dur: windup, dmg: Math.round(dmg * (c.dmgMult || 1)), knock: 2, stun: 0.3, from: { x: c.x, z: c.z }, center: { x: c.x, z: c.z }, radius: r + (c.S.big ? 1 : 0), kind: 'slam', color: COLORS.blow, onFire: after ? () => after() : null });
  c.stunT = windup + 0.15;
  c.say?.(Math.random() < 0.5 ? 'Hrraaagh!' : 'Graaah!', 0.8, '#ff9080');
  game.renderer.floatText(c.x, c.y + 3, c.z, '!', '#ff5040');
  return true;
}

// As it weakens past each mark, once: `then`.
function phaseSummons(c, marks, then) {
  c.phase ??= 0;
  if (c.phase < marks.length && c.hp / c.maxHp <= marks[c.phase]) {
    c.phase++;
    then();
  }
}

// A drone or mender near a warden is sheltered by its shield.
function wardenCover(c) {
  const w = c.game.creatures.find((o) => o.species === 'warden' && !o.dead && dist(o, c) <= 4);
  c.armourT = w ? 0.3 : 0;
}

// An arc mite arms, and bursts.
export function detonate(game, c, delay = 0.8) {
  if (c.armed || c.dead) return;
  c.armed = true;
  c.stunT = delay + 0.2;
  addHazard(game, {
    by: c, keep: true, tiles: areaTiles(c.x, c.z, 1), dur: delay, dmg: Math.round(c.S.dmg * (c.dmgMult || 1)), stun: 0.6, kind: 'burst', center: { x: c.x, z: c.z }, color: [255, 240, 120], trap: true,
    onFire: () => {
      if (c.dead) return;
      // (Any other mite near it goes up with it.)
      for (const o of game.creatures) if (o !== c && !o.dead && o.species === 'mite' && dist(o, c) <= 2) detonate(game, o, 0.25);
      game.kill(c, null);
    },
  });
  game.audio?.play('charge', c);
}

// --------------------------------------------------------------- blows on them
// Before a blow lands on one of these: a warden's shield turns it from the
// front, a golem's plates most of it unless its core's showing, a drone
// sheltered by a warden's shield takes little. Returns what's left of it.
export function guardFront(game, target, source, amount) {
  if (!target.S || !source) return amount;
  const r = game.renderer;
  if (target.burrowed) return 0;
  if (target.submerged) return 0;
  if (target.species === 'overseer' && target.shieldUp) {
    r.floatText(target.x, target.y + 3, target.z, 'shielded', '#5ad8f0');
    r.effect?.({ type: 'ring', wx: target.x, wy: target.y + 1, wz: target.z, r0: 10, r1: 18, color: ['#5ad8f0', '#e0fbff'], life: 0.3, oy: -10, flat: 0.8 });
    game.audio?.play('armor_hit', target);
    return 0;
  }
  if (target.S.shieldBlock || target.species === 'warden') {
    const [fx, fz] = [[0, 1], [-1, 0], [0, -1], [1, 0]][target.dir] || [0, 1];
    const front = fx * Math.sign(source.x - target.x) + fz * Math.sign(source.z - target.z) > 0;
    // (Less often against a Phase Blade.)
    const chance = (target.species === 'warden' ? 0.9 : target.S.shieldBlock) * (1 - pierceOf(source));
    if (front && Math.random() < chance && !(target.stunT > 0)) {
      target.guardT = 0.7;
      target.shieldJolt = 0.18;
      r.floatText(target.x, target.y + 2, target.z, 'blocked', '#a0c8ff');
      r.emit(target.x, target.y + 1.1, target.z, { n: 6, color: ['#ffffff', '#c8e8ff', target.species === 'warden' ? '#5ad8f0' : '#ffe8a0'], up: 30, speed: 60, life: 0.25, glow: true });
      game.audio?.play('armor_hit', target);
      return Math.round(amount * 0.15);
    }
  }
  if (target.S.armoured && !(target.exposedT > 0)) amount = Math.max(1, Math.round(amount * (0.5 + 0.5 * pierceOf(source))));
  else if (target.exposedT > 0) amount = Math.round(amount * 1.8);
  if (target.armourT > 0) amount = Math.max(1, Math.round(amount * 0.35));
  if (target.S.dodge && Math.random() < target.S.dodge && !(target.stunT > 0) && !target.moving) {
    r.floatText(target.x, target.y + 2, target.z, 'dodged', '#c8e8ff');
    // (A quick sidestep.)
    const [fx, fz] = [[0, 1], [-1, 0], [0, -1], [1, 0]][target.dir] || [0, 1];
    target.tryStep?.(target.x + fz, target.z - fx, 0.12) || target.tryStep?.(target.x - fz, target.z + fx, 0.12);
    return 0;
  }
  return amount;
}

// A grabbing blow landed on you (the drowned): held fast till you roll free.
export function onGrab(game, v) {
  if (v.kind !== 'player' || v.dead) return;
  v.grabbedT = 1.4;
  game.renderer.floatText(v.x, v.y + 2.4, v.z, 'grabbed! (roll free)', '#80d0c0');
}

// What a summoned or spawned thing should fight like: drawn from its kind.
export function mobStyle(c) {
  return c.S && c.S.style ? STYLES[c.S.style] : styleOf(c);
}

export { mend };
