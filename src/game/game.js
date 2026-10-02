// Game orchestrator: owns the world, entities, time, input handling and the
// rules for interacting with blocks and creatures.
import {
  TILE, LH, VIEW_W, VIEW_H, WORLD_Y, REGION_W, REGION_D, GROUND, WATER_Y, REACH, BELT_SIZE,
  GAME_MINUTES_PER_SECOND, DAY_MINUTES, SETTLEMENT_ACTIVE_DIST, MAP_W, MAP_H,
} from '../config.js';
import { World } from '../world/world.js';
import { BLOCKS, B, META_STATE, LOGS, LEAVES, CROPS, cropMeta, isFarmland } from '../world/blocks.js';
import { ITEMS, GEMS, rollDrops, itemForBlock, socketed } from '../world/items.js';
import { CONTAINER_SIZE } from '../world/loot.js';
import { Player, screenToWorld } from '../entities/player.js';
import { NPC } from '../entities/npc.js';
import { Creature, SPECIES } from '../entities/creature.js';
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
import { alive, invAdd, DAY, setOverride, ledger, simulateTo } from '../sim/econ.js';
import { tickFires } from './fire.js';
import { updateEngines, hitEngine } from './engines.js';
import { updateShips, sailShips } from './shipping.js';
import { updateLabor } from '../sim/labor.js';
import { drawable, beginDraw, tickDraw, cancelDraw, releaseDraw, throwAimed, flyAimed, arrowStrikes } from './archery.js';
import { throwDice, tickDice } from './dicegame.js';
import { Wildlife } from './wildlife.js';
import { DungeonRun, DUNGEON_INTERACTS } from './dungeon.js';
import { startIntro } from './cutscene.js';
import { spireOpening, bossTint } from './scenes.js';
import { BLIGHT_R } from '../world/sites.js';
import { useGadget, fitEnhancer, lanceThrust, pierceOf, updateKavTech, dropFields, raiseFields } from './kavtech.js';
import { setRelic, relicAt, relicItem, relicDamage, updateRelics, nearRelic, serializeRelics, loadRelics } from './relics.js';
import { updateHazards, guardFront, kegBlast } from '../entities/monsters.js';
import { updateLasers } from './laser.js';
import { siteAt } from '../world/sites.js';
import { parryWindow, playerTick, roll, spend, interrupt, knock, canBlock, buffOf, styleOf, staminaCost, playerSwing, offhandOf, sweepTiles, STYLES, weaponStyle, strikeAnim, combatBuffText } from './combat.js';
import { jobTitle, visitorRecord } from '../entities/npcgen.js';
import { personName, familyName } from '../world/names.js';
import { RNG } from '../util/rng.js';
import { countItem } from './inventory.js';
import { launch as launchRaft, landing as raftLanding, floatable } from '../entities/raft.js';
import { ambientChatter } from './chatter.js';
import { CropGrowth } from './crops.js';
import { weatherAt, townWeather } from '../world/weather.js';
import { castLine, updateFishing, hook } from './fishing.js';
import { Playtime } from './playtime.js';
import { Riding } from './riding.js';
import { canLead, leadUse, tieLeads, isPost, leading, leadsOut } from './leads.js';
import { lawOn } from '../sim/laws.js';
import { PROFESSIONS } from '../sim/careers.js';
import { EVENT_BLOCKS } from '../sim/events.js';
import { gemsOf, onSwing, onBladeHit, onArrowLand, onStruck, updateGemFx, tickStatus, swingMult, arrowSpeed, evade, moonWard, rageMult, onKill } from './gems.js';
import { normalizeHero, KITS, COMMON_KIT, hpBonus, damageMult, digMult, cooldownMult, has as heroHas } from './hero.js';

const AUTOSAVE_AT = 7 * 60; // 7:00 every morning
const GEMS_COLOR = (k) => (ITEMS[k] && ITEMS[k].gem && GEMS[k] ? GEMS[k].color : '#ffffff');

const START_KIT = [
  ['wood_pickaxe', 1], ['wood_axe', 1], ['wood_sword', 1], ['torch', 12], ['planks', 32],
  ['cobblestone', 24], ['door', 2], ['chest', 1], ['bread', 5], ['workbench', 1], ['glass', 8], ['fence', 8],
];

export class Game {
  constructor({ seed, renderer, audio, ui, save = null, hero = null, learned = false, intro = false }) {
    this.seed = seed >>> 0;
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
    this.world = new World(this.seed);
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
      this.crops.scanRegion(r);
    };
    this.signIcons = new Map();
    this.projectiles = [];
    // Siege engines (and other great wooden things) about the place.
    this.engines = [];
    // Butterflies, songbirds and owls round you (see wildlife.js).
    this.wildlife = new Wildlife(this);
    // Down in a dungeon (see dungeon.js), and blows on their way (hazards:
    // see monsters.js).
    this.dungeon = null;
    this.hazards = [];
    // Things set down on the ground: "x,y,z" -> { item, count, owner }.
    this.placed = new Map();
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
      sx = this.player.x;
      sz = this.player.z;
    } else {
      // A character made on the character screen: washed up on the shore,
      // or at home in the town they grew up in.
      this.hero = hero ? normalizeHero(hero) : null;
      if (this.hero) this.playerName = this.hero.name;
      const home = this.hero && this.hero.origin === 'native' ? this.pickHometown() : null;
      const coast = this.hero && this.hero.origin === 'crash' ? this.coastSpot() : null;
      const s = home || ow.spawnSettlement;
      const L = s ? this.world.getLayout(s) : null;
      sx = L ? L.plaza.cx + 2 : Math.floor(ow.cells.length / 2);
      sz = L ? L.plaza.cz : 400;
      if (coast) {
        sx = coast.x;
        sz = coast.z;
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
        const kit = KITS[this.hero.kit];
        for (const [k, n] of [...kit.items, ...COMMON_KIT]) this.giveOrWear(k, n);
        this.player.give('coin', kit.coins);
        this.player.baseLook = { ...this.hero.look };
        this.applyHero();
        this.player.hp = this.player.maxHp;
        this.player.spawn = { x: spot.x, y: spot.y, z: spot.z };
        if (coast) this.wreckage(spot);
      } else {
        for (const [k, n] of START_KIT) this.player.give(k, n);
        this.player.give('coin', 25);
      }
    }
    // (Up since this morning.)
    if (this.player.awakeSince === undefined) this.player.awakeSince = this.day * DAY_MINUTES + this.minute;
    this.loadAround(this.player.x, this.player.z, true);
    this.updateSettlements(true);
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
    this.ambT = (this.ambT ?? 3) - dt;
    if (this.ambT > 0 || indoors || this.sleep || this.dungeon) return;
    this.ambT = 2 + Math.random() * 5;
    const biome = this.biomeCache ? this.biomeCache.biome : 'plains';
    const day = this.isDay();
    const wet = w && w.kind !== 'clear';
    const pick = (l) => l[Math.floor(Math.random() * l.length)];
    let snd = null;
    if (biome === 'beach' || biome === 'ocean') snd = day && !wet && Math.random() < 0.4 ? 'gull' : 'wave';
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
    const list = ow.settlements.filter((s) => s.condition !== 'abandoned' && !s.deserted && s.type !== 'camp');
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
    const hx = s ? s.cx + s.cw / 2 : MAP_W / 2;
    const hz = s ? s.cz + s.cd / 2 : MAP_H / 2;
    const beaches = ow.cells.filter((c) => c && c.biome === 'beach').map((c) => ({ c, d: Math.hypot(c.cx - hx, (c.cz - hz) * 1.4) })).sort((a, b) => a.d - b.d);
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

  // The first words of a new story.
  introduce() {
    const h = this.hero;
    const c = this.sim.citizen;
    if (h.origin === 'native' && c) {
      const L = this.sim.layoutOf(c.sid);
      const par = (c.family?.parents || []).map((i) => L.npcs[i]).filter(Boolean).map((r) => r.name.first);
      this.ui.msg(`Home again in ${L.settlement.name}${par.length ? `, where ${par.join(' and ')} raised you` : ''}. Everyone here has known you all your life.`, '#ffe070');
      this.ui.msg('Your family\'s house is your home: its beds and chests are yours too. The mayor can have a place of your own built, if you like.', '#a0c8ff');
    } else {
      this.ui.msg('You wake on wet sand. Of your ship, only splinters and a battered chest have come ashore.', '#ffe070');
      this.ui.msg('Nobody on this island knows you. Find a town: the map (M) shows what you have seen.', '#a0c8ff');
    }
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
    return this.occ.get(this.occKey(x, y, z)) || null;
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
    // Moving entities also reserve the tile they're leaving.
    if (self && self.kind === 'player') {
      for (const n of this.npcs) if (!n.dead && n.moving && n.fx === x && n.fz === z && Math.abs(n.fy - y) <= 1 && n.moveT < 0.5) return n;
    }
    return null;
  }

  // Could you see a tile from where you stand (whichever way the camera's
  // turned)? Anything that appears or vanishes should do it out of sight.
  inSight(x, z, margin = 0) {
    const p = this.player;
    return Math.max(Math.abs(x - p.x), Math.abs(z - p.z)) <= 18 + margin;
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
      const prx = Math.floor(p.x / REGION_W);
      const prz = Math.floor(p.z / REGION_D);
      for (const reg of [...this.world.regions.values()]) {
        if (Math.abs(reg.rx - prx) <= 2 && Math.abs(reg.rz - prz) <= 2) continue;
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
    for (const s of ow.settlements) {
      const b = s.bounds;
      const dx = Math.max(b.x0 - p.x, 0, p.x - b.x1);
      const dz = Math.max(b.z0 - p.z, 0, p.z - b.z1);
      const d = Math.hypot(dx, dz * 1.5);
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
    for (const n of a.npcs) {
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
    this.npcs = this.npcs.filter((n) => !a.npcs.includes(n));
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
        if (far) this.endCaravan(tr.key, n);
        continue;
      }
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
      if (below === B.path || below === B.flagstone || below === B.planks || w.isWaterAt(x, y - 1, z) || !BLOCKS[below].solid) return false;
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
    for (const m of g.members) {
      if (m.mount !== 'horse' && m.wagon === undefined) continue;
      const [sx, sz] = spots[h % spots.length];
      camp.horses.push({ key: `${key}:h${h}`, x: at.x + sx, y: Y, z: at.z + sz, coat: m.coat || 0, banner: g.banner, post });
      h++;
      if (m.wagon !== undefined) {
        camp.wagons.push({ key: `${key}:w${wi}`, x: at.x + 1 + wi * 2, y: Y, z: at.z - 1, face: 1, banner: g.banner });
        wi++;
      }
    }
    this.roadCamp.set(key, camp);
    return camp;
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
      this.sim.changeRep(n, 15);
      if (adv) adv.beaten = (adv.beaten || 0) + 1;
    } else {
      const owe = Math.min(d.wager, countItem(p.inv, 'coin'));
      if (owe) removeItem(p.inv, 'coin', owe);
      n.rec.coins = (n.rec.coins || 0) + owe;
      if (adv) adv.coins = n.rec.coins;
      n.say(result === 'fled' ? 'Walking away? Then the purse is mine.' : n.rng.pick(['A good bout! Better luck next time.', 'Not bad at all. Keep at it.', 'You\'ll get me one day.']), 3.5);
      this.ui.msg(result === 'fled' ? `You walked away from the bout and forfeit ¤${owe}.` : `${n.name} won the bout${owe ? `: you pay ¤${owe}` : ''}.`, '#ffb080');
      this.sim.changeRep(n, result === 'fled' ? -5 : 5);
    }
  }

  updateDuel() {
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
    this.skipping = { left: n * 24, total: n * 24, day0: this.day };
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
    if (done % 24 === 0 || !sk.left) this.ui.msg(`Day ${this.day}...`, '#c8d8ff', true);
    if (sk.left > 0) return;
    this.skipping = null;
    this.player.hp = this.player.maxHp;
    this.player.awakeSince = this.day * DAY_MINUTES + this.minute;
    this.updateSettlements(true);
    this.ui.msg(`${this.day - sk.day0} day${this.day - sk.day0 === 1 ? '' : 's'} pass. It's day ${this.day}.`, '#ffe8a0');
  }

  // ------------------------------------------------------------ main update
  update(dt, input) {
    this.dt = dt;
    this.pathBudget = 5;
    if (this.skipping) {
      input.consume();
      return this.updateSkip();
    }
    const ev = input.consume();
    const uiRes = this.ui.handle(ev, input, this);
    // The pause menu freezes the world; other windows let it keep living.
    if (this.ui.find && (this.ui.find('pause') || this.ui.find('help'))) {
      this.cursor = null;
      this.mining = null;
      return;
    }
    // So does the camera swinging round: time and you stand still till it's done.
    if (this.renderer.spin) {
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
    const sc = this.scene;
    if (sc) {
      sc.t += dt;
      sc.update?.(this, dt);
      if (sc.t >= sc.dur) {
        sc.end?.(this);
        if (this.scene === sc) this.scene = null;
      } else if (sc.timeScale) dt *= sc.timeScale(sc.t);
    }
    // A blow that lands hard holds the moment (hit-stop); a parry slows
    // the world for a breath after.
    if (this.hitStop > 0) {
      this.hitStop -= dt;
      dt *= 0.05;
    } else if (this.slowMo > 0) {
      this.slowMo -= dt;
      dt *= this.slowMoScale || 0.35;
    }
    this.dt = dt;
    const blocked = this.ui.modal || this.player.dead || !!this.sleep || !!this.player.restrained || !!this.player.down || (!!this.cutscene && !this.cutscene.playable) || (!!this.scene && this.scene.lock);
    if (this.sleep) this.updateSleep(dt, uiRes.pressed);
    else if (this.waiting) this.updateWait(dt, uiRes.pressed);
    const abs0 = this.day * DAY_MINUTES + this.minute;
    this.minute += dt * GAME_MINUTES_PER_SECOND * (this.sleepFast || 1);
    if (this.minute >= DAY_MINUTES) {
      this.minute -= DAY_MINUTES;
      this.day++;
    }
    // The game saves itself every morning at seven.
    const abs1 = this.day * DAY_MINUTES + this.minute;
    if (Math.floor((abs0 - AUTOSAVE_AT) / DAY_MINUTES) < Math.floor((abs1 - AUTOSAVE_AT) / DAY_MINUTES) && !this.player.dead) this.autosaveDue = true;
    if (!blocked) this.handleKeys(uiRes.pressed, uiRes.wheel, uiRes.wheelShift);
    // What you wear and hold, and the potions you've drunk.
    this.bonusT = (this.bonusT || 0) - dt;
    if (this.bonusT <= 0) {
      this.bonusT = 0.5;
      this.refreshBonus();
    }
    this.player.update(dt, input, blocked);
    playerTick(this, this.player, dt, input, blocked);
    this.input = input;
    if (!blocked) this.updateCursor(input);
    else this.cursor = null;
    if (!blocked) this.handleMouse(dt, uiRes.clicks, input);
    else this.mining = null;
    tickDice(this, dt);
    // An arrow on the string: the pull, and the aim (a window opened over
    // it lets it down).
    if (this.player.bowDraw) {
      if (blocked) cancelDraw(this);
      else tickDraw(this, dt, !!input.mouse.down);
    }
    this.streamRegions();
    if (Math.random() < 0.05) this.updateSettlements();
    this.world.ow.markExplored(this.player.x, this.player.z, 1);
    // (At sea, before the story starts, the island waits.)
    const atSea = !!this.cutscene && this.cutscene.kind === 'ship';
    if (!atSea) this.sim.update(dt);
    this.respawnT = (this.respawnT || 0) - dt;
    if (this.respawnT <= 0) {
      this.respawnT = 2;
      this.respawnReturning();
    }
    // When time races (asleep), people keep pace: several steps a frame.
    const fast = this.sleepFast || 1;
    const sub = fast > 2 ? Math.min(5, Math.ceil(fast / 15)) : 1;
    const ndt = fast > 2 ? Math.min(0.5, (dt * fast) / sub) : dt;
    if (sub > 1) this.pathBudget = 5 * sub;
    for (let k = 0; k < sub; k++) {
      for (const n of this.npcs) {
        if (n.dead) continue;
        n.update(ndt);
        if (k === 0) n.maybeGreet(this.player, dt);
      }
    }
    ambientChatter(this, dt);
    this.updateDuel();
    this.updateDummy(dt);
    this.updateGates(dt);
    this.syncStanding(dt);
    this.npcs = this.npcs.filter((n) => !n.dead);
    this.updateProjectiles(dt);
    updateHazards(this, dt);
    updateLasers(this, dt);
    updateRelics(this, dt);
    updateKavTech(this, dt);
    this.sim.ancient.update(dt);
    if (this.dungeon) this.dungeon.update(dt);
    updateEngines(this, dt);
    if (!atSea) this.wildlife.update(dt);
    updateShips(this, dt);
    sailShips(this, dt);
    updateLabor(this, dt);
    // Beasts near you keep pace with racing time too (far off, they idle on).
    const pp = this.player;
    for (const c of this.creatures) {
      const near = sub > 1 && Math.abs(c.x - pp.x) < 40 && Math.abs(c.z - pp.z) < 40;
      if (!near) {
        c.update(dt);
        continue;
      }
      for (let k = 0; k < sub && !c.dead; k++) c.update(ndt);
    }
    // Burning, chilled, dazzled; wounds an emerald closes.
    this.dotHit = true;
    for (const e of [this.player, ...this.npcs, ...this.creatures]) if (e.burnT > 0 || e.slowT > 0 || e.stunT > 0 || e.bleedT > 0 || e.markT > 0 || e.frozenT > 0 || e.lostT > 0 || e.kind !== 'creature') tickStatus(this, e, dt);
    this.dotHit = false;
    this.creatures = this.creatures.filter((c) => {
      if (c.dead) {
        this.removeOcc(c);
        if (c.standKey) this.tied.delete(c.standKey);
      }
      return !c.dead;
    });
    for (const d of this.drops) d.update(dt);
    this.pickupDrops();
    this.drops = this.drops.filter((d) => !d.dead);
    this.spawning(dt);
    this.updateWanted(dt);
    this.growPlants(dt);
    this.crops.update(dt);
    this.updateFishing(dt, input);
    this.playtime.update(dt);
    this.updateBells(dt);
    this.updateCaravans(dt);
    this.updateRoadCrews(dt);
    this.updateWeather(dt);
    this.ambientFx(dt);
    // The camera: drawn back near a spire, or wherever a scene takes it.
    const nearSpire = this.dungeon ? 0 : this.spireNearness(dt);
    this.renderer.zoomGoal = this.scene && this.scene.zoom ? this.scene.zoom : 1 + 0.32 * nearSpire;
    // (A scene's zoom is its own smooth curve: taken as it comes.)
    this.renderer.zoomSnap = !!(this.scene && this.scene.zoom);
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
    if (this.audio) this.audio.listener = this.player;
    // Entities visible this frame.
    const p = this.player;
    const vis = [p];
    // (Square, so turning the camera never leaves anyone out.)
    for (const n of this.npcs) if (!n.dead && Math.abs(n.x - p.x) < 26 && Math.abs(n.z - p.z) < 26) vis.push(n);
    for (const c of this.creatures) if (Math.abs(c.x - p.x) < 26 && Math.abs(c.z - p.z) < 26) vis.push(c);
    for (const d of this.drops) if (Math.abs(d.x - p.x) < 26 && Math.abs(d.z - p.z) < 26) vis.push(d);
    for (const q of this.props.values()) if (Math.abs(q.x - p.x) < 28 && Math.abs(q.z - p.z) < 28) vis.push(q);
    for (const q of this.engines) if (Math.abs(q.x - p.x) < 30 && Math.abs(q.z - p.z) < 30) vis.push(q);
    if (this.cutscene && this.cutscene.actors) for (const a of this.cutscene.actors) if (!a.dead) vis.push(a);
    this.visibleEntities = vis;
    if (this.autosaveDue && !this.cutscene) {
      this.autosaveDue = false;
      if (this.autosave) this.autosave();
    }
  }

  // ------------------------------------------------------------ keys
  handleKeys(pressed, wheel, wheelShift) {
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
          if (this.renderer.turn) {
            this.renderer.turn(code === 'KeyQ' ? -1 : 1);
            this.mining = null;
            this.audio?.play('select');
          }
          break;
        case 'KeyG':
          this.toss(k.ctrl);
          break;
        case 'KeyB':
          this.setDownHeld(k.ctrl);
          break;
        case 'KeyT':
          // Sitting down: let some hours go by.
          if (p.sitting && !this.waiting) this.ui.openWait?.();
          else if (!p.sitting) this.ui.msg('Sit down somewhere first (a chair, bench or stool) to wait.', '#c8c8c8', true);
          break;
        case 'KeyR':
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
          else if (p.heldDef()?.kind === 'food') this.eat();
          else if (p.heldDef()?.kind === 'potion') this.drink();
          else if (p.heldDef()?.newspaper) this.ui.openNews?.();
          else if (p.heldDef()?.kind === 'armor') this.wearHeld();
          else this.interactFront();
          break;
      }
    }
    if (wheel) {
      if (wheelShift) {
        p.layerMode = Math.max(-3, Math.min(3, (p.layerMode ?? 0) - Math.sign(wheel)));
        this.ui.msg(`Layer: ${this.layerLabel()}`, '#a0c8ff');
      } else this.selectSlot((p.selected + Math.sign(wheel) + BELT_SIZE) % BELT_SIZE);
    }
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
      const L = p.y + p.layerMode;
      const t = r.screenToTile(mx, my, L);
      hit = { x: t.x, y: L, z: t.z, face: 'top', id: w.getBlock(t.x, L, t.z), fixed: true };
    } else if (drawn && r.pick && w.getBlock(r.pick.x, r.pick.y, r.pick.z) === r.pick.id) {
      hit = { ...r.pick };
    } else if (!drawn || r.pick) hit = this.pickGeometric(mx, my);
    // Someone under the cursor, if they were drawn over the block there.
    let ent = null;
    if (drawn) {
      const pe = r.pickEnt;
      if (pe && !pe.e.dead && this.visibleEntities.includes(pe.e) && (!r.pick || pe.seq > r.pick.seq)) ent = { e: pe.e, up: pe.up };
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
      c.inReach = Math.max(Math.abs(ent.e.x - p.x), Math.abs(ent.e.z - p.z)) <= this.attackReach();
    }
    if (hit) {
      c.x = hit.x;
      c.y = hit.y;
      c.z = hit.z;
      c.face = hit.face;
      const b = BLOCKS[hit.id];
      c.block = hit.id !== B.air ? b : null;
      c.empty = hit.id === B.air;
      if (!c.inReach) c.inReach = reach(hit.x, hit.y, hit.z);
      // Placement target.
      const held = p.heldDef();
      const placeId = held ? (held.kind === 'block' ? held.block : held.plant ?? null) : null;
      if (placeId !== null && placeId !== undefined && !ent) {
        let t;
        if (hit.fixed || (b.replaceable && hit.id !== B.air) || hit.id === B.air) t = { x: hit.x, y: hit.y, z: hit.z };
        else if (hit.face === 'top') t = { x: hit.x, y: hit.y + 1, z: hit.z };
        else {
          // In front of the face you're pointing at (towards the camera).
          const [fx, fz] = r.toWorld ? r.toWorld(0, 1) : [0, 1];
          t = { x: hit.x + fx, y: hit.y, z: hit.z + fz };
        }
        const why = !reach(t.x, t.y, t.z) ? 'too far' : this.placeProblem(placeId, t.x, t.y, t.z);
        const ok = !why;
        // Seeds and carrots only offer to plant where they can grow.
        if (ok || held.kind === 'block') c.place = { ...t, id: placeId, rot: p.rot, ok, why };
      }
    }
    this.cursor = c;
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
    if (b.solid && this.occupiedAny(x, y, z)) return 'someone is standing there';
    if (!this.canPlace(id, x, y, z)) {
      if (CROPS[id]) return 'needs farmland';
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
      p.buffs.push({ stat: e.stat, n: e.n, until: now + e.hours * 60, name: d.name });
    }
    // For a fight (see combat.buffOf).
    if (e.combat) {
      p.buffs = (p.buffs || []).filter((q) => q.combat !== e.combat || q.until <= now);
      p.buffs.push({ combat: e.combat, n: e.n, until: now + e.hours * 60, name: d.name });
      if (e.combat === 'breath') p.stamina = (p.stamina || 0) + e.n;
    }
    removeItem(p.inv, slot.item, 1);
    this.refreshBonus();
    this.audio?.play('gulp');
    this.renderer.emit(p.x, p.y + 1, p.z, { n: 10, color: ['#e8e0ff', '#a0c8ff', '#fff4c0'], up: 25, life: 0.7, gravity: -15 });
    const what = e.stat ? `${{ str: 'Strength', agi: 'Agility', end: 'Endurance', cha: 'Charisma' }[e.stat]} +${e.n} for ${e.hours} hours` : e.combat ? `${combatBuffText(e)} for ${e.hours} hours` : e.blue ? `+${e.blue} blue health until the day ends` : `+${e.heal} health`;
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
        if (c && c.place && held && (held.kind === 'block' || held.plant) && !(c.block && c.block.interact)) {
          this.tryPlace(c.place);
          this.placeRepeat = 0.25;
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
      } else if (c.block && c.inReach && !(held && held.kind === 'weapon') && !p.bowDraw && (!c.block.interact || !this.pending || this.pending.t >= 0.25)) {
        this.mineTick(dt, c);
      } else this.mining = null;
    } else {
      this.mining = null;
      if (this.pending && !input.mouse.down) this.pending = null;
    }
  }

  rightClick() {
    const p = this.player;
    const c = this.cursor;
    const held = p.heldDef();
    if (this.fishing && this.fishing.phase === 'bite') {
      hook(this);
      return;
    }
    // The Kavorent's things: used whatever else is about.
    if (held && held.kind === 'gadget' && useGadget(this, held)) return;
    if (held && held.kind === 'enhancer' && fitEnhancer(this, held)) return;
    // In a fight (or with nothing to use it on), the right button raises
    // your guard instead (held: see combat.js).
    if (canBlock(this, p) && (this.combatT > 0 || !c || (!c.entity && !(c.block && c.block.interact && c.inReach)))) return;
    if (c && c.entity && c.entity.kind === 'npc' && c.entity.distTo(p) <= 4) {
      this.talk(c.entity);
      return;
    }
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
    if (c && c.entity && c.entity.kind === 'prop' && c.entity.type === 'wagon') {
      this.riding.useWagon(c.entity);
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
    if (held && held.raft && c && c.block && c.block.liquid && c.inReach && !this.player.raft) {
      this.launchRaft(c.x, c.z);
      return;
    }
    if (held && held.fishing && c && c.block && c.block.liquid && c.inReach && this.world.getBlock(c.x, c.y + 1, c.z) === B.air) {
      this.castLine(c);
      return;
    }
    if (held && held.key === 'hoe' && c && c.block && c.inReach && [B.grass, B.dirt, B.grass_lush, B.grass_dry, B.grass_jungle, B.grass_taiga, B.path].includes(c.block.id) && this.world.getBlock(c.x, c.y + 1, c.z) === B.air) {
      this.world.setBlock(c.x, c.y, c.z, B.farmland);
      if (this.weather && this.weather.kind === 'rain') this.crops.wetten(c.x, c.y, c.z);
      this.audio?.play('dig');
      return;
    }
    if (held && held.kind === 'food') {
      this.eat();
      return;
    }
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
    return Math.max(0.08, t);
  }

  mineTick(dt, c) {
    const b = c.block;
    if (!isFinite(b.hardness) || b.liquid) {
      this.mining = null;
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
    m.progress += dt / this.breakTime(b);
    m.hitT -= dt;
    if (m.hitT <= 0) {
      m.hitT = 0.28;
      p.doAction(0.25);
      const col = this.blockColor(b.id);
      this.renderer.emit(c.x, c.y, c.z, { n: 3, color: col, up: 25, speed: 40, life: 0.4, oy: -6 });
      this.audio?.play('dig');
    }
    if (m.progress >= 1) {
      this.breakBlock(c.x, c.y, c.z, true);
      this.mining = null;
    }
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
      if (b.interact === 'container') {
        const slots = w.getContainer(x, y, z);
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
        const crop = this.crops.harvest(id, meta, byPlayer && this.player.heldItem() === 'hoe', rand);
        const got = crop || rollDrops(id, rand);
        // Green thumbs get an extra crop; foragers an extra handful.
        if (byPlayer && crop && crop.length && crop[0].item !== CROPS[id]?.seed && heroHas(this.hero, 'farmer')) crop[0].count++;
        else if (byPlayer && !crop && got.length && BLOCKS[id].render === 'plant' && heroHas(this.hero, 'forager') && rand() < 0.6) got[0].count++;
        drops.push(...got);
      }
    }
    for (const d of drops) this.spawnDrop(d.item, d.count, x, y, z, true);
    this.freeTied(x, y, z);
    this.renderer.emit(x, y, z, { n: 10, color: this.blockColor(id), up: 45, speed: 60, life: 0.6, oy: -6 });
    this.audio?.play(id === B.urn || id === B.skull_pile ? 'shatter' : b.render === 'plant' ? 'crop' : b.tool === 'axe' ? 'chop' : b.tool === 'pick' ? 'stone' : 'break');
    // (A powder keg broken open goes up.)
    if (id === B.powder_keg) kegBlast(this, x, y, z);
    this.popUnsupported(x, y + 1, z);
    this.flowWater(x, y, z);
    if (byPlayer) {
      this.stats.mined++;
      this.sim.customs.onBreak(b.name, x, z);
      this.checkVandalism(x, y, z, b);
      this.noteBuildingDamage(x, z, id);
      this.checkCropTheft(x, z, id, drops);
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

  popUnsupported(x, y, z) {
    const w = this.world;
    for (let i = 0; i < 4; i++) {
      const id = w.getBlock(x, y + i, z);
      const b = BLOCKS[id];
      if (id === B.air || !b.support) return;
      const below = BLOCKS[w.getBlock(x, y + i - 1, z)];
      if (below.solid || below.render === 'fence' || id === B.lily_pad && below.liquid) return;
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
    const L = this.active.get(s.id).layout;
    const here = L.buildings.filter((q) => x >= q.x0 && x <= q.x1 && z >= q.z0 && z <= q.z1);
    // Your own house is yours to knock about: nobody minds.
    const c = this.sim.citizen;
    if (here.some((q) => q.playerHome && c && c.sid === s.id && c.home === q.id)) return;
    const civic = here.length > 0 || L.maskAt(x, z) === 1 || L.maskAt(x, z) === 5 || EVENT_BLOCKS.has(b.id);
    if (!civic || b.render === 'plant') return;
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
    } else witness.say(['Hey! That\'s not yours!', 'Stop wrecking our town!', 'Do you mind?!'][v - 1], 3, '#ffb080');
  }

  // ------------------------------------------------------------ placing
  canPlace(id, x, y, z) {
    const w = this.world;
    if (y < 1 || y >= WORLD_Y - 1) return false;
    const cur = BLOCKS[w.getBlock(x, y, z)];
    if (!(cur.replaceable || cur.id === B.air)) return false;
    const b = BLOCKS[id];
    if (b.solid && this.occupiedAny(x, y, z)) return false;
    const below = BLOCKS[w.getBlock(x, y - 1, z)];
    if (b.support && !(below.solid || below.render === 'fence' || (b.render === 'flat' && below.liquid) || below.name === 'table' || below.name === 'counter')) return false;
    if (CROPS[id] && !isFarmland(w.getBlock(x, y - 1, z))) return false;
    if (id === B.door) {
      const up = BLOCKS[w.getBlock(x, y + 1, z)];
      if (!(up.replaceable || up.id === B.air)) return false;
      if (this.occupiedAny(x, y, z)) return false;
    }
    return true;
  }

  occupiedAny(x, y, z) {
    for (const yy of [y, y - 1]) {
      const e = this.occ.get(this.occKey(x, yy, z));
      if (e && !e.dead) return true;
    }
    return false;
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
    // The facing you chose is the one you see on screen.
    const rot = b.rotatable ? (p.rot - (this.renderer.view || 0)) & 3 : 0;
    const w = this.world;
    w.setBlock(t.x, t.y, t.z, id, rot | (b.lightWhenState ? META_STATE : 0) | cropMeta(id, 0));
    if (CROPS[id]) this.crops.sow(t.x, t.y, t.z, id, 0);
    if (id === B.door) w.setBlock(t.x, t.y + 1, t.z, B.door_top, rot);
    // (Below ground, what you build is noted: a master smashes through it.)
    if (this.dungeon) {
      this.dungeon.notePlaced(t.x, t.y, t.z);
      if (id === B.door) this.dungeon.notePlaced(t.x, t.y + 1, t.z);
    }
    if (b.interact === 'container') {
      const r = w.regionAt(t.x, t.z);
      const idx = ((t.z - r.z0) * REGION_W + (t.x - r.x0)) * WORLD_Y + t.y;
      r.containers.set(idx, makeSlots(CONTAINER_SIZE[b.name] || 9));
    }
    if (id === B.sapling) this.saplings.push({ x: t.x, y: t.y, z: t.z, t: 90 + Math.random() * 120 });
    if (def.relic) setRelic(this, t.x, t.y, t.z, def.relic);
    slot.count--;
    if (slot.count <= 0) p.inv[p.selected] = null;
    p.doAction(0.2);
    p.face(t.x, t.z);
    this.audio?.play('place');
    this.stats.placed++;
    this.renderer.emit(t.x, t.y, t.z, { n: 4, color: this.blockColor(id), up: 15, life: 0.3, oy: -2 });
  }

  // ------------------------------------------------------------ horses & wagons
  // What stands still near you: the town's horses at their hitching post
  // (and its wagons beside them), and at camps outside town the traders'
  // and nomads' horses tied up by their wagons. They come and go with you.
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
    for (const [k, sp] of want) {
      if (this.looseKeys && this.looseKeys.has(k)) continue;
      if (Math.max(Math.abs(sp.x - p.x), Math.abs(sp.z - p.z)) > 36 || !this.world.regionAt(sp.x, sp.z)) continue;
      const y = this.world.findStandY(sp.x, sp.z, sp.y ?? GROUND);
      if (y < 0) continue;
      if (sp.type === 'wagon') {
        if (!this.props.has(k)) this.props.set(k, { kind: 'prop', type: 'wagon', id: 90000 + (this.propN = (this.propN || 0) + 1), dead: false, renderPos() { return { x: this.x, y: this.y, z: this.z }; } });
        Object.assign(this.props.get(k), { x: sp.x, y, z: sp.z, face: sp.face ?? 1, banner: sp.banner || null, own: sp.own || null, hood: sp.hood, horse: sp.horse || null });
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
    for (const k of [...this.props.keys()]) if (!want.has(k)) this.props.delete(k);
    // You, sat in the back of one.
    for (const q of this.props.values()) q.riders = p.inWagon === q ? [p.look] : [];
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
        const busy = [this.player, ...this.npcs].some((e) => !e.dead && tiles.some((t) => e.x === t.x && e.z === t.z));
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
    this.audio?.play('splash');
    this.ui.msg('You push off on the raft. A/D turn, W paddles, S back-paddles, F to go ashore.', '#a0d8ff');
    return true;
  }

  // Back onto dry land, the raft under your arm.
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

  interact(x, y, z) {
    const w = this.world;
    const id = w.getBlock(x, y, z);
    const b = BLOCKS[id];
    const p = this.player;
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
        this.setDoor(x, y, z, !open);
        break;
      }
      case 'gate':
        this.useGate(x, y, z);
        break;
      case 'container': {
        const slots = w.getContainer(x, y, z);
        this.audio?.play('chest');
        const owner = this.containerOwner(x, y, z);
        this.ui.openContainer(owner && owner.label ? `${b.label} · ${owner.label}` : b.label, slots, { x, y, z, owner });
        if (owner && owner.sid !== undefined && owner.kind !== 'mine' && owner.kind !== 'work') this.peekWarning(owner);
        if (owner && owner.kind === 'work') this.sim.careers.onOpenContainer({ x, y, z, owner });
        break;
      }
      case 'cell_door': {
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
      case 'workbench':
        this.ui.openCrafting('workbench');
        break;
      case 'furnace':
        this.ui.openCrafting('furnace');
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
        if (!this.sim.careers.canUseBench(st)) {
          const P = PROFESSIONS[st];
          this.ui.msg(`Only a licensed ${P ? P.title.toLowerCase() : st} knows how to work the ${BLOCKS[id].label.replace(/^.*'s /, '').toLowerCase()}. (Ask a mayor about a licence.)`, '#c8c8c8', true);
          break;
        }
        this.ui.openCrafting(st);
        break;
      }
      case 'torch': {
        const on = !w.getState(x, y, z);
        w.setState(x, y, z, on);
        this.audio?.play('torch');
        if (on) this.renderer.emit(x, y, z, { n: 6, color: ['#ffb040', '#ffe070'], up: 30, life: 0.5, oy: -8 });
        this.lightDirty = true;
        break;
      }
      case 'bed':
        this.trySleep(x, y, z);
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
    new DungeonRun(this, rec).enter();
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
  spireNearness(dt) {
    const p = this.player;
    const rp = p.renderPos ? p.renderPos() : p;
    // (Drawn back gradually: from well out past the blight's edge, all the
    // way in to a few paces from its door, eased at both ends.)
    const far = BLIGHT_R + 14;
    const near = 5;
    let best = null;
    for (const s of this.world.sites || []) {
      if (s.type !== 'kavorent' || s.x === undefined) continue;
      const d = Math.hypot(s.x - rp.x, s.z - rp.z);
      if (d < far && (!best || d < best.d)) best = { s, d };
    }
    this.nearSpire = best ? best.s : null;
    if (!best) return 0;
    const q = Math.max(0, Math.min(1, (far - best.d) / (far - near)));
    const k = q * q * (3 - 2 * q);
    // (Violet motes in the blight, rising.)
    if (best.d < BLIGHT_R && Math.random() < dt * 12) {
      this.renderer.emit(p.x + (Math.random() - 0.5) * 18, p.y + Math.random() * 0.5, p.z + (Math.random() - 0.5) * 12, { n: 1, color: ['#b070e0', '#e090ff', '#5ad8f0'], up: 8, speed: 4, life: 2.2, glow: true, gravity: -6 });
    }
    return k;
  }

  // A relic set down, taken up again.
  takeRelic(x, y, z) {
    const r = relicAt(this, x, y, z);
    this.world.setBlock(x, y, z, B.air);
    if (r) this.relics.delete(`${x},${y},${z}`);
    const key = relicItem(r ? r.kind : null);
    const left = this.player.give(key, 1);
    if (left) this.spawnDrop(key, 1, x, y, z, true);
    this.renderer.emit(x, y + 0.5, z, { n: 12, color: [ITEMS[key].color, '#ffffff'], up: 20, speed: 20, life: 0.5, glow: true });
    this.ui.msg(`You take up the ${ITEMS[key].name}. Its circle of runes goes out.`, '#e0c890');
    this.audio?.play('pickup');
  }

  // Something below ground, made (or summoned) and set loose.
  spawnMonster(species, x, y, z, opts = {}) {
    if (this.dungeon) return this.dungeon.spawn(species, x, y, z, opts);
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
      out.push({ x: c.x, y: c.y + (c.S.floats ? 1 : 0), z: c.z, L: Math.max(c.S.light || 0, master ? 5 : 0), cold: !!(c.S.construct || c.species === 'wisp'), noHalo: !!c.S.noHalo, tint: master ? bossTint(c)[0] : null });
    }
    for (const n of this.npcs) {
      if (n.dead || !near(n)) continue;
      const held = n.heldItem ? n.heldItem() : null;
      const off = n.offhandItem ? n.offhandItem() : null;
      if (held === 'torch' || off === 'torch') out.push({ x: n.x, y: n.y, z: n.z, L: 9 });
    }
    out.sort((a, b) => Math.abs(a.x - p.x) + Math.abs(a.z - p.z) - (Math.abs(b.x - p.x) + Math.abs(b.z - p.z)));
    return out.slice(0, 10);
  }

  // Where you are on the world map (down below: where the way in is).
  mapPos() {
    if (this.dungeon) return { x: this.dungeon.rec.x, z: this.dungeon.rec.z };
    return { x: this.player.x, z: this.player.z };
  }

  // Who a container belongs to: a household, a business, the player.
  containerOwner(x, y, z) {
    const s = this.world.ow.settlementAt(x, z);
    if (!s || s.condition === 'abandoned' || s.deserted) return null;
    const L = this.world.getLayout(s);
    const b = buildingAt(L, x, z);
    if (!b) return null;
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
    const where = owner.kind === 'house' ? `the ${owner.label || 'a'} home` : `the ${owner.label || 'shop'}`;
    const desc = `Stealing ${taken.map((t) => `${t.count} ${ITEMS[t.item]?.name || t.item}`).slice(0, 2).join(', ')} from ${where}`;
    if (!wits.length) {
      // Nobody saw. The owners will notice later...
      this.sim.justice.unseen(sid, { type: 'theft', x: p.x, z: p.z, value, items: taken, desc, bid: owner.id, owner: { kind: owner.kind === 'house' ? 'house' : 'biz', id: owner.id }, ownerName: owner.kind === 'house' ? `${owner.label || ''}`.replace(/ family$/, 's') : owner.label });
      return false;
    }
    const victim = wits.find((n) => n.rec.home === owner.id || (n.rec.work && n.rec.work.building === owner.id));
    this.sim.justice.commit(sid, 'theft', { witnesses: wits, value, items: taken, desc, bid: owner.id, owner: { kind: owner.kind === 'house' ? 'house' : 'biz', id: owner.id }, victimNpc: victim });
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
        if (b.playerHome) return { title: 'HOME', lines: [b.underConstruction ? 'UNDER CONSTRUCTION' : (b.homeName || 'A cottage').toUpperCase(), '', b.underConstruction ? 'Builders are at work here.' : `Home of ${this.playerName}.`] };
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
    const lines = [`${s.name.toUpperCase()}`, `${cap(s.type)} of the ${s.civ ? s.civ.name : 'free folk'}`, `Population: ${living.length + this.sim.playerCount(s.id)}`, ''];
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
    this.projectiles.push({ from, target, x0: from.x, y0: from.y + 1, z0: from.z, tx: target.x, ty: target.y + 1, tz: target.z, t: 0, dur: (0.08 + dist * 0.045) * arrowSpeed(from) * pace, dmg, gem, kind });
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
    for (const e of [this.player, ...this.npcs, ...this.creatures]) {
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
    for (const e of [this.player, ...this.npcs, ...this.creatures]) {
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
      let hit = !t.dead && Math.max(Math.abs(t.x - a.tx), Math.abs(t.z - a.tz)) <= 1;
      // Turned aside, rolled under, taken on a shield, or home (see
      // archery.js).
      if (hit) hit = arrowStrikes(this, a, t);
      javelin(a);
      onArrowLand(this, a, hit);
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
      const kind = weatherAt(this.seed, p.x, p.z, this.day * DAY + this.minute, this.biomeCache.biome);
      if (kind !== w.kind) {
        if (w.seen && kind !== 'clear') this.ui.msg(kind === 'rain' ? 'It starts to rain.' : kind === 'snow' ? 'Snow begins to fall.' : 'A fog rolls in.', '#a0b8d0');
        else if (w.seen && w.kind !== 'fog') this.ui.msg(w.kind === 'rain' ? 'The rain stops.' : 'The snow stops falling.', '#a0b8d0');
        w.kind = kind;
      }
      w.seen = true;
    }
    const target = w.kind === 'clear' ? 0 : 1;
    w.level += Math.sign(target - w.level) * Math.min(Math.abs(target - w.level), (dt * fast) / 8);
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
    if (p.hp >= p.maxHp) {
      this.ui.msg('You\'re not hungry.', '#c8c8c8');
      return;
    }
    // (An iron stomach gets as much from raw meat as from a roast.)
    const iron = heroHas(this.hero, 'iron_stomach');
    const raw = iron ? ITEMS[{ raw_meat: 'cooked_meat', fish: 'cooked_fish' }[slot.item]] : null;
    const bonus = (heroHas(this.hero, 'healer') ? 2 : 0) + (iron ? 1 : 0);
    // (A hot dish: a little now, the rest over a while; see Player.update.)
    const heal = def.regen ? def.now + bonus : Math.max(def.heal, raw && raw.heal ? raw.heal : 0) + bonus;
    p.hp = Math.min(p.maxHp, p.hp + heal);
    if (def.regen) {
      const h = p.slowHeal && p.slowHeal.left > 0 ? p.slowHeal : (p.slowHeal = { left: 0, rate: 0, acc: 0 });
      h.left += def.regen;
      h.rate = Math.max(h.rate, def.regen / def.regenT);
    }
    slot.count--;
    if (slot.count <= 0) p.inv[p.selected] = null;
    p.doAction(0.3);
    this.audio?.play(slot.item === 'ale' || slot.item === 'cocoa' ? 'gulp' : 'eat');
    // Crumbs (or foam) everywhere.
    if (slot.item === 'ale') this.renderer.emit(p.x, p.y + 1, p.z, { n: 5, color: ['#f4ecd8', '#ffffff', '#e8c060'], shape: 'drop', up: 10, speed: 12, gravity: 120, life: 0.5, oy: -2 });
    else this.renderer.emit(p.x, p.y + 1, p.z, { n: 7, chunk: slot.item, up: 22, speed: 22, gravity: 150, life: 0.55, oy: -2 });
    if (slot.item === 'ale' && p.inv.some((q) => !q)) addItem(p.inv, 'empty_mug', 1);
    this.ui.msg(`${slot.item === 'ale' || slot.item === 'cocoa' ? 'Drank' : 'Ate'} ${def.name}. (+${heal} HP${def.regen ? `, and ${def.regen} more over ${def.regenT}s` : ''})`, '#80e070');
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

  swing() {
    this.duelBegins();
    const p = this.player;
    if (p.attackCd > 0) return;
    p.attackCd = 0.3;
    p.doAction(0.22);
    this.audio?.play('swing');
    onSwing(this, p);
    lanceThrust(this, p);
  }

  // A swing at the air in front of you (a weapon in hand, nothing under
  // the mouse to hit): turned toward the mouse, wound up and committed like
  // any blow, and it lands on whoever's standing there by then (foe or
  // not: a blade swung at a passer-by is an assault), or on a training
  // dummy. A blade in the other hand follows it round, as ever.
  swingAt() {
    this.duelBegins();
    const p = this.player;
    if (p.attackCd > 0 || p.swing || p.commitT > 0 || p.rollT > 0 || p.stunT > 0 || p.guardBroken > 0 || p.dead) return false;
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
      const tiles = tilesNow(st);
      const foe = this.struckOn(tiles, p)[0];
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
    const on = (e) => tiles.some((t) => t.x === e.x && t.z === e.z) && Math.abs(e.y - by.y) <= 1;
    const out = [];
    for (const n of this.npcs) if (n !== by && !n.dead && !n.down && on(n)) out.push(n);
    for (const c of this.creatures) if (!c.dead && c !== by.mount && !(by.mount && by.mount.creature === c) && on(c)) out.push(c);
    return out;
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
    if (p.attackCd > 0 || p.swing || p.commitT > 0 || target.dead || p.rollT > 0 || p.stunT > 0 || p.guardBroken > 0) return;
    const def = p.heldDef();
    const reach = this.attackReach();
    const quick = 1 / (1 + buffOf(this, 'haste'));
    p.face(target.x, target.z);
    p.sitting = null;
    if (def && def.ranged) {
      if (Math.max(Math.abs(target.x - p.x), Math.abs(target.z - p.z)) > reach) return this.swing();
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
      return;
    }
    if (Math.max(Math.abs(target.x - p.x), Math.abs(target.z - p.z)) > reach || Math.abs(target.y - p.y) > 1) {
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
    const reach = this.attackReach();
    if (target.dead || target.down || Math.max(Math.abs(target.x - p.x), Math.abs(target.z - p.z)) > reach || Math.abs(target.y - p.y) > 1 || target.rollT > 0) {
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
    const crit = riposte || fromRoll || Math.random() < (heroHas(this.hero, 'duelist') ? 0.18 : 0.1);
    if (crit) dmg *= riposte ? 2.2 : 1.8;
    if (riposte) {
      p.riposte = 0;
      this.renderer.floatText(target.x, target.y + 2.4, target.z, 'riposte!', '#ffe070');
    }
    // Caught mid-swing: knocked off their stroke (always, with a heavy
    // blow or a riposte; usually, with a plain one).
    if (target.windup && (heavy || riposte || Math.random() < 0.65)) {
      interrupt(target, heavy ? 0.9 : 0.5);
      this.renderer.floatText(target.x, target.y + 2.8, target.z, 'interrupted', '#ffd0a0');
    }
    onSwing(this, p, target);
    lanceThrust(this, p, target);
    this.damage(target, Math.max(1, Math.round(dmg)), p, crit);
    onBladeHit(this, p, target, { dmg, heavy, crit });
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
    if (target.dead || target.down || Math.max(Math.abs(target.x - p.x), Math.abs(target.z - p.z)) > reach || target.rollT > 0) return false;
    spend(p, Math.max(1, Math.round(staminaCost(STYLES[weaponStyle(off)]) / 2)));
    const dmg = it.damage * 0.75 * damageMult(this.hero) * (1 + buffOf(this, 'fury')) * rageMult(p);
    this.damage(target, Math.max(1, Math.round(dmg)), p);
    this.impact(target, 1, STYLES[weaponStyle(off)]);
    if (!target.moving && target.hp > 0 && !target.sleeping) knock(this, p, target, shove);
    return true;
  }

  // Foes of `by` standing on any of those tiles.
  foesOn(tiles, by) {
    const on = (e) => tiles.some((t) => t.x === e.x && t.z === e.z) && Math.abs(e.y - by.y) <= 1;
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
    // (God mode, from the command console.)
    if (target.kind === 'player' && this.cheats.god) return;
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
    if (target.kind === 'player') {
      // Your armour, and the watch's mail if you wear the colours.
      const a = Math.min(0.7, this.sim.careers.armor() + target.armorValue()) * (1 - phase);
      if (a > 0) amount = Math.max(1, Math.round(amount * (1 - a)));
      armored = a >= 0.1;
    }
    // A fight you're in (the music follows it).
    const foe = target.kind === 'player' ? source : source && source.kind === 'player' ? target : null;
    if (foe) {
      this.combatT = 5;
      this.combatWith = foe.kind === 'npc' ? 'guard' : 'monster';
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
    // A ward of moonlight catches what would have felled you.
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
    // A friendly bout ends when one of you is down to a quarter.
    if (inDuel && target.hp - amount <= Math.ceil(target.maxHp * 0.25)) {
      target.hp = Math.max(1, Math.min(target.hp, Math.ceil(target.maxHp * 0.25)));
      if (target.rec) target.rec.hp = target.hp;
      target.flash = 0.12;
      this.endDuel(target === duel.npc ? 'won' : 'lost');
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
    target.hp -= amount;
    // Jewelled armour answers a blow struck in close.
    if (source && !this.dotHit) onStruck(this, target, source, amount);
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
      if (source && source.name) this.ui.msg(`${source.name} hits you for ${amount}!`, '#ff7060', true);
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
        if (target.warband.kind === 'bandit' || target.warband.merc) this.sim.bandits.onHurt(target);
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
    const p = this.player;
    const sid = guard.settlement.id;
    const jailed = this.sim.justice.jail && this.sim.justice.jail.sid === sid;
    if (!jailed && (this.isWanted(sid) || this.sim.justice.exiled.has(sid)) && !p.dead && guard.distTo(p) <= 12 && this.sim.canSee(guard, p.x, p.z, p.y)) return p;
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
    const p = this.player;
    let best = null;
    let bd = range + 1;
    // (Not you while you're gone into shadow.)
    if (!p.dead && !(p.shadeT > 0) && c.distTo(p) <= range && Math.abs(p.y - c.y) <= 2) {
      best = p;
      bd = c.distTo(p);
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
    const p = this.player;
    if (!p.dead && c.distTo(p) <= r && !(c.S.tame && !p.heldDef()?.damage)) return p;
    for (const o of this.creatures) if (o !== c && o.hostileNow && c.distTo(o) <= r) return o;
    return null;
  }

  kill(e, source) {
    onKill(this, e, source);
    if (this.dungeon && e.inst) this.dungeon.onKill(e);
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
        if (e.warband.kind === 'bandit' || e.warband.merc) this.sim.bandits.onKilled(e, source);
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
      for (const [drop, min, max, chance] of e.S.drops) {
        if (Math.random() > (dress && (drop === 'raw_meat' || drop === 'leather') ? Math.min(1, chance + 0.3) : chance)) continue;
        const item = roasted && drop === 'raw_meat' ? 'cooked_meat' : drop;
        const n = min + Math.floor(Math.random() * (max - min + 1)) + (dress && (drop === 'raw_meat' || drop === 'leather') ? 1 : 0);
        if (npcKill) invAdd(source.rec.inv, item, n);
        else this.spawnDrop(item, n, e.x, e.y, e.z, true);
      }
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
      this.sim.changeRep(n, gain);
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

  playerDied(source) {
    const p = this.player;
    this.audio?.play('death');
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
    this.ui.openDeath(source ? source.name || 'something' : 'misfortune', spilled ? (spilled.length ? 'pack' : 'none') : null);
  }

  respawn() {
    const p = this.player;
    // (Dead down below: you wake up above, and what you dropped stays down there.)
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
  }

  spawning(dt) {
    // (Below ground, nothing wanders in from outside; nor while a story opens.)
    if (this.dungeon || this.cutscene) return;
    this.spawnT -= dt;
    if (this.spawnT > 0) return;
    this.spawnT = 2.5;
    const p = this.player;
    // Despawn far creatures.
    for (const c of this.creatures) {
      if (Math.max(Math.abs(c.x - p.x), Math.abs(c.z - p.z)) > 48) {
        c.dead = true;
        this.removeOcc(c);
      }
    }
    const night = !this.isDay();
    const cap = night ? 9 : 6;
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
      const margin = night ? (this.sim.ancient.has(s, 'lamps') ? 34 : 14) : 6;
      if (x > b.x0 - margin && x < b.x1 + margin && z > b.z0 - margin && z < b.z1 + margin && s.condition !== 'abandoned' && !s.deserted) return;
    }
    const y = this.world.findStandY(x, z, p.y);
    if (y < 0 || this.world.isWaterAt(x, y, z) || this.entityAt(x, y, z)) return;
    const col = this.world.terrain.column(x, z, this.world.terrain.context(x, z, x, z), {});
    const biome = col.biome;
    let species = null;
    if (night) {
      const r = Math.random();
      if ((biome === 'forest' || biome === 'taiga') && r < 0.3) species = 'wolf';
      // (Wisps over marsh and through the woods.)
      else if ((biome === 'swamp' || biome === 'jungle' || biome === 'forest') && r < 0.48) species = 'wisp';
      else species = r < 0.45 ? 'slime' : r < 0.72 ? 'skeleton' : r < 0.88 ? 'ghoul' : 'wisp';
    } else {
      const opts = {
        plains: ['rabbit', 'deer', 'rabbit', 'boar', 'horse', 'sheep', 'cow'], forest: ['deer', 'boar', 'rabbit', 'wolf', 'pig'], taiga: ['deer', 'wolf', 'rabbit', 'sheep'],
        tundra: ['rabbit', 'wolf'], savanna: ['deer', 'boar', 'rabbit', 'horse', 'cow'], jungle: ['boar', 'slime', 'deer', 'pig'], swamp: ['slime', 'boar'],
        desert: ['rabbit'], mountain: ['boar', 'rabbit', 'sheep'], beach: ['rabbit'],
      }[biome] || ['rabbit'];
      species = opts[Math.floor(Math.random() * opts.length)];
      if (species === 'wolf' && Math.random() < 0.6) species = 'deer';
    }
    const variant = Math.floor(Math.random() * (species === 'horse' ? 6 : 3));
    this.addCreature(new Creature(this, species, x, y, z, variant));
    if (SPECIES[species].packs && Math.random() < 0.6) {
      const y2 = this.world.findStandY(x + 1, z, y);
      if (y2 > 0 && !this.entityAt(x + 1, y2, z)) this.addCreature(new Creature(this, species, x + 1, y2, z));
    }
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
    const opts = { tundra: ['rabbit'], desert: ['rabbit'], forest: ['deer', 'rabbit', 'boar'], taiga: ['deer', 'rabbit'], savanna: ['deer', 'boar'], jungle: ['boar', 'deer'], swamp: ['boar'] }[s.biome] || ['rabbit', 'deer', 'rabbit'];
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
    if (this.combatT > 0) this.combatT -= dt;
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
    for (const c of this.creatures) {
      if (c.species !== 'wisp' || c.dead || Math.abs(c.x - this.player.x) > 20 || Math.abs(c.z - this.player.z) > 20 || Math.random() > 0.35) continue;
      const rp = c.renderPos();
      r.emit(rp.x + 0.3 + Math.random() * 0.4, rp.y + 1.2, rp.z + 0.5, { n: 1, color: ['#80d0ff', '#c0f0ff', '#ffffff'], up: -4, speed: 6, gravity: 6, life: 0.9, glow: true });
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

  onBlockChange(x, y, z, o, n) {
    if (isFarmland(n) && this.crops) this.crops.trackSoil(x, y, z, n);
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
    const regions = [];
    for (const v of this.world.saved.values()) regions.push(v);
    for (const r of this.world.regions.values()) if (r.modified) regions.push(r.serialize());
    const p = this.player;
    return {
      v: 2,
      seed: this.seed,
      minute: this.minute,
      day: this.day,
      player: { x: p.x, y: p.y, z: p.z, hp: p.hp, awake: p.awakeSince, inv: p.inv, selected: p.selected, spawn: p.spawn, vigor: p.vigor, blue: p.blue, buffs: p.buffs || [], raft: p.raft ? { x: p.raft.x, z: p.raft.z, ang: p.raft.ang } : null, equip: p.equip, look: p.baseLook, mount: p.mount || null },
      name: this.playerName,
      hero: this.hero || null,
      // (Down below: where, and the floor as it stands. Before the sim's
      // records are written, which keep it.)
      dungeon: this.dungeon ? this.dungeon.serialize() : null,
      relics: serializeRelics(this),
      regions,
      dead: [...this.deadNpcs].map(([sid, set]) => [sid, [...set]]),
      explored: Array.from(this.world.ow.explored),
      stats: this.stats,
      wanted: [...this.wanted],
      crops: this.crops.serialize(),
      sim: this.sim.serialize(),
      placed: [...this.placed],
      roadCamps: [...this.roadCamp],
      riding: this.riding.serialize(),
      leadsOut: leadsOut(this),
      view: this.renderer.view || 0,
      cheats: { ...this.cheats, reveal: !!this.revealMap },
    };
  }

  applySave(data) {
    this.minute = data.minute;
    this.day = data.day;
    for (const r of data.regions || []) this.world.saved.set(this.world.regionKey(r.rx, r.rz), r);
    for (const [sid, list] of data.dead || []) this.deadNpcs.set(sid, new Set(list));
    if (data.explored) this.world.ow.explored.set(data.explored);
    if (data.stats) this.stats = data.stats;
    if (data.cheats) {
      this.cheats = { ...this.cheats, mapTeleport: !!data.cheats.mapTeleport, god: !!data.cheats.god };
      if (data.cheats.reveal) this.revealMap = true;
    }
    if (data.sim) this.sim.load(data.sim);
    this.placed = new Map(data.placed || []);
    loadRelics(this, data.relics);
    this.roadCamp = new Map(data.roadCamps || []);
    this.riding.load(data.riding);
    this.crops.load(data.crops);
    for (const [sid, t] of data.wanted || []) this.wanted.set(sid, t);
    const pd = data.player;
    this.loadAround(pd.x, pd.z, true);
    this.player = new Player(this, pd.x, pd.y, pd.z);
    if (pd.blue) this.player.blue = pd.blue;
    if (pd.buffs) this.player.buffs = pd.buffs;
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
    if (data.hero) this.hero = data.hero;
    this.applyHero();
    this.moveEntity(this.player, pd.x, pd.y, pd.z);
    this.sim.careers.applyLook();
    // Saved down below: back down there.
    const dg = data.dungeon;
    const rec = dg ? this.sim.dungeons.get(dg.id) : null;
    if (rec) {
      const run = new DungeonRun(this, rec);
      run.surface = dg.surface || { x: rec.x, y: GROUND, z: rec.z + 3 };
      run.stash = { creatures: [], drops: [] };
      run.carried = dg.carried || null;
      this.dungeon = run;
      run.open(dg.floor, { x: dg.x, z: dg.z });
    } else if (this.world.inInstance(pd.x)) {
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
