// (Round 126) The word chains books are written with: what follows what,
// learned from a library of good sentences (see books/corpus), and new
// sentences walked out of them.
//
// Each chain knows, for every run of up to four words, what came next and
// how often. A walk looks back as far as the chain has seen that run
// before (four words if it can, then three, then two), and leans on the
// longest: the further back it matches, the surer it is of the next word,
// and the more of a real sentence it's following. Where the long run gives
// out, a shorter one carries it across into another sentence that shares
// those words, and that join is where a new sentence comes from.
//
// A walk isn't free to say anything. The blanks a sentence may name ("{town}",
// "{founder}", "{dish}") are words to the chain like any other, and a
// blank the book has nothing to put in is never walked into. A sentence
// may be asked to name something in particular (the dish the chapter is
// about); one that doesn't is thrown back. And the book remembers what it's
// already said, so no turn of phrase comes round twice.
//
// Then the best of several tries is kept: the one that holds to its
// sources longest between joins, crosses from one to another once or twice
// (and not more, nor never), and says what it was asked to.
export const START = '^';
export const END = '$';
export const ORDER = 4;

// (A word's place: its line times this, plus where it is in the line.)
const POS = 512;

export const tokens = (line) => String(line).split(/\s+/).filter(Boolean);
// (Case doesn't make a different word; a comma after it does: "began," is
// followed by what follows a pause.)
export const norm = (w) => (w === START ? w : w.toLowerCase());
const keyOf = (words) => words.map(norm).join(' ');
// The blanks a word names ("{town}'s," names "town").
export const slotsIn = (w) => {
  const out = [];
  w.replace(/\{(\w+)\}/g, (m, k) => out.push(k));
  return out;
};

// Little words: a run of them isn't a "turn of phrase" worth remembering.
const LITTLE = new Set(['the', 'a', 'an', 'of', 'and', 'in', 'to', 'was', 'were', 'is', 'it', 'its', 'that', 'on', 'at', 'for', 'with', 'by', 'as', 'from', 'but', 'they', 'their', 'there', 'this', 'had', 'has', 'be', 'or', 'not', 'are', 'which', 'who', 'what', 'into', 'so', 'his', 'her']);

export class Ngram {
  constructor(order = ORDER) {
    this.order = order;
    // For each length of run (1..order): run -> { words, counts, from }.
    this.next = [];
    for (let k = 0; k <= order; k++) this.next.push(new Map());
    this.corpus = [];
    this.srcOf = [];
    this.seen = new Set();
  }

  get size() {
    return this.corpus.length;
  }

  // Learn a sentence (one of its sayings), counting `w` times; `src` says
  // which written sentence it was a saying of (for telling joins).
  train(line, w = 1, src = this.corpus.length) {
    if (this.seen.has(line)) return;
    this.seen.add(line);
    const at = this.corpus.length;
    this.corpus.push(line);
    this.srcOf.push(src);
    const words = [...new Array(this.order).fill(START), ...tokens(line), END];
    for (let i = this.order; i < words.length; i++) {
      // (Where it was: this line, this word of it.)
      const id = at * POS + (i - this.order);
      for (let k = 1; k <= this.order; k++) {
        const key = keyOf(words.slice(i - k, i));
        let m = this.next[k].get(key);
        if (!m) this.next[k].set(key, (m = { words: [], counts: [], from: [] }));
        const j = m.words.indexOf(words[i]);
        if (j < 0) {
          m.words.push(words[i]);
          m.counts.push(w);
          m.from.push([id]);
        } else {
          m.counts[j] += w;
          m.from[j].push(id);
        }
      }
    }
  }

  // The written sentence a word of a line came from.
  frameOf(id) {
    return this.srcOf[Math.floor(id / POS)];
  }
}

// What could come next after `ctx`, looking back as far as the chain knows
// (but never less than `least` words): [options, how far back it looked].
function options(model, ctx, least) {
  for (let k = Math.min(model.order, ctx.length); k >= least; k--) {
    const m = model.next[k].get(keyOf(ctx.slice(ctx.length - k)));
    if (m && m.words.length) return [m, k];
  }
  return [null, 0];
}

// A walk: the words of a new sentence (without the end mark), and how it
// went: `joins` (where it crossed from one written sentence into another),
// `low` (steps taken on less than three words' footing), `srcs`.
//
// `o.allow(word)`: may this word be said here (its blanks all filled)?
// `o.ban`: runs of three words already said in the book.
export function walk(model, rng, o = {}) {
  const max = o.max || 30;
  const allow = o.allow || (() => true);
  const out = [];
  const ctx = new Array(model.order).fill(START);
  // Where in the written lines the walk is (the places the last word came
  // from that it's still following).
  let cur = null;
  let frames = null;
  const segs = [];
  let segAt = 0;
  let joins = 0;
  let low = 0;
  // Of the places a next word came from, those that go on from where the
  // walk is: the next word of the same line, or (another saying of the
  // same sentence) about the same place in it.
  const follow = (ids) => {
    const keep = [];
    for (const id of ids) {
      for (const p of cur) {
        if (id === p + 1 || (model.frameOf(id) === model.frameOf(p) && Math.abs((id % POS) - ((p % POS) + 1)) <= 2 && Math.floor(id / POS) !== Math.floor(p / POS))) {
          keep.push(id);
          break;
        }
      }
    }
    return keep;
  };
  for (let n = 0; n < max + 4; n++) {
    // (At the start, a whole sentence's opening must be followed: the first
    // two words always on full footing; after that, never on less than
    // three words, so every join is at a run of three both sentences share.)
    const least = n < 2 ? Math.min(model.order, ctx.length) : 3;
    const [m, k] = options(model, ctx, least);
    if (!m) break;
    let total = 0;
    const ws = [];
    for (let i = 0; i < m.words.length; i++) {
      const wd = m.words[i];
      if (wd !== END && !allow(wd)) continue;
      let c = m.counts[i];
      // (Keep to the sentence being followed. Cross into another only where
      // a clause ends (after a comma, an "and", a "which"), and only once
      // the clause before has said something (five words at least): a
      // clause of one finished by a clause of another, never half a phrase
      // of each.)
      const go = cur ? follow(m.from[i]) : m.from[i];
      if (!go.length) {
        if (!JOINS.test(out[out.length - 1] || '') || out.length - segAt < 5) continue;
        c *= o.stray ?? 0.35;
      }
      // (A run of three already said in the book: not again.)
      if (o.ban && wd !== END && out.length >= 2) {
        const tri = `${bare(out[out.length - 2])} ${bare(out[out.length - 1])} ${bare(wd)}`;
        if (o.ban.has(tri)) continue;
      }
      if (c > 0) ws.push([i, c, go]);
      total += c > 0 ? c : 0;
    }
    if (!total) break;
    let r = rng.next() * total;
    let pick = ws[ws.length - 1];
    for (const q of ws) {
      r -= q[1];
      if (r <= 0) {
        pick = q;
        break;
      }
    }
    const w = m.words[pick[0]];
    const fr = (ids) => new Set(ids.map((id) => model.frameOf(id)));
    if (w === END) return { words: out, joins, low, segs: [...segs, frames], done: true };
    if (cur && !pick[2].length) {
      joins++;
      segs.push(frames);
      segAt = out.length;
      cur = m.from[pick[0]];
    } else cur = pick[2].length ? pick[2] : m.from[pick[0]];
    frames = fr(cur);
    if (k < 3) low++;
    out.push(w);
    ctx.shift();
    ctx.push(w);
  }
  return { words: out, joins, low, segs, done: false };
}

// Where one clause ends and another can begin.
const JOINS = /(^(and|but|while|which|who|where|when|that|so|for|though|until|till|as|or|then)$)|[,;:]$/i;

// Words a sentence can't end on.
const DANGLING = new Set(['a', 'an', 'the', 'and', 'or', 'but', 'of', 'to', 'in', 'on', 'at', 'for', 'with', 'my', 'your', 'our', 'their', 'its', 'is', 'was', 'are', 'were', 'that', 'than', 'so', 'if', 'as', 'from', 'by', 'we', 'be', 'into', 'which', 'who', 'whose', 'had', 'has', 'have', 'not', 'nor', 'where', 'when', 'until', 'till', 'after', 'before', 'over', 'under']);

// Is it a sentence worth writing? (Ending where a sentence can, not saying
// a pair of words twice over, nor the same word twice running.)
export function wellFormed(words, min, max) {
  if (words.length < min || words.length > max) return false;
  const last = norm(words[words.length - 1]).replace(/[.!?'"]+$/, '');
  if (DANGLING.has(last)) return false;
  if (!/[.!?]["']?$/.test(words[words.length - 1])) return false;
  const seen = new Set();
  for (let i = 0; i + 1 < words.length; i++) {
    const bg = `${bare(words[i])} ${bare(words[i + 1])}`;
    if (seen.has(bg)) return false;
    seen.add(bg);
    if (bare(words[i]) === bare(words[i + 1])) return false;
  }
  // (Brackets and quotes closed.)
  const s = words.join(' ');
  if ((s.match(/\(/g) || []).length !== (s.match(/\)/g) || []).length) return false;
  if ((s.match(/"/g) || []).length % 2) return false;
  return true;
}

const bare = (w) => norm(w).replace(/[,;:.!?"]+$/, '');

// The turns of phrase in a sentence (runs of three, not all little words),
// for the book to remember.
export function phrases(words) {
  const out = [];
  for (let i = 0; i + 2 < words.length; i++) {
    const a = bare(words[i]);
    const b = bare(words[i + 1]);
    const c = bare(words[i + 2]);
    if (LITTLE.has(a) && LITTLE.has(b) && LITTLE.has(c)) continue;
    if (/\{/.test(a + b + c)) continue;
    out.push(`${a} ${b} ${c}`);
  }
  return out;
}

// The best of several walks: a new sentence that says what it must.
//   o.min, o.max: how many words.
//   o.allow(word): see walk.
//   o.want: blanks it must name (any one of them, or `o.wantAll`: all).
//   o.ban: the book's turns of phrase so far (a Set; added to).
//   o.tries: how many walks to choose among.
//   o.novel: how much a sentence new to the chain counts over one of the
//            written ones (1: only new ones; 0: either).
export function compose(model, rng, o = {}) {
  const min = o.min || 5;
  const max = o.max || 34;
  const want = o.want || [];
  const tries = o.tries || 10;
  let best = null;
  let bestScore = -Infinity;
  for (let t = 0; t < tries; t++) {
    const w = walk(model, rng, { max, allow: o.allow, ban: o.ban, stray: o.stray });
    if (!w.done || !wellFormed(w.words, min, max)) continue;
    if (o.reject && o.reject(w)) continue;
    const named = new Set(w.words.flatMap(slotsIn));
    if (want.length && (o.wantAll ? !want.every((k) => named.has(k)) : !want.some((k) => named.has(k)))) continue;
    // (Nothing already said: no turn of phrase twice in a book.)
    const ph = phrases(w.words);
    if (o.ban && ph.some((p) => o.ban.has(p))) continue;
    const line = w.words.join(' ');
    const fresh = !model.seen.has(line);
    // The best: one or two joins (new, and still sound), little loose
    // footing, a sensible length; and what it was asked to name, more of
    // it the better.
    let score = 0;
    score += w.joins === 0 ? (fresh ? 0.6 : 0) : w.joins <= 2 ? 1.2 - (w.joins - 1) * 0.25 : 1 - w.joins * 0.6;
    score -= w.low * 0.45;
    score += fresh ? (o.novel ?? 0.8) : 0;
    score += [...named].filter((k) => want.includes(k)).length * 0.3;
    score -= Math.abs(w.words.length - (o.aim || 18)) * 0.02;
    score += rng.next() * 0.35;
    if (score > bestScore) {
      bestScore = score;
      best = { words: w.words, line, ph, joins: w.joins, fresh, segs: w.segs };
    }
  }
  if (best && o.ban) for (const p of best.ph) o.ban.add(p);
  return best;
}
