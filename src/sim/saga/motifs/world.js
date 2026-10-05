// The wider world's happenings (round 52): the Kavorent's cores, an
// eruption's refugees, a town gone hungry, a market short of something,
// and a merchant's stolen goods.
//
//   - A core rumoured: when a core comes up out of a spire, every scholar
//     on the islands wants one. A realm's scholars pay well for one brought
//     to them (and outlaws hear the same rumours: a band can come by one
//     first, see 'windfall').
//   - Refugees: when the Sleeper goes up, families flee Kharos for the
//     nearest town over the water. They need feeding; the town is uneasy.
//   - Famine relief: a starving town's council pays for food, any food,
//     brought in bulk.
//   - A shortage: a crafter who can't get what they need pays over the odds
//     for it.
//   - Stolen goods: a merchant robbed on the road wants the goods back from
//     the band that took them.
import { motif, R, refKey, nameOf, resolve } from '../core.js';
import { layoutOf, laidTowns, town, townName, living, adults } from './lib.js';
import { makePerson } from '../actors.js';
import { stash } from './camp.js';
import { mayorOf, alive, DAY, hearNews } from '../../econ.js';
import { ITEMS } from '../../../world/items.js';

// ------------------------------------------------------------ a core rumoured
motif({
  id: 'core_hunt',
  family: 'ancient',
  max: 2,
  key: (o) => `core:${o.vars.civ ?? o.sid}`,
  title: (th, S) => `The Scholars of ${townName(S, th.sid)} Want a Core`,
  seeds: [{ on: 'core_found', make: (ev, S) => {
    // Every realm's scholars but the one that got it.
    const got = town(S, ev.sid);
    const out = [];
    for (const c of S.game.world.ow.civs) {
      if (got && got.civ === c) continue;
      const cap = S.sim.realms.capitalOf ? S.sim.realms.capitalOf(c) : null;
      if (!cap || !layoutOf(S, cap.id) || Math.random() > 0.35) continue;
      out.push({ cast: { town: R.town(cap.id) }, sid: cap.id, vars: { civ: c.id, heard: ev.dungeon } });
    }
    return out;
  } }],
  nodes: {
    wanting: {
      enter(th, S) {
        const L = layoutOf(S, th.sid);
        const sch = L && (L.npcs.find((r) => alive(r) && (r.job === 'scholar' || r.job === 'researcher')) || mayorOf(L));
        const pay = 260;
        const t = S.post(th, {
          role: 'core', kind: 'fetch', title: `Bring a Kavorent core to the scholars of ${L.settlement.name}`, sid: th.sid, giver: sch ? R.rec(th.sid, sch.idx) : null, item: 'kav_core', n: 1,
          pitch: `Word came that a core was taken out of ${th.vars.heard || 'one of the spires'}. Another realm has one; we must have one too, or be left behind for a generation. Bring me a core (from a spire, or from whoever has one), and the realm will pay ¤${pay}.`,
          reward: { coins: pay, from: R.town(th.sid), rep: 15, renown: th.sid, renownPts: 6, renownWhy: 'bringing a Kavorent core', fame: 3 },
        });
        t.rumour = `${L.settlement.name}'s scholars will pay well for a Kavorent core`;
      },
      on: {
        // (Adventurers got one to them first.)
        core_found(th, ev, S) {
          const s = town(S, ev.sid);
          if (!s || s.civ === undefined || s.civ === null || s.civ.id !== th.vars.civ) return;
          const t = S.tasksOf(th, 'core')[0];
          if (t) S.closeTask(t, 'done');
          S.end(th, 'got', `${ev.by} brought a core to the realm before anyone else could.`);
        },
      },
      fade: 25,
    },
  },
  tasks: { core: { thanks: () => ['A core... a real one. You don\'t know what you\'ve done for us. Here: the realm keeps its word.'] } },
});

// ------------------------------------------------------------ refugees
motif({
  id: 'refugees',
  family: 'nature',
  max: 2,
  key: (o) => `refugees:${o.sid}`,
  title: (th, S) => `Refugees from Kharos in ${townName(S, th.sid)}`,
  seeds: [{ on: 'eruption', make: (ev, S) => {
    const towns = laidTowns(S).filter((L) => !/kharos|ash/i.test(L.settlement.style || ''));
    if (!towns.length) return null;
    const L = towns[Math.floor(Math.random() * towns.length)];
    return { cast: { town: R.town(L.settlement.id) }, sid: L.settlement.id };
  } }],
  nodes: {
    camped: {
      enter(th, S) {
        const L = layoutOf(S, th.sid);
        if (!L) return S.end(th, 'faded');
        const rng = S.rng(th, 0x4ef);
        const n = rng.int(3, 5);
        th.vars.n = n;
        const P = L.plaza;
        for (let i = 0; i < n; i++) {
          S.actor(th, {
            key: `r${i}`, kind: 'npc', role: 'refugee', talk: true, at: { x: P.cx - 3 + i * 2, z: P.cz + 4 },
            person: makePerson(rng, 'high', i === n - 1 ? 'child' : 'refugee'),
            orders: { home: { x: P.cx - 3 + i * 2, z: P.cz + 4 }, roam: 2, lines: ['We lost everything.', 'The sky went black...', 'Is there bread?', 'My house is under the ash.'], mark: null },
          });
        }
        S.note(th, `${n} families have come over the water from Kharos, fleeing the ash. They're sleeping in the square of ${L.settlement.name}.`, { news: [th.sid] });
        const m = mayorOf(L);
        const t = S.post(th, {
          role: 'feed', kind: 'fetch', title: `Bring food for the refugees in ${L.settlement.name}`, sid: th.sid, giver: m ? R.rec(th.sid, m.idx) : null, item: 'food', n: 8,
          pitch: `They came with nothing. Our kitchens are stretched already. If you could bring food (eight meals' worth, anything that fills a belly), the town would be grateful.`,
          reward: { coins: 20, from: R.town(th.sid), rep: 10, renown: th.sid, renownPts: 5, renownWhy: 'feeding the refugees', fame: 2 },
        });
        t.rumour = `Refugees from Kharos are starving in ${L.settlement.name}`;
      },
      day(th, S, rng) {
        const L = layoutOf(S, th.sid);
        if (!L) return S.end(th, 'faded');
        if (S.now - th.nodeAt > 4 * DAY) {
          const fed = th.vars.fed;
          for (const a of th.actors) S.dismissActor(th, a.key);
          if (fed && rng.chance(0.6)) S.end(th, 'settled', `The refugees from Kharos have settled in ${L.settlement.name}, and are building homes on its edge.`, { news: [th.sid] });
          else S.end(th, 'moved', `The refugees from Kharos have moved on${fed ? '' : ', hungry and bitter'}.`, { news: [th.sid] });
        }
      },
    },
  },
  tasks: {
    feed: {
      done(th, t, by, S) {
        th.vars.fed = true;
      },
      thanks: () => ['Bless you. They\'ll eat tonight.'],
    },
  },
  hello: () => 'Please... anything you can spare.',
});

// ------------------------------------------------------------ famine relief
motif({
  id: 'relief',
  family: 'nature',
  max: 3,
  key: (o) => `relief:${o.sid}`,
  title: (th, S) => `Hunger in ${townName(S, th.sid)}`,
  seeds: [{ on: 'famine', make: (ev) => ({ cast: { town: R.town(ev.sid) }, sid: ev.sid }) }],
  nodes: {
    hungry: {
      enter(th, S) {
        const L = layoutOf(S, th.sid);
        const m = L && mayorOf(L);
        if (!L) return S.end(th, 'faded');
        const t = S.post(th, {
          role: 'grain', kind: 'fetch', title: `Bring food to starving ${L.settlement.name}`, sid: th.sid, giver: m ? R.rec(th.sid, m.idx) : null, item: 'food', n: 12,
          pitch: 'The stores are bare and children are going to bed hungry. The council will pay for food, any food, brought in: twelve meals\' worth to start.',
          reward: { coins: 45, from: R.town(th.sid), rep: 12, renown: th.sid, renownPts: 6, renownWhy: 'bringing food in the famine', fame: 2 },
        });
        t.rumour = `${L.settlement.name} is starving`;
      },
      day(th, S) {
        const L = layoutOf(S, th.sid);
        if (!L || !(L.econ.famineDays > 0)) S.end(th, 'over', 'The hunger has passed.');
      },
    },
  },
  tasks: {
    grain: {
      // (The food goes into the kitchen.)
      done(th, t, by, S) {
        const L = layoutOf(S, th.sid);
        if (L) for (const r of living(L)) r.hungry = Math.max(0, (r.hungry || 0) - 1);
        S.end(th, 'fed', `${nameOf(S, by)} brought food to ${townName(S, th.sid)} in the famine.`, { news: [th.sid] });
      },
      thanks: () => ['You\'ve saved lives today. I mean that.'],
    },
  },
});

// ------------------------------------------------------------ a shortage
motif({
  id: 'shortage',
  family: 'trade',
  max: 4,
  key: (o) => `short:${o.sid}:${o.vars.item}`,
  title: (th, S) => `${townName(S, th.sid)} Is Short of ${ITEMS[th.vars.item] ? ITEMS[th.vars.item].name : th.vars.item}`,
  scan(S, rng) {
    if (!rng.chance(0.25)) return null;
    for (const L of rng.shuffle(laidTowns(S)).slice(0, 4)) {
      const short = S.sim.market && S.sim.market.notes ? S.sim.market.notes(L, 3).filter((q) => q.v < 0 && ITEMS[q.k]) : [];
      if (!short.length) continue;
      const q = rng.pick(short);
      const who = adults(L).find((r) => ['blacksmith', 'carpenter', 'tailor', 'baker', 'cook', 'herbalist', 'merchant'].includes(r.job));
      if (!who) continue;
      return { cast: { buyer: R.rec(L.settlement.id, who.idx), town: R.town(L.settlement.id) }, sid: L.settlement.id, vars: { item: q.k, n: rng.int(6, 16) } };
    }
    return null;
  },
  nodes: {
    wanting: {
      enter(th, S) {
        const it = ITEMS[th.vars.item];
        const pay = Math.round((it.value || 2) * th.vars.n * 1.8) + 10;
        S.post(th, {
          role: 'supply', kind: 'fetch', title: `Bring ${th.vars.n} ${it.name.toLowerCase()} to ${th.names.buyer}`, sid: th.sid, giver: th.cast.buyer, item: th.vars.item, n: th.vars.n,
          pitch: `I can't get ${it.name.toLowerCase()} anywhere in ${townName(S, th.sid)} for love nor money. I need ${th.vars.n}, and I'll pay ¤${pay}, well over the odds.`,
          reward: { coins: pay, from: th.cast.buyer, rep: 6 },
        });
      },
      day(th, S) {
        if (S.now - th.nodeAt > 5 * DAY) S.end(th, 'faded');
      },
    },
  },
  tasks: { supply: { thanks: () => ['Just what I needed. Here, as promised.'] } },
});

// ------------------------------------------------------------ stolen goods
motif({
  id: 'goods',
  family: 'trade',
  max: 4,
  key: (o) => refKey(o.cast.merchant),
  title: (th, S) => `${th.names.merchant}'s Stolen Goods`,
  seeds: [{ on: 'robbery', make: (ev, S) => {
    if (!ev.goods || Math.random() > 0.5) return null;
    return { cast: { merchant: ev.victim, band: R.band(ev.band), town: R.town(ev.sid) }, sid: ev.sid, vars: { n: Math.max(1, Math.min(4, Math.ceil(ev.goods / 3))) } };
  } }],
  anchors: (th, S) => {
    const b = resolve(S, th.cast.band);
    return b && b.camp ? [{ x: b.camp.x, z: b.camp.z }] : [];
  },
  nodes: {
    taken: {
      enter(th, S) {
        const b = resolve(S, th.cast.band);
        if (!b) return S.end(th, 'faded');
        stash(S, b, [{ item: 'stolen_goods', count: th.vars.n }]);
        S.post(th, {
          role: 'back', kind: 'retrieve', title: `Get ${th.names.merchant}'s goods back from ${b.name}`, sid: th.sid, giver: th.cast.merchant, item: 'stolen_goods', n: th.vars.n,
          pitch: `${b.name} took half my wagon. It's all in their strongbox, I'd bet my life on it. Get it back, and I'll give you a third of what it's worth.`,
          at: b.camp ? { x: b.camp.x, z: b.camp.z } : null, r: 30, reward: { coins: 15 + th.vars.n * 8, from: th.cast.merchant, rep: 8 },
        });
      },
      fade: 20,
    },
  },
  tasks: { back: { thanks: () => ['My goods! You\'re a marvel.'] } },
});

export { hearNews };
