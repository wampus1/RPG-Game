// (Round 78) Horses and wagons at sea. The bigger ships have stalls below
// and room on deck: a brigantine two horses, a galleon four (and two
// wagons), a frigate one; a sloop none. Ride (or drive) up her side and
// your horse (and wagon) goes aboard with you, if there's room; step
// ashore and it's led off after you. (Sunk with her: lost.) And the
// ferry: shipped across with you, for a fee, with a hold for your goods
// that's set down on the far pier in a crate. See ui/travel.js.
import { SHIP_TYPES } from '../world/shipmodels.js';
import { shipById } from './ships3d.js';

export const CARRIES = {
  sloop: { horses: 0, wagons: 0 },
  brigantine: { horses: 2, wagons: 0 },
  galleon: { horses: 4, wagons: 2 },
  frigate: { horses: 1, wagons: 0 },
};
// (The ferry: as a brigantine, with a wagon on her deck besides.)
export const FERRY_CARRIES = { horses: 2, wagons: 1 };
export const FERRY_FEES = { horse: 8, wagon: 15, hold: 10 };
export const HOLD_SLOTS = 18;

export function carriesOf(S) {
  const T = S && SHIP_TYPES[S.type];
  return (S && CARRIES[S.type]) || (T && T.carries) || { horses: 0, wagons: 0 };
}

function aboard(game, S) {
  const R = game.riding;
  return {
    horses: R.horses.filter((h) => h.aboard === S.id).length,
    wagons: R.wagons.filter((w) => w.aboard === S.id).length,
  };
}

// A player riding (or driving) aboard ship S: their horse (and wagon) with
// them, if she has room. Called as they board (see ships3d.boardAt).
export function loadAboard(game, p, S) {
  const m = p.mount;
  if (!m || !game.riding || p.kind !== 'player') return;
  const R = game.riding;
  const C = carriesOf(S);
  const n = aboard(game, S);
  const say = (t, c = '#c8e0ff') => game.asPlayer ? game.asPlayer(p, () => game.ui.msg(t, c, true)) : game.ui.msg(t, c, true);
  const h = m.horseId !== undefined && m.horseId !== null ? R.horse(m.horseId) : null;
  if (m.kind === 'wagon') {
    const w = R.wagon(m.wagonId);
    if (w && n.wagons < C.wagons && (!h || n.horses < C.horses)) {
      w.aboard = S.id;
      if (h) h.aboard = S.id;
      say(`Your wagon and horse are hauled aboard ${S.name || 'her'}.`);
      return;
    }
    if (w) Object.assign(w, { x: p.x, y: p.y, z: p.z });
    say(`${S.name || 'She'} has no room for a wagon: you leave it on the shore.`, '#ffb080');
    return;
  }
  if (h && n.horses < C.horses) {
    h.aboard = S.id;
    say(`Your horse is led down to the stalls below (${n.horses + 1} of ${C.horses}).`);
    return;
  }
  if (h) {
    Object.assign(h, { x: p.x, y: p.y, z: p.z });
    say(C.horses ? 'Her stalls are full: your horse stays on the shore.' : `${S.name || 'She'} has no stalls: your horse stays on the shore.`, '#ffb080');
  }
}

// Once a second: horses and wagons aboard a ship whose owner has stepped
// ashore beside her, led off after them; aboard one that's gone, lost.
export function stallsTick(game, dt) {
  const R = game.riding;
  if (!R || game.remote) return;
  game.stallT = (game.stallT || 0) - dt;
  if (game.stallT > 0) return;
  game.stallT = 1;
  const things = [...R.horses.filter((h) => h.aboard !== undefined && h.aboard !== null), ...R.wagons.filter((w) => w.aboard !== undefined && w.aboard !== null)];
  if (!things.length) return;
  for (const t of things) {
    const S = shipById(game, t.aboard);
    if (!S || S.sinking > 1) {
      if (R.horses.includes(t)) R.horses = R.horses.filter((q) => q !== t);
      else R.wagons = R.wagons.filter((q) => q !== t);
      game.ui.msg(S ? 'Your animals went down with her.' : 'What you had aboard her is lost.', '#ff7060');
      continue;
    }
    const p = (game.everyone ? game.everyone() : [game.player]).find((q) => q && !q.dead && !q.deck && Math.hypot(q.x - S.x, q.z - S.z) < Math.max(10, S.m.L * 0.7));
    if (!p) continue;
    const spot = game.findFreeSpot(p.x + 1, p.z, p.y) || { x: p.x, y: p.y, z: p.z };
    t.aboard = null;
    Object.assign(t, { x: spot.x, y: spot.y, z: spot.z });
    game.ui.msg(R.horses.includes(t) ? 'Your horse is led ashore after you.' : 'Your wagon is lowered onto the shore.', '#c8e0ff', true);
  }
}

// Yours, near enough to be shipped on a ferry: { horses, wagons }.
export function shippable(game, p, r = 10) {
  const R = game.riding;
  if (!R) return { horses: [], wagons: [] };
  const near = (q) => !q.aboard && Math.hypot(q.x - p.x, q.z - p.z) <= r && !q.town;
  const riding = p.mount && p.mount.horseId !== undefined ? p.mount.horseId : null;
  const wagons = R.wagons.filter((w) => near(w) || (p.mount && p.mount.wagonId === w.id));
  const hitched = new Set(wagons.map((w) => w.horse));
  const horses = R.horses.filter((h) => !hitched.has(h.id) && (near(h) || h.id === riding));
  return { horses, wagons };
}
