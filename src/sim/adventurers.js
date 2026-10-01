// Adventurers: people who live on the road, going from realm to realm. In
// each place they stop a day or two in a tent outside town: they sell what
// they found on the road (hides, bone, ore, a gem now and then), buy food,
// salves and better gear, and leave their mark: tales at the tavern, a
// bout with the watch, beasts hunted down, bread for the hungry. They come
// armed and armoured far beyond any townsfolk, the renowned ones in
// jewelled gear, and they're hard to beat in a fight: see npc.js and
// game.js for how they dodge, turn arrows aside and use their stones.
import { alive, ledger, DAY, st, price, kitchenOf, invCount, glutFactor, MEAL_ITEMS, setOverride } from './econ.js';
import { deserted } from './civic.js';
import { makeAdventurer } from '../entities/npcgen.js';
import { ITEMS } from '../world/items.js';
import { RNG, hash4, clamp } from '../util/rng.js';
import { CULTURES } from '../world/names.js';

// A day for an adventurer in town (minutes after midnight).
export const ADV_DAY = [
  { s: 0, e: 420, act: 'adventure', place: 'camp' },
  { s: 420, e: 600, act: 'adventure', place: 'market' },
  { s: 600, e: 780, act: 'adventure', place: 'patrol' },
  { s: 780, e: 840, act: 'adventure', place: 'tavern' },
  { s: 840, e: 1020, act: 'adventure', place: 'train' },
  { s: 1020, e: 1260, act: 'adventure', place: 'tavern' },
  { s: 1260, e: 1440, act: 'adventure', place: 'camp' },
];

// What they bring back from the road to sell.
const LOOT = [['leather', 1, 4], ['bone', 1, 5], ['feather', 2, 6], ['raw_meat', 1, 3], ['iron_ore', 1, 3], ['gold_ore', 1, 2], ['gem', 1, 1], ['slime_gel', 1, 3], ['string', 1, 3]];
const ROSTER = 6;

const ARMOR = (wear) => Math.min(0.55, Object.values(wear || {}).reduce((n, k) => n + ((ITEMS[k] && ITEMS[k].armor) || 0), 0));

export class Adventurers {
  constructor(game, sim) {
    this.game = game;
    this.sim = sim;
    this.list = [];
    this.next = 1;
    this.ents = new Map(); // id -> NPC entity in a town you're in
    this.started = false;
  }

  get(id) {
    return this.list.find((a) => a.id === id) || null;
  }

  // Where adventurers go: anywhere lived in.
  places() {
    return this.game.world.ow.settlements.filter((s) => !deserted(s) && s.condition !== 'abandoned');
  }

  create(rng, at = null) {
    const civs = this.game.world.ow.civs || [];
    const home = civs.length && rng.chance(0.8) ? rng.pick(civs) : null;
    const style = home ? home.style : rng.pick(Object.keys(CULTURES));
    const level = rng.chance(0.2) ? 3 : rng.chance(0.45) ? 2 : 1;
    const base = makeAdventurer(rng, style, level);
    const a = {
      id: this.next++, level, home: home ? home.id : null, ...base,
      hp: base.maxHp, coins: 40 + level * 40 + rng.int(0, 40), arrows: base.gear.bow ? 16 : 0,
      pack: {}, at: null, dest: at, from: null, arrive: 0, leave: 0, state: 'road', seen: [], deeds: 0, dead: false,
      deedDay: null, stays: 0,
    };
    for (let i = 0; i < 3; i++) {
      const [k, lo, hi] = rng.pick(LOOT);
      if (ITEMS[k]) st.add(a.pack, k, rng.int(lo, hi));
    }
    // The renowned carry a spare jewelled piece or two to sell.
    if (level === 3) st.add(a.pack, rng.pick(['iron_helmet', 'chainmail', 'iron_sword']) + '+' + rng.pick(['ruby', 'sapphire', 'emerald', 'topaz', 'amethyst']), 1);
    return a;
  }

  // The world's first adventurers: some already in a town, some on the road.
  start() {
    if (this.started) return;
    this.started = true;
    if (this.list.length) return;
    const rng = new RNG(hash4(this.game.seed, 0xad7e));
    const places = this.places();
    if (!places.length) return;
    const now = this.sim.abs;
    for (let i = 0; i < ROSTER; i++) {
      const a = this.create(rng);
      const s = places[rng.int(0, places.length - 1)];
      a.dest = s.id;
      if (i % 2 === 0) {
        a.state = 'road';
        a.arrive = now + rng.int(2, 30) * 60;
      } else {
        a.state = 'road';
        a.arrive = now - rng.int(1, 12) * 60;
      }
      this.list.push(a);
    }
  }

  // Where to next: somewhere else, most often in another realm, and
  // somewhere they haven't been lately.
  nextStop(a, rng) {
    const ow = this.game.world.ow;
    const here = ow.settlements[a.at ?? a.dest];
    const cands = this.places().filter((s) => s !== here && Math.hypot(s.cx - here.cx, s.cz - here.cz) < 20);
    if (!cands.length) return this.places().find((s) => s !== here) || here;
    const score = (s) => (s.civ !== here.civ ? 3 : 0) + (a.seen.includes(s.id) ? -4 : 0) - Math.hypot(s.cx - here.cx, s.cz - here.cz) * 0.15 + rng.float(0, 3);
    return cands.reduce((m, s) => (score(s) > score(m) ? s : m));
  }

  update() {
    this.start();
    const now = this.sim.abs;
    const day = Math.floor(now / DAY);
    for (const a of this.list) {
      if (a.dead) continue;
      const rng = new RNG(hash4(a.id, Math.floor(now / 60), 0xa1));
      if (a.state === 'road' && now >= a.arrive) this.arriveAt(a, a.dest, rng);
      else if (a.state === 'stay') {
        const L = this.sim.layoutOf(a.at);
        if (!L || deserted(L.settlement)) {
          this.depart(a, rng);
          continue;
        }
        // Something to be remembered by, once a day while they stay.
        const hod = Math.floor((now % DAY) / 60);
        if (a.deedDay !== day && hod >= 12) {
          a.deedDay = day;
          this.deed(a, L, day, rng);
        }
        if (now >= a.leave) this.depart(a, rng);
        // Rest mends.
        a.hp = Math.min(a.maxHp, a.hp + 0.02);
      }
    }
    // Fallen adventurers are replaced, in time, by new ones.
    const live = this.list.filter((a) => !a.dead);
    if (live.length < ROSTER && (day + this.list.length) % 5 === 0 && this.lastNew !== day) {
      this.lastNew = day;
      const rng = new RNG(hash4(this.game.seed, day, 0xad7f));
      const places = this.places();
      if (places.length) {
        const a = this.create(rng, places[rng.int(0, places.length - 1)].id);
        a.arrive = now + rng.int(4, 20) * 60;
        this.list.push(a);
      }
    }
    if (this.list.length > 20) this.list = this.list.filter((a) => !a.dead || day - (a.diedDay || 0) < 10);
    this.syncEnts();
  }

  // Into town: a tent outside, their business done, the town told.
  arriveAt(a, sid, rng) {
    const ow = this.game.world.ow;
    const s = ow.settlements[sid];
    if (!s || deserted(s) || s.condition === 'abandoned') {
      a.at = a.dest;
      this.depart(a, rng);
      return;
    }
    const L = this.sim.layoutOf(sid);
    a.state = 'stay';
    a.at = sid;
    a.from = a.from ?? null;
    a.stays++;
    a.seen = [...a.seen.filter((q) => q !== sid), sid].slice(-5);
    const now = this.sim.abs;
    a.leave = Math.max(now, a.arrive) + rng.int(22, 44) * 60;
    this.sim.camps.pitch(L, `a:${a.id}`, 'adventurer', 1, a.leave + 30, hash4(a.id, sid, 0xca));
    const home = a.home !== null ? ow.civs[a.home] : null;
    ledger(L, Math.floor(now / DAY), `${this.title(a)} ${a.name.first} ${a.name.last}${home ? ` of the ${home.name.replace(/^The /, '')}` : ''} has pitched a tent outside town.`);
    this.trade(a, L, rng);
  }

  depart(a, rng) {
    this.sim.camps.strike(`a:${a.id}`);
    a.guard = null;
    const next = this.nextStop(a, rng);
    const ow = this.game.world.ow;
    const here = ow.settlements[a.at ?? a.dest];
    a.from = here ? here.id : null;
    a.state = 'road';
    a.dest = next.id;
    a.departAt = this.sim.abs;
    const hours = here ? this.sim.diplomacy.travelHours(here, next) : 12;
    a.arrive = this.sim.abs + Math.max(4, hours) * 60;
    a.at = null;
    // The road: finds and fights, and now and then worse.
    for (let i = 0, n = rng.int(1, 3); i < n; i++) {
      const [k, lo, hi] = rng.pick(LOOT);
      if (ITEMS[k]) st.add(a.pack, k, rng.int(lo, hi));
    }
    a.coins += rng.int(5, 15 + a.level * 15);
    if (rng.chance(0.25)) a.hp = Math.max(4, a.hp - rng.int(4, 12));
    if (a.gear.bow) a.arrows = Math.max(a.arrows, 10);
    if (here && rng.chance(0.012 / a.level)) {
      a.dead = true;
      a.diedDay = Math.floor(this.sim.abs / DAY);
      const L = this.game.world.layouts.get(next.id);
      if (L && L.econ) ledger(L, a.diedDay, `Word came that ${this.title(a).toLowerCase()} ${a.name.first} ${a.name.last} fell on the road from ${here.name}.`);
    }
  }

  title(a) {
    return { 1: 'The adventurer', 2: 'The seasoned adventurer', 3: 'The renowned adventurer' }[a.level] || 'The adventurer';
  }

  // Market business: sell what the road gave them, buy what the road needs.
  trade(a, L, rng) {
    const e = L.econ;
    const bizOf = (type) => {
      const b = L.buildings.find((q) => q.type === type && e.biz[q.id]);
      return b ? e.biz[b.id] : null;
    };
    const buyerFor = (k) => {
      if (['gem', 'gold_ore', 'iron_ore', 'coal', 'iron_ingot', 'gold_ingot'].includes(k)) return [bizOf('smithy'), 'smith'];
      if (['raw_meat', 'fish'].includes(k)) return [kitchenOf(L), 'cook'];
      if (['leather', 'string', 'feather'].includes(k)) return [bizOf('tailor') || bizOf('shop'), bizOf('tailor') ? 'tailor' : 'general'];
      if (k === 'slime_gel') return [bizOf('herbalist') || bizOf('shop'), bizOf('herbalist') ? 'herbalist' : 'general'];
      return [bizOf('shop'), 'general'];
    };
    let sold = 0;
    for (const [k, n] of Object.entries(a.pack)) {
      if (ITEMS[k] && ITEMS[k].socket) continue; // (their finest pieces are for the right buyer)
      const [b, kind] = buyerFor(k);
      if (!b) continue;
      for (let i = 0; i < n; i++) {
        const f = glutFactor(kind, k, st.count(b.store, k));
        const pr = Math.floor(price(k) * 0.55 * f);
        if (pr <= 0 || b.till < pr + 5) break;
        b.till -= pr;
        st.add(b.store, k, 1);
        st.take(a.pack, k, 1);
        a.coins += pr;
        sold += pr;
      }
    }
    let spent = 0;
    const buy = (b, k, n) => {
      for (let i = 0; i < n; i++) {
        const pr = Math.round(price(k) * 1.1);
        if (!b || !st.count(b.store, k) || a.coins < pr + 10) return;
        st.take(b.store, k, 1);
        b.till += pr;
        a.coins -= pr;
        spent += pr;
        if (k === 'arrow') a.arrows++;
        else st.add(a.pack, k, 1);
      }
    };
    const k = kitchenOf(L);
    if (k) for (const m of MEAL_ITEMS) buy(k, m, 1);
    buy(bizOf('herbalist'), 'healing_salve', 2);
    if (a.gear.bow && a.arrows < 20) buy(bizOf('shop') || bizOf('smithy'), 'arrow', 20 - a.arrows);
    // A better piece of armour from the smithy, if they can afford it.
    const sm = bizOf('smithy');
    if (sm) {
      for (const key of Object.keys(sm.store)) {
        const it = ITEMS[key];
        if (!it || it.kind !== 'armor' || !st.count(sm.store, key)) continue;
        const cur = a.gear.wear[it.slot];
        if ((cur && ITEMS[cur] && ITEMS[cur].armor >= it.armor) || a.coins < price(key) * 1.2 + 20) continue;
        const pr = Math.round(price(key) * 1.1);
        st.take(sm.store, key, 1);
        sm.till += pr;
        a.coins -= pr;
        spent += pr;
        if (cur) st.add(a.pack, cur, 1);
        a.gear.wear[it.slot] = key;
        break;
      }
    }
    a.lastTrade = { sid: L.settlement.id, sold, spent };
    return a.lastTrade;
  }

  // One thing a day the town remembers them for.
  deed(a, L, day, rng) {
    const e = L.econ;
    const s = L.settlement;
    const people = L.npcs.filter((r) => alive(r) && !r.away && !r.migrated && !r.visitor);
    const nm = `${a.name.first} ${a.name.last}`;
    const tavern = L.buildings.find((b) => b.type === 'tavern');
    const guards = people.filter((r) => r.job === 'guard');
    const hungry = people.filter((r) => r.hungry >= 1);
    const beastly = (e.recent.raids || 0) > 0 || (e.recent.violence || 0) > 1;
    let kind;
    if (beastly && rng.chance(0.8)) kind = 'hunt';
    else if (hungry.length >= 2 && a.coins > 60 && a.personality.kindness > 0.5 && rng.chance(0.6)) kind = 'bread';
    else if (guards.length && rng.chance(0.4)) kind = 'spar';
    else if (tavern) kind = 'tales';
    else kind = 'tales';
    a.deeds++;
    const cheer = (n, by) => {
      for (const r of rng.shuffle(people.slice()).slice(0, n)) r.mood = clamp((r.mood ?? 0.5) + by, 0, 1);
    };
    if (kind === 'hunt') {
      e.recent.raids = 0;
      e.recent.violence = Math.max(0, (e.recent.violence || 0) - 1);
      // The mayor pays a bounty, if the treasury can stand it.
      const bounty = e.treasury > 120 ? Math.min(30, Math.round(e.treasury * 0.08)) : 0;
      e.treasury -= bounty;
      a.coins += bounty;
      st.add(a.pack, 'leather', rng.int(1, 3));
      cheer(6, 0.08);
      ledger(L, day, `${nm} hunted down the beasts that have been troubling ${s.name}${bounty ? `, for a bounty of ¤${bounty}` : ''}.`);
    } else if (kind === 'bread') {
      const n = Math.min(hungry.length, 6);
      a.coins -= n * 4;
      const k = kitchenOf(L);
      if (k) k.till += n * 4;
      for (const r of hungry.slice(0, n)) {
        r.hungry = Math.max(0, r.hungry - 1);
        r.fed = Math.max(r.fed || 0, 1);
        r.mood = clamp((r.mood ?? 0.5) + 0.1, 0, 1);
      }
      ledger(L, day, `${nm}, an adventurer passing through, paid for bread for ${n} hungry folk.`);
    } else if (kind === 'spar') {
      const g = rng.pick(guards);
      // An even match, mostly: the guard's drill and nerve against the
      // adventurer's road-won skill (and the luck of the day).
      const gs = 1 + (g.drilled ? 0.35 : 0) + (g.personality?.bravery ?? 0.5) * 0.5 + (this.sim.tech?.has(s, 'drill') ? 0.15 : 0);
      const as = 0.9 + a.level * 0.3;
      const roll = (gs - as) * 0.6 + rng.float(-1, 1);
      const gn = `Guard ${g.name.first} ${g.name.last}`;
      g.mood = clamp((g.mood ?? 0.5) + (roll > 0 ? 0.15 : 0.05), 0, 1);
      const line = roll > 0.6 ? rng.pick([`${gn} bested ${nm} in a friendly bout. The watch is still cheering.`, `${nm} challenged the watch, and ${gn} had them in the dirt in three passes.`, `${gn} took ${nm}'s blade off them in a sparring match. ${nm} bought the drinks.`])
        : roll > 0.1 ? rng.pick([`${gn} edged a hard-fought bout against ${nm}.`, `${nm} and ${gn} sparred till both could barely stand; the watch gave it to ${g.name.first}.`])
          : roll > -0.1 ? rng.pick([`${nm} and ${gn} sparred to a draw. Neither will hear otherwise.`, `A long bout between ${nm} and ${gn}, called a draw when the light went.`])
            : roll > -0.6 ? rng.pick([`${nm} got the better of ${gn} in a close bout.`, `${nm} sparred with the watch and just about beat ${gn}.`])
              : rng.pick([`${nm} sparred with the watch and put ${gn} on the ground, twice.`, `${nm} made short work of ${gn} in a friendly bout. The watch went quiet.`, `${gn} lasted a minute against ${nm}, no more.`]);
      ledger(L, day, line);
    } else {
      const far = this.game.world.ow.settlements[a.seen[a.seen.length - 2] ?? a.from];
      cheer(8, 0.06);
      ledger(L, day, `${nm} kept the ${tavern ? 'tavern' : 'square'} up late with tales${far ? ` of ${far.name}` : ' of the road'}.`);
    }
    return kind;
  }

  // They died (at your hands, or a beast's).
  died(id, cause) {
    const a = this.get(id);
    if (!a || a.dead) return;
    a.dead = true;
    a.diedDay = Math.floor(this.sim.abs / DAY);
    a.cause = cause;
    this.sim.camps.strike(`a:${a.id}`);
    this.ents.delete(a.id);
  }

  // An adventurer staying in a town you're in: someone you can meet.
  syncEnts() {
    const g = this.game;
    if (!g.spawnAdventurer) return;
    const now = this.sim.abs;
    for (const a of this.list) {
      const ent = this.ents.get(a.id);
      // (Met on the road: the road keeps them.)
      if (ent && !ent.dead && ent.caravan) {
        a.hp = ent.hp;
        a.coins = ent.rec.coins;
        continue;
      }
      const here = !a.dead && a.state === 'stay' && g.active.has(a.at) && now < a.leave;
      if (here && (!ent || ent.dead)) {
        const L = this.sim.layoutOf(a.at);
        const n = g.spawnAdventurer(L, a, this.recordOf(a, L));
        if (n) this.ents.set(a.id, n);
      } else if (ent && !ent.dead && (!here || ent.layout.settlement.id !== a.at)) {
        // Off down the road (or you've gone): they walk out of sight.
        if (!g.active.has(ent.layout.settlement.id) || a.dead) {
          g.removeAdventurer?.(ent);
          this.ents.delete(a.id);
        } else if (!(ent.rec.override && ent.rec.override.act === 'travel')) {
          setOverride(ent.rec, now, now + 240, 'travel', { place: 'road' });
          ent.activity = null;
        }
      }
      if (ent && !ent.dead) {
        // Keep the roster's view of them up to date.
        a.hp = ent.hp;
        a.coins = ent.rec.coins;
        a.arrows = invCount(ent.rec.inv || [], 'arrow');
      }
    }
  }

  // The same, for meeting them on the road (kept while they're on it).
  roadRec(a, L) {
    this.roadRecs ||= new Map();
    const k = `${a.id}:${a.departAt}`;
    let r = this.roadRecs.get(k);
    if (!r) {
      r = this.recordOf(a, L);
      this.roadRecs.clear();
      this.roadRecs.set(k, r);
    }
    return r;
  }

  // The record their townsfolk-style entity runs on.
  recordOf(a, L) {
    const sched = ADV_DAY.map((q) => ({ ...q }));
    const items = [{ item: a.gear.weapon, count: 1 }];
    if (a.gear.bow) items.push({ item: a.gear.bow, count: 1 });
    return {
      id: `${L.settlement.id}:a${a.id}`, idx: 5000 + a.id, sid: L.settlement.id, visitor: true, adventurer: a.id, advLevel: a.level,
      name: a.name, age: 'adult', job: 'adventurer', home: null, bed: 0, household: null,
      partner: null, children: [], parents: [], friends: [], personality: a.personality, traits: a.traits,
      hobbies: [], look: a.look, alive: true, shift: 'day', restDay: -1,
      equipment: { tool: a.gear.weapon, hobbyItem: null, items, coins: 0, armor: ARMOR(a.gear.wear) },
      wear: a.gear.wear, maxHp: a.maxHp, hp: Math.max(1, Math.round(a.hp)), work: { kind: 'none' }, schedule: { work: sched, rest: sched },
      coins: a.coins, inv: a.arrows ? [{ item: 'arrow', count: a.arrows }, { item: 'healing_salve', count: st.count(a.pack, 'healing_salve') }].filter((q) => q.count) : [],
      skills: { trading: 0.6, cooking: 0.3, hunting: 0.8, fishing: 0.3, farming: 0.1, building: 0.2, crafting: 0.4 },
      fed: 1, hungry: 0, mood: 0.8, grief: [], override: null, away: false, doneKey: null,
    };
  }

  // Their pack, for trading with you.
  shop(a) {
    return { store: a.pack, purse: { get: () => a.coins, add: (n) => { a.coins += n; const e = this.ents.get(a.id); if (e && !e.dead) e.rec.coins = a.coins; } }, kind: 'adventurer', wants: null };
  }

  here(sid) {
    return this.list.filter((a) => !a.dead && a.state === 'stay' && a.at === sid);
  }

  serialize() {
    return { list: this.list, next: this.next, started: this.started };
  }

  load(d) {
    this.list = (d && d.list) || [];
    this.next = (d && d.next) || 1;
    this.started = !!(d && d.started);
    this.ents = new Map();
  }
}
