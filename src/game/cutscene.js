// How a new story opens, by where you come from (round 49: painted scenes
// for every origin, see intros.js and starfall.js, in place of the old
// openings played out in the world itself: the town building itself up
// under the camera, the ship's deck you could walk).
//
// While it plays the player is kept out of the world (Game.holdOut): in a
// world with others, nobody sees them, bumps into them or goes after them
// until it's over and they're set down where their story puts them
// (Game.placeIn). ENTER skips it.
import { introScene } from './intros.js';

// Start the opening for a new character (as them, in a world with others:
// see Game.addSeat). Returns the scene, or null if there's none (and then
// their first words are said at once).
export function startIntro(game) {
  const h = game.hero;
  if (!h) return null;
  let sc = null;
  try {
    sc = introScene(game);
  } catch (e) {
    console.error(e);
    sc = null;
  }
  if (!sc) {
    game.introduce();
    return null;
  }
  game.holdOut();
  game.scene = sc;
  return sc;
}
