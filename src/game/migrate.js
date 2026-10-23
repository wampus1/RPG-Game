// Bringing a world saved in an older version of the game up to this one
// (round 50; from now on, each version adds its own step here). A world is
// brought up whenever it's loaded (and for good when it's updated from its
// details: see SaveDetailsWindow and main.js), one version at a time from
// the one it was saved in, each step in three parts as it needs them:
//   data(d, log):  the save itself, as written, before a game is made of
//     it: things renamed or moved, what's missing filled in;
//   game(game, log):  the world once it's loaded: new things given to
//     the people in it (and what was wrong in it put right);
//   town(L, game):  each town as it's laid out again (a world's towns are
//     only made when they're needed): new stock, new kit, anything new to
//     its people.
// What can't be brought in is what's made only with a new world: its
// land, its places.
import { shortName } from '../world/dungeonnames.js';
import { stairFor, BLOCKS } from '../world/blocks.js';
import { NO_PAINTINGS } from '../world/settlement.js';
import { wallDirOf, WALL_DIRS } from './displays.js';
import { SURFACE, GROUND } from '../config.js';
import { GAME_VERSION, compareVersions } from '../version.js';
import { stockPantry, PANTRY } from './cooking.js';
import { cookDish, parseDish } from '../world/dishes.js';
import { invAdd, invCount, kitchenOf, alive, traderOf } from '../sim/econ.js';
import { ITEMS } from '../world/items.js';
import { parseStar, starKey } from '../world/quality.js';
import { B } from '../world/blocks.js';
import { REGION_W, REGION_D } from '../config.js';
import { restamp } from '../world/sites.js';

export const STEPS = [
  {
    // Achievements: the counts they're kept by.
    to: '0.49.0',
    data(d, log) {
      d.stats ||= {};
      for (const k of ['harvested', 'insights']) if (typeof d.stats[k] !== 'number') d.stats[k] = 0;
      log.push('Achievement counts started.');
    },
  },
  {
    // Cooking, guards' salves, foods that mend over time.
    to: '0.50.0',
    data(d, log) {
      // A recipe book, and what you've learnt things are, for everyone
      // who's played in it.
      const fix = (pd) => {
        if (!pd) return;
        pd.recipes ||= [];
        pd.kinds ||= [];
        // (Effects of the old kind kept; a buff with no end dropped.)
        pd.buffs = (pd.buffs || []).filter((q) => q && typeof q.until === 'number');
      };
      fix(d.player);
      for (const c of (d.party && d.party.chars) || []) fix(Array.isArray(c) ? c[1] && c[1].player : c && c.player);
      d.stats ||= {};
      if (typeof d.stats.cooked !== 'number') d.stats.cooked = 0;
      log.push('Recipe books added.');
    },
    game(game, log) {
      log.push('Cooks will stock their kitchens; the watch will carry salves.');
    },
    town(L) {
      // Every kitchen (and bakery) stocked for its cook's own dishes.
      const e = L.econ;
      const k = kitchenOf(L);
      if (k) stockPantry(k.store);
      for (const b of L.buildings) if (b.type === 'bakery' && e.biz[b.id]) stockPantry(e.biz[b.id].store, Math.random, 1);
      // A salve each for the watch.
      for (const r of L.npcs) {
        if (!alive(r) || r.job !== 'guard') continue;
        r.inv ||= [];
        if (!invCount(r.inv, 'healing_salve')) invAdd(r.inv, 'healing_salve', 1);
      }
    },
  },
  {
    // Instruments to play, a pipe to smoke, recipes on scrolls; effects
    // shown by their pictures.
    to: '0.51.0',
    data(d, log) {
      // (An effect from a potion: which potion, for its picture.)
      const name = (q) => Object.keys(ITEMS).find((k) => ITEMS[k].kind === 'potion' && ITEMS[k].name === q.name);
      const fix = (pd) => {
        if (!pd) return;
        for (const q of pd.buffs || []) if (q && !q.dish && !q.item && q.name) q.item = name(q) || undefined;
      };
      fix(d.player);
      for (const c of (d.party && d.party.chars) || []) fix(Array.isArray(c) ? c[1] && c[1].player : c && c.player);
      log.push('Effects on you now show as pictures.');
    },
    game(game, log) {
      log.push('The shops have instruments, pipes and blank scrolls in; the cooks have recipes to sell.');
    },
    town(L) {
      // The new goods in the shops that deal in them (the shops only get
      // their stock when a town's first laid out).
      const e = L.econ;
      for (const r of L.npcs) {
        if (!alive(r)) continue;
        const t = traderOf(r);
        const b = r.work && r.work.building != null ? e.biz[r.work.building] : null;
        if (!b || !t) continue;
        for (const k of NEW_STOCK[t] || []) if (!b.store[k]) b.store[k] = 1 + (k.length % 2);
      }
      // A recipe on a scroll at the kitchen, from its cook's own.
      const k = kitchenOf(L);
      const cook = L.npcs.find((r) => alive(r) && (r.job === 'cook' || r.job === 'innkeeper') && (r.recipes || []).length);
      if (k && cook) k.store[`recipe~${cook.recipes[0].key}`] = 1;
    },
  },
  {
    // The world's stories (see sim/saga): what's already afoot in an older
    // world taken up as stories of their own.
    to: '0.52.0',
    data(d, log) {
      log.push('The world\'s stories begin.');
    },
    game(game, log) {
      const S = game.sim.saga;
      if (!S) return;
      // Outlaws you've already brought down: they remember you.
      const heads = game.sim.bandits ? game.sim.bandits.heads || {} : {};
      let n = 0;
      for (const [band, k] of Object.entries(heads)) {
        n += k;
        S.count(`heads:${band}:pl:host`, k);
      }
      if (n) S.person('host').under += n;
      // A band with a price on its head: whoever posted it is asking for
      // help with it.
      let pleas = 0;
      for (const L of game.world.layouts.values()) {
        if (!L.econ) continue;
        for (const b of L.econ.bounties || []) {
          const band = game.sim.bandits.get(b.band);
          const m = L.npcs.find((r) => alive(r) && r.job === 'mayor');
          if (!band || !m) continue;
          if (S.begin('plea', { cast: { giver: { t: 'rec', sid: L.settlement.id, idx: m.idx }, threat: { t: 'band', id: band.id }, town: { t: 'town', sid: L.settlement.id } }, sid: L.settlement.id, vars: { how: 'raided', delay: 10 } })) pleas++;
        }
      }
      log.push(`The world's stories have begun${pleas ? `: ${pleas} town${pleas > 1 ? 's' : ''} asking for help with outlaws already` : ''}. (Quest log: O)`);
    },
  },
  {
    // Dishes that answer what you do, and make things happen (see
    // game/dishacts.js). The dishes already cooked keep what they did;
    // each kitchen puts up one of the new sort for sale.
    to: '0.53.0',
    data(d, log) {
      // (A dish's own bookkeeping, from before there was any: started clean.)
      if (d.player) for (const k of ['dishState', 'dishTemp', 'sheepT', 'rootT', 'hiccups']) delete d.player[k];
      log.push('Dishes can now set things off: lightning, little blasts, storms, a spell as a sheep...');
    },
    town(L) {
      const k = kitchenOf(L);
      if (!k || !k.store) return;
      const r = Math.random;
      for (let i = 0; i < 30; i++) {
        const ings = [];
        while (ings.length < 2 + Math.floor(r() * 2)) ings.push(PANTRY[Math.floor(r() * PANTRY.length)]);
        const key = cookDish(ings, 'p', 0.6 + r() * 0.4, r);
        const D = parseDish(key);
        if (!D || !(D.trig || D.fx.some((f) => f.i === 3))) continue;
        k.store[key] = (k.store[key] || 0) + 1;
        return;
      }
    },
  },
  {
    // Story upon story (see sim/saga/motifs): courtships and weddings, the
    // Academy, festivals, wonders, troubles; stories that run into each
    // other and go their own ways. And a room to let at every tavern.
    to: '0.54.0',
    data(d, log) {
      log.push('Many more stories: courtships, festivals, ventures, wonders, troubles, and an Academy in the cities.');
    },
    game(game, log) {
      const cities = [...game.world.layouts.values()].filter((L) => L.econ && L.settlement && L.settlement.type === 'city').length;
      log.push(`Taverns have a room to let (ask the innkeeper or the barkeep).${cities ? ' The cities will each raise an Academy.' : ''}`);
    },
    town(L, game) {
      // The tavern's room: in a part of town that's been changed since (and
      // so kept as it was), its walls, door and beds put in now (or when
      // that ground's next loaded).
      const w = game && game.world;
      const sim = game && game.sim;
      if (!w || !sim || !sim.setBlocks) return;
      for (const b of L.buildings) {
        if (b.type !== 'tavern' || !b.inn || !b.inn.blocks || b.underConstruction) continue;
        const bed = b.inn.beds[0];
        const key = w.regionKey(Math.floor(bed.x / REGION_W), Math.floor(bed.z / REGION_D));
        const loaded = w.regionAt(bed.x, bed.z);
        const kept = w.saved && w.saved.has(key);
        if (loaded ? w.getBlock(bed.x, b.inn.y, bed.z) === B.bed : !kept) continue;
        sim.setBlocks(b.inn.blocks.map(([x, y, z, id, meta]) => [x, y, z, id, meta]));
      }
    },
  },
  {
    // Shorter waits between a dish's acts: the long waits already counting
    // down from before are let go.
    to: '0.55.0',
    data(d, log) {
      const fix = (pd) => {
        if (!pd || !pd.dishState) return;
        for (const st of Object.values(pd.dishState)) {
          if (!st) continue;
          delete st.next;
          delete st.cd;
        }
      };
      fix(d.player);
      for (const c of (d.party && d.party.chars) || []) fix(Array.isArray(c) ? c[1] && c[1].player : c && c.player);
      log.push('Dishes that do things do them more often now.');
    },
  },
  {
    // Births are the towns' own again (no story for a child on the way):
    // any such story under way let go, and nobody left waiting on one.
    // (Round 56.)
    to: '0.56.0',
    data(d, log) {
      log.push('Armour no longer adds up to near-immortality; old places\' chests glow; stories mind who dies in them.');
    },
    game(game, log) {
      const S = game.sim.saga;
      let n = 0;
      if (S) {
        for (const th of S.live()) {
          if (th.m !== 'newborn') continue;
          S.end(th, 'faded', null);
          n++;
        }
      }
      for (const L of game.world.layouts.values()) for (const r of L.npcs || []) if (r && r.expecting !== undefined) delete r.expecting;
      if (n) log.push(`${n} stor${n > 1 ? 'ies' : 'y'} of a child on the way let go: the towns see to births themselves.`);
    },
  },
  {
    // A trading company's dead stay dead, and its horses (round 57):
    // nothing in an older world to put right, but it's said.
    to: '0.57.0',
    data(d, log) {
      log.push('Trading companies camp properly by the road at night, and those killed (people or horses) stay dead.');
    },
  },
  {
    // Permissions for the players in a hosted world (round 58): nobody's
    // allowed anything extra till the host says so.
    to: '0.58.0',
    data(d, log) {
      if (d.party && !d.party.perms) d.party.perms = {};
      log.push('A host can now let players use commands (Multiplayer: Permissions).');
    },
  },
  {
    // Joining a world from another computer on the same version (round
    // 59): nothing in the world itself to put right.
    to: '0.59.0',
    data(d, log) {
      log.push('Worlds on another computer no longer look like another version.');
    },
  },
  {
    // Each player's own cheats (round 60): nothing in the world to change.
    to: '0.60.0',
    data(d, log) {
      log.push('A player\'s reveal and map teleport commands now work on their own screen.');
    },
  },
  {
    // Masters' tiers and time crystals (round 61): every old place stands
    // at tier 1 till it's turned back.
    to: '0.61.0',
    data(d, log) {
      log.push('Masters are half as hard again to bring down, and leave time crystals: use one at the way into a beaten place to turn it back, harder.');
    },
    game(game) {
      for (const r of game.sim.dungeons ? game.sim.dungeons.all : []) r.tier ||= 1;
    },
  },
  {
    // Mods (round 62): a world from before had none, and keeps none (a
    // world's mods are chosen when it's made: see main.js).
    to: '0.62.0',
    data(d, log) {
      d.mods ??= null;
      log.push('Mods: make your own in the Workshop (W on the title screen), and put them in new worlds.');
    },
  },
  {
    // Biomes, world maps and the character screen in mods (round 63). A
    // world from before keeps its land, its towns and its people as they
    // were made; its character, as they were made.
    to: '0.63.0',
    data(d, log) {
      log.push('The Workshop makes biomes, world maps and tabs for the character screen now: new worlds made with such mods have them.');
    },
  },
  {
    // Mods' creatures told what to do, and more for their graphs and
    // stories (round 64). Weather a mod called down isn't kept (it was
    // never saved); a story waiting on a kill still goes on at the first.
    to: '0.64.0',
    data(d, log) {
      if (d.modWeather) delete d.modWeather;
      log.push('Mods can tell their creatures where to go and how to behave, and their stories ask more of the world. Blocks beside you no longer go dark as you pass above them.');
    },
  },
  {
    // Towns for mods' graphs, and other worlds to cross into (round 65). A
    // world from before was made from the map its mods chose: so it says.
    to: '0.65.0',
    data(d, log) {
      d.worldMap ??= null;
      d.worldRoot ??= null;
      log.push('Mods can change towns and their people, find out much more, and send you across to another of their world maps.');
    },
  },
  {
    // Sounds, songs, rules and gear looks in mods (round 66). Nothing in a
    // world changes shape: a mod's music a node put on wasn't kept (it's
    // the screen's), so none is waiting; and a world's own hearts, as the
    // game had them, are what its mods' rules start from.
    to: '0.66.0',
    data(d, log) {
      if (d.modMusic) delete d.modMusic;
      log.push('Mods can have sounds and songs of their own (a biome\'s music, or put on from their nodes), change the game\'s rules, and say how their gear looks worn and held.');
    },
  },
  {
    // A world's mods changed from the pause menu (round 67). Nothing in a
    // world changes shape: its mods are as they were, and can now be
    // changed while it's open.
    to: '0.67.0',
    data(d, log) {
      log.push('A world\'s mods can be changed from the pause menu (Mods): taken out, updated to your newer versions, or added.');
    },
  },
  {
    // The far lands lived in, great ships and the realms' fleets, and
    // stories with every node (round 68). A world made before keeps the
    // shapes of its lands (and the far lands as they were: wild, nobody
    // living there), since its towns and its ground were laid on them; a
    // new world has each land's shape picked by its seed, and the far
    // lands' peoples, empires, ground, beasts, music, old places and
    // masters. Ships are kept with the world from now on (none yet).
    to: '0.68.0',
    data(d, log) {
      d.wg ??= 1;
      d.ships ??= null;
      log.push('Great ships: sloops, brigantines, galleons and frigates, bought as a deed from a shipwright (or built from a sloop kit), sailed by the wheel and her sails\' trim, her guns aimed and fired, her hold below to walk, pump and mend; her crew working her.');
      log.push('Towns\' trade ships are great ships now, and the realms that have learned to cross the sea send merchantmen, settlers, men-of-war and cargo hulks between the lands (on the world map too).');
      log.push('Mods\' stories can have any node the entity graphs have, and forty more beats of their own (people sent and brought along, towns and realms changed, ships, chapters, waits for anything an If can ask).');
      if (d.wg === 1) log.push('This world keeps its lands as they were made. A new world has each land\'s shape picked by its seed, and the far lands lived in: their peoples and empires, their own ground, beasts, music, old places, masters and gear.');
    },
  },
  {
    // (Round 69) Ships in bottles: every ship item is one (a sloop in a
    // bottle, and so on, at 750 to 5,000), launched with no crew; a Ship
    // Bottle puts a ship of yours back into one, everyone aboard with
    // her (kept with the world: ships.bottles). Her decks every part to
    // be got to and from (her plans redrawn, a blueprint table in them),
    // her hatches, doors, wheel and guns to click, your crew's orders,
    // your companions aboard with you.
    to: '0.69.0',
    data(d, log) {
      if (d.ships && typeof d.ships === 'object') {
        d.ships.bottles ??= {};
        d.ships.bseq ??= 0;
      }
      log.push('Ships come in bottles now ("Sloop in a Bottle", 750 coins, up to the Frigate in a Bottle at 5,000), with no crew till you sign some on; a Ship Bottle (a shipwright\'s, or a workbench\'s) puts a ship of yours back in one with everyone aboard her. Holding one shows her ghost where she\'d go.');
      log.push('Aboard: hatches, cabin doors, the wheel and the guns are clicked to use; stepping toward a hatch takes you down it; talk to your crew for orders; your companions come aboard with you; mend her from outside with planks; a raft runs into a ship (yours: you climb aboard). A blueprint table in her captain\'s cabin (or her hold) renames her and changes her colours.');
      log.push('The ships\' plans are redrawn so no corner of a deck traps anyone (a ship of yours keeps her damage and her stores).');
    },
  },
  {
    to: '0.70.0',
    data(d, log) {
      log.push('Bridges not yet walked are built with thin walls of their stone for parapets (joining up along them, slanted ones too), and their lanterns burn from the start; the walls come in thirteen stones for building with as well.');
      log.push('Dungeon chests can hold a dish cooked from what that kind of dungeon keeps (its own ingredients), and now and then the recipe for one.');
      log.push('A task you take up without being asked (a beast caught, a find) says so, and whose it is; the journal says whose a task is ("For ...") rather than who asked.');
      log.push('Imperial cities in worlds made from now have arenas, parks, training yards, animal pens, market squares and monuments, an academy or college, and many more houses and shops (a world already made keeps its cities as they are).');
    },
  },
  {
    // Round 71: every master of the old places painted anew, its parts
    // moving on it; and four ancient places on the great continents, each
    // with its evolved master, raised in a world already made (their
    // doors set in the ground, wherever it's been kept).
    to: '0.71.0',
    data(d, log) {
      log.push('Every master of the old places has been painted anew, bigger and in far more detail, its arms, heads, jaws, wings and tails moving on it as it fights, with new effects for its blows, its phases and its fall.');
      log.push('Four ancient places have opened on the great continents: the Athanor and the Hall of the Last Champion on Velmarch, the Sundered Reach and the Gullet of the World on Ostria. Their masters are evolved: twice the size of any other, four or five phases, a dozen ways to kill you each, and they rise again the first time they fall.');
    },
    game(game, log) {
      let n = 0;
      for (const s of game.world.sites || []) {
        if (!s.ancient || s.x === undefined) continue;
        restamp(game.world, s);
        n++;
      }
      if (n) log.push(`${n} ancient places stand on the great continents now (look for them on your map, once you've heard of them).`);
    },
  },
  {
    // Round 72: the ancient places' gates made over, grand (and the Reach
    // a rift torn in the ground); the evolved masters painted better, and
    // each leaving a thing of its power, five-star arms, and an
    // achievement; more rooms in their places.
    to: '0.72.0',
    data(d, log) {
      log.push('The ways into the ancient places are made over, each four times the size it was: the Athanor\'s precinct and dome, the Champion\'s barrow and its colossus, the Gullet\'s crater of bone; and the Sundered Reach is no building at all but a rift torn across the ground, cracked and alight. The camera draws back as you come up to them.');
      log.push('Each evolved master now leaves a thing of its own power when it falls (the Hand of the Great Work, the Crawler\'s Needle, the Champion\'s Gauntlet, the Alinelidan\'s Tooth: used from your belt), three or four five-star pieces of arms and armour, and an achievement with a title to go by.');
      log.push('The ancient places have more kinds of room (orreries, salt gardens, furnaces; tombs, an arena, reliquaries; shard-storms and flickering floors; leech-pools, throats, nests), and more of their own dressing.');
    },
    game(game, log) {
      let n = 0;
      for (const s of game.world.sites || []) {
        if (!s.ancient || s.x === undefined) continue;
        restamp(game.world, s);
        n++;
      }
      if (n) log.push(`The ${n} ancient places' gates have been raised anew, grander than they were.`);
    },
  },
  {
    // (Round 73) The QOL update.
    to: '0.73.0',
    data(d, log) {
      log.push('Every town on the coast now has a dock as big as the town (a jetty, a pier, a harbour with a T-head and lamps), built where there was none and grown as the town grows. Ships are sold by the shipwright down at the pier, in realms that know how to build them.');
      log.push('Weapon racks hold and show weapons; display stands, wall hangers and paintings, small and large, are new to build (and new towns hang them as their peoples like).');
      log.push('The ancient places keep their own creatures now, nothing borrowed from the old barrows; the perils that came for you anywhere in an old place are gone.');
      log.push('Worlds made from now on have winding streets for some peoples, homes of more shapes with rooms, and more variety in the far lands\' ground, peoples and names. (Towns already laid out keep their plans.)');
    },
    game(game, log) {
      // The far realms catch up on what they knew from the first: twenty
      // to thirty steps of learning on the continents, ten to fifteen on
      // the isles beyond the storm, and trade ships.
      const T = game.sim && game.sim.tech;
      let n = 0;
      for (const civ of (game.world.ow && game.world.ow.civs) || []) {
        if (!T || !civ.far || civ.freed) continue;
        const cap = game.world.ow.settlements[civ.capital];
        if (!cap) continue;
        const st = T.stateOf(cap);
        const before = st.done.length;
        T.startingPerks(civ, st);
        if (st.done.length > before) n++;
      }
      if (n) log.push(`${n} of the far realms have caught up on what they always knew: their learning, and their ships.`);
      // The Champion's and the Gullet's gates, raised again as they now are.
      let g = 0;
      for (const s2 of game.world.sites || []) {
        if (!s2.ancient || s2.x === undefined || (s2.type !== 'champion' && s2.type !== 'gullet')) continue;
        restamp(game.world, s2);
        g++;
      }
      if (g) log.push('The Champion\'s and the Gullet\'s gates have been made over.');
    },
  },
  {
    to: '0.74.0',
    data(d, log) {
      log.push('Paintings hang on walls now, drawn flat against them whichever way you look, and need no floor under them. Worlds made from now on hang them a pace up the wall, have homes of two storeys with a stair up, and academies and research halls walled into more rooms and better fitted out. (Towns already laid out keep their plans.)');
    },
    game(game, log) {
      // Old places' names, four words at most.
      let n = 0;
      for (const rec of (game.sim && game.sim.dungeons && game.sim.dungeons.all) || []) {
        if (!rec.name) continue;
        const short = shortName(rec.name);
        if (short !== rec.name) {
          rec.name = short;
          n++;
        }
      }
      if (n) log.push(`${n} old place${n === 1 ? ' goes' : 's go'} by a shorter name now.`);
    },
  },
  {
    to: '0.75.0',
    data(d, log) {
      log.push('Stairs, in each kind of floor\'s stone or wood: a step you can climb with something over your head, drawn turned the way it climbs. Houses of two storeys go up them.');
    },
    game(game, log) {
      // Houses of two storeys already standing: their plank steps made over
      // into stairs of their own floor (where the house is loaded).
      const w = game.world;
      const Y0 = SURFACE + 1;
      let n = 0;
      for (const L of w.layouts.values()) {
        for (const b of L.buildings || []) {
          const st = b.stair;
          if (b.storeys !== 2 || !st || w.getBlock(st.low.x, Y0, st.low.z) !== B.planks_dark) continue;
          const floor = b.mats && b.mats.floor ? b.mats.floor : B.planks;
          const stair = stairFor(floor);
          const up = b.stairUp ?? (st.mid.z > st.low.z ? 0 : st.mid.x < st.low.x ? 1 : st.mid.z < st.low.z ? 2 : 3);
          w.setBlock(st.low.x, Y0, st.low.z, stair, up);
          w.setBlock(st.low.x, Y0 + 1, st.low.z, B.air);
          w.setBlock(st.low.x, Y0 + 2, st.low.z, floor);
          w.setBlock(st.mid.x, Y0, st.mid.z, floor);
          w.setBlock(st.mid.x, Y0 + 1, st.mid.z, stair, up);
          w.setBlock(st.top.x, Y0, st.top.z, floor);
          w.setBlock(st.top.x, Y0 + 1, st.top.z, floor);
          w.setBlock(st.top.x, Y0 + 2, st.top.z, stair, up);
          n++;
        }
      }
      if (n) log.push(`${n} house${n === 1 ? '\'s' : 's\''} steps made over into stairs.`);
    },
  },
  {
    to: '0.76.0',
    data(d, log) {
      log.push('Folk who knock at a door wait half a minute for an answer and then go on their way, and never at their own; the salt flats are less of a glare; a carried torch\'s light no longer flickers as you walk.');
    },
    game(game, log) {
      // Paintings hung where they never should have been: in temples,
      // jails, barns and the like; over a door; with no wall behind them;
      // or in the place of a wall between rooms (put back).
      const w = game.world;
      let n = 0;
      for (const L of w.layouts.values()) {
        for (const b of L.buildings || []) {
          if (b.x0 === undefined) continue;
          const deny = NO_PAINTINGS.has(b.type);
          for (let z = b.z0; z <= b.z1; z++) {
            for (let x = b.x0; x <= b.x1; x++) {
              for (let y = SURFACE + 1; y <= SURFACE + 6; y++) {
                const id = w.getBlock(x, y, z);
                if (!BLOCKS[id] || !BLOCKS[id].painting) continue;
                const below = w.getBlock(x, y - 1, z);
                const above = w.getBlock(x, y + 1, z);
                const wallMat = b.mats && b.mats.wall;
                const inWall = wallMat !== undefined && below === wallMat && above === wallMat;
                const d = wallDirOf(w, x, y, z, w.getMeta(x, y, z) & 3);
                const behind = d >= 0 ? BLOCKS[w.getBlock(x + WALL_DIRS[d][0], y, z + WALL_DIRS[d][1])] : null;
                const overDoor = !!(behind && (behind.interact === 'door' || behind.name === 'door_top'));
                if (!(deny || inWall || d < 0 || overDoor)) continue;
                w.setBlock(x, y, z, inWall ? wallMat : B.air);
                n++;
              }
            }
          }
        }
      }
      if (n) log.push(`${n} painting${n === 1 ? '' : 's'} hung where ${n === 1 ? 'it' : 'they'} shouldn't have been taken down.`);
    },
  },
  {
    to: '0.77.0',
    data(d, log) {
      // (Nothing in the save to change: the beds upstairs are counted as the
      // towns are laid out, the coaches and ferries stand ready at runtime,
      // and folk start remembering what you do from now.)
      log.push('Folk sleep upstairs in houses of two storeys (room for children born from now on); a coach stands outside every town and a ferry off every pier near the sea; rain, snow and water show on the ground; and people remember what you do for them, or to them.');
    },
  },
  {
    // (Round 78) Nothing in the save to change: what's new keeps itself
    // (ships of your own design, causes, rides, blueprints), and anything
    // out of place in the world is put right as it loads, every time, by
    // the save check (see savehealth.js), not by a step here.
    to: '0.78.0',
    data(d, log) {
      log.push('The coach and the ferry carry you the whole way (T hurries the hours on, on your own); ladders, a grappling hook, blueprints and a shipwright\'s bench for ships of your own; towns vote on their laws and their mayors; pirates have a cove, and raiders put out from it; and every save is looked over as it loads, and anything out of place put right.');
    },
  },
  {
    // (Round 79) Your own map markers and the landmarks found (none yet);
    // the stories' director and what the towns remember of them (from
    // now on); a mod's versioned steps run once its world opens (see
    // mod/scripts.js). The land itself stays as it was made: landforms,
    // rivers with character and landmarks are for worlds made from now.
    to: '0.79.0',
    data(d, log) {
      d.mapMarks ||= [];
      d.landmarksFound ||= {};
      const sg = d.sim && d.sim.saga;
      if (sg && typeof sg === 'object') sg.memories ||= [];
      if (d.mods && d.mods.state) d.mods.state.migrated ||= {};
      log.push('Stories now come at a pace (a quiet stretch after something hard, an opening after a loss), folk remember the ones you had a hand in, and more of them can be settled without a fight; trails lead from town to town and over the sea; map markers of your own; crafting by fives or as many as you can; and mods can have scripts, commands and steps of their own. (New worlds also get landforms, rivers with character and landmarks.)');
    },
  },
  {
    // (Round 80) Nothing in the save changes shape. The old places' floors
    // are laid out afresh as they're next gone down (with their great
    // rooms: see dungeongen.subRooms), and what's kept of the ones you've
    // been on is let go of (see dungeon.FLOOR_GEN): said so here.
    to: '0.80.0',
    data(d, log) {
      const kept = Object.values((d.sim && d.sim.dungeons && d.sim.dungeons.list) || []).some((q) => q && q.floors && Object.keys(q.floors).length);
      log.push(`The game runs lighter: towns are laid out on a thread of their own, the ground and the light are drawn again only when they change, and a master's hall holds the rest of its place still while you fight it. ${kept ? 'The old places you\'ve been down are laid out afresh (some of their rooms bigger now, walled into rooms within), so their floors are as new.' : 'Some of the old places\' rooms are bigger now, walled into rooms within.'}`);
    },
  },
  {
    // (Round 81) Nothing in a world changes: Tessera is a desktop app now
    // too, which keeps its worlds in its own folder (see electron/data.js).
    to: '0.81.0',
    data(d, log) {
      log.push('Tessera can be played as a desktop app now (Tessera.exe), keeping its worlds in a folder of its own on your computer; this world plays as it did.');
    },
  },
  {
    // (Round 82) Landmarks you come across aren't pinned on the map for
    // you any more (only those you're told of are): the pins put there for
    // ones found, taken off. (The snow no longer lies; there was none kept.)
    to: '0.82.0',
    data(d, log) {
      const found = d.landmarksFound || {};
      const pins = Array.isArray(d.pins) ? d.pins : [];
      const keep = pins.filter((q) => !(q && q.landmark && found[q.landmark] && found[q.landmark].how === 'found'));
      if (keep.length !== pins.length) {
        log.push(`${pins.length - keep.length} landmark${pins.length - keep.length === 1 ? '' : 's'} you'd come across taken off your map (found ones aren't marked for you now: mark them yourself if you like).`);
        d.pins = keep;
      }
      log.push('Coaches keep to the roads and streets now, and you pick where to go on a map; horses and wagons turn as they go (A and D to turn them, W and S to go).');
    },
  },
  {
    // (Round 83) Nothing kept in a world needs changing: an Academy built
    // before keeps its size (new ones are bigger, with a room at the back
    // for the registrar), and its classes, and its registrar's hours, are
    // the new kind from the next one on. (The weather and water effects'
    // settings became one, Environmental VFX: see loadSettings.)
    to: '0.83.0',
    data(d, log) {
      log.push('Academy classes are real lessons now: the master shows you how things are done, puts questions to the room (answer for practice) and sets work at the room\'s own oven, dummies, desk or bench. The registrar keeps hours, eating at noon and sleeping at night.');
      log.push('Notice boards list the town\'s positions, and more varied odd jobs; most peoples bar their doors at night; you walk a quarter slower (horses and wagons as quick as ever).');
    },
  },
  {
    // (Round 84) A great ship's lower decks are part of her now, not a
    // place apart: whoever was saved below is put back aboard her at that
    // spot as the ship's loaded (see shipgame.shipLoad: `below`). An
    // empire's empty houses get their people the next time it's laid out
    // (see civic.settleEmpire), and an Ashborn square in the old mosaic is
    // laid again the new way (see tech.emberMosaic). A world made before
    // keeps its continents' ground as it was (provinces, and a city's
    // other graveyards, are for worlds made from 0.84 on: world gen 8).
    to: '0.84.0',
    data(d, log) {
      log.push('Ships\' lower decks are part of the ship now: walk down the stairs and the decks above are cut away, nothing moves you elsewhere (anyone saved below is back aboard where they were).');
      log.push('Storms: thunderstorms, hail, blizzards, sandstorms and gales, with the wind in the trees and plants.');
      log.push('Empires\' empty houses are lived in now, from the next time you\'re there; and Kharos\'s kiln-tiled squares are laid in a calmer pattern.');
      if ((d.wg || 1) < 8) log.push('This world keeps its continents as they were made: a new world has Velmarch and Ostria parted into provinces of their own country, and more than one graveyard in each city.');
    },
  },
  {
    // (Round 85) Quests say plainly what to do and where (the journal's
    // "To do" and "Where", worked out as it's read: nothing in the save
    // to change), and what you'd taken on is marked on the map the first
    // time the world runs (see Saga.update). Ships flood by the world's
    // clock, and take a patch of any solid block.
    to: '0.85.0',
    data(d, log) {
      log.push('Quests say plainly what to do and where: see "To do" and "Where" in the quest log (O). What you\'ve taken on is marked on your map.');
      log.push('A holed ship floods while you sleep or wait too, and any solid block (cobblestone, stone) patches a hole. Ships you fire on fight back or run.');
    },
  },
  {
    // (Round 86) Anchors weighed at the capstan, flags in layers, piracy and
    // the pirate guilds, the spyglass. The pirates' one cove is now the first
    // of three (one per guild): what's known of it carries over (see
    // pirates.piratesLoad); nothing else in a save needs changing.
    to: '0.86.0',
    data(d, log) {
      log.push('Anchors are weighed at the capstan now: bigger ships want more hands at the bars. Flags can be built up in layers at the blueprint table.');
      log.push('Sink ships that never fired on you and you turn pirate: their realm hunts you, honest crew mutiny, and the pirate coves (three guilds now) let you in to swear to them. Ports sell a spyglass.');
    },
  },
  {
    // (Round 87) Bridges walkable end to end (any already built in a part of
    // the world kept in the save are cleared as it loads: see
    // bridges.clearBridgeWalk); nothing else in a save needs changing.
    to: '0.87.0',
    data(d, log) {
      log.push('Bridges always have a clear way across now (any you\'d found blocked are cleared as you get near them). Coaches keep to the ground under trees.');
      log.push('With a curfew on, the watch won\'t open the town gates till dawn unless something\'s chasing you; each guard remembers if they\'ve warned you before.');
    },
  },
  {
    // (Round 88) Talk and beds: nothing in a save needs changing.
    to: '0.88.0',
    data(d, log) {
      log.push('Asking around about trouble tells you who to see: only the one asking hands out their task. Nobody sleeps where there\'s no bed, and breaking a bed with someone in it wakes them, angry.');
    },
  },  {
    // (Round 89) Chairs and music: nothing in a save needs changing.
    to: '0.89.0',
    data(d, log) {
      log.push('Chairs tuck right in under their tables, and are easier to click. Instruments are heard by everyone nearby, in a world with others too.');
    },
  },  {
    // (Round 90) Wagons shared between players: a wagon set down before
    // now has no owner noted, and anyone may take up its reins as before.
    to: '0.90.0',
    data(d, log) {
      log.push('Riding in another player\'s wagon works now: only its owner drives, and whoever\'s sat in it is carried along.');
    },
  },
  {
    // (Round 91) The map below ground on a guest's screen: nothing kept
    // changes (what's been seen is kept as before, and now by all of you).
    to: '0.91.0',
    data(d, log) {
      log.push('Guests see the map below ground now, with what everyone down there has seen.');
    },
  },
  {
    // (Round 92) A time crystal's scene, seen by everyone about the way
    // in: nothing kept changes.
    to: '0.92.0',
    data(d, log) {
      log.push('A time crystal used at a way in is seen by every player near it now.');
    },
  },
  {
    // (Round 93) Fallen packs burst when clicked; a crystal used twice
    // over a pack's warning goes ahead. Nothing kept changes.
    to: '0.93.0',
    data(d, log) {
      log.push('A fallen pack bursts open when clicked, spilling all it held; a time crystal used again after its warning about a pack goes ahead; and every master\'s attacks have their sounds.');
    },
  },  {
    // (Round 94) The way on waits for all of you; a Kavorent hall's floors
    // made afresh are less crowded (the ones already been on are kept).
    to: '0.94.0',
    data(d, log) {
      log.push('Taking the stairs below ground waits for everyone on the floor now, and Kavorent floors not yet visited are less crowded.');
    },
  },
  {
    // (Round 95) The barrow made over: its floors, the ones already been on
    // too, are laid out afresh when next gone down to (see dungeon.genOf);
    // its own dead and its masters drawn by hand.
    to: '0.95.0',
    data(d, log) {
      log.push('Barrows are made over: new rooms, puzzles, lore and creatures, and every barrow master redrawn. Barrow floors you have already been on are laid out afresh the next time you go down.');
    },
  },
  {
    to: '0.96.0',
    data(d, log) {
      log.push('Mines are made over: new rooms, firedamp, carts, pumps and bells, new creatures, and every mine master redrawn. Mine floors you have already been on are laid out afresh the next time you go down.');
    },
  },
  {
    to: '0.97.0',
    data(d, log) {
      log.push('Crypts are made over: the vigil candles, a nave and its chapels, the donors\' tombs, the drowned undercroft, new creatures, and every crypt master redrawn. Crypt floors you have already been on are laid out afresh the next time you go down.');
    },
  },  {
    to: '0.98.0',
    data(d, log) {
      log.push('Holdouts are made over: lived-in caves with a mess, bunks, scaffolds for the lookouts, a kennel, cells with captives, plunder crates and a hidden stash, powder trails, tripwires and pits; new creatures, and every holdout chief redrawn. Holdout floors you have already been on are laid out afresh the next time you go down.');
    },
  },
  {
    to: '0.99.0',
    data(d, log) {
      log.push('The Kavorent ruins are made over: drawn afresh, with the sleepers\' cradle halls, galleries, the orrery, repair bays, conduit spines and the memory well; sentinel lenses, live cables, new constructs, and their masters redrawn. Kavorent floors you have already been on are laid out afresh the next time you go down.');
    },
  },
  {
    to: '1.0.0',
    data(d, log) {
      log.push('The Wildwood Hollows are made over: drawn afresh, with hollows and their banks, rootways, dells, the keepers\' shrines, the halls of the Kept, sunwells and woodcutters\' camps; the ring and its glade, offering stones and their hob, snares, puffballs and the sun-seed; woodwose, drowsebloom, glimmer and delver; and their masters redrawn. Hollow floors you have already been on are laid out afresh the next time you go down.');
    },
  },
  {
    to: '1.1.0',
    data(d, log) {
      log.push('The Kiln-Deeps are made over: drawn afresh, with great forges and their trip-hammers, casting pits, quench halls, bellows rooms, guild-halls, the king\'s gallery, coal stores and flues; the kiln-key cast in its mould, the singing anvils and the guild-door, steam vents and flaring grates; ash-smiths, bellowsbacks and iron wardens; and their masters redrawn. Kiln-Deep floors you have already been on are laid out afresh the next time you go down.');
    },
  },
  {
    to: '1.2.0',
    data(d, log) {
      log.push('The Tide Grottos are made over: drawn afresh, with tidal flats, clam beds, divers\' camps, sea-shrines, blowholes, eel-runs and glow-pools; the tide coming in and going out on its clock, the clams and their pearls, the shrine\'s scallops and the sea-door, the bells, the urchins; drowned divers, morays, lantern jellies and shrimpkin; and their masters redrawn. Tide Grotto floors you have already been on are laid out afresh the next time you go down.');
    },
  },
  {
    to: '1.3.0',
    data(d, log) {
      log.push('The Imperial Catacombs are made over: drawn afresh, with galleries of shelf-graves, columbaria, the legion\'s basilica, the family\'s cubiculum, the ossuary and the hall of the Triumph; the lamps, the lemures that snuff them and the fossors who light them again; graves to rob (mind the fossors), the busts of the house to honour in order; the aquilifer and the grasping hands; and their masters redrawn. Catacomb floors you have already been on are laid out afresh the next time you go down.');
    },
  },
  {
    to: '1.4.0',
    data(d, log) {
      log.push('The Terracotta Vaults are made over: drawn afresh, with the army in its trenches, the chariot pit, the palace\'s court, the empire in quicksilver, the artisans\' workshop, the shrine of the five directions and the crossbow gallery; statues that aren\'t clay, the drummer\'s drum and bell, the quicksilver that splits and wakes the statues, the sealed artisans who mend the broken, the crossbows in the walls, the discs of the directions and the artisans\' tunnel; and their masters redrawn. Vault floors you have already been on are laid out afresh the next time you go down.');
    },
  },
  {
    to: '1.5.0',
    data(d, log) {
      log.push('The Leviathan\'s Guts are made over: drawn afresh, with the gullet, the whalers\' camp under the ribs, the stomach with the swallowed ship, the valve, the gutworms\' nest, the ambergris pocket and the artery; the heartbeat, the valves that open on it, the ridged floor that pushes, the bile that burns, the blisters that burst, the gutworms that latch on, the hermits that wear ambergris, and the whalers\' scar; and their masters redrawn. Gut floors you have already been on are laid out afresh the next time you go down.');
    },
  },
  {
    to: '1.6.0',
    data(d, log) {
      log.push('The Salt Cathedrals are made over: drawn afresh, with the miners\' chapel, the brine lake and its sluice, the workings and their gallery, the shaft and its loft, the brine pans and the singing hall; the brine that crusts you fast and mends the salt dead, the chandeliers on their ropes, the singing crystals, the drowned chapel behind the flooded arch, the bricked-up chapel, the rakers, the blooms and the pale flamingos; and their masters redrawn. Salt Cathedral floors you have already been on are laid out afresh the next time you go down. (And the rope ladders up to the ledges of the Leviathan\'s Gut are there now.)');
    },
  },
  {
    to: '1.7.0',
    data(d, log) {
      log.push('The Deep Warrens are made over: drawn afresh, with the Hollowfolk\'s delve and its loft, the stores, the moot and its tiers, the old round tunnel and its stopper, the root hall and the mushroom garden; the noise of the scree and the boards that the blind tunnelers hear, the lantern pods, the hollow floor, the pantry behind the dresser, the gloom moths, the larder grubs and the rootbound; and their masters redrawn. Deep Warren floors you have already been on are laid out afresh the next time you go down.');
    },
  },
  // (Round 108) The Hollow Hill made over (its floors' make raised: see
  // dungeon.js KIND_GEN).
  {
    to: '1.8.0',
    data(d, log) {
      log.push('The Hollow Hills are made over: drawn afresh, with the court\'s hall and its throne, the feast you mustn\'t eat, the ring that takes you dancing, the five standing stones and the cairn they open, the passage tomb, the birchwood and the bower behind its door; the hill-doors, each with its twin somewhere else in the hill; the golden harp; the fey lanterns the wisps drink dark and the hob lights again; the changelings and the witch-hares; and their masters redrawn. Hollow Hill floors you have already been on are laid out afresh the next time you go down.');
    },
  },
  // (Round 109) The Drowned Broch made over (its floors' make raised: see
  // dungeon.js KIND_GEN).
  {
    to: '1.9.0',
    data(d, log) {
      log.push('The Drowned Brochs are made over: drawn afresh, with the court and its scarcement ledge, the wheelhouse and its bays, the gallery climbing in the wall, the drowned stair going down into the water, the wreckers\' den and its strongroom, the beacon on its dais and the boat-noust; the gale through the slits, the cruisie lamps, the beacon fed with fish-oil, the false lights the drowned rise to, the wall-cells and the trowies\' hoards; the trowies, the lantern-bearers and the fulmars; and their masters redrawn. Drowned Broch floors you have already been on are laid out afresh the next time you go down.');
    },
  },
  // (Round 110) The Athanor made over (its floors' make raised: see
  // dungeon.js KIND_GEN).
  {
    to: '1.10.0',
    data(d, log) {
      log.push('The Athanors are made over: white and gold marble, a stage of the Work to each floor (the nigredo, the albedo, the rubedo), with the laboratorium and its alcoves, the great athanor on its dais, the cloister and its fountain, the speculum and its sanctum, the vat-hall and the garden of metals; the sun-lamp\'s beam and its mirrors, the transmutation table, the athanor\'s egg and the Red Tincture, the vats, and the quicksilver and its fumes; the adepts, the leaden sentinels and the vat-tenders; and the Divine Alchemist redrawn. Athanor floors you have already been on are laid out afresh the next time you go down.');
    },
  },
  // (Round 111) The Hall of the Last Champion made over (its floors' make
  // raised: see dungeon.js KIND_GEN).
  {
    to: '1.11.0',
    data(d, log) {
      log.push('The Halls of the Last Champion are made over: sandstone and bronze and his faded banners, a floor to each of what it was (the Hall of Honours, the Hall of Trials, the Sealed Barrow), with the hall of honours and its gallery, the feast-hall, the oath chapel and its door, the barracks, the wound and its wards, and the hall of the fallen; the oath, the wards, the memorials and the keeners; the huntress\'s shades, the curselings, and the dead getting up again cursed; and the Hero redrawn. Hall floors you have already been on are laid out afresh the next time you go down.');
    },
  },
  // (Round 112) The Sundered Reach made over (its floors laid out afresh:
  // its generator raised: see dungeon.js KIND_GEN).
  {
    to: '1.12.0',
    data(d, log) {
      log.push('The Sundered Reach is made over: the red mesa of the Sky-Watchers and the black glass of the void growing through it, a floor to each of what the void has done (the Mesa, the Fault, the Between), with the dwellings and their lofts up ladders, the observatory and the kiva under its sighting-stones, the fault and its chasm and phase-bridges, the crystal-caverns, the shrine, and the breach; the rift weavers and their threads, the shardbacks, and the watchers\' echoes; and the Rift Crawler redrawn. Reach floors you have already been on are laid out afresh the next time you go down.');
    },
  },
  // (Round 113) The Gullet of the World made over (its floors laid out
  // afresh: its generator raised: see dungeon.js KIND_GEN).
  {
    to: '1.13.0',
    data(d, log) {
      log.push('The Gullet of the World is made over: the worm\'s bore through the earth and through the first kingdom of Ostria it swallowed, a floor to each of how far down (the Bore, the Swallowed City, the Belly), with the bore and its cracked roof, the street and its roofs up ladders, the temple\'s terraces and the god\'s table, the canal and its sluice, the clutch, the shed skins, and the hoard; the tremors, the river god\'s favour, the bricked-up doors; the borers, the clutch-mothers, and the Swallowed who lead you; and the Alinelidan redrawn. Gullet floors you have already been on are laid out afresh the next time you go down.');
    },
  },
  // (Round 114) Fixes and the barrow's heights: every kind of old place's
  // floors laid afresh (its stairs the right way round, its pools in the
  // floor, its rooms no more crowded than its tier allows). Nothing else
  // in a save to change: a coach away on the road isn't kept, and a cell
  // with someone in it is locked from now on.
  {
    to: '1.14.0',
    data(d, log) {
      log.push('Fixes: the barrow\'s ship has a ladder out of its hold and wooden sides; barrow floors have raised galleries and sunken floors with steps; dungeon floors blend and mostly use their plain tiles; stairs everywhere climb the right way; pools sit in the floor; no more than 3 to 5 foes to a room by tier; the corpse-light throws cold fire; the old hound stays put and eats the bones you drop; the time crystal never shuts you in the way it rebuilds; cells are locked while anyone\'s in them (a lockpick opens them, and prisoners let out run for it); a doorway is not a house; the coachman drives his own coach and keeps his hours; weather changes gently; skipping days and weddings no longer freeze the game. Floors of old places you have been on are laid out afresh the next time you go down.');
    },
  },
  // (Round 115) Quicker, not different: nothing in a save to change.
  {
    to: '1.15.0',
    data(d, log) {
      log.push('Smoother: a town\'s morning business, a town coming into view, a nearby city being laid out and the look for a pier are all worked through a little each frame instead of all at once; the ground by an old place\'s way in is kept while you\'re below, so climbing out is instant; icons, signs, dishes and masters are no longer read back off the screen to be drawn; creatures stop searching every frame for a way that isn\'t there; and with others playing, the host sends each floor\'s plan for the map (no more laying the floor out again on your own machine) and works out what to send once for all of you.');
    },
  },
  {
    to: '1.16.0',
    data(d, log) {
      log.push('Seen, and fair: the lantern jellies and shrimpkin are drawn as they should be; a jelly\'s sting and a moray\'s lunge are shown before they land, and morays strike again from their holes; urchin beds show at every tide, their spines up through the water; a gale\'s line and the vault\'s bolt plates show before they hurt you; the crossbow has its own look. Coaches: only some realms run them; a coach pulls up beside the one standing in the far town, at the way in on the side it came from, then drives home where you can see it; Space gets you down, your fare back if it had hardly set off.');
    },
  },
  {
    to: '1.17.0',
    data(d, log) {
      log.push('Old places show their tier on the map (bronze, silver, gold; tier III alight), and their ways in grow grander with it, built back up stone by stone when a time crystal turns them back. Relic shards are set at an anvil. Chests behind bars can no longer be reached through them. Item descriptions say plainly what things do. The fairy rings let you go, and nothing gone wrong in the drawing can leave the view turned or shifted.');
    },
  },
  {
    to: '1.18.0',
    data(d, log) {
      log.push('Playing together: a guest can skip their opening with Enter, doors swing open and shut on everyone\'s screen, and the HUD and windows are always drawn, whatever else goes wrong. Townsfolk who climb a stair to an upper floor stay up there.');
    },
  },
  {
    to: '1.19.0',
    data(d, log) {
      log.push('Nobody a floor above or below sees you pick a lock (or anything else you do). A guest\'s HUD is hidden during their opening and cutscenes. Anyone on a floor that\'s cut away above you, or a floor below yours, is no longer drawn floating in your room.');
    },
  },
  {
    to: '1.20.0',
    data(d, log) {
      log.push('An old place\'s tier shows on the map as a numeral (I, II or III) in its colour on the corner of its icon. Nothing solid stands just inside the doorway of a boss\'s hall any more (floors already laid out keep theirs till they\'re laid out again).');
    },
  },
  {
    to: '1.21.0',
    data(d, log) {
      // (Towns have no office of a player's yet: each starts under the
      // charter it would have, when someone takes it.)
      if (d && d.sim && !d.sim.office) d.sim.office = { towns: {}, offers: [] };
      log.push('You can govern a town: stand for mayor where you\'re a citizen (or be appointed, acclaimed, seize the hall, or found a village), and run it from the council window (N): its matters, taxes, laws, spending, factions, officers, charter and realm.');
    },
  },
  {
    to: '1.22.0',
    data(d, log) {
      // (No realm is a player's yet: every one keeps the government its
      // name has always given it.)
      if (d && d.sim && !d.sim.crown) d.sim.crown = { realms: {}, heirs: {} };
      log.push('You can rule a realm: break your town away, be named heir, be chosen speaker, or seize the throne, and govern it from the crown window (N) as a monarchy, republic, clan moot, holy realm or merchant league.');
    },
  },
  {
    to: '1.23.0',
    data(d, log) {
      // (Nothing in a world to change: three new origins for new
      // characters.)
      void d;
      log.push('Three new origins for new characters: a Leader (of a town, or a whole realm, governed as you choose), a Brigand (a pirate with a sloop of their own, at the Black Gulls\' haven), and an Outworlder (fallen from space in an escape pod, with mutations of your choosing).');
    },
  },  {
    to: '1.24.0',
    data(d, log) {
      // (Nothing in a world to change: an outworlder's mutations work
      // their own way now, read off the character as they are.)
      void d;
      log.push('An outworlder\'s mutations each work their own way now (a blow foreseen, a light of your own, a second heart and more), and the three newer origins\' openings are painted anew.');
    },
  },  {
    to: '1.25.0',
    data(d, log) {
      // (Nothing in a world to change: a town's or a realm's record starts
      // with its next sitting; officers' traits are read off them as
      // they are.)
      void d;
      log.push('Governing: a record of every matter decided, notes as matters come and votes are called, rates set to the point, officers\' traits, and a war\'s progress at a glance. Letters and books are held up to read, in their writers\' own hands.');
    },
  },  {
    to: '1.26.0',
    data(d, log) {
      // (Nothing in a world to change: the books are written from the world
      // as it is, and the long past behind it from its seed.)
      void d;
      log.push('Books: every shelf holds one of the world\'s own books, many pages long, written from its history, its realms, its wars, its roads, its tables, its old places, its beasts and its faiths.');
    },
  },  {
    to: '1.27.0',
    data(d, log) {
      // (Nothing to change: the writers of the world start from today, and
      // every book already on the shelves stands as it always has.)
      void d;
      log.push('Books: written better, each writer in a voice of their own; novels, with sequels and prequels; and the bookish of every town now write and publish, their books rising and falling in favour, sold by merchants and read on the benches.');
    },
  },  {
    to: '1.28.0',
    data(d, log) {
      // (Nothing to change: a shelf's books are put on it the first time
      // it's looked in, and the bigger inns are for towns laid out from
      // now on; the towns already standing keep theirs.)
      void d;
      log.push('Library shelves hold books to take down and read (pay a scholar before you walk out with one); wagons can be clicked and walked into; the people\'s own dishes can be cooked at a furnace, as their cookery books say; and every people sets its books in its own type.');
    },
  },
  {
    to: '1.29.0',
    data(d, log) {
      // (Nothing to change: festivals already announced are laid out round
      // the town, and given their games, when their day's put up; an ale
      // cask already standing is one to drink from like any new one.)
      void d;
      log.push('Festivals spread round the town (ale tables by the tavern, a blessing at the temple, stalls, games on the green) to a programme from morning to night; and they have games to play: archery, a foot race, wrestling the champion, an eating match, riddles, the dance, a cook-off, and each people\'s own (ringing the bell, the log toss, the raft race, the lantern walk), with prizes; music for tips, helping beforehand, a leader\'s speech, and mischief in the crowd.');
    },
  },
  {
    to: '1.30.0',
    game(game, log) {
      // Each guild's haven put ashore, on land nobody's seen yet (hidden
      // till it's found or heard of); anyone already sworn to a guild, on
      // its rolls and told where its havens are.
      const H = game.sim.havens;
      if (!H || game.remote) return;
      H.ensure();
      const B = game.sim.brethren;
      for (const [pid, r] of Object.entries((game.piracy && game.piracy.p) || {})) {
        if (r.guild === null || r.guild === undefined) continue;
        B?.joined(pid, r.guild);
        for (const h of H.standing(r.guild)) H.learn(h, pid, 'heard', 'the brethren');
      }
      log.push(`Pirates' havens: ${H.list.length} of them, hidden on lonely shores till you stumble on one or hear of it; captives in their stockades; the brethren's captains, chiefs and Articles, and a way up from hand to chief; realms that burn havens out, and villages that turn pirate.`);
    },
  },
  {
    to: '1.31.0',
    game(game, log) {
      log.push('Pirates\' havens learn the brethren\'s own lore (black ships, ransom brokers, powder magazines, fireships, hidden coves and more), and build a great pier for a black ship of their own. Ships keep to water that reaches the sea. A ship\'s hands talk as anyone does, and much more; their blows are seen coming; and they stay aboard when you save on a ship.');
    },
    town(L, game) {
      // A haven's flag: one mast, two tall, with nothing round it (it stood
      // on an unseen plinth three paces wide, and was only one tall).
      const s = L.settlement;
      const w = game && game.world;
      const sim = game && game.sim;
      if (!s || !s.haven || s.haven.razed || !w || !sim || !sim.setBlocks || !L.plaza) return;
      const { cx, cz } = L.plaza;
      const key = w.regionKey(Math.floor(cx / REGION_W), Math.floor(cz / REGION_D));
      const loaded = w.regionAt(cx, cz);
      const kept = w.saved && w.saved.has(key);
      if (!loaded && !kept) return;
      const flag = /^jolly_(gull|hand|tide)$/.test((BLOCKS[w.getBlock(cx, GROUND, cz)] || {}).name || '');
      if (loaded && !flag) return;
      const ops = [];
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) if ((dx || dz) && (!loaded || w.getBlock(cx + dx, GROUND, cz + dz) === B.plinth)) ops.push([cx + dx, GROUND, cz + dz, B.air, 0]);
      ops.push([cx, GROUND + 1, cz, B.jolly_top, 0]);
      sim.setBlocks(ops);
    },
  },
  {
    to: '1.32.0',
    game(game, log) {
      // (Nothing in the world to change: the forge's ways are new, and what
      // you've made already keeps its stars.)
      ((game.stats ||= {}).smithKnown ||= {});
      log.push('Arms, armour and tools are worked by hand now, at the forge, the bench, the bowyer\'s and the cutting table: their stars come of how well it\'s done, and of your Smithing. Additives and the old places\' materials lean what a piece comes out with; casts make copies. Dungeon loot is rarer and humbler, and reforging keeps a piece\'s stars as they are.');
    },
  },
  {
    to: '1.33.0',
    game(game, log) {
      log.push('The forge\'s workshops are rebuilt: rooms in true perspective, lit by the fire, the lamp and the window, every solid thing casting its shadow.');
    },
  },
  {
    to: '1.34.0',
    game(game, log) {
      log.push('The game runs lighter: the world drawn in fewer strokes, the realms\' roads and far towns\' hours worked out a little at a time, the forge lit faster; nothing in the world itself changed.');
    },
  },
  {
    to: '1.35.0',
    game(game, log) {
      log.push('The townsfolk have inner lives now: hidden talents and skills they learn by doing, feelings that rise and fade, memories and opinions they pass on; what they say comes of all of it. (Each starts with nothing on their mind.)');
    },
  },
  {
    to: '1.36.0',
    game(game, log) {
      log.push('The townsfolk act on their own now: they set their hearts on things and work at them, make friends and enemies of each other, come together over what troubles their town (and leave it, at last), and come looking for you. Everything they do with each other, you can do with them.');
    },
  },
  {
    to: '1.37.0',
    game(game, log) {
      // (A piece's modifier that worked only at some times reads as one a
      // trigger wakes, of itself: "keen-night" works all night as it did.
      // See world/triggers.js. Your own pack and what you wear: written
      // the new way.)
      const p = game.player;
      const fix = (k) => {
        const sp = k && parseStar(k);
        return sp ? starKey(sp.plain, sp.stars, sp.origin, sp.roll, sp.mods) : k;
      };
      let n = 0;
      for (const s of p ? p.inv : []) {
        if (!s) continue;
        const k = fix(s.item);
        if (k !== s.item) {
          s.item = k;
          n++;
        }
      }
      for (const slot of Object.keys((p && p.equip) || {})) {
        const k = fix(p.equip[slot]);
        if (k !== p.equip[slot]) {
          p.equip[slot] = k;
          n++;
        }
      }
      log.push(`Forged pieces carry triggers now (when you're struck, when you bring a foe down, when night falls...) and abilities (a healing aura, a meteor, chain lightning...), each trigger setting off one of its modifiers or its abilities; at an anvil what each sets off can be changed round.${n ? ` ${n} of your pieces had a modifier of the night, the deep and so on: it's woken by a trigger now.` : ''}`);
    },
  },
  {
    to: '1.38.0',
    game(game, log) {
      log.push('More triggers (a heavy blow, the dead struck, eating, the last foe falling, a blow from afar or behind, a broken guard, a fish landed, a foe felled at a blow, daybreak, rain) and more abilities (a wall of flame, a geyser, ironskin, a blood pact, a chain hook, a frost lance, a swarm, a well of night, a spring bloom, a smoke veil, a spirit wolf, a gale step); every ability drawn afresh in the world\'s own pixels.');
    },
  },
  {
    to: '1.39.0',
    game(game, log) {
      // (Weapons held by a town's guards from before: kept by them as they
      // were, handed back on release; from now on what's taken goes into an
      // evidence chest. See justice.confiscateWeapons.)
      const j = game.sim && game.sim.justice;
      if (j && !(j.vaults instanceof Map)) j.vaults = new Map();
      log.push('Every weapon has a special (hold the button, let go when it\'s ready), shown on the ground as it winds up; a new "special" trigger; relics only off masters of the old places (always off a third-tier one) and broken down into shards at an anvil; smiths priced by their skill, making anything forged; confiscated weapons locked in an evidence chest, a guard on the jail door, and visitors come into the jail to talk.');
    },
  },
  {
    to: '1.40.0',
    game(game, log) {
      // (Citizenship offered to other players: none waiting yet. See
      // Office.offerCitizen.)
      const o = game.sim && game.sim.office;
      if (o && !Array.isArray(o.citOffers)) o.citOffers = [];
      log.push('A town\'s head can make others its citizens (the others playing, if they accept; nomads, adventurers and merchants staying in town) and pardon the others playing (a realm\'s ruler, in every town of the realm); the council sits at ten o\'clock sharp, and what was sent to it is voted on then; a guest\'s HUD no longer disappears in a town where they lodge.');
    },
  },
  {
    to: '1.41.0',
    game(game, log) {
      // (Nothing in a world changes: only what goes over the network.)
      void game;
      log.push('Playing together is far lighter on the network: a fraction of the data each second, the ground sent a piece at a time, everything compressed between computers, and a player whose connection can\'t keep up no longer has more and more piled on it.');
    },
  },
  {
    to: '1.42.0',
    game(game, log) {
      // (Nothing kept needs changing: a town's map starts from where you
      // walk from now on; the histories already told stay as told.)
      game.townSeen ||= {};
      log.push('Weapon specials now strike in true shapes (a cone, a circle, a strip at any angle), so a blow aimed on the diagonal lands. The world map has a Civilization tab while you\'re in a town: its plan, drawn as you walk it. Folk who hold something against you are shorter with you, and the angriest won\'t talk at all.');
    },
  },
  {
    to: '1.43.0',
    game(game, log) {
      // (Nothing kept changes: a town's map is drawn from its layout, and
      // what you've seen of each town stays as it was.)
      void game;
      log.push('The town map (the world map\'s Civilization tab) is drawn in far more detail: the roofs, trees, crops, lanterns and paving as they are, and close in, glyphs the way the world map draws its land.');
    },
  },
];
// (What each kind of shop took in, in 0.51.)
const NEW_STOCK = { general: ['lute', 'flute', 'pipe', 'scroll'], carpenter: ['lyre', 'fiddle', 'hand_drum'], trapper: ['hunting_horn'] };

// The steps a world saved in version `gv` still needs, in order.
export function stepsFor(gv) {
  return STEPS.filter((s) => compareVersions(gv || null, s.to) < 0 && compareVersions(s.to, GAME_VERSION) <= 0);
}

// The save itself, brought up (in place): its data steps run, and the
// versions whose world and town steps are still to run noted in it
// (`pending`: run when it's loaded, see runMigrations). Returns { log,
// pending, from }.
export function migrateSave(d) {
  const from = d.gv || null;
  const log = [];
  const steps = stepsFor(from);
  for (const s of steps) {
    try {
      s.data?.(d, log);
    } catch (e) {
      log.push(`(${s.to}: ${e && e.message ? e.message : e})`);
    }
  }
  const pending = [...new Set([...(d.pending || []), ...steps.filter((s) => s.game || s.town).map((s) => s.to)])];
  d.pending = pending;
  d.gv = GAME_VERSION;
  return { log, pending, from };
}

// A loaded world: the steps it still needs run on it (and kept on its
// sim, so each town gets its own as it's laid out: see townMigrations).
export function runMigrations(game, pending) {
  const log = [];
  if (!pending || !pending.length) return log;
  const sim = game.sim;
  sim.migrate = [...new Set([...(sim.migrate || []), ...pending])];
  for (const v of pending) {
    const s = STEPS.find((q) => q.to === v);
    try {
      s?.game?.(game, log);
    } catch (e) {
      log.push(`(${v}: ${e && e.message ? e.message : e})`);
    }
  }
  // (Towns already laid out: theirs now.)
  for (const L of game.world.layouts.values()) if (L.econ) townMigrations(sim, L, !L.freshAttach);
  return log;
}

// A town laid out (see Sim.attach): any step it hasn't had yet. (One made
// fresh, never saved, already has everything new: only marked.)
export function townMigrations(sim, L, saved) {
  const pend = sim.migrate || [];
  if (!pend.length || !L.econ) return;
  L.econ.migrated ||= [];
  for (const v of pend) {
    if (L.econ.migrated.includes(v)) continue;
    L.econ.migrated.push(v);
    if (!saved) continue;
    const s = STEPS.find((q) => q.to === v);
    try {
      s?.town?.(L, sim.game);
    } catch {
      // (A town that won't take it is left as it was.)
    }
  }
}

export { PANTRY };
