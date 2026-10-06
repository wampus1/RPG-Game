// The great ships and you (round 68): what your keys and mouse do aboard
// one, or beside one (see ships3d.js for the ships themselves). F at her
// wheel or a gun takes it (or lets it go); F beside her climbs aboard. A
// click at the wheel fires a broadside, at a gun fires it. Pointing at
// her: hold the button to knock a plank out (an axe does it quicker),
// right-click with planks to mend a hole.
import { BLOCKS } from '../world/blocks.js';
import { REACH } from '../config.js';
import { shipsOf, shipById, deckInteract, deckClick, boardAt, breakVoxel, mendWith, holeBeside, saveShips, loadShips, putAboard, deckSpotNear, MENDS, shipAtWorld } from './ships3d.js';
import { enterHold, holdShipAt, holdLocal } from './shiphold.js';
import { addItem } from './inventory.js';

// A key aboard (or beside) a ship: true if it was hers to handle.
export function shipKey(game, code) {
  const p = game.player;
  if (code === 'KeyF') {
    if (p.deck) {
      if (deckInteract(game, p)) return true;
      // (One of her crew in front of you: a word from them.)
      const c = game.cursor;
      if (c && c.entity && c.entity.kind === 'sailor' && Math.hypot(c.entity.x - p.x, c.entity.z - p.z) <= 3) {
        sailorTalk(game, c.entity);
        return true;
      }
      return false;
    }
    // Beside a ship (on a pier, or in the water): aboard her.
    if (!p.raft && !p.mount) {
      const S = nearShip(game, p, 2.6);
      if (S) return boardAt(game, S, p, p.x, p.z);
    }
    return false;
  }
  if (code === 'KeyR' && p.deck && p.deck.role === 'helm') {
    const S = shipById(game, p.deck.s);
    if (!S) return false;
    S.anchor = !S.anchor;
    if (S.anchor) S.sailGoal = 0;
    game.ui.msg(S.anchor ? 'Let go the anchor!' : 'Weigh anchor!', '#a0d8ff', true);
    game.audio?.play(S.anchor ? 'chain' : 'select');
    return true;
  }
  return false;
}

// The mouse wheel aboard: at the wheel, the sheets; at a gun, its elevation.
export function shipWheel(game, wheel) {
  const p = game.player;
  const d = p.deck;
  if (!d || !d.role) return false;
  const S = shipById(game, d.s);
  if (!S) return false;
  if (d.role === 'helm') {
    S.sheet = Math.max(0, Math.min(1, S.sheet + Math.sign(wheel) * 0.05));
    S.manualT = 10;
  } else if (d.role === 'gun') {
    const st = S.guns[d.gi];
    if (st) st.elev = Math.max(-0.08, Math.min(0.55, st.elev - Math.sign(wheel) * 0.04));
  }
  return true;
}

// A ship near the player (her hull within `r` paces).
function nearShip(game, p, r) {
  let best = null;
  let bd = Infinity;
  for (const S of shipsOf(game)) {
    if (S.sinking) continue;
    const hit = shipAtWorld(game, p.x, p.z, r);
    if (!hit || hit.S !== S) continue;
    const d = Math.hypot(S.x - p.x, S.z - p.z);
    if (d < bd) {
      bd = d;
      best = S;
    }
  }
  return best;
}

// Clicks aboard or on a ship: true if they were the ship's.
export function shipMouse(game, dt, clicks, input) {
  const p = game.player;
  const d = p.deck;
  if (d && (d.role === 'helm' || d.role === 'gun')) {
    for (const ck of clicks) if (ck.type === 'down' && ck.button === 0) deckClick(game, p);
    game.mining = null;
    return true;
  }
  const c = game.cursor;
  if (!c || !c.ship) {
    game.shipMining = null;
    return false;
  }
  const S = shipById(game, c.ship.s);
  if (!S) return false;
  for (const ck of clicks) {
    if (ck.type === 'down' && ck.button === 2) {
      const held = p.heldDef();
      if (held && MENDS(held.key)) {
        const vi = holeBeside(S, c.ship.vi, c.ship.face);
        if (vi >= 0 && c.inReach) mendWith(game, p, S, vi);
        else if (vi < 0) game.ui.msg('Nothing there to mend.', '#c8c8c8', true);
      } else if (!p.deck && c.inReach) boardAt(game, S, p, p.x, p.z);
    }
  }
  // Holding the button on her: knocking a plank out.
  if (input.mouse.down && c.inReach && !(p.heldDef() && p.heldDef().kind === 'weapon')) {
    const m = S.m;
    const vi = c.ship.vi;
    const id = S.vox[vi];
    if (!id) return true;
    const b = BLOCKS[id];
    if (!isFinite(b.hardness)) return true;
    let M = game.shipMining;
    if (!M || M.s !== S.id || M.vi !== vi) M = game.shipMining = { s: S.id, vi, t: 0 };
    const tool = p.heldDef();
    const k = tool && tool.tool === b.tool ? 1 : tool && (tool.tool === 'axe' || tool.tool === 'pick') ? 0.6 : 0.3;
    M.t += dt * k;
    const need = Math.max(0.4, b.hardness * 1.2);
    if (Math.random() < dt * 8) {
      const x = vi % m.W;
      const z = Math.floor(vi / m.W) % m.L;
      const y = Math.floor(vi / (m.W * m.L));
      const [wx, wz] = S.toWorld(x + 0.5, z + 0.5);
      game.renderer?.emit(wx, S.layerY(y) + 0.5, wz, { n: 2, color: ['#8a6438', '#c8a070'], up: 20, speed: 25, gravity: 120, life: 0.4 });
      p.actionTimer = 0.2;
    }
    if (M.t >= need) {
      game.shipMining = null;
      if (breakVoxel(game, S, vi)) {
        const drop = b.drop === undefined ? b.name : b.drop;
        if (typeof drop === 'string') addItem(p.inv, drop, 1);
        game.audio?.play('break');
      }
    }
  } else game.shipMining = null;
  game.mining = null;
  return true;
}

// What's under the pointer, a ship's planks before what's behind them.
export function shipCursor(game, c, r) {
  const sp = r && r.shipPick;
  if (!sp || !c) return;
  if (c.entity) return;
  if (r.pick && r.pick.seq > sp.seq) return;
  const S = shipById(game, sp.s);
  if (!S) return;
  const m = S.m;
  const x = sp.vi % m.W;
  const z = Math.floor(sp.vi / m.W) % m.L;
  const y = Math.floor(sp.vi / (m.W * m.L));
  const [wx, wz] = S.toWorld(x + 0.5, z + 0.5);
  const p = game.player;
  c.ship = { s: S.id, vi: sp.vi, face: sp.face };
  c.inReach = Math.hypot(wx - p.x, wz - p.z) <= REACH + 1 && Math.abs(S.layerY(y) - p.y) <= 5;
  c.block = null;
  c.place = null;
  c.x = undefined;
}

// A word from one of a ship's crew.
const SAY = {
  captain: ['She\'s a fine ship, and I\'ll thank you not to scratch her.', 'Wind\'s fair. We sail on the tide.', 'Mind the rail. It\'s further down than it looks.'],
  mate: ['Captain\'s orders: keep off the quarterdeck unless you\'re wanted.', 'You look like you\'ve sea legs. Some.'],
  gunner: ['Twelve pounds of iron, she throws. Lovely.', 'Keep your fingers clear of the touch-hole.'],
  marine: ['Move along.', 'No trouble aboard, now.'],
  sailor: ['Haul, and belay!', 'Lovely day for it.', 'Watch your step, the deck\'s wet.', 'Seen a whale off the bow this morning. Big as the ship.', 'Never trust a calm sea.'],
  merchant: ['Spices, cloth and iron. Fair prices, at the next port.', 'Seasick? Look at the horizon.'],
  passenger: ['How long till we make port, do you think?', 'I\'ve never been to sea before.'],
};
export function sailorTalk(game, c) {
  const lines = SAY[c.role] || SAY.sailor;
  c.face(game.player.x, game.player.z);
  c.say(lines[Math.floor(Math.random() * lines.length)], 3.5);
}

// Saved with the world: the ships, and where you were aboard one.
export function shipSave(game) {
  const p = game.player;
  let below = null;
  const S = holdShipAt(game, p.x);
  if (S) {
    const [lx, ly, lz] = holdLocal(S, p.x, p.y, p.z);
    below = { s: S.id, lx, ly, lz };
  }
  return { ships: saveShips(game), deck: p.deck ? { s: p.deck.s, cx: p.deck.cx, cz: p.deck.cz, y: p.deck.y } : null, below, seq: game.shipSeq || 0 };
}

export function shipLoad(game, data) {
  if (!data) return;
  loadShips(game, data.ships);
  const p = game.player;
  const at = data.deck || data.below;
  const S = at ? shipById(game, at.s) : null;
  if (!S) return;
  if (data.deck) {
    const spot = deckSpotNear(S, data.deck.cx + 0.5, data.deck.cz + 0.5, 4, data.deck.y);
    if (spot) putAboard(game, S, p, spot.cx, spot.y, spot.cz);
  } else enterHold(game, S, p, data.below.lx, data.below.ly, data.below.lz);
}
