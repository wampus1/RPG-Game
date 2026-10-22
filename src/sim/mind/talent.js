// (Round 135) What someone is good at, and what they could be good at.
//
// Each townsperson has a talent for each kind of work, never shown: born
// with it, from their mother and father (a little of each, and a good deal
// that's their own), now and then a gift far beyond anyone in the family,
// or a blind spot. Talent is how fast they learn, and how far.
//
// What they can actually do is their skill (see econ.skillsFor: rec.skills,
// 0 to 1). A child starts with next to none. It comes from doing:
//   - an hour's work at a trade, the more the further there is to go and
//     the better a hand works beside them at it;
//   - a child's days at a parent's side, picking up what they do;
//   - the town's teachings: the priest's lessons, the library's books, the
//     Academy's masters;
// and the old let what they no longer use go, a little.
//
// Skill then decides how things turn out: a trapper's catch, a cook's pot,
// a smith's work, how fast a crew builds, what a trader asks, how a guard
// fights, who the town chooses to lead it, what a child grows up to be.
//
// Talents are worked out from the town's seed and the family (the same
// every time: nothing to save, for the town's own folk). Someone come from
// elsewhere carries theirs with them, written on their record (`tal`).
import { RNG, hash4, clamp } from '../../util/rng.js';

// Every skill there is. The first seven are those every record has had
// from the start (see econ.SKILL_JOBS); the rest, round 135's.
export const SKILLS = ['cooking', 'hunting', 'fishing', 'farming', 'trading', 'building', 'crafting', 'combat', 'lore', 'healing', 'leadership', 'charm'];
export const NEW_SKILLS = SKILLS.slice(7);
const IDX = Object.fromEntries(SKILLS.map((k, i) => [k, i]));

// What each kind of work practises: its main skill, then what else it
// calls for.
export const JOB_SKILLS = {
  guard: ['combat', 'leadership'],
  soldier: ['combat'],
  innkeeper: ['cooking', 'charm'],
  cook: ['cooking'],
  barkeep: ['charm', 'cooking'],
  blacksmith: ['crafting', 'building'],
  merchant: ['trading', 'charm'],
  priest: ['healing', 'charm', 'lore'],
  baker: ['cooking'],
  scholar: ['lore', 'crafting'],
  researcher: ['lore'],
  mayor: ['leadership', 'charm', 'trading'],
  noble: ['leadership', 'charm'],
  tailor: ['crafting'],
  carpenter: ['building', 'crafting'],
  herbalist: ['healing', 'farming'],
  fisher: ['fishing'],
  farmer: ['farming'],
  lumberjack: ['building'],
  miner: ['building'],
  trapper: ['hunting', 'combat'],
  laborer: ['building'],
  builder: ['building'],
  beggar: ['charm'],
  handler: ['hunting', 'charm'],
  caravanner: ['trading'],
  adventurer: ['combat', 'hunting'],
  miller: ['crafting', 'farming'],
  glassblower: ['crafting'],
  sporewright: ['crafting', 'healing'],
  pearldiver: ['fishing', 'crafting'],
  jeweller: ['crafting', 'trading'],
};

// The kinds of work a skill leads to, for a child choosing a trade.
export const SKILL_TRADES = {
  cooking: ['cook', 'baker'],
  hunting: ['trapper'],
  fishing: ['fisher'],
  farming: ['farmer'],
  trading: ['merchant'],
  building: ['builder', 'carpenter', 'laborer', 'miner', 'lumberjack'],
  crafting: ['blacksmith', 'tailor', 'carpenter'],
  combat: ['guard'],
  lore: ['scholar'],
  healing: ['herbalist'],
  charm: ['barkeep'],
};

// ------------------------------------------------------------ talent
const Q = 35;
const encode = (arr) => arr.map((v) => Math.round(clamp(v, 0, 1) * Q).toString(36)).join('');
const decoded = new Map();
function decode(s) {
  let t = decoded.get(s);
  if (!t) {
    t = new Float32Array(SKILLS.length);
    for (let i = 0; i < SKILLS.length; i++) t[i] = i < s.length ? parseInt(s[i], 36) / Q : 0.5;
    if (decoded.size > 4096) decoded.clear();
    decoded.set(s, t);
  }
  return t;
}

// Someone's talents (a number from 0 to 1 for each of SKILLS), worked out
// the first time they're wanted. `L`: the town whose record it is (for the
// family and the seed); none, for someone of nowhere in particular.
export function talentsOf(L, rec) {
  if (!rec) return decode('');
  if (typeof rec.tal === 'string') return decode(rec.tal);
  const seed = L && L.settlement ? L.settlement.seed | 0 : hash4(String(rec.name?.first || '').length, String(rec.name?.last || '').length);
  const rng = new RNG(hash4(seed, rec.idx ?? 0, 0x7a1e));
  const own = SKILLS.map(() => clamp(rng.gauss(0.5, 0.17), 0.02, 0.98));
  const par = L ? (rec.parents || []).map((i) => L.npcs[i]).filter((p) => p && p !== rec) : [];
  let t = own;
  if (par.length) {
    const pt = par.map((p) => talentsOf(L, p));
    t = own.map((v, i) => {
      const pm = pt.reduce((a, q) => a + q[i], 0) / pt.length;
      return 0.55 * pm + 0.45 * v;
    });
  }
  // A gift far beyond anyone's, or a blind spot (now and then).
  if (rng.chance(0.05)) t[rng.int(0, SKILLS.length - 1)] = rng.float(0.86, 0.99);
  if (rng.chance(0.05)) t[rng.int(0, SKILLS.length - 1)] = rng.float(0.02, 0.15);
  rec.tal = encode(t);
  return decode(rec.tal);
}

export function talentOf(L, rec, key) {
  return talentsOf(L, rec)[IDX[key]] ?? 0.5;
}

// ------------------------------------------------------------ skill
const round4 = (v) => Math.round(v * 10000) / 10000;

// The skills a record didn't have before round 135, put in as they'd be
// for someone of their age, trade and talent (no dice: the same each time).
export function ensureSkills(L, rec) {
  const sk = (rec.skills ||= {});
  if (sk.combat !== undefined) return sk;
  const tal = talentsOf(L, rec);
  const jobs = JOB_SKILLS[rec.job] || [];
  for (const k of NEW_SKILLS) {
    if (sk[k] !== undefined) continue;
    const t = tal[IDX[k]];
    const main = jobs[0] === k;
    const also = !main && jobs.includes(k);
    let v = main ? 0.3 + t * 0.55 : also ? 0.2 + t * 0.4 : 0.04 + t * 0.22;
    if (rec.age === 'child') v *= 0.15;
    else if (rec.age === 'elder') v = Math.min(1, v * 1.1);
    sk[k] = Math.round(v * 1000) / 1000;
  }
  return sk;
}

export function skillOf(rec, key) {
  const v = rec && rec.skills ? rec.skills[key] : undefined;
  return v === undefined ? 0.2 : v;
}

// Practice: `amt` of it at `key`, the gain the more for talent, the less
// the further along they already are, the more beside someone better
// (`mentor`, their skill), and for a settled mind (see emotion.focus).
export function practise(L, rec, key, amt, mentor = 0, focus = 1) {
  const sk = ensureSkills(L, rec);
  const s = sk[key] ?? 0.2;
  const t = talentOf(L, rec, key);
  // (Talent is a ceiling too: the ungifted level off well short of mastery.)
  const cap = 0.55 + t * 0.45;
  if (s >= cap) return s;
  const left = Math.min(1, (cap - s) / cap);
  const teach = mentor > s ? 1 + Math.min(1, (mentor - s) * 2) : 1;
  const g = amt * (0.35 + t * 1.3) * left * Math.sqrt(left) * teach * focus;
  sk[key] = round4(Math.min(cap, s + g));
  return sk[key];
}

// How good someone is at their trade, all told: its main skill, and a
// little of what goes with it (0..1).
export function tradeSkill(rec) {
  const jobs = JOB_SKILLS[rec.job];
  if (!jobs || !rec.skills) return 0.4;
  let v = skillOf(rec, jobs[0]) * 0.8;
  if (jobs[1]) v += skillOf(rec, jobs[1]) * 0.2;
  else v /= 0.8;
  return v;
}

// A skill as folk would put it (they never know the numbers).
export function skillWord(v) {
  return v >= 0.88 ? 'masterful' : v >= 0.72 ? 'very good' : v >= 0.55 ? 'good' : v >= 0.38 ? 'fair' : v >= 0.2 ? 'middling' : 'green';
}

// What a talent looks like from outside: what a parent, a master or a
// sharp-eyed neighbour might say of it.
export function talentHint(t) {
  return t >= 0.85 ? 'a gift' : t >= 0.68 ? 'a knack' : t >= 0.4 ? null : t >= 0.2 ? 'no great feel' : 'two left hands';
}

// The best of someone's skills (key, value), and of their talents.
export function bestSkill(rec) {
  let best = null;
  for (const [k, v] of Object.entries(rec.skills || {})) if (!best || v > best[1]) best = [k, v];
  return best;
}
export function bestTalent(L, rec) {
  const t = talentsOf(L, rec);
  let bi = 0;
  for (let i = 1; i < t.length; i++) if (t[i] > t[bi]) bi = i;
  return [SKILLS[bi], t[bi]];
}

// ------------------------------------------------------------ growing up
// A child's days: what they pick up from a parent at work (the trade's
// main skill, the more the better the parent is), from playing, and from
// the town's teachings (the priest's lessons, a library's or an Academy's
// books). Once a day.
export function childDay(L, rec, day, teach) {
  const sk = ensureSkills(L, rec);
  for (const pi of rec.parents || []) {
    const p = L.npcs[pi];
    if (!p || !p.skills || p.alive === false || p.away) continue;
    const jobs = JOB_SKILLS[p.job] || [];
    for (let j = 0; j < Math.min(2, jobs.length); j++) {
      const k = jobs[j];
      const ps = skillOf(p, k);
      if (ps <= (sk[k] ?? 0)) continue;
      practise(L, rec, k, j === 0 ? 0.006 : 0.003, ps);
    }
  }
  // Play: chasing, wrestling, games and make-believe.
  practise(L, rec, 'combat', 0.002);
  practise(L, rec, 'charm', 0.003 * (0.5 + (rec.personality?.sociability ?? 0.5)));
  if (teach.priest && day % 2 === 0) {
    practise(L, rec, 'lore', 0.006, teach.priest);
    practise(L, rec, 'healing', 0.003, teach.priest);
  }
  if (teach.books) practise(L, rec, 'lore', 0.006 * teach.books);
  // (A hobby's a teacher too.)
  const hb = rec.hobbies || [];
  if (hb.includes('fishing')) practise(L, rec, 'fishing', 0.004);
  if (hb.includes('gardening')) practise(L, rec, 'farming', 0.004);
  if (hb.includes('sketching')) practise(L, rec, 'crafting', 0.004);
  if (hb.includes('reading')) practise(L, rec, 'lore', 0.004);
  if (hb.includes('training')) practise(L, rec, 'combat', 0.005);
  if (hb.includes('gossip')) practise(L, rec, 'charm', 0.003);
  if (hb.includes('praying')) practise(L, rec, 'healing', 0.002);
}

// A grown-up's day off the job: the old let unused strength go; anyone
// keeps up a hobby's skill. Once a day.
export function adultDay(L, rec, day) {
  const sk = ensureSkills(L, rec);
  if (rec.age === 'elder' && sk.combat > 0.15 && rec.job !== 'guard') sk.combat = round4(sk.combat - 0.002);
  const hb = rec.hobbies || [];
  if (day % 3 === 0) {
    if (hb.includes('reading')) practise(L, rec, 'lore', 0.003);
    if (hb.includes('training')) practise(L, rec, 'combat', 0.003);
    if (hb.includes('music')) practise(L, rec, 'charm', 0.002);
  }
}

// How well suited someone is to a trade: what they've learnt of its main
// skill, and what they could (0..1).
export function fitFor(L, rec, job) {
  const jobs = JOB_SKILLS[job];
  if (!jobs) return 0;
  const k = jobs[0];
  return skillOf(rec, k) * 0.6 + talentOf(L, rec, k) * 0.4;
}
