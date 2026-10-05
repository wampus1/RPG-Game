// Townsfolk's own stories (round 52).
//
//   - A vendetta: someone's killed (by outlaws, a beast, a named outlaw,
//     an adventurer, you), and their kin don't let it lie: they ask for
//     the killer's head; or, if it was you, they come to have it out with
//     you (pay the blood price, beg forgiveness, or face them), and a
//     temper that isn't settled hires blades.
//   - A lost child: a little one wanders off into the woods. Find them and
//     walk them home (they follow you); left out there too long, a pack
//     near by may find them first.
//   - Missing on the road: someone off to another town never got there.
//     Robbed and taken by outlaws, or lying hurt by the road.
//   - A feud: two families at each other's throats, worse every few days
//     (words, then fists, then a barn burnt, then a body). Talk them both
//     round, or take a side.
//   - Fever: it starts with a few in a poor town (or one that's starving)
//     and spreads; the herbalist needs herbs to make a cure, and someone
//     to take it round to the sick.
//   - A runaway: a youth with the wrong friends runs off to the outlaws, or
//     to follow an adventurer; their parents want them brought home.
//   - A challenge: someone with a name (you) is challenged by a champion
//     who wants it.
import { motif, HOOKS, R, refKey, nameOf, NameOf, isAlive, resolve, pidOf, playerOf, poss } from '../core.js';
import { pick, say, layoutOf, laidTowns, town, townName, townMid, directions, living, adults, fullName, kinOf, relWord, spotNear, bandsNear, outInTheOpen, inTown, recOf, purse } from './lib.js';
import { makePerson } from '../actors.js';
import { mayorOf, alive, DAY } from '../../econ.js';
import { ITEMS } from '../../../world/items.js';
import { countItem, removeItem } from '../../../game/inventory.js';
import { BEASTS } from './beasts.js';

const tid = (th) => `t${th.id}`;

// ------------------------------------------------------------ a vendetta
const KILLER_KINDS = ['band', 'bandit', 'named', 'den', 'adv', 'pl'];

function killerOf(ev) {
  const b = ev.by;
  if (b && KILLER_KINDS.includes(b.t)) return b.t === 'bandit' ? R.band(b.band) : b;
  return null;
}

motif({
  id: 'vendetta',
  family: 'people',
  max: 10,
  key: (o) => refKey(o.cast.victim),
  title: (th, S) => `${NameOf(S, th.cast.avenger)} Wants Justice for ${th.names.victim}`,
  seeds: [
    // Killed in the flesh (in front of you, or near it).
    { on: 'kill', make: (ev, S) => {
      if (!ev.victim || ev.victim.t !== 'rec' || !ev.by) return null;
      return vendettaFor(S, ev.victim, killerOf(ev));
    } },
    // A worker taken by a pack out past the fields.
    { on: 'den_raid', make: (ev, S) => (ev.killed && ev.victim ? vendettaFor(S, ev.victim, R.den(ev.den)) : null) },
  ],
  nodes: {
    grief: {
      enter(th, S) {
        const k = th.cast.killer;
        const av = recOf(S, th.cast.avenger);
        if (!av) return S.end(th, 'faded');
        S.note(th, `${fullName(av)} buried their ${th.vars.rel}, ${th.names.victim}, killed by ${th.names.killer}.`);
        if (k.t === 'pl') return S.go(th, 'reckoning');
        S.go(th, 'seek');
      },
    },
    // Asking for the killer's head.
    seek: {
      enter(th, S) {
        const av = recOf(S, th.cast.avenger);
        if (!av) return S.end(th, 'faded');
        const k = th.cast.killer;
        // (A plea about it already? Then it's a vengeance plea now: see
        // threats.js. This is for the ones no plea covers.)
        const already = S.live().some((t) => t.m === 'plea' && refKey(t.cast.threat) === refKey(k) && t.sid === th.sid);
        if (already) return S.end(th, 'joined', `${fullName(av)} put their coin in with the plea about ${th.names.killer}.`);
        const coins = Math.max(10, Math.min(60, Math.floor((av.coins || 0) * 0.7)));
        const where = k.t === 'den' ? (() => {
          const d = S.dens[k.key];
          return d ? { x: d.x, z: d.z } : null;
        })() : k.t === 'band' ? (() => {
          const b = resolve(S, k);
          return b && b.camp ? { x: b.camp.x, z: b.camp.z } : null;
        })() : null;
        const t = S.post(th, {
          role: 'avenge', kind: 'hunt', title: k.t === 'den' ? `Avenge ${th.names.victim}: kill the beasts that took them` : `Avenge ${th.names.victim}: bring down ${th.names.killer}`,
          sid: th.sid, giver: th.cast.avenger, target: k, at: where, r: 30,
          pitch: say(S.rng(th, 1), [
            '{victim} was my {rel}. {killer} took them from me. I want them gone from the world, and I\'ll give you everything I have: ¤{coins}.',
            'I can\'t sleep. I see {victim}\'s face. Make {killer} pay. ¤{coins}, all I\'ve got.',
            'They say {killer} is still out there, laughing. My {rel} is in the ground. ¤{coins} if you end it.',
          ], { victim: th.names.victim, rel: th.vars.rel, killer: th.names.killer, coins }),
          reward: { coins, from: th.cast.avenger, rep: 15, fame: 1 },
        });
        t.rumour = `${fullName(av)} wants ${th.names.killer} dead, for ${th.names.victim}`;
      },
      on: {
        band_gone(th, ev, S) {
          if (th.cast.killer.t !== 'band' || ev.band !== th.cast.killer.id) return;
          avenged(th, S, ev.by);
        },
        den_cleared(th, ev, S) {
          if (th.cast.killer.t !== 'den' || ev.den !== th.cast.killer.key) return;
          avenged(th, S, ev.by);
        },
        beast_slain(th, ev, S) {
          if (th.cast.killer.t !== 'den' || ev.den !== th.cast.killer.key) return;
          avenged(th, S, ev.by);
        },
        bandit_down(th, ev, S) {
          const k = th.cast.killer;
          if (k.t === 'named') {
            const n = S.named[k.key];
            if (n && ev.band === n.band && ev.member === n.member) avenged(th, S, ev.by);
          }
        },
        adv_died(th, ev, S) {
          if (th.cast.killer.t === 'adv' && ev.adv === th.cast.killer.id) avenged(th, S, ev.by || null);
        },
        npc_died(th, ev, S) {
          if (refKey(ev.who) === refKey(th.cast.avenger)) S.end(th, 'faded', `${th.names.avenger} died with their vengeance unfinished.`);
        },
      },
      fade: 25,
    },
    // You did it: they come to have it out with you.
    reckoning: {
      enter(th, S) {
        const pid = th.cast.killer.pid;
        const av = recOf(S, th.cast.avenger);
        if (!av) return S.end(th, 'faded');
        th.vars.price = 30 + Math.round((av.coins || 0) * 0.3) + 20;
        th.vars.temper = av.personality?.temper ?? 0.5;
        S.touch(th, pid);
        S.tell(pid, `${fullName(av)} of ${townName(S, th.sid)} knows what you did to their ${th.vars.rel}, ${th.names.victim}.`, '#ff9080');
      },
      // They find you (in their own town, or out in the open nearby).
      hour(th, S, rng) {
        const pid = th.cast.killer.pid;
        const p = playerOf(S.game, pid);
        const av = recOf(S, th.cast.avenger);
        if (!p || !av || S.actorSpec(th, 'avenger')) return;
        const tw = inTown(S, pid);
        if ((!tw || tw.id !== th.sid) && !outInTheOpen(S, pid)) return;
        if (!rng.chance(0.25)) return;
        const at = spotNear(S, p.x, p.z, 10, 14, rng, { clear: -999, flat: 0 }) || { x: Math.round(p.x + 10), z: Math.round(p.z) };
        S.actor(th, {
          key: 'avenger', kind: 'npc', role: 'avenger', talk: true, at,
          person: { name: av.name, look: av.look, personality: av.personality, traits: av.traits, age: av.age, job: av.job, maxHp: av.maxHp || 20, weapon: ITEMS.club ? 'club' : null, title: 'Grieving' },
          orders: { seek: pid, markFor: pid, mark: 'talk', hail: `You. You killed my ${th.vars.rel}.`, patience: 120, ignoredLine: 'This isn\'t over.' },
        });
      },
      day(th, S, rng) {
        // Unsettled long enough: blades for hire.
        if (S.now - th.nodeAt > 3 * DAY && !th.vars.hired && th.vars.temper > 0.4) {
          th.vars.hired = true;
          S.spawn(th, 'contract', { cast: { patron: th.cast.avenger, target: th.cast.killer }, vars: { pay: th.vars.price + 20, alive: false } });
          S.note(th, `${th.names.avenger} has gone to people who do such things for coin.`, { hidden: true });
          S.end(th, 'hired');
        }
      },
      on: {
        npc_died(th, ev, S) {
          if (refKey(ev.who) === refKey(th.cast.avenger)) S.end(th, 'over', `${th.names.avenger} is dead too now.`);
        },
      },
      fade: 12,
    },
    done: { final: true },
  },
  tasks: {
    avenge: {
      npcs: { adv: 0.1, guard: 0 },
      thanks: () => ['It\'s done? Then my rest will come. Thank you.'],
    },
  },
  hello(th, a, npc, pid) {
    return pid === th.cast.killer.pid ? `You killed my ${th.vars.rel}. ${th.names.victim}. Look at me when I'm talking to you.` : 'Not now.';
  },
  talk(th, a, npc, pid, S) {
    if (a.role !== 'avenger' || pid !== th.cast.killer.pid || th.node !== 'reckoning') return [];
    return [
      { id: 'sgv_pay', arg: tid(th), label: `I'll pay the blood price. (¤${th.vars.price})` },
      { id: 'sgv_sorry', arg: tid(th), label: 'I\'m sorry. Truly.' },
      { id: 'sgv_threat', arg: tid(th), label: 'Walk away, before you join them.' },
    ];
  },
  respond(th, npc, pid, id, arg, S) {
    const rng = S.rng(th, 0x5e1);
    const cha = (S.game.hero && S.game.hero.stats ? S.game.hero.stats.cha : 2) || 2;
    switch (id) {
      case 'sgv_pay': {
        if (purse(S, pid) < th.vars.price) return { lines: ['You haven\'t even got it. Of course you haven\'t.'] };
        S.asPid(pid, (p) => removeItem(p.inv, 'coin', th.vars.price));
        const av = recOf(S, th.cast.avenger);
        if (av) av.coins = (av.coins || 0) + th.vars.price;
        S.dismissActor(th, 'avenger');
        S.end(th, 'settled', `${nameOf(S, R.pl(pid))} paid ${th.names.avenger} the blood price for ${th.names.victim}.`);
        return { lines: ['Coin won\'t bring them back.', '...But it\'s something. Don\'t come near me again.'], close: true };
      }
      case 'sgv_sorry': {
        if (rng.chance(0.15 + cha * 0.08 - th.vars.temper * 0.2)) {
          S.dismissActor(th, 'avenger');
          S.end(th, 'forgiven', `${th.names.avenger} heard ${nameOf(S, R.pl(pid))} out, and let it go.`);
          return { lines: ['...', 'I don\'t forgive you. But I won\'t carry this any more. Go.'], close: true };
        }
        th.vars.temper += 0.1;
        return { lines: [pick(rng, ['Sorry? SORRY?', 'Your sorry is worth nothing to me.', 'Save it for the gods.'])] };
      }
      case 'sgv_threat': {
        th.vars.temper += 0.3;
        S.dismissActor(th, 'avenger');
        if (th.vars.temper > 0.7) {
          const e = npc;
          if (e && !e.dead) {
            e.saga = null;
            e.state = 'routine';
            e.engage(S.game.player);
          }
          return { lines: ['Then I\'ll join them TRYING!'], close: true };
        }
        return { lines: ['This isn\'t over.'], close: true };
      }
      default:
        return null;
    }
  },
});

function vendettaFor(S, victim, killer) {
  if (!killer) return null;
  const L = layoutOf(S, victim.sid);
  const v = recOf(S, victim);
  if (!L || !v) return null;
  const kin = kinOf(L, v);
  if (!kin.length) return null;
  const av = kin.sort((a, b) => (b.personality?.temper ?? 0.5) - (a.personality?.temper ?? 0.5))[0];
  // (Not every death is avenged: the meek mourn.)
  if ((av.personality?.bravery ?? 0.5) + (av.personality?.temper ?? 0.5) < 0.7 && killer.t !== 'pl') return null;
  return {
    cast: { victim, killer, avenger: R.rec(victim.sid, av.idx), town: R.town(victim.sid) }, sid: victim.sid,
    vars: { rel: relWord(av, v) }, touched: killer.t === 'pl' ? [killer.pid] : [],
  };
}

function avenged(th, S, by) {
  const t = S.tasksOf(th, 'avenge')[0];
  if (t && by) S.complete(t, by);
  else if (t) S.closeTask(t, 'done');
  S.go(th, 'done', `${th.names.victim} is avenged${by ? ` by ${nameOf(S, by)}` : ''}.`, { news: [th.sid] });
}

// ------------------------------------------------------------ a lost child
motif({
  id: 'lost_child',
  family: 'people',
  max: 3,
  key: (o) => refKey(o.cast.child),
  title: (th, S) => `${th.names.child} Is Lost`,
  scan(S, rng) {
    if (!rng.chance(0.1)) return null;
    const L = rng.pick(laidTowns(S));
    if (!L) return null;
    const kids = living(L).filter((r) => r.age === 'child' && !r.away);
    if (!kids.length) return null;
    const c = rng.pick(kids);
    const parent = [...(c.parents || [])].map((i) => L.npcs[i]).find((r) => r && alive(r));
    if (!parent) return null;
    const m = townMid(L.settlement);
    const at = spotNear(S, m.x, m.z, 45, 95, rng, { woods: true, clear: 12 });
    if (!at) return null;
    return { cast: { child: R.rec(L.settlement.id, c.idx), parent: R.rec(L.settlement.id, parent.idx), town: R.town(L.settlement.id) }, sid: L.settlement.id, spots: [at], vars: { at } };
  },
  anchors: (th) => [th.vars.at],
  nodes: {
    lost: {
      enter(th, S) {
        const c = recOf(S, th.cast.child);
        if (!c) return S.end(th, 'faded');
        c.away = true;
        if (c.ent && !c.ent.dead) S.game.despawnNpc(c.ent);
        const s = town(S, th.sid);
        S.note(th, `${fullName(c)}, a child of ${s.name}, wandered off and hasn't come home.`, { news: [th.sid] });
        const t = S.post(th, {
          role: 'find', kind: 'find', title: `Find ${th.names.child} and bring them home`, sid: th.sid, giver: th.cast.parent,
          pitch: say(S.rng(th, 2), ['My little {c} went out after the geese this morning and never came back. The woods... please, please find them.', '{c} has been gone since dawn. They know not to go past the fields, but... Please.'], { c: c.name.first }),
          at: null, r: 4, reward: { coins: 15, from: th.cast.parent, rep: 20, renown: th.sid, renownPts: 4, renownWhy: `finding ${c.name.first}`, fame: 1 }, delay: 20,
        });
        t.rumour = `${c.name.first} from ${s.name} is lost in the woods`;
        S.actor(th, {
          key: 'child', kind: 'npc', role: 'lost', talk: true, at: th.vars.at,
          person: { name: c.name, look: c.look, personality: c.personality, traits: c.traits, age: 'child', job: 'child', maxHp: 10, title: 'Lost Child' },
          orders: { home: th.vars.at, roam: 2, lines: ['*sniff*', 'I want my mum...', 'Hello? Is anyone there?', 'I\'m not scared. I\'m not.'], mark: 'talk' },
        });
      },
      // Led home: they're within the town again.
      live(th, S) {
        const e = S.actorEnt(th, 'child');
        if (!e || !th.vars.leader) return;
        const s = town(S, th.sid);
        if (s && S.game.world.ow.settlementAt(e.x, e.z) === s) {
          const t = S.tasksOf(th, 'find')[0];
          if (t) S.complete(t, R.pl(th.vars.leader));
          home(th, S);
          S.go(th, 'home', `${nameOf(S, R.pl(th.vars.leader))} found ${th.names.child} in the woods and brought them home.`, { news: [th.sid] });
        }
      },
      day(th, S, rng) {
        if (th.vars.leader) return;
        // The watch and the neighbours out searching.
        const days = (S.now - th.nodeAt) / DAY;
        if (rng.chance(0.25 + days * 0.1)) {
          home(th, S);
          const t = S.tasksOf(th, 'find')[0];
          if (t) S.closeTask(t, 'done');
          return S.go(th, 'home', `The search party found ${th.names.child} cold and frightened in the woods, but alive.`, { news: [th.sid] });
        }
        // A pack near by finds them first.
        const den = Object.values(S.dens).find((d) => !d.cleared && Math.hypot(d.x - th.vars.at.x, d.z - th.vars.at.z) < 140);
        if (den && days > 1.5 && rng.chance(0.3)) {
          const L = layoutOf(S, th.sid);
          const c = recOf(S, th.cast.child);
          S.dismissActor(th, 'child');
          if (L && c) {
            c.away = false;
            S.sim.recordDeath(L, c, `taken by ${BEASTS[den.species].word}`, null);
            S.emit('den_raid', { den: den.key, sid: th.sid, victim: th.cast.child, killed: true, alpha: !!den.alpha });
          }
          S.end(th, 'lost', `They found what the ${BEASTS[den.species].word} left of ${th.names.child}.`, { news: [th.sid] });
        }
      },
    },
    home: { final: true },
  },
  tasks: {
    find: {
      npcs: { adv: 0.1, guard: 0.15 },
      offer: (th, t, pid, S) => [`They were seen going ${directions(town(S, th.sid), th.vars.at.x, th.vars.at.z).replace(/ of .*$/, '')}, into the trees.`],
      thanks: () => ['You found them! Oh, you found them. Thank you, thank you!'],
    },
  },
  hello(th, a, npc, pid) {
    return th.vars.leader ? 'Are we nearly home?' : 'Who are you? I\'m... I\'m lost.';
  },
  talk(th, a, npc, pid) {
    if (a.role !== 'lost' || th.vars.leader) return [];
    return [{ id: 'sgl_come', arg: tid(th), label: 'Your family\'s looking for you. Come on, I\'ll take you home.' }];
  },
  respond(th, npc, pid, id, arg, S) {
    if (id !== 'sgl_come') return null;
    th.vars.leader = pid;
    S.touch(th, pid);
    const t = S.tasksOf(th, 'find')[0];
    if (t && !S.claimedBy(t, pid)) S.accept(t, R.pl(pid));
    const a = S.actorSpec(th, 'child');
    if (a) a.orders = { ...(a.orders || {}), follow: pid, mark: null, lines: ['Are we nearly there?', 'My feet hurt.', 'You won\'t leave me, will you?'] };
    if (npc.saga) {
      npc.saga.follow = pid;
      npc.saga.mark = null;
    }
    return { lines: ['Really? Okay. I\'ll stay right behind you.'], close: true };
  },
});

function home(th, S) {
  const c = recOf(S, th.cast.child);
  if (c) c.away = false;
  S.dismissActor(th, 'child');
}

// ------------------------------------------------------------ missing on the road
motif({
  id: 'missing',
  family: 'people',
  max: 3,
  key: (o) => refKey(o.cast.lost),
  title: (th, S) => `${th.names.lost} Never Arrived`,
  scan(S, rng) {
    if (!rng.chance(0.08)) return null;
    for (const L of rng.shuffle(laidTowns(S)).slice(0, 4)) {
      const bands = bandsNear(S, L.settlement.id, 8);
      const r = living(L).find((q) => q.age === 'adult' && q.job === 'merchant' && !q.away);
      if (!r) continue;
      const kin = kinOf(L, r)[0] || mayorOf(L);
      if (!kin) continue;
      const m = townMid(L.settlement);
      const at = spotNear(S, m.x, m.z, 80, 160, rng, { clear: 10 });
      if (!at) continue;
      return { cast: { lost: R.rec(L.settlement.id, r.idx), kin: R.rec(L.settlement.id, kin.idx), town: R.town(L.settlement.id), band: bands.length ? R.band(bands[0].id) : null }, sid: L.settlement.id, vars: { at, fate: bands.length && rng.chance(0.6) ? 'taken' : 'hurt' } };
    }
    return null;
  },
  anchors: (th) => [th.vars.at],
  nodes: {
    gone: {
      enter(th, S) {
        const r = recOf(S, th.cast.lost);
        if (!r) return S.end(th, 'faded');
        r.away = true;
        if (r.ent && !r.ent.dead) S.game.despawnNpc(r.ent);
        const s = town(S, th.sid);
        // Taken by outlaws: it's their cage now.
        if (th.vars.fate === 'taken' && th.cast.band && isAlive(S, th.cast.band)) {
          r.away = false;
          S.spawn(th, 'captive', { cast: { captive: th.cast.lost, band: th.cast.band }, sid: th.sid, vars: { how: 'road' } });
          S.end(th, 'taken', `${fullName(r)} was set on by ${nameOf(S, th.cast.band)} on the road out of ${s.name}, and taken.`, { news: [th.sid] });
          return;
        }
        S.note(th, `${fullName(r)} set out from ${s.name} and never arrived.`, { news: [th.sid] });
        S.post(th, {
          role: 'find', kind: 'find', title: `Find ${r.name.first} on the road out of ${s.name}`, sid: th.sid, giver: th.cast.kin,
          pitch: `${r.name.first} should have been back two days ago. They took the road ${directions(s, th.vars.at.x, th.vars.at.z).replace(/^[^ ]+ [^ ]+ (way )?/, '').replace(/ of .*$/, '')}. Something's happened. I know it.`,
          r: 4, reward: { coins: 20, from: th.cast.kin, rep: 15, fame: 1 },
        });
        S.actor(th, {
          key: 'lost', kind: 'npc', role: 'hurt', talk: true, at: th.vars.at,
          person: { name: r.name, look: r.look, personality: r.personality, traits: r.traits, age: r.age, job: r.job, maxHp: r.maxHp || 20, title: 'Injured Traveller' },
          orders: { home: th.vars.at, lines: ['Help... over here...', 'My leg... I can\'t walk on it.', 'Is someone there?'], mark: 'talk' },
        });
      },
      live(th, S) {
        const e = S.actorEnt(th, 'lost');
        if (!e || !th.vars.leader) return;
        if (S.game.world.ow.settlementAt(e.x, e.z) === town(S, th.sid)) {
          const t = S.tasksOf(th, 'find')[0];
          if (t) S.complete(t, R.pl(th.vars.leader));
          const r = recOf(S, th.cast.lost);
          if (r) r.away = false;
          S.dismissActor(th, 'lost');
          S.end(th, 'home', `${nameOf(S, R.pl(th.vars.leader))} found ${th.names.lost} hurt by the road and brought them home.`, { news: [th.sid] });
        }
      },
      day(th, S, rng) {
        if (th.vars.leader) return;
        const days = (S.now - th.nodeAt) / DAY;
        if (days > 3 && rng.chance(0.35)) {
          const L = layoutOf(S, th.sid);
          const r = recOf(S, th.cast.lost);
          S.dismissActor(th, 'lost');
          if (rng.chance(0.5) && L && r) {
            r.away = false;
            S.sim.recordDeath(L, r, 'died alone on the road', null);
            S.end(th, 'dead', `${th.names.lost} was found dead by the road, too late.`, { news: [th.sid] });
          } else {
            if (r) r.away = false;
            S.end(th, 'home', `${th.names.lost} limped home on their own, half-starved.`, { news: [th.sid] });
          }
        }
      },
    },
  },
  tasks: { find: { npcs: { adv: 0.08, guard: 0.1 } } },
  hello: (th) => (th.vars.leader ? 'Not far now, I hope.' : 'Thank the gods. Someone came.'),
  talk(th, a, npc, pid) {
    if (th.vars.leader) return [];
    return [{ id: 'sgm_help', arg: tid(th), label: 'Lean on me. Let\'s get you home.' }];
  },
  respond(th, npc, pid, id, arg, S) {
    if (id !== 'sgm_help') return null;
    th.vars.leader = pid;
    const t = S.tasksOf(th, 'find')[0];
    if (t && !S.claimedBy(t, pid)) S.accept(t, R.pl(pid));
    const a = S.actorSpec(th, 'lost');
    if (a) a.orders = { ...(a.orders || {}), follow: pid, mark: null, lines: ['Slowly...', 'Thank you. Truly.'] };
    if (npc.saga) {
      npc.saga.follow = pid;
      npc.saga.mark = null;
    }
    return { lines: ['Bless you. Slowly, mind.'], close: true };
  },
});

// ------------------------------------------------------------ a feud
const FEUD_STEPS = [
  ['words', '{a} and {b} came to shouting in the square again.'],
  ['fists', '{a} and {b} came to blows outside the tavern. The watch pulled them apart.'],
  ['fire', 'Someone set fire to the {b} family\'s woodpile in the night. Everyone knows who.'],
  ['blood', '{a} killed {b}.'],
];

motif({
  id: 'feud',
  family: 'people',
  max: 3,
  key: (o) => `${refKey(o.cast.a)}|${refKey(o.cast.b)}`,
  title: (th, S) => `The ${th.vars.fa}-${th.vars.fb} Feud`,
  scan(S, rng) {
    if (!rng.chance(0.08)) return null;
    const L = rng.pick(laidTowns(S));
    if (!L) return null;
    const ppl = adults(L).filter((r) => (r.personality?.temper ?? 0.5) > 0.5 && r.job !== 'mayor');
    if (ppl.length < 2) return null;
    const a = rng.pick(ppl);
    const b = rng.pick(ppl.filter((r) => r !== a && r.household !== a.household && r.name.last !== a.name.last));
    if (!b) return null;
    const why = rng.pick(['a boundary stone moved in the night', 'a debt never paid', 'a broken betrothal', 'a dog that killed chickens', 'an insult at a wedding', 'water from the well']);
    return { cast: { a: R.rec(L.settlement.id, a.idx), b: R.rec(L.settlement.id, b.idx), town: R.town(L.settlement.id) }, sid: L.settlement.id, vars: { why, fa: a.name.last, fb: b.name.last, step: 0 } };
  },
  nodes: {
    simmer: {
      enter(th, S) {
        if (!th.vars.begun) {
          th.vars.begun = true;
          S.note(th, `The ${th.vars.fa}s and the ${th.vars.fb}s of ${townName(S, th.sid)} are at each other's throats over ${th.vars.why}.`, { news: [th.sid] });
          const L = layoutOf(S, th.sid);
          const m = L ? mayorOf(L) : null;
          const t = S.post(th, {
            role: 'mediate', kind: 'talk', title: `Make peace between the ${th.vars.fa}s and the ${th.vars.fb}s`, sid: th.sid, giver: m ? R.rec(th.sid, m.idx) : null,
            pitch: `The ${th.vars.fa}s and the ${th.vars.fb}s are going to kill each other over ${th.vars.why}. Talk to ${th.names.a} and ${th.names.b}. Someone they'll both listen to.`,
            reward: { coins: 20, from: R.town(th.sid), rep: 6, renown: th.sid, renownPts: 3, renownWhy: 'making peace' },
          });
          t.rumour = `The ${th.vars.fa}s and ${th.vars.fb}s are feuding`;
        }
      },
      day(th, S, rng) {
        const a = recOf(S, th.cast.a);
        const b = recOf(S, th.cast.b);
        if (!a || !b || !alive(a) || !alive(b)) return S.end(th, 'over');
        if (th.vars.calmA && th.vars.calmB) return;
        if (!rng.chance(0.4)) return;
        const step = FEUD_STEPS[Math.min(th.vars.step, FEUD_STEPS.length - 1)];
        th.vars.step++;
        S.note(th, step[1].replace('{a}', th.names.a).replace('{b}', step[0] === 'fire' ? th.vars.fb : th.names.b), { news: [th.sid] });
        if (step[0] === 'fists') {
          a.hp = Math.max(1, Math.round((a.hp ?? 20) * 0.6));
          b.hp = Math.max(1, Math.round((b.hp ?? 20) * 0.6));
        }
        if (step[0] === 'blood') {
          const L = layoutOf(S, th.sid);
          if (L) {
            S.sim.recordDeath(L, b, `killed by ${fullName(a)}`, null);
            S.emit('kill', { by: th.cast.a, victim: th.cast.b, npc: true });
            if (S.sim.society && S.sim.society.exile) S.sim.society.exile(L, a, S.day, rng, `killing ${fullName(b)}`);
          }
          S.end(th, 'blood');
        }
      },
      fade: 20,
    },
  },
  tasks: { mediate: {} },
  townTalk(th, npc, pid, S) {
    const out = [];
    for (const side of ['a', 'b']) {
      const r = th.cast[side];
      if (npc.rec.sid !== r.sid || npc.rec.idx !== r.idx || th.vars[`calm${side.toUpperCase()}`]) continue;
      out.push({ id: 'sgf_calm', arg: `${tid(th)}:${side}`, label: `About your quarrel with the ${side === 'a' ? th.vars.fb : th.vars.fa}s...` });
      out.push({ id: 'sgf_side', arg: `${tid(th)}:${side}`, label: 'You\'re in the right. I\'m with you.' });
    }
    return out;
  },
  respond(th, npc, pid, id, arg, S) {
    const side = String(arg).split(':')[1];
    const rng = S.rng(th, 0xfe0);
    const cha = (S.game.hero && S.game.hero.stats ? S.game.hero.stats.cha : 2) || 2;
    const r = recOf(S, th.cast[side]);
    if (!r) return null;
    if (id === 'sgf_calm') {
      const op = S.sim.opinion(npc);
      if (rng.chance(0.2 + cha * 0.08 + op / 200 - (r.personality?.temper ?? 0.5) * 0.25)) {
        th.vars[`calm${side.toUpperCase()}`] = true;
        S.touch(th, pid);
        if (th.vars.calmA && th.vars.calmB) {
          const t = S.tasksOf(th, 'mediate')[0];
          if (t) S.complete(t, R.pl(pid));
          S.end(th, 'peace', `${nameOf(S, R.pl(pid))} made peace between the ${th.vars.fa}s and the ${th.vars.fb}s.`, { news: [th.sid] });
        }
        return { lines: [pick(rng, ['...Maybe you\'re right. It\'s gone too far.', 'Fine. FINE. I\'ll leave it. If they do.', 'I\'m tired of it, if I\'m honest.'])] };
      }
      return { lines: [pick(rng, ['Easy for you to say. It wasn\'t YOUR family.', 'Stay out of it, stranger.', 'Not till they make it right.'])] };
    }
    if (id === 'sgf_side') {
      S.sim.changeRep(npc, 10);
      const o = recOf(S, th.cast[side === 'a' ? 'b' : 'a']);
      const L = layoutOf(S, th.sid);
      if (o && L) S.sim.changeRep(o.ent && !o.ent.dead ? o.ent : { rec: o, settlement: L.settlement, layout: L }, -20);
      th.vars.step++;
      S.note(th, `${nameOf(S, R.pl(pid))} took the ${side === 'a' ? th.vars.fa : th.vars.fb}s' side.`, { by: pid });
      return { lines: ['Finally, someone sees it! Thank you, friend.'] };
    }
    return null;
  },
});

// ------------------------------------------------------------ fever
motif({
  id: 'fever',
  family: 'people',
  max: 2,
  key: (o) => `fever:${o.sid}`,
  title: (th, S) => `Fever in ${townName(S, th.sid)}`,
  scan(S, rng) {
    if (!rng.chance(0.06)) return null;
    for (const L of rng.shuffle(laidTowns(S)).slice(0, 4)) {
      const e = L.econ;
      const poor = (e.famineDays || 0) > 0 || e.treasury < 30 || living(L).filter((r) => r.sick).length >= 2;
      if (!poor && !rng.chance(0.2)) continue;
      return { cast: { town: R.town(L.settlement.id) }, sid: L.settlement.id };
    }
    return null;
  },
  seeds: [{ on: 'famine', make: (ev) => (Math.random() < 0.35 ? { cast: { town: R.town(ev.sid) }, sid: ev.sid } : null) }],
  nodes: {
    spreading: {
      enter(th, S) {
        const L = layoutOf(S, th.sid);
        if (!L) return S.end(th, 'faded');
        const rng = S.rng(th, 0xfe7);
        for (const r of rng.shuffle(living(L).slice()).slice(0, 3)) r.sick = true;
        S.note(th, `A fever has broken out in ${L.settlement.name}.`, { news: [th.sid] });
        const herb = L.npcs.find((r) => alive(r) && r.job === 'herbalist') || mayorOf(L);
        const want = ITEMS.glowcap && /myrrow/i.test(L.settlement.style || '') ? 'glowcap' : 'herb';
        const t = S.post(th, {
          role: 'herbs', kind: 'fetch', title: `Bring the ${herb && herb.job === 'herbalist' ? 'herbalist' : 'council'} of ${L.settlement.name} 6 ${ITEMS[want].name.toLowerCase()} for a cure`, sid: th.sid,
          giver: herb ? R.rec(th.sid, herb.idx) : null, item: want, n: 6,
          pitch: `The fever's spreading. I can make a cure, but I need ${ITEMS[want].name.toLowerCase()}, six at least, and I can't leave the sick. Bring them, and I'll make enough for everyone.`,
          reward: { coins: 20, from: R.town(th.sid), rep: 10, renown: th.sid, renownPts: 5, renownWhy: 'helping fight the fever', items: [['cure', 3]] },
        });
        t.rumour = `There's fever in ${L.settlement.name}`;
        th.vars.dead = 0;
      },
      day(th, S, rng) {
        const L = layoutOf(S, th.sid);
        if (!L) return S.end(th, 'faded');
        const sick = living(L).filter((r) => r.sick);
        if (!sick.length) return S.go(th, 'gone', `The fever in ${L.settlement.name} has run its course.`, { news: [th.sid] });
        // It spreads, and it kills.
        const well = living(L).filter((r) => !r.sick);
        for (const r of rng.shuffle(well.slice()).slice(0, th.vars.cured ? 0 : rng.int(0, 2))) r.sick = true;
        for (const r of sick) {
          r.hp = Math.max(1, (r.hp ?? r.maxHp ?? 20) - 3);
          if ((r.age === 'elder' || r.age === 'child') && rng.chance(th.vars.cured ? 0.02 : 0.08)) {
            th.vars.dead++;
            S.sim.recordDeath(L, r, 'the fever', null);
          }
        }
        if (th.vars.dead >= 3 && !th.vars.dreadNoted) {
          th.vars.dreadNoted = true;
          S.note(th, `The fever has killed ${th.vars.dead} in ${L.settlement.name}. Families are leaving.`, { news: [th.sid] });
        }
        if (th.vars.cured && rng.chance(0.4)) for (const r of sick) r.sick = false;
      },
      fade: 20,
    },
    gone: { final: true },
  },
  tasks: {
    herbs: {
      done(th, t, by, S) {
        th.vars.cured = true;
        S.note(th, `${nameOf(S, by)} brought the herbs. The herbalist is brewing a cure for everyone.`);
      },
      thanks: () => ['Bless you. Here: take a few doses yourself. Give them to anyone sick you meet.'],
    },
  },
  // The sick can be given a cure.
  townTalk(th, npc, pid, S) {
    if (!npc.rec || !npc.rec.sick || npc.rec.sid !== th.sid) return [];
    if (countItem(S.game.player.inv, 'cure') <= 0) return [];
    return [{ id: 'sgc_cure', arg: tid(th), label: 'Here: drink this. It\'s a cure for the fever.' }];
  },
  respond(th, npc, pid, id, arg, S) {
    if (id !== 'sgc_cure') return null;
    if (countItem(S.game.player.inv, 'cure') <= 0) return { lines: ['...'] };
    removeItem(S.game.player.inv, 'cure', 1);
    npc.rec.sick = false;
    npc.rec.hp = npc.rec.maxHp || npc.rec.hp;
    S.sim.changeRep(npc, 15);
    S.person(pid).fame += 0.5;
    S.note(th, `${nameOf(S, R.pl(pid))} gave ${fullName(npc.rec)} a cure.`, { by: pid });
    return { lines: ['Ugh, it\'s bitter... oh. Oh, I can feel it working. Thank you!'] };
  },
});

// ------------------------------------------------------------ a runaway
motif({
  id: 'runaway',
  family: 'people',
  max: 2,
  key: (o) => refKey(o.cast.youth),
  title: (th, S) => `${th.names.youth} Ran Off to ${th.vars.to === 'band' ? 'the Outlaws' : 'See the World'}`,
  scan(S, rng) {
    if (!rng.chance(0.05)) return null;
    for (const L of rng.shuffle(laidTowns(S)).slice(0, 4)) {
      const young = living(L).filter((r) => r.age === 'adult' && r.grown && !r.partner && (r.parents || []).some((i) => L.npcs[i] && alive(L.npcs[i])));
      if (!young.length) continue;
      const y = rng.pick(young);
      const par = (y.parents || []).map((i) => L.npcs[i]).find((r) => r && alive(r));
      const bands = bandsNear(S, L.settlement.id, 8);
      const to = bands.length && (y.personality?.temper ?? 0.5) > 0.45 ? 'band' : 'road';
      return { cast: { youth: R.rec(L.settlement.id, y.idx), parent: R.rec(L.settlement.id, par.idx), band: to === 'band' ? R.band(bands[0].id) : null, town: R.town(L.settlement.id) }, sid: L.settlement.id, vars: { to } };
    }
    return null;
  },
  anchors: (th, S) => {
    const b = th.cast.band && resolve(S, th.cast.band);
    return b && b.camp ? [{ x: b.camp.x, z: b.camp.z }] : [];
  },
  nodes: {
    gone: {
      enter(th, S) {
        const y = recOf(S, th.cast.youth);
        if (!y) return S.end(th, 'faded');
        y.away = true;
        if (y.ent && !y.ent.dead) S.game.despawnNpc(y.ent);
        const b = th.cast.band && resolve(S, th.cast.band);
        if (th.vars.to === 'band' && b && b.camp) {
          S.note(th, `${fullName(y)} ran off in the night to join ${b.name}.`, { news: [th.sid] });
          const P = { x: b.camp.fire.x + 3, z: b.camp.fire.z + 1 };
          S.actor(th, {
            key: 'youth', kind: 'npc', role: 'runaway', talk: true, at: P,
            person: { name: y.name, look: { ...y.look, hat: 'hood' }, personality: y.personality, traits: y.traits, age: 'adult', job: 'bandit', maxHp: y.maxHp || 20, title: 'New Recruit' },
            orders: { home: P, outlaw: true, lines: ['This is the life.', 'Nobody tells me what to do here.'], mark: 'talk' },
          });
          S.post(th, {
            role: 'bring', kind: 'find', title: `Bring ${y.name.first} home from ${poss(b.name)} camp`, sid: th.sid, giver: th.cast.parent, at: P, r: 4,
            pitch: `${y.name.first} has run off to join ${b.name}. My child, an outlaw! They'll be dead in a month, or hanged. Please: talk sense into them, bring them home.`,
            reward: { coins: 20, from: th.cast.parent, rep: 15, fame: 1 },
          });
        } else {
          S.note(th, `${fullName(y)} packed a bag and went off to see the world.`, { news: [th.sid] });
          S.end(th, 'gone');
        }
      },
      day(th, S, rng) {
        const b = th.cast.band && resolve(S, th.cast.band);
        // Too long with them: one of them now.
        if (b && S.now - th.nodeAt > 4 * DAY && !th.vars.leader && rng.chance(0.3)) {
          const y = recOf(S, th.cast.youth);
          const L = layoutOf(S, th.sid);
          if (y && L) {
            S.sim.bandits.recruit(y, L, S.day, rng);
            y.migrated = true;
          }
          S.dismissActor(th, 'youth');
          const t = S.tasksOf(th, 'bring')[0];
          if (t) S.closeTask(t, 'failed');
          S.end(th, 'outlaw', `${th.names.youth} is one of ${b.name} now, for good.`, { news: [th.sid] });
        }
      },
      live(th, S) {
        const e = S.actorEnt(th, 'youth');
        if (!e || !th.vars.leader) return;
        if (S.game.world.ow.settlementAt(e.x, e.z) === town(S, th.sid)) {
          const t = S.tasksOf(th, 'bring')[0];
          if (t) S.complete(t, R.pl(th.vars.leader));
          const y = recOf(S, th.cast.youth);
          if (y) y.away = false;
          S.dismissActor(th, 'youth');
          S.end(th, 'home', `${nameOf(S, R.pl(th.vars.leader))} brought ${th.names.youth} home from the outlaws.`, { news: [th.sid] });
        }
      },
      on: {
        band_gone(th, ev, S) {
          if (!th.cast.band || ev.band !== th.cast.band.id) return;
          const y = recOf(S, th.cast.youth);
          if (y) y.away = false;
          S.dismissActor(th, 'youth');
          S.end(th, 'home', `With ${ev.name} gone, ${th.names.youth} crept home, ashamed.`, { news: [th.sid] });
        },
      },
    },
  },
  tasks: { bring: {} },
  hello: (th, a, npc, pid) => (th.vars.leader ? 'Fine. I\'m coming.' : 'What do you want? Did my parents send you?'),
  talk(th, a, npc, pid) {
    if (th.vars.leader) return [];
    return [
      { id: 'sgr_home', arg: tid(th), label: 'Your family\'s worried sick. Come home.' },
      { id: 'sgr_truth', arg: tid(th), label: 'You know how outlaws end up. On the gallows, or in a ditch.' },
    ];
  },
  respond(th, npc, pid, id, arg, S) {
    const rng = S.rng(th, 0x4a7);
    const go = () => {
      th.vars.leader = pid;
      const t = S.tasksOf(th, 'bring')[0];
      if (t && !S.claimedBy(t, pid)) S.accept(t, R.pl(pid));
      const a = S.actorSpec(th, 'youth');
      if (a) a.orders = { ...(a.orders || {}), follow: pid, mark: null };
      if (npc.saga) {
        npc.saga.follow = pid;
        npc.saga.mark = null;
      }
    };
    if (id === 'sgr_home') {
      if (rng.chance(0.4)) {
        go();
        return { lines: ['...They\'re worried? ...Fine. Fine! Take me home before the chief sees.'], close: true };
      }
      return { lines: ['I\'m not a child any more!'] };
    }
    if (id === 'sgr_truth') {
      if (rng.chance(0.65)) {
        go();
        return { lines: ['...', 'I saw them cut a man\'s throat yesterday. Just for his boots.', 'Get me out of here.'], close: true };
      }
      return { lines: ['You don\'t know them!'] };
    }
    return null;
  },
});

// ------------------------------------------------------------ a challenge
motif({
  id: 'challenge',
  family: 'people',
  max: 2,
  key: (o) => refKey(o.cast.hero),
  title: (th, S) => `${th.vars.champ ? th.vars.champ.name.first : 'A Champion'} Calls Out ${nameOf(S, th.cast.hero)}`,
  scan(S, rng) {
    for (const { pid } of S.players()) {
      const k = S.person(pid);
      if (k.fame < 10 || !rng.chance(0.04) || (k.challenged || 0) > S.now - 10 * DAY) continue;
      const tw = inTown(S, pid);
      if (!tw) continue;
      k.challenged = S.now;
      const champ = makePerson(rng, tw.style, 'champion');
      return { cast: { hero: R.pl(pid), town: R.town(tw.id) }, sid: tw.id, vars: { champ }, touched: [pid] };
    }
    return null;
  },
  nodes: {
    called: {
      enter(th, S) {
        const pid = th.cast.hero.pid;
        const p = playerOf(S.game, pid);
        if (!p) return S.end(th, 'faded');
        const rng = S.rng(th, 0xc4a);
        const at = spotNear(S, p.x, p.z, 8, 12, rng, { clear: -999, flat: 0 }) || { x: Math.round(p.x + 8), z: Math.round(p.z) };
        S.actor(th, {
          key: 'champ', kind: 'npc', role: 'challenger', talk: true, at, person: th.vars.champ,
          orders: { seek: pid, markFor: pid, mark: 'talk', hail: `${nameOf(S, th.cast.hero)}! I've walked a long way to find you.`, patience: 200 },
        });
        S.note(th, `${th.vars.champ.name.first} ${th.vars.champ.name.last}, a champion, came to ${townName(S, th.sid)} looking for ${nameOf(S, th.cast.hero)}.`, { news: [th.sid] });
      },
      on: {
        duel_won(th, ev, S) {
          if (ev.actor !== `${th.id}:duel`) return;
          S.dismissActor(th, 'duel');
          S.person(th.cast.hero.pid).fame += 5;
          S.person(th.cast.hero.pid).titles.push(`Bested ${th.vars.champ.name.first} ${th.vars.champ.name.last}`);
          if (ITEMS[th.vars.champ.weapon]) S.give(th.cast.hero.pid, th.vars.champ.weapon, 1);
          S.end(th, 'won', `${nameOf(S, th.cast.hero)} beat ${th.vars.champ.name.first} ${th.vars.champ.name.last} in single combat, and took their blade as the prize.`, { news: [th.sid] });
        },
        player_yielded(th, ev, S) {
          if (ev.pid !== th.cast.hero.pid || ev.byActor !== `${th.id}:duel`) return;
          S.person(ev.pid).fame = Math.max(0, S.person(ev.pid).fame - 4);
          S.dismissActor(th, 'duel');
          S.end(th, 'lost', `${th.vars.champ.name.first} ${th.vars.champ.name.last} beat ${nameOf(S, th.cast.hero)}, and walks away the more famous of the two.`, { news: [th.sid] });
        },
        kill(th, ev, S) {
          if (ev.actor !== `${th.id}:duel`) return;
          S.person(th.cast.hero.pid).fame += 5;
          S.person(th.cast.hero.pid).titles.push(`Bested ${th.vars.champ.name.first} ${th.vars.champ.name.last}`);
          S.end(th, 'won', `${nameOf(S, th.cast.hero)} beat ${th.vars.champ.name.first} ${th.vars.champ.name.last} in single combat.`, { news: [th.sid] });
        },
        player_died(th, ev, S) {
          if (ev.pid !== th.cast.hero.pid || ev.byActor !== `${th.id}:duel`) return;
          S.person(ev.pid).fame = Math.max(0, S.person(ev.pid).fame - 4);
          S.dismissActor(th, 'duel');
          S.end(th, 'lost', `${th.vars.champ.name.first} ${th.vars.champ.name.last} beat ${nameOf(S, th.cast.hero)}, and walks away the more famous of the two.`, { news: [th.sid] });
        },
      },
      day(th, S) {
        if (S.now - th.nodeAt > 2 * DAY) S.end(th, 'faded', `${th.vars.champ.name.first} got tired of waiting and moved on.`);
      },
    },
  },
  hello: (th) => 'They say you\'re the best in these parts. I say we find out.',
  talk(th, a, npc, pid) {
    if (a.role !== 'challenger' || pid !== th.cast.hero.pid) return [];
    return [
      { id: 'sgx_yes', arg: tid(th), label: 'Draw, then.' },
      { id: 'sgx_no', arg: tid(th), label: 'I\'ve nothing to prove to you.' },
    ];
  },
  respond(th, npc, pid, id, arg, S) {
    if (id === 'sgx_yes') {
      const at = { x: Math.round(npc.x), z: Math.round(npc.z) };
      S.dismissActor(th, 'champ');
      S.actor(th, { key: 'duel', kind: 'npc', role: 'champion', hostile: true, at, person: th.vars.champ, orders: { target: pid, brave: true, cry: 'Have at you!' } });
      return { lines: ['Ha! Good!'], close: true };
    }
    if (id === 'sgx_no') {
      S.person(pid).fame = Math.max(0, S.person(pid).fame - 1);
      S.dismissActor(th, 'champ');
      S.end(th, 'declined', `${nameOf(S, R.pl(pid))} turned down ${th.vars.champ.name.first}'s challenge. Folk are talking.`, { news: [th.sid] });
      return { lines: ['Coward. Everyone will hear of it.'], close: true };
    }
    return null;
  },
});

// Beaten by a champion in single combat: you yield (not die).
HOOKS.subdue.push((S, p, source) => {
  const wb = source && source.warband;
  if (!wb || wb.kind !== 'saga' || wb.role !== 'champion' || wb.capture) return false;
  const pid = pidOf(p);
  if (wb.target !== pid) return false;
  p.hp = Math.max(1, Math.round(p.maxHp * 0.2));
  wb.phase = 'done';
  source.threat = null;
  source.say?.('Yield! It\'s done.', 3, '#ffe070');
  S.asPid(pid, () => S.game.ui.msg('You yield.', '#c8c8c8'));
  S.emit('player_yielded', { pid, byActor: source.sagaKey });
  return true;
});

export { vendettaFor };
