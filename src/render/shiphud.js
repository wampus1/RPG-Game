// The great ships' cannonballs in flight, and how your ship's going (round
// 68): when you're aboard her, a strip along the bottom of the screen
// with her name, her hull and the water in her; at her wheel, her speed
// (and how many rafts' worth that is), the wind and where it is to her
// (a compass: her bow up, the wind's arrow), how much sail she's carrying,
// her sheets against where they'd best be, and her guns.
import { TILE, LH, VIEW_W } from '../config.js';
import { drawText } from './font.js';
import { shipById, shipStatus } from '../game/ships3d.js';

export function drawCannonballs(r, game) {
  const list = game.cannonballs;
  if (!list || !list.length) return;
  const ctx = r.ctx;
  for (const b of list) {
    const [u, v] = r.toView(b.x, b.z);
    const x = Math.round(u * TILE + 8 - r.camX);
    const y = Math.round(v * TILE + 8 - b.y * LH - r.camY);
    const sy = Math.round(v * TILE + 8 - 4.75 * LH - r.camY);
    if (x < -10 || y < -10 || x > r.vw + 10 || y > r.vh + 10) continue;
    // Its shadow on the sea, and it.
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(x - 2, sy, 4, 2);
    ctx.fillStyle = '#1a1a20';
    ctx.fillRect(x - 2, y - 1, 4, 3);
    ctx.fillRect(x - 1, y - 2, 2, 5);
    ctx.fillStyle = '#6a6a78';
    ctx.fillRect(x - 1, y - 1, 1, 1);
    // (A thread of smoke behind it.)
    ctx.fillStyle = 'rgba(220,220,214,0.35)';
    const [du, dv] = r.toViewDir(-b.vx, -b.vz);
    const l = Math.hypot(du, dv) || 1;
    for (let k = 1; k <= 3; k++) ctx.fillRect(Math.round(x + (du / l) * k * 3), Math.round(y + (dv / l) * k * 3 + b.vy * 0.05 * k), 1, 1);
  }
}

const bar = (ctx, x, y, w, f, c, bg = '#1a1420') => {
  ctx.fillStyle = bg;
  ctx.fillRect(x, y, w, 4);
  ctx.fillStyle = c;
  ctx.fillRect(x + 1, y + 1, Math.max(0, Math.round((w - 2) * Math.max(0, Math.min(1, f)))), 2);
};

export function drawShipHud(r, game) {
  const p = game.player;
  if (!p || !p.deck || (game.ui && game.ui.showHud === false)) return;
  const S = shipById(game, p.deck.s);
  if (!S) return;
  const ctx = r.ctx;
  const st = shipStatus(game, S);
  const helm = p.deck.role === 'helm';
  const gun = p.deck.role === 'gun';
  const H = helm ? 58 : 22;
  const W = helm ? 168 : 120;
  const x0 = VIEW_W - W - 4;
  const y0 = 84;
  ctx.fillStyle = 'rgba(16,14,24,0.78)';
  ctx.fillRect(x0, y0, W, H);
  ctx.fillStyle = 'rgba(200,170,110,0.5)';
  ctx.fillRect(x0, y0, W, 1);
  drawText(ctx, S.name.slice(0, 22), x0 + 3, y0 + 2, '#f0e0b0', '#000');
  // Her hull, and the water in her.
  drawText(ctx, 'HULL', x0 + 3, y0 + 12, '#c8c0b0', '#000');
  bar(ctx, x0 + 28, y0 + 13, 34, (st.hull - 0.45) / 0.55, st.hull > 0.75 ? '#80c860' : st.hull > 0.6 ? '#e8c040' : '#e05040');
  if (st.flood > 0.01) {
    drawText(ctx, 'WATER', x0 + 66, y0 + 12, '#80b8e8', '#000');
    bar(ctx, x0 + 98, y0 + 13, 18, st.flood, '#4a90e0');
  }
  if (gun) {
    const g = S.guns[p.deck.gi];
    if (g) drawText(ctx, g.cd > 0 ? `LOADING ${Math.ceil(g.cd)}` : 'READY', x0 + 3, y0 - 9, g.cd > 0 ? '#c8a080' : '#80e080', '#000');
  }
  if (!helm) return;
  // Her speed.
  // (At anchor: room on the line for saying so.)
  drawText(ctx, st.anchor ? `${st.speed.toFixed(1)} pace/s` : `${st.speed.toFixed(1)} pace/s  x${st.raft.toFixed(1)} raft`, x0 + 3, y0 + 22, '#e8e8f0', '#000');
  // Sail, and the sheets against where they'd best be.
  drawText(ctx, 'SAIL', x0 + 3, y0 + 32, '#c8c0b0', '#000');
  bar(ctx, x0 + 28, y0 + 33, 40, st.set, '#f0e8d0');
  ctx.fillStyle = '#ffd860';
  ctx.fillRect(x0 + 28 + Math.round(st.goal * 38), y0 + 31, 1, 2);
  drawText(ctx, 'TRIM', x0 + 3, y0 + 42, '#c8c0b0', '#000');
  ctx.fillStyle = '#1a1420';
  ctx.fillRect(x0 + 28, y0 + 43, 40, 4);
  const q = st.trim;
  ctx.fillStyle = q > 0.8 ? '#80e080' : q > 0.45 ? '#e8c040' : '#e05040';
  ctx.fillRect(x0 + 29 + Math.round(st.sheet * 37), y0 + 42, 2, 6);
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.fillRect(x0 + 29 + Math.round(st.ideal * 37), y0 + 44, 1, 2);
  drawText(ctx, st.drive < 0 ? 'ABACK!' : st.deg > 140 ? 'IN IRONS' : q > 0.8 ? 'DRAWING WELL' : q > 0.45 ? 'LUFFING' : 'FLOGGING', x0 + 72, y0 + 42, st.drive < 0 ? '#ff8060' : q > 0.8 ? '#a0e8a0' : '#e8c880', '#000');
  // Her guns.
  drawText(ctx, `GUNS ${st.loaded}/${st.guns}`, x0 + 72, y0 + 32, '#d8c8a8', '#000');
  if (st.anchor) drawText(ctx, 'ANCHORED', x0 + 72, y0 + 22 + 0, '#ffb080', '#000');
  // The compass: her bow up, the wind blowing along the arrow.
  const cx = x0 + W - 18;
  const cy = y0 + 20;
  ctx.fillStyle = 'rgba(40,36,56,0.9)';
  for (let a = 0; a < 24; a++) {
    const t = (a / 24) * Math.PI * 2;
    ctx.fillRect(Math.round(cx + Math.cos(t) * 13), Math.round(cy + Math.sin(t) * 13), 1, 1);
  }
  ctx.fillStyle = '#c8a060';
  ctx.fillRect(cx, cy - 11, 1, 6);
  ctx.fillRect(cx - 1, cy - 10, 3, 1);
  // (Wind in her frame: x across, z along her: screen up is her bow.)
  const a = st.windRel;
  const wx = -Math.sin(a);
  const wy = -Math.cos(a);
  for (let k = -9; k <= 9; k++) {
    const px = Math.round(cx + wx * k);
    const py = Math.round(cy + wy * k);
    ctx.fillStyle = k > 5 ? '#ffffff' : '#a0d0ff';
    ctx.fillRect(px, py, 1, 1);
  }
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(Math.round(cx + wx * 9 - wy * 2), Math.round(cy + wy * 9 + wx * 2), 1, 1);
  ctx.fillRect(Math.round(cx + wx * 9 + wy * 2), Math.round(cy + wy * 9 - wx * 2), 1, 1);
  drawText(ctx, `${Math.round(st.windK * 10)}`, cx - 2, cy + 14, '#a0d0ff', '#000');
  // (Keys.)
  drawText(ctx, 'A/D helm W/S sail Z/X sheets R anchor F leave', x0 + 3, y0 + H + 1, 'rgba(220,220,230,0.7)', null);
}
