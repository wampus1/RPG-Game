// (Round 77) What the weather and the water do to the ground, as seen:
//   - rain splashing off whatever it lands on, and rings spreading on
//     water where it falls;
//   - snow lying, a thin layer at first and deeper the longer it falls
//     (on roofs too), melting off after; trodden flat where people go,
//     cleared with a shovel (or a broom: see npc.js, sweeping);
//   - tracks in it of everything that walks, a while, and the ruts of
//     wagons (in mud too, after rain);
//   - foam along the shore, and rings round whoever's wading or swimming.
// None of it's in the world itself: it's the picture's own (and it can be
// turned off in Settings: Splashes, snow and tracks; Shore foam and
// ripples).
import { B, BLOCKS } from '../world/blocks.js';

const MUDDY = new Set([B.dirt, B.path, B.mud, B.farmland, B.gravel, B.clay, B.grass]);
// (What has no legs to leave tracks with.)
const LEGLESS = /snake|fish|eel|worm|slime|bat|wisp|ghost|spirit|jelly|ooze|ray|shark|crab_swarm|spark/;
const K = (x, z) => x * 65536 + z;
const DX = [0, -1, 0, 1];
const DZ = [1, 0, -1, 0];

// (Round 78) The colour of snow lying on a top at height `y` (r,g,b):
// greyer and bluer at the ground, white up on the roofs.
const TINTS = [];
export function snowTint(y) {
  const i = Math.max(0, Math.min(63, y | 0));
  if (TINTS[i]) return TINTS[i];
  const k = Math.max(0, Math.min(1, (i - 5) / 5));
  return (TINTS[i] = `${Math.round(196 + 59 * k)},${Math.round(208 + 47 * k)},${Math.round(228 + 27 * k)}`);
}

export class GroundFx {
  constructor(r) {
    this.r = r;
    this.snow = new Map(); // tile -> depth (0..4 layers)
    this.marks = new Map(); // tile -> [{ kind, dir, t, life }]
    this.ripples = new Map(); // tile -> [{ y, ox, oz, t, max, big }]
    this.foam = new Map(); // tile|y -> land-side mask (worked out once)
    this.last = new WeakMap(); // entity -> the tile it was on
    this.acc = 0;
    this.wet = 0; // how wet the ground is (0..1): ruts in mud
    this.foamT = 0;
  }

  get on() {
    return !this.r.noWeatherGround;
  }

  // Every frame: the weather on the ground, and who's walked where.
  tick(game, dt) {
    const world = game.world;
    const w = game.weather;
    const p = game.player;
    if (!world || !p) return;
    const below = !!game.dungeon;
    const raining = !below && w && w.kind === 'rain' && w.level > 0.15;
    const snowing = !below && w && w.kind === 'snow' && w.level > 0.15;
    this.wet = Math.max(0, Math.min(1, this.wet + (raining ? dt / 60 : -dt / 400)));
    // (Water shifts, now and then: the foam's looked at afresh.)
    this.foamT -= dt;
    if (this.foamT <= 0) {
      this.foamT = 6;
      this.foam.clear();
    }
    this.ageMarks(dt);
    this.ageRipples(dt);
    if (!this.on) {
      if (this.snow.size) this.snow.clear();
      if (this.marks.size) this.marks.clear();
    } else {
      this.acc += dt;
      if (this.acc >= 0.5) {
        const step = this.acc;
        this.acc = 0;
        if (snowing) this.settle(world, p, step * w.level);
        else this.melt(step, raining);
      }
      if (raining) this.rain(game, dt, w.level);
      this.tread(game, dt);
    }
    if (!this.r.noWaterFx) this.wade(game, dt);
  }

  // Snow lying deeper on the tops round about (not on water).
  settle(world, p, k) {
    const R = 22;
    for (let dz = -R; dz <= R; dz++) {
      for (let dx = -R; dx <= R; dx++) {
        const x = p.x + dx;
        const z = p.z + dz;
        const top = world.topAt(x, z);
        if (top <= 0) continue;
        const b = BLOCKS[world.getBlock(x, top - 1, z)];
        if (!b || b.liquid || !(b.solid || b.render === 'plant')) continue;
        const key = K(x, z);
        // (About a layer in under a minute of steady snow; four at most.)
        this.snow.set(key, Math.min(4, (this.snow.get(key) || 0) + k * 0.022));
      }
    }
  }

  melt(step, raining) {
    for (const [key, d] of this.snow) {
      const v = d - step * (raining ? 0.05 : 0.008);
      if (v <= 0) this.snow.delete(key);
      else this.snow.set(key, v);
    }
  }

  depth(x, z) {
    return this.snow.get(K(x, z)) || 0;
  }

  // Snow shovelled (or swept) off round (x, z).
  clear(x, z, r = 1) {
    let any = false;
    for (let dz = -r; dz <= r; dz++) {
      for (let dx = -r; dx <= r; dx++) {
        const key = K(x + dx, z + dz);
        if (this.snow.has(key)) {
          this.snow.delete(key);
          any = true;
        }
        this.marks.delete(key);
      }
    }
    return any;
  }

  mark(x, z, kind, dir, life) {
    const key = K(x, z);
    let l = this.marks.get(key);
    if (!l) this.marks.set(key, (l = []));
    l.push({ kind, dir, t: life, life });
    if (l.length > 3) l.shift();
  }

  ageMarks(dt) {
    for (const [key, l] of this.marks) {
      for (let i = l.length - 1; i >= 0; i--) if ((l[i].t -= dt) <= 0) l.splice(i, 1);
      if (!l.length) this.marks.delete(key);
    }
  }

  // Whoever's walked from one pace to the next: tracks in the snow behind
  // them (and the snow trodden down a little), ruts behind a wagon.
  tread(game) {
    const world = game.world;
    for (const e of game.visibleEntities || []) {
      if (e.dead || e.kind === 'prop' || e.deck || e.flying) continue;
      const key = K(e.x, e.z);
      const was = this.last.get(e);
      this.last.set(e, key);
      if (was === undefined || was === key) continue;
      const px = Math.floor(was / 65536);
      const pz = was - px * 65536;
      const dx = Math.sign(e.x - px);
      const dz = Math.sign(e.z - pz);
      const dir = dz > 0 ? 0 : dx < 0 ? 1 : dz < 0 ? 2 : 3;
      const d = this.snow.get(was) || 0;
      const wagon = e.mount && e.mount.kind === 'wagon';
      if (wagon) {
        const top = world.topAt(px, pz);
        const muddy = top > 0 && MUDDY.has(world.getBlock(px, top - 1, pz)) && this.wet > 0.2;
        if (d > 0.2 || muddy) this.mark(px, pz, 'rut', dir, d > 0.2 ? 120 : 90);
        if (d > 0) this.snow.set(was, Math.max(0.15, d - 0.5));
        continue;
      }
      const legs = e.kind === 'npc' || e === game.player || e.kind === 'player' || (e.kind === 'creature' && !LEGLESS.test(e.species || ''));
      if (!legs || d < 0.25) continue;
      this.mark(px, pz, e.kind === 'creature' ? 'paw' : 'foot', dir, 70);
      // (Trodden down: a path forms where many go.)
      this.snow.set(was, Math.max(0.25, d - 0.12));
    }
  }

  // Rain on what it falls on: a splash off the ground, a ring on water.
  rain(game, dt, level) {
    const world = game.world;
    const p = game.player;
    const r = this.r;
    // (Many drops looked at: those on water ring it; a quarter of the rest
    // splash, as many as the eye can follow.)
    const n = level * 150 * dt;
    const count = Math.floor(n) + (Math.random() < n % 1 ? 1 : 0);
    const splash = 0.25 * (r.particleK ?? 1);
    for (let i = 0; i < count; i++) {
      const x = p.x + Math.floor((Math.random() - 0.5) * 30);
      const z = p.z + Math.floor((Math.random() - 0.5) * 26);
      const top = world.topAt(x, z);
      if (top <= 0) continue;
      const id = world.getBlock(x, top - 1, z);
      const b = BLOCKS[id];
      if (b && b.liquid) {
        if (!r.noWaterFx) this.ripple(x, top - 1, z, false);
      } else if (Math.random() < splash) r.emit(x, top - 1, z, { n: 2, color: ['#c8dcf4', '#a8c0e0'], up: 22, speed: 26, gravity: 200, life: 0.22, shape: 'drop', oy: -4, spreadY: 10 });
    }
  }

  ripple(x, y, z, big) {
    const key = K(x, z);
    let l = this.ripples.get(key);
    if (!l) this.ripples.set(key, (l = []));
    if (l.length > 3) l.shift();
    l.push({ y, ox: Math.round((Math.random() - 0.5) * 8), oz: Math.round((Math.random() - 0.5) * 8), t: 0, max: big ? 1.1 : 0.7, big });
  }

  ageRipples(dt) {
    for (const [key, l] of this.ripples) {
      for (let i = l.length - 1; i >= 0; i--) if ((l[i].t += dt) >= l[i].max) l.splice(i, 1);
      if (!l.length) this.ripples.delete(key);
    }
  }

  // Rings round whoever's in the water (wading, swimming), the more as
  // they go.
  wade(game, dt) {
    const world = game.world;
    for (const e of game.visibleEntities || []) {
      if (e.dead || e.kind === 'prop' || e.deck) continue;
      const id = world.getBlock(e.x, e.y, e.z);
      if (!BLOCKS[id] || !BLOCKS[id].liquid) continue;
      e.wadeT = (e.wadeT ?? 0) - dt;
      if (e.wadeT > 0) continue;
      e.wadeT = e.moving ? 0.28 : 1.1;
      // (Its surface: the top of the water there.)
      let y = e.y;
      while (BLOCKS[world.getBlock(e.x, y + 1, e.z)]?.liquid) y++;
      this.ripple(e.x, y, e.z, true);
    }
  }

  // Which sides of a pace of water have land beside it (a bit each).
  shore(world, x, y, z) {
    const key = `${x},${y},${z}`;
    let m = this.foam.get(key);
    if (m !== undefined) return m;
    m = 0;
    for (let d = 0; d < 4; d++) {
      const b = BLOCKS[world.getBlock(x + DX[d], y, z + DZ[d])];
      if (b && !b.liquid && b.solid) m |= 1 << d;
    }
    this.foam.set(key, m);
    return m;
  }

  // Over a block's top just drawn at (sx, sy): what lies on it. `liquid`:
  // water (drawn 3px lower).
  drawTop(ctx, world, wx, y, wz, id, liquid, sx, sy, t) {
    const r = this.r;
    const key = K(wx, wz);
    if (liquid) {
      if (r.noWaterFx) return;
      if (BLOCKS[id] && id === B.water && !BLOCKS[world.getBlock(wx, y + 1, wz)]?.liquid) {
        const m = this.shore(world, wx, y, wz);
        if (m) this.drawFoam(ctx, m, sx, sy + 3, t, wx + wz);
      }
      const l = this.ripples.get(key);
      if (l) for (const q of l) if (q.y === y) this.drawRing(ctx, sx + 8 + q.ox, sy + 3 + 8 + q.oz, q);
      return;
    }
    if (!this.on) return;
    const d = this.snow.get(key);
    const ms = this.marks.get(key);
    if (!d && !ms) return;
    if (world.topAt(wx, wz) !== y + 1) return;
    if (d) {
      // A dusting first, then white, then a layer you can see the depth of.
      const a = Math.min(0.94, 0.25 + d * 0.32);
      // (Round 78) Snow the higher it lies the brighter: on a roof it's
      // white in the sun, on the ground a shade greyer and bluer, so the
      // one stands out from the other.
      ctx.fillStyle = `rgba(${snowTint(y)},${a})`;
      if (d < 0.6) {
        for (let i = 0; i < 16; i++) ctx.fillRect(sx + ((i * 7 + wx * 3) % 16), sy + ((i * 5 + wz * 3) % 16), 2, 1);
      } else ctx.fillRect(sx, sy, 16, 16);
      if (d >= 1.2) {
        const h = Math.min(4, Math.floor(d));
        ctx.fillStyle = `rgba(${snowTint(y - 1)},0.95)`;
        ctx.fillRect(sx, sy + 16, 16, h);
        ctx.fillStyle = 'rgba(170,190,220,0.6)';
        ctx.fillRect(sx, sy + 16 + h, 16, 1);
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.fillRect(sx, sy, 16, 1);
      }
    }
    if (ms) for (const q of ms) this.drawMark(ctx, q, sx, sy, d);
  }

  drawFoam(ctx, m, sx, sy, t, seed) {
    const r = this.r;
    ctx.fillStyle = 'rgba(240,250,255,0.75)';
    for (let d = 0; d < 4; d++) {
      if (!(m & (1 << d))) continue;
      // (Which edge of the picture that side of the pace is, as you look.)
      const [du, dv] = r.toView(DX[d], DZ[d]);
      const phase = Math.floor(t * 4 + seed) % 4;
      for (let i = 0; i < 16; i++) {
        if ((i + phase) % 4 === 0) continue;
        const k = ((i * 5 + seed) % 3 === 0) ? 2 : 1;
        if (du > 0) ctx.fillRect(sx + 16 - k, sy + i, k, 1);
        else if (du < 0) ctx.fillRect(sx, sy + i, k, 1);
        else if (dv < 0) ctx.fillRect(sx + i, sy, 1, k);
        else ctx.fillRect(sx + i, sy + 16 - k, 1, k);
      }
    }
  }

  drawRing(ctx, cx, cy, q) {
    const f = q.t / q.max;
    const rad = 1 + f * (q.big ? 7 : 5);
    ctx.fillStyle = `rgba(225,240,255,${(1 - f) * (q.big ? 0.75 : 0.6)})`;
    const n = q.big ? 12 : 8;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      ctx.fillRect(Math.round(cx + Math.cos(a) * rad), Math.round(cy + Math.sin(a) * rad * 0.5), 1, 1);
    }
  }

  drawMark(ctx, q, sx, sy, d) {
    const a = Math.min(1, q.t / (q.life * 0.4));
    const [du, dv] = this.r.toView(DX[q.dir], DZ[q.dir]);
    const along = du !== 0;
    if (q.kind === 'rut') {
      ctx.fillStyle = d ? `rgba(130,150,180,${0.55 * a})` : `rgba(60,44,30,${0.5 * a})`;
      // Two wheel tracks the length of the pace.
      if (along) {
        ctx.fillRect(sx, sy + 4, 16, 1);
        ctx.fillRect(sx, sy + 11, 16, 1);
      } else {
        ctx.fillRect(sx + 4, sy, 1, 16);
        ctx.fillRect(sx + 11, sy, 1, 16);
      }
      return;
    }
    ctx.fillStyle = `rgba(120,140,175,${0.6 * a})`;
    // Left, right, along the way they went.
    const w = q.kind === 'paw' ? 1 : 2;
    for (let i = 0; i < 2; i++) {
      const o = i * 8 + 3;
      if (along) {
        ctx.fillRect(sx + o, sy + 5 + (i % 2) * 5, w + 1, 1);
      } else {
        ctx.fillRect(sx + 5 + (i % 2) * 5, sy + o, 1, w + 1);
      }
    }
    if (dv === 0 && du === 0) ctx.fillRect(sx + 7, sy + 7, 2, 1);
  }
}
