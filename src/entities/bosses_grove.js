// The masters of Thessa's own old places, its Wildwood Hollows (and met
// nowhere else):
//   the Thorn Queen, who grows walls of briar across her hall (see
//     bosskit.js), plants roses that burst in rings of thorned petals,
//     lashes you with a thorn whip that holds you, and at the last closes a
//     ring of briars in round you, tighter and tighter;
//   the Elder Stag, who charges in a straight line till something stops
//     him (a wall stops him hard: stunned, and open to you), tosses you on
//     his antlers, rears and stamps;
//   the Hollow Oak, round which the seasons turn: spring mends it (its
//     taproots: cut them) and sprouts thornlings from its acorns, summer
//     burns through its leaves, autumn sheds them (soft to your blows, but
//     a storm of leaves about it), winter makes it hard as iron.
import { BRAINS, addHazard, addZone, lob, lineTiles, areaTiles, summon, bossSlam, phaseSummons, COLORS, BOSS_TITLES } from './monsters.js';
import { phaseOf, ready, used } from './tempo.js';
import { B } from '../world/blocks.js';
import { FY, dist, sees, dmgOf, work, inHall, ringTiles, wallTiles, spotIn, backOff, cd, shout, proc, openFloor } from './bosskit.js';
import { fits } from './footprint.js';

const LEAF = ['#5a8a3a', '#8ac060', '#c8f080'];
const ROSE = [220, 60, 90];
const mid = (tiles) => tiles[Math.floor(tiles.length / 2)] || tiles[0] || { x: 0, z: 0 };
const thorns = (game, c, tiles, dur, dmg, o = {}) => tiles.length && addHazard(game, { by: c, tiles, y: c.y, dur, dmg: dmgOf(c, dmg), kind: 'erupt', center: mid(tiles), color: [110, 170, 70], ...o });

const boss = (o) => ({ mode: 'hostile', aggro: 16, under: true, boss: true, isle: 'thessa', ...o });
export const GROVE_BOSSES = {
  thorn_queen: boss({
    name: 'The Thorn Queen', hp: 105, dmg: 5, step: 0.4, humanoid: true, look: 'thorn_queen', brain: 'thornQueen', range: 4, light: 3, tint: ['#e05070', '#a0e070'],
    phaseLines: ['', '', 'Grow, my darlings. Grow!', 'You will never leave my garden.'], drops: [['old_coin', 4, 10, 1], ['herb', 3, 6, 1], ['potion_vigor', 1, 2, 1]],
  }),
  elder_stag: boss({
    name: 'The Elder Stag', hp: 125, dmg: 6, step: 0.3, big: true, brain: 'elderStag', tint: ['#c8b070', '#f0f0c0'], style: 'bite',
    phaseLines: ['', '', '', ''], drops: [['leather', 4, 8, 1], ['raw_meat', 4, 8, 1], ['longbow', 1, 1, 0.5]],
  }),
  hollow_oak: boss({
    name: 'The Hollow Oak', hp: 140, dmg: 6, step: 0.6, big: true, brain: 'hollowOak', tint: ['#8ac060', '#e8d890'], style: 'bite',
    // (Bare and hard in winter; its leaves shed in autumn, soft.)
    ward: (game, c, src, n) => {
      if (c.season === 3) {
        if (!(c.wardNote > 0)) {
          c.wardNote = 0.8;
          game.renderer.floatText(c.x, c.y + 3, c.z, 'hard as iron', '#c8e8ff');
        }
        return Math.max(1, Math.round(n * 0.4));
      }
      return c.season === 2 ? Math.round(n * 1.5) : n;
    },
    tick: (c, dt) => seasonTick(c, dt),
    phaseLines: ['', '', '', ''], drops: [['log_oak', 6, 12, 1], ['herb', 3, 6, 1], ['gem', 1, 1, 0.6]],
  }),
  taproot: { name: 'Taproot', hp: 16, dmg: 0, step: 9, mode: 'hostile', aggro: 0, under: true, anchored: true, isle: 'thessa', brain: 'still', drops: [['stick', 1, 2, 0.6]] },
};

export const GROVE_TITLES = {
  thorn_queen: { name: 'The Thorn Queen', title: 'Lady of the Wildwood Hollow', taunt: 'Such a pretty thing to grow roses on.' },
  elder_stag: { name: 'The Elder Stag', title: 'The Antlered One, Oldest in the Wood' },
  hollow_oak: { name: 'The Hollow Oak', title: 'Root-Father, Who Drinks the Dark' },
};

export const GROVE_BRAINS = {
  thornQueen(c, dt) {
    const game = c.game;
    const t = c.target;
    const ph = phaseOf(c);
    phaseSummons(c, [0.66, 0.33], () => {
      for (let i = 0; i < 2; i++) summon(game, 'thornling', c, 3, { color: LEAF });
    });
    if (!t || t.dead) return false;
    const d = dist(c, t);
    // Walls of briar grown across her hall.
    if (cd(c, 'briarCd', dt, 1.5) && ready(c) && !c.windup) {
      c.briarCd = 10;
      used(c, 0.3);
      for (let k = 0; k < 2; k++) {
        const at = spotIn(c, k ? t : c, 2, 5);
        if (!at) continue;
        const wall = wallTiles(at, Math.random() < 0.5, 7, 0).filter((q) => inHall(c, q) && openFloor(game, q.x, q.z) && !(q.x === t.x && q.z === t.z));
        thorns(game, c, wall, 0.9, 3, { onFire: (g, h) => h.tiles.forEach((q) => work(g, q.x, FY, q.z, B.briar, 14, c)) });
      }
      shout(c, 'Grow.', '#a0e070');
      game.audio?.play('rumble', c);
      return true;
    }
    // Roses planted round you: a moment, and they burst in rings of petals.
    if (cd(c, 'roseCd', dt, 3) && ready(c) && d <= 9 && !c.windup) {
      c.roseCd = 7;
      used(c, 0.3);
      for (let i = 0; i < 3; i++) {
        const at = i ? spotIn(c, t, 1, 3) : { x: t.x, z: t.z };
        if (!at) continue;
        addZone(game, { by: c, kind: 'rose', tiles: [at], y: c.y, life: 2.2, color: ROSE, puff: ['#e05070', '#ff90a0'] });
        for (let r = 1; r <= 2; r++) addHazard(game, { by: c, tiles: ringTiles(at.x, at.z, r), y: c.y, dur: 2 + r * 0.3, dmg: dmgOf(c, 4), kind: 'hex', center: at, color: ROSE, quiet: r > 1 });
      }
      game.renderer.floatText(t.x, t.y + 2.6, t.z, 'roses bloom...', '#ff90a0');
      return true;
    }
    // Her thorn whip: it holds you.
    if (cd(c, 'lashCd', dt, 2) && ready(c) && d >= 2 && d <= 8 && sees(game, c, t) && !c.windup) {
      c.lashCd = 4;
      used(c);
      c.face(t.x, t.z);
      const line = lineTiles(game, c, t, 8);
      addHazard(game, { by: c, tiles: line, y: c.y, dur: 0.8, dmg: dmgOf(c, 4), kind: 'beam', from: { x: c.x, z: c.z }, to: line[line.length - 1] || t, beamColor: '#a0e070', halo: '#3a5a2a', width: 2, onFire: (g, h, hit) => {
        for (const e of hit) if (e === g.player) {
          e.grabbedT = Math.max(e.grabbedT || 0, 1);
          g.renderer.floatText(e.x, e.y + 2.4, e.z, 'caught by thorns!', '#a0e070');
        }
      } });
      game.audio?.play('whip', c);
      return true;
    }
    // (Desperate) A ring of briars closing in round you, a gap in each.
    if (ph >= 3 && cd(c, 'growCd', dt, 2) && ready(c) && d <= 10 && !c.windup) {
      c.growCd = 12;
      used(c, 1);
      const at = { x: t.x, z: t.z };
      proc(game, c, 0.8, 3, (k) => {
        const r = 4 - k;
        const ring = ringTiles(at.x, at.z, r).filter((q) => inHall(c, q) && openFloor(game, q.x, q.z));
        const gap = ring[Math.floor(Math.random() * ring.length)];
        const wall = ring.filter((q) => q !== gap && !(Math.abs(q.x - (gap ? gap.x : 0)) + Math.abs(q.z - (gap ? gap.z : 0)) <= 1));
        thorns(game, c, wall, 0.6, 4, { onFire: (g, h) => h.tiles.forEach((q) => work(g, q.x, FY, q.z, B.briar, 7, c)) });
      });
      shout(c, 'Stay in my garden!', '#e05070');
      return true;
    }
    if (d <= 2 && backOff(c, t)) return true;
    return d > 1;
  },

  elderStag(c, dt) {
    const game = c.game;
    const t = c.target;
    const ph = phaseOf(c);
    phaseSummons(c, [0.33], () => {
      for (let i = 0; i < 2; i++) summon(game, 'wolf', c, 3, { color: LEAF });
      game.audio?.play('howl', c);
    });
    if (c.charge) return chargeOn(c, dt);
    if (!t || t.dead) return false;
    const d = dist(c, t);
    // A charge: antlers down, straight as an arrow, through you if you're
    // there, till something stops him. A wall stops him hard: stunned, and
    // open to you. (Desperate, he turns and comes straight back.)
    if (cd(c, 'chargeCd', dt, 1.5) && ready(c) && d >= 2 && !c.windup) {
      c.chargeCd = ph >= 2 ? 4.5 : 6;
      used(c, 1.6);
      startCharge(c, t, ph >= 3 ? 1 : 0);
      if (!game.toldCharge) game.ui.msg('The Elder Stag charges in a straight line till something stops him: sidestep at the last moment, by a wall, and he\'ll stun himself on it!', '#e8d890', true);
      game.toldCharge = true;
      return true;
    }
    // Tossed on his antlers.
    if (d <= 2 && cd(c, 'tossCd', dt, 1) && ready(c) && !c.windup) {
      c.tossCd = 5;
      used(c);
      c.face(t.x, t.z);
      addHazard(game, { by: c, tiles: areaTiles(t.x, t.z, 1), y: c.y, dur: 0.7, dmg: dmgOf(c, 8), knock: 4, stun: 0.5, from: { x: c.x, z: c.z }, kind: 'slam', center: { x: t.x, z: t.z }, radius: 1, color: COLORS.blow });
      game.renderer.floatText(c.x, c.y + 3.4, c.z, 'he lowers his antlers!', '#e8d890');
      return true;
    }
    // (Worn) He rears and stamps: the ground shakes out from him.
    if (ph >= 2 && cd(c, 'stampCd', dt, 2) && ready(c) && d <= 6 && !c.windup) {
      c.stampCd = 8;
      used(c, 0.6);
      for (let r = 2; r <= 5; r++) addHazard(game, { by: c, tiles: ringTiles(c.x, c.z, r), y: c.y, dur: 0.7 + r * 0.18, dmg: dmgOf(c, 5), knock: 1, from: { x: c.x, z: c.z }, kind: 'erupt', quiet: r > 2 });
      game.renderer.floatText(c.x, c.y + 3.4, c.z, 'he rears!', '#e8d890');
      game.audio?.play('stomp', c);
      return true;
    }
    return false;
  },

  hollowOak(c, dt) {
    const game = c.game;
    const t = c.target;
    const ph = phaseOf(c);
    // Drinking, through its taproots: mending while they stand.
    if (c.drinkT > 0) {
      c.drinkT -= dt;
      const roots = game.creatures.filter((o) => !o.dead && o.species === 'taproot' && o.rootOf === c);
      if (!roots.length || c.drinkT <= 0) {
        c.drinkT = 0;
        game.renderer.floatText(c.x, c.y + 3.4, c.z, roots.length ? 'it pulls its roots up' : 'its roots are cut!', '#e8d890');
        for (const r of roots) r.dead = true;
        return true;
      }
      c.drinkAcc = (c.drinkAcc || 0) + dt;
      if (c.drinkAcc >= 1) {
        c.drinkAcc = 0;
        c.hp = Math.min(c.maxHp, c.hp + 3 * roots.length);
        for (const r of roots) game.renderer.effect?.({ type: 'siphon', wx: r.x, wy: r.y + 0.5, wz: r.z, tx: c.x, ty: c.y + 1, tz: c.z, life: 0.6, oy: -6, n: 8, amp: 2, color: LEAF });
        game.renderer.floatText(c.x, c.y + 2.8, c.z, `+${3 * roots.length}`, '#a0e070');
      }
      return true;
    }
    // The seasons go round it (see seasonTick), each its own way of
    // fighting.
    if (!t || t.dead) return false;
    if (c.season === 0) {
      // Spring: acorns that sprout thornlings where they fall; and, hurt,
      // its taproots driven down to drink (cut them!).
      if (!c.springRoots && c.hp < c.maxHp * 0.9 && ready(c) && !c.windup) {
        c.springRoots = true;
        used(c, 2);
        for (let i = 0; i < (ph >= 2 ? 3 : 2); i++) {
          const at = spotIn(c, c, 3, 7);
          if (!at) continue;
          const r = summon(game, 'taproot', { x: at.x, y: c.y, z: at.z }, 0, { color: LEAF });
          if (r) r.rootOf = c;
        }
        c.drinkT = 7;
        game.renderer.floatText(c.x, c.y + 3.4, c.z, 'it drives its roots down to drink: cut them!', '#a0e070');
        return true;
      }
      if (cd(c, 'acornCd', dt, 2) && ready(c) && !c.windup) {
        c.acornCd = 5;
        used(c, 0.3);
        for (let i = 0; i < 3; i++) {
          const at = spotIn(c, t, 1, 4);
          if (at) lob(game, c, at.x, at.z, { tint: [160, 120, 60], onLand: (g, x, z) => summon(g, 'thornling', { x, y: c.y, z }, 0, { color: LEAF }) });
        }
        return true;
      }
    } else if (c.season === 1) {
      // Summer: shafts of sun through its leaves, where you stand and about.
      if (cd(c, 'sunCd', dt, 1) && ready(c) && !c.windup) {
        c.sunCd = ph >= 2 ? 2.6 : 3.4;
        used(c, 0.3);
        for (let i = 0; i < 4; i++) {
          const at = i ? spotIn(c, t, 1, 3) : { x: t.x, z: t.z };
          if (at) addHazard(game, { by: c, tiles: areaTiles(at.x, at.z, 1), y: c.y, dur: 1 + i * 0.15, dmg: dmgOf(c, 5), burn: 1, kind: 'fire', center: at, quiet: i > 0 });
        }
        return true;
      }
    } else if (c.season === 2) {
      // Autumn: a storm of leaves about it, drawing you in and cutting.
      if (cd(c, 'leafCd', dt, 1) && ready(c) && !c.windup) {
        c.leafCd = 8;
        used(c, 0.5);
        addZone(game, { by: c, kind: 'leaves', tiles: areaTiles(c.x, c.z, 5, true).filter((q) => inHall(c, q)), y: c.y, life: 5, tick: 0.5, dmg: dmgOf(c, 1), pull: { x: c.x, z: c.z }, color: [200, 120, 50], puff: ['#e08a3a', '#c85a2a', '#f0c060'] });
        game.renderer.floatText(c.x, c.y + 3.4, c.z, 'its leaves whirl!', '#e08a3a');
        return true;
      }
    } else if (cd(c, 'frostCd', dt, 1.5) && ready(c) && !c.windup) {
      // Winter: frost going out from it, ring on ring.
      c.frostCd = 4;
      used(c, 0.4);
      for (let r = 1; r <= 4; r++) addHazard(game, { by: c, tiles: ringTiles(c.x, c.z, r + 1), y: c.y, dur: 0.8 + r * 0.3, dmg: dmgOf(c, 4), chill: 2, kind: 'cold', quiet: r > 1 });
      return true;
    }
    // Its branches swept round it.
    if (bossSlam(c, dt, 2, 1, 6, 5)) return true;
    return false;
  },
};

// The seasons round the Hollow Oak.
const SEASONS = [
  { name: 'SPRING', color: '#a0e070', motes: ['#c8f080', '#ffffff', '#f0a0c0'] },
  { name: 'SUMMER', color: '#ffe070', motes: ['#ffe070', '#ffffff', '#ffb040'] },
  { name: 'AUTUMN', color: '#e08a3a', motes: ['#e08a3a', '#c85a2a', '#f0c060'] },
  { name: 'WINTER', color: '#c8e8ff', motes: ['#ffffff', '#c8e8ff', '#a0c8e0'] },
];

// The seasons round the Hollow Oak, every moment: spring (roots that mend
// it, acorns that sprout), summer (shafts of sun), autumn (its leaves
// shed: soft to your blows, but a storm of them about it), winter (bare
// and hard as iron, slow, frost round it).
function seasonTick(c, dt) {
  const game = c.game;
  const span = phaseOf(c) >= 3 ? 9 : 12;
  c.seasonT = (c.seasonT ?? 0) - dt;
  if (c.seasonT <= 0) {
    c.season = ((c.season ?? -1) + 1) % 4;
    c.seasonT = span;
    c.springRoots = false;
    const S = SEASONS[c.season];
    game.renderer.floatText(c.x, c.y + 3.8, c.z, S.name, S.color);
    game.renderer.emit(c.x, c.y + 2, c.z, { n: 30, color: S.motes, up: 30, speed: 40, life: 1, shape: c.season === 3 ? 'star' : 'puff' });
    if (!game.toldSeasons) game.ui.msg('The seasons turn round the Hollow Oak. Spring mends it, summer burns, in autumn it\'s soft to your blows, in winter hard as iron.', '#a0e070', true);
    game.toldSeasons = true;
  }
  const S = SEASONS[c.season];
  c.gauge = { label: S.name, v: c.seasonT / span, color: S.color };
  if (c.season === 3) c.slowT = Math.max(c.slowT || 0, 0.3);
}

// The Elder Stag set for a charge: straight down the line he's facing
// you along, as far as there's room for him.
function startCharge(c, t, back) {
  const game = c.game;
  const dx = t.x - c.x;
  const dz = t.z - c.z;
  const [ux, uz] = Math.abs(dx) >= Math.abs(dz) ? [Math.sign(dx) || 1, 0] : [0, Math.sign(dz) || 1];
  const lane = [];
  for (let k = 1, x = c.x, z = c.z; k <= 20; k++) {
    x += ux;
    z += uz;
    if (!fits(game, c, x, c.y, z, true)) break;
    for (let w = -1; w <= 1; w++) lane.push({ x: x + uz * w, z: z + ux * w });
  }
  c.face(t.x, t.z);
  c.charge = { ux, uz, wind: 0.9, n: 0, back };
  addZone(game, { by: c, kind: 'lane', tiles: lane, y: c.y, life: 0.9, color: [232, 216, 144], puff: ['#e8d890'] });
  game.renderer.floatText(c.x, c.y + 3.4, c.z, 'he lowers his antlers...', '#e8d890');
  game.audio?.play('stomp', c);
}
function chargeOn(c, dt) {
  const game = c.game;
  const C = c.charge;
  if (C.wind > 0) {
    C.wind -= dt;
    return true;
  }
  if (c.moving) return true;
  const nx = c.x + C.ux;
  const nz = c.z + C.uz;
  // You (whichever of you), in his way: gored, and thrown.
  const p = game.everyone().find((q) => !q.dead && !(q.rollT > 0) && Math.abs(q.x - nx) <= 1 && Math.abs(q.z - nz) <= 1 && Math.abs(q.y - c.y) <= 1) || game.player;
  if (p && !p.dead && !(p.rollT > 0) && Math.abs(p.x - nx) <= 1 && Math.abs(p.z - nz) <= 1 && Math.abs(p.y - c.y) <= 1) {
    c.charge = null;
    game.damage(p, dmgOf(c, 9), c);
    knockFrom(game, c, p);
    game.renderer.floatText(p.x, p.y + 2.8, p.z, 'GORED!', '#ff9060');
    c.stunT = 0.8;
    return true;
  }
  if (C.n < 22 && c.tryStep(nx, nz, 0.075)) {
    C.n++;
    if (C.n % 2 === 0) game.renderer.emit(c.x, c.y + 0.2, c.z, { n: 3, color: ['#a8885a', '#7a5a3a'], up: 10, speed: 20, life: 0.5, shape: 'puff' });
    return true;
  }
  c.charge = null;
  // Stopped by a wall (not by someone): hard. (Someone: anyone but him
  // across the front of him, a pace on.)
  const f = c.foot || 0;
  let someone = false;
  for (let w = -f; w <= f && !someone; w++) {
    const e = game.entityAt?.(nx + C.ux * f + C.uz * w, c.y, nz + C.uz * f + C.ux * w);
    someone = !!e && e !== c;
  }
  const wall = !fits(game, c, nx, c.y, nz, true) && !someone;
  if (wall && C.n >= 2) {
    c.stunT = 3;
    c.exposedT = 3;
    game.shake = Math.min(1.5, (game.shake || 0) + 0.9);
    game.renderer.floatText(c.x, c.y + 3.6, c.z, 'STUNNED against the wall!', '#ffe070');
    game.renderer.emit(c.x + C.ux * 1.6, c.y + 1.2, c.z + C.uz * 1.6, { n: 20, color: ['#a8a090', '#e8d890', '#ffffff'], up: 30, speed: 50, life: 0.7 });
    game.audio?.play('boom', c);
  } else if (C.back && p && !p.dead) {
    // (Desperate: he wheels and comes straight back.)
    startCharge(c, p, 0);
    c.charge.wind = 0.5;
  } else c.stunT = 0.6;
  return true;
}
// (Tossed away from him.)
function knockFrom(game, c, p) {
  const sx = Math.sign(p.x - c.x) || 1;
  const sz = Math.sign(p.z - c.z);
  for (let n = 3; n >= 1; n--) {
    const x = p.x + sx * n;
    const z = p.z + sz * n;
    const y = game.world.findStandY(x, z, p.y);
    if (y === p.y && game.world.canStand(x, y, z) && !game.occupiedBySolid(x, y, z, p)) {
      p.startMove(x, y, z, 0.18);
      return;
    }
  }
}

Object.assign(BRAINS, GROVE_BRAINS);
Object.assign(BOSS_TITLES, GROVE_TITLES);
