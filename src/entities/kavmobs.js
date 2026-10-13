// (Round 99) The Kavorent's new constructs (laid out by world/deeps/
// kavorent.js, drawn in render/art/kav_mobs.js; the lenses, the live
// cables, the well and the wrecks they work by are in game/kavwork.js),
// each made to work with the old ones:
//   the conductor: a floating pylon that draws an arc between itself and
//     the nearest of its kind, and holds it: whoever crosses the line is
//     shocked and held a moment. Strung to a pair of wardens it walls a
//     doorway; to a golem, the line sweeps the hall as the golem walks; over
//     live cables it burns hotter.
//   the prism: a crystal of the Choir in a cage. A drone's light sent into
//     it comes out of it at you, from somewhere you weren't watching; and a
//     shot (an arrow, a bolt, a spell) that strikes it is turned back on
//     whoever loosed it. Only a blade up close will do.
//   the reclaimer: a low scavenger with a hopper of scrap on its back. It
//     goes to the wreck of whatever of its kind you've broken (or an old
//     husk lying about) and builds a mite out of it; its hopper full, it
//     shrugs off blows. Kill it first, or the fight never ends.
//   the archivist: walks from console to console, keeping the record; it
//     never fights. The memory well's console wakes when it reaches it (or
//     when it falls). Strike it and it sounds the alarm and flees. (Its
//     round: see game/kavwork.js.)
import { BRAINS, COLORS, addHazard, lineTiles, summon } from './monsters.js';
import { FY } from '../world/dungeongen.js';
import { B } from '../world/blocks.js';
import { walkTo } from '../game/minework.js';
import { kavAlarm, kavT, onCables } from '../game/kavwork.js';

const dist = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.z - b.z));
const runOf = (c) => c.game.runAt?.(c.x) || c.game.dungeon || null;
const sees = (game, a, b) => !game.sim || !game.sim.lineOfSight || game.sim.lineOfSight(a.x, a.z, b.x, b.z, a.y + 1);
const allies = (game, c, r, pred) => game.creatures.filter((o) => o !== c && !o.dead && dist(o, c) <= r && pred(o));

// A shot (from more than a couple of paces off) turned back on whoever
// loosed it; a blade up close goes home.
function prismWard(game, c, src, amount) {
  if (src && src !== c && !src.dead && dist(src, c) >= 3) {
    game.renderer.effect?.({ type: 'beam', wx: c.x, wy: c.y + 1, wz: c.z, tx: src.x, ty: src.y + 1, tz: src.z, life: 0.25, oy: -8, color: '#e0fbff', halo: '#5ad8f0', width: 2 });
    game.renderer.floatText(c.x, c.y + 2.4, c.z, 'turned back!', '#a0f4ff');
    game.audio?.play('hum', c);
    c.flareT = 0.4;
    c.doAction?.(0.3);
    game.damage(src, Math.max(1, Math.round(amount * 0.5)), c);
    return 0;
  }
  return amount;
}
// The archivist struck: the alarm, and away.
function archivistStruck(game, c, src, amount) {
  if (src && src !== c && (src.kind === 'player' || src.kind === 'npc') && !c.alarmed) {
    c.alarmed = true;
    c.fleeT = 9;
    c.fleeFrom = src;
    c.doAction?.(0.6);
    c.say?.('INTRUSION. INTRUSION.', 1.8, '#ff8090');
    const run = runOf(c);
    if (run) kavAlarm(run, c, 14);
  }
  return amount;
}

export const KAV_SPECIES = {
  conductor: { light: 5, noHalo: true, name: 'Conductor', hp: 10, dmg: 2, step: 0.36, mode: 'hostile', aggro: 12, floats: true, under: true, construct: true, brain: 'conductor', style: 'sting', drops: [['kav_scrap', 1, 2, 0.8]] },
  prism: { light: 5, noHalo: true, name: 'Prism', hp: 14, dmg: 3, step: 0.46, mode: 'hostile', aggro: 12, floats: true, under: true, construct: true, brain: 'prism', style: 'sting', ward: prismWard, drops: [['kav_scrap', 1, 2, 0.8]] },
  reclaimer: { light: 2, name: 'Reclaimer', hp: 16, dmg: 3, step: 0.42, mode: 'hostile', aggro: 10, under: true, construct: true, brain: 'reclaimer', style: 'snap', drops: [['kav_scrap', 2, 4, 1]] },
  archivist: { light: 3, name: 'Archivist', hp: 12, dmg: 0, step: 0.4, mode: 'passive', under: true, construct: true, ward: archivistStruck, drops: [['kav_scrap', 1, 2, 1], ['old_blueprint', 1, 1, 0.25]] },
};

// Off at its distance, three to five paces: away if you come close, in if
// you stand off.
function keepOff(c, t, lo = 3, hi = 6) {
  if (c.moving) return;
  const d = dist(c, t);
  if (d < lo) {
    const sx = Math.sign(c.x - t.x) || (Math.random() < 0.5 ? 1 : -1);
    const sz = Math.sign(c.z - t.z) || (Math.random() < 0.5 ? 1 : -1);
    c.tryStep(c.x + sx, c.z, c.S.step) || c.tryStep(c.x, c.z + sz, c.S.step);
  } else if (d > hi) {
    const sx = Math.sign(t.x - c.x);
    const sz = Math.sign(t.z - c.z);
    (sx && c.tryStep(c.x + sx, c.z, c.S.step)) || (sz && c.tryStep(c.x, c.z + sz, c.S.step));
  }
}

// The arc, held: drawn crackling between them; once it's caught, whoever
// stands on the line is shocked and held.
function arcTick(c, o, T, dt) {
  const game = c.game;
  const r = game.renderer;
  T.fx = (T.fx || 0) - dt;
  const live = T.t >= T.warm;
  if (T.fx <= 0) {
    T.fx = 0.12;
    r.effect?.({ type: 'beam', wx: c.x, wy: c.y + 1.2, wz: c.z, tx: o.x, ty: o.y + 1, tz: o.z, life: 0.16, oy: -8, color: live ? '#ffffff' : '#7ee4f8', halo: live ? (c.charged ? '#ffe070' : '#5ad8f0') : '#14505e', width: live ? 2 : 1 });
  }
  if (!live) return;
  const tiles = lineTiles(game, c, o, 9);
  const run = runOf(c);
  const party = run && run.partyHere ? run.partyHere() : [game.player];
  for (const v of [...party, ...game.npcs]) {
    if (!v || v.dead || v.arcCd > 0 || Math.abs(v.y - c.y) > 1.5 || !tiles.some((q) => q.x === v.x && q.z === v.z)) continue;
    v.arcCd = 0.9;
    game.damage(v, c.charged ? 3 : 2, c);
    if (v.kind === 'player') v.rootT = Math.max(v.rootT || 0, 0.45);
    v.slowT = Math.max(v.slowT || 0, 1);
    r.floatText(v.x, v.y + 2.2, v.z, 'shocked!', '#a0f4ff');
    r.emit(v.x, v.y + 1, v.z, { n: 8, color: ['#ffffff', '#9ef0ff', '#5ad8f0'], up: 20, speed: 50, life: 0.3, glow: true });
    game.audio?.play('thunder', v);
  }
}

export const KAV_BRAINS = {
  // Holds an arc to the nearest of its kind (a few seconds' warning, then
  // live a while, then let go to gather itself), keeping its distance.
  conductor(c, dt) {
    const game = c.game;
    const t = c.target;
    if (!t || t.dead) {
      c.arc = null;
      return false;
    }
    c.charged = onCables(game, c);
    c.arcCd = (c.arcCd ?? 1) - dt;
    if (c.arc) {
      const A = c.arc;
      A.t += dt;
      if (A.to.dead || dist(c, A.to) > 8 || A.t > A.dur) {
        c.arc = null;
        c.arcCd = 3;
      } else arcTick(c, A.to, A, dt);
    } else if (c.arcCd <= 0) {
      const mate = allies(game, c, 7, (o) => o.S.construct && o.species !== 'conductor' && o.species !== 'archivist' && !o.dormant)
        .filter((o) => sees(game, c, o))
        .sort((a, b) => dist(a, c) - dist(b, c))[0];
      if (mate) {
        c.arc = { to: mate, t: 0, dur: 6, warm: 0.9 };
        c.doAction?.(0.5);
        game.renderer.floatText(c.x, c.y + 2.6, c.z, 'arc!', '#a0f4ff');
        game.audio?.play('charge', c);
      } else c.arcCd = 1;
    }
    keepOff(c, t, 3, 6);
    c.face(t.x, t.z);
    return true;
  },

  // Relays a drone's light: into the prism, and out of it at you.
  prism(c, dt) {
    const game = c.game;
    const t = c.target;
    if (c.flareT > 0) c.flareT -= dt;
    if (!t || t.dead) return false;
    c.relayCd = (c.relayCd ?? 2.5) - dt;
    if (c.relayCd <= 0 && dist(c, t) <= 9 && sees(game, c, t) && !c.windup) {
      const drone = allies(game, c, 7, (o) => o.species === 'drone' && !o.dormant).find((o) => sees(game, o, c));
      if (drone) {
        c.relayCd = 3.8 + Math.random();
        game.renderer.effect?.({ type: 'beam', wx: drone.x, wy: drone.y + 1, wz: drone.z, tx: c.x, ty: c.y + 1, tz: c.z, life: 0.5, oy: -8, color: '#e0fbff', halo: '#5ad8f0', width: 1 });
        const tiles = lineTiles(game, c, t, 10);
        addHazard(game, { by: c, tiles, dur: 0.95, dmg: Math.round(3 * (c.dmgMult || 1)), kind: 'beam', from: { x: c.x, z: c.z }, to: tiles[tiles.length - 1] || t, color: COLORS.kav, beamColor: '#e0fbff', halo: '#5ad8f0', width: 2 });
        c.flareT = 0.95;
        c.doAction?.(0.6);
        c.stunT = 0.8;
        game.audio?.play('hum', c);
        return true;
      }
    }
    keepOff(c, t, 4, 7);
    c.face(t.x, t.z);
    return true;
  },

  // To the nearest wreck, and a mite built out of it; else at you.
  reclaimer(c, dt) {
    const game = c.game;
    const run = runOf(c);
    if (!run) return false;
    const K = kavT(run);
    if (c.carryT > 0) {
      c.carryT -= dt;
      c.armourT = 0.3;
    }
    if (c.build) {
      const w = c.build;
      w.t -= dt;
      if (Math.random() < dt * 14) game.renderer.emit(w.x, FY + 0.4, w.z, { n: 1, color: ['#ffe070', '#ffffff', '#5ad8f0'], up: 24, speed: 30, life: 0.3, glow: true });
      if (w.t > 0) return true;
      c.build = null;
      K.wrecks = K.wrecks.filter((q) => q !== w.wreck);
      if (w.wreck.husk && game.world.getBlock(w.x, FY, w.z) === B.kav_husk) game.world.setBlock(w.x, FY, w.z, B.air);
      const m = summon(game, 'mite', { x: w.x, y: c.y, z: w.z }, 1, { level: c.level, color: ['#ffe070', '#5ad8f0'] });
      if (m) {
        m.dormant = 0;
        m.target = c.target || game.player;
      }
      c.built = (c.built || 0) + 1;
      c.carryT = 4;
      game.renderer.floatText(c.x, c.y + 2.2, c.z, 'a mite!', '#ffe070');
      game.audio?.play('clank', c);
      return true;
    }
    if ((c.built || 0) < 4) {
      const wreck = K.wrecks.filter((q) => !q.claimed || q.claimed === c).filter((q) => dist(q, c) <= 10).sort((a, b) => dist(a, c) - dist(b, c))[0];
      if (wreck) {
        wreck.claimed = c;
        if (dist(c, wreck) <= 1) {
          c.face(wreck.x, wreck.z);
          c.build = { x: wreck.x, z: wreck.z, wreck, t: 2 };
          c.doAction?.(0.5);
          game.renderer.floatText(c.x, c.y + 2.2, c.z, 'reclaiming...', '#c8b888');
          return true;
        }
        if (walkTo(c, wreck, 1)) return true;
        wreck.claimed = null;
      }
    }
    return false;
  },
};

Object.assign(BRAINS, KAV_BRAINS);
