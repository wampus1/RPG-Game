// (Round 78) Pirates. Somewhere out on a lonely shore far from any town
// lies their cove (found by the lie of the world, the same in every
// playing of it): a black-flagged ship or two at anchor in it, and woe to
// whoever sails in. And now and then, rarely, a raider puts out and goes
// hunting: a merchantman under way, or a ship of yours. She comes on with
// her guns run out and fires at range; closing, she throws her grapnels
// across and hauls the two of you together; then her crew come over the
// rail with cutlasses, and her archers loose from her side. Beat them off
// (or sink her first) and what she's plundered is yours. Away from you, a
// voyage may simply be taken: word of it reaches port.
import { REGION_W, REGION_D, GROUND } from '../config.js';
import { RNG, hash4 } from '../util/rng.js';
import { addShip, shipsOf, shipById, waterSpot, boardAt, deckPath, ownerId } from './ships3d.js';
import { makeCrew, crewOf } from './shipcrew.js';
import { SHIP_TYPES } from '../world/shipmodels.js';
import { DAY } from '../sim/econ.js';
import { pidOf } from '../sim/saga/refs.js';

const COVE_NAMES = ['Gallows Cove', 'Blackwater Bight', 'Corsair\'s Rest', 'Rattlebone Inlet', 'Widow\'s Hook', 'Skull Haven'];
const SHIP_NAMES = ['Black Gull', 'Red Widow', 'Sea Wolf', 'Grinning Jack', 'Bloody Mary', 'Kraken\'s Due', 'Hangman\'s Luck'];
const GRAPPLE_AT = 10; // paces between hulls when the grapnels fly
const BOARD_AFTER = 2.5; // seconds lashed together before they come over

function state(game) {
  return (game.pirates ||= { cove: undefined, nextRaid: null, raider: null, taken: 0 });
}

// Where their cove is: the open water off the shore of a lonely isle (the
// far isles first, then the Dagoni Islands, then the great lands), far
// from any town, or null. Found by walking out from the middle of each
// land, a ray at a time, to where its shore meets the sea.
export function coveOf(game) {
  const P = state(game);
  if (P.cove !== undefined) return P.cove;
  const ow = game.world.ow;
  const rng = new RNG(hash4(game.seed >>> 0, 0x9147e));
  const far = (x, z) => ow.settlements.every((s) => Math.hypot((s.cx + s.cw / 2) * REGION_W - x, (s.cz + s.cd / 2) * REGION_D - z) > 260);
  const rank = { isle: 0, dagoni: 1, continent: 2 };
  const lands = [...(ow.lands || [])].sort((a, b) => (rank[a.kind] ?? 3) - (rank[b.kind] ?? 3) || rng.next() - 0.5);
  let best = null;
  for (const L of lands) {
    const cx = (L.x0 + L.x1) / 2;
    const cz = (L.z0 + L.z1) / 2;
    const reach = Math.max(L.x1 - L.x0, L.z1 - L.z0) * 0.75;
    const a0 = rng.next() * Math.PI * 2;
    for (let k = 0; k < 24 && !best; k++) {
      const a = a0 + (k / 24) * Math.PI * 2;
      let wasLand = false;
      for (let r = 0; r < reach; r += 6) {
        const x = Math.round(cx + Math.cos(a) * r);
        const z = Math.round(cz + Math.sin(a) * r);
        const c = ow.continentAt(x, z);
        if (c > 0.05) wasLand = true;
        else if (wasLand && c < -0.02) {
          // (A few paces further out: room for their ships to lie.)
          const ox = Math.round(cx + Math.cos(a) * (r + 18));
          const oz = Math.round(cz + Math.sin(a) * (r + 18));
          if (ow.continentAt(ox, oz) < -0.02 && far(ox, oz) && !(!ow.wallDown && ow.insideStorm && ow.insideStorm(ox, oz))) best = { x: ox, z: oz, shore: { x, z }, land: L.name, name: COVE_NAMES[rng.int(0, COVE_NAMES.length - 1)] };
          break;
        }
      }
    }
    if (best) break;
  }
  P.cove = best;
  return best;
}

const pirates = (game) => shipsOf(game).filter((S) => S.pirate && !S.sinking);
const nearAny = (game, x, z, r) => (game.everyone ? game.everyone() : [game.player]).some((q) => q && !q.dead && Math.hypot(q.x - x, q.z - z) < r);

// A pirate ship, out of nowhere at (x, z): hostile, after `target`.
export function spawnPirate(game, x, z, o = {}) {
  const seed = o.seed ?? Math.floor(Math.random() * 1e9);
  const rng = new RNG(seed >>> 0);
  const type = o.type || (rng.chance(0.6) ? 'brigantine' : 'sloop');
  const at = waterSpot(game, type, Math.round(x), Math.round(z), 0, 60, true);
  if (!at) return null;
  const T = SHIP_TYPES[type];
  const n = T.crew + 4;
  const crew = makeCrew(seed, type, 'vale', n).map((r, i) => ({
    ...r,
    role: i === 0 ? 'captain' : i % 3 === 0 ? 'pirate_archer' : i === 1 ? 'mate' : 'pirate',
    look: { ...r.look, outfit: i === 0 ? 'noble' : 'plain', hat: i === 0 ? 'feather' : rng.pick(['bandana', 'bandana', 'cap', null]), hatColor: rng.pick(['#8a1a1a', '#1a1a1a', '#2a2a5a']), eyepatch: rng.chance(0.25), shirt: rng.pick(['#3a2a2a', '#5a1a1a', '#e8e0d0', '#2a2a2a']) },
    pirate: true,
  }));
  const S = addShip(game, {
    type, x: at.x, z: at.z, yaw: at.yaw ?? 0, name: `The ${SHIP_NAMES[rng.int(0, SHIP_NAMES.length - 1)]}`,
    crew, ammo: 999, paint: '#24222a', paint2: '#0e0c10', flag: '#121212', emblem: 'saltire', anchor: !!o.anchor, sailSet: o.anchor ? 0 : 0.9,
  });
  S.pirate = true;
  S.hostile = true;
  S.transient = true;
  S.plunder = 60 + rng.int(0, 140) + (type === 'brigantine' ? 80 : 0);
  if (o.target) S.fight = o.target.player ? { player: true } : { ship: o.target.id };
  return S;
}

// ------------------------------------------------------------ each tick
export function pirateTick(game, dt) {
  if (game.remote || game.skipping || !game.sim) return;
  const P = state(game);
  P.t = (P.t || 0) - dt;
  // (The ones lashed to someone: hauled alongside, and over the rail.)
  for (const S of pirates(game)) grappleTick(game, S, dt);
  fightTick(game, dt);
  if (P.t > 0) return;
  P.t = 2;
  const cove = coveOf(game);
  // (Sighted from afar: on your map.)
  if (cove && !P.sighted && nearAny(game, cove.x, cove.z, 360)) {
    P.sighted = true;
    game.world.ow.pin(cove.x, cove.z, `${cove.name} (pirates)`, '×');
    game.ui.msg(`Off the shore of ${cove.land}, black sails at anchor: ${cove.name}, a pirates' nest. (Marked on your map.)`, '#ff9070');
  }
  // The cove: a ship or two at anchor while you're near; roused when
  // you come close.
  if (cove && nearAny(game, cove.x, cove.z, 170)) {
    const here = pirates(game).filter((S) => S.cove);
    if (!P.coveDone && here.length < 2 && !P.coveSpawned) {
      P.coveSpawned = true;
      for (let i = 0; i < 2; i++) {
        const S = spawnPirate(game, cove.x + (i ? 24 : -12), cove.z + (i ? 10 : -6), { anchor: true, seed: hash4(game.seed >>> 0, i, 0xc0fe) });
        if (S) S.cove = true;
      }
      if (!P.warned) game.ui.msg(`Black sails at anchor ahead: ${cove.name}. Come in close and they'll come out for you.`, '#ff9070');
      P.warned = true;
    }
    for (const S of here) {
      if (!S.fight && nearAny(game, S.x, S.z, 70)) {
        S.fight = { player: true };
        S.anchor = false;
        S.sailGoal = 0.9;
      }
    }
  } else if (P.coveSpawned && !pirates(game).some((S) => S.cove)) P.coveSpawned = false;
  // A raider, now and then (a day or more apart, and not often).
  const now = game.sim.abs;
  if (P.nextRaid === null) P.nextRaid = now + DAY * (1 + Math.random() * 3);
  if (now >= P.nextRaid && !pirates(game).some((S) => !S.cove)) {
    P.nextRaid = now + DAY * (2 + Math.random() * 4);
    const target = raidTarget(game);
    if (target) {
      const ang = Math.random() * Math.PI * 2;
      const S = spawnPirate(game, target.x + Math.cos(ang) * 70, target.z + Math.sin(ang) * 70, { target: target.S ? target.S : { player: true } });
      if (S && nearAny(game, S.x, S.z, 120)) game.ui.msg(`A sail on the horizon, under black colours: ${S.name}, and she's coming about toward ${target.S && !target.S.owner ? theirName(target.S) : 'you'}!`, '#ff7060');
      // (Word of her reaches the nearest port: see saga/motifs/tides.js.)
      const port = S && nearestPort(game, S.x, S.z);
      if (port) game.sim.saga?.emit('pirate_seen', { sid: port.id, ship: S.id, name: S.name });
    }
  }
}

const theirName = (S) => S.name || 'a merchantman';

// Who a raider goes for: a voyage near one of you (a merchantman, a
// hulk), or your own ship at sea.
function raidTarget(game) {
  const ships = shipsOf(game).filter((S) => !S.pirate && !S.sinking && nearAny(game, S.x, S.z, 140));
  const mine = ships.find((S) => S.owner && !S.anchor && Math.abs(S.v) > 1);
  if (mine) return { S: mine, x: mine.x, z: mine.z };
  const voy = ships.find((S) => S.voyage !== null && S.voyage !== undefined);
  if (voy) return { S: voy, x: voy.x, z: voy.z };
  return null;
}

// ------------------------------------------------------------ grapnels
function foeOf(game, S) {
  const f = S.fight;
  if (!f) return null;
  if (f.ship) return shipById(game, f.ship);
  return null;
}

function grappleTick(game, S, dt) {
  const foe = S.grapple ? shipById(game, S.grapple.ship) : foeOf(game, S);
  if (!foe || foe.sinking || S.sinking) {
    S.grapple = null;
    return;
  }
  const d = Math.hypot(foe.x - S.x, foe.z - S.z);
  const gap = (S.m.W + foe.m.W) / 2 + 1.2;
  if (!S.grapple) {
    if (d - gap > GRAPPLE_AT || !alive(game, S).length) return;
    S.grapple = { ship: foe.id, t: 0, boarded: 0 };
    foe.grappledBy = S.id;
    game.audio?.play('chain', { x: S.x, y: GROUND, z: S.z });
    if (nearAny(game, S.x, S.z, 60)) game.ui.msg(`Grapnels fly from ${S.name}: she's lashing herself to ${foe.owner ? 'your ship' : theirName(foe)}!`, '#ff9070');
  }
  const G = S.grapple;
  G.t += dt;
  // Hauled together, side by side, both brought to a crawl.
  if (d > gap) {
    const k = Math.min(1, dt * 0.8);
    const mx = (foe.x - S.x) / d;
    const mz = (foe.z - S.z) / d;
    const pull = (d - gap) * k * 0.5;
    S.x += mx * pull;
    S.z += mz * pull;
    foe.x -= mx * pull;
    foe.z -= mz * pull;
  }
  S.v *= 1 - Math.min(1, dt * 0.8);
  foe.v *= 1 - Math.min(1, dt * 0.8);
  S.sailGoal = 0.1;
  // Then over the rail.
  if (G.t < BOARD_AFTER) return;
  G.boardT = (G.boardT || 0) - dt;
  if (G.boardT > 0) return;
  G.boardT = 0.7;
  const c = alive(game, S).find((q) => q.deck && q.deck.s === S.id && q.role !== 'captain' && (q.role === 'pirate' || q.role === 'mate'));
  if (!c) return;
  if (boardAt(game, foe, c, (S.x + foe.x) / 2, (S.z + foe.z) / 2)) {
    c.angry = true;
    c.boarder = foe.id;
    G.boarded++;
    if (Math.random() < 0.6) c.say(['Over the side, lads!', 'Take her!', 'No quarter!', 'Yo-ho! Steel!'][Math.floor(Math.random() * 4)], 2, '#ff9070');
  }
}

const alive = (game, S) => crewOf(game, S).filter((c) => !c.dead);

// ------------------------------------------------------------ hand to hand
// Pirates on a deck (theirs, or one they've boarded) go for whoever's
// not one of them there; her own hands fight back.
function fightTick(game, dt) {
  const players = game.everyone ? game.everyone() : [game.player];
  const sailors = (game.sailors || []).filter((c) => !c.dead && c.deck);
  if (!sailors.some((c) => c.rec && isPirate(c))) return;
  for (const c of sailors) {
    const pirate = isPirate(c);
    const S = shipById(game, c.deck.s);
    if (!S) continue;
    // (A ship's own hands: only when pirates are aboard her.)
    const foes = [];
    // (Her archers, at her rail: whoever's on the deck she's lashed to.)
    const across = pirate && c.role === 'pirate_archer' && S.pirate && S.grapple ? S.grapple.ship : null;
    const there = (q) => q.deck && (q.deck.s === S.id || q.deck.s === across);
    if (pirate) {
      for (const q of players) if (q && !q.dead && there(q)) foes.push(q);
      for (const q of sailors) if (!isPirate(q) && there(q)) foes.push(q);
    } else for (const q of sailors) if (isPirate(q) && q.deck.s === S.id) foes.push(q);
    if (!foes.length) continue;
    let t = null;
    let bd = Infinity;
    for (const q of foes) {
      const d = Math.abs(q.x - c.x) + Math.abs(q.z - c.z);
      if (d < bd) {
        bd = d;
        t = q;
      }
    }
    if (!t) continue;
    c.angry = true;
    const adj = Math.max(Math.abs(t.x - c.x), Math.abs(t.z - c.z)) <= 1 && Math.abs(t.y - c.y) <= 1;
    if (c.attackCd > 0) continue;
    if (c.role === 'pirate_archer' && !adj && bd <= (across ? 16 : 9)) {
      c.attackCd = 1.8;
      c.face(t.x, t.z);
      c.actionTimer = 0.3;
      game.shoot(c, t, 2, 'arrow');
      continue;
    }
    if (adj) {
      c.attackCd = 1.1;
      c.actionTimer = 0.25;
      c.face(t.x, t.z);
      game.damage(t, c.dmg, c);
      continue;
    }
    if (!c.deck.mv && (!c.task || !c.task.path || !c.task.path.length) && t.deck && t.deck.s === S.id) {
      const path = deckPath(S, { x: c.deck.cx, y: c.deck.y, z: c.deck.cz }, { x: t.deck.cx, y: t.deck.y, z: t.deck.cz });
      if (path && path.length > 1) c.task = { kind: 'go', path: path.slice(0, -1) };
    }
  }
  // Their ship emptied of them (or the last few, their boarders beaten
  // back, striking their colours and taking to her boat): the grapnels
  // cut, and what she'd plundered there for the taking. (Only with her
  // crew here to be counted: see shipcrew.crewTick.)
  for (const S of pirates(game)) {
    if (S.beaten || !S.crewHere) continue;
    const crew = alive(game, S);
    const over = crew.filter((c) => c.deck && c.deck.s !== S.id);
    const struck = crew.length && S.grapple && S.grapple.boarded > 0 && !over.length && crew.length <= S.crewRecs.length * 0.4;
    if (crew.length && !struck) continue;
    if (struck) {
      for (const c of crew) {
        if (c.recRef) c.recRef.dead = true;
        if (S.helmBy === c.id) S.helmBy = null;
        game.removeOcc?.(c);
        c.deck = null;
      }
      game.sailors = game.sailors.filter((c) => !crew.includes(c));
      if (nearAny(game, S.x, S.z, 60)) game.ui.msg(`The last of ${S.name}'s crew throw down their cutlasses, strike her colours and pull away in her boat.`, '#ffe070');
    }
    S.beaten = true;
    S.grapple = null;
    S.fight = null;
    S.hostile = false;
    S.sailGoal = 0;
    const who = players.find((q) => q && !q.dead && Math.hypot(q.x - S.x, q.z - S.z) < 60);
    if (who) {
      const n = S.plunder || 80;
      game.asPlayer ? game.asPlayer(who, () => {
        who.give('coin', n);
        game.ui.msg(`${S.name}'s crew are beaten. In her hold, the plunder: ¤${n}, and she's adrift for you to take.`, '#ffe070');
      }) : who.give('coin', n);
      if (S.cove) state(game).coveDone = true;
      game.sim.saga?.emit('pirates_beaten', { ship: S.id, name: S.name, cove: !!S.cove, pid: pidOf(who) });
    }
    // (Hers now: kept with the world, no longer one of theirs.)
    if (who) Object.assign(S, { owner: ownerId(game, who), transient: false, pirate: false, wasPirate: true, flag: '#e0c040', emblem: 'stripe' });
  }
}

// The nearest lived-in port town to (x, z), within reach of word.
function nearestPort(game, x, z) {
  const ports = game.sim.ships ? game.sim.ships.ports : {};
  let best = null;
  let bd = 900;
  for (const P of Object.values(ports)) {
    const s = game.world.ow.settlements[P.sid];
    if (!s || s.deserted || !game.world.layouts.get(s.id)) continue;
    const d = Math.hypot((s.cx + s.cw / 2) * REGION_W - x, (s.cz + s.cd / 2) * REGION_D - z);
    if (d < bd) {
      bd = d;
      best = s;
    }
  }
  return best;
}

// One of a pirate crew (wherever they've got to: their own deck, or one
// they've boarded).
export function isPirate(c) {
  if (!c) return false;
  if (c.role === 'pirate' || c.role === 'pirate_archer') return true;
  const own = c.game && c.shipId !== null && c.shipId !== undefined ? shipById(c.game, c.shipId) : null;
  return !!(own && own.pirate);
}

// (Away from you: a voyage taken, now and then. See shipfleets.end.)
export function takenAtSea(game, v, rng) {
  const P = state(game);
  if (!coveOf(game) || rng.chance(0.96)) return false;
  P.taken++;
  return true;
}

// The ropes between a pirate and whoever she's lashed to (drawn over the
// water: see renderer).
export function grapples(game) {
  const out = [];
  for (const S of pirates(game)) {
    if (!S.grapple) continue;
    const foe = shipById(game, S.grapple.ship);
    if (foe) out.push([S, foe]);
  }
  return out;
}

export function piratesSave(game) {
  const P = game.pirates;
  return P ? { nextRaid: P.nextRaid, taken: P.taken, coveDone: !!P.coveDone, sighted: !!P.sighted } : null;
}
export function piratesLoad(game, d) {
  game.pirates = { cove: undefined, nextRaid: d ? d.nextRaid ?? null : null, raider: null, taken: d ? d.taken || 0 : 0, coveDone: !!(d && d.coveDone), sighted: !!(d && d.sighted) };
}
