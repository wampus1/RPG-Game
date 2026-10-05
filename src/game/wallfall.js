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
import { VIEW_W, VIEW_H } from '../config.js';
import { paintWallScene, project, drawBanks, drawBolt, drawSunlight } from '../render/art_wall.js';
import { drawText, textWidth } from '../render/font.js';

const ease = (k) => k * k * (3 - 2 * k);
const clamp01 = (k) => Math.max(0, Math.min(1, k));
// (Painted at half size, each pixel two on the screen.)
const PW = VIEW_W / 2;
const PH = VIEW_H / 2;

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

// The scene: the islands from high over the sea, the ring of storm round
// them (painted: see render/art_wall.js).
export function wallFall(game) {
  const ow = game.world.ow;
  const spires = (game.world.sites || []).filter((s) => s.type === 'kavorent');
  let art = null;
  let buf = null;
  return {
    kind: 'wall', t: 0, dur: 15, lock: true,
    DARK_AT: [0.6, 1.5, 2.4], BREAK_AT: 7.6,
    get mood() {
      return this.t < this.BREAK_AT ? 'cs_wall' : 'cs_wall_free';
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
      if (!art) art = paintWallScene(ow, 4111);
      if (!buf) {
        buf = document.createElement('canvas');
        buf.width = PW;
        buf.height = PH;
      }
      const g = buf.getContext('2d');
      g.imageSmoothingEnabled = false;
      g.globalAlpha = 1;
      g.globalCompositeOperation = 'source-over';
      // In from black, and back out to the world at the end.
      const vin = clamp01(t / 1.0);
      const vout = clamp01((this.dur - t) / 1.2);
      const clear = ease(clamp01((t - this.BREAK_AT) / 3));
      const brk = ease(clamp01((t - this.BREAK_AT) / 3.4));
      const shake = t < this.BREAK_AT ? clamp01((t - 3.6) / 4) : 0;
      // The sea (storm-dark, clearing), the far side of the Wall behind
      // the islands, the islands and their shallows, the near side of the
      // Wall in front of them.
      g.drawImage(art.seaDark, 0, 0);
      if (clear > 0) {
        g.globalAlpha = clear;
        g.drawImage(art.seaClear, 0, 0);
        g.globalAlpha = 1;
      }
      const opts = { t, brk, flash: this.bolt || 0, boltAng: this.boltAng || 0, shake };
      drawBanks(g, art, { ...opts, far: true });
      g.drawImage(art.shallows, 0, 0);
      g.drawImage(art.land, 0, 0);
      // The spires: a beam of light up from each into the sky, going out
      // one after another (a ring of it running out over the sea from each
      // as it dies).
      spires.forEach((s, i) => {
        const p = project(s.cx + 0.5, s.cz + 0.5);
        const lit = t < this.DARK_AT[i] ? 1 : Math.max(0, 1 - (t - this.DARK_AT[i]) * 2);
        const pulse = 0.65 + 0.35 * Math.sin(t * 6 + i);
        if (lit > 0) {
          g.save();
          g.globalCompositeOperation = 'lighter';
          const bg = g.createLinearGradient(0, 0, 0, p.y);
          bg.addColorStop(0, 'rgba(90,216,240,0)');
          bg.addColorStop(1, `rgba(120,230,255,${(0.75 * lit * pulse).toFixed(3)})`);
          g.fillStyle = bg;
          g.fillRect(Math.round(p.x) - 1, 0, 3, Math.round(p.y));
          g.fillStyle = `rgba(230,250,255,${(lit * pulse).toFixed(3)})`;
          g.fillRect(Math.round(p.x), 0, 1, Math.round(p.y));
          g.restore();
        }
        const k = (t - this.DARK_AT[i]) / 2.2;
        if (k > 0 && k < 1) {
          g.globalAlpha = (1 - k) * 0.7;
          g.strokeStyle = '#a0e8ff';
          g.lineWidth = 1;
          g.beginPath();
          g.ellipse(p.x, p.y, 4 + k * 120, 2 + k * 50, 0, 0, Math.PI * 2);
          g.stroke();
          g.globalAlpha = 1;
        }
        g.fillStyle = '#1a1a2a';
        g.fillRect(Math.round(p.x) - 1, Math.round(p.y) - 2, 3, 3);
      });
      drawBanks(g, art, { ...opts, far: false });
      if ((this.bolt || 0) > 0.3 && t < this.BREAK_AT) drawBolt(g, this.boltAng || 0, this.bolt, t);
      // After: the sun breaking through.
      drawSunlight(g, art, t, clear);
      // The break: a white flash.
      if (t >= this.BREAK_AT && t < this.BREAK_AT + 1.2) {
        g.globalAlpha = 0.6 * (1 - (t - this.BREAK_AT) / 1.2);
        g.fillStyle = '#ffffff';
        g.fillRect(0, 0, PW, PH);
        g.globalAlpha = 1;
      }
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      ctx.globalAlpha = Math.min(vin, vout);
      ctx.drawImage(buf, 0, 0, PW, PH, -4, -4, VIEW_W + 8, VIEW_H + 8);
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
