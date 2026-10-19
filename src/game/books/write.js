// (Round 126) Writing: from what a chapter has to say to the sentences that
// say it, in two layers of chain.
//
//   The moves (a chain of what comes next in a paragraph). Every kind of
//   paragraph has a few ways good writers have gone about it, written out
//   as runs of moves (set the scene, tell what happened, what it was like,
//   what came of it, what the writer makes of it...); a chain learns from
//   them what tends to follow what, and each paragraph is a walk along it:
//   in an order that makes sense, never twice the same.
//
//   The words (see ngram.js). Each move has its own library of sentences
//   (books/corpus), said a handful of ways each, and its own chain learned
//   from them. A sentence is walked out of the move's chain, its blanks
//   filled from the chapter's facts: the town's name, the year, the dish.
//   A name said once is, the next time, "the town" or "the city" (so a
//   paragraph reads as one thing about one place, not a list of names).
import { RNG } from '../../util/rng.js';
import { expand } from '../talk/grammar.js';
import { Ngram, compose, slotsIn, tokens } from './ngram.js';
import { POOLS, FLOWS } from './corpus/index.js';
import { VOICES, relOf, joinedAlready, lowerStart, fitsRel, asideFits, asideText } from './voice.js';

// How many ways each written sentence is said, to learn from.
const WAYS = 5;

// ------------------------------------------------------------ the chains
const chains = new Map();
// A move's chain (learned the first time it's wanted, and kept): its own
// sentences, and (for a writer with a voice of their own for it) theirs,
// counted twice.
export function chainOf(pool, voice = null) {
  const key = voice && POOLS[`${pool}@${voice}`] ? `${pool}@${voice}` : pool;
  let c = chains.get(key);
  if (c) return c;
  const frames = [...(POOLS[pool] || []).map((f) => [f, 1]), ...(key !== pool ? POOLS[key].map((f) => [f, 2]) : [])];
  if (!frames.length) return null;
  c = new Ngram();
  frames.forEach(([f, w], i) => {
    const rng = new RNG(((f.length * 7919) ^ (f.charCodeAt(0) * 131) ^ (i * 977)) >>> 0 || 1);
    const n = /[([]/.test(f) ? WAYS : 1;
    for (let k = 0; k < n; k++) c.train(expand(f, rng), w, i);
  });
  chains.set(key, c);
  return c;
}

// ------------------------------------------------------------ the moves
const flows = new Map();
// The chain of moves for a kind of paragraph: what follows what, from the
// written runs of moves.
function flowOf(kind) {
  let f = flows.get(kind);
  if (f) return f;
  const runs = FLOWS[kind];
  if (!runs) return null;
  f = new Map();
  const add = (a, b) => {
    let m = f.get(a);
    if (!m) f.set(a, (m = new Map()));
    m.set(b, (m.get(b) || 0) + 1);
  };
  for (const run of runs) {
    let prev = '^';
    for (const mv of run) {
      add(prev, mv);
      prev = mv;
    }
    add(prev, '$');
  }
  flows.set(kind, f);
  return f;
}

// A walk along a paragraph's moves: what it'll do, in order. `can(move)`:
// is there anything to say for it here?
export function plan(kind, rng, can = () => true, { min = 2, max = 7 } = {}) {
  const f = flowOf(kind);
  if (!f) return [];
  for (let t = 0; t < 12; t++) {
    const out = [];
    let at = '^';
    const used = new Map();
    for (let i = 0; i < max + 1; i++) {
      const m = f.get(at);
      if (!m) break;
      const opts = [...m].filter(([mv]) => mv === '$' || (can(mv) && (used.get(mv) || 0) < (mv.endsWith('*') ? 3 : 1)));
      if (!opts.length) break;
      // (Not done before it's said enough; done when it's said plenty.)
      let total = 0;
      for (const [mv, n] of opts) total += mv === '$' ? (out.length < min ? 0 : n) : n;
      if (!total) break;
      let r = rng.next() * total;
      let pick = '$';
      for (const [mv, n] of opts) {
        r -= mv === '$' ? (out.length < min ? 0 : n) : n;
        if (r <= 0) {
          pick = mv;
          break;
        }
      }
      if (pick === '$') break;
      out.push(pick);
      used.set(pick, (used.get(pick) || 0) + 1);
      at = pick;
    }
    if (out.length >= min) return out;
  }
  return [];
}

// ------------------------------------------------------------ the words
// The facts a sentence may draw on: { key: 'Redford' } or { key: { name:
// 'Redford', again: ['the town'] } } (said by name the first time in a
// paragraph, and after that now and then the other way).
const nameOf = (v) => (v && typeof v === 'object' ? v.name : v);
const has = (facts, k) => {
  const v = nameOf(facts[k]);
  return v !== undefined && v !== null && v !== '';
};

// The sentence, its blanks filled.
export function fill(words, facts, rng, said = new Set()) {
  const out = words.map((w) => w.replace(/\{(\w+)\}/g, (m, k) => {
    const v = facts[k];
    const name = nameOf(v);
    if (name === undefined || name === null) return m;
    let s = String(name);
    // (Said again another way: not where it's "Redford's".)
    const plain = new RegExp(`^\\{${k}\\}[,.;:!?]*$`).test(w);
    if (plain && v && typeof v === 'object' && v.again && v.again.length && said.has(k) && rng.next() < 0.55) s = rng.pick(v.again);
    said.add(k);
    return s;
  }));
  return tidy(out.join(' '));
}

// Tidied: "a" before a vowel made "an"; no doubled "the"; the first letter
// a capital; quotes and stops in their places.
const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'];
export function tidy(s) {
  s = s.replace(/\s+/g, ' ').trim();
  // (Small numbers in words: "eleven families", not "11 families".)
  s = s.replace(/(^|[\s(])(\d{1,2})(?=[\s,.;:)])/g, (m, a, d) => (+d <= 20 ? `${a}${WORDS[+d]}` : m));
  s = s.replace(/\b([Tt])he the\b/g, '$1he').replace(/\b([Tt])he The\b/g, '$1he');
  s = s.replace(/\b([Aa]) (?=[aeiouAEIOU][a-z])/g, '$1n ').replace(/\b([Aa])n (?=(?:one|once|uni|use|usu|eu)\b)/g, '$1 ');
  s = s.replace(/\s+([,.;:!?])/g, '$1').replace(/,\s*,/g, ',').replace(/\.\./g, '.');
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const needs = new Map();

// (Round 127) The words the corpus itself starts sentences with ("Where",
// "More", "Walking"): plain words, lower-cased after a joining word. Any
// other capital is a name, and keeps it.
let STARTERS = null;
function starters() {
  if (STARTERS) return STARTERS;
  STARTERS = new Set();
  for (const [k, list] of Object.entries(POOLS)) {
    if (k.startsWith('fiction.names')) continue;
    for (const f of list) {
      const m = /^\(?([A-Z][a-z]+)\b/.exec(f);
      if (m && !/^(I|Saint)$/.test(m[1])) STARTERS.add(m[1]);
      for (const alt of (/^\(([^)]*)\)/.exec(f) || [null, ''])[1].split('|')) {
        const a = /^([A-Z][a-z]+)\b/.exec(alt);
        if (a && a[1] !== 'I') STARTERS.add(a[1]);
      }
    }
  }
  return STARTERS;
}

export class Writer {
  constructor(rng, voice = 'chronicler') {
    this.rng = rng;
    this.voiceId = VOICES[voice] ? voice : 'chronicler';
    this.voice = VOICES[this.voiceId];
    this.linked = new Map();
    // Every turn of phrase the book has used (none twice).
    this.ban = new Set();
    // Every sentence written (none twice); every written sentence of the
    // library drawn on (none leant on twice).
    this.written = new Set();
    this.frames = new Set();
  }

  has(pool) {
    return !!POOLS[pool];
  }

  // The words a writer reaches for to open a paragraph that follows on
  // from the last ("Thereafter,", "Then"): see books.js.
  opener(rel, facts = {}) {
    const w = this.link(rel);
    return w ? fill([w], facts, this.rng) : null;
  }

  // Is there anything a move can say with these facts (a sentence of it
  // whose every blank is filled)?
  can(pool, facts) {
    const frames = [...(POOLS[pool] || []), ...(POOLS[`${pool}@${this.voiceId}`] || [])];
    if (!frames.length) return false;
    const nk = `${pool}@${this.voiceId}`;
    let need = needs.get(nk);
    if (!need) needs.set(nk, (need = frames.map((f) => slotsIn(f))));
    return need.some((ks) => ks.every((k) => has(facts, k)));
  }

  // A joining word for a way one sentence follows another, in this voice
  // (none, now and then; and none used more than twice in a book).
  link(rel) {
    const L = (this.voice.links || {})[rel] || [];
    const ok = L.filter((w) => (this.linked.get(w) || 0) < 2);
    if (!ok.length) return null;
    const w = this.rng.pick(ok);
    this.linked.set(w, (this.linked.get(w) || 0) + 1);
    return w;
  }

  // A sentence joined to the one before it.
  joinTo(s, rel, facts) {
    if (!rel || joinedAlready(s) || !fitsRel(s, rel)) return s;
    // (The writer's own word on their sources isn't a turn in the story.)
    if (rel !== 'add' && rel !== 'contrast' && /\b(I|my|me)\b/.test(s)) return s;
    const w = this.link(rel);
    if (!w) return s;
    const lead = fill([w], facts, this.rng);
    // (A sentence opening on a plain-word blank, "Cows will not...": its
    // own small letter back.)
    const plainFact = Object.values(facts).some((v) => typeof v === 'string' && /^[a-z]/.test(v) && s.startsWith(v.charAt(0).toUpperCase() + v.slice(1)));
    return `${lead} ${plainFact ? s.charAt(0).toLowerCase() + s.slice(1) : lowerStart(s, starters())}`;
  }

  // An aside let fall at the end of a sentence (", so they say.").
  asideIn(s, facts) {
    const A = (this.voice.asides || []).filter((a) => asideFits(a, s) && (!/\{(\w+)\}/.test(a) || /\{(\w+)\}/.exec(a).slice(1).every((k) => has(facts, k)))).map(asideText);
    if (!A.length || /["?!]/.test(s) || s.split(' ').length < 9 || !/\.$/.test(s) || /;/.test(s)) return s;
    const a = fill([this.rng.pick(A)], facts, this.rng).replace(/^,?\s*/, '').replace(/,\s*$/, '');
    if (s.toLowerCase().includes(a.toLowerCase())) return s;
    return `${s.slice(0, -1)}, ${a.charAt(0).toLowerCase()}${a.slice(1)}.`;
  }

  // One sentence for a move (null if there's nothing it can say with these
  // facts). `want`: blanks it must name, one of them at least.
  say(pool, facts, { want = null, said = new Set(), min = 5, max = 36, aim = this.voice.aim || 18 } = {}) {
    const c = chainOf(pool, this.voiceId);
    if (!c || !c.size) return null;
    const allow = (w) => slotsIn(w).every((k) => has(facts, k));
    const wanted = (want || []).filter((k) => has(facts, k));
    for (let t = 0; t < 3; t++) {
      const used = (seg) => [...seg].every((id) => this.frames.has(`${pool}:${id}`));
      const best = compose(c, this.rng, { min, max, aim, allow, want: wanted, ban: this.ban, tries: 12, reject: (w) => w.segs.some(used) });
      if (!best) continue;
      for (const seg of best.segs) this.frames.add(`${pool}:${[...seg][0]}`);
      const s = fill(best.words, facts, this.rng, said);
      if (this.written.has(s)) continue;
      this.written.add(s);
      return s;
    }
    // (Nothing new: one of the move's own sentences, as written, if one fits
    // and hasn't been used.)
    // (Every one of them used already: one used before, then, said again
    // with this place's facts, rather than nothing.)
    const all = c.corpus.map((l, i) => [l, c.srcOf[i]]).filter(([l]) => tokens(l).every(allow) && (!wanted.length || wanted.some((k) => l.includes(`{${k}}`))));
    const unused = all.filter(([, id]) => !this.frames.has(`${pool}:${id}`));
    const fits = unused.length ? this.rng.shuffle(unused) : this.rng.shuffle(all);
    for (const [l, id] of fits) {
      const s = fill(tokens(l), facts, this.rng, said);
      if (!this.written.has(s)) {
        this.written.add(s);
        this.frames.add(`${pool}:${id}`);
        return s;
      }
    }
    return null;
  }

  // A paragraph of a kind (see corpus FLOWS): its moves walked, each said.
  // `moves`: { move: { pool, want, facts } } overrides; a move's pool is
  // otherwise `${kind}.${move}`. `fixed`: { move: sentence } said as given.
  para(kind, facts, { min = 2, max = 6, want = {}, fixed = {}, pools = {}, asides = true } = {}) {
    const said = new Set();
    const poolOf = (mv) => pools[mv.replace(/\*$/, '')] || `${kind}.${mv.replace(/\*$/, '')}`;
    const can = (mv) => !!fixed[mv.replace(/\*$/, '')] || this.can(poolOf(mv), facts);
    const moves = plan(kind, this.rng, can, { min, max });
    const out = [];
    let joined = false;
    let asided = false;
    for (const mv of moves) {
      const m = mv.replace(/\*$/, '');
      if (fixed[m]) {
        out.push(fixed[m]);
        joined = false;
        continue;
      }
      let s = this.say(poolOf(mv), facts, { want: want[m] || null, said });
      if (!s) continue;
      // (Joined to the one before, now and then, in the writer's way: never
      // two running, never the first.)
      if (out.length && !joined && this.rng.next() < this.voice.link) {
        const j = this.joinTo(s, relOf(m) || (this.rng.next() < 0.12 ? 'add' : null), facts);
        joined = j !== s;
        s = j;
      } else joined = false;
      if (asides && !asided && this.rng.next() < (this.voice.aside || 0)) {
        const a = this.asideIn(s, facts);
        asided = a !== s;
        s = a;
      }
      out.push(s);
    }
    return out.join(' ');
  }
}
