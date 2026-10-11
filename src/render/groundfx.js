// (Round 77) What the weather and the water do to the ground, as seen:
//   - rain splashing off whatever it lands on, and rings spreading on
//     water where it falls;
//   - the ruts of wagons in mud, after rain;
//   - foam along the shore, and rings round whoever's wading or swimming.
// (Round 82: snow no longer lies in layers, nor holds tracks: what it cost
// to draw wasn't worth what it showed.)
// None of it's in the world itself: it's the picture's own. (Round 83: the
// splashes go with Environmental VFX in the settings; ruts and foam are
// always there; rings on the water as many as the particle limit allows.)
import { B, BLOCKS } from '../world/blocks.js';
import { hash4 } from '../util/rng.js';

const MUDDY = new Set([B.dirt, B.path, B.mud, B.farmland, B.gravel, B.clay, B.grass]);
// (Round 83) Where puddles gather after a while of rain: low, soft ground
// and paving (a few squares of it in each stretch).
const PUDDLY = new Set([B.dirt, B.path, B.mud, B.farmland, B.gravel, B.clay, B.grass, B.cobblestone, B.flagstone].filter((q) => q !== undefined));
// (A square's puddle, if it has one: its size and where it lies in it.)
export function puddleOf(x, z) {
  const h = hash4(x, z, 0x9d1e);
  if (h % 100 >= 7) return null;
  return { w: 7 + (h >>> 8) % 6, d: 3 + (h >>> 12) % 3, ox: ((h >>> 16) % 5) - 2, oz: ((h >>> 20) % 5) - 2 };
}
const K = (x, z) => x * 65536 + z;
const DX = [0, -1, 0, 1];
const DZ = [1, 0, -1, 0];

export class GroundFx {
  constructor(r) {
    this.r = r;
    this.marks = new Map(); // tile -> [{ kind, dir, t, life }]
    this.ripples = new Map(); // tile -> [{ y, ox, oz, t, max, big }]
    this.foam = new Map(); // tile|y -> land-side mask (worked out once)
    this.last = new WeakMap(); // entity -> the tile it was on
    this.wet = 0; // how wet the ground is (0..1): ruts in mud
    this.foamT = 0;
    this.nRipples = 0;
    // (Round 83) Drops bursting on the ground: tile -> [{ y, ox, oz, t }].
    this.splashes = new Map();
  }

  // (Round 83) How many rings may be spreading at once: by the particle
  // limit in the settings.
  get rippleCap() {
    const c = this.r.fxCap;
    return Math.max(12, Math.round((c ? c.parts : 300) / 3));
  }

  // Every frame: the weather on the ground, and who's walked where.
  tick(game, dt) {
    const world = game.world;
    const w = game.weather;
    const p = game.player;
    if (!world || !p) return;
    const below = !!game.dungeon;
    const raining = !below && w && w.kind === 'rain' && w.level > 0.15;
    this.wet = Math.max(0, Math.min(1, this.wet + (raining ? dt / 60 : -dt / 400)));
    // (Water shifts, now and then: the foam's looked at afresh.)
    this.foamT -= dt;
    if (this.foamT <= 0) {
      this.foamT = 6;
      this.foam.clear();
    }
    this.ageMarks(dt);
    this.ageRipples(dt);
    for (const [key, l] of this.splashes) {
      for (let i = l.length - 1; i >= 0; i--) if ((l[i].t += dt) >= 0.22) l.splice(i, 1);
      if (!l.length) this.splashes.delete(key);
    }
    if (raining) this.rain(game, dt, w.level);
    this.tread(game, dt);
    this.wade(game, dt);
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

  // A wagon gone from one pace to the next in mud: its ruts behind it.
  tread(game) {
    const world = game.world;
    for (const e of game.visibleEntities || []) {
      if (e.dead || e.kind === 'prop' || e.deck || e.flying) continue;
      const key = K(e.x, e.z);
      const was = this.last.get(e);
      this.last.set(e, key);
      if (was === undefined || was === key || this.wet <= 0.2 || !(e.mount && e.mount.kind === 'wagon')) continue;
      const px = Math.floor(was / 65536);
      const pz = was - px * 65536;
      const dx = Math.sign(e.x - px);
      const dz = Math.sign(e.z - pz);
      const dir = dz > 0 ? 0 : dx < 0 ? 1 : dz < 0 ? 2 : 3;
      const top = world.topAt(px, pz);
      if (top > 0 && MUDDY.has(world.getBlock(px, top - 1, pz))) this.mark(px, pz, 'rut', dir, 90);
    }
  }

  // Rain on what it falls on: a splash off the ground, a ring on water.
  rain(game, dt, level) {
    const world = game.world;
    const p = game.player;
    const r = this.r;
    // (Many drops looked at: those on water (or a puddle) ring it; the rest
    // burst on the ground in a little crown, as many as the eye can follow.
    // Round 83: seen, now; they were a speck or two.)
    const n = level * 220 * dt;
    const count = Math.floor(n) + (Math.random() < n % 1 ? 1 : 0);
    const splash = 0.6 * (r.particleK ?? 1);
    for (let i = 0; i < count; i++) {
      const x = p.x + Math.floor((Math.random() - 0.5) * 34);
      const z = p.z + Math.floor((Math.random() - 0.5) * 28);
      const top = world.topAt(x, z);
      if (top <= 0) continue;
      const id = world.getBlock(x, top - 1, z);
      const b = BLOCKS[id];
      if (b && b.liquid) this.ripple(x, top - 1, z, false);
      else if (this.wet > 0.3 && PUDDLY.has(id) && puddleOf(x, z)) this.ripple(x, top - 1, z, false);
      else if (!r.noEnvFx && Math.random() < splash && this.nRipples < this.rippleCap) {
        const key = K(x, z);
        let l = this.splashes.get(key);
        if (!l) this.splashes.set(key, (l = []));
        if (l.length < 2) l.push({ y: top - 1, ox: Math.round((Math.random() - 0.5) * 10), oz: Math.round((Math.random() - 0.5) * 10), t: 0 });
      }
    }
  }

  ripple(x, y, z, big) {
    if (this.nRipples >= this.rippleCap) return;
    this.nRipples = (this.nRipples || 0) + 1;
    const key = K(x, z);
    let l = this.ripples.get(key);
    if (!l) this.ripples.set(key, (l = []));
    if (l.length > 3) {
      l.shift();
      this.nRipples--;
    }
    l.push({ y, ox: Math.round((Math.random() - 0.5) * 8), oz: Math.round((Math.random() - 0.5) * 8), t: 0, max: big ? 1.1 : 0.7, big });
  }

  ageRipples(dt) {
    let n = 0;
    for (const [key, l] of this.ripples) {
      for (let i = l.length - 1; i >= 0; i--) if ((l[i].t += dt) >= l[i].max) l.splice(i, 1);
      if (!l.length) this.ripples.delete(key);
      n += l.length;
    }
    this.nRipples = n;
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
    const key = K(wx, wz);
    if (liquid) {
      if (BLOCKS[id] && id === B.water && !BLOCKS[world.getBlock(wx, y + 1, wz)]?.liquid) {
        const m = this.shore(world, wx, y, wz);
        if (m) this.drawFoam(ctx, m, sx, sy + 3, t, wx + wz);
      }
      const l = this.ripples.get(key);
      if (l) for (const q of l) if (q.y === y) this.drawRing(ctx, sx + 8 + q.ox, sy + 3 + 8 + q.oz, q);
      return;
    }
    const ms = this.marks.get(key);
    const sp = this.splashes.size ? this.splashes.get(key) : null;
    const pud = this.wet > 0.25 && PUDDLY.has(id) ? puddleOf(wx, wz) : null;
    if (!ms && !sp && !pud) return;
    if (world.topAt(wx, wz) !== y + 1) return;
    if (ms) for (const q of ms) this.drawMark(ctx, q, sx, sy);
    // (Round 83) Puddles, a while into the rain (drying slowly after), the
    // drops ringing them; and the drops' crowns on the ground.
    if (pud) {
      this.drawPuddle(ctx, pud, sx, sy, Math.min(1, (this.wet - 0.25) / 0.35));
      const l = this.ripples.get(key);
      if (l) for (const q of l) if (q.y === y) this.drawRing(ctx, sx + 8 + pud.ox + Math.round(q.ox / 3), sy + 8 + pud.oz + Math.round(q.oz / 4), { ...q, big: false });
    }
    if (sp) for (const q of sp) if (q.y === y) this.drawSplash(ctx, sx + 8 + q.ox, sy + 8 + q.oz, q.t / 0.22);
  }

  // A puddle lying on a square's top: dark water with the sky's sheen on
  // it, `k` how much of it there is yet.
  drawPuddle(ctx, q, sx, sy, k) {
    const cx = sx + 8 + q.ox;
    const cy = sy + 8 + q.oz;
    const w = Math.max(2, Math.round(q.w * (0.5 + k * 0.5)));
    const d = Math.max(1, Math.round(q.d * (0.5 + k * 0.5)));
    ctx.fillStyle = `rgba(52,66,92,${0.5 * k})`;
    for (let j = -d; j <= d; j++) {
      const half = Math.round(w * Math.sqrt(1 - (j / (d + 0.5)) ** 2));
      ctx.fillRect(cx - half, cy + j, half * 2, 1);
    }
    ctx.fillStyle = `rgba(200,220,245,${0.35 * k})`;
    ctx.fillRect(cx - Math.round(w / 2), cy - Math.max(0, d - 1), Math.max(1, Math.round(w / 2)), 1);
  }

  // A drop bursting on the ground: a pale crown, spreading and gone.
  drawSplash(ctx, cx, cy, f) {
    const a = 0.8 * (1 - f);
    const r = 1 + Math.round(f * 2);
    ctx.fillStyle = `rgba(215,230,250,${a})`;
    ctx.fillRect(cx - r, cy - 1 - Math.round(f * 2), 1, 1);
    ctx.fillRect(cx + r, cy - 1 - Math.round(f * 2), 1, 1);
    ctx.fillRect(cx, cy - 2 - Math.round(f * 3), 1, 1);
    ctx.fillRect(cx - 1, cy, 3, 1);
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

  drawMark(ctx, q, sx, sy) {
    const a = Math.min(1, q.t / (q.life * 0.4));
    const [du] = this.r.toView(DX[q.dir], DZ[q.dir]);
    // Two wheel tracks the length of the pace.
    ctx.fillStyle = `rgba(60,44,30,${0.5 * a})`;
    if (du !== 0) {
      ctx.fillRect(sx, sy + 4, 16, 1);
      ctx.fillRect(sx, sy + 11, 16, 1);
    } else {
      ctx.fillRect(sx + 4, sy, 1, 16);
      ctx.fillRect(sx + 11, sy, 1, 16);
    }
  }
}
