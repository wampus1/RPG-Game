// (Round 146) The life of the places a town is known for (see
// world/specialties.js for what they are, world/quarters/ for what's built,
// sim/shows.js for what goes on there and when): the people who work them
// (taken on from the town's own: the gladiators, the librarian, the
// vintner, the delvers...), the day's doings and the crowds that come for
// them, how each turned out when nobody was there to watch (the bouts, the
// races, the plays, the delvers who didn't come back), the coin they bring
// the town, the word of them that goes round the realm, the wares the
// quarter's own traders sell, and each player's own dealings there (their
// wagers, their winnings, their name in the arena), kept by player so it
// holds with others playing.
//
// A town's quarter state is kept with its books (L.econ.q), saved with it;
// the players' own, here, saved with the world.
import { SHOWS, dayRng, fighterOf, settleBout, settleRace, fighterName } from './shows.js';
import { raiseQuarters } from '../world/quarters/index.js';
import { roleTag } from '../world/quarters/kit.js';
import { SPECIALTIES, formOf } from '../world/specialties.js';
import { JOBS, retrain } from '../entities/npcgen.js';
import { DAY, alive, setOverride, activityFor, st, ledger, hearNews, stockFor } from './econ.js';
import { RNG, hash4, clamp } from '../util/rng.js';
import { seatOfPid } from './saga/refs.js';
import { ITEMS } from '../world/items.js';
import { GROUND } from '../config.js';

const V = 1;
// How many of each of its people a quarter takes on at most (the rest of
// its places for them stay empty): the gladiators a school keeps, the
// stallholders of a bazaar...
const CAP = { gladiator: 6, stallholder: 5, monk: 4, delver: 4, actor: 4, cleric: 3, gardener: 3, smith: 3, sellsword: 3, attendant: 3, musician: 2, scribe: 2, vintner: 2, beekeeper: 2, mason: 3, shipwright: 3, drillmaster: 1, jockey: 3, groom: 2 };
// (Who the town can spare for them: those in the commoner trades, from
// whichever has the most hands, so long as it keeps two.)
const SPARE = ['laborer', 'farmer', 'lumberjack', 'fisher', 'miner', 'trapper', 'merchant', 'beggar', 'builder', 'carpenter', 'tailor', 'baker'];
// What those who come for each do: sit and watch, pray, take the waters,
// walk about.
const FREE = new Set(['hobby', 'wander', 'social', 'play', 'home', 'rest']);
const BIG = new Set(['games', 'races', 'feast', 'fairday', 'launch', 'gathering', 'auction']);
// (Those who never leave their posts for a show.)
const KEEP = new Set(['guard', 'mayor', 'cook', 'innkeeper', 'barkeep', 'priest', 'healer', 'builder']);
// What a day's doings bring the town (a share of the crowd's coin each).
const GATE = { games: 1.2, races: 1, play: 0.8, feast: 1.5, auction: 0.6, fairday: 1.4, bathing: 0.5, launch: 0.4, tasting: 0.8, lecture: 0.2, gathering: 0.3, service: 0.2, casting: 0.3, expedition: 1.5, promenade: 0.1, stars: 0.2 };
// The quarter's own traders: what they sell (see econ.STOCK).
export const QSTOCK = {
  vintner: ['wine', 'grapes', 'ale', 'mead', 'barrel'],
  beekeeper: ['honeycomb', 'mead', 'beeswax_candle', 'flower_red', 'flower_blue'],
  bazaar: ['spices', 'silk', 'rug_red', 'rug_blue', 'rug_green', 'pottery', 'lantern', 'pearl', 'jasmine_tea', 'cloth', 'dice', 'pipe', 'gem', 'fine_coat', 'pearl_necklace', 'apple', 'bread'],
  cleric: ['holy_water', 'beeswax_candle', 'prayer_beads', 'healing_salve', 'book'],
  monk: ['jasmine_tea', 'prayer_beads', 'herb', 'book'],
  cartographer: ['treasure_map', 'paper', 'ink', 'scroll', 'star_chart'],
  mason: ['stone_bricks', 'cobblestone', 'marble_bust', 'chisel'],
  horsetrader: ['saddle', 'wheat', 'hay_bale', 'apple', 'carrot'],
  quartermaster: ['arrow', 'iron_helmet', 'iron_shield', 'spear', 'healing_salve', 'torch', 'bread'],
  guildmaster: ['iron_ingot', 'coal', 'steel_sword', 'hammer', 'anvil'],
  surgeon: ['healing_salve', 'herb', 'potion_vigor'],
  shipwright: ['planks', 'string', 'raft', 'barrel', 'spyglass'],
  antiquarian: ['old_coin', 'relic_shard', 'treasure_map', 'marble_bust'],
  fortuneteller: ['dice', 'moonstone', 'flower_blue'],
  showman: ['apple', 'pie', 'dice', 'flute', 'hand_drum'],
};
// Each trade's own takings, by the quarter's trade (see shop()).
const TRADER = { smith: 'smith', stallholder: 'bazaar', vintner: 'vintner', beekeeper: 'beekeeper', cartographer: 'cartographer', surgeon: 'surgeon', cleric: 'cleric', monk: 'monk', mason: 'mason', horsetrader: 'horsetrader', quartermaster: 'quartermaster', guildmaster: 'guildmaster', shipwright: 'shipwright', antiquarian: 'antiquarian', fortuneteller: 'fortuneteller', showman: 'showman' };

export const qtagJob = (tag) => (tag && tag.includes(':') ? tag.slice(tag.indexOf(':') + 1) : null);
export const qtagIdx = (tag) => (tag && tag.startsWith('q') ? parseInt(tag.slice(1), 10) : -1);

export class Cities {
  constructor(game, sim) {
    this.game = game;
    this.sim = sim;
    // By player: { bets: [...], fame: { sid: n }, record: { w, l }, seen: {} }.
    this.players = {};
  }

  // ------------------------------------------------------------ the town
  // A town's quarters (as built), and the state of each kept with it.
  quarters(L) {
    return (L && L.quarters) || [];
  }
  qs(L) {
    const e = L.econ;
    if (!e.q || e.q.v !== V) e.q = { v: V, lots: e.q && e.q.lots, built: e.q && e.q.built, st: (e.q && e.q.st) || [], biz: (e.q && e.q.biz) || {}, day: -1, ev: [], past: [], takings: 0 };
    return e.q;
  }
  stateOf(L, i) {
    const Q = this.qs(L);
    const q = this.quarters(L)[i];
    if (!q) return null;
    if (!Q.st[i] || Q.st[i].k !== q.k) {
      const S = SHOWS[q.k];
      const rng = new RNG(hash4(L.settlement.seed >>> 0, i, 0x5e2));
      Q.st[i] = { k: q.k, ...(S ? S.init({ L, q, rng }) : { log: [] }) };
    }
    return Q.st[i];
  }

  // As a town's laid out (and from its books, if it's been saved): in an
  // older world, its quarters raised on open ground; its people taken on;
  // a delve's way down made the door to its own old place.
  attach(L) {
    const s = L.settlement;
    if (!(s.spec || []).length || s.haven) return;
    const Q = this.qs(L);
    const wg = this.game.world.ow.wg || 1;
    if (wg < 10 && s.condition !== 'abandoned' && !L.quarters?.length) {
      Q.lots ||= [];
      // (Out past the town's edge, nothing's built over the realm's roads.)
      const avoid = new Set();
      const b = L.bounds;
      for (const r of (this.sim.diplomacy && this.sim.diplomacy.roads) || []) {
        for (const t of r.tiles || []) if (t[0] >= b.x0 - 60 && t[0] <= b.x1 + 60 && t[2] >= b.z0 - 60 && t[2] <= b.z1 + 60) avoid.add(t[0] * 65536 + t[2]);
      }
      const { ops } = raiseQuarters(L, Q.lots, new RNG(hash4(s.seed >>> 0, 0x146)), avoid);
      if (ops.length && !Q.built) this.sim.setBlocks(ops);
      Q.built = true;
    }
    if (!this.quarters(L).length) return;
    for (const q of this.quarters(L)) this.stateOf(L, q.i);
    this.placeDelve(L);
    this.staff(L, new RNG(hash4(s.seed >>> 0, this.sim.today(), 0x147)));
  }

  // A delve's old place: its door where the way down is (see specialties.js).
  placeDelve(L) {
    const q = this.quarters(L).find((o) => o.k === 'delve');
    const fx = q && q.fx.find((f) => f.kind === 'delve');
    if (!fx) return;
    const site = (this.game.world.sites || []).find((o) => o.delve === L.settlement.id);
    if (!site) return;
    site.x = fx.x;
    site.z = fx.z;
    site.h = GROUND;
    const rec = this.sim.dungeons.get(site.id);
    if (rec) {
      rec.x = fx.x;
      rec.z = fx.z;
      rec.h = GROUND;
      rec.known = true;
    }
  }

  // The people each quarter needs, taken on from the town's own where they
  // can be spared (and anyone of theirs lost since, replaced).
  staff(L, rng) {
    const people = L.npcs.filter((r) => alive(r) && !r.away && !r.visitor && r.age === 'adult');
    const cap = Math.max(4, Math.ceil(people.length * 0.14));
    let have = people.filter((r) => r.qtag).length;
    // (First one of each, then the rest.)
    const wants = [];
    for (const q of this.quarters(L)) {
      for (const [job, spots] of Object.entries(q.roles)) {
        if (!JOBS[job]) continue;
        const n = Math.min(spots.length, CAP[job] || 2);
        const tag = roleTag(q.i, job);
        const now = people.filter((r) => r.qtag === tag).length;
        for (let k = now; k < n; k++) wants.push({ q, job, tag, pri: k });
      }
    }
    wants.sort((a, b) => a.pri - b.pri);
    for (const w of wants) {
      if (have >= cap) break;
      const r = this.spare(L, people);
      if (!r) break;
      r.qtag = w.tag;
      retrain(L, r, w.job, rng.fork(`staff:${r.idx}`));
      have++;
      // (A gladiator's a fighter of the school: on the roster in the place
      // of one who's only a name.)
      if (w.job === 'gladiator') this.enlist(L, w.q.i, r, rng);
    }
  }
  spare(L, people) {
    const by = new Map();
    for (const r of people) {
      if (r.qtag || r.ruler !== undefined || r.councillor || r.migrated || r.soldier || r.captive || r.adventurer !== undefined) continue;
      if (!SPARE.includes(r.job)) continue;
      if (!by.has(r.job)) by.set(r.job, []);
      by.get(r.job).push(r);
    }
    let best = null;
    for (const list of by.values()) if (list.length >= 3 && (!best || list.length > best.length)) best = list;
    if (!best) return null;
    best.sort((a, b) => hash4(a.idx, 0x5f) - hash4(b.idx, 0x5f));
    return best[0];
  }
  enlist(L, i, r, rng) {
    const S = this.stateOf(L, i);
    if (!S || !S.roster || S.roster.some((f) => f.rec === r.idx)) return;
    const slot = S.roster.find((f) => f.rec === undefined) || null;
    const f = fighterName(rng, L.settlement.style);
    const name = `${r.name.first} ${f.name.split(' ').slice(1).join(' ')}`;
    if (slot) {
      slot.rec = r.idx;
      slot.name = name;
    } else S.roster.push({ id: S.nextId++, name, way: S.roster[0] ? S.roster[0].way : 'Brawler', skill: rng.float(0.4, 0.8), w: 0, l: 0, fame: 0, rec: r.idx });
  }

  // ------------------------------------------------------------ the days
  // Today's doings at each quarter (worked out once a day, kept with the
  // town so a bout half-watched, a wager placed, keeps to the day).
  today(L, at = this.sim.now()) {
    const Q = this.qs(L);
    const day = Math.floor(at / DAY);
    // (Never back to a day gone: a town behind the rest catching up keeps
    // to the newest it's been asked about.)
    if ((Q.day === day || (Q.day > day && Q.ev.length)) && Q.ev.length === this.quarters(L).length) return Q.ev;
    // (Anything of yesterday's not settled yet, settled now.)
    if (Q.day >= 0) Q.ev.forEach((list, i) => list && list.forEach((ev) => this.settle(L, i, ev)));
    Q.day = day;
    Q.ev = this.quarters(L).map((q) => {
      const S = SHOWS[q.k];
      if (!S) return [];
      const list = S.events({ L, q, st: this.stateOf(L, q.i) }, day) || [];
      list.forEach((ev, k) => {
        ev.id = `${day}:${q.i}:${k}`;
      });
      return list;
    });
    return Q.ev;
  }
  eventsOf(L, i) {
    return this.today(L)[i] || [];
  }
  // What's on at a quarter just now (or about to be, within `ahead` minutes).
  current(L, i, ahead = 0) {
    const now = this.sim.now();
    return this.eventsOf(L, i).find((ev) => now >= ev.s - ahead && now < ev.e && !ev.done) || null;
  }
  // What's on next there (today's, or nothing).
  next(L, i) {
    const now = this.sim.now();
    return this.eventsOf(L, i).find((ev) => ev.s > now) || null;
  }

  // Each hour of a town's: the crowds called for what's on soon; what's
  // over settled; the stalls stocked in the morning; the staff paid of an
  // evening.
  hourly(L, h, day, hod) {
    if (!this.quarters(L).length) return;
    const evs = this.today(L, h);
    evs.forEach((list, i) => {
      for (const ev of list) {
        if (!ev.called && ev.s - h <= 90 && ev.e > h) this.call(L, i, ev);
        // (One being watched is settled as it's played out: see cityplay.js;
        // left over half an hour past its end, settled here.)
        if (!ev.done && h + 60 >= ev.e && (!ev.live || h >= ev.e + 30)) this.settle(L, i, ev);
      }
    });
    if (hod === 6) this.restock(L, day);
    if (hod === 19) this.payStaff(L);
    if (hod === 4) this.staff(L, new RNG(hash4(L.settlement.seed >>> 0, day, 0x147)));
  }

  // Those who'll come: the town's people with the time free, by their
  // liking for it (the brave to the bouts, the pious to the prayers), each
  // to a seat of their own, or a place in the water, or a walk about.
  call(L, i, ev) {
    ev.called = true;
    if (!ev.crowd) return;
    const q = this.quarters(L)[i];
    const day = Math.floor(ev.s / DAY);
    const m = ((ev.s % DAY) + DAY) % DAY;
    const pool = L.npcs.filter((r) => {
      if (!alive(r) || r.away || r.hired || r.visitor || r.age === 'child' || r.captive || r.soldier) return false;
      if (r.qtag && qtagIdx(r.qtag) === i) return false;
      if (r.override && r.override.e > ev.s - 30) return false;
      const a = activityFor(r, day, m + 5);
      if (FREE.has(a.entry.act)) return true;
      // (The great days: the games, the races, a feast, the fair, a ship
      // launched: some leave their work for it.)
      return a.entry.act === 'work' && BIG.has(ev.type) && !KEEP.has(r.job) && hash4(r.idx, day, 0x5e9) % 10 < 4;
    });
    const like = (r) => {
      const p = r.personality || {};
      const tr = r.traits || [];
      let w = (hash4(r.idx, day, 0x5e3) % 1000) / 1000;
      if (q.k === 'arena' || q.k === 'racecourse') w += (p.bravery ?? 0.5) * 0.6 + (tr.includes('hot-headed') ? 0.3 : 0);
      if (q.k === 'holy' || q.k === 'circle' || q.k === 'monastery') w += tr.includes('pious') ? 0.8 : 0.1;
      if (q.k === 'library') w += tr.includes('curious') || tr.includes('bookish') ? 0.8 : 0;
      if (q.k === 'theatre') w += tr.includes('romantic') || tr.includes('cheerful') ? 0.5 : 0;
      return w;
    };
    pool.sort((a, b) => like(b) - like(a));
    const seats = this.placesFor(L, q, ev);
    const n = Math.min(Math.round(pool.length * ev.crowd), seats.length, 40);
    const tag = ev.act === 'pray' ? 'pray' : ev.act === 'bathe' ? 'bathe' : ev.act === 'stroll' || ev.act === 'farm' ? 'stroll' : 'show';
    for (let k = 0; k < n; k++) {
      const r = pool[k];
      const t = seats[k];
      const lead = 10 + (hash4(r.idx, ev.s, 0x5e4) % 35);
      setOverride(r, ev.s - lead, ev.e, 'show', { place: 'quarter', q: i, ev: ev.id, tag, target: t.walk ? null : { x: t.x, y: t.y, z: t.z }, face: t.face, seat: !!t.seat, walk: t.walk || null, allowMeals: ev.e - ev.s > 240 });
      if (r.ent && !r.ent.dead && ev.s - lead <= this.sim.abs) r.ent.activity = null;
    }
    ev.crowdN = n;
  }
  // Where they'll be: the seats (the stands, the pews, the benches), else
  // the pool, else a walk round the quarter.
  placesFor(L, q, ev) {
    const rng = new RNG(hash4(L.settlement.seed >>> 0, q.i, ev.s, 0x5e5));
    const walks = (n) => {
      const out = [];
      for (let k = 0; k < n; k++) {
        const walk = [];
        for (let j = 0; j < 4; j++) walk.push({ x: rng.int(q.x0 + 1, q.x1 - 1), z: rng.int(q.z0 + 1, q.z1 - 1) });
        out.push({ walk, face: 0 });
      }
      return out;
    };
    if (ev.act === 'bathe') {
      const pools = L.spots.filter((sp) => sp.q === q.i && sp.tags.includes('bathe'));
      if (pools.length) return rng.shuffle(pools.map((sp) => ({ x: sp.x, y: sp.y, z: sp.z, face: sp.face, seat: false })));
    }
    if (ev.act === 'stroll' || ev.act === 'farm') return walks(30);
    // (The best seats kept for the great and the good: the rest in turn;
    // then the quarter's benches and places to stand; then about it.)
    const out = rng.shuffle(q.seats.filter((o) => !o.box).map((o) => ({ x: o.x, y: o.y ?? GROUND, z: o.z, face: o.face, seat: true })));
    const taken = new Set(out.map((o) => `${o.x},${o.z}`));
    const roleish = (t) => t.startsWith('q') && t.includes(':');
    for (const sp of rng.shuffle(L.spots.filter((o) => o.q === q.i && !o.tags.some(roleish)))) {
      if (out.length >= 40) break;
      if (taken.has(`${sp.x},${sp.z}`)) continue;
      taken.add(`${sp.x},${sp.z}`);
      out.push({ x: sp.x, y: sp.y ?? GROUND, z: sp.z, face: sp.face, seat: !!sp.seat });
    }
    if (out.length < 12) out.push(...walks(12 - out.length));
    return out;
  }

  // How one of a quarter's doings turned out (if it hasn't been played out
  // before someone's eyes): what it changed, what's said of it, the coin it
  // brought in, the wagers on it settled.
  settle(L, i, ev, rng = null) {
    if (ev.done) return;
    ev.done = true;
    ev.live = false;
    const q = this.quarters(L)[i];
    const S = q && SHOWS[q.k];
    if (!S) return;
    const day = Math.floor(ev.s / DAY);
    const r = rng || dayRng(L, i, day, 77 + (hash4(ev.s, 0x5e8) % 97));
    const st0 = this.stateOf(L, i);
    const news = S.resolve({ L, q, st: st0, rng: r }, ev) || [];
    this.afterResolve(L, q, st0, ev);
    // The gate's takings: to the town, a share of the crowd's coin.
    const gate = Math.round((ev.crowdN || 0) * (GATE[ev.type] || 0.3) * Math.max(0.4, L.econ.wealth || 1));
    if (gate) {
      L.econ.treasury += gate;
      this.qs(L).takings = (this.qs(L).takings || 0) + gate;
    }
    this.settleBets(L, i, ev);
    // What's said of it: on the town's board, in its books, and carried to
    // the towns about.
    if (news.length) {
      hearNews(L, L.settlement.name, news, day, ev.e);
      for (const t of news) ledger(L, day, t);
      this.spread(L, news, day, ev.e);
    }
    const past = this.qs(L).past;
    past.push({ q: i, type: ev.type, title: ev.title, day, n: ev.crowdN || 0, text: news[0] || null, res: summaryOf(st0, ev) });
    if (past.length > 12) past.shift();
  }

  // What follows from it in the town: a delver lost below is mourned like
  // anyone; a gladiator's wins lift them; pilgrims bring alms.
  afterResolve(L, q, S, ev) {
    if (q.k === 'delve' && S.lostRec !== undefined) {
      const r = L.npcs[S.lostRec];
      S.lostRec = undefined;
      if (r && alive(r)) this.sim.recordDeath(L, r, 'lost in the delve', null, ev.e);
      // (Their place in the guild filled from the town in time: see staff.)
    }
    if (q.k === 'delve') {
      const site = (this.game.world.sites || []).find((o) => o.delve === L.settlement.id);
      const rec = site && this.sim.dungeons.get(site.id);
      if (rec) rec.delves = (rec.delves || 0) + 1;
      // (A good haul: coin for the town, and a relic for the stands.)
      if (S.hauls && S.hauls % 3 === 0) L.econ.treasury += 10;
    }
    if (q.k === 'arena' && ev.data && ev.data.bouts) {
      for (const b of ev.data.bouts) {
        for (const id of [b.a, b.b]) {
          const f = fighterOf(S, id);
          const r = f && f.rec !== undefined ? L.npcs[f.rec] : null;
          if (!r || !alive(r)) continue;
          const won = (b.result === 'a' && id === b.a) || (b.result === 'b' && id === b.b);
          r.mood = clamp((r.mood ?? 0.6) + (won ? 0.08 : -0.05), 0, 1);
          r.coins = (r.coins || 0) + (won ? 6 : 2);
        }
      }
    }
    if (q.k === 'holy' && ev.type === 'feast') L.econ.treasury += 6 + (ev.data ? ev.data.pilgrims : 0);
    if (q.k === 'winery' && ev.type === 'harvest') {
      const b = this.bizOf(L, `${q.i}:vintner`);
      st.add(b.store, 'wine', 2 + (S.vintage || 3));
    }
  }

  // Word of it carried to the towns about (those within a day or so's
  // ride, already laid out).
  spread(L, news, day, at) {
    const s = L.settlement;
    for (const o of this.game.world.layouts.values()) {
      if (o === L || !o.econ) continue;
      const t = o.settlement;
      if (Math.hypot(t.cx - s.cx, t.cz - s.cz) > 8) continue;
      hearNews(o, s.name, news.slice(0, 1), day, at);
    }
  }

  // ------------------------------------------------------------ wagers
  // A player's own dealings (by player, so each has their own with others
  // playing).
  mine(pid) {
    return (this.players[pid] ||= { bets: [], fame: {}, record: { w: 0, l: 0 }, seen: {} });
  }
  // The odds on each side of a bout, or each horse in a race (a little
  // under the fair odds, for the bookmaker's keep).
  odds(L, i, ev, sub) {
    const S = this.stateOf(L, i);
    if (ev.type === 'games') {
      const b = ev.data.bouts[sub];
      const A = fighterOf(S, b.a);
      const Bf = fighterOf(S, b.b);
      const sa = A ? A.skill ?? 0.5 : 0.5;
      const sb = Bf ? Bf.skill ?? 0.45 : 0.45;
      const pa = sa / (sa + sb);
      return { a: Math.max(1.1, Math.round((0.9 / pa) * 10) / 10), b: Math.max(1.1, Math.round((0.9 / (1 - pa)) * 10) / 10) };
    }
    if (ev.type === 'races') {
      const r = ev.data.races[sub];
      const v = r.field.map((id) => {
        const h = S.horses.find((o) => o.id === id);
        return h ? h.speed * 0.6 + h.stam * 0.3 + 0.22 : 0.5;
      });
      const tot = v.reduce((a, b) => a + b ** 4, 0);
      const out = {};
      r.field.forEach((id, k) => {
        out[id] = Math.max(1.2, Math.round((0.85 * tot / v[k] ** 4) * 10) / 10);
      });
      return out;
    }
    return null;
  }
  // A wager laid: `pick` 'a' or 'b' for a bout, a horse's id for a race.
  bet(pid, L, i, ev, sub, pick, stake) {
    const o = this.odds(L, i, ev, sub);
    if (!o || o[pick] === undefined) return null;
    const b = { sid: L.settlement.id, q: i, ev: ev.id, sub, pick, stake, odds: o[pick], state: 'open', day: Math.floor(ev.s / DAY), title: betTitle(this.stateOf(L, i), ev, sub, pick) };
    this.mine(pid).bets.push(b);
    if (this.mine(pid).bets.length > 40) this.mine(pid).bets.shift();
    return b;
  }
  settleBets(L, i, ev) {
    const sid = L.settlement.id;
    for (const [pid, P] of Object.entries(this.players)) {
      for (const b of P.bets) {
        if (b.state !== 'open' || b.sid !== sid || b.q !== i || b.ev !== ev.id) continue;
        const won = ev.type === 'games' ? ev.data.bouts[b.sub] && ev.data.bouts[b.sub].result === b.pick
          : ev.type === 'races' ? ev.data.races[b.sub] && ev.data.races[b.sub].result && ev.data.races[b.sub].result[0] === b.pick : false;
        b.state = won ? 'won' : 'lost';
        b.pay = won ? Math.round(b.stake * b.odds) : 0;
        this.tell(pid, won ? `Your wager on ${b.title} came in: ¤${b.pay} to collect from the bookmaker.` : `Your wager on ${b.title} is lost.`, won ? '#a0ffa0' : '#ffb080');
      }
    }
  }
  // Winnings waiting at a town's bookmaker for a player.
  owed(pid, sid) {
    return this.mine(pid).bets.filter((b) => b.sid === sid && b.state === 'won').reduce((a, b) => a + b.pay, 0);
  }
  collect(pid, sid) {
    let n = 0;
    for (const b of this.mine(pid).bets) {
      if (b.sid !== sid || b.state !== 'won') continue;
      n += b.pay;
      b.state = 'paid';
    }
    return n;
  }
  // Word to a player, if they're about (for the host or a guest alike).
  tell(pid, text, color) {
    const g = this.game;
    let ent = null;
    if (!g.seats || g.seats.length < 2) ent = pid === 'host' ? g.player : null;
    else {
      const seat = seatOfPid(g, pid);
      ent = seat ? (seat === g.seat ? g.player : seat.ent) : null;
    }
    if (!ent || !g.ui) return;
    if (g.asPlayer) g.asPlayer(ent, () => g.ui.msg(text, color));
    else g.ui.msg(text, color);
  }

  // A player's name at a town's arena (their wins there, and how it's said).
  fameOf(pid, sid) {
    return this.mine(pid).fame[sid] || 0;
  }
  addFame(pid, sid, n) {
    const P = this.mine(pid);
    P.fame[sid] = Math.max(-5, (P.fame[sid] || 0) + n);
    return P.fame[sid];
  }

  // ------------------------------------------------------------ the stalls
  bizOf(L, key) {
    const Q = this.qs(L);
    return (Q.biz[key] ||= { store: {}, till: 20, earned: 0 });
  }
  // The shelf one of a quarter's traders sells from (see Sim.shopOfInner):
  // their own stall's, its takings theirs and the quarter's.
  shop(L, rec) {
    const job = qtagJob(rec.qtag);
    const kind = TRADER[job];
    if (!kind) return null;
    const b = this.bizOf(L, `${qtagIdx(rec.qtag)}:${job}`);
    if (!Object.keys(b.store).length) this.stock(L, b, kind, new RNG(hash4(L.settlement.seed >>> 0, rec.idx, 0x5e6)));
    return { store: b.store, purse: { get: () => b.till + rec.coins, add: (n) => { if (n >= 0) b.till += n; else { const t = Math.min(b.till, -n); b.till -= t; rec.coins -= -n - t; } } }, kind: kind === 'smith' ? 'smith' : kind === 'surgeon' ? 'herbalist' : 'general', quarter: true };
  }
  stock(L, b, kind, rng) {
    const list = kind === 'smith' ? stockFor(L, 'smith') : QSTOCK[kind] || [];
    for (const k of list) if (ITEMS[k] && rng.chance(0.75)) st.add(b.store, k, rng.int(1, kind === 'bazaar' ? 4 : 3));
  }
  restock(L, day) {
    const Q = this.qs(L);
    for (const [key, b] of Object.entries(Q.biz)) {
      const job = key.slice(key.indexOf(':') + 1);
      const kind = TRADER[job];
      if (!kind) continue;
      const rng = new RNG(hash4(L.settlement.seed >>> 0, day, key.length, 0x5e7));
      const list = kind === 'smith' ? stockFor(L, 'smith') : QSTOCK[kind] || [];
      for (const k of list) if (ITEMS[k] && st.count(b.store, k) < 2 && rng.chance(0.35)) st.add(b.store, k, 1);
    }
  }
  // The quarter's people paid from its takings (and the town's purse).
  payStaff(L) {
    const Q = this.qs(L);
    const staff = L.npcs.filter((r) => alive(r) && !r.away && r.qtag);
    if (!staff.length) return;
    const wage = 4;
    const owed = wage * staff.length;
    const fromTake = Math.min(Q.takings || 0, owed);
    Q.takings = (Q.takings || 0) - fromTake;
    const rest = owed - fromTake;
    if (rest > 0 && L.econ.treasury < rest) return;
    L.econ.treasury -= Math.max(0, rest);
    for (const r of staff) {
      r.coins = (r.coins || 0) + wage;
      r.earned = (r.earned || 0) + wage;
    }
  }

  // ------------------------------------------------------------ saving
  serialize() {
    return { players: this.players };
  }
  load(d) {
    this.players = (d && d.players) || {};
  }
}

// A line on what came of it, for the boards (see ui/citywin.js).
function summaryOf(S, ev) {
  if (ev.type === 'games' && ev.data) {
    return ev.data.bouts.map((b) => {
      const A = fighterOf(S, b.a);
      const Bf = fighterOf(S, b.b);
      const w = b.result === 'a' ? A : Bf;
      return w ? `${w.name} beat ${(b.result === 'a' ? Bf : A)?.name || 'their foe'}` : '';
    }).filter(Boolean).join('; ');
  }
  if (ev.type === 'races' && ev.data) {
    return ev.data.races.map((r) => {
      const h = r.result && S.horses.find((o) => o.id === r.result[0]);
      return h ? `${r.name}: ${h.name}` : '';
    }).filter(Boolean).join('; ');
  }
  if (ev.type === 'play' && ev.data) return ev.data.reception === 'cheers' ? 'to cheers' : 'to jeers';
  return '';
}

function betTitle(S, ev, sub, pick) {
  if (ev.type === 'games') {
    const b = ev.data.bouts[sub];
    const f = fighterOf(S, pick === 'a' ? b.a : b.b);
    return f ? f.name : 'a fighter';
  }
  if (ev.type === 'races') {
    const h = S.horses.find((o) => o.id === pick);
    return h ? `${h.name} in ${ev.data.races[sub].name}` : 'a horse';
  }
  return 'it';
}

// The quarter (if any) whose staff tag this is, and what kind it is.
export function quarterOfTag(L, tag) {
  const i = qtagIdx(tag);
  return i >= 0 ? (L.quarters || [])[i] || null : null;
}

// A specialty's plain name for its form (the Colosseum, the Abbey...).
export function titleOf(q) {
  const F = formOf(q);
  return F ? F.title : SPECIALTIES[q.k] ? SPECIALTIES[q.k].name : q.k;
}

export { settleBout, settleRace };
