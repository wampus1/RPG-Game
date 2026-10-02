// What a realm knows. Every realm (and every free town on its own) works
// its way out along four branches of learning: Economy, Warfare, Law &
// Society and Engineering, seven steps each: a root, two lines that split
// from it, and a last step that needs both. The
// ruler (a free town's mayor) chooses what the scholars study next, after
// their own leanings and the realm's troubles; researchers at an academy
// (scholars at the library, before there is one) do the work a little at a
// time, every day. What's learned changes how the realm lives: new trades
// and goods, guards better drilled and armed, laws it may pass, buildings
// that go up faster, roads laid quicker.
import { alive, ledger, stockOf } from './econ.js';
import { retrain } from '../entities/npcgen.js';
import { breachFor } from './growth.js';
import { RNG, hash4 } from '../util/rng.js';
import { ITEMS } from '../world/items.js';
import { B, META_STATE } from '../world/blocks.js';
import { M } from '../world/settlement.js';
import { GROUND, SURFACE } from '../config.js';

export const BRANCHES = [
  { id: 'economy', name: 'Economy', color: '#e8c060' },
  { id: 'warfare', name: 'Warfare', color: '#e86a5a' },
  { id: 'society', name: 'Law & Society', color: '#8ab8e8' },
  { id: 'engineering', name: 'Engineering', color: '#9ad08a' },
];

// What each step costs, in study (a researcher at an academy puts in about
// 4 a day): the first steps take days, the last ones months.
const COST = [0, 80, 140, 220, 320, 450];

// Each branch starts from one root and splits in two lines, which join
// again at the last step. `side` places a step to the left (-1) or right
// (1) of the branch's line on the tree; `req` lists what must be known
// first (all of it); `icon` is the item drawn for it.
// (`also`: needed too, from another branch; not drawn on the tree.)
const T = (branch, tier, side, req, icon, name, desc, lore, also = []) => ({ branch, tier, side, req, icon, name, desc, lore, also, cost: COST[tier] });
export const TECHS = {
  // Economy
  bookkeeping: T('economy', 1, 0, [], 'ledger', 'Bookkeeping', 'Every town collects a fifth more in taxes.', 'Ledgers and tallies: no coin goes uncounted.'),
  guilds: T('economy', 2, -1, ['bookkeeping'], 'coin', 'Guild Charters', 'Master merchants set up shop, with gems, gold and fine goods; in time the shops hang out guild awnings.', 'The great merchant houses band together under charter.'),
  markets: T('economy', 2, 1, ['bookkeeping'], 'apple', 'Market Days', 'Travelling merchants come to town nearly twice as often.', 'A day each week when the square fills with stalls from far and wide.'),
  gemcraft: T('economy', 3, -1, ['guilds'], 'gem', 'Gemcraft', 'Jewellers may be licensed, and guards buy jewelled gear.', 'The cutting and setting of stones.'),
  caravan_law: T('economy', 3, 1, ['markets'], 'lantern', 'Caravan Law', 'Merchants travel a fifth faster and are harried far less abroad.', 'Protected roads, and a law that answers for those who travel them.'),
  banking: T('economy', 4, -1, ['gemcraft'], 'gold_ingot', 'Banking', 'Treasuries earn interest every week (a twentieth, up to ¤120).', 'Coin that sits in the vault should work for its keep.'),
  trade_league: T('economy', 5, 0, ['banking', 'caravan_law'], 'scroll', 'Trade League', 'Trade warms relations half again as fast; tariffs rankle half as much.', 'Bound by contracts, not swords: every partner a friend.'),
  // Warfare
  drill: T('warfare', 1, 0, [], 'iron_sword', 'Drilled Watch', 'Guards train together: tougher, they hit harder, and in time they wear proper helms.', 'Up at dawn, shields locked, again and again.'),
  archery: T('warfare', 2, -1, ['drill'], 'bow', 'Archery', 'Guards carry bows and shoot from range; butts go up by the guardhouse.', 'Butts on the green, and every guard made to use them.'),
  muster: T('warfare', 2, 1, ['drill'], 'spear', 'Muster Rolls', 'Levies are half again as large: more of the realm marches to war.', 'Every able hand written down, and called when needed.'),
  cavalry: T('warfare', 3, -1, ['archery'], 'saddle', 'Cavalry', 'The watch rides out to meet raiders; armies field riders.', 'Horse and rider as one.'),
  fieldworks: T('warfare', 3, 1, ['muster'], 'iron_shovel', 'Field Fortifications', 'Log walls and stakes in battle; towns raise walls sooner.', 'Dig in, and let them come to you.'),
  steel: T('warfare', 4, 0, ['cavalry', 'fieldworks'], 'steel_sword', 'Steelworking', 'Steel swords for the watch, and for sale.', 'Iron, carbon and a hotter forge.', ['metalworking']),
  siegecraft: T('warfare', 5, 0, ['steel'], 'iron_pickaxe', 'Siegecraft', 'A won battle takes the town behind it far more often (capitals too).', 'Ladders, rams and sappers: no wall is the end of it.'),
  // Law & Society
  codex: T('society', 1, 0, [], 'book', 'Written Law', 'The realm may set how many of its people stand watch.', 'Laws written down, and the same for everyone.'),
  alchemy: T('society', 2, -1, ['codex'], 'potion_vigor', 'Alchemy', 'Herbalists brew potions of vigour, might and swiftness.', 'Stills and retorts, and patience.'),
  prisons: T('society', 2, 1, ['codex'], 'iron_bars', 'Prisons', 'A great prison for the capital: room for scores of captives, and far fewer escape.', 'Stone, iron, and gaolers who don\'t sleep.'),
  hospitality: T('society', 3, -1, ['alchemy'], 'bed', 'Hospitality', 'A night in a proper bed leaves you (and townsfolk too) hardier for the day.', 'Clean sheets, soft straw, a warm room.'),
  conscription: T('society', 3, 1, ['prisons'], 'iron_helmet', 'Conscription', 'The realm may draft elders, and even the young, into the watch.', 'In a hard war, everyone serves.'),
  schools: T('society', 4, -1, ['hospitality'], 'paper', 'Schools', 'Children learn their letters (you\'ll see them about with their books): all research goes 40% faster.', 'Slates and chalk in every town.'),
  embassies: T('society', 5, 0, ['schools', 'conscription'], 'dispatch', 'Embassies', 'Alliances come easier, and wars are declared only half as often.', 'An envoy at every court, talking before anyone draws steel.'),
  // Engineering
  masonry: T('engineering', 1, -1, [], 'stone_bricks', 'Masonry', 'Buildings and walls go up a third faster, and in time the town paves its square in stone.', 'Dressed stone, true corners.'),
  metalworking: T('engineering', 1, 1, [], 'anvil', 'Metalworking', 'Forges and blacksmiths; the watch carries iron instead of wood and stone.', 'Bellows, tongs and an anvil: ore becomes iron, iron becomes blades.'),
  wells: T('engineering', 2, -1, ['masonry'], 'water_bucket', 'Clean Wells', 'A drink from a town well heals more and leaves you hardier for the day.', 'Lined shafts and clean water.'),
  surveying: T('engineering', 2, 1, ['masonry'], 'iron_shovel', 'Surveying', 'Roads laid out properly and built half again as fast; in time the town\'s dirt lanes are gravelled and its streets cobbled.', 'Chains, stakes and a good eye.'),
  mills: T('engineering', 3, -1, ['wells'], 'wheat', 'Watermills', 'Mills grind the grain: fields yield half as much again, and hay is stacked by the barns.', 'The river does the work.'),
  cranes: T('engineering', 3, 1, ['surveying'], 'hammer', 'Cranes', 'Builders lift more: building goes nearly a third faster still.', 'Treadwheels and pulleys to raise the heavy stones.'),
  aqueducts: T('engineering', 4, -1, ['mills'], 'bucket', 'Aqueducts', 'Clean water piped in: many more children are born in every town.', 'Arches across the valley, water to every street.'),
  fortress: T('engineering', 5, 0, ['cranes', 'aqueducts'], 'cobblestone', 'Fortification', 'Towers and gatehouses: walled towns hold far better against raids and sieges.', 'Walls that do not fall.'),
};

export const TECH_IDS = Object.keys(TECHS);
export const branchTechs = (b) => TECH_IDS.filter((k) => TECHS[k].branch === b).sort((x, y) => TECHS[x].tier - TECHS[y].tier || TECHS[x].side - TECHS[y].side);

// What a realm leans toward knowing first, by what it holds dear.
const LEAN = {
  martial: { warfare: 2 }, mercantile: { economy: 2 }, pious: { society: 1.5 }, scholarly: { society: 1, engineering: 1 },
  agrarian: { engineering: 1.5 }, seafaring: { economy: 1 }, artisan: { engineering: 1, economy: 0.5 },
};
// A first step some realms already have at the start.
const STARTS = { martial: 'drill', mercantile: 'bookkeeping', scholarly: 'codex', artisan: 'masonry', pious: 'codex', agrarian: 'masonry', seafaring: 'bookkeeping' };
// What each people leans toward knowing (on top of what its realm holds
// dear): the highlanders build and forge, the northerners fight, the
// southerners trade, the forest peoples heal and keep the law of the
// tribe, the valley folk farm and build.
const CULTURE_LEAN = {
  high: { engineering: 1.5, warfare: 1 }, north: { warfare: 1.5, engineering: 0.5 }, sun: { economy: 1.5, society: 0.5 },
  wild: { society: 1.2, engineering: 0.5 }, vale: { engineering: 1, economy: 0.8 },
};
// Who has worked iron since before anyone remembers: highlanders and
// northerners, and any people that holds arms or craft dear. (Everyone
// else lights their first forge once they've learned how.)
const SMITHS = new Set(['martial', 'artisan', 'mercantile']);
const SMITH_STYLES = new Set(['high', 'north']);

// What can't be had without knowing something first.
export const GATES = {
  building: { smithy: 'metalworking', jeweler: 'gemcraft', academy: null },
  job: { blacksmith: 'metalworking', jeweller: 'gemcraft' },
};
// The watch's arms, with and without a forge to make them.
const PRIMITIVE = {
  iron_sword: 'stone_sword', steel_sword: 'stone_sword', gold_sword: 'stone_sword', iron_axe: 'stone_axe', spear: 'wooden_spear', mace: 'club', iron_shield: 'wooden_shield',
  short_sword: 'stone_sword', sabre: 'stone_sword', greatsword: 'stone_sword', hand_axe: 'stone_axe', battle_axe: 'stone_axe', halberd: 'wooden_spear', flail: 'club', warhammer: 'club', crossbow: 'bow',
};


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
      if (this.startsSmithing(s, civ)) st.done.push('metalworking');
      if (civ) this.startingPerks(civ, st);
    }
    return st;
  }

  // A realm starts out knowing a few things already: one to seven steps of
  // the tree (more for a big realm of cities, fewer for a handful of
  // villages), chosen mostly by its people and what it holds dear, and a
  // little by chance. Nothing past the middle of the tree.
  startingPerks(civ, st) {
    const ow = this.game.world && this.game.world.ow;
    if (!ow) return;
    const towns = ow.settlements.filter((q) => q.civ === civ && !q.deserted);
    const size = towns.reduce((n, q) => n + (q.type === 'city' ? 3 : q.type === 'town' ? 2 : 1), 0);
    const rng = new RNG(hash4(this.game.seed >>> 0, civ.id, 0x7ec5));
    const want = Math.max(1, Math.min(7, 1 + Math.round(size / 3) + rng.int(-1, 1)));
    const lean = {};
    for (const v of civ.values || []) for (const [b, n] of Object.entries(LEAN[v] || {})) lean[b] = (lean[b] || 0) + n;
    for (const [b, n] of Object.entries(CULTURE_LEAN[civ.style] || {})) lean[b] = (lean[b] || 0) + n;
    while (st.done.length < want) {
      const open = TECH_IDS.filter((k) => !st.done.includes(k) && TECHS[k].tier <= 3 && TECHS[k].req.every((r) => st.done.includes(r)) && TECHS[k].also.every((r) => st.done.includes(r)));
      if (!open.length) break;
      st.done.push(rng.weighted(open.map((k) => [k, (1 + (lean[TECHS[k].branch] || 0) * 1.5) / TECHS[k].tier])));
    }
    st.start = st.done.length;
  }

  // Born knowing how to work iron? (A free town: if it had a forge going
  // when it was founded.)
  startsSmithing(s, civ) {
    if (civ) return (civ.values || []).some((v) => SMITHS.has(v)) || SMITH_STYLES.has(civ.style);
    const L = this.game.world && this.game.world.layouts && this.game.world.layouts.get(s.id);
    if (L) return L.buildings.some((b) => b.type === 'smithy');
    return SMITH_STYLES.has(s.style) || s.type !== 'village';
  }

  // May this realm (or free town) have it yet?
  allows(s, kind, key) {
    const need = GATES[kind] && GATES[kind][key];
    return !need || this.has(s, need);
  }

  has(s, id) {
    if (this.cheat) return true;
    const st = this.stateOf(s);
    return !!st && st.done.includes(id);
  }

  // What must be known first.
  prereqs(id) {
    return TECHS[id] ? TECHS[id].req : [];
  }

  // (The first of them, for anything that only wants one.)
  prereq(id) {
    return this.prereqs(id)[0] || null;
  }

  ready(st, id) {
    return [...this.prereqs(id), ...(TECHS[id].also || [])].every((k) => st.done.includes(k));
  }

  available(s) {
    const st = this.stateOf(s);
    if (!st) return [];
    return TECH_IDS.filter((k) => !st.done.includes(k) && this.ready(st, k));
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
    // (What the ruler dreams of, if anything.)
    const amb = civ && this.sim.realms.ambition ? this.sim.realms.ambition(civ, day) : null;
    if (amb === 'merchant') w.economy += 1.5;
    else if (amb === 'warlord') w.warfare += 1.5;
    else if (amb === 'zealot') w.society += 1.5;
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
    st.progress += n * (this.has(s, 'schools') ? 1.4 : 1);
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

  // A weapon as this town's smiths can make it: wood and stone without a
  // forge, steel for a sword where they know steelworking.
  armFor(s, key) {
    if (!this.has(s, 'metalworking')) return PRIMITIVE[key] || key;
    if (key === 'iron_sword' && this.has(s, 'steel')) return 'steel_sword';
    return key;
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
    const metal = this.has(s, 'metalworking');
    const swap = (from, to) => {
      if (!from || !to || from === to) return;
      if (eq.tool === from) eq.tool = to;
      for (const i of eq.items) if (i.item === from) i.item = to;
      if (eq.shield === from) eq.shield = to;
    };
    // No bows in the watch till the realm has learned archery (a guard
    // who'd have carried one takes a spear instead).
    if (!this.has(s, 'archery') && eq.tool === 'bow') {
      swap('bow', metal ? 'spear' : 'wooden_spear');
      eq.items = eq.items.filter((i) => i.item !== 'arrow');
      if (r.inv) r.inv = r.inv.filter((i) => i && i.item !== 'arrow');
    }
    // Wood and stone without a forge; their iron back once there is one.
    if (!metal) {
      for (const [from, to] of Object.entries(PRIMITIVE)) {
        if (eq.tool !== from && eq.shield !== from && !eq.items.some((i) => i.item === from)) continue;
        swap(from, to);
        (r.unforged ||= {})[to] = from;
      }
    } else if (r.unforged) {
      for (const [to, from] of Object.entries(r.unforged)) swap(to, from === 'gold_sword' ? 'iron_sword' : from);
      delete r.unforged;
    }
    if (this.has(s, 'archery') && !eq.items.some((i) => i.item === 'bow')) {
      eq.items.push({ item: 'bow', count: 1 });
      (r.inv ||= []).push({ item: 'arrow', count: 12 });
    }
    // Steel for the swordsmen (an axe or a mace stays an axe or a mace).
    if (metal && this.has(s, 'steel') && (eq.tool === 'iron_sword' || eq.tool === 'stone_sword')) swap(eq.tool, 'steel_sword');
    if (r.look && r.look.gear && eq.shield && ITEMS[eq.shield] && ITEMS[eq.shield].block) r.look.gear.shield = ITEMS[eq.shield].look;
    if (r.ent && !r.ent.dead && r.look) r.ent.look = r.look;
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
    // Somewhere to study: the academy, or else the library or a study.
    const lab = academy || L.buildings.find((b) => (b.type === 'library' || b.type === 'study') && !b.underConstruction) || null;
    const researchers = people.filter((r) => r.job === 'researcher');
    const scholars = people.filter((r) => r.job === 'scholar');
    // (What the mayor has spent on the place: shelves, desks, lamps.)
    const fitted = 1 + 0.15 * (L.econ.labLevel || 0);
    // (A realm's study is led from its academies; a small town's study
    // adds a little to it. A free town's study is all it has.)
    const minor = s.civ && !academy && !this.sim.realms.isCapital(s) ? 0.35 : 1;
    let pts = (researchers.length * (academy ? 4 : lab ? 3 : 2.5) + scholars.length * 1.5) * fitted * minor;
    // You, at the desk (see the research window): counted as you go.
    const out = { points: pts };
    this.enforce(L, day);
    this.integrate(L, day);
    // Every town has a place to study, however small: a study, if it has
    // nothing better (so a free village can work things out too).
    const anyLab = L.buildings.some((b) => ['academy', 'library', 'study'].includes(b.type));
    if (!anyLab && !this.sim.works.projects.some((p) => !p.done && p.sid === s.id && (p.type === 'study' || p.type === 'academy'))
      && !(L.econ.buildQueue || []).some((o) => o.kind === 'build' && o.type === 'study')) {
      const p = this.sim.works.startBuilding(L, 'study', ', so the town can learn', false, 40);
      if (p) {
        L.econ.treasury = Math.max(0, L.econ.treasury - 40);
        out.study = p;
      }
    }
    // The mayor spends on it now and then: more shelves and desks, better
    // lamps, and at last a whole new wing (coin, and timber and stone from
    // the town's stock). Each makes the study go a little faster.
    const lvl = L.econ.labLevel || 0;
    const mayor = L.npcs.find((r) => r.job === 'mayor' && alive(r));
    if (lab && mayor && lvl < 3 && (day + s.id) % 4 === 0) {
      const cost = [70, 140, 240][lvl];
      const [wood, stone] = [[10, 4], [16, 10], [24, 18]][lvl];
      const k = stockOf(L);
      if (L.econ.treasury >= cost + 60 && k.wood >= wood && k.stone >= stone && rng.chance(0.5)) {
        L.econ.treasury -= cost;
        k.wood -= wood;
        k.stone -= stone;
        L.econ.labLevel = lvl + 1;
        const what = ['new shelves and a second desk', 'a reading room and good lamps', 'a whole new wing of books and instruments'][lvl];
        ledger(L, day, `Mayor ${mayor.name.first} ${mayor.name.last} has paid ¤${cost}, and timber and stone, for ${what} at the ${lab.name.replace(/^The /, '')}. The scholars work faster for it.`);
        out.upgraded = L.econ.labLevel;
        this.fitLab(L, lab, L.econ.labLevel);
      }
    }
    // An academy for the capital first (and then the bigger towns).
    const capital = !s.civ || this.sim.realms.isCapital(s);
    if (!academy && s.type !== 'village' && (capital || s.type === 'city') && L.econ.treasury >= 260 && rng.chance(capital ? 0.3 : 0.12)
      && !L.buildings.some((b) => b.type === 'academy') && !this.sim.works.projects.some((p) => !p.done && p.sid === s.id && p.type === 'academy')) {
      const p = this.sim.works.startBuilding(L, 'academy', ', for the realm\'s scholars', false, 180);
      // (No room inside the walls: out through them first.)
      if (!p) breachFor(this.sim, L, 'academy');
      if (p) {
        L.econ.treasury -= 180;
        out.academy = p;
      }
    }
    // (Those who studied at the library move into the new academy; till
    // there's anywhere, they work at a table in the town hall.)
    const desk = lab || L.buildings.find((b) => b.type === 'townhall' && !b.underConstruction) || null;
    if (desk) for (const r of researchers) if (!r.work || r.work.building !== desk.id) r.work = { kind: 'building', building: desk.id };
    // Someone to study there (always at least one).
    const want = academy ? (s.type === 'city' ? 3 : 2) : 1;
    if (researchers.length < want) {
      const many = (job) => people.filter((q) => q.job === job && q.age === 'adult').length;
      const pick = people.find((r) => r.age === 'adult' && SPARE[r.job] && many(r.job) >= SPARE[r.job] && !r.ruler && !r.trip?.phase?.startsWith('away'))
        // (A small place spares whoever it can.)
        || (!researchers.length ? people.find((r) => r.age === 'adult' && ['laborer', 'beggar', 'farmer', 'fisher', 'scholar', 'merchant'].includes(r.job) && !r.ruler && r.job !== 'mayor' && !r.trip?.phase?.startsWith('away')) : null);
      if (pick) {
        const was = pick.job;
        retrain(L, pick, 'researcher', new RNG(hash4(pick.idx, day, 0x5e)));
        if (pick.ent && !pick.ent.dead) {
          pick.ent.look = pick.look;
          pick.ent.activity = null;
        }
        if (desk) pick.work = { kind: 'building', building: desk.id };
        ledger(L, day, `${pick.name.first} ${pick.name.last}, once a ${was}, took up study at the ${(desk ? desk.name : 'academy').replace(/^The /, '').toLowerCase()}.`);
        out.hired = pick;
        pts += 2;
      }
    }
    if (pts) out.learned = this.addPoints(s, pts, day);
    // Weekly: a little interest on the treasury (banking).
    if (day % 7 === 0 && this.has(s, 'banking')) L.econ.treasury += Math.min(120, Math.round(L.econ.treasury * 0.05));
    // A night in a proper bed: townsfolk wake hardier (hospitality).
    if (this.has(s, 'hospitality')) for (const r of people) if (r.home !== null && r.home !== undefined) r.blue = { day, hp: 2 };
    // Guards keep up with what the realm knows.
    for (const r of people) if (r.job === 'guard') this.equipGuard(L, r);
    return out;
  }

  // ------------------------------------------------------------ in practice
  // A town keeps to what its realm knows: no forge lit without
  // metalworking (its smith works as a labourer till the realm learns it,
  // and lights it again then), and the watch armed with what it has.
  enforce(L, day) {
    const s = L.settlement;
    if (!L.econ || s.deserted || s.condition === 'abandoned') return;
    const people = L.npcs.filter((r) => alive(r) && !r.migrated && !r.visitor);
    const metal = this.has(s, 'metalworking');
    const forge = L.buildings.find((b) => b.type === 'smithy' && !b.underConstruction);
    if (!metal) {
      for (const r of people) {
        if (r.job !== 'blacksmith' || r.ruler !== undefined) continue;
        retrain(L, r, 'laborer', new RNG(hash4(r.idx, day, 0xf0a9)));
        r.coldForge = true;
        if (r.ent && !r.ent.dead) {
          r.ent.look = r.look;
          r.ent.activity = null;
        }
        if (day > 0) ledger(L, day, `${r.name.first} ${r.name.last} can't get a forge to work without the know-how, and labours for a living instead.`);
      }
      if (forge && !forge.cold) forge.cold = true;
    } else if (forge) {
      // The forge is lit again (by the smith who waited, if they're still here).
      forge.cold = false;
      if (!people.some((r) => r.job === 'blacksmith')) {
        const r = people.find((q) => q.coldForge && q.age === 'adult') || null;
        if (r) {
          retrain(L, r, 'blacksmith', new RNG(hash4(r.idx, day, 0xf0aa)));
          r.coldForge = false;
          r.work = { kind: 'building', building: forge.id };
          if (r.ent && !r.ent.dead) {
            r.ent.look = r.look;
            r.ent.activity = null;
          }
          ledger(L, day, `The forge at the ${forge.name.replace(/^The /, '')} is lit at last: ${r.name.first} ${r.name.last} is back at the anvil.`);
        }
      }
    }
    for (const r of people) if (r.job === 'guard') this.equipGuard(L, r);
  }

  // How long something new takes to become part of everyday life in a
  // town (the capital first; the further steps take longer).
  settledIn(s, id, day) {
    const st = this.stateOf(s);
    if (!st || !st.done.includes(id)) return false;
    const e = st.log.find((q) => q.id === id);
    if (!e) return true;
    const capital = !s.civ || this.sim.realms.isCapital(s);
    return day - e.day >= 2 + TECHS[id].tier * 2 + (capital ? 0 : 3);
  }

  // What you can see of it, once it's settled in (once, in each town, and
  // only while you're there to see it go up; otherwise when you next come).
  integrate(L, day, arriving = false) {
    const s = L.settlement;
    const e = L.econ;
    if (!e || s.deserted || s.condition === 'abandoned') return;
    e.shown ||= [];
    const active = this.game.active.has(s.id);
    for (const id of Object.keys(LOOKS)) {
      if (e.shown.includes(id) || !this.settledIn(s, id, day)) continue;
      // (Things on people happen anywhere; things built need you there.)
      if (LOOKS[id].built && !active) continue;
      const done = LOOKS[id].apply(this, L, day);
      if (done === false) continue;
      e.shown.push(id);
      if (!arriving && LOOKS[id].news) ledger(L, day, LOOKS[id].news(s));
    }
  }

  // A better-fitted study: another shelf, a lamp, a desk.
  fitLab(L, lab, level) {
    if (!this.game.active.has(L.settlement.id) || lab.x0 === undefined) return;
    const w = this.game.world;
    const block = [B.bookshelf, B.lantern, B.bookshelf][level - 1] ?? B.bookshelf;
    for (let z = lab.z0 + 1; z < lab.z1; z++) {
      for (let x = lab.x0 + 1; x < lab.x1; x++) {
        if (!w.regionAt(x, z) || w.getBlock(x, GROUND, z) !== B.air) continue;
        // (Against a wall, and out of the way of the door.)
        const wall = x === lab.x0 + 1 || x === lab.x1 - 1 || z === lab.z0 + 1 || z === lab.z1 - 1;
        if (!wall || Math.abs(x - lab.door.x) + Math.abs(z - lab.door.z) <= 2) continue;
        if (block === B.lantern) this.sim.setBlocks([[x, GROUND, z, B.table, 0], [x, GROUND + 1, z, B.lantern, META_STATE]]);
        else this.sim.setBlocks([[x, GROUND, z, block, 0]]);
        return;
      }
    }
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

// What a town looks like once something new has settled in.
const tilesWhere = (L, pred) => {
  const out = [];
  const b = L.bounds;
  for (let z = b.z0; z <= b.z1; z++) for (let x = b.x0; x <= b.x1; x++) if (pred(L.maskAt(x, z), x, z)) out.push([x, z]);
  return out;
};
const LOOKS = {
  // Masonry: the square paved in dressed stone.
  masonry: {
    built: true,
    apply(T, L) {
      const w = T.game.world;
      const P = L.plaza;
      const was = L.mats && L.mats.plaza;
      if (!P || !was || was === B.stone_bricks) return;
      const ops = [];
      // (Under the benches and the well too, so it's all of a piece.)
      for (const [x, z] of tilesWhere(L, (m, x, z) => (m === M.PLAZA || m === M.DECOR) && x >= P.x0 && x <= P.x1 && z >= P.z0 && z <= P.z1)) {
        if (w.regionAt(x, z) && w.getBlock(x, SURFACE, z) === was) ops.push([x, SURFACE, z, B.stone_bricks, 0]);
      }
      if (ops.length) T.sim.setBlocks(ops);
    },
    news: (s) => `The masons of ${s.name} have paved the square in dressed stone.`,
  },
  // Surveying: dirt lanes gravelled, gravel streets cobbled.
  surveying: {
    built: true,
    apply(T, L) {
      const w = T.game.world;
      const ops = [];
      for (const [x, z] of tilesWhere(L, (m) => m === M.ROAD)) {
        const id = w.regionAt(x, z) ? w.getBlock(x, SURFACE, z) : null;
        if (id === B.path) ops.push([x, SURFACE, z, B.gravel, 0]);
        else if (id === B.gravel) ops.push([x, SURFACE, z, B.cobblestone, 0]);
      }
      if (ops.length) T.sim.setBlocks(ops);
    },
    news: (s) => `New surveyors' roads in ${s.name}: the old lanes are gravelled now, the streets cobbled.`,
  },
  // Drill: proper helms on the watch.
  drill: {
    apply(T, L) {
      for (const r of L.npcs) {
        if (r.job !== 'guard' || !alive(r) || !r.look) continue;
        r.look.hat = 'helmet';
        if (r.ent && !r.ent.dead) r.ent.look = r.look;
      }
    },
  },
  // Archery: butts by the guardhouse.
  archery: {
    built: true,
    apply(T, L) {
      const gh = L.buildings.find((b) => b.type === 'guardhouse' && b.outside) || L.buildings.find((b) => b.type === 'townhall' && b.outside);
      if (!gh) return;
      const rng = new RNG(hash4(L.settlement.seed >>> 0, 0xa7c4));
      const ops = [];
      for (let i = 0; i < 2; i++) {
        const at = L.findFreeNear(gh.outside.x, gh.outside.z, 6, rng);
        if (!at) break;
        ops.push([at.x, GROUND, at.z, i ? B.hay_bale : B.training_dummy, 0]);
        L.setMask(at.x, at.z, M.DECOR);
      }
      if (ops.length) T.sim.setBlocks(ops);
    },
    news: (s) => `Archery butts have gone up by the guardhouse in ${s.name}; the watch practise every morning.`,
  },
  // Watermills: hay stacked by the barns.
  mills: {
    built: true,
    apply(T, L) {
      const barn = L.buildings.find((b) => b.type === 'barn' && b.outside);
      const f = L.fields && L.fields[0];
      const at0 = barn ? barn.outside : f ? { x: f.x0 - 1, z: f.z0 } : null;
      if (!at0) return;
      const rng = new RNG(hash4(L.settlement.seed >>> 0, 0x3111));
      const ops = [];
      for (let i = 0; i < 3; i++) {
        const at = L.findFreeNear(at0.x, at0.z, 5, rng);
        if (!at) break;
        ops.push([at.x, GROUND, at.z, B.hay_bale, 0]);
        L.setMask(at.x, at.z, M.DECOR);
      }
      if (ops.length) T.sim.setBlocks(ops);
    },
    news: (s) => `The mill keeps up with the harvest now in ${s.name}: hay stacked high by the barns.`,
  },
  // Schools: children about with their books.
  schools: {
    apply(T, L) {
      for (const r of L.npcs) {
        if (r.age !== 'child' || !alive(r) || !r.equipment) continue;
        if (hash4(r.idx, 0x5c400) % 2) continue;
        r.equipment.tool = 'book';
        if (!r.equipment.items.some((i) => i.item === 'book')) r.equipment.items.push({ item: 'book', count: 1 });
      }
    },
    news: (s) => `There's a schoolroom in ${s.name} now; the children go about with their books.`,
  },
  // Guild charters: guild awnings over the shop doors.
  guilds: {
    built: true,
    apply(T, L) {
      const DX = [0, -1, 0, 1];
      const DZ = [1, 0, -1, 0];
      const cloth = [B.awning_red, B.awning_blue, B.awning_yellow, B.awning_green][hash4(L.settlement.civ ? L.settlement.civ.id : L.settlement.id, 0x9e1d) % 4];
      const ops = [];
      for (const b of L.buildings) {
        if (!['shop', 'tailor', 'bakery', 'smithy', 'herbalist'].includes(b.type) || !b.outside || b.underConstruction) continue;
        const rot = b.door.rot;
        const px = DZ[rot] !== 0 ? 1 : 0;
        const pz = DX[rot] !== 0 ? 1 : 0;
        for (const sg of [1, -1]) {
          const x = b.outside.x + px * sg;
          const z = b.outside.z + pz * sg;
          if (L.maskAt(x, z) === M.BUILD || L.maskAt(x, z) === M.WALL) continue;
          const w = T.game.world;
          if (!w.regionAt(x, z) || w.getBlock(x, GROUND + 2, z) !== B.air) continue;
          ops.push([x, GROUND + 2, z, cloth, 0]);
        }
      }
      if (ops.length) T.sim.setBlocks(ops);
    },
    news: (s) => `The shops of ${s.name} hang out their guild colours.`,
  },
};

// How much a step of study is worth (for the window): done, total.
export function progressOf(tech, s) {
  const st = tech.stateOf(s);
  if (!st || !st.current) return null;
  return { id: st.current, done: Math.floor(st.progress), cost: TECHS[st.current].cost };
}
