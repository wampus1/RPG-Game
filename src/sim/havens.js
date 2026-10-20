// (Round 130) The pirates' havens. Each guild of the brethren (see
// game/pirates.js) has a real place ashore by its cove: shacks of salvage
// on a lonely shore far from any town, a rum house and a guild hall, the
// fence's, a gunsmith and a sawbones, a stockade with its captives in it,
// a gallows down by the water, and the people who live there (corsairs and
// their families, an old salt or two, the quartermaster who keeps the
// place for the guild). Its people live their days as anyone's do.
//
// Like the old places (see dungeons.js), a haven is hidden: not on your map
// till you come upon it, or hear of it (a fisherman's talk in a tavern, a
// captive come home, a chart off a beaten captain, the brethren themselves
// once you're sworn to them). Each player knows what they know.
//
// A realm that learns where one is may send men to burn it out, and then
// it's gone for good (see brethren.js); but a lonely village gone bad, or a
// captain who's fallen out with their guild, can make a new one.
import { RNG, hash4 } from '../util/rng.js';
import { REGION_W, REGION_D, MAP_W, MAP_H, GROUND } from '../config.js';
import { ledger, alive, DAY } from './econ.js';
import { exploredByAny, seatMap } from '../game/party.js';
import { pidOf, playerOf, playerName, seatOfPid } from './saga/refs.js';
import { isHaven } from './havenref.js';
import { covesOf, GUILDS } from '../game/pirates.js';
import { piracyOf, pirateTo, PIRATE_AT } from '../game/piracy.js';
import { relocate } from './civic.js';
import { retrain, makeAdventurer } from '../entities/npcgen.js';
import { B } from '../world/blocks.js';
import { GUILD_FLAGS } from '../world/havenkit.js';
import { ignite } from '../game/fire.js';

const NOTICE_AT = 22; // paces from its edge at which you come upon one
const HUNT_AT = 120; // the price on a pirate's head that brings out bounty hunters
const centre = (s) => ({ x: Math.floor((s.cx + (s.cw || 1) / 2) * REGION_W), z: Math.floor((s.cz + (s.cd || 1) / 2) * REGION_D) });

export class Havens {
  constructor(game, sim) {
    this.game = game;
    this.sim = sim;
    this.list = [];
    this.next = 1;
    this.placed = false;
    this.t = 0;
  }

  get(id) {
    return this.list.find((h) => h.id === id) || null;
  }

  // The haven at settlement `sid` (standing or burned), or null.
  of(sid) {
    return this.list.find((h) => h.sid === sid) || null;
  }

  // The standing ones (of guild `g`, if given).
  standing(g = null) {
    return this.list.filter((h) => !h.razed && (g === null || h.guild === g));
  }

  settlement(h) {
    return h ? this.game.world.ow.settlements[h.sid] || null : null;
  }

  layout(h) {
    const s = this.settlement(h);
    return s ? this.game.world.layouts.get(s.id) || null : null;
  }

  centre(h) {
    const s = this.settlement(h);
    return s ? centre(s) : null;
  }

  // ------------------------------------------------------------ the first
  // Each guild's haven ashore by its cove: put on the map the first time
  // the world wants them (a new world, before anything's laid out round
  // you; an older world, brought up to date: see migrate.js).
  ensure() {
    if (this.placed) return this.list;
    this.placed = true;
    if (this.game.remote) return this.list;
    const coves = covesOf(this.game);
    for (const cove of coves) {
      if (this.list.some((h) => h.guild === cove.guild && h.origin === 'old')) continue;
      const rng = new RNG(hash4(this.game.seed >>> 0, cove.guild, 0x4a7e5));
      const at = this.siteNear(cove.shore, cove, rng) || this.lonelyShore(rng, cove.land);
      if (!at) continue;
      this.create(at.cx, at.cz, cove.guild, cove.name, 'old', rng, { cove: { x: cove.x, z: cove.z } });
    }
    return this.list;
  }

  // Can a haven go on map square (cx, cz)? Dry, lowland, far from any town,
  // and never yet seen or walked by anyone (so the land can be laid out
  // round it as it's made).
  open(cx, cz) {
    const ow = this.game.world.ow;
    const w = this.game.world;
    const c = ow.cell(cx, cz);
    if (!c || cx < 1 || cz < 1 || cx >= MAP_W - 1 || cz >= MAP_H - 1) return false;
    if (['ocean', 'mountain', 'volcano', 'swamp'].includes(c.biome) || c.lake || c.settlement !== null || (c.mountainness || 0) > 0.3) return false;
    if (ow.settlements.some((o) => Math.hypot(o.cx - cx, o.cz - cz) < 3.2)) return false;
    const k = w.regionKey(cx, cz);
    if (exploredByAny(this.game, cz * MAP_W + cx) || w.regions.has(k) || (w.saved && w.saved.has(k))) return false;
    // (Not in the storm wall itself.)
    if (c.storm) return false;
    return true;
  }

  // The first open square inland from a cove's shore (walking in from the
  // water), by the sea if it can be.
  siteNear(shore, cove, rng) {
    if (!shore) return null;
    const ow = this.game.world.ow;
    const dx = shore.x - cove.x;
    const dz = shore.z - cove.z;
    const d = Math.hypot(dx, dz) || 1;
    const ux = dx / d;
    const uz = dz / d;
    const seen = new Set();
    const opts = [];
    for (let r = 0; r < 220; r += 8) {
      for (const side of [0, -40, 40]) {
        const x = shore.x + ux * r - uz * side;
        const z = shore.z + uz * r + ux * side;
        const cx = Math.floor(x / REGION_W);
        const cz = Math.floor(z / REGION_D);
        const k = cz * MAP_W + cx;
        if (seen.has(k)) continue;
        seen.add(k);
        if (!this.open(cx, cz)) continue;
        const c = ow.cell(cx, cz);
        const land = this.landIn(cx, cz);
        if (land < 0.6) continue;
        opts.push({ cx, cz, r, land, coast: ow.nearOcean(c) });
      }
    }
    if (!opts.length) return null;
    // (By the sea, with room on it for a haven, and as near the cove as
    // can be.)
    opts.sort((a, b) => (b.coast ? 1 : 0) - (a.coast ? 1 : 0) || (b.land >= 0.8 ? 1 : 0) - (a.land >= 0.8 ? 1 : 0) || a.r - b.r);
    return opts[0];
  }

  // How much of map square (cx, cz) is dry land (0 to 1).
  landIn(cx, cz) {
    const ow = this.game.world.ow;
    let n = 0;
    let dry = 0;
    for (let j = 0; j < 6; j++) {
      for (let i = 0; i < 8; i++) {
        n++;
        if (ow.continentAt(cx * REGION_W + 4 + i * 8, cz * REGION_D + 3 + j * 6) > 0.02) dry++;
      }
    }
    return dry / n;
  }

  // Anywhere lonely by the sea (of land `land` first), for a haven.
  lonelyShore(rng, land = null) {
    const ow = this.game.world.ow;
    const out = [];
    // (Looked for here and there over the map, not square by square.)
    for (let i = 0; i < 3000 && out.length < 40; i++) {
      const cx = rng.int(2, MAP_W - 3);
      const cz = rng.int(2, MAP_H - 3);
      const c = ow.cell(cx, cz);
      if (!c || c.biome === 'ocean' || !ow.nearOcean(c)) continue;
      if (ow.settlements.some((o) => Math.hypot(o.cx - cx, (o.cz - cz) * 1.4) < 6)) continue;
      if (!this.open(cx, cz) || this.landIn(cx, cz) < 0.6) continue;
      out.push({ cx, cz, own: land && c.island === land ? 0 : 1 });
    }
    if (!out.length) return null;
    out.sort((a, b) => a.own - b.own);
    const best = out.filter((q) => q.own === out[0].own);
    return best[rng.int(0, best.length - 1)];
  }

  // A new haven of guild `guild` on square (cx, cz), named `name`: a place
  // on the map (in no realm), laid out when it's first wanted.
  create(cx, cz, guild, name, origin, rng, extra = {}) {
    const ow = this.game.world.ow;
    const s = ow.makeSettlement('village', cx, cz, 1, 1, null, new RNG(hash4(this.game.seed >>> 0, cx, cz, 0x4a7)));
    if (name && !ow.settlements.some((o) => o !== s && o.name === name)) s.name = name;
    s.condition = 'poor';
    const id = this.next++;
    s.haven = { id, guild };
    const F = this.sim.founding;
    F.register(s);
    F.made.push(F.describe(s));
    const h = {
      id, sid: s.id, guild, name: s.name, origin, since: this.game.day, know: {}, told: {}, razed: null,
      stores: { plunder: 120 + rng.int(0, 120), rum: 40 + rng.int(0, 30), powder: 30 + rng.int(0, 20), timber: 40 },
      ...extra,
    };
    this.list.push(h);
    return h;
  }

  // ------------------------------------------------------------ knowing
  knows(sid, pid) {
    const h = this.of(sid);
    if (!h) return 'seen';
    const k = (h.know && h.know[pid]) || false;
    if (k || !h.cover) return k;
    // (A village turned pirate: those who've been there know a village.)
    const s = this.settlement(h);
    const seat = seatOfPid(this.game, pid);
    const om = seat ? seatMap(this.game, seat) : this.game.world.ow;
    return s && om.explored && om.explored[s.cz * MAP_W + s.cx] ? 'cover' : false;
  }

  // `pid` has come upon haven `h` (or heard of it: 'heard'). True if that's
  // news to them.
  learn(h, pid, how = 'seen', from = null) {
    if (!h || !pid) return false;
    h.know ||= {};
    const was = h.know[pid];
    if (was === 'seen' || (was === 'heard' && how === 'heard')) return false;
    h.know[pid] = how;
    const p = playerOf(this.game, pid);
    const s = this.settlement(h);
    if (!p || !s) return true;
    const c = centre(s);
    const G = GUILDS[h.guild] || GUILDS[0];
    const mark = () => {
      const ow = this.game.world.ow;
      if (how === 'seen') {
        ow.markExplored(c.x, c.z, 0);
        // (The rough mark of it, if they'd only heard: taken off.)
        const i = (ow.pins || []).findIndex((q) => q.haven === h.id && q.rough);
        if (i >= 0) {
          ow.pins.splice(i, 1);
          ow.pinsV = (ow.pinsV || 0) + 1;
        }
        ow.pin(c.x, c.z, `${h.name} (a pirates' haven)`, '×', { haven: h.id });
      } else {
        // (Somewhere about there: a rough mark, a little off.)
        const r = new RNG(hash4(h.id, pid.length, 0x9e4d));
        ow.pin(c.x + r.int(-40, 40), c.z + r.int(-24, 24), `${h.name}? (pirates, heard of${from ? ` from ${from}` : ''})`, '?', { haven: h.id, rough: true });
      }
    };
    this.game.asPlayer ? this.game.asPlayer(p, mark) : mark();
    if (how === 'heard') this.tell(pid, `You've heard where ${G.name} keep a haven: ${h.name}, somewhere about the place marked on your map.`, '#e0c890');
    return true;
  }

  tell(pid, text, color = '#e8d8a0') {
    const p = playerOf(this.game, pid);
    if (!p) return;
    const say = () => this.game.ui.msg(text, color);
    this.game.asPlayer ? this.game.asPlayer(p, say) : say();
  }

  // What someone in a town (`npc`, of layout L) might tell `pid` of the
  // pirates hereabouts: a haven they'd not heard of (and it goes on their
  // map, roughly), or only talk. { line, h } or { line }.
  rumour(L, rec, pid, rng) {
    const s = L.settlement;
    const job = rec.job;
    const knowing = { fisher: 0.85, innkeeper: 0.65, barkeep: 0.65, guard: 0.5, merchant: 0.55, laborer: 0.4, builder: 0.3 }[job] ?? 0.25;
    const here = isHaven(s) ? this.of(s.id) : null;
    const cand = this.list.filter((h) => !h.razed && h !== here && !(h.know && h.know[pid])).map((h) => {
      const o = this.settlement(h);
      const d = o ? Math.hypot(o.cx - s.cx, (o.cz - s.cz) * 1.4) : 999;
      // (In a haven, the brethren know their own guild's.)
      const own = here && here.guild === h.guild;
      const told = h.told && h.told[s.id];
      const p = own ? 0.9 : told ? 0.95 : knowing * (d < 20 ? 1 : d < 45 ? 0.55 : d < 90 ? 0.25 : 0.08);
      return { h, d, p };
    }).sort((a, b) => b.p - a.p);
    const q = cand.find((c) => rng.chance(c.p));
    if (!q) {
      const lines = s.coast || isHaven(s)
        ? [`Pirates? There's always talk. Black sails seen off the point, a fishing smack gone missing. Where they go after, nobody knows.`, `They say the brethren have a place of their own somewhere, far off on a lonely shore. If anyone here knows where, they're not saying.`, `Keep your purse close and your eyes on the horizon. That's all I know of pirates.`]
        : [`Pirates? We're a long way from the sea here, friend.`, `Ask down at the coast. Fisherfolk hear things.`];
      return { line: rng.pick(lines) };
    }
    const h = q.h;
    const G = GUILDS[h.guild] || GUILDS[0];
    const o = this.settlement(h);
    const where = o ? dirWords(s, o) : 'far off';
    const say = here
      ? [`${h.name}? That's one of ${G.name === GUILDS[here.guild].name ? 'ours' : `${G.name}'s`}, ${where}. Tell 'em I sent you, and keep your hand off your sword.`]
      : h.told && h.told[s.id]
        ? [`Everyone knows now: ${h.name}, ${where}, a nest of ${G.name}. One of ours came home from their stockade and told it.`]
        : {
          fisher: [`I'll tell you, but you didn't hear it from me. Out ${where}, past where any sane boat goes, there's a cove the black ships run into: ${h.name}, the brethren call it. Shacks on the shore, and a gallows.`, `My cousin's boat was taken off the point, and they were held a while at a place called ${h.name}, ${where}. Came back thinner, and with stories.`],
          innkeeper: [`Sailors drink, and sailors talk. There's a haven of ${G.name} ${where}: ${h.name}. Don't go looking for it.`],
          barkeep: [`A one-eyed fellow paid in foreign coin last month, and when he'd had a few he wouldn't stop about ${h.name}, ${where}. A pirates' den, by the sound of it.`],
          guard: [`The watch knows more than it lets on. ${G.name} keep a haven ${where}, ${h.name}. The realm would give a good deal to know exactly where.`],
          merchant: [`We lost a cargo to ${G.name}. It turned up again, sold off cheap by some fence at ${h.name}, ${where}, so they say.`],
        }[job] || [`They say there's a pirates' haven ${where}. ${h.name}, it's called. I wouldn't know more than that.`];
    this.learn(h, pid, 'heard', s.name);
    return { line: rng.pick(say), h };
  }

  // Each little while: anyone come close enough to see one finds it.
  notice() {
    const g = this.game;
    if (g.remote || g.dungeon) return;
    for (const p of g.everyone ? g.everyone() : [g.player]) {
      if (!p || p.dead) continue;
      const pid = pidOf(p);
      for (const h of this.list) {
        if (h.know && h.know[pid] === 'seen') continue;
        const s = this.settlement(h);
        if (!s) continue;
        const b = s.bounds;
        const dx = Math.max(b.x0 - p.x, 0, p.x - b.x1);
        const dz = Math.max(b.z0 - p.z, 0, p.z - b.z1);
        if (Math.max(dx, dz) > NOTICE_AT) continue;
        this.learn(h, pid, 'seen');
        this.found(h, p);
      }
    }
  }

  // Come upon: told, and (on their own screen) the haven shown them.
  found(h, p) {
    const G = GUILDS[h.guild] || GUILDS[0];
    const s = this.settlement(h);
    const show = () => {
      if (h.razed) {
        this.game.ui.msg(`You come upon what's left of ${h.name}: a pirates' haven, burned out by the ${h.razed.byName || 'realm'}. The gulls have it now.`, '#c8b8a0');
        return;
      }
      this.game.ui.msg(`You come upon ${h.name}, a haven of ${G.name}: shacks of salvage on the shore, black sails off it. (Marked on your map.)`, '#ff9070');
      this.game.audio?.play('secret');
      this.game.showHavenCard?.(h, s);
    };
    this.game.asPlayer ? this.game.asPlayer(p, show) : show();
    this.sim.saga?.emit('haven_found', { haven: h.id, sid: h.sid, pid: pidOf(p) });
  }

  // ------------------------------------------------------------ captives
  // Those the brethren of haven `h` hold, in its stockade (see war.js: a
  // prisoner like any other, but the pirates': `p.pirate`, their guild).
  held(h) {
    return (this.sim.war ? this.sim.war.prisoners : []).filter((p) => p.haven === h.id);
  }

  // Someone taken by the pirates of haven `h`: a fisher off their boat, a
  // sailor off a merchantman, a villager off the shore. From a coastal town
  // (of realm `civ`, if given) already laid out. The prisoner, or null.
  takeCaptive(h, how, rng, day = this.game.day, civ = null, from = null) {
    const war = this.sim.war;
    if (!war || h.razed) return null;
    const towns = from ? [from] : [...this.game.world.layouts.values()].filter((L) => L.econ && L.settlement.coast && !isHaven(L.settlement) && !L.settlement.deserted && L.settlement.condition !== 'abandoned' && (civ === null || (L.settlement.civ && L.settlement.civ.id === civ)));
    // (None laid out yet: the nearest port to the haven, laid out now.)
    if (!towns.length && !from) {
      const hs = this.settlement(h);
      const ports = this.game.world.ow.settlements.filter((o) => o.coast && !o.haven && !o.deserted && o.condition !== 'abandoned' && (civ === null || (o.civ && o.civ.id === civ)));
      if (hs && ports.length) {
        ports.sort((a, b) => Math.hypot(a.cx - hs.cx, a.cz - hs.cz) - Math.hypot(b.cx - hs.cx, b.cz - hs.cz));
        const PL = this.game.world.getLayout(ports[0]);
        if (PL && PL.econ) towns.push(PL);
      }
    }
    if (!towns.length) return null;
    const L = towns[rng.int(0, towns.length - 1)];
    const people = L.npcs.filter((r) => alive(r) && !r.away && !r.visitor && r.age === 'adult' && r.ruler === undefined && r.job !== 'mayor' && r.captive === undefined && r.soldier === undefined && r.raid === undefined && !(r.ent && !r.ent.dead));
    if (!people.length) return null;
    const pref = people.filter((r) => ['fisher', 'merchant', 'laborer', 'trapper'].includes(r.job));
    const pool = pref.length && rng.chance(0.7) ? pref : people;
    const rec = pool[rng.int(0, pool.length - 1)];
    const p = war.takePrisoner(rec, L, null, day, how, h.sid);
    if (!p) return null;
    p.pirate = h.guild;
    p.haven = h.id;
    p.ransom = 30 + rng.int(0, 50) + (rec.job === 'merchant' ? 40 : 0);
    p.noted = day;
    const G = GUILDS[h.guild] || GUILDS[0];
    ledger(L, day, `${p.name} was ${how} by pirates of ${G.name}. Nobody knows where they've been taken.`);
    return p;
  }

  // Home again, out of a haven's stockade: and they tell where it is.
  released(p, how, day) {
    const h = this.get(p.haven);
    if (!h) return;
    const ow = this.game.world.ow;
    const home = ow.settlements[p.sid];
    if (!home) return;
    h.told ||= {};
    h.told[home.id] = day;
    if (home.civ) this.tellRealm(h, home.civ.id, `${p.name}, home from captivity`, day);
    const L = this.game.world.layouts.get(home.id);
    if (L && L.econ) ledger(L, day, `${p.name} can say where the pirates keep their haven: ${h.name}. Everyone in ${home.name} knows it now.`);
  }

  // Does realm `civ` know where haven `h` is?
  realmKnows(h, civ) {
    return !!(h.realms && h.realms[civ] !== undefined);
  }

  // Realm `civ` learns where haven `h` is (`how`: who told them).
  tellRealm(h, civ, how, day = this.game.day) {
    h.realms ||= {};
    if (h.realms[civ] !== undefined) return false;
    h.realms[civ] = day;
    const C = (this.game.world.ow.civs || [])[civ];
    const cap = C && this.sim.realms.capitalOf ? this.sim.realms.capitalOf(C) : null;
    const L = cap && this.game.world.layouts.get(cap.id);
    if (L && L.econ) ledger(L, day, `${how} has told the court where the pirates' haven is: ${h.name}. There's talk of sending ships to burn it out.`);
    this.sim.saga?.emit('haven_told', { haven: h.id, civ, day });
    return true;
  }

  // A captive's ransom paid (by `payer`, a player, or their town): free.
  ransomed(p, by = 'town', day = this.game.day) {
    const h = this.get(p.haven);
    if (h) h.stores.plunder += p.ransom || 0;
    this.sim.brethren?.income(p.pirate, p.ransom || 0, 'a ransom');
    this.sim.war.release(p, 'ransomed', day);
    void by;
  }

  // Each day: the ransom notes, the towns that pay, and those nobody pays
  // for, pressed into the crew at last.
  ransomDay(h, day, rng) {
    const war = this.sim.war;
    const ow = this.game.world.ow;
    for (const p of this.held(h)) {
      const home = ow.settlements[p.sid];
      const HL = home && this.game.world.layouts.get(home.id);
      if (!HL || !HL.econ) continue;
      const days = day - p.day;
      if (days > 0 && days % 5 === 0 && p.noted !== day) {
        p.noted = day;
        const pay = HL.econ.treasury > (p.ransom || 40) + 60 && rng.chance(0.35);
        if (pay) {
          HL.econ.treasury -= p.ransom || 40;
          ledger(HL, day, `The town paid the pirates ¤${p.ransom} to have ${p.name} back.`);
          this.ransomed(p, 'town', day);
          continue;
        }
        ledger(HL, day, `A ransom note came from the pirates: ¤${p.ransom} for ${p.name}. The town can't (or won't) pay it.`);
      }
      if (days >= 24 && rng.chance(0.08)) this.press(h, p, day);
    }
    void war;
  }

  // Nobody's paid for them: they've taken the brethren's oath, to live,
  // and they're one of the haven's now.
  press(h, p, day) {
    const war = this.sim.war;
    const r = war.recOfPrisoner(p);
    const FL = this.game.world.layouts.get(p.sid);
    const HL = this.layout(h);
    war.prisoners = war.prisoners.filter((q) => q !== p);
    if (!r || !FL || !HL || !alive(r)) return;
    delete r.captive;
    r.away = false;
    ledger(FL, day, `Word is that ${p.name}, taken by the pirates, has sworn their oath and sails with them now.`);
    ledger(HL, day, `${p.name}, a captive nobody would pay for, has taken the oath: a deckhand now.`);
    relocate(this.sim, FL, [r], HL, 'pressed into the crew');
  }

  // A haven's first captives, the first day it's lived in.
  seed(h, day, rng) {
    h.seeded = true;
    const n = rng.int(1, 3);
    for (let i = 0; i < n; i++) this.takeCaptive(h, rng.pick(['taken off a fishing boat', 'taken off a merchantman', 'carried off from the shore']), rng, day - rng.int(1, 12));
  }

  daily(day) {
    for (const h of this.list) {
      if (h.razed) continue;
      const L = this.layout(h);
      if (!L || !L.econ) continue;
      const rng = new RNG(hash4(this.game.seed >>> 0, h.id, day, 0xca97));
      if (!h.seeded) this.seed(h, day, rng);
      this.ransomDay(h, day, rng);
    }
    this.sim.brethren?.daily(day);
  }

  // ------------------------------------------------------------ the realms
  // Realm C sends marines against haven `h`: the guards of its coastal town
  // nearest it (all but one), by longboat, in two nights' time. The raid
  // (see war.js: fought out on the beach if you're there), or null.
  expedition(C, h, day, rng) {
    const war = this.sim.war;
    const s = this.settlement(h);
    if (!war || !s || h.razed) return null;
    const towns = this.sim.realms.memberLayouts(C).filter((L) => L.settlement.coast && !isHaven(L.settlement));
    if (!towns.length) return null;
    towns.sort((a, b) => Math.hypot(a.settlement.cx - s.cx, a.settlement.cz - s.cz) - Math.hypot(b.settlement.cx - s.cx, b.settlement.cz - s.cz));
    const FL = towns[0];
    const people = FL.npcs.filter((r) => alive(r) && !r.away && !r.visitor && r.age === 'adult' && r.ruler === undefined && r.job !== 'mayor' && r.raid === undefined && r.soldier === undefined && r.captive === undefined);
    const guards = people.filter((r) => r.job === 'guard').sort((a, b) => (b.personality?.bravery ?? 0.5) - (a.personality?.bravery ?? 0.5));
    const bold = people.filter((r) => r.job !== 'guard' && (r.personality?.bravery ?? 0) > 0.55);
    const party = [...guards.slice(0, Math.max(0, guards.length - 1)), ...bold].slice(0, 8);
    if (party.length < 4) return null;
    const id = war.nextId++;
    const at = (day + 2) * DAY + 21 * 60 + rng.int(0, 150);
    const raid = { id, civ: C.id, foe: null, from: FL.settlement.id, to: h.sid, at, party: party.map((r) => ({ sid: FL.settlement.id, idx: r.idx })), state: 'march', day, naval: true, haven: h.id };
    for (const r of party) {
      r.raid = id;
      r.away = true;
      if (r.ent && !r.ent.dead) this.game.despawnNpc(r.ent);
    }
    war.raids.push(raid);
    h.expedition = id;
    const TL = this.layout(h);
    if (TL && TL.econ) TL.econ.raidAlert = at + 12 * 60;
    const rn = C.name.replace(/^The /, '');
    ledger(FL, day, `${party.length} of the watch took to the longboats with the ${rn}'s marines, to burn out the pirates' haven at ${h.name}.`);
    this.sim.realms.proclaim(C, day, `The crown has sent marines to burn the pirates out of ${h.name}.`);
    const B = this.sim.brethren;
    if (B) {
      B.note(h.guild, `The lookout at ${h.name} has seen sails: marines of the ${rn} are coming to burn it out, in two nights.`, day);
      B.tellMembers(h.guild, `Marines of the ${rn} are coming to burn out ${h.name}, two nights from now! The brethren will want every blade there.`, '#ff9070');
    }
    this.sim.saga?.emit('haven_expedition', { haven: h.id, civ: C.id, raid: id });
    return raid;
  }

  // The marines' raid on haven `h` over (see war.endRaid): burned out, or
  // beaten off.
  expeditionEnd(raid, out, day) {
    const h = this.get(raid.haven);
    if (!h) return;
    h.expedition = null;
    const C = (this.game.world.ow.civs || [])[raid.civ];
    const rn = C ? C.name.replace(/^The /, '') : 'realm';
    const B = this.sim.brethren;
    if (out.result === 'plundered' && !h.razed) {
      this.raze(h, C, day);
      return;
    }
    const FL = this.game.world.layouts.get(raid.from);
    if (FL && FL.econ) ledger(FL, day, `The marines sent against the pirates at ${h.name} were beaten off the beach.${out.lost && out.lost.length ? ` ${out.lost.length} didn't come home.` : ''}`);
    if (B) {
      const G = B.of(h.guild);
      G.mood = Math.min(1, G.mood + 0.12);
      B.note(h.guild, `The ${rn}'s marines came ashore at ${h.name} in the night, and the brethren drove them back into the sea!`, day);
      if (C && G.realms[C.id]) G.realms[C.id].stance = 'prey';
    }
  }

  // Haven `h`, burned out by realm C: for good. Its people killed, taken,
  // or scattered to the guild's other havens; its captives home; its
  // shacks burned to the stilts.
  raze(h, C, day = this.game.day) {
    const s = this.settlement(h);
    const L = this.layout(h);
    const rn = C ? C.name.replace(/^The /, '') : 'realm';
    h.razed = { day, by: C ? C.id : null, byName: rn };
    h.expedition = null;
    if (s) s.haven = { ...(s.haven || {}), id: h.id, guild: h.guild, razed: true };
    const rng = new RNG(hash4(this.game.seed >>> 0, h.id, day, 0x2a2e));
    const war = this.sim.war;
    // The captives: home.
    for (const p of this.held(h)) war.release(p, 'released', day);
    const other = this.standing(h.guild).find((o) => o !== h);
    const OL = other && this.layout(other);
    const fled = [];
    let killed = 0;
    let taken = 0;
    if (L && L.econ) {
      for (const r of L.npcs) {
        if (!alive(r) || r.visitor || r.migrated) continue;
        const roll = rng.next();
        if (r.age === 'adult' && roll < 0.3) {
          this.sim.recordDeath(L, r, `killed when the ${rn} burned ${h.name}`, null, day);
          killed++;
        } else if (C && r.age === 'adult' && roll < 0.55 && war.takePrisoner(r, L, C, day, `taken when ${h.name} burned`)) taken++;
        else fled.push(r);
      }
      if (OL && fled.length) relocate(this.sim, L, fled, OL, `fled when ${h.name} burned`);
      else for (const r of fled) {
        r.migrated = 'scattered';
        r.away = true;
        if (r.ent && !r.ent.dead) this.game.despawnNpc(r.ent);
      }
      s.deserted = true;
      L.econ.deserted = day;
      this.sim.deserted.add(s.id);
      ledger(L, day, `The ${rn}'s marines burned ${h.name} to the stilts.`);
      this.burn(h, L);
    }
    // The guild's captains based there: to another haven, or adrift.
    const B = this.sim.brethren;
    if (B) {
      const G = B.of(h.guild);
      for (const c of G.captains) if (c.haven === h.id) c.haven = other ? other.id : null;
      G.mood = Math.max(0, G.mood - 0.2);
      G.treasury = Math.floor(G.treasury * 0.6);
      if (C && G.realms[C.id]) {
        G.realms[C.id].pressure = 0;
        G.realms[C.id].stance = 'prey';
      }
      B.note(h.guild, `${h.name} is burned: the ${rn}'s marines came ashore and fired every shack. ${killed} of the brethren killed, ${taken} taken in chains${fled.length ? `, ${fled.length} fled${other ? ` to ${other.name}` : ' into the hills'}` : ''}.`, day);
      B.tellMembers(h.guild, `${h.name} has been burned out by the ${rn}. It's gone, for good.`, '#ff7060');
    }
    if (C) this.sim.realms.proclaim(C, day, `Our marines have burned out the pirates' haven at ${h.name}: ${killed} of them killed and ${taken} brought back in chains to hang.`);
    for (const p of this.game.everyone ? this.game.everyone() : [this.game.player]) {
      const pid = pidOf(p);
      if (h.know && h.know[pid]) this.tell(pid, `Word has come: ${h.name} has been burned out by the ${rn}.`, '#ffb080');
    }
    this.sim.saga?.emit('haven_razed', { haven: h.id, civ: C ? C.id : null });
  }

  // What a burning leaves: roofs gone, walls holed and black, ash over the
  // square, the guild's mast down. (Wherever the haven is, loaded or not:
  // see Sim.setBlocks. Burning before your eyes, if you're there.)
  burn(h, L) {
    const rng = new RNG(hash4(h.id, 0xb042));
    const ops = [];
    const loaded = (x, z) => this.game.world.regionAt(x, z);
    const fires = [];
    for (const b of L.buildings) {
      const top = (b.roofBase || GROUND + 2) + 4;
      for (let z = b.z0 - 1; z <= b.z1 + 1; z++) {
        for (let x = b.x0 - 1; x <= b.x1 + 1; x++) {
          for (let y = (b.roofBase || GROUND + 2); y <= top; y++) ops.push([x, y, z, B.air, 0]);
          const wall = x === b.x0 || x === b.x1 || z === b.z0 || z === b.z1;
          if (!wall) continue;
          for (let y = GROUND; y < (b.roofBase || GROUND + 2); y++) {
            if (rng.chance(y > GROUND ? 0.55 : 0.25)) ops.push([x, y, z, B.air, 0]);
            else if (rng.chance(0.12)) fires.push([x, y, z]);
          }
        }
      }
    }
    const p = L.plaza;
    if (p) {
      for (let z = p.z0 - 2; z <= p.z1 + 2; z++) for (let x = p.x0 - 2; x <= p.x1 + 2; x++) if (rng.chance(0.3)) ops.push([x, GROUND - 1, z, rng.chance(0.5) ? B.ash : B.scorched, 0]);
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) ops.push([p.cx + dx, GROUND, p.cz + dz, B.air, 0]);
      ops.push([p.cx, GROUND, p.cz, B.campfire, 0]);
    }
    this.sim.setBlocks(ops);
    // (Before your eyes: what's left alight.)
    for (const [x, y, z] of fires) if (loaded(x, z)) ignite(this.game, x, y, z, 'raid');
  }

  // ------------------------------------------------------------ new havens
  // Every couple of weeks: a lonely village gone bad turns pirate, or a
  // guild short of havens (or a band of outlaws by the sea) makes a new
  // one on a shore nobody's seen.
  changes(day) {
    if (day % 15 !== 7) return;
    const rng = new RNG(hash4(this.game.seed >>> 0, day, 0x7e4e));
    const B = this.sim.brethren;
    if (!B) return;
    for (const G of B.all()) {
      const mine = this.standing(G.id);
      const live = G.captains.filter((c) => ['haven', 'sea', 'careen'].includes(c.state));
      // (A guild with no haven left: its captains find a shore.)
      if (!mine.length && live.length) {
        if (rng.chance(0.6)) this.foundNew(G.id, live[0], day, rng);
        continue;
      }
      if (G.broken) continue;
      if (rng.chance(0.22)) {
        const v = this.turnable(G.id);
        if (v) {
          this.turn(v, G.id, day, rng);
          continue;
        }
      }
      if (mine.length < 2 && G.treasury > 320 && rng.chance(0.25)) {
        G.treasury -= 200;
        this.foundNew(G.id, live[0] || null, day, rng);
      }
    }
    // (Outlaws by the sea, taking to it.)
    const bands = this.sim.bandits ? this.sim.bandits.live().filter((b) => b.members.length >= 4) : [];
    if (bands.length && this.list.filter((h) => !h.razed).length < 6 && rng.chance(0.12)) {
      const band = rng.pick(bands);
      const gi = rng.int(0, GUILDS.length - 1);
      const h = this.foundNew(gi, null, day, rng, band.name.replace(/^the /, 'the Cove of the '));
      if (h) {
        band.done = true;
        const near = this.game.world.layouts.get(band.near);
        if (near && near.econ) ledger(near, day, `${cap(band.name)} have gone from the hills: taken to the sea, folk say, under the black flag of ${GUILDS[gi].name}.`);
      }
    }
  }

  // A free village by the sea, poor and far from any realm's care, that
  // pirates could turn (not one a player holds, nor deserted).
  turnable(gi) {
    const office = this.sim.office;
    const opts = [];
    for (const L of this.game.world.layouts.values()) {
      const s = L.settlement;
      if (!L.econ || s.civ || s.haven || !s.coast || s.deserted || s.condition === 'abandoned' || s.type === 'city') continue;
      if (office && office.of(s.id) && office.of(s.id).holder) continue;
      const hungry = (L.econ.hungry || 0) + (s.condition === 'poor' ? 2 : 0) + (L.econ.treasury < 40 ? 1 : 0);
      opts.push({ s, k: hungry });
    }
    opts.sort((a, b) => b.k - a.k);
    void gi;
    return opts.length && opts[0].k >= 1 ? opts[0].s : null;
  }

  // Village `s` turns pirate, for guild `gi`: its people the guild's, the
  // black flag over its square, a stockade going up. (`pid`: a player who
  // governs it raised the flag.) Those who knew the village don't know
  // what it's become till they see it, or hear.
  turn(s, gi, day = this.game.day, rng = new RNG(hash4(s.id, day, 0x7a2)), pid = null) {
    const L = this.game.world.layouts.get(s.id);
    if (!L || !L.econ || isHaven(s)) return null;
    const id = this.next++;
    s.haven = { id, guild: gi };
    const h = { id, sid: s.id, guild: gi, name: s.name, origin: 'turned', since: day, know: {}, told: {}, razed: null, stores: { plunder: 60, rum: 20, powder: 10, timber: 20 }, cover: true };
    this.list.push(h);
    // (Its people: a few take up the cutlass; everyone a sea-dog's look.)
    const able = L.npcs.filter((r) => alive(r) && !r.visitor && r.age === 'adult' && r.job !== 'mayor' && r.job !== 'guard').sort((a, b) => (b.personality?.bravery ?? 0.5) - (a.personality?.bravery ?? 0.5));
    for (const r of able.slice(0, 2)) retrain(L, r, 'guard', rng);
    for (const r of L.npcs) if (alive(r) && r.age !== 'child' && r.look && rng.chance(0.5)) r.look = { ...r.look, hat: rng.pick(['bandana', 'bandana', 'tricorn']), hatColor: rng.pick(['#1a1a1a', '#8a1a1a']) };
    if (!L.prisonCells.length && this.sim.works) this.sim.works.startBuilding(L, 'stockade', ', for the brethren\'s captives', false, 0);
    const p = L.plaza;
    if (p) this.sim.setBlocks([[p.cx + 3, GROUND, p.cz, B[GUILD_FLAGS[gi]], 0, true]]);
    const G = GUILDS[gi] || GUILDS[0];
    ledger(L, day, pid ? `${playerName(this.game, pid)} has raised the black flag of ${G.name} over ${s.name}: it's a pirates' haven now.` : `Captains of ${G.name} have been coming and going all season, and now the black flag flies over ${s.name}: it's a pirates' haven.`);
    this.sim.brethren?.note(gi, `${s.name} has come over to ${G.name}: a haven of ours now.`, day);
    if (pid) this.learn(h, pid, 'seen');
    // (Those of the guild who play: told of it.)
    if (this.sim.brethren) for (const m of Object.keys(this.sim.brethren.of(gi).members)) this.learn(h, m, 'heard', 'the brethren');
    this.sim.saga?.emit('haven_turned', { haven: h.id, sid: s.id, guild: gi });
    return h;
  }

  // A new haven of guild `gi` on a lonely shore, its captain `c` (if any)
  // its master. (`name`: what it's called.)
  foundNew(gi, c, day, rng, name = null) {
    const at = this.lonelyShore(rng, null);
    if (!at) return null;
    const NAMES = ['Smuggler\'s Rest', 'Dead Man\'s Reach', 'Black Rock Haven', 'Cutthroat Cay', 'Rum Hole', 'The Grinning Cove', 'Tarry Bight', 'Gull Rock'];
    const h = this.create(at.cx, at.cz, gi, name || NAMES[rng.int(0, NAMES.length - 1)], 'founded', rng);
    const B = this.sim.brethren;
    if (B) B.note(gi, `${c ? c.name : 'Some of the brethren'} ${c ? 'has' : 'have'} founded a new haven: ${h.name}, on a shore nobody's charted.`, day);
    if (c) c.haven = h.id;
    if (B) for (const m of Object.keys(B.of(gi).members)) this.learn(h, m, 'heard', 'the brethren');
    return h;
  }

  // ------------------------------------------------------------ the revel
  // A big share-out: the haven makes a night of it (the brethren's own
  // festival: see game/festplay.js).
  revel(gi, day) {
    const h = this.standing(gi)[0];
    const L = h && this.layout(h);
    const E = this.sim.events;
    if (!L || !L.econ || !E || !E.fete || (L.econ.events || []).some((q) => q.state !== 'done' && q.state !== 'off')) return;
    if (h.lastRevel && day - h.lastRevel < 10) return;
    h.lastRevel = day;
    const ev = E.fete(L, day + 1, 'village');
    if (ev) {
      ev.revel = true;
      ev.title = `the Brethren's Revel at ${h.name}`;
      ledger(L, day, `Tomorrow the brethren make a night of it: the Revel, with the cutlass bout, the gig race and the grog match, and a realm's flag to burn.`);
    }
  }

  // ------------------------------------------------------------ treasure
  // A captain's chest, dug up (see havenplay.js): coin, a gem or two, a
  // fine piece. Once.
  openChest(x, y, z, p) {
    const T = (this.treasure ||= {});
    const k = `${x},${y},${z}`;
    const t = T[k];
    const game = this.game;
    if (!t || t.opened) {
      game.ui.msg('The chest is empty: sand and a dead crab.', '#c8b8a0');
      return;
    }
    t.opened = this.game.day;
    const give = () => {
      p.give('coin', t.coin);
      for (const [item, n] of t.items || []) p.give(item, n);
      game.ui.msg(`The lid comes up: ¤${t.coin}${(t.items || []).length ? `, and ${t.items.map(([it, n]) => `${n > 1 ? `${n} ` : ''}${it.replace(/_/g, ' ')}`).join(', ')}` : ''}. ${t.who ? `${t.who}'s hoard.` : ''}`, '#ffe070');
      game.audio?.play('fanfare');
    };
    game.asPlayer ? game.asPlayer(p, give) : give();
    this.sim.brethren?.deed(pidOf(p), 'raid', 0);
  }

  // A dead captain's treasure map (see haventalk.js: an old salt sells
  // one): a hoard buried on a lonely beach not too far off, and the item
  // that shows the way. The item's key, or null.
  treasureMap(rng, near = null) {
    const ow = this.game.world.ow;
    // (`near`: a settlement, or a haven's record.)
    const c0 = near ? (near.sid !== undefined ? this.centre(near) : centre(near)) : this.game.player ? { x: this.game.player.x, z: this.game.player.z } : null;
    if (!c0) return null;
    // (Further afield, if the coast's a long way off.)
    for (let i = 0; i < 160; i++) {
      const a = rng.next() * Math.PI * 2;
      const r = i < 80 ? rng.int(80, 260) : rng.int(200, 700);
      const x = Math.round(c0.x + Math.cos(a) * r);
      const z = Math.round(c0.z + Math.sin(a) * r);
      const c = ow.continentAt(x, z);
      if (c < 0.03 || c > 0.12) continue;
      if (ow.settlementAt(x, z)) continue;
      if (!ow.wallDown && ow.stormAt && ow.stormAt(x, z) > 0) continue;
      const n = (this.nextMap = (this.nextMap || 0) + 1);
      const G = GUILDS[rng.int(0, GUILDS.length - 1)];
      const who = `${rng.pick(['Calico', 'Black', 'Red', 'Mad', 'Old', 'Bloody', 'Gentleman', 'One-Eyed'])} ${rng.pick(['Jack', 'Bess', 'Morrow', 'Hask', 'Ruth', 'Tobin', 'Ned', 'Ysolde', 'Coll', 'Annie'])}`;
      const items = [];
      if (rng.chance(0.8)) items.push(['gem', rng.int(1, 3)]);
      if (rng.chance(0.5)) items.push(['gold_ingot', rng.int(1, 2)]);
      if (rng.chance(0.5)) items.push(['old_coin', rng.int(3, 9)]);
      if (rng.chance(0.3)) items.push(['pearl', rng.int(1, 3)]);
      if (rng.chance(0.25)) items.push([rng.pick(['sabre', 'spyglass', 'rum']), 1]);
      (this.maps ||= []).push({ n, x, z, coin: 80 + rng.int(0, 180), items, who, guild: G.name, dug: null });
      return `tmap~${x}~${z}~${n}`;
    }
    return null;
  }

  // What the map shows: the spot, and a line of the captain's.
  mapInfo(n) {
    const m = (this.maps || []).find((q) => q.n === n);
    if (!m) return null;
    const ow = this.game.world.ow;
    let near = null;
    let bd = Infinity;
    for (const s of ow.settlements) {
      if (s.haven || s.deserted) continue;
      const c = centre(s);
      const d = Math.hypot(c.x - m.x, c.z - m.z);
      if (d < bd) {
        bd = d;
        near = s;
      }
    }
    const hint = near ? `${Math.round(bd / 10) * 10} paces ${dirOfXZ(centre(near), m)} of ${near.name}, where the land meets the sea.` : 'Where the land meets the sea.';
    return { x: m.x, z: m.z, n, who: m.who, hint, dug: !!m.dug };
  }

  // Dug at (x, y, z) by `p`: a captain's hoard there? The chest comes up.
  dig(x, y, z, p) {
    const m = (this.maps || []).find((q) => !q.dug && Math.abs(q.x - x) <= 1 && Math.abs(q.z - z) <= 1);
    if (!m) return false;
    m.dug = this.game.day;
    const w = this.game.world;
    w.setBlock(x, y, z, B.sea_chest, 0);
    (this.treasure ||= {})[`${x},${y},${z}`] = { coin: m.coin, items: m.items, who: m.who };
    const say = () => this.game.ui.msg(`Your shovel strikes wood! A sea chest, iron-bound: ${m.who}'s. (Open it.)`, '#ffe070');
    this.game.asPlayer ? this.game.asPlayer(p, say) : say();
    this.game.audio?.play('secret');
    this.game.renderer?.emit?.(x, y + 1, z, { n: 18, color: ['#f0d050', '#fff0a0', '#c8a040'], up: 40, speed: 40, life: 0.9, glow: true });
    return true;
  }

  // What's on someone's head, by the realms they've sunk ships of.
  bountyOf(pid) {
    const r = this.game.piracy && this.game.piracy.p ? this.game.piracy.p[pid] : null;
    if (!r) return 0;
    const n = Object.values(r.sunk || {}).reduce((a, b) => a + b, 0);
    return n ? 25 + n * 20 + (r.bounty || 0) : r.bounty || 0;
  }

  // ------------------------------------------------------------ the law
  // `p` takes the King's Pardon from realm `civ` (see justice.js): their
  // piracy against it forgiven, the brethren renounced (a turncoat now).
  pardon(p, civ) {
    const pid = pidOf(p);
    const r = piracyOf(this.game, p);
    const was = r.guild;
    if (civ !== null && civ !== undefined) r.sunk[civ] = 0;
    r.n = Math.min(r.n, PIRATE_AT - 1);
    r.guild = null;
    r.bounty = 0;
    if (this.game.hero && this.game.hero.infamy && civ !== null) delete this.game.hero.infamy[civ];
    const B = this.sim.brethren;
    const st = B && B.standingOf(pid);
    if (st) {
      st.m.gone = this.game.day;
      st.m.turncoat = this.game.day;
      B.note(st.i, `${playerName(this.game, pid)} took a realm's pardon and turned their back on the brethren. Turncoat: their name's nailed to the gallows.`);
    } else if (was !== null && B) (B.of(was).members[pid] ||= { rank: 'hand', merit: 0, joined: this.game.day, owed: 0 }).turncoat = this.game.day;
  }

  // `p` hanged by realm `civ` for piracy: the realm's debt paid.
  hanged(p, civ) {
    const pid = pidOf(p);
    const r = piracyOf(this.game, p);
    if (civ !== null && civ !== undefined) r.sunk[civ] = 0;
    r.bounty = 0;
    const st = this.sim.brethren && this.sim.brethren.standingOf(pid);
    if (st) this.sim.brethren.note(st.i, `${playerName(this.game, pid)} was hanged by a realm at its harbour mouth. The brethren drink to them.`);
  }

  // Each little while: a known pirate with a price on their head, seen by
  // the watch of a realm that wants them, is seized (see justice.js); a
  // turncoat or an enemy in a haven, set upon by its corsairs.
  watch() {
    const g = this.game;
    const war = this.sim.justice;
    for (const p of g.everyone ? g.everyone() : [g.player]) {
      if (!p || p.dead) continue;
      const pid = pidOf(p);
      const s = g.world.ow.settlementAt(p.x, p.z);
      if (!s) {
        this.bountyHunt(p);
        continue;
      }
      if (!g.active.has(s.id)) continue;
      if (isHaven(s)) {
        const h = this.of(s.id);
        const why = h && this.hostileTo(h, pid);
        if (!why) continue;
        this.alarm ||= {};
        const k = `${pid}:${h.id}`;
        if (this.alarm[k] && this.sim.abs - this.alarm[k] < 60) continue;
        this.alarm[k] = this.sim.abs;
        let n = 0;
        for (const q of g.guardsOf(s.id)) {
          if (q.sleeping || q.distTo(p) > 14) continue;
          q.engage(p);
          if (!n++) q.say(why === 'turncoat' ? 'TURNCOAT! Cut them down!' : why === 'war' ? 'One of theirs! At them, brothers!' : 'A realm\'s dog! Gut them!', 3, '#ff7060');
        }
        if (n) this.tell(pid, why === 'turncoat' ? `They know you in ${h.name}, turncoat: the corsairs are coming for you.` : why === 'war' ? `${h.name}'s corsairs know your colours: your guilds are at war.` : `${h.name}'s corsairs know you for the realm's: they're coming for you.`, '#ff7060');
        continue;
      }
      if (!s.civ || !war || war.jail) continue;
      if (!pirateTo(g, p, s.civ.id) || this.bountyOf(pid) < 80) continue;
      this.seized ||= {};
      const k = `${pid}:${s.id}:${g.day}`;
      if (this.seized[k]) continue;
      const guard = g.guardsOf(s.id).find((q) => !q.sleeping && q.distTo(p) <= 7);
      if (!guard) continue;
      this.seized[k] = true;
      const seize = () => {
        guard.say(`It's ${g.playerName}, the pirate! In the crown's name!`, 3, '#ff9070');
        war.commit(s.id, 'piracy', { witnesses: [guard], desc: 'Piracy on the high seas', known: true });
        g.ui.msg(`The watch of ${s.name} know your face from the bills: there's a price on your head here. They mean to hang you.`, '#ff7060');
      };
      g.asPlayer ? g.asPlayer(p, seize) : seize();
    }
  }

  // Bounty hunters: a pirate with a big enough price on their head, out
  // in the country near a town of a realm that wants them, is come after
  // (at most once a day) by a few hard folk out of that town, set on the
  // reward. True if they were sent.
  bountyHunt(p) {
    const g = this.game;
    const pid = pidOf(p);
    const bounty = this.bountyOf(pid);
    if (bounty < HUNT_AT || p.dead || p.limbo || p.sagaHeld) return false;
    if (g.world.ow.settlementAt(p.x, p.z) || g.world.isWaterAt(Math.floor(p.x), Math.floor(p.y), Math.floor(p.z))) return false;
    this.hunted ||= {};
    if (this.hunted[pid] === g.day) return false;
    let best = null;
    let bd = 170;
    for (const a of g.active.values()) {
      const s = a.layout && a.layout.settlement;
      if (!s || !s.civ || isHaven(s) || !pirateTo(g, p, s.civ.id)) continue;
      const d = Math.hypot(a.layout.plaza.cx - p.x, a.layout.plaza.cz - p.z);
      if (d >= 30 && d < bd) {
        bd = d;
        best = a.layout;
      }
    }
    if (!best) return false;
    const rng = new RNG(hash4(g.seed >>> 0, pid === 'host' ? 0 : Number(pid) + 1, g.day, 0xb077));
    // (Not every day they're about: word has to reach the right ears.)
    if (!rng.chance(Math.min(0.6, bounty / 400))) {
      this.hunted[pid] = g.day;
      return false;
    }
    const n = Math.min(4, 2 + Math.floor(bounty / 200));
    const ang = Math.atan2(best.plaza.cz - p.z, best.plaza.cx - p.x);
    let spot = null;
    for (let k = 0; k < 8 && !spot; k++) {
      const a = ang + (k - 4) * 0.4;
      const x = Math.round(p.x + Math.cos(a) * 24);
      const z = Math.round(p.z + Math.sin(a) * 24);
      if (!g.world.regionAt(x, z) || g.inSight(x, z, 2) || g.world.ow.settlementAt(x, z)) continue;
      const y = g.world.findStandY(x, z, GROUND);
      if (y <= 0 || g.world.isWaterAt(x, y, z)) continue;
      spot = g.findFreeSpot(x, z, y);
    }
    if (!spot) return false;
    this.hunted[pid] = g.day;
    const name = playerName(g, pid);
    const C = best.settlement.civ;
    const cries = [`${name}! There's ¤${bounty} on your head, and it's mine!`, 'That\'s the pirate off the bills! Take them!', `In the name of ${C.name}, and the reward!`, 'Dead or alive, the bill says. Dead\'s easier.'];
    const weapons = ['iron_sword', 'hand_axe', 'spear', 'crossbow'];
    for (let i = 0; i < n; i++) {
      const x = spot.x + (i % 2);
      const z = spot.z + (i >> 1);
      const y = g.world.findStandY(x, z, spot.y);
      const at = (y > 0 && g.findFreeSpot(x, z, y)) || spot;
      const weapon = weapons[(i + rng.int(0, 3)) % weapons.length];
      const adv = makeAdventurer(rng, best.settlement.style || C.style || 'vale', 1);
      const rec = {
        id: `bh${pid}:${g.day}:${i}`, idx: 7900 + i, sid: best.settlement.id, visitor: true, bountyHunter: pid,
        name: adv.name,
        age: 'adult', job: 'bounty hunter', home: null, bed: 0, household: null,
        partner: null, children: [], parents: [], friends: [], personality: adv.personality, traits: adv.traits,
        hobbies: [], look: { ...adv.look, hat: 'hood', outfit: 'hunter', accent: '#2a2a2a' }, alive: true, shift: 'day', restDay: -1,
        equipment: { tool: weapon, hobbyItem: null, items: [{ item: weapon, count: 1 }, ...(weapon === 'crossbow' ? [{ item: 'bolt', count: 12 }] : [])], coins: 0, armor: 0.3, shield: null },
        maxHp: 34, hp: 34, work: { kind: 'none' }, schedule: { work: [{ s: 0, e: 1440, act: 'adventure', place: 'camp' }], rest: [{ s: 0, e: 1440, act: 'adventure', place: 'camp' }] },
        coins: 4 + rng.int(0, 12), inv: [], skills: { trading: 0, cooking: 0, hunting: 0.7, fishing: 0, farming: 0, building: 0, crafting: 0 },
        fed: 1, hungry: 0, mood: 0.5, grief: [], override: null, away: false, doneKey: null,
      };
      const e = g.spawnWarrior(rec, best, at);
      e.warband = { kind: 'saga', role: 'hunter', foe: true, phase: 'hunt', target: pid, brave: true, cry: rng.pick(cries), home: { x: best.plaza.cx, z: best.plaza.cz }, fleeLines: ['No bounty\'s worth this!', 'Keep your head, then!', 'Another day, pirate!'] };
      e.hostileNow = true;
    }
    this.tell(pid, `Riders on the road behind you, keeping pace. The price on your head (¤${bounty}) has brought out the bounty hunters of ${C.name}.`, '#ff9070');
    return true;
  }

  // Why haven `h`'s corsairs would set on `pid` (or null): a turncoat of
  // its guild, one of a guild it's at war with, a ruler of a realm hunting
  // it.
  hostileTo(h, pid) {
    const B = this.sim.brethren;
    if (!B || h.razed) return null;
    const own = B.of(h.guild).members[pid];
    if (own && own.turncoat) return 'turncoat';
    const st = B.standingOf(pid);
    if (st && st.i !== h.guild && B.relation(st.i, h.guild) === 'war') return 'war';
    const crown = this.sim.crown;
    if (crown) {
      for (const C of this.game.world.ow.civs || []) {
        if (!C || !crown.isRuler(C, pid)) continue;
        const R = B.of(h.guild).realms[C.id];
        if (R && R.stance === 'hunted') return 'realm';
      }
    }
    return null;
  }

  // ------------------------------------------------------------ each tick
  update(dt = 0.5) {
    if (this.game.remote) return;
    this.t -= dt;
    if (this.t > 0) return;
    this.t = 0.5;
    this.notice();
    this.watchT = (this.watchT || 0) - 0.5;
    if (this.watchT <= 0) {
      this.watchT = 2;
      this.watch();
    }
    const day = this.game.day;
    if (this.lastDay === null || this.lastDay === undefined) this.lastDay = day;
    if (day > this.lastDay) {
      for (let d = Math.max(this.lastDay + 1, day - 3); d <= day; d++) this.daily(d);
      this.lastDay = day;
    }
  }

  // What a guest needs to know, for their own map: [sid, guild, known, razed].
  forPid(pid) {
    return this.list.map((h) => [h.sid, h.guild, this.knows(h.sid, pid) || 0, h.razed ? 1 : 0]);
  }

  // ------------------------------------------------------------ save
  serialize() {
    return { list: this.list, next: this.next, placed: this.placed, lastDay: this.lastDay ?? null, maps: this.maps || [], nextMap: this.nextMap || 0, treasure: this.treasure || {} };
  }

  // (After the founded places are back on the map: see Founding.load.)
  load(d) {
    this.list = (d && d.list) || [];
    this.next = (d && d.next) || 1;
    this.placed = !!(d && d.placed);
    this.lastDay = d && d.lastDay !== undefined ? d.lastDay : null;
    this.maps = (d && d.maps) || [];
    this.nextMap = (d && d.nextMap) || 0;
    this.treasure = (d && d.treasure) || {};
    const ow = this.game.world.ow;
    for (const h of this.list) {
      const s = ow.settlements[h.sid];
      if (!s) continue;
      s.haven = { id: h.id, guild: h.guild, ...(h.razed ? { razed: true } : {}) };
    }
  }
}

const cap = (t) => (t ? t[0].toUpperCase() + t.slice(1) : t);
function dirOfXZ(a, b) {
  const ang = Math.atan2(-(b.z - a.z), b.x - a.x);
  const dirs = ['east', 'north-east', 'north', 'north-west', 'west', 'south-west', 'south', 'south-east'];
  return dirs[((Math.round(ang / (Math.PI / 4)) % 8) + 8) % 8];
}

// Which way, and how far, `b` lies from `a` (in words).
function dirWords(a, b) {
  const ang = Math.atan2(-(b.cz - a.cz), b.cx - a.cx);
  const dirs = ['east', 'north-east', 'north', 'north-west', 'west', 'south-west', 'south', 'south-east'];
  const dir = dirs[((Math.round(ang / (Math.PI / 4)) % 8) + 8) % 8];
  const d = Math.hypot(b.cx - a.cx, b.cz - a.cz);
  return `${d < 8 ? 'a little way' : d < 25 ? 'some days\' sail' : 'far off'} to the ${dir}`;
}

export { isHaven, centre as havenCentre, DAY, ledger, alive };
