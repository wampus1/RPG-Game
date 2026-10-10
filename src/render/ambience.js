// (Round 79) The feel of where you are, drawn over the land:
//   - Valley fog: down in low ground with higher land all round, morning
//     and evening (and on a foggy day anywhere low), mist lying in drifts.
//   - Ridge wind: up on high ground (a ridge, a mesa's top, a peak), the
//     wind streaming past, and its sound now and then.
//   - Heat shimmer: on sand and salt flats on a clear day, the air
//     wavering over the hot ground.
// Worked out from the land round the player once a second or so, and
// eased in and out, so it comes and goes as you walk.
const HOT = new Set(['desert', 'savanna', 'red_mesa', 'salt_flats', 'bone_strand', 'beach']);
let PUFF = null;

function puff() {
  if (PUFF || typeof document === 'undefined') return PUFF;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 4, 32, 32, 32);
  grd.addColorStop(0, 'rgba(225,232,240,0.9)');
  grd.addColorStop(0.6, 'rgba(225,232,240,0.45)');
  grd.addColorStop(1, 'rgba(225,232,240,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  PUFF = c;
  return c;
}

// How things stand where the player is: { fog, wind, heat } (0 to 1).
export function senseAmbience(game) {
  const p = game.player;
  const w = game.world;
  const T = w && w.terrain;
  if (!p || !T || (game.dungeon && w.inInstance && w.inInstance(p.x))) return { fog: 0, wind: 0, heat: 0 };
  let here = 0;
  let round = 0;
  let n = 0;
  let biome = null;
  try {
    const ctx = T.context(p.x - 20, p.z - 20, p.x + 20, p.z + 20);
    const c0 = T.column(p.x, p.z, ctx, {});
    here = c0.h;
    biome = c0.biome;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const c = T.column(Math.round(p.x + Math.cos(a) * 18), Math.round(p.z + Math.sin(a) * 18), ctx, {});
      if (c.water >= 0 && c.h < here) continue;
      round += c.h;
      n++;
    }
  } catch {
    return { fog: 0, wind: 0, heat: 0 };
  }
  const avg = n ? round / n : here;
  const m = game.minute || 0;
  const wk = game.weather && game.weather.kind;
  const dawnDusk = (m > 270 && m < 600) || (m > 1080 && m < 1290);
  const low = Math.max(0, Math.min(1, (avg - here - 0.8) / 2));
  const fog = low * (dawnDusk ? 1 : wk === 'fog' ? 0.8 : 0.25);
  const high = Math.max(0, Math.min(1, (here - avg - 1.2) / 2.5)) + (here >= 11 ? 0.5 : 0);
  const wind = Math.min(1, high) * (wk === 'rain' || wk === 'storm' ? 1 : 0.8);
  const day = m > 600 && m < 1020;
  const heat = HOT.has(biome) && day && (!wk || wk === 'clear') ? (m > 720 && m < 900 ? 1 : 0.6) : 0;
  return { fog, wind, heat };
}

// Drawn with the scene: `part` 'under' (fog and wind, under the night's
// dark) or 'over' (the shimmer, of everything drawn).
export function drawAmbience(r, game, dt, part) {
  const A = (r.ambience ||= { fog: 0, wind: 0, heat: 0, want: { fog: 0, wind: 0, heat: 0 }, t: 0, streaks: [], puffs: [], gust: 4 });
  if (part === 'under') {
    A.t -= dt;
    if (A.t <= 0) {
      A.t = 1;
      A.want = senseAmbience(game);
    }
    const k = Math.min(1, dt * 0.6);
    for (const q of ['fog', 'wind', 'heat']) A[q] += (A.want[q] - A[q]) * k;
  }
  if (r.hidden !== null && r.hidden !== undefined) return;
  const ctx = r.ctx;
  const W = r.vw;
  const H = r.vh;
  const time = r.time || 0;
  if (part === 'under') {
    if (A.fog > 0.03) {
      const img = puff();
      if (img) {
        if (A.puffs.length < 14) for (let i = A.puffs.length; i < 14; i++) A.puffs.push({ x: Math.random() * W, y: H * (0.3 + Math.random() * 0.7), s: 90 + Math.random() * 120, v: 4 + Math.random() * 8 });
        ctx.save();
        ctx.globalAlpha = Math.min(0.5, A.fog * 0.42);
        for (const q of A.puffs) {
          q.x += q.v * dt;
          if (q.x - q.s > W) {
            q.x = -q.s;
            q.y = H * (0.3 + Math.random() * 0.7);
          }
          ctx.drawImage(img, q.x - q.s, q.y - q.s * 0.35, q.s * 2, q.s * 0.7);
        }
        ctx.restore();
      }
    }
    if (A.wind > 0.05) {
      if (A.streaks.length < 36) for (let i = A.streaks.length; i < 36; i++) A.streaks.push({ x: Math.random() * W, y: Math.random() * H, l: 10 + Math.random() * 24, v: 160 + Math.random() * 160 });
      ctx.fillStyle = `rgba(235,240,250,${Math.min(0.35, A.wind * 0.3)})`;
      const n = Math.floor(36 * A.wind);
      for (let i = 0; i < n; i++) {
        const s = A.streaks[i];
        s.x += s.v * dt;
        s.y += Math.sin(time * 2 + i) * dt * 6;
        if (s.x > W + s.l) {
          s.x = -s.l;
          s.y = Math.random() * H;
        }
        ctx.fillRect(Math.round(s.x), Math.round(s.y), Math.round(s.l), 1);
      }
      A.gust -= dt;
      if (A.gust <= 0) {
        A.gust = 5 + Math.random() * 6;
        game.audio?.play('wind', null, null, { vol: 0.25 + A.wind * 0.35 });
      }
    }
  } else if (part === 'over' && A.heat > 0.05 && !r.noWeatherFx) {
    // (The air wavering: thin bands of the picture nudged side to side.)
    const amp = 1.4 * A.heat;
    const c = ctx.canvas;
    const top = Math.floor(H * 0.05);
    const bottom = Math.floor(H * 0.75);
    for (let y = top; y < bottom; y += 3) {
      const off = Math.round(Math.sin(time * 3.2 + y * 0.11) * amp * (0.4 + 0.6 * (1 - (y - top) / (bottom - top))));
      if (off) ctx.drawImage(c, 0, y, W, 3, off, y, W, 3);
    }
  }
}
