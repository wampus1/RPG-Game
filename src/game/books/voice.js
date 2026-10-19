// (Round 127) How a writer writes: every author has a voice of their own,
// and it shows in every book they put their name to.
//
//   The chronicler, measured and formal ("Thereafter...", "It is recorded
//   that..."); the storyteller, warm and talkative ("Mind you...", "so they
//   say"); the scholar, careful and dry ("It seems reasonable to suppose
//   that..."); the devout, who gives the god their due; the plain writer,
//   short sentences, no flourishes; and the lyrical, long sentences, the
//   weather in them.
//
// A voice is how one sentence leads on to the next (the joining words it
// reaches for: "Yet", "And so", "However"), the asides it lets fall in the
// middle of a sentence, how long it likes its sentences, and sentences of
// its own for some of what's said (see the corpus: a pool "x.y@scholar" is
// the scholar's own way with "x.y").
import { hash4 } from '../../util/rng.js';

// The joining words for each way one sentence follows another:
//   then     it came after (time)
//   result   it came of it
//   contrast it went against it
//   add      more of the same
//   reflect  what the writer makes of it
export const VOICES = {
  chronicler: {
    aim: 20, link: 0.42, aside: 0.12,
    links: {
      then: ['Thereafter,', 'In the years that followed,', 'Soon afterwards,', 'In due course,', 'Not long after,'],
      result: ['In consequence,', 'Accordingly,', 'Thus', 'As a result,'],
      contrast: ['Nevertheless,', 'Even so,', 'Yet', 'For all that,'],
      add: ['Moreover,', 'It is further recorded that', 'Besides this,'],
      reflect: ['It may be observed that', 'It is worth recording that'],
    },
    asides: ['*, as the rolls record,', '*, it is written,', '*, so the record runs,'],
  },
  storyteller: {
    aim: 17, link: 0.5, aside: 0.2,
    links: {
      then: ['Then', 'Before long,', 'Not long after that,', 'And then,', 'Well,'],
      result: ['So', 'And so', 'Which is why', 'And that is how'],
      contrast: ['But', 'Mind you,', 'Still,', 'All the same,'],
      add: ['What is more,', 'Besides,', 'And', 'On top of that,'],
      reflect: ['Now,', 'You see,', 'I will tell you this:'],
    },
    asides: [', so they say,', ', mark you,', ', or so my grandmother told it,', '+, and good luck to them,', ', if you believe it,', '-, poor souls,'],
  },
  scholar: {
    aim: 22, link: 0.45, aside: 0.16,
    links: {
      then: ['Subsequently,', 'Some years afterwards,', 'Later,', 'In the period that followed,'],
      result: ['As a consequence,', 'It follows that', 'For this reason,', 'In consequence,'],
      contrast: ['However,', 'On the other hand,', 'That said,', 'Against this,'],
      add: ['Further,', 'In addition,', 'It should be noted that', 'Equally,'],
      reflect: ['One may reasonably conclude that', 'It seems likely that', 'We may suppose that'],
    },
    asides: ['*, if the records are to be trusted,', '*, as far as can be determined,', '*, so far as the evidence goes,', '*, on the best authority,'],
  },
  pious: {
    aim: 19, link: 0.4, aside: 0.16,
    links: {
      then: ['In time,', 'When the season had turned,', 'After this,', 'In the fullness of time,'],
      result: ['And so', 'Thus', 'So it was that'],
      contrast: ['Yet', 'But', 'And still'],
      add: ['Truly,', 'And', 'Let it be said, too, that'],
      reflect: ['Let it be remembered that', 'It is a mercy that'],
    },
    asides: ['+, by the grace of {god},', '+, the gods be thanked,', '-, may {god} keep them,', '*, as {god} willed,', '-, and {god} saw it all,'],
  },
  plain: {
    aim: 13, link: 0.3, aside: 0,
    links: {
      then: ['Then', 'After that,', 'Later,'],
      result: ['So', 'That is why'],
      contrast: ['But', 'Still,'],
      add: ['Also,', 'And'],
      reflect: [],
    },
    asides: [],
  },
  lyrical: {
    aim: 24, link: 0.45, aside: 0.15,
    links: {
      then: ['When the seasons had turned,', 'In the long years after,', 'By the time the snows came again,', 'Slowly, as such things go,'],
      result: ['And so it was that', 'So it came about that', 'And from that day'],
      contrast: ['And yet', 'For all that,', 'Even so,'],
      add: ['And', 'Then too,', 'And all the while'],
      reflect: ['Perhaps', 'It may be that'],
    },
    asides: [', as the old songs have it,', ', in the way of such things,', ', like a half-remembered tune,'],
  },
};
export const VOICE_IDS = Object.keys(VOICES);

// A writer's voice, from who they are: the clergy lean devout, schoolmasters
// and scholars dry; the rest, as they are.
export function voiceFor(seed, sign = '') {
  const h = hash4(seed >>> 0, 0x70ce, 1, 2) >>> 0;
  const r = (h % 1000) / 1000;
  if (/priest|vicar|keeper|reader|speaker|caller|bearer|watcher|singer|seer|godi|shaman|imam|augur|flamen|vestal|pontifex|tide-caller|wife/.test(sign) && r < 0.6) return 'pious';
  if (/scholar|schoolmaster/.test(sign) && r < 0.55) return 'scholar';
  if (/clerk/.test(sign) && r < 0.5) return 'chronicler';
  return VOICE_IDS[h % VOICE_IDS.length];
}

// The way each move of a paragraph follows the one before it (see the
// corpus FLOWS): a move not named here is joined, if at all, as more of
// the same.
const REL = {
  after: 'result', aftermath: 'result', outcome: 'result', terms: 'result', ceded: 'result', returned: 'then',
  cost: 'add', dwell: 'add', inside: 'add',
  first: 'then', grow: 'then', settle: 'then', remember: 'then', meet: 'then', arrive: 'then', invest: 'then', march: 'then', muster: 'then',
  hardship: 'contrast', belief: 'contrast', doubt: 'contrast', turn: 'contrast', blame: 'contrast', fate: 'contrast', breach: 'contrast',
  remark: 'reflect', judge: 'reflect', think: 'reflect', lesson: 'reflect',
};
export const relOf = (move) => REL[move] || null;

// (An aside marked "+" is let fall only on good news, "-" only on bad: no
// "the gods be thanked" after a drowning.)
const GOOD = /\b(prosper\w*|peace\w*|thriv\w*|built|raised|saved|spared|grew|good|finest|best|welcome|rich\w*|plenty|feast\w*|won|married|blessed|healed|loved)\b/i;
const BAD = /\b(died|dead|death|fell|burn\w*|lost|plague|famine|war|killed|drown\w*|flood\w*|hunger|starv\w*|sick\w*|fever|siege|slain|ruin\w*|grief|mourn\w*)\b/i;
export function asideFits(a, s) {
  // (Never on the writer's own words: "Any errors are my own, so they say.")
  if (/\b(I|my|me|mine|we|our)\b/.test(s)) return false;
  if (a[0] === '*') return fitsRel(s, 'then');
  if (a[0] === '+') return GOOD.test(s) && !BAD.test(s);
  if (a[0] === '-') return BAD.test(s);
  return true;
}
export const asideText = (a) => ('+-*'.includes(a[0]) ? a.slice(1) : a);

// (Only a sentence about the past follows on in time, or as what came of
// it: "Thereafter, the walls were raised", never "Thereafter, the walls
// stand".)
const PAST = /\b(did|came|went|took|made|built|grew|fell|left|gave|sent|lived|died|rose|ran|brought|stood|kept|saw|found|lost|began|burned|knew|swore|held|marched|won|thought|said|became)\b|\b\w{3,}ed\b/;
const NOW = /\b(is|are|has|have|still|today|now|to this day|will)\b/;
export function fitsRel(s, rel) {
  if (rel !== 'then' && rel !== 'result') return true;
  const head = s.split(' ').slice(0, 10).join(' ');
  return PAST.test(head) && !NOW.test(s.split(' ').slice(0, 7).join(' '));
}

// Words a sentence may already start with that join it to the last.
const JOINED = /^(In|After|Afterwards|Then|But|Yet|And|So|Since|When|Once|Before|By|Still|Even|However|Today|Now|For|Long|Within|Later|That|Thus|Whatever|Whether|If|Of|Among|At|On|Over|Across|Through|During|Ask|Speak|Seen|Let|May|Do|Never|Keep|Carry|Travel|Leave|Serve|Eat|O)\b/;
export const joinedAlready = (s) => JOINED.test(s) || /^["'(]/.test(s);

// The first word of a sentence, lower-cased to follow a joining word (not
// if it's a name).
const COMMON = new Set(['The', 'A', 'An', 'It', 'Its', 'They', 'Their', 'Them', 'This', 'These', 'Those', 'Folk', 'People', 'No', 'None', 'Nobody', 'All', 'One', 'Two', 'Three', 'His', 'Her', 'Our', 'We', 'You', 'Your', 'Nothing', 'Someone', 'Others', 'What', 'Whoever', 'Life', 'Word', 'News', 'Hunters', 'Shepherds', 'Strangers', 'Travellers', 'Grandmothers', 'Mothers', 'Children', 'Families', 'Arrows', 'Spears', 'Fever', 'Sickness', 'Hunger', 'Thatch', 'Timber', 'Within', 'Inside', 'Such', 'Here', 'Here,', 'Those', 'Neither', 'Both', 'Whole', 'Every', 'Each', 'Messengers', 'Envoys', 'Heralds', 'Riders', 'Songs', 'Ballads', 'Smiths', 'Delvers', 'Merchants', 'Learned', 'Sensible', 'Mist', 'Fog', 'Rain', 'Snow', 'Smoke']);
export function lowerStart(s, starters = null) {
  const w = s.split(/[\s,]/)[0];
  if (!COMMON.has(w) && !(starters && starters.has(w))) return s;
  return s.charAt(0).toLowerCase() + s.slice(1);
}
