// The masters of the Kavorent's spires: one to an island, each the heart
// of what its spire does for the storm wall, and none like another (the
// Overseer, in Thessa's, the facility that watches over the rest: see
// monsters.js).
//   The Crucible, in the thermal spire sunk in the lava of Kharos's
//     crater, turning the mountain's heat into the wall's power. It runs
//     hotter with everything it does (its heat shows on it) till it must
//     let it all go: it raises coolant columns about its hall and blows
//     its heat out across the whole of it; get one of the columns between
//     you and it, or burn. Spent, it stands open a while (your blows bite
//     deep). Besides: vents in the floor that blow in turn, a lance of heat
//     swept round it that leaves the floor running with lava, pistons
//     driven down out of the roof where you stand (they stay a while,
//     walls), slag drones that come for you and burst, and at the last the
//     lava let in from the walls, ring by ring, toward it.
//   The Condenser, in the tidal spire off Myrrow, wringing the sea into
//     the storm's rain. Rain it draws over you soaks you (lightning finds
//     you half again as hard, and leaps off you to whoever's beside you);
//     rods it plants about the hall ground it (your blows mostly go into
//     the floor while any stands) and arc to one another; thunder follows you
//     across the floor, strike after strike; a cyclone wanders after you,
//     catching you up and flinging you; a tide sweeps the hall (find the
//     gap in it) and leaves it in puddles it then sends a current through;
//     worn, it draws the air in toward it, you with it, and lets it go in
//     a blast; at the last, hail in spirals.
import { BRAINS, addHazard, lineTiles, areaTiles, summon, bossSlam, phaseSummons, groundFire, COLORS, BOSS_TITLES, detonate } from './monsters.js';
import { phaseOf, ready, used } from './tempo.js';
import { knock } from '../game/combat.js';
import { burn, stun } from '../game/gems.js';
import { B, BLOCKS } from '../world/blocks.js';
import { FY, dist, dmgOf, work, hallOf, inHall, ringTiles, spotIn, cd, shout, proc, openFloor, drag } from './bosskit.js';

const HEAT = ['#ff6020', '#ffb040', '#fff0a0'];
const KAV = ['#5ad8f0', '#c8fbff', '#ffffff'];
const RAIN = ['#8ab8e0', '#c8e0ff', '#5a8ac0'];
const SPARK = ['#fff8a0', '#ffe040', '#ffffff'];
const mid = (tiles) => tiles[Math.floor(tiles.length / 2)] || tiles[0] || { x: 0, z: 0 };
// Those it's fighting: everyone in its hall, up and about.
const foes = (c) => c.game.everyone().filter((p) => p && !p.dead && !p.down && inHall(c, p) && Math.abs(p.y - c.y) <= 2);

// ------------------------------------------------------------ species
const boss = (o) => ({ mode: 'hostile', aggro: 18, under: true, boss: true, big: true, construct: true, anim: true, ...o });
export const SPIRE_BOSSES = {
  crucible: boss({
    name: 'The Crucible', hp: 300, dmg: 7, step: 0.6, fireproof: true, light: 10, brain: 'crucible', tint: ['#ff7020', '#5ad8f0'],
    // (Spent, after it's let its heat go: open to you.)
    ward: (game, c, src, n) => {
      if (!(c.ventT > 0)) return n;
      if (!(c.wardNote > 0)) {
        c.wardNote = 0.6;
        game.renderer.floatText(c.x, c.y + 3, c.z, 'core exposed!', '#ffe070');
      }
      return Math.round(n * 1.6);
    },
    tick: (c, dt) => {
      if (c.wardNote > 0) c.wardNote -= dt;
    },
    phaseLines: ['', '', 'CORE TEMPERATURE CRITICAL.', 'MELTDOWN PROTOCOL ENGAGED.'],
    drops: [['kav_scrap', 5, 9, 1], ['kav_core', 1, 1, 1], ['obsidian_shard', 4, 8, 1], ['gold_ingot', 1, 3, 0.8]],
  }),
  condenser: boss({
    name: 'The Condenser', hp: 280, dmg: 6, step: 0.45, floats: true, light: 9, brain: 'condenser', tint: ['#8ab8ff', '#fff8a0'],
    // (Its rods standing: grounded, it takes your blows mostly into the
    // floor.)
    ward: (game, c, src, n) => {
      const rods = game.creatures.some((o) => !o.dead && o.species === 'storm_rod' && o.summoner === c);
      if (!rods) return n;
      if (!(c.wardNote > 0)) {
        c.wardNote = 0.8;
        game.renderer.floatText(c.x, c.y + 3, c.z, 'grounded by its rods', '#a0d8ff');
      }
      return Math.max(1, Math.round(n * 0.3));
    },
    tick: (c, dt) => {
      if (c.wardNote > 0) c.wardNote -= dt;
    },
    phaseLines: ['', '', 'PRESSURE DIFFERENTIAL RISING.', 'FULL DISCHARGE. FULL DISCHARGE.'],
    drops: [['kav_scrap', 5, 9, 1], ['kav_core', 1, 1, 1], ['pearl', 1, 3, 0.8], ['gem', 1, 2, 0.8]],
  }),
  // (What they bring with them.)
  // A drone of molten slag in an alloy cage: it comes for you, and bursts.
  slag_drone: { name: 'Slag Drone', hp: 9, dmg: 6, step: 0.32, mode: 'hostile', aggro: 18, under: true, construct: true, fireproof: true, floats: true, light: 5, brain: 'slagDrone', drops: [['kav_scrap', 1, 1, 0.4]] },
  // A lightning rod the Condenser drives into its floor: it grounds it,
  // and arcs to the others.
  storm_rod: { name: 'Lightning Rod', hp: 14, dmg: 0, step: 9, mode: 'hostile', aggro: 0, under: true, anchored: true, construct: true, light: 4, brain: 'stormRod', drops: [['kav_scrap', 1, 1, 0.5]] },
};

export const SPIRE_TITLES = {
  crucible: { name: 'The Crucible', title: 'Heart of the Thermal Spire', taunt: 'THERMAL INTAKE NOMINAL. INTRUDER: FUEL.' },
  condenser: { name: 'The Condenser', title: 'Wringer of the Storm\'s Rain', taunt: 'PRECIPITATION FOR THE WALL. YOU WILL DO.' },
};

// ------------------------------------------------------------ shared
// Something solid between `a` and `b` (at a body's height): what shelters
// you from the Crucible's blast.
export function screened(game, a, b) {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const n = Math.ceil(Math.hypot(dx, dz) * 3);
  for (let i = 1; i < n; i++) {
    const x = Math.round(a.x + (dx * i) / n);
    const z = Math.round(a.z + (dz * i) / n);
    if ((x === Math.round(a.x) && z === Math.round(a.z)) || (x === Math.round(b.x) && z === Math.round(b.z))) continue;
    for (const y of [FY, FY + 1]) {
      const id = game.world.getBlock(x, y, z);
      if (BLOCKS[id] && BLOCKS[id].solid) return true;
    }
  }
  return false;
}

// Soaked through: lightning finds you half again as hard, and leaps off
// you to whoever's beside you.
export function soak(game, e, secs = 6) {
  if (!e || e.dead || e.kind !== 'player') return;
  if (!(e.soakT > 0)) game.renderer.floatText(e.x, e.y + 2.4, e.z, 'soaked!', '#a0d0ff');
  e.soakT = Math.max(e.soakT || 0, secs);
}
// A bolt landing on `e` (from the sky, or arcing): soaked, harder, and on
// to whoever's beside.
function shock(game, by, e, n, seen = new Set()) {
  if (!e || e.dead || seen.has(e)) return;
  seen.add(e);
  const wet = e.soakT > 0;
  game.damage(e, dmgOf(by, wet ? Math.round(n * 1.5) : n), by);
  stun(e, wet ? 0.6 : 0.3);
  if (!wet) return;
  game.renderer.floatText(e.x, e.y + 2.6, e.z, 'conducts!', '#fff8a0');
  for (const q of game.everyone()) {
    if (q === e || q.dead || seen.has(q) || Math.max(Math.abs(q.x - e.x), Math.abs(q.z - e.z)) > 2) continue;
    game.renderer.effect?.({ type: 'bolt', wx: e.x, wy: e.y, wz: e.z, tx: q.x, ty: q.y, tz: q.z, life: 0.35, oy: -10 });
    shock(game, by, q, Math.ceil(n / 2), seen);
  }
}
function skyBolt(game, x, z, y) {
  game.renderer.effect?.({ type: 'bolt', from: 'sky', wx: x, wy: y, wz: z, tx: x, ty: y, tz: z, life: 0.45, oy: -4 });
  game.renderer.emit(x, y + 0.5, z, { n: 10, color: SPARK, up: 30, speed: 50, life: 0.4, glow: true });
  game.flash = Math.max(game.flash || 0, 0.25);
  game.audio?.play('thunder', { x, z });
}

// ------------------------------------------------------------ the Crucible
// Its heat: up as it works (and a little all the while), shown on it.
function heatUp(c, n) {
  c.heat = Math.min(100, (c.heat || 0) + n);
}

const CRUCIBLE_WORKS = ['vents', 'lance', 'pistons', 'drones', 'tide'];
const CRUCIBLE_PHASE = { vents: 1, lance: 1, pistons: 1, drones: 2, tide: 3 };

const CRUCIBLE = {
  // Vents in the floor that blow in turn: three waves of them, the last
  // where you went.
  vents(c) {
    const game = c.game;
    const ph = phaseOf(c);
    const waves = ph >= 2 ? 3 : 2;
    game.renderer.floatText(c.x, c.y + 3.2, c.z, 'VENTING', '#ffb040');
    shout(c, 'PRESSURE RELEASE.', '#ffb040');
    proc(game, c, 1.0, waves, (k) => {
      const tiles = [];
      for (const p of foes(c)) {
        const at = spotIn(c, p, 0, 2);
        if (at) tiles.push(at);
      }
      for (let i = 0; i < 5 + k; i++) {
        const at = spotIn(c, c, 2, 9);
        if (at) tiles.push(at);
      }
      for (const v of tiles) {
        const col = areaTiles(v.x, v.z, 0);
        addHazard(game, {
          by: c, tiles: col, y: c.y, dur: 1.0, dmg: dmgOf(c, 5), burn: 2, knock: 2, from: { x: v.x, z: v.z + 0.001 }, center: v, kind: 'fire', color: COLORS.fire, quiet: true,
          onFire: () => {
            game.renderer.emit(v.x, c.y + 0.2, v.z, { n: 18, color: [...HEAT, '#8a8484'], up: 90, speed: 16, gravity: -10, life: 0.9, glow: true, oy: 2 });
            game.renderer.emit(v.x, c.y + 2, v.z, { n: 8, color: ['#c8c0c0', '#8a8484'], up: 40, speed: 12, life: 1.2, shape: 'puff' });
          },
        });
      }
      game.audio?.play('steam', c);
    });
    heatUp(c, 12);
    return true;
  },
  // A lance of heat swept round it in a half circle, the floor it crosses
  // left running with lava a while.
  lance(c) {
    const game = c.game;
    const t = c.target;
    if (!t) return false;
    const ph = phaseOf(c);
    const a0 = Math.atan2(t.z - c.z, t.x - c.x) - (ph >= 2 ? 1.6 : 1.2);
    const steps = ph >= 2 ? 16 : 12;
    const span = (ph >= 2 ? 3.2 : 2.4) / steps;
    const dir = Math.random() < 0.5 ? 1 : -1;
    const start = dir > 0 ? a0 : a0 + span * steps;
    game.renderer.floatText(c.x, c.y + 3.2, c.z, 'THERMAL LANCE', '#ffd060');
    c.stunT = 0.9 + steps * 0.12;
    proc(game, c, 0.12, steps, (k) => {
      const a = start + dir * span * k;
      const to = { x: c.x + Math.cos(a) * 12, z: c.z + Math.sin(a) * 12 };
      const tiles = lineTiles(game, c, to, 12).slice(c.foot || 0);
      if (!tiles.length) return;
      addHazard(game, {
        by: c, tiles, dur: 0.5, dmg: dmgOf(c, 5), burn: 2, kind: 'beam', from: { x: c.x, z: c.z }, to: tiles[tiles.length - 1], color: COLORS.fire, beamColor: '#fff0a0', halo: '#ff6020', width: 4,
        onFire: (g) => {
          for (const q of tiles) if (Math.random() < 0.55 && openFloor(g, q.x, q.z) && !g.everyone().some((p) => p.x === q.x && p.z === q.z)) work(g, q.x, FY, q.z, B.lava, ph >= 3 ? 7 : 5, c);
        },
      });
    }, 0.9);
    heatUp(c, 16);
    return true;
  },
  // Pistons driven down out of the roof where you stand: a slam, and then
  // columns of alloy standing there a while.
  pistons(c) {
    const game = c.game;
    const ph = phaseOf(c);
    const spots = [];
    for (const p of foes(c)) spots.push({ x: p.x, z: p.z });
    while (spots.length < (ph >= 2 ? 5 : 3)) {
      const at = spotIn(c, c.target || c, 1, 5);
      if (!at) break;
      spots.push(at);
    }
    game.renderer.floatText(c.x, c.y + 3.2, c.z, 'PISTONS PRIMED', '#c8fbff');
    spots.forEach((s, i) => {
      const tiles = areaTiles(s.x, s.z, 0).concat([{ x: s.x + 1, z: s.z }, { x: s.x, z: s.z + 1 }, { x: s.x + 1, z: s.z + 1 }]).filter((q) => inHall(c, q));
      addHazard(game, {
        by: c, tiles, y: c.y, dur: 1.1 + i * 0.25, dmg: dmgOf(c, 8), stun: 0.6, kind: 'slam', center: s, radius: 1, color: COLORS.kav,
        onFire: (g) => {
          g.renderer.emit(s.x + 0.5, c.y + 2.5, s.z + 0.5, { n: 12, color: ['#4a4870', '#5ad8f0', '#c8fbff'], up: -20, speed: 30, life: 0.5 });
          // (Standing a while after: walls, till they draw back up. Round
          // 61: and it remembers where, to strike them at you: see hurl.)
          const placed = [];
          for (const q of tiles) {
            if (!openFloor(g, q.x, q.z)) continue;
            if (work(g, q.x, FY, q.z, B.kav_wall, ph >= 3 ? 7 : 5, c)) {
              work(g, q.x, FY + 1, q.z, B.kav_wall, ph >= 3 ? 7 : 5, c);
              placed.push({ x: q.x, z: q.z });
            }
          }
          if (placed.length) (c.pillars ||= []).push({ tiles: placed, life: ph >= 3 ? 7 : 5 });
        },
      });
    });
    heatUp(c, 10);
    return true;
  },
  // Slag drones: they come for you, and burst (and the floor burns).
  drones(c) {
    const game = c.game;
    const ph = phaseOf(c);
    const n = ph >= 3 ? 3 : 2;
    let got = 0;
    for (let i = 0; i < n; i++) if (summon(game, 'slag_drone', c, 3, { level: c.level, color: HEAT })) got++;
    if (!got) return false;
    for (const o of game.creatures) if (!o.dead && o.species === 'slag_drone' && !o.leash) o.leash = c.leash;
    shout(c, 'DEPLOYING SLAG.', '#ffb040');
    heatUp(c, 8);
    return true;
  },
  // (Desperate) The lava let in from the walls, ring by ring, in toward
  // it: the only floor left, near it.
  tide(c) {
    const game = c.game;
    const L = hallOf(c);
    const far = Math.max(c.x - L.x0, L.x1 - c.x, c.z - L.z0, L.z1 - c.z);
    const rings = Math.max(1, far - 3);
    game.renderer.floatText(c.x, c.y + 3.2, c.z, 'CONTAINMENT BREACH', '#ff6020');
    shout(c, 'LET THE MOUNTAIN IN.', '#ff6020', 3);
    game.shake = Math.min(1.2, (game.shake || 0) + 0.4);
    proc(game, c, 0.7, rings, (k) => {
      const r = far - k;
      const tiles = ringTiles(c.x, c.z, r).filter((q) => inHall(c, q) && openFloor(game, q.x, q.z));
      for (const q of tiles) {
        if (game.everyone().some((p) => p.x === q.x && p.z === q.z)) {
          // (Caught in it: burned, and the lava comes in round your feet.)
          addHazard(game, { by: c, tiles: [q], y: c.y, dur: 0.6, dmg: dmgOf(c, 4), burn: 2, kind: 'fire', center: q, color: COLORS.fire, quiet: true });
          continue;
        }
        work(game, q.x, FY, q.z, B.lava, 2.6 + (rings - k) * 0.7, c);
      }
      game.audio?.play('lava', c);
    }, 1.2);
    c.stunT = 1.2 + rings * 0.7;
    heatUp(c, 20);
    return true;
  },
};

// (Round 61) One of its piston walls struck at you: shown coming along
// the floor, then it slides the length of the hall, a tile at a time,
// knocking aside and burning whoever's in its way, and leaving the floor
// it crossed on fire behind it.
function standing(game, p) {
  return p.tiles.every((q) => game.world.getBlock(q.x, FY, q.z) === B.kav_wall);
}
export function hurl(c) {
  const game = c.game;
  const t = c.target;
  if (!t || t.dead) return false;
  c.pillars = (c.pillars || []).filter((p) => standing(game, p));
  const reach = (c.foot || 0) + 4;
  const near = c.pillars.filter((p) => p.tiles.some((q) => Math.max(Math.abs(q.x - c.x), Math.abs(q.z - c.z)) <= reach));
  if (!near.length) return false;
  const pil = near[Math.floor(Math.random() * near.length)];
  const cx = pil.tiles.reduce((a, q) => a + q.x, 0) / pil.tiles.length;
  const cz = pil.tiles.reduce((a, q) => a + q.z, 0) / pil.tiles.length;
  // At you, eight ways round.
  const ang = Math.atan2(t.z - cz, t.x - cx);
  const dx = Math.round(Math.cos(ang));
  const dz = Math.round(Math.sin(ang));
  if (!dx && !dz) return false;
  c.pillars = c.pillars.filter((p) => p !== pil);
  // The way it'll go, shown on the floor.
  const path = [];
  for (let k = 1; k <= 12; k++) for (const q of pil.tiles) {
    const x = q.x + dx * k;
    const z = q.z + dz * k;
    if (inHall(c, { x, z }) && !path.some((o) => o.x === x && o.z === z)) path.push({ x, z });
  }
  c.face(cx, cz);
  c.doAction?.(0.5);
  game.renderer.floatText(c.x, c.y + 3.2, c.z, 'PISTON EJECT', '#ffb040');
  shout(c, 'CLEAR THE CHAMBER.', '#ffb040');
  game.renderer.effect?.({ type: 'ring', wx: cx, wy: c.y + 1, wz: cz, r0: 4, r1: 30, color: HEAT, life: 0.5, oy: 2, flat: 0.5, thick: 2 });
  addHazard(game, { by: c, tiles: path, y: c.y, dur: 0.75, dmg: 0, kind: 'fire', center: path[Math.floor(path.length / 2)] || { x: cx, z: cz }, color: COLORS.fire, quiet: true });
  const life = pil.life;
  let cur = pil.tiles.map((q) => ({ ...q }));
  const hit = new Set();
  proc(game, c, 0.08, 12, () => {
    if (!cur) return;
    const next = cur.map((q) => ({ x: q.x + dx, z: q.z + dz }));
    const own = (x, z) => cur.some((q) => q.x === x && q.z === z);
    // (Into a wall, or out of the hall: it stops there, with a crash.)
    const blocked = next.some((q) => !inHall(c, q) || (!own(q.x, q.z) && !openFloor(game, q.x, q.z, true)) || (c.foot && Math.abs(q.x - c.x) <= c.foot && Math.abs(q.z - c.z) <= c.foot));
    if (blocked) {
      game.renderer.emit(cur[0].x, c.y + 1, cur[0].z, { n: 14, color: ['#4a4870', '#5ad8f0', ...HEAT], up: 30, speed: 50, life: 0.6 });
      game.shake = Math.min(1, (game.shake || 0) + 0.3);
      game.audio?.play('boom', c);
      cur = null;
      return;
    }
    // Whoever's in the way: struck, burned and thrown aside.
    for (const p of game.everyone()) {
      if (p.dead || !next.some((q) => q.x === p.x && q.z === p.z) || Math.abs(p.y - c.y) > 2) continue;
      if (!hit.has(p) && !(p.rollT > 0)) {
        hit.add(p);
        game.damage(p, dmgOf(c, 7), c);
        burn(game, p, c, 2);
      }
      knock(game, { x: p.x - dx, z: p.z - dz }, p, 2);
    }
    // Moved on: off the old floor, onto the new.
    const w = game.world;
    for (const q of cur) {
      if (next.some((o) => o.x === q.x && o.z === q.z)) continue;
      for (const y of [FY, FY + 1]) {
        if (w.getBlock(q.x, y, q.z) === B.kav_wall) w.setBlock(q.x, y, q.z, B.air);
        game.works = (game.works || []).filter((o) => !(o.x === q.x && o.y === y && o.z === q.z));
      }
      // (And a burning trail behind it.)
      groundFire(game, q.x, q.z, FY, c);
      game.renderer.emit(q.x, c.y + 0.3, q.z, { n: 3, color: HEAT, up: 20, speed: 10, life: 0.5, glow: true });
    }
    const placed = [];
    for (const q of next) {
      if (own(q.x, q.z)) {
        placed.push(q);
        continue;
      }
      if (work(game, q.x, FY, q.z, B.kav_wall, life, c)) {
        work(game, q.x, FY + 1, q.z, B.kav_wall, life, c);
        placed.push(q);
      }
    }
    cur = placed.length ? placed : null;
    if (Math.random() < 0.5) game.audio?.play('rumble', c);
  }, 0.75);
  heatUp(c, 8);
  return true;
}

// Too hot: coolant columns thrown up about the hall, a count, and its heat
// blown out across the whole of it. Only those with a column between them
// and it are spared.
function overheat(c) {
  const game = c.game;
  c.overheat = { t: 0, cols: [] };
  c.stunT = 4.4;
  used(c, 3.5);
  const want = Math.max(3, foes(c).length + 2);
  const raise = (at) => {
    if (!at || !inHall(c, at) || !openFloor(game, at.x, at.z) || c.overheat.cols.some((q) => Math.abs(q.x - at.x) + Math.abs(q.z - at.z) < 3)) return false;
    if (!work(game, at.x, FY, at.z, B.kav_coolant, 7, c)) return false;
    work(game, at.x, FY + 1, at.z, B.kav_coolant, 7, c);
    c.overheat.cols.push(at);
    game.renderer.emit(at.x, c.y + 1.5, at.z, { n: 14, color: KAV, up: 40, speed: 20, life: 0.8, glow: true });
    return true;
  };
  // (One on each of your sides of it, a few paces out, so there's always
  // somewhere to get to in time; the rest about the hall.)
  for (const p of foes(c)) {
    const a = Math.atan2(p.z - c.z, p.x - c.x);
    const r = (c.foot || 0) + 3;
    for (const da of [0, 0.4, -0.4, 0.8, -0.8]) if (raise({ x: Math.round(c.x + Math.cos(a + da) * r), z: Math.round(c.z + Math.sin(a + da) * r) })) break;
  }
  for (let i = 0; i < 30 && c.overheat.cols.length < want; i++) raise(spotIn(c, c, 3, 7));
  game.renderer.floatText(c.x, c.y + 3.6, c.z, 'CORE OVERHEAT', '#ff4020');
  shout(c, 'VENTING ALL HEAT. SHIELD YOURSELF, IF YOU CAN.', '#ff6020', 3.5);
  if (!game.toldOverheat) game.ui.msg('The Crucible is overheating! Get one of the coolant columns between you and it before it blows.', '#ffb040', true);
  game.toldOverheat = true;
  game.audio?.play('charge', c);
}
function overheatTick(c, dt) {
  const game = c.game;
  const o = c.overheat;
  o.t += dt;
  const left = 3.6 - o.t;
  const count = Math.ceil(left);
  if (count !== o.shown && count > 0) {
    o.shown = count;
    game.renderer.floatText(c.x, c.y + 3.4, c.z, `${count}...`, count === 1 ? '#ffffff' : '#ffb040');
    game.audio?.play('beep', c);
  }
  if (Math.random() < dt * 20) game.renderer.emit(c.x + (Math.random() - 0.5) * 3, c.y + 1.5, c.z + (Math.random() - 0.5) * 3, { n: 1, color: HEAT, up: 40, speed: 10, life: 0.6, glow: true });
  if (left > 0) return;
  // The blast.
  c.overheat = null;
  c.heat = 0;
  c.ventT = 5;
  c.stunT = Math.max(c.stunT || 0, 0.5);
  game.renderer.effect?.({ type: 'blast', wx: c.x, wy: c.y, wz: c.z, r1: 120, life: 0.9, oy: 2 });
  game.renderer.effect?.({ type: 'ring', wx: c.x, wy: c.y, wz: c.z, r0: 10, r1: 200, color: [...HEAT], life: 0.7, oy: 2, flat: 0.5, thick: 4 });
  game.shake = Math.min(1.6, (game.shake || 0) + 1.0);
  game.flash = Math.max(game.flash || 0, 0.35);
  game.audio?.play('boom', c);
  for (const p of foes(c)) {
    if (screened(game, c, p)) {
      game.renderer.floatText(p.x, p.y + 2.4, p.z, 'sheltered', '#a0f0ff');
      continue;
    }
    if (p.rollT > 0) {
      // (A roll doesn't save you from this.)
    }
    game.damage(p, dmgOf(c, 12), c);
    burn(game, p, c, 3);
    knock(game, c, p, 2);
  }
  game.renderer.floatText(c.x, c.y + 3.4, c.z, 'core exposed: strike now!', '#ffe070');
  shout(c, 'COOLING. COOLING.', '#a0f0ff', 3);
}

// ------------------------------------------------------------ the Condenser
const CONDENSER_WORKS = ['rain', 'thunder', 'cyclone', 'surge', 'collapse', 'hail'];
const CONDENSER_PHASE = { rain: 1, thunder: 1, cyclone: 1, surge: 1, collapse: 2, hail: 3 };

const CONDENSER = {
  // Rain drawn down over where you are: it soaks you (and slows you a
  // little in it).
  rain(c) {
    const game = c.game;
    const t = c.target;
    if (!t) return false;
    const at = { x: t.x, z: t.z };
    const R = phaseOf(c) >= 2 ? 4 : 3;
    const tiles = areaTiles(at.x, at.z, R, true).filter((q) => inHall(c, q));
    game.renderer.floatText(at.x, t.y + 3, at.z, 'a cloudburst!', '#a0c8ff');
    proc(game, c, 0.25, 26, () => {
      for (let i = 0; i < 6; i++) {
        const q = tiles[Math.floor(Math.random() * tiles.length)];
        if (q) game.renderer.emit(q.x, c.y + 3.5, q.z, { n: 1, color: RAIN, up: -80, speed: 4, gravity: 200, life: 0.35 });
      }
      for (const p of foes(c)) {
        if (!tiles.some((q) => q.x === p.x && q.z === p.z)) continue;
        soak(game, p, 7);
        p.slowT = Math.max(p.slowT || 0, 0.3);
      }
    });
    game.audio?.play('rain', c);
    return true;
  },
  // Thunder following you across the floor: strike after strike where you
  // stand (or stood).
  thunder(c) {
    const game = c.game;
    const ph = phaseOf(c);
    const n = ph >= 3 ? 5 : ph >= 2 ? 4 : 3;
    game.renderer.floatText(c.x, c.y + 3.2, c.z, 'THUNDERHEAD', '#fff8a0');
    proc(game, c, 0.55, n, () => {
      for (const p of foes(c)) {
        const at = { x: p.x, z: p.z };
        const wet = p.soakT > 0;
        addHazard(game, {
          by: c, tiles: areaTiles(at.x, at.z, wet ? 1 : 0), y: c.y, dur: 0.9, dmg: 0, kind: 'burst', center: at, color: [255, 240, 120], quiet: true,
          onFire: (g) => {
            skyBolt(g, at.x, at.z, c.y);
            for (const q of foes(c)) if (Math.max(Math.abs(q.x - at.x), Math.abs(q.z - at.z)) <= (wet ? 1 : 0) && !(q.rollT > 0)) shock(g, c, q, 4);
          },
        });
      }
    });
    return true;
  },
  // A cyclone wandering after you: whoever it catches is whirled in and
  // flung.
  cyclone(c) {
    const game = c.game;
    const t = c.target;
    if (!t) return false;
    const at = spotIn(c, c, 2, 3) || { x: c.x + 2, z: c.z };
    const cy = { x: at.x, z: at.z };
    game.renderer.floatText(cy.x, c.y + 3, cy.z, 'a cyclone!', '#c8e0ff');
    const ph = phaseOf(c);
    proc(game, c, 0.22, ph >= 2 ? 40 : 30, (k) => {
      const tg = c.target && !c.target.dead ? c.target : null;
      if (tg && k % 3 === 0) {
        const dx = Math.sign(tg.x - cy.x);
        const dz = Math.sign(tg.z - cy.z);
        const nx = cy.x + (Math.abs(tg.x - cy.x) >= Math.abs(tg.z - cy.z) ? dx : 0);
        const nz = cy.z + (Math.abs(tg.x - cy.x) >= Math.abs(tg.z - cy.z) ? 0 : dz);
        if (inHall(c, { x: nx, z: nz }) && openFloor(game, nx, nz)) {
          cy.x = nx;
          cy.z = nz;
        }
      }
      for (let i = 0; i < 4; i++) {
        const a = Math.random() * Math.PI * 2;
        game.renderer.emit(cy.x + Math.cos(a) * 0.8, c.y + 0.3 + Math.random() * 2.4, cy.z + Math.sin(a) * 0.8, { n: 1, color: ['#c8d8e8', '#8aa0b8', '#ffffff'], up: 30, speed: 30, life: 0.5, shape: 'puff' });
      }
      for (const p of foes(c)) {
        const d = Math.max(Math.abs(p.x - cy.x), Math.abs(p.z - cy.z));
        // (Just flung: a moment to find your feet before it has you again.)
        if (p.flungT > 0) p.flungT -= 0.22;
        if (d > 1 || p.rollT > 0 || p.flungT > 0) continue;
        if (d === 1) {
          drag(game, p, cy, 1);
          continue;
        }
        // (In the eye of it: whirled round and flung.)
        p.flungT = 1.6;
        game.damage(p, dmgOf(c, 3), c);
        knock(game, { x: cy.x + (Math.random() - 0.5), z: cy.z + (Math.random() - 0.5) }, p, 3);
        game.renderer.floatText(p.x, p.y + 2.4, p.z, 'flung!', '#c8e0ff');
      }
    });
    game.audio?.play('wind', c);
    return true;
  },
  // A tide swept across the hall (one gap in it), leaving puddles; then a
  // current sent through them.
  surge(c) {
    const game = c.game;
    const L = hallOf(c);
    const alongX = Math.random() < 0.5;
    const back = Math.random() < 0.5;
    const len = alongX ? L.x1 - L.x0 : L.z1 - L.z0;
    const gapAt = (alongX ? L.z0 : L.x0) + 2 + Math.floor(Math.random() * Math.max(1, (alongX ? L.z1 - L.z0 : L.x1 - L.x0) - 4));
    const puddles = [];
    game.renderer.floatText(c.x, c.y + 3.2, c.z, 'TIDAL INTAKE', '#80c0ff');
    shout(c, 'THE SEA COMES IN.', '#80c0ff');
    proc(game, c, 0.2, len + 1, (k) => {
      const at = back ? (alongX ? L.x1 : L.z1) - k : (alongX ? L.x0 : L.z0) + k;
      const tiles = [];
      for (let w = alongX ? L.z0 : L.x0; w <= (alongX ? L.z1 : L.x1); w++) {
        if (Math.abs(w - gapAt) <= 1) continue;
        const q = alongX ? { x: at, z: w } : { x: w, z: at };
        if (openFloor(game, q.x, q.z)) tiles.push(q);
      }
      if (!tiles.length) return;
      const from = alongX ? { x: at - (back ? -1 : 1), z: c.z } : { x: c.x, z: at - (back ? -1 : 1) };
      addHazard(game, { by: c, tiles, y: c.y, dur: 0.45, dmg: dmgOf(c, 4), knock: 2, from, kind: 'cold', center: mid(tiles), color: [90, 150, 230], quiet: true, onFire: (g, h, hit) => hit.forEach((e) => soak(g, e, 8)) });
      for (const q of tiles) {
        if (Math.random() < 0.25) game.renderer.emit(q.x, c.y + 0.4, q.z, { n: 2, color: RAIN, up: 40, speed: 20, gravity: 160, life: 0.5 });
        if (Math.random() < 0.18) puddles.push(q);
      }
    }, 0.8);
    // The current, once the water's lying: through every puddle.
    proc(game, c, 1, 1, () => {
      if (!puddles.length) return;
      game.renderer.floatText(c.x, c.y + 3.2, c.z, 'CURRENT', '#fff8a0');
      addHazard(game, {
        by: c, tiles: puddles, y: c.y, dur: 1.2, dmg: 0, kind: 'burst', center: mid(puddles), color: [255, 240, 120], quiet: true,
        onFire: (g) => {
          for (const q of puddles) if (Math.random() < 0.3) g.renderer.emit(q.x, c.y + 0.3, q.z, { n: 2, color: SPARK, up: 20, speed: 30, life: 0.3, glow: true });
          for (const p of foes(c)) if (puddles.some((q) => q.x === p.x && q.z === p.z) && !(p.rollT > 0)) shock(g, c, p, 4);
          g.audio?.play('zap', c);
        },
      });
      for (const q of puddles) game.renderer.emit(q.x, c.y + 0.1, q.z, { n: 3, color: RAIN, up: 6, speed: 6, life: 1.2 });
    }, 0.8 + len * 0.2 + 0.6);
    c.stunT = 0.8;
    return true;
  },
  // (Worn) The air drawn in toward it (you with it), and let go in a blast.
  collapse(c) {
    const game = c.game;
    c.stunT = 3.4;
    game.renderer.floatText(c.x, c.y + 3.4, c.z, 'PRESSURE DROP', '#c8e0ff');
    shout(c, 'INHALE.', '#c8e0ff', 2.5);
    proc(game, c, 0.3, 8, () => {
      for (const p of foes(c)) if (dist(c, p) > 0) drag(game, p, c, 1);
      for (let i = 0; i < 6; i++) {
        const a = Math.random() * Math.PI * 2;
        const r = 4 + Math.random() * 3;
        game.renderer.emit(c.x + Math.cos(a) * r, c.y + 1, c.z + Math.sin(a) * r, { n: 1, color: ['#c8e0ff', '#ffffff'], up: 0, speed: 0, life: 0.4, toward: { x: c.x, z: c.z }, shape: 'puff' });
      }
    });
    const R = 4 + (c.foot || 0);
    addHazard(game, {
      by: c, tiles: areaTiles(c.x, c.z, R, true), y: c.y, dur: 2.7, dmg: dmgOf(c, 8), knock: 3, stun: 0.4, from: { x: c.x, z: c.z }, center: { x: c.x, z: c.z }, radius: R, kind: 'slam', color: [160, 200, 255],
      onFire: (g) => {
        g.renderer.effect?.({ type: 'ring', wx: c.x, wy: c.y, wz: c.z, r0: 6, r1: 110, color: ['#c8e0ff', '#ffffff'], life: 0.6, oy: 2, flat: 0.5, thick: 3 });
        g.audio?.play('boom', c);
      },
    });
    return true;
  },
  // (Desperate) Hail in spirals out from it.
  hail(c) {
    const game = c.game;
    const arms = 3;
    game.renderer.floatText(c.x, c.y + 3.2, c.z, 'HAIL', '#e0f4ff');
    const off = Math.random() * Math.PI * 2;
    proc(game, c, 0.16, 18, (k) => {
      const tiles = [];
      for (let a = 0; a < arms; a++) {
        const ang = off + (a / arms) * Math.PI * 2 + k * 0.32;
        const r = 2 + k * 0.45 + (c.foot || 0);
        const q = { x: Math.round(c.x + Math.cos(ang) * r), z: Math.round(c.z + Math.sin(ang) * r) };
        if (inHall(c, q) && openFloor(game, q.x, q.z)) tiles.push(q);
      }
      for (const q of tiles) addHazard(game, { by: c, tiles: [q], y: c.y, dur: 0.7, dmg: dmgOf(c, 3), chill: 2, kind: 'cold', center: q, color: [200, 230, 255], quiet: true });
    });
    return true;
  },
};

// Its rods: planted about the hall (three, four when it's worn), arcing
// to one another every so often while they stand.
function plantRods(c) {
  const game = c.game;
  const n = phaseOf(c) >= 2 ? 4 : 3;
  let got = 0;
  for (let i = 0; i < n * 3 && got < n; i++) {
    const at = spotIn(c, c, 4, 8);
    if (!at) continue;
    const r = summon(game, 'storm_rod', at, 0, { level: c.level, color: SPARK });
    if (!r) continue;
    r.summoner = c;
    r.leash = c.leash;
    got++;
    skyBolt(game, r.x, r.z, r.y);
  }
  if (got) {
    shout(c, 'GROUNDING ARRAY DEPLOYED.', '#a0d8ff');
    if (!game.toldRods) game.ui.msg('The Condenser plants lightning rods: while any stands it\'s grounded (your blows hardly touch it), and they arc to one another. Break them!', '#a0d8ff', true);
    game.toldRods = true;
  }
  return got > 0;
}
function arcRods(c) {
  const game = c.game;
  const rods = game.creatures.filter((o) => !o.dead && o.species === 'storm_rod' && o.summoner === c);
  if (rods.length < 2) return false;
  for (let i = 0; i < rods.length; i++) {
    const a = rods[i];
    const b = rods[(i + 1) % rods.length];
    if (rods.length === 2 && i === 1) break;
    const tiles = lineTiles(game, a, b, 20).filter((q) => !(q.x === b.x && q.z === b.z));
    if (!tiles.length) continue;
    addHazard(game, {
      by: c, tiles, y: c.y, dur: 1.1, dmg: 0, kind: 'beam', from: { x: a.x, z: a.z }, to: { x: b.x, z: b.z }, color: [255, 240, 120], beamColor: '#ffffff', halo: '#fff070', width: 2,
      onFire: (g, h, hit) => {
        g.renderer.effect?.({ type: 'bolt', wx: a.x, wy: a.y, wz: a.z, tx: b.x, ty: b.y, tz: b.z, life: 0.4, oy: -14 });
        for (const e of hit) if (e.kind === 'player') shock(g, c, e, 4);
      },
    });
  }
  game.audio?.play('zap', c);
  return true;
}

// ------------------------------------------------------------ brains
// One of its works in turn (each phase bringing out more of them).
function nextWork(c, list, phases) {
  const ph = phaseOf(c);
  const open = list.filter((k) => phases[k] <= ph);
  let i = c.workI ?? Math.floor(Math.random() * list.length);
  for (let n = 0; n < list.length; n++) {
    i = (i + 1) % list.length;
    if (open.includes(list[i])) {
      c.workI = i;
      return list[i];
    }
  }
  return null;
}

export const SPIRE_BRAINS = {
  crucible(c, dt) {
    const game = c.game;
    const t = c.target;
    const ph = phaseOf(c);
    if (c.ventT > 0) {
      c.ventT -= dt;
      if (Math.random() < dt * 8) game.renderer.emit(c.x, c.y + 2, c.z, { n: 1, color: ['#c8c0c0', '#a0f0ff'], up: 30, speed: 10, life: 0.8, shape: 'puff' });
      // (Cooling: it does nothing but turn to keep you in sight.)
      if (t) c.face(t.x, t.z);
      return true;
    }
    phaseSummons(c, [0.66, 0.33], () => {
      for (let i = 0; i < 2; i++) summon(game, 'slag_drone', c, 3, { level: c.level, color: HEAT });
      for (const o of game.creatures) if (!o.dead && o.species === 'slag_drone' && !o.leash) o.leash = c.leash;
    });
    if (c.overheat) {
      overheatTick(c, dt);
      return true;
    }
    // Its heat climbing all the while (quicker the more it's worn).
    heatUp(c, dt * (ph >= 3 ? 4 : ph >= 2 ? 3 : 2));
    if (Math.random() < dt * (c.heat / 25)) game.renderer.emit(c.x + (Math.random() - 0.5) * 2, c.y + 2.4, c.z + (Math.random() - 0.5) * 2, { n: 1, color: HEAT, up: 30, speed: 8, life: 0.6, glow: true });
    if (c.heat >= 100 && ready(c) && !c.windup) {
      overheat(c);
      return true;
    }
    if (!t || t.dead) return true;
    // Its works, in turn.
    if (cd(c, 'workCd', dt, 2.5) && ready(c) && !c.windup) {
      const k = nextWork(c, CRUCIBLE_WORKS, CRUCIBLE_PHASE);
      const ok = k && CRUCIBLE[k](c);
      c.workCd = ok ? (ph >= 3 ? 4 : ph >= 2 ? 4.8 : 5.6) : 1;
      if (ok) {
        used(c, 0.5);
        return true;
      }
    }
    // (Round 61) One of its piston walls struck at you, when there's one
    // standing near.
    if (c.pillars && c.pillars.length && cd(c, 'hurlCd', dt, 1.5) && ready(c) && !c.windup) {
      if (hurl(c)) {
        c.hurlCd = ph >= 2 ? 3.2 : 4.5;
        used(c, 0.6);
        return true;
      }
      c.hurlCd = 1;
    }
    // Close: a slam of its great frame.
    if (bossSlam(c, dt, 2, 0.9, 8, ph >= 2 ? 3.5 : 4.5)) {
      heatUp(c, 4);
      return true;
    }
    // A jet of flame at you (it keeps you at arm's length).
    if (cd(c, 'jetCd', dt, 3) && ready(c) && dist(c, t) >= 2 && dist(c, t) <= 8 && !c.windup) {
      c.jetCd = ph >= 2 ? 3.5 : 4.5;
      used(c);
      c.face(t.x, t.z);
      const tiles = lineTiles(game, c, t, 8).slice(c.foot || 0);
      if (tiles.length) addHazard(game, { by: c, tiles, dur: 0.8, dmg: dmgOf(c, 4), burn: 2, kind: 'fire', center: mid(tiles), color: COLORS.fire });
      heatUp(c, 4);
      return true;
    }
    return false;
  },

  condenser(c, dt) {
    const game = c.game;
    const t = c.target;
    const ph = phaseOf(c);
    phaseSummons(c, [0.66, 0.33], () => {
      plantRods(c);
      c.rodCd = 14;
    });
    // Drizzle off it, always.
    if (Math.random() < dt * 6) game.renderer.emit(c.x + (Math.random() - 0.5) * 3, c.y + 2.6, c.z + (Math.random() - 0.5) * 3, { n: 1, color: RAIN, up: -40, speed: 4, gravity: 120, life: 0.5 });
    // (Those soaked drip.)
    for (const p of foes(c)) if (p.soakT > 0 && Math.random() < dt * 4) game.renderer.emit(p.x, p.y + 1.6, p.z, { n: 1, color: RAIN, up: -10, speed: 4, gravity: 120, life: 0.4 });
    if (!t || t.dead) return true;
    // Its rods: planted when none stand; and arcing while they do.
    const rods = game.creatures.filter((o) => !o.dead && o.species === 'storm_rod' && o.summoner === c).length;
    if (!rods && cd(c, 'rodCd', dt, 1.5) && ready(c)) {
      c.rodCd = ph >= 3 ? 12 : 16;
      if (plantRods(c)) {
        used(c, 0.4);
        return true;
      }
    }
    if (rods >= 2 && cd(c, 'arcCd', dt, 3) && ready(c)) {
      c.arcCd = ph >= 2 ? 4 : 5.5;
      if (arcRods(c)) {
        used(c, 0.2);
        return true;
      }
    }
    // Its works, in turn.
    if (cd(c, 'workCd', dt, 2) && ready(c) && !c.windup) {
      const k = nextWork(c, CONDENSER_WORKS, CONDENSER_PHASE);
      const ok = k && CONDENSER[k](c);
      c.workCd = ok ? (ph >= 3 ? 3.8 : ph >= 2 ? 4.6 : 5.4) : 1;
      if (ok) {
        used(c, 0.5);
        return true;
      }
    }
    // A bolt at you (from it), forking off you if you're soaked.
    if (cd(c, 'boltCd', dt, 2.5) && ready(c) && dist(c, t) <= 9 && !c.windup) {
      c.boltCd = ph >= 2 ? 3.6 : 4.8;
      used(c);
      const at = { x: t.x, z: t.z };
      addHazard(game, {
        by: c, tiles: [at], y: c.y, dur: 0.8, dmg: 0, kind: 'burst', center: at, color: [255, 240, 120], quiet: true,
        onFire: (g) => {
          g.renderer.effect?.({ type: 'bolt', wx: c.x, wy: c.y + 1.5, wz: c.z, tx: at.x, ty: c.y, tz: at.z, life: 0.4, oy: -14 });
          for (const q of foes(c)) if (q.x === at.x && q.z === at.z && !(q.rollT > 0)) shock(g, c, q, 4);
          g.audio?.play('zap', at);
        },
      });
      return true;
    }
    // It keeps off: a drift away when you're close.
    if (!c.moving && dist(c, t) <= 2) {
      const sx = Math.sign(c.x - t.x) || 1;
      const sz = Math.sign(c.z - t.z) || 1;
      c.tryStep(c.x + sx, c.z, c.S.step) || c.tryStep(c.x, c.z + sz, c.S.step);
      return true;
    }
    return false;
  },

  // A slag drone: straight for whoever's nearest, and bursts beside them
  // (the floor left burning).
  slagDrone(c, dt) {
    const game = c.game;
    const t = c.target;
    if (!t || t.dead) return false;
    if (Math.random() < dt * 8) game.renderer.emit(c.x, c.y + 0.6, c.z, { n: 1, color: HEAT, up: -10, speed: 6, gravity: 80, life: 0.5, glow: true });
    if (dist(c, t) <= 1 && !c.armed) {
      detonate(game, c, 0.7);
      for (const q of areaTiles(c.x, c.z, 1)) if (Math.random() < 0.6) groundFire(game, q.x, q.z, c.y, c.summoner || c, false, 0);
      return true;
    }
    return false;
  },

  // A lightning rod: it stands, crackling.
  stormRod(c, dt) {
    if (Math.random() < dt * 3) c.game.renderer.emit(c.x, c.y + 1.8, c.z, { n: 1, color: SPARK, up: 20, speed: 20, life: 0.25, glow: true });
    return true;
  },
};

Object.assign(BRAINS, SPIRE_BRAINS);
Object.assign(BOSS_TITLES, SPIRE_TITLES);
