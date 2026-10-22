// (Round 135) How something's said, shown in the letters themselves.
//
// A line may carry marks for how its words come out (they're never shown):
//   {flags:words}  the words said so; flags, any of:
//     s  shaking (rage, a shout)      t  trembling (fear, cold)
//     w  a wave (glee, a song)        b  heavy (a shout, a stress)
//     r  red-hot   c  cold blue   g  gold   p  rose   d  dim (a whisper)
//   {@slow} or {@fast} at the start: the pace it's typed out at.
//   {.}  a pause (a breath, a catch in the voice).
// See parseFx; and emote (below) for lines that carry no marks of their
// own, given them from how the speaker feels.
//
// Each letter's effect is one small number (see FX_*), carried in a text
// grid beside its colour (ui/ascii.js: Grid.fx), sent to other players with
// it (net/uiwire.js), and drawn moving (ascii.drawGrid, Renderer.drawBubble)
// unless moving letters are turned off (see the settings: Text effects).
import { hash4 } from '../util/rng.js';

export const FX_SHAKE = 1;
export const FX_TREMBLE = 2;
export const FX_WAVE = 3;
const MOTION = 3;
// (Colour: bits 2-4.)
const COLOR = { r: 1, c: 2, g: 3, p: 4, d: 5 };
export const FX_COLORS = [null, '#ff7a60', '#9ab8e8', '#ffd870', '#ff9ac8', '#8a8090'];
export const FX_BOLD = 32;
const MOVE = { s: FX_SHAKE, t: FX_TREMBLE, w: FX_WAVE };

// Whether letters move (off: their colours only).
export const TEXT_FX = { motion: true };

const cache = new Map();
// A marked line, read: { text (as shown), fx (one number a letter, or
// null), pace, pauses (letter positions to linger before) }.
export function parseFx(src) {
  src = String(src ?? '');
  let got = cache.get(src);
  if (got) return got;
  if (src.indexOf('{') < 0) {
    got = { text: src, fx: null, pace: 1, pauses: null };
  } else {
    let pace = 1;
    let s = src;
    const m = /^\{@(slow|fast|crawl)\}\s?/.exec(s);
    if (m) {
      pace = m[1] === 'slow' ? 0.6 : m[1] === 'crawl' ? 0.4 : 1.6;
      s = s.slice(m[0].length);
    }
    let text = '';
    const fx = [];
    let pauses = null;
    let i = 0;
    let any = false;
    while (i < s.length) {
      const c = s[i];
      if (c === '{') {
        if (s[i + 1] === '.' && s[i + 2] === '}') {
          (pauses ||= new Set()).add(text.length);
          i += 3;
          continue;
        }
        const colon = s.indexOf(':', i);
        if (colon > i && /^[a-z]+$/.test(s.slice(i + 1, colon))) {
          // (The span runs to its own close: a pause inside it is kept.)
          let j = colon + 1;
          let inner = '';
          const at = [];
          while (j < s.length && s[j] !== '}') {
            if (s[j] === '{' && s[j + 1] === '.' && s[j + 2] === '}') {
              at.push(inner.length);
              j += 3;
              continue;
            }
            inner += s[j];
            j++;
          }
          if (j < s.length) {
            let f = 0;
            for (const ch of s.slice(i + 1, colon)) {
              if (MOVE[ch]) f = (f & ~MOTION) | MOVE[ch];
              else if (COLOR[ch]) f = (f & ~28) | (COLOR[ch] << 2);
              else if (ch === 'b') f |= FX_BOLD;
            }
            for (const q of at) (pauses ||= new Set()).add(text.length + q);
            for (const ch of inner) {
              text += ch;
              fx.push(f);
            }
            if (f) any = true;
            i = j + 1;
            continue;
          }
        }
      }
      text += c;
      fx.push(0);
      i++;
    }
    got = { text, fx: any ? Uint8Array.from(fx) : null, pace, pauses };
  }
  if (cache.size > 2000) cache.clear();
  cache.set(src, got);
  return got;
}

// The words alone (marks taken out).
export const plainOf = (s) => parseFx(s).text;

// Where a letter with effect `f` is drawn, `time` seconds in (x, y px).
export function fxOffset(f, i, time, seed = 0) {
  const m = f & MOTION;
  if (!m || !TEXT_FX.motion) return [0, 0];
  if (m === FX_SHAKE) {
    const k = Math.floor(time * 18);
    const h = hash4(i, k, seed);
    return [(h & 3) === 0 ? -1 : (h & 3) === 1 ? 1 : 0, ((h >> 2) & 3) === 0 ? -1 : ((h >> 2) & 3) === 1 ? 1 : 0];
  }
  if (m === FX_TREMBLE) {
    const k = Math.floor(time * 10);
    return [0, (hash4(i, k, seed + 7) & 7) === 0 ? 1 : 0];
  }
  return [0, Math.round(Math.sin(time * 6 + i * 0.7) * 1.4)];
}

// The colour a letter with effect `f` takes (its own if none).
export function fxColor(f, fg) {
  const c = (f >> 2) & 7;
  return c ? FX_COLORS[c] : fg;
}

export const fxMoves = (f) => (f & MOTION) !== 0;

// ------------------------------------------------------------ emote
// A line with no marks of its own, given them from how its speaker feels
// (`feel`: { kind, v } as emotion.dominant has it, or null), and whether
// they're the worse for drink. Never more than the feeling calls for: a
// little anger reddens a shout, a lot shakes it.
export function emote(line, feel, o = {}) {
  line = String(line ?? '');
  if (!line || line.indexOf('{') >= 0) return line;
  if (/^\(.*\)$/.test(line.trim())) return line;
  let out = o.drunk ? slur(line) : line;
  let pace = o.drunk ? '{@slow}' : '';
  const v = feel ? feel.v : 0;
  switch (feel ? feel.kind : null) {
    case 'anger':
      out = v >= 0.6 ? markShouts(out, 'sr', 'r') : markShouts(out, 'r', null);
      if (v >= 0.6) pace = '{@fast}';
      break;
    case 'fear':
      out = stutter(out, v);
      if (v >= 0.5) {
        out = wrapAll(out, 't');
        pace = '{@fast}';
      }
      break;
    case 'grief':
      if (v >= 0.5) out = wrapAll(out, 'c');
      pace = '{@slow}';
      break;
    case 'shame':
      if (v >= 0.5) {
        out = wrapAll(out, 'd');
        pace = '{@slow}';
      }
      break;
    case 'joy':
      if (v >= 0.55) out = markShouts(out, 'wg', null);
      break;
    case 'pride':
      if (v >= 0.6) out = markShouts(out, 'g', null);
      break;
    case 'love':
      if (v >= 0.6) out = markShouts(out, 'p', null);
      break;
    default:
      if (o.drunk) out = wrapAll(out, 'w');
  }
  return pace + out;
}

// The whole of a line said one way (each sentence kept apart, so the
// marks never swallow a stage direction).
function wrapAll(s, f) {
  return s.split(/(\*[^*]*\*)/).map((part) => (!part || part.startsWith('*') ? part : `{${f}:${part}}`)).join('');
}

// Sentences that end in '!' said `hot`; the rest `rest` (or as they are).
function markShouts(s, hot, rest) {
  const parts = s.match(/[^.!?]+[.!?]*\s*/g) || [s];
  return parts.map((p) => (p.startsWith('*') ? p : /!/.test(p) ? `{${hot}:${p}}` : rest ? `{${rest}:${p}}` : p)).join('');
}

// A frightened first word, caught on: "W-what".
function stutter(s, v) {
  if (v < 0.45) return s;
  return s.replace(/^([*"(]*)([A-Za-z])([a-z']*)/, (all, pre, a, rest) => (rest.length ? `${pre}${a}-${a.toLowerCase()}${rest}` : all));
}

// The worse for drink.
function slur(s) {
  return s.replace(/([^*]*)(\*[^*]*\*)?/g, (all, words, stage) => words.replace(/s(?=[aeiou\s])/g, 'sh').replace(/\. /g, '... ') + (stage || ''));
}
