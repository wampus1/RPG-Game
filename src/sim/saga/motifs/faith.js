// Faith (round 52).
//
//   - A stolen relic: the saint's bones gone from the temple in the night
//     (outlaws who raided the town, or a thief). The priest wants them back.
//   - A pilgrim: an old soul wants to see the holy city before they die,
//     and needs someone to walk them there, past whatever's on the road.
//   - An omen: before the Sleeper wakes the priests of Kharos ask for
//     offerings at the altar (obsidian and sulphur), and those who give
//     are remembered when the ash comes down.
import { motif, R, refKey, nameOf, resolve, playerOf } from '../core.js';
import { layoutOf, laidTowns, town, townName, townMid, living, spotNear, bandsNear, outInTheOpen } from './lib.js';
import { fromBandit } from '../actors.js';
import { stash } from './camp.js';
import { mayorOf, alive, DAY } from '../../econ.js';
import { religionOf } from '../../culture.js';
import {} from '../../../game/inventory.js';


// ------------------------------------------------------------ a stolen relic
motif({
  id: 'relic',
  family: 'faith',
  max: 2,
  key: (o) => `relic:${o.sid}`,
  title: (th, S) => `The Stolen Bones of ${townName(S, th.sid)}`,
  seeds: [
    // Outlaws who raided a town with a temple took more than coin.
    { on: 'raid', make: (ev, S) => {
      if (!ev.won || Math.random() > 0.3) return null;
      const L = layoutOf(S, ev.sid);
      if (!L || !L.buildings.some((b) => b.type === 'temple' || b.type === 'shrine')) return null;
      return { cast: { band: R.band(ev.band), town: R.town(ev.sid) }, sid: ev.sid };
    } },
  ],
  anchors: (th, S) => {
    const b = resolve(S, th.cast.band);
    return b && b.camp ? [{ x: b.camp.x, z: b.camp.z }] : [];
  },
  nodes: {
    taken: {
      enter(th, S) {
        const L = layoutOf(S, th.sid);
        const b = resolve(S, th.cast.band);
        if (!L || !b) return S.end(th, 'faded');
        const faith = religionOf(L.settlement);
        th.vars.saint = faith ? `${faith.god}'s saint` : 'the saint';
        stash(S, b, [{ item: 'holy_relic', count: 1 }]);
        const priest = L.npcs.find((r) => alive(r) && r.job === 'priest') || mayorOf(L);
        S.note(th, `When ${b.name} raided ${L.settlement.name} they took the bones of ${th.vars.saint} from the temple.`, { news: [th.sid] });
        const t = S.post(th, {
          role: 'return', kind: 'retrieve', title: `Bring the relic of ${th.vars.saint} back to ${L.settlement.name}`, sid: th.sid,
          giver: priest ? R.rec(th.sid, priest.idx) : null, item: 'holy_relic', n: 1,
          pitch: `The bones of ${th.vars.saint} have lain in our temple for three hundred years. ${b.name} took them, box and all, and they'll melt the silver down. Bring them back. The ${faith ? faith.god : 'gods'} will remember you.`,
          at: b.camp ? { x: b.camp.x, z: b.camp.z } : null, r: 30, reward: { coins: 30, from: R.town(th.sid), rep: 15, renown: th.sid, renownPts: 5, renownWhy: 'returning the saint\'s bones', fame: 2 },
        });
        t.rumour = `${b.name} stole the saint's bones from ${L.settlement.name}`;
      },
      fade: 30,
    },
  },
  tasks: {
    return: {
      npcs: { adv: 0.05 },
      thanks: (th, t, pid, S) => {
        const p = playerOf(S.game, pid);
        if (p) {
          p.hp = p.maxHp;
          p.addBlue?.(4, `relic:${th.id}`);
        }
        return ['The saint is home. Kneel: let me bless you. (You feel the warmth of it: healed, and more.)'];
      },
      done(th, t, by, S) {
        S.end(th, 'returned', `${nameOf(S, by)} brought the bones of ${th.vars.saint} home to ${townName(S, th.sid)}.`, { news: [th.sid] });
      },
    },
  },
});

// ------------------------------------------------------------ a pilgrim
motif({
  id: 'pilgrim',
  family: 'faith',
  max: 2,
  key: (o) => refKey(o.cast.pilgrim),
  title: (th, S) => `${th.names.pilgrim}'s Last Pilgrimage`,
  scan(S, rng) {
    if (!rng.chance(0.06)) return null;
    for (const L of rng.shuffle(laidTowns(S)).slice(0, 4)) {
      const old = living(L).filter((r) => r.age === 'elder' && (r.traits || []).includes('devout'));
      if (!old.length) continue;
      const faith = religionOf(L.settlement);
      const dest = faith && S.sim.religion && S.sim.religion.holyCity ? S.sim.religion.holyCity(faith.key) : null;
      if (!dest || dest.id === L.settlement.id || Math.hypot(dest.cx - L.settlement.cx, dest.cz - L.settlement.cz) > 18) continue;
      return { cast: { pilgrim: R.rec(L.settlement.id, rng.pick(old).idx), town: R.town(L.settlement.id), dest: R.town(dest.id) }, sid: L.settlement.id, vars: { god: faith.god } };
    }
    return null;
  },
  nodes: {
    asking: {
      enter(th, S) {
        const t = S.post(th, {
          role: 'walk', kind: 'escort', title: `Walk ${th.names.pilgrim} to the temple in ${townName(S, th.cast.dest.sid)}`, sid: th.sid, giver: th.cast.pilgrim, hand: 'auto',
          pitch: `I've prayed to ${th.vars.god} every day of my life, and never once seen the great temple in ${townName(S, th.cast.dest.sid)}. My legs won't take me there alone, and the roads aren't safe. Would you walk with me? I'd die happy.`,
          reward: { coins: 20, from: th.cast.pilgrim, rep: 20, renown: th.sid, renownPts: 3, renownWhy: 'a kindness to an old pilgrim', fame: 1 },
        });
        t.offerLabel = 'You look like you\'ve somewhere to be, grandmother.';
      },
      day(th, S) {
        if (S.now - th.nodeAt > 8 * DAY) S.end(th, 'faded');
      },
    },
    walking: {
      enter(th, S, o) {
        const r = resolve(S, th.cast.pilgrim);
        if (!r) return S.end(th, 'faded');
        th.vars.leader = o.pid;
        r.away = true;
        const at = r.ent && !r.ent.dead ? { x: Math.round(r.ent.x), z: Math.round(r.ent.z) } : townMid(town(S, th.sid));
        if (r.ent && !r.ent.dead) S.game.despawnNpc(r.ent);
        S.actor(th, {
          key: 'pilgrim', kind: 'npc', role: 'pilgrim', talk: true, at, stay: true,
          person: { name: r.name, look: r.look, personality: r.personality, traits: r.traits, age: 'elder', job: r.job, maxHp: r.maxHp || 14, title: 'Pilgrim' },
          orders: { follow: o.pid, lines: [`Praise ${th.vars.god}.`, 'Slower, child. My knees.', 'I can almost see it.', 'When I was young I walked this road twice as fast.'] },
        });
      },
      live(th, S) {
        const e = S.actorEnt(th, 'pilgrim');
        if (!e) return;
        const d = town(S, th.cast.dest.sid);
        if (d && S.game.world.ow.settlementAt(e.x, e.z) === d) {
          const t = S.tasksOf(th, 'walk')[0];
          if (t) S.complete(t, R.pl(th.vars.leader));
          S.dismissActor(th, 'pilgrim');
          const r = resolve(S, th.cast.pilgrim);
          if (r) {
            r.away = false;
            (r.life ||= {}).pilgrimage = S.day;
          }
          S.end(th, 'arrived', `${nameOf(S, R.pl(th.vars.leader))} walked old ${th.names.pilgrim} all the way to the temple in ${d.name}.`, { news: [th.sid] });
        }
      },
      // Outlaws on the road, now and then.
      hour(th, S, rng) {
        if (th.vars.ambushed || !outInTheOpen(S, th.vars.leader) || !rng.chance(0.06)) return;
        const p = playerOf(S.game, th.vars.leader);
        const b = bandsNear(S, th.sid, 14)[0];
        if (!p || !b) return;
        th.vars.ambushed = true;
        const at = spotNear(S, p.x, p.z, 16, 22, rng, { clear: 0, flat: 0 });
        if (!at) return;
        b.members.filter((m) => !m.out).slice(0, 2).forEach((m, i) => {
          m.out = true;
          S.actor(th, { key: `b${m.id}`, kind: 'npc', role: 'hunter', hostile: true, at: { x: at.x + i, z: at.z }, person: fromBandit(m, b), orders: { target: th.vars.leader, cry: 'An old one with a full purse! Get them!' } });
        });
      },
    },
  },
  tasks: {
    walk: {
      accepted(th, t, who, S) {
        if (who.t === 'pl' && th.node === 'asking') S.go(th, 'walking', null, { pid: who.pid });
      },
      thanks: () => ['I\'ve seen it. I\'ve seen it with my own eyes. Here, child: everything I brought. I won\'t need it now.'],
    },
  },
  hello: (th) => 'Are we close? I can feel it.',
});

// ------------------------------------------------------------ an omen
motif({
  id: 'omen',
  family: 'faith',
  max: 1,
  key: () => 'omen',
  title: () => 'The Sleeper Stirs',
  scan(S, rng) {
    const V = S.sim.volcano;
    if (!V || V.next === undefined || V.next - S.day > 3 || V.next - S.day < 1) return null;
    const kh = laidTowns(S).filter((L) => /ash|kharos/i.test(L.settlement.style || '') || (S.game.world.ow.islandAt && S.game.world.ow.islandAt(townMid(L.settlement).x, townMid(L.settlement).z) === 'kharos'));
    if (!kh.length) return null;
    return { cast: { town: R.town(kh[0].settlement.id) }, sid: kh[0].settlement.id, vars: { next: V.next } };
  },
  nodes: {
    stirring: {
      enter(th, S) {
        const L = layoutOf(S, th.sid);
        const priest = L && (L.npcs.find((r) => alive(r) && r.job === 'priest') || mayorOf(L));
        S.note(th, 'The ground shakes on Kharos. The priests say the Sleeper is waking.', { news: [th.sid] });
        S.post(th, {
          role: 'offering', kind: 'fetch', title: 'Bring offerings of obsidian to the Sleeper\'s priests', sid: th.sid, giver: priest ? R.rec(th.sid, priest.idx) : null, item: 'obsidian_shard', n: 4,
          pitch: 'The Sleeper turns over in the deep. Before it wakes, we lay its own glass on the altar, so it knows we remember it. Four shards of obsidian. Hurry.',
          reward: { coins: 15, from: R.town(th.sid), rep: 10, renown: th.sid, renownPts: 3, renownWhy: 'the offering to the Sleeper', fame: 1 },
        });
      },
      on: {
        eruption(th, ev, S) {
          const given = S.tasksOf(th, 'offering').length === 0;
          S.end(th, given ? 'appeased' : 'woke', given ? 'The Sleeper woke, as it always does; but the faithful of Kharos say it was gentler, for the offering.' : 'The Sleeper woke, and nobody had laid an offering on its altar.');
        },
      },
      fade: 8,
    },
  },
  tasks: { offering: { thanks: () => ['The Sleeper will remember. And so will we.'] } },
});
