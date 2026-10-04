// Bouts between players (with others in the world: see party.js). One
// challenges another (from their profile: right-click them, or the party
// list), with a purse or for nothing; the other accepts or not; and it
// goes as a bout with an adventurer goes (see Game.startDuel): the two
// square up while it's counted down, then the first down to a quarter of
// their strength yields, goes down on one knee, and the purse changes
// hands. Their blows land on each other whether the host lets players
// fight or not, and they're no crime; for a while after, none do.
import { seatField } from './party.js';
import { countItem, removeItem } from './inventory.js';
import { duelYield } from './scenes.js';
import { BoutAskWindow, BOUT_PURSES } from '../ui/multiplayer.js';

export const BOUT_WAGERS = BOUT_PURSES;
// How near you must be to challenge someone, how far apart walks away
// from it, how long it's on offer, and how long a bout may go on.
const NEAR = 16;
const APART = 14;
const ASK_FOR = 30;
const LONGEST = 90;

const uiOf = (game, seat) => seatField(game, seat, 'ui');
const entOf = (game, seat) => (seat === game.seat ? game.player : seat.ent);
const nameOf = (seat) => seat.name;
const say = (game, seat, text, color = '#ffe070') => uiOf(game, seat)?.msg?.(text, color);

// The bout these two players are at, if they're at one together.
export function boutOf(game, a, b) {
  if (!game.bouts || !a || !b || a === b) return null;
  return game.bouts.find((q) => (entOf(game, q.a) === a && entOf(game, q.b) === b) || (entOf(game, q.a) === b && entOf(game, q.b) === a)) || null;
}

// Is this player at a bout (with anyone)?
export function inBout(game, p) {
  return !!(game.bouts && game.bouts.some((q) => entOf(game, q.a) === p || entOf(game, q.b) === p));
}

// Just finished with each other: no blow between them lands. (The time
// after, if so.)
export function boutJustOver(game, a, b) {
  return (game.boutAfter && game.boutAfter.find((q) => q.t > 0 && ((q.a === a && q.b === b) || (q.a === b && q.b === a)))) || null;
}

const seatById = (game, id) => (game.seats || []).find((s) => s.id === id) || null;

// Why `seat` can't have a bout with `other` just now (or null).
function problem(game, seat, other, wager) {
  const me = entOf(game, seat);
  const them = entOf(game, other);
  if (!me || !them || me.dead || them.dead) return 'Not now.';
  if (inBout(game, me)) return 'You\'re already at a bout.';
  if (inBout(game, them)) return `${nameOf(other)} is already at a bout.`;
  if (seatField(game, seat, 'duel') || seatField(game, other, 'duel')) return 'Not while a bout with someone else is on.';
  if (game.world.inInstance(me.x) !== game.world.inInstance(them.x) || Math.max(Math.abs(me.x - them.x), Math.abs(me.z - them.z)) > NEAR) return `${nameOf(other)} is too far off: go to them first.`;
  if (wager > 0 && countItem(me.inv, 'coin') < wager) return 'You\'ll need the coin to back it.';
  return null;
}

// `from` challenges the player with account id `toId`, for `wager` coins.
// True if it's put to them.
export function challengeBout(game, from, toId, wager = 0) {
  if (!game.seats || !from) return false;
  wager = BOUT_WAGERS.includes(Number(wager)) ? Number(wager) : 0;
  const to = seatById(game, toId);
  if (!to || to === from) return false;
  const why = problem(game, from, to, wager);
  if (why) {
    say(game, from, why, '#ffb080');
    return false;
  }
  game.boutAsks ||= [];
  if (game.boutAsks.some((q) => q.from === from && q.to === to)) {
    say(game, from, `You've already challenged ${nameOf(to)}: they've yet to answer.`, '#c8d8ff');
    return false;
  }
  const ask = { from, to, wager, t: ASK_FOR };
  game.boutAsks.push(ask);
  const ui = uiOf(game, to);
  if (ui && ui.open) ui.open(new BoutAskWindow(ui, { from: from.profile, wager, live: () => game.boutAsks.includes(ask) }, (yes) => answerBout(game, ask, yes)));
  say(game, from, `You challenge ${nameOf(to)} to a bout${wager ? ` for ¤${wager}` : ''}. Waiting for their answer...`, '#ffe070');
  return true;
}

// The one challenged answers.
export function answerBout(game, ask, yes) {
  if (!game.boutAsks || !game.boutAsks.includes(ask)) return false;
  game.boutAsks = game.boutAsks.filter((q) => q !== ask);
  const { from, to, wager } = ask;
  if (!game.seats.includes(from) || !game.seats.includes(to)) return false;
  if (!yes) {
    say(game, from, `${nameOf(to)} declines your challenge.`, '#c8d8ff');
    return false;
  }
  const why = problem(game, from, to, wager) || problem(game, to, from, wager);
  if (why) {
    say(game, from, `The bout with ${nameOf(to)} is off: ${why}`, '#ffb080');
    say(game, to, wager && countItem(entOf(game, to).inv, 'coin') < wager ? `You haven't the ¤${wager} to match the purse.` : why, '#ffb080');
    return false;
  }
  startBout(game, from, to, wager);
  return true;
}

// Squared up, and the count begins.
export function startBout(game, a, b, wager = 0) {
  game.bouts ||= [];
  const pa = entOf(game, a);
  const pb = entOf(game, b);
  const bout = { a, b, wager, start: game.sim.abs, ready: 3, from: { a: { x: pa.x, z: pa.z }, b: { x: pb.x, z: pb.z } } };
  game.bouts.push(bout);
  // (Neither in a fight with anyone else's help: each faces the other.)
  pa.face?.(pb.x, pb.z);
  pb.face?.(pa.x, pa.z);
  const rules = `the first down to a quarter of their strength loses${wager ? `, and pays ¤${wager}` : ''}.`;
  say(game, a, `A bout with ${nameOf(b)}: ${rules}`);
  say(game, b, `A bout with ${nameOf(a)}: ${rules}`);
  for (const p of [pa, pb]) game.renderer.floatText(p.x, p.y + 2.4, p.z, 'On guard!', '#ffe070');
  game.audio?.play('draw', pa);
  return bout;
}

// The fight's on (the count's done, or one of them swung first).
function begin(game, bout) {
  if (!(bout.ready > 0)) return;
  bout.ready = 0;
  for (const p of [entOf(game, bout.a), entOf(game, bout.b)]) if (p) game.renderer.floatText(p.x, p.y + 2.4, p.z, 'Fight!', '#ffb060');
  game.audio?.play('clang', entOf(game, bout.a));
}

// Over: `winner` (a seat) beat the other down; or (no winner) it's off.
export function endBout(game, bout, winner, why = null) {
  game.bouts = (game.bouts || []).filter((q) => q !== bout);
  const loser = winner === bout.a ? bout.b : winner === bout.b ? bout.a : null;
  const pa = entOf(game, bout.a);
  const pb = entOf(game, bout.b);
  if (!winner) {
    for (const s of [bout.a, bout.b]) say(game, s, why || 'The bout is off.', '#c8d8ff');
    return;
  }
  const pw = entOf(game, winner);
  const pl = entOf(game, loser);
  // The purse (what the loser has of it).
  const owe = bout.wager ? Math.min(bout.wager, countItem(pl.inv, 'coin')) : 0;
  if (owe) {
    removeItem(pl.inv, 'coin', owe);
    const left = pw.give('coin', owe);
    if (left) game.spawnDrop('coin', left, pw.x, pw.y, pw.z, true);
  }
  if (why === 'fled') {
    say(game, loser, `You walked away from the bout with ${nameOf(winner)}${owe ? ` and forfeit ¤${owe}` : ''}.`, '#ffb080');
    say(game, winner, `${nameOf(loser)} walked away from the bout: it's yours${owe ? `, and ¤${owe}` : ''}.`, '#a0ffa0');
    return;
  }
  say(game, winner, `You won the bout with ${nameOf(loser)}${owe ? ` and ¤${owe}` : ''}.`, '#a0ffa0');
  say(game, loser, `${nameOf(winner)} won the bout${owe ? `: you pay ¤${owe}` : ''}.`, '#ffb080');
  // The one beaten down on one knee (and for a while after, no blow
  // between them lands: the bout's over); each sees it as their own.
  pl.kneelT = 4.5;
  game.audio?.play('thud', pl);
  game.renderer.emit(pl.x, pl.y + 0.2, pl.z, { n: 10, color: ['#c8b898', '#8a7a60'], up: 14, speed: 24, life: 0.5 });
  game.renderer.floatText(pl.x, pl.y + 2.4, pl.z, 'yields!', '#ffe070');
  (game.boutAfter ||= []).push({ a: pa, b: pb, t: 7 });
  for (const [s, foe, won] of [[winner, pl, true], [loser, pw, false]]) {
    const store = s === game.seat ? null : s.store && s.store.g;
    const scene = duelYield(game, foe, won, { name: nameOf(won ? loser : winner), me: entOf(game, s), quiet: true });
    if (!store && !game.scene) game.scene = scene;
    else if (store && !store.scene) store.scene = scene;
  }
}

// A blow between two players at a bout (as it would land): it starts the
// fight if they're still squaring up, and if it would take the one struck
// down to a quarter, it ends the bout instead. True if it did.
export function boutBlow(game, target, source, amount) {
  const bout = boutOf(game, target, source);
  if (!bout) return false;
  if (bout.ready > 0) begin(game, bout);
  const floor = Math.ceil(target.maxHp * 0.25);
  if (target.hp - amount > floor) return false;
  target.hp = Math.max(1, Math.min(target.hp, floor));
  target.flash = 0.12;
  const winner = entOf(game, bout.a) === source ? bout.a : bout.b;
  endBout(game, bout, winner);
  return true;
}

// Every frame: the count, the walking away, the time running out, the
// challenges no one answered.
export function updateBouts(game, dt) {
  if (game.boutAsks && game.boutAsks.length) {
    for (const ask of [...game.boutAsks]) {
      ask.t -= dt;
      if (ask.t > 0 && game.seats.includes(ask.from) && game.seats.includes(ask.to)) continue;
      game.boutAsks = game.boutAsks.filter((q) => q !== ask);
      if (game.seats.includes(ask.from)) say(game, ask.from, `${nameOf(ask.to)} didn't answer your challenge.`, '#c8d8ff');
    }
  }
  if (game.boutAfter && game.boutAfter.length) {
    for (const q of game.boutAfter) {
      q.t -= dt;
      if (q.noteT > 0) q.noteT -= dt;
    }
    game.boutAfter = game.boutAfter.filter((q) => q.t > 0);
  }
  for (const bout of [...(game.bouts || [])]) {
    const pa = entOf(game, bout.a);
    const pb = entOf(game, bout.b);
    if (!game.seats.includes(bout.a) || !game.seats.includes(bout.b) || !pa || !pb) {
      endBout(game, bout, null, 'The bout is off: the other\'s gone.');
      continue;
    }
    if (pa.dead || pb.dead) {
      endBout(game, bout, null, 'The bout is off.');
      continue;
    }
    // (Walked away: whichever went further from where they stood.)
    if (Math.max(Math.abs(pa.x - pb.x), Math.abs(pa.z - pb.z)) > APART || game.world.inInstance(pa.x) !== game.world.inInstance(pb.x)) {
      const da = Math.hypot(pa.x - bout.from.a.x, pa.z - bout.from.a.z);
      const db = Math.hypot(pb.x - bout.from.b.x, pb.z - bout.from.b.z);
      endBout(game, bout, da > db ? bout.b : bout.a, 'fled');
      continue;
    }
    if (game.sim.abs - bout.start > LONGEST) {
      endBout(game, bout, null, 'Neither of you gave way: the bout is called a draw.');
      continue;
    }
    if (bout.ready > 0) {
      const before = Math.ceil(bout.ready);
      bout.ready -= dt;
      const after = Math.ceil(bout.ready);
      if (after !== before && after > 0) {
        for (const p of [pa, pb]) game.renderer.floatText(p.x, p.y + 2.4, p.z, ['', 'One...', 'Two...', 'Three...'][after] || '', '#ffe070');
        game.audio?.play('select', pa);
      }
      if (bout.ready <= 0) {
        bout.ready = 0.001;
        begin(game, bout);
      }
    }
  }
}
