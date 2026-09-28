// Game orchestrator: owns the world, entities, time, input handling and the
// rules for interacting with blocks and creatures.
import {
  TILE, LH, VIEW_W, VIEW_H, WORLD_Y, REGION_W, REGION_D, GROUND, WATER_Y, REACH, BELT_SIZE,
  GAME_MINUTES_PER_SECOND, DAY_MINUTES, SETTLEMENT_ACTIVE_DIST,
} from '../config.js';
import { World } from '../world/world.js';
import { BLOCKS, B, META_STATE, LOGS, LEAVES } from '../world/blocks.js';
import { ITEMS, rollDrops, itemForBlock } from '../world/items.js';
import { CONTAINER_SIZE } from '../world/loot.js';
import { Player } from '../entities/player.js';
import { NPC } from '../entities/npc.js';
import { Creature, SPECIES } from '../entities/creature.js';
import { ItemDrop } from '../entities/itemdrop.js';
import { TREE_BUILDERS } from '../world/trees.js';
import { removeItem, makeSlots } from './inventory.js';
import { mulberry32, hash4 } from '../util/rng.js';
import { BIOMES } from '../world/biomes.js';
import { TEX } from '../render/textures.js';

const START_KIT = [
  ['wood_pickaxe', 1], ['wood_axe', 1], ['wood_sword', 1], ['torch', 12], ['planks', 32],
  ['cobblestone', 24], ['door', 2], ['chest', 1], ['bread', 5], ['workbench', 1], ['glass', 8], ['fence', 8],
];

export class Game {
  constructor({ seed, renderer, audio, ui, save = null }) {
    this.seed = seed >>> 0;
    this.renderer = renderer;
    this.audio = audio;
    this.ui = ui;
    this.world = new World(this.seed);
    this.world.onChange = (x, y, z, o, n) => this.onBlockChange(x, y, z, o, n);
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
      const s = ow.spawnSettlement;
      const L = s ? this.world.getLayout(s) : null;
      sx = L ? L.plaza.cx + 2 : Math.floor(ow.cells.length / 2);
      sz = L ? L.plaza.cz : 400;
      this.loadAround(sx, sz, true);
      const spot = this.findFreeSpot(sx, sz, GROUND);
      this.player = new Player(this, spot.x, spot.y, spot.z);
      this.moveEntity(this.player, this.player.x, this.player.y, this.player.z);
      for (const [k, n] of START_KIT) this.player.give(k, n);
      this.player.give('coin', 25);
    }
    this.loadAround(this.player.x, this.player.z, true);
    this.updateSettlements(true);
    ow.markExplored(this.player.x, this.player.z, 2);
  }

  // Nearest standable tile to (x, z), searching outward in rings.
  findFreeSpot(x, z, hint) {
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

  requestPathBudget() {
    if (this.pathBudget <= 0) return false;
    this.pathBudget--;
    return true;
  }

  occKey(x, y, z) {
    return x * 1048576 + z * 16 + y;
  }

  moveEntity(e, nx, ny, nz) {
    if (e.solid !== false) {
      const k = this.occKey(e.x, e.y, e.z);
      if (this.occ.get(k) === e) this.occ.delete(k);
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
    if (this.occ.get(k) === e) this.occ.delete(k);
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
    const x0 = Math.floor((r.camX - 64) / TILE);
    const x1 = Math.floor((r.camX + VIEW_W + 64) / TILE);
    const z0 = Math.floor((r.camY - 48) / TILE);
    const z1 = Math.floor((r.camY + VIEW_H + WORLD_Y * LH + 48) / TILE);
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
    const dead = this.deadNpcs.get(s.id) || new Set();
    const npcs = [];
    for (const rec of layout.npcs) {
      if (dead.has(rec.idx)) continue;
      const n = new NPC(this, rec, layout);
      n.placeForCurrentActivity();
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
    }
    this.active.set(s.id, { layout, npcs });
  }

  deactivate(s) {
    const a = this.active.get(s.id);
    if (!a) return;
    for (const n of a.npcs) {
      n.releaseSpot();
      this.removeOcc(n);
      n.dead = true;
      n.rec.hp = n.hp;
    }
    this.npcs = this.npcs.filter((n) => !a.npcs.includes(n));
    this.active.delete(s.id);
  }

  // ------------------------------------------------------------ main update
  update(dt, input) {
    this.dt = dt;
    this.pathBudget = 5;
    const ev = input.consume();
    const uiRes = this.ui.handle(ev, input, this);
    const blocked = this.ui.modal || this.player.dead;
    this.minute += dt * GAME_MINUTES_PER_SECOND * (this.sleepFast || 1);
    if (this.minute >= DAY_MINUTES) {
      this.minute -= DAY_MINUTES;
      this.day++;
    }
    if (this.sleepFast && this.minute > 6 * 60 && this.minute < 7 * 60) this.endSleep();
    if (!blocked) this.handleKeys(uiRes.pressed, uiRes.wheel, uiRes.wheelShift);
    this.player.update(dt, input, blocked);
    if (!blocked) this.updateCursor(input);
    else this.cursor = null;
    if (!blocked) this.handleMouse(dt, uiRes.clicks, input);
    else this.mining = null;
    this.streamRegions();
    if (Math.random() < 0.05) this.updateSettlements();
    this.world.ow.markExplored(this.player.x, this.player.z, 1);
    for (const n of this.npcs) {
      if (n.dead) continue;
      n.update(dt);
      n.maybeGreet(this.player, dt);
    }
    for (const c of this.creatures) c.update(dt);
    this.creatures = this.creatures.filter((c) => {
      if (c.dead) this.removeOcc(c);
      return !c.dead;
    });
    for (const d of this.drops) d.update(dt);
    this.pickupDrops();
    this.drops = this.drops.filter((d) => !d.dead);
    this.spawning(dt);
    this.updateWanted(dt);
    this.growPlants(dt);
    this.updateFishing(dt);
    this.updateWeather(dt);
    this.ambientFx(dt);
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 4);
    if (this.audio) this.audio.listener = this.player;
    // Entities visible this frame.
    const p = this.player;
    const vis = [p];
    for (const n of this.npcs) if (!n.dead && Math.abs(n.x - p.x) < 22 && Math.abs(n.z - p.z) < 24) vis.push(n);
    for (const c of this.creatures) if (Math.abs(c.x - p.x) < 22 && Math.abs(c.z - p.z) < 24) vis.push(c);
    for (const d of this.drops) if (Math.abs(d.x - p.x) < 22 && Math.abs(d.z - p.z) < 24) vis.push(d);
    this.visibleEntities = vis;
  }

  // ------------------------------------------------------------ keys
  handleKeys(pressed, wheel, wheelShift) {
    const p = this.player;
    for (const k of pressed) {
      const code = k.code;
      if (code.startsWith('Digit')) {
        const n = parseInt(code.slice(5), 10);
        if (n >= 1 && n <= BELT_SIZE) this.selectSlot(n - 1);
      }
      switch (code) {
        case 'KeyQ':
          this.toss(k.ctrl);
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
        case 'KeyE':
        case 'KeyF':
          if (code === 'KeyF' && p.heldDef()?.kind === 'food') this.eat();
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
    const mx = input.mouse.x;
    const my = input.mouse.y;
    if (this.ui.hitTest(mx, my)) {
      this.cursor = null;
      return;
    }
    const w = this.world;
    const wx = mx + r.camX;
    const wy = my + r.camY;
    let hit = null;
    if (p.layerMode !== null) {
      const L = p.y + p.layerMode;
      const x = Math.floor(wx / TILE);
      const z = Math.floor((wy + L * LH) / TILE);
      const id = w.getBlock(x, L, z);
      hit = { x, y: L, z, face: 'top', id, fixed: true };
    } else {
      let bestKey = -Infinity;
      const x = Math.floor(wx / TILE);
      for (let y = WORLD_Y - 1; y >= 0; y--) {
        const zt = Math.floor((wy + y * LH) / TILE);
        const zf = Math.floor((wy + y * LH - 16) / TILE);
        const frontIn = wy + y * LH - 16 - zf * TILE < LH;
        for (const [z, face] of [[zt, 'top'], ...(frontIn ? [[zf, 'front']] : [])]) {
          const id = w.getBlock(x, y, z);
          if (id === B.air || r.isHidden(x, y, z)) continue;
          // Blocks faded out because they hide the player can be clicked through.
          if (r.occlusionAlpha(x, y, z, p) < 0.6) continue;
          const b = BLOCKS[id];
          if (b.render === 'plant' || b.render === 'sprite' || b.render === 'flat' || b.render === 'fence' || (b.render === 'door' && w.getState(x, y, z))) {
            // Props: only the lower part of their cell counts.
            if (face === 'top' && wy + y * LH - zt * TILE < 4 && b.render !== 'flat') continue;
          }
          const k = z * 64 + y + (face === 'front' ? 0.5 : 0);
          if (k > bestKey) {
            bestKey = k;
            hit = { x, y, z, face, id };
          }
        }
      }
    }
    // Entity under the cursor takes priority.
    let ent = null;
    for (const e of this.visibleEntities) {
      if (e === p || e.kind === 'item' || e.dead) continue;
      const rp = e.renderPos();
      const sx = rp.x * TILE - r.camX;
      const feet = rp.z * TILE - rp.y * LH + LH - r.camY + 10;
      const h = e.kind === 'creature' ? 14 : 24;
      if (mx >= sx + 2 && mx < sx + 14 && my >= feet - h && my < feet + 2) {
        if (!ent || rp.z > ent.rp.z) ent = { e, rp };
      }
    }
    const reach = (x, y, z) => Math.max(Math.abs(x - p.x), Math.abs(z - p.z)) <= REACH && Math.abs(y - p.y) <= 4;
    const c = { mx, my };
    if (ent) {
      c.entity = ent.e;
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
        else t = { x: hit.x, y: hit.y, z: hit.z + 1 };
        const ok = this.canPlace(placeId, t.x, t.y, t.z) && reach(t.x, t.y, t.z);
        c.place = { ...t, id: placeId, rot: p.rot, ok };
      }
    }
    this.cursor = c;
  }

  attackReach() {
    const h = this.player.heldDef();
    return Math.max(1, Math.floor(h && h.reach ? h.reach : 1.4));
  }

  // ------------------------------------------------------------ mouse
  handleMouse(dt, clicks, input) {
    const p = this.player;
    const c = this.cursor;
    for (const ck of clicks) {
      if (ck.type === 'down' && ck.button === 0) {
        if (c && c.entity) {
          this.attack(c.entity);
          this.pending = null;
          continue;
        }
        const held = p.heldDef();
        if (c && c.place && (held.kind === 'block' || held.plant) && !(c.block && c.block.interact)) {
          this.tryPlace(c.place);
          this.placeRepeat = 0.25;
          this.pending = null;
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
      } else if (ck.type === 'down' && ck.button === 2) {
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
      } else if (c.block && c.inReach && (!c.block.interact || !this.pending || this.pending.t >= 0.25)) {
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
    if (c && c.entity && c.entity.kind === 'npc' && c.entity.distTo(p) <= 4) {
      this.talk(c.entity);
      return;
    }
    if (c && c.block && c.inReach && c.block.interact) {
      this.interact(c.x, c.y, c.z);
      return;
    }
    if (held && held.fishing && c && c.block && c.block.liquid && c.inReach) {
      this.castLine(c);
      return;
    }
    if (held && held.key === 'hoe' && c && c.block && c.inReach && [B.grass, B.dirt, B.grass_lush, B.grass_dry, B.grass_jungle, B.grass_taiga, B.path].includes(c.block.id) && this.world.getBlock(c.x, c.y + 1, c.z) === B.air) {
      this.world.setBlock(c.x, c.y, c.z, B.farmland);
      this.audio?.play('dig');
      return;
    }
    if (held && held.kind === 'food') {
      this.eat();
      return;
    }
    if (c && c.place && c.place.ok) this.tryPlace(c.place);
  }

  // ------------------------------------------------------------ mining
  breakTime(b) {
    if (!isFinite(b.hardness)) return Infinity;
    const h = this.player.heldDef();
    const good = h && h.tool && h.tool === b.tool;
    let t = b.hardness * 1.5 / (good ? h.speed : 1);
    if (b.tool === 'pick' && !good) t *= 3.5;
    return Math.max(0.08, t);
  }

  mineTick(dt, c) {
    const b = c.block;
    if (!isFinite(b.hardness) || b.liquid) {
      this.mining = null;
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
    } else {
      if (b.interact === 'container') {
        const slots = w.getContainer(x, y, z);
        for (const s of slots || []) if (s) drops.push({ ...s });
      }
      if (LOGS.has(id) && this.isTreeLog(x, y, z)) {
        this.fellTree(x, y, z, drops);
      } else {
        w.setBlock(x, y, z, B.air);
        drops.push(...rollDrops(id, rand));
      }
    }
    for (const d of drops) this.spawnDrop(d.item, d.count, x, y, z, true);
    this.renderer.emit(x, y, z, { n: 10, color: this.blockColor(id), up: 45, speed: 60, life: 0.6, oy: -6 });
    this.audio?.play('break');
    this.popUnsupported(x, y + 1, z);
    this.flowWater(x, y, z);
    if (byPlayer) {
      this.stats.mined++;
      this.checkVandalism(x, y, z, b);
    }
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
    const inBuilding = L.buildings.some((q) => x >= q.x0 && x <= q.x1 && z >= q.z0 && z <= q.z1);
    const civic = inBuilding || L.maskAt(x, z) === 1 || L.maskAt(x, z) === 5;
    if (!civic || b.render === 'plant') return;
    const witness = this.active.get(s.id).npcs.find((n) => !n.dead && !n.sleeping && n.state === 'routine' && n.distTo(this.player) <= 7);
    if (!witness) return;
    const v = (this.vandal.get(s.id) || 0) + 1;
    this.vandal.set(s.id, v);
    if (v >= 4) {
      this.vandal.set(s.id, 0);
      witness.say('That\'s it! GUARDS!', 3, '#ff9080');
      this.alertGuards(s.id, this.player, witness);
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
    if (id === B.wheat_crop && w.getBlock(x, y - 1, z) !== B.farmland) return false;
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
    const rot = b.rotatable ? p.rot : 0;
    const w = this.world;
    w.setBlock(t.x, t.y, t.z, id, rot | (b.lightWhenState ? META_STATE : 0));
    if (id === B.door) w.setBlock(t.x, t.y + 1, t.z, B.door_top, rot);
    if (b.interact === 'container') {
      const r = w.regionAt(t.x, t.z);
      const idx = ((t.z - r.z0) * REGION_W + (t.x - r.x0)) * WORLD_Y + t.y;
      r.containers.set(idx, makeSlots(CONTAINER_SIZE[b.name] || 9));
    }
    if (id === B.sapling) this.saplings.push({ x: t.x, y: t.y, z: t.z, t: 90 + Math.random() * 120 });
    slot.count--;
    if (slot.count <= 0) p.inv[p.selected] = null;
    p.doAction(0.2);
    p.face(t.x, t.z);
    this.audio?.play('place');
    this.stats.placed++;
    this.renderer.emit(t.x, t.y, t.z, { n: 4, color: this.blockColor(id), up: 15, life: 0.3, oy: -2 });
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

  interactFront() {
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
    switch (b.interact) {
      case 'door': {
        const open = w.getState(x, y, z);
        this.setDoor(x, y, z, !open);
        break;
      }
      case 'container': {
        const slots = w.getContainer(x, y, z);
        this.audio?.play('door');
        this.ui.openContainer(b.label, slots, { x, y, z });
        this.checkTheft(x, z);
        break;
      }
      case 'workbench':
        this.ui.openCrafting('workbench');
        break;
      case 'furnace':
        this.ui.openCrafting('furnace');
        break;
      case 'anvil':
        this.ui.openCrafting('anvil');
        break;
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
      case 'well':
        p.hp = Math.min(p.maxHp, p.hp + 2);
        this.ui.msg('You drink the cool well water. (+2 HP)', '#80c8ff');
        this.audio?.play('splash');
        break;
      case 'altar': {
        if (this.lastPrayDay === this.day) this.ui.msg('The altar is silent. Come back tomorrow.', '#c8c8c8');
        else {
          this.lastPrayDay = this.day;
          p.hp = p.maxHp;
          this.ui.msg('A warm light washes over you. Fully healed!', '#ffe8a0');
          this.renderer.emit(p.x, p.y + 1, p.z, { n: 20, color: ['#fff4c0', '#ffe070'], up: 40, life: 1, gravity: -20 });
        }
        break;
      }
      case 'sign':
        this.ui.openSign(this.signText(x, z));
        break;
      case 'bookshelf':
        this.ui.openBook(this.bookText(x, y, z));
        break;
      case 'grave':
        this.ui.msg(`Here lies ${this.graveName(x, z)}. Rest in peace.`, '#c8c8d8');
        break;
      case 'statue': {
        const s = this.world.ow.settlementAt(x, z);
        this.ui.msg(s && s.civ ? `A statue honoring the founders of the ${s.civ.name}.` : 'A weathered statue of a forgotten hero.', '#e8e0c8');
        break;
      }
    }
  }

  checkTheft(x, z) {
    const s = this.world.ow.settlementAt(x, z);
    if (!s || !this.active.has(s.id)) return;
    const L = this.active.get(s.id).layout;
    const bld = L.buildings.find((q) => x >= q.x0 && x <= q.x1 && z >= q.z0 && z <= q.z1);
    if (!bld) return;
    const owner = this.active.get(s.id).npcs.find((n) => !n.dead && !n.sleeping && (n.rec.home === bld.id || n.rec.work?.building === bld.id) && n.distTo(this.player) <= 6);
    if (owner) owner.say(owner.rec.personality.kindness > 0.6 ? 'Hey, that\'s ours! ...Take what you need, I suppose.' : 'Hands off my things!', 3.5, '#ffb080');
  }

  signText(x, z) {
    const s = this.world.ow.settlementAt(x, z);
    if (!s) return ['A weathered sign.', 'The writing has long faded.'];
    const L = this.world.getLayout(s);
    const lines = [`${s.name.toUpperCase()}`, `${cap(s.type)} of the ${s.civ ? s.civ.name : 'free folk'}`, `Population: ${L.npcs.filter((n) => !(this.deadNpcs.get(s.id)?.has(n.idx))).length}`, ''];
    const names = [...new Set(L.buildings.filter((b) => !b.residential).map((b) => b.name))];
    if (names.length) lines.push('Services: ' + names.slice(0, 5).join(', '));
    if (s.condition === 'abandoned') lines.push('', '...someone scrawled: "LEAVE WHILE YOU CAN"');
    else if (s.condition === 'poor') lines.push('', 'NOTICE: Bread rations reduced. By order.');
    else if (s.condition === 'prosperous') lines.push('', 'Market day every day! Travelers welcome.');
    const bounty = this.isWanted(s.id);
    if (bounty) lines.push('', 'WANTED: a dangerous stranger. Report to the guard.');
    return lines;
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
    return books[Math.floor(rand() * books.length)];
  }

  graveName(x, z) {
    const rand = mulberry32(hash4(x, z, this.seed, 3));
    const first = ['Aldo', 'Berta', 'Corin', 'Dela', 'Emrys', 'Fenna', 'Galt', 'Hesse', 'Ines', 'Jorn'][Math.floor(rand() * 10)];
    return `${first}, beloved by all`;
  }

  trySleep(x, y, z) {
    const h = this.minute / 60;
    this.player.spawn = { x: this.player.x, y: this.player.y, z: this.player.z };
    if (h >= 20 || h < 5) {
      this.ui.msg('You fall asleep... (spawn point set)', '#c8d8ff');
      this.sleepFast = 60;
      this.ui.fade = 1;
    } else this.ui.msg('You can only sleep at night. (spawn point set)', '#c8d8ff');
  }

  endSleep() {
    this.sleepFast = 0;
    this.player.hp = this.player.maxHp;
    // Villagers carry on with their day.
    for (const a of this.active.values()) for (const n of a.npcs) if (!n.dead && n.state === 'routine') {
      n.activity = null;
      n.wake();
      n.placeForCurrentActivity();
    }
    this.ui.msg('Good morning! You feel rested.', '#ffe8a0');
  }

  // Fishing: cast into water, wait for a bite, reel it in.
  castLine(c) {
    const p = this.player;
    if (this.fishing) {
      this.ui.msg('You reel in your line.', '#80c8ff');
      this.fishing = null;
      return;
    }
    p.face(c.x, c.z);
    p.doAction(0.35);
    this.fishing = { x: c.x, y: c.y, z: c.z, t: 2.5 + Math.random() * 5, px: p.x, pz: p.z };
    this.audio?.play('splash');
    this.renderer.emit(c.x, c.y, c.z, { n: 6, color: ['#8cc4f0', '#e0f4ff'], up: 25, life: 0.5, oy: 2 });
    this.ui.msg('You cast your line...', '#80c8ff');
  }

  updateFishing(dt) {
    const f = this.fishing;
    if (!f) return;
    const p = this.player;
    if (p.x !== f.px || p.z !== f.pz || !p.heldDef()?.fishing) {
      this.fishing = null;
      return;
    }
    f.t -= dt;
    if (Math.random() < dt * 2) this.renderer.emit(f.x, f.y, f.z, { n: 1, color: '#e0f4ff', up: 6, life: 0.4, oy: 2, spreadX: 2 });
    if (f.t > 0) return;
    const r = Math.random();
    const catchItem = r < 0.7 ? 'fish' : r < 0.8 ? 'string' : r < 0.9 ? 'bone' : r < 0.97 ? 'coin' : 'gem';
    const left = p.give(catchItem, 1);
    if (left) this.spawnDrop(catchItem, 1, p.x, p.y, p.z, true);
    this.ui.msg(catchItem === 'fish' ? 'Caught a fish!' : `You fished up: ${ITEMS[catchItem].name}!`, '#80e070');
    this.audio?.play('pickup');
    this.renderer.emit(f.x, f.y, f.z, { n: 10, color: ['#8cc4f0', '#e0f4ff', '#ffffff'], up: 45, life: 0.6, oy: 2 });
    p.doAction(0.3);
    this.fishing = null;
  }

  // Weather drifts between clear skies, rain, snow (in cold places) and fog.
  updateWeather(dt) {
    const w = this.weather || (this.weather = { kind: 'clear', t: 240, level: 0 });
    w.t -= dt;
    if (w.t <= 0) {
      const col = this.world.terrain.column(this.player.x, this.player.z, this.world.terrain.context(this.player.x, this.player.z, this.player.x, this.player.z), {});
      const cold = ['tundra', 'taiga', 'mountain'].includes(col.biome);
      const dry = col.biome === 'desert';
      const r = Math.random();
      w.kind = r < 0.55 || dry ? 'clear' : r < 0.85 ? (cold ? 'snow' : 'rain') : 'fog';
      w.t = 180 + Math.random() * 420;
      if (w.kind !== 'clear') this.ui.msg(w.kind === 'rain' ? 'It starts to rain.' : w.kind === 'snow' ? 'Snow begins to fall.' : 'A fog rolls in.', '#a0b8d0');
    }
    const target = w.kind === 'clear' ? 0 : 1;
    w.level += Math.sign(target - w.level) * Math.min(Math.abs(target - w.level), dt / 8);
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
    p.hp = Math.min(p.maxHp, p.hp + def.heal);
    slot.count--;
    if (slot.count <= 0) p.inv[p.selected] = null;
    p.doAction(0.3);
    this.audio?.play('eat');
    this.ui.msg(`Ate ${def.name}. (+${def.heal} HP)`, '#80e070');
  }

  talk(npc) {
    if (npc.sleeping) {
      npc.say('Zzz...', 2);
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
  swing() {
    const p = this.player;
    if (p.attackCd > 0) return;
    p.attackCd = 0.3;
    p.doAction(0.22);
    this.audio?.play('swing');
  }

  attack(target) {
    const p = this.player;
    if (p.attackCd > 0 || target.dead) return;
    const def = p.heldDef();
    const reach = this.attackReach();
    p.face(target.x, target.z);
    if (Math.max(Math.abs(target.x - p.x), Math.abs(target.z - p.z)) > reach || Math.abs(target.y - p.y) > 1) {
      this.swing();
      return;
    }
    p.attackCd = def && def.cooldown ? def.cooldown : 0.4;
    p.doAction(0.25);
    let dmg = def && def.damage ? def.damage : 1 + Math.random() * 1.2;
    const crit = Math.random() < 0.1;
    if (crit) dmg *= 1.8;
    this.damage(target, Math.max(1, Math.round(dmg)), p, crit);
    // Knockback.
    const kx = Math.sign(target.x - p.x);
    const kz = Math.sign(target.z - p.z);
    if (!target.moving && target.hp > 0 && (kx || kz) && !target.sleeping) {
      const nx = target.x + (Math.abs(kx) >= Math.abs(kz) ? kx : 0);
      const nz = target.z + (Math.abs(kx) >= Math.abs(kz) ? 0 : kz);
      const ny = this.world.stepTarget(target.x, target.y, target.z, nx, nz, false);
      if (ny >= 0 && !this.occupiedBySolid(nx, ny, nz, target)) target.startMove(nx, ny, nz, 0.12);
    }
  }

  damage(target, amount, source, crit = false) {
    if (target.dead) return;
    if (target.kind === 'npc' && target.rec.equipment.armor) amount = Math.max(1, Math.round(amount * (1 - target.rec.equipment.armor)));
    target.hp -= amount;
    target.flash = 0.12;
    this.renderer.floatText(target.x, target.y + 2, target.z, `${crit ? '!' : '-'}${amount}`, target.kind === 'player' ? '#ff5050' : crit ? '#ffe070' : '#ffffff');
    this.renderer.emit(target.x, target.y + 1, target.z, { n: 5, color: target.species === 'slime' ? ['#58c048', '#8ae070'] : target.kind === 'monster' ? ['#e8e4d4', '#b0aca0'] : ['#c82a2a', '#8a1a1a'], up: 30, speed: 50, life: 0.4, oy: -8 });
    this.audio?.play(target.kind === 'player' ? 'hurt' : 'hit', target);
    if (target.kind === 'player') {
      this.shake = Math.min(1, this.shake + 0.4);
      if (source && source.name) this.ui.msg(`${source.name} hits you for ${amount}!`, '#ff7060', true);
    }
    // Violence against villagers is a crime; witnesses react.
    if (target.kind === 'npc' && source) {
      target.onHurt(source);
      if (source.kind === 'player') this.crime(target);
      else this.witness(target, source);
    } else if (target.onHurt && source) target.onHurt(source);
    if (target.hp <= 0) this.kill(target, source);
  }

  crime(victim) {
    const sid = victim.settlement.id;
    const wasWanted = this.isWanted(sid);
    this.wanted.set(sid, Math.max(this.wanted.get(sid) || 0, 150));
    if (!wasWanted) {
      this.ui.msg(`You are now WANTED in ${victim.settlement.name}!`, '#ff5050');
      this.audio?.play('alarm');
    }
    this.witness(victim, this.player);
  }

  witness(victim, attacker) {
    const a = this.active.get(victim.settlement.id);
    if (!a) return;
    for (const n of a.npcs) {
      if (n === victim || n.dead || n.state !== 'routine') continue;
      if (n.distTo(victim) > 8) continue;
      n.react(attacker, true);
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
    if (threat.kind === 'player') {
      if (!this.isWanted(sid)) this.ui.msg('The guards have been called!', '#ff7060');
      this.wanted.set(sid, Math.max(this.wanted.get(sid) || 0, 150));
    }
    if (Math.max(Math.abs(caller.x - this.player.x), Math.abs(caller.z - this.player.z)) < 20) this.audio?.play('alarm');
  }

  findGuardTarget(guard) {
    const p = this.player;
    const sid = guard.settlement.id;
    if (this.isWanted(sid) && !p.dead && guard.distTo(p) <= 12) return p;
    const b = guard.settlement.bounds;
    for (const c of this.creatures) {
      if (c.dead || !c.hostileNow) continue;
      if (guard.distTo(c) > 9) continue;
      if (c.x < b.x0 - 10 || c.x > b.x1 + 10 || c.z < b.z0 - 10 || c.z > b.z1 + 10) continue;
      return c;
    }
    return null;
  }

  findPrey(c, range) {
    const p = this.player;
    let best = null;
    let bd = range + 1;
    if (!p.dead && c.distTo(p) <= range && Math.abs(p.y - c.y) <= 2) {
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
    e.dead = true;
    this.removeOcc(e);
    this.renderer.emit(e.x, e.y + 1, e.z, { n: 16, color: e.kind === 'npc' || e.kind === 'player' ? ['#c82a2a', '#e8e0d0', '#8a1a1a'] : ['#e8e0d0', '#a8a098'], up: 50, speed: 70, life: 0.8, oy: -8 });
    if (e.kind === 'player') {
      this.playerDied(source);
      return;
    }
    this.audio?.play('death', e);
    if (e.kind === 'npc') {
      e.releaseSpot();
      e.rec.alive = false;
      const sid = e.settlement.id;
      if (!this.deadNpcs.has(sid)) this.deadNpcs.set(sid, new Set());
      this.deadNpcs.get(sid).add(e.rec.idx);
      for (const it of e.rec.equipment.items) this.spawnDrop(it.item, it.count, e.x, e.y, e.z, true);
      if (e.rec.equipment.coins) this.spawnDrop('coin', e.rec.equipment.coins, e.x, e.y, e.z, true);
      if (source && source.kind === 'player') {
        this.stats.kills++;
        this.ui.msg(`${e.name} the ${e.title} has died.`, '#ff7060');
        this.wanted.set(sid, 240);
        this.witness(e, source);
        // Family members are devastated.
        const a = this.active.get(sid);
        if (a) for (const n of a.npcs) {
          if (n.dead || n.distTo(e) > 16) continue;
          if (n.rec.partner === e.rec.idx || n.rec.children.includes(e.rec.idx) || n.rec.parents.includes(e.rec.idx)) {
            n.say(`${e.rec.name.first}! NO!`, 4, '#ff9080');
            if (n.state === 'routine') n.react(source, true);
          }
        }
      }
    } else {
      this.stats.kills++;
      for (const [item, min, max, chance] of e.S.drops) {
        if (Math.random() > chance) continue;
        this.spawnDrop(item, min + Math.floor(Math.random() * (max - min + 1)), e.x, e.y, e.z, true);
      }
    }
  }

  playerDied(source) {
    const p = this.player;
    this.audio?.play('death');
    // Drop some coins.
    const coinSlot = p.inv.findIndex((s) => s && s.item === 'coin');
    if (coinSlot >= 0) {
      const lost = Math.ceil(p.inv[coinSlot].count / 2);
      removeItem(p.inv, 'coin', lost);
      this.spawnDrop('coin', lost, p.x, p.y, p.z, true);
    }
    this.ui.openDeath(source ? source.name || 'something' : 'misfortune');
  }

  respawn() {
    const p = this.player;
    p.dead = false;
    p.hp = p.maxHp;
    this.wanted.clear();
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
        const s = this.world.ow.settlements[sid];
        this.ui.msg(`The guards of ${s.name} have lost interest in you.`, '#a0e0a0');
      } else this.wanted.set(sid, nt);
    }
  }

  // ------------------------------------------------------------ spawning
  addCreature(c) {
    this.creatures.push(c);
    this.moveEntity(c, c.x, c.y, c.z);
  }

  spawning(dt) {
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
    const ow = this.world.ow;
    for (const s of ow.settlementsNear(x, z)) {
      const b = s.bounds;
      if (x > b.x0 - 6 && x < b.x1 + 6 && z > b.z0 - 6 && z < b.z1 + 6 && s.condition !== 'abandoned') return;
    }
    const y = this.world.findStandY(x, z, p.y);
    if (y < 0 || this.world.isWaterAt(x, y, z) || this.entityAt(x, y, z)) return;
    const col = this.world.terrain.column(x, z, this.world.terrain.context(x, z, x, z), {});
    const biome = col.biome;
    let species = null;
    if (night) {
      const r = Math.random();
      if ((biome === 'forest' || biome === 'taiga') && r < 0.35) species = 'wolf';
      else species = r < 0.7 ? 'slime' : 'skeleton';
    } else {
      const opts = {
        plains: ['rabbit', 'deer', 'rabbit', 'boar'], forest: ['deer', 'boar', 'rabbit', 'wolf'], taiga: ['deer', 'wolf', 'rabbit'],
        tundra: ['rabbit', 'wolf'], savanna: ['deer', 'boar', 'rabbit'], jungle: ['boar', 'slime', 'deer'], swamp: ['slime', 'boar'],
        desert: ['rabbit'], mountain: ['boar', 'rabbit'], beach: ['rabbit'],
      }[biome] || ['rabbit'];
      species = opts[Math.floor(Math.random() * opts.length)];
      if (species === 'wolf' && Math.random() < 0.6) species = 'deer';
    }
    const variant = Math.floor(Math.random() * 3);
    this.addCreature(new Creature(this, species, x, y, z, variant));
    if (SPECIES[species].packs && Math.random() < 0.6) {
      const y2 = this.world.findStandY(x + 1, z, y);
      if (y2 > 0 && !this.entityAt(x + 1, y2, z)) this.addCreature(new Creature(this, species, x + 1, y2, z));
    }
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
    if (!this.isDay()) {
      for (const s of r.lighting.sources) {
        if (Math.random() < 0.08 && Math.abs(s.x - this.player.x) < 18) r.emit(s.x, s.y + 1, s.z, { n: 1, color: ['#ffb040', '#ffe070'], up: 20, speed: 10, gravity: -10, life: 0.9, oy: -2 });
      }
    }
  }

  onPlayerStep(x, y, z, water) {
    this.audio?.play(water ? 'splash' : 'step');
    if (water) this.renderer.emit(x, y, z, { n: 4, color: ['#8cc4f0', '#e0f4ff'], up: 25, life: 0.4, oy: -2 });
  }

  onBlockChange(x, y, z, o, n) {
    if (o === -1 || (BLOCKS[o] && (BLOCKS[o].light || BLOCKS[o].opaque)) || (BLOCKS[n] && (BLOCKS[n].light || BLOCKS[n].opaque))) this.lightDirty = true;
  }

  // ------------------------------------------------------------ save
  serialize() {
    const regions = [];
    for (const v of this.world.saved.values()) regions.push(v);
    for (const r of this.world.regions.values()) if (r.modified) regions.push(r.serialize());
    const p = this.player;
    return {
      v: 1,
      seed: this.seed,
      minute: this.minute,
      day: this.day,
      player: { x: p.x, y: p.y, z: p.z, hp: p.hp, inv: p.inv, selected: p.selected, spawn: p.spawn },
      regions,
      dead: [...this.deadNpcs].map(([sid, set]) => [sid, [...set]]),
      explored: Array.from(this.world.ow.explored),
      stats: this.stats,
    };
  }

  applySave(data) {
    this.minute = data.minute;
    this.day = data.day;
    for (const r of data.regions || []) this.world.saved.set(this.world.regionKey(r.rx, r.rz), r);
    for (const [sid, list] of data.dead || []) this.deadNpcs.set(sid, new Set(list));
    if (data.explored) this.world.ow.explored.set(data.explored);
    if (data.stats) this.stats = data.stats;
    const pd = data.player;
    this.loadAround(pd.x, pd.z, true);
    this.player = new Player(this, pd.x, pd.y, pd.z);
    this.player.hp = pd.hp;
    this.player.inv = pd.inv;
    this.player.selected = pd.selected;
    this.player.spawn = pd.spawn;
    this.moveEntity(this.player, pd.x, pd.y, pd.z);
  }
}

function cap(s) {
  return s[0].toUpperCase() + s.slice(1);
}

export { itemForBlock };
