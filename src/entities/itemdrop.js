// Items lying in the world: thrown with a little physics arc, picked up by
// walking over them.
import { BLOCKS } from '../world/blocks.js';
import { parseStar } from '../world/quality.js';

// What lava doesn't take: a fireproof piece (see quality.js), and the
// things that were made in fire to begin with.
const LAVAPROOF = new Set(['obsidian', 'kav_core', 'ember_pod', 'cinder_heart']);
function lavaproof(item) {
  const s = parseStar(item);
  if (s && s.mods.includes('fireproof')) return true;
  return LAVAPROOF.has(s ? s.plain : item);
}

let nextDropId = 1;

export class ItemDrop {
  constructor(game, item, count, x, y, z, vx = 0, vy = 0, vz = 0, pickupDelay = 0.4) {
    this.id = 100000 + nextDropId++;
    this.kind = 'item';
    this.game = game;
    this.item = item;
    this.count = count;
    // Continuous position in tile units; y is feet level (layer).
    this.px = x + 0.5;
    this.py = y;
    this.pz = z + 0.5;
    this.vx = vx;
    this.vy = vy;
    this.vz = vz;
    this.pickupDelay = pickupDelay;
    this.age = 0;
    this.dead = false;
    this.air = 0;
    this.solid = false;
    this.resting = false;
  }

  get x() {
    return Math.floor(this.px);
  }
  get z() {
    return Math.floor(this.pz);
  }
  get y() {
    return Math.floor(this.py + 0.001);
  }

  renderPos() {
    // Rendered at the column's floor; `air` lifts it for the throw arc.
    return { x: this.px - 0.5, y: this.groundY ?? this.py, z: this.pz - 0.5 };
  }

  update(dt) {
    this.age += dt;
    if (this.pickupDelay > 0) this.pickupDelay -= dt;
    if (this.age > 300) this.dead = true;
    const w = this.game.world;
    if (!this.resting) {
      const nx = this.px + this.vx * dt;
      const nz = this.pz + this.vz * dt;
      const tx = Math.floor(nx);
      const tz = Math.floor(nz);
      const layer = Math.floor(this.py + 0.2);
      const blocking = BLOCKS[w.getBlock(tx, layer, tz)].solid;
      if (!blocking) {
        this.px = nx;
        this.pz = nz;
      } else {
        this.vx *= -0.3;
        this.vz *= -0.3;
      }
      this.vy -= 22 * dt;
      this.py += this.vy * dt;
      const ground = this.groundAt(Math.floor(this.px), Math.floor(this.pz), Math.round(this.py));
      if (this.py <= ground) {
        this.py = ground;
        if (Math.abs(this.vy) > 3) this.vy = -this.vy * 0.3;
        else this.vy = 0;
        this.vx *= 0.6;
        this.vz *= 0.6;
        if (Math.abs(this.vx) + Math.abs(this.vz) < 0.2 && this.vy === 0) this.resting = true;
      }
      this.groundY = ground;
      this.air = this.py - ground;
      if (this.air < 0.05) this.lavaCheck();
    } else {
      // Fall if the floor under us was removed.
      const g = this.groundAt(this.x, this.z, this.y);
      if (g < this.py) {
        this.resting = false;
      }
      this.groundY = g;
      this.air = 0;
      this.lavaCheck();
    }
  }

  // Come down in lava: it burns up, with a hiss and a puff of smoke.
  // (Round 61: things thrown in floated there for ever.)
  lavaCheck() {
    if (this.dead || lavaproof(this.item)) return;
    const w = this.game.world;
    const x = Math.floor(this.px);
    const z = Math.floor(this.pz);
    const y = Math.floor(this.py + 0.001);
    const lava = (yy) => BLOCKS[w.getBlock(x, yy, z)]?.lava;
    if (!lava(y - 1) && !lava(y)) return;
    this.dead = true;
    const r = this.game.renderer;
    r?.emit?.(x, y, z, { n: 10, color: ['#ff7020', '#ffb040', '#ffe080'], up: 26, speed: 18, life: 0.5, glow: true, gravity: -20 });
    r?.emit?.(x, y + 0.5, z, { n: 6, color: ['#6a6460', '#8a8480', '#4a4440'], up: 14, speed: 6, life: 1.2, gravity: -12, size: 2 });
    this.game.audio?.play('hiss', { x, y, z });
  }

  groundAt(x, z, hint) {
    const w = this.game.world;
    for (let y = Math.min(hint + 1, 15); y >= 1; y--) {
      const below = BLOCKS[w.getBlock(x, y - 1, z)];
      const here = BLOCKS[w.getBlock(x, y, z)];
      if ((below.solid || below.liquid) && !here.solid) return y - (below.liquid ? 0 : 0);
    }
    return hint;
  }
}
