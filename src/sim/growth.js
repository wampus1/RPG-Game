// Towns grow. As people come (births, nomads, settlers) the council keeps a
// bed or two to spare by building houses, and adds the trades a bigger place
// should have. A village with enough folk and a healthy purse becomes a
// town, a town becomes a city and walls itself in, and a walled city that
// has run out of room pulls down a stretch of its wall and spreads beyond
// it. All of it costs timber, stone and coin, so poor or struggling places
// grow slowly, or not at all.
import { alive, ledger, stockOf, hasMaterials } from './econ.js';
import { deserted } from './civic.js';

// What it takes to go up a size.
export const TIERS = {
  village: { next: 'town', pop: 26, buildings: 10, treasury: 280, needs: ['tavern'] },
  town: { next: 'city', pop: 50, buildings: 20, treasury: 760, needs: ['tavern', 'smithy'] },
};
// Trades a place of each size should have (beyond what the supply chain
// already asks for).
const TIER_WANTS = { town: ['shop', 'workshop', 'guardhouse'], city: ['library', 'tailor', 'temple'] };
const COINS = { house_m: 140, shop: 150, workshop: 150, guardhouse: 160, library: 220, tailor: 140, temple: 260 };
const WALL_COST = { coins: 300, stone: 60 };

function residents(L) {
  return L.npcs.filter((r) => alive(r) && !r.away && !r.migrated && !r.visitor);
}

// One project at a time (and your house, if it's going up, comes first).
function busy(sim, L) {
  const c = sim.construction;
  if (c && !c.done && !c.cancelled && c.sid === L.settlement.id) return true;
  return sim.works.projects.some((p) => !p.done && p.sid === L.settlement.id && p.kind !== 'repair');
}

// Timber and stone run low: the council buys some in from passing traders.
function buyMaterials(L, day) {
  const e = L.econ;
  const k = stockOf(L);
  const pop = residents(L).length;
  if (e.treasury < pop * 12 + 120 || (e.boughtDay !== undefined && day - e.boughtDay < 3)) return false;
  let spent = 0;
  if (k.wood < 25) {
    k.wood += 20;
    spent += 40;
  }
  if (k.stone < 25) {
    k.stone += 20;
    spent += 50;
  }
  if (!spent) return false;
  e.treasury -= spent;
  e.boughtDay = day;
  ledger(L, day, `The council bought timber and stone from passing traders (¤${spent}).`);
  return true;
}

// Up a size: a village becomes a town, a town a city.
export function promote(sim, L, next, day) {
  const s = L.settlement;
  const was = s.type;
  if (!s.baseType) s.baseType = was;
  s.type = next;
  L.econ.tier = next;
  sim.areaCache.clear();
  ledger(L, day, `${s.name} has grown from a ${was} into a ${next}!${next === 'city' ? ' The council means to build a wall.' : ''}`);
  // Good news all round; and a celebration by the square in a couple of days.
  L.econ.festival = day;
  for (const r of L.npcs) if (alive(r)) r.mood = Math.min(1, (r.mood ?? 0.5) + 0.1);
  sim.events.fete(L, day, next);
  const g = sim.game;
  if (g.active.has(s.id)) {
    g.ui.msg(`${s.name} is now a ${next}!`, '#ffe070');
    g.audio?.play('fanfare');
  }
  return next;
}

// Where a walled city can break out: the edge tile nearest to open ground.
// A walled town that needs room for a building it can't fit inside (an
// academy, cells for prisoners) pulls down a stretch of its wall to build
// out beyond it. The breach project, or null when there's room (or a
// breach is already going).
export function breachFor(sim, L, type) {
  const works = sim.works;
  if (!L.walled || works.freePlot(L, type, true) || sim.roads.planStreet(L)) return null;
  if (works.active(L.settlement.id).some((p) => p.kind === 'breach')) return null;
  const br = breachPoint(L, works);
  if (!br || !br.at) return null;
  L.econ.treasury -= 40;
  return works.add({ sid: L.settlement.id, kind: 'breach', at: br.at, bid: L.buildings.length - 0.25, label: 'pulling down part of the wall' });
}

function breachPoint(L, works) {
  const b = L.bounds;
  // (The road will come in through the gap.)
  const plot = L.fringePlot(false, 7, 0.05, false) || L.fringePlot(false, 12, 0, false) || L.fringePlot(false, 12, 0, false, false);
  if (!plot) return null;
  works.registerPlot(L, plot);
  const outside = plot.outside;
  const cx = Math.max(b.x0, Math.min(b.x1, outside.x));
  const cz = Math.max(b.z0, Math.min(b.z1, outside.z));
  // Snap to the nearest side of the wall.
  const d = [[Math.abs(cz - b.z0), cx, b.z0], [Math.abs(cz - b.z1), cx, b.z1], [Math.abs(cx - b.x0), b.x0, cz], [Math.abs(cx - b.x1), b.x1, cz]].sort((p, q) => p[0] - q[0])[0];
  const at = { x: Math.max(b.x0 + 3, Math.min(b.x1 - 3, d[1])), z: Math.max(b.z0 + 3, Math.min(b.z1 - 3, d[2])) };
  if (d[1] === b.x0 || d[1] === b.x1) at.x = d[1];
  if (d[2] === b.z0 || d[2] === b.z1) at.z = d[2];
  // A gate close by already does the job.
  if (L.gates.some((q) => Math.abs(q.x - at.x) + Math.abs(q.z - at.z) <= 8)) return { at: null, plot };
  return { at, plot };
}

// One step of growth, every few days: at most one new project at a time.
export function growth(sim, L, day) {
  const s = L.settlement;
  const e = L.econ;
  if (deserted(s) || s.condition === 'abandoned' || !e) return null;
  buyMaterials(L, day);
  if ((day + s.id) % 3 !== 0 || busy(sim, L)) return null;
  const people = residents(L);
  const has = (type) => L.buildings.some((b) => b.type === type);
  const works = sim.works;
  // Up a size, when the town has the people, the buildings and the purse.
  const t = TIERS[s.type];
  // (You count too, if you're a citizen.)
  if (t && people.length + sim.playerCount(s.id) >= t.pop && L.buildings.filter((b) => !b.underConstruction).length >= t.buildings && e.treasury >= t.treasury && t.needs.every(has)) {
    return { promoted: promote(sim, L, t.next, day) };
  }
  // A new city walls itself in; so does a town that's been raided (or is
  // near a war), sooner and for less (less still with field fortification).
  const threatened = s.type === 'town' && ((e.raidedDay !== undefined && day - e.raidedDay <= 40) || (sim.war && sim.war.front(s)));
  const cost = threatened ? Math.round(WALL_COST.coins * (sim.tech.has(s, 'fieldworks') ? 0.55 : 0.75)) : WALL_COST.coins;
  if ((s.type === 'city' || threatened) && !L.walled && e.treasury >= cost + (threatened ? 40 : 100) && stockOf(L).stone >= WALL_COST.stone * (threatened ? 0.6 : 1)) {
    const plan = L.wallPlan();
    if (plan.tiles.length) {
      e.treasury -= cost;
      stockOf(L).stone -= Math.round(WALL_COST.stone * (threatened ? 0.6 : 1));
      if (threatened) ledger(L, day, `${e.raidedDay !== undefined && day - e.raidedDay <= 40 ? 'After the raids' : 'With war so near'}, the council of ${s.name} means to wall the town in.`);
      return { wall: works.add({ sid: s.id, kind: 'wall', bid: L.buildings.length - 0.5, label: threatened ? 'a wall against raiders' : 'the new city wall' }) };
    }
  }
  // A walled city with streets and houses outside its wall rings them with
  // a new one (the old wall stays as an inner ring).
  if (s.type === 'city' && L.walled && !works.active(s.id).some((p) => p.kind === 'wall') && e.treasury >= WALL_COST.coins + 150 && stockOf(L).stone >= WALL_COST.stone) {
    const cur = e.wallRect || L.bounds;
    const outside = L.buildings.filter((b) => !b.underConstruction && (b.x1 < cur.x0 || b.x0 > cur.x1 || b.z1 < cur.z0 || b.z0 > cur.z1));
    if (outside.length >= 2) {
      const r = { x0: cur.x0, z0: cur.z0, x1: cur.x1, z1: cur.z1 };
      for (const b of outside) {
        r.x0 = Math.min(r.x0, b.x0 - 3);
        r.z0 = Math.min(r.z0, b.z0 - 3);
        r.x1 = Math.max(r.x1, b.x1 + 3);
        r.z1 = Math.max(r.z1, b.z1 + 3);
      }
      const plan = r.x1 - r.x0 < 140 && r.z1 - r.z0 < 140 ? L.outerWallPlan(r) : null;
      if (plan && plan.tiles.length >= 8) {
        e.treasury -= WALL_COST.coins;
        stockOf(L).stone -= WALL_COST.stone;
        return { wall: works.add({ sid: s.id, kind: 'wall', rect: r, bid: L.buildings.length - 0.5, label: 'a new wall round the outer streets' }) };
      }
    }
  }
  // Room for everyone, and a bed or two to spare for newcomers.
  const beds = L.buildings.filter((b) => b.residential && !b.playerHome && !b.underConstruction).reduce((n, b) => n + b.beds.length, 0);
  const want = [];
  if (people.length + 2 > beds) want.push(['house_m', ', as the town grows']);
  for (const type of TIER_WANTS[s.type] || []) if (!has(type)) want.push([type, `, now that ${s.name} is a ${s.type}`]);
  for (const [type, why] of want) {
    const coins = COINS[type] || 150;
    if (e.treasury < coins + 80 || !hasMaterials(L, type)) {
      if (!hasMaterials(L, type)) e.short = type;
      continue;
    }
    // A walled city with no room left inside breaks through its wall first.
    if (L.walled && !works.freePlot(L, type, true) && !sim.roads.planStreet(L)) {
      const br = breachPoint(L, works);
      if (br && br.at) {
        e.treasury -= 40;
        return { breach: works.add({ sid: s.id, kind: 'breach', at: br.at, bid: L.buildings.length - 0.25, label: 'pulling down part of the wall' }) };
      }
    }
    if (sim.roads.waiting(L, 'build', { type })) continue;
    const p = works.startBuilding(L, type, why, false, coins);
    if (p) {
      e.treasury -= coins;
      return { building: p };
    }
  }
  return null;
}
