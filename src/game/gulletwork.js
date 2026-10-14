// (Round 113) The Gullet of the World at work (laid out by
// world/deeps/gullet.js; the old works, the acid, the eggs, the quakes, the
// leech-pools, the throats and the nests, are still game/ancient.js's):
// the tremors (the Sleeper turns over now and then; where the roof's
// cracked, grit under it, it comes in, on whoever's under it, yours or
// theirs: you see it coming, and so can they, if you're quick); the sluice
// (turn the canal's wheel and the river runs again: its acid washed out of
// the channel and the leeches in it drowned, the barge's cargo there for
// the walking out); the god's table (feed the river god and his waters
// can't burn you a while: fish, longer); the bricked-up door (a household
// shut themselves in behind it; break it in, three blows, and every one
// of them loud: what sleeps near wakes, and the roof shifts); the clutches
// (the worm's eggs hatch as you come near, or when a borer comes up under
// them, or when their mother screams; she lays more); and the Swallowed
// (their children's children's children, still keeping the lamps lit:
// come near one and it leads you, to the bricked door its people have
// always known about, or to the god; hurt one and they're gone, all of
// them, into the dark).
//
// What's been done (the doors broken in, the sluices opened, the god fed)
// is kept in the floor's state, and put back when the floor's made again
// (see restore).
import { FY } from '../world/dungeongen.js';
import { B, BLOCKS } from '../world/blocks.js';
import { ITEMS } from '../world/items.js';
import { removeItem } from './inventory.js';
import { addHazard } from '../entities/monsters.js';
import { findPath } from '../entities/pathfind.js';
import { gulletLore } from '../world/deeps/gulletlore.js';
import { DAY } from '../sim/econ.js';

const k2 = (x, z) => `${x},${z}`;
const dist = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.z - b.z));
const mine = (run) => (run.state.gullet ||= { opened: {}, washed: {}, fed: {} });
// What's going on about the floor this visit (not saved).
export const glT = (run) => (run.gulletT ||= { told: {}, quakeT: QUAKE_EVERY * 0.6, warnT: 0, blows: new Map(), laid: [], hatched: new Set(), guide: null, led: false, hidden: false, lore: null });
const isGullet = (run) => run && run.rec && run.rec.type === 'gullet';
export const runOf = (game, x) => game.runAt?.(x) || game.dungeon || null;
const EARTH = ['#8a6e4c', '#5c4430', '#a4885e'];
const WATER = ['#7aa8de', '#c8e8ff', '#ffffff'];
const SLIME = ['#c8e060', '#7a9a2a', '#f0ffa0'];
const LAMP = ['#ffd060', '#ff902a', '#fff8d0'];
// How often the Sleeper turns (seconds), how long the roof groans first,
// what a fall of it does.
export const QUAKE_EVERY = 24;
export const QUAKE_WARN = 1.6;
export const FALL_DMG = 5;
// How many blows the bricked door takes; how far its noise carries.
export const BLOWS = 3;
const NOISE = 12;
// The river god's favour: its name, how long (fish, longer).
export const FAVOUR = 'River\'s Favour';
const FAVOUR_MINS = 150;
// A laid egg's time to hatch; how near you come before one does.
export const HATCH_T = 8;
const HATCH_NEAR = 2;

const tell = (run, k, text, color) => {
  const T = glT(run);
  if (T.told[k]) return;
  T.told[k] = true;
  run.game.ui.msg(text, color, true);
};
export const loreOf = (run) => (glT(run).lore ||= gulletLore(run.rec, run.floor || 0));
const now = (game) => game.day * DAY + game.minute;
// The river god's favour on someone: the acid can't burn them.
export function favoured(game, e) {
  if (!e || !e.buffs) return false;
  const t = now(game);
  return e.buffs.some((q) => q.name === FAVOUR && q.until > t);
}
function spotNear(run, x, z, r = 2) {
  const game = run.game;
  const w = game.world;
  for (let d = 1; d <= r; d++) {
    for (let dz = -d; dz <= d; dz++) {
      for (let dx = -d; dx <= d; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== d) continue;
        const sx = x + dx;
        const sz = z + dz;
        if (BLOCKS[w.getBlock(sx, FY, sz)].solid || BLOCKS[w.getBlock(sx, FY + 1, sz)].solid || !BLOCKS[w.getBlock(sx, FY - 1, sz)].solid) continue;
        if (game.occupiedBySolid?.(sx, FY, sz)) continue;
        return { x: sx, z: sz };
      }
    }
  }
  return null;
}
export function call(run, species, at, r = 2) {
  const s = spotNear(run, at.x, at.z, r);
  if (!s) return null;
  const c = run.spawn(species, s.x, FY, s.z, {});
  if (c) c.dormant = 0;
  return c;
}

// ------------------------------------------------------------ the tremors
// The Sleeper turns over: the roof comes in where it's cracked (shown on
// the ground a breath before), on anything under it.
export function tremor(run, quiet = false) {
  const game = run.game;
  const T = glT(run);
  const who = game.everyone ? game.everyone().filter((p) => p && !p.dead) : [game.player];
  let n = 0;
  for (const g of run.data.falls || []) {
    if (!who.some((p) => g.tiles.some((t) => dist(p, t) <= 12))) continue;
    addHazard(game, { tiles: g.tiles, y: FY, dur: QUAKE_WARN, dmg: FALL_DMG, stun: 0.8, kind: 'rocks', trap: true, place: true, color: [168, 136, 94] });
    for (const t of g.tiles) game.renderer.emit(t.x, FY + 2.6, t.z, { n: 3, color: EARTH, up: -6, speed: 4, gravity: 60, life: 1.2, oy: -10 });
    n++;
  }
  T.quakeT = QUAKE_EVERY * (0.8 + Math.random() * 0.4);
  if (!n) return 0;
  game.shake = Math.min(1, (game.shake || 0) + 0.35);
  game.audio?.play('rumble', game.player);
  if (!quiet) tell(run, 'tremor', 'The ground shudders under you, a long slow heave, and the roof groans: grit pours where it\'s cracked. (Get out from under it! And whatever\'s still under it when it comes in...)', '#c8a878');
  return n;
}

// ------------------------------------------------------------ the sluice
function wash(run, q, quiet) {
  const game = run.game;
  const w = game.world;
  mine(run).washed[k2(q.wheel.x, q.wheel.z)] = true;
  w.setState(q.wheel.x, FY, q.wheel.z, true);
  const set = new Set(q.acid.map((t) => k2(t.x, t.z)));
  for (const t of q.acid) if (w.getBlock(t.x, FY - 1, t.z) === B.acid_pool) w.setBlock(t.x, FY - 1, t.z, B.gl_silt);
  // (Its acid no longer acid, nor anything in it.)
  const A = run.data.anc;
  if (A) {
    for (const k of ['acid', 'leeches']) for (const g of A[k] || []) g.tiles = g.tiles.filter((t) => !set.has(k2(t.x, t.z)));
    for (const k of ['acid', 'leeches']) if (A[k]) A[k] = A[k].filter((g) => g.tiles.length);
  }
  game.lightDirty = true;
  if (quiet) return;
  game.audio?.play('splash', q.wheel);
  game.audio?.play('rumble', q.wheel);
  for (const t of q.acid) if (Math.random() < 0.5) game.renderer.emit(t.x, FY + 0.2, t.z, { n: 3, color: WATER, up: 16, speed: 14, life: 0.8 });
  // What lived in the acid, drowned.
  let n = 0;
  for (const c of run.creatures()) {
    if (c.dead || !set.has(k2(c.x, c.z)) || c.S?.floats) continue;
    game.damage(c, 99, null);
    n++;
  }
  const L = q.lore;
  game.ui.msg(`You lean on the wheel and it gives, groaning, a turn and another, and somewhere behind the wall a gate lifts: the river comes in brown and roaring along the old channel and the acid goes hissing away before it.${n ? ' What was in the acid goes with it.' : ''}${L ? ` (${L.lines.join(' ')})` : ''}`, '#a8d0f0', true);
}

// ------------------------------------------------------------ the god
function feed(run, q, p) {
  const game = run.game;
  const held = p.heldItem?.();
  const S = mine(run);
  const key = k2(q.x, q.z);
  if (S.fed[key]) {
    game.ui.msg('The god\'s bowl is full, and the little flame in his cup still burns.', '#a8d0f0');
    return;
  }
  if (!held || ITEMS[held]?.kind !== 'food') {
    game.ui.msg(`The table of ${loreOf(run).god}, a bronze bowl on it, empty, and a cup. (Something to eat, in your hand: the Swallowed say he is hungry.)`, '#e0c890', true);
    return;
  }
  removeItem(p.inv, held, 1);
  S.fed[key] = true;
  game.world.setState(q.x, q.y, q.z, true);
  game.lightDirty = true;
  const fish = /fish|eel|crab|shrimp|garum/.test(held);
  const mins = FAVOUR_MINS * (fish ? 2 : 1);
  p.buffs = (p.buffs || []).filter((b) => b.name !== FAVOUR);
  p.buffs.push({ river: 1, n: 1, until: now(game) + mins, name: FAVOUR });
  game.audio?.play('chime', q);
  game.renderer.emit(q.x, q.y + 1, q.z, { n: 24, color: WATER, up: 24, speed: 16, life: 1.1, glow: true });
  game.renderer.emit(p.x, p.y + 1.2, p.z, { n: 16, color: WATER, up: 18, speed: 10, life: 1, glow: true });
  game.ui.msg(`You lay ${ITEMS[held].name.toLowerCase()} in the god's bowl, and the little lamp in his cup catches by itself. Something cool runs over your skin like river water: the acid will not burn you a while.${fish ? ' (He likes fish. A long while.)' : ''}`, '#a8d0f0', true);
}

// ------------------------------------------------------------ the bricked door
function openBricks(run, q, quiet) {
  const game = run.game;
  const w = game.world;
  mine(run).opened[k2(q.door.x, q.door.z)] = true;
  for (const y of [FY, FY + 1]) if (w.getBlock(q.door.x, y, q.door.z) === B.gl_bricked) w.setBlock(q.door.x, y, q.door.z, B.air);
  game.lightDirty = true;
  if (quiet) return;
  game.renderer.emit(q.door.x, FY + 1, q.door.z, { n: 30, color: ['#8a6442', '#6a4a30', '#c6a678'], up: 20, speed: 30, life: 0.9, shape: 'puff' });
  game.audio?.play('crumble', q.door);
  game.ui.msg('The last blow goes through: the bricks fall in, and a breath of old, shut-in air comes out at you, and the smell of lamp-oil. Somebody lived in there, for a while.', '#e0c890', true);
}
function strike(run, q) {
  const game = run.game;
  const T = glT(run);
  const n = (T.blows.get(q) || 0) + 1;
  T.blows.set(q, n);
  game.shake = Math.min(1, (game.shake || 0) + 0.3);
  game.audio?.play('impact', q.door);
  game.renderer.emit(q.door.x, FY + 1, q.door.z, { n: 10, color: ['#8a6442', '#c6a678'], up: 14, speed: 20, life: 0.6, shape: 'puff' });
  // (Loud: what sleeps near wakes, and the roof shifts.)
  let woke = 0;
  for (const c of run.creatures()) {
    if (c.dead || !c.dormant || dist(c, q.door) > NOISE || c.S?.mode === 'passive') continue;
    run.wake(c);
    c.target = game.player;
    woke++;
  }
  if ((run.data.falls || []).length) T.quakeT = Math.min(T.quakeT, 0.5);
  if (n >= BLOWS) {
    openBricks(run, q, false);
    return;
  }
  game.renderer.floatText(q.door.x, FY + 2.2, q.door.z, `${n} / ${BLOWS}`, '#e0c890');
  if (n === 1) game.ui.msg(`You put your shoulder to the bricked door and it gives a little: the mortar's soft. The blow booms away down the dark${woke ? ', and something down there answers' : ''}. (Again, and again.)`, '#e0c890', true);
}

// ------------------------------------------------------------ the clutches
function hatch(run, at, p) {
  const game = run.game;
  const w = game.world;
  const T = glT(run);
  const key = k2(at.x, at.z);
  if (T.hatched.has(key)) return null;
  T.hatched.add(key);
  if (w.getBlock(at.x, FY, at.z) !== B.gl_eggs) return null;
  w.setBlock(at.x, FY, at.z, B.air);
  game.renderer.emit(at.x, FY + 0.6, at.z, { n: 16, color: ['#d4c8a0', ...SLIME], up: 30, speed: 30, life: 0.7 });
  game.audio?.play('splash', at);
  const c = run.spawn('maw_larva', at.x, FY, at.z, {});
  if (c) {
    c.dormant = 0;
    c.target = p || game.player;
  }
  return c;
}
// Something come up under them, or their mother screaming: the eggs near
// a spot hatch.
export function upheave(run, at, r = 2) {
  let n = 0;
  for (const g of run.data.clutches || []) for (const e of g.eggs) if (dist(e, at) <= r && hatch(run, e)) n++;
  for (const e of glT(run).laid) if (dist(e, at) <= r && hatch(run, e)) n++;
  if (n) tell(run, 'upheave', 'The eggs round it split all at once and what\'s inside comes boiling out. (Keep the borers and the mothers off the clutches.)', '#c8e070');
  return n;
}
// A mother lays.
export function lay(run, c) {
  const game = run.game;
  const s = spotNear(run, c.x, c.z, 1);
  if (!s || game.world.getBlock(s.x, FY, s.z) !== B.air) return null;
  game.world.setBlock(s.x, FY, s.z, B.gl_eggs, Math.random() < 0.5 ? 1 : 0);
  const e = { x: s.x, z: s.z, t: HATCH_T };
  glT(run).laid.push(e);
  game.renderer.emit(s.x, FY + 0.4, s.z, { n: 8, color: SLIME, up: 8, speed: 8, life: 0.6 });
  tell(run, 'lay', 'The clutch-mother squats and heaves, and leaves an egg behind her, glistening. It won\'t be long hatching. (Kill her, or the clutch never ends.)', '#c8e070');
  return e;
}

// ------------------------------------------------------------ the Swallowed
// Where one leads you: the bricked door (its people have always known
// about it), or the god.
function goalOf(run) {
  const S = mine(run);
  const b = (run.data.bricks || []).find((q) => !S.opened[k2(q.door.x, q.door.z)]);
  if (b) return { x: b.door.x, z: b.door.z, what: 'door' };
  const o = (run.data.offerings || []).find((q) => !S.fed[k2(q.x, q.z)]);
  if (o) return { x: o.x, z: o.z, what: 'god' };
  return null;
}
function lead(run, c, dt) {
  const game = run.game;
  const T = glT(run);
  const G = T.guide;
  const p = game.player;
  if (c.moving) return;
  if (dist(c, G.goal) <= 1) {
    if (!G.there) {
      G.there = true;
      c.face(G.goal.x, G.goal.z);
      game.renderer.floatText(c.x, c.y + 2.4, c.z, 'here', '#ffd890');
      game.ui.msg(G.goal.what === 'door' ? 'The Swallowed one stops by a doorway that\'s been bricked up, and lays its hand flat on the bricks, and looks at you. (Bricked from the inside. Its people have always known.)' : 'The Swallowed one kneels at the foot of the god\'s steps, and touches its mouth, and points up at his table.', '#ffd890', true);
    }
    return;
  }
  // (Waiting for you, looking back, when you fall behind.)
  if (dist(c, p) > 6) {
    c.face(p.x, p.z);
    return;
  }
  G.stepT = (G.stepT || 0) - dt;
  if (G.stepT > 0) return;
  G.stepT = 0.15;
  if (!G.path || G.i >= G.path.length) {
    G.path = findPath(game.world, c.x, c.y, c.z, G.goal.x, FY, G.goal.z, { maxNodes: 3000, near: 1, partial: true, blocked: (x, z) => game.occupiedBySolid(x, c.y, z, c) });
    G.i = 0;
    if (!G.path || !G.path.length) {
      G.stuck = (G.stuck || 0) + 1;
      if (G.stuck > 6) G.there = true;
      return;
    }
  }
  const [nx, , nz] = G.path[G.i];
  if (c.tryStep(nx, nz, c.S.step * 1.2)) G.i++;
  else G.path = null;
}
// One of them hurt or killed: they're gone, all of them, into the dark.
function hide(run) {
  const game = run.game;
  const T = glT(run);
  if (T.hidden) return;
  T.hidden = true;
  T.guide = null;
  for (const c of run.creatures()) {
    if (c.dead || c.species !== 'swallowed_one') continue;
    game.renderer.emit(c.x, c.y + 1, c.z, { n: 12, color: LAMP, up: 10, speed: 10, life: 0.6 });
    c.dead = true;
    game.removeOcc?.(c);
  }
  game.ui.msg('The lamps go out, all at once, everywhere, and when your eyes find the dark again the Swallowed are gone. You won\'t see them again on this floor.', '#c8a878', true);
}

// ------------------------------------------------------------ the killed
export function onKill(run, e) {
  if (!isGullet(run) || !e) return;
  if (e.species === 'swallowed_one') hide(run);
}

// ------------------------------------------------------------ put back
export function restore(run) {
  if (!isGullet(run)) return;
  const S = mine(run);
  const w = run.game.world;
  for (const q of run.data.bricks || []) if (S.opened[k2(q.door.x, q.door.z)]) openBricks(run, q, true);
  for (const q of run.data.sluices || []) if (S.washed[k2(q.wheel.x, q.wheel.z)]) wash(run, q, true);
  for (const q of run.data.offerings || []) if (S.fed[k2(q.x, q.z)]) w.setState(q.x, q.y, q.z, true);
}

// ------------------------------------------------------------ clicked
export function sayOf(b) {
  switch (b.name) {
    case 'gl_tablet': return 'A tablet of clay set in the wall, the wedges on it too worn to read.';
    case 'gl_relief': return 'The river god in relief, the blue of his waters flaking.';
    default: return null;
  }
}
export function interact(run, x, y, z, b) {
  if (!isGullet(run)) return false;
  const game = run.game;
  const S = mine(run);
  switch (b.interact) {
    case 'gl_bricked': {
      const q = (run.data.bricks || []).find((o) => o.door.x === x && o.door.z === z);
      if (!q) {
        game.ui.msg('A doorway bricked up, the mortar black with bitumen and a clay seal pressed over it: a lion. It\'s held for a thousand years.', '#e0c890');
        return true;
      }
      strike(run, q);
      return true;
    }
    case 'gl_wheel': {
      const q = (run.data.sluices || []).find((o) => o.wheel.x === x && o.wheel.z === z);
      if (!q) {
        game.ui.msg('A bronze wheel on a post, green with age. It doesn\'t move.', '#a8d0f0');
        return true;
      }
      if (S.washed[k2(x, z)]) {
        game.ui.msg('The sluice wheel, turned all the way. The river runs in the old canal again, brown and slow.', '#a8d0f0');
        return true;
      }
      wash(run, q, false);
      return true;
    }
    case 'gl_offering': {
      const q = (run.data.offerings || []).find((o) => o.x === x && o.z === z) || { x, y, z };
      feed(run, { ...q, y }, game.player);
      return true;
    }
    default: return false;
  }
}

// ------------------------------------------------------------ each frame
export function tick(run, dt, party = null) {
  if (!isGullet(run)) return;
  const game = run.game;
  const T = glT(run);
  const who = (party || [game.player]).filter((p) => p && !p.dead);
  if (!who.length) return;
  const p0 = game.player;
  const mobs = run.creatures();
  // The Sleeper turning over.
  if ((run.data.falls || []).length) {
    T.quakeT -= dt;
    if (T.quakeT <= 0) tremor(run);
  }
  // The clutches: hatching as you come near; the laid ones, in their time.
  for (const g of run.data.clutches || []) {
    for (const e of g.eggs) {
      if (T.hatched.has(k2(e.x, e.z))) continue;
      const p = who.find((q) => dist(q, e) <= HATCH_NEAR);
      if (!p) continue;
      hatch(run, e, p);
      tell(run, 'hatch', 'The egg by your foot splits and something pale and wet and all mouth comes out of it, hungry. (Go round the clutches, or through them quick.)', '#c8e070');
    }
  }
  for (const e of T.laid) {
    e.t -= dt;
    if (e.t <= 0 || who.some((q) => dist(q, e) <= HATCH_NEAR)) hatch(run, e);
  }
  T.laid = T.laid.filter((e) => !T.hatched.has(k2(e.x, e.z)));
  // The Swallowed: come near one and it leads you.
  if (!T.hidden) {
    if (T.guide && (T.guide.c.dead || !mobs.includes(T.guide.c))) T.guide = null;
    if (!T.guide && !T.led) {
      const c = mobs.find((q) => !q.dead && q.species === 'swallowed_one' && dist(q, p0) <= 3);
      const goal = c && goalOf(run);
      if (c && goal) {
        T.led = true;
        T.guide = { c, goal };
        c.guiding = true;
        game.ui.msg(`The Swallowed one lifts its lamp to look at you, a long while. ${loreOf(run).swallowed()}`, '#ffd890', true);
      } else if (c && !T.told.saw) {
        T.told.saw = true;
        game.ui.msg(`The Swallowed one lifts its lamp to look at you. ${loreOf(run).swallowed()}`, '#ffd890', true);
      }
    }
    if (T.guide) lead(run, T.guide.c, dt);
    for (const c of mobs) if (!c.dead && c.species === 'swallowed_one' && c.hp < c.maxHp) hide(run);
  }
}
