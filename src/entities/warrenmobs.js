// (Round 107) What lives in the Deep Warren beside the tunnelers, the
// badgers, the rats and the cave moths (laid out by world/deeps/warren.js,
// drawn in render/art/warren_mobs.js; the noise, the lantern pods, the
// hollow floor, the pantry and the stopper are in game/warrenwork.js), each
// made to work with the others:
//   the gloom moth: a great dun moth come up out of the old tunnels, drawn
//     to light. It flies to the nearest lit lantern pod and settles on it,
//     and the pod goes dark under it. It doesn't fight; struck, it bursts
//     in a cloud of its dust, and whoever's in it is blinded a moment. (The
//     dark is nothing to the tunnelers: they're blind already.)
//   the larder grub: a fat pale grub of the stores, peaceful and slow. A
//     tunneler that comes by one stops and eats it, and is mended by it
//     (and busy a moment).
//   the rootbound: one of the delvers, taken by the roots, wrapped in
//     them. It creeps; it sends roots along the floor at you that come up
//     where you stand and hold you fast. Held, the tunnelers come up under
//     you.
import { BRAINS, addHazard } from './monsters.js';
import { B } from '../world/blocks.js';
import { ink } from '../game/afflict.js';
import { runOf, snuff } from '../game/warrenwork.js';

const dist = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.z - b.z));
const runAt = (c) => runOf(c.game, c.x);
const DUST = ['#8a7a5a', '#b0a080', '#d0c4a0'];

// The moth struck: it bursts, its dust over whoever's by it.
function mothStruck(game, c, src, amount) {
  if (c.burst) return amount;
  if (amount >= c.hp || !c.dustNote) {
    c.dustNote = true;
    for (const p of game.everyone()) if (p && !p.dead && dist(p, c) <= 1) ink(game, p, 1.8);
    game.renderer.emit(c.x, c.y + 1, c.z, { n: 28, color: DUST, up: 20, speed: 30, gravity: -6, life: 1.2, shape: 'puff' });
    game.renderer.floatText(c.x, c.y + 2.2, c.z, 'a cloud of dust!', '#d0c4a0');
  }
  return amount;
}

export const WARREN_SPECIES = {
  gloom_moth: {
    name: 'Gloom Moth', hp: 6, dmg: 0, step: 0.34, mode: 'passive', aggro: 0, under: true, floats: true, brain: 'gloomMoth', calm: 'gloomMoth', ward: mothStruck, isle: 'hollowmark',
    drops: [['moth_dust', 1, 2, 0.8]],
  },
  larder_grub: {
    name: 'Larder Grub', hp: 5, dmg: 0, step: 1.4, mode: 'passive', aggro: 0, under: true, isle: 'hollowmark',
    drops: [['raw_meat', 1, 1, 0.4]],
  },
  rootbound: {
    name: 'Rootbound', hp: 20, dmg: 3, step: 0.8, mode: 'hostile', aggro: 8, under: true, undead: true, brain: 'rootbound', style: 'bash', isle: 'hollowmark',
    drops: [['glowberries', 1, 2, 0.4], ['old_coin', 1, 2, 0.3]],
  },
};

export const WARREN_BRAINS = {
  // To the nearest lit pod, and on it, till it's dark; then the next.
  gloomMoth(c, dt) {
    const game = c.game;
    const run = runAt(c);
    if (!run || c.moving) return true;
    const w = game.world;
    const lit = (q) => w.getBlock(q.x, c.y, q.z) === B.wr_pod && w.getState(q.x, c.y, q.z);
    if (!c.pod || !lit(c.pod)) {
      c.pod = null;
      let best = 99;
      for (const q of run.data.pods || []) {
        const d = dist(q, c);
        if (d < best && d <= 12 && lit(q)) {
          best = d;
          c.pod = q;
        }
      }
      c.settleT = 0;
    }
    if (!c.pod) {
      // (Nothing lit: it drifts about.)
      c.thinkT = (c.thinkT ?? 0) - dt;
      if (c.thinkT <= 0) {
        c.thinkT = 1 + Math.random() * 2;
        const [dx, dz] = [[1, 0], [-1, 0], [0, 1], [0, -1]][Math.floor(Math.random() * 4)];
        c.tryStep(c.x + dx, c.z + dz, c.S.step * 1.6);
      }
      return true;
    }
    const d = dist(c.pod, c);
    if (d > 0) {
      // (Straight at it, over whatever's in the way.)
      const sx = Math.sign(c.pod.x - c.x);
      const sz = Math.sign(c.pod.z - c.z);
      if (!(sx && c.tryStep(c.x + sx, c.z, c.S.step)) && !(sz && c.tryStep(c.x, c.z + sz, c.S.step))) c.settleT += dt;
      if (d > 1) return true;
    }
    c.settleT = (c.settleT || 0) + dt;
    c.face(c.pod.x, c.pod.z);
    if (c.settleT < 1.4) return true;
    snuff(run, c.pod, c);
    c.pod = null;
    return true;
  },

  // Creeping along; and at whoever's in reach of its roots (five paces),
  // roots up out of the floor where they stand.
  rootbound(c, dt) {
    const game = c.game;
    const t = c.target;
    c.rootCd = (c.rootCd ?? 2) - dt;
    if (!t || t.dead || c.windup || c.rootCd > 0) return false;
    const d = dist(c, t);
    if (d < 2 || d > 5 || Math.abs(t.y - c.y) > 1) return false;
    c.rootCd = 5 + Math.random() * 2;
    c.face(t.x, t.z);
    c.doAction?.(0.6);
    const at = { x: t.x, z: t.z };
    // (The roots run along the floor from it to you: shown coming.)
    for (let k = 1; k < d; k++) {
      const q = { x: Math.round(c.x + ((at.x - c.x) * k) / d), z: Math.round(c.z + ((at.z - c.z) * k) / d) };
      game.renderer.emit(q.x, c.y + 0.1, q.z, { n: 3, color: ['#a8966e', '#7a6a4a'], up: 4, speed: 6, life: 0.6 });
    }
    addHazard(game, {
      by: c, tiles: [at], y: t.y, dur: 0.9, dmg: 2, kind: 'erupt', color: [168, 150, 110],
      onFire: (g, h, hit) => {
        for (const e of hit) {
          if (e.kind === 'player') e.rootT = Math.max(e.rootT || 0, 1.6);
          else e.stunT = Math.max(e.stunT || 0, 1.6);
          g.renderer.floatText(e.x, e.y + 2.4, e.z, 'the roots have you!', '#c8b890');
          g.renderer.emit(e.x, e.y + 0.4, e.z, { n: 12, color: ['#a8966e', '#d0c298', '#7a6a4a'], up: 20, speed: 16, life: 0.7 });
        }
      },
    });
    return true;
  },
};
Object.assign(BRAINS, WARREN_BRAINS);

// The tunnelers stop for a grub: a tunneler that's eating is busy at it a
// moment (see warrenwork.feed). (Put about the tunneler's own way once
// every kind's is in place.)
function feeding() {
  const tunneler = BRAINS.tunneler;
  if (!tunneler || tunneler.feeds) return;
  BRAINS.tunneler = function (c, dt) {
    if (c.feedT > 0) {
      c.feedT -= dt;
      return true;
    }
    return tunneler(c, dt);
  };
  BRAINS.tunneler.feeds = true;
}
Promise.resolve().then(feeding);
