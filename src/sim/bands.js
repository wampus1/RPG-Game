// (Round 144) A battle near you, fought by bands. Each side's soldiers on
// the field are split into bands of a few to a dozen: a left, a centre and
// a right in the front line, a reserve behind, the bowmen, the horse, any
// hired swords out on a flank. Each band has its captain, its banner
// (carried by one of them, in the realm's colours), its place on the field
// (an anchor, and the way it faces), its order of the moment (hold, advance,
// charge, fall back, swing round a flank, rally, loose, lock shields) and
// its nerve: its morale, worn down by losses, by being hit from the side or
// behind, by stones falling among it, by the captain or the commander
// falling, by a band beside it running; raised by winning, by a commander
// close by, by rallying to the banner. A wavering band won't go forward; a
// broken one runs, and may be rallied once it's clear of the fight.
//
// Each side's commander (its marshal) fights the plan chosen for it (see
// war.js chooseTactic: the same plans as ever, now each a sequence of
// orders to its bands) and thinks as it goes: commits the reserve where
// the line is giving or the enemy's is, turns a band to meet a flank
// attack, sends the horse at the enemy's bowmen or into a flank, pulls the
// bowmen back when they're rushed, pursues a broken enemy or holds its
// bands in hand, falls back in good order when the day's lost, rallies
// what can be rallied. A bold commander does it sooner, a cautious one
// later; a steady one keeps its bands together.
//
// A player in command (see command.js: a ruler with the host, a mayor with
// the levy at home, a captain of a band) gives these orders themselves, in
// the moment; the marshal keeps to what it's left to do.
import { hash4, clamp } from '../util/rng.js';
import { traitsOf } from './officertraits.js';

// The orders, and what a captain shouts giving them.
export const ORDERS = {
  hold: { name: 'Hold', key: 'KeyH', leash: 2, about: 'Stand where they are, facing the enemy: fight whoever comes.', bark: ['Hold the line!', 'Stand fast!', 'Hold! Hold!', 'Steady, steady...'] },
  advance: { name: 'Advance', key: 'KeyA', leash: 3, about: 'Forward in good order, keeping the ranks: into whoever they meet.', bark: ['Forward!', 'Advance! Keep the line!', 'On, together!', 'Steady pace, forward!'] },
  charge: { name: 'Charge', key: 'KeyC', leash: 40, about: 'Break ranks and run at the enemy: a hard first blow, and the band all over the field after.', bark: ['Charge!', 'At them!', 'Charge! For the realm!', 'Into them!'] },
  fallback: { name: 'Fall back', key: 'KeyF', leash: 1, about: 'Back to a point behind, keeping together, fighting only who keeps up.', bark: ['Fall back! Together!', 'Back! Keep your shields up!', 'Give ground, slowly!'] },
  wheel: { name: 'Round their flank', key: 'KeyW', leash: 1, about: 'Out wide round the side of an enemy band, then into its flank.', bark: ['Round their flank! With me!', 'Wide! Go wide!', 'Round the side of them!'] },
  rally: { name: 'Rally', key: 'KeyR', leash: 1, about: 'Gather on the banner and get their breath (and their nerve) back.', bark: ['To the banner! Rally!', 'Rally! Rally on me!', 'Form on the colours!'] },
  loose: { name: 'Loose', key: 'KeyL', leash: 2, about: 'Bowmen: stand and shoot into the enemy, together.', bark: ['Nock! Draw! Loose!', 'Loose!', 'Pick your marks... Loose!'] },
  shieldwall: { name: 'Lock shields', key: 'KeyS', leash: 1, about: 'Shields locked, a step at a time: hard to break, slow to move.', bark: ['Shields! Lock shields!', 'Shield wall!', 'Close up! Shields!'] },
  // (A siege's: see game/siegeground.js.)
  storm: { name: 'Storm', key: 'KeyT', leash: 2, siege: true, about: 'At the town: the gate, the breach, up the ladders, over the barricades; then for the square.', bark: ['Storm the walls!', 'Up! Up the ladders!', 'Forward! Into the town!', 'Take the gate!'] },
  man: { name: 'Man the walls', key: 'KeyM', leash: 1, siege: true, about: 'Everyone to their post: on the walls, at the gate, behind the barricades.', bark: ['To the walls!', 'Hold the walls!', 'Everyone to their posts!', 'Push them off!'] },
};
export const ORDER_IDS = Object.keys(ORDERS);

// How a band's called, by its place.
const ROLE_NAME = { left: 'the Left', right: 'the Right', centre: 'the Centre', wing: 'the Wing', reserve: 'the Reserve', bows: 'the Bowmen', horse: 'the Horse', hired: 'the Hired Swords', wall: 'the Walls', gate: 'the Gate', square: 'the Square', storm: 'the Storming Party', ladders: 'the Ladders', sally: 'the Sally' };

const cheb = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.z - b.z));
const unit = (x, z) => {
  const d = Math.hypot(x, z) || 1;
  return { x: x / d, z: z / d };
};
export const standing = (n) => !!n && !n.dead && !n.down && !!n.warband && n.warband.phase !== 'flee' && n.warband.phase !== 'down';
const hasBow = (n) => {
  const items = (n.rec && n.rec.equipment && n.rec.equipment.items) || [];
  return items.some((i) => i && /bow/.test(i.item || '')) && (n.rec.inv || []).some((q) => q && (q.item === 'arrow' || q.item === 'bolt') && q.count > 0);
};

// ------------------------------------------------------------ forming up
// The bands of one side, from the soldiers it has on the field, laid out
// for its plan. (Called once the line's raised: war.startLiveBattle.)
export function formBands(war, live, side) {
  const S = live.sides[side];
  if (!S) return [];
  const fwd = { x: -live.axis.x * S.sign, z: -live.axis.z * S.sign };
  S.fwd = fwd;
  const tac = S.tactic;
  const tech = war.sim.tech;
  const home = S.civ ? war.realms.capitalOf(S.civ) : null;
  const shields = !!(home && tech.has(home, 'shieldwall'));
  S.shields = shields;
  // (Not an engine's crew: they're at it.)
  const ents = S.ents.filter((n) => n.warband && n.warband.role !== 'crew');
  const horse = ents.filter((n) => n.mount && !n.warband.merc);
  const hired = ents.filter((n) => n.warband.merc);
  const rest = ents.filter((n) => !n.mount && !n.warband.merc);
  const bows = rest.length >= 8 ? rest.filter(hasBow).slice(0, Math.max(3, Math.round(rest.length * 0.25))) : [];
  const inf = rest.filter((n) => !bows.includes(n));
  // (The bravest to the front of each band, the steadiest at the back.)
  const brave = (n) => (n.rec.personality?.bravery ?? 0.5) + (n.rec.job === 'guard' ? 0.4 : 0) + (n.rec.drilled ? 0.3 : 0);
  inf.sort((p, q) => brave(q) - brave(p));
  const bands = [];
  const make = (role, list, extra = {}) => {
    if (!list.length) return null;
    const b = {
      id: `${side}${bands.length}`, side, role, name: ROLE_NAME[role] || 'a band', ents: list.slice(), start: list.length, lost: 0,
      captain: null, bearer: null, color: S.civ ? S.civ.color.hex : '#a09080',
      anchor: { x: 0, z: 0 }, face: { ...fwd }, order: { kind: 'hold', at: null, t0: 0, by: 'ai' }, morale: 60, base: 60, state: 'ok', stateT: 0,
      width: Math.max(1, Math.min(9, Math.ceil(Math.sqrt(list.length * 2.4)))), spacing: role === 'horse' ? 2 : 1, engaged: 0, contactT: null, volleyT: 0, ...extra,
    };
    bands.push(b);
    for (const n of list) {
      n.warband.band = b.id;
      // (The roles the plans have always given: a pincer's two wings, a
      // flanking attack's wing, everyone else the centre.)
      n.warband.role = role === 'left' || role === 'right' || role === 'wing' ? role : 'centre';
    }
    return b;
  };
  // The front line, by plan.
  const reserveN = inf.length >= 16 && tac !== 'retreat' ? Math.round(inf.length * 0.2) : 0;
  const reserve = inf.splice(inf.length - reserveN, reserveN);
  const front = [];
  if (tac === 'pincer' && inf.length >= 3) {
    const k = Math.max(1, Math.round(inf.length / 3));
    // (Each wing gets its share of the bravest: dealt round.)
    const L = [];
    const C = [];
    const R = [];
    inf.forEach((n, i) => (i % 3 === 0 ? L : i % 3 === 1 ? R : C).push(n));
    void k;
    front.push(make('left', L), make('centre', C), make('right', R));
  } else if (tac === 'flank' && inf.length >= 2) {
    const k = Math.max(1, Math.ceil(inf.length * 0.4));
    const W = inf.filter((n, i) => i % 5 < 2).slice(0, k);
    front.push(make('centre', inf.filter((n) => !W.includes(n))), make('wing', W));
  } else {
    const nb = clamp(Math.round(inf.length / 10), 1, 4);
    const groups = Array.from({ length: nb }, () => []);
    inf.forEach((n, i) => groups[i % nb].push(n));
    const roles = nb === 1 ? ['centre'] : nb === 2 ? ['left', 'right'] : nb === 3 ? ['left', 'centre', 'right'] : ['left', 'centre', 'centre', 'right'];
    groups.forEach((g, i) => front.push(make(roles[i], g)));
  }
  const line = front.filter(Boolean);
  // Side by side along the line, two paces between bands.
  const perp = live.perp;
  const gap = 2;
  const total = line.reduce((n, b) => n + b.width * b.spacing, 0) + gap * Math.max(0, line.length - 1);
  // (The wing of a flanking attack on the end nearer the enemy's open side:
  // as it's laid out, the last.)
  let off = -total / 2;
  const c = live.centre;
  for (const b of line) {
    const mid = off + (b.width * b.spacing) / 2;
    b.lat = mid;
    b.anchor = { x: c.x - fwd.x * 11 + perp.x * mid, z: c.z - fwd.z * 11 + perp.z * mid };
    off += b.width * b.spacing + gap;
  }
  const behind = (k, lat = 0) => ({ x: c.x - fwd.x * k + perp.x * lat, z: c.z - fwd.z * k + perp.z * lat });
  const depth = Math.max(1, ...line.map((b) => Math.ceil(b.ents.length / b.width)));
  const rb = make('reserve', reserve);
  if (rb) rb.anchor = behind(11 + depth + 5);
  const bb = make('bows', bows, { width: Math.min(9, Math.max(3, Math.ceil(bows.length / 2))) });
  if (bb) bb.anchor = behind(11 + depth + 2, 0);
  const hb = make('horse', horse, { width: Math.min(5, horse.length) });
  if (hb) hb.anchor = behind(13, (total / 2 + 5) * (hash4(live.w.id, 0x40e) % 2 ? 1 : -1));
  const mb = make('hired', hired, { width: Math.min(4, hired.length) });
  if (mb) mb.anchor = behind(13, -(total / 2 + 5) * (hb && hb.anchor ? Math.sign(hb.lat || 1) : 1));
  for (const b of bands) {
    b.home = { ...b.anchor };
    b.lat ??= (b.anchor.x - c.x) * perp.x + (b.anchor.z - c.z) * perp.z;
    pickCaptain(war, live, b, true);
    pickBearer(live, b);
    b.base = b.morale = baseMorale(war, live, S, b);
    b.order = { kind: shields && b.role !== 'bows' && b.role !== 'horse' && (tac === 'hold' || tac === 'works') ? 'shieldwall' : b.role === 'bows' ? 'loose' : 'hold', at: null, t0: 0, by: 'ai' };
    // (Everyone's place in it, from the first.)
    b.ents.forEach((n, i) => {
      const q = slotAt(b, i);
      n.warband.form = q;
    });
  }
  S.bands = bands;
  S.prog = { stage: 0, t: 0 };
  S.marshal = pickMarshal(war, live, S);
  S.thinkT = side === 'a' ? 0.5 : 1;
  return bands;
}

// Where the `i`th of a band stands: rank on rank behind its anchor, file
// by file across it.
export function slotAt(b, i) {
  // (A siege's posts: on the walls, at the gate.)
  if (b.posts && b.posts.length && (b.order.kind === 'man' || b.order.kind === 'hold')) return b.posts[i % b.posts.length];
  const w = b.width;
  const file = i % w;
  const rank = Math.floor(i / w);
  const f = b.face;
  const px = -f.z;
  const pz = f.x;
  const lat = (file - (w - 1) / 2) * b.spacing;
  return { x: Math.round(b.anchor.x + px * lat - f.x * rank * (b.spacing > 1 ? 2 : 1)), z: Math.round(b.anchor.z + pz * lat - f.z * rank * (b.spacing > 1 ? 2 : 1)) };
}

// A band's nerve to begin with: its people's courage, drill and trade, how
// tired the realm is of the war, whether it's their own town behind them,
// whether they're starving, their captain's mettle.
function baseMorale(war, live, S, b) {
  const list = b.ents;
  const avg = list.reduce((n, q) => n + (q.rec.personality?.bravery ?? 0.5), 0) / Math.max(1, list.length);
  const drilled = list.filter((q) => q.rec.drilled || q.rec.job === 'guard').length / Math.max(1, list.length);
  let m = 48 + avg * 26 + drilled * 12;
  const civ = S.civ;
  const vals = (civ && civ.values) || [];
  if (vals.includes('martial')) m += 6;
  if (vals.includes('mercantile')) m -= 3;
  const w = live.w;
  if (civ && w) m -= Math.min(16, (w.weary[civ.id] || 0) * 14);
  const side = b.side;
  if (live.plan && side !== live.plan.attacker) m += 6;
  // (Round 144) Hungry from a siege.
  if (S.hunger) m -= Math.min(18, S.hunger * 6);
  const cap = b.captain && b.captain.rec ? traitsOf(b.captain.rec) : [];
  if (cap.includes('brave')) m += 5;
  if (cap.includes('timid')) m -= 5;
  if (b.role === 'hired') m -= 6;
  if (b.role === 'horse') m += 4;
  return clamp(Math.round(m), 25, 92);
}

// The captain of a band: the town's captain of the watch if they're in
// it, else the bravest of the drilled, else the bravest. `quiet` at the
// start; afterwards, a new one taking over says so.
export function pickCaptain(war, live, b, quiet = false) {
  if (b.player) return null;
  const up = b.ents.filter(standing);
  const score = (n) => (n.rec.captain ? 3 : 0) + (n.rec.job === 'guard' ? 1 : 0) + (n.rec.drilled ? 0.6 : 0) + (n.rec.personality?.bravery ?? 0.5) + (n.rec.skills?.combat || 0) * 0.5;
  const c = up.sort((p, q) => score(q) - score(p))[0] || null;
  b.captain = c;
  if (c) {
    c.warband.captain = b.id;
    if (!quiet) c.say(c.rng.pick([`I have ${b.name}! On me!`, 'I\'ve got them! Form on me!', 'With me, lads! I\'ll lead!']), 2.4, '#ffe070');
  }
  return c;
}

// The one carrying the banner: a sturdy one from the middle of the back
// rank (never the captain, if there's anyone else).
export function pickBearer(live, b) {
  const up = b.ents.filter((n) => standing(n) && n !== b.captain && !n.mount);
  const pool = up.length ? up : b.ents.filter((n) => standing(n) && !n.mount);
  const bearer = pool.sort((p, q) => (q.rec.personality?.bravery ?? 0.5) - (p.rec.personality?.bravery ?? 0.5))[Math.min(pool.length - 1, 1)] || null;
  if (b.bearer && b.bearer.warband) b.bearer.warband.bearer = null;
  b.bearer = bearer;
  if (bearer) bearer.warband.bearer = { color: b.color, band: b.id };
  b.banner = null;
  return bearer;
}

// The side's commander, in the field: the realm's marshal if one's
// named and here, else the most senior of the captains. How they think
// (bold, cautious, steady, cunning) from who they are.
function pickMarshal(war, live, S) {
  const caps = S.bands.map((b) => b.captain).filter(Boolean);
  const score = (n) => (n.rec.captain ? 2 : 0) + (n.rec.job === 'guard' ? 1 : 0) + (n.rec.skills?.combat || 0) + (n.rec.personality?.bravery ?? 0.5) * 0.5 + (n.rec.age === 'elder' ? 0.4 : 0);
  const ent = caps.sort((p, q) => score(q) - score(p))[0] || null;
  return { ent, name: ent ? `${ent.rec.name.first} ${ent.rec.name.last}` : null, style: styleOf(ent ? ent.rec : null), player: null, lost: false };
}

// How a commander fights, from their traits and temper.
export function styleOf(rec) {
  if (!rec) return 'steady';
  const T = traitsOf(rec);
  const P = rec.personality || {};
  if (T.includes('brave') || (P.temper ?? 0.5) > 0.7) return 'bold';
  if (T.includes('timid') || ((P.bravery ?? 0.5) < 0.4 && (P.diligence ?? 0.5) > 0.5)) return 'cautious';
  if (T.includes('shrewd') || T.includes('learned')) return 'cunning';
  return 'steady';
}

// ------------------------------------------------------------ orders
// A band given an order: the captain (or whoever gives it) shouts it, and
// it's done from now. `by`: 'ai', or a player's id.
export function orderBand(live, b, kind, at = null, by = 'ai', target = null) {
  if (!b || !ORDERS[kind]) return false;
  if (b.state === 'rout' && kind !== 'rally') return false;
  const same = b.order.kind === kind && (!at || (b.order.at && cheb(b.order.at, at) <= 1)) && (b.order.target || null) === (target || null);
  if (same && by === b.order.by) return false;
  b.order = { kind, at: at ? { x: Math.round(at.x), z: Math.round(at.z) } : null, t0: live.t, by, target: target || null };
  b.round = false;
  if (kind === 'charge') b.chargeT = live.t;
  const who = b.captain && standing(b.captain) ? b.captain : b.ents.find(standing);
  if (who && !same) who.say(who.rng.pick(ORDERS[kind].bark), 2.2, by === 'ai' ? '#ffe070' : '#ffd0a0');
  return true;
}

// A blow that brought one of the enemy down: the band that did it takes
// heart.
export function credit(live, by) {
  const b = by && by.warband && bandOf(live, by.warband.band);
  if (b) b.morale = Math.min(100, b.morale + 1.6);
}

// How hard one soldier's blow lands on another in a battle: a long fight in
// mail and helms; the first blows of a charge, or the horse's, hard; a band
// taken from behind, or wavering, cut down faster.
export function hitMult(live, a, v) {
  let m = 0.7;
  const ab = bandOf(live, a.warband.band);
  const vb = bandOf(live, v.warband.band);
  if (ab && ab.order.kind === 'charge' && live.t - (ab.chargeT ?? -99) < 4) m *= a.mount ? 1.8 : 1.35;
  else if (a.mount) m *= 1.2;
  if (vb) {
    const dx = a.x - v.x;
    const dz = a.z - v.z;
    if (dx * vb.face.x + dz * vb.face.z < -0.5) m *= 1.25;
    if (vb.state === 'waver') m *= 1.12;
  }
  if (ab && ab.state === 'waver') m *= 0.85;
  if (a.warband.ambush !== undefined && live.t < a.warband.ambush) m *= 1.25;
  return m;
}

// ------------------------------------------------------------ the field
// Each side's standing soldiers by squares of the field (four paces a
// side), for finding who's near whom without asking everyone.
export function buildGrid(live, g) {
  const grid = { a: new Map(), b: new Map() };
  const key = (x, z) => ((x >> 2) & 0xffff) * 65536 + ((z >> 2) & 0xffff);
  for (const s of ['a', 'b']) {
    const S = live.sides[s];
    if (!S) continue;
    const m = grid[s];
    for (const n of S.ents) {
      if (!standing(n)) continue;
      const k = key(n.x, n.z);
      let arr = m.get(k);
      if (!arr) m.set(k, (arr = []));
      arr.push(n);
    }
    // (And you, to the side you're fighting against.)
    for (const p of g.everyone ? g.everyone() : [g.player]) {
      if (!p || p.dead || p.down || !live.sides[s === 'a' ? 'b' : 'a']) continue;
      const foeHates = live.sides[s === 'a' ? 'b' : 'a'].hates;
      const mine = live.mine ? live.mine(p) : null;
      if (mine === s || (!mine && foeHates)) {
        const k = key(p.x, p.z);
        let arr = m.get(k);
        if (!arr) m.set(k, (arr = []));
        arr.push(p);
      }
    }
  }
  grid.key = key;
  live.grid = grid;
  return grid;
}

// Foes of `side` within `r` of (x, z), nearest first (at most `max`).
export function foesNear(live, side, x, z, r, max = 12) {
  const grid = live.grid;
  if (!grid) return [];
  const m = grid[side === 'a' ? 'b' : 'a'];
  const out = [];
  const cx0 = (x - r) >> 2;
  const cx1 = (x + r) >> 2;
  const cz0 = (z - r) >> 2;
  const cz1 = (z + r) >> 2;
  for (let cz = cz0; cz <= cz1; cz++) {
    for (let cx = cx0; cx <= cx1; cx++) {
      const arr = m.get((cx & 0xffff) * 65536 + (cz & 0xffff));
      if (!arr) continue;
      for (const n of arr) {
        if (n.dead || n.down) continue;
        const d = Math.max(Math.abs(n.x - x), Math.abs(n.z - z));
        if (d <= r) out.push({ n, d });
      }
    }
  }
  out.sort((p, q) => p.d - q.d);
  return out.length > max ? out.slice(0, max) : out;
}

// Friends of `side` within `r` (a count).
export function friendsNear(live, side, x, z, r) {
  const m = live.grid && live.grid[side];
  if (!m) return 0;
  let k = 0;
  for (let cz = (z - r) >> 2; cz <= (z + r) >> 2; cz++) {
    for (let cx = (x - r) >> 2; cx <= (x + r) >> 2; cx++) {
      const arr = m.get((cx & 0xffff) * 65536 + (cz & 0xffff));
      if (!arr) continue;
      for (const n of arr) if (Math.max(Math.abs(n.x - x), Math.abs(n.z - z)) <= r) k++;
    }
  }
  return k;
}

// The middle of a band's standing soldiers (or its anchor, with none).
export function centroid(b) {
  let x = 0;
  let z = 0;
  let k = 0;
  for (const n of b.ents) {
    if (!standing(n)) continue;
    x += n.x;
    z += n.z;
    k++;
  }
  return k ? { x: x / k, z: z / k, k } : { x: b.anchor.x, z: b.anchor.z, k: 0 };
}

export const bandUp = (b) => b.ents.reduce((k, n) => k + (standing(n) ? 1 : 0), 0);
export const bandOf = (live, id) => {
  if (!live || id === null || id === undefined) return null;
  for (const s of ['a', 'b']) for (const b of (live.sides[s] && live.sides[s].bands) || []) if (b.id === id) return b;
  return null;
};
export const allBands = (live) => [...((live.sides.a && live.sides.a.bands) || []), ...((live.sides.b && live.sides.b.bands) || [])];

// ------------------------------------------------------------ the tick
// A quarter-second of the battle for its bands: who's left in each, their
// nerve, where each stands and faces, their banners and captains; each
// side's commander's thinking; fresh soldiers walking up from the rear.
export function bandsTick(war, live, dt) {
  const g = war.game;
  if (!live.sides.a || !live.sides.b || !live.sides.a.bands || !live.sides.b.bands) return;
  buildGrid(live, g);
  // Who's beset by how many.
  const on = new Map();
  for (const s of ['a', 'b']) {
    for (const n of live.sides[s].ents) {
      const t = n.warband && n.warband.tgt;
      if (t && standing(n) && !t.dead) on.set(t, (on.get(t) || 0) + 1);
    }
  }
  live.attackers = on;
  for (const s of ['a', 'b']) {
    const S = live.sides[s];
    for (const b of S.bands) bandTick(war, live, S, b, dt);
  }
  // Each side's commander, every second or so.
  for (const s of ['a', 'b']) {
    const S = live.sides[s];
    S.thinkT = (S.thinkT ?? 1) - dt;
    if (S.thinkT > 0 || live.done) continue;
    S.thinkT = S.marshal && S.marshal.lost ? 2 : S.marshal && S.marshal.style === 'cautious' ? 1.4 : 1;
    marshalThink(war, live, s);
  }
  reinforce(war, live, dt);
}

function bandTick(war, live, S, b, dt) {
  // (Gone to crew an engine: out of the band, not lost to it.)
  for (const n of b.ents) {
    if (n.warband && n.warband.role === 'crew' && n.warband.band === b.id) {
      n.warband.band = undefined;
      b.start--;
    }
  }
  b.ents = b.ents.filter((n) => !n.dead && n.warband && n.warband.band === b.id);
  const up = b.ents.filter(standing);
  // Each one's place in the ranks (those back binding a wound, or still
  // walking up, out of it: the rest close up).
  b.slots = new Map();
  let si = 0;
  for (const n of up) if (n.warband.phase !== 'fallback' && n.warband.phase !== 'march') b.slots.set(n, si++);
  for (const n of up) if (!b.slots.has(n)) b.slots.set(n, si++);
  // The bowmen's volleys: called together, every few seconds.
  if (b.order.kind === 'loose' && live.go && live.t >= (b.volleyNext || 0)) {
    b.volleyAt = live.t;
    b.volleyNext = live.t + 3.4;
    const c = b.captain && standing(b.captain) ? b.captain : null;
    if (c && c.rng.chance(0.5)) c.say(c.rng.pick(['Loose!', 'Draw... Loose!', 'Again! Loose!']), 1.4, '#ffe070');
  }
  const fallen = b.start - up.length - b.lost;
  // Losses: each one felt, the more for a small band.
  if (fallen > 0) {
    b.lost += fallen;
    b.morale = Math.max(0, b.morale - fallen * (1.2 + 26 / Math.max(6, b.start)));
    b.lastLoss = live.t;
  }
  b.stateT += dt;
  // A captain down: a moment's confusion, and someone takes over.
  if (b.captain && !standing(b.captain) && !b.player) {
    b.morale -= 12;
    b.captain = null;
    b.capT = live.t;
  }
  if (!b.captain && !b.player && up.length && live.t - (b.capT ?? -9) > 3) pickCaptain(war, live, b);
  // The banner: down with its bearer (it lies there: someone of theirs, or
  // you, takes it up), up again in other hands.
  if (b.bearer && !standing(b.bearer)) {
    const at = { x: b.bearer.x, z: b.bearer.z, y: b.bearer.y };
    if (b.bearer.warband) b.bearer.warband.bearer = null;
    b.bearer = null;
    b.banner = { ...at, t: live.t };
    b.morale -= 8;
    live.fallenBanners = (live.fallenBanners || []).concat([{ band: b.id, ...at, t: live.t, color: b.color }]);
  }
  if (!b.bearer && b.banner && live.t - b.banner.t > 4 && b.state !== 'rout') {
    // (Taken up by whoever's nearest it.)
    const by = up.filter((n) => n !== b.captain && !n.mount).sort((p, q) => cheb(p, b.banner) - cheb(q, b.banner))[0];
    if (by && cheb(by, b.banner) <= 4) {
      b.bearer = by;
      by.warband.bearer = { color: b.color, band: b.id };
      live.fallenBanners = (live.fallenBanners || []).filter((q) => q.band !== b.id);
      b.banner = null;
      b.morale += 5;
      by.say(by.rng.pick(['The colours! I have them!', 'Up! The banner\'s up!', 'To me! The banner!']), 2.2, '#ffe070');
    }
  }
  b.morale = clamp(b.morale, 0, 100);
  if (!up.length) {
    b.engaged = 0;
    return;
  }
  const cen = centroid(b);
  b.cen = cen;
  // Who's close: in the thick of it, hit from the side or behind (foes in
  // among them past their ranks' ends, or round the back), outnumbered.
  let engaged = 0;
  const flank = new Set();
  const sideFoe = S === live.sides.a ? 'a' : 'b';
  const depth = Math.ceil(up.length / b.width) * (b.spacing > 1 ? 2 : 1);
  const half = (b.width * b.spacing) / 2 + 1;
  for (const n of up) {
    const f = foesNear(live, sideFoe, n.x, n.z, 2, 3);
    if (!f.length) continue;
    engaged++;
    for (const { n: q } of f) {
      const rx = q.x - cen.x;
      const rz = q.z - cen.z;
      const along = rx * b.face.x + rz * b.face.z;
      const lat = Math.abs(rx * -b.face.z + rz * b.face.x);
      if (along < -(depth / 2 + 1) || lat > half) flank.add(q);
    }
  }
  const flanked = flank.size;
  b.engaged = engaged / up.length;
  if (engaged) b.contactT = live.t;
  const fn = foesNear(live, sideFoe, Math.round(cen.x), Math.round(cen.z), 6, 40).length;
  const mine = friendsNear(live, sideFoe, Math.round(cen.x), Math.round(cen.z), 6);
  // The nerve of it.
  let dm = 0;
  if (flanked) dm -= Math.min(1.4, flanked * 0.22);
  if (fn > mine * 1.5 && fn >= 3) dm -= 0.35;
  if (!engaged && !fn) dm += (b.base - b.morale) > 0 ? 0.7 : 0;
  // (A commander near: a word, a look; you're one, if you're here with them.)
  const cmd = S.marshal && S.marshal.ent && standing(S.marshal.ent) ? S.marshal.ent : null;
  if (cmd && cheb(cmd, cen) <= 10) dm += 0.35;
  if (live.leaderNear && live.leaderNear(S, cen)) dm += 0.45;
  if (b.order.kind === 'rally') dm += b.bearer || b.captain ? 1.6 : 0.8;
  if (b.order.kind === 'shieldwall' && engaged) dm += 0.25;
  b.morale = clamp(b.morale + dm, 0, 100);
  // Wavering, breaking, rallied.
  if (b.state === 'ok' && b.morale < 30) setState(live, b, 'waver');
  else if (b.state === 'waver' && b.morale >= 40) setState(live, b, 'ok');
  if (b.state !== 'rout' && b.morale < 11) rout(war, live, S, b);
  else if (b.state === 'rout') {
    // (Clear of the fight, someone holding them together, their breath
    // back: they rally.)
    const clear = !foesNear(live, sideFoe, Math.round(cen.x), Math.round(cen.z), 8, 1).length;
    if (clear) b.calmT = (b.calmT || 0) + dt;
    else b.calmT = 0;
    if (clear) b.morale = Math.min(100, b.morale + (b.captain || b.bearer || cmd ? 1.4 : 0.5));
    if (b.calmT > 3 && b.morale >= 30 && up.length >= 2 && !S.broken) {
      setState(live, b, 'ok');
      for (const n of b.ents) if (n.warband && n.warband.phase === 'flee' && !n.dead && !n.down && !n.warband.gone) n.warband.phase = 'move';
      b.anchor = { x: cen.x, z: cen.z };
      orderBand(live, b, 'rally', cen, 'ai');
      war.game.ui.msg(`${cap(b.name)} of the ${plainOf(S.civ)} rallies!`, '#ffe070');
    }
  }
  // Its anchor: where the order takes it, at the pace of its slowest.
  moveAnchor(live, S, b, dt, up);
}

function setState(live, b, st) {
  b.state = st;
  b.stateT = 0;
}

// A band breaks: every one of them runs (and the bands beside it feel it).
function rout(war, live, S, b) {
  setState(live, b, 'rout');
  b.calmT = 0;
  const up = b.ents.filter(standing);
  const said = up.find((n) => n.rng.chance(0.7));
  if (said) said.say(said.rng.pick(['Run! Run for it!', 'It\'s lost! Back!', 'They\'re through! Run!', 'Every man for himself!']), 2.4, '#ffb080');
  for (const n of up) {
    n.warband.phase = 'flee';
    n.warband.routed = true;
  }
  const cen = b.cen || centroid(b);
  for (const o of S.bands) if (o !== b && o.state !== 'rout' && cheb(o.cen || o.anchor, cen) <= 12) o.morale -= 9;
  const foe = live.sides[b.side === 'a' ? 'b' : 'a'];
  for (const o of foe.bands || []) if (o.state !== 'rout' && cheb(o.cen || o.anchor, cen) <= 10) o.morale = Math.min(100, o.morale + 10);
  war.game.ui.msg(`${cap(b.name)} of the ${plainOf(S.civ)} breaks and runs!`, '#ffb080');
  war.game.audio?.play('cheer', { x: cen.x, y: up[0] ? up[0].y : 6, z: cen.z });
}

const cap = (s) => s[0].toUpperCase() + s.slice(1);
const plainOf = (civ) => (civ ? civ.name.replace(/^The /, '') : 'free folk');

// The anchor on toward where its order takes it; the band faces the way it
// goes, or toward the enemy nearest it.
function moveAnchor(live, S, b, dt, up) {
  const o = b.order;
  const foeSide = b.side === 'a' ? 'b' : 'a';
  const near = nearestBand(live, foeSide, b.cen || b.anchor);
  let goal = null;
  let pace = 2.1;
  if (o.kind === 'advance') {
    const t = (o.target && bandOf(live, o.target)) || near;
    goal = o.at || (t ? t.cen || t.anchor : null);
    // (Close enough: the last few paces at a run, the band's own captain's
    // call, if their nerve's up to it.)
    if (t && b.state === 'ok' && cheb(b.cen || b.anchor, t.cen || t.anchor) <= 5 && o.by === 'ai') orderBand(live, b, 'charge', null, 'ai', t.id);
  } else if (o.kind === 'fallback') {
    goal = o.at || { x: b.home.x - S.fwd.x * 8, z: b.home.z - S.fwd.z * 8 };
    pace = 1.7;
  } else if (o.kind === 'wheel') {
    const t = (o.target && bandOf(live, o.target)) || near;
    if (t && !b.round) {
      const tc = t.cen || t.anchor;
      const tf = t.face;
      // Out to the side of them (whichever side the band's on), a little
      // behind their front.
      const s = Math.sign((b.cen.x - tc.x) * -tf.z + (b.cen.z - tc.z) * tf.x) || (b.lat >= 0 ? 1 : -1);
      const wide = (t.width * t.spacing) / 2 + 5;
      goal = o.at || { x: tc.x - tf.z * wide * s - tf.x * 2, z: tc.z + tf.x * wide * s - tf.z * 2 };
      pace = b.role === 'horse' ? 3.4 : 2.5;
      if (cheb(b.anchor, goal) <= 2 || live.t - o.t0 > 22) {
        b.round = true;
        orderBand(live, b, 'charge', null, o.by, t.id);
      }
    }
  } else if (o.kind === 'rally') {
    goal = o.at || (b.bearer ? { x: b.bearer.x, z: b.bearer.z } : null);
    pace = 2.6;
    if (b.state === 'ok' && live.t - o.t0 > 6 && b.morale > 45 && o.by === 'ai') orderBand(live, b, 'hold', null, 'ai');
  } else if (o.kind === 'charge') {
    const t = (o.target && bandOf(live, o.target)) || near;
    if (t) goal = t.cen || t.anchor;
    pace = b.role === 'horse' ? 4 : 3;
  } else if (o.kind === 'shieldwall') {
    goal = o.at;
    pace = 0.9;
  } else if (o.at) goal = o.at;
  // (Wavering: not one step forward.)
  if (b.state === 'waver' && goal && near) {
    const dGoal = cheb(goal, near.cen || near.anchor);
    const dNow = cheb(b.anchor, near.cen || near.anchor);
    if (dGoal < dNow) goal = null;
  }
  // Facing: toward the nearest of the enemy, unless on the move away.
  if (near && o.kind !== 'fallback') {
    const nc = near.cen || near.anchor;
    const f = unit(nc.x - b.anchor.x, nc.z - b.anchor.z);
    // (Snapped to the eight ways round, so the ranks keep square.)
    const a = Math.round(Math.atan2(f.z, f.x) / (Math.PI / 4)) * (Math.PI / 4);
    b.face = { x: Math.round(Math.cos(a) * 100) / 100, z: Math.round(Math.sin(a) * 100) / 100 };
  }
  if (!goal || b.state === 'rout') return;
  // (Dust kicked up under a band on the move, where you can see it.)
  if (o.kind !== 'hold' && o.kind !== 'man' && up.length && Math.random() < 0.35 * Math.min(1, up.length / 6)) {
    const q = up[Math.floor(Math.random() * up.length)];
    if (q.moving && q.game.inSight(q.x, q.z, 0)) q.game.renderer.emit(q.x, q.y, q.z, { n: q.mount ? 4 : 2, color: ['#a89878', '#8a7a5a', '#c8b898'], up: 6, speed: 10, life: 0.6, oy: 6, shape: 'puff' });
  }
  // (Waiting for the ranks to catch up before going on.)
  let inPlace = 0;
  up.forEach((n, i) => {
    const q = slotAt(b, i);
    if (cheb(n, q) <= 2) inPlace++;
  });
  if (o.kind !== 'charge' && inPlace < up.length * 0.55 && live.t - o.t0 > 1) return;
  const dx = goal.x - b.anchor.x;
  const dz = goal.z - b.anchor.z;
  const d = Math.hypot(dx, dz);
  if (d < 0.5) return;
  const step = Math.min(d, pace * dt);
  b.anchor = { x: b.anchor.x + (dx / d) * step, z: b.anchor.z + (dz / d) * step };
}

// The enemy band nearest a point (not one that's broken).
export function nearestBand(live, side, at, filter = null) {
  const S = live.sides[side];
  let best = null;
  let bd = Infinity;
  for (const b of (S && S.bands) || []) {
    if (b.state === 'rout' || !bandUp(b) || (filter && !filter(b))) continue;
    const c = b.cen || b.anchor;
    const d = Math.hypot(c.x - at.x, c.z - at.z);
    if (d < bd) {
      bd = d;
      best = b;
    }
  }
  return best;
}

// ------------------------------------------------------------ the commander
// A side's commander looks over the field and gives the orders that need
// giving: the plan's next step, and what the moment calls for.
function marshalThink(war, live, side) {
  const S = live.sides[side];
  const O = live.sides[side === 'a' ? 'b' : 'a'];
  if (!S.bands || !O.bands) return;
  const M = S.marshal || { style: 'steady' };
  // (The commander down: the next captain takes over, after a moment.)
  if (M.ent && !standing(M.ent) && !M.player && !M.lost) {
    M.lost = true;
    M.lostT = live.t;
    for (const b of S.bands) b.morale -= 14;
    war.game.ui.msg(`${M.name || 'The commander'} of the ${plainOf(S.civ)} has fallen!`, '#ffb080');
  }
  if (M.lost && live.t - M.lostT > 6) {
    const next = S.bands.map((b) => b.captain).filter((n) => n && standing(n))[0];
    if (next) {
      M.ent = next;
      M.name = `${next.rec.name.first} ${next.rec.name.last}`;
      M.style = styleOf(next.rec);
      M.lost = false;
      next.say(next.rng.pick(['I have command! Hold together!', 'Listen to me now! I lead!', 'Form up! I command here!']), 2.6, '#ffe070');
    }
  }
  if (!live.go) return;
  S.prog.t += 1;
  const mine = (b) => b.state !== 'rout' && bandUp(b) > 0;
  // A band a player's taken in hand is theirs; the rest, the marshal's.
  const free = (b) => mine(b) && !b.player && (b.order.by === 'ai' || (M.player === null && !S.cmdBy) || b.auto);
  const bands = S.bands.filter(free);
  const foes = O.bands.filter(mine);
  if (!foes.length) return;
  const bold = M.style === 'bold';
  const cautious = M.style === 'cautious';
  const cunning = M.style === 'cunning';
  const t = live.t - (live.goT || 0);
  const front = bands.filter((b) => ['left', 'right', 'centre', 'wing', 'hired'].includes(b.role));
  const reserve = bands.find((b) => b.role === 'reserve');
  const bows = bands.find((b) => b.role === 'bows');
  const horse = bands.find((b) => b.role === 'horse');
  // The plan's next step.
  if (!S.cmdBy) runPlan(live, S, O, front, t, M);
  // The bowmen: shoot into whoever's coming; back behind the line if
  // they're rushed.
  if (bows) {
    const c = bows.cen || bows.anchor;
    const threat = nearestBand(live, O === live.sides.a ? 'a' : 'b', c);
    const tc = threat && (threat.cen || threat.anchor);
    if (tc && cheb(tc, c) <= 4 && bows.order.kind !== 'fallback') {
      const back = { x: c.x - S.fwd.x * 7, z: c.z - S.fwd.z * 7 };
      orderBand(live, bows, 'fallback', back, 'ai');
    } else if (bows.order.kind !== 'loose' && (!tc || cheb(tc, c) > 6) && live.t - bows.order.t0 > 4) orderBand(live, bows, 'loose', null, 'ai', threat ? threat.id : null);
    else if (bows.order.kind === 'loose') bows.order.target = threat ? threat.id : null;
  }
  // The horse: at the enemy's bowmen if they can get round to them, else
  // into the flank of an enemy band that's busy with their foot; then back
  // to form again for another go.
  if (horse && horse.state === 'ok') {
    const ob = foes.find((b) => b.role === 'bows');
    const busy = foes.filter((b) => b.engaged > 0.25).sort((p, q) => bandUp(p) - bandUp(q))[0];
    const k = horse.order.kind;
    if (k === 'hold' || k === 'shieldwall' || (k === 'rally' && live.t - horse.order.t0 > 5)) {
      if (ob && t > 4) orderBand(live, horse, 'wheel', null, 'ai', ob.id);
      else if (busy && (t > (bold ? 6 : 12))) orderBand(live, horse, 'wheel', null, 'ai', busy.id);
    } else if (k === 'charge' && live.t - horse.order.t0 > 10 && horse.morale > 40) {
      const back = { x: horse.home.x, z: horse.home.z };
      orderBand(live, horse, 'fallback', back, 'ai');
    } else if (k === 'fallback' && cheb(horse.anchor, horse.order.at || horse.home) <= 2) orderBand(live, horse, 'hold', null, 'ai');
  }
  // The reserve: where the line's giving, or where the enemy's is.
  if (reserve && (reserve.order.kind === 'hold' || reserve.order.kind === 'shieldwall')) {
    const weak = S.bands.filter((b) => mine(b) && b.role !== 'reserve' && b.role !== 'bows' && b.engaged > 0.2 && (b.morale < (bold ? 50 : cautious ? 34 : 42) || bandUp(b) < b.start * 0.5)).sort((p, q) => p.morale - q.morale)[0];
    const shaky = foes.filter((b) => b.state === 'waver' || b.morale < 35).sort((p, q) => p.morale - q.morale)[0];
    if (weak && t > (cautious ? 14 : 6)) {
      const wc = weak.cen || weak.anchor;
      orderBand(live, reserve, 'advance', { x: wc.x - S.fwd.x, z: wc.z - S.fwd.z }, 'ai');
      reserve.helping = weak.id;
    } else if (shaky && t > (bold ? 8 : 16)) orderBand(live, reserve, cunning ? 'wheel' : 'advance', null, 'ai', shaky.id);
    else if (t > (bold ? 30 : cautious ? 70 : 45)) orderBand(live, reserve, 'advance', null, 'ai');
  }
  // A flank turned: the band nearest it turns to meet it (the reserve
  // first, if it's free).
  for (const f of live.siege ? [] : foes) {
    // (On the move round us, and near: not standing off on a wing.)
    if (!['wheel', 'charge', 'advance'].includes(f.order.kind) || (f.role !== 'wing' && f.role !== 'horse' && f.order.kind !== 'wheel')) continue;
    const fc = f.cen || f.anchor;
    const closest = S.bands.filter(mine).reduce((d, b) => Math.min(d, cheb(b.cen || b.anchor, fc)), Infinity);
    if (closest > 14) continue;
    // (How far out past our line's end, as we face.)
    const lat = (fc.x - live.centre.x) * live.perp.x + (fc.z - live.centre.z) * live.perp.z;
    const ends = S.bands.filter(mine).map((b) => b.lat ?? 0);
    const out = lat > Math.max(...ends) + 3 || lat < Math.min(...ends) - 3;
    if (!out) continue;
    const meet = (reserve && reserve.order.kind !== 'advance' ? reserve : null) || front.slice().sort((p, q) => cheb(p.cen || p.anchor, fc) - cheb(q.cen || q.anchor, fc))[0];
    if (meet && meet.order.kind !== 'charge' && (meet.order.target !== f.id)) {
      if (bandUp(meet) >= bandUp(f) * 0.8) orderBand(live, meet, 'charge', null, 'ai', f.id);
      else orderBand(live, meet, S.shields ? 'shieldwall' : 'hold', { x: Math.round((meet.cen || meet.anchor).x), z: Math.round((meet.cen || meet.anchor).z) }, 'ai', f.id);
    }
  }
  // The enemy broken: a bold commander goes after them; a steady one turns
  // its bands on whoever's still standing.
  for (const b of front) {
    if (b.order.kind !== 'charge' || !b.order.target) continue;
    const tb = bandOf(live, b.order.target);
    if (tb && tb.state === 'rout') {
      const next = nearestBand(live, O === live.sides.a ? 'a' : 'b', b.cen || b.anchor);
      if (next && (!bold || live.t - b.order.t0 > 8)) orderBand(live, b, cunning ? 'wheel' : 'advance', null, 'ai', next.id);
    }
  }
  // Rallied bands back into it.
  for (const b of bands) if (b.order.kind === 'rally' && b.state === 'ok' && b.morale > 45 && live.t - b.order.t0 > 5) orderBand(live, b, 'hold', null, 'ai');
  // The day lost: fall back in good order (never off the walls of home:
  // see siegeground.js).
  const upS = S.bands.reduce((n, b) => n + (mine(b) ? bandUp(b) : 0), 0);
  const upO = O.bands.reduce((n, b) => n + (mine(b) ? bandUp(b) : 0), 0);
  const avgM = S.bands.filter(mine).reduce((n, b) => n + b.morale, 0) / Math.max(1, S.bands.filter(mine).length);
  if (!S.cmdBy && !S.withdrew && !live.siege && t > 20 && upS < upO * (bold ? 0.35 : cautious ? 0.6 : 0.45) && avgM < 40) {
    S.withdrew = true;
    for (const b of bands) orderBand(live, b, 'fallback', { x: b.home.x - S.fwd.x * 14, z: b.home.z - S.fwd.z * 14 }, 'ai');
    war.game.ui.msg(`The ${plainOf(S.civ)} are falling back in good order.`, '#ffe070');
  }
}

// Each plan, as orders to the line in turn.
function runPlan(live, S, O, front, t, M) {
  const tac = S.withdrew ? 'retreat' : S.tactic;
  const P = S.prog;
  const foesSide = O === live.sides.a ? 'a' : 'b';
  const target = (b) => nearestBand(live, foesSide, b.cen || b.anchor);
  const bold = M.style === 'bold';
  if (tac === 'line') {
    if (P.stage === 0) {
      for (const b of front) orderBand(live, b, 'advance', null, 'ai', target(b)?.id);
      P.stage = 1;
    }
    return;
  }
  if (tac === 'hold' || tac === 'works') {
    if (P.stage === 0) {
      for (const b of front) orderBand(live, b, S.shields ? 'shieldwall' : 'hold', null, 'ai');
      P.stage = 1;
    }
    // (Nobody coming: a commander who's the stronger goes to them in the
    // end, a bold one sooner.)
    const upS = S.bands.reduce((n, b) => n + bandUp(b), 0);
    const upO = O.bands.reduce((n, b) => n + bandUp(b), 0);
    const quiet = !S.bands.some((b) => b.engaged > 0) && t > (bold ? 18 : 32);
    if (P.stage === 1 && quiet && upS >= upO * 1.15) {
      for (const b of front) orderBand(live, b, 'advance', null, 'ai', target(b)?.id);
      P.stage = 2;
    }
    return;
  }
  if (tac === 'flank' || tac === 'pincer') {
    const wings = front.filter((b) => b.role === 'wing' || (tac === 'pincer' && (b.role === 'left' || b.role === 'right')));
    const mid = front.filter((b) => !wings.includes(b));
    if (P.stage === 0) {
      // (Each wing round the enemy band on its own end of the line.)
      for (const b of wings) {
        const byEnd = O.bands.filter((q) => q.state !== 'rout' && q.role !== 'bows' && q.role !== 'reserve').sort((p, q) => Math.abs((q.lat ?? 0) + (b.lat ?? 0)) - Math.abs((p.lat ?? 0) + (b.lat ?? 0)));
        orderBand(live, b, 'wheel', null, 'ai', (byEnd[0] || target(b))?.id);
      }
      for (const b of mid) orderBand(live, b, 'hold', null, 'ai');
      P.stage = 1;
    } else if (P.stage === 1 && (wings.every((b) => b.round || b.state === 'rout') || t > 14)) {
      for (const b of mid) orderBand(live, b, 'advance', null, 'ai', target(b)?.id);
      P.stage = 2;
    }
    return;
  }
  if (tac === 'feint') {
    if (P.stage === 0) {
      for (const b of front) orderBand(live, b, 'advance', null, 'ai', target(b)?.id);
      P.stage = 1;
    } else if (P.stage === 1) {
      // At first contact: back, as if beaten...
      if (front.some((b) => b.engaged > 0.1 || (target(b) && cheb(b.cen || b.anchor, target(b).cen || target(b).anchor) <= 5))) {
        for (const b of front) orderBand(live, b, 'fallback', { x: b.anchor.x - S.fwd.x * 7, z: b.anchor.z - S.fwd.z * 7 }, 'ai');
        P.stage = 2;
        P.at = live.t;
      }
    } else if (P.stage === 2 && live.t - P.at > 4) {
      // ...then round on them as they come on, strung out.
      for (const b of front) {
        orderBand(live, b, 'charge', null, 'ai', target(b)?.id);
        for (const n of b.ents) if (n.warband) n.warband.ambush = live.t + 6;
      }
      P.stage = 3;
    }
    return;
  }
  if (tac === 'retreat') {
    if (P.stage === 0) {
      // A rearguard holds while the rest go.
      const rear = front.slice().sort((p, q) => bandUp(q) - bandUp(p))[0];
      for (const b of front) {
        if (b === rear) orderBand(live, b, S.shields ? 'shieldwall' : 'hold', null, 'ai');
        else orderBand(live, b, 'fallback', { x: b.home.x - S.fwd.x * 12, z: b.home.z - S.fwd.z * 12 }, 'ai');
      }
      P.stage = 1;
    } else if (P.stage === 1 && t > 20) {
      for (const b of front) orderBand(live, b, 'fallback', { x: b.home.x - S.fwd.x * 18, z: b.home.z - S.fwd.z * 18 }, 'ai');
      P.stage = 2;
    }
  }
}

// ------------------------------------------------------------ more of them
// Fresh soldiers up from the rear as the ones on the field fall: the rest
// of the army, out of sight behind the lines till there's room for them.
function reinforce(war, live, dt) {
  if (!live.go || live.done) return;
  live.reinT = (live.reinT ?? 2) - dt;
  if (live.reinT > 0) return;
  live.reinT = 1.5;
  for (const s of ['a', 'b']) {
    const S = live.sides[s];
    if (!S.reserve || !S.reserve.length || S.broken || S.withdrew) continue;
    const up = S.ents.filter(standing).length;
    const room = (live.cap || 16) - up;
    if (room < 3) continue;
    // (Into the band that's lost the most.)
    const into = S.bands.filter((b) => b.state !== 'rout' && b.role !== 'bows' && b.role !== 'horse' && b.role !== 'hired').sort((p, q) => (q.start - bandUp(q)) - (p.start - bandUp(p)))[0];
    if (!into) continue;
    for (let k = 0; k < Math.min(4, room - 2) && S.reserve.length; k++) {
      const { r, L } = S.reserve.shift();
      if (!r || r.dead || r.captive || (r.ent && !r.ent.dead)) continue;
      const q = slotAt(into, into.ents.length);
      const at = war.offstage(q.x, q.z, live.axis, live.perp, S.sign);
      if (!at) continue;
      const e = war.spawn(r, L, at.x, at.z, s, 'battle', { war: live.w.id, role: 'centre', levy: r.job !== 'guard', home: { x: live.centre.x + live.axis.x * 40 * S.sign, z: live.centre.z + live.axis.z * 40 * S.sign }, form: q, phase: 'march', band: into.id });
      if (!e) continue;
      r.soldier = live.w.id;
      r.away = true;
      into.ents.push(e);
      into.start++;
      S.ents.push(e);
      S.start++;
    }
  }
}
