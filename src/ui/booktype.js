// (Round 128) How a book is set: each people's printers in their own type
// and their own manner (see document.js and bookview.js). The Valeborn in a
// plain old roman, indented and justified, a red drop cap at each chapter;
// the Sunfolk in a flowing face on warm paper, set ragged, gold at the
// heads; the Mistholds' heavy gothic heads; the Jade court's spaced
// capitals and no drop cap at all... And within a people, each writer's
// book a little their own: which of the people's faces, the colour of the
// capitals, the ornament, how deep the first letter drops.
//
// The faces are the ones in src/fonts (each with its licence: see the
// README there), loaded with the hands (hands.js loadHands).

// The book faces: the printer's type, by name and file.
export const FACES = [
  { font: 'IM Fell DW Pica', file: 'imfelldwpica' },
  { font: 'Almendra', file: 'almendra' },
  { font: 'Amiri', file: 'amiri' },
  { font: 'Cinzel', file: 'cinzel' },
  { font: 'Uncial Antiqua', file: 'uncialantiqua' },
  { font: 'Grenze Gotisch', file: 'grenzegotisch' },
  { font: 'MedievalSharp', file: 'medievalsharp' },
  { font: 'Alegreya', file: 'alegreya' },
  { font: 'EB Garamond', file: 'ebgaramond' },
  { font: 'Marcellus', file: 'marcellus' },
  { font: 'UnifrakturMaguntia', file: 'unifrakturmaguntia' },
];

const FELL = 'IM Fell English';

// Each people's way of setting a book:
//   body: the faces its text is set in (a writer's book takes one of them);
//   head: the face of its headings and title; cap: its drop capitals;
//   paper / ink: the stock and the ink; caps: the colours of the capitals
//     (a writer's takes one); orn: its ornaments (one of them);
//   para: 'indent' (the first line in) or 'space' (a line between, none in);
//   justify: set square, or ragged; drop: how many lines the capital drops
//     (0: none); heads: 'upper', 'title' or 'spaced' (capitals, spread);
//   align: the headings 'center' or 'left'; rule: a rule under each.
export const TYPES = {
  vale: { body: [FELL, 'IM Fell DW Pica'], head: FELL, cap: FELL, paper: '#f1e6cc', ink: '#1e1610', caps: ['#6a2014', '#1e3a6a'], orn: ['diamond', 'leaf'], para: 'indent', justify: true, drop: 2, heads: 'title', align: 'center' },
  north: { body: ['EB Garamond', FELL], head: 'Almendra', cap: 'Almendra', paper: '#eee6d2', ink: '#1a1a1e', caps: ['#2a4a6a', '#6a2014'], orn: ['knot', 'diamond'], para: 'indent', justify: true, drop: 3, heads: 'upper', align: 'center', rule: true },
  sun: { body: ['Amiri'], head: 'Amiri', cap: 'Amiri', paper: '#f4e4c0', ink: '#2a1a0c', caps: ['#9a6a10', '#7a2a10'], orn: ['star', 'sun'], para: 'space', justify: false, drop: 2, heads: 'title', align: 'center' },
  wild: { body: ['Alegreya'], head: 'Cinzel', cap: 'Cinzel', paper: '#efe3c4', ink: '#1e1a10', caps: ['#2a6a3a', '#8a4a10'], orn: ['sun', 'leaf'], para: 'indent', justify: true, drop: 3, heads: 'spaced', align: 'center' },
  high: { body: ['IM Fell DW Pica', 'EB Garamond'], head: 'Uncial Antiqua', cap: 'Uncial Antiqua', paper: '#ebe3d0', ink: '#16140f', caps: ['#5a3a10', '#3a4a5a'], orn: ['knot', 'diamond'], para: 'indent', justify: true, drop: 2, heads: 'title', align: 'center', rule: true },
  ember: { body: ['EB Garamond'], head: 'Grenze Gotisch', cap: 'Grenze Gotisch', paper: '#e9dcc4', ink: '#22100a', caps: ['#8a1a0a', '#2a2a2a'], orn: ['flame', 'diamond'], para: 'indent', justify: true, drop: 3, heads: 'title', align: 'left', rule: true },
  mist: { body: ['IM Fell DW Pica'], head: 'MedievalSharp', cap: 'MedievalSharp', paper: '#e6e4d2', ink: '#16201a', caps: ['#2a5a3a', '#4a3a6a'], orn: ['leaf', 'knot'], para: 'space', justify: false, drop: 2, heads: 'title', align: 'left' },
  tide: { body: ['Alegreya'], head: 'Marcellus', cap: 'Marcellus', paper: '#ece8d8', ink: '#101a24', caps: ['#1a5a7a', '#7a3a2a'], orn: ['wave', 'star'], para: 'space', justify: false, drop: 2, heads: 'spaced', align: 'center' },
  velari: { body: ['EB Garamond'], head: 'Cinzel', cap: 'Cinzel', paper: '#f2ead6', ink: '#14100c', caps: ['#7a1a1a', '#5a4a10'], orn: ['diamond', 'leaf'], para: 'indent', justify: true, drop: 3, heads: 'spaced', align: 'center', rule: true },
  rime: { body: ['Alegreya', 'EB Garamond'], head: 'Almendra', cap: 'Almendra', paper: '#eef0e8', ink: '#141820', caps: ['#2a4a7a', '#7a2a2a'], orn: ['knot', 'star'], para: 'indent', justify: true, drop: 2, heads: 'upper', align: 'center' },
  jade: { body: ['Marcellus'], head: 'Marcellus', cap: 'Marcellus', paper: '#f4f0e2', ink: '#0e0e0e', caps: ['#8a1a1a'], orn: ['star', 'wave'], para: 'space', justify: false, drop: 0, heads: 'spaced', align: 'center', rule: true },
  kesh: { body: ['Alegreya'], head: 'Cinzel', cap: 'Uncial Antiqua', paper: '#f0dfc0', ink: '#24160c', caps: ['#2a6a7a', '#9a4a1a'], orn: ['sun', 'diamond'], para: 'indent', justify: false, drop: 2, heads: 'upper', align: 'center' },
  corrow: { body: ['IM Fell DW Pica'], head: 'Uncial Antiqua', cap: 'Uncial Antiqua', paper: '#e8e2d0', ink: '#141410', caps: ['#2a4a2a', '#6a2014'], orn: ['knot', 'wave'], para: 'indent', justify: true, drop: 3, heads: 'title', align: 'left' },
  salt: { body: ['Alegreya'], head: 'Marcellus', cap: 'Marcellus', paper: '#f3ead8', ink: '#1a1410', caps: ['#1a6a6a', '#9a5a1a'], orn: ['wave', 'sun'], para: 'space', justify: false, drop: 2, heads: 'title', align: 'center' },
  hollow: { body: [FELL], head: 'MedievalSharp', cap: 'MedievalSharp', paper: '#e4dcc8', ink: '#1a140e', caps: ['#5a3a10', '#3a5a2a'], orn: ['leaf', 'diamond'], para: 'indent', justify: true, drop: 2, heads: 'title', align: 'center' },
  wyrd: { body: ['EB Garamond'], head: 'UnifrakturMaguntia', cap: 'UnifrakturMaguntia', paper: '#ebe6d8', ink: '#10101a', caps: ['#5a2a6a', '#1a3a6a'], orn: ['star', 'knot'], para: 'indent', justify: true, drop: 3, heads: 'title', align: 'center', rule: true },
  skerry: { body: ['IM Fell DW Pica', FELL], head: FELL, cap: 'Uncial Antiqua', paper: '#e9e4d4', ink: '#141614', caps: ['#2a4a5a', '#6a2014'], orn: ['wave', 'knot'], para: 'indent', justify: true, drop: 2, heads: 'upper', align: 'center' },
};

function strHash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

// How this book is set: its people's way, made its writer's own. `doc`:
// { style (the writer's people), by (the writer) }.
export function typeFor(doc) {
  const T = TYPES[doc && doc.style] || TYPES.vale;
  const h = strHash(String((doc && (doc.by || doc.title)) || ''));
  const pick = (xs, k) => xs[(h >>> k) % xs.length];
  return {
    ...T,
    body: pick(T.body, 0),
    capInk: pick(T.caps, 3),
    orn: pick(T.orn, 7),
    // (Some writers would have their capitals drop a line deeper; some,
    // set square where their people set ragged, or the other way about.)
    drop: T.drop ? T.drop + ((h >>> 11) % 5 === 0 ? (T.drop >= 3 ? -1 : 1) : 0) : 0,
    justify: (h >>> 15) % 7 === 0 ? !T.justify : T.justify,
  };
}

// A heading as the people set it.
export function headText(t, ty) {
  if (!ty || ty.heads === 'title') return t;
  return t.toUpperCase();
}
