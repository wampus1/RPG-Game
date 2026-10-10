// Game orchestrator: owns the world, entities, time, input handling and the
// rules for interacting with blocks and creatures.
import {
  TILE, LH, VIEW_W, VIEW_H, WORLD_Y, REGION_W, REGION_D, GROUND, WATER_Y, REACH, BELT_SIZE,
  GAME_MINUTES_PER_SECOND, DAY_MINUTES, SETTLEMENT_ACTIVE_DIST, INST_X0,
} from '../config.js';
import { World } from '../world/world.js';
import { tickFieldsOff } from '../entities/fields.js';
import { updateWorks } from '../entities/bosskit.js';
import { updateEvolved, evoHurt, isEvolved, rise } from '../entities/evolved.js';
import { BLOCKS, B, META_STATE, LOGS, LEAVES, CROPS, cropMeta, isFarmland, NATURAL, PLANK_BLOCKS } from '../world/blocks.js';
import { ITEMS, GEMS, rollDrops, itemForBlock, socketed, ARMOR_CAP } from '../world/items.js';
import { CONTAINER_SIZE } from '../world/loot.js';
import { Player, screenToWorld } from '../entities/player.js';
import { NPC } from '../entities/npc.js';
import { Creature, SPECIES } from '../entities/creature.js';
import { covers, onTiles, apart, padded, padOf, inReach, MASTER_PAD } from '../entities/footprint.js';
import { ItemDrop } from '../entities/itemdrop.js';
import { TREE_BUILDERS } from '../world/trees.js';
import { removeItem, makeSlots, addItem, canAdd } from './inventory.js';
import { mulberry32, hash4 } from '../util/rng.js';
import { M, BUILDING_NAMES } from '../world/settlement.js';
import { BIOMES } from '../world/biomes.js';
import { TEX } from '../render/textures.js';
import { Sim, buildingAt, RENOWN } from '../sim/sim.js';
import { ResearchWindow } from '../ui/research.js';
import { PortalWindow } from '../ui/portal.js';
import { LockWindow } from '../ui/lockpick.js';
import { lockTier, RELOCK_DAYS } from './lockpick.js';
import { alive, invAdd, DAY, setOverride, ledger, simulateTo } from '../sim/econ.js';
import { tickFires } from './fire.js';
import { updateEngines, hitEngine } from './engines.js';
import { updateShips, sailShips } from './shipping.js';
import { updateShips3d, tickLater, deckRenderPos } from './ships3d.js';
import { shipKey, shipWheel, shipMouse, shipCursor, shipSave, shipLoad, useShipItem, sailorTalk, hullAt, raftMeetsShip, npcAboard, shipGhostTick, holdViewTick, holdTurnKey, helmView } from './shipgame.js';
import { holdBlockChanged, holdUse } from './shiphold.js';
import { fleetsTick, idleShipsTick } from './shipfleets.js';
import { crewHurt } from './shipcrew.js';
import { updateLabor } from '../sim/labor.js';
import { drawable, beginDraw, tickDraw, cancelDraw, releaseDraw, throwAimed, flyAimed, arrowStrikes } from './archery.js';
import { throwDice, tickDice } from './dicegame.js';
import { Wildlife } from './wildlife.js';
import { packLabel, DungeonRun, DUNGEON_INTERACTS } from './dungeon.js';
import { startIntro } from './cutscene.js';
import { starSpot, makeCrater, starShockwave, starfallScene } from './starfall.js';
import { newFeats, noteIsle } from './achievements.js';
import { spireOpening, bossTint, liftRide, deathRitual, duelYield } from './scenes.js';
import { BLIGHT_R } from '../world/sites.js';
import { ancientAir, wadeTick } from './ancient.js';
import { updateEvolvedGear, clawMult, clawRend, clawSoak } from './evolvedgear.js';
import { updateQuestFinder } from './questfinder.js';
import { doorLocked, knock as knockDoor, houseOfDoor, unlockFor, updateKnocks } from './doorlocks.js';
import { useGadget, fitEnhancer, lanceThrust, pierceOf, updateKavTech, dropFields, raiseFields } from './kavtech.js';
import { setRelic, fitShard, relicAt, relicItem, relicDamage, updateRelics, nearRelic, serializeRelics, loadRelics } from './relics.js';
import { updateHazards, guardFront, kegBlast, throwDynamite, sameSide } from '../entities/monsters.js';
import { isleNightSpecies, waterNear } from '../entities/islemobs.js';
import { updateLasers } from './laser.js';
import { siteAt } from '../world/sites.js';
import { useTimeCrystal } from './timecrystal.js';
import { parryWindow, playerTick, roll, spend, interrupt, knock, canBlock, buffOf, styleOf, staminaCost, playerSwing, offhandOf, sweepTiles, STYLES, weaponStyle, strikeAnim, combatBuffText, guardBlow } from './combat.js';
import { jobTitle, visitorRecord } from '../entities/npcgen.js';
import { personName, familyName } from '../world/names.js';
import { RNG } from '../util/rng.js';
import { countItem } from './inventory.js';
import { launch as launchRaft, landing as raftLanding, floatable } from '../entities/raft.js';
import { enforceIslandLaws, raftDues, SPORE_BLOCKS } from '../sim/islelaws.js';
import { updateStormSea, stormLocked } from './stormsea.js';
import { updateSpireStorm } from './spirestorm.js';
import { wallTick } from './wallfall.js';
import { eruptTick } from './eruption.js';
import { ambientChatter } from './chatter.js';
import { CropGrowth } from './crops.js';
import { weatherAt, townWeather } from '../world/weather.js';
import { castLine, updateFishing, hook } from './fishing.js';
import { Playtime } from './playtime.js';
import { eatDish, dishFx, learnRecipe } from './cooking.js';
import { gainMastery } from './mastery.js';
import { dishTrigger, dishWarded, sheepFilter } from './dishacts.js';
import { CookWindow, RecipeScrollWindow } from '../ui/cook.js';
import { TravelWindow } from '../ui/travel.js';
import { coachStand, ferryStand, arrivalSpot, wayTime } from '../sim/coaches.js';
import { InstrumentWindow } from '../ui/instrument.js';
import { spawnPerson, spawnBeast } from '../sim/saga/actors.js';
import { R as SR, pidOf as sagaPid } from '../sim/saga/refs.js';
import { runMigrations } from './migrate.js';
import { dishLines } from '../world/dishes.js';
import { Riding, HORSE_FOOD } from './riding.js';
import { wallDirOf, dirToward, WALL_DIRS, useDisplay, paintingSubject } from './displays.js';
import { canLead, leadUse, tieLeads, isPost, leading, leadsOut } from './leads.js';
import { throwGrapple, grappleTick } from './grapple.js';
import { notePlaced } from './invtools.js';
import { pirateTick, piratesSave, piratesLoad, isPirate } from './pirates.js';
import { stallsTick } from './stalls.js';
import { isBlueprint, ghostProblem, placeGhost, removeGhost, plansSave, plansLoad } from './plans.js';
import { boxPress, boxDrag, boxWheel, openPlanWindow } from '../ui/plans.js';
import { ShipDesignWindow } from '../ui/shipdesign.js';
import { checkRegion, healthNote } from './savehealth.js';
import { startRide, tick as rideTick, hurry as rideHurry, getOff as rideOff, endRide as rideEnd, rideSave, rideLoad } from './rides.js';
import { lawOn } from '../sim/laws.js';
import { PROFESSIONS } from '../sim/careers.js';
import { EVENT_BLOCKS } from '../sim/events.js';
import { struggle, tickAfflictions } from './afflict.js';
import { updateOrbs, swatOrbs } from './orbs.js';
import { Seat, asSeat, seatField, partyPlayers, freshStore } from './party.js';
import { Guilds, guildMates } from './guilds.js';
import { updateBouts, boutBlow, boutOf, boutJustOver } from './bout.js';
import { gemsOf, onSwing, onBladeHit, onArrowLand, onStruck, updateGemFx, tickStatus, swingMult, arrowSpeed, evade, moonWard, rageMult, onKill } from './gems.js';
import { critBonus, bladeMult, onBladeMods, onArrowMods, toolDrops, extraDigMult, runeWard } from './mods.js';
import { plainKey } from '../world/quality.js';
import { GAME_VERSION } from '../version.js';
import { normalizeHero, KITS, COMMON_KIT, hpBonus, damageMult, digMult, cooldownMult, has as heroHas } from './hero.js';
// (Round 62) Mods at work: imported last of all, so all they reach is ready.
import { modUse, modEaten, modStruck, modHurt, modScaleDamage, modKilled, modBlockBroken, modBlockPlaced, modBlockUse, modTalk, modTick, modSpawnPick, modSave, modLoad, modBrain, modSwung, modBlockedBlow } from '../mod/hooks.js';
import { rule } from '../mod/rules.js';
import { biomeSpawn } from '../mod/biomes.js';
import { applyCharGen, startOf } from '../mod/chargen.js';
import { MODS } from '../mod/registry.js';

const AUTOSAVE_AT = 7 * 60; // 7:00 every morning
const GEMS_COLOR = (k) => (ITEMS[k] && ITEMS[k].gem && GEMS[k] ? GEMS[k].color : '#ffffff');

const START_KIT = [
  ['wood_pickaxe', 1], ['wood_axe', 1], ['wood_sword', 1], ['torch', 12], ['planks', 32],
  ['cobblestone', 24], ['door', 2], ['chest', 1], ['bread', 5], ['workbench', 1], ['glass', 8], ['fence', 8],
];

// What a save is (3: the world of the Dagoni Islands; older ones were of a
// single island, and can't be put into this one).
export const SAVE_VERSION = 3;

// What wanders the other Dagoni Islands by day: on Kharos's ash and cinder
// woods, lizards and crabs; on Myrrow's moors, mangroves and fungal woods,
// toads and crawlers (and the odd beast brought over long ago).
export const ISLE_DAY = {
  ashland: ['ash_lizard', 'ash_lizard', 'magma_crab', 'rabbit'], cinderwood: ['ash_lizard', 'boar', 'deer', 'ash_lizard'], geyser: ['magma_crab', 'ash_lizard'], volcano: ['magma_crab', 'ash_lizard'],
  mangrove: ['mire_toad', 'mire_toad', 'boar', 'shroom_crawler'], fungal: ['shroom_crawler', 'shroom_crawler', 'mire_toad', 'deer'], moor: ['mire_toad', 'sheep', 'rabbit', 'deer'],
  // (Round 68) The far lands' (see world/biomes.js).
  olive_hills: ['white_bull', 'sheep', 'rabbit', 'horse', 'white_bull'], rimewood: ['reindeer', 'reindeer', 'rabbit', 'deer'],
  bamboo_grove: ['crane', 'crane', 'tiger', 'deer', 'rabbit'], red_mesa: ['rattlesnake', 'rabbit', 'horse', 'rattlesnake'],
  bone_strand: ['bone_crab', 'gull', 'gull', 'seal'], salt_flats: ['flamingo', 'flamingo', 'brine_scorpion', 'rabbit'],
  lantern_hollows: ['badger', 'deer', 'rabbit', 'badger'], rune_heath: ['white_hare', 'raven', 'white_hare', 'deer', 'sheep'], sea_cliffs: ['puffin', 'puffin', 'seal', 'sheep'],
};
// What comes out at night on the far lands' own ground, now and then.
const FAR_NIGHT = {
  rimewood: ['frost_wolf'], red_mesa: ['coyote'], salt_flats: ['brine_scorpion'], lantern_hollows: ['lantern_moth', 'lantern_moth', 'wisp'], rune_heath: ['wisp', 'wisp', 'ghoul'], bone_strand: ['skeleton'],
};
const ISLE_BEASTS = { kharos: ['ash_lizard', 'magma_crab'], myrrow: ['mire_toad', 'shroom_crawler'] };

// The trading company a tied horse's key belongs to (a road camp's
// 'rc:<id>:...', a town camp's 'c:<id>:...'), or null.
function companyOfKey(k) {
  const m = /^r?c:(\d+):/.exec(k);
  return m ? +m[1] : null;
}

// (Round 65) A creature as it is, to go with someone to another world.
function creatureSnap(c) {
  return { species: c.species, hp: c.hp, modVars: c.modVars ? JSON.parse(JSON.stringify(c.modVars)) : null, pet: !!c.petOf };
}

// (Round 79) Did the town itself set a rack or stand out at (x, y, z)?
function townPlaced(w, L, x, y, z) {
  const id = w.getBlock(x, y, z);
  const p = L.placements && L.placements.get(w.regionKey(Math.floor(x / REGION_W), Math.floor(z / REGION_D)));
  if (!p) return false;
  for (let i = 0; i < p.length; i += 5) if (p[i] === x && p[i + 1] === y && p[i + 2] === z && p[i + 3] === id) return true;
  return false;
}

export class Game {
  constructor({ seed, renderer, audio, ui, save = null, hero = null, learned = false, intro = false, remote = false, worldMap = null, worldRoot = null, wg = undefined }) {
    this.seed = seed >>> 0;
    // (Round 65) Made from another of a mod's world maps (one crossed into:
    // see requestCross), and the world its family of worlds began as.
    this.worldMap = save ? save.worldMap || null : worldMap;
    this.worldRoot = save ? save.worldRoot || null : worldRoot;
    this.renderer = renderer;
    // A new world starts with north up (a saved one as you left it).
    if (renderer) {
      renderer.view = save && Number.isInteger(save.view) ? save.view & 3 : 0;
      renderer.spin = null;
      renderer.camInit = false;
      if (renderer.lighting) renderer.lighting.samples = null;
    }
    this.audio = audio;
    this.ui = ui;
    // (Round 68: as the world was made: a world from before 0.68 as it was,
    // its land unchanged; a new one shaped by its seed. See worldgen.js.)
    this.world = new World(this.seed, { wg: save ? save.wg || 1 : wg });
    // (Someone else's world, seen from here: its ground comes from them.
    // See net/guest.js.)
    if (remote) {
      this.world.remote = true;
      this.world.netRegions = new Map();
    }
    this.remoteCopy = remote;
    this.world.onChange = (x, y, z, o, n) => this.onBlockChange(x, y, z, o, n);
    this.sim = new Sim(this);
    // (For testing: a world where everything is already known, from the
    // first town laid out.)
    if (learned) this.sim.tech.cheat = true;
    this.world.onLayout = (L) => this.sim.attach(L);
    this.crops = new CropGrowth(this);
    this.playtime = new Playtime(this);
    this.world.onRegionLoad = (r) => {
      this.sim.applyPending(r);
      // (Round 78) Brought back from the save: looked over (see
      // savehealth.js).
      if (r.fromSave) checkRegion(this, r);
      this.crops.scanRegion(r);
      // (Near the mountain on Kharos: its flows as they are now.)
      this.sim.volcano.regionLoaded(r);
    };
    this.signIcons = new Map();
    this.projectiles = [];
    // Siege engines (and other great wooden things) about the place.
    this.engines = [];
    // Butterflies, songbirds and owls round you (see wildlife.js).
    this.wildlife = new Wildlife(this);
    // Down in a dungeon (see dungeon.js), and blows on their way (hazards:
    // see monsters.js). (Each player's own: with others playing, the old
    // places anyone's down, each open in its own space: `runs`.)
    this.dungeon = null;
    this.runs = new Map();
    // Players banded together (see guilds.js): kept with the world.
    this.guilds = new Guilds(this);
    this.hazards = [];
    this.orbs = [];
    // Everyone playing (multiplayer: see party.js), and whose turn it is.
    // (Alone, there are none: the game's player is simply you.)
    this.seats = null;
    this.seat = null;
    // Things set down on the ground: "x,y,z" -> { item, count, owner }.
    this.placed = new Map();
    // Household chests you've picked open (key -> the day: see chestLocked).
    this.picked = new Map();
    // Wagons standing still, and horses tied up: by what they belong to.
    this.props = new Map();
    this.tied = new Map();
    // Trading companies' night camps by the road near you: key -> camp.
    this.roadCamp = new Map();
    // Your own horses and wagons.
    this.riding = new Riding(this);
    this.sleep = null;
    const nrng = new RNG(hash4(this.seed, 0x9a3e));
    const pstyle = this.world.ow.spawnSettlement ? this.world.ow.spawnSettlement.style : 'vale';
    const pn = personName(nrng, pstyle, familyName(nrng, pstyle));
    this.playerName = pn.first;
    this.minute = 7 * 60 + 30;
    this.day = 1;
    this.dt = 0;
    this.shake = 0;
    this.npcs = [];
    this.creatures = [];
    this.drops = [];
    this.occ = new Map();
    this.active = new Map(); // settlement id -> { layout, npcs }
    this.deadNpcs = new Map(); // sid -> Set(idx)
    this.wanted = new Map();
    // Console cheats (see commands.js).
    this.cheats = { mapTeleport: false };
    this.vandal = new Map();
    this.saplings = [];
    this.pathBudget = 0;
    this.cursor = null;
    this.mining = null;
    this.lightDirty = true;
    this.visibleEntities = [];
    this.genQueue = [];
    this.spawnT = 2;
    this.fxT = 0;
    this.pressT = 0;
    this.pending = null;
    this.placeRepeat = 0;
    this.stats = { kills: 0, crafted: 0, mined: 0, placed: 0 };
    this.currentSettlement = null;
    const ow = this.world.ow;
    let sx;
    let sz;
    if (save) {
      this.applySave(save);
      // (Saved in an older version: what's new brought into it. See
      // migrate.js; the save itself was brought up before it got here.)
      if (save.pending && save.pending.length) this.migrated = runMigrations(this, save.pending);
      sx = this.player.x;
      sz = this.player.z;
    } else {
      // A character made on the character screen: washed up on the shore,
      // or at home in the town they grew up in.
      this.hero = hero ? normalizeHero(hero) : null;
      if (this.hero) this.playerName = this.hero.name;
      const home = this.hero && this.hero.origin === 'native' ? this.pickHometown() : null;
      // (Round 63) Where the mods have new characters begin: a place their
      // choices on the character screen name, or the world map's spot (but
      // those born in a town, at home).
      const ps = this.hero && !home ? startOf(this, this.hero) : null;
      const coast = this.hero && this.hero.origin === 'crash' && !ps ? this.coastSpot() : null;
      // (A fallen star: a crater out in the hills by a village.)
      const star = this.hero && this.hero.origin === 'star' ? starSpot(this, 0) : null;
      if (ps && star) {
        star.x = ps.x;
        star.z = ps.z;
      }
      const s = home || ow.spawnSettlement;
      const L = s ? this.world.getLayout(s) : null;
      const thessa = ow.islands[0];
      sx = L ? L.plaza.cx + 2 : Math.floor(thessa.x);
      sz = L ? L.plaza.cz : Math.floor(thessa.z);
      if (coast) {
        sx = coast.x;
        sz = coast.z;
      }
      if (ps) {
        sx = ps.x;
        sz = ps.z;
      }
      if (star) {
        sx = star.x;
        sz = star.z;
        this.loadAround(sx, sz, true);
        makeCrater(this, sx, sz);
        this.starAt = star;
        // (Round 73: the village that saw it, remembered.)
        if (this.hero) this.hero.starSid = star.sid;
      }
      let host = null;
      if (home) {
        host = this.becomeNative(home);
        if (host && host.house.inside) {
          sx = host.house.inside.x;
          sz = host.house.inside.z;
        }
      }
      this.loadAround(sx, sz, true);
      const spot = this.findFreeSpot(sx, sz, GROUND);
      this.player = new Player(this, spot.x, spot.y, spot.z);
      this.moveEntity(this.player, this.player.x, this.player.y, this.player.z);
      if (this.hero) {
        // (A mod's starting gear instead of the game's: see mod/chargen.js.)
        const kit = this.hero.modKit ? { items: [], coins: 0 } : KITS[this.hero.kit];
        for (const [k, n] of [...kit.items, ...COMMON_KIT]) this.giveOrWear(k, n);
        this.player.give('coin', kit.coins);
        // (Round 63) What the mods' character screen gives.
        if (MODS.active.length) applyCharGen(this, this.hero, this.player);
        this.player.baseLook = { ...this.hero.look };
        this.applyHero();
        this.player.hp = this.player.maxHp;
        this.player.spawn = { x: spot.x, y: spot.y, z: spot.z };
        if (coast) this.wreckage(spot);
        // (Home in a town where arms are banned: yours stays put away.)
        if (L && !coast && lawOn(L, 'armsBan')) this.stowArms();
      } else {
        for (const [k, n] of START_KIT) this.player.give(k, n);
        this.player.give('coin', 25);
      }
    }
    // (Up since this morning.)
    if (this.player.awakeSince === undefined) this.player.awakeSince = this.day * DAY_MINUTES + this.minute;
    this.loadAround(this.player.x, this.player.z, true);
    if (!remote) this.updateSettlements(true);
    ow.markExplored(this.player.x, this.player.z, 2);
    // A new story opens with a scene of where you come from (see
    // cutscene.js), or straight in.
    if (this.hero && !save) {
      if (intro) startIntro(this);
      else this.introduce();
    }
  }

  // Birds by day, crickets and owls by night, waves on the shore, wind up
  // high and frogs in the swamp (all outdoors only).
  ambientSounds(dt) {
    const a = this.audio;
    if (!a) return;
    const b = this.buildingAtPlayer ? this.buildingAtPlayer() : null;
    const indoors = !!b && !b.underConstruction;
    const w = this.weather;
    // (Round 77) Rain as long as it falls: on the roof over you, muffled,
    // indoors (or under a roof of rock), a hiss all round you outdoors;
    // now and then a drip inside.
    const rainy = w && w.kind === 'rain' && !this.dungeon && !this.sleep ? Math.min(1, w.level) : 0;
    const under = indoors || !!(this.renderer && this.renderer.hidden);
    a.setRain?.(rainy, under);
    if (rainy > 0.3 && under && Math.random() < dt * 0.12) a.play('drip');
    this.ambT = (this.ambT ?? 3) - dt;
    if (this.ambT > 0 || indoors || this.sleep || this.dungeon) return;
    this.ambT = 2 + Math.random() * 5;
    const biome = this.biomeCache ? this.biomeCache.biome : 'plains';
    const day = this.isDay();
    const wet = w && w.kind !== 'clear';
    const pick = (l) => l[Math.floor(Math.random() * l.length)];
    let snd = null;
    if (biome === 'beach' || biome === 'ocean') snd = day && !wet && Math.random() < 0.4 ? 'gull' : 'wave';
    // (Kharos: wind over the ash, the hiss of a vent; Myrrow: frogs in the
    // mangroves, crickets and the odd owl over the moor and the mushrooms.)
    else if (biome === 'ashland' || biome === 'volcano' || biome === 'geyser' || biome === 'cinderwood') snd = biome === 'geyser' || Math.random() < 0.25 ? 'torch' : 'wind';
    else if (biome === 'mangrove') snd = day ? pick(['frog', 'bird', 'frog']) : 'frog';
    else if (biome === 'fungal' || biome === 'moor') snd = day ? pick(['wind', 'bird', null]) : pick(['cricket', 'owl', 'frog']);
    else if (biome === 'swamp') snd = day ? pick(['frog', 'bird']) : pick(['frog', 'cricket', 'frog']);
    else if (biome === 'tundra' || biome === 'mountain') snd = !day && Math.random() < 0.15 ? 'howl' : 'wind';
    else if (biome === 'desert') snd = day ? (Math.random() < 0.3 ? 'wind' : null) : 'cricket';
    else if (day) snd = wet ? null : 'bird';
    else snd = biome === 'forest' || biome === 'taiga' ? pick(['cricket', 'cricket', 'owl', Math.random() < 0.2 ? 'howl' : 'cricket']) : 'cricket';
    if (snd) a.play(snd);
  }

  // ------------------------------------------------------------ alarm bells
  // A town's bells that are still standing.
  bellsOf(L) {
    return (L.bells || []).filter((b) => this.world.getBlock(b.x, GROUND, b.z) === B.bell);
  }

  nearestBell(L, x, z) {
    let best = null;
    for (const b of this.bellsOf(L)) {
      const d = Math.abs(b.x - x) + Math.abs(b.z - z);
      if (!best || d < best.d) best = { ...b, d };
    }
    return best;
  }

  // Worth running to the bell? At night, with a threat about, and guards
  // asleep who'd come if they heard it.
  // A guard deals with the threat first, and only rings a bell that's
  // right there (ten paces); a citizen runs a little further to raise the
  // watch, if the guards are asleep or nowhere near.
  alarmNeeded(npc, threat, range = null) {
    if (!threat) return false;
    const m = this.minute;
    const L = npc.layout;
    const now = this.day * DAY + m;
    if (L.econ && L.econ.bellAt !== undefined && now - L.econ.bellAt < 40) return false;
    const guard = npc.rec.job === 'guard';
    const b = this.nearestBell(L, npc.x, npc.z);
    if (!b || b.d > (range ?? (guard ? 10 : 20))) return false;
    const a = this.active.get(L.settlement.id);
    if (!a) return false;
    const night = m < 360 || m >= 1200;
    const asleep = a.npcs.some((n) => n !== npc && !n.dead && n.rec.job === 'guard' && n.sleeping);
    const onIt = a.npcs.some((n) => n !== npc && !n.dead && n.rec.job === 'guard' && n.state === 'fight' && n.threat === threat);
    if (guard) return (night && asleep) || range !== null;
    return (night && asleep) || !onIt;
  }

  // Ring the bell at (x, z): every guard in town wakes and turns out, to
  // fight whatever's there or to see what the fuss is about.
  ringBell(x, z, threat = null, by = null) {
    const s = this.world.ow.settlementAt(x, z);
    const a = s && this.active.get(s.id);
    const w = this.world;
    const y = GROUND;
    w.setState(x, y, z, true);
    this.bellT = (this.bellT || []).filter((q) => q.x !== x || q.z !== z);
    this.bellT.push({ x, y, z, t: 5 });
    this.renderer.emit(x, y + 1, z, { n: 6, color: ['#f0c860', '#ffffff'], up: 30, life: 0.5, oy: -14 });
    const p = this.player;
    if (Math.hypot(p.x - x, p.z - z) < 40) this.audio?.play('bell');
    if (!a) return 0;
    const L = a.layout;
    const now = this.day * DAY + this.minute;
    if (L.econ) L.econ.bellAt = now;
    // Anything nasty about? Then it wasn't a false alarm.
    const danger = threat || this.creatures.find((c) => !c.dead && c.hostileNow && Math.abs(c.x - x) + Math.abs(c.z - z) < 30) || null;
    let woke = 0;
    for (const n of a.npcs) {
      if (n.dead || n === by || n.rec.job !== 'guard' || n.rec.away) continue;
      if (n.sleeping) {
        n.wake();
        woke++;
      }
      n.emoteShow('!', '#ffb040', 1.5);
      // Turned out: they stay up round the bell a while, even once it's over.
      setOverride(n.rec, now, now + 25, 'alarm', { target: { x, z }, place: 'bell' });
      n.activity = null;
      if (danger && !danger.dead) n.engage(danger);
    }
    // Everyone else stirs; the light sleepers look out.
    for (const n of a.npcs) if (!n.dead && n.sleeping && n.rec.job !== 'guard' && Math.abs(n.x - x) + Math.abs(n.z - z) < 16) n.emoteShow('?', '#c8c8c8', 1.5);
    if (this.active.has(s.id) && s === this.currentSettlement) this.ui.msg(`The alarm bell is ringing in ${s.name}!${woke ? ` ${woke} guard${woke > 1 ? 's' : ''} turn${woke > 1 ? '' : 's'} out.` : ''}`, '#ffb040');
    // Ringing it for nothing annoys the watch.
    if (by === p && !danger) {
      for (const n of a.npcs) if (n.rec.job === 'guard' && !n.dead) this.sim.changeRep(n, -3);
      const g = a.npcs.find((n) => n.rec.job === 'guard' && !n.dead);
      if (g) g.say(this.minute < 360 || this.minute >= 1200 ? 'Who rang the bell?! There\'s nothing here!' : 'That bell is for emergencies!', 3, '#ffb080');
    }
    return woke;
  }

  updateBells(dt) {
    if (!this.bellT) return;
    for (const q of this.bellT) {
      q.t -= dt;
      if (q.t <= 0 && this.world.getBlock(q.x, q.y, q.z) === B.bell) this.world.setState(q.x, q.y, q.z, false);
    }
    this.bellT = this.bellT.filter((q) => q.t > 0);
  }

  // ------------------------------------------------------------ your story
  // Stats and traits that change your body: health for now (the rest is
  // looked up where it matters).
  applyHero() {
    const p = this.player;
    if (!p) return;
    p.hpBonus = this.hero ? hpBonus(this.hero) : 0;
    p.recalcMaxHp();
    // A fallen star: the wing (see combat.js, roll; render/wing.js).
    if (this.hero && this.hero.origin === 'star') {
      if (!p.wing) p.wing = { k: 1 };
    } else if (p.wing) p.wing = null;
  }

  // Starting clothes go straight on; everything else into the pack.
  giveOrWear(k, n) {
    const it = ITEMS[k];
    const p = this.player;
    if (it && it.kind === 'armor' && !p.equip[it.slot]) {
      p.equip[it.slot] = k;
      if (n > 1) p.give(k, n - 1);
      return;
    }
    p.give(k, n);
  }

  // The town you grew up in: a lived-in place (not a ruin), picked from the
  // seed and your name.
  pickHometown() {
    const ow = this.world.ow;
    // (On Thessa, where every story starts.)
    const list = ow.settlements.filter((s) => s.condition !== 'abandoned' && !s.deserted && s.type !== 'camp' && s.island === ow.islands[0].key);
    if (!list.length) return null;
    let h = 0;
    for (const ch of String(this.hero.name)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    const rng = new RNG(hash4(this.seed, h, 0x707e));
    const near = list.filter((s) => s.type !== 'city');
    return rng.pick(near.length && rng.chance(0.75) ? near : list);
  }

  // Born and raised here: a citizen from the start, living with your family
  // (their house is home until you have your own), and everyone knows you.
  becomeNative(s) {
    const sim = this.sim;
    const L = this.world.getLayout(s);
    let host = sim.pickHost(L);
    if (!host) {
      const b = L.buildings.find((q) => q.residential && q.household && !q.playerHome && L.npcs.some((r) => r.home === q.id && alive(r)));
      if (b) host = { house: b, bed: b.beds[0] ? { x: b.beds[0].x, y: GROUND, z: b.beds[0].z } : null, family: b.family };
    }
    // Your family: the grown-ups of the house are your parents, the children
    // your brothers and sisters, and you share their name.
    const members = host ? L.npcs.filter((r) => r.home === host.house.id && alive(r)) : [];
    const grown = members.filter((r) => r.age !== 'child');
    let parents = grown.filter((r) => r.age === 'adult' || r.age === 'elder').slice(0, 2);
    if (parents.length === 2 && parents[0].partner !== parents[1].idx) parents = [parents[0]];
    const siblings = members.filter((r) => r.age === 'child' || (!parents.includes(r) && parents.some((q) => (q.children || []).includes(r.idx))));
    const family = host ? host.family || (parents[0] && parents[0].name.last) || null : null;
    sim.citizen = {
      sid: s.id, since: 1, host: host ? host.house.id : null, hostBed: host ? host.bed : null, home: null, taxDay: this.day, owed: 0, native: true,
      family: { name: family, parents: parents.map((r) => r.idx), siblings: siblings.map((r) => r.idx) },
    };
    for (const r of parents) r.playerChild = true;
    for (const r of L.npcs) {
      if (!alive(r)) continue;
      const e = sim.repEntry(s.id, r.idx);
      const kin = parents.includes(r) ? 85 : siblings.includes(r) ? 65 : host && r.home === host.house.id ? 70 : 0;
      e.v = Math.max(e.v, kin || (r.age === 'child' ? 30 : 40));
      e.met = true;
      e.known = true;
    }
    sim.renown.set(s.id, Math.max(sim.renown.get(s.id) || 0, RENOWN.friend));
    sim.areaCache.delete(s.id);
    this.hero.home = s.id;
    this.hero.family = family;
    // Born into the family: their surname is yours.
    if (family) {
      const first = String(this.hero.name || this.playerName).split(' ')[0];
      this.playerName = `${first} ${family}`;
      this.hero.name = this.playerName;
    }
    ledger(L, this.day, `${this.playerName} is back home in ${s.name}${parents.length ? `, living with ${parents.map((r) => r.name.first).join(' and ')}` : ''}.`);
    return host;
  }

  // The nearest stretch of beach to the island's settled heart, and a
  // spot on dry sand beside the sea.
  coastSpot() {
    const ow = this.world.ow;
    const s = ow.spawnSettlement;
    const home = ow.islands[0];
    const hx = s ? s.cx + s.cw / 2 : home.cx;
    const hz = s ? s.cz + s.cd / 2 : home.cz;
    const beaches = ow.liveCells.filter((c) => c.biome === 'beach' && c.island === home.key).map((c) => ({ c, d: Math.hypot(c.cx - hx, (c.cz - hz) * 1.4) })).sort((a, b) => a.d - b.d);
    for (const { c } of beaches.slice(0, 12)) {
      const cx = Math.floor((c.cx + 0.5) * REGION_W);
      const cz = Math.floor((c.cz + 0.5) * REGION_D);
      this.loadAround(cx, cz, true);
      let best = null;
      for (let dz = -16; dz <= 16; dz++) {
        for (let dx = -28; dx <= 28; dx++) {
          const x = cx + dx;
          const z = cz + dz;
          if (ow.settlementAt(x, z)) continue;
          const y = this.world.findStandY(x, z, GROUND);
          if (y <= 0 || this.world.isWaterAt(x, y, z) || this.world.isWaterAt(x, y - 1, z)) continue;
          let sea = 0;
          for (const [ox, oz] of [[2, 0], [-2, 0], [0, 2], [0, -2], [3, 0], [-3, 0], [0, 3], [0, -3]]) if (this.world.isWaterAt(x + ox, y - 1, z + oz)) sea++;
          if (!sea) continue;
          const d = Math.abs(dx) + Math.abs(dz) - sea;
          if (!best || d < best.d) best = { x, z, d };
        }
      }
      if (best) return best;
    }
    return null;
  }

  // What washed up with you: planks, a battered crate, a broken mast.
  wreckage(at) {
    const w = this.world;
    const rng = new RNG(hash4(this.seed, 0x5b1b));
    let crate = false;
    for (let i = 0; i < 10; i++) {
      const x = at.x + rng.int(-4, 4);
      const z = at.z + rng.int(-4, 4);
      if (Math.abs(x - at.x) + Math.abs(z - at.z) < 2) continue;
      const y = w.findStandY(x, z, at.y);
      if (y <= 0 || w.getBlock(x, y, z) !== B.air || w.isWaterAt(x, y - 1, z)) continue;
      if (!crate) {
        w.setBlock(x, y, z, B.chest);
        const slots = w.getContainer(x, y, z);
        if (slots) {
          slots.fill(null);
          const loot = [['planks', rng.int(6, 12)], ['string', rng.int(2, 5)], ['bread', rng.int(1, 3)], ['coin', rng.int(5, 20)], ['torch', 4], [rng.pick(['cloth', 'leather', 'iron_ingot', 'book']), rng.int(1, 3)]];
          loot.forEach(([k, n], j) => {
            if (ITEMS[k] && j < slots.length) slots[j] = { item: k, count: n };
          });
        }
        crate = true;
      } else w.setBlock(x, y, z, rng.chance(0.6) ? B.planks : rng.chance(0.5) ? B.fence : B.barrel);
    }
  }

  // Your hand off any weapon: the first slot on your belt that isn't one.
  stowArms() {
    const p = this.player;
    const held = p.heldDef();
    if (!held || held.kind !== 'weapon') return;
    for (let i = 0; i < BELT_SIZE; i++) {
      const s = p.inv[i];
      if (!s || ITEMS[s.item]?.kind !== 'weapon') {
        p.selected = i;
        return;
      }
    }
  }

  // The first words of a new story.
  introduce() {
    const h = this.hero;
    const c = this.sim.citizen;
    if (h.origin === 'star') return this.introduceStar(this.starAt ? this.starAt.village : null);
    if (h.origin === 'native' && c) {
      const L = this.sim.layoutOf(c.sid);
      const par = (c.family?.parents || []).map((i) => L.npcs[i]).filter(Boolean).map((r) => r.name.first);
      this.ui.msg(`Home again in ${L.settlement.name}${par.length ? `, where ${par.join(' and ')} raised you` : ''}. Everyone here has known you all your life.`, '#ffe070');
      this.ui.msg('Your family\'s house is your home: its beds and chests are yours too. The mayor can have a place of your own built, if you like.', '#a0c8ff');
      if (lawOn(L, 'armsBan')) this.ui.msg(`Weapons may not be carried drawn in ${L.settlement.name}: keep yours put away in town (don't hold it on your belt).`, '#ffe070');
    } else {
      this.ui.msg('You wake on wet sand: a beach on Thessa, inside the Wall. Of your ship, only splinters and a battered chest have come ashore.', '#ffe070');
      this.ui.msg('The gap has closed behind you: there\'s no way back out through the storm without a real ship. Nobody here knows you. Find a town: the map (M) shows what you have seen.', '#a0c8ff');
    }
  }

  // A fallen star's opening scene (the player it's done as): as it
  // strikes, everyone else on Thessa feels it (see Game.update).
  starScene(star) {
    const who = this.player;
    return starfallScene(this, {
      village: star ? star.village : null,
      first: String(this.playerName || '').split(' ')[0],
      at: star,
      act: (g) => {
        g.starShock = { x: star ? star.x : who.x, y: who.y, z: star ? star.z : who.z, who };
      },
    });
  }

  // Waking in the crater (see starfall.js).
  introduceStar(village) {
    this.ui.msg(`You wake in a crater of scorched earth${village ? ` in the hills near ${village}` : ''}. One white wing rests folded at your back, glowing faintly.`, '#ffe070');
    this.ui.msg('Your wing lets you roll a second time right after the first, without using stamina. It fades and grows back over 20 seconds. Some people will be wary of you. The map (M) shows what you have seen.', '#a0c8ff');
  }

  // Nearest standable tile to (x, z), searching outward in rings: first on
  // the level of `hint` (or a step off it), so someone getting out of a bed
  // indoors stands on the floor by it and not up on the roof over the wall;
  // only then anywhere in each column.
  findFreeSpot(x, z, hint) {
    if (hint !== null && hint !== undefined) {
      const w = this.world;
      for (let r = 0; r < 6; r++) {
        for (let dz = -r; dz <= r; dz++) {
          for (let dx = -r; dx <= r; dx++) {
            if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
            for (const dy of [0, 1, -1]) {
              const y = hint + dy;
              if (!w.canStand(x + dx, y, z + dz) || w.isWaterAt(x + dx, y, z + dz) || this.occupiedBySolid(x + dx, y, z + dz, this.player)) continue;
              return { x: x + dx, y, z: z + dz };
            }
          }
        }
      }
    }
    for (let r = 0; r < 12; r++) {
      for (let dz = -r; dz <= r; dz++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
          const y = this.world.findStandY(x + dx, z + dz, hint);
          if (y > 0 && !this.world.isWaterAt(x + dx, y, z + dz)) return { x: x + dx, y, z: z + dz };
        }
      }
    }
    return { x, y: hint, z };
  }

  // ------------------------------------------------------------ helpers
  isDay() {
    const h = this.minute / 60;
    return h >= 6 && h < 19.5;
  }

  // (Something close to you and after you may go over the frame's
  // budget a little: it's the one you'd notice standing still.)
  requestPathBudget(urgent = false) {
    if (this.pathBudget <= (urgent ? -3 : 0)) return false;
    this.pathBudget--;
    return true;
  }

  occKey(x, y, z) {
    return x * 1048576 + z * 16 + y;
  }

  moveEntity(e, nx, ny, nz) {
    if (e.solid !== false) {
      const k = this.occKey(e.x, e.y, e.z);
      if (this.occ.get(k) === e) this.vacate(k, e);
      e.x = nx;
      e.y = ny;
      e.z = nz;
      const k2 = this.occKey(nx, ny, nz);
      if (!this.occ.has(k2) || e.kind === 'player') this.occ.set(k2, e);
    } else {
      e.x = nx;
      e.y = ny;
      e.z = nz;
    }
  }

  removeOcc(e) {
    const k = this.occKey(e.x, e.y, e.z);
    if (this.occ.get(k) === e) this.vacate(k, e);
  }

  // `e` leaves a tile. Townsfolk can share one (a group walking in file, a
  // crowd at a stall), and only one of them is on the map: whoever's still
  // standing there takes the place, so they don't go see-through.
  vacate(k, e) {
    this.occ.delete(k);
    const { x, y, z } = e;
    for (const list of [this.npcs, this.creatures]) {
      for (const o of list || []) {
        if (o !== e && !o.dead && o.solid !== false && o.x === x && o.y === y && o.z === z) {
          this.occ.set(k, o);
          return;
        }
      }
    }
    const p = this.player;
    if (p && p !== e && !p.dead && p.x === x && p.y === y && p.z === z) this.occ.set(k, p);
  }

  entityAt(x, y, z) {
    return this.occ.get(this.occKey(x, y, z)) || this.bigAt(x, y, z, null);
  }

  // One of the great masters filling that tile (not `self`; nor one you're
  // already standing under the edge of, so you can always get out from
  // beside it).
  bigAt(x, y, z, self) {
    if (!this.bigs || !this.bigs.length) return null;
    for (const b of this.bigs) {
      if (b === self || b.dead || b.burrowed || b.solid === false || Math.abs(b.y - y) > 1 || !covers(b, x, z)) continue;
      if (self && self.x !== undefined && covers(b, self.x, self.z)) continue;
      return b;
    }
    return null;
  }

  // Is the tile blocked for `self`? NPCs pass through each other; nothing
  // walks through the player or monsters.
  occupiedBySolid(x, y, z, self, npcCheck = false) {
    for (const yy of [y, y - 1, y + 1]) {
      const e = this.occ.get(this.occKey(x, yy, z));
      if (!e || e === self || e.dead) continue;
      if (Math.abs(yy - y) > 0 && e.kind !== 'player') continue;
      if (self && self.kind === 'npc' && e.kind === 'npc') continue;
      if (self && self.kind === 'npc' && e.sleeping) continue;
      return e;
    }
    const big = this.bigAt(x, y, z, self);
    if (big) return big;
    // Moving entities also reserve the tile they're leaving.
    if (self && self.kind === 'player') {
      for (const n of this.npcs) if (!n.dead && n.moving && n.fx === x && n.fz === z && Math.abs(n.fy - y) <= 1 && n.moveT < 0.5) return n;
    }
    return null;
  }

  // Could you see a tile from where you stand (whichever way the camera's
  // turned)? Anything that appears or vanishes should do it out of sight.
  // In sight of any of you playing.
  inSight(x, z, margin = 0) {
    for (const p of this.everyone()) if (Math.max(Math.abs(x - p.x), Math.abs(z - p.z)) <= 18 + margin) return true;
    return false;
  }

  // Someone (not asleep or sitting) standing on a tile.
  npcAt(x, y, z) {
    for (const yy of [y, y - 1, y + 1]) {
      const e = this.occ.get(this.occKey(x, yy, z));
      if (e && !e.dead && e.kind === 'npc' && !e.sleeping && !e.sitting) return e;
    }
    return null;
  }

  // Push someone out of the way: a step aside (never back where the pusher
  // is, or onto the tile it's heading for). False if there's nowhere to go.
  shove(e, by, keep = null) {
    if (!e || e.dead || e.moving || e.sleeping || e.sitting) return false;
    const dx = Math.sign(e.x - by.x);
    const dz = Math.sign(e.z - by.z);
    // Sideways first, then onward.
    const opts = dx ? [[0, 1], [0, -1], [dx, 0]] : [[1, 0], [-1, 0], [0, dz || 1]];
    for (const [ox, oz] of opts) {
      const nx = e.x + ox;
      const nz = e.z + oz;
      if ((nx === by.x && nz === by.z) || (keep && nx === keep.x && nz === keep.z)) continue;
      const ny = this.world.stepTarget(e.x, e.y, e.z, nx, nz, false);
      if (ny < 0 || this.occupiedBySolid(nx, ny, nz, e) || this.npcAt(nx, ny, nz)) continue;
      e.startMove(nx, ny, nz, 0.16);
      e.path = null;
      e.atGoal = false;
      return true;
    }
    return false;
  }

  isWanted(sid) {
    return (this.wanted.get(sid) || 0) > 0;
  }

  guardsOf(sid) {
    const a = this.active.get(sid);
    return a ? a.npcs.filter((n) => !n.dead && n.rec.job === 'guard') : [];
  }

  // ------------------------------------------------------------ streaming
  loadAround(x, z, sync = false) {
    const rx = Math.floor(x / REGION_W);
    const rz = Math.floor(z / REGION_D);
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        const X = rx + dx;
        const Z = rz + dz;
        if (!this.world.inBounds(X, Z) || this.world.isLoaded(X, Z)) continue;
        if (sync) this.world.loadRegion(X, Z);
        else if (!this.genQueue.some((q) => q[0] === X && q[1] === Z)) this.genQueue.push([X, Z]);
      }
    }
  }

  streamRegions() {
    const p = this.player;
    // Anything the camera can see must exist right now.
    const r = this.renderer;
    // (However the camera is turned: the box is in world tiles.)
    const box = r.visibleBox ? r.visibleBox(4) : { x0: Math.floor((r.camX - 64) / TILE), x1: Math.floor((r.camX + VIEW_W + 64) / TILE), z0: Math.floor((r.camY - 48) / TILE), z1: Math.floor((r.camY + VIEW_H + WORLD_Y * LH + 48) / TILE) };
    const { x0, x1, z0, z1 } = box;
    for (const [x, z] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1], [p.x, p.z]]) {
      const rx = Math.floor(x / REGION_W);
      const rz = Math.floor(z / REGION_D);
      if (this.world.inBounds(rx, rz) && !this.world.isLoaded(rx, rz)) {
        this.world.loadRegion(rx, rz);
        this.lightDirty = true;
      }
    }
    this.loadAround(p.x, p.z, false);
    // (Everyone else's ground too: the ground they stand on at once.)
    const others = this.everyone().filter((q) => q !== p);
    for (const q of others) {
      const rx = Math.floor(q.x / REGION_W);
      const rz = Math.floor(q.z / REGION_D);
      if (this.world.inBounds(rx, rz) && !this.world.isLoaded(rx, rz)) this.world.loadRegion(rx, rz);
      this.loadAround(q.x, q.z, false);
    }
    if (this.genQueue.length) {
      const [X, Z] = this.genQueue.shift();
      if (!this.world.isLoaded(X, Z)) this.world.loadRegion(X, Z);
    } else if (Math.random() < 0.1) {
      // Idle: lay out nearby settlements ahead of time so arriving doesn't stall.
      for (const s of this.world.ow.settlements) {
        if (this.world.layouts.has(s.id)) continue;
        if (Math.abs(s.cx - p.x / REGION_W) > 3 || Math.abs(s.cz - p.z / REGION_D) > 3) continue;
        this.world.getLayout(s);
        break;
      }
    }
    // Unload far regions (kept if an active settlement needs them).
    if (Math.random() < 0.02) {
      const at = [p, ...others].map((q) => [Math.floor(q.x / REGION_W), Math.floor(q.z / REGION_D)]);
      for (const reg of [...this.world.regions.values()]) {
        if (at.some(([prx, prz]) => Math.abs(reg.rx - prx) <= 2 && Math.abs(reg.rz - prz) <= 2)) continue;
        if (this.regionPinned(reg.rx, reg.rz)) continue;
        this.world.unloadRegion(reg.rx, reg.rz);
      }
    }
  }

  regionPinned(rx, rz) {
    for (const { layout } of this.active.values()) {
      const b = layout.bounds;
      if (rx >= Math.floor((b.x0 - 26) / REGION_W) && rx <= Math.floor((b.x1 + 26) / REGION_W) && rz >= Math.floor((b.z0 - 22) / REGION_D) && rz <= Math.floor((b.z1 + 22) / REGION_D)) return true;
    }
    return false;
  }

  // ------------------------------------------------------------ settlements
  updateSettlements(force = false) {
    const p = this.player;
    const ow = this.world.ow;
    this.currentSettlement = ow.settlementAt(p.x, p.z);
    const near = new Set();
    // (Kept lived in while any of you is near.)
    const all = this.everyone();
    for (const s of ow.settlements) {
      const b = s.bounds;
      let d = Infinity;
      for (const q of all) {
        const dx = Math.max(b.x0 - q.x, 0, q.x - b.x1);
        const dz = Math.max(b.z0 - q.z, 0, q.z - b.z1);
        d = Math.min(d, Math.hypot(dx, dz * 1.5));
      }
      if (d < SETTLEMENT_ACTIVE_DIST) near.add(s.id);
      if (d < SETTLEMENT_ACTIVE_DIST && !this.active.has(s.id)) this.activate(s, force);
      else if (d > SETTLEMENT_ACTIVE_DIST + 50 && this.active.has(s.id)) this.deactivate(s);
    }
  }

  activate(s, sync) {
    const layout = this.world.getLayout(s);
    const b = layout.bounds;
    // All regions covering the settlement (plus work spots outside) must be loaded.
    let missing = 0;
    for (let rz = Math.floor((b.z0 - 22) / REGION_D); rz <= Math.floor((b.z1 + 22) / REGION_D); rz++) {
      for (let rx = Math.floor((b.x0 - 26) / REGION_W); rx <= Math.floor((b.x1 + 26) / REGION_W); rx++) {
        if (!this.world.inBounds(rx, rz) || this.world.isLoaded(rx, rz)) continue;
        if (sync) this.world.loadRegion(rx, rz);
        else {
          missing++;
          if (!this.genQueue.some((q) => q[0] === rx && q[1] === rz)) this.genQueue.push([rx, rz]);
        }
      }
    }
    if (missing) return;
    // The town's books were kept while we were away: catch up first.
    this.sim.catchUp(layout);
    const dead = this.deadNpcs.get(s.id) || new Set();
    const npcs = [];
    for (const rec of layout.npcs) {
      // (Someone already about, walking home along a road, joins when in.)
      if (dead.has(rec.idx) || !alive(rec) || rec.away || (rec.ent && !rec.ent.dead)) continue;
      if (rec.leaving) {
        rec.leaving = false;
        rec.away = true;
        continue;
      }
      const n = new NPC(this, rec, layout);
      n.placeForCurrentActivity();
      rec.ent = n;
      npcs.push(n);
      this.npcs.push(n);
    }
    // Farm animals.
    if (layout.fields.length && s.condition !== 'abandoned') {
      const f = layout.fields[0];
      for (let i = 0; i < 3; i++) {
        const x = f.x0 - 1 - i;
        const z = f.z1 + 2;
        const y = this.world.findStandY(x, z, GROUND);
        if (y > 0 && !this.entityAt(x, y, z)) this.addCreature(new Creature(this, 'chicken', x, y, z));
      }
      // And the town's beasts by the far field: pigs, sheep, a cow (always
      // the same mix for the same town).
      const rr = new RNG(hash4(s.id, s.seed >>> 0, 0x91f));
      const f2 = layout.fields[layout.fields.length - 1];
      const n = 2 + rr.int(0, 2);
      for (let i = 0; i < n; i++) {
        const kind = ['pig', 'sheep', 'sheep', 'cow'][rr.int(0, 3)];
        const x = f2.x1 + 2 + (i % 2);
        const z = f2.z0 + i;
        const y = this.world.findStandY(x, z, GROUND);
        if (y <= 0 || this.entityAt(x, y, z) || this.world.isWaterAt(x, y, z)) continue;
        const c = new Creature(this, kind, x, y, z, rr.int(0, 2));
        c.livestock = s.id;
        this.addCreature(c);
      }
    }
    // (Round 70) An empire city's beast pens, stocked (see world/empire.js).
    if (s.condition !== 'abandoned') {
      layout.pens?.forEach((pen, pi) => {
        const rr = new RNG(hash4(s.id, pi, 0x9e7));
        for (let i = 0; i < pen.n; i++) {
          const x = rr.int(pen.x0, pen.x1);
          const z = rr.int(pen.z0, pen.z1);
          const y = this.world.findStandY(x, z, GROUND);
          if (y <= 0 || this.entityAt(x, y, z) || this.world.isWaterAt(x, y, z)) continue;
          const c = new Creature(this, rr.pick(pen.kinds), x, y, z, rr.int(0, 2));
          c.livestock = s.id;
          c.leash = { x0: pen.x0, z0: pen.z0, x1: pen.x1, z1: pen.z1 };
          this.addCreature(c);
        }
      });
    }
    this.active.set(s.id, { layout, npcs, since: this.sim.abs });
    this.sim.checkTownSigns(layout);
    // How the town's doing shows: banners up, or windows boarded.
    if (layout.econ) this.sim.prosperity.dress(layout);
    // (And whatever's new that has settled in since you were last here.)
    if (layout.econ) this.sim.tech.integrate(layout, this.day, true);
    this.sim.roads.connect(layout);
    this.refreshSigns();
  }

  deactivate(s) {
    const a = this.active.get(s.id);
    if (!a) return;
    // (Round 68) One following a player at a story's bidding goes with
    // them, out of their town (see storyTick).
    const going = a.npcs.filter((n) => !n.dead && n.storyOrder && n.storyOrder.follow);
    for (const n of a.npcs) {
      if (going.includes(n)) continue;
      n.releaseSpot();
      this.removeOcc(n);
      n.dead = true;
      n.rec.hp = n.hp;
      if (n.rec.ent === n) n.rec.ent = null;
      if (n.rec.leaving) {
        n.rec.leaving = false;
        n.rec.away = true;
      }
      if (n.visit) this.sim.visitorEnts.delete(n.visit.id);
      if (n.visit && n.rec.visit === n.visit) n.rec.visit = null;
    }
    this.npcs = this.npcs.filter((n) => going.includes(n) || !a.npcs.includes(n));
    this.active.delete(s.id);
    this.refreshSigns();
  }

  // Returning villagers (e.g. merchants back from a trip) appear at the edge
  // of town and walk in.
  respawnReturning() {
    for (const [sid, a] of this.active) {
      const L = a.layout;
      for (const rec of L.npcs) {
        if (!alive(rec) || rec.away || rec.leaving || (rec.ent && !rec.ent.dead)) continue;
        if (this.deadNpcs.get(sid)?.has(rec.idx)) continue;
        const at = this.sim.landed?.(`h${sid}:${rec.idx}`);
        // In by a road you can't see from where you stand (and if you can
        // see them all, in a little while: nobody steps out of thin air).
        const ents = L.entrances.length ? L.entrances : [{ x: L.plaza.cx, z: L.plaza.cz }];
        const first = rec.idx % ents.length;
        let e = null;
        for (let k = 0; k < ents.length && !e; k++) {
          const q = ents[(first + k) % ents.length];
          if (!this.inSight(q.x, q.z, 1)) e = q;
        }
        rec.backT = (rec.backT || 0) + 2;
        if (!e && !at && rec.backT < 60) continue;
        e ||= ents[first];
        rec.backT = 0;
        const spot = (at && this.findFreeSpot(at.x, at.z, at.y)) || this.findFreeSpot(e.x, e.z, GROUND);
        const n = new NPC(this, rec, L);
        n.teleport(spot.x, spot.y, spot.z);
        rec.ent = n;
        a.npcs.push(n);
        this.npcs.push(n);
      }
    }
  }

  // A baby born in town while you're there appears beside a parent.
  spawnBorn(L, rec, parents) {
    const a = this.active.get(L.settlement.id);
    if (!a || (rec.ent && !rec.ent.dead)) return null;
    const by = parents.map((p) => p.ent).find((e) => e && !e.dead);
    const home = L.buildings[rec.home];
    const at = by ? { x: by.x, z: by.z, y: by.y } : home ? { x: (home.x0 + home.x1) / 2, z: (home.z0 + home.z1) / 2, y: GROUND } : { x: L.plaza.cx, z: L.plaza.cz, y: GROUND };
    const spot = this.findFreeSpot(at.x, at.z, at.y);
    const n = new NPC(this, rec, L);
    n.teleport(spot.x, spot.y, spot.z);
    rec.ent = n;
    a.npcs.push(n);
    this.npcs.push(n);
    if (by) by.say(by.rng.pick([`Say hello to little ${rec.name.first}!`, `Our ${rec.name.first}, born today!`]), 4, '#a0e0a0');
    return n;
  }

  // A visiting merchant walks in from the road and sets up on the square.
  spawnVisitor(L, visit, idx) {
    const a = this.active.get(L.settlement.id);
    if (!a) return null;
    // A real merchant from another town comes as themselves (same face,
    // family and reputation); random travelers get a made-up record.
    let rec;
    let origin = null;
    if (visit.fromIdx !== undefined) {
      origin = this.sim.layoutOf(visit.from);
      rec = origin && origin.npcs[visit.fromIdx];
      if (!rec || !alive(rec) || (rec.ent && !rec.ent.dead)) return null;
      rec.visit = visit;
      const now = this.day * DAY + this.minute;
      setOverride(rec, now, visit.leave + 240, 'visit', { place: visit.guest ? 'guest' : 'market' });
    } else rec = visitorRecord(visit, idx, L.settlement.id);
    const e = L.entrances[idx % Math.max(1, L.entrances.length)] || { x: L.plaza.cx, z: L.plaza.cz };
    // On a town horse or driving its wagon: up to the camp first.
    const ride = visit.mount ? this.rideInSpot(this.sim.camps.get(`v:${visit.id}`)) : null;
    // (Just walked in off the road with you: right where they are.)
    const at = this.sim.landed?.(`v${visit.id}`);
    const spot = (at && this.findFreeSpot(at.x, at.z, at.y)) || ride || this.findFreeSpot(e.x, e.z, GROUND);
    const n = new NPC(this, rec, L);
    n.visit = visit;
    if (at ? at.mount && visit.mount : ride) n.mount = visit.mount;
    if (origin) {
      n.originLayout = origin;
      n.repSid = origin.settlement.id;
    }
    n.teleport(spot.x, spot.y, spot.z);
    // (Out of the portal on the square, in a flash of violet.)
    if (at && visit.portal) {
      this.renderer.emit(spot.x + 0.5, spot.y + 1, spot.z + 0.5, { n: 14, color: ['#c080ff', '#80c0ff', '#ffffff'], up: 30, speed: 30, life: 0.7, gravity: -15 });
      this.audio?.play('portal', n);
    }
    rec.ent = n;
    a.npcs.push(n);
    this.npcs.push(n);
    return n;
  }

  // Merchants you meet on the road between towns. They come into being when
  // you're near their route and fade out again behind you.
  updateCaravans(dt) {
    this.caravanT = (this.caravanT || 0) - dt;
    if (this.caravanT > 0 || this.sleep) return;
    this.caravanT = 1;
    if (!this.caravans) this.caravans = new Map();
    // (Those who've already ridden in: not sent back down the road to do it
    // again while their journey catches up with them.)
    if (!this.caravanIn) this.caravanIn = new Set();
    const p = this.player;
    const ow = this.world.ow;
    const live = new Set();
    for (const tr of this.sim.travellers()) {
      live.add(tr.key);
      if (this.caravanIn.has(`${tr.key}>${tr.to.id}`)) continue;
      const n = this.caravans.get(tr.key);
      const inTown = ow.settlementAt(tr.pos.x, tr.pos.z);
      const d = Math.max(Math.abs(tr.pos.x - p.x), Math.abs(tr.pos.z - p.z));
      if (n && !n.dead) {
        n.tr = tr;
        n.lateT = 0;
        n.caravan.tx = tr.target.x;
        n.caravan.tz = tr.target.z;
        n.caravan.way = tr.way || null;
        // Off the horses and wagons for the night; back up in the morning.
        if (tr.company) {
          n.caravan.camp = tr.camp;
          n.caravan.campKey = tr.company && tr.camped ? `rc:${tr.company.id}:${tr.company.departAt}` : null;
          if (!!n.mount !== !!tr.mount) {
            n.mount = tr.mount;
            if (!tr.mount) n.say(n.rng.pick(['Whoa, there. We stop here.', 'Make camp! Tie the horses.', 'That\'s enough road for one day.']), 3);
          }
        }
        const far = Math.max(Math.abs(n.x - p.x), Math.abs(n.z - p.z)) > 40;
        const arrived = ow.settlementAt(n.x, n.z) === tr.to;
        if (arrived) {
          this.caravanLanded(tr, n);
          continue;
        }
        if (far) {
          this.endCaravan(tr.key, n);
          // (Seen off down the road: not stood back up where the
          // reckoning has them, a way behind, while you're still about.
          // Round 57: a company leaving in the morning kept coming back.)
          (this.caravanOff ||= new Set()).add(tr.key);
        }
        continue;
      }
      if (this.caravanOff && this.caravanOff.has(tr.key)) {
        if (d > 44) this.caravanOff.delete(tr.key);
        continue;
      }
      // (Killed on the road: not back again. Round 57.)
      if (tr.rec.alive === false || (tr.adv && tr.adv.dead)) continue;
      if (inTown || d > 26 || d < (tr.close ? 2 : 8) || (tr.rec.ent && !tr.rec.ent.dead) || !this.world.regionAt(tr.pos.x, tr.pos.z)) continue;
      // (On the ground: not up on a ruin's walls or a rock.)
      const t = this.world.terrain;
      const col = t.column(tr.pos.x, tr.pos.z, t.context(tr.pos.x, tr.pos.z, tr.pos.x, tr.pos.z), {});
      const spot = this.findFreeSpot(tr.pos.x, tr.pos.z, col.water >= 0 ? this.world.findStandY(tr.pos.x, tr.pos.z, GROUND) : col.h + 1);
      if (!spot || ow.settlementAt(spot.x, spot.z)) continue;
      const m = new NPC(this, tr.rec, tr.L);
      m.caravan = { tx: tr.target.x, tz: tr.target.z, way: tr.way || null, to: tr.to.name, from: tr.from.name };
      // On horseback, or up on a wagon.
      if (tr.mount) m.mount = tr.mount;
      if (tr.company) {
        m.company = tr.company;
        m.caravan.camp = tr.camp;
        m.caravan.campKey = tr.camped ? `rc:${tr.company.id}:${tr.company.departAt}` : null;
      }
      if (tr.adv) {
        m.adventurer = tr.adv;
        this.sim.adventurers.ents.set(tr.adv.id, m);
      }
      m.state = 'caravan';
      m.tr = tr;
      m.teleport(spot.x, spot.y, spot.z);
      tr.rec.ent = m;
      this.npcs.push(m);
      this.caravans.set(tr.key, m);
    }
    for (const [k, n] of this.caravans) {
      if (live.has(k) && !n.dead) continue;
      // Their journey's reckoning has them in town already, but here they
      // are in front of you, still on the way: they walk on in (for a
      // while; a group that's lost its way is let go).
      const tr = n.tr;
      n.lateT = (n.lateT || 0) + 1;
      const near = Math.max(Math.abs(n.x - p.x), Math.abs(n.z - p.z)) <= 40;
      if (!n.dead && tr && near && n.lateT < 150 && !tr.to.deserted) {
        if (ow.settlementAt(n.x, n.z) === tr.to) this.caravanLanded(tr, n);
        continue;
      }
      this.endCaravan(k, n);
    }
    for (const k of this.caravanIn) if (!live.has(k.split('>')[0])) this.caravanIn.delete(k);
    if (this.caravanOff) for (const k of this.caravanOff) if (!live.has(k)) this.caravanOff.delete(k);
  }

  // Someone you've followed down the road walks into the town they were
  // going to: whatever their journey's reckoning says, they're here now,
  // and whoever they are in town (a trader at the company's camp, a
  // merchant at the market, a villager home again) carries on from this
  // very spot. (No vanishing at the gate.)
  caravanLanded(tr, n) {
    this.caravanIn.add(`${tr.key}>${tr.to.id}`);
    const at = { x: n.x, y: n.y, z: n.z, mount: n.mount || null };
    // (The rest of a company, riding in behind, with them.)
    if (tr.company) {
      this.sim.landing ||= new Map();
      for (const [k2, n2] of this.caravans) {
        if (k2 === tr.key || !k2.startsWith(`car:${tr.company.id}:`) || n2.dead) continue;
        this.sim.landing.set(`c${tr.company.id}:${k2.split(':')[2]}`, { x: n2.x, y: n2.y, z: n2.z, mount: n2.mount || null, t: this.sim.abs });
        this.caravanIn.add(`${k2}>${tr.to.id}`);
        this.endCaravan(k2, n2);
      }
    }
    this.endCaravan(tr.key, n);
    const kind = this.sim.arriveEarly(tr, at);
    if (kind === 'company') this.sim.caravans.syncEnts();
    else if (kind === 'visit') this.sim.syncVisitors();
    else if (kind === 'adventurer') this.sim.adventurers.syncEnts();
    else if (kind === 'home' || kind === 'settler') this.respawnReturning();
    return kind;
  }

  // Builders out on a road between towns: when you're near the end they're
  // working on, there they are, digging the next stretch.
  updateRoadCrews(dt) {
    this.crewT = (this.crewT || 0) - dt;
    if (this.crewT > 0 || this.sleep) return;
    this.crewT = 1;
    const p = this.player;
    const D = this.sim.diplomacy;
    const want = new Set();
    for (const r of D.roads) {
      if (r.done) continue;
      const k = `${r.a}:${r.b}`;
      for (const end of ['A', 'B']) {
        const f = D.frontier(r, end);
        if (!f || Math.max(Math.abs(f.x - p.x), Math.abs(f.z - p.z)) > 40 || !this.world.regionAt(f.x, f.z)) continue;
        const L = this.sim.layoutOf(end === 'A' ? r.a : r.b);
        if (!L) continue;
        const crew = L.npcs.filter((rec) => rec.roadwork && rec.roadwork.k === k && rec.roadwork.end === end && alive(rec));
        crew.forEach((rec, i) => {
          want.add(rec);
          if (rec.ent && !rec.ent.dead) return;
          // On the stretch already laid, just short of the end; or, if you'd
          // see them appear there, further back toward home, out of sight,
          // and they walk up.
          const n0 = r.tiles.length;
          const back = end === 'A' ? -1 : 1;
          let k = end === 'A' ? Math.max(0, f.i - 2 - i * 2) : Math.min(n0 - 1, f.i + 2 + i * 2);
          const seen = (q) => Math.abs(q[0] - p.x) <= 19 && Math.abs(q[2] - p.z) <= 13;
          while (r.tiles[k] && seen(r.tiles[k]) && k + back >= 0 && k + back < n0) k += back;
          const t = r.tiles[k] || [f.x, f.y, f.z];
          if (seen(t)) return;
          const spot = this.findFreeSpot(t[0], t[2], t[1] + 1);
          if (!spot || seen([spot.x, 0, spot.z])) return;
          const n = new NPC(this, rec, L);
          n.state = 'roadwork';
          n.crew = { road: r, end, slot: i, at: k };
          n.teleport(spot.x, spot.y, spot.z);
          rec.ent = n;
          this.npcs.push(n);
        });
      }
    }
    // (Crews out of sight with nothing to do near you go on unseen.)
    for (const n of this.npcs) {
      if (n.dead || n.state !== 'roadwork' || want.has(n.rec)) continue;
      if (Math.abs(n.x - p.x) > 20 || Math.abs(n.z - p.z) > 14) this.despawnNpc(n);
    }
  }

  endCaravan(key, n) {
    this.caravans.delete(key);
    if (n && !n.dead) {
      n.caravan = null;
      this.despawnNpc(n);
    }
  }

  // A nomad band walks in from the road and camps by the square.
  spawnNomads(L, band) {
    const a = this.active.get(L.settlement.id);
    if (!a) return null;
    const out = [];
    const all = { s: 0, e: 1440, act: 'camp', place: 'plaza' };
    band.people.forEach((p, i) => {
      const rec = {
        ...JSON.parse(JSON.stringify(p)), id: `${L.settlement.id}:n${band.id}:${i}`, idx: 3000 + band.id * 10 + i, sid: L.settlement.id, visitor: true, nomadBand: band.id,
        home: null, bed: 0, household: null, friends: [], work: { kind: 'none' }, schedule: { work: [all], rest: [all] },
        coins: 5, inv: [], skills: { trading: 0.2, cooking: 0.3, hunting: 0.5, fishing: 0.3, farming: 0.3, building: 0.3, crafting: 0.3 },
        fed: 1, hungry: 0, mood: 0.6, grief: [], override: null, away: false, doneKey: null,
      };
      // The family walks in together by one road.
      const e = L.entrances[band.id % Math.max(1, L.entrances.length)] || { x: L.plaza.cx, z: L.plaza.cz };
      // (With a wagon and horses, they drive and ride up to their camp.)
      const mounts = band.mounts || [];
      const ride = i < mounts.length && p.age === 'adult' ? this.rideInSpot(this.sim.camps.get(`n:${band.id}`), i) : null;
      const spot = ride || this.findFreeSpot(e.x + (i % 2), e.z + (i >> 1), GROUND);
      const n = new NPC(this, rec, L);
      n.nomad = band;
      if (ride) n.mount = { kind: mounts[i].kind, coat: mounts[i].coat || 0, banner: null };
      n.teleport(spot.x, spot.y, spot.z);
      rec.ent = n;
      a.npcs.push(n);
      this.npcs.push(n);
      out.push(n);
    });
    return out;
  }

  // An adventurer staying in a town you're in: by their tent, or just
  // arriving by the road in.
  spawnAdventurer(L, adv, rec) {
    const a = this.active.get(L.settlement.id);
    if (!a) return null;
    const camp = this.sim.camps.get(`a:${adv.id}`);
    const e = camp ? camp.stand : L.entrances[adv.id % Math.max(1, L.entrances.length)] || { x: L.plaza.cx, z: L.plaza.cz };
    const at = this.sim.landed?.(`a${adv.id}`);
    const spot = (at && this.findFreeSpot(at.x, at.z, at.y)) || this.findFreeSpot(e.x, e.z, GROUND);
    if (!spot) return null;
    const n = new NPC(this, rec, L);
    n.adventurer = adv;
    n.teleport(spot.x, spot.y, spot.z);
    rec.ent = n;
    a.npcs.push(n);
    this.npcs.push(n);
    return n;
  }

  // A raider or a soldier, come for a fight (see war.js): out in the
  // fields, belonging to no town you're in.
  spawnWarrior(rec, L, spot) {
    const n = new NPC(this, rec, L);
    n.state = 'warband';
    n.teleport(spot.x, spot.y, spot.z);
    rec.ent = n;
    this.npcs.push(n);
    return n;
  }

  // Riding in: a little way out beyond a camp that's only just going up
  // (they come in off the road and get down there), or null.
  rideInSpot(camp, i = 0) {
    if (!camp || camp.placed >= camp.ops.length || !camp.out) return null;
    const x = camp.stand.x + camp.out[0] * 8 + (camp.out[1] ? i : 0);
    const z = camp.stand.z + camp.out[1] * 8 + (camp.out[0] ? i : 0);
    if (!this.world.regionAt(x, z) || this.world.ow.settlementAt(x, z)) return null;
    const y = this.world.findStandY(x, z, GROUND);
    return y > 0 ? this.findFreeSpot(x, z, y) : null;
  }

  // One of a trading company, staying at their camp outside a town you're
  // in (by their tents, or just in by the road).
  spawnCaravanner(L, g, i, rec) {
    const a = this.active.get(L.settlement.id);
    if (!a || (rec.ent && !rec.ent.dead)) return null;
    const camp = this.sim.camps.get(`c:${g.id}`);
    const e = camp ? camp.stand : L.entrances[g.id % Math.max(1, L.entrances.length)] || { x: L.plaza.cx, z: L.plaza.cz };
    // Just in: they ride up to their camp and get down there.
    const ride = this.rideInSpot(camp, i);
    // (Ridden in off the road with you: right where they are.)
    const at = this.sim.landed?.(`c${g.id}:${i}`);
    const spot = (at && this.findFreeSpot(at.x, at.z, at.y)) || ride || this.findFreeSpot(e.x + (i % 2), e.z + (i >> 1), GROUND);
    if (!spot) return null;
    const n = new NPC(this, rec, L);
    n.company = g;
    const m = g.members[i];
    if ((at ? at.mount : ride) && (m.mount === 'horse' || m.wagon !== undefined)) n.mount = { kind: m.wagon !== undefined ? 'wagon' : 'horse', coat: m.coat || 0, banner: g.banner };
    n.teleport(spot.x, spot.y, spot.z);
    rec.ent = n;
    a.npcs.push(n);
    this.npcs.push(n);
    return n;
  }

  // A trading company's night by the road: a striped tent and a fire off
  // to one side of the way, the wagons standing, the horses tied to a post.
  pitchRoadCamp(key, pos, g) {
    if (this.roadCamp.has(key)) return this.roadCamp.get(key);
    const w = this.world;
    const ow = w.ow;
    if (!w.regionAt(pos.x, pos.z)) return null;
    // Level, dry, open ground at height `y` (the road's own, near enough).
    const y0 = w.findStandY(pos.x, pos.z, null);
    const clear = (x, z, y) => {
      if (ow.settlementAt(x, z) || !w.regionAt(x, z)) return false;
      if (w.findStandY(x, z, y) !== y) return false;
      const below = w.getBlock(x, y - 1, z);
      if (below === B.path || below === B.flagstone || PLANK_BLOCKS.has(below) || w.isWaterAt(x, y - 1, z) || !BLOCKS[below].solid) return false;
      const top = w.getBlock(x, y, z);
      return top === B.air || !BLOCKS[top].solid;
    };
    // A patch beside the road: tent, fire, post in a row, the wagons behind.
    let at = null;
    for (let r = 2; r <= 6 && !at; r++) {
      for (const [dx, dz] of [[0, r], [0, -r], [r, 0], [-r, 0], [r, r], [-r, r], [r, -r], [-r, -r]]) {
        const x = pos.x + dx;
        const z = pos.z + dz;
        const y = w.findStandY(x, z, y0 > 0 ? y0 : null);
        if (y <= 0) continue;
        if ([0, 1, 2, 3, 4].every((k) => [-1, 0, 1].every((j) => clear(x + k, z + j, y)))) {
          at = { x, y, z };
          break;
        }
      }
    }
    if (!at) return null;
    const Y = at.y;
    const colour = hash4(g.id, 0x7e) % 3 + 1;
    const ops = [
      [at.x, Y, at.z, B.tent, 0 | META_STATE | (colour << 3)],
      [at.x + 1, Y, at.z + 1, B.campfire, META_STATE],
      [at.x + 3, Y, at.z, B.fence, 0],
    ];
    const was = ops.map(([x, y, z]) => [x, y, z, w.getBlock(x, y, z), w.getMeta(x, y, z)]);
    for (const [x, y, z, id, meta] of ops) w.setBlock(x, y, z, id, meta);
    this.lightDirty = true;
    const post = { x: at.x + 3, y: Y, z: at.z };
    const camp = { key, ops, was, fire: { x: at.x + 1, y: Y, z: at.z + 1 }, horses: [], wagons: [] };
    const spots = [[4, 0], [4, 1], [3, 1], [2, 0]];
    let h = 0;
    let wi = 0;
    camp.company = g.id;
    for (const [mi, m] of g.members.entries()) {
      if (m.mount !== 'horse' && m.wagon === undefined) continue;
      // (A horse killed is gone: see horseDied. The wagon stays.)
      const [sx, sz] = spots[h % spots.length];
      if (!m.horseLost) camp.horses.push({ key: `${key}:h${h}`, x: at.x + sx, y: Y, z: at.z + sz, coat: m.coat || 0, banner: g.banner, post, member: mi });
      h++;
      if (m.wagon !== undefined) {
        camp.wagons.push({ key: `${key}:w${wi}`, x: at.x + 1 + wi * 2, y: Y, z: at.z - 1, face: 1, banner: g.banner });
        wi++;
      }
    }
    this.roadCamp.set(key, camp);
    return camp;
  }

  // A tied horse killed (round 57): it stays dead. Whoever kept it is a
  // horse short from now on, and its place stands empty.
  standSlain(c) {
    const k = c.standKey;
    (this.slainStand ||= new Set()).add(k);
    this.tied.delete(k);
    const sim = this.sim;
    if (c.town) {
      const L = sim.layoutOf(c.town.sid);
      if (L && sim.stables.slain) sim.stables.slain(L, c.town.idx);
    }
    if (c.standOf && c.standOf.company !== null && c.standOf.company !== undefined) sim.caravans.horseDied(c.standOf.company, c.standOf.member);
    // (A camp outside a town: its horse gone from it.)
    for (const camp of sim.camps.list) if (camp.horses && camp.horses.some((h) => h.key === k)) camp.horses = camp.horses.filter((h) => h.key !== k);
    for (const camp of (this.roadCamp || new Map()).values()) camp.horses = camp.horses.filter((h) => h.key !== k);
    // (A visitor's, tied at the post: they go home on foot.)
    if (k.startsWith('guest:')) {
      const id = k.slice(6);
      for (const list of sim.visits.values()) for (const v of list) if (String(v.id) === id) v.mount = null;
    }
  }

  // Struck in the morning (or out of sight): only what's still as they
  // left it comes down.
  strikeRoadCamp(key) {
    const camp = this.roadCamp.get(key);
    this.roadCamp.delete(key);
    if (!camp) return;
    const w = this.world;
    camp.ops.forEach(([x, y, z, id], i) => {
      if (!w.regionAt(x, z)) {
        this.sim.setBlocks([[x, y, z, B.air, 0]]);
        return;
      }
      if (w.getBlock(x, y, z) !== id) return;
      const [, , , was, meta] = camp.was[i] || [];
      w.setBlock(x, y, z, was && !BLOCKS[was]?.solid ? was : B.air, was ? meta || 0 : 0);
    });
    this.lightDirty = true;
  }

  // A friendly bout with an adventurer: first down to a quarter of their
  // strength loses, and pays the wager. No crime in it, for either of you.
  // They take a few seconds to square up (counting it down) before they
  // come at you, unless you swing first.
  startDuel(npc, wager) {
    this.duel = { npc, wager, start: this.sim.abs };
    npc.duelReady = 3;
    npc.face(this.player.x, this.player.z);
    npc.say(npc.rng.pick(['On guard!', 'Let\'s see what you\'ve got.', 'Don\'t hold back!']), 1.4, '#ffe070');
    this.ui.msg(`A friendly bout with ${npc.name}: the first down to a quarter of their strength loses. Wager: ¤${wager}.`, '#ffe070');
    this.audio?.play('draw', npc);
  }

  // The bout's on now (the count's done, or you've swung).
  duelBegins() {
    const d = this.duel;
    if (!d || !(d.npc.duelReady > 0)) return;
    d.npc.duelReady = 0;
    d.npc.engage(this.player);
  }

  endDuel(result) {
    const d = this.duel;
    this.duel = null;
    if (!d) return;
    const n = d.npc;
    const p = this.player;
    if (!n.dead) n.calmDown(true);
    const adv = n.adventurer;
    if (result === 'won') {
      const pay = Math.min(d.wager, n.rec.coins || 0);
      n.rec.coins -= pay;
      if (adv) adv.coins = n.rec.coins;
      if (pay) {
        const left = p.give('coin', pay);
        if (left) this.spawnDrop('coin', left, p.x, p.y, p.z, true);
      }
      n.say(n.rng.pick(['Well fought! You have my respect.', 'Ha! You got me. Fair and square.', 'I yield! Where did you learn that?']), 3.5, '#a0ffa0');
      this.ui.msg(`You won the bout with ${n.name}${pay ? ` and ¤${pay}` : ''}.`, '#a0ffa0');
      this.sim.changeRep(n, 15, 'bout');
      if (adv) adv.beaten = (adv.beaten || 0) + 1;
      gainMastery(this, 'dueling', 1.5);
    } else {
      const owe = Math.min(d.wager, countItem(p.inv, 'coin'));
      if (owe) removeItem(p.inv, 'coin', owe);
      n.rec.coins = (n.rec.coins || 0) + owe;
      if (adv) adv.coins = n.rec.coins;
      n.say(result === 'fled' ? 'Walking away? Then the purse is mine.' : n.rng.pick(['A good bout! Better luck next time.', 'Not bad at all. Keep at it.', 'You\'ll get me one day.']), 3.5);
      this.ui.msg(result === 'fled' ? `You walked away from the bout and forfeit ¤${owe}.` : `${n.name} won the bout${owe ? `: you pay ¤${owe}` : ''}.`, '#ffb080');
      this.sim.changeRep(n, result === 'fled' ? -5 : 5);
      // (A bout lost is a lesson too.)
      if (result !== 'fled') gainMastery(this, 'dueling', 0.5);
    }
  }

  updateDuel() {
    // (The bout's over: the quiet after it running out.)
    const da = this.duelAfter;
    if (da) {
      const dt = this.dt || 0.016;
      da.t -= dt;
      if (da.noteT > 0) da.noteT -= dt;
      if (da.t <= 0 || da.npc.dead) this.duelAfter = null;
    }
    const d = this.duel;
    if (!d) return;
    const n = d.npc;
    if (n.dead) this.duel = null;
    else if (this.player.dead || n.distTo(this.player) > 14 || this.sim.abs - d.start > 90) this.endDuel('fled');
    else if (n.duelReady > 0) {
      // Squaring up: guard raised, counting down.
      const before = Math.ceil(n.duelReady);
      n.duelReady -= this.dt || 0.016;
      const after = Math.ceil(n.duelReady);
      if (after !== before && after > 0) {
        n.say(['', 'One...', 'Two...', 'Three...'][after] || '', 0.8, '#ffe070');
        this.audio?.play('select', n);
      }
      if (n.duelReady <= 0) {
        n.say('Fight!', 1.2, '#ffb060');
        this.audio?.play('clang', n);
        this.duelBegins();
      }
    } else if (n.state !== 'fight') n.engage(this.player);
  }

  spared(n) {
    const p = this.player;
    const take = Math.floor(countItem(p.inv, 'coin') * 0.25);
    if (take) removeItem(p.inv, 'coin', take);
    n.rec.coins = (n.rec.coins || 0) + take;
    if (n.adventurer) n.adventurer.coins = n.rec.coins;
    n.calmDown(true);
    n.face(p.x, p.z);
    n.say(n.rng.pick(['Stay down. I\'ve no wish to kill you.', 'That\'s enough. Think twice next time.', 'Yield! ...There. Go and lick your wounds.']), 4, '#ffb080');
    this.ui.msg(`${n.name} beat you, and let you live${take ? `, taking ¤${take} for the trouble` : ''}.`, '#ff9080');
    this.shake = Math.min(1, this.shake + 0.5);
  }

  removeAdventurer(n) {
    if (this.duel && this.duel.npc === n) this.duel = null;
    this.despawnNpc(n);
  }

  // The band settles: the travellers become townsfolk on the spot.
  nomadsSettle(L, ents, recs) {
    const a = this.active.get(L.settlement.id);
    ents.forEach((n, i) => {
      const rec = recs[i];
      const pos = n && !n.dead ? { x: n.x, y: n.y, z: n.z } : null;
      if (n && !n.dead) this.despawnNpc(n);
      if (!a || !rec || !pos) return;
      const m = new NPC(this, rec, L);
      m.teleport(pos.x, pos.y, pos.z);
      rec.ent = m;
      a.npcs.push(m);
      this.npcs.push(m);
      if (i === 0) m.say(m.rng.pick(['We\'ll stay! This feels like home.', 'This is the place. We\'re staying.']), 4, '#a0e0a0');
    });
    if (a) this.ui.msg(`The ${recs[0]?.name.last || ''} family of nomads has settled in ${L.settlement.name}.`, '#a0e0a0');
  }

  nomadsLeave(ents) {
    const now = this.day * DAY + this.minute;
    ents.forEach((n, i) => {
      if (!n || n.dead) return;
      setOverride(n.rec, now, now + 240, 'travel', { place: 'road' });
      n.activity = null;
      if (i === 0) n.say(n.rng.pick(['Not for us. Back to the road.', 'We\'ll find somewhere else.']), 3.5);
    });
  }

  // A hired guard reappears beside the player (after loading a save).
  spawnEscort(e) {
    const L = this.sim.layoutOf(e.sid);
    const rec = L && L.npcs[e.idx];
    if (!rec || !alive(rec)) return null;
    if (rec.ent && !rec.ent.dead) this.despawnNpc(rec.ent);
    const p = this.player;
    const spot = this.findFreeSpot(p.x + 1, p.z + 1, p.y);
    const n = new NPC(this, rec, L);
    n.teleport(spot.x, spot.y, spot.z);
    rec.ent = n;
    rec.away = true;
    n.hired = e;
    n.state = 'hired';
    this.npcs.push(n);
    return n;
  }

  // Remove an NPC entity that walked out of town (merchants on the road).
  despawnNpc(n) {
    n.shutAllDoors?.();
    n.releaseSpot();
    this.removeOcc(n);
    n.dead = true;
    if (n.rec.ent === n) n.rec.ent = null;
    if (n.visit && n.rec.visit === n.visit) {
      n.rec.visit = null;
      if (n.originLayout) n.rec.override = null;
    }
    if (n.rec.leaving) {
      n.rec.leaving = false;
      n.rec.away = true;
    }
    const a = this.active.get(n.settlement.id);
    if (a) a.npcs = a.npcs.filter((q) => q !== n);
    this.npcs = this.npcs.filter((q) => q !== n);
  }

  // Trade icons painted on hanging signs.
  refreshSigns() {
    const ICON = {
      tavern: 'stew', shop: 'coin', smithy: 'iron_sword', temple: 'prayer_beads', bakery: 'bread', library: 'book', townhall: 'scroll',
      guardhouse: 'spear', tailor: 'cloth', workshop: 'planks', herbalist: 'herb', warehouse: 'crate', barn: 'wheat', manor: 'gem',
      windmill: 'flour', glassworks: 'glass', sporehouse: 'glowcap', pearlhouse: 'pearl',
    };
    this.signIcons.clear();
    for (const { layout } of this.active.values()) {
      for (const sg of layout.signs) {
        if (sg.kind !== 'building') continue;
        const b = layout.buildings[sg.building];
        if (!b) continue;
        const TRADE_ICON = { smith: 'iron_sword', baker: 'bread', tailor: 'cloth', herbalist: 'potion_vigor', scribe: 'newspaper', jeweller: 'ruby' };
        this.signIcons.set(`${sg.x},${sg.y},${sg.z}`, b.playerShop ? TRADE_ICON[b.playerShop] || 'coin' : b.playerHome ? 'bed' : b.residential ? (b.type === 'manor' ? 'gem' : 'door') : ICON[b.type] || 'coin');
      }
    }
  }

  // ------------------------------------------------------------ fast-forward
  // Days go by (from the command console): every town lives them out as
  // it would while you're away, a few hours of the world each frame.
  skipDays(n) {
    if (this.sleep || this.skipping || this.sim.justice.jail || this.sim.justice.escort || this.player.dead || this.sim.war.live || this.dungeon) return false;
    for (const s of [...this.active.keys()].map((id) => this.world.ow.settlements[id])) this.deactivate(s);
    // Everyone else about (travellers on the road, road crews, soldiers,
    // bandits by their camp) goes off about their business too, rather than
    // standing frozen where they were while the days go by: whoever's near
    // when it's over turns up again then.
    for (const k of [...(this.caravans || new Map()).keys()]) this.endCaravan(k, this.caravans.get(k));
    if (this.caravanIn) this.caravanIn.clear();
    for (const q of this.npcs) if (!q.dead) this.despawnNpc(q);
    this.npcs = this.npcs.filter((q) => !q.dead);
    this.engines = [];
    this.wildlife.clear();
    if (this.shipProps) this.shipProps.clear();
    this.skipping = { left: Math.max(1, Math.round(n * 24)), total: Math.max(1, Math.round(n * 24)), day0: this.day };
    this.waiting = null;
    this.mining = null;
    this.charging = null;
    return true;
  }

  updateSkip() {
    const sk = this.skipping;
    const sim = this.sim;
    for (let h = 0; h < 6 && sk.left > 0; h++, sk.left--) {
      this.minute += 60;
      if (this.minute >= DAY_MINUTES) {
        this.minute -= DAY_MINUTES;
        this.day++;
      }
      for (const L of this.world.layouts.values()) if (L.econ) simulateTo(sim, L, sim.abs);
      // (Everything that keeps its own days: realms, wars, bandits, markets.)
      sim.tickT = 0;
      sim.update(0.5);
    }
    const done = sk.total - sk.left;
    if (!sk.journey && (done % 24 === 0 || !sk.left)) this.ui.msg(`Day ${this.day}...`, '#c8d8ff', true);
    if (sk.left > 0) return;
    this.skipping = null;
    if (sk.journey) return this.endJourney(sk.journey);
    this.player.hp = this.player.maxHp;
    this.player.awakeSince = this.day * DAY_MINUTES + this.minute;
    this.updateSettlements(true);
    this.ui.msg(`${this.day - sk.day0} day${this.day - sk.day0 === 1 ? '' : 's'} pass. It's day ${this.day}.`, '#ffe8a0');
  }

  // (Round 77) Off by coach or ferry (see sim/coaches.js): the fare paid,
  // the hours of the way gone by (the world living them, as when days are
  // skipped), and you're set down at the far end. With others playing,
  // nobody's time can be taken from them: you're there as you set off.
  journey(link) {
    const p = this.player;
    if (countItem(p.inv, 'coin') < link.fare) return false;
    // (Round 78) Carried there, the whole way, in the coach or aboard the
    // ferry (see rides.js); the old way only if there's no way to be had.
    if (startRide(this, link)) return true;
    removeItem(p.inv, 'coin', link.fare);
    const to = { sid: link.s.id, kind: link.kind, name: link.s.name, mins: link.mins };
    this.audio?.play(link.kind === 'ferry' ? 'ship_bell' : 'horn');
    this.ui.msg(link.kind === 'ferry' ? `You pay ¤${link.fare} and go aboard the ferry for ${link.s.name}.` : `You pay ¤${link.fare} and climb into the coach for ${link.s.name}.`, '#e8e0a0');
    if (this.isParty() || this.remote || !this.skipDays(link.mins / (24 * 60))) {
      this.endJourney(to);
      return true;
    }
    this.skipping.journey = to;
    return true;
  }

  endJourney(to) {
    const s = this.world.ow.settlements[to.sid];
    if (!s) return;
    const at = arrivalSpot(this, s, to.kind);
    this.loadAround(at.x, at.z, true);
    const spot = this.findFreeSpot(at.x, at.z, GROUND);
    this.teleportPlayer(spot.x, spot.y, spot.z);
    this.world.ow.markExplored(spot.x, spot.z, 2);
    this.updateSettlements(true);
    this.ui.msg(to.kind === 'ferry' ? `After ${wayTime(to.mins)} at sea, the ferry ties up at ${to.name}.` : `After ${wayTime(to.mins)} on the road, the coach sets you down at ${to.name}.`, '#ffe8a0');
  }

  // Out at the storm round the Dagoni Islands: thrown back (a raft, or you
  // swimming), with a word on why (now and then: not every wave).
  stormTurnsBack(raft) {
    const now = this.day * DAY + this.minute;
    this.shake = Math.min(1, (this.shake || 0) + 0.25);
    if (Math.random() < 0.3) this.renderer.emit(this.player.x, GROUND, this.player.z, { n: 10, color: ['#e8f4ff', '#a8c8e0', '#ffffff'], up: 40, speed: 50, gravity: 160, life: 0.6, shape: 'drop' });
    if (this.stormWarned !== undefined && now - this.stormWarned < 3) return;
    this.stormWarned = now;
    this.audio?.play('splash');
    this.ui.msg(raft
      ? 'The storm round the islands throws your raft back like a leaf. No raft could live out there: it would take a real ship to get through.'
      : 'Great waves throw you back toward the shore. Nobody could swim through that storm: it would take a real ship.', '#a0c8ff');
  }

  // Lava: whatever stands in it is badly burned and set alight, save what
  // lives in fire (or floats over it, or is on a raft).
  lavaTick(dt) {
    this.lavaT = (this.lavaT ?? 0) - dt;
    if (this.lavaT > 0) return;
    this.lavaT = 0.4;
    const w = this.world;
    for (const e of [...this.everyone(), ...this.npcs, ...this.creatures]) {
      if (e.dead || e.down || e.raft || (e.S && (e.S.fireproof || e.S.floats))) continue;
      const x = Math.round(e.x);
      const z = Math.round(e.z);
      if (w.getBlock(x, e.y, z) !== B.lava && w.getBlock(x, e.y - 1, z) !== B.lava) continue;
      // (Kharos's fire-walk: half the harm.)
      this.damage(e, e.kind === 'player' ? (e.fireWalk === this.day ? 2 : 3) : 4, null);
      e.burnT = Math.max(e.burnT || 0, 4);
      e.burnSrc = null;
      this.renderer.emit(x + 0.5, e.y + 0.4, z + 0.5, { n: 8, color: ['#ff7020', '#ffb040', '#ffe070'], up: 30, speed: 30, life: 0.6, glow: true, gravity: -20 });
      if (e === this.player) {
        const now = this.day * DAY + this.minute;
        if (this.lavaWarned === undefined || now - this.lavaWarned > 5) {
          this.lavaWarned = now;
          this.ui.msg('The lava burns! Get out of it!', '#ff7040');
        }
      }
    }
  }

  // Round 36. The ember ward over a town of Kharos whose realm has learned
  // to raise it (see tech.ember_ward): a dome of heat over its square,
  // reaching over its houses (all but the few furthest out; not its
  // fields). { s, cx, cz (its middle pace), x, z, r (its reach on the
  // ground, in paces) }, or null.
  wardOf(s) {
    if (!s || s.style !== 'ember' || s.deserted || s.condition === 'abandoned' || !this.sim || !this.sim.tech) return null;
    if (!this.sim.tech.settledIn(s, 'ember_ward', this.day)) return null;
    const L = this.world.layouts && this.world.layouts.get(s.id);
    const P = L && L.plaza;
    const b = s.bounds;
    const cx = P ? P.cx : Math.floor((b.x0 + b.x1) / 2);
    const cz = P ? P.cz : Math.floor((b.z0 + b.z1) / 2);
    let r = Math.max(cx - b.x0, b.x1 - cx, cz - b.z0, b.z1 - cz) * 0.6;
    if (L && L.buildings.length) {
      if (!L.wardR || L.wardR.n !== L.buildings.length) {
        const far = L.buildings.filter((q) => q.x0 !== undefined).map((q) => Math.max(...[[q.x0, q.z0], [q.x1, q.z0], [q.x0, q.z1], [q.x1, q.z1]].map(([x, z]) => Math.hypot(x + 0.5 - cx - 0.5, z + 0.5 - cz - 0.5)))).sort((u, v) => u - v);
        L.wardR = { n: L.buildings.length, r: far.length ? far[Math.floor((far.length - 1) * 0.85)] + 2 : r };
      }
      r = L.wardR.r;
    }
    return { s, cx, cz, x: cx + 0.5, z: cz + 0.5, r: Math.max(8, r) };
  }

  // The ward over (x, z), if any.
  wardAt(x, z) {
    const ow = this.world.ow;
    if (!ow || !ow.settlementsNear) return null;
    for (const s of ow.settlementsNear(x, z)) {
      const w = this.wardOf(s);
      if (w && Math.hypot(x + 0.5 - w.x, z + 0.5 - w.z) <= w.r) return w;
    }
    return null;
  }

  // The wards to be seen about you: the towns here whose heart-crystal is
  // up (see render/pieces.drawWards).
  wards() {
    const out = [];
    for (const { layout: L } of this.active.values()) {
      if (!L.econ || !(L.econ.shown || []).includes('ember_ward')) continue;
      const w = this.wardOf(L.settlement);
      if (w) out.push(w);
    }
    return out;
  }

  // Round 36. The heart of the mire (see tech.mist_heart): by the great
  // glowcap (or the kindled conch) on the square, you're mended, slowly,
  // motes of its light drifting off you.
  mireHeart(dt) {
    const p = this.player;
    if (this.dungeon || p.dead || p.hp >= p.maxHp) {
      this.mireT = 0;
      return;
    }
    const s = this.currentSettlement;
    if (!s || !this.sim || !this.sim.tech.settledIn(s, 'mist_heart', this.day)) return;
    const L = this.world.layouts && this.world.layouts.get(s.id);
    const P = L && L.plaza;
    if (!P || Math.max(Math.abs(p.x - P.cx), Math.abs(p.z - P.cz)) > 6) return;
    const id = this.world.getBlock(P.cx, GROUND, P.cz);
    if ((id !== B.great_glowcap && id !== B.conch_fountain) || !(this.world.getMeta(P.cx, GROUND, P.cz) & META_STATE)) return;
    this.mireT = (this.mireT || 0) + dt;
    if (this.mireT < 4) return;
    this.mireT = 0;
    p.hp = Math.min(p.maxHp, p.hp + 1);
    this.renderer.emit(p.x, p.y + 1, p.z, { n: 7, color: ['#a8f8ff', '#e0ffff', '#7ae8ff'], up: 22, life: 0.9, gravity: -14, glow: true });
  }

  // A licensed pearl diver swimming in open water comes up with a pearl
  // now and then (more often the deeper the time spent under).
  pearlDive(dt) {
    const p = this.player;
    if (!p.inWater || p.raft || this.dungeon || !this.sim.careers.canUseBench('pearldiver')) {
      this.diveT = 0;
      return;
    }
    this.diveT = (this.diveT || 0) + dt;
    if (this.diveT < 18) return;
    this.diveT = 0;
    if (Math.random() < 0.55) {
      const left = p.give('pearl', 1);
      if (left) this.spawnDrop('pearl', left, p.x, p.y, p.z, true);
      this.ui.msg('You come up with an oyster, and in it a pearl!', '#f0e8ff');
      this.renderer.emit(p.x, p.y + 0.6, p.z, { n: 8, color: ['#f4f0ff', '#c8e0ff', '#ffffff'], up: 30, speed: 20, life: 0.6, gravity: 20 });
    } else this.ui.msg('Only empty shells this time.', '#a0b8c8');
  }

  // How thick the mountain's ash is over the sky where you are (0 to 1):
  // over all three of the Dagoni Islands, for a few days after it's gone
  // up (not below ground).
  ashLevel() {
    if (this.dungeon || !this.sim || !this.sim.volcano) return 0;
    if (!this.world.ow.insideStorm(this.player.x, this.player.z)) return 0;
    return this.sim.volcano.ashLevel();
  }

  // ------------------------------------------------------------ main update
  update(dt, input) {
    this.dt = dt;
    // (Which frame this is: for what's worked out once a frame, see
    // entities/tactics.js.)
    this.frameNo = (this.frameNo || 0) + 1;
    this.pathBudget = 5;
    // (The land keeps the date too: a fresh lava flow cools in a few days.)
    this.world.ow.today = this.day;
    if (this.skipping) {
      input.consume();
      return this.updateSkip();
    }
    // (Someone else's world: it runs there; here it's only seen. See
    // net/guest.js.)
    if (this.remote) return this.remote.update(dt, input);
    // With others playing in the world (see party.js), nothing anyone does
    // stops it or slows it for the rest.
    const party = this.isParty();
    const ev = input.consume();
    const uiRes = this.ui.handle(ev, input, this);
    // The pause menu freezes the world; other windows let it keep living.
    const paused = !!(this.ui.find && (this.ui.find('pause') || this.ui.find('help')));
    if (paused && !party) {
      this.cursor = null;
      this.mining = null;
      return;
    }
    // So does the camera swinging round: time and you stand still till it's done.
    if (this.renderer.spin && !party) {
      this.cursor = null;
      this.mining = null;
      return;
    }
    // An opening scene playing (see cutscene.js): it goes first. Mostly
    // it's to be watched (the world carries on, but you can't act); at sea
    // you can walk the deck and talk.
    const cut = this.cutscene;
    if (cut) {
      cut.update(dt, uiRes.pressed);
      if (this.cutscene === cut && !cut.live) {
        this.cursor = null;
        this.mining = null;
        return;
      }
    }
    // A short scene playing (a spire opening, a master rising or falling:
    // see scenes.js): on the real clock; it may hold you still and slow
    // the world.
    wallTick(this);
    eruptTick(this);
    const slow = this.sceneTick(dt, uiRes.pressed);
    // A fallen star striking Thessa (anyone's: see starfall.js): felt by
    // everyone on the island, here where it's not muted.
    if (this.starShock) {
      const s = this.starShock;
      this.starShock = null;
      starShockwave(this, s);
    }
    // A blow that lands hard holds the moment (hit-stop); a parry slows
    // the world for a breath after. (Not with others playing in it: see
    // playerPhase.)
    if (!party) {
      dt *= slow;
      if (this.hitStop > 0) {
        this.hitStop -= dt;
        dt *= 0.05;
      } else if (this.slowMo > 0) {
        this.slowMo -= dt;
        dt *= this.slowMoScale || 0.35;
      }
    }
    this.dt = dt;
    const blocked = paused || !!this.renderer.spin || this.isBlocked();
    if (this.sleep) this.updateSleep(dt, uiRes.pressed);
    else if (this.waiting) this.updateWait(dt, uiRes.pressed);
    const abs0 = this.day * DAY_MINUTES + this.minute;
    this.minute += (dt * GAME_MINUTES_PER_SECOND * this.timeRate()) / rule('day');
    if (this.minute >= DAY_MINUTES) {
      this.minute -= DAY_MINUTES;
      this.day++;
    }
    // The game saves itself every morning at seven.
    const abs1 = this.day * DAY_MINUTES + this.minute;
    if (Math.floor((abs0 - AUTOSAVE_AT) / DAY_MINUTES) < Math.floor((abs1 - AUTOSAVE_AT) / DAY_MINUTES) && !this.player.dead) this.autosaveDue = true;
    this.playerPhase(dt, input, uiRes, blocked);
    // Everyone else in the world, each in turn, as themselves.
    if (party) for (const s of this.seats) if (s !== this.seat) asSeat(this, s, () => this.guestPhase(dt, s));
    this.streamRegions();
    if (Math.random() < 0.05) this.updateSettlements();
    // (Each on their own map: see party.js.)
    for (const q of this.everyone()) this.asPlayer(q, () => this.world.ow.markExplored(q.x, q.z, 1));
    // (At sea, before the story starts, the island waits: not with others
    // already playing in it.)
    const atSea = !!this.cutscene && this.cutscene.kind === 'ship' && !party;
    if (!atSea) this.sim.update(dt);
    // (Each player's own dealings with the towns: their work, their favours
    // owed, the law's view of them.)
    if (party && !atSea) for (const s of this.seats) if (s !== this.seat) asSeat(this, s, () => this.sim.updateSeat(dt));
    this.respawnT = (this.respawnT || 0) - dt;
    if (this.respawnT <= 0) {
      this.respawnT = 2;
      this.respawnReturning();
    }
    // When time races (asleep), people keep pace: several steps a frame.
    const fast = this.timeRate();
    const sub = fast > 2 ? Math.min(5, Math.ceil(fast / 15)) : 1;
    const ndt = fast > 2 ? Math.min(0.5, (dt * fast) / sub) : dt;
    if (sub > 1) this.pathBudget = 5 * sub;
    // The island's people (as someone up there, with you down an old place).
    this.inPlace(null, () => {
      for (let k = 0; k < sub; k++) {
        for (const n of this.npcs) {
          if (n.dead) continue;
          n.update(ndt);
          if (k === 0 && !this.player.limbo) n.maybeGreet(this.player, dt);
        }
      }
      ambientChatter(this, dt);
    });
    this.updateDuel();
    if (party) updateBouts(this, dt);
    this.updateDummy(dt);
    this.updateGates(dt);
    this.syncStanding(dt);
    this.npcs = this.npcs.filter((n) => !n.dead);
    this.updateProjectiles(dt);
    updateHazards(this, dt);
    updateOrbs(this, dt);
    updateLasers(this, dt);
    // (Round 71) The evolved masters' things loose in the world: what
    // bounces about their halls, rifts in the air (see evolved.js).
    updateEvolved(this, dt);
    // (Relics where each of you is: the island's, and each old place's.)
    this.inPlace(null, () => updateRelics(this, dt));
    for (const run of this.runs.values()) if (run.lead()) this.inPlace(run, () => updateRelics(this, dt));
    updateKavTech(this, dt);
    updateEvolvedGear(this, dt);
    updateQuestFinder(this, dt);
    updateKnocks(this, dt);
    wadeTick(this, dt);
    this.sim.ancient.update(dt);
    // Each old place someone's down: its own goings-on. (Fields the
    // Overseer turned off, and what a master's done to its hall, put back
    // in their time: for all of them at once.)
    this.updateRuns(dt);
    tickFieldsOff(this, dt);
    updateWorks(this, dt);
    updateEngines(this, dt);
    if (!atSea) this.wildlife.update(dt);
    updateShips(this, dt);
    sailShips(this, dt);
    // (Round 68) The great ships: sailing, fighting, foundering; whoever's
    // aboard them.
    updateShips3d(this, dt);
    // (Round 69) A ship in a bottle in hand: her ghost where she'd go. And
    // below her decks, the view turned with her.
    shipGhostTick(this);
    holdViewTick(this);
    tickLater(this, dt);
    fleetsTick(this, dt);
    idleShipsTick(this, dt);
    // (Round 78) Pirates: their cove, their raiders, grapnels and boarders.
    // Horses and wagons led ashore from a ship.
    pirateTick(this, dt);
    stallsTick(this, dt);
    // (Round 78) What the save check put right, said once it's settled.
    if (this.health && this.health.fixed > this.health.told) {
      this.healthT = (this.healthT ?? 2) - dt;
      if (this.healthT <= 0) {
        this.healthT = 2;
        const t = healthNote(this);
        if (t) this.ui.msg(t, '#a0d8a0');
      }
    }
    updateLabor(this, dt);
    // (The great masters, who fill more than the one tile: see
    // entities/footprint.js.)
    this.bigs = this.creatures.filter((c) => c.foot && !c.dead);
    // The beasts, each where it is (as someone there: the island's, and
    // each old place's).
    const groups = new Map([[null, []]]);
    for (const c of this.creatures) {
      const run = c.inst ? this.runAt(c.x) : null;
      if (!groups.has(run)) groups.set(run, []);
      groups.get(run).push(c);
    }
    for (const [run, list] of groups) {
      if (!list.length) continue;
      this.inPlace(run, () => {
        // Beasts near you keep pace with racing time too (far off, they
        // idle on).
        const pp = this.player;
        for (const c of list) {
          const near = sub > 1 && Math.abs(c.x - pp.x) < 40 && Math.abs(c.z - pp.z) < 40;
          if (!near) {
            c.update(dt);
            continue;
          }
          for (let k = 0; k < sub && !c.dead; k++) c.update(ndt);
        }
      });
    }
    // Burning, chilled, dazzled; wounds an emerald closes.
    this.dotHit = true;
    for (const e of [...this.everyone(), ...this.npcs, ...this.creatures]) if (e.burnT > 0 || e.slowT > 0 || e.stunT > 0 || e.bleedT > 0 || e.poisonT > 0 || e.markT > 0 || e.frozenT > 0 || e.lostT > 0 || e.kind !== 'creature') tickStatus(this, e, dt);
    this.lavaTick(dt);
    this.dotHit = false;
    this.ownWorldPhase(dt);
    if (party) for (const s of this.seats) if (s !== this.seat) asSeat(this, s, () => this.ownWorldPhase(dt));
    this.creatures = this.creatures.filter((c) => {
      if (c.dead) {
        this.removeOcc(c);
        if (c.standKey) this.tied.delete(c.standKey);
      }
      return !c.dead;
    });
    for (const d of this.drops) d.update(dt);
    this.pickupDrops();
    if (party) for (const s of this.seats) if (s !== this.seat) asSeat(this, s, () => this.pickupDrops());
    this.drops = this.drops.filter((d) => !d.dead);
    this.inPlace(null, () => this.spawning(dt));
    // (Round 62) The world's mods at work: their waits, effects, events.
    if (MODS.active.length) modTick(this, dt);
    this.growPlants(dt);
    this.crops.update(dt);
    this.playtime.update(dt);
    this.updateBells(dt);
    this.updateCaravans(dt);
    this.updateRoadCrews(dt);
    this.updateWeather(dt);
    this.ambientFx(dt);
    this.ownAfterPhase(dt, input);
    // (The sky over each of you, wherever you are.)
    if (party) for (const s of this.seats) if (s !== this.seat) asSeat(this, s, () => {
      this.updateWeather(dt);
      this.ownAfterPhase(dt, s.input);
    });
    // What each of you has done lately, worth an achievement (see
    // achievements.js).
    this.featT = (this.featT || 0) - dt;
    if (this.featT <= 0) {
      this.featT = 0.5;
      this.checkFeats();
    }
    // The camera: drawn back near a spire, or wherever a scene takes it.
    const nearSpire = this.dungeon ? 0 : this.placeNearness(dt);
    // (Round 69: at a ship's wheel, drawn back to see all of her.)
    const helm = this.scene ? null : helmView(this);
    this.helmFocus = helm ? helm.focus : null;
    this.renderer.zoomGoal = this.scene && this.scene.zoom ? this.scene.zoom : Math.max(1 + nearSpire, helm ? helm.zoom : 1);
    // (A scene's zoom is its own smooth curve: taken as it comes.)
    this.renderer.zoomSnap = !!(this.scene && this.scene.zoom);
    if (this.audio) this.audio.listener = this.player;
    // Entities visible this frame.
    const p = this.player;
    // (Not anyone still watching their opening: they're not here yet.)
    const vis = p.limbo ? [] : [p];
    // (Square, so turning the camera never leaves anyone out.)
    for (const q of this.everyone()) if (q !== p && !q.limbo && Math.abs(q.x - p.x) < 26 && Math.abs(q.z - p.z) < 26) vis.push(q);
    for (const n of this.npcs) if (!n.dead && Math.abs(n.x - p.x) < 26 && Math.abs(n.z - p.z) < 26) vis.push(n);
    for (const c of this.creatures) if (Math.abs(c.x - p.x) < 26 && Math.abs(c.z - p.z) < 26) vis.push(c);
    for (const d of this.drops) if (Math.abs(d.x - p.x) < 26 && Math.abs(d.z - p.z) < 26) vis.push(d);
    for (const q of this.props.values()) if (Math.abs(q.x - p.x) < 28 && Math.abs(q.z - p.z) < 28) vis.push(q);
    for (const q of this.engines) if (Math.abs(q.x - p.x) < 30 && Math.abs(q.z - p.z) < 30) vis.push(q);
    for (const c of this.sailors || []) if (!c.dead && Math.abs(c.x - p.x) < 40 && Math.abs(c.z - p.z) < 40) vis.push(c);
    if (this.cutscene && this.cutscene.actors) for (const a of this.cutscene.actors) if (!a.dead) vis.push(a);
    this.visibleEntities = vis;
    if (this.autosaveDue && !this.cutscene && !(this.scene && this.scene.intro)) {
      const why = this.autosaveDue;
      this.autosaveDue = false;
      // (Round 77: unless it's turned off in Settings. Round 78: the reason,
      // going into a dungeon or out, or true for the morning's.)
      if (this.autosave && !(this.ui && this.ui.noAutosave)) this.autosave(typeof why === 'string' ? why : null);
    }
    if (this.net) this.net.afterUpdate(dt);
  }

  // ------------------------------------------------------------ achievements
  // Each player's newly done (see achievements.js), as themselves.
  checkFeats() {
    if (this.remote) return;
    const look = () => {
      // (Not while their opening plays: nothing's been done yet.)
      if (!this.player || this.player.limbo || (this.scene && this.scene.intro)) return;
      noteIsle(this);
      for (const id of newFeats(this, this.featsHave())) this.feat(id);
    };
    look();
    if (this.seats) for (const s of this.seats) if (s !== this.seat && s.ent) asSeat(this, s, look);
  }

  // What the player being played as already has. (Someone in your world:
  // what they've been told of; their screen keeps the rest.)
  featsHave() {
    const seat = this.seats ? this.seat : null;
    if (seat && !seat.host) return (seat.featsSent ||= new Set());
    if (this.featBook) return new Set(Object.keys(this.featBook.got));
    return (this.featsGot ||= new Set());
  }

  // Done (as the player being played as): theirs to keep. Yours, kept
  // here; someone else's, sent to their screen (see net/host.js).
  feat(id) {
    const seat = this.seats ? this.seat : null;
    if (seat && !seat.host) {
      const sent = (seat.featsSent ||= new Set());
      if (sent.has(id)) return false;
      sent.add(id);
      this.net?.feat?.(seat, id);
      return true;
    }
    let fresh;
    if (this.featBook) fresh = this.featBook.unlock(id);
    else {
      const got = (this.featsGot ||= new Set());
      fresh = !got.has(id);
      got.add(id);
    }
    if (fresh) this.onFeat?.(id);
    return fresh;
  }

  // A scene of yours playing: on the real clock. (How much it slows the
  // world: 1 for not at all.)
  sceneTick(dt, pressed) {
    const sc = this.scene;
    if (!sc) return 1;
    sc.t += dt;
    sc.update?.(this, dt, pressed);
    if (sc.t >= sc.dur) {
      // (An opening over: into the world at last, then its first words.)
      if (sc.intro && !this.remote) this.placeIn();
      sc.end?.(this);
      if (this.scene === sc) this.scene = null;
      return 1;
    }
    return sc.timeScale ? sc.timeScale(sc.t) : 1;
  }

  // ------------------------------------------------------------ openings
  // Kept out of the world while their opening plays (see intros.js), the
  // player being played as: not seen, in nobody's way, nothing after them,
  // not ticking over. Where they'll be set down is where they stand.
  holdOut() {
    const p = this.player;
    if (!p || p.limbo) return;
    p.limbo = true;
    this.removeOcc(p);
  }

  // Into the world at last, where their story puts them (or as near it
  // as is free now).
  placeIn() {
    const p = this.player;
    if (!p || !p.limbo) return;
    p.limbo = false;
    this.loadAround(p.x, p.z, true);
    const at = this.findFreeSpot(p.x, p.z, p.y);
    p.teleport(at.x, at.y, at.z);
    p.spawn = p.spawn || { x: at.x, y: at.y, z: at.z };
    if (!this.seat || this.seat.host) {
      this.renderer.camInit = false;
      this.lightDirty = true;
    }
    this.ui.showHud = true;
    this.ui.lastSettlement = undefined;
  }

  // Can't act: a window open over the world, dead, asleep, held, a scene.
  isBlocked() {
    return this.ui.modal || this.player.dead || !!this.sleep || !!this.player.restrained || !!this.player.down || this.player.kneelT > 0 || (!!this.cutscene && !this.cutscene.playable) || (!!this.scene && this.scene.lock) || stormLocked(this);
  }

  // How fast time runs: racing while you sleep or wait (with others in the
  // world, only while all of you are).
  timeRate() {
    if (!this.isParty()) return this.sleepFast || 1;
    let r = Infinity;
    for (const s of this.seats) r = Math.min(r, seatField(this, s, 'sleepFast') || 1);
    return Number.isFinite(r) ? r : 1;
  }

  // Whatever you're doing with your hands and feet this frame (each player
  // in turn, as themselves).
  playerPhase(dt, input, uiRes, blocked) {
    // (With others playing, a hard blow's hold and a parry's slow breath
    // are only for the one they happen to, and only to see.)
    if (this.isParty()) {
      if (this.hitStop > 0) this.hitStop -= dt;
      else if (this.slowMo > 0) this.slowMo -= dt;
    }
    // (Round 53: a sheep can walk, turn the camera and pick from the belt,
    // and bleat; nothing more. See dishacts.js.)
    const sheep = this.player.sheepT > 0;
    if (!blocked) this.handleKeys(sheep ? sheepFilter(this, this.player, uiRes.pressed) : uiRes.pressed, uiRes.wheel);
    // (Round 78) On the coach or the ferry: carried along. On a rope: up it.
    if (this.player._ride) rideTick(this, this.player, dt);
    if (this.player._grapple) grappleTick(this, this.player, dt);
    // What you wear and hold, and the potions you've drunk.
    this.bonusT = (this.bonusT || 0) - dt;
    if (this.bonusT <= 0) {
      this.bonusT = 0.5;
      this.refreshBonus();
    }
    // (Not yet in the world, watching their opening: nothing happens to them.)
    if (!this.player.limbo) {
      this.player.update(dt, input, blocked);
      playerTick(this, this.player, dt, input, blocked);
      // The ground gone from under you (dug, blown up, burnt away): you drop.
      this.settleFall(this.player);
    }
    this.input = input;
    // (Another player's pointer: what they pointed at on their own screen.)
    if (!blocked) this.cursor = this.seat && !this.seat.host && this.net ? this.net.cursorFor(this.seat) : (this.updateCursor(input), this.cursor);
    else this.cursor = null;
    if (!blocked && sheep) {
      this.mining = null;
      this.charging = null;
      this.pending = null;
      if (uiRes.clicks.some((ck) => ck.type === 'down')) sheepFilter(this, this.player, [{ code: 'Mouse' }]);
    } else if (!blocked) this.handleMouse(dt, uiRes.clicks, input);
    else this.mining = null;
    if (this.queuedBlow) {
      if (blocked) this.queuedBlow = null;
      else this.tickQueuedBlow(dt);
    }
    if (this.player.comboT > 0) this.player.comboT -= dt;
    if (this.stepToldT > 0) this.stepToldT -= dt;
    if (this.player.windedNote > 0) this.player.windedNote -= dt;
    tickDice(this, dt);
    // An arrow on the string: the pull, and the aim (a window opened over
    // it lets it down).
    if (this.player.bowDraw) {
      if (blocked) cancelDraw(this);
      else tickDraw(this, dt, !!input.mouse.down);
    }
  }

  // Another player's turn (see party.js; the host's own is in update):
  // what they pressed (sent over the network: see net/host.js), through
  // their own windows, then the same as anyone's.
  guestPhase(dt, seat) {
    const input = seat.input;
    const ev = input.consume();
    const uiRes = this.ui.handle(ev, input, this);
    this.ui.update?.(dt, this);
    // (Their scene is played on their own screen: here only what it does.)
    if (this.net) this.net.mute++;
    try {
      wallTick(this);
      eruptTick(this);
      this.sceneTick(dt, uiRes.pressed);
    } finally {
      if (this.net) this.net.mute--;
    }
    const blocked = this.isBlocked() || !!seat.away;
    if (this.sleep) this.updateSleep(dt, uiRes.pressed);
    else if (this.waiting) this.updateWait(dt, uiRes.pressed);
    this.playerPhase(dt, input, uiRes, blocked);
    // (Where they are: the town, for the law and the banner.)
    seat.placeT = (seat.placeT || 0) - dt;
    if (seat.placeT <= 0) {
      seat.placeT = 0.25;
      this.currentSettlement = this.world.ow.settlementAt(this.player.x, this.player.z);
    }
    // Townsfolk who know them say hello.
    if (!this.player.limbo) for (const n of this.npcs) if (!n.dead && Math.abs(n.x - this.player.x) < 12 && Math.abs(n.z - this.player.z) < 12) n.maybeGreet(this.player, dt);
    this.updateDuel();
    this.updateDummy(dt);
  }

  // Nothing under your feet any more: down to the first ground below (a
  // long drop hurts). Not on a raft, a horse, a seat or in a wagon.
  settleFall(p) {
    if (!p || p.dead || p.moving || p.raft || p.deck || p.mount || p.inWagon || p.sitting || p.sleeping || p.swallowed || p.down || p._grapple) return false;
    const w = this.world;
    const below = BLOCKS[w.getBlock(p.x, p.y - 1, p.z)];
    if (below.standable || below.liquid || w.isWaterAt(p.x, p.y, p.z)) return false;
    for (let y = p.y - 1; y >= Math.max(1, p.y - 48); y--) {
      const id = w.getBlock(p.x, y, p.z);
      if (BLOCKS[id].liquid) return false;
      if (!w.canStand(p.x, y, p.z)) {
        if (BLOCKS[id].solid) return false;
        continue;
      }
      const drop = p.y - y;
      p.startMove(p.x, y, p.z, Math.min(0.5, 0.12 + drop * 0.06));
      this.audio?.play(drop > 2 ? 'thud' : 'step', p);
      if (drop > 3 && rule('fall') > 0) {
        this.damage(p, Math.max(1, Math.round((drop - 3) * 2 * rule('fall'))), null);
        if (!p.dead) this.ui.msg(`You fall ${drop} blocks and land hard.`, '#ffb080', true);
      }
      return true;
    }
    return false;
  }

  // Each player's own part of the world's turn: the ground under them,
  // what ails them, the laws of the island, the storm round them.
  ownWorldPhase(dt) {
    this.dotHit = true;
    tickAfflictions(this, this.player, dt);
    enforceIslandLaws(this, dt);
    this.pearlDive(dt);
    this.mireHeart(dt);
    this.dotHit = false;
  }

  // And after it: the law's interest in them, their line in the water, the
  // storm at sea, how they feel.
  ownAfterPhase(dt, input) {
    // (A fight wearing off: each player's own. Round 58: it only ever wore
    // off for the host, so a player who'd once fought, blade or shield in
    // hand, raised their guard at every right-click and never talked to
    // anyone again.)
    if (this.combatT > 0) this.combatT -= dt;
    this.updateWanted(dt);
    this.updateFishing(dt, input);
    updateSpireStorm(this, dt);
    updateStormSea(this, dt);
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 3.6);
    if (this.hurtFlash > 0) this.hurtFlash = Math.max(0, this.hurtFlash - dt * 2.2);
    // Mended (by anything: a meal, a potion, a spring, a stone): a soft green
    // at the edges of the screen.
    const hpNow = this.player.hp;
    // (A hot meal's slow mending, a heart at a time, only a glimmer.)
    if (this.lastHp !== undefined && hpNow > this.lastHp && !this.sleep && !this.player.dead) {
      const quiet = this.player.quietHeal;
      if (!quiet && !(this.healFlash > 0.15)) this.audio?.play('heal');
      this.healFlash = Math.min(0.8, (this.healFlash || 0) + (quiet ? 0.12 : 0.38 + Math.min(0.3, (hpNow - this.lastHp) * 0.05)));
    }
    this.player.quietHeal = false;
    this.lastHp = hpNow;
    // Near death: your heart pounding (faster the closer it is).
    const frac = hpNow / Math.max(1, this.player.maxHp);
    if (frac <= 0.25 && hpNow > 0 && !this.player.dead && !this.sleep) {
      this.beatT = (this.beatT ?? 0) - dt;
      if (this.beatT <= 0) {
        this.beatT = 0.7 + frac * 2.4;
        this.audio?.play('heartbeat');
      }
    }
    if (this.healFlash > 0) this.healFlash = Math.max(0, this.healFlash - dt * 1.1);
  }

  // ------------------------------------------------------------ party
  // More than one of you in the world (see party.js and net/host.js)?
  isParty() {
    return !!(this.seats && this.seats.length > 1);
  }

  // Open the world to others (see net/host.js): you take the first seat.
  startParty(profile) {
    if (this.seats) return this.seat;
    const seat = new Seat({ id: profile.id, profile, host: true });
    seat.ent = this.player;
    this.player.seat = seat;
    this.player.account = profile;
    this.seats = [seat];
    this.seat = seat;
    this.partyChars ||= new Map();
    return seat;
  }

  // Someone joins (their own windows and keys, made by net/host.js): their
  // character as they left it in this world, or a new one made from
  // `hero` beside whoever's here. Returns their seat.
  addSeat(profile, { ui, input, hero = null }) {
    const saved = this.partyChars && this.partyChars.get(profile.id);
    const seat = new Seat({ id: profile.id, profile });
    seat.ui = ui;
    seat.input = input;
    let at = saved && saved.player;
    // (Left down below, in a place that's gone: up top by whoever's
    // hosting, or by the way into the old place they're down.)
    if (at && this.world.inInstance(at.x)) at = null;
    // A new fallen star: down in a crater of their own, by a village (see
    // starfall.js), their fall shown on their screen. A new castaway: on
    // the beach, what washed up with them about them. (A native's home is
    // found as them, below.) Each sees their own opening first.
    let star = null;
    let coast = null;
    // (Round 63) Where the mods have new characters begin (see startOf).
    const ps = !saved && hero && hero.origin !== 'native' && !this.dungeon ? startOf(this, hero) : null;
    if (!saved && hero && hero.origin === 'star') {
      let salt = 0;
      for (const ch of String(profile.id)) salt = (salt * 31 + ch.charCodeAt(0)) >>> 0;
      star = starSpot(this, salt);
      if (star && ps) {
        star.x = ps.x;
        star.z = ps.z;
      }
      if (star) {
        this.loadAround(star.x, star.z, true);
        makeCrater(this, star.x, star.z);
        at = this.findFreeSpot(star.x, star.z, GROUND);
      }
    } else if (ps) {
      this.loadAround(ps.x, ps.z, true);
      at = this.findFreeSpot(ps.x, ps.z, GROUND);
    } else if (!saved && hero && hero.origin === 'crash' && !this.dungeon) {
      coast = this.coastSpot();
      if (coast) {
        this.loadAround(coast.x, coast.z, true);
        at = this.findFreeSpot(coast.x, coast.z, GROUND);
      }
    }
    if (!at) {
      const h = this.dungeon ? this.dungeon.exitSpot() : this.player;
      if (this.dungeon) this.loadAround(h.x, h.z, true);
      at = this.findFreeSpot(h.x + 1, h.z + 1, h.y);
      // (Not on top of anyone already here.)
      const taken = (q) => this.everyone().some((o) => o.x === q.x && o.z === q.z);
      if (taken(at)) {
        for (const [dx, dz] of [[1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1], [2, 0], [0, 2], [-2, 0], [0, -2]]) {
          const q = { x: h.x + dx, y: h.y, z: h.z + dz };
          if (this.world.canStand(q.x, q.y, q.z) && !this.world.isWaterAt(q.x, q.y, q.z) && !taken(q)) {
            at = q;
            break;
          }
        }
      }
    } else this.loadAround(at.x, at.z, true);
    const p = new Player(this, at.x, at.y, at.z);
    p.seat = seat;
    p.account = profile;
    const name = (saved && saved.name) || (hero && hero.name) || profile.name;
    seat.store = freshStore(this, { player: p, hero: saved ? saved.hero : hero ? normalizeHero(hero) : null, ui, input, name });
    seat.ent = p;
    this.moveEntity(p, p.x, p.y, p.z);
    this.seats.push(seat);
    asSeat(this, seat, () => {
      if (saved) this.restoreSeat(saved);
      else this.outfitNewcomer(at);
      // (Born here: their family's house, in their home town.)
      if (!saved && this.hero && this.hero.origin === 'native' && !this.dungeon) this.homeNewcomer();
      if (coast) this.wreckage(at);
      // (The country about them, on their own map.)
      this.world.ow.markExplored(p.x, p.z, 2);
      if (p.awakeSince === undefined) p.awakeSince = this.day * DAY_MINUTES + this.minute;
      this.currentSettlement = this.world.ow.settlementAt(p.x, p.z);
      if (star) {
        this.starAt = star;
        if (this.hero) this.hero.starSid = star.sid;
      }
      // Their story's opening, on their screen; set down in the world when
      // it's done (see intros.js).
      if (!saved && this.hero && this.intros !== false) startIntro(this);
    });
    return seat;
  }

  // A newcomer born on the islands (as them): their home town and family,
  // and they stand in their family's house.
  homeNewcomer() {
    const p = this.player;
    const town = this.pickHometown();
    if (!town) return;
    const host = this.becomeNative(town);
    const inside = host && host.house && host.house.inside;
    if (!inside) return;
    this.loadAround(inside.x, inside.z, true);
    const spot = this.findFreeSpot(inside.x, inside.z, GROUND);
    p.teleport(spot.x, spot.y, spot.z);
    p.spawn = { x: spot.x, y: spot.y, z: spot.z };
    const L = this.world.getLayout(town);
    if (L && lawOn(L, 'armsBan')) this.stowArms();
  }

  // A new character's things: their kit, their looks.
  outfitNewcomer(at) {
    const p = this.player;
    if (this.hero) {
      const kit = this.hero.modKit ? { items: [], coins: 0 } : KITS[this.hero.kit] || KITS[Object.keys(KITS)[0]];
      for (const [k, n] of [...kit.items, ...COMMON_KIT]) this.giveOrWear(k, n);
      p.give('coin', kit.coins);
      if (MODS.active.length) applyCharGen(this, this.hero, p);
      p.baseLook = { ...this.hero.look };
    } else {
      for (const [k, n] of START_KIT) p.give(k, n);
      p.give('coin', 25);
    }
    this.applyHero();
    p.hp = p.maxHp;
    p.spawn = { x: at.x, y: at.y, z: at.z };
  }

  // Back as they were (see seatSave).
  restoreSeat(d) {
    const p = this.player;
    const pd = d.player || {};
    p.hp = pd.hp ?? p.hp;
    p.inv = pd.inv || p.inv;
    p.selected = pd.selected || 0;
    p.spawn = pd.spawn || { x: p.x, y: p.y, z: p.z };
    if (pd.vigor) p.vigor = pd.vigor;
    if (pd.blue) p.blue = pd.blue;
    if (pd.buffs) p.buffs = pd.buffs;
    if (pd.recipes) p.recipes = pd.recipes;
    if (pd.kinds) p.kinds = pd.kinds;
    if (pd.equip) p.equip = { head: null, body: null, legs: null, feet: null, ...pd.equip };
    if (pd.look) p.baseLook = pd.look;
    p.awakeSince = pd.awake;
    this.applyHero();
    p.recalcMaxHp();
    p.hp = Math.max(1, Math.min(p.maxHp, p.hp));
    if (d.stats) this.stats = d.stats;
    this.wanted = new Map(d.wanted || []);
    this.sim.rep = new Map(d.rep || []);
    this.sim.citizen = d.citizen || null;
    this.sim.renown = new Map(d.renown || []);
    this.sim.areaCache = new Map();
    this.sim.justice.load(d.justice);
    this.sim.careers.load(d.careers);
    this.sim.favors.load(d.favors);
    // Their own map: where they'd been (or, kept from before each had their
    // own, the host's, which was everyone's then).
    const ow = this.world.ow;
    ow.explored = new Uint8Array(ow.explored.length);
    if (d.explored) ow.unpackExplored(d.explored);
    else if (this.seats && this.seats[0] && this.seats[0].store && this.seats[0].store.o) ow.explored.set(this.seats[0].store.o.explored);
    ow.exploredN = ow.explored.reduce((n, v) => n + v, 0);
    ow.pins = d.pins || [];
    if (this.sim.bandits) {
      this.sim.bandits.heads = { ...(d.heads || {}) };
      this.sim.bandits.headNames = { ...(d.headNames || {}) };
    }
    if (this.sim.war) this.sim.war.deserters = { ...(d.deserters || {}) };
  }

  // A player's character in this world, to keep (in the world's save, and
  // for when they come back).
  seatSave(seat) {
    return asSeat(this, seat, () => {
      const p = this.player;
      // (Down an old place: kept as come back up out of it.)
      const at = this.dungeon ? this.dungeon.exitSpot() : p;
      return {
        profile: seat.profile,
        name: this.playerName,
        hero: this.hero || null,
        player: { x: at.x, y: at.y, z: at.z, hp: p.hp, awake: p.awakeSince, inv: p.inv, selected: p.selected, spawn: p.spawn, vigor: p.vigor, blue: p.blue, buffs: p.buffs || [], recipes: p.recipes || [], kinds: p.kinds || [], equip: p.equip, look: p.baseLook },
        stats: this.stats,
        wanted: [...this.wanted],
        rep: [...this.sim.rep],
        citizen: this.sim.citizen,
        renown: [...this.sim.renown],
        justice: this.sim.justice.serialize(),
        careers: this.sim.careers.serialize(),
        favors: this.sim.favors.serialize(),
        // (Their own map, and the heads of bandits they've brought down.)
        heads: this.sim.bandits ? this.sim.bandits.heads : {},
        headNames: this.sim.bandits ? this.sim.bandits.headNames || {} : {},
        deserters: this.sim.war ? this.sim.war.deserters || {} : {},
        explored: this.world.ow.packExplored(),
        pins: this.world.ow.pins || [],
        at: Date.now(),
      };
    });
  }

  // Someone leaves: their character kept for next time, and gone from the
  // world till then.
  removeSeat(seat) {
    if (!this.seats || seat === this.seat || !this.seats.includes(seat)) return;
    // (Gone from an old place too: up out of it, and it's closed if they
    // were the last down there.)
    asSeat(this, seat, () => {
      if (this.dungeon) this.dungeon.leave();
      // (Round 78) Gone mid-way on the coach or the ferry: kept as set
      // down at the far end.
      if (this.player._ride) rideEnd(this, this.player, 'there');
    });
    this.partyChars.set(seat.id, this.seatSave(seat));
    const p = seat.ent;
    asSeat(this, seat, () => {
      this.stopPlayerActions?.();
      this.ui.closeAll?.();
    });
    if (p) {
      this.removeOcc(p);
      if (p.mount && p.mount.creature) p.mount = null;
    }
    this.seats = this.seats.filter((q) => q !== seat);
  }

  // The others in your guild, where they are and how (see guilds.js).
  guildMates() {
    return guildMates(this);
  }

  // Every player in the world (the host's own first).
  everyone() {
    return partyPlayers(this);
  }

  // (Round 62) A mod's creature's turn, and a blow landed with a mod's
  // weapon (or by one of a mod's creatures): see mod/hooks.js.
  // ------------------------------------------------------------ other worlds
  // (Round 65) Someone sent to another of a mod's world maps (a world of its
  // own, made the first time anyone goes there, kept after: see main.js),
  // or back to the world it all began as (`map` null). A player goes, with
  // everything they are and carry; a creature is sent ahead, to be there
  // when someone next arrives. Not in a world played with others.
  requestCross(req) {
    if (this.remoteCopy || (this.seats && this.seats.length > 1)) {
      this.ui?.msg?.('No crossing to another world while others are playing in this one.', '#ffb080');
      return false;
    }
    const same = (a, b) => (!a && !b) || (a && b && a.mod === b.mod && a.id === b.id);
    if (same(req.map, this.worldMap)) {
      if (req.at && req.who === this.player) this.teleportPlayer(req.at.x, req.at.y, req.at.z);
      return false;
    }
    const out = { map: req.map || null, at: req.at || null, player: null, creatures: [] };
    if (req.who && req.who.kind === 'player') {
      out.player = this.crossSnapshot();
      // (Those at their heel go with them.)
      for (const c of this.creatures) if (!c.dead && c.petOf === req.who) out.creatures.push(creatureSnap(c));
    } else if (req.who && req.who.kind === 'creature' && !req.who.dead) {
      out.creatures.push(creatureSnap(req.who));
      // (Gone from here, no death about it: a shimmer where it stood.)
      this.renderer?.emit?.(req.who.x, req.who.y + 1, req.who.z, { n: 18, color: ['#c8a0ff', '#ffffff'], up: 40, speed: 30, life: 0.8, glow: true });
      req.who.dead = true;
    } else return false;
    if (this.onCross) this.onCross(out);
    else this.crossing = out;
    return true;
  }

  // A player as they are, to arrive in another world with.
  crossSnapshot() {
    const p = this.player;
    const keep = (v) => JSON.parse(JSON.stringify(v ?? null));
    return {
      name: this.playerName, hero: keep(this.hero), hp: p.hp, inv: keep(p.inv), selected: p.selected, equip: keep(p.equip), buffs: keep(p.buffs || []),
      recipes: keep(p.recipes || []), kinds: keep(p.kinds || []), look: keep(p.baseLook), vigor: keep(p.vigor), blue: keep(p.blue), stats: keep(this.stats),
    };
  }

  // Arrived from another world: who you were there, here (at `at`, or
  // where new characters begin), and anyone who came with you.
  applyArrival(a) {
    const p = this.player;
    const s = a.player;
    if (s) {
      if (s.name) this.playerName = s.name;
      if (s.hero) this.hero = s.hero;
      if (Array.isArray(s.inv)) for (let i = 0; i < p.inv.length; i++) p.inv[i] = s.inv[i] || null;
      if (Number.isInteger(s.selected)) p.selected = s.selected;
      if (s.equip) p.equip = { ...p.equip, ...s.equip };
      if (s.buffs) p.buffs = s.buffs;
      if (s.recipes) p.recipes = s.recipes;
      if (s.kinds) p.kinds = s.kinds;
      if (s.look) p.baseLook = s.look;
      if (s.vigor) p.vigor = s.vigor;
      if (s.blue) p.blue = s.blue;
      if (s.stats) this.stats = { ...this.stats, ...s.stats };
      this.refreshBonus?.();
      p.recalcMaxHp?.();
      if (typeof s.hp === 'number') p.hp = Math.max(1, Math.min(p.maxHp, s.hp));
    }
    if (a.at) {
      const y = this.world.findStandY(Math.round(a.at.x), Math.round(a.at.z), a.at.y ?? p.y);
      const spot = this.findFreeSpot(Math.round(a.at.x), Math.round(a.at.z), y > 0 ? y : p.y);
      if (spot) this.teleportPlayer(spot.x, spot.y, spot.z);
    }
    for (const c of a.creatures || []) {
      const spot = this.findFreeSpot(p.x + 1 + Math.floor(Math.random() * 3), p.z + 1, p.y);
      const e = spot ? this.spawnMonster(c.species, spot.x, spot.y, spot.z) : null;
      if (!e) continue;
      if (typeof c.hp === 'number') e.hp = Math.max(1, Math.min(e.maxHp, c.hp));
      if (c.modVars) e.modVars = c.modVars;
      if (c.pet && s) e.petOf = p;
    }
  }

  // (Round 64) A mod's weapon swung or shot; a blow taken on a mod's shield.
  modSwing(p, shot) {
    if (MODS.active.length) modSwung(this, p, shot);
  }

  modBlocked(v, a) {
    if (MODS.active.length) modBlockedBlow(this, v, a);
  }

  modBrainOf(c, dt) {
    return modBrain(c, dt);
  }

  onModStruck(a, v, amount) {
    if (MODS.active.length) modStruck(this, a, v, amount);
  }

  // ------------------------------------------------------------ old places
  // The old place `rec`, as it's being played (someone already down it), or
  // fresh for going down.
  runFor(rec) {
    return this.runs.get(rec.id) || new DungeonRun(this, rec);
  }

  // The old place open where x is (in its own space apart), if any.
  runAt(x) {
    if (x === undefined || !this.world.inInstance(x)) return null;
    for (const run of this.runs.values()) if (run.has(x)) return run;
    return null;
  }

  // Those up on the island (not down an old place).
  upTop() {
    return this.everyone().filter((q) => !this.world.inInstance(q.x));
  }

  // Do `fn` there: down old place `run` (as one of those down there), or
  // up on the island (null: as one of those up there). (So what the place
  // does, the beasts in it and its traps, goes on as someone who's in it.)
  inPlace(run, fn) {
    let lead = null;
    if (run) lead = run.lead();
    else if (this.dungeon) lead = this.upTop()[0] || null;
    return lead && lead !== this.player ? this.asPlayer(lead, fn) : fn();
  }

  // Each old place someone's down, its own goings-on (as one of them; one
  // with nobody left in it is closed).
  updateRuns(dt) {
    for (const run of [...this.runs.values()]) {
      const lead = run.lead();
      if (!lead) {
        run.close();
        continue;
      }
      this.asPlayer(lead, () => run.update(dt));
    }
  }

  // Nobody left up on the island (the last of you gone down): what was
  // about you up there is put by, to wait where it was (see raiseIsland).
  putByIsland() {
    if (this.islandStash || this.upTop().some((q) => q !== this.player)) return;
    const up = (e) => !this.world.inInstance(e.x);
    const creatures = this.creatures.filter(up);
    for (const c of creatures) this.removeOcc(c);
    this.islandStash = { creatures, drops: this.drops.filter(up) };
    this.creatures = this.creatures.filter((c) => !up(c));
    this.drops = this.drops.filter((d) => !up(d));
    // (Blows on their way up there: gone.)
    const at = (q) => (q.tiles && q.tiles[0] ? q.tiles[0].x : q.x0 ?? q.x ?? 0);
    for (const k of ['projectiles', 'orbs', 'hazards']) if (Array.isArray(this[k])) this[k] = this[k].filter((q) => this.world.inInstance(at(q)));
  }

  // The first of you back up: what was put by comes back.
  raiseIsland() {
    const st = this.islandStash;
    if (!st) return;
    this.islandStash = null;
    const back = st.creatures.filter((c) => !c.dead);
    for (const c of back) this.moveEntity(c, c.x, c.y, c.z);
    this.creatures.push(...back);
    this.drops.push(...st.drops.filter((d) => !d.dead));
  }

  // Do `fn` as the player `p` is (or as whoever it is now, for anyone else).
  asPlayer(p, fn) {
    return p && p.seat && this.seats ? asSeat(this, p.seat, fn) : fn();
  }

  // Busy in your pack or a chest: an old place's own traps hold off (see
  // dungeon.js and monsters.fireHazard); what lives there doesn't.
  rummaging(p = this.player) {
    return this.asPlayer(p, () => {
      const ui = this.ui;
      return !!(ui && ui.find && (ui.find('inventory') || ui.find('container')));
    });
  }

  // Any player within `r` paces of `e`?
  nearPlayer(e, r) {
    for (const q of this.everyone()) if (Math.max(Math.abs(q.x - e.x), Math.abs(q.z - e.z)) < r) return true;
    return false;
  }

  // The player nearest (x, z), and how far.
  closestPlayer(x, z) {
    let best = null;
    let bd = Infinity;
    for (const q of this.everyone()) {
      const d = Math.hypot(q.x - x, q.z - z);
      if (d < bd) {
        best = q;
        bd = d;
      }
    }
    return { p: best || this.player, d: bd };
  }

  // ------------------------------------------------------------ keys
  handleKeys(pressed, wheel) {
    const p = this.player;
    for (const k of pressed) {
      const code = k.code;
      if (this.cutscene && !this.cutscene.allowKey(code)) continue;
      if (code.startsWith('Digit')) {
        const n = parseInt(code.slice(5), 10);
        if (n >= 1 && n <= BELT_SIZE) this.selectSlot(n - 1);
      }
      switch (code) {
        // Q and E turn the camera a quarter turn either way.
        case 'KeyQ':
        case 'KeyE':
          if (holdTurnKey(this, code === 'KeyQ' ? -1 : 1)) this.audio?.play('select');
          else if (this.renderer.turn) {
            this.renderer.turn(code === 'KeyQ' ? -1 : 1);
            this.mining = null;
            this.audio?.play('select');
          }
          break;
        case 'KeyG':
          this.toss(k.ctrl);
          break;
        case 'KeyT':
          // (Round 78) Riding the coach or the ferry: hurry the hours on.
          if (p._ride) rideHurry(this, p);
          // Sitting down: let some hours go by.
          else if (p.sitting && !this.waiting) this.ui.openWait?.();
          else if (!p.sitting) this.ui.msg('Sit down somewhere first (a chair, bench or stool) to wait.', '#c8c8c8', true);
          break;
        case 'KeyR':
          if (shipKey(this, 'KeyR')) break;
          p.rot = (p.rot + 1) % 4;
          this.audio?.play('select');
          break;
        case 'KeyZ':
          p.layerMode = p.layerMode === null ? 0 : Math.max(-3, p.layerMode - 1);
          this.ui.msg(`Layer: ${this.layerLabel()}`, '#a0c8ff');
          break;
        case 'KeyX':
          p.layerMode = p.layerMode === null ? 0 : Math.min(3, p.layerMode + 1);
          this.ui.msg(`Layer: ${this.layerLabel()}`, '#a0c8ff');
          break;
        case 'KeyV':
          p.layerMode = null;
          this.ui.msg('Layer: AUTO', '#a0c8ff');
          break;
        case 'Space':
          if (this.fishing) hook(this);
          else roll(this, p, this.heldMove());
          break;
        case 'KeyF':
          if (this.cutscene) this.interactFront();
          else if (p.raft) this.leaveRaft();
          else if (shipKey(this, 'KeyF')) break;
          else if (p.heldDef()?.kind === 'food') this.eat();
          else if (p.heldDef()?.kind === 'potion') this.drink();
          else if (p.heldDef()?.newspaper) this.ui.openNews?.();
          else if (p.heldDef()?.kind === 'armor') this.wearHeld();
          else if (this.useHeldThing()) break;
          else this.interactFront();
          break;
      }
    }
    // The wheel turns the belt, shift held or not. (The layer you build on
    // is Z, X and V.)
    if (wheel && shipWheel(this, wheel)) return;
    // (Round 78) The copy box's top raised or lowered (its bottom, with
    // Shift held).
    if (wheel && p.copyBox && p.heldDef()?.blueprint && boxWheel(this, p, wheel)) return;
    if (wheel) this.selectSlot((p.selected + Math.sign(wheel) + BELT_SIZE) % BELT_SIZE);
  }

  layerLabel() {
    const m = this.player.layerMode;
    if (m === null) return 'AUTO';
    return `${m >= 0 ? '+' : ''}${m} (y${this.player.y + m})`;
  }

  selectSlot(i) {
    if (this.player.selected !== i) this.audio?.play('select');
    this.player.selected = i;
    this.mining = null;
  }

  // ------------------------------------------------------------ cursor
  updateCursor(input) {
    const p = this.player;
    const r = this.renderer;
    if (!input.mouse.inside) {
      this.cursor = null;
      return;
    }
    if (this.ui.hitTest(input.mouse.x, input.mouse.y)) {
      this.cursor = null;
      return;
    }
    const w = this.world;
    // The renderer notes the last thing it drew under the pointer, which is
    // exactly what you see there: props by their actual pixels, a person
    // in front of a wall, and never a block faded out to show you through it.
    const drawn = r.pick !== undefined;
    // (The world's picture may be drawn back, bigger than the view: the
    // pointer in its own pixels.)
    const zk = r.zoomK || 1;
    const mx = input.mouse.x * zk;
    const my = input.mouse.y * zk;
    r.mouse = { x: mx, y: my };
    let hit = null;
    if (p.layerMode !== null) {
      // The layer locked (Z/X): that height, in the column you point at as
      // you see it (not a tile the height's own plane happens to cross
      // there, half a block off).
      const L = p.y + p.layerMode;
      let col = null;
      if (r.underground && r.hidden) col = this.pickPlan(mx, my, drawn ? r.pick : null);
      else if (drawn && r.pick && w.getBlock(r.pick.x, r.pick.y, r.pick.z) === r.pick.id) col = r.pick;
      else if (!drawn || r.pick) col = this.pickGeometric(mx, my);
      const t = col || r.screenToTile(mx, my, L);
      hit = { x: t.x, y: L, z: t.z, face: 'top', id: w.getBlock(t.x, L, t.z), fixed: true };
    } else if (r.underground && r.hidden) {
      hit = this.pickPlan(mx, my, drawn ? r.pick : null);
    } else if (drawn && r.pick && (r.pick.ghost || w.getBlock(r.pick.x, r.pick.y, r.pick.z) === r.pick.id)) {
      // (Round 78: a planned block, see-through, picked as itself.)
      hit = { ...r.pick };
    } else if (!drawn || r.pick) hit = this.pickGeometric(mx, my);
    // Someone under the cursor, if they were drawn over the block there.
    let ent = null;
    if (drawn) {
      const pe = r.pickEnt;
      if (pe && !pe.e.dead && this.visibleEntities.includes(pe.e) && (!r.pick || pe.seq > r.pick.seq)) ent = { e: pe.e, up: pe.up, part: pe.part };
    } else {
      for (const e of this.visibleEntities) {
        if (e === p || e.kind === 'item' || e.kind === 'prop' || e.dead) continue;
        const rp = e.renderPos();
        const { x: sx, y: sy } = r.worldToScreen ? r.worldToScreen(rp.x, rp.y, rp.z) : { x: rp.x * TILE - r.camX, y: rp.z * TILE - rp.y * LH - r.camY };
        const feet = sy + LH + 10;
        const h = e.kind === 'creature' ? 14 : 24;
        if (mx >= sx + 2 && mx < sx + 14 && my >= feet - h && my < feet + 2) {
          if (!ent || rp.z > ent.rp.z) ent = { e, rp, up: (feet - my) / h };
        }
      }
    }
    const reach = (x, y, z) => Math.max(Math.abs(x - p.x), Math.abs(z - p.z)) <= REACH && Math.abs(y - p.y) <= 4;
    const c = { mx, my };
    if (ent) {
      c.entity = ent.e;
      // (How far up them the pointer is: 1 at the top of the head.)
      c.entUp = ent.up ?? 0.5;
      // (Which part of it: a wagon's bench, or its back.)
      if (ent.part) c.part = ent.part;
      c.inReach = inReach(p, ent.e, this.attackReach());
    }
    if (hit) {
      c.x = hit.x;
      c.y = hit.y;
      c.z = hit.z;
      c.face = hit.face;
      const b = BLOCKS[hit.id];
      c.block = hit.id !== B.air ? b : null;
      c.empty = hit.id === B.air;
      c.ghost = !!hit.ghost;
      if (!c.inReach) c.inReach = reach(hit.x, hit.y, hit.z);
      // Placement target.
      const held = p.heldDef();
      const placeId = held ? (held.kind === 'block' ? held.block : held.plant ?? null) : null;
      c.plan = !!hit.plan;
      if (placeId !== null && placeId !== undefined && !ent && !hit.wall) {
        let t;
        const hang = !!BLOCKS[placeId]?.onWall;
        const wallish = (q) => q && q.solid && (q.render === 'cube' || q.render === 'wall');
        if (hit.fixed || (b.replaceable && hit.id !== B.air) || hit.id === B.air) t = { x: hit.x, y: hit.y, z: hit.z };
        else if (hang && wallish(b) && hit.face === 'top') {
          // (Round 74: a painting pointed at a wall's top goes on its face,
          // the side toward you, just under where you pointed.)
          const [fx, fz] = r.toWorld ? r.toWorld(0, 1) : [0, 1];
          t = { x: hit.x + fx, y: hit.y, z: hit.z + fz, wall: { x: hit.x, z: hit.z } };
        } else if (hit.face === 'top') t = { x: hit.x, y: hit.y + 1, z: hit.z };
        else {
          // In front of the face you're pointing at (towards the camera).
          const [fx, fz] = r.toWorld ? r.toWorld(0, 1) : [0, 1];
          t = { x: hit.x + fx, y: hit.y, z: hit.z + fz };
          if (hang && wallish(b)) t.wall = { x: hit.x, z: hit.z };
        }
        // (Round 78) A blueprint in your off hand: onto the plan instead,
        // nothing in the way of it but a block, or another planned one.
        const draft = isBlueprint(p.equip && p.equip.shield);
        const why = !reach(t.x, t.y, t.z) ? 'too far' : draft ? ghostProblem(this, t.x, t.y, t.z) : this.placeProblem(placeId, t.x, t.y, t.z);
        const ok = !why;
        if (draft) t.ghost = true;
        // Seeds and carrots only offer to plant where they can grow.
        if (ok || held.kind === 'block') c.place = { ...t, id: placeId, rot: p.rot, ok, why };
      }
    }
    // (A ship's planks, drawn in front of what's behind them.)
    shipCursor(this, c, r);
    this.cursor = c;
  }

  // Down in the ground the view's a plan at your feet (see the renderer's
  // drawDigView): the pointer's on a tile of your own floor. Rock there
  // at your feet is the wall you'd dig (nothing set against it); a step
  // up, its top (what you'd set goes on it); anything set on the floor
  // (a torch, a chest), that; else the floor itself (what you'd set
  // stands on it, level with you).
  pickPlan(mx, my, pick) {
    const r = this.renderer;
    const w = this.world;
    const L = r.hiddenLevel - 1;
    const t = r.screenToTile(mx, my, L - 1);
    if (!r.hidden.has(t.x * 65536 + t.z)) return this.pickGeometric(mx, my);
    if (pick && pick.prop && pick.y === L && w.getBlock(pick.x, pick.y, pick.z) === pick.id) return { ...pick, plan: true };
    const id = w.getBlock(t.x, L, t.z);
    const b = BLOCKS[id];
    if (b.render === 'cube' && b.solid) {
      const step = !BLOCKS[w.getBlock(t.x, L + 1, t.z)].solid && !BLOCKS[w.getBlock(t.x, L + 2, t.z)].solid;
      return { x: t.x, y: L, z: t.z, face: 'top', id, plan: true, wall: !step };
    }
    if (id !== B.air && !b.replaceable) return { x: t.x, y: L, z: t.z, face: 'top', id, plan: true };
    // (Open: the floor under it, or the hole where it drops away.)
    const fid = w.getBlock(t.x, L - 1, t.z);
    return { x: t.x, y: L - 1, z: t.z, face: 'top', id: fid, plan: true };
  }

  // What the geometry says is under the pointer (used before the first
  // frame is drawn, and when the world changed since): the front-most top
  // or front face, in the order the renderer paints them.
  pickGeometric(mx, my) {
    const r = this.renderer;
    const w = this.world;
    const p = this.player;
    const toW = (u, v) => (r.toWorld ? r.toWorld(u, v) : [u, v]);
    const wx = mx + r.camX;
    const wy = my + r.camY;
    const u = Math.floor(wx / TILE);
    let best = null;
    let bestKey = -Infinity;
    for (let y = WORLD_Y - 1; y >= 0; y--) {
      const vt = Math.floor((wy + y * LH) / TILE);
      const vf = Math.floor((wy + y * LH - 16) / TILE);
      const frontIn = wy + y * LH - 16 - vf * TILE < LH;
      for (const [v, face] of [[vt, 'top'], ...(frontIn ? [[vf, 'front']] : [])]) {
        const [x, z] = toW(u, v);
        const id = w.getBlock(x, y, z);
        if (id === B.air || r.isHidden(x, y, z)) continue;
        if (r.occlusionAlpha(x, y, z, p) < 0.6) continue;
        const k = v * 64 + y + (face === 'front' ? 0.5 : 0);
        if (k > bestKey) {
          bestKey = k;
          best = { x, y, z, face, id };
        }
      }
    }
    return best;
  }

  // Why a block can't go at (x, y, z), or null if it can.
  placeProblem(id, x, y, z) {
    const w = this.world;
    if (y < 1 || y >= WORLD_Y - 1) return 'out of the world';
    const cur = BLOCKS[w.getBlock(x, y, z)];
    if (!(cur.replaceable || cur.id === B.air)) return 'something is there';
    const b = BLOCKS[id];
    if (b.solid && this.occupiedAny(x, y, z) && !this.jumpPlace(id, x, y, z)) return this.selfAt(x, y, z) ? 'no room over your head to jump up' : 'someone is standing there';
    if (!this.canPlace(id, x, y, z)) {
      if (CROPS[id]) return 'needs farmland';
      if (b.onWall) return 'needs a wall to hang on';
      if (b.support) return 'needs something under it';
      return 'no room';
    }
    return null;
  }

  // What your clothes, set gems and potions add to your abilities (and the
  // health that goes with endurance). Called when any of them change.
  refreshBonus() {
    const p = this.player;
    if (!p) return;
    // (Without a made character, base abilities, so bonuses still count.)
    if (!this.hero) this.hero = { stats: {}, specialties: [], traits: [], anon: true };
    const b = { str: 0, agi: 0, end: 0, cha: 0 };
    const add = (stats) => {
      for (const [k, n] of Object.entries(stats || {})) b[k] = (b[k] || 0) + n;
    };
    for (const slot of ['head', 'body', 'legs', 'feet']) add(ITEMS[p.equip[slot]]?.stats);
    const held = p.heldDef();
    if (held && held.kind !== 'armor') add(held.stats);
    const now = this.day * DAY_MINUTES + this.minute;
    p.buffs = (p.buffs || []).filter((q) => q.until > now);
    for (const q of p.buffs) if (q.stat) b[q.stat] = (b[q.stat] || 0) + q.n;
    // (And a dish's, while its condition holds: see cooking.js.)
    for (const k of ['str', 'agi', 'end', 'cha']) b[k] += dishFx(p, k);
    const before = JSON.stringify(this.hero.bonus || {});
    this.hero.bonus = b;
    if (before !== JSON.stringify(b)) {
      p.hpBonus = hpBonus(this.hero);
      p.recalcMaxHp();
      this.sim.areaCache.clear();
    }
  }

  // A jeweller sets a stone: the piece (in the pack, or worn) becomes the
  // same piece with the gem in it.
  setGem(ref, gem) {
    const p = this.player;
    if (countItem(p.inv, gem) <= 0) return false;
    const key = ref.kind === 'inv' ? p.inv[ref.i]?.item : p.equip[ref.slot];
    if (!key || !ITEMS[socketed(key, gem)]) return false;
    removeItem(p.inv, gem, 1);
    if (ref.kind === 'inv') p.inv[ref.i] = { item: socketed(key, gem), count: 1 };
    else p.equip[ref.slot] = socketed(key, gem);
    this.refreshBonus();
    this.audio?.play('coin');
    this.ui.msg(`${ITEMS[socketed(key, gem)].name}: the stone is set.`, '#c0a0ff');
    return true;
  }

  // Cooking at a campfire, a pot, an oven or a table (see ui/cook.js).
  openCooking(st, x, y, z) {
    const w = this.world;
    const fire = st === 'c';
    this.ui.closeAll();
    this.ui.open(new CookWindow(this.ui, this, {
      st,
      at: { x, y, z },
      lit: fire ? !!w.getState(x, y, z) : true,
      onFire: (on) => {
        if (!fire) return;
        w.setState(x, y, z, on);
        this.audio?.play('torch');
        if (on) this.renderer.emit(x, y, z, { n: 6, color: ['#ffb040', '#ffe070'], up: 30, life: 0.5, oy: -8 });
        this.lightDirty = true;
      },
    }));
  }

  // Drink a potion (or put on a salve) from the hand.
  drink() {
    const p = this.player;
    const slot = p.inv[p.selected];
    const d = slot && ITEMS[slot.item];
    if (!d || d.kind !== 'potion') return false;
    const e = d.effect || {};
    const now = this.day * DAY_MINUTES + this.minute;
    if (e.heal) {
      if (p.hp >= p.maxHp) {
        this.ui.msg('You\'re not hurt.', '#c8c8c8', true);
        return false;
      }
      p.hp = Math.min(p.maxHp, p.hp + e.heal);
    }
    if (e.blue) {
      p.blueSip = (p.blueSip || 0) + 1;
      // (A draught can take you past what wells and beds give: up to ten.)
      const got = p.addBlue(e.blue, `potion:${this.day}:${p.blueSip}`, 10);
      if (!got) {
        this.ui.msg('You can\'t hold any more vigour today.', '#c8c8c8', true);
        return false;
      }
    }
    if (e.stat) {
      p.buffs = (p.buffs || []).filter((q) => q.stat !== e.stat || q.until <= now);
      p.buffs.push({ stat: e.stat, n: e.n, until: now + e.hours * 60, name: d.name, item: slot.item });
    }
    // For a fight (see combat.buffOf).
    if (e.combat) {
      p.buffs = (p.buffs || []).filter((q) => q.combat !== e.combat || q.until <= now);
      p.buffs.push({ combat: e.combat, n: e.n, until: now + e.hours * 60, name: d.name, item: slot.item });
      if (e.combat === 'breath') p.stamina = (p.stamina || 0) + e.n;
    }
    // (Fogsight: the dark goes grey and clear; see lighting.js.)
    if (e.sight) {
      p.buffs = (p.buffs || []).filter((q) => !q.sight || q.until <= now);
      p.buffs.push({ sight: true, until: now + e.hours * 60, name: d.name, item: slot.item });
    }
    removeItem(p.inv, slot.item, 1);
    this.refreshBonus();
    this.audio?.play('gulp');
    this.renderer.emit(p.x, p.y + 1, p.z, { n: 10, color: ['#e8e0ff', '#a0c8ff', '#fff4c0'], up: 25, life: 0.7, gravity: -15 });
    const what = e.sight ? `you see in the dark for ${e.hours} hours` : e.stat ? `${{ str: 'Strength', agi: 'Agility', end: 'Endurance', cha: 'Charisma' }[e.stat]} +${e.n} for ${e.hours} hours` : e.combat ? `${combatBuffText(e)} for ${e.hours} hours` : e.blue ? `+${e.blue} blue health until the day ends` : `+${e.heal} health`;
    this.ui.msg(`${d.name}: ${what}.`, '#c0a0ff');
    return true;
  }

  attackReach() {
    const h = this.player.heldDef();
    if (h && h.ranged) return h.range;
    return Math.max(1, Math.floor(h && h.reach ? h.reach : 1.4));
  }

  // ------------------------------------------------------------ mouse
  handleMouse(dt, clicks, input) {
    const p = this.player;
    const c = this.cursor;
    // On board ship (the opening): only talk (to whoever you point at).
    if (this.cutscene) {
      for (const ck of clicks) if (ck.type === 'down' && ck.button === 2 && c && c.entity && c.entity.kind === 'crew' && c.entity.distTo(p) <= 4) this.cutscene.talk(c.entity);
      this.mining = null;
      return;
    }
    // (Round 68) At a ship's wheel or one of her guns, or pointing at her
    // planks: hers to handle.
    if (shipMouse(this, dt, clicks, input)) return;
    // Reeling in a fish: the mouse button pulls the line, nothing else.
    if (this.fishing && this.fishing.phase === 'reel') {
      this.mining = null;
      this.pending = null;
      return;
    }
    // Holding the button on a foe winds up a heavy blow; let go to strike
    // (a quick click is an ordinary one).
    const ch = this.charging;
    if (ch) {
      ch.t += dt;
      if (ch.t >= 0.45 && !ch.ready) {
        ch.ready = true;
        this.audio?.play('select');
      }
      if (!input.mouse.down || ch.target.dead) {
        this.charging = null;
        if (!ch.target.dead) this.attack(ch.target, ch.ready);
      }
    }
    for (const ck of clicks) {
      if (ck.type === 'down' && ck.button === 0) {
        // A bow (sling, crossbow) in hand: hold to draw, aim with the mouse,
        // let go to loose; a javelin's thrown where you aim. (A door or a
        // chest still opens with a click.)
        const rd = p.heldDef();
        if (rd && rd.ranged) {
          if (c && !c.entity && c.block && c.block.interact && c.inReach) this.pending = { x: c.x, y: c.y, z: c.z, t: 0 };
          else if (drawable(rd)) beginDraw(this);
          else throwAimed(this);
          continue;
        }
        if (c && c.entity) {
          const melee = !(p.heldDef() && p.heldDef().ranged) && c.entity.kind !== 'prop';
          if (melee && p.attackCd <= 0) this.charging = { target: c.entity, t: 0, ready: false };
          else this.attack(c.entity);
          this.pending = null;
          continue;
        }
        const held = p.heldDef();
        // (Round 78) A blueprint in hand with its copy box out: the box's
        // corners set, or one of its sides dragged.
        if (p.copyBox && held && held.blueprint) {
          boxPress(this, p, c);
          this.pending = null;
          continue;
        }
        if (c && c.place && held && (held.kind === 'block' || held.plant) && !(c.block && c.block.interact && !c.ghost)) {
          this.tryPlace(c.place);
          this.placeRepeat = 0.25;
          this.pending = null;
          continue;
        }
        // A planned block, struck: off the plan.
        if (c && c.ghost && (!held || held.kind !== 'weapon')) {
          removeGhost(this, c.x, c.y, c.z);
          this.pending = null;
          continue;
        }
        // A weapon in hand doesn't dig: it swings, at whatever's in front
        // of you (doors and chests still open with a click).
        if (held && held.kind === 'weapon') {
          if (c && c.block && c.block.interact && c.inReach) this.pending = { x: c.x, y: c.y, z: c.z, t: 0 };
          else this.swingAt();
          continue;
        }
        if (c && c.block && c.inReach) this.pending = { x: c.x, y: c.y, z: c.z, t: 0 };
        else if (!c || !c.block) this.swing();
      } else if (ck.type === 'up' && ck.button === 0) {
        if (p.copyBox) p.copyBox.drag = null;
        if (this.pending && this.pending.t < 0.25 && c && c.block && c.block.interact && c.x === this.pending.x && c.y === this.pending.y && c.z === this.pending.z) {
          this.interact(c.x, c.y, c.z);
        }
        this.pending = null;
        this.mining = null;
        if (p.bowDraw) releaseDraw(this);
      } else if (ck.type === 'down' && ck.button === 2) {
        // (Drawn, and thought better of it: let down.)
        if (p.bowDraw) {
          cancelDraw(this);
          continue;
        }
        this.rightClick();
      }
    }
    // (Round 78) A side of the copy box being dragged.
    if (p.copyBox && p.copyBox.drag && input.mouse.down) {
      boxDrag(this, p, c);
      return;
    }
    // Holding the mouse: mine (tool/empty hand) or keep placing blocks.
    if (input.mouse.down && c) {
      const held = p.heldDef();
      if (this.pending) this.pending.t += dt;
      if (held && (held.kind === 'block' || held.plant) && c.place && !this.pending) {
        this.placeRepeat -= dt;
        if (this.placeRepeat <= 0 && c.place.ok) {
          this.tryPlace(c.place);
          this.placeRepeat = 0.22;
        }
      } else if (c.block && !c.ghost && c.inReach && !(held && held.kind === 'weapon') && !p.bowDraw && (!c.block.interact || !this.pending || this.pending.t >= 0.25)) {
        this.mineTick(dt, c);
      } else this.mining = null;
    } else {
      this.mining = null;
      if (this.pending && !input.mouse.down) this.pending = null;
    }
  }

  // A stick of dynamite from your hand to where you point (two to eight
  // paces off): it goes up a moment after it lands (see monsters.js).
  throwDynamite() {
    const p = this.player;
    const c = this.cursor;
    if (p.rollT > 0 || p.swing || p.dead || p.down || p.restrained || p.sleeping) return true;
    let tx;
    let tz;
    if (c && c.entity) [tx, tz] = [c.entity.x, c.entity.z];
    else if (c && c.x !== undefined) [tx, tz] = [c.x, c.z];
    else {
      const [dx, dz] = [[0, 1], [-1, 0], [0, -1], [1, 0]][p.dir] || [0, 1];
      [tx, tz] = [p.x + dx * 4, p.z + dz * 4];
    }
    let d = Math.hypot(tx - p.x, tz - p.z);
    if (d < 2) {
      this.ui.msg('Too close: throw it further off.', '#ffb080', true);
      return true;
    }
    if (d > 8) {
      tx = p.x + Math.round(((tx - p.x) / d) * 8);
      tz = p.z + Math.round(((tz - p.z) / d) * 8);
      d = 8;
    }
    const s = p.inv[p.selected];
    s.count--;
    if (s.count <= 0) p.inv[p.selected] = null;
    p.face(tx, tz);
    strikeAnim(p, STYLES.spear);
    p.doAction(0.3);
    throwDynamite(this, p, Math.round(tx), Math.round(tz));
    this.combatT = Math.max(this.combatT || 0, 2);
    return true;
  }

  rightClick() {
    const p = this.player;
    const c = this.cursor;
    const held = p.heldDef();
    if (this.fishing && this.fishing.phase === 'bite') {
      hook(this);
      return;
    }
    // Someone you're playing with: who they are (see multiplayer.js).
    if (c && c.entity && c.entity.kind === 'player' && c.entity !== p && c.entity.account) {
      if (this.ui.hooks && this.ui.hooks.profile) this.ui.hooks.profile(c.entity.account);
      return;
    }
    // The Kavorent's things: used whatever else is about.
    if (held && held.kind === 'gadget' && useGadget(this, held)) return;
    if (held && held.kind === 'enhancer' && fitEnhancer(this, held)) return;
    if (held && held.kind === 'relic_shard' && fitShard(this, held)) return;
    // Dynamite: lit, and thrown where you point.
    if (held && held.key === 'dynamite' && this.throwDynamite()) return;
    // Armour in hand, pointed at nothing in particular: put on. (Before the
    // guard below: a shield in hand, the Aegis Projector say, went up as a
    // guard instead and could never be put on this way. Round 61.)
    if (held && held.kind === 'armor' && !(c && c.entity) && !(c && c.block && c.block.interact && c.inReach)) {
      this.wearHeld();
      return;
    }
    // In a fight (or with nothing to use it on), the right button raises
    // your guard instead (held: see combat.js).
    if (canBlock(this, p) && (this.combatT > 0 || !c || (!c.entity && !(c.block && c.block.interact && c.inReach)))) return;
    if (c && c.entity && c.entity.kind === 'npc' && c.entity.distTo(p) <= 4) {
      this.talk(c.entity);
      return;
    }
    // (Round 69) A ship's hand: a word (and, your own crew, orders).
    if (c && c.entity && c.entity.kind === 'sailor' && !c.entity.dead && c.entity.distTo(p) <= 4) {
      sailorTalk(this, c.entity);
      return;
    }
    // (Round 62) One of a mod's creatures: talked to (a person), or used.
    if (c && c.entity && c.entity.S && c.entity.S.modKey && !c.entity.dead && c.entity.distTo(p) <= 4 && modTalk(this, p, c.entity)) return;
    // Dice in hand: a throw (on the table there, or one beside you).
    if (held && held.key === 'dice' && throwDice(this)) return;
    // Leads: one on a beast, off it, or tie what you're leading to a post.
    if (c && c.entity && canLead(c.entity) && leadUse(this, c.entity, held ? held.key : null)) return;
    if (c && c.block && c.inReach && isPost(c.block.id) && leading(this).length && tieLeads(this, c.x, c.y, c.z)) return;
    // Horses: tempt, tame, saddle, ride; wagons: drive yours, sit in anyone's.
    if (c && c.entity && c.entity.kind === 'creature' && c.entity.species === 'horse') {
      this.riding.useHorse(c.entity);
      return;
    }
    // (Round 77) Snow shovelled off where it lies (see render/groundfx.js).
    const gfx = this.renderer && this.renderer.gfx;
    if (held && /_shovel$/.test(held.key) && c && c.block && c.inReach && gfx && gfx.depth(c.x, c.z) > 0) {
      gfx.clear(c.x, c.z, 1);
      this.audio?.play('dig', p);
      this.renderer.emit(c.x, c.y, c.z, { n: 6, color: ['#f4f8ff', '#dce8f8'], up: 30, speed: 30, life: 0.5, oy: -4 });
      return;
    }
    // (Round 77) The coach, or the ferry: where it goes.
    if (c && c.entity && c.entity.kind === 'prop' && c.entity.stop) {
      if (c.entity.distTo ? c.entity.distTo(p) > 6 : Math.max(Math.abs(c.entity.x - p.x), Math.abs(c.entity.z - p.z)) > 6) {
        this.ui.msg(c.entity.stop.kind === 'ferry' ? 'Go down to the pier to take the ferry.' : 'Walk over to the coach to take it.', '#a0c8ff');
        return;
      }
      this.ui.open(new TravelWindow(this.ui, c.entity.stop));
      return;
    }
    if (c && c.entity && c.entity.kind === 'prop' && c.entity.type === 'wagon') {
      this.riding.useWagon(c.entity, c.part || 'back');
      return;
    }
    if (held && held.key === 'wagon' && c && c.block && c.inReach && c.face === 'top') {
      this.riding.placeWagon(c.x, c.y + 1, c.z);
      return;
    }
    if (c && c.block && c.inReach && c.block.interact) {
      this.interact(c.x, c.y, c.z);
      return;
    }
    // (Round 78) A blueprint in hand: what's on it, and what to do with it.
    if (held && held.blueprint) {
      openPlanWindow(this, p.selected);
      return;
    }
    // (Round 78) A grappling hook thrown up at a ledge (or let go of).
    if (held && held.grapple && (this.player._grapple || (c && c.block))) {
      throwGrapple(this, c);
      return;
    }
    // Buckets: fill from open water, pour over farmland (or the crops on it).
    if (held && held.key === 'bucket' && c && c.block && c.block.liquid && c.inReach) {
      this.fillBucket(c.x, c.y, c.z);
      return;
    }
    if (held && held.key === 'water_bucket' && c && c.block && c.inReach) {
      const y = isFarmland(c.block.id) ? c.y : CROPS[c.block.id] && isFarmland(this.world.getBlock(c.x, c.y - 1, c.z)) ? c.y - 1 : null;
      if (y !== null) {
        this.waterField(c.x, y, c.z);
        return;
      }
    }
    // A raft goes in the water, and you climb on.
    // (Round 68) A ship of your own to launch, a sailor to sign on.
    if (held && (held.shipKit || held.shipBottle || held.key === 'sailors_articles') && useShipItem(this, held)) return;
    if (held && held.raft && c && c.block && c.block.liquid && c.inReach && !this.player.raft) {
      this.launchRaft(c.x, c.z);
      return;
    }
    if (held && held.fishing && c && c.block && c.block.liquid && c.inReach && this.world.getBlock(c.x, c.y + 1, c.z) === B.air) {
      this.castLine(c);
      return;
    }
    if (held && (held.plain || held.key) === 'hoe' && c && c.block && c.inReach && [B.grass, B.dirt, B.grass_lush, B.grass_dry, B.grass_jungle, B.grass_taiga, B.path].includes(c.block.id) && this.world.getBlock(c.x, c.y + 1, c.z) === B.air) {
      this.world.setBlock(c.x, c.y, c.z, B.farmland);
      if (this.weather && this.weather.kind === 'rain') this.crops.wetten(c.x, c.y, c.z);
      this.audio?.play('dig');
      return;
    }
    if (held && held.kind === 'food') {
      this.eat();
      return;
    }
    if (held && this.useHeldThing()) return;
    if (held && held.kind === 'potion') {
      this.drink();
      return;
    }
    if (held && held.newspaper && !(c && c.entity)) {
      this.ui.openNews?.();
      return;
    }
    if (held && held.kind === 'armor') {
      this.wearHeld();
      return;
    }
    if (c && c.place && c.place.ok) this.tryPlace(c.place);
  }

  // (Round 51) Things in the hand that are used where you stand: an
  // instrument played (see ui/instrument.js), a pipe smoked, a recipe on a
  // scroll read, a blank scroll written on. True if it was one.
  useHeldThing() {
    const p = this.player;
    const d = p.heldDef();
    if (!d || p.dead) return false;
    // (A story's letter, note or map: see sim/saga.)
    if (d.kind === 'note') {
      if (!this.sim.saga || !this.sim.saga.read(d.key)) this.ui.msg('The ink has run. You can\'t make out a word of it.', '#c8c8c8');
      return true;
    }
    if (d.kind === 'recipe') {
      const r = learnRecipe(p, d.recipe);
      const dish = ITEMS[d.recipe];
      if (r === 'new') this.ui.msg(`You learn to make ${dish.name}. It's in your recipes now (at the ${{ c: 'campfire', p: 'furnace', o: 'oven', t: 'table' }[dish.dish.st]}).`, '#ffd890');
      else this.ui.msg(`You know how to make ${dish.name} already.`, '#c8c8c8');
      this.audio?.play('etch');
      return true;
    }
    if (d.key === 'scroll') {
      if (!(p.recipes || []).length) {
        this.ui.msg('A blank scroll. Once you know a recipe (cook something good and write it down), you can copy it onto one.', '#c8c8c8');
        return true;
      }
      this.ui.open(new RecipeScrollWindow(this.ui, this));
      return true;
    }
    if (d.instrument) {
      this.ui.open(new InstrumentWindow(this.ui, this, d.key));
      return true;
    }
    if (d.key === 'pipe') {
      this.smokePipe();
      return true;
    }
    // (Round 61) A time crystal: at the way into a beaten place.
    if (d.kind === 'time_crystal') return useTimeCrystal(this, d);
    // (Round 62) A mod's item, with something to do when it's used.
    if (d.mod && modUse(this, p, d)) return true;
    return false;
  }

  // A pull on a clay pipe: smoke curling up off you for a while (and
  // nothing else at all).
  smokePipe() {
    const p = this.player;
    if (p.smokeT > 2) return;
    p.smokeT = 6;
    p.smokePuff = 0;
    p.doAction?.(0.5);
    this.audio?.play('puff');
    this.renderer.emit(p.x, p.y + 1.6, p.z, { n: 2, color: ['#ff9040', '#ffd070'], up: 6, speed: 4, life: 0.4, oy: -2, glow: true });
  }

  // Put on the armour or clothes in your hand.
  wearHeld() {
    const p = this.player;
    const it = p.heldDef();
    const was = p.equip[it.slot];
    if (!p.wear(p.selected)) return;
    this.ui.msg(`You put on the ${it.name.toLowerCase()}${was ? ` (and take off the ${ITEMS[was].name.toLowerCase()})` : ''}.`, '#c8e0ff');
    this.audio?.play('equip');
  }

  // ------------------------------------------------------------ mining
  breakTime(b) {
    if (!isFinite(b.hardness)) return Infinity;
    const h = this.player.heldDef();
    const good = h && h.tool && h.tool === b.tool;
    let t = b.hardness * 1.5 / (good ? h.speed : 1);
    if (b.tool === 'pick' && !good) t *= 3.5;
    t /= digMult(this.hero);
    // (Round 66: as fast as the world's mods have it.)
    t /= rule('breakSpeed');
    // (A dish that has you through stone faster: see cooking.js.)
    if (b.tool === 'pick') t /= 1 + Math.max(0, dishFx(this.player, 'mine'));
    return Math.max(0.08, t);
  }

  mineTick(dt, c) {
    const b = c.block;
    if (!isFinite(b.hardness) || b.liquid) {
      this.mining = null;
      return;
    }
    // A town's chests, barrels and wardrobes are its people's: they can be
    // opened (and picked, and robbed), not broken up and carried off. (Not
    // in a town that's been left empty; your own are yours.)
    if (b.interact === 'container' && this.unbreakableChest(c.x, c.y, c.z)) {
      if (!this.mining || this.mining.x !== c.x || this.mining.z !== c.z) this.ui.msg('That belongs to the town\'s folk: it\'s too heavy and too well made to break. Open it instead.', '#c8c8c8', true);
      this.mining = { x: c.x, y: c.y, z: c.z, progress: 0, hitT: 1 };
      return;
    }
    // In a cell, only the bars could possibly give way.
    const j = this.sim.justice.jail;
    if (j && !j.cellless && b.id !== B.iron_bars && b.id !== B.cell_door) {
      if (!this.mining || this.mining.x !== c.x || this.mining.z !== c.z) this.ui.msg('The walls are solid stone and iron. Only the bars might give...', '#c8c8c8', true);
      this.mining = { x: c.x, y: c.y, z: c.z, progress: 0, hitT: 1 };
      return;
    }
    const m = this.mining;
    if (!m || m.x !== c.x || m.y !== c.y || m.z !== c.z) {
      this.mining = { x: c.x, y: c.y, z: c.z, progress: 0, hitT: 0 };
      return;
    }
    const p = this.player;
    p.face(c.x, c.z);
    // (Digging a passage: the block over it, or under it, goes too, a
    // little longer for it; cutting a step up, the blocks over it and over
    // your head, the step itself left. See digPlan.)
    const plan = this.digPlan(c);
    const extra = plan ? plan.extra : [];
    if (plan && plan.keep && !extra.length) {
      // (The step's cut already: nothing more to dig. Walk up it.)
      this.mining = null;
      if (!(this.stepToldT > 0)) {
        this.stepToldT = 4;
        this.ui.msg('That step\'s clear: walk onto it to climb up. (Let go of Shift to dig the step itself.)', '#a0c8ff', true);
      }
      return;
    }
    let time = plan && plan.keep ? 0 : this.breakTime(b);
    // (A clean-cutting tool: the extra blocks quicker. See mods.js.)
    const xk = extra.length ? extraDigMult(p, !!plan.keep) : 1;
    for (const e of extra) time += this.breakTime(BLOCKS[this.world.getBlock(e.x, e.y, e.z)]) * (plan.keep ? 1 : 0.6) * xk;
    m.progress += dt / Math.max(0.05, time);
    m.hitT -= dt;
    if (m.hitT <= 0) {
      m.hitT = 0.28;
      p.doAction(0.25);
      const col = this.blockColor(b.id);
      this.renderer.emit(c.x, c.y, c.z, { n: 3, color: col, up: 25, speed: 40, life: 0.4, oy: -6 });
      this.audio?.play('dig');
    }
    if (m.progress >= 1) {
      for (const e of extra) this.breakBlock(e.x, e.y, e.z, true);
      if (!(plan && plan.keep)) this.breakBlock(c.x, c.y, c.z, true);
      else this.ui.msg('A step cut: walk onto it to climb up.', '#a0c8ff', true);
      this.mining = null;
    }
  }

  // Everything that goes when you dig at the block under the pointer:
  //   - beside you, at your feet or your head: the other half of the
  //     two-high gap goes with it, so you can walk through (out of a house
  //     as well as into a hillside);
  //   - Shift held, at a wall beside you: a step up cut into it instead:
  //     the two blocks over it and the one over your head go, the step
  //     itself stays, to climb.
  // Null if it's only the block itself (or the layer's locked: Z/X).
  digPlan(c) {
    const p = this.player;
    if (!c || !c.block || p.layerMode !== null) return null;
    const inp = this.input;
    const shift = !!(inp && inp.isDown && (inp.isDown('ShiftLeft') || inp.isDown('ShiftRight')));
    if (shift) {
      const step = this.stepCut(c);
      if (step) return step;
    }
    const pair = this.tunnelPair(c);
    return pair ? { kind: 'pass', extra: [pair], keep: false } : null;
  }

  // A step up into the wall at (c.x, c.z), beside you: what's still to dig
  // (the two blocks over the step, and the one over your head).
  stepCut(c) {
    const p = this.player;
    if (this.dungeon || Math.abs(c.x - p.x) + Math.abs(c.z - p.z) !== 1 || (c.y !== p.y && c.y !== p.y + 1)) return null;
    const w = this.world;
    if (!BLOCKS[w.getBlock(c.x, p.y, c.z)].standable) return null;
    const extra = [];
    for (const q of [{ x: c.x, y: p.y + 1, z: c.z }, { x: c.x, y: p.y + 2, z: c.z }, { x: p.x, y: p.y + 2, z: p.z }]) {
      const id = w.getBlock(q.x, q.y, q.z);
      const b = BLOCKS[id];
      if (id === B.air || !b.solid) continue;
      // (Something that won't come away: no step here.)
      if (!digThrough(id)) return null;
      extra.push(q);
    }
    return { kind: 'step', extra, keep: true };
  }

  // Digging into the ground beside you, at your feet or your head (the
  // layer left to AUTO): the other half of that two-high gap goes with it,
  // if it's the ground too, so what you dig you can always walk into (and
  // you're never left in a tunnel too low to stand in). Null otherwise.
  tunnelPair(c) {
    const p = this.player;
    if (!c || !c.block || p.layerMode !== null || this.dungeon) return null;
    const d = Math.max(Math.abs(c.x - p.x), Math.abs(c.z - p.z));
    if (d < 1 || d > 2) return null;
    const w = this.world;
    if (!digThrough(w.getBlock(c.x, c.y, c.z))) return null;
    let y = null;
    if (c.y === p.y) y = c.y + 1;
    else if (c.y === p.y + 1) y = c.y - 1;
    if (y === null) return null;
    if (!this.digsAlong(c.x, y, c.z)) return null;
    return { x: c.x, y, z: c.z };
  }

  // What a dig takes along with it unasked: the ground itself, or the wall
  // of a building the town put up (so you can dig your way out of a house
  // two high). Not what you've built yourself out in the open.
  digsAlong(x, y, z) {
    const id = this.world.getBlock(x, y, z);
    if (NATURAL.has(id)) return true;
    if (!digThrough(id)) return false;
    const s = this.currentSettlement;
    const L = s && this.world.layouts.get(s.id);
    return !!(L && buildingAt(L, x, z));
  }

  blockColor(id) {
    const avg = TEX.avg[id];
    if (!avg) return ['#8a8a8a', '#6a6a6a'];
    const c = `rgb(${avg[0] | 0},${avg[1] | 0},${avg[2] | 0})`;
    const d = `rgb(${(avg[0] * 0.7) | 0},${(avg[1] * 0.7) | 0},${(avg[2] * 0.7) | 0})`;
    return [c, d];
  }

  breakBlock(x, y, z, byPlayer = false) {
    const w = this.world;
    const id = w.getBlock(x, y, z);
    const b = BLOCKS[id];
    if (id === B.air || !isFinite(b.hardness)) return;
    const rand = Math.random;
    const drops = [];
    if (b.render === 'door') {
      // Remove both halves; only the bottom drops the door item.
      const bottomY = id === B.door_top ? y - 1 : y;
      if (w.getBlock(x, bottomY, z) === B.door) w.setBlock(x, bottomY, z, B.air);
      if (w.getBlock(x, bottomY + 1, z) === B.door_top) w.setBlock(x, bottomY + 1, z, B.air);
      drops.push({ item: 'door', count: 1 });
      y = bottomY;
    } else if (id === B.placed_item) {
      // Taken back up. Someone else's things are theirs, though.
      const got = this.takePlaced(x, y, z);
      if (got) {
        drops.push({ item: got.item, count: got.count });
        if (byPlayer && got.owner) this.tookPlaced(x, z, got);
      }
    } else {
      if (b.interact === 'container' || b.display) {
        const slots = w.getContainer(x, y, z);
        if (b.display) this.markContainer(x, y, z, true);
        for (const s of slots || []) if (s) drops.push({ ...s });
        // Smashing open someone else's chest is still stealing.
        if (byPlayer) {
          const owner = this.containerOwner(x, y, z);
          const taken = (slots || []).filter(Boolean).map((q) => ({ item: q.item, count: q.count }));
          if (owner && taken.length) this.onContainerTake({ owner }, taken);
        }
      }
      if (LOGS.has(id) && this.isTreeLog(x, y, z)) {
        this.fellTree(x, y, z, drops);
        if (byPlayer) this.checkFelling(x, z);
      } else {
        const meta = w.getMeta(x, y, z);
        w.setBlock(x, y, z, B.air);
        // Crops give seeds back if unripe, and more with a hoe.
        const crop = this.crops.harvest(id, meta, byPlayer && plainKey(this.player.heldItem()) === 'hoe', rand);
        const got = crop || rollDrops(id, rand);
        // Green thumbs get an extra crop; foragers an extra handful.
        if (byPlayer && crop && crop.length && crop[0].item !== CROPS[id]?.seed && heroHas(this.hero, 'farmer')) crop[0].count++;
        // (A ripe one, counted: see achievements.js.)
        if (byPlayer && crop && crop.length && crop[0].item !== CROPS[id]?.seed) this.stats.harvested = (this.stats.harvested || 0) + 1;
        else if (byPlayer && !crop && got.length && BLOCKS[id].render === 'plant' && heroHas(this.hero, 'forager') && rand() < 0.6) got[0].count++;
        drops.push(...got);
      }
    }
    // (What your tool's modifiers make of it: smelted, sawn, doubled...)
    if (byPlayer) toolDrops(this, this.player, id, drops);
    for (const d of drops) this.spawnDrop(d.item, d.count, x, y, z, true);
    // (Round 62) A mod's block, or broken with a mod's tool.
    if (b.mod || MODS.active.length) modBlockBroken(this, x, y, z, id, byPlayer);
    this.freeTied(x, y, z);
    this.renderer.emit(x, y, z, { n: 10, color: this.blockColor(id), up: 45, speed: 60, life: 0.6, oy: -6 });
    this.audio?.play(id === B.urn || id === B.skull_pile ? 'shatter' : b.render === 'plant' ? 'crop' : b.tool === 'axe' ? 'chop' : b.tool === 'pick' ? 'stone' : 'break');
    // (A powder keg broken open goes up.)
    if (id === B.powder_keg) kegBlast(this, x, y, z);
    this.popUnsupported(x, y + 1, z);
    this.popHung(x, y, z);
    if ((b.interact === 'container' || b.display) && this.myChests) notePlaced(this, x, y, z, false);
    this.flowWater(x, y, z);
    if (byPlayer) {
      this.stats.mined++;
      this.sim.customs.onBreak(b.name, x, z);
      this.checkVandalism(x, y, z, b);
      this.noteBuildingDamage(x, z, id);
      this.checkCropTheft(x, z, id, drops);
      // (Round 53: a dish that answers a block broken: see dishacts.js.)
      dishTrigger(this, this.player, 'break', { at: { x, y, z } });
    }
  }

  // The post something was tied to is gone: off it goes. (A town's or a
  // trader's horse turns up back at its post after half a day or so.)
  freeTied(x, y, z) {
    let n = 0;
    for (const c of this.creatures) {
      if (c.dead || !c.tie || c.tieR === 0 || c.tie.x !== x || c.tie.z !== z || Math.abs((c.tie.y ?? y) - y) > 1) continue;
      c.tie = null;
      c.tieR = undefined;
      c.loose = true;
      // One you tied there yourself: the lead's left lying by the post.
      if (c.leadTied) {
        c.leadTied = false;
        c.strain = 0;
        this.spawnDrop('lead', 1, x, y, z, true);
      }
      if (c.standKey && !c.own) {
        this.tied.delete(c.standKey);
        (this.looseKeys ||= new Map()).set(c.standKey, this.sim.abs + 720);
      }
      c.thinkT = 0;
      n++;
    }
    if (n && Math.max(Math.abs(x - this.player.x), Math.abs(z - this.player.z)) < 16) this.ui.msg(n > 1 ? 'The animals pull free of the broken post!' : 'Loose! It pulls free of the broken post.', '#ffe070');
    return n;
  }

  // You picked up something a townsperson set down: that's theft, if anyone
  // (the owner included) sees it.
  tookPlaced(x, z, got) {
    const o = got.owner;
    // A dirty dish nobody wants.
    if (o.mess) return;
    if (o.adv !== undefined) {
      // An adventurer's bow from beside their fire: they'll want it back.
      const e = this.sim.adventurers.ents.get(o.adv);
      if (e && !e.dead && e.distTo(this.player) <= 10) {
        e.putDown = null;
        e.say('That\'s MINE. Hand it back, now.', 3, '#ff9080');
        e.engage(this.player);
      }
      return;
    }
    const sid = o.sid;
    const L = this.sim.layoutOf(sid);
    if (!L) return;
    const HL = o.home !== undefined ? this.sim.layoutOf(o.home) : L;
    const rec = HL && HL.npcs[o.idx];
    const who = o.name || (rec ? `${rec.name.first} ${rec.name.last}` : 'someone');
    const ent = rec && rec.ent && !rec.ent.dead ? rec.ent : null;
    // A merchant's display piece: gone from their stock too.
    if (got.display) this.sim.displayTaken(got.display, got.item, got.count);
    const wits = this.sim.witnesses(sid, x, z, 8);
    const name = ITEMS[got.item]?.name || got.item;
    if (wits.length) {
      const owner = ent && wits.includes(ent) ? ent : null;
      if (owner) owner.say(owner.rng.pick(got.meal ? ['Oi! That\'s my dinner!', 'Hey, I was eating that!'] : [`Hey! That's my ${name.toLowerCase()}!`, 'Put that back!', 'Thief!']), 3, '#ffb080');
      const value = Math.max(1, Math.round((ITEMS[got.item]?.value || 1) * got.count));
      this.sim.justice.commit(sid, 'theft', { witnesses: wits, value, items: [{ item: got.item, count: got.count }], desc: got.display ? `Stealing ${name} from ${who}'s display` : got.meal ? `Taking ${who}'s meal` : `Taking ${who}'s ${name.toLowerCase()}`, owner: { kind: 'rec', id: o.idx }, victimNpc: owner, bid: buildingAt(L, x, z)?.id ?? null });
    } else if (got.display) {
      // Nobody saw: the merchant notices it's gone later.
      const value = Math.max(1, Math.round((ITEMS[got.item]?.value || 1) * got.count));
      this.sim.justice.unseen(sid, { type: 'theft', x, z, value, items: [{ item: got.item, count: got.count }], desc: `Stealing ${name} from ${who}'s display`, owner: { kind: 'rec', id: o.idx }, ownerName: who, bid: buildingAt(L, x, z)?.id ?? null });
    }
  }

  // Whose something set down is (for the tooltip).
  placedOwnerName(got) {
    const o = got && got.owner;
    if (!o || o.mess) return '';
    if (o.name) return got.display ? ` (${o.name.split(' ')[0]}'s wares)` : ` (${o.name.split(' ')[0]}'s)`;
    return '';
  }

  // Knocking a hole in a town building: the builders will come and fix it.
  noteBuildingDamage(x, z, id) {
    const bl = BLOCKS[id];
    if (!bl || (bl.render !== 'cube' && bl.render !== 'door')) return;
    const s = this.world.ow.settlementAt(x, z);
    if (!s || s.condition === 'abandoned' || s.deserted) return;
    const L = this.world.getLayout(s);
    const b = buildingAt(L, x, z);
    if (b && !b.playerHome) this.sim.works.noteDamage(L, b);
  }

  // Hunting the town's game where a game law says only its trappers may.
  checkPoaching(c) {
    if (!c.S || c.hostileNow || (c.S.mode !== 'passive' && c.S.mode !== 'neutral') || c.species === 'chicken' || c.livestock !== undefined) return;
    for (const s of this.world.ow.settlementsNear(c.x, c.z)) {
      const a = this.active.get(s.id);
      if (!a || !lawOn(a.layout, 'poaching') || this.sim.careers.licensed('trapper', s.id)) continue;
      const b = a.layout.bounds;
      if (c.x < b.x0 - 20 || c.x > b.x1 + 20 || c.z < b.z0 - 20 || c.z > b.z1 + 20) continue;
      const wits = this.sim.witnesses(s.id, c.x, c.z, 10);
      if (wits.length) this.sim.justice.commit(s.id, 'poaching', { witnesses: wits });
      return;
    }
  }

  // Felling trees in a town whose law protects them.
  checkFelling(x, z) {
    const s = this.world.ow.settlementAt(x, z);
    const a = s && this.active.get(s.id);
    if (!a || !lawOn(a.layout, 'felling')) return;
    const wits = this.sim.witnesses(s.id, x, z, 9);
    if (wits.length) this.sim.justice.commit(s.id, 'felling', { witnesses: wits });
  }

  // Harvesting a town's fields or gardens in front of people is theft.
  checkCropTheft(x, z, id, drops) {
    if (![B.wheat_crop, B.carrot_crop, B.cabbage_crop, B.pumpkin].includes(id)) return;
    const s = this.world.ow.settlementAt(x, z);
    if (!s || !this.active.has(s.id)) return;
    const L = this.active.get(s.id).layout;
    if (L.maskAt(x, z) !== M.FIELD) return;
    if (this.sim.careers.licensed('farmer', s.id)) return;
    const wits = this.sim.witnesses(s.id, x, z, 9);
    if (!wits.length) return;
    const items = drops.filter((d) => d.item !== 'seeds').map((d) => ({ item: d.item, count: d.count }));
    const value = items.reduce((n, d) => n + (ITEMS[d.item]?.value || 1) * d.count, 0);
    const farmer = wits.find((n) => n.rec.job === 'farmer');
    if (value < 3 && !farmer) {
      wits[0].say('Hey, those crops aren\'t yours!', 3, '#ffb080');
      this.sim.changeRep(wits[0], -3);
      return;
    }
    this.sim.justice.commit(s.id, 'theft', { witnesses: wits, value, items, desc: 'Stealing crops from the fields', owner: farmer ? { kind: 'rec', id: farmer.rec.idx } : null, victimNpc: farmer });
  }

  isTreeLog(x, y, z) {
    const w = this.world;
    for (let yy = y; yy < Math.min(WORLD_Y, y + 8); yy++) {
      for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) if (LEAVES.has(w.getBlock(x + dx, yy, z + dz))) return true;
      if (!LOGS.has(w.getBlock(x, yy, z)) && yy > y) break;
    }
    return false;
  }

  // Chop a tree: the log and everything connected above falls.
  fellTree(x, y, z, drops) {
    const w = this.world;
    const logs = [];
    const seen = new Set();
    const q = [[x, y, z]];
    while (q.length && logs.length < 40) {
      const [cx, cy, cz] = q.pop();
      const k = `${cx},${cy},${cz}`;
      if (seen.has(k)) continue;
      seen.add(k);
      if (!LOGS.has(w.getBlock(cx, cy, cz))) continue;
      if (cy < y) continue;
      logs.push([cx, cy, cz]);
      for (const [dx, dy, dz] of [[0, 1, 0], [1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1], [1, 1, 0], [-1, 1, 0], [0, 1, 1], [0, 1, -1]]) q.push([cx + dx, cy + dy, cz + dz]);
    }
    for (const [lx, ly, lz] of logs) {
      const id = w.getBlock(lx, ly, lz);
      w.setBlock(lx, ly, lz, B.air);
      drops.push({ item: BLOCKS[id].name, count: 1 });
    }
    // Leaves near the felled logs drop too.
    const top = logs.reduce((m, l) => Math.max(m, l[1]), y);
    let leafCount = 0;
    for (let yy = y; yy <= Math.min(WORLD_Y - 1, top + 3); yy++) {
      for (let dz = -3; dz <= 3; dz++) {
        for (let dx = -3; dx <= 3; dx++) {
          const id = w.getBlock(x + dx, yy, z + dz);
          if (!LEAVES.has(id)) continue;
          // Keep leaves that still touch another trunk.
          let supported = false;
          for (let sz = -2; sz <= 2 && !supported; sz++) for (let sx = -2; sx <= 2 && !supported; sx++) for (let sy = -3; sy <= 1 && !supported; sy++) if (LOGS.has(w.getBlock(x + dx + sx, yy + sy, z + dz + sz))) supported = true;
          if (supported) continue;
          w.setBlock(x + dx, yy, z + dz, B.air);
          leafCount++;
          drops.push(...rollDrops(id, Math.random));
          if (leafCount % 3 === 0) this.renderer.emit(x + dx, yy, z + dz, { n: 3, color: ['#3e8a2e', '#58a840'], up: 10, life: 0.8, gravity: 40 });
        }
      }
    }
    if (logs.length > 1) this.ui.msg('Timber!', '#c8e070');
  }

  // (Round 74) A wall gone: what was hung on it comes down.
  popHung(x, y, z) {
    const w = this.world;
    for (let d = 0; d < 4; d++) {
      const [dx, dz] = WALL_DIRS[d];
      const hx = x - dx;
      const hz = z - dz;
      const id = w.getBlock(hx, y, hz);
      if (!BLOCKS[id] || !BLOCKS[id].onWall) continue;
      if ((w.getMeta(hx, y, hz) & 3) !== d || wallDirOf(w, hx, y, hz, d) === d) continue;
      if (wallDirOf(w, hx, y, hz, d) >= 0) {
        // (Another wall beside it to hang from instead.)
        w.setMeta(hx, y, hz, wallDirOf(w, hx, y, hz, d));
        continue;
      }
      w.setBlock(hx, y, hz, B.air);
      for (const q of rollDrops(id, Math.random)) this.spawnDrop(q.item, q.count, hx, y, hz, true);
    }
  }

  popUnsupported(x, y, z) {
    const w = this.world;
    for (let i = 0; i < 4; i++) {
      const id = w.getBlock(x, y + i, z);
      const b = BLOCKS[id];
      if (id === B.air || !b.support) return;
      const below = BLOCKS[w.getBlock(x, y + i - 1, z)];
      if (below.solid || below.render === 'fence' || below.render === 'wall' || id === B.lily_pad && below.liquid) return;
      w.setBlock(x, y + i, z, B.air);
      for (const d of rollDrops(id, Math.random)) this.spawnDrop(d.item, d.count, x, y + i, z, true);
    }
  }

  // Water flows into freshly dug holes next to it (bounded).
  flowWater(x, y, z) {
    const w = this.world;
    if (y > WATER_Y) return;
    const q = [[x, y, z]];
    let n = 0;
    while (q.length && n < 48) {
      const [cx, cy, cz] = q.shift();
      if (w.getBlock(cx, cy, cz) !== B.air) continue;
      let wet = false;
      for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1], [0, 1, 0]]) if (w.getBlock(cx + dx, cy + dy, cz + dz) === B.water) wet = true;
      if (!wet) continue;
      w.setBlock(cx, cy, cz, B.water);
      n++;
      for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1], [0, -1, 0]]) if (cy + dy <= WATER_Y) q.push([cx + dx, cy + dy, cz + dz]);
    }
  }

  checkVandalism(x, y, z, b) {
    const s = this.world.ow.settlementAt(x, z);
    if (!s || !this.active.has(s.id)) return;
    // (Round 73) Someone's front door broken down: a crash heard all
    // down the street.
    if (b && (b.id === B.door || b.id === B.door_top) && houseOfDoor(this, x, z)) {
      this.audio?.play('crash', { x, z });
      this.shake = Math.min(1, (this.shake || 0) + 0.25);
      const wits = this.sim.witnesses(s.id, x, z, 14).filter((n) => !n.sleeping || Math.random() < 0.6);
      for (const n of wits) {
        n.sleeping = false;
        n.face(x, z);
        n.emoteShow?.('!', '#ff8060', 1.5);
      }
      if (wits.length) this.sim.justice.commit(s.id, 'vandalism', { witnesses: wits, desc: 'Breaking down a door' });
      return;
    }
    const L = this.active.get(s.id).layout;
    const here = L.buildings.filter((q) => x >= q.x0 && x <= q.x1 && z >= q.z0 && z <= q.z1);
    // Your own house is yours to knock about: nobody minds.
    const c = this.sim.citizen;
    if (here.some((q) => q.playerHome && c && c.sid === s.id && c.home === q.id)) return;
    // (Under the Mirefolk's spore law, the town's mushrooms are everyone's.)
    const spore = SPORE_BLOCKS.has(b.name) && lawOn(L, 'sporeLaw');
    if (spore) L.econ.recent.picked = (L.econ.recent.picked || 0) + 1;
    const civic = spore || here.length > 0 || L.maskAt(x, z) === 1 || L.maskAt(x, z) === 5 || EVENT_BLOCKS.has(b.id);
    if (!civic || (b.render === 'plant' && !spore)) return;
    // The noise of it: anyone near enough to hear (awake) turns to look.
    for (const n of this.active.get(s.id).npcs) {
      if (n.dead || n.sleeping || n.state !== 'routine' || n.sitting || n.moving) continue;
      const d = Math.max(Math.abs(n.x - x), Math.abs(n.z - z));
      if (d > (n.rec.job === 'guard' ? 6 : 4) || d < 1) continue;
      n.face(x, z);
      if (d > 2 && n.rng.chance(0.4)) n.emoteShow('?', '#c8c8c8', 1.2);
    }
    const wits = this.sim.witnesses(s.id, x, z, 7).filter((n) => n.state === 'routine');
    const witness = wits[0];
    if (!witness) return;
    const v = (this.vandal.get(s.id) || 0) + 1;
    this.vandal.set(s.id, v);
    this.sim.changeRep(witness, -2);
    if (v >= 4) {
      this.vandal.set(s.id, 0);
      this.sim.justice.commit(s.id, 'vandalism', { witnesses: wits, desc: 'Vandalizing the town' });
    } else witness.say(spore ? ['Those belong to the whole town!', 'Put that back! It\'s the spore law!', 'Thief! The mushrooms are everyone\'s!'][v - 1] : ['Hey! That\'s not yours!', 'Stop wrecking our town!', 'Do you mind?!'][v - 1], 3, '#ffb080');
  }

  // ------------------------------------------------------------ placing
  canPlace(id, x, y, z) {
    const w = this.world;
    if (y < 1 || y >= WORLD_Y - 1) return false;
    const cur = BLOCKS[w.getBlock(x, y, z)];
    if (!(cur.replaceable || cur.id === B.air)) return false;
    const b = BLOCKS[id];
    if (b.solid && this.occupiedAny(x, y, z) && !this.jumpPlace(id, x, y, z)) return false;
    // (Round 74: a painting needs a wall beside it, not a floor under it.)
    if (b.onWall && wallDirOf(w, x, y, z) < 0) return false;
    const below = BLOCKS[w.getBlock(x, y - 1, z)];
    if (b.support && !(below.solid || below.render === 'fence' || below.render === 'wall' || (b.render === 'flat' && below.liquid) || below.name === 'table' || below.name === 'counter')) return false;
    if (CROPS[id] && !isFarmland(w.getBlock(x, y - 1, z))) return false;
    if (id === B.door) {
      const up = BLOCKS[w.getBlock(x, y + 1, z)];
      if (!(up.replaceable || up.id === B.air)) return false;
      if (this.occupiedAny(x, y, z)) return false;
    }
    return true;
  }

  // (Round 78) Where you stand yourself (and nobody else).
  selfAt(x, y, z) {
    const p = this.player;
    return !!p && p.x === x && p.y === y && p.z === z;
  }

  // (Round 78) A block set down where you're standing: you jump, and it
  // goes in under your feet, as long as there's room over your head (and
  // you're on your own two feet, nobody else there).
  jumpPlace(id, x, y, z) {
    const p = this.player;
    const b = BLOCKS[id];
    if (!this.selfAt(x, y, z) || !b || !b.solid || p.moving || p.mount || p.raft || p.deck || p.inWagon || p.sitting || p._ride || p._grapple) return false;
    const w = this.world;
    const up = BLOCKS[w.getBlock(x, y + 2, z)];
    if (!up || up.solid || up.liquid) return false;
    const other = this.occ.get(this.occKey(x, y - 1, z));
    if (other && other !== p && !other.dead) return false;
    return !this.bigAt(x, y, z, null);
  }

  occupiedAny(x, y, z) {
    for (const yy of [y, y - 1]) {
      const e = this.occ.get(this.occKey(x, yy, z));
      if (e && !e.dead) return true;
    }
    return !!this.bigAt(x, y, z, null);
  }

  tryPlace(t) {
    const p = this.player;
    const slot = p.inv[p.selected];
    if (!slot || !t.ok) {
      if (t && !t.ok) this.audio?.play('error');
      return;
    }
    const def = ITEMS[slot.item];
    const id = def.kind === 'block' ? def.block : def.plant;
    const b = BLOCKS[id];
    // (Round 78) Drawn on the blueprint in your off hand, not built (and
    // nothing used up).
    if (t.ghost || isBlueprint(p.equip && p.equip.shield)) {
      const rot0 = b.rotatable ? (p.rot - (this.renderer.view || 0)) & 3 : 0;
      const rot = b.onWall ? Math.max(0, wallDirOf(this.world, t.x, t.y, t.z, (2 - (this.renderer.view || 0)) & 3)) : rot0;
      if (placeGhost(this, p, t, id, rot)) p.doAction(0.15);
      return;
    }
    // The facing you chose is the one you see on screen.
    let rot = b.rotatable ? (p.rot - (this.renderer.view || 0)) & 3 : 0;
    const w = this.world;
    // (Round 74: hung on the wall you pointed at, or the one behind it as
    // you look, or any.)
    if (b.onWall) {
      const behind = (2 - (this.renderer.view || 0)) & 3;
      const pref = t.wall ? dirToward(t.x, t.z, t.wall.x, t.wall.z) : behind;
      rot = Math.max(0, wallDirOf(w, t.x, t.y, t.z, pref < 0 ? behind : pref));
    }
    // (Round 78) Under your own feet: up you jump, and it goes in below.
    const jump = this.jumpPlace(id, t.x, t.y, t.z);
    if (jump) {
      p.startMove(t.x, t.y + 1, t.z, 0.2);
      p.hopT = 0.25;
    }
    w.setBlock(t.x, t.y, t.z, id, rot | (b.lightWhenState ? META_STATE : 0) | cropMeta(id, 0));
    if (CROPS[id]) this.crops.sow(t.x, t.y, t.z, id, 0);
    dishTrigger(this, p, 'place', { at: { x: t.x, y: t.y, z: t.z } });
    if (id === B.door) w.setBlock(t.x, t.y + 1, t.z, B.door_top, rot);
    // (Below ground, what you build is noted: a master smashes through it.)
    if (this.dungeon) {
      this.dungeon.notePlaced(t.x, t.y, t.z);
      if (id === B.door) this.dungeon.notePlaced(t.x, t.y + 1, t.z);
    }
    // (Round 79) A rack or stand you put up is yours too.
    if (b.display) notePlaced(this, t.x, t.y, t.z, true);
    if (b.interact === 'container') {
      const r = w.regionAt(t.x, t.z);
      const idx = ((t.z - r.z0) * REGION_W + (t.x - r.x0)) * WORLD_Y + t.y;
      r.containers.set(idx, makeSlots(CONTAINER_SIZE[b.name] || b.modSlots || 9));
      // (Round 78) Yours: the bench draws on it (see invtools.js).
      notePlaced(this, t.x, t.y, t.z, true);
    }
    if (id === B.sapling) this.saplings.push({ x: t.x, y: t.y, z: t.z, t: 90 + Math.random() * 120 });
    if (def.relic) setRelic(this, t.x, t.y, t.z, def.relic, def.shards || 0);
    slot.count--;
    if (slot.count <= 0) p.inv[p.selected] = null;
    p.doAction(0.2);
    if (!jump) p.face(t.x, t.z);
    this.audio?.play('place');
    this.stats.placed++;
    this.renderer.emit(t.x, t.y, t.z, { n: 4, color: this.blockColor(id), up: 15, life: 0.3, oy: -2 });
    if (b.mod) modBlockPlaced(this, t.x, t.y, t.z, id);
  }

  // ------------------------------------------------------------ horses & wagons
  // What stands still near you: the town's horses at their hitching post
  // (and its wagons beside them), and at camps outside town the traders'
  // and nomads' horses tied up by their wagons. They come and go with you.
  // The stand height at (x, z) only if it's level with `hint` (give or take
  // a step): otherwise the nearest such spot within a few paces, or null.
  groundNear(sp, hint) {
    const w = this.world;
    const at = (x, z) => {
      for (const d of [0, 1, -1, 2, -2]) if (w.canStand(x, hint + d, z)) return hint + d;
      return -1;
    };
    for (let r = 0; r <= 4; r++) {
      for (let dz = -r; dz <= r; dz++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
          const y = at(sp.x + dx, sp.z + dz);
          if (y >= 0) return { x: sp.x + dx, y, z: sp.z + dz };
        }
      }
    }
    // (Up a hill: fine, so long as it's the ground it's stood on.)
    const y = w.findStandY(sp.x, sp.z, null);
    return y > 0 && NATURAL.has(w.getBlock(sp.x, y - 1, sp.z)) ? { x: sp.x, y, z: sp.z } : null;
  }

  syncStanding(dt) {
    this.standT = (this.standT || 0) - dt;
    if (this.standT > 0) return;
    this.standT = 1;
    const want = new Map();
    const add = (sp) => want.set(sp.key, sp);
    const now = this.sim.abs;
    for (const { layout: L } of this.active.values()) {
      const st = this.sim.stables.standing(L);
      if (st) {
        for (const h of st.horses) add({ ...h, type: 'horse' });
        for (const w of st.wagons) add({ ...w, type: 'wagon' });
      }
      // (Round 77) The coach out of town, and the ferry off the pier.
      if (!L.settlement.deserted && L.settlement.condition !== 'abandoned') {
        const cs = coachStand(L);
        if (cs) add(cs);
        const fs = ferryStand(this, L);
        if (fs) add(fs);
      }
      // Visitors from other towns tie their horses up at the post here too.
      const guests = (this.sim.visits.get(L.settlement.id) || []).filter((v) => v.guest && v.mount && now >= v.arrive && now < v.leave);
      const post = guests.length ? this.sim.stables.hitch(L) : null;
      if (post) {
        guests.forEach((v, i) => {
          const [dx, dz] = [[1, -1], [-1, -1], [2, -1], [-2, -1], [2, 0]][i % 5];
          add({ key: `guest:${v.id}`, type: 'horse', x: post.x + dx, z: post.z + dz, coat: v.mount.coat || 0, banner: v.mount.banner || null, post });
          if (v.mount.kind === 'wagon') add({ key: `guestw:${v.id}`, type: 'wagon', x: post.x - 3, z: post.z + 2 + i * 2, face: 1, banner: v.mount.banner || null });
        });
      }
    }
    for (const c of this.sim.camps.list) {
      if (c.struck || c.placed < c.ops.length) continue;
      for (const h of c.horses || []) add({ ...h, type: 'horse' });
      for (const w of c.wagons || []) add({ ...w, type: 'wagon' });
    }
    for (const sp of this.sim.caravans ? this.sim.caravans.roadStanding() : []) add(sp);
    this.riding.update();
    for (const sp of this.riding.standing()) add(sp);
    const p = this.player;
    // Got loose from a broken post: wandering, till someone fetches it back.
    for (const [k, until] of this.looseKeys || []) {
      if (now < until && want.has(k)) continue;
      this.looseKeys.delete(k);
      for (const c of this.creatures) {
        if (c.dead || c.own || c.standKey !== k || !c.loose) continue;
        c.dead = true;
        this.removeOcc(c);
      }
    }
    for (let [k, sp] of want) {
      if (this.looseKeys && this.looseKeys.has(k)) continue;
      // (Killed: not stood up again in its place. Round 57.)
      if (this.slainStand && this.slainStand.has(k)) continue;
      if (Math.max(Math.abs(sp.x - p.x), Math.abs(sp.z - p.z)) > 36 || !this.world.regionAt(sp.x, sp.z)) continue;
      // (Round 77) The ferry: on the water off the pier, as it is.
      if (sp.type === 'ship') {
        if (!this.props.has(k)) this.props.set(k, { kind: 'prop', type: 'ship', id: 90000 + (this.propN = (this.propN || 0) + 1), dead: false, renderPos() { return { x: this.x, y: this.y, z: this.z }; } });
        Object.assign(this.props.get(k), { x: sp.x, y: GROUND, z: sp.z, face: sp.face ?? 1, banner: sp.banner || null, sail: false, stop: sp.stop });
        continue;
      }
      // On the ground near where it belongs, never up on a roof: if the
      // spot's built over, the nearest open ground close by instead.
      const near = this.groundNear(sp, sp.y ?? GROUND);
      if (!near) continue;
      const y = near.y;
      sp = { ...sp, x: near.x, z: near.z };
      if (sp.type === 'wagon') {
        if (!this.props.has(k)) this.props.set(k, { kind: 'prop', type: 'wagon', id: 90000 + (this.propN = (this.propN || 0) + 1), dead: false, renderPos() { return { x: this.x, y: this.y, z: this.z }; } });
        Object.assign(this.props.get(k), { x: sp.x, y, z: sp.z, face: sp.face ?? 1, banner: sp.banner || null, own: sp.own || null, hood: sp.hood, horse: sp.horse || null, stop: sp.stop || null });
      } else if (this.tied.has(k) && !this.tied.get(k).dead) {
        // (Saddled by the handler while you watched.)
        const c = this.tied.get(k);
        if (!c.own) c.saddled = !!sp.saddled;
      } else {
        if (this.entityAt(sp.x, y, sp.z)) continue;
        const c = new Creature(this, 'horse', sp.x, y, sp.z, sp.coat || 0);
        c.tie = sp.post ? { x: sp.post.x, y: sp.post.y ?? GROUND, z: sp.post.z } : null;
        if (sp.stall) c.tieR = 0;
        c.banner = sp.banner || null;
        c.saddled = !!sp.saddled;
        if (sp.town !== undefined) c.town = { sid: sp.town, idx: sp.idx };
        c.standKey = k;
        // (Whose it is, for when it's killed: see standSlain.)
        if (sp.member !== undefined) c.standOf = { company: sp.company ?? companyOfKey(k), member: sp.member };
        // One of yours: loose, not tied.
        if (sp.own) {
          c.own = sp.own;
          c.saddled = !!sp.saddled;
          c.tie = null;
        }
        this.addCreature(c);
        this.tied.set(k, c);
      }
    }
    // Windmills' sails, turning on their hubs (see renderer.drawSails).
    const mills = new Set();
    const windy = this.weather && this.weather.kind && /storm|rain/.test(this.weather.kind) ? 1.6 : 1;
    for (const { layout: L } of this.active.values()) {
      L.buildings.forEach((b, i) => {
        const sl = b.sails;
        if (b.type !== 'windmill' || !sl || Math.max(Math.abs(sl.x - p.x), Math.abs(sl.z - p.z)) > 36) return;
        // (Not if the hub's been knocked out.)
        if (this.world.getBlock(sl.x, sl.y, sl.z) !== B.mill_hub) return;
        const k = `mill:${L.settlement.id}:${i}`;
        mills.add(k);
        if (!this.props.has(k)) this.props.set(k, { kind: 'prop', type: 'sails', id: 90000 + (this.propN = (this.propN || 0) + 1), dead: false, renderPos() { return { x: this.x, y: this.y, z: this.z }; } });
        Object.assign(this.props.get(k), { x: sl.x, y: sl.y, z: sl.z, along: sl.along, nx: sl.nx ?? 0, nz: sl.nz ?? (sl.along ? 1 : 0), seed: i, spin: (L.settlement.condition === 'abandoned' ? 0.25 : 0.7) * windy });
      });
    }
    // (Round 78: not a coach or ferry under way with someone in it.)
    for (const k of [...this.props.keys()]) if (!want.has(k) && !mills.has(k) && !k.startsWith('ride:')) this.props.delete(k);
    // You, sat in the back of one.
    for (const q of this.props.values()) this.riding.seatShown(q);
    if (p.inWagon && !this.props.has([...this.props].find(([, q]) => q === p.inWagon)?.[0])) p.inWagon = null;
    for (const [k, c] of [...this.tied]) {
      if (want.has(k) && !c.dead) continue;
      if (!c.dead) {
        c.dead = true;
        this.removeOcc(c);
      }
      this.tied.delete(k);
    }
  }

  // ------------------------------------------------------------ city gates
  // The whole gateway a gate tile belongs to (its leaves side by side).
  gateway(x, z) {
    const w = this.world;
    const y = GROUND;
    if (w.getBlock(x, y, z) !== B.city_gate) return [];
    const out = [];
    const seen = new Set();
    const q = [[x, z]];
    while (q.length && out.length < 12) {
      const [cx, cz] = q.pop();
      const k = cx * 65536 + cz;
      if (seen.has(k) || w.getBlock(cx, y, cz) !== B.city_gate) continue;
      seen.add(k);
      out.push({ x: cx, z: cz });
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) q.push([cx + dx, cz + dz]);
    }
    return out;
  }

  setGate(x, z, open) {
    const w = this.world;
    const tiles = this.gateway(x, z);
    if (!open && tiles.some((t) => this.occupiedAny(t.x, GROUND, t.z))) return false;
    if (open && this.isNight()) for (const t of tiles) (this.gateOpened ||= new Map()).set(t.x * 65536 + t.z, this.gateClock || 0);
    for (const t of tiles) {
      w.setState(t.x, GROUND, t.z, open);
      if (w.getBlock(t.x, GROUND + 1, t.z) === B.city_gate_top) w.setState(t.x, GROUND + 1, t.z, open);
    }
    if (tiles.length && Math.max(Math.abs(x - this.player.x), Math.abs(z - this.player.z)) < 16) this.audio?.play('door');
    this.lightDirty = true;
    return tiles.length > 0;
  }

  isNight() {
    return this.minute >= 21 * 60 || this.minute < 6 * 60;
  }

  // A guard of the watch near a gateway (awake, and not busy fighting).
  gateGuard(x, z, r = 12) {
    return this.npcs.find((n) => !n.dead && n.rec.job === 'guard' && !n.sleeping && n.state !== 'fight' && Math.max(Math.abs(n.x - x), Math.abs(n.z - z)) <= r) || null;
  }

  // You at a gate: shut by night, a guard nearby lets you through; from
  // inside the walls you can lift the bar yourself.
  useGate(x, y, z) {
    const w = this.world;
    const by = w.getBlock(x, y, z) === B.city_gate_top ? y - 1 : y;
    const open = w.getState(x, by, z);
    if (open) return this.setGate(x, z, false);
    if (!this.isNight()) return this.setGate(x, z, true);
    const g = this.gateGuard(x, z);
    const s = this.world.ow.settlementAt(x, z);
    const L = s ? this.world.layouts.get(s.id) : null;
    const b = L ? L.econ.wallRect || L.bounds : null;
    const p = this.player;
    const inside = b && p.x > b.x0 && p.x < b.x1 && p.z > b.z0 && p.z < b.z1;
    if (g && !(s && this.isWanted(s.id))) {
      g.face(x, z);
      g.say(g.rng.pick(['Hold on, I\'ll let you through.', 'Late to be out. In you come.', 'Opening up! Mind the gap.']), 3);
      this.setGate(x, z, true);
      return true;
    }
    if (inside) {
      this.ui.msg('You lift the bar and swing the gate open.', '#c8c8c8');
      this.setGate(x, z, true);
      return true;
    }
    this.ui.msg('The gate is barred for the night, and there\'s nobody on watch to open it.', '#ffb080', true);
    this.audio?.play('error');
    return false;
  }

  // Once a second: gates open at dawn; at night the watch shuts them (and
  // opens them again for whoever needs to pass).
  updateGates(dt) {
    // (Seconds, not game minutes: the watch shuts up about five seconds
    // after letting someone through.)
    this.gateClock = (this.gateClock || 0) + dt;
    this.gateT = (this.gateT || 0) - dt;
    if (this.gateT > 0) return;
    this.gateT = 0.5;
    const w = this.world;
    const night = this.isNight();
    const now = this.gateClock;
    this.gateOpened ||= new Map();
    for (const { layout: L } of this.active.values()) {
      if (!L.gates || !L.gates.length) continue;
      const done = new Set();
      for (const g of L.gates) {
        if (done.has(g.x * 65536 + g.z) || !w.regionAt(g.x, g.z) || w.getBlock(g.x, GROUND, g.z) !== B.city_gate) continue;
        const tiles = this.gateway(g.x, g.z);
        for (const t of tiles) done.add(t.x * 65536 + t.z);
        const open = w.getState(g.x, GROUND, g.z);
        const opened = Math.max(...tiles.map((t) => this.gateOpened.get(t.x * 65536 + t.z) ?? -1e9));
        const held = now - opened < 5;
        // Someone in the gateway itself: wait for them to be through.
        const busy = [...this.everyone(), ...this.npcs].some((e) => !e.dead && tiles.some((t) => e.x === t.x && e.z === t.z));
        if (!night && !open) this.setGate(g.x, g.z, true);
        else if (night && open && !held && !busy) {
          const guard = this.gateGuard(g.x, g.z, 16);
          if (!guard) continue;
          if (this.setGate(g.x, g.z, false) && L.gateCall !== this.day) {
            L.gateCall = this.day;
            guard.say(guard.rng.pick(['Closing the gates for the night!', 'Gates shut! Nobody in or out without the watch.']), 3, '#ffe070');
          }
        }
      }
    }
  }

  // ------------------------------------------------------------ interactions
  setDoor(x, y, z, open) {
    const w = this.world;
    let by = y;
    if (w.getBlock(x, y, z) === B.door_top) by = y - 1;
    if (w.getBlock(x, by, z) !== B.door) return;
    if (!open && this.occupiedAny(x, by, z)) return;
    w.setState(x, by, z, open);
    if (w.getBlock(x, by + 1, z) === B.door_top) w.setState(x, by + 1, z, open);
    if (Math.max(Math.abs(x - this.player.x), Math.abs(z - this.player.z)) < 12) this.audio?.play('door');
    this.lightDirty = true;
  }

  // Out onto the water.
  launchRaft(x, z) {
    const p = this.player;
    if (!floatable(this.world, x, z)) {
      this.ui.msg('The raft needs open water.', '#c8c8c8', true);
      return false;
    }
    if (Math.hypot(x - p.x, z - p.z) > 2.5) {
      this.ui.msg('Get closer to the water.', '#c8c8c8', true);
      return false;
    }
    removeItem(p.inv, 'raft', 1);
    launchRaft(this, x, z);
    raftDues(this, x, z);
    this.audio?.play('splash');
    this.ui.msg('You push off on the raft. A/D turn, W paddles, S back-paddles, F to go ashore.', '#a0d8ff');
    return true;
  }

  // Back onto dry land, the raft under your arm.
  // (Round 69) For rafts (see raft.js): a ship's hull at world (x, z), and
  // running into one.
  shipHullAt(x, z) {
    return !!hullAt(this, x, z);
  }

  raftMeetsShip(p, x, z) {
    return raftMeetsShip(this, p, x, z);
  }

  // (Round 69) Whoever's with you, aboard a ship with you (see npc.js).
  npcAboard(n, dt) {
    return npcAboard(this, n, dt);
  }

  leaveRaft(force = false) {
    const p = this.player;
    if (!p.raft) return false;
    const spot = raftLanding(p);
    if (!spot && !force) {
      this.ui.msg('No bank close enough to step onto.', '#c8c8c8', true);
      return false;
    }
    p.raft = null;
    if (spot) p.teleport(spot.x, spot.y, spot.z);
    p.give('raft', 1);
    this.audio?.play('step_grass');
    return true;
  }

  interactFront() {
    // (Aboard ship in the opening: the crew are all there is to talk to.)
    if (this.cutscene) {
      const c = this.cursor;
      const p = this.player;
      if (c && c.entity && c.entity.kind === 'crew' && c.entity.distTo(p) <= 4) return this.cutscene.talk(c.entity);
      const D = [[0, 1], [-1, 0], [0, -1], [1, 0]][p.dir];
      for (const yy of [p.y, p.y + 1, p.y - 1]) {
        const e = this.entityAt(p.x + D[0], yy, p.z + D[1]);
        if (e && e.kind === 'crew') return this.cutscene.talk(e);
      }
      const near = (this.cutscene.actors || []).filter((q) => !q.dead && q.distTo(p) <= 2).sort((a, b) => a.distTo(p) - b.distTo(p))[0];
      if (near) this.cutscene.talk(near);
      return;
    }
    if (this.player.raft) return this.leaveRaft();
    if (this.player.mount) return this.riding.dismount();
    // (Round 78) Riding the coach: down, where it is.
    if (this.player._ride) return rideOff(this, this.player);
    if (this.player.inWagon) return this.riding.climbOut();
    const c = this.cursor;
    if (c && c.entity && c.entity.kind === 'npc' && c.entity.distTo(this.player) <= 4) return this.talk(c.entity);
    if (c && c.block && c.block.interact && c.inReach) return this.interact(c.x, c.y, c.z);
    const p = this.player;
    const D = [[0, 1], [-1, 0], [0, -1], [1, 0]][p.dir];
    for (const yy of [p.y, p.y + 1, p.y - 1]) {
      const x = p.x + D[0];
      const z = p.z + D[1];
      const id = this.world.getBlock(x, yy, z);
      if (BLOCKS[id].interact) return this.interact(x, yy, z);
      const e = this.entityAt(x, yy, z);
      if (e && e.kind === 'npc') return this.talk(e);
    }
  }

  // Is there a way from where you stand to (x, y, z), not through a wall?
  // (Over a table, round a corner, yes; through stone, no. Round 56: a
  // chest or a relic on the far side of a wall was opened all the same.)
  wayTo(x, y, z) {
    const p = this.player;
    const px = Math.round(p.x);
    const pz = Math.round(p.z);
    if (Math.max(Math.abs(x - px), Math.abs(z - pz)) <= 1 && !this.wallBetween(px, pz, x, z, p.y)) return true;
    const wall = (cx, cz) => {
      // (Open if there's room for a body at about your height.)
      for (const y0 of [p.y, p.y + 1, p.y - 1]) if (!this.isWall(cx, y0, cz) && !this.isWall(cx, y0 + 1, cz)) return false;
      return true;
    };
    const x0 = Math.min(px, x) - 3;
    const z0 = Math.min(pz, z) - 3;
    const W = Math.max(px, x) + 3 - x0 + 1;
    const D = Math.max(pz, z) + 3 - z0 + 1;
    if (W * D > 4096) return true;
    const seen = new Uint8Array(W * D);
    const q = [[px, pz]];
    seen[(pz - z0) * W + (px - x0)] = 1;
    while (q.length) {
      const [cx, cz] = q.shift();
      // (Within arm's length of it, and nothing in the way of the arm.)
      if (Math.max(Math.abs(cx - x), Math.abs(cz - z)) <= 1 && !this.wallBetween(cx, cz, x, z, p.y)) return true;
      for (let dz = -1; dz <= 1; dz++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dz) continue;
          const nx = cx + dx;
          const nz = cz + dz;
          if (nx < x0 || nz < z0 || nx >= x0 + W || nz >= z0 + D) continue;
          const k = (nz - z0) * W + (nx - x0);
          if (seen[k] || wall(nx, nz)) continue;
          // (Not squeezed through where two walls meet at a corner.)
          if (dx && dz && wall(cx + dx, cz) && wall(cx, cz + dz)) continue;
          seen[k] = 1;
          q.push([nx, nz]);
        }
      }
    }
    return false;
  }

  isWall(x, y, z) {
    const b = BLOCKS[this.world.getBlock(x, y, z)];
    return !!(b && b.opaque && b.render === 'cube');
  }

  // A step from (ax, az) to (bx, bz) next to it, cut off by walls: a wall
  // straight between, or both corners of a diagonal one.
  wallBetween(ax, az, bx, bz, y) {
    const dx = Math.sign(bx - ax);
    const dz = Math.sign(bz - az);
    if (!dx || !dz) return false;
    const solid = (cx, cz) => this.isWall(cx, y, cz) && this.isWall(cx, y + 1, cz);
    return solid(ax + dx, az) && solid(ax, az + dz);
  }

  interact(x, y, z) {
    const w = this.world;
    const id = w.getBlock(x, y, z);
    const b = BLOCKS[id];
    const p = this.player;
    // (Not through a wall: a chest, a relic, a lever on the far side.)
    if (b.interact && b.interact !== 'door' && b.interact !== 'gate' && !this.wayTo(x, y, z)) {
      if ((this.wallHintT || 0) <= Date.now()) {
        this.ui.msg('You can\'t reach that from here: there\'s a wall in the way.', '#ffb080');
        this.wallHintT = Date.now() + 2000;
      }
      return;
    }
    p.face(x, z);
    // The old places' doors, stairs, levers and the like.
    if (DUNGEON_INTERACTS.has(b.interact)) {
      this.useOldPlace(x, y, z, b);
      return;
    }
    // (Below ground, a chest might have teeth.)
    if (b.interact === 'container' && this.dungeon && this.dungeon.wakeMimic(x, y, z)) return;
    if (b.interact === 'container' && this.dungeon && this.dungeon.locked(x, z)) {
      this.ui.msg('Sealed by a glyph lock. The console in this room knows how it opens.', '#5ad8f0');
      return;
    }
    if (b.interact === 'relic') {
      this.takeRelic(x, y, z);
      return;
    }
    switch (b.interact) {
      case 'door': {
        const open = w.getState(x, y, z);
        // (Round 73) Someone's front door, locked: pick it (with a pick in
        // your hand) or knock.
        const by = w.getBlock(x, y, z) === B.door_top ? y - 1 : y;
        if (!open && doorLocked(this, x, by, z)) {
          if (p.heldItem() === 'lockpick') this.pickDoor(x, by, z);
          else knockDoor(this, x, by, z);
          break;
        }
        this.setDoor(x, y, z, !open);
        break;
      }
      case 'gate':
        this.useGate(x, y, z);
        break;
      // (Round 73) A rack, a stand, a hook: something set on it, or taken
      // down (see displays.js); a painting, looked at.
      case 'display':
        useDisplay(this, x, y, z);
        break;
      case 'painting': {
        const sub = paintingSubject(x, y, z, this.seed);
        const what = { beast: 'a beast of the wilds', face: 'someone\'s likeness', place: 'a far-off place', map: 'an old map', thing: 'a fine thing', sea: 'the sea', still: 'a table set with food' }[sub.kind] || 'something';
        this.renderer.floatText(x, y + 1.8, z, what, '#e8dcc0');
        break;
      }
      case 'container': {
        // (An outlaws' strongbox: see sim/saga.)
        if (this.sim.saga && this.sim.saga.chest(x, y, z)) break;
        const owner = this.containerOwner(x, y, z);
        // (A household keeps its chest locked: see pickLock.)
        if (this.chestLocked(x, y, z, owner)) this.pickLock(x, y, z, owner);
        else this.openContainerAt(x, y, z, owner);
        break;
      }
      case 'cell_door': {
        // (A cage at an outlaws' camp: see sim/saga.)
        if (this.sim.saga && this.sim.saga.door(x, y, z)) break;
        const j = this.sim.justice.jail;
        const L = this.jailLayoutAt(x, z);
        if (j && L && j.sid === L.settlement.id) {
          this.ui.msg('The cell door is locked.', '#ffb080');
          this.audio?.play('error');
          break;
        }
        const open = id === B.cell_door_open;
        w.setBlock(x, y, z, open ? B.cell_door : B.cell_door_open, 0);
        if (w.getBlock(x, y + 1, z) === B.iron_bars) w.setBlock(x, y + 1, z, B.cell_door_top, 0);
        this.audio?.play('door');
        break;
      }
      case 'trap': {
        if (w.getState(x, y, z)) {
          w.setState(x, y, z, false);
          const left = p.give('raw_meat', 1);
          if (left) this.spawnDrop('raw_meat', 1, p.x, p.y, p.z, true);
          this.ui.msg('You take the catch from the snare.', '#e8e0a0');
          this.audio?.play('pickup');
          const s = this.world.ow.settlementsNear(x, z)[0];
          if (s && this.active.has(s.id) && !this.sim.careers.licensed('trapper', s.id)) {
            const wits = this.sim.witnesses(s.id, x, z, 8).filter((n) => n.rec.job === 'trapper');
            if (wits.length) this.sim.justice.commit(s.id, 'theft', { witnesses: wits, value: 3, desc: 'Stealing from a trapper\'s snare', items: [{ item: 'raw_meat', count: 1 }], owner: { kind: 'rec', id: wits[0].rec.idx } });
          }
        } else this.ui.msg('A snare, set and waiting. Nothing caught yet.', '#c8c8c8');
        break;
      }
      case 'sit':
        this.sitOn(x, y, z);
        break;
      // (Round 62) A mod's block, with something to do when it's used.
      case 'mod':
        modBlockUse(this, x, y, z, id);
        break;
      case 'workbench':
        this.ui.openCrafting('workbench');
        break;
      case 'furnace':
        this.ui.openCrafting('furnace');
        break;
      // (Round 50) A table: something put together on a plate.
      case 'table':
        this.openCooking('t', x, y, z);
        break;
      case 'anvil':
        this.ui.openCrafting('anvil');
        break;
      // A trade's own bench: only someone licensed in the trade can work it.
      case 'bench': {
        const st = BLOCKS[id].station;
        // A researcher at a desk in the academy (or library): the study.
        const b = buildingAt(this.sim.layoutOf(this.currentSettlement?.id) || { buildings: [] }, x, z);
        const cj = this.sim.careers.job;
        if (st === 'scribe' && b && (b.type === 'academy' || b.type === 'library' || b.type === 'study') && cj && cj.kind === 'profession' && cj.job === 'researcher') {
          if (cj.sid !== this.currentSettlement.id) {
            this.ui.msg('You study for another town. (Ask its mayor, or resign and take the post here.)', '#c8c8c8', true);
            break;
          }
          this.ui.open(new ResearchWindow(this.ui, this, this.currentSettlement));
          break;
        }
        // (An oven: anyone can bake something of their own in it; the
        // trade's own goods are for a licensed baker. Round 50.)
        if (st === 'baker' && !this.sim.careers.canUseBench(st)) {
          this.openCooking('o', x, y, z);
          break;
        }
        if (!this.sim.careers.canUseBench(st)) {
          const P = PROFESSIONS[st];
          this.ui.msg(`Only a licensed ${P ? P.title.toLowerCase() : st} knows how to work the ${BLOCKS[id].label.replace(/^.*'s /, '').toLowerCase()}. (Ask a mayor about a licence.)`, '#c8c8c8', true);
          break;
        }
        this.ui.openCrafting(st);
        break;
      }
      case 'torch': {
        // A campfire: somewhere to cook (lit or put out from there too).
        if (id === B.campfire) {
          this.openCooking('c', x, y, z);
          break;
        }
        const on = !w.getState(x, y, z);
        w.setState(x, y, z, on);
        this.audio?.play('torch');
        if (on) this.renderer.emit(x, y, z, { n: 6, color: ['#ffb040', '#ffe070'], up: 30, life: 0.5, oy: -8 });
        this.lightDirty = true;
        break;
      }
      case 'bed':
      case 'hammock':
        this.trySleep(x, y, z);
        break;
      // (Round 68) Inside one of the great ships: her pump, her guns.
      case 'pump':
      case 'cannon':
      case 'blueprint':
        holdUse(this, p, x, y, z, b.interact);
        break;
      // (Round 78) A ship of your own drawn up and built.
      case 'shipdesign':
        this.ui.open(new ShipDesignWindow(this.ui, this));
        break;
      case 'bell':
        this.ringBell(x, z, null, p);
        break;
      case 'well':
        if (this.useWell(x, y, z)) break;
        // (Only a realm that has learned to keep its wells clean.)
        if (this.sim.tech.has(this.world.ow.settlementAt(x, z), 'wells') && p.addBlue(3, `well:${x},${z}`)) {
          p.hp = Math.min(p.maxHp, p.hp + 4);
          this.ui.msg('The water of this well is crisp and pure. You feel hardier: blue hearts, until the day ends.', '#80e0ff');
          this.renderer.emit(p.x, p.y + 1, p.z, { n: 10, color: ['#80c8ff', '#e0f4ff'], up: 30, life: 0.7, gravity: -10 });
        } else {
          p.hp = Math.min(p.maxHp, p.hp + 2);
          this.ui.msg('You drink the cool well water. (+2 HP)', '#80c8ff');
        }
        this.audio?.play('splash');
        break;
      case 'altar': {
        if (this.lastPrayDay === this.day) this.ui.msg('The altar is silent. Come back tomorrow.', '#c8c8c8');
        else {
          this.lastPrayDay = this.day;
          p.hp = p.maxHp;
          // (The devout are heard a little more kindly.)
          const blessed = heroHas(this.hero, 'devout') ? p.addBlue(4, 'altar') : 0;
          this.ui.msg(`A warm light washes over you. Fully healed!${blessed ? ` (+${blessed} blue hearts)` : ''}`, '#ffe8a0');
          this.renderer.emit(p.x, p.y + 1, p.z, { n: 20, color: ['#fff4c0', '#ffe070'], up: 40, life: 1, gravity: -20 });
        }
        break;
      }
      case 'sign': {
        const t = this.signText(x, y, z);
        if (t.ledger) this.ui.openLedger(t);
        else this.ui.openSign(t.lines || t, t.title);
        break;
      }
      case 'bookshelf':
        this.ui.openBook(this.bookText(x, y, z));
        break;
      case 'grave':
        this.ui.openSign(this.sim.graveText(x, z), 'GRAVESTONE');
        break;
      case 'portal': {
        // A portal: where it can take you (see ui/portal.js).
        const s = this.world.ow.settlementAt(x, z);
        const q = s && this.sim.portals.of(s.id);
        if (!q || q.x !== x || q.z !== z) {
          this.ui.msg('An old stone arch. Nothing stirs in it.', '#a8a0c8');
          break;
        }
        this.ui.closeAll();
        this.ui.open(new PortalWindow(this.ui, this, s.id));
        this.audio?.play('portal', this.player);
        break;
      }
      case 'statue': {
        // A hero's statue, or the old one with the town's history cut on
        // the plaque at its foot.
        const s = this.world.ow.settlementAt(x, z);
        if (!s) {
          this.ui.msg('A weathered statue of a forgotten hero.', '#e8e0c8');
          break;
        }
        const t = this.sim.history.statueText(this.world.getLayout(s), x, z);
        this.ui.openSign(t.lines, t.title);
        break;
      }
    }
  }

  // ------------------------------------------------------------ old places
  // A dungeon's way in (or a spire, or anything inside one: see dungeon.js).
  useOldPlace(x, y, z, b) {
    const p = this.player;
    if (this.dungeon) {
      this.dungeon.interact(x, y, z, b);
      return;
    }
    const site = siteAt(this.world, x, z, 4);
    const rec = site ? this.sim.dungeons.get(site.id) : null;
    if (!rec) return;
    if (Math.max(Math.abs(p.x - x), Math.abs(p.z - z)) > 3) {
      this.ui.msg('Closer.', '#c8c8c8', true);
      return;
    }
    // (Round 61) A time crystal in hand: the place turned back.
    const held = p.heldDef();
    if (held && held.kind === 'time_crystal') {
      useTimeCrystal(this, held, rec);
      return;
    }
    if (b.interact === 'kav_pillar') {
      this.offerToSpire(rec);
      return;
    }
    if (b.interact === 'kav_lift' && !(rec.spire && rec.spire.open !== null && rec.spire.open !== undefined)) return;
    if (rec.cleared && rec.type !== 'kavorent') {
      this.ui.msg('The way down has fallen in. There\'s nothing more for anyone down there.', '#c8c8c8');
      return;
    }
    if (this.sim.war.live || this.sim.justice.escort) {
      this.ui.msg('Not now.', '#c8c8c8');
      return;
    }
    rec.known = true;
    // A Kavorent lift: a ride down its shaft (see scenes.liftRide).
    if (rec.type === 'kavorent' && b.interact === 'kav_lift') {
      if (this.scene) return;
      this.scene = liftRide(this, 1, () => this.runFor(rec).enter(), `${cap(rec.name)} - floor 1 of ${rec.depth}`);
      return;
    }
    this.runFor(rec).enter();
  }

  // A cut stone offered to a Kavorent spire: the face you stand at opens.
  offerToSpire(rec) {
    const p = this.player;
    if (rec.spire && rec.spire.open !== null && rec.spire.open !== undefined) {
      this.ui.msg('The spire stands open. Its lift waits inside.', '#5ad8f0');
      return;
    }
    const held = p.heldItem();
    const it = held && ITEMS[held];
    if (!it || !it.gem) {
      this.ui.msg('Runes crawl up the face of the spire, brighten, and fade. At the height of your hand there is a hollow in it, the size and shape of a cut stone.', '#5ad8f0');
      return;
    }
    const dx = p.x - rec.x;
    const dz = p.z - rec.z;
    const side = Math.abs(dx) > Math.abs(dz) ? (dx < 0 ? 1 : 3) : dz < 0 ? 2 : 0;
    const slot = p.inv[p.selected];
    slot.count--;
    if (slot.count <= 0) p.inv[p.selected] = null;
    this.renderer.emit(p.x, p.y + 1.2, p.z, { n: 20, color: [GEMS_COLOR(held), '#ffffff', '#5ad8f0'], up: 40, speed: 50, life: 0.8, glow: true });
    this.ui.msg(`You set the ${it.name.toLowerCase()} in the hollow.`, '#c8fbff');
    // (The rest is a scene: see scenes.js.)
    this.scene = spireOpening(this, rec, side, GEMS_COLOR(held));
  }

  // Near a Kavorent spire: the camera drawn back to take it in, and the
  // blight's motes drifting about you. Returns how near (0 far, 1 at it).
  // How far the camera's drawn back for the great places you're near (as
  // much again of the view): a Kavorent spire, from well out past the
  // blight's edge in to a few paces from its door; an ancient place's
  // gate (round 72), from further off and further back, to take the whole
  // of it in. Eased at both ends.
  // How near the nearest spire is, 0 (out past its blight) to 1 (at its
  // door): as it was before the ancient places shared the camera's
  // drawing back (see placeNearness).
  spireNearness(dt) {
    this.placeNearness(dt);
    return this.spireK || 0;
  }

  placeNearness(dt) {
    const p = this.player;
    const rp = p.renderPos ? p.renderPos() : p;
    let bestSpire = null;
    let bestAnc = null;
    let zoom = 0;
    let spireK = 0;
    for (const s of this.world.sites || []) {
      if (s.x === undefined) continue;
      const spire = s.type === 'kavorent';
      if (!spire && !s.ancient) continue;
      const far = spire ? BLIGHT_R + 14 : 42;
      const near = spire ? 5 : 7;
      const d = Math.hypot(s.x - rp.x, s.z - rp.z);
      if (d >= far) continue;
      if (spire && (!bestSpire || d < bestSpire.d)) bestSpire = { s, d };
      if (!spire && (!bestAnc || d < bestAnc.d)) bestAnc = { s, d };
      const q = Math.max(0, Math.min(1, (far - d) / (far - near)));
      zoom = Math.max(zoom, q * q * (3 - 2 * q) * (spire ? 0.32 : 0.55));
      if (spire) spireK = Math.max(spireK, q * q * (3 - 2 * q));
    }
    this.spireK = spireK;
    this.nearSpire = bestSpire ? bestSpire.s : null;
    this.nearAncient = bestAnc ? bestAnc.s : null;
    // (Violet motes in the blight, rising.)
    if (bestSpire && bestSpire.d < BLIGHT_R && Math.random() < dt * 12) {
      this.renderer.emit(p.x + (Math.random() - 0.5) * 18, p.y + Math.random() * 0.5, p.z + (Math.random() - 0.5) * 12, { n: 1, color: ['#b070e0', '#e090ff', '#5ad8f0'], up: 8, speed: 4, life: 2.2, glow: true, gravity: -6 });
    }
    // (What's in the air round an ancient place: see game/ancient.js.)
    if (bestAnc) ancientAir(this, bestAnc.s, bestAnc.d, dt);
    return zoom;
  }

  // A relic set down, taken up again.
  takeRelic(x, y, z) {
    const r = relicAt(this, x, y, z);
    this.world.setBlock(x, y, z, B.air);
    if (r) this.relics.delete(`${x},${y},${z}`);
    const key = relicItem(r ? r.kind : null, r ? r.shards : 0);
    const left = this.player.give(key, 1);
    if (left) this.spawnDrop(key, 1, x, y, z, true);
    this.renderer.emit(x, y + 0.5, z, { n: 12, color: [ITEMS[key].color, '#ffffff'], up: 20, speed: 20, life: 0.5, glow: true });
    this.ui.msg(`You take up the ${ITEMS[key].name}. Its circle of runes goes out.`, '#e0c890');
    this.audio?.play('pickup');
  }

  // Something below ground, made (or summoned) and set loose.
  spawnMonster(species, x, y, z, opts = {}) {
    // (Down an old place, its own: whichever's there.)
    const run = this.runAt(x) || (this.world.inInstance(x) ? this.dungeon : null);
    if (run) return run.spawn(species, x, y, z, opts);
    const c = new Creature(this, species, x, y, z);
    this.addCreature(c);
    return c;
  }

  // Lights that move about (for the lighting): torches carried after dark,
  // wisps, the Kavorent's constructs. (A few, the nearest.)
  entityLights() {
    const p = this.player;
    const out = [];
    const near = (e) => Math.abs(e.x - p.x) < 22 && Math.abs(e.z - p.z) < 18;
    for (const c of this.creatures) {
      // (A master of an old place sheds its own light, in its own colour.)
      const master = (c.S.boss || c.species === 'saint_shade') && c.inst;
      if (c.dead || !(c.S.light || master) || !near(c) || c.burrowed || c.submerged) continue;
      out.push({ x: c.x, y: c.y + (c.S.floats ? 1 : 0), z: c.z, L: Math.max(c.S.light || 0, master ? 5 : 0), cold: !!(c.S.construct || c.species === 'wisp'), noHalo: !!c.S.noHalo, tint: master ? bossTint(c)[0] : null, ent: c, dy: c.S.floats ? 1 : 0 });
    }
    for (const n of this.npcs) {
      if (n.dead || !near(n)) continue;
      const held = n.heldItem ? n.heldItem() : null;
      const off = n.offhandItem ? n.offhandItem() : null;
      if (held === 'torch' || off === 'torch' || off === 'lantern') out.push({ x: n.x, y: n.y, z: n.z, L: 9, ent: n });
    }
    // (A witch-light lights its way across her hall.)
    for (const o of this.orbs || []) if (!o.done && near(o)) out.push({ x: Math.round(o.x), y: o.y, z: Math.round(o.z), L: 5, tint: o.back ? '#ffe070' : '#a0ff70' });
    out.sort((a, b) => Math.abs(a.x - p.x) + Math.abs(a.z - p.z) - (Math.abs(b.x - p.x) + Math.abs(b.z - p.z)));
    return out.slice(0, 10);
  }

  // Where you are on the world map (down below: where the way in is).
  mapPos() {
    if (this.dungeon) return { x: this.dungeon.rec.x, z: this.dungeon.rec.z };
    return { x: this.player.x, z: this.player.z };
  }

  // A pack someone fell and left down here (whose it is), at (x, y, z).
  packAt(x, y, z) {
    const run = this.dungeon;
    return run && run.packAt && this.world.getBlock(x, y, z) === B.satchel ? run.packAt(x, z) : null;
  }

  openContainerAt(x, y, z, owner = this.containerOwner(x, y, z)) {
    const b = BLOCKS[this.world.getBlock(x, y, z)];
    const slots = this.world.getContainer(x, y, z);
    this.audio?.play('chest');
    const pk = this.packAt(x, y, z);
    this.ui.openContainer(pk ? packLabel(pk) : owner && owner.label ? `${b.label} · ${owner.label}` : b.label, slots, { x, y, z, owner });
    if (owner && owner.sid !== undefined && owner.kind !== 'mine' && owner.kind !== 'work') this.peekWarning(owner);
    if (owner && owner.kind === 'work') this.sim.careers.onOpenContainer({ x, y, z, owner });
  }

  // Chests are kept locked by whoever keeps things in them: a household
  // (not your hosts'), a shop or workshop (not to its staff on shift), and
  // the town hall, whose chests hold the treasury, under an advanced lock
  // (see lockTier). A barrel never is. Picked, a lock stays open a couple
  // of days, till they notice and lock it again.
  chestLocked(x, y, z, owner = this.containerOwner(x, y, z)) {
    if (!owner || (owner.kind !== 'house' && owner.kind !== 'biz') || this.dungeon) return false;
    if (this.world.getBlock(x, y, z) !== B.chest) return false;
    const k = `${x},${y},${z}`;
    const at = this.picked.get(k);
    if (at === undefined) return true;
    if (this.day - at < RELOCK_DAYS) return false;
    this.picked.delete(k);
    return true;
  }

  // (Round 73) What's on a rack or stand now, kept for drawing it (and for
  // the others in the world: see net/host.js). `gone`: it's been broken.
  markContainer(x, y, z, gone = false) {
    const k = `${x},${y},${z}`;
    this.displayShown ||= new Map();
    if (gone) {
      this.displayShown.set(k, []);
      return;
    }
    const slots = this.world.peekContainer(x, y, z);
    if (slots) this.displayShown.set(k, slots.map((q) => (q ? q.item : null)));
  }

  // (Round 73) Tried and locked: "locked" over your head, the rattle of
  // the lock (not too often).
  lockedAt(x, y, z) {
    const p = this.player;
    const now = this.sim.abs || 0;
    if ((p.lockedSaidT || -9) > now - 0.6) return;
    p.lockedSaidT = now;
    this.renderer.floatText(p.x, p.y + 2.6, p.z, 'locked', '#e8d8a0');
    this.audio?.play('locked', { x, z });
  }

  // (Round 73) A locked front door, picked (see doorlocks.js).
  pickDoor(x, y, z) {
    const H = houseOfDoor(this, x, z);
    const owner = H ? { kind: 'house', id: H.b.id, sid: H.s.id, label: H.b.family ? `${H.b.family} family` : null, b: H.b } : null;
    if (owner && this.lockWatched(owner)) {
      this.lockedAt(x, y, z);
      this.peekWarning(owner);
      return;
    }
    this.audio?.play('locked');
    this.ui.open(new LockWindow(this.ui, this, {
      tier: lockTier(H ? H.s : null, owner || {}),
      seed: hash4(x, y, z, 0x7c5),
      label: owner && owner.label ? `The ${owner.label}'s door` : 'This door',
      watched: () => !!owner && this.lockWatched(owner),
      onOpen: () => {
        this.stats.locksPicked = (this.stats.locksPicked || 0) + 1;
        unlockFor(this, x, y, z);
        this.setDoor(x, y, z, true);
      },
    }));
  }

  // Can anyone see you at a household's lock?
  lockWatched(owner) {
    const p = this.player;
    return this.sim.witnesses(owner.sid, p.x, p.z, 6).length > 0;
  }

  // Picking a household's lock (see ui/lockpick.js): with a lockpick, and
  // nobody watching. A village's iron lock is easy; a city manor's steel
  // one is not.
  pickLock(x, y, z, owner) {
    if (countItem(this.player.inv, 'lockpick') <= 0) {
      // (Round 73: said over your head, with the rattle of it.)
      this.lockedAt(x, y, z);
      return;
    }
    const name = owner.label ? owner.label.replace(/ \(.*\)$/, '') : '';
    const whose = name ? `${/^the /i.test(name) ? name : `The ${name}`}'s chest` : 'This chest';
    if (this.lockWatched(owner)) {
      this.ui.msg('Not with someone watching.', '#ffb080', true);
      this.audio?.play('locked');
      this.peekWarning(owner);
      return;
    }
    const s = this.world.ow.settlementAt(x, z);
    const key = `${x},${y},${z}`;
    this.audio?.play('locked');
    this.ui.open(new LockWindow(this.ui, this, {
      tier: lockTier(s, owner),
      seed: hash4(x, y, z, 0x7c4),
      label: whose,
      watched: () => this.lockWatched(owner),
      onOpen: () => {
        this.picked.set(key, this.day);
        this.stats.locksPicked = (this.stats.locksPicked || 0) + 1;
        this.openContainerAt(x, y, z, owner);
      },
    }));
  }

  // A container in a living town that isn't yours: it can't be broken.
  unbreakableChest(x, y, z) {
    if (this.dungeon && this.world.inInstance(x)) return false;
    const own = this.containerOwner(x, y, z);
    return !!(own && own.kind !== 'mine');
  }

  // Who a container belongs to: a household, a business, the player.
  containerOwner(x, y, z) {
    const s = this.world.ow.settlementAt(x, z);
    if (!s || s.condition === 'abandoned' || s.deserted) return null;
    const L = this.world.getLayout(s);
    const b = buildingAt(L, x, z);
    // (Round 79) A rack or stand the town set out in its yards and squares
    // (not one you put up): the town's.
    if (!b) return BLOCKS[this.world.getBlock(x, y, z)]?.display && !this.myChests?.has(`${x},${y},${z}`) && townPlaced(this.world, L, x, y, z) ? { kind: 'town', id: null, sid: s.id, label: s.name } : null;
    const c = this.sim.citizen;
    if (b.playerHome) return c && c.home === b.id && c.sid === s.id ? { kind: 'mine', sid: s.id, label: 'yours' } : { kind: 'house', id: b.id, sid: s.id, label: 'not yours' };
    // Your workshop is yours.
    if (b.playerShop) return { kind: 'mine', sid: s.id, label: 'your workshop' };
    if (b.residential) {
      const host = this.sim.isGuest(s.id, b.id);
      return { kind: host ? 'host' : 'house', id: b.id, sid: s.id, label: b.family ? `${b.family} family${host ? ' (your hosts)' : ''}` : null, b };
    }
    // Staff on shift may use the shop's chests and barrels.
    if (this.sim.careers.onShift(s.id, b.id)) return { kind: 'work', id: b.id, sid: s.id, label: `${b.name} (work)`, b };
    return { kind: 'biz', id: b.id, sid: s.id, label: b.name, b };
  }

  // Rummaging through someone's things in front of them.
  peekWarning(owner) {
    if (owner.kind === 'host') return;
    const p = this.player;
    const a = this.active.get(owner.sid);
    if (!a) return;
    const w = this.sim.witnesses(owner.sid, p.x, p.z, 6).find((n) => n.rec.home === owner.id || (n.rec.work && n.rec.work.building === owner.id));
    if (w && w.state === 'routine') w.say(w.rec.personality.kindness > 0.6 ? 'Can I help you with something?' : 'Hey! Keep your hands off our things!', 3, '#ffb080');
  }

  // Items taken out of a container that isn't yours (called by the window).
  onContainerTake(pos, taken) {
    const owner = pos.owner;
    // Your hosts share what they have while you stay with them.
    if (!owner || owner.kind === 'mine' || owner.kind === 'work' || owner.kind === 'host' || !taken.length) return false;
    const value = taken.reduce((n, t) => n + (ITEMS[t.item]?.value || 1) * t.count, 0);
    const sid = owner.sid;
    const p = this.player;
    const wits = this.sim.witnesses(sid, p.x, p.z, 7);
    const where = owner.kind === 'house' ? `the ${owner.label || 'a'} home` : owner.kind === 'town' ? `${owner.label}'s rack` : `the ${owner.label || 'shop'}`;
    const whose = owner.kind === 'house' ? 'house' : owner.kind === 'town' ? 'town' : 'biz';
    const desc = `Stealing ${taken.map((t) => `${t.count} ${ITEMS[t.item]?.name || t.item}`).slice(0, 2).join(', ')} from ${where}`;
    if (!wits.length) {
      // Nobody saw. The owners will notice later...
      this.sim.justice.unseen(sid, { type: 'theft', x: p.x, z: p.z, value, items: taken, desc, bid: owner.id, owner: { kind: whose, id: owner.id }, ownerName: owner.kind === 'house' ? `${owner.label || ''}`.replace(/ family$/, 's') : owner.kind === 'town' ? `${owner.label} guard` : owner.label });
      return false;
    }
    const victim = wits.find((n) => n.rec.home === owner.id || (n.rec.work && n.rec.work.building === owner.id));
    this.sim.justice.commit(sid, 'theft', { witnesses: wits, value, items: taken, desc, bid: owner.id, owner: { kind: whose, id: owner.id }, victimNpc: victim });
    return true;
  }

  // Items put into a container (shop helpers stocking up).
  onContainerPut(pos, added) {
    return this.sim.careers.onContainerPut(pos, added);
  }

  jailLayoutAt(x, z) {
    for (const s of this.world.ow.settlementsNear(x, z)) {
      const L = this.world.layouts.get(s.id);
      if (L && L.jail && Math.abs(L.jail.door.x - x) <= 3 && Math.abs(L.jail.door.z - z) <= 3) return L;
    }
    return null;
  }

  signText(x, y, z) {
    // (Round 62) A sign in a mod's structure: its own words.
    const ms = this.world.modSigns && this.world.modSigns.get(`${x},${y},${z}`);
    if (ms) return ms;
    const s = this.world.ow.settlementAt(x, z) || this.world.ow.settlementsNear(x, z)[0];
    if (!s) return { lines: ['A weathered sign.', 'The writing has long faded.'] };
    const L = this.world.getLayout(s);
    if (this.world.getBlock(x, y, z) === B.poster) return this.sim.events.posterText(L, x, z);
    const sg = L.signs.find((q) => q.x === x && q.z === z && (q.y === y || q.y === undefined));
    const e = L.econ;
    const living = L.npcs.filter(alive);
    const staff = (b) => living.filter((r) => r.work && r.work.building === b.id).map((r) => `${r.name.first} ${r.name.last} (${jobTitle(r, s).toLowerCase()})`);
    if (sg && sg.kind === 'building') {
      const b = L.buildings[sg.building];
      if (b.residential) {
        if (b.playerHome) return { title: 'HOME', lines: [b.underConstruction ? 'UNDER CONSTRUCTION' : (b.homeName || 'A cottage').toUpperCase(), '', b.underConstruction ? 'Builders are at work here.' : `Home of ${b.homeOwner || this.playerName}.`] };
        const who = living.filter((r) => r.home === b.id);
        const lines = [(b.homeName || b.name).toUpperCase(), ''];
        if (!who.length) lines.push('The house stands empty.');
        else lines.push(`Home of ${who.map((r) => r.name.first).join(', ')}`);
        const lost = L.npcs.filter((r) => r.home === b.id && !alive(r));
        if (lost.length) lines.push('', `In memory of ${lost.map((r) => r.name.first).join(' and ')}.`);
        return { title: 'HOME', lines };
      }
      const lines = [b.name.toUpperCase(), ''];
      const st2 = staff(b);
      if (e.biz && e.biz[b.id] && e.biz[b.id].closed) return { title: 'SIGN', lines: [b.name.toUpperCase(), '', 'CLOSED', '', 'Shut for want of trade.'] };
      const own = living.find((r) => r.life && r.life.owns === b.id);
      if (own) lines.push(`Proprietor: ${own.name.first} ${own.name.last}`);
      if (b.type === 'tavern') {
        const k = e.biz[b.id];
        const menu = k ? ['feast', 'stew', 'gruel'].filter((m) => k.store[m]).map((m) => ITEMS[m].name) : [];
        lines.push('Meals served from dawn till late.', menu.length ? `On the menu: ${menu.join(', ')}` : 'The kitchen is out of food!');
      } else if (b.type === 'townhall') {
        lines.push(`Taxes: ${Math.round(e.tax * 100)}%`, 'Citizenship applications at the desk.');
      } else if (b.type === 'guardhouse') lines.push('Report crimes to the guard.');
      if (st2.length) lines.push('', ...st2.slice(0, 3));
      else if (b.type !== 'townhall') lines.push('', 'Nobody seems to work here now.');
      if (L.jail && L.jail.building === b.id) lines.push('', 'Holding cells within.');
      return { title: 'SIGN', lines };
    }
    if (sg && sg.kind === 'works') {
      const pr = this.sim.works.projects.find((q) => q.id === sg.project);
      if (pr) {
        const pct = Math.round(this.sim.works.frameProgress(pr) * 100);
        const crew = this.sim.builders(L).filter((r) => r.override && r.override.project === pr.id).map((r) => r.name.first);
        const pl = L.plots[pr.plot];
        const size = pl ? `${pl.x1 - pl.x0 + 1} by ${pl.z1 - pl.z0 + 1} paces` : '';
        return {
          title: 'SIGN',
          lines: [
            'UNDER CONSTRUCTION', '', `Here the council of ${s.name} is building`, `${pr.label}.`, '',
            `Begun: day ${Math.floor(pr.start / DAY)}${size ? `   Plot: ${size}` : ''}`,
            `Progress: ${pct}%${pr.road && pr.road.length ? `   (road first: ${pr.road.length} paces)` : ''}`,
            crew.length ? `Builders: ${crew.slice(0, 4).join(', ')}` : 'Builders: the town crew',
            '', 'Keep clear of the site. By order.',
          ],
        };
      }
    }
    if (sg && sg.kind === 'plot') {
      const pl = L.plots[sg.plot];
      if (!pl || pl.taken) return { title: 'SIGN', lines: ['LOT CLAIMED', '', 'Building will begin here shortly.'] };
      const size = `${pl.x1 - pl.x0 + 1} by ${pl.z1 - pl.z0 + 1} paces`;
      const q = L.econ ? this.sim.roads.queue(L) : [];
      const next = q[0];
      const what = next ? (next.kind === 'workshop' ? `${this.playerName}'s ${String(next.title || '').toLowerCase()} workshop`.replace(/ {2}/, ' ') : next.kind === 'home' ? `a cottage for ${this.playerName}` : `a new ${(BUILDING_NAMES[next.type] || next.type).toLowerCase()}`) : null;
      return {
        title: 'SIGN',
        lines: [
          'OPEN LOT', '', `Marked out by the council of ${s.name}.`, `Size: ${size}, with a street at its door.`, '',
          what ? `Waiting for a lot: ${q.length}. Next: ${what}.` : 'Nothing is waiting to be built.',
          '', `New citizens may have a home built here:`, 'ask at the town hall.',
        ],
      };
    }
    if (sg && sg.kind === 'graveyard') {
      const g = L.graveyard;
      const n = g ? g.slots.filter((q) => q.grave).length : 0;
      const recent = g ? g.slots.filter((q) => q.grave && !q.grave.ancestor).sort((a, b) => b.grave.died - a.grave.died).slice(0, 3) : [];
      return { title: 'GRAVEYARD', lines: [`THE RESTING PLACE OF ${s.name.toUpperCase()}`, '', `${n} souls rest here.`, ...(recent.length ? ['', 'Recently laid to rest:', ...recent.map((q) => `${q.grave.name} (day ${q.grave.died})`)] : [])] };
    }
    if (sg && sg.kind === 'board') return { ledger: true, s, L };
    const lines = [`${s.name.toUpperCase()}`, `${s.empire ? 'Imperial capital' : cap(s.type)} of the ${s.civ ? s.civ.name : 'free folk'}`, `Population: ${living.length + this.sim.playerCount(s.id)}`, ''];
    const names = [...new Set(L.buildings.filter((b) => !b.residential).map((b) => b.name))];
    if (names.length) lines.push('Services: ' + names.slice(0, 5).join(', '));
    if (s.condition === 'abandoned') lines.push('', '...someone scrawled: "LEAVE WHILE YOU CAN"');
    else if (this.sim.justice.exiled.has(s.id)) lines.push('', `By order: ${this.playerName} is BANISHED.`);
    else if (s.condition === 'poor') lines.push('', 'NOTICE: Bread rations reduced. By order.');
    else if (s.condition === 'prosperous') lines.push('', 'Market day every day! Travelers welcome.');
    if (this.isWanted(s.id)) lines.push('', 'WANTED: a dangerous stranger. Report to the guard.');
    return { title: 'SIGN', lines };
  }

  bookText(x, y, z) {
    const rand = mulberry32(hash4(x, y, z, this.seed));
    const ow = this.world.ow;
    const civ = ow.civs[Math.floor(rand() * ow.civs.length)];
    const s = ow.settlements[Math.floor(rand() * ow.settlements.length)];
    const books = [
      ['A HISTORY OF THE REALM', `The ${civ ? civ.name : 'old kingdom'} was founded by the ${civ ? civ.people : 'first'} people,`, `who built ${s.name} beside the ${s.river ? 'river' : 'hills'}.`, 'Its values: ' + (civ ? civ.values.join(' and ') : 'unknown') + '.'],
      ['ON MINING', 'Iron sleeps in deep stone below layer four.', 'Gold and gems lie deeper still.', 'Always carry a torch, and a pickaxe of stone or better.'],
      ['THE CRAFTSMAN\'S PRIMER', 'Logs make planks; planks make sticks.', 'A workbench opens the way to tools.', 'Smelt ore in a furnace, then forge at an anvil.'],
      ['BESTIARY', 'Slimes crawl out when the sun sets.', 'Skeletons fear the dawn.', 'Wolves hunt in the dark forests. Travel in daylight.'],
      ['POEMS OF THE ROAD', 'O traveler, the road is long,', 'the lanterns warm, the ale is strong.', 'Rest in beds and heed the bell.'],
    ];
    // In a town's own shelves: its history, often as not.
    const here = ow.settlementAt(x, z);
    if (here && rand() < 0.45) {
      const L = this.world.getLayout(here);
      return [`A HISTORY OF ${here.name.toUpperCase()}`, ...this.sim.history.lines(L, 10)];
    }
    return books[Math.floor(rand() * books.length)];
  }

  // ------------------------------------------------------------ sleep & rest
  trySleep(x, y, z) {
    const p = this.player;
    const h = this.minute / 60;
    const j = this.sim.justice.jail;
    const owner = this.sim.bedOwner(x, z);
    if (owner && owner.kind === 'jail') {
      // (Locked up for the night before the hearing, you can sleep till morning.)
      if (!j || (j.phase !== 'serving' && j.phase !== 'night')) {
        this.ui.msg(j ? 'Not now: the hearing isn\'t over.' : 'You\'d rather not sleep in a cell.', '#c8c8c8');
        return;
      }
    } else if (owner && owner.kind === 'home') {
      const wits = this.sim.witnesses(owner.L.settlement.id, x, z, 6).filter((n) => n.rec.home === owner.b.id);
      if (wits.length) wits[0].say('That\'s my bed! Out!', 3, '#ffb080');
      this.ui.msg(`This bed belongs to the ${owner.family || ''} family.`, '#ffb080');
      return;
    } else if (owner && owner.kind === 'other') {
      this.ui.msg('This isn\'t your home.', '#ffb080');
      return;
    } else if (owner && owner.kind === 'guard') {
      this.ui.msg('A guard\'s cot. Better not.', '#c8c8c8');
      return;
    } else if (owner && owner.kind === 'inn') {
      // (Round 54: see sim/inns.js.)
      this.ui.msg('This room is let by the night. Ask the innkeeper (or whoever keeps the bar) for it.', '#ffd890');
      return;
    } else if (owner && owner.kind === 'taken') {
      this.ui.msg('Someone is already asleep in that bed.', '#c8c8c8');
      return;
    }
    const jailed = j && (j.phase === 'serving' || j.phase === 'night');
    if (!jailed && !this.dungeon) p.spawn = { x: p.x, y: p.y, z: p.z };
    if (!jailed && !(h >= 20 || h < 5)) {
      this.ui.msg('You can only sleep at night. (spawn point set)', '#c8d8ff');
      return;
    }
    // Wake at dawn, or when the sentence ends.
    const now = this.day * DAY + this.minute;
    let wake = jailed && j.phase === 'serving' ? j.release : (h >= 20 ? (this.day + 1) * DAY + 420 : h < 7 ? this.day * DAY + 420 : (this.day + 1) * DAY + 420);
    if (jailed) wake = Math.min(wake, now + 16 * 60);
    this.sleep = { phase: 'in', t: 0, bed: { x, y, z }, from: { x: p.x, y: p.y, z: p.z }, wake, start: now, hp0: p.hp, jail: jailed };
    this.audio?.play('sleep');
    this.stopPlayerActions();
    p.sitting = null;
    p.teleport(x, y, z);
    p.sleeping = true;
    p.dir = 0;
    this.ui.msg(jailed ? 'You lie down on the hard cot...' : 'You climb into bed... (spawn point set)', '#c8d8ff');
    this.audio?.play('select');
  }

  updateSleep(dt, pressed) {
    const sl = this.sleep;
    const p = this.player;
    sl.t += dt;
    const now = this.day * DAY + this.minute;
    const woken = pressed && pressed.some((k) => k.code !== 'ShiftLeft' && k.code !== 'ShiftRight');
    if (sl.phase === 'in') {
      const k = Math.min(1, sl.t / 2.2);
      this.sleepFast = 1 + 59 * k * k;
      if (sl.t >= 2.2) {
        sl.phase = 'deep';
        sl.t = 0;
      }
      if (woken && sl.t > 0.4) this.wakeUp(true);
    } else if (sl.phase === 'deep') {
      this.sleepFast = 60;
      // Resting heals over the night.
      const frac = Math.min(1, (now - sl.start) / Math.max(60, sl.wake - sl.start));
      p.hp = Math.max(p.hp, Math.min(p.maxHp, Math.round(sl.hp0 + (p.maxHp - sl.hp0) * frac)));
      if (now >= sl.wake - 2) this.wakeUp(false);
      else if (woken) this.wakeUp(true);
    } else if (sl.phase === 'out') {
      const k = Math.max(0, 1 - sl.t / 1.4);
      this.sleepFast = Math.max(1, 1 + 59 * k * k * (sl.early ? 0.2 : 1));
      if (sl.t >= 1.4) {
        this.sleepFast = 0;
        this.sleep = null;
        p.sleeping = false;
        const f = sl.from;
        if (!this.occupiedBySolid(f.x, f.y, f.z, p) && this.world.canStand(f.x, f.y, f.z)) p.teleport(f.x, f.y, f.z);
        else {
          const spot = this.findFreeSpot(sl.bed.x, sl.bed.z, sl.bed.y);
          p.teleport(spot.x, spot.y, spot.z);
        }
      }
    }
  }

  // Sit and let the hours pass: time races until then, or until you're
  // disturbed (hurt, or a key pressed) or stand up.
  // (`anywhere`, from the command console: no need to sit down first.)
  startWait(hours, anywhere = false) {
    const p = this.player;
    if ((!p.sitting && !anywhere) || hours <= 0) return false;
    // (Not with a fight going on around you.)
    const live = this.sim.war.live;
    if (live && !live.done && this.sim.war.nearPlayer(live.centre || { x: p.x, z: p.z }, 60)) {
      this.ui.msg('Not with fighting going on around you.', '#ffb080');
      return false;
    }
    this.waiting = { until: this.day * DAY + this.minute + hours * 60, hp: p.hp, t: 0, hours, anywhere };
    if (!anywhere) this.ui.msg(`You settle in to wait ${hours} hour${hours > 1 ? 's' : ''}.`, '#c8d8ff');
    return true;
  }

  // Something's happening right here (a raid, a battle): time stops
  // racing, and you're up if you were asleep.
  disturb(why = null) {
    if (this.sleep && this.sleep.phase !== 'out') this.wakeUp(true);
    if (this.waiting) {
      this.waiting = null;
      this.sleepFast = 0;
      if (why) this.ui.msg(why, '#c8d8ff');
    }
  }

  updateWait(dt, pressed) {
    const w = this.waiting;
    const p = this.player;
    w.t += dt;
    const now = this.day * DAY + this.minute;
    const left = w.until - now;
    const stop = (why) => {
      this.waiting = null;
      this.sleepFast = 0;
      if (why) this.ui.msg(why, '#c8d8ff');
    };
    if ((!p.sitting && !w.anywhere) || p.dead) return stop('You get up.');
    if (p.hp < w.hp) return stop('Something disturbs you!');
    if (pressed && pressed.some((k) => !['ShiftLeft', 'ShiftRight'].includes(k.code)) && w.t > 0.3) return stop('You stop waiting.');
    if (left <= 0) return stop(w.anywhere ? `It's ${String(Math.floor(this.minute / 60)).padStart(2, '0')}:${String(Math.floor(this.minute % 60)).padStart(2, '0')}.` : `${w.hours} hour${w.hours > 1 ? 's' : ''} pass.`);
    // Ease in, and slow down as the time comes.
    this.sleepFast = Math.max(1, Math.min(60, w.t * 30, left / 1.5));
  }

  wakeUp(early) {
    const sl = this.sleep;
    if (!sl || sl.phase === 'out') return;
    sl.phase = 'out';
    sl.t = 0;
    sl.early = early;
    const p = this.player;
    // A real sleep (the night through, or four hours of it at least) and
    // the tiredness of days without one is gone.
    const slept = this.day * DAY + this.minute - sl.start;
    if (!early || slept >= 240) {
      if (p.sleepless > 0) this.ui.msg('You\'ve slept it off: your stamina is back to full measure.', '#c090ff');
      p.awakeSince = this.day * DAY + this.minute;
    }
    if (!early && !sl.jail) {
      // A night in a proper bed (where the realm knows hospitality).
      const s = this.world.ow.settlementAt(sl.bed.x, sl.bed.z);
      if (s && s.condition !== 'abandoned' && this.sim.tech.has(s, 'hospitality') && p.addBlue(2, `bed:${s.id}`)) {
        this.ui.msg(`A night's sleep in a good ${s.name} bed leaves you hardier: a blue heart for today.`, '#a0ffa0');
      }
      // (Or hardened to fire, where the Ashborn know the fire-walk.)
      if (s && s.condition !== 'abandoned' && this.sim.tech.has(s, 'fire_walking') && p.fireWalk !== this.day) {
        p.fireWalk = this.day;
        this.ui.msg(`You wake in ${s.name} with the fire-walkers' ash on your brow: lava and flames do you half the harm today.`, '#ffb070');
      }
      p.hp = p.maxHp;
      this.ui.msg('Good morning! You feel rested.', '#ffe8a0');
    } else if (sl.jail && !early) this.ui.msg('You wake, stiff from the cot.', '#c8d8ff');
    else this.ui.msg('You get up.', '#c8d8ff');
    // Villagers carry on with their day (after a full night, snap them to it).
    if (!early && !sl.jail) {
      for (const a of this.active.values()) for (const n of a.npcs) if (!n.dead && n.state === 'routine' && !n.visit) {
        n.activity = null;
        n.wake();
        n.placeForCurrentActivity();
      }
    }
  }

  // Sit down on a chair, bench or stool.
  sitOn(x, y, z) {
    const p = this.player;
    if (Math.max(Math.abs(p.x - x), Math.abs(p.z - z)) > 1 || Math.abs(p.y - y) > 1) {
      this.ui.msg('Too far away to sit there.', '#c8c8c8');
      return;
    }
    const other = this.entityAt(x, y, z);
    if (other && other !== p) {
      this.ui.msg('Someone is already sitting there.', '#c8c8c8');
      return;
    }
    if (!this.world.canStand(x, y, z)) return;
    p.teleport(x, y, z);
    const id = this.world.getBlock(x, y, z);
    if (BLOCKS[id].rotatable) p.dir = this.world.getMeta(x, y, z) & 3;
    p.sitting = { x, y, z };
    this.stopPlayerActions();
    this.audio?.play('select');
    this.ui.msg('You sit down. (T to wait a while, move to stand up)', '#c8c8c8', true);
  }

  stopPlayerActions() {
    this.fishing = null;
    this.mining = null;
    this.pending = null;
  }

  advanceTime(min) {
    this.minute += min;
    while (this.minute >= DAY_MINUTES) {
      this.minute -= DAY_MINUTES;
      this.day++;
    }
  }

  teleportPlayer(x, y, z) {
    const p = this.player;
    p.sitting = null;
    if (p.raft) {
      p.raft = null;
      p.give('raft', 1);
    }
    this.loadAround(x, z, true);
    const yy = this.world.canStand(x, y, z) ? y : this.world.findStandY(x, z, y);
    p.teleport(x, yy > 0 ? yy : y, z);
    this.renderer.camInit = false;
    this.lightDirty = true;
    this.currentSettlement = this.world.ow.settlementAt(p.x, p.z);
  }

  // ------------------------------------------------------------ water
  // Filling a bucket at a well (returns true if that's what happened).
  useWell(x, y, z) {
    if (this.player.heldItem() !== 'bucket') return false;
    this.fillBucket(x, y, z);
    return true;
  }

  fillBucket(x, y, z) {
    const p = this.player;
    const slot = p.inv[p.selected];
    if (!slot || slot.item !== 'bucket') return false;
    p.inv[p.selected] = { item: 'water_bucket', count: 1 };
    p.doAction(0.3);
    this.audio?.play('fill');
    this.renderer.emit(x, y, z, { n: 8, color: ['#58a8e8', '#8cc8f8', '#e0f4ff'], up: 30, life: 0.5, oy: -4 });
    this.ui.msg('You fill the bucket with water.', '#80c8ff');
    return true;
  }

  // Pour a bucket over a 3x3 patch of farmland: moist soil for a day and a
  // half, and crops grow twice as fast in it.
  waterField(x, y, z) {
    const p = this.player;
    let n = 0;
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) if (this.crops.wetten(x + dx, y, z + dz, 36)) n++;
    if (!n) return false;
    p.inv[p.selected] = { item: 'bucket', count: 1 };
    p.doAction(0.3);
    this.audio?.play('pour');
    this.renderer.emit(x, y + 1, z, { n: 14, color: ['#58a8e8', '#8cc8f8', '#e0f4ff'], up: 20, speed: 40, life: 0.6, oy: -2 });
    this.ui.msg(`You water the soil (${n} patch${n > 1 ? 'es' : ''}). Moist soil grows crops twice as fast.`, '#80c8ff');
    return true;
  }

  // Can the player hear (and see the speech of) someone? Not through the
  // walls of a building they aren't in, unless the door stands open nearby.
  speechAudible(e) {
    if (e.kind !== 'npc' || !e.layout || e.sleeping) return true;
    const b = buildingAt(e.layout, e.x, e.z);
    if (!b || b.underConstruction) return true;
    const p = this.player;
    if (p.x >= b.x0 && p.x <= b.x1 && p.z >= b.z0 && p.z <= b.z1) return true;
    if (this.world.getState(b.door.x, GROUND, b.door.z) && Math.abs(p.x - b.door.x) + Math.abs(p.z - b.door.z) <= 4) return true;
    return false;
  }

  buildingAtPlayer() {
    const s = this.currentSettlement;
    if (!s) return null;
    const L = this.world.layouts.get(s.id);
    return L ? buildingAt(L, this.player.x, this.player.z) : null;
  }

  executePlayer(cause) {
    const p = this.player;
    p.hp = 0;
    p.dead = true;
    this.removeOcc(p);
    this.playerDied({ name: cause });
  }

  // ------------------------------------------------------------ arrows
  // `kind`: an arrow (or a crossbow bolt, a sling stone, a javelin: a
  // javelin is left lying where it falls, to be picked up again).
  shoot(from, target, dmg, kind = 'arrow') {
    const dist = Math.hypot(target.x - from.x, target.z - from.z);
    // (A set stone goes with the arrow: see gems.js.)
    const gem = gemsOf(from).bow;
    const pace = { bolt: 0.7, stone: 0.85, javelin: 1.35 }[kind] || 1;
    // (A Myrrow guard's arrows are tipped with bog venom, where the realm
    // knows how.)
    const venom = from.kind === 'npc' && from.rec && from.rec.job === 'guard' && from.settlement && this.sim.tech.has(from.settlement, 'bog_venom');
    this.projectiles.push({ from, target, x0: from.x, y0: from.y + 1, z0: from.z, tx: target.x, ty: target.y + 1, tz: target.z, t: 0, dur: (0.08 + dist * 0.045) * arrowSpeed(from) * pace, dmg, gem, kind, venom });
    this.audio?.play(kind === 'stone' || kind === 'javelin' ? 'swing' : 'bow', from);
  }

  // A catapult's stone, lobbed high to come down where it's aimed.
  lob(from, tx, ty, tz, dmg) {
    const dist = Math.hypot(tx - from.x, tz - from.z);
    this.projectiles.push({ from, target: null, x0: from.x, y0: from.y + 2, z0: from.z, tx, ty, tz, t: 0, dur: 1.4 + dist * 0.035, dmg, kind: 'boulder', arc: 2 + dist * 0.28 });
    this.audio?.play('catapult', from);
  }

  // A wisp's ball of cold fire, lobbed to burst where it lands.
  lobOrb(from, tx, ty, tz, dmg) {
    const dist = Math.hypot(tx - from.x, tz - from.z);
    this.projectiles.push({ from, target: null, x0: from.x, y0: from.y + 1.5, z0: from.z, tx, ty, tz, t: 0, dur: 0.9 + dist * 0.05, dmg, kind: 'orb', arc: 1 + dist * 0.12 });
  }

  // Something solid overhead (a roof, a ceiling) within a few paces.
  roofed(x, y, z) {
    for (let k = 2; k <= 6; k++) {
      const b = BLOCKS[this.world.getBlock(x, y + k, z)];
      if (b && b.solid && b.opaque) return true;
    }
    return false;
  }

  // Where it bursts: whoever's there and round it is burnt with cold and
  // slowed (unless they rolled clear). (Thrown from out in the open at
  // someone under a roof, it bursts on the roof.)
  orbLands(a) {
    const x = Math.round(a.tx);
    const z = Math.round(a.tz);
    if (a.from && !this.roofed(a.from.x, a.from.y, a.from.z) && this.roofed(x, Math.round(a.ty), z)) {
      let ry = Math.round(a.ty) + 2;
      while (ry < Math.round(a.ty) + 7 && !BLOCKS[this.world.getBlock(x, ry, z)].solid) ry++;
      this.renderer.emit(x + 0.5, ry + 1, z + 0.5, { n: 12, color: ['#80d0ff', '#c0f0ff', '#ffffff'], up: 20, speed: 30, life: 0.5, glow: true });
      this.audio?.play('impact', { x, y: ry, z });
      return;
    }
    const y = this.world.regionAt(x, z) ? this.world.findStandY(x, z, Math.round(a.ty)) : a.ty;
    for (const e of [...this.everyone(), ...this.npcs, ...this.creatures]) {
      if (e.dead || e.down || e === a.from || (e.S && e.S.night) || Math.max(Math.abs(e.x - x), Math.abs(e.z - z)) > 1 || Math.abs(e.y - y) > 2) continue;
      if (e.kind === 'player' && e.rollT > 0) {
        this.renderer.floatText(e.x, e.y + 2, e.z, 'dodged', '#c8e8ff');
        continue;
      }
      this.damage(e, Math.max(1, Math.round(a.dmg * (e.x === x && e.z === z ? 1 : 0.6))), a.from);
      e.slowT = Math.max(e.slowT || 0, 2);
    }
    this.renderer.emit(x + 0.5, y + 0.6, z + 0.5, { n: 16, color: ['#80d0ff', '#c0f0ff', '#ffffff'], up: 30, speed: 40, life: 0.7, glow: true, gravity: -10 });
    this.renderer.effect?.({ type: 'ring', wx: x, wy: y, wz: z, r0: 2, r1: 16, color: ['#80d0ff', '#e0f8ff'], life: 0.45, oy: 3, flat: 0.5 });
    this.audio?.play('impact', { x, y, z });
  }

  // Where it comes down: everyone close by is hurt, dust and splinters fly.
  boulderLands(a) {
    const x = Math.round(a.tx);
    const z = Math.round(a.tz);
    const y = this.world.regionAt(x, z) ? this.world.findStandY(x, z, Math.round(a.ty)) : a.ty;
    for (const e of [...this.everyone(), ...this.npcs, ...this.creatures]) {
      if (e.dead || e.down || Math.max(Math.abs(e.x - x), Math.abs(e.z - z)) > 1 || Math.abs(e.y - y) > 2) continue;
      // (Rolled clear of it.)
      if (e.kind === 'player' && e.rollT > 0) {
        this.renderer.floatText(e.x, e.y + 2, e.z, 'dodged', '#c8e8ff');
        continue;
      }
      this.damage(e, Math.max(1, Math.round(a.dmg * (e.x === x && e.z === z ? 1 : 0.6))), null);
    }
    this.renderer.emit(x + 0.5, y + 0.3, z + 0.5, { n: 18, color: ['#8a8a8a', '#6a5a48', '#a89878', '#5a4a3a'], up: 34, speed: 44, life: 0.9, gravity: 40 });
    this.audio?.play('impact', { x, y, z });
    if (this.inSight(x, z, 0)) this.shake = Math.min(1.3, (this.shake || 0) + 0.3);
  }

  updateProjectiles(dt) {
    // (A javelin lies where it fell.)
    const javelin = (a) => {
      if (a.kind !== 'javelin' || !a.from || a.from.kind !== 'player' || Math.random() >= 0.8) return;
      const y = this.world.findStandY(Math.round(a.tx), Math.round(a.tz), Math.round(a.ty));
      if (y > 0) this.spawnDrop('javelin', 1, Math.round(a.tx), y, Math.round(a.tz));
    };
    for (const a of this.projectiles) {
      a.t += dt;
      // Loosed where you aimed: the first thing in its way, or the ground.
      if (a.aimed) {
        const v = flyAimed(this, a);
        if (v || a.t >= a.dur) {
          a.done = true;
          const hit = !!v && arrowStrikes(this, a, v);
          a.target = v || null;
          javelin(a);
          if (!v && a.kind !== 'pulse') this.audio?.play('thud', { x: a.tx, z: a.tz });
          if (a.kind === 'pulse') {
            // (It bursts where it ends, on whoever or whatever it met.)
            const ex = a.x0 + (a.tx - a.x0);
            const ez = a.z0 + (a.tz - a.z0);
            this.renderer.emit(ex, a.ty + 0.4, ez, { n: 12, color: ['#c8fbff', '#5ad8f0', '#ffffff'], up: 26, speed: 46, life: 0.4, glow: true, gravity: -6 });
            this.renderer.effect?.({ type: 'ring', wx: Math.round(ex), wy: a.ty - 0.6, wz: Math.round(ez), r0: 1, r1: 10, color: ['#5ad8f0', '#e0fcff'], life: 0.3, oy: -6, flat: 0.6 });
          }
          onArrowLand(this, a, hit);
          onArrowMods(this, a, hit);
        }
        continue;
      }
      if (a.t < a.dur) continue;
      a.done = true;
      if (a.kind === 'boulder') {
        this.boulderLands(a);
        continue;
      }
      if (a.kind === 'orb') {
        if (a.onLand) {
          const x = Math.round(a.tx);
          const z = Math.round(a.tz);
          const y = this.world.regionAt(x, z) ? this.world.findStandY(x, z, Math.round(a.ty)) : a.ty;
          a.onLand(this, x, z, y > 0 ? y : a.ty);
        } else this.orbLands(a);
        continue;
      }
      const t = a.target;
      let hit = !t.dead && Math.max(Math.abs(t.x - a.tx), Math.abs(t.z - a.tz)) <= 1 + (t.foot || 0);
      // Turned aside, rolled under, taken on a shield, or home (see
      // archery.js).
      if (hit) hit = arrowStrikes(this, a, t);
      if (hit && a.venom && !t.dead) {
        t.poisonT = 5;
        t.poisonSrc = a.from;
      }
      javelin(a);
      onArrowLand(this, a, hit);
      onArrowMods(this, a, hit);
    }
    this.projectiles = this.projectiles.filter((a) => !a.done);
    updateGemFx(this, dt);
    tickFires(this, dt);
  }

  // Fishing: cast into water, wait for a bite, reel it in.
  castLine(c) {
    return castLine(this, c);
  }

  updateFishing(dt, input) {
    updateFishing(this, dt, input);
  }

  // Weather drifts between clear skies, rain, snow (in cold places) and fog;
  // it's the same weather the towns around you are having.
  updateWeather(dt) {
    // (An opening scene brings its own.)
    if (this.cutscene && this.cutscene.weather) {
      this.weather = this.cutscene.weather;
      return;
    }
    // (No weather below ground.)
    if (this.dungeon) {
      this.weather = null;
      return;
    }
    const w = this.weather || (this.weather = { kind: 'clear', level: 0, t: 0 });
    // Sped-up time speeds the weather up with it.
    const fast = this.sleepFast || 1;
    w.t -= dt * fast;
    if (w.t <= 0) {
      w.t = 2;
      const p = this.player;
      // (Where you stand now: never a stale biome, so no snow in a desert.)
      if (!this.biomeCache || Math.abs(this.biomeCache.x - p.x) + Math.abs(this.biomeCache.z - p.z) > 2) {
        const col = this.world.terrain.column(p.x, p.z, this.world.terrain.context(p.x, p.z, p.x, p.z), {});
        this.biomeCache = { x: p.x, z: p.z, biome: col.biome };
      }
      let kind = weatherAt(this.seed, p.x, p.z, this.day * DAY + this.minute, this.biomeCache.biome);
      // (Round 64) Weather a mod has called down, for a while.
      if (this.modWeather && this.modWeather.until > this.day * DAY + this.minute) kind = this.modWeather.kind;
      // (Near the storm round the islands it's raining whatever the sky's
      // doing elsewhere; and coming and going at its edge doesn't make the
      // rain stop and start over and over.)
      // (And round a spire, in the storm it keeps: see spirestorm.js.)
      const near = Math.max(this.world.ow.stormNear ? this.world.ow.stormNear(p.x, p.z) : 0, this.spireStorm || 0, this.dishStorm && this.dishStorm.until > this.sim.abs ? 0.6 : 0);
      w.stormRain = near > (w.stormRain ? 0.06 : 0.12);
      if (w.stormRain) kind = 'rain';
      if (kind !== w.kind) {
        if (w.seen && kind !== 'clear') this.ui.msg(kind === 'rain' ? 'It starts to rain.' : kind === 'snow' ? 'Snow begins to fall.' : 'A fog rolls in.', '#a0b8d0');
        else if (w.seen && w.kind !== 'fog') this.ui.msg(w.kind === 'rain' ? 'The rain stops.' : 'The snow stops falling.', '#a0b8d0');
        w.kind = kind;
      }
      w.seen = true;
    }
    // Near the storm round the islands: it's always raining there, harder
    // and windier the nearer you come, with lightning.
    // (Round 53: and one a dish called down: see dishacts.js.)
    const sn = Math.max(this.world.ow.stormNear ? this.world.ow.stormNear(this.player.x, this.player.z) : 0, (this.spireStorm || 0) * 0.6, this.dishStorm && this.dishStorm.until > this.sim.abs ? 0.55 : 0);
    w.storm = sn;
    if (w.stormRain && w.kind !== 'rain') w.kind = 'rain';
    w.wind = sn > 0 ? 1 + sn * 2.6 : undefined;
    const target = w.kind === 'clear' ? 0 : Math.max(1, sn * 1.5);
    w.level += Math.sign(target - w.level) * Math.min(Math.abs(target - w.level), (dt * fast) / (sn > 0.12 ? 2 : 8));
    if (sn > 0.45) {
      this.boltT = (this.boltT ?? 4) - dt;
      if (this.boltT <= 0) {
        this.boltT = 3 + Math.random() * 9 * (1.4 - sn);
        this.renderer.flashScreen?.('#e8f0ff', 0.12);
        this.audio?.play('thunder');
      }
    }
  }

  // The weather over a town right now.
  weatherIn(s) {
    return s ? townWeather(this.seed, s, this.day * DAY + this.minute) : this.weather?.kind || 'clear';
  }

  eat() {
    const p = this.player;
    const slot = p.inv[p.selected];
    const def = slot ? ITEMS[slot.item] : null;
    if (!def || def.kind !== 'food') return;
    // (A dish is eaten for what it does, too: hungry or not.)
    if (p.hp >= p.maxHp && !def.dish && !def.anytime) {
      this.ui.msg('You\'re not hungry.', '#c8c8c8');
      return;
    }
    // (An iron stomach gets as much from raw meat as from a roast.)
    const iron = heroHas(this.hero, 'iron_stomach');
    const raw = iron ? ITEMS[{ raw_meat: 'cooked_meat', fish: 'cooked_fish' }[slot.item]] : null;
    const bonus = (heroHas(this.hero, 'healer') ? 2 : 0) + (iron ? 1 : 0);
    // (A hot dish: a little now, the rest over a while; see Player.update.)
    // (Squeamish, raw meat and fish come straight back up.)
    const sick = heroHas(this.hero, 'squeamish') && (slot.item === 'raw_meat' || slot.item === 'fish');
    // (Round 50: 1 to 3 at once, whatever it is; the rest of its good over
    // the next while: see healSplit in items.js.)
    const base = raw && raw.heal > def.heal ? raw : def;
    const heal = sick ? 0 : Math.min(base.now ?? base.heal, 3);
    const later = sick ? 0 : (base.heal - heal) + bonus;
    const secs = base.regenT || Math.max(3, Math.round(later * 1.2));
    p.hp = Math.min(p.maxHp, p.hp + heal);
    if (later > 0) {
      const h = p.slowHeal && p.slowHeal.left > 0 ? p.slowHeal : (p.slowHeal = { left: 0, rate: 0, acc: 0 });
      h.left += later;
      h.rate = Math.max(h.rate, later / secs);
    }
    slot.count--;
    if (slot.count <= 0) p.inv[p.selected] = null;
    p.doAction(0.3);
    this.audio?.play(slot.item === 'ale' || slot.item === 'cocoa' ? 'gulp' : 'eat');
    // Crumbs (or foam) everywhere.
    if (slot.item === 'ale') this.renderer.emit(p.x, p.y + 1, p.z, { n: 5, color: ['#f4ecd8', '#ffffff', '#e8c060'], shape: 'drop', up: 10, speed: 12, gravity: 120, life: 0.5, oy: -2 });
    else this.renderer.emit(p.x, p.y + 1, p.z, { n: 7, chunk: slot.item, up: 22, speed: 22, gravity: 150, life: 0.55, oy: -2 });
    if (slot.item === 'ale' && p.inv.some((q) => !q)) addItem(p.inv, 'empty_mug', 1);
    if (sick) this.ui.msg(`You can't keep the ${def.name.toLowerCase()} down. (+0 HP)`, '#c0a060');
    else this.ui.msg(`${slot.item === 'ale' || slot.item === 'cocoa' ? 'Drank' : 'Ate'} ${def.name}. (+${heal} HP${later > 0 ? `, and ${later} more over ${secs}s` : ''})`, '#80e070');
    // A dish cooked up: what it does starts working (see cooking.js).
    if (!sick && def.dish) {
      eatDish(this, p, def);
      const lines = dishLines(def).filter((l) => !l.dur).map((l) => l.text).join('; ').replace(/:; /g, ': ');
      this.ui.msg(`${def.name}: ${lines}.`, '#ffd890');
      this.refreshBonus();
    }
    // (Round 53: a dish that answers your eating, this one too.)
    if (!sick) dishTrigger(this, p, 'eat', { item: slot.item });
    // (Round 62) A mod's: what it does besides.
    if (!sick && def.mod) modEaten(this, p, def);
    // (Not everywhere eats everything: see culture.js.)
    this.sim.customs.onEat(slot.item);
    // Meal quality matters: bad cooking can turn your stomach, a delightful
    // meal keeps you going for a while.
    if (def.quality === 'terrible' && Math.random() < 0.35) {
      p.hp = Math.max(1, p.hp - 3);
      this.ui.msg('Ugh... your stomach churns. (-3 HP)', '#c0a060');
      this.shake = Math.min(1, this.shake + 0.2);
    } else if (def.quality === 'delightful') {
      p.wellFed = 300;
      this.ui.msg('Delightful! You feel well fed. (faster healing)', '#ffe070');
    }
  }

  talk(npc) {
    if (npc.sleeping) {
      npc.say('Zzz...', 2);
      return;
    }
    // (Round 53: a dish that answers a word with someone: see dishacts.js.)
    dishTrigger(this, this.player, 'talk', { target: npc });
    // People in the middle of something urgent don't stop to chat.
    const busy = { crime: null, arresting: 'Not now! I\'m after someone.', arrested: npc.rng.pick(['Help me!', 'It wasn\'t me!']), toCell: null, jailed: npc.rng.pick(['Come to gawk?', 'Got a file in a loaf of bread?', 'I didn\'t do it.']), flee: 'Not now! Run!', fight: null, alert: 'Not now! GUARDS!', leaving: 'Can\'t stop, I\'m on my way home!', escort: null, warband: npc.warband && npc.warband.foe ? 'Out of my way!' : 'Not now!', captive: npc.rng.pick(['Come to gloat?', 'Get me out of here...', 'Tell my family I\'m alive.', 'When are they trading us back?']), down: null }[npc.state];
    if (busy !== undefined) {
      if (busy) npc.say(busy, 2);
      return;
    }
    npc.face(this.player.x, this.player.z);
    this.player.face(npc.x, npc.z);
    this.ui.openDialogue(npc);
  }

  // ------------------------------------------------------------ items
  spawnDrop(item, count, x, y, z, pop = false, vel = null, delay = 0.4) {
    if (!ITEMS[item] || count <= 0) return;
    const a = Math.random() * Math.PI * 2;
    const v = vel || (pop ? { x: Math.cos(a) * 1.4, y: 4 + Math.random() * 2, z: Math.sin(a) * 1.4 } : { x: 0, y: 0, z: 0 });
    const d = new ItemDrop(this, item, count, x, y, z, v.x, v.y, v.z, delay);
    this.drops.push(d);
    return d;
  }

  // Set what you hold down on the ground where you're pointing (or just in
  // front of you). It stays put until someone mines it back up.
  setDownHeld(all) {
    const p = this.player;
    const slot = p.inv[p.selected];
    if (!slot) return false;
    const c = this.cursor;
    const spots = [];
    if (c && c.x !== undefined && Math.max(Math.abs(c.x - p.x), Math.abs(c.z - p.z)) <= 4) spots.push([c.x, c.z]);
    spots.push([p.x + [0, -1, 0, 1][p.dir], p.z + [1, 0, -1, 0][p.dir]], [p.x, p.z]);
    for (const [x, z] of spots) {
      const y = this.world.findStandY(x, z, p.y);
      if (Math.abs(y - p.y) > 2) continue;
      if (!this.setDown(x, y, z, slot.item, all ? slot.count : 1, null)) continue;
      slot.count -= all ? slot.count : 1;
      if (slot.count <= 0) p.inv[p.selected] = null;
      p.doAction(0.25);
      this.audio?.play('place');
      return true;
    }
    this.ui.msg('There\'s nowhere clear to set that down.', '#c8c8c8', true);
    return false;
  }

  // Put something on the ground at (x, y, z): an empty spot with solid
  // ground under it. `owner` is who it belongs to ({ sid, idx } for
  // townsfolk; null for you).
  setDown(x, y, z, item, count = 1, owner = null) {
    const w = this.world;
    if (!ITEMS[item] || count <= 0 || !w.regionAt(x, z)) return false;
    if (w.getBlock(x, y, z) !== B.air || !BLOCKS[w.getBlock(x, y - 1, z)].solid) return false;
    w.setBlock(x, y, z, B.placed_item);
    this.placed.set(`${x},${y},${z}`, { item, count, owner });
    return true;
  }

  // Pick something set down back up (townsfolk collecting their own).
  takePlaced(x, y, z) {
    const k = `${x},${y},${z}`;
    const got = this.placed.get(k);
    if (!got) return null;
    this.placed.delete(k);
    if (this.world.getBlock(x, y, z) === B.placed_item) this.world.setBlock(x, y, z, B.air);
    return got;
  }

  toss(all) {
    const p = this.player;
    const slot = p.inv[p.selected];
    if (!slot) return;
    const n = all ? slot.count : 1;
    let dx = [0, -1, 0, 1][p.dir];
    let dz = [1, 0, -1, 0][p.dir];
    if (this.cursor && this.cursor.x !== undefined) {
      const vx = this.cursor.x - p.x;
      const vz = this.cursor.z - p.z;
      const l = Math.hypot(vx, vz);
      if (l > 0.1) {
        dx = vx / l;
        dz = vz / l;
      }
    }
    this.tossItem(slot.item, n, dx, dz);
    slot.count -= n;
    if (slot.count <= 0) p.inv[p.selected] = null;
  }

  tossItem(item, count, dx, dz) {
    const p = this.player;
    const d = this.spawnDrop(item, count, p.x, p.y, p.z, false, { x: dx * 5.5, y: 6, z: dz * 5.5 }, 1.2);
    if (d) {
      d.px = p.x + 0.5 + dx * 0.3;
      d.pz = p.z + 0.5 + dz * 0.3;
      d.py = p.y + 0.5;
    }
    p.doAction(0.2);
    this.audio?.play('swing');
  }

  pickupDrops() {
    const p = this.player;
    if (p.dead) return;
    for (const d of this.drops) {
      if (d.dead || d.pickupDelay > 0) continue;
      const dx = d.px - (p.x + 0.5);
      const dz = d.pz - (p.z + 0.5);
      const dist = Math.hypot(dx, dz);
      if (Math.abs(d.py - p.y) > 1.5 || dist > 1.6) continue;
      // (No room for it: it stays where it lies.)
      if (!canAdd(p.inv, d.item, 1)) continue;
      if (dist > 0.6) {
        // Gentle magnet.
        d.px -= dx * 0.2;
        d.pz -= dz * 0.2;
        d.resting = false;
        continue;
      }
      const left = p.give(d.item, d.count);
      if (left < d.count) {
        this.audio?.play(d.item === 'coin' ? 'coin' : 'pickup');
        this.ui.msg(`+${d.count - left} ${ITEMS[d.item].name}`, '#e8e0a0', true);
      }
      if (left === 0) d.dead = true;
      else d.count = left;
    }
  }

  // ------------------------------------------------------------ combat
  // Which way the mouse is from you, as an angle in the world (x, z), or
  // null with no mouse over the view.
  aimAngle() {
    // (Another player's: as they aimed on their own screen.)
    if (this.seat && !this.seat.host) return this.aimFixed ?? null;
    const r = this.renderer;
    const m = r && r.mouse;
    if (!m || !r.toView) return null;
    const p = this.player;
    const rp = p.renderPos ? p.renderPos() : p;
    const [u, v] = r.toView(rp.x, rp.z);
    const px = u * TILE + 8 - r.camX;
    const py = v * TILE - rp.y * LH + LH - 2 - r.camY;
    const du = m.x - px;
    const dv = m.y - py;
    if (Math.abs(du) + Math.abs(dv) < 2) return null;
    const [dx, dz] = r.toWorld(du, dv);
    return Math.atan2(dz, dx);
  }

  // Clicked again while still swinging: the next blow's lined up, to follow
  // straight on from this one (the recovery cut short) if you've the
  // breath for it. One at a time; it lapses if you don't get the chance.
  queueBlow(target, heavy) {
    const p = this.player;
    if (this.queuedBlow || p.dead) return false;
    const cost = staminaCost(styleOf(p), heavy);
    if ((p.stamina ?? 0) < cost) {
      if (!(p.windedNote > 0)) this.renderer?.floatText(p.x, p.y + 2.4, p.z, 'too winded to follow up', '#c8c8c8');
      p.windedNote = 1.5;
      return false;
    }
    this.queuedBlow = { target, heavy, t: 1.2, cut: false };
    return true;
  }

  // Each frame: the lined-up blow, thrown the moment the last one's done.
  tickQueuedBlow(dt) {
    const q = this.queuedBlow;
    if (!q) return;
    const p = this.player;
    q.t -= dt;
    if (q.t <= 0 || p.dead || p.stunT > 0 || p.rollT > 0 || p.guardBroken > 0 || (q.target && (q.target.dead || q.target.down))) {
      this.queuedBlow = null;
      return;
    }
    if (p.swing) return;
    // (The follow-through and half the recovery skipped: that's the combo.)
    if (!q.cut) {
      q.cut = true;
      p.commitT = Math.min(p.commitT || 0, 0.04);
      p.attackCd = Math.max(0, p.attackCd * 0.4);
    }
    if (p.commitT > 0 || p.attackCd > 0) return;
    this.queuedBlow = null;
    p.combo = (p.comboT > 0 ? p.combo || 1 : 1) + 1;
    p.comboT = 1.5;
    if (q.target) this.attack(q.target, q.heavy);
    else this.swingAt();
    if (p.swing && p.combo >= 2) this.renderer?.floatText(p.x, p.y + 2.6, p.z, `combo ×${p.combo}`, '#ffd890');
  }

  swing() {
    this.duelBegins();
    const p = this.player;
    // (Swallowed: every blow's a shove at the inside of it.)
    if (p.swallowed) {
      if (p.attackCd <= 0) {
        p.attackCd = 0.18;
        struggle(this, p);
      }
      return;
    }
    if (p.attackCd > 0) return;
    p.attackCd = 0.3;
    p.doAction(0.22);
    this.audio?.play('swing');
    onSwing(this, p);
    lanceThrust(this, p);
    swatOrbs(this, p);
  }

  // A swing at the air in front of you (a weapon in hand, nothing under
  // the mouse to hit): turned toward the mouse, wound up and committed like
  // any blow, and it lands on whoever's standing there by then (foe or
  // not: a blade swung at a passer-by is an assault), or on a training
  // dummy. A blade in the other hand follows it round, as ever.
  swingAt() {
    this.duelBegins();
    const p = this.player;
    if (p.swallowed) return this.swing();
    if ((p.attackCd > 0 || p.swing || p.commitT > 0) && !(p.rollT > 0 || p.stunT > 0 || p.guardBroken > 0 || p.dead) && !(p.heldDef() && p.heldDef().ranged)) {
      this.queueBlow(null, false);
      return false;
    }
    if (p.attackCd > 0 || p.swing || p.commitT > 0 || p.rollT > 0 || p.stunT > 0 || p.guardBroken > 0 || p.dead || p.tunnel) return false;
    const def = p.heldDef();
    if (def && def.ranged) {
      this.swing();
      return false;
    }
    // Eight ways: toward the mouse (the diagonals too).
    let [dx, dz] = [[0, 1], [-1, 0], [0, -1], [1, 0]][p.dir] || [0, 1];
    const ang = this.aimAngle();
    if (ang !== null) {
      const ax = Math.cos(ang);
      const az = Math.sin(ang);
      if (Math.abs(ax) >= Math.abs(az)) p.face(p.x + Math.sign(ax), p.z);
      else p.face(p.x, p.z + Math.sign(az));
      dx = Math.round(ax);
      dz = Math.round(az);
    }
    const st = styleOf(p);
    const fresh = spend(p, staminaCost(st));
    p.sitting = null;
    const tilesNow = (style) => {
      const ahead = { x: p.x + dx, y: p.y, z: p.z + dz };
      if (style.sweep) {
        const arc = sweepTiles(p, ahead);
        if (!arc.some((t) => t.x === ahead.x && t.z === ahead.z)) arc.push(ahead);
        return arc;
      }
      const reach = style.thrust ? style.reach : 1;
      return [...Array(reach).keys()].map((k) => ({ x: p.x + dx * (k + 1), z: p.z + dz * (k + 1) }));
    };
    const s = playerSwing(this, p, null, false, () => {
      // (A witch-light in the way: knocked back, whatever else it finds.)
      swatOrbs(this, p, dx, dz, st.thrust ? st.reach : 1);
      const tiles = tilesNow(st);
      const foe = this.struckOn(tiles, p)[0] || this.masterNear(p, dx, dz, st);
      if (foe) return this.landBlow(foe, false, fresh, st);
      strikeAnim(p, st);
      p.doAction(0.25);
      // (Nothing there but the air, or a straw man to take it.)
      const dummy = this.dummyOn(tiles, p);
      if (dummy) {
        const { dmg, crit } = this.blowDamage(false, fresh, st);
        this.hitDummy(dummy, dmg, crit, st);
      } else this.audio?.play('swing');
      onSwing(this, p);
      lanceThrust(this, p);
      const off = offhandOf(p);
      if (off) p.offSwing = { t: 0.15, land: () => this.offAir(off, tilesNow) };
      return false;
    });
    p.attackCd = s.dur + (def && def.cooldown ? def.cooldown : 0.4) * cooldownMult(this.hero) * swingMult(p) * (fresh ? 1 : 1.7) / (1 + buffOf(this, 'haste'));
    return true;
  }

  // The second blade, after a swing at the air: whoever's there now (or
  // the dummy again), or just the air.
  offAir(off, tilesNow) {
    const p = this.player;
    const ost = STYLES[weaponStyle(off)];
    const tiles = tilesNow(ost);
    const foe = this.struckOn(tiles, p)[0];
    if (foe) return this.landOff(foe, off, 1);
    strikeAnim(p, ost, true);
    const dummy = this.dummyOn(tiles, p);
    if (dummy) {
      spend(p, Math.max(1, Math.round(staminaCost(ost) / 2)));
      const dmg = Math.max(1, Math.round(ITEMS[off].damage * 0.75 * damageMult(this.hero) * (1 + buffOf(this, 'fury'))));
      this.hitDummy(dummy, dmg, false, ost);
    } else this.audio?.play('swing');
    return false;
  }

  // How soon before a blow a raised guard turns it into a parry.
  parryWindow() {
    return parryWindow(this);
  }

  // Who a blow at those tiles could hurt: a foe first, else anyone at all
  // standing there (not the beast you're sat on).
  struckOn(tiles, by) {
    const foes = this.foesOn(tiles, by);
    if (foes.length) return foes;
    const on = (e) => onTiles(e, tiles) && Math.abs(e.y - by.y) <= 1;
    const out = [];
    // (Another player, when the host lets players fight.)
    if (this.seats) for (const q of partyPlayers(this)) if (q !== by && !q.dead && !q.limbo && on(q) && (this.pvp || boutOf(this, q, by))) out.push(q);
    for (const n of this.npcs) if (n !== by && !n.dead && !n.down && on(n)) out.push(n);
    // (Not a companion: swung through.)
    for (const c of this.creatures) if (!c.dead && !c.petOf && c !== by.mount && !(by.mount && by.mount.creature === c) && on(c)) out.push(c);
    return out;
  }

  // A swing just beside a master (drawn half as big again as anyone): it
  // finds it anyway, if it's in reach and near enough the way you swung.
  masterNear(p, dx, dz, st) {
    const reach = st.thrust ? st.reach : 1;
    const len = Math.hypot(dx, dz) || 1;
    for (const c of this.creatures) {
      if (c.dead || !padded(c) || !inReach(p, c, reach) || Math.abs(c.y - p.y) > 1) continue;
      const vx = c.x - p.x;
      const vz = c.z - p.z;
      // (A broader one is found wider of the swing, too.)
      if ((vx * dx + vz * dz) / (len * (Math.hypot(vx, vz) || 1)) >= (padOf(c) > MASTER_PAD ? 0.5 : 0.6)) return c;
    }
    return null;
  }

  // A training dummy on those tiles (where a blow would catch it).
  dummyOn(tiles, by) {
    for (const t of tiles) {
      for (const y of [by.y, by.y + 1, by.y - 1]) if (this.world.getBlock(t.x, y, t.z) === B.training_dummy) return { x: t.x, y, z: t.z };
    }
    return null;
  }

  // A blow on a dummy: it rocks on its post, straw flies, and it shows
  // what that blow would have done (and, once you ease off, the run of
  // them all together).
  hitDummy(at, dmg, crit, st) {
    const r = this.renderer;
    const heavy = !!(st && st.heavy);
    r.wobble?.(at.x, at.y, at.z, heavy || crit ? 1.6 : 1);
    r.floatText(at.x, at.y + 2.2, at.z, crit ? `${dmg}!` : String(dmg), crit ? '#ffe070' : '#ffffff');
    r.emit(at.x, at.y + 1, at.z, { n: heavy ? 9 : 6, color: ['#e8cc70', '#d0b050', '#a88a3a'], up: 26, speed: 46, gravity: 120, life: 0.55, oy: -10 });
    this.audio?.play('hit', at);
    this.hitStop = Math.max(this.hitStop || 0, heavy || crit ? 0.06 : 0.03);
    this.shake = Math.min(1, (this.shake || 0) + (heavy ? 0.18 : 0.06));
    const key = `${at.x},${at.y},${at.z}`;
    const log = this.dummyLog && this.dummyLog.key === key ? this.dummyLog : (this.dummyLog = { key, at, total: 0, n: 0, best: 0, t0: this.sim.abs });
    log.total += dmg;
    log.n++;
    log.best = Math.max(log.best, dmg);
    log.idle = 0;
    return true;
  }

  // Eased off the dummy: the tally of that run of blows.
  updateDummy(dt) {
    const log = this.dummyLog;
    if (!log) return;
    log.idle += dt;
    if (log.idle < 1.8) return;
    this.dummyLog = null;
    if (log.n < 2) return;
    this.renderer.floatText(log.at.x, log.at.y + 2.8, log.at.z, `${log.total} in ${log.n} blows`, '#a0e0ff');
  }

  // How hard a blow of yours lands (and whether it's a telling one).
  blowDamage(heavy, fresh, st) {
    const p = this.player;
    const def = p.heldDef();
    let dmg = (def && def.damage && !def.ranged ? def.damage : 1 + Math.random() * 1.2) * damageMult(this.hero) * (1 + buffOf(this, 'fury')) * rageMult(p) + (heroHas(this.hero, 'brawler') ? 1 : 0);
    if (!fresh) dmg *= 0.6;
    if (heavy) dmg *= 1.8;
    const crit = Math.random() < (heroHas(this.hero, 'duelist') ? 0.18 : 0.1);
    if (crit) dmg *= 1.8;
    return { dmg: Math.max(1, Math.round(dmg)), crit };
  }

  // Which way the movement keys are held (in world terms), or null.
  heldMove() {
    const input = this.input;
    if (!input || !input.isDown) return null;
    const KEYS = { KeyW: [0, -1], ArrowUp: [0, -1], KeyS: [0, 1], ArrowDown: [0, 1], KeyA: [-1, 0], ArrowLeft: [-1, 0], KeyD: [1, 0], ArrowRight: [1, 0] };
    let d = null;
    if (input.lastMoveKey && input.isDown(input.lastMoveKey)) d = KEYS[input.lastMoveKey];
    else for (const k in KEYS) if (input.isDown(k)) d = KEYS[k];
    if (!d) return null;
    return screenToWorld(d[0], d[1], this.renderer?.view || 0);
  }

  attack(target, heavy = false) {
    this.duelBegins();
    const p = this.player;
    if (p.swallowed) return this.swing();
    // (A siege engine: hacked at, like any timber.)
    if (target.kind === 'prop' && (target.type === 'catapult' || target.type === 'ram')) {
      if (p.attackCd > 0 || p.swing) return;
      if (Math.max(Math.abs(target.x - p.x), Math.abs(target.z - p.z)) > 2) return this.swing();
      p.face(target.x, target.z);
      this.swing();
      hitEngine(this, target, Math.max(2, Math.round((p.heldDef()?.damage || 2) * (p.heldDef()?.tool === 'axe' ? 2 : 1))));
      return;
    }
    if (target.kind === 'prop') return this.swing();
    // (Another player, when players can't fight here: a swing at whatever
    // else is in front of you.)
    if (target.kind === 'player' && !this.pvp && !boutOf(this, target, p)) return this.swingAt();
    if (!target.dead && !(p.heldDef() && p.heldDef().ranged) && (p.attackCd > 0 || p.swing || p.commitT > 0) && !(p.rollT > 0 || p.stunT > 0 || p.guardBroken > 0)) {
      this.queueBlow(target, heavy);
      return;
    }
    if (p.attackCd > 0 || p.swing || p.commitT > 0 || target.dead || p.rollT > 0 || p.stunT > 0 || p.guardBroken > 0 || p.tunnel) return;
    const def = p.heldDef();
    const reach = this.attackReach();
    const quick = 1 / (1 + buffOf(this, 'haste'));
    p.face(target.x, target.z);
    p.sitting = null;
    if (def && def.ranged) {
      if (apart(p, target) > reach) return this.swing();
      // Arrows for a bow, bolts for a crossbow, stones for a sling; a
      // javelin is its own.
      const ammo = def.ammo || 'arrow';
      // (The Pulse Caster: no ammunition, a breath of stamina a shot.)
      if (ammo === 'none') {
        if ((p.stamina ?? 0) < 1.5) {
          this.ui.msg('Too winded to charge the caster.', '#ffb080', true);
          p.attackCd = 0.4;
          return;
        }
        spend(p, 1.5);
      } else if (countItem(p.inv, ammo) <= 0) {
        this.ui.msg(ammo === 'cobblestone' ? 'You have no stones to sling.' : `You have no ${ITEMS[ammo].name.toLowerCase()}s.`, '#ffb080', true);
        this.audio?.play('error');
        p.attackCd = 0.4;
        return;
      }
      if (def.thrown) {
        const s = p.inv[p.selected];
        s.count--;
        if (s.count <= 0) p.inv[p.selected] = null;
      } else if (ammo !== 'none') removeItem(p.inv, ammo, 1);
      p.attackCd = def.cooldown * quick;
      p.doAction(0.3);
      if (def.thrown) strikeAnim(p, STYLES.spear);
      const mark = heroHas(this.hero, 'marksman');
      const kind = def.thrown ? 'javelin' : ammo === 'none' ? 'pulse' : ammo === 'bolt' ? 'bolt' : ammo === 'cobblestone' ? 'stone' : 'arrow';
      this.shoot(p, target, Math.round((def.damage + (mark ? 2 : 0)) * (1 + buffOf(this, 'fury')) * (Math.random() < (mark ? 0.22 : 0.12) ? 1.8 : 1)), kind);
      this.modSwing(p, true);
      return;
    }
    if (!inReach(p, target, reach) || Math.abs(target.y - p.y) > 1) {
      this.swing();
      return;
    }
    // A set gem works by what it's set in (see gems.js): a sapphire blade
    // swings quicker, a ruby throws flame, and so on. Each blow costs
    // stamina (a point for a punch, more for heavier arms): winded, you
    // swing slower and weaker, so flailing away doesn't pay; timing does.
    // The blow's wound up first, and lands when it comes round (see
    // combat.playerSwing).
    const st = styleOf(p);
    const fresh = spend(p, staminaCost(st, heavy));
    p.blocking = false;
    const s = playerSwing(this, p, target, heavy, () => this.landBlow(target, heavy, fresh, st));
    p.attackCd = s.dur + (def && def.cooldown ? def.cooldown : 0.4) * cooldownMult(this.hero) * swingMult(p) * (fresh ? 1 : 1.7) * (heavy ? 1.5 : 1) * quick;
  }

  // Your blow comes round: home, if they're still there.
  landBlow(target, heavy, fresh, st) {
    const p = this.player;
    const def = p.heldDef();
    strikeAnim(p, heavy ? { ...st, heavy: true } : st);
    p.doAction(heavy ? 0.35 : 0.25);
    swatOrbs(this, p, target.x - p.x, target.z - p.z, st && st.thrust ? st.reach : 1);
    const reach = this.attackReach();
    if (target.dead || target.down || !inReach(p, target, reach) || Math.abs(target.y - p.y) > 1 || target.rollT > 0) {
      // Stepped back out of it (or rolled under it): a whiff.
      this.audio?.play('swing');
      onSwing(this, p);
      lanceThrust(this, p);
      if (!target.dead) this.renderer.floatText(target.x, target.y + 2, target.z, 'miss', '#a8a8b0');
      return false;
    }
    let dmg = (def && def.damage && !def.ranged ? def.damage : 1 + Math.random() * 1.2) * damageMult(this.hero) * (1 + buffOf(this, 'fury')) * rageMult(p) + (heroHas(this.hero, 'brawler') ? 1 : 0);
    if (!fresh) dmg *= 0.6;
    if (heavy) dmg *= 1.8;
    // Straight back at them after a parry (or, with a topaz in your armour,
    // straight out of a roll): a sure, hard blow.
    const riposte = p.riposte > 0;
    const fromRoll = !riposte && p.rollStrike > 0;
    if (fromRoll) {
      p.rollStrike = 0;
      this.renderer.floatText(target.x, target.y + 2.4, target.z, 'out of the roll!', '#fff8a0');
    }
    const crit = riposte || fromRoll || Math.random() < (heroHas(this.hero, 'duelist') ? 0.18 : 0.1) + critBonus(p);
    if (crit) dmg *= riposte ? 2.2 : 1.8;
    // (A merciless blade: half as hard again on a foe worn low.)
    dmg *= bladeMult(p, target);
    // (Round 72) The Champion's Gauntlet closed on your hand.
    dmg *= clawMult(p);
    if (riposte) {
      p.riposte = 0;
      this.renderer.floatText(target.x, target.y + 2.4, target.z, 'riposte!', '#ffe070');
    }
    // Caught mid-swing: knocked off their stroke (always, with a heavy
    // blow or a riposte; usually, with a plain one).
    // (Never a master of an old place: only a parry stops one. Round 61.)
    if (target.windup && !(target.isBoss || target.S?.boss) && (heavy || riposte || Math.random() < 0.65)) {
      interrupt(target, heavy ? 0.9 : 0.5);
      this.renderer.floatText(target.x, target.y + 2.8, target.z, 'interrupted', '#ffd0a0');
    }
    // (Round 73) A guard or an adventurer with their blade up for it: parried.
    if (target.kind === 'npc' && target.parryUpT > 0 && guardBlow(this, p, target, dmg, st || {}) === 'parried') return true;
    // Another player (when the host lets players fight) may have a shield
    // up to it, or parry it, as against anyone.
    if (target.kind === 'player') {
      const g = this.asPlayer(target, () => guardBlow(this, p, target, dmg, st || {}));
      if (g === 'parried') return true;
      dmg = g.amount;
      if (Math.round(dmg) <= 0) return true;
    }
    onSwing(this, p, target);
    lanceThrust(this, p, target);
    this.damage(target, Math.max(1, Math.round(dmg)), p, crit);
    clawRend(this, p, target, dmg);
    onBladeHit(this, p, target, { dmg, heavy, crit });
    onBladeMods(this, p, target);
    this.impact(target, heavy || crit || st.heavy ? 2 : 1, st);
    // Knockback (two paces for a heavy blow); with a second blade coming,
    // after that one.
    const off = offhandOf(p);
    const shove = heavy || st === STYLES.maul ? 2 : 1;
    if (!off && !target.moving && target.hp > 0 && !target.sleeping) knock(this, p, target, shove);
    // A sweep catches whoever else is in front of you.
    if (st.sweep) {
      for (const e of this.foesOn(sweepTiles(p, target), p)) {
        if (e === target) continue;
        this.damage(e, Math.max(1, Math.round(dmg * 0.7)), p);
        this.impact(e, 1, st);
        if (!e.moving && e.hp > 0) knock(this, p, e, 1);
      }
    }
    // The blade in your other hand, hard on the heels of the first.
    if (off && !target.dead) p.offSwing = { t: 0.15, land: () => this.landOff(target, off, shove) };
    return true;
  }

  // The off hand's blow (see landBlow).
  landOff(target, off, shove = 1) {
    const p = this.player;
    strikeAnim(p, STYLES[weaponStyle(off)], true);
    this.audio?.play('swing');
    const it = ITEMS[off];
    const reach = Math.max(1, Math.floor(it.reach || 1.4));
    if (target.dead || target.down || apart(p, target) > reach || target.rollT > 0) return false;
    spend(p, Math.max(1, Math.round(staminaCost(STYLES[weaponStyle(off)]) / 2)));
    const dmg = it.damage * 0.75 * damageMult(this.hero) * (1 + buffOf(this, 'fury')) * rageMult(p);
    this.damage(target, Math.max(1, Math.round(dmg)), p);
    this.impact(target, 1, STYLES[weaponStyle(off)]);
    if (!target.moving && target.hp > 0 && !target.sleeping) knock(this, p, target, shove);
    return true;
  }

  // Foes of `by` standing on any of those tiles.
  foesOn(tiles, by) {
    const on = (e) => onTiles(e, tiles) && Math.abs(e.y - by.y) <= 1;
    const out = [];
    for (const c of this.creatures) if (!c.dead && on(c) && (c.hostileNow || c.target === by)) out.push(c);
    for (const n of this.npcs) if (!n.dead && !n.down && on(n) && ((n.state === 'fight' && n.threat === by) || (n.warband && n.warband.foe))) out.push(n);
    return out;
  }

  // A blow that lands: it holds the moment an instant (harder for a heavy
  // one), sparks and spatters, and the screen jolts.
  impact(target, power = 1, st = null) {
    const r = this.renderer;
    this.hitStop = Math.max(this.hitStop || 0, power > 1 ? 0.085 : 0.045);
    this.shake = Math.min(1.3, (this.shake || 0) + (power > 1 ? 0.3 : 0.12));
    r.emit(target.x, target.y + 1.1, target.z, { n: power > 1 ? 10 : 5, color: ['#ffffff', '#fff4c0', '#ffd080'], up: 30, speed: power > 1 ? 90 : 60, life: 0.22, glow: true, gravity: 60 });
    if (st && (st.heavy || st.stagger)) r.emit(target.x, target.y, target.z, { n: 5, color: ['#a89878', '#8a7a5a'], up: 8, speed: 30, life: 0.45, oy: 6, shape: 'puff' });
    if (power > 1) r.effect?.({ type: 'ring', wx: target.x, wy: target.y, wz: target.z, r0: 2, r1: 12, color: '#fff0c0', life: 0.25, oy: -12, flat: 0.6 });
  }

  damage(target, amount, source, crit = false) {
    if (target.dead || target.down) return;
    // (Round 73: under the ground with the Tooth, nothing reaches you.)
    if (target.tunnel && target.tunnel.phase === 'under') return;
    // (A master's summoned things never hurt it, nor it them.)
    if (source && sameSide(source, target)) return;
    // A bout just over: a blow still on its way, or swung without seeing
    // it was done, lands on nothing (and is no crime).
    const da = this.duelAfter;
    if (da && da.t > 0 && source && ((target === da.npc && source.kind === 'player') || (source === da.npc && target.kind === 'player'))) {
      if (!(da.noteT > 0)) {
        da.noteT = 1.5;
        this.renderer.floatText(target.x, target.y + 2.2, target.z, 'the bout is over', '#ffe070');
      }
      return;
    }
    // (With others in the world: it happens as the one hurt, or the one who
    // struck. Players don't hurt each other, unless the host has said they
    // may: see pvp.)
    if (this.seats) {
      // (Two players at a bout, see bout.js: their blows land on each other
      // whether players may fight here or not; just after it, none do.)
      const pp = target.kind === 'player' && source && source.kind === 'player' && source !== target;
      const after = pp && boutJustOver(this, target, source);
      if (after) {
        if (!(after.noteT > 0)) {
          after.noteT = 1.5;
          this.renderer.floatText(target.x, target.y + 2.2, target.z, 'the bout is over', '#ffe070');
        }
        return;
      }
      if (pp && !this.pvp && !boutOf(this, target, source) && !(this.sim.saga && this.sim.saga.feud(target, source))) return;
      const who = target.kind === 'player' && target.seat ? target.seat : source && source.kind === 'player' && source.seat ? source.seat : null;
      if (who && who !== this.seat) return asSeat(this, who, () => this.damage(target, amount, source, crit));
    }
    // (God mode, from the command console.)
    if (target.kind === 'player' && this.cheats && this.cheats.god) return;
    // (Riding a lift: out of reach, in its shaft.)
    if (target.kind === 'player' && this.scene && this.scene.kind === 'lift') return;
    // An adventurer slips a blow and rolls clear.
    if (target.adventurer && source && source !== target && !this.dotHit && target.tryDodge && target.tryDodge(source)) return;
    // Onyx armour: the blow goes through them like smoke.
    if (!this.dotHit && evade(this, target, source)) return;
    // Below ground: a warden's shield, a golem's plates, something burrowed
    // or under the water (see monsters.js).
    if (target.S && source && !this.dotHit) {
      amount = guardFront(this, target, source, amount);
      if (amount <= 0) return;
    }
    // Relics set down near by: a ward, a war totem, a vigil lamp.
    amount = relicDamage(this, target, source, amount);
    // Marked by moonlight: every blow a third harder.
    if (target.markT > 0) amount = Math.round(amount * 1.33);
    const duel = this.duel;
    const inDuel = !!(duel && duel.npc && !duel.npc.dead && ((target === duel.npc && source === this.player) || (target === this.player && source === duel.npc)));
    let armored = false;
    // (A Phase Blade goes through armour as if it weren't all there.)
    const phase = source && !this.dotHit ? pierceOf(source) : 0;
    if (target.kind === 'npc' && target.rec.equipment.armor) {
      amount = Math.max(1, Math.round(amount * (1 - target.rec.equipment.armor * (1 - phase))));
      armored = true;
    }
    // (Round 68: Rune-cut armour's ward turns a whole blow now and then.)
    if (target.kind === 'player' && !this.dotHit && source && source !== target && runeWard(this, target)) return;
    if (target.kind === 'player') {
      // Your armour, and the watch's mail if you wear the colours.
      // (Round 71: softer with the Alinelidan's worms in you.)
      const a = Math.min(ARMOR_CAP, this.sim.careers.armor() + target.armorValue()) * (1 - phase) * (target.worms > 0 ? Math.max(0.3, 1 - 0.18 * target.worms) : 1);
      if (a > 0) amount = Math.max(1, Math.round(amount * (1 - a)));
      armored = a >= 0.1;
      // (A dish that toughens you, or leaves you the softer: cooking.js.)
      const d = Math.max(-0.4, Math.min(0.4, dishFx(target, 'armor')));
      if (d) amount = Math.max(1, Math.round(amount * (1 - d)));
      target.fightAt = this.sim.abs;
    }
    if (source && source.kind === 'player') source.fightAt = this.sim.abs;
    // A fight you're in (the music follows it).
    const foe = target.kind === 'player' ? source : source && source.kind === 'player' ? target : null;
    if (foe) {
      this.combatT = 5;
      this.combatWith = foe.kind === 'npc' ? (foe.rec && foe.rec.bandit !== undefined ? 'bandit' : 'guard') : foe.beast ? 'beast' : 'monster';
    }
    if (armored) this.audio?.play('armor_hit', target);
    // Blue hearts take the blow first.
    // A townsperson who slept in a proper bed (hospitality) shrugs off the
    // first knocks of the day.
    // (They still feel it, and react: only the hurt is spared.)
    const nb = target.kind === 'npc' && target.rec && target.rec.blue;
    let blueSoak = 0;
    if (nb && nb.hp > 0 && nb.day === this.day) {
      blueSoak = Math.min(nb.hp, amount);
      nb.hp -= blueSoak;
      amount -= blueSoak;
    }
    // A ward of moonlight catches what would have felled you. (Round 53:
    // a dish's ward turns the next blow aside whole: see dishacts.js.)
    if (target.kind === 'player' && amount > 0 && dishWarded(this, target)) return;
    if (target.kind === 'player') {
      amount = moonWard(this, target, amount);
      if (amount <= 0) return;
    }
    if (target.kind === 'player' && target.blue && target.blue.hp > 0 && target.blue.day === this.day) {
      const soak = Math.min(target.blue.hp, amount);
      target.blue.hp -= soak;
      amount -= soak;
      if (target.blue.hp <= 0) this.ui.msg('Your blue hearts are gone.', '#80a8ff');
      if (amount <= 0) {
        target.flash = 0.12;
        this.renderer.floatText(target.x, target.y + 2, target.z, `-${soak}`, '#80a8ff');
        this.audio?.play('hurt', target);
        return;
      }
    }
    // A bout between players: the same (see bout.js).
    if (target.kind === 'player' && source && source.kind === 'player' && this.seats && boutBlow(this, target, source, amount)) return;
    // A friendly bout ends when one of you is down to a quarter.
    if (inDuel && target.hp - amount <= Math.ceil(target.maxHp * 0.25)) {
      target.hp = Math.max(1, Math.min(target.hp, Math.ceil(target.maxHp * 0.25)));
      if (target.rec) target.rec.hp = target.hp;
      target.flash = 0.12;
      const won = target === duel.npc;
      this.endDuel(won ? 'won' : 'lost');
      // The one beaten down on one knee, a moment of it (see
      // scenes.duelYield); and for a while after, no blow between you
      // lands, nor counts as a crime: the bout's over.
      this.duelAfter = { npc: duel.npc, t: 7 };
      if (!this.scene) this.scene = duelYield(this, duel.npc, won);
      else (won ? duel.npc : this.player).kneelT = 4;
      return;
    }
    // A brawl between townsfolk: bruises, not bodies.
    if (target.kind === 'npc' && source && source.kind === 'npc' && (source.brawl || target.brawl) && target.hp - amount <= 1) {
      target.hp = 1;
      target.flash = 0.12;
      for (const n of [target, source]) if (n.state === 'fight') n.calmDown(true);
      target.say?.(target.rng.pick(['Enough! Enough!', 'I yield!']), 2);
      return;
    }
    // (Round 62) What a mod's effects make of it (and a master that's made
    // itself untouchable).
    if (MODS.active.length) {
      amount = Math.round(modScaleDamage(target, source, amount));
      if (amount <= 0) {
        this.renderer.floatText(target.x, target.y + 2, target.z, 'no effect', '#c8c8ff');
        return;
      }
    }
    // (Round 71) An evolved master rising rather than dying, the first
    // time; nothing touching it as it rises; the Hero's mercy (see
    // entities/evolved.js).
    if (isEvolved(target) || (source && source.S && source.S.mercy)) {
      amount = evoHurt(this, target, source, amount);
      if (amount <= 0) return;
    }
    // (Round 72) The Champion's Gauntlet on you: a blow lands lighter.
    amount = clawSoak(target, amount);
    target.hp -= amount;
    // (Round 53) A dish that answers a blow taken, or one landed, or your
    // falling below half (see dishacts.js).
    if (amount > 0 && !this.dotHit) {
      if (target.kind === 'player' && !target.dead && target.hp > 0) {
        dishTrigger(this, target, 'hurt', { source });
        if (target.hp < target.maxHp / 2 && target.hp + amount >= target.maxHp / 2) dishTrigger(this, target, 'low', { source });
      }
      if (source && source.kind === 'player' && target !== source && target.kind !== 'player') dishTrigger(this, source, 'strike', { target });
    }
    // (An island master with its own way with a blow that lands: see
    // afflict.js.)
    if (source && source.S && source.S.onStrike && target.kind === 'player' && amount > 0) source.S.onStrike(this, source, target, amount);
    // Jewelled armour answers a blow struck in close.
    if (source && !this.dotHit) onStruck(this, target, source, amount);
    if (MODS.active.length && amount > 0) modHurt(this, target, source, amount);
    target.flash = 0.12;
    this.renderer.floatText(target.x, target.y + 2, target.z, `${crit ? '!' : '-'}${amount || blueSoak}`, amount <= 0 && blueSoak ? '#80a8ff' : target.kind === 'player' ? '#ff5050' : crit ? '#ffe070' : '#ffffff');
    this.renderer.emit(target.x, target.y + 1, target.z, { n: 5, color: target.species === 'slime' ? ['#58c048', '#8ae070'] : target.kind === 'monster' ? ['#e8e4d4', '#b0aca0'] : ['#c82a2a', '#8a1a1a'], up: 30, speed: 50, life: 0.4, oy: -8 });
    this.audio?.play(target.kind === 'player' ? 'hurt' : 'hit', target);
    // (Old bones rattle when struck.)
    if (target.species && /skeleton|bone|lich|revenant/.test(target.species)) this.audio?.play('bones', target);
    if (target.kind === 'player') {
      // It hurts: the screen jolts, and reddens at the edges.
      this.shake = Math.min(1.3, this.shake + 0.45 + Math.min(0.4, amount * 0.05));
      this.hurtFlash = Math.min(1, (this.hurtFlash || 0) + 0.55 + Math.min(0.35, amount * 0.05));
      this.hitStop = Math.max(this.hitStop || 0, 0.05);
      // (Another player by their own name: to themselves they're "You".)
      const by = source && source.kind === 'player' ? source.account?.name || 'Someone' : source && source.name;
      if (by) this.ui.msg(`${by} hits you for ${amount}!`, '#ff7060', true);
    }
    // Hitting your employer ends the job on the spot.
    if (target.kind === 'npc' && source && source.kind === 'player' && this.sim.careers.employs(target)) {
      this.sim.careers.fire(target.layout, this.sim.careers.job, 'You attacked me! Get out, you\'re fired!');
    }
    // Remember who a beast went for (rescuing them earns thanks).
    if (target.kind === 'npc' && source && (source.kind === 'creature' || source.kind === 'monster')) {
      source.victim = target;
      source.victimT = this.sim.abs;
    }
    // A beast you strike turns on you: remember who it was hunting.
    if (source && source.kind === 'player' && target.target && target.target.kind === 'npc') target.hunting = { n: target.target, t: this.sim.abs };
    // Violence against villagers is a crime; witnesses react.
    if (target.kind === 'npc' && source) {
      target.onHurt(source);
      if (inDuel) {
        // (A bout both agreed to is no crime.)
      } else if (target.warband && target.warband.foe) {
        // (Nor is fighting raiders, or soldiers in a battle.)
        if (source.kind === 'player') this.sim.war.onStruck(target);
        if (target.warband.kind === 'bandit' || target.warband.merc || (target.warband.kind === 'saga' && target.warband.band !== undefined)) {
          this.sim.bandits.onHurt(target);
          if (source.kind === 'player' && target.warband.band !== undefined) this.sim.saga?.breakTruce(target.warband.band, source);
        }
      } else if (target.saga && target.saga.outlaw) {
        // (An outlaw under a flag of truce: no crime, but they'll remember.)
        this.sim.saga?.emit('outlaw_struck', { th: target.saga.th, key: target.saga.key, by: SR.pl(sagaPid(source.kind === 'player' ? source : this.player)) });
      } else if (source.kind === 'player' && target.hp > 0) this.crime(target);
      else if (source.kind !== 'player') this.witness(target, source);
    } else if (target.onHurt && source) target.onHurt(source);
    if (target.hp <= 0) {
      // An adventurer spares you (and helps themselves to your purse).
      if (target.kind === 'player' && source && source.adventurer) {
        target.hp = 1;
        this.spared(source);
        return;
      }
      // The town subdues lawbreakers rather than killing them (unless exiled).
      if (target.kind === 'player' && source && source.kind === 'npc' && !source.visit && !source.hired && !source.warband && !this.sim.justice.exiled.has(source.settlement.id)) {
        target.hp = 1;
        this.sim.justice.knockout(source.settlement.id);
        return;
      }
      // A soldier, raider or escaping prisoner may only be knocked down
      // (to be carried off as a prisoner, or get up when it's over).
      if (target.kind === 'npc' && this.sim.war.knockDown(target, source)) return;
      // So may you, on a battlefield.
      if (target.kind === 'player' && this.sim.war.downPlayer(source)) return;
      // Or taken alive, by those sent to take you (see sim/saga).
      if (target.kind === 'player' && this.sim.saga && this.sim.saga.subdue(target, source)) return;
      this.kill(target, source);
    }
  }

  // The player hurt a villager.
  crime(victim) {
    const sid = victim.settlement.id;
    const guard = victim.rec.job === 'guard';
    const wits = this.sim.witnesses(sid, victim.x, victim.z, 8).filter((n) => n !== victim);
    if (!victim.visit) wits.push(victim);
    const name = `${victim.rec.name.first} ${victim.rec.name.last}`;
    // One assault charge per victim per fight.
    const recent = this.sim.justice.pendingIn(sid).find((c) => (c.type === 'assault' || c.type === 'assault_guard') && c.victim === name && c.day === this.day);
    if (!recent) this.sim.justice.commit(sid, guard ? 'assault_guard' : 'assault', { witnesses: wits, victim: name, victimNpc: victim });
    else {
      this.sim.changeRep(victim, -10);
      this.wanted.set(sid, Math.max(this.wanted.get(sid) || 0, 1e9));
    }
    this.witness(victim, this.player);
  }

  // Bystanders react to a villager being hurt (by the player or a monster).
  witness(victim, attacker) {
    const a = this.active.get(victim.settlement.id);
    if (!a) return;
    for (const n of a.npcs) {
      if (n === victim || n.dead || n.state !== 'routine') continue;
      if (n.distTo(victim) > 8) continue;
      n.react(attacker, true, victim);
    }
  }

  alertGuards(sid, threat, caller) {
    const guards = this.guardsOf(sid);
    let called = 0;
    for (const g of guards) {
      const d = g.distTo(caller);
      if (d > 60 && called > 0) continue;
      if (g.sleeping && d > 14) continue;
      if (g.sleeping) g.wake();
      g.engage(threat);
      called++;
    }
    if (called && threat.kind === 'player') this.ui.msg('The guards have been called!', '#ff7060');
    if (Math.max(Math.abs(caller.x - this.player.x), Math.abs(caller.z - this.player.z)) < 20) this.audio?.play('alarm');
  }

  findGuardTarget(guard) {
    const sid = guard.settlement.id;
    // Whoever's wanted here (or exiled from here), and in sight: each of
    // you by your own record.
    for (const p of this.everyone()) {
      const after = this.asPlayer(p, () => {
        const jailed = this.sim.justice.jail && this.sim.justice.jail.sid === sid;
        return !jailed && (this.isWanted(sid) || this.sim.justice.exiled.has(sid));
      });
      if (after && !p.dead && !p.limbo && guard.distTo(p) <= 12 && this.sim.canSee(guard, p.x, p.z, p.y)) return p;
    }
    const b = guard.settlement.bounds;
    const watching = guard.act === 'watch';
    // Raiders in (or at the edge of) town.
    const mine = guard.settlement.civ ? guard.settlement.civ.id : -1;
    for (const n of this.npcs) {
      if (n.dead || n.down || !n.warband || !(n.warband.kind === 'raid' || n.warband.kind === 'escape' || n.warband.kind === 'bandit') || n.warband.civ === mine || (n.warband.phase === 'flee' && n.warband.kind !== 'escape')) continue;
      if (guard.distTo(n) <= (watching ? 14 : 12)) return n;
    }
    for (const c of this.creatures) {
      if (c.dead || !c.hostileNow) continue;
      if (guard.distTo(c) > (watching ? 11 : 9)) continue;
      // Out guarding a miner, any beast nearby is theirs to deal with.
      if (!watching && (c.x < b.x0 - 10 || c.x > b.x1 + 10 || c.z < b.z0 - 10 || c.z > b.z1 + 10)) continue;
      return c;
    }
    return null;
  }

  findPrey(c, range) {
    let best = null;
    let bd = range + 1;
    // (Not you while you're gone into shadow. The nearest of you, with
    // others playing: one at a time.)
    for (const p of this.everyone()) {
      if (p.dead || p.down || p.limbo || p.shadeT > 0 || Math.abs(p.y - c.y) > 2) continue;
      const d = c.distTo(p);
      if (d <= range && d < bd) {
        best = p;
        bd = d;
      }
    }
    for (const n of this.npcs) {
      if (n.dead || n.sleeping) continue;
      const d = c.distTo(n);
      if (d < bd && d <= range) {
        best = n;
        bd = d;
      }
    }
    if (c.species === 'wolf') {
      for (const o of this.creatures) {
        if (o.S.mode !== 'passive' || o.dead || o.species === 'chicken') continue;
        const d = c.distTo(o);
        if (d < bd && d <= range) {
          best = o;
          bd = d;
        }
      }
    }
    return best;
  }

  nearestThreatTo(c, r) {
    for (const p of this.everyone()) {
      if (p.dead || p.limbo || c.distTo(p) > r) continue;
      // (Round 73: a beast that can be tamed isn't put off by an empty
      // hand, nor by something it'd eat held out; and not at all just
      // after it's been fed.)
      if (c.S.tame && (c.calm > 0 || !p.heldDef()?.damage || HORSE_FOOD.has(p.heldItem()))) continue;
      return p;
    }
    for (const o of this.creatures) if (o !== c && o.hostileNow && c.distTo(o) <= r) return o;
    return null;
  }

  kill(e, source) {
    if (this.seats) {
      const who = e.kind === 'player' && e.seat ? e.seat : source && source.kind === 'player' && source.seat ? source.seat : null;
      if (who && who !== this.seat) return asSeat(this, who, () => this.kill(e, source));
    }
    // (Round 71: an evolved master won't die the first time, however it's
    // put down.)
    if (isEvolved(e) && !e.enraged && !e.dead && rise(this, e)) return;
    onKill(this, e, source);
    if (MODS.active.length) modKilled(this, e, source);
    // (The stories hear of it: see sim/saga.)
    this.sagaKill(e, source);
    // (A dish that answers a kill: see dishacts.js.)
    if (source && source.kind === 'player' && e.kind !== 'player' && e.kind !== 'item') dishTrigger(this, source, 'kill', { target: e });
    // (Down an old place: its own reckoning, as one of you down there.)
    const run = e.inst ? this.runAt(e.x) : null;
    if (run) {
      if (this.dungeon === run) run.onKill(e);
      else this.inPlace(run, () => run.onKill(e));
    }
    e.dead = true;
    this.removeOcc(e);
    this.renderer.emit(e.x, e.y + 1, e.z, { n: 16, color: e.kind === 'npc' || e.kind === 'player' ? ['#c82a2a', '#e8e0d0', '#8a1a1a'] : ['#e8e0d0', '#a8a098'], up: 50, speed: 70, life: 0.8, oy: -8 });
    if (e.kind === 'player') {
      this.playerDied(source);
      return;
    }
    this.audio?.play('death', e);
    // A beast killed by the town where the faith forbids it.
    if (e.kind === 'creature' && source && source.kind === 'player') this.sim.customs.onKill(e);
    // A horse tied up (a town's, a company's, a visitor's) killed: gone.
    if (e.kind === 'creature' && e.standKey && !e.own) this.standSlain(e);
    if (e.kind === 'npc') {
      e.releaseSpot();
      const L = e.layout;
      const rec = e.rec;
      const sid = e.settlement.id;
      // Everything they carried falls to the ground.
      for (const it of rec.equipment.items) this.spawnDrop(it.item, it.count, e.x, e.y, e.z, true);
      for (const it of rec.inv || []) this.spawnDrop(it.item, it.count, e.x, e.y, e.z, true);
      if (e.visit) for (const [k, n] of Object.entries(e.visit.goods)) this.spawnDrop(k, n, e.x, e.y, e.z, true);
      // An adventurer's armour and pack too.
      if (rec.adventurer !== undefined) {
        for (const k of Object.values(rec.wear || {})) if (k) this.spawnDrop(k, 1, e.x, e.y, e.z, true);
        const adv = this.sim.adventurers.get(rec.adventurer);
        if (adv) for (const [k, n] of Object.entries(adv.pack)) if (n > 0) this.spawnDrop(k, n, e.x, e.y, e.z, true);
        this.sim.adventurers.died(rec.adventurer, source && source.kind === 'player' ? 'slain' : 'killed');
        if (this.duel && this.duel.npc === e) this.duel = null;
      }
      rec.inv = [];
      const coins = rec.coins || 0;
      if (coins) this.spawnDrop('coin', coins, e.x, e.y, e.z, true);
      rec.coins = 0;
      const byPlayer = source && source.kind === 'player';
      const cause = e.warband ? this.sim.war.cause(e) : byPlayer ? 'slain' : source ? `killed by a ${(source.name || 'beast').toLowerCase()}` : 'misadventure';
      rec.ent = null;
      // A raider or a soldier fallen in a fight: war, not murder.
      if (e.warband) {
        this.sim.recordDeath(e.originLayout || L, rec, cause, null);
        this.sim.war.onDeath(e, source);
        if (e.warband.kind === 'bandit' || e.warband.merc || (e.warband.kind === 'saga' && e.warband.band !== undefined)) this.sim.bandits.onKilled(e, source);
        if (byPlayer) this.stats.kills++;
        const civ = e.warband.civ !== null && e.warband.civ !== undefined ? this.world.ow.civs[e.warband.civ] : null;
        // (The first few by name; the rest are counted at the end.)
        const live = this.sim.war.live;
        if (live) live.told = (live.told || 0) + 1;
        if ((!live || live.told <= 3) && Math.max(Math.abs(e.x - this.player.x), Math.abs(e.z - this.player.z)) < 24) this.ui.msg(`${e.name}${civ ? ` of the ${civ.name.replace(/^The /, '')}` : ''} has fallen.`, '#ff9080');
        return;
      }
      // Dead, for good: mourned, buried, and never back (asleep in bed or
      // out in the street).
      this.sim.recordDeath(e.originLayout || L, rec, cause, byPlayer ? 'player' : null);
      if (byPlayer) {
        this.stats.kills++;
        this.ui.msg(`${e.name} the ${e.title} has died.`, '#ff7060');
        const wits = this.sim.witnesses(sid, e.x, e.z, 10);
        const vname = `${rec.name.first} ${rec.name.last}`;
        if (wits.length) this.sim.justice.commit(sid, 'murder', { witnesses: wits, victim: vname });
        else {
          // Only the victim saw it: that knowledge dies with them. The body
          // will be found, and the town will ask who was seen nearby.
          this.sim.justice.forgetVictim(sid, rec.idx);
          this.sim.justice.unseen(sid, { type: 'murder', x: e.x, z: e.z, victim: vname, victimIdx: rec.idx, desc: `The murder of ${vname}` });
        }
        this.witness(e, source);
      } else this.ui.msg(`${e.name} the ${e.title} was killed!`, '#ff9080');
      // Family and friends who see it are devastated.
      const a = this.active.get(sid);
      if (a && !e.visit && rec.adventurer === undefined) for (const n of a.npcs) {
        if (n.dead || n === e || n.distTo(e) > 16) continue;
        const r = n.rec;
        const fam = r.partner === rec.idx || r.children.includes(rec.idx) || r.parents.includes(rec.idx) || r.household === rec.household;
        const friend = (r.friends || []).includes(rec.idx);
        if (fam) n.say(n.rng.pick([`${rec.name.first}! NO!`, `Not ${rec.name.first}! No, no, no...`, `${rec.name.first}!!`]), 4, '#ff9080');
        else if (friend) n.say(n.rng.pick([`${rec.name.first}...? No!`, `They killed ${rec.name.first}!`]), 3.5, '#ffb080');
        else if (n.distTo(e) <= 8) n.say(n.rng.pick(['Oh no...', 'Someone help!', 'Gods, no!']), 2.5, '#ffe070');
        else continue;
        if (n.state === 'routine' && source) n.react(source, true, e);
      }
    } else {
      const npcKill = source && source.kind === 'npc' && source.rec && source.rec.inv;
      if (!npcKill) this.stats.kills++;
      if (source && source.kind === 'player') {
        this.checkPoaching(e);
        this.sim.careers.onKill(e);
        this.sim.favors.onKill(e);
        if (e.hostileNow) this.rescued(e);
      }
      // Died on fire (or just after): the meat comes off it roasted.
      const roasted = e.burnT !== undefined && e.burnT > -1.5;
      // (A tracker knows how to dress a carcass.)
      const dress = source && source.kind === 'player' && heroHas(this.hero, 'tracker');
      // (Round 78) A ship's hand (a pirate's, say) has no beast's drops: a
      // pirate has a few coins on them, now and then their cutlass.
      const drops = e.S ? e.S.drops : e.kind === 'sailor' && isPirate(e) ? [['coin', 2, 9, 0.7], ['sabre', 1, 1, 0.08]] : [];
      for (const [drop, min, max, chance] of drops) {
        if (Math.random() > (dress && (drop === 'raw_meat' || drop === 'leather') ? Math.min(1, chance + 0.3) : chance)) continue;
        const item = roasted && drop === 'raw_meat' ? 'cooked_meat' : drop;
        const n = min + Math.floor(Math.random() * (max - min + 1)) + (dress && (drop === 'raw_meat' || drop === 'leather') ? 1 : 0);
        if (npcKill) invAdd(source.rec.inv, item, n);
        else this.spawnDrop(item, n, e.x, e.y, e.z, true);
      }
      // (What it had taken off you: a lantern thief's prize.)
      if (e.loot) this.spawnDrop(e.loot.item, e.loot.n, e.x, e.y, e.z, true);
      // (What its kind does as it dies: see islemobs.js.)
      if (e.S && e.S.onDeath) e.S.onDeath(this, e, source);
      if (npcKill) source.onKill?.(e);
    }
  }

  // You killed a beast that was after someone: they, their family and
  // anyone who watched are grateful.
  rescued(beast) {
    const saved = new Set();
    for (const n of this.npcs) {
      if (n.dead || n.hired) continue;
      const was = beast.hunting && beast.hunting.n === n && this.sim.abs - beast.hunting.t < 10;
      const hunted = (beast.target === n || was) && beast.distTo(n) <= 8;
      const bitten = beast.victim === n && this.sim.abs - (beast.victimT || -1e9) < 10;
      const scared = n.threat === beast && ['flee', 'fight', 'alert'].includes(n.state);
      if (hunted || bitten || scared) saved.add(n);
    }
    if (!saved.size) return 0;
    const p = this.player;
    const deeds = new Map();
    for (const n of saved) {
      const sid = this.sim.repSidOf(n);
      deeds.set(sid, (deeds.get(sid) || 0) + (n.rec.job === 'guard' ? 1 : 3));
      const gain = n.rec.job === 'guard' ? 3 : 8;
      this.sim.changeRep(n, gain, 'saved');
      n.say(n.rng.pick(n.rec.job === 'guard' ? ['Good work. I owe you one.', 'Nicely done!'] : ['You saved me! Thank you!', 'Thank the stars you were here!', 'I thought I was done for... thank you!']), 3.5, '#a0e0a0');
      n.face(p.x, p.z);
      const a = this.active.get(n.settlement.id);
      if (!a) continue;
      for (const o of a.npcs) {
        if (o === n || o.dead || saved.has(o)) continue;
        const r = o.rec;
        const fam = r.partner === n.rec.idx || r.children.includes(n.rec.idx) || r.parents.includes(n.rec.idx);
        if (fam) this.sim.changeRep(o, 5);
        else if (o.distTo(beast) <= 10 && this.sim.canSee(o, beast.x, beast.z)) this.sim.changeRep(o, 2);
      }
    }
    this.stats.rescues = (this.stats.rescues || 0) + saved.size;
    for (const [sid, pts] of deeds) this.sim.addRenown(sid, pts, 'saving lives');
    this.ui.msg(saved.size > 1 ? `You saved ${saved.size} people from the ${(beast.name || 'beast').toLowerCase()}.` : `You saved ${[...saved][0].rec.name.first} from the ${(beast.name || 'beast').toLowerCase()}.`, '#a0e0a0');
    return saved.size;
  }

  // ------------------------------------------------------------ the stories
  // (See sim/saga.) Who did it, as the stories know them.
  sagaRefOf(src) {
    if (!src) return null;
    if (src.kind === 'player') return SR.pl(sagaPid(src));
    if (src.kind === 'npc' && src.rec) {
      const wb = src.warband;
      if (src.rec.adventurer !== undefined) return SR.adv(src.rec.adventurer);
      if (wb && wb.band !== undefined && wb.member !== undefined) return SR.bandit(wb.band, wb.member);
      if (!src.rec.visitor) return SR.rec(src.rec.sid ?? src.settlement.id, src.rec.idx);
      return null;
    }
    if (src.saga && src.saga.den) return SR.den(src.saga.den);
    return null;
  }

  // Someone or something killed: the stories hear of it.
  sagaKill(e, source) {
    const S = this.sim.saga;
    if (!S) return;
    if (e.sagaKey) S.onKilled(e, source);
    if (e.kind === 'player') return;
    const base = { by: this.sagaRefOf(source), x: Math.round(e.x), z: Math.round(e.z), byActor: (source && source.sagaKey) || null, actor: e.sagaKey || null, name: e.name };
    if (e.kind === 'npc') {
      const rec = e.rec;
      const wb = e.warband;
      const who = rec.adventurer !== undefined ? SR.adv(rec.adventurer) : wb && wb.band !== undefined && wb.member !== undefined ? SR.bandit(wb.band, wb.member) : !rec.visitor ? SR.rec(rec.sid ?? e.settlement.id, rec.idx) : null;
      S.emit('kill', { ...base, victim: who, npc: true, job: rec.job, hostile: !!(wb && wb.foe) });
    } else S.emit('kill', { ...base, species: e.species, hostile: !!e.hostileNow || (e.S && e.S.mode === 'hostile'), den: e.saga && e.saga.den ? e.saga.den : null });
  }

  // What's over their head for you (see sim/saga and the renderer).
  questMark(npc) {
    const S = this.sim && this.sim.saga;
    if (!S || !npc.rec) return null;
    if (Math.abs(npc.x - this.player.x) > 24 || Math.abs(npc.z - this.player.z) > 18) return null;
    const k = `${npc.id}`;
    const c = this.markCache || (this.markCache = { t: -1, map: new Map() });
    const now = Math.floor(this.sim.abs);
    if (c.t !== now || c.pid !== sagaPid(this.player)) {
      c.t = now;
      c.pid = sagaPid(this.player);
      c.map.clear();
    }
    if (!c.map.has(k)) c.map.set(k, S.markOf(npc, c.pid));
    return c.map.get(k);
  }

  sagaPerson(a, spot, th) {
    return spawnPerson(this, a, spot, th);
  }

  sagaBeast(a, spot, th) {
    return spawnBeast(this, a, spot, th);
  }

  playerDied(source) {
    const p = this.player;
    this.audio?.play('death');
    this.sim.saga?.emit('player_died', { pid: sagaPid(p), by: this.sagaRefOf(source), byActor: (source && source.sagaKey) || null, byName: source ? source.name : null, x: p.x, z: p.z, sid: this.currentSettlement ? this.currentSettlement.id : null });
    // Down below: what you found there (and half your coin) is left where
    // you fell (see DungeonRun.spill).
    const spilled = this.dungeon && this.dungeon.carried ? this.dungeon.spill() : null;
    // Drop some coins.
    const coinSlot = this.dungeon && this.dungeon.carried ? -1 : p.inv.findIndex((s) => s && s.item === 'coin');
    if (coinSlot >= 0) {
      const lost = Math.ceil(p.inv[coinSlot].count / 2);
      removeItem(p.inv, 'coin', lost);
      this.spawnDrop('coin', lost, p.x, p.y, p.z, true);
    }
    // Fallen: the dark, and the Kavorent's rite that brings you back (see
    // scenes.deathRitual; it raises you itself, at the end).
    // (Struck down by another player: by their name.)
    const by = source && source.kind === 'player' && source.seat ? source.seat.name : source ? source.name : null;
    this.scene = deathRitual(this, source ? by || 'something' : 'misfortune', spilled ? (spilled.length ? 'pack' : 'none') : null);
  }

  respawn() {
    const p = this.player;
    // (Raised some other way than by the rite: it's over.)
    if (this.scene && this.scene.kind === 'death' && !this.scene.reborn) this.scene = null;
    // (Dead down below: you wake up above, and what you dropped stays down
    // there. With the rest of the party still down there, you wake where
    // the floor begins, beside them.)
    if (this.dungeon && this.dungeon.partyBelow(p)) {
      const d = this.dungeon.data;
      const at = d.upAt || { x: d.up.x, z: d.up.z + 1 };
      p.raft = null;
      p.dead = false;
      p.hp = p.maxHp;
      p.sitting = null;
      p.sleeping = false;
      this.sleep = null;
      this.sleepFast = 0;
      const spot = this.findFreeSpot(at.x, at.z, p.y);
      p.teleport(spot.x, spot.y, spot.z);
      this.renderer.camInit = false;
      return;
    }
    if (this.dungeon) this.dungeon.leave();
    // The raft drifted off.
    p.raft = null;
    p.dead = false;
    p.hp = p.maxHp;
    p.sitting = null;
    p.sleeping = false;
    this.sleep = null;
    this.sleepFast = 0;
    // Petty crimes are forgotten; serious ones keep you wanted.
    for (const sid of [...this.wanted.keys()]) {
      this.sim.justice.forgetMinor(sid);
      if (!this.sim.justice.pendingIn(sid).length) this.wanted.delete(sid);
    }
    for (const n of this.npcs) if (n.state === 'fight' && n.threat === p) n.calmDown();
    const s = p.spawn;
    this.loadAround(s.x, s.z, true);
    const spot = this.findFreeSpot(s.x, s.z, s.y);
    p.teleport(spot.x, spot.y, spot.z);
    this.renderer.camInit = false;
  }

  updateWanted(dt) {
    for (const [sid, t] of this.wanted) {
      const nt = t - dt;
      if (nt <= 0) {
        this.wanted.delete(sid);
        this.sim.justice.forgetMinor(sid);
        const s = this.world.ow.settlements[sid];
        this.ui.msg(`The guards of ${s.name} have lost interest in you.`, '#a0e0a0');
      } else if (t < 1e8) this.wanted.set(sid, nt);
    }
  }

  // ------------------------------------------------------------ spawning
  addCreature(c) {
    this.creatures.push(c);
    this.moveEntity(c, c.x, c.y, c.z);
    if (c.foot) (this.bigs ||= []).push(c);
  }

  spawning(dt) {
    // (Below ground, nothing wanders in from outside; nor while a story
    // opens, but for others playing.)
    if (this.dungeon || (this.cutscene && !this.isParty())) return;
    this.spawnT -= dt;
    if (this.spawnT > 0) return;
    this.spawnT = 2.5;
    // (Round each of you up on the island in turn: those down an old place
    // have its own.)
    const all = this.upTop();
    if (!all.length) return;
    this.spawnTurn = ((this.spawnTurn || 0) + 1) % all.length;
    const p = all[this.spawnTurn] || this.player;
    // Despawn far creatures. (Up here: an old place's own are its own.)
    for (const c of this.creatures) {
      if (c.inst && this.world.inInstance(c.x)) continue;
      if (all.every((q) => Math.max(Math.abs(c.x - q.x), Math.abs(c.z - q.z)) > 48)) {
        c.dead = true;
        this.removeOcc(c);
      }
    }
    const night = !this.isDay();
    // (As many again round each of you as round one; as many as the
    // world's mods have it.)
    const cap = Math.round((night ? 9 : 6) * all.length * rule('spawns'));
    if (this.creatures.filter((c) => c.species !== 'chicken').length >= cap) return;
    const a = Math.random() * Math.PI * 2;
    const dist = 14 + Math.random() * 12;
    const x = Math.round(p.x + Math.cos(a) * dist);
    const z = Math.round(p.z + Math.sin(a) * dist * 0.8);
    if (!this.world.regionAt(x, z)) return;
    // (Nor near a vigil lamp, at night.)
    if (night && nearRelic(this, x, z, 'vigil', 10)) return;
    const ow = this.world.ow;
    // Night creatures keep their distance from lived-in places (and far
    // from a town lit by coldfire lamps).
    for (const s of ow.settlementsNear(x, z)) {
      const b = s.bounds;
      // (Or the heart of the mire.)
      const margin = night ? (this.sim.ancient.has(s, 'lamps') || this.sim.tech.settledIn(s, 'mist_heart', this.day) ? 34 : 14) : 6;
      if (x > b.x0 - margin && x < b.x1 + margin && z > b.z0 - margin && z < b.z1 + margin && s.condition !== 'abandoned' && !s.deserted) return;
    }
    const y = this.world.findStandY(x, z, p.y);
    if (y < 0 || this.world.isWaterAt(x, y, z) || this.entityAt(x, y, z)) return;
    const col = this.world.terrain.column(x, z, this.world.terrain.context(x, z, x, z), {});
    const biome = col.biome;
    // (A mod's biome: taken for the game's it started from, by the game's
    // own lists.)
    const like = (BIOMES[biome] && BIOMES[biome].like) || biome;
    let species = null;
    // (Kharos and Myrrow keep beasts of their own: see ISLE_DAY.)
    const isle = ow.islandAt(x, z);
    if (night) {
      const r = Math.random();
      // (Kharos and Myrrow have night things all their own: see islemobs.js.)
      if (isle === 'kharos' || isle === 'myrrow') species = isleNightSpecies(this, isle, x, z);
      else if (FAR_NIGHT[like] && r < 0.6) species = FAR_NIGHT[like][Math.floor(Math.random() * FAR_NIGHT[like].length)];
      else if ((like === 'forest' || like === 'taiga') && r < 0.3) species = 'wolf';
      // (Wisps over marsh and through the woods.)
      else if ((like === 'swamp' || like === 'jungle' || like === 'forest') && r < 0.48) species = 'wisp';
      else species = r < 0.45 ? 'slime' : r < 0.72 ? 'skeleton' : r < 0.88 ? 'ghoul' : 'wisp';
    } else {
      const opts = {
        plains: ['rabbit', 'deer', 'rabbit', 'boar', 'horse', 'sheep', 'cow'], forest: ['deer', 'boar', 'rabbit', 'wolf', 'pig'], taiga: ['deer', 'wolf', 'rabbit', 'sheep'],
        tundra: ['rabbit', 'wolf'], savanna: ['deer', 'boar', 'rabbit', 'horse', 'cow'], jungle: ['boar', 'slime', 'deer', 'pig'], swamp: ['slime', 'boar'],
        desert: ['rabbit'], mountain: ['boar', 'rabbit', 'sheep'], beach: ['rabbit'],
      }[like] || ISLE_DAY[like] || ['rabbit'];
      species = opts[Math.floor(Math.random() * opts.length)];
      if (species === 'wolf' && Math.random() < 0.6) species = 'deer';
      // (And on any ground of theirs, now and then, the islands' own.)
      if (ISLE_BEASTS[isle] && Math.random() < 0.3) species = ISLE_BEASTS[isle][Math.floor(Math.random() * ISLE_BEASTS[isle].length)];
    }
    // (Round 62) Or one of a mod's, where it belongs.
    if (MODS.active.length) {
      // (Round 63) What a mod's biome (or its change to one of the
      // game's) has come out in it; nothing, if it says only its own and
      // has none.
      const bs = biomeSpawn(biome, night);
      if (bs === false) return;
      species = bs || modSpawnPick(night, biome) || species;
    }
    const variant = Math.floor(Math.random() * (species === 'horse' ? 6 : 3));
    // (A swimmer in the water by there, under the surface.)
    const wet = SPECIES[species].swims && waterNear(this, x, z);
    if (wet) {
      const c = new Creature(this, species, wet.x, wet.y, wet.z, variant);
      c.burrowed = true;
      c.solid = false;
      this.addCreature(c);
      return;
    }
    this.addCreature(new Creature(this, species, x, y, z, variant));
    if (SPECIES[species].packs && Math.random() < 0.6) {
      const y2 = this.world.findStandY(x + 1, z, y);
      if (y2 > 0 && !this.entityAt(x + 1, y2, z)) this.addCreature(new Creature(this, species, x + 1, y2, z));
    }
  }

  // One of the islands' night things, out of another (a magma slug's
  // halves: see islemobs.js).
  spawnIsleMob(species, x, y, z) {
    const c = new Creature(this, species, x, y, z);
    this.addCreature(c);
    return c;
  }

  // An animal wanders near a hunter (so trappers have something to hunt
  // while the player watches).
  spawnGameNear(n) {
    if (this.creatures.filter((c) => c.S.mode !== 'hostile' && c.species !== 'chicken').length >= 8) return;
    const a = Math.random() * Math.PI * 2;
    const x = Math.round(n.x + Math.cos(a) * 8);
    const z = Math.round(n.z + Math.sin(a) * 6);
    if (!this.world.regionAt(x, z)) return;
    const y = this.world.findStandY(x, z, n.y);
    if (y < 0 || this.world.isWaterAt(x, y, z) || this.entityAt(x, y, z)) return;
    const s = n.settlement;
    const opts = { tundra: ['rabbit'], desert: ['rabbit'], forest: ['deer', 'rabbit', 'boar'], taiga: ['deer', 'rabbit'], savanna: ['deer', 'boar'], jungle: ['boar', 'deer'], swamp: ['boar'] }[s.biome] || ISLE_BEASTS[s.island] || ['rabbit', 'deer', 'rabbit'];
    this.addCreature(new Creature(this, opts[Math.floor(Math.random() * opts.length)], x, y, z, Math.floor(Math.random() * 3)));
  }

  growPlants(dt) {
    for (const s of this.saplings) {
      s.t -= dt;
      if (s.t > 0) continue;
      s.done = true;
      const w = this.world;
      if (w.getBlock(s.x, s.y, s.z) !== B.sapling) continue;
      const col = w.terrain.column(s.x, s.z, w.terrain.context(s.x, s.z, s.x, s.z), {});
      const bd = BIOMES[col.biome];
      const type = bd.trees.length ? bd.trees[0][0] : 'oak';
      const cells = (TREE_BUILDERS[type] || TREE_BUILDERS.oak)(Math.random);
      w.setBlock(s.x, s.y, s.z, B.air);
      for (const [dx, dy, dz, id] of cells) {
        const cur = w.getBlock(s.x + dx, s.y + dy, s.z + dz);
        if (cur === B.air || BLOCKS[cur].replaceable) w.setBlock(s.x + dx, s.y + dy, s.z + dz, id);
      }
    }
    this.saplings = this.saplings.filter((s) => !s.done);
  }

  ambientFx(dt) {
    this.ambientSounds(dt);
    this.fxT -= dt;
    if (this.fxT > 0) return;
    this.fxT = 0.12;
    const r = this.renderer;
    for (const { layout } of this.active.values()) {
      for (const c of layout.chimneys) {
        if (Math.abs(c.x - this.player.x) > 22 || Math.abs(c.z - this.player.z) > 22) continue;
        if (Math.random() < 0.35) r.emit(c.x, c.y, c.z, { n: 1, color: ['#8a8a92', '#a8a8b0', '#6a6a72'], up: 10, speed: 8, gravity: -6, life: 2.4, size: 2, oy: -2 });
      }
    }
    // Wisps: sparks of cold light falling away from them.
    // (Cinderlings: embers drifting up off them; gloam moths: a dust of
    // light shaken from their wings.)
    for (const c of this.creatures) {
      const sp = c.species;
      if ((sp !== 'wisp' && sp !== 'cinderling' && sp !== 'gloam_moth') || c.dead || Math.abs(c.x - this.player.x) > 20 || Math.abs(c.z - this.player.z) > 20 || Math.random() > 0.35) continue;
      const rp = c.renderPos();
      if (sp === 'cinderling') r.emit(rp.x + 0.3 + Math.random() * 0.4, rp.y + 1.4, rp.z + 0.5, { n: 1, color: ['#ff8030', '#ffd060', '#ff4020'], up: 10, speed: 6, gravity: -8, life: 0.8, glow: true });
      else if (sp === 'gloam_moth') {
        if (Math.random() < 0.5) r.emit(rp.x + 0.3 + Math.random() * 0.4, rp.y + 1.1, rp.z + 0.5, { n: 1, color: ['#fff0a0', '#e8d8a0'], up: -2, speed: 4, gravity: 4, life: 1.1, glow: true });
      } else r.emit(rp.x + 0.3 + Math.random() * 0.4, rp.y + 1.2, rp.z + 0.5, { n: 1, color: ['#80d0ff', '#c0f0ff', '#ffffff'], up: -4, speed: 6, gravity: 6, life: 0.9, glow: true });
    }
    // Portals alight: motes of violet drifting up out of the arch.
    for (const q of Object.values(this.sim.portals.list)) {
      if (!q.lit || !this.active.has(q.sid) || Math.abs(q.x - this.player.x) > 20 || Math.abs(q.z - this.player.z) > 20) continue;
      if (Math.random() < 0.6) r.emit(q.x + 0.3 + Math.random() * 0.4, GROUND + 0.4 + Math.random() * 1.2, q.z + 0.5, { n: 1, color: ['#c890ff', '#9a60e8', '#a0c0ff', '#ffffff'], up: 12, speed: 6, gravity: -8, life: 1.2, glow: true });
    }
    if (!this.isDay()) {
      for (const s of r.lighting.sources) {
        if (Math.random() < 0.08 && Math.abs(s.x - this.player.x) < 18) r.emit(s.x, s.y + 1, s.z, { n: 1, color: ['#ffb040', '#ffe070'], up: 20, speed: 10, gravity: -10, life: 0.9, oy: -2 });
      }
    }
  }

  // Pushing through foliage.
  rustle(x, y, z) {
    const w = this.world;
    const id = LEAVES.has(w.getBlock(x, y + 1, z)) ? w.getBlock(x, y + 1, z) : w.getBlock(x, y, z);
    this.renderer.emit(x, y + 1, z, { n: 5, color: this.blockColor(id), up: 18, speed: 30, life: 0.7, gravity: 30, oy: -4 });
    this.audio?.play('dig');
  }

  onPlayerStep(x, y, z, water) {
    if (this.dungeon) this.dungeon.onStep(x, y, z);
    this.audio?.play(water ? 'splash' : stepSound(BLOCKS[this.world.getBlock(x, y - 1, z)]));
    this.sim.careers.onStep();
    if (water) this.renderer.emit(x, y, z, { n: 4, color: ['#8cc4f0', '#e0f4ff'], up: 25, life: 0.4, oy: -2 });
  }

  // Where someone aboard a ship is drawn (see Entity.renderPos).
  shipDeckPos(e) {
    return deckRenderPos(this, e);
  }

  // One of a ship's crew struck: her crew turns on whoever did it.
  shipCrewHurt(c, by) {
    crewHurt(this, c, by);
  }

  onBlockChange(x, y, z, o, n) {
    if (isFarmland(n) && this.crops) this.crops.trackSoil(x, y, z, n);
    // (Inside one of the great ships: the same in her. See shiphold.js.)
    if (this.ships3d && this.ships3d.length && this.world.inInstance(x)) holdBlockChanged(this, x, y, z, o, n);
    if (o === -1 || (BLOCKS[o] && (BLOCKS[o].light || BLOCKS[o].opaque)) || (BLOCKS[n] && (BLOCKS[n].light || BLOCKS[n].opaque))) this.lightDirty = true;
  }

  // ------------------------------------------------------------ save
  serialize() {
    // (Fields of light thrown up are only for the moment: not kept.)
    dropFields(this);
    try {
      return this.serializeAll();
    } finally {
      raiseFields(this);
    }
  }

  serializeAll() {
    // (Old places others are down: their floors kept as they are now too.)
    for (const run of this.runs.values()) if (run !== this.dungeon && run.data) run.saveFloor();
    const regions = [];
    for (const v of this.world.saved.values()) regions.push(v);
    for (const r of this.world.regions.values()) if (r.modified) regions.push(r.serialize());
    const p = this.player;
    return {
      v: SAVE_VERSION,
      // (The game's version it was saved in: see version.js.)
      gv: GAME_VERSION,
      seed: this.seed,
      // (Round 68: how its land was made.)
      wg: this.world.ow.wg,
      minute: this.minute,
      day: this.day,
      // (Round 78) On the coach or the ferry, partway; the chests you've
      // set down (see invtools.js).
      ride: rideSave(p),
      myChests: this.myChests ? [...this.myChests] : [],
      // (Round 78) What's drawn on blueprints (see plans.js).
      plans: plansSave(this),
      player: { x: p.x, y: p.y, z: p.z, hp: p.hp, awake: p.awakeSince, inv: p.inv, selected: p.selected, spawn: p.spawn, vigor: p.vigor, blue: p.blue, buffs: p.buffs || [], recipes: p.recipes || [], kinds: p.kinds || [], raft: p.raft ? { x: p.raft.x, z: p.raft.z, ang: p.raft.ang } : null, equip: p.equip, look: p.baseLook, mount: p.mount || null },
      name: this.playerName,
      hero: this.hero || null,
      // (Down below: where, and the floor as it stands. Before the sim's
      // records are written, which keep it.)
      dungeon: this.dungeon ? this.dungeon.serialize() : null,
      relics: serializeRelics(this),
      wallDown: !!this.world.ow.wallDown,
      regions,
      dead: [...this.deadNpcs].map(([sid, set]) => [sid, [...set]]),
      explored: this.world.ow.packExplored(),
      pins: this.world.ow.pins,
      stats: this.stats,
      wanted: [...this.wanted],
      crops: this.crops.serialize(),
      sim: this.sim.serialize(),
      placed: [...this.placed],
      picked: [...this.picked],
      roadCamps: [...this.roadCamp],
      riding: this.riding.serialize(),
      leadsOut: leadsOut(this),
      view: this.renderer.view || 0,
      cheats: { ...this.cheats, reveal: !!this.revealMap },
      // (Round 62) The world's mods: which, the numbers their blocks are
      // kept by, and what their graphs keep.
      mods: modSave(this),
      // (Round 65) Which of a mod's world maps it's made from, if not the
      // one its mods chose, and the world it was crossed into from.
      worldMap: this.worldMap || null,
      worldRoot: this.worldRoot || null,
      // A world played with others: each one's character, kept for when
      // they come back, and who's not welcome.
      party: this.partyWorld ? this.partySave() : null,
      // (Round 68) The great ships, and whether you were aboard one.
      ships: shipSave(this),
      // (Round 78) The pirates' doings (see pirates.js).
      pirates: piratesSave(this),
    };
  }

  // Everyone's characters in this world (those here now as they are), its
  // name and its bans (see net/host.js).
  partySave() {
    const chars = new Map(this.partyChars || []);
    for (const s of this.seats || []) if (!s.host && s.ent) chars.set(s.id, this.seatSave(s));
    const net = this.net;
    return {
      world: this.partyWorld,
      // (Whether players may hurt each other: the host's to say.)
      pvp: !!this.pvp,
      host: this.seats && this.seats[0] ? this.seats[0].profile : null,
      chars: [...chars],
      bans: net ? { ids: [...net.bans.ids], names: [...net.bans.names] } : this.partyBans || null,
      // (Its guilds: see guilds.js.)
      guilds: this.guilds.serialize(),
      // (What each player's allowed beyond playing: see HostNet.setPerm.)
      perms: this.perms || {},
    };
  }

  applySave(data) {
    this.minute = data.minute;
    this.day = data.day;
    // (Round 62) What the world's mods keep (they're put into the game
    // before it's made: see main.js).
    if (data.mods) modLoad(this, data.mods);
    if (data.party) {
      this.partyWorld = data.party.world || { name: 'A world' };
      this.pvp = !!data.party.pvp;
      this.partyChars = new Map(data.party.chars || []);
      this.partyBans = data.party.bans || null;
      this.guilds.load(data.party.guilds);
      this.perms = data.party.perms || {};
    }
    for (const r of data.regions || []) this.world.saved.set(this.world.regionKey(r.rx, r.rz), r);
    for (const [sid, list] of data.dead || []) this.deadNpcs.set(sid, new Set(list));
    if (data.explored) this.world.ow.unpackExplored(data.explored);
    if (data.pins) this.world.ow.pins = data.pins;
    if (data.stats) this.stats = data.stats;
    if (data.cheats) {
      this.cheats = { ...this.cheats, mapTeleport: !!data.cheats.mapTeleport, god: !!data.cheats.god };
      if (data.cheats.reveal) this.revealMap = true;
    }
    if (data.sim) this.sim.load(data.sim);
    this.placed = new Map(data.placed || []);
    this.picked = new Map(data.picked || []);
    loadRelics(this, data.relics);
    // (The storm wall, brought down: see wallfall.js.)
    this.world.ow.wallDown = !!data.wallDown;
    this.wallDown = !!data.wallDown;
    this.roadCamp = new Map(data.roadCamps || []);
    this.riding.load(data.riding);
    this.crops.load(data.crops);
    for (const [sid, t] of data.wanted || []) this.wanted.set(sid, t);
    const pd = data.player;
    this.loadAround(pd.x, pd.z, true);
    this.player = new Player(this, pd.x, pd.y, pd.z);
    if (pd.blue) this.player.blue = pd.blue;
    if (pd.buffs) this.player.buffs = pd.buffs;
    // (Your recipes, and what you've learnt things are, cooking: see
    // cooking.js and ui/cook.js.)
    if (pd.recipes) this.player.recipes = pd.recipes;
    if (pd.kinds) this.player.kinds = pd.kinds;
    if (pd.raft) this.player.raft = { ...pd.raft, v: 0 };
    if (pd.mount) this.player.mount = pd.mount;
    if (pd.vigor) {
      this.player.vigor = pd.vigor;
      this.player.recalcMaxHp();
    }
    this.player.hp = pd.hp;
    this.player.awakeSince = pd.awake ?? data.day * DAY_MINUTES + data.minute;
    this.player.inv = pd.inv;
    // (Animals aren't kept in a save: any leads out on them come back.)
    if (data.leadsOut > 0) addItem(this.player.inv, 'lead', data.leadsOut);
    this.player.selected = pd.selected;
    this.player.spawn = pd.spawn;
    if (pd.equip) this.player.equip = { head: null, body: null, legs: null, feet: null, ...pd.equip };
    if (pd.look) this.player.baseLook = pd.look;
    if (data.name) this.playerName = data.name;
    // (Skills, kept apart in older saves, are traits now: see hero.js.)
    if (data.hero) this.hero = data.hero.anon ? data.hero : normalizeHero(data.hero);
    this.applyHero();
    this.moveEntity(this.player, pd.x, pd.y, pd.z);
    this.sim.careers.applyLook();
    // (Round 68) The great ships; aboard one, or below her decks.
    shipLoad(this, data.ships);
    piratesLoad(this, data.pirates);
    // (Round 78) Saved on the coach or the ferry: still on it.
    if (data.ride && !this.remoteCopy) rideLoad(this, this.player, data.ride);
    this.myChests = new Set(data.myChests || []);
    plansLoad(this, data.plans);
    const shipAt = this.player.deck || (data.ships && data.ships.below && this.world.inInstance(this.player.x));
    // Saved down below: back down there.
    const dg = data.dungeon;
    const rec = dg && !this.remoteCopy ? this.sim.dungeons.get(dg.id) : null;
    if (rec) {
      const run = this.runFor(rec);
      run.surface = dg.surface || { x: rec.x, y: GROUND, z: rec.z + 3 };
      this.dungeon = run;
      run.carried = dg.carried || null;
      this.runs.set(rec.id, run);
      // (Saved from before each old place had its own space: where you were
      // there, moved over to it. See DungeonRun.slot.)
      const x = run.has(dg.x) ? dg.x : dg.x + (run.x0 - INST_X0);
      // (Fewer floors than it had when you saved: the deepest there is now.)
      run.open(Math.min(dg.floor, rec.depth - 1), { x, z: dg.z });
    } else if (this.world.inInstance(pd.x) && !this.remoteCopy && !shipAt) {
      // (A dungeon that's gone: up top, at your bed.)
      const s = this.player.spawn;
      this.loadAround(s.x, s.z, true);
      this.player.teleport(s.x, s.y, s.z);
    }
  }
}

function cap(s) {
  return s[0].toUpperCase() + s.slice(1);
}

// A block a passage can be dug through: the ground, or a plain wall (logs,
// planks, stone, brick...), not a door, a chest, bars or anything else
// that's used rather than dug.
function digThrough(id) {
  const b = BLOCKS[id];
  if (!b || id === B.air || b.liquid || !isFinite(b.hardness)) return false;
  if (NATURAL.has(id)) return true;
  return b.solid && b.render === 'cube' && !b.interact && id !== B.iron_bars && id !== B.cell_door;
}

// What your feet sound like on this.
function stepSound(b) {
  const n = b ? b.name : '';
  if (/snow|ice/.test(n)) return 'step_snow';
  if (/sand|gravel/.test(n)) return 'step_sand';
  if (/plank|wood|log|bridge|timber/.test(n)) return 'step_wood';
  if (/stone|cobble|brick|marble|path|slate|basalt/.test(n)) return 'step_stone';
  return 'step_grass';
}

export { itemForBlock };
