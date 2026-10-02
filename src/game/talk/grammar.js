// The phrase grammar the talk is written in (see corpus.js): "(a|b|c)"
// says one of them, "[a]" says it or not; and the slots ("{town}",
// "{dish}"...) filled in from where it's said.
import { DEFAULTS } from './corpus.js';

// One way of saying a frame.
export function expand(t, rng) {
  let i = 0;
  const seq = (stop) => {
    let out = '';
    while (i < t.length && !stop.includes(t[i])) {
      const ch = t[i];
      if (ch === '(') {
        i++;
        const alts = [seq('|)')];
        while (t[i] === '|') {
          i++;
          alts.push(seq('|)'));
        }
        i++;
        out += alts[Math.floor(rng.next() * alts.length)];
      } else if (ch === '[') {
        i++;
        const inner = seq(']');
        i++;
        if (rng.next() < 0.5) out += inner;
      } else {
        out += ch;
        i++;
      }
    }
    return out;
  };
  return seq('').replace(/\s+/g, ' ').replace(/\s([,.!?;])/g, '$1').trim();
}

// Is a frame well made: every bracket closed, nothing stray? (For checking
// the corpus: see the tests.)
export function wellMade(t) {
  const stack = [];
  for (const ch of t) {
    if (ch === '(' || ch === '[' || ch === '{') stack.push(ch);
    else if (ch === ')' || ch === ']' || ch === '}') {
      const open = stack.pop();
      if ((ch === ')' && open !== '(') || (ch === ']' && open !== '[') || (ch === '}' && open !== '{')) return false;
    } else if (ch === '|' && !stack.includes('(')) return false;
  }
  return !stack.length;
}

// Fill in the blanks from where it's said, and tidy up.
export function fill(text, ctx = {}) {
  let s = text.replace(/\{(\w+)\}/g, (m, k) => (ctx[k] !== undefined && ctx[k] !== null && ctx[k] !== '' ? ctx[k] : DEFAULTS[k] || m));
  s = s.replace(/\b([Tt])he the\b/g, '$1he').replace(/\b([Aa]) ([aeiouAEIOU]\w)/g, '$1n $2').replace(/\s+/g, ' ').trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}
