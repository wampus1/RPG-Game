// (Round 136) You among the townsfolk: everything they do with each other,
// you can do with them.
//
//   Gossip      What have they heard? (You hear it: and can pass it on, to
//               the next person and the next town, as they do.) Or a
//               rumour of your own making about someone: believed or not,
//               and woe betide you if it gets back to whoever it's about.
//   Opinions    What do they make of someone? Of you? They may not tell you
//               the truth (the kind and the timid soften it); press them.
//   Friends     Introduce two of them (a match, even); stand them a drink
//               at the tavern; a friendly bout; teach them, or be taught.
//   Quarrels    Make peace between two at odds. Say sorry for what you did
//               (not everything's forgiven). Threaten them: it works on the
//               timid, and they remember.
//   Dreams      What they want out of life (if they trust you): encourage
//               it, help with it, or talk them out of it.
//   Secrets     Something nobody knows, for a true friend.
//   Together    Stand with a town's grievance, talk it down, put coin into
//               it, or plead for it with the mayor.
// And they come to you: to thank you, to have it out with you, to ask your
// advice, to warn you, to ask you for a drink (see npc.seekTick).
//
// Every word of it chosen by the moment (see talk/lines.js), in the
// speaker's own voice, and as the one talking (multiplayer).
import { factsFor } from './talk/facts.js';
import { choose as chooseLine } from './talk/rules.js';
import { feelings, feel, stir, dominant } from '../sim/mind/emotion.js';
import { remember, recall, warm, opinionOf } from '../sim/mind/memory.js';
import { skillOf, practise, ensureSkills, bestTalent } from '../sim/mind/talent.js';
import { AMBITIONS, TRADE_GOODS, ambitionWords } from '../sim/mind/ambition.js';
import { groupOf, groupsOf, granted, CAUSES, settleGrudge } from '../sim/mind/groups.js';
import { P, has, bond, blood, nk, pkey, chemistry, nameOf, residents } from '../sim/mind/common.js';
import { alive, DAY, setOverride } from '../sim/econ.js';
import { countItem, removeItem } from './inventory.js';
import { gainMastery, mastery, CRAFTS } from './mastery.js';
import { pidOf } from '../sim/saga/refs.js';
import { ITEMS } from '../world/items.js';
import { RNG, hash4, clamp } from '../util/rng.js';
import { jobTitle } from '../entities/npcgen.js';

const SO = 'so_';
export const isSocial = (id) => typeof id === 'string' && id.startsWith(SO);
const pick = (rng, a) => a[rng.int(0, a.length - 1)];
const first = (r) => (r && r.name ? r.name.first : 'them');
const layoutOf = (npc) => npc.homeLayout || npc.layout;
// What can be told of: what happened to people, and what's said of them.
const TELLABLE = new Set(['loss', 'born', 'wed', 'raid', 'robbed', 'killed', 'feast', 'mastery', 'dream_done', 'dream_lost', 'friend', 'quarrel', 'bad_word', 'rumour_bad', 'rumour_good', 'petition_won', 'vigil', 'crowned', 'exiled', 'famine', 'riot', 'war', 'peace', 'eruption', 'rival', 'heartbreak', 'grown', 'chosen', 'made_up', 'saved', 'gift', 'hurt', 'wronged', 'insult', 'helped', 'grandchild', 'wedding', 'slander', 'won_war']);
const GRIEVANCES = new Set(['insult', 'hurt', 'wronged', 'junk_gift', 'tactless', 'slander', 'liar', 'killed', 'threatened', 'cheated', 'bad_word']);
// What a skill of theirs is to you, if they'd teach it.
const TEACHES = { fishing: 'fishing', cooking: 'cooking', crafting: 'smithing', lore: 'study', combat: 'dueling' };

// The record you keep with each of them (see Sim.repEntry).
function entry(npc, game) {
  return game.sim.repEntry(game.sim.repSidOf(npc), npc.rec.idx);
}

// What's so, plus whatever the moment adds.
function facts(npc, game, extra = {}, vars = {}) {
  const F = factsFor(npc, game);
  Object.assign(F, extra);
  Object.assign(F.vars, vars);
  return F;
}

// A line for `topic` (or `fallback`), as the moment has it.
function line(npc, game, topic, extra = {}, vars = {}, fallback = '...') {
  const F = facts(npc, game, extra, vars);
  const c = chooseLine(topic, F, npc.rng || new RNG(hash4(npc.rec.idx, game.day)), entry(npc, game), 0);
  return c ? c.text : fallback;
}

// A check of yours against them: charm (and how they feel about you), and
// whatever else is said to count (0..1).
function check(game, npc, base, against = 0, stat = 'cha') {
  const h = game.hero || {};
  const v = (h.stats && h.stats[stat]) || 2;
  const op = game.sim.opinion(npc);
  const fe = feelings(npc.rec, game.sim.abs) || {};
  const mood = (fe.j || 0) * 0.1 + (fe.f || 0) * (stat === 'str' ? 0.2 : 0.05) - (fe.a || 0) * 0.15;
  const p = clamp(base + v * 0.07 + op / 250 + mood - against, 0.05, 0.95);
  return (npc.rng || new RNG(hash4(npc.rec.idx, game.day, 0x5c))).chance(p);
}

// Their honesty: how readily they'd tell you a comfortable lie.
function honesty(r) {
  const p = P(r);
  return clamp(0.55 + (has(r, 'devout') ? 0.15 : 0) + (has(r, 'gruff') ? 0.25 : 0) + (has(r, 'hot-headed') ? 0.15 : 0) - (has(r, 'shrewd') ? 0.2 : 0) - (p.kindness - 0.5) * 0.4 - (0.5 - p.bravery) * 0.4 - (r.life && r.life.vice === 'thief' ? 0.2 : 0), 0, 1);
}

// The townsfolk they could speak of (the people you can name to them).
function peopleChoices(npc, game, id, ok = () => true, max = 8) {
  const L = layoutOf(npc);
  const rec = npc.rec;
  const sid = L.settlement.id;
  const out = [];
  const seen = new Set([rec.idx]);
  const add = (i) => {
    if (i === null || i === undefined || i < 0 || seen.has(i)) return;
    const o = L.npcs[i];
    if (!o || !alive(o) || o.migrated || o.away) return;
    seen.add(i);
    if (!ok(o)) return;
    out.push({ id, arg: String(i), label: `${o.name.first} ${o.name.last} (${jobTitle(o, L.settlement)})` });
  };
  add(rec.partner);
  (rec.children || []).forEach(add);
  (rec.parents || []).forEach(add);
  (rec.friends || []).forEach(add);
  for (const k of Object.keys(rec.op || {})) if (k.startsWith('n:')) add(+k.slice(2));
  for (const [k, r] of game.sim.rep) if (r.met && k.startsWith(`${sid}:`)) add(+k.slice(k.indexOf(':') + 1));
  for (const job of ['mayor', 'priest', 'guard', 'blacksmith', 'merchant', 'cook']) add(L.npcs.findIndex((o) => o.job === job && alive(o)));
  return out.slice(0, max);
}

// What you've been told (by key), newest first.
function heardOf(game) {
  return (game.sim.mind.heard[pkey(game)] ||= []);
}

// What they hold against you, if anything (their uppermost grievance).
export function grievanceOf(npc, game) {
  const pk = pkey(game);
  return recall(npc.rec, game.day, (m) => m.w === pk && !m.h && GRIEVANCES.has(m.k) && m.v <= -0.3, 0.15)[0] || null;
}

// A single grown-up, free to court (one of the town: see intro).
const courtable = (r) => r.age === 'adult' && (r.partner === null || r.partner === undefined) && !r.courting && !r.visitor;

// ------------------------------------------------------------ the topics
export function socialTopics(npc, game) {
  const rec = npc.rec;
  const sim = game.sim;
  if (!rec || npc.hired || npc.visit || rec.visitor) return [];
  const out = [];
  const add = (id, label, arg) => out.push(arg === undefined ? { id: SO + id, label } : { id: SO + id, arg, label });
  const op = sim.opinion(npc);
  const e = entry(npc, game);
  const day = game.day;
  const kid = rec.age === 'child';
  const L = layoutOf(npc);
  // They came looking for you.
  if (rec.seek && rec.seek.pk === pkey(game)) add('seek', seekLabel(rec.seek, npc, game));
  // Sulking: only an apology (or a gift) will do.
  if (sulking(npc, game)) {
    if (grievanceOf(npc, game)) add('sorry', 'I\'m sorry for what I did.');
    return out;
  }
  if (!kid) {
    add('word', e.word === day ? 'Anything else going round?' : 'Heard anything lately?');
    if (heardOf(game).some((m) => m.from !== rec.idx || m.sid !== L.settlement.id)) add('share', 'Have you heard...?');
    add('think', 'What do you make of...');
    add('me', 'What do you really think of me?');
    if (op >= 10 || P(rec).sociability > 0.65 || rec.amb) add('dream', 'What do you want out of life?');
    if (op >= 50 && (e.secret ?? -99) < day - 4) add('secret', 'Tell me something nobody knows.');
    add('intro', 'There\'s someone you should meet...');
    const foe = foeOf(npc);
    if (foe) add('mediate', `(Try to make peace between them and ${first(foe)})`, String(foe.idx));
    const g = groupOf(L, rec);
    if (g && CAUSES[g.k].complaint && !g.out) add('group', `What's all this about ${CAUSES[g.k].what}?`, String(g.id));
    if (rec.job === 'mayor') {
      const pg = groupsOf(L).find((q) => !q.out && CAUSES[q.k].complaint && ['petition', 'protest', 'strike'].includes(q.st));
      if (pg) add('plead', `Hear ${pg.ln.split(' ')[0]} and the others out.`, String(pg.id));
    }
    const m = game.minute;
    if (m >= 16 * 60 && m < 23 * 60 && L.buildings.some((b) => b.type === 'tavern' && !b.underConstruction) && op >= -10 && e.drink !== day) add('drink', 'Join me for a drink? (¤2)');
    if (rec.age === 'adult' && op >= -10 && npc.hp >= npc.maxHp * 0.6 && (rec.job === 'guard' || skillOf(rec, 'combat') >= 0.3 || P(rec).bravery >= 0.6) && !game.duel) add('spar', 'Fancy a friendly bout?');
    if (e.taught !== day && teachable(npc)) add('teach', 'Could you teach me something?');
    if (e.showed !== day && showable(npc, game)) add('show', 'Let me show you a thing or two.');
  }
  if (grievanceOf(npc, game) && e.sorry !== day) add('sorry', 'I\'m sorry for what I did.');
  if (!kid && rec.job !== 'guard') add('threaten', '(Threaten them)');
  return out;
}

// (Round 142) How they feel about you, all told: what the town's word and
// their own dealings with you have made of you (their opinion), what they
// think of you in their own heart, what you did to them that they still
// hold against you, and the anger (or the fear) it left them with.
// { level, why, v }: level 0, nothing against you; 1, wary (nothing
// personal: no secrets, no favours, no gossip about the neighbours); 2,
// cold (only what has to be said: business, the town's, an apology); 3,
// they won't speak to you at all (unless you plead: see Game.talk).
// `why`: 'hate', 'anger', 'fear' or 'dislike'.
export function regardOf(npc, game) {
  const rec = npc.rec;
  const none = { level: 0, why: null, v: 0 };
  if (!rec || npc.saga || npc.hired || npc.adventurer || npc.company) return none;
  const sim = game.sim;
  const op = sim.opinion(npc);
  // (Your own kin, mostly, can't stay angry with you.)
  const kin = sim.familyOf ? sim.familyOf(rec) : null;
  const g = grievanceOf(npc, game);
  const now = sim.abs;
  const anger = g ? feel(rec, 'anger', now) : 0;
  const fear = g ? feel(rec, 'fear', now) : 0;
  let v = op + opinionOf(rec, pkey(game)) * 30;
  if (g) v -= 10 + Math.abs(g.v) * 25 + anger * 25;
  if (kin) v += 25;
  let level = v <= -60 ? 3 : v <= -35 ? 2 : v <= -15 ? 1 : 0;
  // (Afraid of you, for what you did to them: they shrink away.)
  const afraid = !!g && fear >= 0.5 && ['hurt', 'threatened', 'killed'].includes(g.k);
  if (afraid) level = Math.max(level, kin ? 1 : 3);
  if (sulking(npc, game)) level = 3;
  const why = afraid ? 'fear' : g && anger >= 0.3 ? 'anger' : v <= -60 ? 'hate' : 'dislike';
  return { level, why: level ? why : null, v: Math.round(v) };
}

// Whether they've come to you to talk (the mayor with a lecture, someone
// with something to say to you, the watch after you): they'll talk,
// however they feel.
export function cameToYou(npc, game) {
  const rec = npc.rec;
  const c = game.sim.confront;
  if (c && c.arrived && c.idx === rec.idx && npc.settlement && c.sid === npc.settlement.id) return true;
  if (rec.job === 'guard' && npc.settlement && game.isWanted && game.isWanted(npc.settlement.id)) return true;
  return !!(rec.seek && rec.seek.pk === pkey(game));
}

// What they won't talk about with you, as they feel (see regardOf): the
// topics' kinds (see dialogue.topicCat) and a few besides.
const WARY_DROP = new Set(['favor', 'companion', 'so_word', 'so_share', 'so_dream', 'so_secret', 'so_intro', 'so_mediate', 'so_spar', 'so_teach', 'so_show', 'so_drink', 'so_rumour', 'so_think']);
const COLD_KEEP = new Set(['now', 'business', 'town', 'manners', 'bye']);
const COLD_DROP = new Set(['job', 'hire', 'companion', 'inn_room', 'expand', 'plan_build', 'so_drink']);
export function allowedBy(level, t) {
  if (level >= 1 && WARY_DROP.has(t.id)) return false;
  if (level >= 2 && (!COLD_KEEP.has(t.cat) || COLD_DROP.has(t.id)) && t.id !== 'who') return false;
  if (level >= 3 && !['now', 'manners', 'bye'].includes(t.cat)) return false;
  if (level >= 3 && (t.id === 'rude' || t.id === 'so_threaten' || t.id === 'so_drink')) return false;
  return true;
}

// What they say as they turn their back on you (see Game.talk).
export function snubLine(npc, game, why) {
  const rng = npc.rng;
  const pickR = (xs) => xs[Math.floor(rng.next() * xs.length)];
  if (npc.rec.age === 'child') return pickR(['Mum says I\'m not to talk to you.', 'Go away!', '*runs off*', 'I\'m not allowed.']);
  if (why === 'fear') return pickR(['Stay back! Please...', 'D-don\'t come any closer.', 'Leave me alone!', '*backs away from you*']);
  if (why === 'anger') return pickR(['After what you did? Go away.', 'Don\'t you dare talk to me.', 'I\'ve nothing to say to you. Not now.', '*turns their back on you*']);
  if (why === 'hate') return pickR(['Not you. Not today, not ever.', 'Get away from me.', '*spits at your feet*', 'We\'ve nothing to talk about.']);
  return pickR(['I\'d rather not.', 'Some other time.', '*looks straight through you*', 'I\'m busy.']);
}

// Too angry with you to talk (they'll hear an apology, and take a gift).
export function sulking(npc, game) {
  const rec = npc.rec;
  if (rec.age === 'child' || npc.saga) return false;
  const op = game.sim.opinion(npc);
  return op <= -40 && feel(rec, 'anger', game.sim.abs) >= 0.45 && !!grievanceOf(npc, game);
}

// Someone they're at odds with, that you might make peace with.
function foeOf(npc) {
  const L = layoutOf(npc);
  let worst = null;
  let wv = -0.25;
  for (const [k, v] of Object.entries(npc.rec.op || {})) {
    if (!k.startsWith('n:') || v > wv) continue;
    const q = L.npcs[+k.slice(2)];
    if (!q || !alive(q) || q.away || q.migrated) continue;
    worst = q;
    wv = v;
  }
  return worst;
}

function teachable(npc) {
  const r = npc.rec;
  ensureSkills(layoutOf(npc), r);
  return Object.keys(TEACHES).some((k) => skillOf(r, k) >= 0.55);
}

function showable(npc, game) {
  return Object.entries(TEACHES).some(([k, c]) => mastery(game, c).rank >= 4 && skillOf(npc.rec, k) < 0.6);
}

// ------------------------------------------------------------ answers
export function socialRespond(npc, game, id, arg) {
  const f = ANSWERS[id.slice(SO.length)];
  if (!f) return { lines: ['Hm?'] };
  return f(npc, game, arg);
}

const ANSWERS = {
  // ---- gossip
  word(npc, game) {
    const rec = npc.rec;
    const e = entry(npc, game);
    const day = game.day;
    const L = layoutOf(npc);
    const pk = pkey(game);
    if (P(rec).sociability < 0.35 && game.sim.opinion(npc) < 20) return { lines: [line(npc, game, 'word_none', { reserved: true }, {}, 'I keep myself to myself.')] };
    const told = new Set(e.told || []);
    const ms = recall(rec, day, (m) => TELLABLE.has(m.k) && !told.has(`${m.k}:${m.w || ''}:${m.n || ''}:${m.d}`), 0.1);
    // (Something about someone else before something about themselves.)
    const m = ms.find((q) => q.h || (q.w && q.w !== pk)) || ms[0];
    if (!m) return { lines: [line(npc, game, 'word_none', {}, {}, 'Quiet, lately. Nothing worth repeating.')] };
    (e.told ||= []).push(`${m.k}:${m.w || ''}:${m.n || ''}:${m.d}`);
    if (e.told.length > 10) e.told.shift();
    e.word = day;
    const aboutYou = m.w === pk;
    const subj = m.w && m.w.startsWith('n:') ? L.npcs[+m.w.slice(2)] : null;
    const text = line(npc, game, 'word', { wordK: m.k, wordH: !!m.h, wordYou: aboutYou, wordGood: m.v > 0 }, { who: m.n || (subj ? first(subj) : null), teller: m.x && m.k === 'bad_word' ? m.x : null, what: m.x || null, subj: subj ? first(subj) : m.n || null }, gossipFallback(m, subj));
    // (You've heard it now: yours to pass on.)
    if (!aboutYou) {
      const list = heardOf(game);
      const o = m.o || `${m.k}:${m.w || ''}:${m.n || ''}:${m.d}`;
      if (!list.some((q) => q.o === o)) {
        list.unshift({ k: m.k, w: m.w, n: m.n || (subj ? first(subj) : null), x: m.x, v: m.v, s: m.s, d: m.d, o, sid: L.settlement.id, from: rec.idx, fromName: first(rec), town: L.settlement.name });
        if (list.length > 10) list.pop();
      }
    }
    if (P(rec).sociability > 0.6 && game.sim.opinion(npc) < 40) game.sim.changeRep(npc, 1, 'chat');
    return { lines: [text] };
  },

  share(npc, game, arg) {
    const rec = npc.rec;
    const list = heardOf(game);
    const L = layoutOf(npc);
    if (arg === undefined || arg === null) {
      const choices = list.map((m, i) => ({ m, i })).filter(({ m }) => !(m.from === rec.idx && m.sid === L.settlement.id)).slice(0, 6)
        .map(({ m, i }) => ({ id: 'so_share', arg: String(i), label: heardLabel(m) }));
      if (!choices.length) return { lines: ['Heard what?'] };
      return { lines: [pick(npc.rng, ['Go on.', 'Heard what?', 'Oh? Tell me.'])], choices };
    }
    const m = list[+arg];
    if (!m) return { lines: ['Hm?'] };
    const day = game.day;
    const o = m.o;
    const known = (rec.mem || []).some((q) => (q.o || `${q.k}:${q.w || ''}:${q.n || ''}:${q.d}`) === o);
    // (Who it's about, here: the same name in this town.)
    const subj = m.sid === L.settlement.id && m.w && m.w.startsWith('n:') ? L.npcs[+m.w.slice(2)] : m.n ? L.npcs.find((q) => q && alive(q) && q.name.first === m.n && m.sid === L.settlement.id) : null;
    const self = subj === rec;
    const kin = subj && !self ? bond(rec, subj) : null;
    if (!known) {
      const w = m.sid === L.settlement.id ? m.w : subj ? nk(subj) : undefined;
      remember(rec, { k: m.k, v: m.v * 0.6, s: m.s * 0.55, w, n: m.n, x: m.x, h: 1, o, d: m.d }, day);
      if (w && w.startsWith('n:') && !self) warm(rec, w, m.v * 0.12 * (kin ? 1.5 : 1));
      if (kin && m.v < 0) stir(rec, m.k === 'loss' ? 'grief' : 'anger', 0.25, game.sim.abs);
      else if (kin && m.v > 0) stir(rec, 'joy', 0.25, game.sim.abs);
      // (Told what someone's been saying about them: they'll not forgive
      // the one who said it.)
      if (self && m.k === 'bad_word' && m.x) {
        const teller = L.npcs.find((q) => q && q.name.first === m.x && alive(q));
        if (teller) {
          warm(rec, nk(teller), -0.35);
          remember(rec, { k: 'betrayed', w: nk(teller), n: teller.name.first, v: -0.7, s: 0.6 }, day);
          stir(rec, 'anger', 0.4, game.sim.abs);
        }
      }
      if (P(rec).sociability > 0.5) game.sim.changeRep(npc, 1, 'chat');
    }
    const text = line(npc, game, 'told', { toldK: m.k, toldGood: m.v > 0, toldKnown: known, toldSelf: self, toldKin: !!kin, toldFar: m.sid !== L.settlement.id }, { who: m.n || 'them', there: m.town || 'there', what: m.x || null, teller: m.x || null }, known ? 'I\'d heard.' : m.v > 0 ? 'Is that so? Good for them.' : 'No! Really?');
    return { lines: [text] };
  },

  rumour(npc, game, arg) {
    const rec = npc.rec;
    const L = layoutOf(npc);
    if (arg === undefined || arg === null) {
      const choices = peopleChoices(npc, game, 'so_rumour', (o) => o.age !== 'child');
      return choices.length ? { lines: ['(About whom?)'], choices } : { lines: ['(There\'s nobody you could name.)'] };
    }
    const [i, how] = String(arg).split(':');
    const subj = L.npcs[+i];
    if (!subj) return { lines: ['Who?'] };
    if (!how) {
      return { lines: [`(What do you say about ${first(subj)}?)`], choices: [
        { id: 'so_rumour', arg: `${i}:bad`, label: `"${first(subj)} isn't to be trusted, you know."` },
        { id: 'so_rumour', arg: `${i}:good`, label: `"${first(subj)} has a good heart. Did you know they...?"` },
      ] };
    }
    const e = entry(npc, game);
    const day = game.day;
    if (e.rumour === day) return { lines: ['You do like to talk, don\'t you?'] };
    e.rumour = day;
    const pk = pkey(game);
    const bad = how === 'bad';
    const view = opinionOf(rec, nk(subj));
    const kin = bond(rec, subj);
    let against = skillOf(rec, 'lore') * 0.25;
    if (bad && view >= 0.4) against += 0.3;
    if (bad && kin && kin !== 'workmate') against += 0.4;
    if (bad && view <= -0.2) against -= 0.2;
    if (!bad && view <= -0.3) against += 0.2;
    if (subj === rec) against += 1;
    const believed = check(game, npc, 0.3, against);
    if (believed) {
      remember(rec, { k: bad ? 'rumour_bad' : 'rumour_good', w: nk(subj), n: subj.name.first, v: bad ? -0.6 : 0.6, s: 0.5, h: 1, o: `rum:${pk}:${subj.idx}:${day}` }, day);
      warm(rec, nk(subj), bad ? -0.15 : 0.15);
      return { lines: [line(npc, game, 'rumour', { rumourBad: bad, believed: true }, { subj: first(subj) }, bad ? 'Really? I\'d never have thought it.' : 'Is that so? I\'ll think the better of them.')] };
    }
    remember(rec, { k: 'liar', w: pk, v: -0.5, s: 0.45 }, day);
    warm(rec, pk, -0.15);
    game.sim.changeRep(npc, -4, 'rude');
    return { lines: [line(npc, game, 'rumour', { rumourBad: bad, believed: false }, { subj: first(subj) }, `That doesn't sound like ${first(subj)}.`)] };
  },

  // ---- opinions
  think(npc, game, arg) {
    const rec = npc.rec;
    const L = layoutOf(npc);
    if (arg === undefined || arg === null) {
      const choices = peopleChoices(npc, game, 'so_think');
      choices.push({ id: 'so_rumour', label: '(Spread a rumour about someone...)' });
      return { lines: ['Who?'], choices };
    }
    const [i, press] = String(arg).split(':');
    const subj = L.npcs[+i];
    if (!subj) return { lines: ['Who?'] };
    const v = opinionOf(rec, nk(subj));
    const b = bond(rec, subj);
    const m = recall(rec, game.day, (q) => q.w === nk(subj), 0.1)[0];
    const band = v <= -0.4 ? 'hate' : v <= -0.15 ? 'dislike' : v >= 0.45 ? 'adore' : v >= 0.15 ? 'like' : 'neutral';
    // (Softened: for their own, for the powerful, for the kind and timid.)
    const soften = !press && v <= -0.15 && (b || subj.job === 'mayor' || subj.job === 'guard') && honesty(rec) < 0.55;
    const ex = { subjBand: soften ? 'polite' : band, subjBond: b || 'none', subjMem: m ? m.k : null, subjMayor: subj.job === 'mayor', subjKid: subj.age === 'child', pressed: !!press };
    const text = line(npc, game, 'think', ex, { subj: first(subj), what: m && m.x ? m.x : null }, thinkFallback(band, first(subj)));
    const choices = [];
    if (!press) choices.push({ id: 'so_think', arg: `${i}:p`, label: '(You don\'t sound sure.)' });
    if (press && soften === false && v <= -0.15 && !check(game, npc, 0.25, honesty(rec) * 0.5)) return { lines: [line(npc, game, 'think', { ...ex, subjBand: 'polite', pressed: true }, { subj: first(subj) }, 'I\'ve said all I mean to.')] };
    return { lines: [text], choices: choices.length ? choices : null };
  },

  me(npc, game, arg) {
    const rec = npc.rec;
    const op = game.sim.opinion(npc);
    const pk = pkey(game);
    const m = recall(rec, game.day, (q) => q.w === pk, 0.1)[0];
    const band = op <= -60 ? 'hate' : op <= -20 ? 'dislike' : op >= 70 ? 'adore' : op >= 30 ? 'like' : 'neutral';
    const lie = arg !== 'p' && op <= -20 && honesty(rec) < 0.5;
    if (arg === 'p' && op <= -20 && !check(game, npc, 0.2, honesty(rec) * 0.4)) return { lines: [line(npc, game, 'me', { meBand: 'polite', pressed: true }, {}, 'I said what I said.')] };
    const text = line(npc, game, 'me', { meBand: lie ? 'polite' : band, meMem: m ? m.k : null, meGood: m ? m.v > 0 : false, pressed: arg === 'p' }, { what: m && m.x ? (ITEMS[m.x]?.name || m.x).toLowerCase() : null, dead: m && m.n ? m.n : null }, meFallback(lie ? 'polite' : band));
    return { lines: [text], choices: arg !== 'p' ? [{ id: 'so_me', arg: 'p', label: '(Really? You can be honest.)' }] : null };
  },

  // ---- dreams
  dream(npc, game, arg) {
    const rec = npc.rec;
    const a = rec.amb;
    const op = game.sim.opinion(npc);
    const e = entry(npc, game);
    if (op < 10 && P(rec).sociability <= 0.65 && !(a && a.k === 'revenge' && a.t === pkey(game))) return { lines: [line(npc, game, 'dream_shut', {}, {}, 'That\'s my own business.')] };
    if (!a) return { lines: [line(npc, game, 'dream', { noDream: true }, {}, 'Me? I\'ve all I need, I think.')] };
    const A = AMBITIONS[a.k];
    if (arg === 'enc') return encourage(npc, game, a);
    if (arg === 'help') return helpWith(npc, game, a);
    if (arg === 'stop') return dissuade(npc, game, a);
    e.dreamSeen = a.d;
    const text = line(npc, game, 'dream', { dreamTold: true }, {}, `I want ${A.label(a)}.`);
    const choices = [];
    if (a.enc !== pkey(game)) choices.push({ id: 'so_dream', arg: 'enc', label: a.k === 'revenge' ? '(Egg them on)' : '(Encourage them)' });
    const h = helpOffer(npc, game, a);
    if (h) choices.push({ id: 'so_dream', arg: 'help', label: h });
    choices.push({ id: 'so_dream', arg: 'stop', label: a.k === 'revenge' ? 'Let it go. It isn\'t worth it.' : a.k === 'leave' ? 'Don\'t go. Things will get better.' : '(Talk them out of it)' });
    return { lines: [text], choices, back: 'Good luck with it.' };
  },

  secret(npc, game) {
    const rec = npc.rec;
    const e = entry(npc, game);
    const day = game.day;
    e.secret = day;
    const L = layoutOf(npc);
    const rng = npc.rng;
    const opts = [];
    const [bk, bv] = bestTalent(L, rec);
    if (bv >= 0.7 && skillOf(rec, bk) < 0.5) opts.push(['talent', { skill: bk }]);
    if (rec.amb && e.dreamSeen !== rec.amb.d) opts.push(['dream', {}]);
    for (const [k, v] of Object.entries(rec.op || {})) {
      if (!k.startsWith('n:')) continue;
      const q = L.npcs[+k.slice(2)];
      if (!q || !alive(q)) continue;
      if (v >= 0.45 && courtable(rec) && courtable(q) && !blood(rec, q)) opts.push(['sweet', { who: first(q), idx: q.idx }]);
      if (v <= -0.3 && (bond(rec, q) || q.job === 'mayor')) opts.push(['hidden_dislike', { who: first(q) }]);
    }
    const seen = recall(rec, day, (m) => ['robbed', 'wronged', 'quarrel', 'rumour_bad', 'betrayed'].includes(m.k) && m.n, 0.1)[0];
    if (seen) opts.push(['seen', { who: seen.n, what: seen.k }]);
    if ((rec.coins || 0) >= 40 && P(rec).kindness > 0.55) opts.push(['purse', {}]);
    if (!opts.length) return { lines: [line(npc, game, 'secret', { secretK: 'none' }, {}, 'Me? I\'m an open book.')] };
    const [k, v] = pick(rng, opts);
    if (k === 'purse') {
      const n = Math.min(20, Math.floor(rec.coins / 4));
      rec.coins -= n;
      game.player.give?.('coin', n);
      remember(rec, { k: 'gave', w: pkey(game), v: 0.5, s: 0.35 }, day);
    }
    if (k === 'dream') e.dreamSeen = rec.amb.d;
    const what = k === 'talent' ? ({ cooking: 'cooking', hunting: 'tracking', fishing: 'fishing', farming: 'growing things', trading: 'trade', building: 'building', crafting: 'making things', combat: 'fighting', lore: 'books', healing: 'healing', leadership: 'leading', charm: 'people' }[v.skill] || v.skill) : v.what || null;
    return { lines: [line(npc, game, 'secret', { secretK: k }, { who: v.who || null, what, ambWhat: ambitionWords(rec) }, 'I shouldn\'t say.')] };
  },

  // ---- friends
  intro(npc, game, arg) {
    const rec = npc.rec;
    const L = layoutOf(npc);
    if (arg === undefined || arg === null) {
      const choices = peopleChoices(npc, game, 'so_intro', (o) => o.age !== 'child' && !bond(rec, o));
      return choices.length ? { lines: ['Oh? Who?'], choices } : { lines: ['I know everyone here already, I think.'] };
    }
    const q = L.npcs[+arg];
    if (!q) return { lines: ['Who?'] };
    const e = entry(npc, game);
    const key = `${Math.min(rec.idx, q.idx)}-${Math.max(rec.idx, q.idx)}`;
    if ((e.intro || []).includes(key)) return { lines: ['You introduced us already!'] };
    (e.intro ||= []).push(key);
    const h = (game.hero && game.hero.stats && game.hero.stats.cha) || 2;
    const chem = chemistry(rec, q);
    const d = chem * 0.25 + (h - 2) * 0.02 + 0.05;
    warm(rec, nk(q), d);
    warm(q, nk(rec), d * 0.9);
    const pk = pkey(game);
    remember(rec, { k: 'introduced', w: nk(q), n: first(q), v: d > 0 ? 0.4 : -0.1, s: 0.3, x: pk }, game.day);
    // (A match, maybe.)
    let match = false;
    if (courtable(rec) && courtable(q) && !blood(rec, q) && chem > 0.3 && game.sim.saga && npc.rng.chance(0.35 + h * 0.06)) {
      const sid = L.settlement.id;
      const th = game.sim.saga.startStory('courtship', { cast: { a: { t: 'rec', sid, idx: rec.idx }, b: { t: 'rec', sid, idx: q.idx }, town: { t: 'town', sid } }, sid, touched: [pidOf(game.player)] });
      match = !!th;
      if (match) {
        stir(rec, 'love', 0.3, game.sim.abs);
        stir(q, 'love', 0.25, game.sim.abs);
      }
    }
    if (d > 0) game.sim.changeRep(npc, 2, 'kind');
    return { lines: [line(npc, game, 'intro', { introGood: d > 0.08, introBad: d < 0, introMatch: match }, { subj: first(q) }, d > 0 ? `${first(q)}? I'll look out for them.` : `${first(q)}? We've met. We didn't get on.`)] };
  },

  mediate(npc, game, arg) {
    const rec = npc.rec;
    const L = layoutOf(npc);
    const q = L.npcs[+arg];
    if (!q) return { lines: ['Who?'] };
    const e = entry(npc, game);
    if (e.mediate === game.day) return { lines: ['Not again. Not today.'] };
    e.mediate = game.day;
    const anger = feel(rec, 'anger', game.sim.abs);
    const ok = check(game, npc, 0.25 + P(rec).kindness * 0.3, anger * 0.4 + Math.max(0, -opinionOf(rec, nk(q)) - 0.4) * 0.5);
    if (ok) {
      warm(rec, nk(q), 0.35);
      warm(q, nk(rec), 0.25);
      stir(rec, 'anger', -0.3, game.sim.abs);
      stir(q, 'anger', -0.2, game.sim.abs);
      remember(rec, { k: 'peace_made', w: pkey(game), n: first(q), v: 0.6, s: 0.45 }, game.day);
      if (rec.amb && rec.amb.k === 'revenge' && rec.amb.t === nk(q)) rec.amb = null;
      if (q.amb && q.amb.k === 'revenge' && q.amb.t === nk(rec)) q.amb = null;
      // (Their households' feud, too.)
      const fe = L.econ.feuds;
      if (fe) L.econ.feuds = fe.filter((f) => !(f.k === [rec.household, q.household].sort().join('|')));
      game.sim.changeRep(npc, 4, 'kind');
      return { lines: [line(npc, game, 'mediate', { made: true }, { subj: first(q) }, `Maybe you're right about ${first(q)}.`)] };
    }
    stir(rec, 'anger', 0.1, game.sim.abs);
    warm(rec, pkey(game), -0.04);
    return { lines: [line(npc, game, 'mediate', { made: false }, { subj: first(q) }, 'Stay out of it.')] };
  },

  drink(npc, game) {
    const rec = npc.rec;
    const p = game.player;
    const e = entry(npc, game);
    if (countItem(p.inv, 'coin') < 2) return { lines: ['That\'s kind, but you\'ve not got the coin, friend.'] };
    if (npc.act === 'work' && rec.job !== 'barkeep' && game.sim.opinion(npc) < 40) return { lines: [line(npc, game, 'drink', { drinkNo: true }, {}, 'I\'m working. Another time.')] };
    removeItem(p.inv, 'coin', 2);
    e.drink = game.day;
    const now = game.sim.abs;
    if (!rec.override) setOverride(rec, now, now + 120, 'social', { place: 'tavern', feel: 'joy' });
    npc.activity = null;
    stir(rec, 'joy', 0.15, now);
    stir(rec, 'strain', -0.15, now);
    warm(rec, pkey(game), 0.08);
    remember(rec, { k: 'drink', w: pkey(game), v: 0.5, s: 0.3 }, game.day);
    game.sim.changeRep(npc, 3, 'kind');
    return { lines: [line(npc, game, 'drink', { drinkNo: false }, {}, 'Don\'t mind if I do!')], close: true };
  },

  spar(npc, game, arg) {
    if (arg !== 'go') return { lines: [line(npc, game, 'spar', { sparAsk: true }, {}, 'A friendly bout? Why not.')], choices: [{ id: 'so_spar', arg: 'go', label: 'On guard, then.' }, { id: 'bye', label: 'Maybe later.' }] };
    npc.spar = { pk: pkey(game) };
    game.startDuel(npc, 0);
    return { lines: [line(npc, game, 'spar', { sparAsk: false }, {}, 'Ready yourself!')], close: true };
  },

  teach(npc, game) {
    const rec = npc.rec;
    const e = entry(npc, game);
    e.taught = game.day;
    const k = Object.keys(TEACHES).filter((q) => skillOf(rec, q) >= 0.55).sort((a, b) => skillOf(rec, b) - skillOf(rec, a))[0];
    if (!k) return { lines: ['I\'ve nothing worth teaching.'] };
    const op = game.sim.opinion(npc);
    const p = game.player;
    if (op < 35 && countItem(p.inv, 'coin') < 5) return { lines: [line(npc, game, 'teach', { teachFee: true, teachNo: true }, {}, 'A lesson\'s ¤5. Come back when you have it.')] };
    if (op < 35) removeItem(p.inv, 'coin', 5);
    const craft = TEACHES[k];
    const n = 0.5 + skillOf(rec, k) * 1.5;
    const up = gainMastery(game, craft, n);
    practise(layoutOf(npc), rec, 'leadership', 0.004);
    warm(rec, pkey(game), 0.04);
    remember(rec, { k: 'taught', w: pkey(game), v: 0.4, s: 0.3, x: k }, game.day);
    return { lines: [line(npc, game, 'teach', { teachK: k, teachFee: op < 35 }, { what: CRAFTS[craft]?.name.toLowerCase() || k }, 'Watch closely, now.'), `(${CRAFTS[craft]?.name || craft}: ${up ? 'a rank higher!' : 'a little better.'})`] };
  },

  show(npc, game) {
    const rec = npc.rec;
    const e = entry(npc, game);
    e.showed = game.day;
    const opts = Object.entries(TEACHES).filter(([k, c]) => mastery(game, c).rank >= 4 && skillOf(rec, k) < 0.6);
    if (!opts.length) return { lines: ['I think I know that already.'] };
    const [k, c] = opts.sort((a, b) => mastery(game, b[1]).rank - mastery(game, a[1]).rank)[0];
    const r = mastery(game, c).rank;
    practise(layoutOf(npc), rec, k, 0.02, r / 10);
    stir(rec, 'joy', 0.1, game.sim.abs);
    warm(rec, pkey(game), 0.06);
    remember(rec, { k: 'shown', w: pkey(game), v: 0.5, s: 0.35, x: k }, game.day);
    game.sim.changeRep(npc, 2, 'kind');
    return { lines: [line(npc, game, 'show', { showK: k }, { what: CRAFTS[c]?.name.toLowerCase() || k }, 'Oh! I never thought of doing it that way.')] };
  },

  // ---- quarrels
  sorry(npc, game, arg) {
    const rec = npc.rec;
    const e = entry(npc, game);
    const m = grievanceOf(npc, game);
    if (!m) return { lines: ['For what? It\'s forgotten.'] };
    const now = game.sim.abs;
    const p = game.player;
    const price = Math.max(10, Math.round(m.s * (m.k === 'killed' ? 120 : 40)));
    if (arg === 'pay') {
      if (countItem(p.inv, 'coin') < price) return { lines: ['You haven\'t got it.'] };
      removeItem(p.inv, 'coin', price);
      rec.coins = (rec.coins || 0) + price;
      forgive(npc, game, m, 0.6);
      return { lines: [line(npc, game, 'sorry', { sorryOk: true, sorryPaid: true, sorryK: m.k }, { dead: m.n || null }, 'Very well. We\'re square.')] };
    }
    if (e.sorry === game.day) return { lines: ['You\'ve said it once today.'] };
    e.sorry = game.day;
    const p0 = P(rec);
    const sev = m.s + (m.k === 'killed' ? 0.6 : 0) + feel(rec, 'anger', now) * 0.3;
    const ok = check(game, npc, 0.2 + p0.kindness * 0.45 + Math.min(0.3, (game.day - m.d) * 0.02), sev * 0.5);
    if (ok) {
      forgive(npc, game, m, 0.45);
      return { lines: [line(npc, game, 'sorry', { sorryOk: true, sorryK: m.k }, { dead: m.n || null }, 'Well. Thank you for saying so.')] };
    }
    stir(rec, 'anger', 0.05, now);
    // (Words aren't enough: but coin might be.)
    if (m.k !== 'killed' || p0.kindness < 0.5) return { lines: [line(npc, game, 'sorry', { sorryOk: false, sorryK: m.k }, { dead: m.n || null, price: `¤${price}` }, 'Sorry? Sorry doesn\'t mend it.')], choices: [{ id: 'so_sorry', arg: 'pay', label: `(Offer ¤${price} to make it right)` }] };
    return { lines: [line(npc, game, 'sorry', { sorryOk: false, sorryK: m.k }, { dead: m.n || null }, 'Get out of my sight.')] };
  },

  threaten(npc, game) {
    const rec = npc.rec;
    const now = game.sim.abs;
    const pk = pkey(game);
    const p = game.player;
    const held = p.inv && p.inv[p.selected];
    const armed = !!(held && ITEMS[held.item] && ITEMS[held.item].kind === 'weapon');
    const dread = game.sim.justice && game.sim.justice.dreadIn ? game.sim.justice.dreadIn(npc.settlement.id) : 0;
    const ok = check(game, npc, 0.15 + (armed ? 0.15 : 0) + dread * 0.1, P(rec).bravery * 0.5 + (rec.job === 'guard' ? 0.3 : 0), 'str');
    remember(rec, { k: 'threatened', w: pk, v: -0.7, s: 0.6 }, game.day);
    warm(rec, pk, -0.2);
    if (ok) {
      stir(rec, 'fear', 0.5, now);
      stir(rec, 'anger', 0.15, now);
      game.sim.changeRep(npc, -8, 'rude');
      // (Cowed: whatever they had against you, they'll let lie. For now.)
      let cowed = false;
      if (rec.amb && rec.amb.k === 'revenge' && rec.amb.t === pk) {
        rec.amb = null;
        cowed = true;
      }
      const L = layoutOf(npc);
      const g = groupOf(L, rec);
      if (g && g.k === 'player' && g.x === pk && g.lead === rec.idx) {
        settleGrudge(L, g, game.day, 'cowed');
        cowed = true;
      }
      if (rec.seek && rec.seek.pk === pk) rec.seek = null;
      return { lines: [line(npc, game, 'threat', { threatOk: true, cowed }, {}, 'A-all right! All right. I don\'t want any trouble.')] };
    }
    stir(rec, 'anger', 0.4, now);
    game.sim.changeRep(npc, -12, 'rude');
    return { lines: [line(npc, game, 'threat', { threatOk: false }, {}, 'You don\'t frighten me.')] };
  },

  // ---- together
  group(npc, game, arg) {
    const rec = npc.rec;
    const L = layoutOf(npc);
    const [gid, act] = String(arg).split(':');
    const g = groupsOf(L).find((q) => q.id === +gid && !q.out);
    if (!g) return { lines: ['It\'s over now, all that.'] };
    const pk = pkey(game);
    const mem = g.mem.map((i) => L.npcs[i]).filter(Boolean);
    if (!act) {
      const choices = [];
      if (!g.sup.includes(pk)) choices.push({ id: 'so_group', arg: `${g.id}:join`, label: 'I\'m with you.' });
      choices.push({ id: 'so_group', arg: `${g.id}:calm`, label: '(Talk them down)' });
      if (g.k === 'hunger') choices.push({ id: 'so_group', arg: `${g.id}:give`, label: 'Here, for the hungry. (¤20)' });
      return { lines: [line(npc, game, 'group', {}, {}, `We want ${CAUSES[g.k].ask}. Is that so much?`)], choices };
    }
    if (act === 'join') {
      g.sup.push(pk);
      g.heat = Math.min(1.6, g.heat + 0.1);
      for (const r of mem) {
        warm(r, pk, 0.08);
        game.sim.changeRep(r.ent && !r.ent.dead ? r.ent : { rec: r, settlement: L.settlement, layout: L }, 2, 'kind');
      }
      return { lines: [line(npc, game, 'group_join', {}, {}, 'With you behind us, they\'ll have to listen!')] };
    }
    if (act === 'calm') {
      const ok = check(game, npc, 0.35, g.heat * 0.4 + feel(rec, 'anger', game.sim.abs) * 0.3);
      if (!ok) {
        warm(rec, pk, -0.04);
        return { lines: [line(npc, game, 'group_calm', { calmOk: false }, {}, 'Easy for you to say.')] };
      }
      g.heat = Math.max(0, g.heat - 0.45);
      for (const r of mem) stir(r, 'anger', -0.15, game.sim.abs);
      return { lines: [line(npc, game, 'group_calm', { calmOk: true }, {}, 'Maybe. Maybe we\'ve been hot-headed.')] };
    }
    if (act === 'give') {
      const p = game.player;
      if (countItem(p.inv, 'coin') < 20) return { lines: ['That\'s kind. But you\'ve not got it.'] };
      removeItem(p.inv, 'coin', 20);
      const hungry = mem.filter((r) => (r.hungry || 0) >= 1);
      const each = hungry.length ? Math.floor(20 / hungry.length) : 0;
      for (const r of hungry) {
        r.coins = (r.coins || 0) + each;
        warm(r, pk, 0.2);
        remember(r, { k: 'fed', w: pk, v: 0.9, s: 0.6 }, game.day);
      }
      g.out = { how: 'helped', day: game.day };
      game.sim.changeRep(npc, 6, 'kind');
      return { lines: [line(npc, game, 'group_give', {}, {}, 'Bless you. There are children who\'ll eat tonight.')] };
    }
    return { lines: ['Hm.'] };
  },

  plead(npc, game, arg) {
    const L = layoutOf(npc);
    const g = groupsOf(L).find((q) => q.id === +arg && !q.out);
    if (!g) return { lines: ['That\'s settled.'] };
    const e = entry(npc, game);
    if (e.plead === game.day) return { lines: ['I heard you the first time.'] };
    e.plead = game.day;
    const c = game.sim.mind.ctx(L, game.day, new RNG(hash4(g.id, game.day, 0x97)), residents(L), game.sim.abs);
    const mem = c.adults.filter((r) => g.mem.includes(r.idx));
    const share = mem.length / Math.max(1, c.adults.length);
    if (check(game, npc, 0.15 + share * 0.5 + g.sup.length * 0.1, g.k === 'mayor' ? 0.3 : 0)) {
      granted(c, g, mem, nameOf(npc.rec));
      return { lines: [line(npc, game, 'plead', { pleadOk: true }, { grpAsk: CAUSES[g.k].ask }, 'Very well. I\'ll see what can be done.')] };
    }
    return { lines: [line(npc, game, 'plead', { pleadOk: false }, { grpAsk: CAUSES[g.k].ask }, 'I\'ll not be told how to run this town.')] };
  },

  // ---- they came to you
  seek(npc, game, arg) {
    const rec = npc.rec;
    const s = rec.seek;
    if (!s || s.pk !== pkey(game)) return { lines: ['Never mind.'] };
    const pk = pkey(game);
    const L = layoutOf(npc);
    switch (s.k) {
      case 'confront':
      case 'group': {
        if (!arg) {
          const m = grievanceOf(npc, game);
          const n = s.k === 'group' ? (groupsOf(L).find((g) => g.id === s.g)?.mem.length || 3) : 1;
          const price = Math.max(10, Math.round((m ? m.s : 0.5) * 40 * Math.min(4, n)));
          return { lines: [line(npc, game, s.k === 'group' ? 'confront_group' : 'confront', {}, { what: m ? m.k : null, price: `¤${price}`, n: String(n) }, 'You and I need to talk.')], choices: [
            { id: 'so_seek', arg: 'sorry', label: 'I\'m sorry. Truly.' },
            { id: 'so_seek', arg: `pay:${price}`, label: `(Offer ¤${price} to make it right)` },
            { id: 'so_threaten', label: '(Threaten them)' },
            { id: 'so_seek', arg: 'leave', label: 'Leave me alone.' },
          ] };
        }
        const [act, amt] = String(arg).split(':');
        if (act === 'leave') {
          stir(rec, 'anger', 0.1, game.sim.abs);
          s.cool = game.sim.abs + DAY;
          return { lines: [line(npc, game, 'confront_end', { confrontHow: 'leave' }, {}, 'This isn\'t over.')], close: true };
        }
        if (act === 'pay') {
          const n = +amt;
          if (countItem(game.player.inv, 'coin') < n) return { lines: ['You haven\'t got it. Don\'t insult me.'] };
          removeItem(game.player.inv, 'coin', n);
          rec.coins = (rec.coins || 0) + n;
          settleWith(npc, game, s, 0.6);
          return { lines: [line(npc, game, 'confront_end', { confrontHow: 'paid' }, {}, 'Fine. We\'re square. For now.')] };
        }
        // Sorry.
        const grp = s.k === 'group' ? groupsOf(L).find((g) => g.id === s.g) : null;
        const ok = check(game, npc, 0.3 + P(rec).kindness * 0.35, (grp ? grp.heat * 0.3 : 0) + feel(rec, 'anger', game.sim.abs) * 0.3);
        if (ok) {
          settleWith(npc, game, s, 0.45);
          return { lines: [line(npc, game, 'confront_end', { confrontHow: 'forgiven' }, {}, 'Well. I\'ll take that. Don\'t make me regret it.')] };
        }
        s.cool = game.sim.abs + DAY;
        return { lines: [line(npc, game, 'confront_end', { confrontHow: 'refused' }, {}, 'Words. Just words.')] };
      }
      case 'thanks': {
        rec.seek = null;
        remember(rec, { k: 'thanked', w: pk, v: 0.4, s: 0.3 }, game.day);
        const gift = thanksGift(npc, game);
        if (gift) {
          const left = game.player.give ? game.player.give(gift.item, gift.n) : 0;
          if (left && game.spawnDrop) game.spawnDrop(gift.item, left, game.player.x, game.player.y, game.player.z, true);
          if (gift.item !== 'coin') removeItem(rec.inv || [], gift.item, gift.n);
          else rec.coins = Math.max(0, (rec.coins || 0) - gift.n);
        }
        return { lines: [line(npc, game, 'thanks', { thanksGift: !!gift }, { what: gift ? (gift.item === 'coin' ? `¤${gift.n}` : (ITEMS[gift.item]?.name || gift.item).toLowerCase()) : null }, 'Thank you. For everything.')] };
      }
      case 'advice': {
        const a = rec.amb;
        if (!a) {
          rec.seek = null;
          return { lines: ['Never mind. I\'ve made up my mind.'] };
        }
        if (!arg) return { lines: [line(npc, game, 'advice', {}, {}, 'Can I ask your advice?')], choices: [{ id: 'so_seek', arg: 'go', label: 'Go for it.' }, { id: 'so_seek', arg: 'wait', label: 'Give it some thought.' }, { id: 'so_seek', arg: 'no', label: 'I wouldn\'t, if I were you.' }] };
        rec.seek = null;
        if (arg === 'go') return encourage(npc, game, a, true);
        if (arg === 'no') return dissuade(npc, game, a, 0.2);
        return { lines: [line(npc, game, 'advice_wait', {}, {}, 'You\'re right. I\'ll sleep on it.')] };
      }
      case 'invite': {
        if (!arg) return { lines: [line(npc, game, 'invite', {}, {}, 'Come and have a drink with us!')], choices: [{ id: 'so_seek', arg: 'yes', label: 'I\'d love to.' }, { id: 'so_seek', arg: 'no', label: 'Not tonight, sorry.' }] };
        rec.seek = null;
        if (arg === 'yes') {
          const now = game.sim.abs;
          if (!rec.override) setOverride(rec, now, now + 120, 'social', { place: 'tavern', feel: 'joy' });
          npc.activity = null;
          stir(rec, 'joy', 0.2, now);
          warm(rec, pk, 0.08);
          remember(rec, { k: 'drink', w: pk, v: 0.5, s: 0.3 }, game.day);
          return { lines: [line(npc, game, 'invite_yes', {}, {}, 'Come on, then! First round\'s mine.')], close: true };
        }
        return { lines: ['Another time, then!'] };
      }
      case 'warn': {
        rec.seek = null;
        warm(rec, pk, 0.03);
        return { lines: [line(npc, game, 'warn', {}, { subj: s.n || 'someone' }, `Watch yourself. ${s.n || 'Someone'} has it in for you.`)] };
      }
      default:
        rec.seek = null;
        return { lines: ['Never mind.'] };
    }
  },
};

// Forgiven (a little or a lot): what they held against you weighs less.
function forgive(npc, game, m, by) {
  const rec = npc.rec;
  const pk = pkey(game);
  m.s = Math.round(m.s * (1 - by) * 100) / 100;
  m.v = Math.round(Math.min(-0.05, m.v * (1 - by)) * 100) / 100;
  stir(rec, 'anger', -0.35, game.sim.abs);
  warm(rec, pk, 0.15);
  remember(rec, { k: 'forgave', w: pk, v: 0.4, s: 0.35 }, game.day);
  game.sim.changeRep(npc, 4, 'kind');
  if (rec.amb && rec.amb.k === 'revenge' && rec.amb.t === pk) rec.amb = null;
  if (rec.seek && rec.seek.pk === pk && (rec.seek.k === 'confront' || rec.seek.k === 'group')) rec.seek = null;
}

// A confrontation settled (and, if they spoke for a group, the group's
// grudge with it).
function settleWith(npc, game, s, by) {
  const m = grievanceOf(npc, game);
  if (m) forgive(npc, game, m, by);
  else {
    npc.rec.seek = null;
    if (npc.rec.amb && npc.rec.amb.k === 'revenge') npc.rec.amb = null;
  }
  if (s.k === 'group') {
    const L = layoutOf(npc);
    const g = groupsOf(L).find((q) => q.id === s.g && !q.out);
    if (g) {
      for (const i of g.mem) {
        const r = L.npcs[i];
        if (r) warm(r, s.pk, 0.1);
      }
      settleGrudge(L, g, game.day, 'settled');
    }
  }
}

// Something to give you, out of thanks: what they make, or a little coin.
function thanksGift(npc, game) {
  const r = npc.rec;
  const inv = r.inv || [];
  const own = inv.find((q) => q && q.count > 0 && ITEMS[q.item] && q.item !== 'coin' && ['food', 'tool', 'material'].includes(ITEMS[q.item].kind));
  if (own) return { item: own.item, n: 1 };
  if ((r.coins || 0) >= 12) return { item: 'coin', n: Math.min(15, Math.floor(r.coins / 3)) };
  return null;
}

// What help you could give with what they're after (a label), or null.
function helpOffer(npc, game, a) {
  const p = game.player;
  const coins = countItem(p.inv, 'coin');
  const r = npc.rec;
  switch (a.k) {
    case 'master': {
      const g = TRADE_GOODS[r.job];
      return g && g !== 'coin' && countItem(p.inv, g) >= 2 ? `(Give them 2 ${(ITEMS[g]?.name || g).toLowerCase()} to practise with)` : coins >= 15 ? '(Give them ¤15 for better tools)' : null;
    }
    case 'trade': return coins >= 20 ? '(Pay their apprentice\'s fee: ¤20)' : null;
    case 'venture': return coins >= 25 ? '(Put ¤25 towards it)' : null;
    case 'wed': return a.n ? `I'll put in a good word with ${a.n}.` : null;
    case 'office': return 'I\'ll speak up for you.';
    case 'learn': return countItem(p.inv, 'book') ? '(Give them a book)' : coins >= 30 ? '(Pay towards their studies: ¤30)' : null;
    case 'leave': return coins >= 15 ? '(Give them ¤15 for the road)' : null;
    case 'protect': return 'Spar with me. I\'ll toughen you up.';
    case 'reconcile': return a.n ? `I'll talk to ${a.n} for you.` : null;
    case 'provide': return coins >= 10 ? '(Give them ¤10)' : countItem(p.inv, 'bread') ? '(Give them some bread)' : null;
    case 'revenge': return a.t === pkey(game) ? null : 'I\'ll help you get even.';
    default: return null;
  }
}

function encourage(npc, game, a, advised = false) {
  const rec = npc.rec;
  a.enc = pkey(game);
  a.p = clamp((a.p || 0) + 0.1, 0, 1);
  a.h = (a.h || 0) + 1;
  stir(rec, 'joy', 0.1, game.sim.abs);
  warm(rec, pkey(game), 0.04);
  if (a.k !== 'revenge') game.sim.changeRep(npc, 2, 'kind');
  return { lines: [line(npc, game, 'dream_enc', { advised }, {}, 'You think so? Thank you. I needed to hear that.')] };
}

function helpWith(npc, game, a) {
  const rec = npc.rec;
  const p = game.player;
  const L = layoutOf(npc);
  const pk = pkey(game);
  const pay = (n) => {
    if (countItem(p.inv, 'coin') < n) return false;
    removeItem(p.inv, 'coin', n);
    rec.coins = (rec.coins || 0) + n;
    return true;
  };
  let ok = true;
  switch (a.k) {
    case 'master': {
      const g = TRADE_GOODS[rec.job];
      if (g && g !== 'coin' && countItem(p.inv, g) >= 2) removeItem(p.inv, g, 2);
      else ok = pay(15);
      if (ok) practise(L, rec, a.x, 0.03);
      break;
    }
    case 'trade': ok = pay(20); if (ok) a.h = (a.h || 0) + 2; break;
    case 'venture': ok = pay(25); if (ok) a.p = clamp(a.p + 0.4, 0, 1); break;
    case 'wed': {
      const q = a.t ? L.npcs[+a.t.slice(2)] : null;
      if (!q) return { lines: ['Never mind.'] };
      if (check(game, q.ent && !q.ent.dead ? q.ent : npc, 0.3, 0)) warm(q, nk(rec), 0.15);
      a.h = (a.h || 0) + 1;
      break;
    }
    case 'office': a.p = clamp(a.p + 0.25, 0, 1); a.h = (a.h || 0) + 1; break;
    case 'learn':
      if (countItem(p.inv, 'book')) {
        removeItem(p.inv, 'book', 1);
        practise(L, rec, 'lore', 0.03);
      } else ok = pay(30);
      a.h = (a.h || 0) + 1;
      break;
    case 'leave': ok = pay(15); if (ok) a.p = clamp(a.p + 0.5, 0, 1); break;
    case 'protect': return ANSWERS.spar(npc, game);
    case 'reconcile': {
      const q = a.t ? L.npcs[+a.t.slice(2)] : null;
      if (q) warm(q, nk(rec), 0.12 + ((game.hero?.stats?.cha || 2) - 2) * 0.03);
      a.h = (a.h || 0) + 1;
      break;
    }
    case 'provide':
      if (countItem(p.inv, 'coin') >= 10) pay(10);
      else if (countItem(p.inv, 'bread')) {
        removeItem(p.inv, 'bread', 1);
        rec.fed = Math.max(rec.fed || 0, 1);
        rec.hungry = 0;
      } else ok = false;
      if (ok) remember(rec, { k: 'fed', w: pk, v: 0.9, s: 0.65 }, game.day);
      break;
    case 'revenge': a.p = clamp(a.p + 0.3, 0, 1); stir(rec, 'anger', 0.1, game.sim.abs); break;
    default: ok = false;
  }
  if (!ok) return { lines: ['That\'s kind. But you haven\'t the means.'] };
  a.h = a.h || 1;
  warm(rec, pk, a.k === 'revenge' ? 0.12 : 0.1);
  if (a.k !== 'revenge') {
    remember(rec, { k: 'helped', w: pk, v: 0.8, s: 0.55, x: a.k }, game.day);
    game.sim.changeRep(npc, 5, 'kind');
  }
  return { lines: [line(npc, game, 'dream_help', {}, {}, 'You\'d do that? I don\'t know what to say.')] };
}

function dissuade(npc, game, a, bonus = 0) {
  const rec = npc.rec;
  const L = layoutOf(npc);
  const c = game.sim.mind.ctx(L, game.day);
  const w = AMBITIONS[a.k].want(c, rec);
  const ok = check(game, npc, 0.3 + bonus, (w ? Math.max(0, w.s) : 0.2) * 0.6 + (a.p || 0) * 0.2);
  if (!ok) {
    warm(rec, pkey(game), -0.03);
    return { lines: [line(npc, game, 'dream_stop', { stopOk: false }, {}, 'My mind\'s made up.')] };
  }
  game.sim.mind.endAmb(c, rec, 'let_go', { k: 'talked_out', w: pkey(game), x: a.k });
  if (a.k === 'revenge' || a.k === 'leave') {
    warm(rec, pkey(game), 0.08);
    game.sim.changeRep(npc, 3, 'kind');
  }
  return { lines: [line(npc, game, 'dream_stop', { stopOk: true }, {}, 'Maybe you\'re right. Maybe.')] };
}

// ------------------------------------------------------------ they come to you
const SEEK_LABELS = { confront: 'You wanted a word with me?', group: 'You wanted a word?', thanks: 'You were looking for me?', advice: 'You wanted to ask me something?', invite: 'You were looking for me?', warn: 'What is it?' };
function seekLabel(s) {
  return SEEK_LABELS[s.k] || 'You wanted me?';
}

// What they say, coming over (a bubble).
export function seekLine(npc, game, s) {
  return line(npc, game, 'seek', { seekK: s.k }, { subj: s.n || null }, s.k === 'confront' || s.k === 'group' ? 'You! A word.' : `${game.playerName ? game.playerName.split(' ')[0] : 'Friend'}! A moment?`);
}

// In the square with the others: what they shout.
export function rallyBark(npc, game) {
  const L = layoutOf(npc);
  const g = L ? groupOf(L, npc.rec) : null;
  return line(npc, game, 'rally', { rallyK: g ? g.k : null, rallyLead: !!(g && g.lead === npc.rec.idx) }, {}, null);
}

// A friendly bout over (see Game.endDuel): practice for them, a story to
// tell for both.
export function sparDone(game, npc, result) {
  if (!npc || !npc.rec || !npc.spar) return;
  const rec = npc.rec;
  const pk = npc.spar.pk;
  npc.spar = null;
  if (result === 'fled') return;
  const L = layoutOf(npc);
  const won = result !== 'won';
  practise(L, rec, 'combat', 0.03, 0.6);
  if (rec.amb && rec.amb.k === 'protect') rec.amb.h = (rec.amb.h || 0) + 1;
  stir(rec, won ? 'pride' : 'joy', 0.15, game.sim.abs);
  warm(rec, pk, 0.06);
  remember(rec, { k: 'sparred', w: pk, v: 0.4, s: 0.3, x: won ? 'won' : 'lost' }, game.day);
}

// ------------------------------------------------------------ fallbacks
function gossipFallback(m, subj) {
  const n = m.n || (subj ? first(subj) : 'someone');
  return {
    loss: `Did you hear? We lost ${n}.`, born: `${n} was born, to the delight of all.`, wed: `${n} got married!`, raid: 'There was a raid. Frightening business.',
    robbed: 'Someone was robbed, in broad daylight.', bad_word: `${m.x || 'Someone'}'s been saying things about ${n}.`, friend: `${n} and I have become friends.`, quarrel: `${n} and I had words.`,
  }[m.k] || `You know ${n}? Well...`;
}

function heardLabel(m) {
  const n = m.n || 'someone';
  const where = m.town ? ` (in ${m.town})` : '';
  return {
    loss: `${n} has died${where}.`, born: `${n} was born${where}.`, wed: `${n} got married${where}.`, raid: `There was a raid${where}.`, robbed: `Someone was robbed${where}.`,
    bad_word: `${m.x || 'Someone'} has been bad-mouthing ${n}.`, rumour_bad: `${n} isn't to be trusted.`, rumour_good: `${n} has a good heart.`, friend: `${m.fromName || 'Someone'} and ${n} are friends now.`,
    quarrel: `${m.fromName || 'Someone'} and ${n} have fallen out.`, mastery: `${n} is a master of their trade now.`, dream_done: `${n} got what they always wanted.`, dream_lost: `${n}'s dream came to nothing.`,
    heartbreak: `${n} has had their heart broken.`, rival: `${m.fromName || 'Someone'} and ${n} are rivals.`, feast: `There was a grand feast${where}.`, petition_won: `The townsfolk${where} won their petition.`,
    vigil: `They held a vigil for ${n}${where}.`, crowned: `There's a new ruler${where}.`, exiled: `Someone was banished${where}.`, saved: `Someone was saved${where}.`, hurt: `Someone was hurt${where}.`,
  }[m.k] || `Something about ${n}${where}.`;
}

function thinkFallback(band, n) {
  return { hate: `${n}? I can't stand them.`, dislike: `${n}? We don't see eye to eye.`, adore: `${n}? I'd do anything for them.`, like: `${n}? Good sort.`, polite: `${n}? Oh, they're fine.` }[band] || `${n}? I don't know them well.`;
}

function meFallback(band) {
  return { hate: 'You really want to know? I can\'t stand you.', dislike: 'I don\'t trust you. There. You asked.', adore: 'You\'re one of the best people I know.', like: 'I like you. You\'re all right.', polite: 'Oh, you\'re fine. Why do you ask?' }[band] || 'I don\'t know you well enough to say.';
}

export { dominant };
