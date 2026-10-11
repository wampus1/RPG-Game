// Below a great ship's decks (round 68; round 84: as part of her). Her
// inside is her own cells (see ships3d.js), walked the way her deck is:
// down her hatches' stairs, through a cabin's door, through a hole in her
// deck, and up again. Whoever's below sees her cut away above their head
// (see render/shipvox.js), her upper decks and works hidden, and her hold,
// gun deck and cabins as they are: a plank broken in here is a hole in her
// side out there, and a shot through her side out there is a hole in
// here. Holed under the waterline, the sea pours in and the water in her
// rises deck by deck (drawn lying in her, and slow to wade through).
//   (Before round 84 her inside was laid out as a place apart, a copy of
// her squared up in a space of its own, that whoever went below was
// moved into: see the 0.84.0 step in migrate.js, and shipLoad.)
//   What's in her to use, below: her pump, her chests, barrels and
// crates (her hold's stores: S.store), her blueprint table, her bunks and
// hammocks, the guns on her gun deck, the galley's stove.
import { B, BLOCKS } from '../world/blocks.js';
import { isInside, onPlan, standOn } from '../world/shipmodels.js';
import { shipById, fireGun, ownerId, theShip, putAboard, deckSpotNear } from './ships3d.js';
import { countItem, removeItem } from './inventory.js';

// How high the water in her is (S.waterTop: the topmost of her layers
// that's flooded, -1 for none): whole layers of her inside, from the
// bottom up, as her flooded cells fill them.
export function floodLevel(S) {
  const m = S.m;
  if (!m.capLayer) {
    m.capLayer = new Array(m.H).fill(0);
    for (let i = 0; i < m.N; i++) if (m.inside[i] && !m.vox[i]) m.capLayer[Math.floor(i / (m.W * m.L))]++;
  }
  let left = S.floodCells;
  let top = -1;
  for (let y = 0; y < m.H; y++) {
    const c = m.capLayer[y];
    if (!c) continue;
    if (left >= c * 0.5) {
      top = y;
      left -= c;
    } else break;
  }
  S.waterTop = top;
  return top;
}

// Is `e` below her decks (on her, in her)?
export function isBelowOn(S, e) {
  const d = e && e.deck;
  return !!(d && d.s === S.id && isInside(S.m, d.cx, d.y, d.cz));
}

// A step of someone aboard done: gone below, or come up on deck (said to
// whoever it is, once each way).
export function noteBelow(game, S, e) {
  const d = e.deck;
  if (!d) return;
  const below = isInside(S.m, d.cx, d.y, d.cz);
  if (!!d.below === below) return;
  d.below = below;
  if (e.kind !== 'player') return;
  game.asPlayer(e, () => {
    game.lightDirty = true;
    game.ui.msg(below ? `Below decks on ${theShip(S)}.` : `On deck of ${theShip(S)}.`, below ? '#c8b890' : '#a0d8ff', true);
  });
}

// Each frame: for each ship with someone of you below, the sea pouring in
// at her holes under the waterline, and the water running past outside.
export function belowTick(game, dt) {
  const r = game.renderer;
  if (!r || !r.emit) return;
  const me = game.player;
  const d = me && me.deck;
  if (!d) return;
  const S = shipById(game, d.s);
  if (!S || !isBelowOn(S, me)) return;
  const m = S.m;
  const line = m.wl - S.yOff;
  for (const L of S.leaks || []) {
    if (L.y > line || Math.random() > dt * 9) continue;
    // (In from the outside: toward her middle.)
    const ix = L.x < m.px ? 1 : -1;
    const [wx, wz] = S.toWorld(L.x + 0.5 + ix * 0.4, L.z + 0.5);
    const [vx, vz] = S.dirWorld(ix, 0);
    r.emit(wx, S.layerY(L.y) + 0.4, wz, { n: 3, color: ['#c8e8ff', '#80b8e0', '#ffffff'], up: 10, speed: 8, vx: vx * 60, vy: vz * 60, gravity: 90, life: 0.5 });
  }
}

// The thing of hers at cell vi to be used from inside her (or her deck):
// { kind, ... } or null. Her pump; a chest, barrel or crate of her stores;
// her blueprint table; a bunk or hammock; one of her gun deck's guns; the
// galley's stove.
export function insideFitting(S, vi) {
  const m = S.m;
  const id = S.vox[vi];
  if (!id) return null;
  const x = vi % m.W;
  const z = Math.floor(vi / m.W) % m.L;
  const y = Math.floor(vi / (m.W * m.L));
  const name = BLOCKS[id].name;
  if (id === B.ship_pump) return { kind: 'pump', x, y, z };
  if (id === B.blueprint_table) return { kind: 'blueprint', x, y, z };
  if (name === 'chest' || name === 'barrel' || name === 'crate') return { kind: 'store', x, y, z, vi, name };
  if (name === 'bed' || name === 'hammock') return { kind: 'bunk', x, y, z };
  if (id === B.furnace) return { kind: 'stove', x, y, z };
  if (id === B.ship_cannon) {
    const gi = m.guns.findIndex((g) => !g.deck && g.x === x && g.y === y && g.z === z);
    if (gi >= 0) return { kind: 'portgun', gi, x, y, z };
  }
  return null;
}

// Within reach of it, aboard (a step from it, on her)?
export function nearFitting(p, f) {
  const d = p.deck;
  return !!d && Math.max(Math.abs(d.cx - f.x), Math.abs(d.cz - f.z)) <= 1 && Math.abs(d.y - f.y) <= 1;
}

// Use what's in her at fitting f (see insideFitting), aboard her: true if
// it was seen to.
export function useInside(game, p, S, f) {
  const [wx, wz] = S.toWorld(f.x + 0.5, f.z + 0.5);
  const wy = Math.round(S.layerY(f.y));
  if (f.kind === 'pump') {
    const before = S.flood;
    S.floodCells = Math.max(0, S.floodCells - 4);
    S.pumpers = (S.pumpers || 0) + 6;
    floodLevel(S);
    game.audio?.play('splash', p);
    game.renderer?.emit?.(wx, wy + 1, wz, { n: 8, color: ['#8cc4f0', '#e0f4ff'], up: 30, life: 0.5 });
    game.ui.msg(before > 0.02 ? `You work the pump: the water in her falls (${Math.round(S.flood * 100)}% flooded now).` : 'You work the pump: she\'s dry enough.', '#80c8ff');
    return true;
  }
  if (f.kind === 'blueprint') {
    if (S.owner && S.owner !== ownerId(game, p) && !game.cheats?.ships) {
      game.ui.msg(`${theShip(S, true)}'s plans: her captain's, not yours to mark.`, '#ffb080');
      return true;
    }
    game.ui.openBlueprint?.(S);
    return true;
  }
  if (f.kind === 'store') {
    let slots = S.store.get(f.vi);
    if (!slots) {
      slots = new Array(f.name === 'chest' ? 18 : 9).fill(null);
      S.store.set(f.vi, slots);
    }
    const title = `${f.name === 'chest' ? 'Chest' : f.name === 'barrel' ? 'Barrel' : 'Crate'} · ${S.name || 'ship'}`;
    game.ui.openContainer(title, slots, { x: Math.round(wx), y: wy, z: Math.round(wz), ship: S.id });
    game.audio?.play('chest_open', { x: Math.round(wx), y: wy, z: Math.round(wz) });
    return true;
  }
  if (f.kind === 'bunk') {
    sleepAboard(game, p, S, f);
    return true;
  }
  if (f.kind === 'stove') {
    game.openCooking?.('p', Math.round(wx), wy, Math.round(wz));
    return true;
  }
  if (f.kind === 'portgun') {
    const st = S.guns[f.gi];
    if (st && st.cd > 0) {
      game.ui.msg('Still swabbing her out: a moment.', '#c8c8c8');
      return true;
    }
    const shot = S.ammo > 0 ? 'ship' : countItem(p.inv, 'cannonball') > 0 ? 'mine' : null;
    if (!shot) {
      game.ui.msg('No shot for her: cannonballs are made at an anvil.', '#ffb080');
      return true;
    }
    if (!fireGun(game, S, f.gi, p)) {
      game.ui.msg('Her port\'s stove in: she can\'t fire through it.', '#ffb080');
      return true;
    }
    if (shot === 'ship') S.ammo--;
    else removeItem(p.inv, 'cannonball', 1);
    return true;
  }
  return false;
}

// A night in a bunk (or a hammock) of hers: as in any bed, but she carries
// you as you sleep, and you wake where you lay down.
function sleepAboard(game, p, S, f) {
  const h = game.minute / 60;
  if (!(h >= 20 || h < 5)) {
    game.ui.msg('You can only sleep at night.', '#c8d8ff');
    return;
  }
  const [wx, wz] = S.toWorld(f.x + 0.5, f.z + 0.5);
  game.trySleepAboard?.(p, S, { x: Math.round(wx), y: Math.round(S.layerY(f.y)), z: Math.round(wz) });
}

// (A pump, a gun or a blueprint table out in the world, with no ship
// under it: what it says. Before round 84, inside a ship apart, they
// were hers.)
export function holdUse(game, p, x, y, z, what) {
  game.ui.msg(what === 'pump' ? 'The pump sucks at nothing.' : what === 'blueprint' ? 'Plans of a ship that isn\'t here.' : 'A gun with no ship under it.', '#c8c8c8');
  return true;
}

// (Round 84) Someone saved below a ship's decks before 0.84, in her inside
// laid out apart: put on her, at that cell of hers (or the nearest place
// to stand on her).
export function boardBelow(game, S, e, lx, ly, lz) {
  const m = S.m;
  if (onPlan(m, lx, lz) && standOn(m, S.vox, lx, ly, lz)) {
    putAboard(game, S, e, lx, ly, lz);
    return true;
  }
  for (let r = 1; r <= 4; r++) {
    for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
      for (const dy of [0, 1, -1, 2, -2]) {
        const x = lx + dx;
        const z = lz + dz;
        if (onPlan(m, x, z) && standOn(m, S.vox, x, ly + dy, z)) {
          putAboard(game, S, e, x, ly + dy, z);
          return true;
        }
      }
    }
  }
  const spot = deckSpotNear(S, lx + 0.5, lz + 0.5, 8, null);
  if (!spot) return false;
  putAboard(game, S, e, spot.cx, spot.y, spot.cz);
  return true;
}

// Who's below on her.
export function belowOn(game, S) {
  return [...(game.everyone ? game.everyone() : []), ...(game.sailors || []), ...(game.npcs || [])].filter((q) => q && !q.dead && isBelowOn(S, q));
}

