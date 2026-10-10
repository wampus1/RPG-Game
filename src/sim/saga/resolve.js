// (Round 79) Other ways out of a story than a fight: talking both sides
// round (mediating), paying someone off (a bribe), a forged paper, or
// exposing who's behind it with what you've found out.
//
//   - Mediate: talk each side round in turn (the better they like you and
//     the more winning your way, the likelier; the hotter their temper, the
//     less). Once all are swayed, it's settled.
//   - Bribe: coin, and it's done; but word of a bribe can get about.
//   - Forge: a paper in someone else's hand (a receipt, a will, a writ),
//     on a sheet of paper you carry. Well done, it settles it; botched,
//     the paper's wasted, and if it's spotted you're wanted for forgery.
//   - Expose: ask round the town what folk saw (each once). Two things
//     found out, and you can take it to the mayor or the watch: the one
//     behind it is named before everyone and sent away.
// Each story that has them lists them below (by who in it you'd talk to);
// they're offered once you've heard of the story (or to the one it's
// about, face to face). Whatever tasks the story had open count as done
// by you when it's settled this way.
import { R, nameOf, pidOf } from './core.js';
import { pick, layoutOf, recOf, isRec, persuade, purse, repWith, fullName } from './motifs/lib.js';
import { mayorOf, alive } from '../econ.js';
import { countItem, removeItem } from '../../game/inventory.js';

// By story: its ways out. `roles`: the cast to sway (mediate); `role` who
// to pay or fool ('any': anyone grown in the town); `culprit`: who's
// exposed. `outcome`: how it ends; `line`: what's told.
export const PEACE = {
  honour_duel: {
    mediate: { roles: ['a', 'b'], outcome: 'reconciled', line: '{pl} talked {a} and {b} out of their duel.' },
  },
  rivalry: {
    mediate: { roles: ['a', 'b'], outcome: 'friends', line: '{pl} brought {a} and {b} to shake hands.' },
  },
  strike: {
    mediate: { roles: ['lead', 'mayor'], outcome: 'reconciled', line: '{pl} sat {lead} and {mayor} down till they had a bargain.' },
    bribe: { role: 'lead', cost: 40, outcome: 'paid', line: '{pl} paid {lead} to call off the strike.' },
  },
  moneylender: {
    forge: { role: 'lender', outcome: 'saved', line: 'A receipt turned up, in {lender}\'s own hand, marking {debtor}\'s debt paid. ({pl} knows better.)', paper: 'a receipt marking the debt paid' },
    bribe: { role: 'lender', cost: 35, outcome: 'paid', line: '{pl} paid {lender} off, and {debtor} was let be.' },
    expose: { culprit: 'lender', outcome: 'exposed', line: '{pl} showed the town how {lender} had been cheating {debtor}.' },
  },
  inheritance: {
    mediate: { roles: ['a', 'b'], outcome: 'fair', line: '{pl} got {a} and {b} to share it fairly.' },
    forge: { role: 'a', outcome: 'fair', line: 'A will turned up, splitting it all evenly between {a} and {b}. ({pl} knows better.)', paper: 'a will that splits it evenly' },
  },
  witch_hunt: {
    expose: { culprit: null, clear: 'accused', outcome: 'cleared', line: '{pl} showed the town that {accused} had done nothing: the hunt was called off.' },
    mediate: { roles: ['accused'], outcome: 'cleared', line: '{pl} stood beside {accused} till the crowd went home.', crowd: true },
  },
  election: {
    bribe: { role: 'b', cost: 50, outcome: 'paid', line: '{b} withdrew from the vote, suddenly. ({pl} paid for it.)' },
  },
  murder: {
    expose: { culprit: 'killer', outcome: 'solved', line: '{pl} named {killer} as the one who killed {victim}, and showed how.' },
  },
  thief: {
    expose: { culprit: 'thief', outcome: 'caught', line: '{pl} showed the watch who\'d been stealing: {thief}.' },
  },
  smuggle: {
    bribe: { role: 'fence', cost: 25, outcome: 'bought', line: '{pl} paid {fence} to lose the goods.' },
    expose: { culprit: 'contact', outcome: 'caught', line: '{pl} gave the watch {contact}, and the smugglers\' road was shut.' },
  },
  pretender: {
    expose: { culprit: 'claimant', outcome: 'crushed', line: '{pl} showed {claimant}\'s claim for the lie it was.' },
    mediate: { roles: ['ruler', 'claimant'], outcome: 'reconciled', line: '{pl} brokered a peace between {ruler} and {claimant}.' },
  },
  sore_loser: {
    mediate: { roles: ['loser'], outcome: 'grumbled', line: '{pl} talked {loser} down.' },
  },
  gambler: {
    bribe: { role: 'gambler', cost: 30, outcome: 'quit', line: '{pl} paid off {gambler}\'s debts on a promise never to play again.' },
  },
  grudge: {
    bribe: { role: 'any', cost: 60, outcome: 'cooled', line: '{pl} sent blood-money to {band}; the grudge was let go.', word: true },
  },
};

const tid = (th) => `t${th.id}`;

// The names in a line.
function said(S, th, line, pid) {
  return line.replace(/\{(\w+)\}/g, (_, k) => (k === 'pl' ? nameOf(S, R.pl(pid)) : th.names[k] || (th.cast[k] ? nameOf(S, th.cast[k]) : k === 'band' ? 'the band' : k)));
}

// May `pid` be offered a way out of `th` by `npc`?
function knows(S, th, pid, npc) {
  if (S.hiddenFrom(th, pid)) return false;
  if (S.touchedBy(th, pid) || th.tasks.some((t) => S.heardOf(pid, t))) return true;
  return Object.values(th.cast).some((r) => isRec(npc, r));
}

const townOfNpc = (npc) => (npc.settlement ? npc.settlement.id : npc.rec ? npc.rec.sid : null);

// What `npc` can be asked, about the stories with other ways out.
export function peaceTopics(S, npc, pid) {
  const out = [];
  if (!npc || !npc.rec || npc.rec.visitor || npc.rec.age === 'child') return out;
  const sid = townOfNpc(npc);
  for (const th of S.live()) {
    const P = PEACE[th.m];
    if (!P || th.done || !knows(S, th, pid, npc)) continue;
    const v = (th.vars.peace ||= {});
    // Mediating: each side, till swayed.
    if (P.mediate) {
      for (const role of P.mediate.roles) {
        if (!th.cast[role] || !isRec(npc, th.cast[role]) || (v.swayed || {})[role]) continue;
        out.push({ id: 'sgp_mediate', arg: `${tid(th)}:${role}`, label: P.mediate.crowd ? 'Stand with them against the crowd.' : `About ${th.title}: there's another way.` });
      }
    }
    // A bribe.
    if (P.bribe) {
      const b = P.bribe;
      const hit = b.role === 'any' ? th.sid === sid || !th.sid : th.cast[b.role] && isRec(npc, th.cast[b.role]);
      if (hit && !(b.role === 'any' && npc.rec.job === 'guard')) out.push({ id: 'sgp_bribe', arg: tid(th), label: b.role === 'any' ? `Can you get word to ${th.names.band || 'them'}? I'll pay to end it. (¤${b.cost})` : `What would it take to make this go away? (¤${b.cost})` });
    }
    // A forged paper.
    if (P.forge && th.cast[P.forge.role] && th.sid === sid && (npc.rec.job === 'mayor' || isRec(npc, th.cast[P.forge.role]))) {
      out.push({ id: 'sgp_forge', arg: tid(th), label: `Show them ${P.forge.paper} (forged; uses a sheet of paper)` });
    }
    // Exposing it: asking round first, then to the mayor or the watch.
    if (P.expose && th.sid === sid) {
      const culprit = P.expose.culprit && th.cast[P.expose.culprit];
      if (culprit && isRec(npc, culprit)) continue;
      const clues = (v.clues || {})[pid] || 0;
      const asked = ((v.asked || {})[pid] || []).includes(npc.rec.idx);
      const authority = npc.rec.job === 'mayor' || npc.rec.job === 'guard';
      if (clues >= 2 && authority) out.push({ id: 'sgp_expose', arg: tid(th), label: P.expose.culprit ? `I know who's behind ${th.title}.` : `${th.names[P.expose.clear] || 'They'}'s done nothing. I can show it.` });
      else if (!asked && !authority) out.push({ id: 'sgp_ask', arg: tid(th), label: `What do you know about ${th.title}?` });
    }
  }
  return out;
}

// It's settled, `pid`'s way.
function settle(S, th, pid, how, P) {
  const line = said(S, th, P.line, pid);
  th.vars.peaceBy = pid;
  S.touch(th, pid);
  for (const t of S.tasksOf(th)) S.complete(t, R.pl(pid));
  S.emit('peace_made', { th: th.id, m: th.m, how, pid, sid: th.sid });
  S.end(th, P.outcome, line, { news: th.sid !== null && th.sid !== undefined ? [th.sid] : [] });
  S.trace?.('peace', `${th.title}: settled by ${how} (${P.outcome})`);
  return line;
}

export function peaceRespond(S, npc, game, id, arg) {
  const pid = pidOf(game.player);
  const [tpart, role] = String(arg || '').split(':');
  const th = S.thread(+String(tpart).slice(1));
  const P = th && PEACE[th.m];
  if (!th || !P || th.done) return { lines: ['That\'s all over now.'] };
  const v = (th.vars.peace ||= {});
  const rng = S.rng(th, Math.floor(S.now) ^ (npc.rec ? npc.rec.idx : 0));
  const L = layoutOf(S, th.sid);
  if (id === 'sgp_mediate') {
    const r = recOf(S, th.cast[role]);
    if (!r) return null;
    const tries = (v.tries ||= {});
    const k = `${pid}:${role}:${S.day}`;
    if ((tries[k] || 0) >= 2) return { lines: [pick(rng, ['Not today. I\'ve heard enough.', 'Leave it. Come back tomorrow, maybe.'])] };
    tries[k] = (tries[k] || 0) + 1;
    S.touch(th, pid);
    if (persuade(S, npc, rng, 0.32, (r.personality?.temper ?? 0.5) * 0.3)) {
      (v.swayed ||= {})[role] = true;
      const left = P.mediate.roles.filter((q) => th.cast[q] && !v.swayed[q]);
      if (!left.length) {
        const line = settle(S, th, pid, 'mediation', P.mediate);
        return { lines: [pick(rng, ['...All right. All right. For the sake of peace.', 'Fine. I\'ll let it go, if they do.', 'You\'ve a way with words. Very well.']), `(${line})`] };
      }
      return { lines: [pick(rng, ['...Maybe you\'re right.', 'If the other side will, I will.', 'I\'m tired of it, honestly.']), `(Now ${left.map((q) => th.names[q]).join(' and ')}.)`] };
    }
    return { lines: [pick(rng, ['Easy for you to say.', 'Stay out of it.', 'Not after what happened. Not yet.'])] };
  }
  if (id === 'sgp_bribe') {
    const b = P.bribe;
    const cost = b.cost;
    if (purse(S, pid) < cost) return { lines: [`It would take ¤${cost}. You don't have it.`] };
    removeItem(game.player.inv, 'coin', cost);
    game.audio?.play('coin');
    // (Word of a bribe gets about, now and then.)
    if (b.word || rng.chance(0.25)) {
      const m = L ? mayorOf(L) : null;
      if (m && L) repWith(S, L, m, -8);
      if (!b.word) game.ui?.msg('Word of the bribe gets about town.', '#ffb080');
    }
    if (b.role !== 'any' && L) repWith(S, L, recOf(S, th.cast[b.role]), 6);
    const line = settle(S, th, pid, 'bribe', b);
    return { lines: [pick(rng, ['...Consider it done.', 'Coin talks. It\'s over.', 'Pleasure doing business.']), `(${line})`] };
  }
  if (id === 'sgp_forge') {
    const f = P.forge;
    if (countItem(game.player.inv, 'paper') < 1) return { lines: ['(You\'d need a sheet of paper to forge it on.)'] };
    removeItem(game.player.inv, 'paper', 1);
    const hero = game.hero && game.hero.stats ? game.hero.stats : {};
    const skill = (hero.int ?? 2) * 0.05 + (hero.dex ?? 2) * 0.04;
    if (rng.chance(0.42 + skill)) {
      const line = settle(S, th, pid, 'forgery', f);
      return { lines: [pick(rng, ['...That\'s their hand, all right. Well, that settles it.', 'I see. Then there\'s no more to be said.']), `(${line})`] };
    }
    if (rng.chance(0.5) && th.sid !== null && th.sid !== undefined) {
      S.sim.justice.commit(th.sid, 'forgery', { known: true, desc: `Forging ${f.paper}`, quiet: true });
      return { lines: ['This is a forgery! And a poor one. GUARDS!'] };
    }
    return { lines: ['Hm. Something about this isn\'t right. I\'ll keep it, and think on it.', '(The paper\'s gone, and it hasn\'t worked.)'] };
  }
  if (id === 'sgp_ask') {
    const asked = ((v.asked ||= {})[pid] ||= []);
    if (npc.rec) asked.push(npc.rec.idx);
    S.touch(th, pid);
    if (persuade(S, npc, rng, 0.42, 0)) {
      const clues = ((v.clues ||= {})[pid] = ((v.clues || {})[pid] || 0) + 1);
      const who = P.expose.culprit ? th.names[P.expose.culprit] : th.names[P.expose.clear];
      const lines = P.expose.culprit
        ? [pick(rng, [`I saw ${who} out late, the night it happened.`, `${who} has been flush with coin since. Where from, I wonder?`, `Ask ${who} where they were. I'd like to know too.`, `${who} and some stranger, whispering by the well. I thought nothing of it.`])]
        : [pick(rng, [`${who}? They were with me all that day.`, 'It was the frost that did it, not anyone\'s curse.', `${who} has never hurt a soul. Everyone knows it, really.`])];
      lines.push(clues >= 2 ? '(You\'ve enough to take to the mayor or the watch.)' : '(Something to go on. One more like it, and you could take it to the mayor or the watch.)');
      return { lines };
    }
    return { lines: [pick(rng, ['I don\'t know anything about that.', 'I keep my head down. Ask someone else.', 'Nothing. Sorry.'])] };
  }
  if (id === 'sgp_expose') {
    const e = P.expose;
    if (((v.clues || {})[pid] || 0) < 2) return { lines: ['On what grounds?'] };
    const r = e.culprit ? recOf(S, th.cast[e.culprit]) : null;
    if (r && L && alive(r) && S.sim.society && S.sim.society.exile) S.sim.society.exile(L, r, S.day, rng, lcFirstTitle(th));
    if (e.clear && L) repWith(S, L, recOf(S, th.cast[e.clear]), 20);
    const line = settle(S, th, pid, 'evidence', e);
    S.sim.addRenown?.(th.sid, 3, 'getting to the truth');
    return { lines: [r ? `${fullName(r)}? ...I see it now. They'll answer for it.` : 'Then this ends here. Thank you.', `(${line})`] };
  }
  return null;
}

const lcFirstTitle = (th) => `what came out about ${(/^(The|A|An) /.test(th.title) ? th.title[0].toLowerCase() + th.title.slice(1) : th.title)}`;

export const isPeaceTopic = (id) => typeof id === 'string' && id.startsWith('sgp_');

// (For the tests and the debugger: which stories have which ways out.)
export function waysOut(mid) {
  return Object.keys(PEACE[mid] || {});
}
