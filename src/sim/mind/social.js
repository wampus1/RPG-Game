// (Round 136) Townsfolk among themselves: who meets whom in a day, and what
// comes of it.
//
// Each day a few of a town's people cross paths: at work, at home, about
// town. How they get on is down to their chemistry (see common.chemistry:
// fixed for the pair), how they're feeling, and what they already think of
// each other; and over the days it adds up. Two who keep getting on become
// friends (and say so); two who can't stand each other fall out, and a
// falling-out between hot heads can set two households at odds. What one
// feels rubs off on the other a little (gladness, fear, a grievance shared
// with someone who'll listen). The grieving are sat with by those close to
// them, and it helps.
//
// All from the town's own seed and the day (see Mind.townDay), a handful
// of pairs a day, so it costs next to nothing.
import { feelings, stir, valence } from './emotion.js';
import { remember, warm, opinionOf } from './memory.js';
import { P, bond, CLOSE, chemistry, nk, has } from './common.js';

const MAX_FRIENDS = 6;

// Who `a` happens to meet today: someone close, a workmate, or anyone.
function partnerFor(a, adults, rng) {
  const r = rng.next();
  if (r < 0.5) {
    const close = [];
    for (const q of adults) if (q !== a && bond(a, q)) close.push(q);
    if (close.length) return close[rng.int(0, close.length - 1)];
  }
  const b = adults[rng.int(0, adults.length - 1)];
  return b === a ? null : b;
}

// One meeting between `a` and `b`.
export function meet(L, a, b, day, now, rng, society = null) {
  const ea = feelings(a, now);
  const eb = feelings(b, now);
  const ab = opinionOf(a, nk(b));
  const ba = opinionOf(b, nk(a));
  const chem = chemistry(a, b);
  // (How it goes: their chemistry, the mood each is in, and where they
  // already stand with each other: liking and dislike both feed on
  // themselves.)
  const mood = (valence(a, now) + valence(b, now)) * 0.012;
  const sour = ((ea && ea.a) || 0) * 0.035 + ((eb && eb.a) || 0) * 0.035;
  const da = chem * 0.12 + mood - sour + Math.sign(ab) * Math.min(0.02, Math.abs(ab) * 0.04);
  const db = chem * 0.1 + mood - sour + Math.sign(ba) * Math.min(0.02, Math.abs(ba) * 0.04);
  warm(a, nk(b), da);
  warm(b, nk(a), db);
  // What one feels rubs off on the other (and a grievance on someone who
  // likes them).
  contagion(a, b, ea, ba, now);
  contagion(b, a, eb, ab, now);
  const nab = opinionOf(a, nk(b));
  const nba = opinionOf(b, nk(a));
  // Friends, now.
  if (nab >= 0.4 && nba >= 0.3 && !(a.friends || []).includes(b.idx) && (a.friends || []).length < MAX_FRIENDS && (b.friends || []).length < MAX_FRIENDS) {
    (a.friends ||= []).push(b.idx);
    (b.friends ||= []).push(a.idx);
    remember(a, { k: 'friend', w: nk(b), n: b.name.first, v: 0.6, s: 0.4 }, day);
    remember(b, { k: 'friend', w: nk(a), n: a.name.first, v: 0.6, s: 0.4 }, day);
    stir(a, 'joy', 0.15, now);
    stir(b, 'joy', 0.15, now);
    return 'friends';
  }
  // Or at odds.
  if (nab <= -0.3 && nba <= -0.2 && !(a.mem || []).some((m) => m.k === 'quarrel' && m.w === nk(b) && day - m.d < 20)) {
    remember(a, { k: 'quarrel', w: nk(b), n: b.name.first, v: -0.5, s: 0.45 }, day);
    remember(b, { k: 'quarrel', w: nk(a), n: a.name.first, v: -0.5, s: 0.45 }, day);
    stir(a, 'anger', 0.2 + P(a).temper * 0.2, now);
    stir(b, 'anger', 0.2 + P(b).temper * 0.2, now);
    // (Two hot heads: their households at odds too.)
    if (society && P(a).temper > 0.55 && P(b).temper > 0.55 && rng.chance(0.4)) society.feud(L, a, b, 'a falling-out', day);
    return 'quarrel';
  }
  return null;
}

// What `from` feels, a little of it caught by `to` (`op`: what `to` thinks
// of `from`).
function contagion(from, to, e, op, now) {
  if (!e) return;
  if ((e.j || 0) >= 0.4) stir(to, 'joy', e.j * 0.06, now);
  if ((e.f || 0) >= 0.4) stir(to, 'fear', e.f * 0.07 * (1.2 - P(to).bravery), now);
  if ((e.a || 0) >= 0.45 && op >= 0.2) stir(to, 'anger', e.a * 0.05, now);
  if ((e.g || 0) >= 0.5 && op >= 0.3) stir(to, 'grief', e.g * 0.04, now);
}

// The day's meetings, comforting and company, in a town.
export function socialDay(L, ppl, day, now, rng, society = null) {
  const adults = ppl.filter((r) => r.age !== 'child');
  if (adults.length < 2) return { met: 0 };
  const out = { met: 0, friends: 0, quarrels: 0, comforted: 0 };
  // (Those out looking for company meet more people.)
  const n = Math.min(30, Math.ceil(adults.length / 2));
  for (let i = 0; i < n; i++) {
    const a = adults[rng.int(0, adults.length - 1)];
    const b = partnerFor(a, adults, rng);
    if (!b || b === a) continue;
    out.met++;
    const r = meet(L, a, b, day, now, rng, society);
    if (r === 'friends') out.friends++;
    else if (r === 'quarrel') out.quarrels++;
  }
  for (const a of adults) {
    if (!a.amb || a.amb.k !== 'wed' || a.amb.t) continue;
    const b = partnerFor(a, adults, rng);
    if (b && b !== a) meet(L, a, b, day, now, rng, society);
  }
  // The grieving, sat with by those closest to them.
  for (const r of ppl) {
    const e = r.emo;
    if (!e || (e.g || 0) < 0.35) continue;
    let k = 0;
    for (const c of ppl) {
      if (k >= 2 || c === r || c.age === 'child') continue;
      const b = bond(r, c);
      if (!b || (CLOSE[b] || 0) < 0.5 || P(c).kindness < 0.35) continue;
      k++;
      stir(r, 'grief', -0.07 * (0.6 + P(c).kindness), now);
      stir(r, 'love', 0.04, now);
      warm(r, nk(c), 0.03);
      if (day % 4 === r.idx % 4) remember(r, { k: 'sat_with', w: nk(c), n: c.name.first, v: 0.5, s: 0.3 }, day);
    }
    out.comforted += k;
  }
  // Partners: the warmth renewed (or not, between two at odds).
  for (const r of adults) {
    if (r.partner === null || r.partner === undefined || r.idx > r.partner) continue;
    const q = L.npcs[r.partner];
    if (!q || q.away) continue;
    const c = (chemistry(r, q) + opinionOf(r, nk(q)) + opinionOf(q, nk(r))) / 3;
    if (c > 0.1 && (day + r.idx) % 3 === 0) {
      stir(r, 'love', 0.04, now);
      stir(q, 'love', 0.04, now);
    } else if (c < -0.2 && (has(r, 'hot-headed') || has(q, 'hot-headed')) && rng.chance(0.15)) {
      stir(r, 'anger', 0.15, now);
      stir(q, 'anger', 0.15, now);
      remember(r, { k: 'row', w: nk(q), n: q.name.first, v: -0.4, s: 0.3 }, day);
    }
  }
  return out;
}

// Who might come looking for whom today (see Mind.townDay): thanks owed,
// advice wanted, an invitation, a warning.
export function seeksFor(L, ppl, day, rng, pks) {
  for (const r of ppl) {
    if (r.seek || r.age === 'child' || r.away) continue;
    for (const pk of pks) {
      const op = (r.op || {})[pk] || 0;
      if (op < 0.25) continue;
      const thanked = (r.mem || []).some((m) => m.k === 'thanked' && m.w === pk && day - m.d < 12);
      const good = !thanked && (r.mem || []).find((m) => m.w === pk && !m.h && m.v >= 0.7 && m.s >= 0.5 && day - m.d <= 6);
      if (good && rng.chance(0.5)) {
        r.seek = { pk, k: 'thanks', d: day };
        break;
      }
      const a = r.amb;
      if (a && ['leave', 'trade', 'wed', 'venture', 'office'].includes(a.k) && !a.asked && op >= 0.3 && rng.chance(0.25)) {
        a.asked = true;
        r.seek = { pk, k: 'advice', d: day };
        break;
      }
      // (A friend who's heard someone means you harm.)
      const bw = (r.mem || []).find((m) => m.k === 'bad_word' && m.w === pk && m.x && day - m.d <= 4);
      if (bw && op >= 0.35 && rng.chance(0.4)) {
        const teller = ppl.find((q) => q.name.first === bw.x && q.amb && q.amb.k === 'revenge' && q.amb.t === pk);
        if (teller) {
          r.seek = { pk, k: 'warn', d: day, n: teller.name.first };
          break;
        }
      }
      if (op >= 0.5 && P(r).sociability >= 0.6 && rng.chance(0.08)) {
        r.seek = { pk, k: 'invite', d: day };
        break;
      }
    }
  }
}

