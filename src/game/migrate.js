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
import { SURFACE } from '../config.js';
import { GAME_VERSION, compareVersions } from '../version.js';
import { stockPantry, PANTRY } from './cooking.js';
import { cookDish, parseDish } from '../world/dishes.js';
import { invAdd, invCount, kitchenOf, alive, traderOf } from '../sim/econ.js';
import { ITEMS } from '../world/items.js';
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
