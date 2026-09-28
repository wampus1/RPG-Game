// Game orchestrator: owns the world, entities, time, input handling and the
// rules for interacting with blocks and creatures.
import {
  TILE, LH, VIEW_W, VIEW_H, WORLD_Y, REGION_W, REGION_D, GROUND, WATER_Y, REACH, BELT_SIZE,
  GAME_MINUTES_PER_SECOND, DAY_MINUTES, SETTLEMENT_ACTIVE_DIST,
} from '../config.js';
import { World } from '../world/world.js';
import { BLOCKS, B, META_STATE, LOGS, LEAVES, CROPS, cropMeta } from '../world/blocks.js';
import { ITEMS, rollDrops, itemForBlock } from '../world/items.js';
import { CONTAINER_SIZE } from '../world/loot.js';
import { Player } from '../entities/player.js';
import { NPC } from '../entities/npc.js';
import { Creature, SPECIES } from '../entities/creature.js';
import { ItemDrop } from '../entities/itemdrop.js';
import { TREE_BUILDERS } from '../world/trees.js';
import { removeItem, makeSlots } from './inventory.js';
import { mulberry32, hash4 } from '../util/rng.js';
import { M } from '../world/settlement.js';
import { BIOMES } from '../world/biomes.js';
import { TEX } from '../render/textures.js';
import { Sim, buildingAt } from '../sim/sim.js';
import { alive, invAdd, DAY, setOverride } from '../sim/econ.js';
import { jobTitle, visitorRecord } from '../entities/npcgen.js';
import { personName, familyName } from '../world/names.js';
import { RNG } from '../util/rng.js';
import { countItem } from './inventory.js';
import { ambientChatter } from './chatter.js';
import { CropGrowth } from './crops.js';

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
    this.sim = new Sim(this);
    this.world.onLayout = (L) => this.sim.attach(L);
    this.crops = new CropGrowth(this);
    this.world.onRegionLoad = (r) => {
      this.sim.applyPending(r);
      this.crops.scanRegion(r);
    };
    this.signIcons = new Map();
    this.projectiles = [];
    this.sleep = null;
    const nrng = new RNG(hash4(this.seed, 0x9a3e));
    const pstyle = this.world.ow.spawnSettlement ? this.world.ow.spawnSettlement.style : 'vale';
    const pn = personName(nrng, pstyle, familyName(nrng, pstyle));
    this.playerName = pn.first;
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
    // The town's books were kept while we were away: catch up first.
    this.sim.catchUp(layout);
    const dead = this.deadNpcs.get(s.id) || new Set();
    const npcs = [];
    for (const rec of layout.npcs) {
      if (dead.has(rec.idx) || !alive(rec) || rec.away) continue;
      if (rec.leaving) {
        rec.leaving = false;
        rec.away = true;
        continue;
      }
      const n = new NPC(this, rec, layout);
      n.placeForCurrentActivity();
      rec.ent = n;
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
    this.refreshSigns();
  }

  deactivate(s) {
    const a = this.active.get(s.id);
    if (!a) return;
    for (const n of a.npcs) {
      n.releaseSpot();
      this.removeOcc(n);
      n.dead = true;
      n.rec.hp = n.hp;
      if (n.rec.ent === n) n.rec.ent = null;
      if (n.rec.leaving) {
        n.rec.leaving = false;
        n.rec.away = true;
      }
      if (n.visit) this.sim.visitorEnts.delete(n.visit.id);
      if (n.visit && n.rec.visit === n.visit) n.rec.visit = null;
    }
    this.npcs = this.npcs.filter((n) => !a.npcs.includes(n));
    this.active.delete(s.id);
    this.refreshSigns();
  }

  // Returning villagers (e.g. merchants back from a trip) appear at the edge
  // of town and walk in.
  respawnReturning() {
    for (const [sid, a] of this.active) {
      const L = a.layout;
      for (const rec of L.npcs) {
        if (!alive(rec) || rec.away || rec.leaving || (rec.ent && !rec.ent.dead)) continue;
        if (this.deadNpcs.get(sid)?.has(rec.idx)) continue;
        const e = L.entrances[rec.idx % Math.max(1, L.entrances.length)] || { x: L.plaza.cx, z: L.plaza.cz };
        const spot = this.findFreeSpot(e.x, e.z, GROUND);
        const n = new NPC(this, rec, L);
        n.teleport(spot.x, spot.y, spot.z);
        rec.ent = n;
        a.npcs.push(n);
        this.npcs.push(n);
      }
    }
  }

  // A baby born in town while you're there appears beside a parent.
  spawnBorn(L, rec, parents) {
    const a = this.active.get(L.settlement.id);
    if (!a || (rec.ent && !rec.ent.dead)) return null;
    const by = parents.map((p) => p.ent).find((e) => e && !e.dead);
    const home = L.buildings[rec.home];
    const at = by ? { x: by.x, z: by.z, y: by.y } : home ? { x: (home.x0 + home.x1) / 2, z: (home.z0 + home.z1) / 2, y: GROUND } : { x: L.plaza.cx, z: L.plaza.cz, y: GROUND };
    const spot = this.findFreeSpot(at.x, at.z, at.y);
    const n = new NPC(this, rec, L);
    n.teleport(spot.x, spot.y, spot.z);
    rec.ent = n;
    a.npcs.push(n);
    this.npcs.push(n);
    if (by) by.say(by.rng.pick([`Say hello to little ${rec.name.first}!`, `Our ${rec.name.first}, born today!`]), 4, '#a0e0a0');
    return n;
  }

  // A visiting merchant walks in from the road and sets up on the square.
  spawnVisitor(L, visit, idx) {
    const a = this.active.get(L.settlement.id);
    if (!a) return null;
    // A real merchant from another town comes as themselves (same face,
    // family and reputation); random travelers get a made-up record.
    let rec;
    let origin = null;
    if (visit.fromIdx !== undefined) {
      origin = this.sim.layoutOf(visit.from);
      rec = origin && origin.npcs[visit.fromIdx];
      if (!rec || !alive(rec) || (rec.ent && !rec.ent.dead)) return null;
      rec.visit = visit;
      const now = this.day * DAY + this.minute;
      setOverride(rec, now, visit.leave + 240, 'visit', { place: 'market' });
    } else rec = visitorRecord(visit, idx, L.settlement.id);
    const e = L.entrances[idx % Math.max(1, L.entrances.length)] || { x: L.plaza.cx, z: L.plaza.cz };
    const spot = this.findFreeSpot(e.x, e.z, GROUND);
    const n = new NPC(this, rec, L);
    n.visit = visit;
    if (origin) {
      n.originLayout = origin;
      n.repSid = origin.settlement.id;
    }
    n.teleport(spot.x, spot.y, spot.z);
    rec.ent = n;
    a.npcs.push(n);
    this.npcs.push(n);
    return n;
  }

  // A nomad band walks in from the road and camps by the square.
  spawnNomads(L, band) {
    const a = this.active.get(L.settlement.id);
    if (!a) return null;
    const out = [];
    const all = { s: 0, e: 1440, act: 'camp', place: 'plaza' };
    band.people.forEach((p, i) => {
      const rec = {
        ...JSON.parse(JSON.stringify(p)), id: `${L.settlement.id}:n${band.id}:${i}`, idx: 3000 + band.id * 10 + i, sid: L.settlement.id, visitor: true, nomadBand: band.id,
        home: null, bed: 0, household: null, friends: [], work: { kind: 'none' }, schedule: { work: [all], rest: [all] },
        coins: 5, inv: [], skills: { trading: 0.2, cooking: 0.3, hunting: 0.5, fishing: 0.3, farming: 0.3, building: 0.3, crafting: 0.3 },
        fed: 1, hungry: 0, mood: 0.6, grief: [], override: null, away: false, doneKey: null,
      };
      // The family walks in together by one road.
      const e = L.entrances[band.id % Math.max(1, L.entrances.length)] || { x: L.plaza.cx, z: L.plaza.cz };
      const spot = this.findFreeSpot(e.x + (i % 2), e.z + (i >> 1), GROUND);
      const n = new NPC(this, rec, L);
      n.nomad = band;
      n.teleport(spot.x, spot.y, spot.z);
      rec.ent = n;
      a.npcs.push(n);
      this.npcs.push(n);
      out.push(n);
    });
    return out;
  }

  // The band settles: the travellers become townsfolk on the spot.
  nomadsSettle(L, ents, recs) {
    const a = this.active.get(L.settlement.id);
    ents.forEach((n, i) => {
      const rec = recs[i];
      const pos = n && !n.dead ? { x: n.x, y: n.y, z: n.z } : null;
      if (n && !n.dead) this.despawnNpc(n);
      if (!a || !rec || !pos) return;
      const m = new NPC(this, rec, L);
      m.teleport(pos.x, pos.y, pos.z);
      rec.ent = m;
      a.npcs.push(m);
      this.npcs.push(m);
      if (i === 0) m.say(m.rng.pick(['We\'ll stay! This feels like home.', 'This is the place. We\'re staying.']), 4, '#a0e0a0');
    });
    if (a) this.ui.msg(`The ${recs[0]?.name.last || ''} family of nomads has settled in ${L.settlement.name}.`, '#a0e0a0');
  }

  nomadsLeave(ents) {
    const now = this.day * DAY + this.minute;
    ents.forEach((n, i) => {
      if (!n || n.dead) return;
      setOverride(n.rec, now, now + 240, 'travel', { place: 'road' });
      n.activity = null;
      if (i === 0) n.say(n.rng.pick(['Not for us. Back to the road.', 'We\'ll find somewhere else.']), 3.5);
    });
  }

  // A hired guard reappears beside the player (after loading a save).
  spawnEscort(e) {
    const L = this.sim.layoutOf(e.sid);
    const rec = L && L.npcs[e.idx];
    if (!rec || !alive(rec)) return null;
    if (rec.ent && !rec.ent.dead) this.despawnNpc(rec.ent);
    const p = this.player;
    const spot = this.findFreeSpot(p.x + 1, p.z + 1, p.y);
    const n = new NPC(this, rec, L);
    n.teleport(spot.x, spot.y, spot.z);
    rec.ent = n;
    rec.away = true;
    n.hired = e;
    n.state = 'hired';
    this.npcs.push(n);
    return n;
  }

  // Remove an NPC entity that walked out of town (merchants on the road).
  despawnNpc(n) {
    n.releaseSpot();
    this.removeOcc(n);
    n.dead = true;
    if (n.rec.ent === n) n.rec.ent = null;
    if (n.visit && n.rec.visit === n.visit) {
      n.rec.visit = null;
      if (n.originLayout) n.rec.override = null;
    }
    if (n.rec.leaving) {
      n.rec.leaving = false;
      n.rec.away = true;
    }
    const a = this.active.get(n.settlement.id);
    if (a) a.npcs = a.npcs.filter((q) => q !== n);
    this.npcs = this.npcs.filter((q) => q !== n);
  }

  // Trade icons painted on hanging signs.
  refreshSigns() {
    const ICON = {
      tavern: 'stew', shop: 'coin', smithy: 'iron_sword', temple: 'prayer_beads', bakery: 'bread', library: 'book', townhall: 'scroll',
      guardhouse: 'spear', tailor: 'cloth', workshop: 'planks', herbalist: 'herb', warehouse: 'crate', barn: 'wheat', manor: 'gem',
    };
    this.signIcons.clear();
    for (const { layout } of this.active.values()) {
      for (const sg of layout.signs) {
        if (sg.kind !== 'building') continue;
        const b = layout.buildings[sg.building];
        if (!b) continue;
        this.signIcons.set(`${sg.x},${sg.y},${sg.z}`, b.playerHome ? 'bed' : b.residential ? (b.type === 'manor' ? 'gem' : 'door') : ICON[b.type] || 'coin');
      }
    }
  }

  // ------------------------------------------------------------ main update
  update(dt, input) {
    this.dt = dt;
    this.pathBudget = 5;
    const ev = input.consume();
    const uiRes = this.ui.handle(ev, input, this);
    // The pause menu freezes the world; other windows let it keep living.
    if (this.ui.find && (this.ui.find('pause') || this.ui.find('help'))) {
      this.cursor = null;
      this.mining = null;
      return;
    }
    const blocked = this.ui.modal || this.player.dead || !!this.sleep || !!this.player.restrained;
    if (this.sleep) this.updateSleep(dt, uiRes.pressed);
    this.minute += dt * GAME_MINUTES_PER_SECOND * (this.sleepFast || 1);
    if (this.minute >= DAY_MINUTES) {
      this.minute -= DAY_MINUTES;
      this.day++;
    }
    if (!blocked) this.handleKeys(uiRes.pressed, uiRes.wheel, uiRes.wheelShift);
    this.player.update(dt, input, blocked);
    if (!blocked) this.updateCursor(input);
    else this.cursor = null;
    if (!blocked) this.handleMouse(dt, uiRes.clicks, input);
    else this.mining = null;
    this.streamRegions();
    if (Math.random() < 0.05) this.updateSettlements();
    this.world.ow.markExplored(this.player.x, this.player.z, 1);
    this.sim.update(dt);
    this.respawnT = (this.respawnT || 0) - dt;
    if (this.respawnT <= 0) {
      this.respawnT = 2;
      this.respawnReturning();
    }
    for (const n of this.npcs) {
      if (n.dead) continue;
      n.update(dt);
      n.maybeGreet(this.player, dt);
    }
    ambientChatter(this, dt);
    this.npcs = this.npcs.filter((n) => !n.dead);
    this.updateProjectiles(dt);
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
    this.crops.update(dt);
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
    // Picking is offset half a block down so the block under the pointer is
    // the one whose body you see there, not the one behind it.
    const wy = my + r.camY - TILE / 2;
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
        // Seeds and carrots only offer to plant where they can grow.
        if (ok || held.kind === 'block') c.place = { ...t, id: placeId, rot: p.rot, ok };
      }
    }
    this.cursor = c;
  }

  attackReach() {
    const h = this.player.heldDef();
    if (h && h.ranged) return h.range;
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
    // In a cell, only the bars could possibly give way.
    const j = this.sim.justice.jail;
    if (j && !j.cellless && b.id !== B.iron_bars && b.id !== B.cell_door) {
      if (!this.mining || this.mining.x !== c.x || this.mining.z !== c.z) this.ui.msg('The walls are solid stone and iron. Only the bars might give...', '#c8c8c8', true);
      this.mining = { x: c.x, y: c.y, z: c.z, progress: 0, hitT: 1 };
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
        // Smashing open someone else's chest is still stealing.
        if (byPlayer) {
          const owner = this.containerOwner(x, y, z);
          const taken = (slots || []).filter(Boolean).map((q) => ({ item: q.item, count: q.count }));
          if (owner && taken.length) this.onContainerTake({ owner }, taken);
        }
      }
      if (LOGS.has(id) && this.isTreeLog(x, y, z)) {
        this.fellTree(x, y, z, drops);
      } else {
        const meta = w.getMeta(x, y, z);
        w.setBlock(x, y, z, B.air);
        // Crops give seeds back if unripe, and more with a hoe.
        const crop = this.crops.harvest(id, meta, byPlayer && this.player.heldItem() === 'hoe', rand);
        drops.push(...(crop || rollDrops(id, rand)));
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
      this.noteBuildingDamage(x, z, id);
      this.checkCropTheft(x, z, id, drops);
    }
  }

  // Knocking a hole in a town building: the builders will come and fix it.
  noteBuildingDamage(x, z, id) {
    const bl = BLOCKS[id];
    if (!bl || (bl.render !== 'cube' && bl.render !== 'door')) return;
    const s = this.world.ow.settlementAt(x, z);
    if (!s || s.condition === 'abandoned' || s.deserted) return;
    const L = this.world.getLayout(s);
    const b = buildingAt(L, x, z);
    if (b && !b.playerHome) this.sim.works.noteDamage(L, b);
  }

  // Harvesting a town's fields or gardens in front of people is theft.
  checkCropTheft(x, z, id, drops) {
    if (![B.wheat_crop, B.carrot_crop, B.cabbage_crop, B.pumpkin].includes(id)) return;
    const s = this.world.ow.settlementAt(x, z);
    if (!s || !this.active.has(s.id)) return;
    const L = this.active.get(s.id).layout;
    if (L.maskAt(x, z) !== M.FIELD) return;
    if (this.sim.careers.licensed('farmer', s.id)) return;
    const wits = this.sim.witnesses(s.id, x, z, 9);
    if (!wits.length) return;
    const items = drops.filter((d) => d.item !== 'seeds').map((d) => ({ item: d.item, count: d.count }));
    const value = items.reduce((n, d) => n + (ITEMS[d.item]?.value || 1) * d.count, 0);
    const farmer = wits.find((n) => n.rec.job === 'farmer');
    if (value < 3 && !farmer) {
      wits[0].say('Hey, those crops aren\'t yours!', 3, '#ffb080');
      this.sim.changeRep(wits[0], -3);
      return;
    }
    this.sim.justice.commit(s.id, 'theft', { witnesses: wits, value, items, desc: 'Stealing crops from the fields', owner: farmer ? { kind: 'rec', id: farmer.rec.idx } : null, victimNpc: farmer });
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
    const wits = this.sim.witnesses(s.id, x, z, 7).filter((n) => n.state === 'routine');
    const witness = wits[0];
    if (!witness) return;
    const v = (this.vandal.get(s.id) || 0) + 1;
    this.vandal.set(s.id, v);
    this.sim.changeRep(witness, -2);
    if (v >= 4) {
      this.vandal.set(s.id, 0);
      this.sim.justice.commit(s.id, 'vandalism', { witnesses: wits, desc: 'Vandalizing the town' });
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
    if (CROPS[id] && w.getBlock(x, y - 1, z) !== B.farmland) return false;
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
    w.setBlock(t.x, t.y, t.z, id, rot | (b.lightWhenState ? META_STATE : 0) | cropMeta(id, 0));
    if (CROPS[id]) this.crops.sow(t.x, t.y, t.z, id, 0);
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
        const owner = this.containerOwner(x, y, z);
        this.ui.openContainer(owner && owner.label ? `${b.label} · ${owner.label}` : b.label, slots, { x, y, z, owner });
        if (owner && owner.sid !== undefined && owner.kind !== 'mine' && owner.kind !== 'work') this.peekWarning(owner);
        if (owner && owner.kind === 'work') this.sim.careers.onOpenContainer({ x, y, z, owner });
        break;
      }
      case 'cell_door': {
        const j = this.sim.justice.jail;
        const L = this.jailLayoutAt(x, z);
        if (j && L && j.sid === L.settlement.id) {
          this.ui.msg('The cell door is locked.', '#ffb080');
          this.audio?.play('error');
          break;
        }
        const open = id === B.cell_door_open;
        w.setBlock(x, y, z, open ? B.cell_door : B.cell_door_open, 0);
        if (w.getBlock(x, y + 1, z) === B.iron_bars) w.setBlock(x, y + 1, z, B.cell_door_top, 0);
        this.audio?.play('door');
        break;
      }
      case 'trap': {
        if (w.getState(x, y, z)) {
          w.setState(x, y, z, false);
          const left = p.give('raw_meat', 1);
          if (left) this.spawnDrop('raw_meat', 1, p.x, p.y, p.z, true);
          this.ui.msg('You take the catch from the snare.', '#e8e0a0');
          this.audio?.play('pickup');
          const s = this.world.ow.settlementsNear(x, z)[0];
          if (s && this.active.has(s.id) && !this.sim.careers.licensed('trapper', s.id)) {
            const wits = this.sim.witnesses(s.id, x, z, 8).filter((n) => n.rec.job === 'trapper');
            if (wits.length) this.sim.justice.commit(s.id, 'theft', { witnesses: wits, value: 3, desc: 'Stealing from a trapper\'s snare', items: [{ item: 'raw_meat', count: 1 }], owner: { kind: 'rec', id: wits[0].rec.idx } });
          }
        } else this.ui.msg('A snare, set and waiting. Nothing caught yet.', '#c8c8c8');
        break;
      }
      case 'sit':
        this.sitOn(x, y, z);
        break;
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
      case 'sign': {
        const t = this.signText(x, y, z);
        if (t.ledger) this.ui.openLedger(t);
        else this.ui.openSign(t.lines || t, t.title);
        break;
      }
      case 'bookshelf':
        this.ui.openBook(this.bookText(x, y, z));
        break;
      case 'grave':
        this.ui.openSign(this.sim.graveText(x, z), 'GRAVESTONE');
        break;
      case 'statue': {
        const s = this.world.ow.settlementAt(x, z);
        this.ui.msg(s && s.civ ? `A statue honoring the founders of the ${s.civ.name}.` : 'A weathered statue of a forgotten hero.', '#e8e0c8');
        break;
      }
    }
  }

  // Who a container belongs to: a household, a business, the player.
  containerOwner(x, y, z) {
    const s = this.world.ow.settlementAt(x, z);
    if (!s || s.condition === 'abandoned' || s.deserted) return null;
    const L = this.world.getLayout(s);
    const b = buildingAt(L, x, z);
    if (!b) return null;
    const c = this.sim.citizen;
    if (b.playerHome) return c && c.home === b.id && c.sid === s.id ? { kind: 'mine', sid: s.id, label: 'yours' } : { kind: 'house', id: b.id, sid: s.id, label: 'not yours' };
    if (b.residential) {
      const host = c && c.sid === s.id && c.host === b.id;
      return { kind: host ? 'host' : 'house', id: b.id, sid: s.id, label: b.family ? `${b.family} family` : null, b };
    }
    // Staff on shift may use the shop's chests and barrels.
    if (this.sim.careers.onShift(s.id, b.id)) return { kind: 'work', id: b.id, sid: s.id, label: `${b.name} (work)`, b };
    return { kind: 'biz', id: b.id, sid: s.id, label: b.name, b };
  }

  // Rummaging through someone's things in front of them.
  peekWarning(owner) {
    if (owner.kind === 'host') return;
    const p = this.player;
    const a = this.active.get(owner.sid);
    if (!a) return;
    const w = this.sim.witnesses(owner.sid, p.x, p.z, 6).find((n) => n.rec.home === owner.id || (n.rec.work && n.rec.work.building === owner.id));
    if (w && w.state === 'routine') w.say(w.rec.personality.kindness > 0.6 ? 'Can I help you with something?' : 'Hey! Keep your hands off our things!', 3, '#ffb080');
  }

  // Items taken out of a container that isn't yours (called by the window).
  onContainerTake(pos, taken) {
    const owner = pos.owner;
    if (!owner || owner.kind === 'mine' || owner.kind === 'work' || !taken.length) return false;
    const value = taken.reduce((n, t) => n + (ITEMS[t.item]?.value || 1) * t.count, 0);
    const sid = owner.sid;
    const p = this.player;
    const wits = this.sim.witnesses(sid, p.x, p.z, 7);
    if (owner.kind === 'host') {
      const fam = wits.filter((n) => n.rec.home === owner.id);
      if (fam.length && value > 4) {
        fam[0].say('Ask before you take, please. This is our home too.', 3.5, '#ffb080');
        this.sim.changeRep(fam[0], -3);
      }
      return false;
    }
    const where = owner.kind === 'house' ? `the ${owner.label || 'a'} home` : `the ${owner.label || 'shop'}`;
    const desc = `Stealing ${taken.map((t) => `${t.count} ${ITEMS[t.item]?.name || t.item}`).slice(0, 2).join(', ')} from ${where}`;
    if (!wits.length) {
      // Nobody saw. The owners will notice later...
      this.sim.justice.unseen(sid, { type: 'theft', x: p.x, z: p.z, value, items: taken, desc, owner: { kind: owner.kind === 'house' ? 'house' : 'biz', id: owner.id }, ownerName: owner.kind === 'house' ? `${owner.label || ''}`.replace(/ family$/, 's') : owner.label });
      return false;
    }
    const victim = wits.find((n) => n.rec.home === owner.id || (n.rec.work && n.rec.work.building === owner.id));
    this.sim.justice.commit(sid, 'theft', { witnesses: wits, value, items: taken, desc, owner: { kind: owner.kind === 'house' ? 'house' : 'biz', id: owner.id }, victimNpc: victim });
    return true;
  }

  // Items put into a container (shop helpers stocking up).
  onContainerPut(pos, added) {
    return this.sim.careers.onContainerPut(pos, added);
  }

  jailLayoutAt(x, z) {
    for (const s of this.world.ow.settlementsNear(x, z)) {
      const L = this.world.layouts.get(s.id);
      if (L && L.jail && Math.abs(L.jail.door.x - x) <= 3 && Math.abs(L.jail.door.z - z) <= 3) return L;
    }
    return null;
  }

  signText(x, y, z) {
    const s = this.world.ow.settlementAt(x, z) || this.world.ow.settlementsNear(x, z)[0];
    if (!s) return { lines: ['A weathered sign.', 'The writing has long faded.'] };
    const L = this.world.getLayout(s);
    const sg = L.signs.find((q) => q.x === x && q.z === z && (q.y === y || q.y === undefined));
    const e = L.econ;
    const living = L.npcs.filter(alive);
    const staff = (b) => living.filter((r) => r.work && r.work.building === b.id).map((r) => `${r.name.first} ${r.name.last} (${jobTitle(r, s).toLowerCase()})`);
    if (sg && sg.kind === 'building') {
      const b = L.buildings[sg.building];
      if (b.residential) {
        if (b.playerHome) return { title: 'HOME', lines: [b.underConstruction ? 'UNDER CONSTRUCTION' : (b.homeName || 'A cottage').toUpperCase(), '', b.underConstruction ? 'Builders are at work here.' : `Home of ${this.playerName}.`] };
        const who = living.filter((r) => r.home === b.id);
        const lines = [(b.homeName || b.name).toUpperCase(), ''];
        if (!who.length) lines.push('The house stands empty.');
        else lines.push(`Home of ${who.map((r) => r.name.first).join(', ')}`);
        const lost = L.npcs.filter((r) => r.home === b.id && !alive(r));
        if (lost.length) lines.push('', `In memory of ${lost.map((r) => r.name.first).join(' and ')}.`);
        return { title: 'HOME', lines };
      }
      const lines = [b.name.toUpperCase(), ''];
      const st2 = staff(b);
      if (b.type === 'tavern') {
        const k = e.biz[b.id];
        const menu = k ? ['feast', 'stew', 'gruel'].filter((m) => k.store[m]).map((m) => ITEMS[m].name) : [];
        lines.push('Meals served from dawn till late.', menu.length ? `On the menu: ${menu.join(', ')}` : 'The kitchen is out of food!');
      } else if (b.type === 'townhall') {
        lines.push(`Taxes: ${Math.round(e.tax * 100)}%`, 'Citizenship applications at the desk.');
      } else if (b.type === 'guardhouse') lines.push('Report crimes to the guard.');
      if (st2.length) lines.push('', ...st2.slice(0, 3));
      else if (b.type !== 'townhall') lines.push('', 'Nobody seems to work here now.');
      if (L.jail && L.jail.building === b.id) lines.push('', 'Holding cells within.');
      return { title: 'SIGN', lines };
    }
    if (sg && sg.kind === 'plot') {
      const pl = L.plots[sg.plot];
      return { title: 'SIGN', lines: ['LAND FOR NEW CITIZENS', '', pl && pl.taken ? 'This lot has been claimed.' : `Become a citizen of ${s.name}`, pl && pl.taken ? '' : 'at the town hall, and a home will', pl && pl.taken ? '' : 'be built for you here.'] };
    }
    if (sg && sg.kind === 'graveyard') {
      const g = L.graveyard;
      const n = g ? g.slots.filter((q) => q.grave).length : 0;
      const recent = g ? g.slots.filter((q) => q.grave && !q.grave.ancestor).sort((a, b) => b.grave.died - a.grave.died).slice(0, 3) : [];
      return { title: 'GRAVEYARD', lines: [`THE RESTING PLACE OF ${s.name.toUpperCase()}`, '', `${n} souls rest here.`, ...(recent.length ? ['', 'Recently laid to rest:', ...recent.map((q) => `${q.grave.name} (day ${q.grave.died})`)] : [])] };
    }
    if (sg && sg.kind === 'board') return { ledger: true, s, L };
    const lines = [`${s.name.toUpperCase()}`, `${cap(s.type)} of the ${s.civ ? s.civ.name : 'free folk'}`, `Population: ${living.length}`, ''];
    const names = [...new Set(L.buildings.filter((b) => !b.residential).map((b) => b.name))];
    if (names.length) lines.push('Services: ' + names.slice(0, 5).join(', '));
    if (s.condition === 'abandoned') lines.push('', '...someone scrawled: "LEAVE WHILE YOU CAN"');
    else if (this.sim.justice.exiled.has(s.id)) lines.push('', `By order: ${this.playerName} is BANISHED.`);
    else if (s.condition === 'poor') lines.push('', 'NOTICE: Bread rations reduced. By order.');
    else if (s.condition === 'prosperous') lines.push('', 'Market day every day! Travelers welcome.');
    if (this.isWanted(s.id)) lines.push('', 'WANTED: a dangerous stranger. Report to the guard.');
    return { title: 'SIGN', lines };
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

  // ------------------------------------------------------------ sleep & rest
  trySleep(x, y, z) {
    const p = this.player;
    const h = this.minute / 60;
    const j = this.sim.justice.jail;
    const owner = this.sim.bedOwner(x, z);
    if (owner && owner.kind === 'jail') {
      if (!j || j.phase !== 'serving') {
        this.ui.msg(j ? 'Not now: the hearing isn\'t over.' : 'You\'d rather not sleep in a cell.', '#c8c8c8');
        return;
      }
    } else if (owner && owner.kind === 'home') {
      const wits = this.sim.witnesses(owner.L.settlement.id, x, z, 6).filter((n) => n.rec.home === owner.b.id);
      if (wits.length) wits[0].say('That\'s my bed! Out!', 3, '#ffb080');
      this.ui.msg(`This bed belongs to the ${owner.family || ''} family.`, '#ffb080');
      return;
    } else if (owner && owner.kind === 'other') {
      this.ui.msg('This isn\'t your home.', '#ffb080');
      return;
    } else if (owner && owner.kind === 'guard') {
      this.ui.msg('A guard\'s cot. Better not.', '#c8c8c8');
      return;
    }
    const jailed = j && j.phase === 'serving';
    if (!jailed) p.spawn = { x: p.x, y: p.y, z: p.z };
    if (!jailed && !(h >= 20 || h < 5)) {
      this.ui.msg('You can only sleep at night. (spawn point set)', '#c8d8ff');
      return;
    }
    // Wake at dawn, or when the sentence ends.
    const now = this.day * DAY + this.minute;
    let wake = jailed ? j.release : (h >= 20 ? (this.day + 1) * DAY + 360 : this.day * DAY + 360);
    if (jailed) wake = Math.min(wake, now + 16 * 60);
    this.sleep = { phase: 'in', t: 0, bed: { x, y, z }, from: { x: p.x, y: p.y, z: p.z }, wake, start: now, hp0: p.hp, jail: jailed };
    this.stopPlayerActions();
    p.sitting = null;
    p.teleport(x, y, z);
    p.sleeping = true;
    p.dir = 0;
    this.ui.msg(jailed ? 'You lie down on the hard cot...' : 'You climb into bed... (spawn point set)', '#c8d8ff');
    this.audio?.play('select');
  }

  updateSleep(dt, pressed) {
    const sl = this.sleep;
    const p = this.player;
    sl.t += dt;
    const now = this.day * DAY + this.minute;
    const woken = pressed && pressed.some((k) => k.code !== 'ShiftLeft' && k.code !== 'ShiftRight');
    if (sl.phase === 'in') {
      const k = Math.min(1, sl.t / 2.2);
      this.sleepFast = 1 + 59 * k * k;
      if (sl.t >= 2.2) {
        sl.phase = 'deep';
        sl.t = 0;
      }
      if (woken && sl.t > 0.4) this.wakeUp(true);
    } else if (sl.phase === 'deep') {
      this.sleepFast = 60;
      // Resting heals over the night.
      const frac = Math.min(1, (now - sl.start) / Math.max(60, sl.wake - sl.start));
      p.hp = Math.max(p.hp, Math.min(p.maxHp, Math.round(sl.hp0 + (p.maxHp - sl.hp0) * frac)));
      if (now >= sl.wake - 2) this.wakeUp(false);
      else if (woken) this.wakeUp(true);
    } else if (sl.phase === 'out') {
      const k = Math.max(0, 1 - sl.t / 1.4);
      this.sleepFast = Math.max(1, 1 + 59 * k * k * (sl.early ? 0.2 : 1));
      if (sl.t >= 1.4) {
        this.sleepFast = 0;
        this.sleep = null;
        p.sleeping = false;
        const f = sl.from;
        if (!this.occupiedBySolid(f.x, f.y, f.z, p) && this.world.canStand(f.x, f.y, f.z)) p.teleport(f.x, f.y, f.z);
        else {
          const spot = this.findFreeSpot(sl.bed.x, sl.bed.z, sl.bed.y);
          p.teleport(spot.x, spot.y, spot.z);
        }
      }
    }
  }

  wakeUp(early) {
    const sl = this.sleep;
    if (!sl || sl.phase === 'out') return;
    sl.phase = 'out';
    sl.t = 0;
    sl.early = early;
    const p = this.player;
    if (!early && !sl.jail) {
      p.hp = p.maxHp;
      this.ui.msg('Good morning! You feel rested.', '#ffe8a0');
    } else if (sl.jail && !early) this.ui.msg('You wake, stiff from the cot.', '#c8d8ff');
    else this.ui.msg('You get up.', '#c8d8ff');
    // Villagers carry on with their day (after a full night, snap them to it).
    if (!early && !sl.jail) {
      for (const a of this.active.values()) for (const n of a.npcs) if (!n.dead && n.state === 'routine' && !n.visit) {
        n.activity = null;
        n.wake();
        n.placeForCurrentActivity();
      }
    }
  }

  // Sit down on a chair, bench or stool.
  sitOn(x, y, z) {
    const p = this.player;
    if (Math.max(Math.abs(p.x - x), Math.abs(p.z - z)) > 1 || Math.abs(p.y - y) > 1) {
      this.ui.msg('Too far away to sit there.', '#c8c8c8');
      return;
    }
    const other = this.entityAt(x, y, z);
    if (other && other !== p) {
      this.ui.msg('Someone is already sitting there.', '#c8c8c8');
      return;
    }
    if (!this.world.canStand(x, y, z)) return;
    p.teleport(x, y, z);
    const id = this.world.getBlock(x, y, z);
    if (BLOCKS[id].rotatable) p.dir = this.world.getMeta(x, y, z) & 3;
    p.sitting = { x, y, z };
    this.stopPlayerActions();
    this.audio?.play('select');
    this.ui.msg('You sit down. (move to stand up)', '#c8c8c8', true);
  }

  stopPlayerActions() {
    this.fishing = null;
    this.mining = null;
    this.pending = null;
  }

  advanceTime(min) {
    this.minute += min;
    while (this.minute >= DAY_MINUTES) {
      this.minute -= DAY_MINUTES;
      this.day++;
    }
  }

  teleportPlayer(x, y, z) {
    const p = this.player;
    p.sitting = null;
    this.loadAround(x, z, true);
    const yy = this.world.canStand(x, y, z) ? y : this.world.findStandY(x, z, y);
    p.teleport(x, yy > 0 ? yy : y, z);
    this.renderer.camInit = false;
    this.lightDirty = true;
    this.currentSettlement = this.world.ow.settlementAt(p.x, p.z);
  }

  buildingAtPlayer() {
    const s = this.currentSettlement;
    if (!s) return null;
    const L = this.world.layouts.get(s.id);
    return L ? buildingAt(L, this.player.x, this.player.z) : null;
  }

  executePlayer(cause) {
    const p = this.player;
    p.hp = 0;
    p.dead = true;
    this.removeOcc(p);
    this.playerDied({ name: cause });
  }

  // ------------------------------------------------------------ arrows
  shoot(from, target, dmg) {
    const dist = Math.hypot(target.x - from.x, target.z - from.z);
    this.projectiles.push({ from, target, x0: from.x, y0: from.y + 1, z0: from.z, tx: target.x, ty: target.y + 1, tz: target.z, t: 0, dur: 0.08 + dist * 0.045, dmg });
    this.audio?.play('swing', from);
  }

  updateProjectiles(dt) {
    for (const a of this.projectiles) {
      a.t += dt;
      if (a.t < a.dur) continue;
      a.done = true;
      const t = a.target;
      if (!t.dead && Math.max(Math.abs(t.x - a.tx), Math.abs(t.z - a.tz)) <= 1) this.damage(t, a.dmg, a.from);
    }
    this.projectiles = this.projectiles.filter((a) => !a.done);
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
    // Meal quality matters: bad cooking can turn your stomach, a delightful
    // meal keeps you going for a while.
    if (def.quality === 'terrible' && Math.random() < 0.35) {
      p.hp = Math.max(1, p.hp - 3);
      this.ui.msg('Ugh... your stomach churns. (-3 HP)', '#c0a060');
      this.shake = Math.min(1, this.shake + 0.2);
    } else if (def.quality === 'delightful') {
      p.wellFed = 300;
      this.ui.msg('Delightful! You feel well fed. (faster healing)', '#ffe070');
    }
  }

  talk(npc) {
    if (npc.sleeping) {
      npc.say('Zzz...', 2);
      return;
    }
    // People in the middle of something urgent don't stop to chat.
    const busy = { flee: 'Not now! Run!', fight: null, alert: 'Not now! GUARDS!', leaving: 'Can\'t stop, I\'m on my way home!', escort: null }[npc.state];
    if (busy !== undefined) {
      if (busy) npc.say(busy, 2);
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
    p.sitting = null;
    if (def && def.ranged) {
      if (Math.max(Math.abs(target.x - p.x), Math.abs(target.z - p.z)) > reach) return this.swing();
      if (countItem(p.inv, 'arrow') <= 0) {
        this.ui.msg('You have no arrows.', '#ffb080', true);
        this.audio?.play('error');
        p.attackCd = 0.4;
        return;
      }
      removeItem(p.inv, 'arrow', 1);
      p.attackCd = def.cooldown;
      p.doAction(0.3);
      this.shoot(p, target, Math.round(def.damage * (Math.random() < 0.12 ? 1.8 : 1)));
      return;
    }
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
    if (target.kind === 'player' && this.sim.careers.armor()) amount = Math.max(1, Math.round(amount * (1 - this.sim.careers.armor())));
    target.hp -= amount;
    target.flash = 0.12;
    this.renderer.floatText(target.x, target.y + 2, target.z, `${crit ? '!' : '-'}${amount}`, target.kind === 'player' ? '#ff5050' : crit ? '#ffe070' : '#ffffff');
    this.renderer.emit(target.x, target.y + 1, target.z, { n: 5, color: target.species === 'slime' ? ['#58c048', '#8ae070'] : target.kind === 'monster' ? ['#e8e4d4', '#b0aca0'] : ['#c82a2a', '#8a1a1a'], up: 30, speed: 50, life: 0.4, oy: -8 });
    this.audio?.play(target.kind === 'player' ? 'hurt' : 'hit', target);
    if (target.kind === 'player') {
      this.shake = Math.min(1, this.shake + 0.4);
      if (source && source.name) this.ui.msg(`${source.name} hits you for ${amount}!`, '#ff7060', true);
    }
    // Hitting your employer ends the job on the spot.
    if (target.kind === 'npc' && source && source.kind === 'player' && this.sim.careers.employs(target)) {
      this.sim.careers.fire(target.layout, this.sim.careers.job, 'You attacked me! Get out, you\'re fired!');
    }
    // Remember who a beast went for (rescuing them earns thanks).
    if (target.kind === 'npc' && source && (source.kind === 'creature' || source.kind === 'monster')) {
      source.victim = target;
      source.victimT = this.sim.abs;
    }
    // A beast you strike turns on you: remember who it was hunting.
    if (source && source.kind === 'player' && target.target && target.target.kind === 'npc') target.hunting = { n: target.target, t: this.sim.abs };
    // Violence against villagers is a crime; witnesses react.
    if (target.kind === 'npc' && source) {
      target.onHurt(source);
      if (source.kind === 'player' && target.hp > 0) this.crime(target);
      else if (source.kind !== 'player') this.witness(target, source);
    } else if (target.onHurt && source) target.onHurt(source);
    if (target.hp <= 0) {
      // The town subdues lawbreakers rather than killing them (unless exiled).
      if (target.kind === 'player' && source && source.kind === 'npc' && !source.visit && !source.hired && !this.sim.justice.exiled.has(source.settlement.id)) {
        target.hp = 1;
        this.sim.justice.knockout(source.settlement.id);
        return;
      }
      this.kill(target, source);
    }
  }

  // The player hurt a villager.
  crime(victim) {
    const sid = victim.settlement.id;
    const guard = victim.rec.job === 'guard';
    const wits = this.sim.witnesses(sid, victim.x, victim.z, 8).filter((n) => n !== victim);
    if (!victim.visit) wits.push(victim);
    const name = `${victim.rec.name.first} ${victim.rec.name.last}`;
    // One assault charge per victim per fight.
    const recent = this.sim.justice.pendingIn(sid).find((c) => (c.type === 'assault' || c.type === 'assault_guard') && c.victim === name && c.day === this.day);
    if (!recent) this.sim.justice.commit(sid, guard ? 'assault_guard' : 'assault', { witnesses: wits, victim: name, victimNpc: victim });
    else {
      this.sim.changeRep(victim, -10);
      this.wanted.set(sid, Math.max(this.wanted.get(sid) || 0, 1e9));
    }
    this.witness(victim, this.player);
  }

  // Bystanders react to a villager being hurt (by the player or a monster).
  witness(victim, attacker) {
    const a = this.active.get(victim.settlement.id);
    if (!a) return;
    for (const n of a.npcs) {
      if (n === victim || n.dead || n.state !== 'routine') continue;
      if (n.distTo(victim) > 8) continue;
      n.react(attacker, true, victim);
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
    if (called && threat.kind === 'player') this.ui.msg('The guards have been called!', '#ff7060');
    if (Math.max(Math.abs(caller.x - this.player.x), Math.abs(caller.z - this.player.z)) < 20) this.audio?.play('alarm');
  }

  findGuardTarget(guard) {
    const p = this.player;
    const sid = guard.settlement.id;
    const jailed = this.sim.justice.jail && this.sim.justice.jail.sid === sid;
    if (!jailed && (this.isWanted(sid) || this.sim.justice.exiled.has(sid)) && !p.dead && guard.distTo(p) <= 12 && this.sim.canSee(guard, p.x, p.z, p.y)) return p;
    const b = guard.settlement.bounds;
    const watching = guard.act === 'watch';
    for (const c of this.creatures) {
      if (c.dead || !c.hostileNow) continue;
      if (guard.distTo(c) > (watching ? 11 : 9)) continue;
      // Out guarding a miner, any beast nearby is theirs to deal with.
      if (!watching && (c.x < b.x0 - 10 || c.x > b.x1 + 10 || c.z < b.z0 - 10 || c.z > b.z1 + 10)) continue;
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
      const L = e.layout;
      const rec = e.rec;
      const sid = e.settlement.id;
      // Everything they carried falls to the ground.
      for (const it of rec.equipment.items) this.spawnDrop(it.item, it.count, e.x, e.y, e.z, true);
      for (const it of rec.inv || []) this.spawnDrop(it.item, it.count, e.x, e.y, e.z, true);
      if (e.visit) for (const [k, n] of Object.entries(e.visit.goods)) this.spawnDrop(k, n, e.x, e.y, e.z, true);
      rec.inv = [];
      const coins = rec.coins || 0;
      if (coins) this.spawnDrop('coin', coins, e.x, e.y, e.z, true);
      rec.coins = 0;
      const byPlayer = source && source.kind === 'player';
      const cause = byPlayer ? 'slain' : source ? `killed by a ${(source.name || 'beast').toLowerCase()}` : 'misadventure';
      rec.ent = null;
      this.sim.recordDeath(e.originLayout || L, rec, cause, byPlayer ? 'player' : null);
      if (byPlayer) {
        this.stats.kills++;
        this.ui.msg(`${e.name} the ${e.title} has died.`, '#ff7060');
        const wits = this.sim.witnesses(sid, e.x, e.z, 10);
        const vname = `${rec.name.first} ${rec.name.last}`;
        if (wits.length) this.sim.justice.commit(sid, 'murder', { witnesses: wits, victim: vname });
        else {
          // Only the victim saw it: that knowledge dies with them. The body
          // will be found, and the town will ask who was seen nearby.
          this.sim.justice.forgetVictim(sid, rec.idx);
          this.sim.justice.unseen(sid, { type: 'murder', x: e.x, z: e.z, victim: vname, victimIdx: rec.idx, desc: `The murder of ${vname}` });
        }
        this.witness(e, source);
      } else this.ui.msg(`${e.name} the ${e.title} was killed!`, '#ff9080');
      // Family and friends who see it are devastated.
      const a = this.active.get(sid);
      if (a && !e.visit) for (const n of a.npcs) {
        if (n.dead || n === e || n.distTo(e) > 16) continue;
        const r = n.rec;
        const fam = r.partner === rec.idx || r.children.includes(rec.idx) || r.parents.includes(rec.idx) || r.household === rec.household;
        const friend = (r.friends || []).includes(rec.idx);
        if (fam) n.say(n.rng.pick([`${rec.name.first}! NO!`, `Not ${rec.name.first}! No, no, no...`, `${rec.name.first}!!`]), 4, '#ff9080');
        else if (friend) n.say(n.rng.pick([`${rec.name.first}...? No!`, `They killed ${rec.name.first}!`]), 3.5, '#ffb080');
        else if (n.distTo(e) <= 8) n.say(n.rng.pick(['Oh no...', 'Someone help!', 'Gods, no!']), 2.5, '#ffe070');
        else continue;
        if (n.state === 'routine' && source) n.react(source, true, e);
      }
    } else {
      const npcKill = source && source.kind === 'npc' && source.rec && source.rec.inv;
      if (!npcKill) this.stats.kills++;
      if (source && source.kind === 'player') {
        this.sim.careers.onKill(e);
        this.sim.favors.onKill(e);
        if (e.hostileNow) this.rescued(e);
      }
      for (const [item, min, max, chance] of e.S.drops) {
        if (Math.random() > chance) continue;
        const n = min + Math.floor(Math.random() * (max - min + 1));
        if (npcKill) invAdd(source.rec.inv, item, n);
        else this.spawnDrop(item, n, e.x, e.y, e.z, true);
      }
      if (npcKill) source.onKill?.(e);
    }
  }

  // You killed a beast that was after someone: they, their family and
  // anyone who watched are grateful.
  rescued(beast) {
    const saved = new Set();
    for (const n of this.npcs) {
      if (n.dead || n.hired) continue;
      const was = beast.hunting && beast.hunting.n === n && this.sim.abs - beast.hunting.t < 10;
      const hunted = (beast.target === n || was) && beast.distTo(n) <= 8;
      const bitten = beast.victim === n && this.sim.abs - (beast.victimT || -1e9) < 10;
      const scared = n.threat === beast && ['flee', 'fight', 'alert'].includes(n.state);
      if (hunted || bitten || scared) saved.add(n);
    }
    if (!saved.size) return 0;
    const p = this.player;
    const deeds = new Map();
    for (const n of saved) {
      const sid = this.sim.repSidOf(n);
      deeds.set(sid, (deeds.get(sid) || 0) + (n.rec.job === 'guard' ? 1 : 3));
      const gain = n.rec.job === 'guard' ? 3 : 8;
      this.sim.changeRep(n, gain);
      n.say(n.rng.pick(n.rec.job === 'guard' ? ['Good work. I owe you one.', 'Nicely done!'] : ['You saved me! Thank you!', 'Thank the stars you were here!', 'I thought I was done for... thank you!']), 3.5, '#a0e0a0');
      n.face(p.x, p.z);
      const a = this.active.get(n.settlement.id);
      if (!a) continue;
      for (const o of a.npcs) {
        if (o === n || o.dead || saved.has(o)) continue;
        const r = o.rec;
        const fam = r.partner === n.rec.idx || r.children.includes(n.rec.idx) || r.parents.includes(n.rec.idx);
        if (fam) this.sim.changeRep(o, 5);
        else if (o.distTo(beast) <= 10 && this.sim.canSee(o, beast.x, beast.z)) this.sim.changeRep(o, 2);
      }
    }
    this.stats.rescues = (this.stats.rescues || 0) + saved.size;
    for (const [sid, pts] of deeds) this.sim.addRenown(sid, pts, 'saving lives');
    this.ui.msg(saved.size > 1 ? `You saved ${saved.size} people from the ${(beast.name || 'beast').toLowerCase()}.` : `You saved ${[...saved][0].rec.name.first} from the ${(beast.name || 'beast').toLowerCase()}.`, '#a0e0a0');
    return saved.size;
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
    p.sitting = null;
    p.sleeping = false;
    this.sleep = null;
    this.sleepFast = 0;
    // Petty crimes are forgotten; serious ones keep you wanted.
    for (const sid of [...this.wanted.keys()]) {
      this.sim.justice.forgetMinor(sid);
      if (!this.sim.justice.pendingIn(sid).length) this.wanted.delete(sid);
    }
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
        this.sim.justice.forgetMinor(sid);
        const s = this.world.ow.settlements[sid];
        this.ui.msg(`The guards of ${s.name} have lost interest in you.`, '#a0e0a0');
      } else if (t < 1e8) this.wanted.set(sid, nt);
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
    // Night creatures keep their distance from lived-in places.
    const margin = night ? 14 : 6;
    for (const s of ow.settlementsNear(x, z)) {
      const b = s.bounds;
      if (x > b.x0 - margin && x < b.x1 + margin && z > b.z0 - margin && z < b.z1 + margin && s.condition !== 'abandoned' && !s.deserted) return;
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

  // An animal wanders near a hunter (so trappers have something to hunt
  // while the player watches).
  spawnGameNear(n) {
    if (this.creatures.filter((c) => c.S.mode !== 'hostile' && c.species !== 'chicken').length >= 8) return;
    const a = Math.random() * Math.PI * 2;
    const x = Math.round(n.x + Math.cos(a) * 8);
    const z = Math.round(n.z + Math.sin(a) * 6);
    if (!this.world.regionAt(x, z)) return;
    const y = this.world.findStandY(x, z, n.y);
    if (y < 0 || this.world.isWaterAt(x, y, z) || this.entityAt(x, y, z)) return;
    const s = n.settlement;
    const opts = { tundra: ['rabbit'], desert: ['rabbit'], forest: ['deer', 'rabbit', 'boar'], taiga: ['deer', 'rabbit'], savanna: ['deer', 'boar'], jungle: ['boar', 'deer'], swamp: ['boar'] }[s.biome] || ['rabbit', 'deer', 'rabbit'];
    this.addCreature(new Creature(this, opts[Math.floor(Math.random() * opts.length)], x, y, z, Math.floor(Math.random() * 3)));
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

  // Pushing through foliage.
  rustle(x, y, z) {
    const w = this.world;
    const id = LEAVES.has(w.getBlock(x, y + 1, z)) ? w.getBlock(x, y + 1, z) : w.getBlock(x, y, z);
    this.renderer.emit(x, y + 1, z, { n: 5, color: this.blockColor(id), up: 18, speed: 30, life: 0.7, gravity: 30, oy: -4 });
    this.audio?.play('dig');
  }

  onPlayerStep(x, y, z, water) {
    this.audio?.play(water ? 'splash' : 'step');
    this.sim.careers.onStep();
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
      v: 2,
      seed: this.seed,
      minute: this.minute,
      day: this.day,
      player: { x: p.x, y: p.y, z: p.z, hp: p.hp, inv: p.inv, selected: p.selected, spawn: p.spawn },
      regions,
      dead: [...this.deadNpcs].map(([sid, set]) => [sid, [...set]]),
      explored: Array.from(this.world.ow.explored),
      stats: this.stats,
      wanted: [...this.wanted],
      crops: this.crops.serialize(),
      sim: this.sim.serialize(),
    };
  }

  applySave(data) {
    this.minute = data.minute;
    this.day = data.day;
    for (const r of data.regions || []) this.world.saved.set(this.world.regionKey(r.rx, r.rz), r);
    for (const [sid, list] of data.dead || []) this.deadNpcs.set(sid, new Set(list));
    if (data.explored) this.world.ow.explored.set(data.explored);
    if (data.stats) this.stats = data.stats;
    if (data.sim) this.sim.load(data.sim);
    this.crops.load(data.crops);
    for (const [sid, t] of data.wanted || []) this.wanted.set(sid, t);
    const pd = data.player;
    this.loadAround(pd.x, pd.z, true);
    this.player = new Player(this, pd.x, pd.y, pd.z);
    this.player.hp = pd.hp;
    this.player.inv = pd.inv;
    this.player.selected = pd.selected;
    this.player.spawn = pd.spawn;
    this.moveEntity(this.player, pd.x, pd.y, pd.z);
    this.sim.careers.applyLook();
  }
}

function cap(s) {
  return s[0].toUpperCase() + s.slice(1);
}

export { itemForBlock };
