// NPC behaviour: follow the daily schedule by walking tile by tile to homes,
// workplaces and attractions; open/close doors; react to threats by fighting,
// calling the guards, or fleeing.
import { Entity } from './entity.js';
import { NPC_STEP_TIME, GROUND } from '../config.js';
import { activityAt, JOBS, HOBBIES } from './npcgen.js';
import { findPath } from './pathfind.js';
import { BLOCKS, B } from '../world/blocks.js';
import { ITEMS } from '../world/items.js';
import { RNG, hash4 } from '../util/rng.js';
import { dialogueLine } from '../game/dialogue.js';

const EMOTES = {
  work: ['•', '#e8d8b0'], read: ['≡', '#a0c8ff'], study: ['≡', '#a0c8ff'], pray: ['†', '#ffe8a0'], music: ['♪', '#ff9ad0'],
  drink: ['♦', '#ffb060'], dice: ['¤', '#ffe070'], gossip: ['…', '#e8e8e8'], social: ['☺', '#e8e8e8'], fish: ['~', '#80c8ff'],
  garden: ['♣', '#80e070'], sketch: ['✎', '#e8d8b0'], train: ['!', '#ff8060'], stargaze: ['*', '#c8d8ff'], smoke: ['°', '#c8c8c8'],
  play: ['♪', '#80ffb0'], eat: ['♥', '#ff8080'], stroll: ['·', '#c8c8c8'], farm: ['♣', '#c8e070'], chop: ['!', '#e8b080'], mine: ['!', '#c8c8d8'],
};

export class NPC extends Entity {
  constructor(game, rec, layout) {
    super(game, 0, 0, 0);
    this.kind = 'npc';
    this.rec = rec;
    this.layout = layout;
    this.settlement = layout.settlement;
    this.look = rec.look;
    this.hp = rec.hp;
    this.maxHp = rec.maxHp;
    this.rng = new RNG(hash4(rec.idx, layout.settlement.seed, 77));
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
    this.greetCd = this.rng.float(2, 8);
    this.emoteCd = this.rng.float(3, 12);
    this.step = NPC_STEP_TIME * (rec.age === 'elder' ? 1.35 : rec.age === 'child' ? 0.85 : 1) * this.rng.float(0.9, 1.12);
    this.pathFails = 0;
  }

  get name() {
    return `${this.rec.name.first} ${this.rec.name.last}`;
  }

  get title() {
    return JOBS[this.rec.job]?.title || 'Villager';
  }

  heldItem() {
    if (this.sleeping) return null;
    if (this.state === 'fight') return this.weapon();
    const a = this.activity?.entry;
    if (!a) return null;
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
    return null;
  }

  attackDamage() {
    const w = this.weapon();
    const base = w ? ITEMS[w].damage : 1.5;
    return Math.max(1, Math.round(base * (this.rec.job === 'guard' ? 1.2 : 1) * (this.rec.age === 'child' ? 0.4 : 1)));
  }

  // ------------------------------------------------------------ placement
  placeForCurrentActivity() {
    const act = activityAt(this.rec, this.game.minute, this.game.day);
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
    const b = this.layout.buildings[this.rec.home];
    if (b && b.homeSpots.length) return b.homeSpots[this.rec.idx % b.homeSpots.length];
    const p = this.layout.plaza;
    return { x: p.cx, y: GROUND, z: p.cz + 2 };
  }

  // ------------------------------------------------------------ goals
  pickGoal(e) {
    const L = this.layout;
    const rec = this.rec;
    const home = L.buildings[rec.home];
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
      return { x: s.x, y: s.y, z: s.z, face: s.face, tag: s.tags[0] };
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
      const g = claimFrom(L.spotsByTag(w.tag));
      if (g) {
        g.tag = w.tag;
        return g;
      }
      // No fields/shore/woods spots: help out at the related building or the square.
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
    const act = activityAt(this.rec, game.minute, game.day);
    if (!this.activity || act.entry !== this.activity.entry) {
      this.activity = act;
      this.wake();
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
    }
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
    this.idleT -= dt;
    this.emoteCd -= dt;
    // Periodic small actions & emotes that show what they're doing.
    if (this.emoteCd <= 0) {
      this.emoteCd = this.rng.float(6, 16);
      const tag = act.act === 'hobby' ? HOBBIES[act.hobby]?.tag : act.act === 'work' ? g.tag || 'work' : act.act;
      const em = EMOTES[tag];
      if (em && !g.wander) this.emoteShow(em[0], em[1], 2.2);
    }
    if (act.act === 'work' && this.rng.chance(dt * 0.6)) {
      this.doAction(0.3);
      if (this.rec.job === 'blacksmith' && this.spot && this.spot.target) {
        const t = this.spot.target;
        this.game.renderer.emit(t.x, GROUND + 1, t.z, { n: 5, color: ['#ffe070', '#ffb040', '#ffffff'], up: 40, speed: 50, life: 0.4, oy: -4 });
        this.game.audio?.play('clang', this);
      }
    }
    if (this.idleT > 0) return;
    // Re-pick a spot now and then so places feel alive.
    this.idleT = this.rng.float(8, 25);
    if (g.patrol || g.wander || g.wanderIn || (act.act === 'play') || (g.tag === 'farm' && this.rng.chance(0.5))) {
      this.goal = act.act === 'work' ? this.workGoal() : this.pickGoal(act);
      this.atGoal = false;
      this.path = null;
    } else if (this.rng.chance(0.3)) this.dir = this.rng.int(0, 3);
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
    this.startMove(nx, ty, nz, this.step * (this.state === 'flee' ? 0.6 : this.state === 'fight' ? 0.7 : this.activity?.entry.act === 'play' ? 0.8 : 1) * (w.isWaterAt(nx, ty, nz) ? 1.8 : 1));
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
  // How this NPC responds when attacked or when it sees violence.
  react(threat, witnessed = false) {
    if (this.dead || !threat || threat.dead) return;
    if (this.sleeping) {
      if (witnessed) return;
      this.wake();
    }
    const p = this.rec.personality;
    const guardsExist = this.game.guardsOf(this.settlement.id).length > 0;
    if (this.rec.job === 'guard') return this.engage(threat);
    if (this.rec.age === 'child') return this.startFlee(threat, witnessed ? null : '!!');
    const armed = !!this.weapon();
    if (!witnessed && p.bravery > 0.68 && (armed || p.temper > 0.6)) {
      this.say(this.rng.pick(['You\'ll regret that!', 'Back off!', 'Take this!', 'How dare you!']), 2.5, '#ff9080');
      return this.engage(threat);
    }
    if (guardsExist && (p.sociability > 0.3 || p.bravery > 0.4) && this.rng.chance(witnessed ? 0.7 : 0.85)) {
      this.state = 'alert';
      this.stateT = 0;
      this.threat = threat;
      this.path = null;
      this.say(this.rng.pick(['GUARDS! HELP!', 'Guards! Guards!', 'Help! Murder!', 'Someone call the guard!']), 3, '#ffe070');
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
    this.releaseSpot();
  }

  startFlee(threat, line) {
    this.state = 'flee';
    this.threat = threat;
    this.stateT = 0;
    this.path = null;
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
    const home = this.layout.buildings[this.rec.home];
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
    const tooFar = !t || t.dead || this.distTo(t) > (guard ? 40 : 14) || (t.kind === 'player' && guard && !game.isWanted(this.settlement.id) && this.stateT > 25);
    if (tooFar || this.stateT > 90) {
      this.calmDown();
      return;
    }
    const d = this.distTo(t);
    const reach = this.weapon() && ITEMS[this.weapon()].reach > 2 ? 2 : 1;
    if (d <= reach && Math.abs(t.y - this.y) <= 1) {
      this.face(t.x, t.z);
      if (this.attackCd <= 0) {
        this.attackCd = guard ? 0.75 : 1.0;
        this.doAction(0.3);
        game.damage(t, this.attackDamage(), this);
      }
      return;
    }
    if (!this.path || this.stateT - (this.chaseSet || 0) > 0.8) {
      this.chaseSet = this.stateT;
      this.path = null;
    }
    this.followPath({ x: t.x, y: t.y, z: t.z }, reach);
  }

  calmDown() {
    this.state = 'routine';
    this.threat = null;
    this.path = null;
    this.activity = null;
    this.fleeGoal = null;
    if (this.rng.chance(0.5)) this.say(this.rng.pick(['Phew...', 'That was close.', '*sigh*', 'Is it over?']), 2);
  }

  onHurt(attacker) {
    if (this.state === 'fight' && this.threat === attacker) return;
    this.react(attacker, false);
  }

  // Idle chatter when the player walks by.
  maybeGreet(player, dt) {
    this.greetCd -= dt;
    if (this.greetCd > 0 || this.sleeping || this.state !== 'routine' || this.bubble) return;
    if (this.distTo(player) > 3) return;
    this.greetCd = this.rng.float(25, 60);
    if (this.rng.chance(0.25 + this.rec.personality.sociability * 0.6)) this.say(dialogueLine(this, this.game, 'greet'), 3.5);
  }
}
