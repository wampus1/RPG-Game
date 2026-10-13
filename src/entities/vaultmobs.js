// (Round 104) What lives in the Terracotta Vault beside its clay soldiers,
// crossbowmen and the court's jade dead (laid out by world/deeps/vault.js,
// drawn in render/art/vault_mobs.js; the statues, the plates, the
// quicksilver and the discs are in game/vaultwork.js), each made to work
// with the others:
//   the drummer: a clay officer with a war drum at his hip and a bronze
//     bell on a handle. The old armies advanced to the drum and halted at
//     the bell. When he drums, every clay soldier near him comes on at you,
//     quick (and a statue near him may wake). When he rings the bell, they
//     halt where they stand and stand as clay: blows glance off them,
//     while the crossbowmen (who don't halt) shoot. Strike them as they
//     march.
//   the quicksilver: living mercury out of the rivers, a fist of it,
//     rolling. Struck, it splits in two beads; two beads that touch run
//     together again. Its touch poisons. And a bead that rolls up to a
//     statue runs into its cracks, and the statue moves.
//   the sealed artisan: the ghost of one of the potters walled in with the
//     work. Peaceful: he goes to wherever a soldier lies broken and puts it
//     back together, and it stands again (and isn't clay). Struck, he
//     flees, wailing.
import { BRAINS } from './monsters.js';
import { runOf, wakeStatue, halted, mend, MARCHERS } from '../game/vaultwork.js';

const dist = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.z - b.z));
const runAt = (c) => runOf(c.game, c.x);

// A bead struck: it splits (see vaultwork.tick).
function beadSplit(game, c, src, amount) {
  if (c.species === 'quicksilver' && amount > 0 && amount < c.hp) c.split = true;
  if (!(c.ringNote > 0)) {
    c.ringNote = 0.8;
    game.audio?.play('tink', c);
  }
  return amount;
}
// The artisan struck: away he goes, and his fellows hide their faces.
function artisanStruck(game, c, src, amount) {
  if (src && src !== c) {
    c.fleeFrom = src;
    c.fleeT = 8;
    c.mending = null;
    if (!(c.wailNote > 0)) {
      c.wailNote = 3;
      game.renderer.floatText(c.x, c.y + 2.4, c.z, 'he wails, and flees', '#c8c0b0');
      game.audio?.play('whisper', c);
    }
  }
  return amount;
}
const poison = (game, a, v) => {
  v.poisonT = Math.max(v.poisonT || 0, 3);
  v.poisonSrc = a;
  game.renderer.floatText(v.x, v.y + 2.4, v.z, 'quicksilver!', '#c8d0d8');
};

export const VAULT_SPECIES = {
  drummer: {
    name: 'Clay Drummer', hp: 24, dmg: 3, step: 0.45, mode: 'hostile', aggro: 10, under: true, construct: true, armoured: true, brain: 'drummer', style: 'bash', isle: 'ostria',
    drops: [['clay', 1, 3, 0.7], ['old_coin', 1, 4, 0.5], ['iron_ingot', 1, 1, 0.15]],
    onDeath(game, c) {
      game.renderer.emit(c.x, c.y + 1, c.z, { n: 20, color: ['#a8886a', '#806248', '#cdb08e'], up: 40, speed: 50, gravity: 200, life: 0.8 });
      game.audio?.play('shatter', c);
      game.renderer.floatText(c.x, c.y + 3, c.z, 'the drum falls silent', '#e0c090');
    },
  },
  quicksilver: {
    name: 'Quicksilver', hp: 16, dmg: 3, step: 0.3, mode: 'hostile', aggro: 9, under: true, brain: 'quicksilver', style: 'bite', ward: beadSplit, isle: 'ostria',
    drops: [['old_coin', 1, 2, 0.3]],
    onHit: poison,
  },
  quicksilver_bead: {
    name: 'Bead of Quicksilver', hp: 7, dmg: 2, step: 0.26, mode: 'hostile', aggro: 9, under: true, brain: 'quicksilver', style: 'bite', ward: beadSplit, isle: 'ostria',
    drops: [],
    onHit: poison,
  },
  artisan: {
    name: 'Sealed Artisan', hp: 14, dmg: 0, step: 0.6, mode: 'passive', aggro: 6, under: true, undead: true, light: 3, brain: 'artisan', calm: 'artisan', ward: artisanStruck, isle: 'ostria',
    drops: [['clay', 1, 2, 0.6]],
  },
};

// The step toward (or from) someone, whichever way's open.
function stepToward(c, t, mul = 1, away = false) {
  if (c.moving) return;
  const k = away ? -1 : 1;
  const sx = Math.sign(t.x - c.x) * k;
  const sz = Math.sign(t.z - c.z) * k;
  (sx && c.tryStep(c.x + sx, c.z, c.S.step * mul)) || (sz && c.tryStep(c.x, c.z + sz, c.S.step * mul));
}

export const VAULT_BRAINS = {
  // The drum and the bell, by turns: the soldiers about him come on at the
  // drum, quick; at the bell they halt, clay again (blows glance off). He
  // keeps behind them.
  drummer(c, dt) {
    const game = c.game;
    const t = c.target;
    if (!t || t.dead) return false;
    c.beatT = (c.beatT ?? 0) - dt;
    if (c.beatT <= 0) {
      c.bell = !c.bell;
      c.beatT = c.bell ? 2.4 : 4.5;
      game.renderer.floatText(c.x, c.y + 3, c.z, c.bell ? 'THE BELL: HALT!' : 'THE DRUM: ADVANCE!', c.bell ? '#d8e8f0' : '#ffb070');
      game.audio?.play(c.bell ? 'bell' : 'boom', c);
      const run = runAt(c);
      for (const o of game.creatures) {
        if (o.dead || !MARCHERS.has(o.species) || dist(o, c) > 7) continue;
        if (c.bell) halted(o, 2.4);
        else {
          o.haltT = 0;
          o.target ||= t;
        }
      }
      // (At the drum, a statue near him may step down.)
      if (!c.bell && run) wakeStatue(run, c, 5, 'the drum');
    }
    if (!c.bell) {
      for (const o of game.creatures) if (!o.dead && MARCHERS.has(o.species) && dist(o, c) <= 7) o.hasteT = Math.max(o.hasteT || 0, 0.3);
      c.boomT = (c.boomT ?? 0) - dt;
      if (c.boomT <= 0) {
        c.boomT = 0.6;
        game.renderer.emit(c.x, c.y + 1.4, c.z, { n: 3, color: ['#ffb070', '#ffe0a0'], up: 8, speed: 18, life: 0.3 });
      }
    }
    // (Behind the line: he closes only when you're on him.)
    if (dist(c, t) <= 1) return false;
    if (dist(c, t) < 4) stepToward(c, t, 1, true);
    c.face(t.x, t.z);
    return true;
  },

  // Rolling at you; two beads that touch run together into one.
  quicksilver(c, dt) {
    const game = c.game;
    if (c.mergeCd > 0) c.mergeCd -= dt;
    if (c.species === 'quicksilver_bead' && !(c.mergeCd > 0)) {
      const o = game.creatures.find((q) => q !== c && !q.dead && q.species === 'quicksilver_bead' && !(q.mergeCd > 0) && dist(q, c) <= 1);
      if (o) c.merge = o;
    }
    return false;
  },

  // At the work: to the nearest soldier lying broken, and mending it.
  artisan(c, dt) {
    const game = c.game;
    c.target = null;
    if (c.wailNote > 0) c.wailNote -= dt;
    if (c.fleeT > 0) return false;
    const run = runAt(c);
    if (!run || !run.data.shards) return true;
    if (c.mending) {
      c.mendT -= dt;
      c.tapT = (c.tapT ?? 0) - dt;
      if (c.tapT <= 0) {
        c.tapT = 0.5;
        game.renderer.emit(c.mending.x, c.mending.y + 0.6, c.mending.z, { n: 3, color: ['#a8886a', '#cdb08e'], up: 10, speed: 10, life: 0.4 });
        game.audio?.play('tink', c.mending);
        c.doAction?.(0.3);
      }
      if (c.mendT <= 0) {
        mend(run, c.mending, c);
        c.mending = null;
      }
      return true;
    }
    const sh = run.data.shards.filter((q) => !q.mended && dist(q, c) <= 12).sort((a, b) => dist(a, c) - dist(b, c))[0];
    if (!sh) {
      // (Pottering, near where he works; now and then a word.)
      c.home ||= { x: c.x, z: c.z };
      c.thinkT = (c.thinkT ?? 0) - dt;
      if (c.thinkT <= 0 && !c.moving) {
        c.thinkT = c.rng.float(2, 5);
        const [dx, dz] = [[1, 0], [-1, 0], [0, 1], [0, -1]][c.rng.int(0, 3)];
        if (dist({ x: c.x + dx, z: c.z + dz }, c.home) <= 4) c.tryStep(c.x + dx, c.z + dz, c.S.step * 1.5);
        const p = game.player;
        if (p && !p.dead && dist(p, c) <= 3 && c.rng.chance(0.3)) game.renderer.floatText(c.x, c.y + 2.4, c.z, c.rng.pick(['...the crack...', '...the last soldiers...', '...we were not to go out...', '...my name was on every one...']), '#c8c0b0');
      }
      return true;
    }
    if (dist(sh, c) > 1) {
      stepToward(c, sh);
      return true;
    }
    c.face(sh.x, sh.z);
    c.mending = sh;
    c.mendT = 3;
    return true;
  },
};
Object.assign(BRAINS, VAULT_BRAINS);
