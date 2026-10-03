// What lives below ground, and how it fights. Each kind has its own way
// (a "brain", run before the plain chase-and-strike every creature has):
//   barrow wights stare a line of grave-cold at you from a few paces off;
//   a skeleton captain carries a shield and rallies the dead round it
//   (and the sigil to the sealed door); crypt rats come in a rush;
//   the drowned lie under black water till you're close, and grab;
//   tunnel crawlers dig under you and burst up where you stand;
//   gloom moths are drawn to your torch, and snuff it;
//   holdout bandits fight like bandits, archers hanging back; a
//   bombarder lobs dynamite from afar (a knife when you're close); a
//   thief rolls past you to your back and out from under your blows; a
//   coward hangs back shouting for help, and alone, goes berserk.
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
import { beginAttack, styleOf, knock, STYLES, strikeAnim } from '../game/combat.js';
import { burn, chill, stun, mend } from '../game/gems.js';
import { BLOCKS, B as BLOCKS_ID } from '../world/blocks.js';
import { pierceOf } from '../game/kavtech.js';
import { BOSS_SPECIES, BOSS_TITLES, bossBrains } from './bosses.js';
import { startLaser } from '../game/laser.js';
import { GAME_MINUTES_PER_SECOND } from '../config.js';
import { onTiles, fits, fitNear, footTiles } from './footprint.js';
import { phaseOf, ready, used } from './tempo.js';
import { fieldWay, lowerFields } from './fields.js';

export { BOSS_TITLES };

// --------------------------------------------------------------- species
// (Merged into creature.js's SPECIES.) `under`: lives below ground (no
// burning away by day). `style`: how it strikes up close. `big`: drawn 32
// square. `construct`: one of the Kavorent's. `boss`: a master of its place.
export const MONSTER_SPECIES = {
  wight: { light: 2, name: 'Barrow Wight', hp: 26, dmg: 4, step: 0.42, mode: 'hostile', aggro: 9, humanoid: true, look: 'wight', arms: 'iron_sword', under: true, undead: true, brain: 'wight', drops: [['bone', 1, 3, 1], ['old_coin', 1, 2, 0.35]] },
  skel_captain: { name: 'Skeleton Captain', hp: 30, dmg: 4, step: 0.36, mode: 'hostile', aggro: 10, humanoid: true, look: 'captain', arms: 'iron_sword', shield: 'wooden_shield', shieldBlock: 0.5, under: true, undead: true, brain: 'captain', drops: [['bone', 2, 4, 1], ['old_coin', 1, 3, 0.8]] },
  // A chest that isn't (see DungeonRun.wakeMimic): what was in it, it drops.
  mimic: { name: 'Mimic', hp: 34, dmg: 6, step: 0.3, mode: 'hostile', aggro: 12, under: true, style: 'bite', drops: [] },
  rat: { name: 'Crypt Rat', hp: 3, dmg: 1, step: 0.2, mode: 'hostile', aggro: 9, under: true, packs: true, style: 'snap', drops: [['raw_meat', 1, 1, 0.3]] },
  drowned: { name: 'Drowned One', hp: 16, dmg: 3, step: 0.34, mode: 'hostile', aggro: 7, humanoid: true, look: 'drowned', under: true, undead: true, brain: 'drowned', style: 'grab', drops: [['old_coin', 1, 2, 0.3], ['bone', 1, 2, 0.5]] },
  crawler: { name: 'Tunnel Crawler', hp: 22, dmg: 4, step: 0.3, mode: 'hostile', aggro: 10, under: true, brain: 'crawler', style: 'bite', drops: [['leather', 1, 2, 0.6], ['iron_ore', 1, 2, 0.4]] },
  moth: { name: 'Gloom Moth', hp: 4, dmg: 1, step: 0.26, mode: 'hostile', aggro: 12, under: true, floats: true, brain: 'moth', style: 'snap', drops: [] },
  cutthroat: { name: 'Holdout Cutthroat', hp: 15, dmg: 3, step: 0.3, mode: 'hostile', aggro: 9, humanoid: true, look: 'cutthroat', arms: 'dagger', offhand: 'dagger', dodge: 0.2, under: true, bandit: true, drops: [['coin', 1, 5, 0.8], ['old_coin', 1, 1, 0.2]] },
  holdout_archer: { name: 'Holdout Archer', hp: 11, dmg: 3, step: 0.32, mode: 'hostile', aggro: 11, humanoid: true, look: 'holdout_archer', arms: 'bow', ranged: true, under: true, bandit: true, drops: [['arrow', 3, 8, 1], ['coin', 1, 4, 0.7]] },
  // (Three more of the holdout's own: see their brains.)
  bombarder: { name: 'Holdout Bombarder', hp: 14, dmg: 3, step: 0.33, mode: 'hostile', aggro: 11, humanoid: true, look: 'bombarder', arms: 'dynamite', under: true, bandit: true, brain: 'bombarder', drops: [['dynamite', 1, 2, 0.6], ['coin', 1, 4, 0.7]] },
  thief: { name: 'Holdout Thief', hp: 12, dmg: 2, step: 0.24, mode: 'hostile', aggro: 10, humanoid: true, look: 'thief', arms: 'dagger', offhand: 'dagger', kits: [['dagger', 'dagger'], ['dagger', 'dagger'], ['short_sword', 'dagger'], ['dagger', null]], dodge: 0.3, under: true, bandit: true, brain: 'thief', drops: [['coin', 2, 7, 0.9], ['lockpick', 1, 2, 0.35]] },
  coward: { name: 'Holdout Coward', hp: 10, dmg: 2, step: 0.3, mode: 'hostile', aggro: 10, humanoid: true, look: 'coward', arms: 'dagger', under: true, bandit: true, brain: 'coward', drops: [['coin', 1, 3, 0.6], ['bread', 1, 1, 0.3]] },
  // The masters of their places.
  barrow_king: { name: 'The Barrow King', hp: 110, dmg: 6, step: 0.46, mode: 'hostile', aggro: 14, humanoid: true, look: 'wight_king', arms: 'greatsword', under: true, undead: true, boss: true, brain: 'barrowKing', drops: [['old_coin', 4, 10, 1], ['gold_ingot', 1, 2, 1]] },
  horror: { name: 'The Ossuary Horror', hp: 120, dmg: 5, step: 0.6, mode: 'hostile', aggro: 14, big: true, under: true, undead: true, boss: true, brain: 'horror', style: 'slam', drops: [['bone', 6, 12, 1], ['old_coin', 4, 10, 1]] },
  worm: { name: 'The Deep Worm', hp: 130, dmg: 6, step: 0.4, mode: 'hostile', aggro: 16, big: true, under: true, boss: true, brain: 'worm', style: 'bite', drops: [['gem', 2, 4, 1], ['gold_ore', 3, 6, 1], ['iron_ore', 4, 8, 1]] },
  priest: { name: 'The Drowned Priest', hp: 100, dmg: 4, step: 0.4, mode: 'hostile', aggro: 14, humanoid: true, look: 'priest', under: true, undead: true, boss: true, brain: 'priest', drops: [['old_coin', 4, 10, 1], ['gold_ingot', 1, 2, 1]] },
  warlord: { name: 'The Bandit Warlord', hp: 120, dmg: 6, step: 0.42, mode: 'hostile', aggro: 14, humanoid: true, look: 'warlord', arms: 'warhammer', under: true, boss: true, brain: 'warlord', drops: [['coin', 12, 30, 1], ['gold_ingot', 1, 2, 1]] },
  // The Kavorent's constructs (lightly built: half what they were).
  drone: { light: 4, noHalo: true, name: 'Sentinel Drone', hp: 7, dmg: 3, step: 0.34, mode: 'hostile', aggro: 12, floats: true, under: true, construct: true, brain: 'drone', style: 'sting', drops: [['kav_scrap', 1, 2, 0.8]] },
  warden: { name: 'Warden', hp: 17, dmg: 4, step: 0.44, mode: 'hostile', aggro: 11, humanoid: true, look: 'warden', arms: 'mace', shield: 'kav_aegis', under: true, construct: true, brain: 'warden', drops: [['kav_scrap', 2, 3, 1]] },
  mender: { light: 2, name: 'Mender', hp: 4, dmg: 1, step: 0.24, mode: 'hostile', aggro: 12, under: true, construct: true, brain: 'mender', style: 'snap', drops: [['kav_scrap', 1, 1, 0.8]] },
  golem: { light: 3, name: 'Kavorent Golem', hp: 40, dmg: 7, step: 0.6, mode: 'hostile', aggro: 11, big: true, under: true, construct: true, armoured: true, brain: 'golem', style: 'slam', drops: [['kav_scrap', 3, 6, 1]] },
  mite: { light: 2, name: 'Arc Mite', hp: 3, dmg: 5, step: 0.22, mode: 'hostile', aggro: 12, under: true, construct: true, packs: true, brain: 'mite', drops: [['kav_scrap', 1, 1, 0.3]] },
  prime: { light: 5, name: 'Prime Golem', hp: 128, dmg: 8, step: 0.58, mode: 'hostile', aggro: 14, big: true, under: true, construct: true, armoured: true, boss: true, brain: 'golem', style: 'slam', drops: [['kav_scrap', 6, 10, 1], ['kav_core', 1, 1, 1]] },
  overseer: { light: 9, name: 'The Overseer', hp: 320, dmg: 6, step: 0.5, mode: 'hostile', aggro: 18, big: true, floats: true, anim: true, under: true, construct: true, boss: true, brain: 'overseer', drops: [['kav_scrap', 4, 8, 1], ['overseer_eye', 1, 1, 1]] },
  // (And the other masters: see bosses.js.)
  ...BOSS_SPECIES,
};

// A strike that grabs and holds you (the drowned): roll to break free.
STYLES.grab = { name: 'grab', windup: 0.6, recover: 1.0, reach: 1, mult: 0.8, grab: true };

const COLORS = { blow: [255, 70, 50], cold: [90, 170, 255], kav: [90, 216, 240], earth: [200, 150, 90], fire: [255, 140, 40], void: [160, 100, 220], poison: [130, 200, 60] };

// --------------------------------------------------------------- hazards
// Something coming down on that ground in `dur` seconds (see the header).
export function addHazard(game, h) {
  h.t = 0;
  h.y ??= h.by ? h.by.y : game.player.y;
  // (A master going for you: see tempo.press.)
  if (h.by && h.by.isBoss) h.by.sinceAtk = 0;
  (game.hazards ||= []).push(h);
  return h;
}

export function updateHazards(game, dt) {
  updateZones(game, dt);
  if (!game.hazards || !game.hazards.length) return;
  for (const h of game.hazards) {
    h.t += dt;
    // (A lit fuse fizzing where it lies.)
    if (h.spark && Math.random() < dt * 30) game.renderer.emit(h.spark.x, h.spark.y + 0.4, h.spark.z, { n: 1, color: ['#ffe070', '#ff9030', '#ffffff'], up: 22, speed: 30, life: 0.3, glow: true, oy: 2 });
    if (h.by && h.by.dead && !h.keep && !h.trap) h.done = true;
    if (h.done || h.t < h.dur) continue;
    h.done = true;
    fireHazard(game, h);
  }
  game.hazards = game.hazards.filter((h) => !h.done);
}

function fireHazard(game, h) {
  const r = game.renderer;
  const on = (e) => !e.dead && !e.down && !e.burrowed && onTiles(e, h.tiles) && Math.abs(e.y - h.y) <= 1;
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
  } else if (h.kind === 'hex') {
    // A hex going off: a ring of violet fire, and sparks.
    const [cr, cg, cb] = h.color || COLORS.void;
    const col = `rgb(${cr},${cg},${cb})`;
    if (h.tiles.length <= 12) r.effect?.({ type: 'ring', wx: (h.center || mid).x, wy: h.y, wz: (h.center || mid).z, r0: 3, r1: 22, color: [col, '#ffffff'], life: 0.4, oy: 3, flat: 0.5, thick: 2 });
    for (const t of h.tiles) if (h.tiles.length <= 12 || Math.random() < 0.15) r.emit(t.x, h.y + 0.3, t.z, { n: 2, color: [col, '#ffffff'], up: 24, speed: 14, life: 0.5, glow: true });
    if (!h.quiet || Math.random() < 0.5) game.audio?.play('void', mid);
  } else if (h.kind === 'acid') {
    for (const t of h.tiles) r.emit(t.x, h.y + 0.4, t.z, { n: 3, color: ['#8ac040', '#c8f070', '#5a8a2a'], up: 20, speed: 20, gravity: 160, life: 0.5 });
    game.audio?.play('splash', mid);
  }
  if (h.onFire) h.onFire(game, h, hit);
  // (Fire or a blast on a powder keg sets it off.)
  if (h.kind === 'fire' || h.kind === 'burst' || h.kind === 'blast') {
    for (const t of h.tiles) if (game.world.getBlock(t.x, h.y, t.z) === BLOCKS_ID.powder_keg) kegBlast(game, t.x, h.y, t.z, 0.5);
  }
  return hit;
}

// A powder keg going up: its fuse fizzes a moment (run), then a blast all
// round it that hurts anyone, theirs or yours, and sets off any keg near.
export function kegBlast(game, x, y, z, fuse = 1.4) {
  if (game.world.getBlock(x, y, z) === BLOCKS_ID.powder_keg) game.world.setBlock(x, y, z, BLOCKS_ID.air);
  game.audio?.play('fuse', { x, z });
  game.renderer.emit(x, y + 0.8, z, { n: 8, color: ['#ffe070', '#ff9030'], up: 20, speed: 30, life: 0.4, glow: true });
  addHazard(game, {
    tiles: areaTiles(x, z, 2, true), y, dur: fuse, dmg: 9, burn: 2, knock: 2, from: { x, z: z + 0.001 }, center: { x, z }, kind: 'blast', color: [255, 140, 40], trap: true,
    onFire: () => {
      game.renderer.effect?.({ type: 'blast', wx: x, wy: y, wz: z, r1: 36, life: 0.7, oy: 2 });
      game.renderer.emit(x, y + 1, z, { n: 30, color: ['#ff9030', '#ffe070', '#5a5048', '#3a3430'], up: 60, speed: 90, gravity: 120, life: 0.9 });
      game.audio?.play('boom', { x, z });
      game.shake = Math.min(1.5, (game.shake || 0) + 0.9);
      game.lightDirty = true;
    },
  });
}

function withinLeash(c, x, z) {
  const L = c.leash;
  return !L || (x >= L.x0 && x <= L.x1 && z >= L.z0 && z <= L.z1);
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

// ------------------------------------------------------------- zones
// Ground that stays bad a while: poison pooled, webs, a snare, caltrops, a
// whirlpool, mist, smoke. Drawn over the floor in its colour while it
// lasts (see renderer.drawTelegraphs); does its harm to whoever's in it:
//   tick/dmg   harm every `tick` seconds while you're in it
//   chill      and cold, with it
//   pull       drawn a pace toward that spot each tick (a whirlpool)
//   root       stuck a moment on stepping in (roll free)
//   once       gone once it's sprung (a snare), its `dmg` dealt
//   step       harm for every pace taken in it (caltrops)
//   slow       slower going while in it
export function addZone(game, z) {
  z.t = 0;
  z.acc = 0;
  z.y ??= game.player.y;
  (game.zones ||= []).push(z);
  return z;
}

function updateZones(game, dt) {
  const p = game.player;
  if (p.markedT > 0) p.markedT -= dt;
  if (!game.zones || !game.zones.length) return;
  for (const z of game.zones) {
    z.t += dt;
    if (z.t >= z.life) {
      z.done = true;
      continue;
    }
    const at = (e) => !e.dead && !e.down && !e.burrowed && Math.abs(e.y - z.y) <= 1 && onTiles(e, z.tiles);
    // (Fire set by your own hand burns what's hostile too.)
    const inside = [p, ...game.npcs, ...(z.all ? game.creatures.filter((c) => c !== z.by && !c.S?.floats && (c.hostileNow || c.S?.mode === 'hostile')) : [])].filter((e) => e !== z.by && at(e));
    // A fire spreads, once, to a pace or two beside it.
    if (z.kind === 'fire' && z.spread > 0 && z.t > 1 && !z.spreadDone) {
      z.spreadDone = true;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (Math.random() < 0.35) groundFire(game, z.tiles[0].x + dx, z.tiles[0].z + dz, z.y, z.by, z.all, z.spread - 1);
    }
    z.seen ||= new Map();
    for (const e of inside) {
      const key = `${e.x},${e.z}`;
      const was = z.seen.get(e);
      if (was === key) {
        if (z.slow) e.slowT = Math.max(e.slowT || 0, 0.5);
        continue;
      }
      z.seen.set(e, key);
      if (z.slow) e.slowT = Math.max(e.slowT || 0, 0.5);
      // Stepped in (or a pace further in).
      if (was === undefined && z.root && e.kind === 'player' && !(e.rollT > 0)) {
        e.grabbedT = Math.max(e.grabbedT || 0, z.root);
        game.renderer.floatText(e.x, e.y + 2.4, e.z, z.kind === 'web' ? 'webbed! (roll free)' : 'snared! (roll free)', '#e0e0e8');
        game.audio?.play(z.kind === 'snare' ? 'clang' : 'skitter', e);
      }
      if (z.step && !(e.rollT > 0)) {
        game.dotHit = true;
        game.damage(e, z.step, z.by || null);
        game.dotHit = false;
      }
      if (z.once) {
        if (z.dmg) game.damage(e, z.dmg, z.by || null);
        game.renderer.emit(e.x, e.y + 0.5, e.z, { n: 8, color: ['#8a8a90', '#c8c8d0'], up: 20, speed: 30, life: 0.4 });
        z.done = true;
      }
    }
    for (const e of [...z.seen.keys()]) if (!inside.includes(e)) z.seen.delete(e);
    // Its harm, every so often, to whoever's in it.
    if (z.tick && !z.done) {
      z.acc += dt;
      if (z.acc >= z.tick) {
        z.acc = 0;
        for (const e of inside) {
          if (z.dmg) {
            game.dotHit = true;
            game.damage(e, z.dmg, z.by || null);
            game.dotHit = false;
          }
          if (z.chill) chill(e, z.chill);
          if (z.burn) burn(game, e, z.by, z.burn);
          if (z.pull && !(e.x === z.pull.x && e.z === z.pull.z)) knock(game, { x: 2 * e.x - z.pull.x, z: 2 * e.z - z.pull.z }, e, 1);
        }
      }
    }
    // (A wisp of its colour now and then; flames lick up off a fire.)
    if (z.puff && Math.random() < dt * Math.min(8, z.tiles.length) * (z.kind === 'fire' ? 3 : 1)) {
      const q = z.tiles[Math.floor(Math.random() * z.tiles.length)];
      if (z.kind === 'fire') game.renderer.emit(q.x + (Math.random() - 0.5) * 0.6, z.y + 0.1, q.z, { n: 1, color: z.puff, up: 22, speed: 5, gravity: -30, life: 0.5, glow: true });
      else game.renderer.emit(q.x, z.y + 0.2, q.z, { n: 1, color: z.puff, up: 6, speed: 4, life: 0.9, shape: 'puff', gravity: -4 });
    }
  }
  game.zones = game.zones.filter((z) => !z.done);
}

// A patch of floor set alight a while (by the great beam: see
// game/laser.js): it burns whoever's in it, and spreads a little, once.
// (`all`: set by your own hand, so it burns the hostile too.)
export function groundFire(game, x, z, y, by = null, all = false, spread = 1) {
  const key = x * 65536 + z;
  game.fireTiles ||= new Map();
  const old = game.fireTiles.get(key);
  if (old && !old.done && old.t < old.life - 1) return null;
  const b = BLOCKS[game.world.getBlock(x, y, z)];
  if (b && b.solid) return null;
  const below = BLOCKS[game.world.getBlock(x, y - 1, z)];
  if (!below || !below.solid || below.liquid) return null;
  const zn = addZone(game, { by, kind: 'fire', tiles: [{ x, z }], y, life: 4 + Math.random() * 2, tick: 0.5, dmg: 1, burn: 1.5, all, spread, color: [255, 120, 30], puff: ['#ff8030', '#ffd060', '#ff4020'] });
  game.fireTiles.set(key, zn);
  return zn;
}

// Something thrown in an arc to a spot (a flask, a charge, grave-light):
// `onLand(game, x, z, y)` when it comes down; with none, a burst of cold
// as a wisp's does (`dmg`).
export function lob(game, from, tx, tz, o = {}) {
  if (from && from.isBoss) from.sinceAtk = 0;
  const ty = game.world.findStandY(tx, tz, from.y);
  game.lobOrb(from, tx, ty > 0 ? ty : from.y, tz, o.dmg ?? 0);
  const a = game.projectiles[game.projectiles.length - 1];
  if (a) {
    a.tint = o.tint || null;
    a.onLand = o.onLand || null;
  }
  return a;
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

// A stick of dynamite, lit and thrown (by a bombarder, or by you): it
// tumbles through the air, lands, fizzes a moment (the ground it'll throw
// lit up) and goes up. It hurts anyone near, theirs or yours (all but
// whoever threw it), and sets off any powder kegs about it.
export function throwDynamite(game, by, tx, tz, o = {}) {
  const a = lob(game, by, tx, tz, { tint: [255, 140, 60], onLand: (g, x, z, y) => dynamiteBlast(g, x, y, z, by, o) });
  if (a) {
    a.stick = true;
    a.dur = Math.max(0.55, a.dur * 0.75);
  }
  game.audio?.play('fuse', by);
  return a;
}

export function dynamiteBlast(game, x, y, z, by = null, o = {}) {
  const fuse = o.fuse ?? 0.9;
  const r = game.renderer;
  game.audio?.play('fuse', { x, z });
  addHazard(game, {
    by, tiles: areaTiles(x, z, 1, false), y, dur: fuse, dmg: o.dmg ?? 5, burn: 1, knock: 2, from: { x, z: z + 0.001 }, center: { x, z }, kind: 'blast', color: [255, 140, 40], trap: true, spark: { x, y, z },
    onFire: (g) => {
      r.effect?.({ type: 'blast', wx: x, wy: y, wz: z, r1: 26, life: 0.6, oy: 2 });
      r.effect?.({ type: 'ring', wx: x, wy: y, wz: z, r0: 4, r1: 30, color: ['#ffe070', '#ff9030'], life: 0.4, oy: 4, flat: 0.5, thick: 2 });
      r.emit(x, y + 1, z, { n: 22, color: ['#ff9030', '#ffe070', '#5a5048', '#3a3430'], up: 50, speed: 80, gravity: 120, life: 0.8 });
      r.emit(x, y + 0.5, z, { n: 8, color: ['#6a6058', '#4a4440'], up: 20, speed: 30, life: 1.2, shape: 'puff', grow: 2 });
      g.audio?.play('boom', { x, z });
      g.shake = Math.min(1.4, (g.shake || 0) + 0.6);
      g.lightDirty = true;
      // (Kegs near it go up too.)
      for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) {
        for (const yy of [y, y + 1]) if (g.world.getBlock(x + dx, yy, z + dz) === BLOCKS_ID.powder_keg) kegBlast(g, x + dx, yy, z + dz, 0.5);
      }
    },
  });
}

// A pace away from `t` (any way that isn't toward them). True if it moved.
function backOff(c, t, pace = 1) {
  if (c.moving) return false;
  const dx = Math.sign(c.x - t.x) || (Math.random() < 0.5 ? 1 : -1);
  const dz = Math.sign(c.z - t.z) || (Math.random() < 0.5 ? 1 : -1);
  const opts = Math.random() < 0.5 ? [[dx, 0], [0, dz], [dx, dz], [-dz, dx], [dz, -dx]] : [[0, dz], [dx, 0], [dx, dz], [dz, -dx], [-dz, dx]];
  for (const [ox, oz] of opts) {
    if (!ox && !oz) continue;
    if (c.tryStep(c.x + Math.sign(ox), c.z + Math.sign(oz), c.stepTime() * pace)) {
      c.face(t.x, t.z);
      return true;
    }
  }
  return false;
}

// Is `t` about to land a blow (or loose an arrow)?
function windingUp(t) {
  return !!((t.swing && t.swing.t < t.swing.dur) || t.windup || t.bowDraw);
}

// A thief's roll: low and quick along (dx, dz), `far` paces, clean past
// anyone in the way (never ending up on them). True if it went.
export function tumble(c, dx, dz, far = 2) {
  const game = c.game;
  const w = game.world;
  let x = c.x;
  let z = c.z;
  let y = c.y;
  let land = null;
  for (let i = 0; i < far + 2; i++) {
    const ny = w.stepTarget(x, y, z, x + dx, z + dz, false);
    if (ny < 0 || w.isWaterAt(x + dx, ny, z + dz) || !withinLeash(c, x + dx, z + dz)) break;
    x += dx;
    z += dz;
    y = ny;
    if (!game.occupiedBySolid(x, y, z, c)) land = { x, y, z, n: i + 1 };
    if (i + 1 >= far && land && land.n === i + 1) break;
  }
  if (!land) return false;
  c.rollT = 0.34;
  c.rollDur = c.rollT;
  c.rollDir = [dx, dz];
  c.windup = null;
  c.startMove(land.x, land.y, land.z, 0.075 * land.n);
  c.moveEase = 'out';
  game.renderer.emit(c.x, c.y, c.z, { n: 8, color: ['#a89878', '#8a7a5a'], up: 8, speed: 30, life: 0.45, oy: 6, shape: 'puff' });
  game.audio?.play('roll', c);
  return true;
}

// An overhand throw, as it's drawn.
function strikeAnimOf(c) {
  strikeAnim(c, STYLES.spear);
}

// The holdout's own, near enough to hear a shout (or to be missed).
function banditsNear(game, c, r) {
  return allies(game, c, r, (o) => o.S.bandit && !o.S.boss && !o.isBoss);
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
        if (ny > 0 && Math.abs(ny - c.y) <= 1 && withinLeash(c, nx, nz)) {
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
  // Each in three phases (see tempo.js): whole, worn, desperate, each
  // bringing out an attack or two it held back; a breath between its
  // attacks (ready/used), never all at once.
  // The Barrow King: a greatsword, a slam that shakes the barrow, the cold
  // stare, a spectral charge, and the dead called up round him as he
  // weakens; worn, his crown of frost and the grave-blades bursting up in
  // lines toward you; desperate, a wraith's step to your back, blade first.
  barrowKing(c, dt) {
    const game = c.game;
    const t = c.target;
    const ph = phaseOf(c);
    phaseSummons(c, [0.66, 0.33], () => {
      for (let i = 0; i < 3; i++) summon(game, i === 0 ? 'wight' : 'skeleton', c, 3, { level: c.level });
      game.renderer.floatText(c.x, c.y + 3, c.z, 'RISE!', '#a0e8ff');
      game.audio?.play('scream', c);
    });
    if (!t || t.dead) return false;
    const d = dist(c, t);
    // A spectral charge down a line at you.
    c.chargeCd = (c.chargeCd ?? 6) - dt;
    if (ready(c) && c.chargeCd <= 0 && d >= 3 && d <= 6 && (t.x === c.x || t.z === c.z) && !c.windup) {
      c.chargeCd = 9;
      used(c);
      beginAttack(game, c, t, { ...STYLES.gore, reach: 6, mult: 1.3, windup: 0.9 });
      c.say?.('Kneel!', 1.2, '#a0e8ff');
      return true;
    }
    // (Worn) His crown of frost: rings of cold rolling out from him.
    c.crownCd = (c.crownCd ?? 3) - dt;
    if (ph >= 2 && ready(c) && c.crownCd <= 0 && !c.windup) {
      c.crownCd = 11;
      used(c, 0.6);
      for (let r = 1; r <= 4; r++) {
        const tiles = areaTiles(c.x, c.z, r).filter((q) => Math.max(Math.abs(q.x - c.x), Math.abs(q.z - c.z)) === r);
        addHazard(game, { by: c, tiles, y: c.y, dur: 0.9 + r * 0.45, dmg: Math.round(3 * mult(c)), chill: 2.5, kind: 'cold', color: COLORS.cold });
      }
      game.renderer.floatText(c.x, c.y + 3, c.z, 'the cold of the grave!', '#a0e8ff');
      c.stunT = 0.8;
      return true;
    }
    // (Worn) Grave-blades: three lines of spectral swords bursting up out
    // of the floor, one after another, fanned at you.
    c.bladeCd = (c.bladeCd ?? 5) - dt;
    if (ph >= 2 && ready(c) && c.bladeCd <= 0 && d >= 2 && d <= 9 && !c.windup) {
      c.bladeCd = 9;
      used(c);
      const ang = Math.atan2(t.z - c.z, t.x - c.x);
      for (const s of [-0.45, 0, 0.45]) {
        const to = { x: c.x + Math.cos(ang + s) * 9, z: c.z + Math.sin(ang + s) * 9 };
        lineTiles(game, c, to, 9).forEach((q, k) => addHazard(game, { by: c, tiles: [q], y: c.y, dur: 0.75 + k * 0.1, dmg: Math.round(4 * mult(c)), chill: 1.2, kind: 'erupt', color: COLORS.cold, quiet: k % 2 === 1 }));
      }
      c.doAction?.(0.4);
      c.say?.('Blades of my fathers!', 1.6, '#a0e8ff');
      game.audio?.play('freeze', c);
      c.stunT = 0.6;
      return true;
    }
    // (Desperate) A wraith's step: gone in a cold mist, and at your back.
    c.stepCd = (c.stepCd ?? 4) - dt;
    if (ph >= 3 && ready(c) && c.stepCd <= 0 && d >= 2 && !c.windup) {
      const back = { x: t.x - (t.dir === 1 ? -1 : t.dir === 3 ? 1 : 0), z: t.z - (t.dir === 0 ? 1 : t.dir === 2 ? -1 : 0) };
      const y = game.world.findStandY(back.x, back.z, c.y);
      if (y === c.y && game.world.canStand(back.x, y, back.z) && !game.occupiedBySolid(back.x, y, back.z, c) && withinLeash(c, back.x, back.z)) {
        c.stepCd = 8;
        used(c);
        game.renderer.emit(c.x, c.y + 1, c.z, { n: 18, color: ['#a0e8ff', '#e0f8ff', '#ffffff'], up: 30, speed: 40, life: 0.6, glow: true });
        addZone(game, { tiles: areaTiles(c.x, c.z, 1), y: c.y, life: 3, kind: 'mist', tick: 0.6, chill: 1.2, color: [160, 210, 240], puff: ['#a0c8e0', '#e0f0ff'] });
        c.teleport(back.x, y, back.z);
        c.path = null;
        game.renderer.emit(c.x, c.y + 1, c.z, { n: 18, color: ['#a0e8ff', '#e0f8ff', '#ffffff'], up: 30, speed: 40, life: 0.6, glow: true });
        game.audio?.play('void', c);
        c.face(t.x, t.z);
        beginAttack(game, c, t, { ...styleOf(c), windup: 0.55, mult: 1.4 });
        c.say?.('Behind you.', 1.4, '#a0e8ff');
        return true;
      }
    }
    if (bossSlam(c, dt, 1, 1.1, 6, 9)) return true;
    // (The cold stare, his own, in its turn.)
    if (!ready(c)) return false;
    const before = c.gazeCd;
    const r = BRAINS.wight(c, dt);
    if (r && c.gazeCd > (before ?? 0)) used(c);
    return r;
  },

  // A heaving mound of bones: slams, a storm of bones flung down round you,
  // and it sheds the dead as it's broken up; worn, spikes of bone bursting
  // out along the floor four ways and the dead's hands up out of the floor
  // to hold you; desperate, the spikes all eight ways and a nova of bone
  // rolling out from it.
  horror(c, dt) {
    const game = c.game;
    const t = c.target;
    const ph = phaseOf(c);
    phaseSummons(c, [0.75, 0.5, 0.25], () => {
      for (let i = 0; i < 2; i++) summon(game, i ? 'rat' : 'skeleton', c, 3, { level: c.level });
      game.renderer.emit(c.x, c.y + 1, c.z, { n: 20, color: ['#d8d0b8', '#a8a088'], up: 40, speed: 60, gravity: 200, life: 0.7 });
    });
    if (!t || t.dead) return false;
    const reach = 1 + (c.foot || 0);
    // (Worn) Spikes of bone, bursting up along the floor from it.
    c.spikeCd = (c.spikeCd ?? 4) - dt;
    if (ph >= 2 && ready(c) && !c.windup && c.spikeCd <= 0) {
      c.spikeCd = 10;
      used(c, 0.4);
      const ways = ph >= 3 ? [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]] : Math.random() < 0.5 ? [[1, 1], [1, -1], [-1, 1], [-1, -1]] : [[1, 0], [-1, 0], [0, 1], [0, -1]];
      for (const [dx, dz] of ways) {
        for (let k = reach; k <= reach + 7; k++) addHazard(game, { by: c, tiles: [{ x: c.x + dx * k, z: c.z + dz * k }], y: c.y, dur: 0.8 + (k - reach) * 0.12, dmg: Math.round(4 * mult(c)), kind: 'erupt', color: [230, 220, 190], quiet: k > reach });
      }
      c.stunT = 0.9;
      return true;
    }
    // (Worn) The dead's hands up out of the floor round you: they hold.
    c.handsCd = (c.handsCd ?? 6) - dt;
    if (ph >= 2 && ready(c) && !c.windup && c.handsCd <= 0 && dist(c, t) <= 10) {
      c.handsCd = 12;
      used(c);
      const tiles = areaTiles(t.x, t.z, 2).filter((q) => Math.random() < 0.45 && withinLeash(c, q.x, q.z));
      tiles.push({ x: t.x, z: t.z });
      addHazard(game, { by: c, tiles, y: t.y, dur: 1.0, dmg: Math.round(2 * mult(c)), kind: 'erupt', color: [200, 190, 160], onFire: (g) => addZone(g, { tiles, y: t.y, life: 4, kind: 'web', root: 1.0, slow: true, color: [210, 200, 170] }) });
      game.renderer.floatText(t.x, t.y + 2.6, t.z, 'hands from below!', '#e8e0c8');
      game.audio?.play('scream', c);
      return false;
    }
    // (Desperate) A nova of bone: rings bursting up, outward from it.
    c.novaCd = (c.novaCd ?? 3) - dt;
    if (ph >= 3 && ready(c) && !c.windup && c.novaCd <= 0) {
      c.novaCd = 11;
      used(c, 0.5);
      for (let r = reach; r <= reach + 5; r++) {
        const tiles = areaTiles(c.x, c.z, r).filter((q) => Math.max(Math.abs(q.x - c.x), Math.abs(q.z - c.z)) === r && (r % 2 === 0 || Math.random() < 0.7));
        addHazard(game, { by: c, tiles, y: c.y, dur: 0.8 + (r - reach) * 0.3, dmg: Math.round(5 * mult(c)), kind: 'erupt', color: [255, 90, 60], quiet: r > reach });
      }
      game.renderer.floatText(c.x, c.y + 3.4, c.z, 'THE OSSUARY BURSTS', '#ff6040');
      game.shake = Math.min(1.4, (game.shake || 0) + 0.5);
      c.stunT = 1.0;
      return true;
    }
    c.stormCd = (c.stormCd ?? 3) - dt;
    if (ready(c) && !c.windup && c.stormCd <= 0 && dist(c, t) <= 9) {
      c.stormCd = ph >= 2 ? 5 : 6;
      used(c);
      const tiles = [];
      for (let i = 0; i < 7 + ph * 2; i++) tiles.push({ x: t.x + Math.round((Math.random() - 0.5) * 5), z: t.z + Math.round((Math.random() - 0.5) * 5) });
      tiles.push({ x: t.x, z: t.z });
      addHazard(game, { by: c, tiles, dur: 1.2, dmg: Math.round(4 * mult(c)), kind: 'rocks', color: COLORS.blow });
      return false;
    }
    return bossSlam(c, dt, 1, 1.0, 5, 7);
  },

  // The Deep Worm: under, and up beneath you (wider than any crawler), acid
  // spat up out of its maw; worn, the roof coming down where it's been and
  // a tremor racing along the floor to you; desperate, it barely stays up
  // between bursts, and comes up wider.
  worm(c, dt) {
    const game = c.game;
    const t = c.target;
    const ph = phaseOf(c);
    phaseSummons(c, [0.5], () => {
      for (let i = 0; i < 2; i++) summon(game, 'crawler', c, 4, { level: c.level });
    });
    if (t && !t.dead && !c.burrowed) {
      // (Worn) The roof shaken down round you.
      c.roofCd = (c.roofCd ?? 3) - dt;
      if (ph >= 2 && ready(c) && c.roofCd <= 0) {
        c.roofCd = 8;
        used(c);
        const tiles = [];
        for (let i = 0; i < 6 + ph * 2; i++) tiles.push({ x: t.x + Math.round((Math.random() - 0.5) * 7), z: t.z + Math.round((Math.random() - 0.5) * 7) });
        addHazard(game, { by: c, tiles, dur: 1.3, dmg: Math.round(5 * mult(c)), stun: 0.5, kind: 'rocks', color: COLORS.earth });
        game.renderer.floatText(t.x, t.y + 3, t.z, 'the roof shakes!', '#e0c8a0');
        game.audio?.play('rumble', c);
      }
      // (Worn) A tremor racing along the floor from it to you.
      c.quakeCd = (c.quakeCd ?? 5) - dt;
      if (ph >= 2 && ready(c) && c.quakeCd <= 0 && dist(c, t) >= 3 && !c.windup) {
        c.quakeCd = 9;
        used(c);
        const path = lineTiles(game, c, t, 12);
        path.forEach((q, k) => {
          if (k < (c.foot || 0)) return;
          addHazard(game, { by: c, tiles: [q, { x: q.x + 1, z: q.z }, { x: q.x - 1, z: q.z }, { x: q.x, z: q.z + 1 }, { x: q.x, z: q.z - 1 }].filter((p) => withinLeash(c, p.x, p.z)), y: c.y, dur: 0.6 + k * 0.09, dmg: Math.round(5 * mult(c)), knock: 1, from: { x: c.x, z: c.z }, kind: 'erupt', color: COLORS.earth, quiet: k % 3 !== 0 });
        });
        game.audio?.play('rumble', c);
        game.shake = Math.min(1.2, (game.shake || 0) + 0.3);
        c.stunT = 0.7;
        return true;
      }
      // Acid, spat up out of its maw: it pools where it lands.
      c.spitCd = (c.spitCd ?? 3) - dt;
      if (ready(c) && c.spitCd <= 0 && dist(c, t) >= 2 && dist(c, t) <= 9) {
        c.spitCd = ph >= 3 ? 5 : 7;
        used(c);
        for (let k = 0; k < (ph >= 3 ? 3 : 2); k++) {
          lob(game, c, t.x + (k ? Math.round((Math.random() - 0.5) * 4) : 0), t.z + (k ? Math.round((Math.random() - 0.5) * 4) : 0), {
            tint: [170, 220, 60],
            onLand: (g, x, z, y) => {
              addZone(g, { tiles: areaTiles(x, z, 1), y, life: 6, kind: 'poison', tick: 0.6, dmg: 1, by: c, color: COLORS.poison, puff: ['#8ac040', '#c8f070'] });
              g.renderer.emit(x, y + 0.5, z, { n: 12, color: ['#8ac040', '#c8f070'], up: 20, speed: 30, gravity: 160, life: 0.6 });
              g.audio?.play('splash', { x, z });
            },
          });
        }
      }
    }
    // Under, and up beneath you. (Desperate: down again almost as soon as
    // it's up.)
    if (ph >= 3 && c.digCd > 3) c.digCd = 3;
    if (!c.burrowed && !ready(c)) return false;
    const was = c.burrowed;
    const r = BRAINS.crawler(c, dt);
    if (!was && c.burrowed) used(c, 0.5);
    return r;
  },

  // The Drowned Priest: keeps off, throws cold, sends the tide across the
  // floor, and calls the drowned up out of the water; worn, a whirlpool
  // where you stand; desperate, the tide from both sides at once, and his
  // cold thrown in threes.
  priest(c, dt) {
    const game = c.game;
    const t = c.target;
    const ph = phaseOf(c);
    phaseSummons(c, [0.7, 0.4], () => {
      for (let i = 0; i < 3; i++) summon(game, 'drowned', c, 4, { level: c.level, color: ['#80b8d8', '#c8e8f8'] });
      game.renderer.floatText(c.x, c.y + 3, c.z, 'from the deep, come!', '#a0e8d0');
    });
    if (!t || t.dead) return false;
    // (Worn) A whirlpool where you stand: it drags you in toward its eye.
    c.whirlCd = (c.whirlCd ?? 3) - dt;
    if (ph >= 2 && ready(c) && c.whirlCd <= 0) {
      c.whirlCd = 13;
      used(c);
      const eye = { x: t.x, z: t.z };
      addZone(game, { tiles: areaTiles(eye.x, eye.z, 2, true), y: t.y, life: 6, kind: 'whirl', tick: 0.55, dmg: 1, pull: eye, by: c, color: [80, 150, 200], puff: ['#80b8d8', '#c8e8f8'] });
      game.renderer.floatText(t.x, t.y + 2.6, t.z, 'the black water swirls!', '#80c8e0');
      game.audio?.play('splash', c);
    }
    // The tide, rolling across: a row of the floor, then the next (and,
    // desperate, from the other side too).
    c.tideCd = (c.tideCd ?? 4) - dt;
    if (ready(c) && c.tideCd <= 0) {
      c.tideCd = ph >= 3 ? 8 : 7;
      used(c, 0.4);
      const ways = ph >= 3 ? [[0, -1], [-1, 0]] : [[0, -1]];
      for (const [ax, az] of ways) {
        for (let k = -2; k <= 2; k++) {
          const tiles = [];
          for (let s = -6; s <= 6; s++) tiles.push(az ? { x: t.x + s, z: t.z + k } : { x: t.x + k, z: t.z + s });
          addHazard(game, { by: c, tiles, dur: 1.1 + (k + 2) * 0.25 + (ax ? 0.6 : 0), dmg: 2, chill: 2, knock: 1, from: { x: t.x + ax * 3, z: t.z + az * 3 }, kind: 'cold', color: COLORS.cold });
        }
      }
      if (ph >= 3) game.renderer.floatText(c.x, c.y + 3, c.z, 'DROWN!', '#80c8e0');
      game.audio?.play('splash', c);
    }
    c.castCd = (c.castCd ?? 2) - dt;
    if (ready(c) && c.castCd <= 0 && dist(c, t) <= 9 && !c.windup) {
      c.castCd = 2.6;
      used(c);
      const n = ph >= 3 ? 3 : 1;
      for (let k = 0; k < n; k++) game.lobOrb(c, t.x + (k ? Math.round((Math.random() - 0.5) * 3) : 0), t.y, t.z + (k ? Math.round((Math.random() - 0.5) * 3) : 0), Math.round(3 * mult(c)));
      c.doAction?.(0.3);
    }
    // Hangs back, out of reach.
    if (dist(c, t) <= 2 && !c.moving) {
      const sx = Math.sign(c.x - t.x) || 1;
      const sz = Math.sign(c.z - t.z) || 1;
      if (c.tryStep(c.x + sx, c.z, c.S.step) || c.tryStep(c.x, c.z + sz, c.S.step)) return true;
    }
    return dist(c, t) > 1;
  },

  // The Bandit Warlord: a war hammer, a charge shield first, fire pots
  // thrown at you; worn, his war cry, and the holdout's archers called in;
  // desperate, a wall of fire across the hall, and pots in threes.
  warlord(c, dt) {
    const game = c.game;
    const t = c.target;
    const ph = phaseOf(c);
    phaseSummons(c, [0.5], () => {
      for (let i = 0; i < 2; i++) summon(game, 'holdout_archer', c, 5, { level: c.level, color: ['#c8a070', '#8a6a4a'] });
      c.say?.('To me! Shoot them down!', 3, '#ff9070');
    });
    if (c.furyT > 0) {
      c.furyT -= dt;
      if (Math.random() < dt * 8) game.renderer.emit(c.x, c.y + 1.4, c.z, { n: 1, color: ['#ff4030', '#ffb080'], up: 14, life: 0.4, oy: -8 });
    }
    if (!t || t.dead) return false;
    const d = dist(c, t);
    // (Worn) A war cry: his own come on quicker, and he hits harder a while.
    c.cryCd = (c.cryCd ?? 2) - dt;
    if (ph >= 2 && ready(c) && c.cryCd <= 0 && !c.windup) {
      c.cryCd = 16;
      used(c);
      c.furyT = 6;
      for (const o of allies(game, c, 10)) o.hasteT = 6;
      c.say?.('Holdout! With me!', 2, '#ff9070');
      game.renderer.effect?.({ type: 'ring', wx: c.x, wy: c.y, wz: c.z, r0: 3, r1: 50, color: ['#ff6040', '#ffb080'], life: 0.7, oy: 4, flat: 0.5 });
      game.audio?.play('horn', c);
    }
    // (Desperate) A wall of fire across the hall, between him and you.
    c.wallCd = (c.wallCd ?? 3) - dt;
    if (ph >= 3 && ready(c) && c.wallCd <= 0 && d >= 2 && !c.windup) {
      c.wallCd = 12;
      used(c, 0.4);
      const mx = Math.round((c.x + t.x) / 2);
      const mz = Math.round((c.z + t.z) / 2);
      const across = Math.abs(t.x - c.x) >= Math.abs(t.z - c.z);
      const tiles = [];
      for (let k = -5; k <= 5; k++) {
        const q = across ? { x: mx, z: mz + k } : { x: mx + k, z: mz };
        if (withinLeash(c, q.x, q.z)) tiles.push(q);
      }
      addHazard(game, { by: c, tiles, y: c.y, dur: 1.0, dmg: 3, burn: 2, kind: 'fire', center: { x: mx, z: mz }, color: COLORS.fire, onFire: (g) => {
        for (const q of tiles) groundFire(g, q.x, q.z, c.y, c, false, 0);
      } });
      c.say?.('Burn it all!', 1.6, '#ff9070');
      c.doAction?.(0.4);
    }
    // A charge, shield first, down a line.
    c.bashCd = (c.bashCd ?? 6) - dt;
    if (ready(c) && c.bashCd <= 0 && d >= 3 && d <= 6 && (t.x === c.x || t.z === c.z) && !c.windup) {
      c.bashCd = 9;
      used(c);
      beginAttack(game, c, t, { ...STYLES.gore, reach: 6, mult: c.furyT > 0 ? 1.6 : 1.2, windup: 0.9 });
      return true;
    }
    c.potCd = (c.potCd ?? 3) - dt;
    if (ready(c) && c.potCd <= 0 && d >= 2 && d <= 8 && !c.windup) {
      c.potCd = 6;
      used(c);
      for (let k = 0; k < (ph >= 3 ? 3 : 1); k++) {
        const at = k ? { x: t.x + Math.round((Math.random() - 0.5) * 4), z: t.z + Math.round((Math.random() - 0.5) * 4) } : { x: t.x, z: t.z };
        addHazard(game, { by: c, tiles: areaTiles(at.x, at.z, 1), dur: 1.1 + k * 0.2, dmg: 3, burn: 3, kind: 'fire', center: at, color: COLORS.fire });
      }
      c.say?.(Math.random() < 0.5 ? 'Burn!' : 'Catch!', 1.2, '#ffb080');
      c.doAction?.(0.3);
      game.renderer.emit(c.x, c.y + 1.5, c.z, { n: 6, color: ['#ff9030', '#ffe070'], up: 20, life: 0.4 });
    }
    return bossSlam(c, dt, 1, 1.0, 6, 10);
  },

  // ------------------------------------------------ the holdout's
  // A bombarder: hangs back four to nine paces off, lights a stick of
  // dynamite (its fuse sparking in its hand: your warning) and lobs it at
  // you; too close to throw, it drops back a pace, and cornered (or you
  // right on it), out comes a knife.
  bombarder(c, dt) {
    const game = c.game;
    const t = c.target;
    if (!t || t.dead) {
      c.lighting = null;
      return false;
    }
    const d = dist(c, t);
    c.bombCd = (c.bombCd ?? 1.2 + Math.random() * 1.2) - dt;
    if (c.lighting) {
      c.lighting.t -= dt;
      c.face(t.x, t.z);
      if (Math.random() < dt * 25) game.renderer.emit(c.x, c.y + 1.5, c.z, { n: 1, color: ['#ffe070', '#ff9030', '#ffffff'], up: 18, speed: 26, life: 0.3, glow: true, oy: -6 });
      if (c.lighting.t > 0) return true;
      c.lighting = null;
      c.bombCd = 3 + Math.random() * 1.8;
      // (Thrown where you'll be: a pace ahead of you if you're on the move.)
      const ahead = t.moving && t.fx !== undefined ? { x: t.x + Math.sign(t.x - t.fx), z: t.z + Math.sign(t.z - t.fz) } : { x: t.x, z: t.z };
      throwDynamite(game, c, ahead.x, ahead.z);
      c.doAction?.(0.3);
      strikeAnimOf(c);
      return true;
    }
    // Close: the knife (unless it can get away a pace first).
    if (d <= 1 || (d === 2 && !c.moving && !backOff(c, t, 0.85))) {
      c.arms = 'dagger';
      return d <= 1 ? false : !!c.windup;
    }
    c.arms = 'dynamite';
    if (d === 2) return true;
    if (d > 9 || !sees(game, c, t)) return false;
    // (A little more room, if there's any to be had.)
    if (d === 3 && !c.moving && c.bombCd > 0.3 && backOff(c, t, 0.85)) return true;
    if (c.bombCd <= 0 && Math.abs(t.y - c.y) <= 2) {
      c.lighting = { t: 0.75 };
      c.say?.(c.rng.pick(['Fire in the hole!', 'Catch!', 'Light \'em up!', 'Boom time!', 'Duck, if you can!']), 1.2, '#ffb080');
      game.audio?.play('fuse', c);
      return true;
    }
    // Between throws: shifting about out at its distance.
    if (!c.moving && Math.random() < dt * 0.8) {
      const [ox, oz] = [[1, 0], [-1, 0], [0, 1], [0, -1]][Math.floor(Math.random() * 4)];
      if (dist({ x: c.x + ox, z: c.z + oz }, t) >= 4) c.tryStep(c.x + ox, c.z + oz, c.stepTime());
    }
    c.face(t.x, t.z);
    return true;
  },

  // A thief: quick, two blades, and slippery. Face to face in a line (a
  // corridor's best for it) it rolls clean past you, and has your back (so
  // its friends have your front); and a blow it sees coming, it rolls out
  // from under, to one side.
  thief(c, dt) {
    const t = c.target;
    if (!t || t.dead) return false;
    const d = dist(c, t);
    c.rollCd = (c.rollCd ?? 1.5) - dt;
    // (Out from under a blow it sees coming.)
    const coming = windingUp(t) && d <= 2;
    if (coming && c.dodged !== (t.swing || t.windup || t.bowDraw)) {
      c.dodged = t.swing || t.windup || t.bowDraw;
      if (c.rollCd <= 0.8 && Math.random() < 0.55) {
        const hx = Math.sign(c.x - t.x);
        const hz = Math.sign(c.z - t.z);
        const sides = Math.random() < 0.5 ? [[hz, hx], [-hz, -hx]] : [[-hz, -hx], [hz, hx]];
        for (const [sx, sz] of sides) {
          if ((sx || sz) && tumble(c, sx, sz, 2)) {
            c.rollCd = 2.2;
            return true;
          }
        }
      }
    }
    // Past you, to your back: in a line with you, close.
    if (c.rollCd <= 0 && d <= 2 && (t.x === c.x || t.z === c.z) && !c.windup && Math.random() < dt * 1.5) {
      const dx = Math.sign(t.x - c.x);
      const dz = Math.sign(t.z - c.z);
      if (tumble(c, dx, dz, d + 1)) {
        c.rollCd = 4 + Math.random() * 2.5;
        c.say?.(c.rng.pick(['Behind you!', 'Too slow!', 'Over here!', 'Heh.']), 1.2, '#c8c0b8');
        return true;
      }
      c.rollCd = 0.6;
    }
    return false;
  },

  // A coward: keeps three to six paces off, out of reach, shouting now and
  // then for help (one or two of its own near come running); left with
  // nobody of its own close by, it loses its head and comes at you in a
  // frenzy, its little knife going three and four times a go.
  coward(c, dt) {
    const game = c.game;
    const t = c.target;
    if (!t || t.dead) return false;
    const d = dist(c, t);
    if (!c.frenzy) {
      c.lonelyT = banditsNear(game, c, 9).length ? 0 : (c.lonelyT || 0) + dt;
      if (c.lonelyT > 0.6) {
        c.frenzy = true;
        c.say?.(c.rng.pick(['Stay back! STAY BACK!', 'Aaaaaagh!', 'I\'ll gut you myself!', 'No-one? Fine!']), 2, '#ff7060');
        game.renderer.floatText(c.x, c.y + 2.6, c.z, 'frenzied!', '#ff6050');
        game.renderer.effect?.({ type: 'ring', wx: c.x, wy: c.y, wz: c.z, r0: 3, r1: 22, color: ['#ff4030', '#ffb080'], life: 0.5, oy: 4, flat: 0.5 });
        game.audio?.play('roar', c);
      }
    }
    if (c.frenzy) {
      c.hasteT = Math.max(c.hasteT || 0, 0.4);
      if (Math.random() < dt * 6) game.renderer.emit(c.x, c.y + 1.3, c.z, { n: 1, color: ['#ff4030', '#ffb080'], up: 12, life: 0.35, oy: -8 });
      // (Stab, stab, stab.)
      if (d <= 1 && Math.abs(t.y - c.y) <= 1 && !c.windup && (c.attackCd || 0) <= 0) {
        beginAttack(game, c, t, { ...STYLES.dagger, name: 'frenzy', windup: 0.22, recover: 0.55, mult: 0.75, flurry: 2 }, { combo: 1 + Math.floor(Math.random() * 2) });
        return true;
      }
      return false;
    }
    // A shout for help, now and then.
    c.shoutCd = (c.shoutCd ?? 1 + Math.random() * 2) - dt;
    if (c.shoutCd <= 0) {
      c.shoutCd = 7 + Math.random() * 4;
      const near = banditsNear(game, c, 16).filter((o) => o.target !== t && !o.dormant).sort((a, b) => dist(a, c) - dist(b, c)).slice(0, 1 + Math.floor(Math.random() * 2));
      c.say?.(c.rng.pick(['Help! Over here!', 'Lads! LADS!', 'Someone get over here!', 'Intruder! Help!']), 1.8, '#ffd080');
      game.renderer.effect?.({ type: 'ring', wx: c.x, wy: c.y + 1.5, wz: c.z, r0: 2, r1: 34, color: ['#ffd080', '#ffffff'], life: 0.6, oy: -10, flat: 0.8, thick: 1 });
      game.audio?.play('shout', c);
      for (const o of near) {
        o.target = t;
        o.hasteT = Math.max(o.hasteT || 0, 2.5);
        o.say?.(o.rng.pick(['Coming!', 'Where?', 'On my way!']), 1.2, '#ffd080');
      }
      c.doAction?.(0.4);
      return true;
    }
    // Out of reach, but not out of sight.
    if (d < 3) {
      if (backOff(c, t)) return true;
      return false;
    }
    if (d > 6) return false;
    c.face(t.x, t.z);
    return true;
  },

  // ------------------------------------------------ the Kavorent's
  // A drone: off at a distance, and a beam down a line at you (the line
  // lit first). Two near each other join theirs into a wall of light.
  drone(c, dt) {
    const game = c.game;
    const t = c.target;
    // (One of the Overseer's sentinels, holding up its shield.)
    if (c.sentinel && sentinelTick(c, dt)) return true;
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
  // after: its core shows), a charge down a line. A Prime (a foundry's
  // master) in its phases: whole, the slam and the charge; worn, a beam
  // from its core and mites called up; desperate, an overload: beams
  // thrown out four ways from it, turned an eighth, and again.
  golem(c, dt) {
    const game = c.game;
    const t = c.target;
    if (c.exposedT > 0) {
      c.exposedT -= dt;
      if (Math.random() < dt * 10) game.renderer.emit(c.x, c.y + 1.4, c.z, { n: 1, color: ['#5ad8f0', '#ffffff'], up: 10, speed: 10, life: 0.4, glow: true, oy: -10 });
    }
    const prime = c.species === 'prime';
    const gate = (k) => !prime || !c.isBoss || ready(c) || k;
    const ph = prime ? phaseOf(c) : 1;
    if (prime) {
      phaseSummons(c, [0.6, 0.3], () => {
        for (let i = 0; i < 3; i++) summon(game, 'mite', c, 3, { level: c.level, color: ['#fff8a0', '#5ad8f0'] });
      });
      // (Worn) A beam from its core, down a line at you.
      c.beamCd = (c.beamCd ?? 2) - dt;
      if (t && ph >= 2 && gate() && c.beamCd <= 0 && dist(c, t) >= 2 && dist(c, t) <= 10 && sees(game, c, t) && !c.windup) {
        c.beamCd = 6;
        if (c.isBoss) used(c);
        const tiles = lineTiles(game, c, t, 11).slice(c.foot || 0);
        addHazard(game, { by: c, tiles, dur: 1.1, dmg: Math.round(5 * (c.dmgMult || 1)), kind: 'beam', from: { x: c.x, z: c.z }, to: tiles[tiles.length - 1] || t, color: COLORS.blow, width: 4 });
        c.stunT = 1.2;
        return true;
      }
      // (Desperate) Overload: beams out four ways, then the four between.
      c.overCd = (c.overCd ?? 3) - dt;
      if (t && ph >= 3 && gate() && c.overCd <= 0 && !c.windup) {
        c.overCd = 10;
        if (c.isBoss) used(c, 1);
        const r0 = (c.foot || 0) + 1;
        for (const [k, set] of [[0, [[1, 0], [-1, 0], [0, 1], [0, -1]]], [1, [[1, 1], [1, -1], [-1, 1], [-1, -1]]]]) {
          for (const [dx, dz] of set) {
            const to = { x: c.x + dx * 12, z: c.z + dz * 12 };
            const tiles = lineTiles(game, c, to, 12).filter((q) => Math.max(Math.abs(q.x - c.x), Math.abs(q.z - c.z)) >= r0);
            if (tiles.length) addHazard(game, { by: c, tiles, dur: 1.2 + k * 0.9, dmg: Math.round(5 * (c.dmgMult || 1)), kind: 'beam', from: { x: c.x, z: c.z }, to: tiles[tiles.length - 1], color: COLORS.kav, beamColor: '#e0fbff', halo: '#5ad8f0', width: 3 });
          }
        }
        game.renderer.floatText(c.x, c.y + 3.4, c.z, 'OVERLOAD', '#5ad8f0');
        game.renderer.effect?.({ type: 'ring', wx: c.x, wy: c.y, wz: c.z, r0: 4, r1: 40, color: ['#5ad8f0', '#ffffff'], life: 0.6, oy: 4, flat: 0.5, thick: 2 });
        game.audio?.play('charge', c);
        c.stunT = 2.2;
        return true;
      }
    }
    c.chargeCd = (c.chargeCd ?? 5) - dt;
    if (t && gate() && c.chargeCd <= 0 && dist(c, t) >= 3 + (c.foot || 0) && dist(c, t) <= 6 + (c.foot || 0) && (Math.abs(t.x - c.x) <= (c.foot || 0) || Math.abs(t.z - c.z) <= (c.foot || 0)) && !c.windup) {
      c.chargeCd = 8;
      if (prime && c.isBoss) used(c);
      beginAttack(game, c, t, { ...STYLES.gore, reach: 6, mult: 1.2, windup: 1.0 });
      return true;
    }
    return bossSlam(c, dt, 1, 1.2, prime ? 8 : 6, 6, () => {
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

  // The Overseer: its shield (turning arrows, bolts and blades alike) is
  // thrown up round it by its sentinels, three drones called down at once
  // to hold it (see SENTINELS below): kill all three and it's down a good
  // while before it can call more. Its sweeping beam, and its great works
  // one after another (see OVERSEER below): whole, walls of force thrown up
  // round you and a ring of spikes shot out, drawn up and swung round it;
  // worn, a rush across the hall that ends in a slam, the grid of the floor
  // lit and fired, its beams fanned in threes, menders called; desperate,
  // the great beam, and arc mites.
  overseer(c, dt) {
    const game = c.game;
    const t = c.target;
    const ph = phaseOf(c);
    c.shieldUp = shielded(c);
    if (c.act) {
      overseerAct(c, dt);
      return true;
    }
    if (!t || t.dead) return true;
    // Its sentinels called down (three at once; never more), when none are
    // left and its shield's had time to come back.
    c.sentCd = (c.sentCd ?? 0) - dt;
    if (!c.shieldUp && !(c.shieldDownT > 0) && c.sentCd <= 0 && ready(c)) {
      c.sentCd = 4;
      if (callSentinels(c)) {
        used(c, 0.6);
        return true;
      }
    }
    // (Worn) Its menders, and (desperate) its arc mites, called in.
    c.callCd = (c.callCd ?? 6) - dt;
    if (ph >= 2 && c.callCd <= 0 && ready(c)) {
      c.callCd = ph >= 3 ? 11 : 16;
      const menders = game.creatures.filter((o) => !o.dead && o.species === 'mender' && o.leash === c.leash).length;
      if (ph >= 3) for (let i = 0; i < 2; i++) summon(game, 'mite', c, 5, { level: c.level });
      else if (menders < 2) summon(game, 'mender', c, 5, { level: c.level });
      for (const o of game.creatures) if (!o.dead && !o.leash && (o.species === 'mite' || o.species === 'mender') && dist(o, c) <= 6) o.leash = c.leash;
    }
    // Its great works, in turn (each phase bringing out more of them).
    c.workCd = (c.workCd ?? 3.5) - dt;
    if (c.workCd <= 0 && !c.windup && ready(c)) {
      const open = WORKS.filter((k) => WORK_PHASE[k] <= ph);
      let i = c.workI ?? Math.floor(Math.random() * WORKS.length);
      let k = null;
      for (let n = 0; n < WORKS.length && !k; n++) {
        i = (i + 1) % WORKS.length;
        if (open.includes(WORKS[i])) k = WORKS[i];
      }
      c.workI = i;
      if (k === 'rush' && (dist(c, t) < 3 + (c.foot || 0) || dist(c, t) > 11)) k = 'spikes';
      const ok = OVERSEER[k](c);
      c.workCd = ok ? (ph >= 3 ? 4 : ph >= 2 ? 5 : 6.5) : 1;
      if (ok) {
        used(c, 0.5);
        return true;
      }
    }
    c.beamCd = (c.beamCd ?? 3) - dt;
    if (c.beamCd <= 0 && sees(game, c, t) && ready(c)) {
      c.beamCd = ph >= 3 ? 3.4 : 4.8;
      used(c);
      // Beams at you (fanned in threes, once it's worn).
      const ang = Math.atan2(t.z - c.z, t.x - c.x);
      for (const s of ph >= 2 ? [-0.35, 0, 0.35] : [0]) {
        const to = { x: c.x + Math.cos(ang + s) * 12, z: c.z + Math.sin(ang + s) * 12 };
        const tiles = lineTiles(game, c, to, 12).slice(c.foot || 0);
        if (tiles.length) addHazard(game, { by: c, tiles, dur: 1.0, dmg: 5, kind: 'beam', from: { x: c.x, z: c.z }, to: tiles[tiles.length - 1] || to, color: COLORS.blow, width: 4 });
      }
      game.audio?.play('charge', c);
      return true;
    }
    // (Worn) The grid: every other row of the hall, then the rows between.
    c.gridCd = (c.gridCd ?? 4) - dt;
    if (ph >= 2 && c.gridCd <= 0 && ready(c)) {
      c.gridCd = 14;
      used(c, 0.8);
      for (let k = -8; k <= 8; k++) {
        const tiles = [];
        for (let dx = -10; dx <= 10; dx++) if (withinLeash(c, c.x + dx, c.z + k)) tiles.push({ x: c.x + dx, z: c.z + k });
        if (tiles.length) addHazard(game, { by: c, tiles, dur: 1.4 + (Math.abs(k) % 2) * 1.2, dmg: 4, kind: 'beam', from: tiles[0], to: tiles[tiles.length - 1], color: COLORS.kav, beamColor: '#e0fbff', halo: '#5ad8f0', width: 2 });
      }
      game.renderer.floatText(c.x, c.y + 3, c.z, 'GRID ALIGNING', '#5ad8f0');
      return true;
    }
    // Drifts to keep its distance.
    if (!c.moving && dist(c, t) <= 3 + (c.foot || 0)) {
      const sx = Math.sign(c.x - t.x) || 1;
      const sz = Math.sign(c.z - t.z) || 1;
      c.tryStep(c.x + sx, c.z, c.S.step) || c.tryStep(c.x, c.z + sz, c.S.step);
    }
    return true;
  },
};

// ------------------------------------------------------------ its sentinels
// Three drones called down out of the dark at once, each to a post round
// the Overseer, and each throwing a thread of light onto it: together they
// hold up its shield, a dome of light that turns arrows, bolts and blades
// alike. Kill all three and the shield breaks, and stays down a
// good while (SHIELD_DOWN) before it can call more.
export const SENTINELS = 3;
export const SHIELD_DOWN = 14;

// Shielded: one of its sentinels still holding it up.
export function shielded(c) {
  return !!(c && !c.dead && c.sentinels && c.sentinels.some((s) => !s.dead && s.sentinel === c));
}

function callSentinels(c) {
  const game = c.game;
  const r = game.renderer;
  const posts = [];
  const a0 = Math.random() * Math.PI * 2;
  for (let i = 0; i < SENTINELS; i++) {
    const want = a0 + (i / SENTINELS) * Math.PI * 2;
    let spot = null;
    for (let k = 0; k < 10 && !spot; k++) {
      const a = want + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 0.25;
      for (const rad of [4.5, 3.5, 5.5]) {
        const x = Math.round(c.x + Math.cos(a) * rad);
        const z = Math.round(c.z + Math.sin(a) * rad);
        if (!withinLeash(c, x, z)) continue;
        const y = game.world.findStandY(x, z, c.y);
        if (y !== c.y || !game.world.canStand(x, y, z) || game.occupiedAny(x, y, z) || posts.some((q) => q.x === x && q.z === z)) continue;
        spot = { x, y, z, a };
        break;
      }
    }
    if (spot) posts.push(spot);
  }
  if (!posts.length) return false;
  c.sentinels = [];
  for (const q of posts) {
    const s = game.spawnMonster('drone', q.x, q.y, q.z, { level: c.level });
    if (!s) continue;
    s.sentinel = c;
    s.postA = q.a;
    s.leash = c.leash;
    s.target = c.target;
    s.beamCd = 2 + Math.random() * 2;
    c.sentinels.push(s);
    r.effect?.({ type: 'beam', wx: c.x, wy: c.y + 2, wz: c.z, tx: q.x, ty: q.y + 1, tz: q.z, life: 0.5, oy: -8, color: '#e0fbff', halo: '#5ad8f0', width: 2 });
    r.effect?.({ type: 'ring', wx: q.x, wy: q.y, wz: q.z, r0: 2, r1: 22, color: ['#5ad8f0', '#ffffff'], life: 0.5, oy: 4, flat: 0.5, thick: 2 });
    r.emit(q.x, q.y + 1.2, q.z, { n: 14, color: ['#5ad8f0', '#c8fbff', '#ffffff'], up: 30, speed: 40, life: 0.6, glow: true });
  }
  if (!c.sentinels.length) return false;
  c.shieldUpT = 0;
  c.shieldUp = true;
  r.floatText(c.x, c.y + 3.6, c.z, 'SENTINELS DEPLOYED', '#5ad8f0');
  if (game.dungeon && game.dungeon.fight) game.ui.msg('Three sentinels take up their posts: the Overseer\'s shield is up (nothing gets through it: bring them down).', '#5ad8f0', true);
  game.audio?.play('charge', c);
  game.audio?.play('hum', c);
  c.stunT = 0.8;
  return true;
}

// A sentinel's gone: the last of them, and the shield breaks.
export function sentinelDown(game, s) {
  const c = s.sentinel;
  s.sentinel = null;
  if (!c || c.dead || shielded(c)) return;
  const r = game.renderer;
  c.shieldDownT = SHIELD_DOWN;
  c.sentCd = 2;
  c.shieldUp = false;
  c.shieldBreakT = 0;
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2;
    r.emit(c.x + Math.cos(a) * 1.8, c.y + 1.2 + Math.random() * 1.6, c.z + Math.sin(a) * 1.8, { n: 1, color: ['#5ad8f0', '#c8fbff', '#ffffff'], up: 30, speed: 70, gravity: 90, life: 0.8, glow: true, shape: 'shard' });
  }
  r.effect?.({ type: 'ring', wx: c.x, wy: c.y + 1, wz: c.z, r0: 18, r1: 70, color: ['#c8fbff', '#5ad8f0'], life: 0.6, oy: -16, flat: 0.7, thick: 3 });
  r.floatText(c.x, c.y + 3.6, c.z, 'SHIELD DOWN', '#ffe070');
  game.ui.msg('The last sentinel falls: the Overseer\'s shield shatters! (It can\'t call more for a while.)', '#ffe070', true);
  game.audio?.play('shatter', c);
  game.audio?.play('boom', c);
  game.shake = Math.min(1.4, (game.shake || 0) + 0.6);
  c.stunT = Math.max(c.stunT || 0, 1.2);
}

// A sentinel at its post: its post turning slowly round the Overseer, a
// thread of light from it to the shield (see fx.drawShields), and its
// beam at you between times.
function sentinelTick(c, dt) {
  const game = c.game;
  const m = c.sentinel;
  if (!m || m.dead) {
    c.sentinel = null;
    return false;
  }
  c.postA = (c.postA || 0) + dt * 0.18;
  const t = c.target;
  if (Math.random() < dt * 6) game.renderer.emit(c.x, c.y + 1.4, c.z, { n: 1, color: ['#5ad8f0', '#ffffff'], up: 6, speed: 10, life: 0.4, glow: true });
  c.beamCd = (c.beamCd ?? 3) - dt;
  if (t && !t.dead && c.beamCd <= 0 && dist(c, t) >= 2 && dist(c, t) <= 9 && sees(game, c, t) && !c.windup) {
    c.beamCd = 4.5 + Math.random() * 1.5;
    c.face(t.x, t.z);
    const tiles = lineTiles(game, c, t, 9);
    addHazard(game, { by: c, tiles, dur: 1.0, dmg: Math.round(3 * (c.dmgMult || 1)), kind: 'beam', from: { x: c.x, z: c.z }, to: tiles[tiles.length - 1] || t, color: COLORS.blow });
    c.stunT = 1.05;
    game.audio?.play('charge', c);
    return true;
  }
  if (c.moving) return true;
  const px = Math.round(m.x + Math.cos(c.postA) * 4.5);
  const pz = Math.round(m.z + Math.sin(c.postA) * 4.5);
  if (Math.max(Math.abs(px - c.x), Math.abs(pz - c.z)) >= 2) {
    const sx = Math.sign(px - c.x);
    const sz = Math.sign(pz - c.z);
    if (!(sx && c.tryStep(c.x + sx, c.z, c.S.step * 1.2)) && !(sz && c.tryStep(c.x, c.z + sz, c.S.step * 1.2))) c.postA += 0.4;
  }
  return true;
}

// ------------------------------------------------------------ the Overseer's works
const WORKS = ['fields', 'rush', 'spikes', 'laser'];
// The phase each comes out in (see tempo.js).
const WORK_PHASE = { fields: 1, spikes: 1, rush: 2, laser: 3 };
const mult = (c) => c.dmgMult || 1;
const OVERSEER = {
  // Walls of force thrown up round you (two, three as it weakens), their
  // lines flickering on the floor a moment first: they cut the hall up,
  // and stand nine seconds. (Nobody's walled inside one: where someone
  // stands is left open.)
  fields(c) {
    const game = c.game;
    const t = c.target;
    const w = game.world;
    const r = game.renderer;
    const n = c.hp / c.maxHp < 0.5 ? 3 : 2;
    const walls = [];
    for (let k = 0; k < n; k++) {
      for (let tries = 0; tries < 14; tries++) {
        const a = Math.random() * Math.PI * 2;
        const r0 = 2 + Math.random() * 2.5;
        const cx = Math.round(t.x + Math.cos(a) * r0);
        const cz = Math.round(t.z + Math.sin(a) * r0);
        const alongX = Math.random() < 0.5;
        const tiles = [];
        for (let s = -3; s <= 3; s++) {
          const x = cx + (alongX ? s : 0);
          const z = cz + (alongX ? 0 : s);
          if (!withinLeash(c, x, z) || w.getBlock(x, c.y, z) !== BLOCKS_ID.air || w.getBlock(x, c.y + 1, z) !== BLOCKS_ID.air) continue;
          if (!BLOCKS[w.getBlock(x, c.y - 1, z)].solid) continue;
          tiles.push({ x, z });
        }
        if (tiles.length >= 4) {
          walls.push(tiles);
          break;
        }
      }
    }
    if (!walls.length) return false;
    for (const tiles of walls) {
      const mid = tiles[Math.floor(tiles.length / 2)];
      addHazard(game, { by: c, tiles, dur: 0.9, dmg: 0, kind: 'field', color: COLORS.kav, onFire: () => raiseWall(game, c, tiles) });
      r.effect?.({ type: 'beam', wx: c.x, wy: c.y + 1.6, wz: c.z, tx: mid.x, ty: c.y + 0.4, tz: mid.z, life: 0.9, oy: -8, color: '#c8fbff', halo: '#5ad8f0', width: 1 });
    }
    c.act = { kind: 'fields', t: 1.1 };
    r.floatText(c.x, c.y + 3.4, c.z, 'PROJECTING', '#5ad8f0');
    game.audio?.play('charge', c);
    return true;
  },

  // A rush: its lane lit across the hall to you (and on past), a moment's
  // gathering, then it hurls itself down it, flinging aside whoever's in
  // the way, and slams down where it stops. (It's open to a blow a while
  // after.)
  rush(c) {
    const game = c.game;
    const t = c.target;
    const d = dist(c, t);
    if (d < 3 || d > 10 || !sees(game, c, t)) return false;
    const reach = Math.min(12, Math.ceil(d * 1.3) + 1);
    const to = { x: c.x + ((t.x - c.x) / Math.max(1, d)) * reach, z: c.z + ((t.z - c.z) / Math.max(1, d)) * reach };
    // (As far down it as all of it fits: it stops short of a wall.)
    const path = [];
    // (Its own fields, and the ruin's, it turns off as it comes: see
    // fields.js.)
    const soft = fieldWay(game);
    for (const q of lineTiles(game, c, to, reach)) {
      if (!withinLeash(c, q.x, q.z) || !fits(game, c, q.x, c.y, q.z, true, soft)) break;
      path.push(q);
    }
    if (path.length < 2) return false;
    // (Its lane as wide as it is.)
    const lane = [];
    const seen = new Set();
    for (const q of path) for (const f of footTiles(c, q.x, q.z)) if (!seen.has(f.x * 65536 + f.z)) {
      seen.add(f.x * 65536 + f.z);
      lane.push(f);
    }
    addHazard(game, { by: c, tiles: lane, dur: 0.95, dmg: 0, kind: 'lane', color: COLORS.blow });
    c.act = { kind: 'rush', t: 0, path, i: 0, step: 0, hit: new Set() };
    c.face(t.x, t.z);
    game.renderer.floatText(c.x, c.y + 3.4, c.z, 'CHARGING', '#ff6040');
    game.audio?.play('charge', c);
    return true;
  },

  // Spikes shot out all round it into the floor; a moment, then they're
  // drawn up again by its pull (crackling), swung round it in a great
  // ring, and called home.
  spikes(c) {
    const game = c.game;
    const n = c.hp / c.maxHp < 0.5 ? 12 : 8;
    const list = [];
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * Math.PI * 2 + Math.random() * 0.3;
      const reach = 4 + Math.random() * 2.5;
      const tiles = lineTiles(game, c, { x: c.x + Math.cos(ang) * reach, z: c.z + Math.sin(ang) * reach }, Math.ceil(reach));
      const land = tiles[tiles.length - 1] || { x: c.x, z: c.z };
      list.push({ by: c, x: c.x, z: c.z, h: 1.4, sx: c.x, sz: c.z, tx: land.x, tz: land.z, ang, state: 'fly', orbit: 0, hitAt: new Map() });
      addHazard(game, { by: c, tiles: [land], dur: 0.35, dmg: Math.round(3 * mult(c)), kind: 'spike', color: COLORS.kav });
    }
    (game.kavSpikes ||= []).push(...list);
    c.act = { kind: 'spikes', t: 0, list };
    game.audio?.play('shatter', c);
    game.renderer.emit(c.x, c.y + 1.4, c.z, { n: 20, color: ['#5ad8f0', '#ffffff'], up: 20, speed: 70, life: 0.4, glow: true });
    return true;
  },

  // The great beam: gathered a moment, then poured out to one side of you
  // and turned slowly onto you, setting the floor alight where it passes.
  laser(c) {
    const game = c.game;
    const t = c.target;
    if (!sees(game, c, t)) return false;
    const base = Math.atan2(t.z - c.z, t.x - c.x);
    const side = Math.random() < 0.5 ? -1 : 1;
    startLaser(game, {
      by: c, ang: base + side * 0.75, turn: 0.38, len: 16, charge: 1.4, dur: 5.5, dmg: Math.round(4 * mult(c)), tick: 0.3, width: 1, foes: 'player', fire: true,
      aim: () => (c.target && !c.target.dead ? Math.atan2(c.target.z - c.z, c.target.x - c.x) : null),
    });
    c.act = { kind: 'laser', t: 0, dur: 1.4 + 5.5 };
    game.renderer.floatText(c.x, c.y + 3.4, c.z, 'FOCUSING', '#ff5040');
    return true;
  },
};

// A wall of force up out of the floor along `tiles` (where nobody stands).
function raiseWall(game, c, tiles) {
  if (c.dead) return;
  const w = game.world;
  const r = game.renderer;
  const put = [];
  for (const q of tiles) {
    if (game.entityAt?.(q.x, c.y, q.z) || (game.player.x === q.x && game.player.z === q.z)) continue;
    for (const y of [c.y, c.y + 1]) {
      if (w.getBlock(q.x, y, q.z) !== BLOCKS_ID.air) continue;
      w.setBlock(q.x, y, q.z, BLOCKS_ID.kav_field);
      put.push({ x: q.x, y, z: q.z });
    }
    r.emit(q.x, c.y + 0.2, q.z, { n: 6, color: ['#5ad8f0', '#c8fbff', '#ffffff'], up: 50, speed: 14, life: 0.6, glow: true });
  }
  if (!put.length) return;
  (game.bulwarks ||= []).push({ t: 9, life: 9, put });
  const mid = tiles[Math.floor(tiles.length / 2)];
  r.effect?.({ type: 'ring', wx: mid.x, wy: c.y, wz: mid.z, r0: 4, r1: 46, color: ['#5ad8f0', '#ffffff'], life: 0.5, oy: 2, flat: 0.5, thick: 2 });
  game.lightDirty = true;
  game.audio?.play('hum', mid);
  game.audio?.play('clank', mid);
  game.shake = Math.max(game.shake || 0, 0.35);
}

// One of its works under way.
function overseerAct(c, dt) {
  const game = c.game;
  const r = game.renderer;
  const a = c.act;
  a.t += dt;
  if (a.kind === 'fields') {
    if (a.t >= 1.1) c.act = null;
  } else if (a.kind === 'laser') {
    if (a.t >= a.dur) c.act = null;
  } else if (a.kind === 'rush') {
    if (a.t < 0.95) {
      if (Math.random() < dt * 30) r.emit(c.x, c.y + 1.6, c.z, { n: 1, color: ['#ff6040', '#ffd0b0', '#5ad8f0'], up: 10, speed: 30, life: 0.3, glow: true });
      return;
    }
    a.step -= dt;
    while (a.step <= 0 && a.i < a.path.length) {
      a.step += 0.045;
      const q = a.path[a.i++];
      // Whoever's under it there, struck and flung aside (off the lane).
      const hx = Math.sign(q.x - c.x);
      for (const e of [game.player, ...game.npcs, ...game.creatures]) {
        if (!e || e === c || e.dead || a.hit.has(e) || Math.max(Math.abs(e.x - q.x), Math.abs(e.z - q.z)) > (c.foot || 0) || Math.abs(e.y - c.y) > 1) continue;
        if (e.kind !== 'player' && e.kind !== 'npc' && !e.sentinel && e.S?.construct) continue;
        a.hit.add(e);
        if (e.kind === 'player' && e.rollT > 0) continue;
        if (e.kind === 'player' || e.kind === 'npc') game.damage(e, Math.round(6 * mult(c)), c);
        // (Sideways: which side of its line they stand.)
        const side = hx ? Math.sign(e.z - q.z) || (Math.random() < 0.5 ? 1 : -1) : Math.sign(e.x - q.x) || (Math.random() < 0.5 ? 1 : -1);
        knock(game, hx ? { x: e.x, z: e.z - side } : { x: e.x - side, z: e.z }, e, 2);
      }
      // (Someone it couldn't fling clear, or a wall: there it stops. A
      // field it turns off.)
      lowerFields(c, q.x, q.z);
      if (!fits(game, c, q.x, c.y, q.z) || game.occupiedBySolid(q.x, c.y, q.z, c)) {
        a.i = a.path.length;
        break;
      }
      r.emit(c.x, c.y + 1.4, c.z, { n: 3, color: ['#5ad8f0', '#c8fbff', '#ff6040'], up: 4, speed: 8, life: 0.35, glow: true });
      c.teleport(q.x, c.y, q.z);
    }
    if (a.i >= a.path.length) {
      // The slam where it stops.
      addHazard(game, { by: c, tiles: areaTiles(c.x, c.z, 2, true), dur: 0.05, dmg: Math.round(7 * mult(c)), knock: 3, stun: 0.4, from: { x: c.x, z: c.z }, center: { x: c.x, z: c.z }, radius: 2, kind: 'slam', color: COLORS.blow });
      r.effect?.({ type: 'ring', wx: c.x, wy: c.y, wz: c.z, r0: 6, r1: 70, color: ['#5ad8f0', '#ffffff'], life: 0.55, oy: 4, flat: 0.5, thick: 3 });
      r.effect?.({ type: 'ring', wx: c.x, wy: c.y, wz: c.z, r0: 2, r1: 40, color: ['#ff6040', '#ffd0b0'], life: 0.4, oy: 4, flat: 0.5, thick: 2 });
      r.emit(c.x, c.y + 0.3, c.z, { n: 30, color: ['#a89878', '#5ad8f0', '#ffffff'], up: 40, speed: 90, life: 0.6, glow: true });
      game.shake = Math.min(1.6, (game.shake || 0) + 1);
      c.act = null;
      c.stunT = 1.3;
      r.floatText(c.x, c.y + 3.4, c.z, 'open!', '#5ad8f0');
    }
  } else if (a.kind === 'spikes') {
    for (const s of a.list) {
      if (a.t < 0.35) {
        const k = a.t / 0.35;
        s.x = s.sx + (s.tx - s.sx) * k;
        s.z = s.sz + (s.tz - s.sz) * k;
        s.h = 1.4 * (1 - k) + Math.sin(k * Math.PI) * 0.8;
      } else if (a.t < 1.7) {
        if (s.state === 'fly') {
          s.state = 'stuck';
          s.x = s.tx;
          s.z = s.tz;
          s.h = 0.15;
          r.emit(s.x, c.y + 0.2, s.z, { n: 6, color: ['#c8fbff', '#8a8478'], up: 20, speed: 30, life: 0.4 });
        }
        if (a.t > 1.1) s.state = 'charged';
      } else if (a.t < 5.7) {
        if (s.state !== 'orbit') {
          s.state = 'orbit';
          s.orbit = Math.atan2(s.z - c.z, s.x - c.x);
          s.fx = s.x;
          s.fz = s.z;
        }
        const k = Math.min(1, (a.t - 1.7) / 0.5);
        s.orbit += dt * (1 + 1.6 * k);
        const ox = c.x + Math.cos(s.orbit) * 3.3;
        const oz = c.z + Math.sin(s.orbit) * 3.3;
        s.x = s.fx + (ox - s.fx) * k;
        s.z = s.fz + (oz - s.fz) * k;
        s.fx = s.x;
        s.fz = s.z;
        s.h = 0.15 + 0.9 * k;
        const tx = Math.round(s.x);
        const tz = Math.round(s.z);
        for (const e of [game.player, ...game.npcs]) {
          if (!e || e.dead || e.x !== tx || e.z !== tz || (s.hitAt.get(e) ?? -1) > a.t) continue;
          s.hitAt.set(e, a.t + 0.7);
          if (e.kind === 'player' && e.rollT > 0) continue;
          game.damage(e, Math.round(3 * mult(c)), c);
          knock(game, c, e, 1);
          r.emit(e.x, e.y + 1, e.z, { n: 6, color: ['#c8fbff', '#ffffff'], up: 20, speed: 40, life: 0.3, glow: true });
        }
      } else {
        s.state = 'return';
        const k = Math.min(1, (a.t - 5.7) / 0.4);
        s.x += (c.x - s.x) * k;
        s.z += (c.z - s.z) * k;
        s.h += (1.4 - s.h) * k;
      }
    }
    if (a.t > 1.1 && a.t < 1.15) game.audio?.play('charge', c);
    if (a.t >= 6.1) {
      for (const s of a.list) s.gone = true;
      r.emit(c.x, c.y + 1.4, c.z, { n: 20, color: ['#5ad8f0', '#ffffff'], up: 20, speed: 50, life: 0.4, glow: true });
      game.audio?.play('clank', c);
      c.act = null;
    }
  }
}

// --------------------------------------------------------------- the blight
// Kavorent constructs the blight's got into (see dungeongen.js, blightRoom),
// each kind changed its own way:
//   a drone blinks through the dark to your side;
//   a warden or a golem lashes a tendril at you and drags you in;
//   a mender feeds the blight in its kin round it, and in itself;
//   a mite's burst leaves spores hanging in the air.
// All of them burst into a cloud of spores when they die (see
// DungeonRun.onKill), shed violet motes, and show a faint violet edge (see
// the renderer). Returns true if it's taken its turn.
const VOID_MOTES = ['#b070e0', '#e090ff', '#7a3aa0'];
export function blightTick(c, dt) {
  const game = c.game;
  const t = c.target;
  const r = game.renderer;
  if (Math.random() < dt * 2.5) r.emit(c.x + (Math.random() - 0.5) * 0.6, c.y + 0.4 + Math.random() * 1.2, c.z, { n: 1, color: VOID_MOTES, up: 6, speed: 4, gravity: -6, life: 1.1, glow: true });
  if (c.windup || c.stunT > 0 || !t || t.dead) return false;
  const d = dist(c, t);
  c.blightCd = (c.blightCd ?? 2 + Math.random() * 2) - dt;
  if (c.blightCd > 0) return false;
  switch (c.species) {
    case 'drone': {
      if (d < 3 || d > 9 || !sees(game, c, t)) return false;
      const spots = [];
      for (let dz = -2; dz <= 2; dz++) {
        for (let dx = -2; dx <= 2; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== 2) continue;
          const x = t.x + dx;
          const z = t.z + dz;
          if (!withinLeash(c, x, z) || !game.world.canStand(x, t.y, z) || game.occupiedBySolid(x, t.y, z, c) || game.entityAt?.(x, t.y, z)) continue;
          spots.push({ x, z });
        }
      }
      if (!spots.length) return false;
      const s = spots[Math.floor(Math.random() * spots.length)];
      c.blightCd = 6 + Math.random() * 2;
      r.emit(c.x, c.y + 1, c.z, { n: 14, color: VOID_MOTES, up: 20, speed: 40, life: 0.5, glow: true });
      r.effect?.({ type: 'ring', wx: c.x, wy: c.y, wz: c.z, r0: 2, r1: 16, color: ['#c070ff', '#ffffff'], life: 0.35, oy: 2, flat: 0.5, thick: 1 });
      c.teleport(s.x, t.y, s.z);
      game.moveEntity(c, s.x, t.y, s.z);
      r.emit(s.x, t.y + 1, s.z, { n: 14, color: VOID_MOTES, up: 20, speed: 40, life: 0.5, glow: true });
      r.effect?.({ type: 'ring', wx: s.x, wy: t.y, wz: s.z, r0: 16, r1: 2, color: ['#c070ff', '#ffffff'], life: 0.35, oy: 2, flat: 0.5, thick: 1 });
      game.audio?.play('void', c);
      c.face(t.x, t.z);
      c.stunT = 0.55;
      return true;
    }
    case 'warden':
    case 'golem': {
      if (d < 2 || d > 5 || !sees(game, c, t)) return false;
      c.blightCd = 6.5;
      const tiles = lineTiles(game, c, t, 6);
      const end = tiles[tiles.length - 1] || t;
      addHazard(game, {
        by: c, tiles, dur: 0.8, dmg: Math.round(2 * (c.dmgMult || 1)), kind: 'hex', quiet: true, color: COLORS.void, from: { x: c.x, z: c.z }, to: end,
        onFire: (g, h, hit) => {
          if (c.dead) return;
          r.effect?.({ type: 'beam', wx: c.x, wy: c.y + 0.9, wz: c.z, tx: end.x, ty: c.y + 0.6, tz: end.z, life: 0.4, oy: -8, color: '#e8b0ff', halo: '#8a3ac0', width: 2 });
          for (const e of hit) {
            if (e.kind !== 'player' && e.kind !== 'npc') continue;
            // (Dragged in along it.)
            knock(game, { x: 2 * e.x - c.x, z: 2 * e.z - c.z }, e, Math.max(1, dist(c, e) - 1));
            e.slowT = Math.max(e.slowT || 0, 1.2);
            r.floatText(e.x, e.y + 2.4, e.z, 'dragged in!', '#e090ff');
          }
        },
      });
      c.stunT = 0.9;
      c.face(t.x, t.z);
      game.audio?.play('void', c);
      return true;
    }
    case 'mender': {
      c.blightCd = 3.5;
      const kin = allies(game, c, 5, (o) => o.infected && o.hp < o.maxHp);
      if (c.hp < c.maxHp) kin.push(c);
      if (!kin.length) return false;
      for (const o of kin) {
        o.hp = Math.min(o.maxHp, o.hp + 3);
        if (o !== c) r.effect?.({ type: 'siphon', wx: c.x, wy: c.y + 0.5, wz: c.z, tx: o.x, ty: o.y + 1, tz: o.z, life: 0.5, oy: -4, n: 8, amp: 2, color: ['#c070ff', '#e8b0ff', '#ffffff'] });
        r.emit(o.x, o.y + 1, o.z, { n: 4, color: VOID_MOTES, up: 14, speed: 20, life: 0.5, glow: true });
      }
      r.effect?.({ type: 'ring', wx: c.x, wy: c.y, wz: c.z, r0: 4, r1: 40, color: ['#c070ff', '#e8b0ff'], life: 0.6, oy: 2, flat: 0.5, thick: 1 });
      game.audio?.play('void', c);
      return false;
    }
    default:
      return false;
  }
}

// --------------------------------------------------------------- walls in its way
// A master of an old place doesn't let what you've built stop it: blocks
// you've set down (see DungeonRun.placed) in its way toward you, or round
// it once it's been stuck a moment, it smashes through. Returns true if
// it's taken its turn doing it.
export function bossBreach(c, dt) {
  const game = c.game;
  const run = game.dungeon;
  if (!run || !run.placed || !run.placed.size) return false;
  const t = c.target;
  // (Stuck: it's got no nearer you a while, however it's shuffled about.
  // Its clock runs on game minutes, since it isn't asked while it moves.)
  const now = game.day * 1440 + game.minute;
  const d0 = t ? dist(c, t) : 0;
  if (t !== c.breachFor || d0 < (c.breachBest ?? Infinity)) {
    c.breachFor = t;
    c.breachBest = d0;
    c.breachSince = now;
  }
  c.stuckT = (now - (c.breachSince ?? now)) / GAME_MINUTES_PER_SECOND;
  c.breachT = (c.breachT ?? 0.4) - dt;
  if (c.breachT > 0 || !t || t.dead || c.windup) return false;
  c.breachT = 0.4;
  const R = c.S.big || c.species === 'overseer' ? 2 : 1;
  const sx = Math.sign(t.x - c.x);
  const sz = Math.sign(t.z - c.z);
  const stuck = c.stuckT > 1.2 && dist(c, t) > 1;
  const w = game.world;
  const hits = [];
  // (Where its way to you ran into something of yours.)
  if (c.breachAt) {
    const { x, z } = c.breachAt;
    c.breachAt = null;
    for (const y of [c.y, c.y + 1, c.y + 2]) {
      const k = `${x},${y},${z}`;
      if (run.placed.has(k) && w.getBlock(x, y, z) !== BLOCKS_ID.air) hits.push({ x, y, z, k });
    }
  }
  for (let dz = -R; dz <= R; dz++) {
    for (let dx = -R; dx <= R; dx++) {
      if (!dx && !dz) continue;
      const toward = (dx === 0 || Math.sign(dx) === sx) && (dz === 0 || Math.sign(dz) === sz) && (sx || sz);
      if (!toward && !stuck) continue;
      for (const y of [c.y, c.y + 1, c.y + 2]) {
        const k = `${c.x + dx},${y},${c.z + dz}`;
        if (run.placed.has(k) && w.getBlock(c.x + dx, y, c.z + dz) !== BLOCKS_ID.air) hits.push({ x: c.x + dx, y, z: c.z + dz, k });
      }
    }
  }
  if (!hits.length) {
    // Stuck short of it: something of yours on the line to you? It goes for it.
    if (!stuck || c.moving) return false;
    const n = dist(c, t);
    for (let k = 1; k <= Math.min(10, n); k++) {
      const x = Math.round(c.x + ((t.x - c.x) * k) / n);
      const z = Math.round(c.z + ((t.z - c.z) * k) / n);
      if (![c.y, c.y + 1].some((y) => run.placed.has(`${x},${y},${z}`))) continue;
      const ax = Math.sign(x - c.x);
      const az = Math.sign(z - c.z);
      return !!(c.tryStep(c.x + ax, c.z + az, c.S.step) || (ax && c.tryStep(c.x + ax, c.z, c.S.step)) || (az && c.tryStep(c.x, c.z + az, c.S.step)));
    }
    return false;
  }
  const r = game.renderer;
  for (const h of hits) {
    const id = w.getBlock(h.x, h.y, h.z);
    w.setBlock(h.x, h.y, h.z, BLOCKS_ID.air);
    if (BLOCKS[id] && BLOCKS[id].name === 'door') w.setBlock(h.x, h.y + 1, h.z, BLOCKS_ID.air);
    run.placed.delete(h.k);
    r.emit(h.x, h.y + 0.5, h.z, { n: 10, color: game.blockColor ? game.blockColor(id) : ['#8a8478', '#5a5650'], up: 30, speed: 50, gravity: 160, life: 0.6 });
  }
  r.effect?.({ type: 'ring', wx: hits[0].x, wy: c.y, wz: hits[0].z, r0: 4, r1: 30, color: ['#d8c8a0', '#ffffff'], life: 0.35, oy: 2, flat: 0.5, thick: 2 });
  r.floatText(c.x, c.y + 3.2, c.z, 'smashes through!', '#ff9060');
  game.audio?.play('crumble', hits[0]);
  game.audio?.play('boom', hits[0]);
  game.shake = Math.min(1.4, (game.shake || 0) + 0.6);
  game.lightDirty = true;
  c.face(hits[0].x, hits[0].z);
  c.stunT = Math.max(c.stunT || 0, 0.35);
  c.breachBest = Infinity;
  return true;
}

// A cloud of the blight's spores hanging over the ground a while: it stings,
// and slows whoever's in it.
export function sporeCloud(game, at, rad = 1, by = null) {
  const tiles = areaTiles(at.x, at.z, rad, true);
  addZone(game, { by, kind: 'spores', tiles, y: at.y, life: 4.5, tick: 0.7, dmg: 1, slow: true, color: COLORS.void, puff: VOID_MOTES });
  game.renderer.emit(at.x, at.y + 0.8, at.z, { n: 24, color: VOID_MOTES, up: 20, speed: 40, life: 0.9, shape: 'puff', gravity: -8 });
  game.renderer.effect?.({ type: 'ring', wx: at.x, wy: at.y, wz: at.z, r0: 4, r1: 18 + rad * 10, color: ['#c070ff', '#e8b0ff'], life: 0.5, oy: 2, flat: 0.5, thick: 2 });
  game.audio?.play('void', at);
}

// Out of the ground again (a crawler, the worm), dazed a moment.
function surface(c) {
  const game = c.game;
  c.burrowed = false;
  c.erupting = false;
  c.solid = true;
  // (Somewhere free to come up: room for all of it, for a great master.)
  if (c.foot) {
    const s = fitNear(game, c, c.x, c.z, c.y, 8);
    if (s) c.teleport(s.x, s.y, s.z);
  } else if (game.occupiedBySolid(c.x, c.y, c.z, c)) {
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
  // (A big one's slam reaches a pace past its body.)
  const R = r + (c.foot || (c.S.big ? 1 : 0));
  if (!t || t.dead || c.windup || c.slamCd > 0 || dist(c, t) > Math.max(R, r + 1) || (c.isBoss && !ready(c))) return false;
  c.slamCd = every;
  if (c.isBoss) used(c);
  const tiles = areaTiles(c.x, c.z, R);
  addHazard(game, { by: c, tiles, dur: windup, dmg: Math.round(dmg * (c.dmgMult || 1)), knock: 2, stun: 0.3, from: { x: c.x, z: c.z }, center: { x: c.x, z: c.z }, radius: R, kind: 'slam', color: COLORS.blow, onFire: after ? () => after() : null });
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
      // (One the blight's in leaves its spores hanging there.)
      if (c.infected) sporeCloud(game, c, 1, c);
      c.sporeless = true;
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
  // The Overseer's shield up: a blade glances off it as an arrow does (its
  // sentinels have to come down first).
  if (target.species === 'overseer' && source !== target && !(source.sentinel === target) && shielded(target)) {
    target.shieldHit = { t: 0, ang: Math.atan2(source.z - target.z, source.x - target.x) };
    if (!(target.shieldNote > 0)) {
      target.shieldNote = 0.6;
      r.floatText(target.x, target.y + 2.6, target.z, 'shielded', '#a0f4ff');
    }
    r.emit(target.x + Math.sign(source.x - target.x) * 1.6, target.y + 1.2, target.z + Math.sign(source.z - target.z) * 1.6, { n: 8, color: ['#ffffff', '#a0f4ff', '#5ad8f0'], up: 30, speed: 70, life: 0.3, glow: true });
    game.audio?.play('armor_hit', target);
    game.audio?.play('hum', target);
    if (source.kind === 'player' && !game.toldShield) {
      game.toldShield = true;
      game.ui.msg('Your blow glances off the Overseer\'s shield. Bring down its sentinels first!', '#a0f4ff', true);
    }
    return 0;
  }
  if (target.submerged) return 0;
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

// The other masters' ways (see bosses.js).
Object.assign(BRAINS, bossBrains({ addHazard, addZone, lob, lineTiles, areaTiles, summon, bossSlam, phaseSummons, dist, sees, COLORS }));
