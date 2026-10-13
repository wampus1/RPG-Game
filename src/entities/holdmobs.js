// (Round 98) The holdout's own (laid out by world/deeps/holdout.js, drawn in
// render/art/hold_mobs.js; the alarm, the traps and the cells they work by
// are in game/holdwork.js), each made to fight alongside the rest of the
// gang:
//   the lookout: up on the scaffolds with a spyglass. It sees you far off
//     and marks you: while you're marked, the archers' arrows find you and
//     bite deeper. The first time it sees you it sounds its horn (the whole
//     place hears). It can't come down; kill it, and the mark's gone.
//   the houndmaster: keeps behind the dogs. His whistle sends them in to
//     latch on and hold you for the knives; struck, he whips them into a
//     frenzy. Killed, his dogs go wild.
//   the war hound: a mastiff, fast. Set on by its master it lunges and
//     latches (you're held a moment). Its master dead, it goes for whatever
//     is nearest, the gang as soon as you.
//   the bruiser: huge, a caravan's door for a shield (it turns most of what
//     comes at it from the front). It shoulders into you and throws you
//     back; and it kicks the powder kegs about the place rolling at you
//     (they burst on whatever they meet: the gang's own as soon as you).
//   the captive: shackled in the cells, never fights. Let out, they follow
//     you; the gang goes for them first. Bring them to the way you came in
//     and they're away, and tell you where the stash is.
import { BRAINS, kegBlast } from './monsters.js';
import { knock } from '../game/combat.js';
import { B } from '../world/blocks.js';
import { FY } from '../world/dungeongen.js';
import { walkTo } from '../game/minework.js';
import { alarm, rollKeg, lineClear } from '../game/holdwork.js';

const dist = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.z - b.z));
const runOf = (c) => c.game.runAt?.(c.x) || c.game.dungeon || null;

// The houndmaster struck: he takes it out on the dogs (they frenzy).
function houndmasterStruck(game, c, src, amount) {
  if (src && src !== c && amount > 0 && !(c.whipT > 0)) {
    c.whipT = 6;
    c.say?.(c.rng.pick(['Get IN there!', 'Hup! HUP!', 'Go on, you curs!']), 1.6, '#ff9070');
    for (const h of houndsOf(c)) {
      h.frenzyT = 6;
      h.hasteT = Math.max(h.hasteT || 0, 6);
      game.renderer.floatText(h.x, h.y + 2, h.z, 'frenzied!', '#ff6050');
    }
    game.audio?.play('whip', c);
  }
  return amount;
}
// The captive: never struck down by a stray blow of yours.
function captiveStruck(game, c, src, amount) {
  if (src && src.kind === 'player') {
    c.say?.('Please! I\'m not one of them!', 1.6, '#e0d0b0');
    return 0;
  }
  return amount;
}

export const HOLD_SPECIES = {
  lookout: {
    name: 'Holdout Lookout', hp: 9, dmg: 1, step: 0.3, mode: 'hostile', aggro: 14, under: true, bandit: true, brain: 'lookout', style: 'dagger',
    drops: [['coin', 1, 4, 0.7], ['spyglass', 1, 1, 0.06], ['arrow', 2, 5, 0.4]],
  },
  houndmaster: {
    name: 'Houndmaster', hp: 18, dmg: 3, step: 0.32, mode: 'hostile', aggro: 10, under: true, bandit: true, brain: 'houndmaster', style: 'flail', ward: houndmasterStruck,
    drops: [['coin', 2, 6, 0.8], ['leather', 1, 2, 0.4], ['raw_meat', 1, 2, 0.5]],
  },
  war_hound: { name: 'War Hound', hp: 12, dmg: 3, step: 0.22, mode: 'hostile', aggro: 10, under: true, beast: true, brain: 'war_hound', style: 'bite', drops: [['raw_meat', 1, 2, 0.6], ['leather', 1, 1, 0.3]] },
  bruiser: {
    name: 'Bruiser', hp: 34, dmg: 6, step: 0.5, mode: 'hostile', aggro: 9, under: true, bandit: true, heavy: true, shieldBlock: 0.6, brain: 'bruiser', style: 'slam',
    drops: [['coin', 3, 9, 0.9], ['iron_ingot', 1, 1, 0.3], ['planks', 1, 3, 0.5]],
  },
  captive: { name: 'Captive', hp: 10, dmg: 0, step: 0.3, mode: 'passive', under: true, ward: captiveStruck, drops: [] },
};

// A houndmaster's hounds (his group's, or all of them near him).
export function houndsOf(c) {
  const run = runOf(c);
  if (!run) return [];
  return run.creatures().filter((h) => h.species === 'war_hound' && !h.dead && !h.wild && (h.master === c || (!h.master && c.group && h.group === c.group)));
}

export const HOLD_BRAINS = {
  // Up on its perch: scanning; seeing you, it marks you for the archers,
  // and (the first time) sounds its horn. Only if you're on it does it
  // fight, and badly.
  lookout(c, dt) {
    const game = c.game;
    const run = runOf(c);
    const t = c.target;
    c.thinkT = 9;
    if (!t || t.dead) return true;
    const d = dist(c, t);
    if (d <= 1 && Math.abs(t.y - c.y) <= 1) return false;
    if (d > 14 || !game.sim.lineOfSight(c.x, c.z, t.x, t.z, c.y + 1)) return true;
    c.face(t.x, t.z);
    if (!(t.markedT > 0)) {
      game.renderer.floatText(c.x, c.y + 2.6, c.z, 'there! THERE!', '#ff7060');
      c.doAction?.(0.4);
    }
    t.markedT = 1.5;
    t.markedBy = c;
    if (!c.horned && run) {
      c.horned = true;
      c.horn = 1.2;
      c.say?.('Intruder! To arms!', 2, '#ff9070');
      game.audio?.play('horn', c);
      alarm(run, c, c, 'horn', 20);
    }
    return true;
  },
  // Behind the dogs, three paces back; the whistle when one's near you.
  houndmaster(c, dt) {
    const game = c.game;
    const t = c.target;
    if (c.whipT > 0) c.whipT -= dt;
    if (!t || t.dead) return false;
    const hounds = houndsOf(c);
    if (!hounds.length) return false;
    for (const h of hounds) h.master = c;
    c.whistleT = (c.whistleT ?? 1.5) - dt;
    const close = hounds.filter((h) => dist(h, t) <= 4);
    if (c.whistleT <= 0 && close.length) {
      c.whistleT = 5 + Math.random() * 2;
      c.doAction?.(0.4);
      game.renderer.floatText(c.x, c.y + 2.6, c.z, '*whistle*', '#f0f0d0');
      game.audio?.play('chirp', c);
      for (const h of close) {
        h.lungeT = 1.5;
        h.target = t;
      }
      return true;
    }
    // (Keeps his distance while there are dogs between.)
    const d = dist(c, t);
    if (d < 3 && !c.moving) {
      const dx = Math.sign(c.x - t.x) || 1;
      const dz = Math.sign(c.z - t.z);
      if (c.tryStep(c.x + dx, c.z + dz, c.S.step) || c.tryStep(c.x + dx, c.z, c.S.step)) return true;
    }
    if (d <= 5) {
      c.face(t.x, t.z);
      return true;
    }
    return false;
  },
  // Set on, it lunges and latches; latched, it holds; wild, it goes for
  // whatever's nearest.
  war_hound(c, dt) {
    const game = c.game;
    const run = runOf(c);
    if (c.frenzyT > 0) c.frenzyT -= dt;
    if (c.holding) {
      c.holding.t -= dt;
      const v = c.holding.v;
      if (c.holding.t <= 0 || v.dead || dist(c, v) > 1) {
        c.holding = null;
        return false;
      }
      c.face(v.x, v.z);
      return true;
    }
    if (c.wild && run) {
      // (Whatever's nearest, the gang as soon as you.)
      const near = [...run.creatures().filter((o) => o !== c && !o.dead && !o.isBoss && o.species !== 'war_hound'), ...run.partyHere()].filter((o) => !o.dead && dist(o, c) <= 8);
      near.sort((a, b) => dist(a, c) - dist(b, c));
      if (near[0]) c.target = near[0];
      c.hasteT = Math.max(c.hasteT || 0, 0.5);
      return false;
    }
    const t = c.target;
    if (!t || t.dead) return false;
    if (c.lungeT > 0) {
      c.lungeT -= dt;
      c.hasteT = Math.max(c.hasteT || 0, 0.3);
      if (dist(c, t) <= 1 && Math.abs(t.y - c.y) <= 1) {
        c.lungeT = 0;
        c.face(t.x, t.z);
        c.doAction?.(0.4);
        game.damage(t, Math.max(1, Math.round(c.S.dmg * (c.dmgMult || 1))), c);
        // Latched: held fast a moment.
        if (t.kind === 'player') t.rootT = Math.max(t.rootT || 0, 1.1);
        else t.slowT = Math.max(t.slowT || 0, 1.1);
        c.holding = { v: t, t: 1.1 };
        game.renderer.floatText(t.x, t.y + 2.2, t.z, 'latched on!', '#ff8060');
        game.audio?.play('bite', c);
        return true;
      }
      return false;
    }
    return false;
  },
  // A kick to a keg by him, rolling at you; a shoulder-charge; else the
  // door and the fist.
  bruiser(c, dt) {
    const game = c.game;
    const run = runOf(c);
    const t = c.target;
    if (!t || t.dead || !run) return false;
    // The charge, under way: a pace at a time, fast; whoever's in the way
    // is thrown back.
    if (c.charge) {
      const ch = c.charge;
      ch.t -= dt;
      if (ch.t > 0) return true;
      ch.t = 0.09;
      ch.n--;
      const v = [...run.partyHere(), ...run.creatures()].find((o) => o !== c && !o.dead && o.x === c.x + ch.dx && o.z === c.z + ch.dz && Math.abs(o.y - c.y) <= 1);
      if (v) {
        c.charge = null;
        game.damage(v, Math.max(1, Math.round(c.S.dmg * 1.4 * (c.dmgMult || 1))), c);
        knock(game, c, v, 2);
        game.shake = Math.min(1.2, (game.shake || 0) + 0.5);
        game.renderer.floatText(v.x, v.y + 2.2, v.z, 'flattened!', '#ff9060');
        game.audio?.play('thud', v);
        c.attackCd = 1.4;
        return true;
      }
      if (ch.n <= 0 || !c.tryStep(c.x + ch.dx, c.z + ch.dz, 0.09)) {
        c.charge = null;
        c.stunT = 0.6;
      }
      return true;
    }
    c.kickT = (c.kickT ?? 2) - dt;
    c.chargeT = (c.chargeT ?? 4) - dt;
    const d = dist(c, t);
    // A keg next to him, between him and you: kicked rolling.
    if (c.kickT <= 0 && d >= 2 && d <= 8) {
      for (const [ox, oz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const kx = c.x + ox;
        const kz = c.z + oz;
        if (game.world.getBlock(kx, FY, kz) !== B.powder_keg) continue;
        if (ox * (t.x - c.x) + oz * (t.z - c.z) <= 0) continue;
        c.kickT = 6;
        c.face(kx, kz);
        c.doAction?.(0.4);
        c.say?.('Catch!', 1.2, '#ffb070');
        rollKeg(run, kx, kz, Math.sign(t.x - kx), Math.sign(t.z - kz), c);
        return true;
      }
    }
    // A charge, in a straight line at you.
    if (c.chargeT <= 0 && d >= 3 && d <= 6 && (t.x === c.x || t.z === c.z) && lineClear(run, c, t)) {
      c.chargeT = 7;
      c.charge = { dx: Math.sign(t.x - c.x), dz: Math.sign(t.z - c.z), n: 7, t: 0.35 };
      c.face(t.x, t.z);
      game.renderer.floatText(c.x, c.y + 2.6, c.z, 'CHARGE!', '#ff7050');
      game.audio?.play('roar', c);
      return true;
    }
    return false;
  },
};

Object.assign(BRAINS, HOLD_BRAINS);
export { kegBlast, walkTo };
