// (Round 86) Her anchor, on its cable round the capstan. Let go, it runs
// out in a moment, by anyone's hand; weighed, it's hauled up turn by turn,
// by whoever's at the capstan bars: the bigger she is, the more hands it
// wants to come up in good time (one alone gets it up on a galleon, but
// slowly). Her crew come to help when it's being weighed. (A ship without
// a capstan, a small one, has hers up by hand at once.)
import { B } from '../world/blocks.js';

// How many hands she wants at the bars, and how long it takes them.
export const WEIGH = { sloop: { hands: 1, secs: 5 }, brigantine: { hands: 2, secs: 10 }, galleon: { hands: 4, secs: 18 }, frigate: { hands: 3, secs: 14 } };
const weighOf = (S) => WEIGH[S.type] || { hands: 2, secs: 10 };

export function capstanOf(S) {
  return (S.m.deckProps || []).find((q) => q.id === B.capstan && S.vox[(q.y * S.m.L + q.z) * S.m.W + q.x] === B.capstan) || null;
}

// Those on her at the capstan bars: within a step of it, on its deck.
export function capstanHands(game, S) {
  const cap = capstanOf(S);
  if (!cap) return [];
  const out = [];
  const near = (e) => e && !e.dead && e.deck && e.deck.s === S.id && !e.deck.role && Math.max(Math.abs(e.deck.cx - cap.x), Math.abs(e.deck.cz - cap.z)) <= 1 && Math.abs(e.deck.y - cap.y) <= 1;
  for (const q of game.everyone ? game.everyone() : [game.player]) if (near(q)) out.push(q);
  for (const c of game.sailors || []) if (near(c)) out.push(c);
  return out;
}

const tell = (game, S, text, color = '#a0d8ff') => {
  for (const q of game.everyone ? game.everyone() : [game.player]) {
    if (!q || !q.deck || q.deck.s !== S.id) continue;
    if (game.asPlayer) game.asPlayer(q, () => game.ui.msg(text, color, true));
    else game.ui.msg(text, color, true);
  }
};

// Let go: the cable runs out.
export function letGo(game, S) {
  S.anchor = true;
  S.weigh = null;
  S.sailGoal = 0;
  tell(game, S, 'Let go the anchor! The cable runs out.');
  game.audio?.play('chain');
}

// Begin weighing her anchor (at the capstan, or ordered from the helm).
export function startWeigh(game, S, by = null) {
  if (!S.anchor) return false;
  const cap = capstanOf(S);
  if (!cap) {
    S.anchor = false;
    tell(game, S, 'The anchor\'s hauled up hand over hand. Aweigh!');
    game.audio?.play('select');
    return true;
  }
  const W = weighOf(S);
  if (!S.weigh) S.weigh = { k: 0, idle: 0, clank: 0 };
  tell(game, S, `Weigh anchor! Man the capstan: she wants ${W.hands} hand${W.hands > 1 ? 's' : ''} at the bars to bring it up in good time.`);
  void by;
  return true;
}

// Each frame: the capstan turned by whoever's at it.
export function weighTick(game, S, dt) {
  const w = S.weigh;
  if (!w) return;
  if (!S.anchor || S.sinking) {
    S.weigh = null;
    return;
  }
  const hands = capstanHands(game, S).length;
  if (!hands) {
    w.idle += dt;
    // (Left too long: given up, the cable held where it is.)
    if (w.idle > 45) {
      S.weigh = null;
      tell(game, S, 'Nobody at the capstan: the anchor stays down.', '#c8c8c8');
    }
    return;
  }
  w.idle = 0;
  const W = weighOf(S);
  // (More than she wants helps a little; fewer, slowly.)
  w.k += (dt * Math.min(hands, W.hands * 1.5)) / (W.secs * W.hands);
  w.clank -= dt;
  if (w.clank <= 0) {
    w.clank = 0.7 / Math.min(2, hands / W.hands + 0.4);
    game.audio?.play('chain');
  }
  if (w.k >= 1) {
    S.anchor = false;
    S.weigh = null;
    tell(game, S, 'The anchor\'s aweigh! She\'s free to sail.');
    game.audio?.play('select');
  }
}

// How far up it is (0 to 1), for the helm's readout.
export const weighed = (S) => (S.weigh ? Math.min(1, S.weigh.k) : null);
