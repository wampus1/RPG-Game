// The player: tile-by-tile movement, belt/inventory, mining, placing,
// attacking and tossing items.
import { Entity } from './entity.js';
import { PLAYER_STEP_TIME, INV_SIZE } from '../config.js';
import { makeSlots, addItem } from '../game/inventory.js';
import { ITEMS } from '../world/items.js';
import { BLOCKS, LEAVES } from '../world/blocks.js';

const BASE_HP = 20;
export const VIGOR_CAP = 8;

const MOVE_KEYS = {
  KeyW: [0, -1], ArrowUp: [0, -1], KeyS: [0, 1], ArrowDown: [0, 1],
  KeyA: [-1, 0], ArrowLeft: [-1, 0], KeyD: [1, 0], ArrowRight: [1, 0],
};

export class Player extends Entity {
  constructor(game, x, y, z) {
    super(game, x, y, z);
    this.kind = 'player';
    this.name = 'You';
    this.hp = this.maxHp = 20;
    this.inv = makeSlots(INV_SIZE);
    this.selected = 0;
    this.rot = 0;
    this.layerMode = null; // null = AUTO, else offset from feet level
    this.attackCd = 0;
    this.regenT = 0;
    this.spawn = { x, y, z };
    this.look = {
      skin: '#e8b48c', hair: '#6e4424', hairStyle: 'short', shirt: '#2f6f8f', pants: '#3a3a4a', shoes: '#2a1a10',
      outfit: 'hunter', accent: '#c83a32', hat: null,
    };
    this.bumpT = 0;
    this.sitting = null;
    this.sleeping = false;
    this.wellFed = 0;
    // Hardiness earned on the road: each new well drunk from and each
    // village slept in adds a little to your health (up to a limit each).
    this.vigor = { wells: [], villages: [] };
  }

  recalcMaxHp() {
    const v = this.vigor;
    this.maxHp = BASE_HP + Math.min(VIGOR_CAP, v.wells.length) + Math.min(VIGOR_CAP, v.villages.length);
    this.hp = Math.min(this.hp, this.maxHp);
  }

  // Returns true if this is a new source of hardiness (and still counts).
  addVigor(kind, key) {
    const list = this.vigor[kind];
    if (list.includes(key)) return false;
    list.push(key);
    if (list.length > VIGOR_CAP) return false;
    this.recalcMaxHp();
    return true;
  }

  heldItem() {
    const s = this.inv[this.selected];
    return s ? s.item : null;
  }

  heldDef() {
    const k = this.heldItem();
    return k ? ITEMS[k] : null;
  }

  get lightLevel() {
    const k = this.heldItem();
    return k === 'torch' ? 11 : k === 'lantern' ? 12 : k === 'campfire' ? 8 : 0;
  }

  give(key, count) {
    return addItem(this.inv, key, count);
  }

  update(dt, input, blocked) {
    this.updateBase(dt);
    if (this.attackCd > 0) this.attackCd -= dt;
    if (this.bumpT > 0) this.bumpT -= dt;
    // Slow natural regeneration: faster when sitting or well fed.
    this.regenT += dt;
    if (this.wellFed > 0) this.wellFed -= dt;
    const every = (this.wellFed > 0 ? 2.5 : 6) / (this.sitting ? 2 : 1);
    if (this.regenT > every && this.hp < this.maxHp && this.hp > 0) {
      this.regenT = 0;
      this.hp = Math.min(this.maxHp, this.hp + 1);
    }
    if (this.dead || this.moving || blocked) return;
    // Most recently pressed held direction wins.
    let d = null;
    if (input.lastMoveKey && input.isDown(input.lastMoveKey)) d = MOVE_KEYS[input.lastMoveKey];
    else for (const k in MOVE_KEYS) if (input.isDown(k)) d = MOVE_KEYS[k];
    if (!d) return;
    this.sitting = null;
    const [dx, dz] = d;
    this.dir = dx < 0 ? 1 : dx > 0 ? 3 : dz < 0 ? 2 : 0;
    const nx = this.x + dx;
    const nz = this.z + dz;
    const w = this.game.world;
    // Bumping into a closed door opens it.
    for (const yy of [this.y, this.y + 1]) {
      const id = w.getBlock(nx, yy, nz);
      if (BLOCKS[id].interact === 'door' && id !== undefined && BLOCKS[id].solid && !w.getState(nx, yy, nz)) {
        if (this.bumpT <= 0) {
          this.game.setDoor(nx, yy, nz, true);
          this.bumpT = 0.25;
        }
        return;
      }
    }
    const ny = w.stepTarget(this.x, this.y, this.z, nx, nz, false);
    if (ny < 0) return;
    const other = this.game.occupiedBySolid(nx, ny, nz, this);
    if (other) {
      // Nudge past a villager who is just standing in the way.
      if (other.kind === 'npc' && (other.state === 'routine' || other.state === 'hired') && !other.moving && !other.sleeping && other.x === nx && other.z === nz) {
        this.pushT = (this.pushT || 0) + dt;
        if (this.pushT < 0.35) return;
        this.pushT = 0;
        const from = { x: this.x, y: this.y, z: this.z };
        this.startMove(nx, ny, nz, PLAYER_STEP_TIME * 1.3);
        other.teleport(from.x, from.y, from.z);
        other.face(nx, nz);
        other.atGoal = false;
        other.path = null;
        if (Math.random() < 0.3) other.say(Math.random() < 0.5 ? 'Oh! Excuse me.' : 'Pardon.', 1.5);
        this.game.onPlayerStep(nx, ny, nz, false);
      }
      return;
    }
    this.pushT = 0;
    const sprint = input.isDown('ShiftLeft') || input.isDown('ShiftRight');
    const water = w.isWaterAt(nx, ny, nz);
    const leafy = LEAVES.has(w.getBlock(nx, ny, nz)) || LEAVES.has(w.getBlock(nx, ny + 1, nz));
    this.startMove(nx, ny, nz, PLAYER_STEP_TIME * (sprint ? 0.62 : 1) * (water ? 1.9 : 1) * (ny !== this.y ? 1.15 : 1) * (leafy ? 1.35 : 1));
    if (leafy) this.game.rustle?.(nx, ny, nz);
    this.game.onPlayerStep(nx, ny, nz, water);
  }
}
