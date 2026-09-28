// Items lying in the world: thrown with a little physics arc, picked up by
// walking over them.
import { BLOCKS } from '../world/blocks.js';

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
    } else {
      // Fall if the floor under us was removed.
      const g = this.groundAt(this.x, this.z, this.y);
      if (g < this.py) {
        this.resting = false;
      }
      this.groundY = g;
      this.air = 0;
    }
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
