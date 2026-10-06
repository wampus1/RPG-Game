// Below a great ship's deck (round 68): her inside, laid out cell for cell
// as a place apart (see World.inst), in a space of its own for each ship
// with someone aboard. It's her: the same cells as her outside (see
// ships3d.js), so a plank broken in here is a hole in her side out there,
// and a shot through her side out there is a hole in here, the sea
// showing through it; holed under the waterline, the sea pours in and the
// water rises deck by deck. Her decks shake when she's hit or strikes
// something; outside her planks the water runs past as she sails. Mended
// in here plank by plank, the same as from outside.
//   Down her hatches, through a cabin's door, through a hole in her deck:
// in here. Up her stairs onto her deck, out of a cabin's door: out there,
// on her deck where she is. Out through a hole in her side: into the sea.
import { REGION_W, REGION_D, INST_RX, INST_SLOT_RX, WORLD_Y } from '../config.js';
import { Region } from '../world/region.js';
import { B, BLOCKS, PLANK_BLOCKS } from '../world/blocks.js';
import { isInside, onPlan, standOn } from '../world/shipmodels.js';
import { shipById, shipsOf, putAboard, deckSpotNear, mendVoxel, breakVoxel, aboardOf, theShip, fireGun } from './ships3d.js';
import { countItem, removeItem } from './inventory.js';
import { SURFACE } from '../config.js';

// Each ship's space apart: its slot (past every old place's).
export const SHIP_SLOT0 = 40000;
const RX = 1;
const RZ = 2;
// Where her cell (0, 0, 0) is in it.
const OX = 26;
const OZ = 18;
const YB = 1;

export function holdBounds(S) {
  const slot = SHIP_SLOT0 + S.id;
  const rx0 = INST_RX + slot * INST_SLOT_RX;
  const x0 = rx0 * REGION_W;
  return { slot, rx0, x0, z0: 0, x1: x0 + RX * REGION_W, z1: RZ * REGION_D };
}

// Her cell (lx, ly, lz) in her space apart, and back.
export function holdPos(S, lx, ly, lz) {
  const b = holdBounds(S);
  return [b.x0 + OX + lx, YB + ly, b.z0 + OZ + lz];
}
export function holdLocal(S, x, y, z) {
  const b = holdBounds(S);
  return [x - b.x0 - OX, y - YB, z - b.z0 - OZ];
}

// Which ship's inside world x is in, if any.
export function holdShipAt(game, x) {
  for (const S of shipsOf(game)) {
    if (!S.hold) continue;
    if (x >= S.hold.x0 && x < S.hold.x1) return S;
  }
  return null;
}

// Her inside, made (once, while anyone's aboard).
export function holdOf(game, S) {
  if (S.hold) return S.hold;
  const b = holdBounds(S);
  const regions = new Map();
  for (let j = 0; j < RZ; j++) for (let i = 0; i < RX; i++) regions.set((b.rx0 + i) * 4096 + j, new Region(b.rx0 + i, j));
  const reg = (x, z) => regions.get((b.rx0 + Math.floor((x - b.x0) / REGION_W)) * 4096 + Math.floor((z - b.z0) / REGION_D));
  const W = RX * REGION_W;
  const D = RZ * REGION_D;
  const m = S.m;
  const sea = m.wl + YB;
  // The sea all round her, a sandy bottom under it.
  for (let z = 0; z < D; z++) {
    for (let x = 0; x < W; x++) {
      const r = reg(b.x0 + x, b.z0 + z);
      const lx = x % REGION_W;
      const lz = z % REGION_D;
      r.set(lx, 0, lz, B.bedrock);
      for (let y = 1; y <= sea; y++) r.set(lx, y, lz, y === 1 ? B.sand : B.water);
    }
  }
  // Her, cell by cell.
  for (let y = 0; y < m.H; y++) for (let z = 0; z < m.L; z++) for (let x = 0; x < m.W; x++) {
    const i = (y * m.L + z) * m.W + x;
    const [X, Y, Z] = holdPos(S, x, y, z);
    if (Y >= WORLD_Y) continue;
    const r = reg(X, Z);
    const id = S.vox[i];
    if (id) r.set(X - r.x0, Y, Z - r.z0, id, S.m.meta[i]);
    else if (m.hull[i]) r.set(X - r.x0, Y, Z - r.z0, B.air);
  }
  // What's in her chests and barrels.
  for (const [vi, slots] of S.store) {
    const x = vi % m.W;
    const z = Math.floor(vi / m.W) % m.L;
    const y = Math.floor(vi / (m.W * m.L));
    const [X, Y, Z] = holdPos(S, x, y, z);
    const r = reg(X, Z);
    r.containers.set(Region.idx(X - r.x0, Y, Z - r.z0), slots);
  }
  // (Her own, new: her hold's empty.)
  if (S.owner) for (const h of m.holds) {
    const vi = (h.y * m.L + h.z) * m.W + h.x;
    if (S.store.has(vi)) continue;
    const [X, Y, Z] = holdPos(S, h.x, h.y, h.z);
    const r = reg(X, Z);
    const slots = new Array(BLOCKS[h.id].name === 'chest' ? 18 : 9).fill(null);
    S.store.set(vi, slots);
    r.containers.set(Region.idx(X - r.x0, Y, Z - r.z0), slots);
  }
  for (const r of regions.values()) {
    r.recomputeTops();
    r.modified = true;
  }
  const inst = { slot: b.slot, regions, ship: S.id };
  game.world.openInst(inst);
  S.hold = { ...b, inst, waterTop: -1, idle: 0, sea, has: (q) => q && q.x >= b.x0 && q.x < b.x1 && !q.deck };
  S.hold.syncing = false;
  holdFlood(game, S, true);
  game.lightDirty = true;
  return S.hold;
}

// Gone below at her cell (cx, fy, cz).
export function enterHold(game, S, e, cx, fy, cz) {
  const H = holdOf(game, S);
  const [X, Y, Z] = holdPos(S, cx, fy, cz);
  if (e.deck) {
    if (S.helmBy === e.id) S.helmBy = null;
    e.deck = null;
  }
  e.walking = false;
  e.teleport(X, Y, Z);
  e.belowShip = S.id;
  H.idle = 0;
  if (e.kind === 'player') {
    game.asPlayer(e, () => {
      if (!game.seat || game.seat.host) {
        game.renderer.camInit = false;
        game.lightDirty = true;
      }
      game.ui.msg(`Below decks on ${theShip(S)}.`, '#c8b890', true);
    });
  }
}

// Set her cell vi in her inside to what she has there now.
export function holdVoxel(game, S, vi) {
  const H = S.hold;
  if (!H) return;
  const m = S.m;
  const x = vi % m.W;
  const z = Math.floor(vi / m.W) % m.L;
  const y = Math.floor(vi / (m.W * m.L));
  const [X, Y, Z] = holdPos(S, x, y, z);
  if (Y >= WORLD_Y) return;
  const id = S.vox[vi];
  H.syncing = true;
  try {
    // (A hole in her skin below the sea outside: the sea's in it. Within
    // her, the water in her, or air.)
    let want = id;
    if (!id) {
      if (m.skin[vi] && Y <= H.sea) want = B.water;
      else want = m.inside[vi] && y <= (S.waterTop ?? -1) ? B.water : B.air;
    }
    if (game.world.getBlock(X, Y, Z) !== want) game.world.setBlock(X, Y, Z, want, id ? m.meta[vi] : 0);
  } finally {
    H.syncing = false;
  }
  H.waterTop = -1;
}

// A block changed in her inside (dug out, set down): the same in her.
export function holdBlockChanged(game, x, y, z, oldId, newId) {
  const S = holdShipAt(game, x);
  if (!S || !S.hold || S.hold.syncing) return;
  const [lx, ly, lz] = holdLocal(S, x, y, z);
  const m = S.m;
  if (lx < 0 || ly < 0 || lz < 0 || lx >= m.W || ly >= m.H || lz >= m.L) return;
  const vi = (ly * m.L + lz) * m.W + lx;
  if (newId === B.water) return;
  if (!newId) {
    if (S.vox[vi]) breakVoxel(game, S, vi, 'quiet');
    return;
  }
  // A plank set in a hole of hers: mended, as she was built.
  if ((PLANK_BLOCKS.has(newId) || newId === B.planks) && m.vox[vi] && !S.vox[vi] && m.struct[vi]) {
    mendVoxel(game, S, vi);
    return;
  }
  S.vox[vi] = newId;
  S.ver++;
  S.recount();
  game.net?.shipChanged?.(S, vi);
}

// How high the water in her is: whole layers of her inside flooded, from
// the bottom up; her inside's cells set to it.
export function holdFlood(game, S, force = false) {
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
  const H = S.hold;
  if (!H || (!force && H.waterTop === top)) return;
  H.waterTop = top;
  H.syncing = true;
  try {
    for (let y = 0; y < m.H; y++) {
      for (let z = 0; z < m.L; z++) for (let x = 0; x < m.W; x++) {
        const i = (y * m.L + z) * m.W + x;
        if (!m.inside[i] || S.vox[i]) continue;
        const [X, Y, Z] = holdPos(S, x, y, z);
        const cur = game.world.getBlock(X, Y, Z);
        const want = y <= top ? B.water : B.air;
        if (cur !== want && (cur === B.air || cur === B.water)) game.world.setBlock(X, Y, Z, want, 0);
      }
    }
  } finally {
    H.syncing = false;
  }
}

// Each frame, for each ship with her inside open: who's come out of it
// (up on deck, out through her side), the sea pouring in at her holes,
// the water running past outside; shut again once nobody's been aboard a
// while.
export function holdTick(game, dt) {
  for (const S of shipsOf(game)) {
    const H = S.hold;
    if (!H) continue;
    const m = S.m;
    const people = [];
    for (const q of game.everyone ? game.everyone() : [game.player]) if (H.has(q)) people.push(q);
    for (const c of game.sailors || []) if (H.has(c) && !c.dead) people.push(c);
    for (const e of people) {
      if (e.moving || e.dead) continue;
      const [lx, ly, lz] = holdLocal(S, e.x, e.y, e.z);
      if (!onPlan(m, lx, lz)) {
        // Out through a hole in her side: the sea.
        const [wx, wz] = S.toWorld(lx + 0.5, lz + 0.5);
        const w = game.world;
        const tx = Math.round(wx);
        const tz = Math.round(wz);
        const y = w.findStandY(tx, tz, SURFACE);
        e.belowShip = null;
        if (e.kind === 'sailor') {
          e.dead = true;
          continue;
        }
        e.teleport(tx, y >= 0 ? y : SURFACE, tz);
        if (e.kind === 'player') game.asPlayer(e, () => {
          game.ui.msg('Out through the hole in her side, into the sea!', '#a0d8ff');
          if (!game.seat || game.seat.host) game.renderer.camInit = false;
        });
        continue;
      }
      if (!isInside(m, lx, ly, lz)) {
        // Up on deck.
        const spot = standOn(m, S.vox, lx, ly, lz) ? { cx: lx, y: ly, cz: lz } : deckSpotNear(S, lx + 0.5, lz + 0.5, 3, ly);
        if (spot) {
          e.belowShip = null;
          putAboard(game, S, e, spot.cx, spot.y, spot.cz);
          if (e.kind === 'player') game.asPlayer(e, () => {
            if (!game.seat || game.seat.host) {
              game.renderer.camInit = false;
              game.lightDirty = true;
            }
            game.ui.msg(`On deck of ${theShip(S)}.`, '#a0d8ff', true);
          });
        }
      }
    }
    // The sea pouring in at her holes under the waterline.
    const r = game.renderer;
    const line = m.wl - S.yOff;
    const anyone = people.some((q) => q.kind === 'player');
    if (r && r.emit && anyone) {
      for (const L of S.leaks || []) {
        if (L.y > line || Math.random() > dt * 9) continue;
        const [X, Y, Z] = holdPos(S, L.x, L.y, L.z);
        // (In from the outside: toward her middle.)
        const ix = L.x < m.px ? 1 : -1;
        r.emit(X + ix * 0.4, Y + 0.4, Z, { n: 3, color: ['#c8e8ff', '#80b8e0', '#ffffff'], up: 10, speed: 8, vx: ix * 60, gravity: 90, life: 0.5 });
      }
      // The water running past her outside.
      const sp = Math.abs(S.v);
      if (sp > 0.8 && Math.random() < dt * 14) {
        const side = Math.random() < 0.5 ? -1 : m.W;
        const z = Math.random() * m.L;
        const [X, , Z] = holdPos(S, side, 0, z);
        const [du, dv] = r.toViewDir ? r.toViewDir(0, -Math.sign(S.v)) : [0, -1];
        r.emit(X, H.sea + 0.75, Z, { n: 1, color: ['#e8f4ff', '#c0e0f8'], up: 0, speed: 0, vx: du * sp * 9, vy: dv * sp * 9, gravity: 0, life: 0.9, spreadY: 2 });
      }
    }
    // (Nobody aboard her any more: shut, what's in her chests kept.)
    const onDeck = aboardOf(game, S).some((q) => q.kind === 'player');
    if (anyone || onDeck) H.idle = 0;
    else H.idle += dt;
    if (H.idle > 12) closeHold(game, S, false);
  }
}

// Shut her inside: what's in her chests kept with her, whoever's still in
// it put on her deck (or, going down, in the sea).
export function closeHold(game, S, sinking) {
  const H = S.hold;
  if (!H) return;
  const m = S.m;
  for (const r of H.inst.regions.values()) {
    for (const [ci, slots] of r.containers) {
      const lzr = Math.floor(ci / (REGION_W * WORLD_Y));
      const lxr = Math.floor(ci / WORLD_Y) % REGION_W;
      const y = ci % WORLD_Y;
      const [lx, ly, lz] = holdLocal(S, r.x0 + lxr, y, r.z0 + lzr);
      if (lx < 0 || ly < 0 || lz < 0 || lx >= m.W || ly >= m.H || lz >= m.L) continue;
      S.store.set((ly * m.L + lz) * m.W + lx, slots);
    }
  }
  const people = [];
  for (const q of game.everyone ? game.everyone() : [game.player]) if (H.has(q)) people.push(q);
  for (const c of game.sailors || []) if (H.has(c)) people.push(c);
  for (const e of people) {
    const [lx, , lz] = holdLocal(S, e.x, e.y, e.z);
    e.belowShip = null;
    if (sinking) {
      const [wx, wz] = S.toWorld(lx + 0.5, lz + 0.5);
      if (e.kind === 'sailor') {
        e.dead = true;
        continue;
      }
      const tx = Math.round(wx);
      const tz = Math.round(wz);
      const y = game.world.findStandY(tx, tz, SURFACE);
      e.teleport(tx, y >= 0 ? y : SURFACE, tz);
      if (e.kind === 'player') game.asPlayer(e, () => {
        game.ui.msg('The sea closes over her decks: you fight your way out and up.', '#a0d8ff');
        if (!game.seat || game.seat.host) game.renderer.camInit = false;
      });
    } else {
      const spot = deckSpotNear(S, lx + 0.5, lz + 0.5, 6, null) || deckSpotNear(S, m.spawn.x, m.spawn.z, 8, null);
      if (spot) putAboard(game, S, e, spot.cx, spot.y, spot.cz);
    }
  }
  game.world.closeInst(H.inst);
  S.hold = null;
  game.lightDirty = true;
}

// Who's below on her (for the crew's reckoning).
export function belowOn(game, S) {
  const H = S.hold;
  if (!H) return [];
  return [...(game.everyone ? game.everyone() : []), ...(game.sailors || [])].filter((q) => H.has(q));
}

export function holdShipOfEntity(game, e) {
  return e && e.belowShip !== undefined && e.belowShip !== null ? shipById(game, e.belowShip) : null;
}

// (Round 68) Her pump worked by hand, or one of her gun deck's guns fired
// through its port, from inside her. True if it was hers to see to.
export function holdUse(game, p, x, y, z, what) {
  const S = holdShipAt(game, x);
  if (!S) {
    game.ui.msg(what === 'pump' ? 'The pump sucks at nothing.' : 'A gun with no ship under it.', '#c8c8c8');
    return true;
  }
  if (what === 'pump') {
    const before = S.flood;
    S.floodCells = Math.max(0, S.floodCells - 4);
    S.pumpers = (S.pumpers || 0) + 6;
    game.audio?.play('splash', p);
    game.renderer?.emit?.(x, y + 1, z, { n: 8, color: ['#8cc4f0', '#e0f4ff'], up: 30, life: 0.5 });
    game.ui.msg(before > 0.02 ? `You work the pump: the water in her falls (${Math.round(S.flood * 100)}% flooded now).` : 'You work the pump: she\'s dry enough.', '#80c8ff');
    return true;
  }
  const [lx, ly, lz] = holdLocal(S, x, y, z);
  const gi = S.m.guns.findIndex((g) => !g.deck && g.x === lx && g.y === ly && g.z === lz);
  if (gi < 0) return false;
  const st = S.guns[gi];
  if (st && st.cd > 0) {
    game.ui.msg('Still swabbing her out: a moment.', '#c8c8c8');
    return true;
  }
  const shot = S.ammo > 0 ? 'ship' : countItem(p.inv, 'cannonball') > 0 ? 'mine' : null;
  if (!shot) {
    game.ui.msg('No shot for her: cannonballs are made at an anvil.', '#ffb080');
    return true;
  }
  if (!fireGun(game, S, gi, p)) {
    game.ui.msg('Her port\'s stove in: she can\'t fire through it.', '#ffb080');
    return true;
  }
  if (shot === 'ship') S.ammo--;
  else removeItem(p.inv, 'cannonball', 1);
  return true;
}
