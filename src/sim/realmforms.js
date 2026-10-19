// (Round 122) How a realm is governed. Every realm the world began with is a
// monarchy (a jarl, a sultan, a king or queen...), a republic under the
// speaker of its council, or a land of clans under a high elder (see
// realms.formOf, from the realm's name). A realm a player rules can be
// reformed into any of five: each says who decides with the ruler, how
// long a ruler rules, how the realm can be rid of them, and how its towns
// take being governed that way.
//   `legacy`: the older word the rest of the world's code knows a realm's
// government by ('monarch', 'council', 'elder').
import { CULTURES, CIV_TITLES } from '../world/names.js';

export const REALM_FORMS = {
  monarchy: {
    name: 'Monarchy', legacy: 'monarch', glyph: '★', color: '#ffd070', title: 'Monarch', styles: ['King', 'Queen', 'Monarch'], grand: ['Emperor', 'Empress', 'Sovereign'],
    vote: 'decree', term: 0, stipend: 25,
    rules: ['You decree, and it is done: your privy council only advises.', 'You rule for life, and name your heir.', 'A realm that turns against you breeds pretenders and rebel towns.'],
    loyalty: 0,
  },
  republic: {
    name: 'Republic', legacy: 'council', glyph: '◆', color: '#a0c8ff', title: 'Speaker',
    vote: 'council', term: 30, stipend: 15,
    rules: ['The realm\'s council votes on each matter; you decide a tie.', 'The council chooses its speaker every 30 days.', 'The council can vote you out when the realm has had enough.'],
    loyalty: 4,
  },
  elder: {
    name: 'Clan moot', legacy: 'elder', glyph: 'Ω', color: '#c8a0ff', title: 'High Elder',
    vote: 'moot', term: 0, stipend: 10,
    rules: ['The heads of the realm\'s towns sit in the moot and vote on each matter.', 'You lead for life, while the moot keeps faith in you.', 'Towns that lose faith in you vote you out.'],
    loyalty: 2,
  },
  theocracy: {
    name: 'Holy realm', legacy: 'monarch', glyph: '✦', color: '#f0e8ff', title: 'Hierarch',
    vote: 'temple', term: 0, stipend: 12,
    rules: ['You decree, but the high priest can veto any war that isn\'t holy and any rise in tribute.', 'Every town of the realm keeps the temple tithe.', 'The temple can withdraw its blessing.'],
    loyalty: 0,
  },
  league: {
    name: 'Merchant league', legacy: 'council', glyph: '¤', color: '#ffd070', title: 'Doge',
    vote: 'league', term: 40, stipend: 18, shareCap: 0.1,
    rules: ['The heads of the realm\'s towns vote, each by the weight of their town\'s treasury.', 'Tribute is never more than a tenth.', 'The towns choose a new doge every 40 days.'],
    loyalty: 3,
  },
};
export const FORM_IDS = Object.keys(REALM_FORMS);

// The form a realm the world began with has, from its legacy word.
export function formFromLegacy(f) {
  return f === 'council' ? 'republic' : f === 'elder' ? 'elder' : 'monarchy';
}

// A realm's name, under a new form (the "Republic of Tansyley" made a
// monarchy is the "Kingdom of Tansyley"; its ruler styled Emperor, the
// "Empire"). Its title word swapped; a name with none it knows is kept.
const FORM_WORD = { monarchy: 'Kingdom', republic: 'Republic', elder: 'Clans', theocracy: 'Holy Realm', league: 'League' };
const GRAND = ['Emperor', 'Empress', 'Sovereign'];
export function renameFor(name, form, style = null, legacyOf = null) {
  const word = form === 'monarchy' && GRAND.includes(style) ? 'Empire' : FORM_WORD[form];
  if (!word || !name) return name;
  // (A name that already fits its form: a jarldom is a monarchy already.)
  if (legacyOf && word !== 'Empire' && !name.includes('Empire') && form !== 'theocracy' && form !== 'league' && formFromLegacy(legacyOf(name)) === form) return name;
  if (name.includes(word)) return name;
  const words = [...new Set([...Object.values(CULTURES).flatMap((c) => c.civ || []), ...CIV_TITLES, 'Holy Realm', 'Kingdom', 'Empire'])].sort((a, b) => b.length - a.length);
  const w = words.find((q) => name.includes(q));
  return w ? name.replace(w, word) : name;
}
