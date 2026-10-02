// The old places of the island, as the world knows them: every dungeon
// has a story (who was laid in the barrow, which town's mine fell in and
// when, whose crypt the river drowned, whose band holed up in the caves),
// told in the history of the town nearest it, and by its people if you
// ask after old places (and then it's on your map). The Kavorent's spires
// are older than any story: the tales of each people have their own name
// for them.
//
// Adventurers go down into them too, alone or banded together, whether or
// not you're anywhere near: they come back richer and harder (or don't
// come back), spend what they found on better arms in town, and now and
// then carry a Kavorent core home to a mayor. What they've taken and
// killed down there stays taken and killed; a master they've slain stays
// slain, and the way in falls shut behind them.
import { RNG, hash4, clamp } from '../util/rng.js';
import { DTYPES } from '../world/dungeongen.js';
import { restamp } from '../world/sites.js';
import { REGION_W, REGION_D } from '../config.js';
import { DAY, ledger, st } from './econ.js';
import { ITEMS, socketed, canSocket } from '../world/items.js';
import { religionOf } from './culture.js';

const YEAR_DAYS = 60;
const BASE_YEAR = 1180;
const yearOf = (day) => BASE_YEAR + Math.floor(Math.max(0, day) / YEAR_DAYS);

const CHIEFS = {
  vale: ['Old King Aldric', 'Queen Berengar', 'Lord Corwen', 'Dame Elswith'],
  north: ['Hrolf Ironbeard', 'Jarl Sigvald', 'Asa the Grim', 'Thorvald Wolfskin'],
  sun: ['Prince Amenhet', 'the Satrap Kurash', 'Queen Nefer', 'the Vizier Ostanes'],
  wild: ['the Jaguar-Chief Ixtal', 'Mother Ayo', 'the Rain-King Tumak', 'Feather-Crowned Itza'],
  high: ['Thane Dorrin Stonefist', 'King Balgrim', 'Old Helga Deepdelver', 'the Forge-Lord Karrak'],
};
const BANDITS = ['One-Eye Garrick', 'Red Moll', 'Black Tam', 'Sefa the Knife', 'Bran Coldhand', 'the Brothers Vash', 'Long Ulla', 'Mad Jory'];
const SPIRE_NAMES = {
  vale: ['the Giants\' Needle', 'the Elder Spire', 'the Fairies\' Chimney'],
  north: ['the Jotun Spire', 'Odd\'s Pillar', 'the Frost-Giant\'s Spear'],
  sun: ['the Pillar of the Star-Kings', 'the Needle of Heaven', 'the Djinn\'s Tower'],
  wild: ['the Tree of Iron', 'the Sky-Serpent\'s Bone', 'the Spirit Spire'],
  high: ['the Deep Ones\' Chimney', 'the Black Shaft', 'the Hammer of the Old Ones'],
};
const ORE = ['silver', 'iron', 'copper', 'gold', 'tin'];

export class Dungeons {
  constructor(game, sim) {
    this.game = game;
    this.sim = sim;
    this.list = [];
    this.made = false;
  }

  // The records, made from the world's sites the first time they're wanted.
  get all() {
    if (!this.made) this.make();
    return this.list;
  }

  get(id) {
    return this.all[id] || null;
  }

  make() {
    this.made = true;
    const w = this.game.world;
    const ow = w.ow;
    const spawn = ow.spawnSettlement;
    for (const s of w.sites || []) {
      const rng = new RNG(hash4(s.seed, 0xd1));
      const T = DTYPES[s.type];
      // Its town: the nearest, if it's near enough to have a story about it.
      let town = null;
      let bd = Infinity;
      for (const q of ow.settlements) {
        const d = Math.hypot(q.cx - s.cx, (q.cz - s.cz) * 1.4);
        if (d < bd) {
          bd = d;
          town = q;
        }
      }
      if (bd > 11) town = null;
      const style = (town && (town.civ ? town.civ.style : town.style)) || 'vale';
      const far = spawn ? Math.hypot(spawn.cx - s.cx, (spawn.cz - s.cz) * 1.4) : 10;
      const rec = {
        id: s.id, type: s.type, x: s.x, z: s.z, h: s.h, cx: s.cx, cz: s.cz, seed: s.seed,
        // (Now and then a mine's dug deeper than most: a fourth floor.)
        depth: rng.int(T.floors[0], T.floors[1]) + (s.type === 'mine' && (s.seed >>> 0) % 7 === 0 ? 1 : 0),
        level: s.type === 'kavorent' ? 4 : clamp(1 + Math.floor(far / 8), 1, 3),
        known: false, seen: false, entered: false, cleared: false, clearedBy: null, clearedDay: null,
        floors: {}, weakened: 0, looted: 0, delves: 0, fallen: [], spire: null,
      };
      rec.vaultFloor = rng.int(0, rec.depth - 1);
      // (A Kavorent ruin has three vaults, each under its glyph seal.)
      if (s.type === 'kavorent') rec.vaults = [1, 2, 3];
      const y = yearOf(this.game.day) - rng.int(40, 400);
      const tn = town ? town.name : null;
      if (s.type === 'barrow') {
        const who = rng.pick(CHIEFS[style] || CHIEFS.vale);
        rec.name = `the Barrow of ${who.replace(/^the /, '')}`;
        rec.origin = { y, who, text: `In ${y}, ${who}${tn ? ` of ${tn}` : ''} was laid in a barrow ${dirFrom(town, s)} with their hearth-guard and their grave goods, and the stone door was sealed. They say the guard still keeps it.`, short: `${who} was laid in a barrow ${dirFrom(town, s)}, with the hearth-guard and the grave goods.` };
      } else if (s.type === 'mine') {
        const ore = rng.pick(ORE);
        rec.name = `the Old ${cap(ore)} Workings${tn ? ` of ${tn}` : ''}`;
        const lost = rng.int(9, 60);
        rec.origin = { y, text: `In ${y}, ${tn ? `${tn}'s` : 'the old'} ${ore} mine ${dirFrom(town, s)} fell in on its deepest gallery, and ${lost} miners were lost. Nobody would work it after; things were heard in it.`, short: `The ${ore} mine ${dirFrom(town, s)} fell in, and ${lost} were lost below.` };
      } else if (s.type === 'crypt') {
        const faith = town ? religionOf(town) : null;
        const god = (faith && faith.god) || rng.pick(['the Old Mother', 'the Pale Lord', 'the Lamp-Bearer', 'the Sleeper']);
        rec.name = `the Drowned Crypt of ${god.replace(/^the /i, 'the ')}`;
        rec.origin = { y, text: `In ${y}, the water came up through the floor of the crypt of the temple of ${god} ${dirFrom(town, s)}, and the priests who stayed to save the reliquary never came out. The chapel above fell in after.`, short: `The crypt of the old temple of ${god} ${dirFrom(town, s)} was drowned, and its priests with it.` };
      } else if (s.type === 'holdout') {
        const who = rng.pick(BANDITS);
        rec.name = `${who}'s Hole`;
        rec.origin = { y, who, text: `In ${y}, ${who}'s band was driven out of the hills${tn ? ` by the watch of ${tn}` : ''} and holed up in the caves ${dirFrom(town, s)}. They're there yet, folk say, and their children after them, and everything they ever stole.`, short: `${who}'s band holed up in the caves ${dirFrom(town, s)}, with everything they ever stole.` };
      } else {
        rec.name = rng.pick(SPIRE_NAMES[style] || SPIRE_NAMES.vale);
        rec.origin = { y: null, text: `${cap(rec.name)}: one of the spires of the Kavorent, who were here before anyone, and made things nobody since has understood. Nobody alive has been inside one. Runes crawl up its sides, and fade, and come again.`, short: `${cap(rec.name)} stood ${dirFrom(town, s)} before ever ${tn || 'a town'} was thought of: a spire of the Kavorent.` };
        rec.spire = { open: null };
        rec.cores = 4;
      }
      rec.town = town ? town.id : null;
      s.state = s.state || {};
      this.list.push(rec);
    }
  }

  // Those a town tells of in its history.
  forTown(sid) {
    return this.all.filter((d) => d.town === sid && d.origin && d.origin.y);
  }

  // Where it is on the map (the square, and which half).
  site(d) {
    return (this.game.world.sites || [])[d.id] || null;
  }

  // ------------------------------------------------------------ knowing of them
  // Now on your map (and told so).
  mark(d, how = null) {
    if (d.known) return false;
    d.known = true;
    this.game.ui.msg(`${how || `${cap(d.name)} is marked on your map.`}`, '#e0c890');
    return true;
  }

  // Each little while: one close enough to see is found (and marked).
  notice() {
    const p = this.game.player;
    if (!p || this.game.dungeon) return;
    for (const d of this.all) {
      if (d.seen || Math.abs(d.x - p.x) > 14 || Math.abs(d.z - p.z) > 10) continue;
      d.seen = true;
      d.known = true;
      this.game.ui.msg(d.cleared ? `You come upon ${d.name}. Its way in has fallen shut.` : `You come upon ${d.name}. ${d.type === 'kavorent' ? 'Runes crawl up its sides, glowing and fading.' : 'Something about the place makes your skin crawl.'}`, '#e0c890');
      this.game.audio?.play('secret');
    }
  }

  // What someone in a town might tell you of an old place (null if they
  // know of none you don't): the line, and it goes on your map.
  rumour(L, rng) {
    const s = L.settlement;
    const cand = this.all.filter((d) => !d.known).map((d) => ({ d, k: Math.hypot(d.cx - s.cx, (d.cz - s.cz) * 1.4) + (d.town === s.id ? -6 : 0) + rng.float(0, 2) })).filter((q) => q.k < 16).sort((a, b) => a.k - b.k);
    if (!cand.length) return null;
    const d = cand[0].d;
    const where = dirFrom(s, d);
    const say = {
      barrow: [`There's an old barrow ${where}. ${d.origin.short} Nobody goes near it.`, `You want old graves? ${cap(d.name)}, ${where}. The stone door's still sealed, last I heard.`],
      mine: [`The old mine ${where}, the one that fell in. ${d.origin.short} You'd not get me down there.`, `They say there's still ore in ${d.name}, ${where}. And worse than ore.`],
      crypt: [`${cap(d.name)}, ${where}. ${d.origin.short} The water's black down there.`, `Out ${where} there's a ruined chapel with a hole in its floor. The crypt under it drowned, years back.`],
      holdout: [`${cap(d.name)}, ${where}: a nest of cutthroats in the caves. ${d.origin.short}`, `Bandits. In the caves ${where}. The watch won't go in.`],
      kavorent: [`${cap(d.name)}, ${where}. The old ones built it, the tales say. The runes on it move.`, `Have you seen it? The spire ${where}? ${cap(d.name)}, my grandmother called it. Nothing grows near it.`],
    }[d.type];
    return { d, line: rng.pick(say) };
  }

  // ------------------------------------------------------------ beaten
  // Its master's dead: it's done. (The way in falls shut when you leave.)
  cleared(d, by = 'you') {
    if (d.cleared) return;
    d.cleared = true;
    d.clearedBy = by;
    d.clearedDay = this.game.day;
    const s = this.site(d);
    if (s && d.type !== 'kavorent') {
      s.state = { ...(s.state || {}), cleared: true };
      if (!this.game.dungeon || this.game.dungeon.rec !== d) restamp(this.game.world, s);
    }
    const L = d.town !== null ? this.sim.layoutOf(d.town) : null;
    const text = by === 'you' ? `${this.game.playerName} went down into ${d.name} and slew its master.` : `${by} went down into ${d.name}, and slew its master.`;
    if (L) {
      ledger(L, this.game.day, text);
      this.sim.history?.add(L, text, 'dungeon');
      if (by === 'you') this.sim.addRenown?.(L.settlement.id, 6, 'clearing an old place of its terrors');
    }
  }

  // ------------------------------------------------------------ the spires
  // A spire opened with a gem (`side`: which face, 0 south 1 west 2 north 3 east).
  openSpire(d, side) {
    d.spire = { ...(d.spire || {}), open: side };
    const s = this.site(d);
    if (s) {
      s.state = { ...(s.state || {}), open: side };
      restamp(this.game.world, s);
    }
  }

  // ------------------------------------------------------------ adventurers
  // Once an hour or so: adventurers in a town with an old place near decide
  // to go down (with whoever else is in town and game); those already down
  // come back (or don't).
  delves() {
    const adv = this.sim.adventurers;
    const now = this.sim.abs;
    const hour = Math.floor(now / 60);
    if (this.lastHour === hour) return;
    this.lastHour = hour;
    const ow = this.game.world.ow;
    for (const a of adv.list) {
      if (a.dead) continue;
      if (a.state === 'delve' && now >= a.delve.end && a.delve.lead === a.id) this.comeBack(a);
    }
    for (const a of adv.list) {
      if (a.dead || a.state !== 'stay' || now >= a.leave - 120) continue;
      const rng = new RNG(hash4(a.id, hour, 0xde1));
      // (Rarely, and not in the first days: the old places are for the
      // player to find first, mostly.)
      if (now < DAY * 12 || !rng.chance(0.003 + a.level * 0.0012)) continue;
      const here = ow.settlements[a.at];
      if (!here) continue;
      // Somewhere they could hope to come back from.
      const want = this.all.filter((d) => !d.cleared && Math.hypot(d.cx - here.cx, (d.cz - here.cz) * 1.4) < 12 && (d.type !== 'kavorent' || a.level >= 3)).sort((p, q) => Math.hypot(p.cx - here.cx, p.cz - here.cz) - Math.hypot(q.cx - here.cx, q.cz - here.cz))[0];
      if (!want) continue;
      // A band, if others are in town (the bolder they are, the more likely).
      const others = adv.list.filter((b) => b !== a && !b.dead && b.state === 'stay' && b.at === a.at).slice(0, 2);
      const party = [a, ...others.filter(() => rng.chance(0.65))];
      const hours = want.depth * (want.type === 'kavorent' ? 14 : 6) + rng.int(2, 8);
      for (const m of party) {
        m.state = 'delve';
        m.delve = { id: want.id, start: now, end: now + hours * 60, lead: a.id, party: party.map((q) => q.id), from: here.id };
        this.sim.camps.strike(`a:${m.id}`);
      }
      const L = this.sim.layoutOf(here.id);
      const names = party.map((m) => `${m.name.first} ${m.name.last}`);
      if (L) ledger(L, Math.floor(now / DAY), `${list(names)} set out for ${want.name}${party.length > 1 ? ', together' : ', alone'}.`);
    }
  }

  // Back from below: what they found, and who's left.
  comeBack(lead) {
    const adv = this.sim.adventurers;
    const ow = this.game.world.ow;
    const dl = lead.delve;
    const d = this.get(dl.id);
    const party = dl.party.map((id) => adv.get(id)).filter((m) => m && !m.dead);
    const rng = new RNG(hash4(lead.id, dl.start, 0xbac));
    const now = this.sim.abs;
    const kav = d && d.type === 'kavorent';
    // How it went: their strength against the place's.
    const power = party.reduce((n, m) => n + m.level * 1.3 + armour(m) * 6 + (ITEMS[m.gear.weapon]?.damage || 4) * 0.25, 0);
    const hard = d ? d.level * d.depth * (kav ? 2.6 : 1) * (1 - d.weakened * 0.5) : 3;
    const odds = clamp(power / (hard * 1.25), 0.08, 0.92);
    const back = ow.settlements[dl.from] || this.nearestTown(d);
    const L = back ? this.sim.layoutOf(back.id) : null;
    const day = Math.floor(now / DAY);
    const names = party.map((m) => `${m.name.first} ${m.name.last}`);
    const lost = [];
    const won = rng.chance(odds);
    if (won && d) {
      d.delves++;
      d.weakened = clamp(d.weakened + 0.25, 0, 0.75);
      d.looted = clamp(d.looted + 0.2, 0, 0.7);
      // Into their packs: old coin, and (luck permitting) better.
      for (const m of party) {
        m.coins += rng.int(20, 60) * d.level;
        st.add(m.pack, 'old_coin', rng.int(3, 10));
        if (rng.chance(0.35)) st.add(m.pack, rng.pick(['gem', 'gold_ingot', 'ruby', 'sapphire', 'emerald', 'topaz', 'amethyst']), 1);
        if (kav) {
          st.add(m.pack, 'kav_scrap', rng.int(3, 9));
          if (rng.chance(0.25)) st.add(m.pack, rng.pick(['kav_everlight', 'kav_blink', 'kav_edge']), 1);
        }
        // Harder for it.
        if (m.level < 5) {
          m.level++;
          m.maxHp += 8;
          m.hp = Math.max(m.hp, m.maxHp * 0.6);
        }
      }
      // The master slain, now and then (more likely with a strong band).
      // (Only once the place has been worn down by a few bands before.)
      const slew = d.delves >= 3 && rng.chance(clamp(odds - 0.55, 0.02, 0.2)) && !(kav && rng.chance(0.7));
      if (slew) this.cleared(d, list(names));
      // A Kavorent core (or two), for a town: rare.
      let cores = 0;
      if (kav && d.cores > 0 && rng.chance(0.3)) cores = Math.min(d.cores, rng.chance(0.25) ? 2 : 1);
      if (cores && L) {
        d.cores -= cores;
        d.coresGone = (d.coresGone || 0) + cores;
        this.giveCores(L, cores, list(names));
      }
      if (L) ledger(L, day, slew ? `${list(names)} came back from ${d.name}: its master is dead, and they're laden with old silver.` : `${list(names)} came back from ${d.name} with full packs, and stories.`);
    } else if (d) {
      // Driven out, or worse.
      for (const m of party) {
        if (rng.chance(kav ? 0.45 : 0.3)) {
          m.dead = true;
          m.diedDay = day;
          m.cause = d.name;
          lost.push(m);
          d.fallen.push({ name: `${m.name.first} ${m.name.last}`, gear: { ...m.gear, wear: { ...m.gear.wear } }, floor: rng.int(0, d.depth - 1), coins: m.coins });
        } else m.hp = Math.max(3, m.hp * 0.35);
      }
      d.weakened = clamp(d.weakened + 0.08, 0, 0.75);
      const live = party.filter((m) => !m.dead);
      if (L) ledger(L, day, live.length ? `${list(live.map((m) => `${m.name.first} ${m.name.last}`))} crawled back out of ${d.name}${lost.length ? `; ${list(lost.map((m) => m.name.first))} did not` : ', beaten'}.` : `${list(names)} went down into ${d.name}, and never came back.`);
    }
    // Back on the road, to town.
    for (const m of party) {
      if (m.dead) continue;
      m.state = 'road';
      m.delve = null;
      m.dest = back ? back.id : m.dest;
      m.from = null;
      m.arrive = now + rng.int(3, 8) * 60;
    }
    return { won, lost: lost.length };
  }

  nearestTown(d) {
    if (!d) return null;
    let best = null;
    let bd = Infinity;
    for (const q of this.game.world.ow.settlements) {
      if (q.condition === 'abandoned' || q.deserted) continue;
      const k = Math.hypot(q.cx - d.cx, (q.cz - d.cz) * 1.4);
      if (k < bd) {
        bd = k;
        best = q;
      }
    }
    return best;
  }

  // Cores handed in to a town (by you, or by adventurers): they go to its
  // realm's study of the Kavorent's arts (see sim/ancient.js), and the town
  // is grateful.
  giveCores(L, n, by) {
    const e = L.econ;
    e.cores = (e.cores || 0) + n;
    if (this.sim.ancient) this.sim.ancient.addCores(L, n);
    ledger(L, Math.floor(this.sim.abs / DAY), `${by} brought ${n === 1 ? 'a Kavorent core' : `${n} Kavorent cores`} to ${L.settlement.name}. The scholars can talk of nothing else.`);
  }

  // Adventurers better their arms in town: a stone set in their blade, if
  // they found one and a jeweller's at hand.
  improveGear(a, L) {
    const gems = Object.keys(a.pack).filter((k) => ITEMS[k] && ITEMS[k].gem && st.count(a.pack, k) > 0);
    const jeweller = L.buildings.some((b) => b.type === 'jeweler' || b.type === 'jeweller');
    if (gems.length && jeweller && canSocket(a.gear.weapon) && a.coins >= 25) {
      const g = gems[0];
      st.take(a.pack, g, 1);
      a.coins -= 25;
      a.gear.weapon = socketed(a.gear.weapon, g);
      ledger(L, Math.floor(this.sim.abs / DAY), `${a.name.first} ${a.name.last} had a ${ITEMS[g].name.toLowerCase()} set in their blade by the jeweller.`);
      return true;
    }
    // A Kavorent piece brought up: straight onto them.
    for (const k of ['kav_blade', 'kav_carapace', 'kav_visor', 'kav_greaves', 'kav_treads']) {
      if (!st.count(a.pack, k)) continue;
      st.take(a.pack, k, 1);
      if (ITEMS[k].kind === 'weapon') a.gear.weapon = k;
      else a.gear.wear[ITEMS[k].slot] = k;
      return true;
    }
    return false;
  }

  // ------------------------------------------------------------ saving
  serialize() {
    if (!this.made) return null;
    return this.list.map((d) => ({
      id: d.id, known: d.known, seen: d.seen, entered: d.entered, cleared: d.cleared, clearedBy: d.clearedBy, clearedDay: d.clearedDay,
      floors: d.floors, weakened: d.weakened, looted: d.looted, delves: d.delves, fallen: d.fallen, spire: d.spire, cores: d.cores, coresGone: d.coresGone || 0,
    }));
  }

  load(data) {
    if (!data) return;
    for (const q of data) {
      const d = this.get(q.id);
      if (!d) continue;
      Object.assign(d, q);
      const s = this.site(d);
      if (s) s.state = { cleared: d.type !== 'kavorent' && d.cleared, open: d.spire ? d.spire.open : null };
    }
  }
}

function armour(m) {
  return Math.min(0.55, Object.values(m.gear.wear || {}).reduce((n, k) => n + ((ITEMS[k] && ITEMS[k].armor) || 0), 0));
}

// "two days' walk north of Ashford", as near as can be said.
export function dirFrom(town, s) {
  if (!town) return 'out in the wilds';
  const tx = town.cx + (town.cw || 1) / 2;
  const tz = town.cz + (town.cd || 1) / 2;
  const sx = (s.cx ?? Math.floor(s.x / REGION_W)) + 0.5;
  const sz = (s.cz ?? Math.floor(s.z / REGION_D)) + 0.5;
  const dx = sx - tx;
  const dz = sz - tz;
  const d = Math.hypot(dx, dz * 1.4);
  const a = Math.atan2(-dz, dx);
  const dirs = ['east', 'north-east', 'north', 'north-west', 'west', 'south-west', 'south', 'south-east'];
  const k = Math.round(((a / (Math.PI * 2)) * 8 + 8)) % 8;
  const far = d < 2.5 ? 'not far' : d < 5 ? 'a half day' : d < 9 ? 'a day\'s walk' : 'days off';
  return `${far} ${dirs[k]} of ${town.name}`;
}

function cap(s) {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

function list(names) {
  if (names.length <= 1) return names[0] || 'Someone';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}
