// (Round 121) A town's charter: how it's governed once it's yours to govern.
// Each says who decides the matters put before the town (the council, every
// grown townsperson, the guild masters, the temple, the factions, or you
// alone), how long a term runs before the town votes again, whether the
// town can petition to recall you, what you're paid, and how each faction
// takes being governed that way. A charter can be reformed (see office.js):
// put to the town under the rules of the charter it has, and carried only
// by two in every three.
export const CHARTERS = {
  council: {
    name: 'Mayor and council', short: 'a mayor and council', title: 'Mayor', villageTitle: 'Elder', seats: 4, term: 28, recall: 0.35, stipend: 8, vote: 'council',
    glyph: '♦', color: '#e8c070',
    rules: ['Four councillors vote on each matter; you cast the deciding vote on a tie.', 'A term of 28 days, then the town votes.', 'A third of the town can petition to recall you.', '¤8 a day.'],
    mod: {},
  },
  assembly: {
    name: 'Town moot', short: 'a town moot', title: 'Moot-speaker', villageTitle: 'Moot-speaker', seats: 0, term: 21, recall: 0.25, stipend: 5, vote: 'assembly',
    glyph: '☺', color: '#a0e0a0',
    rules: ['Every grown townsperson votes on each matter.', 'A term of 21 days, then the town votes.', 'A quarter of the town can petition to recall you.', '¤5 a day.'],
    mod: { poor: 5, farmers: 4, crafters: 2, merchants: -3, elders: -2 },
  },
  guild: {
    name: 'Guild charter', short: 'a guild town', title: 'Guildmaster', villageTitle: 'Guildmaster', seats: 4, term: 35, recall: 0, stipend: 10, vote: 'guild',
    glyph: '¤', color: '#ffd070', taxCap: 0.14,
    rules: ['The four richest merchants and crafters vote, each by the weight of their purse.', 'A term of 35 days, then the guilds vote (the poor have no say).', 'No petitions: only the guild masters can recall you.', 'Taxes may not go above 14%.', '¤10 a day.'],
    mod: { merchants: 10, crafters: 8, poor: -10, farmers: -4, clergy: -2 },
  },
  theocracy: {
    name: 'Temple rule', short: 'the temple', title: 'Hierarch', villageTitle: 'Hierarch', seats: 3, term: 0, recall: 0, stipend: 6, vote: 'temple',
    glyph: '✦', color: '#f0e8ff', needs: 'temple',
    rules: ['The priest and two of the devout sit with you; the priest can veto anything the clergy oppose.', 'No elections: you serve while the temple keeps faith in you (it removes you if the clergy turn against you for five days).', 'The temple tithe is always law.', '¤6 a day.'],
    mod: { clergy: 15, elders: 5, merchants: -5, crafters: -3, guards: -2 },
  },
  autocracy: {
    name: 'Protectorate', short: 'a protectorate', title: 'Protector', villageTitle: 'Protector', seats: 0, term: 0, recall: 0, stipend: 14, vote: 'decree',
    glyph: '♜', color: '#ff8a70',
    rules: ['You decide everything by decree: no votes.', 'No elections and no petitions: but unrest builds whenever the town is unhappy, and an unhappy town may rise against you.', '¤14 a day.'],
    mod: { guards: 6, elders: -6, clergy: -4, merchants: -3, poor: -4, farmers: -2 },
  },
  // (Round 122) A town held by right, like a little kingdom: its lord or
  // lady decrees, rules for life and names an heir. A monarch can grant
  // one (see crown.js); a town can make itself one only by two in three.
  lordship: {
    name: 'Lordship', short: 'a lordship', title: 'Lord', villageTitle: 'Lord', styles: ['Lord', 'Lady', 'Liege'], seats: 0, term: 0, recall: 0, stipend: 12, vote: 'decree',
    glyph: '♠', color: '#d8b0ff',
    rules: ['You rule by right, and decree: no votes.', 'No elections and no petitions: you rule for life.', 'A lordship is granted by the realm\'s monarch, or made by the town, two in every three.', '¤12 a day.'],
    mod: { elders: 4, guards: 3, merchants: -2, poor: -5, farmers: -2 },
  },
  commune: {
    name: 'Commune', short: 'a commune', title: 'First Speaker', villageTitle: 'First Speaker', seats: 0, term: 14, recall: 0.25, stipend: 0, vote: 'factions',
    glyph: '•', color: '#ff9a7a',
    rules: ['Each faction has one voice: a matter passes when most factions are for it.', 'A term of 14 days, then the town votes.', 'A quarter of the town can petition to recall you.', 'Relief for the hungry can never be cut.', 'No pay at all.'],
    mod: { poor: 12, farmers: 6, crafters: 3, merchants: -10, elders: -3 },
  },
};
export const CHARTER_IDS = Object.keys(CHARTERS);

// The charter a town has until someone changes it: a village holds a moot;
// a town or city has a mayor and council; on Kharos, where the kiln-temple
// keeps the mountain quiet, a town with a temple is the temple's.
export function defaultCharter(L) {
  const s = L.settlement;
  if (s.style === 'ember' && L.buildings.some((b) => b.type === 'temple')) return 'theocracy';
  if (s.type === 'village') return 'assembly';
  return 'council';
}

// The head of the town's title, under a charter.
export function headTitle(id, s, style = null) {
  const c = CHARTERS[id] || CHARTERS.council;
  // (A charter whose head chooses how they're styled: Lord, Lady, Liege.)
  if (style && c.styles && c.styles.includes(style)) return style;
  return s && s.type === 'village' ? c.villageTitle : c.title;
}

// Can a town take this charter at all?
export function charterFits(L, id) {
  const c = CHARTERS[id];
  if (!c) return false;
  if (c.needs === 'temple') return L.buildings.some((b) => b.type === 'temple' && !b.underConstruction) && L.npcs.some((r) => r.job === 'priest' && r.alive !== false);
  return true;
}
