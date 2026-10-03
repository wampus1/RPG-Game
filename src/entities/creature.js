// Wildlife and monsters: wander, flee, or hunt the player and villagers.
import { Entity } from './entity.js';
import { findPath } from './pathfind.js';
import { RNG, hash4 } from '../util/rng.js';
import { leadTick } from '../game/leads.js';
import { beginAttack, tickAttack, inReach, styleOf } from '../game/combat.js';
import { MONSTER_SPECIES, BRAINS, blightTick, bossBreach, lob, groundFire, addZone } from './monsters.js';
import { ISLE_MOB_SPECIES } from './islemobs.js';
import { apart, fits } from './footprint.js';
import { bossClock, drift, press } from './tempo.js';
import { walksFields, fieldWay, lowerFields } from './fields.js';
import { MONSTER_LOOKS } from '../render/dungeonart.js';
import { ITEMS } from '../world/items.js';
import { B } from '../world/blocks.js';

export const SPECIES = {
  slime: { name: 'Slime', hp: 8, dmg: 2, step: 0.5, mode: 'hostile', aggro: 7, drops: [['slime_gel', 1, 2, 1]], night: true },
  skeleton: { name: 'Skeleton', hp: 14, dmg: 3, step: 0.36, mode: 'hostile', aggro: 9, drops: [['bone', 1, 3, 1], ['coin', 1, 4, 0.5], ['string', 1, 2, 0.4]], night: true, humanoid: true },
  wolf: { name: 'Wolf', hp: 9, dmg: 2, step: 0.28, mode: 'hostile', aggro: 7, drops: [['raw_meat', 1, 2, 1], ['leather', 1, 1, 0.5]], packs: true },
  boar: { name: 'Boar', hp: 12, dmg: 3, step: 0.34, mode: 'neutral', aggro: 0, drops: [['raw_meat', 1, 3, 1], ['leather', 1, 2, 0.6]] },
  deer: { name: 'Deer', hp: 8, dmg: 0, step: 0.24, mode: 'passive', drops: [['raw_meat', 1, 2, 1], ['leather', 1, 1, 0.7]] },
  rabbit: { name: 'Rabbit', hp: 3, dmg: 0, step: 0.22, mode: 'passive', drops: [['raw_meat', 1, 1, 1]] },
  chicken: { name: 'Chicken', hp: 3, dmg: 0, step: 0.4, mode: 'passive', drops: [['feather', 1, 2, 1], ['raw_meat', 1, 1, 0.6]], tame: true },
  // Wild on open grassland (animal handlers tame them); a town's or a
  // trader's stand tied to a fence with a lead.
  horse: { name: 'Horse', hp: 14, dmg: 0, step: 0.3, mode: 'passive', drops: [['leather', 1, 3, 1], ['raw_meat', 1, 3, 1]], tame: true },
  // Night things. A ghoul: quick, low to the ground, in twos and threes; it
  // rakes three times at once (each stroke taken on a shield costs breath),
  // or springs from two paces off: roll, or parry, rather than hide.
  ghoul: { name: 'Ghoul', hp: 10, dmg: 2, step: 0.22, mode: 'hostile', aggro: 10, drops: [['bone', 1, 2, 0.8], ['coin', 1, 3, 0.4]], night: true, packs: true },
  // A will-o'-the-wisp: a drifting light that keeps its distance and lobs
  // balls of cold fire where you stand (they burst where they land, and
  // chill): keep moving, and run it down; it flits off if you get close.
  wisp: { name: 'Will-o\'-the-Wisp', hp: 6, dmg: 3, step: 0.3, mode: 'hostile', aggro: 12, drops: [['coin', 1, 3, 0.6]], night: true, floats: true, light: 7 },
  // Farm beasts, out on the grass and kept in town (see game.spawning).
  pig: { name: 'Pig', hp: 8, dmg: 0, step: 0.42, mode: 'passive', drops: [['raw_meat', 2, 3, 1], ['leather', 1, 1, 0.3]], tame: true },
  sheep: { name: 'Sheep', hp: 7, dmg: 0, step: 0.4, mode: 'passive', drops: [['raw_meat', 1, 2, 1], ['string', 1, 3, 0.8]], tame: true },
  cow: { name: 'Cow', hp: 12, dmg: 0, step: 0.5, mode: 'passive', drops: [['raw_meat', 2, 4, 1], ['leather', 1, 2, 0.8]], tame: true },
  // The other Dagoni Islands' own (see game.spawning; drawn in isleart.js).
  // On Kharos: a grey lizard basking on the warm ash (leave it be and it
  // leaves you be), a crab with a back of cooling rock, glowing in its
  // cracks; and by night cinderlings, sparks of the mountain that drift
  // and spit fire where you stand (they burst, and the ground burns).
  ash_lizard: { name: 'Ash Lizard', hp: 7, dmg: 2, step: 0.24, mode: 'neutral', aggro: 0, drops: [['raw_meat', 1, 1, 1], ['leather', 1, 1, 0.5], ['sulfur', 1, 1, 0.25]], fireproof: true, isle: 'kharos' },
  magma_crab: { name: 'Magma Crab', hp: 13, dmg: 3, step: 0.42, mode: 'neutral', aggro: 0, drops: [['crab_meat', 1, 2, 1], ['obsidian_shard', 1, 1, 0.35]], light: 3, noHalo: true, fireproof: true, isle: 'kharos' },
  cinderling: { name: 'Cinderling', hp: 7, dmg: 3, step: 0.3, mode: 'hostile', aggro: 11, drops: [['sulfur', 1, 2, 0.7], ['coin', 1, 2, 0.4]], night: true, floats: true, light: 9, lobs: 'fire', isle: 'kharos' },
  // On Myrrow: fat toads in the shallows and the peat pools; crawlers that
  // wear the mushrooms they feed on (strike one and it puffs its spores at
  // you); and moths the size of a hand, lit like lamps, out at dusk.
  mire_toad: { name: 'Mire Toad', hp: 4, dmg: 0, step: 0.3, mode: 'passive', drops: [['raw_meat', 1, 1, 0.8], ['slime_gel', 1, 1, 0.3]], isle: 'myrrow' },
  shroom_crawler: { name: 'Shroom Crawler', hp: 10, dmg: 2, step: 0.5, mode: 'neutral', aggro: 0, drops: [['mushroom', 1, 3, 1], ['glowcap', 1, 1, 0.4]], spores: true, isle: 'myrrow' },
  gloam_moth: { name: 'Gloam Moth', hp: 3, dmg: 0, step: 0.24, mode: 'passive', drops: [['moth_dust', 1, 2, 1]], night: true, floats: true, light: 5, noHalo: true, isle: 'myrrow' },
  // (And what lives below ground: see monsters.js; and what comes out at
  // night on Kharos and Myrrow: see islemobs.js.)
  ...MONSTER_SPECIES,
  ...ISLE_MOB_SPECIES,
};

// Inside the bounds something's held to (a master, its hall).
export function inLeash(c, x, z) {
  const L = c.leash;
  return !L || (x >= L.x0 && x <= L.x1 && z >= L.z0 && z <= L.z1);
}

// What a skeleton picked up (and so how it fights: see combat.styleOf).
const SKELETON_ARMS = [['stone_sword', 0.3], ['hand_axe', 0.2], ['wooden_spear', 0.15], ['club', 0.15], ['bow', 0.2]];

const SKELETON_LOOK = {
  skin: '#e8e4d4', hair: '#e8e4d4', hairStyle: 'bald', shirt: '#d8d4c4', pants: '#c8c4b4', shoes: '#c8c4b4', outfit: 'skeleton', accent: '#e8e4d4',
};

export class Creature extends Entity {
  constructor(game, species, x, y, z, variant = 0) {
    super(game, x, y, z);
    const S = SPECIES[species];
    this.kind = S.humanoid ? 'monster' : 'creature';
    this.species = species;
    this.S = S;
    this.name = S.name;
    this.hp = this.maxHp = S.hp;
    this.variant = variant;
    this.rng = new RNG(hash4(this.id, x, z, 91));
    this.target = null;
    this.thinkT = 0;
    this.attackCd = 0;
    this.path = null;
    this.pathI = 0;
    this.home = { x, z };
    this.fleeFrom = null;
    this.angry = false;
    // (The great masters fill three paces across: see footprint.js.)
    this.foot = S.boss && S.big ? 1 : 0;
    if (S.humanoid) this.look = S.look ? MONSTER_LOOKS[S.look] : SKELETON_LOOK;
    if (species === 'skeleton') {
      let r = this.rng.next();
      this.arms = SKELETON_ARMS.find(([, w]) => (r -= w) <= 0)?.[0] || 'stone_sword';
    }
    if (S.arms) this.arms = S.arms;
    // (Some carry what comes to hand: a pair of knives, a sword and a knife.)
    if (S.kits) {
      const [main, off] = this.rng.pick(S.kits);
      this.arms = main;
      this.offhand = off;
    }
    // (A shield on its arm, drawn there and raised to take a blow.)
    if (S.shield) {
      this.shieldKey = S.shield;
      this.look = { ...this.look, gear: { ...(this.look.gear || {}), shield: String(ITEMS[S.shield]?.look || 'wood').split(':')[0] } };
    }
  }

  heldItem() {
    return this.arms || null;
  }

  // What it fights with up close (a skeleton's bow: it clubs you with it).
  meleeWeapon() {
    return this.arms && this.arms !== 'bow' ? this.arms : null;
  }

  // A second blade in its other hand (a cutthroat's).
  offhandItem() {
    return this.offhand !== undefined ? this.offhand : this.S.offhand || null;
  }

  // How long a step takes it (quicker rallied, slower chilled).
  stepTime() {
    return this.S.step * (this.hasteT > 0 ? 0.7 : 1) * (this.slowT > 0 ? 1.4 : 1);
  }

  get hostileNow() {
    return this.S.mode === 'hostile' || this.angry;
  }

  update(dt) {
    this.updateBase(dt);
    if (this.dead) return;
    // A master's breath between attacks, and its phases (see tempo.js).
    const master = this.isBoss && this.inst && !this.dormant && !this.waiting;
    if (master && !(this.game.scene && this.game.scene.lock)) bossClock(this, dt);
    if (this.hasteT > 0) this.hasteT -= dt;
    // (Mid-roll: see monsters.tumble.)
    if (this.rollT > 0) this.rollT -= dt;
    if (this.attackCd > 0) this.attackCd -= dt * (this.hasteT > 0 ? 1.6 : 1);
    // Night monsters burn away in daylight.
    if (this.S.night && !this.inst && this.game.isDay() && this.rng.chance(dt * 0.08)) {
      this.game.renderer.emit(this.x, this.y + 1, this.z, { n: 10, color: ['#c8c8c8', '#8a8a8a'], up: 30, life: 0.8 });
      this.dead = true;
      return;
    }
    // Waiting in a niche, or switched off, till something comes near (see
    // game/dungeon.js).
    if (this.dormant) return;
    // Held where they are while a scene plays out (a master waking, or
    // falling: see game/scenes.js).
    if (this.inst && this.game.scene && this.game.scene.lock) return;
    // Winding up a blow (or charging): nothing else till it's thrown.
    if (this.windup && tickAttack(this.game, this, dt)) return;
    if (this.moving) return;
    // Staggered by a blow (an amethyst-set blade, or a parry).
    if (this.stunT > 0) {
      this.stunT -= dt;
      return;
    }
    this.thinkT -= dt;
    const game = this.game;
    // On a lead: pulled along after whoever holds it (or straining to
    // break free of it).
    if ((this.leadBy || this.leadTied) && leadTick(this, dt)) return;
    if (this.hostileNow && this.tie) {
      // Tied up, and in a temper: snapping at anyone who comes too close.
      const t = game.findPrey(this, 2);
      if (t && this.distTo(t) <= 1 && Math.abs(t.y - this.y) <= 1 && this.attackCd <= 0) {
        beginAttack(game, this, t, { ...styleOf(this), charge: false, reach: 1 });
        return;
      }
    }
    // (Lost you in the shadows a moment: it casts about. Not a master, in
    // its own hall: it knows where you are.)
    if (master && this.lostT > 0) this.lostT = 0;
    if (this.lostT > 0 && this.target === game.player) this.target = null;
    if (this.hostileNow && !this.tie && !(this.lostT > 0)) {
      if (!this.target || this.target.dead || this.distTo(this.target) > this.S.aggro * 2) this.target = game.findPrey(this, this.S.aggro || 6);
      // A master through whatever you've built in its way.
      if (this.isBoss && this.inst && bossBreach(this, dt)) return;
      // Changed by the blight (see monsters.js, blightTick).
      if (this.infected && blightTick(this, dt)) return;
      // (A master that's gone too long without an attack: what it has made
      // ready, and if even that brings nothing, straight at you: see
      // tempo.press.)
      if (master && this.target && press(this) === 'close') {
        if (this.attackCd > 0.3) this.attackCd = 0.3;
        return this.chase(dt);
      }
      // Its own way of fighting (see monsters.js), if it has one. (A master
      // never stands about long: see tempo.drift.)
      if (this.S.brain && BRAINS[this.S.brain](this, dt)) {
        if (master && !this.moving) drift(this, dt);
        return;
      }
      if (master && drift(this, dt)) return;
      // (Those that fight from afar: a skeleton with a bow, a wisp.)
      if (this.target && (this.species === 'wisp' || this.S.lobs || this.arms === 'bow' || this.S.ranged) && this.keepOff(dt)) return;
      if (this.target) return this.chase(dt);
    } else if (this.tie) {
      // Tied to a post: shifting about on the end of the lead, no further
      // (and back in to the post if it's further off than that).
      const far = Math.max(Math.abs(this.x - this.tie.x), Math.abs(this.z - this.tie.z)) > (this.tieR ?? 1);
      if (far && !this.moving) {
        const sx = Math.sign(this.tie.x - this.x);
        const sz = Math.sign(this.tie.z - this.z);
        if ((sx && this.tryStep(this.x + sx, this.z, this.S.step)) || (sz && this.tryStep(this.x, this.z + sz, this.S.step))) return;
      }
      if (this.thinkT <= 0) {
        this.thinkT = this.rng.float(2, 6);
        const [dx, dz] = [[1, 0], [-1, 0], [0, 1], [0, -1]][this.rng.int(0, 3)];
        if (Math.max(Math.abs(this.x + dx - this.tie.x), Math.abs(this.z + dz - this.tie.z)) <= (this.tieR ?? 1)) this.tryStep(this.x + dx, this.z + dz, this.S.step * 2);
        else this.face(this.x + dx, this.z + dz);
      }
      return;
    } else if (this.S.mode === 'passive') {
      // Hurt (an arrow from afar as much as a blow): off, away from
      // whoever did it, for a good while; otherwise shy of anyone close.
      if (this.fleeT > 0) this.fleeT -= dt;
      const scared = this.fleeT > 0 && this.fleeFrom && !this.fleeFrom.dead && this.distTo(this.fleeFrom) < 24;
      const t = scared ? this.fleeFrom : game.nearestThreatTo(this, 5);
      if (t) {
        const dx = Math.sign(this.x - t.x) || (this.rng.chance(0.5) ? 1 : -1);
        const dz = Math.sign(this.z - t.z) || (this.rng.chance(0.5) ? 1 : -1);
        const opts = this.rng.chance(0.5) ? [[dx, 0], [0, dz]] : [[0, dz], [dx, 0]];
        for (const [ox, oz] of opts) if (this.tryStep(this.x + ox, this.z + oz, this.S.step * (scared ? 0.55 : 0.7))) return;
        // (Cornered on the way it wants: any way but toward them.)
        if (scared) for (const [ox, oz] of [[dz, dx], [-dz, -dx]]) if (this.tryStep(this.x + ox, this.z + oz, this.S.step * 0.6)) return;
      }
    }
    if (this.thinkT <= 0) {
      this.thinkT = this.rng.float(1, 4);
      if (this.rng.chance(0.55)) {
        const [dx, dz] = [[1, 0], [-1, 0], [0, 1], [0, -1]][this.rng.int(0, 3)];
        // Stay near home.
        if (Math.abs(this.x + dx - this.home.x) < 10 && Math.abs(this.z + dz - this.home.z) < 8) this.tryStep(this.x + dx, this.z + dz, this.S.step * 1.4);
      }
    }
  }

  tryStep(nx, nz, dur) {
    // (A master keeps to its hall.)
    if (this.leash && !inLeash(this, nx, nz)) return false;
    const w = this.game.world;
    const ny = w.stepTarget(this.x, this.y, this.z, nx, nz, false);
    if (ny < 0 || this.game.occupiedBySolid(nx, ny, nz, this)) return false;
    // (A great master only where all of it fits: never half into a wall.)
    if (this.foot && !fits(this.game, this, nx, ny, nz)) return false;
    // Wildlife avoids settlements' insides and deep water.
    if (w.isWaterAt(nx, ny, nz) && this.species !== 'slime' && !this.S.swims) return false;
    // (And lava, unless it's at home in the fire.)
    if (w.getBlock(nx, ny, nz) === B.lava && !this.S.fireproof && !this.S.floats) return false;
    this.face(nx, nz);
    this.startMove(nx, ny, nz, dur);
    return true;
  }

  chase(dt) {
    const t = this.target;
    // (Edge to edge, for a great master.)
    const d = this.foot ? apart(this, t) : this.distTo(t);
    const st = styleOf(this, true);
    // In reach: wind up a blow (each kind its own way: see combat.js).
    if (inReach(this, t, st) && (d <= 1 || st.lunge || st.charge || st.thrust)) {
      this.face(t.x, t.z);
      if (this.attackCd <= 0) beginAttack(this.game, this, t, st);
      if (d <= 1) return;
    }
    if (d <= 1 && Math.abs(t.y - this.y) <= 1) {
      this.face(t.x, t.z);
      return;
    }
    // (Close in, it keeps its way to you fresh: a quarter of a second near,
    // longer the further off.)
    const near = d <= 7;
    const moved = this.pathGoal && (this.pathGoal.x !== t.x || this.pathGoal.z !== t.z);
    if (!this.path || this.pathI >= this.path.length || this.thinkT <= 0 || (near && moved && this.thinkT < 0.55)) {
      this.thinkT = near ? 0.25 : d <= 14 ? 0.5 : 0.8;
      if (!this.game.requestPathBudget(near)) return;
      this.pathGoal = { x: t.x, z: t.z };
      // (A master goes straight through what you've built below: see
      // monsters.bossBreach.)
      const placed = this.isBoss && this.inst && this.game.dungeon && this.game.dungeon.placed;
      const through = placed && placed.size ? (x, y, z) => placed.has(`${x},${y},${z}`) || placed.has(`${x},${y + 1},${z}`) : null;
      const big = this.foot;
      const clear = big ? (x, y, z) => fits(this.game, this, x, y, z, true) : null;
      // (The Overseer, with no way round a wall of force, turns it off and
      // goes through: see fields.js.)
      const soft = walksFields(this) ? fieldWay(this.game) : null;
      this.path = soft ? findPath(this.game.world, this.x, this.y, this.z, t.x, t.y, t.z, { maxNodes: 600, near: 1 + big, through, clear }) : null;
      if (soft && !(this.path && this.path.length)) {
        const way = through ? (x, y, z) => through(x, y, z) || soft(x, y, z) : soft;
        this.path = findPath(this.game.world, this.x, this.y, this.z, t.x, t.y, t.z, { maxNodes: 600, near: 1 + big, partial: true, through: way, clear: big ? (x, y, z) => fits(this.game, this, x, y, z, true, soft) : null });
      }
      if (!(this.path && this.path.length)) this.path = findPath(this.game.world, this.x, this.y, this.z, t.x, t.y, t.z, { maxNodes: 600, near: 1 + big, partial: true, through, clear });
      this.pathI = 0;
      if (!this.path || !this.path.length) {
        this.path = null;
        return;
      }
    }
    const [nx, , nz] = this.path[this.pathI];
    if (walksFields(this)) lowerFields(this, nx, nz);
    if (this.tryStep(nx, nz, this.stepTime())) this.pathI++;
    else {
      // (Something you've built in a master's way: it's next for smashing.)
      const placed = this.isBoss && this.game.dungeon && this.game.dungeon.placed;
      if (placed && [this.y, this.y + 1].some((y) => placed.has(`${nx},${y},${nz}`))) this.breachAt = { x: nx, z: nz };
      this.path = null;
    }
  }

  // Fighting from a distance: back off if they come close, close in if
  // they're far, and in between, shoot (a skeleton's bow: drawn a moment,
  // then loosed) or throw cold fire (a wisp: it gathers, then flies). True
  // if that's what it's doing; false to fight close instead.
  keepOff(dt) {
    const t = this.target;
    const game = this.game;
    const d = this.distTo(t);
    // (A cinderling throws as a wisp does, but fire.)
    const wisp = this.species === 'wisp' || !!this.S.lobs;
    const fire = this.S.lobs === 'fire';
    this.castT = (this.castT ?? this.rng.float(1, 2.5)) - dt;
    // Gathering itself: the shot comes when it's ready.
    if (this.aiming) {
      this.aiming.t -= dt;
      this.face(t.x, t.z);
      if (this.aiming.t > 0) return true;
      const a = this.aiming;
      this.aiming = null;
      this.drawnBow = false;
      this.castT = wisp ? this.rng.float(3.5, 5) : this.rng.float(2.4, 3.4);
      if (fire) lob(game, this, a.x, a.z, { tint: [255, 130, 40], onLand: (g, x, z, y) => cinderBurst(g, this, x, z, y) });
      else if (wisp) game.lobOrb(this, a.x, a.y, a.z, this.S.dmg);
      else if (d <= 9) game.shoot(this, t, 3, 'arrow');
      this.doAction(0.3);
      return true;
    }
    // Too close: away (a skeleton with nowhere to go clubs you).
    if (d <= (wisp ? 3 : 2)) {
      const dx = Math.sign(this.x - t.x) || (this.rng.chance(0.5) ? 1 : -1);
      const dz = Math.sign(this.z - t.z) || (this.rng.chance(0.5) ? 1 : -1);
      const opts = this.rng.chance(0.5) ? [[dx, 0], [0, dz], [dx, dz]] : [[0, dz], [dx, 0], [dx, dz]];
      if (!this.moving) for (const [ox, oz] of opts) if (this.tryStep(this.x + ox, this.z + oz, this.S.step * (wisp ? 0.6 : 0.9))) return true;
      return !wisp ? false : true;
    }
    if (d > (wisp ? 8 : 9)) return false;
    if (this.castT > 0 || Math.abs(t.y - this.y) > 2) return true;
    // (Only with a clear line to them; and a wisp's fire comes down from
    // above, so nobody under a roof it isn't under itself.)
    if (!game.sim.lineOfSight(this.x, this.z, t.x, t.z, this.y + 1)) return false;
    if (wisp && game.roofed(t.x, t.y, t.z) && !game.roofed(this.x, this.y, this.z)) return true;
    this.aiming = { t: wisp ? 0.9 : 0.75, x: t.x, y: t.y, z: t.z };
    this.drawnBow = !wisp;
    this.face(t.x, t.z);
    if (wisp) {
      // (Where it'll come down, glowing on the ground.)
      game.renderer.effect?.({ type: 'ring', wx: t.x, wy: t.y, wz: t.z, r0: 10, r1: 3, color: fire ? ['#ff8030', '#ffd060'] : ['#80d0ff', '#c0f0ff'], life: 1.0, oy: 4, flat: 0.5 });
      game.audio?.play('portal', this);
    }
    return true;
  }

  onHurt(attacker) {
    // (A crawler's mushrooms burst when struck: a cloud of spores.)
    if (this.S.spores && !this.dead && this.rng.chance(0.5)) sporePuff(this.game, this);
    if (this.S.mode === 'neutral') {
      this.angry = true;
      this.target = attacker;
    } else if (this.S.mode === 'hostile') this.target = attacker;
    else {
      this.thinkT = 0;
      this.fleeFrom = attacker;
      this.fleeT = 7;
    }
  }
}

// Where a cinderling's fire comes down: it scorches whoever's there (not
// those who rolled clear), sets them alight a moment, and the ground burns.
function cinderBurst(game, from, x, z, y) {
  for (const e of [game.player, ...game.npcs, ...game.creatures]) {
    if (e.dead || e.down || e === from || (e.S && e.S.night) || Math.max(Math.abs(e.x - x), Math.abs(e.z - z)) > 1 || Math.abs(e.y - y) > 2) continue;
    if (e.kind === 'player' && e.rollT > 0) {
      game.renderer.floatText(e.x, e.y + 2, e.z, 'dodged', '#ffd8a0');
      continue;
    }
    game.damage(e, Math.max(1, Math.round(from.S.dmg * (e.x === x && e.z === z ? 1 : 0.6))), from);
    e.burnT = Math.max(e.burnT || 0, 2);
    e.burnSrc = from;
  }
  groundFire(game, x, z, y, from, false, 0);
  game.renderer.emit(x + 0.5, y + 0.6, z + 0.5, { n: 16, color: ['#ff8030', '#ffd060', '#ff4020'], up: 30, speed: 40, life: 0.7, glow: true, gravity: -10 });
  game.audio?.play('impact', { x, y, z });
}

// A shroom crawler's spores: a pale cloud that stings and slows a while.
const SPORES = ['#d8d0a0', '#b8c890', '#e8e0c0'];
function sporePuff(game, c) {
  const tiles = [];
  for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) if (Math.abs(dx) + Math.abs(dz) < 2) tiles.push({ x: c.x + dx, z: c.z + dz });
  addZone(game, { by: c, kind: 'spores', tiles, y: c.y, life: 3.5, tick: 0.7, dmg: 1, slow: true, color: [200, 200, 140], puff: SPORES });
  game.renderer.emit(c.x, c.y + 0.8, c.z, { n: 18, color: SPORES, up: 16, speed: 30, life: 0.9, shape: 'puff', gravity: -6 });
  game.audio?.play('skitter', c);
}
