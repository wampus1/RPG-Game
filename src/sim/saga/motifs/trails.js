// (Round 79) Trails: stories that go from town to town, and over the sea.
//
// Something's gone (an heirloom stolen, a letter that never came, an heir
// who left, a cure that's needed), and its trail leads on: to another town
// on the same island first, then over the water to another of the Dagoni
// Islands, and (once the storm wall is down, and ships can cross it) on to
// a town in the far lands. While the storm still stands, nothing crosses
// it, and the trail ends this side of it: the last of it is a port, where
// they tell you the ship it went on was lost in the storm, and what was
// on it washed up along the shore.
//
// Each leg is a few days' going (the ferries and coaches go between the
// towns, and a ship of your own across open water); missed, the trail
// goes cold, and what comes of that is another story (see fallout.js).
// At its end, what's sought can be bought back, talked out of whoever has
// it, or (where they won't be talked round) taken.
import { motif, R, nameOf } from '../core.js';
import { pick, laidTowns, town, adults, persuade, purse, townMid, layoutOf } from './lib.js';
import { removeItem } from '../../../game/inventory.js';
import { REGION_W, REGION_D } from '../../../config.js';

const tid = (th) => `t${th.id}`;
const KINDS = {
  heirloom: { title: 'The {what} Trail', what: ['Silver Locket', 'Old Signet', 'Grandmother\'s Brooch', 'Painted Box'], why: 'was stolen and sold on' },
  letter: { title: 'The Letter That Never Came', what: ['letter'], why: 'went astray on the road' },
  heir: { title: 'The Heir Who Left', what: ['heir'], why: 'left one night without a word' },
  cure: { title: 'A Cure from Far Off', what: ['cure'], why: 'is only to be had far off' },
};

// Where the trail goes, from town `s0`: another town on the same island,
// another island inside the storm, and (with the storm down) a far land.
// While the storm stands, the last leg is a port this side of it.
export function planTrail(S, s0, rng) {
  const ow = S.game.world.ow;
  const live = ow.settlements.filter((s) => !s.deserted && s.condition !== 'abandoned' && s !== s0);
  const d = (a, b) => Math.hypot(a.cx - b.cx, a.cz - b.cz);
  const legs = [];
  const same = live.filter((s) => s.island === s0.island && !s.far).sort((a, b) => d(a, s0) - d(b, s0)).slice(0, 4);
  if (same.length) legs.push(pick(rng, same).id);
  const isles = live.filter((s) => !s.far && s.island !== s0.island && ow.insideStorm((s.cx + 0.5) * REGION_W, (s.cz + 0.5) * REGION_D));
  const prev = legs.length ? ow.settlements[legs[legs.length - 1]] : s0;
  if (isles.length) legs.push(pick(rng, isles.sort((a, b) => d(a, prev) - d(b, prev)).slice(0, 5)).id);
  const wall = !ow.wallDown;
  if (!wall) {
    const far = live.filter((s) => s.far);
    if (far.length) legs.push(pick(rng, far.sort((a, b) => d(a, prev) - d(b, prev)).slice(0, 6)).id);
  }
  return { legs, wall };
}

function legTitle(S, th, i) {
  const s = town(S, th.vars.legs[i]);
  const isle = s && s.island ? S.game.world.ow.island?.(s.island) : null;
  const where = s ? `${s.name}${isle && isle.name && s.island !== th.vars.island0 ? ` (${isle.name})` : ''}` : 'the next town';
  return `Follow the trail to ${where}`;
}

function postLeg(S, th, i) {
  const s = town(S, th.vars.legs[i]);
  if (!s) return null;
  const pid = th.vars.pid;
  const last = i === th.vars.legs.length - 1;
  const t = S.post(th, {
    role: 'leg', kind: 'visit', title: legTitle(S, th, i), sid: th.sid, at: townMid(s), r: 16, days: 6 + i * 4,
    only: pid ? [pid] : null, reward: last ? {} : { fame: 0 }, data: { leg: i },
  });
  t.pitch = th.vars.pitch;
  if (pid) S.accept(t, R.pl(pid));
  return t;
}

// How you'd get there from here, in a word.
function wayThere(S, a, b) {
  if (!a || !b) return '';
  if (b.far) return 'Only a ship crosses that far: one of your own, or passage with a merchantman.';
  if (a.island !== b.island) return 'The ferry from the coast goes over, or take your own boat.';
  return 'The coach road runs there.';
}

motif({
  id: 'trail',
  family: 'trails',
  tone: 'calm',
  max: 3,
  key: (o) => `trail|${o.sid}|${o.vars && o.vars.kind}`,
  title: (th) => th.vars.title || 'A Trail',
  scan(S, rng) {
    if (!rng.chance(0.05)) return null;
    const L = pick(rng, laidTowns(S).filter((q) => !q.settlement.far));
    if (!L) return null;
    return startFrom(S, L, rng);
  },
  seeds: [{
    // (A theft or a smuggling that got away: its trail picked up.)
    on: 'saga_end',
    make(ev, S) {
      if (!['thief', 'smuggle'].includes(ev.m) || !['faded', 'delivered', 'fled'].includes(ev.outcome)) return null;
      const L = layoutOf(S, ev.cast && ev.cast.town ? ev.cast.town.sid : null);
      if (!L) return null;
      const rng = S.rng({ seed: (ev.th * 7919) | 0, steps: 0 }, 0x7a);
      const o = startFrom(S, L, rng, 'heirloom');
      if (o) o.parent = ev.th;
      return o;
    },
  }],
  nodes: {
    asked: {
      enter(th, S) {
        if (th.vars.posted) return;
        th.vars.posted = true;
        const L = layoutOf(S, th.sid);
        const giver = th.cast.giver;
        const t = S.post(th, {
          role: 'ask', kind: 'talk', title: th.vars.title, sid: th.sid, giver, hand: 'auto',
          pitch: th.vars.pitch, reward: { coins: 20 + th.vars.legs.length * 30, from: giver, rep: 10, renown: th.sid, renownPts: 4, renownWhy: 'following a long trail' },
        });
        t.rumour = th.vars.rumour;
        S.note(th, th.vars.rumour + '.', { news: L ? [th.sid] : [] });
      },
      fade: 25,
    },
    following: {
      enter(th, S) {
        postLeg(S, th, th.vars.leg || 0);
      },
      fade: 40,
    },
    end_of_trail: {
      enter(th, S) {
        const s = town(S, th.vars.legs[th.vars.legs.length - 1]);
        S.tell(th.vars.pid, th.vars.wall && !s?.far
          ? `In ${s ? s.name : 'the port'}, the harbourmaster shakes their head: the ship it went on tried the storm, and was lost. But a wreck-picker on the shore has been selling what washed up...`
          : `In ${s ? s.name : 'the far town'}, you find who has it now.`, '#e8d8a8');
      },
      fade: 20,
    },
  },
  tasks: {
    ask: {
      accepted(th, t, who, S) {
        if (who.t !== 'pl') return;
        th.vars.pid = who.pid;
        th.vars.leg = 0;
        const a = town(S, th.sid);
        const b = town(S, th.vars.legs[0]);
        S.tell(who.pid, `The trail starts in ${b ? b.name : 'the next town'}. ${wayThere(S, a, b)}`, '#a0e0ff');
        S.go(th, 'following', `${nameOf(S, who)} took up the trail.`);
      },
    },
    leg: {
      reach(th, t, pid, S) {
        const i = t.data.leg;
        S.closeTask(t, 'done', R.pl(pid));
        const here = town(S, th.vars.legs[i]);
        const next = town(S, th.vars.legs[i + 1]);
        const rng = S.rng(th, 0x1e0 + i);
        if (next) {
          th.vars.leg = i + 1;
          const isle = next.island !== here?.island ? S.game.world.ow.island?.(next.island) : null;
          const line = pick(rng, [
            `In ${here ? here.name : 'town'}, an innkeeper remembers: it went on to ${next.name}${isle && isle.name ? `, over on ${isle.name}` : ''}.`,
            `${here ? here.name : 'Here'}, a dockhand says it went to ${next.name}${next.far ? ', across the sea' : ''}.`,
            `A pedlar in ${here ? here.name : 'town'} sold it on: to someone bound for ${next.name}.`,
          ]);
          S.note(th, line, { by: pid });
          S.tell(pid, `${line} ${wayThere(S, here, next)}`, '#a0e0ff');
          postLeg(S, th, i + 1);
        } else {
          S.note(th, `The trail ends in ${here ? here.name : 'a far town'}.`, { by: pid });
          S.go(th, 'end_of_trail');
        }
      },
      lapsed(th) {
        th.vars.cold = true;
      },
    },
  },
  townTalk(th, npc, pid, S) {
    if (th.node !== 'end_of_trail' || pid !== th.vars.pid || !npc.rec) return [];
    const s = town(S, th.vars.legs[th.vars.legs.length - 1]);
    if (!s || (npc.rec.sid ?? npc.settlement?.id) !== s.id || npc.rec.age === 'child') return [];
    if (th.vars.holder !== undefined && th.vars.holder !== npc.rec.idx) return [];
    if (th.vars.holder === undefined && !['merchant', 'trader', 'innkeeper', 'fisher', 'smith', 'farmer'].includes(npc.rec.job) && !(th.vars.asked > 2)) {
      return [{ id: 'sgt_ask', arg: tid(th), label: `I'm looking for ${th.vars.whatThe}.` }];
    }
    return [
      { id: 'sgt_buy', arg: tid(th), label: `I'll buy ${th.vars.whatThe} back. (¤${th.vars.price})` },
      { id: 'sgt_plead', arg: tid(th), label: `It was taken from ${th.names.giver}. It should go home.` },
    ];
  },
  respond(th, npc, pid, id, arg, S) {
    const rng = S.rng(th, Math.floor(S.now));
    const g = S.game;
    const home = (how) => {
      for (const t of S.tasksOf(th, 'ask')) S.complete(t, R.pl(pid));
      S.end(th, 'returned', `${nameOf(S, R.pl(pid))} brought ${th.vars.whatThe} home to ${th.names.giver}, ${how}.`, { news: [th.sid] });
    };
    if (id === 'sgt_ask') {
      th.vars.asked = (th.vars.asked || 0) + 1;
      if (rng.chance(0.5)) {
        th.vars.holder = npc.rec.idx;
        return { lines: [`${th.vars.whatCap}? ...I might have it. What's it to you?`] };
      }
      return { lines: [pick(rng, ['Never seen it.', 'Try the market folk.', 'Not me. Ask round the harbour.'])] };
    }
    th.vars.holder = npc.rec.idx;
    if (id === 'sgt_buy') {
      if (purse(S, pid) < th.vars.price) return { lines: [`¤${th.vars.price}, and not a coin less.`] };
      removeItem(g.player.inv, 'coin', th.vars.price);
      g.audio?.play('coin');
      home('bought back');
      return { lines: ['Done. Take it.', `(Back to ${th.names.giver} with it: the trail's at an end.)`] };
    }
    if (id === 'sgt_plead') {
      if (persuade(S, npc, rng, 0.3, 0.1)) {
        home('given up freely when its owner was told of');
        return { lines: [pick(rng, ['...Take it. I didn\'t know.', 'Stolen? Then it\'s not mine to keep.'])] };
      }
      return { lines: [pick(rng, ['I paid for it fair. Pay me, or go.', 'Sad story. Price stands.'])] };
    }
    return null;
  },
});

// A trail begun from town `L` (or null if there's nowhere for it to go).
function startFrom(S, L, rng, kind = null) {
  const s0 = L.settlement;
  const plan = planTrail(S, s0, rng);
  if (!plan.legs.length) return null;
  kind ||= pick(rng, Object.keys(KINDS));
  const K = KINDS[kind];
  const giver = pick(rng, adults(L).filter((r) => r.job !== 'guard'));
  if (!giver) return null;
  const what = pick(rng, K.what);
  const whatThe = kind === 'heirloom' ? `the ${what.toLowerCase()}` : kind === 'letter' ? 'the letter' : kind === 'heir' ? 'word of the heir' : 'the cure';
  const title = K.title.replace('{what}', what);
  const far = plan.legs.map((id) => S.game.world.ow.settlements[id]).some((q) => q && q.far);
  const pitch = kind === 'heirloom'
    ? `My ${what.toLowerCase()}. It ${K.why}, and I've heard it's left town. ${far ? 'They say it went over the sea, even past where the storm was.' : plan.wall ? 'They say it went down to the coast, to go over the water.' : ''} Find it?`
    : kind === 'letter' ? `My sister's letter never came. Whoever had it last was going ${far ? 'a long way, over the sea' : 'down the coast'}. Find out what happened to it?`
      : kind === 'heir' ? `Our eldest ${K.why}. They were seen on the road, then at the ferry. Will you follow, and bring word?`
        : `There's a sickness here only a far-off healer knows the cure for. Will you go for it? It's a long way.`;
  return {
    sid: s0.id, cast: { giver: R.rec(s0.id, giver.idx), town: R.town(s0.id) },
    vars: {
      kind, title, whatThe, whatCap: whatThe[0].toUpperCase() + whatThe.slice(1), legs: plan.legs, wall: plan.wall, island0: s0.island,
      price: rng.int(25, 60) + plan.legs.length * 10, pitch,
      rumour: `${giver.name.first} ${giver.name.last} of ${s0.name} is looking for ${whatThe}`,
    },
  };
}

export { startFrom as trailFrom };
