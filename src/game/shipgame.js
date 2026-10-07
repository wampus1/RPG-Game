// The great ships and you (round 68): what your keys and mouse do aboard
// one, or beside one (see ships3d.js for the ships themselves). F at her
// wheel or a gun takes it (or lets it go); F beside her climbs aboard. A
// click at the wheel fires a broadside, at a gun fires it. Pointing at
// her: hold the button to knock a plank out (an axe does it quicker),
// right-click with planks to mend a hole.
import { B, BLOCKS } from '../world/blocks.js';
import { REACH } from '../config.js';
import { shipsOf, shipById, deckInteract, deckClick, boardAt, breakVoxel, mendWith, holeBeside, saveShips, loadShips, putAboard, deckSpotNear, MENDS, shipAtWorld, waterSpot, addShip, ownerId, entrances, walkAboard, deckStep } from './ships3d.js';
import { holeAt, cellScreen } from '../render/shipvox.js';
import { SHIP_TYPES } from '../world/shipmodels.js';
import { makeCrew, addHand } from './shipcrew.js';
import { fleetsSave, fleetsLoad } from './shipfleets.js';
import { enterHold, holdShipAt, holdLocal } from './shiphold.js';
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
  return { ships: saveShips(game), deck: p.deck ? { s: p.deck.s, cx: p.deck.cx, cz: p.deck.cz, y: p.deck.y } : null, below, seq: game.shipSeq || 0, fleets: fleetsSave(game) };
}

export function shipLoad(game, data) {
  if (!data) return;
  loadShips(game, data.ships);
  fleetsLoad(game, data.fleets);
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
  if (held.shipKit) {
    const type = held.shipKit;
    if (p.deck || game.world.inInstance(p.x)) {
      game.ui.msg('Ashore, by open water, to launch her.', '#ffb080', true);
      return true;
    }
    const at = waterSpot(game, type, p.x, p.z, 3);
    if (!at || Math.hypot(at.x - p.x, at.z - p.z) > 34) {
      game.ui.msg('She needs open water, deep and wide, close by: stand on the shore of the sea or a great lake.', '#ffb080', true);
      return true;
    }
    const T = SHIP_TYPES[type];
    const crewN = { sloop: 2, brigantine: 4, galleon: 8, frigate: 7 }[type] || 2;
    const name = `The ${OWN_NAMES[(shipsOf(game).length * 7 + Math.floor(Math.random() * 12)) % OWN_NAMES.length]}`;
    addShip(game, {
      type, x: at.x, z: at.z, yaw: at.yaw, owner: ownerId(game, p), name, anchor: true, ammo: Math.round(T.speed),
      crew: makeCrew(Math.floor(Math.random() * 1e9), type, game.hero && game.hero.style ? game.hero.style : 'vale', crewN), paint: '#2a4a8a', paint2: '#1a1a20', flag: '#e0c040', emblem: 'stripe',
    });
    removeItem(p.inv, held.key, 1);
    game.audio?.play('splash', { x: at.x, y: 6, z: at.z });
    game.ui.msg(`${name} slides into the water, ${Math.round(Math.hypot(at.x - p.x, at.z - p.z))} paces off: a ${T.name.toLowerCase()} of your own, her crew aboard. (F beside her to climb aboard; F at her wheel to take it.)`, '#a0d8ff');
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
