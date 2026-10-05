// Raids and wars. Realms on bad terms send small raiding parties over the
// border at night: a handful of their watch and their boldest, after coin
// and stores, not land. Word of riders on the road keeps merchants at home;
// the watch turns out (on horseback, where the town keeps horses or the
// realm has learned to fight mounted); a town that's been hit builds its
// wall sooner. All of it sours the realms further.
//
// War is rarer, and needs a reason: land both claim and keep quarrelling
// over, raid after raid, merchants beaten or killed, a rebel town to bring
// back, a vassal that threw off its lord. A realm at war calls on its
// allies (refusing breaks the alliance) and its vassals. Every few days the
// armies meet near the front: each side's captain picks a plan (a frontal
// assault, a flanking attack, a pincer, holding good ground, a line of log
// walls and stakes, a feigned retreat, or, badly outnumbered, falling
// back), the ground favours some plans over others, and soldiers really
// die. A decisive win can take the town behind the battlefield. Wars wear
// realms down: every week of it, every lost battle, makes the towns more
// restless (some break away, or open their gates to the enemy), allies may
// turn coat, and in the end the wearier side sues for peace: a truce, a
// town ceded, or, beaten badly, service to the victor.
//
// Near you, it all happens for real: raiders come over the fields with
// torches, the guards ride out, and battles are fought out on the ground
// by the actual soldiers of both sides.
import { alive, ledger, stockOf, DAY } from './econ.js';
import { deserted } from './civic.js';
import { RNG, hash4, clamp } from '../util/rng.js';
import { REGION_W, REGION_D, GROUND, SURFACE } from '../config.js';
import { B } from '../world/blocks.js';
import { M } from '../world/settlement.js';
import { fieldEngines, workEngines, endEngines, ramming } from '../game/engines.js';
import { authority } from './realms.js';
import { breachFor } from './growth.js';

export const TACTICS = {
  line: { name: 'a frontal assault', verb: 'charged straight at them' },
  flank: { name: 'a flanking attack', verb: 'swung round their flank' },
  pincer: { name: 'a pincer movement', verb: 'closed in from both sides at once' },
  hold: { name: 'holding good ground', verb: 'held their ground' },
  works: { name: 'a fortified line', verb: 'threw up log walls and stakes and fought behind them' },
  feint: { name: 'a feigned retreat', verb: 'fell back to draw them on, then turned on them' },
  retreat: { name: 'a fighting withdrawal', verb: 'fell back in good order' },
};
// How well one plan answers another (mine against theirs).
const MATCH = {
  line: { line: 1, flank: 0.85, pincer: 0.8, hold: 0.85, works: 0.7, feint: 0.8, retreat: 1.1 },
  flank: { line: 1.25, flank: 1, pincer: 0.9, hold: 1.15, works: 1.2, feint: 0.85, retreat: 1.1 },
  pincer: { line: 1.3, flank: 1.05, pincer: 1, hold: 1.25, works: 1.1, feint: 0.75, retreat: 1.15 },
  hold: { line: 1.2, flank: 0.9, pincer: 0.8, hold: 1, works: 1, feint: 1.15, retreat: 1 },
  works: { line: 1.35, flank: 0.9, pincer: 0.9, hold: 1, works: 1, feint: 1.2, retreat: 1 },
  feint: { line: 1.25, flank: 1.15, pincer: 1.25, hold: 0.8, works: 0.8, feint: 1, retreat: 1 },
  retreat: { line: 0.8, flank: 0.75, pincer: 0.7, hold: 0.9, works: 0.9, feint: 0.85, retreat: 1 },
};
// How many a side brings onto the field when you're there to see it (the
// rest fight on, counted, out of sight).
const LIVE_MAX = 16;
// Who's never called up in a levy (the realm can't spare them).
const LEVY_EXEMPT = new Set(['mayor', 'noble', 'priest', 'researcher', 'herbalist', 'innkeeper', 'barkeep', 'blacksmith', 'merchant', 'scholar', 'child', 'retired', 'beggar']);
const WOODED = new Set(['forest', 'taiga', 'jungle', 'swamp']);
const OPEN = new Set(['plains', 'desert', 'savanna', 'tundra', 'beach']);
const FEATURE = { forest: 'Woods', taiga: 'Pines', jungle: 'Thicket', swamp: 'Fen', mountain: 'Pass', desert: 'Sands', savanna: 'Grass', tundra: 'Waste', beach: 'Strand', plains: 'Field' };
const GROUND_TEXT = { forest: 'the treeline', taiga: 'the pinewood', jungle: 'the thicket', swamp: 'the dry hummocks of the fen', mountain: 'the high rocks', plains: 'a low rise', desert: 'a dune crest', savanna: 'a rise in the grass', tundra: 'a frozen ridge', beach: 'the dunes' };

const residents = (L) => L.npcs.filter((r) => alive(r) && !r.away && !r.migrated && !r.visitor);
const plain = (civ) => (civ ? civ.name.replace(/^The /, '') : 'free folk');
const fullName = (r) => `${r.name.first} ${r.name.last}`;
// A colour, darker (for raiders' tabards).
const darken = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  const c = (v) => Math.round(v * 0.6).toString(16).padStart(2, '0');
  return `#${c(n >> 16)}${c((n >> 8) & 255)}${c(n & 255)}`;
};
const wet = (s) => !!(s.coast || s.river || s.lake);
// On the same one of the Dagoni Islands? And how far (in map squares) a
// raft will go from one island's coast to another's.
const sameIsle = (s, o) => !s.island || !o.island || s.island === o.island;
export const OVERSEA = 70;
export const centreOf = (s) => ({ x: Math.floor((s.cx + (s.cw || 1) / 2) * REGION_W), z: Math.floor((s.cz + (s.cd || 1) / 2) * REGION_D) });
// When a battle's due, said as folk would say it.
function whenText(at, now) {
  const d = Math.floor(at / DAY) - Math.floor(now / DAY);
  const m = at % DAY;
  const part = m < 12 * 60 ? 'morning' : m < 17 * 60 ? 'afternoon' : 'evening';
  if (d <= 0) return at - now <= 120 ? 'within the hour or two' : `this ${part}`;
  return d === 1 ? `tomorrow ${part}` : `in ${d} days`;
}

export class War {
  constructor(game, sim) {
    this.game = game;
    this.sim = sim;
    this.wars = []; // ongoing
    this.past = []; // ended (the last few)
    this.raids = []; // under way
    this.raidLog = []; // { a, b, from, to, day, result }
    this.truces = {}; // pair key -> day it ends
    this.cd = {}; // civ id -> last day it sent raiders
    this.rebels = {}; // civ id -> { lord, day } (vassals that broke free)
    this.seen = {}; // pair key -> merchant incidents counted so far
    this.nextId = 1;
    this.lastDay = null; // (set on the first tick: the game's clock isn't running yet)
    this.live = null; // a raid or battle being fought out near you
    this.prisoners = []; // { id, sid, idx, civ, by, at, day, how, name }
    this.deserters = {}; // civ id -> { day, war, battle } (you, who didn't come)
    this.captiveEnts = new Map(); // prisoner id -> NPC in a cell (when you're there)
    this.columns = new Map(); // war id -> { w, ents } (an army on the march, near you)
    this.syncT = 0;
    this.liveT = 0;
  }

  get ow() {
    return this.game.world.ow;
  }

  get realms() {
    return this.sim.realms;
  }

  get politics() {
    return this.sim.politics;
  }

  key(a, b) {
    return a.id < b.id ? `${a.id}:${b.id}` : `${b.id}:${a.id}`;
  }

  civ(id) {
    return this.ow.civs[id] || null;
  }

  // ------------------------------------------------------------ queries
  warOf(civ) {
    return civ ? this.wars.find((w) => w.a.includes(civ.id) || w.b.includes(civ.id)) || null : null;
  }

  atWar(civ) {
    return !!this.warOf(civ);
  }

  sideOf(w, civ) {
    return w.a.includes(civ.id) ? 'a' : w.b.includes(civ.id) ? 'b' : null;
  }

  enemies(a, b) {
    if (!a || !b || a === b) return false;
    const w = this.warOf(a);
    return !!w && !!this.sideOf(w, b) && this.sideOf(w, a) !== this.sideOf(w, b);
  }

  truce(a, b, day = this.game.day) {
    if (!a || !b) return false;
    return (this.truces[this.key(a, b)] ?? -1) > day;
  }

  weariness(civ) {
    const w = this.warOf(civ);
    return w ? w.weary[civ.id] || 0 : 0;
  }

  // Riders seen on the road: merchants keep away from (and out of) a town
  // expecting raiders, or near the front of a war.
  unsafe(s) {
    if (!s) return false;
    const L = this.game.world.layouts.get(s.id);
    if (L && L.econ && (L.econ.raidAlert || 0) > this.sim.abs) return true;
    return this.front(s);
  }

  // A town within reach of an enemy's town in a war.
  front(s) {
    const civ = s && s.civ;
    const w = civ && this.warOf(civ);
    if (!w) return false;
    const mine = this.sideOf(w, civ);
    const foes = (mine === 'a' ? w.b : w.a).map((id) => this.civ(id)).filter(Boolean);
    return foes.some((f) => this.realms.members(f).some((o) => Math.hypot(o.cx - s.cx, o.cz - s.cz) <= 8));
  }

  // ------------------------------------------------------------ the clock
  update(dt) {
    const day = this.game.day;
    if (this.lastDay === null || this.lastDay === undefined) this.lastDay = day;
    if (day > this.lastDay) {
      for (let d = Math.max(this.lastDay + 1, day - 6); d <= day; d++) this.warDay(d, new RNG(hash4(this.game.seed, d, 0x3a2)));
      this.lastDay = day;
    }
    const now = this.sim.abs;
    for (const r of this.raids.slice()) if (r.state === 'march' && now >= r.at) this.strike(r);
    for (const w of this.wars.slice()) if (w.plan && now >= w.plan.at && !w.plan.live) this.battle(w, w.plan);
    // Called up: a word when it's close (if you're nowhere near the field).
    for (const w of this.wars) {
      if (!w.plan || now < w.plan.at - 90) continue;
      this.eachCalled(w.plan, (d) => {
        if (d.warned) return;
        d.warned = true;
        if (!this.nearMe(w.plan.site, 60)) this.game.ui.msg(`${w.plan.name[0].toUpperCase()}${w.plan.name.slice(1)} starts within the hour, and you're expected in the line!`, '#ff9060');
      });
    }
    if (this.game.player.down && !(this.live && this.live.kind === 'battle' && !this.live.done)) this.wakePlayer('You come to.');
    if (this.live) this.liveTick(dt);
    this.syncT -= dt;
    if (this.syncT <= 0) {
      this.syncT = 1;
      this.syncCaptives();
      this.syncMarch();
    }
  }

  warDay(day, rng) {
    const civs = this.politics.live();
    this.planRaids(civs, day, rng);
    if (day % 7 === 3) this.considerWars(civs, day, rng);
    for (const w of this.wars.slice()) this.warTick(w, day, rng);
    for (const k of Object.keys(this.truces)) if (this.truces[k] <= day) delete this.truces[k];
    this.prisonersDay(day, rng);
    this.raidLog = this.raidLog.filter((q) => day - q.day <= 40);
  }

  // ------------------------------------------------------------ raids
  planRaids(civs, day, rng) {
    const realms = this.realms;
    for (const a of civs) {
      if ((this.cd[a.id] ?? -99) > day - (this.atWar(a) ? 3 : 5)) continue;
      if (this.raids.some((r) => r.civ === a.id)) continue;
      const ruler = realms.ruler(a);
      if (!ruler) continue;
      for (const b of civs) {
        if (b === a || this.politics.bound(a, b) || this.truce(a, b, day)) continue;
        const r = realms.relation(a, b);
        const war = this.enemies(a, b);
        if (r.standing !== 'hostile' && !war) continue;
        // Over the border by land; or, with no border near, by raft over
        // the water (sea, lake or river to sea, lake or river) from much
        // further off.
        const land = this.borderPairs(a, b, 10);
        const sea = this.seaPairs(a, b, 28);
        const naval = !!sea.length && (!land.length || rng.chance(0.35));
        const pairs = naval ? sea : land;
        if (!pairs.length) continue;
        const temper = (ruler.personality?.temper ?? 0.5) + 0.5;
        const p = (0.04 + (r.score <= -50 ? 0.03 : 0) + (war ? 0.05 : 0) + ((a.values || []).includes('martial') ? 0.02 : 0)) * temper * (naval ? 0.6 : 1);
        if (!rng.chance(p)) continue;
        // From whichever border town can spare the most fighters.
        let done = null;
        for (const [s, o] of pairs) if ((done = this.planRaid(a, b, s, o, day, rng, naval))) break;
        if (done) break;
      }
    }
  }

  // The closest towns of two realms (no further apart than `max` squares).
  nearestPair(a, b, max = 99, onlyLaid = true) {
    let best = null;
    for (const s of this.realms.members(a)) {
      if (onlyLaid && !this.laid(s)) continue;
      for (const o of this.realms.members(b)) {
        if (onlyLaid && !this.laid(o)) continue;
        const d = Math.hypot(s.cx - o.cx, s.cz - o.cz);
        if (d <= max && (!best || d < best.d)) best = { s, o, d };
      }
    }
    return best ? [best.s, best.o] : null;
  }

  // Towns of `a` within reach of a town of `b` (each with its nearest
  // target), those with the most guards first.
  borderPairs(a, b, max) {
    const out = [];
    for (const s of this.realms.members(a)) {
      if (!this.laid(s)) continue;
      let best = null;
      for (const o of this.realms.members(b)) {
        // (Nobody rides over the sea: another island is reached by raft.)
        if (!this.laid(o) || !sameIsle(s, o)) continue;
        const d = Math.hypot(s.cx - o.cx, s.cz - o.cz);
        if (d <= max && (!best || d < best.d)) best = { o, d };
      }
      if (!best) continue;
      const L = this.game.world.layouts.get(s.id);
      out.push({ s, o: best.o, d: best.d, g: residents(L).filter((r) => r.job === 'guard').length });
    }
    return out.sort((x, y) => y.g - x.g || x.d - y.d).map((q) => [q.s, q.o]);
  }

  // Towns of `a` on the water (the sea, a lake, a river) with a town of
  // `b` on the water beyond reach by land but within `max` squares:
  // raiders can go by raft. (To another of the Dagoni Islands, from coast
  // to coast, as far as the sea between them: rafts can cross that,
  // just not the storm round them all.)
  seaPairs(a, b, max) {
    const out = [];
    for (const s of this.realms.members(a)) {
      if (!wet(s) || !this.laid(s)) continue;
      let best = null;
      for (const o of this.realms.members(b)) {
        if (!wet(o) || !this.laid(o)) continue;
        const d = Math.hypot(s.cx - o.cx, s.cz - o.cz);
        const over = !sameIsle(s, o);
        if (over && !(s.coast && o.coast && d <= OVERSEA)) continue;
        if (!over && !(d > 10 && d <= max)) continue;
        if (!best || d < best.d) best = { o, d };
      }
      if (best) out.push({ s, o: best.o, d: best.d });
    }
    return out.sort((x, y) => x.d - y.d).map((q) => [q.s, q.o]);
  }

  laid(s) {
    const L = this.game.world.layouts.get(s.id);
    return !!(L && L.econ);
  }

  planRaid(a, b, from, to, day, rng, naval = false) {
    const FL = this.game.world.layouts.get(from.id);
    const TL = this.game.world.layouts.get(to.id);
    if (!FL || !TL) return null;
    const people = residents(FL).filter((r) => r.ruler === undefined && r.job !== 'mayor' && !r.trip?.phase?.startsWith('away') && r.soldier === undefined);
    const guards = people.filter((r) => r.job === 'guard' && r.age === 'adult').sort((x, y) => y.personality.bravery - x.personality.bravery);
    const bold = people.filter((r) => r.age === 'adult' && r.job !== 'guard' && (r.personality?.bravery ?? 0) > 0.6 && (r.personality?.temper ?? 0) > 0.4);
    const n = rng.int(3, 5);
    // (The town keeps at least one guard at home.)
    const party = [...guards.slice(0, Math.max(0, guards.length - 1)), ...bold].slice(0, n);
    if (party.length < 2) return null;
    const id = this.nextId++;
    // At night: they come in the dark hours (by raft, a night or two later:
    // it's a long way round by water).
    const far = naval ? Math.min(2, Math.floor(Math.hypot(from.cx - to.cx, from.cz - to.cz) / 12)) : 0;
    const at = (day + far) * DAY + 21 * 60 + rng.int(30, 240);
    const raid = { id, civ: a.id, foe: b.id, from: from.id, to: to.id, at, party: party.map((r) => ({ sid: from.id, idx: r.idx })), state: 'march', day, naval };
    for (const r of party) {
      r.raid = id;
      r.away = true;
      if (r.ent && !r.ent.dead) this.game.despawnNpc(r.ent);
    }
    this.raids.push(raid);
    this.cd[a.id] = day;
    // Word on the road: riders seen. Merchants stay home.
    TL.econ.raidAlert = at + 12 * 60;
    FL.econ.raidAlert = Math.max(FL.econ.raidAlert || 0, at);
    if (naval) {
      ledger(TL, day, `Rafts of the ${plain(a)} have been sighted ${to.coast ? 'off the coast' : to.river ? 'on the river' : 'out on the lake'}. Merchants are staying home, and the watch is on edge.`);
      ledger(FL, day, `A party of ${party.length} put out on rafts, bound for ${to.name} of the ${plain(b)}.`);
    } else {
      ledger(TL, day, `Riders of the ${plain(a)} have been seen near the border. Merchants are keeping off the roads, and the watch is on edge.`);
      ledger(FL, day, `A party of ${party.length} rode out toward the ${plain(b)} border.`);
    }
    return raid;
  }

  // The raiders arrive: fought out on the ground if you're there, else
  // reckoned up.
  strike(raid) {
    const TL = this.game.world.layouts.get(raid.to);
    const FL = this.game.world.layouts.get(raid.from);
    if (!TL || !FL || deserted(TL.settlement)) return this.endRaid(raid, { result: 'called off', lost: [], loot: 0 });
    raid.state = 'strike';
    if (this.game.active.has(raid.to) && !this.live && this.startLiveRaid(raid, TL, FL)) return null;
    return this.resolveRaid(raid, TL, FL, new RNG(hash4(raid.id, raid.at, 0x4a1d)));
  }

  partyRecs(raid) {
    return raid.party.map((p) => {
      const L = this.game.world.layouts.get(p.sid);
      return L ? L.npcs[p.idx] : null;
    }).filter((r) => r && alive(r));
  }

  soldierPower(r, s) {
    const tech = this.sim.tech;
    let p = r.job === 'guard' ? 1.2 : 0.8;
    if (r.age === 'child') p *= 0.45;
    else if (r.age === 'elder') p *= 0.6;
    if (r.drilled) p *= 1.2;
    if (tech.has(s, 'steel')) p *= 1.15;
    if (tech.has(s, 'archery')) p *= 1.08;
    if (tech.has(s, 'longbows') || tech.has(s, 'crossbows')) p *= 1.05;
    // (The Kavorent's arts: alloy blades, the storm engine.)
    if (this.sim.ancient) p *= this.sim.ancient.power(s);
    p *= clamp((r.hp ?? r.maxHp ?? 12) / Math.max(1, r.maxHp ?? 12), 0.4, 1);
    return p;
  }

  defence(L) {
    const s = L.settlement;
    const tech = this.sim.tech;
    let d = 0;
    for (const r of residents(L)) if (r.job === 'guard') d += this.soldierPower(r, s) * (r.shift === 'night' ? 1.1 : 0.9);
    d += this.sim.playerGuard(s.id) * 1.5;
    const advs = this.sim.adventurers ? this.sim.adventurers.here(s.id) : [];
    d += advs.length * 1.5;
    if (L.walled) d += 1.5 + (tech.has(s, 'fortress') ? 2 : 0);
    if (this.ridesOut(L)) d *= 1.2;
    // (A shield wall at the gate; wardens who know the mist.)
    if (tech.has(s, 'shieldwall')) d *= 1.15;
    if (tech.has(s, 'fog_wardens')) d *= 1.25;
    return d;
  }

  // Does the watch ride out to meet them? (A horse in the stable, or a
  // realm that has learned to fight mounted.)
  ridesOut(L) {
    const st = this.sim.stables.of(L);
    return st.horses - st.horsesOut > 0 || ['cavalry', 'horse_lords', 'horse_archers'].some((k) => this.sim.tech.has(L.settlement, k));
  }

  resolveRaid(raid, TL, FL, rng) {
    const day = Math.floor(raid.at / DAY);
    const a = this.civ(raid.civ);
    const party = this.partyRecs(raid);
    const atk = party.reduce((n, r) => n + this.soldierPower(r, FL.settlement), 0) * (this.sim.tech.has(FL.settlement, 'cavalry') ? 1.1 : 1)
      * (this.sim.tech.has(FL.settlement, 'greatweapons') ? 1.15 : 1) * (this.sim.tech.has(FL.settlement, 'horse_lords') ? 1.1 : 1)
      * (raid.naval && this.sim.tech.has(FL.settlement, 'outriggers') ? 1.15 : 1);
    const def = this.defence(TL);
    const win = rng.chance(atk / (atk + def * 1.1 + 0.5));
    const lost = [];
    for (const r of party) {
      if (rng.chance(win ? 0.08 : 0.3)) lost.push(r);
      else r.hp = Math.max(4, (r.hp ?? 12) - rng.int(0, 8));
    }
    let loot = 0;
    const hurt = [];
    const people = residents(TL);
    if (win) {
      loot = Math.min(Math.floor(TL.econ.treasury * 0.18), 30 + party.length * 18);
      TL.econ.treasury -= loot;
      const k = stockOf(TL);
      for (const item of ['grain', 'bread', 'iron_ingot', 'cloth']) if (k[item] > 0) k[item] = Math.floor(k[item] * 0.75);
      const victim = rng.chance(0.4) ? rng.pick(people.filter((r) => r.age !== 'child')) : null;
      if (victim) hurt.push(victim);
    } else {
      const g = rng.pick(people.filter((r) => r.job === 'guard'));
      if (g && rng.chance(0.5)) hurt.push(g);
    }
    for (const r of hurt) r.hp = Math.max(2, (r.hp ?? 12) - rng.int(4, 9));
    // A defender may fall too.
    const fallen = !win || !hurt.length || !rng.chance(0.2) ? null : hurt[0];
    if (fallen) this.sim.recordDeath(TL, fallen, `killed by raiders of the ${plain(a)}`, null, day);
    // (Some of those who fell were only knocked down, and are dragged off
    // to the cells.)
    const holder = TL.settlement.civ || null;
    const taken = [];
    for (const r of lost) {
      if (rng.chance(0.4) && this.takePrisoner(r, FL, holder, day, `raiding ${TL.settlement.name}`, holder ? null : TL.settlement.id)) taken.push(r);
      else this.sim.recordDeath(FL, r, `fell raiding ${TL.settlement.name}`, null, day);
    }
    return this.endRaid(raid, { result: win ? 'plundered' : 'repelled', lost, taken, loot, hurt, fallen, rode: this.ridesOut(TL) });
  }

  endRaid(raid, out) {
    raid.state = 'done';
    this.raids = this.raids.filter((r) => r !== raid);
    const day = Math.floor(Math.max(raid.at, this.sim.abs - 60) / DAY);
    const a = this.civ(raid.civ);
    const b = this.civ(raid.foe);
    const TL = this.game.world.layouts.get(raid.to);
    const FL = this.game.world.layouts.get(raid.from);
    // Home again (those who made it).
    for (const r of this.partyRecs(raid)) {
      delete r.raid;
      if (!r.captive) r.away = false;
    }
    if (out.result === 'called off' || !TL || !FL) return out;
    if (FL.econ && out.loot) FL.econ.treasury += out.loot;
    const e = TL.econ;
    e.recent.raids = (e.recent.raids || 0) + 1;
    e.recent.violence = (e.recent.violence || 0) + 1;
    e.raidedDay = day;
    e.raidAlert = 0;
    const ts = TL.settlement.name;
    const names = (list) => list.map((r) => r.name.first).join(list.length > 2 ? ', ' : ' and ');
    if (out.result === 'plundered') {
      ledger(TL, day, `Raiders of the ${plain(a)} ${raid.naval ? `came ashore by raft at ${ts}` : `struck ${ts}`} in the night and got away with ¤${out.loot} and stores${out.hurt && out.hurt.length ? `; ${fullName(out.hurt[0])} was ${out.fallen ? 'killed' : 'hurt'}` : ''}.${out.lost.length ? ` ${out.lost.length} of them fell.` : ''}`);
      ledger(FL, day, `Our raiders came back from ${ts} with ¤${out.loot}.${out.lost.length ? ` ${names(out.lost)} did not come home.` : ''}`);
    } else {
      ledger(TL, day, `Raiders of the ${plain(a)} came ${raid.naval ? 'ashore by raft' : 'over the fields'} in the night${out.rode ? '; the watch rode out to meet them' : ''} and drove them off.${out.lost.length ? ` ${out.lost.length} of the raiders fell${out.taken && out.taken.length ? `, ${out.taken.length} of them taken alive and locked up` : ''}.` : ''}`);
      ledger(FL, day, `Our raid on ${ts} was beaten back.${out.lost.length ? ` ${names(out.lost)} did not come home${out.taken && out.taken.length ? ` (${names(out.taken)} taken prisoner)` : ''}.` : ''}`);
    }
    if (a && b) {
      this.realms.shift(a, b, out.result === 'plundered' ? -10 : -6, day);
      this.raidLog.push({ a: a.id, b: b.id, from: raid.from, to: raid.to, day, result: out.result });
    }
    out.day = day;
    raid.out = out;
    return out;
  }

  // ------------------------------------------------------------ declaring
  // Why `a` would go to war with `b` (or nothing, if it wouldn't).
  reasons(a, b, day) {
    const realms = this.realms;
    const out = [];
    const g = this.politics.grievances(a, b, day, 30);
    if (g.filter((d) => d.kind === 'border').length >= 3) out.push({ k: 'land', text: 'the land between them' });
    const raids = this.raidLog.filter((q) => q.b === a.id && q.a === b.id && day - q.day <= 20).length;
    if (raids >= 3) out.push({ k: 'raids', text: `the raids on its towns` });
    const r = realms.relation(a, b);
    const k = this.key(a, b);
    const inc = r.incidents - (this.seen[k] || 0);
    if (inc >= 3) out.push({ k: 'merchants', text: 'the beating and robbing of its merchants' });
    if (b.freed && b.freed.from === a.id && day - b.freed.day <= 60) out.push({ k: 'rebels', text: `${realms.members(b)[0]?.name || 'the rebels'}, which broke away from it` });
    const reb = this.rebels[b.id];
    if (reb && reb.lord === a.id && day - reb.day <= 40) out.push({ k: 'yoke', text: 'a vassal that threw off its rule' });
    if (g.filter((d) => d.kind === 'pact').length >= 2) out.push({ k: 'pact', text: 'broken promises' });
    // A warlord takes any quarrel over the border as cause enough.
    const amb = realms.ambition ? realms.ambition(a, day) : null;
    if (amb === 'warlord' && g.some((d) => d.kind === 'border') && !out.some((q) => q.k === 'land')) out.push({ k: 'land', text: 'the land between them, which its warlord ruler covets' });
    // A holy war, for the faithful under a foreign yoke (see religion.js).
    const hw = this.sim.religion && this.sim.religion.holyCause(a, b, amb, day);
    if (hw) out.push(hw);
    // Starving, beside a neighbour's full granaries.
    const hf = this.sim.hardship && this.sim.hardship.hungryFor(a, b);
    if (hf) out.push({ k: 'farmland', text: `the farmland round ${hf.field.settlement.name}, with ${hf.from.settlement.name} starving` });
    return out;
  }

  considerWars(civs, day, rng) {
    const realms = this.realms;
    for (const a of civs) {
      if (this.atWar(a) || this.politics.lordOf(a)) continue;
      const ruler = realms.ruler(a);
      if (!ruler) continue;
      for (const b of civs) {
        if (b === a || this.atWar(b) || this.politics.bound(a, b) || this.truce(a, b, day)) continue;
        const r = realms.relation(a, b);
        const why = this.reasons(a, b, day);
        this.seen[this.key(a, b)] = Math.max(this.seen[this.key(a, b)] || 0, r.incidents - 2);
        // (Hunger doesn't wait for a quarrel: cool relations will do.)
        if (r.score > (why.some((q) => q.k === 'farmland') ? 5 : -30) || !why.length) continue;
        const ratio = this.politics.strength(a) / Math.max(1, this.politics.strength(b));
        if (ratio < (why.some((q) => q.k === 'rebels' || q.k === 'yoke') ? 0.6 : 0.8)) continue;
        const p = ruler.personality || {};
        // (Embassies: envoys talk first; war half as often.)
        const talk = this.sim.tech.has(a, 'embassies') ? 0.5 : 1;
        const chance = clamp(0.12 + why.length * 0.1 + ((p.temper ?? 0.5) - 0.5) * 0.3 - ((p.kindness ?? 0.5) - 0.5) * 0.3, 0.03, 0.6) * talk;
        if (!rng.chance(chance)) continue;
        this.declare(a, b, why[0], day, rng);
        break;
      }
    }
  }

  declare(a, b, why, day, rng) {
    const w = {
      id: this.nextId++, a: [a.id], b: [b.id], lead: { a: a.id, b: b.id }, reason: why.k, why: why.text, start: day,
      score: 0, weary: { [a.id]: 0, [b.id]: 0 }, battles: [], plan: null, next: day, joined: [],
    };
    this.wars.push(w);
    this.sim.saga?.emit('war_declared', { war: w.id, a: a.id, b: b.id, why: why.text });
    const text = `War! The ${plain(a)} has declared war on the ${plain(b)} over ${why.text}.`;
    for (const c of [a, b]) this.realms.proclaim(c, day, text);
    const here = this.game.currentSettlement;
    if (here && here.civ && (here.civ === a || here.civ === b)) this.game.ui.msg(text, '#ff7060');
    // Vassals march with their lords; allies are called on.
    for (const [side, civ, foe] of [['a', a, b], ['b', b, a]]) {
      for (const v of this.politics.vassalsOf(civ)) this.join(w, side, v, day, 'as its vassal');
      const lord = this.politics.lordOf(civ);
      if (lord && !this.sideOf(w, lord)) this.join(w, side, lord, day, 'to defend its vassal');
      for (const c of this.politics.allies(civ)) {
        if (this.sideOf(w, c)) continue;
        if (this.politics.allied(c, foe)) {
          this.realms.proclaim(c, day, `Allied to both the ${plain(a)} and the ${plain(b)}, the ${plain(c)} will fight for neither.`);
          continue;
        }
        const keen = this.realms.relation(c, civ).score - Math.max(0, this.realms.relation(c, foe).score);
        if (keen > 30 && rng.chance(0.8)) this.join(w, side, c, day, `honouring its alliance with the ${plain(civ)}`);
        else this.politics.breakAlliance(c, civ, day, `the ${plain(c)} would not go to war for it`, -15);
      }
    }
    return w;
  }

  join(w, side, civ, day, how) {
    if (this.sideOf(w, civ) || this.atWar(civ)) return false;
    w[side].push(civ.id);
    w.weary[civ.id] = 0;
    w.joined.push({ civ: civ.id, side, day });
    const lead = this.civ(w.lead[side]);
    const foe = this.civ(w.lead[side === 'a' ? 'b' : 'a']);
    const text = `The ${plain(civ)} has joined the war against the ${plain(foe)}, ${how}.`;
    for (const c of [civ, lead, foe]) if (c) this.realms.proclaim(c, day, text);
    return true;
  }

  // ------------------------------------------------------------ the war
  warTick(w, day, rng) {
    const side = (k) => w[k].map((id) => this.civ(id)).filter((c) => c && this.realms.members(c).length);
    // A side with no towns left has lost.
    if (!side('a').length || !side('b').length) return this.peace(w, day, rng, !side('a').length ? 'b' : 'a', true);
    for (const id of [...w.a, ...w.b]) w.weary[id] = (w.weary[id] || 0) + 0.012;
    // Hard feelings deepen while it lasts.
    for (const x of side('a')) for (const y of side('b')) this.realms.shift(x, y, -0.6, null);
    // The next battle: announced a day ahead, near the front.
    if (!w.plan && day >= w.next) this.planBattle(w, day, rng);
    if (day % 7 === 6) {
      this.betrayals(w, day, rng);
      this.gates(w, day, rng);
      if (this.wars.includes(w)) this.suePeace(w, day, rng);
    }
    return null;
  }

  // Where the armies meet: between the nearest towns of the two sides, out
  // in the fields before the town of whichever side is on the back foot.
  planBattle(w, day, rng) {
    const A = w.a.map((id) => this.civ(id)).filter(Boolean);
    const Bs = w.b.map((id) => this.civ(id)).filter(Boolean);
    let best = null;
    for (const x of A) for (const y of Bs) {
      const pair = this.nearestPair(x, y, 99, false);
      if (!pair) continue;
      const d = Math.hypot(pair[0].cx - pair[1].cx, pair[0].cz - pair[1].cz);
      if (!best || d < best.d) best = { sa: pair[0], sb: pair[1], d, ca: x, cb: y };
    }
    if (!best) return null;
    // Whoever's ahead carries the fight to the other.
    const attacker = w.score > 10 ? 'a' : w.score < -10 ? 'b' : rng.chance(0.6) ? 'a' : 'b';
    const def = attacker === 'a' ? best.sb : best.sa;
    const atk = attacker === 'a' ? best.sa : best.sb;
    const site = this.siteNear(def, atk);
    const cell = this.ow.cell(Math.floor(site.x / REGION_W), Math.floor(site.z / REGION_D));
    const biome = cell ? cell.biome : 'plains';
    const name = `the Battle of ${def.name} ${cell && cell.river ? 'Ford' : FEATURE[biome] || 'Field'}`;
    // The same morning (or a few hours from now, if that's already gone):
    // the attackers muster, then march out in time to meet the defenders.
    const now = this.sim.abs;
    let at = day * DAY + 9 * 60 + rng.int(-60, 90);
    if (at < now + 180) at = Math.round(now + 180 + rng.int(0, 120));
    const ac = attacker === 'a' ? best.ca : best.cb;
    // (Through the realm's portals: they muster at the arch nearest the
    // field, and march from there.)
    const P = this.sim.portals;
    let via = null;
    if (P) {
      for (const q of Object.values(P.list)) {
        const s = this.ow.settlements[q.sid];
        if (!P.open(q.sid) || s.civ !== ac || s.id === atk.id) continue;
        const d0 = Math.hypot(site.x - centreOf(atk).x, site.z - centreOf(atk).z);
        const d1 = Math.hypot(site.x - centreOf(s).x, site.z - centreOf(s).z);
        if (d1 < d0 - 20 && (!via || d1 < via.d)) via = { s, d: d1 };
      }
    }
    const from = centreOf(via ? via.s : atk);
    const march = clamp(Math.round(Math.hypot(site.x - from.x, site.z - from.z) * 0.7), 40, 600);
    // A long way off, over the water: the attackers come by raft.
    // (To another island, always by raft.)
    const naval = !via && (!sameIsle(atk, def) || (best.d > 14 && wet(atk) && wet(def)));
    w.plan = { at, depart: Math.max(now, at - march), site, biome, river: !!(cell && cell.river), name, attacker, atk: atk.id, def: def.id, ca: best.ca.id, cb: best.cb.id, naval, via: via ? via.s.id : undefined };
    const when = whenText(at, now);
    const text = naval ? `The ${plain(ac)} have put an army on rafts, bound for ${def.name}. They will come ashore and meet its defenders ${when}.`
      : `The armies of the ${plain(best.ca)} and the ${plain(best.cb)} are gathering. They will meet outside ${def.name} ${when}.`;
    for (const s of [def, atk]) {
      const L = this.game.world.layouts.get(s.id);
      if (L && L.econ) ledger(L, day, text);
    }
    const here = this.game.currentSettlement;
    if (here && (here === def || here === atk)) this.game.ui.msg(`${text} (It's marked on your map.)`, '#ffb080');
    this.callUp(w, w.plan, day);
    return w.plan;
  }

  // ------------------------------------------------------------ you, called up
  // The realm you're a citizen of, if any.
  playerCiv() {
    const c = this.sim.citizen;
    const s = c ? this.ow.settlements[c.sid] : null;
    return s && s.civ ? s.civ : null;
  }

  // Each player's own call-up to a battle (the host's kept where it always
  // was, as plan.draft; anyone else's by their seat: see game/party.js).
  draftOf(plan) {
    if (!plan) return null;
    const s = this.game.seat;
    if (!s || s.host) return plan.draft || null;
    return (plan.drafts && plan.drafts[s.id]) || null;
  }

  setDraft(plan, d) {
    const s = this.game.seat;
    if (!s || s.host) plan.draft = d;
    else (plan.drafts ||= {})[s.id] = d;
  }

  // Do `fn(draft, player)` as each player called up to `plan` (still
  // 'called', unless `any`).
  eachCalled(plan, fn, any = false) {
    const g = this.game;
    const each = () => {
      const d = this.draftOf(plan);
      if (d && (any || d.state === 'called')) fn(d, g.player);
    };
    if (g.seats && g.seats.length > 1) for (const q of g.everyone()) g.asPlayer(q, each);
    else each();
  }

  // Within `r` of `at` (the one it's being done as)?
  nearMe(at, r) {
    const p = this.game.player;
    return !!p && Math.max(Math.abs(p.x - at.x), Math.abs(p.z - at.z)) <= r;
  }

  // A citizen of a realm at war is called to its battles: be on the field
  // when it starts, and stay in the fight. (Each of you playing who's a
  // citizen of one of its realms.)
  callUp(w, plan, day) {
    const g = this.game;
    if (g.seats && g.seats.length > 1) {
      let first = null;
      for (const q of g.everyone()) g.asPlayer(q, () => (first = this.callUpOne(w, plan, day) || first));
      return first;
    }
    return this.callUpOne(w, plan, day);
  }

  callUpOne(w, plan, day) {
    const me = this.playerCiv();
    if (!me) return null;
    const side = w.a.includes(me.id) ? 'a' : w.b.includes(me.id) ? 'b' : null;
    if (!side) return null;
    if (this.draftOf(plan)) return null;
    const d = { side, civ: me.id, state: 'called', present: 0, hits: 0 };
    this.setDraft(plan, d);
    const foe = this.civ(w.lead[side === 'a' ? 'b' : 'a']);
    const L = this.sim.layoutOf(this.sim.citizen.sid);
    ledger(L, day, `${this.game.playerName} is called up to fight for the ${plain(me)} at ${plan.name}.`);
    this.game.ui.msg(`Called to arms! As a citizen of the ${plain(me)} you must fight ${foe ? `the ${plain(foe)} ` : ''}at ${plan.name}, tomorrow morning (it's marked on your map). Stay away and you'll be named a deserter.`, '#ff9060');
    this.game.audio?.play('alarm');
    return d;
  }

  // Can't come (locked up, or already in a fight elsewhere): excused.
  excused() {
    const J = this.sim.justice;
    return !!(J.jail || J.escort || this.game.player.dead);
  }

  // Never came, or left the field: a deserter, wanted in every town of the
  // realm until it's answered for.
  desert(w, plan) {
    const d = this.draftOf(plan);
    if (!d || d.state !== 'called') return null;
    d.state = 'deserted';
    const civ = this.civ(d.civ);
    if (!civ) return null;
    const day = Math.floor(this.sim.abs / DAY);
    this.deserters[civ.id] = { day, war: w.id, battle: plan.name };
    const J = this.sim.justice;
    for (const s of this.realms.members(civ)) J.commit(s.id, 'desertion', { known: true, quiet: true, silent: true, desc: `Deserting the ${plain(civ)} at ${plan.name}` });
    const cap = this.realms.capitalOf(civ);
    const CL = cap && this.game.world.layouts.get(cap.id);
    if (CL && CL.econ) ledger(CL, day, `${this.game.playerName} never came to ${plan.name}, and is named a deserter.`);
    this.game.ui.msg(`You weren't at ${plan.name}. The ${plain(civ)} name you a deserter: you're wanted in every one of its towns.`, '#ff5050');
    this.game.audio?.play('alarm');
    return true;
  }

  // Answered for (tried in one of its towns): the charge is dropped in the
  // rest of the realm.
  pardonDesertion(civ) {
    if (!civ) return;
    delete this.deserters[civ.id];
    const J = this.sim.justice;
    const g = this.game;
    for (const s of this.realms.members(civ)) {
      const list = J.pendingIn(s.id).filter((c) => c.type !== 'desertion');
      if (list.length) J.pending.set(s.id, list);
      else {
        J.pending.delete(s.id);
        g.wanted.delete(s.id);
      }
    }
  }

  isDeserter(civ) {
    return !!(civ && this.deserters[civ.id]);
  }

  // Did you do your part? On the field for a good while, or in the thick of
  // it, or carried off it.
  reckonDraft(L, winner = null) {
    this.eachCalled(L.plan, () => this.reckonOne(L, winner));
  }

  reckonOne(L, winner = null) {
    const d = this.draftOf(L.plan);
    if (!d || d.state !== 'called') return;
    const p = this.game.player;
    if (d.present >= 20 || d.hits > 0 || p.down) {
      d.state = 'served';
      const civ = this.civ(d.civ);
      const cap = civ && this.realms.capitalOf(civ);
      const CL = cap && this.game.world.layouts.get(cap.id);
      const pay = 15 + Math.min(25, d.hits * 5);
      if (CL && CL.econ && CL.econ.treasury >= pay && !p.down) {
        CL.econ.treasury -= pay;
        p.give('coin', pay);
      }
      if (this.sim.citizen) this.sim.addRenown(this.sim.citizen.sid, 3 + Math.min(6, d.hits), `answering the call at ${L.plan.name}`);
      if (!p.down) this.game.ui.msg(`You did your part at ${L.plan.name}${CL && CL.econ ? `: the ${plain(civ)} pay you ¤${pay} for it` : ''}.`, '#a0e0a0');
      // In the thick of it, and the day won: a statue back home.
      if (winner === d.side && d.hits >= 4 && this.sim.citizen && this.sim.history) this.sim.history.raiseStatue(this.sim.layoutOf(this.sim.citizen.sid), this.game.playerName, `fighting in the front rank at ${L.plan.name}`, Math.floor(this.sim.abs / DAY), 'player');
    } else this.desert(L.w, L.plan);
  }

  // Knocked senseless on the field (by a soldier, in a battle you're in):
  // you lie there till it's over, like anyone else who falls.
  downPlayer(source) {
    const L = this.live;
    const g = this.game;
    const p = g.player;
    if (!L || L.kind !== 'battle' || L.done || p.down || !source || !source.warband) return false;
    if (Math.max(Math.abs(p.x - L.centre.x), Math.abs(p.z - L.centre.z)) > 45) return false;
    const rng = new RNG(hash4(g.seed, Math.floor(this.sim.abs), p.hp, 0xd0e));
    if (!rng.chance(0.6)) return false;
    p.hp = 1;
    p.down = true;
    p.sleeping = true;
    L.playerFoe = source.warband.side;
    g.stopPlayerActions?.();
    for (const n of g.npcs) if (n.threat === p && !n.warband) n.calmDown?.(true);
    g.ui.msg('You\'re knocked senseless...', '#ff7060');
    return true;
  }

  // Coming to after the battle: on your feet if your side held the field,
  // a prisoner if it didn't.
  afterDown(L, winner) {
    const g = this.game;
    if (g.seats && g.seats.length > 1) {
      for (const q of g.everyone()) if (q.down) g.asPlayer(q, () => this.afterDownOne(L, winner));
      return;
    }
    this.afterDownOne(L, winner);
  }

  afterDownOne(L, winner) {
    const p = this.game.player;
    if (!p.down) return;
    const d = this.draftOf(L.plan);
    const mine = d ? d.side : L.playerFoe === 'a' ? 'b' : L.playerFoe === 'b' ? 'a' : winner;
    if (winner === mine || !this.capturePlayer(L.sides[winner].civ, L.plan)) this.wakePlayer(winner === mine ? 'You come to on the field. It\'s ours.' : 'You come to on an empty field. Nobody came for you.');
  }

  wakePlayer(text) {
    const p = this.game.player;
    p.down = false;
    p.sleeping = false;
    p.hp = Math.max(p.hp, Math.ceil(p.maxHp * 0.3));
    if (text) this.game.ui.msg(text, '#e8c080');
  }

  // Taken: marched to the victor's capital and locked in a cell, till
  // they trade you back, ransom you, peace comes, or you break out.
  capturePlayer(by, plan) {
    const g = this.game;
    const J = this.sim.justice;
    const p = g.player;
    const cap = by ? this.realms.capitalOf(by) : null;
    if (!cap || J.jail || deserted(cap)) return false;
    const L = this.sim.layoutOf(cap.id);
    p.down = false;
    p.sleeping = false;
    J.confiscateWeapons(cap.id);
    g.advanceTime(180);
    if (L.jail) {
      g.teleportPlayer(L.jail.stand.x, L.jail.y, L.jail.stand.z);
      J.setCellDoor(L, false);
    } else {
      // (On the square, clear of whatever stands in the middle of it.)
      const at = g.findFreeSpot(L.plaza.cx + 1, L.plaza.cz + 2, GROUND) || { x: L.plaza.cx + 1, z: L.plaza.cz + 2 };
      g.teleportPlayer(at.x, GROUND, at.z);
    }
    p.hp = Math.max(p.hp, Math.ceil(p.maxHp * 0.4));
    const days = 2 + (hash4(g.seed, plan.at, 0x9e1) % 3);
    const me = this.playerCiv();
    J.jail = {
      sid: cap.id, phase: 'serving', t: 0, how: 'captured', pow: { by: by.id, civ: me ? me.id : null, battle: plan.name }, party: [], lines: [], li: 0, lt: 0,
      release: this.sim.abs + days * DAY, cellless: !L.jail, floor: L.jail ? J.floorOf(L) : null, guard: null, judge: null,
    };
    const day = Math.floor(this.sim.abs / DAY);
    ledger(L, day, `${g.playerName} was taken at ${plan.name} and is held in the cells.`);
    g.ui.msg(`Taken prisoner at ${plan.name}! The ${plain(by)} hold you in a cell in ${cap.name}. They'll let you go in a few days, or trade you for one of theirs, or at the peace... or you could break out.`, '#ffb080');
    return true;
  }

  // Out past the edge of a town, toward another: dry land, a fair way out.
  siteNear(def, atk) {
    const a = centreOf(def);
    const b = centreOf(atk);
    const d = Math.hypot(b.x - a.x, b.z - a.z) || 1;
    const ux = (b.x - a.x) / d;
    const uz = (b.z - a.z) / d;
    const bd = def.bounds;
    // From the centre out past the edge of the town, then 22 more.
    let t = 0;
    while (t < d * 0.6) {
      const x = a.x + ux * t;
      const z = a.z + uz * t;
      if (x < bd.x0 - 4 || x > bd.x1 + 4 || z < bd.z0 - 4 || z > bd.z1 + 4) break;
      t += 2;
    }
    t = Math.min(t + 22, d * 0.6);
    for (let k = 0; k < 8; k++) {
      const x = Math.round(a.x + ux * (t + k * 4));
      const z = Math.round(a.z + uz * (t + k * 4));
      const c = this.ow.cell(Math.floor(x / REGION_W), Math.floor(z / REGION_D));
      if (c && c.biome !== 'ocean' && !c.lake) return { x, z };
    }
    return { x: Math.round(a.x + ux * t), z: Math.round(a.z + uz * t) };
  }

  // Who could march: from each realm on a side, the watch of its towns,
  // less a garrison left at home (the capital keeps a third; a town the
  // enemy is marching on sends everyone). Towns far from the front send
  // half, allies a little less. Soldiers with no record (towns not yet laid
  // out) are counted but not named.
  pool(w, side, plan) {
    const near = this.ow.settlements[side === plan.attacker ? plan.atk : plan.def];
    const out = { recs: [], extra: 0, civs: [] };
    for (const id of w[side]) {
      const civ = this.civ(id);
      if (!civ) continue;
      const lead = id === w.lead[side];
      out.civs.push(civ);
      for (const s of this.realms.members(civ)) {
        const d = Math.hypot(s.cx - near.cx, s.cz - near.cz);
        if (d > 24) continue;
        const share = (d > 14 ? 0.5 : 1) * (lead ? 1 : 0.6);
        const L = this.game.world.layouts.get(s.id);
        if (!L || !L.econ) {
          out.extra += Math.round(({ city: 8, town: 4, village: 1 }[s.type] || 1) * share);
          continue;
        }
        const g = residents(L).filter((r) => r.job === 'guard' && r.ruler === undefined && r.raid === undefined && r.soldier === undefined && r.captive === undefined)
          .sort((x, y) => (y.drilled ? 1 : 0) - (x.drilled ? 1 : 0) || y.personality.bravery - x.personality.bravery);
        const keep = s.id === near.id && side !== plan.attacker ? 0 : this.realms.isCapital(s) ? Math.max(1, Math.ceil(g.length / 3)) : 1;
        const n = Math.max(0, Math.round((g.length - keep) * share));
        for (const r of g.slice(0, n)) out.recs.push({ r, L, d });
        // The levy: a share of the able-bodied (more from a martial people,
        // fewer from merchants and scholars), with spears.
        const vals = civ.values || [];
        const rate = (0.25 + (vals.includes('martial') ? 0.1 : 0) - (vals.includes('mercantile') || vals.includes('scholarly') ? 0.06 : 0)) * share * (this.sim.tech.has(s, 'muster') ? 1.5 : 1);
        const able = residents(L).filter((r) => r.age === 'adult' && r.job !== 'guard' && !LEVY_EXEMPT.has(r.job) && r.ruler === undefined && r.councillor === undefined
          && r.raid === undefined && r.soldier === undefined && r.captive === undefined && !r.trip?.phase?.startsWith('away'))
          .sort((x, y) => y.personality.bravery - x.personality.bravery);
        for (const r of able.slice(0, Math.round(able.length * rate))) out.recs.push({ r, L, d: d + 0.5, levy: true });
      }
    }
    // Bandits paid to fight for them.
    out.extra += this.sim.bandits ? this.sim.bandits.hiredFor(w, side) : 0;
    out.recs.sort((x, y) => x.d - y.d);
    return out;
  }

  // How many the leader sends of what could march: at least a third (and
  // a few), all of them at most. The plan decides most of it (a pincer
  // wants numbers, a fortified line or a withdrawal far fewer); then the
  // realm's ways (martial peoples send more, merchants and scholars fewer),
  // the ruler's nerve, whether it's their own town at their backs, how
  // tired of it all they are, and how strong the enemy is.
  commit(w, side, pool, tactic, ratio, plan) {
    const total = pool.recs.length + pool.extra;
    if (!total) return { recs: [], extra: 0, civs: pool.civs, total, min: 0, max: 0 };
    const min = Math.min(total, Math.max(3, Math.round(total * 0.35 + 1)));
    const civ = this.civ(w.lead[side]);
    const ruler = civ && this.realms.ruler(civ);
    const p = (ruler && ruler.personality) || {};
    const vals = (civ && civ.values) || [];
    let f = { line: 0.65, flank: 0.7, pincer: 0.85, hold: 0.5, works: 0.45, feint: 0.6, retreat: 0.3 }[tactic] ?? 0.6;
    f += vals.includes('martial') ? 0.15 : 0;
    f -= vals.includes('mercantile') ? 0.08 : 0;
    f -= vals.includes('scholarly') ? 0.05 : 0;
    f -= vals.includes('pious') || vals.includes('agrarian') ? 0.03 : 0;
    f += ((p.bravery ?? 0.5) - 0.5) * 0.3;
    f += side !== plan.attacker ? 0.1 : 0;
    f -= (w.weary[w.lead[side]] || 0) * 0.2;
    f += ratio < 0.8 ? 0.1 : 0;
    const n = Math.max(min, Math.min(total, Math.round(min + (total - min) * clamp(f, 0, 1))));
    const recs = pool.recs.slice(0, Math.min(n, pool.recs.length));
    return { recs, extra: Math.min(pool.extra, n - recs.length), civs: pool.civs, total, min, max: total };
  }

  // Both armies raised: the plans first (on what each side could field),
  // then how many each sends.
  raise(w, plan, rng) {
    const PA = this.pool(w, 'a', plan);
    const PB = this.pool(w, 'b', plan);
    const qa = this.armyPower(PA, 'a', w, plan);
    const qb = this.armyPower(PB, 'b', w, plan);
    plan.ta = plan.ta || this.chooseTactic(w, 'a', qa, qb, plan, rng);
    plan.tb = plan.tb || this.chooseTactic(w, 'b', qb, qa, plan, rng);
    const A = this.commit(w, 'a', PA, plan.ta, qa / Math.max(0.5, qb), plan);
    const Bm = this.commit(w, 'b', PB, plan.tb, qb / Math.max(0.5, qa), plan);
    plan.sent = { a: [A.recs.length + A.extra, A.total], b: [Bm.recs.length + Bm.extra, Bm.total] };
    return { A, B: Bm };
  }

  // (Kept for older callers: everyone who'd march.)
  muster(w, side, plan) {
    return this.pool(w, side, plan);
  }

  // How each captain means to fight.
  chooseTactic(w, side, mine, theirs, plan, rng) {
    const tech = this.sim.tech;
    const civ = this.civ(w.lead[side]);
    const s0 = this.ow.settlements[side === plan.attacker ? plan.atk : plan.def];
    const ratio = mine / Math.max(0.5, theirs);
    const defending = side !== plan.attacker;
    const wooded = WOODED.has(plan.biome) || plan.biome === 'mountain';
    const open = OPEN.has(plan.biome);
    const ruler = this.realms.ruler(civ);
    const p = (ruler && ruler.personality) || {};
    const last = w.battles.length ? w.battles[w.battles.length - 1][side === 'a' ? 'tb' : 'ta'] : null;
    // Badly outnumbered: an attacker calls it off; a defender with its town
    // at its back may make a stand of it (behind walls, if it can).
    if (ratio < 0.45) {
      if (!defending) return 'retreat';
      const r = rng.next();
      if (tech.has(s0, 'fieldworks') && r < 0.45) return 'works';
      return r < 0.5 + (wooded ? 0.15 : 0) + ((p.bravery ?? 0.5) - 0.5) * 0.4 ? 'hold' : 'retreat';
    }
    const wt = {
      line: 1.2 + (p.bravery ?? 0.5),
      flank: 0.6 + (tech.has(s0, 'cavalry') ? 1.6 : 0) + (open ? 0.6 : 0) + (last === 'hold' || last === 'works' ? 1 : 0),
      pincer: ratio >= 1.3 ? 1.5 + (last === 'hold' ? 1 : 0) : 0,
      hold: (defending ? 1.6 : 0.3) + (wooded ? 1.5 : 0) + (plan.river && defending ? 1 : 0) + (p.kindness ?? 0.5) * 0.5,
      works: tech.has(s0, 'fieldworks') ? (defending ? 2.5 : 0.8) : 0,
      feint: 0.4 + (wooded ? 0.8 : 0) + (last === 'line' ? 0.8 : 0) + (1 - (p.temper ?? 0.5)) * 0.4,
    };
    const total = Object.values(wt).reduce((n, v) => n + v, 0);
    let x = rng.next() * total;
    for (const [k, v] of Object.entries(wt)) {
      x -= v;
      if (x <= 0) return k;
    }
    return 'line';
  }

  terrainMult(t, plan, defending) {
    let m = 1;
    const wooded = WOODED.has(plan.biome) || plan.biome === 'mountain';
    if ((t === 'hold' || t === 'works') && wooded) m *= 1.2;
    if (t === 'feint' && wooded) m *= 1.1;
    if ((t === 'flank' || t === 'pincer') && OPEN.has(plan.biome)) m *= 1.1;
    if (plan.river) m *= defending ? 1.15 : 0.92;
    return m;
  }

  // The battle (reckoned up, or begun on the ground if you're near).
  battle(w, plan) {
    if (!this.live && this.nearPlayer(plan.site, 70) && this.startLiveBattle(w, plan)) return null;
    // Called up, and nowhere near the field (each of you).
    this.eachCalled(plan, (d) => {
      if (this.excused() || this.live) d.state = 'excused';
      else this.desert(w, plan);
    });
    const rng = new RNG(hash4(w.id, plan.at, 0xba7));
    const { A, B: Bm } = this.raise(w, plan, rng);
    return this.fight(w, plan, A, Bm, rng, null);
  }

  armyPower(army, side, w, plan = null) {
    let n = army.extra * 1.1;
    for (const { r, L } of army.recs) n += this.soldierPower(r, L.settlement);
    const civ = this.civ(w.lead[side]);
    const tech = this.sim.tech;
    const s = this.realms.capitalOf(civ);
    if (s && tech.has(s, 'cavalry')) n *= 1.1;
    if (s && tech.has(s, 'obsidian_edge')) n *= 1.06;
    // (Forges fed by the mountain; arrows dipped in the bog.)
    if (s && tech.has(s, 'magma_forges')) n *= 1.1;
    if (s && tech.has(s, 'bog_venom')) n *= 1.08;
    if (plan) {
      // How the realm fights: shields locked to hold, great weapons to
      // break through.
      const attacking = plan.attacker === side;
      if (s && attacking && tech.has(s, 'greatweapons')) n *= 1.15;
      if (s && !attacking && tech.has(s, 'shieldwall')) n *= 1.15;
      // (Under the other side's catapults: stones falling all the while.)
      if (this.engines(plan, side === 'a' ? 'b' : 'a').catapults) n *= 0.88;
    }
    return n * (1 - Math.min(0.4, (w.weary[w.lead[side]] || 0) * 0.3));
  }

  // What siege engines a side brings to a battle: catapults (wherever its
  // realm has learned to build them) and a ram (when there's a walled town
  // to break into: the attackers', against the defending town).
  engines(plan, side) {
    const civ = this.civ(side === 'a' ? plan.ca : plan.cb);
    const s = civ && this.realms.capitalOf(civ);
    const tech = this.sim.tech;
    if (!s) return { catapults: 0, ram: false };
    const def = this.ow.settlements[plan.def];
    const DL = def && this.game.world.layouts.get(def.id);
    return {
      catapults: tech.has(s, 'catapults') ? 1 : 0,
      ram: plan.attacker === side && tech.has(s, 'rams') && !!(DL && DL.walled),
    };
  }

  // Reckon up a battle. `live` (from one fought on the ground) gives the
  // share of each side that fell, and who held the field.
  fight(w, plan, A, Bm, rng, live) {
    const day = Math.floor(plan.at / DAY);
    const pa = this.armyPower(A, 'a', w, plan);
    const pb = this.armyPower(Bm, 'b', w, plan);
    const ta = plan.ta || this.chooseTactic(w, 'a', pa, pb, plan, rng);
    const tb = plan.tb || this.chooseTactic(w, 'b', pb, pa, plan, rng);
    let winner;
    let ratio;
    let fa;
    let fb;
    if (live) {
      winner = live.winner;
      ratio = live.ratio;
      fa = live.fa;
      fb = live.fb;
    } else {
      const ea = pa * MATCH[ta][tb] * this.terrainMult(ta, plan, plan.attacker !== 'a') * rng.float(0.82, 1.18);
      const eb = pb * MATCH[tb][ta] * this.terrainMult(tb, plan, plan.attacker !== 'b') * rng.float(0.82, 1.18);
      winner = ea >= eb ? 'a' : 'b';
      ratio = Math.max(ea, eb) / Math.max(0.3, Math.min(ea, eb));
      const lose = 0.22 + Math.min(0.25, (ratio - 1) * 0.3);
      const win = 0.06 + rng.float(0, 0.1);
      fa = winner === 'a' ? win : lose;
      fb = winner === 'b' ? win : lose;
      // Falling back saves lives, and gives the field away.
      if (ta === 'retreat') {
        fa *= 0.35;
        fb *= 0.5;
        winner = 'b';
      }
      if (tb === 'retreat') {
        fb *= 0.35;
        fa *= 0.5;
        winner = 'a';
      }
    }
    const nA = A.recs.length + A.extra + (live ? live.na : 0);
    const nB = Bm.recs.length + Bm.extra + (live ? live.nb : 0);
    // A handful a side is a skirmish, not a battle.
    const small = nA + nB < 6;
    if (small) plan.name = plan.name.replace(/^the Battle of /, 'the Skirmish at ');
    // (The beaten side's fallen are partly taken alive, by the victors.)
    const victor = this.civ(w.lead[winner]);
    const fallA = this.casualties(A, fa, plan, day, rng, winner === 'b' ? victor : null);
    const fallB = this.casualties(Bm, fb, plan, day, rng, winner === 'a' ? victor : null);
    fallA.taken += live ? live.takenA || 0 : 0;
    fallB.taken += live ? live.takenB || 0 : 0;
    fallA.n += live ? live.deadA : 0;
    fallB.n += live ? live.deadB : 0;
    const decisive = ratio >= 1.5 && (winner === 'a' ? tb : ta) !== 'retreat';
    const gain = Math.round(10 + Math.min(1, ratio - 1) * 15 + (decisive ? 8 : 0));
    w.score = clamp(w.score + (winner === 'a' ? gain : -gain), -150, 150);
    const lostSide = winner === 'a' ? 'b' : 'a';
    for (const id of w[lostSide]) w.weary[id] = (w.weary[id] || 0) + 0.07 + (lostSide === 'a' ? fallA.n / Math.max(1, nA) : fallB.n / Math.max(1, nB)) * 0.25;
    for (const id of w[winner]) w.weary[id] = (w.weary[id] || 0) + 0.025 + (winner === 'a' ? fallA.n / Math.max(1, nA) : fallB.n / Math.max(1, nB)) * 0.15;
    const rec = { day, name: plan.name, site: plan.site, biome: plan.biome, ta, tb, na: nA, nb: nB, la: fallA.n, lb: fallB.n, winner, decisive, live: !!live };
    w.battles.push(rec);
    if (w.battles.length > 12) w.battles.shift();
    w.plan = null;
    w.next = day + 1 + rng.int(0, 1);
    // Soldiers home again.
    for (const { r } of [...A.recs, ...Bm.recs]) {
      if (r.soldier !== undefined) delete r.soldier;
      if (!r.captive) r.away = false;
    }
    // The news, everywhere on both sides.
    const ca = this.civ(w.lead.a);
    const cb = this.civ(w.lead.b);
    const capt = (army) => {
      const c = army.recs.map((q) => q.r).filter((r) => alive(r)).sort((x, y) => y.personality.bravery - x.personality.bravery)[0];
      return c ? ` (led by ${fullName(c)})` : '';
    };
    const W = winner === 'a' ? ca : cb;
    const Lz = winner === 'a' ? cb : ca;
    const wt = winner === 'a' ? ta : tb;
    const lt = winner === 'a' ? tb : ta;
    const ground = (t) => (t === 'hold' ? ` on ${GROUND_TEXT[plan.biome] || 'a low rise'}` : '');
    const lw = winner === 'a' ? fallA.n : fallB.n;
    const ll = winner === 'a' ? fallB.n : fallA.n;
    const tk = winner === 'a' ? fallB.taken : fallA.taken;
    const taken = tk ? ` (${tk} of them taken prisoner)` : '';
    const toll = !lw && !ll ? 'no one fell on either side' : !lw ? `${ll} of the ${plain(Lz)} fell${taken}, and none of theirs` : `${ll} of the ${plain(Lz)} fell${taken}, ${lw} of the ${plain(W)}`;
    const sent = plan.sent ? (k) => (plan.sent[k] ? ` (${plan.sent[k][0]} strong` : '') : null;
    const capt0 = (army, k) => {
      const c = army.recs.map((q) => q.r).filter((r) => alive(r) && !r.captive).sort((x, y) => y.personality.bravery - x.personality.bravery)[0];
      const n = sent ? sent(k) : '';
      return n ? `${n}${c ? `, led by ${fullName(c)}` : ''})` : c ? ` (led by ${fullName(c)})` : '';
    };
    void capt;
    const text = `${plan.name[0].toUpperCase()}${plan.name.slice(1)}: the ${plain(W)}${capt0(winner === 'a' ? A : Bm, winner)} ${TACTICS[wt].verb}${ground(wt)}; the ${plain(Lz)}${capt0(winner === 'a' ? Bm : A, winner === 'a' ? 'b' : 'a')} ${TACTICS[lt].verb}${ground(lt)}. `
      + `The ${plain(W)} ${decisive ? 'won the day decisively' : lt === 'retreat' ? 'held the field' : 'carried the day'}: ${toll}.`;
    for (const id of [...w.a, ...w.b]) {
      const c = this.civ(id);
      if (c) this.realms.proclaim(c, day, text);
    }
    rec.text = text;
    // A great victory has its hero: the boldest of the winners who came
    // through it, with a statue on their own town's square.
    if (decisive && ratio >= 1.8) {
      const army = winner === 'a' ? A : Bm;
      const hero = army.recs.filter((q) => alive(q.r) && q.r.age === 'adult' && !q.r.captive).sort((x, y) => (y.r.personality?.bravery ?? 0) - (x.r.personality?.bravery ?? 0))[0];
      if (hero && this.sim.history) {
        hero.r.life = { ...(hero.r.life || {}), hero: plan.name };
        this.sim.history.raiseStatue(hero.L, fullName(hero.r), `standing firmest at ${plan.name}`, day);
        rec.hero = fullName(hero.r);
      }
    }
    // A decisive win takes the town behind the field (a capital only near
    // the war's end).
    if (decisive && winner === plan.attacker) {
      const s = this.ow.settlements[plan.def];
      const civ = this.civ(winner === 'a' ? plan.ca : plan.cb);
      const cap = s && s.civ && this.realms.isCapital(s);
      // (Siegecraft: ladders and sappers take towns, capitals sooner.)
      const siege = civ && this.sim.tech.has(civ, 'siegecraft');
      // (Walls make it harder, towers harder still; a ram breaks through
      // them all but the towers.)
      const DL = s && this.game.world.layouts.get(s.id);
      const ram = civ && this.sim.tech.has(civ, 'rams');
      const towers = s && this.sim.tech.has(s, 'fortress');
      const walls = DL && DL.walled ? (ram ? 1 : 0.6) * (towers ? 0.75 : 1) : 1;
      if (s && civ && s.civ && s.civ !== civ && (!cap || Math.abs(w.score) >= (siege ? 50 : 80)) && rng.chance(Math.min(0.95, ((small ? 0.3 : cap ? 0.5 : 0.6) + (siege ? 0.25 : 0)) * walls))) {
        this.capture(w, s, civ, day, plan.name);
        // (Where a ram did it: a breach in the wall, to be mended; unless
        // you saw it knocked in already.)
        if (ram && DL && DL.walled && !(DL.econ.breached && DL.econ.breached.day === day) && !(this.live && this.live.ramComing && this.live.plan === plan)) this.breach(DL, plan);
      }
    }
    return rec;
  }

  // A ram that was to break into the town its side took, and never got
  // there (stuck, or you've gone): the wall's broken in all the same.
  settleRams(L) {
    for (const e of L.engines || []) {
      if (!e.after || e.phase === 'breached') continue;
      e.done = true;
      const DL = this.game.world.layouts.get(e.town);
      if (DL && DL.econ && DL.walled && !(DL.econ.breached && DL.econ.breached.day === this.sim.today())) this.breach(DL, L.plan, e.wall);
    }
  }

  // A ram's work: the stretch of wall nearest the field knocked in, three
  // paces wide (the town's builders mend it in time). Returns the tiles.
  breach(L, plan, at = null) {
    const b = L.bounds;
    const f = at || plan.site;
    let best = null;
    for (let z = b.z0 - 12; z <= b.z1 + 12; z++) {
      for (let x = b.x0 - 12; x <= b.x1 + 12; x++) {
        if (L.maskAt(x, z) !== M.WALL) continue;
        const d = Math.hypot(x - f.x, z - f.z);
        if (!best || d < best.d) best = { x, z, d };
      }
    }
    if (!best) return [];
    // Along the wall from there, both ways.
    const along = L.maskAt(best.x + 1, best.z) === M.WALL || L.maskAt(best.x - 1, best.z) === M.WALL ? [1, 0] : [0, 1];
    const tiles = [[best.x, best.z]];
    for (const k of [1, -1]) {
      const x = best.x + along[0] * k;
      const z = best.z + along[1] * k;
      if (L.maskAt(x, z) === M.WALL) tiles.push([x, z]);
    }
    const down = [];
    const up = [];
    for (const [x, z] of tiles) {
      for (let y = GROUND + 3; y >= GROUND; y--) down.push([x, y, z, B.air, 0]);
      for (let y = GROUND; y < GROUND + 3; y++) up.push([x, y, z, B.stone_bricks, 0]);
      if ((x + z) % 2 === 0) up.push([x, GROUND + 3, z, B.stone_bricks, 0]);
    }
    this.sim.setBlocks(down);
    const g = this.game;
    if (g.active.has(L.settlement.id)) {
      for (const [x, z] of tiles) g.renderer.emit(x + 0.5, GROUND + 1, z + 0.5, { n: 14, color: ['#8a8a8a', '#6a625a', '#b8b0a0'], up: 30, speed: 30, life: 1.1, gravity: 40 });
      g.audio?.play('break', { x: best.x, y: GROUND, z: best.z });
      if (g.inSight(best.x, best.z, 2)) g.shake = Math.min(1.3, (g.shake || 0) + 0.5);
    }
    L.econ.breached = { tiles, day: this.sim.today() };
    const xs = tiles.map((t) => t[0]);
    const zs = tiles.map((t) => t[1]);
    this.sim.works.add({ sid: L.settlement.id, kind: 'mend', blocks: up, bounds: { x0: Math.min(...xs), z0: Math.min(...zs), x1: Math.max(...xs), z1: Math.max(...zs) }, bid: L.buildings.length - 0.3, label: 'mending the breach in the wall' });
    return tiles;
  }

  // The fallen: real people of the towns that sent them.
  // (Of a beaten side's fallen, some are only knocked down, and the victors
  // carry them off as prisoners.)
  casualties(army, frac, plan, day, rng, captor = null) {
    // (A fraction of a soldier is a soldier, now and then.)
    const x = (army.recs.length + army.extra) * frac;
    const n = Math.floor(x) + (rng.chance(x - Math.floor(x)) ? 1 : 0);
    const named = rng.shuffle(army.recs.slice()).slice(0, Math.min(army.recs.length, n));
    let taken = 0;
    for (const { r, L } of named) {
      if (!alive(r)) continue;
      if (captor && rng.chance(0.4) && this.takePrisoner(r, L, captor, day, plan.name)) {
        taken++;
        continue;
      }
      this.sim.recordDeath(L, r, `fell at ${plan.name}`, null, day);
    }
    army.extra = Math.max(0, army.extra - (n - named.length));
    for (const { r } of army.recs) if (alive(r)) r.hp = Math.max(4, (r.hp ?? 12) - rng.int(0, 10));
    return { n, taken, named: named.map((q) => q.r) };
  }

  capture(w, s, civ, day, how) {
    const old = s.civ;
    this.realms.join(s, civ);
    this.realms.allegiance.push([s.id, civ.id]);
    const L = this.game.world.layouts.get(s.id);
    if (L && L.econ) {
      for (const r of residents(L)) r.mood = clamp((r.mood ?? 0.5) - 0.12, 0, 1);
      L.econ.unrest = (L.econ.unrest || 0) + 0.5;
    }
    const text = `${s.name} has fallen to the ${plain(civ)} after ${how}!`;
    for (const c of [old, civ]) if (c) this.realms.proclaim(c, day, text);
    if (L && L.econ) ledger(L, day, text);
    // The old capital lost: the realm's seat moves.
    if (old && this.realms.realm(old).capital === s.id) this.realms.pickCapital(old, day);
    w.captured = (w.captured || []).concat([{ sid: s.id, by: civ.id, day }]);
    if (this.game.currentSettlement === s) this.game.ui.msg(text, '#ff7060');
    return s;
  }

  // An ally that's had enough (or been offered better) changes sides.
  betrayals(w, day, rng) {
    for (const side of ['a', 'b']) {
      const other = side === 'a' ? 'b' : 'a';
      const lead = this.civ(w.lead[side]);
      const foe = this.civ(w.lead[other]);
      for (const id of w[side].slice()) {
        if (id === w.lead[side]) continue;
        const c = this.civ(id);
        if (!c || !lead || !foe) continue;
        const toLead = this.realms.relation(c, lead).score;
        const toFoe = this.realms.relation(c, foe).score;
        const losing = side === 'a' ? w.score <= -50 : w.score >= 50;
        const tired = (w.weary[id] || 0) > 0.8;
        if (this.politics.lordOf(c) === lead) {
          // A vassal may break away mid-war, if its lord is losing.
          if (losing && rng.chance(0.2)) {
            delete this.politics.vassals[c.id];
            this.rebels[c.id] = { lord: lead.id, day };
            this.leave(w, side, c, day, `The ${plain(c)} has thrown off the rule of the ${plain(lead)} and left the war.`);
          }
          continue;
        }
        if ((losing || toFoe > toLead + 10) && rng.chance(0.15)) {
          w[side] = w[side].filter((q) => q !== id);
          w[other].push(id);
          this.politics.breakAlliance(c, lead, day, 'betrayal', -40);
          this.realms.shift(c, foe, 20, day);
          this.politics.ally(c, foe, day);
          const text = `Betrayal! The ${plain(c)} has turned on the ${plain(lead)} and gone over to the ${plain(foe)}.`;
          for (const x of [c, lead, foe]) this.realms.proclaim(x, day, text);
          continue;
        }
        if (tired && rng.chance(0.25)) this.leave(w, side, c, day, `Worn out, the ${plain(c)} has made its own peace and left the war.`);
      }
    }
  }

  leave(w, side, c, day, text) {
    w[side] = w[side].filter((q) => q !== c.id);
    for (const id of [...w.a, ...w.b, c.id]) {
      const x = this.civ(id);
      if (x) this.realms.proclaim(x, day, text);
    }
    const foe = this.civ(w.lead[side === 'a' ? 'b' : 'a']);
    if (foe) this.truces[this.key(c, foe)] = day + 30;
  }

  // A town near the front, sick of the war and on the losing side, opens
  // its gates to the enemy.
  gates(w, day, rng) {
    for (const side of ['a', 'b']) {
      const losing = side === 'a' ? w.score < -20 : w.score > 20;
      if (!losing) continue;
      const foe = this.civ(w.lead[side === 'a' ? 'b' : 'a']);
      for (const id of w[side]) {
        const civ = this.civ(id);
        if (!civ || !foe) continue;
        for (const L of this.realms.memberLayouts(civ)) {
          const s = L.settlement;
          if (this.realms.isCapital(s) || (L.econ.unrest || 0) < 1.2 || !this.front(s) || !rng.chance(0.25)) continue;
          const text = `Sick of the war, ${s.name} has opened its gates to the ${plain(foe)}!`;
          this.realms.join(s, foe);
          this.realms.allegiance.push([s.id, foe.id]);
          L.econ.unrest = 0;
          for (const c of [civ, foe]) this.realms.proclaim(c, day, text);
          ledger(L, day, text);
          return s;
        }
      }
    }
    return null;
  }

  // The wearier side asks for terms; the other takes them if it's tired
  // too, or the fighting's gone on long enough.
  suePeace(w, day, rng) {
    const ca = this.civ(w.lead.a);
    const cb = this.civ(w.lead.b);
    const wa = w.weary[w.lead.a] || 0;
    const wb = w.weary[w.lead.b] || 0;
    const long = day - w.start >= 60;
    if (Math.abs(w.score) >= 100) return this.peace(w, day, rng, w.score > 0 ? 'a' : 'b', true);
    if (Math.max(wa, wb) < 1 && !long) return null;
    // The asking side is the wearier (or the one behind).
    const asks = wa - wb > 0.1 ? 'a' : wb - wa > 0.1 ? 'b' : w.score >= 0 ? 'b' : 'a';
    const other = asks === 'a' ? wb : wa;
    const ahead = asks === 'a' ? w.score < -30 : w.score > 30;
    if (other > 0.6 || !ahead || long || rng.chance(0.35)) return this.peace(w, day, rng, w.score > 0 ? 'a' : w.score < 0 ? 'b' : null, false);
    const asker = asks === 'a' ? ca : cb;
    const them = asks === 'a' ? cb : ca;
    if (asker && them) for (const c of [asker, them]) this.realms.proclaim(c, day, `The ${plain(asker)} asked for peace; the ${plain(them)} refused. The war goes on.`);
    return null;
  }

  // Terms: the beaten serve the victor (badly beaten), cede a town (fairly
  // beaten), or both walk away.
  peace(w, day, rng, victor, total) {
    this.wars = this.wars.filter((q) => q !== w);
    this.sim.saga?.emit('war_over', { war: w.id, a: w.lead.a, b: w.lead.b, victor: victor ? w.lead[victor] : null });
    const V = victor ? this.civ(w.lead[victor]) : null;
    const loserSide = victor === 'a' ? 'b' : victor === 'b' ? 'a' : null;
    const Lz = loserSide ? this.civ(w.lead[loserSide]) : null;
    let terms = 'white';
    let text;
    const ca = this.civ(w.lead.a);
    const cb = this.civ(w.lead.b);
    const days = day - w.start;
    if (V && Lz && this.realms.members(Lz).length && (total || Math.abs(w.score) >= 60) && this.politics.strength(Lz) <= this.politics.strength(V) * 1.3) {
      terms = 'vassal';
      this.politics.makeVassal(Lz, V, day);
      text = `The war is over. The ${plain(Lz)} has admitted defeat and will serve the ${plain(V)}, paying tribute every week.`;
    } else if (V && Lz && Math.abs(w.score) >= 25) {
      const pair = this.nearestPair(Lz, V, 99, false);
      const s = pair && !this.realms.isCapital(pair[0]) ? pair[0] : null;
      if (s) {
        terms = 'ceded';
        this.realms.join(s, V);
        this.realms.allegiance.push([s.id, V.id]);
        text = `The war is over after ${days} days. The ${plain(Lz)} has ceded ${s.name} to the ${plain(V)}.`;
      }
      const capL = this.sim.layoutOf(this.realms.realm(Lz).capital);
      const VL = this.sim.layoutOf(this.realms.realm(V).capital);
      if (capL && capL.econ && VL && VL.econ) {
        const n = Math.min(200, Math.floor(capL.econ.treasury * 0.3));
        capL.econ.treasury -= n;
        VL.econ.treasury += n;
        text = `${text || `The war is over after ${days} days.`} The ${plain(Lz)} pays ¤${n} to the ${plain(V)}.`;
        if (terms === 'white') terms = 'paid';
      }
    }
    text ||= `The war between the ${plain(ca)} and the ${plain(cb)} is over after ${days} days, with nothing won. A truce holds for now.`;
    // A truce between everyone who fought, and tempers allowed to cool.
    for (const x of w.a) for (const y of w.b) {
      const X = this.civ(x);
      const Y = this.civ(y);
      if (!X || !Y) continue;
      this.truces[this.key(X, Y)] = day + 30;
      const r = this.realms.relation(X, Y);
      if (r.score < -15) this.realms.shift(X, Y, -15 - r.score, null);
    }
    for (const id of [...w.a, ...w.b]) {
      const c = this.civ(id);
      if (c && this.realms.members(c).length) this.realms.proclaim(c, day, text);
    }
    w.over = { day, terms, victor: V ? V.id : null, text };
    this.freeAll(w, day);
    this.past.push(w);
    if (this.past.length > 6) this.past.shift();
    const here = this.game.currentSettlement;
    if (here && here.civ && (w.a.includes(here.civ.id) || w.b.includes(here.civ.id))) this.game.ui.msg(text, '#a0e0a0');
    return w.over;
  }

  // ------------------------------------------------------------ towns
  // Each day in a town: a war wearing on, the town restless; people back
  // from a raid or battle that ended while away.
  townDay(L, day) {
    const s = L.settlement;
    const civ = s.civ;
    if (civ && (day + s.id) % 7 === 6) {
      const wv = this.weariness(civ);
      if (wv > 0) L.econ.unrest = (L.econ.unrest || 0) + wv * 0.4;
    }
    for (const r of L.npcs) {
      if (r.raid !== undefined && !this.raids.some((q) => q.id === r.raid)) {
        delete r.raid;
        r.away = false;
      }
      if (r.captive && !this.prisoners.some((q) => q.id === r.captive.id)) {
        delete r.captive;
        r.away = false;
      }
      if (r.soldier !== undefined && !(this.live && this.live.w && this.live.w.id === r.soldier)) {
        delete r.soldier;
        r.away = false;
      }
    }
  }

  // For the notice board and the mayor.
  summary(civ) {
    if (!civ) return [];
    const out = [];
    const w = this.warOf(civ);
    if (w) {
      const side = this.sideOf(w, civ);
      const foes = w[side === 'a' ? 'b' : 'a'].map((id) => plain(this.civ(id))).join(', ');
      const friends = w[side].filter((id) => id !== civ.id).map((id) => plain(this.civ(id)));
      const s = side === 'a' ? w.score : -w.score;
      const how = s >= 40 ? 'winning' : s >= 10 ? 'ahead' : s <= -40 ? 'losing badly' : s <= -10 ? 'behind' : 'evenly matched';
      out.push(`At war with the ${foes} (${this.game.day - w.start} days, ${how})${friends.length ? `; with the ${friends.join(', ')}` : ''}`);
      if (w.plan) out.push(`Next battle: outside ${this.ow.settlements[w.plan.def]?.name || '?'}`);
      const last = w.battles[w.battles.length - 1];
      if (last) out.push(`Last battle: ${last.name} (${this.civ(w.lead[last.winner]) ? `won by the ${plain(this.civ(w.lead[last.winner]))}` : '?'})`);
      out.push(`War weariness: ${Math.round((w.weary[civ.id] || 0) * 100)}%`);
    }
    const truces = Object.entries(this.truces).filter(([k, d]) => d > this.game.day && k.split(':').map(Number).includes(civ.id));
    if (truces.length) out.push(`Truce with the ${truces.map(([k]) => plain(this.civ(k.split(':').map(Number).find((q) => q !== civ.id)))).join(', ')}`);
    // Prisoners: theirs held by us, ours held by others.
    const ours = this.prisoners.filter((p) => p.by === civ.id).length;
    const theirs = this.prisoners.filter((p) => p.civ === civ.id).length;
    if (ours || theirs) out.push(`Prisoners: ${ours} held in our cells${theirs ? `, ${theirs} of ours held abroad` : ''}`);
    return out;
  }

  // Battles and raids to mark on the world map: [{ x, z, kind, label }].
  markers() {
    const out = [];
    const now = this.sim.abs;
    for (const w of this.wars) {
      if (w.plan) out.push({ x: w.plan.site.x, z: w.plan.site.z, kind: 'battle', label: `${w.plan.name} (${whenText(w.plan.at, now)})` });
      // The attackers: mustering at home, then on the march to the field
      // (the defenders wait at home). They're on the ground where the map
      // says, when you're near enough to see them (see syncMarch).
      if (w.plan && !w.plan.naval && !w.plan.live) {
        const m = this.marchPos(w.plan);
        const from = this.ow.settlements[w.plan.atk];
        const civ = this.civ(w.plan.attacker === 'a' ? w.plan.ca : w.plan.cb);
        if (m && from && civ) {
          const to = this.ow.settlements[w.plan.def]?.name || 'the enemy';
          out.push({ x: m.x, z: m.z, kind: 'army', color: civ.color.hex, label: m.f <= 0 ? `The ${plain(civ)} army, mustering at ${from.name} to march on ${to}` : `The ${plain(civ)} army, marching on ${to}` });
        }
      }
      for (const b of w.battles.slice(-3)) out.push({ x: b.site.x, z: b.site.z, kind: 'field', label: b.name });
    }
    for (const r of this.raids) {
      const s = this.ow.settlements[r.to];
      if (s) out.push({ ...centreOf(s), kind: 'raid', label: `Raiders expected at ${s.name}` });
    }
    return out;
  }

  // Where the attackers are on their march: mustering in their town until
  // they set out, then along the way to the field at a steady pace. `f`
  // how far along; (dx, dz) the way they're heading.
  marchPos(plan) {
    const from = this.ow.settlements[plan.via ?? plan.atk];
    if (!from) return null;
    const c = centreOf(from);
    const now = this.sim.abs;
    const dep = plan.depart ?? plan.at - DAY;
    const f = clamp((now - dep) / Math.max(1, plan.at - dep), 0, 1);
    const d = Math.hypot(plan.site.x - c.x, plan.site.z - c.z) || 1;
    return { x: c.x + (plan.site.x - c.x) * f, z: c.z + (plan.site.z - c.z) * f, f, dx: (plan.site.x - c.x) / d, dz: (plan.site.z - c.z) / d };
  }

  // The army on the march, on the ground when you're near it: a column of
  // the soldiers going to fight, in file behind the head of it, walking
  // where the map shows them (and out of sight again when you've gone).
  syncMarch() {
    const g = this.game;
    const now = this.sim.abs;
    const want = new Set();
    for (const w of this.wars) {
      const plan = w.plan;
      if (!plan || plan.naval || plan.live || now >= plan.at || (this.live && this.live.kind === 'battle')) continue;
      const m = this.marchPos(plan);
      // (Still mustering in town: they're there as the town's own folk.)
      if (!m || m.f <= 0 || !this.nearPlayer(m, 34)) continue;
      want.add(w.id);
      let col = this.columns.get(w.id);
      if (!col) this.columns.set(w.id, (col = { w, ents: [], tried: false }));
      if (col.tried) continue;
      col.tried = true;
      const rng = new RNG(hash4(w.id, plan.at, 0xba7));
      const { A, B: Bm } = this.raise(w, plan, rng);
      const side = plan.attacker;
      const army = side === 'a' ? A : Bm;
      let i = 0;
      for (const { r, L } of army.recs) {
        if (i >= 10) break;
        if (r.ent && !r.ent.dead) continue;
        const back = 2 + i * 1.6;
        const wide = i % 2 ? 1 : -1;
        let x = Math.round(m.x - m.dx * back - m.dz * wide);
        let z = Math.round(m.z - m.dz * back + m.dx * wide);
        // (Never out of thin air in front of you: further back down the
        // road, and they catch up.)
        for (let k = 0; k < 40 && g.inSight(x, z, 1); k += 2) {
          x = Math.round(x - m.dx * 2);
          z = Math.round(z - m.dz * 2);
        }
        if (g.inSight(x, z, 1)) continue;
        const e = this.spawn(r, L, x, z, side, 'march', { war: w.id, slot: i, foe: false, home: centreOf(this.ow.settlements[plan.atk]) });
        if (!e) continue;
        e.hostileNow = false;
        e.step = Math.max(e.step, 0.45);
        col.ents.push(e);
        i++;
      }
    }
    // A column you've left behind (or one that's become a battle): off out
    // of sight, and gone.
    for (const [id, col] of this.columns) {
      if (want.has(id)) continue;
      col.ents = col.ents.filter((e) => {
        if (e.dead || !e.warband || e.warband.kind !== 'march') return false;
        if (!g.inSight(e.x, e.z, 2)) {
          g.despawnNpc(e);
          return false;
        }
        return true;
      });
      if (!col.ents.length) this.columns.delete(id);
    }
  }

  // Someone already about (a townsman in the street, a soldier who marched
  // here) takes up their place in the line where they stand: nobody
  // vanishes from one place to appear in another.
  enlist(n, side, kind, extra) {
    const L = n.layout;
    const civ = L.settlement.civ;
    n.releaseSpot?.();
    n.state = 'warband';
    n.activity = null;
    n.path = null;
    n.sleeping = false;
    n.warband = { kind, side, civ: civ ? civ.id : null, foe: true, ...extra };
    n.hostileNow = true;
    const col = civ ? civ.color.hex : '#7a6a5a';
    n.look = { ...n.rec.look, hat: kind === 'raid' ? 'hood' : 'helmet', gear: { ...(n.rec.look.gear || {}), body: `tabard:${kind === 'raid' ? darken(col) : col}` } };
    return n;
  }

  // ------------------------------------------------------------ on the ground
  // Any of you playing within `r` of `at` (and the ground there about)?
  nearPlayer(at, r) {
    const all = this.game.everyone ? this.game.everyone() : [this.game.player];
    return all.some((p) => p && Math.max(Math.abs(p.x - at.x), Math.abs(p.z - at.z)) <= r) && !!this.game.world.regionAt(at.x, at.z);
  }

  spawn(rec, L, x, z, side, kind, extra = {}) {
    const g = this.game;
    if (!g.world.regionAt(x, z)) return null;
    const y = g.world.findStandY(x, z, GROUND);
    if (y <= 0) return null;
    const spot = g.findFreeSpot(x, z, y);
    if (!spot) return null;
    return this.spawnAt(rec, L, spot, side, kind, extra);
  }

  spawnAt(rec, L, spot, side, kind, extra = {}) {
    const g = this.game;
    if (rec.ent && !rec.ent.dead) g.despawnNpc(rec.ent);
    const n = g.spawnWarrior(rec, L, spot);
    const civ = L.settlement.civ;
    n.warband = { kind, side, civ: civ ? civ.id : null, foe: true, ...extra };
    n.hostileNow = true;
    // In the realm's colours (a tabard over whatever they wear), so you can
    // tell the sides apart: soldiers helmeted, raiders hooded and darker.
    const col = civ ? civ.color.hex : '#7a6a5a';
    n.look = { ...rec.look, hat: kind === 'raid' ? 'hood' : 'helmet', gear: { ...(rec.look.gear || {}), body: `tabard:${kind === 'raid' ? darken(col) : col}` } };
    return n;
  }

  // Raiders come in over the fields from their side; the watch turns out
  // (riding out to meet them, if the town keeps horses).
  startLiveRaid(raid, TL, FL) {
    const g = this.game;
    const party = this.partyRecs(raid);
    if (!party.length) return false;
    const t = centreOf(TL.settlement);
    const f = centreOf(FL.settlement);
    const d = Math.hypot(f.x - t.x, f.z - t.z) || 1;
    const ux = (f.x - t.x) / d;
    const uz = (f.z - t.z) / d;
    const bd = TL.settlement.bounds;
    let k = 0;
    while (k < 120) {
      const x = t.x + ux * k;
      const z = t.z + uz * k;
      if (x < bd.x0 || x > bd.x1 || z < bd.z0 || z > bd.z1) break;
      k += 2;
    }
    // Out in the fields on their side, out of your sight (or as near it as
    // the world's loaded).
    let from = null;
    for (const out of [16, 22, 28, 34, 10, 4]) {
      const q = { x: Math.round(t.x + ux * (k + out)), z: Math.round(t.z + uz * (k + out)) };
      if (this.game.world.regionAt(q.x, q.z) && (!this.game.inSight(q.x, q.z, 3) || out <= 10)) {
        from = q;
        break;
      }
    }
    const ents = [];
    // By raft: out on the water off the town, paddling in to the shore.
    const sea = raid.naval ? this.landing(TL, f) : null;
    if (sea) {
      const used = new Set();
      party.forEach((r, i) => {
        const at = sea.starts.find((q) => !used.has(q)) || sea.starts[0];
        used.add(at);
        const n = this.spawnAt(r, FL, { x: at.x, y: GROUND, z: at.z }, 'raider', 'raid', { raid: raid.id, home: at.path[at.path.length - 1], goal: { x: TL.plaza.cx, z: TL.plaza.cz }, phase: 'advance', torch: i % 2 === 0, land: { tiles: at.path, i: 0, wait: i * 0.6 } });
        if (!n) return;
        n.raft = { ang: Math.atan2(-(at.path[0].z - at.z), at.path[0].x - at.x) };
        n.inWater = true;
        ents.push(n);
      });
    } else if (from) {
      party.forEach((r, i) => {
        const n = this.spawn(r, FL, from.x + ((i % 3) - 1) * 2, from.z + Math.floor(i / 3) * 2, 'raider', 'raid', { raid: raid.id, home: from, goal: { x: TL.plaza.cx, z: TL.plaza.cz }, phase: 'advance', torch: i % 2 === 0 });
        if (n) ents.push(n);
      });
    }
    if (!ents.length) return false;
    // (Woken by the shouting, if you're asleep in town; and no more
    // waiting about while they're here.)
    g.disturb?.('Shouts and running feet: you stop waiting.');
    g.ui.msg(sea ? `Raiders of the ${plain(this.civ(raid.civ))} are coming ashore by raft at ${TL.settlement.name}!` : `Raiders of the ${plain(this.civ(raid.civ))} are attacking ${TL.settlement.name}!`, '#ff7060');
    g.audio?.play('alarm');
    // The watch rides out.
    const riders = [];
    const st = this.sim.stables.of(TL);
    let horses = Math.max(0, st.horses - st.horsesOut) + (this.sim.tech.has(TL.settlement, 'cavalry') ? 2 : 0);
    const a = g.active.get(TL.settlement.id);
    for (const n of a ? a.npcs : []) {
      if (horses <= 0) break;
      if (n.dead || n.rec.job !== 'guard' || n.sleeping || n.state !== 'routine') continue;
      n.mount = { kind: 'horse', coat: hash4(n.rec.idx, 0xc0a7) % 6, from: TL.settlement.id, banner: TL.settlement.civ ? TL.settlement.civ.color.hex : null, war: true };
      n.state = 'warband';
      n.warband = { kind: 'sortie', side: 'town', civ: TL.settlement.civ ? TL.settlement.civ.id : null, foe: false, goal: from };
      n.say(n.rng.pick(['To horse! Raiders!', 'Ride! Meet them in the fields!', 'Mount up!']), 2.5, '#ffb080');
      riders.push(n);
      horses--;
    }
    if (riders.length) g.ui.msg(`The watch of ${TL.settlement.name} rides out to meet them.`, '#ffe070');
    this.live = { kind: 'raid', raid, TL, FL, ents, riders, t: 0, loot: 0, start: ents.length };
    raid.live = true;
    return true;
  }

  // Where raiders on rafts come in: open water off the town (on the side
  // they come from, as near as can be), each with a way in to the shore.
  landing(TL, f) {
    const w = this.game.world;
    const t = centreOf(TL.settlement);
    const bd = TL.settlement.bounds;
    const base = Math.atan2(f.z - t.z, f.x - t.x);
    const all = [];
    for (let z = bd.z0 - 24; z <= bd.z1 + 24; z += 2) {
      for (let x = bd.x0 - 24; x <= bd.x1 + 24; x += 2) {
        if (!w.regionAt(x, z) || !w.isWaterAt(x, SURFACE, z)) continue;
        const path = this.paddleIn(x, z, t);
        if (!path) continue;
        const da = Math.abs(((Math.atan2(z - t.z, x - t.x) - base + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
        all.push({ x, z, path, score: da * 10 + path.length * 0.3 });
      }
    }
    if (!all.length) return null;
    all.sort((p, q) => p.score - q.score);
    const best = all[0];
    // Side by side along the water (each with its own way in), or the
    // nearest other good places to put in.
    const horiz = Math.abs(t.x - best.x) < Math.abs(t.z - best.z);
    const starts = [best];
    for (const k of [1, -1, 2, -2, 3, -3, 4, -4]) {
      const x = best.x + (horiz ? k : 0);
      const z = best.z + (horiz ? 0 : k);
      if (!w.regionAt(x, z) || !w.isWaterAt(x, SURFACE, z)) continue;
      const path = this.paddleIn(x, z, t);
      if (path) starts.push({ x, z, path });
    }
    for (const q of all) if (starts.length < 6 && q !== best && Math.max(Math.abs(q.x - best.x), Math.abs(q.z - best.z)) <= 10) starts.push(q);
    // (Narrow water: the rest put in just behind, and follow the first in.)
    const wetAt = (x, z) => w.regionAt(x, z) && w.isWaterAt(x, SURFACE, z);
    for (const [ux, uz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const via = [];
      for (let k = 1; k <= 2 && starts.length < 6; k++) {
        const x = best.x + ux * k;
        const z = best.z + uz * k;
        if (!wetAt(x, z) || starts.some((q) => q.x === x && q.z === z)) break;
        const back = [...via].reverse();
        starts.push({ x, z, path: [...back, { x: best.x, y: GROUND, z: best.z, water: true }, ...best.path] });
        via.push({ x, y: GROUND, z, water: true });
      }
    }
    return { starts };
  }

  // Straight in toward the middle of town, a tile at a time: some open
  // water, then a bank low enough to step out on.
  paddleIn(x, z, t) {
    const w = this.game.world;
    const dx = t.x - x;
    const dz = t.z - z;
    const n = Math.max(Math.abs(dx), Math.abs(dz));
    if (!n) return null;
    const tiles = [];
    let px = x;
    let pz = z;
    let wet = 0;
    for (let k = 1; k <= 30; k++) {
      const nx = Math.round(x + (dx * k) / n);
      const nz = Math.round(z + (dz * k) / n);
      for (const [tx, tz] of nx !== px && nz !== pz ? [[nx, pz], [nx, nz]] : [[nx, nz]]) {
        if (!w.regionAt(tx, tz)) return null;
        if (w.isWaterAt(tx, SURFACE, tz)) {
          wet++;
          tiles.push({ x: tx, y: GROUND, z: tz, water: true });
        } else {
          const y = w.findStandY(tx, tz, GROUND);
          if (y <= 0 || Math.abs(y - GROUND) > 1 || wet < 3) return null;
          tiles.push({ x: tx, y, z: tz });
          return tiles;
        }
        px = tx;
        pz = tz;
      }
    }
    return null;
  }

  // Two armies drawn up facing each other; each side fights its captain's
  // plan; the battle ends when one side breaks.
  startLiveBattle(w, plan) {
    const rng = new RNG(hash4(w.id, plan.at, 0xba7));
    const { A, B: Bm } = this.raise(w, plan, rng);
    if (!A.recs.length || !Bm.recs.length) {
      plan.ta = null;
      plan.tb = null;
      return false;
    }
    const sa = this.ow.settlements[plan.attacker === 'a' ? plan.atk : plan.def];
    const sb = this.ow.settlements[plan.attacker === 'a' ? plan.def : plan.atk];
    const ca = centreOf(sa);
    const cb = centreOf(sb);
    const d = Math.hypot(ca.x - cb.x, ca.z - cb.z) || 1;
    // The field's axis: from b's side to a's.
    const ax = { x: (ca.x - cb.x) / d, z: (ca.z - cb.z) / d };
    const perp = { x: -ax.z, z: ax.x };
    const c = plan.site;
    const live = { kind: 'battle', w, plan, A, B: Bm, t: 0, axis: ax, perp, centre: c, sides: {}, walls: [], done: false, go: false };
    for (const [side, army, t] of [['a', A, plan.ta], ['b', Bm, plan.tb]]) {
      const sign = side === 'a' ? 1 : -1;
      const tech = this.sim.tech;
      const civ = this.civ(w.lead[side]);
      const s0 = side === 'a' ? sa : sb;
      const cav = tech.has(s0, 'cavalry');
      const list = army.recs.slice(0, LIVE_MAX);
      const ents = [];
      const n = list.length;
      const wide = Math.min(n, 9);
      list.forEach(({ r, L }, i) => {
        // The line, ten paces back from the middle of the field (a second
        // rank two paces behind the first).
        const rank = Math.floor(i / wide);
        const k = i % wide;
        const inRank = Math.min(wide, n - rank * wide);
        const off = (k - (inRank - 1) / 2) * 2 + rank;
        const x = Math.round(c.x + ax.x * (11 + rank * 2) * sign + perp.x * off);
        const z = Math.round(c.z + ax.z * (11 + rank * 2) * sign + perp.z * off);
        const role = t === 'pincer' ? (i % 3 === 0 ? 'left' : i % 3 === 1 ? 'right' : 'centre') : t === 'flank' ? (i < Math.ceil(n * 0.4) ? 'wing' : 'centre') : 'centre';
        const cfg = { war: w.id, role, levy: r.job !== 'guard', home: { x: c.x + ax.x * 40 * sign, z: c.z + ax.z * 40 * sign }, form: { x, z }, phase: 'form' };
        let e = null;
        if (r.ent && !r.ent.dead) {
          // Already about (marched here, or out of the town nearby): into
          // the line from where they are.
          e = this.enlist(r.ent, side, 'battle', { ...cfg, phase: 'march' });
        } else if (!this.game.inSight(x, z, 2)) e = this.spawn(r, L, x, z, side, 'battle', cfg);
        // In view of you (or off the edge of the world that's about): they
        // come up from behind their lines, or in from the side.
        if (!e && !(r.ent && !r.ent.dead)) {
          const q = this.offstage(x, z, ax, perp, sign);
          e = q ? this.spawn(r, L, q.x, q.z, side, 'battle', { ...cfg, phase: 'march' }) : null;
        }
        if (!e) return;
        r.soldier = w.id;
        r.away = true;
        // Riders, where the realm fights mounted (the flankers first).
        if (cav && (role === 'wing' || role === 'left' || role === 'right' || i < 2) && ents.filter((q) => q.mount).length < 3) {
          e.mount = { kind: 'horse', coat: hash4(r.idx, 0xc0a7) % 6, banner: civ ? civ.color.hex : null, war: true };
        }
        ents.push(e);
      });
      live.sides[side] = { civ, tactic: t, ents, start: ents.length, broken: false, hates: false, sign };
    }
    this.fieldMercs(live, w);
    if (!live.sides.a.ents.length || !live.sides.b.ents.length) {
      for (const s of Object.values(live.sides)) for (const e of s.ents) this.game.despawnNpc(e);
      return false;
    }
    // Log walls and stakes, thrown up in front of a side that digs in.
    for (const side of ['a', 'b']) if (live.sides[side].tactic === 'works') this.raiseWorks(live, side);
    // Catapults behind the lines, and a ram, where the realms have them.
    fieldEngines(this, live);
    plan.live = true;
    this.live = live;
    // (A column that marched here is part of it now.)
    this.columns.delete(w.id);
    const g = this.game;
    // Called up: the other side knows which line you're in (each of you).
    this.eachCalled(plan, (d) => {
      live.sides[d.side === 'a' ? 'b' : 'a'].hates = true;
      g.ui.msg(`You're with the ${plain(live.sides[d.side].civ)}. Into the line, and stay in the fight!`, '#ffb080');
    });
    g.ui.msg(`${plan.name[0].toUpperCase()}${plan.name.slice(1)} is about to begin: the ${plain(live.sides.a.civ)} (${TACTICS[plan.ta].name}) against the ${plain(live.sides.b.civ)} (${TACTICS[plan.tb].name})!`, '#ffb080');
    g.audio?.play('alarm');
    g.disturb?.('Drums and horns: you stop waiting.');
    return true;
  }

  // Somewhere out of your sight (and in the world that's about) to bring a
  // soldier on from, nearest their place in the line: back behind it, or
  // in from one side.
  offstage(x, z, ax, perp, sign) {
    const g = this.game;
    const ok = (q) => g.world.regionAt(q.x, q.z) && !g.inSight(q.x, q.z, 1) && g.world.findStandY(q.x, q.z, GROUND) > 0;
    for (let k = 2; k <= 60; k += 2) {
      const q = { x: Math.round(x + ax.x * k * sign), z: Math.round(z + ax.z * k * sign) };
      if (ok(q)) return q;
    }
    for (let k = 10; k <= 40; k += 3) {
      for (const sd of [1, -1]) {
        const q = { x: Math.round(x + perp.x * k * sd), z: Math.round(z + perp.z * k * sd) };
        if (ok(q)) return q;
      }
    }
    return null;
  }

  // Bandits paid to fight: their own knot of them out on the flank, hooded
  // and in no colours, fighting for the coin, and off the moment the day
  // looks lost (see warrior.js).
  fieldMercs(live, w) {
    const B0 = this.sim.bandits;
    if (!B0) return;
    const g = this.game;
    const { centre: c, axis: ax, perp } = live;
    for (const side of ['a', 'b']) {
      const S = live.sides[side];
      if (!S) continue;
      let k = 0;
      for (const band of B0.live().filter((b) => b.hired && b.hired.war === w.id && b.hired.side === side)) {
        const L = g.world.layouts.get(band.near) || (S.ents[0] && S.ents[0].layout);
        if (!L || !L.econ) continue;
        for (const m of band.members.slice(0, 6)) {
          const flank = (k % 2 ? -1 : 1) * (9 + Math.floor(k / 2));
          const x = Math.round(c.x + ax.x * 13 * S.sign + perp.x * flank);
          const z = Math.round(c.z + ax.z * 13 * S.sign + perp.z * flank);
          // (In view of you: they come up from behind, out of sight.)
          let sx = x;
          let sz = z;
          for (let q = 0; q < 40 && g.inSight(sx, sz, 1); q += 2) {
            sx = Math.round(sx + ax.x * 2 * S.sign);
            sz = Math.round(sz + ax.z * 2 * S.sign);
          }
          if (!g.world.regionAt(sx, sz) || g.inSight(sx, sz, 1)) continue;
          const y = g.world.findStandY(sx, sz, GROUND);
          if (y <= 0) continue;
          const spot = g.findFreeSpot(sx, sz, y);
          if (!spot) continue;
          const e = this.spawnAt(B0.recFor(band, m, L), L, spot, side, 'battle', {
            war: w.id, role: 'wing', levy: false, home: { x: c.x + ax.x * 45 * S.sign, z: c.z + ax.z * 45 * S.sign }, form: { x, z }, phase: sx === x && sz === z ? 'form' : 'march',
            merc: band.id, band: band.id, member: m.id,
          });
          e.warband.civ = S.civ ? S.civ.id : null;
          B0.ents.set(`${band.id}:${m.id}`, e);
          e.look = { ...e.rec.look, hat: 'hood', gear: { ...(e.rec.look.gear || {}) } };
          S.ents.push(e);
          S.start++;
          S.mercs = (S.mercs || 0) + 1;
          k++;
        }
        band.fought = (band.fought || 0) + 1;
      }
      if (k) g.ui.msg(`${k} hired swords stand out on the ${plain(S.civ)} flank.`, '#d8b080');
    }
  }

  // A short wall of logs two high in front of the line, with stakes at
  // the ends: the enemy has to come round it.
  raiseWorks(live, side) {
    const w = this.game.world;
    const { centre: c, axis: ax, perp } = live;
    const sign = live.sides[side].sign;
    const ops = [];
    for (let i = -4; i <= 4; i++) {
      const x = Math.round(c.x + ax.x * 7 * sign + perp.x * i);
      const z = Math.round(c.z + ax.z * 7 * sign + perp.z * i);
      if (!w.regionAt(x, z)) continue;
      const y = w.findStandY(x, z, GROUND);
      if (y <= 0 || this.game.entityAt(x, y, z)) continue;
      const tall = Math.abs(i) <= 3;
      for (let h = 0; h < (tall ? 2 : 1); h++) {
        if (w.getBlock(x, y + h, z) !== B.air) continue;
        ops.push([x, y + h, z, tall ? B.log_wall : B.fence]);
      }
    }
    // Up a little at a time (see liveTick).
    live.walls.push(...ops.map((o) => ({ op: o, up: false })));
  }

  liveTick(dt) {
    const L = this.live;
    L.t += dt;
    this.liveT -= dt;
    if (this.liveT > 0) return;
    this.liveT = 0.25;
    if (L.kind === 'raid') this.raidTick(L);
    else {
      if (L.plan && !L.done) {
        this.eachCalled(L.plan, (d, p) => {
          if (!p.dead && !p.down && Math.max(Math.abs(p.x - L.centre.x), Math.abs(p.z - L.centre.z)) <= 30) d.present += 0.25;
        });
      }
      this.battleTick(L);
    }
  }

  // The raid on the ground: over when the raiders are all down or gone.
  raidTick(L) {
    const g = this.game;
    const raid = L.raid;
    const up = L.ents.filter((n) => !n.dead && !n.down && g.npcs.includes(n));
    // Riders who've reached the fight get down and fight on foot.
    for (const n of L.riders) {
      if (n.dead || n.state !== 'warband') continue;
      const t = up.filter((q) => q.warband.phase !== 'flee').sort((x, y) => x.distTo(n) - y.distTo(n))[0];
      if (!t || n.distTo(t) <= 3) {
        if (n.mount) {
          n.mount = null;
          if (t) n.say(n.rng.pick(['At them!', 'For the town!', 'Hold!']), 2, '#ffb080');
        }
        n.warband = null;
        if (t) n.engage(t);
        else n.calmDown(true);
      }
    }
    // Broken: half of them down, or long enough at it.
    const down = L.start - up.length;
    if ((down * 2 >= L.start || L.t > 150) && !L.fleeing) {
      L.fleeing = true;
      for (const n of up) {
        n.warband.phase = 'flee';
        n.say(n.rng.pick(['Fall back!', 'Run!', 'Back, back!']), 2, '#ffb080');
      }
    }
    if (up.length && L.t < 300) return;
    // Over: those knocked down are dragged off to the cells; reckon up the
    // rest from what happened.
    const day = Math.floor(this.sim.abs / DAY);
    const holder = L.TL.settlement.civ || null;
    const taken = [];
    for (const n of L.ents) {
      if (n.dead || !n.down) continue;
      if (this.takePrisoner(n.rec, L.FL, holder, day, `raiding ${L.TL.settlement.name}`, holder ? null : L.TL.settlement.id)) taken.push(n.rec);
      else this.wake(n);
    }
    this.wakeDowned();
    const lost = [...this.partyRecs(raid).filter((r) => !alive(r)), ...taken];
    const dead = raid.party.map((p) => this.game.world.layouts.get(p.sid)?.npcs[p.idx]).filter((r) => r && !alive(r));
    for (const n of L.riders) if (!n.dead && n.state === 'warband') {
      n.mount = null;
      n.warband = null;
      n.calmDown(true);
    }
    this.live = null;
    const loot = Math.min(L.loot, L.TL.econ.treasury);
    L.TL.econ.treasury -= loot;
    const out = this.endRaid(raid, { result: loot > 0 ? 'plundered' : 'repelled', lost: [...new Set([...lost, ...dead])], taken, loot, hurt: [], rode: L.riders.length > 0 });
    if (taken.length) g.ui.msg(`${taken.length} of the raiders ${taken.length > 1 ? 'were' : 'was'} dragged off to the cells.`, '#ffe070');
    g.ui.msg(loot > 0 ? `The raiders got away with ¤${loot}.` : `The raiders have been driven off!`, loot > 0 ? '#ffb080' : '#a0e0a0');
    return out;
  }

  battleTick(L) {
    const g = this.game;
    const w = g.world;
    // The works go up while the lines form.
    if (L.t < 10) {
      const n = Math.ceil(L.walls.length * Math.min(1, L.t / 8));
      for (let i = 0; i < n; i++) {
        const q = L.walls[i];
        if (q.up) continue;
        const [x, y, z, id] = q.op;
        if (!w.regionAt(x, z) || w.getBlock(x, y, z) !== B.air || g.entityAt(x, y, z)) continue;
        w.setBlock(x, y, z, id, 0);
        q.up = true;
        g.renderer.emit(x, y, z, { n: 4, color: ['#8a6a3a', '#5a4022'], up: 16, speed: 20, life: 0.4 });
      }
    }
    const standing = (s) => L.sides[s].ents.filter((n) => !n.dead && !n.down && g.npcs.includes(n) && n.warband && n.warband.phase !== 'flee');
    for (const s of ['a', 'b']) {
      const side = L.sides[s];
      const up = standing(s);
      // A side breaks when most of it is down.
      if (!side.broken && !L.done && up.length <= Math.floor(side.start * 0.35)) {
        side.broken = true;
        for (const n of up) {
          n.warband.phase = 'flee';
          n.say(n.rng.pick(['Retreat! Retreat!', 'Fall back!', 'It\'s lost, run!']), 2.2, '#ffb080');
        }
      }
    }
    const ua = standing('a');
    const ub = standing('b');
    workEngines(this, L, 0.25);
    stormEngine(this, L);
    // The lines drawn up (most of each side in its place, or long enough
    // waiting for stragglers): it begins.
    if (!L.go) {
      const formed = (list) => list.filter((n) => n.warband.phase !== 'march').length >= Math.ceil(list.length * 0.75);
      if ((formed(ua) && formed(ub)) || L.t > 25) {
        L.go = true;
        L.goT = L.t;
        g.audio?.play('alarm');
      }
    }
    // (Nobody's come to blows for a long while, one side never having got
    // here, or both dug in and waiting: it's over, and it goes by numbers.)
    if (L.go && !L.done) {
      // (Coming to blows: close enough to strike, and able to; lines drawn
      // up within sight of each other and doing nothing don't count.)
      const able = (n) => !(n.stunT > 0) && !n.down;
      if (ua.some((x) => able(x) && ub.some((y) => able(y) && Math.max(Math.abs(x.x - y.x), Math.abs(x.z - y.z)) <= 2))) L.contactT = L.t;
      if (L.t - (L.contactT ?? L.goT ?? L.t) > 50) L.standoff = true;
    }
    if (!L.done && (L.sides.a.broken || L.sides.b.broken || L.standoff || L.t > 180 + (L.goT || 0) || !ua.length || !ub.length)) this.endLiveBattle(L, ua, ub);
    // Afterwards: everyone walks off (and is gone once out of sight); the
    // walls come down when the field's empty, or you've gone.
    if (L.done) {
      L.after = (L.after || 0) + 0.25;
      const left = [...L.sides.a.ents, ...L.sides.b.ents].filter((n) => !n.dead && g.npcs.includes(n));
      const far = !this.nearPlayer(L.centre, 90);
      // (A ram still on its way to the wall: its crew stay with it.)
      const rams = ramming(L);
      const crew = (n) => rams && n.warband && n.warband.role === 'crew';
      if (L.after > 40) {
        for (const n of left) {
          if (crew(n)) continue;
          if (!g.inSight(n.x, n.z, 2)) g.despawnNpc(n);
          else if (n.warband && n.warband.phase !== 'flee' && n.warband.phase !== 'won' && !n.down) n.warband.phase = 'flee';
        }
      }
      // (Done with the field after a while either way: anyone still in view
      // walks off on their own, and is gone once out of sight.)
      if (!left.length || far || L.after > (rams ? 150 : 45)) {
        for (const n of left) {
          if (far || !g.inSight(n.x, n.z, 2)) g.despawnNpc(n);
          else if (n.warband && n.warband.phase !== 'won') n.warband.phase = 'flee';
        }
        this.settleRams(L);
        for (const q of L.walls) if (q.up) g.renderer.emit(q.op[0], q.op[1], q.op[2], { n: 3, color: ['#8a6a3a', '#5a4022'], up: 14, speed: 18, life: 0.4 });
        this.clearWorks(L);
        this.live = null;
      }
    }
  }

  endLiveBattle(L, ua, ub) {
    const g = this.game;
    L.done = true;
    const pa = L.sides.a.start;
    const pb = L.sides.b.start;
    const deadA = L.sides.a.ents.filter((n) => n.dead && !alive(n.rec)).length;
    const deadB = L.sides.b.ents.filter((n) => n.dead && !alive(n.rec)).length;
    const fa = deadA / Math.max(1, pa);
    const fb = deadB / Math.max(1, pb);
    const winner = L.sides.a.broken ? 'b' : L.sides.b.broken ? 'a' : ua.length / Math.max(1, pa) >= ub.length / Math.max(1, pb) ? 'a' : 'b';
    const ratio = Math.max(0.2, (winner === 'a' ? ua.length / Math.max(1, pa) : ub.length / Math.max(1, pb))) / Math.max(0.2, (winner === 'a' ? ub.length / Math.max(1, pb) : ua.length / Math.max(1, pa)));
    // The beaten side's wounded, lying on the field, are taken prisoner;
    // the victors' get up and go home.
    const day = Math.floor(this.sim.abs / DAY);
    const victor = L.sides[winner].civ;
    const taken = { a: 0, b: 0 };
    for (const s of ['a', 'b']) for (const n of L.sides[s].ents) {
      if (n.dead || !n.down) continue;
      if (s !== winner && victor && !n.warband?.merc && this.takePrisoner(n.rec, n.layout, victor, day, L.plan.name, null, true)) {
        taken[s]++;
        // Hauled up and led off by the victors (to the cells, out of
        // sight), not gone in a blink.
        n.down = false;
        n.sleeping = false;
        n.hp = Math.max(n.hp, 2);
        n.warband = { ...n.warband, kind: 'led', phase: 'flee', foe: false, home: L.sides[winner].ents.find((q) => q.warband)?.warband.home || n.warband.home };
        n.hostileNow = false;
        n.restrained = true;
        n.say(n.rng.pick(['I yield...', 'Mercy!', 'Easy, easy...', 'Alright, alright.']), 2, '#c8c8c8');
      } else this.wake(n);
    }
    // Those who fought here already counted; the rest of each army by the
    // same measure.
    const strip = (army, side) => {
      const here = new Set(L.sides[side].ents.map((n) => n.rec));
      return { recs: army.recs.filter((q) => !here.has(q.r)), extra: army.extra };
    };
    const A = strip(L.A, 'a');
    const Bm = strip(L.B, 'b');
    const rng = new RNG(hash4(L.w.id, L.plan.at, 0xe0d));
    // (The attackers' ram, if they win, goes on to break the wall of the
    // town they take: you see it done, rather than the wall just falling.)
    L.ramComing = winner === L.plan.attacker && (L.engines || []).some((e) => e.type === 'ram' && e.side === winner && e.wall && !e.broken && e.phase !== 'stuck' && e.phase !== 'breached');
    this.fight(L.w, L.plan, A, Bm, rng, { winner, ratio, fa: fa + taken.a / Math.max(1, pa), fb: fb + taken.b / Math.max(1, pb), deadA: deadA + taken.a, deadB: deadB + taken.b, takenA: taken.a, takenB: taken.b, na: pa, nb: pb });
    const def = this.ow.settlements[L.plan.def];
    endEngines(L, L.ramComing && def && def.civ === L.sides[winner].civ ? winner : null);
    // Soldiers who walked off the field are home again.
    for (const s of ['a', 'b']) for (const n of L.sides[s].ents) {
      if (n.rec.soldier !== undefined) delete n.rec.soldier;
      if (!n.rec.captive) n.rec.away = false;
      // (Except the ram's crew, still at work.)
      if (n.warband && n.warband.role === 'crew' && !n.dead) continue;
      if (!n.dead && n.warband && g.npcs.includes(n)) {
        n.warband.phase = s === winner ? 'won' : 'flee';
        if (s === winner && n.rng.chance(0.6)) n.say(n.rng.pick(['Victory!', 'They run!', 'The field is ours!', 'Huzzah!']), 2.5, '#a0e0a0');
      }
    }
    g.ui.msg(`The ${plain(L.sides[winner].civ)} ${winner === 'a' ? (L.sides.b.broken ? 'broke' : 'beat') : (L.sides.a.broken ? 'broke' : 'beat')} the ${plain(L.sides[winner === 'a' ? 'b' : 'a'].civ)} at ${L.plan.name}.`, '#ffe070');
    // Called up: did you do your part? And if you fell, where you wake.
    this.reckonDraft(L, winner);
    this.afterDown(L, winner);
    // You fought for one side: they remember it.
    for (const s of ['a', 'b']) {
      const o = s === 'a' ? 'b' : 'a';
      if (!L.sides[o].hates) continue;
      const home = this.ow.settlements[s === L.plan.attacker ? L.plan.atk : L.plan.def];
      if (home && s === winner) this.sim.addRenown(home.id, 6, `fighting at ${L.plan.name}`);
    }
  }

  // Back on their feet after being knocked down.
  wake(n) {
    n.down = false;
    n.sleeping = false;
    n.hp = Math.max(n.hp, Math.ceil(n.maxHp * 0.2));
    if (n.warband) n.warband.phase = 'flee';
  }

  wakeDowned() {
    for (const n of this.game.npcs) if (n.down && !n.dead && !n.warband) {
      n.down = false;
      n.sleeping = false;
      n.hp = Math.max(n.hp, Math.ceil(n.maxHp * 0.2));
      n.calmDown(true);
    }
  }

  // Knocked down, not killed (sometimes): a soldier, raider or escaping
  // prisoner who'll be carried off (or get up) when it's over.
  knockDown(n, source = null) {
    const wb = n.warband;
    const chance = !wb ? 0 : wb.kind === 'escape' ? 0.7 : wb.kind === 'raid' ? 0.5 : wb.kind === 'battle' ? 0.45 : 0;
    // (The town's own defenders are only knocked out in a raid, never killed;
    // bandits are after purses, and leave the folk they cut down groaning.)
    const defender = !wb && ((this.live && this.live.kind === 'raid' && n.layout === this.live.TL && n.rec.job === 'guard') || (source && source.warband && source.warband.kind === 'bandit'));
    if (!defender && !(Math.random() < chance)) return false;
    n.hp = 1;
    n.down = true;
    n.sleeping = true;
    n.threat = null;
    n.path = null;
    if (wb) {
      wb.phase = 'down';
      n.state = 'warband';
    } else n.state = 'down';
    n.mount = null;
    n.say(n.rng.pick(['Ugh...', 'Argh!', '...', 'Oof!']), 1.5, '#ffb080');
    // An escaping prisoner caught again: back to the cells.
    if (wb && wb.kind === 'escape') {
      const p = this.prisoners.find((q) => q.id === wb.prisoner);
      if (p) {
        this.captiveEnts.delete(p.id);
        this.game.despawnNpc(n);
        const L = this.game.world.layouts.get(p.at);
        if (L && L.econ) ledger(L, this.game.day, `${p.name} broke out of the cells, but was brought down and locked up again.`);
      }
    }
    return true;
  }

  clearWorks(L) {
    const w = this.game.world;
    for (const q of L.walls) {
      if (!q.up) continue;
      const [x, y, z, id] = q.op;
      if (w.regionAt(x, z) && w.getBlock(x, y, z) === id) w.setBlock(x, y, z, B.air, 0);
    }
    L.walls = [];
  }

  // A warrior fell: who, and on which side (from the game's kill).
  onDeath(n, source) {
    const L = this.live;
    if (!L) return;
    if (L.kind === 'battle' && source && source.kind === 'player') {
      const s = n.warband && n.warband.side;
      if (s && L.sides[s]) L.sides[s].hates = true;
    }
  }

  // You struck a warrior: that side takes you for an enemy.
  onStruck(n) {
    const L = this.live;
    if (!L || !n.warband) return;
    if (L.kind === 'battle') {
      const s = n.warband.side;
      if (L.sides[s]) L.sides[s].hates = true;
      const d = L.plan && this.draftOf(L.plan);
      if (d && d.state === 'called' && s !== d.side) d.hits++;
    }
  }

  cause(n) {
    const L = this.live;
    if (n.warband && n.warband.kind === 'raid' && L && L.kind === 'raid') return `fell raiding ${L.TL.settlement.name}`;
    if (n.warband && n.warband.kind === 'battle' && L && L.plan) return `fell at ${L.plan.name}`;
    if (n.warband && n.warband.kind === 'escape') return 'killed escaping from the cells';
    if (n.warband && n.warband.kind === 'bandit') return 'killed, an outlaw';
    return 'fell in a skirmish';
  }

  // ------------------------------------------------------------ prisoners
  // Taken alive: off to the captor's capital (a free town keeps its own),
  // into a cell. False when there's nowhere to take them.
  takePrisoner(rec, L, by, day, how, at = null, keep = false) {
    if (!rec || !alive(rec) || rec.captive) return false;
    const cap = at !== null ? this.ow.settlements[at] : by ? this.realms.capitalOf(by) : null;
    if (!cap || deserted(cap)) return false;
    const p = {
      id: this.nextId++, sid: L.settlement.id, idx: rec.idx, civ: L.settlement.civ ? L.settlement.civ.id : null, by: by ? by.id : null,
      at: cap.id, day, how, name: fullName(rec),
    };
    this.prisoners.push(p);
    rec.captive = { id: p.id, by: p.by, at: cap.id, day };
    rec.away = true;
    delete rec.soldier;
    delete rec.raid;
    rec.hp = Math.max(4, rec.hp ?? 4);
    if (rec.ent && !rec.ent.dead && !keep) this.game.despawnNpc(rec.ent);
    this.makeRoom(cap, day);
    return p;
  }

  held(sid) {
    return this.prisoners.filter((p) => p.at === sid);
  }

  recOfPrisoner(p) {
    const L = this.sim.layoutOf(p.sid);
    return L ? L.npcs[p.idx] || null : null;
  }

  // Two to a cell: the town's own lock-up, and any stockade or prison.
  capacity(L) {
    if (!L) return 0;
    const built = (q) => L.buildings[q.building] && !L.buildings[q.building].underConstruction;
    return (L.jail ? 2 : 0) + L.prisonCells.filter(built).length * 2;
  }

  // Too many to hold: a stockade goes up (a prison, once the realm knows
  // how to build one).
  makeRoom(capS, day) {
    const L = this.sim.layoutOf(capS.id);
    if (!L || !L.econ) return null;
    if (this.held(capS.id).length <= this.capacity(L)) return null;
    const works = this.sim.works;
    if (works.projects.some((q) => !q.done && q.sid === capS.id && (q.type === 'stockade' || q.type === 'prison'))) return null;
    const big = this.sim.tech.has(capS, 'prisons') && !L.buildings.some((b) => b.type === 'prison');
    const type = big ? 'prison' : 'stockade';
    const cost = big ? 220 : 90;
    if (L.econ.treasury < cost + 20) return null;
    const q = works.startBuilding(L, type, ', to hold prisoners of war', false, cost) || breachFor(this.sim, L, type);
    if (q && q.kind === 'breach') {
      ledger(L, day, `The cells are full, and there's no room inside the walls: a stretch of the wall is coming down to build beyond it.`);
      return q;
    }
    if (q) {
      L.econ.treasury -= cost;
      ledger(L, day, big ? `The cells are full: work has begun on a great prison for ${capS.name}.` : `The cells are full: a stockade is going up to hold the prisoners.`);
    }
    return q;
  }

  release(p, how, day) {
    this.prisoners = this.prisoners.filter((q) => q !== p);
    const ent = this.captiveEnts.get(p.id);
    if (ent && !ent.dead && this.game.npcs.includes(ent)) this.game.despawnNpc(ent);
    this.captiveEnts.delete(p.id);
    const r = this.recOfPrisoner(p);
    if (!r || !alive(r)) return null;
    delete r.captive;
    r.away = false;
    const at = this.ow.settlements[p.at];
    const L = this.game.world.layouts.get(p.sid);
    const days = Math.max(1, day - p.day);
    const how2 = { exchanged: 'exchanged for prisoners of ours', ransomed: 'ransomed', released: 'set free', escaped: 'escaped', peace: 'freed at the peace', worked: 'set free, having worked off their captivity' }[how] || how;
    if (L && L.econ) ledger(L, day, `${p.name} is home after ${days} day${days > 1 ? 's' : ''} as a prisoner in ${at ? at.name : 'the enemy\'s cells'} (${how2}).`);
    return r;
  }

  // Each day: escapes (more when the cells are crowded, fewer from a real
  // prison), exchanges and ransoms between realms holding each other's
  // people, and, between realms not at war, prisoners let go.
  prisonersDay(day, rng) {
    for (const p of this.prisoners.slice()) {
      const r = this.recOfPrisoner(p);
      if (!r || !alive(r)) {
        this.prisoners = this.prisoners.filter((q) => q !== p);
        continue;
      }
      const at = this.ow.settlements[p.at];
      const L = at && this.sim.layoutOf(at.id);
      if (!L || !L.econ || deserted(at)) {
        this.release(p, 'escaped', day);
        continue;
      }
      if (this.captiveEnts.has(p.id)) continue; // (you're there: it happens on the ground)
      const crowded = this.held(at.id).length > this.capacity(L);
      const prison = L.buildings.some((b) => b.type === 'prison' && !b.underConstruction);
      const chance = (0.008 + (crowded ? 0.025 : 0) + ((r.personality?.bravery ?? 0.5) - 0.5) * 0.01) * (prison ? 0.3 : 1);
      if (rng.chance(chance)) {
        if (rng.chance(0.45)) {
          ledger(L, day, `${p.name} tried to break out of the cells, and was caught.`);
          continue;
        }
        ledger(L, day, `${p.name}, a prisoner, broke out of the cells and got away!`);
        this.release(p, 'escaped', day);
      }
    }
    if (day % 7 === 2) this.bargain(day, rng);
  }

  // Realms that hold each other's people swap them, one for one; one with
  // coin to spare buys its own back; and a captor at peace with them lets
  // them go after a while (sooner with a kind ruler).
  bargain(day, rng) {
    const C = this.ow.civs;
    const groups = new Map();
    for (const p of this.prisoners) {
      const k = `${p.by}>${p.civ}`;
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(p);
    }
    const done = new Set();
    for (const [k, mine] of groups) {
      const [by, of] = k.split('>');
      const back = groups.get(`${of}>${by}`);
      if (back && !done.has(k)) {
        done.add(k);
        done.add(`${of}>${by}`);
        const n = Math.min(mine.length, back.length);
        if (n && rng.chance(0.45)) {
          for (const p of [...mine.slice(0, n), ...back.slice(0, n)]) this.release(p, 'exchanged', day);
          const a = C[by];
          const b = C[of];
          if (a && b) for (const c of [a, b]) this.realms.proclaim(c, day, `The ${plain(a)} and the ${plain(b)} exchanged prisoners: ${n} for ${n}.`);
          continue;
        }
      }
      const captor = by === 'null' ? null : C[by];
      const home = of === 'null' ? null : C[of];
      // Ransom.
      const homeCap = home && this.realms.capitalOf(home);
      const HL = homeCap && this.game.world.layouts.get(homeCap.id);
      const ruler = home && this.realms.ruler(home);
      const price = 40;
      const fighting = captor && home && this.enemies(captor, home);
      if (HL && HL.econ && HL.econ.treasury > 160 + price && rng.chance((fighting ? 0.1 : 0.25) + (ruler?.personality?.kindness ?? 0.5) * (fighting ? 0.2 : 0.3))) {
        const n = Math.min(mine.length, 3, Math.floor((HL.econ.treasury - 160) / price));
        if (n > 0) {
          const at = this.ow.settlements[mine[0].at];
          const AL = at && this.game.world.layouts.get(at.id);
          HL.econ.treasury -= n * price;
          if (AL && AL.econ) AL.econ.treasury += n * price;
          for (const p of mine.slice(0, n)) this.release(p, 'ransomed', day);
          ledger(HL, day, `${authority(home)[0].toUpperCase()}${authority(home).slice(1)} paid ¤${n * price} to buy back ${n} of our people held ${captor ? `by the ${plain(captor)}` : `in ${at ? at.name : 'a free town'}`}.`);
          continue;
        }
      }
      // Let go, at peace, after a while.
      const atWar = captor && home && this.enemies(captor, home);
      if (!atWar) {
        const kind = captor ? (this.realms.ruler(captor)?.personality?.kindness ?? 0.5) : 0.5;
        for (const p of mine) if (day - p.day >= 10 && rng.chance(0.15 + kind * 0.35)) this.release(p, 'released', day);
      }
    }
  }

  // Peace: everyone held on either side goes home.
  freeAll(w, day) {
    const side = new Set([...w.a, ...w.b]);
    for (const p of this.prisoners.slice()) if (side.has(p.by) && side.has(p.civ)) this.release(p, 'peace', day);
    // (You too, if they have you.)
    const J = this.sim.justice;
    if (J.jail && J.jail.pow && side.has(J.jail.pow.by)) J.release('peace');
  }

  // When you're in a town holding prisoners: there they are, in the cells.
  syncCaptives() {
    const g = this.game;
    for (const [id, n] of this.captiveEnts) {
      const p = this.prisoners.find((q) => q.id === id);
      if (n.dead || !g.npcs.includes(n)) {
        this.captiveEnts.delete(id);
        // Got clean away while you watched.
        if (p && n.escaped) this.release(p, 'escaped', g.day);
        continue;
      }
      if (!p || !g.active.has(p.at)) {
        g.despawnNpc(n);
        this.captiveEnts.delete(id);
      }
    }
    for (const [sid, a] of g.active) {
      const list = this.held(sid);
      if (!list.length) continue;
      const L = a.layout;
      const slots = [];
      const jailFree = L.jail && !this.sim.justice.jailedIn(sid);
      if (jailFree) slots.push({ stand: L.jail.stand, bed: L.jail.bed, door: L.jail.door, front: L.jail.front }, { stand: L.jail.bed, bed: L.jail.bed, door: L.jail.door, front: L.jail.front });
      for (const c of L.prisonCells) {
        const b = L.buildings[c.building];
        if (!b || b.underConstruction) continue;
        slots.push({ stand: c.tiles[1], bed: c.tiles[0], door: c.door, front: c.front }, { stand: c.tiles[0], bed: c.tiles[0], door: c.door, front: c.front });
      }
      // (Only out of view, or as the town comes into being round you.)
      const fresh = a.since === undefined || this.sim.abs - a.since <= 2;
      list.forEach((p, i) => {
        if (this.captiveEnts.has(p.id) || i >= slots.length) return;
        const r = this.recOfPrisoner(p);
        const HL = this.game.world.layouts.get(p.sid);
        if (!r || !HL || (r.ent && !r.ent.dead)) return;
        const slot = slots[i];
        if (!fresh && g.inSight(slot.stand.x, slot.stand.z, 1)) return;
        // (The watch has the door fixed and locked again.)
        if (slot.door && g.world.getBlock(slot.door.x, GROUND, slot.door.z) === B.cell_door_open) g.world.setBlock(slot.door.x, GROUND, slot.door.z, B.cell_door, 0);
        // (On the cell floor: the one by the cot isn't to be found up on
        // the roof above it.)
        let y = g.world.findStandY(slot.stand.x, slot.stand.z, GROUND);
        if (y <= 0 || Math.abs(y - GROUND) > 1) y = GROUND;
        const n = g.spawnWarrior(r, HL, { x: slot.stand.x, y, z: slot.stand.z });
        n.state = 'captive';
        n.captive = { ...slot, p, y };
        n.look = { ...r.look, hat: null };
        this.captiveEnts.set(p.id, n);
      });
    }
  }

  // ------------------------------------------------------------ save
  serialize() {
    return {
      wars: this.wars, past: this.past, raids: this.raids, raidLog: this.raidLog, truces: this.truces, cd: this.cd,
      rebels: this.rebels, seen: this.seen, nextId: this.nextId, lastDay: this.lastDay, prisoners: this.prisoners, deserters: this.deserters,
    };
  }

  load(d) {
    if (!d) return;
    this.wars = d.wars || [];
    this.past = d.past || [];
    // (A raid or battle under way when you saved is reckoned up off-screen.)
    this.raids = (d.raids || []).map((r) => (r.state === 'strike' ? { ...r, state: 'march', live: false } : r));
    for (const w of this.wars) if (w.plan) w.plan.live = false;
    this.raidLog = d.raidLog || [];
    this.truces = d.truces || {};
    this.cd = d.cd || {};
    this.rebels = d.rebels || {};
    this.seen = d.seen || {};
    this.nextId = d.nextId || 1;
    this.lastDay = d.lastDay ?? this.lastDay;
    this.prisoners = d.prisoners || [];
    this.deserters = d.deserters || {};
  }
}

// A realm with the Storm Engine: for the first half-minute of a battle,
// lightning falls on the enemy's line every few seconds.
function stormEngine(war, L) {
  if (!L.go || L.done || L.t - (L.goT || 0) > 30) return;
  const g = war.game;
  const A = war.sim.ancient;
  if (!A) return;
  for (const [side, foe] of [['a', 'b'], ['b', 'a']]) {
    const civ = L.sides[side].civ;
    const s = civ && war.sim.realms.members(civ)[0];
    if (!s || !A.has(s, 'storm')) continue;
    L.stormT = L.stormT || {};
    L.stormT[side] = (L.stormT[side] ?? 1) - 0.25;
    if (L.stormT[side] > 0) continue;
    L.stormT[side] = 3;
    const targets = L.sides[foe].ents.filter((n) => !n.dead && !n.down && g.npcs.includes(n));
    if (!targets.length) continue;
    const t = targets[Math.floor(Math.random() * targets.length)];
    g.renderer.effect?.({ type: 'bolt', from: 'sky', wx: t.x, wy: t.y, wz: t.z, tx: t.x, ty: t.y, tz: t.z, life: 0.45, oy: -4 });
    g.renderer.emit(t.x, t.y + 0.5, t.z, { n: 14, color: ['#ffffff', '#c8fbff', '#5ad8f0'], up: 40, speed: 60, life: 0.4, glow: true });
    g.audio?.play('thunder', t);
    g.shake = Math.min(1, (g.shake || 0) + 0.3);
    g.dotHit = true;
    g.damage(t, 8, null);
    g.dotHit = false;
    for (const n of targets) if (n !== t && Math.abs(n.x - t.x) <= 1 && Math.abs(n.z - t.z) <= 1) n.stunT = Math.max(n.stunT || 0, 1.2);
  }
}

