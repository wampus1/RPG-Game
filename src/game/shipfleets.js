// The realms' fleets (round 68): the peoples who've learnt to build great
// ships (see sim/tech.js: trade ships, and the far peoples' own longships,
// galleys and sea lore) send them out across the open sea between the
// islands and the continents: merchantmen with their holds full and their
// merchants aboard, settlers bound for a new shore, troopships and
// men-of-war packed with marines for an enemy's coast, hulks hauling
// timber and stone. The Dagoni Islands' peoples keep to their own waters
// while the storm wall stands round them; once it's down, they sail out
// into the world with the rest, and the world sails in.
//   A voyage is kept as a line across the sea (from the sea off one port
// to the sea off another, round the land) and where along it she is by
// now; wherever you are, the ones passing near enough are real ships (see
// ships3d.js), sailing by under their colours with their crews on deck,
// and coming to anchor off the port they were bound for. Away from you,
// on they go, and arrive, and what they carried comes ashore: coin and
// goods, settlers, war.
import { REGION_W, REGION_D, MAP_W, MAP_H } from '../config.js';
import { DAY, ledger } from '../sim/econ.js';
import { hash4, RNG } from '../util/rng.js';
import { addShip, shipsOf, shipById, waterSpot } from './ships3d.js';
import { makeCrew, crewOf } from './shipcrew.js';
import { SHIP_TYPES } from '../world/shipmodels.js';

const NEAR = 110;
const FAR = 170;
// (How far a ship goes in a minute of the world's time, on average: her
// sailing speed less the time lost to the wind.)
const PACE = 0.55;

export const FLEET_KINDS = {
  trade: { name: 'merchantman', crew: ['captain', 'mate', 'sailor', 'sailor', 'merchant', 'merchant', 'merchant'] },
  settlers: { name: 'settler ship', crew: ['captain', 'mate', 'sailor', 'passenger', 'passenger', 'passenger', 'passenger'] },
  war: { name: 'man-of-war', crew: ['captain', 'mate', 'gunner', 'gunner', 'gunner', 'marine', 'marine', 'marine', 'marine'] },
  cargo: { name: 'cargo hulk', crew: ['captain', 'sailor', 'sailor', 'sailor'] },
};

// Can this realm send ships across the open sea, and of what kinds?
export function navalOf(game, civ) {
  const T = game.sim && game.sim.tech;
  if (!T || !civ) return null;
  const has = (k) => T.has(civ, k);
  const trade = has('trade_ships');
  const longships = has('r_longships');
  const galleys = has('s_galleys');
  const lore = has('c_sea_lore');
  if (!trade && !longships && !galleys && !lore) return null;
  const warlike = has('steel') || has('fortress') || has('fieldworks') || longships;
  return {
    merchant: trade || lore ? (civ.empire ? 'galleon' : 'brigantine') : 'sloop',
    war: trade && warlike ? 'frigate' : longships || galleys ? 'brigantine' : trade ? 'brigantine' : 'sloop',
    big: trade && (civ.empire || has('v_forum')) ? 'galleon' : 'brigantine',
  };
}

function fleetState(game) {
  return (game.fleets ||= { voyages: [], next: 0, seq: 1 });
}

// The open-sea square nearest a port (its own, if it's on the coast).
function seaOff(ow, s) {
  for (let r = 0; r <= 6; r++) {
    for (let dz = -r; dz <= r; dz++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
        const c = ow.cell(s.cx + dx, s.cz + dz);
        if (c && c.biome === 'ocean') return { cx: c.cx, cz: c.cz };
      }
    }
  }
  return null;
}

// The way across open sea between two squares of it (squares in turn), or
// null: round the land, and (while the wall stands) never through the
// storm round the islands.
export function seaRoute(game, a, b) {
  const ow = game.world.ow;
  const cache = (game.seaRoutes ||= new Map());
  const k = `${a.cx},${a.cz}>${b.cx},${b.cz}|${ow.wallDown ? 1 : 0}`;
  if (cache.has(k)) return cache.get(k);
  const open = (cx, cz) => {
    const c = ow.cell(cx, cz);
    if (!c || c.biome !== 'ocean') return false;
    if (!ow.wallDown && ow.stormAt((cx + 0.5) * REGION_W, (cz + 0.5) * REGION_D) > 0.05) return false;
    return true;
  };
  const key = (x, z) => z * MAP_W + x;
  const g = new Map([[key(a.cx, a.cz), 0]]);
  const prev = new Map();
  // (A binary heap of [f, x, z].)
  const heap = [];
  const push = (q) => {
    heap.push(q);
    let i = heap.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (heap[p][0] <= heap[i][0]) break;
      [heap[p], heap[i]] = [heap[i], heap[p]];
      i = p;
    }
  };
  const pop = () => {
    const top = heap[0];
    const last = heap.pop();
    if (heap.length) {
      heap[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
        if (m === i) break;
        [heap[m], heap[i]] = [heap[i], heap[m]];
        i = m;
      }
    }
    return top;
  };
  push([Math.hypot(b.cx - a.cx, b.cz - a.cz), a.cx, a.cz]);
  let found = false;
  let n = 0;
  while (heap.length && n < 60000) {
    const [, x, z] = pop();
    n++;
    if (x === b.cx && z === b.cz) {
      found = true;
      break;
    }
    const gc = g.get(key(x, z));
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dz) continue;
      const nx = x + dx;
      const nz = z + dz;
      if (nx < 0 || nz < 0 || nx >= MAP_W || nz >= MAP_H) continue;
      if (!open(nx, nz) && !(nx === b.cx && nz === b.cz)) continue;
      // (No cutting a corner of land.)
      if (dx && dz && (!open(x + dx, z) || !open(x, z + dz))) continue;
      const nk = key(nx, nz);
      const ng = gc + (dx && dz ? 1.414 : 1);
      if (g.has(nk) && g.get(nk) <= ng) continue;
      g.set(nk, ng);
      prev.set(nk, [x, z]);
      push([ng + Math.hypot(b.cx - nx, b.cz - nz) * 1.05, nx, nz]);
    }
  }
  let route = null;
  if (found) {
    const cells = [];
    for (let c = [b.cx, b.cz]; c; c = prev.get(key(c[0], c[1]))) cells.push(c);
    cells.reverse();
    // (A point every square or two, in paces.)
    route = cells.filter((_, i) => i % 2 === 0 || i === cells.length - 1).map(([x, z]) => ({ x: Math.round((x + 0.5) * REGION_W), z: Math.round((z + 0.5) * REGION_D) }));
  }
  cache.set(k, route);
  if (cache.size > 400) cache.delete(cache.keys().next().value);
  return route;
}

function routeLen(route) {
  let d = 0;
  for (let i = 1; i < route.length; i++) d += Math.hypot(route[i].x - route[i - 1].x, route[i].z - route[i - 1].z);
  return d;
}

// Where along her route a voyage is `d` paces out: { x, z, i (the leg) }.
function along(route, d) {
  for (let i = 1; i < route.length; i++) {
    const L = Math.hypot(route[i].x - route[i - 1].x, route[i].z - route[i - 1].z);
    if (d <= L) {
      const k = L ? d / L : 0;
      return { x: route[i - 1].x + (route[i].x - route[i - 1].x) * k, z: route[i - 1].z + (route[i].z - route[i - 1].z) * k, i };
    }
    d -= L;
  }
  const e = route[route.length - 1];
  return { x: e.x, z: e.z, i: route.length - 1 };
}

// The nearest point along her route to (x, z), as paces out.
function nearestAlong(route, x, z) {
  let best = 0;
  let bd = Infinity;
  let acc = 0;
  for (let i = 1; i < route.length; i++) {
    const a = route[i - 1];
    const b = route[i];
    const L = Math.hypot(b.x - a.x, b.z - a.z) || 1;
    const t = Math.max(0, Math.min(1, ((x - a.x) * (b.x - a.x) + (z - a.z) * (b.z - a.z)) / (L * L)));
    const px = a.x + (b.x - a.x) * t;
    const pz = a.z + (b.z - a.z) * t;
    const d = Math.hypot(px - x, pz - z);
    if (d < bd) {
      bd = d;
      best = acc + t * L;
    }
    acc += L;
  }
  return best;
}

// Each frame (most of it every few seconds): new voyages put out, the ones
// near any of you made real, the ones gone far made a line on the sea
// again, arrivals.
export function fleetsTick(game, dt) {
  if (game.remote || !game.sim || game.skipping) return;
  const F = fleetState(game);
  const now = game.sim.abs;
  F.tickT = (F.tickT || 0) - dt;
  if (F.tickT > 0) return;
  F.tickT = 1;
  if (now >= F.next) {
    F.next = now + 45;
    dispatch(game, F, now);
  }
  for (const v of [...F.voyages]) {
    const S = v.ship !== null && v.ship !== undefined ? shipById(game, v.ship) : null;
    if (v.ship !== null && v.ship !== undefined && !S) {
      // (Gone down, or gone.)
      end(game, F, v, now, 'lost');
      continue;
    }
    if (S) {
      v.at = nearestAlong(v.route, S.x, S.z);
      v.atT = now;
      // Arrived: at anchor off the port.
      if (!S.route || !S.route.length) {
        if (Math.abs(S.v) < 0.6) {
          v.anchoredT = (v.anchoredT || 0) + 1;
          if (v.anchoredT > 25) end(game, F, v, now, 'arrived');
        }
      } else if (!nearAny(game, S.x, S.z, FAR)) {
        // Out of sight of all of you: a line on the sea again.
        unmake(game, v, S);
      }
      continue;
    }
    const d = v.at + (now - v.atT) * v.pace;
    if (d >= v.len) {
      end(game, F, v, now, 'arrived');
      continue;
    }
    const pos = along(v.route, d);
    if (nearAny(game, pos.x, pos.z, NEAR)) make(game, v, pos, d);
  }
}

function nearAny(game, x, z, r) {
  for (const q of game.everyone ? game.everyone() : [game.player]) if (q && !q.limbo && Math.hypot(q.x - x, q.z - z) < r) return true;
  return false;
}

// New voyages: each realm that can, now and then, from one of its ports to
// a port on another land.
function dispatch(game, F, now) {
  const ow = game.world.ow;
  const sim = game.sim;
  if (F.voyages.length >= 40) return;
  const rng = new RNG(hash4(Math.floor(now), game.seed >>> 0, 0xf1ee7));
  const ports = ow.settlements.filter((s) => s.coast && !s.deserted && s.condition !== 'abandoned' && s.civ);
  const civs = [...new Set(ports.map((s) => s.civ))];
  const why = (F.whys ||= {});
  const no = (k) => {
    why[k] = (why[k] || 0) + 1;
  };
  for (const civ of civs) {
    if (!rng.chance(0.15)) continue;
    const nav = navalOf(game, civ);
    if (!nav) {
      no('no ships');
      continue;
    }
    const mine = ports.filter((s) => s.civ === civ);
    if (!mine.length) continue;
    if (F.voyages.filter((v) => v.civ === civ.id).length >= 2 + Math.min(3, Math.floor(mine.length / 2))) {
      no('busy');
      continue;
    }
    const from = rng.pick(mine);
    // (The islands' peoples, inside the storm: not till the wall's down.)
    const inside = (s) => ow.insideStorm((s.cx + 0.5) * REGION_W, (s.cz + 0.5) * REGION_D);
    if (!ow.wallDown && inside(from)) {
      no('storm');
      continue;
    }
    const away = ports.filter((s) => s.island !== from.island && (ow.wallDown || !inside(s)) && Math.hypot(s.cx - from.cx, s.cz - from.cz) < 140);
    if (!away.length) {
      no('nowhere');
      continue;
    }
    // What for: war on an enemy's coast, if there's a war; else trade
    // (most), settlers, cargo.
    const enemy = away.filter((s) => sim.war && sim.war.enemies(civ, s.civ));
    let kind;
    let to;
    if (enemy.length && rng.chance(0.6)) {
      kind = 'war';
      to = rng.pick(enemy);
    } else {
      const friendly = away.filter((s) => !(sim.war && sim.war.enemies(civ, s.civ)) && sim.realms && sim.realms.standing(civ, s.civ) !== 'hostile');
      if (!friendly.length) {
        no('unfriendly');
        continue;
      }
      to = rng.weighted(friendly.map((s) => [s, s.civ === civ ? 1.6 : sim.realms.standing(civ, s.civ) === 'friendly' ? 1.4 : 1]));
      kind = rng.weighted([['trade', 6], ['settlers', 1.5], ['cargo', 2.5]]);
    }
    if (!voyage(game, F, now, rng, civ, from, to, kind, nav)) no('no route');
  }
}

// A voyage begun: a ship of `civ`'s sailing from port `from` to port `to`
// on an errand of `kind` (the ship as the realm's means allow: `nav`). The
// voyage, or null if there's no way across.
function voyage(game, F, now, rng, civ, from, to, kind, nav) {
  const ow = game.world.ow;
  const a = seaOff(ow, from);
  const b = seaOff(ow, to);
  if (!a || !b) return null;
  const route = seaRoute(game, a, b);
  if (!route || route.length < 2) return null;
  const type = kind === 'war' ? nav.war : kind === 'trade' ? nav.merchant : nav.big;
  const len = routeLen(route);
  const pace = SHIP_TYPES[type].speed * PACE;
  const v = {
    id: F.seq++, civ: civ.id, from: from.id, to: to.id, kind, type, route, len, pace, at: 0, atT: now, depart: now, ship: null,
    name: shipName(rng, civ, kind), seed: rng.int(0, 1e9),
  };
  F.voyages.push(v);
  const L = game.sim.layoutOf(from.id);
  if (L && L.econ) ledger(L, Math.floor(now / DAY), `The ${v.name}, a ${FLEET_KINDS[kind].name}, has sailed for ${to.name}${kind === 'war' ? ', her decks crowded with marines' : kind === 'settlers' ? ', settlers aboard' : ''}.`);
  return v;
}

// (Round 68) Ships sent on purpose (a mod's story, say): from the port of
// town `from` to the port of town `to`, on an errand of `kind`. `any`:
// even a realm without the learning (sloops, then). The voyage, or null.
export function sendVoyage(game, from, to, kind, { any = false } = {}) {
  if (!game.sim || !from || !to || !from.civ || !FLEET_KINDS[kind]) return null;
  const nav = navalOf(game, from.civ) || (any ? { merchant: 'sloop', war: 'brigantine', big: 'brigantine' } : null);
  if (!nav) return null;
  const F = fleetState(game);
  const now = game.sim.abs;
  return voyage(game, F, now, new RNG(hash4(Math.floor(now), from.id, to.id, F.seq)), from.civ, from, to, kind, nav);
}

// The ports a voyage could be sent from or to (towns on the coast, lived in).
export function ports(game) {
  const ow = game.world.ow;
  return ow.settlements.filter((s) => s.coast && !s.deserted && s.condition !== 'abandoned' && s.civ);
}

const NAMES = ['Sea Wolf', 'Constant', 'Valour', 'Dauntless', 'Fair Venture', 'Golden Hind', 'Endeavour', 'Swift', 'Resolute', 'Triumph', 'Bounty', 'Merchant Royal', 'Good Hope', 'Hawk', 'Unicorn', 'Thunderer', 'Defiance', 'Prosperous', 'Seahorse', 'Star of the East'];
function shipName(rng, civ, kind) {
  const n = rng.pick(NAMES);
  return kind === 'war' && rng.chance(0.4) ? `${civ.name.replace(/^The /, '').split(' ').pop()}'s ${n}` : n;
}

// Made real where she is, sailing on along her route.
function make(game, v, pos, d) {
  const ow = game.world.ow;
  const civ = ow.civs.find((c) => c.id === v.civ) || null;
  game.loadAround?.(Math.round(pos.x), Math.round(pos.z), false);
  const at = waterSpot(game, v.type, Math.round(pos.x), Math.round(pos.z), 0, 44, false);
  if (!at || Math.hypot(at.x - pos.x, at.z - pos.z) > 40) {
    v.at = d;
    v.atT = game.sim.abs;
    return null;
  }
  const next = v.route[Math.min(v.route.length - 1, pos.i)];
  const yaw = Math.atan2(next.x - at.x, next.z - at.z);
  const col = civ ? civ.color.hex : '#7a7a7a';
  const roles = FLEET_KINDS[v.kind].crew;
  const crew = makeCrew(v.seed, v.type, (civ && civ.style) || 'vale', roles.length, v.civ).map((r, i) => ({ ...r, role: roles[i] }));
  const S = addShip(game, {
    type: v.type, x: at.x, z: at.z, yaw, name: `The ${v.name}`, civ: v.civ, paint: col, paint2: '#1a1816', flag: col, emblem: v.kind === 'war' ? 'cross' : civ && civ.empire ? 'disc' : 'stripe',
    anchor: false, sailSet: 0.9, crew, ammo: 999,
  });
  S.transient = true;
  S.voyage = v.id;
  S.sailGoal = 1;
  S.stores = 200;
  // (Her way on from here; at the end, in toward the port.)
  S.route = v.route.slice(pos.i).map((q) => ({ ...q }));
  S.mission = { moor: true };
  v.ship = S.id;
  v.anchoredT = 0;
  return S;
}

function unmake(game, v, S) {
  for (const c of crewOf(game, S)) game.removeOcc?.(c);
  game.sailors = (game.sailors || []).filter((c) => c.shipId !== S.id);
  if (S.hold) return;
  const list = shipsOf(game);
  const i = list.indexOf(S);
  if (i >= 0) list.splice(i, 1);
  v.ship = null;
}

// The end of a voyage: what she carried ashore (or lost with her).
function end(game, F, v, now, how) {
  F.voyages = F.voyages.filter((q) => q !== v);
  const S = v.ship !== null && v.ship !== undefined ? shipById(game, v.ship) : null;
  // (Still in sight, at anchor: she stays a while, then she's gone.)
  if (S) {
    S.voyage = null;
    S.leaveT = 120;
  }
  const sim = game.sim;
  const ow = game.world.ow;
  const from = ow.settlements[v.from];
  const to = ow.settlements[v.to];
  const day = Math.floor(now / DAY);
  const TL = to ? sim.layoutOf(to.id) : null;
  const FL = from ? sim.layoutOf(from.id) : null;
  if (how === 'lost') {
    if (FL && FL.econ) ledger(FL, day, `The ${v.name} is lost at sea, bound for ${to ? to.name : 'abroad'}, with all hands.`);
    return;
  }
  const rng = new RNG(hash4(v.id, v.seed, 0xa11));
  if (v.kind === 'trade' || v.kind === 'cargo') {
    const gain = Math.round((v.kind === 'trade' ? 90 : 60) + v.len / 60 + rng.int(0, 40));
    if (FL && FL.econ) FL.econ.treasury += gain;
    if (TL && TL.econ) TL.econ.treasury += Math.round(gain * 0.4);
    if (from && to && sim.realms) sim.realms.noteTrade(from, to, gain);
    if (TL && TL.econ) ledger(TL, day, `The ${v.name} came in from ${from ? from.name : 'over the sea'} ${v.kind === 'trade' ? 'with her merchants and their wares' : 'deep laden with timber, stone and iron'}.`);
  } else if (v.kind === 'settlers') {
    if (TL && TL.econ) ledger(TL, day, `The ${v.name} put settlers ashore from ${from ? from.name : 'over the sea'}, come to make a new life here.`);
    if (from && to && sim.realms) sim.realms.noteTrade(from, to, 30);
  } else if (v.kind === 'war') {
    const enemies = sim.war && from && to && sim.war.enemies(from.civ, to.civ);
    if (enemies && TL && TL.econ) {
      const loot = Math.min(Math.round(TL.econ.treasury * 0.15), 160);
      TL.econ.treasury -= loot;
      if (FL && FL.econ) FL.econ.treasury += loot;
      ledger(TL, day, `The ${v.name}, a man-of-war of the ${from.civ.name.replace(/^The /, '')}, stood off the harbour and bombarded it; her marines came ashore and carried off ¤${loot}.`);
      // (In sight of you: her guns run out at the shore.)
      if (S) S.fight = { x: (to.bounds.x0 + to.bounds.x1) / 2, z: (to.bounds.z0 + to.bounds.z1) / 2 };
    } else if (TL && TL.econ) ledger(TL, day, `The ${v.name}, a man-of-war, called at the harbour and sailed again.`);
  }
}

// Ships whose voyage is over, in sight still: at anchor a while, then off
// out of sight (and gone).
export function idleShipsTick(game, dt) {
  for (const S of [...shipsOf(game)]) {
    if (!(S.leaveT > 0)) continue;
    S.leaveT -= dt;
    if (S.leaveT <= 0 || !nearAny(game, S.x, S.z, FAR)) {
      if (S.fight && S.fight.x !== undefined) S.fight = null;
      if (nearAny(game, S.x, S.z, FAR) && S.leaveT > -60) {
        // (Off again, out to sea.)
        if (!S.route || !S.route.length) S.route = [{ x: S.x + Math.sin(S.yaw) * 200, z: S.z + Math.cos(S.yaw) * 200 }];
        S.anchor = false;
        continue;
      }
      for (const c of crewOf(game, S)) game.removeOcc?.(c);
      game.sailors = (game.sailors || []).filter((c) => c.shipId !== S.id);
      if (S.hold) continue;
      const list = shipsOf(game);
      const i = list.indexOf(S);
      if (i >= 0) list.splice(i, 1);
    }
  }
}

// Saved with the world.
export function fleetsSave(game) {
  const F = game.fleets;
  if (!F) return null;
  return { next: F.next, seq: F.seq, voyages: F.voyages.map((v) => ({ ...v, ship: null })) };
}

export function fleetsLoad(game, d) {
  game.fleets = d ? { voyages: d.voyages || [], next: d.next || 0, seq: d.seq || 1 } : null;
}

// The voyages under way (for the world map: where each is now).
export function voyagesNow(game) {
  const F = game.fleets;
  if (!F) return [];
  const now = game.sim.abs;
  return F.voyages.map((v) => {
    const S = v.ship !== null && v.ship !== undefined ? shipById(game, v.ship) : null;
    const pos = S ? { x: S.x, z: S.z } : along(v.route, Math.min(v.len, v.at + (now - v.atT) * v.pace));
    return { x: pos.x, z: pos.z, kind: v.kind, civ: v.civ, name: v.name, type: v.type };
  });
}
