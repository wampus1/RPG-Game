// What a story can be about, as plain data (it's saved, and it may outlive
// the thing itself): a townsperson, a band of outlaws or one of them, an
// adventurer, someone playing, a town, a realm, a place out in the wilds,
// a beast or an outlaw the stories have made a name of. Each can be looked
// up again (if it's still about), named, and found on the map.
import { REGION_W, REGION_D } from '../../config.js';
import { alive as recAlive } from '../econ.js';
import { seatField } from '../../game/party.js';

export const R = {
  rec: (sid, idx) => ({ t: 'rec', sid, idx }),
  band: (id) => ({ t: 'band', id }),
  bandit: (band, m) => ({ t: 'bandit', band, m }),
  adv: (id) => ({ t: 'adv', id }),
  pl: (pid) => ({ t: 'pl', pid }),
  town: (sid) => ({ t: 'town', sid }),
  civ: (id) => ({ t: 'civ', id }),
  place: (x, z, label = null) => ({ t: 'place', x: Math.round(x), z: Math.round(z), label }),
  // (Kept by the stories themselves: see Saga.named and Saga.dens.)
  named: (key) => ({ t: 'named', key }),
  den: (key) => ({ t: 'den', key }),
  // (Another story: a captive's, a feud's.)
  thread: (id) => ({ t: 'thread', id }),
};

export function refKey(r) {
  if (!r) return '';
  switch (r.t) {
    case 'rec': return `rec:${r.sid}:${r.idx}`;
    case 'band': return `band:${r.id}`;
    case 'bandit': return `bandit:${r.band}:${r.m}`;
    case 'adv': return `adv:${r.id}`;
    case 'pl': return `pl:${r.pid}`;
    case 'town': return `town:${r.sid}`;
    case 'civ': return `civ:${r.id}`;
    case 'place': return `place:${r.x},${r.z}`;
    case 'named': return `named:${r.key}`;
    case 'den': return `den:${r.key}`;
    case 'thread': return `thread:${r.id}`;
    default: return `?:${JSON.stringify(r)}`;
  }
}

export const sameRef = (a, b) => !!a && !!b && refKey(a) === refKey(b);

// Who's playing, as the stories know them: the world's own player (the
// host, or the only one) is 'host'; anyone who joins, by their account.
export function pidOf(p) {
  if (!p) return null;
  if (p.seat) return p.seat.host ? 'host' : String(p.seat.id);
  return 'host';
}

export function seatOfPid(game, pid) {
  if (!game.seats) return null;
  return game.seats.find((s) => (s.host ? 'host' : String(s.id)) === pid) || null;
}

// The player with this id, if they're in the world now.
export function playerOf(game, pid) {
  if (!game.seats) return pid === 'host' ? game.player : null;
  const s = seatOfPid(game, pid);
  if (!s) return null;
  return s === game.seat ? game.player : s.ent;
}

export function playerName(game, pid, S = null) {
  const seat = seatOfPid(game, pid);
  if (seat) return seatField(game, seat, 'playerName') || seat.name;
  if (pid === 'host' && !game.seats) return game.playerName || 'the Wanderer';
  const known = S && S.people[pid];
  return (known && known.name) || 'a wanderer';
}

// The thing itself, if it's still about (null if not).
export function resolve(S, r) {
  if (!r) return null;
  const g = S.game;
  const sim = S.sim;
  switch (r.t) {
    case 'rec': {
      const L = g.world.layouts.get(r.sid);
      return (L && L.npcs[r.idx]) || null;
    }
    case 'band': return sim.bandits.get(r.id);
    case 'bandit': {
      const b = sim.bandits.get(r.band);
      return b ? b.members.find((m) => m.id === r.m) || null : null;
    }
    case 'adv': return sim.adventurers.get(r.id);
    case 'pl': return playerOf(g, r.pid);
    case 'town': return g.world.ow.settlements[r.sid] || null;
    case 'civ': return g.world.ow.civs[r.id] || (sim.realms.extraCivs || []).find((c) => c.id === r.id) || null;
    case 'place': return r;
    case 'named': return S.named[r.key] || null;
    case 'den': return S.dens[r.key] || null;
    case 'thread': return S.thread(r.id);
    default: return null;
  }
}

// Still alive (still about, for a place or a town)?
export function isAlive(S, r) {
  const o = resolve(S, r);
  if (!o) return r && r.t === 'pl' ? !!S.people[r.pid] : false;
  switch (r.t) {
    case 'rec': return recAlive(o);
    case 'band': return !o.done && o.members.length > 0;
    case 'bandit': return o.hp > 0;
    case 'adv': return !o.dead;
    case 'pl': return true;
    case 'town': return !o.deserted && o.condition !== 'abandoned';
    case 'named': return !o.dead;
    case 'den': return !o.cleared;
    case 'thread': return !o.done;
    default: return true;
  }
}

const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
// A name's own: "the Grey Crows'", "Kestrel's".
export const poss = (n) => (/s$/.test(n || '') ? `${n}'` : `${n}'s`);

// What they're called (in the middle of a sentence).
export function nameOf(S, r, { full = true } = {}) {
  if (!r) return 'someone';
  const o = resolve(S, r);
  switch (r.t) {
    case 'rec': return o ? (full ? `${o.name.first} ${o.name.last}` : o.name.first) : r.name || 'someone';
    case 'band': return o ? o.name : r.name || 'the outlaws';
    case 'bandit': return o ? (full ? `${o.name.first} ${o.name.last}` : o.name.first) : r.name || 'an outlaw';
    case 'adv': return o ? (full ? `${o.name.first} ${o.name.last}` : o.name.first) : 'an adventurer';
    case 'pl': return playerName(S.game, r.pid, S);
    case 'town': return o ? o.name : 'a town';
    case 'civ': return o ? o.name.replace(/^The /, 'the ') : 'a realm';
    case 'place': return r.label || 'a place in the wilds';
    case 'named': return o ? (full && o.title ? `${o.name}, ${o.title}` : o.name) : 'someone';
    case 'den': return o ? o.name : 'a den';
    case 'thread': return o ? o.title : 'a story';
    default: return 'something';
  }
}
export const NameOf = (S, r, o) => cap(nameOf(S, r, o));

// The middle of a town, in tiles.
export function townMid(s) {
  if (!s) return null;
  if (s.bounds) return { x: Math.round((s.bounds.x0 + s.bounds.x1) / 2), z: Math.round((s.bounds.z0 + s.bounds.z1) / 2) };
  return { x: Math.round((s.cx + 0.5) * REGION_W), z: Math.round((s.cz + 0.5) * REGION_D) };
}

// Where it is now, in tiles (null if nowhere in particular).
export function whereOf(S, r) {
  if (!r) return null;
  const o = resolve(S, r);
  switch (r.t) {
    case 'rec': {
      if (!o) return null;
      if (o.ent && !o.ent.dead) return { x: o.ent.x, z: o.ent.z };
      return townMid(S.game.world.ow.settlements[r.sid]);
    }
    case 'band': return o && o.camp ? { x: o.camp.x, z: o.camp.z } : null;
    case 'bandit': {
      const b = S.sim.bandits.get(r.band);
      return b && b.camp ? { x: b.camp.x, z: b.camp.z } : null;
    }
    case 'adv': {
      if (!o) return null;
      const e = S.sim.adventurers.ents.get(o.id);
      if (e && !e.dead) return { x: e.x, z: e.z };
      return townMid(S.game.world.ow.settlements[o.at ?? o.dest]);
    }
    case 'pl': {
      const p = o;
      if (p) return { x: p.x, z: p.z };
      const k = S.people[r.pid];
      return k && k.last ? { x: k.last.x, z: k.last.z } : null;
    }
    case 'town': return townMid(o);
    case 'civ': {
      const cap0 = o && S.sim.realms.capitalOf ? S.sim.realms.capitalOf(o) : null;
      return townMid(cap0);
    }
    case 'place': return { x: r.x, z: r.z };
    case 'named': return o && o.at ? { x: o.at.x, z: o.at.z } : null;
    case 'den': return o ? { x: o.x, z: o.z } : null;
    case 'thread': return null;
    default: return null;
  }
}

// The one walking about in front of someone, if they are.
export function entOf(S, r) {
  const o = resolve(S, r);
  if (!o) return null;
  switch (r.t) {
    case 'rec': return o.ent && !o.ent.dead ? o.ent : null;
    case 'bandit': {
      const e = S.sim.bandits.ents.get(`${r.band}:${r.m}`);
      return e && !e.dead ? e : null;
    }
    case 'adv': {
      const e = S.sim.adventurers.ents.get(o.id);
      return e && !e.dead ? e : null;
    }
    case 'pl': return o;
    case 'named': {
      const e = S.actors.get(`named:${r.key}`);
      return e && !e.dead ? e : null;
    }
    default: return null;
  }
}

// Which way, and how far, from a town (as folk would put it).
export function directions(from, x, z) {
  const m = townMid(from);
  if (!m) return 'somewhere out in the wilds';
  const dx = x - m.x;
  const dz = z - m.z;
  const d = Math.hypot(dx, dz);
  if (d < 30) return `just outside ${from.name}`;
  const ang = Math.atan2(-dz, dx);
  const dirs = ['east', 'north-east', 'north', 'north-west', 'west', 'south-west', 'south', 'south-east'];
  const dir = dirs[((Math.round(ang / (Math.PI / 4)) % 8) + 8) % 8];
  return `${d < 70 ? 'a short walk' : d < 160 ? 'a good way' : d < 400 ? 'a long way' : 'far'} ${dir} of ${from.name}`;
}
