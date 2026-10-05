// A town's own troubles (round 54).
//
//   - The moneylender: a family that owes more than it has, and a lender
//     come to collect: the house, the farm, the cow. Pay it, lean on the
//     lender, find who else they've cheated, or watch the family go.
//   - The silver mine: a smooth stranger selling shares in a mine (or a
//     canal, or a road). Half the town buys in. Go and look at the mine.
//   - An election: two who'd lead the town, each promising something. Speak
//     for one, or the other, or stay out of it; the town decides.
//   - Down tools: the town's workers won't work, over pay or danger. Talk
//     both sides round, pay the difference, or break it.
//   - The ratcatcher: rats in the granary, and a stranger with a pipe who'll
//     clear them, for a price. Pay him what was promised.
//   - A witch hunt: things going wrong, and the town needs someone to
//     blame. The old herbalist, the stranger, the odd one. Stand in the way
//     of it, or don't.
//   - A duel of honour: two hotheads, an insult, and dawn. A second wanted.
//   - The gambler: someone losing the family's savings at dice to a sharp.
//     Win it back, catch the cheat, or talk them out of the next throw.
//   - The tonic: a travelling doctor's miracle cure. It might even work.
import { motif, R, nameOf } from '../core.js';
import { pick, say, layoutOf, laidTowns, townName, townMid, living, adults, fullName, kinOf, recOf, purse, has, nat, spotNear, persuade, repWith, isRec, someone } from './lib.js';
import { makePerson } from '../actors.js';
import { mayorOf, alive, DAY } from '../../econ.js';
import { relocate } from '../../civic.js';
import { retrain } from '../../../entities/npcgen.js';
import { removeItem } from '../../../game/inventory.js';
import { RNG, hash4 } from '../../../util/rng.js';

const tid = (th) => `t${th.id}`;
const first = (r) => (r ? r.name.first : 'them');
const pay = (S, pid, n) => S.asPid(pid, (p) => removeItem(p.inv, 'coin', n));

// ------------------------------------------------------------ the moneylender
motif({
  id: 'moneylender',
  family: 'troubles',
  max: 2,
  key: (o) => `debt:${o.cast.debtor.sid}:${o.cast.debtor.idx}`,
  title: (th) => `${th.names.debtor}'s Debt`,
  scan(S, rng) {
    if (!rng.chance(0.05)) return null;
    for (const L of rng.shuffle(laidTowns(S)).slice(0, 3)) {
      const poor = adults(L).filter((r) => (r.coins || 0) < 15 && r.home !== null && r.home !== undefined && r.job !== 'mayor');
      if (!poor.length) continue;
      const d = rng.pick(poor);
      const lender = adults(L).find((r) => r !== d && (has(r, 'stingy') || has(r, 'shrewd')) && (r.coins || 0) > 30);
      return { cast: { debtor: R.rec(L.settlement.id, d.idx), lender: lender ? R.rec(L.settlement.id, lender.idx) : null, town: R.town(L.settlement.id) }, sid: L.settlement.id, vars: { sum: 40 + rng.int(0, 60), what: rng.pick(['the house', 'the farm', 'the cow and the cart', 'the workshop']) } };
    }
    return null;
  },
  nodes: {
    owing: {
      enter(th, S) {
        const L = layoutOf(S, th.sid);
        const d = recOf(S, th.cast.debtor);
        if (!L || !d) return S.end(th, 'faded');
        const rng = S.rng(th, 0xde6);
        if (!th.cast.lender) {
          const p = makePerson(rng, L.settlement.style || 'vale', 'merchant');
          th.vars.lenderName = `${p.name.first} ${p.name.last}`;
          th.vars.person = p;
          const at = townMid(L.settlement);
          S.actor(th, { key: 'lender', kind: 'npc', role: 'lender', talk: true, at, stay: true, person: { ...p, title: 'Moneylender' }, orders: { home: at, roam: 3, lines: ['A debt is a promise.', 'Pay up, or pack up.', '*counts coins*'] } });
        } else th.vars.lenderName = th.names.lender;
        th.vars.due = S.day + rng.int(4, 6);
        th.vars.crooked = rng.chance(0.55);
        th.vars.paid = 0;
        S.note(th, `${th.names.debtor} owes ${th.vars.lenderName} ¤${th.vars.sum}, and can't pay. By day ${th.vars.due + 1}, ${th.vars.lenderName} takes ${th.vars.what}.`, { news: [th.sid] });
        const t = S.post(th, {
          role: 'save', kind: 'talk', title: `Save ${th.names.debtor} from losing ${th.vars.what}`, sid: th.sid, giver: th.cast.debtor,
          pitch: say(rng, ['¤{n}. I borrowed twenty, two winters ago, when the little one was sick. Twenty! Now it\'s {n}, and {l} wants {w}.', 'I don\'t know how it got so big. Every month it grows. If {l} takes {w}, we\'ve nowhere.'], { n: th.vars.sum, l: th.vars.lenderName, w: th.vars.what }),
          reward: { coins: 0, rep: 20, renown: th.sid, renownPts: 3, renownWhy: `saving ${first(d)}'s home`, fame: 1 },
        });
        t.offerLabel = pick(rng, ['You look like you haven\'t slept in a week.', 'Is someone bothering you?']);
      },
      day(th, S, rng) {
        const L = layoutOf(S, th.sid);
        const d = recOf(S, th.cast.debtor);
        if (!L || !d || !alive(d)) return S.end(th, 'faded');
        if (S.day < th.vars.due) return;
        // The day: what happens if nobody's paid.
        const how = S.choose(th, [
          { to: 'lost', w: 1 },
          { to: 'neighbours', w: living(L).filter((r) => nat(r, 'kindness') > 0.65).length * 0.15 },
          { to: 'mob', w: th.vars.crooked ? 0.5 : 0.1 },
        ], rng).to;
        S.dismissActor(th, 'lender');
        if (how === 'neighbours') return S.end(th, 'saved', `The neighbours passed a hat for ${th.names.debtor}, and paid ${th.vars.lenderName} off to the last coin. ${pick(rng, ['Then they threw the lender out of the tavern.', 'Nobody will borrow from them again.'])}`, { news: [th.sid] });
        if (how === 'mob') return S.end(th, 'run out', `When ${th.vars.lenderName} came for ${th.vars.what}, half the town was waiting. ${th.vars.lenderName} left without it, and without their hat.`, { news: [th.sid] });
        d.mood = Math.max(0, (d.mood ?? 0.5) - 0.4);
        // (Gone: to another town, with what they can carry.)
        const others = laidTowns(S).filter((T) => T !== L && !T.settlement.deserted);
        if (others.length && rng.chance(0.6)) {
          const T = rng.pick(others);
          relocate(S.sim, L, [d], T, `after losing ${th.vars.what}`);
          return S.end(th, 'lost', `${th.vars.lenderName} took ${th.vars.what}. ${th.names.debtor} has gone to ${T.settlement.name}, with what they could carry.`, { news: [th.sid] });
        }
        S.end(th, 'lost', `${th.vars.lenderName} took ${th.vars.what}. ${th.names.debtor} is starting again, with nothing.`, { news: [th.sid] });
      },
      fade: 10,
    },
  },
  tasks: { save: {} },
  hello(th, a, npc) {
    return pick(npc.rng, ['Business?', 'If you\'re here about the debt, the answer\'s no.', 'Everyone owes someone.']);
  },
  talk(th, a, npc, pid, S) {
    if (a.role !== 'lender') return [];
    return lenderTalk(th, pid, S);
  },
  townTalk(th, npc, pid, S) {
    const out = [];
    if (th.cast.lender && isRec(npc, th.cast.lender)) out.push(...lenderTalk(th, pid, S));
    // Others who've borrowed from the same lender (and been cheated).
    if (th.vars.crooked && !th.vars.ledgerFound && npc.rec && npc.rec.sid === th.sid && !isRec(npc, th.cast.debtor) && !isRec(npc, th.cast.lender) && (npc.id + th.id) % 4 === 0) out.push({ id: 'sgl2_ask', arg: tid(th), label: `Ever borrowed from ${th.vars.lenderName}?` });
    return out;
  },
  respond(th, npc, pid, id, arg, S) {
    const rng = S.rng(th, 0xde7);
    const t = S.tasksOf(th, 'save')[0];
    const left = th.vars.sum - th.vars.paid;
    switch (id) {
      case 'sgl2_pay': {
        if (purse(S, pid) < left) return { lines: [`¤${left}. All of it.`] };
        pay(S, pid, left);
        if (t) S.complete(t, R.pl(pid));
        S.dismissActor(th, 'lender');
        S.end(th, 'paid', `${nameOf(S, R.pl(pid))} paid ${th.names.debtor}'s debt to ${th.vars.lenderName}: ¤${left}.`, { news: [th.sid] });
        return { lines: ['A pleasure doing business. Tell them they\'re free and clear.'], close: true };
      }
      case 'sgl2_lean': {
        S.touch(th, pid);
        const brave = th.cast.lender ? nat(recOf(S, th.cast.lender), 'bravery') : 0.5;
        if (persuade(S, npc, rng, 0.2, brave * 0.4)) {
          th.vars.sum = Math.round(th.vars.sum * 0.5);
          return { lines: [pick(rng, ['...Fine. Half. HALF. And I never saw you.', 'You drive a hard bargain. Half, then. Out of the kindness of my heart.']), `(Now owed: ¤${th.vars.sum}.)`] };
        }
        S.townSay(pid, th.sid, -2, false);
        return { lines: ['Are you threatening me? The watch will want to hear about this.'] };
      }
      case 'sgl2_ask': {
        th.vars.asked = (th.vars.asked || 0) + 1;
        S.touch(th, pid);
        if (th.vars.asked >= 2) {
          th.vars.ledgerFound = true;
          return { lines: [`I did. Twenty, I borrowed. They said I owed sixty a year later. I saw their book: they write the numbers in twice. Ask them about the second column.`, '(You could put that to the lender.)'] };
        }
        return { lines: [pick(rng, ['Once. Never again. Their sums don\'t add up, and I\'m no scholar.', 'Everyone has. Everyone\'s sorry.'])] };
      }
      case 'sgl2_expose': {
        if (t) S.complete(t, R.pl(pid));
        S.dismissActor(th, 'lender');
        S.person(pid).fame += 1;
        S.end(th, 'exposed', `${nameOf(S, R.pl(pid))} showed the town ${th.vars.lenderName}'s crooked sums. ${th.names.debtor}'s debt was struck out, and half the town's with it.`, { news: [th.sid] });
        return { lines: ['...Where did you hear about the second column? ...Fine. FINE. The debt\'s void. Now get out of my way.'], close: true };
      }
      default:
        return null;
    }
  },
});

function lenderTalk(th, pid, S) {
  const out = [{ id: 'sgl2_pay', arg: tid(th), label: `I'll pay ${th.names.debtor}'s debt. (¤${th.vars.sum - th.vars.paid})` }, { id: 'sgl2_lean', arg: tid(th), label: 'Take half, and leave them be. Or else.' }];
  if (th.vars.ledgerFound) out.push({ id: 'sgl2_expose', arg: tid(th), label: 'I know about your second column. Every debt you\'ve doubled.' });
  void S;
  void pid;
  return out;
}

// ------------------------------------------------------------ the silver mine
motif({
  id: 'silver_mine',
  family: 'troubles',
  max: 1,
  key: (o) => `mine:${o.sid}`,
  title: (th) => `Shares in ${th.vars.scheme}`,
  scan(S, rng) {
    if (!rng.chance(0.03)) return null;
    for (const L of rng.shuffle(laidTowns(S)).slice(0, 3)) {
      const m = townMid(L.settlement);
      const at = spotNear(S, m.x, m.z, 70, 130, rng, { clear: 12 });
      if (!at) continue;
      return { cast: { town: R.town(L.settlement.id) }, sid: L.settlement.id, spots: [at], vars: { at, scheme: rng.pick(['the Glimmerdeep Silver Mine', 'the Great Canal Company', 'the Sunrise Road', 'the Bottomless Well of Saint Ada']) } };
    }
    return null;
  },
  anchors: (th) => [th.vars.at],
  nodes: {
    selling: {
      enter(th, S) {
        const L = layoutOf(S, th.sid);
        if (!L) return S.end(th, 'faded');
        const rng = S.rng(th, 0x31e);
        const p = makePerson(rng, 'vale', 'merchant');
        th.vars.who = `${p.name.first} ${p.name.last}`;
        th.vars.real = rng.chance(0.15);
        th.vars.raised = 0;
        th.vars.investors = {};
        const at = townMid(L.settlement);
        S.actor(th, { key: 'seller', kind: 'npc', role: 'seller', talk: true, at, stay: true, person: { ...p, title: 'Company Agent' }, orders: { home: at, roam: 3, mark: 'talk', lines: ['Shares! Shares in a sure thing!', 'Double your money by midsummer!', 'Only a few left, friends!'] } });
        S.note(th, `${th.vars.who}, of ${th.vars.scheme}, is selling shares in ${L.settlement.name}'s square: "Double your money by midsummer!"`, { news: [th.sid] });
      },
      day(th, S, rng) {
        const L = layoutOf(S, th.sid);
        if (!L) return S.end(th, 'faded');
        // Townsfolk buy in: the greedy and the trusting.
        for (const r of adults(L)) {
          if ((r.coins || 0) > 20 && rng.chance(has(r, 'shrewd') ? 0.02 : 0.08 + (1 - nat(r, 'diligence')) * 0.04)) {
            const n = Math.round(r.coins * 0.3);
            r.coins -= n;
            th.vars.raised += n;
          }
        }
        if ((S.now - th.nodeAt) / DAY > 5) {
          S.dismissActor(th, 'seller');
          payBack(th, S, th.vars.real ? 2 : 0);
          if (th.vars.real) return S.end(th, 'real', `${th.vars.scheme} was real after all: the shares paid out double. The sceptics are very quiet.`, { news: [th.sid] });
          return S.end(th, 'swindled', `${th.vars.who} left ${L.settlement.name} in the night with ¤${th.vars.raised} of the town's money. There is no ${th.vars.scheme}. There never was.`, { news: [th.sid] });
        }
      },
      fade: 8,
    },
  },
  tasks: {
    look: {
      reach(th, t, pid, S) {
        S.complete(t, R.pl(pid));
        th.vars.seen = pid;
        S.tell(pid, th.vars.real ? `There IS a mine: a fresh shaft, timbered, and a seam of silver in the lamplight. Well, well.` : `Where the map says ${th.vars.scheme} should be: a field, two sheep, and a sign with nothing behind it.`, '#ffe070');
      },
    },
  },
  hello(th, a, npc) {
    return pick(npc.rng, ['A shrewd face! You look like someone who knows a sure thing.', 'Friend! Have I got an opportunity for you.']);
  },
  talk(th, a, npc, pid, S) {
    if (a.role !== 'seller') return [];
    const out = [{ id: 'sgm2_buy', arg: tid(th), label: 'I\'ll buy a share. (¤20)' }, { id: 'sgm2_where', arg: tid(th), label: `Where is ${th.vars.scheme}, exactly?` }];
    if (th.vars.seen === pid && !th.vars.real) out.push({ id: 'sgm2_expose', arg: tid(th), label: 'I\'ve been to your mine. It\'s a field.' });
    void S;
    return out;
  },
  respond(th, npc, pid, id, arg, S) {
    const rng = S.rng(th, 0x31f);
    if (id === 'sgm2_buy') {
      if (purse(S, pid) < 20) return { lines: ['Twenty, friend. Come back when you\'re flush.'] };
      pay(S, pid, 20);
      th.vars.investors[pid] = (th.vars.investors[pid] || 0) + 20;
      th.vars.raised += 20;
      S.touch(th, pid);
      return { lines: ['Splendid! A share in the future. You won\'t regret it.'] };
    }
    if (id === 'sgm2_where') {
      if (!S.tasksOf(th, 'look').length) {
        const t = S.post(th, {
          role: 'look', kind: 'find', title: `Go and look at ${th.vars.scheme}`, sid: th.sid, giver: null, only: [pid], npc: false, at: th.vars.at, r: 5,
          pitch: 'The agent waved vaguely at the hills. You got a rough idea of where.', reward: { coins: 0, fame: 0.5 },
        });
        S.accept(t, R.pl(pid));
        S.game.world.ow.pin(th.vars.at.x, th.vars.at.z, th.vars.scheme, '?');
      }
      return { lines: [pick(rng, ['Out in the hills, a morning\'s walk. Not that you need to go! The papers are all here.', 'Just over yonder. Beautiful spot. No need to trouble yourself.']), '(Marked on your map.)'] };
    }
    if (id === 'sgm2_expose') {
      S.dismissActor(th, 'seller');
      payBack(th, S, 1);
      S.person(pid).fame += 1.5;
      S.end(th, 'exposed', `${nameOf(S, R.pl(pid))} went to see ${th.vars.scheme} for themselves, and found a field and two sheep. ${th.vars.who} was made to hand back every coin before leaving town, at a run.`, { news: [th.sid] });
      return { lines: ['...A field? There must be some mistake. ...Fine. FINE. Here. Take it. Take all of it.'], close: true };
    }
    return null;
  },
});

// (What they put in: back, doubled, or gone.)
function payBack(th, S, mult) {
  const L = layoutOf(S, th.sid);
  if (mult > 0 && L) {
    const back = Math.round(th.vars.raised * mult * 0.8);
    L.econ.treasury += Math.round(back * 0.2);
  }
  for (const [pid, n] of Object.entries(th.vars.investors || {})) {
    if (mult <= 0) {
      S.tell(pid, `Your share in ${th.vars.scheme}: worthless.`, '#ff9080');
      continue;
    }
    S.give(pid, 'coin', Math.round(n * mult));
    S.tell(pid, `Your share in ${th.vars.scheme} pays out: ¤${Math.round(n * mult)}.`, '#ffe070');
  }
}

// ------------------------------------------------------------ an election
const PLATFORMS = [
  { k: 'tax', say: 'lower taxes', did: 'taxes are down' },
  { k: 'walls', say: 'a stronger watch', did: 'there\'s a new watch-house' },
  { k: 'feast', say: 'a feast every season', did: 'there\'s a feast to look forward to' },
  { k: 'roads', say: 'mended roads', did: 'the roads are being mended' },
  { k: 'school', say: 'a school for every child', did: 'the children are at their letters' },
];

motif({
  id: 'election',
  family: 'troubles',
  max: 2,
  key: (o) => `elect:${o.sid}`,
  title: (th, S) => `Who Will Lead ${townName(S, th.sid)}?`,
  scan(S, rng) {
    if (!rng.chance(0.03)) return null;
    for (const L of rng.shuffle(laidTowns(S).filter((q) => q.settlement.type !== 'village')).slice(0, 3)) {
      const m = mayorOf(L);
      const rivals = adults(L).filter((r) => r !== m && r.job !== 'guard' && (has(r, 'proud') || has(r, 'outgoing') || nat(r, 'sociability') > 0.7));
      if (!m || !rivals.length) continue;
      const c = rng.pick(rivals);
      const [p1, p2] = rng.shuffle(PLATFORMS.slice());
      return { cast: { a: R.rec(L.settlement.id, m.idx), b: R.rec(L.settlement.id, c.idx), town: R.town(L.settlement.id) }, sid: L.settlement.id, vars: { pa: p1.k, pb: p2.k } };
    }
    return null;
  },
  nodes: {
    campaign: {
      enter(th, S) {
        const L = layoutOf(S, th.sid);
        if (!L) return S.end(th, 'faded');
        const rng = S.rng(th, 0xe1e);
        const pa = PLATFORMS.find((q) => q.k === th.vars.pa);
        const pb = PLATFORMS.find((q) => q.k === th.vars.pb);
        th.vars.day = S.day + rng.int(4, 6);
        th.vars.lean = 0;
        th.vars.dirty = null;
        S.note(th, `${th.names.b} is standing against ${th.names.a} to lead ${L.settlement.name}. ${th.names.a} promises ${pa.say}; ${th.names.b} promises ${pb.say}. The town decides on day ${th.vars.day + 1}.`, { news: [th.sid] });
        // (A dirty trick, now and then: one side or the other.)
        if (rng.chance(0.35)) th.vars.dirty = rng.pick(['a', 'b']);
      },
      day(th, S, rng) {
        const L = layoutOf(S, th.sid);
        const a = recOf(S, th.cast.a);
        const b = recOf(S, th.cast.b);
        if (!L || !a || !b || !alive(a) || !alive(b)) return S.end(th, 'faded');
        if (th.vars.dirty && !th.vars.dirtyDone && S.day >= th.vars.day - 2) {
          th.vars.dirtyDone = true;
          const w = th.vars.dirty;
          const o = w === 'a' ? 'b' : 'a';
          S.note(th, `Someone's been saying ${th.names[o]} ${pick(rng, ['drinks', 'cheats at dice', 'beat their dog', 'owes money all over town'])}. ${th.names[o]} says it's a lie, and that they know who started it.`, { news: [th.sid] });
          th.vars.lean += o === 'a' ? -0.15 : 0.15;
        }
        if (S.day < th.vars.day) return;
        // The vote: who they like, what they want, and what they were told.
        let va = 0;
        let vb = 0;
        for (const r of adults(L)) {
          let x = rng.float(-0.5, 0.5) + th.vars.lean;
          if (th.vars.pa === 'tax' || th.vars.pb === 'tax') x += (r.coins || 0) < 20 ? (th.vars.pa === 'tax' ? -0.2 : 0.2) : 0;
          if ((r.friends || []).includes(a.idx)) x -= 0.3;
          if ((r.friends || []).includes(b.idx)) x += 0.3;
          if (x < 0) va++;
          else vb++;
        }
        const win = va >= vb ? 'a' : 'b';
        const p = PLATFORMS.find((q) => q.k === th.vars[`p${win}`]);
        if (p.k === 'tax' && L.econ.tax !== undefined) L.econ.tax = Math.max(0.02, L.econ.tax - 0.03);
        if (win === 'b') {
          retrain(L, a, a.age === 'elder' ? 'retired' : 'laborer', new RNG(hash4(a.idx, S.day, 0xe1)));
          retrain(L, b, 'mayor', new RNG(hash4(b.idx, S.day, 0xe2)));
        }
        const lose = win === 'a' ? 'b' : 'a';
        S.end(th, win === 'a' ? 'kept' : 'new leader', `${L.settlement.name} chose ${th.names[win]}, ${Math.max(va, vb)} votes to ${Math.min(va, vb)}. ${p.did[0].toUpperCase()}${p.did.slice(1)}, or soon will be. ${pick(rng, [`${th.names[lose]} shook their hand.`, `${th.names[lose]} went home early.`, 'There was a party, and a fight, and another party.'])}`, { news: [th.sid] });
      },
      fade: 9,
    },
  },
  townTalk(th, npc, pid, S) {
    if (th.done || !npc.rec || npc.rec.sid !== th.sid || npc.rec.age === 'child' || (th.vars.canvassed || []).includes(`${pid}:${npc.rec.idx}`)) return [];
    if (isRec(npc, th.cast.a) || isRec(npc, th.cast.b)) return [{ id: 'sge2_back', arg: `${tid(th)}:${isRec(npc, th.cast.a) ? 'a' : 'b'}`, label: 'You have my support.' }];
    return [
      { id: 'sge2_vote', arg: `${tid(th)}:a`, label: `Vote for ${th.names.a}: ${PLATFORMS.find((q) => q.k === th.vars.pa).say}.` },
      { id: 'sge2_vote', arg: `${tid(th)}:b`, label: `Vote for ${th.names.b}: ${PLATFORMS.find((q) => q.k === th.vars.pb).say}.` },
    ];
  },
  respond(th, npc, pid, id, arg, S) {
    const rng = S.rng(th, 0xe1f + (npc.id | 0));
    const side = String(arg).split(':')[1];
    if (id === 'sge2_vote') {
      (th.vars.canvassed ||= []).push(`${pid}:${npc.rec.idx}`);
      th.vars.backer = th.vars.backer || {};
      th.vars.backer[pid] = side;
      S.touch(th, pid);
      if (persuade(S, npc, rng, 0.3, 0)) {
        th.vars.lean += side === 'a' ? -0.06 : 0.06;
        return { lines: [pick(rng, ['Hm. You make a fair point.', 'Maybe I will, then.', 'I was going to anyway.'])] };
      }
      return { lines: [pick(rng, ['I\'ll vote how I like, thank you.', 'Ha! Not likely.'])] };
    }
    if (id === 'sge2_back') {
      (th.vars.canvassed ||= []).push(`${pid}:${npc.rec.idx}`);
      th.vars.lean += side === 'a' ? -0.08 * Math.min(3, 1 + S.person(pid).fame / 10) : 0.08 * Math.min(3, 1 + S.person(pid).fame / 10);
      S.touch(th, pid, `${nameOf(S, R.pl(pid))} came out for ${th.names[side]}.`);
      return { lines: [pick(rng, ['With you behind me, we can\'t lose!', 'Thank you. Tell everyone. Tell them twice.'])] };
    }
    return null;
  },
});

// ------------------------------------------------------------ down tools
const WORK = { miner: 'the miners', lumberjack: 'the woodcutters', laborer: 'the labourers', fisher: 'the fishers', farmer: 'the farmhands', builder: 'the builders' };

motif({
  id: 'strike',
  family: 'troubles',
  max: 2,
  key: (o) => `strike:${o.sid}`,
  title: (th, S) => `${th.vars.who[0].toUpperCase()}${th.vars.who.slice(1)} of ${townName(S, th.sid)} Down Tools`,
  scan(S, rng) {
    if (!rng.chance(0.03)) return null;
    for (const L of rng.shuffle(laidTowns(S)).slice(0, 3)) {
      const by = {};
      for (const r of adults(L)) if (WORK[r.job]) (by[r.job] ||= []).push(r);
      const k = Object.keys(by).filter((j) => by[j].length >= 3);
      if (!k.length || !mayorOf(L)) continue;
      const j = rng.pick(k);
      const lead = by[j].sort((a, b) => nat(b, 'bravery') + nat(b, 'temper') - nat(a, 'bravery') - nat(a, 'temper'))[0];
      return { cast: { lead: R.rec(L.settlement.id, lead.idx), mayor: R.rec(L.settlement.id, mayorOf(L).idx), town: R.town(L.settlement.id) }, sid: L.settlement.id, vars: { job: j, who: WORK[j], why: rng.pick(['pay', 'pay', 'a man killed by a rotten prop', 'the new tax on tools', 'the hours']) } };
    }
    return null;
  },
  nodes: {
    out: {
      enter(th, S) {
        const L = layoutOf(S, th.sid);
        if (!L) return S.end(th, 'faded');
        th.vars.give = { lead: 0, mayor: 0 };
        S.note(th, `${th.vars.who[0].toUpperCase()}${th.vars.who.slice(1)} of ${L.settlement.name} have downed tools over ${th.vars.why}. ${th.names.lead} speaks for them; ${th.names.mayor} won't budge.`, { news: [th.sid] });
        th.vars.cost = 30 + S.rng(th, 1).int(0, 40);
        for (const r of adults(L)) if (r.job === th.vars.job) r.striking = th.id;
      },
      day(th, S, rng) {
        const L = layoutOf(S, th.sid);
        if (!L) return S.end(th, 'faded');
        L.econ.treasury = Math.max(0, L.econ.treasury - 3);
        const g = th.vars.give;
        if (g.lead >= 1 && g.mayor >= 1) return settleStrike(th, S, 'deal', rng);
        const days = (S.now - th.nodeAt) / DAY;
        if (days > 5) {
          const m = recOf(S, th.cast.mayor);
          const how = S.choose(th, [{ to: 'mayor', w: m ? nat(m, 'kindness') + 0.2 : 0.5 }, { to: 'broke', w: 0.8 }, { to: 'left', w: 0.4 }], rng).to;
          return settleStrike(th, S, how, rng);
        }
      },
      fade: 9,
    },
  },
  townTalk(th, npc, pid, S) {
    if (th.done) return [];
    const out = [];
    if (isRec(npc, th.cast.lead) && !th.vars.give.lead) out.push({ id: 'sgk_lead', arg: tid(th), label: 'Would you go back for half of what you\'re asking?' });
    if (isRec(npc, th.cast.mayor) && !th.vars.give.mayor) {
      out.push({ id: 'sgk_mayor', arg: tid(th), label: `Meet them halfway. The town can't go on like this.` });
      out.push({ id: 'sgk_pay', arg: tid(th), label: `I'll put in the difference myself. (¤${th.vars.cost})` });
    }
    if (npc.rec && npc.rec.striking === th.id && !isRec(npc, th.cast.lead) && !(th.vars.scabbed || []).includes(pid)) out.push({ id: 'sgk_back', arg: tid(th), label: 'Go back to work. This won\'t end well.' });
    return out;
  },
  respond(th, npc, pid, id, arg, S) {
    const rng = S.rng(th, 0x5e7 + (npc.id | 0));
    S.touch(th, pid);
    if (id === 'sgk_lead') {
      if (persuade(S, npc, rng, 0.3, nat(npc.rec, 'temper') * 0.3)) {
        th.vars.give.lead = 1;
        return { lines: ['...Half. If they put it in writing. I\'ll put it to the others.'] };
      }
      return { lines: ['Half? People DIED. No.'] };
    }
    if (id === 'sgk_mayor') {
      if (persuade(S, npc, rng, 0.3, has(npc.rec, 'stingy') ? 0.25 : 0)) {
        th.vars.give.mayor = 1;
        return { lines: ['...If they\'ll meet me halfway. HALFWAY. Tell them.'] };
      }
      return { lines: ['I won\'t be held to ransom.'] };
    }
    if (id === 'sgk_pay') {
      if (purse(S, pid) < th.vars.cost) return { lines: [`¤${th.vars.cost}, and you haven't got it.`] };
      pay(S, pid, th.vars.cost);
      S.person(pid).fame += 1;
      settleStrike(th, S, 'paid', rng, pid);
      return { lines: ['You\'d... well. That settles that, then. I\'ll tell them myself.'] };
    }
    if (id === 'sgk_back') {
      (th.vars.scabbed ||= []).push(pid);
      if (persuade(S, npc, rng, 0.2, 0.1)) {
        npc.rec.striking = null;
        th.vars.give.lead = Math.max(th.vars.give.lead, 0.5);
        repWith(S, layoutOf(S, th.sid), recOf(S, th.cast.lead), -10);
        return { lines: ['...You\'re right. I\'ve mouths to feed. I\'m going back.'] };
      }
      return { lines: ['Whose side are you on?'] };
    }
    return null;
  },
});

function settleStrike(th, S, how, rng, pid = null) {
  const L = layoutOf(S, th.sid);
  if (L) for (const r of L.npcs) if (r.striking === th.id) r.striking = null;
  const lines = {
    deal: `${th.names.lead} and ${th.names.mayor} met halfway, and ${th.vars.who} went back to work. Nobody's happy. That's a deal, then.`,
    paid: `${pid ? nameOf(S, R.pl(pid)) : 'Someone'} put in the money out of their own pocket, and ${th.vars.who} went back to work.`,
    mayor: `${th.names.mayor} gave way in the end. ${th.vars.who[0].toUpperCase()}${th.vars.who.slice(1)} went back to work cheering.`,
    broke: `The strike broke: one by one, ${th.vars.who} went back, hungry. ${th.names.lead} ${pick(rng, ['was the last.', 'never did.', 'has been turned off.'])}`,
    left: `Rather than give in, a few of ${th.vars.who} packed up and left ${townName(S, th.sid)} for good. The rest went back.`,
  };
  if (how === 'left' && L) {
    const others = laidTowns(S).filter((T) => T !== L && !T.settlement.deserted);
    const go = adults(L).filter((r) => r.job === th.vars.job).slice(0, 2);
    if (others.length && go.length) relocate(S.sim, L, go, rng.pick(others), 'after the strike');
  }
  S.end(th, how, lines[how], { news: [th.sid] });
}

// ------------------------------------------------------------ the ratcatcher
motif({
  id: 'ratcatcher',
  family: 'troubles',
  max: 1,
  key: (o) => `rats:${o.sid}`,
  title: (th, S) => `The Rats of ${townName(S, th.sid)}`,
  scan(S, rng) {
    if (!rng.chance(0.03)) return null;
    const L = rng.pick(laidTowns(S));
    return L ? { cast: { town: R.town(L.settlement.id) }, sid: L.settlement.id } : null;
  },
  nodes: {
    rats: {
      enter(th, S) {
        const L = layoutOf(S, th.sid);
        if (!L) return S.end(th, 'faded');
        const rng = S.rng(th, 0x2a7);
        th.vars.fee = 40 + rng.int(0, 30);
        th.vars.stingy = nat(mayorOf(L) || {}, 'kindness') < 0.4 || has(mayorOf(L), 'stingy') || rng.chance(0.3);
        const p = makePerson(rng, 'vale', 'stranger');
        th.vars.piper = `${p.name.first} ${p.name.last}`;
        const at = townMid(L.settlement);
        S.actor(th, { key: 'piper', kind: 'npc', role: 'piper', talk: true, at, stay: true, person: { ...p, title: 'Ratcatcher', look: { ...p.look, outfit: 'vest', hat: 'wide' } }, orders: { home: at, roam: 4, lines: ['*plays a few notes*', 'Rats are no trouble. People are trouble.', 'A fair price for fair work.'] } });
        S.note(th, `Rats in the granary of ${L.settlement.name}, rats in the cellars, rats in the beds. A stranger in a patched coat, ${th.vars.piper}, says they'll clear every one for ¤${th.vars.fee}. The council has agreed.`, { news: [th.sid] });
      },
      day(th, S, rng) {
        const L = layoutOf(S, th.sid);
        if (!L) return S.end(th, 'faded');
        const days = (S.now - th.nodeAt) / DAY;
        if (days >= 1 && !th.vars.cleared) {
          th.vars.cleared = true;
          S.note(th, `${th.vars.piper} walked through ${L.settlement.name} at dawn playing a pipe, and the rats followed, every one, down to the river. Now: the fee.`, { news: [th.sid] });
          if (th.vars.stingy) S.note(th, `The council says ¤${th.vars.fee} was "a figure of speech". They've offered ¤10.`);
        }
        if (days >= 2 && th.vars.cleared) {
          if (!th.vars.stingy || th.vars.paid) {
            S.dismissActor(th, 'piper');
            if (!th.vars.paid) L.econ.treasury = Math.max(0, L.econ.treasury - th.vars.fee);
            return S.end(th, 'paid', `${th.vars.piper} was paid, tipped their hat, and went on down the road. There hasn't been a rat in ${L.settlement.name} since.`, { news: [th.sid] });
          }
          // Cheated: what the ratcatcher does about it.
          S.dismissActor(th, 'piper');
          const how = S.choose(th, [{ to: 'back', w: 1 }, { to: 'cats', w: 0.5 }, { to: 'children', w: 0.25 }, { to: 'shrug', w: 0.4 }], rng).to;
          if (how === 'children') {
            const kids = living(L).filter((r) => r.age === 'child' && !r.away);
            const c = pick(rng, kids);
            const par = c && (c.parents || []).map((i) => L.npcs[i]).find((q) => q && alive(q));
            const m = townMid(L.settlement);
            const at = spotNear(S, m.x, m.z, 50, 100, rng, { woods: true, clear: 12 });
            if (c && par && at) {
              S.split(th, 'lost_child', { cast: { child: R.rec(th.sid, c.idx), parent: R.rec(th.sid, par.idx), town: R.town(th.sid) }, sid: th.sid, spots: [at], vars: { at } }, `The night the council cheated the ratcatcher, a pipe was heard in the street, and a child followed it out of town.`);
              return S.end(th, 'cheated', `${L.settlement.name} cheated the ratcatcher. That night, there was music in the street.`, { news: [th.sid] });
            }
          }
          if (how === 'cats') return S.end(th, 'cheated', `${L.settlement.name} cheated the ratcatcher. The next morning, every cat in town was gone. The rats are back within the week.`, { news: [th.sid] });
          if (how === 'shrug') return S.end(th, 'cheated', `${L.settlement.name} cheated the ratcatcher, who only laughed, and said: "You'll get what you paid for." Nobody knows what that means. Yet.`);
          return S.end(th, 'cheated', `${L.settlement.name} cheated the ratcatcher. Three days later, the rats came back, twice as many, and bolder.`, { news: [th.sid] });
        }
      },
      fade: 5,
    },
  },
  hello(th) {
    return th.vars.cleared ? 'Every rat, gone. Now: my fee.' : 'Rats? I\'ve heard them sing. They don\'t frighten me.';
  },
  talk(th, a) {
    if (a.role !== 'piper' || !th.vars.cleared || !th.vars.stingy || th.vars.paid) return [];
    return [{ id: 'sgr3_pay', arg: tid(th), label: `The council won't pay you. I will. (¤${th.vars.fee})` }];
  },
  respond(th, npc, pid, id, arg, S) {
    if (id !== 'sgr3_pay') return null;
    if (purse(S, pid) < th.vars.fee) return { lines: [`Kind. But it's ¤${th.vars.fee}.`] };
    pay(S, pid, th.vars.fee);
    th.vars.paid = pid;
    S.touch(th, pid);
    S.person(pid).fame += 1;
    S.townSay(pid, th.sid, 5);
    S.note(th, `${nameOf(S, R.pl(pid))} paid the ratcatcher what the council wouldn't.`, { by: pid, news: [th.sid] });
    return { lines: ['An honest soul! In this town! Well. I\'ll remember you, and I\'ll remember them.'] };
  },
});

// ------------------------------------------------------------ a witch hunt
motif({
  id: 'witch_hunt',
  family: 'troubles',
  max: 1,
  key: (o) => `witch:${o.sid}`,
  title: (th) => `They Blame ${th.names.accused}`,
  // (Ill luck in a town: see wonders.js, which may start one.)
  scan(S, rng) {
    if (!rng.chance(0.02)) return null;
    const L = rng.pick(laidTowns(S));
    return L ? pickAccused(S, L, rng, 'a run of bad luck') : null;
  },
  nodes: {
    rumour: {
      enter(th, S) {
        const L = layoutOf(S, th.sid);
        const a = recOf(S, th.cast.accused);
        if (!L || !a) return S.end(th, 'faded');
        const rng = S.rng(th, 0x3c4);
        th.vars.anger = 0.4;
        const lead = someone(L, rng, (r) => r !== a && (nat(r, 'temper') > 0.55 || has(r, 'superstitious')));
        if (lead) {
          th.cast.lead = R.rec(th.sid, lead.idx);
          th.names.lead = fullName(lead);
        }
        S.note(th, `Since ${th.vars.why}, people in ${L.settlement.name} have started saying it's ${th.names.accused}'s doing. ${pick(rng, ['They keep to themselves.', 'They talk to their cat.', 'They came from somewhere else.', 'They know too much about herbs.'])} ${lead ? `${th.names.lead} says it loudest.` : ''}`, { news: [th.sid] });
        const t = S.post(th, {
          role: 'defend', kind: 'talk', title: `Stand up for ${th.names.accused} before the town turns on them`, sid: th.sid, giver: th.cast.accused,
          pitch: say(rng, ['They look at me in the street like I\'m something under their boot. I\'ve done nothing. NOTHING. If someone they trusted said so...', 'I\'ve lived here thirty years. Now they whisper when I pass. It will get worse. It always gets worse.'], {}),
          reward: { coins: 0, rep: 25, renown: th.sid, renownPts: 3, renownWhy: `standing up for ${first(a)}`, fame: 1 },
        });
        t.offerLabel = 'You look frightened.';
      },
      day(th, S, rng) {
        const L = layoutOf(S, th.sid);
        const a = recOf(S, th.cast.accused);
        if (!L || !a || !alive(a)) return S.end(th, 'faded');
        th.vars.anger = Math.max(0, Math.min(1, th.vars.anger + rng.float(-0.03, 0.12) - (th.vars.calmed || 0) * 0.08));
        if (th.vars.anger < 0.1) return S.end(th, 'blew over', `The talk about ${th.names.accused} died down. People are sheepish about it now. Some brought them bread.`, { news: [th.sid] });
        if (th.vars.anger >= 0.85) {
          const how = S.choose(th, [{ to: 'exiled', w: 1 }, { to: 'fled', w: nat(a, 'bravery') < 0.4 ? 1 : 0.3 }, { to: 'stood', w: nat(a, 'bravery') }], rng).to;
          if (how === 'exiled' && S.sim.society && S.sim.society.exile) {
            S.sim.society.exile(L, a, S.day, rng, 'witchcraft, they said');
            return S.end(th, 'driven out', `A crowd came to ${th.names.accused}'s door with torches. They were driven out of ${L.settlement.name}. ${pick(rng, ['The bad luck didn\'t stop.', 'Within a month, people were ashamed. It was too late.'])}`, { news: [th.sid] });
          }
          if (how === 'fled') {
            a.away = true;
            a.migrated = 'fled';
            if (a.ent && !a.ent.dead) S.game.despawnNpc(a.ent);
            return S.end(th, 'fled', `${th.names.accused} left ${L.settlement.name} in the night before the crowd came. Their door was found open, their cat on the step.`, { news: [th.sid] });
          }
          return S.end(th, 'stood firm', `When the crowd came, ${th.names.accused} opened the door and stood in it, and asked which of them they'd nursed through the fever. One by one, the crowd went home.`, { news: [th.sid] });
        }
      },
      fade: 12,
    },
  },
  tasks: { defend: {} },
  townTalk(th, npc, pid, S) {
    if (th.done || !npc.rec || npc.rec.sid !== th.sid || isRec(npc, th.cast.accused) || npc.rec.age === 'child' || (th.vars.talked || []).includes(`${pid}:${npc.rec.idx}`)) return [];
    return [
      { id: 'sgw4_defend', arg: tid(th), label: `${first(recOf(S, th.cast.accused))} has done nothing. Leave them be.` },
      { id: 'sgw4_join', arg: tid(th), label: `You're right about ${first(recOf(S, th.cast.accused))}. Something should be done.` },
    ];
  },
  respond(th, npc, pid, id, arg, S) {
    const rng = S.rng(th, 0x3c5 + (npc.id | 0));
    (th.vars.talked ||= []).push(`${pid}:${npc.rec.idx}`);
    S.touch(th, pid);
    const lead = isRec(npc, th.cast.lead);
    if (id === 'sgw4_defend') {
      if (persuade(S, npc, rng, 0.3, has(npc.rec, 'superstitious') ? 0.25 : 0)) {
        th.vars.calmed = (th.vars.calmed || 0) + (lead ? 3 : 1);
        if (lead) {
          const t = S.tasksOf(th, 'defend')[0];
          if (t) S.complete(t, R.pl(pid));
          S.note(th, `${nameOf(S, R.pl(pid))} faced down ${th.names.lead}, who's gone very quiet about ${th.names.accused}.`, { by: pid, news: [th.sid] });
        }
        return { lines: [pick(rng, ['...Maybe. Maybe it\'s just been a bad year.', 'You\'re right. I don\'t know what came over everyone.'])] };
      }
      th.vars.anger += 0.05;
      return { lines: [pick(rng, ['Easy for you. You don\'t live here.', 'Then who? Who\'s doing it?'])] };
    }
    th.vars.anger += lead ? 0.2 : 0.1;
    S.note(th, `${nameOf(S, R.pl(pid))} has been stirring the talk against ${th.names.accused}.`, { hidden: true, by: pid });
    return { lines: ['Exactly! Somebody finally says it!'] };
  },
});

export function pickAccused(S, L, rng, why) {
  const odd = adults(L).filter((r) => r.job !== 'mayor' && r.job !== 'guard' && (r.job === 'herbalist' || has(r, 'reserved') || has(r, 'gloomy') || r.arrived || r.age === 'elder'));
  if (!odd.length) return null;
  const a = rng.pick(odd);
  return { cast: { accused: R.rec(L.settlement.id, a.idx), town: R.town(L.settlement.id) }, sid: L.settlement.id, vars: { why } };
}

// ------------------------------------------------------------ a duel of honour
motif({
  id: 'honour_duel',
  family: 'troubles',
  max: 2,
  key: (o) => [`${o.cast.a.sid}:${o.cast.a.idx}`, `${o.cast.b.sid}:${o.cast.b.idx}`].sort().join('x'),
  title: (th) => `${th.names.a} and ${th.names.b} at Dawn`,
  scan(S, rng) {
    if (!rng.chance(0.03)) return null;
    for (const L of rng.shuffle(laidTowns(S)).slice(0, 3)) {
      const hot = adults(L).filter((r) => nat(r, 'temper') > 0.6 || has(r, 'proud') || has(r, 'hot-headed'));
      if (hot.length < 2) continue;
      const [a, b] = rng.shuffle(hot.slice());
      if (a.household === b.household) continue;
      return { cast: { a: R.rec(L.settlement.id, a.idx), b: R.rec(L.settlement.id, b.idx), town: R.town(L.settlement.id) }, sid: L.settlement.id, vars: { insult: rng.pick(['a remark about a mother', 'a spilt drink', 'a slur on a dead father\'s name', 'a cheat at cards', 'a sneer at a sweetheart']) } };
    }
    return null;
  },
  nodes: {
    called: {
      enter(th, S) {
        const L = layoutOf(S, th.sid);
        if (!L) return S.end(th, 'faded');
        th.vars.dawn = (S.day + 1) * DAY + 6 * 60;
        th.vars.cool = 0;
        S.note(th, `${th.names.a} and ${th.names.b} are to fight at dawn, over ${th.vars.insult}. Both want a second.`, { news: [th.sid] });
      },
      day(th, S, rng) {
        const L = layoutOf(S, th.sid);
        const a = recOf(S, th.cast.a);
        const b = recOf(S, th.cast.b);
        if (!L || !a || !b || !alive(a) || !alive(b)) return S.end(th, 'faded');
        if (S.now < th.vars.dawn) return;
        if (th.vars.cool >= 2) return S.end(th, 'reconciled', `${th.names.a} and ${th.names.b} met at dawn with swords, and ${pick(rng, ['laughed, and shook hands, and went for breakfast', 'neither could remember quite what the insult had been', 'agreed honour was satisfied by turning up'])}.`, { news: [th.sid] });
        const guards = L.npcs.some((r) => alive(r) && r.job === 'guard');
        const how = S.choose(th, [
          { to: 'stopped', w: guards ? 0.6 : 0 },
          { to: 'first blood', w: 1.2 },
          { to: 'missed', w: 0.6 },
          { to: 'death', w: 0.25 + th.vars.cool * -0.1 },
        ], rng).to;
        if (how === 'stopped') return S.end(th, 'stopped', `The watch broke up ${th.names.a} and ${th.names.b}'s duel at dawn, and fined them both.`);
        if (how === 'missed') return S.end(th, 'no harm', `${th.names.a} and ${th.names.b} fought at dawn, and both swung wild, and nobody was hurt, and everyone agreed honour was satisfied.`);
        const [w, l] = rng.chance(0.5 + (nat(a, 'bravery') - nat(b, 'bravery')) * 0.3) ? [a, b] : [b, a];
        if (how === 'death') {
          S.sim.recordDeath(L, l, `killed by ${fullName(w)} in a duel`, null);
          return S.end(th, 'death', `${fullName(w)} killed ${fullName(l)} in a duel at dawn, over ${th.vars.insult}. ${pick(rng, ['Nobody can quite believe it.', `${w.name.first} hasn't spoken since.`])}`, { news: [th.sid] });
        }
        l.hp = Math.max(1, Math.round((l.hp ?? 20) * 0.5));
        S.end(th, 'first blood', `${fullName(w)} drew first blood against ${fullName(l)} at dawn. ${pick(rng, ['A scar to remember it by.', 'They\'re both rather proud of it now.', 'Honour, apparently, is satisfied.'])}`, { news: [th.sid] });
      },
      fade: 3,
    },
  },
  townTalk(th, npc, pid, S) {
    if (th.done || !(isRec(npc, th.cast.a) || isRec(npc, th.cast.b)) || (th.vars.talked || []).includes(`${pid}:${npc.rec.idx}`)) return [];
    return [
      { id: 'sgh3_off', arg: tid(th), label: 'Call it off. It\'s not worth dying for.' },
      { id: 'sgh3_second', arg: tid(th), label: 'I\'ll be your second.' },
    ];
  },
  respond(th, npc, pid, id, arg, S) {
    const rng = S.rng(th, 0x4d1);
    (th.vars.talked ||= []).push(`${pid}:${npc.rec.idx}`);
    S.touch(th, pid);
    if (id === 'sgh3_off') {
      if (persuade(S, npc, rng, 0.3, has(npc.rec, 'proud') ? 0.2 : 0)) {
        th.vars.cool++;
        return { lines: [pick(rng, ['...If they apologise. Half an apology. A quarter.', 'Maybe I was hasty.'])] };
      }
      return { lines: ['Not worth it? My HONOUR is worth it.'] };
    }
    th.vars.second = pid;
    S.note(th, `${nameOf(S, R.pl(pid))} stood second to ${fullName(npc.rec)}.`, { by: pid });
    return { lines: ['Good. Dawn, by the old oak. Bring a cloth: there may be blood.'] };
  },
});

// ------------------------------------------------------------ the gambler
motif({
  id: 'gambler',
  family: 'troubles',
  max: 2,
  key: (o) => `gamble:${o.cast.gambler.sid}:${o.cast.gambler.idx}`,
  title: (th) => `${th.names.gambler}'s Luck`,
  scan(S, rng) {
    if (!rng.chance(0.04)) return null;
    for (const L of rng.shuffle(laidTowns(S)).slice(0, 3)) {
      const tav = L.buildings.find((b) => b.type === 'tavern' && b.inside);
      const g = adults(L).find((r) => (r.life && r.life.vice === 'gambler') || has(r, 'lazy') || has(r, 'witty'));
      const kin = g && kinOf(L, g)[0];
      if (!tav || !g || !kin) continue;
      return { cast: { gambler: R.rec(L.settlement.id, g.idx), kin: R.rec(L.settlement.id, kin.idx), town: R.town(L.settlement.id) }, sid: L.settlement.id, vars: { lost: 30 + rng.int(0, 60), at: { x: tav.inside.x, z: tav.inside.z } } };
    }
    return null;
  },
  nodes: {
    losing: {
      enter(th, S) {
        const L = layoutOf(S, th.sid);
        if (!L) return S.end(th, 'faded');
        const rng = S.rng(th, 0x6a3);
        const p = makePerson(rng, 'vale', 'stranger');
        th.vars.sharp = `${p.name.first} ${p.name.last}`;
        th.vars.cheat = rng.chance(0.7);
        S.actor(th, { key: 'sharp', kind: 'npc', role: 'sharp', talk: true, at: th.vars.at, stay: true, person: { ...p, title: 'Dice Player' }, orders: { home: th.vars.at, roam: 1, lines: ['Another throw?', 'Luck\'s a lady. A fickle one.', '*rattles dice*'] } });
        S.note(th, `${th.names.gambler} has lost ¤${th.vars.lost} at dice to ${th.vars.sharp}, a stranger at the tavern, and keeps going back to win it back.`, { news: [th.sid] });
        const t = S.post(th, {
          role: 'stop', kind: 'talk', title: `Win back ${first(recOf(S, th.cast.gambler))}'s money from ${th.vars.sharp}, or stop them losing more`, sid: th.sid, giver: th.cast.kin,
          pitch: say(rng, ['¤{n}. The roof money. And they say "one more throw". There\'s a stranger at the tavern with very lucky dice. Too lucky.', 'I can\'t stop them. I\'ve tried. Maybe someone who can play could win it back. Or see what that stranger\'s really up to.'], { n: th.vars.lost }),
          reward: { coins: 0, rep: 20, fame: 1 },
        });
        t.offerLabel = 'Is something wrong at home?';
      },
      day(th, S, rng) {
        const g = recOf(S, th.cast.gambler);
        if (!g) return S.end(th, 'faded');
        th.vars.lost += rng.int(5, 20);
        if ((S.now - th.nodeAt) / DAY > 5) {
          S.dismissActor(th, 'sharp');
          if (rng.chance(0.2)) return S.end(th, 'won it back', `${th.names.gambler} won it all back on one last throw, and swore never to touch dice again. ${pick(rng, ['Nobody believes the second part.', 'So far, so good.'])}`);
          g.mood = Math.max(0, (g.mood ?? 0.5) - 0.3);
          return S.end(th, 'ruined', `${th.vars.sharp} left town with ¤${th.vars.lost} of ${th.names.gambler}'s family's money. ${pick(rng, ['They\'re selling the cow.', 'The roof will have to wait.', 'They aren\'t speaking at home.'])}`, { news: [th.sid] });
        }
      },
      fade: 7,
    },
  },
  hello(th) {
    return 'Care for a throw? Small stakes. Friendly.';
  },
  talk(th, a) {
    if (a.role !== 'sharp') return [];
    return [
      { id: 'sgg2_dice', arg: `${tid(th)}:20`, label: 'A throw for ¤20.' },
      { id: 'sgg2_watch', arg: tid(th), label: '(Watch their hands closely as they throw.)' },
      { id: 'sgg2_go', arg: tid(th), label: `Leave ${th.names.gambler} alone. Go and fleece some other town.` },
    ];
  },
  townTalk(th, npc, pid, S) {
    if (!isRec(npc, th.cast.gambler) || th.vars.pleaded === pid) return [];
    return [{ id: 'sgg2_quit', arg: tid(th), label: 'Walk away from the dice. Today.' }];
  },
  respond(th, npc, pid, id, arg, S) {
    const rng = S.rng(th, 0x6a4 + Math.floor(S.now));
    const t = S.tasksOf(th, 'stop')[0];
    S.touch(th, pid);
    if (id === 'sgg2_dice') {
      const n = 20;
      if (purse(S, pid) < n) return { lines: ['Twenty, friend. Show me the coin.'] };
      const win = rng.chance(th.vars.cheat && !th.vars.caught ? 0.3 : 0.5);
      const [x, y] = [rng.int(2, 12), rng.int(2, 12)].sort((p, q) => (win ? q - p : p - q));
      if (win) {
        S.give(pid, 'coin', n);
        th.vars.won = (th.vars.won || 0) + n * 2;
        if (th.vars.won >= th.vars.lost) {
          if (t) S.complete(t, R.pl(pid));
          S.dismissActor(th, 'sharp');
          S.end(th, 'won back', `${nameOf(S, R.pl(pid))} sat down at ${th.vars.sharp}'s table and won ${th.names.gambler}'s money back, throw by throw. ${th.vars.sharp} left in a temper.`, { news: [th.sid] });
          return { lines: [`(You throw ${x}. They throw ${y}.)`, 'That\'s... enough for me tonight. Enough for this TOWN.'], close: true };
        }
        return { lines: [`(You throw ${x}. They throw ${y}. You win.)`, 'Beginner\'s luck. Again?'] };
      }
      pay(S, pid, n);
      return { lines: [`(You throw ${y}. They throw ${x}. You lose.)`, 'Bad luck, friend. Again?'] };
    }
    if (id === 'sgg2_watch') {
      if (th.vars.cheat && rng.chance(0.6)) {
        th.vars.caught = true;
        if (t) S.complete(t, R.pl(pid));
        S.dismissActor(th, 'sharp');
        S.person(pid).fame += 1;
        S.end(th, 'caught cheating', `${nameOf(S, R.pl(pid))} caught ${th.vars.sharp} swapping loaded dice at the tavern. The whole room saw it. ${th.names.gambler} got every coin back, and ${th.vars.sharp} left through the window.`, { news: [th.sid] });
        return { lines: ['(There: a flick of the wrist, a second pair of dice palmed in. You grab their hand. Loaded dice drop on the table.)', 'I... that\'s not... ALL RIGHT. All right! Take it! Take it all!'], close: true };
      }
      return { lines: [th.vars.cheat ? '(Their hands are quick. Too quick to see, this time.)' : '(Nothing. They\'re just lucky. Infuriatingly lucky.)'] };
    }
    if (id === 'sgg2_go') {
      if (persuade(S, npc, rng, 0.2, 0.1)) {
        S.dismissActor(th, 'sharp');
        if (t) S.complete(t, R.pl(pid));
        S.end(th, 'sent off', `${nameOf(S, R.pl(pid))} told ${th.vars.sharp} to leave ${townName(S, th.sid)}, and they did. ${th.names.gambler}'s money went with them, but no more of it.`, { news: [th.sid] });
        return { lines: ['...There are other towns. Friendlier ones.'], close: true };
      }
      return { lines: ['It\'s a free table, friend. Sit or go.'] };
    }
    if (id === 'sgg2_quit') {
      th.vars.pleaded = pid;
      if (persuade(S, npc, rng, 0.25, 0.15)) {
        if (t) S.complete(t, R.pl(pid));
        S.dismissActor(th, 'sharp');
        S.end(th, 'quit', `${th.names.gambler} walked away from the dice, on ${nameOf(S, R.pl(pid))}'s word. The money's gone, but no more of it.`, { news: [th.sid] });
        return { lines: ['...You\'re right. You\'re right. I can hear myself, and I sound like my father. I\'m done.'] };
      }
      return { lines: ['One more throw. Just one. My luck\'s due.'] };
    }
    return null;
  },
});

// ------------------------------------------------------------ the tonic
motif({
  id: 'tonic',
  family: 'troubles',
  max: 1,
  key: (o) => `tonic:${o.sid}`,
  title: (th) => `${th.vars.doctor}'s Miracle Tonic`,
  scan(S, rng) {
    if (!rng.chance(0.03)) return null;
    const L = rng.pick(laidTowns(S));
    return L ? { cast: { town: R.town(L.settlement.id) }, sid: L.settlement.id, vars: { doctor: `Doctor ${rng.pick(['Marvel', 'Quillfeather', 'Bellamy', 'Sixpence', 'Hollow'])}` } } : null;
  },
  nodes: {
    selling: {
      enter(th, S) {
        const L = layoutOf(S, th.sid);
        if (!L) return S.end(th, 'faded');
        const rng = S.rng(th, 0x70c);
        th.vars.truth = S.choose(th, [{ to: 'water', w: 1 }, { to: 'harm', w: 0.6 }, { to: 'real', w: 0.4 }], rng).to;
        const p = makePerson(rng, 'vale', 'stranger');
        const at = townMid(L.settlement);
        S.actor(th, { key: 'doc', kind: 'npc', role: 'doctor', talk: true, at, stay: true, person: { ...p, title: th.vars.doctor }, orders: { home: at, roam: 3, mark: 'talk', lines: ['Cures gout, grief and the ague!', 'A spoonful a day!', 'Testimonials available on request!'] } });
        const herb = adults(L).find((r) => r.job === 'herbalist');
        if (herb) {
          th.cast.herb = R.rec(th.sid, herb.idx);
          th.names.herb = fullName(herb);
        }
        S.note(th, `${th.vars.doctor} has set up in ${L.settlement.name}'s square, selling a tonic that "cures all ills". ${herb ? `${th.names.herb} says it's ditchwater, or worse.` : 'Folk are buying.'}`, { news: [th.sid] });
        if (herb) {
          const t = S.post(th, {
            role: 'test', kind: 'talk', title: `Bring ${first(herb)} a bottle of ${th.vars.doctor}'s tonic to test`, sid: th.sid, giver: th.cast.herb,
            pitch: 'I want to know what\'s in it before half the town drinks it. Buy a bottle and bring it to me. I\'ll pay you back.',
            reward: { coins: 8, rep: 10, fame: 0.5 },
          });
          t.offerLabel = 'You don\'t look happy about the doctor.';
        }
      },
      day(th, S, rng) {
        const L = layoutOf(S, th.sid);
        if (!L) return S.end(th, 'faded');
        const days = (S.now - th.nodeAt) / DAY;
        if (th.vars.truth === 'harm' && days >= 2 && !th.vars.sick) {
          th.vars.sick = true;
          for (const r of rng.shuffle(adults(L)).slice(0, 3)) r.sick = true;
          S.note(th, `Three who drank ${th.vars.doctor}'s tonic are sick in bed.`, { news: [th.sid] });
        }
        if (days > 4) {
          S.dismissActor(th, 'doc');
          if (th.vars.truth === 'real') return S.end(th, 'real', `${th.vars.doctor} moved on. The odd thing is, the tonic seems to have worked: old Hettie's knees, the miller's cough. ${th.names.herb ? `${th.names.herb} is furious.` : ''}`);
          return S.end(th, 'moved on', `${th.vars.doctor} moved on, with a full purse. ${th.vars.truth === 'harm' ? 'The sick are recovering, slowly.' : 'Nobody is any better, or any worse.'}`, { news: [th.sid] });
        }
      },
      fade: 6,
    },
  },
  hello(th) {
    return 'Ailing, friend? I see it in your eyes. A spoonful of this...';
  },
  talk(th, a) {
    if (a.role !== 'doctor') return [];
    const out = [{ id: 'sgt2_buy', arg: tid(th), label: 'One bottle, please. (¤5)' }];
    if (th.vars.tested) out.push({ id: 'sgt2_expose', arg: tid(th), label: 'The herbalist tested your tonic.' });
    return out;
  },
  townTalk(th, npc, pid, S) {
    if (!isRec(npc, th.cast.herb) || !th.vars.bought || !th.vars.bought.includes(pid) || th.vars.tested) return [];
    return [{ id: 'sgt2_test', arg: tid(th), label: 'Here: a bottle of the tonic.' }];
  },
  respond(th, npc, pid, id, arg, S) {
    const rng = S.rng(th, 0x70d);
    S.touch(th, pid);
    if (id === 'sgt2_buy') {
      if (purse(S, pid) < 5) return { lines: ['Five coins, friend. Health is priceless; this is cheap.'] };
      pay(S, pid, 5);
      (th.vars.bought ||= []).push(pid);
      return { lines: ['Wise! Wise! A spoonful a day. And tell your friends.', '(You have a bottle of murky tonic. Well, you have it in the story: it\'s for the herbalist.)'] };
    }
    if (id === 'sgt2_test') {
      th.vars.tested = pid;
      const t = S.tasksOf(th, 'test')[0];
      if (t) {
        if (!S.claimedBy(t, pid)) S.accept(t, R.pl(pid));
        S.complete(t, R.pl(pid));
        if (t.status === 'won') S.turnIn(t, pid);
      }
      const v = th.vars.truth;
      return { lines: [v === 'water' ? '(They sniff it, taste it, spit.) River water, a bit of liquorice, and a lot of hope. Harmless. Useless.' : v === 'harm' ? '(They sniff it and go pale.) Nightshade. Not much. Enough, over a week. Stop them. STOP them.' : '(They taste it. Frown. Taste it again.) ...Willow bark. Honey. Something I don\'t know. It\'s... actually rather good. Don\'t tell anyone I said that.'] };
    }
    if (id === 'sgt2_expose') {
      S.dismissActor(th, 'doc');
      const v = th.vars.truth;
      if (v === 'real') {
        S.end(th, 'vindicated', `${th.vars.doctor}'s tonic was tested by the town herbalist, and found to be good. They left town with a queue still at their stall.`, { news: [th.sid] });
        return { lines: ['And? ...And it\'s GOOD? I could have told you that. I did tell you that.'], close: true };
      }
      S.person(pid).fame += 1;
      S.end(th, 'exposed', `${nameOf(S, R.pl(pid))} had ${th.vars.doctor}'s tonic tested: ${v === 'harm' ? 'it was slow poison' : 'it was river water'}. ${th.vars.doctor} was run out of ${townName(S, th.sid)}${v === 'harm' ? ' just ahead of the watch' : ''}.`, { news: [th.sid] });
      return { lines: [pick(rng, ['Slander! Calumny! I\'m leaving, but only because I WANT to.', '...Is that the time? I really must be going.'])], close: true };
    }
    return null;
  },
});

