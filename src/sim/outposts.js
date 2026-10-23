// (Round 145) Outposts. In a war, a town near the front puts up a post out
// on the way the enemy would come: a watchtower (a few of the watch up on a
// platform of logs, seeing a long way), or a stockade (a ring of log walls
// with stakes before it, more of them, harder to take). The towns of a
// realm do it of themselves (the nearer the enemy, the likelier, if they
// can spare the coin and the guards); one of you who leads can order one
// put up, facing whichever enemy town you choose.
//
// Anything of the enemy's on the march that comes within sight of one is
// met there: a skirmish at the outpost. A host (see hosts.js), the enemy's
// army on its way to a battle, a raiding party on the road. The garrison
// fights from behind its logs; win or lose, the marchers are held up (an
// hour or two, more if they're thrown back), and lose some on the way. If
// they carry it, the outpost's burned, its garrison killed, taken or fled;
// if not, it stands. Near you, the skirmish is fought out on the ground.
// A host can be sent to clear one out of the way.
//
// At the war's end, the garrisons go home and the posts stand empty (to be
// manned again, cheaply, in another war; or, left a while, taken down).
import { alive, ledger, DAY } from './econ.js';
import { RNG, hash4, clamp } from '../util/rng.js';
import { REGION_W, REGION_D } from '../config.js';
import { hostById, hostRecs, holdUp, commanderMult, release, hostNews, orderHost, hostSize } from './hosts.js';

const residents = (L) => L.npcs.filter((r) => alive(r) && !r.away && !r.migrated && !r.visitor);
const plain = (civ) => (civ ? civ.name.replace(/^The /, '') : 'free folk');
const fullName = (r) => `${r.name.first} ${r.name.last}`;
const centreOf = (s) => ({ x: Math.floor((s.cx + (s.cw || 1) / 2) * REGION_W), z: Math.floor((s.cz + (s.cd || 1) / 2) * REGION_D) });
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

// The kinds: how far each sees (tiles), how much harder its garrison is to
// beat, what it costs, how many hold it, how long it takes to put up
// (minutes), how long it holds marchers up (minutes, at least and most).
export const OUTPOST_KINDS = {
  tower: { name: 'watchtower', sees: 16, hold: 1.35, cost: 45, gar: 3, build: 10 * 60, halt: [50, 120], spot: 0.75 },
  stockade: { name: 'stockade', sees: 11, hold: 1.85, cost: 90, gar: 5, build: 20 * 60, halt: [100, 220], spot: 0.55 },
};
export const OUTPOST_IDS = Object.keys(OUTPOST_KINDS);

export const outpostById = (war, id) => (war.outposts || []).find((q) => q.id === id) || null;
const live = (O) => O.state === 'manned' || O.state === 'building';

// Who holds it (alive, not taken, still its own).
export function garrisonRecs(war, O) {
  const out = [];
  for (const m of O.gar) {
    const L = war.game.world.layouts.get(m.sid);
    const r = L ? L.npcs[m.idx] : null;
    if (r && alive(r) && !r.captive && r.outpost === O.id) out.push({ r, L, d: 0 });
  }
  return out;
}

export function garrisonPool(war, O) {
  const civ = war.civ(O.civ);
  return { recs: garrisonRecs(war, O), extra: 0, civs: civ ? [civ] : [], outpost: O.id };
}

// ------------------------------------------------------------ where
// Out on the way from `s` toward `foe`: past the edge of the town, on dry
// land, in nobody's town, clear of any other post.
export function placeFor(war, s, foe, rng) {
  const a = centreOf(s);
  const b = centreOf(foe);
  const d = dist(a, b) || 1;
  const ux = (b.x - a.x) / d;
  const uz = (b.z - a.z) / d;
  const bd = s.bounds;
  let t = 0;
  while (t < d * 0.5) {
    const x = a.x + ux * t;
    const z = a.z + uz * t;
    if (x < bd.x0 - 4 || x > bd.x1 + 4 || z < bd.z0 - 4 || z > bd.z1 + 4) break;
    t += 2;
  }
  const ow = war.ow;
  const ok = (x, z) => {
    const c = ow.cell(Math.floor(x / REGION_W), Math.floor(z / REGION_D));
    if (!c || c.biome === 'ocean' || c.lake || c.river) return false;
    if (ow.settlementAt(x, z)) return false;
    return !(war.outposts || []).some((q) => q.state !== 'gone' && dist(q, { x, z }) < 14);
  };
  for (let k = 0; k < 12; k++) {
    const along = Math.min(t + 16 + (k % 4) * 5, d * 0.5);
    const side = k < 4 ? 0 : (k % 2 ? 1 : -1) * (4 + Math.floor(k / 2) * 2);
    const x = Math.round(a.x + ux * along - uz * side + (rng ? rng.int(-1, 1) : 0));
    const z = Math.round(a.z + uz * along + ux * side + (rng ? rng.int(-1, 1) : 0));
    if (ok(x, z)) return { x, z, face: { x: ux, z: uz } };
  }
  return null;
}

// Its name: the town's watchtower, or the stockade on the way to theirs.
function nameFor(war, s, kind, foe) {
  const n = (war.outposts || []).filter((q) => q.sid === s.id && q.kind === kind).length;
  const towards = foe ? ` on the ${foe.name} Road` : '';
  if (kind === 'tower') return n ? `the Far Watch of ${s.name}` : `the ${s.name} Watchtower`;
  return n ? `the ${s.name} Stockade${towards}` : `the ${s.name} Stockade`;
}

// ------------------------------------------------------------ putting one up
// An outpost put up by town `s` facing `foe`, of `kind`: its garrison out
// of the town's watch (and levy), its cost out of the town's treasury.
// `by`: 'ai', or one of you (their key). An empty post of the town's from
// before is manned again instead (quicker, cheaper). Returns the outpost,
// or { ok: false, why }.
export function buildOutpost(war, w, s, foe, kind, by, rng) {
  const g = war.game;
  const K = OUTPOST_KINDS[kind];
  const L = g.world.layouts.get(s.id);
  if (!K || !L || !L.econ) return { ok: false, why: 'It can\'t be built there.' };
  if (!s.civ || !foe || !foe.civ || !war.enemies(s.civ, foe.civ)) return { ok: false, why: `${foe ? foe.name : 'That'} isn't the enemy's.` };
  if (w.siege && w.siege.sid === s.id) return { ok: false, why: `${s.name} is besieged: no one gets out to build.` };
  const mine = (war.outposts || []).filter((q) => q.sid === s.id && live(q));
  const most = s.type === 'city' ? 3 : s.type === 'village' ? 1 : 2;
  if (mine.length >= most) return { ok: false, why: `${s.name} can't man more than ${most} outpost${most === 1 ? '' : 's'}.` };
  const old = (war.outposts || []).find((q) => q.sid === s.id && q.state === 'empty' && q.kind === kind);
  const cost = old ? Math.round(K.cost / 2) : K.cost;
  if ((L.econ.treasury || 0) < cost) return { ok: false, why: `${s.name}'s treasury can't pay for it (¤${cost}).` };
  // The garrison: the watch (one stays home), then the levy.
  const free = (r) => r.ruler === undefined && r.councillor === undefined && r.raid === undefined && r.soldier === undefined && r.captive === undefined && r.host === undefined && r.outpost === undefined && !r.trip?.phase?.startsWith('away') && r.age === 'adult';
  const people = residents(L).filter(free);
  const guards = people.filter((r) => r.job === 'guard').sort((x, y) => (y.personality?.bravery ?? 0.5) - (x.personality?.bravery ?? 0.5));
  const levy = people.filter((r) => r.job !== 'guard' && !['mayor', 'priest', 'noble', 'merchant', 'innkeeper', 'barkeep', 'blacksmith', 'scholar', 'researcher', 'herbalist'].includes(r.job)).sort((x, y) => (y.personality?.bravery ?? 0.5) - (x.personality?.bravery ?? 0.5));
  const pick = [...guards.slice(0, Math.max(0, guards.length - 1)), ...levy].slice(0, K.gar);
  if (pick.length < 2) return { ok: false, why: `${s.name} can't spare anyone to hold it.` };
  const now = war.sim.abs;
  const day = Math.floor(now / DAY);
  let O = old;
  if (O) {
    O.state = 'building';
    O.ready = now + 120;
    O.war = w.id;
    O.gar = [];
    O.by = by;
  } else {
    const at = placeFor(war, s, foe, rng);
    if (!at) return { ok: false, why: 'There\'s nowhere fit for it on that side of the town.' };
    O = { id: war.nextId++, war: w.id, civ: s.civ.id, sid: s.id, kind, x: at.x, z: at.z, face: at.face, toward: foe.id, name: nameFor(war, s, kind, foe), gar: [], state: 'building', ready: now + K.build, day, by, placed: [], log: [], fights: 0 };
    (war.outposts ||= []).push(O);
  }
  L.econ.treasury -= cost;
  for (const r of pick) {
    r.outpost = O.id;
    r.soldier = `o${O.id}`;
    r.away = true;
    if (r.ent && !r.ent.dead && !war.game.inSight(r.ent.x, r.ent.z, 2)) war.game.despawnNpc(r.ent);
    O.gar.push({ sid: s.id, idx: r.idx });
  }
  const text = old ? `${pick.length} of ${s.name}'s watch have gone out to man ${O.name} again.` : `${s.name} is putting up ${K.name === 'watchtower' ? 'a watchtower' : 'a stockade'} out on the way to ${foe.name}: ${O.name}, ${pick.length} to hold it.`;
  log(war, O, text);
  ledger(L, day, text);
  return O;
}

// Reinforced from its town (up to its full strength again).
export function reinforce(war, O) {
  const g = war.game;
  const L = g.world.layouts.get(O.sid);
  const K = OUTPOST_KINDS[O.kind];
  if (!L || !live(O)) return { ok: false, why: 'It can\'t be reinforced.' };
  const have = garrisonRecs(war, O).length;
  if (have >= K.gar) return { ok: false, why: 'It\'s fully manned.' };
  const people = residents(L).filter((r) => r.age === 'adult' && r.ruler === undefined && r.soldier === undefined && r.captive === undefined && r.host === undefined && r.outpost === undefined && r.raid === undefined && r.job !== 'mayor');
  const guards = people.filter((r) => r.job === 'guard');
  const pick = [...guards.slice(0, Math.max(0, guards.length - 1)), ...people.filter((r) => r.job !== 'guard')].slice(0, K.gar - have);
  if (!pick.length) return { ok: false, why: `${L.settlement.name} has no one to send.` };
  for (const r of pick) {
    r.outpost = O.id;
    r.soldier = `o${O.id}`;
    r.away = true;
    O.gar.push({ sid: O.sid, idx: r.idx });
  }
  log(war, O, `${pick.length} more of ${L.settlement.name} have gone out to ${O.name}.`);
  return { ok: true, n: pick.length };
}

// Abandoned: its garrison home, the post left standing empty.
export function abandon(war, O, why = 'abandoned') {
  for (const { r } of garrisonRecs(war, O)) release(war, r, true);
  O.gar = [];
  if (O.state !== 'burned') O.state = 'empty';
  O.emptyDay = Math.floor(war.sim.abs / DAY);
  log(war, O, `${cap(O.name)} has been ${why}.`);
}

// ------------------------------------------------------------ each day
// Put up and manned; the towns near the front putting up their own; the
// garrisons mended; empty posts long left taken down.
export function outpostsDay(war, w, day, rng) {
  const now = war.sim.abs;
  for (const O of war.outposts || []) {
    if (O.war !== w.id) continue;
    if (O.state === 'building' && now >= O.ready) {
      O.state = 'manned';
      log(war, O, `${cap(O.name)} is up, and manned.`);
    }
    if (live(O) && !garrisonRecs(war, O).length) abandon(war, O, 'left empty: its garrison all gone');
    for (const { r } of garrisonRecs(war, O)) r.hp = Math.min(r.maxHp ?? 12, (r.hp ?? 12) + 2);
  }
  // The realms' towns near the front (not those one of you governs, or
  // rules: yours to decide).
  for (const [side, foeSide] of [['a', 'b'], ['b', 'a']]) {
    const foes = w[foeSide].map((id) => war.civ(id)).filter(Boolean).flatMap((c) => war.realms.members(c));
    if (!foes.length) continue;
    for (const id of w[side]) {
      const civ = war.civ(id);
      if (!civ || (war.sim.crown && war.sim.crown.ruled && war.sim.crown.ruled(civ))) continue;
      for (const s of war.realms.members(civ)) {
        const L = war.game.world.layouts.get(s.id);
        if (!L || !L.econ || (war.sim.office && war.sim.office.of && war.sim.office.of(s.id)?.holder)) continue;
        const foe = foes.slice().sort((p, q) => Math.hypot(p.cx - s.cx, p.cz - s.cz) - Math.hypot(q.cx - s.cx, q.cz - s.cz))[0];
        const d = Math.hypot(foe.cx - s.cx, foe.cz - s.cz);
        if (d > 26) continue;
        const have = (war.outposts || []).filter((q) => q.sid === s.id && live(q)).length;
        if (have >= (s.type === 'city' ? 2 : 1)) continue;
        if (!rng.chance(0.18 + (d < 14 ? 0.14 : 0))) continue;
        const guards = residents(L).filter((r) => r.job === 'guard').length;
        const kind = (L.econ.treasury || 0) >= 220 && guards >= 5 && rng.chance(0.45) ? 'stockade' : 'tower';
        buildOutpost(war, w, s, foe, kind, 'ai', rng);
      }
    }
  }
}

// Any day: posts empty or burned a long while taken down (see the ground).
export function outpostsSweep(war, day) {
  for (const O of war.outposts || []) {
    if ((O.state === 'empty' || O.state === 'burned') && day - (O.emptyDay ?? O.day) > 24) O.state = 'gone';
  }
  // (Gone, and nothing of it left standing: forgotten.)
  war.outposts = (war.outposts || []).filter((O) => O.state !== 'gone' || (O.placed && O.placed.length));
}

// The war over: every garrison of it home.
export function outpostsStandDown(war, w) {
  for (const O of war.outposts || []) if (O.war === w.id && live(O)) abandon(war, O, 'stood down: the war is over');
}

// ------------------------------------------------------------ in the way
// Something of the enemy's on the move (`mover`: { kind: 'host' or 'army',
// host, w, plan, civ, side, at, from, passed }) within sight of an outpost
// manned against it: a skirmish there. True if there was one.
export function outpostWatch(war, w, mover) {
  const civ = war.civ(mover.civ);
  if (!civ) return false;
  for (const O of war.outposts || []) {
    if (O.state !== 'manned' || mover.passed.includes(O.id)) continue;
    const K = OUTPOST_KINDS[O.kind];
    if (dist(O, mover.at) > K.sees) continue;
    const oc = war.civ(O.civ);
    if (!oc || !war.enemies(civ, oc)) continue;
    mover.passed.push(O.id);
    skirmish(war, w, O, mover);
    return true;
  }
  return false;
}

// Sent straight at it (a host told to clear it).
export function outpostAssault(war, w, O, mover) {
  if (!mover.passed.includes(O.id)) mover.passed.push(O.id);
  return skirmish(war, w, O, mover);
}

// Who comes on at the post: a host, all of it; an army, its vanguard.
function attackers(war, w, mover, n) {
  if (mover.kind === 'host') {
    const h = hostById(war, mover.host);
    return h ? hostRecs(war, h) : [];
  }
  const P = war.pool(w, mover.side, mover.plan);
  return P.recs.filter((q) => alive(q.r) && !q.r.captive).sort((p, q) => p.d - q.d).slice(0, n);
}

// The skirmish: fought out where you are, or reckoned up.
function skirmish(war, w, O, mover) {
  const gar = garrisonRecs(war, O);
  if (!gar.length) {
    abandon(war, O, 'found empty');
    return null;
  }
  const n = Math.max(6, gar.length * 3 + 3);
  if (!war.live && war.nearPlayer(O, 60) && startSkirmish(war, w, O, mover, n)) return 'live';
  return resolveSkirmish(war, w, O, mover, n, new RNG(hash4(O.id, war.sim.abs, 0x5c1)));
}

// Off-screen: the two sides' strength, the post's walls on the garrison's;
// who falls, who's taken; held up either way.
export function resolveSkirmish(war, w, O, mover, n, rng) {
  const K = OUTPOST_KINDS[O.kind];
  const g = war.game;
  const day = Math.floor(war.sim.abs / DAY);
  const s = war.ow.settlements[O.sid];
  const gar = garrisonRecs(war, O);
  const atk = attackers(war, w, mover, n);
  const civA = war.civ(mover.civ);
  const h = mover.kind === 'host' ? hostById(war, mover.host) : null;
  const pa = atk.reduce((k, q) => k + war.soldierPower(q.r, q.L.settlement), 0) * (h ? commanderMult(war, h) : 1);
  const pd = gar.reduce((k, q) => k + war.soldierPower(q.r, s), 0) * K.hold * (war.sim.tech.has(s, 'fortress') ? 1.15 : 1);
  const won = atk.length > 0 && rng.chance(pa / (pa + pd * 1.2 + 0.4));
  let lossA = won ? rng.int(0, Math.ceil(gar.length * 0.4)) : rng.int(1, Math.max(1, Math.ceil(gar.length * 0.7)));
  lossA = Math.min(lossA, Math.max(0, atk.length - 1));
  const fellA = [];
  for (const q of rng.shuffle(atk.slice()).slice(0, lossA)) {
    if (rng.chance(0.7)) {
      war.sim.recordDeath(q.L, q.r, `fell at ${O.name}`, null, day);
      fellA.push(q.r);
    } else q.r.hp = Math.max(3, (q.r.hp ?? 12) - rng.int(4, 8));
  }
  const fellD = [];
  let taken = 0;
  if (won) {
    for (const q of gar) {
      const roll = rng.next();
      if (roll < 0.45) {
        war.sim.recordDeath(q.L, q.r, `fell holding ${O.name}`, null, day);
        fellD.push(q.r);
      } else if (roll < 0.75 && civA && war.takePrisoner(q.r, q.L, civA, day, `holding ${O.name}`)) taken++;
      else release(war, q.r, true);
    }
    O.gar = [];
    O.state = 'burned';
    O.emptyDay = day;
  } else {
    for (const q of rng.shuffle(gar.slice()).slice(0, rng.int(0, Math.ceil(gar.length * 0.35)))) {
      war.sim.recordDeath(q.L, q.r, `fell holding ${O.name}`, null, day);
      fellD.push(q.r);
    }
  }
  O.fights = (O.fights || 0) + 1;
  const delay = rng.int(K.halt[0], K.halt[1]) + (won ? 0 : 90);
  slow(war, w, mover, delay);
  const who = h ? h.name : mover.kind === 'army' ? `the army of the ${plain(civA)}` : `the ${plain(civA)}`;
  const text = won
    ? `${cap(who)} came on ${O.name} and carried it: ${fellD.length ? `${fellD.length} of its garrison killed` : 'its garrison fled'}${taken ? `, ${taken} taken` : ''}, and the post burned. It cost them ${fellA.length ? `${fellA.length} dead` : 'nothing but time'}, and ${Math.round(delay / 60)} hours.`
    : `${cap(who)} came on ${O.name} and was thrown back${fellA.length ? `, ${fellA.length} of them fallen` : ''}; ${fellD.length ? `${fellD.length} of the garrison fell` : 'the garrison held'}. They had to go round it, ${Math.round(delay / 60)} hours lost.`;
  log(war, O, text);
  const L = g.world.layouts.get(O.sid);
  if (L && L.econ) ledger(L, day, text);
  if (h) hostNews(war, h, text, true);
  else if (civA && war.playerCiv() && (war.playerCiv() === civA || war.playerCiv() === war.civ(O.civ))) g.ui.msg(text, '#ffd090');
  // (A host bloodied and broken by it: home.)
  if (h) {
    h.morale = clamp(h.morale + (won ? 5 : -10), 0, 100);
    if (!won && (hostSize(war, h) < h.n0 * 0.45 || h.morale < 18) && h.order && h.order.kind !== 'home') orderHost(war, null, h.id, 'home');
    else if (won && h.order && h.order.kind === 'clear' && h.order.target === O.id) h.state = 'camp';
  }
  return { won, lossA: fellA.length, lossD: fellD.length, taken, delay };
}

// Held up: a host stands where it is a while; an army's battle comes later.
function slow(war, w, mover, min) {
  if (mover.kind === 'host') {
    const h = hostById(war, mover.host);
    if (h) holdUp(war, h, min);
    return null;
  }
  const plan = mover.plan;
  if (!plan) return null;
  const now = war.sim.abs;
  const halt = { from: now, until: now + min };
  (plan.halts ||= []).push(halt);
  plan.at += min;
  return halt;
}

// On the ground, near you: the marchers come on at the post, its garrison
// out before it to meet them (a battle like any other; see war.js).
function startSkirmish(war, w, O, mover, n) {
  const s = war.ow.settlements[O.sid];
  const town = centreOf(s);
  const atkPt = { x: Math.round(mover.at.x), z: Math.round(mover.at.z) };
  const pA = mover.side === 'a' ? atkPt : town;
  const pB = mover.side === 'a' ? town : atkPt;
  const d = dist(pA, pB) || 1;
  const ax = { x: (pA.x - pB.x) / d, z: (pA.z - pB.z) / d };
  const dside = mover.side === 'a' ? 'b' : 'a';
  const dsign = dside === 'a' ? 1 : -1;
  // (The middle of the field: the garrison's line at the post itself.)
  const site = { x: Math.round(O.x - ax.x * 11 * dsign), z: Math.round(O.z - ax.z * 11 * dsign) };
  const plan = {
    at: war.sim.abs, site, biome: war.biomeAt(site), river: false, name: `the Skirmish at ${O.name}`,
    attacker: mover.side, atk: mover.from, def: O.sid, ca: w.lead.a, cb: w.lead.b,
    skirmish: true, outpost: O.id, from: atkPt, toward: town, ta: 'line', tb: 'hold', cap: 24,
    host: mover.kind === 'host' ? mover.host : undefined, vanguard: mover.kind === 'host' ? undefined : n, armyPlan: mover.kind === 'army' ? mover.plan : null,
  };
  war.draftNear(w, plan);
  // (Stood still for it, while it's fought: the rest when it's over.)
  const halt = slow(war, w, mover, 600);
  if (!war.startLiveBattle(w, plan)) {
    // (Nobody could be put on the field: reckoned up instead.)
    undoHalt(war, mover, halt, 0);
    return false;
  }
  plan.halt = halt;
  if (mover.kind === 'host') {
    const h = hostById(war, mover.host);
    plan.halt = h && h.leg ? h.leg.halts[h.leg.halts.length - 1] : null;
  }
  return true;
}

// A hold-up shortened (or lengthened) to end `min` minutes from now.
function undoHalt(war, mover, halt, min) {
  const now = war.sim.abs;
  if (mover.kind === 'host') {
    const h = hostById(war, mover.host);
    if (!h || !h.leg || !h.leg.halts.length) return;
    const q = h.leg.halts[h.leg.halts.length - 1];
    const was = q.until;
    q.until = Math.max(q.from, now + min);
    h.leg.arr += q.until - was;
    return;
  }
  if (!halt || !mover.plan) return;
  const was = halt.until;
  halt.until = Math.max(halt.from, now + min);
  mover.plan.at += halt.until - was;
}

// The skirmish fought out near you is over (see War.afterFight): the post
// burned or held; the marchers on their way again, a while later.
export function afterSkirmish(war, w, plan, rec) {
  const O = outpostById(war, plan.outpost);
  const won = rec && rec.winner === plan.attacker;
  const day = Math.floor(war.sim.abs / DAY);
  const mover = plan.host !== undefined ? { kind: 'host', host: plan.host } : { kind: 'army', plan: plan.armyPlan };
  undoHalt(war, mover, plan.halt, won ? 30 : 120);
  if (!O) return;
  O.fights = (O.fights || 0) + 1;
  if (won) {
    for (const { r } of garrisonRecs(war, O)) release(war, r, true);
    O.gar = [];
    O.state = 'burned';
    O.emptyDay = day;
    log(war, O, `${cap(O.name)} was taken and burned, at ${plan.name}.`);
  } else log(war, O, `${cap(O.name)} held, at ${plan.name}.`);
  const h = plan.host !== undefined ? hostById(war, plan.host) : null;
  if (h) {
    h.morale = clamp(h.morale + (won ? 6 : -12), 0, 100);
    // Its people in their column again.
    for (const { r } of hostRecs(war, h)) {
      r.soldier = `h${h.id}`;
      r.away = true;
      const e = r.ent;
      if (e && !e.dead && !e.down && e.warband) {
        e.warband = { kind: 'host', host: h.id, side: h.side, civ: h.civ, foe: false, slot: e.warband.slot || 0 };
        e.hostileNow = false;
      }
    }
    if (h.order && h.order.kind === 'clear' && h.order.target === O.id) h.state = 'camp';
    if (!won && hostSize(war, h) < h.n0 * 0.45 && h.order && h.order.kind !== 'home') orderHost(war, null, h.id, 'home');
  }
}

// A raiding party on the road, past a post of the town it's after: seen
// from it, maybe, and met. True if they were turned back.
export function raidWatch(war, raid, FL, TL) {
  const a = centreOf(FL.settlement);
  const b = centreOf(TL.settlement);
  const civ = war.civ(raid.civ);
  for (const O of war.outposts || []) {
    if (O.state !== 'manned' || !civ) continue;
    const oc = war.civ(O.civ);
    if (!oc || !war.enemies(civ, oc)) continue;
    const K = OUTPOST_KINDS[O.kind];
    if (segDist(O, a, b) > K.sees) continue;
    const rng = new RNG(hash4(raid.id, O.id, 0x7a1));
    if (!rng.chance(K.spot)) continue;
    const party = war.partyRecs(raid).map((r) => ({ r, L: FL }));
    const gar = garrisonRecs(war, O);
    if (!gar.length) continue;
    const s = war.ow.settlements[O.sid];
    const pa = party.reduce((k, q) => k + war.soldierPower(q.r, FL.settlement), 0);
    const pd = gar.reduce((k, q) => k + war.soldierPower(q.r, s), 0) * K.hold;
    const day = Math.floor(war.sim.abs / DAY);
    const held = rng.chance(pd / (pa + pd + 0.3));
    let fell = 0;
    for (const q of rng.shuffle(party.slice()).slice(0, held ? rng.int(0, 2) : rng.int(0, 1))) {
      war.sim.recordDeath(q.L, q.r, `fell at ${O.name}`, null, day);
      fell++;
    }
    O.fights = (O.fights || 0) + 1;
    const text = held
      ? `Raiders of the ${plain(civ)} were seen from ${O.name} in the night, and driven back over the border${fell ? `, ${fell} of them fallen` : ''}.`
      : `Raiders of the ${plain(civ)} slipped past ${O.name} in the night${fell ? `, though ${fell} of them fell to its watch` : ''}.`;
    log(war, O, text);
    if (TL.econ) ledger(TL, day, text);
    return held;
  }
  return false;
}

// How far a point is from the straight way between a and b.
function segDist(p, a, b) {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const L2 = dx * dx + dz * dz || 1;
  const t = clamp(((p.x - a.x) * dx + (p.z - a.z) * dz) / L2, 0, 1);
  return Math.hypot(p.x - (a.x + dx * t), p.z - (a.z + dz * t));
}

// ------------------------------------------------------------ to show
function log(war, O, text) {
  O.log.push({ day: Math.floor(war.sim.abs / DAY), text });
  if (O.log.length > 10) O.log.shift();
}
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

export function outpostLine(war, O) {
  const K = OUTPOST_KINDS[O.kind];
  const n = garrisonRecs(war, O).length;
  const st = O.state === 'building' ? `going up (${Math.max(1, Math.ceil((O.ready - war.sim.abs) / 60))}h)` : O.state === 'manned' ? `${n} holding it` : O.state === 'burned' ? 'burned' : 'standing empty';
  return { name: O.name, kind: K.name, n, state: st };
}

// For the world map: the posts of the realms at war, and the ruins.
export function outpostMarkers(war) {
  const out = [];
  for (const O of war.outposts || []) {
    if (O.state === 'gone') continue;
    const civ = war.civ(O.civ);
    const L0 = outpostLine(war, O);
    out.push({ x: O.x, z: O.z, kind: 'outpost', burned: O.state === 'burned', empty: O.state === 'empty', color: civ ? civ.color.hex : '#a08060', label: `${cap(O.name)}: a ${L0.kind} of ${war.ow.settlements[O.sid]?.name || '?'}${civ ? ` (the ${plain(civ)})` : ''}, ${L0.state}`, id: O.id });
  }
  return out;
}

export { fullName as outpostFullName };
