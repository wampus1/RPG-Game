// (Round 84) Storms (see world/weather.js), out in them: a thunderstorm's
// lightning coming down where it's seen, hail stinging whoever's out in
// it with nothing on their head, the wind gusting (heard, and seen in the
// trees and plants: see Renderer.windSway).
import { WORLD_Y } from '../config.js';
import { B, BLOCKS } from '../world/blocks.js';

const BOLT = ['#ffffff', '#e8f0ff', '#a8c8ff'];

// Under cover from the sky: a roof (or a tree) over them, or below a
// ship's decks.
export function underCover(game, e) {
  if (e.deck) return !!e.deck.below;
  const w = game.world;
  const x = Math.round(e.x);
  const z = Math.round(e.z);
  for (let y = Math.floor(e.y) + 2; y < WORLD_Y; y++) {
    const id = w.getBlock(x, y, z);
    const b = id && id !== B.air ? BLOCKS[id] : null;
    if (b && (b.solid || b.opaque)) return true;
  }
  return false;
}

// The top of the column at (x, z): where something standing there would
// stand (or the water's top).
function topOf(game, x, z) {
  const w = game.world;
  for (let y = WORLD_Y - 1; y > 0; y--) {
    const b = BLOCKS[w.getBlock(x, y - 1, z)];
    if (b && (b.solid || b.liquid)) return y;
  }
  return 1;
}

// Lightning, out of a thunderstorm, somewhere about you that's in sight:
// on the highest thing there. (True if it came down where it's seen;
// else just the flash and the thunder.)
export function stormBolt(game) {
  const p = game.player;
  const r = game.renderer;
  for (let tries = 0; tries < 8; tries++) {
    const a = Math.random() * Math.PI * 2;
    const d = 6 + Math.random() * 12;
    const x = Math.round(p.x + Math.cos(a) * d);
    const z = Math.round(p.z + Math.sin(a) * d * 0.7);
    if (game.world.regionAt && !game.world.regionAt(x, z)) continue;
    const y = topOf(game, x, z);
    r.effect?.({ type: 'bolt', from: 'sky', wx: x, wy: y, wz: z, tx: x, ty: y, tz: z, life: 0.45, oy: -4 });
    r.emit?.(x, y + 0.3, z, { n: 14, color: BOLT, up: 50, speed: 60, gravity: 140, life: 0.6, glow: true });
    r.emit?.(x, y + 0.5, z, { n: 4, color: ['#5a5a60', '#3a3a40'], up: 12, speed: 10, life: 1.4, shape: 'puff', grow: 2 });
    r.flashScreen?.('#e8f0ff', 0.16);
    game.audio?.play('thunder', { x, z });
    game.shake = Math.min(1, (game.shake || 0) + 0.15);
    return true;
  }
  r.flashScreen?.('#e8f0ff', 0.12);
  game.audio?.play('thunder');
  return false;
}

// Each frame, on each screen (the host's, a guest's): the wind's gusts
// heard, the hail rattling down, and a thunderstorm's lightning now and
// then, where it's seen. (Near the great storm round the islands, its own
// lightning: see Game.updateWeather.)
export function stormFx(game, dt) {
  const w = game.weather;
  if (!w || game.dungeon) return;
  const p = game.player;
  if (!p) return;
  if (w.severe === 'thunder' && (w.blow || 0) > 0.5 && !((w.storm || 0) > 0.45)) {
    game.stormBoltT = (game.stormBoltT ?? 5) - dt;
    if (game.stormBoltT <= 0) {
      game.stormBoltT = 6 + Math.random() * 14;
      if (Math.random() < 0.45) stormBolt(game);
      else {
        game.renderer?.flashScreen?.('#e8f0ff', 0.12);
        game.audio?.play('thunder');
      }
    }
  }
  if (!w.blow) return;
  const cover = underCover(game, p);
  game.gustT = (game.gustT ?? 2) - dt;
  if (game.gustT <= 0) {
    game.gustT = 2.5 + Math.random() * 5 * (1.3 - w.blow);
    if (w.blow > 0.3) game.audio?.play(cover ? 'wind_low' : 'gust');
  }
  if (w.severe === 'hail' && w.blow >= 0.5) {
    game.hailT = (game.hailT ?? 0.5) - dt;
    if (game.hailT <= 0) {
      game.hailT = 0.3 + Math.random() * 0.35;
      game.audio?.play(cover ? 'drip' : 'hail');
    }
  }
}

// Each frame, for each player (on the host): hail stinging whoever's out
// in it bare-headed.
export function stormTick(game, dt) {
  const w = game.weather;
  if (!w || !w.blow || game.dungeon) return;
  const p = game.player;
  if (!p || p.dead || w.severe !== 'hail' || w.blow < 0.5) return;
  if (p.sleeping || underCover(game, p)) {
    p.hailT = Math.max(p.hailT || 0, 4);
    return;
  }
  // (A sting now and then. Never past the last few hearts: it's hail, not
  // a hammer.)
  p.hailT = (p.hailT ?? 6) - dt;
  if (p.hailT > 0) return;
  p.hailT = 9 + Math.random() * 6;
  if (p.equip && p.equip.head) return;
  if (p.hp > 3) {
    game.damage(p, 1, null);
    if (!p.hailWarned || game.sim.abs - p.hailWarned > 120) {
      p.hailWarned = game.sim.abs;
      game.ui.msg('The hail stings! Get under a roof, or put something on your head.', '#c8e0ff');
    }
  }
}
