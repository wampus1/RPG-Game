// (Round 72) What the evolved masters leave behind them (see
// entities/evolved.js, and world/ancient.js for their places): each a thing
// of its own power, for whoever beats it, used from your belt (F, or the
// right button) like any gadget (see kavtech.useGadget); and three or four
// pieces of the best arms and armour there are, five stars every one.
//   The Hand of the Great Work (the Divine Alchemist): a ring of its
//     element breaks out of the ground round you, fire, then frost, then
//     acid, then lightning, each use the next.
//   The Crawler's Needle (the Rift Crawler): used once, it marks where you
//     stand; used again, it tears a rift between that mark and where you
//     are now, that anyone (and anything) can step through, for twenty
//     seconds.
//   The Champion's Gauntlet (the Hero): for twelve seconds your blows land
//     half again as hard and rend whoever else is before you, and what
//     lands on you lands lighter.
//   The Alinelidan's Tooth (the Alinelidan): you go down into the ground
//     like the worm and come up under where you point, eight paces off,
//     through walls, throwing back whoever's there and leaving a pool of
//     its acid behind you.
// And each is an achievement (see achievements.js).
import { ITEMS } from '../world/items.js';
import { BLOCKS } from '../world/blocks.js';
import { starGear } from '../world/quality.js';
import { GEAR_TIERS } from '../world/dungeongen.js';
import { addRift, isEvolved } from '../entities/evolved.js';
import { addZone, areaTiles } from '../entities/monsters.js';
import { foesNear } from './dishacts.js';
import { knock } from './combat.js';
import { burn, chill, stun } from './gems.js';

export const EVOLVED_LOOT = { divine_alchemist: 'alchemist_hand', rift_crawler: 'rift_needle', the_hero: 'hero_gauntlet', alinelidan: 'worm_tooth' };
export const EVOLVED_GEAR_KEYS = Object.values(EVOLVED_LOOT);
const TAU = Math.PI * 2;

// Which way you're pointing (or facing).
function aimOf(game, p) {
  const a = game.aimAngle ? game.aimAngle() : null;
  if (a !== null && a !== undefined) return a;
  const D = { 0: [0, 1], 1: [-1, 0], 2: [0, -1], 3: [1, 0] }[p.dir] || [0, 1];
  return Math.atan2(D[1], D[0]);
}
// How hard a blow of yours lands now, for what these do.
function blowOf(game) {
  return game.blowDamage ? game.blowDamage(false, true, null).dmg : 4;
}

// ------------------------------------------------------------ using them
// From useGadget: true/false whether it went off (undefined: not one of
// these).
export function useEvolvedGear(game, p, key) {
  switch (key) {
    case 'alchemist_hand': return greatWork(game, p);
    case 'rift_needle': return needle(game, p);
    case 'hero_gauntlet': return gauntlet(game, p);
    case 'worm_tooth': return tooth(game, p);
  }
  return undefined;
}

const ELEMENTS = [
  { kind: 'fire', word: 'fire', col: ['#ff8030', '#ffd060', '#ffffff'], halo: '#ff6020', sound: 'fire' },
  { kind: 'cold', word: 'frost', col: ['#a0d8ff', '#e8f8ff', '#ffffff'], halo: '#80c0ff', sound: 'freeze' },
  { kind: 'acid', word: 'acid', col: ['#a8e040', '#e0ff80', '#5a8a20'], halo: '#a0e040', sound: 'hiss' },
  { kind: 'shock', word: 'lightning', col: ['#fff8a0', '#ffe040', '#ffffff'], halo: '#ffe040', sound: 'thunder' },
];
// A ring of the element, three paces out, round you; the next element
// each time.
function greatWork(game, p) {
  const r = game.renderer;
  p.handEl = ((p.handEl ?? -1) + 1) % ELEMENTS.length;
  const E = ELEMENTS[p.handEl];
  const dmg = Math.max(8, Math.round(blowOf(game) * 1.6));
  const foes = foesNear(game, p, 3.6).filter((e) => Math.hypot(e.x - p.x, e.z - p.z) >= 1);
  for (const e of foes) {
    let n = dmg;
    if (E.kind === 'cold') chill(e, 4);
    if (E.kind === 'fire') burn(game, e, p, 4);
    if (E.kind === 'acid') n = Math.round(n * 1.3);
    if (E.kind === 'shock') {
      n = Math.round(n * 1.5);
      stun(e, 0.8);
    }
    game.damage(e, n, p);
    if (!e.moving && e.hp > 0) knock(game, p, e, 1);
  }
  if (E.kind === 'acid') {
    const tiles = areaTiles(p.x, p.z, 3, true).filter((q) => Math.hypot(q.x - p.x, q.z - p.z) >= 1.5 && !BLOCKS[game.world.getBlock(q.x, p.y, q.z)].solid);
    addZone(game, { by: p, all: true, kind: 'bile', tiles, y: p.y, life: 4, tick: 0.7, dmg: 2, slow: true, color: [160, 220, 60], puff: E.col });
  }
  // How it looks: the circle of the great work drawn in the ground, the
  // ring of the element bursting up out of it.
  r.effect?.({ type: 'ring', wx: p.x, wy: p.y, wz: p.z, r0: 6, r1: 58, color: [E.halo, '#ffffff'], life: 0.45, oy: 3, flat: 0.5, thick: 3 });
  r.effect?.({ type: 'ring', wx: p.x, wy: p.y, wz: p.z, r0: 50, r1: 60, color: ['#ffe070', E.halo], life: 0.8, oy: 3, flat: 0.5, thick: 1 });
  for (let k = 0; k < 24; k++) {
    const a = (k / 24) * TAU;
    r.emit(p.x + Math.cos(a) * 3, p.y + 0.2, p.z + Math.sin(a) * 3, { n: 3, color: E.col, up: 40, speed: 14, gravity: E.kind === 'shock' ? 0 : 120, life: 0.7, glow: true, shape: E.kind === 'cold' ? 'star' : undefined });
  }
  r.emit(p.x, p.y + 1.2, p.z, { n: 10, color: ['#ffe070', '#ffffff', E.halo], up: 30, speed: 30, life: 0.6, glow: true });
  game.audio?.play(E.sound, p);
  game.shake = Math.min(1, (game.shake || 0) + 0.25);
  game.ui.msg(`The Hand turns, and a ring of ${E.word} breaks out of the ground round you${foes.length ? `: ${foes.length} caught in it` : ''}. (Next: ${ELEMENTS[(p.handEl + 1) % ELEMENTS.length].word}.)`, E.halo);
  return true;
}

// The Needle: a mark, then a rift from it to here.
function needle(game, p) {
  const r = game.renderer;
  const A = p.needleMark;
  const place = game.dungeon ? game.dungeon.rec.id : 'world';
  if (!A || A.place !== place || Math.abs(A.y - p.y) > 2) {
    p.needleMark = { x: p.x, y: p.y, z: p.z, place };
    r.effect?.({ type: 'ring', wx: p.x, wy: p.y, wz: p.z, r0: 2, r1: 20, color: ['#c8a0ff', '#ffffff'], life: 0.5, oy: 3, flat: 0.5, thick: 2 });
    r.emit(p.x, p.y + 0.4, p.z, { n: 14, color: ['#c8a0ff', '#5ad8f0', '#ffffff'], up: 24, speed: 16, life: 0.8, glow: true });
    game.audio?.play('void', p);
    game.ui.msg('The Needle pricks the air where you stand, and the air remembers it. Use it again, elsewhere, to tear the rift between.', '#c8a0ff');
    return false;
  }
  if (Math.hypot(A.x - p.x, A.z - p.z) < 3) {
    game.ui.msg('Too near the mark for a rift: go further.', '#c8a0ff', true);
    game.audio?.play('error');
    return false;
  }
  p.needleMark = null;
  const R = addRift(game, { x: A.x, z: A.z }, { x: p.x, z: p.z }, { life: 20, by: p, y: p.y, run: game.dungeon || null, hue: 'void' });
  // (Not straight through it yourself: step off, and back on.)
  R.cd.set(p, 2.5);
  r.flashScreen?.('#8a60ff', 0.12);
  r.effect?.({ type: 'bolt', wx: A.x, wy: p.y, wz: A.z, tx: p.x, ty: p.y, tz: p.z, life: 0.35, oy: -8 });
  game.shake = Math.min(1, (game.shake || 0) + 0.2);
  game.ui.msg('The Needle tears, and the air opens: a rift between here and your mark, for twenty seconds. Step into either end. (Anything else can too.)', '#c8a0ff');
  return true;
}

// The Gauntlet: twelve seconds of the Hero's strength.
function gauntlet(game, p) {
  if (p.clawT > 0) {
    game.ui.msg('The Gauntlet is already closed on you.', '#ffe070', true);
    return false;
  }
  p.clawT = 12;
  const r = game.renderer;
  r.effect?.({ type: 'ring', wx: p.x, wy: p.y, wz: p.z, r0: 4, r1: 36, color: ['#ffe070', '#ffffff'], life: 0.5, oy: 3, flat: 0.5, thick: 2 });
  r.emit(p.x, p.y + 1.2, p.z, { n: 22, color: ['#ffe070', '#ff8040', '#ffffff'], up: 40, speed: 40, life: 0.8, glow: true, shape: 'star' });
  r.flashScreen?.('#ffd060', 0.1);
  game.audio?.play('roar', p);
  game.ui.msg('The Gauntlet closes on your hand, and the Hero\'s strength comes up your arm: twelve seconds of it.', '#ffe070');
  return true;
}

// The Tooth: under the ground and up again where you point.
function tooth(game, p) {
  const ang = aimOf(game, p);
  const dx = Math.cos(ang);
  const dz = Math.sin(ang);
  const w = game.world;
  let best = null;
  for (let d = 2; d <= 8; d++) {
    const x = Math.round(p.x + dx * d);
    const z = Math.round(p.z + dz * d);
    const y = w.findStandY(x, z, p.y);
    if (y < 0 || Math.abs(y - p.y) > 1 || !w.canStand(x, y, z) || game.occupiedBySolid?.(x, y, z, p)) continue;
    best = { x, y, z };
  }
  if (!best) {
    game.ui.msg('No ground to come up through that way.', '#c8f080', true);
    game.audio?.play('error');
    return false;
  }
  const r = game.renderer;
  const from = { x: p.x, y: p.y, z: p.z };
  r.emit(from.x, from.y + 0.2, from.z, { n: 16, color: ['#7a5a3a', '#5a4430', '#a8885a'], up: 30, speed: 30, gravity: 200, life: 0.6, oy: 4 });
  game.audio?.play('crumble', from);
  p.teleport(best.x, best.y, best.z);
  p.rollT = 0;
  p.grabbedT = 0;
  // Up out of the ground: the earth thrown up, whoever's near thrown back,
  // and the worm's acid left in the hole.
  r.effect?.({ type: 'ring', wx: best.x, wy: best.y, wz: best.z, r0: 4, r1: 40, color: ['#c8f080', '#ffffff'], life: 0.45, oy: 4, flat: 0.5, thick: 2 });
  r.emit(best.x, best.y + 0.3, best.z, { n: 26, color: ['#7a5a3a', '#5a4430', '#a8885a', '#c8f080'], up: 50, speed: 50, gravity: 220, life: 0.7, oy: 4 });
  const dmg = Math.max(6, Math.round(blowOf(game) * 1.2));
  const foes = foesNear(game, p, 2.2);
  for (const e of foes) {
    game.damage(e, dmg, p);
    if (!e.moving && e.hp > 0) knock(game, p, e, 2);
  }
  const tiles = areaTiles(best.x, best.z, 1, true).filter((q) => !(q.x === best.x && q.z === best.z) && !BLOCKS[w.getBlock(q.x, best.y, q.z)].solid);
  addZone(game, { by: p, all: true, kind: 'bile', tiles, y: best.y, life: 5, tick: 0.7, dmg: 2, slow: true, color: [150, 210, 60], puff: ['#a8e040', '#d8f080', '#5a8a20'] });
  game.shake = Math.min(1, (game.shake || 0) + 0.4);
  game.audio?.play('erupt', best);
  game.lightDirty = true;
  game.ui.msg(`You go down into the ground like the worm, and come up ${Math.round(Math.hypot(best.x - from.x, best.z - from.z))} paces on${foes.length ? `, under ${foes.length === 1 ? 'something' : `${foes.length} of them`}` : ''}!`, '#c8f080');
  return true;
}

// ------------------------------------------------------------ each frame
export function updateEvolvedGear(game, dt) {
  const p = game.player;
  if (!p) return;
  if (p.clawT > 0) {
    p.clawT -= dt;
    if (Math.random() < dt * 16) game.renderer.emit(p.x + (Math.random() - 0.5) * 0.8, p.y + 0.6 + Math.random() * 0.8, p.z, { n: 1, color: ['#ffe070', '#ff8040'], up: 14, speed: 6, gravity: -8, life: 0.6, glow: true });
    if (p.clawT <= 0) {
      p.clawT = 0;
      game.ui.msg('The Gauntlet loosens its grip.', '#ffe070', true);
    }
  }
  const A = p.needleMark;
  if (A && Math.random() < dt * 8) game.renderer.emit(A.x, A.y + 0.3 + Math.random(), A.z, { n: 1, color: ['#c8a0ff', '#5ad8f0'], up: 10, speed: 4, gravity: -6, life: 1, glow: true });
}

// ------------------------------------------------------------ the blows
// The Gauntlet on a blow of yours: half again as hard, and a rend across
// whoever else is before you (from landBlow).
export function clawMult(p) {
  return p && p.clawT > 0 ? 1.5 : 1;
}
export function clawRend(game, p, target, dmg) {
  if (!(p.clawT > 0)) return;
  const r = game.renderer;
  const ang = Math.atan2(target.z - p.z, target.x - p.x);
  for (const e of foesNear(game, p, 2.6)) {
    if (e === target) continue;
    const a = Math.atan2(e.z - p.z, e.x - p.x);
    let d = Math.abs(a - ang) % TAU;
    if (d > Math.PI) d = TAU - d;
    if (d > 1.2) continue;
    game.damage(e, Math.max(1, Math.round(dmg * 0.6)), p);
    if (!e.moving && e.hp > 0) knock(game, p, e, 1);
  }
  r.emit(target.x, target.y + 1, target.z, { n: 8, color: ['#ffe070', '#ff8040', '#ffffff'], up: 24, speed: 40, life: 0.4, glow: true });
}
// And a blow on you, with it: lighter by a third (from Game.damage).
export function clawSoak(target, amount) {
  return target && target.kind === 'player' && target.clawT > 0 ? Math.max(1, Math.round(amount * 0.65)) : amount;
}

// ------------------------------------------------------------ what they leave
// An evolved master beaten (from DungeonRun's death handling): its own
// thing, and three or four pieces of the best, five stars each.
export function dropEvolvedLoot(run, e) {
  if (!isEvolved(e)) return null;
  const game = run.game;
  const key = EVOLVED_LOOT[e.species];
  const got = [];
  if (key && ITEMS[key]) {
    game.spawnDrop(key, 1, e.x, e.y, e.z, true);
    game.renderer.emit(e.x, e.y + 1.6, e.z, { n: 30, color: [ITEMS[key].color || '#ffe070', '#ffffff', '#c8a0ff'], up: 50, speed: 36, life: 1.3, glow: true, shape: 'star' });
    run.eachHere(() => game.ui.msg(`${ITEMS[key].name} falls from it! (Use it from your belt: F, or the right button.)`, ITEMS[key].color || '#ffe070'));
  }
  const isle = ((run.T && run.T.loot) || []).map(([k]) => k).filter((k) => ITEMS[k] && (ITEMS[k].kind === 'weapon' || ITEMS[k].kind === 'armor'));
  const top = GEAR_TIERS[GEAR_TIERS.length - 1].filter((k) => ITEMS[k]);
  const n = 3 + (Math.random() < 0.5 ? 1 : 0);
  const rng = { chance: (q) => Math.random() < q, int: (a, b) => a + Math.floor(Math.random() * (b - a + 1)), float: (a, b) => a + Math.random() * (b - a), pick: (a) => a[Math.floor(Math.random() * a.length)] };
  const land = run.rec.isle && typeof run.rec.isle === 'string' ? run.rec.isle : null;
  for (let i = 0; i < n; i++) {
    const base = isle.length && Math.random() < 0.4 ? rng.pick(isle) : rng.pick(top);
    const k = starGear(base, { origin: 'd', tier: 4, boss: true, far: true, land, stars: 5 }, rng);
    if (!ITEMS[k]) continue;
    game.spawnDrop(k, 1, e.x, e.y, e.z, true);
    got.push(ITEMS[k].name);
  }
  if (got.length) run.eachHere(() => game.ui.msg(`And the arms of all who came before you, the best of them: ${got.join(', ')}.`, '#ffe070'));
  return { key, got };
}
