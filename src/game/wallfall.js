// The storm wall round the Dagoni Islands, held up by the Kavorent's three
// spires (the facility on Thessa that oversees the work, the thermal spire
// in Kharos's crater that powers it, the tidal spire on Myrrow that feeds
// it the sea): beat the master of all three, and when you come up out of
// the last of them, it falls. A scene of it, seen from high over the
// islands: the spires' lights going out one by one, the wall faltering
// (its lightning stuttering, gaps tearing in it), and then the whole ring
// of cloud blown outward and gone, open sky and open sea behind it. After
// it the sea's open: no storm to darken the sky out there, nothing to
// stop a raft (see worldgen.stormAt).
import { VIEW_W, VIEW_H, MAP_W, MAP_H, REGION_W, REGION_D } from '../config.js';
import { STORM } from '../world/geography.js';
import { drawText, textWidth } from '../render/font.js';

const ease = (k) => k * k * (3 - 2 * k);
const clamp01 = (k) => Math.max(0, Math.min(1, k));

// Every spire's master beaten?
export function allSpiresBeaten(game) {
  const spires = ((game.world && game.world.sites) || []).filter((s) => s.type === 'kavorent');
  return spires.length > 0 && spires.every((s) => s.state && s.state.beaten);
}

// Down it comes (for good: saved with the world, and sent to everyone
// playing with the rest of the world's state: see net/host.js).
export function bringWallDown(game) {
  const ow = game.world.ow;
  if (ow.wallDown) return false;
  ow.wallDown = true;
  game.wallDown = true;
  if (game.stormSea) Object.assign(game.stormSea, { depth: 0, near: 0, dark: 0, red: 0, cloud: 0 });
  return true;
}

// Coming up out of a spire: if it was the last, the wall's scene (for
// everyone playing, each on their own screen).
export function maybeWallFalls(game) {
  if (game.world.ow.wallDown || !allSpiresBeaten(game)) return false;
  const all = game.everyone ? game.everyone() : [game.player];
  if (game.asPlayer && all.length > 1) for (const q of all) game.asPlayer(q, () => (game.wallPending = true));
  else game.wallPending = true;
  return true;
}

// Each frame (after any other scene's done): start it.
export function wallTick(game) {
  if (!game.wallPending || game.scene || game.dungeon) return;
  game.wallPending = false;
  game.scene = wallFall(game);
}

const LINES = [
  [0, 3.6, 'The last of the three spires goes dark.'],
  [3.6, 7.4, 'Out at sea, the storm that has walled in the islands for an age falters...'],
  [7.4, 11.6, '...and breaks. The wind drops. The sky over the sea stands open.'],
  [11.6, 14.5, 'For the first time in living memory, the way off the islands is clear.'],
];

// The scene: the islands from high above, the ring of storm round them.
export function wallFall(game) {
  const ow = game.world.ow;
  const spires = (game.world.sites || []).filter((s) => s.type === 'kavorent');
  // (The view: the ring and all inside it, to fit the screen.)
  const span = STORM.rx + STORM.band + 4;
  const spanZ = STORM.rz + STORM.band + 4;
  const scale = Math.min((VIEW_W - 16) / (span * 2), (VIEW_H - 50) / (spanZ * 2));
  const ox = VIEW_W / 2 - STORM.cx * scale;
  const oy = VIEW_H / 2 - 6 - STORM.cz * scale;
  const toScreen = (cx, cz) => ({ x: ox + (cx + 0.5) * scale, y: oy + (cz + 0.5) * scale });
  let land = null;
  const puffs = [];
  let seed = 4111;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 260; i++) puffs.push({ a: rnd() * Math.PI * 2, off: -0.4 + rnd() * 1.6, size: 1.2 + rnd() * 2.2, spin: (rnd() < 0.5 ? -1 : 1) * (0.01 + rnd() * 0.02), shade: rnd(), out: 0.6 + rnd() * 1.4, ph: rnd() * 6 });
  return {
    kind: 'wall', t: 0, dur: 15, lock: true,
    DARK_AT: [0.6, 1.5, 2.4], BREAK_AT: 7.6,
    get mood() {
      return this.t < this.BREAK_AT ? 'spire_swell' : 'spire_open';
    },
    update(g, dt) {
      if (!this.started) {
        this.started = true;
        g.audio?.play('drone');
        g.ui.msg('Far out at sea, something gives way...', '#c8e0ff');
      }
      this.bolt = Math.max(0, (this.bolt || 0) - dt * 3);
      // The wall faltering: thunder, flickers, the ground trembling.
      if (this.t < this.BREAK_AT) {
        this.boltT = (this.boltT ?? 0.6) - dt;
        if (this.boltT <= 0) {
          this.boltT = this.t > 4 ? 0.25 + Math.random() * 0.35 : 0.8 + Math.random() * 0.8;
          this.bolt = 1;
          this.boltAng = Math.random() * Math.PI * 2;
          if (this.t > 3) g.audio?.play('thunder');
        }
        g.shake = Math.max(g.shake || 0, 0.06 + 0.2 * clamp01((this.t - 4) / 3.6));
      }
      if (this.t >= this.BREAK_AT && !this.broke) {
        this.broke = true;
        bringWallDown(g);
        g.renderer.flashScreen?.('#ffffff', 0.8);
        g.shake = 1.4;
        g.audio?.play('boom');
        g.audio?.play('thunder');
        g.audio?.play('fanfare');
      }
    },
    end(g) {
      bringWallDown(g);
      g.ui.msg('The storm wall round the Dagoni Islands is gone. A raft can sail out past where it stood.', '#c8e0ff', true);
    },
    draw(ctx) {
      const t = this.t;
      // In from black, and back out to the world at the end.
      const vin = clamp01(t / 1.0);
      const vout = clamp01((this.dur - t) / 1.2);
      ctx.save();
      ctx.globalAlpha = Math.min(vin, vout);
      // The sea: darker under the storm, clearing as it goes.
      const clear = ease(clamp01((t - this.BREAK_AT) / 3));
      ctx.fillStyle = clear > 0 ? `rgb(${Math.round(14 + clear * 18)},${Math.round(26 + clear * 40)},${Math.round(44 + clear * 50)})` : '#0e1a2c';
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      // The islands (and the far lands at the edges), drawn once.
      if (land === null) land = drawLand(ow, scale, toScreen);
      if (land) ctx.drawImage(land, 0, 0);
      // The spires: a light each, going out one after another.
      spires.forEach((s, i) => {
        const p = toScreen(s.cx, s.cz);
        const lit = t < this.DARK_AT[i] ? 1 : Math.max(0, 1 - (t - this.DARK_AT[i]) * 2);
        const pulse = 0.6 + 0.4 * Math.sin(t * 6 + i);
        if (lit > 0) {
          ctx.globalAlpha = Math.min(vin, vout) * lit * pulse;
          ctx.fillStyle = '#5ad8f0';
          ctx.fillRect(Math.round(p.x) - 1, Math.round(p.y) - 6, 2, 6);
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(Math.round(p.x) - 1, Math.round(p.y) - 7, 2, 2);
        }
        // (A ring of light going out from each as it dies, toward the wall.)
        const k = (t - this.DARK_AT[i]) / 2.2;
        if (k > 0 && k < 1) {
          ctx.globalAlpha = Math.min(vin, vout) * (1 - k) * 0.7;
          ctx.strokeStyle = '#a0e8ff';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.ellipse(p.x, p.y, 4 + k * STORM.rx * scale * 0.9, 3 + k * STORM.rz * scale * 0.9, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.globalAlpha = Math.min(vin, vout);
        ctx.fillStyle = '#1a1a2a';
        ctx.fillRect(Math.round(p.x) - 1, Math.round(p.y) - 1, 3, 2);
      });
      // The wall: banks of cloud round the ring, churning; breaking, they
      // scatter outward and thin to nothing.
      const c0 = toScreen(STORM.cx, STORM.cz);
      const rx = STORM.rx * scale;
      const ry = STORM.rz * scale;
      const bw = STORM.band * scale;
      const brk = ease(clamp01((t - this.BREAK_AT) / 3.4));
      const shake = t < this.BREAK_AT ? clamp01((t - 3.6) / 4) : 0;
      for (const q of puffs) {
        const ang = q.a + t * q.spin * (1 + shake * 3);
        const off = q.off + brk * q.out * 3;
        const x = c0.x + Math.cos(ang) * (rx + bw * off) + (shake ? Math.sin(t * 30 + q.ph) * shake * 1.5 : 0);
        const y = c0.y + Math.sin(ang) * (ry + bw * off * (ry / rx));
        const r = q.size * scale * (1 + brk * 0.8);
        const a = (0.85 - brk * 0.85) * (shake > 0.5 && Math.sin(q.ph + t * 4) > 0.7 ? 0.4 : 1);
        if (a <= 0.01) continue;
        ctx.globalAlpha = Math.min(vin, vout) * a;
        const g = Math.round(30 + q.shade * 40 + (this.bolt > 0 && Math.abs(Math.atan2(Math.sin(ang - (this.boltAng || 0)), Math.cos(ang - (this.boltAng || 0)))) < 0.4 ? this.bolt * 120 : 0));
        ctx.fillStyle = `rgb(${g},${g + 4},${g + 14})`;
        ctx.beginPath();
        ctx.ellipse(x, y, r, r * 0.75, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      // A bolt through it, now and then (more and more, as it fails).
      if (this.bolt > 0 && t < this.BREAK_AT) {
        const a0 = this.boltAng || 0;
        ctx.globalAlpha = Math.min(vin, vout) * this.bolt;
        ctx.strokeStyle = '#f0f4ff';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let k = 0; k <= 6; k++) {
          const off = -0.4 + k * 0.3;
          const ang = a0 + (Math.sin(k * 7.1 + a0 * 13) * 0.02);
          const x = c0.x + Math.cos(ang) * (rx + bw * off);
          const y = c0.y + Math.sin(ang) * (ry + bw * off * (ry / rx));
          if (k) ctx.lineTo(x, y);
          else ctx.moveTo(x, y);
        }
        ctx.stroke();
      }
      // The break: a white flash, then light spreading out over the sea.
      if (t >= this.BREAK_AT && t < this.BREAK_AT + 1.2) {
        ctx.globalAlpha = Math.min(vin, vout) * 0.6 * (1 - (t - this.BREAK_AT) / 1.2);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      }
      ctx.globalAlpha = 1;
      ctx.restore();
      // Bars, and the words.
      const h = Math.round(24 * Math.min(ease(clamp01(t / 0.6)), ease(clamp01((this.dur - t) / 0.6))));
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, VIEW_W, h);
      ctx.fillRect(0, VIEW_H - h, VIEW_W, h);
      const line = LINES.find(([a, b]) => t >= a && t < b);
      if (line && h > 16) {
        const k = Math.min(clamp01((t - line[0]) / 0.5), clamp01((line[1] - t) / 0.5));
        ctx.globalAlpha = k;
        drawText(ctx, line[2], Math.round(VIEW_W / 2 - textWidth(line[2]) / 2), VIEW_H - h + 9, '#e0ecff', '#000');
        ctx.globalAlpha = 1;
      }
    },
  };
}

// The land from high above, a pixel or so a square: the islands in their
// colours, the far lands beyond in the old charts' tan.
function drawLand(ow, scale, toScreen) {
  if (typeof document === 'undefined') return false;
  const c = document.createElement('canvas');
  c.width = VIEW_W;
  c.height = VIEW_H;
  const g = c.getContext('2d');
  const s = Math.max(1, Math.ceil(scale));
  const x0 = Math.max(0, Math.floor(STORM.cx - STORM.rx - STORM.band - 6));
  const x1 = Math.min(MAP_W - 1, Math.ceil(STORM.cx + STORM.rx + STORM.band + 6));
  const z0 = Math.max(0, Math.floor(STORM.cz - STORM.rz - STORM.band - 6));
  const z1 = Math.min(MAP_H - 1, Math.ceil(STORM.cz + STORM.rz + STORM.band + 6));
  for (let cz = z0; cz <= z1; cz++) {
    for (let cx = x0; cx <= x1; cx++) {
      const b = ow.mapBiome ? ow.mapBiome(cx, cz) : null;
      if (!b || b === 'ocean') continue;
      const p = toScreen(cx, cz);
      const inside = ow.insideStorm((cx + 0.5) * REGION_W, (cz + 0.5) * REGION_D);
      g.fillStyle = inside ? LAND[b] || '#5a7a4a' : '#7a6a50';
      g.fillRect(Math.round(p.x - s / 2), Math.round(p.y - s / 2), s, s);
    }
  }
  return c;
}
const LAND = {
  beach: '#c8b888', plains: '#6a9a4a', forest: '#3a6a3a', jungle: '#2a5a2a', taiga: '#3a5a4a', tundra: '#a8b0a8', desert: '#c8a868', savanna: '#a89a4a',
  mountain: '#7a7470', swamp: '#4a5a3a', ashland: '#5a5250', cinderwood: '#6a3a2a', geyser: '#8a8040', volcano: '#4a2a22', moor: '#5a5a4a', fungal: '#6a4a6a', mangrove: '#3a5a40',
};
