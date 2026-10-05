// Ventures (round 54): people setting out to make something of themselves.
//
//   - A new business: someone opens a teahouse, a dye-works, a boatyard, a
//     pie stall. They may want money for it (put some in, and share what
//     comes of it) or things to start with. It may thrive, be bought out,
//     burn down (and the town raise it again), be done in by a partner who
//     runs off with the takings, or simply fail.
//   - An apprentice: a youth bound to a master. A kind master, a hard one, a
//     jealous one; a youth who's brilliant, or lazy, or in love with the
//     master's child. They may come out a journeyman, or run away, or end
//     with the master's workshop.
//   - A treasure map: found in a dead grandfather's chest, or won at dice.
//     Dig where it says, and find gold, or nothing, or someone who got there
//     first, or something buried there for a reason.
//   - An expedition: a scholar bound for an old place, wanting a guard. Go,
//     and see what they find; don't, and they go anyway.
//   - A barn raising: a family's barn burnt down (or blown down, or never
//     built), and the town turns out to put up another in a day.
//   - A rivalry: two in the same trade (or two neighbours with the same
//     prize marrow), each sure they're the best. It may end in a contest
//     you judge, in a friendship, in a feud, or in something else entirely.
import { motif, R, nameOf } from '../core.js';
import { pick, say, layoutOf, laidTowns, townName, townMid, adults, fullName, kinOf, recOf, purse, has, nat, single, blood, spotNear, persuade, repWith, isRec, someone } from './lib.js';
import { makePerson } from '../actors.js';
import { alive, DAY, ledger } from '../../econ.js';
import { retrain } from '../../../entities/npcgen.js';
import { ITEMS } from '../../../world/items.js';
import { removeItem } from '../../../game/inventory.js';
import { RNG, hash4 } from '../../../util/rng.js';

const tid = (th) => `t${th.id}`;
const first = (r) => (r ? r.name.first : 'them');

// ------------------------------------------------------------ a new business
const VENTURES = [
  { k: 'teahouse', name: 'a teahouse', wants: 'herb', n: 6 },
  { k: 'pies', name: 'a pie stall', wants: 'apple', n: 8 },
  { k: 'dye', name: 'a dye-works', wants: 'flower_blue', n: 6 },
  { k: 'boats', name: 'a boatyard', wants: 'planks', n: 12 },
  { k: 'dairy', name: 'a goat dairy', wants: 'wheat', n: 8 },
  { k: 'books', name: 'a lending library', wants: 'book', n: 2 },
  { k: 'hats', name: 'a hat shop', wants: 'cloth', n: 6 },
  { k: 'smoke', name: 'a smokehouse', wants: 'fish', n: 8 },
  { k: 'candles', name: 'a candle-maker\'s', wants: 'string', n: 6 },
];

motif({
  id: 'venture',
  family: 'ventures',
  max: 4,
  key: (o) => `venture:${o.cast.owner.sid}:${o.cast.owner.idx}`,
  title: (th) => `${th.names.owner}'s ${th.vars.biz[0].toUpperCase()}${th.vars.biz.slice(1).replace(/^a |^an /, '')}`,
  scan(S, rng) {
    if (!rng.chance(0.07)) return null;
    for (const L of rng.shuffle(laidTowns(S)).slice(0, 3)) {
      const keen = adults(L).filter((r) => !r.venture && (nat(r, 'diligence') > 0.6 || has(r, 'shrewd') || has(r, 'proud')) && !['mayor', 'guard', 'priest'].includes(r.job));
      if (!keen.length) continue;
      const r = rng.pick(keen);
      const v = rng.pick(VENTURES.filter((q) => ITEMS[q.wants]));
      if (!v) continue;
      return { cast: { owner: R.rec(L.settlement.id, r.idx), town: R.town(L.settlement.id) }, sid: L.settlement.id, vars: { kind: v.k, biz: v.name, wants: v.wants, n: v.n, need: 20 + rng.int(0, 50) } };
    }
    return null;
  },
  nodes: {
    dreaming: {
      enter(th, S) {
        const r = recOf(S, th.cast.owner);
        if (!r) return S.end(th, 'faded');
        const rng = S.rng(th, 0xb12);
        r.venture = th.id;
        th.vars.money = 0;
        th.vars.stock = false;
        th.vars.investors = {};
        S.note(th, say(rng, [
          '{o} is going to open {b} in {t}. They\'ve been saving for years.',
          '{o} has had enough of working for others: they\'re opening {b}.',
          '{o} has a plan: {b}. "There\'s nothing like it for twenty miles," they say.',
        ], { o: fullName(r), b: th.vars.biz, t: townName(S, th.sid) }), { news: [th.sid] });
        const t = S.post(th, {
          role: 'invest', kind: 'talk', title: `Put money into ${first(r)}'s ${th.vars.biz.replace(/^a |^an /, '')}`, sid: th.sid, giver: th.cast.owner,
          pitch: say(rng, [
            'I\'m ¤{n} short of opening. Put some in and I\'ll pay you back half again, out of the takings. If there are takings. There will be!',
            'Every coin counts. Put in what you can: you\'ll have a share of what it makes, I swear it on my mother.',
          ], { n: th.vars.need }),
          reward: { coins: 0, rep: 5 },
        });
        t.offerLabel = pick(rng, ['You look like you\'ve a scheme.', 'What are you drawing there?']);
        const t2 = S.post(th, {
          role: 'stock', kind: 'fetch', title: `Bring ${first(r)} ${th.vars.n} ${ITEMS[th.vars.wants].name.toLowerCase()} to start with`, sid: th.sid, giver: th.cast.owner, item: th.vars.wants, n: th.vars.n,
          pitch: `I need ${th.vars.n} ${ITEMS[th.vars.wants].name.toLowerCase()} to start with, and the market's dear. I'll pay you fair.`,
          reward: { coins: Math.round(((ITEMS[th.vars.wants].value || 2) * th.vars.n) * 1.3) + 5, from: th.cast.owner, rep: 6 },
        });
        t2.offerLabel = 'Need anything for the new place?';
      },
      day(th, S, rng) {
        const r = recOf(S, th.cast.owner);
        if (!r || !alive(r)) return S.end(th, 'faded');
        // (Saving, borrowing, scraping: the money comes, slowly.)
        th.vars.money += rng.int(1, 6) + Math.round(nat(r, 'diligence') * 4);
        if (th.vars.money >= th.vars.need || (S.now - th.nodeAt) / DAY > 6) S.go(th, 'open');
      },
      fade: 10,
    },
    open: {
      enter(th, S) {
        const r = recOf(S, th.cast.owner);
        const L = layoutOf(S, th.sid);
        if (!r || !L) return S.end(th, 'faded');
        const rng = S.rng(th, 0x0be);
        for (const t of S.tasksOf(th, 'invest')) S.closeTask(t, 'lapsed');
        th.vars.fund = th.vars.money / th.vars.need + (th.vars.stock ? 0.3 : 0);
        th.vars.luck = 0.5;
        ledger(L, S.day, `${fullName(r)}'s ${th.vars.biz.replace(/^a |^an /, '')} opened its doors in ${L.settlement.name}${th.vars.fund < 0.8 ? ', on a shoestring' : ''}.`);
        S.note(th, `${th.names.owner} opened ${th.vars.biz}${th.vars.fund < 0.8 ? ', short of money, but open' : ''}.`);
        // (Someone else in town doing the same: a rival.)
        const rival = adults(L).find((q) => q !== r && q.venture && q.venture !== th.id && S.thread(q.venture) && S.thread(q.venture).vars.kind === th.vars.kind);
        if (rival && rng.chance(0.7)) S.split(th, 'rivalry', { cast: { a: th.cast.owner, b: R.rec(th.sid, rival.idx), town: R.town(th.sid) }, sid: th.sid, vars: { over: th.vars.biz } });
      },
      day(th, S, rng) {
        const r = recOf(S, th.cast.owner);
        const L = layoutOf(S, th.sid);
        if (!r || !alive(r) || !L) return S.end(th, 'closed', `${th.names.owner}'s ${th.vars.biz.replace(/^a |^an /, '')} closed: there was nobody left to keep it.`);
        const days = (S.now - th.nodeAt) / DAY;
        // How it's going: the owner, the town, and luck.
        const prosper = L.settlement.condition === 'prosperous' ? 0.1 : L.settlement.condition === 'poor' ? -0.1 : 0;
        th.vars.luck = Math.max(0, Math.min(1, th.vars.luck + rng.float(-0.12, 0.12) + (nat(r, 'diligence') - 0.5) * 0.08 + (has(r, 'lazy') ? -0.05 : 0) + (has(r, 'shrewd') ? 0.04 : 0) + prosper + (th.vars.fund - 1) * 0.04));
        // Its turns, once each.
        if (!th.vars.turned && days > 2 && rng.chance(0.3)) {
          th.vars.turned = S.choose(th, [
            { to: 'praise', w: 1 },
            { to: 'fire', w: 0.5 },
            { to: 'partner', w: has(r, 'kind') || has(r, 'generous') ? 0.7 : 0.3 },
            { to: 'buyout', w: th.vars.luck > 0.55 ? 0.8 : 0.2 },
            { to: 'none', w: 1 },
          ], rng).to;
          const t = th.vars.turned;
          if (t === 'praise') {
            th.vars.luck = Math.min(1, th.vars.luck + 0.3);
            S.note(th, pick(rng, [`A noble passing through stopped at ${th.names.owner}'s, and told everyone. There's a queue down the street now.`, `${th.names.owner}'s got a mention in a city broadsheet. Folk come from two towns over.`]), { news: [th.sid] });
          } else if (t === 'fire') {
            th.vars.luck = Math.max(0, th.vars.luck - 0.4);
            S.note(th, `Fire! ${th.names.owner}'s ${th.vars.biz.replace(/^a |^an /, '')} burnt in the night. Nobody hurt, but it's ash.`, { news: [th.sid] });
            if (rng.chance(0.6)) S.split(th, 'barn_raising', { cast: { family: th.cast.owner, town: R.town(th.sid) }, sid: th.sid, vars: { what: th.vars.biz.replace(/^a |^an /, ''), why: 'the fire' } });
          } else if (t === 'partner') {
            const took = Math.round(th.vars.money * 0.8);
            th.vars.luck = Math.max(0, th.vars.luck - 0.35);
            S.note(th, `${th.names.owner}'s partner ran off with the takings: ¤${took}, and the good knives.`, { news: [th.sid] });
          } else if (t === 'buyout') {
            th.vars.offer = 80 + rng.int(0, 120);
            S.note(th, `A merchant from the city has offered ${th.names.owner} ¤${th.vars.offer} for the business.`);
            // (They choose: as they are.)
            if (has(r, 'stingy') || has(r, 'shrewd') || rng.chance(0.35)) {
              r.coins = (r.coins || 0) + th.vars.offer;
              payInvestors(th, S, 1.6);
              return S.end(th, 'sold', `${th.names.owner} sold up to the city merchant for ¤${th.vars.offer}. ${pick(rng, ['They\'re building a bigger house.', 'They say they\'ll start another.', 'The new owners changed the sign. Nobody likes the new sign.'])}`, { news: [th.sid] });
            }
            S.note(th, `${th.names.owner} turned the merchant down: "It's not for sale."`);
          }
        }
        if (days >= 10) {
          if (th.vars.luck > 0.55) {
            r.mood = Math.min(1, (r.mood ?? 0.5) + 0.3);
            L.econ.treasury += 10;
            payInvestors(th, S, 1.5);
            return S.end(th, 'thriving', `${th.names.owner}'s ${th.vars.biz.replace(/^a |^an /, '')} is doing well: ${pick(rng, ['they\'ve taken on help.', 'there\'s talk of a second one.', 'they\'re the talk of the town.'])}`, { news: [th.sid] });
          }
          if (th.vars.luck < 0.3) {
            r.mood = Math.max(0, (r.mood ?? 0.5) - 0.35);
            return S.end(th, 'failed', `${th.names.owner}'s ${th.vars.biz.replace(/^a |^an /, '')} closed its doors. ${pick(rng, ['They\'re back at their old work.', 'They say they\'ll try again.', 'Their savings went with it.'])}`, { news: [th.sid] });
          }
          payInvestors(th, S, 1.1);
          S.end(th, 'getting by', `${th.names.owner}'s ${th.vars.biz.replace(/^a |^an /, '')} gets by. Not rich, not ruined: open.`);
        }
      },
      fade: 16,
    },
  },
  ended(th, S) {
    const r = recOf(S, th.cast.owner);
    if (r && r.venture === th.id) r.venture = null;
  },
  tasks: {
    invest: {},
    stock: { done(th) { th.vars.stock = true; }, thanks: () => ['Now I can open properly. Thank you!'] },
    payout: { thanks: (th) => [`Your share, as I promised. ${th.vars.luck > 0.55 ? 'With interest. You earned it.' : 'It\'s not much. But it\'s honest.'}`] },
  },
  townTalk(th, npc, pid, S) {
    if (!isRec(npc, th.cast.owner) || th.node !== 'dreaming') return [];
    const t = S.tasksOf(th, 'invest')[0];
    if (!t || !S.heardOf(pid, t)) return [];
    return [10, 25, 50].map((n) => ({ id: 'sgn_put', arg: `${tid(th)}:${n}`, label: `Here: ¤${n} for the ${th.vars.biz.replace(/^a |^an /, '')}.` }));
  },
  respond(th, npc, pid, id, arg, S) {
    if (id !== 'sgn_put') return null;
    const n = +String(arg).split(':')[1];
    if (purse(S, pid) < n) return { lines: ['That\'s kind. But you haven\'t got it.'] };
    S.asPid(pid, (p) => removeItem(p.inv, 'coin', n));
    th.vars.money += n;
    th.vars.investors[pid] = (th.vars.investors[pid] || 0) + n;
    S.touch(th, pid, `${nameOf(S, R.pl(pid))} put money into ${th.names.owner}'s venture.`);
    return { lines: [pick(S.rng(th, n), ['You won\'t regret it!', 'A partner! I\'ve a partner!', 'I\'ll write it down: you\'ll have your share.'])] };
  },
});

// What comes back to those who put money in (from the owner, when you see them).
function payInvestors(th, S, mult) {
  for (const [pid, n] of Object.entries(th.vars.investors || {})) {
    const t = S.post(th, {
      role: 'payout', kind: 'talk', title: `Collect your share from ${th.names.owner}`, sid: th.sid, giver: th.cast.owner, only: [pid], npc: false, board: false,
      reward: { coins: Math.round(n * mult), from: { t: 'purse' }, rep: 5 },
    });
    S.accept(t, R.pl(pid));
    S.complete(t, R.pl(pid));
  }
}

// ------------------------------------------------------------ an apprentice
const TRADES = ['blacksmith', 'carpenter', 'herbalist', 'baker', 'tailor', 'cook', 'glassblower', 'miller'];

motif({
  id: 'apprentice',
  family: 'ventures',
  max: 3,
  key: (o) => `appr:${o.cast.youth.sid}:${o.cast.youth.idx}`,
  title: (th) => `${th.names.youth}, Apprentice ${th.vars.tradeWord}`,
  scan(S, rng) {
    if (!rng.chance(0.06)) return null;
    for (const L of rng.shuffle(laidTowns(S)).slice(0, 3)) {
      const youths = adults(L).filter((r) => single(L, r) && !r.apprentice && ['laborer', 'farmer', 'fisher', 'lumberjack', 'miner'].includes(r.job));
      const masters = adults(L).filter((r) => TRADES.includes(r.job) && !r.apprentice);
      if (!youths.length || !masters.length) continue;
      const y = rng.pick(youths);
      const m = rng.pick(masters);
      return { cast: { youth: R.rec(L.settlement.id, y.idx), master: R.rec(L.settlement.id, m.idx), town: R.town(L.settlement.id) }, sid: L.settlement.id, vars: { trade: m.job, tradeWord: m.job === 'blacksmith' ? 'Smith' : m.job[0].toUpperCase() + m.job.slice(1) } };
    }
    return null;
  },
  nodes: {
    bound: {
      enter(th, S) {
        const y = recOf(S, th.cast.youth);
        const m = recOf(S, th.cast.master);
        const L = layoutOf(S, th.sid);
        if (!y || !m || !L) return S.end(th, 'faded');
        const rng = S.rng(th, 0xa99);
        y.apprentice = th.id;
        m.apprentice = th.id;
        // What the master's like, and the youth.
        th.vars.master = S.choose(th, [
          { to: 'kind', w: nat(m, 'kindness') + 0.3 },
          { to: 'hard', w: nat(m, 'temper') + (has(m, 'gruff') ? 0.4 : 0) },
          { to: 'jealous', w: has(m, 'proud') ? 0.8 : 0.2 },
        ], rng).to;
        th.vars.youth = S.choose(th, [
          { to: 'keen', w: nat(y, 'diligence') + 0.2 },
          { to: 'gifted', w: 0.4 + (has(y, 'curious') ? 0.3 : 0) },
          { to: 'idle', w: has(y, 'lazy') ? 0.9 : 0.2 },
        ], rng).to;
        th.vars.skill = 0.2;
        th.vars.misery = 0;
        S.note(th, `${th.names.youth} has been taken on as ${fullName(m)}'s apprentice. ${th.vars.master === 'kind' ? `${first(m)} is patient with them.` : th.vars.master === 'hard' ? `${first(m)} works them from dawn to dark.` : `${first(m)} watches them closely. Too closely.`}`);
        const kin = kinOf(L, y).find((k) => (y.parents || []).includes(k.idx));
        if (kin) {
          th.cast.kin = R.rec(th.sid, kin.idx);
          th.names.kin = fullName(kin);
        }
        // A gift of tools, if anyone thinks to bring them.
        if (ITEMS.hammer && rng.chance(0.5)) {
          const t = S.post(th, {
            role: 'tools', kind: 'fetch', title: `Bring ${first(y)} a hammer of their own`, sid: th.sid, giver: th.cast.youth, item: 'hammer', n: 1,
            pitch: `${first(m)} says a ${th.vars.trade} without their own tools is no ${th.vars.trade} at all. I can't afford one. Not yet.`,
            reward: { coins: 0, rep: 12, fame: 0.5 },
          });
          t.offerLabel = 'How\'s the new trade?';
        }
      },
      day(th, S, rng) {
        const y = recOf(S, th.cast.youth);
        const m = recOf(S, th.cast.master);
        const L = layoutOf(S, th.sid);
        if (!y || !alive(y) || !L) return S.end(th, 'faded');
        if (!m || !alive(m)) {
          // (The master gone: the workshop to the apprentice, if they're ready.)
          if (th.vars.skill > 0.55) {
            retrain(L, y, th.vars.trade, new RNG(hash4(y.idx, S.day, 0xa9)));
            return S.end(th, 'inherited', `${th.names.master || 'Their master'} is dead, and ${th.names.youth} has taken over the workshop. They say ${first(y)} is as good already.`, { news: [th.sid] });
          }
          return S.end(th, 'orphaned', `${th.names.youth}'s master died before they'd learnt enough. They're back to labouring, for now.`);
        }
        const mm = th.vars.master;
        const yy = th.vars.youth;
        th.vars.skill = Math.min(1, th.vars.skill + (yy === 'gifted' ? 0.07 : yy === 'keen' ? 0.045 : 0.008) + (mm === 'kind' ? 0.015 : mm === 'hard' ? 0.02 : 0) + (th.vars.tools ? 0.015 : 0) + rng.float(-0.01, 0.01));
        if (mm === 'hard') th.vars.misery += 0.16 - nat(y, 'bravery') * 0.06 - (yy === 'keen' ? 0.03 : 0);
        if (mm === 'jealous' && th.vars.skill > 0.4) th.vars.misery += 0.14;
        if (yy === 'idle' && mm !== 'kind') th.vars.misery += 0.05;
        const days = (S.now - th.nodeAt) / DAY;
        // Turns.
        if (!th.vars.turn && days > 2 && rng.chance(0.25)) {
          th.vars.turn = S.choose(th, [
            { to: 'burn', w: 0.6 },
            { to: 'love', w: (m.children || []).some((i) => L.npcs[i] && alive(L.npcs[i]) && L.npcs[i].age === 'adult' && single(L, L.npcs[i])) && single(L, y) ? 1 : 0 },
            { to: 'praise', w: yy === 'gifted' ? 1 : 0.3 },
            { to: 'none', w: 1 },
          ], rng).to;
          if (th.vars.turn === 'burn') {
            th.vars.skill = Math.max(0, th.vars.skill - 0.05);
            S.note(th, `${th.names.youth} burnt their hand badly in the workshop. ${mm === 'kind' ? `${first(m)} sat with them all night.` : `${first(m)} told them to stop crying and work left-handed.`}`);
            if (mm !== 'kind') th.vars.misery += 0.2;
          } else if (th.vars.turn === 'love') {
            const c = (m.children || []).map((i) => L.npcs[i]).find((q) => q && alive(q) && q.age === 'adult' && single(L, q));
            if (c && !c.courting && !y.courting) {
              S.note(th, `${th.names.youth} has eyes for ${fullName(c)}, ${first(m)}'s own child. ${first(m)} doesn't know. Yet.`);
              S.split(th, 'courtship', { cast: { a: th.cast.youth, b: R.rec(th.sid, c.idx), town: R.town(th.sid) }, sid: th.sid, vars: { met: `in ${first(m)}'s workshop` } });
            }
          } else if (th.vars.turn === 'praise') {
            S.note(th, `${th.names.youth} made something that stopped ${first(m)} dead: ${pick(rng, ['a lock nobody could pick', 'a loaf the mayor asked for by name', 'a coat a noble bought off their back', 'a glass so clear it seemed empty'])}.`, { news: [th.sid] });
            th.vars.skill = Math.min(1, th.vars.skill + 0.1);
            if (mm === 'jealous') th.vars.misery += 0.25;
          }
        }
        // Too much: they run.
        if (th.vars.misery > 0.9 && !th.vars.helped) {
          if (rng.chance(0.5) && th.cast.kin) {
            y.apprentice = null;
            return S.split(th, 'runaway', { cast: { youth: th.cast.youth, parent: th.cast.kin, band: null, town: R.town(th.sid) }, sid: th.sid, vars: { to: 'road' } }, `${th.names.youth} couldn't take any more of ${first(m)}, and ran off in the night.`) && S.end(th, 'ran away');
          }
          y.apprentice = null;
          return S.end(th, 'quit', `${th.names.youth} walked out of ${first(m)}'s workshop and didn't come back. ${pick(rng, ['They\'re labouring again, and seem happier.', 'Their family are ashamed; they aren\'t.'])}`);
        }
        // Done: a journeyman.
        if (th.vars.skill >= 0.85 || days > 20) {
          if (th.vars.skill >= 0.65) {
            if (mm === 'jealous' && rng.chance(0.4) && y.name.last !== m.name.last) {
              S.split(th, 'rivalry', { cast: { a: th.cast.youth, b: th.cast.master, town: R.town(th.sid) }, sid: th.sid, vars: { over: `the ${th.vars.trade}'s trade` } });
            }
            if (L.hasWorkplaceFor(th.vars.trade)) retrain(L, y, th.vars.trade, new RNG(hash4(y.idx, S.day, 0xa9)));
            y.mood = Math.min(1, (y.mood ?? 0.5) + 0.3);
            return S.end(th, 'journeyman', `${th.names.youth} has finished their apprenticeship: a ${th.vars.trade} now, in their own right. ${mm === 'kind' ? `${first(m)} gave them their own tools as a parting gift.` : mm === 'jealous' ? `${first(m)} didn't come to see them sworn in.` : `${first(m)} grunted. From ${first(m)}, that's praise.`}`, { news: [th.sid] });
          }
          return S.end(th, 'let go', `${first(m)} let ${th.names.youth} go: "Not cut out for it." ${pick(rng, ['Maybe they\'re right.', 'We\'ll see.'])}`);
        }
      },
      fade: 24,
    },
  },
  ended(th, S) {
    for (const k of ['youth', 'master']) {
      const r = recOf(S, th.cast[k]);
      if (r && r.apprentice === th.id) r.apprentice = null;
    }
  },
  tasks: {
    tools: { done(th) { th.vars.tools = true; }, thanks: () => ['My own hammer! I\'ll make my first good thing with it, and it\'s yours.'] },
  },
  townTalk(th, npc, pid, S) {
    const out = [];
    if (isRec(npc, th.cast.youth)) out.push({ id: 'sga2_how', arg: tid(th), label: `How's the work with ${first(recOf(S, th.cast.master))}?` });
    if (isRec(npc, th.cast.master) && th.vars.misery > 0.3 && !th.vars.helped) out.push({ id: 'sga2_ease', arg: tid(th), label: `Go easier on ${first(recOf(S, th.cast.youth))}.` });
    return out;
  },
  respond(th, npc, pid, id, arg, S) {
    const rng = S.rng(th, 0x2b9);
    if (id === 'sga2_how') {
      const v = th.vars.misery;
      const sk = th.vars.skill;
      return { lines: [v > 0.6 ? pick(rng, ['...I can\'t talk here. They\'ll hear.', 'Fine. It\'s fine. (It isn\'t.)']) : sk > 0.6 ? pick(rng, ['I think I\'m getting good at this! Don\'t tell anyone I said so.', 'I made a thing today and it was RIGHT.']) : pick(rng, ['Hard. But I\'m learning.', 'My hands hurt all the time. Is that normal?', 'There\'s so much to learn.'])] };
    }
    if (id === 'sga2_ease') {
      S.touch(th, pid);
      if (persuade(S, npc, rng, 0.25, nat(npc.rec, 'temper') * 0.3 + (has(npc.rec, 'proud') ? 0.2 : 0))) {
        th.vars.helped = true;
        th.vars.misery = Math.max(0, th.vars.misery - 0.5);
        if (th.vars.master === 'hard') th.vars.master = 'kind';
        S.note(th, `${nameOf(S, R.pl(pid))} had a word with ${th.names.master}. ${th.names.youth}'s days are easier now.`, { by: pid });
        return { lines: [pick(rng, ['...Was I that bad? My own master was worse. I\'ll ease off.', 'Hm. Maybe. They\'re good, you know. Better than I was.'])] };
      }
      repWith(S, layoutOf(S, th.sid), npc.rec, -6);
      return { lines: ['How I train my apprentice is my business.'] };
    }
    return null;
  },
});

// ------------------------------------------------------------ a treasure map
const MOTIF_MAP = motif({
  id: 'treasure_map',
  family: 'ventures',
  max: 3,
  key: (o) => `map:${o.sid}:${o.vars.seed}`,
  title: (th) => `${th.names.finder}'s Treasure Map`,
  scan(S, rng) {
    if (!rng.chance(0.06)) return null;
    for (const L of rng.shuffle(laidTowns(S)).slice(0, 3)) {
      const r = someone(L, rng);
      if (!r) continue;
      const m = townMid(L.settlement);
      const at = spotNear(S, m.x, m.z, 70, 150, rng, { clear: 14 });
      if (!at) continue;
      return { cast: { finder: R.rec(L.settlement.id, r.idx), town: R.town(L.settlement.id) }, sid: L.settlement.id, spots: [at], vars: { at, seed: rng.int(0, 1e6), how: rng.pick(['in a dead grandfather\'s sea-chest', 'won at dice from a sailor', 'sewn into the lining of an old coat', 'in a bottle, washed up', 'in the wall of a cottage they were knocking down']) } };
    }
    return null;
  },
  anchors: (th) => [th.vars.at],
  nodes: {
    found: {
      enter(th, S) {
        const r = recOf(S, th.cast.finder);
        if (!r) return S.end(th, 'faded');
        const rng = S.rng(th, 0x7a9);
        // What's really there.
        th.vars.truth = S.choose(th, [
          { to: 'gold', w: 1.2 },
          { to: 'nothing', w: 0.8 },
          { to: 'beaten', w: 0.6 },
          { to: 'guarded', w: 0.6 },
          { to: 'cursed', w: 0.4 },
        ], rng).to;
        th.vars.share = has(r, 'generous') || has(r, 'kind') ? 0.3 : has(r, 'stingy') || has(r, 'shrewd') ? 0.6 : 0.5;
        S.note(th, `${th.names.finder} found a map ${th.vars.how}: an X, a crooked tree, and "dig here". They're telling everyone, which may be a mistake.`, { news: [th.sid] });
        const item = S.writeNote(th, 'map', 'A Treasure Map', ['A crooked tree, three stones in a row, an X.', '', `Scrawled at the bottom: "${pick(rng, ['Ten paces from the tree. Dig deep.', 'Under the stones. Mind the dead.', 'For my children, if they\'re clever enough.', 'DON\'T'])}"`, '', '(The place is marked on your map.)']);
        th.vars.map = item;
        const t = S.post(th, {
          role: 'dig', kind: 'find', title: `Dig where ${first(r)}'s map says`, sid: th.sid, giver: th.cast.finder, at: th.vars.at, r: 3,
          pitch: say(rng, [
            'I can\'t dig it up myself: my back, and my nerves. Go, dig, and we split it: {p} for me, the rest for you. Deal?',
            'Here\'s the map. Bring back what you find and we\'ll share it fair: I keep {p}. Don\'t you dare run off with it.',
          ], { p: `${Math.round(th.vars.share * 100)}%` }),
          reward: { coins: 0, rep: 8, fame: 0.5 },
        });
        t.offerLabel = 'I hear you\'ve found something.';
      },
      day(th, S, rng) {
        // (Someone else goes digging, if nobody does: an adventurer, or the finder, or a thief.)
        if ((S.now - th.nodeAt) / DAY > 6 && !Object.keys(th.touched).length) {
          const who = S.choose(th, [{ to: 'finder', w: 1 }, { to: 'thief', w: 0.5 }, { to: 'nobody', w: 0.6 }], rng).to;
          if (who === 'finder') {
            if (th.vars.truth === 'gold') {
              const r = recOf(S, th.cast.finder);
              if (r) r.coins = (r.coins || 0) + 80;
              return S.end(th, 'rich', `${th.names.finder} dug it up themselves, in the end: a pot of old coin. They've bought the inn a new roof and themselves a hat.`, { news: [th.sid] });
            }
            return S.end(th, 'nothing', `${th.names.finder} dug it up themselves, in the end. There was nothing there but a boot.`);
          }
          if (who === 'thief') return S.end(th, 'stolen', `${th.names.finder}'s map was stolen from under their pillow. Someone's digging somewhere, and it isn't them.`);
          return S.end(th, 'faded', `${th.names.finder}'s map went in a drawer.`);
        }
      },
      fade: 14,
    },
    // Dug up: the finder's share, owed.
    owing: {
      day(th, S, rng) {
        if ((S.now - th.nodeAt) / DAY < 4) return;
        // (Never came back with it.)
        const pid = th.vars.digger;
        S.townSay(pid, th.sid, -6);
        S.end(th, 'cheated', `${nameOf(S, R.pl(pid))} dug up the treasure on ${th.names.finder}'s map and kept the lot. ${th.names.finder} ${pick(rng, ['tells everyone who\'ll listen.', 'has sworn they\'ll get even.', 'just looks tired.'])}`, { news: [th.sid] });
      },
      fade: 8,
    },
  },
  tasks: {
    dig: {
      accepted(th, t, who, S) {
        if (who.t === 'pl' && th.vars.map) S.give(who.pid, th.vars.map, 1);
        // (Beaten to it: someone else heard about the map too.)
        if (th.vars.truth === 'beaten' && !th.vars.rivals) {
          th.vars.rivals = true;
          const rng = S.rng(th, 0x3c1);
          for (let i = 0; i < 2; i++) S.actor(th, { key: `dig${i}`, kind: 'npc', role: 'rival', talk: true, at: { x: th.vars.at.x + 2 + i, z: th.vars.at.z + 1 }, person: makePerson(rng, 'vale', 'outlaw'), orders: { home: th.vars.at, roam: 2, lines: ['*digs*', 'Keep digging!', 'Oi! This is ours!'] } });
        }
      },
      reach(th, t, pid, S) {
        const rng = S.rng(th, 0xd16);
        const v = th.vars.truth;
        if (v === 'beaten') {
          // (Talk to them, or fight them for it.)
          return;
        }
        if (v === 'guarded' && !th.vars.woke) {
          th.vars.woke = true;
          for (let i = 0; i < 3; i++) S.actor(th, { key: `dead${i}`, kind: 'beast', role: 'guard', species: 'skeleton', hostile: true, at: { x: th.vars.at.x + rng.int(-3, 3), z: th.vars.at.z + rng.int(-3, 3) }, orders: { home: th.vars.at } });
          S.tell(pid, 'You dig. Something digs back. Bones claw up out of the earth!', '#ff9080');
          return;
        }
        if (v === 'guarded' && th.actors.some((a) => a.role === 'guard' && !a.gone && !a.dead)) return;
        dug(th, t, pid, S, rng);
      },
    },
  },
  hello(th, a, npc) {
    return a.role === 'rival' ? pick(npc.rng, ['Clear off. We found it first.', 'Map? What map? Never seen a map.', 'Keep walking, friend.']) : '...';
  },
  talk(th, a) {
    if (a.role !== 'rival') return [];
    return [
      { id: 'sgm_split', arg: tid(th), label: 'There\'s enough for all of us. Split it?' },
      { id: 'sgm_mine', arg: tid(th), label: 'That\'s my map you\'re digging. Clear off.' },
    ];
  },
  respond(th, npc, pid, id, arg, S) {
    if (id === 'sgm_pay' || id === 'sgm_lie') return MOTIF_MAP.respond2(th, npc, pid, id, arg, S);
    const rng = S.rng(th, 0x5f2);
    const t = S.tasksOf(th, 'dig')[0];
    if (id === 'sgm_split') {
      th.vars.truth = 'gold';
      th.vars.halved = true;
      for (const a of th.actors) if (a.role === 'rival') S.dismissActor(th, a.key);
      if (t) dug(th, t, pid, S, rng);
      return { lines: ['...Fair enough. Better than a knife in the ribs. Half each.', '(You dig together. There is a pot of coin. They take their half and go.)'], close: true };
    }
    if (id === 'sgm_mine') {
      for (const a of th.actors) {
        if (a.role !== 'rival' || a.gone) continue;
        const e = S.actorEnt(th, a.key);
        const at = e ? { x: Math.round(e.x), z: Math.round(e.z) } : a.at;
        S.dismissActor(th, a.key);
        S.actor(th, { key: `${a.key}f`, kind: 'npc', role: 'rivalf', hostile: true, at, person: a.person, orders: { target: pid, brave: rng.chance(0.5), cry: 'Yours? Come and take it!' } });
      }
      th.vars.truth = 'gold';
      th.vars.fight = true;
      return { lines: ['Yours? Come and take it, then!'], close: true };
    }
    return null;
  },
  actorDown(th, a, by, S) {
    if (a.role !== 'rivalf' || th.actors.some((q) => q.role === 'rivalf' && !q.gone && !q.dead)) return;
    S.note(th, 'The rival diggers were beaten off.');
  },
  townTalk(th, npc, pid, S) {
    if (th.node !== 'owing' || th.vars.digger !== pid || !isRec(npc, th.cast.finder)) return [];
    return [
      { id: 'sgm_pay', arg: tid(th), label: `Here's your share: ¤${th.vars.owed}.` },
      { id: 'sgm_lie', arg: tid(th), label: 'There was nothing there. Sorry.' },
    ];
  },
  respond2(th, npc, pid, id, arg, S) {
    const rng = S.rng(th, 0x5f3);
    if (id === 'sgm_pay') {
      if (purse(S, pid) < th.vars.owed) return { lines: [`¤${th.vars.owed}. That was the deal. You haven't got it on you?`] };
      S.asPid(pid, (p) => removeItem(p.inv, 'coin', th.vars.owed));
      const r = recOf(S, th.cast.finder);
      if (r) {
        r.coins = (r.coins || 0) + th.vars.owed;
        repWith(S, layoutOf(S, th.sid), r, 15);
      }
      S.person(pid).fame += 1;
      S.end(th, 'shared', `${nameOf(S, R.pl(pid))} dug up the treasure on ${th.names.finder}'s map, and shared it as they'd promised. ${th.names.finder} ${pick(rng, ['bought a round for the whole tavern.', 'cried, a little.', 'is having the map framed.'])}`, { news: [th.sid] });
      return { lines: [pick(rng, ['You came back! Honest folk, there\'s few enough of you.', 'I\'d half given up on you. Thank you.'])] };
    }
    if (id === 'sgm_lie') {
      const r = npc.rec;
      // (Believed, or not: the shrewd see through it, and coin talks.)
      const caught = has(r, 'shrewd') || rng.chance(0.35);
      if (caught) {
        S.townSay(pid, th.sid, -8);
        repWith(S, layoutOf(S, th.sid), r, -30);
        S.end(th, 'cheated', `${nameOf(S, R.pl(pid))} told ${th.names.finder} there was nothing under the stones. ${th.names.finder} had seen them spending old coin in the market.`, { news: [th.sid] });
        return { lines: ['Nothing? Then where did all that old coin you\'ve been spending come from? Liar. LIAR.'], close: true };
      }
      S.end(th, 'nothing', `${th.names.finder}'s map led to nothing, they were told.`, { hidden: true });
      return { lines: [pick(rng, ['Nothing? ...Oh. Well. It was a long shot. Thank you for trying.', 'Ah. Grandfather always was a liar.'])] };
    }
    return null;
  },
});

function dug(th, t, pid, S, rng) {
  const v = th.vars.truth;
  const share = th.vars.share;
  if (v === 'nothing') {
    S.complete(t, R.pl(pid));
    S.tell(pid, `You dig and dig. At the bottom, a box: inside, a note. "${pick(rng, ['HA!', 'Made you dig.', 'The real treasure was the digging.', 'Sorry. Spent it.'])}"`, '#c8c8c8');
    return S.end(th, 'nothing', `${nameOf(S, R.pl(pid))} dug where the map said. There was nothing but a rude note.`);
  }
  if (v === 'cursed') {
    S.complete(t, R.pl(pid));
    if (ITEMS.heirloom) S.give(pid, 'heirloom', 1);
    S.tell(pid, 'You find a small iron box. Inside, wrapped in black cloth: a ring, cold as ice. The air goes still.', '#c8a0ff');
    S.split(th, 'ill_luck', { cast: { town: R.town(th.sid) }, sid: th.sid, vars: { cause: 'the iron box was dug up' } }, 'Since the box was dug up, strange things have been seen.');
    return S.end(th, 'cursed', `${nameOf(S, R.pl(pid))} dug up something that had been buried for a reason.`, { news: [th.sid] });
  }
  const gold = (th.vars.halved ? 40 : 80) + rng.int(0, 40);
  const mine = Math.round(gold * (1 - share));
  S.give(pid, 'coin', gold);
  if (ITEMS.old_coin) S.give(pid, 'old_coin', rng.int(1, 3));
  S.complete(t, R.pl(pid));
  th.vars.owed = gold - mine;
  th.vars.digger = pid;
  S.tell(pid, `Under the stones: a rotten chest, and ¤${gold} in old coin. ${th.names.finder} is owed ¤${gold - mine} of it.`, '#ffe070');
  S.go(th, 'owing');
}

// ------------------------------------------------------------ an expedition
const PLACES = ['the drowned tower', 'the old Kavorent spire on the ridge', 'the barrow under the hill', 'the stone circle nobody visits', 'the ruined chapel in the marsh', 'the cave with writing on its walls'];

motif({
  id: 'expedition',
  family: 'ventures',
  max: 2,
  key: (o) => `exped:${o.sid}`,
  title: (th) => `${th.vars.leader}'s Expedition to ${th.vars.place[0].toUpperCase()}${th.vars.place.slice(1)}`,
  scan(S, rng) {
    if (!rng.chance(0.05)) return null;
    const L = rng.pick(laidTowns(S));
    if (!L) return null;
    const m = townMid(L.settlement);
    const at = spotNear(S, m.x, m.z, 90, 170, rng, { clear: 14 });
    if (!at) return null;
    return { cast: { town: R.town(L.settlement.id) }, sid: L.settlement.id, spots: [at], vars: { at, place: rng.pick(PLACES), leader: '' } };
  },
  anchors: (th) => [th.vars.at],
  nodes: {
    gathering: {
      enter(th, S) {
        const L = layoutOf(S, th.sid);
        if (!L) return S.end(th, 'faded');
        const rng = S.rng(th, 0xe9d);
        const p = makePerson(rng, L.settlement.style || 'vale', 'scholar');
        th.vars.person = p;
        th.vars.leader = `${p.name.first} ${p.name.last}`;
        S.retitle(th, `${th.vars.leader}'s Expedition to ${th.vars.place[0].toUpperCase()}${th.vars.place.slice(1)}`);
        th.vars.find = S.choose(th, [{ to: 'discovery', w: 1.3 }, { to: 'beasts', w: 0.8 }, { to: 'empty', w: 0.5 }, { to: 'collapse', w: 0.4 }], rng).to;
        const at = townMid(L.settlement);
        S.actor(th, { key: 'scholar', kind: 'npc', role: 'scholar', talk: true, at, stay: true, person: { ...p, title: 'Scholar' }, orders: { home: at, roam: 4, mark: 'talk', lines: ['Has anyone seen my notebook?', 'Fascinating. FASCINATING.', 'I need a guard. A sturdy one.'] } });
        S.note(th, `${th.vars.leader}, a scholar, has come to ${L.settlement.name} meaning to go out to ${th.vars.place}, and is looking for someone to guard them.`, { news: [th.sid] });
      },
      day(th, S, rng) {
        // (Nobody came: they go alone.)
        if ((S.now - th.nodeAt) / DAY > 3 && !th.vars.guard) {
          S.dismissActor(th, 'scholar');
          const how = th.vars.find === 'discovery' && rng.chance(0.5) ? 'found' : rng.chance(0.4) ? 'back' : 'lost';
          if (how === 'found') {
            const s = S.game.world.ow.settlements[th.sid];
            if (s && S.sim.tech && S.sim.tech.addPoints) S.sim.tech.addPoints(s, 4, S.day);
            return S.end(th, 'discovery', `${th.vars.leader} went out to ${th.vars.place} alone, and came back with a cart of old books and a look of wonder.`, { news: [th.sid] });
          }
          if (how === 'back') return S.end(th, 'turned back', `${th.vars.leader} went out to ${th.vars.place} alone, and came back the next day, muddy and empty-handed.`);
          return S.end(th, 'lost', `${th.vars.leader} went out to ${th.vars.place} alone, and hasn't come back.`, { news: [th.sid] });
        }
      },
      fade: 8,
    },
    going: {
      live(th, S) {
        const e = S.actorEnt(th, 'scholar');
        const at = th.vars.at;
        if (!e || Math.max(Math.abs(e.x - at.x), Math.abs(e.z - at.z)) > 6) return;
        S.go(th, 'there');
      },
      day(th, S) {
        if ((S.now - th.nodeAt) / DAY > 4) {
          S.dismissActor(th, 'scholar');
          S.end(th, 'abandoned', `${th.vars.leader}'s expedition never reached ${th.vars.place}.`);
        }
      },
      fade: 6,
    },
    there: {
      enter(th, S) {
        const rng = S.rng(th, 0x7e3);
        const at = th.vars.at;
        const pid = th.vars.guard;
        const f = th.vars.find;
        const e = S.actorEnt(th, 'scholar');
        if (e) e.say(pick(rng, ['This is it! This is the place!', 'Oh. Oh my.', 'Careful where you step...']), 3, '#a0e0ff');
        if (f === 'beasts') {
          for (let i = 0; i < 3; i++) S.actor(th, { key: `b${i}`, kind: 'beast', role: 'den', species: rng.pick(['wolf', 'skeleton', 'ghoul']), hostile: true, at: { x: at.x + rng.int(-5, 5), z: at.z + rng.int(-5, 5) }, orders: { home: at } });
          th.vars.fighting = true;
          return;
        }
        finishExped(th, S, pid, rng);
      },
      live(th, S) {
        if (!th.vars.fighting) return;
        if (th.actors.some((a) => a.key.startsWith('b') && !a.gone && !a.dead)) return;
        if (!S.actorEnt(th, 'scholar') && th.actors.find((a) => a.key === 'scholar' && a.dead)) return;
        th.vars.fighting = false;
        finishExped(th, S, th.vars.guard, S.rng(th, 0x7e4));
      },
      fade: 3,
    },
  },
  actorDown(th, a, by, S) {
    if (a.key === 'scholar') S.end(th, 'lost', `${th.vars.leader} died at ${th.vars.place}. Their notebooks were never found.`, { news: [th.sid] });
  },
  hello(th) {
    return th.node === 'gathering' ? 'A guard! Are you a guard? You look like a guard.' : 'Lead on!';
  },
  talk(th, a, npc, pid) {
    if (a.role !== 'scholar' || th.node !== 'gathering') return [];
    return [
      { id: 'sge_go', arg: tid(th), label: `I'll guard you to ${th.vars.place}.` },
      { id: 'sge_why', arg: tid(th), label: 'What do you hope to find there?' },
    ];
  },
  respond(th, npc, pid, id, arg, S) {
    const rng = S.rng(th, 0x9e2);
    if (id === 'sge_why') return { lines: [pick(rng, ['The truth! Or at least an interesting lie.', 'Writing. Bones. Something the Kavorent left. Anything!', 'My reputation, frankly. And possibly a sandwich.'])] };
    if (id === 'sge_go') {
      th.vars.guard = pid;
      S.touch(th, pid, `${nameOf(S, R.pl(pid))} agreed to guard ${th.vars.leader} on the way to ${th.vars.place}.`);
      const a = S.actorSpec(th, 'scholar');
      if (a) a.orders = { ...(a.orders || {}), follow: pid, mark: null, lines: ['Are we nearly there?', 'Did you hear something?', 'I should have brought more ink.'] };
      if (npc && npc.saga) npc.saga.follow = pid;
      S.game.world.ow.pin(th.vars.at.x, th.vars.at.z, th.vars.place, '?');
      S.go(th, 'going');
      return { lines: ['Splendid! Lead on. I\'ll follow. Closely. Very closely.', '(Marked on your map. They\'ll follow you there.)'], close: true };
    }
    return null;
  },
});

function finishExped(th, S, pid, rng) {
  const f = th.vars.find;
  S.dismissActor(th, 'scholar');
  const k = pid ? S.person(pid) : null;
  if (f === 'discovery' || f === 'beasts') {
    const s = S.game.world.ow.settlements[th.sid];
    if (s && S.sim.tech && S.sim.tech.addPoints) S.sim.tech.addPoints(s, 6, S.day);
    if (k) k.fame += 2;
    if (pid) {
      S.give(pid, 'coin', 30);
      if (ITEMS.old_coin) S.give(pid, 'old_coin', 2);
    }
    return S.end(th, 'discovery', `${th.vars.leader} found ${pick(rng, ['writing nobody has read in a thousand years', 'a chamber of Kavorent glass, still lit', 'the bones of something enormous', 'a library, mostly mould, partly not'])} at ${th.vars.place}${pid ? `, with ${nameOf(S, R.pl(pid))} to guard them` : ''}. The scholars of the realm are beside themselves.`, { news: [th.sid] });
  }
  if (f === 'collapse') {
    if (pid) S.asPid(pid, (p) => { p.hp = Math.max(1, p.hp - 4); });
    return S.end(th, 'collapse', `The roof at ${th.vars.place} came down as ${th.vars.leader} stepped inside. They got out, just; whatever was there is under the rubble now.`);
  }
  S.end(th, 'empty', `${th.vars.leader} reached ${th.vars.place}, and found it empty: picked clean long ago. "Well," they said. "Now we know."`);
  void rng;
}

// ------------------------------------------------------------ a barn raising
motif({
  id: 'barn_raising',
  family: 'ventures',
  max: 3,
  key: (o) => `barn:${o.cast.family.sid}:${o.cast.family.idx}`,
  title: (th) => `Raising ${th.names.family}'s ${th.vars.what[0].toUpperCase()}${th.vars.what.slice(1)}`,
  scan(S, rng) {
    if (!rng.chance(0.05)) return null;
    for (const L of rng.shuffle(laidTowns(S)).slice(0, 3)) {
      const r = adults(L).find((q) => ['farmer', 'handler', 'miller'].includes(q.job));
      if (!r) continue;
      return { cast: { family: R.rec(L.settlement.id, r.idx), town: R.town(L.settlement.id) }, sid: L.settlement.id, vars: { what: 'barn', why: rng.pick(['the storm', 'a lightning strike', 'the fire', 'rot, and then a strong wind']) } };
    }
    return null;
  },
  // Two families at war, side by side with the hammers: it may mend things.
  meets: [
    {
      m: 'feud',
      when: (a, b, S) => {
        const r = recOf(S, a.cast.family);
        return a.node === 'calling' && r && b.sid === a.sid && [b.vars.fa, b.vars.fb].includes(r.name.last);
      },
      then(a, b) {
        a.vars.feud = b.id;
      },
    },
  ],
  nodes: {
    calling: {
      enter(th, S) {
        const r = recOf(S, th.cast.family);
        const L = layoutOf(S, th.sid);
        if (!r || !L) return S.end(th, 'faded');
        const rng = S.rng(th, 0xba4);
        th.vars.day = S.day + 2;
        th.vars.hands = 0;
        th.vars.planks = false;
        S.note(th, `${th.names.family}'s ${th.vars.what} came down in ${th.vars.why}. The town means to raise a new one in a day: day ${th.vars.day + 1}, from dawn.`, { news: [th.sid] });
        const t = S.post(th, {
          role: 'planks', kind: 'fetch', title: `Bring 12 planks for ${first(r)}'s new ${th.vars.what}`, sid: th.sid, giver: th.cast.family, item: 'planks', n: 12,
          pitch: say(rng, ['We\'ve the hands, near enough. What we haven\'t got is timber. Twelve planks, and it\'s up by sundown.', 'The town\'s turning out to help. If someone could find the planks... twelve. I\'d owe you a lifetime of eggs.'], {}),
          reward: { coins: 15, rep: 15, renown: th.sid, renownPts: 2, renownWhy: 'raising a barn', fame: 0.5 },
        });
        t.offerLabel = 'I heard about your loss. Can I help?';
        const m = townMid(L.settlement);
        const h = r.home !== null && r.home !== undefined ? L.buildings[r.home] : null;
        th.vars.at = h && h.outside ? { x: h.outside.x, z: h.outside.z } : m;
      },
      day(th, S, rng) {
        if (S.day < th.vars.day) return;
        const L = layoutOf(S, th.sid);
        if (!L) return S.end(th, 'faded');
        // The day: how it went.
        const ppl = adults(L);
        const came = ppl.filter((q) => rng.chance(0.25 + nat(q, 'kindness') * 0.4)).length + (th.vars.hands || 0) * 3;
        const f = th.vars.feud ? S.thread(th.vars.feud) : null;
        let line = `Half of ${L.settlement.name} came to raise ${th.names.family}'s ${th.vars.what}: ${came} pairs of hands.`;
        if (f && !f.done) {
          if (rng.chance(0.5)) {
            line += ` Even the ${f.vars.fa === recOf(S, th.cast.family)?.name.last ? f.vars.fb : f.vars.fa}s came, and worked all day without a word, and at the end of it shook hands.`;
            S.join(th, f, 'The barn raising ended the feud.');
          } else line += ` The ${f.vars.fa === recOf(S, th.cast.family)?.name.last ? f.vars.fb : f.vars.fa}s stayed away. Everyone noticed.`;
        }
        if (!th.vars.planks && rng.chance(0.6)) {
          return S.end(th, 'half built', `${line} But there wasn't the timber: it stands half-built, roofless, until there is.`, { news: [th.sid] });
        }
        const twist = pick(rng, ['', ` ${pick(rng, ['Someone fell off the roof into the hay. They were fine.', 'Two people who\'d never spoken before were seen walking home together.', 'There was a supper after, in the new barn, and a fiddle.', 'A goat ate somebody\'s hat.'])}`]);
        const r = recOf(S, th.cast.family);
        if (r) r.mood = Math.min(1, (r.mood ?? 0.5) + 0.3);
        S.end(th, 'raised', `${line} The new ${th.vars.what} was up by sundown.${twist}`, { news: [th.sid] });
      },
      fade: 6,
    },
  },
  tasks: {
    planks: { done(th) { th.vars.planks = true; }, thanks: () => ['Timber! Now we\'ll have it up in a day, you\'ll see.'] },
  },
  townTalk(th, npc, pid, S) {
    if (!isRec(npc, th.cast.family) || (th.vars.helpers || []).includes(pid)) return [];
    return [{ id: 'sgr2_help', arg: tid(th), label: `I'll be there on the day, with a hammer.` }];
  },
  respond(th, npc, pid, id, arg, S) {
    if (id !== 'sgr2_help') return null;
    (th.vars.helpers ||= []).push(pid);
    th.vars.hands = (th.vars.hands || 0) + 1;
    S.touch(th, pid, `${nameOf(S, R.pl(pid))} promised to help raise ${th.names.family}'s ${th.vars.what}.`);
    S.person(pid).fame += 0.5;
    return { lines: ['Bless you. Dawn, mind. Bring your own lunch.'] };
  },
});

// ------------------------------------------------------------ a rivalry
const PRIZES = ['the best pie at the fair', 'the biggest marrow', 'the finest horse', 'the best ale in town', 'the best roses', 'the sharpest blade', 'the loudest rooster'];

motif({
  id: 'rivalry',
  family: 'ventures',
  max: 4,
  key: (o) => [`${o.cast.a.sid}:${o.cast.a.idx}`, `${o.cast.b.sid}:${o.cast.b.idx}`].sort().join('~'),
  title: (th) => `${th.names.a} and ${th.names.b}: ${th.vars.over[0].toUpperCase()}${th.vars.over.slice(1)}`,
  scan(S, rng) {
    if (!rng.chance(0.06)) return null;
    for (const L of rng.shuffle(laidTowns(S)).slice(0, 3)) {
      const ppl = adults(L).filter((r) => has(r, 'proud') || has(r, 'stubborn') || nat(r, 'temper') > 0.5);
      if (ppl.length < 2) continue;
      const a = rng.pick(ppl);
      const b = rng.pick(ppl.filter((q) => q !== a && q.household !== a.household));
      if (!b) continue;
      return { cast: { a: R.rec(L.settlement.id, a.idx), b: R.rec(L.settlement.id, b.idx), town: R.town(L.settlement.id) }, sid: L.settlement.id, vars: { over: a.job === b.job ? `who's the better ${a.job}` : rng.pick(PRIZES) } };
    }
    return null;
  },
  nodes: {
    simmering: {
      enter(th, S) {
        const a = recOf(S, th.cast.a);
        const b = recOf(S, th.cast.b);
        if (!a || !b) return S.end(th, 'faded');
        const rng = S.rng(th, 0x4e1);
        th.vars.heat = 0.4;
        th.vars.warm = 0.1;
        th.vars.score = { a: 0, b: 0 };
        S.note(th, say(rng, [
          '{a} and {b} each say they have {o}. Each says the other is a fraud.',
          '{a} won\'t hear a word said for {b}, and {b} won\'t let {a} forget it: {o}, and nothing else matters.',
          'It started as a joke between {a} and {b}: {o}. It isn\'t a joke any more.',
        ], { a: th.names.a, b: th.names.b, o: th.vars.over }), { news: [th.sid] });
      },
      day(th, S, rng) {
        const a = recOf(S, th.cast.a);
        const b = recOf(S, th.cast.b);
        const L = layoutOf(S, th.sid);
        if (!a || !b || !alive(a) || !alive(b) || !L) return S.end(th, 'over', 'One of them is gone. The other finds they miss it.');
        // Round by round: one gets the better of the other.
        const w = rng.chance(0.5 + (nat(a, 'diligence') - nat(b, 'diligence')) * 0.4) ? 'a' : 'b';
        th.vars.score[w]++;
        const hot = Math.max(nat(a, 'temper'), nat(b, 'temper'));
        th.vars.heat = Math.max(0, Math.min(1, th.vars.heat + rng.float(-0.09, 0.09) + (hot - 0.62) * 0.08));
        // (Sometimes respect, and sometimes more.)
        const soft = (nat(a, 'kindness') + nat(b, 'kindness')) / 2;
        th.vars.warm = Math.min(1, th.vars.warm + rng.float(-0.03, 0.07) + (soft - 0.45) * 0.06 + (has(a, 'romantic') || has(b, 'romantic') ? 0.03 : 0) + (has(a, 'cheerful') || has(b, 'cheerful') ? 0.02 : 0));
        if (rng.chance(0.35)) S.note(th, pick(rng, [`${th.names[w]} won this week's round: ${th.vars.over}. The other one is sulking.`, `The whole street has taken sides: ${th.names.a}'s or ${th.names.b}'s.`, `${th.names[w]} has been seen gloating. Loudly.`]));
        const days = (S.now - th.nodeAt) / DAY;
        if (th.vars.heat >= 0.95 && days > 6 && rng.chance(0.5) && a.name.last !== b.name.last) {
          return S.split(th, 'feud', { cast: { a: th.cast.a, b: th.cast.b, town: R.town(th.sid) }, sid: th.sid, vars: { why: th.vars.over, fa: a.name.last, fb: b.name.last, step: 1 } }, `It's past a rivalry now: ${th.names.a} and ${th.names.b}'s families are at war.`) && S.end(th, 'feud');
        }
        if (th.vars.warm >= 0.7 && single(L, a) && single(L, b) && !a.courting && !b.courting && !blood(a, b)) {
          S.split(th, 'courtship', { cast: { a: th.cast.a, b: th.cast.b, town: R.town(th.sid) }, sid: th.sid, vars: { met: `quarrelling over ${th.vars.over}`, ha: 0.6, hb: 0.55 } });
          return S.end(th, 'something else', `Somewhere in all the arguing, ${th.names.a} and ${th.names.b} stopped wanting to win. Nobody is more surprised than they are.`);
        }
        if (th.vars.warm >= 0.55 && th.vars.heat < 0.5) return S.end(th, 'friends', `${th.names.a} and ${th.names.b} called it a draw, and shook on it. They're friends now, if you can believe it, and the worst people to sit between at the tavern.`);
        if (days > 14) S.end(th, 'settled', `${th.names[th.vars.score.a >= th.vars.score.b ? 'a' : 'b']} has the better of it, everyone agrees. The other one doesn't.`);
      },
      fade: 20,
    },
  },
  townTalk(th, npc, pid, S) {
    if (th.vars.judged || !(isRec(npc, th.cast.a) || isRec(npc, th.cast.b))) return [];
    return [
      { id: 'sgv2_judge', arg: `${tid(th)}:a`, label: `I'll judge it: ${th.names.a} wins.` },
      { id: 'sgv2_judge', arg: `${tid(th)}:b`, label: `I'll judge it: ${th.names.b} wins.` },
      { id: 'sgv2_peace', arg: tid(th), label: 'You\'re both good at it. Isn\'t that enough?' },
    ];
  },
  respond(th, npc, pid, id, arg, S) {
    const rng = S.rng(th, 0x1d6);
    const L = layoutOf(S, th.sid);
    if (id === 'sgv2_judge') {
      const w = String(arg).split(':')[1];
      const l = w === 'a' ? 'b' : 'a';
      th.vars.judged = pid;
      S.touch(th, pid);
      const loser = recOf(S, th.cast[l]);
      const winner = recOf(S, th.cast[w]);
      repWith(S, L, winner, 15);
      repWith(S, L, loser, -15);
      const sore = loser && (nat(loser, 'temper') > 0.6 || has(loser, 'proud'));
      S.end(th, 'judged', `${nameOf(S, R.pl(pid))} judged between them: ${th.names[w]} has ${th.vars.over}. ${sore ? `${th.names[l]} hasn't spoken to anyone since.` : `${th.names[l]} took it with a good grace, and a better pie next year.`}`, { news: [th.sid] });
      return { lines: [isRec(npc, th.cast[w]) ? 'HA! I knew it! Did you hear that? Did EVERYONE hear that?' : sore ? 'You\'re a fool, then. A blind fool.' : '...Fair enough. Next year, though. Next year.'] };
    }
    if (id === 'sgv2_peace') {
      S.touch(th, pid);
      if (persuade(S, npc, rng, 0.25, th.vars.heat * 0.4)) {
        th.vars.warm = Math.min(1, th.vars.warm + 0.25);
        th.vars.heat = Math.max(0, th.vars.heat - 0.2);
        return { lines: [pick(rng, ['...Maybe. Don\'t tell them I said so.', 'They ARE good at it. Annoyingly good.'])] };
      }
      return { lines: ['Enough? It\'ll be enough when they admit I\'m better.'] };
    }
    return null;
  },
});

