// The Sleeper going up (see sim/volcano.js), as a scene: for everyone
// playing (each on their own screen, wherever they are on the islands;
// whoever's down an old place only feels it). The mountain against a sky
// gone the colour of a forge, a long moment of quiet and rumbling, then the
// top of it blown off: a column of fire, rock thrown high and raining back
// down, the ash spreading out over the whole sky, and the first lava
// running down its sides. (Round 51: painted, see render/art_erupt.js.)
import { VIEW_W, VIEW_H } from '../config.js';
import { drawText, textWidth } from '../render/font.js';
import { paintEruption, drawSea, drawWatchers } from '../render/art_erupt.js';

const ease = (k) => k * k * (3 - 2 * k);
const clamp01 = (k) => Math.max(0, Math.min(1, k));
// (Painted at half size, each pixel two on the screen.)
const PW = VIEW_W / 2;
const PH = VIEW_H / 2;

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
  // What's thrown up (made once: the same each time): bombs of rock on
  // long arcs; the ash cloud's billows; the lava's channels; the fountain.
  let seed = 7311;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const rocks = [];
  for (let i = 0; i < 46; i++) rocks.push({ t0: ERUPT_BLAST + rnd() * 6, vx: (rnd() - 0.5) * 90, vy: -(36 + rnd() * 60), size: 1 + Math.floor(rnd() * 2), hot: rnd() });
  const plume = [];
  for (let i = 0; i < 80; i++) plume.push({ t0: ERUPT_BLAST + rnd() * 7, dx: (rnd() - 0.5) * 10, rise: 18 + rnd() * 26, drift: (rnd() - 0.5) * 44, size: 4 + rnd() * 7, shade: rnd() });
  const flows = [];
  for (let i = 0; i < 6; i++) flows.push({ side: i % 2 ? 1 : -1, bend: (rnd() - 0.5) * 0.5, t0: ERUPT_BLAST + 0.8 + rnd() * 2.5, w: 1 + Math.floor(rnd() * 2), spread: 0.25 + rnd() * 0.6 });
  const sparks = [];
  for (let i = 0; i < 60; i++) sparks.push({ ph: rnd(), vx: (rnd() - 0.5) * 30, vy: -(30 + rnd() * 40) });
  let art = null;
  let buf = null;
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
      if (!art) art = paintEruption(here);
      if (!buf) {
        buf = document.createElement('canvas');
        buf.width = PW;
        buf.height = PH;
      }
      const g = buf.getContext('2d');
      g.imageSmoothingEnabled = false;
      g.globalAlpha = 1;
      g.globalCompositeOperation = 'source-over';
      const vin = clamp01(t / 0.8);
      const vout = clamp01((this.dur - t) / 1.0);
      const fade = Math.min(vin, vout);
      const blast = clamp01((t - ERUPT_BLAST) / 0.4);
      const after = clamp01((t - ERUPT_BLAST) / 5);
      const { peak } = art;
      // How hot the light off it is: building before, blazing at the
      // blast, the ash dimming it after.
      const glow = clamp01(0.25 + 0.35 * (t / ERUPT_BLAST) * (1 - blast) + blast * (1 - after * 0.35));
      g.drawImage(art.sky, 0, 0);
      // The ash spreading over the sky (high, behind the mountain), dark,
      // its underside red.
      if (after > 0) {
        g.globalAlpha = after * 0.85;
        const ag = g.createLinearGradient(0, 0, 0, peak.y + 20);
        ag.addColorStop(0, '#1a1416');
        ag.addColorStop(0.75, '#3a2224');
        ag.addColorStop(1, 'rgba(120,40,30,0)');
        g.fillStyle = ag;
        g.fillRect(0, 0, PW, peak.y + 20);
        g.globalAlpha = 1;
      }
      // The fire's red over the sky, from the top of the mountain.
      g.save();
      g.globalCompositeOperation = 'lighter';
      const sg = g.createRadialGradient(peak.x, peak.y, 2, peak.x, peak.y, 140);
      sg.addColorStop(0, `rgba(255,140,60,${(0.55 * glow).toFixed(3)})`);
      sg.addColorStop(1, 'rgba(120,30,20,0)');
      g.fillStyle = sg;
      g.fillRect(0, 0, PW, PH);
      g.restore();
      if (art.sea) drawSea(g, art, t, glow);
      g.drawImage(art.mountain, 0, 0);
      // Lights along the shore, at its foot.
      for (const l of art.lights) {
        g.fillStyle = Math.sin(t * 3 + l.x) > -0.6 ? '#ffd070' : '#a87030';
        g.fillRect(l.x, l.y, 1, 1);
      }
      // The lava, finding its way down: a glowing channel, its crust dark
      // at the edges, flickering.
      for (const f of flows) {
        const k = clamp01((t - f.t0) / 5);
        if (k <= 0) continue;
        const len = k * (art.ground - peak.y - 4);
        for (let s = 0; s <= len; s += 0.5) {
          const y = peak.y + 2 + s;
          const hw = 9 + Math.pow(s / (art.ground - peak.y), 1.6) * (here ? 220 : 112);
          const x = peak.x + f.side * (6 + (hw - 9) * f.spread) + Math.sin(s * 0.18 + f.bend * 9) * 2;
          const hot = 1 - s / len;
          g.fillStyle = Math.sin(t * 8 + s * 0.4) > 0.2 ? (hot > 0.7 ? '#fff0a0' : '#ffb040') : hot > 0.5 ? '#ff8a30' : '#e05a20';
          g.fillRect(Math.round(x), Math.round(y), f.w, 1);
          g.fillStyle = '#5a1a10';
          g.fillRect(Math.round(x) - 1, Math.round(y), 1, 1);
        }
      }
      // The crater: glowing, a thread of smoke before; then the column of
      // fire, and the fountain of it falling back.
      const cg = 0.4 + 0.6 * clamp01(t / ERUPT_BLAST) + 0.2 * Math.sin(t * 9);
      g.fillStyle = `rgba(255,${Math.round(120 + 60 * cg)},50,${(0.5 + 0.5 * cg).toFixed(2)})`;
      g.fillRect(peak.x - 7, peak.y - 1, 14, 2);
      if (t < ERUPT_BLAST) {
        for (let i = 0; i < 8; i++) {
          const k = (t * 0.4 + i / 8) % 1;
          g.globalAlpha = 0.5 * (1 - k);
          g.fillStyle = '#4a3a3a';
          const rr = 1 + Math.round(k * 4);
          g.fillRect(Math.round(peak.x + Math.sin(i * 2 + t) * 2 + k * 12), Math.round(peak.y - 2 - k * 30), rr, rr);
        }
        g.globalAlpha = 1;
      }
      if (blast > 0) {
        const hgt = 14 + 46 * ease(blast) * (1 - 0.45 * after);
        const grad = g.createLinearGradient(0, peak.y - hgt, 0, peak.y);
        grad.addColorStop(0, 'rgba(255,200,80,0)');
        grad.addColorStop(0.35, 'rgba(255,150,40,0.85)');
        grad.addColorStop(1, 'rgba(255,248,200,1)');
        g.fillStyle = grad;
        g.beginPath();
        g.moveTo(peak.x - 5, peak.y + 1);
        g.lineTo(peak.x - 9 - 6 * blast, peak.y - hgt);
        g.lineTo(peak.x + 9 + 6 * blast, peak.y - hgt);
        g.lineTo(peak.x + 5, peak.y + 1);
        g.fill();
        // (The fountain: gobs of it thrown up, falling back on the slopes.)
        for (const s of sparks) {
          const k = (t * 0.7 + s.ph) % 1;
          const x = peak.x + s.vx * k * 1.6;
          const y = peak.y + s.vy * k + 60 * k * k;
          if (y > art.ground) continue;
          g.fillStyle = k < 0.4 ? '#fff4b0' : k < 0.7 ? '#ffb040' : '#e05a20';
          g.fillRect(Math.round(x), Math.round(y), 1, 1);
        }
      }
      // The ash cloud boiling up off it: billows dark above, lit red from
      // under, spreading as they rise.
      for (const q of plume) {
        const k = (t - q.t0) / 4.5;
        if (k <= 0) continue;
        const kk = Math.min(1, k);
        const x = peak.x + q.dx + q.drift * kk * (1 + k * 0.5);
        const y = peak.y - 6 - q.rise * kk * 1.8 - k * 4;
        const rr = q.size * (0.6 + kk * 1.6 + Math.max(0, k - 1) * 0.5);
        const gr = Math.round(30 + q.shade * 30);
        g.globalAlpha = fade * Math.min(0.95, 0.55 + kk * 0.4);
        g.fillStyle = `rgb(${gr + 8},${gr},${gr})`;
        g.beginPath();
        g.ellipse(x, y, rr, rr * 0.75, 0, 0, Math.PI * 2);
        g.fill();
        // (Its top a shade lighter, its underside red with the fire.)
        g.fillStyle = `rgb(${gr + 28},${gr + 20},${gr + 20})`;
        g.beginPath();
        g.ellipse(x - rr * 0.2, y - rr * 0.3, rr * 0.6, rr * 0.4, 0, 0, Math.PI * 2);
        g.fill();
        if (kk < 0.8) {
          g.globalAlpha = fade * (0.8 - kk);
          g.fillStyle = '#ff6a24';
          g.beginPath();
          g.ellipse(x, y + rr * 0.45, rr * 0.7, rr * 0.25, 0, 0, Math.PI * 2);
          g.fill();
        }
      }
      g.globalAlpha = 1;
      // Lightning crawling in the ash.
      if (blast > 0 && after > 0.05 && Math.floor(t * 6) % 7 === 0) {
        g.strokeStyle = '#e8e0ff';
        g.lineWidth = 1;
        g.beginPath();
        let lx = peak.x + Math.sin(t * 13) * 20;
        let ly = peak.y - 30 - (t * 37 % 20);
        g.moveTo(lx, ly);
        for (let i = 0; i < 6; i++) {
          lx += Math.sin(t * 50 + i * 3) * 5;
          ly += 3 + Math.cos(t * 40 + i) * 2;
          g.lineTo(lx, ly);
        }
        g.stroke();
      }
      // Rock thrown high, raining back down (burning, trailing smoke).
      for (const q of rocks) {
        const k = t - q.t0;
        if (k <= 0 || k > 3.4) continue;
        const x = peak.x + q.vx * k;
        const y = peak.y + q.vy * k + 32 * k * k;
        if (y > art.ground + 6) continue;
        g.globalAlpha = 0.4;
        g.fillStyle = '#3a3030';
        g.fillRect(Math.round(x - q.vx * 0.06), Math.round(y - (q.vy + 64 * k) * 0.06), 1, 1);
        g.globalAlpha = 1;
        g.fillStyle = q.hot > 0.5 ? (Math.floor((t + q.hot) * 8) % 2 ? '#ffd070' : '#ff7a30') : '#2a2020';
        g.fillRect(Math.round(x), Math.round(y), q.size, q.size);
      }
      // In front: the beach and those on it (or the scorched ground under
      // the mountain), the fire's light on them.
      g.drawImage(art.front, 0, 0);
      drawWatchers(g, art, t, after);
      if (glow > 0.3) {
        g.save();
        g.globalCompositeOperation = 'lighter';
        g.fillStyle = `rgba(255,110,50,${((glow - 0.3) * 0.18).toFixed(3)})`;
        g.fillRect(0, art.here ? art.ground : 120, PW, PH);
        g.restore();
      }
      // (Ash falling, after, on Kharos: grey flecks across the whole view;
      // from across the sea, embers drifting.)
      if (after > 0) {
        g.globalAlpha = 0.75 * after;
        g.fillStyle = here ? '#8a8480' : '#ff9a50';
        for (let k = 0; k < (here ? 50 : 14); k++) {
          const ax = (k * 53 + t * 8 * (1 + (k % 3))) % PW;
          const ay = (k * 31 + t * (12 + (k % 5) * 4)) % PH;
          g.fillRect(Math.round(ax), Math.round(ay), 1, 1);
        }
        g.globalAlpha = 1;
      }
      // The blast's flash.
      if (t >= ERUPT_BLAST && t < ERUPT_BLAST + 0.8) {
        g.globalAlpha = 0.7 * (1 - (t - ERUPT_BLAST) / 0.8);
        g.fillStyle = '#fff0d0';
        g.fillRect(0, 0, PW, PH);
        g.globalAlpha = 1;
      }
      // To the screen, twice the size.
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      ctx.globalAlpha = fade;
      ctx.drawImage(buf, 0, 0, PW, PH, -4, -4, VIEW_W + 8, VIEW_H + 8);
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
