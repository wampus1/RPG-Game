// Wildlife and monsters: wander, flee, or hunt the player and villagers.
import { Entity } from './entity.js';
import { findPath } from './pathfind.js';
import { RNG, hash4 } from '../util/rng.js';
import { leadTick } from '../game/leads.js';

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
};

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
    if (S.humanoid) this.look = SKELETON_LOOK;
  }

  heldItem() {
    return this.species === 'skeleton' ? 'stone_sword' : null;
  }

  get hostileNow() {
    return this.S.mode === 'hostile' || this.angry;
  }

  update(dt) {
    this.updateBase(dt);
    if (this.dead) return;
    if (this.attackCd > 0) this.attackCd -= dt;
    // Night monsters burn away in daylight.
    if (this.S.night && this.game.isDay() && this.rng.chance(dt * 0.08)) {
      this.game.renderer.emit(this.x, this.y + 1, this.z, { n: 10, color: ['#c8c8c8', '#8a8a8a'], up: 30, life: 0.8 });
      this.dead = true;
      return;
    }
    if (this.moving) return;
    // Staggered by a blow (an amethyst-set blade).
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
        this.face(t.x, t.z);
        this.attackCd = 1.2;
        this.doAction(0.3);
        game.damage(t, this.S.dmg, this);
        return;
      }
    }
    if (this.hostileNow && !this.tie) {
      if (!this.target || this.target.dead || this.distTo(this.target) > this.S.aggro * 2) this.target = game.findPrey(this, this.S.aggro || 6);
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
      const t = game.nearestThreatTo(this, 5);
      if (t) {
        const dx = Math.sign(this.x - t.x) || (this.rng.chance(0.5) ? 1 : -1);
        const dz = Math.sign(this.z - t.z) || (this.rng.chance(0.5) ? 1 : -1);
        const opts = this.rng.chance(0.5) ? [[dx, 0], [0, dz]] : [[0, dz], [dx, 0]];
        for (const [ox, oz] of opts) if (this.tryStep(this.x + ox, this.z + oz, this.S.step * 0.7)) return;
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
    const w = this.game.world;
    const ny = w.stepTarget(this.x, this.y, this.z, nx, nz, false);
    if (ny < 0 || this.game.occupiedBySolid(nx, ny, nz, this)) return false;
    // Wildlife avoids settlements' insides and deep water.
    if (w.isWaterAt(nx, ny, nz) && this.species !== 'slime') return false;
    this.face(nx, nz);
    this.startMove(nx, ny, nz, dur);
    return true;
  }

  chase(dt) {
    const t = this.target;
    const d = this.distTo(t);
    if (d <= 1 && Math.abs(t.y - this.y) <= 1) {
      this.face(t.x, t.z);
      if (this.attackCd <= 0) {
        this.attackCd = 1.0;
        this.doAction(0.3);
        this.game.damage(t, this.S.dmg, this);
      }
      return;
    }
    if (!this.path || this.pathI >= this.path.length || this.thinkT <= 0) {
      this.thinkT = 0.8;
      if (!this.game.requestPathBudget()) return;
      this.path = findPath(this.game.world, this.x, this.y, this.z, t.x, t.y, t.z, { maxNodes: 600, near: 1, partial: true });
      this.pathI = 0;
      if (!this.path || !this.path.length) {
        this.path = null;
        return;
      }
    }
    const [nx, , nz] = this.path[this.pathI];
    if (this.tryStep(nx, nz, this.S.step)) this.pathI++;
    else this.path = null;
  }

  onHurt(attacker) {
    if (this.S.mode === 'neutral') {
      this.angry = true;
      this.target = attacker;
    } else if (this.S.mode === 'hostile') this.target = attacker;
    else this.thinkT = 0;
  }
}
