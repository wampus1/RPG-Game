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
  ledger, alive, DAY, price, kitchenOf, STOCK, notableNews, hearNews,
} from './econ.js';
import { Justice } from './justice.js';
import { Careers } from './careers.js';
import { Favors } from './favors.js';
import { checkWatch, checkSupply, checkHousing, births, staffBuilding, relocate, deserted } from './civic.js';
import { Works, placeSome } from './works.js';
import { Diplomacy, SOFT } from './diplomacy.js';
import { Nomads } from './nomads.js';
import { electMayor, weddings, comingOfAge, raids } from './life.js';
import { growth } from './growth.js';
import { removeItem, countItem } from '../game/inventory.js';

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

export function buildingAt(L, x, z) {
  for (const b of L.buildings) if (x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1) return b;
  return null;
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
    this.justice = new Justice(game, this);
    this.careers = new Careers(game, this);
    this.favors = new Favors(game, this);
    this.works = new Works(game, this);
    this.diplomacy = new Diplomacy(game, this);
    this.nomads = new Nomads(game, this);
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
    initEcon(L);
    L.baseN = L.npcs.length;
    const sid = L.settlement.id;
    const dead = this.game.deadNpcs.get(sid);
    if (dead) for (const i of dead) if (L.npcs[i]) L.npcs[i].alive = false;
    const sv = this.saved && this.saved.get(sid);
    if (sv) this.applySettlement(L, sv);
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
      const plot = L.plots[c.plot];
      if (plot) {
        plot.taken = true;
        const bp = L.blueprint(plot, L.buildings.length);
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
  backgroundTick() {
    const list = [...this.game.world.layouts.values()].filter((L) => L.econ && L.econ.lastAbs !== null && !this.game.active.has(L.settlement.id));
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
      this.syncVisitors();
      this.areaCache.clear();
      this.favors.update();
    }
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
        if (!soft || SOFT.has(w.getBlock(x, y, z))) w.setBlock(x, y, z, id, meta);
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
    for (const [x, y, z, id, meta, soft] of ops) if (!soft || SOFT.has(w.getBlock(x, y, z))) w.setBlock(x, y, z, id, meta);
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
    let v = this.repEntry(sid, rec.idx).v + this.areaMod(sid);
    const c = this.citizen;
    if (c && c.sid === sid && c.host !== null && rec.home === c.host) v += 10;
    return clamp(Math.round(v), -100, 100);
  }

  changeRep(npc, delta) {
    const sid = this.repSidOf(npc);
    const rec = npc.rec || npc;
    const r = this.repEntry(sid, rec.idx);
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

  // NPCs who can see what happens at (x, z): close enough, looking that
  // way (anyone right beside you notices), with no wall or closed door in
  // between. Windows and open doors let them see through.
  witnesses(sid, x, z, radius = 7, exclude = null) {
    const a = this.game.active.get(sid);
    if (!a) return [];
    return a.npcs.filter((n) => {
      if (n.dead || n.sleeping || n === exclude || n.rec.away) return false;
      if (Math.max(Math.abs(n.x - x), Math.abs(n.z - z)) > radius) return false;
      return this.canSee(n, x, z);
    });
  }

  canSee(n, x, z, y = null) {
    const d = Math.max(Math.abs(n.x - x), Math.abs(n.z - z));
    if (d <= 1) return true;
    const [fx, fz] = [[0, 1], [-1, 0], [0, -1], [1, 0]][n.dir || 0];
    if ((x - n.x) * fx + (z - n.z) * fz < 0 && d > 2) return false;
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
    const staff = this.careers.discount(npc);
    if (staff < 1) {
      d *= staff;
      reasons.push('staff');
    }
    return { base: m, discount: d, reasons };
  }

  // What a trader pays you for an item. A licensed professional's premium
  // always shows, even on cheap goods where rounding would swallow it.
  sellPrice(npc, k) {
    const op = this.opinion(npc);
    const raw = (ITEMS[k]?.value || 0) * 0.5 * (op >= 35 ? 1.15 : op <= -25 ? 0.8 : 1);
    const normal = Math.max(k === 'coin' ? 0 : 1, Math.floor(raw));
    const lic = this.careers.sellFactor(npc, k);
    return lic > 1 ? Math.max(normal + 1, Math.round(raw * lic)) : normal;
  }

  // ------------------------------------------------------------ deaths
  recordDeath(L, rec, cause, killer, when = null) {
    if (!alive(rec)) return null;
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
    const slot = this.addGrave(L, rec, cause, day);
    const name = `${rec.name.first} ${rec.name.last}`;
    const fam = new Set([rec.partner, ...rec.children, ...rec.parents].filter((i) => i !== null && i !== undefined));
    let k = 0;
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
      if (slot && rel !== 'acquaintance' && !o.away) {
        const g = L.graveyard;
        const tx = clamp(slot.x + ((k++ % 3) - 1), g.x + 1, g.x + g.W - 2);
        setOverride(o, (day + 1) * DAY + 960, (day + 1) * DAY + 1020, 'funeral', { target: { x: tx, z: slot.z + 1 }, who: name });
      }
    }
    const priest = L.npcs.find((r) => r.job === 'priest' && alive(r) && !r.away);
    if (priest && slot) setOverride(priest, (day + 1) * DAY + 950, (day + 1) * DAY + 1025, 'funeral', { target: { x: slot.x, z: slot.z + 1 }, who: name, officiant: true });
    L.econ.recent.deaths++;
    ledger(L, day, `${name}, ${jobTitle(rec, s).toLowerCase()}, died (${cause}).${slot ? ' Funeral tomorrow at 16:00.' : ''}`);
    if (rec.job === 'mayor') ledger(L, day, 'The council will govern until a new leader is chosen.');
    if (this.citizen && this.citizen.sid === s.id && this.citizen.host === rec.home) {
      // Hosting continues with the rest of the family, if any remain.
      if (!L.npcs.some((r) => r.home === rec.home && alive(r))) this.citizen.host = null;
    }
    void rng;
    return slot;
  }

  addGrave(L, rec, cause, day) {
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
    this.setBlocks([[slot.x, g.y, slot.z, B.gravestone, 0]]);
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
    } finally {
      this.simDay = null;
      this.simNow = null;
    }
    // Building work in a town caught up from afar moves on with its days.
    this.works.catchUp(L, Math.min(this.abs, (day + 1) * DAY));
  }

  civicDay(L, day, rng) {
    checkWatch(this, L, day, rng);
    checkSupply(this, L, day);
    checkHousing(this, L, day);
    births(this, L, day, rng);
    electMayor(this, L, day);
    weddings(this, L, day, rng);
    comingOfAge(this, L, day);
    raids(this, L, day, rng);
    this.diplomacy.consider(L, day, rng);
    this.nomads.arrive(L, day, rng);
    this.familyExpansions(L, day, rng);
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
    if (t.plot) {
      t.plot.taken = true;
      const bp = L.blueprint(t.plot, L.buildings.length);
      bp.bld.underConstruction = true;
      L.buildings.push(bp.bld);
      this.bp = { sid: s.id, bp };
      this.construction = { sid: s.id, plot: t.plot.id, bid: bp.bld.id, start: this.abs, work: 0, placed: 0, need: 20 * 60, last: this.abs, done: false };
      this.assignBuilders(L, day, this.abs);
      ledger(L, day, `Builders started on a cottage for ${this.game.playerName}.`);
    }
    return { ok: true, fee: t.fee, host, plot: t.plot };
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
    this.game.audio?.play('coin');
    const L = this.layoutOf(sid);
    if (L && L.econ) ledger(L, this.game.day, `${this.game.playerName} is named ${now} of ${s.name}.`);
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
    if (!quiet) this.game.ui.msg(`Your citizenship of ${L.settlement.name} was revoked (${reason}).`, '#ff7060');
    this.careers.onRevoke(c.sid);
    ledger(L, this.game.day, `${this.game.playerName}'s citizenship was revoked (${reason}).`);
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
    const plot = L.plots[c.plot];
    if (!plot) return null;
    const bp = L.blueprint(plot, c.bid);
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
    dests.sort((a, b) => a.d - b.d);
    // Letters from the mayor decide where the merchant goes first.
    const pick = this.diplomacy.preferredDest(s.id, dests) || dests[Math.min(dests.length - 1, rng.int(0, Math.min(3, dests.length - 1)))];
    const travel = this.diplomacy.travelHours(s, pick.o);
    const goods = packGoods(L, rec, rng);
    const t = (rec.trip = { phase: 'away', dest: pick.o.id, depart: h, arrive: h + travel * 60, ret: 0, goods, earned: 0, since: day });
    const visit = {
      id: `m${s.id}:${rec.idx}:${h}`, from: s.id, fromName: s.name, fromIdx: rec.idx, name: rec.name, style: s.style, look: rec.look,
      goods, arrive: t.arrive, leave: t.arrive + rng.int(6, 10) * 60, coins: Math.max(10, rec.coins), traded: false, earned: 0,
      // The news from home goes along with the goods.
      news: notableNews(L, day - 5, 3),
    };
    t.ret = visit.leave + travel * 60;
    if (!this.visits.has(pick.o.id)) this.visits.set(pick.o.id, []);
    this.visits.get(pick.o.id).push(visit);
    t.visit = visit.id;
    const mail = this.diplomacy.letters.filter((q) => q.from === s.id && q.to === pick.o.id && q.status === 'waiting').length;
    this.diplomacy.carry(s.id, pick.o.id, rec, t.arrive);
    ledger(L, day, `${rec.name.first} ${rec.name.last} set out for ${pick.o.name} with a pack of goods${mail ? ' and a letter from the mayor' : ''}.`);
    if (rec.ent && !rec.ent.dead) {
      // Walk out of town first, then vanish over the horizon.
      setOverride(rec, h, h + 180, 'travel', { place: 'road' });
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
      // Nobody watched the trip: assume the goods sold at a modest profit.
      for (const [k, n] of Object.entries(t.goods)) earned += Math.round(price(k) * n * 1.25);
    }
    rec.coins += earned;
    rec.earned += earned;
    rec.trip = { phase: 'home', since: day };
    this.visits.set(t.dest, list.filter((q) => q.id !== t.visit));
    const dest = this.game.world.ow.settlements[t.dest];
    ledger(L, day, `${rec.name.first} ${rec.name.last} came back from ${dest ? dest.name : 'the road'} (+¤${earned}).`);
    // ...with the news from there.
    const DL = dest && this.game.world.layouts.get(dest.id);
    if (DL && DL.econ) hearNews(L, dest.name, notableNews(DL, day - 5, 3), day);
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
    // A merchant arriving tells what's happening back home.
    for (const v of list) {
      if (v.told || h < v.arrive) continue;
      v.told = true;
      hearNews(L, v.fromName, v.news, Math.floor(h / DAY));
    }
    const keep = list.filter((v) => h < v.leave + 180 || v.fromIdx !== undefined);
    this.visits.set(sid, keep.filter((v) => !(v.fromIdx === undefined && h >= v.leave)));
    const hod = Math.floor((h % DAY) / 60);
    if (this.game.active.has(sid) && hod >= 8 && hod <= 15 && !keep.some((v) => h >= v.arrive && h < v.leave) && rng.chance(0.07)) {
      const ow = this.game.world.ow;
      const s = L.settlement;
      const from = rng.pick(ow.settlements.filter((o) => o.id !== sid && !deserted(o) && Math.hypot(o.cx - s.cx, o.cz - s.cz) < 18) || []);
      if (!from) return;
      const goods = {};
      const opts = ['cloth', 'string', 'torch', 'apple', 'herb', 'lantern', 'book', 'glass', 'leather', 'iron_ingot', 'coal', 'bread', 'arrow', 'gem', 'rug_blue', 'fishing_rod', 'bow'];
      if (from.coast || from.river) opts.push('fish', 'cooked_fish');
      for (const k of rng.shuffle(opts).slice(0, 6)) if (ITEMS[k]) st.add(goods, k, k === 'gem' ? 1 : rng.int(1, 4));
      const v = makeVisitor(from, rng, h, goods);
      v.traded = true;
      const OL = this.game.world.layouts.get(from.id);
      v.news = OL && OL.econ ? notableNews(OL, this.game.day - 5, 2) : [];
      this.visits.set(sid, [...this.visits.get(sid), v]);
      ledger(L, this.game.day, `A traveling merchant, ${v.name.first} ${v.name.last} of ${from.name}, arrived in town.`);
    }
  }

  visitTrade(L, v, rng) {
    v.traded = true;
    const e = L.econ;
    const k = kitchenOf(L);
    const shop = L.buildings.find((b) => b.type === 'shop');
    const sb = shop ? e.biz[shop.id] : null;
    for (const [item, n] of Object.entries(v.goods)) {
      let buyer = null;
      if (k && ['fish', 'raw_meat', 'carrot', 'cabbage', 'wheat', 'bread', 'cooked_fish'].includes(item)) buyer = k;
      else if (sb) buyer = sb;
      if (!buyer) continue;
      const sell = Math.min(n, rng.int(1, Math.max(1, Math.ceil(n / 2))));
      for (let i = 0; i < sell; i++) {
        const pr = Math.round(price(item) * 1.15);
        if (buyer.till < pr + 5) break;
        buyer.till -= pr;
        v.earned += pr;
        v.coins += pr;
        st.take(v.goods, item, 1);
        st.add(buyer.store, item, 1);
      }
    }
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
        if (!t || t.phase !== 'away' || !alive(rec)) continue;
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
        const road = this.diplomacy.roads.find((r) => r.done && ((r.a === from.id && r.b === to.id) || (r.a === to.id && r.b === from.id)));
        let pos;
        if (road && road.tiles && road.tiles.length) {
          const i = Math.floor((road.a === from.id ? f : 1 - f) * (road.tiles.length - 1));
          const tile = road.tiles[Math.max(0, Math.min(road.tiles.length - 1, i))];
          pos = { x: tile[0], z: tile[2] };
        } else {
          const a = centre(from);
          const b = centre(to);
          pos = { x: Math.round(a.x + (b.x - a.x) * f), z: Math.round(a.z + (b.z - a.z) * f) };
        }
        out.push({ key: `${home.id}:${rec.idx}`, rec, L, from, to, pos, target: centre(to) });
      }
    }
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
      deserted: [...this.deserted],
      renown: [...this.renown],
      // How towns have grown: their size now, and ground they've spread onto.
      grown: this.game.world.ow.settlements.filter((s) => s.baseType || s.suburbs).map((s) => [s.id, s.type, s.baseType || s.type, s.suburbs || null]),
      favors: this.favors.serialize(),
    };
  }

  serializeSettlement(L) {
    const pickRec = (r) => ({
      coins: r.coins, inv: r.inv, skills: r.skills, fed: r.fed, hungry: r.hungry, mood: r.mood, earned: r.earned, earnedY: r.earnedY,
      lastMeal: r.lastMeal, grief: r.grief, override: r.override, away: r.away, leaving: r.leaving, trip: r.trip, doneKey: r.doneKey,
      hp: r.hp, alive: r.alive, traveler: r.traveler, sick: r.sick, deathDay: r.deathDay, cause: r.cause, stall: r.stall, snares: r.snares,
      migrated: r.migrated, home: r.home, bed: r.bed, household: r.household, children: r.children, partner: r.partner, age: r.age, grown: r.grown,
      ...(r.grown ? { hobbies: r.hobbies } : {}),
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
      plots: L.plots.map((p) => !!p.taken),
    };
  }

  applySettlement(L, sv) {
    Object.assign(L.econ, sv.econ);
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
    this.deserted = new Set(data.deserted || []);
    this.renown = new Map(data.renown || []);
    for (const [id, type, base, suburbs] of data.grown || []) {
      const s = this.game.world.ow.settlements[id];
      if (!s) continue;
      if (type !== base) {
        s.baseType = base;
        s.type = type;
      }
      if (suburbs) s.suburbs = suburbs;
    }
    for (const sid of this.deserted) if (this.game.world.ow.settlements[sid]) this.game.world.ow.settlements[sid].deserted = true;
    this.favors.load(data.favors);
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
