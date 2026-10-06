// The masters of the far lands' old places (round 68: see
// world/fardeep.js): two to each kind of place in each land, none of them
// met anywhere else, and harder than the Dagoni Islands' (see
// FAR_BOSS_HP). Each fights in a way of its own, out of a common stock of
// works (see MOVES below: a breath, a beam, a slam rippling out, a rain, a
// charge, a mark that comes down where you stood, a wall marching across
// the hall, a ward, a tide let in, a floor turned to ice or bog or salt,
// lightning, a swap of places...), each its own few, in its own colours,
// coming round at its own pace, the worst kept for when it's worn down.
//   Velmarch, cold and imperial: the Frost Jarl and the Barrow Mammoth;
//     the Iron Legate and the Silver Wyrm; the Pale Vestal and the Marble
//     Colossus; the Deserter General and the War Eagle; and in the
//     Imperial Catacombs, the Last Emperor and the Bronze Wolf.
//   Ostria, of jade and red rock: the Jade Corpse-Lord and the
//     Skinwalker; the Turquoise Golem and the Great Centipede; the
//     Nine-Tailed Fox and the Hungry Ghost; the Bandit Khan and the
//     Thunderbird; and in the Terracotta Vaults, the Terracotta General
//     and the Jade Dragon.
//   Corrow, whale-bone and grim: the Bone Thane and the Carrion Roc; the
//     Scrimshaw Horror and the Oil Bloat; the Whale Priest and the Kraken
//     Spawn; the Harpoon Queen and the Bull Walrus; and in the
//     Leviathan's Gut, the Leviathan's Heart and the Gut Wyrm.
//   Saltmere, white and pink: the Salt Mummy and the Brine Crab King; the
//     Crystal Matriarch and the Salt Wyrm; the Salt Bride and the Flamingo
//     Seraph; the Salt Doge and the Lagoon Hydra; and in the Salt
//     Cathedrals, the Salt Mother and the Mirage Lion.
//   Hollowmark, of burrows and lanterns: the Mole King and the Root Witch;
//     the Glowworm Queen and the Deep Golem; the Moth Queen and the
//     Lamplighter; the Burrow Baron and the Cave Bear; and in the Deep
//     Warrens, the First Digger and the Thing Below.
//   The Wyrd Isle, of the fair folk: the Raven Queen and the Antlered
//     One; the Rune Golem and the Ninth Wyrm; the Rune Witch and the
//     Banshee; the Fey Reaver and the White Hart; and in the Hollow Hills,
//     the Fair King and the Hill Sleeper.
//   The Grey Skerries, of gales and the sea: the Trow King and the
//     Finnman; the Storm Giant and the Stack Crab; the Selkie Widow and the
//     Drowned Bell; the Wrecker and the Storm Petrel; and in the Drowned
//     Brochs, the Beacon-Keeper and the Sea Trow.
import { BRAINS, addHazard, addZone, lob, lineTiles, areaTiles, summon, phaseSummons, BOSS_TITLES } from './monsters.js';
import { phaseOf, ready, used } from './tempo.js';
import { beginAttack, styleOf } from '../game/combat.js';
import { ink, plunder } from '../game/afflict.js';
import { B } from '../world/blocks.js';
import { FY, dist, sees, dmgOf, work, hallOf, inHall, circleTiles, ringTiles, coneTiles, wallTiles, spotIn, blinkTo, cd, shout, proc, openFloor, drag } from './bosskit.js';

const TAU = Math.PI * 2;
const mid = (tiles) => tiles[Math.floor(tiles.length / 2)] || tiles[0] || { x: 0, z: 0 };
const pick = (a) => a[Math.floor(Math.random() * a.length)];

// The colours of each land's works: telegraphs [r, g, b], and the puffs.
const FROST = { c: [170, 220, 255], p: ['#c8e8ff', '#ffffff', '#80b8e0'] };
const GOLD = { c: [255, 210, 110], p: ['#ffe090', '#fff8e0', '#c89030'] };
const MARBLE = { c: [235, 230, 220], p: ['#ffffff', '#e8e0d0', '#c8c0b0'] };
const JADE = { c: [100, 220, 150], p: ['#80e0a8', '#e0fff0', '#2a8a5a'] };
const RED = { c: [230, 90, 60], p: ['#ff8060', '#ffd0a0', '#a03020'] };
const STORM = { c: [190, 200, 255], p: ['#e0e8ff', '#ffffff', '#8090c0'] };
const BONE = { c: [230, 220, 200], p: ['#f0e8d8', '#c8b898', '#ffffff'] };
const BILE = { c: [170, 200, 80], p: ['#a8c040', '#d8e870', '#6a7a2a'] };
const INK = { c: [120, 80, 140], p: ['#5a3a6a', '#2a1a3a', '#a080c0'] };
const SEA = { c: [110, 190, 230], p: ['#80c8e8', '#e0f8ff', '#3a8ab0'] };
const SALT = { c: [245, 240, 248], p: ['#ffffff', '#f8e0ec', '#d8d0e0'] };
const PINK = { c: [250, 150, 190], p: ['#ff9ac0', '#ffe0ee', '#d8608a'] };
const EARTH = { c: [180, 140, 90], p: ['#7a5a3a', '#a8885a', '#5a4430'] };
const LAMP = { c: [255, 200, 90], p: ['#ffd070', '#fff0b0', '#c88020'] };
const FEY = { c: [200, 160, 255], p: ['#c8a0ff', '#80ffd0', '#ffffff'] };
const RUNE = { c: [120, 230, 255], p: ['#80e8ff', '#e0ffff', '#3080c0'] };
const GALE = { c: [180, 210, 230], p: ['#c8e0f0', '#ffffff', '#6a8aa0'] };
const FIRE = { c: [255, 130, 40], p: ['#ff9030', '#ffd060', '#ff4020'] };

// A hazard of `c`'s over these tiles (in its hall, on its floor), as `o`
// has it: its kind, its warning, its harm and what else it does.
function hz(game, c, o, tiles, extra = {}) {
  const T = tiles.filter((q) => inHall(c, q) && openFloor(game, q.x, q.z, true));
  if (!T.length) return null;
  const P = o.pal || GOLD;
  return addHazard(game, {
    by: c, tiles: T, y: c.y, dur: o.dur ?? 1.1, dmg: o.dmg === 0 ? 0 : dmgOf(c, o.dmg ?? 5), kind: o.kind || 'erupt', color: o.color || P.c, center: mid(T),
    chill: o.chill, burn: o.burn, stun: o.stun, drain: o.drain, knock: o.knock, from: o.knock ? o.from || { x: c.x, z: c.z } : undefined, quiet: T.length > 12, radius: o.r,
    ...extra,
  });
}
const puff = (game, at, P, n = 14) => game.renderer.emit(at.x, (at.y ?? FY) + 1, at.z, { n, color: P.p, up: 26, speed: 30, life: 0.8, glow: true });

// ------------------------------------------------------------ the works
// Each: (c, t, game, o) -> true if it went off.
export const MOVES = {
  // A breath, a spray, a scream: a cone toward you.
  breath(c, t, game, o) {
    const tiles = coneTiles(c, t, (o.len || 5) + (c.foot || 0), o.spread || 0.55);
    c.face(t.x, t.z);
    const h = hz(game, c, { kind: 'cold', dur: 1.0, ...o }, tiles, { onFire: () => (c.inhale = false) });
    if (h) c.inhale = true;
    return !!h;
  },
  // A beam (or a fan of them) straight at you, to the wall.
  beam(c, t, game, o) {
    const n = o.n || 1;
    const base = Math.atan2(t.z - c.z, t.x - c.x);
    let any = false;
    for (let k = 0; k < n; k++) {
      const a = base + (k - (n - 1) / 2) * (o.fan || 0.4);
      const aim = { x: Math.round(c.x + Math.cos(a) * 10), z: Math.round(c.z + Math.sin(a) * 10) };
      const tiles = lineTiles(game, c, aim, o.len || 12);
      if (!tiles.length) continue;
      const h = hz(game, c, { kind: 'beam', dur: 1.0, ...o }, tiles, { from: { x: c.x, z: c.z }, to: tiles[tiles.length - 1], beamColor: o.beam || o.pal?.p[1] || '#ffffff', halo: o.halo || o.pal?.p[0] || '#ffd060', width: o.width || 3 });
      if (h && o.drainBeam) h.onFire = (g, hh, hit) => {
        if (hit.length) c.hp = Math.min(c.maxHp, c.hp + hh.dmg * hit.length);
        if (hit.length) g.renderer.floatText(c.x, c.y + 3, c.z, `+${hh.dmg * hit.length}`, '#80ff90');
      };
      any = any || !!h;
    }
    return any;
  },
  // Beams out from it (or from you) the four ways, or the eight.
  cross(c, t, game, o) {
    const at = o.onYou ? t : c;
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    if (o.diag) dirs.push([1, 1], [1, -1], [-1, 1], [-1, -1]);
    if (o.only === 'diag') dirs.splice(0, 4);
    let any = false;
    for (const [dx, dz] of dirs) {
      const tiles = [...(o.onYou ? [{ x: at.x, z: at.z }] : []), ...lineTiles(game, at, { x: at.x + dx * 12, z: at.z + dz * 12 }, o.len || 12)];
      if (!tiles.length) continue;
      any = !!hz(game, c, { kind: 'beam', dur: 1.2, ...o }, tiles, { from: { x: at.x, z: at.z }, to: tiles[tiles.length - 1], beamColor: o.pal?.p[1] || '#ffffff', halo: o.pal?.p[0] || '#ffd060', width: 2 }) || any;
    }
    return any;
  },
  // Down on the floor round it: knocked back.
  slam(c, t, game, o) {
    const R = (o.r || 2) + (c.foot || 0);
    c.stunT = Math.max(c.stunT || 0, (o.dur ?? 0.9) + 0.1);
    return !!hz(game, c, { kind: 'slam', dur: 0.9, knock: 2, stun: 0.3, ...o, r: R }, areaTiles(c.x, c.z, R), { center: { x: c.x, z: c.z }, from: { x: c.x, z: c.z } });
  },
  // Rings rippling out from it, one after another.
  quake(c, t, game, o) {
    const n = o.n || 5;
    proc(game, c, o.every || 0.32, n, (k) => {
      hz(game, c, { kind: 'erupt', dur: 0.55, ...o }, o.round ? circleTiles(c.x, c.z, k + 1.5 + (c.foot || 0)) : ringTiles(c.x, c.z, k + 1 + (c.foot || 0)));
      if (k === 0) game.shake = Math.min(1.2, (game.shake || 0) + 0.3);
    });
    return true;
  },
  // Up out of the floor where you stand, and round about.
  erupt(c, t, game, o) {
    const spots = [{ x: t.x, z: t.z }];
    for (let k = 0; k < (o.extra ?? 3); k++) {
      const s = spotIn(c, t, 1, o.spread || 3);
      if (s) spots.push(s);
    }
    let any = false;
    for (const s of spots) any = !!hz(game, c, { kind: 'erupt', dur: 1.1, ...o }, areaTiles(s.x, s.z, o.r ?? 0, true)) || any;
    return any;
  },
  // Things thrown in an arc, at you and about you.
  volley(c, t, game, o) {
    const n = o.n || 3;
    const P = o.pal || GOLD;
    for (let k = 0; k < n; k++) {
      const at = k === 0 ? t : spotIn(c, t, 1, o.spread || 3) || t;
      lob(game, c, at.x, at.z, { tint: o.tint || P.c, onLand: (g, x, z) => {
        const tiles = areaTiles(x, z, o.r ?? 1, true);
        hz(g, c, { kind: 'burst', ...o, dur: 0.05 }, tiles);
        if (o.zone) addZone(g, { by: c, kind: o.zone, tiles: tiles.filter((q) => openFloor(g, q.x, q.z)), y: c.y, life: o.life || 6, slow: o.slow ?? true, tick: o.tick, dmg: o.tickDmg, burn: o.zburn, chill: o.zchill, color: P.c, puff: P.p });
      } });
    }
    return true;
  },
  // A rain of it over the hall a while, thickest round you.
  rain(c, t, game, o) {
    const n = o.n || 14;
    proc(game, c, o.every || 0.16, n, () => {
      const tt = c.target || t;
      const at = Math.random() < 0.35 ? { x: tt.x + Math.round(Math.random() * 2 - 1), z: tt.z + Math.round(Math.random() * 2 - 1) } : spotIn(c, tt, 0, o.spread || 5);
      if (at) hz(game, c, { kind: 'rocks', dur: 0.9, ...o }, [at]);
    });
    return true;
  },
  // A run straight at you, everything in its way knocked flying.
  charge(c, t, game, o) {
    const line = lineTiles(game, c, t, o.len || 10);
    if (line.length < 2) return false;
    let end = null;
    for (const q of line) {
      if (q.x === t.x && q.z === t.z) break;
      if (game.entityAt(q.x, FY, q.z)) break;
      if (openFloor(game, q.x, q.z)) end = q;
    }
    c.face(t.x, t.z);
    c.charge = true;
    return !!hz(game, c, { kind: 'slam', dur: 0.9, knock: 2, ...o }, line, { onFire: (g) => {
      c.charge = false;
      if (!end || c.dead || g.entityAt(end.x, FY, end.z)) return;
      for (const q of line) {
        g.renderer.emit(q.x, c.y + 0.3, q.z, { n: 2, color: (o.pal || EARTH).p, up: 14, speed: 20, life: 0.5, shape: 'puff' });
        if (q === end) break;
      }
      c.teleport(end.x, FY, end.z);
    } });
  },
  // A leap onto you.
  pounce(c, t, game, o) {
    const to = spotIn(c, t, 1, 1.6);
    if (!to) return false;
    return !!hz(game, c, { kind: 'slam', dur: 0.85, knock: 1, ...o }, areaTiles(t.x, t.z, 1), { onFire: (g) => {
      if (!c.dead && !g.entityAt(to.x, FY, to.z)) blinkTo(c, to, (o.pal || EARTH).p);
    } });
  },
  // Gone, and behind you, striking.
  blink(c, t, game, o) {
    const to = spotIn(c, t, 1, 2);
    if (!to) return false;
    blinkTo(c, to, (o.pal || FEY).p);
    c.face(t.x, t.z);
    c.attackCd = 0;
    beginAttack(game, c, t, styleOf(c));
    return true;
  },
  // Its own come to it.
  summon(c, t, game, o) {
    const alive = game.creatures.filter((q) => !q.dead && q.summoner === c).length;
    if (alive >= (o.cap || 4)) return false;
    const n = Math.min(o.n || 2, (o.cap || 4) - alive);
    for (let i = 0; i < n; i++) summon(game, Array.isArray(o.sp) ? pick(o.sp) : o.sp, c, 3, { color: (o.pal || GOLD).p });
    return true;
  },
  // Bad ground round you a while: bog, ice, salt, bile, fire, webs.
  zone(c, t, game, o) {
    const tiles = areaTiles(t.x, t.z, o.r ?? 1, true).filter((q) => inHall(c, q) && openFloor(game, q.x, q.z));
    const P = o.pal || EARTH;
    return !!hz(game, c, { kind: 'hex', dur: 1.0, dmg: 2, ...o }, tiles, { onFire: (g) => {
      if (o.floor) for (const q of tiles) work(g, q.x, FY - 1, q.z, B[o.floor], o.life || 10, c, { floor: true });
      addZone(g, { by: c, kind: o.zk || 'mire', tiles, y: c.y, life: o.life || 10, slow: o.slow ?? true, root: o.root, tick: o.tick, dmg: o.tickDmg, chill: o.zchill, burn: o.zburn, color: P.c, puff: P.p });
    } });
  },
  // A line thrown out to you, and you hauled in.
  pull(c, t, game, o) {
    const d = dist(c, t);
    if (d < 2 || d > (o.len || 8) || !sees(game, c, t)) return false;
    c.face(t.x, t.z);
    return !!hz(game, c, { kind: 'dart', dur: 0.85, dmg: 3, ...o }, lineTiles(game, c, t, d + 1), { from: { x: c.x, z: c.z }, to: { x: t.x, z: t.z }, onFire: (g, h, hit) => {
      for (const e of hit) {
        drag(g, e, c, o.n || 3);
        if (o.grab && e.kind === 'player') e.grabbedT = Math.max(e.grabbedT || 0, o.grab);
        g.renderer.floatText(e.x, e.y + 2.4, e.z, o.text || 'dragged in!', '#e8e0cc');
      }
    } });
  },
  // A blast of wind off it: knocked away.
  gust(c, t, game, o) {
    c.face(t.x, t.z);
    return !!hz(game, c, { kind: 'cold', dur: 0.9, dmg: 2, knock: 3, pal: GALE, ...o }, coneTiles(c, t, (o.len || 5) + (c.foot || 0), o.spread || 0.75));
  },
  // Where you stand marked: then down it comes, hard.
  mark(c, t, game, o) {
    game.renderer.floatText(t.x, t.y + 2.6, t.z, o.text || 'marked...', '#ffe0a0');
    return !!hz(game, c, { kind: 'burst', dur: 1.8, dmg: 9, ...o }, areaTiles(t.x, t.z, o.r ?? 1, true));
  },
  // A wall across the hall through you; or (`march`) rows of it marching
  // across the hall one after another, a gap kept somewhere in each.
  wall(c, t, game, o) {
    const L = hallOf(c);
    const across = o.across ?? Math.random() < 0.5;
    const len = (across ? L.x1 - L.x0 : L.z1 - L.z0) + 3;
    const midAt = { x: Math.round((L.x0 + L.x1) / 2), z: Math.round((L.z0 + L.z1) / 2) };
    if (!o.march) return !!hz(game, c, { kind: 'beam', dur: 1.1, ...o }, wallTiles(across ? { x: midAt.x, z: t.z } : { x: t.x, z: midAt.z }, across, len, 0));
    const rows = [];
    const lo = across ? L.z0 : L.x0;
    const hi = across ? L.z1 : L.x1;
    const fromLow = (across ? t.z - lo : t.x - lo) > (hi - lo) / 2;
    for (let v = lo; v <= hi; v += o.step || 2) rows.push(v);
    if (!fromLow) rows.reverse();
    const gap = across ? t.x + Math.round(Math.random() * 6 - 3) : t.z + Math.round(Math.random() * 6 - 3);
    proc(game, c, o.every || 0.42, rows.length, (k) => {
      const v = rows[k];
      const tiles = wallTiles(across ? { x: midAt.x, z: v } : { x: v, z: midAt.z }, across, len, 0).filter((q) => Math.abs((across ? q.x : q.z) - gap) > (o.gap ?? 1));
      hz(game, c, { kind: 'beam', dur: 0.7, ...o }, tiles);
    });
    return true;
  },
  // A spiral of it, unwinding out of it.
  spiral(c, t, game, o) {
    const n = o.n || 18;
    const a0 = Math.random() * TAU;
    const dir = Math.random() < 0.5 ? 1 : -1;
    proc(game, c, o.every || 0.07, n, (k) => {
      const a = a0 + dir * k * 0.62;
      const r = 1.5 + (c.foot || 0) + k * 0.42;
      const q = { x: Math.round(c.x + Math.cos(a) * r), z: Math.round(c.z + Math.sin(a) * r) };
      hz(game, c, { kind: 'hex', dur: 0.65, ...o }, areaTiles(q.x, q.z, 0));
    });
    return true;
  },
  // Turned beams sweeping round it.
  spin(c, t, game, o) {
    const n = o.n || 8;
    const base = Math.atan2(t.z - c.z, t.x - c.x);
    const dir = Math.random() < 0.5 ? 1 : -1;
    proc(game, c, o.every || 0.2, n, (k) => {
      const a = base + dir * k * (TAU / (o.turns || n));
      const aim = { x: Math.round(c.x + Math.cos(a) * 12), z: Math.round(c.z + Math.sin(a) * 12) };
      const tiles = lineTiles(game, c, aim, o.len || 9);
      if (tiles.length) hz(game, c, { kind: 'beam', dur: 0.7, ...o }, tiles, { from: { x: c.x, z: c.z }, to: tiles[tiles.length - 1], beamColor: o.pal?.p[1] || '#ffffff', halo: o.pal?.p[0] || '#ffd060', width: 2 });
    });
    return true;
  },
  // A guard put up a while: most of every blow turned.
  ward(c, t, game, o) {
    c.wardT = o.secs || 4;
    c.wardK = o.k ?? 0.25;
    c.wardText = o.text || 'guarded';
    c.shellT = c.wardT;
    puff(game, c, o.pal || MARBLE, 20);
    game.renderer.floatText(c.x, c.y + 3, c.z, o.text || 'guarded', '#c8d8ff');
    return true;
  },
  // Mended a little (worn down, it takes the time to).
  heal(c, t, game, o) {
    if (c.hp > c.maxHp * (o.below || 0.75)) return false;
    const k = Math.round(c.maxHp * (o.k || 0.05));
    c.hp = Math.min(c.maxHp, c.hp + k);
    puff(game, c, o.pal || JADE, 22);
    game.renderer.floatText(c.x, c.y + 3, c.z, `+${k}`, '#80ff90');
    return true;
  },
  // A roar, a howl, a toll: everyone round it staggered.
  howl(c, t, game, o) {
    game.shake = Math.min(1.2, (game.shake || 0) + 0.4);
    return !!hz(game, c, { kind: 'burst', dur: 0.9, dmg: 2, stun: 0.7, ...o }, areaTiles(c.x, c.z, (o.r || 5) + (c.foot || 0), true));
  },
  // Its marks on the floor, all alike: but only one of them is real.
  mirage(c, t, game, o) {
    const n = o.n || 4;
    const real = Math.floor(Math.random() * n);
    let any = false;
    for (let k = 0; k < n; k++) {
      const at = k === 0 ? t : spotIn(c, t, 1, 4);
      if (!at) continue;
      const tiles = areaTiles(at.x, at.z, o.r ?? 1);
      if (k === real) any = !!hz(game, c, { kind: 'burst', dur: 1.3, dmg: 8, ...o }, tiles) || any;
      else hz(game, c, { kind: 'hex', dur: 1.3, ...o, dmg: 0 }, tiles, { onFire: (g, h) => g.renderer.emit(mid(h.tiles).x, c.y + 0.6, mid(h.tiles).z, { n: 8, color: (o.pal || FEY).p, up: 10, speed: 10, life: 0.6, glow: true }) });
    }
    return any;
  },
  // Its place and yours, traded in a flash.
  swap(c, t, game, o) {
    if (dist(c, t) > (o.len || 8) || t.kind !== 'player' || c.foot) return false;
    const a = { x: c.x, y: c.y, z: c.z };
    const b = { x: t.x, y: t.y, z: t.z };
    puff(game, a, o.pal || FEY, 20);
    puff(game, b, o.pal || FEY, 20);
    t.teleport(a.x, a.y, a.z);
    c.teleport(b.x, b.y, b.z);
    game.renderer.flashScreen?.('#c8a0ff', 0.2);
    game.renderer.floatText(a.x, a.y + 2.4, a.z, o.text || 'places traded!', '#d8c0ff');
    if (o.then) hz(game, c, { kind: 'burst', dur: 0.8, dmg: 5, ...o }, areaTiles(a.x, a.z, 1));
    return true;
  },
  // Lightning: strike after strike, on you and about you.
  lightning(c, t, game, o) {
    const n = o.n || 5;
    proc(game, c, o.every || 0.32, n, (k) => {
      const tt = c.target || t;
      const at = k % 2 === 0 ? { x: tt.x, z: tt.z } : spotIn(c, tt, 1, 3);
      if (!at) return;
      hz(game, c, { kind: 'burst', dur: 0.85, dmg: 5, stun: 0.3, pal: STORM, ...o }, [at, { x: at.x + 1, z: at.z }, { x: at.x - 1, z: at.z }, { x: at.x, z: at.z + 1 }, { x: at.x, z: at.z - 1 }], { onFire: (g) => {
        g.renderer.flashScreen?.('#e0e8ff', 0.12);
        g.renderer.emit(at.x, c.y + 3, at.z, { n: 10, color: STORM.p, up: -60, speed: 20, life: 0.25, glow: true });
      } });
    });
    return true;
  },
  // Water let in over the floor round you a while (wading's slow going).
  flood(c, t, game, o) {
    const tiles = areaTiles(t.x, t.z, o.r ?? 2, true).filter((q) => inHall(c, q) && openFloor(game, q.x, q.z));
    if (!tiles.length) return false;
    return !!hz(game, c, { kind: 'cold', dur: 1.0, dmg: 3, chill: 1, pal: SEA, ...o }, tiles, { onFire: (g) => {
      for (const q of tiles) work(g, q.x, FY, q.z, B.water, o.life || 8, c);
      g.audio?.play('wave', c);
    } });
  },
  // A blinding cloud (ink, salt, dust): flung at you.
  blind(c, t, game, o) {
    if (dist(c, t) > (o.len || 6)) return false;
    return !!hz(game, c, { kind: 'hex', dur: 0.9, dmg: 2, ...o }, areaTiles(t.x, t.z, 1, true), { onFire: (g, h, hit) => {
      for (const e of hit) if (e.kind === 'player') ink(g, e, o.secs || 2.5);
    } });
  },
  // Its hand in your pockets.
  rob(c, t, game, o) {
    if (dist(c, t) > 2 || t.kind !== 'player') return false;
    return !!hz(game, c, { kind: 'slam', dur: 0.6, dmg: 3, ...o }, areaTiles(t.x, t.z, 0), { onFire: (g, h, hit) => {
      for (const e of hit) if (e.kind === 'player') plunder(g, e, c);
    } });
  },
};

// ------------------------------------------------------------ the fight
// Its works, in order of preference: [key (its own clock), first (how long
// before the first), every, work, opts]. `opts.ph`: not before this phase;
// `min`/`max`: only within these paces of you; `say`: what it shouts.
function fight(c, dt, list) {
  const game = c.game;
  if (c.poseT > 0) {
    c.poseT -= dt;
    if (c.poseT <= 0) c.decree = false;
  }
  if (c.wardT > 0) {
    c.wardT -= dt;
    if (c.wardT <= 0) c.shellT = 0;
  }
  if (c.wardNote > 0) c.wardNote -= dt;
  const R = c.S.raise;
  if (R) phaseSummons(c, [0.66, 0.33], () => {
    for (let i = 0; i < (R.n || 2); i++) summon(game, Array.isArray(R.sp) ? pick(R.sp) : R.sp, c, 3, { color: (R.pal || GOLD).p });
  });
  const t = c.target;
  if (!t || t.dead || c.windup || c.burrowed) return false;
  const ph = phaseOf(c);
  const d = dist(c, t);
  for (const [key, first, every, kind, o = {}] of list) {
    if (o.ph && ph < o.ph) continue;
    if (!cd(c, key, dt, first)) continue;
    if (!ready(c)) continue;
    if (d < (o.min ?? 0) || d > (o.max ?? 14)) continue;
    if (!MOVES[kind](c, t, game, o)) {
      c[key] = 0.8;
      continue;
    }
    c[key] = every * (ph >= 3 ? 0.8 : 1);
    used(c, o.rest || 0);
    c.decree = true;
    c.poseT = Math.max(0.5, (o.dur ?? 1) * 0.8);
    if (o.say) shout(c, Array.isArray(o.say) ? pick(o.say) : o.say, o.sayColor || '#ffe0a0');
    if (o.sound) game.audio?.play(o.sound, c);
    return true;
  }
  return false;
}

// Its guard, while it's up (see MOVES.ward).
function farWard(game, c, src, n) {
  if (!(c.wardT > 0) || src === c) return n;
  if (!(c.wardNote > 0)) {
    c.wardNote = 0.8;
    game.renderer.floatText(c.x, c.y + 2.8, c.z, c.wardText || 'guarded', '#c8d8ff');
  }
  return Math.max(0, Math.round(n * (c.wardK ?? 0.25)));
}

// --------------------------------------------------------------- species
const fb = (isle, o) => ({ mode: 'hostile', aggro: 16, under: true, boss: true, isle, ward: farWard, ...o });
const COINS = (lo, hi) => ['old_coin', lo, hi, 1];

export const FAR_BOSS_SPECIES = {
  // ---------------------------------------------------------- Velmarch
  frost_jarl: fb('velmarch', {
    name: 'The Frost Jarl', hp: 130, dmg: 6, step: 0.42, humanoid: true, look: 'frost_jarl', arms: 'greatsword', undead: true, light: 3, brain: 'frostJarl', tint: ['#a0d8ff', '#ffffff'],
    raise: { sp: ['frost_wolf', 'skeleton'], n: 2, pal: FROST }, phaseLines: ['', '', 'Wolves of the barrow, to me!', 'WINTER TAKES ALL.'],
    drops: [COINS(6, 12), ['frost_crystal', 3, 6, 1], ['gold_ingot', 1, 2, 0.7]],
  }),
  barrow_mammoth: fb('velmarch', {
    name: 'The Barrow Mammoth', hp: 170, dmg: 7, step: 0.55, big: true, undead: true, brain: 'barrowMammoth', tint: ['#c8d8e8', '#8aa0b8'], style: 'gore',
    phaseLines: ['', '', '', ''], drops: [['antler', 2, 4, 1], ['frost_crystal', 2, 4, 1], ['leather', 3, 6, 1]],
  }),
  iron_legate: fb('velmarch', {
    name: 'The Iron Legate', hp: 135, dmg: 6, step: 0.4, humanoid: true, look: 'iron_legate', arms: 'spear', shield: 'iron_shield', shieldBlock: 0.3, undead: true, brain: 'ironLegate', tint: ['#c8a040', '#e8e0d0'],
    raise: { sp: 'legion_shade', n: 2, pal: GOLD }, phaseLines: ['', '', 'Form ranks! FORM RANKS!', 'Testudo! Hold the line!'],
    drops: [COINS(6, 12), ['iron_ingot', 3, 6, 1], ['gold_ingot', 1, 2, 0.6]],
  }),
  silver_wyrm: fb('velmarch', {
    name: 'The Silver Wyrm', hp: 155, dmg: 6, step: 0.36, big: true, brain: 'silverWyrm', tint: ['#e0e8f0', '#a0b0c8'], style: 'bite',
    phaseLines: ['', '', '', ''], drops: [['gold_ore', 3, 6, 1], ['iron_ore', 4, 8, 1], ['gem', 1, 2, 0.8]],
  }),
  pale_vestal: fb('velmarch', {
    name: 'The Pale Vestal', hp: 120, dmg: 5, step: 0.36, humanoid: true, look: 'pale_vestal', undead: true, light: 6, brain: 'paleVestal', range: 5, tint: ['#ffe8b0', '#ffffff'],
    phaseLines: ['', '', 'The flame must never go out.', 'Burn with me, forever.'], drops: [COINS(6, 12), ['gold_ingot', 1, 2, 0.8], ['potion_vigor', 1, 1, 0.7]],
  }),
  marble_colossus: fb('velmarch', {
    name: 'The Marble Colossus', hp: 185, dmg: 7, step: 0.6, big: true, construct: true, brain: 'marbleColossus', tint: ['#ffffff', '#d8b860'], style: 'slam',
    phaseLines: ['', '', '', ''], drops: [['marble', 6, 12, 1], ['gold_ingot', 1, 2, 0.8], ['gem', 1, 1, 0.5]],
  }),
  deserter_general: fb('velmarch', {
    name: 'The Deserter General', hp: 125, dmg: 6, step: 0.36, humanoid: true, look: 'deserter_general', arms: 'sabre', brain: 'deserterGeneral', tint: ['#c84040', '#ffe0a0'],
    raise: { sp: ['cutthroat', 'holdout_archer'], n: 2, pal: RED }, phaseLines: ['', '', 'To me, you dogs! Earn your pay!', 'I left one empire. I\'ll not die for it now.'],
    drops: [['coin', 15, 35, 1], ['iron_ingot', 2, 4, 1], ['gold_ingot', 1, 1, 0.6]],
  }),
  war_eagle: fb('velmarch', {
    name: 'The War Eagle', hp: 125, dmg: 6, step: 0.26, big: true, floats: true, brain: 'warEagle', tint: ['#ffd070', '#8a5a2a'], style: 'snap',
    phaseLines: ['', '', '', ''], drops: [['feather', 6, 12, 1], ['gold_ingot', 1, 2, 0.8], ['potion_haste', 1, 1, 0.6]],
  }),
  last_emperor: fb('velmarch', {
    name: 'The Last Emperor', hp: 150, dmg: 6, step: 0.38, humanoid: true, look: 'last_emperor', undead: true, light: 4, brain: 'lastEmperor', range: 5, tint: ['#c060ff', '#ffe080'],
    raise: { sp: 'legion_shade', n: 3, pal: GOLD }, phaseLines: ['', '', 'Praetorians! Your emperor calls!', 'I WAS ROME. I WAS EVERYTHING.'],
    drops: [COINS(10, 20), ['gold_ingot', 2, 4, 1], ['gem', 1, 2, 1]],
  }),
  bronze_wolf: fb('velmarch', {
    name: 'The Bronze Wolf', hp: 160, dmg: 7, step: 0.3, big: true, construct: true, brain: 'bronzeWolf', tint: ['#d89040', '#ffe0a0'], style: 'bite',
    raise: { sp: 'frost_wolf', n: 2, pal: GOLD }, phaseLines: ['', '', '', ''], drops: [['gold_ingot', 2, 3, 1], ['iron_ingot', 3, 6, 1], ['gem', 1, 1, 0.6]],
  }),
  // ---------------------------------------------------------- Ostria
  jade_corpse_lord: fb('ostria', {
    name: 'The Jade Corpse-Lord', hp: 130, dmg: 6, step: 0.5, humanoid: true, look: 'jade_corpse_lord', undead: true, brain: 'jadeCorpseLord', tint: ['#60e0a0', '#e0fff0'], style: 'grab',
    raise: { sp: 'jade_corpse', n: 2, pal: JADE }, phaseLines: ['', '', 'Rise, my household! Serve me still!', 'Your breath... give me your breath!'],
    drops: [COINS(6, 12), ['gem', 1, 2, 1], ['jasmine_tea', 2, 4, 1]],
  }),
  skinwalker: fb('ostria', {
    name: 'The Skinwalker', hp: 125, dmg: 6, step: 0.24, big: true, brain: 'skinwalker', tint: ['#c8a070', '#ff4030'], style: 'pounce',
    raise: { sp: 'coyote', n: 2, pal: RED }, phaseLines: ['', '', '', ''], drops: [['leather', 4, 8, 1], ['gem', 1, 1, 0.6], ['potion_haste', 1, 1, 0.6]],
  }),
  turquoise_golem: fb('ostria', {
    name: 'The Turquoise Golem', hp: 180, dmg: 7, step: 0.6, big: true, construct: true, brain: 'turquoiseGolem', tint: ['#40d0c8', '#e0a060'], style: 'slam',
    phaseLines: ['', '', '', ''], drops: [['gem', 2, 4, 1], ['gold_ore', 2, 4, 1], ['turquoise_tile', 4, 8, 1]],
  }),
  great_centipede: fb('ostria', {
    name: 'The Great Centipede', hp: 150, dmg: 6, step: 0.28, big: true, brain: 'greatCentipede', tint: ['#c84020', '#ffb040'], style: 'bite',
    phaseLines: ['', '', '', ''], drops: [['leather', 4, 8, 1], ['gem', 1, 2, 0.8], ['potion_breath', 1, 1, 0.6]],
  }),
  nine_tailed_fox: fb('ostria', {
    name: 'The Nine-Tailed Fox', hp: 125, dmg: 6, step: 0.24, big: true, light: 5, brain: 'nineTailedFox', range: 4, tint: ['#ff9030', '#fff0c0'], style: 'pounce',
    phaseLines: ['', '', '', ''], drops: [['gem', 2, 3, 1], ['tiger_pelt', 1, 1, 0.6], ['potion_haste', 1, 1, 0.7]],
  }),
  hungry_ghost: fb('ostria', {
    name: 'The Hungry Ghost', hp: 120, dmg: 5, step: 0.34, big: true, floats: true, undead: true, brain: 'hungryGhost', range: 4, tint: ['#80c8a0', '#e0fff0'], style: 'grab',
    phaseLines: ['', '', '', ''], drops: [COINS(8, 16), ['dumplings', 2, 4, 1], ['gem', 1, 1, 0.6]],
  }),
  bandit_khan: fb('ostria', {
    name: 'The Bandit Khan', hp: 125, dmg: 6, step: 0.32, humanoid: true, look: 'bandit_khan', arms: 'sabre', brain: 'banditKhan', tint: ['#d07040', '#ffe0a0'],
    raise: { sp: ['cutthroat', 'holdout_archer'], n: 2, pal: RED }, phaseLines: ['', '', 'Riders! To the khan!', 'The steppe remembers my name!'],
    drops: [['coin', 15, 35, 1], ['gem', 1, 2, 0.8], ['blue_corn_cakes', 2, 4, 1]],
  }),
  thunderbird: fb('ostria', {
    name: 'The Thunderbird', hp: 135, dmg: 6, step: 0.26, big: true, floats: true, light: 4, brain: 'thunderbird', tint: ['#e0e8ff', '#4060c0'], style: 'snap',
    phaseLines: ['', '', '', ''], drops: [['feather', 6, 12, 1], ['gem', 1, 2, 1], ['potion_wind', 1, 1, 0.7]],
  }),
  terracotta_general: fb('ostria', {
    name: 'The Terracotta General', hp: 150, dmg: 6, step: 0.42, humanoid: true, look: 'terracotta_general', arms: 'halberd', construct: true, armoured: true, brain: 'terracottaGeneral', tint: ['#e08050', '#ffd0a0'],
    raise: { sp: ['terracotta_soldier', 'terracotta_archer'], n: 3, pal: RED }, phaseLines: ['', '', 'Eight thousand stand behind me!', 'The clay remembers. The clay obeys.'],
    drops: [COINS(10, 20), ['clay', 6, 12, 1], ['gem', 1, 2, 1]],
  }),
  jade_dragon: fb('ostria', {
    name: 'The Jade Dragon', hp: 175, dmg: 7, step: 0.32, big: true, floats: true, light: 4, brain: 'jadeDragon', tint: ['#40e090', '#ffe080'], style: 'bite',
    phaseLines: ['', '', '', ''], drops: [['gem', 2, 4, 1], ['gold_ingot', 2, 3, 1], ['jasmine_tea', 2, 4, 1]],
  }),
  // ---------------------------------------------------------- Corrow
  bone_thane: fb('corrow', {
    name: 'The Bone Thane', hp: 130, dmg: 6, step: 0.42, humanoid: true, look: 'bone_thane', arms: 'battle_axe', undead: true, brain: 'boneThane', tint: ['#f0e8d8', '#80a0b0'],
    raise: { sp: ['skeleton', 'bone_whaler'], n: 2, pal: BONE }, phaseLines: ['', '', 'My hearth-men! From the bone-pit!', 'I was thane of the whale-road!'],
    drops: [COINS(6, 12), ['bone', 6, 12, 1], ['harpoon', 1, 1, 0.4]],
  }),
  carrion_roc: fb('corrow', {
    name: 'The Carrion Roc', hp: 135, dmg: 6, step: 0.26, big: true, floats: true, brain: 'carrionRoc', tint: ['#8a7a6a', '#e0d0c0'], style: 'snap',
    phaseLines: ['', '', '', ''], drops: [['feather', 6, 12, 1], ['bone', 4, 8, 1], ['potion_wind', 1, 1, 0.6]],
  }),
  scrimshaw_horror: fb('corrow', {
    name: 'The Scrimshaw Horror', hp: 160, dmg: 6, step: 0.5, big: true, undead: true, brain: 'scrimshawHorror', tint: ['#f0e8d8', '#3a6a8a'], style: 'slam',
    phaseLines: ['', '', '', ''], drops: [['bone', 8, 14, 1], ['gem', 1, 2, 0.8], ['old_coin', 4, 10, 1]],
  }),
  oil_bloat: fb('corrow', {
    name: 'The Oil Bloat', hp: 150, dmg: 5, step: 0.6, big: true, floats: true, brain: 'oilBloat', range: 4, tint: ['#c8a050', '#3a3020'], style: 'slam',
    phaseLines: ['', '', '', ''], drops: [['coal', 6, 12, 1], ['leather', 3, 6, 1], ['potion_might', 1, 1, 0.6]],
  }),
  whale_priest: fb('corrow', {
    name: 'The Whale Priest', hp: 120, dmg: 5, step: 0.36, humanoid: true, look: 'whale_priest', undead: true, brain: 'whalePriest', range: 5, tint: ['#80b8e0', '#f0e8d8'],
    raise: { sp: 'drowned', n: 2, pal: SEA }, phaseLines: ['', '', 'The Great Whale hears me!', 'Into the deep, into the belly, into the dark!'],
    drops: [COINS(6, 12), ['whale_stew', 2, 4, 1], ['gem', 1, 1, 0.6]],
  }),
  kraken_spawn: fb('corrow', {
    name: 'The Kraken Spawn', hp: 150, dmg: 6, step: 0.5, big: true, brain: 'krakenSpawn', tint: ['#c05080', '#ffb0d0'], style: 'grab',
    phaseLines: ['', '', '', ''], drops: [['pearl', 2, 4, 1], ['crab_meat', 3, 6, 1], ['gem', 1, 1, 0.6]],
  }),
  harpoon_queen: fb('corrow', {
    name: 'The Harpoon Queen', hp: 125, dmg: 6, step: 0.36, humanoid: true, look: 'harpoon_queen', arms: 'harpoon', brain: 'harpoonQueen', tint: ['#e0c060', '#3a5a6a'],
    raise: { sp: ['cutthroat', 'bone_whaler'], n: 2, pal: SEA }, phaseLines: ['', '', 'All hands! Boats away!', 'There she blows... and so do YOU.'],
    drops: [['coin', 15, 35, 1], ['harpoon', 1, 1, 0.8], ['whale_stew', 2, 3, 1]],
  }),
  bull_walrus: fb('corrow', {
    name: 'The Bull Walrus', hp: 175, dmg: 7, step: 0.55, big: true, brain: 'bullWalrus', tint: ['#a07860', '#f0e8d8'], style: 'gore',
    phaseLines: ['', '', '', ''], drops: [['raw_meat', 6, 12, 1], ['bone', 4, 8, 1], ['leather', 4, 8, 1]],
  }),
  leviathan_heart: fb('corrow', {
    name: 'The Leviathan\'s Heart', hp: 200, dmg: 6, step: 9, big: true, anchored: true, brain: 'leviathanHeart', tint: ['#e04050', '#ffb0a0'], style: 'slam',
    raise: { sp: ['bone_crab', 'slime'], n: 2, pal: BILE }, phaseLines: ['', '', '', ''], drops: [['pearl', 3, 6, 1], ['gem', 2, 3, 1], ['gold_ingot', 1, 2, 1]],
  }),
  gut_wyrm: fb('corrow', {
    name: 'The Gut Wyrm', hp: 165, dmg: 7, step: 0.34, big: true, brain: 'gutWyrm', tint: ['#e0b8a0', '#a8c040'], style: 'bite',
    phaseLines: ['', '', '', ''], drops: [['bone', 6, 12, 1], ['pearl', 2, 4, 1], ['gem', 1, 2, 1]],
  }),
  // ---------------------------------------------------------- Saltmere
  salt_mummy: fb('saltmere', {
    name: 'The Salt Mummy', hp: 135, dmg: 6, step: 0.46, humanoid: true, look: 'salt_mummy', undead: true, brain: 'saltMummy', tint: ['#ffffff', '#e8a0b8'], style: 'grab',
    raise: { sp: 'salt_wight', n: 2, pal: SALT }, phaseLines: ['', '', 'Thirst... thirst with me...', 'All the sea\'s salt, and not a drop to drink.'],
    drops: [COINS(6, 12), ['salt', 6, 12, 1], ['gem', 1, 1, 0.6]],
  }),
  brine_crab_king: fb('saltmere', {
    name: 'The Brine Crab King', hp: 170, dmg: 7, step: 0.44, big: true, brain: 'brineCrabKing', tint: ['#e86040', '#ffffff'], style: 'bite',
    raise: { sp: 'brine_scorpion', n: 2, pal: SALT }, phaseLines: ['', '', '', ''], drops: [['crab_meat', 6, 12, 1], ['salt', 4, 8, 1], ['gold_ingot', 1, 2, 0.7]],
  }),
  crystal_matriarch: fb('saltmere', {
    name: 'The Crystal Matriarch', hp: 160, dmg: 6, step: 0.4, big: true, light: 5, brain: 'crystalMatriarch', tint: ['#ffffff', '#c8a0ff'], style: 'bite',
    phaseLines: ['', '', '', ''], drops: [['gem', 2, 4, 1], ['salt', 4, 8, 1], ['frost_crystal', 2, 4, 1]],
  }),
  salt_wyrm: fb('saltmere', {
    name: 'The Salt Wyrm', hp: 160, dmg: 7, step: 0.34, big: true, brain: 'saltWyrm', tint: ['#ffffff', '#c8b8a8'], style: 'bite',
    phaseLines: ['', '', '', ''], drops: [['salt', 8, 14, 1], ['gem', 1, 2, 1], ['gold_ore', 2, 4, 1]],
  }),
  salt_bride: fb('saltmere', {
    name: 'The Salt Bride', hp: 120, dmg: 5, step: 0.36, humanoid: true, look: 'salt_bride', undead: true, floats: true, light: 4, brain: 'saltBride', range: 5, tint: ['#ffffff', '#a0c8ff'],
    phaseLines: ['', '', 'He never came back from the sea...', 'Stay with me. Stay forever.'], drops: [COINS(6, 12), ['pearl_necklace', 1, 1, 0.5], ['gem', 1, 2, 1]],
  }),
  flamingo_seraph: fb('saltmere', {
    name: 'The Flamingo Seraph', hp: 130, dmg: 6, step: 0.26, big: true, floats: true, light: 6, brain: 'flamingoSeraph', tint: ['#ff90c0', '#fff0f8'], style: 'snap',
    phaseLines: ['', '', '', ''], drops: [['pink_feather', 6, 12, 1], ['gem', 1, 2, 1], ['potion_vigor', 1, 1, 0.7]],
  }),
  salt_doge: fb('saltmere', {
    name: 'The Salt Doge', hp: 125, dmg: 5, step: 0.34, humanoid: true, look: 'salt_doge', arms: 'sabre', brain: 'saltDoge', tint: ['#e0b040', '#ffffff'],
    raise: { sp: ['cutthroat', 'holdout_archer', 'thief'], n: 2, pal: GOLD }, phaseLines: ['', '', 'Guards! Earn your salt!', 'Everything here is MINE. Taxed, and mine.'],
    drops: [['coin', 20, 40, 1], ['gold_ingot', 1, 2, 0.8], ['salt', 4, 8, 1]],
  }),
  lagoon_hydra: fb('saltmere', {
    name: 'The Lagoon Hydra', hp: 175, dmg: 7, step: 0.4, big: true, brain: 'lagoonHydra', tint: ['#40a0a8', '#ff90c0'], style: 'bite',
    phaseLines: ['', '', '', ''], drops: [['salt_fish', 4, 8, 1], ['pearl', 2, 4, 1], ['gem', 1, 2, 1]],
  }),
  salt_mother: fb('saltmere', {
    name: 'The Salt Mother', hp: 160, dmg: 6, step: 0.36, humanoid: true, look: 'salt_mother', light: 6, brain: 'saltMother', range: 5, tint: ['#ffffff', '#f0a8c8'],
    raise: { sp: 'salt_wight', n: 3, pal: SALT }, phaseLines: ['', '', 'My children, white and silent, rise!', 'Taste the sea, little one. Taste ALL of it.'],
    drops: [COINS(10, 20), ['salt', 8, 16, 1], ['gem', 2, 3, 1]],
  }),
  mirage_lion: fb('saltmere', {
    name: 'The Mirage Lion', hp: 160, dmg: 7, step: 0.24, big: true, light: 3, brain: 'mirageLion', tint: ['#ffd070', '#ffffff'], style: 'pounce',
    phaseLines: ['', '', '', ''], drops: [['gold_ingot', 2, 3, 1], ['gem', 1, 2, 1], ['potion_haste', 1, 1, 0.7]],
  }),
  // ---------------------------------------------------------- Hollowmark
  mole_king: fb('hollowmark', {
    name: 'The Mole King', hp: 160, dmg: 6, step: 0.44, big: true, brain: 'moleKing', tint: ['#a07860', '#ffd070'], style: 'bite',
    raise: { sp: 'tunneler', n: 2, pal: EARTH }, phaseLines: ['', '', '', ''], drops: [['gold_ore', 3, 6, 1], ['gem', 1, 2, 1], ['leather', 3, 6, 1]],
  }),
  root_witch: fb('hollowmark', {
    name: 'The Root Witch', hp: 120, dmg: 5, step: 0.38, humanoid: true, look: 'root_witch', brain: 'rootWitch', range: 5, tint: ['#a0c060', '#ffd070'],
    phaseLines: ['', '', 'Grow, my darlings. GROW.', 'The roots go down further than you think.'], drops: [COINS(6, 12), ['herb', 4, 8, 1], ['potion_breath', 1, 1, 0.7]],
  }),
  glowworm_queen: fb('hollowmark', {
    name: 'The Glowworm Queen', hp: 145, dmg: 6, step: 0.36, big: true, light: 7, brain: 'glowwormQueen', range: 4, tint: ['#80e8ff', '#e0ffff'], style: 'bite',
    phaseLines: ['', '', '', ''], drops: [['glowberries', 4, 8, 1], ['gem', 1, 2, 1], ['lantern_pod', 3, 6, 1]],
  }),
  deep_golem: fb('hollowmark', {
    name: 'The Deep Golem', hp: 185, dmg: 7, step: 0.6, big: true, construct: true, light: 3, brain: 'deepGolem', tint: ['#ffb040', '#4a4048'], style: 'slam',
    phaseLines: ['', '', '', ''], drops: [['iron_ore', 6, 12, 1], ['gold_ore', 2, 4, 1], ['gem', 1, 2, 1]],
  }),
  moth_queen: fb('hollowmark', {
    name: 'The Moth Queen', hp: 125, dmg: 5, step: 0.28, big: true, floats: true, light: 6, brain: 'mothQueen', range: 4, tint: ['#ffc040', '#fff0b0'], style: 'snap',
    raise: { sp: 'cave_moth', n: 3, pal: LAMP }, phaseLines: ['', '', '', ''], drops: [['moth_dust', 6, 12, 1], ['lantern_pod', 3, 6, 1], ['potion_haste', 1, 1, 0.7]],
  }),
  lamplighter: fb('hollowmark', {
    name: 'The Lamplighter', hp: 125, dmg: 5, step: 0.36, humanoid: true, look: 'lamplighter', undead: true, light: 6, brain: 'lamplighter', range: 5, tint: ['#ffd070', '#2a2430'],
    phaseLines: ['', '', 'Lights out, little one.', 'Every lamp I put out, I keep.'], drops: [COINS(6, 12), ['lantern', 1, 1, 0.8], ['lantern_pod', 3, 6, 1]],
  }),
  burrow_baron: fb('hollowmark', {
    name: 'The Burrow Baron', hp: 125, dmg: 6, step: 0.34, humanoid: true, look: 'burrow_baron', arms: 'mace', brain: 'burrowBaron', tint: ['#c8a060', '#5a3a2a'],
    raise: { sp: ['cutthroat', 'thief', 'badger'], n: 2, pal: EARTH }, phaseLines: ['', '', 'Lads! Somebody\'s in the larder!', 'This is MY hole.'],
    drops: [['coin', 15, 35, 1], ['root_stew', 2, 4, 1], ['gold_ingot', 1, 1, 0.6]],
  }),
  cave_bear: fb('hollowmark', {
    name: 'The Cave Bear', hp: 175, dmg: 7, step: 0.4, big: true, brain: 'caveBear', tint: ['#8a6a4a', '#ffd0a0'], style: 'bite',
    phaseLines: ['', '', '', ''], drops: [['raw_meat', 6, 12, 1], ['leather', 4, 8, 1], ['bone', 3, 6, 1]],
  }),
  first_digger: fb('hollowmark', {
    name: 'The First Digger', hp: 185, dmg: 7, step: 0.44, big: true, brain: 'firstDigger', tint: ['#c8a070', '#ffd070'], style: 'bite',
    raise: { sp: 'tunneler', n: 2, pal: EARTH }, phaseLines: ['', '', '', ''], drops: [['gold_ore', 4, 8, 1], ['gem', 2, 3, 1], ['iron_ore', 4, 8, 1]],
  }),
  thing_below: fb('hollowmark', {
    name: 'The Thing Below', hp: 190, dmg: 6, step: 9, big: true, anchored: true, light: 3, brain: 'thingBelow', tint: ['#a060c0', '#ffe070'], style: 'grab',
    raise: { sp: ['tunneler', 'cave_moth'], n: 2, pal: INK }, phaseLines: ['', '', '', ''], drops: [['gem', 2, 4, 1], ['gold_ingot', 1, 2, 1], ['lantern_pod', 4, 8, 1]],
  }),
  // ---------------------------------------------------------- the Wyrd Isle
  raven_queen: fb('wyrd', {
    name: 'The Raven Queen', hp: 125, dmg: 5, step: 0.36, humanoid: true, look: 'raven_queen', undead: true, brain: 'ravenQueen', range: 5, tint: ['#6a5aa0', '#e0e0ff'],
    raise: { sp: 'grave_raven', n: 3, pal: INK }, phaseLines: ['', '', 'My ravens! Take its eyes!', 'Every dead thing on this isle is mine to call.'],
    drops: [COINS(6, 12), ['feather', 6, 12, 1], ['gem', 1, 2, 1]],
  }),
  antlered_one: fb('wyrd', {
    name: 'The Antlered One', hp: 135, dmg: 6, step: 0.34, humanoid: true, look: 'antlered_one', arms: 'spear', brain: 'antleredOne', tint: ['#80c060', '#e0d8c0'],
    phaseLines: ['', '', 'The hunt is up!', 'You are the quarry now.'], drops: [['antler', 2, 4, 1], ['leather', 3, 6, 1], ['gem', 1, 2, 1]],
  }),
  rune_golem: fb('wyrd', {
    name: 'The Rune Golem', hp: 180, dmg: 7, step: 0.6, big: true, construct: true, light: 4, brain: 'runeGolem', tint: ['#80e8ff', '#8a8a86'], style: 'slam',
    phaseLines: ['', '', '', ''], drops: [['gem', 2, 3, 1], ['iron_ingot', 3, 6, 1], ['frost_crystal', 2, 4, 1]],
  }),
  ninth_wyrm: fb('wyrd', {
    name: 'The Ninth Wyrm', hp: 165, dmg: 7, step: 0.34, big: true, brain: 'ninthWyrm', tint: ['#6a5aa0', '#a0ffd0'], style: 'bite',
    phaseLines: ['', '', '', ''], drops: [['gem', 2, 4, 1], ['gold_ingot', 1, 2, 1], ['gold_ore', 2, 4, 1]],
  }),
  rune_witch: fb('wyrd', {
    name: 'The Rune Witch', hp: 120, dmg: 5, step: 0.36, humanoid: true, look: 'rune_witch', brain: 'runeWitch', range: 5, tint: ['#80e8ff', '#c8a0ff'],
    phaseLines: ['', '', 'Read your fate, then.', 'The stones say you die here.'], drops: [COINS(6, 12), ['gem', 1, 2, 1], ['seer_stew', 2, 3, 1]],
  }),
  banshee: fb('wyrd', {
    name: 'The Banshee', hp: 120, dmg: 5, step: 0.32, big: true, floats: true, undead: true, light: 3, brain: 'banshee', range: 4, tint: ['#c8e0f0', '#ffffff'], style: 'grab',
    phaseLines: ['', '', '', ''], drops: [COINS(8, 14), ['gem', 1, 2, 1], ['potion_breath', 1, 1, 0.7]],
  }),
  fey_reaver: fb('wyrd', {
    name: 'The Fey Reaver', hp: 130, dmg: 6, step: 0.3, humanoid: true, look: 'fey_reaver', arms: 'sabre', light: 3, brain: 'feyReaver', tint: ['#80ffd0', '#c8a0ff'],
    raise: { sp: 'fey_knight', n: 2, pal: FEY }, phaseLines: ['', '', 'Knights of the hill, ride!', 'You walked into our world. You don\'t walk out.'],
    drops: [['gem', 2, 3, 1], ['coin', 10, 25, 1], ['potion_haste', 1, 1, 0.6]],
  }),
  white_hart: fb('wyrd', {
    name: 'The White Hart', hp: 150, dmg: 6, step: 0.26, big: true, light: 6, brain: 'whiteHart', tint: ['#ffffff', '#a0ffd0'], style: 'gore',
    phaseLines: ['', '', '', ''], drops: [['antler', 2, 4, 1], ['gem', 1, 2, 1], ['potion_vigor', 1, 1, 0.7]],
  }),
  fair_king: fb('wyrd', {
    name: 'The Fair King', hp: 150, dmg: 6, step: 0.34, humanoid: true, look: 'fair_king', arms: 'iron_sword', light: 5, brain: 'fairKing', range: 4, tint: ['#c8a0ff', '#ffe080'],
    raise: { sp: ['fey_knight', 'wisp'], n: 2, pal: FEY }, phaseLines: ['', '', 'Dance for your king!', 'A hundred years, mortal. A HUNDRED YEARS.'],
    drops: [['gem', 3, 5, 1], ['gold_ingot', 1, 2, 1], ['seer_stew', 2, 3, 1]],
  }),
  hill_sleeper: fb('wyrd', {
    name: 'The Hill Sleeper', hp: 200, dmg: 7, step: 0.65, big: true, construct: true, brain: 'hillSleeper', tint: ['#80b050', '#c8a0ff'], style: 'slam',
    phaseLines: ['', '', '', ''], drops: [['gem', 2, 4, 1], ['gold_ore', 3, 6, 1], ['heather_bread', 2, 4, 1]],
  }),
  // ---------------------------------------------------------- the Grey Skerries
  trow_king: fb('skerries', {
    name: 'The Trow King', hp: 140, dmg: 7, step: 0.44, humanoid: true, look: 'trow_king', arms: 'warhammer', brain: 'trowKing', tint: ['#80a080', '#e0d0a0'],
    raise: { sp: ['drowned', 'skeleton'], n: 2, pal: EARTH }, phaseLines: ['', '', 'Up from under the hill, my trows!', 'The sun? Down here? NEVER.'],
    drops: [COINS(6, 12), ['gold_ingot', 1, 2, 0.8], ['fish_pie', 2, 3, 1]],
  }),
  finnman: fb('skerries', {
    name: 'The Finnman', hp: 120, dmg: 5, step: 0.36, humanoid: true, look: 'finnman', undead: true, brain: 'finnman', range: 5, tint: ['#80c8e8', '#e0f8ff'],
    raise: { sp: 'drowned', n: 2, pal: SEA }, phaseLines: ['', '', 'The sea takes, and the sea takes, and the sea takes.', 'Come down to Finfolkaheem with me.'],
    drops: [COINS(6, 12), ['salt_fish', 3, 6, 1], ['gem', 1, 2, 1]],
  }),
  storm_giant: fb('skerries', {
    name: 'The Storm Giant', hp: 190, dmg: 7, step: 0.6, big: true, light: 3, brain: 'stormGiant', tint: ['#c8d8ff', '#6a7a8a'], style: 'slam',
    phaseLines: ['', '', '', ''], drops: [['iron_ingot', 4, 8, 1], ['gem', 2, 3, 1], ['potion_wind', 1, 1, 0.7]],
  }),
  stack_crab: fb('skerries', {
    name: 'The Stack Crab', hp: 180, dmg: 7, step: 0.5, big: true, brain: 'stackCrab', tint: ['#a0a090', '#e08060'], style: 'bite',
    phaseLines: ['', '', '', ''], drops: [['crab_meat', 6, 12, 1], ['iron_ore', 3, 6, 1], ['gem', 1, 2, 1]],
  }),
  selkie_widow: fb('skerries', {
    name: 'The Selkie Widow', hp: 120, dmg: 5, step: 0.34, humanoid: true, look: 'selkie_widow', brain: 'selkieWidow', range: 5, tint: ['#a0b0c0', '#e0f8ff'],
    phaseLines: ['', '', 'Where is my skin? WHERE IS MY SKIN?', 'The sea was my home, before your kind.'], drops: [['pearl', 2, 4, 1], ['leather', 3, 6, 1], ['gem', 1, 2, 1]],
  }),
  drowned_bell: fb('skerries', {
    name: 'The Drowned Bell', hp: 175, dmg: 6, step: 0.5, big: true, floats: true, construct: true, brain: 'drownedBell', range: 5, tint: ['#d8a840', '#80c8e8'], style: 'slam',
    phaseLines: ['', '', '', ''], drops: [['gold_ingot', 2, 3, 1], ['iron_ingot', 3, 6, 1], ['gem', 1, 2, 1]],
  }),
  the_wrecker: fb('skerries', {
    name: 'The Wrecker', hp: 125, dmg: 6, step: 0.34, humanoid: true, look: 'the_wrecker', arms: 'sabre', light: 5, brain: 'theWrecker', tint: ['#ffb040', '#2a3036'],
    raise: { sp: 'wrecker', n: 2, pal: FIRE }, phaseLines: ['', '', 'Show a light, lads! Bring her in onto the rocks!', 'Every ship that ever broke here paid ME.'],
    drops: [['coin', 20, 40, 1], ['lantern', 1, 1, 0.8], ['fish_pie', 2, 3, 1]],
  }),
  storm_petrel: fb('skerries', {
    name: 'The Storm Petrel', hp: 125, dmg: 6, step: 0.24, big: true, floats: true, brain: 'stormPetrel', tint: ['#a0b0c0', '#ffffff'], style: 'snap',
    phaseLines: ['', '', '', ''], drops: [['feather', 6, 12, 1], ['gem', 1, 2, 1], ['potion_wind', 1, 1, 0.7]],
  }),
  beacon_keeper: fb('skerries', {
    name: 'The Beacon-Keeper', hp: 145, dmg: 6, step: 0.36, humanoid: true, look: 'beacon_keeper', undead: true, light: 8, brain: 'beaconKeeper', range: 5, tint: ['#ffd070', '#80c8e8'],
    raise: { sp: ['drowned', 'wrecker'], n: 2, pal: LAMP }, phaseLines: ['', '', 'The light must burn! It must!', 'I kept it lit for a hundred years. I\'ll keep YOU.'],
    drops: [COINS(10, 20), ['lantern', 1, 1, 1], ['gem', 2, 3, 1]],
  }),
  sea_trow: fb('skerries', {
    name: 'The Sea Trow', hp: 190, dmg: 7, step: 0.55, big: true, brain: 'seaTrow', tint: ['#5a8a6a', '#e0f0ff'], style: 'slam',
    raise: { sp: 'drowned', n: 2, pal: SEA }, phaseLines: ['', '', '', ''], drops: [['gold_ingot', 2, 3, 1], ['pearl', 2, 4, 1], ['gem', 1, 2, 1]],
  }),
};

export const FAR_BOSS_TITLES = {
  frost_jarl: { name: 'The Frost Jarl', title: 'Barrow-Lord of the Rimewood', taunt: 'You came all this way to die in the cold.' },
  barrow_mammoth: { name: 'The Barrow Mammoth', title: 'What the Jarls Were Buried With' },
  iron_legate: { name: 'The Iron Legate', title: 'Commander of the Lost Ninth', taunt: 'You stand before the legions of the Empire.' },
  silver_wyrm: { name: 'The Silver Wyrm', title: 'Coiled in the Old Silver Workings' },
  pale_vestal: { name: 'The Pale Vestal', title: 'Keeper of the Eternal Flame', taunt: 'Kneel before the flame, child.' },
  marble_colossus: { name: 'The Marble Colossus', title: 'The Emperor\'s Likeness, Woken' },
  deserter_general: { name: 'The Deserter General', title: 'Who Turned His Back on the Empire', taunt: 'Another fool sent by the Senate?' },
  war_eagle: { name: 'The War Eagle', title: 'Standard of the Legions' },
  last_emperor: { name: 'The Last Emperor', title: 'Who Would Not Lie Down', taunt: 'On your knees before your emperor.' },
  bronze_wolf: { name: 'The Bronze Wolf', title: 'Foster-Mother of Emperors' },
  jade_corpse_lord: { name: 'The Jade Corpse-Lord', title: 'Who Sleeps in a Suit of Jade', taunt: 'Hold your breath... it will not help.' },
  skinwalker: { name: 'The Skinwalker', title: 'Wearer of Borrowed Shapes' },
  turquoise_golem: { name: 'The Turquoise Golem', title: 'Guardian of the Blue Seam' },
  great_centipede: { name: 'The Great Centipede', title: 'A Hundred Legs in the Dark' },
  nine_tailed_fox: { name: 'The Nine-Tailed Fox', title: 'Nine Lives, Nine Lies' },
  hungry_ghost: { name: 'The Hungry Ghost', title: 'Never Fed, Never Full' },
  bandit_khan: { name: 'The Bandit Khan', title: 'Lord of the Red Canyons', taunt: 'Your horse, your gold, your life. In that order.' },
  thunderbird: { name: 'The Thunderbird', title: 'Whose Wings Are the Storm' },
  terracotta_general: { name: 'The Terracotta General', title: 'Who Commands Eight Thousand of Clay', taunt: 'The army stands. The army always stands.' },
  jade_dragon: { name: 'The Jade Dragon', title: 'Keeper of the First Emperor\'s Pearl' },
  bone_thane: { name: 'The Bone Thane', title: 'Lord of the Whale-Road', taunt: 'My bones were a ship once.' },
  carrion_roc: { name: 'The Carrion Roc', title: 'That Picked the Leviathan Clean' },
  scrimshaw_horror: { name: 'The Scrimshaw Horror', title: 'Every Bone Carved With a Name' },
  oil_bloat: { name: 'The Oil Bloat', title: 'Fat With the Whale\'s Oil' },
  whale_priest: { name: 'The Whale Priest', title: 'Who Prays to What Swallowed Him', taunt: 'The Great Whale welcomes you.' },
  kraken_spawn: { name: 'The Kraken Spawn', title: 'Hatched in the Bone Chapel' },
  harpoon_queen: { name: 'The Harpoon Queen', title: 'Never Missed a Whale, Never Missed a Man', taunt: 'Stand still. It hurts less.' },
  bull_walrus: { name: 'The Bull Walrus', title: 'Master of the Rookery' },
  leviathan_heart: { name: 'The Leviathan\'s Heart', title: 'Still Beating, After All This Time' },
  gut_wyrm: { name: 'The Gut Wyrm', title: 'What Lives Inside the Whale' },
  salt_mummy: { name: 'The Salt Mummy', title: 'Cured in Brine a Thousand Years', taunt: 'Water... water...' },
  brine_crab_king: { name: 'The Brine Crab King', title: 'Crowned in Salt' },
  crystal_matriarch: { name: 'The Crystal Matriarch', title: 'Mother of the Singing Salt' },
  salt_wyrm: { name: 'The Salt Wyrm', title: 'That Ate the Deepest Pans' },
  salt_bride: { name: 'The Salt Bride', title: 'Who Wept Herself Into Salt', taunt: 'Have you seen my love?' },
  flamingo_seraph: { name: 'The Flamingo Seraph', title: 'Rosy Angel of the Pans' },
  salt_doge: { name: 'The Salt Doge', title: 'Who Taxed the Sea Itself', taunt: 'You owe me. Everyone owes me.' },
  lagoon_hydra: { name: 'The Lagoon Hydra', title: 'Three Heads, Three Hungers' },
  salt_mother: { name: 'The Salt Mother', title: 'To Whom the Cathedrals Were Dug', taunt: 'You are mostly water, child. I can fix that.' },
  mirage_lion: { name: 'The Mirage Lion', title: 'Seen Everywhere, Found Nowhere' },
  mole_king: { name: 'The Mole King', title: 'Blind, and Still the King' },
  root_witch: { name: 'The Root Witch', title: 'Who Grows the Lanterns', taunt: 'Fertiliser! How kind.' },
  glowworm_queen: { name: 'The Glowworm Queen', title: 'Whose Light Is a Snare' },
  deep_golem: { name: 'The Deep Golem', title: 'Dug Up By Nobody' },
  moth_queen: { name: 'The Moth Queen', title: 'Golden Wings in the Lantern-Crypt' },
  lamplighter: { name: 'The Lamplighter', title: 'Who Puts the Lights Out', taunt: 'Bedtime.' },
  burrow_baron: { name: 'The Burrow Baron', title: 'Fattest Burglar in Hollowmark', taunt: 'Wipe your feet. Then give me your purse.' },
  cave_bear: { name: 'The Cave Bear', title: 'Sleeping in the Burglars\' Burrow' },
  first_digger: { name: 'The First Digger', title: 'Who Dug Before There Were Diggers' },
  thing_below: { name: 'The Thing Below', title: 'What Everything Down Here Was Digging Away From' },
  raven_queen: { name: 'The Raven Queen', title: 'Mistress of the Barrow-Birds', taunt: 'My ravens are hungry.' },
  antlered_one: { name: 'The Antlered One', title: 'Lord of the Wild Hunt', taunt: 'Run. It is better sport.' },
  rune_golem: { name: 'The Rune Golem', title: 'Written Into Being' },
  ninth_wyrm: { name: 'The Ninth Wyrm', title: 'The Last of the Nine' },
  rune_witch: { name: 'The Rune Witch', title: 'Reader of Bones and Stones', taunt: 'I have read this already. You lose.' },
  banshee: { name: 'The Banshee', title: 'Whose Cry Foretells Death' },
  fey_reaver: { name: 'The Fey Reaver', title: 'Knight-Captain of the Hollow Hill', taunt: 'Mortal steel. How quaint.' },
  white_hart: { name: 'The White Hart', title: 'Never Caught by Any Hunt' },
  fair_king: { name: 'The Fair King', title: 'Lord of the Hollow Hills', taunt: 'Welcome to my court. Stay a hundred years.' },
  hill_sleeper: { name: 'The Hill Sleeper', title: 'The Hill That Got Up' },
  trow_king: { name: 'The Trow King', title: 'Under the Cairn, Out of the Sun', taunt: 'Hah! A morsel!' },
  finnman: { name: 'The Finnman', title: 'Rower of the Drowned', taunt: 'Your wife will be mine.' },
  storm_giant: { name: 'The Storm Giant', title: 'Whose Breath Is the Gale' },
  stack_crab: { name: 'The Stack Crab', title: 'A Sea-Stack on Legs' },
  selkie_widow: { name: 'The Selkie Widow', title: 'Who Lost Her Sealskin', taunt: 'You have the look of the man who stole it.' },
  drowned_bell: { name: 'The Drowned Bell', title: 'That Tolls for the Drowned' },
  the_wrecker: { name: 'The Wrecker', title: 'False Light of the Skerries', taunt: 'Another ship on the rocks. Another purse.' },
  storm_petrel: { name: 'The Storm Petrel', title: 'Herald of the Gale' },
  beacon_keeper: { name: 'The Beacon-Keeper', title: 'Who Kept the Light Too Long', taunt: 'Stay in the light.' },
  sea_trow: { name: 'The Sea Trow', title: 'Up From the Flooded Stair' },
};

// --------------------------------------------------------------- brains
export const FAR_BRAINS = {
  // ------------------------------------------------ Velmarch
  // The Frost Jarl: frost breath, an ice floor, a cleave that throws you,
  // icicles from the barrow's roof, and wolves.
  frostJarl(c, dt) {
    return fight(c, dt, [
      ['breathCd', 2, 7, 'breath', { kind: 'cold', len: 5, dmg: 5, chill: 2.5, pal: FROST, say: 'Feel the winter.', sound: 'freeze', max: 6 }],
      ['iceCd', 4, 11, 'zone', { floor: 'ice', zk: 'ice', r: 2, life: 9, zchill: 1, tick: 1, pal: FROST, say: 'The barrow freezes.' }],
      ['cleaveCd', 1, 5, 'slam', { r: 1, dmg: 7, knock: 3, pal: FROST, max: 2 }],
      ['icicleCd', 3, 9, 'rain', { n: 14, kind: 'rocks', dmg: 4, chill: 1, pal: FROST, ph: 2, sound: 'crumble' }],
      ['howlCd', 6, 14, 'summon', { sp: 'frost_wolf', n: 2, cap: 3, pal: FROST, say: 'To me, wolves of the barrow!' }],
      ['rimeCd', 8, 16, 'cross', { kind: 'cold', dmg: 6, chill: 2, pal: FROST, diag: true, ph: 3, say: 'WINTER!' }],
    ]);
  },
  // The Barrow Mammoth: charges, trumpets, stamps the barrow so its roof
  // comes down, and gores what's close.
  barrowMammoth(c, dt) {
    return fight(c, dt, [
      ['chargeCd', 2, 8, 'charge', { dmg: 8, knock: 3, len: 12, pal: FROST, min: 3, sound: 'charge' }],
      ['stampCd', 3, 9, 'quake', { n: 5, dmg: 5, pal: FROST, sound: 'boom' }],
      ['trumpetCd', 5, 13, 'howl', { r: 4, dmg: 2, stun: 0.9, pal: FROST, sound: 'boom' }],
      ['goreCd', 1, 5, 'slam', { r: 1, dmg: 8, knock: 3, pal: FROST, max: 2 }],
      ['roofCd', 6, 12, 'rain', { n: 18, kind: 'rocks', dmg: 5, pal: EARTH, ph: 2, sound: 'rumble' }],
      ['frostCd', 7, 15, 'breath', { kind: 'cold', len: 6, spread: 0.8, dmg: 4, chill: 3, pal: FROST, ph: 3 }],
    ]);
  },
  // The Iron Legate: pila thrown, the testudo, his shield-bash, ranks
  // formed and sent marching across the hall.
  ironLegate(c, dt) {
    return fight(c, dt, [
      ['pilumCd', 2, 6, 'volley', { n: 3, dmg: 5, r: 0, pal: GOLD, tint: [200, 200, 210], min: 3, say: 'Loose pila!' }],
      ['testudoCd', 5, 14, 'ward', { secs: 4, k: 0.2, text: 'testudo!', pal: GOLD, say: 'Testudo!' }],
      ['bashCd', 1, 5, 'slam', { r: 1, dmg: 6, knock: 2, stun: 0.5, pal: GOLD, max: 2 }],
      ['ranksCd', 6, 15, 'summon', { sp: 'legion_shade', n: 2, cap: 4, pal: GOLD, say: 'Form ranks!' }],
      ['marchCd', 8, 16, 'wall', { march: true, dmg: 6, pal: GOLD, ph: 2, say: 'Advance!', sound: 'march' }],
      ['javelinCd', 4, 9, 'beam', { n: 3, fan: 0.3, dmg: 5, pal: GOLD, ph: 3, beam: '#e8e8f0', halo: '#c8a040' }],
    ]);
  },
  // The Silver Wyrm: a breath of quicksilver, the gallery's roof brought
  // down on you, its coils lashed round, burrowing up beneath you.
  silverWyrm(c, dt) {
    return fight(c, dt, [
      ['breathCd', 2, 7, 'beam', { dmg: 6, pal: MARBLE, beam: '#ffffff', halo: '#a0b0c8', width: 4, sound: 'beam' }],
      ['coilCd', 3, 8, 'slam', { r: 2, dmg: 6, knock: 2, pal: MARBLE, max: 3 }],
      ['ventCd', 4, 10, 'erupt', { extra: 4, r: 1, dmg: 6, pal: MARBLE, say: '', sound: 'crumble' }],
      ['roofCd', 6, 13, 'rain', { n: 16, kind: 'rocks', dmg: 5, pal: EARTH, ph: 2 }],
      ['spiralCd', 8, 15, 'spiral', { n: 22, dmg: 5, kind: 'erupt', pal: MARBLE, ph: 3 }],
    ]);
  },
  // The Pale Vestal: the eternal flame laid round her, beams of it, a
  // sacred fire marking where you stand, and she tends her own wounds.
  paleVestal(c, dt) {
    return fight(c, dt, [
      ['flameCd', 2, 7, 'beam', { n: 2, fan: 0.5, dmg: 5, burn: 2, kind: 'fire', pal: FIRE, beam: '#fff0c0', halo: '#ff9030', max: 10 }],
      ['hearthCd', 4, 11, 'zone', { zk: 'fire', r: 1, life: 7, tick: 0.6, tickDmg: 1, zburn: 1.5, pal: FIRE, say: 'The flame spreads.' }],
      ['pyreCd', 5, 10, 'mark', { r: 1, dmg: 9, burn: 3, kind: 'fire', pal: FIRE, text: 'consecrated...' }],
      ['vowCd', 8, 16, 'heal', { below: 0.7, k: 0.07, pal: GOLD, say: 'The flame restores me.' }],
      ['circleCd', 6, 14, 'quake', { n: 4, kind: 'fire', burn: 1.5, dmg: 4, round: true, pal: FIRE, ph: 2 }],
      ['sunCd', 9, 16, 'cross', { kind: 'fire', dmg: 6, burn: 2, diag: true, pal: FIRE, ph: 3, say: 'Burn with me!' }],
    ]);
  },
  // The Marble Colossus: fists like falling columns, pieces of itself
  // flung, its marble skin set hard, and it topples a pillar across you.
  marbleColossus(c, dt) {
    return fight(c, dt, [
      ['fistCd', 1, 5, 'slam', { r: 2, dmg: 8, knock: 3, pal: MARBLE, max: 3 }],
      ['flingCd', 3, 8, 'volley', { n: 3, r: 1, dmg: 6, pal: MARBLE, tint: [240, 236, 228], min: 3 }],
      ['setCd', 6, 15, 'ward', { secs: 5, k: 0.15, text: 'marble-hard', pal: MARBLE }],
      ['columnCd', 4, 10, 'wall', { dmg: 9, kind: 'rocks', pal: MARBLE, sound: 'crumble' }],
      ['quakeCd', 7, 14, 'quake', { n: 5, dmg: 5, pal: MARBLE, ph: 2 }],
      ['shatterCd', 9, 16, 'rain', { n: 20, kind: 'rocks', dmg: 5, pal: MARBLE, ph: 3 }],
    ]);
  },
  // The Deserter General: his archers' volleys, a charge at the head of
  // his men, his banner raised, his sabre.
  deserterGeneral(c, dt) {
    return fight(c, dt, [
      ['volleyCd', 3, 8, 'rain', { n: 16, kind: 'dart', dmg: 4, pal: RED, say: 'Archers! Loose!' }],
      ['chargeCd', 2, 9, 'charge', { dmg: 7, knock: 2, pal: RED, min: 3, say: 'CHARGE!' }],
      ['sabreCd', 1, 5, 'slam', { r: 1, dmg: 7, pal: RED, max: 2 }],
      ['rallyCd', 6, 15, 'summon', { sp: ['cutthroat', 'holdout_archer'], n: 2, cap: 4, pal: RED, say: 'To me!' }],
      ['bannerCd', 7, 15, 'ward', { secs: 4, k: 0.4, text: 'rallied', pal: RED, ph: 2 }],
      ['flankCd', 8, 14, 'blink', { pal: RED, ph: 3, say: 'Flank!' }],
    ]);
  },
  // The War Eagle: dives, wingbeats that throw you, talons, a scream.
  warEagle(c, dt) {
    return fight(c, dt, [
      ['diveCd', 2, 7, 'pounce', { dmg: 7, pal: GOLD, min: 2, say: '', sound: 'whoosh' }],
      ['wingCd', 3, 8, 'gust', { len: 6, dmg: 3, knock: 4, pal: GALE, sound: 'whoosh' }],
      ['talonCd', 1, 5, 'slam', { r: 1, dmg: 6, pal: GOLD, max: 2 }],
      ['featherCd', 4, 9, 'volley', { n: 5, r: 0, dmg: 4, pal: GOLD, tint: [220, 180, 120] }],
      ['screamCd', 7, 14, 'howl', { r: 5, dmg: 2, stun: 0.8, pal: GOLD, ph: 2 }],
      ['stoopCd', 8, 13, 'charge', { dmg: 8, knock: 3, len: 14, pal: GOLD, min: 3, ph: 3 }],
    ]);
  },
  // The Last Emperor: his decree (a mark that comes down where you
  // stood), his sceptre's beam, gold thrown like largesse, praetorians at
  // his call, and the Triumph: the legion marching across his hall.
  lastEmperor(c, dt) {
    return fight(c, dt, [
      ['decreeCd', 2, 8, 'mark', { r: 1, dmg: 10, pal: GOLD, text: 'condemned...', say: ['Thumbs down.', 'Execute this one.'] }],
      ['sceptreCd', 1, 6, 'beam', { n: 2, fan: 0.35, dmg: 5, pal: { c: [190, 110, 255], p: ['#c060ff', '#ffe0ff', '#7020a0'] }, beam: '#ffe0ff', halo: '#a040c0' }],
      ['largesseCd', 3, 9, 'volley', { n: 5, r: 1, dmg: 4, pal: GOLD, tint: [255, 210, 80], say: 'Gold for the mob!' }],
      ['praetorCd', 5, 15, 'summon', { sp: 'legion_shade', n: 2, cap: 4, pal: GOLD, say: 'Praetorians!' }],
      ['triumphCd', 6, 16, 'wall', { march: true, dmg: 7, pal: GOLD, ph: 2, say: 'TRIUMPH!', sound: 'march' }],
      ['purpleCd', 9, 15, 'spin', { n: 10, dmg: 6, pal: { c: [190, 110, 255], p: ['#c060ff', '#ffe0ff', '#7020a0'] }, ph: 3, say: 'I AM THE EMPIRE.' }],
    ]);
  },
  // The Bronze Wolf: bronze fangs, a howl that calls her pack, molten
  // bronze where her teeth meet the floor, a leap.
  bronzeWolf(c, dt) {
    return fight(c, dt, [
      ['leapCd', 2, 7, 'pounce', { dmg: 7, pal: GOLD, min: 2 }],
      ['fangCd', 1, 5, 'slam', { r: 1, dmg: 7, pal: GOLD, max: 2 }],
      ['howlCd', 5, 14, 'summon', { sp: 'frost_wolf', n: 2, cap: 3, pal: GOLD, sound: 'roar' }],
      ['moltenCd', 4, 10, 'breath', { kind: 'fire', len: 5, dmg: 6, burn: 2, pal: FIRE }],
      ['runCd', 6, 11, 'charge', { dmg: 7, knock: 2, pal: GOLD, min: 3, ph: 2 }],
      ['ringCd', 8, 15, 'quake', { n: 4, kind: 'fire', burn: 1, dmg: 5, round: true, pal: FIRE, ph: 3 }],
    ]);
  },
  // ------------------------------------------------ Ostria
  // The Jade Corpse-Lord: hops (gone, and on you), drinks your breath,
  // paper charms that hold you, his household risen.
  jadeCorpseLord(c, dt) {
    return fight(c, dt, [
      ['hopCd', 2, 5, 'pounce', { dmg: 6, pal: JADE, min: 2, sound: 'thud' }],
      ['breathCd', 3, 8, 'beam', { dmg: 5, pal: JADE, drainBeam: true, beam: '#e0fff0', halo: '#40c080', say: 'Your breath...' }],
      ['charmCd', 4, 10, 'zone', { zk: 'snare', r: 1, root: 1.2, life: 8, pal: { c: [240, 210, 90], p: ['#f0d860', '#c82020', '#fff8c0'] }, say: 'Be still.' }],
      ['householdCd', 6, 15, 'summon', { sp: 'jade_corpse', n: 2, cap: 4, pal: JADE }],
      ['jadeCd', 7, 14, 'cross', { kind: 'hex', dmg: 6, pal: JADE, onYou: true, ph: 2 }],
      ['tombCd', 9, 16, 'spiral', { n: 22, dmg: 5, pal: JADE, ph: 3 }],
    ]);
  },
  // The Skinwalker: a borrowed shape (here, then there), its howl, a
  // curse of dust in your eyes, and the coyotes that run with it.
  skinwalker(c, dt) {
    return fight(c, dt, [
      ['shapeCd', 2, 6, 'blink', { pal: RED, sound: 'whoosh' }],
      ['pounceCd', 3, 7, 'pounce', { dmg: 6, pal: EARTH, min: 2 }],
      ['dustCd', 4, 10, 'blind', { secs: 2.5, pal: EARTH, say: '' }],
      ['packCd', 6, 15, 'summon', { sp: 'coyote', n: 2, cap: 3, pal: RED }],
      ['curseCd', 7, 13, 'mirage', { n: 4, dmg: 8, pal: RED, ph: 2 }],
      ['howlCd', 9, 15, 'howl', { r: 5, stun: 1, pal: RED, ph: 3 }],
    ]);
  },
  // The Turquoise Golem: fists, shards of turquoise, a seam of the stone
  // that cracks across the floor, and its inlay glowing hard.
  turquoiseGolem(c, dt) {
    const T = { c: [64, 208, 200], p: ['#40d0c8', '#e0fff8', '#1a7a7a'] };
    return fight(c, dt, [
      ['fistCd', 1, 5, 'slam', { r: 2, dmg: 8, knock: 3, pal: T, max: 3 }],
      ['shardCd', 3, 8, 'volley', { n: 4, r: 0, dmg: 5, pal: T }],
      ['seamCd', 4, 9, 'cross', { kind: 'erupt', dmg: 7, pal: T, onYou: true, sound: 'crumble' }],
      ['inlayCd', 6, 15, 'ward', { secs: 5, k: 0.2, text: 'inlaid', pal: T }],
      ['quakeCd', 8, 14, 'quake', { n: 5, dmg: 5, pal: T, ph: 2 }],
      ['beamCd', 9, 15, 'spin', { n: 8, dmg: 6, pal: T, ph: 3 }],
    ]);
  },
  // The Great Centipede: venom spat, a rush down the gallery, its coils,
  // poison pooled where it's been.
  greatCentipede(c, dt) {
    return fight(c, dt, [
      ['spitCd', 2, 6, 'volley', { n: 3, r: 1, dmg: 4, pal: BILE, zone: 'poison', life: 6, tick: 1, tickDmg: 1, slow: true }],
      ['rushCd', 3, 8, 'charge', { dmg: 7, knock: 2, len: 12, pal: RED, min: 3 }],
      ['coilCd', 1, 5, 'slam', { r: 2, dmg: 6, pal: RED, max: 2 }],
      ['venomCd', 5, 10, 'breath', { kind: 'acid', len: 5, dmg: 5, pal: BILE }],
      ['burrowCd', 7, 13, 'erupt', { extra: 3, r: 1, dmg: 6, pal: EARTH, ph: 2 }],
      ['swarmCd', 9, 15, 'spiral', { n: 20, kind: 'acid', dmg: 4, pal: BILE, ph: 3 }],
    ]);
  },
  // The Nine-Tailed Fox: foxfire lobbed, its tails' marks (only one of
  // them real), here then there, and a charm that holds you.
  nineTailedFox(c, dt) {
    const F = { c: [255, 160, 60], p: ['#ff9030', '#fff0c0', '#ff5010'] };
    return fight(c, dt, [
      ['foxfireCd', 2, 6, 'volley', { n: 3, r: 1, dmg: 5, burn: 1.5, pal: F }],
      ['tailsCd', 3, 9, 'mirage', { n: 5, dmg: 9, pal: F, say: '' }],
      ['vanishCd', 4, 8, 'blink', { pal: F, sound: 'whoosh' }],
      ['charmCd', 6, 12, 'zone', { zk: 'snare', r: 1, root: 1.2, life: 6, pal: F }],
      ['ninefoldCd', 8, 14, 'spin', { n: 9, turns: 9, dmg: 5, pal: F, ph: 2 }],
      ['pyreCd', 9, 16, 'quake', { n: 4, kind: 'fire', burn: 2, round: true, dmg: 5, pal: F, ph: 3 }],
    ]);
  },
  // The Hungry Ghost: it pulls you to its mouth, it eats (and steals your
  // food), it wails, and its hunger spreads cold about it.
  hungryGhost(c, dt) {
    return fight(c, dt, [
      ['devourCd', 2, 7, 'pull', { n: 3, dmg: 4, grab: 0.6, pal: JADE, text: 'drawn to its mouth!', say: 'Hungry... so hungry...' }],
      ['gnawCd', 1, 5, 'rob', { dmg: 4, pal: JADE }],
      ['wailCd', 4, 11, 'howl', { r: 5, dmg: 3, stun: 0.8, pal: JADE }],
      ['coldCd', 5, 10, 'zone', { zk: 'chill', r: 2, life: 8, tick: 1, zchill: 1.5, tickDmg: 1, pal: FROST }],
      ['mouthCd', 7, 13, 'breath', { kind: 'hex', len: 5, dmg: 6, drain: 2, pal: JADE, ph: 2 }],
      ['famineCd', 9, 16, 'rain', { n: 16, kind: 'hex', dmg: 4, pal: JADE, ph: 3 }],
    ]);
  },
  // The Bandit Khan: arrows from the saddle, a bola that holds you, the
  // charge of his riders, his sabre.
  banditKhan(c, dt) {
    return fight(c, dt, [
      ['arrowCd', 2, 6, 'beam', { n: 3, fan: 0.3, kind: 'dart', dmg: 5, pal: RED, min: 2 }],
      ['bolaCd', 4, 10, 'zone', { zk: 'snare', r: 0, root: 1.4, life: 6, pal: EARTH, say: 'Catch!' }],
      ['chargeCd', 3, 8, 'charge', { dmg: 7, knock: 2, pal: RED, min: 3, say: 'Ride them down!' }],
      ['sabreCd', 1, 5, 'slam', { r: 1, dmg: 7, pal: RED, max: 2 }],
      ['ridersCd', 6, 15, 'summon', { sp: ['cutthroat', 'holdout_archer'], n: 2, cap: 4, pal: RED }],
      ['stormCd', 8, 14, 'rain', { n: 18, kind: 'dart', dmg: 4, pal: RED, ph: 2, say: 'Darken the sky!' }],
    ]);
  },
  // The Thunderbird: lightning from its wings, a thunderclap, a gale off
  // them, its dive.
  thunderbird(c, dt) {
    return fight(c, dt, [
      ['boltCd', 2, 7, 'lightning', { n: 5, dmg: 6, sound: 'thunder' }],
      ['clapCd', 4, 10, 'howl', { r: 5, dmg: 3, stun: 1, pal: STORM, sound: 'thunder' }],
      ['wingCd', 3, 8, 'gust', { len: 6, knock: 4, pal: STORM }],
      ['diveCd', 5, 9, 'pounce', { dmg: 7, pal: STORM, min: 2 }],
      ['stormCd', 8, 15, 'lightning', { n: 10, every: 0.22, dmg: 5, ph: 2 }],
      ['crossCd', 9, 15, 'cross', { kind: 'burst', dmg: 7, diag: true, pal: STORM, ph: 3 }],
    ]);
  },
  // The Terracotta General: his crossbowmen's rows loosing down the hall,
  // the clay army at his call, his halberd, fired clay set hard.
  terracottaGeneral(c, dt) {
    return fight(c, dt, [
      ['rowsCd', 2, 8, 'wall', { march: true, step: 3, every: 0.5, kind: 'dart', dmg: 5, pal: RED, say: 'Front rank, LOOSE!' }],
      ['halberdCd', 1, 5, 'slam', { r: 2, dmg: 7, knock: 2, pal: RED, max: 3 }],
      ['armyCd', 5, 15, 'summon', { sp: ['terracotta_soldier', 'terracotta_archer'], n: 2, cap: 5, pal: RED, say: 'Wake, my army!' }],
      ['clayCd', 6, 14, 'ward', { secs: 5, k: 0.2, text: 'fired clay', pal: RED }],
      ['boltsCd', 4, 9, 'beam', { n: 3, fan: 0.28, kind: 'dart', dmg: 5, pal: RED, min: 2 }],
      ['kilnCd', 9, 16, 'quake', { n: 5, kind: 'fire', burn: 1.5, dmg: 5, pal: FIRE, ph: 3 }],
    ]);
  },
  // The Jade Dragon: its pearl hurled, jade breath, coils round its
  // hall, rain called down, lightning.
  jadeDragon(c, dt) {
    return fight(c, dt, [
      ['breathCd', 2, 7, 'breath', { kind: 'hex', len: 6, dmg: 6, pal: JADE, sound: 'beam' }],
      ['pearlCd', 3, 8, 'mark', { r: 1, dmg: 9, pal: { c: [255, 240, 200], p: ['#fff0c0', '#ffffff', '#e0c070'] }, text: 'the pearl falls...' }],
      ['coilCd', 1, 6, 'slam', { r: 2, dmg: 7, pal: JADE, max: 3 }],
      ['rainCd', 5, 12, 'flood', { r: 2, life: 8, pal: SEA }],
      ['stormCd', 7, 14, 'lightning', { n: 6, dmg: 6, ph: 2 }],
      ['dragonCd', 9, 16, 'spiral', { n: 24, dmg: 6, pal: JADE, ph: 3, say: '' }],
    ]);
  },
  // ------------------------------------------------ Corrow
  // The Bone Thane: his axe, a cairn's stones, the barrow's dead risen,
  // a ring of bones thrust up round you.
  boneThane(c, dt) {
    return fight(c, dt, [
      ['axeCd', 1, 5, 'slam', { r: 1, dmg: 8, knock: 2, pal: BONE, max: 2 }],
      ['throwCd', 3, 7, 'volley', { n: 2, r: 1, dmg: 6, pal: BONE, tint: [230, 220, 200], min: 3 }],
      ['ribsCd', 4, 10, 'zone', { zk: 'snare', r: 1, root: 1, life: 6, dmg: 4, kind: 'erupt', pal: BONE, say: 'The ribs close.' }],
      ['hearthCd', 6, 15, 'summon', { sp: ['skeleton', 'bone_whaler'], n: 2, cap: 4, pal: BONE }],
      ['shieldCd', 7, 14, 'ward', { secs: 4, k: 0.3, text: 'shield-wall', pal: BONE, ph: 2 }],
      ['whaleCd', 9, 16, 'charge', { dmg: 9, knock: 3, len: 12, pal: BONE, min: 3, ph: 3, say: 'The whale-road!' }],
    ]);
  },
  // The Carrion Roc: talons, wing-gusts, a rain of picked bones, its
  // stoop.
  carrionRoc(c, dt) {
    return fight(c, dt, [
      ['stoopCd', 2, 7, 'pounce', { dmg: 7, pal: BONE, min: 2, sound: 'whoosh' }],
      ['wingCd', 3, 8, 'gust', { len: 6, knock: 4, pal: GALE }],
      ['talonCd', 1, 5, 'slam', { r: 1, dmg: 6, pal: BONE, max: 2 }],
      ['bonesCd', 4, 10, 'rain', { n: 14, kind: 'rocks', dmg: 4, pal: BONE }],
      ['shriekCd', 7, 13, 'howl', { r: 5, stun: 0.8, pal: BONE, ph: 2 }],
      ['carrionCd', 9, 15, 'blind', { secs: 3, pal: BONE, ph: 3 }],
    ]);
  },
  // The Scrimshaw Horror: carved bones flung, the names carved in it
  // glowing in turn, a ring of bone spikes, bone that grabs.
  scrimshawHorror(c, dt) {
    return fight(c, dt, [
      ['flingCd', 2, 6, 'volley', { n: 4, r: 0, dmg: 5, pal: BONE }],
      ['spikeCd', 3, 8, 'quake', { n: 4, dmg: 5, pal: BONE, round: true }],
      ['namesCd', 4, 10, 'spiral', { n: 20, dmg: 5, pal: { c: [80, 140, 200], p: ['#5a9ad8', '#e0f0ff', '#2a5a8a'] } }],
      ['clutchCd', 1, 6, 'slam', { r: 2, dmg: 6, stun: 0.6, pal: BONE, max: 3 }],
      ['etchCd', 7, 13, 'cross', { kind: 'hex', dmg: 6, pal: { c: [80, 140, 200], p: ['#5a9ad8', '#e0f0ff', '#2a5a8a'] }, onYou: true, ph: 2 }],
      ['ossuaryCd', 9, 15, 'rain', { n: 18, kind: 'rocks', dmg: 5, pal: BONE, ph: 3 }],
    ]);
  },
  // The Oil Bloat: whale oil spilt about its hall, set alight; it belches,
  // and when it's burst it burns.
  oilBloat(c, dt) {
    const OIL = { c: [120, 100, 60], p: ['#3a3020', '#c8a050', '#6a5a3a'] };
    return fight(c, dt, [
      ['spillCd', 2, 7, 'volley', { n: 3, r: 1, dmg: 3, pal: OIL, zone: 'oil', life: 10, slow: true }],
      ['sparkCd', 4, 9, 'zone', { zk: 'fire', r: 2, life: 6, tick: 0.6, tickDmg: 1, zburn: 1.5, pal: FIRE, say: '' }],
      ['belchCd', 3, 8, 'breath', { kind: 'acid', len: 5, dmg: 5, pal: OIL }],
      ['bounceCd', 1, 6, 'slam', { r: 2, dmg: 6, knock: 3, pal: OIL, max: 3 }],
      ['flareCd', 7, 13, 'quake', { n: 4, kind: 'fire', burn: 2, dmg: 4, pal: FIRE, ph: 2 }],
      ['blazeCd', 9, 16, 'rain', { n: 16, kind: 'fire', burn: 2, dmg: 4, pal: FIRE, ph: 3 }],
    ]);
  },
  // The Whale Priest: the tide called in, hymns that hold you, beams of
  // the deep's cold light, the drowned at his prayer.
  whalePriest(c, dt) {
    return fight(c, dt, [
      ['tideCd', 3, 10, 'flood', { r: 2, life: 8, pal: SEA, say: 'The tide answers!' }],
      ['hymnCd', 4, 11, 'howl', { r: 4, dmg: 2, stun: 1, pal: SEA, say: 'Hear the song of the deep...' }],
      ['deepCd', 2, 6, 'beam', { n: 2, fan: 0.4, dmg: 5, chill: 1.5, kind: 'cold', pal: SEA }],
      ['drownedCd', 6, 15, 'summon', { sp: 'drowned', n: 2, cap: 4, pal: SEA }],
      ['bellyCd', 7, 13, 'pull', { n: 3, dmg: 4, grab: 0.8, pal: SEA, ph: 2, text: 'into the belly!' }],
      ['abyssCd', 9, 16, 'spiral', { n: 22, kind: 'cold', chill: 1, dmg: 5, pal: SEA, ph: 3 }],
    ]);
  },
  // The Kraken Spawn: arms up through the floor, ink, a grab and a throw,
  // the floor swirling round it.
  krakenSpawn(c, dt) {
    const K = { c: [200, 80, 130], p: ['#c05080', '#ffb0d0', '#6a2040'] };
    return fight(c, dt, [
      ['armsCd', 2, 6, 'erupt', { extra: 4, r: 0, dmg: 6, pal: K }],
      ['inkCd', 4, 10, 'blind', { secs: 3, pal: INK, say: '' }],
      ['grabCd', 3, 8, 'pull', { n: 3, dmg: 5, grab: 1, pal: K, text: 'seized!' }],
      ['sweepCd', 1, 6, 'slam', { r: 2, dmg: 6, knock: 2, pal: K, max: 3 }],
      ['whirlCd', 7, 14, 'zone', { zk: 'whirl', r: 2, life: 6, tick: 0.8, tickDmg: 1, pal: SEA, ph: 2 }],
      ['thrashCd', 9, 15, 'spin', { n: 8, kind: 'slam', dmg: 6, pal: K, ph: 3 }],
    ]);
  },
  // The Harpoon Queen: her harpoon on its line (you hauled in), a net
  // from the rafters, a firepot of whale oil, her crew.
  harpoonQueen(c, dt) {
    return fight(c, dt, [
      ['harpoonCd', 2, 6, 'pull', { n: 4, dmg: 6, grab: 0.5, pal: SEA, text: 'harpooned!', say: 'There she blows!' }],
      ['netCd', 4, 10, 'zone', { zk: 'web', r: 1, root: 1.4, life: 7, pal: BONE, say: 'Net!' }],
      ['potCd', 3, 8, 'volley', { n: 2, r: 1, dmg: 5, burn: 2, pal: FIRE, zone: 'fire', life: 5, tick: 0.6, tickDmg: 1, zburn: 1 }],
      ['thrustCd', 1, 5, 'beam', { len: 3, dmg: 7, pal: SEA, max: 3 }],
      ['crewCd', 6, 15, 'summon', { sp: ['cutthroat', 'bone_whaler'], n: 2, cap: 4, pal: SEA }],
      ['flurryCd', 8, 14, 'beam', { n: 5, fan: 0.25, kind: 'dart', dmg: 5, pal: SEA, ph: 2 }],
    ]);
  },
  // The Bull Walrus: belly-flop, tusks, its bellow, a slide down the
  // rookery at you.
  bullWalrus(c, dt) {
    return fight(c, dt, [
      ['flopCd', 2, 8, 'pounce', { dmg: 8, knock: 2, pal: SEA, min: 2, sound: 'boom' }],
      ['tuskCd', 1, 5, 'slam', { r: 1, dmg: 8, knock: 3, pal: BONE, max: 2 }],
      ['bellowCd', 4, 11, 'howl', { r: 5, stun: 0.9, pal: SEA, sound: 'roar' }],
      ['slideCd', 3, 8, 'charge', { dmg: 7, knock: 3, len: 12, pal: SEA, min: 3 }],
      ['splashCd', 6, 12, 'flood', { r: 2, life: 7, pal: SEA, ph: 2 }],
      ['rookeryCd', 8, 14, 'quake', { n: 5, dmg: 5, pal: SEA, ph: 3 }],
    ]);
  },
  // The Leviathan's Heart: it beats, and every beat throws a ring of
  // force out through the gut; its arteries spray; its parasites come.
  leviathanHeart(c, dt) {
    const H = { c: [230, 70, 90], p: ['#e04050', '#ffb0a0', '#8a1a2a'] };
    if ((c.beatT = (c.beatT ?? 1.4) - dt) <= 0) {
      c.beatT = phaseOf(c) >= 3 ? 1.0 : 1.4;
      c.game.audio?.play('heart', c);
      c.game.shake = Math.min(1, (c.game.shake || 0) + 0.15);
    }
    return fight(c, dt, [
      ['beatCd', 1, 4, 'quake', { n: 6, every: 0.24, dmg: 4, round: true, pal: H, max: 14 }],
      ['arteryCd', 3, 7, 'spin', { n: 6, dmg: 5, kind: 'acid', pal: BILE, max: 14 }],
      ['bileCd', 4, 9, 'volley', { n: 3, r: 1, dmg: 4, pal: BILE, zone: 'bile', life: 7, slow: true, tick: 1, tickDmg: 1, max: 14 }],
      ['pulseCd', 6, 12, 'howl', { r: 6, dmg: 3, stun: 0.6, pal: H, max: 14 }],
      ['crossCd', 7, 13, 'cross', { kind: 'acid', dmg: 6, diag: true, pal: BILE, ph: 2, max: 14 }],
      ['floodCd', 9, 15, 'rain', { n: 20, kind: 'acid', dmg: 4, pal: BILE, ph: 3, max: 14 }],
    ]) || true; // (It doesn't move: it's the gut's heart.)
  },
  // The Gut Wyrm: it burrows through the flesh of the gut and comes up
  // under you, spits bile, coils, and swallows what's close.
  gutWyrm(c, dt) {
    return fight(c, dt, [
      ['burrowCd', 2, 8, 'erupt', { extra: 2, r: 1, dmg: 7, pal: BILE, sound: 'crumble' }],
      ['spitCd', 3, 7, 'volley', { n: 3, r: 1, dmg: 4, pal: BILE, zone: 'bile', life: 6, slow: true }],
      ['coilCd', 1, 5, 'slam', { r: 2, dmg: 7, knock: 2, pal: BILE, max: 3 }],
      ['gulpCd', 5, 10, 'pull', { n: 3, dmg: 6, grab: 1, pal: BILE, text: 'swallowed!' }],
      ['lashCd', 7, 13, 'charge', { dmg: 8, knock: 3, pal: BILE, min: 3, ph: 2 }],
      ['digestCd', 9, 15, 'spiral', { n: 22, kind: 'acid', dmg: 5, pal: BILE, ph: 3 }],
    ]);
  },
  // ------------------------------------------------ Saltmere
  // The Salt Mummy: a parching touch, salt that sets round your feet,
  // brine flung, its dead risen white.
  saltMummy(c, dt) {
    return fight(c, dt, [
      ['parchCd', 1, 6, 'slam', { r: 1, dmg: 6, drain: 3, pal: SALT, max: 2 }],
      ['setCd', 3, 9, 'zone', { floor: 'salt_crust', zk: 'snare', r: 1, root: 1.2, life: 9, pal: SALT, say: 'Be still. Be salt.' }],
      ['brineCd', 2, 7, 'volley', { n: 3, r: 1, dmg: 5, pal: SALT }],
      ['wrapsCd', 5, 10, 'pull', { n: 3, dmg: 4, grab: 0.8, pal: SALT, text: 'wrapped!' }],
      ['deadCd', 6, 15, 'summon', { sp: 'salt_wight', n: 2, cap: 4, pal: SALT }],
      ['stormCd', 9, 16, 'blind', { secs: 3, pal: SALT, ph: 2, say: 'Salt in your eyes.' }],
    ]);
  },
  // The Brine Crab King: claws, the snap that holds you, a bubble of
  // brine, his scorpions, his shell shut.
  brineCrabKing(c, dt) {
    const C = { c: [232, 96, 64], p: ['#e86040', '#ffffff', '#a02a1a'] };
    return fight(c, dt, [
      ['clawCd', 1, 5, 'slam', { r: 2, dmg: 7, knock: 2, pal: C, max: 3 }],
      ['snapCd', 3, 8, 'pull', { n: 2, dmg: 6, grab: 1, pal: C, text: 'snapped up!' }],
      ['brineCd', 4, 9, 'breath', { kind: 'cold', len: 5, dmg: 5, chill: 1, pal: SALT }],
      ['shellCd', 6, 15, 'ward', { secs: 4, k: 0.15, text: 'shell shut', pal: C }],
      ['scuttleCd', 5, 10, 'charge', { dmg: 7, knock: 2, pal: C, min: 3, ph: 2 }],
      ['crownCd', 9, 16, 'cross', { kind: 'cold', dmg: 7, diag: true, pal: SALT, ph: 3 }],
    ]);
  },
  // The Crystal Matriarch: crystals grown up out of the floor, shards,
  // the salt's song that holds you, refracted beams.
  crystalMatriarch(c, dt) {
    const Q = { c: [230, 220, 255], p: ['#ffffff', '#e0d0ff', '#a080e0'] };
    return fight(c, dt, [
      ['growCd', 2, 7, 'erupt', { extra: 4, r: 0, dmg: 6, pal: Q, sound: 'glass' }],
      ['shardCd', 3, 8, 'volley', { n: 4, r: 0, dmg: 5, pal: Q }],
      ['songCd', 5, 11, 'howl', { r: 5, dmg: 2, stun: 1, pal: Q, sound: 'salt_song' }],
      ['prismCd', 4, 9, 'beam', { n: 3, fan: 0.6, dmg: 5, pal: Q, beam: '#ffffff', halo: '#c0a0ff' }],
      ['latticeCd', 7, 14, 'cross', { kind: 'burst', dmg: 6, diag: true, onYou: true, pal: Q, ph: 2 }],
      ['facetCd', 9, 15, 'spin', { n: 12, dmg: 5, pal: Q, ph: 3 }],
    ]);
  },
  // The Salt Wyrm: up out of the pans under you, a breath of salt,
  // coils, the roof of the pit brought down.
  saltWyrm(c, dt) {
    return fight(c, dt, [
      ['riseCd', 2, 8, 'erupt', { extra: 3, r: 1, dmg: 7, pal: SALT, sound: 'crumble' }],
      ['breathCd', 3, 7, 'breath', { kind: 'cold', len: 6, dmg: 5, drain: 2, pal: SALT }],
      ['coilCd', 1, 5, 'slam', { r: 2, dmg: 7, pal: SALT, max: 3 }],
      ['crustCd', 5, 11, 'zone', { floor: 'salt_crust', zk: 'snare', r: 2, root: 1, life: 9, pal: SALT }],
      ['pitCd', 7, 13, 'rain', { n: 18, kind: 'rocks', dmg: 5, pal: SALT, ph: 2 }],
      ['whirlCd', 9, 15, 'spiral', { n: 22, dmg: 5, pal: SALT, ph: 3 }],
    ]);
  },
  // The Salt Bride: tears that fall as salt, her veil drawn over your
  // eyes, her lament, and she draws you to her.
  saltBride(c, dt) {
    const V = { c: [200, 220, 255], p: ['#ffffff', '#a0c8ff', '#e0e8ff'] };
    return fight(c, dt, [
      ['tearsCd', 2, 7, 'rain', { n: 14, kind: 'hex', dmg: 4, pal: V }],
      ['veilCd', 4, 10, 'blind', { secs: 2.5, pal: V, say: 'Wear my veil.' }],
      ['lamentCd', 5, 11, 'howl', { r: 5, dmg: 3, stun: 0.9, pal: V, say: 'He never came back!' }],
      ['embraceCd', 3, 8, 'pull', { n: 3, dmg: 4, grab: 1, pal: V, text: 'embraced!' }],
      ['vowsCd', 7, 14, 'mark', { r: 1, dmg: 10, pal: V, ph: 2, text: 'till death...' }],
      ['weddingCd', 9, 16, 'spin', { n: 10, dmg: 5, pal: V, ph: 3 }],
    ]);
  },
  // The Flamingo Seraph: radiant beams, a storm of rose feathers, its
  // wings that throw you, its blessing that mends it.
  flamingoSeraph(c, dt) {
    return fight(c, dt, [
      ['radianceCd', 2, 6, 'beam', { n: 3, fan: 0.4, dmg: 5, pal: PINK, beam: '#fff0f8', halo: '#ff80b0' }],
      ['featherCd', 3, 8, 'rain', { n: 16, kind: 'dart', dmg: 4, pal: PINK }],
      ['wingCd', 4, 9, 'gust', { len: 6, knock: 4, pal: PINK }],
      ['blessCd', 7, 15, 'heal', { below: 0.7, k: 0.06, pal: PINK }],
      ['haloCd', 6, 12, 'quake', { n: 4, kind: 'burst', dmg: 5, round: true, pal: PINK, ph: 2 }],
      ['gloryCd', 9, 15, 'cross', { kind: 'burst', dmg: 7, diag: true, pal: PINK, ph: 3 }],
    ]);
  },
  // The Salt Doge: his guards hired, a tax taken from your purse, his
  // gondoliers' crossbows, a salt-tax decree.
  saltDoge(c, dt) {
    return fight(c, dt, [
      ['taxCd', 2, 7, 'rob', { dmg: 3, pal: GOLD, say: 'Your tax, if you please.' }],
      ['guardsCd', 4, 14, 'summon', { sp: ['cutthroat', 'holdout_archer'], n: 2, cap: 4, pal: GOLD, say: 'Guards!' }],
      ['boltsCd', 3, 7, 'beam', { n: 2, fan: 0.3, kind: 'dart', dmg: 5, pal: GOLD, min: 2 }],
      ['decreeCd', 5, 10, 'mark', { r: 1, dmg: 9, pal: GOLD, text: 'taxed!' }],
      ['sabreCd', 1, 5, 'slam', { r: 1, dmg: 6, pal: GOLD, max: 2 }],
      ['treasuryCd', 8, 15, 'volley', { n: 6, r: 1, dmg: 4, pal: GOLD, tint: [255, 220, 90], ph: 2, say: 'Choke on it!' }],
    ]);
  },
  // The Lagoon Hydra: three heads biting in turn, a spray of brine, the
  // lagoon let in, and lost heads growing back (it mends).
  lagoonHydra(c, dt) {
    return fight(c, dt, [
      ['headsCd', 1, 4, 'beam', { n: 3, fan: 0.5, len: 4, dmg: 6, pal: SEA }],
      ['sprayCd', 3, 8, 'breath', { kind: 'cold', len: 6, dmg: 5, pal: SEA }],
      ['lagoonCd', 5, 11, 'flood', { r: 2, life: 9, pal: SEA }],
      ['regrowCd', 7, 15, 'heal', { below: 0.8, k: 0.06, pal: PINK, say: '' }],
      ['thrashCd', 6, 12, 'spin', { n: 9, len: 6, dmg: 5, pal: SEA, ph: 2 }],
      ['triadCd', 9, 15, 'cross', { kind: 'cold', dmg: 7, pal: SEA, onYou: true, ph: 3 }],
    ]);
  },
  // The Salt Mother: the brine rising through her cathedral, salt that
  // sets round you, her children risen, her song, and the whole floor
  // turned to salt.
  saltMother(c, dt) {
    return fight(c, dt, [
      ['brineCd', 3, 9, 'flood', { r: 3, life: 8, pal: SALT, say: 'The brine rises.' }],
      ['setCd', 2, 7, 'zone', { floor: 'salt_crust', zk: 'snare', r: 1, root: 1.3, life: 9, pal: SALT }],
      ['songCd', 5, 11, 'howl', { r: 5, dmg: 3, stun: 1, pal: SALT, sound: 'salt_song' }],
      ['childrenCd', 6, 15, 'summon', { sp: 'salt_wight', n: 2, cap: 4, pal: SALT }],
      ['pillarCd', 4, 9, 'cross', { kind: 'erupt', dmg: 7, pal: SALT, onYou: true }],
      ['cathedralCd', 8, 15, 'wall', { march: true, dmg: 6, kind: 'cold', pal: SALT, ph: 2, say: 'Kneel.' }],
      ['tearsCd', 10, 16, 'rain', { n: 22, kind: 'hex', dmg: 4, pal: SALT, ph: 3 }],
    ]);
  },
  // The Mirage Lion: it's everywhere (only one of it real), heat-haze
  // that blinds, its pounce, its roar.
  mirageLion(c, dt) {
    const M = { c: [255, 210, 120], p: ['#ffd070', '#fff8e0', '#c89030'] };
    return fight(c, dt, [
      ['mirageCd', 2, 7, 'mirage', { n: 5, dmg: 9, pal: M }],
      ['pounceCd', 3, 7, 'pounce', { dmg: 7, pal: M, min: 2 }],
      ['hazeCd', 5, 11, 'blind', { secs: 2.5, pal: M }],
      ['roarCd', 6, 12, 'howl', { r: 5, stun: 0.9, pal: M, sound: 'roar' }],
      ['shimmerCd', 4, 9, 'blink', { pal: M }],
      ['sunCd', 9, 15, 'spin', { n: 10, dmg: 6, pal: M, ph: 2 }],
    ]);
  },
  // ------------------------------------------------ Hollowmark
  // The Mole King: up under you, his claws, the roof of the barrow
  // brought down on you, his tunnelers.
  moleKing(c, dt) {
    return fight(c, dt, [
      ['digCd', 2, 7, 'erupt', { extra: 2, r: 1, dmg: 7, pal: EARTH, sound: 'crumble' }],
      ['clawCd', 1, 5, 'slam', { r: 2, dmg: 7, pal: EARTH, max: 3 }],
      ['roofCd', 4, 10, 'rain', { n: 16, kind: 'rocks', dmg: 5, pal: EARTH }],
      ['diggersCd', 6, 15, 'summon', { sp: 'tunneler', n: 2, cap: 3, pal: EARTH }],
      ['dirtCd', 5, 10, 'blind', { secs: 2.5, pal: EARTH, ph: 2 }],
      ['quakeCd', 8, 14, 'quake', { n: 5, dmg: 5, pal: EARTH, ph: 3 }],
    ]);
  },
  // The Root Witch: roots that hold, briars about, her lanterns lobbed,
  // she draws life up out of the ground.
  rootWitch(c, dt) {
    const R = { c: [140, 190, 80], p: ['#a0c060', '#e0f0a0', '#4a6a2a'] };
    return fight(c, dt, [
      ['rootsCd', 2, 7, 'zone', { zk: 'snare', r: 1, root: 1.3, life: 8, dmg: 3, kind: 'erupt', pal: R, say: 'Hold them, my roots.' }],
      ['lanternCd', 3, 7, 'volley', { n: 3, r: 1, dmg: 4, burn: 1.5, pal: LAMP }],
      ['lashCd', 1, 5, 'beam', { len: 4, dmg: 6, pal: R, max: 4 }],
      ['drinkCd', 6, 14, 'heal', { below: 0.7, k: 0.06, pal: R, say: 'The earth feeds me.' }],
      ['thicketCd', 7, 13, 'quake', { n: 4, dmg: 5, pal: R, round: true, ph: 2 }],
      ['wildCd', 9, 15, 'spiral', { n: 22, kind: 'erupt', dmg: 5, pal: R, ph: 3 }],
    ]);
  },
  // The Glowworm Queen: her threads hung from the roof (glowing, sticky),
  // lights that lure, her bite, her brood.
  glowwormQueen(c, dt) {
    const G = { c: [120, 230, 255], p: ['#80e8ff', '#e0ffff', '#3080c0'] };
    return fight(c, dt, [
      ['threadCd', 2, 7, 'zone', { zk: 'web', r: 1, root: 1.2, life: 9, pal: G, say: '' }],
      ['lureCd', 3, 8, 'pull', { n: 3, dmg: 3, pal: G, text: 'lured in by the light!' }],
      ['biteCd', 1, 5, 'slam', { r: 1, dmg: 7, pal: G, max: 2 }],
      ['glowCd', 4, 9, 'beam', { n: 2, fan: 0.5, dmg: 5, pal: G }],
      ['dripCd', 6, 12, 'rain', { n: 16, kind: 'hex', dmg: 4, pal: G, ph: 2 }],
      ['starsCd', 9, 15, 'spiral', { n: 22, dmg: 5, pal: G, ph: 3 }],
    ]);
  },
  // The Deep Golem: fists, its seams glowing hot, stones thrown, the
  // ground cracked across.
  deepGolem(c, dt) {
    return fight(c, dt, [
      ['fistCd', 1, 5, 'slam', { r: 2, dmg: 8, knock: 3, pal: EARTH, max: 3 }],
      ['stoneCd', 3, 8, 'volley', { n: 3, r: 1, dmg: 6, pal: EARTH }],
      ['crackCd', 4, 9, 'cross', { kind: 'erupt', dmg: 7, pal: EARTH, onYou: true, sound: 'crumble' }],
      ['seamCd', 6, 15, 'ward', { secs: 5, k: 0.2, text: 'stone-hard', pal: FIRE }],
      ['heatCd', 7, 13, 'quake', { n: 5, kind: 'fire', burn: 1.5, dmg: 5, pal: FIRE, ph: 2 }],
      ['caveCd', 9, 15, 'rain', { n: 20, kind: 'rocks', dmg: 5, pal: EARTH, ph: 3 }],
    ]);
  },
  // The Moth Queen: golden dust that blinds, her swarm, wings that throw
  // you, her lantern-light beams.
  mothQueen(c, dt) {
    return fight(c, dt, [
      ['dustCd', 2, 7, 'blind', { secs: 2.5, pal: LAMP, say: '' }],
      ['swarmCd', 5, 14, 'summon', { sp: 'cave_moth', n: 3, cap: 5, pal: LAMP }],
      ['wingCd', 3, 8, 'gust', { len: 5, knock: 3, pal: LAMP }],
      ['glowCd', 4, 9, 'beam', { n: 3, fan: 0.45, dmg: 5, pal: LAMP }],
      ['spiralCd', 7, 13, 'spiral', { n: 20, dmg: 5, pal: LAMP, ph: 2 }],
      ['sunCd', 9, 15, 'quake', { n: 4, kind: 'burst', dmg: 5, round: true, pal: LAMP, ph: 3 }],
    ]);
  },
  // The Lamplighter: he puts the lights out (you can't see), his pole,
  // lamps thrown burning, and he keeps what he puts out.
  lamplighter(c, dt) {
    return fight(c, dt, [
      ['snuffCd', 3, 10, 'blind', { secs: 3, pal: INK, say: 'Lights out.' }],
      ['poleCd', 1, 5, 'beam', { len: 4, dmg: 6, pal: LAMP, max: 4 }],
      ['lampCd', 2, 7, 'volley', { n: 3, r: 1, dmg: 4, burn: 2, pal: FIRE, zone: 'fire', life: 5, tick: 0.6, tickDmg: 1, zburn: 1 }],
      ['wickCd', 5, 11, 'mark', { r: 1, dmg: 9, burn: 2, pal: LAMP, text: 'the wick is lit...' }],
      ['darkCd', 7, 13, 'zone', { zk: 'dark', r: 2, life: 8, tick: 1, tickDmg: 1, pal: INK, ph: 2 }],
      ['lamplightCd', 9, 15, 'spin', { n: 8, dmg: 6, pal: LAMP, ph: 3 }],
    ]);
  },
  // The Burrow Baron: his mace, a pocket picked, his lads called, a
  // barrel rolled down the burrow at you.
  burrowBaron(c, dt) {
    return fight(c, dt, [
      ['maceCd', 1, 5, 'slam', { r: 1, dmg: 7, stun: 0.5, pal: EARTH, max: 2 }],
      ['pocketCd', 3, 8, 'rob', { dmg: 3, pal: GOLD }],
      ['ladsCd', 5, 14, 'summon', { sp: ['cutthroat', 'thief'], n: 2, cap: 4, pal: EARTH, say: 'Lads!' }],
      ['barrelCd', 4, 9, 'charge', { dmg: 6, knock: 3, len: 12, pal: EARTH, min: 3, say: 'Roll out the barrel!' }],
      ['pieCd', 6, 12, 'volley', { n: 4, r: 1, dmg: 4, pal: EARTH, ph: 2 }],
      ['feastCd', 9, 16, 'heal', { below: 0.6, k: 0.06, pal: GOLD, ph: 3, say: 'Second breakfast!' }],
    ]);
  },
  // The Cave Bear: swipes, its roar, a charge, and it rears and comes
  // down.
  caveBear(c, dt) {
    return fight(c, dt, [
      ['swipeCd', 1, 4, 'slam', { r: 1, dmg: 8, knock: 2, pal: EARTH, max: 2 }],
      ['roarCd', 4, 11, 'howl', { r: 5, stun: 1, pal: EARTH, sound: 'roar' }],
      ['chargeCd', 3, 8, 'charge', { dmg: 8, knock: 3, pal: EARTH, min: 3 }],
      ['rearCd', 5, 10, 'quake', { n: 3, dmg: 6, pal: EARTH }],
      ['mauleCd', 7, 12, 'pounce', { dmg: 8, pal: EARTH, min: 2, ph: 2 }],
      ['rageCd', 9, 15, 'ward', { secs: 4, k: 0.4, text: 'enraged', pal: RED, ph: 3 }],
    ]);
  },
  // The First Digger: it digs through its hall, up under you anywhere,
  // the tunnels collapsing, its claws, its young.
  firstDigger(c, dt) {
    return fight(c, dt, [
      ['digCd', 2, 6, 'erupt', { extra: 3, r: 1, dmg: 7, pal: EARTH, sound: 'crumble' }],
      ['clawCd', 1, 5, 'slam', { r: 2, dmg: 8, knock: 2, pal: EARTH, max: 3 }],
      ['tunnelCd', 4, 9, 'cross', { kind: 'erupt', dmg: 7, pal: EARTH, onYou: true }],
      ['youngCd', 6, 15, 'summon', { sp: 'tunneler', n: 2, cap: 4, pal: EARTH }],
      ['collapseCd', 7, 13, 'rain', { n: 20, kind: 'rocks', dmg: 5, pal: EARTH, ph: 2 }],
      ['warrenCd', 9, 15, 'wall', { march: true, dmg: 6, kind: 'erupt', pal: EARTH, ph: 3 }],
    ]);
  },
  // The Thing Below: its arms up through the floor, its eyes' beams,
  // the dark it breathes, what it calls up from further down.
  thingBelow(c, dt) {
    return fight(c, dt, [
      ['armsCd', 1, 5, 'erupt', { extra: 4, r: 0, dmg: 6, pal: INK, max: 14 }],
      ['eyesCd', 3, 7, 'beam', { n: 3, fan: 0.5, dmg: 5, pal: LAMP, max: 14 }],
      ['darkCd', 4, 10, 'blind', { secs: 3, pal: INK, len: 14, max: 14 }],
      ['gripCd', 5, 10, 'pull', { n: 3, dmg: 5, grab: 1, pal: INK, len: 12, max: 14, text: 'dragged toward it!' }],
      ['deepCd', 7, 13, 'quake', { n: 6, dmg: 5, round: true, pal: INK, ph: 2, max: 14 }],
      ['gazeCd', 9, 15, 'spin', { n: 10, dmg: 6, pal: LAMP, ph: 3, max: 14 }],
    ]) || true; // (Rooted: what's under the floor is far bigger.)
  },
  // ------------------------------------------------ the Wyrd Isle
  // The Raven Queen: her ravens, their eyes-pecking (you blinded), her
  // feathers like knives, a curse that marks you.
  ravenQueen(c, dt) {
    return fight(c, dt, [
      ['ravensCd', 4, 13, 'summon', { sp: 'grave_raven', n: 3, cap: 5, pal: INK, say: 'My ravens!' }],
      ['eyesCd', 3, 9, 'blind', { secs: 2.5, pal: INK }],
      ['quillCd', 2, 6, 'beam', { n: 3, fan: 0.35, kind: 'dart', dmg: 5, pal: INK }],
      ['curseCd', 5, 10, 'mark', { r: 1, dmg: 9, pal: INK, text: 'cursed...' }],
      ['murderCd', 7, 13, 'rain', { n: 16, kind: 'dart', dmg: 4, pal: INK, ph: 2 }],
      ['nightCd', 9, 15, 'spiral', { n: 20, dmg: 5, pal: INK, ph: 3 }],
    ]);
  },
  // The Antlered One: the hunt's horn, his spear, his hounds, his charge.
  antleredOne(c, dt) {
    const H = { c: [128, 192, 96], p: ['#80c060', '#e0d8c0', '#4a7a3a'] };
    return fight(c, dt, [
      ['spearCd', 1, 5, 'beam', { len: 4, dmg: 7, pal: H, max: 4 }],
      ['hornCd', 4, 11, 'howl', { r: 5, stun: 0.8, pal: H, say: 'The hunt is up!' }],
      ['houndsCd', 5, 14, 'summon', { sp: 'frost_wolf', n: 2, cap: 3, pal: H }],
      ['chargeCd', 3, 8, 'charge', { dmg: 8, knock: 3, pal: H, min: 3 }],
      ['javelinCd', 6, 11, 'volley', { n: 3, r: 0, dmg: 5, pal: H, ph: 2 }],
      ['wildCd', 9, 15, 'wall', { march: true, dmg: 6, pal: H, ph: 3, say: 'RUN!' }],
    ]);
  },
  // The Rune Golem: its runes flaring in turn (a circle on the floor that
  // goes off), fists, stones of it thrown, its runes set as a ward.
  runeGolem(c, dt) {
    return fight(c, dt, [
      ['runeCd', 2, 7, 'zone', { zk: 'rune', r: 1, life: 5, tick: 0.5, tickDmg: 1, pal: RUNE, dmg: 5, kind: 'hex' }],
      ['fistCd', 1, 5, 'slam', { r: 2, dmg: 8, knock: 3, pal: RUNE, max: 3 }],
      ['stoneCd', 3, 8, 'volley', { n: 3, r: 1, dmg: 6, pal: RUNE }],
      ['wardCd', 6, 15, 'ward', { secs: 5, k: 0.15, text: 'rune-warded', pal: RUNE }],
      ['circleCd', 7, 13, 'quake', { n: 5, kind: 'hex', dmg: 5, round: true, pal: RUNE, ph: 2 }],
      ['scriptCd', 9, 15, 'cross', { kind: 'hex', dmg: 7, diag: true, pal: RUNE, ph: 3 }],
    ]);
  },
  // The Ninth Wyrm: venom, its coils, the barrow's gold flung, a spiral
  // of its breath.
  ninthWyrm(c, dt) {
    const W = { c: [106, 90, 160], p: ['#6a5aa0', '#a0ffd0', '#3a2a6a'] };
    return fight(c, dt, [
      ['breathCd', 2, 7, 'breath', { kind: 'acid', len: 6, dmg: 6, pal: BILE }],
      ['coilCd', 1, 5, 'slam', { r: 2, dmg: 7, knock: 2, pal: W, max: 3 }],
      ['hoardCd', 4, 9, 'volley', { n: 5, r: 1, dmg: 4, pal: GOLD, tint: [255, 210, 80] }],
      ['burrowCd', 5, 10, 'erupt', { extra: 3, r: 1, dmg: 7, pal: W }],
      ['lashCd', 7, 12, 'charge', { dmg: 8, knock: 3, pal: W, min: 3, ph: 2 }],
      ['ninefoldCd', 9, 15, 'spiral', { n: 24, kind: 'acid', dmg: 5, pal: BILE, ph: 3 }],
    ]);
  },
  // The Rune Witch: runes cast where you'll be (only one true), a curse,
  // stones that fly, a rune that throws you.
  runeWitch(c, dt) {
    return fight(c, dt, [
      ['castCd', 2, 7, 'mirage', { n: 4, dmg: 9, pal: RUNE }],
      ['curseCd', 3, 8, 'beam', { n: 2, fan: 0.4, dmg: 5, kind: 'hex', pal: RUNE }],
      ['stonesCd', 4, 9, 'volley', { n: 4, r: 0, dmg: 5, pal: RUNE }],
      ['throwCd', 5, 10, 'gust', { len: 5, knock: 4, pal: RUNE }],
      ['fateCd', 7, 13, 'mark', { r: 2, dmg: 10, pal: RUNE, text: 'your fate is read...', ph: 2 }],
      ['runesCd', 9, 15, 'spiral', { n: 22, dmg: 5, pal: RUNE, ph: 3 }],
    ]);
  },
  // The Banshee: her keening (it holds you), the grave's cold, her
  // grasp, and she drifts through you.
  banshee(c, dt) {
    const K = { c: [200, 224, 240], p: ['#c8e0f0', '#ffffff', '#8aa0b8'] };
    return fight(c, dt, [
      ['keenCd', 3, 9, 'howl', { r: 6, dmg: 3, stun: 1.2, pal: K, say: 'Aaaaaiiiieeee!', sound: 'scream' }],
      ['chillCd', 2, 7, 'breath', { kind: 'cold', len: 6, dmg: 5, chill: 2, pal: K }],
      ['graspCd', 4, 8, 'pull', { n: 3, dmg: 4, grab: 1, pal: K, text: 'clutched!' }],
      ['driftCd', 5, 10, 'blink', { pal: K }],
      ['graveCd', 7, 13, 'zone', { zk: 'chill', r: 2, life: 8, tick: 1, zchill: 1.5, tickDmg: 1, pal: K, ph: 2 }],
      ['doomCd', 9, 15, 'spin', { n: 10, kind: 'cold', dmg: 5, pal: K, ph: 3 }],
    ]);
  },
  // The Fey Reaver: here and behind you, glamour, his knights, a blade
  // of light thrown.
  feyReaver(c, dt) {
    return fight(c, dt, [
      ['stepCd', 2, 6, 'blink', { pal: FEY, sound: 'chime' }],
      ['bladeCd', 3, 7, 'beam', { n: 2, fan: 0.3, dmg: 6, pal: FEY }],
      ['glamourCd', 5, 10, 'mirage', { n: 4, dmg: 8, pal: FEY }],
      ['knightsCd', 6, 15, 'summon', { sp: 'fey_knight', n: 2, cap: 3, pal: FEY }],
      ['swapCd', 7, 12, 'swap', { pal: FEY, then: true, ph: 2 }],
      ['reapCd', 9, 15, 'spin', { n: 10, dmg: 6, pal: FEY, ph: 3 }],
    ]);
  },
  // The White Hart: never where you strike, its antlers, its light that
  // blinds, its leap.
  whiteHart(c, dt) {
    const W = { c: [240, 255, 250], p: ['#ffffff', '#a0ffd0', '#e0fff8'] };
    return fight(c, dt, [
      ['leapCd', 2, 6, 'pounce', { dmg: 7, pal: W, min: 2 }],
      ['antlerCd', 1, 5, 'slam', { r: 1, dmg: 7, knock: 3, pal: W, max: 2 }],
      ['lightCd', 4, 10, 'blind', { secs: 2, pal: W }],
      ['gallopCd', 3, 8, 'charge', { dmg: 7, knock: 3, len: 14, pal: W, min: 3 }],
      ['elusiveCd', 6, 12, 'blink', { pal: W, ph: 2 }],
      ['hornCd', 9, 15, 'cross', { kind: 'burst', dmg: 7, diag: true, pal: W, ph: 3 }],
    ]);
  },
  // The Fair King: his court's dance (his marks all about), places
  // traded, a hundred years in a moment (held fast), his knights.
  fairKing(c, dt) {
    return fight(c, dt, [
      ['danceCd', 2, 7, 'mirage', { n: 5, dmg: 9, pal: FEY, say: 'Dance!' }],
      ['tradeCd', 4, 10, 'swap', { pal: FEY, then: true, say: 'Mine now.' }],
      ['centuryCd', 5, 12, 'zone', { zk: 'snare', r: 2, root: 1.5, life: 6, pal: FEY, say: 'A hundred years...' }],
      ['courtCd', 6, 15, 'summon', { sp: ['fey_knight', 'wisp'], n: 2, cap: 4, pal: FEY }],
      ['crownCd', 3, 7, 'beam', { n: 3, fan: 0.4, dmg: 5, pal: FEY }],
      ['revelCd', 8, 14, 'spin', { n: 12, dmg: 6, pal: FEY, ph: 2 }],
      ['hillCd', 10, 16, 'spiral', { n: 24, dmg: 6, pal: FEY, ph: 3 }],
    ]);
  },
  // The Hill Sleeper: it gets up (the floor heaves), its fists, the
  // hill's turf thrown, it sleeps (hard as the hill), stones about it.
  hillSleeper(c, dt) {
    const H = { c: [128, 176, 80], p: ['#80b050', '#c8e0a0', '#4a6a2a'] };
    return fight(c, dt, [
      ['fistCd', 1, 5, 'slam', { r: 2, dmg: 8, knock: 3, pal: H, max: 3 }],
      ['heaveCd', 3, 9, 'quake', { n: 5, dmg: 5, pal: H }],
      ['turfCd', 4, 9, 'volley', { n: 3, r: 1, dmg: 6, pal: H }],
      ['sleepCd', 7, 16, 'ward', { secs: 5, k: 0.15, text: 'deep asleep', pal: H }],
      ['stonesCd', 6, 12, 'erupt', { extra: 4, r: 0, dmg: 6, pal: MARBLE, ph: 2 }],
      ['wakeCd', 9, 15, 'rain', { n: 20, kind: 'rocks', dmg: 5, pal: H, ph: 3 }],
    ]);
  },
  // ------------------------------------------------ the Grey Skerries
  // The Trow King: his hammer, stones flung, his trows, and he hides from
  // the light (warded) when the lamps flare.
  trowKing(c, dt) {
    const T = { c: [128, 160, 128], p: ['#80a080', '#e0d0a0', '#4a6a4a'] };
    return fight(c, dt, [
      ['hammerCd', 1, 5, 'slam', { r: 2, dmg: 8, knock: 3, pal: T, max: 3 }],
      ['flingCd', 3, 8, 'volley', { n: 3, r: 1, dmg: 6, pal: EARTH }],
      ['trowsCd', 6, 15, 'summon', { sp: ['drowned', 'skeleton'], n: 2, cap: 4, pal: T }],
      ['hideCd', 7, 14, 'ward', { secs: 4, k: 0.25, text: 'hiding from the light', pal: T }],
      ['stampCd', 5, 10, 'quake', { n: 4, dmg: 5, pal: T, ph: 2 }],
      ['cairnCd', 9, 15, 'rain', { n: 18, kind: 'rocks', dmg: 5, pal: EARTH, ph: 3 }],
    ]);
  },
  // The Finnman: he rows you down (a pull), the tide let in, his curse
  // of cold, his drowned.
  finnman(c, dt) {
    return fight(c, dt, [
      ['rowCd', 2, 7, 'pull', { n: 3, dmg: 4, grab: 0.8, pal: SEA, text: 'pulled under!' }],
      ['tideCd', 3, 9, 'flood', { r: 2, life: 8, pal: SEA }],
      ['coldCd', 4, 8, 'beam', { n: 2, fan: 0.4, dmg: 5, chill: 2, kind: 'cold', pal: SEA }],
      ['drownedCd', 6, 15, 'summon', { sp: 'drowned', n: 2, cap: 4, pal: SEA }],
      ['whirlCd', 7, 13, 'zone', { zk: 'whirl', r: 2, life: 6, tick: 0.8, tickDmg: 1, pal: SEA, ph: 2 }],
      ['deepCd', 9, 15, 'spiral', { n: 22, kind: 'cold', dmg: 5, pal: SEA, ph: 3 }],
    ]);
  },
  // The Storm Giant: lightning, his gale, his fists, the hall's roof
  // brought down.
  stormGiant(c, dt) {
    return fight(c, dt, [
      ['boltCd', 2, 7, 'lightning', { n: 5, dmg: 6, sound: 'thunder' }],
      ['galeCd', 3, 8, 'gust', { len: 7, knock: 5, pal: GALE }],
      ['fistCd', 1, 5, 'slam', { r: 2, dmg: 9, knock: 3, pal: STORM, max: 3 }],
      ['roofCd', 5, 11, 'rain', { n: 18, kind: 'rocks', dmg: 5, pal: EARTH }],
      ['stormCd', 8, 14, 'lightning', { n: 10, every: 0.22, dmg: 5, ph: 2 }],
      ['thunderCd', 9, 15, 'howl', { r: 6, stun: 1, dmg: 4, pal: STORM, ph: 3, sound: 'thunder' }],
    ]);
  },
  // The Stack Crab: claws, rocks off its back, its shell shut, a
  // scuttle.
  stackCrab(c, dt) {
    const C = { c: [160, 160, 144], p: ['#a0a090', '#e08060', '#6a6a5a'] };
    return fight(c, dt, [
      ['clawCd', 1, 5, 'slam', { r: 2, dmg: 8, knock: 2, pal: C, max: 3 }],
      ['rocksCd', 3, 8, 'volley', { n: 4, r: 1, dmg: 5, pal: C }],
      ['shellCd', 6, 15, 'ward', { secs: 5, k: 0.15, text: 'shell shut', pal: C }],
      ['scuttleCd', 4, 9, 'charge', { dmg: 7, knock: 2, pal: C, min: 3 }],
      ['surfCd', 6, 12, 'flood', { r: 2, life: 7, pal: SEA, ph: 2 }],
      ['stackCd', 9, 15, 'rain', { n: 20, kind: 'rocks', dmg: 5, pal: C, ph: 3 }],
    ]);
  },
  // The Selkie Widow: her song, the sea let in, her grief that holds
  // you, her sealskin's lash.
  selkieWidow(c, dt) {
    const S = { c: [160, 176, 192], p: ['#a0b0c0', '#e0f8ff', '#5a6a7a'] };
    return fight(c, dt, [
      ['songCd', 3, 9, 'howl', { r: 5, dmg: 2, stun: 1.1, pal: S, say: 'Sing with me...' }],
      ['seaCd', 2, 8, 'flood', { r: 2, life: 8, pal: SEA }],
      ['griefCd', 4, 10, 'zone', { zk: 'snare', r: 1, root: 1.3, life: 7, pal: S }],
      ['lashCd', 1, 5, 'beam', { len: 4, dmg: 6, pal: S, max: 4 }],
      ['skinCd', 6, 11, 'blink', { pal: SEA, ph: 2 }],
      ['wavesCd', 9, 15, 'wall', { march: true, dmg: 6, kind: 'cold', knock: 2, pal: SEA, ph: 3 }],
    ]);
  },
  // The Drowned Bell: it tolls (rings of sound rippling out, holding you),
  // swings, sinks and comes up under you, the sea pouring off it.
  drownedBell(c, dt) {
    const T = { c: [216, 168, 64], p: ['#d8a840', '#fff0b0', '#80c8e8'] };
    return fight(c, dt, [
      ['tollCd', 2, 6, 'quake', { n: 5, kind: 'burst', dmg: 4, stun: 0.4, round: true, pal: T, sound: 'sea_bell' }],
      ['swingCd', 1, 5, 'slam', { r: 2, dmg: 8, knock: 3, pal: T, max: 3 }],
      ['sinkCd', 4, 9, 'pounce', { dmg: 8, pal: T, min: 2, sound: 'sea_bell' }],
      ['pourCd', 5, 11, 'flood', { r: 2, life: 8, pal: SEA }],
      ['peelCd', 7, 13, 'howl', { r: 6, dmg: 3, stun: 1.2, pal: T, ph: 2, sound: 'sea_bell' }],
      ['knellCd', 9, 15, 'spin', { n: 8, kind: 'burst', dmg: 6, pal: T, ph: 3 }],
    ]);
  },
  // The Wrecker: his false light (it lures you), lamp-oil set alight,
  // his cutlass, his crew, your purse.
  theWrecker(c, dt) {
    return fight(c, dt, [
      ['lureCd', 2, 7, 'pull', { n: 3, dmg: 3, pal: LAMP, text: 'lured toward the light!' }],
      ['oilCd', 3, 8, 'volley', { n: 3, r: 1, dmg: 4, burn: 2, pal: FIRE, zone: 'fire', life: 5, tick: 0.6, tickDmg: 1, zburn: 1 }],
      ['cutlassCd', 1, 5, 'slam', { r: 1, dmg: 7, pal: FIRE, max: 2 }],
      ['crewCd', 6, 15, 'summon', { sp: 'wrecker', n: 2, cap: 4, pal: FIRE, say: 'All hands!' }],
      ['purseCd', 4, 9, 'rob', { dmg: 3, pal: GOLD }],
      ['rocksCd', 8, 14, 'wall', { march: true, dmg: 6, kind: 'rocks', pal: EARTH, ph: 2, say: 'Onto the rocks with you!' }],
    ]);
  },
  // The Storm Petrel: it skims (here, there), gale-wings, spray, its
  // stoop.
  stormPetrel(c, dt) {
    return fight(c, dt, [
      ['skimCd', 2, 5, 'blink', { pal: GALE, sound: 'whoosh' }],
      ['wingCd', 3, 7, 'gust', { len: 6, knock: 4, pal: GALE }],
      ['sprayCd', 4, 9, 'rain', { n: 14, kind: 'cold', dmg: 4, chill: 1, pal: SEA }],
      ['stoopCd', 3, 8, 'pounce', { dmg: 7, pal: GALE, min: 2 }],
      ['galeCd', 7, 13, 'wall', { march: true, dmg: 5, kind: 'cold', knock: 2, pal: GALE, ph: 2 }],
      ['stormCd', 9, 15, 'lightning', { n: 6, dmg: 6, ph: 3 }],
    ]);
  },
  // The Beacon-Keeper: his beacon's beam turning round the broch, his
  // lamp held up (marking you), oil, the drowned who followed his light.
  beaconKeeper(c, dt) {
    return fight(c, dt, [
      ['beamCd', 2, 8, 'spin', { n: 12, every: 0.16, len: 12, dmg: 6, burn: 1, pal: LAMP, say: 'Stay in the light!' }],
      ['lampCd', 3, 8, 'mark', { r: 1, dmg: 9, burn: 2, pal: LAMP, text: 'lit up!' }],
      ['oilCd', 4, 9, 'volley', { n: 3, r: 1, dmg: 4, burn: 2, pal: FIRE, zone: 'fire', life: 5, tick: 0.6, tickDmg: 1, zburn: 1 }],
      ['drownedCd', 6, 15, 'summon', { sp: ['drowned', 'wrecker'], n: 2, cap: 4, pal: SEA }],
      ['flareCd', 7, 13, 'blind', { secs: 2.5, pal: LAMP, ph: 2 }],
      ['beaconCd', 9, 15, 'cross', { kind: 'fire', dmg: 7, burn: 2, diag: true, pal: LAMP, ph: 3 }],
    ]);
  },
  // The Sea Trow: up the flooded stair, the sea with it; its fists, weed
  // that holds, a wave.
  seaTrow(c, dt) {
    const W = { c: [90, 138, 106], p: ['#5a8a6a', '#e0f0ff', '#2a4a3a'] };
    return fight(c, dt, [
      ['fistCd', 1, 5, 'slam', { r: 2, dmg: 8, knock: 3, pal: W, max: 3 }],
      ['tideCd', 3, 9, 'flood', { r: 3, life: 8, pal: SEA }],
      ['weedCd', 4, 9, 'zone', { zk: 'snare', r: 1, root: 1.3, life: 7, pal: W }],
      ['waveCd', 5, 11, 'wall', { dmg: 7, kind: 'cold', knock: 3, pal: SEA }],
      ['stairCd', 7, 13, 'erupt', { extra: 4, r: 0, dmg: 6, pal: SEA, ph: 2 }],
      ['stormCd', 9, 15, 'wall', { march: true, dmg: 6, kind: 'cold', knock: 2, pal: SEA, ph: 3 }],
    ]);
  },
};

Object.assign(BRAINS, FAR_BRAINS);
Object.assign(BOSS_TITLES, FAR_BOSS_TITLES);
