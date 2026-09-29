// NPC behaviour: follow the daily schedule (and any special plans the town
// simulation gives them: mourning, hunting for food, building, trials,
// trading trips) by walking tile by tile; open/close doors; react to threats
// by fighting, calling the guards, or fleeing.
import { Entity } from './entity.js';
import { NPC_STEP_TIME, GROUND } from '../config.js';
import { HOBBIES, jobTitle } from './npcgen.js';
import { findPath } from './pathfind.js';
import { BLOCKS, B, CROPS, cropMature, isFarmland } from '../world/blocks.js';
import { ITEMS, rollDrops } from '../world/items.js';
import { RNG, hash4 } from '../util/rng.js';
import { dialogueLine, greetLine } from '../game/dialogue.js';
import { lawOn } from '../sim/laws.js';
import { activityFor, entryStart, invCount, invTake, invAdd, setOverride, weatherBreak } from '../sim/econ.js';

const EMOTES = {
  work: ['•', '#e8d8b0'], read: ['≡', '#a0c8ff'], study: ['≡', '#a0c8ff'], pray: ['†', '#ffe8a0'], music: ['♪', '#ff9ad0'],
  drink: ['♦', '#ffb060'], dice: ['¤', '#ffe070'], gossip: ['…', '#e8e8e8'], social: ['☺', '#e8e8e8'], fish: ['~', '#80c8ff'],
  garden: ['♣', '#80e070'], sketch: ['✎', '#e8d8b0'], train: ['!', '#ff8060'], stargaze: ['*', '#c8d8ff'], smoke: ['°', '#c8c8c8'],
  play: ['♪', '#80ffb0'], eat: ['♥', '#ff8080'], stroll: ['·', '#c8c8c8'], farm: ['♣', '#c8e070'], chop: ['!', '#e8b080'], mine: ['!', '#c8c8d8'],
  mourn: ['†', '#b0b8e0'], funeral: ['†', '#b0b8e0'], wedding: ['♥', '#ff9ad0'], poster: ['≡', '#f0e8d0'], build: ['■', '#e8c890'], repair: ['■', '#c8c8d8'], cook: ['°', '#ffb060'], hunt: ['►', '#c8e070'], forage: ['♣', '#c8e070'],
};

// What a miner will dig into.
const ROCK = new Set(['stone', 'cobblestone', 'coal_ore', 'iron_ore', 'gold_ore', 'gem_ore', 'gravel', 'sandstone', 'clay'].map((k) => B[k]).filter((v) => v !== undefined));

const MEAL_LINES = {
  terrible: ['Ugh... gruel again.', 'Is this... food?', 'Burnt. Of course.', 'I\'ll pretend that was stew.'],
  acceptable: ['Not bad at all.', 'Hits the spot.', 'Good and hearty.'],
  delightful: ['Mmm! Delicious!', 'Now THAT is cooking!', 'What a meal!'],
  plain: ['Bread again. It\'ll do.', 'A simple meal.'],
  none: ['*stomach growls*', 'Nothing to eat today...', 'I\'m so hungry...'],
};

export class NPC extends Entity {
  constructor(game, rec, layout) {
    super(game, 0, 0, 0);
    this.kind = 'npc';
    this.rec = rec;
    this.layout = layout;
    this.settlement = layout.settlement;
    this.look = rec.look;
    this.hp = rec.hp ?? rec.maxHp;
    this.maxHp = rec.maxHp;
    this.rng = new RNG(hash4(rec.idx, layout.settlement.seed, 77, game.day));
    this.state = 'routine';
    this.path = null;
    this.pathI = 0;
    this.goal = null;
    this.activity = null;
    this.spot = null;
    this.idleT = 0;
    this.waitT = 0;
    this.threat = null;
    this.stateT = 0;
    this.attackCd = 0;
    this.openedDoors = []; // doors this person opened and must shut again
    this.sleeping = false;
    this.bedTile = null;
    this.greetCd = this.rng.float(8, 30);
    this.emoteCd = this.rng.float(3, 12);
    this.step = NPC_STEP_TIME * (rec.age === 'elder' ? 1.35 : rec.age === 'child' ? 0.85 : 1) * this.rng.float(0.9, 1.12);
    this.pathFails = 0;
    this.haltT = 0;
    this.prey = null;
    this.mealBubble = null;
    this.lineCd = this.rng.float(4, 10);
  }

  get name() {
    return `${this.rec.name.first} ${this.rec.name.last}`;
  }

  get title() {
    if (this.visit) return 'Traveling Merchant';
    if (this.nomad) return 'Nomad';
    return jobTitle(this.rec, this.settlement);
  }

  // The town this person belongs to (a visiting merchant's is elsewhere).
  get homeLayout() {
    return this.originLayout || this.layout;
  }

  get homeName() {
    if (this.nomad) return `the ${this.nomad.family} band`;
    return this.visit ? this.visit.fromName : this.settlement.name;
  }

  // Their house in the town they're in now (none when visiting).
  homeBuilding() {
    if (this.visit || this.rec.home === null || this.rec.home === undefined) return null;
    return this.layout.buildings[this.rec.home] || null;
  }

  // Sitting down on a chair, bench or stool they walked to.
  get sitting() {
    return this.atGoal && !this.moving && !this.sleeping && this.state === 'routine' && this.spot && this.spot.seat && this.x === this.spot.x && this.z === this.spot.z;
  }

  get act() {
    return this.activity ? this.activity.entry.act : null;
  }

  heldItem() {
    if (this.sleeping) return null;
    if (this.caravan) return 'crate';
    if (this.state === 'fight') return (this.threat && this.distTo(this.threat) <= 1.5 && this.meleeWeapon()) || this.weapon();
    if (this.prey) return this.weapon();
    const a = this.activity?.entry;
    if (!a) return null;
    if (a.act === 'build' || a.act === 'repair') return 'hammer';
    if ((a.act === 'forage' || a.act === 'hunt') && this.atGoal) return this.weapon();
    if (a.act === 'work' && this.rec.job === 'farmer' && (this.rec.water || 0) > 0) return 'water_bucket';
    if (a.act === 'work' && this.atGoal) return this.rec.equipment.tool;
    if (a.act === 'hobby' && this.atGoal) {
      const h = HOBBIES[a.hobby];
      if (h && h.item && this.rec.equipment.items.some((i) => i.item === (a.hobby === 'music' ? this.rec.equipment.hobbyItem : h.item))) return a.hobby === 'music' ? this.rec.equipment.hobbyItem : h.item;
    }
    if (this.rec.job === 'guard') return this.rec.equipment.tool;
    return null;
  }

  weapon() {
    const t = this.rec.equipment.tool;
    if (t && ITEMS[t] && (ITEMS[t].kind === 'weapon' || ITEMS[t].kind === 'tool')) return t;
    const w = this.rec.equipment.items.find((i) => ITEMS[i.item]?.kind === 'weapon');
    return w ? w.item : null;
  }

  meleeWeapon() {
    const w = this.weapon();
    if (w && !ITEMS[w].ranged) return w;
    const alt = this.rec.equipment.items.find((i) => ITEMS[i.item]?.kind === 'weapon' && !ITEMS[i.item].ranged);
    return alt ? alt.item : null;
  }

  attackDamage(ranged = false) {
    const w = ranged ? this.weapon() : this.meleeWeapon();
    const base = w ? ITEMS[w].damage : 1.5;
    return Math.max(1, Math.round(base * (this.rec.job === 'guard' ? 1.2 : 1) * (this.rec.age === 'child' ? 0.4 : 1)));
  }

  canShoot() {
    const w = this.weapon();
    return w && ITEMS[w].ranged && invCount(this.rec.inv || [], 'arrow') > 0;
  }

  // ------------------------------------------------------------ placement
  placeForCurrentActivity() {
    const act = activityFor(this.rec, this.game.day, this.game.minute);
    this.activity = act;
    const goal = this.pickGoal(act.entry);
    this.goal = goal;
    let t = goal ? { x: goal.x, y: goal.y, z: goal.z } : this.homeTile();
    if (goal && goal.bed) {
      this.teleport(goal.bed.x, goal.y, goal.bed.z);
      this.sleeping = true;
      this.bedTile = goal.bed;
      this.atGoal = true;
      return;
    }
    const w = this.game.world;
    const y = w.findStandY(t.x, t.z, t.y ?? GROUND);
    if (y < 0 || this.game.occupiedBySolid(t.x, y, t.z, this)) t = this.homeTile();
    this.teleport(t.x, w.findStandY(t.x, t.z, GROUND), t.z);
    this.atGoal = goal ? this.x === goal.x && this.z === goal.z : false;
  }

  homeTile() {
    const b = this.homeBuilding();
    if (b && b.homeSpots.length) return b.homeSpots[this.rec.idx % b.homeSpots.length];
    const p = this.layout.plaza;
    return { x: p.cx, y: GROUND, z: p.cz + 2 };
  }

  // ------------------------------------------------------------ goals
  pickGoal(e) {
    const L = this.layout;
    const rec = this.rec;
    const home = this.homeBuilding();
    const rng = this.rng;
    this.releaseSpot();
    const claim = (spots) => {
      const free = spots.filter((s) => !s.claim || s.claim === this.id);
      if (!free.length) return null;
      const s = free[rng.int(0, free.length - 1)];
      s.claim = this.id;
      this.spot = s;
      return { x: s.x, y: s.y, z: s.z, face: s.face, tag: s.tags[0] };
    };
    const inBuilding = (b, tag) => {
      if (!b) return null;
      const seats = b.seats.filter((s) => !tag || s.tags.includes(tag));
      const g = claim(seats);
      if (g) return g;
      if (b.homeSpots.length) {
        const s = b.homeSpots[rng.int(0, b.homeSpots.length - 1)];
        return { x: s.x, y: s.y, z: s.z, face: rng.int(0, 3), wanderIn: b };
      }
      return null;
    };
    const tagged = (tag) => claim(L.spotsByTag(tag));
    const buildingOf = (type) => {
      const list = L.buildings.filter((b) => b.type === type);
      return list.length ? list[hash4(rec.idx, type.length) % list.length] : null;
    };
    const roadTile = () => {
      const p = L.patrol[rng.int(0, L.patrol.length - 1)] || { x: L.plaza.cx, z: L.plaza.cz };
      return { x: p.x + rng.int(-2, 2), y: GROUND, z: p.z + rng.int(-2, 2), wander: true };
    };
    // Law-abiding folk are indoors after curfew.
    const curfew = () => lawOn(L, 'curfew') && (this.game.minute >= 1320 || this.game.minute < 300) && this.rec.job !== 'guard';
    const plazaTile = () => ({ x: rng.int(L.plaza.x0 + 1, L.plaza.x1 - 1), y: GROUND, z: rng.int(L.plaza.z0 + 1, L.plaza.z1 - 1), wander: true });
    const target = (t, extra = {}) => (t ? { x: t.x, y: GROUND, z: t.z, ...extra } : null);
    switch (e.act) {
      case 'sleep': {
        const bed = home && home.beds[rec.bed];
        if (bed && bed.access) return { x: bed.access.x, y: GROUND, z: bed.access.z, bed };
        if (bed) return { x: bed.x, y: GROUND, z: bed.z, bed, near: 1 };
        return inBuilding(home);
      }
      case 'eat':
        if (e.place === 'tavern') return inBuilding(buildingOf('tavern'), 'eat') || inBuilding(home, 'eat');
        if (e.place === 'work') return this.workGoal();
        return inBuilding(home, 'eat');
      case 'home':
        return inBuilding(home, rng.chance(0.4) ? 'home' : null);
      case 'work':
        return this.workGoal();
      case 'study':
        return tagged('study') || inBuilding(buildingOf('temple'), 'pray') || plazaTile();
      case 'play': {
        // A child who wants to sit finds a bench; one standing about stays put.
        if (this.playMood === 'sit') {
          const g = claim(L.spotsByTag('rest').filter((q) => q.seat));
          if (g) return { ...g, stay: true };
        }
        if (this.playMood === 'idle') return { x: this.x, y: this.y, z: this.z, face: rng.int(0, 3), stay: true };
        // Out in the streets and round the houses as much as on the square.
        const r = rng.next();
        if (r < 0.25) return tagged('play') || plazaTile();
        if (r < 0.55 && home && home.outside) return { x: home.outside.x + rng.int(-3, 3), y: GROUND, z: home.outside.z + rng.int(-3, 3), wander: true };
        if (r < 0.85) return roadTile();
        return plazaTile();
      }
      case 'social':
        if (curfew()) return inBuilding(home);
        if (e.place === 'tavern' || this.game.minute > 1140) return inBuilding(buildingOf('tavern'), 'social') || tagged('social') || plazaTile();
        return tagged(rng.chance(0.5) ? 'gossip' : 'social') || plazaTile();
      case 'pray':
        return inBuilding(buildingOf('temple'), 'pray') || target(e.target, { tag: 'pray' }) || inBuilding(home);
      case 'wander':
        if (curfew()) return inBuilding(home);
        return roadTile();
      case 'help': {
        // Tagging along with Mum or Dad at work, else off round the town.
        const par = this.workingParent();
        if (!par) return roadTile();
        return { x: par.x, y: par.y, z: par.z, near: 1, tag: 'help', helping: par.rec.idx };
      }
      case 'alarm':
        return target(e.target, { tag: 'alarm', near: 2 });
      case 'event': {
        // A wedding or a feast: their own place there (a seat on a bench, a
        // spot by the tables, or a place in the ring round the maypole).
        const t = e.target;
        if (!t) return plazaTile();
        if (e.seat) this.spot = { x: t.x, y: GROUND, z: t.z, face: e.face, tags: ['event'], seat: true };
        return { x: t.x, y: GROUND, z: t.z, face: e.face, tag: 'event', dance: e.role === 'dance' };
      }
      case 'poster': {
        // Round the town with the posters, the nearest next.
        const events = this.game.sim.events;
        const ev = events.get(L, e.ev);
        const i = ev ? events.nextPoster(L, ev, e.mode, this) : -1;
        if (i < 0) {
          if (rec.override && rec.override.act === 'poster') rec.override = null;
          return inBuilding(home);
        }
        const q = ev.posters[i];
        return { x: q.x, y: GROUND, z: q.z, near: 1, tag: 'poster', poster: i };
      }
      case 'mourn': case 'funeral':
        return target(e.target, { face: 2, tag: e.act, near: e.act === 'funeral' ? 1 : 0 });
      case 'bury':
        return target(e.target, { face: 2, tag: 'bury', near: 1 });
      case 'build': {
        const sites = e.sites || [e.target];
        return target(sites[rng.int(0, sites.length - 1)], { tag: 'build', build: true });
      }
      case 'trial':
        return target(e.target, { tag: 'trial' });
      case 'repair':
        return target(e.target, { tag: 'repair', near: 1 });
      case 'customer': case 'confront':
        return null;
      case 'camp':
        // Nomads look the town over: the square, the streets, the houses.
        return rng.chance(0.5) ? plazaTile() : roadTile();
      case 'watch':
        return target(e.target, { tag: 'watch', near: 2 });
      case 'sell':
        return target(e.target, { near: 1, tag: 'sell', sell: true });
      case 'forage': {
        const spots = [...L.spotsByTag('hunt'), ...L.spotsByTag('fish')];
        const s = spots.length ? spots[rng.int(0, spots.length - 1)] : null;
        return s ? { x: s.x, y: s.y, z: s.z, face: s.face, tag: 'forage', hunt: true, trap: s.trap } : roadTile();
      }
      case 'travel': {
        const ents = L.entrances.length ? L.entrances : [{ x: L.bounds.x0 + 1, z: L.plaza.cz }];
        let best = ents[0];
        for (const q of ents) if (Math.abs(q.x - this.x) + Math.abs(q.z - this.z) < Math.abs(best.x - this.x) + Math.abs(best.z - this.z)) best = q;
        return { x: best.x, y: GROUND, z: best.z, near: 1, leave: true };
      }
      case 'visit': {
        const stalls = L.spotsByTag('shop');
        return claim(stalls) || { ...plazaTile(), face: 0, visit: true };
      }
      case 'hobby': {
        const h = HOBBIES[e.hobby];
        if (!h) return roadTile();
        const tag = h.tag;
        if (tag === 'read') return rng.chance(0.5) ? tagged('read') || inBuilding(home, 'home') : inBuilding(home, 'home') || tagged('read');
        if (tag === 'pray') return inBuilding(buildingOf('temple'), 'pray') || tagged('pray') || inBuilding(home);
        if (tag === 'drink' || tag === 'dice') return inBuilding(buildingOf('tavern'), tag) || tagged('social') || plazaTile();
        if (tag === 'stroll') return roadTile();
        if (tag === 'garden') return tagged('garden') || inBuilding(home);
        return tagged(tag) || tagged('stroll') || plazaTile();
      }
      default:
        return inBuilding(home);
    }
  }

  // A parent of this child who is at work in town right now.
  workingParent() {
    for (const i of this.rec.parents || []) {
      const r = this.layout.npcs[i];
      const e = r && r.ent;
      if (e && !e.dead && !e.sleeping && e.act === 'work' && e.state === 'routine' && e.layout === this.layout && r.job !== 'guard' && r.job !== 'miner') return e;
    }
    return null;
  }

  workGoal() {
    const L = this.layout;
    const w = this.rec.work;
    const rng = this.rng;
    const claimFrom = (spots) => {
      const free = spots.filter((s) => !s.claim || s.claim === this.id);
      if (!free.length) return null;
      const s = free[hash4(this.rec.idx, spots.length) % free.length];
      s.claim = this.id;
      this.spot = s;
      return { x: s.x, y: s.y, z: s.z, face: s.face, tag: s.tags[0], trap: s.trap };
    };
    if (!w || w.kind === 'none') return null;
    if (w.kind === 'building') {
      const b = L.buildings[w.building];
      if (!b) return null;
      return claimFrom(b.work) || claimFrom(b.seats) || (b.homeSpots.length ? { ...b.homeSpots[rng.int(0, b.homeSpots.length - 1)], face: 0 } : null);
    }
    if (w.kind === 'spot') {
      const s = L.spots[w.spot];
      if (!s) return null;
      s.claim = this.id;
      this.spot = s;
      return { x: s.x, y: s.y, z: s.z, face: s.face, tag: 'work' };
    }
    if (w.kind === 'tag') {
      // Trappers alternate between checking snares (the town's and their
      // own) and hunting.
      if (w.tag === 'hunt' && rng.chance(0.3)) {
        const own = this.ownSnareGoal();
        if (own) return own;
      }
      const tag = w.tag === 'hunt' && rng.chance(0.45) && L.spotsByTag('trap').length ? 'trap' : w.tag;
      const g = claimFrom(L.spotsByTag(tag));
      if (g) {
        g.tag = w.tag;
        if (w.tag === 'hunt') g.hunt = true;
        return g;
      }
      const b = w.building != null ? L.buildings[w.building] : null;
      if (b) return claimFrom(b.work) || (b.homeSpots.length ? { ...b.homeSpots[rng.int(0, b.homeSpots.length - 1)], face: 0, wanderIn: b } : null);
      const p = L.plaza;
      return { x: rng.int(p.x0, p.x1), y: GROUND, z: rng.int(p.z0, p.z1), face: 0, wander: true };
    }
    if (w.kind === 'rounds') {
      // Builders walk the town looking over the buildings.
      const bs = L.buildings.filter((b) => b.outside && !b.underConstruction);
      const b = bs[rng.int(0, bs.length - 1)];
      if (!b) return null;
      return { x: b.outside.x, y: GROUND, z: b.outside.z, face: rng.int(0, 3), tag: 'work', inspect: b.id, near: 1 };
    }
    if (w.kind === 'plaza') {
      const p = L.plaza;
      return { x: rng.chance(0.5) ? p.x0 : p.x1, y: GROUND, z: rng.int(p.z0, p.z1), face: 0, tag: 'work' };
    }
    if (w.kind === 'patrol') {
      if (w.post && rng.chance(0.6)) return { x: w.post.x, y: GROUND, z: w.post.z, face: rng.int(0, 3), tag: 'work', patrol: true };
      const pts = L.patrol;
      const p = pts[rng.int(0, pts.length - 1)];
      return { x: p.x, y: GROUND, z: p.z, face: rng.int(0, 3), tag: 'work', patrol: true };
    }
    return null;
  }

  releaseSpot() {
    if (this.spot && this.spot.claim === this.id) this.spot.claim = null;
    this.spot = null;
  }

  // ------------------------------------------------------------ update
  update(dt) {
    this.updateBase(dt);
    if (this.dead) return;
    if (this.attackCd > 0) this.attackCd -= dt;
    if (this.avoid) this.avoid.t -= dt;
    this.stateT += dt;
    this.rec.hp = this.hp;
    this.closeDoorBehind();
    if (this.moving) return;
    // Someone you're talking to stands and listens.
    if (this.state === 'routine' && this.game.talkingTo === this && !this.sleeping) {
      this.face(this.game.player.x, this.game.player.z);
      return;
    }
    switch (this.state) {
      case 'routine':
        this.routine(dt);
        break;
      case 'flee':
        this.flee(dt);
        break;
      case 'fight':
        this.fight(dt);
        break;
      case 'alert':
        this.alert(dt);
        break;
      case 'escort':
        this.escortWalk(dt);
        break;
      case 'hired':
        this.hiredDuty(dt);
        break;
      case 'leaving':
        this.leaveWalk(dt);
        break;
      case 'caravan':
        this.caravanWalk(dt);
        break;
      case 'alarm':
        this.alarmRun(dt);
        break;
      case 'retreat':
        this.retreatRun(dt);
        break;
    }
  }

  // Off to the nearest bell to wake the rest of the watch. After ringing,
  // a guard fights (or, if badly hurt, falls back to the other guards); a
  // citizen runs for safety.
  startAlarm(threat, after = null) {
    const b = this.game.nearestBell(this.layout, this.x, this.z);
    this.afterAlarm = after || (this.rec.job === 'guard' ? 'fight' : 'flee');
    if (!b) return this.afterBell(threat);
    this.state = 'alarm';
    this.threat = threat;
    this.bell = b;
    this.ringT = 0;
    this.stateT = 0;
    this.path = null;
    this.atGoal = false;
    this.releaseSpot();
    this.say(this.rng.pick(this.rec.job === 'guard' ? ['To the bell!', 'Raise the alarm!', 'I need the others. To the bell!'] : ['Ring the bell! Wake the guards!', 'Help! To the bell!']), 2.5, '#ffb080');
  }

  afterBell(t) {
    const live = t && !t.dead;
    if (this.afterAlarm === 'retreat') return this.startRetreat(t);
    if (this.afterAlarm === 'flee') return live ? this.startFlee(t) : this.calmDown(true);
    return live ? this.engage(t) : this.calmDown(true);
  }

  // A hurt guard falls back to the nearest of their comrades, then fights
  // on beside them.
  startRetreat(t) {
    const buddy = this.game.npcs.filter((n) => n !== this && !n.dead && !n.sleeping && n.rec.job === 'guard' && n.layout === this.layout).sort((a, b) => a.distTo(this) - b.distTo(this))[0];
    this.retreated = true;
    if (!buddy) return t && !t.dead ? this.engage(t) : this.calmDown(true);
    this.state = 'retreat';
    this.threat = t;
    this.buddy = buddy;
    this.stateT = 0;
    this.path = null;
    this.say(this.rng.pick(['Fall back! I need help!', 'I\'m hurt! To me!', 'Help me hold them!']), 2.5, '#ffb080');
  }

  retreatRun() {
    const b = this.buddy;
    const t = this.threat;
    if (!b || b.dead || this.stateT > 20 || this.followPath({ x: b.x, z: b.z }, 2)) {
      this.buddy = null;
      if (t && !t.dead) {
        this.engage(t);
        if (b && !b.dead && b.state === 'routine') b.engage(t);
      } else this.calmDown(true);
    }
  }

  alarmRun(dt) {
    const b = this.bell;
    const t = this.threat;
    if (!b || this.stateT > 30) return t && !t.dead ? this.engage(t) : this.calmDown(true);
    if (!this.followPath({ x: b.x, z: b.z }, 1)) return;
    this.face(b.x, b.z);
    this.ringT += dt;
    if (this.ringT > 0.4 && this.ringT - dt <= 0.4) {
      this.doAction(0.5);
      this.say('Wake up! To arms!', 2.5, '#ffb040');
      this.game.ringBell(b.x, b.z, t && !t.dead ? t : null, this);
    }
    if (this.ringT > 1.6) {
      this.bell = null;
      this.afterBell(t);
    }
  }

  // Hired by the player: keep close, see off any beasts, pass the time.
  hiredDuty(dt) {
    const g = this.game;
    const p = g.player;
    const car = g.sim.careers;
    if (!this.hired || car.escort !== this.hired) {
      this.hired = null;
      this.calmDown(true);
      return;
    }
    const t = car.escortThreat(this);
    if (t) {
      if (this.rng.chance(0.4)) this.say(this.rng.pick(['Stay behind me!', 'I\'ve got this one!', 'Back, beast!']), 2, '#ffe070');
      this.engage(t);
      return;
    }
    const d = Math.max(Math.abs(p.x - this.x), Math.abs(p.z - this.z));
    if (d > 22 || Math.abs(p.y - this.y) > 6 || (this.pathFails > 2 && d > 5)) {
      // Fell behind: catch up out of sight.
      const spot = g.findFreeSpot(p.x - (p.dir === 3 ? 1 : p.dir === 1 ? -1 : 0), p.z - (p.dir === 0 ? 1 : p.dir === 2 ? -1 : 0), p.y);
      this.teleport(spot.x, spot.y, spot.z);
      this.path = null;
      this.pathFails = 0;
      return;
    }
    this.lineCd -= dt;
    if (d <= 2) {
      this.path = null;
      if (this.lineCd <= 0 && !p.sleeping) {
        this.lineCd = this.rng.float(50, 120);
        this.say(this.escortLine(), 3.5);
      }
      this.idleT -= dt;
      if (this.idleT <= 0) {
        this.idleT = this.rng.float(2, 6);
        if (this.rng.chance(0.5)) this.face(p.x, p.z);
        else this.dir = this.rng.int(0, 3);
      }
      return;
    }
    if (!this.fgoal || Math.abs(this.fgoal.x - p.x) + Math.abs(this.fgoal.z - p.z) > 1) {
      this.fgoal = { x: p.x, y: p.y, z: p.z };
      this.path = null;
    }
    const box = { x0: Math.min(this.x, p.x) - 12, z0: Math.min(this.z, p.z) - 12, x1: Math.max(this.x, p.x) + 12, z1: Math.max(this.z, p.z) + 12 };
    this.followPath(this.fgoal, 1, box);
  }

  escortLine() {
    const g = this.game;
    const s = g.currentSettlement;
    const left = Math.ceil(g.sim.careers.hoursLeft());
    const lines = ['Keep your eyes open.', 'Quiet so far.', 'I\'ve walked worse roads.', `${left} more hours on the job.`];
    if (!g.isDay()) lines.push('Beasts come out after dark. Stay close.', 'I don\'t like this darkness.');
    if (s && s.id === this.settlement.id) lines.push('Home sweet home.');
    else if (s) lines.push(`So this is ${s.name}.`, `Never cared much for ${s.name}.`);
    else lines.push('Nice country out here.', 'Watch your footing.');
    return this.rng.pick(lines);
  }

  // Set off down the road toward their own town.
  headHome() {
    const b = this.layout.bounds;
    const hx = (b.x0 + b.x1) / 2;
    const hz = (b.z0 + b.z1) / 2;
    const d = Math.hypot(hx - this.x, hz - this.z) || 1;
    this.state = 'leaving';
    this.stateT = 0;
    this.path = null;
    this.threat = null;
    this.leaveGoal = { x: Math.round(this.x + ((hx - this.x) / d) * 18), y: this.y, z: Math.round(this.z + ((hz - this.z) / d) * 18) };
    return d;
  }

  // A merchant on the road between towns, pack on their back: a stretch at
  // a time towards where they're going.
  caravanWalk() {
    const c = this.caravan;
    if (!c) {
      this.state = 'routine';
      return;
    }
    const d = Math.hypot(c.tx - this.x, c.tz - this.z) || 1;
    const g = this.leaveGoal;
    if (!g || Math.max(Math.abs(g.x - this.x), Math.abs(g.z - this.z)) <= 1 || this.stateT > 25) {
      const k = Math.min(12, d);
      this.leaveGoal = { x: Math.round(this.x + ((c.tx - this.x) / d) * k), y: this.y, z: Math.round(this.z + ((c.tz - this.z) / d) * k) };
      this.stateT = 0;
      this.path = null;
    }
    const lg = this.leaveGoal;
    const box = { x0: Math.min(this.x, lg.x) - 8, z0: Math.min(this.z, lg.z) - 8, x1: Math.max(this.x, lg.x) + 8, z1: Math.max(this.z, lg.z) + 8 };
    this.followPath(lg, 1, box);
  }

  // Heading home down the road after a job, then gone.
  leaveWalk() {
    const g = this.game;
    const p = g.player;
    const far = Math.max(Math.abs(p.x - this.x), Math.abs(p.z - this.z)) > 16;
    if (this.stateT > 40 || !this.leaveGoal || (far && this.stateT > 6)) {
      g.despawnNpc(this);
      return;
    }
    const box = { x0: Math.min(this.x, this.leaveGoal.x) - 10, z0: Math.min(this.z, this.leaveGoal.z) - 10, x1: Math.max(this.x, this.leaveGoal.x) + 10, z1: Math.max(this.z, this.leaveGoal.z) + 10 };
    if (this.followPath(this.leaveGoal, 1, box) && far) g.despawnNpc(this);
  }

  // Leading an arrested player to the jail on a rope.
  escortWalk(dt) {
    const j = this.game.sim.justice;
    const e = j.escort;
    const p = this.game.player;
    if (!e || e.guard !== this) {
      this.calmDown(true);
      return;
    }
    if (e.phase !== 'walk') {
      this.face(p.x, p.z);
      return;
    }
    // Don't get too far ahead of the prisoner.
    if (Math.abs(this.x - p.x) + Math.abs(this.z - p.z) > 2) {
      this.face(p.x, p.z);
      return;
    }
    if (this.followPath(e.goal, 0)) j.escortArrived();
  }

  routine(dt) {
    const game = this.game;
    // Out of their own town with no reason to be here: walk home.
    if (this.rec.away && !this.visit) {
      this.headHome();
      return;
    }
    let act = activityFor(this.rec, game.day, game.minute);
    if (!this.activity || act.key !== this.activity.key) {
      const wasWork = this.activity && this.activity.entry.act === 'work';
      this.activity = act;
      this.wake();
      // After a day's hunting or fishing, take the catch to the tavern;
      // miners take their ore to the smithy.
      if (wasWork && act.entry.act !== 'work' && act.entry.act !== 'eat' && act.entry.act !== 'sleep' && ['trapper', 'fisher', 'miner'].includes(this.rec.job)) {
        const miner = this.rec.job === 'miner';
        const goods = miner ? ['iron_ore', 'coal', 'gold_ore'] : ['raw_meat', 'fish'];
        const catchN = (this.rec.inv || []).reduce((n, q) => n + (goods.includes(q.item) ? q.count : 0), 0);
        const dest = this.layout.buildings.find((b) => b.type === (miner ? 'smithy' : 'tavern'));
        if (catchN >= 2 && dest && !this.rec.override) {
          const now = game.day * 1440 + game.minute;
          setOverride(this.rec, now, now + 50, 'sell', { target: dest.inside, place: dest.type });
          act = activityFor(this.rec, game.day, game.minute);
          this.activity = act;
        }
      }
      this.prey = null;
      this.mealBubble = null;
      entryStart(game.sim, this.layout, this.rec, act, game.day, this.rng);
      this.goal = this.pickGoal(act.entry);
      this.path = null;
      this.atGoal = false;
      this.pathFails = 0;
      // Miners heading out: a big enough watch spares a guard to go along.
      if (this.rec.job === 'miner' && act.entry.act === 'work' && this.goal) game.sim.escortMiner(this, act);
    }
    // Rain or snow sends the less dedicated home early.
    if (act.entry.act === 'work' && !this.visit && !this.nomad && this.rng.chance(dt * 0.04)) {
      const sky = game.weatherIn(this.settlement);
      if (sky !== 'clear' && weatherBreak(this.rec, sky, game.day, game.minute)) {
        this.activity = null;
        const lines = sky === 'snow' ? ['Too cold for this. I\'m going home.', 'My fingers are frozen. That\'s it for today.'] : sky === 'fog' ? ['Can\'t see my own hands in this fog. I\'m off home.'] : ['It\'s pouring! I\'m calling it a day.', 'Soaked through. Home, I think.', 'Nobody works in this rain. Not me, anyway.'];
        this.say(this.rng.pick(lines), 3, '#a0b8d0');
        return;
      }
    }
    // A guard watching over a miner goes where they go, and home with them.
    if (this.act === 'watch') {
      const o = this.rec.override;
      const ward = o && this.layout.npcs[o.ward];
      const we = ward && ward.ent;
      if (!we || we.dead || we.act !== 'work') {
        this.rec.override = null;
        this.activity = null;
        return;
      }
      if (this.goal && Math.max(Math.abs(this.goal.x - we.x), Math.abs(this.goal.z - we.z)) > 4 && !we.moving) {
        this.goal = { x: we.x, y: we.y, z: we.z, tag: 'watch', near: 2 };
        this.atGoal = false;
        this.path = null;
      }
    }
    // A child helping a parent keeps close by them as they work.
    if (this.act === 'help' && this.goal && this.goal.helping !== undefined) {
      const par = this.layout.npcs[this.goal.helping]?.ent;
      if (!par || par.dead || par.act !== 'work') {
        this.goal = this.pickGoal(this.activity.entry);
        this.atGoal = false;
        this.path = null;
      } else if (Math.max(Math.abs(this.goal.x - par.x), Math.abs(this.goal.z - par.z)) > 2 && !par.moving) {
        this.goal = { x: par.x, y: par.y, z: par.z, near: 1, tag: 'help', helping: this.goal.helping };
        this.atGoal = false;
        this.path = null;
      }
    }
    // Guards react to wanted players and nearby monsters (at night, running
    // to ring the alarm bell first if the rest of the watch is asleep).
    if (this.rec.job === 'guard' && !this.sleeping) {
      const t = game.findGuardTarget(this);
      if (t) {
        if (game.alarmNeeded(this, t)) this.startAlarm(t);
        else this.engage(t);
        return;
      }
    }
    if (this.sleeping) return;
    if (this.act === 'customer' || this.act === 'confront') {
      this.customerWalk();
      return;
    }
    if (this.rec.job === 'trapper' && this.meleeWeapon()) {
      const beast = game.creatures.find((c) => !c.dead && c.hostileNow && this.distTo(c) <= 2 && Math.abs(c.y - this.y) <= 1);
      if (beast) {
        this.react(beast, false);
        return;
      }
    }
    if (this.prey) {
      this.hunt(dt);
      return;
    }
    if (!this.goal) {
      this.idle(dt);
      return;
    }
    if (this.atGoal) {
      this.atGoalBehaviour(dt);
      return;
    }
    if (this.followPath(this.goal, this.goal.near || 0)) {
      this.atGoal = true;
      this.idleT = this.rng.float(6, 20);
      if (this.goal.bed) {
        this.fromTile = { x: this.x, y: this.y, z: this.z };
        this.teleport(this.goal.bed.x, this.y, this.goal.bed.z);
        this.sleeping = true;
        this.bedTile = this.goal.bed;
      } else if (this.goal.face !== undefined) this.dir = this.goal.face;
      this.arrived();
    }
  }

  // Things that happen the moment they reach where they were going.
  arrived() {
    const g = this.goal;
    const act = this.act;
    if (g.leave) {
      // Out on the road: gone until they come back.
      this.game.despawnNpc(this);
      return;
    }
    if (act === 'eat' && this.rec.lastMeal && this.rec.lastMeal.day === this.game.day) this.mealBubble = this.rec.lastMeal;
    // A meal does the wounded good.
    if (act === 'eat' && this.hp < this.maxHp) this.hp = Math.min(this.maxHp, this.hp + 5);
    // Prayers at the temple: the priest's blessing heals the hurt.
    if (act === 'pray' && this.rec.override && this.rec.override.act === 'pray') {
      const priest = this.game.npcs.find((n) => !n.dead && n.rec.job === 'priest' && n.layout === this.layout && n.distTo(this) <= 10 && !n.sleeping);
      if (priest) {
        this.hp = this.maxHp;
        priest.face(this.x, this.z);
        priest.say(priest.rng.pick([`Be blessed, ${this.rec.name.first}. Be whole.`, 'May the light mend you.', `Go in health, ${this.rec.name.first}.`]), 3, '#e8e0ff');
      } else this.hp = Math.min(this.maxHp, this.hp + Math.ceil((this.maxHp - this.hp) / 2));
      this.game.renderer.emit(this.x, this.y + 1, this.z, { n: 8, color: ['#fff4c0', '#e8e0ff'], up: 20, life: 0.8, gravity: -12 });
      this.rec.hp = this.hp;
      this.rec.override = null;
      this.activity = null;
    }
    if (act === 'trial') this.face(this.game.player.x, this.game.player.z);
    // Setting the stone on a grave.
    if (act === 'bury') {
      const o = this.rec.override;
      const gr = o && o.grave;
      if (gr && this.game.sim.placeGrave(this.layout, gr.x, gr.z, this.rec)) {
        this.face(gr.x, gr.z);
        this.doAction(0.6);
        this.game.renderer.emit(gr.x, GROUND, gr.z, { n: 8, color: ['#8a7a5a', '#6a5a3a'], up: 20, life: 0.5, oy: -4 });
        this.say(this.rng.pick([`There. Rest now, ${(o.who || '').split(' ')[0]}.`, 'It\'s done.', `We'll not forget you, ${(o.who || '').split(' ')[0]}.`]), 3, '#b8c0e8');
      }
      this.rec.override = null;
      this.activity = null;
    }
    if (g.poster !== undefined && act === 'poster') this.putPoster(g);
    if (g.trap) this.checkSnare(g.trap);
    if (g.sell && this.rec.job === 'miner') {
      const n = this.game.sim.sellOre(this.layout, this.rec);
      if (n) this.say(this.rng.pick(['Fresh ore for the forge!', `${n} loads from the mine.`, 'Good seam today.']), 3);
      this.rec.override = null;
    } else if (g.sell) {
      const n = this.game.sim.sellCatch(this.layout, this.rec);
      if (n) this.say(this.rng.pick(['Fresh catch for the kitchen!', 'Here you go, straight from the wild.', `${n} for the pot!`]), 3);
      this.rec.override = null;
    }
  }

  onMeal(r) {
    if (this.atGoal) this.showMeal(r);
    else this.mealBubble = r;
  }

  showMeal(r) {
    if (!r || this.bubble) return;
    const key = r.item ? (r.q === 'terrible' || r.q === 'acceptable' || r.q === 'delightful' ? r.q : 'plain') : 'none';
    if (key === 'plain' && !this.rng.chance(0.3)) return;
    if (key === 'acceptable' && !this.rng.chance(0.4)) return;
    this.say(this.rng.pick(MEAL_LINES[key]), 3, key === 'none' || key === 'terrible' ? '#e0c080' : undefined);
  }

  wake() {
    if (!this.sleeping) return;
    this.sleeping = false;
    const b = this.bedTile;
    this.bedTile = null;
    if (b) this.stepOff(b.access ? [b.access] : []);
  }

  // Move off a furniture tile onto the nearest free standable tile.
  stepOff(prefer = []) {
    const w = this.game.world;
    for (const p of prefer) {
      if (w.canStand(p.x, this.y, p.z) && !this.game.occupiedBySolid(p.x, this.y, p.z, this)) return this.teleport(p.x, this.y, p.z);
    }
    for (let r = 1; r <= 4; r++) {
      for (let dz = -r; dz <= r; dz++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
          const x = this.x + dx;
          const z = this.z + dz;
          const y = w.findStandY(x, z, this.y);
          if (y > 0 && !this.game.occupiedBySolid(x, y, z, this)) return this.teleport(x, y, z);
        }
      }
    }
  }

  atGoalBehaviour(dt) {
    const g = this.goal;
    const act = this.activity.entry;
    const game = this.game;
    // In the middle of a game of tag or hide-and-seek: the game says where to go.
    if (this.playing && act.act === 'play') return;
    this.idleT -= dt;
    this.emoteCd -= dt;
    this.lineCd -= dt;
    if (this.mealBubble) {
      this.showMeal(this.mealBubble);
      this.mealBubble = null;
    }
    // Periodic small actions & emotes that show what they're doing.
    if (this.emoteCd <= 0) {
      this.emoteCd = this.rng.float(6, 16);
      let tag = act.act === 'hobby' ? HOBBIES[act.hobby]?.tag : act.act === 'work' ? g.tag || 'work' : act.act;
      if (act.act === 'work' && this.rec.job === 'cook') tag = 'cook';
      if (act.act === 'event') tag = act.kind === 'wedding' ? 'wedding' : act.role === 'dine' || act.role === 'serve' ? 'eat' : 'music';
      const em = EMOTES[tag];
      if (em && !g.wander) this.emoteShow(em[0], em[1], 2.2);
    }
    if (act.act === 'mourn' || act.act === 'funeral') return this.mourn(act);
    if (act.act === 'event') return this.atEvent(act, dt);
    if (act.act === 'trial') {
      if (this.rng.chance(dt * 0.3)) this.face(game.player.x, game.player.z);
      return;
    }
    if (act.act === 'build') {
      if (this.rng.chance(dt * 1.6)) {
        this.doAction(0.25);
        const t = { x: this.x + [0, -1, 0, 1][this.dir], z: this.z + [1, 0, -1, 0][this.dir] };
        if (this.rng.chance(0.5)) game.renderer.emit(t.x, GROUND, t.z, { n: 3, color: ['#c8a064', '#e8e0d0', '#8e6a3a'], up: 25, life: 0.4, oy: -6 });
        if (this.rng.chance(0.25) && this.distTo(game.player) < 14) game.audio?.play(this.rng.chance(0.5) ? 'dig' : 'place', this);
      }
      if (this.lineCd <= 0) {
        this.lineCd = this.rng.float(20, 50);
        const lines = act.event === 'stage' ? ['Hold the other end, would you?', 'A little to the left...', 'It\'ll be a fine do.', 'Mind the lanterns!', 'Nearly ready for them.']
          : act.event === 'strike' ? ['What a night that was.', 'Careful with that, it\'s borrowed.', 'Down she comes.', 'Stack it by the wall.']
            : ['Almost got this beam!', 'Hand me that plank.', 'Steady...', 'A fine little cottage.'];
        if (this.rng.chance(0.4)) this.say(this.rng.pick(lines), 2.5);
      }
    }
    // Guards patching up the jail after a breakout, a block at a time.
    if (act.act === 'repair') {
      this.repairT = (this.repairT || 0) - dt;
      if (this.repairT > 0) return;
      this.repairT = 1.3;
      const j = game.sim.justice;
      const missing = j.jailDamage(this.layout, act);
      if (!missing.length) {
        this.rec.override = null;
        this.activity = null;
        this.say(this.rng.pick(['There. Good as new.', 'Let\'s see them get out of that.']), 3);
        return;
      }
      if (!this.saidRepair) {
        this.saidRepair = true;
        this.say(this.rng.pick(['Who did this to my jail?!', 'Look at this mess...']), 3, '#ffb080');
      }
      const [x, y, z, id, meta] = missing[0];
      this.face(x, z);
      this.doAction(0.3);
      if (game.entityAt(x, y, z) || game.entityAt(x, y - 1, z)) return;
      game.world.setBlock(x, y, z, id, meta);
      game.renderer.emit(x, y, z, { n: 5, color: ['#c8c8d8', '#8a8a96', '#e8e0d0'], up: 30, speed: 40, life: 0.5, oy: -6 });
      if (this.distTo(game.player) < 16) game.audio?.play('place', this);
      return;
    }
    if (act.act === 'help' && g.helping !== undefined) {
      const par = this.layout.npcs[g.helping]?.ent;
      if (par && !par.dead) {
        if (this.rng.chance(dt * 0.4)) this.face(par.x, par.z);
        // Fetching and carrying, in a small way.
        if (this.rng.chance(dt * 0.35)) this.doAction(0.25);
        if (this.lineCd <= 0) {
          this.lineCd = this.rng.float(25, 60);
          if (this.rng.chance(0.45) && this.distTo(game.player) < 14) {
            const mum = (this.rec.parents || []).indexOf(par.rec.idx) === 1 ? 'Dad' : 'Mum';
            const job = par.rec.job;
            const lines = {
              farmer: ['I pulled up all the weeds, look!', `Can I carry the basket, ${mum}?`],
              fisher: [`Did you catch one yet, ${mum}?`, 'I\'ll hold the net!'],
              blacksmith: [`Can I work the bellows, ${mum}?`, 'It\'s so hot in here!'],
              cook: [`Can I stir the pot, ${mum}?`, 'Is it ready yet? I\'m hungry.'],
              baker: ['I\'m kneading the dough!', 'Can I have the burnt one?'],
              merchant: ['Buy something, mister! Please?', 'I\'m minding the stall!'],
              tailor: ['I threaded the needle all by myself!', 'Can you make me a hat?'],
              carpenter: ['I\'m sweeping up the shavings.', 'Can I hammer one? Just one?'],
              lumberjack: ['Timber!', 'I\'ll stack the logs.'],
              trapper: ['I\'ll be really quiet, promise.', 'Are the rabbits asleep?'],
              herbalist: ['This one smells like mint!', 'Is this the right flower?'],
              innkeeper: ['I\'ll wipe the tables!', 'Can I pour one?'],
              priest: ['I lit the candles!', 'Shh, people are praying.'],
            }[job] || [`What do I do now, ${mum}?`, `I\'m helping ${mum}!`, 'Look, I did it!'];
            this.say(this.rng.pick(lines), 2.5);
            if (this.rng.chance(0.4)) par.say(this.rng.pick(['Good work, little one.', 'Careful with that!', 'That\'s it, just like that.', 'What would I do without you?']), 2.5);
          }
        }
      }
    }
    if (act.act === 'camp' && this.lineCd <= 0) {
      this.lineCd = this.rng.float(20, 45);
      if (this.rng.chance(0.5) && this.distTo(game.player) < 14) this.say(this.rng.pick(['Nice square.', 'Do you think they have room for us?', 'Smells like stew. A good sign.', 'Look at those houses...', 'I could get used to this.']), 3);
    }
    if (act.act === 'visit' && this.lineCd <= 0 && this.rec.visit) {
      this.lineCd = this.rng.float(15, 35);
      const v = this.rec.visit;
      if (this.rng.chance(0.6)) this.say(this.rng.pick([`Fine goods from ${v.fromName}!`, 'Rare wares! Come and see!', 'Traded all the way from the coast!', 'Best prices this side of the river!']), 3, '#ffe070');
    }
    // Trappers set new snares on their hunting grounds.
    if (g.hunt && act.act === 'work' && this.rec.job === 'trapper' && this.rng.chance(dt * 0.08) && this.laySnare()) return;
    // Hunters look for game near their hunting grounds (and now and then
    // an animal wanders by).
    if ((g.hunt || act.act === 'forage') && this.rng.chance(dt * 0.6)) {
      const c = this.findPrey(9);
      if (c) {
        this.prey = c;
        this.preyT = 0;
        this.releaseSpot();
        return;
      }
      if (this.rng.chance(0.08) && this.distTo(game.player) < 34) game.spawnGameNear(this);
    }
    // Miners chip away at the rock face beside them (and ask the watch for
    // a guard now and then, if nobody came out with them).
    if (act.act === 'work' && g.tag === 'mine' && this.rng.chance(dt * 0.1)) game.sim.escortMiner(this, act);
    if (act.act === 'work' && g.tag === 'mine' && this.rng.chance(dt * 0.35)) {
      if (!this.mineWork()) this.idleT = Math.min(this.idleT, 3);
      return;
    }
    // At the well with an empty bucket: fill it and head back to the rows.
    if (act.act === 'work' && g.tag === 'well') {
      this.face(g.well.x, g.well.z);
      this.doAction(0.4);
      this.rec.water = 4;
      game.renderer.emit(g.well.x, GROUND, g.well.z, { n: 8, color: ['#58a8e8', '#8cc8f8', '#e0f4ff'], up: 30, life: 0.5, oy: -4 });
      if (this.distTo(game.player) < 16) game.audio?.play('splash', this);
      if (this.rng.chance(0.4)) this.say(this.rng.pick(['Fresh water for the fields.', 'Heavy, this bucket.', 'The rows are parched.']), 2.5);
      this.goal = this.farmGoal() || this.workGoal();
      this.atGoal = false;
      this.path = null;
      return;
    }
    // Farmers bring in ripe crops by hand and sow the rows again.
    if (act.act === 'work' && g.tag === 'farm' && this.rng.chance(dt * 0.35)) {
      if (!this.farmWork()) this.idleT = Math.min(this.idleT, 1.5);
      return;
    }
    // Fishers watch their bobber; now and then something bites.
    if (act.act === 'work' && this.rec.job === 'fisher' && this.fishSpot()) {
      this.fishDip = Math.max(0, (this.fishDip || 0) - dt * 2);
      if (this.rng.chance(dt * 0.07)) {
        const t = this.fishSpot();
        this.fishDip = 1;
        game.renderer.emit(t.x, t.y, t.z, { n: 8, color: ['#8cc4f0', '#e0f4ff', '#ffffff'], up: 30, life: 0.5, oy: 2 });
        if (this.rng.chance(0.55)) {
          this.doAction(0.4);
          if (this.distTo(game.player) < 14) {
            game.audio?.play('splash', this);
            if (this.rng.chance(0.4)) this.say(this.rng.pick(['Got one!', 'A big one!', 'Ha! Supper.', 'Just a tiddler.']), 2.5);
          }
        }
      }
      if (this.idleT > 0) return;
    } else if (act.act === 'work' && this.rng.chance(dt * 0.6)) {
      this.doAction(0.3);
      if (this.rec.job === 'blacksmith' && this.spot && this.spot.target) {
        const t = this.spot.target;
        game.renderer.emit(t.x, GROUND + 1, t.z, { n: 5, color: ['#ffe070', '#ffb040', '#ffffff'], up: 40, speed: 50, life: 0.4, oy: -4 });
        game.audio?.play('clang', this);
      } else if (this.rec.job === 'cook' && this.spot && this.spot.target && this.rng.chance(0.5)) {
        const t = this.spot.target;
        game.renderer.emit(t.x, GROUND + 1, t.z, { n: 2, color: ['#e8e8f0', '#c8c8d0'], up: 12, speed: 6, gravity: -8, life: 1.2, oy: -2 });
      }
    }
    if (this.idleT > 0) return;
    // Re-pick a spot now and then so places feel alive.
    this.idleT = this.rng.float(8, 25);
    // A builder on their rounds spots damage and gets it fixed.
    if (g.inspect !== undefined) {
      const b = this.layout.buildings[g.inspect];
      const p = b && game.sim.works.noteDamage(this.layout, b);
      if (p) this.say(this.rng.pick([`This ${b.name.replace(/^The /, '').toLowerCase()} needs fixing.`, 'Who did this? Right, back to work.']), 3);
      else if (this.rng.chance(0.3)) this.say(this.rng.pick(['Solid walls. Good.', 'That roof will hold.', 'Hm, needs a coat of paint.']), 2.5);
    }
    if (g.patrol || g.wander || g.wanderIn || g.build || g.hunt || (act.act === 'play' && !g.stay) || g.tag === 'farm' || g.tag === 'help' || g.inspect !== undefined) {
      this.goal = (g.tag === 'farm' && act.act === 'work' && this.farmGoal()) || (act.act === 'work' ? this.workGoal() : this.pickGoal(act));
      this.atGoal = false;
      this.path = null;
    } else if (this.rng.chance(0.3) && !this.sitting) this.dir = this.rng.int(0, 3);
  }

  // Walking over to buy something from the player, then waiting to be served.
  customerWalk() {
    const game = this.game;
    const p = game.player;
    const car = game.sim.careers;
    const confront = this.act === 'confront';
    const c = confront ? game.sim.confront : car.customer;
    if (!c || c.idx !== this.rec.idx || c.sid !== this.settlement.id) {
      this.rec.override = null;
      this.activity = null;
      return;
    }
    const d = Math.max(Math.abs(p.x - this.x), Math.abs(p.z - this.z));
    if (d <= 1 || (d <= 2 && c.arrived)) {
      this.path = null;
      this.face(p.x, p.z);
      if (!c.arrived) (confront ? game.sim.confronted(this) : car.customerArrived(this));
      return;
    }
    if (!this.cgoal || Math.abs(this.cgoal.x - p.x) + Math.abs(this.cgoal.z - p.z) > 1) {
      this.cgoal = { x: p.x, y: p.y, z: p.z };
      this.path = null;
    }
    this.followPath(this.cgoal, 1);
  }

  // One swing of the pick at the nearest rock; every few swings a block
  // comes loose. With the face dug back, they follow it in a little way.
  mineWork() {
    const game = this.game;
    const w = game.world;
    const rec = this.rec;
    if ((rec.minedDay || -1) !== game.day) {
      rec.minedDay = game.day;
      rec.minedToday = 0;
    }
    if (rec.minedToday >= 24) return false;
    const rock = (x, y, z) => ROCK.has(w.getBlock(x, y, z));
    let t = this.mineTarget;
    if (!t || !rock(t.x, t.y, t.z) || Math.max(Math.abs(t.x - this.x), Math.abs(t.z - this.z)) > 1) {
      t = null;
      // Into the face at chest and head height, or down into the ground to
      // open a quarry pit (never more than two deep).
      const dys = this.y - 1 >= GROUND - 2 ? [0, 1, -1] : [0, 1];
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        for (const dy of dys) {
          if (rock(this.x + dx, this.y + dy, this.z + dz)) {
            t = { x: this.x + dx, y: this.y + dy, z: this.z + dz, hits: 0 };
            break;
          }
        }
        if (t) break;
      }
      this.mineTarget = t;
    }
    if (!t) {
      // Walk up to the nearest rock face within a few paces of the spot.
      const sp = this.spot || { x: this.x, z: this.z };
      let best = null;
      for (let dz = -5; dz <= 5; dz++) {
        for (let dx = -5; dx <= 5; dx++) {
          const x = sp.x + dx;
          const z = sp.z + dz;
          if (!rock(x, this.y, z) && !rock(x, this.y + 1, z) && !(this.y - 1 >= GROUND - 2 && rock(x, this.y - 1, z))) continue;
          for (const [ax, az] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const tx = x + ax;
            const tz = z + az;
            const ty = w.findStandY(tx, tz, this.y);
            if (ty !== this.y || game.occupiedBySolid(tx, ty, tz, this)) continue;
            const d = Math.abs(tx - this.x) + Math.abs(tz - this.z);
            if (!best || d < best.d) best = { x: tx, z: tz, d };
          }
        }
      }
      if (best && best.d > 0) {
        this.goal = { x: best.x, y: this.y, z: best.z, tag: 'mine', face: this.dir };
        this.atGoal = false;
        this.path = null;
        return true;
      }
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = this.x + dx;
        const nz = this.z + dz;
        if (sp && Math.max(Math.abs(nx - sp.x), Math.abs(nz - sp.z)) > 4) continue;
        const ny = w.stepTarget(this.x, this.y, this.z, nx, nz, false);
        if (ny < 0 || game.occupiedBySolid(nx, ny, nz, this)) continue;
        if (![0, 1, -1].some((dy) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([ex, ez]) => rock(nx + ex, ny + dy, nz + ez)))) continue;
        this.face(nx, nz);
        this.startMove(nx, ny, nz, this.step);
        return true;
      }
      return false;
    }
    this.face(t.x, t.z);
    this.doAction(0.3);
    const id = w.getBlock(t.x, t.y, t.z);
    const near = this.distTo(game.player) < 16;
    game.renderer.emit(t.x, t.y, t.z, { n: 3, color: game.blockColor(id), up: 25, speed: 35, life: 0.4, oy: -6 });
    if (near && this.rng.chance(0.5)) game.audio?.play('dig', this);
    t.hits++;
    if (t.hits < 3) return true;
    w.setBlock(t.x, t.y, t.z, B.air);
    for (const d of rollDrops(id, () => this.rng.next())) invAdd(rec.inv, d.item, d.count);
    rec.minedToday++;
    this.mineTarget = null;
    if (near) game.audio?.play('break', this);
    if ([B.iron_ore, B.gold_ore, B.gem_ore, B.coal_ore].includes(id) && near && this.rng.chance(0.6)) this.say(this.rng.pick(['Ore!', 'Now that\'s a find.', 'Look at that seam!']), 2.5);
    return true;
  }

  // Harvest a ripe crop next to them, or sow an empty patch of farmland.
  farmWork() {
    const game = this.game;
    const w = game.world;
    const y = this.y;
    let ripe = null;
    let bare = null;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
      const x = this.x + dx;
      const z = this.z + dz;
      const id = w.getBlock(x, y, z);
      if (CROPS[id]) {
        if (!ripe && cropMature(id, w.getMeta(x, y, z))) ripe = { x, z, id };
      } else if (!bare && id === B.air && isFarmland(w.getBlock(x, y - 1, z)) && !game.entityAt(x, y, z)) bare = { x, z };
    }
    const near = this.distTo(game.player) < 16;
    if (ripe) {
      this.face(ripe.x, ripe.z);
      this.doAction(0.3);
      const drops = game.crops.harvest(ripe.id, w.getMeta(ripe.x, y, ripe.z), true, () => this.rng.next());
      w.setBlock(ripe.x, y, ripe.z, B.air);
      for (const d of drops) invAdd(this.rec.inv, d.item, d.count);
      game.renderer.emit(ripe.x, y, ripe.z, { n: 6, color: game.blockColor(ripe.id), up: 30, speed: 40, life: 0.5, oy: -6 });
      if (near) game.audio?.play('break', this);
      return true;
    }
    if (bare && invCount(this.rec.inv, CROPS[this.fieldCrop(bare.x, bare.z)].seed) > 0) {
      const id = this.fieldCrop(bare.x, bare.z);
      const seed = CROPS[id].seed;
      invTake(this.rec.inv, seed, 1);
      this.face(bare.x, bare.z);
      this.doAction(0.3);
      game.crops.plant(bare.x, y, bare.z, id);
      game.renderer.emit(bare.x, y, bare.z, { n: 4, color: ['#5e4028', '#7a5436'], up: 15, speed: 20, life: 0.4, oy: -2 });
      if (near) game.audio?.play('place', this);
      return true;
    }
    return this.waterWork();
  }

  // Dry rows get a bucket poured over them; an empty bucket means a walk to
  // the well (a few times a day at most, and never in the rain).
  waterWork() {
    const game = this.game;
    const w = game.world;
    const rec = this.rec;
    const y = this.y - 1;
    let dry = null;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
      if (w.getBlock(this.x + dx, y, this.z + dz) === B.farmland) {
        dry = { x: this.x + dx, z: this.z + dz };
        break;
      }
    }
    if (!dry) return false;
    if ((rec.water || 0) > 0) {
      rec.water--;
      let n = 0;
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) if (game.crops.wetten(dry.x + dx, y, dry.z + dz)) n++;
      this.face(dry.x, dry.z);
      this.doAction(0.4);
      game.renderer.emit(dry.x, this.y, dry.z, { n: 10, color: ['#58a8e8', '#8cc8f8', '#e0f4ff'], up: 18, speed: 36, life: 0.5, oy: -2 });
      if (this.distTo(game.player) < 16) game.audio?.play('splash', this);
      return n > 0;
    }
    const sky = game.weatherIn(this.settlement);
    const wells = this.layout.wells || [];
    if (sky === 'rain' || !wells.length) return false;
    if (rec.wellDay !== game.day) {
      rec.wellDay = game.day;
      rec.wellTrips = 0;
    }
    if (rec.wellTrips >= 3) return false;
    const well = wells.reduce((b, q) => (!b || Math.abs(q.x - this.x) + Math.abs(q.z - this.z) < Math.abs(b.x - this.x) + Math.abs(b.z - this.z) ? q : b), null);
    const spot = game.findFreeSpot(well.x, well.z + 1, GROUND);
    if (!spot) return false;
    rec.wellTrips++;
    this.releaseSpot();
    this.goal = { x: spot.x, y: spot.y, z: spot.z, tag: 'well', well };
    this.atGoal = false;
    this.path = null;
    return true;
  }

  // The patch of water a fisher at their spot has their line in.
  fishSpot() {
    if (!this.atGoal || this.moving || this.heldItem() !== 'fishing_rod') return null;
    const key = `${this.x},${this.z},${this.dir}`;
    if (this.fishKey === key) return this.fishTile;
    const w = this.game.world;
    const DX = [0, -1, 0, 1];
    const DZ = [1, 0, -1, 0];
    // Only open water: the surface of a pond, river or the sea, with nothing
    // over it and nothing solid between the fisher and it.
    let t = null;
    for (let k = 1; k <= 3 && !t; k++) {
      const x = this.x + DX[this.dir] * k;
      const z = this.z + DZ[this.dir] * k;
      if (BLOCKS[w.getBlock(x, this.y, z)]?.solid || BLOCKS[w.getBlock(x, this.y + 1, z)]?.solid) break;
      for (const y of [this.y - 1, this.y - 2]) {
        const here = BLOCKS[w.getBlock(x, y, z)];
        if (here?.solid && !here.liquid) break;
        const up = w.getBlock(x, y + 1, z);
        if (here?.liquid && up === B.air) {
          t = { x, y, z };
          break;
        }
      }
    }
    this.fishKey = key;
    this.fishTile = t;
    return t;
  }

  // What grows in the field at (x, z).
  fieldCrop(x, z) {
    const f = this.layout.fields.find((q) => x >= q.x0 && x <= q.x1 && z >= q.z0 && z <= q.z1);
    if (f && CROPS[f.crop]) return f.crop;
    const w = this.game.world;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const id = w.getBlock(x + dx, this.y, z + dz);
      if (CROPS[id]) return id;
    }
    return f ? B.carrot_crop : B.wheat_crop;
  }

  // The furrow with the most work waiting beside it.
  farmGoal() {
    const w = this.game.world;
    const spots = this.layout.spotsByTag('farm').filter((s) => !s.claim || s.claim === this.id);
    let best = null;
    let bs = -1;
    for (const sp of spots) {
      let score = this.rng.float(0, 0.8);
      for (const [dx, dz] of [[1, 0], [-1, 0], [1, 1], [-1, 1], [1, -1], [-1, -1], [0, 1], [0, -1]]) {
        const id = w.getBlock(sp.x + dx, GROUND, sp.z + dz);
        if (CROPS[id] && cropMature(id, w.getMeta(sp.x + dx, GROUND, sp.z + dz))) score += 2;
        else if (id === B.air && isFarmland(w.getBlock(sp.x + dx, GROUND - 1, sp.z + dz))) score += 1;
      }
      if (score > bs) {
        bs = score;
        best = sp;
      }
    }
    if (!best || bs < 1) return null;
    this.releaseSpot();
    best.claim = this.id;
    this.spot = best;
    return { x: best.x, y: best.y, z: best.z, face: best.face, tag: 'farm' };
  }

  // Putting a poster up (or taking one down), then on to the next.
  putPoster(g) {
    const game = this.game;
    const events = game.sim.events;
    const o = this.rec.override;
    const ev = o && o.act === 'poster' ? events.get(this.layout, o.ev) : null;
    const q = ev && ev.posters[g.poster];
    if (q) {
      if (this.x === q.x && this.z === q.z) this.stepOff();
      this.face(q.x, q.z);
      this.doAction(0.5);
      if (events.poster(this.layout, ev, g.poster, o.mode === 'up') && this.distTo(game.player) < 16) {
        game.audio?.play('place', this);
        if (this.rng.chance(0.5)) {
          this.say(this.rng.pick(o.mode === 'up'
            ? ['There. Everyone will see that.', 'One more up.', 'Don\'t miss it!', ev.kind === 'wedding' ? 'Tomorrow\'s the day!' : 'Free food! That\'ll bring them.']
            : ['That\'s that, then.', 'Down it comes.', 'What a day that was.']), 2.5);
        }
      }
    }
    this.goal = this.pickGoal(this.activity.entry);
    this.atGoal = false;
    this.path = null;
  }

  // At a wedding or a feast: the one leading it says the words; the rest
  // watch, cheer, eat, drink and dance.
  atEvent(act, dt) {
    const game = this.game;
    const events = game.sim.events;
    const ev = events.get(this.layout, act.ev);
    if (!ev) return;
    const t = game.day * 1440 + game.minute - ev.s;
    if (act.role === 'lead') events.ceremony(this.layout, ev, t, this);
    if (act.role === 'dance' && t >= 0 && ev.state === 'on') {
      this.danceT = (this.danceT ?? this.rng.float(0.3, 1.2)) - dt;
      if (this.danceT <= 0) {
        this.danceT = this.rng.float(0.8, 1.5);
        const nx = events.danceStep(ev, this.x, this.z);
        if (nx && !game.occupiedBySolid(nx.x, this.y, nx.z, this)) {
          this.goal = { x: nx.x, y: GROUND, z: nx.z, face: nx.face, tag: 'event', dance: true };
          this.atGoal = false;
          this.path = null;
          if (this.rng.chance(0.08) && this.distTo(game.player) < 16) this.say(this.rng.pick(['La la la!', 'Wheee!', 'Round we go!', 'Faster!', 'Hup!']), 1.8, '#ff9ad0');
        }
      }
      return;
    }
    // Facing where it's all happening.
    if (this.goal && this.goal.face !== undefined && !this.sitting && this.rng.chance(dt * 0.3)) this.dir = this.goal.face;
    if (this.lineCd > 0 || this.distTo(game.player) > 16) return;
    this.lineCd = this.rng.float(14, 32);
    const lines = events.chatter(this.layout, ev, this.rec, act.role, t);
    if (lines && lines.length && this.rng.chance(0.5)) this.say(this.rng.pick(lines), 2.8, ev.kind === 'wedding' ? '#ffd0e8' : undefined);
  }

  mourn(act) {
    if (this.lineCd > 0) return;
    this.lineCd = this.rng.float(10, 22);
    const who = (act.who || '').split(' ')[0];
    if (act.officiant) {
      this.say(this.rng.pick([`We gather to remember ${act.who}.`, 'May they rest in the light.', `Go in peace, ${who}.`, 'From the earth, to the earth.']), 3.5, '#e8e0ff');
      return;
    }
    if (this.rng.chance(0.55)) this.say(this.rng.pick([`Rest well, ${who}...`, `I miss you, ${who}.`, '*sniff*', `It isn't fair, ${who}...`, '...']), 3, '#b8c0e8');
  }

  // Look for game nearby (passive or neutral wildlife, not farm animals).
  findPrey(r) {
    let best = null;
    let bd = r + 1;
    for (const c of this.game.creatures) {
      if (c.dead || c.species === 'chicken' || c.hostileNow) continue;
      if (c.S.mode !== 'passive' && c.S.mode !== 'neutral') continue;
      const d = this.distTo(c);
      if (d < bd) {
        best = c;
        bd = d;
      }
    }
    return best;
  }

  hunt(dt) {
    const c = this.prey;
    this.preyT = (this.preyT || 0) + dt;
    if (!c || c.dead || this.distTo(c) > 14 || this.preyT > 60) {
      this.prey = null;
      this.atGoal = false;
      this.path = null;
      return;
    }
    const d = this.distTo(c);
    if (this.canShoot() && d <= 6 && d >= 2) {
      this.face(c.x, c.z);
      if (this.attackCd <= 0) {
        this.attackCd = 1.6;
        this.doAction(0.3);
        invTake(this.rec.inv, 'arrow', 1);
        this.game.shoot(this, c, this.attackDamage(true));
      }
      return;
    }
    if (d <= 1) {
      this.face(c.x, c.z);
      if (this.attackCd <= 0) {
        this.attackCd = 1.0;
        this.doAction(0.3);
        this.game.damage(c, this.attackDamage(false), this);
      }
      return;
    }
    if (!this.path || this.rng.chance(0.2)) this.path = null;
    this.followPath({ x: c.x, y: c.y, z: c.z }, 1);
  }

  onKill(c) {
    this.prey = null;
    this.atGoal = false;
    this.path = null;
    if (this.rng.chance(0.5)) this.say(this.rng.pick(['Got one!', 'Supper!', 'Clean shot.']), 2);
    if (this.rng.chance(0.3)) invAdd(this.rec.inv, 'arrow', 1);
    void c;
  }

  // Put down a snare on open ground beside them (they keep up to three).
  laySnare() {
    const rec = this.rec;
    rec.snares = (rec.snares || []).filter((q) => this.game.world.regionAt(q.x, q.z) === null || this.game.world.getBlock(q.x, q.y, q.z) === B.snare);
    if (rec.snares.length >= 3) return false;
    const w = this.game.world;
    const L = this.layout;
    for (const [dx, dz] of this.rng.shuffle([[1, 0], [-1, 0], [0, 1], [0, -1]])) {
      const x = this.x + dx;
      const z = this.z + dz;
      const y = this.y;
      if (w.getBlock(x, y, z) !== B.air && !BLOCKS[w.getBlock(x, y, z)].replaceable) continue;
      if (!BLOCKS[w.getBlock(x, y - 1, z)].solid || this.game.entityAt(x, y, z)) continue;
      const b = L.bounds;
      if (x >= b.x0 - 3 && x <= b.x1 + 3 && z >= b.z0 - 3 && z <= b.z1 + 3) continue;
      if (rec.snares.some((q) => Math.abs(q.x - x) + Math.abs(q.z - z) < 6) || L.spotsByTag('trap').some((q) => q.trap && Math.abs(q.trap.x - x) + Math.abs(q.trap.z - z) < 6)) continue;
      this.face(x, z);
      this.doAction(0.5);
      w.setBlock(x, y, z, B.snare, 0);
      rec.snares.push({ x, y, z, from: { x: this.x, z: this.z } });
      this.emoteShow('+', '#c8e070', 2);
      if (this.distTo(this.game.player) < 12 && this.rng.chance(0.6)) this.say(this.rng.pick(['There. Let\'s see what we catch.', 'A fresh snare.', 'Should be a good spot.']), 2.5);
      this.game.renderer.emit(x, y, z, { n: 4, color: ['#c8a064', '#e8e0d0'], up: 15, speed: 20, life: 0.4, oy: -4 });
      return true;
    }
    return false;
  }

  // A trapper's round: one of the snares they set themselves.
  ownSnareGoal() {
    const own = (this.rec.snares || []).filter((q) => this.game.world.regionAt(q.x, q.z) && this.game.world.getBlock(q.x, q.y, q.z) === B.snare);
    if (!own.length) return null;
    const t = own[this.rng.int(0, own.length - 1)];
    return { x: t.from.x, y: GROUND, z: t.from.z, face: this.dir, tag: 'hunt', trap: { x: t.x, y: t.y, z: t.z } };
  }

  checkSnare(t) {
    const w = this.game.world;
    const cur = w.getBlock(t.x, t.y, t.z);
    if (cur === B.air || BLOCKS[cur].replaceable) {
      // Someone took the snare: lay a new one.
      if (!w.canStand(t.x, t.y, t.z) && cur !== B.air) return;
      w.setBlock(t.x, t.y, t.z, B.snare, 0);
      this.face(t.x, t.z);
      this.doAction(0.4);
      this.emoteShow('+', '#c8e070', 2);
      return;
    }
    if (cur !== B.snare) return;
    this.face(t.x, t.z);
    this.doAction(0.3);
    if (w.getState(t.x, t.y, t.z)) {
      w.setState(t.x, t.y, t.z, false);
      invAdd(this.rec.inv, 'raw_meat', 1);
      if (this.rng.chance(0.4)) invAdd(this.rec.inv, 'leather', 1);
      this.emoteShow('!', '#c8e070', 2);
      if (this.distTo(this.game.player) < 12 && this.rng.chance(0.6)) this.say(this.rng.pick(['Got one!', 'Supper!', 'Ha! Caught.']), 2.5);
      this.game.renderer.emit(t.x, t.y, t.z, { n: 5, color: ['#a86a3c', '#e8e0d0'], up: 20, speed: 25, life: 0.5, oy: -4 });
    } else {
      this.emoteShow('?', '#c8c8c8', 1.5);
      if (this.distTo(this.game.player) < 12 && this.rng.chance(0.3)) this.say(this.rng.pick(['Empty. Again.', 'Nothing yet.']), 2);
    }
  }

  idle(dt) {
    this.idleT -= dt;
    if (this.idleT <= 0) {
      this.idleT = this.rng.float(5, 12);
      this.dir = this.rng.int(0, 3);
    }
  }

  // Walk one step along a path to `goal`. Returns true when arrived.
  followPath(goal, near = 0, localBox = null) {
    const d = Math.max(Math.abs(goal.x - this.x), Math.abs(goal.z - this.z));
    if (d <= near && (near > 0 || this.x === goal.x && this.z === goal.z)) return true;
    if (!this.path || this.pathI >= this.path.length) {
      if (this.waitT > 0) {
        this.waitT -= this.game.dt;
        return false;
      }
      if (!this.game.requestPathBudget()) return false;
      const b = this.settlement.bounds;
      const box = localBox || { x0: Math.min(b.x0, this.x, goal.x) - 26, z0: Math.min(b.z0, this.z, goal.z) - 22, x1: Math.max(b.x1, this.x, goal.x) + 26, z1: Math.max(b.z1, this.z, goal.z) + 22 };
      const w0 = this.game.world;
      const av = this.avoid && this.avoid.t > 0 ? this.avoid : null;
      const blocked = av ? (x, z) => x === av.x && z === av.z : null;
      const p = findPath(w0, this.x, this.y, this.z, goal.x, goal.y ?? this.y, goal.z, { box, near, maxNodes: localBox ? 2500 : 5000, partial: true, blocked });
      if (!p || !p.length) {
        if (BLOCKS[w0.getBlock(this.x, this.y, this.z)].solid) this.stepOff();
        this.pathFails++;
        this.waitT = 1.5 + this.pathFails;
        if (this.pathFails > 3) {
          // Give up on this goal: pick another activity spot later.
          if (this.goal && this.goal.leave) this.game.despawnNpc(this);
          this.goal = null;
          this.pathFails = 0;
        }
        return false;
      }
      this.path = p;
      this.pathI = 0;
    }
    const [nx, ny, nz] = this.path[this.pathI];
    const w = this.game.world;
    // Blocked by the player or a monster: wait a moment, then route around.
    if (this.game.occupiedBySolid(nx, ny, nz, this, true)) {
      this.blockT = (this.blockT || 0) + this.game.dt;
      if (nx === goal.x && nz === goal.z && this.blockT > 0.6) return true; // someone is standing on our spot
      if (this.blockT > 0.8) {
        this.avoid = { x: nx, z: nz, t: 6 };
        this.path = null;
        this.blockT = 0;
      }
      return false;
    }
    this.blockT = 0;
    this.waitT = 0;
    // Validate the step is still possible (world may have changed).
    const ty = w.stepTarget(this.x, this.y, this.z, nx, nz, true);
    if (ty < 0 || Math.abs(nx - this.x) + Math.abs(nz - this.z) !== 1) {
      this.path = null;
      return false;
    }
    const feet = w.getBlock(nx, ty, nz);
    if (feet === B.door) {
      // Open it (or find it open) on the way through; shut it after.
      if (!w.getState(nx, ty, nz)) this.game.setDoor(nx, ty, nz, true);
      if (!this.openedDoors.some((d) => d.x === nx && d.z === nz)) this.openedDoors.push({ x: nx, y: ty, z: nz });
    }
    this.face(nx, nz);
    const pace = this.state === 'hired' ? 0.55 : this.state === 'flee' ? 0.6 : this.state === 'fight' ? 0.7 : this.prey ? 0.75 : this.activity?.entry.act === 'play' ? this.playPace || 0.8 : 1;
    this.startMove(nx, ty, nz, this.step * pace * (w.isWaterAt(nx, ty, nz) ? 1.8 : 1));
    this.pathI++;
    return false;
  }

  // Everyone shuts the doors they open, once they (and anyone else) are
  // clear of the doorway, whatever made them turn round or run off.
  closeDoorBehind() {
    if (!this.openedDoors.length) return;
    const w = this.game.world;
    this.openedDoors = this.openedDoors.filter((d) => {
      if (w.getBlock(d.x, d.y, d.z) !== B.door || !w.getState(d.x, d.y, d.z)) return false;
      const away = Math.abs(this.x - d.x) + Math.abs(this.z - d.z);
      // Still in the doorway, just stepping out of it, or someone else in it.
      if (away === 0 || (away === 1 && this.moving) || this.game.entityAt(d.x, d.y, d.z) || this.game.entityAt(d.x, d.y - 1, d.z)) return true;
      this.game.setDoor(d.x, d.y, d.z, false);
      return false;
    });
  }

  // Leaving (or dying): no door left standing open behind them.
  shutAllDoors() {
    const w = this.game.world;
    for (const d of this.openedDoors) if (w.getBlock(d.x, d.y, d.z) === B.door && w.getState(d.x, d.y, d.z) && !this.game.entityAt(d.x, d.y, d.z)) this.game.setDoor(d.x, d.y, d.z, false);
    this.openedDoors = [];
  }

  // ------------------------------------------------------------ threats
  // How this NPC responds when attacked, or when they see someone else
  // (a fellow citizen) being hurt.
  react(threat, witnessed = false, victim = null) {
    if (this.dead || !threat || threat.dead) return;
    if (this.sleeping) {
      if (witnessed) return;
      this.wake();
    }
    const p = this.rec.personality;
    const beast = threat.kind === 'creature' || threat.kind === 'monster';
    const guardsExist = this.game.guardsOf(this.settlement.id).length > 0;
    const close = victim && victim.rec && (this.rec.partner === victim.rec.idx || this.rec.children.includes(victim.rec.idx) || this.rec.parents.includes(victim.rec.idx) || (this.rec.friends || []).includes(victim.rec.idx));
    if (this.rec.job === 'guard') return this.engage(threat);
    if (this.rec.age === 'child') return this.startFlee(threat, witnessed ? null : '!!');
    // Trappers don't run from animals: out comes the blade.
    if (this.rec.job === 'trapper' && beast && this.meleeWeapon()) {
      this.say(this.rng.pick(['Come on, then!', 'Not today, beast!', 'Easy... easy...']), 2, '#ffb080');
      return this.engage(threat);
    }
    const armed = !!this.weapon();
    // The brave fight back, or step in for friends and family (and against beasts).
    if (p.bravery > 0.68 && (armed || p.temper > 0.6) && (!witnessed || beast || close)) {
      const who = victim && victim.rec ? victim.rec.name.first : null;
      this.say(close && who ? this.rng.pick([`Get away from ${who}!`, `Leave ${who} alone!`]) : this.rng.pick(['You\'ll regret that!', 'Back off!', 'Take this!', 'How dare you!']), 2.5, '#ff9080');
      return this.engage(threat);
    }
    if (guardsExist && (p.sociability > 0.3 || p.bravery > 0.4) && this.rng.chance(witnessed ? 0.7 : 0.85)) {
      this.state = 'alert';
      this.stateT = 0;
      this.threat = threat;
      this.path = null;
      const who = victim && victim.rec ? victim.rec.name.first : null;
      const line = beast
        ? this.rng.pick([`A ${(threat.name || 'beast').toLowerCase()}! Guards!`, 'Monster! Help!'])
        : who ? this.rng.pick([`Help! ${who} is being attacked!`, `GUARDS! They're hurting ${who}!`]) : this.rng.pick(['GUARDS! HELP!', 'Guards! Guards!', 'Help! Murder!', 'Someone call the guard!']);
      this.say(line, 3, '#ffe070');
      this.game.alertGuards(this.settlement.id, threat, this);
      return;
    }
    this.startFlee(threat, this.rng.pick(['Aaah!', 'Help!', 'Leave me alone!', 'Eek!']));
  }

  engage(threat) {
    this.state = 'fight';
    this.threat = threat;
    this.stateT = 0;
    this.path = null;
    this.atGoal = false;
    this.prey = null;
    this.releaseSpot();
  }

  startFlee(threat, line) {
    // A townsperson running from a beast rings the alarm on the way, if a
    // bell's near and the watch isn't already on it.
    if (this.state !== 'alarm' && this.afterAlarm !== 'flee' && threat && threat.kind !== 'player' && threat.hostileNow && this.rec.job !== 'guard' && this.rec.age !== 'child' && !this.visit && this.game.alarmNeeded(this, threat)) {
      this.afterAlarm = 'flee';
      return this.startAlarm(threat, 'flee');
    }
    this.afterAlarm = null;
    this.state = 'flee';
    this.threat = threat;
    this.stateT = 0;
    this.path = null;
    this.prey = null;
    this.releaseSpot();
    if (line) this.say(line, 2, '#ffe070');
  }

  flee(dt) {
    const t = this.threat;
    if (!t || t.dead || (this.stateT > 20 && this.distTo(t) > 12) || this.stateT > 45) {
      this.calmDown();
      return;
    }
    // Run home if possible, otherwise directly away from the threat.
    const home = this.homeBuilding();
    if (!this.fleeGoal || this.stateT - (this.fleeSet || 0) > 6) {
      this.fleeSet = this.stateT;
      if (home && home.homeSpots.length && Math.hypot(home.inside.x - t.x, home.inside.z - t.z) > 4) {
        const s = home.homeSpots[this.rng.int(0, home.homeSpots.length - 1)];
        this.fleeGoal = { x: s.x, y: GROUND, z: s.z };
      } else {
        const dx = Math.sign(this.x - t.x) || this.rng.pick([-1, 1]);
        const dz = Math.sign(this.z - t.z) || this.rng.pick([-1, 1]);
        this.fleeGoal = { x: this.x + dx * 10, y: this.y, z: this.z + dz * 8 };
      }
      this.path = null;
    }
    if (this.followPath(this.fleeGoal, 1)) {
      this.dir = this.rng.int(0, 3);
      if (this.rng.chance(0.1)) this.emoteShow('!', '#ffe070', 1);
    }
  }

  alert() {
    // After shouting, run to the nearest guard, then flee.
    const guards = this.game.guardsOf(this.settlement.id);
    if (!guards.length || this.stateT > 10) {
      this.startFlee(this.threat, null);
      return;
    }
    let g = guards[0];
    for (const q of guards) if (this.distTo(q) < this.distTo(g)) g = q;
    if (this.distTo(g) <= 2) {
      g.engage(this.threat);
      this.startFlee(this.threat, null);
      return;
    }
    this.followPath({ x: g.x, y: g.y, z: g.z }, 2);
  }

  fight(dt) {
    const t = this.threat;
    const game = this.game;
    if (this.hired && (this.distTo(game.player) > 14 || !t || t.kind === 'player')) {
      this.calmDown(true);
      return;
    }
    const guard = this.rec.job === 'guard';
    const sid = this.settlement.id;
    const justice = game.sim.justice;
    const lawful = t && t.kind === 'player' && (game.isWanted(sid) || justice.exiled.has(sid));
    const tooFar = !t || t.dead || this.distTo(t) > (guard ? 40 : 14) || (t.kind === 'player' && guard && !lawful && this.stateT > 25);
    if (tooFar || this.stateT > 90 || (t && t.kind === 'player' && justice.jail)) {
      this.calmDown();
      return;
    }
    const d = this.distTo(t);
    // Badly hurt: run for the bell to raise help (if one's near), then fall
    // back to the other guards.
    if (guard && this.hp < this.maxHp * 0.35 && !this.retreated) {
      if (game.alarmNeeded(this, t, 30)) return this.startAlarm(t, 'retreat');
      return this.startRetreat(t);
    }
    if (this.retreated && this.hp >= this.maxHp * 0.6) this.retreated = false;
    if (guard && t.kind === 'player') {
      // Waiting for an answer to "Halt!".
      if (this.haltT > 0) {
        this.haltT -= dt;
        this.face(t.x, t.z);
        if (d > 3) this.followPath({ x: t.x, y: t.y, z: t.z }, 2);
        return;
      }
      if (d <= 2 && !justice.exiled.has(sid) && justice.canHalt(sid)) {
        this.face(t.x, t.z);
        this.say('Halt! In the name of the law!', 3, '#ffe070');
        justice.halt(this);
        return;
      }
    }
    if (this.canShoot() && d >= 2 && d <= 6 && Math.abs(t.y - this.y) <= 2) {
      this.face(t.x, t.z);
      if (this.attackCd <= 0) {
        this.attackCd = 1.5;
        this.doAction(0.3);
        invTake(this.rec.inv, 'arrow', 1);
        game.shoot(this, t, this.attackDamage(true));
      }
      return;
    }
    const w = this.meleeWeapon();
    const reach = w && ITEMS[w].reach > 2 ? 2 : 1;
    if (d <= reach && Math.abs(t.y - this.y) <= 1) {
      this.face(t.x, t.z);
      if (this.attackCd <= 0) {
        this.attackCd = guard ? 0.75 : 1.0;
        this.doAction(0.3);
        game.damage(t, this.attackDamage(false), this);
      }
      return;
    }
    if (!this.path || this.stateT - (this.chaseSet || 0) > 0.8) {
      this.chaseSet = this.stateT;
      this.path = null;
    }
    this.followPath({ x: t.x, y: t.y, z: t.z }, reach);
  }

  calmDown(silent = false) {
    this.state = this.hired ? 'hired' : 'routine';
    this.threat = null;
    this.path = null;
    this.activity = null;
    this.fleeGoal = null;
    this.haltT = 0;
    if (!silent && this.rng.chance(0.5)) this.say(this.rng.pick(['Phew...', 'That was close.', '*sigh*', 'Is it over?']), 2);
  }

  onHurt(attacker) {
    if (this.hired && attacker && attacker.kind === 'player') {
      this.game.sim.careers.endEscort('You turn on ME? We\'re done!');
      this.hired = null;
    }
    if (this.state === 'fight' && this.threat === attacker) return;
    this.prey = null;
    this.react(attacker, false);
  }

  // Passing remarks: rare, and dependent on how they feel about you.
  maybeGreet(player, dt) {
    this.greetCd -= dt;
    if (this.greetCd > 0 || this.sleeping || this.state !== 'routine' || this.bubble || player.dead) return;
    if (this.distTo(player) > 3) return;
    this.greetCd = this.rng.float(60, 150);
    const sim = this.game.sim;
    if (!sim.canGreet()) return;
    const rep = sim.opinion(this);
    const citizen = sim.isCitizen(this.settlement.id);
    let chance = 0.04 + this.rec.personality.sociability * 0.08;
    if (citizen) chance += 0.15;
    if (rep >= 35) chance += 0.25;
    else if (rep >= 10) chance += 0.1;
    if (rep <= -25) chance = 0.2;
    if (this.act === 'work' && this.atGoal) chance *= 0.5;
    if (this.act === 'mourn' || this.act === 'funeral' || this.act === 'trial') chance = 0;
    if ((this.rec.grief || []).some((g) => g.rel !== 'acquaintance')) chance *= 0.4;
    if (!this.rng.chance(chance)) return;
    sim.markGreet();
    this.face(player.x, player.z);
    this.say(greetLine(this, this.game, rep, citizen), 3.5, rep <= -25 ? '#ffb080' : undefined);
  }
}

export { dialogueLine };
