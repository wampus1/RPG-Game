// The masters of Thessa's own old places, its Wildwood Hollows (and met
// nowhere else), each changing its hall as it fights (see bosskit.js):
//   the Thorn Queen, who grows walls of briar across her hall, plants
//     roses that burst in rings of thorned petals, lashes you with a
//     thorn whip that holds you, and at the last closes a ring of briars
//     in round you, tighter and tighter;
//   the Elder Stag, whose call brings trees up through the floor (cover,
//     and his charges splinter them), who tramples a furrow across his
//     hall, and tosses you on his antlers;
//   the Hollow Oak, roots erupting up through the floor in lines toward
//     you (and staying, as walls), acorns that sprout thornlings where they
//     fall, and its taproots driven into the floor to drink (cut them).
import { BRAINS, addHazard, addZone, lob, lineTiles, areaTiles, summon, bossSlam, phaseSummons, COLORS, BOSS_TITLES } from './monsters.js';
import { phaseOf, ready, used } from './tempo.js';
import { B } from '../world/blocks.js';
import { FY, dist, sees, dmgOf, work, inHall, ringTiles, wallTiles, spotIn, backOff, cd, shout, proc, openFloor } from './bosskit.js';

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
    if (!t || t.dead) return false;
    const d = dist(c, t);
    // His call: trees come up through the floor.
    if (cd(c, 'woodCd', dt, 2) && ready(c) && !c.windup) {
      c.woodCd = 12;
      used(c, 0.4);
      const spots = [];
      for (let i = 0; i < 5; i++) {
        const at = spotIn(c, i % 2 ? t : c, 2, 6);
        if (at) spots.push(at);
      }
      thorns(game, c, spots, 1, 4, { onFire: (g) => spots.forEach((q) => {
        if (work(g, q.x, FY, q.z, B.log_oak, 0, c)) work(g, q.x, FY + 1, q.z, B.leaves_oak, 0, c);
      }) });
      game.renderer.floatText(c.x, c.y + 3.4, c.z, 'he bellows: the wood answers', '#e8d890');
      game.audio?.play('horn', c);
      return true;
    }
    // A trample across his hall: through you, and through any tree in the
    // way, leaving a furrow.
    if (cd(c, 'trampleCd', dt, 1) && ready(c) && d >= 3 && d <= 10 && !c.windup) {
      c.trampleCd = ph >= 2 ? 5 : 6;
      used(c, 0.6);
      c.face(t.x, t.z);
      const end = { x: t.x + Math.sign(t.x - c.x) * 2, z: t.z + Math.sign(t.z - c.z) * 2 };
      const tiles = [];
      const dx = end.x - c.x;
      const dz = end.z - c.z;
      const n = Math.max(Math.abs(dx), Math.abs(dz));
      for (let k = 1; k <= n; k++) tiles.push({ x: Math.round(c.x + (dx * k) / n), z: Math.round(c.z + (dz * k) / n) });
      const run = tiles.filter((q) => inHall(c, q));
      c.stunT = 0.9;
      addHazard(game, { by: c, tiles: run, y: c.y, dur: 0.85, dmg: dmgOf(c, 7), knock: 2, from: { x: c.x, z: c.z }, kind: 'erupt', onFire: (g) => {
        // (Trees in the way splintered.)
        for (const q of run) {
          const w = (g.works || []).find((o) => o.by === c && o.x === q.x && o.z === q.z && o.id === B.log_oak);
          if (w) {
            work(g, q.x, FY, q.z, B.air, 0.01, c, { dig: true });
            work(g, q.x, FY + 1, q.z, B.air, 0.01, c, { dig: true });
            g.renderer.emit(q.x, FY + 1, q.z, { n: 12, color: ['#8a6a3a', '#c8a070', '#5a8a3a'], up: 30, speed: 40, gravity: 120, life: 0.6 });
          }
        }
        let last = null;
        for (const q of run) {
          if (!openFloor(g, q.x, q.z) || g.entityAt?.(q.x, FY, q.z)) break;
          last = q;
        }
        if (last) c.startMove(last.x, FY, last.z, 0.07 * run.length);
        addZone(g, { by: c, kind: 'furrow', tiles: run, y: c.y, life: 10, slow: true, color: [110, 80, 50], puff: ['#7a5a3a'] });
      } });
      game.audio?.play('stomp', c);
      return true;
    }
    // (Worn) Tossed on his antlers.
    if (ph >= 2 && d <= 2 && cd(c, 'tossCd', dt, 1) && ready(c) && !c.windup) {
      c.tossCd = 5;
      used(c);
      c.face(t.x, t.z);
      addHazard(game, { by: c, tiles: areaTiles(t.x, t.z, 1), y: c.y, dur: 0.7, dmg: dmgOf(c, 8), knock: 4, stun: 0.5, from: { x: c.x, z: c.z }, kind: 'slam', center: { x: t.x, z: t.z }, radius: 1, color: COLORS.blow });
      game.renderer.floatText(c.x, c.y + 3.4, c.z, 'he lowers his antlers!', '#e8d890');
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
    if (!t || t.dead) return false;
    const d = dist(c, t);
    // Roots up through the floor in a line at you; and they stay, walls.
    if (cd(c, 'rootCd', dt, 2) && ready(c) && d >= 2 && d <= 10 && !c.windup) {
      c.rootCd = 6;
      used(c);
      const line = lineTiles(game, c, t, d + 2);
      thorns(game, c, line, 1, 6, { knock: 1, from: { x: c.x, z: c.z }, onFire: (g, h) => h.tiles.forEach((q, i) => {
        if (i % 2 === 0 && !(q.x === g.player.x && q.z === g.player.z)) work(g, q.x, FY, q.z, B.root_wall, 14, c);
      }) });
      game.audio?.play('rumble', c);
      return true;
    }
    // Acorns: thornlings sprout where they fall.
    if (cd(c, 'acornCd', dt, 3) && ready(c) && !c.windup) {
      c.acornCd = ph >= 2 ? 8 : 10;
      used(c, 0.3);
      for (let i = 0; i < 3; i++) {
        const at = spotIn(c, t, 1, 4);
        if (at) lob(game, c, at.x, at.z, { tint: [160, 120, 60], onLand: (g, x, z) => summon(g, 'thornling', { x, y: c.y, z }, 0, { color: LEAF }) });
      }
      return true;
    }
    // (Worn) Its taproots driven into the floor round the hall, to drink
    // (cut them!).
    if (ph >= 2 && c.hp < c.maxHp * 0.6 && cd(c, 'drinkCd', dt, 3) && ready(c) && !c.windup) {
      c.drinkCd = 16;
      used(c, 2);
      for (let i = 0; i < 3; i++) {
        const at = spotIn(c, c, 3, 7);
        if (!at) continue;
        const r = summon(game, 'taproot', { x: at.x, y: c.y, z: at.z }, 0, { color: LEAF });
        if (r) r.rootOf = c;
      }
      c.drinkT = 8;
      if (!game.toldRoots) game.ui.msg('The Hollow Oak drives its taproots into the floor to drink: cut them!', '#a0e070', true);
      game.toldRoots = true;
      return true;
    }
    // Its branches swept round it.
    if (bossSlam(c, dt, 2, 1, 6, 5)) return true;
    return false;
  },
};

Object.assign(BRAINS, GROVE_BRAINS);
Object.assign(BOSS_TITLES, GROVE_TITLES);
