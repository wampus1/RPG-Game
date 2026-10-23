// (Round 145) Hosts: armies raised by one of you who leads (a realm's
// ruler, from any of its towns; a town's head, from their own), each under
// a commander of your choosing (one of its captains, or one of you), and
// sent: to attack a town of the enemy's, to lay siege to it, to clear an
// outpost of theirs out of the way, to hold a town of your own, or home.
//
// A host musters in its town for an hour; then marches over the land (on
// the world map; on the ground near you, a column behind its banner), held
// up by any outpost of the enemy's it passes within sight of (a skirmish
// there: see outposts.js). Arrived:
//   - before a town to attack: it gives battle to whoever comes out against
//     it (the town's watch and levy, its neighbours'), a battle like any
//     other (fought on the ground, if you're there). Won decisively, the
//     town's taken, or besieged if it's walled; won narrowly, it camps and
//     goes again after a rest; lost, it falls back home. A town behind walls
//     too weak to come out shuts its gates: a siege.
//   - to lay siege: straight to it (behind walls; or, without them, if it's
//     big enough to surround it); the siege as any other (see siege.js),
//     the host its army;
//   - to hold a town of yours: it camps there, and fights for it, in the
//     same battle, when it's attacked;
//   - home: back to its town, and stood down.
// Its commander leads it: their nerve chooses its plan, their skill tells
// in the fighting, their temper in the sack if a town falls to it. One of
// you in command of it commands it in the field (see command.js).
import { alive, ledger, DAY } from './econ.js';
import { RNG, hash4, clamp } from '../util/rng.js';
import { traitsOf } from './officertraits.js';
import { styleOf } from './bands.js';
import { REGION_W, REGION_D } from '../config.js';

const residents = (L) => L.npcs.filter((r) => alive(r) && !r.away && !r.migrated && !r.visitor);
const plain = (civ) => (civ ? civ.name.replace(/^The /, '') : 'free folk');
// (A realm by its place: the Realm of Kingsdale, Kingsdale.)
const placeOf = (civ) => {
  const n = plain(civ);
  const m = / of (.+)$/.exec(n);
  return m ? m[1] : n;
};
const fullName = (r) => `${r.name.first} ${r.name.last}`;
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const centreOf = (s) => ({ x: Math.floor((s.cx + (s.cw || 1) / 2) * REGION_W), z: Math.floor((s.cz + (s.cd || 1) / 2) * REGION_D) });
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const sameIsle = (s, o) => !s.island || !o.island || s.island === o.island;

// How fast a host goes (tiles a minute: a big one slower), how long it
// takes to muster, the fewest it can be.
export const HOST_SPEED = 1.2;
export const MUSTER_MIN = 60;
export const HOST_MIN = 3;
// Who's never taken for a host (the town can't spare them).
const EXEMPT = new Set(['mayor', 'noble', 'priest', 'researcher', 'herbalist', 'innkeeper', 'barkeep', 'blacksmith', 'merchant', 'scholar', 'child', 'retired', 'beggar']);
const DESPERATE = new Set(['mayor', 'noble', 'priest', 'child']);
const ORDINAL = ['First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth', 'Seventh', 'Eighth', 'Ninth', 'Tenth'];
export const HOST_ORDERS = {
  attack: 'Attack',
  siege: 'Lay siege',
  clear: 'Clear the outpost',
  hold: 'Hold the town',
  home: 'Come home',
};
const STATE_WORDS = { muster: 'mustering', march: 'on the march', camp: 'in camp', fight: 'giving battle', siege: 'besieging', home: 'home' };

export const hostById = (war, id) => (war.hosts || []).find((h) => h.id === id) || null;
const pkOf = (p) => `p:${p && p.seat && !p.seat.host ? p.seat.id : 'host'}`;

// ------------------------------------------------------------ who leads
// What `p` leads, to raise a host from: { civ, rank ('ruler' or 'mayor'),
// towns (settlements they can raise from) }, or null.
export function leaderOf(war, p) {
  const g = war.game;
  const sim = war.sim;
  return g.asPlayer(p, () => {
    const crown = sim.crown;
    const C = crown && crown.heldBy && crown.heldBy(crown.pid());
    const civ = C ? crown.civOf(C) : null;
    if (civ && war.realms.members(civ).length) return { civ, rank: 'ruler', towns: war.realms.members(civ).filter((s) => g.world.layouts.get(s.id)?.econ) };
    const T = sim.office && sim.office.heldBy(sim.office.pid());
    const s = T ? war.ow.settlements[T.sid] : null;
    if (s && s.civ && g.world.layouts.get(s.id)?.econ) return { civ: s.civ, rank: 'mayor', towns: [s] };
    return null;
  });
}

// Can `p` give a host its orders? Whoever raised it, the realm's ruler, and
// one of you in command of it.
export function mayOrder(war, p, h) {
  if (!h) return false;
  const pk = pkOf(p);
  if (h.by === pk || (h.cmd && h.cmd.pk === pk)) return true;
  const lead = leaderOf(war, p);
  return !!(lead && lead.rank === 'ruler' && lead.civ.id === h.civ);
}

// Who a town can send: its watch (all but one, who stays) and the able-
// bodied of its levy (no more than half of them; Round 145: of a small
// realm fighting for its life, three in four and more, the old too: see
// War.draftRate).
export function available(war, L) {
  const free = (r) => r.ruler === undefined && r.councillor === undefined && r.raid === undefined && r.soldier === undefined && r.captive === undefined && r.host === undefined && r.outpost === undefined && !r.trip?.phase?.startsWith('away') && !r.hired;
  const civ = L.settlement.civ;
  const w = civ && war.warOf(civ);
  const side = w ? (w.a.includes(civ.id) ? 'a' : 'b') : null;
  const D = w && w.lead[side] === civ.id ? war.draftRate(w, side) : 0;
  const exempt = D ? DESPERATE : EXEMPT;
  const fit = (r) => (r.age === 'adult' || (D && r.age === 'elder')) && r.job !== 'guard' && !exempt.has(r.job);
  const people = residents(L).filter(free);
  const guards = people.filter((r) => r.job === 'guard' && r.age === 'adult').sort((x, y) => (y.drilled ? 1 : 0) - (x.drilled ? 1 : 0) || (y.personality?.bravery ?? 0.5) - (x.personality?.bravery ?? 0.5));
  const able = residents(L).filter(fit);
  const levy = people.filter(fit).sort((x, y) => (y.personality?.bravery ?? 0.5) - (x.personality?.bravery ?? 0.5));
  const away = L.npcs.filter((r) => alive(r) && r.host !== undefined && r.job !== 'guard').length;
  return { guards: guards.slice(0, Math.max(0, guards.length - 1)), levy: levy.slice(0, Math.max(0, Math.floor((able.length + away) * (D || 0.5)) - away)), rate: D || 0.5 };
}

// ------------------------------------------------------------ raising
// A host raised by `p` in town `sid`, `n` strong (guards first, then the
// levy). Returns the host, or { ok: false, why }.
export function raiseHost(war, p, sid, n) {
  const g = war.game;
  const lead = leaderOf(war, p);
  if (!lead) return { ok: false, why: 'Only the ruler of a realm, or the head of a town, can raise a host.' };
  const w = war.warOf(lead.civ);
  if (!w) return { ok: false, why: `The ${plain(lead.civ)} is at peace: there's no war to raise a host for.` };
  const s = lead.towns.find((q) => q.id === sid);
  if (!s) return { ok: false, why: lead.rank === 'mayor' ? 'You can raise a host only from your own town.' : 'That town isn\'t the realm\'s.' };
  const L = g.world.layouts.get(s.id);
  if (!L || !L.econ) return { ok: false, why: 'That town can\'t be reached.' };
  if (w.siege && w.siege.sid === s.id) return { ok: false, why: `${s.name} is besieged: no one gets out.` };
  const A = available(war, L);
  const pick = [...A.guards, ...A.levy].slice(0, Math.max(0, Math.round(n)));
  if (pick.length < HOST_MIN) return { ok: false, why: `${s.name} can't spare enough to make a host (${A.guards.length + A.levy.length} at most; ${HOST_MIN} at least).` };
  const id = war.nextId++;
  war.hostCount ||= {};
  const k = (war.hostCount[lead.civ.id] = (war.hostCount[lead.civ.id] || 0) + 1);
  const name = lead.rank === 'mayor' ? `the Levy of ${s.name}${k > 1 ? ` (the ${ORDINAL[Math.min(9, k - 1)].toLowerCase()})` : ''}` : `the ${ORDINAL[Math.min(9, k - 1)]} Host of ${placeOf(lead.civ)}`;
  const now = war.sim.abs;
  const at = centreOf(s);
  const h = {
    id, civ: lead.civ.id, war: w.id, side: w.a.includes(lead.civ.id) ? 'a' : 'b', name, sid: s.id, by: pkOf(p), byName: g.asPlayer(p, () => g.playerName) || 'you',
    members: pick.map((r) => ({ sid: s.id, idx: r.idx })), n0: pick.length, cmd: null,
    state: 'muster', ready: now + MUSTER_MIN, order: null, pos: { ...at }, leg: null, morale: 66,
    start: Math.floor(now / DAY), log: [], plan: null, rest: 0,
  };
  for (const r of pick) {
    r.host = id;
    r.soldier = `h${id}`;
  }
  war.hosts ||= [];
  war.hosts.push(h);
  // (Its commander, till you name another: the best of them.)
  const best = candidates(war, h).find((c) => c.kind === 'npc' && !c.join);
  if (best) setCommander(war, null, h.id, best, true);
  note(war, h, `${cap(h.name)} is mustering at ${s.name}: ${pick.length} strong (${pick.filter((r) => r.job === 'guard').length} of the watch, ${pick.filter((r) => r.job !== 'guard').length} of the levy)${h.cmd ? `, under ${h.cmd.name}` : ''}.`);
  ledger(L, Math.floor(now / DAY), `${cap(h.name)} mustered here, ${pick.length} strong, raised by ${h.byName}.`);
  g.audio?.play('war_horn', { x: at.x, y: 6, z: at.z });
  return h;
}

// The host's own, still with it: alive, not taken.
export function hostRecs(war, h) {
  const out = [];
  for (const m of h.members) {
    const L = war.game.world.layouts.get(m.sid);
    const r = L ? L.npcs[m.idx] : null;
    if (r && alive(r) && !r.captive && r.host === h.id) out.push({ r, L, d: 0 });
  }
  return out;
}

export const hostSize = (war, h) => hostRecs(war, h).length;

// Its soldiers as an army for a battle (see War.pool).
export function hostPool(war, h) {
  const civ = war.civ(h.civ);
  return { recs: hostRecs(war, h), extra: 0, civs: civ ? [civ] : [], host: h.id };
}

// ------------------------------------------------------------ commanders
// Who could lead it: its own (a captain of the watch first, then the
// drilled, the brave, the skilled), a town's captain who isn't with it yet
// (they'd join it), and any of you of the realm.
export function candidates(war, h) {
  const g = war.game;
  const out = [];
  const score = (r) => (r.captain ? 3 : 0) + (r.job === 'guard' ? 1 : 0) + (r.drilled ? 0.7 : 0) + (r.personality?.bravery ?? 0.5) + (r.skills?.combat || 0) * 0.5 + (traitsOf(r).includes('shrewd') ? 0.4 : 0);
  for (const { r, L } of hostRecs(war, h)) out.push({ kind: 'npc', sid: L.settlement.id, idx: r.idx, name: fullName(r), score: score(r), style: styleOf(r), why: r.captain ? `captain of the watch of ${L.settlement.name}` : r.job === 'guard' ? `of the watch${r.drilled ? ', drilled' : ''}` : `a ${r.job || 'townsman'} of the levy` });
  // (Captains of the realm's towns near, not with it yet.)
  const civ = war.civ(h.civ);
  for (const s of civ ? war.realms.members(civ) : []) {
    const L = g.world.layouts.get(s.id);
    if (!L || !L.econ || dist(centreOf(s), h.pos) > 24 * REGION_W) continue;
    for (const r of residents(L)) {
      if (!r.captain || r.host !== undefined || r.soldier !== undefined || r.captive !== undefined || r.ruler !== undefined) continue;
      if (h.state !== 'muster' && h.state !== 'camp' && h.state !== 'home') continue;
      if (dist(centreOf(s), h.pos) > 40) continue;
      out.push({ kind: 'npc', sid: s.id, idx: r.idx, name: fullName(r), score: score(r) + 0.5, style: styleOf(r), why: `captain of the watch of ${s.name} (would join it)`, join: true });
    }
  }
  out.sort((p, q) => q.score - p.score);
  // Any of you playing who's of the realm.
  const all = g.everyone ? g.everyone() : [g.player];
  for (const p of all) {
    const ok = g.asPlayer(p, () => war.playerCiv());
    if (!ok || ok.id !== h.civ) continue;
    out.push({ kind: 'player', pk: pkOf(p), name: g.asPlayer(p, () => g.playerName) || 'you', why: 'one of you: you command it in the field', style: 'yours' });
  }
  return out;
}

// Name its commander (`c` one of candidates()). `p` null: the host's own
// choice, when it's raised.
export function setCommander(war, p, id, c, quiet = false) {
  const h = hostById(war, id);
  if (!h) return { ok: false, why: 'No such host.' };
  if (p && !mayOrder(war, p, h)) return { ok: false, why: 'That host isn\'t yours to command.' };
  if (c.kind === 'player') {
    h.cmd = { kind: 'player', pk: c.pk, name: c.name };
  } else {
    const L = war.game.world.layouts.get(c.sid);
    const r = L ? L.npcs[c.idx] : null;
    if (!r || !alive(r)) return { ok: false, why: 'They can\'t.' };
    // (A captain from a town: with the host now.)
    if (r.host !== h.id) {
      if (r.host !== undefined || r.soldier !== undefined || r.captive !== undefined) return { ok: false, why: `${fullName(r)} is needed elsewhere.` };
      r.host = h.id;
      r.soldier = `h${h.id}`;
      if (h.state !== 'muster') r.away = true;
      h.members.push({ sid: c.sid, idx: c.idx });
    }
    h.cmd = { kind: 'npc', sid: c.sid, idx: c.idx, name: fullName(r) };
  }
  if (!quiet) note(war, h, `${cap(h.name)} is under the command of ${h.cmd.kind === 'player' ? h.cmd.name : h.cmd.name} now.`);
  return { ok: true };
}

// The commander's record (an NPC's), or null.
export function commanderRec(war, h) {
  if (!h || !h.cmd || h.cmd.kind !== 'npc') return null;
  const L = war.game.world.layouts.get(h.cmd.sid);
  const r = L ? L.npcs[h.cmd.idx] : null;
  return r && alive(r) && !r.captive && r.host === h.id ? r : null;
}

// What a commander's worth to the fighting: a captain, a drilled hand, the
// skilled, the shrewd and the brave for more; the timid for less.
export function commanderMult(war, h) {
  const r = commanderRec(war, h);
  if (!r) return h && h.cmd && h.cmd.kind === 'player' ? 1.04 : 0.96;
  const T = traitsOf(r);
  let q = (r.captain ? 0.06 : 0) + (r.drilled ? 0.03 : 0) + (r.skills?.combat || 0) * 0.04;
  if (T.includes('brave')) q += 0.03;
  if (T.includes('shrewd')) q += 0.04;
  if (T.includes('learned')) q += 0.02;
  if (T.includes('timid')) q -= 0.04;
  return 1 + clamp(q, -0.06, 0.15);
}

// ------------------------------------------------------------ orders
// Where the host's going to, for an order: a town (attack, siege, hold,
// home) or an outpost (clear).
function destOf(war, h, kind, target) {
  if (kind === 'clear') {
    const O = (war.outposts || []).find((q) => q.id === target);
    if (!O) return null;
    const d = dist(h.pos, O) || 1;
    // (Out of its sight a little way, then straight at it.)
    return { x: Math.round(O.x + ((h.pos.x - O.x) / d) * 10), z: Math.round(O.z + ((h.pos.z - O.z) / d) * 10) };
  }
  const s = war.ow.settlements[target];
  if (!s) return null;
  if (kind === 'hold' || kind === 'home') return centreOf(s);
  // (Before the town, on the side it's coming from.)
  return war.siteNear(s, h.pos);
}

// Give a host an order: 'attack' a town of the enemy's, 'siege' one,
// 'clear' an outpost of theirs, 'hold' a town of your own, 'home'; or
// 'disband' (at home: stood down).
export function orderHost(war, p, id, kind, target = null) {
  const h = hostById(war, id);
  if (!h) return { ok: false, why: 'No such host.' };
  if (p && !mayOrder(war, p, h)) return { ok: false, why: 'That host isn\'t yours to command.' };
  const w = war.wars.find((q) => q.id === h.war);
  const home = war.ow.settlements[h.sid];
  if (kind === 'disband') {
    if (h.state !== 'home' && !(h.state === 'muster' || (h.state === 'camp' && dist(h.pos, centreOf(home)) <= 30))) return { ok: false, why: 'It has to come home before it can stand down (order it home).' };
    disband(war, h, 'stood down');
    return { ok: true };
  }
  if (!w && kind !== 'home') return { ok: false, why: 'The war is over.' };
  if (h.state === 'fight' && h.plan && h.plan.live) return { ok: false, why: 'It\'s in the thick of a battle.' };
  if (h.inside && w && w.siege && w.siege.id === h.siege) return { ok: false, why: `It's shut up in ${war.ow.settlements[w.siege.sid]?.name}, besieged: no one gets out.` };
  const civ = war.civ(h.civ);
  if (kind === 'attack' || kind === 'siege') {
    const s = war.ow.settlements[target];
    if (!s || !s.civ || !war.enemies(civ, s.civ)) return { ok: false, why: 'That isn\'t a town of the enemy\'s.' };
    if (!sameIsle(s, home)) return { ok: false, why: `There's no marching to ${s.name}: it's over the water.` };
    if (kind === 'siege' && w.siege && w.siege.sid !== s.id) return { ok: false, why: `The realm's already besieging ${war.ow.settlements[w.siege.sid]?.name || 'a town'}: one siege at a time.` };
  } else if (kind === 'clear') {
    const O = (war.outposts || []).find((q) => q.id === target);
    if (!O || O.state === 'burned' || !war.enemies(civ, war.civ(O.civ))) return { ok: false, why: 'That isn\'t an outpost of the enemy\'s.' };
  } else if (kind === 'hold') {
    const s = war.ow.settlements[target];
    if (!s || !s.civ || !(w[h.side] || []).includes(s.civ.id)) return { ok: false, why: 'That isn\'t a town of your side\'s to hold.' };
  } else if (kind === 'home') target = h.sid;
  else return { ok: false, why: '?' };
  const to = destOf(war, h, kind, target);
  if (!to) return { ok: false, why: 'It can\'t get there.' };
  // (Leaving a siege: the besiegers fewer for it, or the siege over.)
  if (h.state === 'siege') leaveSiege(war, w, h);
  if (h.plan && !h.plan.live) h.plan = null;
  h.order = { kind, target };
  h.rest = 0;
  setOut(war, h, to);
  const where = kind === 'clear' ? (war.outposts.find((q) => q.id === target)?.name || 'the outpost') : war.ow.settlements[target]?.name;
  const words = { attack: `to attack ${where}`, siege: `to lay siege to ${where}`, clear: `to clear ${where}`, hold: `to hold ${where}`, home: 'home' }[kind];
  note(war, h, `${cap(h.name)} ${h.state === 'muster' ? 'will march' : 'marches'} ${words}${h.leg ? ` (there in about ${Math.max(1, Math.round((h.leg.arr - war.sim.abs) / 60))} hours)` : ''}.`);
  return { ok: true };
}

// Off along the way to `to` (once it's mustered).
function setOut(war, h, to) {
  const now = war.sim.abs;
  const dep = Math.max(now, h.state === 'muster' ? h.ready : now);
  const n = hostSize(war, h);
  const speed = HOST_SPEED * (n > 30 ? 0.85 : 1) * (styleOf(commanderRec(war, h)) === 'bold' ? 1.08 : 1);
  const d = dist(h.pos, to);
  h.leg = { from: { ...h.pos }, to: { x: Math.round(to.x), z: Math.round(to.z) }, dep, arr: dep + Math.max(10, Math.round(d / speed)), halts: [], passed: [], id: war.nextId++ };
  if (h.state !== 'muster') h.state = 'march';
  goAway(war, h);
}

// Out of their town: away (not about its streets), and anyone of it about
// in the town falls in behind the banner.
function goAway(war, h) {
  if (h.state === 'muster') return;
  for (const { r, L } of hostRecs(war, h)) {
    r.away = true;
    if (r.ent && !r.ent.dead && !r.ent.warband) {
      const e = r.ent;
      e.releaseSpot?.();
      e.state = 'warband';
      e.activity = null;
      e.path = null;
      e.sleeping = false;
      e.warband = { kind: 'host', host: h.id, side: h.side, civ: h.civ, foe: false, slot: Math.max(0, h.members.findIndex((m) => m.idx === r.idx && m.sid === L.settlement.id)) };
    }
  }
}

// Where along its way it is at `now` (held up at an outpost, it stands).
export function legPos(leg, now) {
  let lagNow = 0;
  let lagAll = 0;
  for (const q of leg.halts || []) {
    lagAll += q.until - q.from;
    lagNow += clamp(now - q.from, 0, q.until - q.from);
  }
  const span = Math.max(1, leg.arr - lagAll - leg.dep);
  const f = clamp((now - lagNow - leg.dep) / span, 0, 1);
  const d = dist(leg.from, leg.to) || 1;
  return { x: leg.from.x + (leg.to.x - leg.from.x) * f, z: leg.from.z + (leg.to.z - leg.from.z) * f, f, dx: (leg.to.x - leg.from.x) / d, dz: (leg.to.z - leg.from.z) / d, held: (leg.halts || []).some((q) => now >= q.from && now < q.until) };
}

// Held up (an outpost's skirmish) for `min` minutes from now.
export function holdUp(war, h, min) {
  if (!h.leg) return;
  const now = war.sim.abs;
  h.leg.halts.push({ from: now, until: now + min });
  h.leg.arr += min;
}

// Where it is, for the map and the ground: { x, z, dx, dz, moving }.
export function hostAt(war, h) {
  const now = war.sim.abs;
  if (h.leg && (h.state === 'march' || h.state === 'muster') && now >= h.leg.dep) {
    const m = legPos(h.leg, now);
    return { ...m, moving: !m.held && m.f < 1 };
  }
  return { x: h.pos.x, z: h.pos.z, dx: 0, dz: 1, moving: false };
}

// ------------------------------------------------------------ each moment
// The hosts on their way: mustered, on the march (an outpost of the enemy's
// in sight of it: a skirmish), arrived; a battle due.
export function hostsTick(war) {
  const now = war.sim.abs;
  for (const h of (war.hosts || []).slice()) {
    if (!hostById(war, h.id)) continue;
    const w = war.wars.find((q) => q.id === h.war);
    if (h.state === 'muster' && now >= h.ready) {
      h.state = h.leg ? 'march' : 'camp';
      note(war, h, `${cap(h.name)} has mustered${h.leg ? ' and marched out' : ', and waits for its orders'}.`, false);
      goAway(war, h);
    }
    // (Every one of them fallen, or taken: no host left.)
    if (h.state !== 'muster' && !hostSize(war, h)) {
      disband(war, h, 'destroyed');
      continue;
    }
    if (h.state === 'march' && h.leg) {
      const m = legPos(h.leg, now);
      h.pos = { x: Math.round(m.x), z: Math.round(m.z) };
      if (!m.held && w && war.outpostWatch) war.outpostWatch(w, { kind: 'host', host: h.id, civ: h.civ, side: h.side, at: h.pos, from: h.sid, passed: h.leg.passed });
      if (hostById(war, h.id) && now >= h.leg.arr) arrive(war, w, h);
    }
    // (Camped before a town, rested: at it again.)
    if (h.state === 'camp' && w && h.order && h.order.kind === 'attack' && h.rest && now >= h.rest) {
      h.rest = 0;
      const s = war.ow.settlements[h.order.target];
      if (s && s.civ && war.enemies(war.civ(h.civ), s.civ)) engage(war, w, h, s);
      else orderHost(war, null, h.id, 'home');
    }
  }
}

// Arrived where it was going.
function arrive(war, w, h) {
  h.pos = { ...h.leg.to };
  h.leg = null;
  const o = h.order || { kind: 'hold', target: h.sid };
  if (!w) {
    // (The war's over meanwhile: home, and stood down.)
    if (o.kind === 'home') return disband(war, h, 'home');
    return orderHost(war, null, h.id, 'home');
  }
  if (o.kind === 'home') return disband(war, h, 'home');
  if (o.kind === 'hold') {
    h.state = 'camp';
    note(war, h, `${cap(h.name)} has come to ${war.ow.settlements[o.target]?.name}, and holds it.`);
    return null;
  }
  if (o.kind === 'clear') {
    const O = (war.outposts || []).find((q) => q.id === o.target);
    h.state = 'camp';
    if (!O || O.state === 'burned' || O.state === 'empty') {
      note(war, h, `${cap(h.name)} found ${O ? O.name : 'the outpost'} empty.`);
      return null;
    }
    // (Straight at it: see outposts.js.)
    return war.outpostAssault ? war.outpostAssault(w, O, { kind: 'host', host: h.id, civ: h.civ, side: h.side, at: h.pos, from: h.sid, passed: [] }) : null;
  }
  const s = war.ow.settlements[o.target];
  if (!s || !s.civ || !war.enemies(war.civ(h.civ), s.civ)) {
    note(war, h, `${cap(h.name)} came to ${s ? s.name : 'the town'}, and found no enemy there.`);
    h.state = 'camp';
    return null;
  }
  return engage(war, w, h, s, o.kind === 'siege');
}

// Before an enemy's town: a battle, or (walls, too few to come out against
// it; or a siege ordered) a siege.
function engage(war, w, h, s, siege = false) {
  const now = war.sim.abs;
  const day = Math.floor(now / DAY);
  const rng = new RNG(hash4(h.id, now, 0x405));
  const plan = hostPlan(war, w, h, s, now + 20);
  const L = war.game.world.layouts.get(s.id);
  // A siege already there, of the realm's: the host joins it.
  if (w.siege && w.siege.sid === s.id && w.siege.phase !== 'over') {
    const S = w.siege;
    if (S.atk !== h.side) return null;
    S.host += hostSize(war, h);
    S.hostIds = [...new Set([...(S.hostIds || []), h.id])];
    h.state = 'siege';
    h.siege = S.id;
    note(war, h, `${cap(h.name)} has joined the siege of ${s.name}.`);
    return S;
  }
  if (siege) {
    const kind = L && L.walled ? 'battle' : war.siegeFor(w, plan, 1.5);
    if (kind && !w.siege) {
      const S = war.startSiegeFor(w, plan, kind === 'small' ? 'small' : 'shut', day, rng);
      if (S) {
        S.hostIds = [h.id];
        h.state = 'siege';
        h.siege = S.id;
        return S;
      }
    }
    note(war, h, `${cap(h.name)} is too few to surround ${s.name}: it will give battle instead.`);
  }
  // (Behind walls, and too weak to come out against it: they shut the gates.)
  if (L && L.walled && !w.siege) {
    const pa = war.armyPower(hostPool(war, h), h.side, w, plan);
    const dside = h.side === 'a' ? 'b' : 'a';
    const pd = war.armyPower(war.pool(w, dside, plan), dside, w, plan);
    if (pd < pa * 0.45) plan.shut = true;
  }
  h.plan = plan;
  h.state = 'fight';
  note(war, h, `${cap(h.name)} has come before ${s.name}${plan.shut ? ': its people have shut the gates against it' : ', and offers battle'}.`, true);
  return plan;
}

// The battle it gives at `s` (see War.battle).
export function hostPlan(war, w, h, s, at) {
  const site = war.siteNear(s, h.pos);
  const biome = war.biomeAt(site);
  const cell = war.cellAt(site);
  const FEATURE = { forest: 'Woods', taiga: 'Pines', jungle: 'Thicket', swamp: 'Fen', mountain: 'Pass', desert: 'Sands', savanna: 'Grass', tundra: 'Waste', beach: 'Strand', plains: 'Field' };
  const plan = {
    at, site, biome, river: !!(cell && cell.river), name: `the Battle of ${s.name} ${cell && cell.river ? 'Ford' : FEATURE[biome] || 'Field'}`,
    attacker: h.side, atk: h.sid, def: s.id, ca: w.lead.a, cb: w.lead.b, host: h.id, from: { ...h.pos },
  };
  if (h.cmd && h.cmd.kind === 'player') plan.cmd = { [h.side]: { pk: h.cmd.pk } };
  return plan;
}

// A host's battle due (see War.update).
export function hostBattlesDue(war) {
  const now = war.sim.abs;
  return (war.hosts || []).filter((h) => h.plan && !h.plan.live && now >= h.plan.at);
}

// After its battle: what it does next (see War.afterFight).
export function afterHostBattle(war, w, plan, rec) {
  const h = hostById(war, plan.host);
  if (!h) return;
  h.plan = null;
  const won = rec && rec.winner === h.side;
  const s = war.ow.settlements[plan.def];
  h.morale = clamp(h.morale + (won ? (rec.decisive ? 14 : 7) : -18), 0, 100);
  h.fought = (h.fought || 0) + 1;
  // Its people back in its ranks (on the ground: in the column again).
  for (const { r } of hostRecs(war, h)) {
    r.soldier = `h${h.id}`;
    r.away = true;
    const e = r.ent;
    if (e && !e.dead && !e.down && e.warband && (e.warband.phase === 'won' || e.warband.phase === 'flee' || e.warband.kind === 'battle')) {
      e.warband = { kind: 'host', host: h.id, side: h.side, civ: h.civ, foe: false, slot: e.warband.slot || 0 };
      e.hostileNow = false;
    }
  }
  if (w && w.siege && w.siege.sid === plan.def && w.siege.phase !== 'over') {
    h.state = 'siege';
    h.siege = w.siege.id;
    w.siege.hostIds = [...new Set([...(w.siege.hostIds || []), h.id])];
    return;
  }
  if (won && s && s.civ && s.civ.id === h.civ) {
    // (Taken: it holds it now.)
    h.state = 'camp';
    h.order = { kind: 'hold', target: s.id };
    note(war, h, `${cap(h.name)} holds ${s.name} now.`, true);
    return;
  }
  if (won) {
    h.state = 'camp';
    h.rest = war.sim.abs + 180;
    note(war, h, `${cap(h.name)} held the field before ${s ? s.name : 'the town'}, and camps there: it goes again after a rest.`);
    return;
  }
  // Beaten: back home, what's left of it.
  note(war, h, `${cap(h.name)} was beaten before ${s ? s.name : 'the town'}, and falls back home.`, true);
  h.state = 'camp';
  orderHost(war, null, h.id, 'home');
}

// ------------------------------------------------------------ sieges
// Leaving the siege it was part of (another order): the besiegers fewer.
function leaveSiege(war, w, h) {
  const S = w && w.siege;
  h.siege = null;
  if (!S || S.phase === 'over' || !(S.hostIds || []).includes(h.id)) return;
  S.hostIds = S.hostIds.filter((q) => q !== h.id);
  S.host = Math.max(1, S.host - hostSize(war, h));
  note(war, h, `${cap(h.name)} has left the siege of ${war.ow.settlements[S.sid]?.name}.`);
}

// A siege begun on a town a host of yours is holding: it's shut up in it,
// part of the garrison. Returns how many it adds.
export function hostsBesieged(war, w, S) {
  let n = 0;
  for (const h of war.hosts || []) {
    if (h.war !== w.id || h.side !== S.def || h.state !== 'camp' || !h.order || h.order.kind !== 'hold' || h.order.target !== S.sid) continue;
    h.state = 'siege';
    h.siege = S.id;
    h.inside = true;
    S.holderIds = [...(S.holderIds || []), h.id];
    n += hostSize(war, h);
    note(war, h, `${cap(h.name)} is shut up in ${war.ow.settlements[S.sid]?.name}: the enemy has laid siege to it.`, true);
  }
  return n;
}

// A siege over (see siege.js endSiege): the hosts in it count their dead
// (as many fell as the besiegers lost), and hold the town they took, or
// come home. (A host shut up in the town: its share of the garrison's
// dead; taken with it, if it falls.)
export function hostsAfterSiege(war, w, S, how) {
  const day = Math.floor(war.sim.abs / DAY);
  const rng = new RNG(hash4(S.id, day, 0x51e));
  const taken0 = how === 'stormed' || how === 'surrendered' || how === 'betrayed';
  for (const h of (war.hosts || []).filter((q) => (S.holderIds || []).includes(q.id))) {
    h.siege = null;
    h.inside = false;
    const lost = clamp(1 - S.garrison / Math.max(1, S.garrison0 || S.garrison), 0, 1);
    const civA = war.civ(S.civA);
    const sname = war.ow.settlements[S.sid]?.name || 'the town';
    for (const { r, L } of rng.shuffle(hostRecs(war, h))) {
      if (taken0) {
        if (rng.chance(0.4)) war.sim.recordDeath(L, r, `fell defending ${sname}`, null, day);
        else if (!(civA && war.takePrisoner(r, L, civA, day, `defending ${sname}`))) release(war, r, true);
      } else if (rng.chance(lost)) war.sim.recordDeath(L, r, `fell defending ${sname}`, null, day);
    }
    if (taken0 || !hostSize(war, h)) {
      disband(war, h, 'destroyed');
      continue;
    }
    h.state = 'camp';
    h.morale = clamp(h.morale + 12, 0, 100);
    note(war, h, `${cap(h.name)} held ${sname} through the siege.`, true);
  }
  const hs = (war.hosts || []).filter((h) => (S.hostIds || []).includes(h.id) || (h.siege === S.id && !h.inside));
  const total = hs.reduce((n, h) => n + hostSize(war, h), 0);
  let dead = Math.max(0, total - Math.max(0, Math.round(S.host)));
  const s = war.ow.settlements[S.sid];
  for (const h of hs) {
    h.siege = null;
    for (const { r, L } of rng.shuffle(hostRecs(war, h))) {
      if (dead <= 0) break;
      if (h.cmd && h.cmd.kind === 'npc' && h.cmd.idx === r.idx && h.cmd.sid === L.settlement.id && rng.chance(0.7)) continue;
      war.sim.recordDeath(L, r, `fell before the walls of ${s ? s.name : 'the town'}`, null, day);
      dead--;
    }
    if (!hostSize(war, h)) {
      disband(war, h, 'destroyed');
      continue;
    }
    const taken = how === 'stormed' || how === 'surrendered' || how === 'betrayed';
    if (taken && s && s.civ && s.civ.id === h.civ) {
      h.state = 'camp';
      h.pos = centreOf(s);
      h.order = { kind: 'hold', target: s.id };
      h.morale = clamp(h.morale + 15, 0, 100);
      note(war, h, `${cap(h.name)} holds ${s.name} now.`, true);
    } else {
      h.state = 'camp';
      h.morale = clamp(h.morale - 12, 0, 100);
      orderHost(war, null, h.id, 'home');
    }
  }
}

// ------------------------------------------------------------ each day
// Away from home a while: weary, short of things, a few slip away when its
// nerve is gone (and it goes home of itself, if it's broken).
export function hostsDay(war, day, rng) {
  for (const h of (war.hosts || []).slice()) {
    const w = war.wars.find((q) => q.id === h.war);
    if (!w && h.state !== 'march') {
      orderHost(war, null, h.id, 'home');
      continue;
    }
    if (h.state === 'muster' || h.state === 'home') continue;
    const atHome = dist(h.pos, centreOf(war.ow.settlements[h.sid])) <= 30;
    h.morale = clamp(h.morale + (atHome ? 2 : h.state === 'siege' ? -2 : -1) + (commanderRec(war, h)?.captain ? 0.5 : 0), 0, 100);
    for (const { r } of hostRecs(war, h)) r.hp = Math.min(r.maxHp ?? 12, (r.hp ?? 12) + 2);
    if (h.morale < 22) {
      const go = rng.shuffle(hostRecs(war, h)).filter(({ r }) => r.job !== 'guard').slice(0, rng.int(1, 2));
      for (const { r } of go) release(war, r, true);
      if (go.length) note(war, h, `${go.length === 1 ? `${fullName(go[0].r)} has` : `${go.length} of them have`} slipped away from ${h.name} in the night, and gone home.`);
      if (h.morale < 12 && h.order && h.order.kind !== 'home' && h.state !== 'fight') {
        note(war, h, `${cap(h.name)} has lost heart, and turns for home.`, true);
        orderHost(war, null, h.id, 'home');
      }
    }
  }
}

// ------------------------------------------------------------ the end
// Stood down (home, or every one of them gone): everyone back to their own.
export function disband(war, h, how) {
  war.hosts = (war.hosts || []).filter((q) => q !== h);
  const w = war.wars.find((q) => q.id === h.war);
  if (h.siege !== undefined && h.siege !== null) leaveSiege(war, w, h);
  for (const m of h.members) {
    const L = war.game.world.layouts.get(m.sid);
    const r = L ? L.npcs[m.idx] : null;
    if (r && r.host === h.id) release(war, r, true);
  }
  for (const n of war.game.npcs) if (n.warband && n.warband.kind === 'host' && n.warband.host === h.id) {
    n.warband = { kind: 'host', host: h.id, phase: 'flee', home: centreOf(war.ow.settlements[h.sid]) };
  }
  h.state = 'gone';
  (war.pastHosts ||= []).push({ id: h.id, civ: h.civ, name: h.name, how, day: Math.floor(war.sim.abs / DAY), fought: h.fought || 0 });
  if (war.pastHosts.length > 12) war.pastHosts.shift();
  const s = war.ow.settlements[h.sid];
  note(war, h, how === 'destroyed' ? `${cap(h.name)} is no more: every one of them fallen or taken.` : `${cap(h.name)} is home at ${s ? s.name : 'its town'}, and stands down.`, true);
}

// One of a host (or an outpost's garrison) gone home: theirs again, about
// their town (`home`: whether they're back in it now).
export function release(war, r, home = true) {
  delete r.host;
  delete r.outpost;
  if (r.soldier !== undefined) delete r.soldier;
  if (!r.captive && home) r.away = false;
}

// ------------------------------------------------------------ the word of it
// The host's news: in its town's ledger, and (`loud`, or yours) to you.
function note(war, h, text, loud = false) {
  const g = war.game;
  const day = Math.floor(war.sim.abs / DAY);
  h.log.push({ day, text });
  if (h.log.length > 16) h.log.shift();
  const L = g.world.layouts.get(h.sid);
  if (L && L.econ && loud) ledger(L, day, text);
  // (To whoever raised it or commands it, and the realm's ruler.)
  const all = g.everyone ? g.everyone() : [g.player];
  for (const p of all) {
    if (!p) continue;
    const pk = pkOf(p);
    const mine = h.by === pk || (h.cmd && h.cmd.pk === pk) || g.asPlayer(p, () => war.playerCiv())?.id === h.civ;
    if (mine) g.asPlayer(p, () => g.ui.msg(text, loud ? '#ffd070' : '#e8d8b0'));
  }
}

// ------------------------------------------------------------ to show
// A line about it: how many, where, doing what.
export function hostLine(war, h) {
  const n = hostSize(war, h);
  const o = h.order;
  const where = o ? (o.kind === 'clear' ? (war.outposts || []).find((q) => q.id === o.target)?.name : war.ow.settlements[o.target]?.name) : null;
  const doing = h.state === 'muster' ? `mustering at ${war.ow.settlements[h.sid]?.name}` : h.state === 'march' && o ? `marching ${o.kind === 'home' ? 'home' : `to ${o.kind === 'attack' ? 'attack' : o.kind === 'siege' ? 'besiege' : o.kind === 'clear' ? 'clear' : 'hold'} ${where}`}` : h.state === 'camp' ? (o && o.kind === 'hold' ? `holding ${where}` : o && o.kind === 'attack' ? `camped before ${where}` : 'in camp') : h.state === 'fight' ? `giving battle at ${where}` : h.state === 'siege' ? `besieging ${where}` : STATE_WORDS[h.state] || h.state;
  return { n, doing, morale: Math.round(h.morale) };
}

// When it gets where it's going (minutes from now), or null.
export function hostEta(war, h) {
  if (!h.leg || h.state !== 'march') return null;
  return Math.max(0, h.leg.arr - war.sim.abs);
}

// For the world map: each host as an army on the march (or in camp).
export function hostMarkers(war) {
  const out = [];
  for (const h of war.hosts || []) {
    const civ = war.civ(h.civ);
    const at = hostAt(war, h);
    const L0 = hostLine(war, h);
    out.push({ x: Math.round(at.x), z: Math.round(at.z), kind: 'army', color: civ ? civ.color.hex : '#c03030', label: `${cap(h.name)}, ${L0.n} strong: ${L0.doing}`, host: h.id });
  }
  return out;
}

// What a host is called and doing, for the HUD of whoever commands it.
export function hostHud(war, p) {
  const pk = pkOf(p);
  const out = [];
  for (const h of war.hosts || []) {
    if (h.by !== pk && !(h.cmd && h.cmd.pk === pk)) continue;
    const L0 = hostLine(war, h);
    const eta = hostEta(war, h);
    out.push({ text: `${h.name.replace(/^the /, '').toUpperCase().slice(0, 14)} ${L0.n} · ${L0.doing.toUpperCase().slice(0, 18)}${eta !== null ? ` ${Math.ceil(eta / 60)}H` : ''}`.slice(0, 24), color: civColor(war, h) });
  }
  return out.slice(0, 3);
}

const civColor = (war, h) => (war.civ(h.civ) ? war.civ(h.civ).color.hex : '#e8d8b0');

// (For the ground: who of a host to show, near you, and where.)
export function hostNear(war, at, r) {
  return (war.hosts || []).filter((h) => h.state !== 'muster' && h.state !== 'gone' && h.state !== 'siege' && !(h.plan && h.plan.live)).filter((h) => {
    const q = hostAt(war, h);
    return Math.max(Math.abs(q.x - at.x), Math.abs(q.z - at.z)) <= r;
  });
}

export { pkOf as hostPk, STATE_WORDS, note as hostNews };
