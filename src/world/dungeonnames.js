// (Round 74) An old place's name, four words at most: not cut off, but
// made without its fluff. "The Barrow of Thane Dorrin Stonefist" is
// "Dorrin Stonefist's Barrow"; "the Old Silver Workings of Ashford" is
// "Ashford's Silver Mine"; "the Drowned Crypt of the Old Mother" is "the
// Drowned Crypt".
export const MAX_WORDS = 4;
export const wordsIn = (s) => String(s || '').trim().split(/\s+/).filter(Boolean).length;
const fits = (s) => !!s && wordsIn(s) <= MAX_WORDS;

// Titles worn in front of a name (and the like: "the Jaguar-Chief").
const TITLES = new Set(['old', 'young', 'king', 'queen', 'lord', 'lady', 'dame', 'sir', 'jarl', 'prince', 'princess', 'thane', 'mother', 'father', 'satrap', 'vizier', 'chief', 'elder', 'saint', 'brother', 'sister', 'high', 'great', 'grand', 'emperor', 'empress', 'duke', 'count', 'baron', 'abbot', 'bishop', 'captain', 'warlord']);
const ADJ = new Set(['old', 'young', 'high', 'great', 'grand']);
const TITLE_PART = /-(king|queen|lord|lady|chief|crowned|father|mother|priest|captain)$/i;
const isTitle = (w) => TITLES.has(w.toLowerCase()) || TITLE_PART.test(w);

// Someone's name without their titles and epithets ("Asa the Grim" is
// Asa; "Old King Aldric", Aldric; "the Pearl-Queen Kailani", Kailani). A
// name that's all title ("the Hollow King") is left as it is.
export function bareName(who) {
  let s = String(who || '').trim();
  const had = /^the\s/i.test(s);
  s = s.replace(/^the\s+/i, '');
  // ("of the Fog", "of the Nine Wars"; and "the Grim" after one name.)
  s = s.replace(/\s+of\s.*$/i, '').replace(/^(\S+)\s+the\s+\S+$/i, '$1');
  const ws = s.split(/\s+/);
  let i = 0;
  // ("The Old Ones" are no title and a name: only "Old Helga" is.)
  while (i < ws.length - 1 && isTitle(ws[i]) && !(had && ADJ.has(ws[i].toLowerCase()))) i++;
  // ("Old Angus the Bone-Carver": his title gone, then his epithet.)
  const out = ws.slice(i).join(' ').replace(/^(\S+)\s+the\s+.+$/i, '$1');
  // (All title: "the Old Mother", "the Hollow King" stay as they are.)
  if (isTitle(out) || (i === 0 && had)) return `the ${s}`;
  return out;
}

// (A crowd's "the Old Ones'"; one man's "Angus's".)
const possessive = (s) => (/s$/.test(s) && /\s/.test(s) ? `${s}'` : `${s}'s`);
const capFirst = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// The first of these that fits (and failing all of them, the shortest).
export function fitName(...cands) {
  const c = cands.filter(Boolean);
  for (const s of c) if (fits(s)) return s;
  return c.reduce((a, b) => (wordsIn(b) < wordsIn(a) ? b : a), c[0] || '');
}

// Any old place's name made to fit: "the X of Y" turned about ("Y's X"),
// Y's titles let go, and failing that only "the X".
export function shortName(name) {
  const s = String(name || '').trim();
  if (fits(s)) return s;
  const m = /^(the\s+)?(.+?)\s+of\s+(.+)$/i.exec(s);
  if (m) {
    const head = m[2];
    const who = m[3];
    const bare = bareName(who);
    return fitName(
      `${possessive(bare)} ${head}`,
      `${possessive(who)} ${head}`,
      `the ${head}`,
      `${possessive(bare.split(/\s+/).pop())} ${head.split(/\s+/).pop()}`,
    );
  }
  // No "of" to turn about: let titles and epithets go.
  const b = bareName(s);
  if (fits(b)) return b;
  return capFirst(s.split(/\s+/).slice(-MAX_WORDS).join(' '));
}
