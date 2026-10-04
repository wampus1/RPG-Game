// The storm each of the Kavorent's spires keeps about it, as long as it
// stands (its master unbeaten): cloud low over it, rain the whole while,
// thunder, and every so often lightning, mostly into the spire itself,
// now and then into the ground round it (and whoever's standing there).
// A small one, of what the wall round the islands is (see stormsea.js);
// gone with the spire's master.
import { WORLD_Y } from '../config.js';

// How far it reaches: thick within INNER paces of the spire, nothing past
// OUTER.
export const SPIRE_STORM = { inner: 12, outer: 34 };

// The spires whose storms are up (their masters not yet beaten).
export function liveSpires(game) {
  const sites = (game.world && game.world.sites) || [];
  return sites.filter((s) => s.type === 'kavorent' && s.x !== undefined && !(s.state && s.state.beaten));
}

// The storm's strength at (x, z): 0 out of reach of any, 1 under one.
export function spireStormAt(game, x, z) {
  let best = 0;
  for (const s of liveSpires(game)) {
    const d = Math.hypot(x - s.x, z - s.z);
    if (d >= SPIRE_STORM.outer) continue;
    const k = d <= SPIRE_STORM.inner ? 1 : 1 - (d - SPIRE_STORM.inner) / (SPIRE_STORM.outer - SPIRE_STORM.inner);
    best = Math.max(best, k * k * (3 - 2 * k));
  }
  return best;
}

// Each frame: how deep in one you are (eased, for the sky and the rain:
// see game.updateWeather and stormsea.js), and its lightning.
export function updateSpireStorm(game, dt) {
  const p = game.player;
  if (!p || game.dungeon || game.cutscene) {
    game.spireStorm = 0;
    return;
  }
  const raw = spireStormAt(game, p.x, p.z);
  game.spireStorm = (game.spireStorm || 0) + (raw - (game.spireStorm || 0)) * Math.min(1, dt * 1.5);
  if (game.spireStorm < 0.2) return;
  game.spireBoltT = (game.spireBoltT ?? 2 + Math.random() * 3) - dt;
  if (game.spireBoltT > 0) return;
  game.spireBoltT = 3.5 + Math.random() * 6;
  const s = liveSpires(game).reduce((b, q) => (!b || Math.hypot(q.x - p.x, q.z - p.z) < Math.hypot(b.x - p.x, b.z - p.z) ? q : b), null);
  if (s) strike(game, s);
}

// A bolt: into the spire (most of the time), or the ground round it.
export function strike(game, s, at = null) {
  const r = game.renderer;
  const intoSpire = !at && Math.random() < 0.6;
  let x = s.x;
  let z = s.z;
  if (at) {
    x = at.x;
    z = at.z;
  } else if (!intoSpire) {
    const a = Math.random() * Math.PI * 2;
    const d = 5 + Math.random() * 14;
    x = Math.round(s.x + Math.cos(a) * d);
    z = Math.round(s.z + Math.sin(a) * d);
  }
  const y = intoSpire ? WORLD_Y - 1 : Math.max(0, game.world.findStandY ? game.world.findStandY(x, z, s.h + 1) : s.h + 1);
  r.effect?.({ type: 'bolt', from: 'sky', wx: x, wy: y, wz: z, tx: x, ty: y, tz: z, life: 0.45, oy: -4 });
  r.emit(x, y + 0.3, z, { n: 18, color: ['#ffffff', '#fff8a0', '#c8e0ff'], up: 50, speed: 60, gravity: 140, life: 0.6, glow: true });
  r.flashScreen?.('#e8f0ff', 0.14);
  game.audio?.play('thunder', { x, z });
  if (intoSpire) {
    // (Down the spire's seams, a moment.)
    for (let k = 0; k < 6; k++) r.emit(s.x + (Math.random() - 0.5) * 4, s.h + 2 + Math.random() * (WORLD_Y - s.h - 3), s.z + (Math.random() - 0.5) * 4, { n: 2, color: ['#ffffff', '#a0e8ff'], up: 10, speed: 30, life: 0.35, glow: true });
    return { x, z, spire: true };
  }
  game.shake = Math.min(1.2, (game.shake || 0) + 0.25);
  game.audio?.play('boom', { x, z });
  // Whoever's stood where it came down.
  for (const e of game.everyone ? game.everyone() : [game.player]) {
    if (!e || e.dead || Math.max(Math.abs(e.x - x), Math.abs(e.z - z)) > 1 || Math.abs(e.y - y) > 2) continue;
    game.damage(e, 4, null);
    r.floatText(e.x, e.y + 2.4, e.z, 'struck by lightning!', '#fff8a0');
  }
  return { x, z, spire: false };
}
