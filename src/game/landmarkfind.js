// (Round 79) Landmarks found (see world/landmarks.js): come within sight
// of one and it's yours to know, named on the map from then on (for
// everyone in the world: it's a pin, see Overworld.pin), and the stories
// hear of it (see sim/saga/motifs/landmarks.js).
import { landmarksIn, LANDMARK_KINDS } from '../world/landmarks.js';
import { pidOf } from '../sim/saga/refs.js';

export const LANDMARK_GLYPH = '♦';

// Mark a landmark known (found, or told of): on the map. True if new.
export function knowLandmark(game, lm, how = 'found', pid = null) {
  const found = (game.landmarksFound ||= {});
  if (found[lm.id] && (found[lm.id].how === 'found' || how !== 'found')) return false;
  found[lm.id] = { day: game.day, how, by: pid };
  game.world.ow.pin(lm.x, lm.z, lm.name, LANDMARK_GLYPH, { landmark: lm.id, kind: lm.kind });
  return true;
}

export function landmarkTick(game, dt) {
  if (!game.world || !game.world.terrain || !game.world.terrain.forms) return;
  game.lmT = (game.lmT ?? 1) - dt;
  if (game.lmT > 0) return;
  game.lmT = 1;
  const ow = game.world.ow;
  for (const p of game.everyone()) {
    if (!p || p.dead || p.limbo) continue;
    for (const lm of landmarksIn(ow, p.x - 40, p.z - 40, p.x + 40, p.z + 40)) {
      const f = game.landmarksFound && game.landmarksFound[lm.id];
      if (f && f.how === 'found') continue;
      if (Math.hypot(p.x - lm.x, p.z - lm.z) > lm.r + 14) continue;
      const pid = pidOf(p);
      knowLandmark(game, lm, 'found', pid);
      game.asPlayer(p, () => {
        game.ui.msg(`You've come upon ${lm.name}: ${LANDMARK_KINDS[lm.kind].word}. (On your map now.)`, '#ffe8a0');
        game.audio?.play('fanfare');
      });
      game.stats.landmarks = (game.stats.landmarks || 0) + 1;
      game.sim.saga?.emit('landmark_found', { lm: { id: lm.id, kind: lm.kind, name: lm.name, x: lm.x, z: lm.z, secret: lm.secret ? { ...lm.secret } : null }, pid });
    }
  }
}
