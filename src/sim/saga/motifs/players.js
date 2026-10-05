// What happens between those playing (round 52).
//
// A contract: a band with a grudge, a widow who wants blood, a realm that
// wants a deserter, puts a price on someone playing. Hired blades go after
// them; and anyone else playing can take it up: a messenger finds them
// with the offer, or they ask the town's shady sorts what other work's
// going. Take it, and you may fight the one it names wherever you find
// them (whether the world lets players fight or not); bring them down (or
// alive, if that's the deal) and you're paid. There's no turning a
// contract on you down: only the ones who take it can choose.
//
// A bounty: kill someone in front of witnesses and the town puts a price
// on you; bounty hunters come with orders to drag you back to its jail.
//
// A wager: two who are making a name for themselves are set against each
// other (the first to bring down a dozen of the night's things wins a
// purse and the town's cheers).
//
// The beacons: two fires on two hills, to be lit at once (one of you at
// each): the towns about rest easier while they burn.
import { motif, HOOKS, R, refKey, nameOf, NameOf, isAlive, resolve, pidOf, playerOf, Saga, poss } from '../core.js';
import { layoutOf, town, townName, townMid, directions, spotNear, hours, outInTheOpen, laidTowns } from './lib.js';
import { makePerson } from '../actors.js';
import { mayorOf, DAY } from '../../econ.js';
import { B, META_STATE } from '../../../world/blocks.js';

const tpid = (th) => th.cast.target.pid;

function contractTask(th, S) {
  return S.tasksOf(th, 'contract')[0] || null;
}

// The open contracts `pid` holds against `other`.
function holds(S, pid, other) {
  for (const th of S.live()) {
    if (th.m !== 'contract' && th.m !== 'bounty') continue;
    if (tpid(th) !== other) continue;
    const t = contractTask(th, S);
    if (t && S.claimedBy(t, pid)) return th;
  }
  return null;
}

// Players with a contract between them may fight.
HOOKS.feud.push((S, a, b) => {
  const pa = pidOf(a);
  const pb = pidOf(b);
  return !!(holds(S, pa, pb) || holds(S, pb, pa));
});

// A contract to take someone alive: who they're delivered to.
export function captureFor(S, source, p) {
  const th = holds(S, pidOf(source), pidOf(p));
  if (!th || !th.vars.alive || !th.cast.patron || th.cast.patron.t !== 'band') return null;
  const b = resolve(S, th.cast.patron);
  return b && b.camp ? { band: b.id, th: th.id } : null;
}

// (Bounty hunters drag you to the town's jail.)
HOOKS.subdue.push((S, p, source) => {
  const wb = source && source.warband;
  if (!wb || wb.kind !== 'saga' || !wb.bounty) return false;
  const pid = pidOf(p);
  if (pid !== wb.target) return false;
  p.hp = 1;
  S.asPid(pid, () => {
    S.sim.justice.imprison(wb.bounty, 'knockout');
  });
  S.emit('bounty_taken', { pid, sid: wb.bounty, th: wb.th });
  return true;
});

const SHADY = (r) => (r.life && r.life.vice === 'thief') || r.job === 'beggar' || r.job === 'barkeep';

// ------------------------------------------------------------ a contract
motif({
  id: 'contract',
  family: 'players',
  max: 10,
  key: (o) => `${refKey(o.cast.patron)}>${refKey(o.cast.target)}`,
  title: (th, S) => `A Price on ${nameOf(S, th.cast.target)}'s Head`,
  anchors: (th, S) => {
    const p = playerOf(S.game, tpid(th));
    return p ? [{ x: p.x, z: p.z }] : [];
  },
  nodes: {
    posted: {
      enter(th, S) {
        const pid = tpid(th);
        const name = nameOf(S, th.cast.target);
        // (The money's put by at once, so it's there to be collected.)
        const pay = th.cast.patron.t === 'band' || th.cast.patron.t === 'rec' ? S.pay(th.cast.patron, th.vars.pay || 60) : th.vars.pay || 60;
        if (pay < 15) return S.end(th, 'faded');
        th.vars.pay = pay;
        th.vars.escrow = th.cast.patron.t === 'band' || th.cast.patron.t === 'rec';
        const t = S.post(th, {
          role: 'contract', kind: 'contract', title: th.vars.alive ? `Take ${name} alive (¤${pay})` : `Bring down ${name} (¤${pay})`,
          secret: pid, sid: null, board: false, npc: false, hand: 'auto', target: th.cast.target,
          pitch: `${NameOf(S, th.cast.patron)} will pay ¤${pay} to whoever ${th.vars.alive ? `brings them ${name} alive` : `puts ${name} in the ground`}. ${th.vars.alive ? 'Beat them down and they\'ll be collected.' : ''} Interested?`.trim(),
          reward: { coins: pay, from: th.vars.escrow ? { t: 'purse' } : th.cast.patron, fame: 0, under: 4 },
        });
        t.rumour = `Someone's paying for ${name}'s head`;
        th.vars.until = S.now + 6 * DAY;
        S.note(th, `${NameOf(S, th.cast.patron)} put a price of ¤${pay} on ${name}'s ${th.vars.alive ? 'capture' : 'head'}.`, { hidden: true });
        // Offered to everyone else playing (a go-between finds them).
        th.vars.offered = [];
      },
      hour(th, S, rng) {
        const pid = tpid(th);
        if (S.now > th.vars.until) {
          // (The money goes back where it came from.)
          if (th.vars.escrow) {
            const o = resolve(S, th.cast.patron);
            if (o && th.cast.patron.t === 'band') o.loot = (o.loot || 0) + th.vars.pay;
            else if (o && th.cast.patron.t === 'rec') o.coins = (o.coins || 0) + th.vars.pay;
          }
          return S.end(th, 'lapsed', 'Nobody collected on the contract, and it lapsed.');
        }
        if (!isAlive(S, th.cast.patron)) return S.end(th, 'void', `${NameOf(S, th.cast.patron)} are gone, and their contract with them.`);
        // A go-between finds someone else playing with the offer.
        for (const { pid: o } of S.players()) {
          if (o === pid || th.vars.offered.includes(o) || S.actorSpec(th, `offer:${o}`)) continue;
          const p = playerOf(S.game, o);
          if (!p || !rng.chance(0.25)) continue;
          th.vars.offered.push(o);
          const at = spotNear(S, p.x, p.z, 14, 20, rng, { clear: 0, flat: 0 });
          if (!at) continue;
          S.actor(th, {
            key: `offer:${o}`, kind: 'npc', role: 'broker', talk: true, at,
            person: makePerson(rng, 'vale', 'stranger'),
            orders: { seek: o, markFor: o, mark: 'talk', outlaw: true, hail: 'Psst. You. A word, in private.', patience: 90, ignoredLine: 'Your loss, friend.' },
          });
        }
        // Hired blades go after them, now and then.
        if (!th.vars.blades && outInTheOpen(S, pid) && rng.chance(0.08) && S.now - (S.person(pid).lastHunt || -1e9) > hours(14)) {
          th.vars.blades = true;
          S.person(pid).lastHunt = S.now;
          const p = playerOf(S.game, pid);
          const at = spotNear(S, p.x, p.z, 20, 26, rng, { clear: 0, flat: 0 });
          if (at) {
            for (let i = 0; i < 2; i++) {
              S.actor(th, { key: `blade${i}`, kind: 'npc', role: 'hunter', hostile: true, at: { x: at.x + i, z: at.z }, person: makePerson(rng, 'vale', 'hunter'), orders: { target: pid, capture: !!th.vars.alive && th.cast.patron.t === 'band', cry: `${nameOf(S, th.cast.target)}! Nothing personal.` } });
            }
            S.tell(pid, 'Two strangers on the road behind you. Armed, and not hiding it.', '#ffb080');
          }
        }
      },
      on: {
        player_died(th, ev, S) {
          if (ev.pid !== tpid(th)) return;
          const t = contractTask(th, S);
          if (ev.by && ev.by.t === 'pl' && t && S.claimedBy(t, ev.by.pid)) {
            S.complete(t, ev.by);
            S.tell(ev.pid, `${nameOf(S, ev.by)} took the contract on your head from ${nameOf(S, th.cast.patron)}.`, '#ff9080');
            S.emit('contract_done', { patron: th.cast.patron, target: tpid(th), by: ev.by });
            return S.end(th, 'collected', `${nameOf(S, ev.by)} collected on ${nameOf(S, th.cast.target)}.`, { by: ev.by.pid });
          }
          // (Hired blades of the contract's own.)
          if (ev.byActor && String(ev.byActor).startsWith(`${th.id}:blade`)) S.end(th, 'collected', `Hired blades collected on ${nameOf(S, th.cast.target)}.`);
        },
        captured(th, ev, S) {
          if (ev.pid !== tpid(th)) return;
          const t = contractTask(th, S);
          if (ev.by && ev.by.t === 'pl' && t && S.claimedBy(t, ev.by.pid)) {
            S.complete(t, ev.by);
            S.tell(ev.pid, `${nameOf(S, ev.by)} took you alive, for ${poss(nameOf(S, th.cast.patron))} coin.`, '#ff9080');
            return S.end(th, 'collected', `${nameOf(S, ev.by)} delivered ${nameOf(S, th.cast.target)} to ${nameOf(S, th.cast.patron)}.`, { by: ev.by.pid });
          }
          S.end(th, 'collected');
        },
      },
    },
  },
  hello(th, a, npc, pid) {
    if (a.role === 'broker') return pid === a.orders.seek ? 'Not here. Not so loud. There\'s coin in it for you.' : 'Nothing for you.';
    return '...';
  },
  talk(th, a, npc, pid, S) {
    if (a.role !== 'broker' || pid !== a.orders.seek || th.done) return [];
    const t = contractTask(th, S);
    if (!t || S.claimedBy(t, pid)) return [];
    const tid = `t${th.id}`;
    return [{ id: 'sgk_hear', arg: tid, label: 'Go on.' }];
  },
  respond(th, npc, pid, id, arg, S) {
    const t = contractTask(th, S);
    switch (id) {
      case 'sgk_hear':
        if (!t) return { lines: ['Never mind. It\'s been taken care of.'] };
        S.hear(pid, t);
        return { lines: [t.pitch], choices: [{ id: 'sgk_take', arg: `t${th.id}`, label: 'I\'ll take it.' }, { id: 'sgk_no', arg: `t${th.id}`, label: 'Not my kind of work.' }], back: null };
      case 'sgk_take':
        if (!t) return { lines: ['Too late.'] };
        S.accept(t, R.pl(pid));
        S.dismissActor(th, `offer:${pid}`);
        S.tell(tpid(th), 'You have the feeling someone\'s watching you.', '#c8a0a0');
        return { lines: ['Good. You know where to find them. (You may fight them wherever you meet them.)'], close: true };
      case 'sgk_no': {
        S.dismissActor(th, `offer:${pid}`);
        return { lines: ['Suit yourself. Forget we spoke.'], close: true };
      }
      default:
        return null;
    }
  },
  // The town's shady sorts know what's going.
  townTalk(th, npc, pid, S) {
    if (!npc.rec || !SHADY(npc.rec) || pid === tpid(th)) return [];
    const t = contractTask(th, S);
    if (!t || S.claimedBy(t, pid) || !S.visibleTo(t, pid)) return [];
    return [{ id: 'sgk_hear', arg: `t${th.id}`, label: 'Heard of any... other kind of work?' }];
  },
});

// A band (or anyone) with a grudge puts a price on someone: see bandits.js.
export function priceOn(S, from, patron, pid, pay, alive = false) {
  return S.spawn(from, 'contract', { cast: { patron, target: R.pl(pid) }, vars: { pay, alive } });
}

// ------------------------------------------------------------ a bounty
motif({
  id: 'bounty',
  family: 'players',
  max: 8,
  key: (o) => `${o.sid}>${refKey(o.cast.target)}`,
  title: (th, S) => `Wanted in ${townName(S, th.sid)}: ${nameOf(S, th.cast.target)}`,
  seeds: [
    // A killing seen by the town.
    { on: 'crime', make: (ev, S) => {
      if (ev.type !== 'murder' || !ev.seen || !ev.pid) return null;
      return { cast: { patron: R.town(ev.sid), target: R.pl(ev.pid) }, sid: ev.sid, vars: { victim: ev.victim, pay: 80 }, touched: [ev.pid] };
    } },
  ],
  anchors: (th, S) => {
    const p = playerOf(S.game, tpid(th));
    return p ? [{ x: p.x, z: p.z }] : [];
  },
  nodes: {
    posted: {
      enter(th, S) {
        const name = nameOf(S, th.cast.target);
        const L = layoutOf(S, th.sid);
        const m = L ? mayorOf(L) : null;
        const t = S.post(th, {
          role: 'contract', kind: 'contract', title: `Bring ${name} to justice (¤${th.vars.pay})`, sid: th.sid, giver: m ? R.rec(th.sid, m.idx) : null,
          secret: tpid(th), npc: false, target: th.cast.target, hand: 'auto',
          pitch: `${name} murdered ${th.vars.victim || 'one of ours'} in front of witnesses. The council pays ¤${th.vars.pay} to whoever brings them down.`,
          reward: { coins: th.vars.pay, from: R.town(th.sid), rep: 5, fame: 2, renown: th.sid, renownPts: 3, renownWhy: 'bringing a murderer to justice' },
        });
        t.rumour = `There's a bounty of ¤${th.vars.pay} on ${name}, for murder`;
        S.note(th, `The council of ${townName(S, th.sid)} put a bounty of ¤${th.vars.pay} on ${name} for the murder of ${th.vars.victim || 'a townsperson'}.`, { news: [th.sid] });
        S.tell(tpid(th), `${townName(S, th.sid)} has put a bounty on you. Bounty hunters will come.`, '#ff9080');
        // Every other player hears.
        for (const { pid } of S.players()) if (pid !== tpid(th)) S.hear(pid, t);
        th.vars.until = S.now + 8 * DAY;
      },
      hour(th, S, rng) {
        const pid = tpid(th);
        if (S.now > th.vars.until) return S.end(th, 'lapsed', 'The bounty was forgotten.');
        // Bounty hunters (to bring them back alive, to the cells).
        if (outInTheOpen(S, pid) && rng.chance(0.06) && S.now - (S.person(pid).lastHunt || -1e9) > hours(14)) {
          S.person(pid).lastHunt = S.now;
          const p = playerOf(S.game, pid);
          const at = spotNear(S, p.x, p.z, 20, 26, rng, { clear: 0, flat: 0 });
          if (at) {
            const n = rng.int(1, 2);
            for (let i = 0; i < n; i++) S.actor(th, { key: `hunter${S.now}_${i}`, kind: 'npc', role: 'hunter', hostile: true, at: { x: at.x + i, z: at.z }, person: makePerson(rng, town(S, th.sid)?.style, 'hunter'), orders: { target: pid, bounty: th.sid, cry: `${nameOf(S, th.cast.target)}! By order of the council of ${townName(S, th.sid)}!` } });
            S.tell(pid, 'Bounty hunters on your trail.', '#ffb080');
          }
        }
      },
      on: {
        bounty_taken(th, ev, S) {
          if (ev.pid !== tpid(th) || ev.sid !== th.sid) return;
          S.end(th, 'jailed', `Bounty hunters dragged ${nameOf(S, th.cast.target)} to the cells of ${townName(S, th.sid)}.`, { news: [th.sid] });
        },
        player_died(th, ev, S) {
          if (ev.pid !== tpid(th)) return;
          const t = contractTask(th, S);
          if (ev.by && ev.by.t === 'pl' && t && S.claimedBy(t, ev.by.pid)) {
            S.complete(t, ev.by);
            S.end(th, 'justice', `${nameOf(S, ev.by)} brought ${nameOf(S, th.cast.target)} down for the bounty.`, { news: [th.sid] });
          }
        },
      },
    },
  },
  townTalk(th, npc, pid, S) {
    if (pid === tpid(th) || !npc.rec || npc.rec.job !== 'guard') return [];
    const t = contractTask(th, S);
    if (!t || S.claimedBy(t, pid)) return [];
    return [{ id: 'sgb_take', arg: `t${th.id}`, label: `I'll hunt down ${nameOf(S, th.cast.target)} for the bounty.` }];
  },
  respond(th, npc, pid, id, arg, S) {
    if (id !== 'sgb_take') return null;
    const t = contractTask(th, S);
    if (!t) return { lines: ['It\'s been dealt with.'] };
    S.accept(t, R.pl(pid));
    return { lines: ['Good. Bring them down, and the council pays. (You may fight them wherever you meet them.)'] };
  },
});

// ------------------------------------------------------------ a wager
motif({
  id: 'wager',
  family: 'players',
  max: 2,
  key: (o) => `wager:${o.sid}`,
  title: (th, S) => `The Champions' Wager of ${townName(S, th.sid)}`,
  // Two of you making a name, in the world at once.
  scan(S, rng) {
    const ps = S.players().filter(({ pid }) => S.person(pid).fame >= 6);
    if (ps.length < 2 || !rng.chance(0.15)) return null;
    const towns = laidTowns(S);
    if (!towns.length) return null;
    const L = rng.pick(towns);
    const [a, b] = rng.shuffle(ps.slice()).slice(0, 2);
    return { cast: { town: R.town(L.settlement.id), a: R.pl(a.pid), b: R.pl(b.pid) }, sid: L.settlement.id, touched: [a.pid, b.pid] };
  },
  nodes: {
    on: {
      enter(th, S) {
        const L = layoutOf(S, th.sid);
        const m = L ? mayorOf(L) : null;
        const purse = 60;
        th.vars.need = 12;
        for (const side of ['a', 'b']) {
          const pid = th.cast[side].pid;
          const other = th.cast[side === 'a' ? 'b' : 'a'];
          const t = S.post(th, {
            role: 'race', kind: 'slay', title: `Beat ${nameOf(S, other)}: kill 12 of the night's things first`, only: [pid], npc: false, hand: 'auto',
            need: 12, data: { hostile: true }, giver: m ? R.rec(th.sid, m.idx) : null,
            pitch: `The tavern's talking of nothing else: who's the better, you or ${nameOf(S, other)}? There's a purse of ¤${purse} for whoever brings down twelve of the night's things first.`,
            reward: { coins: purse, from: R.town(th.sid), fame: 4, renown: th.sid, renownPts: 3, renownWhy: 'winning the Champions\' Wager' },
          });
          S.accept(t, R.pl(pid));
          S.tell(pid, `The Champions' Wager of ${townName(S, th.sid)}: you against ${nameOf(S, other)}. Twelve of the night's things, first one wins. (Quest log: O)`, '#ffe070');
        }
        th.vars.until = S.now + 3 * DAY;
      },
      day(th, S) {
        if (S.now > th.vars.until) S.end(th, 'drawn', 'Neither managed it in time. The wager was called off.');
      },
    },
  },
  tasks: {
    race: {
      done(th, t, by, S) {
        for (const o of S.tasksOf(th, 'race')) if (o !== t) S.closeTask(o, 'failed', by);
        const loser = th.cast.a.pid === by.pid ? th.cast.b : th.cast.a;
        S.tell(loser.pid, `${nameOf(S, by)} won the Champions' Wager.`, '#c8c8c8');
        S.person(by.pid).titles.push(`Champion of ${townName(S, th.sid)}`);
        S.end(th, 'won', `${nameOf(S, by)} won the Champions' Wager of ${townName(S, th.sid)}, beating ${nameOf(S, loser)}.`, { news: [th.sid] });
      },
    },
  },
});

// ------------------------------------------------------------ the beacons
motif({
  id: 'beacons',
  family: 'players',
  max: 2,
  key: (o) => `beacons:${o.sid}`,
  title: (th, S) => `The Beacons of ${townName(S, th.sid)}`,
  // Only with two of you about: it takes two.
  scan(S, rng) {
    const ps = S.players();
    if (ps.length < 2 || !rng.chance(0.2)) return null;
    const p = ps[0].p;
    const s = S.game.world.ow.settlementsNear(p.x, p.z)[0];
    if (!s || !layoutOf(S, s.id)) return null;
    const m = townMid(s);
    const a = spotNear(S, m.x, m.z, 50, 80, rng, { clear: 10 });
    const b = a ? spotNear(S, m.x - (a.x - m.x), m.z - (a.z - m.z), 0, 20, rng, { clear: 10 }) : null;
    if (!a || !b) return null;
    return { cast: { town: R.town(s.id) }, sid: s.id, vars: { a, b } };
  },
  anchors: (th) => [th.vars.a, th.vars.b].filter(Boolean),
  nodes: {
    dark: {
      enter(th, S) {
        const L = layoutOf(S, th.sid);
        const m = L ? mayorOf(L) : null;
        for (const side of ['a', 'b']) {
          const at = th.vars[side];
          const y = S.game.world.regionAt(at.x, at.z) ? S.game.world.findStandY(at.x, at.z, 6) : 6;
          th.vars[`y_${side}`] = y > 0 ? y : 6;
          S.sim.setBlocks([[at.x, th.vars[`y_${side}`], at.z, B.brazier, 0]]);
          const t = S.post(th, {
            role: 'beacon', kind: 'meet', title: `Light the ${side === 'a' ? 'first' : 'second'} beacon of ${townName(S, th.sid)}`, sid: th.sid, giver: m ? R.rec(th.sid, m.idx) : null,
            at, r: 3, npc: false, data: { side },
            pitch: `There are two beacons on the hills, ${directions(town(S, th.sid), th.vars.a.x, th.vars.a.z)} and ${directions(town(S, th.sid), th.vars.b.x, th.vars.b.z)}. Lit together, every town for a day's ride sees them, and the raiders keep away. But they must be lit at the same moment, or the signal means nothing. It needs two of you.`,
            reward: { coins: 25, from: R.town(th.sid), fame: 2, renown: th.sid, renownPts: 3, renownWhy: 'lighting the beacons' },
          });
          t.glyph = '*';
        }
      },
      day(th, S) {
        if (S.now - th.nodeAt > 4 * DAY) S.end(th, 'faded');
      },
    },
    lit: {
      enter(th, S) {
        for (const side of ['a', 'b']) {
          const at = th.vars[side];
          S.sim.setBlocks([[at.x, th.vars[`y_${side}`] ?? 6, at.z, B.brazier, META_STATE]]);
        }
        // (Raiders keep off the towns about for a few days.)
        const s = town(S, th.sid);
        for (const o of S.game.world.ow.settlements) {
          if (!s || o.deserted || Math.hypot(o.cx - s.cx, o.cz - s.cz) > 8) continue;
          const L = layoutOf(S, o.id);
          if (L) L.econ.beaconUntil = S.now + 3 * DAY;
        }
        S.note(th, `The beacons of ${townName(S, th.sid)} were lit together. The towns about rest easier.`, { news: [th.sid] });
      },
      final: true,
    },
  },
  tasks: {
    beacon: {
      anyone: true,
      reach(th, t, pid, S) {
        const side = t.data.side;
        if (!S.claimedBy(t, pid)) S.accept(t, R.pl(pid));
        th.vars[`at_${side}`] = { pid, t: S.now };
        const other = th.vars[`at_${side === 'a' ? 'b' : 'a'}`];
        if (other && other.pid !== pid && Math.abs(S.now - other.t) <= 1.5) {
          for (const q of S.tasksOf(th, 'beacon')) S.complete(q, R.pl(q.data.side === side ? pid : other.pid));
          S.go(th, 'lit');
        } else if (!th.vars[`told_${pid}`]) {
          th.vars[`told_${pid}`] = true;
          S.tell(pid, 'The beacon is ready. It must be lit the moment the other one is: wait for whoever\'s at the other hill.', '#ffd890');
        }
      },
    },
  },
});

export { holds };

// (So the cage's hook can ask: see captive.js.)
Saga.prototype.captureFor = function captureForSaga(source, p) {
  return captureFor(this, source, p);
};
