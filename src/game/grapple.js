// (Round 78) A grappling hook: thrown at a ledge higher than you (the top
// of a wall, the lip of a pit you've fallen into), it flies up, bites, and
// you go up the rope hand over hand, slowly, a pace at a time, to stand on
// top. Used again on the way up: you let go. Hurt on the rope, you lose
// your grip. (`_grapple` is the climb itself; `grappleAt`, where the hook
// is, for the rope to be drawn: see renderer.fishingDecos.)
import { BLOCKS } from '../world/blocks.js';

const REACH = 9; // paces out, as the crow flies
const HIGH = 12; // paces up
const PACE = 0.55; // seconds a pace, climbing

// Where a hook thrown at what's pointed at would bite: a place to stand on
// top of it (or of what's stacked on it), or null.
export function hookSpot(game, c) {
  const w = game.world;
  for (let y = c.y + 1; y <= c.y + 4; y++) {
    if (w.canStand(c.x, y, c.z) && BLOCKS[w.getBlock(c.x, y - 1, c.z)].solid) return { x: c.x, y, z: c.z };
  }
  return null;
}

// Thrown: true if it's on its way.
export function throwGrapple(game, c) {
  const p = game.player;
  if (p._grapple) return letGo(game, p, 'You let go of the rope.');
  if (p.mount || p.raft || p.deck || p._ride || p.inWagon || p.dead) return false;
  if (!c || !c.block) return false;
  const at = hookSpot(game, c);
  const say = (t) => {
    game.ui.msg(t, '#c8c8c8', true);
    return true;
  };
  if (!at) return say('Nothing up there for the hook to bite on.');
  const up = at.y - p.y;
  const far = Math.max(Math.abs(at.x - p.x), Math.abs(at.z - p.z));
  if (up < 2) return say('That\'s near enough to climb without a hook.');
  if (up > HIGH || far > REACH) return say('Too far for the rope to reach.');
  p.face(at.x, at.z);
  p.doAction(0.35);
  const dist = Math.hypot(at.x - p.x, at.z - p.z, (at.y - p.y) * 0.8);
  p._grapple = { ...at, phase: 'fly', t: 0, fly: 0.15 + dist * 0.04, hp: p.hp };
  p.grappleAt = { x: at.x, y: at.y, z: at.z, k: 0 };
  game.audio?.play('swing');
  return true;
}

function letGo(game, p, why) {
  p._grapple = null;
  p.grappleAt = null;
  if (why) game.ui.msg(why, '#c8c8c8', true);
  return true;
}

// Each frame, for whoever's on a rope.
export function grappleTick(game, p, dt) {
  const G = p._grapple;
  if (!G) return;
  if (p.dead || p.mount || p.raft || p.deck) return letGo(game, p, null);
  if (p.hp < G.hp) return letGo(game, p, 'The blow shakes you off the rope!');
  G.hp = p.hp;
  if (G.phase === 'fly') {
    G.t += dt;
    p.grappleAt = { x: G.x, y: G.y, z: G.z, k: Math.min(1, G.t / G.fly) };
    if (G.t < G.fly) return;
    // (Something there to bite on still?)
    if (!game.world.canStand(G.x, G.y, G.z)) return letGo(game, p, 'The hook skitters off and falls back.');
    G.phase = 'climb';
    game.audio?.play('clang', { x: G.x, y: G.y, z: G.z });
    game.ui.msg('The hook bites. You go up the rope, hand over hand.', '#c8e0ff', true);
    return;
  }
  if (p.moving) return;
  const w = game.world;
  const dy = G.y - p.y;
  const dx = G.x - p.x;
  const dz = G.z - p.z;
  if (!dy && !dx && !dz) {
    letGo(game, p, null);
    game.ui.msg('You haul yourself up over the edge.', '#a0e0a0', true);
    return;
  }
  // A pace along the rope: up first while there's climbing to do (out
  // from the wall only once you're level with the top), then over.
  const free = (x, y, z) => {
    const a = BLOCKS[w.getBlock(x, y, z)];
    const b = BLOCKS[w.getBlock(x, y + 1, z)];
    return !(a && a.solid) && !(b && b.solid) && !(a && a.liquid && y > G.y);
  };
  const sx = Math.sign(dx);
  const sz = Math.abs(dx) >= Math.abs(dz) ? 0 : Math.sign(dz);
  const hx = Math.abs(dx) >= Math.abs(dz) ? sx : 0;
  const far = Math.max(Math.abs(dx), Math.abs(dz));
  // (Far out from the wall: in toward it along the ground first.)
  const opts = dy > 0 ? (far > dy ? [[hx, 0, sz], [hx, 1, sz], [0, 1, 0]] : [[0, 1, 0], [hx, 1, sz], [hx, 0, sz]]) : dy < 0 ? [[hx, 0, sz], [0, -1, 0]] : [[hx, 0, sz], [sx, 0, Math.sign(dz)]];
  for (const [ox, oy, oz] of opts) {
    if (!ox && !oy && !oz) continue;
    const nx = p.x + ox;
    const ny = p.y + oy;
    const nz = p.z + oz;
    if (!free(nx, ny, nz)) continue;
    p.startMove(nx, ny, nz, PACE);
    p.face(G.x, G.z);
    p.doAction(0.2);
    if (Math.random() < 0.3) game.audio?.play('step_wood', p);
    return;
  }
  letGo(game, p, 'The rope\'s fouled: you can\'t get any further, and let go.');
}

// On the rope: no falling (see Game.settleFall), no walking.
export function onRope(p) {
  return !!(p && p._grapple);
}
