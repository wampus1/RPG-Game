// The Sleeper going up (see sim/volcano.js), as a scene: for everyone
// playing (each on their own screen, wherever they are on the islands;
// whoever's down an old place only feels it). The mountain against a sky
// gone the colour of a forge, a long moment of quiet and rumbling, then the
// top of it blown off: a column of fire, rock thrown high and raining back
// down, the ash spreading out over the whole sky, and the first lava
// running down its sides.
import { VIEW_W, VIEW_H } from '../config.js';
import { drawText, textWidth } from '../render/font.js';

const ease = (k) => k * k * (3 - 2 * k);
const clamp01 = (k) => Math.max(0, Math.min(1, k));

// When it blows (seconds into the scene), and how long the whole is.
export const ERUPT_BLAST = 3.2;
export const ERUPT_DUR = 11.5;

// What's said under it, as it goes (`here`: on Kharos itself, under it).
function lines(here) {
  return [
    [0.2, ERUPT_BLAST, here ? 'The ground heaves. The mountain is groaning.' : 'Over the sea, toward Kharos, the sky turns red...'],
    [ERUPT_BLAST, ERUPT_BLAST + 3.6, 'The Sleeper wakes!'],
    [ERUPT_BLAST + 3.6, ERUPT_DUR - 0.4, here ? 'Fire and black rock are coming down. The ash is falling.' : 'Its ash climbs over all three islands. The sun will be gone for days.'],
  ];
}

// For each player on the islands (not down an old place): it plays when
// they're free of any other scene (see eruptTick).
export function eruptionFor(game, info) {
  const all = game.everyone ? game.everyone() : [game.player];
  const each = () => {
    if (game.dungeon) return;
    game.eruptPending = { ...info, at: game.day * 1440 + game.minute };
  };
  if (game.asPlayer && all.length > 1) for (const q of all) game.asPlayer(q, each);
  else each();
}

// Each frame: start it (not if it's long since: a player held in another
// scene for a while just hears of it).
export function eruptTick(game) {
  const pend = game.eruptPending;
  if (!pend || game.scene || game.dungeon) return;
  game.eruptPending = null;
  if (game.day * 1440 + game.minute - pend.at > 30) return;
  game.scene = eruptionScene(game, pend);
}

export function eruptionScene(game, info = {}) {
  const here = !!info.here;
  const said = lines(here);
  // Rock thrown up out of it, falling back (made once: the same each time).
  let seed = 7311;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const rocks = [];
  for (let i = 0; i < 70; i++) rocks.push({ t0: ERUPT_BLAST + rnd() * 5.5, vx: (rnd() - 0.5) * 150, vy: -(70 + rnd() * 120), size: 1 + Math.floor(rnd() * 2.6), hot: rnd() });
  const plume = [];
  for (let i = 0; i < 90; i++) plume.push({ t0: ERUPT_BLAST + rnd() * 6.5, dx: (rnd() - 0.5) * 16, rise: 26 + rnd() * 40, drift: (rnd() - 0.5) * 60, size: 6 + rnd() * 12, shade: rnd() });
  const flows = [];
  for (let i = 0; i < 5; i++) flows.push({ side: i % 2 ? 1 : -1, bend: (rnd() - 0.5) * 0.5, t0: ERUPT_BLAST + 1 + rnd() * 2.5, w: 1 + Math.floor(rnd() * 2) });
  // The mountain: its peak, its foot either side.
  const peak = { x: VIEW_W / 2, y: here ? 92 : 128 };
  const foot = here ? 150 : 96;
  const ground = here ? 230 : 210;
  return {
    kind: 'erupt', t: 0, dur: ERUPT_DUR, lock: true, here,
    get mood() {
      return 'cs_eruption';
    },
    update(g, dt) {
      if (!this.started) {
        this.started = true;
        g.audio?.play('crumble');
        g.audio?.play('drone');
      }
      // The rumbling before; the blast; the ground still shaking after.
      if (this.t < ERUPT_BLAST) g.shake = Math.max(g.shake || 0, 0.1 + 0.25 * (this.t / ERUPT_BLAST) * (here ? 1.5 : 1));
      else if (!this.blew) {
        this.blew = true;
        g.audio?.play('eruption');
        g.audio?.play('boom');
        g.renderer?.flashScreen?.(here ? '#ffb060' : '#ffd8a0', here ? 0.6 : 0.4);
        g.shake = here ? 1.6 : 1.0;
      } else g.shake = Math.max(g.shake || 0, (here ? 0.5 : 0.25) * (1 - clamp01((this.t - ERUPT_BLAST) / 6)));
      this.boomT = (this.boomT ?? 1.2) - dt;
      if (this.blew && this.boomT <= 0 && this.t < ERUPT_DUR - 2) {
        this.boomT = 0.8 + Math.random() * 1.2;
        g.audio?.play(Math.random() < 0.5 ? 'thud' : 'crumble');
      }
    },
    draw(ctx) {
      const t = this.t;
      const vin = clamp01(t / 0.8);
      const vout = clamp01((this.dur - t) / 1.0);
      const fade = Math.min(vin, vout);
      const blast = clamp01((t - ERUPT_BLAST) / 0.4);
      const after = clamp01((t - ERUPT_BLAST) / 5);
      ctx.save();
      ctx.globalAlpha = fade;
      // The sky: dusk-red going to forge-orange, then darkened by the ash.
      const sky = ctx.createLinearGradient(0, 0, 0, ground);
      const r0 = Math.round(60 + 90 * clamp01(t / ERUPT_BLAST) + 60 * blast - 80 * after);
      sky.addColorStop(0, `rgb(${Math.max(20, r0 - 40)},${Math.round(16 + 10 * blast)},${Math.round(22 - 6 * blast)})`);
      sky.addColorStop(1, `rgb(${Math.min(255, r0 + 80)},${Math.round(60 + 50 * blast - 30 * after)},${Math.round(30)})`);
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      // (Over the sea: the water under it, catching the glow.)
      if (!here) {
        ctx.fillStyle = `rgb(${Math.round(30 + 60 * blast - 20 * after)},${Math.round(20 + 14 * blast)},${Math.round(30)})`;
        ctx.fillRect(0, ground, VIEW_W, VIEW_H - ground);
        ctx.globalAlpha = fade * 0.35;
        ctx.fillStyle = '#ff9040';
        for (let k = 0; k < 18; k++) ctx.fillRect(peak.x - 30 + ((k * 37 + Math.floor(t * 20)) % 60), ground + 4 + k * 3, 6 + (k % 3) * 3, 1);
        ctx.globalAlpha = fade;
      }
      // The ash, spreading over the whole sky from the top of it.
      for (const q of plume) {
        const k = (t - q.t0) / 4.5;
        if (k <= 0) continue;
        const kk = Math.min(1, k);
        const x = peak.x + q.dx + q.drift * kk * (1 + k * 0.6);
        const y = peak.y - q.rise * kk * 2.2 - k * 6;
        const r = q.size * (0.6 + kk * 1.8 + Math.max(0, k - 1) * 0.6);
        const g = Math.round(26 + q.shade * 34);
        ctx.globalAlpha = fade * Math.min(0.9, 0.5 + kk * 0.4);
        ctx.fillStyle = `rgb(${g + 10},${g},${g})`;
        ctx.beginPath();
        ctx.ellipse(x, y, r, r * 0.7, 0, 0, Math.PI * 2);
        ctx.fill();
        // (Lit from under, red, low down.)
        if (kk < 0.6) {
          ctx.globalAlpha = fade * (0.6 - kk) * 0.8;
          ctx.fillStyle = '#ff6a20';
          ctx.beginPath();
          ctx.ellipse(x, y + r * 0.3, r * 0.6, r * 0.3, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = fade;
      // The mountain itself.
      ctx.fillStyle = '#1a1210';
      ctx.beginPath();
      ctx.moveTo(peak.x - foot * 1.6, ground);
      ctx.lineTo(peak.x - 18, peak.y + 2);
      ctx.lineTo(peak.x - 8, peak.y + (this.blew ? 6 : 0));
      ctx.lineTo(peak.x + 8, peak.y + (this.blew ? 6 : 0));
      ctx.lineTo(peak.x + 18, peak.y + 2);
      ctx.lineTo(peak.x + foot * 1.6, ground);
      ctx.closePath();
      ctx.fill();
      // Its crater glowing; then the column of fire out of it.
      const glow = 0.4 + 0.6 * clamp01(t / ERUPT_BLAST) + 0.2 * Math.sin(t * 9);
      ctx.fillStyle = `rgba(255,${Math.round(110 + 60 * glow)},40,${(0.5 + 0.5 * glow).toFixed(2)})`;
      ctx.fillRect(peak.x - 8, peak.y - 1, 16, 3);
      if (blast > 0) {
        const hgt = 30 + 90 * ease(blast) * (1 - 0.5 * after);
        const grad = ctx.createLinearGradient(0, peak.y - hgt, 0, peak.y);
        grad.addColorStop(0, 'rgba(255,200,80,0)');
        grad.addColorStop(0.4, 'rgba(255,150,40,0.85)');
        grad.addColorStop(1, 'rgba(255,240,180,1)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(peak.x - 7, peak.y + 2);
        ctx.lineTo(peak.x - 16 - 10 * blast, peak.y - hgt);
        ctx.lineTo(peak.x + 16 + 10 * blast, peak.y - hgt);
        ctx.lineTo(peak.x + 7, peak.y + 2);
        ctx.fill();
      }
      // Lava finding its way down the sides.
      for (const f of flows) {
        const k = clamp01((t - f.t0) / 5);
        if (k <= 0) continue;
        ctx.strokeStyle = Math.sin(t * 7 + f.bend * 10) > 0 ? '#ff8a30' : '#ffb050';
        ctx.lineWidth = f.w;
        ctx.beginPath();
        ctx.moveTo(peak.x + f.side * 6, peak.y + 3);
        const len = k * (ground - peak.y - 6);
        for (let s = 0; s <= 10; s++) {
          const d = (len * s) / 10;
          const wob = Math.sin(d * 0.15 + f.bend * 9) * 3;
          ctx.lineTo(peak.x + f.side * (6 + d * (foot / (ground - peak.y)) * (0.55 + f.bend)) + wob, peak.y + 3 + d);
        }
        ctx.stroke();
      }
      // Rock thrown high, raining back down (burning).
      for (const q of rocks) {
        const k = t - q.t0;
        if (k <= 0 || k > 3.2) continue;
        const x = peak.x + q.vx * k;
        const y = peak.y + q.vy * k + 70 * k * k;
        if (y > ground) continue;
        ctx.fillStyle = q.hot > 0.5 ? (Math.floor((t + q.hot) * 8) % 2 ? '#ffd070' : '#ff7a30') : '#3a2a24';
        ctx.fillRect(Math.round(x), Math.round(y), q.size, q.size);
      }
      // The blast's flash.
      if (t >= ERUPT_BLAST && t < ERUPT_BLAST + 0.8) {
        ctx.globalAlpha = fade * 0.7 * (1 - (t - ERUPT_BLAST) / 0.8);
        ctx.fillStyle = '#fff0d0';
        ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      }
      // (Ash falling, after, on Kharos: grey flecks across the whole view.)
      if (here && after > 0) {
        ctx.globalAlpha = fade * 0.7 * after;
        ctx.fillStyle = '#8a8480';
        for (let k = 0; k < 60; k++) {
          const ax = (k * 53 + t * 12 * (1 + (k % 3))) % VIEW_W;
          const ay = (k * 31 + t * (20 + (k % 5) * 6)) % VIEW_H;
          ctx.fillRect(Math.round(ax), Math.round(ay), 1, 1);
        }
      }
      ctx.globalAlpha = 1;
      ctx.restore();
      // Bars, and the words.
      const h = Math.round(24 * Math.min(ease(clamp01(t / 0.6)), ease(clamp01((this.dur - t) / 0.6))));
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, VIEW_W, h);
      ctx.fillRect(0, VIEW_H - h, VIEW_W, h);
      const line = said.find(([a, b]) => t >= a && t < b);
      if (line && h > 16) {
        const k = Math.min(clamp01((t - line[0]) / 0.5), clamp01((line[1] - t) / 0.5));
        ctx.globalAlpha = k;
        drawText(ctx, line[2], Math.round(VIEW_W / 2 - textWidth(line[2]) / 2), VIEW_H - h + 9, '#ffe0c0', '#000');
        ctx.globalAlpha = 1;
      }
    },
  };
}
