// Bandits: exiles and outlaws who band together out in the wilds. They
// pitch a ring of tents and a fire well away from any town, near a road,
// and live off what passes: merchants are robbed on the road, and a village
// with a weak watch is raided now and then. Every few days (or once they've
// been hunted) they strike camp and move on. The towns they hurt put a
// price on their heads, posted on the notice board: bring one down and the
// town hall pays (adventurers passing through go after them too). A realm
// losing a war, with coin to spend, may hire a band to fight for it, if
// the band's hungry enough to take the work.
import { RNG, hash4, clamp } from '../util/rng.js';
import { B, BLOCKS, META_STATE, CANOPY_SHIFT } from '../world/blocks.js';
import { GROUND } from '../config.js';
import { alive, ledger } from './econ.js';
import { makeAdventurer } from '../entities/npcgen.js';
import { CULTURES } from '../world/names.js';
import { BIOMES } from '../world/biomes.js';

const ADJ = ['Black', 'Red', 'Grey', 'Hollow', 'Crooked', 'Ash', 'Iron', 'Night', 'Wolf', 'Bramble', 'Rook', 'Bone'];
const NOUN = ['Hand', 'Hounds', 'Knives', 'Crows', 'Brotherhood', 'Company', 'Gang', 'Blades', 'Hoods', 'Wolves'];
const PER_HEAD = 25; // what a town pays for each, to start with
const fullName = (r) => `${r.name.first} ${r.name.last}`;
// Where they sit round the fire (clear of the tents behind it).
export const FIRESIDE = [[-2, 0], [2, 0], [0, 2], [-2, 2], [2, 2], [-1, 3], [1, 3], [0, 4]];

export class Bandits {
  constructor(game, sim) {
    this.game = game;
    this.sim = sim;
    this.bands = [];
    this.next = 1;
    this.lastDay = null;
    this.started = false;
    this.ents = new Map(); // `${band}:${member}` -> NPC
    this.syncT = 0;
    this.heads = {}; // band id -> how many of theirs you've brought down
    this.hiding = new Map(); // `${band}:${member}` -> sim minute they show again
    this.raiding = null; // a raid you're watching: { band, sid, take }
  }

  get(id) {
    return this.bands.find((b) => b.id === id && !b.done) || null;
  }

  live() {
    return this.bands.filter((b) => !b.done);
  }

  // A band of the world's outlaws already in the hills when it begins.
  start() {
    if (this.started) return;
    this.started = true;
    if (this.bands.length) return;
    const rng = new RNG(hash4(this.game.seed, 0xba4d));
    const towns = this.game.world.ow.settlements.filter((s) => !s.deserted && s.condition !== 'abandoned');
    for (let i = 0, made = 0; i < 8 && made < 2 && towns.length; i++) {
      const s = rng.pick(towns);
      const band = this.form(s, rng, this.game.day);
      if (!band) continue;
      made++;
      const n = rng.int(3, 4);
      for (let k = 0; k < n; k++) band.members.push(this.outlaw(rng, s.style));
    }
  }

  // A made-up outlaw (someone's exile from long ago).
  outlaw(rng, style) {
    const a = makeAdventurer(rng, CULTURES[style] ? style : 'vale', 1);
    return this.member(a.name, a.look, a.personality, a.traits, a.gear.weapon, rng);
  }

  member(name, look, personality, traits, weapon, rng) {
    return {
      id: rng.int(1, 1e9), name, personality, traits: traits || [],
      look: { ...look, hat: 'hood', outfit: rng.pick(['hunter', 'rags', 'vest']), accent: '#3a2a2a' },
      weapon: weapon || rng.pick(['iron_sword', 'stone_sword', 'iron_axe', 'spear', 'club']),
      maxHp: 18 + rng.int(0, 6), hp: 18,
    };
  }

  // A new band, camped out in the wilds near `s`.
  form(s, rng, day) {
    const band = {
      id: this.next++, name: `the ${rng.pick(ADJ)} ${rng.pick(NOUN)}`, members: [], camp: null, loot: 0,
      bounty: {}, hired: null, since: day, moved: day, robbed: -9, raided: -9, done: false, near: s.id,
    };
    if (!this.placeCamp(band, s, rng)) return null;
    this.bands.push(band);
    return band;
  }

  // Join (or found) a band near the town that cast them out.
  recruit(rec, L, day, rng) {
    const s = L.settlement;
    let band = this.live().filter((b) => b.camp && Math.hypot(b.camp.x / 64 - s.cx, b.camp.z / 36 - s.cz) < 16).sort((a, b) => b.members.length - a.members.length)[0];
    if (!band) band = this.form(s, rng, day);
    if (!band) return null;
    band.members.push(this.member(rec.name, rec.look, rec.personality, rec.traits, (rec.equipment?.items || []).find((i) => /sword|axe|spear|club/.test(i.item))?.item, rng));
    band.members[band.members.length - 1].from = s.id;
    return band;
  }

  // ------------------------------------------------------------ camps
  // Open dry ground, well clear of every town, a way off the road.
  placeCamp(band, s, rng) {
    const w = this.game.world;
    const t = w.terrain;
    const ow = w.ow;
    const cx = Math.floor((s.bounds.x0 + s.bounds.x1) / 2);
    const cz = Math.floor((s.bounds.z0 + s.bounds.z1) / 2);
    const clear = (x, z) => !ow.settlements.some((o) => x >= o.bounds.x0 - 18 && x <= o.bounds.x1 + 18 && z >= o.bounds.z0 - 18 && z <= o.bounds.z1 + 18);
    const flat = (x, z) => {
      const c = t.column(x, z, t.context(x, z, x, z), {});
      return c.water < 0 && c.h === GROUND - 1;
    };
    // (Open country first: a clearing, not deep in the woods.)
    const open = (x, z) => {
      const c = t.column(x, z, t.context(x, z, x, z), {});
      const bd = BIOMES[c.biome];
      return !bd || (bd.treeChance || 0) * t.clump(x, z, bd.clump) < 0.3;
    };
    for (let i = 0; i < 60; i++) {
      const a = rng.float(0, Math.PI * 2);
      const r = rng.int(34, 70);
      const x = Math.round(cx + Math.cos(a) * r);
      const z = Math.round(cz + Math.sin(a) * r);
      if (!clear(x, z) || (i < 40 && !open(x, z))) continue;
      let ok = true;
      for (let dx = -1; dx <= 6 && ok; dx++) for (let dz = -1; dz <= 3 && ok; dz++) if (!flat(x + dx, z + dz)) ok = false;
      if (!ok) continue;
      const tents = clamp(Math.ceil(Math.max(4, band.members.length) / 2), 2, 3);
      const ops = [];
      const meta = 0 | (2 << CANOPY_SHIFT);
      for (let k = 0; k < tents; k++) ops.push([x + k * 2, GROUND, z, B.tent, meta]);
      ops.push([x + 1, GROUND, z + 2, B.campfire, META_STATE]);
      // (Clear the brush off first.)
      const w0 = this.game.world;
      const soft = ops.filter(([ox, , oz]) => w0.regionAt(ox, oz) && w0.getBlock(ox, GROUND, oz) !== B.air).map(([ox, , oz]) => [ox, GROUND, oz, B.air, 0]);
      if (soft.length) this.sim.setBlocks(soft);
      this.sim.setBlocks(ops);
      band.camp = { x, z, ops, fire: { x: x + 1, z: z + 2 }, cleared: false };
      band.near = s.id;
      return band.camp;
    }
    return null;
  }

  strikeCamp(band) {
    const c = band.camp;
    if (!c) return;
    const w = this.game.world;
    const ops = c.ops.filter(([x, y, z, id]) => !w.regionAt(x, z) || w.getBlock(x, y, z) === id).map(([x, y, z]) => [x, y, z, B.air, 0]);
    if (ops.length) this.sim.setBlocks(ops);
    band.camp = null;
  }

  // Off somewhere new (never while you're watching).
  move(band, rng, day) {
    if (this.seen(band)) return false;
    const towns = this.game.world.ow.settlements.filter((s) => !s.deserted && s.condition !== 'abandoned' && band.camp && Math.hypot(s.cx - band.camp.x / 64, s.cz - band.camp.z / 36) < 14);
    const s = towns.length ? rng.pick(towns) : this.game.world.ow.settlements[band.near];
    this.strikeCamp(band);
    if (!this.placeCamp(band, s, rng)) return false;
    band.moved = day;
    const L = this.game.world.layouts.get(s.id);
    if (L && L.econ) ledger(L, day, `Smoke's been seen out past ${s.name}: ${band.name} have made a new camp.`);
    return true;
  }

  // Is the camp near you?
  seen(band, r = 48) {
    const p = this.game.player;
    return !!band.camp && Math.max(Math.abs(band.camp.x - p.x), Math.abs(band.camp.z - p.z)) < r;
  }

  // ------------------------------------------------------------ the days
  update(dt) {
    this.start();
    const day = this.game.day;
    if (this.lastDay === null) this.lastDay = day;
    if (day > this.lastDay) {
      for (let d = Math.max(this.lastDay + 1, day - 5); d <= day; d++) this.daily(d, new RNG(hash4(this.game.seed, d, 0xba11)));
      this.lastDay = day;
    }
    this.syncT -= dt;
    if (this.syncT <= 0) {
      this.syncT = 1;
      this.sync();
      this.checkRaid();
    }
  }

  daily(day, rng) {
    for (const band of this.live()) {
      band.members = band.members.filter((m) => m.hp > 0);
      if (!band.members.length) {
        this.wipedOut(band, day, null);
        continue;
      }
      for (const m of band.members) m.hp = Math.min(m.maxHp, m.hp + 4);
      if (band.hired && day >= band.hired.until) {
        const civ = this.game.world.ow.civs[band.hired.civ];
        band.hired = null;
        if (civ) this.sim.realms.proclaim?.(civ, day, `${band.name} have taken their pay and gone back to the hills.`);
      }
      this.hire(band, day, rng);
      if (!band.hired) {
        if (day - band.robbed >= 2 && rng.chance(0.35)) this.rob(band, day, rng);
        if (band.members.length >= 3 && day - band.raided >= 5 && rng.chance(0.15)) this.raid(band, day, rng);
      }
      this.hunted(band, day, rng);
      if (!band.done && (day - band.moved >= 7 + (band.id % 5)) && rng.chance(0.5)) this.move(band, rng, day);
    }
    // Some of the world's outcasts take to the hills on their own.
    if (this.live().length < 2 && rng.chance(0.1)) {
      const towns = this.game.world.ow.settlements.filter((s) => !s.deserted && s.condition !== 'abandoned');
      if (towns.length) {
        const s = rng.pick(towns);
        const band = this.form(s, rng, day);
        if (band) for (let k = 0; k < 3; k++) band.members.push(this.outlaw(rng, s.style));
      }
    }
  }

  // Towns near the camp.
  nearTowns(band, max = 12) {
    if (!band.camp) return [];
    return this.game.world.ow.settlements.filter((s) => !s.deserted && s.condition !== 'abandoned' && Math.hypot(s.cx - band.camp.x / 64, s.cz - band.camp.z / 36) < max)
      .map((s) => this.game.world.layouts.get(s.id)).filter((L) => L && L.econ);
  }

  // A merchant of a nearby town, set on on the road.
  rob(band, day, rng) {
    for (const L of rng.shuffle(this.nearTowns(band))) {
      const rec = L.npcs.find((r) => alive(r) && r.traveler && r.trip && r.trip.phase === 'away' && !r.trip.robbed);
      if (!rec) continue;
      const coins = Math.min(rec.coins || 0, rng.int(10, 40));
      rec.coins -= coins;
      let goods = 0;
      for (const k of Object.keys(rec.trip.goods || {})) {
        const n = Math.ceil(rec.trip.goods[k] / 2);
        rec.trip.goods[k] -= n;
        goods += n;
      }
      rec.trip.robbed = true;
      band.loot += coins + goods * 2;
      band.robbed = day;
      const lost = [coins ? `¤${coins}` : null, goods ? `${goods} goods` : null].filter(Boolean).join(' and ') || 'nothing worth having';
      ledger(L, day, `${fullName(rec)} was robbed on the road by ${band.name}: ${lost} gone.`);
      this.postBounty(L, band, 15, day);
      return rec;
    }
    return null;
  }

  // A village with a weak watch: in by night, out with what they can carry.
  raid(band, day, rng) {
    const L = this.nearTowns(band, 10).filter((q) => q.settlement.type === 'village' || (q.walled === false && q.settlement.type === 'town'))
      .sort((a, b) => this.guardsOf(a) - this.guardsOf(b))[0];
    if (!L) return null;
    band.raided = day;
    // You're there: they come in over the fields.
    if (this.game.active.has(L.settlement.id) && this.startLiveRaid(band, L)) return { live: true };
    const power = band.members.reduce((a, m) => a + (m.hp / m.maxHp), 0) * (band.hired ? 1 : 1.1);
    const defence = this.guardsOf(L) * 1.3 + (L.walled ? 2 : 0) + (this.sim.adventurers?.here(L.settlement.id).length || 0) * 1.5;
    if (power * rng.float(0.7, 1.3) > defence) {
      const take = Math.min(70, Math.round(L.econ.treasury * 0.25));
      L.econ.treasury -= take;
      band.loot += take;
      ledger(L, day, `${band.name} raided ${L.settlement.name} in the night and got away with ¤${take}.`);
      if (L.econ.recent) L.econ.recent.raids = (L.econ.recent.raids || 0) + 1;
      this.postBounty(L, band, 40, day);
      return { won: true, take };
    }
    const fell = band.members.splice(rng.int(0, band.members.length - 1), 1)[0];
    ledger(L, day, `${band.name} tried to raid ${L.settlement.name}, and were beaten off by the watch${fell ? `; ${fell.name.first} ${fell.name.last} was killed` : ''}.`);
    this.postBounty(L, band, 20, day);
    return { won: false };
  }

  guardsOf(L) {
    return L.npcs.filter((r) => alive(r) && !r.away && !r.migrated && r.job === 'guard').length;
  }

  // A price on their heads.
  postBounty(L, band, add, day) {
    const e = L.econ;
    e.bounties ||= [];
    let b = e.bounties.find((q) => q.band === band.id);
    if (!b) {
      b = { band: band.id, name: band.name, perHead: PER_HEAD, day };
      e.bounties.push(b);
      ledger(L, day, `The council of ${L.settlement.name} has put a price on ${band.name}: ¤${b.perHead} a head, paid at the town hall.`);
    }
    b.perHead = Math.min(80, b.perHead + Math.round(add / 4));
    band.bounty[L.settlement.id] = b.perHead;
    return b;
  }

  // Bands camped near a town.
  nearBands(L, max = 12) {
    const s = L.settlement;
    return this.live().filter((b) => b.camp && Math.hypot(s.cx - b.camp.x / 64, s.cz - b.camp.z / 36) < max);
  }

  // Where they're camped, as folk put it.
  where(band, s) {
    const dx = band.camp.x - (s.bounds.x0 + s.bounds.x1) / 2;
    const dz = band.camp.z - (s.bounds.z0 + s.bounds.z1) / 2;
    const ang = Math.atan2(-dz, dx);
    const dirs = ['east', 'north-east', 'north', 'north-west', 'west', 'south-west', 'south', 'south-east'];
    const dir = dirs[((Math.round(ang / (Math.PI / 4)) % 8) + 8) % 8];
    const d = Math.hypot(dx, dz);
    return `${d < 60 ? 'a short walk' : d < 140 ? 'a good way' : 'far'} out to the ${dir}`;
  }

  // What townsfolk say of them.
  talk(L, rng) {
    const s = L.settlement;
    const out = [];
    const bands = this.nearBands(L);
    for (const b of bands.slice(0, 2)) {
      out.push(`${b.name[0].toUpperCase()}${b.name.slice(1)}: ${b.members.length} of them, camped ${this.where(b, s)}.${b.hired ? ' Hired swords now, they say.' : ''}`);
    }
    const bt = this.bountiesIn(L);
    for (const b of bt.slice(0, 2)) out.push(`The council pays ¤${b.perHead} a head for ${b.name}. Bring them down, then see the ${s.type === 'village' ? 'elder' : 'mayor'}.`);
    if (!out.length) out.push('Bandits? Not round here, thank the gods.');
    else out.push(rng.pick(['Don\'t travel the roads alone.', 'They took a merchant\'s whole cart last week.', 'Some of them were folk from round here, once.', 'Mind yourself out there.']));
    return out;
  }

  bountiesIn(L) {
    return (L.econ.bounties || []).filter((b) => this.get(b.band));
  }

  // Bounty hunters (the adventurers about) go after them.
  hunted(band, day, rng) {
    if (band.done || !this.sim.adventurers) return;
    for (const L of this.nearTowns(band)) {
      const bt = this.bountiesIn(L).find((b) => b.band === band.id);
      if (!bt) continue;
      const advs = this.sim.adventurers.here(L.settlement.id).filter((a) => !a.dead);
      const a = advs.length && rng.chance(0.3) ? rng.pick(advs) : null;
      if (!a) continue;
      const kills = rng.chance(0.3 + a.level * 0.15) ? Math.min(band.members.length, rng.int(1, a.level)) : 0;
      const nm = `${a.name.first} ${a.name.last}`;
      if (!kills) {
        a.hp = Math.max(1, a.hp - 10);
        ledger(L, day, `${nm} went after ${band.name} for the bounty, and came back empty-handed and bloodied.`);
        return;
      }
      band.members.splice(0, kills);
      const pay = Math.min(L.econ.treasury, kills * bt.perHead);
      L.econ.treasury -= pay;
      a.coins += pay;
      ledger(L, day, `${nm} brought in ${kills} of ${band.name} for the bounty (¤${pay}).`);
      if (!band.members.length) this.wipedOut(band, day, nm);
      else if (!this.seen(band)) this.move(band, rng, day);
      return;
    }
  }

  // The last of them gone.
  wipedOut(band, day, by) {
    band.done = true;
    const camp = band.camp;
    this.strikeCamp(band);
    const told = new Set(camp ? this.nearTowns({ camp }, 14) : []);
    const home = this.game.world.layouts.get(band.near);
    if (home && home.econ) told.add(home);
    for (const L of told) {
      ledger(L, day, `${band.name} are no more${by ? `, thanks to ${by}` : ''}. The roads are safer for it.`);
    }
    for (const [k, n] of this.ents) {
      if (k.startsWith(`${band.id}:`)) {
        if (n && !n.dead) this.game.despawnNpc(n);
        this.ents.delete(k);
      }
    }
  }

  // ------------------------------------------------------------ hired swords
  // A realm losing its war, with coin to spare, may pay a band to fight;
  // a band that's short of loot (or hunted) takes the work.
  hire(band, day, rng) {
    if (band.hired || band.members.length < 3) return null;
    const war = this.sim.war;
    for (const w of war.wars || []) {
      for (const side of ['a', 'b']) {
        const civ = war.civ(w.lead[side]);
        if (!civ) continue;
        const losing = (side === 'a' ? -1 : 1) * (w.score || 0) > 15 || (w.weary?.[civ.id] || 0) > 0.35;
        const desperate = band.loot < 60 || Object.keys(band.bounty).length >= 2;
        if (!losing || !desperate) continue;
        const cap = this.sim.realms.capitalOf(civ);
        const CL = cap && this.game.world.layouts.get(cap.id);
        const fee = 50 + band.members.length * 15;
        if (!CL || !CL.econ || CL.econ.treasury < fee + 80 || !rng.chance(0.4)) continue;
        CL.econ.treasury -= fee;
        band.loot += fee;
        band.hired = { civ: civ.id, war: w.id, side, until: day + 10 };
        this.sim.realms.proclaim?.(civ, day, `Hard pressed, the ${civ.name.replace(/^The /, '')} have paid ${band.name} ¤${fee} to fight for them.`);
        return band.hired;
      }
    }
    return null;
  }

  // What hired bands add to a side's army (see war.pool).
  hiredFor(w, side) {
    let n = 0;
    for (const b of this.live()) if (b.hired && b.hired.war === w.id && b.hired.side === side) n += b.members.length;
    return n;
  }

  // ------------------------------------------------------------ in front of you
  // A synthetic record for one of them (to walk the world as an NPC).
  recFor(band, m, L) {
    const sched = [{ s: 0, e: 1440, act: 'adventure', place: 'camp' }];
    return {
      id: `b${band.id}:${m.id}`, idx: 7000 + band.id * 20 + (m.id % 20), sid: L.settlement.id, visitor: true, bandit: band.id, member: m.id,
      name: m.name, age: 'adult', job: 'bandit', home: null, bed: 0, household: null,
      partner: null, children: [], parents: [], friends: [], personality: m.personality, traits: m.traits,
      hobbies: [], look: m.look, alive: true, shift: 'day', restDay: -1,
      equipment: { tool: m.weapon, hobbyItem: null, items: [{ item: m.weapon, count: 1 }], coins: 0, armor: 0.1 },
      maxHp: m.maxHp, hp: Math.max(1, m.hp), work: { kind: 'none' }, schedule: { work: sched, rest: sched },
      coins: 3 + (m.id % 9), inv: [], skills: { trading: 0.1, cooking: 0.2, hunting: 0.6, fishing: 0.1, farming: 0, building: 0.1, crafting: 0.2 },
      fed: 1, hungry: 0, mood: 0.5, grief: [], override: null, away: false, doneKey: null,
    };
  }

  // A clearing for the camp: any trees and brush over it cut back (once,
  // when its ground is first loaded).
  clearing(band) {
    const c = band.camp;
    const w = this.game.world;
    if (!c || c.cleared || !w.regionAt(c.x - 3, c.z - 3) || !w.regionAt(c.x + 9, c.z + 6)) return;
    c.cleared = true;
    const ops = [];
    const keep = new Set(c.ops.map(([x, y, z]) => `${x},${y},${z}`));
    for (let x = c.x - 3; x <= c.x + 9; x++) {
      for (let z = c.z - 3; z <= c.z + 6; z++) {
        for (let y = GROUND; y <= GROUND + 9; y++) {
          if (keep.has(`${x},${y},${z}`)) continue;
          const id = w.getBlock(x, y, z);
          const d = BLOCKS[id];
          if (!d || id === B.air) continue;
          if (/^(log_|leaves)/.test(d.name) || (y === GROUND && d.replaceable && !d.liquid)) ops.push([x, y, z, B.air, 0]);
        }
      }
    }
    if (ops.length) this.sim.setBlocks(ops);
    // (And the camp itself, if the brush was in the way when it was made.)
    const missing = c.ops.filter(([x, y, z, id]) => w.getBlock(x, y, z) !== id);
    if (missing.length) this.sim.setBlocks(missing);
  }

  // Their camp near you: there they are, round the fire.
  sync() {
    const g = this.game;
    for (const band of this.live()) {
      if (!band.camp) continue;
      if (this.seen(band, 60)) this.clearing(band);
      const near = this.seen(band, 40) && g.world.regionAt(band.camp.x, band.camp.z);
      band.members.forEach((m, i) => {
        const k = `${band.id}:${m.id}`;
        const n = this.ents.get(k);
        if (n && !n.dead) {
          if (!near && n.warband && n.warband.phase === 'camp') {
            g.despawnNpc(n);
            this.ents.delete(k);
          }
          return;
        }
        if (n && n.dead) this.ents.delete(k);
        if (!near || (this.hiding.get(k) || 0) > this.sim.abs) return;
        const L = g.sim.layoutOf(band.near);
        if (!L) return;
        // (Round the fire, on the far side from the tents.)
        const [ox, oz] = FIRESIDE[i % FIRESIDE.length];
        const x = band.camp.fire.x + ox;
        const z = band.camp.fire.z + oz;
        const y = g.world.findStandY(x, z, GROUND);
        if (y <= 0) return;
        const spot = g.findFreeSpot(x, z, y);
        const e = g.spawnWarrior(this.recFor(band, m, L), L, spot);
        e.warband = { kind: 'bandit', side: 'bandit', civ: null, foe: true, band: band.id, member: m.id, home: { ...band.camp.fire }, phase: 'camp' };
        e.hostileNow = true;
        this.ents.set(k, e);
      });
    }
  }

  // Off licking their wounds (away from the fire for a few hours).
  fled(n) {
    const wb = n.warband;
    if (wb) this.hiding.set(`${wb.band}:${wb.member}`, this.sim.abs + 240);
  }

  // A handful from the strongbox (in a raid you're watching).
  grab(n, amount) {
    const R = this.raiding;
    if (!R || R.band !== n.warband.band) return 0;
    const L = this.sim.layoutOf(R.sid);
    if (!L || !L.econ) return 0;
    const take = Math.min(amount, Math.max(0, L.econ.treasury), 80 - R.take);
    if (take <= 0) return 0;
    L.econ.treasury -= take;
    R.take += take;
    return take;
  }

  // The raid you watched is over once the last of them is gone (or down).
  checkRaid() {
    const R = this.raiding;
    if (!R) return;
    const band = this.get(R.band);
    const still = band && [...this.ents].some(([k, n]) => k.startsWith(`${band.id}:`) && n && !n.dead && n.warband && n.warband.phase !== 'flee' && n.warband.town === R.sid);
    if (still && this.sim.abs - R.at < 240) return;
    this.raiding = null;
    const L = this.sim.layoutOf(R.sid);
    this.sim.war.wakeDowned();
    if (!L || !L.econ) return;
    const name = band ? band.name : R.name;
    if (band) band.loot += R.take;
    const lost = R.n - (band ? band.members.length : 0);
    ledger(L, this.game.day, R.take ? `${name} raided ${L.settlement.name} and got away with ¤${R.take}.` : `${name} came raiding ${L.settlement.name}, and went away with nothing${lost > 0 ? `, leaving ${lost} of their own dead` : ''}.`);
    if (L.econ.recent) L.econ.recent.raids = (L.econ.recent.raids || 0) + 1;
    if (band) this.postBounty(L, band, R.take ? 40 : 20, this.game.day);
    if (this.game.active.has(R.sid)) this.game.ui.msg(R.take ? `${name[0].toUpperCase()}${name.slice(1)} got away with ¤${R.take}.` : `${name[0].toUpperCase()}${name.slice(1)} have been driven off.`, R.take ? '#ffb080' : '#a0e0a0');
  }

  // They come in over the fields, for the square and the strongbox.
  startLiveRaid(band, L) {
    const g = this.game;
    const p = L.plaza;
    const b = L.settlement.bounds;
    const dx = Math.sign(band.camp.x - p.cx) || 1;
    const dz = Math.sign(band.camp.z - p.cz);
    const fx = dx > 0 ? b.x1 + 8 : b.x0 - 8;
    const fz = Math.round(p.cz + dz * 4);
    if (!g.world.regionAt(fx, fz)) return false;
    let n = 0;
    band.members.forEach((m, i) => {
      const k = `${band.id}:${m.id}`;
      const old = this.ents.get(k);
      if (old && !old.dead) g.despawnNpc(old);
      const x = fx + (i % 2) * dx;
      const z = fz + i - 1;
      const y = g.world.findStandY(x, z, GROUND);
      if (y <= 0) return;
      const spot = g.findFreeSpot(x, z, y);
      const e = g.spawnWarrior(this.recFor(band, m, L), L, spot);
      e.warband = { kind: 'bandit', side: 'bandit', civ: null, foe: true, band: band.id, member: m.id, home: { x: fx + dx * 20, z: fz }, phase: 'raid', goal: { x: p.cx, z: p.cz }, town: L.settlement.id, torch: i % 2 === 0 };
      e.hostileNow = true;
      this.ents.set(k, e);
      n++;
    });
    if (!n) return false;
    this.raiding = { band: band.id, sid: L.settlement.id, take: 0, at: this.sim.abs, n: band.members.length, name: band.name };
    g.ui.msg(`${band.name[0].toUpperCase()}${band.name.slice(1)} are raiding ${L.settlement.name}!`, '#ff7060');
    g.audio?.play('alarm');
    if (g.sleep && g.sleep.phase !== 'out') g.wakeUp?.(true);
    return true;
  }

  // One of them fell (see game.kill).
  onKilled(n, source) {
    const band = this.get(n.warband.band);
    if (!band) return;
    const i = band.members.findIndex((m) => m.id === n.warband.member);
    const m = i >= 0 ? band.members[i] : null;
    if (i >= 0) band.members.splice(i, 1);
    this.ents.delete(`${band.id}:${n.warband.member}`);
    if (source && source.kind === 'player') {
      this.heads[band.id] = (this.heads[band.id] || 0) + 1;
      this.headNames ||= {};
      (this.headNames[band.id] ||= []).push(m ? fullName(m) : n.name);
      const posted = Object.keys(band.bounty).length;
      this.game.ui.msg(`One of ${band.name} down.${posted ? ' (There\'s a price on their heads: claim it from the mayor of a town that posted one.)' : ''}`, '#e8c080');
    }
    if (!band.members.length) this.wipedOut(band, this.game.day, source && source.kind === 'player' ? this.game.playerName : null);
  }

  // Hurt in a fight: keep the record's hp in step.
  onHurt(n) {
    const band = this.get(n.warband?.band);
    const m = band && band.members.find((q) => q.id === n.warband.member);
    if (m) m.hp = Math.max(1, n.hp);
  }

  // At a town hall: what you're owed for the heads you've brought down.
  claimable(L) {
    let total = 0;
    const lines = [];
    for (const b of L.econ.bounties || []) {
      const n = this.heads[b.band] || 0;
      if (!n) continue;
      total += n * b.perHead;
      lines.push({ band: b.band, name: b.name, n, pay: n * b.perHead });
    }
    return { total, lines };
  }

  claim(L) {
    const c = this.claimable(L);
    if (!c.total) return null;
    const e = L.econ;
    const pay = Math.min(c.total, Math.max(0, e.treasury));
    e.treasury -= pay;
    this.game.player.give('coin', pay);
    for (const q of c.lines) {
      delete this.heads[q.band];
      ledger(L, this.game.day, `${this.game.playerName} claimed the bounty on ${q.n} of ${q.name} (¤${q.pay}).`);
      // Took down a whole band: the town remembers it.
      if (!this.get(q.band)) {
        this.sim.addRenown(L.settlement.id, 10, `ridding ${L.settlement.name} of ${q.name}`);
        e.bounties = (e.bounties || []).filter((b) => b.band !== q.band);
      }
    }
    return { pay, owed: c.total - pay };
  }

  serialize() {
    return { bands: this.bands, next: this.next, lastDay: this.lastDay, started: this.started, heads: this.heads, headNames: this.headNames || {} };
  }

  load(d) {
    this.ents = new Map();
    this.hiding = new Map();
    this.raiding = null;
    if (!d) return;
    this.bands = d.bands || [];
    this.next = d.next || 1;
    this.lastDay = d.lastDay ?? null;
    this.started = !!d.started;
    this.heads = d.heads || {};
    this.headNames = d.headNames || {};
  }
}

