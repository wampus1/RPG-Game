// Word chains: what follows what, learned from lines of talk (see
// corpus.js), and new lines walked out of them (see markov.js).
//
// A chain knows, for every run of three words, what came next and how
// often. A walk starts at the beginning of a line and picks each next word
// by those counts until the line ends, so every three words in a row come
// from something real. Chains come in layers: everyone's talk on a topic is
// learned once and shared, and each kind of speaker adds a small layer of
// their own on top (their people's sayings, their way of talking, their
// trade). A walk draws on all the layers at once, so it can turn from
// everyone's words into their own wherever the two share three words.

export const START = '^';
export const END = '$';
export const ORDER = 3;

export const tokens = (line) => line.split(/\s+/).filter(Boolean);
// (Case and a trailing comma don't make a different word.)
export const norm = (w) => (w === START ? w : w.toLowerCase().replace(/,$/, ''));
const keyOf = (words) => words.map(norm).join(' ');

export class Chain {
  constructor() {
    // A run of words -> what came next ({ words, counts }).
    this.next = new Map();
    // Every line learned, once each.
    this.corpus = [];
    this.seen = new Set();
  }

  get size() {
    return this.corpus.length;
  }

  // Learn a line, counting `w` times.
  train(line, w = 1) {
    if (this.seen.has(line)) return;
    this.seen.add(line);
    this.corpus.push(line);
    const words = [...new Array(ORDER).fill(START), ...tokens(line), END];
    for (let i = ORDER; i < words.length; i++) {
      const key = keyOf(words.slice(i - ORDER, i));
      let m = this.next.get(key);
      if (!m) this.next.set(key, (m = { words: [], counts: [] }));
      const j = m.words.indexOf(words[i]);
      if (j < 0) {
        m.words.push(words[i]);
        m.counts.push(w);
      } else m.counts[j] += w;
    }
  }
}

// A walk along the chains: the words of a new line (without the end mark).
export function walk(layers, rng, { max = 26 } = {}) {
  const out = [];
  const ctx = new Array(ORDER).fill(START);
  for (let n = 0; n < max + 4; n++) {
    // What could come next, across the layers.
    const key = keyOf(ctx);
    const opts = new Map();
    let total = 0;
    for (const c of layers) {
      const m = c.next.get(key);
      if (!m) continue;
      m.words.forEach((wd, i) => {
        opts.set(wd, (opts.get(wd) || 0) + m.counts[i]);
        total += m.counts[i];
      });
    }
    if (!total) break;
    let r = rng.next() * total;
    let w = END;
    for (const [wd, v] of opts) {
      r -= v;
      if (r <= 0) {
        w = wd;
        break;
      }
    }
    if (w === END) break;
    out.push(w);
    ctx.shift();
    ctx.push(w);
  }
  return out;
}
