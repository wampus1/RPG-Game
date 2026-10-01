// World renderer: draws the voxel grid in an oblique 3/4 projection using
// the painter's algorithm (rows north->south, layers bottom->top), with
// entities interleaved, roof cut-aways, occlusion fading and lighting.
import { TILE, LH, VIEW_W, VIEW_H, WORLD_Y, REGION_W, GROUND, DAY_MINUTES } from '../config.js';
import { BLOCKS, B, META_ROT, META_STATE, CROPS, cropStage, CANOPY_SHIFT } from '../world/blocks.js';
import { TEX, SPR_H, VARIANTS, WATER_FRAMES, buildTextures } from './textures.js';
import { humanoidSheet, creatureSheet, itemIcon, bittenIcon, drawJewelled, frameGlow, CHAR_W, CHAR_H, SPR_PAD, SHEET_H, headSprite, horseSprite, wagonSprite, HORSE_W, HORSE_H, WAGON_W, WAGON_H, WAGON_SEAT, WAGON_BED } from './sprites.js';
import { drawText, textWidth } from './font.js';
import { hash4 } from '../util/rng.js';
import { ITEMS, GEMS } from '../world/items.js';
import { Lighting, skyLight } from './lighting.js';
import { addEffect, drawEffects, drawBurning, drawStatus } from './fx.js';
import { throwDice, stepDice, drawDie } from './dice.js';

// A camera turn takes this long; the pictures swung round are big enough to
// cover the screen at any angle (two screens across and two down, stitched).
const SPIN_TIME = 0.38;
const SNAP_W = Math.ceil(Math.hypot(VIEW_W, VIEW_H)) + 4;
const SNAP_H = VIEW_H * 2;
import { raftSprite, RAFT_BOX } from '../entities/raft.js';

const makeCanvas = (w, h) => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
};

const CULL_SAME = new Set();

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;
    buildTextures();
    this.atlas = TEX.atlas;
    this.camX = 0;
    this.camY = 0;
    this.time = 0;
    this.particles = [];
    this.fx = [];
    this.floaters = [];
    this.lighting = new Lighting();
    this.dropIcons = new Map();
    this.heads = new Map();
    for (const b of BLOCKS) if (b.name.startsWith('leaves') || b.name === 'glass' || b.name === 'water' || b.name === 'ice') CULL_SAME.add(b.id);
    this.hidden = null;
    this.hiddenLevel = 99;
    // Which way the camera looks, in quarter turns (Q and E turn it). The
    // world is drawn in "view" coordinates (u across, v down the screen).
    this.view = 0;
    // A camera turn in progress: pictures of the scene before and after,
    // spun about the player from one to the other.
    this.spin = null;
    // The mouse pointer, and whatever was drawn last under it.
    this.mouse = null;
    this.pick = null;
    this.pickEnt = null;
  }

  // World (x, z) to view (u, v), and back.
  // (0 - a rather than -a, so there's never a negative zero.)
  toView(x, z) {
    switch (this.view) {
      case 1: return [0 - z, x];
      case 2: return [0 - x, 0 - z];
      case 3: return [z, 0 - x];
      default: return [x, z];
    }
  }

  toWorld(u, v) {
    switch (this.view) {
      case 1: return [v, 0 - u];
      case 2: return [0 - u, 0 - v];
      case 3: return [0 - v, u];
      default: return [u, v];
    }
  }

  // A facing (0 down the screen, 1 left, 2 up, 3 right) as it looks now.
  viewDir(d) {
    return (d + this.view) & 3;
  }

  // Turn the camera a quarter turn (+1 or -1). What you saw is kept, to be
  // swung round into the new view over the next few frames.
  turn(d) {
    const game = this.game;
    const from = game && this.ctx ? this.snapshot(game) : null;
    this.view = (this.view + d + 4) & 3;
    this.camInit = false;
    this.particles.length = 0;
    this.floaters.length = 0;
    this.lighting.samples = null;
    this.spin = from ? { from, to: null, d, t: 0, dur: SPIN_TIME } : null;
  }

  // Where the player's feet are on screen.
  playerPoint(game) {
    const rp = game.player.renderPos();
    const [u, v] = this.toView(rp.x, rp.z);
    return { x: u * TILE + 8 - this.camX, y: v * TILE - rp.y * LH + 8 - this.camY };
  }

  // A picture of the scene round the camera, larger than the screen so it
  // can be turned without showing its edges: four views stitched together.
  snapshot(game) {
    const c = document.createElement('canvas');
    c.width = SNAP_W;
    c.height = SNAP_H;
    const cx = c.getContext('2d');
    cx.imageSmoothingEnabled = false;
    const camX = this.camX;
    const camY = this.camY;
    const x0 = Math.round((VIEW_W - SNAP_W) / 2);
    const y0 = Math.round((VIEW_H - SNAP_H) / 2);
    // (Speech and falling rain or snow aren't part of the picture: they're
    // drawn upright over the turn, see drawSpin.)
    const bubbles = new Map();
    for (const ox of [x0, x0 + SNAP_W - VIEW_W]) {
      for (const oy of [y0, y0 + SNAP_H - VIEW_H]) {
        this.camX = camX + ox;
        this.camY = camY + oy;
        this.drawScene(game, 0, true);
        cx.drawImage(this.ctx.canvas, 0, 0, VIEW_W, VIEW_H, ox - x0, oy - y0, VIEW_W, VIEW_H);
        for (const b of this.bubbles) {
          const q = { ...b, x: b.x + ox - x0, y: b.y + oy - y0 };
          bubbles.set(`${b.text}|${Math.round(q.x)}|${Math.round(q.y)}`, q);
        }
      }
    }
    this.camX = camX;
    this.camY = camY;
    const p = this.playerPoint(game);
    return { canvas: c, px: p.x - x0, py: p.y - y0, bubbles: [...bubbles.values()] };
  }

  // The turn itself: the old view swings away as the new one swings in.
  drawSpin(game, dt) {
    const sp = this.spin;
    if (!sp.to) sp.to = this.snapshot(game);
    sp.t += dt;
    const k = Math.min(1, sp.t / sp.dur);
    const e = k * k * (3 - 2 * k);
    const ctx = this.ctx;
    ctx.fillStyle = '#0a0a12';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    const at = this.playerPoint(game);
    const q = (Math.PI / 2) * sp.d;
    const draw = (shot, ang, alpha) => {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(at.x, at.y);
      ctx.rotate(ang);
      ctx.drawImage(shot.canvas, -shot.px, -shot.py);
      ctx.restore();
    };
    draw(sp.from, q * e, 1);
    draw(sp.to, -q * (1 - e), e);
    // The falling rain and snow, and what people are saying, stay upright:
    // the words travel round with whoever's speaking. (The fog and the grey
    // of a wet day are in the pictures, under the night like always, so the
    // turn doesn't wash the dark out.)
    this.drawWeather(game, dt, 'drops');
    const words = (shot, ang, alpha) => {
      if (alpha <= 0.02) return;
      const c = Math.cos(ang);
      const s = Math.sin(ang);
      ctx.globalAlpha = alpha;
      for (const b of shot.bubbles || []) {
        const dx = b.x - shot.px;
        const dy = b.y - shot.py;
        const x = Math.round(at.x + dx * c - dy * s);
        const y = Math.round(at.y + dx * s + dy * c);
        if (b.emote) drawText(ctx, b.text, x, y, b.color, '#000');
        else this.drawBubble(ctx, b.text, x, y, b.color);
      }
      ctx.globalAlpha = 1;
    };
    words(sp.from, q * e, 1 - e);
    words(sp.to, -q * (1 - e), e);
    if (k >= 1) this.spin = null;
  }

  // Everything in the world (not the pointer's highlights): the ground,
  // buildings, people, light and speech.
  drawScene(game, dt, snap = false) {
    const ctx = this.ctx;
    ctx.fillStyle = '#0a0a12';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    this.computeCutaway(game.world, game.player, game.buildingAtPlayer ? game.buildingAtPlayer() : null);
    this.bubbles = [];
    this.pick = null;
    this.pickEnt = null;
    this.pickSeq = 0;
    this.drawWorld(game);
    this.drawProjectiles(game);
    this.drawWeather(game, dt, snap ? 'tint' : 'all');
    this.lighting.draw(this, game);
    drawEffects(this, this.ctx, dt);
    this.drawParticles(dt);
    if (snap) return;
    // Speech bubbles and emotes go on top of everything, roofs included.
    for (const b of this.bubbles) {
      if (b.emote) drawText(ctx, b.text, b.x, b.y, b.color, '#000');
      else this.drawBubble(ctx, b.text, b.x, b.y, b.color);
    }
  }

  worldToScreen(fx, fy, fz) {
    const [u, v] = this.toView(fx, fz);
    return { x: u * TILE - this.camX, y: v * TILE - fy * LH - this.camY };
  }

  // Screen pixel -> world (x,z) at a given layer y (top-face plane of that layer).
  screenToTile(sx, sy, y) {
    const u = Math.floor((sx + this.camX) / TILE);
    const v = Math.floor((sy + this.camY + y * LH) / TILE);
    const [x, z] = this.toWorld(u, v);
    return { x, z };
  }

  // The world rectangle the screen can show (with a margin, in tiles).
  visibleBox(margin = 2) {
    const u0 = Math.floor(this.camX / TILE) - margin;
    const u1 = Math.floor((this.camX + VIEW_W) / TILE) + margin;
    const v0 = Math.floor((this.camY - SPR_H - LH) / TILE) - margin;
    const v1 = Math.floor((this.camY + VIEW_H + (WORLD_Y - 1) * LH) / TILE) + margin;
    const a = this.toWorld(u0, v0);
    const b = this.toWorld(u1, v1);
    return { x0: Math.min(a[0], b[0]), x1: Math.max(a[0], b[0]), z0: Math.min(a[1], b[1]), z1: Math.max(a[1], b[1]) };
  }

  // Is the mouse over an atlas image drawn at (dx, dy)? (Solid pixels only
  // when `alphaTest`.)
  under(s, dx, dy, w = s.w, h = s.h, alphaTest = true) {
    const m = this.mouse;
    if (!m) return false;
    const px = m.x - dx;
    const py = m.y - dy;
    if (px < 0 || py < 0 || px >= w || py >= h) return false;
    if (!alphaTest || !TEX.alpha) return true;
    const sx = Math.floor(px * (s.w / w));
    const sy = Math.floor(py * (s.h / h));
    return TEX.alpha.data[(s.y + sy) * TEX.alpha.w + s.x + sx] > 40;
  }

  // ------------------------------------------------------------------ frame
  render(game, dt) {
    this.frameDt = dt;
    this.game = game;
    this.time += dt;
    const player = game.player;
    const rp = player.renderPos();
    const [pu, pv] = this.toView(rp.x, rp.z);
    // Camera follows the player's feet (smoothed, pixel snapped).
    const tx = pu * TILE + 8 - VIEW_W / 2;
    const ty = pv * TILE - rp.y * LH + LH + 8 - VIEW_H / 2 - 10;
    if (!this.camInit) {
      this.cx = tx;
      this.cy = ty;
      this.camInit = true;
    }
    const k = 1 - Math.pow(0.0005, dt);
    this.cx += (tx - this.cx) * k;
    this.cy += (ty - this.cy) * k;
    if (game.shake > 0 && !this.noShake) {
      this.cx += (Math.random() - 0.5) * game.shake * 3;
      this.cy += (Math.random() - 0.5) * game.shake * 3;
    }
    this.camX = Math.round(this.cx);
    this.camY = Math.round(this.cy);
    if (this.spin) {
      this.drawSpin(game, dt);
      return;
    }
    this.drawScene(game, dt);
    this.drawOverlays(game);
  }

  // ------------------------------------------------------------------ cutaway
  computeCutaway(world, player, bld = null) {
    const px = player.x;
    const pz = player.z;
    const py = player.y;
    // Indoors if something solid is overhead (tall halls have high ridges).
    const covered = (x, z) => {
      for (let y = py + 2; y < Math.min(WORLD_Y, py + 16); y++) {
        const id = world.getBlock(x, y, z);
        if (id !== B.air && BLOCKS[id].render === 'cube' && !BLOCKS[id].name.startsWith('leaves')) return true;
      }
      return false;
    };
    this.hidden = null;
    // Inside a building's walls counts even under a hole in the roof.
    const inside = bld && !bld.underConstruction && px >= bld.x0 && px <= bld.x1 && pz >= bld.z0 && pz <= bld.z1 && py < (bld.roofBase ?? WORLD_Y);
    if (!inside && !covered(px, pz)) return;
    // Flood-fill the covered area (the roof footprint).
    const set = new Set();
    const q = [[px, pz]];
    set.add(px * 65536 + pz);
    if (inside) {
      for (let z = bld.z0; z <= bld.z1; z++) {
        for (let x = bld.x0; x <= bld.x1; x++) {
          const k = x * 65536 + z;
          if (set.has(k)) continue;
          set.add(k);
          q.push([x, z]);
        }
      }
    }
    while (q.length && set.size < 700) {
      const [x, z] = q.pop();
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx;
        const nz = z + dz;
        const k = nx * 65536 + nz;
        if (set.has(k) || Math.abs(nx - px) > 24 || Math.abs(nz - pz) > 20) continue;
        if (!covered(nx, nz)) continue;
        set.add(k);
        q.push([nx, nz]);
      }
    }
    this.hidden = set;
    this.hiddenLevel = py + 1;
  }

  isHidden(x, y, z) {
    return this.hidden !== null && y >= this.hiddenLevel && this.hidden.has(x * 65536 + z);
  }

  // ------------------------------------------------------------------ world
  drawWorld(game) {
    const ctx = this.ctx;
    const world = game.world;
    const atlas = this.atlas;
    const camX = this.camX;
    const camY = this.camY;
    const x0 = Math.floor(camX / TILE) - 1;
    const x1 = Math.floor((camX + VIEW_W) / TILE) + 1;
    const zMin = Math.floor((camY - SPR_H - LH) / TILE) - 1;
    const zMax = Math.floor((camY + VIEW_H + (WORLD_Y - 1) * LH) / TILE) + 1;
    const W = x1 - x0 + 1;
    const nRows = zMax - zMin + 2;
    // Column cache: region + base index for every visible column. Columns
    // are laid out in view space (u across, v down); each maps to one world
    // column however the camera is turned.
    const colR = new Array(W * nRows);
    const colB = new Int32Array(W * nRows);
    const colTop = new Int8Array(W * nRows);
    const colWX = new Int32Array(W * nRows);
    const colWZ = new Int32Array(W * nRows);
    const view = this.view;
    for (let r = 0; r < nRows; r++) {
      const v = zMin + r;
      for (let i = 0; i < W; i++) {
        const [wx, wz] = this.toWorld(x0 + i, v);
        const reg = world.regionAt(wx, wz);
        const ci = r * W + i;
        colR[ci] = reg;
        colWX[ci] = wx;
        colWZ[ci] = wz;
        if (reg) {
          const lx = wx - reg.x0;
          const lz = wz - reg.z0;
          colB[ci] = (lz * REGION_W + lx) * WORLD_Y;
          colTop[ci] = reg.top[lz * REGION_W + lx];
        } else colTop[ci] = -1;
      }
    }
    const getAt = (ci, y) => {
      const reg = colR[ci];
      if (!reg || y < 0 || y >= WORLD_Y) return y < 0 ? B.bedrock : B.air;
      return reg.blocks[colB[ci] + y];
    };
    const metaAt = (ci, y) => colR[ci].meta[colB[ci] + y];

    // Bucket entities by row.
    const buckets = new Map();
    for (const e of game.visibleEntities) {
      const wp = e.renderPos();
      const [u, v] = this.toView(wp.x, wp.z);
      const rp = { x: u, y: wp.y, z: v };
      const row = Math.ceil(rp.z - 0.001);
      if (row < zMin || row > zMax) continue;
      let arr = buckets.get(row);
      if (!arr) buckets.set(row, (arr = []));
      arr.push({ e, rp, layer: Math.ceil(rp.y - 0.001) + 1 });
    }
    this.fishingDecos(game, buckets, zMin, zMax);
    this.leadDecos(game, buckets, zMin, zMax);
    this.diceDecos(buckets, zMin, zMax);

    const player = game.player;
    const prp = player.renderPos();
    const [ppu, ppv] = this.toView(prp.x, prp.z);
    const psx = ppu * TILE - camX;
    const psy = ppv * TILE - prp.y * LH + LH - camY;
    const pRect = { x0: psx - 6, x1: psx + 22, y0: psy - 20, y1: psy + 20 };
    const pz = this.toView(player.x, player.z)[1];
    const mouse = this.mouse;
    const cur = game.cursor;
    const pLayer = player.y;
    const waterFrame = Math.floor(this.time * 3) % WATER_FRAMES;
    const animFrame = Math.floor(this.time * 8);
    const hidden = this.hidden;
    const hLevel = this.hiddenLevel;
    const hid = (x, y, z) => hidden !== null && y >= hLevel && hidden.has(x * 65536 + z);
    this.cursorDrawList = null;

    for (let r = 0; r < nRows - 1; r++) {
      const z = zMin + r;
      const ents = buckets.get(z);
      if (ents) ents.sort((a, b) => a.layer - b.layer || a.rp.y - b.rp.y);
      let ei = 0;
      const rowBase = r * W;
      const frontBase = (r + 1) * W;
      const fadeRow = z >= pz && z <= pz + 7;
      for (let y = 0; y < WORLD_Y; y++) {
        const sy = z * TILE - y * LH - camY;
        if (sy < VIEW_H + 4 && sy + SPR_H + LH > -4) {
          const fadeLayer = fadeRow && y >= pLayer && (z > pz || y > pLayer + 1);
          for (let i = 0; i < W; i++) {
            const ci = rowBase + i;
            if (y >= colTop[ci]) continue;
            const id = getAt(ci, y);
            if (id === 0) continue;
            const x = x0 + i;
            const wx = colWX[ci];
            const wz = colWZ[ci];
            // (Something set down belongs with what it's set on: it shows
            // whenever that does, a cut-away roof or not.)
            if (hid(wx, id === B.placed_item ? y - 1 : y, wz)) continue;
            const b = BLOCKS[id];
            const sx = x * TILE - camX;
            let alpha = 1;
            if (fadeLayer && sx + TILE > pRect.x0 && sx < pRect.x1 && sy + SPR_H > pRect.y0 && sy < pRect.y1) alpha = this.fadeFor(sx, sy, psx, psy);
            if (alpha < 1) ctx.globalAlpha = alpha;
            // Blocks faded out because they hide the player can be clicked through.
            const pickable = mouse && alpha >= 0.6 && mouse.x >= sx - 2 && mouse.x < sx + 18 && mouse.y >= sy - 16 && mouse.y < sy + SPR_H + 2;
            const v = hash4(wx, y, wz) % VARIANTS;
            const render = b.render;
            if (render === 'cube' || render === 'liquid' || (render === 'door' && !(metaAt(ci, y) & META_STATE))) {
              const rot = b.rotatable ? ((metaAt(ci, y) & META_ROT) + view) & 3 : 0;
              // Top face.
              const above = getAt(ci, y + 1);
              const ab = BLOCKS[above];
              const aboveHidden = hid(wx, y + 1, wz);
              const showTop = aboveHidden || !(ab.opaque && ab.render === 'cube') && !(CULL_SAME.has(id) && above === id) && !(render === 'liquid' && ab.liquid);
              const liquid = render === 'liquid';
              if (showTop) {
                const tops = TEX.top[id * 4 + rot];
                const s = liquid ? tops[waterFrame] : tops[v % tops.length];
                const oy = liquid ? 3 : 0;
                ctx.drawImage(atlas, s.x, s.y, 16, 16, sx, sy + oy, 16, 16);
                if (pickable && this.under(s, sx, sy + oy, 16, 16, false)) this.pick = { x: wx, y, z: wz, face: 'top', id, seq: ++this.pickSeq };
                if (!liquid && !aboveHidden) this.edgeShade(ctx, getAt, ci, W, y, sx, sy, id);
                // Higher ground is a touch brighter so terraces read as height.
                if (y > 6 && !liquid && b.opaque) {
                  ctx.fillStyle = `rgba(255,250,235,${Math.min(0.16, (y - 6) * 0.028)})`;
                  ctx.fillRect(sx, sy, 16, 16);
                }
                if (aboveHidden && b.opaque) {
                  // Cut-away wall tops read like a floor-plan section.
                  ctx.fillStyle = 'rgba(16,12,24,0.62)';
                  ctx.fillRect(sx, sy, 16, 16);
                  ctx.fillStyle = 'rgba(255,240,200,0.18)';
                  ctx.fillRect(sx, sy, 16, 1);
                }
              }
              // Front face.
              const fr = getAt(frontBase + i, y);
              const fb = BLOCKS[fr];
              const frontHidden = hid(colWX[frontBase + i], y, colWZ[frontBase + i]);
              const showFront = frontHidden || !(fb.opaque && fb.render === 'cube') && !(CULL_SAME.has(id) && fr === id) && !(liquid && fb.liquid);
              if (showFront && !(liquid && fb.solid)) {
                const fronts = TEX.front[id * 4 + rot];
                const s = liquid ? fronts[waterFrame] : fronts[v % fronts.length];
                ctx.drawImage(atlas, s.x, s.y, 16, LH, sx, sy + 16 + (liquid ? 3 : 0), 16, liquid ? LH - 3 : LH);
                if (pickable && this.under(s, sx, sy + 16 + (liquid ? 3 : 0), 16, liquid ? LH - 3 : LH, false)) this.pick = { x: wx, y, z: wz, face: 'front', id, seq: ++this.pickSeq };
              }
            } else if (render === 'door') {
              const rot = ((metaAt(ci, y) & META_ROT) + view) & 3;
              const s = TEX.sprite[id * 4 + rot][0];
              ctx.drawImage(atlas, s.x, s.y, s.w, s.h, sx, sy, s.w, s.h);
              if (pickable && this.under(s, sx, sy)) this.pick = { x: wx, y, z: wz, face: mouse.y - sy < 16 ? 'top' : 'front', id, seq: ++this.pickSeq, prop: true };
            } else if (render === 'sprite' || render === 'plant') {
              const meta = metaAt(ci, y);
              const rot = b.rotatable ? ((meta & META_ROT) + view) & 3 : 0;
              const arr = TEX.sprite[id * 4 + rot];
              const st = meta & META_STATE ? 1 : 0;
              let idx;
              if (render === 'plant') idx = CROPS[id] ? cropStage(meta) : v;
              else if (id === B.rock || id === B.bed) idx = st * 4 + (id === B.bed ? hash4(wx, wz, 5) % 4 : v);
              else if (id === B.canopy || id === B.tent || id === B.bunting || id === B.festival_banner) idx = st * 4 + ((meta >> CANOPY_SHIFT) & 3);
              else idx = st * 4 + (animFrame + wx + wz) % 4;
              const s = arr[idx] || arr[0];
              // Plants sway gently.
              ctx.drawImage(atlas, s.x, s.y, s.w, s.h, sx, sy + SPR_H - s.h, s.w, s.h);
              if (pickable && this.under(s, sx, sy + SPR_H - s.h)) this.pick = { x: wx, y, z: wz, face: mouse.y - sy < 16 ? 'top' : 'front', id, seq: ++this.pickSeq, prop: true };
              // Hanging signs show what the building is.
              if (id === B.hanging_sign) {
                const ic = game.signIcons && game.signIcons.get(`${wx},${y},${wz}`);
                if (ic) ctx.drawImage(this.dropIcon(ic), sx + 3, sy + SPR_H - s.h + 4);
              }
            } else if (render === 'placed') {
              // Something set down: lying on the ground, a little shadow under it.
              const got = game.placed && game.placed.get(`${wx},${y},${wz}`);
              if (got) {
                const sh = TEX.misc.shadow;
                ctx.globalAlpha = 0.6 * (alpha < 1 ? alpha : 1);
                ctx.drawImage(atlas, sh.x, sh.y, 16, 8, sx + 1, sy + SPR_H - 6, 14, 6);
                ctx.globalAlpha = alpha < 1 ? alpha : 1;
                const icon = got.bites ? bittenIcon(got.item, got.bites) : itemIcon(got.item);
                drawJewelled(ctx, icon, got.item, sx, sy + SPR_H - 14, this.time, true);
                if (got.count > 1) drawText(ctx, String(got.count), sx + 10, sy + SPR_H - 6, '#ffffff', '#000');
                if (pickable && this.under(null, sx, sy + SPR_H - 16, 16, 14, false)) this.pick = { x: wx, y, z: wz, face: 'front', id, seq: ++this.pickSeq, prop: true };
              }
            } else if (render === 'flat') {
              const arr = TEX.sprite[id * 4];
              const s = arr[v % arr.length];
              const below = getAt(ci, y - 1);
              const oy = BLOCKS[below].liquid ? 3 : 0;
              ctx.drawImage(atlas, s.x, s.y, 16, 16, sx, sy + LH + oy, 16, 16);
              if (pickable && this.under(s, sx, sy + LH + oy, 16, 16)) this.pick = { x: wx, y, z: wz, face: 'top', id, seq: ++this.pickSeq, prop: true, flat: true };
            } else if (render === 'fence') {
              if (this.drawFence(ctx, world, wx, y, wz, sx, sy, pickable) && pickable) this.pick = { x: wx, y, z: wz, face: mouse.y - sy < 16 ? 'top' : 'front', id, seq: ++this.pickSeq, prop: true };
            }
            if (alpha < 1) ctx.globalAlpha = 1;
            if (cur && cur.x === wx && cur.y === y && cur.z === wz) {
              this.cursorDrawList = { sx, sy, b };
            }
          }
        }
        // Entities standing in this row whose body occupies up to this layer.
        if (ents) {
          while (ei < ents.length && ents[ei].layer <= y) {
            const q = ents[ei++];
            if (q.deco) q.deco();
            else this.drawEntity(ctx, q.e, q.rp, game);
          }
        }
      }
      if (ents) {
        while (ei < ents.length) {
          const q = ents[ei++];
          if (q.deco) q.deco();
          else this.drawEntity(ctx, q.e, q.rp, game);
        }
      }
    }
  }

  fadeFor(sx, sy, psx, psy) {
    const d = Math.hypot((sx - psx) / 16, (sy + 14 - psy) / 16);
    return Math.min(1, 0.3 + Math.max(0, d - 0.9) * 0.5);
  }

  // Alpha a block is drawn with because it hides the player (1 = opaque).
  occlusionAlpha(x, y, z, player) {
    const rp = player.renderPos();
    const [u, v] = this.toView(x, z);
    const pv = this.toView(player.x, player.z)[1];
    if (!(v >= pv && v <= pv + 7 && y >= player.y && (v > pv || y > player.y + 1))) return 1;
    const [pu, pvv] = this.toView(rp.x, rp.z);
    const psx = pu * TILE - this.camX;
    const psy = pvv * TILE - rp.y * LH + LH - this.camY;
    const sx = u * TILE - this.camX;
    const sy = v * TILE - y * LH - this.camY;
    if (!(sx + TILE > psx - 6 && sx < psx + 22 && sy + SPR_H > psy - 20 && sy < psy + 20)) return 1;
    return this.fadeFor(sx, sy, psx, psy);
  }

  // Soft edge shading on top faces next to taller neighbours / drops.
  edgeShade(ctx, getAt, ci, W, y, sx, sy, id) {
    const up = BLOCKS[getAt(ci, y + 1)];
    if (up.solid) return;
    const lft = BLOCKS[getAt(ci - 1, y + 1)];
    const rgt = BLOCKS[getAt(ci + 1, y + 1)];
    const nth = BLOCKS[getAt(ci - W, y + 1)];
    ctx.fillStyle = 'rgba(10,6,20,0.28)';
    if (lft.opaque && lft.render === 'cube') ctx.fillRect(sx, sy, 2, 16);
    if (rgt.opaque && rgt.render === 'cube') ctx.fillRect(sx + 14, sy, 2, 16);
    if (nth.opaque && nth.render === 'cube') ctx.fillRect(sx, sy, 16, 3);
    // Ledge lines where the neighbour is lower.
    const lSame = BLOCKS[getAt(ci - 1, y)];
    const rSame = BLOCKS[getAt(ci + 1, y)];
    ctx.fillStyle = 'rgba(10,6,20,0.35)';
    if (!lSame.solid) ctx.fillRect(sx, sy, 1, 16);
    if (!rSame.solid) ctx.fillRect(sx + 15, sy, 1, 16);
    const nSame = BLOCKS[getAt(ci - W, y)];
    if (!nSame.solid) {
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.fillRect(sx, sy, 16, 1);
    }
  }

  // Which way something seen side-on faces on screen (left, or right):
  // going up or down the screen, it keeps the way it last faced.
  sideOf(e) {
    const d = this.viewDir(e.dir);
    if (d === 1) e.sideLeft = true;
    else if (d === 3) e.sideLeft = false;
    return e.sideLeft !== false;
  }

  drawSide(ctx, img, x, y, left) {
    if (left) {
      ctx.drawImage(img, Math.round(x), Math.round(y));
      return;
    }
    ctx.save();
    ctx.translate(Math.round(x) + img.width, Math.round(y));
    ctx.scale(-1, 1);
    ctx.drawImage(img, 0, 0);
    ctx.restore();
  }

  // Under a rider: a horse; under a driver: the wagon, its horse out in
  // front. Returns how far up the rider sits.
  drawMount(ctx, e, m, sx, feetY) {
    const left = this.sideOf(e);
    const moving = e.moving;
    const f = moving ? 1 + (Math.floor(this.time * 6) % 2) : 0;
    const horse = horseSprite(f, m.coat || 0, m.banner || null, !!m.saddle);
    if (m.kind === 'horse') {
      this.drawSide(ctx, horse, sx + 8 - HORSE_W / 2, feetY - HORSE_H + 1, left);
      return 12;
    }
    // A wagon: the driver on the bench at the front, the horse ahead,
    // anyone riding along sat in the back.
    this.drawWagonAt(ctx, sx + 8, feetY, left, m, moving ? Math.floor(this.time * 5) : 0, horse);
    return WAGON_SEAT.lift;
  }

  // A wagon with its bench at screen x `cx` (so a driver sat there is
  // centred on it), its horse in the shafts (if `horse`), and passengers.
  drawWagonAt(ctx, cx, feetY, left, m, frame = 0, horse = null) {
    const wx = left ? cx - WAGON_SEAT.x - 1 : cx - (WAGON_W - WAGON_SEAT.x) + 1;
    const wy = feetY - WAGON_H + 1;
    const hood = m.hood !== false;
    if (horse) this.drawSide(ctx, horse, left ? wx - HORSE_W + 7 : wx + WAGON_W - 7, feetY - HORSE_H + 1, left);
    // Passengers in the bed (under the canvas, its sides rolled up for
    // them, on a covered wagon): heads and shoulders showing over the side.
    const riders = m.riders || [];
    const sat = (front) => riders.forEach((look, i) => {
      const seat = WAGON_BED[i % WAGON_BED.length];
      const px = left ? wx + seat.x : wx + WAGON_W - 1 - seat.x;
      const sheet = humanoidSheet(look);
      const top = front ? wy + SPR_PAD - 5 : feetY - CHAR_H + 1 - seat.lift;
      ctx.drawImage(sheet, 4 * CHAR_W, (left ? 1 : 3) * SHEET_H, CHAR_W, 14, px - 8, top - SPR_PAD, CHAR_W, 14);
    });
    if (!hood) sat(false);
    this.drawSide(ctx, wagonSprite(m.banner || null, frame, hood ? (riders.length ? 'open' : true) : false), wx, wy, left);
    if (hood && riders.length) {
      // In under the canvas, seen through the rolled-up side.
      ctx.save();
      ctx.beginPath();
      ctx.rect(left ? wx + 15 : wx + WAGON_W - 36, wy + 5, 21, 7);
      ctx.clip();
      sat(true);
      ctx.restore();
    }
  }

  // A wagon standing still: its hood, wheels and banner (and whoever's
  // sitting in it).
  drawProp(ctx, e, sx, feetY) {
    if (e.type !== 'wagon') return;
    const left = e.face === undefined ? true : ((e.face + this.view) & 3) !== 3;
    const sh = TEX.misc.shadow;
    ctx.globalAlpha = 0.6;
    ctx.drawImage(this.atlas, sh.x, sh.y, 16, 8, sx - 10, feetY - 4, 36, 8);
    ctx.globalAlpha = 1;
    this.drawWagonAt(ctx, sx + 8, feetY, left, { banner: e.banner, riders: e.riders || [], hood: e.hood }, 0, e.horse ? horseSprite(0, e.horse.coat || 0, null, !!e.horse.saddle) : null);
    // Under the mouse? (To climb in.)
    const m = this.mouse;
    if (m && m.x >= sx - 10 && m.x < sx + 26 && m.y >= feetY - WAGON_H && m.y < feetY + 2) this.pickEnt = { e, seq: ++this.pickSeq };
  }

  // A fence post with rails to its neighbours (in view directions). Returns
  // whether any drawn part is under the mouse, when asked.
  drawFence(ctx, world, x, y, z, sx, sy, pickTest = false) {
    const f = TEX.misc.fence;
    const atlas = this.atlas;
    const conn = (du, dv) => {
      const [dx, dz] = this.toWorld(du, dv);
      const b = BLOCKS[world.getBlock(x + dx, y, z + dz)];
      return b.render === 'fence' || (b.opaque && b.render === 'cube') || b.render === 'door';
    };
    let hit = false;
    const d = (s) => {
      ctx.drawImage(atlas, s.x, s.y, s.w, s.h, sx, sy, s.w, s.h);
      if (pickTest && !hit && this.under(s, sx, sy)) hit = true;
    };
    if (conn(0, -1)) d(f.north);
    if (conn(-1, 0)) d(f.west);
    d(f.post);
    if (conn(1, 0)) d(f.east);
    if (conn(0, 1)) d(f.south);
    return hit;
  }

  // ------------------------------------------------------------------ entities
  drawEntity(ctx, e, rp, game) {
    const sx = Math.round(rp.x * TILE - this.camX);
    const floorY = Math.round(rp.z * TILE - rp.y * LH + LH - this.camY); // top of floor face
    const feetY = floorY + 10 - (e.hop || 0);
    if (sx < -32 || sx > VIEW_W + 32 || feetY < -40 || feetY > VIEW_H + 40) return;
    const sh = TEX.misc.shadow;
    const inWater = e.inWater;
    // Sat in the back of a wagon: drawn with it (see drawProp).
    if (e.inWagon) return;
    if (e.kind === 'item') {
      const bob = Math.sin(this.time * 4 + e.id) * 1.5;
      ctx.globalAlpha = 0.7;
      ctx.drawImage(this.atlas, sh.x, sh.y, 16, 8, sx + 2, feetY - 3, 12, 5);
      ctx.globalAlpha = 1;
      const icon = this.dropIcon(e.item);
      const air = e.air || 0;
      drawJewelled(ctx, icon, e.item, sx + 4, Math.round(feetY - 9 + bob - air * LH), this.time, true);
      return;
    }
    // A wagon standing still (at a camp or outside town).
    if (e.kind === 'prop') {
      this.drawProp(ctx, e, sx, feetY);
      return;
    }
    let bob = 0;
    if (e.raft) {
      // The raft, turned to its heading pixel by pixel, bobbing on the water.
      bob = Math.round(Math.sin(this.time * 2.2 + e.id) * 0.8);
      const img = raftSprite(e.raft.ang - this.view * Math.PI / 2, makeCanvas);
      ctx.drawImage(img, sx + 8 - RAFT_BOX / 2, floorY + 8 - RAFT_BOX / 2 + bob);
    } else if (!e.sleeping && !inWater) ctx.drawImage(this.atlas, sh.x, sh.y, 16, 8, sx, feetY - 4, 16, 8);
    if (e.flash > 0) ctx.filter = 'brightness(3)';
    if (e.kind === 'creature' && e.species === 'horse') {
      // A horse, bigger than the rest: side on, turned the way it's going.
      const left = this.sideOf(e);
      const f = e.moving ? 1 + (Math.floor(this.time * 6) % 2) : 0;
      this.drawSide(ctx, horseSprite(f, e.variant || 0, e.banner || null, !!e.saddled), sx + 8 - HORSE_W / 2, feetY - HORSE_H + 1, left);
    } else if (e.kind === 'creature') {
      const sheet = creatureSheet(e.species, e.variant || 0);
      const frames = sheet.width / 32;
      const f = e.moving ? Math.floor(this.time * 6) % frames : 0;
      const flip = e.dir === 3 ? frames : 0;
      const hop = e.species === 'slime' ? Math.abs(Math.sin(this.time * 6 + e.id)) * 3 : 0;
      ctx.drawImage(sheet, (f + flip) * 16, 0, 16, 16, sx, Math.round(feetY - 15 - hop), 16, 16);
    } else {
      if (e.sleeping) {
        const head = this.headFor(e);
        ctx.drawImage(head, sx + 2, floorY - 1);
        if (!e.down && Math.floor(this.time * 1.5 + e.id) % 3 === 0) drawText(ctx, 'z', sx + 12, floorY - 8 - (this.time * 4 % 4), '#c8d8ff');
      } else {
        const sheet = humanoidSheet(e.look);
        // On horseback, or up on a wagon's bench: the beast (and the wagon)
        // first, the rider sitting up on top.
        const mount = e.mount && !e.sleeping ? e.mount : null;
        let lift = 0;
        if (mount) lift = this.drawMount(ctx, e, mount, sx, feetY);
        const frame = e.actionTimer > 0 && !mount ? 3 : e.raft || mount ? 4 : e.moving ? 1 + (Math.floor(this.time * 7) % 2) : e.sitting ? 4 : 0;
        const dir = mount ? (this.sideOf(e) ? 1 : 3) : this.viewDir(e.dir);
        const top = feetY - CHAR_H + 1 + (e.raft ? 1 + bob : 0) - lift;
        // Jewelled armour: a faint glow of its stone's colour round them.
        const worn = e.kind === 'player' ? Object.values(e.equip || {}) : e.rec ? Object.values(e.rec.wear || {}) : [];
        const stone = worn.map((k) => k && ITEMS[k] && ITEMS[k].socket).find(Boolean);
        if (stone && !inWater) {
          const a = ctx.globalAlpha;
          ctx.globalAlpha = a * (0.3 + 0.25 * (0.5 + 0.5 * Math.sin(this.time * 2.4 + e.id)));
          ctx.drawImage(frameGlow(sheet, frame * CHAR_W, dir * SHEET_H, CHAR_W, SHEET_H, GEMS[stone].color), sx - 1, top - SPR_PAD - 1);
          ctx.globalAlpha = a;
        }
        if (inWater) {
          ctx.drawImage(sheet, frame * CHAR_W, dir * SHEET_H, CHAR_W, SHEET_H - 6, sx, top + 3 - SPR_PAD, CHAR_W, SHEET_H - 6);
          ctx.fillStyle = 'rgba(80,150,220,0.55)';
          ctx.fillRect(sx + 2, top + CHAR_H - 5, 12, 2);
        } else ctx.drawImage(sheet, frame * CHAR_W, dir * SHEET_H, CHAR_W, SHEET_H, sx, top - SPR_PAD, CHAR_W, SHEET_H);
        const held = e.heldItem ? e.heldItem() : null;
        if (held) this.drawHeld(ctx, held, e, sx, top);
        // ...and a glint of it now and then.
        if (stone && !this.spin) {
          e.shimmerT = (e.shimmerT || 0) - (this.frameDt || 0.016);
          if (e.shimmerT <= 0) {
            e.shimmerT = 0.6 + Math.random() * 0.6;
            const rp = e.renderPos();
            this.emit(rp.x + (Math.random() - 0.5) * 0.6, rp.y + 0.6 + Math.random() * 0.8, rp.z, { n: 1, color: [GEMS[stone].color, '#ffffff'], up: 8, speed: 6, life: 0.7, gravity: -6 });
          }
        }
      }
    }
    if (e.flash > 0) ctx.filter = 'none';
    // On fire, dazed, chilled.
    if (!e.dead && !this.spin && e.kind !== 'item') {
      const tall = e.kind !== 'creature' || e.species === 'horse';
      if (e.burnT > 0) drawBurning(this, ctx, e, sx, feetY, tall, this.frameDt || 0.016);
      if (e.stunT > 0 || e.slowT > 0) drawStatus(this, ctx, e, sx, feetY, tall, this.frameDt || 0.016);
    }
    // Under the mouse? (The last thing drawn there is what you point at.)
    const m = this.mouse;
    if (m && e.kind !== 'player' && e.kind !== 'item' && !e.dead) {
      const h = e.kind === 'creature' ? 14 : e.sleeping ? 8 : 24;
      if (m.x >= sx + 2 && m.x < sx + 14 && m.y >= feetY - h && m.y < feetY + 2) this.pickEnt = { e, seq: ++this.pickSeq };
    }
    // Straining at a lead: how near it is to breaking free.
    if (e.strain > 0 && (e.leadBy || e.leadTied) && !e.dead) {
      const w = 12;
      const f = Math.min(1, e.strain);
      const big = e.kind !== 'creature' || e.species === 'horse';
      const by = feetY - (big ? (e.hp < e.maxHp ? 33 : 29) : 17);
      ctx.fillStyle = '#2a1e14';
      ctx.fillRect(sx + 2, by, w + 2, 3);
      ctx.fillStyle = f > 0.75 && Math.floor(this.time * 8) % 2 ? '#ff5040' : f > 0.5 ? '#f08a30' : '#e8c060';
      ctx.fillRect(sx + 3, by + 1, Math.max(1, Math.round(w * f)), 1);
    }
    // Health bar when hurt.
    if (e.hp !== undefined && e.hp < e.maxHp && e.kind !== 'player' && !e.sleeping) {
      const w = 12;
      const f = Math.max(0, e.hp / e.maxHp);
      ctx.fillStyle = '#1a1018';
      ctx.fillRect(sx + 2, feetY - 29, w + 2, 3);
      ctx.fillStyle = f > 0.5 ? '#58c048' : f > 0.25 ? '#e8c030' : '#e04040';
      ctx.fillRect(sx + 3, feetY - 28, Math.round(w * f), 1);
    }
    const bubbles = this.bubbles || [];
    // Voices behind closed doors stay there.
    if ((e.bubble && e.bubble.t > 0) || (e.emote && e.emote.t > 0)) {
      if (game && game.speechAudible && !game.speechAudible(e)) return;
    }
    if (e.bubble && e.bubble.t > 0) bubbles.push({ text: e.bubble.text, x: sx + 8, y: feetY - (e.kind === 'creature' ? 20 : 28), color: e.bubble.color });
    if (e.emote && e.emote.t > 0) bubbles.push({ emote: true, text: e.emote.ch, x: sx + 5, y: feetY - 34 + Math.sin(this.time * 5) * 1.5, color: e.emote.color || '#ffe070' });
  }

  // The item sits in the hand: its handle (near the icon's bottom-left)
  // on the hand pixel of the sprite for the way they're facing.
  // What someone holds, at full size (the item's own picture, not the
  // little one dropped items use), its grip in their hand.
  drawHeld(ctx, key, e, sx, top) {
    const icon = itemIcon(key);
    const dir = this.viewDir(e.dir);
    const act = e.actionTimer > 0 ? e.actionTimer / e.actionDur : 0;
    const look = e.look || {};
    const small = look.small;
    const bob = e.moving ? (Math.floor(this.time * 7) % 2 ? -1 : 0) : 0;
    const hy = top + (small ? 6 : 0) + (look.stoop ? 1 : 0) + (e.sitting || e.raft ? 4 : 0) + 8 + (small ? 4 : 6) - 1 + bob;
    const hx = sx + (dir === 0 ? 12 : dir === 1 ? 7 : dir === 3 ? 8 : 3);
    // (The grip is the bottom-left of the picture; held things are drawn at
    // four fifths size, in proportion to the hand holding them.)
    const gx = -3;
    const gy = -13;
    const S = 0.8;
    if (act <= 0 && dir === 2) return; // behind them
    ctx.save();
    ctx.translate(hx, hy);
    if (act > 0) {
      const sign = dir === 1 ? -1 : 1;
      ctx.rotate(sign * (1 - act) * 2.2 - sign * 1.1);
    }
    ctx.scale(dir === 1 ? -S : S, S);
    drawJewelled(ctx, icon, key, gx, gy, this.time, true);
    ctx.restore();
  }

  drawBubble(ctx, text, cx, by, color = '#f4ecd8') {
    const w = textWidth(text) + 4;
    const x = Math.round(cx - w / 2);
    const y = Math.round(by - 10);
    ctx.fillStyle = '#12101a';
    ctx.fillRect(x - 1, y - 1, w + 2, 12);
    ctx.fillStyle = '#f4ecd8';
    ctx.fillRect(x, y, w, 10);
    ctx.fillStyle = '#12101a';
    ctx.fillRect(x + 1, y + 1, w - 2, 8);
    ctx.fillRect(Math.round(cx) - 1, y + 10, 3, 2);
    ctx.fillStyle = '#f4ecd8';
    ctx.fillRect(Math.round(cx), y + 11, 1, 2);
    drawText(ctx, text, x + 2, y + 1, color);
  }

  headFor(e) {
    let h = this.heads.get(e.id);
    if (!h) {
      h = headSprite(e.look);
      this.heads.set(e.id, h);
    }
    return h;
  }

  dropIcon(key) {
    let c = this.dropIcons.get(key);
    if (c) return c;
    const src = itemIcon(key);
    const sctx = src.getContext('2d');
    const d = sctx.getImageData(0, 0, 16, 16).data;
    c = document.createElement('canvas');
    c.width = 8;
    c.height = 8;
    const out = c.getContext('2d');
    const img = out.createImageData(8, 8);
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        // Pick the most saturated opaque pixel of each 2x2 block.
        let best = -1;
        let bi = -1;
        for (const [ox, oy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
          const i = ((y * 2 + oy) * 16 + x * 2 + ox) * 4;
          if (d[i + 3] < 50) continue;
          const lum = d[i] + d[i + 1] + d[i + 2];
          const score = lum < 90 ? 1 : 2 + lum / 1000;
          if (score > best) {
            best = score;
            bi = i;
          }
        }
        if (bi >= 0) {
          const o = (y * 8 + x) * 4;
          img.data[o] = d[bi];
          img.data[o + 1] = d[bi + 1];
          img.data[o + 2] = d[bi + 2];
          img.data[o + 3] = 255;
        }
      }
    }
    out.putImageData(img, 0, 0);
    // Outline for readability.
    const o2 = document.createElement('canvas');
    o2.width = 10;
    o2.height = 10;
    const c2 = o2.getContext('2d');
    c2.filter = 'none';
    for (const [dx, dy] of [[0, 1], [2, 1], [1, 0], [1, 2]]) c2.drawImage(c, dx, dy);
    c2.globalCompositeOperation = 'source-in';
    c2.fillStyle = '#1c1622';
    c2.fillRect(0, 0, 10, 10);
    c2.globalCompositeOperation = 'source-over';
    c2.drawImage(c, 1, 1);
    this.dropIcons.set(key, o2);
    return o2;
  }

  // The rope from a guard's hand to a restrained prisoner.
  // Rod, line and bobber: yours, and every fisher's at work.
  // Fishing rods, lines and bobbers are drawn in depth order with the world:
  // each piece goes into the row it's over, so a wall or a person in front
  // of the line hides it like anything else.
  fishingDecos(game, buckets, zMin, zMax) {
    const ctx = this.ctx;
    const lines = [];
    const f = game.fishing;
    if (f) lines.push({ e: game.player, t: f, dip: f.dip || 0, reel: f.phase === 'reel' ? f.fish - 0.5 : 0 });
    for (const n of game.visibleEntities || []) {
      if (n.kind !== 'npc' || !n.fishSpot) continue;
      const t = n.fishSpot();
      if (t) lines.push({ e: n, t, dip: n.fishDip || 0, reel: 0 });
    }
    const add = (row, layer, order, deco) => {
      if (row < zMin || row > zMax) return;
      let arr = buckets.get(row);
      if (!arr) buckets.set(row, (arr = []));
      arr.push({ deco, layer, rp: { y: order } });
    };
    const tv0 = (x, z) => (this.toView ? this.toView(x, z) : [x, z]);
    for (const L of lines) {
      const wp = L.e.renderPos();
      const [ru, rv] = tv0(wp.x, wp.z);
      const rp = { x: ru, y: wp.y, z: rv };
      const [tu, tv] = tv0(L.t.x, L.t.z);
      const T = { x: tu, y: L.t.y, z: tv };
      const row = Math.ceil(rp.z - 0.001);
      const layer = Math.ceil(rp.y - 0.001) + 1;
      const hx = rp.x * TILE + 8 - this.camX;
      const hy = rp.z * TILE - rp.y * LH + LH + 10 - this.camY - 12;
      const bx = T.x * TILE + 8 - this.camX + Math.round(L.reel * 6);
      const bob = Math.sin(this.time * 3 + L.t.x) * 0.8;
      const by = T.z * TILE - T.y * LH - this.camY + 10 + bob + L.dip * 2;
      const dx = Math.sign(bx - hx) || 1;
      const tx = hx + dx * 7;
      const ty = hy - 9;
      // Rod: just after the one holding it.
      add(row, layer, rp.y + 0.01, () => {
        ctx.fillStyle = '#6a4a2a';
        for (let i = 0; i <= 7; i++) ctx.fillRect(Math.round(hx + dx * i), Math.round(hy - i * 9 / 7), 1, 1);
      });
      // The line sags between rod tip and bobber, a row at a time.
      const n = 14;
      const bLayer = L.t.y + 2;
      const pieces = new Map();
      for (let i = 1; i < n; i++) {
        const k = i / n;
        const r = Math.round(rp.z + (T.z - rp.z) * k);
        const px = Math.round(tx + (bx - tx) * k);
        const py = Math.round(ty + (by - ty) * k + Math.sin(k * Math.PI) * (L.dip > 0.6 ? 1 : 4));
        let pc = pieces.get(r);
        if (!pc) pieces.set(r, (pc = { pts: [], layer: Math.round(layer + (bLayer - layer) * k) }));
        pc.pts.push(px, py);
      }
      for (const [r, pc] of pieces) {
        add(r, pc.layer, 99, () => {
          ctx.fillStyle = 'rgba(232,232,240,0.85)';
          for (let i = 0; i < pc.pts.length; i += 2) ctx.fillRect(pc.pts[i], pc.pts[i + 1], 1, 1);
        });
      }
      // Bobber (half under when something bites), floating on the water.
      add(T.z, bLayer, 99, () => {
        const under = L.dip > 0.6;
        ctx.fillStyle = '#d02a2a';
        ctx.fillRect(Math.round(bx) - 1, Math.round(by) - 2 + (under ? 2 : 0), 3, under ? 1 : 2);
        ctx.fillStyle = '#f0f0f0';
        if (!under) ctx.fillRect(Math.round(bx) - 1, Math.round(by), 3, 1);
        ctx.fillStyle = 'rgba(224,244,255,0.6)';
        ctx.fillRect(Math.round(bx) - 2 - (under ? 1 : 0), Math.round(by) + 1, 5 + (under ? 2 : 0), 1);
      });
    }
  }

  // Leads and ropes (a guard's rope to a prisoner's wrists, a horse tied
  // to a fence): drawn with the world in depth order like a fishing line,
  // a row at a time, so whatever stands in front of them hides them.
  leadDecos(game, buckets, zMin, zMax) {
    const ctx = this.ctx;
    const leads = [];
    const esc = game.sim && game.sim.justice.escort;
    if (esc && esc.guard && !esc.guard.dead) leads.push({ a: esc.guard, b: game.player, ah: 11, bh: 10, wrists: true });
    // (A horse's lead from its head; a smaller beast's from its neck.)
    const neck = (c) => (c.species === 'horse' ? 14 : c.species === 'skeleton' ? 11 : 5);
    for (const c of game.visibleEntities || []) {
      if ((c.kind !== 'creature' && c.kind !== 'monster') || c.dead) continue;
      if (c.tie && c.tieR !== 0) leads.push({ a: c, b: c.tie, ah: neck(c), bh: 13, head: c.species === 'horse' });
      else if (c.leadBy && !c.leadBy.dead) leads.push({ a: c, b: c.leadBy, ah: neck(c), bh: 9, head: c.species === 'horse' });
    }
    const add = (row, layer, order, deco) => {
      if (row < zMin || row > zMax) return;
      let arr = buckets.get(row);
      if (!arr) buckets.set(row, (arr = []));
      arr.push({ deco, layer, rp: { y: order } });
    };
    const end = (q, h, head) => {
      const rp = q.renderPos ? q.renderPos() : q;
      const [u, v] = this.toView(rp.x, rp.z);
      let x = u * TILE + 8 - this.camX;
      // (A horse's lead runs from its head.)
      if (head) x += q.sideLeft === false ? 12 : -12;
      return { x, y: v * TILE - rp.y * LH + LH + 10 - this.camY - h, row: Math.ceil(v - 0.001), layer: Math.ceil(rp.y - 0.001) + 1 };
    };
    for (const L of leads) {
      const A = end(L.a, L.ah, L.head);
      const B = end(L.b, L.bh, false);
      const n = 14;
      const sag = 4 + Math.sin(this.time * 3) * 0.8;
      const pieces = new Map();
      for (let i = 0; i <= n; i++) {
        const k = i / n;
        const r = Math.round(A.row + (B.row - A.row) * k);
        const px = Math.round(A.x + (B.x - A.x) * k);
        const py = Math.round(A.y + (B.y - A.y) * k + Math.sin(k * Math.PI) * sag);
        let pc = pieces.get(r);
        if (!pc) pieces.set(r, (pc = { pts: [], layer: Math.round(A.layer + (B.layer - A.layer) * k) }));
        pc.pts.push(px, py);
      }
      for (const [r, pc] of pieces) {
        add(r, pc.layer, 99, () => {
          for (let i = 0; i < pc.pts.length; i += 2) {
            ctx.fillStyle = '#3a2a18';
            ctx.fillRect(pc.pts[i], pc.pts[i + 1] + 1, 1, 1);
            ctx.fillStyle = '#c8a064';
            ctx.fillRect(pc.pts[i], pc.pts[i + 1], 1, 1);
            if (i >= 2 && Math.abs(pc.pts[i] - pc.pts[i - 2]) > 1) ctx.fillRect(Math.round((pc.pts[i] + pc.pts[i - 2]) / 2), Math.round((pc.pts[i + 1] + pc.pts[i - 1]) / 2), 1, 1);
          }
        });
      }
      if (L.wrists) {
        add(B.row, B.layer, 99.5, () => {
          ctx.fillStyle = '#c8a064';
          ctx.fillRect(Math.round(B.x) - 2, Math.round(B.y) - 1, 5, 2);
        });
      }
    }
  }

  // Arrows in flight.
  drawProjectiles(game) {
    const ctx = this.ctx;
    for (const a of game.projectiles || []) {
      const f = Math.min(1, a.t / a.dur);
      const [wx, wz] = this.toView(a.x0 + (a.tx - a.x0) * f, a.z0 + (a.tz - a.z0) * f);
      const wy = a.y0 + (a.ty - a.y0) * f + Math.sin(f * Math.PI) * 0.4;
      const sx = Math.round(wx * TILE + 8 - this.camX);
      const sy = Math.round(wz * TILE - wy * LH + LH - this.camY);
      const [dx, dz] = this.toView(a.tx - a.x0, a.tz - a.z0);
      const l = Math.hypot(dx, dz) || 1;
      const ux = dx / l;
      const uy = dz / l;
      ctx.fillStyle = '#8a6038';
      for (let i = 0; i < 5; i++) ctx.fillRect(Math.round(sx - ux * i), Math.round(sy - uy * i * 0.75), 1, 1);
      ctx.fillStyle = '#e0e0e8';
      ctx.fillRect(Math.round(sx + ux), Math.round(sy + uy * 0.75), 1, 1);
      ctx.fillStyle = '#f0f0f0';
      ctx.fillRect(Math.round(sx - ux * 5), Math.round(sy - uy * 3.75), 1, 1);
    }
  }

  // ------------------------------------------------------------------ weather
  // part: 'tint' (the fog, the grey of an overcast day), 'drops' (rain or
  // snow falling) or 'all'. Normally it all goes under the light, so the night
  // darkens it; over a camera turn the drops are drawn on top of the lit
  // pictures, so they're shaded by the sky by hand.
  drawWeather(game, dt, part = 'all') {
    const w = game.weather;
    if (!w || w.level <= 0.01) return;
    const ctx = this.ctx;
    const indoor = this.hidden !== null;
    if (!this.weatherDrops) this.weatherDrops = Array.from({ length: 220 }, () => ({ x: Math.random() * VIEW_W, y: Math.random() * VIEW_H, s: 0.6 + Math.random() * 0.8 }));
    const n = Math.floor(this.weatherDrops.length * w.level * (indoor ? 0.25 : 1));
    const rain = w.kind === 'rain';
    if (part !== 'drops') {
      ctx.fillStyle = w.kind === 'fog' ? `rgba(190,200,210,${0.28 * w.level})` : rain ? `rgba(40,50,70,${0.18 * w.level})` : `rgba(200,210,230,${0.1 * w.level})`;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }
    if (part === 'tint' || w.kind === 'fog') return;
    const lit = part === 'drops' ? skyLight(game.minute) : [1, 1, 1];
    const tone = (r, g, b, a) => `rgba(${Math.round(r * Math.max(0.25, lit[0]))},${Math.round(g * Math.max(0.25, lit[1]))},${Math.round(b * Math.max(0.3, lit[2]))},${a})`;
    ctx.fillStyle = rain ? tone(170, 190, 230, 0.55) : tone(245, 248, 255, 0.9);
    for (let i = 0; i < n; i++) {
      const d = this.weatherDrops[i];
      if (rain) {
        d.y += dt * 260 * d.s;
        d.x -= dt * 60 * d.s;
        ctx.fillRect(Math.round(d.x), Math.round(d.y), 1, 4);
        if (d.y > VIEW_H * (0.3 + d.s * 0.5) && Math.random() < 0.08) {
          ctx.fillRect(Math.round(d.x) - 1, Math.round(d.y) + 4, 3, 1);
          d.y = -4;
        }
      } else {
        d.y += dt * 30 * d.s;
        d.x += Math.sin(this.time * 1.5 + i) * dt * 12;
        ctx.fillRect(Math.round(d.x), Math.round(d.y), d.s > 1.1 ? 2 : 1, d.s > 1.1 ? 2 : 1);
      }
      if (d.y > VIEW_H) {
        d.y = -4;
        d.x = Math.random() * VIEW_W;
      }
      if (d.x < -4) d.x += VIEW_W + 4;
      if (d.x > VIEW_W + 4) d.x -= VIEW_W + 4;
    }
  }

  // ------------------------------------------------------------------ fx
  // Under a roof you can see (not one cut away because you're inside):
  // anything going on in there is out of sight.
  roofed(wx, y, wz) {
    const world = this.game && this.game.world;
    if (!world) return false;
    const x = Math.round(wx);
    const z = Math.round(wz);
    const y0 = Math.floor(y) + 1;
    for (let yy = y0; yy < Math.min(WORLD_Y, y0 + 14); yy++) {
      const id = world.getBlock(x, yy, z);
      if (id === B.air || BLOCKS[id].render !== 'cube' || BLOCKS[id].name.startsWith('leaves')) continue;
      return !this.isHidden(x, yy, z);
    }
    return false;
  }

  emit(wx, y, wz, opts) {
    // (Smoke, sparks and crumbs indoors stay indoors.)
    if (this.roofed(wx, y, wz)) return;
    const [x, z] = this.toView(wx, wz);
    const n = opts.n || 6;
    for (let i = 0; i < n; i++) {
      this.particles.push({
        x: x * TILE + (opts.spreadX ?? 8) * (Math.random() - 0.5) * 2 + 8,
        y: z * TILE - y * LH + LH + (opts.oy ?? 0) + (Math.random() - 0.5) * (opts.spreadY ?? 6),
        vx: opts.vx !== undefined ? opts.vx * (0.9 + Math.random() * 0.2) : (Math.random() - 0.5) * (opts.speed ?? 40),
        vy: opts.vy !== undefined ? opts.vy * (0.9 + Math.random() * 0.2) : -(opts.up ?? 30) * (0.5 + Math.random()),
        g: opts.gravity ?? 90,
        life: (opts.life ?? 0.6) * (0.6 + Math.random() * 0.6),
        max: opts.life ?? 0.6,
        color: Array.isArray(opts.color) ? opts.color[Math.floor(Math.random() * opts.color.length)] : opts.color,
        size: opts.size ?? 1,
        glow: !!opts.glow,
        shape: opts.shape,
        grow: opts.grow || 0,
        // A crumb of an item's own picture (food being eaten, and so on).
        chunk: opts.chunk ? this.chunkOf(opts.chunk) : null,
      });
    }
    if (this.particles.length > 900) this.particles.splice(0, this.particles.length - 900);
  }

  // A crumb's worth of an item's picture: a few pixels from somewhere solid
  // in it (for food being eaten, wood chips off a log...).
  chunkOf(key) {
    const img = itemIcon(key);
    this.opaque ||= new Map();
    let pts = this.opaque.get(key);
    if (!pts) {
      pts = [];
      const d = img.getContext('2d').getImageData(0, 0, 16, 16).data;
      for (let y = 0; y < 15; y++) for (let x = 0; x < 15; x++) if (d[(y * 16 + x) * 4 + 3] > 200 && d[((y + 1) * 16 + x + 1) * 4 + 3] > 200) pts.push([x, y]);
      this.opaque.set(key, pts);
    }
    if (!pts.length) return null;
    const [x, y] = pts[Math.floor(Math.random() * pts.length)];
    return { img, x, y, w: Math.random() < 0.4 ? 1 : 2 };
  }

  // Something thrown that lands and lies a moment (dice on a table).
  toss(o) {
    if (this.roofed(o.from.x, o.from.y, o.from.z) && this.roofed(o.to.x, o.to.y, o.to.z)) return;
    const [x0, z0] = this.toView(o.from.x, o.from.z);
    const [x1, z1] = this.toView(o.to.x, o.to.z);
    (this.tosses ||= []).push({
      ax: x0 * TILE + 8, ay: z0 * TILE - o.from.y * LH + LH + (o.from.oy ?? -10),
      bx: x1 * TILE + 8 + (o.dx || 0), by: z1 * TILE - o.to.y * LH + LH + (o.to.oy ?? 2),
      t: 0, dur: o.dur || 0.55, rest: o.rest ?? 3, kind: o.kind || 'dice', face: o.face || 1, spin: Math.random() * 6, item: o.item || null, h: o.h ?? 14,
    });
    if (this.tosses.length > 40) this.tosses.shift();
  }

  // Dice thrown onto a table: real little cubes (see dice.js).
  rollDice(o) {
    this.dice = (this.dice || []).concat(throwDice(o.from, o.to, o.faces || [o.face || 1]));
    if (this.dice.length > 24) this.dice.splice(0, this.dice.length - 24);
  }

  // Each die goes into the row it's over and is drawn there, in depth order
  // with the world (like someone standing there).
  diceDecos(buckets, zMin, zMax) {
    const list = this.dice;
    if (!list || !list.length) return;
    stepDice(list, this.frameDt || 0.016);
    this.dice = list.filter((d) => d.fade > 0);
    const ctx = this.ctx;
    const tv = (x, z) => this.toView(x, z);
    for (const d of this.dice) {
      const [u, v] = this.toView(d.x, d.z);
      const row = Math.ceil(v - 0.001);
      if (row < zMin || row > zMax) continue;
      let arr = buckets.get(row);
      if (!arr) buckets.set(row, (arr = []));
      arr.push({ deco: () => drawDie(ctx, d, u, v, this.camX, this.camY, tv), layer: Math.ceil(d.base - 0.001) + 1, rp: { y: d.base } });
    }
  }

  drawTosses(dt) {
    const ctx = this.ctx;
    const list = this.tosses || [];
    const PIPS = { 1: [[1, 1]], 2: [[0, 0], [2, 2]], 3: [[0, 0], [1, 1], [2, 2]], 4: [[0, 0], [2, 0], [0, 2], [2, 2]], 5: [[0, 0], [2, 0], [1, 1], [0, 2], [2, 2]], 6: [[0, 0], [0, 1], [0, 2], [2, 0], [2, 1], [2, 2]] };
    for (let i = list.length - 1; i >= 0; i--) {
      const d = list[i];
      d.t += dt;
      if (d.t > d.dur + d.rest) {
        list.splice(i, 1);
        continue;
      }
      const k = Math.min(1, d.t / d.dur);
      // An arc, and a bounce at the end.
      const bounce = k < 1 ? Math.sin(k * Math.PI) * d.h : Math.max(0, Math.sin((d.t - d.dur) * 18) * 2 * Math.exp(-(d.t - d.dur) * 8));
      const x = Math.round(d.ax + (d.bx - d.ax) * k - this.camX);
      const y = Math.round(d.ay + (d.by - d.ay) * k - bounce - this.camY);
      const fade = d.t > d.dur + d.rest - 0.4 ? (d.dur + d.rest - d.t) / 0.4 : 1;
      ctx.globalAlpha = Math.max(0, fade);
      if (d.kind === 'coin') {
        // A coin flipped across: gold, catching the light as it turns.
        const edge = Math.floor(d.t * 16) % 2;
        ctx.fillStyle = '#a07818';
        ctx.fillRect(x - 1, y, edge ? 1 : 3, 2);
        ctx.fillStyle = '#ffe070';
        ctx.fillRect(x - 1, y - 1, edge ? 1 : 3, 2);
        if (!edge) {
          ctx.fillStyle = '#fff8d0';
          ctx.fillRect(x, y - 1, 1, 1);
        }
        continue;
      }
      if (d.kind === 'item' && d.item) {
        ctx.drawImage(this.dropIcon(d.item), x - 4, y - 6);
        continue;
      }
      // Tumbling: a face at random each frame until it lands.
      const face = k < 1 ? 1 + (Math.floor(d.t * 20 + d.spin) % 6) : d.face;
      ctx.fillStyle = '#2a1e14';
      ctx.fillRect(x - 1, y - 1, 5, 5);
      ctx.fillStyle = '#f4ecd8';
      ctx.fillRect(x - 1, y - 1, 4, 4);
      ctx.fillStyle = '#b02a2a';
      for (const [px, py] of PIPS[face]) ctx.fillRect(x - 1 + Math.min(3, px * 1.5) | 0, y - 1 + Math.min(3, py * 1.5) | 0, 1, 1);
    }
    ctx.globalAlpha = 1;
  }

  // A gem's work, a burst of fire, a bolt of lightning (see fx.js).
  effect(o) {
    return addEffect(this, o);
  }

  floatText(wx, y, wz, text, color = '#ff6060') {
    if (this.noDamageNumbers && /^[-!]\d/.test(text)) return;
    const [x, z] = this.toView(wx, wz);
    this.floaters.push({ x: x * TILE + 8, y: z * TILE - y * LH - 4, text, color, t: 0.9 });
  }

  drawParticles(dt) {
    const ctx = this.ctx;
    const ps = this.particles;
    for (let i = ps.length - 1; i >= 0; i--) {
      const p = ps[i];
      p.life -= dt;
      if (p.life <= 0) {
        ps[i] = ps[ps.length - 1];
        ps.pop();
        continue;
      }
      p.vy += p.g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const sx = Math.round(p.x - this.camX);
      const sy = Math.round(p.y - this.camY);
      if (sx < -4 || sy < -4 || sx > VIEW_W || sy > VIEW_H) continue;
      ctx.globalAlpha = Math.min(1, p.life / (p.max * 0.5));
      ctx.fillStyle = p.color;
      if (p.chunk) {
        const c = p.chunk;
        ctx.drawImage(c.img, c.x, c.y, c.w, c.w, sx, sy, c.w, c.w);
      } else if (p.shape === 'note') {
        // ♪ in three pixels' width.
        ctx.fillRect(sx + 2, sy - 4, 1, 5);
        ctx.fillRect(sx, sy, 2, 2);
        ctx.fillRect(sx + 3, sy - 4, 1, 1);
        ctx.fillRect(sx + 4, sy - 3, 1, 1);
      } else if (p.shape === 'puff') {
        // A soft round puff that spreads as it rises and fades.
        const r = Math.max(1, Math.round(p.size + p.grow * (1 - p.life / p.max)));
        ctx.globalAlpha *= 0.55;
        ctx.fillRect(sx - r + 1, sy - r, r * 2 - 1, r * 2 + 1);
        ctx.fillRect(sx - r, sy - r + 1, r * 2 + 1, r * 2 - 1);
      } else if (p.shape === 'drop') {
        ctx.fillRect(sx, sy, 1, 2);
      } else if (p.shape === 'plus') {
        ctx.fillRect(sx, sy - 1, 1, 3);
        ctx.fillRect(sx - 1, sy, 3, 1);
      } else if (p.shape === 'star') {
        ctx.fillRect(sx, sy, 1, 1);
        ctx.globalAlpha *= 0.6;
        ctx.fillRect(sx - 1, sy, 1, 1);
        ctx.fillRect(sx + 1, sy, 1, 1);
        ctx.fillRect(sx, sy - 1, 1, 1);
        ctx.fillRect(sx, sy + 1, 1, 1);
      } else ctx.fillRect(sx, sy, p.size, p.size);
    }
    ctx.globalAlpha = 1;
    this.drawTosses(dt);
    for (let i = this.floaters.length - 1; i >= 0; i--) {
      const f = this.floaters[i];
      f.t -= dt;
      f.y -= dt * 18;
      if (f.t <= 0) {
        this.floaters.splice(i, 1);
        continue;
      }
      ctx.globalAlpha = Math.min(1, f.t * 2);
      drawText(ctx, f.text, Math.round(f.x - this.camX - textWidth(f.text) / 2), Math.round(f.y - this.camY), f.color, '#000');
    }
    ctx.globalAlpha = 1;
  }

  // Cursor highlight, placement ghost and mining cracks.
  drawOverlays(game) {
    const ctx = this.ctx;
    const c = game.cursor;
    if (!c) return;
    const { x: sx, y: sy } = this.worldToScreen(c.x, c.y, c.z);
    const pulse = 0.55 + Math.sin(this.time * 6) * 0.25;
    // Placement ghost.
    if (c.place) {
      const p = c.place;
      const { x: gx, y: gy } = this.worldToScreen(p.x, p.y, p.z);
      const b = BLOCKS[p.id];
      ctx.globalAlpha = 0.5;
      if (b.render === 'cube' || b.render === 'door') {
        const t = TEX.top[p.id * 4 + (b.rotatable ? p.rot : 0)][0];
        const f = TEX.front[p.id * 4 + (b.rotatable ? p.rot : 0)][0];
        ctx.drawImage(this.atlas, t.x, t.y, 16, 16, gx, gy, 16, 16);
        ctx.drawImage(this.atlas, f.x, f.y, 16, LH, gx, gy + 16, 16, LH);
      } else {
        const arr = TEX.sprite[p.id * 4 + (b.rotatable ? p.rot : 0)] || TEX.sprite[p.id * 4];
        if (arr) {
          const s = arr[0];
          ctx.drawImage(this.atlas, s.x, s.y, s.w, s.h, gx, gy + SPR_H - s.h, s.w, s.h);
        }
      }
      ctx.globalAlpha = 1;
      this.cubeOutline(gx, gy, p.ok ? `rgba(120,255,160,${pulse})` : `rgba(255,90,90,${pulse})`);
      if (b.rotatable) {
        const arrow = ['↓', '←', '↑', '→'][p.rot];
        drawText(ctx, arrow, gx + 5, gy - 9, '#a0ffc0', '#000');
      }
    }
    if (c.block) {
      if (game.mining && game.mining.progress > 0) {
        const stage = Math.min(3, Math.floor(game.mining.progress * 4));
        const s = TEX.crack[stage];
        ctx.drawImage(this.atlas, s.x, s.y, s.w, s.h, sx, sy, s.w, s.h);
      }
      this.cubeOutline(sx, sy, c.inReach ? `rgba(255,240,160,${pulse})` : `rgba(160,160,160,${pulse * 0.6})`);
    } else if (c.empty) {
      this.cubeOutline(sx, sy, `rgba(160,200,255,${pulse * 0.6})`);
    }
  }

  cubeOutline(sx, sy, color) {
    const ctx = this.ctx;
    ctx.fillStyle = color;
    ctx.fillRect(sx, sy, 16, 1);
    ctx.fillRect(sx, sy + 16, 16, 1);
    ctx.fillRect(sx, sy + 16 + LH - 1, 16, 1);
    ctx.fillRect(sx, sy, 1, 16 + LH);
    ctx.fillRect(sx + 15, sy, 1, 16 + LH);
  }

  // Ambient light level [0..1] for a time of day.
  static daylight(minute) {
    const m = ((minute % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES;
    const h = m / 60;
    if (h >= 7 && h <= 18) return 1;
    if (h > 18 && h < 21) return 1 - (h - 18) / 3 * 0.78;
    if (h >= 5 && h < 7) return 0.22 + (h - 5) / 2 * 0.78;
    return 0.22;
  }
}

export { GROUND };
