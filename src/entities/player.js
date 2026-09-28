// The player: tile-by-tile movement, belt/inventory, mining, placing,
// attacking and tossing items.
import { Entity } from './entity.js';
import { PLAYER_STEP_TIME, INV_SIZE } from '../config.js';
import { makeSlots, addItem } from '../game/inventory.js';
import { ITEMS, WEAR_SLOTS, ARMOR_CAP } from '../world/items.js';
import { BLOCKS, LEAVES } from '../world/blocks.js';
import { has as heroHas, stepMult } from '../game/hero.js';

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
    // How you look underneath whatever you're wearing.
    this.baseLook = {
      skin: '#e8b48c', hair: '#6e4424', hairStyle: 'short', shirt: '#2f6f8f', pants: '#3a3a4a', shoes: '#2a1a10',
      outfit: 'hunter', accent: '#c83a32', hat: null,
    };
    // Armour and clothes worn: an item key (or nothing) for each place.
    this.equip = { head: null, body: null, legs: null, feet: null };
    this.bumpT = 0;
    this.sitting = null;
    this.sleeping = false;
    this.wellFed = 0;
    // Hardiness earned on the road: each new well drunk from and each
    // village slept in adds a little to your health (up to a limit each).
    this.vigor = { wells: [], villages: [] };
  }

  // What people see: your own looks with your armour and clothes on top.
  get look() {
    const key = WEAR_SLOTS.map((k) => this.equip[k] || '').join('|');
    if (this._look && this._lookBase === this.baseLook && this._lookKey === key) return this._look;
    const gear = {};
    let hat = this.baseLook.hat;
    for (const k of WEAR_SLOTS) {
      const it = this.equip[k] && ITEMS[this.equip[k]];
      if (!it) continue;
      if (k === 'head') hat = it.look;
      else gear[k] = it.look;
    }
    this._look = Object.keys(gear).length ? { ...this.baseLook, hat, gear } : { ...this.baseLook, hat };
    this._lookBase = this.baseLook;
    this._lookKey = key;
    return this._look;
  }

  set look(v) {
    const rest = { ...v };
    delete rest.gear;
    this.baseLook = rest;
  }

  // The share of each blow your armour takes off.
  armorValue() {
    let a = 0;
    for (const k of WEAR_SLOTS) a += (this.equip[k] && ITEMS[this.equip[k]]?.armor) || 0;
    return Math.min(ARMOR_CAP, a);
  }

  // Put on the armour or clothes in inventory slot i (what was worn there
  // goes back into the pack). Returns the place it went, or null.
  wear(i) {
    const s = this.inv[i];
    const it = s && ITEMS[s.item];
    if (!it || it.kind !== 'armor') return null;
    const old = this.equip[it.slot];
    this.equip[it.slot] = s.item;
    this.inv[i] = old ? { item: old, count: 1 } : s.count > 1 ? { item: s.item, count: s.count - 1 } : null;
    return it.slot;
  }

  // Take off what's worn in a place, into the pack (if there's room).
  unwear(slot) {
    const k = this.equip[slot];
    if (!k) return false;
    if (addItem(this.inv, k, 1)) return false;
    this.equip[slot] = null;
    return true;
  }

  recalcMaxHp() {
    const v = this.vigor;
    this.maxHp = Math.max(8, BASE_HP + (this.hpBonus || 0)) + Math.min(VIGOR_CAP, v.wells.length) + Math.min(VIGOR_CAP, v.villages.length);
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
    const g = this.game;
    const morning = g.minute >= 300 && g.minute < 600 && heroHas(g.hero, 'early_riser');
    const every = (this.wellFed > 0 ? 2.5 : 6) / (this.sitting ? 2 : 1) / (morning ? 2 : 1);
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
    const swim = water && !heroHas(this.game.hero, 'swimmer') ? 1.9 : 1;
    this.startMove(nx, ny, nz, PLAYER_STEP_TIME * stepMult(this.game.hero) * (sprint ? 0.62 : 1) * swim * (ny !== this.y ? 1.15 : 1) * (leafy ? 1.35 : 1));
    if (leafy) this.game.rustle?.(nx, ny, nz);
    this.game.onPlayerStep(nx, ny, nz, water);
  }
}
