// (Round 77) Getting about: a coach from each town to the towns along its
// roads (and its neighbours of the same realm), and a ferry from a town
// with a pier across the sea to another land's (as far as the sea can be
// crossed: never through the storm round the islands while it stands). A
// fare, the hours of the way going by (see Game.journey), and you're set
// down at the far end.
//   The coach stands outside town by the way in, its horse in the traces;
// the ferry lies off the end of the pier (see Game.syncStanding). Either,
// clicked, says where it goes (see ui/travel.js).
import { REGION_W, REGION_D, MAP_W } from '../config.js';
import { seaRoute, seaOff } from '../game/shipfleets.js';

// How far a coach goes in a game minute, and a ferry (tiles).
const COACH_PACE = 2.5;
const FERRY_PACE = 5;

const centre = (s) => ({ x: (s.cx + s.cw / 2) * REGION_W, z: (s.cz + s.cd / 2) * REGION_D });
const open = (s) => !!s && !s.deserted && s.condition !== 'abandoned' && !s.founding;

// Which land a town is on (its key).
export function landOf(ow, s) {
  const c = centre(s);
  const L = ow.landAt(c.x, c.z);
  return L ? L.key ?? L.kind ?? null : null;
}

// Has the player been where `s` is (or seen it from afar: on the map)?
function known(game, s) {
  const ow = game.world.ow;
  const c = centre(s);
  return !!(game.revealMap || (ow.explored && ow.explored[Math.floor(c.z / REGION_D) * MAP_W + Math.floor(c.x / REGION_W)]));
}

// The coach's ways from `from`: [{ s, kind, dist, mins, fare, known }].
export function coachLinks(game, from) {
  const ow = game.world.ow;
  const dip = game.sim.diplomacy;
  const land = landOf(ow, from);
  const c0 = centre(from);
  const out = [];
  for (const s of ow.settlements) {
    if (s === from || !open(s) || landOf(ow, s) !== land) continue;
    const road = (dip.roads || []).some((r) => r.done && ((r.a === from.id && r.b === s.id) || (r.a === s.id && r.b === from.id)));
    const c1 = centre(s);
    const dist = Math.hypot(c1.x - c0.x, c1.z - c0.z);
    // (Along a road, or to a neighbour of the same realm not far off.)
    if (!road && !(from.civ && s.civ === from.civ && dist <= 10 * REGION_W)) continue;
    // (A road winds: the way's a little longer than the crow flies.)
    const way = dist * 1.25;
    out.push({ s, kind: 'coach', road, dist: way, mins: Math.max(30, Math.round(way / COACH_PACE)), fare: Math.max(3, Math.round(way / 45)), known: known(game, s) });
  }
  return out.sort((a, b) => a.dist - b.dist).slice(0, 8);
}

// The ferry's crossings from `from` (a town with a pier): as coachLinks,
// `pending` while the way across is still being worked out.
export function ferryLinks(game, from) {
  const ow = game.world.ow;
  const P = game.sim.ships && game.sim.ships.ports[from.id];
  if (!P || !P.site) return [];
  const land = landOf(ow, from);
  const a = seaOff(ow, from);
  if (!a) return [];
  const c0 = centre(from);
  // (While the storm round the islands stands, no ferry crosses it: the
  // islands' own waters, or the open sea outside, but not between.)
  const inStorm = (s) => {
    const c = centre(s);
    return !ow.wallDown && !!ow.insideStorm(c.x, c.z);
  };
  const side = inStorm(from);
  const cands = ow.settlements
    .filter((s) => s !== from && open(s) && (s.coast || game.sim.ships.ports[s.id]) && landOf(ow, s) !== land && inStorm(s) === side)
    .map((s) => ({ s, d: Math.hypot(centre(s).x - c0.x, centre(s).z - c0.z) }))
    .sort((p, q) => p.d - q.d)
    .slice(0, 6);
  const out = [];
  for (const { s } of cands) {
    const b = seaOff(ow, s);
    if (!b) continue;
    const route = seaRoute(game, a, b, game.instantWork ? Infinity : 4);
    if (route === null) continue;
    if (route === undefined) {
      out.push({ s, kind: 'ferry', pending: true, known: known(game, s) });
      continue;
    }
    let len = 0;
    for (let i = 1; i < route.length; i++) len += Math.hypot(route[i].x - route[i - 1].x, route[i].z - route[i - 1].z);
    out.push({ s, kind: 'ferry', dist: len, mins: Math.max(60, Math.round(len / FERRY_PACE)), fare: Math.max(12, Math.round(12 + len / 60)), known: known(game, s) });
  }
  return out;
}

// Where a coach stands in town (its key and spot), or null: outside, by the
// way in (beside the sign there, if it's up).
export function coachStand(L) {
  const sg = (L.signs || []).find((q) => q.kind === 'entrance' && q.x !== undefined);
  const e = sg || (L.entrances && L.entrances[0]);
  if (!e) return null;
  return { key: `coach:${L.settlement.id}`, type: 'wagon', x: e.x + 2, z: e.z + 1, face: 1, hood: true, horse: { coat: L.settlement.id % 4, saddle: false }, banner: L.settlement.civ ? L.settlement.civ.color.hex : null, stop: { kind: 'coach', sid: L.settlement.id } };
}

// Where the ferry lies, off the end of the town's pier, or null.
export function ferryStand(game, L) {
  const P = game.sim.ships && game.sim.ships.ports[L.settlement.id];
  if (!P || !P.site || P.state !== 'docked' || !seaOff(game.world.ow, L.settlement)) return null;
  const st = P.site;
  const side = st.side || { x: -st.dir.z, z: st.dir.x };
  const x = Math.round(st.end.x + st.dir.x - side.x * 3);
  const z = Math.round(st.end.z + st.dir.z - side.z * 3);
  return { key: `ferry:${L.settlement.id}`, type: 'ship', x, z, face: st.dir.x > 0 ? 3 : st.dir.x < 0 ? 1 : st.dir.z > 0 ? 0 : 2, banner: L.settlement.civ ? L.settlement.civ.color.hex : null, stop: { kind: 'ferry', sid: L.settlement.id } };
}

// Where you're set down at `s` (by coach, or off the ferry).
export function arrivalSpot(game, s, kind) {
  const L = game.world.layouts.get(s.id) || game.world.getLayout(s);
  if (kind === 'ferry') {
    const P = game.sim.ships && game.sim.ships.ports[s.id];
    if (P && P.site) return { x: P.site.root.x, z: P.site.root.z };
  }
  const st = L && coachStand(L);
  if (st) return { x: st.x - 1, z: st.z + 1 };
  if (L && L.plaza) return { x: L.plaza.cx, z: L.plaza.cz + 3 };
  const c = centre(s);
  return { x: Math.round(c.x), z: Math.round(c.z) };
}

// In words, how long a way takes.
export function wayTime(mins) {
  if (mins < 90) return `${Math.round(mins / 10) * 10} min`;
  const h = mins / 60;
  return h < 24 ? `${Math.round(h)} h` : `${Math.round(h / 24)} day${Math.round(h / 24) === 1 ? '' : 's'}`;
}
