// (Round 77) What folk do with their hands while they're standing about:
//   - sweeping (by their door, or in the shop): a broom going side to side,
//     the dust flying, and any snow lying there swept off;
//   - leaning on a wall, arms folded, for a while;
//   - talking with their hands, two of them stood together: turned to each
//     other, a hand up now and then, the odd word in the air.
//   - (Round 79) a stretch, arms up; a look about, this way and that.
// Started now and then while they're idle where they meant to be (see
// npc.js, atGoalBehaviour); drawn by the renderer (see drawIdleAnim).
// (Round 79: more often than they were, and at work too where it fits: a
// shopkeeper sweeps the shop, a guard leans by the gate.)
import { BLOCKS } from '../world/blocks.js';

const DX = [0, -1, 0, 1];
const DZ = [1, 0, -1, 0];
const DUST = ['#c8b898', '#b0a080', '#d8ccb0'];
const SNOWY = ['#f4f8ff', '#dce8f8'];
const CHAT = ['…', '!', '?', 'ha!', '♪', '…'];
// (What they're about when a broom, a wall or a chat might come into it.)
const LOOSE = new Set(['home', 'wander', 'social', 'visit', 'hobby', 'work', 'play', 'help', 'eat']);
// (Whose work leaves time for a broom: the shop's, the inn's.)
const SWEEPERS = new Set(['merchant', 'shopkeeper', 'innkeeper', 'tavernkeeper', 'baker', 'tailor', 'herbalist', 'jeweler', 'carpenter', 'barkeep', 'cook', 'farmer', 'priest', 'scholar']);

function wallBeside(n) {
  const w = n.game.world;
  for (let d = 0; d < 4; d++) {
    const b = BLOCKS[w.getBlock(n.x + DX[d], n.y, n.z + DZ[d])];
    const up = BLOCKS[w.getBlock(n.x + DX[d], n.y + 1, n.z + DZ[d])];
    if (b && b.solid && b.render === 'cube' && up && up.solid) return d;
  }
  return -1;
}

function partner(n) {
  for (const o of n.game.npcs || []) {
    if (o === n || o.dead || o.sleeping || o.moving || !o.atGoal || o.idleAnim) continue;
    if (Math.max(Math.abs(o.x - n.x), Math.abs(o.z - n.z)) > 2 || o.y !== n.y) continue;
    return o;
  }
  return null;
}

export function idleTick(n, act, g, dt) {
  const a = n.idleAnim;
  if (n.moving || !n.atGoal || n.sleeping || n.sitting || n.state !== 'routine') {
    if (a) n.idleAnim = null;
    return false;
  }
  if (a) {
    a.t += dt;
    if (a.t >= a.dur) {
      n.idleAnim = null;
      return false;
    }
    return step(n, a, dt);
  }
  // (Now and then, only: most of the time they're about what they're about.)
  n.idleCd = (n.idleCd ?? n.rng.float(2, 8)) - dt;
  if (n.idleCd > 0 || !act || !LOOSE.has(act.act) || n.rec.age === 'child') return false;
  n.idleCd = n.rng.float(6, 18);
  const job = n.rec.job;
  const busy = act.act === 'work' && g && (g.target || (g.tag === 'work' && !SWEEPERS.has(job) && job !== 'guard'));
  const gfx = n.game.renderer && n.game.renderer.gfx;
  const snow = gfx && gfx.depth ? gfx.depth(n.x + DX[n.dir], n.z + DZ[n.dir]) + gfx.depth(n.x, n.z) : 0;
  const r = n.rng.next();
  // A broom out: at home and at the shop, and at once if there's snow.
  if (!busy && job !== 'guard' && (snow > 0.3 || (r < 0.35 && (act.act === 'home' || act.act === 'work')))) {
    n.idleAnim = { kind: 'sweep', t: 0, dur: n.rng.float(6, 11) };
    return true;
  }
  const o = partner(n);
  if (o && (act.act === 'social' || act.act === 'wander' || act.act === 'visit' || r < 0.6)) {
    n.face(o.x, o.z);
    o.face(n.x, n.z);
    const dur = n.rng.float(7, 13);
    n.idleAnim = { kind: 'gesture', t: 0, dur, with: o };
    o.idleAnim = { kind: 'gesture', t: 0.7, dur, with: n };
    return true;
  }
  const wd = wallBeside(n);
  if (wd >= 0 && !busy && (r < 0.75 || job === 'guard')) {
    // (Back to the wall.)
    n.dir = (wd + 2) % 4;
    n.idleAnim = { kind: 'lean', t: 0, dur: n.rng.float(8, 16), wall: wd };
    return true;
  }
  // (Nothing to lean on, nobody to talk to: a stretch, or a look about.)
  if (busy) return false;
  if (r < 0.45) {
    n.idleAnim = { kind: 'stretch', t: 0, dur: 2.4 };
    if (n.distTo(n.game.player) < 20 && n.emoteShow && n.rng.chance(0.5)) n.emoteShow(n.rng.pick(['*yawn*', '*stretch*', 'ahh…']), '#e8e0c8', 1.4);
    return true;
  }
  n.idleAnim = { kind: 'look', t: 0, dur: n.rng.float(3, 6), from: n.dir };
  return true;
}

function step(n, a, dt) {
  const R = n.game.renderer;
  const near = n.distTo(n.game.player) < 20;
  if (a.kind === 'sweep') {
    a.fx = (a.fx ?? 0) - dt;
    if (a.fx > 0) return true;
    a.fx = n.rng.float(0.45, 0.8);
    const fx = n.x + DX[n.dir];
    const fz = n.z + DZ[n.dir];
    const gfx = R && R.gfx;
    const snowy = !!(gfx && gfx.depth && (gfx.depth(fx, fz) > 0 || gfx.depth(n.x, n.z) > 0));
    if (snowy) {
      gfx.clear(n.x, n.z, 0);
      gfx.clear(fx, fz, 0);
    }
    if (near && R && R.emit) R.emit(fx, n.y, fz, { n: snowy ? 4 : 2, color: snowy ? SNOWY : DUST, up: 10, speed: 22, gravity: 60, life: 0.5, oy: 6, shape: 'puff', grow: 1 });
    // (Now and then a step along, sweeping on.)
    if (n.rng.chance(0.12)) n.dir = (n.dir + (n.rng.chance(0.5) ? 1 : 3)) % 4;
    return true;
  }
  if (a.kind === 'gesture') {
    const o = a.with;
    if (!o || o.dead || o.moving || Math.max(Math.abs(o.x - n.x), Math.abs(o.z - n.z)) > 2) {
      n.idleAnim = null;
      return false;
    }
    a.fx = (a.fx ?? a.t) - dt;
    if (a.fx > 0) return true;
    a.fx = n.rng.float(1.0, 2.2);
    n.face(o.x, o.z);
    n.doAction(n.rng.float(0.25, 0.45));
    // (A hand up, the renderer's to draw: see Renderer.drawIdleHands.)
    a.hand = a.t;
    a.side = n.rng.chance(0.5) ? 1 : -1;
    if (near && n.rng.chance(0.45) && n.emoteShow) n.emoteShow(n.rng.pick(CHAT), '#e8e0c8', 1.2);
    return true;
  }
  if (a.kind === 'look') {
    // (This way, that way, and back.)
    a.fx = (a.fx ?? 0.9) - dt;
    if (a.fx > 0) return true;
    a.fx = n.rng.float(0.7, 1.3);
    a.k = ((a.k || 0) + 1) % 4;
    n.dir = a.k === 1 ? (a.from + 1) % 4 : a.k === 3 ? (a.from + 3) % 4 : a.from;
    return true;
  }
  return a.kind === 'lean' || a.kind === 'stretch';
}
