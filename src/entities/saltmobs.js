// (Round 106) What lives in the Salt Cathedral beside the salt wights and
// the brine scorpions (laid out by world/deeps/saltworks.js, drawn in
// render/art/salt_mobs.js; the brine, the chandeliers, the singing
// crystals and the sluice are in game/saltwork.js), each made to work with
// the others:
//   the salt raker: one of the dead rakers who drew the salt off the pans,
//     white with it, still with its long rake. It reaches two paces, and
//     its rake drags whoever it catches a pace toward it: into the brine
//     (where the salt sets on you), into the wights (who mend in it).
//   the salt bloom: a crystal grown round a heart of brine, rooted in the
//     floor. It grows crystal on the tiles round it, walling you in, the
//     faster beside the brine; its touch crusts you. The singing crystals
//     shatter what it's grown; break it, and its growth crumbles.
//   the pale flamingo: blind white flamingos wading the brine lakes,
//     peaceful. Come near one (or ring a crystal by them) and the flock
//     takes fright: they honk and flap, and everything near wakes.
import { BRAINS } from './monsters.js';
import { beginAttack, inReach, styleOf } from '../game/combat.js';
import { B } from '../world/blocks.js';
import { runOf, crumble, honk } from '../game/saltwork.js';

const dist = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.z - b.z));
const runAt = (c) => runOf(c.game, c.x);

// The rake's catch: whoever it hits comes a pace toward it, if there's
// floor there.
function rakeDrag(game, a, v) {
  if (!v || v.dead || (v.S && v.S.anchored) || v.rootT > 0) return;
  const dx = Math.sign(a.x - v.x);
  const dz = Math.sign(a.z - v.z);
  const [sx, sz] = Math.abs(a.x - v.x) >= Math.abs(a.z - v.z) ? [dx, 0] : [0, dz];
  const nx = v.x + sx;
  const nz = v.z + sz;
  if (nx === a.x && nz === a.z) return;
  const w = game.world;
  const ny = w.stepTarget(v.x, v.y, v.z, nx, nz, false);
  if (ny < 0 || game.occupiedBySolid(nx, ny, nz, v)) return;
  const there = game.occ?.get(game.occKey(nx, ny, nz));
  if (there && there !== v) return;
  game.moveEntity(v, nx, ny, nz);
  v.teleport?.(nx, ny, nz);
  game.renderer.emit(v.x, v.y + 0.6, v.z, { n: 8, color: ['#ffffff', '#d8d4d8'], up: 8, speed: 20, life: 0.4 });
  game.renderer.floatText(v.x, v.y + 2.4, v.z, 'raked in!', '#f0ece8');
}
// The flamingo struck: the whole flock takes fright.
function flamingoStruck(game, c, src, amount) {
  if (!c.fled) {
    const run = runAt(c);
    if (run) honk(run, c, src && src.kind === 'player' ? src : null);
  }
  c.fleeFrom = src && src !== c ? src : c.fleeFrom;
  c.fleeT = 8;
  return amount;
}

export const SALT_SPECIES = {
  salt_raker: {
    name: 'Salt Raker', hp: 18, dmg: 3, step: 0.5, mode: 'hostile', aggro: 8, under: true, undead: true, style: 'spear', brain: 'raker', isle: 'saltmere',
    drops: [['salt', 1, 3, 0.8], ['old_coin', 1, 2, 0.25]],
    onHit(game, a, v) {
      rakeDrag(game, a, v);
    },
  },
  salt_bloom: {
    name: 'Salt Bloom', hp: 16, dmg: 2, step: 9, mode: 'hostile', aggro: 4, under: true, anchored: true, brain: 'saltBloom', light: 3, isle: 'saltmere',
    drops: [['salt', 2, 4, 1], ['mothers_tear', 1, 1, 0.06]],
    // (Broken, all it grew crumbles: see saltwork.crumble.)
    onDeath(game, c) {
      const run = runAt(c);
      if (run) crumble(run, c);
    },
  },
  pale_flamingo: {
    name: 'Pale Flamingo', hp: 8, dmg: 1, step: 0.36, mode: 'passive', aggro: 0, under: true, brain: 'flamingo', calm: 'flamingo', ward: flamingoStruck, isle: 'saltmere',
    drops: [['pink_feather', 1, 2, 0.8]],
  },
};

export const SALT_BRAINS = {
  // At the rake's length: two paces off, in line, it rakes, and stands its
  // ground there (it doesn't come in under its own rake); further, or out
  // of line, it comes on as anything does.
  raker(c) {
    const t = c.target;
    if (!t || t.dead || c.moving) return false;
    const d = Math.max(Math.abs(t.x - c.x), Math.abs(t.z - c.z));
    const st = styleOf(c);
    if (d !== 2 || !inReach(c, t, st)) return false;
    c.face(t.x, t.z);
    if (c.attackCd <= 0 && !c.windup) beginAttack(c.game, c, t, st);
    return true;
  },

  // Rooted; growing crystal on the tiles about it (five at most), the
  // quicker beside the brine; its touch crusting whoever's by it.
  saltBloom(c, dt) {
    const game = c.game;
    if (c.dead) return true;
    const run = runAt(c);
    c.grown ||= [];
    c.growT = (c.growT ?? 3) - dt;
    if (c.growT <= 0) {
      const wet = run && (run.data.brine || []).concat(run.data.lake || []).some((q) => dist(q, c) <= 2);
      c.growT = wet ? 2.5 : 5;
      if (c.grown.length < 5 && game.everyone().some((p) => p && !p.dead && dist(p, c) <= 7)) grow(game, c);
    }
    c.touchT = (c.touchT ?? 1.5) - dt;
    if (c.touchT <= 0) {
      const v = game.everyone().find((p) => p && !p.dead && dist(p, c) <= 1 && Math.abs(p.y - c.y) <= 1);
      if (v) {
        c.touchT = 1.5;
        game.damage(v, 2, c);
        v.crust = (v.crust || 0) + 1;
        v.slowT = Math.max(v.slowT || 0, 0.8);
        game.renderer.emit(v.x, v.y + 1, v.z, { n: 6, color: ['#ffffff', '#f0d8e0'], up: 10, speed: 12, life: 0.4 });
      } else c.touchT = 0.3;
    }
    return true;
  },

  // Wading, still, among the flock (till something comes near: then the
  // flock takes fright, honking, and all the place wakes).
  flamingo(c) {
    const game = c.game;
    if (c.fleeT > 0) return false;
    // (Only the living put them up: they're used to the dead.)
    const t = game.everyone().find((p) => p && !p.dead && !p.limbo && Math.max(Math.abs(p.x - c.x), Math.abs(p.z - c.z)) <= 3);
    if (t) {
      const run = runAt(c);
      if (run && !c.fled) honk(run, c, t.kind === 'player' ? t : null);
      c.fleeFrom = t;
      c.fleeT = 6;
      return false;
    }
    c.target = null;
    return true;
  },
};

// A crystal grown on a free tile about the bloom (two paces at most):
// floor under it, nothing in the way, not the way through a door.
function grow(game, c) {
  const w = game.world;
  const y = c.y;
  const opts = [];
  for (let dz = -2; dz <= 2; dz++) {
    for (let dx = -2; dx <= 2; dx++) {
      if (!dx && !dz) continue;
      const x = c.x + dx;
      const z = c.z + dz;
      if (w.getBlock(x, y, z) !== B.air || w.getBlock(x, y + 1, z) !== B.air) continue;
      if (w.getBlock(x, y - 1, z) === B.air) continue;
      if (game.occ?.get(game.occKey(x, y, z))) continue;
      // (Never shutting a way through: a tile with walls either side of it
      // is a doorway.)
      const solid = (xx, zz) => w.getBlock(xx, y, zz) !== B.air;
      if ((solid(x - 1, z) && solid(x + 1, z)) || (solid(x, z - 1) && solid(x, z + 1))) continue;
      opts.push({ x, z });
    }
  }
  if (!opts.length) return;
  const t = opts[Math.floor(c.rng.float(0, opts.length))];
  w.setBlock(t.x, y, t.z, B.sw_growth, c.grown.length % 2);
  c.grown.push({ x: t.x, y, z: t.z });
  game.renderer.emit(t.x, y + 0.6, t.z, { n: 10, color: ['#ffffff', '#f0d8e0', '#c0d4e4'], up: 16, speed: 14, life: 0.5, glow: true });
  game.audio?.play('tink', t);
  if (!c.toldGrow) {
    c.toldGrow = true;
    game.renderer.floatText(c.x, c.y + 2.2, c.z, 'the bloom grows crystal about it', '#f0e0e8');
  }
}

Object.assign(BRAINS, SALT_BRAINS);
