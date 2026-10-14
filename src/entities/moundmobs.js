// (Round 108) What lives in the Hollow Hill beside the fey knights, the
// wisps and the ravens (laid out by world/deeps/mound.js, drawn in
// render/art/mound_mobs.js; the hill-doors, the feast, the ring, the
// stones and the harp are in game/moundwork.js), each made to work with
// the others:
//   the changeling: one of theirs left in a cradle, old-eyed in a child's
//     face. It doesn't fight. It sits and cries; come close and it's into
//     your pack and away with something of yours, laughing, to the nearest
//     hill-door and through it (and the door's twin is somewhere else in
//     the hill). Catch it and it drops what it took: struck down, it's
//     only a carved log.
//   the witch-hare: a hare that's a witch, or a witch that's a hare. It
//     keeps its distance, bounding off when you come close, and hexes you
//     from there: slowed, and marked (the knights' blows land harder on the
//     marked).
//   the hob (the grove's own, here too): peaceful, it goes about the hill
//     lighting the fey lanterns the wisps drink dark. Leave food at an
//     offering and it leaves you something back; strike it and the hill
//     remembers.
import { BRAINS, addHazard } from './monsters.js';
import { B } from '../world/blocks.js';
import { ITEMS } from '../world/items.js';
import { removeItem } from '../game/inventory.js';
import { findPath } from './pathfind.js';
import { runOf, mdT, lantern, blessed } from '../game/moundwork.js';

const dist = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.z - b.z));
const runAt = (c) => runOf(c.game, c.x);
const FEY = ['#d8c0ff', '#a080e0', '#ffffff'];

// The changeling struck down: only a carved log, in a shawl.
function changelingDies(game, c) {
  game.renderer.emit(c.x, c.y + 0.6, c.z, { n: 16, color: ['#8a6a48', '#c8a878', ...FEY], up: 16, speed: 14, life: 0.9 });
  game.renderer.floatText(c.x, c.y + 2, c.z, 'only a carved log, in a shawl', '#d8c8a8');
  if (c.loot) game.ui.msg(`The changeling falls, and it's only a log of alder, carved with a child's face. What it took from you lies beside it: ${ITEMS[c.loot.item]?.name.toLowerCase() || 'your things'}.`, '#d8c8a8');
}

export const MOUND_SPECIES = {
  changeling: {
    name: 'Changeling', hp: 8, dmg: 0, step: 0.24, mode: 'passive', aggro: 0, under: true, calm: 'changeling', onDeath: changelingDies, isle: 'wyrd',
    drops: [['stick', 1, 2, 0.8]],
  },
  witch_hare: {
    name: 'Witch-Hare', hp: 12, dmg: 2, step: 0.2, mode: 'hostile', aggro: 10, under: true, brain: 'witchHare', style: 'bite', isle: 'wyrd',
    drops: [['raw_meat', 1, 1, 0.5], ['herb', 1, 2, 0.4]],
  },
};

// A step toward a spot along a path found for it, round whoever's in the
// way (true if it moved, or is moving).
function walkTo(c, goal) {
  if (c.moving) return true;
  const game = c.game;
  if (!c.wpath || c.wi >= c.wpath.length || c.wgoal !== goal) {
    c.wpath = findPath(game.world, c.x, c.y, c.z, goal.x, c.y, goal.z, { maxNodes: 2500, partial: true, blocked: (x, z) => game.occupiedBySolid(x, c.y, z, c) });
    c.wi = 0;
    c.wgoal = goal;
    if (!c.wpath || !c.wpath.length) return false;
  }
  const [nx, , nz] = c.wpath[c.wi];
  if (c.tryStep(nx, nz, c.S.step)) {
    c.wi++;
    return true;
  }
  // (Something in the way: round it, and the way found again.)
  c.wpath = null;
  for (const [dx, dz] of [[0, 1], [0, -1], [1, 0], [-1, 0]].sort(() => Math.random() - 0.5)) if (c.tryStep(c.x + dx, c.z + dz, c.S.step)) return true;
  return true;
}

// Something out of a pack (not what's in hand, nor worn, nor coin): one of
// it, or half the stack.
function snatch(game, p, c) {
  const held = p.heldItem?.();
  const packs = (p.inv || []).map((s, i) => ({ s, i })).filter(({ s, i }) => s && i !== p.selected && s.item !== held && ITEMS[s.item] && !['armor'].includes(ITEMS[s.item].kind));
  if (!packs.length) return false;
  const { s } = packs[Math.floor(Math.random() * packs.length)];
  const n = Math.max(1, Math.floor(s.count / 2));
  removeItem(p.inv, s.item, n);
  c.loot = { item: s.item, n };
  game.renderer.floatText(p.x, p.y + 2.4, p.z, `snatched: ${n > 1 ? `${n} ` : ''}${ITEMS[s.item].name.toLowerCase()}!`, '#ffd070');
  return true;
}

export const MOUND_BRAINS = {
  // Crying, by the wall; close enough, into your pack and off to a door.
  changeling(c, dt) {
    const game = c.game;
    const run = runAt(c);
    if (!run) return false;
    // (Struck, with nothing of yours: off, as anything would.)
    if (c.fleeT > 0 && !c.loot) return false;
    // (Off through a door with it: it's gone a moment.)
    if (c.goneT > 0) {
      c.goneT -= dt;
      return true;
    }
    if (c.loot && c.runTo) {
      if (dist(c, c.runTo.front) <= 0) {
        // Through the door, and out of its twin.
        const twin = run.data.hilldoors?.[c.runTo.to];
        game.renderer.emit(c.x, c.y + 1, c.z, { n: 14, color: FEY, up: 20, speed: 20, life: 0.6, glow: true });
        game.renderer.floatText(c.x, c.y + 2.2, c.z, 'through the door, laughing', '#d8c0ff');
        if (twin) {
          c.teleport(twin.front.x, c.y, twin.front.z);
          c.home = { x: twin.front.x, y: c.y, z: twin.front.z };
        }
        c.runTo = null;
        c.goneT = 1.5;
        c.thinkT = 3;
        return true;
      }
      if (!walkTo(c, c.runTo.front)) c.runTo = null;
      return true;
    }
    if (c.loot) {
      // (Got away with it: sitting with its prize, cackling, till you find it.)
      c.thinkT = (c.thinkT ?? 0) - dt;
      if (c.thinkT <= 0) {
        c.thinkT = 3 + Math.random() * 3;
        c.say?.(['Mine, mine.', 'Hee hee.', 'Finders keepers!'][Math.floor(Math.random() * 3)], 1.6, '#d8c0ff');
      }
      const p = game.nearestThreatTo?.(c, 2);
      if (p) return MOUND_BRAINS.changelingRun(c, run);
      return true;
    }
    // Crying.
    c.cryT = (c.cryT ?? 2) - dt;
    if (c.cryT <= 0) {
      c.cryT = 4 + Math.random() * 4;
      game.renderer.floatText(c.x, c.y + 1.8, c.z, 'a child, crying', '#c8c0d8');
    }
    for (const p of game.everyone()) {
      if (!p || p.dead || p.kind !== 'player' || dist(p, c) > 1 || Math.abs(p.y - c.y) > 1) continue;
      if (!snatch(game, p, c)) continue;
      c.say?.(['Hee hee hee!', 'Thank you kindly!', 'For the king!'][Math.floor(Math.random() * 3)], 1.8, '#d8c0ff');
      game.audio?.play('chime', c);
      const T = mdT(run);
      if (!T.told.changeling) {
        T.told.changeling = true;
        game.ui.msg('The crying child is up, and into your pack, and away: that is no child. (A changeling: it\'ll make for a door in the hill. Catch it before it gets there.)', '#d8c0ff', true);
      }
      return MOUND_BRAINS.changelingRun(c, run);
    }
    return true;
  },
  // To the nearest hill-door (not the one it came out of).
  changelingRun(c, run) {
    let best = null;
    let bd = 99;
    for (const q of run.data.hilldoors || []) {
      const d = dist(q.front, c);
      if (d < bd && d > 0) {
        bd = d;
        best = q;
      }
    }
    c.runTo = best;
    c.wpath = null;
    if (!best) {
      c.fleeT = 6;
      c.fleeFrom = c.game.player;
    }
    return true;
  },

  // Off when you come close; from three to six paces off, the hex.
  witchHare(c, dt) {
    const game = c.game;
    const t = c.target;
    c.hexCd = (c.hexCd ?? 2 + Math.random() * 2) - dt;
    if (!t || t.dead || c.windup) return false;
    if (c.moving) return true;
    const d = dist(c, t);
    c.boundCd = (c.boundCd ?? 0) - dt;
    if (d <= 2 && c.boundCd <= 0) {
      // Bounding off, two steps at a time.
      const dx = Math.sign(c.x - t.x) || (Math.random() < 0.5 ? 1 : -1);
      const dz = Math.sign(c.z - t.z) || (Math.random() < 0.5 ? 1 : -1);
      for (const [ox, oz] of [[dx, dz], [dx, 0], [0, dz], [dz, dx], [-dz, -dx]]) {
        if (c.tryStep(c.x + ox, c.z + oz, c.S.step)) {
          c.boundCd = 0.6;
          return true;
        }
      }
      c.boundCd = 1.2;
      return false;
    }
    if (d > 7) return false;
    if (c.hexCd > 0 || d < 3 || Math.abs(t.y - c.y) > 1) return d >= 3;
    if (!game.sim.lineOfSight(c.x, c.z, t.x, t.z, c.y + 1)) return false;
    c.hexCd = 5 + Math.random() * 2;
    c.face(t.x, t.z);
    c.doAction?.(0.6);
    game.audio?.play('whisper', c);
    game.renderer.floatText(c.x, c.y + 1.8, c.z, 'it thumps, three times', '#d8c0ff');
    addHazard(game, {
      by: c, tiles: [{ x: t.x, z: t.z }], y: t.y, dur: 0.85, dmg: 1, kind: 'erupt', color: [190, 150, 255],
      onFire: (g, h, hit) => {
        for (const e of hit) {
          e.slowT = Math.max(e.slowT || 0, 3);
          // (Not with the hob's luck on you: see moundwork.offer.)
          if (e.kind === 'player' && blessed(runOf(g, e.x))) {
            g.renderer.floatText(e.x, e.y + 2.4, e.z, 'the hex slides off', '#c8e890');
            continue;
          }
          e.markT = Math.max(e.markT || 0, 5);
          g.renderer.floatText(e.x, e.y + 2.4, e.z, 'hexed!', '#d8c0ff');
          g.renderer.emit(e.x, e.y + 1, e.z, { n: 14, color: FEY, up: 14, speed: 12, life: 0.9, glow: true });
          const run = runOf(g, e.x);
          const T = run && mdT(run);
          if (T && !T.told.hex) {
            T.told.hex = true;
            g.ui.msg('The hare\'s hex settles on you: slow, and marked. (The marked are hurt the worse by every blow; the knights know it.)', '#d8c0ff', true);
          }
        }
      },
    });
    return true;
  },

  // (Round 108) The hob in the hill: off to light the lanterns the wisps
  // have drunk dark. (Anywhere else, its own business.)
  hob(c, dt) {
    const run = runAt(c);
    if (!run || run.rec?.type !== 'mound' || c.wronged) return false;
    const w = c.game.world;
    if (c.moving) return true;
    const dark = (q) => w.getBlock(q.x, c.y, q.z) === B.hh_lantern && !w.getState(q.x, c.y, q.z);
    if (c.lamp && !dark(c.lamp)) c.lamp = null;
    if (!c.lamp) {
      c.lookT = (c.lookT ?? 0) - dt;
      if (c.lookT > 0) return false;
      c.lookT = 2;
      let bd = 14;
      for (const q of mdT(run).lanterns) {
        const d = dist(q, c);
        if (d < bd && dark(q)) {
          bd = d;
          c.lamp = q;
        }
      }
      if (!c.lamp) return false;
    }
    if (dist(c, c.lamp) <= 1) {
      c.face(c.lamp.x, c.lamp.z);
      c.lightT = (c.lightT || 0) + dt;
      if (c.lightT < 1.2) return true;
      c.lightT = 0;
      lantern(run, c.lamp, true, c);
      c.lamp = null;
      return true;
    }
    if (!walkTo(c, c.lamp)) c.lamp = null;
    return true;
  },
};
Object.assign(BRAINS, MOUND_BRAINS);
