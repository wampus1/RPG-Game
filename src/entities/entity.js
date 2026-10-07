// Base class for everything that walks the grid tile by tile.
import { BLOCKS } from '../world/blocks.js';

let nextId = 1;

// (Round 73) The liquid underfoot, if it's one you wade (see wading).
const WADE = new Set(['acid_pool', 'quicksilver']);
export function wadeOf(world, x, y, z) {
  const b = world && world.getBlock ? BLOCKS[world.getBlock(x, y - 1, z)] : null;
  return b && WADE.has(b.name) ? b.name : null;
}

export class Entity {
  constructor(game, x, y, z) {
    this.id = nextId++;
    this.game = game;
    this.x = x;
    this.y = y;
    this.z = z;
    this.fx = x;
    this.fy = y;
    this.fz = z;
    this.moveT = 1;
    this.moveDur = 0.2;
    this.dir = 0;
    this.kind = 'entity';
    this.flash = 0;
    this.hp = 10;
    this.maxHp = 10;
    this.actionTimer = 0;
    this.actionDur = 0.25;
    this.bubble = null;
    this.emote = null;
    this.dead = false;
    this.solid = true;
    this.inWater = false;
    this.hop = 0;
    this.knock = null;
  }

  get moving() {
    return this.moveT < 1;
  }

  renderPos() {
    // (Round 73: under the ground with the Tooth: where the earth heaves
    // over you, for the camera and the light. See evolvedgear.tooth.)
    if (this.underAt) return { x: this.underAt.x, y: this.y, z: this.underAt.z };
    // (Aboard one of the great ships: carried with her, see ships3d.js.)
    if (this.deck && this.game && this.game.shipDeckPos) {
      const p = this.game.shipDeckPos(this);
      if (p) return p;
    }
    if (this.moveT >= 1) return { x: this.x, y: this.y, z: this.z };
    const t = this.moveT;
    // (Most moves ease in and out; a roll bursts away and slows at the end.)
    const e = this.moveEase === 'out' ? 1 - Math.pow(1 - t, 3) : t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    const dy = this.y - this.fy;
    // Climbing steps arc up a little; drops fall at the end.
    const yArc = dy > 0 ? Math.min(1, t * 1.6) * dy : dy < 0 ? (t > 0.45 ? (t - 0.45) / 0.55 : 0) * dy : 0;
    return {
      x: this.fx + (this.x - this.fx) * e,
      y: this.fy + yArc,
      z: this.fz + (this.z - this.fz) * e,
    };
  }

  startMove(nx, ny, nz, dur) {
    this.fx = this.x;
    this.fy = this.y;
    this.fz = this.z;
    this.moveEase = null;
    this.game.moveEntity(this, nx, ny, nz);
    this.moveT = 0;
    // (Chilled by frost: slower.)
    this.inWater = this.game.world.isWaterAt(nx, ny, nz);
    // (Round 73) Wading a liquid sunk in the floor (acid, quicksilver):
    // slower through it, and down in it to the shins.
    this.wading = wadeOf(this.game.world, nx, ny, nz);
    this.moveDur = (this.slowT > 0 ? dur * 1.7 : dur) * (this.wading ? 1.35 : 1);
  }

  teleport(x, y, z) {
    // (Off any ship they were aboard: see ships3d.js.)
    if (this.deck) this.deck = null;
    this.game.moveEntity(this, x, y, z);
    this.fx = x;
    this.fy = y;
    this.fz = z;
    this.moveT = 1;
    this.inWater = this.game.world.isWaterAt(x, y, z);
    this.wading = wadeOf(this.game.world, x, y, z);
  }

  updateBase(dt) {
    if (this.moveT < 1) this.moveT = Math.min(1, this.moveT + dt / this.moveDur);
    if (this.flash > 0) this.flash -= dt;
    if (this.actionTimer > 0) this.actionTimer -= dt;
    if (this.bubble) {
      this.bubble.t -= dt;
      if (this.bubble.t <= 0) this.bubble = null;
    }
    if (this.emote) {
      this.emote.t -= dt;
      if (this.emote.t <= 0) this.emote = null;
    }
    if (this.later) {
      this.later.delay -= dt;
      if (this.later.delay <= 0) {
        const l = this.later;
        this.later = null;
        this.say(l.text, l.t, l.color);
      }
    }
  }

  say(text, t = 3, color) {
    // (No colour given, or null: the usual one, drawn at the bubble.)
    this.bubble = { text, t, color: color || undefined };
  }

  // A reply a moment after someone else has spoken.
  sayLater(text, delay = 1, t = 3, color) {
    this.later = { text, delay, t, color };
  }

  emoteShow(ch, color = '#ffe070', t = 2) {
    this.emote = { ch, color, t };
  }

  doAction(dur = 0.25) {
    this.actionTimer = dur;
    this.actionDur = dur;
  }

  face(tx, tz) {
    const dx = tx - this.x;
    const dz = tz - this.z;
    if (dx === 0 && dz === 0) return;
    if (Math.abs(dx) > Math.abs(dz)) this.dir = dx < 0 ? 1 : 3;
    else this.dir = dz < 0 ? 2 : 0;
  }

  distTo(e) {
    return Math.max(Math.abs(e.x - this.x), Math.abs(e.z - this.z));
  }
}
