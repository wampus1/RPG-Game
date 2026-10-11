// (Round 86) The spyglass. Right-click with it in hand to put it to your
// eye: the view runs out ahead of you, the way you point. Move the mouse
// round the middle of the screen to turn it (you're the pivot it turns
// about); the scroll wheel runs it further out or brings it back in.
// Right-click again (or Escape, or put it away) to lower it.
import { VIEW_W, VIEW_H } from '../config.js';

export const SPY_MIN = 6;
export const SPY_MAX = 84;
const SPY_STEP = 6;

const holding = (game) => {
  const d = game.player && game.player.heldDef && game.player.heldDef();
  return !!(d && d.key === 'spyglass');
};

// Up to your eye, or down again.
export function toggleSpyglass(game) {
  if (game.spy) return lowerSpyglass(game);
  const p = game.player;
  const r = game.renderer;
  // (Pointing the way you face on screen, to begin with: 0 down, 1 left,
  // 2 up, 3 right.)
  const sf = r && r.viewDir ? r.viewDir(p.facing ?? 0) : p.facing ?? 0;
  game.spy = { a: [Math.PI / 2, Math.PI, -Math.PI / 2, 0][sf & 3], d: 24, dd: 4 };
  game.audio?.play('select');
  game.ui?.msg('You put the spyglass to your eye. Move the mouse round to turn it, scroll to look further or nearer; right-click to lower it.', '#c8d8f0', true);
  return true;
}

export function lowerSpyglass(game) {
  if (!game.spy) return false;
  game.spy = null;
  game.spyFocus = null;
  return true;
}

// The wheel, while it's up: further out, or nearer in. True if it was the
// spyglass's to take.
export function spyWheel(game, wheel) {
  const s = game.spy;
  if (!s || !wheel) return false;
  s.d = Math.max(SPY_MIN, Math.min(SPY_MAX, s.d - Math.sign(wheel) * SPY_STEP));
  return true;
}

// Each frame: where the view's looking (null when it's down). The angle
// follows the pointer round the middle of the screen; the reach eases out
// to where it's set.
export function spyTick(game, input, dt) {
  const s = game.spy;
  if (!s) return null;
  const p = game.player;
  if (!p || p.dead || !holding(game) || game.scene || game.cutscene || (p.deck && p.deck.role === 'helm')) {
    lowerSpyglass(game);
    return null;
  }
  const m = input && input.mouse;
  if (m && m.inside) {
    const dx = m.x - VIEW_W / 2;
    const dy = m.y - VIEW_H / 2;
    if (dx * dx + dy * dy > 64) {
      const want = Math.atan2(dy, dx);
      let da = want - s.a;
      while (da > Math.PI) da -= Math.PI * 2;
      while (da < -Math.PI) da += Math.PI * 2;
      s.a += da * Math.min(1, dt * 8);
    }
  }
  s.dd += (s.d - s.dd) * Math.min(1, dt * 4);
  const r = game.renderer;
  const rp = p.renderPos ? p.renderPos() : p;
  if (!r || !r.toView) return { x: rp.x + Math.cos(s.a) * s.dd, y: rp.y, z: rp.z + Math.sin(s.a) * s.dd };
  const [pu, pv] = r.toView(rp.x, rp.z);
  const [wx, wz] = r.toWorld(pu + Math.cos(s.a) * s.dd, pv + Math.sin(s.a) * s.dd);
  return { x: wx, y: rp.y, z: wz };
}

// The round of the glass: dark all about, a brass rim, the sight in it.
export function drawSpyRing(ctx, w, h, t) {
  const cx = w / 2;
  const cy = h / 2;
  const R = Math.min(w, h) * 0.47;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, w, h);
  ctx.arc(cx, cy, R, 0, Math.PI * 2, true);
  ctx.fillStyle = 'rgba(6,6,10,0.94)';
  ctx.fill('evenodd');
  const g = ctx.createRadialGradient(cx, cy, R * 0.72, cx, cy, R);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#a8803a';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(cx, cy, R + 1, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,230,160,0.35)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cx, cy, R - 2, Math.PI * 1.1 + Math.sin(t) * 0.05, Math.PI * 1.45);
  ctx.stroke();
  // (The fine cross in its middle.)
  ctx.strokeStyle = 'rgba(20,20,20,0.35)';
  ctx.beginPath();
  ctx.moveTo(cx - 6, cy);
  ctx.lineTo(cx + 6, cy);
  ctx.moveTo(cx, cy - 6);
  ctx.lineTo(cx, cy + 6);
  ctx.stroke();
  ctx.restore();
}
