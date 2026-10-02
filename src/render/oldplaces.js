// Lights of the old places, drawn over the lit world (they shine in the
// dark): the runes that crawl up the faces of the Kavorent's spires,
// brightening and fading as they rise (a blaze up the whole height when
// one's opened with a stone; dark once its ruin is beaten), and the circles
// of runes round relics set down, turning slowly, in the colour of their
// power.
import { TILE, LH, WORLD_Y } from '../config.js';
import { RELICS } from '../world/items.js';

// Little glyphs, 4 wide and 5 tall (bit rows).
const GLYPHS = [
  [0b0110, 0b1001, 0b1111, 0b1001, 0b0110],
  [0b1111, 0b0100, 0b0110, 0b0010, 0b1111],
  [0b1001, 0b0110, 0b0110, 0b1001, 0b1001],
  [0b0100, 0b1110, 0b0100, 0b0101, 0b0011],
  [0b1110, 0b1001, 0b1110, 0b1000, 0b1000],
  [0b0001, 0b0011, 0b0111, 0b0011, 0b0001],
];

function glyph(ctx, g, x, y, k = 1) {
  for (let r = 0; r < 5; r++) for (let c = 0; c < 4; c++) if (GLYPHS[g][r] & (1 << (3 - c))) ctx.fillRect(x + c * k, y + r * k, k, k);
}

export function drawOldPlaces(r, game, dt) {
  const ctx = r.ctx;
  const p = game.player;
  if (!game.dungeon) {
    for (const s of game.world.sites || []) {
      if (s.type !== 'kavorent' || s.x === undefined || Math.abs(s.x - p.x) > 40 || Math.abs(s.z - p.z) > 34) continue;
      const rec = game.sim.dungeons.get(s.id);
      spireRunes(r, ctx, game, s, rec, dt);
    }
  }
  relicCircles(r, ctx, game);
}

// The middle column of the spire face turned toward you: runes rising.
function spireRunes(r, ctx, game, s, rec, dt) {
  if (rec && rec.cleared) return;
  // Which of its faces is toward the camera.
  const [fx, fz] = r.toWorld ? r.toWorld(0, 1) : [0, 1];
  const [wx0, wz0] = r.toWorld ? r.toWorld(0, 0) : [0, 0];
  const nx = fx - wx0;
  const nz = fz - wz0;
  const tx = s.x + Math.sign(nx) * 2;
  const tz = s.z + Math.sign(nz) * 2;
  const [u, v] = r.toView(tx, tz);
  const x = u * TILE - r.camX + 6;
  const top = s.h + 1;
  const layers = WORLD_Y - top;
  const yBottom = v * TILE - top * LH + TILE + LH - r.camY;
  const height = layers * LH;
  const open = rec && rec.spire && rec.spire.open !== null && rec.spire.open !== undefined;
  const flare = r.spireFlare && r.spireFlare.id === s.id ? r.spireFlare : null;
  if (flare) {
    flare.t += dt;
    if (flare.t > 4) r.spireFlare = null;
  }
  const t = r.time;
  const n = 6;
  for (let i = 0; i < n; i++) {
    // Each rises from the foot to the top, brightening, flickering, then
    // fading out as it climbs; drawn twice the size of a letter, with a
    // haze of light round it.
    const speed = flare ? 70 : open ? 16 : 9;
    const k = ((t * speed + (i * height) / n) % height) / height;
    const y = Math.round(yBottom - k * height - 12);
    const flick = Math.sin(t * 5.3 + i * 2.1) > 0.82 ? 0.35 : 1;
    const a = (flare ? 1 : open ? 0.9 : 0.75) * Math.sin(k * Math.PI) * (0.75 + 0.25 * Math.sin(t * 3 + i)) * flick;
    if (a <= 0.02) continue;
    const g = (i * 5 + Math.floor(t * 0.4 + i)) % GLYPHS.length;
    ctx.globalAlpha = a * 0.22;
    ctx.fillStyle = '#5ad8f0';
    ctx.fillRect(x - 5, y - 4, 16, 18);
    ctx.globalAlpha = a * 0.4;
    ctx.fillRect(x - 2, y - 2, 12, 14);
    ctx.globalAlpha = a;
    ctx.fillStyle = flare ? '#ffffff' : '#c8fbff';
    glyph(ctx, g, x - 1, y, 2);
  }
  // A faint seam of light down the face's middle.
  ctx.globalAlpha = (flare ? 0.5 : 0.18) + 0.08 * Math.sin(t * 2);
  ctx.fillStyle = '#5ad8f0';
  ctx.fillRect(x + 2, yBottom - height, 2, height);
  ctx.globalAlpha = 1;
}

// A relic's reach, on the ground round it.
function relicCircles(r, ctx, game) {
  if (!game.relics || !game.relics.size) return;
  const p = game.player;
  for (const q of game.relics.values()) {
    if (Math.abs(q.x - p.x) > 26 || Math.abs(q.z - p.z) > 20) continue;
    const R = RELICS[q.kind];
    if (!R) continue;
    const [u, v] = r.toView(q.x, q.z);
    const cx = u * TILE + 8 - r.camX;
    const cy = v * TILE - (q.y - 1) * LH + 8 - r.camY;
    const rad = (q.r || 4) * TILE + 6;
    const t = r.time;
    const pulse = 0.5 + 0.5 * Math.sin(t * 2.2 + q.x);
    ctx.save();
    // The ring, and a fainter one inside it.
    ctx.strokeStyle = R.color;
    ctx.globalAlpha = 0.35 + pulse * 0.25;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, rad, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 0.15 + pulse * 0.1;
    ctx.beginPath();
    ctx.arc(cx, cy, rad - 5, 0, Math.PI * 2);
    ctx.stroke();
    // Runes round it, turning.
    ctx.fillStyle = R.color;
    const n = 12;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + t * 0.25;
      ctx.globalAlpha = 0.45 + 0.4 * Math.sin(t * 3 + i * 1.7);
      glyph(ctx, (i + q.x) % GLYPHS.length, Math.round(cx + Math.cos(a) * (rad - 2.5) - 2), Math.round(cy + Math.sin(a) * (rad - 2.5) - 2));
    }
    // A glow under the relic itself.
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 14);
    g.addColorStop(0, R.color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = 0.25 + pulse * 0.2;
    ctx.fillStyle = g;
    ctx.fillRect(cx - 14, cy - 14, 28, 28);
    // Motes rising off it.
    if (Math.random() < 0.15) r.emit(q.x + (Math.random() - 0.5) * 2 * (q.r || 4) * 0.8, q.y, q.z + (Math.random() - 0.5) * 2 * (q.r || 4) * 0.8, { n: 1, color: [R.color, '#ffffff'], up: 12, speed: 4, gravity: -10, life: 1.2, glow: true });
    ctx.restore();
  }
}
