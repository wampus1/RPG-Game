// The player: tile-by-tile movement, belt/inventory, mining, placing,
// attacking and tossing items.
import { Entity } from './entity.js';
import { tickDishes, dishFx } from '../game/cooking.js';
import { PLAYER_STEP_TIME, INV_SIZE, GROUND } from '../config.js';
import { makeSlots, addItem } from '../game/inventory.js';
import { ITEMS, WEAR_SLOTS, ARMOR_CAP, twoHanded, offhandOk, offhandLight } from '../world/items.js';
import { offhandOf } from '../game/combat.js';
import { BLOCKS, LEAVES } from '../world/blocks.js';
import { has as heroHas, stepMult, WING_BACK } from '../game/hero.js';
import { steer, STORM_WALL } from './raft.js';
import { deckUpdate, tryBoardStep } from '../game/ships3d.js';
import { stepModMult, gearHp, lanternLight, landArmorTick } from '../game/mods.js';
import { rule } from '../mod/rules.js';

const BASE_HP = 20;

// Breath a running stride costs: a little whole (a long run on fresh legs),
// rising steeply with your wounds (half your health gone, it's six times
// as much; near dead, a dozen strides and you're done).
export function sprintCost(p) {
  const hurt = Math.max(0, 1 - Math.max(0, p.hp) / Math.max(1, p.maxHp));
  return 0.025 + 0.3 * Math.pow(hurt, 1.3);
}
export const VIGOR_CAP = 8;
export const BLUE_CAP = 6; // three blue hearts at most
// Sprinting: a step takes this much of the time (nearly half again as
// quick as walking).
export const SPRINT_STEP = 0.68;

// A step across the screen as a step in the world, for a camera turned by
// `view` quarter turns (the renderer's toWorld, for directions).
export function screenToWorld(du, dv, view) {
  switch (view) {
    case 1: return [dv, 0 - du];
    case 2: return [0 - du, 0 - dv];
    case 3: return [0 - dv, du];
    default: return [du, dv];
  }
}

const MOVE_KEYS = {
  KeyW: [0, -1], ArrowUp: [0, -1], KeyS: [0, 1], ArrowDown: [0, 1],
  KeyA: [-1, 0], ArrowLeft: [-1, 0], KeyD: [1, 0], ArrowRight: [1, 0],
};

export class Player extends Entity {
  constructor(game, x, y, z) {
    super(game, x, y, z);
    this.kind = 'player';
    this.name = 'You';
    this.hp = this.maxHp = rule('hearts') * 2;
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
    this.blue = { hp: 0, day: 0, from: [] };
  }

  // What people see: your own looks with your armour and clothes on top.
  get look() {
    // (A two-handed weapon out: the shield's slung on the back, out of sight.)
    const slung = twoHanded(this.heldItem());
    const key = WEAR_SLOTS.map((k) => this.equip[k] || '').join('|') + (slung ? '|2h' : '');
    if (this._look && this._lookBase === this.baseLook && this._lookKey === key) return this._look;
    const gear = {};
    let hat = this.baseLook.hat;
    for (const k of WEAR_SLOTS) {
      const it = this.equip[k] && ITEMS[this.equip[k]];
      if (!it) continue;
      if (k === 'head') hat = it.look;
      else if (k === 'shield' && (!it.block || it.kind !== 'armor' || slung)) continue;
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
    // (A one-handed blade can go in the off hand, where a shield would.)
    const slot = it && it.kind === 'armor' ? it.slot : offhandOk(s && s.item) ? 'shield' : null;
    if (!slot) return null;
    const old = this.equip[slot];
    this.equip[slot] = s.item;
    this.inv[i] = old ? { item: old, count: 1 } : s.count > 1 ? { item: s.item, count: s.count - 1 } : null;
    // (Hale armour: health with it.)
    this.recalcMaxHp();
    return slot;
  }

  // Take off what's worn in a place, into the pack (if there's room).
  unwear(slot) {
    const k = this.equip[slot];
    if (!k) return false;
    if (addItem(this.inv, k, 1)) return false;
    this.equip[slot] = null;
    this.recalcMaxHp();
    return true;
  }

  recalcMaxHp() {
    // (Round 66: the hearts the world's mods start you with.)
    const base = rule('hearts') * 2;
    this.maxHp = Math.max(Math.min(8, base), (base === 20 ? BASE_HP : base) + (this.hpBonus || 0) + gearHp(this));
    this.hp = Math.min(this.hp, this.maxHp);
  }

  // Blue hearts: extra health for the rest of the day (from a new well or
  // a night in a village), used up first and gone at midnight.
  addBlue(n, key = null, cap = BLUE_CAP) {
    const day = this.game.day;
    if (this.blue.day !== day) this.blue = { hp: 0, day, from: [] };
    if (key && this.blue.from.includes(key)) return 0;
    if (key) this.blue.from.push(key);
    const before = this.blue.hp;
    this.blue.hp = Math.max(this.blue.hp, Math.min(cap, this.blue.hp + n));
    return this.blue.hp - before;
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

  // On a raft you float with it, smoothly, sitting on top.
  renderPos() {
    if (this.raft) return { x: this.raft.x, y: GROUND, z: this.raft.z };
    return super.renderPos();
  }

  heldItem() {
    const s = this.inv[this.selected];
    return s ? s.item : null;
  }

  heldDef() {
    const k = this.heldItem();
    return k ? ITEMS[k] : null;
  }

  // A second blade carried in the off hand (see combat.offhandOf).
  // Or a light carried there: a torch, a lantern, the Everlight.
  offhandItem() {
    if (this.sleeping || this.raft) return null;
    const blade = offhandOf(this);
    if (blade) return blade;
    const k = this.equip && this.equip.shield;
    return offhandLight(k) && !twoHanded(this.heldItem()) && !this.submerged ? k : null;
  }

  // A torch (or lantern) in either hand: what kind of light you carry
  // ('fire' can be snuffed; the Kavorent's 'cold' light can't).
  heldLightKind() {
    const keys = [this.heldItem(), this.equip && this.equip.shield];
    if (keys.includes('kav_everlight')) return 'cold';
    if (keys.some((k) => k === 'torch' || k === 'lantern' || k === 'campfire')) return this.snuffT > 0 ? null : 'fire';
    return null;
  }

  // A torch put out (a gloom moth): dark a while, till it catches again.
  snuff(secs = 6) {
    if (this.heldLightKind() !== 'fire') return false;
    this.snuffT = secs;
    this.game.renderer.emit(this.x, this.y + 1.4, this.z, { n: 8, color: ['#5a5058', '#3a3438', '#8a8088'], up: 16, speed: 10, gravity: -14, life: 1, shape: 'puff', oy: -8 });
    this.game.ui.msg('Your torch gutters out!', '#c8b0a0', true);
    this.game.audio?.play('torch', this);
    this.game.lightDirty = true;
    return true;
  }

  get lightLevel() {
    const k = this.heldItem();
    const off = this.equip && this.equip.shield;
    const lamp = (q) => (q === 'torch' ? 11 : q === 'lantern' ? 12 : q === 'campfire' ? 8 : q === 'kav_everlight' ? 13 : 0);
    // (A torch snuffed out gives nothing till it catches again; the
    // Everlight never goes out.)
    const fire = (q) => (this.snuffT > 0 && q !== 'kav_everlight' ? 0 : lamp(q));
    // (A dish that has you glowing: see game/cooking.js.)
    const held = Math.max(fire(k), fire(off), dishFx(this, 'light') > 0 ? 6 : 0);
    // (Moonstone in your armour: a soft light all your own.)
    const moon = WEAR_SLOTS.some((s) => s !== 'shield' && this.equip[s] && ITEMS[this.equip[s]]?.socket === 'moonstone') ? 8 : 0;
    // (Round 68: a Lantern-lit piece about you, Hollowmark's.)
    return Math.max(held, moon, lanternLight(this));
  }

  give(key, count) {
    return addItem(this.inv, key, count);
  }

  // Walked into something you could climb, or squeeze through, if it
  // weren't for one block: said once in a while.
  // (Round 78) Climbing a ladder (see blocks.ladder): pressing toward the
  // wall it's on takes you up a rung (to the next ladder above, while there
  // is one: at the top, the step onto the wall's top is an ordinary one),
  // away from it, down (while there's ladder under you). True if you went.
  climb(dx, dz) {
    const w = this.game.world;
    const here = BLOCKS[w.getBlock(this.x, this.y, this.z)];
    if (!here || !here.ladder) return false;
    const d = w.getMeta(this.x, this.y, this.z) & 3;
    const tx = [0, -1, 0, 1][d];
    const tz = [1, 0, -1, 0][d];
    const dur = PLAYER_STEP_TIME * 1.5;
    if (dx === tx && dz === tz) {
      const up = BLOCKS[w.getBlock(this.x, this.y + 1, this.z)];
      const over = BLOCKS[w.getBlock(this.x, this.y + 2, this.z)];
      if (!up || !up.ladder || (over && over.solid)) return false;
      this.dir = d;
      this.startMove(this.x, this.y + 1, this.z, dur);
      this.game.onPlayerStep?.(this.x, this.y, this.z, false);
      return true;
    }
    if (dx === -tx && dz === -tz) {
      const down = BLOCKS[w.getBlock(this.x, this.y - 1, this.z)];
      if (!down || !down.ladder) return false;
      this.dir = d;
      this.startMove(this.x, this.y - 1, this.z, dur * 0.8);
      this.game.onPlayerStep?.(this.x, this.y, this.z, false);
      return true;
    }
    return false;
  }

  blockedHint(nx, nz) {
    const w = this.game.world;
    const solid = (x, y, z) => BLOCKS[w.getBlock(x, y, z)].solid;
    this.hintT = this.hintT || 0;
    if (this.hintT > 0) return;
    let text = null;
    // A step up, but a block over your head.
    if (w.canStand(nx, this.y + 1, nz) && solid(this.x, this.y + 2, this.z)) text = 'There\'s a block over your head, so you can\'t climb up. Hold Shift and dig at the step to clear the way up.';
    // A step up, a block over it.
    else if (BLOCKS[w.getBlock(nx, this.y, nz)].standable && !solid(nx, this.y + 1, nz) && solid(nx, this.y + 2, nz)) text = 'Too low to climb onto. Hold Shift and dig at the step to clear the block over it.';
    // A gap only one block high.
    else if (!solid(nx, this.y, nz) && solid(nx, this.y + 1, nz) && BLOCKS[w.getBlock(nx, this.y - 1, nz)].standable) text = 'Too low to get through: dig the block at your feet there, and the one over it goes with it.';
    // (Round 73: not said. The player can see it for themselves.)
    if (!text) return;
    this.hintT = 8;
  }

  update(dt, input, blocked) {
    this.updateBase(dt);
    // A fallen star's wing, spent on a roll: filling back in.
    if (this.wing && this.wing.k < 1) {
      this._wingT = (this._wingT || 0) + dt;
      this.wing.k = Math.min(1, Math.floor((this._wingT / WING_BACK) * 25) / 25);
      if (this.wing.k >= 1) {
        this._wingT = 0;
        this.game.renderer?.emit(this.x, this.y + 1.4, this.z, { n: 10, color: ['#a8dcff', '#e0f4ff', '#ffffff'], up: 14, speed: 18, life: 0.7, gravity: -8, glow: true });
        this.game.audio?.play('heal', this);
      }
    }
    // (The streak of light a wing's roll leaves: see Renderer.drawTumble.)
    if (this.wingDash > 0) this.wingDash = Math.max(0, this.wingDash - dt);
    // (Round 51) A pipe on the go: a puff of smoke off you now and then,
    // curling up and drifting, the bowl glowing as you draw on it.
    if (this.smokeT > 0) {
      this.smokeT -= dt;
      this.smokePuff = (this.smokePuff || 0) - dt;
      if (this.smokePuff <= 0 && this.game && this.game.renderer) {
        this.smokePuff = 0.45 + Math.random() * 0.5;
        const r = this.game.renderer;
        r.emit(this.x, this.y + 1.55, this.z, { n: 2 + (Math.random() < 0.4 ? 1 : 0), color: ['#d8d8e0', '#b8b8c4', '#e8e8ee'], up: 14, speed: 5, life: 1.8, gravity: -6, shape: 'puff', grow: 1.4, oy: -3 });
        if (Math.random() < 0.5) r.emit(this.x, this.y + 1.45, this.z, { n: 1, color: ['#ff8a30', '#ffc860'], up: 2, speed: 2, life: 0.35, glow: true, oy: -2 });
      }
    }
    // Dishes eaten, working through you (see game/cooking.js).
    tickDishes(this.game, this, dt);
    // (Round 68) Jade-set armour mending you; Rune-cut armour's ward.
    landArmorTick(this.game, this, dt);
    // (Hale armour put on or taken off, however it was: health with it.)
    const hale = gearHp(this);
    if (hale !== (this._haleHp || 0)) {
      this._haleHp = hale;
      this.recalcMaxHp();
    }
    if (this.attackCd > 0) this.attackCd -= dt;
    if (this.bumpT > 0) this.bumpT -= dt;
    // (Soaked through by the Condenser's rain: drying off.)
    if (this.soakT > 0) this.soakT -= dt;
    if (this.hintT > 0) this.hintT -= dt;
    // Down on one knee (a bout lost): up again in a few seconds.
    if (this.kneelT > 0) {
      this.kneelT -= dt;
      if (this.kneelT <= 0) this.game.ui.msg('You get back on your feet.', '#c8d8ff', true);
    }
    if (this.snuffT > 0) {
      this.snuffT -= dt;
      if (this.snuffT <= 0) {
        this.game.ui.msg('Your torch catches again.', '#ffd080', true);
        this.game.lightDirty = true;
      }
    }
    // No wound closes on its own: food, potions, a herbalist, a night's
    // sleep (or a stone) mend you. Only a delightful meal keeps on doing
    // you good a while after (a heart every few seconds while it lasts).
    // (Round 71: worms in you, the Alinelidan's, slow it: see afflict.js.)
    const wk = this.worms > 0 ? Math.max(0.25, 1 - 0.25 * this.worms) : 1;
    if (this.wellFed > 0) {
      this.wellFed -= dt;
      this.regenT = this.hp < this.maxHp ? this.regenT + dt * wk : 0;
      if (this.regenT > (this.sitting ? 2 : 4) && this.hp < this.maxHp && this.hp > 0) {
        this.regenT = 0;
        this.hp = Math.min(this.maxHp, this.hp + 1);
      }
    } else this.regenT = 0;
    // (Round 66) Health coming back on its own, where the world's mods
    // have it so.
    const rg = rule('regen');
    if (rg > 0 && this.hp > 0 && !this.dead && this.hp < this.maxHp) {
      this.ruleRegenT = (this.ruleRegenT || 0) + dt;
      if (this.ruleRegenT >= rg) {
        this.ruleRegenT = 0;
        this.hp = Math.min(this.maxHp, this.hp + 1);
      }
    }
    // A hot meal working through you: a heart at a time.
    const sh = this.slowHeal;
    if (sh && sh.left > 0 && this.hp > 0 && !this.dead) {
      sh.acc += sh.rate * dt * wk;
      while (sh.acc >= 1 && sh.left > 0) {
        sh.acc -= 1;
        sh.left -= 1;
        if (this.hp < this.maxHp) {
          this.hp = Math.min(this.maxHp, this.hp + 1);
          this.quietHeal = true;
          this.game.renderer.emit(this.x, this.y + 1.2, this.z, { n: 3, color: ['#80e070', '#c0ffa0'], up: 14, speed: 6, gravity: -8, life: 0.7, glow: true });
        }
      }
      if (sh.left <= 0) this.slowHeal = null;
    }
    // The day ends: blue hearts break.
    if (this.blue.hp > 0 && this.blue.day !== this.game.day) {
      this.blue = { hp: 0, day: this.game.day, from: [] };
      this.game.ui.msg('Your blue hearts fade with the new day.', '#80a8ff');
    }
    // Aboard one of the great ships: walking her deck, or at her wheel or
    // a gun (see game/ships3d.js).
    if (this.deck) {
      if (!this.dead) deckUpdate(this.game, this, dt, input, blocked);
      return;
    }
    // Out on a raft: paddling, not walking.
    if (this.raft) {
      if (!this.dead && !blocked) steer(this, dt, input);
      return;
    }
    if (this.dead || this.moving || blocked) return;
    // Held fast (a drowned one's grab): no walking off, only rolling free.
    if (this.grabbedT > 0) {
      this.grabbedT -= dt;
      return;
    }
    // (Round 53: feet stuck fast, a dish's doing: see dishacts.js.)
    if (this.rootT > 0) return;
    // Mid-roll, or staggered (a heavy blow, a broken guard): no steering.
    // (Nor while a blow of your own is coming round: you're committed.)
    if (this.rollT > 0 || this.stunT > 0 || this.guardBroken > 0 || this.swing || this.commitT > 0 || this.tunnel) return;
    // Most recently pressed held direction wins.
    let d = null;
    if (input.lastMoveKey && input.isDown(input.lastMoveKey)) d = MOVE_KEYS[input.lastMoveKey];
    else for (const k in MOVE_KEYS) if (input.isDown(k)) d = MOVE_KEYS[k];
    if (!d) return;
    // (Mesmerised: your feet go the wrong way. See afflict.js.)
    if (this.mazeT > 0) d = [-d[0], -d[1]];
    // (Round 78: on a rope, you go up it, not about.)
    if (this._grapple) return;
    this.sitting = null;
    // Sat in the back of a wagon: moving climbs you down.
    if (this.inWagon) {
      // (Round 78: not off a coach or a ferry under way, by walking.)
      if (this._ride) return;
      this.game.riding.climbOut();
      return;
    }
    // Keys move you across the screen, whichever way the camera is turned.
    const [dx, dz] = screenToWorld(d[0], d[1], this.game.renderer?.view || 0);
    // (Drawing a bow, you keep facing your mark as you step.)
    if (!this.bowDraw) this.dir = dx < 0 ? 1 : dx > 0 ? 3 : dz < 0 ? 2 : 0;
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
      // A shut city gate: see whether you'll be let through.
      if (BLOCKS[id].interact === 'gate' && BLOCKS[id].solid && !w.getState(nx, yy, nz)) {
        if (this.bumpT <= 0) {
          this.game.useGate(nx, yy, nz);
          this.bumpT = 1.5;
        }
        return;
      }
    }
    // (Round 78) On a ladder: toward its wall, up it; away, down it.
    if (this.climb(dx, dz)) return;
    // Onto a ship's deck, from a pier or up her side out of the water.
    if (this.game.ships3d && this.game.ships3d.length && tryBoardStep(this.game, this, nx, nz)) return;
    // (Round 77) On foot, out into water two deep: swimming.
    const ny = w.stepTarget(this.x, this.y, this.z, nx, nz, false, !this.mount && !this.raft);
    if (ny < 0) {
      this.blockedHint(nx, nz);
      return;
    }
    const other = this.game.occupiedBySolid(nx, ny, nz, this);
    if (other) {
      // Nudge past a villager who is just standing in the way.
      // (Or one of a story's own walking with you, or on their way: a
      // captive you're leading home, a lost child. Not one in a cage.)
      const company = other.state === 'saga' && other.saga && (other.saga.follow || other.saga.homeward || other.saga.seek);
      if (other.kind === 'npc' && (other.state === 'routine' || other.state === 'hired' || company) && !other.moving && !other.sleeping && other.x === nx && other.z === nz) {
        this.pushT = (this.pushT || 0) + dt;
        if (this.pushT < 0.1) return;
        this.pushT = 0;
        // Squeeze past: you both slide, swapping places.
        const from = { x: this.x, y: this.y, z: this.z };
        const dur = PLAYER_STEP_TIME * 1.15;
        this.startMove(nx, ny, nz, dur);
        other.startMove(from.x, from.y, from.z, dur);
        other.face(nx, nz);
        other.atGoal = false;
        other.path = null;
        if (Math.random() < 0.3) other.say(Math.random() < 0.5 ? 'Oh! Excuse me.' : 'Pardon.', 1.5);
        this.game.onPlayerStep(nx, ny, nz, false);
      }
      return;
    }
    this.pushT = 0;
    // Running costs breath: hardly any whole, and the more you're hurt, the
    // quicker it goes (out of breath, you can only walk).
    let sprint = (input.isDown('ShiftLeft') || input.isDown('ShiftRight')) && !this.mount && !this.blocking;
    if (sprint && (this.stamina ?? 10) < 0.4) sprint = false;
    if (sprint) {
      this.stamina = Math.max(0, (this.stamina ?? 10) - sprintCost(this));
      this.restT = 0;
    }
    // (Swimming out into the storm round the islands: it throws you back.)
    if (w.ow && w.ow.stormAt(nx, nz) > STORM_WALL && w.ow.stormAt(nx, nz) >= w.ow.stormAt(this.x, this.z)) {
      this.game.stormTurnsBack?.(false);
      return;
    }
    const water = w.isWaterAt(nx, ny, nz);
    const leafy = LEAVES.has(w.getBlock(nx, ny, nz)) || LEAVES.has(w.getBlock(nx, ny + 1, nz));
    const swim = (water && !heroHas(this.game.hero, 'swimmer') ? (heroHas(this.game.hero, 'poor_swimmer') ? 2.35 : 1.9) : 1) * (water && w.isWaterAt(nx, ny - 1, nz) ? 1.25 : 1);
    // In the saddle or on the wagon's bench: quicker (and no sprinting).
    const ride = this.mount ? this.game.riding.pace() : 1;
    // (Shield up: a slow, careful step, and no running.)
    const guard = this.blocking ? 1.7 : 1;
    // (Just up out of a roll: a little slower for a moment. An arrow on
    // the string: careful steps.)
    const recover = (this.rollRecover > 0 ? 1.45 : 1) * (this.bowDraw ? 1.6 : 1);
    this.startMove(nx, ny, nz, (PLAYER_STEP_TIME / rule('walk')) * stepMult(this.game.hero) * stepModMult(this) * (sprint && !this.mount && !this.blocking ? SPRINT_STEP : 1) * ride * swim * guard * recover * (ny !== this.y ? 1.15 : 1) * (leafy ? 1.35 : 1));
    if (leafy) this.game.rustle?.(nx, ny, nz);
    this.game.onPlayerStep(nx, ny, nz, water);
  }
}
