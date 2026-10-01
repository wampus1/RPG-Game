// What a realm knows. Every realm (and every free town on its own) works
// its way down four branches of learning: Economy, Warfare, Law & Society
// and Engineering, five steps each, every step needing the one before. The
// ruler (a free town's mayor) chooses what the scholars study next, after
// their own leanings and the realm's troubles; researchers at an academy
// (scholars at the library, before there is one) do the work a little at a
// time, every day. What's learned changes how the realm lives: new trades
// and goods, guards better drilled and armed, laws it may pass, buildings
// that go up faster, roads laid quicker.
import { alive, ledger } from './econ.js';
import { retrain } from '../entities/npcgen.js';
import { RNG, hash4 } from '../util/rng.js';

export const BRANCHES = [
  { id: 'economy', name: 'Economy', color: '#e8c060' },
  { id: 'warfare', name: 'Warfare', color: '#e86a5a' },
  { id: 'society', name: 'Law & Society', color: '#8ab8e8' },
  { id: 'engineering', name: 'Engineering', color: '#9ad08a' },
];

// What each step costs, in study (a researcher at an academy puts in about
// 4 a day): the first steps take days, the last ones months.
const COST = [0, 80, 140, 220, 320, 450];

const T = (branch, tier, name, desc) => ({ branch, tier, name, desc, cost: COST[tier] });
export const TECHS = {
  // Economy
  bookkeeping: T('economy', 1, 'Bookkeeping', 'Ledgers and tallies: every town collects a tenth more in taxes.'),
  guilds: T('economy', 2, 'Guild Charters', 'Merchants band into guilds: master merchants set up shop, with gems and fine goods.'),
  gemcraft: T('economy', 3, 'Gemcraft', 'The cutting and setting of stones: jewellers may be licensed, and guards buy jewelled gear.'),
  caravan_law: T('economy', 4, 'Caravan Law', 'Protected roads: merchants travel a fifth faster and are harried far less abroad.'),
  banking: T('economy', 5, 'Banking', 'Treasuries earn a little interest every week.'),
  // Warfare
  drill: T('warfare', 1, 'Drilled Watch', 'Guards train together: tougher, and they hit harder.'),
  archery: T('warfare', 2, 'Archery', 'Guards carry bows, and shoot from range.'),
  cavalry: T('warfare', 3, 'Cavalry', 'Guards ride out to meet raiders, and armies field riders.'),
  fieldworks: T('warfare', 4, 'Field Fortifications', 'Soldiers throw up walls and stakes in battle; towns raise walls sooner.'),
  steel: T('warfare', 5, 'Steelworking', 'Smiths forge steel: steel swords for the watch, and for sale.'),
  // Law & Society
  codex: T('society', 1, 'Written Law', 'Laws written down: the realm may set how many of its people stand watch.'),
  alchemy: T('society', 2, 'Alchemy', 'Herbalists brew potions of vigour, might and swiftness.'),
  hospitality: T('society', 3, 'Hospitality', 'Proper beds: a night in one leaves you (and townsfolk too) hardier for the day.'),
  conscription: T('society', 4, 'Conscription', 'The realm may draft elders, and even the young, into the watch.'),
  schools: T('society', 5, 'Schools', 'Children learn their letters: all research goes a quarter faster.'),
  // Engineering
  masonry: T('engineering', 1, 'Masonry', 'Dressed stone: buildings and walls go up a quarter faster.'),
  wells: T('engineering', 2, 'Clean Wells', 'Lined wells and clean water: a drink from a town well leaves you hardier for the day.'),
  surveying: T('engineering', 3, 'Surveying', 'Roads laid out properly, and built half again as fast.'),
  mills: T('engineering', 4, 'Watermills', 'Mills grind the grain: fields yield more.'),
  fortress: T('engineering', 5, 'Fortification', 'Towers and gatehouses: walled towns hold far better against raids and sieges.'),
};

export const TECH_IDS = Object.keys(TECHS);
export const branchTechs = (b) => TECH_IDS.filter((k) => TECHS[k].branch === b).sort((x, y) => TECHS[x].tier - TECHS[y].tier);

// What a realm leans toward knowing first, by what it holds dear.
const LEAN = {
  martial: { warfare: 2 }, mercantile: { economy: 2 }, pious: { society: 1.5 }, scholarly: { society: 1, engineering: 1 },
  agrarian: { engineering: 1.5 }, seafaring: { economy: 1 }, artisan: { engineering: 1, economy: 0.5 },
};
// A first step some realms already have at the start.
const STARTS = { martial: 'drill', mercantile: 'bookkeeping', scholarly: 'codex', artisan: 'masonry', pious: 'codex' };

// Who can be spared for the academy.
const SPARE = { laborer: 1, farmer: 3, scholar: 1, merchant: 2, fisher: 3 };

export class Tech {
  constructor(game, sim) {
    this.game = game;
    this.sim = sim;
    this.state = {}; // key -> { done, current, progress, log }
    // (For testing: everything known everywhere.)
    this.cheat = false;
  }

  // A realm's key, or a free town's.
  keyOf(s) {
    if (!s) return null;
    if (s.civ) return `c${s.civ.id}`;
    if (s.people !== undefined || s.values !== undefined) return `c${s.id}`;
    return `s${s.id}`;
  }

  stateOf(s) {
    const k = this.keyOf(s);
    if (!k) return null;
    let st = this.state[k];
    if (!st) {
      st = this.state[k] = { done: [], current: null, progress: 0, log: [] };
      const civ = s.civ || (s.values ? s : null);
      for (const v of civ ? civ.values || [] : []) if (STARTS[v] && !st.done.includes(STARTS[v])) st.done.push(STARTS[v]);
    }
    return st;
  }

  has(s, id) {
    if (this.cheat) return true;
    const st = this.stateOf(s);
    return !!st && st.done.includes(id);
  }

  prereq(id) {
    const t = TECHS[id];
    return branchTechs(t.branch).find((k) => TECHS[k].tier === t.tier - 1) || null;
  }

  available(s) {
    const st = this.stateOf(s);
    if (!st) return [];
    return TECH_IDS.filter((k) => !st.done.includes(k) && (!this.prereq(k) || st.done.includes(this.prereq(k))));
  }

  // Who decides: the realm's ruler, or a free town's mayor.
  leaderOf(s) {
    if (s.civ) return this.sim.realms.ruler(s.civ);
    const L = this.sim.layoutOf(s.id);
    return L ? L.npcs.find((r) => r.job === 'mayor' && alive(r)) || null : null;
  }

  // The leader picks what to study next: their leanings, the realm's, and
  // what's troubling it (raids and war call for arms, an empty treasury for
  // trade, unrest for law).
  choose(s, day, rng) {
    const st = this.stateOf(s);
    const opts = this.available(s);
    if (!opts.length) {
      st.current = null;
      return null;
    }
    const civ = s.civ;
    const w = { economy: 1, warfare: 1, society: 1, engineering: 1 };
    for (const v of civ ? civ.values || [] : []) for (const [b, n] of Object.entries(LEAN[v] || {})) w[b] += n;
    const r = this.leaderOf(s);
    const p = (r && r.personality) || {};
    w.warfare += (p.bravery ?? 0.5) - 0.3 + (p.temper ?? 0.5) * 0.5;
    w.economy += (p.diligence ?? 0.5) * 0.5;
    w.society += (p.kindness ?? 0.5) * 0.8;
    const towns = civ ? this.sim.realms.memberLayouts(civ) : [this.sim.layoutOf(s.id)].filter(Boolean);
    const raids = towns.reduce((n, L) => n + (L.econ.recent.raids || 0) + (L.econ.recent.violence || 0), 0);
    w.warfare += Math.min(3, raids * 0.6) + (this.sim.war && civ && this.sim.war.atWar(civ) ? 4 : 0);
    if (towns.some((L) => L.econ.treasury < 60)) w.economy += 1.5;
    if (towns.some((L) => (L.econ.unrest || 0) > 1)) w.society += 1.5;
    // Cheaper steps first, mostly.
    const score = (k) => w[TECHS[k].branch] * (1.4 - TECHS[k].tier * 0.15) * (0.6 + rng.next() * 0.8);
    const pick = opts.reduce((m, k) => (score(k) > score(m) ? k : m));
    st.current = pick;
    st.progress = st.progress || 0;
    const who = r ? `${r.name.first} ${r.name.last}` : 'The council';
    this.announce(s, day, `${who} has set the scholars to study ${TECHS[pick].name.toLowerCase()}.`);
    return pick;
  }

  announce(s, day, text) {
    if (s.civ) this.sim.realms.proclaim(s.civ, day, text);
    else {
      const L = this.sim.layoutOf(s.id);
      if (L && L.econ) ledger(L, day, text);
    }
  }

  // A day's study (or an insight of yours) toward what's being learned.
  addPoints(s, n, day) {
    const st = this.stateOf(s);
    if (!st || n <= 0) return null;
    if (!st.current) this.choose(s, day, new RNG(hash4(day, s.id, 0x7ec)));
    if (!st.current) return null;
    st.progress += n * (this.has(s, 'schools') ? 1.25 : 1);
    const t = TECHS[st.current];
    if (st.progress >= t.cost) {
      st.progress -= t.cost;
      return this.learn(s, st.current, day);
    }
    return null;
  }

  learn(s, id, day) {
    const st = this.stateOf(s);
    if (!st || st.done.includes(id)) return null;
    st.done.push(id);
    st.log.push({ id, day });
    if (st.current === id) st.current = null;
    const t = TECHS[id];
    this.announce(s, day, `The scholars have mastered ${t.name.toLowerCase()}! ${t.desc}`);
    this.applyNow(s, id);
    if (this.game.currentSettlement && this.keyOf(this.game.currentSettlement) === this.keyOf(s)) this.game.ui.msg(`Your realm has learned ${t.name}.`, '#ffe070');
    return id;
  }

  // What changes the moment it's known.
  applyNow(s, id) {
    const towns = s.civ ? this.sim.realms.memberLayouts(s.civ) : [this.sim.layoutOf(s.id)].filter(Boolean);
    for (const L of towns) {
      for (const r of L.npcs) {
        if (!alive(r)) continue;
        if (r.job === 'guard') this.equipGuard(L, r);
        // Guild charters: the merchants with the means become masters.
        if (id === 'guilds' && r.job === 'merchant' && r.master && r.tier === 2) r.tier = 3;
      }
    }
  }

  // A guard's kit, by what the realm knows: drilled (tougher), a bow
  // (archery), a steel blade (steel).
  equipGuard(L, r) {
    const s = L.settlement;
    const eq = r.equipment;
    if (!eq) return;
    if (this.has(s, 'drill') && !r.drilled) {
      r.drilled = true;
      r.maxHp = (r.maxHp || 24) + 6;
      r.hp = Math.min(r.maxHp, (r.hp || 0) + 6);
    }
    eq.items ||= [];
    if (this.has(s, 'archery') && !eq.items.some((i) => i.item === 'bow')) {
      eq.items.push({ item: 'bow', count: 1 });
      (r.inv ||= []).push({ item: 'arrow', count: 12 });
    }
    if (this.has(s, 'steel') && eq.tool !== 'steel_sword') {
      eq.tool = 'steel_sword';
      eq.items = eq.items.filter((i) => i.item !== 'iron_sword' && i.item !== 'stone_sword');
      eq.items.push({ item: 'steel_sword', count: 1 });
    }
    if (r.ent && !r.ent.dead) {
      r.ent.maxHp = r.maxHp;
      r.ent.hp = Math.min(r.ent.maxHp, Math.max(r.ent.hp, r.hp || 0));
    }
  }

  // ------------------------------------------------------------ daily
  // Each town's share of the realm's study, an academy for it when it can
  // afford one, someone to work there, and a decision when the last piece
  // of work is done.
  daily(L, day, rng) {
    const s = L.settlement;
    if (s.deserted || s.condition === 'abandoned') return null;
    const st = this.stateOf(s);
    if (!st.current) this.choose(s, day, rng);
    const people = L.npcs.filter((r) => alive(r) && !r.away && !r.migrated && !r.visitor);
    const academy = L.buildings.find((b) => b.type === 'academy' && !b.underConstruction);
    const researchers = people.filter((r) => r.job === 'researcher');
    const scholars = people.filter((r) => r.job === 'scholar');
    let pts = researchers.length * (academy ? 4 : 2.5) + scholars.length * 1.5;
    // You, at the desk (see the research window): counted as you go.
    const out = { points: pts };
    // An academy for the capital first (and then the bigger towns).
    const capital = !s.civ || this.sim.realms.isCapital(s);
    if (!academy && s.type !== 'village' && (capital || s.type === 'city') && L.econ.treasury >= 260 && rng.chance(capital ? 0.3 : 0.12)
      && !L.buildings.some((b) => b.type === 'academy') && !this.sim.works.projects.some((p) => !p.done && p.sid === s.id && p.type === 'academy')) {
      const p = this.sim.works.startBuilding(L, 'academy', ', for the realm\'s scholars', false, 180);
      if (p) {
        L.econ.treasury -= 180;
        out.academy = p;
      }
    }
    // (Those who studied at the library move into the new academy.)
    if (academy) for (const r of researchers) if (!r.work || r.work.building !== academy.id) r.work = { kind: 'building', building: academy.id };
    // Someone to study there.
    const want = academy ? (s.type === 'city' ? 3 : 2) : 0;
    if (researchers.length < want) {
      const many = (job) => people.filter((q) => q.job === job && q.age === 'adult').length;
      const pick = people.find((r) => r.age === 'adult' && SPARE[r.job] && many(r.job) >= SPARE[r.job] && !r.ruler && !r.trip?.phase?.startsWith('away'));
      if (pick) {
        const was = pick.job;
        retrain(L, pick, 'researcher', new RNG(hash4(pick.idx, day, 0x5e)));
        if (pick.ent && !pick.ent.dead) {
          pick.ent.look = pick.look;
          pick.ent.activity = null;
        }
        ledger(L, day, `${pick.name.first} ${pick.name.last}, once a ${was}, took up study at the academy.`);
        out.hired = pick;
        pts += 2;
      }
    }
    if (pts) out.learned = this.addPoints(s, pts, day);
    // Weekly: a little interest on the treasury (banking).
    if (day % 7 === 0 && this.has(s, 'banking')) L.econ.treasury += Math.round(L.econ.treasury * 0.02);
    // A night in a proper bed: townsfolk wake hardier (hospitality).
    if (this.has(s, 'hospitality')) for (const r of people) if (r.home !== null && r.home !== undefined) r.blue = { day, hp: 2 };
    // Guards keep up with what the realm knows.
    for (const r of people) if (r.job === 'guard') this.equipGuard(L, r);
    return out;
  }

  // When a town changes hands (or a free state is born): it knows what its
  // new realm knows; a new realm starts with what its towns knew.
  inherit(toCiv, fromS) {
    const from = this.stateOf(fromS);
    const st = this.stateOf(toCiv);
    for (const k of from.done) if (!st.done.includes(k)) st.done.push(k);
  }

  // ------------------------------------------------------------ save
  serialize() {
    return { state: this.state };
  }

  load(d) {
    this.state = (d && d.state) || {};
  }
}

// How much a step of study is worth (for the window): done, total.
export function progressOf(tech, s) {
  const st = tech.stateOf(s);
  if (!st || !st.current) return null;
  return { id: st.current, done: Math.floor(st.progress), cost: TECHS[st.current].cost };
}
