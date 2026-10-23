// (Round 144) Sieges. A walled town isn't taken in a day any more: beaten in
// the field, its defenders fall back inside and shut the gates, and the
// victors dig in outside. (So too a town too weak to come out and fight;
// and an unwalled one, against an army strong enough to surround it: the
// streets barricaded, a shorter siege of it.)
//
// Day by day: the town eats its stores (half rations or a quarter make them
// last, and cost its nerve); hungry, it frays; the camp outside grows sick
// and weary in its turn. Catapults knock at the wall, stretch by stretch,
// till one comes down; sappers dig under another (the defenders may find
// the tunnel and fill it in); a ram's built for the gate, ladders for the
// walls. The besiegers' commander chooses when, and where, to assault: the
// gate, a breach, the walls by ladder, several at once. The defenders
// sally out at the engines; they may treat (terms offered, terms refused);
// starving, they may give up; someone inside may open a gate in the night.
// Their realm may march to lift it: a battle at the siege lines, the
// garrison sallying out behind. And in the end the town is stormed, gives
// up, is betrayed, or holds; or the siege is lifted, or the war ends.
//
// Near you it happens for real (see game/siegeground.js): the camp on the
// ground, the gates barred, the defenders on the walls, the assault fought
// out with ladders and the ram.
import { alive, ledger, DAY } from './econ.js';
import { RNG, hash4, clamp } from '../util/rng.js';
import { M } from '../world/settlement.js';
import { brutality, sackOf, LEVEL_NAMES } from './conduct.js';
import { remember } from './mind/memory.js';
import { pkey } from './mind/common.js';
import { hostById, hostsAfterSiege, hostsBesieged } from './hosts.js';

const residents = (L) => L.npcs.filter((r) => alive(r) && !r.away && !r.migrated && !r.visitor);
const plain = (civ) => (civ ? civ.name.replace(/^The /, '') : 'free folk');
const fullName = (r) => `${r.name.first} ${r.name.last}`;
const cheb = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.z - b.z));
const centreOfS = (s, REGION_W, REGION_D) => ({ x: Math.floor((s.cx + (s.cw || 1) / 2) * REGION_W), z: Math.floor((s.cz + (s.cd || 1) / 2) * REGION_D) });

// How long a siege can go on before the besiegers give it up.
export const SIEGE_MAX = 12;
// What the rations are, and how fast they eat the stores.
export const RATIONS = { full: 1, half: 0.55, quarter: 0.3 };
export const RATION_NAMES = { full: 'full rations', half: 'half rations', quarter: 'a quarter ration' };

// ------------------------------------------------------------ the wall
// A town's wall as stretches of eight paces or so (each its own: knocked
// at, breached, mended), and its gates.
export function stretchesOf(L) {
  if (!L || !L.mask || !L.bounds) return [];
  const b = L.bounds;
  const gateAt = new Set((L.gates || []).map((q) => q.x * 65536 + q.z));
  const groups = new Map();
  const W = L.W;
  for (let z = b.z0; z <= b.z1; z++) {
    for (let x = b.x0; x <= b.x1; x++) {
      if (L.maskAt(x, z) !== M.WALL || gateAt.has(x * 65536 + z)) continue;
      // (Which side of the town, and how far along it.)
      const dN = z - b.z0;
      const dS = b.z1 - z;
      const dW = x - b.x0;
      const dE = b.x1 - x;
      const m = Math.min(dN, dS, dW, dE);
      const side = m === dN ? 0 : m === dS ? 1 : m === dW ? 2 : 3;
      const along = side < 2 ? x - b.x0 : z - b.z0;
      const k = side * 1000 + Math.floor(along / 8);
      let g0 = groups.get(k);
      if (!g0) groups.set(k, (g0 = { k, side, n: 0, sx: 0, sz: 0 }));
      g0.n++;
      g0.sx += x;
      g0.sz += z;
    }
  }
  void W;
  return [...groups.values()].filter((q) => q.n >= 2).map((q) => ({ k: q.k, side: q.side, n: q.n, mid: { x: Math.round(q.sx / q.n), z: Math.round(q.sz / q.n) }, hp: 100, max: 100, down: false }));
}

// The gate nearest a point (or null: no wall, or no gate in it).
export function gateNear(L, at) {
  let best = null;
  for (const q of L.gates || []) if (!best || cheb(q, at) < cheb(best, at)) best = q;
  return best ? { x: best.x, z: best.z, rot: best.rot | 0, hp: 100, max: 100, broken: false } : null;
}

// Where the streets run out of an unwalled town: the barricades go there.
function barricadesOf(L, at) {
  const ex = L.exits ? L.exits() : [];
  return ex.slice().sort((p, q) => cheb(p, at) - cheb(q, at)).slice(0, 4).map((q) => ({ x: q.x, z: q.z, dx: q.dx, dz: q.dz, hp: 40, max: 40, down: false }));
}

// How many days of food the town has laid by: by its size, how well off it
// is, its granaries, what it has in store.
export function foodDays(sim, L) {
  const s = L.settlement;
  let d = { village: 4, town: 6, city: 8 }[s.baseType || s.type] || 5;
  if (s.condition === 'prosperous') d += 2;
  if (s.condition === 'poor') d -= 2;
  if (sim.tech && sim.tech.has(s, 'granaries')) d += 3;
  // (By the sea, with boats: fish come in whatever the army does.)
  if (s.coast) d += 1;
  const k = L.econ && L.econ.stock;
  const pop = Math.max(1, residents(L).length);
  if (k) d += Math.min(4, ((k.grain || 0) + (k.bread || 0) + (k.flour || 0)) / (pop * 3));
  return Math.max(2, Math.round(d));
}

// ------------------------------------------------------------ beginning
// Should a decisive win before a town become a siege (and not a town taken
// there and then)? A walled town always (unless the beaten army was cut to
// pieces and the ram's already through: see war.fight); an unwalled one
// when the victors are strong enough to surround it.
export function siegeFor(war, w, plan, ratio) {
  const s = war.ow.settlements[plan.def];
  if (!s || !s.civ) return null;
  const DL = war.game.world.layouts.get(s.id);
  if (!DL || !DL.econ) return null;
  if (w.siege) return null;
  if (DL.walled) return 'walls';
  // (An unwalled town: only a big army can close round it.)
  const atkSide = plan.attacker;
  const host = war.pool(w, atkSide, plan);
  const hostN = host.recs.length + host.extra;
  const guards = residents(DL).filter((r) => r.job === 'guard').length;
  if (hostN >= Math.max(10, guards * 2.2) && (s.type !== 'village' || hostN >= 14) && ratio < 4) return 'small';
  return null;
}

// The siege begins: the camp's pitched, the gates shut. `how`: 'battle'
// (after a battle won before the walls), 'shut' (the defenders wouldn't
// come out), 'small' (an unwalled town surrounded).
export function startSiege(war, w, plan, how, day, rng) {
  const g = war.game;
  const s = war.ow.settlements[plan.def];
  const L = g.world.layouts.get(s.id);
  if (!s || !L || !L.econ) return null;
  const atk = plan.attacker;
  const def = atk === 'a' ? 'b' : 'a';
  const civA = war.civ(atk === 'a' ? plan.ca : plan.cb);
  const civD = s.civ;
  const { REGION_W, REGION_D } = war.regionSize();
  const c = centreOfS(s, REGION_W, REGION_D);
  // The camp, out past the town toward where they came from.
  const from = war.ow.settlements[plan.atk];
  // (Round 145: a host camps on the side it came from.)
  const fc = plan.from ? plan.from : from ? centreOfS(from, REGION_W, REGION_D) : { x: c.x + 40, z: c.z };
  const d = Math.hypot(fc.x - c.x, fc.z - c.z) || 1;
  const ux = (fc.x - c.x) / d;
  const uz = (fc.z - c.z) / d;
  const bd = s.bounds;
  let k = 0;
  while (k < 200) {
    const x = c.x + ux * k;
    const z = c.z + uz * k;
    if (x < bd.x0 - 2 || x > bd.x1 + 2 || z < bd.z0 - 2 || z > bd.z1 + 2) break;
    k += 2;
  }
  const small = how === 'small';
  const camp = { x: Math.round(c.x + ux * (k + (small ? 12 : 16))), z: Math.round(c.z + uz * (k + (small ? 12 : 16))) };
  const host = war.pool(w, atk, plan);
  // (Round 145: nobody to sit down before the walls, no siege; and its
  // numbers are those who came, no more.)
  if (!(host.recs.length + host.extra)) return null;
  const gar = residents(L).filter((r) => r.job === 'guard' && r.soldier === undefined && r.captive === undefined).length;
  // (A small realm fighting for its life: nearly everyone on the walls.)
  const Dd = war.draftRate ? war.draftRate(w, def) : 0;
  const fled = how === 'battle' && plan.sent ? Math.max(0, Math.round((plan.sent[def] ? plan.sent[def][0] : 0) * 0.4)) : 0;
  const tech = war.sim.tech;
  const S = {
    id: war.nextId++, sid: s.id, atk, def, civA: civA ? civA.id : null, civD: civD ? civD.id : null, start: day, at: war.sim.abs, how, small,
    phase: 'invest', camp, dir: { x: ux, z: uz },
    // (The garrison: the watch, whoever made it back from the field, and
    // the townsfolk who'll take up a spear on the walls.)
    host: host.recs.length + host.extra, garrison: gar + fled + Math.round(residents(L).filter((r) => (r.age === 'adult' || (Dd && r.age === 'elder')) && r.job !== 'guard').length * (Dd || (small ? 0.2 : 0.28))),
    food: foodDays(war.sim, L), hungry: 0, rations: 'full',
    walls: small ? [] : stretchesOf(L), gate: small ? null : gateNear(L, camp), barricades: small ? barricadesOf(L, camp) : [],
    engines: { catapults: 0, rams: 0, ladders: 0, building: [] }, sap: null,
    morale: { atk: 62, def: how === 'battle' ? 48 : 60 },
    next: null, assaults: [], failed: 0, sallies: 0, terms: null, refused: 0, relief: null, log: [], cmd: { atk: null, def: null },
    tech: { catapults: !!civA && tech.has(civA, 'catapults'), rams: !!civA && tech.has(civA, 'rams'), siegecraft: !!civA && tech.has(civA, 'siegecraft'), fortress: tech.has(s, 'fortress') },
    // (Who leads the besiegers: the boldest of them; or one of you.)
    commander: null, leader: war.leaderOf(plan, atk),
  };
  const cq = host.recs.filter((q) => alive(q.r) && !q.r.captive).sort((p, q) => (q.r.personality?.bravery ?? 0.5) - (p.r.personality?.bravery ?? 0.5))[0];
  if (cq) S.commander = { sid: cq.L.settlement.id, idx: cq.r.idx };
  // (Round 145) A host's siege: the host its army, its commander in
  // command (one of you, or theirs); the realm's own next battle still due.
  const h = plan.host !== undefined ? hostById(war, plan.host) : null;
  if (h) {
    S.hostIds = [h.id];
    if (h.cmd && h.cmd.kind === 'npc') S.commander = { sid: h.cmd.sid, idx: h.cmd.idx };
    else if (h.cmd && h.cmd.kind === 'player') S.leader = h.cmd.pk;
  }
  w.siege = S;
  if (!h) w.plan = null;
  // (Round 145) A host of the town's side holding it: shut up inside, and
  // part of its garrison.
  S.garrison += hostsBesieged(war, w, S);
  S.garrison0 = S.garrison;
  const text = small
    ? `The ${plain(civA)} have surrounded ${s.name}. Its people have barricaded the streets.`
    : how === 'shut' ? `${s.name} has shut its gates against the ${plain(civA)}, who have laid siege to it.`
      : `The ${plain(civA)} have laid siege to ${s.name}. Its defenders have fallen back behind the walls and barred the gates.`;
  note(war, w, day, text, true);
  ledger(L, day, `${text} The town has food for ${S.food} days.`);
  for (const id of [...w.a, ...w.b]) {
    const cv = war.civ(id);
    if (cv) war.realms.proclaim(cv, day, text);
  }
  // Merchants won't come near it now; the roads out are watched.
  L.econ.raidAlert = Math.max(L.econ.raidAlert || 0, war.sim.abs + DAY * 2);
  if (g.currentSettlement === s || war.nearPlayer(camp, 70)) g.ui.msg(`${text} (It's marked on your map.)`, '#ff9060');
  g.audio?.play('alarm');
  war.sim.saga?.emit('siege_begun', { sid: s.id, war: w.id, by: S.civA });
  // (The first word on it: the commander's.)
  decide(war, w, S, day, rng);
  return S;
}

// ------------------------------------------------------------ each day
export function siegeDay(war, w, day, rng) {
  const S = w.siege;
  if (!S || S.phase === 'over') return null;
  const g = war.game;
  const s = war.ow.settlements[S.sid];
  const L = g.world.layouts.get(S.sid);
  if (!s || !L || !L.econ) return endSiege(war, w, 'lifted', day, rng, { why: 'the town is gone' });
  // (Taken some other way meanwhile, or the attackers' realm gone.)
  const civA = war.civ(S.civA);
  if (!civA || !war.realms.members(civA).length || (s.civ && s.civ.id === S.civA)) return endSiege(war, w, 'over', day, rng, { why: 'it no longer matters' });
  const d = day - S.start;
  S.phase = d >= 1 ? 'blockade' : 'invest';
  // The stores.
  S.food = Math.round((S.food - RATIONS[S.rations]) * 100) / 100;
  if (S.food <= 0) {
    S.food = 0;
    S.hungry++;
    // (The town goes hungry: the famine and its troubles, as any other.)
    for (const r of residents(L)) r.hungry = Math.max(r.hungry || 0, Math.min(3, S.hungry));
    L.econ.famineDays = Math.max(L.econ.famineDays || 0, S.hungry + 2);
    S.morale.def -= 7;
    S.garrison = Math.max(1, S.garrison - rng.int(0, Math.min(3, S.hungry)));
    if (S.hungry === 1) note(war, w, day, `The stores of ${s.name} are gone. The town is going hungry.`);
  } else if (S.rations !== 'full') S.morale.def -= S.rations === 'half' ? 1.5 : 3.5;
  else S.morale.def += 1;
  // The camp: sickness, weariness, desertion.
  const wet = /swamp|jungle/.test(war.biomeAt(S.camp));
  if (wet && rng.chance(0.4)) {
    const sick = rng.int(1, 2);
    S.host = Math.max(2, S.host - sick);
    note(war, w, day, `Fever in the camp before ${s.name}: ${sick} of the besiegers sick and sent home.`);
  }
  S.morale.atk -= 1.5;
  for (const id of w[S.atk]) w.weary[id] = (w.weary[id] || 0) + 0.012;
  // The engines: built in the camp, a day or two each.
  buildEngines(war, w, S, day, rng);
  // Stones at the wall.
  if (S.engines.catapults && S.walls.length) bombard(war, w, S, L, day, rng);
  // Under the wall.
  if (S.sap) sapping(war, w, S, L, day, rng);
  // Clamp, then the two commanders' choices.
  S.morale.atk = clamp(S.morale.atk, 0, 100);
  S.morale.def = clamp(S.morale.def, 0, 100);
  // The night: someone inside opens a gate?
  if (betrayal(war, w, S, L, day, rng)) return w.siege;
  decide(war, w, S, day, rng);
  // Too long: the besiegers give it up.
  if (w.siege === S && S.phase !== 'over' && (d >= SIEGE_MAX || S.host < Math.max(3, S.garrison * 0.8) || S.morale.atk <= 8)) {
    return endSiege(war, w, 'lifted', day, rng, { why: d >= SIEGE_MAX ? 'too long before the walls' : S.morale.atk <= 8 ? 'the besiegers had lost heart' : 'too few left to keep it up' });
  }
  return S;
}

function buildEngines(war, w, S, day, rng) {
  const E = S.engines;
  // (What's building, done.)
  for (const q of E.building.slice()) {
    if (day < q.done) continue;
    E.building = E.building.filter((x) => x !== q);
    E[q.kind] = (E[q.kind] || 0) + q.n;
    note(war, w, day, q.kind === 'catapults' ? `The besiegers of ${war.ow.settlements[S.sid].name} have raised ${q.n > 1 ? `${q.n} catapults` : 'a catapult'}.` : q.kind === 'rams' ? `A battering ram stands ready in the camp before ${war.ow.settlements[S.sid].name}.` : `Ladders lie stacked in the besiegers' camp.`);
  }
  const want = S.cmd.atk ? null : true;
  if (!want) return;
  const has = (k) => (E[k] || 0) + E.building.filter((q) => q.kind === k).reduce((n, q) => n + q.n, 0);
  if (S.tech.catapults && S.walls.length && has('catapults') < (S.host >= 20 ? 3 : 2)) E.building.push({ kind: 'catapults', n: 1, done: day + 2 });
  if (S.tech.rams && S.gate && has('rams') < 1) E.building.push({ kind: 'rams', n: 1, done: day + 1 });
  if (!S.small && has('ladders') < (S.tech.siegecraft ? 8 : 4)) E.building.push({ kind: 'ladders', n: S.tech.siegecraft ? 8 : 4, done: day + (S.tech.siegecraft ? 1 : 2) });
  void rng;
}

// A day's stones: each catapult at the stretch facing the camp (the one
// it's already broken, nearest first).
function bombard(war, w, S, L, day, rng) {
  const s = war.ow.settlements[S.sid];
  const up = S.walls.filter((q) => !q.down).sort((p, q) => cheb(p.mid, S.camp) - cheb(q.mid, S.camp) || p.hp - q.hp);
  if (!up.length) return;
  const at = up[0];
  let hit = 0;
  for (let i = 0; i < S.engines.catapults; i++) hit += rng.int(6, 11) * (S.tech.fortress ? 0.65 : 1);
  at.hp = Math.max(0, at.hp - hit);
  // (A stone into the town now and then: a roof, a fire.)
  if (rng.chance(0.25 * S.engines.catapults)) {
    L.econ.recent ||= {};
    L.econ.recent.violence = (L.econ.recent.violence || 0) + 1;
    S.morale.def -= 2;
    if (rng.chance(0.5)) ledger(L, day, `Stones from the besiegers' catapults fell among the houses of ${s.name}.`);
  }
  if (at.hp <= 0) breachStretch(war, w, S, L, at, day, 'stones');
}

// A stretch of the wall down: the breach (its blocks, if the town's laid
// out; see war.breach) and the word of it.
export function breachStretch(war, w, S, L, at, day, how) {
  if (at.down) return;
  at.down = true;
  at.hp = 0;
  const s = war.ow.settlements[S.sid];
  // (Shown where you are, by the live siege; or knocked in now.)
  if (!(war.live && war.live.siege === S)) war.breach(L, { site: at.mid }, at.mid);
  S.morale.def -= 10;
  S.morale.atk += 8;
  note(war, w, day, how === 'mine' ? `The sappers' tunnel under the wall of ${s.name} has been fired: a stretch of it has come down!` : `The catapults have brought down a stretch of the wall of ${s.name}!`, true);
}

function sapping(war, w, S, L, day, rng) {
  const s = war.ow.settlements[S.sid];
  const sap = S.sap;
  const at = S.walls.find((q) => q.k === sap.k);
  if (!at || at.down) {
    S.sap = null;
    return;
  }
  // (The defenders listening at the ground: a fortress has its galleries.)
  if (rng.chance(S.tech.fortress ? 0.33 : 0.16)) {
    S.sap = null;
    S.morale.def += 6;
    S.morale.atk -= 5;
    S.host = Math.max(2, S.host - rng.int(1, 2));
    note(war, w, day, `The defenders of ${s.name} found the besiegers' tunnel under the wall, broke into it and fought the sappers below ground. It's filled in.`);
    return;
  }
  sap.p = Math.min(1, sap.p + (S.tech.siegecraft ? 0.34 : 0.22));
  if (sap.p >= 1) {
    S.sap = null;
    breachStretch(war, w, S, L, at, day, 'mine');
  }
}

// In the night, someone opens a gate: a town sick of it, starving, with
// some in it who'd rather the other side won.
function betrayal(war, w, S, L, day, rng) {
  if (S.small) return false;
  // (Not in the first days: it takes hunger, or a town that's given up
  // hope, before anyone opens a gate.)
  if (day - S.start < 3 || (S.hungry < 2 && S.morale.def >= 30)) return false;
  const unrest = L.econ.unrest || 0;
  const p = (unrest >= 1.2 ? 0.04 : 0) + (S.hungry >= 3 ? 0.05 : 0) + (S.morale.def < 20 ? 0.03 : 0);
  if (!p || !rng.chance(p)) return false;
  const s = war.ow.settlements[S.sid];
  const by = residents(L).filter((r) => r.age === 'adult' && r.job !== 'guard' && r.job !== 'mayor').sort((a, b) => (a.mood ?? 0.5) - (b.mood ?? 0.5))[0];
  note(war, w, day, `Treachery! In the night someone in ${s.name}${by ? ` (${fullName(by)}, it's said)` : ''} opened a gate to the besiegers.`, true);
  endSiege(war, w, 'betrayed', day, rng, { by: by ? fullName(by) : null });
  return true;
}

// ------------------------------------------------------------ the commanders
// What each side does next (the AI's, unless a player commands it: their
// orders stand; see siegeOrder).
export function decide(war, w, S, day, rng) {
  if (!S || S.phase === 'over' || w.siege !== S) return;
  const s = war.ow.settlements[S.sid];
  const L = war.game.world.layouts.get(S.sid);
  // The defenders.
  if (!S.cmd.def) {
    // (Rations: tighter as the stores run down, or the siege drags.)
    if (S.food <= 2 && S.rations === 'full') S.rations = 'half';
    if (S.food <= 1 && S.rations === 'half' && S.hungry === 0) S.rations = 'quarter';
    // A sally against the engines, with nerve and men enough.
    const engines = S.engines.catapults + S.engines.rams;
    if (engines && S.morale.def >= 45 && S.garrison >= S.host * 0.35 && day - (S.sallyDay ?? -9) >= 2 && rng.chance(0.3)) sally(war, w, S, day, rng);
    // Terms offered: taken, if it's hopeless.
    if (S.terms && !S.terms.answer) {
      const hopeless = S.hungry >= 2 || S.morale.def < 25 || S.walls.filter((q) => q.down).length >= 2;
      const relief = S.relief && S.relief.at > war.sim.abs;
      if (hopeless && !relief) return endSiege(war, w, 'surrendered', day, rng, { terms: S.terms.kind });
      S.terms.answer = 'refused';
      S.refused++;
      note(war, w, day, `${s.name} refused the besiegers' terms.`);
    }
    // Starving and broken: gives up, whatever the terms.
    if (S.hungry >= 4 && S.morale.def < 15) return endSiege(war, w, 'surrendered', day, rng, { terms: 'none' });
  }
  // Relief: the town's realm marches to lift it, if it can.
  relieve(war, w, S, day, rng);
  if (w.siege !== S) return;
  // The besiegers.
  if (!S.cmd.atk && !S.next) {
    const breach = S.walls.some((q) => q.down) || (S.gate && S.gate.broken);
    const ratio = S.host / Math.max(1, S.garrison);
    const ram = S.engines.rams > 0 && S.gate && !S.gate.broken;
    const ladders = S.engines.ladders > 0;
    const M0 = S.morale.atk;
    const d = day - S.start;
    let when = null;
    let at = [];
    if (S.small) {
      if (d >= 1 && ratio >= 1.6) {
        when = 'dawn';
        at = ['barricade'];
      }
    } else if (breach && ratio >= 1.4) {
      when = 'dawn';
      at = ['breach'];
      if (ladders && ratio >= 3) at.push('walls');
    } else if (ram && ratio >= 1.8 && M0 >= 40 && d >= 1) {
      when = 'dawn';
      at = ['gate'];
      if (ladders && ratio >= 2.6) at.push('walls');
    } else if (ladders && ratio >= 3.2 && M0 >= 50 && d >= 2) {
      when = 'dawn';
      at = ['walls'];
    }
    if (when) scheduleAssault(war, w, S, day, at);
    // (Or wait, and dig: sappers under the stretch nearest the camp.)
    else if (S.tech.siegecraft && !S.sap && S.walls.length && d >= 1 && !breach) {
      const st = S.walls.filter((q) => !q.down).sort((p, q) => cheb(p.mid, S.camp) - cheb(q.mid, S.camp))[1] || S.walls[0];
      if (st) {
        S.sap = { k: st.k, p: 0 };
        note(war, w, day, `The besiegers of ${s.name} have begun to dig under the wall.`);
      }
    }
    // Terms, when the town's hungry.
    if (!S.terms && (S.hungry >= 1 || S.food <= 1.5) && rng.chance(0.6)) offerTerms(war, w, S, day, 'generous');
  }
  void L;
}

// The assault set for the morning: `at`, where (the gate, a breach, the
// walls, the barricades).
export function scheduleAssault(war, w, S, day, at) {
  const s = war.ow.settlements[S.sid];
  const now = war.sim.abs;
  let t = (day + 1) * DAY + 6 * 60 + 30;
  if (t - now > DAY) t = now + 8 * 60;
  if (t < now + 60) t = now + 60;
  S.next = { at: t, where: at.slice() };
  const words = at.map((q) => ({ gate: 'the gate', breach: 'the breach', walls: 'the walls, with ladders', barricade: 'the barricades' }[q])).join(' and ');
  note(war, w, day, `The besiegers of ${s.name} are making ready to storm ${words} at dawn.`, true);
  // (Called up: those of you of either side, to the walls or the ladders.)
  S.next.plan = { at: t, site: { ...S.camp }, name: `the storming of ${s.name}`, attacker: S.atk, atk: S.sid, def: S.sid, ca: w.lead.a, cb: w.lead.b, siege: S.id };
  // (Round 145: a host's siege, stormed by the host.)
  if (S.hostIds && S.hostIds.length) S.next.plan.hosts = S.hostIds.slice();
  war.callUp(w, S.next.plan, day);
}

export function offerTerms(war, w, S, day, kind = 'generous') {
  const s = war.ow.settlements[S.sid];
  S.terms = { kind, day };
  note(war, w, day, kind === 'generous' ? `The besiegers offered ${s.name} terms: open the gates, and the garrison may march out free and the town be spared.` : `The besiegers offered ${s.name} terms: open the gates, the garrison to be taken prisoner, and the town to pay.`);
}

function sally(war, w, S, day, rng) {
  const s = war.ow.settlements[S.sid];
  S.sallyDay = day;
  S.sallies++;
  const n = Math.max(2, Math.round(S.garrison * 0.3));
  const win = rng.chance(clamp(0.35 + (S.morale.def - S.morale.atk) / 200 + (n / Math.max(1, S.host)) * 0.5, 0.1, 0.75));
  if (win) {
    const k = S.engines.catapults ? 'catapults' : 'rams';
    S.engines[k] = Math.max(0, S.engines[k] - 1);
    S.host = Math.max(2, S.host - rng.int(1, 3));
    S.garrison = Math.max(1, S.garrison - rng.int(0, 1));
    S.morale.def += 8;
    S.morale.atk -= 6;
    note(war, w, day, `The garrison of ${s.name} sallied out at dawn and burned ${k === 'catapults' ? 'a catapult' : 'the ram'} before they were driven back in.`, true);
  } else {
    S.garrison = Math.max(1, S.garrison - rng.int(1, 3));
    S.morale.def -= 6;
    note(war, w, day, `The garrison of ${s.name} sallied out at the besiegers' engines, and were driven back with losses.`);
  }
}

// The town's realm marches to lift the siege: a battle at the siege lines
// (see war.planBattle: plan.relief), the garrison sallying out behind.
function relieve(war, w, S, day, rng) {
  if (S.relief || w.plan) return;
  const defSide = S.def;
  const civD = war.civ(S.civD);
  if (!civD || !w[defSide].includes(civD.id)) return;
  // (A realm a player rules marches when they say.)
  if (war.sim.crown && war.sim.crown.ruled(civD) && !S.reliefAsked) return;
  const s = war.ow.settlements[S.sid];
  const plan0 = { def: S.sid, atk: S.sid, attacker: defSide === 'a' ? 'a' : 'b', ca: w.lead.a, cb: w.lead.b };
  const P = war.pool(w, defSide, plan0);
  const n = P.recs.filter((q) => q.L.settlement.id !== S.sid).length + P.extra;
  if (n < S.host * 0.7 && !S.reliefAsked) return;
  if (!rng.chance(S.reliefAsked ? 1 : 0.5)) return;
  const at = (day + 1) * DAY + 9 * 60;
  S.relief = { at, day };
  const site = { x: S.camp.x, z: S.camp.z };
  const cell = war.cellAt(site);
  w.plan = {
    at, depart: Math.max(war.sim.abs, at - 300), site, biome: cell ? cell.biome : 'plains', river: !!(cell && cell.river), name: `the Relief of ${s.name}`,
    attacker: defSide, atk: S.sid, def: S.sid, ca: w.lead.a, cb: w.lead.b, naval: false, relief: S.id,
  };
  note(war, w, day, `The ${plain(civD)} are marching to lift the siege of ${s.name}. They'll fall on the besiegers' camp tomorrow morning.`, true);
  war.callUp(w, w.plan, day);
}

// A relief battle fought: won, the siege is lifted; lost, the town's on its
// own (and knows it).
export function reliefFought(war, w, plan, winner, day, rng) {
  const S = w.siege;
  if (!S || plan.relief !== S.id) return;
  S.relief = null;
  if (winner === S.def) return endSiege(war, w, 'lifted', day, rng, { why: 'a relief army beat the besiegers' });
  S.morale.def -= 15;
  S.host = Math.max(2, Math.round(S.host * 0.9));
  const s = war.ow.settlements[S.sid];
  note(war, w, day, `The army that came to lift the siege of ${s.name} was beaten before its walls.`, true);
  return null;
}

// ------------------------------------------------------------ the assault
// When an assault is due: fought where you can see it (see siegeground.js),
// or reckoned up.
export function siegeTick(war, w) {
  const S = w.siege;
  if (!S || S.phase === 'over' || !S.next || war.sim.abs < S.next.at || S.next.live) return;
  const g = war.game;
  const L = g.world.layouts.get(S.sid);
  if (!war.live && war.sieges && war.sieges.canLive(w, S) && war.sieges.startAssault(w, S)) return;
  const rng = new RNG(hash4(S.id, S.next.at, 0xa55));
  resolveAssault(war, w, S, L, rng, null);
}

// The two sides' strength at each point: the besiegers with ladders, the
// ram, through a breach; the defenders on the walls (stronger), in a
// breach (less so), behind the barricades.
const WALL_MULT = { walls: 2.3, gate: 1.5, breach: 1.12, barricade: 1.35 };

export function resolveAssault(war, w, S, L, rng, live) {
  const s = war.ow.settlements[S.sid];
  const day = Math.floor(war.sim.abs / DAY);
  const where = S.next ? S.next.where : ['walls'];
  S.next = null;
  let won;
  let lossA;
  let lossD;
  if (live) {
    won = live.won;
    lossA = live.lossA;
    lossD = live.lossD;
  } else {
    const tech = war.sim.tech;
    const capA = war.realms.capitalOf(war.civ(S.civA));
    const pa = S.host * (0.8 + S.morale.atk / 250) * (capA && tech.has(capA, 'greatweapons') ? 1.1 : 1);
    // (The defenders spread over every point attacked.)
    const mult = where.reduce((m, q) => Math.min(m, WALL_MULT[q] || 1.5), 3) * (S.tech.fortress ? 1.2 : 1) * (S.gate && !S.gate.broken && where.includes('gate') && S.engines.rams ? 1 : 1);
    const spread = 1 - (where.length - 1) * 0.12;
    const hunger = S.hungry ? Math.max(0.55, 1 - S.hungry * 0.12) : 1;
    const pd = S.garrison * mult * spread * hunger * (0.8 + S.morale.def / 250) * (s.type === 'city' ? 1.1 : 1);
    won = pa * rng.float(0.82, 1.18) > pd * rng.float(0.82, 1.18);
    lossA = Math.round(S.host * (won ? rng.float(0.08, 0.18) : rng.float(0.16, 0.32)));
    lossD = Math.round(S.garrison * (won ? rng.float(0.3, 0.6) : rng.float(0.06, 0.16)));
  }
  S.host = Math.max(1, S.host - lossA);
  S.garrison = Math.max(won ? 0 : 1, S.garrison - lossD);
  // The fallen of each, named (some of them).
  fallenOf(war, w, S, lossA, lossD, day, rng);
  S.assaults.push({ day, where, won, lossA, lossD, live: !!live });
  if (S.gate && where.includes('gate') && S.engines.rams && won) S.gate.broken = true;
  if (won) {
    const by = live && live.by ? live.by : where.includes('breach') ? 'breach' : where.includes('gate') && S.gate && S.gate.broken ? 'gate' : where.includes('barricade') ? 'barricade' : 'walls';
    const how = { breach: 'through the breach', gate: 'through the broken gate', barricade: 'over the barricades', walls: 'over the walls' }[by];
    return endSiege(war, w, 'stormed', day, rng, { how, live: !!live, word: live ? live.word : null });
  }
  S.failed++;
  S.morale.atk -= 12;
  S.morale.def += 9;
  // (The ladders smashed or burned; the ram, maybe.)
  S.engines.ladders = Math.max(0, S.engines.ladders - rng.int(2, 5));
  if (where.includes('gate') && rng.chance(0.4)) S.engines.rams = Math.max(0, S.engines.rams - 1);
  note(war, w, day, `The besiegers stormed ${where.map((q) => ({ gate: 'the gate', breach: 'the breach', walls: 'the walls', barricade: 'the barricades' }[q])).join(' and ')} of ${s.name} and were thrown back, ${lossA} of them fallen.`, true);
  for (const id of w[S.atk]) w.weary[id] = (w.weary[id] || 0) + 0.04;
  return null;
}

// Real people among the fallen: the town's guards, and soldiers of the
// besieging realm.
function fallenOf(war, w, S, lossA, lossD, day, rng) {
  const L = war.game.world.layouts.get(S.sid);
  const s = war.ow.settlements[S.sid];
  if (L && lossD) {
    const g = rng.shuffle(residents(L).filter((r) => r.job === 'guard' && r.ruler === undefined));
    for (const r of g.slice(0, Math.min(g.length, Math.ceil(lossD * 0.5)))) war.sim.recordDeath(L, r, `fell defending the walls of ${s.name}`, null, day);
  }
  if (lossA) {
    const plan0 = { def: S.sid, atk: S.sid, attacker: S.atk, ca: w.lead.a, cb: w.lead.b, hosts: S.hostIds && S.hostIds.length ? S.hostIds.slice() : undefined };
    const P = war.pool(w, S.atk, plan0);
    for (const { r, L: HL } of rng.shuffle(P.recs).slice(0, Math.min(P.recs.length, Math.ceil(lossA * 0.5)))) war.sim.recordDeath(HL, r, `fell storming ${s.name}`, null, day);
  }
}

// ------------------------------------------------------------ the end
// How it ends: 'stormed', 'surrendered', 'betrayed' (the town taken),
// 'lifted' (it holds), 'over' (it no longer matters: the war's over, the
// town taken another way).
export function endSiege(war, w, how, day, rng, extra = {}) {
  const S = w.siege;
  if (!S || S.phase === 'over') return null;
  S.phase = 'over';
  S.end = { how, day, ...extra };
  const g = war.game;
  const s = war.ow.settlements[S.sid];
  const L = g.world.layouts.get(S.sid);
  const civA = war.civ(S.civA);
  const civD = war.civ(S.civD);
  const days = day - S.start;
  // ("After 3 days"; or, the day it began, "the same day".)
  const after = days > 0 ? `after ${days} day${days === 1 ? '' : 's'}` : 'the same day';
  const taken = how === 'stormed' || how === 'surrendered' || how === 'betrayed';
  let text = null;
  if (taken && s && civA && L) {
    const sack = how === 'surrendered' && extra.terms !== 'none' ? null : sackTown(war, w, S, L, civA, day, rng, extra);
    war.capture(w, s, civA, day, how === 'stormed' ? `the storming of ${s.name}` : how === 'betrayed' ? `treachery opened its gates` : days > 0 ? `a siege of ${days} day${days === 1 ? '' : 's'}` : `a siege`);
    const name = `the ${how === 'surrendered' ? 'Siege' : sack && (sack.level === 'sack' || sack.level === 'massacre') ? 'Sack' : 'Fall'} of ${s.name}`;
    text = how === 'stormed'
      ? `${cap(name)}: ${after}, the ${plain(civA)} stormed ${s.name} ${extra.how || 'over the walls'}${sack ? `, and ${s.name} was ${LEVEL_NAMES[sack.level]}` : ''}.`
      : how === 'betrayed' ? `${cap(name)}: betrayed from within, ${s.name} fell to the ${plain(civA)}${sack ? ` and was ${LEVEL_NAMES[sack.level]}` : ''}.`
        : `${cap(name)}: ${after}, ${s.name} opened its gates to the ${plain(civA)}${extra.terms === 'generous' ? ' on terms: its garrison marched out free' : extra.terms === 'harsh' ? ' on hard terms: its garrison was taken prisoner' : ', with nothing left to bargain with'}.`;
    w.score = clamp(w.score + (S.atk === 'a' ? 18 : -18), -150, 150);
    S.sackLevel = sack ? sack.level : null;
    if (sack) S.sack = sack;
    // The battle record (the war's run of them, and the books).
    w.battles.push({ day, name, site: { ...S.camp }, biome: war.biomeAt(S.camp), ta: 'siege', tb: 'walls', na: S.host, nb: S.garrison, la: 0, lb: 0, winner: S.atk, decisive: true, live: !!extra.live, siege: true, text });
    if (w.battles.length > 12) w.battles.shift();
    war.sim.history?.add(L, text, 'war', day);
  } else if (how === 'lifted' && s) {
    text = `The siege of ${s.name} is lifted ${days > 0 ? `after ${days} day${days === 1 ? '' : 's'}` : 'the same day'}${extra.why ? `: ${extra.why}` : ''}. The town holds for the ${plain(civD)}.`;
    w.score = clamp(w.score + (S.atk === 'a' ? -12 : 12), -150, 150);
    if (L) {
      war.sim.history?.add(L, `The town held out against the ${plain(civA)}${days > 1 ? ` for ${days} days` : ''}.`, 'war', day);
      // A hero of it: the boldest of the watch who came through.
      const hero = residents(L).filter((r) => r.job === 'guard').sort((a, b) => (b.personality?.bravery ?? 0) - (a.personality?.bravery ?? 0))[0];
      if (hero && days >= 3 && war.sim.history) war.sim.history.raiseStatue(L, fullName(hero), `holding the walls of ${s.name} against the ${plain(civA)}`, day);
    }
  } else if (s) text = `The siege of ${s.name} is over.`;
  if (text) {
    note(war, w, day, text, true);
    for (const id of [...w.a, ...w.b]) {
      const cv = war.civ(id);
      if (cv) war.realms.proclaim(cv, day, text);
    }
  }
  w.sieges = (w.sieges || []).concat([{ sid: S.sid, how, day, days, by: S.civA, sack: S.sackLevel || null }]).slice(-6);
  w.siege = null;
  w.next = day + 1;
  // (Round 145) The hosts in it: their dead counted; the town held, or home.
  if ((S.hostIds && S.hostIds.length) || (S.holderIds && S.holderIds.length)) hostsAfterSiege(war, w, S, how);
  if (war.live && war.live.siege === S) war.live.siegeOver = how;
  // (What it put up on the ground comes down: at once, or once the
  // assault's done with.)
  else if (war.sieges) war.sieges.cleanup(S);
  war.sim.saga?.emit('siege_over', { sid: S.sid, war: w.id, how });
  return S.end;
}

const cap = (t) => t[0].toUpperCase() + t.slice(1);

// The town taken by storm (or treachery, or with nothing to bargain): how
// hard its new masters are on it (see conduct.js), and what that comes to.
export function sackTown(war, w, S, L, civA, day, rng, extra = {}) {
  const s = L.settlement;
  const sim = war.sim;
  const commander = S.commander ? war.recByRef(S.commander) : null;
  const B = brutality(sim, civA, { w, commander, town: s, days: day - S.start, failed: S.failed, refused: S.refused, word: extra.word || S.word || null });
  const pop = residents(L).length;
  const k = sackOf(B, pop);
  const e = L.econ;
  const coin = Math.floor(e.treasury * k.loot);
  e.treasury -= coin;
  const capA = war.realms.capitalOf(civA);
  const CL = capA && war.game.world.layouts.get(capA.id);
  if (CL && CL.econ) CL.econ.treasury += Math.round(coin * 0.6);
  const st = e.stock || {};
  for (const item of Object.keys(st)) if (typeof st[item] === 'number') st[item] = Math.floor(st[item] * (1 - k.stores));
  // The dead of it: the townsfolk cut down in the streets.
  const dead = [];
  if (k.killed) {
    const pool = rng.shuffle(residents(L).filter((r) => r.ruler === undefined && (r.age !== 'child' || B.level === 'massacre')));
    for (const r of pool.slice(0, k.killed)) {
      sim.recordDeath(L, r, `killed in the ${B.level === 'massacre' ? 'massacre' : 'sack'} of ${s.name}`, null, day);
      dead.push(r);
    }
  }
  // (No quarter: the garrison's killed, not taken.)
  const guards = residents(L).filter((r) => r.job === 'guard' && r.ruler === undefined);
  if (!k.quarter) for (const r of guards.slice(0, Math.ceil(guards.length * 0.5))) sim.recordDeath(L, r, `put to the sword when ${s.name} fell`, null, day);
  else for (const r of rng.shuffle(guards).slice(0, Math.ceil(guards.length * 0.3))) war.takePrisoner(r, L, civA, day, `the fall of ${s.name}`);
  // Fires (shown burning where you are: see siegeground.js; else counted).
  e.recent ||= {};
  e.recent.violence = (e.recent.violence || 0) + 2 + k.fires;
  e.burned = { day, n: k.fires };
  // The town's nerve, and its memory of who did it.
  const hurt = { orderly: 0.05, plunder: 0.12, sack: 0.25, massacre: 0.4 }[B.level];
  for (const r of residents(L)) r.mood = clamp((r.mood ?? 0.5) - hurt, 0, 1);
  e.unrest = clamp((e.unrest || 0) + { orderly: 0.2, plunder: 0.6, sack: 1.2, massacre: 2 }[B.level], 0, 3);
  // A player in command of it: the town holds it against them.
  const pk = S.leader || null;
  if (pk && B.level !== 'orderly') for (const r of residents(L)) remember(r, { k: 'wronged', v: -Math.min(1, 0.3 + hurt * 1.6), s: Math.min(1, 0.4 + hurt * 1.4), w: pk, x: `the ${B.level === 'plunder' ? 'plundering' : B.level} of ${s.name}` }, day);
  // Flight: families out to the old realm's towns.
  if (k.flee && war.sim.sendPeople) {
    const civD = war.civ(S.civD);
    const to = civD ? war.realms.memberLayouts(civD).find((q) => q !== L) : null;
    if (to) {
      const go = rng.shuffle(residents(L).filter((r) => r.job !== 'guard' && r.job !== 'mayor' && r.ruler === undefined)).slice(0, Math.min(8, Math.round(pop * 0.1)));
      if (go.length >= 2) sim.sendPeople(L, go, to, `fleeing the ${B.level} of ${s.name}`);
    }
  }
  const line = { orderly: `The ${plain(civA)} took ${s.name} in good order: the gates held, the houses left be.`, plunder: `The ${plain(civA)} plundered ${s.name}: ¤${coin} and the stores carried off${k.fires ? `, ${k.fires === 1 ? 'a house' : 'a few houses'} burned` : ''}.`, sack: `The ${plain(civA)} sacked ${s.name}: ¤${coin} carried off, ${k.fires} houses burned${dead.length ? `, ${dead.length} of its people killed in the streets` : ''}.`, massacre: `The ${plain(civA)} put ${s.name} to the sword: ${dead.length} of its people killed, ${k.fires} houses burned, ¤${coin} carried off.` }[B.level];
  ledger(L, day, line);
  sim.history?.add(L, line, 'war', day);
  return { ...B, coin, dead: dead.length, fires: k.fires };
}

// ------------------------------------------------------------ the word
// A line of the siege's news (to the siege's own log; and, `loud`, to the
// town's ledger, and you if you're near).
export function note(war, w, day, text, loud = false) {
  const S = w.siege;
  if (S) {
    S.log.push({ day, text });
    if (S.log.length > 24) S.log.shift();
  }
  const g = war.game;
  const L = S ? g.world.layouts.get(S.sid) : null;
  if (loud && L && L.econ) ledger(L, day, text);
  if (loud && S && (g.currentSettlement === (L && L.settlement) || war.nearPlayer(S.camp, 80))) g.ui.msg(text, '#ffb080');
}

// A player commanding one side of a siege: what they choose (rations, a
// sally, terms, where to assault and when, an engine to build, a tunnel to
// dig, to lift it).
export function siegeOrder(war, w, side, key, v) {
  const S = w.siege;
  if (!S || S.phase === 'over') return { ok: false, why: 'There is no siege.' };
  const day = Math.floor(war.sim.abs / DAY);
  const rng = new RNG(hash4(S.id, day, key.length, 0x0de));
  const s = war.ow.settlements[S.sid];
  if (side === 'def') {
    if (key === 'rations' && RATIONS[v]) {
      S.rations = v;
      note(war, w, day, `${s.name} is on ${RATION_NAMES[v]}.`);
      return { ok: true };
    }
    if (key === 'sally') {
      if (day - (S.sallyDay ?? -9) < 1) return { ok: false, why: 'The garrison sallied out only today.' };
      sally(war, w, S, day, rng);
      return { ok: true };
    }
    if (key === 'terms') {
      if (!S.terms || S.terms.answer) return { ok: false, why: 'No terms are offered.' };
      if (v === 'accept') return { ok: true, end: endSiege(war, w, 'surrendered', day, rng, { terms: S.terms.kind }) };
      S.terms.answer = 'refused';
      S.refused++;
      note(war, w, day, `${s.name} refused the besiegers' terms.`);
      return { ok: true };
    }
    if (key === 'relief') {
      S.reliefAsked = true;
      relieve(war, w, S, day, rng);
      return { ok: true, sent: !!S.relief };
    }
    if (key === 'mend') {
      const down = S.walls.find((q) => q.down) || S.walls.filter((q) => q.hp < q.max).sort((p, q) => p.hp - q.hp)[0];
      if (!down) return { ok: false, why: 'The walls stand whole.' };
      if (down.down && day - (S.mendDay ?? -9) < 1) return { ok: false, why: 'The breach is being filled as fast as it can be.' };
      S.mendDay = day;
      if (down.down) {
        down.down = false;
        down.hp = 35;
        note(war, w, day, `The people of ${s.name} have filled the breach with rubble and timber.`);
      } else down.hp = Math.min(down.max, down.hp + 25);
      return { ok: true };
    }
  } else {
    if (key === 'assault') {
      const where = Array.isArray(v) ? v : [v];
      if (S.next) return { ok: false, why: 'An assault is already set.' };
      scheduleAssault(war, w, S, day, where);
      return { ok: true };
    }
    if (key === 'build' && ['catapults', 'rams', 'ladders'].includes(v)) {
      if (v === 'catapults' && !S.tech.catapults) return { ok: false, why: 'The realm doesn\'t know how to build catapults.' };
      if (v === 'rams' && (!S.tech.rams || !S.gate)) return { ok: false, why: S.gate ? 'The realm doesn\'t know how to build rams.' : 'There\'s no gate to ram.' };
      S.engines.building.push({ kind: v, n: v === 'ladders' ? 6 : 1, done: day + (v === 'catapults' ? 2 : 1) });
      return { ok: true };
    }
    if (key === 'sap') {
      if (!S.tech.siegecraft) return { ok: false, why: 'The realm doesn\'t know the art of siegecraft.' };
      if (S.sap) return { ok: false, why: 'The sappers are already digging.' };
      const st = S.walls.filter((q) => !q.down).sort((p, q) => cheb(p.mid, S.camp) - cheb(q.mid, S.camp))[0];
      if (!st) return { ok: false, why: 'There\'s no wall left to dig under.' };
      S.sap = { k: st.k, p: 0 };
      note(war, w, day, `The besiegers of ${s.name} have begun to dig under the wall.`);
      return { ok: true };
    }
    if (key === 'terms') {
      if (S.terms && !S.terms.answer) return { ok: false, why: 'Terms are already offered.' };
      offerTerms(war, w, S, day, v === 'harsh' ? 'harsh' : 'generous');
      // (Their answer in the morning: see decide.)
      return { ok: true };
    }
    if (key === 'word' && ['spare', 'loot', 'free', 'none'].includes(v)) {
      S.word = v === 'none' ? null : v;
      return { ok: true };
    }
    if (key === 'lift') return { ok: true, end: endSiege(war, w, 'lifted', day, rng, { why: 'its commander called it off' }) };
  }
  return { ok: false, why: '?' };
}

// What it stands at, in a few lines (for the war page, the siege window).
export function siegeLines(war, w) {
  const S = w && w.siege;
  if (!S) return [];
  const s = war.ow.settlements[S.sid];
  const day = Math.floor(war.sim.abs / DAY);
  const out = [];
  out.push(`The siege of ${s ? s.name : '?'}: day ${day - S.start + 1}${S.small ? ' (the streets barricaded)' : ''}`);
  out.push(`Before the walls: ${S.host} of the ${plain(war.civ(S.civA))} (nerve ${Math.round(S.morale.atk)}); within: ${S.garrison} (nerve ${Math.round(S.morale.def)}).`);
  out.push(S.food > 0 ? `Food for ${Math.ceil(S.food / RATIONS[S.rations])} more days, on ${RATION_NAMES[S.rations]}.` : `The stores are gone: ${S.hungry} day${S.hungry === 1 ? '' : 's'} hungry.`);
  if (S.walls.length) {
    const down = S.walls.filter((q) => q.down).length;
    const worst = S.walls.filter((q) => !q.down).sort((p, q) => p.hp - q.hp)[0];
    out.push(`The wall: ${down ? `${down} stretch${down > 1 ? 'es' : ''} breached` : 'whole'}${worst && worst.hp < worst.max ? `; the weakest stretch at ${worst.hp}%` : ''}${S.gate ? `; the gate ${S.gate.broken ? 'broken' : 'barred'}` : ''}.`);
  }
  const E = S.engines;
  const kit = [E.catapults ? `${E.catapults} catapult${E.catapults > 1 ? 's' : ''}` : '', E.rams ? 'a ram' : '', E.ladders ? `${E.ladders} ladders` : ''].filter(Boolean);
  out.push(`In the camp: ${kit.length ? kit.join(', ') : 'nothing yet'}${E.building.length ? ` (building ${E.building.map((q) => q.kind).join(', ')})` : ''}${S.sap ? `; sappers ${Math.round(S.sap.p * 100)}% under the wall` : ''}.`);
  if (S.next) out.push(`An assault on ${S.next.where.join(' and ')} at dawn.`);
  if (S.terms && !S.terms.answer) out.push(`Terms offered (${S.terms.kind}).`);
  if (S.relief) out.push('A relief army is on its way.');
  return out;
}

// For the map: the siege lines round the town.
export function siegeMarker(war, w) {
  const S = w.siege;
  if (!S) return null;
  const s = war.ow.settlements[S.sid];
  return { x: S.camp.x, z: S.camp.z, kind: 'siege', label: `The siege of ${s ? s.name : '?'} (day ${Math.floor(war.sim.abs / DAY) - S.start + 1})`, sid: S.sid, color: war.civ(S.civA) ? war.civ(S.civA).color.hex : '#ff7060' };
}

export { pkey };
