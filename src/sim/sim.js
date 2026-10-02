// The town simulation layer that sits between the game and the settlement
// records: economy ticks, reputation, mourning and graves, citizenship and
// house building, traveling merchants, deferred world edits, and saving.
import { GROUND } from '../config.js';
import { B, BLOCKS } from '../world/blocks.js';
import { ITEMS } from '../world/items.js';
import { RNG, hash4, clamp } from '../util/rng.js';
import { jobTitle } from '../entities/npcgen.js';
import { graveyardFence } from '../world/settlement.js';
import {
  initEcon, mayorOf, simulateTo, activityFor, setOverride, freeSlot, st, invAdd, invCount, invTake, packGoods, makeVisitor,
  ledger, alive, DAY, price, kitchenOf, STOCK, notableNews, hearNews, freshRumours, glutFactor,
} from './econ.js';
import { Justice } from './justice.js';
import { Careers } from './careers.js';
import { Favors } from './favors.js';
import { Press } from './press.js';
import { Events } from './events.js';
import { Roads } from './roads.js';
import { tierOf, MERCHANT_TIERS, buyAt } from './shops.js';
import { checkWatch, checkSupply, checkHousing, births, staffBuilding, relocate, deserted } from './civic.js';
import { Works, placeSome } from './works.js';
import { Diplomacy, SOFT } from './diplomacy.js';
import { Nomads } from './nomads.js';
import { Camps } from './camps.js';
import { electMayor, weddings, comingOfAge, aging, raids } from './life.js';
import { Realms } from './realms.js';
import { Adventurers } from './adventurers.js';
import { Stables } from './stables.js';
import { Tech } from './tech.js';
import { Politics } from './politics.js';
import { War } from './war.js';
import { Caravans } from './caravans.js';
import { Outings } from './outings.js';
import { growth } from './growth.js';
import { removeItem, countItem } from '../game/inventory.js';
import { priceMult, repGainMult, opinionBonus, has as heroHas } from '../game/hero.js';
import { lawOn } from './laws.js';
import { Customs } from './culture.js';
import { History } from './history.js';
import { Society } from './society.js';
import { Bandits } from './bandits.js';
import { Founding } from './founding.js';
import { Hardship } from './hardship.js';
import { Religion } from './religion.js';
import { Market } from './market.js';
import { Ships } from './ships.js';
import { Portals } from './portals.js';
import { Labor } from './labor.js';
import { Prosperity } from './prosperity.js';
import { Dungeons } from './dungeons.js';
import { Ancient } from './ancient.js';

// Deeds needed for a town to call you its Friend, or its Hero.
export const RENOWN = { friend: 10, hero: 25 };

const REP_LEVELS = [
  [-60, 'Hated', '#ff5050'], [-25, 'Disliked', '#ff9060'], [10, 'Neutral', '#c8c8c8'],
  [35, 'Friendly', '#80e070'], [70, 'Liked', '#80e0ff'], [101, 'Trusted', '#ffe070'],
];

export function repLevel(v) {
  for (const [max, label, color] of REP_LEVELS) if (v < max) return { label, color };
  return { label: 'Trusted', color: '#ffe070' };
}

// Where people stand at a funeral: the foot of the grave first (for whoever
// says the words), then spots along the graveyard's paths and out past its
// gate, each with a clear pace round it where there's room.
export function funeralSpots(L, gx, gz, n, ok = () => true) {
  const g = L.graveyard;
  if (!g) return [{ x: gx, z: gz + 1 }];
  const south = g.z + 2 * g.rows + 1;
  const graves = new Set(g.slots.map((q) => q.x * 65536 + q.z));
  const cands = [];
  for (let z = g.z + 1; z < south; z++) for (let x = g.x + 1; x <= g.x + g.W - 2; x++) if (!graves.has(x * 65536 + z)) cands.push({ x, z });
  for (let z = south + 1; z <= south + 3; z++) for (let x = g.x - 1; x <= g.x + g.W; x++) cands.push({ x, z, outside: true });
  const d = (q) => Math.hypot(q.x - gx, (q.z - gz - 1) * 1.2) + (q.outside ? 1.5 : 0);
  cands.sort((a, b) => d(a) - d(b));
  const out = [{ x: gx, z: gz + 1 }];
  for (let i = cands.length - 1; i >= 0; i--) if (!ok(cands[i].x, cands[i].z)) cands.splice(i, 1);
  for (const gap of [2, 1]) {
    for (const q of cands) {
      if (out.length >= n) return out;
      if (out.some((o) => Math.max(Math.abs(o.x - q.x), Math.abs(o.z - q.z)) < gap)) continue;
      out.push(q);
    }
  }
  return out;
}

export function buildingAt(L, x, z) {
  for (const b of L.buildings) if (x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1) return b;
  return null;
}

// May a set-block op go in over `cur`? A soft op ('air': or empty ground)
// gives way to anything built there in the meantime.
function fits(cur, soft) {
  return !soft || SOFT.has(cur) || (soft === 'air' && cur === B.air);
}

export class Sim {
  constructor(game) {
    this.game = game;
    this.rep = new Map();
    this.visits = new Map(); // sid -> [visit]
    this.visitorEnts = new Map(); // visit id -> NPC entity
    this.pending = new Map(); // region key -> [[x, y, z, id, meta]]
    this.citizen = null;
    this.construction = null;
    this.saved = null; // sid -> settlement data from a save
    this.greetT = 0;
    this.tickT = 0;
    this.areaCache = new Map();
    // (Before anything that tells of the past: the old places have a part in it.)
    this.dungeons = new Dungeons(game, this);
    this.ancient = new Ancient(game, this);
    this.justice = new Justice(game, this);
    this.careers = new Careers(game, this);
    this.favors = new Favors(game, this);
    this.press = new Press(game, this);
    this.events = new Events(game, this);
    this.roads = new Roads(game, this);
    this.works = new Works(game, this);
    this.diplomacy = new Diplomacy(game, this);
    this.nomads = new Nomads(game, this);
    this.camps = new Camps(game, this);
    this.realms = new Realms(game, this);
    this.adventurers = new Adventurers(game, this);
    this.stables = new Stables(game, this);
    this.tech = new Tech(game, this);
    this.ships = new Ships(game, this);
    this.portals = new Portals(game, this);
    this.labor = new Labor(game, this);
    this.politics = new Politics(game, this);
    this.war = new War(game, this);
    this.caravans = new Caravans(game, this);
    this.outings = new Outings(game, this);
    this.customs = new Customs(game, this);
    this.history = new History(game, this);
    this.society = new Society(game, this);
    this.bandits = new Bandits(game, this);
    this.founding = new Founding(game, this);
    this.hardship = new Hardship(game, this);
    this.religion = new Religion(game, this);
    this.market = new Market(game, this);
    this.prosperity = new Prosperity(game, this);
    this.bp = null;
    this.deserted = new Set();
    this.renown = new Map(); // sid -> points for good deeds done there
    this.confront = null; // the mayor coming to have a word about your conduct
  }

  get abs() {
    return this.game.day * DAY + this.game.minute;
  }

  // The day (and moment) being lived: the real one, or the one a town's
  // catch-up has reached while you were away.
  today() {
    return this.simDay ?? this.game.day;
  }

  now() {
    return this.simNow ?? this.abs;
  }

  // ------------------------------------------------------------ layouts
  attach(L) {
    // (The town's own books can ask what its realm knows.)
    Object.defineProperty(L, 'sim', { value: this, enumerable: false, configurable: true, writable: true });
    initEcon(L);
    L.baseN = L.npcs.length;
    const sid = L.settlement.id;
    const dead = this.game.deadNpcs.get(sid);
    if (dead) for (const i of dead) if (L.npcs[i]) L.npcs[i].alive = false;
    const sv = this.saved && this.saved.get(sid);
    if (sv) this.applySettlement(L, sv);
    // (A new town keeps to what its realm knows from the first: no forge
    // lit without the know-how, and the watch armed to match.)
    else if (this.tech) this.tech.enforce(L, 0);
    if (L.econ.deserted !== undefined) L.settlement.deserted = true;
    // A village that has grown into a town (or a town into a city).
    const s0 = L.settlement;
    if (L.econ.tier && L.econ.tier !== s0.type) {
      if (!s0.baseType) s0.baseType = s0.type;
      s0.type = L.econ.tier;
    }
    // Buildings added since the town was founded come back in the order
    // they went up (your cottage, new work buildings, enlarged houses).
    const c = this.construction;
    const steps = this.works.restore(L);
    if (c && c.sid === sid && !L.buildings[c.bid]) steps.push({ bid: c.bid, player: true });
    const rank = (st) => (st.player || st.q.kind === 'build' ? 0 : 1);
    steps.sort((a, b) => a.bid - b.bid || rank(a) - rank(b));
    for (const st of steps) {
      if (!st.player) {
        this.works.applyRestore(L, st);
        continue;
      }
      const lot = L.plots[c.plot];
      if (lot) {
        lot.taken = true;
        for (const [x, z] of c.road || []) L.markRoad(x, z);
        const plot = c.rect && L.trimLot ? L.trimLot(lot, 'house_s') : lot;
        const bp = L.blueprint(plot, L.buildings.length);
        if (c.road && c.road.length && !c.done) bp.list = [...L.roadOps(c.road), ...bp.list];
        c.bid = bp.bld.id;
        bp.bld.underConstruction = !c.done;
        L.buildings.push(bp.bld);
        this.bp = { sid, bp };
        if (c.done) this.completeHouse(L, bp, true);
      }
    }
  }

  layoutOf(sid) {
    const s = this.game.world.ow.settlements[sid];
    return s ? this.game.world.getLayout(s) : null;
  }

  // Towns you've been to keep living while you're away: one at a time, a
  // day's worth at most per step, so the world moves on without a stall.
  // Places you've never been (in lands you haven't found yet) live too:
  // their plans are drawn up one every few seconds, and from then on they
  // grow, build and trade like anywhere else.
  backgroundTick() {
    const world = this.game.world;
    if (!this.allLaid) {
      this.layT = (this.layT ?? 2) - 0.5;
      if (this.layT <= 0) {
        this.layT = 2;
        const s = world.ow.settlements.find((q) => !world.layouts.has(q.id));
        if (s) world.getLayout(s);
        else this.allLaid = true;
      }
    }
    const list = [...world.layouts.values()].filter((L) => L.econ && !this.game.active.has(L.settlement.id));
    if (!list.length) return;
    this.bgI = ((this.bgI || 0) + 1) % list.length;
    const L = list[this.bgI];
    if (this.abs - L.econ.lastAbs < 60) return;
    simulateTo(this, L, Math.min(this.abs, L.econ.lastAbs + DAY));
  }

  catchUp(L) {
    simulateTo(this, L, this.abs);
  }

  update(dt) {
    this.greetT -= dt;
    this.tickT -= dt;
    if (this.tickT <= 0) {
      this.tickT = 0.5;
      for (const { layout } of this.game.active.values()) {
        simulateTo(this, layout, this.abs);
        this.syncTreasury(layout);
      }
      this.backgroundTick();
      this.updateConstruction();
      this.works.update();
      this.diplomacy.update();
      this.nomads.update();
      this.camps.update(0.5, (c) => this.campers(c));
      this.adventurers.update();
      this.dungeons.delves();
      this.dungeons.notice();
      this.caravans.update();
      this.caravans.syncEnts();
      this.ships.update();
      this.outings.update();
      this.syncVisitors();
      this.areaCache.clear();
      this.favors.update();
      this.events.update();
      this.politics.update();
      this.customs.tick();
      this.society.tick(0.5);
      this.bandits.update(0.5);
      this.founding.update();
      this.religion.update();
      this.market.update();
    }
    this.war.update(dt);
    this.careers.update(dt);
    this.updateConfront();
    this.justice.update(dt);
  }

  // ------------------------------------------------------------ treasury
  // The town hall chests hold the treasury in coin. Coins put in or taken
  // out change the treasury; the town's own spending refills or empties them.
  syncTreasury(L) {
    const list = L.treasury;
    if (!list || !list.length || L.settlement.deserted) return;
    const w = this.game.world;
    const chests = list.filter((t) => w.regionAt(t.x, t.z) && w.getBlock(t.x, t.y, t.z) === B.chest).map((t) => w.getContainer(t.x, t.y, t.z)).filter(Boolean);
    if (!chests.length) return;
    const e = L.econ;
    const count = chests.reduce((n, sl) => n + sl.reduce((m, q) => m + (q && q.item === 'coin' ? q.count : 0), 0), 0);
    if (L.chestSeen !== undefined && count !== L.chestSeen) e.treasury = Math.max(0, e.treasury + (count - L.chestSeen));
    // Don't shuffle coins around under someone's hands.
    if (this.game.ui.find && this.game.ui.find('container')) {
      L.chestSeen = count;
      return;
    }
    const want = Math.max(0, Math.floor(e.treasury));
    if (count !== want) {
      let left = want;
      chests.forEach((sl, ci) => {
        for (let i = 0; i < sl.length; i++) if (sl[i] && sl[i].item === 'coin') sl[i] = null;
        let n = ci === chests.length - 1 ? left : Math.min(left, Math.ceil(want / chests.length));
        left -= n;
        for (let i = 0; i < sl.length && n > 0; i++) {
          if (sl[i]) continue;
          const c = Math.min(999, n);
          sl[i] = { item: 'coin', count: c };
          n -= c;
        }
        left += n;
      });
      const r = w.regionAt(list[0].x, list[0].z);
      if (r) r.modified = true;
    }
    L.chestSeen = chests.reduce((n, sl) => n + sl.reduce((m, q) => m + (q && q.item === 'coin' ? q.count : 0), 0), 0);
  }

  // ------------------------------------------------------------ world edits
  // Block changes that must happen even if the region isn't loaded right now.
  // An op marked 'soft' only clears plants and tree trunks (road building).
  setBlocks(ops) {
    const w = this.game.world;
    for (const op of ops) {
      const [x, y, z, id, meta = 0, soft] = op;
      if (w.regionAt(x, z)) {
        if (fits(w.getBlock(x, y, z), soft)) w.setBlock(x, y, z, id, meta);
      } else {
        const key = w.regionKey(Math.floor(x / 64), Math.floor(z / 36));
        if (!this.pending.has(key)) this.pending.set(key, []);
        this.pending.get(key).push(soft ? [x, y, z, id, meta, soft] : [x, y, z, id, meta]);
      }
    }
  }

  applyPending(region) {
    const w = this.game.world;
    const key = w.regionKey(region.rx, region.rz);
    const ops = this.pending.get(key);
    if (!ops) return;
    this.pending.delete(key);
    for (const [x, y, z, id, meta, soft] of ops) if (fits(w.getBlock(x, y, z), soft)) w.setBlock(x, y, z, id, meta);
  }

  // ------------------------------------------------------------ reputation
  repEntry(sid, idx) {
    const k = `${sid}:${idx}`;
    let r = this.rep.get(k);
    if (!r) {
      r = { v: 0, met: false, chat: -1, gift: -1, trade: -1, tradeV: 0, insult: -1 };
      this.rep.set(k, r);
    }
    return r;
  }

  // Standing with the town as a whole: a bad name with most of the people
  // you've met, crimes on record, citizenship.
  areaMod(sid) {
    if (this.areaCache.has(sid)) return this.areaCache.get(sid);
    let met = 0;
    let bad = 0;
    for (const [k, r] of this.rep) {
      if (!r.met || !k.startsWith(`${sid}:`)) continue;
      met++;
      if (r.v < -15) bad++;
    }
    let m = 0;
    if (met >= 3 && bad * 2 > met) m -= 15;
    m -= Math.min(30, this.justice.notoriety(sid) * 6);
    if (this.isCitizen(sid)) m += 10;
    if (this.justice.exiled.has(sid)) m -= 60;
    m -= this.diplomacy.penalty(sid);
    m += Math.min(15, Math.floor((this.renown.get(sid) || 0) / 2));
    this.areaCache.set(sid, m);
    return m;
  }

  // Reputation is kept with a person's home town (a visiting merchant
  // remembers you from their own town).
  repSidOf(npc) {
    if (npc.repSid !== undefined) return npc.repSid;
    return npc.settlement ? npc.settlement.id : npc.sid;
  }

  opinion(npc) {
    const rec = npc.rec;
    const sid = this.repSidOf(npc);
    let v = this.repEntry(sid, rec.idx).v + this.areaMod(sid) + opinionBonus(this.game.hero);
    // The devout get on with priests and the pious.
    if (heroHas(this.game.hero, 'devout') && (rec.job === 'priest' || (rec.traits || []).includes('devout'))) v += 15;
    // Children don't hear what other towns' mayors write about you.
    if (rec.age === 'child') v += this.diplomacy.penalty(sid);
    const c = this.citizen;
    if (c && c.sid === sid && c.host !== null && rec.home === c.host) v += 10;
    return clamp(Math.round(v), -100, 100);
  }

  changeRep(npc, delta) {
    const sid = this.repSidOf(npc);
    const rec = npc.rec || npc;
    const r = this.repEntry(sid, rec.idx);
    if (delta > 0) delta = Math.round(delta * repGainMult(this.game.hero) * 10) / 10;
    r.v = clamp(r.v + delta, -100, 100);
    r.met = true;
    this.areaCache.delete(sid);
    const e = npc.emoteShow ? npc : rec.ent;
    if (e && !e.dead && e.emoteShow && Math.abs(delta) >= 3) e.emoteShow(delta > 0 ? '♥' : '×', delta > 0 ? '#ff80a0' : '#ff6040', 1.6);
    return r.v;
  }

  meet(npc) {
    this.repEntry(this.repSidOf(npc), npc.rec.idx).met = true;
  }

  canGreet() {
    return this.greetT <= 0;
  }

  markGreet() {
    this.greetT = 4;
  }

  isCitizen(sid) {
    return !!this.citizen && this.citizen.sid === sid;
  }

  // You count among a town's people once you're a citizen, and among its
  // watch once you're sworn in (so a town with you on the watch needn't
  // press someone else into it, and losing you costs it a citizen).
  playerCount(sid) {
    return this.isCitizen(sid) ? 1 : 0;
  }

  playerGuard(sid) {
    return this.careers && this.careers.isGuard(sid) ? 1 : 0;
  }

  // NPCs who can see what happens at (x, z): close enough, looking that
  // way (anyone right beside you notices), with no wall or closed door in
  // between. Windows and open doors let them see through.
  witnesses(sid, x, z, radius = 7, exclude = null) {
    const a = this.game.active.get(sid);
    if (!a) return [];
    // A light step: people have to be closer to notice.
    if (heroHas(this.game.hero, 'sneak')) radius = Math.max(2, Math.round(radius * 0.7));
    // (A face everyone knows.)
    if (heroHas(this.game.hero, 'notorious')) radius = Math.round(radius * 1.25);
    // It's harder to make things out in the dark.
    const m = this.game.minute;
    const dark = m < 330 || m >= 1230;
    if (dark) radius = Math.max(3, Math.round(radius * 0.6));
    return a.npcs.filter((n) => {
      if (n.dead || n.sleeping || n === exclude || n.rec.away) return false;
      const d = Math.max(Math.abs(n.x - x), Math.abs(n.z - z));
      if (d > radius) return false;
      if (!this.canSee(n, x, z)) return false;
      return this.notices(n, d, radius, x, z);
    });
  }

  // Seeing isn't noticing: close by, anyone would; further off, and when
  // they're busy with their own work or a meal, it's more of a chance. (Fixed
  // for the same person, place and minute, so looking twice doesn't help.)
  notices(n, d, radius, x, z) {
    if (d <= 2) return true;
    const act = n.activity && n.activity.entry ? n.activity.entry.act : null;
    // (The watch on duty is looking out for exactly this.)
    const guard = n.rec.job === 'guard' && (!act || act === 'work' || act === 'patrol' || act === 'guard');
    const busy = !guard && n.state === 'routine' && ['work', 'eat', 'hobby', 'play', 'forage', 'build', 'repair', 'pray', 'mourn', 'customer'].includes(act);
    let p = 1 - ((d - 2) / Math.max(1, radius - 1)) * 0.7;
    if (busy) p *= 0.6;
    if (guard) p = Math.min(1, p + 0.35);
    if (n.state !== 'routine') p = Math.min(1, p + 0.2);
    const r = (hash4(n.rec.idx, x * 31 + z, Math.floor(this.abs / 3), 0x5ee) % 1000) / 1000;
    return r < p;
  }

  canSee(n, x, z, y = null) {
    const d = Math.max(Math.abs(n.x - x), Math.abs(n.z - z));
    if (d <= 1) return true;
    const [fx, fz] = [[0, 1], [-1, 0], [0, -1], [1, 0]][n.dir || 0];
    // Roughly what's in front of them (close by, out of the corner of an
    // eye too), not behind.
    if (d > 2 && (x - n.x) * fx + (z - n.z) * fz < d * (d <= 4 ? -0.1 : 0.3)) return false;
    return this.lineOfSight(n.x, n.z, x, z, (y ?? n.y) + 1);
  }

  lineOfSight(x0, z0, x1, z1, y) {
    const w = this.game.world;
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(z1 - z0));
    for (let i = 1; i < steps; i++) {
      const x = Math.round(x0 + ((x1 - x0) * i) / steps);
      const z = Math.round(z0 + ((z1 - z0) * i) / steps);
      const id = w.getBlock(x, y, z);
      const b = BLOCKS[id];
      if (b.solid && b.opaque) return false;
      if (b.interact === 'door' && b.solid && !w.getState(x, y, z)) return false;
    }
    return true;
  }

  // ------------------------------------------------------------ gifts & chat
  giveGift(npc, item) {
    const rec = npc.rec;
    const d = ITEMS[item];
    const day = this.game.day;
    const r = this.repEntry(this.repSidOf(npc), rec.idx);
    let score = Math.min(12, 1 + d.value * 0.6);
    let reaction = 'fine';
    const hobbyItems = rec.hobbies.map((h) => ({ reading: 'book', fishing: 'fishing_rod', music: 'lute', praying: 'prayer_beads', smoking: 'pipe', dice: 'dice', sketching: 'sketchbook', gardening: 'seeds' }[h])).filter(Boolean);
    if (d.kind === 'food' && rec.hungry >= 1) {
      score += 10;
      reaction = 'hungry';
    } else if (hobbyItems.includes(item)) {
      score += 8;
      reaction = 'hobby';
    } else if (item.startsWith('flower_') || item === 'gem' || item === 'gold_ingot' || d.quality === 'delightful' || item === 'pie') {
      score += 5;
      reaction = 'love';
    } else if (['stick', 'dirt', 'cobblestone', 'bone', 'slime_gel', 'gravel', 'sand'].includes(item) || d.quality === 'terrible') {
      score = -2;
      reaction = 'junk';
    }
    if (item === 'coin') {
      score = 3;
      reaction = 'coin';
    }
    if (r.gift === day && score > 0) score *= 0.35;
    r.gift = day;
    const gained = this.changeRep(npc, Math.round(score));
    // The gift goes into their inventory (food gets eaten when needed).
    if (item === 'coin') rec.coins += 1;
    else invAdd(rec.inv, item, 1);
    if (d.kind === 'food' && rec.hungry >= 1) {
      invTake(rec.inv, item, 1);
      rec.fed++;
      rec.hungry = 0;
    }
    return { reaction, score, rep: gained };
  }

  chat(npc, kind) {
    const r = this.repEntry(this.repSidOf(npc), npc.rec.idx);
    const day = this.game.day;
    const p = npc.rec.personality;
    if (kind === 'kind') {
      if (r.chat === day) return 0;
      r.chat = day;
      const d = Math.round(2 + p.sociability * 3 + p.kindness * 2);
      this.changeRep(npc, d);
      return d;
    }
    if (kind === 'rude') {
      const d = -Math.round(6 + p.temper * 6);
      r.insult = day;
      this.changeRep(npc, d);
      return d;
    }
    return 0;
  }

  // Good trades build goodwill (a little per coin spent, capped per day).
  noteTrade(npc, coins) {
    const r = this.repEntry(this.repSidOf(npc), npc.rec.idx);
    const day = this.game.day;
    if (r.trade !== day) {
      r.trade = day;
      r.tradeV = 0;
    }
    const before = Math.floor(r.tradeV / 15);
    r.tradeV += coins;
    const after = Math.min(5, Math.floor(r.tradeV / 15));
    if (after > before) this.changeRep(npc, after - before);
    r.met = true;
  }

  // Who a camp belongs to (to put it up, they have to be there).
  campers(c) {
    const id = c.key.slice(2);
    if (c.key[0] === 'n') return (this.nomads.bands.find((b) => String(b.id) === id) || {}).ents || [];
    if (c.key[0] === 'a') {
      const a = this.adventurers.ents.get(Number(id));
      return a ? [a] : [];
    }
    if (c.key[0] === 'c') return [...this.caravans.ents].filter(([k]) => k.startsWith(`${id}:`)).map(([, e]) => e);
    const e = this.visitorEnts.get(id);
    return e ? [e] : [];
  }

  // ------------------------------------------------------------ shopping
  // Someone reached the counter: they ask for what they came for, the
  // shopkeeper names the price, and it's theirs.
  shopArrive(npc) {
    const L = npc.layout;
    const rec = npc.rec;
    const o = rec.override;
    const r = buyAt(L, rec, o, this.game.day);
    rec.override = null;
    npc.activity = null;
    const keeper = o.seller !== undefined ? L.npcs[o.seller] : L.npcs.find((q) => alive(q) && q.work && q.work.building === o.building && q.ent && !q.ent.dead && q.ent.distTo(npc) < 10);
    if (!r || r.none) {
      npc.say(npc.rng.pick(['None left? Never mind.', 'Sold out, is it? Another day, then.']), 3);
      return r;
    }
    const name = (ITEMS[r.item]?.name || r.item).toLowerCase();
    if (r.poor) {
      npc.say(npc.rng.pick([`How much? I'll come back for the ${name}.`, 'Ah. A bit dear for me today.']), 3);
      return r;
    }
    // At the herbalist's for their hurts: tended to, not just sold a jar.
    const b = L.buildings[o.building];
    if (o.need === 'remedy' && b && b.type === 'herbalist') {
      npc.say(npc.rng.pick(['Something for this, please. It\'s been getting worse.', 'Can you look at this for me?', 'I\'ve not been well...']), 3);
      npc.hp = npc.maxHp;
      this.game.renderer.emit(npc.x, npc.y + 1, npc.z, { n: 8, color: ['#60e080', '#c0ffc0'], up: 20, life: 0.8, gravity: -12 });
      if (keeper && keeper.ent && !keeper.ent.dead) {
        keeper.ent.face(npc.x, npc.z);
        keeper.ent.doAction?.(0.4);
        keeper.ent.sayLater?.(keeper.ent.rng.pick([`Hold still, this'll sting. There: ¤${r.cost}.`, `Rub this in twice a day. ¤${r.cost}.`, `You'll mend. That's ¤${r.cost}.`]), 1.2, 3.5);
      }
      return r;
    }
    npc.say(npc.rng.pick([`A ${name}, please.`, `I'll take the ${name}.`, `One ${name} for me, please.`, `I need a new ${name}.`]), 3);
    npc.emoteShow?.('¤', '#ffe070', 2);
    if (keeper && keeper.ent && !keeper.ent.dead) {
      const k = keeper.ent;
      // Coin over the counter one way, the goods the other.
      if (npc.distTo(this.game.player) < 22) {
        npc.doAction?.(0.3);
        k.doAction?.(0.3);
        this.game.renderer.toss?.({ from: { x: npc.x, y: npc.y, z: npc.z, oy: -8 }, to: { x: k.x, y: k.y, z: k.z, oy: -8 }, kind: 'coin', dur: 0.45, rest: 0, h: 10 });
        this.game.renderer.toss?.({ from: { x: k.x, y: k.y, z: k.z, oy: -8 }, to: { x: npc.x, y: npc.y, z: npc.z, oy: -8 }, kind: 'item', item: r.item, dur: 0.6, rest: 0, h: 8 });
        this.game.audio?.play('coin', npc);
      }
      k.face(npc.x, npc.z);
      k.sayLater?.(k.rng.pick([`That's ¤${r.cost}. Thank you kindly!`, `¤${r.cost}, please. Mind how you go.`, `There you are. ¤${r.cost}.`]), 1.2, 3);
    }
    return r;
  }

  // A merchant's display piece taken (stolen): one fewer in their stock.
  displayTaken(d, item, n = 1) {
    if (!d) return;
    let store = null;
    if (d.visit !== undefined) {
      const v = (this.visits.get(d.sid) || []).find((q) => q.id === d.visit);
      store = v ? v.goods : null;
    } else if (d.bid !== undefined) {
      const L = this.layoutOf(d.sid);
      store = L && L.econ && L.econ.biz[d.bid] ? L.econ.biz[d.bid].store : null;
    }
    if (store) st.take(store, item, Math.min(n, st.count(store, item)));
  }

  // ------------------------------------------------------------ trading
  // The shelf an NPC sells from and the purse they pay with.
  shopOf(npc) {
    const rec = npc.rec;
    const L = npc.layout;
    const e = L.econ;
    // A merchant met on the road sells from the pack they're carrying.
    if (npc.caravan && rec.trip && rec.trip.goods) {
      return { store: rec.trip.goods, purse: { get: () => rec.coins, add: (n) => { rec.coins += n; } }, kind: 'general', wants: null };
    }
    // A trading company sells from its wagons.
    if (rec.caravanTrader !== undefined) {
      const g = this.caravans.get(rec.caravanTrader);
      return g ? this.caravans.shop(g) : null;
    }
    // An adventurer trades from their pack.
    if (rec.adventurer !== undefined) {
      const a = this.adventurers.get(rec.adventurer);
      return a ? this.adventurers.shop(a) : null;
    }
    if (npc.visit || rec.visitor) {
      const v = npc.visit || rec.visit;
      return { store: v.goods, purse: { get: () => v.coins, add: (n) => { v.coins += n; } }, kind: 'general', wants: null };
    }
    const t = rec.job === 'cook' || rec.job === 'innkeeper' || rec.job === 'barkeep' ? (rec.job === 'cook' ? 'cook' : 'inn') : JOBS_TRADER(rec);
    if (!t) return null;
    let biz = rec.work && rec.work.building != null ? e.biz[rec.work.building] : null;
    if (t === 'cook' || t === 'inn') biz = kitchenOf(L) || biz;
    if (biz) return { store: biz.store, purse: { get: () => biz.till + rec.coins, add: (n) => { if (n >= 0) biz.till += n; else { const fromTill = Math.min(biz.till, -n); biz.till -= fromTill; rec.coins -= -n - fromTill; } } }, kind: t };
    // Farmers, fishers and trappers sell from their own pack.
    if (!rec.stall) rec.stall = {};
    for (const it of rec.inv) {
      st.add(rec.stall, it.item, it.count);
    }
    rec.inv.length = 0;
    return { store: rec.stall, purse: { get: () => rec.coins, add: (n) => { rec.coins += n; } }, kind: t, personal: true };
  }

  // Put a personal stall back into the NPC's pack when trading ends.
  closeShop(npc) {
    const rec = npc.rec;
    if (!rec.stall) return;
    for (const [k, n] of Object.entries(rec.stall)) invAdd(rec.inv, k, n);
    rec.stall = null;
  }

  // Price multipliers for the player: town prosperity, the trader's
  // temperament, sales tax, their opinion of you and citizenship.
  priceFactor(npc) {
    const p = this.priceParts(npc);
    return p.base * p.discount;
  }

  // The asking price before discounts, and the discounts you get.
  priceParts(npc) {
    const rec = npc.rec;
    const s = npc.settlement;
    const e = npc.layout.econ;
    const cond = s.condition;
    let m = cond === 'prosperous' ? 1.5 : cond === 'poor' ? 1.2 : 1.35;
    m *= rec.personality.kindness > 0.7 ? 0.92 : rec.personality.kindness < 0.3 ? 1.15 : 1;
    const tr = rec.traits || [];
    m *= tr.includes('generous') ? 0.95 : tr.includes('stingy') || tr.includes('shrewd') ? 1.06 : 1;
    m *= 1 + (e ? e.tax * 0.5 : 0);
    m *= priceMult(this.game.hero);
    // Laws: outsiders pay the tariff; an open market takes a little off.
    if (lawOn(npc.layout, 'tariff') && !this.isCitizen(s.id)) m *= 1.1;
    if (lawOn(npc.layout, 'openMarket')) m *= 0.95;
    // (Guild monopolies: the guilds set the prices.)
    if (this.tech.has(s, 'monopolies')) m *= 1.1;
    // A citizen of another realm: its tariff, and how the realms get on.
    const home = this.citizen ? this.game.world.ow.settlements[this.citizen.sid] : null;
    if (home && home.civ && s.civ && home.civ !== s.civ) {
      if (this.realms.tariffOn(s, home)) m *= 1.1;
      const st = this.realms.standing(s.civ, home.civ);
      m *= st === 'hostile' ? 1.1 : st === 'friendly' ? 0.97 : 1;
    }
    const op = this.opinion(npc);
    if (op <= -25) m *= 1.25;
    let d = 1;
    const reasons = [];
    if (op >= 35) {
      d *= 0.9;
      reasons.push('friend');
    }
    if (this.isCitizen(s.id)) {
      d *= 0.92;
      reasons.push('citizen');
    }
    // One traveller to another (you're no one's citizen): a better deal.
    if (rec.adventurer !== undefined && !this.citizen) {
      d *= 0.9;
      reasons.push('fellow traveller');
    }
    const staff = this.careers.discount(npc);
    if (staff < 1) {
      d *= staff;
      reasons.push('staff');
    }
    return { base: m, discount: d, reasons };
  }

  // What a trader pays you for an item. A licensed professional's premium
  // always shows, even on cheap goods where rounding would swallow it.
  // Fewer coins the more of it they already have (0: they won't take any
  // more), unless it's what their trade runs on.
  sellPrice(npc, k) {
    const op = this.opinion(npc);
    const sh = this.shopOf(npc);
    const glut = sh ? glutFactor(sh.kind, k, sh.store[k] || 0) : 1;
    if (glut <= 0) return 0;
    const raw = (ITEMS[k]?.value || 0) * 0.5 * (op >= 35 ? 1.15 : op <= -25 ? 0.8 : 1) / priceMult(this.game.hero) * glut * this.market.factor(npc.layout, k);
    const normal = Math.max(k === 'coin' ? 0 : 1, Math.floor(raw));
    const lic = this.careers.sellFactor(npc, k);
    return lic > 1 ? Math.max(normal + 1, Math.round(raw * lic)) : normal;
  }

  // What a trader asks for an item: their prices, and the market's.
  buyPrice(npc, k, discounted = true) {
    const f = discounted ? this.priceFactor(npc) : this.priceParts(npc).base;
    return Math.max(1, Math.round((ITEMS[k]?.value || 0) * f * this.market.factor(npc.layout, k)));
  }

  // How keen they are to take more of something (1 = full price).
  sellGlut(npc, k) {
    const sh = this.shopOf(npc);
    return sh ? glutFactor(sh.kind, k, sh.store[k] || 0) : 1;
  }

  // ------------------------------------------------------------ deaths
  recordDeath(L, rec, cause, killer, when = null) {
    if (!alive(rec)) return null;
    // A merchant of another realm killed here by one of the realm's own
    // citizens (you, if you are one): their realm takes it badly.
    const v0 = rec.visit;
    const mine = this.citizen && this.game.world.ow.settlements[this.citizen.sid]?.civ === L.settlement.civ;
    if (v0 && v0.from !== undefined && killer === 'player' && mine) this.realms.merchantHarmed(L.settlement, this.game.world.ow.settlements[v0.from], 'killed', when ?? this.game.day);
    if (rec.visitor) {
      rec.alive = false;
      for (const [sid, list] of this.visits) this.visits.set(sid, list.filter((v) => v !== rec.visit));
      return null;
    }
    // A traveling merchant who dies away from home is buried at home.
    if (rec.visit) {
      for (const [sid, list] of this.visits) this.visits.set(sid, list.filter((v) => v !== rec.visit));
      rec.visit = null;
      rec.away = false;
      rec.trip = { phase: 'home', since: this.game.day };
    }
    const game = this.game;
    const s = L.settlement;
    // (a death caught up from while you were away keeps its own date)
    const day = when ?? game.day;
    const rng = new RNG(hash4(s.seed, rec.idx, day, 0xdea7));
    rec.alive = false;
    rec.deathDay = day;
    rec.cause = cause;
    rec.override = null;
    if (!game.deadNpcs.has(s.id)) game.deadNpcs.set(s.id, new Set());
    game.deadNpcs.get(s.id).add(rec.idx);
    const ent = rec.ent;
    if (ent && !ent.dead) {
      // A quiet passing (old age, illness): they simply aren't there any more.
      ent.releaseSpot();
      game.removeOcc(ent);
      ent.dead = true;
      game.npcs = game.npcs.filter((n) => n !== ent);
      const a = game.active.get(s.id);
      if (a) a.npcs = a.npcs.filter((n) => n !== ent);
    }
    rec.ent = null;
    // Their savings pass to the family (or the town).
    const heirs = [rec.partner, ...rec.children].map((i) => (i === null || i === undefined ? null : L.npcs[i])).filter((r) => r && alive(r));
    if (heirs.length) {
      const each = Math.floor(rec.coins / heirs.length);
      for (const h of heirs) h.coins += each;
    } else L.econ.treasury += rec.coins;
    rec.coins = 0;
    // The grave is dug and the stone set by one of the family a little
    // while later (a friend, or the priest, if there's no one else).
    const slot = this.addGrave(L, rec, cause, day, false);
    const name = `${rec.name.first} ${rec.name.last}`;
    if (slot) this.scheduleBurial(L, rec, slot, day, name);
    const fam = new Set([rec.partner, ...rec.children, ...rec.parents].filter((i) => i !== null && i !== undefined));
    const mourners = [];
    for (const o of L.npcs) {
      if (!alive(o) || o === rec) continue;
      let rel = null;
      if (fam.has(o.idx) || o.household === rec.household) rel = 'family';
      else if ((rec.friends || []).includes(o.idx)) rel = 'friend';
      else if (o.work && rec.work && o.work.building != null && o.work.building === rec.work.building) rel = 'acquaintance';
      if (!rel) continue;
      o.grief = o.grief || [];
      o.grief.push({ idx: rec.idx, name, first: rec.name.first, rel, until: day + (rel === 'family' ? 5 : rel === 'friend' ? 3 : 1), slot: slot ? { x: slot.x, z: slot.z } : null, cause, byPlayer: killer === 'player' });
      o.mood = clamp(o.mood - (rel === 'family' ? 0.35 : rel === 'friend' ? 0.2 : 0.08), 0, 1);
      if (slot && rel !== 'acquaintance' && !o.away) mourners.push({ idx: o.idx, x: slot.x, z: slot.z + 1 });
    }
    // Room to stand: the priest at the foot of the grave, everyone else a
    // pace apart along the paths and out past the gate.
    if (slot) {
      const w = this.game.world;
      const open = (x, z) => !w.regionAt(x, z) || w.findStandY(x, z, GROUND) === GROUND;
      const spots = funeralSpots(L, slot.x, slot.z, mourners.length + 1, open);
      mourners.forEach((m, i) => {
        const q = spots[i + 1] || spots[spots.length - 1];
        m.x = q.x;
        m.z = q.z;
      });
    }
    const priest = L.npcs.find((r) => r.job === 'priest' && alive(r) && !r.away);
    // The funeral: family and friends gather at the grave the next
    // afternoon (the priest, if there is one, says the words).
    if (slot) {
      const f = { name, first: rec.name.first, x: slot.x, z: slot.z, s: (day + 1) * DAY + 960, e: (day + 1) * DAY + 1020, mourners, priest: priest ? priest.idx : null };
      (L.econ.funerals ||= []).push(f);
      L.econ.funerals = L.econ.funerals.filter((q) => q.e > this.abs - DAY);
    }
    L.econ.recent.deaths++;
    ledger(L, day, `${name}, ${jobTitle(rec, s).toLowerCase()}, died (${cause}).${slot ? ' The funeral is tomorrow at 16:00, by the graveyard.' : ''}`);
    if (rec.job === 'mayor') ledger(L, day, 'The council will govern until a new leader is chosen.');
    if (this.citizen && this.citizen.sid === s.id && this.citizen.host === rec.home) {
      // Hosting continues with the rest of the family, if any remain.
      if (!L.npcs.some((r) => r.home === rec.home && alive(r))) this.citizen.host = null;
    }
    void rng;
    return slot;
  }

  // Who carries the stone out: family first, then a friend, the priest,
  // or anyone grown up.
  scheduleBurial(L, rec, slot, day, name) {
    const ok = (r) => r && alive(r) && !r.away && r.age !== 'child' && r !== rec;
    const fam = [rec.partner, ...rec.children, ...rec.parents].map((i) => (i === null || i === undefined ? null : L.npcs[i]));
    const bearer = fam.find(ok) || L.npcs.find((r) => ok(r) && r.household === rec.household) || (rec.friends || []).map((i) => L.npcs[i]).find(ok)
      || L.npcs.find((r) => ok(r) && r.job === 'priest') || L.npcs.find(ok);
    const now = this.abs;
    const hod = ((now % DAY) + DAY) % DAY;
    // Not in the dead of night: first thing in the morning instead.
    const due = hod >= 1260 || hod < 360 ? Math.floor((now + (hod >= 1260 ? DAY : 0)) / DAY) * DAY + 420 : now + 90 + Math.floor(Math.random() * 90);
    const b = { name, x: slot.x, z: slot.z, due, bearer: bearer ? bearer.idx : null, done: false };
    (L.econ.burials ||= []).push(b);
    if (bearer) setOverride(bearer, due, due + 90, 'bury', { target: { x: slot.x, z: slot.z + 1 }, who: name, grave: { x: slot.x, z: slot.z } });
    return b;
  }

  // The stone goes in.
  placeGrave(L, x, z, by = null) {
    const g = L.graveyard;
    const slot = g && g.slots.find((q) => q.x === x && q.z === z);
    const b = (L.econ.burials || []).find((q) => q.x === x && q.z === z && !q.done);
    if (!slot || !slot.grave || !b) return false;
    b.done = true;
    delete slot.grave.pending;
    this.setBlocks([[slot.x, g.y, slot.z, B.gravestone, 0]]);
    ledger(L, this.simDay ?? this.game.day, `${by ? `${by.name.first} ${by.name.last}` : 'The family'} set a stone on ${b.name}'s grave.`);
    L.econ.burials = L.econ.burials.filter((q) => !q.done);
    return true;
  }

  // An hour before the funeral its guests' afternoon is kept free
  // (anything else booked for them is put off); and the stones go in even if
  // nobody could carry them.
  gatherFuneral(L, f) {
    const set = (r, extra) => {
      if (!r || !alive(r) || r.away) return;
      setOverride(r, f.s - (extra.officiant ? 10 : 0), f.e + (extra.officiant ? 5 : 0), 'funeral', { who: f.name, ...extra });
      if (r.ent) r.ent.activity = null;
    };
    for (const m of f.mourners) set(L.npcs[m.idx], { target: { x: m.x, z: m.z ?? f.z + 1 } });
    if (f.priest !== null && f.priest !== undefined) set(L.npcs[f.priest], { target: { x: f.x, z: f.z + 1 }, officiant: true });
  }

  // The badly hurt go to the temple to pray and be blessed (by day).
  woundedPray(L, h, hod) {
    if (hod < 7 || hod >= 20 || !this.game.active.has(L.settlement.id)) return;
    const temple = L.buildings.find((b) => b.type === 'temple');
    if (!temple) return;
    for (const r of L.npcs) {
      if (!alive(r) || r.away || r.override || r.job === 'guard' && r.ent && r.ent.state === 'fight') continue;
      const hp = r.ent && !r.ent.dead ? r.ent.hp : r.hp ?? r.maxHp;
      if (hp >= (r.maxHp || 12) * 0.6) continue;
      setOverride(r, h, h + 90, 'pray', { place: 'temple', target: temple.inside });
      if (r.ent) r.ent.activity = null;
    }
  }

  funeralsAndBurials(L) {
    const now = this.simNow ?? this.abs;
    for (const b of L.econ.burials || []) if (!b.done && now > b.due + 150) this.placeGrave(L, b.x, b.z);
    for (const f of L.econ.funerals || []) {
      if (now < f.s - 60 || now > f.e) continue;
      // Anyone whose plans got changed since is put back on the list.
      for (const m of f.mourners) {
        const r = L.npcs[m.idx];
        if (r && alive(r) && !r.away && (!r.override || r.override.act !== 'funeral')) this.gatherFuneral(L, { ...f, mourners: [m], priest: null });
      }
      const p = f.priest !== null && f.priest !== undefined ? L.npcs[f.priest] : null;
      if (p && alive(p) && (!p.override || p.override.act !== 'funeral')) this.gatherFuneral(L, { ...f, mourners: [] });
    }
  }

  addGrave(L, rec, cause, day, place = true) {
    const g = L.graveyard;
    if (!g) return null;
    let slot = g.slots.find((q) => q.row < g.rows && !q.grave);
    if (!slot && g.rows < g.maxRows) {
      const prev = g.rows;
      g.rows++;
      this.setBlocks(graveyardFence(g, prev).map(([x, z, id]) => [x, g.y, z, id, 0]));
      ledger(L, day, 'The graveyard was extended to make room for the dead.');
      slot = g.slots.find((q) => q.row < g.rows && !q.grave);
    }
    if (!slot) return null;
    slot.grave = { name: `${rec.name.first} ${rec.name.last}`, title: jobTitle(rec, L.settlement), died: day, cause, idx: rec.idx, epitaph: epitaphFor(rec, L) };
    if (place) this.setBlocks([[slot.x, g.y, slot.z, B.gravestone, 0]]);
    else slot.grave.pending = true;
    return slot;
  }

  graveText(x, z) {
    const w = this.game.world;
    for (const s of w.ow.settlementsNear(x, z)) {
      const L = w.layouts.get(s.id);
      const g = L && L.graveyard;
      if (!g) continue;
      const slot = g.slots.find((q) => q.x === x && q.z === z);
      if (!slot || !slot.grave) continue;
      const gr = slot.grave;
      if (gr.ancestor) return [`HERE LIES ${gr.name.toUpperCase()}`, `One of the first of ${s.name}.`, '', `"${gr.epitaph}"`];
      return [`HERE LIES ${gr.name.toUpperCase()}`, `${gr.title} of ${s.name}`, `Died on day ${gr.died} (${gr.cause})`, '', `"${gr.epitaph}"`];
    }
    return ['A weathered gravestone.', 'The name has worn away.'];
  }

  // The town's name signs by the roads in: one that's gone (built over, or
  // knocked down) is put back, or set up again beside the road nearby.
  checkTownSigns(L) {
    if (L.settlement.deserted || !L.signSpot) return;
    const w = this.game.world;
    const clear = (x, z) => w.regionAt(x, z) && w.getBlock(x, GROUND, z) === B.air && w.getBlock(x, GROUND + 1, z) === B.air && BLOCKS[w.getBlock(x, GROUND - 1, z)].standable;
    const list = L.signs.filter((q) => q.kind === 'entrance');
    for (const pt of L.entrances) if (!list.some((q) => q.at && q.at.x === pt.x && q.at.z === pt.z) && !list.length) list.push({ kind: 'entrance', at: { x: pt.x, z: pt.z }, fresh: true });
    for (const sg of list) {
      if (!sg.fresh && !w.regionAt(sg.x, sg.z)) continue;
      if (!sg.fresh && w.getBlock(sg.x, GROUND, sg.z) === B.sign) continue;
      const at = sg.at || { x: sg.x, z: sg.z };
      // Already one nearby (moved there before)? That's it.
      let found = null;
      for (let dz = -3; dz <= 3 && !found; dz++) for (let dx = -3; dx <= 3 && !found; dx++) if (w.regionAt(at.x + dx, at.z + dz) && w.getBlock(at.x + dx, GROUND, at.z + dz) === B.sign && !L.signs.some((q) => q !== sg && q.x === at.x + dx && q.z === at.z + dz)) found = { x: at.x + dx, z: at.z + dz };
      if (!found) {
        const t = !sg.fresh && clear(sg.x, sg.z) ? { x: sg.x, z: sg.z } : L.signSpot(at, clear);
        if (!t) continue;
        this.setBlocks([[t.x, GROUND, t.z, B.sign, 0]]);
        found = t;
      }
      Object.assign(sg, { x: found.x, y: GROUND, z: found.z, at });
      if (sg.fresh) {
        delete sg.fresh;
        L.signs.push(sg);
      }
    }
  }

  // ------------------------------------------------------------ daily hooks
  dailySocial(L, day, rng) {
    for (const rec of L.npcs) {
      if (!alive(rec) || rec.away) continue;
      rec.grief = (rec.grief || []).filter((g) => g.until >= day);
      const g = rec.grief.find((q) => q.rel !== 'acquaintance' && q.slot);
      if (!g || (rec.override && rec.override.e > day * DAY)) continue;
      if (!rng.chance(g.rel === 'family' ? 0.9 : 0.5)) continue;
      const slot = freeSlot(rec, day, 600, 50);
      if (slot) setOverride(rec, slot.s, slot.e, 'mourn', { target: { x: g.slot.x, z: g.slot.z + 1 }, who: g.name });
    }
  }

  dailyCivic(L, day, rng) {
    this.simDay = day;
    this.simNow = Math.min(this.abs, day * DAY + 600);
    try {
      this.civicDay(L, day, rng);
      // Building work in a town caught up from afar moves on with its days
      // (and what gets finished is noted on the day it was).
      this.works.catchUp(L, Math.min(this.abs, (day + 1) * DAY));
    } finally {
      this.simDay = null;
      this.simNow = null;
    }
  }

  civicDay(L, day, rng) {
    this.history.daily(L, day);
    this.society.daily(L, day);
    this.prosperity.daily(L, day);
    if (this.game.active.has(L.settlement.id)) this.checkTownSigns(L);
    // Stale news from afar comes down off the board.
    if (L.econ.rumours) L.econ.rumours = freshRumours(L.econ, this.now());
    // New streets and lots, and whatever's been waiting for one.
    this.roads.daily(L, day);
    checkWatch(this, L, day, rng);
    checkSupply(this, L, day);
    checkHousing(this, L, day);
    births(this, L, day, rng);
    aging(this, L, day);
    electMayor(this, L, day);
    weddings(this, L, day, rng);
    comingOfAge(this, L, day);
    raids(this, L, day, rng);
    this.hardship.daily(L, day);
    this.realms.daily(L, day, rng);
    this.diplomacy.consider(L, day, rng);
    this.nomads.arrive(L, day, rng);
    this.familyExpansions(L, day, rng);
    this.stables.daily(L, day, rng);
    this.tech.daily(L, day, rng);
    this.ancient.townDay(L, day, rng);
    this.ships.daily(L, day, rng);
    this.portals.daily(L, day);
    this.labor.daily(L, day, rng);
    this.politics.townDay(L, day, rng);
    this.war.townDay(L, day, rng);
    this.outings.daily(L, day);
    growth(this, L, day);
    this.works.daily(L, day);
    this.checkConduct(L, day);
    const c = this.construction;
    if (c && !c.done && c.sid === L.settlement.id) this.assignBuilders(L, day, day * DAY + 600);
    const z = this.citizen;
    if (z && z.sid === L.settlement.id && z.taxDay !== day) {
      z.taxDay = day;
      const p = this.game.player;
      // A small head tax, plus the town's rate on what you earned there.
      const earned = z.earned || 0;
      z.earned = 0;
      const { tax, poll, share } = this.playerTax(L, earned);
      if (countItem(p.inv, 'coin') >= tax) {
        removeItem(p.inv, 'coin', tax);
        L.econ.treasury += tax;
        L.econ.taxY = (L.econ.taxY || 0) + tax;
        z.owed = 0;
        z.lastTax = { day, tax, poll, share, earned, rate: L.econ.tax };
        this.game.ui.msg(`Paid ¤${tax} in taxes to ${L.settlement.name}${share ? ` (${Math.round(L.econ.tax * 100)}% of your ¤${earned} earnings, plus ¤${poll})` : ''}.`, '#e8e0a0');
      } else {
        z.owed = (z.owed || 0) + 1;
        this.game.ui.msg(`You couldn't pay your taxes to ${L.settlement.name}!`, '#ff9060');
        if (z.owed >= 3) this.revoke('unpaid taxes');
      }
    }
  }

  // What a citizen owes each day: a head tax that rises with the rate, and
  // the rate itself on yesterday's earnings in the town.
  playerTax(L, earned) {
    const rate = L.econ.tax;
    const poll = Math.max(1, Math.round(10 * rate));
    const share = Math.floor(earned * rate);
    return { tax: poll + share, poll, share };
  }

  hourly(L, h, day, hod, rng) {
    // The builders are told where they're needed first thing.
    if (hod === 6) this.works.daily(L, day);
    this.funeralsAndBurials(L);
    this.events.hourly(L, h + 60);
    this.woundedPray(L, h, hod);
    this.outings.hourly(L, h, day);
    // Snares near an active town catch things now and then.
    if (!this.game.active.has(L.settlement.id)) return;
    const w = this.game.world;
    const traps = L.spotsByTag('trap').map((sp) => sp.trap).filter(Boolean);
    for (const r of L.npcs) if (r.snares) traps.push(...r.snares);
    for (const t of traps) {
      if (!w.regionAt(t.x, t.z)) continue;
      if (w.getBlock(t.x, t.y, t.z) === B.snare && !w.getState(t.x, t.y, t.z) && rng.chance(0.25)) w.setState(t.x, t.y, t.z, true);
    }
    void h;
    void day;
    void hod;
  }

  // A miner sells ore and coal to the smithy.
  sellOre(L, rec) {
    const smithy = L.buildings.find((b) => b.type === 'smithy' && L.econ.biz[b.id]);
    if (!smithy) return 0;
    const biz = L.econ.biz[smithy.id];
    let sold = 0;
    for (const it of [...rec.inv]) {
      if (!['iron_ore', 'coal', 'gold_ore'].includes(it.item)) continue;
      for (let i = 0; i < it.count; i++) {
        const pr = price(it.item);
        if (biz.till < pr + 3) break;
        biz.till -= pr;
        rec.coins += pr;
        rec.earned += pr;
        invTake(rec.inv, it.item, 1);
        st.add(biz.store, it.item, 1);
        sold++;
      }
    }
    return sold;
  }

  // A miner going out to the rock face takes a guard along if the watch
  // can spare one (more than three guards in town).
  escortMiner(n, act) {
    const L = n.layout;
    const guards = L.npcs.filter((r) => r.job === 'guard' && alive(r) && !r.away);
    if (guards.length <= 3) return null;
    if (guards.some((r) => r.override && r.override.act === 'watch' && r.override.ward === n.rec.idx)) return null;
    const free = guards.filter((r) => r.ent && !r.ent.dead && r.ent.state === 'routine' && !r.ent.sleeping && !r.override && r.shift !== 'night');
    if (!free.length) return null;
    const now = this.abs;
    void act;
    free.sort((a, b) => a.ent.distTo(n) - b.ent.distTo(n));
    const g = free[0];
    // Until the miner stops work (the guard checks) or eight hours at most.
    setOverride(g, now, now + 480, 'watch', { target: { x: n.goal.x, z: n.goal.z }, place: 'wild', ward: n.rec.idx });
    g.ent.activity = null;
    if (g.ent.distTo(this.game.player) < 20) g.ent.say(`I'll keep watch while you dig, ${n.rec.name.first}.`, 3);
    return g;
  }

  // A trapper or fisher drops off their catch at the tavern kitchen.
  sellCatch(L, rec) {
    const k = kitchenOf(L);
    if (!k) return 0;
    let sold = 0;
    for (const it of [...rec.inv]) {
      if (!['raw_meat', 'fish', 'leather', 'carrot', 'cabbage', 'wheat'].includes(it.item) || it.item === 'leather') continue;
      const n = Math.max(0, it.count - 1);
      for (let i = 0; i < n; i++) {
        const pr = price(it.item);
        if (k.till < pr + 5) break;
        k.till -= pr;
        rec.coins += pr;
        rec.earned += pr;
        invTake(rec.inv, it.item, 1);
        st.add(k.store, it.item, 1);
        sold++;
      }
    }
    return sold;
  }

  // ------------------------------------------------------------ citizenship
  joinTerms(mayor) {
    const L = mayor.layout;
    const s = L.settlement;
    const fee = { village: 15, town: 40, city: 80 }[s.type] || 30;
    const op = this.opinion(mayor);
    if (this.justice.exiled.has(s.id)) return { ok: false, reason: 'exiled' };
    if (this.justice.pendingIn(s.id).length || this.game.isWanted(s.id)) return { ok: false, reason: 'crimes' };
    if (op < -10) return { ok: false, reason: 'distrust' };
    if (this.isCitizen(s.id)) return { ok: false, reason: 'already' };
    return { ok: true, fee: op >= 40 ? 0 : fee, plot: this.works.freePlot(L) };
  }

  join(mayor) {
    const L = mayor.layout;
    const s = L.settlement;
    const t = this.joinTerms(mayor);
    if (!t.ok) return t;
    const p = this.game.player;
    if (countItem(p.inv, 'coin') < t.fee) return { ok: false, reason: 'money', fee: t.fee };
    if (t.fee) removeItem(p.inv, 'coin', t.fee);
    L.econ.treasury += t.fee;
    if (this.citizen) this.revoke('moved', true);
    const host = this.pickHost(L);
    const day = this.game.day;
    this.citizen = { sid: s.id, since: day, host: host ? host.house.id : null, hostBed: host ? host.bed : null, home: null, taxDay: day, owed: 0 };
    if (host) for (const r of L.npcs) if (r.home === host.house.id && alive(r)) this.changeRep(r.ent || { rec: r, settlement: s }, 6);
    this.changeRep(mayor, 5);
    ledger(L, day, `${this.game.playerName} became a citizen of ${s.name}.`);
    if (t.plot) this.buildHome(L, t.plot);
    else this.roads.enqueue(L, { kind: 'home', type: 'house_s' });
    return { ok: true, fee: t.fee, host, plot: t.plot, queued: !t.plot };
  }

  // A lot came free for the home you're waiting on.
  startHome(L) {
    const c = this.citizen;
    const k = this.construction;
    if (!c || c.sid !== L.settlement.id || (c.home !== null && c.home !== undefined) || (k && k.sid === c.sid && !k.done && !k.cancelled)) return null;
    const plot = this.works.freePlot(L);
    if (!plot) return null;
    const b = this.buildHome(L, plot);
    this.game.ui.msg(`A lot is free in ${L.settlement.name}: the builders have started on your home.`, '#ffe070');
    return b;
  }

  // The builders put up a cottage of your own on a lot: the road to its door
  // first (if it hasn't one), then the house.
  buildHome(L, plot) {
    const s = L.settlement;
    const day = this.game.day;
    plot.taken = true;
    L.signs = L.signs.filter((q) => !(q.kind === 'plot' && q.plot === plot.id));
    const road = L.roadTo(plot);
    // A cottage its own size on the lot (the rest is yard, room to grow).
    const rect = L.trimLot ? L.trimLot(plot, 'house_s') : plot;
    const bp = L.blueprint(rect, L.buildings.length);
    if (road.length) bp.list = [...L.roadOps(road), ...bp.list];
    bp.bld.underConstruction = true;
    L.buildings.push(bp.bld);
    this.bp = { sid: s.id, bp };
    this.construction = { sid: s.id, plot: plot.id, rect: rect !== plot ? { x0: rect.x0, z0: rect.z0, x1: rect.x1, z1: rect.z1 } : null, bid: bp.bld.id, road, start: this.abs, work: 0, placed: 0, need: 20 * 60, last: this.abs, done: false };
    this.assignBuilders(L, day, this.abs);
    ledger(L, day, `Builders started on a cottage for ${this.game.playerName}${road.length ? ' (the path to it first)' : ''}.`);
    return bp.bld;
  }

  // Born here and living with your family, you can ask the mayor for a
  // place of your own (a fee toward the builders).
  ownHomeTerms(mayor) {
    const L = mayor.layout;
    const s = L.settlement;
    const c = this.citizen;
    if (!c || c.sid !== s.id) return { ok: false, reason: 'citizen' };
    if (c.home !== null && c.home !== undefined) return { ok: false, reason: 'have' };
    const k = this.construction;
    if (k && k.sid === s.id && !k.done && !k.cancelled) return { ok: false, reason: 'building' };
    // No lot free: you can still pay; the house goes up on the next one.
    const plot = this.works.freePlot(L);
    if (this.roads.waiting(L, 'home')) return { ok: false, reason: 'queued' };
    const fee = Math.round(({ village: 40, town: 70, city: 110 }[s.type] || 60) * (c.native ? 0.75 : 1));
    return { ok: true, fee, plot };
  }

  ownHome(mayor) {
    const t = this.ownHomeTerms(mayor);
    if (!t.ok) return t;
    const p = this.game.player;
    if (countItem(p.inv, 'coin') < t.fee) return { ok: false, reason: 'money', fee: t.fee };
    removeItem(p.inv, 'coin', t.fee);
    mayor.layout.econ.treasury += t.fee;
    if (t.plot) this.buildHome(mayor.layout, t.plot);
    else this.roads.enqueue(mayor.layout, { kind: 'home', type: 'house_s' });
    return { ok: true, fee: t.fee, queued: !t.plot };
  }

  // Your mother, father, brothers and sisters, if you were born here.
  familyOf(rec) {
    const c = this.citizen;
    if (!c || !c.native || !c.family) return null;
    if (c.family.parents.includes(rec.idx)) return 'parent';
    if (c.family.siblings.includes(rec.idx)) return 'sibling';
    return null;
  }

  // Send people from one town to live in another (guards and settlers
  // lent between towns); they arrive after the journey.
  sendPeople(from, recs, to, why) {
    return relocate(this, from, recs, to, why);
  }

  // A new building went up: staff it.
  onBuilt(L, b) {
    staffBuilding(this, L, b, this.game.day);
  }

  // Renown: deeds done for a town (lives saved, favours, letters carried,
  // beasts put down, a good word for newcomers) earn you a title there.
  renownTitle(sid) {
    const v = this.renown.get(sid) || 0;
    return v >= RENOWN.hero ? 'Hero' : v >= RENOWN.friend ? 'Friend' : null;
  }

  addRenown(sid, pts, why) {
    const s = this.game.world.ow.settlements[sid];
    if (!s || pts <= 0 || this.justice.exiled.has(sid)) return null;
    const before = this.renownTitle(sid);
    this.renown.set(sid, (this.renown.get(sid) || 0) + pts);
    this.areaCache.delete(sid);
    const now = this.renownTitle(sid);
    if (now === before) return null;
    this.game.ui.msg(`For ${why}, the people of ${s.name} now call you ${now} of ${s.name}!`, '#ffe070');
    this.game.audio?.play('fanfare');
    const L = this.layoutOf(sid);
    if (L && L.econ) ledger(L, this.game.day, `${this.game.playerName} is named ${now} of ${s.name}.`);
    // A Hero of the town gets a statue on the square.
    if (now === 'Hero' && L && L.econ) this.history.raiseStatue(L, this.game.playerName, why, this.game.day, 'player');
    return now;
  }

  // Your best title, for the journal and profile.
  bestRenown() {
    let best = null;
    for (const [sid, v] of this.renown) if (v >= RENOWN.friend && (!best || v > best.v)) best = { sid, v };
    if (!best) return null;
    return { sid: best.sid, title: `${this.renownTitle(best.sid)} of ${this.game.world.ow.settlements[best.sid].name}`, v: best.v };
  }

  // Doing good work for a town: a steady job there, or favours done.
  goodStanding(sid) {
    const j = this.careers.job;
    if (j && j.sid === sid && (j.earned || 0) >= 25) return true;
    let favours = 0;
    for (const [k, r] of this.rep) if (k.startsWith(`${sid}:`) && r.favorNext !== undefined) favours++;
    return favours >= 2 || (this.game.stats.rescues || 0) >= 3 || (this.renown.get(sid) || 0) >= RENOWN.friend;
  }

  // Families who are crowded (or comfortably off) pay to enlarge their homes.
  familyExpansions(L, day, rng) {
    if (this.works.active(L.settlement.id).some((p) => p.kind === 'expand') || !rng.chance(0.35)) return;
    for (const b of L.buildings) {
      if (!b.residential || b.playerHome || !b.household) continue;
      const people = L.npcs.filter((r) => r.home === b.id && alive(r) && !r.migrated);
      const adults = people.filter((r) => r.age !== 'child');
      if (!adults.length) continue;
      const crowded = people.length > b.beds.length;
      const purse = adults.reduce((n, r) => n + (r.coins || 0), 0);
      const t = this.works.expansionTerms(L, b);
      if (!t.ok || purse < t.cost * (crowded ? 1 : 2.5)) continue;
      let left = t.cost;
      for (const r of adults) {
        const k = Math.min(left, Math.max(0, r.coins || 0));
        r.coins -= k;
        left -= k;
      }
      L.econ.treasury += Math.round(t.cost * 0.2);
      this.works.startExpansion(L, b, t.bounds, { family: b.family });
      ledger(L, day, `The ${b.family || 'a'} family paid ¤${t.cost} to enlarge their home.`);
      return;
    }
  }

  // A citizen who has made the town hate them gets a talking-to from the
  // mayor, and if nothing changes within a few days, is thrown out.
  checkConduct(L, day) {
    const z = this.citizen;
    if (!z || z.sid !== L.settlement.id) return;
    const m = mayorOf(L);
    if (!m) return;
    const op = this.opinion({ rec: m, settlement: L.settlement });
    if (op > -20) {
      if (z.warned !== undefined && z.warned !== null && day - z.warned >= 1) {
        z.warned = null;
        ledger(L, day, `${this.game.playerName} mended their ways, and the council is satisfied.`);
      }
      return;
    }
    if (this.confront) return;
    if (z.warned === undefined || z.warned === null) this.confront = { sid: L.settlement.id, idx: m.idx, stage: 'warn', arrived: false };
    else if (day - z.warned >= 3) this.confront = { sid: L.settlement.id, idx: m.idx, stage: 'expel', arrived: false };
  }

  updateConfront() {
    const c = this.confront;
    if (!c) return;
    const g = this.game;
    const z = this.citizen;
    if (!z || z.sid !== c.sid) {
      this.confront = null;
      return;
    }
    if (c.started && !c.arrived) {
      const m0 = this.layoutOf(c.sid).npcs[c.idx];
      if (!m0 || !m0.override || m0.override.act !== 'confront') c.started = false;
    }
    if (c.started || !g.active.has(c.sid)) return;
    const p = g.player;
    if (g.currentSettlement?.id !== c.sid || g.minute < 480 || g.minute > 1200 || p.sleeping || p.restrained || this.justice.jail || g.ui.modal) return;
    const L = this.layoutOf(c.sid);
    const m = L.npcs[c.idx];
    const n = m && m.ent;
    if (!n || n.dead || n.state !== 'routine' || n.sleeping || n.distTo(p) > 60) return;
    c.started = true;
    setOverride(m, this.abs, this.abs + 180, 'confront', { place: 'player' });
    n.activity = null;
    n.say(`${g.playerName}! A word, please.`, 3, '#ffe070');
  }

  // The mayor has reached you: out comes the lecture.
  confronted(n) {
    const c = this.confront;
    if (!c || c.arrived) return;
    c.arrived = true;
    n.face(this.game.player.x, this.game.player.z);
    this.game.talk(n);
  }

  // How the talk ends: 'promise', 'defy' or 'expel'.
  settleConfront(n, how) {
    const c = this.confront;
    const z = this.citizen;
    const L = n.layout;
    this.confront = null;
    if (n.rec.override && n.rec.override.act === 'confront') n.rec.override = null;
    n.activity = null;
    if (!z) return 'none';
    if (how === 'promise') {
      z.warned = this.game.day;
      ledger(L, this.game.day, `The mayor warned ${this.game.playerName} about their conduct.`);
      return 'warned';
    }
    if (how === 'defy' && c && c.stage === 'warn' && n.rec.personality.temper < 0.55) {
      z.warned = this.game.day;
      this.changeRep(n, -4);
      return 'last';
    }
    this.revoke('expelled by the council for bad conduct');
    return 'expelled';
  }

  pickHost(L) {
    let best = null;
    for (const b of L.buildings) {
      if (!b.residential || !b.household || b.playerHome) continue;
      const members = L.npcs.filter((r) => r.home === b.id);
      const living = members.filter(alive);
      if (!living.length || b.beds.length <= members.length) continue;
      const bed = b.beds[members.length];
      const kind = living.reduce((a, r) => a + r.personality.kindness, 0) / living.length;
      if (!best || kind > best.kind) best = { house: b, bed: { x: bed.x, y: GROUND, z: bed.z }, kind, family: b.family };
    }
    return best;
  }

  revoke(reason, quiet = false) {
    const c = this.citizen;
    if (!c) return;
    const L = this.layoutOf(c.sid);
    this.citizen = null;
    if (!quiet) this.game.ui.msg(`Your citizenship of ${L.settlement.name} was revoked (${reason}). ${L.settlement.name} has one citizen fewer.`, '#ff7060');
    this.careers.onRevoke(c.sid);
    ledger(L, this.game.day, `${this.game.playerName}'s citizenship was revoked (${reason}). ${L.settlement.name} lost a citizen.`);
    const k = this.construction;
    if (k && k.sid === c.sid && !k.done) {
      k.cancelled = true;
      this.clearBuilders(L);
    }
    this.areaCache.clear();
  }

  hostName() {
    const c = this.citizen;
    if (!c || c.host === null) return null;
    const L = this.layoutOf(c.sid);
    return L.buildings[c.host]?.family || null;
  }

  // Who may sleep where: your own home, your host's guest bed, your jail cell.
  // Staying with a family while your own house goes up: their home is
  // yours to use (beds, chests, the lot) until you move out.
  isGuest(sid, bid) {
    const c = this.citizen;
    if (!c || c.sid !== sid || c.host === null || c.host !== bid) return false;
    const L = this.layoutOf(sid);
    const home = c.home !== null && c.home !== undefined && L ? L.buildings[c.home] : null;
    return !home || !!home.underConstruction;
  }

  bedOwner(x, z) {
    const s = this.game.world.ow.settlementAt(x, z);
    if (!s) return null;
    const L = this.game.world.getLayout(s);
    const b = buildingAt(L, x, z);
    if (!b) return null;
    const c = this.citizen;
    if (b.playerHome) return c && c.sid === s.id && c.home === b.id ? null : { kind: 'other', b, L };
    if (c && c.sid === s.id && c.host === b.id && c.hostBed && c.hostBed.x === x && c.hostBed.z === z) return null;
    if (this.isGuest(s.id, b.id)) {
      // Any bed in the house, unless one of the family is asleep in it.
      const inBed = this.game.npcs.some((n) => !n.dead && n.sleeping && n.x === x && n.z === z);
      return inBed ? { kind: 'taken', b, L } : null;
    }
    if (L.jail && L.jail.bed.x === x && L.jail.bed.z === z) return { kind: 'jail', b, L };
    if (!b.residential) return b.type === 'guardhouse' ? { kind: 'guard', b, L } : null;
    const living = L.npcs.filter((r) => r.home === b.id && alive(r));
    if (!living.length) return null;
    return { kind: 'home', b, L, family: b.family };
  }

  // ------------------------------------------------------------ construction
  builders(L) {
    // The town's builders first, then carpenters and labourers lend a hand.
    const list = L.npcs.filter((r) => alive(r) && !r.away && r.age === 'adult' && r.job === 'builder');
    list.push(...L.npcs.filter((r) => alive(r) && !r.away && r.age === 'adult' && (r.job === 'carpenter' || r.job === 'laborer')));
    if (list.length < 2) {
      const extra = L.npcs.filter((r) => alive(r) && !r.away && r.age === 'adult' && !list.includes(r) && !['guard', 'mayor', 'cook', 'innkeeper', 'priest', 'merchant'].includes(r.job))
        .sort((a, b) => (b.skills?.building || 0) - (a.skills?.building || 0));
      list.push(...extra.slice(0, 2 - list.length));
    }
    return list.slice(0, Math.max(3, list.filter((r) => r.job === 'builder').length));
  }

  buildSites(L) {
    const c = this.construction;
    const plot = L.plots[c.plot];
    const out = [];
    for (let z = plot.z0 - 1; z <= plot.z1 + 1; z++) {
      for (let x = plot.x0 - 1; x <= plot.x1 + 1; x++) {
        const ring = x < plot.x0 || x > plot.x1 || z < plot.z0 || z > plot.z1;
        if (ring && (x + z) % 2 === 0) out.push({ x, z });
      }
    }
    return out;
  }

  assignBuilders(L, day, fromAbs) {
    const c = this.construction;
    if (!c || c.done || c.cancelled) return;
    const sites = this.buildSites(L);
    this.builders(L).forEach((r, i) => {
      const sched = day % 7 === r.restDay ? r.schedule.rest : r.schedule.work;
      const works = sched.filter((e) => e.act === 'work' && e.s < 1140);
      const s0 = works.length ? day * DAY + works[0].s : day * DAY + 480;
      const e0 = works.length ? day * DAY + Math.min(works[works.length - 1].e, 1140) : day * DAY + 1080;
      const s = Math.max(s0, fromAbs);
      if (e0 - s < 30) return;
      setOverride(r, s, e0, 'build', { target: sites[(i * 5) % sites.length], sites, place: 'site', allowMeals: true });
    });
  }

  clearBuilders(L) {
    for (const r of L.npcs) if (r.override && r.override.act === 'build') r.override = null;
  }

  blueprint() {
    const c = this.construction;
    if (!c) return null;
    if (this.bp && this.bp.sid === c.sid) return this.bp.bp;
    const L = this.layoutOf(c.sid);
    if (this.bp && this.bp.sid === c.sid) return this.bp.bp;
    const lot = L.plots[c.plot];
    if (!lot) return null;
    const plot = c.rect ? { ...lot, ...c.rect } : lot;
    const bp = L.blueprint(plot, c.bid);
    if (c.road && c.road.length) bp.list = [...L.roadOps(c.road), ...bp.list];
    L.buildings[c.bid] = bp.bld;
    this.bp = { sid: c.sid, bp };
    return bp;
  }

  // Work accrues during daytime hours (07:00-19:00) while builders live.
  updateConstruction() {
    const c = this.construction;
    if (!c || c.done || c.cancelled) return;
    const L = this.layoutOf(c.sid);
    const now = this.abs;
    const rate = this.works.crewRate(L, (r) => r.override && r.override.act === 'build' && !r.override.project, 1.5);
    let t = c.last;
    let work = 0;
    while (t < now) {
      const dayStart = Math.floor(t / DAY) * DAY;
      const a = Math.max(t, dayStart + 420);
      const b = Math.min(now, dayStart + 1140);
      if (b > a) work += b - a;
      t = dayStart + DAY;
    }
    c.last = now;
    c.work += work * rate;
    const bp = this.blueprint();
    if (!bp) return;
    const batch = placeSome(this.game, bp.list, c, c.need / Math.max(1, bp.list.length));
    if (batch.length) {
      this.setBlocks(batch);
      const g = this.game;
      const pl = L.plots[c.plot];
      if (Math.abs(g.player.x - pl.x0) < 24 && Math.abs(g.player.z - pl.z0) < 20 && Math.random() < 0.5) {
        g.renderer.emit(pl.x0 + 2, GROUND, pl.z0 + 2, { n: 4, color: ['#c8a064', '#8e6a3a', '#e8e0d0'], up: 30, life: 0.5, oy: -6 });
        g.audio?.play('place');
      }
    }
    if (c.placed >= bp.list.length && !c.wait.length) this.completeHouse(L, bp, false);
  }

  // (From the command console: the rest of your cottage goes up at once.)
  finishHomeNow(L) {
    const c = this.construction;
    if (!c || c.done || c.cancelled) return;
    const bp = this.blueprint();
    if (!bp) return;
    const rest = [...(c.wait || []), ...bp.list.slice(c.placed)];
    if (rest.length) this.setBlocks(rest);
    c.placed = bp.list.length;
    c.wait = [];
    this.completeHouse(L, bp, false);
  }

  completeHouse(L, bp, silent) {
    const c = this.construction;
    c.done = true;
    const bld = bp.bld;
    bld.underConstruction = false;
    if (!L.spots.includes(bp.spots[0])) L.spots.push(...bp.spots);
    for (const ch of bp.chimneys) if (!L.chimneys.includes(ch)) L.chimneys.push(ch);
    for (const sg of bp.signs) if (!L.signs.includes(sg)) L.signs.push(sg);
    bld.homeName = `${this.game.playerName}'s Cottage`;
    if (this.citizen && this.citizen.sid === c.sid) {
      this.citizen.home = bld.id;
      const bed = bld.beds[0];
      if (bed) this.citizen.homeBed = { x: bed.x, y: GROUND, z: bed.z };
    }
    this.clearBuilders(L);
    if (!silent) {
      this.game.ui.msg(`Your new home in ${L.settlement.name} is finished!`, '#ffe070');
      this.game.audio?.play('coin');
      ledger(L, this.game.day, `The builders finished ${this.game.playerName}'s cottage.`);
    }
    this.game.refreshSigns?.();
  }

  constructionProgress() {
    const c = this.construction;
    if (!c) return null;
    if (c.done) return 1;
    const bp = this.blueprint();
    return bp ? c.placed / bp.list.length : 0;
  }

  // ------------------------------------------------------------ merchants
  departMerchant(L, rec, h, day, rng) {
    const s = L.settlement;
    const ow = this.game.world.ow;
    const dests = ow.settlements
      .filter((o) => o.id !== s.id && !deserted(o))
      .map((o) => ({ o, d: Math.hypot(o.cx - s.cx, o.cz - s.cz) }))
      .filter((q) => q.d < 16);
    if (!dests.length) return;
    // Nobody takes their wares into a hostile realm; a friendly one is
    // worth the longer road.
    const feel = (o) => (s.civ && o.civ && s.civ !== o.civ ? this.realms.standing(s.civ, o.civ) : null);
    // (Nor down a road raiders are riding, or toward a war.)
    if (this.war.unsafe(s)) return;
    const open = dests.filter((q) => feel(q.o) !== 'hostile' && !this.war.unsafe(q.o));
    if (!open.length) return;
    dests.splice(0, dests.length, ...open);
    for (const q of dests) q.d -= feel(q.o) === 'friendly' ? 3 : 0;
    // What they're carrying is worth more where it's short: the longer road
    // there is worth it.
    const goods = packGoods(L, rec, rng);
    for (const q of dests) {
      const DL = this.game.world.layouts.get(q.o.id);
      if (!DL || !DL.econ || !DL.econ.market) continue;
      let pull = 0;
      for (const [k, n] of Object.entries(goods)) pull -= this.market.level(DL, k) * Math.min(n, 6);
      q.d -= clamp(pull * 0.6, -3, 4);
    }
    dests.sort((a, b) => a.d - b.d);
    // Letters from the mayor decide where the merchant goes first; one who
    // left home to seek their fortune goes back to visit, in time.
    const f = rec.life && rec.life.fortune;
    const homeS = f && !f.back && (!f.fate || f.fate === 'merchant') && day - f.since >= 15 ? ow.settlements[f.home] : null;
    const homeQ = homeS && !deserted(homeS) && feel(homeS) !== 'hostile' && !this.war.unsafe(homeS) ? { o: homeS, d: Math.hypot(homeS.cx - s.cx, homeS.cz - s.cz) } : null;
    const pick = homeQ || this.diplomacy.preferredDest(s.id, dests) || dests[Math.min(dests.length - 1, rng.int(0, Math.min(3, dests.length - 1)))];
    if (homeQ) {
      f.back = day;
      const HL = this.game.world.layouts.get(homeS.id);
      if (HL && HL.econ) ledger(HL, day, `${rec.name.first} ${rec.name.last}, who left ${homeS.name} to seek their fortune, is coming home to visit: a merchant of ${s.name} now!`);
    }
    // Between two towns on the water, a merchant with a raft goes by river
    // or along the coast: quicker than the road.
    const wet = (q) => q.river || q.coast;
    const byRaft = wet(s) && wet(pick.o) && (s.river === pick.o.river || s.coast === pick.o.coast);
    const hasRaft = () => (rec.inv || []).some((q) => q && q.item === 'raft' && q.count > 0);
    if (byRaft && !hasRaft() && rec.coins >= 20) {
      rec.coins -= 16;
      invAdd((rec.inv ||= []), 'raft', 1);
    }
    // Through the realm's portals, where there are portals at both ends:
    // there within the hour.
    const portal = this.portals.linked(s, pick.o) ? this.portals.of(s.id) : null;
    const raft = !portal && byRaft && hasRaft();
    // Overland, a wagon (and a horse to pull it) if the town has one free,
    // or a horse to ride: quicker, and a wagon carries more.
    const mount = raft || portal ? null : this.stables.take(L, 'wagon');
    if (mount) mount.banner = s.civ ? s.civ.color.hex : '#b03030';
    const travel = portal ? 1 : Math.max(2, Math.round(this.diplomacy.travelHours(s, pick.o) * (raft ? 0.7 : mount ? (mount.kind === 'horse' ? 0.65 : 0.75) : 1)));
    if (mount && mount.kind === 'wagon') for (const [k, n] of Object.entries(goods)) goods[k] = n + Math.ceil(n / 2);
    const t = (rec.trip = { phase: 'away', dest: pick.o.id, depart: h, arrive: h + travel * 60, ret: 0, goods, earned: 0, since: day, raft, mount, portal: !!portal });
    const visit = {
      id: `m${s.id}:${rec.idx}:${h}`, from: s.id, fromName: s.name, fromIdx: rec.idx, name: rec.name, style: s.style, look: rec.look, tier: rec.tier,
      goods, arrive: t.arrive, leave: t.arrive + rng.int(6, 10) * 60, coins: Math.max(10, rec.coins), traded: false, earned: 0, mount,
      // The news from home goes along with the goods.
      news: notableNews(L, day - 5, 3),
    };
    t.ret = visit.leave + travel * 60;
    if (!this.visits.has(pick.o.id)) this.visits.set(pick.o.id, []);
    this.visits.get(pick.o.id).push(visit);
    t.visit = visit.id;
    const mail = this.diplomacy.letters.filter((q) => q.from === s.id && q.to === pick.o.id && q.status === 'waiting').length;
    this.diplomacy.carry(s.id, pick.o.id, rec, t.arrive);
    ledger(L, day, `${rec.name.first} ${rec.name.last} set out for ${pick.o.name}${portal ? ' through the portal' : raft ? ' by raft' : mount ? (mount.kind === 'wagon' ? ' with the town wagon' : ' on horseback') : ''} with ${mount && mount.kind === 'wagon' ? 'a wagonload' : 'a pack'} of goods${mail ? ' and a letter from the mayor' : ''}.`);
    if (portal) {
      // (Out of the other arch when they get there, and out of this one
      // when they're home again.)
      visit.portal = true;
      const far = this.portals.of(pick.o.id);
      this.landing ||= new Map();
      this.landing.set(`v${visit.id}`, { x: far.front.x, y: GROUND, z: far.front.z, t: t.arrive });
      this.landing.set(`h${s.id}:${rec.idx}`, { x: portal.front.x, y: GROUND, z: portal.front.z, t: t.ret });
    }
    if (rec.ent && !rec.ent.dead) {
      // Walk out of town first (or into the portal), then vanish over the
      // horizon.
      setOverride(rec, h, h + 180, 'travel', portal ? { place: 'portal', target: { x: portal.x, z: portal.z } } : { place: 'road' });
      rec.leaving = true;
    } else rec.away = true;
  }

  returnMerchant(L, rec, day) {
    const t = rec.trip;
    rec.away = false;
    rec.leaving = false;
    const list = this.visits.get(t.dest) || [];
    const v = list.find((q) => q.id === t.visit);
    let earned = v ? v.earned : 0;
    if (!v || !v.traded) {
      // Nobody watched the trip: the goods sold at a profit (the better
      // the merchant, the better the price they get).
      const f = tierOf(rec)?.profit ?? 1.25;
      const DL0 = this.game.world.layouts.get(t.dest);
      for (const [k, n] of Object.entries(t.goods)) {
        earned += Math.round(price(k) * n * f * (DL0 ? this.market.factor(DL0, k) : 1));
        // (What they sold there is that much more of it about.)
        if (DL0 && DL0.econ) this.market.trade(DL0, k, n * 0.3);
      }
    }
    rec.coins += earned;
    rec.earned += earned;
    // The horse (and wagon) back in the town's stable.
    if (t.mount) this.stables.giveBack(t.mount);
    rec.trip = { phase: 'home', since: day };
    this.visits.set(t.dest, list.filter((q) => q.id !== t.visit));
    const dest = this.game.world.ow.settlements[t.dest];
    ledger(L, day, `${rec.name.first} ${rec.name.last} came back from ${dest ? dest.name : 'the road'} (+¤${earned}).`);
    // ...with the news from there.
    const DL = dest && this.game.world.layouts.get(dest.id);
    if (DL && DL.econ) hearNews(L, dest.name, notableNews(DL, day - 5, 3), day, this.now());
    this.importOre(L, rec, day);
  }

  // A town with a forge but nobody to mine brings its ore in by cart: the
  // merchant buys it on the road and sells it to the smithy at a markup.
  importOre(L, rec, day) {
    const smithy = L.buildings.find((b) => b.type === 'smithy' && L.econ.biz[b.id]);
    if (!smithy || L.npcs.some((r) => r.job === 'miner' && alive(r) && !r.migrated)) return 0;
    const biz = L.econ.biz[smithy.id];
    let n = 0;
    for (const [item, want] of [['iron_ore', 6], ['coal', 4]]) {
      const pr = Math.round(price(item) * 1.3);
      for (let k = st.count(biz.store, item); k < want && biz.till >= pr + 5 && rec.coins >= price(item); k++) {
        rec.coins -= price(item);
        biz.till -= pr;
        rec.coins += pr;
        st.add(biz.store, item, 1);
        n++;
      }
    }
    if (n) ledger(L, day, `${rec.name.first} ${rec.name.last} brought back ore and coal for the smithy.`);
    return n;
  }

  // Visiting merchants sell to local businesses; strangers occasionally
  // turn up when the player is in town.
  merchantVisits(L, h, rng) {
    const sid = L.settlement.id;
    const list = this.visits.get(sid) || [];
    for (const v of list) if (!v.traded && h >= v.arrive) this.visitTrade(L, v, rng);
    // A merchant arriving tells what's happening back home (and pitches a
    // tent outside town for the stay).
    for (const v of list) {
      if (v.told || h < v.arrive) continue;
      v.told = true;
      // (Customs houses: a merchant of another realm pays at the gate.)
      const vf = v.from !== undefined ? this.game.world.ow.settlements[v.from] : null;
      if (vf && vf.civ && L.settlement.civ && vf.civ !== L.settlement.civ && this.tech.has(L.settlement, 'customs')) {
        L.econ.treasury += 6;
        L.econ.customs = (L.econ.customs || 0) + 6;
      }
      if (h < v.leave && !v.guest) this.camps.pitch(L, `v:${v.id}`, 'merchant', 1, v.leave + 30, hash4(sid, v.arrive, 0xc4), { mounts: v.mount ? [v.mount] : [] });
      hearNews(L, v.fromName, v.news, Math.floor(h / DAY), h);
    }
    const keep = list.filter((v) => h < v.leave + 180 || v.fromIdx !== undefined);
    this.visits.set(sid, keep.filter((v) => !(v.fromIdx === undefined && h >= v.leave)));
    const hod = Math.floor((h % DAY) / 60);
    if (this.game.active.has(sid) && hod >= 8 && hod <= 15 && !keep.some((v) => h >= v.arrive && h < v.leave) && rng.chance(0.07 * (this.tech.has(L.settlement, 'markets') ? 1.8 : 1) * (this.tech.has(L.settlement, 'free_trade') ? 1.4 : 1))) {
      const ow = this.game.world.ow;
      const s = L.settlement;
      if (this.war.unsafe(s)) return;
      const from = rng.pick(ow.settlements.filter((o) => o.id !== sid && !deserted(o) && Math.hypot(o.cx - s.cx, o.cz - s.cz) < 18 && !(o.civ && s.civ && o.civ !== s.civ && this.realms.standing(o.civ, s.civ) === 'hostile') && !this.war.unsafe(o)) || []);
      if (!from) return;
      const goods = {};
      const opts = ['cloth', 'string', 'torch', 'apple', 'herb', 'lantern', 'book', 'glass', 'leather', 'iron_ingot', 'coal', 'bread', 'arrow', 'gem', 'rug_blue', 'fishing_rod', 'bow'];
      if (from.coast || from.river) opts.push('fish', 'cooked_fish');
      for (const k of rng.shuffle(opts).slice(0, 6)) if (ITEMS[k]) st.add(goods, k, k === 'gem' ? 1 : rng.int(1, 4));
      const v = makeVisitor(from, rng, h, goods);
      // (Master merchants come only from realms with guild charters.)
      if (v.tier > 2 && !this.tech.has(from, 'guilds')) v.tier = 2;
      v.traded = true;
      const OL = this.game.world.layouts.get(from.id);
      v.news = OL && OL.econ ? notableNews(OL, this.game.day - 5, 2) : [];
      this.visits.set(sid, [...this.visits.get(sid), v]);
      ledger(L, Math.floor(h / DAY), `A traveling merchant, ${v.name.first} ${v.name.last} of ${from.name}, arrived in town.`);
    }
  }

  visitTrade(L, v, rng) {
    v.traded = true;
    const e = L.econ;
    const from = this.game.world.ow.settlements[v.from];
    // A realm that charges this merchant's realm a tariff takes its cut.
    const tariff = from && this.realms.tariffOn(L.settlement, from) ? 0.15 : 0;
    const before = v.earned;
    const k = kitchenOf(L);
    const shop = L.buildings.find((b) => b.type === 'shop');
    const sb = shop ? e.biz[shop.id] : null;
    for (const [item, n] of Object.entries(v.goods)) {
      let buyer = null;
      if (k && ['fish', 'raw_meat', 'carrot', 'cabbage', 'wheat', 'bread', 'cooked_fish'].includes(item)) buyer = k;
      else if (sb) buyer = sb;
      if (!buyer) continue;
      const T = MERCHANT_TIERS[v.tier || 1] || MERCHANT_TIERS[1];
      const sell = Math.min(n, rng.int(1, Math.max(1, Math.ceil(n * (T.share + 0.1)))));
      for (let i = 0; i < sell; i++) {
        const pr = Math.round(price(item) * (T.profit - 0.05));
        if (buyer.till < pr + 5) break;
        buyer.till -= pr;
        const cut = Math.round(pr * tariff);
        e.treasury += cut;
        v.earned += pr - cut;
        v.coins += pr - cut;
        st.take(v.goods, item, 1);
        st.add(buyer.store, item, 1);
      }
    }
    if (from) {
      this.realms.noteTrade(from, L.settlement, v.earned - before);
      this.realms.welcome(L, from, Math.floor((v.arrive || this.abs) / DAY), rng);
    }
  }

  // Someone you've watched walk all the way into town ahead of their
  // journey's reckoning (see game.updateCaravans): they're here now, not
  // gone off the road to turn up again later. `at` is where they stand (and
  // what they ride), for whoever they become in town to carry on from.
  arriveEarly(tr, at) {
    const now = this.abs;
    const day = Math.floor(now / DAY);
    this.landing ||= new Map();
    if (tr.company) {
      const g = tr.company;
      const i = Number(tr.key.split(':')[2]);
      this.landing.set(`c${g.id}:${i}`, { ...at, t: now });
      if (g.state === 'road') this.caravans.arriveAt(g, new RNG(hash4(g.id, Math.floor(now / 60), 0xca)));
      return 'company';
    }
    if (tr.adv) {
      const a = tr.adv;
      this.landing.set(`a${a.id}`, { ...at, t: now });
      if (a.state === 'road') {
        a.arrive = Math.min(a.arrive, now);
        this.adventurers.arriveAt(a, a.dest, new RNG(hash4(a.id, Math.floor(now / 60), 0xa1)));
      }
      return 'adventurer';
    }
    if (tr.settler !== undefined) {
      const p = this.founding.parties.find((q) => q.id === tr.settler);
      this.landing.set(`h${tr.L.settlement.id}:${tr.rec.idx}`, { ...at, t: now });
      if (p && p.stage === 'travel') {
        p.arrive = Math.min(p.arrive, now);
        this.founding.advance(p, day);
      }
      return 'settler';
    }
    const t = tr.rec.trip;
    if (tr.to.id !== tr.L.settlement.id) {
      if (!t || t.phase !== 'away' || tr.to.id !== t.dest) return null;
      // In at the far town: the visit starts now.
      const v = (this.visits.get(t.dest) || []).find((q) => q.id === t.visit);
      if (v && v.arrive > now) v.arrive = now;
      if (t.arrive > now) t.arrive = now;
      if (v) this.landing.set(`v${v.id}`, { ...at, t: now });
      return 'visit';
    }
    // Home again.
    this.landing.set(`h${tr.L.settlement.id}:${tr.rec.idx}`, { ...at, t: now });
    if (!t || t.phase !== 'away') return 'home';
    if (t.outing !== undefined && t.outing !== null) {
      const o = this.outings.get(t.outing);
      if (o && o.phase === 'out') this.outings.home(tr.L, o, now, day);
    } else if (t.ret > now) this.returnMerchant(tr.L, tr.rec, day);
    return 'home';
  }

  // Where someone who just walked in (above) stands, once (and only while
  // it's fresh).
  landed(key) {
    const at = this.landing && this.landing.get(key);
    if (!at) return null;
    this.landing.delete(key);
    return this.abs - at.t <= 30 ? at : null;
  }

  // Spawn / retire visiting merchant entities in active settlements.
  // Merchants out on the road right now: where they are between towns
  // (along the road, if one has been built) and where they're heading.
  travellers() {
    const out = [];
    const now = this.abs;
    const ow = this.game.world.ow;
    const centre = (s) => ({ x: Math.floor((s.cx + s.cw / 2) * 64), z: Math.floor((s.cz + s.cd / 2) * 36) });
    for (const L of this.game.world.layouts.values()) {
      if (!L.econ) continue;
      const home = L.settlement;
      for (const rec of L.npcs) {
        const t = rec.trip;
        // (Riding in the back of someone's wagon: drawn with it; at sea,
        // aboard a ship.)
        if (!t || t.phase !== 'away' || !alive(rec) || t.passenger || t.ship !== undefined || t.portal) continue;
        const dest = ow.settlements[t.dest];
        if (!dest) continue;
        const v = (this.visits.get(t.dest) || []).find((q) => q.id === t.visit);
        let from;
        let to;
        let f;
        if (now >= t.depart && now < t.arrive) {
          from = home;
          to = dest;
          f = (now - t.depart) / Math.max(1, t.arrive - t.depart);
        } else if (v && now >= v.leave && now < t.ret) {
          from = dest;
          to = home;
          f = (now - v.leave) / Math.max(1, t.ret - v.leave);
        } else continue;
        // Down the road, or the long way round by land.
        const way = this.diplomacy.way(from, to);
        const pos = this.diplomacy.wayAt(way, f * way.len);
        // (Townsfolk on an outing you're part of walk right beside you.)
        const o = t.outing ? this.outings.get(t.outing) : null;
        out.push({ key: `${home.id}:${rec.idx}`, rec, L, from, to, pos, way, target: centre(to), mount: t.mount || null, outing: t.outing || null, close: !!(o && o.withPlayer) });
      }
    }
    // Adventurers on their way from one town to the next.
    for (const a of this.adventurers.list) {
      if (a.dead || a.state !== 'road' || a.from === null || a.from === undefined || a.departAt === undefined || now < a.departAt || now >= a.arrive) continue;
      const from = ow.settlements[a.from];
      const to = ow.settlements[a.dest];
      const L = to && this.game.world.layouts.get(to.id);
      if (!from || !to || !L || !L.econ) continue;
      const f = (now - a.departAt) / Math.max(1, a.arrive - a.departAt);
      const way = this.diplomacy.way(from, to);
      const pos = this.diplomacy.wayAt(way, f * way.len);
      out.push({ key: `adv:${a.id}:${a.departAt}`, rec: this.adventurers.roadRec(a, L), L, from, to, pos, way, target: centre(to), adv: a });
    }
    // The trading companies, riding and driving their wagons (or camped).
    out.push(...this.caravans.roadTravellers());
    // Settlers on their way to found a village.
    out.push(...this.founding.roadTravellers());
    return out;
  }

  syncVisitors() {
    const g = this.game;
    const now = this.abs;
    for (const [sid, a] of g.active) {
      const list = this.visits.get(sid) || [];
      for (const v of list) {
        const ent = this.visitorEnts.get(v.id);
        const here = now >= v.arrive && now < v.leave;
        if (here && (!ent || ent.dead) && !v.gone) {
          const e2 = g.spawnVisitor(a.layout, v, 1000 + list.indexOf(v));
          if (e2) this.visitorEnts.set(v.id, e2);
        } else if (!here && ent && !ent.dead && now >= v.leave && !(ent.rec.override && ent.rec.override.act === 'travel')) {
          setOverride(ent.rec, now, now + 240, 'travel', { place: 'road' });
          v.gone = true;
        }
      }
    }
  }

  // ------------------------------------------------------------ save
  serialize() {
    const settlements = [];
    for (const L of this.game.world.layouts.values()) {
      if (!L.econ) continue;
      settlements.push(this.serializeSettlement(L));
    }
    const visits = [];
    for (const [sid, list] of this.visits) visits.push([sid, list]);
    return {
      settlements,
      rep: [...this.rep],
      visits,
      pending: [...this.pending],
      citizen: this.citizen,
      construction: this.construction,
      justice: this.justice.serialize(),
      careers: this.careers.serialize(),
      works: this.works.serialize(),
      diplomacy: this.diplomacy.serialize(),
      nomads: this.nomads.serialize(),
      camps: this.camps.serialize(),
      realms: this.realms.serialize(),
      adventurers: this.adventurers.serialize(),
      dungeons: this.dungeons.serialize(),
      ancient: this.ancient.serialize(),
      caravans: this.caravans.serialize(),
      outings: this.outings.serialize(),
      bandits: this.bandits.serialize(),
      founding: this.founding.serialize(),
      religion: this.religion.serialize(),
      market: this.market.serialize(),
      deserted: [...this.deserted],
      renown: [...this.renown],
      petition: this.petition || null,
      // How towns have grown: their size now, and ground they've spread onto.
      grown: this.game.world.ow.settlements.filter((s) => s.baseType || s.suburbs || s.reach).map((s) => [s.id, s.type, s.baseType || s.type, s.suburbs || null, s.reach || null]),
      favors: this.favors.serialize(),
      press: this.press.serialize(),
      tech: this.tech.serialize(),
      ships: this.ships.serialize(),
      portals: this.portals.serialize(),
      politics: this.politics.serialize(),
      war: this.war.serialize(),
    };
  }

  serializeSettlement(L) {
    const pickRec = (r) => ({
      coins: r.coins, inv: r.inv, skills: r.skills, fed: r.fed, hungry: r.hungry, mood: r.mood, earned: r.earned, earnedY: r.earnedY,
      lastMeal: r.lastMeal, grief: r.grief, override: r.override, away: r.away, leaving: r.leaving, trip: r.trip, errand: r.errand, roadwork: r.roadwork || null, readEdition: r.readEdition, doneKey: r.doneKey,
      hp: r.hp, alive: r.alive, traveler: r.traveler, sick: r.sick, deathDay: r.deathDay, cause: r.cause, stall: r.stall, snares: r.snares, tier: r.tier, shopDue: r.shopDue, wear: r.wear, gems: r.gems,
      migrated: r.migrated, home: r.home, bed: r.bed, household: r.household, children: r.children, partner: r.partner, age: r.age, grown: r.grown,
      born: r.born, span: r.span, elderSince: r.elderSince, aged: r.aged, ruler: r.ruler, councillor: r.councillor, outing: r.outing, tripMem: r.tripMem,
      drafted: r.drafted, raid: r.raid, soldier: r.soldier, captive: r.captive, walkHome: r.walkHome,
      // Ranks, vices, feuds, affairs, time in the cells, fortunes sought.
      life: r.life,
      // A drilled guard keeps the toughness drill gave them.
      ...(r.drilled ? { drilled: true, maxHp: r.maxHp } : {}),
      ...(r.grown ? { hobbies: r.hobbies } : {}),
      // Grown old (grey, stooped, slower), whether or not they retired.
      ...(r.aged || r.ruler !== undefined ? { look: r.look, maxHp: r.maxHp, schedule: r.schedule } : {}),
      // Someone who changed trade keeps their new one.
      ...(r.retrained ? { retrained: true, job: r.job, work: r.work, equipment: r.equipment, look: r.look, maxHp: r.maxHp, schedule: r.schedule, shift: r.shift } : {}),
    });
    return {
      sid: L.settlement.id,
      econ: L.econ,
      recs: L.npcs.slice(0, L.baseN ?? L.npcs.length).map(pickRec),
      // People who moved here from elsewhere: whole records.
      extra: L.npcs.slice(L.baseN ?? L.npcs.length).map(({ ent, ...r }) => (void ent, r)),
      graves: L.graveyard ? { rows: L.graveyard.rows, slots: L.graveyard.slots.map((s) => s.grave) } : null,
      plots: L.plots.map((p) => !!(p && p.taken)),
    };
  }

  applySettlement(L, sv) {
    Object.assign(L.econ, sv.econ);
    this.roads.restore(L);
    for (const r of L.econ.openPlots || []) L.reopenPlot(r);
    sv.recs.forEach((d, i) => {
      if (L.npcs[i]) Object.assign(L.npcs[i], d);
    });
    for (const r of sv.extra || []) if (!L.npcs[r.idx]) L.npcs[r.idx] = { ...r };
    if (sv.graves && L.graveyard) {
      L.graveyard.rows = sv.graves.rows;
      sv.graves.slots.forEach((gr, i) => {
        if (L.graveyard.slots[i]) L.graveyard.slots[i].grave = gr;
      });
    }
    (sv.plots || []).forEach((t, i) => {
      if (L.plots[i]) L.plots[i].taken = t;
    });
  }

  load(data) {
    if (!data) return;
    // (Villages founded since the world began go back on the map first.)
    this.founding.load(data.founding);
    this.religion.load(data.religion);
    this.saved = new Map((data.settlements || []).map((s) => [s.sid, s]));
    this.rep = new Map(data.rep || []);
    this.visits = new Map(data.visits || []);
    this.pending = new Map(data.pending || []);
    this.citizen = data.citizen || null;
    this.construction = data.construction || null;
    this.justice.load(data.justice);
    this.careers.load(data.careers);
    this.works.load(data.works);
    this.diplomacy.load(data.diplomacy);
    this.nomads.load(data.nomads);
    this.camps.load(data.camps);
    this.realms.load(data.realms);
    this.adventurers.load(data.adventurers);
    this.dungeons.load(data.dungeons);
    this.ancient.load(data.ancient);
    this.caravans.load(data.caravans);
    this.outings.load(data.outings);
    this.bandits.load(data.bandits);
    this.market.load(data.market);
    this.deserted = new Set(data.deserted || []);
    this.renown = new Map(data.renown || []);
    this.petition = data.petition || null;
    for (const [id, type, base, suburbs, reach] of data.grown || []) {
      const s = this.game.world.ow.settlements[id];
      if (!s) continue;
      if (type !== base) {
        s.baseType = base;
        s.type = type;
      }
      if (suburbs) s.suburbs = suburbs;
      if (reach) s.reach = reach;
    }
    for (const sid of this.deserted) if (this.game.world.ow.settlements[sid]) this.game.world.ow.settlements[sid].deserted = true;
    this.favors.load(data.favors);
    this.press.load(data.press);
    this.tech.load(data.tech);
    this.ships.load(data.ships);
    this.portals.load(data.portals);
    // (After the realms: the map's borders as they stood.)
    this.politics.load(data.politics);
    this.war.load(data.war);
  }
}

function JOBS_TRADER(rec) {
  const t = { fisher: 'fisher', farmer: 'farmer', trapper: 'trapper', blacksmith: 'smith', merchant: 'general', baker: 'baker', tailor: 'tailor', carpenter: 'carpenter', herbalist: 'herbalist', scholar: 'scholar' }[rec.job];
  return t && STOCK[t] ? t : null;
}

function epitaphFor(rec, L) {
  if (rec.age === 'child') return 'Taken far too soon';
  if (rec.partner !== null && rec.partner !== undefined && L.npcs[rec.partner]) return `Beloved partner of ${L.npcs[rec.partner].name.first}`;
  if (rec.children.length) return 'A loving parent';
  const byJob = { guard: 'Kept us safe', cook: 'Fed us all', farmer: 'Worked the good earth', priest: 'Walked in the light', trapper: 'Knew every trail', fisher: 'Gone to the far shore', blacksmith: 'Forged in fire' }[rec.job];
  return byJob || ['Beloved by all', 'Gone but not forgotten', 'At rest at last', 'Forever in our hearts'][rec.idx % 4];
}

export { st, invCount, activityFor };
