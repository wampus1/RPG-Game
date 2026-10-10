// (Round 78) Blueprints laid out (see game/plans.js): each planned block
// drawn see-through where it'd stand, in the world's own order (a wall in
// front hides it), and picked as itself under the pointer; built for real,
// it's no longer drawn. And the copy box, a blueprint in hand: its edges,
// and a mark on each side to drag it by.
import { TILE, LH } from '../config.js';
import { BLOCKS } from '../world/blocks.js';
import { TEX, SPR_H } from './textures.js';

const MAX_DRAWN = 2500;

export function planDecos(r, game, buckets, zMin, zMax) {
  const plans = game.plans;
  if (!plans || !plans.size) return;
  const ctx = r.ctx;
  const p = game.player;
  // (Brighter while you've a blueprint about you to draw with.)
  const drawing = !!(p && ((p.equip && /^(blueprint|plans~)/.test(p.equip.shield || '')) || (p.heldDef && p.heldDef() && p.heldDef().blueprint)));
  const alpha = drawing ? 0.5 : 0.32;
  const w = game.world;
  const mouse = r.mouse;
  let n = 0;
  for (const plan of plans.values()) {
    if (!plan.at) continue;
    for (const c of plan.cells) {
      if (n > MAX_DRAWN) return;
      const x = plan.at.x + c[0];
      const y = plan.at.y + c[1];
      const z = plan.at.z + c[2];
      const id = c[3];
      const b = BLOCKS[id];
      if (!b) continue;
      const [u, v] = r.toView(x, z);
      if (v < zMin || v > zMax) continue;
      const sx = u * TILE - r.camX;
      const sy = v * TILE - y * LH - r.camY;
      if (sx < -TILE || sx > r.vw + TILE || sy < -SPR_H - LH || sy > r.vh + LH) continue;
      // (Built: nothing to show.)
      if (w.getBlock(x, y, z) === id) continue;
      n++;
      let arr = buckets.get(v);
      if (!arr) buckets.set(v, (arr = []));
      arr.push({
        layer: y,
        rp: { y: 98 },
        deco: () => {
          const rot = b.rotatable ? ((c[4] || 0) + (r.view || 0)) & 3 : 0;
          ctx.globalAlpha = alpha;
          if (b.render === 'cube' || b.render === 'door' || b.render === 'stair' || b.render === 'liquid') {
            const top = TEX.top[id * 4 + rot] || TEX.top[id * 4];
            const front = TEX.front[id * 4 + rot] || TEX.front[id * 4];
            if (top && top[0]) ctx.drawImage(r.atlas, top[0].x, top[0].y, 16, 16, sx, sy, 16, 16);
            if (front && front[0]) ctx.drawImage(r.atlas, front[0].x, front[0].y, 16, LH, sx, sy + 16, 16, LH);
          } else {
            const sp = TEX.sprite[id * 4 + rot] || TEX.sprite[id * 4];
            const s = sp && sp[0];
            if (s) ctx.drawImage(r.atlas, s.x, s.y, s.w, s.h, sx, sy + SPR_H - s.h, s.w, s.h);
          }
          // A blueprint's blue line round it.
          ctx.globalAlpha = alpha * 0.9;
          ctx.strokeStyle = '#7ab0ff';
          ctx.lineWidth = 1;
          ctx.strokeRect(sx + 0.5, sy + 0.5, 15, 16 + LH - 1);
          ctx.globalAlpha = 1;
          if (mouse && mouse.x >= sx && mouse.x < sx + 16 && mouse.y >= sy && mouse.y < sy + 16 + LH) r.pick = { x, y, z, face: mouse.y - sy < 16 ? 'top' : 'front', id, ghost: true, seq: ++r.pickSeq };
        },
      });
    }
  }
}

// The copy box (yours), over everything.
export function drawCopyBox(r, game) {
  const p = game.player;
  const B0 = p && p.copyBox;
  if (!B0 || !B0.box) return;
  const ctx = r.ctx;
  const b = B0.box;
  const [a0, c0] = r.toView(b.x0, b.z0);
  const [a1, c1] = r.toView(b.x1, b.z1);
  const u0 = Math.min(a0, a1);
  const u1 = Math.max(a0, a1) + 1;
  const v0 = Math.min(c0, c1);
  const v1 = Math.max(c0, c1) + 1;
  const X = (u) => u * TILE - r.camX;
  // (A plane at height Y, row V, on the screen: see renderer.drawWorld.)
  const Y = (v, y) => v * TILE - (y - 1) * LH - r.camY;
  const top = b.y1 + 1;
  const bot = b.y0;
  const pulse = 0.6 + 0.4 * Math.sin((r.time || 0) * 4);
  ctx.save();
  ctx.lineWidth = 1;
  ctx.strokeStyle = `rgba(120,200,255,${0.55 + 0.35 * pulse})`;
  ctx.setLineDash([3, 2]);
  const rect = (y) => ctx.strokeRect(X(u0) + 0.5, Y(v0, y) + 0.5, X(u1) - X(u0) - 1, Y(v1, y) - Y(v0, y) - 1);
  rect(bot);
  ctx.setLineDash([]);
  rect(top);
  ctx.beginPath();
  for (const [u, v] of [[u0, v0], [u1, v0], [u0, v1], [u1, v1]]) {
    ctx.moveTo(X(u) + 0.5, Y(v, top) + 0.5);
    ctx.lineTo(X(u) + 0.5, Y(v, bot) + 0.5);
  }
  ctx.stroke();
  ctx.fillStyle = 'rgba(120,200,255,0.08)';
  ctx.fillRect(X(u0), Y(v0, top), X(u1) - X(u0), Y(v1, top) - Y(v0, top));
  // The handles, mid-side on the top, to drag by (the one held, bright).
  if (B0.stage === 'set') {
    const mu = (u0 + u1) / 2;
    const mv = (v0 + v1) / 2;
    const hs = [['u0', u0, mv], ['u1', u1, mv], ['v0', mu, v0], ['v1', mu, v1]];
    for (const [k, u, v] of hs) {
      const on = B0.drag && B0.drag.side === k;
      ctx.fillStyle = on ? '#ffffff' : '#78c8ff';
      ctx.fillRect(Math.round(X(u)) - 2, Math.round(Y(v, top)) - 2, 5, 5);
      ctx.fillStyle = '#10203a';
      ctx.fillRect(Math.round(X(u)) - 1, Math.round(Y(v, top)) - 1, 3, 3);
    }
  }
  ctx.restore();
}
