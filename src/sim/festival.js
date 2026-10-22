// (Round 129) A festival's day, spread round the town. Not one stage by the
// square but several places, each by the building it belongs to: ale
// tables by the tavern door, the blessing at the temple, a row of stalls
// on a street off the square, games on the green at the edge of town; and
// the stage on the square as ever. The day runs to a programme (stalls and
// games in the morning, the blessing, the procession from the temple to the
// square, the feast, then the night at the tavern), read off the posters
// and called out round the town; and the townsfolk spread out over it,
// each going where they'd want to be (the devout to the temple, the
// thirsty to the ale tables, the children to the green), the shopkeepers
// minding the stalls. Rain sends everyone indoors: the tavern, the hall,
// the temple.
//
// What's here is the planning of it: where each place goes and what's put
// up there, the programme, and who goes where when (see sim/events.js for
// the day itself, and entities/npc.js for the people at it).
import { B, BLOCKS, CANOPY_SHIFT, CANOPY_STYLE_SHIFT, CANOPY_STYLES, META_STATE } from '../world/blocks.js';
import { M } from '../world/settlement.js';
import { GROUND } from '../config.js';
import { hash4 } from '../util/rng.js';
import { alive, DAY } from './econ.js';

const LIT = META_STATE;
const at = (list) => list.map(([dx, dz, face = 2]) => ({ dx, dz, face }));

// The kinds of do spread out like this (a wedding stays on the square).
export const festive = (ev) => !!ev && (ev.kind === 'feast' || ev.kind === 'fete' || ev.kind === 'rite');

// ------------------------------------------------------------ the places
// Each place: what's put up (by the corner, [dx, dy, dz, block, meta]),
// its size, where people stand or sit, which building it belongs by (and
// shelters in when it rains), and how it's shown (its mark on the little
// map, its colour).
export const VENUES = {
  // By the tavern door: casks and a trestle for a counter, the keeper
  // behind it, those drinking in front, benches beyond.
  alehouse: {
    w: 5, d: 4, by: 'tavern', shelter: 'tavern', name: 'the ale tables by the tavern', short: 'ALE TABLES', at: 'at the tavern', color: '#f0b040',
    blocks: [
      [0, 0, 1, 'ale_cask'], [4, 0, 1, 'ale_cask'], [1, 0, 1, 'feast_table'], [3, 0, 1, 'feast_table'], [2, 0, 1, 'barrel'], [2, 1, 1, 'lantern', LIT],
      [0, 0, 3, 'bench', 2], [1, 0, 3, 'bench', 2], [3, 0, 3, 'bench', 2], [4, 0, 3, 'bench', 2],
    ],
    serve: at([[1, 0, 0], [3, 0, 0]]),
    seats: at([[0, 3], [1, 3], [3, 3], [4, 3]]),
    stand: at([[0, 2], [1, 2], [2, 2], [3, 2], [4, 2], [2, 3], [-1, 2], [5, 2], [-1, 3], [5, 3], [2, 4], [1, 4], [3, 4]]),
    games: { dx: 2, dz: 0, face: 0 },
  },
  // Before the temple: an altar between candles, flowers, the priest
  // facing the faithful.
  shrine: {
    w: 5, d: 4, by: 'temple', shelter: 'temple', name: 'the blessing at the temple', short: 'BLESSING', at: 'at the temple', color: '#c8a8ff',
    blocks: [[2, 0, 0, 'altar'], [1, 0, 0, 'candles'], [3, 0, 0, 'candles'], [0, 0, 0, 'flower_white'], [4, 0, 0, 'flower_white'], [0, 0, 3, 'lantern', LIT], [4, 0, 3, 'lantern', LIT]],
    lead: { dx: 2, dz: 1, face: 0 },
    stand: at([[1, 2], [2, 2], [3, 2], [1, 3], [2, 3], [3, 3], [0, 2], [4, 2], [0, 1], [4, 1], [1, 4], [2, 4], [3, 4], [-1, 2], [5, 2], [-1, 3], [5, 3]]),
  },
  // Stalls in a row: a canopy on two posts, a counter under it, the
  // stallholder behind and the customers in front.
  stalls: {
    w: 9, d: 3, by: 'plaza', shelter: 'tavern', name: 'the stalls', short: 'STALLS', at: 'at the stalls', color: '#70d8ff', canopy: true,
    blocks: [0, 5].flatMap((x) => [
      [x, 0, 0, 'fence'], [x, 1, 0, 'fence'], [x + 3, 0, 0, 'fence'], [x + 3, 1, 0, 'fence'],
      [x, 2, 0, 'canopy'], [x + 1, 2, 0, 'canopy'], [x + 2, 2, 0, 'canopy'], [x + 3, 2, 0, 'canopy'],
      [x + 1, 0, 1, 'counter'], [x + 2, 0, 1, 'counter'],
    ]),
    serve: at([[1, 0, 0], [2, 0, 0], [6, 0, 0], [7, 0, 0]]),
    stand: at([[1, 2], [2, 2], [6, 2], [7, 2], [4, 1], [4, 2], [0, 2], [3, 2], [5, 2], [8, 2], [1, 3], [2, 3], [6, 3], [7, 3], [4, 3], [-1, 1], [9, 1]]),
  },
  // The green at the edge of town: two butts to shoot at, a board for
  // the winners, hay bales at the corners, and room for a ring.
  green: {
    w: 7, d: 5, by: 'edge', shelter: 'townhall', name: 'the games on the green', short: 'GAMES', at: 'on the green', color: '#80e070',
    blocks: [
      [0, 0, 0, 'hay_bale'], [6, 0, 0, 'hay_bale'], [0, 0, 4, 'hay_bale'], [6, 0, 4, 'hay_bale'],
      [2, 0, 0, 'archery_butt'], [4, 0, 0, 'archery_butt'], [3, 0, 0, 'fest_board'],
      [0, 1, 0, 'lantern', LIT], [6, 1, 0, 'lantern', LIT],
    ],
    games: { dx: 3, dz: 1, face: 0 },
    line: at([[2, 4], [3, 4], [4, 4]]),
    stand: at([[1, 4], [5, 4], [-1, 1], [7, 1], [-1, 2], [7, 2], [-1, 3], [7, 3], [1, 5], [3, 5], [5, 5], [2, 5], [4, 5], [0, 5], [6, 5], [-1, 4], [7, 4]]),
    ring: { dx: 3, dz: 2 },
  },
};
// (Smaller ways of each, for a town with less room: one stall, one cask,
// an altar with a candle each side.)
export const VENUE_ALTS = {
  alehouse: [{
    w: 3, d: 3,
    blocks: [[0, 0, 1, 'ale_cask'], [1, 0, 1, 'feast_table'], [2, 0, 1, 'barrel'], [1, 1, 1, 'lantern', LIT]],
    serve: at([[1, 0, 0]]),
    stand: at([[0, 2], [1, 2], [2, 2], [-1, 1], [3, 1], [-1, 2], [3, 2], [1, 3], [0, 3], [2, 3]]),
    games: { dx: 1, dz: 0, face: 0 },
  }],
  shrine: [{
    w: 3, d: 3,
    blocks: [[1, 0, 0, 'altar'], [0, 0, 0, 'candles'], [2, 0, 0, 'candles']],
    lead: { dx: 1, dz: 1, face: 0 },
    stand: at([[0, 2], [1, 2], [2, 2], [0, 1], [2, 1], [-1, 1], [3, 1], [-1, 2], [3, 2], [1, 3], [0, 3], [2, 3]]),
  }],
  stalls: [{
    w: 4, d: 3,
    blocks: [[0, 0, 0, 'fence'], [0, 1, 0, 'fence'], [3, 0, 0, 'fence'], [3, 1, 0, 'fence'], [0, 2, 0, 'canopy'], [1, 2, 0, 'canopy'], [2, 2, 0, 'canopy'], [3, 2, 0, 'canopy'], [1, 0, 1, 'counter'], [2, 0, 1, 'counter']],
    serve: at([[1, 0, 0], [2, 0, 0]]),
    stand: at([[1, 2], [2, 2], [0, 2], [3, 2], [-1, 1], [4, 1], [-1, 2], [4, 2], [1, 3], [2, 3], [0, 3], [3, 3]]),
  }],
};
// The design a place was put up in (its own, or a smaller).
export const designOf = (v) => (v && v.alt !== undefined && VENUE_ALTS[v.id] ? { ...VENUES[v.id], ...VENUE_ALTS[v.id][v.alt] } : VENUES[v ? v.id : null]);

// The stage on the square is the do's own (see events.js DESIGNS).
export const STAGE = { name: 'the square', short: 'SQUARE', at: 'on the square', color: '#ff9ad0' };
export const venueName = (id) => (VENUES[id] ? VENUES[id].name : STAGE.name);

// What's on, as people say it.
export const SLOT_WORDS = {
  fair: 'the stalls and the games', blessing: 'the blessing', procession: 'the procession', feast: 'the feast', night: 'the night at the tavern',
};
export const SLOT_SHORT = { fair: 'STALLS, GAMES', blessing: 'THE BLESSING', procession: 'PROCESSION', feast: 'THE FEAST', night: 'THE NIGHT' };

// Which places each do has (by the size of the town: a village's is small).
function wanted(L, ev) {
  const t = L.settlement.type;
  const big = t !== 'village';
  if (ev.kind === 'rite') {
    return {
      vigil: ['shrine'],
      lanterns: big ? ['shrine', 'stalls'] : ['shrine'],
      tidefeast: big ? ['alehouse', 'stalls'] : ['alehouse'],
      fair: big ? ['stalls', 'green', 'alehouse'] : ['stalls'],
    }[ev.rite] || [];
  }
  if (!big) return ['alehouse', 'stalls'];
  const out = ['alehouse', 'shrine', 'stalls'];
  if (t === 'city' || L.settlement.empire || ev.kind === 'fete') out.push('green');
  return out;
}

// ------------------------------------------------------------ the programme
// The places a do is to have, as it's announced (those whose building the
// town has): what the posters promise before anything's put up.
export function plannedVenues(L, ev) {
  return wanted(L, ev).filter((id) => anchorsFor(L, VENUES[id]).length);
}

// What happens when ([from, to) in minutes since the world began) and
// where (the places it's at: 'stage' the square). Made once the places are
// known (some towns have no temple, say).
export function programme(L, ev, ids = (ev.venues || []).map((v) => v.id)) {
  const has = (k) => ids.includes(k);
  const s = ev.s;
  const e = ev.e;
  const slots = [];
  const add = (k, from, to, venues) => {
    const vs = venues.filter((v) => v === 'stage' || has(v));
    if (vs.length && to > from) slots.push({ k, from, to, venues: vs });
  };
  if (ev.kind === 'rite') {
    if (ev.rite === 'tidefeast') {
      add('fair', s - 120, s, ['stalls', 'alehouse']);
      add('feast', s, e, ['stage']);
      add('night', e, e + 90, ['alehouse']);
    } else if (ev.rite === 'fair') {
      add('feast', s, e, ['stage', 'stalls', 'green']);
      add('night', e, e + 120, ['alehouse']);
    } else {
      // The vigil, the lanterns: the faithful walk from the temple to the
      // square, and the rest of it's as it ever was.
      if (ev.rite === 'lanterns') add('fair', s - 240, s - 60, ['stalls']);
      add('procession', s - 40, s, ['shrine']);
      add('feast', s, e, ['stage']);
    }
  } else {
    add('fair', s - 330, s - 90, ['stalls', 'green', 'alehouse']);
    add('blessing', s - 300, s - 240, ['shrine']);
    add('procession', s - 50, s, ['shrine']);
    add('feast', s, e, ['stage']);
    add('night', e, e + 120, ['alehouse']);
  }
  slots.sort((a, b) => a.from - b.from);
  return slots;
}

export const slotAt = (ev, now) => (ev.prog || []).filter((q) => now >= q.from && now < q.to).sort((a, b) => b.from - a.from)[0] || null;
export const nextSlot = (ev, now) => (ev.prog || []).filter((q) => q.from > now).sort((a, b) => a.from - b.from)[0] || null;
// The day's first and last of it.
export const openOf = (ev) => (ev.prog && ev.prog.length ? Math.min(...ev.prog.map((q) => q.from)) : ev.s);
export const closeOf = (ev) => (ev.prog && ev.prog.length ? Math.max(...ev.prog.map((q) => q.to)) : ev.e);

// ------------------------------------------------------------ putting it up
// Where each place goes: near its building's door (or, the stalls, off the
// square; the green, out by a road into town), on open ground, clear of
// the stage and each other, with room round it to stand. `events` for its
// `clear`.
export function placeVenues(events, L, ev, look, palette) {
  const want = wanted(L, ev);
  const used = new Set();
  const mark = (r, pad = 1) => {
    for (let z = r.z0 - pad; z <= r.z1 + pad; z++) for (let x = r.x0 - pad; x <= r.x1 + pad; x++) used.add(x * 65536 + z);
  };
  if (ev.site) mark(ev.site, 2);
  // (Nor over the posters: they're up already.)
  for (const q of ev.posters || []) used.add(q.x * 65536 + q.z);
  const spots = new Set(L.spots.map((q) => q.x * 65536 + q.z));
  const doors = new Set();
  for (const b of L.buildings) if (b.outside) for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) doors.add((b.outside.x + dx) * 65536 + b.outside.z + dz);
  const venues = [];
  const ops = [];
  for (const id of want) {
    const anchors = anchorsFor(L, VENUES[id]);
    if (!anchors.length) continue;
    // (Its own design, else a smaller one, where there's room.)
    for (let alt = -1; alt < (VENUE_ALTS[id] || []).length; alt++) {
      const V = alt < 0 ? VENUES[id] : { ...VENUES[id], ...VENUE_ALTS[id][alt] };
      if (tryPlace(id, V, alt, anchors)) break;
    }
  }
  // (No room for stalls of the festival's own: the town's own market
  // stalls on the square, then, open for it.)
  if (want.includes('stalls') && !venues.some((v) => v.id === 'stalls')) {
    const st = L.spots.filter((q) => q.stall);
    const front = L.spots.filter((q) => q.tags && q.tags.includes('shop') && st.some((k) => Math.abs(k.x - q.x) <= 1 && Math.abs(k.z - q.z) <= 2));
    if (st.length) {
      const xs = [...st, ...front].map((q) => q.x);
      const zs = [...st, ...front].map((q) => q.z);
      venues.push({
        id: 'stalls', own: true, x0: Math.min(...xs), z0: Math.min(...zs), x1: Math.max(...xs), z1: Math.max(...zs),
        abs: { serve: st.map((q) => ({ x: q.x, z: q.z, face: q.face ?? 2 })), stand: front.map((q) => ({ x: q.x, z: q.z, face: q.face ?? 2 })) },
      });
    }
  }
  ops.sort((a, b) => a[1] - b[1]);
  return { venues, ops };

  function tryPlace(id, V, alt, anchors) {
    const tall = V.blocks.some((q) => q[1] >= 2) ? 3 : 2;
    const ow = events.game.world.ow;
    // (Round 134: each square looked at once, not once for every place the
    // venue might be tried over it.)
    const seen = new Map();
    const ok = (x, z) => {
      const k = x * 65536 + z;
      let v = seen.get(k);
      if (v === undefined) seen.set(k, (v = okNow(x, z)));
      return v;
    };
    const okNow = (x, z) => {
      if (!L.inside(x, z, 2)) return false;
      // (In the town itself, not out past its last houses.)
      if (ow.settlementAt && ow.settlementAt(x, z) !== L.settlement) return false;
      const k = x * 65536 + z;
      if (used.has(k) || spots.has(k) || doors.has(k)) return false;
      const m = L.maskAt(x, z);
      if (m !== M.PLAZA && m !== M.FREE && m !== M.YARD && m !== M.ROAD) return false;
      // (The green's open middle may take in a way across the square.)
      if (id !== 'green' && L.isLane && L.isLane(x, z)) return false;
      return events.clear(L, x, z, tall);
    };
    let best = null;
    for (const a of anchors) {
      const R = a.r;
      for (let z0 = a.z - R; z0 <= a.z + R - V.d + 1; z0++) {
        for (let x0 = a.x - R; x0 <= a.x + R - V.w + 1; x0++) {
          const cx = x0 + V.w / 2;
          const cz = z0 + V.d / 2;
          const dist = Math.hypot(cx - a.x, cz - a.z);
          if (best && dist + 0.5 >= best.score) continue;
          let good = true;
          let roads = 0;
          for (let dz = 0; dz < V.d && good; dz++) {
            for (let dx = 0; dx < V.w && good; dx++) {
              good = ok(x0 + dx, z0 + dz);
              if (good && L.maskAt(x0 + dx, z0 + dz) === M.ROAD) roads++;
            }
          }
          if (!good) continue;
          // (The green is open ground to stand and run on: it may take in a
          // bit of street, but nothing of it is set down on one.)
          if (id === 'green') {
            if (roads > 20) continue;
            if (V.blocks.some(([dx, dy, dz]) => dy === 0 && (L.maskAt(x0 + dx, z0 + dz) === M.ROAD || (L.isLane && L.isLane(x0 + dx, z0 + dz))))) continue;
          }
          // Room round it to stand (and never against the city wall).
          let room = 0;
          for (let dz = -1; dz <= V.d && good; dz++) {
            for (let dx = -1; dx <= V.w; dx++) {
              if (dz >= 0 && dz < V.d && dx >= 0 && dx < V.w) continue;
              const m = L.maskAt(x0 + dx, z0 + dz);
              if (m === M.WALL) good = false;
              else if (m !== M.WATER && m !== M.FIELD && m !== M.BUILD) room++;
            }
          }
          if (!good || room < V.w + V.d) continue;
          const score = dist + roads * (id === 'green' ? 0.6 : 1.5) + a.pen;
          if (!best || score < best.score) best = { x0, z0, score };
        }
      }
    }
    if (!best) return false;
    const r = { x0: best.x0, z0: best.z0, x1: best.x0 + V.w - 1, z1: best.z0 + V.d - 1 };
    mark(r, 2);
    venues.push({ id, ...r, by: anchors[0].bid ?? null, ...(alt >= 0 ? { alt } : {}) });
    for (const [dx, dy, dz, k, meta = 0] of dressVenue(L, V, look, palette)) ops.push([r.x0 + dx, GROUND + dy, r.z0 + dz, B[k], meta]);
    return true;
  }
}

// Where a place may go: by its building's door, off the square, or out
// by a road into town (each a radius to look in, and a little against the
// farther ones).
function anchorsFor(L, V) {
  if (V.by === 'plaza') {
    const p = L.plaza;
    const out = [];
    for (const t of ['shop', 'bakery', 'tailor', 'smithy']) {
      const b = L.buildings.find((q) => q.type === t && q.outside && !q.underConstruction);
      if (b) out.push({ x: b.outside.x, z: b.outside.z, r: 9, pen: 1, bid: b.id });
    }
    out.push({ x: p.cx, z: p.cz, r: 13, pen: 2 });
    return out;
  }
  if (V.by === 'edge') {
    const p = L.plaza;
    const out = (L.entrances || []).map((e) => ({ x: Math.round((e.x * 3 + p.cx) / 4), z: Math.round((e.z * 3 + p.cz) / 4), r: 12, pen: 0 }));
    out.push({ x: p.cx, z: p.cz, r: 26, pen: 6 });
    return out;
  }
  const b = L.buildings.find((q) => q.type === V.by && q.outside && !q.underConstruction && !q.ruined);
  return b ? [{ x: b.outside.x, z: b.outside.z, r: 10, pen: 0, bid: b.id }] : [];
}

// What goes up at a place, in the town's own way: its lights, its
// canopies in the people's colours.
function dressVenue(L, V, look, palette) {
  const s = L.settlement;
  const out = [];
  const awning = s.civ ? B[s.civ.color.awning] : B.awning_red;
  const colour = Math.max(0, [B.awning_red, B.awning_blue, B.awning_yellow, B.awning_green].indexOf(awning));
  const cs = CANOPY_STYLES[s.style] ?? CANOPY_STYLES[s.culture] ?? 0;
  for (const [dx, dy, dz, k, meta = 0] of V.blocks) {
    if (k === 'lantern') out.push([dx, dy, dz, look.light[0], look.light[1] ?? 0]);
    else if (k === 'canopy') out.push([dx, dy, dz, 'canopy', 0 | (colour << CANOPY_SHIFT) | (cs << CANOPY_STYLE_SHIFT)]);
    else if (B[k] !== undefined) out.push([dx, dy, dz, k, meta]);
  }
  void palette;
  return out;
}

// ------------------------------------------------------------ who goes where
const has = (r, t) => (r.traits || []).includes(t);
const roll = (L, ev, r, salt) => (hash4(L.settlement.seed, ev.id, r.idx, salt) % 1000) / 1000;
// Who keeps a stall (the town's traders), and who pours at the tavern.
const STALL_JOBS = new Set(['merchant', 'shopkeeper', 'baker', 'tailor', 'smith', 'herbalist', 'jeweller', 'carpenter', 'farmer', 'potter', 'glassblower', 'trader']);
const TAP_JOBS = new Set(['innkeeper', 'barkeep', 'cook']);
// Free to come in the morning: the young and the old, the idle, anyone on
// their day off (and the lazy, who take it anyway).
function freeToday(L, r, day) {
  if (r.age !== 'adult') return true;
  if (!r.job || ['beggar', 'retired', 'noble', 'none', 'unemployed'].includes(r.job)) return true;
  if (r.restDay !== undefined && day % 7 === r.restDay) return true;
  return has(r, 'lazy') || has(r, 'easygoing');
}

// Where someone would rather be of the places open (weights).
function leaning(L, ev, r, ids) {
  const w = {};
  const child = r.age === 'child';
  const elder = r.age === 'elder';
  const soc = r.personality?.sociability ?? 0.5;
  for (const id of ids) {
    if (id === 'stalls') w[id] = 1 + (has(r, 'gossipy') || has(r, 'nosy') ? 0.6 : 0) + (has(r, 'stingy') ? 0.4 : 0);
    else if (id === 'alehouse') w[id] = child ? 0 : 0.5 + (has(r, 'outgoing') || has(r, 'cheerful') ? 0.8 : 0) + (has(r, 'gruff') ? 0.4 : 0) + soc * 0.4;
    else if (id === 'green') w[id] = (child ? 1.8 : 0.4) + (has(r, 'proud') || has(r, 'hot-headed') || has(r, 'brave') ? 0.7 : 0) - (elder ? 0.3 : 0);
    else if (id === 'shrine') w[id] = 0.3 + (has(r, 'devout') ? 1.4 : 0) + (elder ? 0.6 : 0);
    else if (id === 'stage') w[id] = 0.3 + (elder ? 0.5 : 0);
  }
  return w;
}

function pickOf(w, x) {
  const ks = Object.keys(w).filter((k) => w[k] > 0);
  const tot = ks.reduce((n, k) => n + w[k], 0);
  if (!tot) return null;
  let t = x * tot;
  for (const k of ks) {
    t -= w[k];
    if (t <= 0) return k;
  }
  return ks[ks.length - 1];
}

// Each guest's day, as a list of where they'll be when (`segs`). The
// feast's place on the square is what invite gave them; the rest is
// worked out here. Shopkeepers and the tavern's staff, coming to the
// feast or not, keep the stalls and the ale tables in the morning.
export function planGuests(events, L, ev) {
  const prog = ev.prog || [];
  if (!prog.length) return;
  const venues = new Map((ev.venues || []).map((v) => [v.id, v]));
  const day = ev.day;
  const takenBy = new Map();
  const taken = (v, slot) => {
    const k = `${v}:${slot}`;
    if (!takenBy.has(k)) takenBy.set(k, new Set());
    return takenBy.get(k);
  };
  const w = events.game.world;
  const standable = (x, z) => L.inside(x, z, 1) && ![M.BUILD, M.WALL, M.WATER, M.FIELD].includes(L.maskAt(x, z)) && (!w.regionAt(x, z) || w.findStandY(x, z, GROUND) === GROUND);
  // A free place at a venue: one of its own for the role, else anywhere
  // round its edge.
  const spotAt = (vid, slotK, role) => {
    const v = venues.get(vid);
    if (!v) return null;
    const V = designOf(v);
    const T = taken(vid, slotK);
    // (The town's own stalls: their own places.)
    if (v.abs) {
      for (const q of role === 'serve' ? v.abs.serve : v.abs.stand) {
        if (T.has(q.x * 65536 + q.z) || !standable(q.x, q.z)) continue;
        T.add(q.x * 65536 + q.z);
        return { x: q.x, z: q.z, face: q.face, seat: false };
      }
    }
    const lists = role === 'serve' ? [V.serve] : role === 'lead' ? [V.lead ? [V.lead] : null, V.games ? [V.games] : null] : role === 'seat' ? [V.seats, V.stand] : role === 'line' ? [V.line, V.stand] : [V.stand, V.seats];
    for (const list of lists) {
      for (const q of list || []) {
        const x = v.x0 + q.dx;
        const z = v.z0 + q.dz;
        if (T.has(x * 65536 + z) || !standable(x, z)) continue;
        T.add(x * 65536 + z);
        return { x, z, face: q.face ?? 2, seat: list === V.seats };
      }
    }
    for (let r2 = 1; r2 <= 4; r2++) {
      for (let dz = -r2; dz <= V.d - 1 + r2; dz++) {
        for (let dx = -r2; dx <= V.w - 1 + r2; dx++) {
          if (dz > -r2 && dz < V.d - 1 + r2 && dx > -r2 && dx < V.w - 1 + r2) continue;
          const x = v.x0 + dx;
          const z = v.z0 + dz;
          if (T.has(x * 65536 + z) || !standable(x, z)) continue;
          T.add(x * 65536 + z);
          return { x, z, face: dz < 0 ? 0 : dx < 0 ? 3 : dx >= V.w ? 1 : 2, seat: false };
        }
      }
    }
    return null;
  };
  const fair = prog.find((q) => q.k === 'fair');
  const blessing = prog.find((q) => q.k === 'blessing');
  const proc = prog.find((q) => q.k === 'procession');
  const feast = prog.find((q) => q.k === 'feast');
  const night = prog.find((q) => q.k === 'night');
  const byIdx = new Map((ev.guests || []).map((g) => [g.idx, g]));
  // The procession: whoever leads the feast, and a few of the keenest to
  // walk with them, from the temple by way of the stalls to the square.
  const walkers = new Set();
  let route = null;
  if (proc) {
    const from = venues.get('shrine') || venues.get('alehouse');
    const mid = venues.get('stalls');
    const st = ev.site;
    if (from && st) {
      const c = (r) => ({ x: Math.round((r.x0 + r.x1) / 2), z: r.z1 + 1 });
      route = [c(from), ...(mid ? [c(mid)] : []), { x: Math.round((st.x0 + st.x1) / 2), z: st.z1 + 1 }];
      const host = ev.host !== null && ev.host !== undefined ? byIdx.get(ev.host) : null;
      if (host) walkers.add(host.idx);
      const keen = (ev.guests || []).map((g) => L.npcs[g.idx]).filter((r) => r && r.age === 'adult' && r.idx !== ev.host && (has(r, 'devout') || (r.personality?.sociability ?? 0) > 0.65));
      keen.sort((a, b) => roll(L, ev, a, 0x9c) - roll(L, ev, b, 0x9c));
      for (const r of keen.slice(0, 3)) walkers.add(r.idx);
    }
  }
  // The shopkeepers and the tavern's staff, to their posts in the morning.
  const keepers = new Map();
  if (fair) {
    const people = L.npcs.filter((r) => alive(r) && !r.away && !r.migrated && !r.visitor && !r.hired && r.age === 'adult');
    const sv = venues.get('stalls');
    const stallKeep = fair.venues.includes('stalls') && sv ? people.filter((r) => STALL_JOBS.has(r.job)).slice(0, sv.abs ? sv.abs.serve.length : (designOf(sv).serve || []).length) : [];
    const tapKeep = fair.venues.includes('alehouse') ? people.filter((r) => TAP_JOBS.has(r.job)).slice(0, 2) : [];
    for (const r of stallKeep) keepers.set(r.idx, 'stalls');
    for (const r of tapKeep) keepers.set(r.idx, 'alehouse');
  }
  const ensure = (r) => {
    let g = byIdx.get(r.idx);
    if (!g) {
      g = { idx: r.idx, role: 'keep', x: null, z: null, face: 2, leave: feast ? feast.from : ev.s, set: false, fairOnly: true };
      ev.guests.push(g);
      byIdx.set(r.idx, g);
    }
    return g;
  };
  for (const idx of keepers.keys()) ensure(L.npcs[idx]);
  for (const g of ev.guests) {
    const r = L.npcs[g.idx];
    if (!r || !alive(r)) continue;
    const segs = [];
    const keep = keepers.get(r.idx);
    // The morning.
    if (fair) {
      if (keep) {
        const spot = spotAt(keep, 'fair', 'serve');
        if (spot) segs.push({ k: 'fair', v: keep, from: fair.from - 20, to: fair.to, role: 'serve', ...spot });
      } else if (!g.fairOnly && (freeToday(L, r, day) || roll(L, ev, r, 0xfa) < 0.35)) {
        const ids = fair.venues.filter((v) => v !== 'stage');
        const vid = pickOf(leaning(L, ev, r, ids), roll(L, ev, r, 0xf1));
        if (vid) {
          const spot = spotAt(vid, 'fair', vid === 'alehouse' && roll(L, ev, r, 0x5e) < 0.5 ? 'seat' : 'guest');
          if (spot) {
            const from = fair.from + Math.floor(roll(L, ev, r, 0xa1) * 70);
            const to = fair.to - Math.floor(roll(L, ev, r, 0xa2) * 50);
            if (to - from >= 40) segs.push({ k: 'fair', v: vid, from, to, role: 'guest', ...spot });
          }
        }
      }
    }
    // The blessing: the devout and the old, and the priest leading it.
    if (blessing && !keep) {
      const lead = r.idx === ev.host && r.job === 'priest';
      const devout = has(r, 'devout') || r.age === 'elder' || r.job === 'priest';
      if (lead || (devout && roll(L, ev, r, 0xb1) < 0.75)) {
        const spot = spotAt('shrine', 'blessing', lead ? 'lead' : 'guest');
        if (spot) {
          // (Out of their morning for it, and back after.)
          const cut = segs.length && segs[segs.length - 1].k === 'fair' ? segs.pop() : null;
          if (cut && cut.from < blessing.from - 20) segs.push({ ...cut, to: blessing.from - 10 });
          segs.push({ k: 'blessing', v: 'shrine', from: blessing.from - 15, to: blessing.to, role: lead ? 'lead' : 'guest', ...spot });
          if (cut && cut.to > blessing.to + 30) segs.push({ ...cut, from: blessing.to + 10 });
        }
      }
    }
    // The procession, for those walking it; the feast for those coming.
    if (!g.fairOnly) {
      if (proc && route && walkers.has(r.idx)) {
        segs.push({ k: 'procession', v: null, from: proc.from - 10, to: proc.to, role: r.idx === ev.host ? 'lead' : 'carry', walk: route });
      }
      if (feast) {
        const from = segs.length && segs[segs.length - 1].k === 'procession' ? proc.to : Math.min(g.leave, feast.from - 5);
        // (A fair spread over the square, the stalls and the green: those
        // just come to look go where they'd most like to be.)
        const elsewhere = feast.venues.filter((v) => v !== 'stage');
        const vid = elsewhere.length && g.role === 'guest' ? pickOf(leaning(L, ev, r, feast.venues), roll(L, ev, r, 0xfe)) : 'stage';
        const spot = vid && vid !== 'stage' ? spotAt(vid, 'feast', 'guest') : null;
        if (spot) segs.push({ k: 'feast', v: vid, from, to: ev.e, role: 'guest', ...spot });
        else segs.push({ k: 'feast', v: 'stage', from, to: ev.e, role: g.role, x: g.x, z: g.z, face: g.face, seat: g.role === 'seat', main: true });
      }
    }
    // The night, for the thirsty and the sociable.
    if (night && !g.fairOnly && r.age === 'adult') {
      const tap = keep === 'alehouse' || TAP_JOBS.has(r.job);
      const thirsty = has(r, 'outgoing') || has(r, 'cheerful') || has(r, 'gruff') || has(r, 'lazy') || (r.personality?.sociability ?? 0.5) > 0.6;
      if (tap || (thirsty && roll(L, ev, r, 0x41) < 0.7)) {
        const spot = spotAt('alehouse', 'night', tap ? 'serve' : roll(L, ev, r, 0x42) < 0.5 ? 'seat' : 'guest');
        if (spot) segs.push({ k: 'night', v: 'alehouse', from: ev.e + 5, to: night.to - Math.floor(roll(L, ev, r, 0x43) * 50), role: tap ? 'serve' : 'guest', ...spot });
      }
    }
    segs.sort((a, b) => a.from - b.from);
    if (!segs.length) continue;
    g.segs = segs;
    g.leave = Math.min(g.leave, segs[0].from);
    g.until = Math.max(...segs.map((q) => q.to));
  }
  // (A keeper of the morning with nowhere to be: off the list again.)
  ev.guests = ev.guests.filter((g) => !g.fairOnly || (g.segs && g.segs.length));
}

// Of someone's day, where they are (or are next to be) now.
export function segNow(segs, now) {
  if (!segs || !segs.length) return null;
  let cur = null;
  for (const q of segs) if (now >= q.from && now < q.to && (!cur || q.from >= cur.from)) cur = q;
  if (cur) return cur;
  for (const q of segs) if (q.from > now) return q;
  return segs[segs.length - 1];
}

// ------------------------------------------------------------ the rain
// Wet enough to send the do indoors.
export function wetNow(game) {
  const w = game.weather;
  return !!w && (w.kind === 'rain' || w.kind === 'snow') && (w.level ?? 1) > 0.35;
}

// Somewhere under a roof for someone at a place (its own shelter: the
// tavern, the temple, the hall; else whichever there is).
export function shelterFor(L, vid, idx) {
  const kinds = [VENUES[vid] ? VENUES[vid].shelter : 'tavern', 'tavern', 'townhall', 'temple'];
  for (const t of kinds) {
    const b = L.buildings.find((q) => q.type === t && !q.underConstruction && !q.ruined && q.free && q.free.length);
    if (b) {
      const q = b.free[hash4(idx, b.id, 0x5e17) % b.free.length];
      return { x: q.x, z: q.z, building: b.id };
    }
  }
  return null;
}

// ------------------------------------------------------------ in the town
// The do on today in a town (its programme running, or about to).
export function dayOf(L, now) {
  for (const ev of (L.econ && L.econ.events) || []) {
    if (!festive(ev) || !ev.prog || ev.state === 'off' || ev.state === 'done') continue;
    if (now >= openOf(ev) - 60 && now < closeOf(ev)) return ev;
  }
  return null;
}

// What's on now and next, for the corner of the screen.
export function hudLines(events, L, now) {
  const ev = dayOf(L, now);
  if (!ev) return [];
  const cur = slotAt(ev, now);
  const nx = nextSlot(ev, now);
  const out = [];
  const hm = (m) => `${String(Math.floor((m % DAY) / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  const where = (q) => (q.venues.length > 1 ? 'round the town' : q.venues[0] === 'stage' ? STAGE.at : VENUES[q.venues[0]].at);
  if (cur) out.push({ text: `FESTIVAL · ${SLOT_SHORT[cur.k]}`, color: '#ffd0e8' });
  else out.push({ text: 'FESTIVAL DAY', color: '#ffd0e8' });
  if (cur) out.push({ text: `  ${where(cur)}`, color: '#e8c0d8' });
  if (nx) out.push({ text: `  ${hm(nx.from)} ${SLOT_SHORT[nx.k].toLowerCase()}`, color: '#b898b0' });
  if (ev.wet) out.push({ text: '  (rain: all indoors)', color: '#a0c8ff' });
  return out;
}

// The places, for the little map: where each is, its colour, and whether
// it's where things are happening now.
export function marks(L, now) {
  const ev = dayOf(L, now);
  if (!ev) return [];
  const cur = slotAt(ev, now);
  const on = new Set(cur ? cur.venues : []);
  const out = [];
  if (ev.site) out.push({ x: Math.round((ev.site.x0 + ev.site.x1) / 2), z: Math.round((ev.site.z0 + ev.site.z1) / 2), c: STAGE.color, now: on.has('stage') });
  for (const v of ev.venues || []) out.push({ x: Math.round((v.x0 + v.x1) / 2), z: Math.round((v.z0 + v.z1) / 2), c: VENUES[v.id].color, now: on.has(v.id) });
  return out;
}

// The programme as the posters set it out.
export function posterLines(ev) {
  const hm = (m) => `${String(Math.floor((m % DAY) / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  const out = [];
  for (const q of ev.prog || []) {
    const where = q.venues.map((v) => (v === 'stage' ? 'the square' : VENUES[v].name.replace(/^the /, ''))).join(', ');
    out.push(`${hm(q.from)} ${SLOT_WORDS[q.k]}${q.k === 'feast' ? '' : `: ${where}`}`);
  }
  return out;
}

// Said of where someone is, at a festival (see dialogue.js).
export function segLine(seg, rng, town) {
  if (!seg) return null;
  if (seg.k === 'procession') return seg.role === 'lead' ? 'We walk from the temple to the square. Fall in behind!' : 'We walk with the procession. Come along!';
  if (seg.v === 'alehouse') return seg.role === 'serve' ? 'Pouring all day for the festival. What\'ll it be?' : rng.pick(['A drink for the festival! Pull up a bench.', `To ${town}! And another.`, 'The ale\'s flowing today.']);
  if (seg.v === 'stalls') return seg.role === 'serve' ? rng.pick(['Festival prices today! Come and look.', 'Best goods in town, and today they\'re cheaper.']) : rng.pick(['Just looking at the stalls.', 'Have you seen what they\'ve got on the stalls?']);
  if (seg.v === 'shrine') return seg.role === 'lead' ? 'Come and be blessed, for the festival.' : 'Waiting for the blessing.';
  if (seg.v === 'green') return rng.pick(['Watching the games on the green!', 'Are you going to have a go?']);
  return null;
}

// Small talk at a place.
export function chatterAt(seg, child) {
  if (!seg) return null;
  if (seg.k === 'procession') return seg.role === 'lead' ? null : ['Make way!', 'To the square!', 'Mind the banner!'];
  if (seg.v === 'alehouse') return seg.role === 'serve' ? ['Who\'s next?', 'Mind the foam!', 'On the house, for the festival. Just this once.'] : child ? null : ['Cheers!', 'Another round!', 'To the festival!', 'Who\'s singing?', 'Best ale all year.'];
  if (seg.v === 'stalls') return seg.role === 'serve' ? ['Festival prices!', 'Come and see!', 'Fresh today!', 'Two for one, and that\'s robbery.'] : ['Ooh, look at that.', 'How much?', 'I\'ll take two.', 'Too dear.'];
  if (seg.v === 'shrine') return seg.role === 'lead' ? ['Blessings on you all.', 'Come forward, come forward.'] : ['*prays*', 'Bless us.', 'Shh.'];
  if (seg.v === 'green') return child ? ['Again! Again!', 'My turn!', 'I can run faster than you!'] : ['Good shot!', 'Ha! Missed!', 'Go on, go on!'];
  return null;
}

// Whether a place is under the sky.
export const outdoors = (vid) => vid === 'stage' || vid === 'stalls' || vid === 'green' || vid === 'shrine' || vid === 'alehouse' || vid === null;

void BLOCKS;
