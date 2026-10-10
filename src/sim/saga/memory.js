// (Round 79) The stories remembered: when one ends that someone playing
// had a hand in, its town keeps it (who was in it, how it came out, who
// helped), and afterwards folk bring it up when they see that one again:
// those it happened to most of all ("If you hadn't come when you did...",
// or, if you knew and never came, not so warmly), the rest of the town as
// something they talk of still. Said now and then, not every time, and
// fading as the seasons go by.
import { badOutcome } from './director.js';
import { pidOf } from './refs.js';

const KEEP = 80;
const FORGET_DAYS = 240;

// The story's over: kept, if anyone playing had a hand in it.
export function rememberStory(S, th) {
  const pids = Object.keys(th.touched || {});
  if (!pids.length || th.sid === null || th.sid === undefined || th.outcome === 'merged') return;
  const helped = new Set();
  for (const t of th.tasks || []) if (t.doneBy && t.doneBy.t === 'pl') helped.add(t.doneBy.pid);
  if (th.vars && th.vars.peaceBy) helped.add(th.vars.peaceBy);
  const cast = Object.values(th.cast || {}).filter((r) => r && r.t === 'rec' && r.sid === th.sid).map((r) => r.idx);
  const list = (S.memories ||= []);
  list.push({ id: th.id, m: th.m, title: th.title, outcome: th.outcome, sid: th.sid, at: S.now, day: S.day, pids, helped: [...helped], cast, bad: badOutcome(th.outcome) || th.outcome === 'faded' });
  if (list.length > KEEP) list.shift();
}

const the = (title) => (/^(The|A|An) /.test(title) ? title[0].toLowerCase() + title.slice(1) : title);

function whenWord(days) {
  return days <= 2 ? 'the other day' : days <= 8 ? 'last week' : days <= 30 ? 'a few weeks back' : days <= 100 ? 'a season ago' : 'long ago now';
}

const LINES = {
  // It happened to them; you helped, and it came out well.
  owe: [
    'I still think about {story}. If you hadn\'t come when you did...',
    '{name}! I\'ve not forgotten what you did for me {when}. {Story}: I owe you.',
    'Every time I see you I think of {story}. Thank you, still.',
    'You\'re the one who saw me through {story}. Sit down, sit down!',
  ],
  // It happened to them; you helped, and it went badly anyway.
  tried: [
    '{Story}... you tried. I know you did. That counts for something.',
    'I don\'t blame you for how {story} ended, {name}. Nobody could have done more.',
  ],
  // It happened to them; you knew, didn't help, and it went badly.
  cold: [
    '{Story}... you knew, and you didn\'t come.',
    'I asked for help {when}. {Story}. I remember who came, and who didn\'t.',
  ],
  // It happened to them, it came out well, and you were part of it.
  glad: [
    '{Story} came out all right in the end, didn\'t it? Thank you for caring.',
    'Do you remember {story}? Strange days. Better ones now.',
  ],
  // The town: you helped, and it came out well.
  famed: [
    'Folk still talk about {story}, {when}. That was you, wasn\'t it?',
    'You\'re the one from {story}! The whole town heard of it.',
    'My cousin told me all about you and {story}. Is it true?',
  ],
  // The town: it went badly.
  grim: [
    'Since {story}, things haven\'t been the same here.',
    'We still speak of {story} in hushed voices.',
    '{Story}... {when}. Some of us still don\'t sleep easy.',
  ],
  // The town: otherwise.
  told: [
    'Remember {story}? People are still talking about it.',
    'There\'s been nothing like {story} since.',
  ],
};

// A word about a past story, from `npc` to the one playing (null if none,
// or not this time). `rng`: theirs.
export function storyCallback(S, npc, game, rng) {
  const list = S && S.memories;
  if (!list || !list.length || !npc || !npc.rec || npc.rec.visitor) return null;
  const sid = npc.rec.sid ?? npc.settlement?.id;
  const pid = pidOf(game.player);
  const day = S.day;
  const mine = list.filter((m) => m.sid === sid && m.pids.includes(pid) && day - m.day >= 1 && day - m.day <= FORGET_DAYS);
  if (!mine.length) return null;
  // Theirs first; then the freshest.
  const inIt = mine.filter((m) => m.cast.includes(npc.rec.idx));
  const pool = inIt.length ? inIt : mine;
  const m = pool[Math.floor(rng.next() * pool.length)];
  const helped = m.helped.includes(pid);
  const kind = inIt.length ? (helped ? (m.bad ? 'tried' : 'owe') : m.bad ? 'cold' : 'glad') : helped && !m.bad ? 'famed' : m.bad ? 'grim' : 'told';
  const lines = LINES[kind];
  const story = the(m.title);
  const v = { story, Story: story[0].toUpperCase() + story.slice(1), name: (game.playerName || 'friend').split(' ')[0], when: whenWord(day - m.day) };
  const line = lines[Math.floor(rng.next() * lines.length)];
  return { text: line.replace(/\{(\w+)\}/g, (_, k) => v[k] ?? ''), kind, warm: kind === 'owe' || kind === 'famed' || kind === 'glad' || kind === 'tried' };
}
