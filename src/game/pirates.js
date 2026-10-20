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
// (Round 86) Three guilds of them, each with its own cove and colours (see
// GUILDS). One known for a pirate (see piracy.js) can sail into a cove and
// not be fired on; one sworn to a guild is left be by its ships, but its
// rivals' may still come for them.
import { REGION_W, REGION_D, GROUND } from '../config.js';
import { RNG, hash4 } from '../util/rng.js';
import { addShip, shipsOf, shipById, waterSpot, boardAt, deckPath, ownerId } from './ships3d.js';
import { makeCrew, crewOf } from './shipcrew.js';
import { SHIP_TYPES } from '../world/shipmodels.js';
import { DAY } from '../sim/econ.js';
import { pidOf } from '../sim/saga/refs.js';
import { pirateFoe, guildOfP, piracyTick } from './piracy.js';

const COVE_NAMES = ['Gallows Cove', 'Blackwater Bight', 'Corsair\'s Rest', 'Rattlebone Inlet', 'Widow\'s Hook', 'Skull Haven'];
const SHIP_NAMES = ['Black Gull', 'Red Widow', 'Sea Wolf', 'Grinning Jack', 'Bloody Mary', 'Kraken\'s Due', 'Hangman\'s Luck'];
// (Round 86) The brotherhoods: each its name, its colours, and its cove.
export const GUILDS = [
  { id: 'gull', name: 'the Black Gull Brethren', flag: '#121212', layers: [{ shape: 'skull', color: '#f0f0e8' }] },
  { id: 'hand', name: 'the Red Hand Company', flag: '#6a1010', layers: [{ shape: 'swords', color: '#f0f0e8' }, { shape: 'border', color: '#121212' }] },
  { id: 'tide', name: 'the Free Tide', flag: '#1a2440', layers: [{ shape: 'wave', color: '#e8e0d0' }, { shape: 'crescent', color: '#e0c040' }] },
];
const GRAPPLE_AT = 10; // paces between hulls when the grapnels fly
const BOARD_AFTER = 2.5; // seconds lashed together before they come over

function state(game) {
  return (game.pirates ||= { cove: undefined, nextRaid: null, raider: null, taken: 0, cs: [] });
}

// (Round 86) What's become of each cove: sighted, its ships out, beaten.
function coveState(P, i) {
  P.cs ||= [];
  return (P.cs[i] ||= { sighted: false, spawned: false, done: false, warned: false, hailed: {} });
}

// Every guild's cove: the first (coveOf) the Black Gulls', then one each
// for the others, on other lands, far from it and from any town.
export function covesOf(game) {
  const P = state(game);
  if (P.coves) return P.coves;
  const first = coveOf(game);
  const out = first ? [{ ...first, guild: 0 }] : [];
  if (first) {
    const ow = game.world.ow;
    const rng = new RNG(hash4(game.seed >>> 0, 0x9148f));
    const far = (x, z) => ow.settlements.every((s) => Math.hypot((s.cx + s.cw / 2) * REGION_W - x, (s.cz + s.cd / 2) * REGION_D - z) > 260) && out.every((c) => Math.hypot(c.x - x, c.z - z) > 500);
    const lands = [...(ow.lands || [])].filter((L) => L.name !== first.land).sort(() => rng.next() - 0.5);
    for (const L of lands) {
      if (out.length >= GUILDS.length) break;
      const c = shoreSpot(ow, L, rng, far);
      if (c) out.push({ ...c, guild: out.length, name: COVE_NAMES.filter((n) => !out.some((o) => o.name === n))[rng.int(0, COVE_NAMES.length - 1 - out.length)] });
    }
  }
  P.coves = out;
  return out;
}

// Open water off a land's shore that `ok` allows, or null.
function shoreSpot(ow, L, rng, ok) {
  const cx = (L.x0 + L.x1) / 2;
  const cz = (L.z0 + L.z1) / 2;
  const reach = Math.max(L.x1 - L.x0, L.z1 - L.z0) * 0.75;
  const a0 = rng.next() * Math.PI * 2;
  for (let k = 0; k < 24; k++) {
    const a = a0 + (k / 24) * Math.PI * 2;
    let wasLand = false;
    for (let r = 0; r < reach; r += 6) {
      const x = Math.round(cx + Math.cos(a) * r);
      const z = Math.round(cz + Math.sin(a) * r);
      const c = ow.continentAt(x, z);
      if (c > 0.05) wasLand = true;
      else if (wasLand && c < -0.02) {
        const ox = Math.round(cx + Math.cos(a) * (r + 18));
        const oz = Math.round(cz + Math.sin(a) * (r + 18));
        if (ow.continentAt(ox, oz) < -0.02 && ok(ox, oz) && !(!ow.wallDown && ow.insideStorm && ow.insideStorm(ox, oz))) return { x: ox, z: oz, shore: { x, z }, land: L.name };
        break;
      }
    }
  }
  return null;
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
// (Round 85) Someone taken at sea, still held at the cove.
const captivesHeld = (game) => ((game.sim && game.sim.saga && game.sim.saga.threads) || []).some((th) => th.m === 'taken_at_sea' && !th.done);
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
  // (Round 86) Under her guild's colours.
  const gi = o.guild ?? rng.int(0, GUILDS.length - 1);
  const Gd = GUILDS[gi] || GUILDS[0];
  const S = addShip(game, {
    type, x: at.x, z: at.z, yaw: at.yaw ?? 0, name: `The ${SHIP_NAMES[rng.int(0, SHIP_NAMES.length - 1)]}`,
    crew, ammo: 999, paint: '#24222a', paint2: '#0e0c10', flag: Gd.flag, flagLayers: Gd.layers, emblem: 'saltire', markColor: '#121212', anchor: !!o.anchor, sailSet: o.anchor ? 0 : 0.9,
  });
  S.pirate = true;
  S.guild = gi;
  S.hostile = true;
  S.transient = true;
  S.plunder = 60 + rng.int(0, 140) + (type === 'brigantine' ? 80 : 0);
  if (o.target) S.fight = o.target.player ? { player: true } : { ship: o.target.id };
  return S;
}

// (Round 86) Anyone near (x, z) her guild would fire on.
const foeNear = (game, S, r) => (game.everyone ? game.everyone() : [game.player]).some((q) => q && !q.dead && Math.hypot(q.x - S.x, q.z - S.z) < r && pirateFoe(game, q, S.guild ?? 0));

// ------------------------------------------------------------ each tick
export function pirateTick(game, dt) {
  if (game.remote || game.skipping || !game.sim) return;
  const P = state(game);
  P.t = (P.t || 0) - dt;
  // (The ones lashed to someone: hauled alongside, and over the rail.)
  for (const S of pirates(game)) grappleTick(game, S, dt);
  fightTick(game, dt);
  piracyTick(game, dt);
  if (P.t > 0) return;
  P.t = 2;
  for (const cove of covesOf(game)) coveTick(game, P, cove);
  // A raider, now and then (a day or more apart, and not often).
  const now = game.sim.abs;
  if (P.nextRaid === null) P.nextRaid = now + DAY * (1 + Math.random() * 3);
  if (now >= P.nextRaid && !pirates(game).some((S) => !S.cove)) {
    P.nextRaid = now + DAY * (2 + Math.random() * 4);
    // (Round 86: out of one guild's cove; she leaves its own be.)
    const guild = Math.floor(Math.random() * GUILDS.length);
    const target = raidTarget(game, guild);
    if (target) {
      const ang = Math.random() * Math.PI * 2;
      const S = spawnPirate(game, target.x + Math.cos(ang) * 70, target.z + Math.sin(ang) * 70, { guild, target: target.S ? target.S : { player: true } });
      if (S && nearAny(game, S.x, S.z, 120)) game.ui.msg(`A sail on the horizon, under black colours: ${S.name}, and she's coming about toward ${target.S && !target.S.owner ? theirName(target.S) : 'you'}!`, '#ff7060');
      // (Word of her reaches the nearest port: see saga/motifs/tides.js.)
      const port = S && nearestPort(game, S.x, S.z);
      if (port) game.sim.saga?.emit('pirate_seen', { sid: port.id, ship: S.id, name: S.name });
    }
  }
}

// One guild's cove, each tick: sighted from afar and marked; a ship or two
// at anchor in it while you're near, roused when you come close (unless
// they'd not fire on you: a known pirate, or one of theirs).
function coveTick(game, P, cove) {
  const i = cove.guild;
  const C = coveState(P, i);
  const G = GUILDS[i] || GUILDS[0];
  if (!C.sighted && nearAny(game, cove.x, cove.z, 360)) {
    C.sighted = true;
    game.world.ow.pin(cove.x, cove.z, `${cove.name} (pirates)`, '×');
    game.ui.msg(`Off the shore of ${cove.land}, black sails at anchor: ${cove.name}, a nest of ${G.name}. (Marked on your map.)`, '#ff9070');
  }
  // (Round 130) Black sails at anchor, and smoke ashore behind them: the
  // haven's there, somewhere (see sim/havens.js).
  const H = game.sim.havens;
  const hv = H && H.standing(i).find((h) => h.cove);
  if (hv) for (const q of game.everyone ? game.everyone() : [game.player]) if (q && !q.dead && Math.hypot(q.x - cove.x, q.z - cove.z) < 360) H.learn(hv, pidOf(q), 'heard', 'the black sails off the shore');
  if (nearAny(game, cove.x, cove.z, 170)) {
    const here = pirates(game).filter((S) => S.cove && (S.coveIdx ?? 0) === i);
    // (Round 85: beaten once, they're back while they've someone's kin
    // in their holds: see saga/motifs/tides.js. Only the first cove's.)
    const held = i === 0 && captivesHeld(game);
    if ((!C.done || held) && here.length < 2 && !C.spawned) {
      C.spawned = true;
      for (let k = 0; k < 2; k++) {
        const S = spawnPirate(game, cove.x + (k ? 24 : -12), cove.z + (k ? 10 : -6), { anchor: true, guild: i, seed: hash4(game.seed >>> 0, k + i * 7, 0xc0fe) });
        if (S) {
          S.cove = true;
          S.coveIdx = i;
        }
      }
      if (!C.warned || held) {
        const peace = !foeNear(game, { x: cove.x, z: cove.z, guild: i }, 170);
        game.ui.msg(peace ? `Black sails at anchor ahead: ${cove.name}, ${G.name}'s. They know you for one of their own trade: they'll let you in. (Talk to a captain there to swear to them.)` : `Black sails at anchor ahead: ${cove.name}.${held ? ' The captives will be in their holds.' : ''} Come in close and they'll come out for you.`, '#ff9070');
      }
      C.warned = true;
    }
    for (const S of here) {
      if (S.fight || !nearAny(game, S.x, S.z, 70)) continue;
      if (foeNear(game, S, 70)) {
        S.fight = { player: true };
        S.anchor = false;
        S.sailGoal = 0.9;
      } else hail(game, S, G);
    }
  } else if (C.spawned && !pirates(game).some((S) => S.cove && (S.coveIdx ?? 0) === i)) C.spawned = false;
}

// (Round 86) A known pirate sailing in: hailed, not fired on.
function hail(game, S, G) {
  for (const q of game.everyone ? game.everyone() : [game.player]) {
    if (!q || q.dead || Math.hypot(q.x - S.x, q.z - S.z) > 70) continue;
    const pid = pidOf(q);
    S.hailed ||= {};
    if (S.hailed[pid]) continue;
    S.hailed[pid] = true;
    const sworn = guildOfP(game, q) === S.guild;
    const say = () => game.ui.msg(sworn ? `${S.name} dips her colours to you: a brother of ${G.name}, home again.` : `${S.name} hails you: "Ahoy, ye black-hearted wretch! Come aboard and drink with us, and swear to ${G.name} if ye've a mind." (F on her captain.)`, '#ffd080');
    game.asPlayer ? game.asPlayer(q, say) : say();
  }
}

const theirName = (S) => S.name || 'a merchantman';

// Who a raider goes for: a voyage near one of you (a merchantman, a
// hulk), or your own ship at sea.
function raidTarget(game, guild = 0) {
  const ships = shipsOf(game).filter((S) => !S.pirate && !S.sinking && nearAny(game, S.x, S.z, 140));
  // (Round 86: not a ship of someone they'd leave be.)
  const theirs = (S) => (game.everyone ? game.everyone() : [game.player]).some((q) => q && ownerId(game, q) === S.owner && pirateFoe(game, q, guild));
  const mine = ships.find((S) => S.owner && !S.anchor && Math.abs(S.v) > 1 && theirs(S));
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
      // (Round 86: not one they'd leave be, unless they've struck at them.)
      const own = c.shipId !== null && c.shipId !== undefined ? shipById(game, c.shipId) : S;
      for (const q of players) if (q && !q.dead && there(q) && (c.foe === q.id || pirateFoe(game, q, own ? own.guild ?? 0 : 0))) foes.push(q);
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
      const n0 = S.plunder || 80;
      // (Round 130) Sworn to the brethren: your crew take their shares by
      // your ship's articles (see sim/brethren.js).
      const Bc = game.sim.brethren;
      const cut = Bc ? Bc.crewCut(pidOf(who), n0) : 0;
      const n = n0 - cut;
      game.asPlayer ? game.asPlayer(who, () => {
        who.give('coin', n);
        game.ui.msg(`${S.name}'s crew are beaten. In her hold, the plunder: ¤${n0}${cut ? ` (your crew take ¤${cut} in shares, and cheer you)` : ''}, and she's adrift for you to take.`, '#ffe070');
      }) : who.give('coin', n);
      if (S.cove) coveState(state(game), S.coveIdx ?? 0).done = true;
      game.sim.saga?.emit('pirates_beaten', { ship: S.id, name: S.name, cove: !!S.cove, pid: pidOf(who) });
      // (Round 130) A rival guild's ship beaten: merit with your own; and
      // her captain's chart, now and then, to a haven of theirs.
      const B = game.sim.brethren;
      const mine = B && B.standingOf(pidOf(who));
      if (mine && mine.i !== (S.guild ?? 0)) B.deed(pidOf(who), 'rival');
      const H = game.sim.havens;
      const hv = H && H.standing(S.guild ?? 0).find((h) => !H.knows(h.sid, pidOf(who)));
      if (hv && Math.random() < 0.5) {
        H.learn(hv, pidOf(who), 'heard', `${S.name}'s captain's chart`);
        game.asPlayer ? game.asPlayer(who, () => game.ui.msg(`In her captain's cabin, a stained chart: the way to ${hv.name}.`, '#ffe070')) : null;
      }
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
  // (Round 130: the likelier the more of the brethren's ships are out;
  // never off a realm paying them: see sim/brethren.js.)
  const B = game.sim && game.sim.brethren;
  const odds = B ? B.seaOdds(v) : 0.04;
  if (!coveOf(game) || !rng.chance(odds)) return false;
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
  const cs = P ? (P.cs || []).map((C) => (C ? { sighted: !!C.sighted, done: !!C.done } : null)) : [];
  return P ? { nextRaid: P.nextRaid, taken: P.taken, coveDone: !!(cs[0] && cs[0].done), sighted: !!(cs[0] && cs[0].sighted), cs, piracy: game.piracy || null } : null;
}
export function piratesLoad(game, d) {
  // (Round 86: each cove's own; an older save's one cove is the first.)
  const cs = d && Array.isArray(d.cs) ? d.cs.map((C) => (C ? { sighted: !!C.sighted, spawned: false, done: !!C.done, warned: false, hailed: {} } : null)) : [{ sighted: !!(d && d.sighted), spawned: false, done: !!(d && d.coveDone), warned: false, hailed: {} }];
  game.pirates = { cove: undefined, nextRaid: d ? d.nextRaid ?? null : null, raider: null, taken: d ? d.taken || 0 : 0, cs };
  game.piracy = d && d.piracy ? d.piracy : null;
}
