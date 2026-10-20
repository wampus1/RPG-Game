// (Round 129) The festival's games, and what else a player can do at one:
// the archery on the green, the foot race round the town, a bout with the
// town's champion wrestler, the eating match and the riddling at the ale
// tables, the dance and the cook-off on the square; playing for the crowd
// for tips; helping get it ready beforehand (food, ale, flowers or coin
// for the host); and the prizes (coin and a rosette, and the town's good
// word).
//
// Each contest is kept with the do (`ev.contests[k]`): when it's open,
// who's had a go and how they did, and the townsfolk who'll have a go
// themselves (their scores worked out when it's set up, and put on the
// board as they make them). It's closed at its time, the places worked
// out and the prizes given, and called out round the town.
//
// The games played at a window (the archery, the eating, the riddles, the
// dance, the cook-off's judging: see ui/festwin.js) are opened by the host
// in the player's own windows; in someone else's world the player's own
// screen plays it (smoothly, with their own keys) and sends back how they
// did, which is checked here (see `result`). The race is run in the world,
// the bout is a friendly bout (see Game.startDuel).
import { ITEMS } from '../world/items.js';
import { removeItem } from './inventory.js';
import { alive, ledger, DAY } from '../sim/econ.js';
import { hash4, clamp } from '../util/rng.js';
import { asSeat } from './party.js';
import { pidOf, seatOfPid, playerOf, playerName } from '../sim/saga/refs.js';
import { VENUES, designOf, venueName } from '../sim/festival.js';
import { dishesOf, forbiddenFood } from '../sim/culture.js';
import { M } from '../world/settlement.js';
import { GROUND } from '../config.js';
import { yearOf } from '../sim/history.js';
import { FACTION_IDS } from '../sim/factions.js';
import { closeOf } from '../sim/festival.js';

// ------------------------------------------------------------ the contests
// v: the places it can be held at (the first the do has); slots: the parts
// of the day it can be held in; play: how it's played ('win' at a window;
// 'race' round the town; 'bout' with the champion; 'dish' handed in and
// judged); tries: goes each; max: the best that can be scored; low: the
// lower the better (a time).
export const CONTESTS = {
  archery: { name: 'the archery', short: 'ARCHERY', v: ['green'], slots: ['fair', 'feast'], play: 'win', tries: 2, max: 60, unit: 'points', glyph: '↑' },
  race: { name: 'the foot race', short: 'FOOT RACE', v: ['green'], slots: ['fair', 'feast'], play: 'race', tries: 1, low: true, unit: 's', glyph: '»' },
  wrestling: { name: 'the wrestling', short: 'WRESTLING', v: ['green'], slots: ['fair', 'feast'], play: 'bout', tries: 1, unit: '', glyph: '¤' },
  eating: { name: 'the eating match', short: 'EATING MATCH', v: ['alehouse'], slots: ['fair', 'feast', 'night'], play: 'win', tries: 1, max: 30, unit: 'plates', glyph: '○' },
  riddles: { name: 'the riddling', short: 'RIDDLES', v: ['alehouse'], slots: ['fair', 'night', 'feast'], play: 'win', tries: 1, max: 5, unit: 'right', glyph: '?' },
  dance: { name: 'the dance', short: 'THE DANCE', v: ['stage'], slots: ['feast'], play: 'win', tries: 3, max: 1000, unit: 'points', glyph: '♪' },
  cookoff: { name: 'the cook-off', short: 'COOK-OFF', v: ['stage'], slots: ['feast'], play: 'dish', tries: 1, max: 30, unit: 'points', glyph: '♨' },
  // (Phase 3) Each people's own, at its festivals only.
  hammer: { name: 'the bell-ringing', short: 'RING THE BELL', v: ['green', 'stage'], slots: ['fair', 'feast'], play: 'win', tries: 2, max: 100, unit: '', glyph: '♦', people: ['vale', 'ember', 'wild', 'sun', 'velari', 'kesh'] },
  logtoss: { name: 'the log toss', short: 'LOG TOSS', v: ['green', 'stage'], slots: ['fair', 'feast'], play: 'win', tries: 2, max: 60, unit: 'ft', glyph: '|', people: ['north', 'high', 'rime', 'corrow'] },
  raft: { name: 'the raft race', short: 'RAFT RACE', v: ['stalls', 'alehouse', 'stage'], slots: ['fair', 'feast'], play: 'win', tries: 2, max: 120, min: 18, low: true, unit: 's', glyph: '~', people: ['tide', 'salt', 'skerry'] },
  lantern: { name: 'the lantern walk', short: 'LANTERN WALK', v: ['shrine', 'stage'], slots: ['fair', 'feast', 'procession'], play: 'win', tries: 2, max: 100, unit: '', glyph: '*', people: ['mist', 'jade', 'wyrd', 'hollow'] },
};
export const CONTEST_KEYS = Object.keys(CONTESTS);
// (Round 130) At a pirates' haven's revel (see sim/havens.js): the bout's
// with cutlasses (blunted, mostly), the race is rowed in the ships' gigs,
// the eating match is drunk in grog, and the foot race run on the sand.
export const HAVEN_GAMES = {
  wrestling: { title: 'the cutlass bout', short: 'CUTLASS BOUT' },
  eating: { title: 'the grog match', short: 'GROG MATCH' },
  raft: { title: 'the gig race', short: 'GIG RACE' },
  race: { title: 'the beach run', short: 'BEACH RUN' },
};
// A contest of a day's, as it's called there.
export function contestOf(c) {
  const C = CONTESTS[c.k];
  return c.title ? { ...C, name: c.title, short: c.short || C.short } : C;
}

// What a winner's given (coin, by place; more in a bigger town).
const PURSE = [15, 8, 4];
const TIER = { village: 1, town: 1.5, city: 2.2 };
const PLACE_WORDS = ['first', 'second', 'third'];

// ------------------------------------------------------------ riddles
// Asked at the ale tables: the riddle, its answer, and three that aren't.
export const RIDDLES = [
  { q: 'What has roots nobody sees, is taller than trees; up, up it goes, and yet never grows?', a: 'A mountain', w: ['A tree', 'A tower', 'Smoke'] },
  { q: 'Thirty white horses on a red hill: now they champ, now they stamp, now they stand still.', a: 'Teeth', w: ['Clouds', 'Waves', 'Sheep'] },
  { q: 'The more you take, the more you leave behind.', a: 'Footsteps', w: ['Breath', 'Coins', 'Bread'] },
  { q: 'What can run but never walks, has a mouth but never talks, has a bed but never sleeps?', a: 'A river', w: ['A road', 'A clock', 'A hound'] },
  { q: 'Light as a feather, yet the strongest can\'t hold it for long.', a: 'Breath', w: ['A secret', 'A shadow', 'A song'] },
  { q: 'What has one eye, but cannot see?', a: 'A needle', w: ['A storm', 'A potato', 'A blind cat'] },
  { q: 'What gets wetter the more it dries?', a: 'A towel', w: ['Rain', 'Bread', 'A well'] },
  { q: 'Feed me and I live; give me a drink and I die.', a: 'Fire', w: ['A plant', 'A pig', 'A miser'] },
  { q: 'What has a neck but no head, and wears a cap?', a: 'A bottle', w: ['A ghost', 'A mushroom', 'A chicken'] },
  { q: 'Alive without breath, cold as death; never thirsty, ever drinking; clad in mail, never clinking.', a: 'A fish', w: ['A knight', 'A frog', 'A stone'] },
  { q: 'What goes on four legs in the morning, two at noon and three in the evening?', a: 'A person', w: ['A dog', 'A stool', 'A horse'] },
  { q: 'The one who makes it sells it; the one who buys it never uses it; the one who uses it never knows.', a: 'A coffin', w: ['A bed', 'A crown', 'A boot'] },
  { q: 'What has keys but opens no locks?', a: 'A harpsichord', w: ['A jailer', 'A map', 'A ring'] },
  { q: 'I am always coming, but I never arrive.', a: 'Tomorrow', w: ['The tide', 'A letter', 'Winter'] },
  { q: 'What belongs to you, but others use it more than you do?', a: 'Your name', w: ['Your purse', 'Your house', 'Your horse'] },
  { q: 'A box without hinges, key or lid, yet golden treasure inside is hid.', a: 'An egg', w: ['A nut', 'A hive', 'A grave'] },
  { q: 'What has a head and a tail but no body?', a: 'A coin', w: ['A snake', 'A comet', 'A rumour'] },
  { q: 'Voiceless it cries, wingless flutters, toothless bites, mouthless mutters.', a: 'The wind', w: ['A bat', 'A ghost', 'A fire'] },
  { q: 'What can fill a room but takes up no space?', a: 'Light', w: ['Air', 'Music', 'Dust'] },
  { q: 'The more there is of it, the less you see.', a: 'Darkness', w: ['Fog', 'Gold', 'Snow'] },
  { q: 'What runs round the whole yard without moving?', a: 'A fence', w: ['A dog', 'A path', 'A shadow'] },
  { q: 'What breaks when you say its name?', a: 'Silence', w: ['A vow', 'Glass', 'A spell'] },
  { q: 'I have cities but no houses, forests but no trees, and water but no fish.', a: 'A map', w: ['A dream', 'A painting', 'The sky'] },
  { q: 'What has many teeth but cannot bite?', a: 'A comb', w: ['A saw', 'A rake', 'An old dog'] },
  { q: 'Poor folk have it, rich folk need it, and if you eat it you die.', a: 'Nothing', w: ['Gold', 'Bread', 'Time'] },
  { q: 'What goes up when the rain comes down?', a: 'A brolly', w: ['The river', 'A kite', 'The price of ale'] },
];

// ------------------------------------------------------------ helpers
const nameOf = (r) => `${r.name.first} ${r.name.last}`;
const has = (r, t) => (r.traits || []).includes(t);
const roll = (L, ev, r, salt) => (hash4(L.settlement.seed, ev.id, r, salt) % 10000) / 10000;
const hm = (m) => `${String(Math.floor((m % DAY) / 60)).padStart(2, '0')}:${String(Math.floor(m % 60)).padStart(2, '0')}`;
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

// The middle of a place (the stage: the do's site).
function venueRect(ev, v) {
  if (v === 'stage') return ev.site || null;
  return (ev.venues || []).find((q) => q.id === v) || null;
}
export function venueOf(ev, c) {
  return venueRect(ev, c.v);
}
// Whether someone is at a place (or near enough to it).
export function nearVenue(ev, v, x, z, pad = 5) {
  const r = venueRect(ev, v);
  return !!r && x >= r.x0 - pad && x <= r.x1 + pad && z >= r.z0 - pad && z <= r.z1 + pad;
}

// How good someone is at a thing (0..1), by who they are: the guards and
// the hunters shoot straight, the young run fastest, the scholars know
// their riddles...
function skill(r, k) {
  const young = r.age === 'adult' ? 0.15 : r.age === 'elder' ? -0.25 : -0.1;
  const brave = has(r, 'brave') ? 0.12 : has(r, 'timid') ? -0.1 : 0;
  switch (k) {
    case 'archery': return clamp(0.35 + (['guard', 'trapper', 'adventurer'].includes(r.job) ? 0.35 : 0) + brave + (has(r, 'disciplined') ? 0.1 : 0) + (has(r, 'clumsy') ? -0.2 : 0), 0.05, 1);
    case 'race': return clamp(0.4 + young * 2 + (['fisher', 'farmer', 'laborer', 'guard', 'lumberjack'].includes(r.job) ? 0.15 : 0) + (has(r, 'lazy') ? -0.2 : 0) + (has(r, 'hardworking') ? 0.08 : 0), 0.05, 1);
    case 'wrestling': return clamp(0.35 + young + (['guard', 'blacksmith', 'miner', 'lumberjack', 'laborer', 'farmer'].includes(r.job) ? 0.3 : 0) + brave + (has(r, 'hot-headed') ? 0.08 : 0), 0.05, 1);
    case 'eating': return clamp(0.4 + (['cook', 'innkeeper', 'baker', 'laborer'].includes(r.job) ? 0.2 : 0) + (has(r, 'cheerful') ? 0.1 : 0) + (has(r, 'stingy') ? 0.1 : 0) + (r.age === 'child' ? -0.2 : 0), 0.05, 1);
    case 'riddles': return clamp(0.3 + (['scholar', 'priest', 'researcher', 'mayor', 'noble'].includes(r.job) ? 0.35 : 0) + (has(r, 'witty') || has(r, 'bookish') || has(r, 'curious') ? 0.2 : 0) + (has(r, 'absent-minded') ? -0.15 : 0) + (r.age === 'elder' ? 0.1 : 0), 0.05, 1);
    case 'dance': return clamp(0.4 + (has(r, 'outgoing') || has(r, 'cheerful') || has(r, 'romantic') ? 0.25 : 0) + (has(r, 'reserved') || has(r, 'gloomy') ? -0.2 : 0) + (has(r, 'clumsy') ? -0.25 : 0) + young * 0.5, 0.05, 1);
    case 'cookoff': return clamp(0.3 + (['cook', 'innkeeper', 'baker'].includes(r.job) ? 0.4 : 0) + (has(r, 'patient') || has(r, 'hardworking') ? 0.1 : 0), 0.05, 1);
    case 'hammer':
    case 'logtoss': return clamp(0.35 + young + (['blacksmith', 'miner', 'lumberjack', 'laborer', 'guard', 'farmer'].includes(r.job) ? 0.3 : 0) + brave * 0.5, 0.05, 1);
    case 'raft': return clamp(0.35 + young + (['fisher', 'pearldiver', 'laborer'].includes(r.job) ? 0.35 : 0) + (has(r, 'hardworking') ? 0.1 : 0), 0.05, 1);
    case 'lantern': return clamp(0.4 + (has(r, 'devout') || has(r, 'patient') || has(r, 'disciplined') ? 0.25 : 0) + (r.job === 'priest' ? 0.2 : 0) + (has(r, 'clumsy') || has(r, 'absent-minded') ? -0.2 : 0), 0.05, 1);
    default: return 0.4;
  }
}

// Who'd have a go (and wouldn't): of those at the do.
function wouldEnter(r, k) {
  if (!r || !alive(r) || r.away) return false;
  if (r.age === 'child') return k === 'race' || k === 'eating' || k === 'riddles';
  if (k === 'wrestling' || k === 'hammer' || k === 'logtoss') return r.age === 'adult';
  if (k === 'race' || k === 'raft') return r.age === 'adult';
  return true;
}

// A townsperson's score at a thing, as they'll make it.
function npcScore(L, ev, r, k, i) {
  const s = skill(r, k);
  const x = roll(L, ev, r.idx, 0x5c0 + i);
  const y = roll(L, ev, r.idx, 0x5c1 + i);
  const noisy = clamp(s + (x - 0.5) * 0.45, 0, 1);
  switch (k) {
    case 'archery': return Math.round(clamp(8 + noisy * 44 + (y - 0.5) * 6, 0, 60));
    case 'race': return Math.round((52 - noisy * 22 + (y - 0.5) * 6) * 10) / 10;
    case 'wrestling': return 0;
    case 'eating': return Math.round((3 + noisy * 9 + y * 1.5) * 10) / 10;
    case 'riddles': return Math.round(clamp(noisy * 5.2 - 0.4 + y * 0.6, 0, 5));
    case 'dance': return Math.round(clamp(250 + noisy * 620 + (y - 0.5) * 80, 0, 1000));
    case 'cookoff': return Math.round(clamp(9 + noisy * 17 + (y - 0.5) * 3, 3, 30));
    case 'hammer': return Math.round(clamp(30 + noisy * 68 + (y - 0.5) * 6, 10, 100));
    case 'logtoss': return Math.round(clamp(12 + noisy * 34 + (y - 0.5) * 4, 4, 58));
    case 'raft': return Math.round((60 - noisy * 28 + (y - 0.5) * 4) * 10) / 10;
    case 'lantern': return Math.round(clamp(35 + noisy * 60 + (y - 0.5) * 6, 10, 100));
    default: return 0;
  }
}

// ------------------------------------------------------------ setting it up
// The contests a do will have, where and when; who'll have a go of the
// townsfolk; the champion on the green; the race's course and runners.
// (Called once the guests have their days: see Events.invite.)
export function contestsFor(events, L, ev) {
  const prog = ev.prog || [];
  if (!prog.length || ev.rite === 'vigil') return;
  const out = {};
  const style = L.settlement.style || L.settlement.culture || 'vale';
  // (Round 130) A pirates' haven's revel: its own games.
  const haven = !!(L.settlement.haven && !L.settlement.haven.razed);
  for (const k of CONTEST_KEYS) {
    const C = CONTESTS[k];
    if (haven ? !HAVEN_GAMES[k] : C.people && !C.people.includes(style)) continue;
    let slot = null;
    let v = null;
    for (const sk of C.slots) {
      for (const q of prog) {
        if (q.k !== sk) continue;
        const at = C.v.find((x) => q.venues.includes(x));
        if (at) {
          slot = q;
          v = at;
          break;
        }
      }
      if (slot) break;
    }
    if (!slot || !venueRect(ev, v)) continue;
    // (The cook-off: dishes taken in all day, judged an hour into the
    // feast. The race: run three quarters of an hour before the end.)
    const len = slot.to - slot.from;
    const c = { k, v, slot: slot.k, from: slot.from + Math.min(10, Math.floor(len / 8)), to: slot.to - Math.min(8, Math.floor(len / 10)), entries: [], tries: {}, open: {}, npc: [], done: false, places: [] };
    if (k === 'cookoff') {
      c.from = Math.min(...prog.map((q) => q.from));
      c.at = slot.from + Math.min(70, Math.floor(len * 0.4));
      c.to = c.at;
    }
    if (k === 'race') {
      c.at = slot.to - Math.min(50, Math.floor(len / 3));
      c.to = c.at;
      c.from = slot.from;
      c.course = courseFor(events, L, ev, venueRect(ev, v));
      if (!c.course) continue;
    }
    if (k === 'dance' || k === 'eating' || k === 'riddles') c.from = slot.from + Math.min(20, Math.floor(len / 6));
    if (c.to - c.from < 20) continue;
    if (haven) Object.assign(c, HAVEN_GAMES[k]);
    out[k] = c;
  }
  if (!Object.keys(out).length) return;
  ev.contests = out;
  // The townsfolk who'll have a go: of those at the place then (else
  // anyone at the do), the keenest few.
  const guests = (ev.guests || []).map((g) => L.npcs[g.idx]).filter(Boolean);
  const takenBy = new Set();
  for (const k of Object.keys(out)) {
    const c = out[k];
    const atIt = (ev.guests || []).filter((g) => (g.segs || []).some((q) => q.v === c.v && q.from < c.to && q.to > c.from)).map((g) => L.npcs[g.idx]).filter(Boolean);
    const pool = (atIt.length >= 4 ? atIt : guests).filter((r) => wouldEnter(r, k) && r.idx !== ev.host);
    pool.sort((a, b) => skill(b, k) + roll(L, ev, b.idx, 0x7a0) * 0.5 - (skill(a, k) + roll(L, ev, a.idx, 0x7a0) * 0.5));
    const n = k === 'wrestling' ? 3 : k === 'cookoff' ? 3 : 4;
    // (Not the same few in everything: those not in another first.)
    const picked = [...pool.filter((r) => !takenBy.has(r.idx)), ...pool.filter((r) => takenBy.has(r.idx))].slice(0, n);
    for (const r of picked) takenBy.add(r.idx);
    c.npc = picked.map((r, i) => ({ who: `npc:${r.idx}`, idx: r.idx, name: nameOf(r), score: npcScore(L, ev, r, k, 0), at: c.from + Math.floor(((i + 1) / (picked.length + 1)) * Math.max(10, (c.at || c.to) - c.from)) }));
    if (k === 'cookoff') c.npc.forEach((q, i) => {
      const dishes = dishesOf(L.settlement);
      q.dish = dishes[i % dishes.length] || 'stew';
    });
  }
  // The champion of the green: the strongest who'll stand in the ring.
  const w = out.wrestling;
  if (w) {
    const cands = guests.filter((r) => r.age === 'adult' && alive(r) && !r.away && r.idx !== ev.host && !(w.npc || []).some((q) => q.idx === r.idx));
    cands.sort((a, b) => skill(b, 'wrestling') - skill(a, 'wrestling'));
    const champ = cands[0];
    if (!champ) delete out.wrestling;
    else {
      w.champ = champ.idx;
      w.champName = nameOf(champ);
      const g = (ev.guests || []).find((q) => q.idx === champ.idx);
      const V = designOf(venueRect(ev, 'green'));
      const r = venueRect(ev, 'green');
      const ring = V.ring || V.games;
      if (g && r && ring) addSeg(g, { k: 'games', v: 'green', from: w.from - 10, to: w.to, role: 'lead', x: r.x0 + ring.dx, z: r.z0 + ring.dz, face: 2, champ: true });
      // (They've beaten everyone who's tried, so far.)
      for (const q of w.npc) q.score = 0;
    }
  }
  // The race: the runners to the line ten minutes before, then off round
  // the course.
  const rc = out.race;
  if (rc) {
    const line = rc.course[0];
    rc.npc.forEach((q, i) => {
      const g = (ev.guests || []).find((x) => x.idx === q.idx);
      if (!g) return;
      const pace = clamp(0.62 - skill(L.npcs[q.idx], 'race') * 0.12 + (roll(L, ev, q.idx, 0x7ac) - 0.5) * 0.04, 0.48, 0.66);
      addSeg(g, { k: 'race', v: 'green', from: rc.at - 10, to: rc.at, role: 'line', x: line.x + (i % 2 ? 1 : -1) * Math.ceil(i / 2), z: line.z, face: 2 });
      addSeg(g, { k: 'race', v: 'green', from: rc.at, to: rc.at + 150, role: 'run', walk: [...rc.course.slice(1), line], race: true, pace });
      q.at = null;
    });
  }
}

// A part of someone's day put in (what's there then is cut round it).
function addSeg(g, seg) {
  g.segs ||= [];
  g.segs.push(seg);
  g.segs.sort((a, b) => a.from - b.from);
  g.leave = Math.min(g.leave ?? seg.from, seg.from);
  g.until = Math.max(g.until ?? seg.to, seg.to);
}

// The race's course: from the green, round by the square and a few of the
// roads in and the buildings everyone knows, and back. Each a spot on the
// street to run past.
function courseFor(events, L, ev, green) {
  if (!green) return null;
  const V = designOf(green);
  const line = V.line && V.line.length ? V.line[Math.floor(V.line.length / 2)] : { dx: Math.floor(V.w / 2), dz: V.d };
  const start = { x: green.x0 + line.dx, z: green.z0 + line.dz };
  const w = events.game.world;
  const open = (x, z) => L.inside(x, z, 2) && [M.ROAD, M.PLAZA, M.FREE, M.YARD].includes(L.maskAt(x, z)) && (!w.regionAt(x, z) || w.findStandY(x, z, GROUND) === GROUND);
  const near = (x, z) => {
    for (let r = 0; r <= 3; r++) for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) if (open(x + dx, z + dz)) return { x: x + dx, z: z + dz };
    return null;
  };
  const p = L.plaza;
  const cands = [];
  const put = (x, z, label) => {
    const q = near(x, z);
    if (q && Math.hypot(q.x - start.x, q.z - start.z) > 8) cands.push({ ...q, label });
  };
  put(p.cx, p.cz, 'the square');
  for (const e of L.entrances || []) put(Math.round((e.x * 2 + p.cx) / 3), Math.round((e.z * 2 + p.cz) / 3), 'the road in');
  for (const t of ['tavern', 'temple', 'townhall', 'smithy', 'shop', 'bakery', 'well']) {
    const b = L.buildings.find((q) => q.type === t && q.outside && !q.ruined);
    if (b) put(b.outside.x, b.outside.z, `the ${t === 'townhall' ? 'hall' : t}`);
  }
  if (cands.length < 2) return null;
  // Round the town the one way: by the angle about the square, from the
  // start's own; three or four stops a good way apart.
  const ang = (q) => Math.atan2(q.z - p.cz, q.x - p.cx);
  const a0 = ang(start);
  const rel = (q) => ((ang(q) - a0 + Math.PI * 4) % (Math.PI * 2));
  cands.sort((a, b) => rel(a) - rel(b));
  const stops = [];
  for (const q of cands) {
    if (stops.some((s) => Math.hypot(s.x - q.x, s.z - q.z) < 10)) continue;
    if (Math.hypot(q.x - p.cx, q.z - p.cz) > 34) continue;
    stops.push(q);
  }
  const pickN = Math.min(4, stops.length);
  const chosen = [];
  for (let i = 0; i < pickN; i++) chosen.push(stops[Math.floor((i * stops.length) / pickN)]);
  if (chosen.length < 2) return null;
  return [{ ...start, label: 'the green' }, ...chosen];
}

// ------------------------------------------------------------ what's on
// The contests open now (at a place, if `v`).
export function openNow(ev, now, v = null) {
  const out = [];
  for (const c of Object.values(ev.contests || {})) {
    if (c.done || now < c.from || now >= c.to) continue;
    if (v && c.v !== v) continue;
    out.push(c);
  }
  return out;
}

// The standings: the players' best goes and the townsfolk's (those who've
// had theirs), best first.
export function standings(c, now = Infinity) {
  const C = contestOf(c);
  const best = new Map();
  for (const q of [...c.entries, ...c.npc.filter((n) => n.at !== null && n.at <= now && C.play !== 'race')]) {
    if (q.score === null || q.score === undefined) continue;
    const was = best.get(q.who);
    if (!was || (C.low ? q.score < was.score : q.score > was.score)) best.set(q.who, q);
  }
  const list = [...best.values()];
  if (C.play === 'bout' && c.champ !== undefined) list.push({ who: `npc:${c.champ}`, name: c.champName, score: 500, champ: true });
  list.sort((a, b) => (C.low ? a.score - b.score : b.score - a.score) || (a.t || 0) - (b.t || 0));
  return list;
}

export function scoreText(c, q) {
  const C = contestOf(c);
  if (C.play === 'bout') return q.champ ? 'champion' : q.score > 0 ? 'beat the champion' : 'thrown';
  if (C.unit === 's') return `${q.score.toFixed(1)}s`;
  if (c.k === 'eating') return `${q.score.toFixed(1)} plates`;
  if (c.k === 'logtoss') return `${q.score} ft`;
  if (c.k === 'riddles') return `${q.score} of 5`;
  return `${q.score}`;
}

// What the board says of each: when, where, the best so far.
export function boardRows(L, ev, now, pid = null) {
  const rows = [];
  for (const k of CONTEST_KEYS) {
    const c = ev.contests && ev.contests[k];
    if (!c) continue;
    const C = contestOf(c);
    const st = c.done ? 'done' : now < c.from ? 'soon' : now < c.to ? 'open' : 'closing';
    const when = C.play === 'race' ? `starts ${hm(c.at)}` : C.play === 'dish' ? `judged ${hm(c.at)}` : st === 'soon' ? `from ${hm(c.from)}` : st === 'open' ? `till ${hm(c.to)}` : '';
    const used = pid ? c.tries[pid] || 0 : 0;
    const entered = pid ? (C.play === 'race' ? !!(c.runners && c.runners[pid]) : C.play === 'dish' ? c.entries.some((q) => q.who === `pl:${pid}`) : used > 0) : false;
    rows.push({
      k, name: C.short, where: c.v === 'stage' ? 'the square' : VENUES[c.v].name.replace(/^the /, ''), when, st,
      top: (c.done ? c.places : standings(c, now)).slice(0, 3).map((q) => ({ name: q.name, score: scoreText(c, q), you: q.who === `pl:${pid}` })),
      left: Math.max(0, C.tries - used), entered,
    });
  }
  return rows;
}

// ------------------------------------------------------------ having a go
// A player asks to have a go at `k` (as themselves: under their seat).
// What's said back, if anything (the window opens itself).
export function enter(game, L, ev, k) {
  const c = ev.contests && ev.contests[k];
  const C = c ? contestOf(c) : CONTESTS[k];
  const p = game.player;
  if (!c || !C || !p) return 'There\'s no such contest today.';
  const pid = pidOf(p);
  const now = game.sim.abs;
  if (c.done) return `${cap(C.name)}'s over for today.`;
  if (now < c.from) return `${cap(C.name)} isn't till ${hm(c.from)}.`;
  if (now >= c.to) return `${cap(C.name)}'s closed now.`;
  const where = venueName(c.v);
  // The race: put your name down, and be at the line.
  if (C.play === 'race') {
    c.runners ||= {};
    if (c.runners[pid]) return `You're down for the race. Be on the line at the green by ${hm(c.at)}.`;
    c.runners[pid] = { i: 0, t: null, name: playerName(game, pid) };
    return `Your name's down for the foot race! Be on the line at the green by ${hm(c.at)}: ${c.course.length - 1} marks round the town (they're on your little map), and back.`;
  }
  if (!nearVenue(ev, c.v, p.x, p.z, 6)) return `${cap(C.name)}'s at ${where}. Go there to have a go.`;
  const used = c.tries[pid] || 0;
  if (used >= C.tries) return C.tries > 1 ? `You've had your ${C.tries} goes at ${C.name}.` : `You've had your go at ${C.name}.`;
  if (C.play === 'dish') {
    const key = p.heldItem();
    const it = key ? ITEMS[key] : null;
    if (!it || it.kind !== 'food') return 'Hold the dish you want to put in for the cook-off (in your hand), and ask again.';
    removeItem(p.inv, key, 1);
    c.tries[pid] = 1;
    c.entries.push({ who: `pl:${pid}`, pid, name: playerName(game, pid), score: null, dish: key, t: now });
    return `Your ${it.name} goes on the judges' table. They'll judge it at ${hm(c.at)}, on the square.`;
  }
  if (C.play === 'bout') {
    const champ = L.npcs[c.champ];
    const e = champ && champ.ent;
    if (!e || e.dead || !alive(champ)) return 'The champion\'s not here just now.';
    if (e.distTo(p) > 12) return `${c.champName} is the champion: find them in the ring on the green.`;
    if (game.duel) return 'You\'re in a bout already!';
    c.tries[pid] = 1;
    game.startDuel(e, 0, { fest: { sid: L.settlement.id, ev: ev.id, k, start: game.sim.abs } });
    return null;
  }
  // At a window.
  const token = (Math.random() * 1e9) | 0;
  const cfg = windowCfg(game, L, ev, c, token);
  c.open[pid] = { token, at: now, ...(cfg.answers ? { answers: cfg.answers } : {}) };
  delete cfg.answers;
  c.tries[pid] = used + 1;
  game.openFest(cfg);
  return null;
}

// What the window's to show: the place, the time of day, the weather,
// the rivals, and what's to be played.
function windowCfg(game, L, ev, c, token) {
  const s = L.settlement;
  const C = contestOf(c);
  const seed = hash4(s.seed, ev.id, token, 0xf35);
  const rows = standings(c, game.sim.abs).slice(0, 5).map((q) => ({ name: q.name, score: scoreText(c, q) }));
  const cfg = {
    kind: c.k, token, seed, sid: s.id, ev: ev.id, title: C.short, town: s.name, style: s.style || s.culture || 'vale',
    hour: (game.minute || 0) / 60, wet: !!ev.wet, board: rows, tries: C.tries - (c.tries[pidOf(game.player)] || 0),
    look: game.player.look,
  };
  if (c.k === 'archery') {
    // The wind on the green (as on the water: see ships3d.js windOf).
    const w = game.weather || {};
    const gust = w.kind === 'storm' ? 1 : w.kind === 'rain' ? 0.6 : 0.3;
    cfg.wind = { x: Math.round(((hash4(seed, 1) % 2000) / 1000 - 1) * gust * 100) / 100, gust };
  }
  if (c.k === 'eating') {
    const dishes = dishesOf(s);
    cfg.food = dishes[hash4(seed, 2) % dishes.length] || 'stew';
    cfg.rivals = rivalsFor(game, L, c, 2).map((q) => ({ name: q.name, plates: q.score, look: q.look }));
  }
  if (c.k === 'raft') cfg.rivals = rivalsFor(game, L, c, 2).map((q) => ({ name: q.name, time: q.score, look: q.look }));
  if (c.k === 'riddles') {
    const pool = RIDDLES.map((_, i) => i);
    const picks = [];
    for (let i = 0; i < 5; i++) {
      const j = hash4(seed, 3, i) % pool.length;
      picks.push(pool.splice(j, 1)[0]);
    }
    cfg.items = [];
    cfg.answers = [];
    for (const i of picks) {
      const R = RIDDLES[i];
      const opts = [R.a, ...R.w];
      // (In an order of its own.)
      for (let a = opts.length - 1; a > 0; a--) {
        const b = hash4(seed, 4, i, a) % (a + 1);
        [opts[a], opts[b]] = [opts[b], opts[a]];
      }
      cfg.items.push({ q: R.q, opts });
      cfg.answers.push(opts.indexOf(R.a));
    }
    // (For the crowd's "Aye!": the answers, not in plain sight. The host
    // checks the picks against its own.)
    cfg.chk = cfg.answers.map((a, i) => (a + ((seed >>> (i * 3)) & 3)) % 4);
    const keep = (ev.guests || []).map((g) => L.npcs[g.idx]).find((r) => r && ['innkeeper', 'barkeep', 'cook'].includes(r.job));
    cfg.riddler = keep ? { name: keep.name.first, look: keep.look } : null;
  }
  if (c.k === 'dance') {
    cfg.tempo = 112 + (hash4(seed, 5) % 24);
    cfg.secs = 42;
  }
  return cfg;
}

// Who you're up against at the table (or on the water): whoever else is
// playing who's had a go already (their best), then the townsfolk.
function rivalsFor(game, L, c, n) {
  const me = `pl:${pidOf(game.player)}`;
  const C = contestOf(c);
  const best = new Map();
  for (const q of c.entries) {
    if (q.who === me || !q.who.startsWith('pl:') || q.score === null) continue;
    const was = best.get(q.who);
    if (!was || (C.low ? q.score < was.score : q.score > was.score)) best.set(q.who, q);
  }
  const out = [...best.values()].map((q) => {
    const p = playerOf(game, q.who.slice(3));
    return { name: q.name, score: q.score, look: p ? p.look : null };
  });
  for (const q of c.npc) out.push({ name: q.name, score: q.score, look: (L.npcs[q.idx] || {}).look || null });
  return out.slice(0, n);
}

// How a player did, sent back by the window (theirs, or their own screen's
// in someone else's world). `res`: { token, score } (the riddles: picks).
// Checked: their go, and a score that could be had.
export function result(game, L, ev, k, res) {
  const c = ev.contests && ev.contests[k];
  const C = CONTESTS[k];
  const p = game.player;
  if (!c || !C || !p || !res) return null;
  const pid = pidOf(p);
  const open = c.open[pid];
  if (!open || open.token !== res.token) return null;
  delete c.open[pid];
  let score;
  if (k === 'riddles') {
    const picks = Array.isArray(res.picks) ? res.picks : [];
    score = (open.answers || []).reduce((n, a, i) => n + (picks[i] === a ? 1 : 0), 0);
  } else score = clamp(Math.round((+res.score || 0) * 10) / 10, 0, C.max);
  // (A crossing quicker than could be: as if it never finished.)
  if (C.low && score < (C.min || 0)) score = C.max;
  // (Too quick a go to be true: nothing.)
  if (game.sim.abs - open.at < 5 && k !== 'riddles') score = C.low ? C.max : 0;
  // (Late in: still counted, if it was begun before the close.)
  if (c.done) return { score, late: true };
  c.entries.push({ who: `pl:${pid}`, pid, name: playerName(game, pid), score, t: game.sim.abs });
  const list = standings(c, game.sim.abs);
  const place = list.findIndex((q) => q.who === `pl:${pid}`) + 1;
  // A cheer from whoever's watching.
  cheer(game, L, ev, c, place);
  return { score, place, board: list.slice(0, 5).map((q) => ({ name: q.name, score: scoreText(c, q), you: q.who === `pl:${pid}` })) };
}

// The crowd at the place calls out (a good go, a poor one).
function cheer(game, L, ev, c, place) {
  const p = game.player;
  const near = (game.npcs || []).filter((n) => !n.dead && n.rec && n.distTo(p) < 10 && n.say);
  const n = near[Math.floor(Math.random() * near.length)];
  if (!n) return;
  const line = place === 1 ? ['Bravo! Best yet!', 'Ha! Beat that, then!', 'That\'s the one to beat!'] : place && place <= 3 ? ['Well done!', 'Not bad at all!', 'Good effort!'] : ['Unlucky!', 'Next time!', 'Ha! Better luck tomorrow.'];
  n.say(line[Math.floor(Math.random() * line.length)], 2.6, '#ffe8a0');
}

// The bout with the champion's done (see Game.endDuel).
export function boutDone(game, d, outcome) {
  const f = d && d.fest;
  if (!f) return;
  const L = game.sim.layoutOf ? game.sim.layoutOf(f.sid) : null;
  const ev = L && (L.econ.events || []).find((q) => q.id === f.ev);
  const c = ev && ev.contests && ev.contests.wrestling;
  if (!c) return;
  const pid = pidOf(game.player);
  const secs = Math.max(1, game.sim.abs - f.start);
  const won = outcome === 'won';
  c.entries.push({ who: `pl:${pid}`, pid, name: playerName(game, pid), score: won ? Math.max(501, 1000 - secs) : 0, t: game.sim.abs, won });
  if (won) {
    c.beaten = (c.beaten || 0) + 1;
    game.sim.events.tellTown(L, `${playerName(game, pid)} has thrown ${c.champName}, the champion of the green!`, '#ffe070');
  }
}

// ------------------------------------------------------------ as time goes
// (Twice a second, in a town someone's in.) The townsfolk's goes, the
// race's start, the judging, and each contest closed at its time.
export function tick(events, L, ev, now) {
  for (const c of Object.values(ev.contests || {})) {
    if (c.done) continue;
    const C = contestOf(c);
    // A townsperson has their go: said, by them, if anyone's watching.
    for (const q of c.npc) {
      if (q.said || q.at === null || q.at === undefined || now < q.at) continue;
      q.said = true;
      // (The ale spiked: whoever has their go at the ale tables after does
      // worse for it.)
      if (c.v === 'alehouse' && ev.spiked && q.at >= ev.spiked.at && q.at < ev.spiked.until + 60) q.score = c.k === 'riddles' ? Math.max(0, q.score - 2) : Math.round(q.score * 6.5) / 10;
      const e = L.npcs[q.idx] && L.npcs[q.idx].ent;
      if (e && !e.dead && e.say && C.play !== 'dish') e.say(C.play === 'bout' ? 'Oof! You\'re too strong for me!' : q.score >= (C.max || 1) * 0.6 ? 'Ha! Beat that!' : 'Not my best...', 2.4, '#ffe8a0');
    }
    if (C.play === 'race') raceTick(events, L, ev, c, now);
    else if (C.play === 'dish' && now >= c.at) judge(events, L, ev, c);
    else if (now >= c.to) close(events, L, ev, c);
  }
}

// Somewhere the do's been and gone with nobody there: whatever's left, closed.
export function closeAll(events, L, ev) {
  for (const c of Object.values(ev.contests || {})) {
    if (c.done) continue;
    if (CONTESTS[c.k].play === 'dish') judge(events, L, ev, c);
    else close(events, L, ev, c);
  }
}

// The places and the prizes, and called out round the town.
function close(events, L, ev, c) {
  if (c.done) return;
  c.done = true;
  const game = events.game;
  const C = contestOf(c);
  // (A race nobody saw: the townsfolk's times, as they'd have run it.)
  if (C.play === 'race') for (const q of c.npc) if (!c.entries.some((e) => e.who === q.who) && !(c.race && c.race.go)) c.entries.push({ ...q, t: q.score });
  const list = standings(c, Infinity).filter((q) => C.play !== 'bout' || q.champ || q.score > 0);
  c.places = list.slice(0, 3).map((q) => ({ who: q.who, name: q.name, score: q.score }));
  if (!c.places.length) return;
  const s = L.settlement;
  const mul = TIER[s.type] || 1;
  c.places.forEach((q, i) => {
    if (q.who.startsWith('pl:')) {
      const pid = q.who.slice(3);
      const seat = seatOfPid(game, pid);
      const give = () => prize(game, L, ev, c, i, Math.round(PURSE[i] * mul));
      if (seat) asSeat(game, seat, give);
      else if (pid === 'host') give();
    } else {
      const r = L.npcs[+q.who.slice(4)];
      if (r) r.mood = Math.min(1, (r.mood ?? 0.5) + 0.15 - i * 0.04);
    }
  });
  const [a, b, d] = c.places;
  const word = (q) => `${q.name}${C.play === 'bout' ? '' : ` (${scoreText(c, q)})`}`;
  const text = C.play === 'bout'
    ? (a.champ ? `${c.champName} is still the champion of the green: nobody could throw them today.` : `${a.name} is the new champion of the green!`)
    : `${cap(C.name)} goes to ${word(a)}${b ? `, then ${word(b)}` : ''}${d ? ` and ${word(d)}` : ''}.`;
  events.tellTown(L, text, '#ffe070');
  ledger(L, ev.day, text);
  (ev.champs ||= []).push({ k: c.k, name: a.name, who: a.who });
}

// A player placed: their purse and their rosette, and the town's good word.
function prize(game, L, ev, c, i, coins) {
  const p = game.player;
  if (!p) return;
  const C = contestOf(c);
  const left = p.give('coin', coins);
  if (left) game.spawnDrop('coin', left, p.x, p.y, p.z, true);
  const key = prizeKey(c.k, i + 1, yearOf(game.day), L.settlement.name);
  const left2 = p.give(key, 1);
  if (left2) game.spawnDrop(key, left2, p.x, p.y, p.z, true);
  game.ui.msg(`You came ${PLACE_WORDS[i]} in ${C.name}! ¤${coins} and a rosette.`, '#ffe070');
  game.audio?.play(i === 0 ? 'fanfare' : 'coin');
  const sid = L.settlement.id;
  if (ev.host !== null && ev.host !== undefined && L.npcs[ev.host]) game.sim.events.bump(sid, L.npcs[ev.host], 3 - i);
  if (i === 0) game.sim.addRenown(sid, 2, `winning ${C.name} at the festival`);
}

// ------------------------------------------------------------ the race
function raceTick(events, L, ev, c, now) {
  const game = events.game;
  const starter = (() => {
    const r = ev.host !== null && ev.host !== undefined ? L.npcs[ev.host] : null;
    return r && r.ent && !r.ent.dead ? r.ent : null;
  })();
  if (!c.race) {
    if (now >= c.at - 10 && !c.told) {
      c.told = true;
      events.tellTown(L, `The foot race starts at the green at ${hm(c.at)}! Runners to the line.`, '#ffe070');
    }
    // The count, then they're off.
    const left = Math.ceil(c.at - now);
    if (left >= 1 && left <= 3 && c.count !== left) {
      c.count = left;
      for (const pid of Object.keys(c.runners || {})) {
        const p = playerOf(game, pid);
        if (p && nearVenue(ev, 'green', p.x, p.z, 8)) game.asPlayer(p, () => {
          game.ui.msg(`${left}...`, '#ffe070');
          game.audio?.play('select');
        });
      }
    }
    if (now < c.at) return;
    c.race = { go: true, clock: 0, runners: {} };
    const line = c.course[0];
    for (const [pid, q] of Object.entries(c.runners || {})) {
      const p = playerOf(game, pid);
      if (!p || p.dead) continue;
      const at = Math.hypot(p.x - line.x, p.z - line.z) <= 6;
      game.asPlayer(p, () => {
        if (!at) game.ui.msg('The race has started without you: you weren\'t at the line on the green.', '#ffb080');
        else {
          game.ui.msg('GO! Run for the first mark (on your little map)!', '#ffe070');
          game.audio?.play('fanfare');
        }
      });
      if (at) c.race.runners[pid] = { i: 1, t: null, name: q.name, lx: p.x, lz: p.z };
    }
    if (starter && starter.say) starter.say('Ready... GO!', 2.5, '#ffe070');
    return;
  }
  // All home (or long enough): the places.
  const R = c.race;
  const runners = Object.values(R.runners);
  const npcLeft = c.npc.filter((q) => !c.entries.some((e) => e.who === q.who)).length;
  if ((runners.every((q) => q.t !== null) && (npcLeft === 0 || R.clock > 120)) || R.clock > 200 || now > c.at + 150) close(events, L, ev, c);
}

// (Each frame.) The runners past each mark, and home.
export function raceFrame(game, dt) {
  for (const { layout: L } of game.active.values()) {
    for (const ev of L.econ.events || []) {
      const c = ev.contests && ev.contests.race;
      if (!c || c.done || !c.race || !c.race.go) continue;
      c.race.clock += dt;
      for (const [pid, q] of Object.entries(c.race.runners)) {
        if (q.t !== null) continue;
        const p = playerOf(game, pid);
        if (!p || p.dead) continue;
        if (p.mount) {
          q.t = -1;
          game.asPlayer(p, () => game.ui.msg('No riding in the foot race! You\'re out.', '#ffb080'));
          continue;
        }
        const mark = q.i < c.course.length ? c.course[q.i] : c.course[0];
        // (Past it this frame, however fast you went.)
        if (segDist(q.lx, q.lz, p.x, p.z, mark.x + 0.5, mark.z + 0.5) <= 2.6) {
          q.i++;
          const n = c.course.length;
          if (q.i > n) {
            q.t = Math.round(c.race.clock * 10) / 10;
            c.entries.push({ who: `pl:${pid}`, pid, name: q.name, score: q.t, t: game.sim.abs });
            const list = standings(c);
            const place = list.findIndex((e) => e.who === `pl:${pid}`) + 1;
            game.asPlayer(p, () => {
              game.ui.msg(`Home in ${q.t.toFixed(1)}s! (${place ? `${PLACE_WORDS[place - 1] || `${place}th`} so far` : 'well run'})`, '#ffe070');
              game.audio?.play('fanfare');
            });
          } else game.asPlayer(p, () => {
            game.ui.msg(q.i === n ? 'Last mark! Now back to the green!' : `Mark ${q.i - 1} of ${n - 1}! On to the next.`, '#ffe8a0');
            game.audio?.play('coin');
          });
        }
        q.lx = p.x;
        q.lz = p.z;
      }
    }
  }
}

function segDist(ax, az, bx, bz, px, pz) {
  const dx = bx - ax;
  const dz = bz - az;
  const l = dx * dx + dz * dz;
  const t = l ? clamp(((px - ax) * dx + (pz - az) * dz) / l, 0, 1) : 0;
  return Math.hypot(ax + dx * t - px, az + dz * t - pz);
}

// A townsperson home from the race (see NPC.atEvent).
export function npcFinished(L, ev, idx) {
  const c = ev.contests && ev.contests.race;
  if (!c || c.done || !c.race || !c.race.go) return;
  const q = c.npc.find((n) => n.idx === idx);
  if (!q || c.entries.some((e) => e.who === q.who)) return;
  c.entries.push({ who: q.who, idx, name: q.name, score: Math.round(c.race.clock * 10) / 10 });
}

// Where a runner's to run next (for the little map and the corner of the
// screen).
export function raceState(L, ev, pid, now) {
  const c = ev.contests && ev.contests.race;
  if (!c || c.done) return null;
  const mine = c.runners && c.runners[pid];
  if (!mine) return null;
  if (!c.race) return now >= c.at - 15 ? { wait: true, at: c.at, line: c.course[0] } : null;
  const q = c.race.runners[pid];
  if (!q || q.t !== null) return null;
  const n = c.course.length;
  const mark = q.i < n ? c.course[q.i] : c.course[0];
  return { mark, i: q.i, n, clock: c.race.clock, home: q.i >= n };
}

// ------------------------------------------------------------ the cook-off
// Each dish tasted by the three judges, a card each held up.
function judge(events, L, ev, c) {
  if (c.done) return;
  const game = events.game;
  const s = L.settlement;
  const mine = new Set(dishesOf(s));
  const judges = judgesOf(L, ev);
  const cards = (key, i) => {
    const it = ITEMS[key];
    const local = mine.has(key);
    let base = 3;
    if (it) {
      base = 2.5 + Math.min(4, (it.heal || 0) / 2.5) + Math.min(2, (it.value || 0) / 10);
      if (it.dish) base += Math.min(2, (it.dish.effects || []).filter((e) => e.good).length * 0.8);
      if (/^raw_|^raw/.test(key)) base = 1;
    }
    if (local) base += 1.5;
    if (it && forbiddenFood(s, key)) base = 0.5;
    return judges.map((j, n) => Math.round(clamp(base + ((hash4(s.seed, ev.id, i, n, 0xc00) % 1000) / 1000 - 0.5) * 2.2 + (j.harsh ? -0.6 : 0), 1, 10)));
  };
  // The townsfolk's dishes, and the players'.
  const plates = [];
  c.npc.forEach((q, i) => {
    const sc = cards(q.dish, 100 + i);
    // (Their own cooking, as good as they are.)
    const adj = Math.round((q.score - 18) / 6);
    const fixed = sc.map((v) => clamp(v + adj, 1, 10));
    plates.push({ who: q.who, name: q.name, dish: q.dish, cards: fixed });
  });
  c.entries.forEach((q, i) => {
    plates.push({ who: q.who, name: q.name, dish: q.dish, cards: cards(q.dish, i) });
  });
  for (const pl of plates) pl.score = pl.cards.reduce((a, b) => a + b, 0);
  // (Into the entries, the townsfolk's too, for the standings.)
  c.entries = plates.map((pl) => ({ who: pl.who, name: pl.name, score: pl.score, dish: pl.dish, cards: pl.cards }));
  c.npc = [];
  c.judged = plates;
  close(events, L, ev, c);
  // Shown to whoever's on the square, or put a dish in.
  const order = [...plates].sort((a, b) => b.score - a.score);
  const cfg = {
    kind: 'cookoff', seed: hash4(s.seed, ev.id, 0xc0c), sid: s.id, ev: ev.id, title: 'COOK-OFF', town: s.name, style: s.style || s.culture || 'vale', hour: (game.minute || 0) / 60, wet: !!ev.wet,
    judges: judges.map((j) => ({ name: j.name, look: j.look })),
    plates: plates.map((pl) => ({ name: pl.name, dish: pl.dish, dishName: (ITEMS[pl.dish] && ITEMS[pl.dish].name) || pl.dish, cards: pl.cards, who: pl.who })),
    winner: order[0] ? order[0].name : null,
  };
  for (const p of game.everyone()) {
    const pid = pidOf(p);
    const entered = plates.some((pl) => pl.who === `pl:${pid}`);
    if (!entered && !nearVenue(ev, 'stage', p.x, p.z, 14)) continue;
    game.asPlayer(p, () => game.openFest({ ...cfg, you: `pl:${pid}` }));
  }
}

// The cook-off's three judges: the host, and two of the town's
// best-known (the priest, the innkeeper, an elder).
function judgesOf(L, ev) {
  const out = [];
  const add = (r, harsh = false) => {
    if (r && alive(r) && !out.some((q) => q.idx === r.idx)) out.push({ idx: r.idx, name: nameOf(r), look: r.look, harsh });
  };
  if (ev.host !== null && ev.host !== undefined) add(L.npcs[ev.host]);
  for (const job of ['priest', 'innkeeper', 'cook', 'mayor', 'noble', 'baker']) {
    if (out.length >= 3) break;
    add(L.npcs.find((r) => r.job === job && alive(r) && !r.away), job === 'innkeeper' || job === 'cook');
  }
  for (const r of L.npcs) {
    if (out.length >= 3) break;
    if (r.age === 'elder') add(r, has(r, 'gruff'));
  }
  while (out.length < 3) out.push({ idx: -1, name: ['Old Tam', 'Widow Pell', 'Gaffer Rook'][out.length], look: null, harsh: out.length === 1 });
  return out.slice(0, 3);
}

// ------------------------------------------------------------ the prizes
const hex = (s) => [...new globalThis.TextEncoder().encode(String(s).slice(0, 24))].map((b) => b.toString(16).padStart(2, '0')).join('');
// "prize~<contest>~<place>~<year>~<the town, in hex>" (see world/items.js).
export function prizeKey(k, place, year, town) {
  return `prize~${k}~${place}~${year}~${hex(town)}`;
}

// ------------------------------------------------------------ music
// A player playing for the crowd by the square or the ale tables: now and
// then a coin tossed their way, the crowd's thanks, and the town's.
export function music(game, p) {
  const s = game.currentSettlement;
  const a = s && game.active.get(s.id);
  if (!a) return;
  const L = a.layout;
  const now = game.sim.abs;
  for (const ev of L.econ.events || []) {
    if (!ev.prog || !ev.cameBy) continue;
    const slot = (ev.prog || []).find((q) => now >= q.from && now < q.to);
    if (!slot) continue;
    const v = ['stage', 'alehouse', 'stalls', 'green'].find((x) => slot.venues.includes(x) && nearVenue(ev, x, p.x, p.z, 6));
    if (!v) continue;
    const pid = pidOf(p);
    ev.music ||= {};
    const m = (ev.music[pid] ||= { notes: 0, tips: 0, thanked: false });
    m.notes++;
    if (m.notes % 16 === 0 && m.tips < 30) {
      const near = (game.npcs || []).filter((n) => !n.dead && n.rec && n.rec.age !== 'child' && n.distTo(p) < 8);
      if (near.length) {
        const n = near[Math.floor(Math.random() * near.length)];
        const c = 1 + Math.floor(Math.random() * Math.min(3, near.length));
        m.tips += c;
        const left = p.give('coin', c);
        if (left) game.spawnDrop('coin', left, p.x, p.y, p.z, true);
        n.say(['For the music!', 'Play another!', 'Lovely, that.', 'Give us a jig!'][Math.floor(Math.random() * 4)], 2.4, '#ffe0a0');
        game.ui.msg(`${n.rec.name.first} tosses you ¤${c} for the music.`, '#ffe070');
        game.audio?.play('coin', p);
      }
    }
    if (m.notes >= 60 && !m.thanked) {
      m.thanked = true;
      (ev.musicians ||= []).includes(pid) || ev.musicians.push(pid);
      if (ev.host !== null && ev.host !== undefined && L.npcs[ev.host]) game.sim.events.bump(L.settlement.id, L.npcs[ev.host], 2);
      game.ui.msg('The crowd won\'t forget your playing.', '#ffd0e8');
    }
    return;
  }
}

// ------------------------------------------------------------ helping
// What a host would take, a few days before, to help the do along.
export const GIFTS = {
  food: { label: 'six things to eat for the tables', n: 6, test: (k) => ITEMS[k] && ITEMS[k].kind === 'food' && k !== 'ale' },
  ale: { label: 'three mugs of ale', n: 3, test: (k) => k === 'ale' },
  flowers: { label: 'five flowers for the garlands', n: 5, test: (k) => typeof k === 'string' && k.startsWith('flower_') },
  coin: { label: '¤20 toward it', n: 20, test: (k) => k === 'coin' },
};

// What a player has of each.
export function giftsHeld(p) {
  const out = {};
  for (const [g, G] of Object.entries(GIFTS)) {
    let n = 0;
    for (const s of p.inv) if (s && G.test(s.item)) n += s.count;
    out[g] = n;
  }
  return out;
}

// Given: taken from the pack, the host's thanks (and the town's).
export function give(game, L, ev, g) {
  const G = GIFTS[g];
  const p = game.player;
  if (!G || !p) return false;
  if (giftsHeld(p)[g] < G.n) return false;
  let left = G.n;
  if (g === 'coin') removeItem(p.inv, 'coin', G.n);
  else {
    for (const s of p.inv) {
      if (!left) break;
      if (!s || !G.test(s.item)) continue;
      const take = Math.min(left, s.count);
      removeItem(p.inv, s.item, take);
      left -= take;
    }
  }
  ev.gifts ||= {};
  ev.gifts[g] = (ev.gifts[g] || 0) + 1;
  const pid = pidOf(p);
  (ev.helpers ||= {})[pid] = (ev.helpers[pid] || 0) + 1;
  const sid = L.settlement.id;
  if (ev.host !== null && ev.host !== undefined && L.npcs[ev.host]) game.sim.events.bump(sid, L.npcs[ev.host], 3);
  if (ev.helpers[pid] === 1) game.sim.addRenown(sid, 1, 'helping with the festival');
  return true;
}

// Whether a do's still to come, for helping with.
export function helpable(ev, now) {
  return !!ev && !!ev.prog && ['announced', 'posting', 'posted', 'building'].includes(ev.state) && now < ev.s - 120;
}

// How much a player's helped (for the host's thanks).
export const helped = (ev, pid) => (ev && ev.helpers && ev.helpers[pid]) || 0;

// ------------------------------------------------------------ the speech
// (Phase 3) The one who governs the town (or rules the realm), if they're
// there, opens the feast: grandly, plainly, or with a joke; and the town
// thinks the better (or the worse) of them for it.
export const SPEECHES = {
  grand: { label: 'Speak of the town\'s good year, and the years to come.', ok: 0.8, up: 3, flop: 1 },
  plain: { label: 'Thank them all, plainly, and bid them eat.', ok: 0.95, up: 2, flop: 1 },
  jest: { label: 'Tell them a joke first.', ok: 0.6, up: 5, flop: -2 },
};
const SPEECH_LINES = {
  grand: (t) => [`People of ${t}! This year we have built, and traded, and stood together. Next year we do more!`, `${t} has never been stronger. Eat, drink, and be proud!`],
  plain: (t) => [`Thank you, all of you. ${t} is what you make it. Now eat, before it goes cold!`, 'I won\'t keep you. Thank you for this year. Let the feast begin!'],
  jest: (t) => [`They asked me to keep this short. So: the ale's free, the speech is over, and ${t}'s the best town there is!`, 'I had a speech, but the goat ate it. Let the feast begin!'],
};

// Whether a player may open this one, now (and as what).
export function canSpeak(game, L, ev, now) {
  if (!ev || ev.speech || !ev.prog) return null;
  const feast = ev.prog.find((q) => q.k === 'feast');
  const at = feast ? feast.from : ev.s;
  if (now < at - 30 || now > at + 15) return null;
  const s = L.settlement;
  if (game.sim.office.isHolder(s.id)) return 'office';
  if (s.civ && game.sim.crown.isRuler(s.civ)) return 'crown';
  return null;
}

export function speech(game, L, ev, tone) {
  const as = canSpeak(game, L, ev, game.sim.abs);
  const S = SPEECHES[tone];
  if (!as || !S) return null;
  const s = L.settlement;
  const ok = Math.random() < S.ok;
  const n = ok ? S.up : S.flop;
  const name = playerName(game, pidOf(game.player));
  if (as === 'office') {
    const T = game.sim.office.of(s.id);
    if (T) for (const f of FACTION_IDS) T.favour[f] = clamp((T.favour[f] || 0) + n + (tone === 'plain' && f === 'poor' ? 2 : 0), -30, 30);
  } else {
    const C = game.sim.crown.of(s.civ);
    if (C) C.favour[s.id] = clamp((C.favour[s.id] || 0) + n + 2, -30, 30);
  }
  const lines = SPEECH_LINES[tone](s.name);
  const said = lines[Math.floor(Math.random() * lines.length)];
  ev.speech = { pid: pidOf(game.player), name, tone, ok, as };
  game.sim.events.tellTown(L, `${name} opens the festival: "${said}"`, '#ffe8a0');
  game.sim.events.tellTown(L, ok ? (tone === 'jest' ? 'The square roars with laughter!' : 'The square cheers!') : tone === 'jest' ? 'The joke falls flat. Somebody coughs.' : 'A polite murmur goes round the square.', ok ? '#ffe070' : '#c8b890');
  for (const e of game.npcs || []) {
    if (e.dead || !e.rec || !e.say || e.distTo(game.player) > 14 || Math.random() < 0.5) continue;
    e.say(ok ? ['Hear, hear!', 'Huzzah!', `To ${s.name}!`, 'Well said!'][Math.floor(Math.random() * 4)] : ['Hmph.', '...', 'Get on with it!'][Math.floor(Math.random() * 3)], 2.6, ok ? '#ffe8a0' : '#c8b8a0');
  }
  ledger(L, ev.day, `${name} opened ${game.sim.events.title(L, ev)}${ok ? ', to cheers' : ', to a polite murmur'}.`);
  return { ok, said };
}

// ------------------------------------------------------------ mischief
// (Phase 3) Lifting a purse in the crush at one of the places, when
// everyone's watching the games; and the ale cask, for a mug (or, with a
// potion tipped in, a livelier night than anyone bargained for). Seen
// doing either, it's a crime like any other.
function fairNow(L, now) {
  for (const ev of L.econ.events || []) {
    if (!ev.prog || ev.state === 'off' || ev.state === 'done') continue;
    const slot = ev.prog.find((q) => now >= q.from && now < q.to);
    if (slot) return { ev, slot };
  }
  return null;
}

// Whether someone could have their purse lifted (crowded round them, at a
// place where something's on).
export function canLift(game, npc) {
  const L = npc.layout;
  if (!L || !npc.rec || npc.rec.age === 'child' || npc.rec.job === 'guard' || npc.hired) return false;
  const f = fairNow(L, game.sim.abs);
  if (!f || (f.ev.lifted && f.ev.lifted[npc.rec.idx])) return false;
  if (!f.slot.venues.some((v) => nearVenue(f.ev, v, npc.x, npc.z, 4))) return false;
  const crowdN = (game.npcs || []).filter((e) => e !== npc && !e.dead && e.rec && e.distTo(npc) <= 4).length;
  return crowdN >= 3;
}

export function liftPurse(game, npc) {
  const L = npc.layout;
  const f = fairNow(L, game.sim.abs);
  if (!f || !canLift(game, npc)) return { ok: false, lines: ['(There\'s no crowd here to hide in.)'] };
  const ev = f.ev;
  const p = game.player;
  const sid = L.settlement.id;
  const crowdN = (game.npcs || []).filter((e) => e !== npc && !e.dead && e.rec && e.distTo(npc) <= 4).length;
  const watching = openNow(ev, game.sim.abs).some((c) => nearVenue(ev, c.v, npc.x, npc.z, 5));
  const wary = has(npc.rec, 'nosy') || has(npc.rec, 'shrewd') || has(npc.rec, 'stingy');
  const chance = Math.min(0.9, 0.45 + crowdN * 0.04 + (watching ? 0.15 : 0) - (wary ? 0.2 : 0));
  (ev.lifted ||= {})[npc.rec.idx] = true;
  if (Math.random() < chance) {
    const n = Math.min(npc.rec.coins || 0, 4 + Math.floor(Math.random() * 12));
    if (n <= 0) return { ok: true, lines: ['(Their purse is empty. Not a coin in it.)'] };
    npc.rec.coins -= n;
    const left = p.give('coin', n);
    if (left) game.spawnDrop('coin', left, p.x, p.y, p.z, true);
    ev.mischief = (ev.mischief || 0) + 1;
    return { ok: true, lines: [`(In the crush, ¤${n} from their purse, and they never felt a thing.)`] };
  }
  const wits = game.sim.witnesses(sid, npc.x, npc.z, 8);
  if (!wits.includes(npc)) wits.push(npc);
  npc.say(npc.rng.pick(['Thief! Hands off!', 'Oi! My purse!', 'Pickpocket!']), 3, '#ff9080');
  game.sim.justice.commit(sid, 'theft', { witnesses: wits, value: 6, desc: 'Picking a pocket at the festival', owner: { kind: 'rec', id: npc.rec.idx }, victimNpc: npc });
  ev.crimes = (ev.crimes || 0) + 1;
  return { ok: false, lines: ['(They feel your hand at their belt and spin round!)'], close: true };
}

// The ale cask at the ale tables: a mug of the festival's ale; or, with a
// potion in your hand, tipped in.
export function cask(game, L, x, z) {
  const f = fairNow(L, game.sim.abs);
  const p = game.player;
  if (!f || !nearVenue(f.ev, 'alehouse', x, z, 2)) return 'An ale cask, tapped for the festival.';
  const ev = f.ev;
  const pid = pidOf(p);
  const it = p.heldDef();
  if (it && it.kind === 'potion') {
    removeItem(p.inv, it.key, 1);
    const now = game.sim.abs;
    ev.spiked = { by: pid, at: now, until: now + 90 };
    const sid = L.settlement.id;
    const wits = game.sim.witnesses(sid, x, z, 7);
    if (wits.length) {
      game.sim.justice.commit(sid, 'vandalism', { witnesses: wits, desc: 'Spiking the festival ale' });
      ev.crimes = (ev.crimes || 0) + 1;
      return null;
    }
    ev.mischief = (ev.mischief || 0) + 1;
    return `You tip the ${it.name.toLowerCase()} into the cask. Nobody saw. It should be a lively night.`;
  }
  ev.mugs ||= {};
  if (ev.mugs[pid]) return 'You\'ve had your festival mug. The tavern will sell you the next.';
  ev.mugs[pid] = true;
  const left = p.give('ale', 1);
  if (left) game.spawnDrop('ale', left, p.x, p.y, p.z, true);
  return 'The keeper pours you a mug of the festival ale, on the house.';
}

// Whether the ale tables are rowdy (the cask spiked) now.
export const rowdy = (ev, now) => !!(ev && ev.spiked && now < ev.spiked.until);

// ------------------------------------------------------------ how it went
// (Phase 3) Once the day's done: how good a do it was (who came, what was
// put up, who helped, the music, the contests and who had a go, the
// speech, the weather, any trouble), and what comes of it: the guests'
// mood, the host's thanks, a line in the ledger and, naming the winners,
// in the town's annals; and something for people to talk of after.
export function quality(L, ev) {
  const sum = (o) => Object.values(o || {}).reduce((a, b) => a + b, 0);
  const came = ev.came || (ev.guests || []).filter((g) => g.set).length;
  const parts = {
    turnout: Math.min(30, (came / Math.max(8, L.npcs.length * 0.45)) * 30),
    places: Math.min(16, (ev.venues || []).length * 4),
    gifts: Math.min(12, sum(ev.gifts) * 3),
    music: Math.min(10, (ev.musicians || []).length * 5),
    contests: Math.min(12, Object.values(ev.contests || {}).filter((c) => c.places && c.places.length >= 2).length * 2),
    players: Math.min(12, new Set(Object.values(ev.contests || {}).flatMap((c) => c.entries.filter((q) => q.who && q.who.startsWith('pl:')).map((q) => q.who))).size * 4),
    speech: ev.speech ? (ev.speech.ok ? 8 : -3) : 0,
    fun: ev.spiked ? 4 : 0,
    trouble: -6 * (ev.crimes || 0),
    weather: ev.wasWet ? -10 : 0,
  };
  return { q: clamp(Math.round(sum(parts) + 10), 0, 100), parts };
}

export function wrapUp(events, L, ev) {
  if (ev.wrapped || !ev.prog) return;
  ev.wrapped = true;
  const { q } = quality(L, ev);
  ev.quality = q;
  const word = q >= 75 ? 'the best in years' : q >= 55 ? 'a fine day' : q >= 35 ? 'a decent do' : 'a damp squib';
  // The guests go home the happier (or not).
  for (const g of ev.guests || []) {
    const r = L.npcs[g.idx];
    if (r && alive(r) && g.set) r.mood = clamp((r.mood ?? 0.5) + (q - 50) / 500, 0, 1);
  }
  const title = events.title(L, ev);
  const champs = (ev.champs || []).slice(0, 6);
  // (Each winner once, with all they won.)
  const by = new Map();
  for (const c of champs) by.set(c.name, [...(by.get(c.name) || []), CONTESTS[c.k] ? CONTESTS[c.k].name : 'a prize']);
  const andList = (xs) => (xs.length > 1 ? `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}` : xs[0]);
  const named = [...by].map(([n, ks]) => `${n} won ${andList(ks)}`);
  ledger(L, ev.day, `${cap(title)} was ${word}.${named.length ? ` ${cap(named.join(', '))}.` : ''}`);
  if (named.length && events.sim.history && events.sim.history.add) events.sim.history.add(L, `At ${title}, ${named.join(', ')}.`, 'festival', ev.day);
  L.econ.lastFest = { day: ev.day, q, word, title, champs: champs.map((c) => ({ k: c.k, name: c.name })), speech: ev.speech ? { name: ev.speech.name, ok: ev.speech.ok } : null, spiked: !!ev.spiked };
}

// Whether a do's day is over (for the reckoning).
export const dayDone = (ev, now) => !!ev.prog && now >= closeOf(ev) && (ev.state === 'over' || ev.state === 'done');
