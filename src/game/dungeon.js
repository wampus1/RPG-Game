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
import { buildFloor, FY, DTYPES, kavFloor, SPIKE_CYCLE } from '../world/dungeongen.js';
import { Region } from '../world/region.js';
import { B, BLOCKS, META_STATE } from '../world/blocks.js';
import { ITEMS, RELICS } from '../world/items.js';
import { relicAt, placeTag, RELIC_R } from './relics.js';
import { Creature } from '../entities/creature.js';
import { fits, fitNear } from '../entities/footprint.js';
import { addHazard, lineTiles, areaTiles, BOSS_TITLES, sporeCloud, sentinelDown } from '../entities/monsters.js';
import { countItem, removeItem, addItem, canAdd } from './inventory.js';
import { hash4 } from '../util/rng.js';
import { restamp } from '../world/sites.js';
import { dropFields, raiseFields } from './kavtech.js';
import { bossEntrance, bossDefeat } from './scenes.js';

const GLYPHS = ['the ring', 'the eye', 'the three bars', 'the spiral'];
// Which way floors are laid out (see dungeongen.js). A floor kept from an
// older way is made afresh rather than patched onto a new plan.
const FLOOR_GEN = 4;
// How much tougher a floor's master is than its kind (its health, its
// blows).
export const BOSS_HP = 1.3;
export const BOSS_DMG = 1.15;
// Kinds of block a dungeon handles itself (see Game.interact).
export const DUNGEON_INTERACTS = new Set(['dungeon', 'stairs', 'lever', 'portcullis', 'sealed', 'coffin', 'brazier', 'kav_pillar', 'kav_lift', 'kav_console', 'kav_node', 'boss_gate', 'idol']);

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
    this.fight = null;
    this.hazardT = 20;
    this.moteT = 0;
  }

  get kav() {
    return this.rec.type === 'kavorent';
  }

  // This floor's colours (each of a Kavorent ruin's floors is lit its own;
  // see KAV_FLOORS).
  get pal() {
    return this.kav ? kavFloor(this.floor, this.rec.depth) : null;
  }

  // ------------------------------------------------------------ going down
  // From the surface: everything up there is put by (the beasts about you,
  // the birds), and you're on the first floor.
  enter() {
    const game = this.game;
    const p = game.player;
    this.surface = { x: p.x, y: p.y, z: p.z };
    // (What you came down with: anything more you find below isn't yours
    // for keeps till you've brought it back up. See unbound.)
    this.carried = Object.fromEntries(holdings(p));
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
    // Up and out alive with what you found: it's yours now.
    if (!game.player.dead && this.unbound().length) game.ui.msg('Up in the daylight, what you found below is yours to keep.', '#ffe070');
    this.carried = null;
    this.saveFloor();
    this.clearFloor();
    game.world.setInstance(null);
    game.dungeon = null;
    game.hazards = [];
    game.zones = [];
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
    const kept = this.rec.floors[n];
    const saved = kept && kept.gen === FLOOR_GEN ? kept : null;
    if (saved && saved.regions) for (const sr of saved.regions) data.regions.set(sr.rx * 4096 + sr.rz, Region.deserialize(sr));
    this.data = data;
    this.state = saved && saved.state ? saved.state : { killed: [], solved: {}, nodes: {}, step: {}, fallen: false, looted: false };
    // (What you've built down here: a master will smash through it.)
    this.placed = new Set(this.state.placed || []);
    game.world.setInstance({ regions: data.regions, floor: n, maxY: FY });
    // First time down here: adventurers have been before you, perhaps.
    if (!saved) this.firstVisit();
    // Your own pack, where you fell (told as you come near it).
    const pk = this.rec.pack;
    if (pk && pk.floor === n) {
      if (game.world.getBlock(pk.x, FY, pk.z) === B.satchel) this.notes = [...(this.notes || []).filter((q) => !q.pack), { x: pk.x, z: pk.z, floor: n, pack: true, text: 'Your pack, where you fell. What you found is still in it.' }];
      else this.rec.pack = null;
    }
    // The relic on the sealed vault's plinth (what kind it is, remembered).
    const ra = data.relicAt;
    if (ra && game.world.getBlock(ra.x, FY, ra.z) === B.relic && !relicAt(game, ra.x, FY, ra.z)) {
      if (!game.relics) game.relics = new Map();
      game.relics.set(`${ra.x},${FY},${ra.z}`, { x: ra.x, y: FY, z: ra.z, kind: ra.kind, r: RELIC_R, inst: placeTag(game) });
    }
    // Who's still about.
    for (const s of data.spawns) {
      if (this.state.killed.includes(s.id)) continue;
      // (What adventurers cut down before you came stays down; never the master.)
      if (!s.boss && !s.key && (hash4(this.rec.seed, n, s.id) % 100) / 100 < this.rec.weakened * 0.8) continue;
      if (this.rec.cleared && s.boss) continue;
      const y = game.world.findStandY(s.x, s.z, FY);
      const c = this.spawn(s.species, s.x, y > 0 ? y : FY, s.z, { id: s.id, boss: s.boss, key: s.key, ambush: s.ambush, infected: s.infected });
      if (c && s.species === 'golem' && !s.boss) c.dormant = 5;
      // (A great master stood where all of it fits: never half in a wall.)
      if (c && c.foot && !fits(game, c, c.x, c.y, c.z, true)) {
        const f = fitNear(game, c, c.x, c.z, c.y, 8);
        if (f) {
          game.removeOcc(c);
          c.teleport(f.x, f.y, f.z);
          game.moveEntity(c, f.x, f.y, f.z);
        }
      }
      // (The master keeps to its hall, and waits there till you come in.)
      if (c && s.boss && data.bossRoom) {
        c.leash = data.bossRoom;
        c.waiting = true;
        c.dormant = 1;
      }
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
    else at = this.landing(arrive.x, arrive.z);
    const y = game.world.findStandY(at.x, at.z, FY);
    const spot = game.world.canStand(at.x, y, at.z) && !game.occupiedBySolid(at.x, y, at.z, game.player) ? { x: at.x, y, z: at.z } : game.findFreeSpot(at.x, at.z, FY);
    game.player.teleport(spot.x, spot.y, spot.z);
    game.renderer.camInit = false;
    game.lightDirty = true;
    this.plateOn.clear();
    this.crumble = null;
    this.arriveT = 1;
    this.fight = null;
    // (A gate left up on a master still living comes down again.)
    const g = data.bossGate;
    if (g && !this.rec.cleared && game.world.getBlock(g.x, FY, g.z) === B.boss_gate_open) game.world.setBlock(g.x, FY, g.z, B.boss_gate, g.rot);
  }

  // Where you come down, through a floor that gave way above: the nearest
  // floor of a room to the spot (never the top of a wall, nor solid rock;
  // nor the master's hall, nor a sealed vault).
  landing(x, z) {
    const d = this.data;
    const P = d.plan;
    const game = this.game;
    const lx = x - d.x0;
    let best = null;
    for (let r = 0; r < 40 && !best; r++) {
      for (let dz = -r; dz <= r; dz++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
          const tx = lx + dx;
          const tz = z + dz;
          if (tx < 1 || tz < 1 || tx >= P.W - 1 || tz >= P.D - 1) continue;
          const ri = P.room[tz * P.W + tx];
          if (ri < 0) continue;
          const room = d.rooms[ri];
          if (!room || room.sealed || room.kit === 'hidden') continue;
          const wx = d.x0 + tx;
          if (game.world.getBlock(wx, FY, tz) !== B.air || !game.world.canStand(wx, FY, tz) || game.occupiedBySolid(wx, FY, tz, game.player)) continue;
          const dd = dx * dx + dz * dz;
          if (!best || dd < best.dd) best = { x: wx, z: tz, dd };
        }
      }
    }
    return best ? { x: best.x, z: best.z } : d.entry;
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
    this.settleMimics();
    if (this.state && this.placed) this.state.placed = [...this.placed];
    // (Not a Field Projector's wall: that's only for the moment.)
    dropFields(this.game);
    const regions = [];
    for (const r of this.data.regions.values()) if (r.modified) regions.push(r.serialize());
    this.rec.floors[this.floor] = { regions, state: this.state, gen: FLOOR_GEN };
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
    game.zones = [];
    game.projectiles = [];
    game.flames = [];
    game.lasers = [];
    game.kavSpikes = [];
    game.fireTiles = null;
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
    // (Changed by the blight: see monsters.js, blightTick.)
    if (o.infected) {
      c.infected = true;
      c.maxHp = c.hp = Math.round(c.maxHp * 1.25);
    }
    // (A master's a good deal harder than what it rules.)
    if (o.boss) {
      c.isBoss = true;
      c.maxHp = c.hp = Math.round(c.maxHp * BOSS_HP);
      c.dmgMult *= BOSS_DMG;
    }
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
      if (c.waiting) {
        // (Struck where it waits, by you, from its hall or its doorway: it
        // wakes. Not for the wounds it settled back with, nor anything
        // that hurt it while you're nowhere near.)
        const br = this.data.bossRoom;
        const near = br && p.x >= br.x0 - 3 && p.x <= br.x1 + 3 && p.z >= br.z0 - 3 && p.z <= br.z1 + 3;
        if (c.hp < (c.restHp ?? c.maxHp) && near && !p.dead) this.bossFight();
        c.restHp = Math.min(c.restHp ?? c.maxHp, c.hp);
        continue;
      }
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
    // Into the master's hall: the gate comes down behind you, and it wakes.
    const br = this.data.bossRoom;
    if (br && !this.rec.cleared && !this.fight && p.x >= br.x0 && p.x <= br.x1 && p.z >= br.z0 && p.z <= br.z1) this.bossFight();
    if (this.fight) this.updateFight(dt);
    this.placeDangers(dt);
    this.spikesTick(dt);
    this.ambience(dt);
    // Notes left (an adventurer's remains): told as you come near.
    for (const nt of this.notes || []) {
      if (nt.told || (nt.floor !== undefined && nt.floor !== this.floor) || Math.abs(nt.x - p.x) > 3 || Math.abs(nt.z - p.z) > 3) continue;
      nt.told = true;
      game.ui.msg(nt.text, '#c8b8a0');
    }
  }

  bossDead() {
    return this.rec.cleared;
  }

  // ------------------------------------------------------------ the master
  // Into its hall: the gate crashes down behind you, it wakes (its name
  // across the top of the screen), and the music turns.
  bossFight() {
    if (this.fight || this.rec.cleared) return;
    const game = this.game;
    const p = game.player;
    const boss = game.creatures.filter((c) => c.isBoss && !c.dead && c.leash);
    if (!boss.length) return;
    const g = this.data.bossGate;
    if (g && !(p.x === g.x && p.z === g.z)) {
      const cur = game.world.getBlock(g.x, FY, g.z);
      if (cur !== B.boss_gate && cur !== B.kav_gate) {
        game.world.setBlock(g.x, FY, g.z, this.kav ? B.kav_gate : B.boss_gate, g.rot);
        game.audio?.play('gate_slam', { x: g.x, z: g.z });
        game.renderer.emit(g.x, FY + 1, g.z, { n: 18, color: ['#8a8478', '#5a5650'], up: 20, speed: 50, life: 0.7, shape: 'puff' });
        game.ui.msg('The gate crashes down behind you!', '#ff9060', true);
      }
    }
    game.shake = Math.min(1.4, (game.shake || 0) + 0.9);
    for (const c of boss) {
      c.waiting = false;
      c.dormant = 0;
      c.target = p;
      c.face(p.x, p.z);
    }
    const lead = boss[0];
    const T = BOSS_TITLES[lead.species] || {};
    this.fight = { boss, name: T.name || lead.S.name, title: T.title || '', t: 0, frac: 1, trail: 1, hitT: -9, away: 0 };
    game.audio?.play('sting');
    if (T.taunt) lead.say?.(T.taunt, 3.5, '#ff9080');
    game.renderer.flashScreen?.('#400000', 0.35);
    // (The camera goes to it as it wakes, and its fires catch: see scenes.js.
    // Only the first time you come in: after, it's straight to it.)
    // (Its waking scene once a place, not every time you come back to it.)
    if (!this.metBoss && !this.rec.metBoss && !game.scene) {
      this.metBoss = true;
      this.rec.metBoss = true;
      game.scene = bossEntrance(game, this, boss);
    } else game.audio?.play('roar', lead);
  }

  updateFight(dt) {
    const f = this.fight;
    const game = this.game;
    const p = game.player;
    f.t += dt;
    f.phaseT = (f.phaseT ?? 9) + dt;
    const alive = f.boss.filter((c) => !c.dead);
    const max = f.boss.reduce((n, c) => n + c.maxHp, 0);
    const frac = max ? alive.reduce((n, c) => n + Math.max(0, c.hp), 0) / max : 0;
    if (frac < f.frac - 1e-6) f.hitT = f.t;
    f.frac = frac;
    // (The pale trail behind the bar catches up a moment after each blow.)
    if (f.t - f.hitT > 0.5) f.trail = Math.max(f.frac, f.trail - dt * 0.45);
    if (!alive.length) return;
    // Out of its hall a while (back out the gate, or up the stairs): it
    // settles to wait for you again.
    const br = this.data.bossRoom;
    const inside = p.x >= br.x0 && p.x <= br.x1 && p.z >= br.z0 && p.z <= br.z1;
    f.away = inside || p.dead ? 0 : f.away + dt;
    if (f.away > 5) {
      for (const c of alive) {
        c.waiting = true;
        c.dormant = 1;
        c.target = null;
        c.windup = null;
        c.act = null;
        c.hp = Math.min(c.maxHp, c.hp + Math.round(c.maxHp * 0.25));
        c.restHp = c.hp;
      }
      this.fight = null;
      game.ui.msg('Behind you, the thing in the hall settles back to wait.', '#c8b8a0');
    }
  }

  // It's dead: the gate grinds up of itself, and the hall's quiet.
  endFight() {
    const game = this.game;
    const g = this.data.bossGate;
    if (g) {
      const cur = game.world.getBlock(g.x, FY, g.z);
      if (cur === B.boss_gate || cur === B.kav_gate) game.world.setBlock(g.x, FY, g.z, cur === B.kav_gate ? B.air : B.boss_gate_open, g.rot);
      game.audio?.play('gate', { x: g.x, z: g.z });
    }
    if (this.fight) this.fallen = { name: this.fight.name, t: 0 };
    this.fight = null;
    // (Its fall's scene plays the fanfare itself.)
    if (!(game.scene && game.scene.kind === 'boss_down')) game.audio?.play('victory');
  }

  // ------------------------------------------------------------ its dangers
  // What each kind of place does to you, besides its dead and its beasts:
  //   a mine's roof comes down (dust trickles first: move);
  //   a barrow's dead reach up out of the earth for your ankles;
  //   a crypt's cold draughts gutter your light to nothing a moment;
  //   a holdout's gongs rouse the whole place when one of them sees you.
  placeDangers(dt) {
    const game = this.game;
    const p = game.player;
    const type = this.rec.type;
    if (p.dead || this.arriveT > 0) return;
    // Gongs: whoever's after you strikes the nearest.
    if (type === 'holdout') {
      for (const c of game.creatures) {
        if (c.dead || c.target !== p || c.rang || c.isBoss) continue;
        const gong = this.data.gongs.find((q) => !q.rung && Math.max(Math.abs(q.x - c.x), Math.abs(q.z - c.z)) <= 9 && game.world.getBlock(q.x, FY, q.z) === B.gong);
        c.rang = true;
        if (gong) this.ringGong(gong, c);
      }
    }
    // (Not in the master's hall, not in the first room.)
    if (this.fight || this.rec.cleared) return;
    this.hazardT -= dt;
    if (this.hazardT > 0) return;
    this.hazardT = 22 + Math.random() * 22;
    const dmg = 3 + this.floor + (this.rec.level || 1);
    if (type === 'mine') {
      // The roof: dust first, then the rocks, round where you stand.
      const tiles = areaTiles(p.x + Math.round(Math.random() * 2 - 1), p.z + Math.round(Math.random() * 2 - 1), 1).filter(() => Math.random() < 0.75);
      tiles.push({ x: p.x, z: p.z });
      for (const t of tiles) game.renderer.emit(t.x, FY + 2.4, t.z, { n: 3, color: ['#8a7a5a', '#6a5a40'], up: -10, speed: 6, gravity: 120, life: 0.9, oy: -10 });
      addHazard(game, { tiles, y: FY, dur: 1.6, dmg, stun: 0.4, kind: 'rocks', color: [200, 150, 90], trap: true });
      game.audio?.play('rumble');
      game.shake = Math.min(1, (game.shake || 0) + 0.35);
      if (!this.toldRoof) game.ui.msg('Dust trickles from the roof... (it\'s coming down: move!)', '#e0c8a0', true);
      this.toldRoof = true;
    } else if (type === 'barrow') {
      // Hands up out of the earth, where you stand and round it.
      const tiles = [{ x: p.x, z: p.z }, ...areaTiles(p.x, p.z, 1).filter(() => Math.random() < 0.35)];
      for (const t of tiles) game.renderer.emit(t.x, FY + 0.1, t.z, { n: 3, color: ['#c8d0c0', '#8a9a8a'], up: 8, speed: 6, life: 1.1, oy: 6, shape: 'puff' });
      addHazard(game, { tiles, y: FY, dur: 1.3, dmg: Math.round(dmg * 0.6), chill: 2, kind: 'cold', color: [150, 170, 160], trap: true, onFire: (g, h, hit) => {
        for (const e of hit) {
          if (e !== p) continue;
          p.grabbedT = 1.2;
          game.renderer.floatText(p.x, p.y + 2.4, p.z, 'grasped! (roll free)', '#a0c8b0');
        }
        for (const t of h.tiles) game.renderer.emit(t.x, FY + 0.4, t.z, { n: 4, color: ['#e8e4d4', '#a8a088'], up: 30, speed: 20, life: 0.5, oy: 2 });
      } });
      game.audio?.play('whisper');
      if (!this.toldHands) game.ui.msg('The earth stirs under your feet... (something reaches up: move!)', '#a0c8b0', true);
      this.toldHands = true;
    } else if (type === 'crypt' && p.heldLightKind && p.heldLightKind() === 'fire') {
      // A cold draught: your flame bows, and goes out a moment.
      p.snuff?.(2.5);
      game.audio?.play('wind');
      game.audio?.play('whisper');
      game.renderer.emit(p.x, p.y + 1.2, p.z, { n: 12, color: ['#a0d8ff', '#e0f4ff'], up: 4, speed: 40, life: 0.8, shape: 'puff' });
      game.ui.msg(this.toldDraught ? 'Another cold draught...' : 'A cold draught moans through the crypt, and your flame gutters out!', '#a0c8e0', true);
      this.toldDraught = true;
    }
  }

  // A gong struck: the whole holdout knows you're here.
  ringGong(gong, by) {
    const game = this.game;
    const p = game.player;
    gong.rung = true;
    game.world.setState(gong.x, FY, gong.z, true);
    game.audio?.play('gong', gong);
    game.renderer.effect?.({ type: 'ring', wx: gong.x, wy: FY + 1, wz: gong.z, r0: 4, r1: 60, color: ['#f0c860', '#ffffff'], life: 0.9, oy: -6, flat: 0.5 });
    game.renderer.floatText(gong.x, FY + 2.4, gong.z, 'BONG!', '#f0c860');
    by.say?.('Alarm! To arms!', 2.5, '#ff9070');
    let n = 0;
    for (const c of game.creatures) {
      if (c.dead || c.isBoss || c.waiting || Math.max(Math.abs(c.x - gong.x), Math.abs(c.z - gong.z)) > 24) continue;
      c.dormant = 0;
      c.target = p;
      c.rang = true;
      n++;
    }
    game.ui.msg(`A gong booms through the holdout: ${n > 1 ? 'they all know you\'re here!' : 'they know you\'re here!'}`, '#ffb080', true);
  }

  // ------------------------------------------------------------ the air
  // How the place sounds and moves round you: its own noises now and then
  // (drips and whispers in a barrow, a mine's groans and scuttling, a
  // crypt's chains, a holdout's fires), and its own motes in the dark.
  ambience(dt) {
    const game = this.game;
    const p = game.player;
    this.dripT -= dt;
    if (this.dripT <= 0) {
      this.dripT = 4 + Math.random() * 7;
      const sounds = this.T.ambient || ['drip'];
      game.audio?.play(sounds[Math.floor(Math.random() * sounds.length)]);
    }
    if (this.kav) this.kavAir(dt);
    this.moteT -= dt;
    if (this.moteT > 0) return;
    this.moteT = 0.12;
    const x = p.x + Math.round((Math.random() - 0.5) * 22);
    const z = p.z + Math.round((Math.random() - 0.5) * 14);
    const c = this.pal?.motes || this.T.motes || ['#8a8a8a'];
    switch (this.rec.type) {
      case 'barrow':
        // Mist, low along the floor.
        game.renderer.emit(x, FY + 0.1, z, { n: 1, color: c, up: 2, speed: 5, life: 2.4, oy: 6, shape: 'puff', gravity: -2 });
        break;
      case 'mine':
        // Grit sifting down from the roof.
        if (Math.random() < 0.6) game.renderer.emit(x, FY + 2.6, z, { n: 1, color: c, up: -4, speed: 2, gravity: 60, life: 1.2, oy: -10 });
        break;
      case 'crypt':
        // Pale motes drifting up, like breath.
        game.renderer.emit(x, FY + 0.6, z, { n: 1, color: c, up: 6, speed: 3, gravity: -6, life: 2.2, glow: true });
        break;
      case 'holdout':
        // Smoke from the fires, and an ember now and then.
        game.renderer.emit(x, FY + 1.8, z, { n: 1, color: Math.random() < 0.15 ? ['#ff9030', '#ffd070'] : c, up: 4, speed: 4, gravity: -4, life: 1.8, shape: 'puff', glow: Math.random() < 0.15 });
        break;
      default:
        // Motes of the floor's own light, rising slow; and now and then a
        // haze of it along the floor.
        if (Math.random() < 0.55) game.renderer.emit(x, FY + 0.4 + Math.random(), z, { n: 1, color: c, up: 5, speed: 4, gravity: -5, life: 1.8, glow: true });
        if (Math.random() < 0.12) game.renderer.emit(x, FY + 0.1, z, { n: 1, color: [c[0]], up: 1, speed: 4, life: 2.6, oy: 6, shape: 'puff', gravity: -1 });
    }
  }

  // A Kavorent floor's machinery breathing round you: vents puffing, the
  // monoliths and light-screens shedding sparks, conduits spitting now and
  // then. (What's near is looked for twice a second.)
  kavAir(dt) {
    const game = this.game;
    const p = game.player;
    const c = this.pal.motes;
    // In a room the blight's got into: its spores in the air, a whisper, and
    // (the first time) word of what's changed here.
    const bl = (this.data.blighted || []).find((q) => p.x >= q.x0 && p.x <= q.x1 && p.z >= q.z0 && p.z <= q.z1);
    if (bl) {
      if (Math.random() < dt * 9) game.renderer.emit(p.x + (Math.random() - 0.5) * 14, FY + 0.2 + Math.random() * 1.5, p.z + (Math.random() - 0.5) * 9, { n: 1, color: ['#b070e0', '#e090ff', '#7a3aa0'], up: 5, speed: 3, gravity: -5, life: 2, glow: true });
      if (Math.random() < dt * 0.08) game.audio?.play('whisper');
      if (!bl.told) {
        bl.told = true;
        game.ui.msg('The blight has got in here: the alloy veined violet, strange things growing. What lives here has changed.', '#e090ff');
      }
    }
    this.kavScanT = (this.kavScanT || 0) - dt;
    if (this.kavScanT <= 0) {
      this.kavScanT = 0.5;
      const got = [];
      const w = game.world;
      for (let z = p.z - 8; z <= p.z + 8; z++) {
        for (let x = p.x - 13; x <= p.x + 13; x++) {
          const id = w.getBlock(x, FY, z);
          if (id === B.kav_vent || id === B.kav_monolith || id === B.kav_holo || id === B.kav_conduit || id === B.kav_statue) got.push({ x, z, id });
        }
      }
      this.kavNear = got;
    }
    for (const q of this.kavNear || []) {
      const r = Math.random();
      if (q.id === B.kav_vent) {
        if (r < dt * 3) game.renderer.emit(q.x, FY + 0.15, q.z, { n: 1, color: ['#d8e4ec', '#9aa8b8', c[1]], up: 14, speed: 3, gravity: -10, life: 1.3, shape: 'puff' });
        if (r < dt * 0.06 && Math.abs(q.x - p.x) + Math.abs(q.z - p.z) < 6) game.audio?.play('hiss');
      } else if (q.id === B.kav_monolith) {
        if (r < dt * 2) game.renderer.emit(q.x, FY + 1 + Math.random() * 1.6, q.z, { n: 1, color: c, up: 6, speed: 3, gravity: -8, life: 1.2, glow: true });
      } else if (q.id === B.kav_holo) {
        if (r < dt * 1.5) game.renderer.emit(q.x, FY + 1.8, q.z, { n: 2, color: c, up: 2, speed: 9, life: 0.4, glow: true });
      } else if (q.id === B.kav_statue) {
        if (r < dt * 0.6) game.renderer.emit(q.x, FY + 2.3, q.z, { n: 1, color: c, up: 2, speed: 2, gravity: -2, life: 1.6, glow: true });
      } else if (r < dt * 0.35) {
        game.renderer.emit(q.x, FY + 0.6, q.z, { n: 6, color: ['#ffffff', c[0]], up: 12, speed: 26, gravity: 90, life: 0.45, glow: true });
      }
    }
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
      case 'idol':
        this.blessing(x, z);
        return true;
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
      case 'boss_gate': {
        const g = this.data.bossGate;
        const shut = b.id !== B.boss_gate_open;
        const open = b.id === B.kav_gate ? B.air : B.boss_gate_open;
        if (!shut) {
          game.ui.msg('The great gate stands open.', '#c8c8c8');
          return true;
        }
        // (From inside, with its master alive: heaved up, slowly, and only
        // while it isn't looking.)
        const inside = !!g && (p.x - g.x) * g.ox + (p.z - g.z) * g.oz < 0;
        if (inside && this.fight && this.fight.boss.some((c) => !c.dead && c.target === p && c.distTo(p) < 5)) {
          game.ui.msg('You can\'t get the gate up with that thing on your back!', '#ff9060', true);
          game.audio?.play('error');
          return true;
        }
        w.setBlock(x, FY, z, open, g ? g.rot : 0);
        game.audio?.play('gate', { x, z });
        game.shake = Math.min(1, (game.shake || 0) + 0.25);
        game.ui.msg(this.rec.cleared ? 'The gate grinds up.' : inside ? 'You heave the great gate up, and it holds.' : 'The great gate grinds up. Beyond it, something waits in the dark.', '#e0c890');
        return true;
      }
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
          if (!set.relic) game.spawnDrop('old_coin', 4, set.reward.x, FY, set.reward.z, true);
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
    // One of the Overseer's sentinels: the last of them, and its shield
    // breaks. (The Overseer gone: its sentinels go dark and fall.)
    if (e.sentinel) sentinelDown(game, e);
    if (e.species === 'overseer' && e.sentinels) {
      for (const s of e.sentinels) {
        if (s.dead) continue;
        s.sentinel = null;
        game.renderer.emit(s.x, s.y + 1.2, s.z, { n: 10, color: ['#5ad8f0', '#8a8478'], up: 20, speed: 30, life: 0.6, glow: true });
        game.kill(s, null);
      }
    }
    // One the blight was in: it bursts into a cloud of spores.
    if (e.infected && !e.sporeless) sporeCloud(game, e, 1, null);
    // A mimic: what was in it spills out.
    if (e.mimicLoot) {
      for (const it of e.mimicLoot) game.spawnDrop(it.item, it.count, e.x, e.y, e.z, true);
      e.mimicLoot = null;
    }
    if (e.carries) {
      game.spawnDrop(e.carries, 1, e.x, e.y, e.z, true);
      game.ui.msg(e.carries === 'sigil' ? `${e.S.name} drops a bronze sigil.` : `${e.S.name} drops a glyph key.`, '#ffe070');
    }
    const masters = this.data.spawns.filter((s) => s.boss);
    const master = e.spawnId !== undefined && masters.some((s) => s.id === e.spawnId);
    // (Two of them: the one left takes it hard.)
    if (master && !masters.every((s) => this.state.killed.includes(s.id))) {
      for (const c of game.creatures) if (!c.dead && c.isBoss && c !== e) bossRage(game, c, e);
      return;
    }
    if (e.isBoss && master && !this.rec.cleared) {
      game.sim.dungeons.cleared(this.rec, 'you');
      // Its fall: the world slowed, the camera on it as it comes apart.
      if (!game.scene) game.scene = bossDefeat(game, this, e);
      this.endFight(true);
      // (Every master of an old place keeps a relic about it.)
      if (!this.kav) {
        const keys = Object.keys(RELICS);
        game.spawnDrop(`relic_${keys[Math.floor(Math.random() * keys.length)]}`, 1, e.x, e.y, e.z, true);
      }
      game.ui.msg(`${e.S.name} falls. ${cap(this.rec.name)} is beaten!`, '#ffe070');
      // The rest of the place's things lose heart (the dead fall still);
      // its images and its brood go with it.
      for (const c of game.creatures) {
        if (c.dead || c === e) continue;
        if (c.master === e || c.species === 'egg_sac') game.kill(c, null);
        else if ((c.S.undead || c.S.construct) && Math.max(Math.abs(c.x - e.x), Math.abs(c.z - e.z)) < 20) c.stunT = 3;
      }
      if (this.kav) {
        game.ui.msg('The ruin\'s hum dies away. Somewhere above, the runes on the spire go out.', '#5ad8f0');
        // (Two cores in it, and its Eye: see its drops.)
        game.spawnDrop('kav_core', 2, e.x, e.y, e.z, true);
        this.rec.cores = Math.max(0, (this.rec.cores ?? 4) - 2);
      }
    }
  }

  // ------------------------------------------------------------ saving
  serialize() {
    this.saveFloor();
    const p = this.game.player;
    return { id: this.rec.id, floor: this.floor, x: p.x, z: p.z, surface: this.surface, carried: this.carried || null };
  }

  // A block you've set down here.
  notePlaced(x, y, z) {
    (this.placed ||= new Set()).add(`${x},${y},${z}`);
  }

  // ------------------------------------------------------------ spikes
  // Each spike comes round in its turn: down a while, a rattle (a puff of
  // grit, a click if you're near), then up; anyone standing on it as it
  // comes up, or who steps onto it while it's up, is hurt.
  spikesTick(dt) {
    const game = this.game;
    const w = game.world;
    const p = game.player;
    const list = this.data.spikes || [];
    if (!list.length) return;
    const dmg = Math.round(4 + this.floor + (this.rec.level || 1));
    this.spikeHit = this.spikeHit || new Map();
    for (const [e, t] of this.spikeHit) if (t - dt <= 0) this.spikeHit.delete(e);
    else this.spikeHit.set(e, t - dt);
    for (const sp of list) {
      if (Math.abs(sp.x - p.x) > 20 || Math.abs(sp.z - p.z) > 14) continue;
      if (w.getBlock(sp.x, FY, sp.z) !== B.spikes) continue;
      const ph = (this.t + sp.phase) % SPIKE_CYCLE;
      const up = ph > SPIKE_CYCLE - 1;
      const warn = !up && ph > SPIKE_CYCLE - 1.45;
      if (warn && !sp.warned) {
        sp.warned = true;
        game.renderer.emit(sp.x, FY + 0.05, sp.z, { n: 4, color: ['#8a8478', '#5a5650'], up: 8, speed: 10, life: 0.4, shape: 'puff' });
        if (Math.abs(sp.x - p.x) + Math.abs(sp.z - p.z) < 7) game.audio?.play('click', sp);
      }
      if (up !== w.getState(sp.x, FY, sp.z)) {
        w.setState(sp.x, FY, sp.z, up);
        if (up) {
          sp.warned = false;
          if (Math.abs(sp.x - p.x) + Math.abs(sp.z - p.z) < 9) game.audio?.play('spikes', sp);
        }
      }
      if (!up) continue;
      for (const e of [p, ...game.creatures]) {
        if (!e || e.dead || e.burrowed || e.S?.floats || e.x !== sp.x || e.z !== sp.z || this.spikeHit.has(e)) continue;
        if (e !== p && (e.S?.construct || e.isBoss)) continue;
        this.spikeHit.set(e, 0.9);
        game.damage(e, e === p ? dmg : Math.round(dmg * 1.5), null);
        game.renderer.emit(e.x, FY + 0.4, e.z, { n: 8, color: ['#c82a2a', '#e8e0d0'], up: 30, speed: 30, life: 0.5 });
      }
    }
  }

  // ------------------------------------------------------------ the idol
  // Lay a hand on it: one blessing, chosen by it (strength in your arm,
  // speed in your feet, breath in your lungs, or your wounds closed), and
  // its eyes go dark.
  blessing(x, z) {
    const game = this.game;
    const w = game.world;
    const p = game.player;
    if (!w.getState(x, FY, z)) {
      game.ui.msg('The idol\'s eyes are dark. Whatever it had to give, it\'s given.', '#a8a098');
      return;
    }
    w.setState(x, FY, z, false);
    game.lightDirty = true;
    const now = game.day * 1440 + game.minute;
    const pick = BLESSINGS[hash4(this.rec.seed, x, z, this.floor) % BLESSINGS.length];
    if (pick.heal) {
      p.hp = p.maxHp;
      game.renderer.flashScreen?.('#a0ffb0', 0.3);
    } else {
      p.buffs = (p.buffs || []).filter((q) => q.combat !== pick.combat || q.until <= now);
      p.buffs.push({ combat: pick.combat, n: pick.n, until: now + 60, name: pick.name });
    }
    game.ui.msg(`You lay a hand on the idol. ${pick.text}`, '#ffe070', true);
    game.audio?.play('secret');
    game.renderer.emit(x, FY + 1.2, z, { n: 24, color: ['#ffe070', '#ffffff', '#ffc040'], up: 40, speed: 40, life: 0.9, glow: true });
    game.renderer.emit(p.x, p.y + 1, p.z, { n: 16, color: ['#ffe070', '#ffffff'], up: 30, speed: 20, life: 0.8, glow: true, gravity: -20 });
  }

  // ------------------------------------------------------------ mimics
  // A chest you reach for that has teeth: it wakes (what was in it in its
  // belly, to spill when it dies). Returns whether it was one.
  wakeMimic(x, y, z) {
    const game = this.game;
    const w = game.world;
    if (y !== FY || w.getBlock(x, FY, z) !== B.chest) return false;
    const m = (this.data.mimics || []).find((q) => q.x === x && q.z === z);
    const key = `${x},${z}`;
    this.state.mimics = this.state.mimics || [];
    if (!m || this.state.mimics.includes(key)) return false;
    this.state.mimics.push(key);
    const loot = (w.getContainer(x, FY, z) || []).filter(Boolean).map((q) => ({ ...q }));
    w.setBlock(x, FY, z, B.air);
    const c = this.spawn('mimic', x, FY, z);
    c.mimicLoot = loot;
    c.mimicHome = { x, z };
    c.target = game.player;
    c.attackCd = 0.4;
    game.ui.msg('The chest has teeth!', '#ff9060', true);
    game.audio?.play('roar', c);
    game.shake = Math.max(game.shake || 0, 0.5);
    game.renderer.emit(x, FY + 0.6, z, { n: 14, color: ['#7a5232', '#f0e8d0', '#c84050'], up: 30, speed: 40, life: 0.6 });
    return true;
  }

  // Off the floor with a mimic still about: it settles back into a chest
  // where it was (what it held back in it) to wait for you again.
  settleMimics() {
    const game = this.game;
    for (const c of game.creatures) {
      if (c.dead || c.species !== 'mimic' || !c.mimicHome) continue;
      const { x, z } = c.mimicHome;
      if (game.world.getBlock(x, FY, z) !== B.air) continue;
      game.world.setBlock(x, FY, z, B.chest, 0);
      const slots = game.world.getContainer(x, FY, z);
      slots.fill(null);
      for (const it of c.mimicLoot || []) addItem(slots, it.item, it.count);
      this.state.mimics = (this.state.mimics || []).filter((k) => k !== `${x},${z}`);
      c.mimicHome = null;
    }
  }

  // ------------------------------------------------------------ what you found
  // What you've found down here and still have about you (more of a thing
  // than you came down with): [item, how many].
  unbound() {
    if (!this.carried) return [];
    const out = [];
    for (const [k, n] of holdings(this.game.player)) {
      const d = n - (this.carried[k] || 0);
      if (d > 0) out.push([k, d]);
    }
    return out;
  }

  // Fallen down here: what you found comes out of your pack (off your back,
  // out of your hands), and half your coin with it, and it lies where you
  // fell in a pack of its own, kept with the floor for when you come back
  // for it. (Not in a place that's beaten and shut behind you: nothing
  // down there keeps it from you.) What's in it: [item, how many].
  spill() {
    const game = this.game;
    const p = game.player;
    if (this.rec.cleared && !this.kav) return [];
    const out = [];
    for (const [k, n] of this.unbound()) {
      let left = n;
      const inv = Math.min(left, countItem(p.inv, k));
      if (inv > 0) {
        removeItem(p.inv, k, inv);
        left -= inv;
      }
      for (const slot of Object.keys(p.equip || {})) {
        if (left > 0 && p.equip[slot] === k) {
          p.equip[slot] = null;
          left--;
        }
      }
      if (n - left > 0) out.push([k, n - left]);
    }
    const coins = countItem(p.inv, 'coin');
    if (coins > 0) {
      const lost = Math.ceil(coins / 2);
      removeItem(p.inv, 'coin', lost);
      const c = out.find((q) => q[0] === 'coin');
      if (c) c[1] += lost;
      else out.push(['coin', lost]);
    }
    this.dropPack(out, p.x, p.z);
    return out;
  }

  // A pack on the floor near (x, z), with these in it.
  dropPack(items, x, z) {
    if (!items.length) return null;
    const w = this.game.world;
    let at = null;
    for (let r = 0; r <= 3 && !at; r++) {
      for (let dz = -r; dz <= r && !at; dz++) {
        for (let dx = -r; dx <= r && !at; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
          if (w.getBlock(x + dx, FY, z + dz) === B.air && BLOCKS[w.getBlock(x + dx, FY - 1, z + dz)].solid) at = { x: x + dx, z: z + dz };
        }
      }
    }
    if (!at) at = { x, z };
    w.setBlock(at.x, FY, at.z, B.satchel, 0);
    const slots = w.getContainer(at.x, FY, at.z);
    for (const [k, n] of items) {
      while (!canAdd(slots, k, n)) slots.push(...new Array(9).fill(null));
      addItem(slots, k, n);
    }
    this.rec.pack = { floor: this.floor, x: at.x, z: at.z };
    this.game.ui.msg(`What you found down here spills out where you fall. Your pack's still there, floor ${this.floor + 1} of ${this.rec.name}.`, '#ffb080', true);
    return at;
  }
}

// What an old idol might give (an hour of it).
const BLESSINGS = [
  { combat: 'fury', n: 0.3, name: 'Idol\'s Might', text: 'Strength floods your arm. (An hour of harder blows.)' },
  { combat: 'haste', n: 0.3, name: 'Idol\'s Speed', text: 'Your feet feel light. (An hour of quicker swings.)' },
  { combat: 'wind', n: 0.8, name: 'Idol\'s Breath', text: 'Your lungs fill deep. (An hour of quicker breath.)' },
  { heal: true, text: 'Warmth runs through you, and your wounds close.' },
];

// What's about you, thing by thing: in your pack, worn, in your hands.
export function holdings(p) {
  const m = new Map();
  for (const s of p.inv) if (s) m.set(s.item, (m.get(s.item) || 0) + s.count);
  for (const k of Object.values(p.equip || {})) if (k) m.set(k, (m.get(k) || 0) + 1);
  return m;
}

function cap(s) {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

// One of the Twins down: the other in a fury (quicker, harder).
function bossRage(game, c, fallen) {
  c.raged = true;
  c.hasteT = 9999;
  c.dmgMult = (c.dmgMult || 1) * 1.35;
  c.say?.(`${fallen.S.name.split(' ').pop()}! You'll pay for that!`, 3, '#ff7060');
  game.renderer.emit(c.x, c.y + 1.5, c.z, { n: 18, color: ['#ff4030', '#ffb080'], up: 30, speed: 50, life: 0.7 });
  game.audio?.play('roar', c);
  game.shake = Math.min(1.2, (game.shake || 0) + 0.5);
}

export { BLOCKS, META_STATE };
