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
    // A realm's Skyward Beacon (see sim/ancient.js): a pillar of light from
    // its capital up into the sky.
    r.beaconT = (r.beaconT || 0) - dt;
    if (r.beaconT <= 0 || !r.beaconList) {
      r.beaconT = 2;
      r.beaconList = game.sim.ancient ? game.sim.ancient.beacons() : [];
    }
    for (const b of r.beaconList) {
      if (Math.abs(b.x - p.x) > 40 || Math.abs(b.z - p.z) > 40) continue;
      beacon(r, ctx, b);
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

function beacon(r, ctx, b) {
  const [u, v] = r.toView(b.x, b.z);
  const x = u * TILE + 8 - r.camX;
  const yb = v * TILE - 5 * LH + LH - r.camY;
  const t = r.time;
  const w = 7 + Math.sin(t * 2) * 1.5;
  ctx.save();
  for (const [k, a] of [[3.2, 0.1], [1.8, 0.18], [1, 0.5], [0.35, 0.85]]) {
    const g = ctx.createLinearGradient(0, yb, 0, -40);
    g.addColorStop(0, `rgba(200,251,255,${a})`);
    g.addColorStop(1, `rgba(90,216,240,${a * 0.25})`);
    ctx.fillStyle = g;
    ctx.fillRect(Math.round(x - w * k), -40, Math.round(w * k * 2), yb + 40);
  }
  // Motes of light climbing it.
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < 8; i++) {
    const k = ((t * 0.35 + i / 8) % 1);
    ctx.globalAlpha = Math.sin(k * Math.PI) * 0.9;
    ctx.fillRect(Math.round(x - w + ((i * 37) % (w * 2))), Math.round(yb - k * (yb + 40)), 2, 2);
  }
  // Its pool of light on the ground.
  ctx.globalAlpha = 0.35 + 0.1 * Math.sin(t * 3);
  const gl = ctx.createRadialGradient(x, yb, 2, x, yb, 40);
  gl.addColorStop(0, 'rgba(200,251,255,0.9)');
  gl.addColorStop(1, 'rgba(90,216,240,0)');
  ctx.fillStyle = gl;
  ctx.fillRect(x - 40, yb - 20, 80, 40);
  ctx.restore();
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
    // A wash of its colour over the ground it reaches.
    const wash = ctx.createRadialGradient(cx, cy, rad * 0.2, cx, cy, rad);
    wash.addColorStop(0, 'rgba(0,0,0,0)');
    wash.addColorStop(0.75, R.color);
    wash.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = 0.07 + pulse * 0.05;
    ctx.fillStyle = wash;
    ctx.beginPath();
    ctx.arc(cx, cy, rad, 0, Math.PI * 2);
    ctx.fill();
    // The ring (with a soft glow under it), and a fainter one inside it.
    ctx.strokeStyle = R.color;
    ctx.globalAlpha = 0.18 + pulse * 0.12;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, rad, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 0.6 + pulse * 0.3;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, rad, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 0.25 + pulse * 0.15;
    ctx.beginPath();
    ctx.arc(cx, cy, rad - 6, 0, Math.PI * 2);
    ctx.stroke();
    // A brighter arc sweeping round the ring.
    const sw = t * 1.3 + q.z;
    ctx.globalAlpha = 0.9;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, rad, sw, sw + 0.6);
    ctx.stroke();
    // Runes round it, turning; and a few nearer in, turning the other way.
    ctx.fillStyle = R.color;
    const n = 12;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + t * 0.25;
      ctx.globalAlpha = 0.6 + 0.35 * Math.sin(t * 3 + i * 1.7);
      glyph(ctx, (i + q.x) % GLYPHS.length, Math.round(cx + Math.cos(a) * (rad - 3) - 2), Math.round(cy + Math.sin(a) * (rad - 3) - 2));
    }
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 - t * 0.4;
      ctx.globalAlpha = 0.35 + 0.3 * Math.sin(t * 2 + i);
      glyph(ctx, (i * 3 + q.z) % GLYPHS.length, Math.round(cx + Math.cos(a) * rad * 0.45 - 2), Math.round(cy + Math.sin(a) * rad * 0.45 - 2));
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
