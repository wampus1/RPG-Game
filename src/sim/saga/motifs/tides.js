// (Round 78) Stories the world makes for itself out of what happens in it:
// none of these is dealt out at random; each grows from something that
// really came to pass (see the events named in each `seeds`).
//
//   - Taken at sea: pirates took a ship out of a town's harbour; a hand
//     aboard her has family at home, waiting on a ransom note. Pay it, or
//     go and burn the pirates out of their cove.
//   - The drowned: a ship went down in a sea fight; her home port means to
//     raise a stone by the harbour for her crew, if it can find the stone.
//   - An army ashore: a troopship has landed the enemy on the coast; the
//     watch wants every blade it can get before they march on the town.
//   - Sore losers: the town has voted, and whoever spoke for the losing
//     side won't let it lie. Talk them round, or they'll leave.
//   - Raised from your plans: a town's builders put up a building off
//     your blueprint; a neighbour wants a blank sheet to draw one too.
//   - A raider's bounty: pirates seen off the coast; the harbour pays for
//     her taken or sunk.
import { motif, R, nameOf } from '../core.js';
import { pick, say, layoutOf, laidTowns, townName, townMid, adults, recOf, purse, persuade, isRec, nat } from './lib.js';
import { makePerson } from '../actors.js';
import { mayorOf, alive } from '../../econ.js';
import { relocate } from '../../civic.js';
import { removeItem } from '../../../game/inventory.js';

const tid = (th) => `t${th.id}`;
const first = (r) => (r ? r.name.first : 'them');
const pay = (S, pid, n) => S.asPid(pid, (p) => removeItem(p.inv, 'coin', n));
const someoneIn = (L, rng, f = () => true) => {
  const list = adults(L).filter((r) => alive(r) && r.job !== 'mayor' && f(r));
  return list.length ? pick(rng, list) : null;
};
const guardOf = (L) => L.npcs.find((r) => alive(r) && r.job === 'guard') || mayorOf(L);

// ------------------------------------------------------------ taken at sea
motif({
  id: 'taken_at_sea',
  family: 'troubles',
  max: 3,
  key: (o) => `taken:${o.sid}:${o.vars.ship}`,
  title: (th) => `Taken with the ${th.vars.ship}`,
  seeds: [{ on: 'ship_taken', make: (ev, S) => {
    const L = layoutOf(S, ev.sid);
    if (!L) return null;
    const kin = someoneIn(L, { next: Math.random });
    if (!kin) return null;
    return { cast: { kin: R.rec(ev.sid, kin.idx), town: R.town(ev.sid) }, sid: ev.sid, vars: { ship: ev.ship, cove: ev.cove || 'their cove', to: ev.to } };
  } }],
  nodes: {
    waiting: {
      enter(th, S) {
        const L = layoutOf(S, th.sid);
        const k = recOf(S, th.cast.kin);
        if (!L || !k) return S.end(th, 'faded');
        const rng = S.rng(th, 0x7a4);
        const p = makePerson(rng, L.settlement.style || 'vale', 'sailor');
        th.vars.hand = p.name.first;
        th.vars.rel = pick(rng, ['son', 'daughter', 'brother', 'sister', 'partner']);
        th.vars.ransom = 60 + rng.int(0, 8) * 10;
        th.vars.due = S.day + rng.int(8, 12);
        S.note(th, `Pirates out of ${th.vars.cove} took the ${th.vars.ship} at sea. ${th.names.kin}'s ${th.vars.rel} ${th.vars.hand} was aboard her, and a note has come: ¤${th.vars.ransom}, or they're sold on.`, { news: [th.sid] });
        const t = S.post(th, {
          role: 'free', kind: 'talk', title: `Get ${th.vars.hand} back from the pirates of ${th.vars.cove}`, sid: th.sid, giver: th.cast.kin,
          pitch: say(rng, ['They took the {s}, and {h} with her. The note says ¤{n}, or they sell {h} on, somewhere we\'ll never find. We haven\'t got ¤{n}. We haven\'t got half of it.', 'My {r} {h} signed on the {s} for one voyage. ONE. Now pirates have {h}, and they want ¤{n}.'], { s: th.vars.ship, h: th.vars.hand, n: th.vars.ransom, r: th.vars.rel }),
          reward: { coins: 0, rep: 25, renown: th.sid, renownPts: 4, renownWhy: `bringing ${th.vars.hand} home`, fame: 2 },
        });
        t.offerLabel = 'You look like you\'ve had bad news.';
        t.rumour = `${th.names.kin} of ${L.settlement.name} is trying to raise a ransom for pirates`;
      },
      on: {
        // Their cove burnt out (or the ship that took her taken): the
        // captives found in her hold.
        pirates_beaten(th, ev, S) {
          if (!ev.cove) return;
          const t = S.tasksOf(th, 'free')[0];
          const by = ev.pid ? R.pl(ev.pid) : null;
          if (t && by) S.complete(t, by);
          S.end(th, 'freed', `When ${th.vars.cove}'s ships were beaten, ${th.vars.hand} was found in a hold, alive. ${th.vars.hand} is home with ${th.names.kin}.`, { news: [th.sid] });
        },
      },
      day(th, S, rng) {
        const k = recOf(S, th.cast.kin);
        if (!k || !alive(k)) return S.end(th, 'faded');
        if (S.day < th.vars.due) return;
        if (rng.chance(0.35)) return S.end(th, 'escaped', `${th.vars.hand}, taken with the ${th.vars.ship}, came home on their own: over the side one dark night and a long swim. Thin as a rail, but home.`, { news: [th.sid] });
        S.end(th, 'sold', `No ransom was paid, and ${th.vars.hand} of the ${th.vars.ship} was sold on. ${th.names.kin} hasn't spoken since.`, { news: [th.sid] });
      },
      fade: 14,
    },
  },
  tasks: { free: { thanks: (th) => [`${th.vars.hand}... you brought ${th.vars.hand} home. I don't know how we'll ever repay you.`] } },
  townTalk(th, npc, pid, S) {
    if (!isRec(npc, th.cast.kin)) return [];
    const t = S.tasksOf(th, 'free')[0];
    if (!t) return [];
    return [{ id: 'tid_ransom', arg: tid(th), label: `I'll pay the ransom. (¤${th.vars.ransom})` }, { id: 'tid_cove', arg: tid(th), label: `I'll go to ${th.vars.cove} and bring ${th.vars.hand} back.` }];
  },
  respond(th, npc, pid, id, arg, S) {
    const t = S.tasksOf(th, 'free')[0];
    if (id === 'tid_ransom') {
      if (purse(S, pid) < th.vars.ransom) return { lines: [`¤${th.vars.ransom}. That's what the note says. Every coin.`] };
      pay(S, pid, th.vars.ransom);
      if (t) S.complete(t, R.pl(pid));
      S.end(th, 'ransomed', `${nameOf(S, R.pl(pid))} paid the pirates' ransom for ${th.vars.hand}, taken with the ${th.vars.ship}. ${th.vars.hand} came home two days later.`, { news: [th.sid] });
      return { lines: ['You... you\'d do that? For us? I\'ll send it with the next boat that\'ll go near them. Thank you. Thank you.'], close: true };
    }
    if (id === 'tid_cove') {
      if (t) S.accept(t, R.pl(pid));
      S.touch(th, pid);
      return { lines: [`${th.vars.cove}. Nobody who sails there comes back the same. If you mean it... find the ship that holds ${th.vars.hand}. Please.`, '(Beat the pirates of the cove, and the captives are freed.)'], close: true };
    }
    return null;
  },
});

// ------------------------------------------------------------ the drowned
motif({
  id: 'drowned_stone',
  family: 'troubles',
  max: 2,
  key: (o) => `drowned:${o.sid}`,
  title: (th) => `A Stone for the ${th.vars.ship}`,
  seeds: [{ on: 'sea_fight', make: (ev, S) => (layoutOf(S, ev.sid) ? { cast: { town: R.town(ev.sid) }, sid: ev.sid, vars: { ship: ev.ship, winner: ev.winner, off: ev.off } } : null) }],
  nodes: {
    mourning: {
      enter(th, S) {
        const L = layoutOf(S, th.sid);
        if (!L) return S.end(th, 'faded');
        const rng = S.rng(th, 0xd70);
        const m = mayorOf(L);
        S.note(th, `The ${th.vars.ship} went down fighting the ${th.vars.winner}${th.vars.off ? ` off ${th.vars.off}` : ''}. ${L.settlement.name} has lost sons and daughters to the sea.`, { news: [th.sid] });
        const t = S.post(th, {
          role: 'stone', kind: 'fetch', title: `Bring stone for the ${th.vars.ship}'s memorial in ${L.settlement.name}`, sid: th.sid, giver: m ? R.rec(th.sid, m.idx) : null, item: 'stone_bricks', n: 12,
          pitch: say(rng, ['We\'ll raise a stone by the harbour, with every name of the {s}\'s crew on it. The mason\'s willing. We need the dressed stone: twelve blocks of it.', 'They\'ve no graves. The sea has them. The least we can do is a stone by the water, where their families can stand. Twelve blocks of dressed stone.'], { s: th.vars.ship }),
          reward: { coins: 30, from: R.town(th.sid), rep: 15, renown: th.sid, renownPts: 4, renownWhy: `the ${th.vars.ship}'s memorial`, fame: 1 },
        });
        t.rumour = `${L.settlement.name} wants stone for a memorial to the ${th.vars.ship}`;
      },
      fade: 12,
    },
  },
  tasks: {
    stone: {
      done(th, t, by, S) {
        S.end(th, 'raised', `A stone stands by ${townName(S, th.sid)}'s harbour now, carved with the names of the ${th.vars.ship}'s crew. There are flowers on it most mornings.`, { news: [th.sid] });
      },
      thanks: () => ['It\'ll stand as long as the harbour does. Thank you.'],
    },
  },
});

// ------------------------------------------------------------ an army ashore
motif({
  id: 'army_ashore',
  family: 'realm',
  max: 3,
  key: (o) => `ashore:${o.sid}:${o.vars.raid}`,
  title: (th, S) => `The ${th.vars.foe} Ashore near ${townName(S, th.sid)}`,
  seeds: [{ on: 'troops_landed', make: (ev, S) => (layoutOf(S, ev.sid) ? { cast: { town: R.town(ev.sid) }, sid: ev.sid, vars: { raid: ev.raid, ship: ev.ship, foe: ev.foe } } : null) }],
  nodes: {
    muster: {
      enter(th, S) {
        const L = layoutOf(S, th.sid);
        if (!L) return S.end(th, 'faded');
        const rng = S.rng(th, 0xa5e);
        const g = guardOf(L);
        S.note(th, `The ${th.vars.ship} has put soldiers of the ${th.vars.foe} ashore. They'll come for ${L.settlement.name} after dark.`, { news: [th.sid] });
        const t = S.post(th, {
          role: 'hold', kind: 'defend', title: `Stand with ${L.settlement.name}'s watch when the ${th.vars.foe} come`, sid: th.sid, giver: g ? R.rec(th.sid, g.idx) : null,
          pitch: say(rng, ['A troopship, in plain sight, and they walked ashore like they own the place. They\'ll come tonight. I\'ve got {n} on the watch and a lot of frightened farmers. Will you stand with us?', 'Soldiers, not bandits. Drilled, armed, paid. We\'ll be lucky to hold the square. A blade like yours could tip it.'], { n: 2 + rng.int(1, 4) }),
          reward: { coins: 40, from: R.town(th.sid), rep: 20, renown: th.sid, renownPts: 5, renownWhy: `holding the town against the ${th.vars.foe}`, fame: 2 },
        });
        t.offerLabel = 'The whole town\'s on edge. What\'s happening?';
      },
      on: {
        war_raid(th, ev, S) {
          if (ev.sid !== th.sid || ev.raid !== th.vars.raid) return;
          const t = S.tasksOf(th, 'hold')[0];
          if (ev.won) {
            if (t) S.closeTask(t, 'failed');
            return S.end(th, 'sacked', `The soldiers of the ${th.vars.foe} broke into ${townName(S, th.sid)} and carried off ¤${ev.loot}.`, { news: [th.sid] });
          }
          // (Those who said they'd stand, and were there.)
          const L = layoutOf(S, th.sid);
          const m = L ? townMid(L.settlement) : null;
          if (t && m) {
            for (const c of t.claims) {
              if (c.who.t !== 'pl') continue;
              const here = S.players().find((q) => q.pid === c.who.pid && Math.hypot(q.p.x - m.x, q.p.z - m.z) < 80);
              if (here) {
                S.complete(t, c.who);
                break;
              }
            }
          }
          S.end(th, 'held', `${townName(S, th.sid)} held. The ${th.vars.foe}'s soldiers were driven back to the shore.`, { news: [th.sid] });
        },
      },
      fade: 4,
    },
  },
  tasks: { hold: { thanks: () => ['We held. We HELD. Drinks are on the watch tonight.'] } },
});

// ------------------------------------------------------------ sore losers
motif({
  id: 'sore_loser',
  family: 'intrigue',
  max: 2,
  key: (o) => `sore:${o.sid}`,
  title: (th) => `${th.names.loser} Won't Let It Lie`,
  seeds: [{ on: 'cause_decided', make: (ev, S) => {
    const L = layoutOf(S, ev.sid);
    if (!L || ev.loser === null || ev.loser === undefined) return null;
    const r = L.npcs.find((q) => q.idx === ev.loser);
    // (Only the hot-headed, or a close vote.)
    if (!r || !alive(r) || (nat(r, 'temper') < 0.55 && ev.margin > 2)) return null;
    return { cast: { loser: R.rec(ev.sid, r.idx), town: R.town(ev.sid) }, sid: ev.sid, vars: { what: ev.what, mayor: ev.kind === 'mayor' } };
  } }],
  nodes: {
    sulking: {
      enter(th, S) {
        const L = layoutOf(S, th.sid);
        const r = recOf(S, th.cast.loser);
        if (!L || !r) return S.end(th, 'faded');
        const rng = S.rng(th, 0x50e);
        th.vars.due = S.day + rng.int(3, 5);
        S.note(th, `${th.names.loser} lost the vote (${th.vars.what}), and says it was rigged. ${pick(rng, ['They\'re telling anyone who\'ll listen.', 'Some of their side agree.', 'They\'ve been seen packing.'])}`, { news: [th.sid] });
        const t = S.post(th, {
          role: 'mend', kind: 'talk', title: `Talk ${first(r)} round before they leave ${L.settlement.name}`, sid: th.sid, giver: th.cast.loser,
          pitch: say(rng, ['Rigged. Bought. You saw the coin going round. I\'ve given this town twenty years and it does THIS?', 'I won\'t live under it. I won\'t. There are other towns.'], {}),
          reward: { coins: 0, rep: 15, renown: th.sid, renownPts: 2, renownWhy: `keeping the peace after the vote`, fame: 1 },
        });
        t.offerLabel = 'You look like you want to hit someone.';
      },
      day(th, S, rng) {
        const L = layoutOf(S, th.sid);
        const r = recOf(S, th.cast.loser);
        if (!L || !r || !alive(r)) return S.end(th, 'faded');
        if (S.day < th.vars.due) return;
        const t = S.tasksOf(th, 'mend')[0];
        if (t) S.closeTask(t, 'failed');
        if (rng.chance(nat(r, 'temper') * 0.8)) {
          const others = laidTowns(S).filter((T) => T !== L && T.settlement.civ === L.settlement.civ && !T.settlement.deserted);
          if (others.length) {
            const T = pick(rng, others);
            relocate(S.sim, L, [r], T, 'after losing the vote');
            return S.end(th, 'left', `${th.names.loser} packed up and left ${L.settlement.name} for ${T.settlement.name}, still swearing the vote was bought.`, { news: [th.sid] });
          }
        }
        S.end(th, 'grumbled', `${th.names.loser} stayed in ${L.settlement.name}, but doesn't speak to half the town.`, { news: [th.sid] });
      },
      fade: 8,
    },
  },
  tasks: { mend: {} },
  townTalk(th, npc, pid, S) {
    if (!isRec(npc, th.cast.loser) || !S.tasksOf(th, 'mend')[0]) return [];
    return [
      { id: 'sor_next', arg: tid(th), label: 'You lost one vote. Win the next one: stay and argue it again.' },
      { id: 'sor_fair', arg: tid(th), label: 'It was fair. The town decided. Let it go.' },
    ];
  },
  respond(th, npc, pid, id, arg, S) {
    const rng = S.rng(th, 0x50f);
    const r = recOf(S, th.cast.loser);
    const t = S.tasksOf(th, 'mend')[0];
    if (id !== 'sor_next' && id !== 'sor_fair') return null;
    S.touch(th, pid);
    // (Hope works better on the hot-headed than being told off.)
    const base = id === 'sor_next' ? 0.55 : 0.25;
    if (persuade(S, npc, rng, base, nat(r, 'temper') * 0.3)) {
      if (t) S.complete(t, R.pl(pid));
      S.end(th, 'stayed', `${nameOf(S, R.pl(pid))} talked ${th.names.loser} round. They're staying in ${townName(S, th.sid)}${id === 'sor_next' ? ', and already planning the next vote' : ''}.`, { news: [th.sid] });
      return { lines: [id === 'sor_next' ? '...The next one. Yes. They won\'t see me coming.' : '...Maybe. Maybe I\'m just tired. I\'ll unpack. For now.'], close: true };
    }
    return { lines: [pick(rng, ['Easy for you to say. You don\'t live here.', 'Don\'t tell me what\'s fair.', 'Go away.'])] };
  },
});

// ------------------------------------------------------------ raised from your plans
motif({
  id: 'built_from_plans',
  family: 'people',
  max: 3,
  key: (o) => `plans:${o.sid}`,
  title: (th, S) => `Plans Admired in ${townName(S, th.sid)}`,
  seeds: [{ on: 'plan_built', make: (ev, S) => {
    const L = layoutOf(S, ev.sid);
    if (!L || Math.random() < 0.4) return null;
    const r = someoneIn(L, { next: Math.random }, (q) => q.job !== 'guard');
    return r ? { cast: { fan: R.rec(ev.sid, r.idx), town: R.town(ev.sid) }, sid: ev.sid, vars: { label: ev.label } } : null;
  } }],
  nodes: {
    admiring: {
      enter(th, S) {
        const r = recOf(S, th.cast.fan);
        if (!r) return S.end(th, 'faded');
        const rng = S.rng(th, 0xb1d);
        S.note(th, `${th.names.fan} can't stop looking at ${th.vars.label}, new-built in ${townName(S, th.sid)}.`);
        const t = S.post(th, {
          role: 'sheet', kind: 'fetch', title: `Bring ${first(r)} a blank blueprint`, sid: th.sid, giver: th.cast.fan, item: 'blueprint', n: 1,
          pitch: say(rng, ['Did you draw that? I walk past it twice a day just to look. If I had a proper sheet, a blueprint, I\'d draw my own. Would you bring me one?', 'My house leaks, leans and smells of goat. Yours... I mean, that one... it\'s beautiful. Bring me a blank blueprint and I\'ll start over.'], {}),
          reward: { coins: 25, from: th.cast.fan, rep: 10, fame: 1 },
        });
        t.offerLabel = 'You keep staring at that new building.';
      },
      fade: 10,
    },
  },
  tasks: { sheet: { done(th, t, by, S) {
    S.end(th, 'drawing', `${th.names.fan} has been up every night with a candle and a ruler, drawing a house.`);
  }, thanks: () => ['A real blueprint! I\'ll start tonight.'] } },
});

// ------------------------------------------------------------ a raider's bounty
motif({
  id: 'raider_bounty',
  family: 'threats',
  max: 2,
  key: (o) => `raider:${o.vars.ship}`,
  title: (th) => `A Bounty on the ${th.vars.name.replace(/^The /, '')}`,
  seeds: [{ on: 'pirate_seen', make: (ev, S) => (layoutOf(S, ev.sid) ? { cast: { town: R.town(ev.sid) }, sid: ev.sid, vars: { ship: ev.ship, name: ev.name } } : null) }],
  nodes: {
    posted: {
      enter(th, S) {
        const L = layoutOf(S, th.sid);
        if (!L) return S.end(th, 'faded');
        const rng = S.rng(th, 0xb07);
        const m = mayorOf(L);
        th.vars.pay = 100 + rng.int(0, 6) * 10;
        S.note(th, `${th.vars.name}, under black colours, has been seen off the coast near ${L.settlement.name}.`, { news: [th.sid] });
        const t = S.post(th, {
          role: 'hunt', kind: 'talk', title: `Take or sink the pirate ship ${th.vars.name.replace(/^The /, '')}`, sid: th.sid, giver: m ? R.rec(th.sid, m.idx) : null,
          pitch: say(rng, ['{n} has been sighted off our coast. No ship sails while she\'s out there. ¤{p} to whoever takes her or puts her on the bottom.', 'Black sails, in sight of the harbour. The merchants won\'t put out. The town will pay ¤{p} for {n}, taken or sunk.'], { n: th.vars.name, p: th.vars.pay }),
          reward: { coins: th.vars.pay, from: R.town(th.sid), rep: 15, renown: th.sid, renownPts: 4, renownWhy: `dealing with ${th.vars.name}`, fame: 2 },
        });
        t.rumour = `${L.settlement.name} pays a bounty on the pirate ${th.vars.name}`;
      },
      on: {
        pirates_beaten(th, ev, S) {
          if (ev.ship !== th.vars.ship) return;
          const t = S.tasksOf(th, 'hunt')[0];
          if (t && ev.pid) S.complete(t, R.pl(ev.pid));
          S.end(th, 'taken', `${th.vars.name} was taken${ev.pid ? ` by ${nameOf(S, R.pl(ev.pid))}` : ''}. The harbour's open again.`, { news: [th.sid] });
        },
      },
      day(th, S) {
        // (Sunk by anyone, or gone: she's not on the sea any more.)
        const sh = (S.game.ships3d || []).find((q) => q.id === th.vars.ship);
        if (!sh || sh.sinking) {
          const t = S.tasksOf(th, 'hunt')[0];
          if (t) S.closeTask(t, 'done');
          S.end(th, 'gone', `${th.vars.name} hasn't been seen again. Some say she went down; some say she's only waiting.`, { news: [th.sid] });
        }
      },
      fade: 6,
    },
  },
  tasks: { hunt: { thanks: (th) => [`${th.vars.name}, finished. The harbour owes you, and pays its debts.`] } },
});

