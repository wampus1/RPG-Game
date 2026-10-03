// Small talk, made up as it's said, so nobody says quite the same thing
// twice, and what they say has something to do with who they are, what
// they do and what's going on around them.
//
// It's built in three layers, each in its own place:
//   1. What's said (talk/corpus.js). Each topic (the weather, work, food,
//      family, the market, gossip, faith, the realm, what the scholars are
//      at, the town's ship...) has a pool of sentence frames, written in a
//      small phrase grammar (talk/grammar.js): "(The|This) rain (has|leaves)
//      [the whole of] {town} (soaked|dripping)". Expanded, a few dozen
//      frames make thousands of sentences, every one of them grammatical.
//   2. Word chains (talk/chain.js). The frames are said a handful of ways
//      each and a chain learns what follows what; a line is a walk along
//      it. Everyone's talk on a topic is learned once and shared, and each
//      kind of speaker (their people, their way of talking, their quirks,
//      their trade) has a small chain of their own on top; a walk draws on
//      both. Within one topic the joins between borrowed phrases make
//      sense, so the chain finds new sentences instead of gluing the first
//      half of a line about rain to the second half of one about bread.
//      Every three words in a row come from something real, and a line
//      that trails off, repeats itself or runs on is thrown back.
//   3. Talk (here). What they talk about is weighted by what's on their
//      mind: the weather when it's foul, food when they're hungry, prices
//      when something's short, their family, the person next door, the
//      scholars' latest. Now and then one thought leads to another ("Mind
//      you, ..."). Then their manner: a rough speaker drops letters, a
//      child exclaims, a terse one says half of it; and their people's
//      dialect.
import { RNG, hash4 } from '../util/rng.js';
import { voiceOf } from './voice.js';
import { BASE, CULTURE, REGISTER, FLAVOR, JOBS, LINKS, TOPIC_NEEDS } from './talk/corpus.js';
import { Chain, walk, tokens, norm } from './talk/chain.js';
import { expand, fill } from './talk/grammar.js';

export { expand, fill };
export const STYLES = { base: BASE, culture: CULTURE, register: REGISTER, flavor: FLAVOR, jobs: JOBS };
const QUIRKS = new Set(Object.keys(FLAVOR));

// ------------------------------------------------------------ the chains
// How many ways each frame is said, to learn from.
const WAYS = 6;

// Frames learned into a chain, each said a handful of ways (the same
// handful every time: the ways are seeded by the frame).
function learn(chain, frames) {
  for (const [f, w] of frames) {
    const rng = new RNG(hash4(f.length, f.charCodeAt(0) || 0, f.charCodeAt(f.length >> 1) || 0, 0x7e11));
    const n = /[([]/.test(f) ? WAYS : 1;
    for (let i = 0; i < n; i++) chain.train(expand(f, rng), w);
  }
  return chain;
}

// Everyone's talk on a topic: learned once, and shared by every speaker.
const shared = new Map();
function baseChain(topic) {
  let c = shared.get(topic);
  if (!c) shared.set(topic, (c = learn(new Chain(), (BASE[topic] || []).map((f) => [f, 1]))));
  return c;
}

// A kind of speaker's own frames on a topic, and how much each counts.
function ownFrames(topic, c) {
  const out = [];
  const add = (list, w) => {
    for (const f of list || []) out.push([f, w]);
  };
  add(CULTURE[c.culture] && CULTURE[c.culture][topic], 2);
  add(REGISTER[c.register] && REGISTER[c.register][topic], 2);
  for (const f of c.flavors) add(FLAVOR[f] && FLAVOR[f][topic], 2);
  if (topic.split(':')[0] === 'work' && c.job && JOBS[c.job]) add(JOBS[c.job], 3);
  return out;
}

// A topic's talk for one kind of speaker: everyone's chain with their own
// on top, and every line the two learned from (to tell a new line by).
function topicChain(c, topic) {
  let t = c.topics.get(topic);
  if (t) return t;
  const base = baseChain(topic);
  const frames = ownFrames(topic, c);
  if (frames.length) {
    const own = learn(new Chain(), frames);
    const corpus = [...base.corpus, ...own.corpus];
    t = { layers: [base, own], corpus, seen: new Set(corpus) };
  } else t = { layers: [base], corpus: base.corpus, seen: base.seen };
  c.topics.set(topic, t);
  return t;
}

const cache = new Map();
// A kind of speaker: their people, their way of talking, their quirks and
// their trade (their chains are made per topic, as they're needed).
export function chainFor(culture, register, flavors = [], job = null) {
  const fl = [...new Set(flavors.filter((f) => QUIRKS.has(f)))].sort();
  const key = `${culture}|${register}|${fl.join(',')}|${job || ''}`;
  let c = cache.get(key);
  if (c) return c;
  c = { culture, register, flavors: fl, job, topics: new Map(), lexicon: (CULTURE[culture] && CULTURE[culture].lexicon) || [] };
  if (cache.size > 300) cache.clear();
  cache.set(key, c);
  return c;
}

// ------------------------------------------------------------ a line
// Words a line can't end on.
const DANGLING = new Set(['a', 'an', 'the', 'and', 'or', 'but', 'of', 'to', 'in', 'on', 'at', 'for', 'with', 'my', 'your', 'our', 'their', 'is', 'was', 'are', 'i', 'it\'s', 'that', 'than', 'so', 'if', 'as', 'from', 'by', 'me', 'we', 'be', 'into']);

// Is it a line worth saying? (Not trailing off, not saying a word twice
// over, not an unclosed question, nor nonsense length.)
function wellFormed(words, min, max) {
  if (words.length < min || words.length > max) return false;
  const last = norm(words[words.length - 1]).replace(/[.!?]$/, '');
  if (DANGLING.has(last)) return false;
  const seen = new Set();
  for (let i = 0; i + 1 < words.length; i++) {
    const bg = `${norm(words[i])} ${norm(words[i + 1])}`;
    if (seen.has(bg)) return false;
    seen.add(bg);
  }
  for (let i = 1; i < words.length; i++) if (norm(words[i]) === norm(words[i - 1]) && !/^(very|really|ha|no)$/.test(norm(words[i]))) return false;
  return true;
}

// What anyone might talk about on any day; and the smaller things, less
// often.
const COMMON = ['work', 'food', 'family', 'town', 'market', 'faith', 'feast', 'travel', 'past', 'realm', 'nature', 'musing'];
const EVERYDAY = ['health', 'animals', 'stories', 'chores'];

// The topics this speaker has something to say about.
function topicsOf(c) {
  const out = new Set([...COMMON, ...EVERYDAY]);
  for (const src of [CULTURE[c.culture], REGISTER[c.register], ...c.flavors.map((f) => FLAVOR[f])]) for (const k of Object.keys(src || {})) if (k !== 'lexicon' && !k.includes(':') && !TOPIC_NEEDS[k]) out.add(k);
  return [...out];
}

// One line on a topic (any topic, if none's given): a new walk along the
// chains where one comes out well, or one of the lines they learned from.
export function babble(c, rng, { min = 4, max = 22, tries = 14, topic = null, novel = 0.75 } = {}) {
  const tp = topic || rng.pick(topicsOf(c));
  const t = topicChain(c, tp);
  if (!t.corpus.length) return 'Hm.';
  const short = t.corpus.some((l) => tokens(l).length < min);
  const lo = short ? 1 : min;
  // (Mostly something new; now and then just one of the old lines.)
  if (rng.next() < novel) {
    for (let i = 0; i < tries; i++) {
      const words = walk(t.layers, rng, { max });
      if (!wellFormed(words, lo, max)) continue;
      let s = words.join(' ');
      if (!/[.!?]$/.test(s)) s += '.';
      if (!t.seen.has(s) || i === tries - 1) return s;
    }
  }
  return rng.pick(t.corpus);
}

// ------------------------------------------------------------ talk
// How one thought leads to the next, in each manner.
const JOIN = {
  formal: ['Then again, ', 'That said, ', 'Moreover, ', 'Mind you, '],
  plain: ['Mind you, ', 'Still, ', 'Anyway, ', 'Oh, and ', 'Then again, '],
  rough: ['Mind, ', 'Anyhow, ', 'And ', 'Still, '],
  chirpy: ['And ', 'Oh! And ', 'Also, '],
  terse: [],
  gruff: ['And ', 'Not that anyone listens, but ', 'Still, '],
};
// After a join the next thought goes on in lower case, unless it starts
// with "I" or a name (anything filled in that's written with a capital).
function joined(s, ctx) {
  const first = s.split(' ')[0].replace(/[,.!?;:]+$/, '');
  if (!/^[A-Z]/.test(first) || /^I($|')/.test(first)) return s;
  for (const v of Object.values(ctx)) if (typeof v === 'string' && v.split(/\s+/).includes(first)) return s;
  return s.charAt(0).toLowerCase() + s.slice(1);
}

// Their manner, beyond what voice.js already does to a line.
function manner(s, reg, rng) {
  if (reg === 'rough') {
    if (rng.next() < 0.6) s = s.replace(/\bmy\b/g, 'me').replace(/\bMy\b/g, 'Me');
    s = s.replace(/\b(\w+)ing\b(?=[ ,.!?])/g, (m, w) => (w.length > 3 && rng.next() < 0.5 ? `${w}in'` : m));
    if (rng.next() < 0.15) s = s.replace(/\.$/, ', I tell you.');
  } else if (reg === 'chirpy') {
    if (rng.next() < 0.6) s = s.replace(/\.$/, '!');
    if (rng.next() < 0.2) s = `Guess what? ${s}`;
  } else if (reg === 'terse') {
    // Half of it, and the half that matters.
    let first = s.split(/,\s|;\s| and | but /)[0].replace(/^(I think|I heard|They say|Well|Oh)\s*/i, '');
    if (tokens(first).length < 4) first = s;
    const w = tokens(first).slice(0, 8);
    while (w.length > 1 && DANGLING.has(norm(w[w.length - 1]).replace(/[.!?]$/, ''))) w.pop();
    s = w.join(' ').replace(/[,;:]$/, '');
    s = s.charAt(0).toUpperCase() + s.slice(1);
    if (!/[.!?]$/.test(s)) s += '.';
  } else if (reg === 'gruff') {
    if (rng.next() < 0.18) s = `${s} Hmph.`;
  } else if (reg === 'formal') {
    if (rng.next() < 0.12) s = `I dare say ${s.charAt(0).toLowerCase()}${s.slice(1)}`;
  }
  return s;
}

const OUTDOORS = new Set(['farmer', 'fisher', 'trapper', 'lumberjack', 'miner', 'builder', 'guard', 'miller', 'pearldiver', 'handler']);

// What's on their mind: each topic weighted by who they are and what's
// going on around them.
function topicWeights(rec, ctx, c) {
  const w = new Map();
  const add = (k, n) => w.set(k, (w.get(k) || 0) + n);
  for (const k of topicsOf(c)) add(k, EVERYDAY.includes(k) ? 0.6 : 1);
  const wk = ctx.wkind || 'fine';
  add(`weather:${wk}`, wk === 'fine' ? 1.2 : 3);
  // (Those who work out in it have more to say when it's foul.)
  if (wk !== 'fine' && OUTDOORS.has(rec.job)) add(`weather:${wk}`, 2);
  if (ctx.time) add(`time:${ctx.time}`, 0.6);
  add('work', rec.job && rec.job !== 'none' ? 1.5 : 0.3);
  if (ctx.hungry) add('hungry', 4);
  if (ctx.famine) add('famine', 3);
  if (ctx.fortune === 'thriving') add('thriving', 1.5);
  if (ctx.fortune === 'struggling') add('struggling', 2);
  if (ctx.war) add('war', 2);
  if (ctx.scarce) add('scarce', 1.4);
  if (ctx.plenty) add('plenty', 1);
  if (ctx.partner) add('partner', 1.2);
  if (ctx.child) add('child', 1.2);
  if (!ctx.partner && rec.age === 'adult') add('single', 0.5);
  if (ctx.neighbour) add('gossip', c.flavors.includes('gossipy') || c.flavors.includes('nosy') ? 3 : 0.8);
  if (ctx.friend) add('friend', 0.8);
  // What's new in town: the scholars' work, the ship, the portal, the
  // prisoners out at the quarry.
  add('study', rec.job === 'researcher' || rec.job === 'scholar' ? 2.5 : 0.6);
  add('learned', 1.6);
  add('ships', rec.job === 'merchant' ? 2.5 : 1.1);
  add('portal', 1.1);
  add('prisoners', rec.job === 'guard' ? 2 : 0.8);
  if (c.flavors.includes('pious')) add('faith', 2);
  if (c.flavors.length) for (const f of c.flavors) for (const k of Object.keys(FLAVOR[f] || {})) add(k, 1);
  if (rec.age === 'child') {
    for (const k of ['realm', 'market', 'work', 'past', 'single', 'partner', 'struggling', 'scarce', 'plenty', 'gossip', 'war', 'thriving', 'study', 'prisoners', 'health', 'chores']) w.delete(k);
    add('nature', 2);
    add('musing', 1.5);
    add('animals', 1.5);
  }
  // (Only what there's something to say about.)
  for (const [k] of [...w]) {
    const need = TOPIC_NEEDS[k.split(':')[0]];
    if (need && !ctx[need]) w.delete(k);
  }
  return [...w];
}

// Something to say, in this person's own way of talking (`ctx` says where:
// see dialogue.talkContext).
export function smallTalk(rec, rng, ctx = {}) {
  const v = voiceOf(rec);
  const culture = ctx.culture || 'vale';
  const traits = rec.traits || [];
  const flavors = traits.filter((t) => QUIRKS.has(t));
  if ((rec.personality?.piety ?? 0) > 0.7 || rec.job === 'priest') flavors.push('pious');
  const c = chainFor(culture, v.reg, flavors, rec.age === 'child' ? null : rec.job);
  // Who's who in their life.
  const L = ctx.L;
  const nameOf = (i) => (L && i !== null && i !== undefined && L.npcs[i] && L.npcs[i].name ? L.npcs[i].name.first : null);
  const kid = (rec.children || []).map(nameOf).find(Boolean) || null;
  const next = L ? L.npcs.find((q) => q !== rec && q.home !== null && q.home !== undefined && q.home !== rec.home && Math.abs((q.home || 0) - (rec.home || 0)) <= 2 && q.age === 'adult' && q.alive !== false && q.name) : null;
  const pctx = {
    ...ctx,
    partner: nameOf(rec.partner),
    child: kid,
    friend: (rec.friends || []).map((f) => nameOf(typeof f === 'object' ? f.idx : f)).find(Boolean) || null,
    neighbour: next ? next.name.first : null,
    hungry: (rec.hungry || 0) >= 1 || ctx.hungry,
  };
  const pick = (list) => {
    let total = 0;
    for (const [, n] of list) total += n;
    let r = rng.next() * total;
    for (const [k, n] of list) {
      r -= n;
      if (r <= 0) return k;
    }
    return list[list.length - 1][0];
  };
  const weights = topicWeights(rec, pctx, c);
  const terse = v.reg === 'terse';
  const opts = { min: terse ? 1 : 4, max: terse ? 9 : 22 };
  const topic = pick(weights);
  let s = fill(babble(c, rng, { ...opts, topic }), pctx);
  // One thing leads to another, now and then.
  const link = LINKS[topic.split(':')[0]];
  if (!terse && link && rng.next() < (v.reg === 'chirpy' ? 0.35 : 0.3) && s.length < 70) {
    const ok = new Set(weights.map(([k]) => k.split(':')[0]));
    const nexts = link.filter((k) => ok.has(k));
    if (nexts.length) {
      const k2 = rng.pick(nexts);
      const full = weights.find(([k]) => k.split(':')[0] === k2)[0];
      const s2 = joined(fill(babble(c, rng, { ...opts, topic: full, max: 16 }), pctx), pctx);
      const j = rng.pick(JOIN[v.reg] || JOIN.plain);
      if (s2 !== s && (s + s2).length < 150) s = `${s} ${j}${s2}`;
    }
  }
  s = manner(s, v.reg, rng);
  for (const [a, b] of c.lexicon) s = s.replace(a, b);
  return s;
}

// A seeded generator for a line (the same moment gives the same line).
export function talkRng(rec, salt = 0) {
  return new RNG(hash4(rec.idx || 0, salt, 0x6a7c));
}
