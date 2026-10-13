// (Round 96) The mine's own (laid out by world/deeps/mine.js, drawn in
// render/art/mine_mobs.js; what they set off is in game/minework.js), each
// made to fight alongside the others, and often enough against them:
//   the lost miner: one of the shift that never came up, still at the
//     face with pick and lamp. It knocks for the rest of its shift when it
//     sees you (all of them about it up and coming), or runs to ring the
//     shaft bell (every one on the floor). Its lamp lights any firedamp it
//     walks into, with you in it or not; dropped when it falls, the lamp
//     sets the floor alight where it lies.
//   the blast beetle: a fat black beetle full of the powder it's been
//     eating. Close up to you it lights itself and goes off. Strike it and
//     it curls up, its fuse lit, and rolls away from the blow: bowled into
//     the dead, it does to them what it would have done to you. It goes
//     for a naked flame from further off than anything else.
//   the firedamp: the gas, drifting of itself, a thing like a held breath.
//     It trails firedamp behind it, and its touch chokes; burst, it leaves
//     a cloud of firedamp where it was. Any flame near it (a torch, a lost
//     miner's lamp, a beetle going up) and it goes off, and everything it
//     trailed with it.
//   the knocker: one of the little grey folk who were friends of the
//     miners. It knocks where the rock is hollow and where the roof's bad
//     (see minework.js). Hurt one and the roof comes down on you.
import { BRAINS, addHazard, areaTiles, groundFire } from './monsters.js';
import { knock, STYLES } from '../game/combat.js';
import { gasAt, igniteGas, leaveGas, flare, ringBell, bellNear, walkTo, knockerHurt, nakedFlame } from '../game/minework.js';

const dist = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.z - b.z));
const runOf = (c) => c.game.runAt?.(c.x) || c.game.dungeon || null;
const holdsFlame = nakedFlame;

// A lost miner down: its lamp falls, and the floor where it lies catches.
function lampDown(game, c) {
  if (gasAt(game, c.x, c.y, c.z)) {
    igniteGas(game, c.x, c.y, c.z, 0.4);
    return;
  }
  game.renderer.emit(c.x, c.y + 0.4, c.z, { n: 8, color: ['#ffe070', '#ff9030'], up: 20, speed: 20, life: 0.4, glow: true });
  groundFire(game, c.x, c.z, c.y, null, true, 0);
}

// A blast beetle struck: it curls up, its fuse lit, and rolls off away
// from the blow (the blow itself turned off its shell).
function beetleWard(game, c, src, amount) {
  if (src === c || c.armed) return amount;
  // (Caught in another's blast: it goes up too, a moment after.)
  if (!src) {
    if (amount > 0) armBeetle(game, c, 0.35);
    return 0;
  }
  knock(game, src, c, 3);
  armBeetle(game, c, 1.3);
  game.renderer.floatText(c.x, c.y + 1.6, c.z, 'it curls up, fizzing', '#ffb050');
  if (src.kind === 'player' && !game.toldBeetle) {
    game.toldBeetle = true;
    game.ui.msg('The beetle curls up under the blow and rolls away, fizzing. Hit one toward the others.', '#ffb050', true);
  }
  return 0;
}
export function armBeetle(game, c, fuse = 1.1) {
  if (c.armed || c.dead) return;
  c.armed = true;
  c.stunT = fuse + 0.2;
  game.audio?.play('fuse', c);
  addHazard(game, {
    tiles: areaTiles(c.x, c.z, 1), y: c.y, dur: fuse, dmg: Math.round(c.S.dmg * (c.dmgMult || 1)), burn: 1, knock: 2, kind: 'blast', color: [255, 150, 60], trap: true, keep: true,
    onFire: (g) => {
      g.renderer.effect?.({ type: 'blast', wx: c.x, wy: c.y, wz: c.z, r1: 26, life: 0.6, oy: 2 });
      g.renderer.emit(c.x, c.y + 1, c.z, { n: 18, color: ['#ff9030', '#ffe070', '#2a2420', '#5a4a30'], up: 50, speed: 70, gravity: 120, life: 0.7 });
      g.audio?.play('boom', c);
      g.shake = Math.min(1.4, (g.shake || 0) + 0.5);
      g.lightDirty = true;
      c.sporeless = true;
      if (!c.dead) g.kill(c, null);
    },
  });
}

// The firedamp burst (not by fire): its gas left hanging where it was.
function damBurst(game, c) {
  if (c.burnt || c.flaring) return;
  let n = 0;
  for (const [dx, dz] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) if (leaveGas(game, c.x + dx, c.y, c.z + dz)) n++;
  if (n) {
    game.renderer.emit(c.x, c.y + 1, c.z, { n: 14, color: ['#a8c890', '#c8e0b0', '#809870'], up: 10, speed: 30, life: 1.2, shape: 'puff', grow: 2 });
    game.renderer.floatText(c.x, c.y + 2, c.z, 'it bursts into gas', '#a8c890');
    game.audio?.play('puff', c);
  }
}

export const MINE_SPECIES = {
  lost_miner: {
    name: 'Lost Miner', hp: 16, dmg: 3, step: 0.44, mode: 'hostile', aggro: 9, under: true, undead: true, light: 5, brain: 'lostMiner', style: 'axe', onDeath: lampDown,
    drops: [['iron_ore', 1, 2, 0.5], ['coal', 1, 2, 0.4], ['old_coin', 1, 2, 0.3]],
  },
  blast_beetle: { name: 'Blast Beetle', hp: 6, dmg: 7, step: 0.3, mode: 'hostile', aggro: 8, under: true, brain: 'blastBeetle', style: 'bite', ward: beetleWard, drops: [['dynamite', 1, 1, 0.2]] },
  firedamp: {
    name: 'Firedamp', hp: 8, dmg: 1, step: 0.6, mode: 'hostile', aggro: 8, under: true, floats: true, light: 2, coldLight: true, noHalo: true, brain: 'firedamp', style: 'sting', onDeath: damBurst,
    drops: [],
  },
  knocker: { name: 'Knocker', hp: 10, dmg: 0, step: 0.3, mode: 'passive', under: true, ward: (game, c, src) => knockerHurt(game, c, src), drops: [] },
};

export const MINE_BRAINS = {
  // Knocking for its shift, or off to ring the bell; walking where the bell
  // rang; and its lamp in the firedamp.
  lostMiner(c, dt) {
    const game = c.game;
    const run = runOf(c);
    if (gasAt(game, c.x, c.y, c.z) && !c.moving) {
      c.lampT = (c.lampT || 0) + dt;
      if (c.lampT > 0.25) {
        game.renderer.floatText(c.x, c.y + 2.2, c.z, 'its lamp flares blue', '#80c0ff');
        igniteGas(game, c.x, c.y, c.z, 0.45);
      }
    } else c.lampT = 0;
    const t = c.target;
    if (!t || t.dead) {
      // (Called by the bell: there, and waiting.)
      if (c.lure && walkTo(c, c.lure, 1)) return true;
      return false;
    }
    c.lure = null;
    if (!c.signalled && run) {
      c.signalled = true;
      // (One signal for the shift: those about it don't each give it.)
      for (const o of run.creatures()) if (o !== c && o.species === 'lost_miner' && dist(o, c) <= 10) o.signalled = true;
      const bell = run.data && bellNear(run, c, 9);
      if (bell && !(run.mineT && run.mineT.bellT > 0) && !run.bellRung) {
        c.toBell = bell;
        game.renderer.floatText(c.x, c.y + 2.2, c.z, 'it runs for the bell!', '#ffb070');
      } else {
        // Three knocks on the rock with its pick: the shift's signal.
        c.strike = { t: 0, dur: 0.5, st: STYLES.axe };
        game.audio?.play('knock', c);
        game.renderer.floatText(c.x, c.y + 2.2, c.z, 'knock - knock - knock', '#d8b080');
        for (const o of run.creatures()) {
          if (o === c || o.dead || o.species !== 'lost_miner' || !o.dormant || o.waiting || dist(o, c) > 10) continue;
          run.wake(o);
          o.target = t;
        }
      }
    }
    if (c.toBell) {
      if (walkTo(c, c.toBell, 1)) return true;
      if (dist(c, c.toBell) <= 1) {
        c.face(c.toBell.x, c.toBell.z);
        if (ringBell(run, c.toBell, c)) run.bellRung = true;
      }
      c.toBell = null;
      return true;
    }
    return false;
  },
  // Close up: lit, and gone. A naked flame draws it from further off.
  blastBeetle(c, dt) {
    const game = c.game;
    if (c.armed) return true;
    if (!c.target || c.target.dead) {
      const lit = game.everyone().find((p) => !p.dead && holdsFlame(p) && dist(p, c) <= 14 && Math.abs(p.y - c.y) <= 2);
      if (lit) c.target = lit;
    }
    const t = c.target;
    if (t && !t.dead && dist(c, t) <= 1 && Math.abs(t.y - c.y) <= 1) {
      c.face(t.x, t.z);
      armBeetle(game, c, 1.1);
      game.renderer.floatText(c.x, c.y + 1.6, c.z, 'hiss!', '#ffb050');
      game.audio?.play('hiss', c);
      return true;
    }
    return false;
  },
  // Drifting at you, a trail of firedamp behind it; its touch chokes; a
  // flame near it, and it goes up.
  firedamp(c, dt) {
    const game = c.game;
    if (c.flaring) return true;
    // (A flame close: up it goes. A torch, a lost miner's lamp.)
    const flame = [...game.everyone(), ...game.creatures].find((e) => e && !e.dead && e !== c && Math.abs(e.y - c.y) <= 1 && dist(e, c) <= 1 && (holdsFlame(e) || e.species === 'lost_miner'));
    if (flame) {
      flare(game, c, 0.45);
      return true;
    }
    // (Its trail.)
    c.trailT = (c.trailT ?? 1) - dt;
    if (c.trailT <= 0 && !c.moving) {
      c.trailT = 1.6;
      leaveGas(game, c.x, c.y, c.z);
    }
    const t = c.target;
    if (!t || t.dead) return false;
    if (dist(c, t) <= 1 && Math.abs(t.y - c.y) <= 1) {
      c.face(t.x, t.z);
      if (c.attackCd <= 0) {
        c.attackCd = 1.6;
        game.damage(t, Math.max(1, Math.round(1 * (c.dmgMult || 1))), c);
        t.slowT = Math.max(t.slowT || 0, 1.5);
        if (t.kind === 'player') t.stamina = Math.max(0, (t.stamina || 0) - 3);
        game.renderer.floatText(t.x, t.y + 2.2, t.z, 'choking', '#a8c890');
        game.renderer.emit(t.x, t.y + 1.4, t.z, { n: 6, color: ['#a8c890', '#c8e0b0'], up: 6, speed: 10, life: 0.8, shape: 'puff' });
        game.audio?.play('puff', t);
      }
      return true;
    }
    return false;
  },
};

Object.assign(BRAINS, MINE_BRAINS);
