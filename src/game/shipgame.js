// The great ships and you (round 68): what your keys and mouse do aboard
// one, or beside one (see ships3d.js for the ships themselves). F at her
// wheel or a gun takes it (or lets it go); F beside her climbs aboard. A
// click at the wheel fires a broadside, at a gun fires it. Pointing at
// her: hold the button to knock a plank out (an axe does it quicker),
// right-click with planks to mend a hole.
import { B, BLOCKS } from '../world/blocks.js';
import { REACH, NPC_STEP_TIME, SURFACE } from '../config.js';
import { shipsOf, shipById, deckInteract, deckClick, boardAt, breakVoxel, mendWith, holeBeside, saveShips, loadShips, putAboard, deckSpotNear, MENDS, shipAtWorld, waterSpot, addShip, ownerId, entrances, walkAboard, deckStep, deckPath, leaveDeck, sailable, Ship } from './ships3d.js';
import { holeAt, cellScreen } from '../render/shipvox.js';
import { SHIP_TYPES, shipModel } from '../world/shipmodels.js';
import { bottledKey } from '../world/items.js';
import { makeCrew, addHand } from './shipcrew.js';
import { fleetsSave, fleetsLoad } from './shipfleets.js';
import { enterHold, holdShipAt, holdLocal, closeHold } from './shiphold.js';
import { addItem, removeItem } from './inventory.js';

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

// (Round 69) A ship in a bottle in your hand: her ghost on the water where
// she'd go if you uncorked her now: where you point (if it's within 34
// paces), else the nearest open water; lying across the way from you (R
// turns her). Red, and where she'd strike marked, if any of her would be
// on something that isn't open water (or on another ship).
export function shipGhostTick(game) {
  const p = game.player;
  const held = p && p.heldDef ? p.heldDef() : null;
  if (!held || !held.shipKit || p.deck || p.raft || p.dead || game.cutscene || game.world.inInstance(p.x)) {
    game.shipGhost = null;
    return;
  }
  const type = held.shipKit;
  const c = game.cursor;
  let at = null;
  if (c && c.x !== undefined && !c.ship && Math.hypot(c.x - p.x, c.z - p.z) <= 34) {
    let a = Math.atan2(c.x - p.x, c.z - p.z);
    a = Math.round(a / (Math.PI / 8)) * (Math.PI / 8);
    at = { x: c.x, z: c.z, yaw: a + Math.PI / 2 };
  } else {
    const A = game.shipGhostAuto;
    if (!A || A.type !== type || Math.hypot(A.px - p.x, A.pz - p.z) > 4) game.shipGhostAuto = { type, px: p.x, pz: p.z, at: openWaterNear(game, type, p.x, p.z) };
    at = game.shipGhostAuto.at;
  }
  if (!at) {
    game.shipGhost = null;
    return;
  }
  const yaw = (((at.yaw + (p.rot || 0) * (Math.PI / 2)) % TAU_) + TAU_) % TAU_;
  const key = `${type},${at.x},${at.z},${yaw.toFixed(3)}`;
  const G0 = game.shipGhost;
  if (G0 && G0.key === key) return;
  const bad = ghostBad(game, type, at.x, at.z, yaw);
  const ghosts = (game.ghostShips ||= {});
  const S = (ghosts[type] ||= new Ship({ id: -1, type, x: at.x, z: at.z, yaw, name: 'ghost', crew: [], anchor: true }));
  game.shipGhost = { key, type, S, x: at.x, z: at.z, yaw, ok: !bad.length, bad, wy: SURFACE };
}
const TAU_ = Math.PI * 2;

// Where of her (world cells round her waterline) she'd be on something.
function ghostBad(game, type, x, z, yaw) {
  const m = shipModel(type);
  const probe = { m, x, z, yaw, toWorld: Ship.prototype.toWorld };
  const out = [];
  const seen = new Set();
  for (const q of m.perim) {
    const [wx, wz] = probe.toWorld(q.x, q.z);
    const tx = Math.round(wx);
    const tz = Math.round(wz);
    const k = `${tx},${tz}`;
    if (seen.has(k)) continue;
    seen.add(k);
    if (!sailable(game, tx, tz) || shipAtWorld(game, tx, tz)) out.push([tx, tz]);
  }
  return out;
}

// The nearest open water a ship of `type` fits in, within 34 paces of
// (x, z) (and lying along the shore), or null.
function openWaterNear(game, type, x, z) {
  for (let R = 6; R <= 32; R += 3) {
    const n = Math.max(12, Math.round(R));
    for (let k = 0; k < n; k++) {
      const a = (k / n) * TAU_;
      const px = Math.round(x + Math.sin(a) * R);
      const pz = Math.round(z + Math.cos(a) * R);
      if (!sailable(game, px, pz)) continue;
      for (const yaw of [a + Math.PI / 2, a - Math.PI / 2, a, a + Math.PI]) if (!ghostBad(game, type, px, pz, yaw).length) return { x: px, z: pz, yaw };
    }
  }
  return null;
}

// (Round 69) A ship bottle used beside (or aboard) a ship of your own: she
// shrinks into it, her crew, whoever came aboard with you, her stores and
// every hole in her with her. (Kept with the world: game.shipBottles.)
function bottleShip(game, p, held) {
  const S = p.deck ? shipById(game, p.deck.s) : holdShipAt(game, p.x) || nearShip(game, p, 5);
  if (!S || S.owner !== ownerId(game, p)) {
    game.ui.msg('Beside a ship of your own, or aboard her, to put her in the bottle.', '#ffb080', true);
    return true;
  }
  if (S.sinking || S.fight) {
    game.ui.msg(S.sinking ? 'Too late for that: she\'s going down.' : 'Not in the thick of a fight.', '#ffb080', true);
    return true;
  }
  if (game.remote) {
    game.ui.msg('Only the world\'s host can bottle a ship.', '#ffb080', true);
    return true;
  }
  const aboard = (q) => q && ((q.deck && q.deck.s === S.id) || (S.hold && S.hold.has(q)));
  if ((game.everyone ? game.everyone() : []).some((q) => q !== p && aboard(q))) {
    game.ui.msg('Not with anyone else aboard her.', '#ffb080', true);
    return true;
  }
  game.shipBottles ||= {};
  const n = (game.shipBottleSeq = (game.shipBottleSeq || 0) + 1);
  // You: off her first (ashore, if there's a bank near; or in the sea).
  const youAboard = aboard(p);
  if (youAboard) {
    if (p.deck) leaveDeck(game, p);
    p.belowShip = null;
    const spot = shoreNear(game, S) || seaBeside(game, S);
    p.teleport(spot.x, spot.y, spot.z);
    if (!game.seat || game.seat.host) game.renderer && (game.renderer.camInit = false);
  }
  // Her crew as they are now.
  for (const c of game.sailors || []) if (c.shipId === S.id && c.recRef) c.recRef.hp = c.hp;
  // Whoever came aboard with you: in the bottle with her.
  const folk = [];
  const car = game.sim && game.sim.careers;
  for (const q of [...(game.npcs || [])]) {
    if (q.dead || !aboard(q)) continue;
    if (car && car.ent === q && car.escort) {
      car.escort.bottled = n;
      car.ent = null;
      folk.push({ escort: true, name: q.rec.name });
    } else folk.push({ name: q.rec.name, sid: q.settlement && q.settlement.id, idx: q.rec.idx });
    if (q.deck) leaveDeck(game, q);
    q.belowShip = null;
    q.rec.away = true;
    game.despawnNpc(q);
  }
  if (S.hold) closeHold(game, S, false);
  for (const c of game.sailors || []) if (c.shipId === S.id) game.removeOcc?.(c);
  game.sailors = (game.sailors || []).filter((c) => c.shipId !== S.id);
  const rec = S.save();
  rec.crew = S.crewRecs.filter((r) => !r.dead);
  game.shipBottles[n] = { ...rec, id: undefined, folk, day: game.day };
  game.ships3d = shipsOf(game).filter((q) => q !== S);
  // A swirl of spray and a wink of light, and she's gone.
  const r = game.renderer;
  if (r && r.emit) {
    r.emit(S.x, 7, S.z, { n: 40, color: ['#ffffff', '#c8e8ff', '#80b8e0', '#fff0a0'], up: 70, speed: 60, gravity: 40, life: 1.2, glow: true });
    r.emit(S.x, 6, S.z, { n: 18, color: ['#ffffff', '#d8f0ff'], up: 30, speed: 30, gravity: -20, life: 1.4, shape: 'puff', size: 3 });
  }
  game.audio?.play('splash', { x: Math.round(S.x), y: 6, z: Math.round(S.z) });
  game.audio?.play('ship_bell');
  removeItem(p.inv, held.key, 1);
  p.give(bottledKey(S.type, n, S.name), 1);
  const who = rec.crew.length + folk.length;
  game.ui.msg(`${S.name} shrinks away into the bottle, ${who ? `${who} aboard her with her` : 'empty decks and all'}. (Right-click by open water to uncork her again.)`, '#a0d8ff');
  return true;
}

// A bottled ship of yours, uncorked at `at`.
function uncork(game, p, held, at) {
  const rec = (game.shipBottles || {})[held.bottled];
  removeItem(p.inv, held.key, 1);
  if (!rec) {
    game.ui.msg('The bottle\'s empty: whatever was in it is long gone.', '#c8c8c8', true);
    p.give('ship_bottle', 1);
    return true;
  }
  delete game.shipBottles[held.bottled];
  const S = addShip(game, { ...rec, id: undefined, x: at.x, z: at.z, yaw: at.yaw, anchor: true, owner: ownerId(game, p), sailSet: 0 });
  // Whoever went into the bottle with her: aboard her again.
  const car = game.sim && game.sim.careers;
  for (const f of rec.folk || []) {
    let q = null;
    if (f.escort && car && car.escort && car.escort.bottled === held.bottled) {
      delete car.escort.bottled;
      q = car.ent = game.spawnEscort ? game.spawnEscort(car.escort) : null;
    } else if (f.sid !== undefined && f.sid !== null) {
      const L = game.sim.layoutOf && game.sim.layoutOf(f.sid);
      const r0 = L && L.npcs[f.idx];
      if (r0) r0.away = false;
    }
    if (!q) continue;
    const spot = deckSpotNear(S, S.m.spawn.x + 0.5, S.m.spawn.z + 0.5, 6, null);
    if (spot) putAboard(game, S, q, spot.cx, spot.y, spot.cz);
  }
  uncorkFx(game, p, at);
  const n = (rec.crew || []).length;
  game.ui.msg(`Out of the bottle and into the water: ${S.name}, just as she was${n ? `, her ${n === 1 ? 'one hand' : `${n} hands`} aboard` : ''}.`, '#a0d8ff');
  return true;
}

function uncorkFx(game, p, at) {
  game.audio?.play('splash', { x: at.x, y: 6, z: at.z });
  game.audio?.play('select');
  const r = game.renderer;
  if (r && r.emit) {
    r.emit(p.x, p.y + 1, p.z, { n: 10, color: ['#ffffff', '#d8f0ff', '#fff0a0'], up: 40, speed: 30, gravity: 60, life: 0.6, glow: true });
    r.emit(at.x, 6, at.z, { n: 36, color: ['#ffffff', '#c8e8ff', '#80b8e0'], up: 80, speed: 50, gravity: 140, life: 1.1 });
  }
}

// The nearest bank to her you could stand on (within a dozen paces of her
// side), or null.
function shoreNear(game, S) {
  const w = game.world;
  let best = null;
  let bd = Infinity;
  const R = Math.ceil(S.m.L / 2) + 12;
  for (let dz = -R; dz <= R; dz += 1) for (let dx = -R; dx <= R; dx += 1) {
    const x = Math.round(S.x) + dx;
    const z = Math.round(S.z) + dz;
    if (shipAtWorld(game, x, z)) continue;
    const y = w.findStandY(x, z, 8);
    if (y < 0 || w.isWaterAt(x, y, z) || w.isWaterAt(x, y - 1, z)) continue;
    const d = Math.hypot(dx, dz);
    if (d < bd) {
      bd = d;
      best = { x, y, z };
    }
  }
  return best && bd <= R ? best : null;
}

function seaBeside(game, S) {
  const [wx, wz] = S.toWorld(-1.5, S.m.L / 2);
  const x = Math.round(wx);
  const z = Math.round(wz);
  const y = game.world.findStandY(x, z, 8);
  return { x, y: y >= 0 ? y : 5, z };
}

// (Round 69) Whoever's with you (a hired escort, a companion) when you
// go aboard a ship: up her side after you, about her deck at your heels,
// down her hatch when you go below and up again when you come up; ashore
// when you are. True if it was theirs to see to (see NPC.hiredDuty).
export function npcAboard(game, n, dt) {
  const p = game.player;
  const pS = p.deck ? shipById(game, p.deck.s) : holdShipAt(game, p.x);
  const nS = n.deck ? shipById(game, n.deck.s) : holdShipAt(game, n.x);
  if (!pS && !nS) return false;
  n.aboardT = (n.aboardT || 0) + dt;
  // You've gone ashore (or aboard another): after you, in a moment.
  if (nS && pS !== nS) {
    if (n.aboardT < 1.4) return true;
    n.aboardT = 0;
    n.task = null;
    if (n.deck) leaveDeck(game, n);
    n.belowShip = null;
    if (pS) return putNear(game, pS, n, p);
    const spot = besideYou(game, p);
    n.teleport(spot.x, spot.y, spot.z);
    n.path = null;
    return true;
  }
  // You aboard and they're not yet: up her side after you.
  if (pS && !nS) {
    if (n.aboardT < 1.2) return false;
    n.aboardT = 0;
    return putNear(game, pS, n, p);
  }
  const S = pS;
  // Both below: they follow you about her as anywhere.
  if (!n.deck && !p.deck) return false;
  // Below, and you've gone up: up after you.
  if (!n.deck && p.deck) {
    if (n.aboardT < 1.6) return true;
    n.aboardT = 0;
    return putNear(game, S, n, p);
  }
  const d = n.deck;
  if (d.mv) return true;
  const t = n.task;
  if (t && t.path && t.path.length) {
    const [nx, , nz] = t.path[0];
    if (deckStep(game, S, n, Math.sign(nx - d.cx), Math.sign(nz - d.cz), NPC_STEP_TIME * 0.8)) t.path.shift();
    else t.path = null;
    return true;
  }
  n.task = null;
  // You've gone below: to the way down nearest where you are, and down.
  if (!p.deck) {
    if (n.aboardT < 0.8) return true;
    n.aboardT = 0;
    const [lx, , lz] = holdLocal(S, p.x, p.y, p.z);
    const E = entrances(S.m).slice().sort((a, b) => Math.hypot(a.inX - lx, a.inZ - lz) - Math.hypot(b.inX - lx, b.inZ - lz))[0];
    const path = E && deckPath(S, { x: d.cx, y: d.y, z: d.cz }, { x: E.x, y: E.y, z: E.z });
    if (path) {
      path.push([E.x + E.dx, E.y, E.z + E.dz]);
      n.task = { kind: 'go', path };
    } else putNear(game, S, n, p);
    return true;
  }
  // About her deck at your heels.
  const gap = Math.max(Math.abs(d.cx - p.deck.cx), Math.abs(d.cz - p.deck.cz));
  if (gap > 2 || Math.abs(d.y - p.deck.y) > 2) {
    if (n.aboardT < 0.5) return true;
    n.aboardT = 0;
    const path = deckPath(S, { x: d.cx, y: d.y, z: d.cz }, { x: p.deck.cx, y: p.deck.y, z: p.deck.cz });
    if (path && path.length > 1) n.task = { kind: 'go', path: path.slice(0, -1) };
  } else if (Math.random() < dt * 0.3) n.face(p.x, p.z);
  return true;
}

// A free spot a pace behind `p` (not where they stand).
function besideYou(game, p) {
  const [dx, dz] = [[0, -1], [1, 0], [0, 1], [-1, 0]][p.dir] || [0, -1];
  for (const [ox, oz] of [[dx, dz], [-dz, dx], [dz, -dx], [-dx, -dz]]) {
    const spot = game.findFreeSpot ? game.findFreeSpot(p.x + ox, p.z + oz, p.y) : null;
    if (spot && (spot.x !== p.x || spot.z !== p.z)) return spot;
  }
  return { x: p.x, y: p.y, z: p.z };
}

// Put `n` aboard S beside `p` (on her deck, or below with them).
function putNear(game, S, n, p) {
  n.path = null;
  if (p.deck) {
    const spot = deckSpotNear(S, p.deck.cx + 0.5, p.deck.cz + 0.5, 3, p.deck.y);
    if (!spot) return true;
    putAboard(game, S, n, spot.cx, spot.y, spot.cz);
  } else {
    const spot = besideYou(game, p);
    if (n.deck) leaveDeck(game, n);
    n.teleport(spot.x, spot.y, spot.z);
    n.belowShip = S.id;
  }
  return true;
}

// (Round 69) For rafts (see raft.js): is there a ship's hull at world
// (x, z) (a raft's half a pace about it)?
export function hullAt(game, x, z) {
  const hit = shipAtWorld(game, x, z, 0.4);
  return hit && !(hit.S.sinking > 2) ? hit : null;
}

// A raft running into a ship at (x, z): yours, and you make the raft fast
// and climb up her side ('board', the raft back in your pack); anyone
// else's, it's a bump against her planks ('block'). Null if no ship.
export function raftMeetsShip(game, p, x, z) {
  const hit = hullAt(game, x, z);
  if (!hit) return null;
  const S = hit.S;
  if (p.kind !== 'player' || S.sinking || !S.owner || S.owner !== ownerId(game, p)) return 'block';
  if (!boardAt(game, S, p, x, z)) return 'block';
  p.raft = null;
  p.give?.('raft', 1);
  game.asPlayer(p, () => game.ui.msg('You make the raft fast and climb up her side (the raft\'s in your pack).', '#a0d8ff', true));
  game.audio?.play('splash');
  return 'board';
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

// (Round 69) What of hers is at cell vi to be used with a click: her
// wheel, a gun on her deck, a hatch or a cabin door (and their coamings
// and steps), her capstan. Null if nothing.
export function fittingAt(S, vi) {
  const m = S.m;
  const x = vi % m.W;
  const z = Math.floor(vi / m.W) % m.L;
  const y = Math.floor(vi / (m.W * m.L));
  const id = S.vox[vi];
  if (x === m.helm.x && z === m.helm.z && Math.abs(y - m.helm.y) <= 1 && S.vox[(m.helm.y * m.L + m.helm.z) * m.W + m.helm.x] === B.helm) return { kind: 'helm' };
  if (id === B.ship_cannon) {
    const gi = m.guns.findIndex((g) => g.deck && g.x === x && g.y === y && g.z === z);
    if (gi >= 0) return { kind: 'gun', gi };
  }
  if (id === B.capstan) return { kind: 'capstan' };
  for (const E of entrances(m)) {
    if (E.kind === 'hatch') {
      const h = m.hatches.find((q) => q.top && q.x === E.x);
      if (h && x >= h.x - 1 && x <= h.x + 1 && z >= h.z - 1 && z <= h.z + h.n - 1 && y >= h.D && y <= h.U + 1) return { kind: 'below', E };
    } else if (x === E.inX && z === E.inZ && y >= E.y - 1 && y <= E.y + 2) return { kind: 'below', E };
  }
  return null;
}

// (Round 69) Pointing near her wheel (its spokes stand up over its cell)
// or one of her deck guns on the screen: that, though the pointer's on
// what's beside it.
function fittingNear(game, S, mx, my) {
  const r = game.renderer;
  if (!r || mx === undefined || !S.drawn) return null;
  const m = S.m;
  const h = m.helm;
  if (S.vox[(h.y * m.L + h.z) * m.W + h.x] === B.helm) {
    const s = cellScreen(r, S, h.x, h.y, h.z);
    if (s && Math.abs(mx - s.x) <= 7 && my >= s.y - 15 && my <= s.y + 5) return { kind: 'helm' };
  }
  let best = null;
  let bd = 7;
  m.guns.forEach((g, gi) => {
    if (!g.deck || S.vox[(g.y * m.L + g.z) * m.W + g.x] !== B.ship_cannon) return;
    const s = cellScreen(r, S, g.x, g.y, g.z);
    const d = s ? Math.hypot(mx - s.x, my - s.y) : Infinity;
    if (d < bd) {
      bd = d;
      best = { kind: 'gun', gi };
    }
  });
  return best;
}

// A fitting of hers clicked: walked to, and used (climbing aboard first,
// from beside her).
function useFitting(game, p, S, f) {
  const m = S.m;
  if (!p.deck || p.deck.s !== S.id) {
    if (p.deck || !boardAt(game, S, p, p.x, p.z)) return false;
  }
  const d = p.deck;
  if (f.kind === 'helm') {
    if (S.owner && S.owner !== ownerId(game, p) && !game.cheats?.ships) {
      game.ui.msg('She\'s not your ship: her crew won\'t let you near the wheel.', '#ffb080', true);
      return true;
    }
    const st = m.helm.stand;
    if (!walkAboard(game, p, S, { x: st.x, y: st.y, z: st.z }, { kind: 'helm' })) game.ui.msg('No way to her wheel from here.', '#c8c8c8', true);
    return true;
  }
  if (f.kind === 'gun') {
    const g = m.guns[f.gi];
    const to = deckSpotNear(S, g.x - g.side + 0.5, g.z + 0.5, 1, g.y);
    if (!to || !walkAboard(game, p, S, { x: to.cx, y: to.y, z: to.cz }, { kind: 'gun', gi: f.gi })) game.ui.msg('No way to that gun from here.', '#c8c8c8', true);
    return true;
  }
  if (f.kind === 'capstan') {
    if (S.owner && S.owner !== ownerId(game, p) && !game.cheats?.ships) return true;
    if (Math.hypot(d.cx - (m.deckProps.find((q) => q.id === B.capstan) || d).x, d.cz - (m.deckProps.find((q) => q.id === B.capstan) || d).z) > 3) {
      game.ui.msg('Closer to the capstan, to work it.', '#c8c8c8', true);
      return true;
    }
    S.anchor = !S.anchor;
    if (S.anchor) S.sailGoal = 0;
    game.ui.msg(S.anchor ? 'You let go the anchor: the cable runs out.' : 'You heave at the capstan: the anchor\'s aweigh!', '#a0d8ff', true);
    game.audio?.play(S.anchor ? 'chain' : 'select');
    return true;
  }
  if (f.kind === 'below') {
    const E = f.E;
    if (d.cx === E.x && d.cz === E.z) deckStep(game, S, p, E.dx, E.dz, 0.25);
    else if (!walkAboard(game, p, S, { x: E.x, y: E.y, z: E.z }, { kind: 'below', E })) game.ui.msg('No way down there from here.', '#c8c8c8', true);
    return true;
  }
  return false;
}

// (Round 69) The hole a plank held up to her would go in: where the
// pointer is on her (beside the face pointed at), or the hole nearest the
// pointer on any ship close by (from outside, looking in through a hole,
// the pointer's on what's beyond it). { S, vi, far } or null.
function mendTarget(game, p, c) {
  const r = game.renderer;
  const tries = [];
  if (c && c.ship) {
    const S = shipById(game, c.ship.s);
    if (S) {
      const vi = holeBeside(S, c.ship.vi, c.ship.face);
      if (vi >= 0) tries.push({ S, vi });
    }
  }
  if (!tries.length && c && r) {
    for (const S of shipsOf(game)) {
      if (!S.drawn || Math.hypot(S.x - p.x, S.z - p.z) > S.m.L / 2 + 8) continue;
      const vi = holeAt(r, S, c.mx, c.my);
      if (vi >= 0) {
        tries.push({ S, vi });
        break;
      }
    }
  }
  const t = tries[0];
  if (!t) return null;
  const m = t.S.m;
  const x = t.vi % m.W;
  const z = Math.floor(t.vi / m.W) % m.L;
  const y = Math.floor(t.vi / (m.W * m.L));
  const [wx, wz] = t.S.toWorld(x + 0.5, z + 0.5);
  t.far = Math.hypot(wx - p.x, wz - p.z) > REACH + 1.5 || Math.abs(t.S.layerY(y) - p.y) > 5;
  return t;
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
  const held = p.heldDef();
  let used = false;
  // (Round 69) Planks in hand: a hole of hers mended, from inside or out
  // (a click to place them, as anywhere, or the right button).
  if (held && MENDS(held.key) && !(c && c.entity)) {
    for (const ck of clicks) {
      if (ck.type !== 'down' || (ck.button !== 0 && ck.button !== 2)) continue;
      const t = mendTarget(game, p, c);
      if (!t) {
        if (c && c.ship) {
          game.ui.msg('Nothing there to mend.', '#c8c8c8', true);
          used = true;
        }
        continue;
      }
      used = true;
      game.shipClickHeld = true;
      if (t.far) game.ui.msg('Closer, to mend her there.', '#c8c8c8', true);
      else mendWith(game, p, t.S, t.vi);
    }
  }
  if (!input.mouse.down) game.shipClickHeld = false;
  if (!c || !c.ship) {
    game.shipMining = null;
    return used;
  }
  const S = shipById(game, c.ship.s);
  if (!S) return used;
  for (const ck of clicks) {
    if (ck.type !== 'down' || used) continue;
    // Her wheel, a gun, a hatch, a door, the capstan: used.
    const f = fittingAt(S, c.ship.vi) || fittingNear(game, S, c.mx, c.my);
    if (f && (ck.button === 0 || ck.button === 2) && (p.deck ? p.deck.s === S.id : c.inReach)) {
      useFitting(game, p, S, f);
      game.shipClickHeld = true;
      game.shipMining = null;
      continue;
    }
    if (ck.button === 2 && !p.deck && c.inReach) boardAt(game, S, p, p.x, p.z);
  }
  // Holding the button on her: knocking a plank out.
  if (input.mouse.down && !game.shipClickHeld && c.inReach && !(held && (held.kind === 'weapon' || MENDS(held.key)))) {
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
    M.k = Math.min(1, M.t / need);
    const x = vi % m.W;
    const z = Math.floor(vi / m.W) % m.L;
    const y = Math.floor(vi / (m.W * m.L));
    const [wx, wz] = S.toWorld(x + 0.5, z + 0.5);
    // (Round 69) Chips flying, and the knock of it, as it gives.
    if (Math.random() < dt * 10) {
      game.renderer?.emit(wx, S.layerY(y) + 0.6, wz, { n: 3, color: woodChips(b), up: 26, speed: 32, gravity: 140, life: 0.45, shape: 'shard' });
      p.actionTimer = 0.2;
    }
    M.knockT = (M.knockT ?? 0) - dt;
    if (M.knockT <= 0) {
      M.knockT = 0.34;
      game.audio?.play('chop', { x: Math.round(wx), y: Math.round(S.layerY(y)), z: Math.round(wz) });
    }
    if (M.t >= need) {
      game.shipMining = null;
      if (breakVoxel(game, S, vi, 'knocked')) {
        const drop = b.drop === undefined ? b.name : b.drop;
        if (typeof drop === 'string') addItem(p.inv, drop, 1);
      }
    }
  } else game.shipMining = null;
  game.mining = null;
  return true;
}

// The colours of the chips off a plank of hers.
function woodChips(b) {
  const n = b && b.name;
  if (n === 'gilt_trim') return ['#e8c050', '#a07820', '#fff0a0'];
  if (n === 'copper_sheath') return ['#c87840', '#5aa088', '#e8a060'];
  if (n === 'stern_window') return ['#c8e0f0', '#ffffff', '#88a8c0'];
  return ['#8a6438', '#c8a070', '#5a3e20'];
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
  const p = game.player;
  c.face(p.x, p.z);
  const S = c.shipId !== null && c.shipId !== undefined ? shipById(game, c.shipId) : null;
  const line = lines[Math.floor(Math.random() * lines.length)];
  // (Round 69) A word with them, and (her own crew) orders.
  if (!game.ui || !game.ui.openModTalk) return void c.say(line, 3.5);
  const mine = S && S.owner && S.owner === ownerId(game, p);
  const talk = (text, choices, onPick) => game.ui.openModTalk({ game, speaker: c, text, choices, onPick, x: { game, player: p } });
  if (!mine) {
    const bound = S && S.route && S.route.length ? 'We\'re bound away soon, wind willing.' : 'We lie here a while yet.';
    return talk(line, ['Where are you bound?', 'Fair winds.'], (i) => {
      if (i === 0) talk(bound, ['Fair winds.'], null);
    });
  }
  const role = c.role === 'gunner' ? 'gunner' : c.role === 'marine' ? 'marine' : 'hand';
  talk(`${line} (${c.name.first || c.name}, ${role} of ${S.name}.) Orders, captain?`, ['Man the guns.', 'Below, and work the pump.', 'Carry on.', 'You\'re paid off: go ashore.'], (i) => {
    if (i === 0) {
      c.order = 'guns';
      c.task = null;
      c.say('Aye, captain! To the guns!', 2.5);
    } else if (i === 1) {
      c.order = 'pump';
      c.task = null;
      c.say('Aye! Below to the pump!', 2.5);
    } else if (i === 2) {
      c.order = null;
      c.say('Aye aye.', 2);
    } else if (i === 3) {
      S.crewRecs = S.crewRecs.filter((r) => r !== c.recRef);
      c.paidOff = true;
      c.say('Fair enough. I\'ll find another berth.', 3);
    }
  });
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
  return { ships: saveShips(game), deck: p.deck ? { s: p.deck.s, cx: p.deck.cx, cz: p.deck.cz, y: p.deck.y } : null, below, seq: game.shipSeq || 0, fleets: fleetsSave(game), bottles: game.shipBottles || {}, bseq: game.shipBottleSeq || 0 };
}

export function shipLoad(game, data) {
  if (!data) return;
  loadShips(game, data.ships);
  fleetsLoad(game, data.fleets);
  // (Round 69) Ships of yours in bottles.
  game.shipBottles = data.bottles || {};
  game.shipBottleSeq = data.bseq || 0;
  const p = game.player;
  const at = data.deck || data.below;
  const S = at ? shipById(game, at.s) : null;
  if (!S) return;
  if (data.deck) {
    const spot = deckSpotNear(S, data.deck.cx + 0.5, data.deck.cz + 0.5, 4, data.deck.y);
    if (spot) putAboard(game, S, p, spot.cx, spot.y, spot.cz);
  } else enterHold(game, S, p, data.below.lx, data.below.ly, data.below.lz);
}

// A ship of yours to launch (from what you're holding): on the open water
// nearest you; or a sailor signed on, aboard your own ship. True if the
// thing held was one of these.
const OWN_NAMES = ['Sea Lark', 'Wandering Star', 'Fortune', 'Grey Gull', 'Second Chance', 'Morning Tide', 'Salt Rose', 'Kestrel', 'Long Shot', 'Fair Weather', 'Last Light', 'Swift'];
export function useShipItem(game, held) {
  const p = game.player;
  if (held.shipBottle) return bottleShip(game, p, held);
  if (held.shipKit) {
    const type = held.shipKit;
    if (p.deck || game.world.inInstance(p.x)) {
      game.ui.msg('Ashore, by open water, to launch her.', '#ffb080', true);
      return true;
    }
    // (Round 69) Where her ghost shows her (see shipGhostTick): there, if
    // she fits there.
    const G = game.shipGhost;
    if (G && G.type === type && !G.ok) {
      game.ui.msg('She won\'t fit there: her ghost is red where she\'d be on land, rock or another ship. Point at open water (R turns her).', '#ffb080', true);
      return true;
    }
    const at = G && G.type === type ? { x: G.x, z: G.z, yaw: G.yaw } : waterSpot(game, type, p.x, p.z, 3);
    if (!at || Math.hypot(at.x - p.x, at.z - p.z) > 34) {
      game.ui.msg('She needs open water, deep and wide, close by: stand on the shore of the sea or a great lake.', '#ffb080', true);
      return true;
    }
    const T = SHIP_TYPES[type];
    // A ship of yours bottled before: out again just as she was.
    if (held.bottled !== undefined) return uncork(game, p, held, at);
    const name = `The ${OWN_NAMES[(shipsOf(game).length * 7 + Math.floor(Math.random() * 12)) % OWN_NAMES.length]}`;
    // (Round 69) No crew: you sign them on (Sailor's Articles).
    addShip(game, {
      type, x: at.x, z: at.z, yaw: at.yaw, owner: ownerId(game, p), name, anchor: true, ammo: Math.round(T.speed),
      crew: [], paint: '#2a4a8a', paint2: '#1a1a20', flag: '#e0c040', emblem: 'stripe',
    });
    removeItem(p.inv, held.key, 1);
    uncorkFx(game, p, at);
    game.ui.msg(`Out of the bottle and into the water, ${Math.round(Math.hypot(at.x - p.x, at.z - p.z))} paces off: ${name}, a ${T.name.toLowerCase()} of your own. She has no crew yet: sign sailors on aboard her with Sailor's Articles (a shipwright sells them). (F beside her to climb aboard; F at her wheel to take it.)`, '#a0d8ff');
    return true;
  }
  if (held.key === 'sailors_articles') {
    const S = p.deck ? shipById(game, p.deck.s) : null;
    if (!S || S.owner !== ownerId(game, p)) {
      game.ui.msg('Aboard a ship of your own, to sign a sailor on.', '#ffb080', true);
      return true;
    }
    const rec = makeCrew(Math.floor(Math.random() * 1e9), S.type, 'vale', 3)[2];
    rec.role = Math.random() < 0.4 ? 'gunner' : 'sailor';
    S.crewRecs.push(rec);
    addHand(game, S, rec);
    removeItem(p.inv, held.key, 1);
    game.ui.msg(`${rec.name.first || 'A sailor'} signs on as ${rec.role === 'gunner' ? 'a gunner' : 'a hand'} (${S.crewRecs.length} aboard her now).`, '#a0d8ff', true);
    return true;
  }
  return false;
}
