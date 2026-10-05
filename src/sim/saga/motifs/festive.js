// Good days (round 54): not every story is trouble.
//
//   - A festival: a town decides to hold one (its innkeeper's idea, or the
//     priest's, or the mayor's, or just someone who loves a party). There
//     are things to get ready (food for the tables, flowers, someone to
//     play) and a contest on the night (riddles, an eating match, a
//     wrestling ring). On the day it can be merry, or rained off, or
//     raided for its purse, or end in a brawl, or two people dance all
//     night and something begins.
//   - A tournament: a town calls the best blades about for a contest of
//     arms. Enter, and fight your bouts in the ring (to yielding, not to
//     death); or watch the favourite fall to a stranger in a mask. Someone
//     may offer you money to lose.
//   - A bard's song: a wandering singer at the tavern, making a song about
//     you (tell it true, or make it grander, or ask them not to), or about
//     an outlaw who won't like it, or about the mayor (who won't either).
//     The song goes from town to town.
//   - A harvest: a bumper year (and the harvest home), or a storm coming
//     and the fields not in, or something in the crops.
import { motif, R, nameOf } from '../core.js';
import { pick, say, layoutOf, laidTowns, townName, townMid, living, adults, fullName, recOf, has, nat, single, blood, bandsNear, isRec, persuade, someone } from './lib.js';
import { makePerson } from '../actors.js';
import { mayorOf, alive, DAY, ledger } from '../../econ.js';
import { ITEMS } from '../../../world/items.js';
import { countItem, removeItem } from '../../../game/inventory.js';
import { RNG, hash4 } from '../../../util/rng.js';

const tid = (th) => `t${th.id}`;
const isFood = (k) => ITEMS[k] && ITEMS[k].kind === 'food';
const foodCount = (p) => p.inv.reduce((n, q) => n + (q && isFood(q.item) ? q.count : 0), 0);
function eatFrom(p, n) {
  let left = n;
  for (const q of p.inv) {
    if (!q || !isFood(q.item) || left <= 0) continue;
    const k = Math.min(q.count, left);
    removeItem(p.inv, q.item, k);
    left -= k;
  }
}

// ------------------------------------------------------------ a festival
const FEST_NAMES = {
  any: ['the Lantern Night', 'the Midsummer Fair', 'the Goose Fair', 'the Moon Market', 'Founders\' Day', 'the Night of a Hundred Fires', 'the Ribbon Dance', 'the Fool\'s Feast'],
  coast: ['the Feast of the First Catch', 'the Blessing of the Boats', 'the Tide Fair'],
  farm: ['the Apple Fair', 'the Harvest Home', 'the Haymakers\' Dance'],
  kharos: ['the Ember Dance', 'the Night of Cinders'],
  myrrow: ['the Mist Lanterns', 'the Moth Moon'],
};
const RIDDLES = [
  { q: 'What has roots nobody sees, is taller than trees, up, up it goes, and yet never grows?', a: 'A mountain', w: ['A tree', 'A tower'] },
  { q: 'Thirty white horses on a red hill: now they champ, now they stamp, now they stand still.', a: 'Teeth', w: ['Clouds', 'Waves'] },
  { q: 'The more you take, the more you leave behind.', a: 'Footsteps', w: ['Breath', 'Coins'] },
  { q: 'What can run but never walks, has a mouth but never talks, has a bed but never sleeps?', a: 'A river', w: ['A road', 'A clock'] },
  { q: 'I\'m light as a feather, yet the strongest can\'t hold me for long.', a: 'Breath', w: ['A secret', 'A shadow'] },
  { q: 'What has one eye, but cannot see?', a: 'A needle', w: ['A storm', 'A potato'] },
  { q: 'What gets wetter the more it dries?', a: 'A towel', w: ['Rain', 'Bread'] },
  { q: 'Feed me and I live, give me a drink and I die.', a: 'Fire', w: ['A plant', 'A pig'] },
  { q: 'What has a neck but no head, and wears a cap?', a: 'A bottle', w: ['A ghost', 'A mushroom'] },
];
const CONTESTS = ['riddles', 'eating', 'wrestling'];

function festName(S, L, rng) {
  const s = L.settlement;
  const pool = [...FEST_NAMES.any];
  if (/kharos/.test(s.island || '')) pool.push(...FEST_NAMES.kharos, ...FEST_NAMES.kharos);
  if (/myrrow/.test(s.island || '')) pool.push(...FEST_NAMES.myrrow, ...FEST_NAMES.myrrow);
  if (L.spotsByTag && L.spotsByTag('fish').length) pool.push(...FEST_NAMES.coast);
  if (L.fields && L.fields.length) pool.push(...FEST_NAMES.farm);
  return pick(rng, pool);
}

motif({
  id: 'festival',
  family: 'festive',
  max: 3,
  key: (o) => `fest:${o.sid}`,
  title: (th, S) => `${th.vars.name[0].toUpperCase()}${th.vars.name.slice(1)} in ${townName(S, th.sid)}`,
  scan(S, rng) {
    if (!rng.chance(0.09)) return null;
    for (const L of rng.shuffle(laidTowns(S)).slice(0, 3)) {
      const e = L.econ;
      if ((e.famineDays || 0) > 0 || S.sim.events.upcoming(L).length || adults(L).length < 6) continue;
      return { cast: { town: R.town(L.settlement.id) }, sid: L.settlement.id, vars: { name: festName(S, L, rng) } };
    }
    return null;
  },
  nodes: {
    planning: {
      enter(th, S) {
        const L = layoutOf(S, th.sid);
        if (!L) return S.end(th, 'faded');
        const rng = S.rng(th, 0xfe5);
        // Whose idea it was (and whose party it is).
        const ppl = adults(L);
        const by = S.choose(th, [
          { to: 'mayor', w: mayorOf(L) ? 1 : 0 },
          { to: 'innkeeper', w: ppl.some((r) => ['innkeeper', 'barkeep'].includes(r.job)) ? 1.1 : 0 },
          { to: 'priest', w: ppl.some((r) => r.job === 'priest') ? 0.7 : 0 },
          { to: 'reveller', w: ppl.some((r) => has(r, 'cheerful') || has(r, 'outgoing')) ? 1 : 0.2 },
        ], rng).to;
        const host = by === 'mayor' ? mayorOf(L) : by === 'innkeeper' ? ppl.find((r) => ['innkeeper', 'barkeep'].includes(r.job)) : by === 'priest' ? ppl.find((r) => r.job === 'priest') : pick(rng, ppl.filter((r) => has(r, 'cheerful') || has(r, 'outgoing'))) || pick(rng, ppl);
        if (!host) return S.end(th, 'faded');
        th.cast.host = R.rec(th.sid, host.idx);
        th.names.host = fullName(host);
        th.vars.by = by;
        th.vars.cheer = 0;
        th.vars.contest = pick(rng, CONTESTS);
        // What the day has in store (it comes out as it comes).
        const singles = ppl.filter((r) => single(L, r) && !r.courting);
        const hot = ppl.filter((r) => nat(r, 'temper') > 0.6 || has(r, 'hot-headed'));
        const kids = living(L).filter((r) => r.age === 'child' && !r.away);
        th.vars.twist = S.choose(th, [
          { to: null, w: 1.5 },
          { to: 'rain', w: 0.7 },
          { to: 'raid', w: bandsNear(S, th.sid, 10).length ? 0.8 : 0 },
          { to: 'brawl', w: hot.length >= 2 ? 0.7 : 0 },
          { to: 'lovers', w: singles.length >= 2 ? 1 : 0 },
          { to: 'lost', w: kids.length ? 0.4 : 0 },
          { to: 'bard', w: 0.5 },
        ], rng).to;
        const ev = S.sim.events.announce(L, 'feast', S.day, { host: host.idx, spend: 0, name: th.vars.name });
        th.vars.ev = ev.id;
        th.vars.day = ev.day;
        const whose = by === 'mayor' ? 'The council' : by === 'innkeeper' ? `${fullName(host)}, at the tavern,` : by === 'priest' ? `${fullName(host)}, the priest,` : `${fullName(host)}, who loves nothing more than a party,`;
        ledger(L, S.day, `${whose} has called ${th.vars.name} for day ${ev.day + 1}: food, drink and dancing by the square from four. And ${th.vars.contest === 'riddles' ? 'a riddle contest' : th.vars.contest === 'eating' ? 'an eating match' : 'a wrestling ring'}!`);
        S.note(th, `${th.names.host} called ${th.vars.name} in ${L.settlement.name}, for day ${ev.day + 1}.`);
        // What's wanted: food for the tables, flowers, someone to play.
        const cook = ppl.find((r) => ['cook', 'baker', 'innkeeper'].includes(r.job)) || host;
        const t1 = S.post(th, {
          role: 'tables', kind: 'fetch', title: `Bring ${first(cook)} food for the tables (6)`, sid: th.sid, giver: R.rec(th.sid, cook.idx), item: 'food', n: 6,
          pitch: say(rng, ['Tables for the whole town, and my larder\'s half empty. Six of anything good to eat, and I\'ll find you the best seat.', 'They want a feast. I want a miracle. Six good things to eat would be a start.'], {}),
          reward: { coins: 8, rep: 8, fame: 0.5 },
        });
        t1.offerLabel = 'Busy getting ready for the festival?';
        const flower = pick(rng, ['flower_red', 'flower_yellow', 'flower_blue', 'flower_white'].filter((k) => ITEMS[k])) || 'flower_red';
        const t2 = S.post(th, {
          role: 'flowers', kind: 'fetch', title: `Bring ${first(host)} flowers to hang about the square (5)`, sid: th.sid, giver: th.cast.host, item: flower, n: 5,
          pitch: say(rng, ['It isn\'t a festival without flowers. Five, any colour, but {f} if you can.', 'Garlands! Everywhere! I need flowers, five at least: {f}, ideally.'], { f: ITEMS[flower] ? ITEMS[flower].name.toLowerCase() : 'red ones' }),
          reward: { coins: 4, rep: 8, fame: 0.5 },
        });
        t2.offerLabel = 'What\'s all this about a festival?';
      },
      day(th, S, rng) {
        const L = layoutOf(S, th.sid);
        if (!L) return S.end(th, 'faded');
        // (Word of riders on the hill, before a raid.)
        if (th.vars.twist === 'raid' && !th.vars.warned && S.day >= th.vars.day - 1) {
          th.vars.warned = true;
          S.note(th, 'Someone saw riders on the hill, watching the town get ready. Outlaws, after the festival purse?', { news: [th.sid] });
          const g = L.npcs.find((r) => alive(r) && r.job === 'guard') || mayorOf(L);
          const t = S.post(th, {
            role: 'watch', kind: 'defend', title: `Stand watch at ${th.vars.name} in case the outlaws come`, sid: th.sid, giver: g ? R.rec(th.sid, g.idx) : null,
            pitch: 'There were riders on the hill. If they come for the festival purse, I want a blade by the square that isn\'t mine. Be there when it starts?',
            reward: { coins: 20, from: R.town(th.sid), rep: 12, renown: th.sid, renownPts: 3, renownWhy: 'guarding the festival', fame: 1 },
          });
          t.offerLabel = 'You look worried, for a festival.';
        }
        void rng;
        // (The day come, whether or not anyone was looking.)
        const ev = feastOf(S, th);
        if ((ev && ['on', 'over', 'done'].includes(ev.state)) || S.day > th.vars.day) S.go(th, 'feast');
      },
      hour(th, S) {
        const ev = feastOf(S, th);
        if (ev && ev.state === 'on') S.go(th, 'feast');
      },
      fade: 10,
    },
    feast: {
      enter(th, S) {
        const L = layoutOf(S, th.sid);
        const rng = S.rng(th, 0xfea);
        if (!L) return S.end(th, 'faded');
        const t = th.vars.twist;
        th.vars.cheer += S.tasksOf(th).length ? 0 : 1;
        const here = S.players().filter(({ p }) => Math.max(Math.abs(p.x - townMid(L.settlement).x), Math.abs(p.z - townMid(L.settlement).z)) < 50).map((q) => q.pid);
        if (here.length) th.vars.cheer++;
        if (t === 'lovers') {
          const ppl = adults(L).filter((r) => single(L, r) && !r.courting);
          const a = pick(rng, ppl);
          const b = a && pick(rng, ppl.filter((q) => q !== a && q.household !== a.household && !blood(a, q)));
          if (a && b) {
            S.note(th, `${fullName(a)} and ${fullName(b)} danced every dance together. ${pick(rng, ['Nobody could get a word in.', 'People are already talking.', 'Neither of them stopped smiling.'])}`);
            S.split(th, 'courtship', { cast: { a: R.rec(th.sid, a.idx), b: R.rec(th.sid, b.idx), town: R.town(th.sid) }, sid: th.sid, vars: { met: `dancing at ${th.vars.name}`, ha: 0.65, hb: 0.55 } });
          }
        } else if (t === 'lost') {
          const kids = living(L).filter((r) => r.age === 'child' && !r.away);
          const c = pick(rng, kids);
          const par = c && (c.parents || []).map((i) => L.npcs[i]).find((r) => r && alive(r));
          const m = townMid(L.settlement);
          if (c && par) S.split(th, 'lost_child', { cast: { child: R.rec(th.sid, c.idx), parent: R.rec(th.sid, par.idx), town: R.town(th.sid) }, sid: th.sid, spots: [{ x: m.x + rng.int(-60, 60), z: m.z + rng.int(45, 80) * (rng.chance(0.5) ? 1 : -1) }], vars: { at: { x: m.x + rng.int(-60, 60), z: m.z + 60 } } }, `In the crowds at ${th.vars.name}, a child went missing.`);
        } else if (t === 'bard') {
          S.split(th, 'bard_song', { cast: { town: R.town(th.sid) }, sid: th.sid, vars: { from: th.vars.name } }, `A wandering singer turned up for ${th.vars.name}, and stayed.`);
        } else if (t === 'raid') {
          const watch = S.tasksOf(th, 'watch')[0];
          const by = watch ? watch.claims.filter((c) => c.who.t === 'pl').map((c) => c.who.pid).find((pid) => here.includes(pid)) : null;
          if (by) {
            const m = townMid(L.settlement);
            const style = L.settlement.style || 'vale';
            for (let i = 0; i < rng.int(2, 3); i++) {
              const a = rng.float(0, Math.PI * 2);
              S.actor(th, { key: `raider${i}`, kind: 'npc', role: 'raider', hostile: true, at: { x: Math.round(m.x + Math.cos(a) * 18), z: Math.round(m.z + Math.sin(a) * 18) }, person: makePerson(rng, style, 'outlaw'), orders: { target: by, brave: rng.chance(0.5), cry: pick(rng, ['The purse! Get the purse!', 'Nobody move!', 'Party\'s over!']) } });
            }
            th.vars.raiding = by;
            S.tell(by, 'Outlaws! Coming for the festival purse!', '#ff9080');
          }
        }
      },
      live(th, S) {
        const ev = feastOf(S, th);
        if (!ev || ev.state === 'over' || ev.state === 'done' || ev.state === 'off') wrapUp(th, S);
      },
      day(th, S) {
        const ev = feastOf(S, th);
        if (!ev || ev.state === 'over' || ev.state === 'done' || ev.state === 'off' || S.day > th.vars.day + 1) wrapUp(th, S);
      },
      fade: 3,
    },
  },
  // The wrestling ring: beaten (they yield), or beaten by them (you do).
  on: {
    duel_won(th, ev, S) {
      if (ev.actor !== `${th.id}:ring` || !th.vars.ringFor) return;
      S.dismissActor(th, 'ring');
      prize(th, S, th.vars.ringFor, 'wrestling');
      S.tell(th.vars.ringFor, 'The crowd roars: you\'ve thrown the strongest in town!', '#a0ffa0');
      th.vars.ringFor = null;
    },
    player_yielded(th, ev, S) {
      if (ev.byActor !== `${th.id}:ring`) return;
      S.dismissActor(th, 'ring');
      S.note(th, `${nameOf(S, R.pl(ev.pid))} stepped into the wrestling ring, and was thrown out of it.`);
      th.vars.ringFor = null;
    },
  },
  actorDown(th, a, by, S) {
    if (a.role !== 'raider') return;
    if (th.actors.some((q) => q.role === 'raider' && !q.gone && !q.dead)) return;
    th.vars.raidBeaten = true;
    th.vars.cheer++;
    const t = S.tasksOf(th, 'watch')[0];
    const pid = by && by.t === 'pl' ? by.pid : th.vars.raiding;
    if (t && pid) S.complete(t, R.pl(pid));
    S.note(th, `Outlaws came for the festival purse, and ${pid ? nameOf(S, R.pl(pid)) : 'the town'} drove them off. The dancing started again before the dust settled.`, { news: [th.sid] });
  },
  tasks: {
    tables: { done(th) { th.vars.cheer++; }, thanks: () => ['Now THAT\'S a feast. Save room for pie.'] },
    flowers: { done(th) { th.vars.cheer++; }, thanks: () => ['Oh, it\'ll look like a garden! Thank you!'] },
    watch: {},
    music: {},
  },
  townTalk(th, npc, pid, S) {
    const out = [];
    if (!isRec(npc, th.cast.host)) {
      // (A brawl on the night: someone could step between them.)
      if (th.node === 'feast' && th.vars.twist === 'brawl' && !th.vars.brawlDone && npc.rec && npc.rec.sid === th.sid && (nat(npc.rec, 'temper') > 0.6 || has(npc.rec, 'hot-headed'))) out.push({ id: 'sgv_calm', arg: tid(th), label: 'Easy, friend. It\'s a festival.' });
      return out;
    }
    const playing = S.game.player.inv.some((q) => q && ITEMS[q.item] && ITEMS[q.item].instrument);
    if (playing && !(th.vars.musicians || []).includes(pid) && th.node !== 'feast') out.push({ id: 'sgv_play', arg: tid(th), label: `I'll play for the dancing at ${th.vars.name}.` });
    if (th.node === 'feast' && !(th.vars.entered || []).includes(pid)) out.push({ id: 'sgv_contest', arg: tid(th), label: th.vars.contest === 'riddles' ? 'I\'ll try the riddle contest!' : th.vars.contest === 'eating' ? 'Put me down for the eating match.' : 'I\'ll step into the wrestling ring.' });
    return out;
  },
  respond(th, npc, pid, id, arg, S) {
    const rng = S.rng(th, 0x7e5 + (npc.id | 0));
    switch (id) {
      case 'sgv_play': {
        (th.vars.musicians ||= []).push(pid);
        th.vars.cheer++;
        S.touch(th, pid, `${nameOf(S, R.pl(pid))} offered to play for the dancing.`);
        return { lines: ['A musician! Oh, that settles it: it\'ll be the best one yet. Be by the square when it starts.'] };
      }
      case 'sgv_contest': {
        (th.vars.entered ||= []).push(pid);
        S.touch(th, pid);
        return contest(th, S, rng, npc, pid);
      }
      case 'sgv_riddle': {
        const [i, ans] = String(arg).split(':').slice(1);
        const r = RIDDLES[+i];
        if (!r) return { lines: ['Hm?'] };
        if (ans === 'a') {
          prize(th, S, pid, 'riddles');
          return { lines: [`"${r.a}"! Correct! ${pick(rng, ['The crowd roars.', 'Nobody else got it.', 'The old riddle-master looks very put out.'])}`] };
        }
        return { lines: [`No! It's "${r.a}". ${pick(rng, ['Better luck next year.', 'The crowd groans in sympathy.', 'A child at the front got it. You\'ll never live it down.'])}`] };
      }
      case 'sgv_calm': {
        th.vars.brawlDone = true;
        S.touch(th, pid);
        if (persuade(S, npc, rng, 0.35, nat(npc.rec, 'temper') * 0.3)) {
          th.vars.cheer++;
          S.note(th, `A fight nearly started at ${th.vars.name}, and ${nameOf(S, R.pl(pid))} talked it down.`, { by: pid });
          return { lines: [pick(rng, ['...You\'re right. You\'re right. Who wants a drink?', 'Fine. But only because the music\'s good.'])] };
        }
        th.vars.brawled = true;
        return { lines: ['Stay out of it!', '(They shove past you. Fists fly.)'], close: true };
      }
      default:
        return null;
    }
  },
});

const first = (r) => (r ? r.name.first : 'them');

function feastOf(S, th) {
  const L = layoutOf(S, th.sid);
  return L ? (L.econ.events || []).find((q) => q.id === th.vars.ev) || null : null;
}

function contest(th, S, rng, npc, pid) {
  const kind = th.vars.contest;
  if (kind === 'riddles') {
    const i = rng.int(0, RIDDLES.length - 1);
    const r = RIDDLES[i];
    const opts = rng.shuffle([{ k: 'a', t: r.a }, ...r.w.map((t, j) => ({ k: `w${j}`, t }))]);
    return { lines: ['Here\'s yours, then. Listen carefully:', `"${r.q}"`], choices: opts.map((o) => ({ id: 'sgv_riddle', arg: `${tid(th)}:${i}:${o.k}`, label: o.t })), back: null };
  }
  if (kind === 'eating') {
    const p = S.game.player;
    if (foodCount(p) < 4) return { lines: ['Bring your own, that\'s the rule! Four of something, at least.'] };
    eatFrom(p, 4);
    const win = rng.chance(0.45 + (S.game.hero && S.game.hero.stats ? (S.game.hero.stats.con || 2) * 0.05 : 0.1));
    if (win) {
      prize(th, S, pid, 'eating');
      return { lines: ['(You eat. And eat. And eat. The last one standing, chewing.)', 'A winner! Somebody fetch them a bucket, just in case.'] };
    }
    return { lines: ['(You eat four in a row and slow down. The baker\'s apprentice, beside you, is on their ninth.)', 'Beaten by a lad half your size! Ha! Better luck next year.'] };
  }
  // Wrestling: a bout in the ring with the town's strongest.
  const L = layoutOf(S, th.sid);
  const m = townMid(L.settlement);
  const champ = makePerson(new RNG(hash4(th.seed, 0x3e5)), L.settlement.style || 'vale', 'champion');
  champ.weapon = null;
  champ.title = 'Strongest in Town';
  S.actor(th, { key: 'ring', kind: 'npc', role: 'champion', hostile: true, at: { x: m.x + 2, z: m.z + 2 }, person: champ, orders: { target: pid, brave: true, cry: 'Into the ring!' } });
  th.vars.ringFor = pid;
  return { lines: ['Into the ring, then! First to yield loses.', '(No blades: fists. Probably.)'], close: true };
}

function prize(th, S, pid, kind) {
  const L = layoutOf(S, th.sid);
  th.vars.cheer++;
  S.person(pid).fame += 1;
  S.asPid(pid, (p) => {
    const it = ITEMS.pie ? 'pie' : 'bread';
    const left = p.give(it, 2);
    if (left) S.game.spawnDrop(it, left, p.x, p.y, p.z, true);
    const c = p.give('coin', 10);
    if (c) S.game.spawnDrop('coin', c, p.x, p.y, p.z, true);
  });
  S.note(th, `${nameOf(S, R.pl(pid))} won the ${kind === 'riddles' ? 'riddle contest' : kind === 'eating' ? 'eating match' : 'wrestling'} at ${th.vars.name}.`, { by: pid, news: L ? [th.sid] : [] });
}

function wrapUp(th, S) {
  if (th.done) return;
  const L = layoutOf(S, th.sid);
  const rng = S.rng(th, 0x3a9);
  if (!L) return S.end(th, 'faded');
  const t = th.vars.twist;
  const c = th.vars.cheer;
  for (const q of S.tasksOf(th)) S.closeTask(q, 'lapsed');
  const lift = (n) => {
    for (const r of living(L)) r.mood = Math.max(0, Math.min(1, (r.mood ?? 0.5) + n));
  };
  if (t === 'raid' && !th.vars.raidBeaten) {
    const took = Math.min(Math.floor(L.econ.treasury * 0.3), 80);
    L.econ.treasury -= took;
    lift(-0.1);
    return S.end(th, 'raided', `Outlaws rode through ${th.vars.name} and took the festival purse (¤${took}). Nobody was hurt, but nobody's dancing.`, { news: [th.sid] });
  }
  if (t === 'rain' && c < 3) {
    lift(-0.05);
    return S.end(th, 'washed out', `${th.vars.name[0].toUpperCase()}${th.vars.name.slice(1)} was rained off: the flowers drowned, the tables floated, and everyone went home wet. ${pick(rng, ['Next year, they say.', 'The ale was saved, at least.'])}`, { news: [th.sid] });
  }
  if ((t === 'brawl' && !th.vars.brawlDone) || th.vars.brawled) {
    const ppl = adults(L).filter((r) => nat(r, 'temper') > 0.6 || has(r, 'hot-headed'));
    const [a, b] = rng.shuffle(ppl.slice());
    if (a && b) {
      a.hp = Math.max(1, Math.round((a.hp ?? 20) * 0.7));
      b.hp = Math.max(1, Math.round((b.hp ?? 20) * 0.7));
      S.note(th, `${fullName(a)} and ${fullName(b)} came to blows by the ale barrels. It took four people to pull them apart.`, { news: [th.sid] });
      if (a.name.last !== b.name.last && rng.chance(0.45)) S.split(th, 'feud', { cast: { a: R.rec(th.sid, a.idx), b: R.rec(th.sid, b.idx), town: R.town(th.sid) }, sid: th.sid, vars: { why: `a fight at ${th.vars.name}`, fa: a.name.last, fb: b.name.last, step: 1 } });
    }
  }
  if (t === 'rain') {
    lift(0.15);
    return S.end(th, 'merry', `It poured on ${th.vars.name}, and they danced in the rain anyway. People will talk of it for years.`, { news: [th.sid] });
  }
  lift(c >= 3 ? 0.2 : 0.1);
  L.econ.treasury += c >= 3 ? 15 : 5;
  S.end(th, c >= 3 ? 'merry' : 'over', c >= 3
    ? `${th.vars.name[0].toUpperCase()}${th.vars.name.slice(1)} was the best ${L.settlement.name} has had in years. ${pick(rng, ['They danced till the lanterns burnt out.', 'Even the mayor danced.', 'Nobody remembers going to bed.'])}`
    : `${th.vars.name[0].toUpperCase()}${th.vars.name.slice(1)} came and went. ${pick(rng, ['Pleasant enough.', 'The pie ran out early.', 'A good night, if not a great one.'])}`, { news: [th.sid] });
}

// ------------------------------------------------------------ a tournament
const TOURNEY = ['the Tourney of {t}', 'the {t} Games', 'the Contest of Blades at {t}', 'the Summer Lists of {t}'];

motif({
  id: 'tournament',
  family: 'festive',
  max: 2,
  key: (o) => `tourney:${o.sid}`,
  title: (th) => th.vars.name,
  scan(S, rng) {
    if (!rng.chance(0.05)) return null;
    for (const L of rng.shuffle(laidTowns(S).filter((q) => q.settlement.type !== 'village')).slice(0, 3)) {
      const s = L.settlement;
      return { cast: { town: R.town(s.id) }, sid: s.id, vars: { name: pick(rng, TOURNEY).replace('{t}', s.name) } };
    }
    return null;
  },
  // A champion out to call someone out, in town for the tourney: they
  // enter it instead (and you may meet them in the ring).
  meets: [
    {
      m: 'challenge',
      when: (a, b) => a.node === 'calling' && b.sid === a.sid && !a.vars.challenger,
      then(a, b, S) {
        a.vars.challenger = b.cast.hero.pid;
        const c = b.vars.champ;
        a.vars.field.push({ name: `${c.name.first} ${c.name.last}`, str: 1.4, person: c, from: 'challenge' });
        S.join(a, b, `${c.name.first} ${c.name.last}, who came to town to call out ${nameOf(S, b.cast.hero)}, entered ${a.vars.name} instead: "We'll settle it in the ring."`);
      },
    },
  ],
  nodes: {
    calling: {
      enter(th, S) {
        const L = layoutOf(S, th.sid);
        if (!L) return S.end(th, 'faded');
        const rng = S.rng(th, 0x70e);
        const style = L.settlement.style || 'vale';
        // The field: blades from about, and the town's own.
        th.vars.field = [];
        for (let i = 0; i < 5; i++) {
          const p = makePerson(rng, style, 'champion');
          th.vars.field.push({ name: `${p.name.first} ${p.name.last}`, str: rng.float(0.7, 1.5), person: p });
        }
        const g = L.npcs.find((r) => alive(r) && r.job === 'guard' && !r.away);
        if (g) th.vars.field.push({ name: fullName(g), str: 0.9, rec: g.idx });
        // A favourite (and whether they'll get there).
        th.vars.field.sort((a, b) => b.str - a.str);
        th.vars.fav = th.vars.field[0].name;
        th.vars.masked = rng.chance(0.35);
        th.vars.fee = 10 + rng.int(0, 10);
        th.vars.purse = 60 + rng.int(0, 60);
        th.vars.day = S.day + 2;
        th.vars.players = [];
        ledger(L, S.day, `${th.vars.name} on day ${th.vars.day + 1}: blades from all about, a purse of ¤${th.vars.purse} to the last one standing. The favourite: ${th.vars.fav}. Enter at the square (¤${th.vars.fee}).`);
        S.note(th, `${th.vars.name} was called, for day ${th.vars.day + 1}, with ¤${th.vars.purse} for the winner. ${th.vars.fav} is the favourite.`, { news: [th.sid] });
        const at = townMid(L.settlement);
        S.actor(th, {
          key: 'herald', kind: 'npc', role: 'herald', talk: true, at, stay: true, person: { ...makePerson(rng, style, 'messenger'), title: 'Herald' },
          orders: { home: at, roam: 2, mark: 'talk', lines: [`${th.vars.name}! Enter here!`, `¤${th.vars.purse} to the winner!`, 'Who\'ll try their arm?', 'Blades blunted, honour sharp!'] },
        });
      },
      day(th, S) {
        if (S.day >= th.vars.day) S.go(th, 'lists');
      },
      fade: 6,
    },
    // The day: bout by bout.
    lists: {
      enter(th, S) {
        const rng = S.rng(th, 0x1e5);
        // Round one: drawn by lot (whoever's playing among them).
        const field = [...th.vars.field.map((q) => ({ ...q, person: undefined, hasPerson: !!q.person })), ...th.vars.players.map((pid) => ({ name: nameOf(S, R.pl(pid)), pid, str: 1 }))];
        if (th.vars.masked) field.push({ name: 'the Masked Knight', str: rng.float(1.1, 1.6), masked: true });
        th.vars.round = rng.shuffle(field).slice(0, 8);
        th.vars.roundN = 1;
        th.vars.bout = null;
        // (A favourite hurt in practice, now and then.)
        if (rng.chance(0.25)) {
          const f = th.vars.round.find((q) => q.name === th.vars.fav);
          if (f) {
            f.str *= 0.5;
            S.note(th, `${th.vars.fav}, the favourite, hurt their wrist in practice. They're fighting anyway.`);
          }
        }
        // A word in your ear: lose, and be paid for it.
        const mine = th.vars.players.filter((pid) => playerHere(S, pid));
        if (mine.length && rng.chance(0.35)) {
          th.vars.bribe = { pid: rng.pick(mine), sum: 30 + rng.int(0, 40), took: null };
          S.tell(th.vars.bribe.pid, `A stranger sidles up: "¤${th.vars.bribe.sum} if you go down in your first bout. Nobody needs to know." (Talk to the herald to answer.)`, '#c8a0ff');
        }
        S.note(th, `${th.vars.name} began: ${th.vars.round.length} in the lists.`);
      },
      live(th, S) {
        nextBout(th, S);
      },
      on: {
        duel_won(th, ev, S) {
          const b = th.vars.bout;
          if (!b || ev.actor !== `${th.id}:bout`) return;
          S.dismissActor(th, 'bout');
          b.winner = b.pid;
          if (th.vars.bribe && th.vars.bribe.pid === b.pid && th.vars.bribe.took) {
            th.vars.bribe.broke = true;
            S.tell(b.pid, 'Somewhere in the crowd, a stranger swears, and leaves.', '#c8a0ff');
          }
          S.tell(b.pid, `You beat ${b.foe}!`, '#a0ffa0');
          settleBout(th, S);
        },
        player_yielded(th, ev, S) {
          const b = th.vars.bout;
          if (!b || ev.byActor !== `${th.id}:bout` || ev.pid !== b.pid) return;
          S.dismissActor(th, 'bout');
          b.winner = 'foe';
          if (th.vars.bribe && th.vars.bribe.pid === b.pid && th.vars.bribe.took && !th.vars.bribe.paid) {
            th.vars.bribe.paid = true;
            S.give(b.pid, 'coin', th.vars.bribe.sum);
            S.tell(b.pid, `Later, a purse finds its way into your pack: ¤${th.vars.bribe.sum}.`, '#c8a0ff');
          }
          settleBout(th, S);
        },
      },
      day(th, S) {
        if (S.day > th.vars.day + 1) finishTourney(th, S);
      },
      fade: 3,
    },
  },
  hello(th, a, npc) {
    return pick(npc.rng, ['Here to enter, or to watch?', `${th.vars.name}! The finest blades in the land!`, 'Blunted steel and sharp tempers. Step up!']);
  },
  talk(th, a, npc, pid, S) {
    const out = [];
    if (a.role !== 'herald') return out;
    if (th.node === 'calling' && !th.vars.players.includes(pid)) out.push({ id: 'sgt_enter', arg: tid(th), label: `Put my name down. (¤${th.vars.fee})` });
    out.push({ id: 'sgt_odds', arg: tid(th), label: 'Who\'s fighting? Who\'s the one to beat?' });
    if (th.vars.bribe && th.vars.bribe.pid === pid && th.vars.bribe.took === null) {
      out.push({ id: 'sgt_bribe', arg: `${tid(th)}:yes`, label: '(Quietly) Tell the stranger: agreed. I\'ll go down.' });
      out.push({ id: 'sgt_bribe', arg: `${tid(th)}:no`, label: 'Tell whoever\'s paying people to lose: I fight to win.' });
    }
    void S;
    return out;
  },
  respond(th, npc, pid, id, arg, S) {
    const rng = S.rng(th, 0x3b1);
    if (id === 'sgt_enter') {
      if (countItem(S.game.player.inv, 'coin') < th.vars.fee) return { lines: [`¤${th.vars.fee} to enter. Come back with it.`] };
      removeItem(S.game.player.inv, 'coin', th.vars.fee);
      th.vars.players.push(pid);
      S.touch(th, pid, `${nameOf(S, R.pl(pid))} entered ${th.vars.name}.`);
      return { lines: ['Your name\'s down! Be in the square on the day, by noon. Blades are blunted, but bring your own armour.', `(Day ${th.vars.day + 1}. Lose by yielding, not dying: they'll stop when you're beaten.)`] };
    }
    if (id === 'sgt_odds') {
      const list = [...th.vars.field].sort((a, b) => b.str - a.str).slice(0, 4).map((q) => q.name);
      return { lines: [`The favourite's ${th.vars.fav}. After that: ${list.slice(1).join(', ')}.${th.vars.masked ? ' And there\'s talk of someone who\'ll fight masked.' : ''}`, th.vars.players.length ? `And ${th.vars.players.map((q) => nameOf(S, R.pl(q))).join(', ')}, of course.` : 'Room for one more.'] };
    }
    if (id === 'sgt_bribe') {
      const yes = String(arg).endsWith(':yes');
      th.vars.bribe.took = yes;
      if (yes) S.note(th, `${nameOf(S, R.pl(pid))} took money to lose.`, { hidden: true, by: pid });
      else {
        S.person(pid).fame += 1;
        S.note(th, `Someone tried to pay ${nameOf(S, R.pl(pid))} to lose. They told the herald.`, { by: pid, news: [th.sid] });
      }
      return { lines: [yes ? '(The herald doesn\'t look at you. A nod passes across the square.)' : pick(rng, ['Good on you. I\'ll have the watch keep an eye out.', 'Ha! Someone\'s going to be out of pocket.'])] };
    }
    return null;
  },
});

function playerHere(S, pid) {
  return S.players().some((q) => q.pid === pid);
}

// The next bout: one of yours (in the ring) or two others (told).
function nextBout(th, S) {
  if (th.done) return;
  const cur = th.vars.bout;
  if (cur && !cur.winner) {
    // (Walked off from your own bout: it's forfeit.)
    if (cur.started && S.now - cur.started > 90) {
      S.dismissActor(th, 'bout');
      cur.winner = 'foe';
      S.tell(cur.pid, `You left the ring: ${cur.foe} goes through.`, '#c8c8c8');
      settleBout(th, S);
    }
    return;
  }
  const L = layoutOf(S, th.sid);
  if (!L || S.day < th.vars.day || S.now % DAY < 12 * 60) return;
  const round = th.vars.round;
  const rng = S.rng(th, 0x7b0 + (th.vars.boutN || 0));
  const pair = round.slice(0, 2);
  if (pair.length < 2) return finishTourney(th, S);
  th.vars.boutN = (th.vars.boutN || 0) + 1;
  const mine = pair.find((q) => q.pid);
  const other = pair.find((q) => q !== mine);
  if (mine && playerHere(S, mine.pid)) {
    const m = townMid(L.settlement);
    const src = th.vars.field.find((q) => q.name === other.name);
    const person = other.pid ? null : (src && src.person) || makePerson(rng, L.settlement.style || 'vale', 'champion');
    if (other.pid) {
      // (Two playing: settled by the dice, kindly.)
      th.vars.bout = { pid: mine.pid, foe: other.name, winner: rng.chance(0.5) ? mine.pid : 'foe' };
      return settleBout(th, S);
    }
    th.vars.bout = { pid: mine.pid, foe: other.name, winner: null, started: S.now };
    S.actor(th, { key: 'bout', kind: 'npc', role: 'champion', hostile: true, at: { x: m.x + 3, z: m.z }, person: { ...person, name: other.masked ? { first: 'the Masked', last: 'Knight' } : person.name }, orders: { target: mine.pid, brave: true, cry: pick(rng, ['To the yield!', 'Have at you!', 'For the crowd!']) } });
    S.tell(mine.pid, `Your bout: against ${other.name}. In the square, now!`, '#ffe070');
    return;
  }
  // Two others (or you, not here: you forfeit).
  const p = mine ? 0 : pair[0].str / (pair[0].str + pair[1].str);
  const w = mine ? other : rng.chance(p) ? pair[0] : pair[1];
  if (mine) S.tell(mine.pid, `You weren't in the square for your bout at ${th.vars.name}: ${other.name} goes through.`, '#c8c8c8');
  th.vars.bout = { foe: null, winner: w.name, auto: true };
  settleBout(th, S);
}

function settleBout(th, S) {
  const b = th.vars.bout;
  const round = th.vars.round;
  const [x, y] = round.splice(0, 2);
  let w;
  if (b.auto) w = [x, y].find((q) => q.name === b.winner) || x;
  else w = b.winner === 'foe' ? [x, y].find((q) => !q.pid || q.pid !== b.pid) : [x, y].find((q) => q.pid === b.pid);
  (th.vars.next ||= []).push(w);
  th.vars.bout = null;
  if (!round.length) {
    if (th.vars.next.length <= 1) {
      th.vars.champ = th.vars.next[0];
      return finishTourney(th, S);
    }
    th.vars.round = th.vars.next;
    th.vars.next = [];
    th.vars.roundN++;
    S.note(th, `Round ${th.vars.roundN} of ${th.vars.name}: ${th.vars.round.map((q) => q.name).join(', ')}.`);
  }
}

function finishTourney(th, S) {
  if (th.done) return;
  const L = layoutOf(S, th.sid);
  const rng = S.rng(th, 0xf1a);
  const c = th.vars.champ || (th.vars.round || []).concat(th.vars.next || []).sort((a, b) => b.str - a.str)[0];
  if (!c) return S.end(th, 'faded');
  if (c.pid) {
    const k = S.person(c.pid);
    k.fame += 4;
    const title = `Champion of ${th.vars.name}`;
    if (!k.titles.includes(title)) k.titles.push(title);
    S.give(c.pid, 'coin', th.vars.purse);
    if (ITEMS.trophy) S.give(c.pid, 'trophy', 1);
    if (L) S.asPid(c.pid, () => S.sim.addRenown(th.sid, 5, `winning ${th.vars.name}`));
    return S.end(th, 'won', `${c.name} won ${th.vars.name}, and the purse of ¤${th.vars.purse}. ${pick(rng, ['The crowd carried them round the square.', 'Even the favourite clapped.', 'They\'ll be singing about it tonight.'])}`, { news: [th.sid] });
  }
  if (c.masked) {
    const who = S.choose(th, [{ to: 'noble', w: 1 }, { to: 'outlaw', w: 0.6 }, { to: 'nobody', w: 0.8 }, { to: 'woman', w: 0.7 }], rng).to;
    const line = who === 'noble' ? 'took off the mask: the mayor\'s own child, who\'d been forbidden to fight' : who === 'outlaw' ? 'rode off with the purse before anyone could ask for the mask: and that night, a wanted poster went up with a face very like it' : who === 'woman' ? 'took off the mask: the old miller\'s widow, sixty if she\'s a day' : 'never took off the mask, and was gone by morning';
    return S.end(th, 'masked', `The Masked Knight won ${th.vars.name}, and ${line}.`, { news: [th.sid] });
  }
  S.end(th, 'won', `${c.name} won ${th.vars.name}${c.name === th.vars.fav ? ', as everyone said they would' : ', and nobody saw it coming'}.`, { news: [th.sid] });
}

// ------------------------------------------------------------ a bard's song
const BARD_LINES = ['*strums*', 'Now, this one\'s new...', 'Do you know any rhymes for "outlaw"?', 'A coin for the singer?', '*hums*'];

motif({
  id: 'bard_song',
  family: 'festive',
  max: 2,
  key: (o) => `bard:${o.sid}`,
  title: (th) => (th.vars.song ? `"${th.vars.song}"` : 'A Song in the Making'),
  scan(S, rng) {
    if (!rng.chance(0.05)) return null;
    const L = rng.pick(laidTowns(S).filter((q) => q.buildings.some((b) => b.type === 'tavern')));
    if (!L) return null;
    return { cast: { town: R.town(L.settlement.id) }, sid: L.settlement.id, vars: {} };
  },
  nodes: {
    composing: {
      enter(th, S) {
        const L = layoutOf(S, th.sid);
        if (!L) return S.end(th, 'faded');
        const rng = S.rng(th, 0xba7);
        const bard = makePerson(rng, rng.pick(['vale', L.settlement.style || 'vale']), 'stranger');
        th.vars.bard = `${bard.name.first} ${bard.name.last}`;
        // What it's to be about: someone with a name, an outlaw with one,
        // the mayor (not kindly), or love.
        const famous = S.players().map((q) => q.pid).filter((pid) => S.person(pid).fame >= 4);
        const named = Object.entries(S.named || {}).filter(([, n]) => n && !n.dead);
        const m = mayorOf(L);
        th.vars.about = S.choose(th, [
          { to: 'hero', w: famous.length ? 1.5 : 0 },
          { to: 'outlaw', w: named.length ? 0.8 : 0 },
          { to: 'mayor', w: m ? 0.6 : 0 },
          { to: 'love', w: 0.7 },
          { to: 'town', w: 0.6 },
        ], rng).to;
        if (th.vars.about === 'hero') th.vars.hero = pick(rng, famous);
        if (th.vars.about === 'outlaw') {
          const [key, n] = pick(rng, named);
          th.vars.outlaw = key;
          th.vars.outlawName = n.name || 'an outlaw';
        }
        if (th.vars.about === 'mayor') th.cast.mayor = R.rec(th.sid, m.idx);
        const tav = L.buildings.find((b) => b.type === 'tavern' && b.inside);
        const at = tav ? { x: tav.inside.x, z: tav.inside.z } : townMid(L.settlement);
        S.actor(th, { key: 'bard', kind: 'npc', role: 'bard', talk: true, at, stay: true, person: { ...bard, title: 'Wandering Singer' }, orders: { home: at, roam: 3, mark: th.vars.about === 'hero' ? 'talk' : null, markFor: th.vars.hero || null, lines: BARD_LINES } });
        S.note(th, `${th.vars.bard}, a wandering singer, has taken a corner of the tavern in ${L.settlement.name}, and is making a song about ${th.vars.about === 'hero' ? nameOf(S, R.pl(th.vars.hero)) : th.vars.about === 'outlaw' ? th.vars.outlawName : th.vars.about === 'mayor' ? `the ${L.settlement.type === 'village' ? 'elder' : 'mayor'}` : th.vars.about === 'love' ? 'love, of course' : L.settlement.name}.`, { news: [th.sid] });
        if (th.vars.hero) S.tell(th.vars.hero, `In ${L.settlement.name}, a singer called ${th.vars.bard} is making a song about you. (They're at the tavern.)`, '#ffd0e8');
      },
      day(th, S, rng) {
        if ((S.now - th.nodeAt) / DAY >= rng.int(2, 4)) S.go(th, 'sung');
      },
      fade: 8,
    },
    sung: {
      enter(th, S) {
        const L = layoutOf(S, th.sid);
        const rng = S.rng(th, 0x5a9);
        if (!L) return S.end(th, 'faded');
        const a = th.vars.about;
        const how = th.vars.how || (rng.chance(0.5) ? 'true' : 'grand');
        let song;
        if (a === 'hero') {
          const nm = nameOf(S, R.pl(th.vars.hero));
          song = how === 'grand' ? pick(rng, [`${nm}, Who Wrestled the Storm`, `The Seven Labours of ${nm}`, `${nm} the Unbroken`]) : how === 'quiet' ? null : pick(rng, [`The Ballad of ${nm}`, `${nm}'s Road`, `A Song for ${nm}`]);
          if (!song) return S.end(th, 'unsung', `${th.vars.bard} never sang the song about ${nm}: they asked them not to. "A shame," said the bard. "It had a good chorus."`);
          const k = S.person(th.vars.hero);
          k.fame += how === 'grand' ? 3 : 2;
          if (how === 'grand' && rng.chance(0.4)) {
            th.vars.found = true;
            S.note(th, `Someone who was there said it didn't happen like that at all. ${nm} is a laughing-stock in some taverns now.`);
            k.fame = Math.max(0, k.fame - 3);
          }
        } else if (a === 'outlaw') {
          song = pick(rng, [`The Fall of ${th.vars.outlawName}`, `${th.vars.outlawName}, the Coward of the Hills`, `How ${th.vars.outlawName} Lost Their Boots`]);
          // (They hear of it. They won't like it.)
          const n = S.named[th.vars.outlaw];
          if (n && rng.chance(0.5)) {
            n.angry = (n.angry || 0) + 1;
            S.note(th, `${th.vars.outlawName} has heard the song, they say, and wants to know who wrote it.`);
            if (rng.chance(0.4)) {
              S.dismissActor(th, 'bard');
              return S.end(th, 'silenced', `${th.vars.bard} was found beaten in the road out of ${L.settlement.name}, their lute smashed. ${th.vars.outlawName}'s doing, everyone says. The song is sung louder than ever.`, { news: [th.sid] });
            }
          }
        } else if (a === 'mayor') {
          song = pick(rng, ['The Mayor\'s New Hat', 'Who Ate the Council\'s Pie?', 'Old Moneybags']);
          const m = recOf(S, th.cast.mayor);
          if (m && (nat(m, 'temper') > 0.55 || has(m, 'proud'))) {
            S.dismissActor(th, 'bard');
            return S.end(th, 'run out', `${th.vars.bard} sang "${song}" at the tavern. ${th.names.mayor} had them run out of town by morning. Everyone's humming it anyway.`, { news: [th.sid] });
          }
          S.note(th, `${th.names.mayor} heard "${song}", and laughed louder than anyone. People like them better for it.`);
        } else if (a === 'love') {
          song = pick(rng, ['The Miller\'s Daughter\'s Window', 'Two Lanterns on the Bridge', 'I Waited by the Well']);
          // (A courtship in town: the song may help it.)
          const c = S.live().find((q) => q.m === 'courtship' && q.sid === th.sid && q.node === 'courting');
          if (c) {
            c.vars.ha = Math.min(1, c.vars.ha + 0.15);
            c.vars.hb = Math.min(1, c.vars.hb + 0.15);
            S.note(c, `${th.vars.bard}'s new song, "${song}", made ${c.names.a} and ${c.names.b} go very quiet, and then hold hands.`);
          }
        } else song = pick(rng, [`The Bells of ${L.settlement.name}`, `${L.settlement.name} by Lantern-light`, `Home to ${L.settlement.name}`]);
        th.vars.song = song;
        S.retitle(th, `"${song}"`);
        // The song goes from town to town.
        const s = L.settlement;
        for (const T of laidTowns(S).filter((q) => q !== L && Math.hypot(q.settlement.cx - s.cx, q.settlement.cz - s.cz) < 10).slice(0, 4)) S.rumour(T.settlement.id, s.id, `A new song's going round, from ${s.name}: "${song}".`);
        S.dismissActor(th, 'bard');
        S.end(th, 'sung', `${th.vars.bard} sang "${song}" at the tavern in ${s.name}, and moved on. ${pick(rng, ['Half the town knows the chorus now.', 'It\'s being sung in three towns already.', 'Some love it. Some hum it against their will.'])}`, { news: [th.sid] });
      },
    },
  },
  hello(th, a, npc, pid) {
    return th.vars.hero === pid ? 'It\'s YOU! Sit, sit. I need to know everything.' : pick(npc.rng, ['A coin for a song?', 'Shh: I\'ve nearly got the second verse.', 'What rhymes with "pitchfork"?']);
  },
  talk(th, a, npc, pid) {
    const out = [];
    if (a.role !== 'bard') return out;
    if (th.vars.hero === pid && !th.vars.how) {
      out.push({ id: 'sgb_how', arg: `${tid(th)}:true`, label: 'Tell it as it happened. No more, no less.' });
      out.push({ id: 'sgb_how', arg: `${tid(th)}:grand`, label: 'Make it grand. Dragons, if you like.' });
      out.push({ id: 'sgb_how', arg: `${tid(th)}:quiet`, label: 'I\'d rather you didn\'t sing about me at all.' });
    }
    out.push({ id: 'sgb_hear', arg: tid(th), label: 'Play me what you have so far.' });
    return out;
  },
  respond(th, npc, pid, id, arg, S) {
    const rng = S.rng(th, 0x8a1);
    if (id === 'sgb_how') {
      th.vars.how = String(arg).split(':')[1];
      S.touch(th, pid);
      return { lines: [th.vars.how === 'true' ? 'An honest song! Rare as hen\'s teeth. I\'ll do you proud.' : th.vars.how === 'grand' ? 'Ha! Now you\'re talking. Was it three trolls, or four? Let\'s say six.' : 'Not at all? ...Well. It\'s your life. I suppose I\'ll sing about the weather.'] };
    }
    if (id === 'sgb_hear') {
      return { lines: [pick(rng, ['(They play something that might be a tune, one day.) ...It needs work.', '"Oh the road was long and the night was cold, and the..." no. No. Not yet.', '(A lovely run of notes, then a wrong one, then a curse.)'])] };
    }
    return null;
  },
});

// ------------------------------------------------------------ a harvest
motif({
  id: 'harvest',
  family: 'festive',
  max: 3,
  key: (o) => `harvest:${o.sid}`,
  title: (th, S) => `The Harvest in ${townName(S, th.sid)}`,
  scan(S, rng) {
    if (!rng.chance(0.06)) return null;
    for (const L of rng.shuffle(laidTowns(S)).slice(0, 4)) {
      if (!L.fields || !L.fields.length) continue;
      return { cast: { town: R.town(L.settlement.id) }, sid: L.settlement.id };
    }
    return null;
  },
  // Hunger already in the town: a good harvest ends it; a bad one is part
  // of it.
  meets: [
    {
      m: 'shortage',
      when: (a, b) => b.sid === a.sid && a.node === 'ripening' && (b.vars.item === 'wheat' || (ITEMS[b.vars.item] && ITEMS[b.vars.item].kind === 'food')),
      then(a, b, S) {
        if (a.vars.kind === 'bumper') S.join(a, b, `The harvest came in heavy, and with it the end of the hunger in ${townName(S, a.sid)}.`);
        else S.note(a, 'With food already short, everyone is watching the fields.');
      },
    },
  ],
  nodes: {
    ripening: {
      enter(th, S) {
        const L = layoutOf(S, th.sid);
        if (!L) return S.end(th, 'faded');
        const rng = S.rng(th, 0x4a1);
        th.vars.kind = S.choose(th, [
          { to: 'bumper', w: 1.4 },
          { to: 'storm', w: 1 },
          { to: 'blight', w: 0.6 },
          { to: 'boars', w: 0.8 },
        ], rng).to;
        const f = L.fields[0];
        const at = f ? { x: Math.round((f.x0 + f.x1) / 2), z: Math.round((f.z0 + f.z1) / 2) } : townMid(L.settlement);
        th.vars.at = at;
        const farmer = adults(L).find((r) => r.job === 'farmer') || someone(L, rng);
        if (farmer) {
          th.cast.farmer = R.rec(th.sid, farmer.idx);
          th.names.farmer = fullName(farmer);
        }
        if (th.vars.kind === 'bumper') {
          S.note(th, `The fields of ${L.settlement.name} are heavy this year: the best harvest anyone can remember.`, { news: [th.sid] });
        } else if (th.vars.kind === 'storm') {
          S.note(th, `There's a storm coming to ${L.settlement.name}, and the harvest isn't in.`, { news: [th.sid] });
          const t = S.post(th, {
            role: 'bring', kind: 'meet', title: `Help bring in ${L.settlement.name}'s harvest before the storm`, sid: th.sid, giver: th.cast.farmer || null, at, r: 10, days: 2,
            pitch: say(rng, ['Storm by tomorrow night, and half the fields still standing. Every pair of hands. Please. Come out to the fields.', 'If the storm takes the harvest, we go hungry all winter. Out to the fields with you, if you\'ve a heart.'], {}),
            reward: { coins: 10, rep: 15, renown: th.sid, renownPts: 3, renownWhy: 'bringing in the harvest', fame: 1, items: [['bread', 3]] },
          });
          t.offerLabel = 'You look like you haven\'t slept.';
          th.vars.hands = 0;
        } else if (th.vars.kind === 'blight') {
          S.note(th, `Something's wrong with the crops in ${L.settlement.name}: black spots, and a smell. The herbalist thinks it can be stopped.`, { news: [th.sid] });
          const h = adults(L).find((r) => r.job === 'herbalist') || farmer;
          const t = S.post(th, {
            role: 'cure', kind: 'fetch', title: `Bring ${h ? first(h) : 'the farmers'} ash and herbs for the blight (4 herbs)`, sid: th.sid, giver: h ? R.rec(th.sid, h.idx) : null, item: 'herb', n: 4, days: 4,
            pitch: 'There\'s an old remedy: herbs, steeped and sprayed. Four, the bitter kind. Quickly, before it spreads to every field.',
            reward: { coins: 15, from: R.town(th.sid), rep: 15, renown: th.sid, renownPts: 3, renownWhy: 'saving the harvest', fame: 1 },
          });
          t.offerLabel = 'Is something wrong with the crops?';
        } else {
          S.note(th, `Boars are tearing up the fields of ${L.settlement.name} by night.`, { news: [th.sid] });
          const t = S.post(th, {
            role: 'boars', kind: 'slay', title: `Drive the boars from ${L.settlement.name}'s fields (4)`, sid: th.sid, giver: th.cast.farmer || null, at, r: 60, need: 4, data: { species: ['boar'] }, days: 5,
            pitch: 'Boars. Every night. Four of the brutes at least, and they\'ll have the whole crop if nobody stops them.',
            reward: { coins: 20, from: R.town(th.sid), rep: 12, fame: 1, items: [['cooked_meat', 2]] },
          });
          t.offerLabel = 'What happened to your fields?';
          for (let i = 0; i < 4; i++) S.actor(th, { key: `boar${i}`, kind: 'beast', role: 'pest', species: 'boar', hostile: false, night: true, at: { x: at.x + rng.int(-6, 6), z: at.z + rng.int(-6, 6) }, orders: { home: at } });
        }
      },
      day(th, S, rng) {
        const L = layoutOf(S, th.sid);
        if (!L) return S.end(th, 'faded');
        const days = (S.now - th.nodeAt) / DAY;
        const k = th.vars.kind;
        if (k === 'bumper' && days >= 2) {
          L.econ.treasury += 30;
          for (const r of living(L)) r.mood = Math.min(1, (r.mood ?? 0.5) + 0.1);
          // (And a feast for it, sometimes.)
          if (rng.chance(0.6) && !S.live().some((q) => q.m === 'festival' && q.sid === th.sid)) {
            S.split(th, 'festival', { cast: { town: R.town(th.sid) }, sid: th.sid, vars: { name: 'the Harvest Home' } });
          }
          return S.end(th, 'bumper', `The harvest is in at ${L.settlement.name}, and the barns are full to the rafters.`, { news: [th.sid] });
        }
        if (k === 'storm' && days >= 2) {
          const ok = (th.vars.hands || 0) > 0 || rng.chance(0.3);
          if (ok) return S.end(th, 'saved', `The storm broke over ${L.settlement.name} an hour after the last sheaf was in.${th.vars.hands ? ' They had help.' : ''}`, { news: [th.sid] });
          L.econ.treasury = Math.max(0, L.econ.treasury - 25);
          const buyer = adults(L).find((r) => ['baker', 'cook', 'innkeeper', 'merchant'].includes(r.job));
          const item = ITEMS.wheat ? 'wheat' : 'bread';
          if (buyer && rng.chance(0.5)) S.split(th, 'shortage', { cast: { buyer: R.rec(th.sid, buyer.idx), town: R.town(th.sid) }, sid: th.sid, vars: { item, n: rng.int(8, 16) } });
          return S.end(th, 'ruined', `The storm flattened half the harvest at ${L.settlement.name}. It'll be a lean winter.`, { news: [th.sid] });
        }
        if (k === 'blight' && days >= 4) {
          L.econ.treasury = Math.max(0, L.econ.treasury - 20);
          return S.end(th, 'blighted', `The blight took the fields at ${L.settlement.name}. They've burnt what was left, and pray for next year.`, { news: [th.sid] });
        }
        if (k === 'boars' && days >= 5) {
          L.econ.treasury = Math.max(0, L.econ.treasury - 10);
          return S.end(th, 'trampled', `The boars had their fill of ${L.settlement.name}'s fields, and moved on. What's left will have to do.`);
        }
      },
      fade: 8,
    },
  },
  tasks: {
    bring: {
      reach(th, t, pid, S) {
        // (An hour in the fields, and it counts.)
        th.vars.inField ||= {};
        th.vars.inField[pid] = (th.vars.inField[pid] || 0) + 0.5;
        if (th.vars.inField[pid] === 0.5) S.tell(pid, 'You set to work alongside them, cutting and binding. (Stay a while.)', '#a0e0ff');
        if (th.vars.inField[pid] >= 30) {
          th.vars.hands = (th.vars.hands || 0) + 1;
          S.complete(t, R.pl(pid));
        }
      },
    },
    cure: {
      done(th, t, by, S) {
        S.end(th, 'saved', `${nameOf(S, by)} brought the herbs, and the blight was stopped at the edge of the last field. Most of the harvest is saved.`, { news: [th.sid] });
      },
      thanks: () => ['Bitter enough to curl your hair. Perfect. Out to the fields!'],
    },
    boars: {
      done(th, t, by, S) {
        S.end(th, 'saved', `${nameOf(S, by)} drove the boars from the fields. There'll be bacon at the harvest supper.`, { news: [th.sid] });
      },
    },
  },
});

