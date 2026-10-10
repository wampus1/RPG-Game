// (Round 78) Out at sea: the grapnel lines between a pirate and the ship
// she's lashed herself to (see game/pirates.js), taut over the water from
// rail to rail.
import { GROUND } from '../config.js';
import { grapples } from '../game/pirates.js';

export function drawGrapples(r, game) {
  const pairs = grapples(game);
  if (!pairs.length) return;
  const ctx = r.ctx;
  ctx.save();
  ctx.strokeStyle = '#b89a6a';
  ctx.lineWidth = 1;
  for (const [A, B] of pairs) {
    const dx = B.x - A.x;
    const dz = B.z - A.z;
    const d = Math.hypot(dx, dz) || 1;
    // (Three lines, along her side, a few paces apart.)
    for (const k of [-0.3, 0, 0.3]) {
      const ox = (-dz / d) * k * A.m.L * 0.5;
      const oz = (dx / d) * k * A.m.L * 0.5;
      const a = r.worldToScreen(A.x + ox + (dx / d) * A.m.W * 0.4, GROUND + 1.6, A.z + oz + (dz / d) * A.m.W * 0.4);
      const b = r.worldToScreen(B.x + ox - (dx / d) * B.m.W * 0.4, GROUND + 1.6, B.z + oz - (dz / d) * B.m.W * 0.4);
      ctx.beginPath();
      ctx.moveTo(a.x + 8, a.y);
      ctx.quadraticCurveTo((a.x + b.x) / 2 + 8, (a.y + b.y) / 2 + 3, b.x + 8, b.y);
      ctx.stroke();
      ctx.fillStyle = '#8a8a92';
      ctx.fillRect(Math.round(b.x + 7), Math.round(b.y) - 1, 3, 2);
    }
  }
  ctx.restore();
}
