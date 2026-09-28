// NPC behaviour: follow the daily schedule (and any special plans the town
// simulation gives them: mourning, hunting for food, building, trials,
// trading trips) by walking tile by tile; open/close doors; react to threats
// by fighting, calling the guards, or fleeing.
import { Entity } from './entity.js';
import { NPC_STEP_TIME, GROUND } from '../config.js';
import { HOBBIES, jobTitle } from './npcgen.js';
import { findPath } from './pathfind.js';
import { BLOCKS, B } from '../world/blocks.js';
import { ITEMS } from '../world/items.js';
import { RNG, hash4 } from '../util/rng.js';
import { dialogueLine, greetLine } from '../game/dialogue.js';
import { activityFor, entryStart, invCount, invTake, invAdd, setOverride } from '../sim/econ.js';

const EMOTES = {
  work: ['•', '#e8d8b0'], read: ['≡', '#a0c8ff'], study: ['≡', '#a0c8ff'], pray: ['†', '#ffe8a0'], music: ['♪', '#ff9ad0'],
  drink: ['♦', '#ffb060'], dice: ['¤', '#ffe070'], gossip: ['…', '#e8e8e8'], social: ['☺', '#e8e8e8'], fish: ['~', '#80c8ff'],
  garden: ['♣', '#80e070'], sketch: ['✎', '#e8d8b0'], train: ['!', '#ff8060'], stargaze: ['*', '#c8d8ff'], smoke: ['°', '#c8c8c8'],
  play: ['♪', '#80ffb0'], eat: ['♥', '#ff8080'], stroll: ['·', '#c8c8c8'], farm: ['♣', '#c8e070'], chop: ['!', '#e8b080'], mine: ['!', '#c8c8d8'],
  mourn: ['†', '#b0b8e0'], funeral: ['†', '#b0b8e0'], build: ['■', '#e8c890'], cook: ['°', '#ffb060'], hunt: ['►', '#c8e070'], forage: ['♣', '#c8e070'],
};

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
    this.openedDoor = null;
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
    return jobTitle(this.rec, this.settlement);
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
    if (this.state === 'fight') return this.weapon();
    if (this.prey) return this.weapon();
    const a = this.activity?.entry;
    if (!a) return null;
    if (a.act === 'build') return 'hammer';
    if ((a.act === 'forage' || a.act === 'hunt') && this.atGoal) return this.weapon();
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
    const b = this.rec.home !== null ? this.layout.buildings[this.rec.home] : null;
    if (b && b.homeSpots.length) return b.homeSpots[this.rec.idx % b.homeSpots.length];
    const p = this.layout.plaza;
    return { x: p.cx, y: GROUND, z: p.cz + 2 };
  }

  // ------------------------------------------------------------ goals
  pickGoal(e) {
    const L = this.layout;
    const rec = this.rec;
    const home = rec.home !== null ? L.buildings[rec.home] : null;
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
      case 'play':
        return rng.chance(0.3) ? tagged('play') || plazaTile() : plazaTile();
      case 'social':
        if (e.place === 'tavern' || this.game.minute > 1140) return inBuilding(buildingOf('tavern'), 'social') || tagged('social') || plazaTile();
        return tagged(rng.chance(0.5) ? 'gossip' : 'social') || plazaTile();
      case 'wander':
        return roadTile();
      case 'mourn': case 'funeral':
        return target(e.target, { face: 2, tag: e.act, near: e.act === 'funeral' ? 1 : 0 });
      case 'build': {
        const sites = e.sites || [e.target];
        return target(sites[rng.int(0, sites.length - 1)], { tag: 'build', build: true });
      }
      case 'trial':
        return target(e.target, { near: 1, tag: 'trial' });
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
      // Trappers alternate between checking snares and hunting.
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
    if (this.moving) return;
    this.closeDoorBehind();
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
    }
  }

  routine(dt) {
    const game = this.game;
    let act = activityFor(this.rec, game.day, game.minute);
    if (!this.activity || act.key !== this.activity.key) {
      const wasWork = this.activity && this.activity.entry.act === 'work';
      this.activity = act;
      this.wake();
      // After a day's hunting or fishing, take the catch to the tavern.
      if (wasWork && act.entry.act !== 'work' && act.entry.act !== 'eat' && act.entry.act !== 'sleep' && (this.rec.job === 'trapper' || this.rec.job === 'fisher')) {
        const catchN = (this.rec.inv || []).reduce((n, q) => n + (q.item === 'raw_meat' || q.item === 'fish' ? q.count : 0), 0);
        const tavern = this.layout.buildings.find((b) => b.type === 'tavern');
        if (catchN >= 2 && tavern && !this.rec.override) {
          const now = game.day * 1440 + game.minute;
          setOverride(this.rec, now, now + 50, 'sell', { target: tavern.inside, place: 'tavern' });
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
    }
    // Guards react to wanted players and nearby monsters.
    if (this.rec.job === 'guard' && !this.sleeping) {
      const t = game.findGuardTarget(this);
      if (t) {
        this.engage(t);
        return;
      }
    }
    if (this.sleeping) return;
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
    if (act === 'trial') this.face(this.game.player.x, this.game.player.z);
    if (g.trap) this.checkSnare(g.trap);
    if (g.sell) {
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
      const em = EMOTES[tag];
      if (em && !g.wander) this.emoteShow(em[0], em[1], 2.2);
    }
    if (act.act === 'mourn' || act.act === 'funeral') return this.mourn(act);
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
        if (this.rng.chance(0.4)) this.say(this.rng.pick(['Almost got this beam!', 'Hand me that plank.', 'Steady...', 'A fine little cottage.']), 2.5);
      }
    }
    if (act.act === 'visit' && this.lineCd <= 0) {
      this.lineCd = this.rng.float(15, 35);
      const v = this.rec.visit;
      if (this.rng.chance(0.6)) this.say(this.rng.pick([`Fine goods from ${v.fromName}!`, 'Rare wares! Come and see!', 'Traded all the way from the coast!', 'Best prices this side of the river!']), 3, '#ffe070');
    }
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
    if (act.act === 'work' && this.rng.chance(dt * 0.6)) {
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
    if (g.patrol || g.wander || g.wanderIn || g.build || g.hunt || act.act === 'play' || (g.tag === 'farm' && this.rng.chance(0.5))) {
      this.goal = act.act === 'work' ? this.workGoal() : this.pickGoal(act);
      this.atGoal = false;
      this.path = null;
    } else if (this.rng.chance(0.3) && !this.sitting) this.dir = this.rng.int(0, 3);
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
      this.emoteShow('!', '#c8e070', 2);
    } else this.emoteShow('?', '#c8c8c8', 1.5);
  }

  idle(dt) {
    this.idleT -= dt;
    if (this.idleT <= 0) {
      this.idleT = this.rng.float(5, 12);
      this.dir = this.rng.int(0, 3);
    }
  }

  // Walk one step along a path to `goal`. Returns true when arrived.
  followPath(goal, near = 0) {
    const d = Math.max(Math.abs(goal.x - this.x), Math.abs(goal.z - this.z));
    if (d <= near && (near > 0 || this.x === goal.x && this.z === goal.z)) return true;
    if (!this.path || this.pathI >= this.path.length) {
      if (this.waitT > 0) {
        this.waitT -= this.game.dt;
        return false;
      }
      if (!this.game.requestPathBudget()) return false;
      const b = this.settlement.bounds;
      const box = { x0: Math.min(b.x0, this.x, goal.x) - 26, z0: Math.min(b.z0, this.z, goal.z) - 22, x1: Math.max(b.x1, this.x, goal.x) + 26, z1: Math.max(b.z1, this.z, goal.z) + 22 };
      const w0 = this.game.world;
      const av = this.avoid && this.avoid.t > 0 ? this.avoid : null;
      const blocked = av ? (x, z) => x === av.x && z === av.z : null;
      const p = findPath(w0, this.x, this.y, this.z, goal.x, goal.y ?? this.y, goal.z, { box, near, maxNodes: 5000, partial: true, blocked });
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
    if (feet === B.door && !w.getState(nx, ty, nz)) {
      this.game.setDoor(nx, ty, nz, true);
      this.openedDoor = { x: nx, y: ty, z: nz, passed: false };
    }
    this.face(nx, nz);
    this.startMove(nx, ty, nz, this.step * (this.state === 'flee' ? 0.6 : this.state === 'fight' ? 0.7 : this.prey ? 0.75 : this.activity?.entry.act === 'play' ? 0.8 : 1) * (w.isWaterAt(nx, ty, nz) ? 1.8 : 1));
    this.pathI++;
    return false;
  }

  closeDoorBehind() {
    const d = this.openedDoor;
    if (!d) return;
    if (this.x === d.x && this.z === d.z) {
      d.passed = true;
      return;
    }
    if (d.passed || Math.abs(this.x - d.x) + Math.abs(this.z - d.z) > 1) {
      if (!this.game.entityAt(d.x, d.y, d.z)) this.game.setDoor(d.x, d.y, d.z, false);
      this.openedDoor = null;
    }
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
    const home = this.rec.home !== null ? this.layout.buildings[this.rec.home] : null;
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
    this.state = 'routine';
    this.threat = null;
    this.path = null;
    this.activity = null;
    this.fleeGoal = null;
    this.haltT = 0;
    if (!silent && this.rng.chance(0.5)) this.say(this.rng.pick(['Phew...', 'That was close.', '*sigh*', 'Is it over?']), 2);
  }

  onHurt(attacker) {
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
