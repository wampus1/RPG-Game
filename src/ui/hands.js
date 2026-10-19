// (Round 125) Handwriting: the hands letters and notes are written in, one
// for each writer (the same writer, the same hand, every time: picked by
// their name). Each a font (see src/fonts: all free to share, their
// licences beside them), and how that writer holds the pen: the size of
// their letters, the slant, how close they crowd them, their ink. Books
// are in a printer's type. The easier reading of any of them: plain print.
import { FACES } from './booktype.js';
export const HANDS = [
  { font: 'Caveat', file: 'caveat', size: 1.32, slant: -2, spacing: 0, ink: '#2a1c12' },
  { font: 'Dancing Script', file: 'dancingscript', size: 1.12, slant: 0, spacing: 0.01, ink: '#1c2438' },
  { font: 'Kalam', file: 'kalam', size: 1.0, slant: -3, spacing: 0, ink: '#3a2414' },
  { font: 'Homemade Apple', file: 'homemadeapple', size: 0.8, slant: 0, spacing: 0, ink: '#22263a' },
  { font: 'La Belle Aurore', file: 'labelleaurore', size: 1.12, slant: -1, spacing: 0.02, ink: '#3a1a2a' },
  { font: 'Cedarville Cursive', file: 'cedarvillecursive', size: 1.04, slant: 2, spacing: 0.01, ink: '#2a1c12' },
  { font: 'Nothing You Could Do', file: 'nothingyoucoulddo', size: 1.02, slant: 1, spacing: 0.02, ink: '#1a2a2a' },
  { font: 'Pinyon Script', file: 'pinyonscript', size: 1.28, slant: 0, spacing: 0, ink: '#2a1408' },
];
export const PRINT = { font: 'IM Fell English', file: 'imfellenglish', size: 1.0, slant: 0, spacing: 0, ink: '#1e1610' };

// A writer's hand, from whatever names them (their name; a story's
// number, when there's no name to go by).
export function handFor(key) {
  const s = String(key ?? '');
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const hand = HANDS[(h >>> 0) % HANDS.length];
  // (Two writers with one font still write it differently: a little
  // bigger or smaller, a little more or less slanted.)
  const j = ((h >>> 8) % 1000) / 1000;
  return { ...hand, size: hand.size * (0.94 + j * 0.12), slant: hand.slant + (j - 0.5) * 3, wobble: 0.3 + ((h >>> 16) % 100) / 100 };
}

// Whoever signed it, if it's signed: the last line, "- Mags", "Yours, Wren".
export function signerOf(lines) {
  const last = String((lines || []).filter(Boolean).slice(-1)[0] || '').trim();
  const m = /^(?:[-–—~]\s*|(?:yours|your friend|signed|from|ever yours|faithfully)[^,]*,\s*)([A-Z][\w' -]{1,30})\.?$/i.exec(last);
  return m ? m[1].trim() : null;
}

// The fonts, loaded once (in a browser: nothing to do in a test).
let loading = null;
export function loadHands() {
  if (loading) return loading;
  if (typeof document === 'undefined' || typeof globalThis.FontFace === 'undefined' || !document.fonts) return (loading = Promise.resolve(false));
  // (Round 128: and the printers' faces, each people's: see booktype.js.)
  loading = Promise.all([...HANDS, PRINT, ...FACES].map((h) => {
    const f = new globalThis.FontFace(h.font, `url(src/fonts/${h.file}.woff2) format('woff2')`);
    return f.load().then((ff) => {
      document.fonts.add(ff);
      return true;
    }).catch(() => false);
  })).then((r) => r.some(Boolean));
  return loading;
}
