// Families (round 54).
//
//   - An orphan: a child left with nobody. Who takes them in: kin, a
//     childless couple, the temple, the gruffest neighbour in town (who
//     surprises everyone), or nobody, until someone speaks for them.
//   - A golden wedding: fifty years married. The family wants a party, and
//     the old song from their wedding, and the ring that was lost.
//   - A letter come late: addressed to someone long dead, from someone far
//     away. Carry a reply, and find out who.
//   - An inheritance: the richest old soul in town is dead, and the heirs
//     are circling. The will says something nobody expected, or can't be
//     found at all.
//   - A prodigy: a youth with a gift. Their family can't agree what to do
//     with it; a master from the Academy might.
//   - The sleepwalker: someone walks out of town every night, and can't
//     remember it. Follow them, and find out where (and why).
//   - Two of a kind: a stranger comes to town with a face everyone knows.
import { motif, R, nameOf } from '../core.js';
import { pick, say, layoutOf, laidTowns, townName, townMid, living, adults, fullName, kinOf, recOf, has, nat, single, spotNear, persuade, repWith, isRec, someone, rngFor } from './lib.js';
import { makePerson } from '../actors.js';
import { alive, DAY, mayorOf } from '../../econ.js';
import { newcomer } from '../../civic.js';
import { ITEMS } from '../../../world/items.js';

const tid = (th) => `t${th.id}`;
const first = (r) => (r ? r.name.first : 'them');

// ------------------------------------------------------------ an orphan
motif({
  id: 'orphan',
  family: 'kin',
  max: 3,
  key: (o) => `orphan:${o.cast.child.sid}:${o.cast.child.idx}`,
  title: (th) => `Who Will Take In ${th.names.child}?`,
  seeds: [{
    on: 'npc_died',
    make: (ev, S) => {
      const L = layoutOf(S, ev.who && ev.who.sid);
      const d = L && L.npcs[ev.who.idx];
      if (!d || !d.children || !d.children.length) return null;
      for (const ci of d.children) {
        const c = L.npcs[ci];
        if (!c || !alive(c) || c.age !== 'child' || c.orphan) continue;
        // (Nobody left: no other parent living.)
        if ((c.parents || []).some((p) => p !== d.idx && L.npcs[p] && alive(L.npcs[p]) && !L.npcs[p].migrated)) continue;
        return { cast: { child: R.rec(L.settlement.id, c.idx), lost: ev.who, town: R.town(L.settlement.id) }, sid: L.settlement.id, vars: { cause: ev.cause } };
      }
      return null;
    },
  }],
  nodes: {
    alone: {
      enter(th, S) {
        const L = layoutOf(S, th.sid);
        const c = recOf(S, th.cast.child);
        if (!L || !c) return S.end(th, 'faded');
        const rng = S.rng(th, 0x0f1);
        c.orphan = th.id;
        // Who might take them: kin first, then the kind, then the temple.
        const kin = adults(L).filter((r) => r.name.last === c.name.last && r.idx !== c.idx && !(c.parents || []).includes(r.idx));
        const kind = adults(L).filter((r) => nat(r, 'kindness') > 0.6 && !(r.children || []).some((i) => L.npcs[i] && alive(L.npcs[i]) && L.npcs[i].age === 'child'));
        const gruff = adults(L).filter((r) => has(r, 'gruff') || has(r, 'stingy'));
        const priest = adults(L).find((r) => r.job === 'priest');
        th.vars.who = S.choose(th, [
          { to: 'kin', w: kin.length ? 1.5 : 0 },
          { to: 'kind', w: kind.length ? 1 : 0 },
          { to: 'gruff', w: gruff.length ? 0.4 : 0 },
          { to: 'temple', w: priest ? 0.6 : 0 },
          { to: 'nobody', w: 0.5 },
        ], rng).to;
        const g = th.vars.who === 'kin' ? pick(rng, kin) : th.vars.who === 'kind' ? pick(rng, kind) : th.vars.who === 'gruff' ? pick(rng, gruff) : th.vars.who === 'temple' ? priest : null;
        if (g) {
          th.cast.guardian = R.rec(th.sid, g.idx);
          th.names.guardian = fullName(g);
        }
        S.note(th, `${fullName(c)} has nobody now, since ${th.names.lost} died${th.vars.cause ? ` (${th.vars.cause})` : ''}. ${pick(rng, ['They sit on their doorstep, waiting.', 'Neighbours are taking turns to feed them.', 'They haven\'t cried. That\'s what worries people.'])}`, { news: [th.sid] });
        if (th.vars.who === 'nobody') {
          const t = S.post(th, {
            role: 'home', kind: 'talk', title: `Find someone to take in ${c.name.first}`, sid: th.sid, giver: null,
            pitch: `${c.name.first} sleeps in the stable now. Someone ought to take them in. Someone ought to ask.`,
            reward: { coins: 0, rep: 15, renown: th.sid, renownPts: 4, renownWhy: `finding ${c.name.first} a home`, fame: 1 },
          });
          t.rumour = `${c.name.first}, orphaned, has nobody to take them in`;
        }
      },
      day(th, S, rng) {
        const L = layoutOf(S, th.sid);
        const c = recOf(S, th.cast.child);
        if (!L || !c || !alive(c)) return S.end(th, 'faded');
        const days = (S.now - th.nodeAt) / DAY;
        if (th.vars.who !== 'nobody' && days >= 1) return takenIn(th, S, recOf(S, th.cast.guardian), null, rng);
        // (Nobody, for a while: a claim from far off, or the child runs.)
        if (days > 3 && !th.vars.turn) {
          th.vars.turn = S.choose(th, [{ to: 'relative', w: 0.6 }, { to: 'run', w: nat(c, 'bravery') }, { to: 'wait', w: 1 }], rng).to;
          if (th.vars.turn === 'relative') {
            const p = makePerson(rng, L.settlement.style || 'vale', 'merchant');
            th.vars.claimant = `${p.name.first} ${c.name.last}`;
            th.vars.greedy = rng.chance(0.5);
            S.note(th, `A ${pick(rng, ['cousin', 'great-aunt', 'uncle'])} of ${c.name.first}'s has written from the city: ${th.vars.claimant}. They'll take the child.${th.vars.greedy ? ` People wonder whether it's the child they want, or what ${th.names.lost} left.` : ''}`);
          } else if (th.vars.turn === 'run') {
            c.away = true;
            if (c.ent && !c.ent.dead) S.game.despawnNpc(c.ent);
            return S.end(th, 'ran away', `${fullName(c)} ran away in the night. A carter saw a child walking the road alone, toward ${pick(rng, ['the city', 'the coast', 'the hills'])}.`, { news: [th.sid] });
          }
        }
        if (th.vars.turn === 'relative' && days > 5) {
          c.away = true;
          c.migrated = 'kin';
          if (c.ent && !c.ent.dead) S.game.despawnNpc(c.ent);
          return S.end(th, 'sent away', `${fullName(c)} went to the city with ${th.vars.claimant}. ${th.vars.greedy ? 'The house was sold within the week.' : 'They wave from the cart all the way down the road.'}`, { news: [th.sid] });
        }
        if (days > 10) return takenIn(th, S, recOf(S, th.cast.guardian) || adults(L).find((r) => r.job === 'priest') || mayorOf(L), null, rng);
      },
      fade: 14,
    },
  },
  tasks: { home: {} },
  townTalk(th, npc, pid, S) {
    if (th.vars.who !== 'nobody' || th.done || !npc.rec || npc.rec.sid !== th.sid || npc.rec.age === 'child' || (th.vars.asked || []).includes(`${pid}:${npc.rec.idx}`)) return [];
    return [{ id: 'sgo_take', arg: tid(th), label: `Would you take in ${first(recOf(S, th.cast.child))}? They've nobody.` }];
  },
  respond(th, npc, pid, id, arg, S) {
    if (id !== 'sgo_take') return null;
    const rng = S.rng(th, 0x0f2 + (npc.id | 0));
    (th.vars.asked ||= []).push(`${pid}:${npc.rec.idx}`);
    S.touch(th, pid);
    const r = npc.rec;
    const L = layoutOf(S, th.sid);
    const room = r.home !== null && r.home !== undefined && L.buildings[r.home];
    if (room && persuade(S, npc, rng, 0.1 + nat(r, 'kindness') * 0.5, has(r, 'stingy') ? 0.25 : 0)) {
      const t = S.tasksOf(th, 'home')[0];
      if (t) S.complete(t, R.pl(pid));
      takenIn(th, S, r, pid, rng);
      return { lines: [pick(rng, ['...Yes. Yes, I will. I\'ve a room going spare, and I\'ve been lonely.', 'I knew their mother. Of course. Of course I will.', 'Hm. They\'d have to do their chores. ...Go on, then. Tell them to bring their things.'])] };
    }
    return { lines: [pick(rng, ['I\'ve mouths enough to feed. I\'m sorry.', 'I wish I could. I can\'t.', 'Not my business. Ask the temple.'])] };
  },
  ended(th, S) {
    const c = recOf(S, th.cast.child);
    if (c && c.orphan === th.id) c.orphan = null;
  },
});

function takenIn(th, S, g, pid, rng) {
  const c = recOf(S, th.cast.child);
  if (!c || !g) return S.end(th, 'faded');
  if (g.home !== null && g.home !== undefined) {
    c.home = g.home;
    c.household = g.household;
  }
  c.guardian = g.idx;
  c.mood = Math.min(1, (c.mood ?? 0.5) + 0.3);
  const w = th.vars.who;
  const line = pid ? `${nameOf(S, R.pl(pid))} asked around, and ${fullName(g)} took ${c.name.first} in.`
    : w === 'gruff' ? `${fullName(g)}, of all people (who never has a kind word for anyone), took ${c.name.first} in. They're often seen together now, ${g.name.first} grumbling and the child grinning.`
      : w === 'temple' || g.job === 'priest' ? `${c.name.first} lives at the temple now, with ${fullName(g)}, and sweeps the steps, and sings louder than anyone.`
        : `${fullName(g)} took ${c.name.first} in. ${pick(rng, ['They\'re family now.', 'There\'s a new bed by the fire.', 'The child has started smiling again.'])}`;
  S.end(th, 'taken in', line, { news: [th.sid] });
}

// ------------------------------------------------------------ a golden wedding
motif({
  id: 'golden_wedding',
  family: 'kin',
  max: 2,
  key: (o) => `gold:${o.cast.a.sid}:${o.cast.a.idx}`,
  title: (th) => `${th.names.a.split(' ')[0]} and ${th.names.b.split(' ')[0]}: Fifty Years`,
  scan(S, rng) {
    if (!rng.chance(0.05)) return null;
    for (const L of rng.shuffle(laidTowns(S)).slice(0, 3)) {
      const old = living(L).filter((r) => r.age === 'elder' && r.partner !== null && r.partner !== undefined && r.idx < r.partner && L.npcs[r.partner] && alive(L.npcs[r.partner]));
      if (!old.length) continue;
      const a = rng.pick(old);
      return { cast: { a: R.rec(L.settlement.id, a.idx), b: R.rec(L.settlement.id, a.partner), town: R.town(L.settlement.id) }, sid: L.settlement.id };
    }
    return null;
  },
  nodes: {
    planning: {
      enter(th, S) {
        const L = layoutOf(S, th.sid);
        const a = recOf(S, th.cast.a);
        const b = recOf(S, th.cast.b);
        if (!L || !a || !b) return S.end(th, 'faded');
        const rng = S.rng(th, 0x601);
        const kid = kinOf(L, a).find((k) => (a.children || []).includes(k.idx)) || someone(L, rng, null, [a, b]);
        if (kid) {
          th.cast.kid = R.rec(th.sid, kid.idx);
          th.names.kid = fullName(kid);
        }
        th.vars.ill = rng.chance(0.25);
        th.vars.song = pick(rng, ['"The Lantern by the Mill"', '"Two Swallows"', '"Come Home Before the Rain"', '"The Long Way Round"']);
        th.vars.joy = 0;
        S.note(th, `${th.names.a} and ${th.names.b} have been married fifty years. ${kid ? `${fullName(kid)} is planning a party, in secret (badly).` : 'The street is planning a party.'}`, { news: [th.sid] });
        const ev = S.sim.events.announce(L, 'feast', S.day, { host: kid ? kid.idx : a.idx, spend: 0, name: `${a.name.first} and ${b.name.first}'s golden wedding` });
        th.vars.ev = ev.id;
        th.vars.day = ev.day;
        if (kid) {
          const t = S.post(th, {
            role: 'song', kind: 'talk', title: `Play ${th.vars.song} at ${first(a)} and ${first(b)}'s party`, sid: th.sid, giver: th.cast.kid,
            pitch: `They danced to ${th.vars.song} at their wedding. Nobody plays it any more. If someone could, on the night... they'd cry. In a good way.`,
            reward: { coins: 8, rep: 12, fame: 0.5 },
          });
          t.offerLabel = 'You look like you\'re hiding something.';
          if (rng.chance(0.6) && ITEMS.gem) {
            const t2 = S.post(th, {
              role: 'ring', kind: 'fetch', title: `Bring a gem for a new ring for ${first(b)}`, sid: th.sid, giver: th.cast.kid, item: 'gem', n: 1,
              pitch: `${first(b)} lost their wedding ring in the river, thirty years ago. They still look at their hand sometimes. A gem, any gem, and the smith will make a new one.`,
              reward: { coins: 10, rep: 12, fame: 0.5 },
            });
            t2.offerLabel = 'What are you two whispering about?';
          }
        }
      },
      day(th, S, rng) {
        const L = layoutOf(S, th.sid);
        const a = recOf(S, th.cast.a);
        const b = recOf(S, th.cast.b);
        if (!L || !a || !b || !alive(a) || !alive(b)) {
          const gone = !a || !alive(a) ? th.names.a : th.names.b;
          return S.end(th, 'never came', `${gone} died a few days short of fifty years married. The party was a wake instead.`, { news: [th.sid] });
        }
        if (S.day <= th.vars.day) return;
        const j = th.vars.joy;
        for (const r of [a, b]) r.mood = Math.min(1, (r.mood ?? 0.5) + 0.2 + j * 0.1);
        const ill = th.vars.ill;
        S.end(th, 'celebrated', `${th.names.a} and ${th.names.b} celebrated fifty years married${ill ? `, with the party brought to ${first(b)}'s bedside` : ''}. ${th.vars.played ? `When ${th.vars.song} began, ${first(a)} held out a hand, and ${first(b)} took it, and they danced${ill ? ', sitting down' : ''}.` : pick(rng, ['Everyone made a speech. Some of them were short.', `${first(a)} admitted they've never liked ${first(b)}'s mother's stew. Fifty years! The room roared.`, 'They held hands all evening, like children.'])}${th.vars.ring ? ` And ${first(b)} has a ring again.` : ''}`, { news: [th.sid] });
      },
      fade: 8,
    },
  },
  tasks: {
    song: {},
    ring: { done(th) { th.vars.ring = true; th.vars.joy++; }, thanks: () => ['It\'s perfect. The smith can have it done by the party. Not a word!'] },
  },
  townTalk(th, npc, pid, S) {
    const t = S.tasksOf(th, 'song')[0];
    if (!t || !S.claimedBy(t, pid) || !isRec(npc, th.cast.kid)) return [];
    const inst = S.game.player.inv.some((q) => q && ITEMS[q.item] && ITEMS[q.item].instrument);
    return inst ? [{ id: 'sgg_play', arg: tid(th), label: `I've learnt ${th.vars.song}. I'll play it on the night.` }] : [];
  },
  respond(th, npc, pid, id, arg, S) {
    if (id !== 'sgg_play') return null;
    const t = S.tasksOf(th, 'song')[0];
    th.vars.played = pid;
    th.vars.joy++;
    if (t) {
      S.complete(t, R.pl(pid));
      if (t.status === 'won') S.turnIn(t, pid);
    }
    return { lines: ['You have? Oh, they\'ll weep. Thank you. Thank you!'] };
  },
});

// ------------------------------------------------------------ a letter come late
motif({
  id: 'late_letter',
  family: 'kin',
  max: 2,
  key: (o) => `letter:${o.sid}:${o.vars.seed}`,
  title: (th) => `A Letter for ${th.vars.to}`,
  scan(S, rng) {
    if (!rng.chance(0.04)) return null;
    for (const L of rng.shuffle(laidTowns(S)).slice(0, 3)) {
      const dead = L.npcs.filter((r) => !alive(r) && r.age !== 'child');
      if (!dead.length) continue;
      const d = rng.pick(dead);
      const kin = adults(L).find((r) => r.name.last === d.name.last);
      const far = laidTowns(S).filter((T) => T !== L);
      if (!kin || !far.length) continue;
      const T = rng.pick(far);
      return { cast: { kin: R.rec(L.settlement.id, kin.idx), town: R.town(L.settlement.id) }, sid: L.settlement.id, vars: { to: fullName(d), from: T.settlement.id, seed: rng.int(0, 1e6) } };
    }
    return null;
  },
  nodes: {
    arrived: {
      enter(th, S) {
        const rng = S.rng(th, 0x1e7);
        const T = layoutOf(S, th.vars.from);
        if (!T) return S.end(th, 'faded');
        th.vars.writer = S.choose(th, [{ to: 'sibling', w: 1 }, { to: 'love', w: 0.8 }, { to: 'child', w: 0.5 }, { to: 'debtor', w: 0.4 }], rng).to;
        const w = adults(T).find((r) => r.age === 'elder') || adults(T)[0];
        if (!w) return S.end(th, 'faded');
        th.cast.writer = R.rec(T.settlement.id, w.idx);
        th.names.writer = fullName(w);
        const what = { sibling: `from a brother or sister nobody here knew ${th.vars.to} had`, love: 'from someone who loved them, once, and never stopped', child: `from a grown child ${th.vars.to} never spoke of`, debtor: 'from someone returning a debt, forty years late, with interest' }[th.vars.writer];
        S.note(th, `A letter came to ${townName(S, th.sid)}, addressed to ${th.vars.to}, who's been dead for years. It's ${what}: ${th.names.writer}, of ${T.settlement.name}.`, { news: [th.sid] });
        const t = S.post(th, {
          role: 'reply', kind: 'deliver', title: `Carry ${th.names.kin}'s reply to ${th.names.writer} in ${T.settlement.name}`, sid: th.sid, giver: th.cast.kin, target: th.cast.writer,
          pitch: say(rng, ['Somebody has to tell them. I\'ve written it. I can\'t take it myself: it\'s two days on the road, and my knees.', 'They don\'t know. All these years, writing to a grave. Would you take my letter to them? Gently.'], {}),
          reward: { coins: 12, rep: 15, fame: 1 },
        });
        t.offerLabel = 'You look like you\'ve had news.';
        t.item = S.writeNote(th, 'letter', `To ${th.names.writer}`, [`I'm sorry to be the one to tell you: ${th.vars.to} died some years ago. Your letter came to me instead. ${pick(rng, ['They spoke of you, at the end. I didn\'t know who they meant until now.', 'Come and see where they\'re buried, if you like. You\'d be welcome at my table.', 'I don\'t know what was between you. But I\'d like to.'])} - ${th.names.kin}`]);
        t.n = 1;
        th.vars.letter = t.item;
        if (th.vars.writer === 'debtor') {
          const k = recOf(S, th.cast.kin);
          if (k) k.coins = (k.coins || 0) + 40;
          S.note(th, `There was ¤40 in the letter, folded small.`);
        }
      },
      day(th, S) {
        if ((S.now - th.nodeAt) / DAY > 12) S.end(th, 'unanswered', `Nobody carried ${th.names.kin}'s reply. ${th.names.writer} is still writing to ${th.vars.to}, somewhere.`);
      },
      fade: 14,
    },
  },
  tasks: {
    reply: {
      accepted(th, t, who, S) {
        if (who.t === 'pl' && th.vars.letter) S.give(who.pid, th.vars.letter, 1);
      },
      done(th, t, by, S) {
        const rng = S.rng(th, 0x1e8);
        const w = recOf(S, th.cast.writer);
        const kin = recOf(S, th.cast.kin);
        // A visit, or a reply, or only tears.
        const how = S.choose(th, [{ to: 'visit', w: 1 + (w ? nat(w, 'sociability') : 0) }, { to: 'reply', w: 0.8 }, { to: 'grief', w: 0.6 }, { to: 'secret', w: th.vars.writer === 'child' ? 1 : 0.2 }], rng).to;
        if (how === 'visit' && kin && w) {
          S.end(th, 'met', `${th.names.writer} came all the way from ${townName(S, th.vars.from)} to stand at ${th.vars.to}'s grave, and stayed a week with ${th.names.kin}. They write to each other every month now.`, { news: [th.sid] });
        } else if (how === 'secret') {
          S.end(th, 'secret out', `${th.names.writer}'s letter told ${th.names.kin} something nobody in ${townName(S, th.sid)} knew: ${th.vars.to} had another family, once. ${pick(rng, ['Half the town is scandalised. The other half saw it coming.', `${th.names.kin} hasn't decided how they feel about it.`])}`, { news: [th.sid] });
        } else if (how === 'reply') {
          S.end(th, 'answered', `${th.names.writer} wrote back: four pages, about a summer fifty years ago. ${th.names.kin} reads it again most evenings.`);
        } else S.end(th, 'grief', `${th.names.writer} read the letter at the door, and closed the door, and didn't come out for three days.`);
        void by;
      },
      thanks: () => ['From... oh. Oh. I didn\'t know. Thank you for bringing it. Thank you.'],
    },
  },
});

// ------------------------------------------------------------ an inheritance
motif({
  id: 'inheritance',
  family: 'kin',
  max: 2,
  key: (o) => `will:${o.cast.dead.sid}:${o.cast.dead.idx}`,
  title: (th) => `${th.names.dead}'s Will`,
  seeds: [{
    on: 'npc_died',
    make: (ev, S) => {
      const L = layoutOf(S, ev.who && ev.who.sid);
      const d = L && L.npcs[ev.who.idx];
      if (!d || (d.coins || 0) < 60 || d.age === 'child' || rngFor(S, ev.who.sid, d.idx, 0x111).chance(0.4)) return null;
      const heirs = adults(L).filter((r) => (d.children || []).includes(r.idx) || (r.name.last === d.name.last && r.idx !== d.idx));
      if (heirs.length < 1) return null;
      return { cast: { dead: ev.who, town: R.town(L.settlement.id) }, sid: L.settlement.id, vars: { fortune: Math.round(d.coins), heirs: heirs.slice(0, 3).map((r) => r.idx) } };
    },
  }],
  nodes: {
    reading: {
      enter(th, S) {
        const L = layoutOf(S, th.sid);
        const d = recOf(S, th.cast.dead);
        if (!L || !d) return S.end(th, 'faded');
        const rng = S.rng(th, 0x111);
        // What the will says, if there is one.
        th.vars.will = S.choose(th, [
          { to: 'fair', w: 1 },
          { to: 'one', w: 0.8 },
          { to: 'stranger', w: 0.5 },
          { to: 'cat', w: 0.3 },
          { to: 'town', w: nat(d, 'kindness') },
          { to: 'missing', w: 0.8 },
        ], rng).to;
        const heirs = th.vars.heirs.map((i) => L.npcs[i]).filter((r) => r && alive(r));
        const names = heirs.map((r) => fullName(r));
        th.vars.names = names;
        const f = th.vars.fortune;
        if (th.vars.will === 'missing') {
          S.note(th, `${th.names.dead} died leaving ¤${f}, and no will that anyone can find. ${names.join(', ')} ${names.length > 1 ? 'are already arguing' : 'is already counting'}.`, { news: [th.sid] });
          // (It's somewhere in the house.)
          const h = d.home !== null && d.home !== undefined ? L.buildings[d.home] : null;
          const at = h && h.inside ? { x: h.inside.x, z: h.inside.z } : townMid(L.settlement);
          th.vars.at = at;
          const m = mayorOf(L);
          const t = S.post(th, {
            role: 'find', kind: 'find', title: `Find ${th.names.dead}'s will, before the heirs come to blows`, sid: th.sid, giver: m ? R.rec(th.sid, m.idx) : null, at, r: 2,
            pitch: `There's a will. ${first(d)} told me so. It's in that house somewhere, and if it isn't found soon there'll be blood over that money.`,
            reward: { coins: 15, from: R.town(th.sid), rep: 10, fame: 0.5 },
          });
          t.offerLabel = 'What\'s all the shouting at the old house?';
          return;
        }
        reveal(th, S, L, heirs, rng, null);
      },
      day(th, S, rng) {
        if (th.vars.will !== 'missing') return;
        const L = layoutOf(S, th.sid);
        if (!L) return S.end(th, 'faded');
        if ((S.now - th.nodeAt) / DAY > 5) {
          // (Never found: they fight over it.)
          const heirs = th.vars.heirs.map((i) => L.npcs[i]).filter((r) => r && alive(r));
          const [a, b] = heirs;
          if (a && b) {
            a.coins = (a.coins || 0) + Math.floor(th.vars.fortune / 2);
            b.coins = (b.coins || 0) + Math.floor(th.vars.fortune / 2);
            if (rng.chance(0.5) && a.name.last !== b.name.last) S.split(th, 'feud', { cast: { a: R.rec(th.sid, a.idx), b: R.rec(th.sid, b.idx), town: R.town(th.sid) }, sid: th.sid, vars: { why: `${th.names.dead}'s money`, fa: a.name.last, fb: b.name.last, step: 1 } });
            return S.end(th, 'squabbled', `${th.names.dead}'s will was never found. ${fullName(a)} and ${fullName(b)} split the money down the middle, and haven't spoken since.`, { news: [th.sid] });
          }
          if (a) a.coins = (a.coins || 0) + th.vars.fortune;
          return S.end(th, 'settled', `${th.names.dead}'s money went to ${a ? fullName(a) : 'the town'}, will or no will.`);
        }
      },
      fade: 8,
    },
  },
  tasks: {
    find: {
      reach(th, t, pid, S) {
        const L = layoutOf(S, th.sid);
        const rng = S.rng(th, 0x112);
        S.complete(t, R.pl(pid));
        th.vars.will = pick(rng, ['fair', 'one', 'stranger', 'town', 'cat', 'you']);
        S.tell(pid, `Behind a loose brick by the hearth: a folded paper, sealed, "MY WILL" on the front in a shaky hand.`, '#ffe070');
        reveal(th, S, L, th.vars.heirs.map((i) => L.npcs[i]).filter((r) => r && alive(r)), rng, pid);
      },
    },
  },
});

function reveal(th, S, L, heirs, rng, pid) {
  const f = th.vars.fortune;
  const w = th.vars.will;
  const names = heirs.map((r) => fullName(r));
  if (w === 'fair' || !heirs.length) {
    for (const r of heirs) r.coins = (r.coins || 0) + Math.floor(f / Math.max(1, heirs.length));
    return S.end(th, 'fair', `${th.names.dead}'s will left ¤${f} shared fairly among ${names.join(', ') || 'the family'}. Nobody's happy, which is how you know it was fair.`, { news: [th.sid] });
  }
  if (w === 'one') {
    const h = pick(rng, heirs);
    h.coins = (h.coins || 0) + f;
    const rest = heirs.filter((r) => r !== h);
    const r2 = rest[0];
    if (r2 && h.name.last !== r2.name.last && rng.chance(0.5)) S.split(th, 'feud', { cast: { a: R.rec(th.sid, r2.idx), b: R.rec(th.sid, h.idx), town: R.town(th.sid) }, sid: th.sid, vars: { why: 'the will', fa: r2.name.last, fb: h.name.last, step: 1 } });
    return S.end(th, 'one heir', `${th.names.dead}'s will left everything, ¤${f}, to ${fullName(h)}. ${rest.length ? `${rest.map((r) => r.name.first).join(' and ')} got a pair of old boots${rest.length > 1 ? ' between them' : ''}.` : ''}`, { news: [th.sid] });
  }
  if (w === 'stranger') {
    const s = someone(L, rng, (r) => !heirs.includes(r));
    if (s) s.coins = (s.coins || 0) + f;
    return S.end(th, 'stranger', `${th.names.dead}'s will left everything to ${s ? fullName(s) : 'a name nobody knew'}${s ? ', who swears they barely knew them' : ''}. The family are beside themselves. ${pick(rng, ['There\'s talk of a secret.', 'There\'s talk of a lawyer.', 'There\'s talk, full stop.'])}`, { news: [th.sid] });
  }
  if (w === 'town') {
    L.econ.treasury += f;
    return S.end(th, 'to the town', `${th.names.dead}'s will left ¤${f} to ${L.settlement.name}: "for a new roof on the school, and a feast." The family smiled very thinly.`, { news: [th.sid] });
  }
  if (w === 'you' && pid) {
    S.give(pid, 'coin', Math.round(f / 2));
    return S.end(th, 'to the finder', `${th.names.dead}'s will left half of everything "to whoever is honest enough to find this and read it out." That was ${nameOf(S, R.pl(pid))}. The heirs got the other half, and a lesson.`, { news: [th.sid] });
  }
  return S.end(th, 'to the cat', `${th.names.dead}'s will left everything, ¤${f}, to their cat. ${names.length ? `${names[0]} is now the cat's very attentive keeper.` : 'The cat seems unmoved.'}`, { news: [th.sid] });
}

// ------------------------------------------------------------ a prodigy
const GIFTS = [
  { k: 'music', word: 'music', show: 'played a tune on a borrowed fiddle that made the whole tavern go quiet', subj: null },
  { k: 'numbers', word: 'numbers', show: 'worked out the council\'s accounts in their head, and found the mistake', subj: 'research' },
  { k: 'blade', word: 'the blade', show: 'disarmed a guard in a practice bout, with a stick', subj: 'dueling' },
  { k: 'cook', word: 'the kitchen', show: 'made a soup so good the innkeeper offered them a job on the spot', subj: 'cooking' },
  { k: 'stones', word: 'stones', show: 'cut a river pebble so it shone like a gem', subj: 'gemcraft' },
];

motif({
  id: 'prodigy',
  family: 'kin',
  max: 2,
  key: (o) => `prod:${o.cast.youth.sid}:${o.cast.youth.idx}`,
  title: (th) => `${th.names.youth}'s Gift`,
  scan(S, rng) {
    if (!rng.chance(0.04)) return null;
    for (const L of rng.shuffle(laidTowns(S)).slice(0, 3)) {
      const y = adults(L).filter((r) => single(L, r) && (r.parents || []).some((i) => L.npcs[i] && alive(L.npcs[i])) && !r.academy && !r.prodigy);
      if (!y.length) continue;
      const r = rng.pick(y);
      return { cast: { youth: R.rec(L.settlement.id, r.idx), town: R.town(L.settlement.id) }, sid: L.settlement.id, vars: { gift: rng.pick(GIFTS).k } };
    }
    return null;
  },
  nodes: {
    noticed: {
      enter(th, S) {
        const L = layoutOf(S, th.sid);
        const y = recOf(S, th.cast.youth);
        if (!L || !y) return S.end(th, 'faded');
        const rng = S.rng(th, 0x9d1);
        const g = GIFTS.find((q) => q.k === th.vars.gift);
        y.prodigy = th.id;
        const par = (y.parents || []).map((i) => L.npcs[i]).find((r) => r && alive(r));
        if (par) {
          th.cast.parent = R.rec(th.sid, par.idx);
          th.names.parent = fullName(par);
        }
        th.vars.stance = par ? S.choose(th, [{ to: 'proud', w: nat(par, 'kindness') + 0.2 }, { to: 'against', w: nat(par, 'temper') + (has(par, 'stubborn') ? 0.4 : 0) }, { to: 'afraid', w: 0.4 }], rng).to : 'none';
        S.note(th, `${th.names.youth} ${g.show}. Everyone says they've a gift for ${g.word}.${par ? ` ${th.vars.stance === 'proud' ? `${th.names.parent} is bursting with pride.` : th.vars.stance === 'against' ? `${th.names.parent} says it'll come to nothing and they're needed at home.` : `${th.names.parent} is afraid of losing them to it.`}` : ''}`, { news: [th.sid] });
        th.vars.spark = 0.5;
      },
      day(th, S, rng) {
        const L = layoutOf(S, th.sid);
        const y = recOf(S, th.cast.youth);
        if (!L || !y || !alive(y)) return S.end(th, 'faded');
        const g = GIFTS.find((q) => q.k === th.vars.gift);
        th.vars.spark += rng.float(-0.08, 0.1) + (th.vars.stance === 'proud' ? 0.04 : th.vars.stance === 'against' ? -0.05 : 0) + (th.vars.encouraged ? 0.05 : 0);
        const days = (S.now - th.nodeAt) / DAY;
        if (th.vars.spark >= 0.9 || (days > 6 && th.vars.spark > 0.65)) {
          y.prodigy = null;
          // Off to learn it properly: the Academy, if there's one; else a master's.
          const cities = laidTowns(S).filter((T) => T.settlement.type === 'city' && T.buildings.some((b) => b.type === 'college'));
          if (g.subj && cities.length && !y.academy) {
            const s = L.settlement;
            const city = cities.sort((a, b) => Math.hypot(a.settlement.cx - s.cx, a.settlement.cz - s.cz) - Math.hypot(b.settlement.cx - s.cx, b.settlement.cz - s.cz))[0];
            S.end(th, 'to the academy', `${th.names.youth}'s gift won't be kept at home: they're for the Academy in ${city.settlement.name}.`, { news: [th.sid] });
            return S.split(th, 'student', { cast: { student: th.cast.youth, town: R.town(th.sid), city: R.town(city.settlement.id) }, sid: th.sid, vars: { city: city.settlement.id, love: g.subj } });
          }
          if (g.k === 'music') return S.end(th, 'famous', `${th.names.youth} has gone off with a company of players, to make music in the cities. Folk in ${L.settlement.name} will say they knew them when.`, { news: [th.sid] });
          y.skills ||= {};
          return S.end(th, 'flourished', `${th.names.youth} has made something of their gift for ${g.word}, right here at home. ${pick(rng, ['People come from other towns to see.', 'Their family has stopped arguing about it.'])}`, { news: [th.sid] });
        }
        if (th.vars.spark <= 0.15 || days > 14) {
          y.prodigy = null;
          return S.end(th, 'faded', `${th.names.youth} doesn't talk about ${g.word} any more. ${pick(rng, [`${th.names.parent || 'Their family'} says it was a phase.`, 'Sometimes, late, you can hear them at it, alone.', 'They seem content. Maybe.'])}`);
        }
      },
      fade: 16,
    },
  },
  townTalk(th, npc, pid, S) {
    const out = [];
    if (isRec(npc, th.cast.youth) && !th.vars.encouraged) out.push({ id: 'sgp_go', arg: tid(th), label: 'Don\'t let anyone talk you out of it. You\'ve a gift.' });
    if (isRec(npc, th.cast.parent) && th.vars.stance !== 'proud' && !th.vars.parentAsked) out.push({ id: 'sgp_par', arg: tid(th), label: `Let ${first(recOf(S, th.cast.youth))} follow their gift.` });
    return out;
  },
  respond(th, npc, pid, id, arg, S) {
    const rng = S.rng(th, 0x9d2);
    if (id === 'sgp_go') {
      th.vars.encouraged = pid;
      th.vars.spark += 0.1;
      S.touch(th, pid);
      return { lines: [pick(rng, ['You think so? Really? ...Then I won\'t.', 'Nobody\'s said that to me before. Not like they meant it.'])] };
    }
    if (id === 'sgp_par') {
      th.vars.parentAsked = true;
      S.touch(th, pid);
      if (persuade(S, npc, rng, 0.25, has(npc.rec, 'stubborn') ? 0.25 : 0)) {
        th.vars.stance = 'proud';
        th.vars.spark += 0.15;
        S.note(th, `${nameOf(S, R.pl(pid))} talked ${th.names.parent} round.`, { by: pid });
        return { lines: ['...They do light up, don\'t they, when they\'re at it. All right. All right.'] };
      }
      return { lines: ['And who\'ll do their work here? You?'] };
    }
    return null;
  },
  ended(th, S) {
    const y = recOf(S, th.cast.youth);
    if (y && y.prodigy === th.id) y.prodigy = null;
  },
});

// ------------------------------------------------------------ the sleepwalker
motif({
  id: 'sleepwalker',
  family: 'kin',
  max: 2,
  key: (o) => `sleep:${o.cast.walker.sid}:${o.cast.walker.idx}`,
  title: (th) => `Where Does ${th.names.walker.split(' ')[0]} Go at Night?`,
  scan(S, rng) {
    if (!rng.chance(0.04)) return null;
    for (const L of rng.shuffle(laidTowns(S)).slice(0, 3)) {
      const r = someone(L, rng, (q) => !q.courting && kinOf(L, q).length);
      if (!r) continue;
      const m = townMid(L.settlement);
      const at = spotNear(S, m.x, m.z, 35, 70, rng, { clear: 10 });
      if (!at) continue;
      return { cast: { walker: R.rec(L.settlement.id, r.idx), kin: R.rec(L.settlement.id, kinOf(L, r)[0].idx), town: R.town(L.settlement.id) }, sid: L.settlement.id, spots: [at], vars: { at, place: rng.pick(['the old well past the fields', 'the standing stone on the hill', 'the edge of the woods', 'the ruined mill']) } };
    }
    return null;
  },
  anchors: (th) => [th.vars.at],
  nodes: {
    walking: {
      enter(th, S) {
        const L = layoutOf(S, th.sid);
        const w = recOf(S, th.cast.walker);
        if (!L || !w) return S.end(th, 'faded');
        const rng = S.rng(th, 0x51e);
        th.vars.truth = S.choose(th, [
          { to: 'wisp', w: 0.8 },
          { to: 'lover', w: single(L, w) ? 1 : 0.2 },
          { to: 'grief', w: 0.8 },
          { to: 'wolf', w: has(w, 'kind') ? 0.8 : 0.3 },
          { to: 'drink', w: 0.4 },
        ], rng).to;
        S.note(th, `${th.names.walker} walks out of town every night, eyes open, and remembers nothing in the morning. ${th.names.kin} found them at ${th.vars.place} at dawn, with wet feet.`, { news: [th.sid] });
        const t = S.post(th, {
          role: 'follow', kind: 'meet', title: `Go to ${th.vars.place} by night and see what draws ${first(w)} there`, sid: th.sid, giver: th.cast.kin, at: th.vars.at, r: 4,
          pitch: say(rng, ['Every night. Every night! I lock the door and they\'re gone by morning. I\'m frightened to follow. Would you?', 'The priest says it\'s nothing. The priest doesn\'t have to fetch them home at dawn. Go out there at night. See.'], {}),
          reward: { coins: 12, from: th.cast.kin, rep: 12, fame: 0.5 },
        });
        t.offerLabel = 'You look worn out.';
      },
      day(th, S, rng) {
        if ((S.now - th.nodeAt) / DAY > 10) S.end(th, 'stopped', `${th.names.walker} stopped walking at night, as suddenly as they started. ${pick(rng, ['Nobody ever found out why.', 'They still have the dreams, they say.'])}`);
      },
      fade: 12,
    },
  },
  tasks: {
    follow: {
      reach(th, t, pid, S) {
        const night = S.game.minute >= 1260 || S.game.minute < 270;
        if (!night) {
          if (!(th.vars.dayTold || []).includes(pid)) {
            (th.vars.dayTold ||= []).push(pid);
            S.tell(pid, 'Footprints in the mud, going round in circles. Nothing else, by day. Come back at night.', '#c8c8c8');
          }
          return;
        }
        if (th.vars.seen) return;
        th.vars.seen = pid;
        const L = layoutOf(S, th.sid);
        const rng = S.rng(th, 0x51f);
        const w = recOf(S, th.cast.walker);
        const v = th.vars.truth;
        const at = th.vars.at;
        if (v === 'wisp') {
          S.actor(th, { key: 'wisp', kind: 'beast', role: 'lure', species: 'wisp', hostile: true, at, name: 'the Calling Light', orders: { home: at } });
          S.tell(pid, `${first(w)} is here, standing very still, staring at a light that hangs in the air and sings without sound.`, '#c8a0ff');
          return;
        }
        S.complete(t, R.pl(pid));
        if (v === 'lover' && L && w) {
          const o = someone(L, rng, (q) => single(L, q) && !q.courting && q !== w && q.household !== w.household);
          if (o && !w.courting) {
            S.split(th, 'courtship', { cast: { a: th.cast.walker, b: R.rec(th.sid, o.idx), town: R.town(th.sid) }, sid: th.sid, vars: { met: `at ${th.vars.place}, by moonlight`, ha: 0.8, hb: 0.75 } });
            return S.end(th, 'not asleep', `${nameOf(S, R.pl(pid))} followed ${th.names.walker} to ${th.vars.place}, and found them very much awake, holding hands with ${fullName(o)}. The "sleepwalking" was a cover story. The secret is out now.`, { news: [th.sid] });
          }
        }
        if (v === 'grief') return S.end(th, 'grief', `${nameOf(S, R.pl(pid))} followed ${th.names.walker} to ${th.vars.place}, and found them kneeling where ${pick(rng, ['their mother used to sit', 'they buried their dog as a child', 'a little grave nobody tends'])}, talking quietly. They're sleeping again, now someone knows.`);
        if (v === 'wolf') return S.end(th, 'secret kept', `${nameOf(S, R.pl(pid))} followed ${th.names.walker} to ${th.vars.place}, and found them feeding a lame wolf from their own supper. "Don't tell," they said. "It's nearly healed."`, { hidden: true, by: pid });
        return S.end(th, 'drinking', `${nameOf(S, R.pl(pid))} followed ${th.names.walker} to ${th.vars.place}: not sleepwalking at all, but a still, and a jug, and a great deal of singing.`, { news: [th.sid] });
      },
    },
  },
  actorDown(th, a, by, S) {
    if (a.key !== 'wisp') return;
    const pid = by && by.t === 'pl' ? by.pid : th.vars.seen;
    const t = S.tasksOf(th, 'follow')[0];
    if (t && pid) S.complete(t, R.pl(pid));
    S.end(th, 'freed', `${nameOf(S, R.pl(pid))} struck down the light that called ${th.names.walker} out every night. They sleep through till morning now.`, { news: [th.sid] });
  },
});

// ------------------------------------------------------------ two of a kind
motif({
  id: 'double',
  family: 'kin',
  max: 1,
  key: (o) => `double:${o.cast.local.sid}:${o.cast.local.idx}`,
  title: (th) => `Two of ${th.names.local}`,
  scan(S, rng) {
    if (!rng.chance(0.025)) return null;
    for (const L of rng.shuffle(laidTowns(S)).slice(0, 3)) {
      const r = someone(L, rng, (q) => q.age === 'adult');
      if (!r) continue;
      return { cast: { local: R.rec(L.settlement.id, r.idx), town: R.town(L.settlement.id) }, sid: L.settlement.id };
    }
    return null;
  },
  nodes: {
    arrived: {
      enter(th, S) {
        const L = layoutOf(S, th.sid);
        const r = recOf(S, th.cast.local);
        if (!L || !r) return S.end(th, 'faded');
        const rng = S.rng(th, 0xd0b);
        th.vars.truth = S.choose(th, [{ to: 'twin', w: 1.2 }, { to: 'trickster', w: 0.7 }, { to: 'chance', w: 0.6 }], rng).to;
        const first2 = pick(rng, ['Ash', 'Rowan', 'Jem', 'Sorrel', 'Kit', 'Lark', 'Tam', 'Bryn']);
        th.vars.name = `${first2} ${th.vars.truth === 'twin' ? r.name.last : pick(rng, ['Ferrow', 'Dunmore', 'Kell', 'Ashby'])}`;
        const at = townMid(L.settlement);
        const p = { name: { first: first2, last: th.vars.name.split(' ')[1] }, look: { ...r.look, outfit: rng.pick(['hunter', 'vest', 'rags']) }, personality: { ...r.personality }, traits: [], age: r.age, job: 'traveller', maxHp: 18 };
        th.vars.person = p;
        S.actor(th, { key: 'twin', kind: 'npc', role: 'double', talk: true, at, stay: true, person: p, orders: { home: at, roam: 6, lines: ['Why does everyone keep waving at me?', 'I\'m not who you think I am.', 'Is there someone here who looks like me?'] } });
        S.note(th, `A stranger has come to ${L.settlement.name} with ${th.names.local}'s face: the same nose, the same walk. Half the town has said good morning to the wrong one.`, { news: [th.sid] });
        if (th.vars.truth === 'trickster') {
          // (Running up debts in the other's name.)
          th.vars.debts = 0;
        }
      },
      day(th, S, rng) {
        const L = layoutOf(S, th.sid);
        const r = recOf(S, th.cast.local);
        if (!L || !r) return S.end(th, 'faded');
        const days = (S.now - th.nodeAt) / DAY;
        if (th.vars.truth === 'trickster' && days >= 1 && !th.vars.billed) {
          th.vars.billed = true;
          S.note(th, `${th.names.local} has been handed bills for things they never bought: a horse, a barrel of ale, a hat with a feather. "But you were in here yesterday!"`, { news: [th.sid] });
          r.mood = Math.max(0, (r.mood ?? 0.5) - 0.2);
        }
        if (days > 5) {
          S.dismissActor(th, 'twin');
          if (th.vars.truth === 'twin' && th.vars.met) {
            newcomer(S.sim, L, { name: th.vars.person.name, look: th.vars.person.look, personality: th.vars.person.personality, kin: r, rel: 'sibling', why: 'found family' });
            return S.end(th, 'reunited', `${th.vars.name} and ${th.names.local} are twins, parted as babies. ${th.vars.name} has come to live in ${L.settlement.name}. Nobody can tell them apart, and they don't help.`, { news: [th.sid] });
          }
          if (th.vars.truth === 'trickster') return S.end(th, 'gone', `The stranger with ${th.names.local}'s face left town in the night, with a horse, a barrel of ale and a hat with a feather. ${th.names.local} is still paying for them.`, { news: [th.sid] });
          return S.end(th, 'moved on', `The stranger who looked like ${th.names.local} moved on. Just one of those things, everyone agrees. ${pick(rng, ['Mostly.', 'They still talk about it.'])}`);
        }
      },
      fade: 8,
    },
  },
  hello(th) {
    return th.vars.truth === 'trickster' ? 'Morning! Lovely town. Lovely, trusting town.' : 'Do I look like someone you know? Everyone says I do.';
  },
  talk(th, a, npc, pid) {
    if (a.role !== 'double') return [];
    const out = [{ id: 'sgd3_who', arg: tid(th), label: 'Who are you? You look exactly like someone here.' }];
    if (!th.vars.met) out.push({ id: 'sgd3_meet', arg: tid(th), label: `Come with me. You need to meet ${th.names.local}.` });
    if (th.vars.truth === 'trickster' && th.vars.billed) out.push({ id: 'sgd3_caught', arg: tid(th), label: `You've been running up debts in ${th.names.local}'s name.` });
    void pid;
    return out;
  },
  respond(th, npc, pid, id, arg, S) {
    const rng = S.rng(th, 0xd0c);
    const L = layoutOf(S, th.sid);
    if (id === 'sgd3_who') {
      return { lines: [th.vars.truth === 'twin' ? 'I was a foundling, left at a temple door. Raised in the south. I came looking for... I don\'t know what. And everyone calls me by someone else\'s name.' : th.vars.truth === 'trickster' ? 'Who am I? Who are any of us, really? (They smile a little too widely.)' : 'Just passing through! Is it the nose? It\'s always the nose.'] };
    }
    if (id === 'sgd3_meet') {
      th.vars.met = pid;
      S.touch(th, pid);
      if (th.vars.truth === 'twin') {
        S.note(th, `${nameOf(S, R.pl(pid))} brought the stranger to meet ${th.names.local}. They looked at each other a long time. Then ${th.names.local} said, "Mother always said there were two of us."`, { news: [th.sid] });
        return { lines: ['(You bring them face to face. Neither speaks. Then both laugh at once, the same laugh.)'], close: true };
      }
      if (th.vars.truth === 'trickster') {
        th.vars.met = null;
        S.dismissActor(th, 'twin');
        S.end(th, 'fled', `When ${nameOf(S, R.pl(pid))} tried to bring the stranger to meet ${th.names.local}, they slipped away into the crowd and were gone.`, { news: [th.sid] });
        return { lines: ['Meet them? ...Love to. Just let me... fetch my hat.', '(They don\'t come back.)'], close: true };
      }
      S.note(th, `${nameOf(S, R.pl(pid))} brought the stranger to meet ${th.names.local}. They look nothing alike up close. "It's the nose," everyone agrees.`);
      return { lines: ['(Face to face, they really don\'t look much alike. It\'s the nose.)'] };
    }
    if (id === 'sgd3_caught') {
      S.touch(th, pid);
      S.dismissActor(th, 'twin');
      const r = recOf(S, th.cast.local);
      if (r && L) repWith(S, L, r, 15);
      S.person(pid).fame += 1;
      S.end(th, 'caught', `${nameOf(S, R.pl(pid))} caught the stranger who'd been running up debts in ${th.names.local}'s name. The watch made them pay it all back, and then some.`, { news: [th.sid] });
      return { lines: [pick(rng, ['...Fair cop. It was a good run, though.', 'Prove it! ...No? Oh, all right.'])], close: true };
    }
    return null;
  },
});

