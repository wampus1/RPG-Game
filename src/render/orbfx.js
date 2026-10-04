// How a witch-light looks (see game/orbs.js): a ball of grave-fire
// floating at chest height, a fading trail behind it and its glow on the
// floor under it; swelling in her hand before it goes; gold once you've
// knocked it back at her; guttering as its seven seconds run out.
import { TILE, LH } from '../config.js';
import { ORB_RISE } from '../game/orbs.js';

const GOLD = [255, 224, 112];

export function drawOrbs(r, ctx, game) {
  const list = game.orbs;
  if (!list || !list.length) return;
  ctx.save();
  for (const o of list) {
    if (o.done) continue;
    const at = (x, z, up) => {
      const [u, v] = r.toView(x, z);
      return [u * TILE - r.camX + 8, v * TILE - (o.y + up) * LH + LH - r.camY];
    };
    const [cr, cg, cb] = o.back ? GOLD : o.color;
    const rgba = (a) => `rgba(${cr},${cg},${cb},${a})`;
    const grow = Math.min(1, o.t / ORB_RISE);
    const left = o.life - o.t;
    // (Its last second: flickering out.)
    const fade = left < 1 ? Math.max(0.25, left) * (Math.floor(r.time * 16) % 2 ? 0.5 : 1) : 1;
    const bob = Math.sin(r.time * 6 + o.x * 2) * 0.08;
    const [sx, sy] = at(o.x, o.z, 0.8 + bob);
    const [gx, gy] = at(o.x, o.z, 0);
    if (sx < -30 || sy < -30 || sx > (r.vw || 9999) + 30 || sy > (r.vh || 9999) + 30) continue;
    // Its shadow, and its light on the floor.
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 0.3 * fade * grow;
    ctx.fillStyle = '#000000';
    ctx.fillRect(Math.round(gx - 3), Math.round(gy - 1), 6, 2);
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.22 * fade * grow;
    ctx.fillStyle = rgba(1);
    ctx.fillRect(Math.round(gx - 6), Math.round(gy - 1), 12, 2);
    ctx.fillRect(Math.round(gx - 4), Math.round(gy - 2), 8, 4);
    // The trail.
    const n = o.trail.length;
    for (let i = 0; i < n; i++) {
      const q = o.trail[i];
      const [tx, ty] = at(q.x, q.z, 0.8);
      const k = (i + 1) / (n + 1);
      const s = Math.max(1, Math.round(1 + k * 3));
      ctx.globalAlpha = 0.45 * k * fade;
      ctx.fillStyle = rgba(1);
      ctx.fillRect(Math.round(tx - s / 2), Math.round(ty - s / 2), s, s);
    }
    // Its halo.
    const rad = (10 + Math.sin(r.time * 11) * 1.5) * grow;
    if (rad > 0.5) {
      const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, rad);
      g.addColorStop(0, rgba(0.85));
      g.addColorStop(0.45, rgba(0.3));
      g.addColorStop(1, rgba(0));
      ctx.globalAlpha = fade;
      ctx.fillStyle = g;
      ctx.fillRect(sx - rad, sy - rad, rad * 2, rad * 2);
    }
    // The ball itself: a round of colour, paler at its heart.
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = fade;
    const R = grow < 0.5 ? 1 : grow < 1 ? 2 : 3;
    const x = Math.round(sx);
    const y = Math.round(sy);
    ctx.fillStyle = `rgb(${Math.round(cr * 0.55)},${Math.round(cg * 0.55)},${Math.round(cb * 0.55)})`;
    ctx.fillRect(x - R, y - R + 1, R * 2, R * 2 - 2);
    ctx.fillRect(x - R + 1, y - R, R * 2 - 2, R * 2);
    ctx.fillStyle = rgba(1);
    ctx.fillRect(x - R + 1, y - R + 1, R * 2 - 2, R * 2 - 2);
    if (R >= 2) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x - 1, y - 1, R >= 3 ? 2 : 1, R >= 3 ? 2 : 1);
    }
  }
  ctx.restore();
}
