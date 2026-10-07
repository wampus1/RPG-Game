// Lights of the old places, drawn over the lit world (they shine in the
// dark): the runes that crawl up the faces of the Kavorent's spires,
// brightening and fading as they rise (a blaze up the whole height when
// one's opened with a stone; dark once its ruin is beaten), and the circles
// of runes round relics set down, turning slowly, in the colour of their
// power.
import { TILE, LH, WORLD_Y } from '../config.js';
import { RELICS } from '../world/items.js';
import { placeTag } from '../game/relics.js';
import { FY } from '../world/dungeongen.js';
import { spireDissolve } from '../game/scenes.js';
import { drawAncientGates } from './ancientfx.js';
import { drawQuestFinder } from '../game/questfinder.js';

// Little glyphs, 4 wide and 5 tall (bit rows).
export const GLYPHS = [
  [0b0110, 0b1001, 0b1111, 0b1001, 0b0110],
  [0b1111, 0b0100, 0b0110, 0b0010, 0b1111],
  [0b1001, 0b0110, 0b0110, 0b1001, 0b1001],
  [0b0100, 0b1110, 0b0100, 0b0101, 0b0011],
  [0b1110, 0b1001, 0b1110, 0b1000, 0b1000],
  [0b0001, 0b0011, 0b0111, 0b0011, 0b0001],
];

export function glyph(ctx, g, x, y, k = 1) {
  for (let r = 0; r < 5; r++) for (let c = 0; c < 4; c++) if (GLYPHS[g][r] & (1 << (3 - c))) ctx.fillRect(x + c * k, y + r * k, k, k);
}

export function drawOldPlaces(r, game, dt) {
  const ctx = r.ctx;
  const p = game.player;
  // (Round 73) Who a quest of yours sends you to, in this town.
  drawQuestFinder(r, game);
  if (!game.dungeon) {
    for (const s of game.world.sites || []) {
      if (s.type !== 'kavorent' || s.x === undefined || Math.abs(s.x - p.x) > 40 || Math.abs(s.z - p.z) > 34) continue;
      const rec = game.sim.dungeons.get(s.id);
      spireCrown(r, ctx, game, s, rec);
      spireBeacon(r, ctx, game, s, rec);
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
    // (Round 72) The ancient places' gates: see ancientfx.js.
    drawAncientGates(r, game, dt);
  }
  relicCircles(r, ctx, game);
  stairOutlines(r, ctx, game);
}

// Down a dungeon, a faint line of light round the stairs (or the lift), up
// and down, so they're not lost among the floor tiles.
function stairOutlines(r, ctx, game) {
  const dg = game.dungeon;
  if (!dg || !dg.data) return;
  const p = game.player;
  const d = dg.data;
  const t = r.time;
  for (const [s, down] of [[d.up, false], [d.down, true]]) {
    if (!s || Math.abs(s.x - p.x) > 26 || Math.abs(s.z - p.z) > 20) continue;
    const [u, v] = r.toView(s.x, s.z);
    // (The floor's top, or for stairs up, the step they rise from.)
    const x = u * TILE - r.camX;
    const y = v * TILE - (FY - 1) * LH - r.camY;
    const pulse = 0.5 + 0.5 * Math.sin(t * 2.4 + s.x);
    ctx.save();
    ctx.strokeStyle = down ? '#ffd870' : '#bfe4ff';
    ctx.globalAlpha = 0.1 + pulse * 0.08;
    ctx.lineWidth = 3;
    ctx.strokeRect(x - 1, y - 1, TILE + 2, TILE + 2);
    ctx.globalAlpha = 0.3 + pulse * 0.18;
    ctx.lineWidth = 1;
    ctx.strokeRect(x - 0.5, y - 0.5, TILE + 1, TILE + 1);
    ctx.restore();
  }
}

// The middle column of the spire face turned toward you: runes rising.
function spireRunes(r, ctx, game, s, rec, dt) {
  if (rec && rec.cleared) return;
  // (Not while you're inside it: its faces are round you, not before you.)
  const p = game.player;
  if (Math.abs(p.x - s.x) <= 2 && Math.abs(p.z - s.z) <= 2) return;
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
  const layers = WORLD_Y - top + spireRise(s);
  const yBottom = v * TILE - top * LH + TILE + LH - r.camY;
  const height = layers * LH;
  const open = rec && rec.spire && rec.spire.open !== null && rec.spire.open !== undefined;
  const flare = r.spireFlare && r.spireFlare.id === s.id ? r.spireFlare : null;
  if (flare) {
    flare.t += dt;
    if (flare.t > 4) r.spireFlare = null;
  }
  const t = r.time;
  // (Its opening: see scenes.js. The runes quicken and burn every colour,
  // across the whole face.)
  const sc = game.scene && game.scene.kind === 'spire' && game.scene.rec.id === s.id ? game.scene : null;
  const wake = sc ? Math.min(1, sc.t / sc.BURST_AT) : 0;
  const many = sc || flare;
  const cols = many ? [-24, 0, 24] : [0];
  const n = many ? 8 : 6;
  for (const cx of cols) {
    for (let i = 0; i < n; i++) {
      // Each rises from the foot to the top, brightening, flickering, then
      // fading out as it climbs; drawn twice the size of a letter, with a
      // haze of light round it.
      const speed = sc ? 12 + 90 * wake * wake : flare ? 70 : open ? 16 : 9;
      const k = ((t * speed + (i * height) / n + cx * 7) % height) / height;
      const y = Math.round(yBottom - k * height - 12);
      const flick = Math.sin(t * 5.3 + i * 2.1 + cx) > 0.82 ? 0.35 : 1;
      const a = (many ? 1 : open ? 0.9 : 0.75) * Math.sin(k * Math.PI) * (0.75 + 0.25 * Math.sin(t * 3 + i)) * flick;
      if (a <= 0.02) continue;
      const g = (i * 5 + Math.floor(t * (sc ? 3 + 12 * wake : 0.4) + i)) % GLYPHS.length;
      const col = many ? RUNE_COLOURS[(i + Math.floor(t * (2 + 14 * wake)) + (cx > 0 ? 2 : cx < 0 ? 4 : 0)) % RUNE_COLOURS.length] : '#5ad8f0';
      ctx.globalAlpha = a * 0.22;
      ctx.fillStyle = col;
      ctx.fillRect(x + cx - 5, y - 4, 16, 18);
      ctx.globalAlpha = a * 0.4;
      ctx.fillRect(x + cx - 2, y - 2, 12, 14);
      ctx.globalAlpha = a;
      ctx.fillStyle = flare && !sc ? '#ffffff' : many ? '#ffffff' : '#c8fbff';
      glyph(ctx, g, x + cx - 1, y, 2);
    }
  }
  // The keystone in the face toward you: its hollow breathing faint light
  // (blazing in the stone's colour as one's set in it).
  const kv = r.toView(tx, tz);
  const kx = kv[0] * TILE + 8 - r.camX;
  const ky = kv[1] * TILE - (s.h + 1) * LH - r.camY + TILE + 5;
  const kg = sc ? 0.6 + 0.4 * Math.sin(t * 20) : 0.25 + 0.15 * Math.sin(t * 2.2);
  const kc = sc && sc.gemColor ? sc.gemColor : '#5ad8f0';
  const glow = ctx.createRadialGradient(kx, ky, 0, kx, ky, sc ? 18 : 9);
  glow.addColorStop(0, kc);
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.globalAlpha = kg;
  ctx.fillStyle = glow;
  ctx.fillRect(kx - 18, ky - 18, 36, 36);
  // The doorway's face coming apart into light (see scenes.js).
  if (sc) doorDissolve(r, ctx, sc, s);
  // A faint seam of light down the face's middle.
  ctx.globalAlpha = (flare ? 0.5 : 0.18) + 0.08 * Math.sin(t * 2);
  ctx.fillStyle = '#5ad8f0';
  ctx.fillRect(x + 2, yBottom - height, 2, height);
  ctx.globalAlpha = 1;
}

// How far a spire goes on up past the top of the world, in courses: the
// thermal spire stands down in its crater's lava, so the world's top is
// barely over the rim; the rest of it is drawn on up into the sky.
const RISE = { thermal: 16 };
export function spireRise(s) {
  return (s && RISE[s.theme]) || 0;
}

// The spire carried on up past the top of the world: its face toward you,
// course by course (alloy plates, a seam of light, bands of glow while it
// still draws on the mountain), and its crown. Dimmed with the sky (see
// Lighting.draw); faint while you're behind it, so it never hides you.
function spireCrown(r, ctx, game, s, rec) {
  const E = spireRise(s);
  if (!E || (rec && rec.cleared)) return;
  const p = game.player;
  if (Math.abs(p.x - s.x) <= 2 && Math.abs(p.z - s.z) <= 2) return;
  const [u, v] = r.toView(s.x, s.z);
  const x0 = (u - 2) * TILE - r.camX;
  const W = 5 * TILE;
  if (x0 > r.vw || x0 + W < 0) return;
  const yB = (v + 3) * TILE - (WORLD_Y - 1) * LH - r.camY;
  const yA = yB - E * LH;
  const yT = yA - 5 * TILE;
  if (yB < 0) return;
  const pp = r.playerPoint(game);
  const behind = pp.x > x0 - 8 && pp.x < x0 + W + 8 && pp.y > yT - 16 && pp.y < yB + 24;
  const sky = (r.lighting && r.lighting.sky) || [1, 1, 1];
  const lit = Math.max(0.18, (sky[0] + sky[1] + sky[2]) / 3);
  const glowing = !(s.state && s.state.beaten);
  const t = r.time;
  ctx.save();
  ctx.globalAlpha = behind ? 0.3 : 1;
  // Its face, course by course.
  for (let j = 0; j < E; j++) {
    const y = yB - (j + 1) * LH;
    ctx.fillStyle = '#2a2840';
    ctx.fillRect(x0, y, W, LH);
    ctx.fillStyle = '#3c3a58';
    ctx.fillRect(x0, y, W, 1);
    ctx.fillStyle = '#0e0c18';
    ctx.fillRect(x0, y + LH - 1, W, 1);
    for (let c = 0; c < 5; c++) {
      const sx = x0 + c * TILE + ((j + c) % 2 ? 7 : 11);
      ctx.fillStyle = '#1c1a2a';
      ctx.fillRect(sx, y, 1, LH);
      ctx.fillStyle = '#2e5a6a';
      ctx.fillRect(sx + 1, y + 1, 1, LH - 2);
    }
  }
  // The top: a crown of plates stepping in round the beacon's mouth.
  ctx.fillStyle = '#3c3a58';
  ctx.fillRect(x0, yT, W, yA - yT);
  ctx.fillStyle = '#2a2840';
  ctx.fillRect(x0 + TILE, yT + TILE, W - 2 * TILE, yA - yT - 2 * TILE);
  ctx.fillStyle = '#0e0c18';
  ctx.fillRect(x0 + 2 * TILE, yT + 2 * TILE, TILE, TILE);
  // Shade it with the hour (the world under it is lit the same way).
  if (lit < 0.999) {
    ctx.globalAlpha = (behind ? 0.3 : 1) * Math.min(0.85, 1 - lit);
    ctx.fillStyle = '#05040a';
    ctx.fillRect(x0, yT, W, yB - yT);
  }
  ctx.globalAlpha = behind ? 0.3 : 1;
  // Its light, which the dark doesn't dim: bands of glow every few courses
  // (a slow pulse climbing them), and the seam down its middle.
  if (glowing) {
    for (let j = 2; j < E; j += 3) {
      const y = yB - (j + 1) * LH + Math.floor(LH / 2) - 1;
      const pulse = 0.55 + 0.45 * Math.sin(t * 2.2 - j * 0.5);
      ctx.globalAlpha = (behind ? 0.3 : 1) * pulse;
      ctx.fillStyle = '#5ad8f0';
      ctx.fillRect(x0, y, W, 2);
      ctx.fillStyle = '#a8f4ff';
      ctx.fillRect(x0, y, W, 1);
    }
  }
  ctx.globalAlpha = (behind ? 0.3 : 1) * (0.25 + 0.1 * Math.sin(t * 2));
  ctx.fillStyle = '#5ad8f0';
  ctx.fillRect(x0 + 2 * TILE + 7, yA, 2, yB - yA);
  ctx.restore();
}

const RUNE_COLOURS = ['#5ad8f0', '#ff70d0', '#ffe070', '#7affb0', '#b080ff', '#ff9050'];

// The beacon at a spire's crown: a column of light up into the sky (faint
// while it's shut, strong once it's open, blinding as it bursts open),
// bands of light climbing it, and rings sent out from the top.
function spireBeacon(r, ctx, game, s, rec) {
  if (rec && rec.cleared) return;
  const open = rec && rec.spire && rec.spire.open !== null && rec.spire.open !== undefined;
  const sc = game.scene && game.scene.kind === 'spire' && game.scene.rec.id === s.id ? game.scene : null;
  const flare = r.spireFlare && r.spireFlare.id === s.id ? r.spireFlare : null;
  const t = r.time;
  let I = open ? 0.85 : 0.45;
  if (sc && !sc.burst) I = 0.45 + 0.55 * Math.min(1, sc.t / sc.BURST_AT) * (0.8 + 0.2 * Math.sin(t * 30));
  if (flare) I = Math.max(I, 2.2 - flare.t * 0.35);
  const [u, v] = r.toView(s.x, s.z);
  const x = u * TILE + 8 - r.camX;
  const yTop = v * TILE - (WORLD_Y - 1 + spireRise(s)) * LH - r.camY + 8;
  if (yTop < -20 || x < -120 || x > r.vw + 120) return;
  ctx.save();
  const w = (5 + 4 * I) * (1 + 0.08 * Math.sin(t * 3));
  for (const [k, a] of [[3.4, 0.08], [2, 0.16], [1, 0.42], [0.35, 0.9]]) {
    const g = ctx.createLinearGradient(0, yTop, 0, -40);
    g.addColorStop(0, `rgba(200,251,255,${Math.min(1, a * I)})`);
    g.addColorStop(1, `rgba(90,216,240,${Math.min(1, a * I) * 0.2})`);
    ctx.fillStyle = g;
    ctx.fillRect(Math.round(x - w * k), -40, Math.round(w * k * 2), yTop + 40);
  }
  // Bands of light climbing it.
  const speed = sc ? 2.5 : open ? 1.1 : 0.45;
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < 3; i++) {
    const k = (t * speed + i / 3) % 1;
    ctx.globalAlpha = Math.min(1, (1 - k) * I * 0.8);
    ctx.fillRect(Math.round(x - w * 0.8), Math.round(yTop - k * (yTop + 40)), Math.round(w * 1.6), 3);
  }
  // Rings sent out from the crown.
  const every = sc ? 0.6 : open ? 1.6 : 3.2;
  for (let i = 0; i < 2; i++) {
    const k = ((t / every + i * 0.5) % 1);
    ctx.globalAlpha = (1 - k) * Math.min(1, I) * 0.7;
    ctx.strokeStyle = sc && sc.gemColor ? sc.gemColor : '#c8fbff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(x, yTop, 6 + k * 70 * Math.min(1.6, I), 2 + k * 24 * Math.min(1.6, I), 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  // Its light pooled at the crown.
  ctx.globalAlpha = Math.min(1, 0.5 * I);
  const gl = ctx.createRadialGradient(x, yTop, 2, x, yTop, 18 + 26 * I);
  gl.addColorStop(0, 'rgba(255,255,255,0.95)');
  gl.addColorStop(0.4, 'rgba(160,240,255,0.5)');
  gl.addColorStop(1, 'rgba(90,216,240,0)');
  ctx.fillStyle = gl;
  ctx.fillRect(x - 60, yTop - 60, 120, 120);
  ctx.restore();
}

// The doorway's face (two courses of the spire's alloy) coming apart into
// light as the spire opens: specks of it gone a few at a time, each one
// flaring as it goes.
function doorDissolve(r, ctx, sc, s) {
  const k = spireDissolve(sc);
  if (k <= 0 || k >= 1) return;
  // (Every face comes apart; the one toward you is the one that shows.)
  const [cu, cv] = r.toView(s.x, s.z);
  let du = null;
  let dv = null;
  for (const [ox, oz] of [[0, 2], [-2, 0], [0, -2], [2, 0]]) {
    const [u, v] = r.toView(s.x + ox, s.z + oz);
    if (v > cv && u === cu) [du, dv] = [u, v];
  }
  if (du === null) return;
  const x0 = du * TILE - r.camX;
  const y0 = dv * TILE - (s.h + 2) * LH - r.camY + TILE;
  ctx.globalAlpha = 1;
  for (let py = 0; py < LH * 2; py++) {
    for (let px = 0; px < TILE; px++) {
      const n = (((px * 73856093) ^ (py * 19349663)) >>> 0) % 1000 / 1000;
      if (n < k) continue;
      const edge = n < k + 0.08;
      const seam = px === 7 || px === 8;
      ctx.fillStyle = edge ? (n < k + 0.03 ? '#ffffff' : '#5ad8f0') : seam ? '#1c1a2a' : py % LH === 0 ? '#3c3a58' : '#2a2840';
      ctx.fillRect(x0 + px, y0 + py, 1, 1);
    }
  }
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
  // (Only those on this floor, or up here in the world: not one on a floor
  // above or below, nor one up top while you're down a dungeon.)
  const tag = placeTag(game);
  for (const q of game.relics.values()) {
    if ((q.inst || null) !== tag) continue;
    if (Math.abs(q.x - p.x) > 26 || Math.abs(q.z - p.z) > 20 || Math.abs(q.y - p.y) > 6) continue;
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
