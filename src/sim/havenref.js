// (Round 130) A pirates' haven, as everything else sees one (see
// havens.js): a village of the map's like any other, but hidden from the
// realms and from you until it's found or heard of, and kept out of the
// ordinary business between towns (the coaches, the caravans, the realms'
// oaths and quarrels, the stories that send you off to a town).
import { pidOf } from './saga/refs.js';

// A haven, standing (not one burned out by a realm).
export function isHaven(s) {
  return !!(s && s.haven && !s.haven.razed);
}

// What the player playing here (or `pid`) knows of haven `s`: 'seen',
// 'heard' or false. (Anywhere that isn't a haven: known as it ever was.)
export function knowsHaven(game, s, pid = null) {
  if (!s || !s.haven) return 'seen';
  if (game.revealMap) return 'seen';
  // (Someone else's world, seen from here: the host says what we know.)
  if (game.remote) return (game.havenKnown && game.havenKnown[s.id]) || false;
  const H = game.sim && game.sim.havens;
  if (!H) return false;
  return H.knows(s.id, pid ?? pidOf(game.player));
}

// Hidden from whoever's playing here: a haven they've not found or heard of.
export function hiddenHaven(game, s, pid = null) {
  return !!(s && s.haven && !knowsHaven(game, s, pid));
}

// A town of the ordinary world (for the coaches, the caravans, a story's
// errand, a realm's reckoning): any but a standing haven.
export const lawful = (s) => !isHaven(s);
