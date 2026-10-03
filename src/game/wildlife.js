// The little life about the place, there to be seen rather than hunted:
// butterflies over the grass on a fine day; songbirds with nests up in the
// trees, flitting down to peck about and off again when you come near
// (asleep in the nest at night); and owls on the branches after dark,
// hooting now and then, gliding from tree to tree. Only what's round you,
// and light: no eggs, no broods, nothing kept when you've gone.
import { TILE, LH, GROUND } from '../config.js';
import { BLOCKS, B, LEAVES } from '../world/blocks.js';
import { hash4 } from '../util/rng.js';

const SCAN = 15; // how far round you to look for nesting trees
const MAX_FLIES = 7;
const WINGS = ['#f0f0f0', '#f0d040', '#f09030', '#80b0ff', '#e080c0'];
const BIRDS = ['#8a5a34', '#5a5a64', '#c84a2a', '#4a6a9a'];

export class Wildlife {
  constructor(game) {
    this.game = game;
    this.flies = [];
    this.nests = [];
    this.birds = [];
    this.at = null;
    this.t = 0;
  }

  clear() {
    this.flies = [];
    this.nests = [];
    this.birds = [];
    this.at = null;
  }

  update(dt) {
    const g = this.game;
    const p = g.player;
    if (!p || p.dead) return;
    this.t += dt;
    // Moved on: find the trees with nests round here.
    if (!this.at || Math.max(Math.abs(p.x - this.at.x), Math.abs(p.z - this.at.z)) > 8) this.scan();
    const day = g.isDay();
    const wet = g.weather && g.weather.kind !== 'clear' && g.weather.level > 0.5;
    this.updateFlies(dt, day && !wet);
    for (const b of this.birds) this.updateBird(b, dt, day);
  }

  // Nests: in the crowns of some of the trees (the same trees every time),
  // a songbird or two to each, and an owl in one tree of three.
  scan() {
    const g = this.game;
    const w = g.world;
    const p = g.player;
    this.at = { x: p.x, z: p.z };
    const keep = new Map(this.nests.map((n) => [`${n.x},${n.z}`, n]));
    const nests = [];
    for (let z = p.z - SCAN; z <= p.z + SCAN; z++) {
      for (let x = p.x - SCAN; x <= p.x + SCAN; x++) {
        // (Nests are scarce: a few in a wood, none crowded together.)
        if (hash4(x, z, g.seed >>> 0, 0x6e57) % 67 !== 0 || !w.regionAt(x, z)) continue;
        if (nests.some((q) => Math.abs(q.x - x) + Math.abs(q.z - z) < 8)) continue;
        const key = `${x},${z}`;
        if (keep.has(key)) {
          nests.push(keep.get(key));
          continue;
        }
        // The top of a tree's crown, open to the sky.
        let y = -1;
        for (let yy = GROUND + 14; yy >= GROUND + 2; yy--) {
          const id = w.getBlock(x, yy, z);
          if (id === B.air) continue;
          if (LEAVES.has(id) && w.getBlock(x, yy + 1, z) === B.air) y = yy;
          break;
        }
        if (y < 0) continue;
        const h = hash4(x, z, 0x0b1d);
        const n = { x, y: y + 1, z, birds: [] };
        for (let k = 0; k < 1 + (h % 2); k++) n.birds.push(this.bird(n, 'song', BIRDS[(h >> (3 + k)) % BIRDS.length]));
        if (h % 3 === 0) n.owl = this.bird(n, 'owl', '#8a6a48');
        nests.push(n);
        if (nests.length >= 5) break;
      }
      if (nests.length >= 5) break;
    }
    this.nests = nests;
    this.birds = nests.flatMap((n) => [...n.birds, ...(n.owl ? [n.owl] : [])]);
  }

  bird(nest, kind, color) {
    return { nest, kind, color, x: nest.x + 0.5, y: nest.y, z: nest.z + 0.5, state: 'perch', t: 2 + Math.random() * 8, from: null, to: null, flap: 0, face: 1, hoot: 5 + Math.random() * 25 };
  }

  // A bird's day: on its nest, down to the grass to peck about for a while,
  // and back (startled back if you come close). An owl's night: on a
  // branch, now and then off to another tree, hooting.
  updateBird(b, dt, day) {
    const g = this.game;
    const p = g.player;
    const awake = b.kind === 'owl' ? !day : day;
    b.flap += dt;
    if (b.state === 'fly') {
      b.f = Math.min(1, b.f + dt / b.dur);
      const k = b.f;
      b.x = b.from.x + (b.to.x - b.from.x) * k;
      b.z = b.from.z + (b.to.z - b.from.z) * k;
      b.y = b.from.y + (b.to.y - b.from.y) * k + Math.sin(k * Math.PI) * 1.6;
      if (k >= 1) {
        b.state = b.to.ground ? 'ground' : 'perch';
        b.t = b.state === 'ground' ? 4 + Math.random() * 6 : 6 + Math.random() * 14;
        if (b.to.nest) b.nest = b.to.nest;
      }
      return;
    }
    if (!awake) {
      // (Asleep: home to the nest if it isn't there.)
      if (b.state === 'ground') this.fly(b, { x: b.nest.x + 0.5, y: b.nest.y, z: b.nest.z + 0.5 }, 1.2);
      return;
    }
    b.t -= dt;
    const near = Math.max(Math.abs(p.x - b.x), Math.abs(p.z - b.z));
    if (b.kind === 'song') {
      if (b.state === 'ground') {
        // Pecking about (a hop now and then); off if you come close.
        if (near <= 3) {
          this.fly(b, { x: b.nest.x + 0.5, y: b.nest.y, z: b.nest.z + 0.5 }, 0.9);
          g.audio?.play('chirp', { x: b.x, y: b.y, z: b.z });
          g.audio?.play('flap', { x: b.x, y: b.y, z: b.z });
          return;
        }
        if (Math.random() < dt * 0.6) {
          b.x += (Math.random() - 0.5) * 0.6;
          b.z += (Math.random() - 0.5) * 0.6;
          b.face = Math.random() < 0.5 ? -1 : 1;
        }
        if (b.t <= 0) this.fly(b, { x: b.nest.x + 0.5, y: b.nest.y, z: b.nest.z + 0.5 }, 1.4);
        return;
      }
      if (b.t <= 0) {
        b.t = 5 + Math.random() * 10;
        // Down to a spot of open grass nearby (not too near you).
        const w = g.world;
        for (let tries = 0; tries < 6; tries++) {
          const x = Math.round(b.nest.x + (Math.random() - 0.5) * 10);
          const z = Math.round(b.nest.z + (Math.random() - 0.5) * 10);
          if (Math.max(Math.abs(p.x - x), Math.abs(p.z - z)) <= 3 || !w.regionAt(x, z)) continue;
          const y = w.findStandY(x, z, GROUND);
          if (y <= 0 || w.isWaterAt(x, y, z) || BLOCKS[w.getBlock(x, y + 2, z)]?.solid) continue;
          this.fly(b, { x: x + 0.5, y, z: z + 0.5, ground: true }, 1.6);
          if (near <= 12 && Math.random() < 0.4) g.audio?.play('chirp', { x: b.x, y: b.y, z: b.z });
          break;
        }
      }
      return;
    }
    // An owl: a hoot, and in a while off to another tree.
    b.hoot -= dt;
    if (b.hoot <= 0) {
      b.hoot = 12 + Math.random() * 30;
      if (near <= 16) g.audio?.play('hoot', { x: b.x, y: b.y, z: b.z });
    }
    if (b.t <= 0) {
      b.t = 15 + Math.random() * 25;
      const others = this.nests.filter((n) => n !== b.nest && !n.owl);
      if (others.length) {
        const n = others[Math.floor(Math.random() * others.length)];
        b.nest.owl = null;
        n.owl = b;
        this.fly(b, { x: n.x + 0.5, y: n.y, z: n.z + 0.5, nest: n }, 2.4);
      }
    }
  }

  fly(b, to, dur) {
    b.from = { x: b.x, y: b.y, z: b.z };
    b.to = to;
    b.f = 0;
    b.dur = dur;
    b.state = 'fly';
    b.face = to.x < b.x ? -1 : 1;
  }

  // Butterflies: a few about you on a fine day, over open ground, drifting
  // this way and that.
  updateFlies(dt, fine) {
    const g = this.game;
    const p = g.player;
    const w = g.world;
    this.flies = this.flies.filter((f) => (f.life -= dt) > 0 && Math.max(Math.abs(f.x - p.x), Math.abs(f.z - p.z)) < 18);
    if (fine && this.flies.length < MAX_FLIES && Math.random() < dt * 0.8) {
      const x = Math.round(p.x + (Math.random() - 0.5) * 22);
      const z = Math.round(p.z + (Math.random() - 0.5) * 18);
      if (w.regionAt(x, z)) {
        const y = w.findStandY(x, z, GROUND);
        const ground = y > 0 ? BLOCKS[w.getBlock(x, y - 1, z)] : null;
        if (ground && /grass|flower/.test(ground.name || '') && !w.isWaterAt(x, y, z) && !(g.renderer.roofed && g.renderer.roofed(x, y, z))) {
          this.flies.push({ x: x + 0.5, y: y + 0.6, z: z + 0.5, vx: 0, vz: 0, life: 20 + Math.random() * 30, color: WINGS[Math.floor(Math.random() * WINGS.length)], ph: Math.random() * 6, base: y });
        }
      }
    }
    for (const f of this.flies) {
      f.vx += (Math.random() - 0.5) * dt * 3;
      f.vz += (Math.random() - 0.5) * dt * 3;
      f.vx *= 0.96;
      f.vz *= 0.96;
      f.x += f.vx * dt;
      f.z += f.vz * dt;
      f.ph += dt * 14;
      f.y = f.base + 0.7 + Math.sin(f.ph * 0.18) * 0.4;
      // (Shy of you: off they flutter.)
      const dx = f.x - (p.x + 0.5);
      const dz = f.z - (p.z + 0.5);
      if (Math.abs(dx) + Math.abs(dz) < 1.6) {
        f.vx += Math.sign(dx || 1) * dt * 4;
        f.vz += Math.sign(dz || 1) * dt * 4;
      }
    }
    if (!fine) for (const f of this.flies) f.life = Math.min(f.life, 1);
  }

  // For the renderer: nests, birds and butterflies, each drawn in its row
  // with the world (so a wall or a tree in front hides them).
  decos(r, buckets, zMin, zMax) {
    const ctx = r.ctx;
    const put = (x, z, y, draw) => {
      const [u, v] = r.toView(x, z);
      const row = Math.ceil(v - 0.001);
      if (row < zMin || row > zMax) return;
      let arr = buckets.get(row);
      if (!arr) buckets.set(row, (arr = []));
      const sx = Math.round(u * TILE + 8 - r.camX);
      const sy = Math.round(v * TILE - y * LH + LH - r.camY);
      arr.push({ deco: () => draw(sx, sy), layer: Math.ceil(y - 0.001) + 1, rp: { y } });
    };
    const night = !this.game.isDay();
    for (const n of this.nests) {
      put(n.x + 0.5, n.z + 0.5, n.y, (sx, sy) => {
        ctx.fillStyle = '#5a3a1c';
        ctx.fillRect(sx - 3, sy - 2, 6, 2);
        ctx.fillStyle = '#7a5430';
        ctx.fillRect(sx - 2, sy - 3, 4, 1);
        ctx.fillRect(sx - 4, sy - 2, 1, 1);
        ctx.fillRect(sx + 3, sy - 1, 1, 1);
      });
    }
    for (const b of this.birds) {
      const flying = b.state === 'fly';
      put(b.x, b.z, b.y, (sx, sy) => {
        if (b.kind === 'owl') {
          // A round brown owl, ear tufts, pale face; wings out in flight.
          ctx.fillStyle = b.color;
          ctx.fillRect(sx - 2, sy - 7, 4, 5);
          ctx.fillRect(sx - 2, sy - 8, 1, 1);
          ctx.fillRect(sx + 1, sy - 8, 1, 1);
          ctx.fillStyle = '#e8d8b8';
          ctx.fillRect(sx - 1, sy - 6, 2, 2);
          ctx.fillStyle = night ? '#ffe040' : '#1a1420';
          ctx.fillRect(sx - 1, sy - 6, 1, 1);
          ctx.fillRect(sx, sy - 6, 1, 1);
          if (flying) {
            ctx.fillStyle = b.color;
            const up = Math.floor(b.flap * 6) % 2;
            ctx.fillRect(sx - 5, sy - 6 - up, 3, 1);
            ctx.fillRect(sx + 2, sy - 6 - up, 3, 1);
          }
          return;
        }
        // A songbird: a little body, a beak, wings beating in flight.
        const asleep = night && b.state === 'perch';
        ctx.fillStyle = b.color;
        ctx.fillRect(sx - 1, sy - 4, 3, 2);
        if (!asleep) {
          ctx.fillStyle = '#e8b030';
          ctx.fillRect(b.face < 0 ? sx - 2 : sx + 2, sy - 4, 1, 1);
          ctx.fillStyle = '#1a1420';
          ctx.fillRect(b.face < 0 ? sx - 1 : sx + 1, sy - 4, 1, 1);
        }
        if (flying) {
          const up = Math.floor(b.flap * 14) % 2;
          ctx.fillStyle = b.color;
          ctx.fillRect(sx - 3, sy - 5 + up * 2 - 1, 2, 1);
          ctx.fillRect(sx + 2, sy - 5 + up * 2 - 1, 2, 1);
        }
      });
    }
    for (const f of this.flies) {
      put(f.x, f.z, f.y, (sx, sy) => {
        const open = Math.floor(f.ph) % 2;
        ctx.fillStyle = f.color;
        if (open) {
          ctx.fillRect(sx - 2, sy - 2, 2, 2);
          ctx.fillRect(sx + 1, sy - 2, 2, 2);
        } else {
          ctx.fillRect(sx - 1, sy - 3, 1, 2);
          ctx.fillRect(sx + 1, sy - 3, 1, 2);
        }
        ctx.fillStyle = '#2a2024';
        ctx.fillRect(sx, sy - 2, 1, 2);
      });
    }
  }
}
