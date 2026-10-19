// (Round 86) Piracy. Sink a ship that never fired on you (a merchantman,
// a settler, a warship you fell on unprovoked) and you've turned pirate:
// her people's realm hears of it (your name blackened in its towns, its
// warships coming about to take you on sight, its merchantmen running
// from you). Three such sinkings and you're known among the pirates too:
// their coves let you sail in unharmed, and you can swear yourself to a
// guild there (see pirates.js) whose ships will never fire on you, though
// its rivals' still may. Not everyone sailing with you stomachs it: the
// rogues among your hands cheer you on, but honest ones warn you once,
// then turn on you; a hired escort with a conscience the same.
import { shipsOf, shipById, ownerId } from './ships3d.js';
import { crewOf } from './shipcrew.js';
import { pidOf } from '../sim/saga/refs.js';
import { hash4 } from '../util/rng.js';

// Sinkings before the pirates count you one of their own trade.
export const PIRATE_AT = 3;
// How far a realm's ships know you by sight.
const SIGHT = 110;

function book(game) {
  return (game.piracy ||= { p: {} });
}

// What's known of one playing: { n (ships sunk unprovoked), sunk (by
// realm), guild (sworn to, or null) }.
export function piracyOf(game, p) {
  const P = book(game);
  const k = pidOf(p) || 'host';
  return (P.p[k] ||= { n: 0, sunk: {}, guild: null });
}

export const isKnownPirate = (game, p) => {
  const r = piracyOf(game, p);
  return r.n >= PIRATE_AT || r.guild !== null;
};
export const guildOfP = (game, p) => (p ? piracyOf(game, p).guild : null);
// Would pirates of `guild` fire on them? One of theirs, never; one of
// another guild's, yes; a known pirate sworn to none, no.
export function pirateFoe(game, p, guild) {
  if (!p) return true;
  const r = piracyOf(game, p);
  if (r.guild !== null && r.guild !== undefined) return r.guild !== guild;
  return r.n < PIRATE_AT;
}
// Does realm `civ` know them for a pirate?
export const pirateTo = (game, p, civ) => civ !== null && civ !== undefined && (piracyOf(game, p).sunk[civ] || 0) >= 1;

const players = (game) => (game.everyone ? game.everyone() : [game.player]).filter((q) => q && !q.dead);
const tell = (game, p, text, color) => (game.asPlayer ? game.asPlayer(p, () => game.ui.msg(text, color)) : game.ui.msg(text, color));
const civOf = (game, id) => (game.world.ow.civs || []).find((c) => c.id === id) || null;
const realmName = (c) => (c ? c.name.replace(/^The /, 'the ') : 'her people');

// Hit by a shot: who fired it, and whether she fired first on a player's.
export function noteHit(game, S, b) {
  const from = b.ship !== undefined && b.ship !== null ? shipById(game, b.ship) : null;
  S.lastHit = { ship: b.ship ?? null, by: b.by ?? null };
  if (from && S.owner && !from.owner) from.firedOnPlayer = true;
}

// Whoever's to answer for her sinking: the player who fired the last
// shot into her, or whose ship did.
function sinker(game, S) {
  const h = S.lastHit;
  if (!h) return null;
  const all = players(game);
  if (h.by !== null) {
    const q = all.find((o) => o.id === h.by);
    if (q) return q;
  }
  const from = h.ship !== null ? shipById(game, h.ship) : null;
  if (from && from.owner) return all.find((q) => ownerId(game, q) === from.owner) || null;
  return null;
}

// She's going down: piracy, if a player sank her unprovoked.
export function shipSunk(game, S) {
  if (game.remote || S.owner || S.piracyDone) return;
  S.piracyDone = true;
  const p = sinker(game, S);
  if (!p) return;
  const r = piracyOf(game, p);
  // A pirate sunk: no crime (but a brother of your own guild: you're cast out).
  if (S.pirate || S.wasPirate) {
    if (S.pirate && r.guild !== null && S.guild === r.guild) {
      r.guild = null;
      tell(game, p, `You sank a ship of your own brotherhood. You're cast out of it: its ships will fire on you now.`, '#ff8060');
    }
    return;
  }
  // (She fired on you first: you were only fighting back.)
  if (S.firedOnPlayer) return;
  const from = S.lastHit && S.lastHit.ship !== null ? shipById(game, S.lastHit.ship) : null;
  piracyAct(game, p, S, from);
}

// An act of piracy: told of, felt in the realm's towns, and by whoever's
// sailing with them.
export function piracyAct(game, p, S, from = null) {
  const r = piracyOf(game, p);
  const was = r.n;
  r.n++;
  const civ = S.civ ?? null;
  const C = civ !== null ? civOf(game, civ) : null;
  if (civ !== null) r.sunk[civ] = (r.sunk[civ] || 0) + 1;
  // Her people's towns think the worse of you.
  if (C && game.sim) {
    const hurt = () => {
      for (const s of game.world.ow.settlements) if (s.civ && s.civ.id === civ) game.sim.loseRenown?.(s.id, 8);
    };
    game.sim.saga?.asPid ? game.sim.saga.asPid(pidOf(p), hurt) : hurt();
  }
  tell(game, p, `You sank ${S.name || 'her'}, and she never fired on you: piracy. ${C ? `Word will reach ${realmName(C)}: their warships will come for you on sight, and their towns think the worse of you.` : 'Word of it will get about.'}`, '#ff9070');
  if (was < PIRATE_AT && r.n >= PIRATE_AT && r.guild === null) tell(game, p, `You're known for a pirate now. The pirate coves will let you sail in without a shot fired, and you can swear yourself to a guild there (F on one of their captains).`, '#ffd080');
  crewReact(game, p, from);
  hiredReact(game, p);
  // (Round 130) A prize, for the brethren's book (see sim/brethren.js).
  game.sim?.brethren?.deed(pidOf(p), 'prize');
}

// A sailor's nature, from their name: a rogue goes along with it; an
// honest hand doesn't.
export function temperOf(rec) {
  if (!rec) return 'honest';
  if (rec.temper) return rec.temper;
  const n = String(rec.name && rec.name.first ? `${rec.name.first} ${rec.name.last || ''}` : rec.name || '');
  let h = 7;
  for (let i = 0; i < n.length; i++) h = hash4(h, n.charCodeAt(i), 0x9a7e);
  rec.temper = (h >>> 0) % 100 < 45 ? 'rogue' : 'honest';
  return rec.temper;
}

const ROGUE = ['Ha! Fat pickings, that one!', 'That\'s the life, captain!', 'Down she goes! Who\'s next?', 'Didn\'t care for her colours anyway.'];
const QUALM = ['Captain... she never fired on us. I don\'t like this.', 'That was murder, not war. Once more and I\'m done with you.', 'I signed on to sail, not to drown honest folk.'];
const TURN = ['No more! I\'ll not serve a pirate!', 'Enough! Take her, lads, before she sinks us all!', 'Mutiny it is, then!'];

// Her own hands: the rogues cheer; the honest grumble once, then mutiny.
function crewReact(game, p, from) {
  const mine = from && from.owner && from.owner === ownerId(game, p) ? [from] : shipsOf(game).filter((S) => S.owner && S.owner === ownerId(game, p) && players(game).some((q) => q.deck && q.deck.s === S.id));
  for (const S of mine) {
    const ents = crewOf(game, S);
    for (const rec of S.crewRecs || []) {
      if (rec.dead || rec.mutineer) continue;
      const c = ents.find((e) => e.recRef === rec);
      if (temperOf(rec) === 'rogue') {
        if (c && Math.random() < 0.5) c.say(ROGUE[Math.floor(Math.random() * ROGUE.length)], 2.5, '#ffd080');
        continue;
      }
      rec.qualms = (rec.qualms || 0) + 1;
      if (rec.qualms < 2) {
        c?.say(QUALM[Math.floor(Math.random() * QUALM.length)], 3.5, '#ffb080');
        continue;
      }
      rec.mutineer = true;
      if (c) mutiny(game, S, c, p);
      else S.crewRecs = S.crewRecs.filter((q) => q !== rec);
    }
    if ((S.crewRecs || []).some((q) => q.mutineer && !q.dead)) tell(game, p, `Mutiny aboard ${S.name}! Her honest hands have turned on you: put them down (or beat them till they yield). The rest stand with you.`, '#ff7060');
  }
}

// One of her hands turning on whoever's captain of her.
export function mutiny(game, S, c, p) {
  c.mutineer = true;
  if (c.recRef) c.recRef.mutineer = true;
  c.order = null;
  c.task = null;
  if (S.helmBy === c.id) S.helmBy = null;
  if (c.deck) c.deck.role = null;
  c.angry = true;
  c.foe = p.id;
  c.say(TURN[Math.floor(Math.random() * TURN.length)], 3, '#ff7060');
  // (The loyal: against them.)
  for (const o of crewOf(game, S)) {
    if (o === c || o.mutineer) continue;
    if (!o.angry) {
      o.angry = true;
      o.foe = c.id;
    }
  }
}

// A hired escort with you: one without a conscience shrugs; one with
// warns you, then turns on you (or, timid, just walks off).
function hiredReact(game, p) {
  for (const n of game.npcs || []) {
    if (!n.hired || n.dead || Math.hypot(n.x - p.x, n.z - p.z) > 40) continue;
    const P = (n.rec && n.rec.personality) || {};
    const kind = P.kindness ?? 0.5;
    const rogue = kind < 0.4 || ((P.temper ?? 0.5) > 0.65 && kind < 0.55);
    if (rogue) {
      if (Math.random() < 0.5) n.say(['Ha! Serves them right.', 'Not my ship, not my worry.', 'Plunder\'s plunder.'][Math.floor(Math.random() * 3)], 3);
      continue;
    }
    n.piracyQualms = (n.piracyQualms || 0) + 1;
    if (n.piracyQualms < 2) {
      n.say('Those were honest sailors. Do that again and we\'re finished.', 4);
      continue;
    }
    const end = (line) => (game.asPlayer ? game.asPlayer(p, () => game.sim.careers.endEscort(line)) : game.sim.careers.endEscort(line));
    if ((P.bravery ?? 0.5) >= 0.35) {
      end('I won\'t stand by while you murder honest folk. Have at you, pirate!');
      n.hired = null;
      n.react?.(p, false);
    } else {
      end('I\'m done with you, pirate. I\'m going home.');
      n.hired = null;
    }
  }
}

// For the HUD: 'PIRATE', and the guild sworn to; null if not known for one.
export function pirateTag(game, p) {
  if (!p || !game.piracy) return null;
  const r = piracyOf(game, p);
  if (r.guild !== null && r.guild !== undefined) return `PIRATE · ${(GUILD_NAMES[r.guild] || 'SWORN').toUpperCase()}`;
  return r.n >= PIRATE_AT ? 'PIRATE' : r.n ? `PIRACY ${r.n}/${PIRATE_AT}` : null;
}
const GUILD_NAMES = ['Black Gulls', 'Red Hand', 'Free Tide'];

// Sworn to a guild (at its captain's word: see shipgame.sailorTalk).
export function pledge(game, p, guild, G) {
  const r = piracyOf(game, p);
  const was = r.guild;
  r.guild = guild;
  tell(game, p, `You swear yourself to ${G ? G.name : 'the brotherhood'}${was !== null && was !== guild ? ', forsaking your old one' : ''}. Their ships will never fire on you; other guilds' still may.`, '#ffd080');
  game.audio?.play('fanfare');  // (Round 130) Sworn: told where the guild's havens are (see
  // sim/havens.js), and on its rolls as a hand (see sim/brethren.js).
  const H = game.sim && game.sim.havens;
  if (H) for (const h of H.standing(guild)) H.learn(h, pidOf(p), 'heard', 'the brethren');
  game.sim?.brethren?.joined(pidOf(p), guild, p);
}

// Each second or so: realms' ships that know you (warships coming about to
// take you; merchantmen running), and mutineers beaten into yielding.
export function piracyTick(game, dt) {
  if (game.remote || !game.piracy) return;
  const P = game.piracy;
  P.t = (P.t || 0) - dt;
  if (P.t > 0) return;
  P.t = 1;
  const all = players(game);
  const theirs = all.map((q) => ({ q, S: shipsOf(game).find((S) => S.owner && S.owner === ownerId(game, q) && q.deck && q.deck.s === S.id) })).filter((o) => o.S);
  for (const S of shipsOf(game)) {
    if (S.owner || S.pirate || S.sinking || S.civ === null || S.civ === undefined || S.fight || S.flee) continue;
    for (const { q, S: mine } of theirs) {
      if (!pirateTo(game, q, S.civ) || Math.hypot(mine.x - S.x, mine.z - S.z) > SIGHT) continue;
      if (S.vkind === 'war' || S.vkind === 'troops') {
        S.fight = { ship: mine.id };
        S.hostile = true;
        S.anchor = false;
        tell(game, q, `${S.name} runs up a signal: PIRATE. She comes about to take you!`, '#ff7060');
      } else {
        S.flee = { from: mine.id, t: 90 };
        S.anchor = false;
        tell(game, q, `${S.name} knows your colours: she crowds on sail and runs.`, '#ffd080');
      }
      break;
    }
  }
  // Mutineers beaten down: they yield and go over the side.
  for (const c of game.sailors || []) {
    if (!c.mutineer || c.dead || c.hp > c.maxHp * 0.35) continue;
    const S = shipById(game, c.shipId);
    c.mutineer = false;
    c.angry = false;
    c.paidOff = true;
    if (S) S.crewRecs = S.crewRecs.filter((q) => q !== c.recRef);
    c.say('Enough! I yield! I\'ll take my chances in the sea.', 3);
    if (S) for (const o of crewOf(game, S)) if (o.foe === c.id) o.angry = false;
  }
  // (A mutineer brought back aboard by a load: still one.)
  for (const c of game.sailors || []) if (c.recRef && c.recRef.mutineer && !c.mutineer && !c.dead && !c.paidOff) {
    const S = shipById(game, c.shipId);
    const cap = S && all.find((q) => ownerId(game, q) === S.owner);
    if (S && cap) mutiny(game, S, c, cap);
  }
}
