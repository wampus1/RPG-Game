// (Round 97) The crypt's own (laid out by world/deeps/crypt.js, drawn in
// render/art/crypt_mobs.js; the vigil they wake and sleep by is in
// game/cryptwork.js), each made to fight alongside the others:
//   the entombed: a knight or a benefactor out of their tomb, in the mail
//     and surcoat they were laid out in, the sword from the effigy in their
//     hand. Slow, heavy (a cracked flag won't hold one), and their shield
//     turns most of what comes at them from the front.
//   the mourner: a tall veiled shade in black crepe. It wants no fight: it
//     slips past you to the vigil candles and pinches them out, one after
//     another, and wherever it's been the dead get up. Its touch is cold.
//   the sexton: the gravedigger, spade and sack. Where one of the crypt's
//     dead falls, its bones lie a while; the sexton goes and gathers them
//     and they get up again (not in a burning candle's light).
//   the cantor: the keepers' cantor, still at the office. While it sings,
//     the dead about it take half the hurt; two singing, and their wounds
//     close. Strike it, and the hymn breaks off a while.
//   the penitent: a pale ghost, kneeling as it goes from chapel to chapel.
//     It never fights. Follow it, and where it kneels last there's a loose
//     flag. Strike it, and it's gone with a wail, and the candles near you
//     gutter out.
import { BRAINS } from './monsters.js';
import { walkTo } from '../game/minework.js';
import { litNear, snuff, bonesFor, raiseBones, isDead } from '../game/cryptwork.js';

const dist = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.z - b.z));
const runOf = (c) => c.game.runAt?.(c.x) || c.game.dungeon || null;

// The cantor struck: its hymn breaks off.
function cantorStruck(game, c, src, amount) {
  if (src && src !== c && amount > 0) {
    if (c.singing) game.renderer.floatText(c.x, c.y + 2.4, c.z, 'the hymn breaks off', '#c8d0e8');
    c.singing = false;
    c.hymnOff = 4;
  }
  return amount;
}
// The penitent struck: gone, with a wail, and the candles near gutter.
function penitentStruck(game, c, src) {
  if (!src || src === c) return 0;
  const run = runOf(c);
  game.renderer.floatText(c.x, c.y + 2.4, c.z, 'a long wail', '#c8e0f0');
  game.renderer.emit(c.x, c.y + 1, c.z, { n: 18, color: ['#c8e0f0', '#6a8aa0', '#ffffff'], up: 40, speed: 40, life: 1, glow: true });
  game.audio?.play('scream', c);
  if (run) for (const q of run.data.candles || []) if (dist(q, c) <= 6) snuff(run, q.x, q.y, q.z, src);
  c.sporeless = true;
  game.kill(c, null);
  return 0;
}

export const CRYPT_SPECIES = {
  entombed: {
    name: 'Entombed', hp: 30, dmg: 5, step: 0.62, mode: 'hostile', aggro: 9, under: true, undead: true, heavy: true, shieldBlock: 0.5, style: 'sword',
    drops: [['old_coin', 1, 3, 0.5], ['iron_ingot', 1, 1, 0.2], ['bone', 1, 2, 0.4]],
  },
  mourner: { name: 'Mourner', hp: 9, dmg: 1, step: 0.34, mode: 'hostile', aggro: 12, under: true, undead: true, floats: true, brain: 'mourner', style: 'sting', drops: [] },
  sexton: { name: 'Sexton', hp: 16, dmg: 3, step: 0.42, mode: 'hostile', aggro: 8, under: true, undead: true, brain: 'sexton', style: 'axe', drops: [['bone', 1, 3, 0.6], ['old_coin', 1, 2, 0.3]] },
  cantor: { name: 'Cantor', hp: 12, dmg: 2, step: 0.48, mode: 'hostile', aggro: 10, under: true, undead: true, brain: 'cantor', style: 'staff', ward: cantorStruck, drops: [['old_coin', 1, 2, 0.3]] },
  penitent: { name: 'Penitent', hp: 6, dmg: 0, step: 0.42, mode: 'passive', under: true, undead: true, floats: true, light: 3, coldLight: true, noHalo: true, ward: penitentStruck, drops: [] },
};

// The nearest burning candle the mourner can see to (within r).
function candleFor(run, c, r = 14) {
  let best = null;
  for (const q of run.data.candles || []) {
    const d = dist(q, c);
    if (d > r || Math.abs((q.y ?? c.y) - c.y) > 2 || !litNear(run, q.x, q.z, 0, q.y)) continue;
    if (!best || d < best.d) best = { d, q };
  }
  return best ? best.q : null;
}

export const CRYPT_BRAINS = {
  // To the candles, round you if it must; it bends over one a moment and
  // it's out. Only with none left near does it come at you, and its touch
  // is cold.
  mourner(c, dt) {
    const game = c.game;
    const run = runOf(c);
    if (!run) return false;
    if (c.snuffing) {
      c.snuffing.t -= dt;
      if (c.snuffing.t > 0) return true;
      const q = c.snuffing.q;
      c.snuffing = null;
      snuff(run, q.x, q.y, q.z, c);
      return true;
    }
    const q = candleFor(run, c);
    if (q) {
      if (dist(c, q) <= 1) {
        c.face(q.x, q.z);
        c.snuffing = { q, t: 0.8 };
        game.renderer.floatText(c.x, c.y + 2.4, c.z, 'it bends over the candle', '#a0a8b8');
        return true;
      }
      // (Shy of you: if you're close, it slips aside first.)
      const t = c.target;
      if (t && !t.dead && dist(c, t) <= 1 && !c.moving) {
        const dx = Math.sign(c.x - t.x) || 1;
        const dz = Math.sign(c.z - t.z);
        if (c.tryStep(c.x + dx, c.z + dz, c.S.step)) return true;
      }
      if (walkTo(c, q, 1)) return true;
    }
    const t = c.target;
    if (t && !t.dead && dist(c, t) <= 1 && Math.abs(t.y - c.y) <= 1) {
      c.face(t.x, t.z);
      if (c.attackCd <= 0) {
        c.attackCd = 1.4;
        game.damage(t, Math.max(1, Math.round(c.dmgMult || 1)), c);
        t.slowT = Math.max(t.slowT || 0, 1.6);
        game.renderer.floatText(t.x, t.y + 2.2, t.z, 'a cold touch', '#a0c0e0');
        game.renderer.emit(t.x, t.y + 1.4, t.z, { n: 6, color: ['#a0c0e0', '#e0f0ff'], up: 10, speed: 14, life: 0.6 });
      }
      return true;
    }
    return false;
  },
  // Off to where the dead fell, to gather them up again; fighting only
  // when you're on it.
  sexton(c, dt) {
    const game = c.game;
    const run = runOf(c);
    if (!run) return false;
    if (c.gather) {
      const bn = c.gather.bn;
      if (!run.cryptT || !run.cryptT.bones.includes(bn) || litNear(run, bn.x, bn.z, 3, bn.y)) {
        c.gather = null;
        return false;
      }
      c.gather.t -= dt;
      if (Math.random() < dt * 6) game.renderer.emit(bn.x, bn.y + 0.4, bn.z, { n: 1, color: ['#d8d0b8', '#8a8270'], up: 10, speed: 10, life: 0.4 });
      if (c.gather.t > 0) return true;
      c.gather = null;
      raiseBones(run, bn, c);
      return true;
    }
    const t = c.target;
    if (t && !t.dead && dist(c, t) <= 1) return false;
    const bn = bonesFor(run, c);
    if (!bn) return false;
    bn.claimed = c;
    if (dist(c, bn) <= 1) {
      c.face(bn.x, bn.z);
      c.gather = { bn, t: 2.2 };
      game.renderer.floatText(c.x, c.y + 2.4, c.z, 'it gathers the bones', '#d8d0b8');
      game.audio?.play('dig', c);
      return true;
    }
    return walkTo(c, bn, 1);
  },
  // Back from you, singing: the dead about it take half the hurt (two
  // singing, and they mend). Struck, it stops a while.
  cantor(c, dt) {
    const game = c.game;
    const run = runOf(c);
    if (!run) return false;
    if (c.hymnOff > 0) c.hymnOff -= dt;
    c.singing = !(c.hymnOff > 0) && !(c.stunT > 0);
    if (c.singing) {
      c.noteT = (c.noteT ?? 0) - dt;
      if (c.noteT <= 0) {
        c.noteT = 1.2;
        game.renderer.emit(c.x, c.y + 2, c.z, { n: 3, color: ['#c8d0e8', '#ffffff'], up: 24, speed: 8, life: 1.1, glow: true });
        if (Math.random() < 0.3) game.renderer.floatText(c.x, c.y + 2.6, c.z, '~ a hymn ~', '#c8d0e8');
      }
      const singers = run.creatures().filter((o) => o.species === 'cantor' && !o.dead && o.singing && dist(o, c) <= 10).length;
      for (const o of run.creatures()) {
        if (o === c || !isDead(o) || dist(o, c) > 8) continue;
        o.hymnT = 0.5;
        if (singers >= 2 && o.hp < o.maxHp && Math.random() < dt * 0.5) {
          o.hp = Math.min(o.maxHp, o.hp + 1);
          game.renderer.emit(o.x, o.y + 1.4, o.z, { n: 2, color: ['#c8d0e8'], up: 14, speed: 6, life: 0.6, glow: true });
        }
      }
    }
    const t = c.target;
    if (!t || t.dead) return false;
    // (Keeps its distance, three paces or more, while there's a choir to
    // sing for.)
    const d = dist(c, t);
    if (c.singing && d < 3 && !c.moving) {
      const dx = Math.sign(c.x - t.x) || 1;
      const dz = Math.sign(c.z - t.z);
      if (c.tryStep(c.x + dx, c.z + dz, c.S.step) || c.tryStep(c.x + dx, c.z, c.S.step) || c.tryStep(c.x, c.z + (dz || 1), c.S.step)) return true;
    }
    if (c.singing && d <= 6) {
      c.face(t.x, t.z);
      return true;
    }
    return false;
  },
};

Object.assign(BRAINS, CRYPT_BRAINS);
