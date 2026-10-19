// (Round 130) A pirates' haven, from where you stand in it (see
// sim/havens.js and sim/brethren.js): the guild's flag on the square, the
// bills the realms have put out on the brethren, the Articles by the guild
// hall's door (the guild's council for whoever sits on it), and a sea chest
// dug up where a captain buried it.
import { GUILDS } from './pirates.js';
import { pidOf } from '../sim/saga/refs.js';

// The haven at (x, z), standing or burned, and its settlement.
function havenAt(game, x, z) {
  const s = game.world.ow.settlementAt(x, z);
  const H = game.sim && game.sim.havens;
  const h = s && H ? H.of(s.id) : null;
  return { s, h };
}

// One of the haven's own things, used: true if it was.
export function havenInteract(game, kind, x, y, z) {
  const { s, h } = havenAt(game, x, z);
  const G = h ? GUILDS[h.guild] || GUILDS[0] : null;
  switch (kind) {
    case 'haven': {
      if (!h) {
        game.ui.msg('A black flag on a mast, snapping in the wind.', '#c8c0b0');
        return true;
      }
      const B = game.sim.brethren;
      const lines = B ? B.flagLines(h, pidOf(game.player)) : [`The flag of ${G.name}.`];
      game.ui.openSign(lines, `THE FLAG OF ${G.name.toUpperCase()}`);
      return true;
    }
    case 'havenbills': {
      const B = game.sim.brethren;
      const lines = B ? B.billsLines(h, pidOf(game.player)) : ['Wanted notices, nailed up and torn.'];
      game.ui.openSign(lines, 'WANTED');
      return true;
    }
    case 'articles': {
      const B = game.sim.brethren;
      if (B && h) B.openArticles(h, game.player);
      else game.ui.openSign(['The Articles of the brethren, nailed to the board.', 'The writing has run in the rain.'], 'THE ARTICLES');
      return true;
    }
    case 'seachest': {
      const B = game.sim.brethren;
      if (B) B.openChest(x, y, z, game.player);
      return true;
    }
  }
  void s;
  return false;
}
