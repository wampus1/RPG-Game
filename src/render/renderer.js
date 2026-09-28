// World renderer: draws the voxel grid in an oblique 3/4 projection using
// the painter's algorithm (rows north->south, layers bottom->top), with
// entities interleaved, roof cut-aways, occlusion fading and lighting.
import { TILE, LH, VIEW_W, VIEW_H, WORLD_Y, REGION_W, GROUND, DAY_MINUTES } from '../config.js';
import { BLOCKS, B, META_ROT, META_STATE, CROPS, cropStage } from '../world/blocks.js';
import { TEX, SPR_H, VARIANTS, WATER_FRAMES, buildTextures } from './textures.js';
import { humanoidSheet, creatureSheet, itemIcon, CHAR_W, CHAR_H, headSprite } from './sprites.js';
import { drawText, textWidth } from './font.js';
import { hash4 } from '../util/rng.js';
import { Lighting } from './lighting.js';

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
    this.floaters = [];
    this.lighting = new Lighting();
    this.dropIcons = new Map();
    this.heads = new Map();
    for (const b of BLOCKS) if (b.name.startsWith('leaves') || b.name === 'glass' || b.name === 'water' || b.name === 'ice') CULL_SAME.add(b.id);
    this.hidden = null;
    this.hiddenLevel = 99;
  }

  worldToScreen(fx, fy, fz) {
    return { x: fx * TILE - this.camX, y: fz * TILE - fy * LH - this.camY };
  }

  // Screen pixel -> world (x,z) at a given layer y (top-face plane of that layer).
  screenToTile(sx, sy, y) {
    const wx = sx + this.camX;
    const wy = sy + this.camY + y * LH;
    return { x: Math.floor(wx / TILE), z: Math.floor(wy / TILE) };
  }

  // ------------------------------------------------------------------ frame
  render(game, dt) {
    this.time += dt;
    const ctx = this.ctx;
    const world = game.world;
    const player = game.player;
    const rp = player.renderPos();
    // Camera follows the player's feet (smoothed, pixel snapped).
    const tx = rp.x * TILE + 8 - VIEW_W / 2;
    const ty = rp.z * TILE - rp.y * LH + LH + 8 - VIEW_H / 2 - 10;
    if (!this.camInit) {
      this.cx = tx;
      this.cy = ty;
      this.camInit = true;
    }
    const k = 1 - Math.pow(0.0005, dt);
    this.cx += (tx - this.cx) * k;
    this.cy += (ty - this.cy) * k;
    if (game.shake > 0) {
      this.cx += (Math.random() - 0.5) * game.shake * 3;
      this.cy += (Math.random() - 0.5) * game.shake * 3;
    }
    this.camX = Math.round(this.cx);
    this.camY = Math.round(this.cy);

    ctx.fillStyle = '#0a0a12';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    this.computeCutaway(world, player);
    this.bubbles = [];
    this.drawWorld(game);
    this.drawProjectiles(game);
    this.drawRope(game);
    this.drawWeather(game, dt);
    this.lighting.draw(this, game);
    this.drawParticles(dt);
    // Speech bubbles and emotes go on top of everything, roofs included.
    for (const b of this.bubbles) {
      if (b.emote) drawText(ctx, b.text, b.x, b.y, b.color, '#000');
      else this.drawBubble(ctx, b.text, b.x, b.y, b.color);
    }
    this.drawOverlays(game);
  }

  // ------------------------------------------------------------------ cutaway
  computeCutaway(world, player) {
    const px = player.x;
    const pz = player.z;
    const py = player.y;
    // Indoors if something solid is overhead within a few layers.
    const covered = (x, z) => {
      for (let y = py + 2; y < Math.min(WORLD_Y, py + 7); y++) {
        const id = world.getBlock(x, y, z);
        if (id !== B.air && BLOCKS[id].render === 'cube' && !BLOCKS[id].name.startsWith('leaves')) return true;
      }
      return false;
    };
    this.hidden = null;
    if (!covered(px, pz)) return;
    // Flood-fill the covered area (the roof footprint).
    const set = new Set();
    const q = [[px, pz]];
    set.add(px * 65536 + pz);
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
    // Column cache: region + base index for every visible column.
    const colR = new Array(W * nRows);
    const colB = new Int32Array(W * nRows);
    const colTop = new Int8Array(W * nRows);
    for (let r = 0; r < nRows; r++) {
      const z = zMin + r;
      for (let i = 0; i < W; i++) {
        const x = x0 + i;
        const reg = world.regionAt(x, z);
        const ci = r * W + i;
        colR[ci] = reg;
        if (reg) {
          const lx = x - reg.x0;
          const lz = z - reg.z0;
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
      const rp = e.renderPos();
      const row = Math.ceil(rp.z - 0.001);
      if (row < zMin || row > zMax) continue;
      let arr = buckets.get(row);
      if (!arr) buckets.set(row, (arr = []));
      arr.push({ e, rp, layer: Math.ceil(rp.y - 0.001) + 1 });
    }

    const player = game.player;
    const prp = player.renderPos();
    const psx = prp.x * TILE - camX;
    const psy = prp.z * TILE - prp.y * LH + LH - camY;
    const pRect = { x0: psx - 6, x1: psx + 22, y0: psy - 20, y1: psy + 20 };
    const pz = player.z;
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
            if (hid(x, y, z)) continue;
            const b = BLOCKS[id];
            const sx = x * TILE - camX;
            let alpha = 1;
            if (fadeLayer && sx + TILE > pRect.x0 && sx < pRect.x1 && sy + SPR_H > pRect.y0 && sy < pRect.y1) alpha = this.fadeFor(sx, sy, psx, psy);
            if (alpha < 1) ctx.globalAlpha = alpha;
            const v = hash4(x, y, z) % VARIANTS;
            const render = b.render;
            if (render === 'cube' || render === 'liquid' || (render === 'door' && !(metaAt(ci, y) & META_STATE))) {
              const rot = b.rotatable ? metaAt(ci, y) & META_ROT : 0;
              // Top face.
              const above = getAt(ci, y + 1);
              const ab = BLOCKS[above];
              const aboveHidden = hid(x, y + 1, z);
              const showTop = aboveHidden || !(ab.opaque && ab.render === 'cube') && !(CULL_SAME.has(id) && above === id) && !(render === 'liquid' && ab.liquid);
              const liquid = render === 'liquid';
              if (showTop) {
                const tops = TEX.top[id * 4 + rot];
                const s = liquid ? tops[waterFrame] : tops[v % tops.length];
                const oy = liquid ? 3 : 0;
                ctx.drawImage(atlas, s.x, s.y, 16, 16, sx, sy + oy, 16, 16);
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
              const frontHidden = hid(x, y, z + 1);
              const showFront = frontHidden || !(fb.opaque && fb.render === 'cube') && !(CULL_SAME.has(id) && fr === id) && !(liquid && fb.liquid);
              if (showFront && !(liquid && fb.solid)) {
                const fronts = TEX.front[id * 4 + rot];
                const s = liquid ? fronts[waterFrame] : fronts[v % fronts.length];
                ctx.drawImage(atlas, s.x, s.y, 16, LH, sx, sy + 16 + (liquid ? 3 : 0), 16, liquid ? LH - 3 : LH);
              }
            } else if (render === 'door') {
              const rot = metaAt(ci, y) & META_ROT;
              const s = TEX.sprite[id * 4 + rot][0];
              ctx.drawImage(atlas, s.x, s.y, s.w, s.h, sx, sy, s.w, s.h);
            } else if (render === 'sprite' || render === 'plant') {
              const meta = metaAt(ci, y);
              const rot = b.rotatable ? meta & META_ROT : 0;
              const arr = TEX.sprite[id * 4 + rot];
              const st = meta & META_STATE ? 1 : 0;
              let idx;
              if (render === 'plant') idx = CROPS[id] ? cropStage(meta) : v;
              else if (id === B.rock || id === B.bed) idx = st * 4 + (id === B.bed ? hash4(x, z, 5) % 4 : v);
              else idx = st * 4 + (animFrame + x + z) % 4;
              const s = arr[idx] || arr[0];
              // Plants sway gently.
              ctx.drawImage(atlas, s.x, s.y, s.w, s.h, sx, sy + SPR_H - s.h, s.w, s.h);
              // Hanging signs show what the building is.
              if (id === B.hanging_sign) {
                const ic = game.signIcons && game.signIcons.get(`${x},${y},${z}`);
                if (ic) ctx.drawImage(this.dropIcon(ic), sx + 3, sy + SPR_H - s.h + 4);
              }
            } else if (render === 'flat') {
              const arr = TEX.sprite[id * 4];
              const s = arr[v % arr.length];
              const below = getAt(ci, y - 1);
              const oy = BLOCKS[below].liquid ? 3 : 0;
              ctx.drawImage(atlas, s.x, s.y, 16, 16, sx, sy + LH + oy, 16, 16);
            } else if (render === 'fence') {
              this.drawFence(ctx, world, x, y, z, sx, sy);
            }
            if (alpha < 1) ctx.globalAlpha = 1;
            if (game.cursor && game.cursor.x === x && game.cursor.y === y && game.cursor.z === z) {
              this.cursorDrawList = { sx, sy, b };
            }
          }
        }
        // Entities standing in this row whose body occupies up to this layer.
        if (ents) {
          while (ei < ents.length && ents[ei].layer <= y) {
            this.drawEntity(ctx, ents[ei].e, ents[ei].rp, game);
            ei++;
          }
        }
      }
      if (ents) while (ei < ents.length) this.drawEntity(ctx, ents[ei].e, ents[ei++].rp, game);
    }
  }

  fadeFor(sx, sy, psx, psy) {
    const d = Math.hypot((sx - psx) / 16, (sy + 14 - psy) / 16);
    return Math.min(1, 0.3 + Math.max(0, d - 0.9) * 0.5);
  }

  // Alpha a block is drawn with because it hides the player (1 = opaque).
  occlusionAlpha(x, y, z, player) {
    const rp = player.renderPos();
    if (!(z >= player.z && z <= player.z + 7 && y >= player.y && (z > player.z || y > player.y + 1))) return 1;
    const psx = rp.x * TILE - this.camX;
    const psy = rp.z * TILE - rp.y * LH + LH - this.camY;
    const sx = x * TILE - this.camX;
    const sy = z * TILE - y * LH - this.camY;
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

  drawFence(ctx, world, x, y, z, sx, sy) {
    const f = TEX.misc.fence;
    const atlas = this.atlas;
    const conn = (dx, dz) => {
      const b = BLOCKS[world.getBlock(x + dx, y, z + dz)];
      return b.render === 'fence' || (b.opaque && b.render === 'cube') || b.render === 'door';
    };
    const d = (s) => ctx.drawImage(atlas, s.x, s.y, s.w, s.h, sx, sy, s.w, s.h);
    if (conn(0, -1)) d(f.north);
    if (conn(-1, 0)) d(f.west);
    d(f.post);
    if (conn(1, 0)) d(f.east);
    if (conn(0, 1)) d(f.south);
  }

  // ------------------------------------------------------------------ entities
  drawEntity(ctx, e, rp, game) {
    const sx = Math.round(rp.x * TILE - this.camX);
    const floorY = Math.round(rp.z * TILE - rp.y * LH + LH - this.camY); // top of floor face
    const feetY = floorY + 10 - (e.hop || 0);
    if (sx < -32 || sx > VIEW_W + 32 || feetY < -40 || feetY > VIEW_H + 40) return;
    const sh = TEX.misc.shadow;
    const inWater = e.inWater;
    if (e.kind === 'item') {
      const bob = Math.sin(this.time * 4 + e.id) * 1.5;
      ctx.globalAlpha = 0.7;
      ctx.drawImage(this.atlas, sh.x, sh.y, 16, 8, sx + 2, feetY - 3, 12, 5);
      ctx.globalAlpha = 1;
      const icon = this.dropIcon(e.item);
      const air = e.air || 0;
      ctx.drawImage(icon, sx + 4, Math.round(feetY - 9 + bob - air * LH));
      return;
    }
    if (!e.sleeping && !inWater) ctx.drawImage(this.atlas, sh.x, sh.y, 16, 8, sx, feetY - 4, 16, 8);
    if (e.flash > 0) ctx.filter = 'brightness(3)';
    if (e.kind === 'creature') {
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
        if (Math.floor(this.time * 1.5 + e.id) % 3 === 0) drawText(ctx, 'z', sx + 12, floorY - 8 - (this.time * 4 % 4), '#c8d8ff');
      } else {
        const sheet = humanoidSheet(e.look);
        const frame = e.actionTimer > 0 ? 3 : e.moving ? 1 + (Math.floor(this.time * 7) % 2) : e.sitting ? 4 : 0;
        const dir = e.dir;
        const top = feetY - CHAR_H + 1;
        if (inWater) {
          ctx.drawImage(sheet, frame * CHAR_W, dir * CHAR_H, CHAR_W, CHAR_H - 6, sx, top + 3, CHAR_W, CHAR_H - 6);
          ctx.fillStyle = 'rgba(80,150,220,0.55)';
          ctx.fillRect(sx + 2, top + CHAR_H - 5, 12, 2);
        } else ctx.drawImage(sheet, frame * CHAR_W, dir * CHAR_H, CHAR_W, CHAR_H, sx, top, CHAR_W, CHAR_H);
        const held = e.heldItem ? e.heldItem() : null;
        if (held) this.drawHeld(ctx, held, e, sx, top);
      }
    }
    if (e.flash > 0) ctx.filter = 'none';
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
    if (e.bubble && e.bubble.t > 0) bubbles.push({ text: e.bubble.text, x: sx + 8, y: feetY - (e.kind === 'creature' ? 20 : 28), color: e.bubble.color });
    if (e.emote && e.emote.t > 0) bubbles.push({ emote: true, text: e.emote.ch, x: sx + 5, y: feetY - 34 + Math.sin(this.time * 5) * 1.5, color: e.emote.color || '#ffe070' });
  }

  drawHeld(ctx, key, e, sx, top) {
    const icon = this.dropIcon(key);
    const dir = e.dir;
    const act = e.actionTimer > 0 ? e.actionTimer / e.actionDur : 0;
    let hx;
    let hy;
    if (dir === 0) {
      hx = sx + 10;
      hy = top + 12;
    } else if (dir === 2) {
      hx = sx - 2;
      hy = top + 11;
    } else if (dir === 1) {
      hx = sx - 1;
      hy = top + 11;
    } else {
      hx = sx + 9;
      hy = top + 11;
    }
    if (act > 0) {
      ctx.save();
      ctx.translate(hx + 4, hy + 6);
      const sign = dir === 1 ? -1 : 1;
      ctx.rotate(sign * (1 - act) * 2.2 - sign * 1.1);
      ctx.drawImage(icon, -4, -8);
      ctx.restore();
    } else if (dir !== 2) ctx.drawImage(icon, hx, hy);
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
  drawRope(game) {
    const e = game.sim && game.sim.justice.escort;
    if (!e || !e.guard) return;
    const ctx = this.ctx;
    const at = (ent, dy) => {
      const rp = ent.renderPos();
      return { x: rp.x * TILE + 8 - this.camX, y: rp.z * TILE - rp.y * LH + LH + 10 - this.camY - dy };
    };
    const a = at(e.guard, 11);
    const b = at(game.player, 10);
    const n = 12;
    const sag = 4 + Math.sin(this.time * 3) * 0.8;
    let px = a.x;
    let py = a.y;
    for (let i = 1; i <= n; i++) {
      const t = i / n;
      const x = a.x + (b.x - a.x) * t;
      const y = a.y + (b.y - a.y) * t + Math.sin(t * Math.PI) * sag;
      ctx.fillStyle = '#3a2a18';
      ctx.fillRect(Math.round(x), Math.round(y) + 1, 1, 1);
      ctx.fillStyle = '#c8a064';
      ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
      if (Math.abs(x - px) > 1) ctx.fillRect(Math.round((x + px) / 2), Math.round((y + py) / 2), 1, 1);
      px = x;
      py = y;
    }
    // Bound wrists.
    ctx.fillStyle = '#c8a064';
    ctx.fillRect(Math.round(b.x) - 2, Math.round(b.y) - 1, 5, 2);
  }

  // Arrows in flight.
  drawProjectiles(game) {
    const ctx = this.ctx;
    for (const a of game.projectiles || []) {
      const f = Math.min(1, a.t / a.dur);
      const wx = a.x0 + (a.tx - a.x0) * f;
      const wz = a.z0 + (a.tz - a.z0) * f;
      const wy = a.y0 + (a.ty - a.y0) * f + Math.sin(f * Math.PI) * 0.4;
      const sx = Math.round(wx * TILE + 8 - this.camX);
      const sy = Math.round(wz * TILE - wy * LH + LH - this.camY);
      const dx = a.tx - a.x0;
      const dz = a.tz - a.z0;
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
  drawWeather(game, dt) {
    const w = game.weather;
    if (!w || w.level <= 0.01) return;
    const ctx = this.ctx;
    const indoor = this.hidden !== null;
    if (!this.weatherDrops) this.weatherDrops = Array.from({ length: 220 }, () => ({ x: Math.random() * VIEW_W, y: Math.random() * VIEW_H, s: 0.6 + Math.random() * 0.8 }));
    const n = Math.floor(this.weatherDrops.length * w.level * (indoor ? 0.25 : 1));
    if (w.kind === 'fog') {
      ctx.fillStyle = `rgba(190,200,210,${0.28 * w.level})`;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      return;
    }
    const rain = w.kind === 'rain';
    // Overcast tint.
    ctx.fillStyle = rain ? `rgba(40,50,70,${0.18 * w.level})` : `rgba(200,210,230,${0.1 * w.level})`;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.fillStyle = rain ? 'rgba(170,190,230,0.55)' : 'rgba(245,248,255,0.9)';
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
  emit(x, y, z, opts) {
    const n = opts.n || 6;
    for (let i = 0; i < n; i++) {
      this.particles.push({
        x: x * TILE + (opts.spreadX ?? 8) * (Math.random() - 0.5) * 2 + 8,
        y: z * TILE - y * LH + LH + (opts.oy ?? 0) + (Math.random() - 0.5) * (opts.spreadY ?? 6),
        vx: (Math.random() - 0.5) * (opts.speed ?? 40),
        vy: -(opts.up ?? 30) * (0.5 + Math.random()),
        g: opts.gravity ?? 90,
        life: (opts.life ?? 0.6) * (0.6 + Math.random() * 0.6),
        max: opts.life ?? 0.6,
        color: Array.isArray(opts.color) ? opts.color[Math.floor(Math.random() * opts.color.length)] : opts.color,
        size: opts.size ?? 1,
        glow: !!opts.glow,
      });
    }
    if (this.particles.length > 900) this.particles.splice(0, this.particles.length - 900);
  }

  floatText(x, y, z, text, color = '#ff6060') {
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
      ctx.fillRect(sx, sy, p.size, p.size);
    }
    ctx.globalAlpha = 1;
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
    const sx = c.x * TILE - this.camX;
    const sy = c.z * TILE - c.y * LH - this.camY;
    const pulse = 0.55 + Math.sin(this.time * 6) * 0.25;
    // Placement ghost.
    if (c.place) {
      const p = c.place;
      const gx = p.x * TILE - this.camX;
      const gy = p.z * TILE - p.y * LH - this.camY;
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
