// The Sleeper: the mountain at the heart of Kharos. Every 60 to 100 days
// it wakes. A few days before, the ground shakes and the vents smoke; then
// it goes up with a roar that's heard and felt on all three of the Dagoni
// Islands. Ash blots out the sun everywhere for a few days; new rivers of
// lava run down its sides and out over the ashlands (they glow for a few
// days, then cool to black rock and glass); and on Kharos itself people die
// and roofs burn, the more the nearer the mountain (the Ashborn's masks
// spare most of them, once they've learned to make them). Out there with
// it going off, burning rock comes down all about you.
import { REGION_W, REGION_D, WORLD_Y, DAY_MINUTES } from '../config.js';
import { RNG, hash4, clamp } from '../util/rng.js';
import { B, BLOCKS, LOGS, LEAVES } from '../world/blocks.js';
import { alive, ledger } from './econ.js';
import { addHazard } from '../entities/monsters.js';
import { ignite } from '../game/fire.js';

const DAY = DAY_MINUTES;
// How often (days), and how long the sky stays dark after (days).
export const ERUPT_MIN = 60;
export const ERUPT_MAX = 100;
const MAX_FLOWS = 18;

function nearTown(ow, x, z) {
  for (const s of ow.settlementsNear(x, z)) {
    const b = s.bounds;
    if (x >= b.x0 - 8 && x <= b.x1 + 8 && z >= b.z0 - 8 && z <= b.z1 + 8) return true;
  }
  return false;
}

export class Volcano {
  constructor(game, sim) {
    this.game = game;
    this.sim = sim;
    this.next = null; // the day it next wakes
    this.at = null; // the moment it goes up, once the day's come
    this.warned = null; // the day the tremors were felt
    this.last = null; // the day it last went up
    this.count = 0;
    this.ash = null; // { from, until } (absolute minutes)
    this.bombs = 0; // seconds of burning rock still to come down round you
    this.lastDay = null;
  }

  get V() {
    return this.game.world.ow.volcano;
  }

  // How dark the ash makes the sky just now (0 clear .. 1 black), for
  // anyone on the Dagoni Islands.
  ashLevel(now = this.sim.abs) {
    const a = this.ash;
    if (!a || now < a.from || now >= a.until) return 0;
    const rise = clamp((now - a.from) / 90, 0, 1);
    const fall = clamp((a.until - now) / (DAY * 0.75), 0, 1);
    return Math.min(rise, fall) * 0.85;
  }

  // Days to go (for talk and tests).
  daysToGo(day = this.game.day) {
    return this.next === null ? null : this.next - day;
  }

  update(dt) {
    if (!this.V) return;
    const day = this.game.day;
    if (this.lastDay === null) this.lastDay = day - 1;
    if (day > this.lastDay) {
      for (let d = Math.max(this.lastDay + 1, day - 5); d <= day; d++) this.daily(d, new RNG(hash4(this.game.seed >>> 0, d, 0x7015)));
      this.lastDay = day;
    }
    if (this.at !== null && this.sim.abs >= this.at) this.erupt(new RNG(hash4(this.game.seed >>> 0, this.at, 0xe7a)));
    if (this.bombs > 0) this.rain(dt);
  }

  daily(day, rng) {
    if (this.next === null) this.next = day + rng.int(ERUPT_MIN, ERUPT_MAX);
    // Tremors, three days before.
    if (day === this.next - 3 && this.warned !== day) {
      this.warned = day;
      for (const L of this.towns('kharos')) ledger(L, day, 'The ground shook in the night, and the vents are smoking. The kiln-priests say the Sleeper is stirring.');
      if (this.game.world.ow.islandAt(this.game.player.x, this.game.player.z) === this.V.island && !this.game.dungeon) {
        this.game.shake = Math.min(1, (this.game.shake || 0) + 0.5);
        this.game.audio?.play('crumble');
        this.game.ui.msg('The ground trembles under your feet. Smoke is rising from the mountain.', '#ffb070');
      }
    }
    if (day >= this.next && this.at === null) this.at = Math.max(this.sim.abs + 1, day * DAY + rng.int(6 * 60, 22 * 60));
    // Flows that cooled today go black where you can see them.
    if (this.V.flows.some((f) => f.until === day)) this.coolLoaded();
  }

  // The towns of the islands (laid out ones: the rest hear of it when
  // they're looked at).
  towns(island = null) {
    const out = [];
    for (const L of this.game.world.layouts.values()) {
      if (!L.econ || L.settlement.deserted) continue;
      if (island && L.settlement.island !== island) continue;
      out.push(L);
    }
    return out;
  }

  // It goes up.
  erupt(rng = new RNG(hash4(this.game.seed >>> 0, this.sim.abs, 0xe7a))) {
    const game = this.game;
    const V = this.V;
    const now = this.sim.abs;
    const day = game.day;
    this.at = null;
    this.last = day;
    this.count++;
    this.next = day + rng.int(ERUPT_MIN, ERUPT_MAX);
    // New rivers of fire down its sides, glowing for a few days.
    const n = rng.int(2, 4);
    for (let i = 0; i < n; i++) {
      V.flows.push({ a: rng.float(-Math.PI, Math.PI), len: rng.float(0.9, 1.6), w: rng.float(1.6, 3.2), rock: rng.chance(0.35) ? 'glass' : 'rock', until: day + rng.int(3, 5), seed: rng.int(0, 999), born: day });
    }
    // (The oldest cooled ones are buried under the new.)
    while (V.flows.length > MAX_FLOWS) {
      const i = V.flows.findIndex((f) => f.until !== Infinity && f.until <= day);
      if (i < 0) break;
      V.flows.splice(i, 1);
    }
    // The ash goes up and over all three islands.
    this.ash = { from: now, until: now + rng.int(2, 4) * DAY };
    // What it does to Kharos's towns.
    const hurt = [];
    for (const L of this.towns(V.island)) hurt.push(this.strike(L, day, rng));
    // And the news of it, everywhere.
    const dead = hurt.reduce((s, h) => s + h.dead, 0);
    const burnt = hurt.reduce((s, h) => s + h.burnt, 0);
    const worst = hurt.filter((h) => h.dead || h.burnt).sort((a, b) => b.dead + b.burnt - (a.dead + a.burnt))[0];
    for (const L of this.towns()) {
      if (L.settlement.island === V.island) continue;
      ledger(L, day, `A roar like the end of the world came over the sea from Kharos: the mountain has woken. The sky has gone black with its ash${dead ? `, and word is ${dead} are dead on Kharos` : ''}.`);
    }
    this.felt(dead, burnt, worst);
    return { dead, burnt };
  }

  // One of Kharos's towns, under the mountain's fire: the nearer, the
  // worse. Returns { dead, burnt }.
  strike(L, day, rng) {
    const s = L.settlement;
    const V = this.V;
    const cx = (s.bounds.x0 + s.bounds.x1) / 2;
    const cz = (s.bounds.z0 + s.bounds.z1) / 2;
    const d = Math.hypot(cx - V.x, (cz - V.z) * V.squash);
    const masks = this.sim.tech && this.sim.tech.has(s, 'ash_masks');
    const sev = clamp(1.1 - (d - V.r) / 650, 0.15, 1) * (masks ? 0.4 : 1);
    let dead = 0;
    for (const r of L.npcs) {
      if (!alive(r) || r.away || r.visitor) continue;
      if (rng.chance(0.035 * sev)) {
        this.sim.recordDeath(L, r, 'the eruption', null, day);
        dead++;
      }
    }
    // Roofs set alight by falling rock (the builders will see to them).
    let burnt = 0;
    const roofs = L.buildings.filter((b) => b.x0 !== undefined && b.roofBase !== undefined && !b.underConstruction && !b.playerHome);
    const nb = Math.min(roofs.length, Math.round(sev * 3 + rng.float(0, 1)));
    for (const b of rng.shuffle(roofs).slice(0, nb)) {
      const ops = [];
      for (let z = b.z0; z <= b.z1; z++) for (let x = b.x0; x <= b.x1; x++) if (rng.chance(0.35)) for (let y = b.roofBase; y < Math.min(WORLD_Y, b.roofBase + 4); y++) ops.push([x, y, z, B.air, 0]);
      if (!ops.length) continue;
      this.sim.setBlocks(ops);
      if (this.sim.works) this.sim.works.noteDamage(L, b);
      burnt++;
    }
    // Ash on the fields and in the stores.
    L.econ.ashDay = day;
    L.econ.treasury = Math.max(0, Math.round(L.econ.treasury * (1 - 0.15 * sev)));
    const what = `${dead ? `${dead} ${dead === 1 ? 'soul was' : 'souls were'} lost` : 'nobody was lost'}${burnt ? `, and ${burnt} ${burnt === 1 ? 'roof was' : 'roofs were'} set alight by falling rock` : ''}`;
    ledger(L, day, `The Sleeper woke! The mountain went up with a roar, and fire and ash came down on ${s.name}: ${what}.${masks ? ' The ash masks saved many.' : ''}`);
    if (dead || burnt) L.econ.raidedDay = day;
    return { s, dead, burnt };
  }

  // What you see and hear of it, wherever you are.
  felt(dead, burnt, worst) {
    const game = this.game;
    const V = this.V;
    if (game.dungeon) {
      game.ui.msg('The whole place shudders: dust sifts down from the ceiling. Something huge happened up above.', '#ffb070');
      game.shake = Math.min(1.2, (game.shake || 0) + 0.6);
      return;
    }
    const p = game.player;
    const here = game.world.ow.islandAt(p.x, p.z) === V.island;
    const near = Math.hypot(p.x - V.x, p.z - V.z) < V.r * 4;
    game.shake = Math.min(1.6, (game.shake || 0) + (here ? 1.4 : 0.8));
    game.audio?.play('eruption');
    game.renderer?.flashScreen?.(here ? '#ffb060' : '#ffd8a0', here ? 0.6 : 0.35);
    if (here) {
      game.ui.msg(near ? 'The mountain explodes! Fire and black rock are coming down all around you!' : 'The mountain has erupted! The sky to the heart of the island is fire, and the ash is falling.', '#ff7040');
      this.bombs = near ? 45 : 18;
    } else {
      game.ui.msg('A tremendous roar rolls in over the sea, and the ground shakes: the mountain on Kharos has erupted. Ash will cover the sun for days.', '#ffb070');
    }
    if (worst && (worst.dead || worst.burnt)) game.ui.msg(`News will come of it: ${worst.s.name} on Kharos was hit worst.`, '#c8a080');
    // Lava where you can see it, at once.
    this.flowLoaded();
    game.lightDirty = true;
  }

  // Burning rock falling round you while it's going off: a shadow where it
  // will land, then fire.
  rain(dt) {
    const game = this.game;
    this.bombs -= dt;
    if (game.dungeon || this.bombs <= 0) return;
    // (Only while you're on Kharos: sail away and you're out from under it.)
    if (game.world.ow.islandAt(game.player.x, game.player.z) !== this.V.island) {
      this.bombs = 0;
      return;
    }
    this.bombT = (this.bombT || 0) - dt;
    if (this.bombT > 0) return;
    this.bombT = 0.7 + Math.random() * 1.2;
    const p = game.player;
    const x = Math.round(p.x + (Math.random() - 0.5) * 22);
    const z = Math.round(p.z + (Math.random() - 0.5) * 14);
    const y = game.world.findStandY ? game.world.findStandY(x, z, p.y) : p.y;
    if (y <= 0) return;
    const tiles = [];
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) if (Math.abs(dx) + Math.abs(dz) <= 1) tiles.push({ x: x + dx, z: z + dz });
    {
      addHazard(game, {
        tiles, y, dur: 1.1, dmg: 5, burn: 2, kind: 'fire', center: { x, z }, color: [255, 120, 40], keep: true,
        onFire: (g) => {
          g.shake = Math.min(1.2, (g.shake || 0) + 0.35);
          g.renderer.emit(x, y + 0.5, z, { n: 14, color: ['#ff7020', '#ffb040', '#3a3434', '#5a5450'], up: 40, speed: 50, gravity: 140, life: 0.8 });
          // (It leaves a scorch, and a fire if it hit something that burns.)
          const below = g.world.getBlock(x, y - 1, z);
          if (BLOCKS[below] && ['grass', 'grass_lush', 'grass_dry', 'grass_jungle', 'ash', 'dirt'].includes(BLOCKS[below].name)) g.world.setBlock(x, y - 1, z, B.scorched);
          const at = g.world.getBlock(x, y, z);
          if (BLOCKS[at] && BLOCKS[at].render === 'plant') g.world.setBlock(x, y, z, B.air);
          for (let k = 0; k < 4; k++) ignite(g, x, y + k, z, 'volcano');
        },
      });
    }
  }

  // ------------------------------------------------------------ the land
  // The regions in view near the mountain: lay down the new flows (and burn
  // off what grew in their way), or cool the old ones to black rock.
  nearRegions() {
    const V = this.V;
    const w = this.game.world;
    const out = [];
    for (const r of w.regions.values()) {
      const cx = r.x0 + REGION_W / 2;
      const cz = r.z0 + REGION_D / 2;
      if (Math.hypot(cx - V.x, (cz - V.z) * V.squash) < V.r * 1.85) out.push(r);
    }
    return out;
  }

  flowLoaded() {
    for (const r of this.nearRegions()) this.fixRegion(r);
  }

  // A region come into view (from a save, it may be out of date).
  regionLoaded(r) {
    const V = this.V;
    if (!V) return;
    const cx = r.x0 + REGION_W / 2;
    const cz = r.z0 + REGION_D / 2;
    if (Math.hypot(cx - V.x, (cz - V.z) * V.squash) < V.r * 1.85) this.fixRegion(r);
  }

  coolLoaded() {
    for (const r of this.nearRegions()) this.fixRegion(r);
  }

  // Make a region's ground agree with the mountain's flows as they are now.
  fixRegion(r) {
    const ow = this.game.world.ow;
    const V = this.V;
    if (!V) return 0;
    const w = this.game.world;
    let n = 0;
    for (let lz = 0; lz < REGION_D; lz++) {
      for (let lx = 0; lx < REGION_W; lx++) {
        const x = r.x0 + lx;
        const z = r.z0 + lz;
        const d = Math.hypot(x - V.x, (z - V.z) * V.squash) / V.r;
        if (d < V.crater || d > 1.7) continue;
        const want = ow.lavaAt(x, z, d);
        if (!want) continue;
        // (Not in or right by a town: the flows stop short of them, as the
        // land itself does: see terrain.js.)
        if (nearTown(ow, x, z)) continue;
        const top = r.top[lz * REGION_W + lx] - 1;
        if (top < 1) continue;
        // Its surface: the highest solid ground, under whatever grows on it.
        let y = top;
        while (y > 1) {
          const b = BLOCKS[w.getBlock(x, y, z)];
          if (b.lava || (b.solid && b.render === 'cube' && !LOGS.has(b.id))) break;
          y--;
        }
        const id = w.getBlock(x, y, z);
        if (want === 'lava') {
          if (id === B.lava || id === B.water) continue;
          w.setBlock(x, y, z, B.lava);
          // What stood on it burns away.
          for (let yy = y + 1; yy < Math.min(WORLD_Y, y + 8); yy++) {
            const a = w.getBlock(x, yy, z);
            if (a === B.air) continue;
            if (LOGS.has(a) || LEAVES.has(a) || BLOCKS[a].render === 'plant' || BLOCKS[a].replaceable) {
              w.setBlock(x, yy, z, B.air);
              if (Math.random() < 0.05) this.game.renderer?.emit?.(x, yy, z, { n: 3, color: ['#ff7020', '#ffb040', '#5a5450'], up: 20, speed: 10, life: 0.6 });
            }
          }
          n++;
        } else if (id === B.lava) {
          w.setBlock(x, y, z, want === 'glass' ? B.obsidian : B.basalt);
          n++;
        }
      }
    }
    if (n) this.game.lightDirty = true;
    return n;
  }

  serialize() {
    return { next: this.next, at: this.at, warned: this.warned, last: this.last, count: this.count, ash: this.ash, lastDay: this.lastDay, flows: this.V ? this.V.flows.filter((f) => f.born !== undefined) : [] };
  }

  load(d) {
    if (!d) return;
    this.next = d.next ?? null;
    this.at = d.at ?? null;
    this.warned = d.warned ?? null;
    this.last = d.last ?? null;
    this.count = d.count || 0;
    this.ash = d.ash || null;
    this.lastDay = d.lastDay ?? null;
    if (this.V && d.flows) for (const f of d.flows) this.V.flows.push({ ...f, until: f.until === null ? Infinity : f.until });
  }
}
