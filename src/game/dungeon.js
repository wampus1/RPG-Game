// Being down in a dungeon (or a Kavorent ruin): its floors made as you
// reach them, in a place apart from the island (see World.inst) while the
// towns carry on above; everything you've done on a floor kept for when
// you're back (chests emptied, gates raised, things killed); the stairs and
// the lifts between floors, a crack in the floor that drops you to the next;
// and its traps and puzzles:
//   loose flagstones that set off arrow slits along the passage;
//   levers that raise iron gates somewhere else on the floor;
//   coffins (a ghoul in some), crumbling walls with rooms behind them;
//   a sealed door that only a sigil opens (its holder's on the floor);
//   three cold braziers in a shrine: light them all;
//   a flooded hall a lever drains;
// and the Kavorent's: emitters firing across a hall in turn, walls of light
// a console's glyph drops (tread the plate that matches), plates to tread
// in the order a console shows, rings of power nodes to put out, vaults
// under glyph seals.
import { buildFloor, FY, DTYPES } from '../world/dungeongen.js';
import { Region } from '../world/region.js';
import { B, BLOCKS, META_STATE } from '../world/blocks.js';
import { ITEMS } from '../world/items.js';
import { Creature } from '../entities/creature.js';
import { addHazard, lineTiles } from '../entities/monsters.js';
import { countItem, removeItem } from './inventory.js';
import { hash4 } from '../util/rng.js';
import { restamp } from '../world/sites.js';
import { dropFields, raiseFields } from './kavtech.js';

const GLYPHS = ['the ring', 'the eye', 'the three bars', 'the spiral'];
// Kinds of block a dungeon handles itself (see Game.interact).
export const DUNGEON_INTERACTS = new Set(['dungeon', 'stairs', 'lever', 'portcullis', 'sealed', 'coffin', 'brazier', 'kav_pillar', 'kav_lift', 'kav_console', 'kav_node']);

export class DungeonRun {
  constructor(game, rec) {
    this.game = game;
    this.rec = rec;
    this.T = DTYPES[rec.type];
    this.floor = 0;
    this.data = null;
    this.state = null;
    this.t = 0;
    this.stash = null;
    this.plateOn = new Map();
    this.crumble = null;
    this.dripT = 2;
  }

  get kav() {
    return this.rec.type === 'kavorent';
  }

  // ------------------------------------------------------------ going down
  // From the surface: everything up there is put by (the beasts about you,
  // the birds), and you're on the first floor.
  enter() {
    const game = this.game;
    const p = game.player;
    this.surface = { x: p.x, y: p.y, z: p.z };
    this.rec.entered = true;
    this.rec.known = true;
    // (What was about you up there waits where it was.)
    this.stash = { creatures: game.creatures, drops: game.drops };
    for (const c of game.creatures) game.removeOcc(c);
    game.creatures = [];
    game.drops = [];
    game.projectiles = [];
    game.hazards = [];
    game.wildlife?.clear();
    game.weather = null;
    game.dungeon = this;
    game.mining = null;
    this.open(0, 'top');
    game.updateSettlements(true);
    game.ui.msg(this.kav ? `The lift sinks into the dark. ${cap(this.rec.name)}: floor 1 of ${this.rec.depth}.` : `You go down into ${this.rec.name}. (Floor 1 of ${this.rec.depth}.)`, '#e0c890');
    if (this.rec.cleared) game.ui.msg('It\'s quiet down here now.', '#c8c8c8');
    game.audio?.play(this.kav ? 'lift' : 'door');
    game.renderer.flashScreen?.('#000000', 0.6);
  }

  // Back up to the surface (or a respawn): the floor's kept, the place
  // apart is gone, and what was up there comes back.
  leave(to = null) {
    const game = this.game;
    this.saveFloor();
    this.clearFloor();
    game.world.setInstance(null);
    game.dungeon = null;
    game.hazards = [];
    game.bulwarks = [];
    game.lodestar = null;
    game.projectiles = [];
    if (this.stash) {
      game.creatures = this.stash.creatures.filter((c) => !c.dead);
      game.drops = this.stash.drops.filter((d) => !d.dead);
      this.stash = null;
    }
    const site = game.sim.dungeons.site(this.rec);
    // (Beaten: the way in falls shut behind you.)
    if (this.rec.cleared && site && this.rec.type !== 'kavorent') {
      site.state = { ...(site.state || {}), cleared: true };
    }
    const at = to || this.exitSpot();
    game.loadAround(at.x, at.z, true);
    if (this.rec.cleared && site && this.rec.type !== 'kavorent') restamp(game.world, site);
    for (const c of game.creatures) if (!c.dead) game.moveEntity(c, c.x, c.y, c.z);
    const spot = game.findFreeSpot(at.x, at.z, at.y);
    game.player.teleport(spot.x, spot.y, spot.z);
    game.renderer.camInit = false;
    game.lightDirty = true;
    game.updateSettlements(true);
    game.ui.msg(this.rec.cleared ? `You climb out of ${this.rec.name} into the air. Behind you, the way down falls in.` : `You climb back up into the air.`, '#e0c890');
    game.renderer.flashScreen?.('#ffffff', 0.25);
  }

  // Where you come out: in front of the way in.
  exitSpot() {
    const r = this.rec;
    const s = this.game.sim.dungeons.site(r);
    const h = (s && s.h) || 5;
    if (r.type === 'kavorent') {
      const side = r.spire && r.spire.open !== null && r.spire.open !== undefined ? r.spire.open : 0;
      const [ox, oz] = [[0, 4], [-4, 0], [0, -4], [4, 0]][side];
      return { x: r.x + ox, y: h + 1, z: r.z + oz };
    }
    const off = { barrow: [0, 5], holdout: [0, 3], crypt: [0, 2], mine: [0, 2] }[r.type] || [0, 2];
    return { x: r.x + off[0], y: h + 1, z: r.z + off[1] };
  }

  // ------------------------------------------------------------ floors
  // Make floor `n` (as it was left, if you've been) and put you on it:
  // `arrive` 'top' (the way in), 'bottom' (by the way down), or a spot
  // (fallen through).
  open(n, arrive) {
    const game = this.game;
    this.floor = n;
    const data = buildFloor(this.rec, n);
    const saved = this.rec.floors[n];
    if (saved && saved.regions) for (const sr of saved.regions) data.regions.set(sr.rx * 4096 + sr.rz, Region.deserialize(sr));
    this.data = data;
    this.state = saved && saved.state ? saved.state : { killed: [], solved: {}, nodes: {}, step: {}, fallen: false, looted: false };
    game.world.setInstance({ regions: data.regions, floor: n });
    // First time down here: adventurers have been before you, perhaps.
    if (!saved) this.firstVisit();
    // Who's still about.
    for (const s of data.spawns) {
      if (this.state.killed.includes(s.id)) continue;
      // (What adventurers cut down before you came stays down; never the master.)
      if (!s.boss && !s.key && (hash4(this.rec.seed, n, s.id) % 100) / 100 < this.rec.weakened * 0.8) continue;
      if (this.rec.cleared && s.boss) continue;
      const y = game.world.findStandY(s.x, s.z, FY);
      const c = this.spawn(s.species, s.x, y > 0 ? y : FY, s.z, { id: s.id, boss: s.boss, key: s.key, ambush: s.ambush });
      if (c && s.species === 'golem' && !s.boss) c.dormant = 5;
      // (A foundry's Prime: standing still till you're well inside.)
      if (c && s.guardian) {
        c.dormant = 6;
        c.guardian = true;
        c.isBoss = true;
      }
    }
    // Where you come in.
    let at;
    if (arrive === 'top') at = { x: data.up.x, z: data.up.z + 1 };
    else if (arrive === 'bottom') at = data.down ? { x: data.down.x + 1, z: data.down.z } : data.entry;
    else at = arrive;
    const y = game.world.findStandY(at.x, at.z, FY);
    const spot = game.world.canStand(at.x, y, at.z) && !game.occupiedBySolid(at.x, y, at.z, game.player) ? { x: at.x, y, z: at.z } : game.findFreeSpot(at.x, at.z, FY);
    game.player.teleport(spot.x, spot.y, spot.z);
    game.renderer.camInit = false;
    game.lightDirty = true;
    this.plateOn.clear();
    this.crumble = null;
    this.arriveT = 1;
  }

  // The first time a floor's opened: chests adventurers have been at are
  // lighter, and those of them who died down here left their gear.
  firstVisit() {
    const game = this.game;
    const w = game.world;
    const looted = this.rec.looted || 0;
    if (looted > 0) {
      for (const r of this.data.regions.values()) {
        for (const [i, slots] of r.containers) {
          if (((hash4(this.rec.seed, i, this.floor) % 100) / 100) >= looted) continue;
          for (let k = 0; k < slots.length; k++) if (slots[k] && (k % 3 !== 0)) slots[k] = null;
        }
      }
    }
    // The ruin's cores: those adventurers carried off before you came are
    // gone from where they lay; those still here are yours to find (and
    // nobody else's now).
    if (this.kav) {
      for (const r of this.data.regions.values()) {
        for (const slots of r.containers.values()) {
          for (let k = 0; k < slots.length; k++) {
            if (!slots[k] || slots[k].item !== 'kav_core') continue;
            if ((this.rec.coresGone || 0) > 0) {
              slots[k] = { item: 'kav_scrap', count: 3 };
              this.rec.coresGone--;
              r.modified = true;
            } else this.rec.cores = Math.max(0, (this.rec.cores ?? 4) - 1);
          }
        }
      }
    }
    for (const f of this.rec.fallen || []) {
      if (f.floor !== this.floor || f.placed) continue;
      const room = this.data.rooms.filter((q) => q.kit !== 'entry' && q.kit !== 'boss')[f.name.length % Math.max(1, this.data.rooms.length - 2)];
      if (!room) continue;
      const x = this.data.x0 + room.cx;
      const z = room.cz;
      if (w.getBlock(x, FY, z) !== B.air) continue;
      w.setBlock(x, FY, z, B.chest, 0);
      const slots = w.getContainer(x, FY, z);
      slots.fill(null);
      const gear = [f.gear.weapon, f.gear.bow, ...Object.values(f.gear.wear || {})].filter((k) => k && ITEMS[k]);
      gear.slice(0, 7).forEach((k, j) => {
        slots[j] = { item: k, count: 1 };
      });
      if (f.coins) slots[8] = { item: 'coin', count: Math.min(64, f.coins) };
      w.setBlock(x + 1, FY, z, B.bones, 0);
      f.placed = true;
      this.notes = [...(this.notes || []), { x, z, text: `The remains of ${f.name}, an adventurer, and their pack.` }];
    }
  }

  // Keep this floor as it is now (blocks and what's in the chests; who's
  // dead), for when you're back.
  saveFloor() {
    if (!this.data) return;
    // (Not a Field Projector's wall: that's only for the moment.)
    dropFields(this.game);
    const regions = [];
    for (const r of this.data.regions.values()) if (r.modified) regions.push(r.serialize());
    this.rec.floors[this.floor] = { regions, state: this.state };
    raiseFields(this.game);
  }

  // Off this floor: its things go (they're kept, or will be made again).
  clearFloor() {
    const game = this.game;
    for (const c of game.creatures) {
      game.removeOcc(c);
      c.dead = true;
    }
    game.creatures = [];
    game.drops = [];
    game.hazards = [];
    game.projectiles = [];
    game.flames = [];
    for (const n of game.npcs) if (n.inDungeon) game.despawnNpc?.(n);
  }

  // To another floor (`dir` +1 down, -1 up): this one kept, that one made.
  changeFloor(dir, arrive = null) {
    const game = this.game;
    const to = this.floor + dir;
    if (to < 0) return this.leave();
    if (to >= this.rec.depth) return false;
    this.saveFloor();
    this.clearFloor();
    this.open(to, arrive || (dir > 0 ? 'top' : 'bottom'));
    game.ui.msg(`${dir > 0 ? 'Down' : 'Up'} to floor ${to + 1} of ${this.rec.depth}.${to === this.rec.depth - 1 && !this.rec.cleared ? ' Something old waits down here.' : ''}`, '#e0c890');
    game.audio?.play(this.kav ? 'lift' : 'step_stone');
    game.renderer.flashScreen?.('#000000', 0.5);
    return true;
  }

  // Something of the place's, made and set loose.
  spawn(species, x, y, z, o = {}) {
    const game = this.game;
    const c = new Creature(game, species, x, y, z, o.variant || 0);
    const lvl = (this.rec.level || 1) + this.floor * 0.5 + (this.rec.cleared ? 0 : 0);
    c.inst = true;
    c.level = lvl;
    c.maxHp = c.hp = Math.round(c.S.hp * (1 + 0.3 * (lvl - 1)));
    c.dmgMult = 1 + 0.15 * (lvl - 1);
    c.spawnId = o.id;
    c.carries = o.key || null;
    c.home = { x, z };
    if (o.ambush) c.dormant = 2;
    if (species === 'drowned' && game.world.isWaterAt(x, y, z)) c.submerged = true;
    if (o.boss) c.isBoss = true;
    game.addCreature(c);
    return c;
  }

  // ------------------------------------------------------------ each frame
  update(dt) {
    const game = this.game;
    const p = game.player;
    this.t += dt;
    if (this.arriveT > 0) this.arriveT -= dt;
    // The dead stirring as you pass; golems waking.
    for (const c of game.creatures) {
      if (!c.dormant || c.dead) continue;
      const d = Math.max(Math.abs(c.x - p.x), Math.abs(c.z - p.z));
      if (d <= c.dormant || c.hp < c.maxHp) {
        c.dormant = 0;
        game.renderer.emit(c.x, c.y + 1, c.z, { n: 10, color: c.S.construct ? ['#5ad8f0', '#ffffff'] : ['#8a8270', '#d8d0b8'], up: 30, speed: 40, life: 0.5 });
        game.audio?.play(c.S.construct ? 'hum' : 'scream', c);
        if (c.S.construct) game.renderer.floatText(c.x, c.y + 2.6, c.z, 'ACTIVATED', '#5ad8f0');
      }
    }
    // Plates trodden on (by anyone: the dead set traps off too).
    for (const e of [p, ...game.creatures]) {
      if (!e || e.dead || e.burrowed || e.S?.floats) continue;
      const k = `${e.x},${e.z}`;
      const prev = this.plateOn.get(e);
      if (prev === k) continue;
      this.plateOn.set(e, k);
      const id = game.world.getBlock(e.x, e.y, e.z);
      if (id === B.pressure_plate) this.plate(e.x, e.z, e);
      else if (id === B.kav_plate && e === p) this.glyphPlate(e.x, e.z);
    }
    // A cracked floor giving way under you.
    if (this.crumble) {
      this.crumble.t -= dt;
      if (Math.random() < dt * 20) game.renderer.emit(this.crumble.x, FY - 0.5, this.crumble.z, { n: 1, color: ['#5a5650', '#3a3632'], up: 4, speed: 10, life: 0.4, oy: 8 });
      if (this.crumble.t <= 0) {
        const c = this.crumble;
        this.crumble = null;
        game.world.setBlock(c.x, FY - 1, c.z, B.air);
        if (p.x === c.x && p.z === c.z && !p.dead) return this.fall(c.x, c.z);
      }
    }
    // The Kavorent's emitters, firing across their halls in turn.
    for (const em of this.data.emitters) {
      if (Math.abs(em.x - p.x) > 16 || Math.abs(em.z - p.z) > 12) continue;
      em.t = (em.t ?? em.phase) + dt;
      if (em.t < 3.4) continue;
      em.t = 0;
      const to = { x: em.x + em.dx * (em.len + 1), z: em.z + em.dz * (em.len + 1) };
      const tiles = lineTiles(game, { x: em.x, y: FY, z: em.z }, to, em.len + 1);
      addHazard(game, { tiles, y: FY, dur: 1.0, dmg: Math.round(3 + this.floor * 0.6), kind: 'beam', from: { x: em.x, z: em.z }, to: tiles[tiles.length - 1] || to, color: [255, 70, 50], trap: true });
    }
    // Power nodes put out come back on (in the Overseer's hall).
    for (const nd of this.data.nodes) {
      if (!nd.boss || !nd.offT) continue;
      nd.offT -= dt;
      if (nd.offT <= 0 && !this.bossDead()) {
        nd.offT = 0;
        game.world.setState(nd.x, FY, nd.z, true);
        game.renderer.emit(nd.x, FY + 1, nd.z, { n: 8, color: ['#5af0c8', '#ffffff'], up: 20, life: 0.5, glow: true });
        game.ui.msg('A power node flares back to life!', '#5ad8f0', true);
        game.audio?.play('hum', nd);
      }
    }
    // Water dripping in the dark.
    this.dripT -= dt;
    if (this.dripT <= 0) {
      this.dripT = 3 + Math.random() * 6;
      if (!this.kav) game.audio?.play(Math.random() < 0.7 ? 'pour' : 'creak');
      else game.audio?.play('hum');
    }
    // Notes left (an adventurer's remains): told as you come near.
    for (const nt of this.notes || []) {
      if (nt.told || Math.abs(nt.x - p.x) > 3 || Math.abs(nt.z - p.z) > 3) continue;
      nt.told = true;
      game.ui.msg(nt.text, '#c8b8a0');
    }
  }

  bossDead() {
    return this.rec.cleared;
  }

  // Overseer shield: how many of its hall's nodes still burn.
  liveNodes() {
    let n = 0;
    for (const nd of this.data.nodes) if (nd.boss && this.game.world.getState(nd.x, FY, nd.z)) n++;
    return n;
  }

  // ------------------------------------------------------------ stepping
  // You've stepped onto (x, y, z).
  onStep(x, y, z) {
    const game = this.game;
    if (this.arriveT > 0) return;
    const below = game.world.getBlock(x, y - 1, z);
    if (below === B.stairs_down || below === B.mine_shaft) return this.changeFloor(1);
    if (below === B.cracked_floor && !this.crumble) {
      this.crumble = { x, z, t: 0.6 };
      game.ui.msg('The floor cracks under your feet!', '#ffb080', true);
      game.audio?.play('crumble');
      game.shake = Math.min(1, (game.shake || 0) + 0.3);
    }
    const at = game.world.getBlock(x, y, z);
    if (at === B.stairs_up) return this.changeFloor(-1);
    if (below === B.kav_lift && !this.liftTold) {
      this.liftTold = true;
      game.ui.msg('A lift platform, humming under your feet. (Click it, or face it and press F, to ride it.)', '#5ad8f0');
    }
    return false;
  }

  // Through the floor, onto the next one down (hurt a little).
  fall(x, z) {
    const game = this.game;
    if (this.floor + 1 >= this.rec.depth) return false;
    game.ui.msg('The floor gives way!', '#ff9060');
    game.audio?.play('crumble');
    this.changeFloor(1, { x, z });
    game.damage(game.player, 3, null);
    game.shake = 1;
    return true;
  }

  // A loose flagstone trodden on: the slits along it fire.
  plate(x, z, by) {
    const game = this.game;
    const pl = this.data.plates.find((q) => q.x === x && q.z === z);
    if (!pl) return;
    game.audio?.play('click', { x, z });
    if (by === game.player) game.renderer.floatText(x, FY + 1.6, z, 'click!', '#e0c8a0');
    for (const s of pl.slits) {
      const to = { x: s.x + s.dx * 12, z: s.z + s.dz * 12 };
      const tiles = lineTiles(game, { x: s.x, y: FY, z: s.z }, to, 12);
      addHazard(game, { tiles, y: FY, dur: 0.45, dmg: Math.round(3 + this.floor + (this.rec.level || 1)), kind: 'dart', from: { x: s.x, z: s.z }, to: tiles[tiles.length - 1] || to, color: [255, 200, 120], trap: true });
    }
  }

  // A glyph plate trodden on: is it the one the console wants?
  glyphPlate(x, z) {
    const game = this.game;
    for (const con of this.data.consoles) {
      const pl = con.plates.find((q) => q.x === x && q.z === z);
      if (!pl || this.state.solved[`${con.x},${con.z}`]) continue;
      const key = `${con.x},${con.z}`;
      if (con.order) {
        const step = this.state.step[key] || 0;
        if (con.order[step] === con.plates.indexOf(pl)) {
          this.state.step[key] = step + 1;
          game.renderer.emit(x, FY + 0.5, z, { n: 6, color: ['#7affb0', '#ffffff'], up: 14, life: 0.5, glow: true });
          game.audio?.play('rune', { x, z });
          if (step + 1 >= con.order.length) this.solve(con);
        } else {
          this.state.step[key] = 0;
          this.zap(x, z);
        }
      } else if (con.plates.indexOf(pl) === con.answer) this.solve(con);
      else this.zap(x, z);
      return;
    }
  }

  zap(x, z) {
    const game = this.game;
    game.ui.msg('The glyph flares red under your feet!', '#ff7060', true);
    addHazard(game, { tiles: [{ x, z }], y: FY, dur: 0.15, dmg: 3, stun: 0.5, kind: 'burst', center: { x, z }, color: [255, 80, 60], trap: true });
  }

  solve(con) {
    const game = this.game;
    const w = game.world;
    this.state.solved[`${con.x},${con.z}`] = true;
    w.setState(con.x, FY, con.z, true);
    for (const f of con.fields || []) {
      for (const y of [FY, FY + 1]) if (w.getBlock(f.x, y, f.z) === B.kav_field) w.setBlock(f.x, y, f.z, B.air);
      game.renderer.emit(f.x, FY + 1, f.z, { n: 16, color: ['#5ad8f0', '#e0fbff'], up: 30, speed: 30, life: 0.7, glow: true });
    }
    if (con.cache) game.ui.msg('Somewhere in the room, a cache unseals with a sigh of air.', '#7affb0');
    game.ui.msg('The console chimes. The way is open.', '#7affb0');
    game.audio?.play('secret');
    game.lightDirty = true;
  }

  // ------------------------------------------------------------ hands on
  // (x, y, z) clicked (or faced and F pressed). True if it was ours.
  interact(x, y, z, b) {
    const game = this.game;
    const w = game.world;
    const p = game.player;
    switch (b.interact) {
      case 'stairs':
        if (b.id === B.stairs_up) this.changeFloor(-1);
        else this.changeFloor(1);
        return true;
      case 'kav_lift': {
        const d = this.data;
        if (d.up && d.up.x === x && d.up.z === z) {
          if (this.floor === 0) this.leave();
          else this.changeFloor(-1);
        } else if (d.down && d.down.x === x && d.down.z === z) this.changeFloor(1);
        return true;
      }
      case 'lever': {
        const on = !w.getState(x, y, z);
        w.setState(x, y, z, on);
        game.audio?.play('lever', { x, z });
        const lv = this.data.levers.find((q) => q.x === x && q.z === z);
        if (lv) {
          for (const g of lv.gates) {
            const cur = w.getBlock(g.x, FY, g.z);
            if (cur === B.portcullis || cur === B.portcullis_up) w.setBlock(g.x, FY, g.z, on ? B.portcullis_up : B.portcullis, g.rot);
          }
          game.audio?.play('gate');
          game.ui.msg(on ? 'Somewhere, chains rattle and an iron gate grinds up.' : 'Somewhere, an iron gate crashes down.', '#c8c8c8');
          game.shake = Math.min(1, (game.shake || 0) + 0.2);
        }
        const dr = this.data.drains.find((q) => q.lever.x === x && q.lever.z === z);
        if (dr && on && !this.state.solved[`drain${x},${z}`]) {
          this.state.solved[`drain${x},${z}`] = true;
          for (const q of dr.water) if (w.getBlock(q.x, FY, q.z) === B.water) w.setBlock(q.x, FY, q.z, B.air);
          game.ui.msg('A sluice opens: the black water drains away with a long gurgle.', '#80c8e0');
          game.audio?.play('pour');
          for (const c of game.creatures) if (c.submerged) {
            c.submerged = false;
            c.stunT = 0.5;
          }
        }
        return true;
      }
      case 'portcullis':
        game.ui.msg('The iron gate won\'t budge. There must be a lever somewhere.', '#c8c8c8');
        return true;
      case 'sealed': {
        const key = b.id === B.kav_seal ? 'kav_key' : 'sigil';
        if (countItem(p.inv, key) <= 0) {
          game.ui.msg(b.id === B.kav_seal ? 'A vault seal: a hollow in it the shape of a glyph key. Something on this floor carries one.' : 'A sealed door, its sigil cut deep. Whoever holds the sigil to it is somewhere on this floor.', '#e0c890');
          return true;
        }
        removeItem(p.inv, key, 1);
        for (const yy of [FY, FY + 1]) if (w.getBlock(x, yy, z) === b.id) w.setBlock(x, yy, z, B.air);
        game.renderer.emit(x, FY + 1, z, { n: 20, color: b.id === B.kav_seal ? ['#5ad8f0', '#ffffff'] : ['#e8c060', '#ffffff'], up: 30, speed: 40, life: 0.8, glow: true });
        game.ui.msg('The seal turns, and the door grinds open.', '#ffe070');
        game.audio?.play('secret');
        game.audio?.play('gate');
        return true;
      }
      case 'coffin': {
        const open = w.getState(x, y, z);
        if (open) {
          const slots = w.getContainer(x, y, z);
          game.ui.openContainer(b.label, slots, { x, y, z, owner: null });
          return true;
        }
        w.setState(x, y, z, true);
        game.audio?.play('creak', { x, z });
        const cf = this.data.coffins.find((q) => q.x === x && q.z === z);
        if (cf && cf.ghoul && !this.state.solved[`coffin${x},${z}`]) {
          this.state.solved[`coffin${x},${z}`] = true;
          const at = game.findFreeSpot(x, z + 1, FY);
          const c = this.spawn('ghoul', at.x, at.y, at.z);
          c.target = p;
          game.renderer.emit(x, FY + 1, z, { n: 16, color: ['#8a8270', '#3a3428', '#d8d0b8'], up: 30, speed: 40, life: 0.6 });
          game.audio?.play('scream', c);
          game.ui.msg('Something bursts out of the coffin!', '#ff9060');
        } else game.ui.msg('You shove the lid aside.', '#c8c8c8');
        return true;
      }
      case 'brazier': {
        if (w.getState(x, y, z)) return true;
        const held = p.heldItem();
        const fire = held === 'torch' || held === 'lantern' || p.equip.shield === 'torch' || p.equip.shield === 'lantern';
        if (!fire) {
          game.ui.msg('A brazier, gone cold. You\'d need a flame to light it.', '#c8c8c8');
          return true;
        }
        w.setState(x, y, z, true);
        game.lightDirty = true;
        game.audio?.play('fire', { x, z });
        game.renderer.emit(x, FY + 1, z, { n: 10, color: ['#ffb040', '#ffe070'], up: 30, life: 0.6 });
        for (const set of this.data.braziers) {
          if (this.state.solved[`br${set.reward.x},${set.reward.z}`]) continue;
          if (!set.set.every((q) => w.getState(q.x, FY, q.z))) continue;
          this.state.solved[`br${set.reward.x},${set.reward.z}`] = true;
          game.ui.msg('The last brazier catches, and the altar answers: something shines on it.', '#ffe070');
          game.audio?.play('secret');
          const item = set.relic || 'old_blueprint';
          game.spawnDrop(item, 1, set.reward.x, FY, set.reward.z, true);
          if (!set.relic) game.spawnDrop('old_coin', 12, set.reward.x, FY, set.reward.z, true);
          game.renderer.effect?.({ type: 'ring', wx: set.reward.x, wy: FY, wz: set.reward.z, r0: 2, r1: 26, color: ['#ffe070', '#ffffff'], life: 0.8, oy: 4, flat: 0.5 });
        }
        return true;
      }
      case 'kav_console': {
        const con = this.data.consoles.find((q) => q.x === x && q.z === z);
        if (!con) {
          game.ui.msg('Glyphs scroll across the console, meaning nothing you can read.', '#5ad8f0');
          return true;
        }
        if (this.state.solved[`${con.x},${con.z}`]) {
          game.ui.msg('The console glows a steady green.', '#7affb0');
          return true;
        }
        game.audio?.play('rune', { x, z });
        if (con.order) game.ui.msg(`The console shows three glyphs, one after another: ${con.order.map((i) => GLYPHS[con.plates[i].glyph]).join(', then ')}. (Tread the plates in that order.)`, '#5ad8f0');
        else game.ui.msg(`The console shows a single glyph: ${GLYPHS[con.plates[con.answer].glyph]}. (Tread the plate that bears it.)`, '#5ad8f0');
        return true;
      }
      case 'kav_node': {
        if (!w.getState(x, y, z)) {
          game.ui.msg('The node is dark.', '#c8c8c8');
          return true;
        }
        w.setState(x, y, z, false);
        game.lightDirty = true;
        game.audio?.play('thunder', { x, z });
        game.renderer.emit(x, FY + 1, z, { n: 14, color: ['#5af0c8', '#ffffff', '#fff8a0'], up: 30, speed: 50, life: 0.5, glow: true });
        game.damage(p, 1, null);
        for (const nd of this.data.nodes) {
          if (nd.boss && nd.x === x && nd.z === z) {
            nd.offT = 15;
            const left = this.liveNodes();
            game.ui.msg(left ? `A power node goes dark. ${left} still burn${left === 1 ? 's' : ''}.` : 'The last node dies: the Overseer\'s shield flickers out!', left ? '#5ad8f0' : '#ffe070');
          }
          if (nd.set && nd.set.some((q) => q.x === x && q.z === z) && nd.set.every((q) => !w.getState(q.x, FY, q.z)) && !this.state.solved[`rx${x},${z}`]) {
            for (const q of nd.set) this.state.solved[`rx${q.x},${q.z}`] = true;
            for (const f of nd.field || []) for (const yy of [FY, FY + 1]) if (w.getBlock(f.x, yy, f.z) === B.kav_field) w.setBlock(f.x, yy, f.z, B.air);
            game.ui.msg('The ring of nodes is dark: the housing in the middle of the room opens.', '#7affb0');
            game.audio?.play('secret');
          }
        }
        return true;
      }
    }
    return false;
  }

  // A container in here, opened: a glyph-locked cache stays shut.
  locked(x, z) {
    for (const con of this.data.consoles) if (con.cache && con.cache.x === x && con.cache.z === z && !this.state.solved[`${con.x},${con.z}`]) return true;
    return false;
  }

  // ------------------------------------------------------------ the dead
  onKill(e) {
    const game = this.game;
    if (e.spawnId !== undefined && !this.state.killed.includes(e.spawnId)) this.state.killed.push(e.spawnId);
    if (e.carries) {
      game.spawnDrop(e.carries, 1, e.x, e.y, e.z, true);
      game.ui.msg(e.carries === 'sigil' ? `${e.S.name} drops a bronze sigil.` : `${e.S.name} drops a glyph key.`, '#ffe070');
    }
    if (e.isBoss && (e.species === this.T.boss || e.species === this.T.altBoss) && !this.rec.cleared) {
      game.sim.dungeons.cleared(this.rec, 'you');
      game.ui.msg(`${e.S.name} falls. ${cap(this.rec.name)} is beaten!`, '#ffe070');
      game.audio?.play('fanfare');
      game.renderer.flashScreen?.('#fff4c8', 0.4);
      game.shake = 1.2;
      // The rest of the place's things lose heart (the dead fall still).
      for (const c of game.creatures) if (!c.dead && c !== e && (c.S.undead || c.S.construct) && Math.max(Math.abs(c.x - e.x), Math.abs(c.z - e.z)) < 20) c.stunT = 3;
      if (this.kav) {
        game.ui.msg('The ruin\'s hum dies away. Somewhere above, the runes on the spire go out.', '#5ad8f0');
        game.spawnDrop('kav_core', 1, e.x, e.y, e.z, true);
        this.rec.cores = Math.max(0, (this.rec.cores ?? 4) - 1);
      }
    }
  }

  // ------------------------------------------------------------ saving
  serialize() {
    this.saveFloor();
    const p = this.game.player;
    return { id: this.rec.id, floor: this.floor, x: p.x, z: p.z, surface: this.surface };
  }
}

function cap(s) {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

export { BLOCKS, META_STATE };
