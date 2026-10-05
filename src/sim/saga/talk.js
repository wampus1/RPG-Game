// Talking about the stories (see game/dialogue.js): someone with something
// to ask of you (the '!' over them) asks it; someone you've done it for
// (the '?') hears that it's done and pays; anyone can tell you what trouble
// they've heard of round here; and the stories' own people (a messenger,
// an outlaw chief at a meeting, a captive, a lost child) have their own
// say (see each motif's `talk`).
import { MOTIFS, R, sameRef, nameOf, NameOf, pidOf, resolve, isAlive, lcFirst } from './core.js';
import { RNG, hash4 } from '../../util/rng.js';
import { ITEMS } from '../../world/items.js';
import { countItem, removeItem } from '../../game/inventory.js';

// (A task's 'food' is any food at all.)
const isFood = (k) => ITEMS[k] && ITEMS[k].kind === 'food';
const countFor = (game, item) => (item === 'food' ? game.player.inv.reduce((n, q) => n + (q && isFood(q.item) ? q.count : 0), 0) : countItem(game.player.inv, item));
const hasFor = (game, t) => t.item && countFor(game, t.item) >= (t.n || 1);
function takeFor(game, t) {
  if (t.item !== 'food') return removeItem(game.player.inv, t.item, t.n || 1);
  let left = t.n || 1;
  for (const q of game.player.inv) {
    if (!q || !isFood(q.item) || left <= 0) continue;
    const k = Math.min(q.count, left);
    removeItem(game.player.inv, q.item, k);
    left -= k;
  }
  return true;
}

const capFirst = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const pickOf = (rng, a) => a[Math.floor(rng.next() * a.length)];
// (The same words for the same task every time it's offered: a dialogue
// asks for its topics every frame.)
const steady = (t) => new RNG(hash4(t.id | 0, 0x7a5c, 1, 2));

function isGiver(t, npc) {
  return t.giver && t.giver.t === 'rec' && npc.rec && !npc.rec.visitor && t.giver.idx === npc.rec.idx && t.giver.sid === (npc.rec.sid ?? npc.settlement?.id);
}

function townOf(npc) {
  return npc.settlement ? npc.settlement.id : npc.rec ? npc.rec.sid : null;
}

// What they'll talk about (first in the list, before the everyday).
export function sagaTopics(npc, game) {
  const S = game.sim.saga;
  if (!S) return [];
  const pid = pidOf(game.player);
  const out = [];
  // A story's own person: what their story gives them to say.
  if (npc.saga) {
    const th = S.thread(npc.saga.th);
    const M = th && MOTIFS[th.m];
    const a = th && S.actorSpec(th, npc.saga.key);
    if (M && M.talk && a) {
      try {
        out.push(...(M.talk(th, a, npc, pid, S) || []));
      } catch (e) {
        S.fault(th, e);
      }
    }
    return out;
  }
  for (const th of S.owing()) {
    for (const t of th.tasks) {
      // Something to hand to them (a letter, orders), from someone else.
      if (t.status === 'open' && t.kind === 'deliver' && t.item && t.target && t.target.t === 'rec' && npc.rec && t.target.sid === (npc.rec.sid ?? npc.settlement?.id) && t.target.idx === npc.rec.idx && S.claimedBy(t, pid) && hasFor(game, t)) {
        out.push({ id: 'sg_deliver', arg: String(t.id), label: `I've something for you, from ${t.giverName || 'a friend'}.` });
      }
      if (!isGiver(t, npc)) continue;
      if (t.status === 'won' && t.ready === pid) out.push({ id: 'sg_turnin', arg: String(t.id), label: pickOf(steady(t), ['It\'s done.', 'I\'ve seen to it.', `About ${lcFirst(t.title)}: it's done.`]) });
      else if (t.status === 'open' && S.visibleTo(t, pid) && hasFor(game, t)) out.push({ id: 'sg_give', arg: String(t.id), label: t.item === 'food' ? 'I\'ve brought food.' : `I have the ${ITEMS[t.item] ? ITEMS[t.item].name.toLowerCase() : t.item}.` });
      else if (t.status === 'open' && S.visibleTo(t, pid)) {
        if (S.claimedBy(t, pid)) out.push({ id: 'sg_check', arg: String(t.id), label: `About ${lcFirst(t.title)}...` });
        else if (S.knownIn(t, townOf(npc))) out.push({ id: 'sg_offer', arg: String(t.id), label: t.offerLabel || pickOf(steady(t), ['You look troubled. What is it?', 'I hear you need help.', 'Is something wrong?']) });
      }
    }
    // (And whatever else a story has them say: a widow about the one
    // she's lost, a witness about what they saw.)
    const M = MOTIFS[th.m];
    if (M && M.townTalk && !th.done) {
      try {
        out.push(...(M.townTalk(th, npc, pid, S) || []));
      } catch (e) {
        S.fault(th, e);
      }
    }
  }
  if (npc.rec && npc.rec.age !== 'child' && !npc.rec.visitor && S.tasksIn(townOf(npc), pid).some((t) => !isGiver(t, npc))) out.push({ id: 'sg_trouble', label: 'Heard of any trouble round here?' });
  return out;
}

// An answer. `id` one of the topics above (or a motif's own), `arg` the task
// (or whatever the motif passed).
export function sagaRespond(npc, game, id, arg) {
  const S = game.sim.saga;
  const pid = pidOf(game.player);
  const rng = new RNG(hash4(npc.id | 0, Math.floor(S.now), 0x7a1c));
  const t = arg !== undefined && /^\d+$/.test(String(arg)) ? S.task(+arg) : null;
  const th = t ? S.threadOf(t) : npc.saga ? S.thread(npc.saga.th) : null;
  const M = th ? MOTIFS[th.m] : null;
  const h = t && M && M.tasks ? M.tasks[t.role] : null;
  switch (id) {
    case 'sg_offer': {
      if (!t || t.status !== 'open') return { lines: ['Oh, never mind. It\'s been seen to.'] };
      S.hear(pid, t);
      S.touch(th, pid);
      const lines = [t.pitch || `${t.title}.`];
      if (h && h.offer) lines.push(...[].concat(h.offer(th, t, pid, S) || []));
      const others = t.claims.filter((c) => !(c.who.t === 'pl' && c.who.pid === pid)).map((c) => c.name);
      if (others.length) lines.push(`${others.slice(0, 2).join(' and ')} ${others.length > 1 ? 'are' : 'is'} already on it, but the more the better.`);
      return {
        lines,
        choices: [{ id: 'sg_accept', arg: String(t.id), label: h && h.yes ? h.yes : 'I\'ll do it.' }, { id: 'sg_decline', arg: String(t.id), label: h && h.no ? h.no : 'Sorry, I can\'t.' }],
        back: null,
      };
    }
    case 'sg_accept': {
      if (!t || t.status !== 'open') return { lines: ['It\'s already been seen to.'] };
      S.accept(t, R.pl(pid));
      if (t.at) {
        const s = npc.settlement || game.world.ow.settlements[t.sid];
        game.world.ow.pin(t.at.x, t.at.z, t.pinLabel || t.title, t.glyph || '!');
        void s;
      }
      const reply = h && h.accepted_line ? [].concat(h.accepted_line(th, t, pid, S)) : [pickOf(rng, ['Thank you. Truly.', 'Bless you. I\'ll be waiting.', 'I knew I could count on someone.'])];
      return { lines: [...reply, `(${t.at ? 'Marked on your map; n' : 'N'}oted in your quest log: O)`] };
    }
    case 'sg_decline': {
      if (t) S.hear(pid, t);
      return { lines: [pickOf(rng, ['I understand. If you change your mind...', 'Oh. All right, then.', 'Someone else, perhaps.'])] };
    }
    case 'sg_check': {
      if (!t) return { lines: ['Hm?'] };
      const lines = h && h.status ? [].concat(h.status(th, t, pid, S)) : [];
      if (!lines.length) lines.push(t.kind === 'slay' ? `${Math.max(0, t.need - t.count)} more to go.` : pickOf(rng, ['Any luck?', 'Still nothing? Please hurry.', 'I\'m counting on you.']));
      return { lines, choices: [{ id: 'sg_giveup', arg: String(t.id), label: 'I can\'t do it after all.' }], back: 'I\'ll keep at it.' };
    }
    case 'sg_give': {
      if (!t || t.status !== 'open' || !hasFor(game, t)) return { lines: ['Hm? You don\'t have it.'] };
      takeFor(game, t);
      if (!S.claimedBy(t, pid)) S.accept(t, R.pl(pid));
      S.complete(t, R.pl(pid));
      const paid = t.status === 'won' ? S.turnIn(t, pid) : null;
      const lines = h && h.thanks ? [].concat(h.thanks(th, t, pid, S)) : [pickOf(rng, ['That\'s it! Thank you.', 'You found it. I can hardly believe it.'])];
      if (paid && paid.coins) lines.push(`Here: ¤${paid.coins}.`);
      return { lines };
    }
    case 'sg_deliver': {
      if (!t || t.status !== 'open' || !hasFor(game, t)) return { lines: ['For me? Where?'] };
      takeFor(game, t);
      const lines = h && h.thanks ? [].concat(h.thanks(th, t, pid, S)) : [pickOf(rng, ['For me? Thank you for bringing it all this way.', 'Ah, at last. Thank you.'])];
      const before = t.reward.coins || 0;
      S.complete(t, R.pl(pid));
      if (t.status === 'done' && before) lines.push(`(¤${before} for your trouble.)`);
      return { lines };
    }
    case 'sg_giveup': {
      if (!t) return { lines: ['Hm?'] };
      S.drop(t, R.pl(pid));
      return { lines: [pickOf(rng, ['I see. Thank you for trying.', 'Oh... well. I understand.'])] };
    }
    case 'sg_turnin': {
      if (!t || t.status !== 'won' || t.ready !== pid) return { lines: ['Hm?'] };
      const paid = S.turnIn(t, pid);
      const lines = h && h.thanks ? [].concat(h.thanks(th, t, pid, S)) : [pickOf(rng, ['You did it! Thank you, from the bottom of my heart.', 'I can sleep tonight. Thank you.', 'I won\'t forget this.'])];
      if (paid && paid.coins) lines.push(`Here: ¤${paid.coins}, as I promised.`);
      else if ((t.reward.coins || 0) > 0) lines.push('I\'ve nothing left to give you, but you have my thanks.');
      for (const [k, n] of (paid && paid.items) || []) lines.push(`(You receive ${n > 1 ? `${n} ` : ''}${game.itemName ? game.itemName(k) : k}.)`);
      return { lines };
    }
    case 'sg_trouble': {
      const sid = townOf(npc);
      const list = S.tasksIn(sid, pid).filter((q) => !isGiver(q, npc)).slice(0, 5);
      if (!list.length) return { lines: ['Trouble? Not that I\'ve heard.'] };
      for (const q of list) S.hear(pid, q);
      const lines = [pickOf(rng, ['Trouble? Where to begin.', 'You\'ve not heard?', 'Folk are talking of little else.'])];
      for (const q of list.slice(0, 3)) {
        const qth = S.threadOf(q);
        const where = q.giver && q.giver.t === 'rec' && q.giver.sid === sid ? `Talk to ${q.giverName}.` : q.giver ? `${q.giverName} of ${game.world.ow.settlements[q.giver.sid]?.name || 'elsewhere'} is asking.` : q.at ? `It's ${S.whereTask(q, sid)}.` : '';
        lines.push(`${capFirst(q.rumour || q.title)}. ${where}`.trim());
        void qth;
      }
      return {
        lines,
        choices: list.filter((q) => !q.giver || q.board).slice(0, 3).map((q) => ({ id: 'sg_offer', arg: String(q.id), label: `Tell me more: ${lcFirst(q.title)}` })),
        back: 'Thanks for telling me.',
      };
    }
    default: {
      // A motif's own.
      const th2 = th || (arg && String(arg).startsWith('t') ? S.thread(+String(arg).slice(1).split(':')[0]) : null);
      const M2 = th2 ? MOTIFS[th2.m] : null;
      if (M2 && M2.respond) {
        try {
          const r = M2.respond(th2, npc, pid, id, arg, S);
          if (r) return r;
        } catch (e) {
          S.fault(th2, e);
        }
      }
      return { lines: ['Hm?'] };
    }
  }
}

// Is this one of the stories' own topics?
export const isSagaTopic = (id) => typeof id === 'string' && id.startsWith('sg');

export { sameRef, nameOf, NameOf, resolve, isAlive };
