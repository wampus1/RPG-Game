// Lighting. Block light is flood-filled over the world grid (walls stop it,
// windows and doors let it through). The light map is then built in *screen
// space*: for every 16px cell we find the surface actually visible there
// (ground, wall face, roof) and light it by its own column and height, so
// roofs are not lit by lanterns in the street below them.
import { TILE, LH, VIEW_W, VIEW_H, WORLD_Y, DAY_MINUTES } from '../config.js';
import { BLOCKS, B, META_STATE } from '../world/blocks.js';

const MARGIN = 10;

export function skyLight(minute) {
  const m = ((minute % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES;
  const h = m / 60;
  const night = [0.24, 0.28, 0.52];
  const day = [1, 1, 1];
  const dusk = [1, 0.66, 0.5];
  const lerp3 = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
  if (h >= 7.5 && h <= 17.5) return day;
  if (h > 17.5 && h <= 19) return lerp3(day, dusk, (h - 17.5) / 1.5);
  if (h > 19 && h <= 21) return lerp3(dusk, night, (h - 19) / 2);
  if (h >= 4.5 && h < 6) return lerp3(night, dusk, (h - 4.5) / 1.5);
  if (h >= 6 && h < 7.5) return lerp3(dusk, day, (h - 6) / 1.5);
  return night;
}

// The sky in and near the storm: dimmer as you come up to it, pitch black
// in it, a dark red deeper still; a flash of lightning lights it all up.
export function stormSky(sky, S) {
  const mix = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
  let out = mix(sky, [sky[0] * 0.5, sky[1] * 0.52, sky[2] * 0.6], Math.min(1, S.cloud) * 0.7);
  out = mix(out, [0.012, 0.012, 0.022], S.dark);
  if (S.red > 0) out = mix(out, [0.3, 0.035, 0.03], S.red * (0.75 + 0.25 * Math.sin(performance.now() / 260)));
  if (S.flash > 0) out = mix(out, S.red > 0.3 ? [1, 0.82, 0.78] : [0.92, 0.95, 1.08], Math.min(1, S.flash * 1.15));
  return out;
}

// The sky through the ash of the mountain on Kharos (`a`: how thick).
const ASH = [0.42, 0.34, 0.3];
export function ashSky(sky, a) {
  return sky.map((v, i) => Math.min(v, v + (ASH[i] * Math.min(1, v + 0.3) - v) * a));
}

// Below ground there's no sky at all: what you see is what's lit.
const DARK = [0.075, 0.07, 0.095];
const DARK_KAV = [0.06, 0.075, 0.11];

export class Lighting {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    this.scanTimer = 0;
    this.sources = [];
    this.flood = null;
    this.samples = null;
    this.glow = this.makeGlow();
    this.coldGlow = this.makeGlow([140, 230, 255]);
    this.eflood = null;
  }

  // The glow round a Kavorent light, in its floor's colour.
  palGlow(pal) {
    if (!this.palGlows) this.palGlows = new Map();
    let g = this.palGlows.get(pal.name);
    if (!g) this.palGlows.set(pal.name, (g = this.makeGlow(pal.glow)));
    return g;
  }

  // A glow in any colour (a master's own: see Game.entityLights).
  tintGlow(hex) {
    if (!this.tintGlows) this.tintGlows = new Map();
    let g = this.tintGlows.get(hex);
    if (!g) this.tintGlows.set(hex, (g = this.makeGlow([1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)))));
    return g;
  }

  makeGlow(rgb = null) {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    const [r, gg, b] = rgb || [255, 190, 110];
    grd.addColorStop(0, `rgba(${r},${gg},${b},0.55)`);
    grd.addColorStop(0.35, `rgba(${r},${Math.round(gg * 0.8)},${Math.round(b * 0.65)},0.22)`);
    grd.addColorStop(1, `rgba(${r},${Math.round(gg * 0.6)},${Math.round(b * 0.35)},0)`);
    g.fillStyle = grd;
    g.fillRect(0, 0, 64, 64);
    return c;
  }

  scan(world, x0, z0, x1, z1) {
    const out = [];
    for (let z = z0; z <= z1; z++) {
      for (let x = x0; x <= x1; x++) {
        const top = world.topAt(x, z);
        for (let y = 0; y < top; y++) {
          const id = world.getBlock(x, y, z);
          if (id === 0) continue;
          const b = BLOCKS[id];
          if (!b.light) continue;
          if (b.lightWhenState && !(world.getMeta(x, y, z) & META_STATE)) continue;
          // (Some burn brighter in their other state: see blocks.lightState.)
          const L = b.lightState && world.getMeta(x, y, z) & META_STATE ? b.lightState : b.light;
          out.push({ x, y, z, L, cold: b.name.startsWith('kav_') });
        }
      }
    }
    return out;
  }

  draw(r, game) {
    const world = game.world;
    const ctx = r.ctx;
    const player = game.player;
    const below = !!game.dungeon;
    // (Each kind of place its own dark: a barrow's earthy, a mine's warm, a
    // crypt's cold blue, a holdout's smoky red.)
    // (Each of a Kavorent ruin's floors is lit its own colour.)
    const pal = below ? game.dungeon.pal : null;
    let sky = below ? (pal?.dark || game.dungeon.T?.dark || (game.dungeon.kav ? DARK_KAV : DARK)) : skyLight(game.minute);
    // (The mountain's ash over the sun: a brown dusk at noon.)
    // (Smoked-glass goggles from a Kharos glassworks see through it.)
    const goggled = player && player.equip && player.equip.head === 'ash_goggles';
    const ash = !below && game.ashLevel ? game.ashLevel() * (goggled ? 0.25 : 1) : 0;
    if (ash > 0) sky = ashSky(sky, ash);
    // The storm round the islands (see game/stormsea.js): the sky darkening
    // as you come up to it, black under it, then red; white in a flash.
    const S = !below ? game.stormSea : null;
    if (S && (S.cloud > 0.01 || S.flash > 0.01)) sky = stormSky(sky, S);
    // (A Mirefolk fogsight tincture: the dark goes grey-green and clear.)
    if (player && player.buffs && player.buffs.some((q) => q.sight && q.until > game.day * 1440 + game.minute)) sky = [Math.max(sky[0], 0.5), Math.max(sky[1], 0.62), Math.max(sky[2], 0.52)];
    const indoor = r.hidden !== null;
    const dayFull = sky[0] >= 0.999 && sky[2] >= 0.999;
    // World-tile area that visible surfaces can belong to (however the
    // camera is turned).
    const box = r.visibleBox ? r.visibleBox(2) : { x0: Math.floor(r.camX / TILE) - 2, x1: Math.floor((r.camX + (r.vw || VIEW_W)) / TILE) + 2, z0: Math.floor((r.camY - LH * 2) / TILE) - 2, z1: Math.floor((r.camY + (r.vh || VIEW_H) + (WORLD_Y - 1) * LH) / TILE) + 2 };
    const { x0, x1, z0, z1 } = box;
    this.scanTimer -= game.dt;
    const covers = (F) => F && x0 >= F.x0 && z0 >= F.z0 && x1 < F.x0 + F.W && z1 < F.z0 + F.D;
    if (this.scanTimer <= 0 || game.lightDirty || !covers(this.flood)) {
      // Anchor the cached area to a coarse grid so small camera moves reuse it.
      const ax0 = Math.floor(x0 / 16) * 16 - 16;
      const az0 = Math.floor(z0 / 16) * 16 - 16;
      const ax1 = Math.ceil(x1 / 16) * 16 + 16;
      const az1 = Math.ceil(z1 / 16) * 16 + 16;
      const sources = this.scan(world, ax0 - MARGIN, az0 - MARGIN, ax1 + MARGIN, az1 + MARGIN);
      const key = sources.map((q) => `${q.x},${q.y},${q.z},${q.L}`).join(';') + `|${ax0},${az0}`;
      this.scanTimer = 0.5;
      if (!this.flood || key !== this.flood.key || game.lightDirty) {
        const W = ax1 - ax0 + 1;
        const D = az1 - az0 + 1;
        this.sources = sources;
        this.flood = { key, x0: ax0, z0: az0, W, D, ...this.floodFill(world, sources, ax0, az0, W, D) };
        this.samples = null;
      }
      game.lightDirty = false;
    }
    if (dayFull && !indoor && !below) return;
    // The player always carries a faint light so they stay visible at night
    // (fainter below ground: down there, a torch matters).
    // (Out in the black of the storm, not even that: only a torch.)
    const blackout = S ? S.dark : 0;
    const pl = Math.max(player.lightLevel, Math.round((below ? 3 : 4) * (1 - blackout)), 1);
    const pKey = `${player.x},${player.y},${player.z},${pl}`;
    if (!this.pflood || this.pflood.key !== pKey) {
      const R = pl;
      const W = R * 2 + 1;
      this.pflood = { key: pKey, x0: player.x - R, z0: player.z - R, W, D: W, ...this.floodFill(world, [{ x: player.x, y: player.y, z: player.z, L: pl }], player.x - R, player.z - R, W, W) };
    }
    // Screen-aligned sample grid (aligned to world pixels so it is stable).
    const k0 = Math.floor(r.camX / TILE) - 1;
    const m0 = Math.floor(r.camY / TILE) - 1;
    const SW = Math.ceil((r.vw || VIEW_W) / TILE) + 3;
    const SH = Math.ceil((r.vh || VIEW_H) / TILE) + 3;
    const hKey = (r.hidden ? r.hidden.size * 7 + r.hiddenLevel : -1) * 4 + (r.view || 0);
    // (Its size too: as a scene draws the camera in or out, the grid grows
    // and shrinks, and the old samples would be read askew: the dark
    // flickering.)
    if (!this.samples || this.samples.k0 !== k0 || this.samples.m0 !== m0 || this.samples.hKey !== hKey || this.samples.SW !== SW || this.samples.SH !== SH) {
      this.samples = { k0, m0, hKey, SW, SH, pts: this.sampleSurfaces(r, world, k0, m0, SW, SH) };
    }
    // Lights that move: torches carried, wisps, the Kavorent's constructs.
    const ents = game.entityLights ? game.entityLights() : [];
    const eKey = ents.map((q) => `${q.x},${q.y},${q.z},${q.L}`).join(';');
    if (!this.eflood || this.eflood.key !== eKey || this.eflood.x0 !== this.flood.x0 || this.eflood.z0 !== this.flood.z0) {
      const F0 = this.flood;
      this.eflood = ents.length ? { key: eKey, x0: F0.x0, z0: F0.z0, W: F0.W, D: F0.D, ...this.floodFill(world, ents, F0.x0, F0.z0, F0.W, F0.D) } : { key: eKey, x0: F0.x0, z0: F0.z0, W: 0, D: 0 };
    }
    const EF = this.eflood;
    const F = this.flood;
    const PF = this.pflood;
    const pts = this.samples.pts;
    if (this.canvas.width !== SW || this.canvas.height !== SH) {
      this.canvas.width = SW;
      this.canvas.height = SH;
    }
    // (The Kavorent's halls are lit cold.)
    const tint = pal ? pal.tint : below && game.dungeon.kav ? [0.72, 0.92, 1.08] : [1.05, 0.78, 0.46];
    const img = this.ctx.createImageData(SW, SH);
    const px = img.data;
    const lightAt = (G, s) => {
      const lx = s.x - G.x0;
      const lz = s.z - G.z0;
      if (lx < 0 || lz < 0 || lx >= G.W || lz >= G.D) return 0;
      const k = lz * G.W + lx;
      const lv = G.level[k];
      if (lv <= 0) return 0;
      const dy = Math.abs(s.y - G.srcY[k]);
      return lv * Math.max(0, 1 - Math.max(0, dy - 1) * 0.45);
    };
    for (let i = 0; i < SW * SH; i++) {
      const s = pts[i];
      let amb = 1;
      let t = 0;
      if (s) {
        t = Math.max(lightAt(F, s), lightAt(PF, s), EF.W ? lightAt(EF, s) : 0);
        if (s.indoor && !below) amb = 0.58;
        // (Below ground, what light there is carries: a torch's circle is
        // warm and clear, and the dark beyond it the darker for it.)
        if (below) t = Math.min(1.15, t * 1.4);
        // (A torch only just keeps the storm's dark off.)
        if (blackout > 0) t *= 1 - blackout * 0.3;
      }
      const o = i * 4;
      px[o] = Math.min(255, (sky[0] * amb + t * tint[0]) * 255);
      px[o + 1] = Math.min(255, (sky[1] * amb + t * tint[1]) * 255);
      px[o + 2] = Math.min(255, (sky[2] * amb + t * tint[2]) * 255);
      px[o + 3] = 255;
    }
    this.ctx.putImageData(img, 0, 0);
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.canvas, 0, 0, SW, SH, k0 * TILE - r.camX, m0 * TILE - r.camY, SW * TILE, SH * TILE);
    ctx.restore();
    ctx.imageSmoothingEnabled = false;
    // Additive glows around lights at night.
    const dark = 1 - Math.min(sky[0], sky[1], sky[2]);
    if (dark > 0.15) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const mine = player.lightLevel > 4 ? [{ x: player.x, y: player.y, z: player.z, L: player.lightLevel, player: true, cold: player.heldLightKind && player.heldLightKind() === 'cold' }] : [];
      const glowSources = [...this.sources, ...mine, ...ents.map((q) => ({ ...q, player: true }))];
      for (const s of glowSources) {
        if (s.x < x0 - 2 || s.x > x1 + 2 || s.z < z0 - 2 || s.z > z1 + 2) continue;
        if (r.isHidden(s.x, s.y, s.z)) continue;
        // (Some light the room without a haze over themselves: a drone's
        // own eye would wash out the look of it.)
        if (s.noHalo) continue;
        if (!s.player) {
          if (s.covered === undefined) s.covered = this.coveredAbove(world, s, r);
          if (s.covered) continue;
        }
        const [su, sv] = r.toView ? r.toView(s.x, s.z) : [s.x, s.z];
        const sx = su * TILE - r.camX + 8;
        const sy = sv * TILE - s.y * LH - r.camY + LH + 2;
        if (sx < -40 || sy < -40 || sx > (r.vw || VIEW_W) + 40 || sy > (r.vh || VIEW_H) + 40) continue;
        const size = 20 + s.L * 3;
        ctx.globalAlpha = Math.min(1, dark * 1.2) * (0.85 + Math.sin(r.time * 9 + s.x * 3 + s.z) * 0.08) * (s.dim ?? 1);
        ctx.drawImage(s.tint ? this.tintGlow(s.tint) : s.cold ? (pal ? this.palGlow(pal) : this.coldGlow) : this.glow, sx - size / 2, sy - size / 2, size, size);
      }
      ctx.restore();
    }
  }

  // Lights under a roof don't glow through it (unless the roof is cut away).
  coveredAbove(world, s, r) {
    for (let y = s.y + 1; y < Math.min(WORLD_Y, s.y + 7); y++) {
      const b = BLOCKS[world.getBlock(s.x, y, s.z)];
      if (b.opaque && b.render === 'cube') return !r.isHidden(s.x, y, s.z);
    }
    return false;
  }

  // For each screen cell, find the front-most visible surface and the air
  // cell that lights it: {x, y, z, indoor}.
  sampleSurfaces(r, world, k0, m0, SW, SH) {
    const pts = new Array(SW * SH);
    // Screen cells are in view space; the blocks looked up are in the world.
    const W = (u, v) => (r.toWorld ? r.toWorld(u, v) : [u, v]);
    for (let m = 0; m < SH; m++) {
      for (let k = 0; k < SW; k++) {
        const wx = (k0 + k) * TILE + 8;
        const wy = (m0 + m) * TILE + 8;
        const u = Math.floor(wx / TILE);
        let best = null;
        let bestKey = -Infinity;
        for (let y = WORLD_Y - 1; y >= 0; y--) {
          const zt = Math.floor((wy + y * LH) / TILE);
          if (zt * 64 + y + 1 <= bestKey) break;
          const [tx, tz] = W(u, zt);
          const idT = world.getBlock(tx, y, tz);
          if (idT !== B.air && !r.isHidden(tx, y, tz) && BLOCKS[idT].render !== 'plant') {
            const key = zt * 64 + y;
            if (key > bestKey) {
              bestKey = key;
              best = { x: tx, y: y + 1, z: tz };
            }
          }
          const rel = wy + y * LH - TILE;
          const zf = Math.floor(rel / TILE);
          if (rel - zf * TILE < LH) {
            const [fx, fz] = W(u, zf);
            const idF = world.getBlock(fx, y, fz);
            if (idF !== B.air && !r.isHidden(fx, y, fz) && BLOCKS[idF].render === 'cube') {
              const key = zf * 64 + y + 0.5;
              if (key > bestKey) {
                bestKey = key;
                // Lit from the air in front of the face (one row nearer).
                const [ax, az] = W(u, zf + 1);
                best = { x: ax, y, z: az };
              }
            }
          }
        }
        if (best) best.indoor = r.hidden !== null && r.hidden.has(best.x * 65536 + best.z);
        pts[m * SW + k] = best;
      }
    }
    return pts;
  }

  floodFill(world, sources, x0, z0, W, D) {
    const level = new Float32Array(W * D);
    const srcY = new Int8Array(W * D);
    const qx = new Int32Array(1024);
    const qz = new Int32Array(1024);
    const ql = new Int8Array(1024);
    const seen = new Int8Array(31 * 31);
    for (const s of sources) {
      const sx = s.x - x0;
      const sz = s.z - z0;
      if (sx < -s.L || sz < -s.L || sx >= W + s.L || sz >= D + s.L) continue;
      seen.fill(0);
      const R = 15;
      let head = 0;
      let tail = 0;
      qx[tail] = s.x;
      qz[tail] = s.z;
      ql[tail++] = s.L;
      seen[R * 31 + R] = s.L;
      while (head < tail) {
        const x = qx[head];
        const z = qz[head];
        const l = ql[head++];
        const lx = x - x0;
        const lz = z - z0;
        if (lx >= 0 && lz >= 0 && lx < W && lz < D) {
          const v = l / 15;
          const i = lz * W + lx;
          if (v > level[i]) {
            level[i] = v;
            srcY[i] = s.y;
          }
        }
        if (l <= 1) continue;
        for (let d = 0; d < 4; d++) {
          const nx = x + (d === 0 ? 1 : d === 1 ? -1 : 0);
          const nz = z + (d === 2 ? 1 : d === 3 ? -1 : 0);
          const ox = nx - s.x + R;
          const oz = nz - s.z + R;
          if (ox < 0 || oz < 0 || ox > 30 || oz > 30) continue;
          const nl = l - 1;
          if (seen[oz * 31 + ox] >= nl) continue;
          const b1 = BLOCKS[world.getBlock(nx, s.y, nz)];
          if (b1.opaque && b1.render === 'cube') {
            const b2 = BLOCKS[world.getBlock(nx, s.y + 1, nz)];
            if (b2.opaque && b2.render === 'cube') continue;
          }
          seen[oz * 31 + ox] = nl;
          if (tail >= qx.length) continue;
          qx[tail] = nx;
          qz[tail] = nz;
          ql[tail++] = nl;
        }
      }
    }
    return { level, srcY };
  }
}
