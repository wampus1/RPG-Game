// (Round 136) What townsfolk want out of life, and what they do about it.
//
// Now and then someone sets their heart on something, out of who they are
// and what's happened to them: to be the best at their trade (the gifted
// and the proud), to take up the trade they were made for (one stuck in
// the wrong work), to open a business of their own, to find someone (the
// lonely, the romantic, the smitten), to lead the town (the able, when the
// town's unhappy with its mayor), to get even (with a neighbour, or with
// you), to leave (the frightened, the worn-down, the grieving), to stand
// with the watch (the brave, after a raid), to study, to mend things with
// a brother they haven't spoken to in years, to feed the family, to have a
// child.
//
// Each day they do something about it: practise after hours, save, court,
// canvass, bad-mouth, plan, drill, read. When the time comes they act
// through the same things everyone else does: a business opened, a
// courtship begun, an election called, a duel at dawn, a family packing
// for another town, a new trade taken up, a place at the Academy (the
// stories: see sim/saga). It can come to nothing; they can give up, or
// think better of it, or find they haven't the gift.
//
// Others play their part. Friends and family help (or don't), rivals for
// the same thing sour on each other, and you can help them, talk them out
// of it, or stand in their way (see game/social.js). What becomes of it is
// remembered (pride, grief, a grudge), told about, and written in the
// town's ledger when it matters.
//
// A record's ambition (`amb`): { k: kind, d: the day it began, p: how far
// along (0..1), st: its stage, t: whom or what it's for, n: their name,
// x: anything else, th: the story it became, h: help had }.
import { RNG, hash4, clamp } from '../../util/rng.js';
import { alive, DAY, ledger } from '../econ.js';
import { feelings, feel, stir, focus } from './emotion.js';
import { remember, recall, warm, opinionOf } from './memory.js';
import { JOB_SKILLS, practise, skillOf, talentOf, fitFor, tradeSkill } from './talent.js';
import { P, has, bond, blood, nk, nameOf, chemistry } from './common.js';
import { retrain } from '../../entities/npcgen.js';
import { SUBJECT_KEYS } from '../college.js';
import { ITEMS } from '../../world/items.js';

const rec = (sid, idx) => ({ t: 'rec', sid, idx });
const town = (sid) => ({ t: 'town', sid });
const busyOf = (r) => r.ruler !== undefined || r.councillor !== undefined || r.soldier !== undefined || r.captive !== undefined || r.raid !== undefined || !!r.trip || !!r.hired || !!(r.life && r.life.exiled);

// (What the stories need to begin with: as their own scans make them.)
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
const PLATFORMS = ['tax', 'walls', 'feast', 'roads', 'school'];
const RIFTS = [
  ['a word said at a funeral', 'what was said at the funeral'], ['a debt never paid back', 'the money'], ['a will that left one of them everything', 'the will'],
  ['a marriage one of them wouldn\'t bless', 'the wedding'], ['a farm sold without asking', 'the farm'], ['a lie told years ago', 'the lie'],
];
// The trades someone might set their heart on, and what each needs most.
const DREAM_TRADES = ['blacksmith', 'carpenter', 'tailor', 'herbalist', 'baker', 'cook', 'merchant', 'scholar', 'builder', 'glassblower', 'jeweller', 'guard', 'farmer', 'fisher', 'trapper'];
const STUCK = new Set(['laborer', 'beggar', 'farmer', 'fisher', 'lumberjack', 'miner', 'trapper']);
// The wrongs a grudge is born of.
const WRONGS = new Set(['hurt', 'wronged', 'insult', 'quarrel', 'row', 'slander', 'tactless', 'scorned', 'cheated']);
// What a craftsman would be glad of, from you, to get better at it.
export const TRADE_GOODS = {
  blacksmith: 'iron_ingot', carpenter: 'planks', builder: 'planks', tailor: 'cloth', cook: 'wheat', baker: 'wheat', farmer: 'seeds', herbalist: 'herb',
  scholar: 'book', researcher: 'book', priest: 'book', fisher: 'bait', glassblower: 'sand', jeweller: 'gem', merchant: 'coin', guard: 'iron_ingot',
};

// How many guards a town would have.
export const guardsWanted = (L, pop) => Math.max(2, Math.round(pop / 8));

// ------------------------------------------------------------ the kinds
// Each: want(c, r) -> { s (how much, about 0..1), t?, n?, x? } or null;
// day(c, r, a) each day it's held (calls c.end to finish it).
export const AMBITIONS = {
  // ---- to be the best at their trade
  master: {
    label: (a) => `to be a master of ${a.x}`,
    want(c, r) {
      if (r.age !== 'adult' && r.age !== 'elder') return null;
      const jobs = JOB_SKILLS[r.job];
      if (!jobs) return null;
      const k = jobs[0];
      const s = skillOf(r, k);
      if (s < 0.45 || s >= 0.86) return null;
      const t = talentOf(c.L, r, k);
      if (t < 0.55) return null;
      const p = P(r);
      return { s: 0.1 + (p.diligence - 0.5) * 0.6 + (t - 0.6) * 1.2 + feel(r, 'pride', c.now) * 0.4 + (has(r, 'proud') ? 0.15 : 0) + (has(r, 'hardworking') ? 0.15 : 0) - (has(r, 'lazy') ? 0.4 : 0), x: k };
    },
    day(c, r, a) {
      const k = a.x;
      let mentor = 0;
      for (const q of c.adults) if (q !== r && q.job === r.job) mentor = Math.max(mentor, skillOf(q, k));
      // (Long evenings at it.)
      const s = practise(c.L, r, k, 0.0035, mentor, focus(r, c.now));
      a.p = clamp(s / 0.88, 0, 1);
      if (s >= 0.88) return c.end(r, 'done');
      const cap = 0.55 + talentOf(c.L, r, k) * 0.45;
      // (The ungifted find where their gift runs out.)
      if (cap < 0.88 && s >= cap - 0.004 && c.day - a.d >= 8) return c.end(r, 'lost', { k: 'ceiling', x: k });
      if (c.day - a.d > 80) return c.end(r, 'let_go');
      return null;
    },
  },

  // ---- to take up the trade they were made for
  trade: {
    label: (a) => `to become a ${a.x}`,
    want(c, r) {
      if (r.age !== 'adult' || ['mayor', 'guard', 'priest', 'noble', 'merchant'].includes(r.job) || busyOf(r)) return null;
      const jobs0 = JOB_SKILLS[r.job];
      if (!STUCK.has(r.job) && (tradeSkill(r) >= 0.25 || (jobs0 && talentOf(c.L, r, jobs0[0]) >= 0.45))) return null;
      const here = fitFor(c.L, r, r.job) || 0.3;
      let best = null;
      for (const j of DREAM_TRADES) {
        if (j === r.job || !JOB_SKILLS[j]) continue;
        const t = talentOf(c.L, r, JOB_SKILLS[j][0]);
        if (t < 0.65) continue;
        const gap = t - here;
        const room = j === 'guard' || c.L.hasWorkplaceFor(j) ? 0.1 : -0.05;
        if (gap > 0.15 && (!best || gap + room > best.g)) best = { j, g: gap + room };
      }
      if (!best) return null;
      return { s: best.g * 0.8 + (P(r).diligence - 0.5) * 0.3 + feel(r, 'strain', c.now) * 0.25 - 0.15, x: best.j };
    },
    day(c, r, a) {
      const j = a.x;
      const k = JOB_SKILLS[j][0];
      let mentor = 0;
      for (const q of c.adults) if (q.job === j) mentor = Math.max(mentor, skillOf(q, k));
      // (Their evenings, with whoever will teach them.)
      const s = practise(c.L, r, k, 0.005 + (a.h || 0) * 0.002, mentor, focus(r, c.now));
      a.p = clamp(s / 0.4, 0, 1);
      if (s < 0.4) return c.day - a.d > 50 ? c.end(r, 'let_go') : null;
      const room = j === 'guard' ? c.guards < guardsWanted(c.L, c.ppl.length) : c.L.hasWorkplaceFor(j);
      if (room) {
        const was = r.job;
        retrain(c.L, r, j, new RNG(hash4(r.idx, c.day, 0x7ade)));
        c.end(r, 'done');
        ledger(c.L, c.day, `${nameOf(r)} has given up ${was === 'beggar' ? 'begging' : `work as a ${was}`} to become a ${j}. "It's what I always wanted," they say.`);
        return 'retrained';
      }
      // (Nowhere here for it: somewhere else, for the single and the bold.)
      if (c.day - a.d > 20 && r.partner === null && !(r.children || []).length && P(r).bravery > 0.5) {
        const T = c.M.townWith(c.L, (q) => q.hasWorkplaceFor(j));
        if (T) {
          c.end(r, 'done');
          c.M.move(c.L, [r], T, `to take up work as a ${j}`);
          ledger(c.L, c.day, `${nameOf(r)} has gone to ${T.settlement.name} to become a ${j}: there's no place for one here.`);
          return 'moved';
        }
      }
      return c.day - a.d > 45 ? c.end(r, 'lost') : null;
    },
  },

  // ---- a business of their own
  venture: {
    label: () => 'to open a business of their own',
    want(c, r) {
      if (r.age !== 'adult' || ['mayor', 'guard', 'priest'].includes(r.job) || r.venture || busyOf(r) || !c.S) return null;
      const tr = skillOf(r, 'trading');
      const p = P(r);
      return { s: -0.25 + tr * 0.6 + (p.diligence - 0.5) * 0.4 + (has(r, 'shrewd') ? 0.2 : 0) + (has(r, 'proud') ? 0.1 : 0) + Math.min(0.25, (r.coins || 0) / 400) + feel(r, 'joy', c.now) * 0.15 };
    },
    day(c, r, a) {
      if (!a.st) {
        // (Saving up, working it out.)
        a.p = clamp(a.p + 0.15 + skillOf(r, 'trading') * 0.1 + (a.h || 0) * 0.1, 0, 1);
        if (a.p < 1) return c.day - a.d > 25 ? c.end(r, 'let_go') : null;
        const v = VENTURES.filter((q) => ITEMS[q.wants]);
        if (!v.length) return c.end(r, 'let_go');
        const pick = v[hash4(r.idx, c.day, 0x7e47) % v.length];
        const th = c.S.startStory('venture', { cast: { owner: rec(c.sid, r.idx), town: town(c.sid) }, sid: c.sid, vars: { kind: pick.k, biz: pick.name, wants: pick.wants, n: pick.n, need: 20 + c.rng.int(0, 40) } });
        if (!th) return c.day - a.d > 25 ? c.end(r, 'let_go') : null;
        a.th = th.id;
        a.st = 1;
        a.x = pick.name;
        return 'began';
      }
      return c.threadDone(r, a, ['thriving', 'sold', 'getting by']);
    },
  },

  // ---- to find someone
  wed: {
    label: (a) => (a.n ? `to win ${a.n}'s heart` : 'to find someone to love'),
    want(c, r) {
      if (r.age !== 'adult' || (r.partner !== null && r.partner !== undefined) || r.courting || r.visitor || busyOf(r)) return null;
      const p = P(r);
      const t = bestMatch(c, r);
      const s = -0.1 + p.sociability * 0.3 + feel(r, 'love', c.now) * 0.5 + (has(r, 'romantic') ? 0.25 : 0) + ((r.friends || []).length ? 0 : 0.1) + (t ? Math.max(0, t.v) * 0.5 : 0);
      return t && t.v > 0.15 ? { s, t: nk(t.q), n: t.q.name.first } : { s: s - 0.1 };
    },
    day(c, r, a) {
      if (r.partner !== null && r.partner !== undefined) return c.end(r, 'done');
      if (a.st) return c.threadDone(r, a, ['wed', 'eloped'], () => r.partner !== null && r.partner !== undefined);
      if (!a.t) {
        // (Out more of an evening, meeting people: see social.js.)
        const t = bestMatch(c, r);
        if (t && t.v > 0.25) {
          a.t = nk(t.q);
          a.n = t.q.name.first;
        }
        return c.day - a.d > 50 ? c.end(r, 'let_go') : null;
      }
      const q = c.L.npcs[+a.t.slice(2)];
      if (!q || !alive(q) || q.away || q.migrated || (q.partner !== null && q.partner !== undefined) || q.courting) {
        // (Someone else got there first.)
        stir(r, 'grief', 0.25, c.now);
        remember(r, { k: 'heartbreak', w: a.t, n: a.n, v: -0.6, s: 0.5 }, c.day);
        a.t = null;
        a.n = null;
        return null;
      }
      warm(r, nk(q), 0.03 + (a.h || 0) * 0.02);
      warm(q, nk(r), chemistry(q, r) * 0.04 + 0.01 + (a.h || 0) * 0.03);
      stir(r, 'love', 0.05, c.now);
      const mine = opinionOf(r, nk(q));
      const theirs = opinionOf(q, nk(r));
      a.p = clamp((mine + theirs) / 0.8, 0, 1);
      if (mine >= 0.4 && theirs >= 0.3) {
        const th = c.S && c.S.startStory('courtship', { cast: { a: rec(c.sid, r.idx), b: rec(c.sid, q.idx), town: town(c.sid) }, sid: c.sid });
        if (th) {
          a.th = th.id;
          a.st = 1;
          return 'began';
        }
      }
      // (Not to be: they've made it plain.)
      if (theirs <= -0.1 && c.day - a.d > 8) {
        stir(r, 'grief', 0.3, c.now);
        stir(r, 'shame', 0.2, c.now);
        remember(r, { k: 'rejected', w: a.t, n: a.n, v: -0.6, s: 0.5 }, c.day);
        warm(r, a.t, -0.15);
        a.t = null;
        a.n = null;
      }
      return c.day - a.d > 60 ? c.end(r, 'let_go') : null;
    },
  },

  // ---- to lead the town
  office: {
    label: () => 'to be mayor',
    want(c, r) {
      if (r.age !== 'adult' || ['mayor', 'guard'].includes(r.job) || busyOf(r) || !c.S || c.governed || c.L.settlement.type === 'village' || !c.mayor) return null;
      const lead = skillOf(r, 'leadership');
      const charm = skillOf(r, 'charm');
      const unhappy = Math.max(0, 0.5 - c.mood) + Math.max(0, -opinionOf(r, nk(c.mayor))) * 0.5 + (c.grievance ? 0.2 : 0);
      return { s: -0.35 + lead * 0.8 + charm * 0.3 + (has(r, 'proud') ? 0.12 : 0) + (P(r).sociability - 0.5) * 0.3 + unhappy * 0.8 };
    },
    day(c, r, a) {
      if (a.st) return c.threadDone(r, a, ['new leader'], () => r.job === 'mayor');
      if (r.job === 'mayor') return c.end(r, 'done');
      if (!c.mayor || c.governed) return c.end(r, 'let_go');
      // (Canvassing: a word here, a drink there.)
      const charm = skillOf(r, 'charm');
      for (let i = 0; i < 2; i++) {
        const q = c.adults[c.rng.int(0, c.adults.length - 1)];
        if (q !== r && q !== c.mayor) warm(q, nk(r), (charm - 0.3) * 0.06 + chemistry(q, r) * 0.02);
      }
      practise(c.L, r, 'leadership', 0.002);
      a.p = clamp(a.p + 0.12 + charm * 0.06 + (a.h || 0) * 0.08, 0, 1);
      if (a.p < 1) return null;
      const pb = c.grievance === 'tax' ? 'tax' : c.grievance === 'safety' ? 'walls' : PLATFORMS[c.rng.int(0, PLATFORMS.length - 1)];
      const rest = PLATFORMS.filter((k) => k !== pb);
      const th = c.S.startStory('election', { cast: { a: rec(c.sid, c.mayor.idx), b: rec(c.sid, r.idx), town: town(c.sid) }, sid: c.sid, vars: { pa: rest[c.rng.int(0, rest.length - 1)], pb } });
      if (!th) return c.day - a.d > 30 ? c.end(r, 'let_go') : null;
      a.th = th.id;
      a.st = 1;
      return 'began';
    },
  },

  // ---- to get even
  revenge: {
    label: (a) => `to get even with ${a.n || 'someone'}`,
    want(c, r) {
      if (r.age === 'child' || busyOf(r)) return null;
      const anger = feel(r, 'anger', c.now);
      const p = P(r);
      if (anger < 0.25 && p.temper < 0.6) return null;
      const m = recall(r, c.day, (q) => WRONGS.has(q.k) && !q.h && q.w && q.s >= 0.35, 0.2)[0];
      if (!m) return null;
      if (m.w.startsWith('n:')) {
        const q = c.L.npcs[+m.w.slice(2)];
        if (!q || !alive(q) || q.away || q.migrated) return null;
      } else if (!m.w.startsWith('p:')) return null;
      return { s: -0.3 + anger * 0.8 + (p.temper - 0.4) * 0.6 + m.s * 0.3 - (p.kindness - 0.5) * 0.6 + (has(r, 'proud') ? 0.1 : 0), t: m.w, n: m.n || null, x: m.k };
    },
    day(c, r, a) {
      const anger = feel(r, 'anger', c.now);
      // (It passes: forgiven, or just let go of.)
      if (anger < 0.12 && c.day - a.d >= 3) return c.end(r, 'let_go', { k: 'forgave', w: a.t, n: a.n });
      const player = a.t.startsWith('p:');
      // Bad-mouthing them to whoever will listen.
      if (!a.st || (player && c.day % 2 === 0)) c.M.badMouth(c.L, r, a, c.day, c.rng, player ? 2 : 1);
      a.p = clamp(a.p + 0.2, 0, 1);
      if (!a.st && a.p >= 0.6 && anger >= 0.3) {
        a.st = 1;
        if (player) {
          // (They'll have it out with you, when they see you.)
          r.seek = { pk: a.t, k: 'confront', d: c.day };
          return 'seek';
        }
        const q = c.L.npcs[+a.t.slice(2)];
        if (!q) return c.end(r, 'let_go');
        const p = P(r);
        if ((p.temper > 0.6 || has(r, 'hot-headed') || has(r, 'proud')) && p.bravery > 0.45 && q.age !== 'child' && c.S) {
          const th = c.S.startStory('honour_duel', { cast: { a: rec(c.sid, r.idx), b: rec(c.sid, q.idx), town: town(c.sid) }, sid: c.sid, vars: { insult: a.x === 'quarrel' ? 'a quarrel that wouldn\'t lie down' : a.x === 'insult' ? 'an insult in front of everyone' : 'a wrong never put right' } });
          if (th) {
            a.th = th.id;
            return 'began';
          }
        }
        if (q.household !== r.household && p.temper > 0.5 && c.society) {
          c.society.feud(c.L, r, q, a.x === 'row' ? 'a row' : 'an old grudge', c.day);
          stir(r, 'anger', -0.2, c.now);
          return c.end(r, 'done');
        }
        // (A low trick, from the unkind: something of theirs gone.)
        if (p.kindness < 0.35 && (q.coins || 0) > 4) {
          const n = Math.min(12, Math.floor(q.coins / 3));
          q.coins -= n;
          r.coins = (r.coins || 0) + n;
          remember(q, { k: 'robbed', v: -0.6, s: 0.5, x: `¤${n}` }, c.day);
          stir(q, 'anger', 0.3, c.now);
          stir(r, 'anger', -0.3, c.now);
          return c.end(r, 'done');
        }
        return null;
      }
      if (a.th && !player) return c.threadDone(r, a, ['first blood', 'death', 'no harm', 'reconciled']);
      if (player && c.day - a.d > 14) return c.end(r, 'let_go');
      return c.day - a.d > 20 ? c.end(r, 'let_go') : null;
    },
  },

  // ---- to leave
  leave: {
    label: () => 'to leave town',
    want(c, r) {
      if (r.age !== 'adult' || ['mayor', 'guard'].includes(r.job) || busyOf(r) || r.visitor) return null;
      const e = feelings(r, c.now) || {};
      const push = (e.x || 0) * 0.5 + (e.f || 0) * 0.45 + (e.g || 0) * 0.25 + (r.hungry >= 1 ? 0.2 : 0) + (c.L.settlement.condition === 'poor' ? 0.15 : 0) + ((c.L.econ.tax || 0) >= 0.15 ? 0.1 : 0) + (1 - (r.mood ?? 0.5)) * 0.25;
      let ties = 0;
      for (const q of c.adults) if (q !== r && q.household !== r.household && bond(r, q)) ties++;
      return { s: -0.35 + push - Math.min(0.3, ties * 0.06) + (P(r).bravery - 0.5) * 0.2 + ((r.mood ?? 0.5) < 0.4 ? 0.12 : 0) };
    },
    day(c, r, a) {
      const e = feelings(r, c.now) || {};
      const push = (e.x || 0) + (e.f || 0) + (e.g || 0) * 0.5 + (r.hungry >= 1 ? 0.3 : 0) + (1 - (r.mood ?? 0.5)) * 0.4;
      // (Things look better: they stay after all.)
      if (push < 0.35 && c.day - a.d >= 4) return c.end(r, 'let_go', { k: 'stayed' });
      // (A partner who won't hear of it slows them down.)
      const mate = r.partner !== null && r.partner !== undefined ? c.L.npcs[r.partner] : null;
      let pace = 0.1 + (e.x || 0) * 0.05 + (a.h || 0) * 0.1;
      if (mate && alive(mate) && !(mate.amb && mate.amb.k === 'leave') && (mate.mood ?? 0.5) > 0.45) {
        pace *= 0.5;
        if (c.rng.chance(0.2)) remember(r, { k: 'row', w: nk(mate), n: mate.name.first, v: -0.3, s: 0.3, x: 'leaving' }, c.day);
      }
      a.p = clamp(a.p + pace, 0, 1);
      if (a.p < 1) return c.day - a.d > 40 ? c.end(r, 'let_go', { k: 'stayed' }) : null;
      const T = c.M.betterTown(c.L);
      if (!T) return c.day - a.d > 30 ? c.end(r, 'let_go', { k: 'stayed' }) : null;
      const fam = c.ppl.filter((q) => q.household === r.household && !busyOf(q) && q.job !== 'mayor');
      if (!fam.includes(r)) fam.push(r);
      const why = (e.f || 0) > (e.x || 0) && (e.f || 0) > (e.g || 0) ? 'somewhere safer' : (e.g || 0) > (e.x || 0) ? 'away from the memories' : r.hungry >= 1 ? 'somewhere they won\'t go hungry' : 'a fresh start';
      c.end(r, 'done');
      c.M.move(c.L, fam, T, why);
      ledger(c.L, c.day, fam.length > 1 ? `The ${r.name.last} family packed up and left ${c.L.settlement.name} for ${T.settlement.name}: ${why}, they said.` : `${nameOf(r)} left ${c.L.settlement.name} for ${T.settlement.name}: ${why}, they said.`);
      return 'moved';
    },
  },

  // ---- to stand with the watch
  protect: {
    label: () => 'to join the watch',
    want(c, r) {
      if (r.age !== 'adult' || r.job === 'guard' || r.job === 'mayor' || busyOf(r)) return null;
      const p = P(r);
      const tc = talentOf(c.L, r, 'combat');
      if (tc < 0.5 || p.bravery < 0.5) return null;
      const why = recall(r, c.day, (m) => ['raid', 'robbed', 'killed', 'loss', 'riot'].includes(m.k) && c.day - m.d < 20, 0.15)[0];
      if (!why) return null;
      return { s: -0.45 + (p.bravery - 0.5) * 0.8 + tc * 0.5 + feel(r, 'anger', c.now) * 0.3 + (c.guards < guardsWanted(c.L, c.ppl.length) ? 0.15 : 0), x: why.k };
    },
    day(c, r, a) {
      let mentor = 0;
      for (const q of c.adults) if (q.job === 'guard') mentor = Math.max(mentor, skillOf(q, 'combat'));
      const s = practise(c.L, r, 'combat', 0.006 + (a.h || 0) * 0.003, mentor, focus(r, c.now));
      a.p = clamp(s / 0.45, 0, 1);
      if (s < 0.45) return c.day - a.d > 45 ? c.end(r, 'let_go') : null;
      if (c.guards < guardsWanted(c.L, c.ppl.length)) {
        retrain(c.L, r, 'guard', new RNG(hash4(r.idx, c.day, 0x6a4d)));
        c.guards++;
        c.end(r, 'done');
        ledger(c.L, c.day, `${nameOf(r)} has joined the watch. "Never again," they say${a.x === 'raid' ? ', after the raid' : ''}.`);
        return 'retrained';
      }
      // (No place in the watch: ready all the same.)
      remember(r, { k: 'militia', v: 0.5, s: 0.45 }, c.day);
      return c.end(r, 'done');
    },
  },

  // ---- to study
  learn: {
    label: () => 'to study',
    want(c, r) {
      if (r.age !== 'adult' || r.academy || busyOf(r) || ['mayor', 'priest'].includes(r.job)) return null;
      const tl = talentOf(c.L, r, 'lore');
      if (tl < 0.68 || skillOf(r, 'lore') > 0.6) return null;
      return { s: -0.35 + (tl - 0.6) * 1.5 + ((r.hobbies || []).includes('reading') ? 0.2 : 0) + (P(r).diligence - 0.5) * 0.3 + feel(r, 'joy', c.now) * 0.1 };
    },
    day(c, r, a) {
      if (a.st) return c.threadDone(r, a, ['graduated']);
      const s = practise(c.L, r, 'lore', 0.004 * (1 + c.books) + (a.h || 0) * 0.004, 0, focus(r, c.now));
      a.p = clamp(s / 0.6, 0, 1);
      // (A city with an Academy: they go, if there's a place.)
      if (c.S && c.day - a.d >= 4 && (a.h || c.rng.chance(0.25))) {
        const city = c.M.academyCity(c.L);
        if (city) {
          const th = c.S.startStory('student', { cast: { student: rec(c.sid, r.idx), town: town(c.sid), city: town(city.settlement.id) }, sid: c.sid, vars: { city: city.settlement.id, love: SUBJECT_KEYS[c.rng.int(0, SUBJECT_KEYS.length - 1)] } });
          if (th) {
            a.th = th.id;
            a.st = 1;
            return 'began';
          }
        }
      }
      if (s >= 0.6) return c.end(r, 'done', { k: 'learned' });
      return c.day - a.d > 60 ? c.end(r, 'let_go') : null;
    },
  },

  // ---- to make it up with someone
  reconcile: {
    label: (a) => `to make it up with ${a.n || 'someone'}`,
    want(c, r) {
      if (r.age === 'child' || busyOf(r)) return null;
      const p = P(r);
      let best = null;
      for (const [k, v] of Object.entries(r.op || {})) {
        if (!k.startsWith('n:') || v > -0.25) continue;
        const q = c.L.npcs[+k.slice(2)];
        if (!q || !alive(q) || q.away || q.migrated || q.age === 'child') continue;
        const close = blood(r, q) || (r.friends || []).includes(q.idx) ? 0.15 : 0;
        if (!best || close - v > best.w) best = { q, w: close - v, close };
      }
      if (!best) return null;
      return { s: -0.35 + (p.kindness - 0.4) * 0.8 + feel(r, 'grief', c.now) * 0.4 + (r.age === 'elder' ? 0.2 : 0) + best.close, t: nk(best.q), n: best.q.name.first, x: blood(r, best.q) ? 'kin' : 'friend' };
    },
    day(c, r, a) {
      if (a.st) return c.threadDone(r, a, ['mended']);
      const q = c.L.npcs[+a.t.slice(2)];
      if (!q || !alive(q) || q.away || q.migrated) return c.end(r, 'let_go');
      warm(r, a.t, 0.05);
      warm(q, nk(r), (P(q).kindness - 0.4) * 0.1 + chemistry(q, r) * 0.03 + (a.h || 0) * 0.08);
      const mine = opinionOf(r, a.t);
      const theirs = opinionOf(q, nk(r));
      a.p = clamp((mine + theirs + 0.6) / 0.8, 0, 1);
      if (a.x === 'kin' && c.day - a.d >= 3 && c.S && !a.tried) {
        a.tried = true;
        const [why, short] = RIFTS[hash4(r.idx, q.idx, 0x41f7) % RIFTS.length];
        const th = c.S.startStory('reconcile', { cast: { x: rec(c.sid, r.idx), y: rec(c.sid, q.idx), town: town(c.sid) }, sid: c.sid, vars: { why, short, years: 2 + (hash4(r.idx, q.idx) % 12) } });
        if (th) {
          a.th = th.id;
          a.st = 1;
          return 'began';
        }
      }
      if (mine >= 0 && theirs >= 0) {
        remember(q, { k: 'made_up', w: nk(r), n: r.name.first, v: 0.7, s: 0.55 }, c.day);
        stir(q, 'joy', 0.3, c.now);
        return c.end(r, 'done', { k: 'made_up', w: a.t, n: a.n });
      }
      if (theirs < -0.45 && c.day - a.d > 10) return c.end(r, 'lost', { k: 'unmended', w: a.t, n: a.n });
      return c.day - a.d > 30 ? c.end(r, 'let_go') : null;
    },
  },

  // ---- to feed the family
  provide: {
    label: () => 'to put food on the table',
    want(c, r) {
      if (r.age !== 'adult' || busyOf(r) || (r.coins || 0) >= 8) return null;
      const kids = (r.children || []).map((i) => c.L.npcs[i]).filter((q) => q && alive(q) && q.age === 'child');
      const hunger = Math.max(r.hungry || 0, ...kids.map((q) => q.hungry || 0));
      if (hunger < 1) return null;
      return { s: 0.05 + hunger * 0.3 + (kids.length ? 0.25 : 0) };
    },
    day(c, r, a) {
      const kids = (r.children || []).map((i) => c.L.npcs[i]).filter((q) => q && alive(q) && q.age === 'child');
      const hunger = Math.max(r.hungry || 0, ...kids.map((q) => q.hungry || 0));
      if (hunger < 1) {
        a.ok = (a.ok || 0) + 1;
        if (a.ok >= 2) return c.end(r, 'done');
        return null;
      }
      a.ok = 0;
      // (Odd jobs, scraping by.)
      r.coins = (r.coins || 0) + 1 + c.rng.int(0, 2);
      a.p = clamp(a.p + 0.1, 0, 1);
      // (Driven to it.)
      if (hunger >= 2 && P(r).kindness < 0.4 && c.rng.chance(0.15)) {
        const life = (r.life ||= {});
        if (!life.vice) {
          life.vice = 'thief';
          life.desperate = c.day;
        }
      }
      return c.day - a.d > 30 ? c.end(r, 'lost') : null;
    },
  },

  // ---- to have a child
  child: {
    label: () => 'to have a child',
    want(c, r) {
      if (r.age !== 'adult' || r.partner === null || r.partner === undefined || busyOf(r)) return null;
      const q = c.L.npcs[r.partner];
      if (!q || !alive(q) || q.home !== r.home) return null;
      const kids = (r.children || []).filter((i) => c.L.npcs[i] && alive(c.L.npcs[i]) && c.L.npcs[i].age === 'child').length;
      if (kids >= 2) return null;
      return { s: -0.15 + feel(r, 'love', c.now) * 0.5 + opinionOf(r, nk(q)) * 0.3 + chemistry(r, q) * 0.15 + (P(r).kindness - 0.5) * 0.3 + (kids ? 0 : 0.2) + (c.L.settlement.condition === 'poor' ? -0.15 : 0) };
    },
    day(c, r, a) {
      const kids = (r.children || []).filter((i) => c.L.npcs[i] && alive(c.L.npcs[i]) && c.L.npcs[i].age === 'child' && (c.L.npcs[i].born ?? 0) >= a.d * DAY - DAY).length;
      if (kids) return c.end(r, 'done');
      if (r.partner === null || r.partner === undefined) return c.end(r, 'let_go');
      a.p = clamp((c.day - a.d) / 30, 0, 1);
      return c.day - a.d > 40 ? c.end(r, 'let_go') : null;
    },
  },
};
export const AMB_KINDS = Object.keys(AMBITIONS);

// The single grown-up `r` would most like to walk out with: { q, v }.
function bestMatch(c, r) {
  let best = null;
  for (const q of c.adults) {
    if (q === r || q.age !== 'adult' || (q.partner !== null && q.partner !== undefined) || q.courting || q.visitor || blood(r, q) || q.household === r.household) continue;
    const v = opinionOf(r, nk(q)) + chemistry(r, q) * 0.3;
    if (!best || v > best.v) best = { q, v };
  }
  return best;
}

// What `r` wants, in a few words (for talk and the console).
export function ambitionWords(r) {
  const a = r && r.amb;
  if (!a || !AMBITIONS[a.k]) return null;
  return AMBITIONS[a.k].label(a);
}
