// How a town is doing, and what that looks like when you walk in.
//
// A thriving town (money in the coffers, fed and cheerful people, its
// shops all open) hangs banners in its colours by the hall, the tavern and
// the temple and at the roads in; its streets and its tavern are busy, and
// its music is quick and bright. A struggling one (hungry, broke, glum,
// shops shut, raided lately) boards up the windows of its poorer houses,
// has beggars on the square and a quiet tavern, and its tune goes slow and
// minor. Each people's music has its own sound, too. It all changes back
// as the town's luck does.
import { B, planksOf } from '../world/blocks.js';
import { M } from '../world/settlement.js';
import { GROUND } from '../config.js';
import { alive, ledger } from './econ.js';
import { RNG, hash4 } from '../util/rng.js';
import { decorMeta, styleOf } from './events.js';
import { retrain } from '../entities/npcgen.js';

const residents = (L) => L.npcs.filter((r) => alive(r) && !r.away && !r.migrated && !r.visitor);

// How the place is doing: a score, and a word for it.
export function fortuneScore(L, day = null) {
  const e = L.econ;
  const s = L.settlement;
  if (!e || s.deserted || s.condition === 'abandoned') return -3;
  const people = residents(L);
  const pop = Math.max(1, people.length);
  let v = 0;
  const mood = people.reduce((a, r) => a + (r.mood ?? 0.5), 0) / pop;
  v += (mood - 0.5) * 3;
  const perHead = (e.treasury || 0) / pop;
  v += perHead >= 25 ? 1 : perHead >= 12 ? 0.5 : perHead < 3 ? -0.7 : 0;
  const hungry = people.filter((r) => (r.hungry || 0) >= 1).length / pop;
  v -= hungry > 0.15 ? 1.2 : hungry > 0.05 ? 0.4 : 0;
  v += s.condition === 'prosperous' ? 0.6 : s.condition === 'poor' ? -0.6 : 0;
  const closed = Object.values(e.biz || {}).filter((b) => b && b.closed).length;
  v -= closed * 0.35;
  if (day !== null && e.raidedDay !== undefined && e.raidedDay !== null && day - e.raidedDay < 6) v -= 0.5;
  if ((e.tax || 0) >= 0.18) v -= 0.4;
  return v;
}

export function fortuneOf(L) {
  const e = L && L.econ;
  if (!e) return 'steady';
  if (e.fortune) return e.fortune;
  const v = fortuneScore(L);
  return v >= 1 ? 'thriving' : v <= -0.8 ? 'struggling' : 'steady';
}

export class Prosperity {
  constructor(game, sim) {
    this.game = game;
    this.sim = sim;
  }

  // Daily: how it's going, and (if you're there to see) how it looks.
  daily(L, day) {
    const e = L.econ;
    const before = e.fortune || null;
    const v = fortuneScore(L, day);
    // (A little stickiness, so it doesn't flicker day to day.)
    let f = v >= 1 ? 'thriving' : v <= -0.8 ? 'struggling' : 'steady';
    if (before === 'thriving' && v >= 0.7) f = 'thriving';
    if (before === 'struggling' && v <= -0.5) f = 'struggling';
    e.fortune = f;
    if (before && before !== f) {
      const s = L.settlement;
      if (f === 'thriving') ledger(L, day, `${s.name} is doing well: banners are going up, and the tavern's full every night.`);
      else if (f === 'struggling') ledger(L, day, `Hard times in ${s.name}: windows boarded up, beggars on the square, and the tavern half empty.`);
      else if (before === 'struggling') ledger(L, day, `Things are looking up in ${s.name}. The boards are coming down off the windows.`);
    }
    this.beggars(L, day, f);
    if (this.game.active.has(L.settlement.id)) this.dress(L);
  }

  // Hard times put some out of work and onto the square; good times give
  // them work again.
  beggars(L, day, f) {
    const people = residents(L);
    const begging = people.filter((r) => r.job === 'beggar');
    const rng = new RNG(hash4(L.settlement.seed >>> 0, day, 0xbe66));
    if (f === 'struggling' && begging.length < (L.settlement.type === 'village' ? 1 : 2) && rng.chance(0.3)) {
      const r = rng.pick(people.filter((q) => q.age === 'adult' && ['laborer', 'farmer', 'fisher'].includes(q.job) && (q.coins || 0) < 15 && q.ruler === undefined && q.councillor === undefined && q.raid === undefined && q.soldier === undefined));
      if (r) {
        retrain(L, r, 'beggar', rng);
        ledger(L, day, `${r.name.first} ${r.name.last} lost their work, and has taken to begging on the square.`);
      }
    } else if (f === 'thriving' && begging.length && rng.chance(0.25)) {
      const r = begging[0];
      retrain(L, r, 'laborer', rng);
      ledger(L, day, `${r.name.first} ${r.name.last} has found work at last, and is off the street.`);
    }
  }

  // The look of it: banners up or down, windows boarded or glazed.
  dress(L) {
    // (Reckoned once on arrival; the days keep it up to date after.)
    if (!L.econ.fortune) L.econ.fortune = fortuneOf(L);
    const f = L.econ.fortune;
    this.banners(L, f === 'thriving');
    this.boards(L, f === 'struggling');
  }

  // Banners in the town's colours by the doors that matter and at the
  // roads in.
  banners(L, on) {
    const e = L.econ;
    const w = this.game.world;
    if (!on) {
      if (!e.banners || !e.banners.length) return;
      const ops = e.banners.filter(([x, y, z]) => !w.regionAt(x, z) || w.getBlock(x, y, z) === B.festival_banner).map(([x, y, z]) => [x, y, z, B.air, 0]);
      if (ops.length) this.sim.setBlocks(ops);
      e.banners = [];
      return;
    }
    if (e.banners && e.banners.length) return;
    const s = L.settlement;
    const tier = { village: 0, town: 1, city: 2 }[s.type] ?? 0;
    const want = [3, 5, 8][tier];
    const blocked = new Set([M.BUILD, M.WALL, M.WATER, M.FIELD]);
    const air = (x, y, z) => w.regionAt(x, z) && w.getBlock(x, y, z) === B.air;
    const open = (x, z) => L.inside(x, z, 0) && !blocked.has(L.maskAt(x, z)) && air(x, GROUND, z) && air(x, GROUND + 1, z) && !L.isRoadTile(x, z) && !(L.isLane && L.isLane(x, z))
      && !L.spots.some((q) => q.x === x && q.z === z) && !this.game.entityAt?.(x, GROUND, z);
    const spots = [];
    for (const t of ['townhall', 'tavern', 'temple', 'guardhouse', 'shop', 'library']) {
      const b = L.buildings.find((q) => q.type === t && q.outside && !q.underConstruction);
      if (b) spots.push(b.outside);
    }
    for (const en of L.entrances || []) spots.push(en);
    const palette = styleOf(s).palette;
    const meta = decorMeta(palette);
    const ops = [];
    const used = new Set();
    for (const at of spots) {
      if (ops.length >= want) break;
      for (const [dx, dz] of [[2, 0], [-2, 0], [0, 2], [0, -2], [2, 1], [-2, 1], [1, 2], [-1, 2]]) {
        const x = at.x + dx;
        const z = at.z + dz;
        if (used.has(`${x},${z}`) || !open(x, z)) continue;
        used.add(`${x},${z}`);
        ops.push([x, GROUND, z, B.festival_banner, meta]);
        break;
      }
    }
    if (!ops.length) return;
    this.sim.setBlocks(ops);
    e.banners = ops.map(([x, y, z]) => [x, y, z]);
  }

  // Boards over the windows of the poorer houses (a third of them, or so).
  boards(L, on) {
    const e = L.econ;
    const w = this.game.world;
    if (!on) {
      if (!e.boarded || !e.boarded.length) return;
      const ops = e.boarded.filter(([x, y, z]) => !w.regionAt(x, z) || w.getBlock(x, y, z) === planksOf(L.settlement.style)).map(([x, y, z]) => [x, y, z, B.glass, 0]);
      if (ops.length) this.sim.setBlocks(ops);
      e.boarded = [];
      return;
    }
    if (e.boarded && e.boarded.length) return;
    // (A third of those with glass in their windows to board, chosen by
    // the town's own dice.)
    const panes = (b) => {
      const out = [];
      for (let x = b.x0; x <= b.x1; x++) {
        for (let z = b.z0; z <= b.z1; z++) {
          if (x !== b.x0 && x !== b.x1 && z !== b.z0 && z !== b.z1) continue;
          for (const y of [GROUND + 1, GROUND + 2]) if (w.regionAt(x, z) && w.getBlock(x, y, z) === B.glass) out.push([x, y, z, planksOf(L.settlement.style), 0]);
        }
      }
      return out;
    };
    const houses = L.buildings.filter((b) => (b.residential || b.type === 'shop' || b.type === 'tailor' || b.type === 'warehouse') && !b.playerHome && !b.underConstruction && b.x0 !== undefined)
      .map((b) => ({ b, p: panes(b) })).filter((q) => q.p.length)
      .sort((a, c) => hash4(L.settlement.seed >>> 0, a.b.id, 0xb0a2) - hash4(L.settlement.seed >>> 0, c.b.id, 0xb0a2));
    const ops = houses.slice(0, Math.ceil(houses.length / 3)).flatMap((q) => q.p);
    if (!ops.length) return;
    this.sim.setBlocks(ops);
    e.boarded = ops.map(([x, y, z]) => [x, y, z]);
  }
}

// What the town's music sounds like: its people's own sound, and its luck.
export function townMusic(L) {
  if (!L || !L.settlement) return '';
  const s = L.settlement;
  const style = (s.civ ? s.civ.style : s.style) || 'vale';
  const f = fortuneOf(L);
  return `@${style}.${f}`;
}
