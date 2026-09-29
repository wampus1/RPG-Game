// How someone talks. Everyone has a voice that stays the same from one
// conversation to the next: a register (formal, plain, rough, chirpy,
// terse or gruff) that follows from who they are, a word they call you by,
// and a filler or two they lean on. Every line they say is passed through
// it, so the same news sounds different from the mayor and the miner, but
// the miner always sounds like the miner.
import { hash4 } from '../util/rng.js';

const FORMAL_JOBS = new Set(['mayor', 'noble', 'priest', 'scholar']);
const ROUGH_JOBS = new Set(['miner', 'lumberjack', 'trapper', 'laborer', 'fisher', 'beggar']);

// Contractions a formal speaker spells out, and plain speech a rough one
// clips.
const FORMAL = [[/\byou'll\b/g, 'you will'], [/\bwe'll\b/g, 'we shall'], [/\bthey're\b/g, 'they are'], [/\bDon't\b/g, 'Do not'], [/\bCan't\b/g, 'Cannot'], [/\bWon't\b/g, 'Will not'], [/\bThere's\b/g, 'There is'], [/\bthere's\b/g, 'there is'], [/\bI'm\b/g, 'I am'], [/\bWhat's\b/g, 'What is'], [/\bdon't\b/g, 'do not'], [/\bcan't\b/g, 'cannot'], [/\bwon't\b/g, 'will not'], [/\bI'm\b/g, 'I am'], [/\bit's\b/g, 'it is'], [/\bIt's\b/g, 'It is'], [/\bisn't\b/g, 'is not'], [/\bthat's\b/g, 'that is'], [/\bThat's\b/g, 'That is'], [/\bwe're\b/g, 'we are'], [/\bWe're\b/g, 'We are'], [/\byou're\b/g, 'you are'], [/\bYou're\b/g, 'You are'], [/\bI've\b/g, 'I have'], [/\bI'd\b/g, 'I would'], [/\bI'll\b/g, 'I shall'], [/\bYeah\b/g, 'Yes'], [/\bgonna\b/g, 'going to']];
const ROUGH = [[/\bYes\b/g, 'Aye'], [/\byes\b/g, 'aye'], [/\bisn't\b/g, "ain't"], [/\bnothing\b/g, 'nothin\''], [/\bsomething\b/g, 'somethin\''], [/\bgoing to\b/g, 'gonna'], [/\bthem\b/g, '\'em'], [/\bVery well\b/g, 'Right'], [/\bThank you\b/g, 'Ta']];

const ADDRESS = {
  formal: ['my friend', 'good traveller', 'citizen', 'friend'],
  plain: ['friend', 'neighbour', 'love', 'pal'],
  rough: ['mate', 'pal', 'chum', 'lad'],
  chirpy: ['mister', 'friend', 'hey you'],
  terse: [null],
  gruff: ['you', 'stranger'],
};
const FILLERS = {
  formal: ['Indeed.', 'Well now,', 'I dare say,'],
  plain: ['Well,', 'Oh,', 'Hm,'],
  rough: ['Right,', 'Eh,', 'Look,'],
  chirpy: ['Ooh!', 'Hey!', 'Guess what,'],
  terse: [],
  gruff: ['Hmph.', 'Listen,', 'Bah.'],
};
const COMMON = new Set(['The', 'It', 'We', 'You', 'That', 'There', 'This', 'What', 'Our', 'My', 'No', 'Yes', 'A', 'An', 'They', 'He', 'She', 'Not', 'Just', 'Nothing', 'Some', 'Everyone', 'Nobody', 'If', 'Who', 'Why', 'How', 'When', 'Where', 'Any', 'All', 'Do', 'Did', 'Is', 'Are', 'Can', 'Come', 'Go', 'Here', 'Taxes', 'Fines', 'Good', 'Sure', 'Oh', 'Well']);
const TAGS = { formal: [], plain: [', you know.', '.'], rough: [', eh?', ', see.'], chirpy: ['!', '!'], terse: [], gruff: ['.'] };

export function voiceOf(rec) {
  if (rec._voice) return rec._voice;
  const p = rec.personality || {};
  const h = (k) => hash4(rec.idx, k, 0x5ce, (rec.name?.first || '').length) >>> 0;
  let reg = 'plain';
  if (rec.age === 'child') reg = 'chirpy';
  else if (FORMAL_JOBS.has(rec.job) || (rec.age === 'elder' && (p.kindness ?? 0.5) > 0.6)) reg = 'formal';
  else if ((p.temper ?? 0.3) > 0.7) reg = 'gruff';
  else if ((p.sociability ?? 0.5) < 0.25) reg = 'terse';
  else if (ROUGH_JOBS.has(rec.job)) reg = 'rough';
  const pickOf = (list, k) => (list.length ? list[h(k) % list.length] : null);
  const v = { reg, address: pickOf(ADDRESS[reg], 1), filler: pickOf(FILLERS[reg], 2), tag: pickOf(TAGS[reg], 3), rate: 0.25 + (h(4) % 30) / 100 };
  Object.defineProperty(rec, '_voice', { value: v, enumerable: false, configurable: true });
  return v;
}

// Deterministic per line, so the same line comes out the same way.
function roll(rec, text, k) {
  let x = 0;
  for (let i = 0; i < text.length; i++) x = (x * 31 + text.charCodeAt(i)) >>> 0;
  return (hash4(rec.idx, x, k, 0x70e) % 1000) / 1000;
}

// One line in their voice. `first` marks the opening line of a reply.
export function speak(rec, text, { first = false, warm = false, cold = false } = {}) {
  if (!text || typeof text !== 'string' || text.startsWith('(') || text.startsWith('*')) return text;
  const v = voiceOf(rec);
  let t = text;
  if (v.reg === 'formal') for (const [a, b] of FORMAL) t = t.replace(a, b);
  if (v.reg === 'rough') for (const [a, b] of ROUGH) t = t.replace(a, b);
  if (v.reg === 'terse') {
    // Short and to the point: pleasantries go.
    t = t.replace(/^(Well|Oh|Ah|Hm+|So),?\s+/i, '').replace(/,? you know\.?$/, '.');
  }
  // Their habits: a filler at the start, a tag at the end, what they call you.
  if (first && v.filler && roll(rec, t, 1) < v.rate * 0.45 && !/^[A-Z][a-z]+[!,]/.test(t)) {
    if (v.filler.endsWith(',')) {
      const w = t.split(/[\s,.!?']/)[0];
      t = `${v.filler} ${COMMON.has(w) ? t[0].toLowerCase() + t.slice(1) : t}`;
    } else t = `${v.filler} ${t}`;
  }
  if (v.tag && v.tag !== '.' && roll(rec, t, 2) < v.rate * 0.4 && /[a-z]\.$/.test(t) && t.length < 90) t = t.slice(0, -1) + v.tag;
  // "Friend" is for people who like you; a stranger is a traveller to them.
  let addr = cold && v.reg !== 'formal' ? 'stranger' : v.address;
  if (!warm && addr && /friend/.test(addr)) addr = v.reg === 'chirpy' ? 'mister' : 'traveller';
  if (first && addr && !cold && (warm || v.reg !== 'gruff') && roll(rec, t, 3) < v.rate * 0.45 && /[.!?]$/.test(t) && t.length < 80 && !/,\s*\w+[.!?]$/.test(t)) {
    t = t.replace(/([.!?])$/, `, ${addr}$1`);
  }
  return t;
}

export function speakAll(rec, lines, opts = {}) {
  return lines.map((l, i) => speak(rec, l, { ...opts, first: i === 0 }));
}
