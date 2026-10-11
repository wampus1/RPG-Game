// (Round 83) Help wanted: the odd jobs a town's people pin to the notice
// board (its Work page), a few new each day in the towns near you. The
// director has the say in them (see director.js workPlan): after hard days
// mostly the everyday (stock run low, herbs to gather, a hand lost
// somewhere), when it's been quiet a while more of the risky (things
// prowling round the walls at night, the roads to be cleared); and what's
// put up is what isn't up there already, so the board's never one letter
// after another.
//   Each is a story of its own (a small one, not kept in the chronicle
// unless you had a hand in it): its one task, and it's over when that's
// done or the time runs out.
import { motif, R, nameOf } from '../core.js';
import { pick, say, layoutOf, laidTowns, townMid, adults, fullName, biomeAt, townName, spotNear, directions } from './lib.js';
import { mayorOf } from '../../econ.js';
import { ITEMS } from '../../../world/items.js';

// What each trade runs short of: [item, how many, why (said by them)].
const SUPPLY = {
  blacksmith: [['coal', 8, 'The forge eats coal faster than I can buy it.'], ['iron_ore', 5, 'I\'ve orders for three blades and iron for none.']],
  carpenter: [['planks', 14, 'A roof to mend and not a board left in the shop.'], ['stick', 16, 'Handles, pegs, chair legs: I\'m out of good straight sticks.']],
  builder: [['cobblestone', 20, 'The new wall won\'t lay itself, and the quarry cart\'s late.'], ['planks', 16, 'Scaffolding. Lots of it.']],
  laborer: [['cobblestone', 16, 'The road out east has holes you could lose a cart in.'], ['clay', 8, 'Daub for the walls before the rains.']],
  baker: [['wheat', 8, 'Flour for the morning loaves, and the mill\'s been slow.'], ['berries', 6, 'Berry tarts sell out by noon. If only I had berries.']],
  cook: [['raw_meat', 4, 'The pot\'s been thin all week.'], ['fish', 4, 'Fish stew tonight. In theory.'], ['mushroom', 5, 'A good mushroom changes a stew.']],
  innkeeper: [['raw_meat', 4, 'Travellers want meat, and I\'ve only bread to give them.'], ['apple', 6, 'Cider. The barrel\'s nearly dry.']],
  barkeep: [['wheat', 8, 'No grain, no ale. No ale, no customers.'], ['apple', 6, 'For the cider press.']],
  tailor: [['string', 5, 'A wedding dress, a funeral coat, and no thread for either.'], ['leather', 3, 'Boots for the watch: all their soles are through.']],
  herbalist: [['herb', 4, 'Half the town has a cough and I\'ve nothing left to steep.'], ['mushroom', 5, 'The pale caps from the woods, for a salve.'], ['flower_blue', 3, 'Blue petals calm a fever. I need fresh ones.']],
  fisher: [['string', 4, 'Two nets torn on the rocks in a week.'], ['reeds', 8, 'New traps, for eels.']],
  trapper: [['string', 3, 'Snares need line.'], ['arrow', 12, 'Out of arrows and the deer know it.']],
  scholar: [['feather', 6, 'Quills. I wear them down to stubs.'], ['book', 1, 'Anything written: I\'ll read it, whatever it is.']],
  priest: [['flower_white', 4, 'White flowers for the altar on the rest day.'], ['torch', 6, 'The shrine\'s dark at night. It shouldn\'t be.']],
  farmer: [['bone', 5, 'Ground bone for the fields: the soil\'s tired.'], ['seeds', 8, 'A bad sowing. I need more seed.']],
  miner: [['torch', 8, 'Dark down there, and the oil\'s run out.'], ['planks', 10, 'Props for the new shaft before it comes down.']],
  lumberjack: [['bread', 3, 'The crew works better fed, and I\'ve forgotten the bread again.']],
  glassblower: [['sand', 12, 'Sand for the furnace, clean and pale.']],
  miller: [['wheat', 10, 'The stones are idle. Bring grain and they\'ll turn.']],
  merchant: [['leather', 4, 'A buyer up the coast wants hides.'], ['gem', 1, 'One good stone and I\'ve a sale made.']],
};

// The kinds of job, how risky (for the director), and how they're made.
const KINDS = ['supply', 'gather', 'watch', 'clear', 'lost', 'parcel'];
const RISKY = { watch: true, clear: true };

const LOST = [
  ['their good hammer', 'I set it down to eat and the crows had me looking the other way.'],
  ['a ring their mother left them', 'It came off when I was washing at the stream. I looked for an hour.'],
  ['the key to the storeroom', 'It was on a string round my neck. Then it wasn\'t.'],
  ['a satchel of letters', 'The strap broke when I was crossing the fields. Everything I was carrying for the week.'],
  ['their pipe', 'My father\'s. Carved bone. I\'d be lost without it.'],
  ['a goat\'s bell', 'The bell came off the old nanny out in the scrub. She won\'t come home without it, the vain thing.'],
];

const GOODS = ['a crate of preserves', 'a bolt of cloth', 'a sack of seed', 'a box of candles', 'a bundle of tools', 'a jar of honey', 'a sealed ledger'];

function holds(item) {
  return !!ITEMS[item];
}

// The open jobs up in a town now: their kinds.
function upIn(S, sid) {
  return S.tasksIn(sid).filter((t) => S.thread(t.th)?.m === 'help_wanted').map((t) => S.thread(t.th).vars.kind);
}

// A job for town L of kind `k` (null if the town hasn't the people or the
// need for it): the story's start.
function make(S, L, k, rng) {
  const sid = L.settlement.id;
  const ppl = adults(L).filter((r) => !r.visitor);
  if (!ppl.length) return null;
  const m = townMid(L.settlement);
  const busy = new Set(S.tasksIn(sid).filter((t) => t.giver && t.giver.t === 'rec').map((t) => t.giver.idx));
  const free = (r) => !busy.has(r.idx);
  if (k === 'supply' || k === 'gather') {
    const gatherJobs = ['herbalist', 'cook', 'baker', 'priest', 'innkeeper', 'fisher', 'trapper'];
    const who = rng.shuffle(ppl.filter((r) => free(r) && SUPPLY[r.job] && (k === 'gather' ? gatherJobs.includes(r.job) : !gatherJobs.includes(r.job) || rng.chance(0.3))));
    for (const r of who) {
      const opts = SUPPLY[r.job].filter(([it]) => holds(it));
      if (!opts.length) continue;
      const [item, n, why] = pick(rng, opts);
      return { kind: k, giver: r.idx, item, n, why };
    }
    // (A town short of stone or timber for something it's building: the
    // council asks.)
    const e = L.econ;
    const mayor = mayorOf(L);
    if (k === 'supply' && e && e.short && mayor && free(mayor)) return { kind: k, giver: mayor.idx, item: rng.chance(0.5) ? 'planks' : 'cobblestone', n: 20, why: 'The town\'s stores are short for the work going up.', town: true };
    return null;
  }
  if (k === 'watch') {
    const g = pick(rng, ppl.filter((r) => free(r) && r.job === 'guard')) || mayorOf(L);
    if (!g || !free(g)) return null;
    return { kind: k, giver: g.idx, n: rng.int(3, 6) };
  }
  if (k === 'clear') {
    const g = pick(rng, ppl.filter((r) => free(r) && ['farmer', 'lumberjack', 'trapper', 'fisher', 'miner', 'herbalist'].includes(r.job)));
    if (!g) return null;
    return { kind: k, giver: g.idx, n: rng.int(2, 4) };
  }
  if (k === 'lost') {
    const g = pick(rng, ppl.filter(free));
    if (!g || !m) return null;
    const at = spotNear(S, m.x, m.z, 24, 70, rng, { clear: 6 });
    if (!at) return null;
    const [thing, why] = pick(rng, LOST);
    return { kind: k, giver: g.idx, at, thing, why };
  }
  if (k === 'parcel') {
    const g = pick(rng, ppl.filter((r) => free(r) && ['merchant', 'tailor', 'baker', 'blacksmith', 'carpenter', 'herbalist', 'innkeeper', 'miller'].includes(r.job)));
    if (!g) return null;
    // To someone in another town near (or across this one).
    const others = laidTowns(S).filter((T) => T !== L && T.settlement && Math.hypot(townMid(T.settlement).x - m.x, townMid(T.settlement).z - m.z) < 420);
    const T = others.length && rng.chance(0.7) ? pick(rng, others) : L;
    const to = pick(rng, adults(T).filter((r) => !r.visitor && !(T === L && r.idx === g.idx)));
    if (!to) return null;
    return { kind: k, giver: g.idx, toSid: T.settlement.id, to: to.idx, goods: pick(rng, GOODS) };
  }
  return null;
}

// (The pay: a fair day's coin for what it is.)
function payFor(o) {
  if (o.kind === 'supply' || o.kind === 'gather') {
    const v = (ITEMS[o.item] && ITEMS[o.item].value) || 2;
    return Math.max(5, Math.round(v * o.n * 1.4 + 4));
  }
  if (o.kind === 'watch') return 6 + o.n * 4;
  if (o.kind === 'clear') return 5 + o.n * 4;
  if (o.kind === 'lost') return 8;
  return o.toSid === undefined ? 6 : 14;
}

motif({
  id: 'help_wanted',
  family: 'work',
  tone: 'neutral',
  // (Its own each day: not counted against the stories the director lets
  // start; see core.js newDay.)
  daily: true,
  hidden: true,
  max: 40,
  key: (o) => `${o.sid}:${o.vars.kind}:${o.vars.giver}`,
  title: (th) => th.vars.title || 'Help wanted',
  scan(S, rng) {
    const plan = S.director.workPlan ? S.director.workPlan(rng) : { n: 2, risky: 0.35 };
    const out = [];
    const near = laidTowns(S).filter((L) => S.players().some(({ p }) => {
      const m = townMid(L.settlement);
      return m && Math.hypot(p.x - m.x, p.z - m.z) < 260;
    }));
    for (const L of near) {
      const sid = L.settlement.id;
      const up = upIn(S, sid);
      let want = Math.max(0, plan.n - Math.floor(up.length / 2));
      if (up.length >= 5) want = 0;
      // The kinds not up there yet first; the risky ones as the director
      // has them.
      const order = rng.shuffle([...KINDS]).sort((a, b) => (up.includes(a) ? 1 : 0) - (up.includes(b) ? 1 : 0));
      for (const k of order) {
        if (want <= 0) break;
        if (RISKY[k] && !rng.chance(plan.risky)) continue;
        if (!RISKY[k] && rng.chance(plan.risky * 0.4)) continue;
        const o = make(S, L, k, rng);
        if (!o) continue;
        want--;
        out.push({ cast: { town: R.town(sid), giver: R.rec(sid, o.giver) }, sid, vars: { ...o } });
      }
    }
    return out;
  },
  nodes: {
    posted: {
      enter(th, S) {
        const L = layoutOf(S, th.sid);
        const v = th.vars;
        const g = L && L.npcs[v.giver];
        if (!L || !g) return S.end(th, 'faded');
        const rng = S.rng(th, 0x40b);
        const first = g.name.first;
        const pay = payFor(v);
        const from = v.town ? R.town(th.sid) : th.cast.giver;
        const tn = townName(S, th.sid);
        let o = null;
        if (v.kind === 'supply' || v.kind === 'gather') {
          const nm = ITEMS[v.item] ? ITEMS[v.item].name.toLowerCase() : v.item;
          v.title = v.kind === 'gather' ? `Gather ${nm} for ${first} (${v.n})` : `${first} needs ${nm} (${v.n})`;
          o = { role: 'job', kind: 'fetch', item: v.item, n: v.n, need: v.n, pitch: `${v.why} ${say(rng, ['{n} {it} and I\'ll pay ¤{c}.', 'Bring me {n} {it}? ¤{c}, and my thanks.', '{n} {it}, and there\'s ¤{c} in it for you.'], { n: v.n, it: nm, c: pay })}` };
        } else if (v.kind === 'watch') {
          v.title = `Thin out what prowls round ${tn} after dark (${v.n})`;
          const m = townMid(L.settlement);
          o = { role: 'job', kind: 'slay', at: m, r: 90, need: v.n, data: { hostile: true }, pitch: say(rng, ['Things come up to the walls at night. Bold, lately. Put {n} of them down and the watch will see you right: ¤{c}.', 'We lost a dog last night and nearly a shepherd. {n} of whatever\'s out there, gone, and ¤{c} from the watch\'s purse.'], { n: v.n, c: pay }) };
        } else if (v.kind === 'clear') {
          const m = townMid(L.settlement);
          const b = biomeAt(S, m.x, m.z) || 'plains';
          const what = /desert|mesa|salt|savanna/.test(b) ? 'snakes and worse in the scrub' : /swamp|mangrove|bog/.test(b) ? 'things crawling out of the bog' : /taiga|tundra|snow/.test(b) ? 'wolves come down off the ridge' : 'beasts in the fields and woods';
          v.title = `Clear the ${what} from round ${tn} (${v.n})`;
          o = { role: 'job', kind: 'slay', at: m, r: 110, need: v.n, data: { hostile: true }, pitch: say(rng, ['I can\'t work with {w} watching me. {n} of them seen to, and ¤{c} is yours.', 'Three days now I\'ve not dared go out to the far end. {w}. {n} fewer of them, please, and ¤{c}.'], { w: what, n: v.n, c: pay }) };
        } else if (v.kind === 'lost') {
          const where = directions(L.settlement, v.at.x, v.at.z);
          v.title = `Find ${first}'s lost ${v.thing.replace(/^(their|a|an|the) /, '')} (${where})`;
          o = { role: 'lost', kind: 'find', at: v.at, r: 4, pitch: `${v.why} ${say(rng, ['It\'ll be somewhere {d}. ¤{c} if you find it.', 'Out {d}, I think. Bring it back and there\'s ¤{c} in it.'], { d: where, c: pay })}` };
        } else if (v.kind === 'parcel') {
          const T = layoutOf(S, v.toSid);
          const to = T && T.npcs[v.to];
          if (!to) return S.end(th, 'faded');
          th.cast.to = R.rec(v.toSid, v.to);
          const there = v.toSid === th.sid ? '' : ` in ${townName(S, v.toSid)}`;
          v.title = `Carry ${v.goods} from ${first} to ${to.name.first}${there}`;
          o = { role: 'parcel', kind: 'deliver', target: th.cast.to, item: 'crate', n: 1, pitch: say(rng, ['{g} for {to}{t}. Paid for, packed, and no one to take it. ¤{c} when it\'s there.', '{to}{t} is waiting on {g}. I can\'t leave the shop. ¤{c}?'], { g: v.goods.replace(/^a /, 'A '), to: fullName(to), t: there, c: pay }) };
        }
        if (!o) return S.end(th, 'faded');
        const t = S.post(th, {
          ...o, title: v.title, sid: th.sid, giver: th.cast.giver, days: v.kind === 'parcel' ? 4 : 3,
          reward: { coins: pay, from, rep: 6, fame: 0.2 }, hand: o.kind === 'deliver' ? 'auto' : 'giver',
        });
        t.offerLabel = pick(rng, ['I saw your note on the board.', 'About the job on the board...', 'Still need a hand?']);
      },
      day(th, S) {
        if (!S.tasksOf(th).length && !th.tasks.some((t) => t.status === 'won')) S.end(th, th.tasks.some((t) => t.status === 'done') ? 'done' : 'lapsed');
      },
      fade: 6,
    },
  },
  tasks: {
    job: {
      // (Round 85) The hunting jobs, plainly (the rest say themselves).
      how: (th, t, S) => {
        const v = th.vars;
        if (v.kind === 'watch') return `Kill ${t.need} hostile creatures near ${townName(S, th.sid)} at night (within about ninety paces of the middle of town). So far: ${Math.min(t.count, t.need)}.`;
        if (v.kind === 'clear') return `Kill ${t.need} hostile creatures in the fields and woods around ${townName(S, th.sid)}. So far: ${Math.min(t.count, t.need)}.`;
        return null;
      },
      done(th, t, by, S) {
        S.end(th, 'done', `${nameOf(S, by)} saw to it: ${t.title.toLowerCase()}.`);
      },
      thanks: () => ['That\'s the job done. Thank you.', 'Just what I needed. Here.', 'You\'ve saved my week.'],
      lapsed(th, t, S) {
        S.end(th, 'lapsed');
      },
    },
    lost: {
      how: (th, t, S) => `Search the place marked on your map for ${th.vars.thing.replace(/^their /, `${nameOf(S, th.cast.giver)}'s `)}, and bring it back to ${nameOf(S, th.cast.giver)} in ${townName(S, th.sid)}.`,
      reach(th, t, pid, S) {
        S.tell(pid, `You find it, half hidden in the grass: ${th.vars.thing.replace(/^their /, `${nameOf(S, th.cast.giver)}'s `)}.`, '#e8e0a0');
        S.complete(t, R.pl(pid));
      },
      done(th, t, by, S) {
        if (t.status === 'done') S.end(th, 'done');
      },
      thanks: () => ['You found it! Oh, you found it.', 'I\'d given up. Thank you.'],
    },
    parcel: {
      accepted(th, t, who, S) {
        if (who.t === 'pl') S.give(who.pid, 'crate', 1);
      },
      done(th, t, by, S) {
        S.end(th, 'done', `${nameOf(S, by)} carried it there.`);
      },
      thanks: () => ['At last! Thank you.'],
    },
  },
});
