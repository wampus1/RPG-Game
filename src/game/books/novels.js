// (Round 127) Novels: the stories the people of the island write. A story
// is a series: its writer, its cast (a hero, a friend, an elder and a
// villain, each with a name and a he or she), its setting (the writer's own
// town, an old place near it, a war of the long past that the elder marched
// to), its kind (a quest, a mystery, a romance), and its books, each with
// how it came out: who lived, who got away, what was lost, and the thread
// left hanging at the end. A sequel picks that thread up (the villain who
// fled comes back; the one who died has a child; the second door is
// opened); a prequel goes back to the war, and ends where the first book
// began.
//
// A series is plain data (ids, names, rolls of the dice), so it can be
// kept in a save and written out again, word for word, whenever it's
// opened. See corpus/fiction.js for the words.
import { RNG, hash4 } from '../../util/rng.js';
import { expand } from '../talk/grammar.js';
import { personName } from '../../world/names.js';
import { FICTION, PLOTS } from './corpus/fiction.js';
import { tidy } from './write.js';
import { cap } from './lore.js';

export const NOVEL_KINDS = ['quest', 'mystery', 'romance'];
const SOFT = /(a|ie|ette|elle|ine|wen|yn|ey|is)$/i;

const PRON = {
  he: { he: 'he', He: 'He', his: 'his', His: 'His', him: 'him', himself: 'himself', man: 'man', rel: 'father' },
  she: { he: 'she', He: 'She', his: 'her', His: 'Her', him: 'her', himself: 'herself', man: 'woman', rel: 'mother' },
};

const TRADES = ['a cooper\'s apprentice', 'the miller\'s youngest', 'a clerk at the hall', 'a net-mender', 'a baker', 'a stable hand at the inn', 'a schoolmaster\'s assistant', 'a woodcutter', 'a carter', 'a dyer', 'a candle-maker', 'a shepherd'];
const FLAWS = ['too proud to ask for help', 'afraid of the dark, though {he} would have died before admitting it', 'quick to anger and slow to forgive', 'trusting to a fault', 'more curious than was good for {him}', 'stubborn as a gatepost'];
// (Round 128) The same flaw, come back to later in the book: said another
// way, not word for word as it was in the first chapter.
const FLAWBACK = ['the pride that would not let {him} call out for help', 'the old fear of the dark that {he} had never owned to', 'the temper {he} had never learned to keep', 'the trust {he} gave too easily', 'the curiosity that had brought {him} down here in the first place', 'the stubbornness that had carried {him} this far'];
const FWAS = ['who had been {his} friend since they were six', 'the smith\'s youngest, and the only person in {home} who could beat {him} at anything', 'a fisher\'s child with a laugh you could hear across the harbour', 'who had once, at the age of eight, bitten {him}, and been {his} friend ever since'];
const VWHAT = ['the steward of the hall', 'the moneylender', 'the reeve', 'the keeper of the granary', 'a member of the council'];
const MTRADES = ['a farmer\'s child with a borrowed spear', 'a thatcher\'s apprentice', 'the youngest of six', 'a drover\'s child'];
// The thing at the heart of a quest: kept in the temple, and sought.
const THINGS = [
  { name: 'the Lamp of {founder}', short: 'the lamp', what: 'a bronze lamp that was said to have burned since the founding', kept: 'on a shelf of black stone behind the altar' },
  { name: 'the Bell of {home}', short: 'the bell', what: 'a small bell of grey metal that had rung for every death in {home} for three hundred years', kept: 'in a niche above the door' },
  { name: 'the Charter of {home}', short: 'the charter', what: 'the first charter of the town, written on calfskin and sealed in green wax', kept: 'in an iron box beneath the altar' },
  { name: 'the Founder\'s Cup', short: 'the cup', what: 'a cup of dark horn bound in silver, from which {founder} was said to have drunk on the first night', kept: 'in a case of oak and glass' },
  { name: 'the Map of {place}', short: 'the map', what: 'a map on a scrap of hide, older than anyone could say, that showed the way into {place} and, some said, the way out', kept: 'in a sealed jar on the altar' },
];

// Number words, for "{years} Years On" and "twenty years".
const ONES = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
function words(n) {
  n = Math.max(0, Math.round(n));
  if (n < 20) return ONES[n];
  if (n < 100) return `${TENS[Math.floor(n / 10)]}${n % 10 ? `-${ONES[n % 10]}` : ''}`;
  return String(n);
}
const ORD = ['Nought', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten'];
const SMALL = /^(of|and|the|in|at|to|a|an|for|from)$/i;
const titled = (t) => t.split(' ').map((w, i) => (i && SMALL.test(w) ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1))).join(' ');

// ------------------------------------------------------------ a series
// A new series, by a writer of a town: its kind, its cast, its setting,
// and the first book (in `year`). `author`: { name, sign, voice, ... }.
export function newSeries(lore, { seed, home, author, year, kind = null }) {
  const rng = new RNG(seed >>> 0 || 1);
  const T = lore.town(home);
  const style = T.style;
  kind ||= pickKind(rng, author.voice);
  const firsts = new Set();
  // (Each one a he or a she, as the writer imagines them; and given, if a
  // few tries find one, a name that sits easily with it on the page.)
  const person = () => {
    const g = rng.chance(0.5) ? 'he' : 'she';
    let n = personName(rng, style);
    for (let t = 0; t < 8 && (firsts.has(n.first) || SOFT.test(n.first) !== (g === 'she')); t++) n = personName(rng, style);
    for (let t = 0; t < 6 && firsts.has(n.first); t++) n = personName(rng, style);
    firsts.add(n.first);
    return { first: n.first, last: n.last, g };
  };
  const cast = { hero: person(), friend: person(), mentor: person(), villain: person(), comrade: person(), villain2: person(), victim: person(), captain: person() };
  // (A grandparent of a romance shares the family name.)
  if (kind === 'romance') cast.mentor.last = cast.hero.last;
  // The war the elder marched to: one of the long past, the town's own
  // realm's if it fought one.
  // (Long enough before the story for the elder to have grown old since.)
  const old = lore.wars.filter((w) => !w.live && w.battles.length && w.end !== null && w.battles.some((q) => q.y <= year - 18 && q.y >= year - 60));
  const mine = old.filter((w) => T.realm && (w.a === T.realm || w.b === T.realm));
  const war = mine.length ? rng.pick(mine) : old.length ? rng.pick(old) : null;
  const battle = war ? rng.pick(war.battles.filter((q) => q.y <= year - 18 && q.y >= year - 60)) : null;
  // The old places: the town's own, else the nearest.
  const places = placesNear(lore, home);
  const s = {
    id: `nv${(seed >>> 0).toString(36)}`, seed: seed >>> 0, kind, home: home.id, author,
    cast, war: war ? war.name : null, battle: battle ? battle.name : null,
    place: places[0] ? places[0].id : null, place2: places[1] ? places[1].id : null,
    thing: rng.int(0, THINGS.length - 1), trade: rng.int(0, TRADES.length - 1), trade2: rng.int(0, TRADES.length - 1), flaw: rng.int(0, FLAWS.length - 1),
    fwas: rng.int(0, FWAS.length - 1), vwhat: rng.int(0, VWHAT.length - 1), mtrade: rng.int(0, MTRADES.length - 1),
    books: [],
  };
  addBook(lore, s, 'first', year);
  return s;
}

function pickKind(rng, voice) {
  const w = { quest: 1, mystery: 1, romance: 1 };
  if (voice === 'storyteller' || voice === 'chronicler') w.quest += 1;
  if (voice === 'scholar' || voice === 'plain') w.mystery += 1;
  if (voice === 'lyrical' || voice === 'pious') w.romance += 1;
  let r = rng.next() * (w.quest + w.mystery + w.romance);
  for (const k of NOVEL_KINDS) if ((r -= w[k]) <= 0) return k;
  return 'quest';
}

function placesNear(lore, home) {
  const all = lore.dungeons((d) => !d.under && d.type !== 'kavorent');
  const own = all.filter((d) => d.town === home.id);
  const rest = all.filter((d) => d.town !== home.id && (lore.ow.settlements[d.town] || {}).island === home.island)
    .sort((a, b) => Math.hypot(a.cx - home.cx, a.cz - home.cz) - Math.hypot(b.cx - home.cx, b.cz - home.cz));
  return [...own, ...rest].slice(0, 2);
}

// A book more of a series: a sequel (some years after the last of the
// story), or a prequel (the war, before it all). Its outcome rolled now
// and kept, so the next book knows how this one came out.
export function addBook(lore, s, type, year) {
  const k = s.books.length;
  const rng = new RNG(hash4(s.seed, k, 0xb00c, 7));
  const first = s.books[0] || null;
  const o = { type, year };
  if (type === 'first') {
    if (s.kind === 'quest') {
      o.mfate = rng.chance(0.55) ? 'dead' : 'alive';
      o.vfate = rng.pick(['dead', 'fled', 'caught']);
      o.thing = rng.chance(0.25) ? 'lost' : 'kept';
      o.hook = o.thing === 'lost' && rng.chance(0.6) ? 'deep' : o.vfate === 'fled' ? 'villain' : o.vfate === 'dead' ? rng.pick(['kin', 'door']) : 'door';
      o.call = o.hook === 'door' && o.vfate === 'caught' && rng.chance(0.5) ? 'caught' : o.hook;
    } else if (s.kind === 'mystery') {
      o.mfate = 'dead';
      o.vfate = rng.pick(['caught', 'fled', 'dead']);
      o.hook = rng.chance(0.2) ? 'deep' : o.vfate === 'fled' ? 'villain' : o.vfate === 'dead' ? 'kin' : 'door';
      o.call = o.hook === 'door' && rng.chance(0.4) ? 'caught' : o.hook;
    } else {
      o.love = rng.chance(0.7) ? 'together' : 'apart';
      o.hook = rng.pick(['villain', 'kin', 'door', 'deep']);
      o.mfate = o.hook === 'kin' ? 'dead' : rng.chance(0.5) ? 'dead' : 'alive';
      o.call = o.hook;
    }
    o.ffate = s.kind === 'romance' ? o.love : rng.chance(0.65) ? 'together' : 'apart';
  } else if (type === 'sequel') {
    o.after = first.year;
  } else {
    o.before = first.year;
  }
  o.title = titleOf(lore, s, o, rng);
  s.books.push(o);
  return o;
}

// May a series have another book, and of what kind? (A sequel once, a
// prequel once.)
export function nextBookType(s) {
  if (!s.books.some((b) => b.type === 'sequel')) return 'sequel';
  if (!s.books.some((b) => b.type === 'prequel') && s.war) return 'prequel';
  return null;
}

// ------------------------------------------------------------ the facts
function pronouns(p, pre, out) {
  const P = PRON[p.g];
  // ("{He}" the hero's; "{FHe}", "{fhe}" the friend's; and so on.)
  for (const [k, v] of Object.entries(P)) {
    if (!pre) out[k] = v;
    else out[/^[A-Z]/.test(k) ? `${pre.toUpperCase()}${k}` : `${pre}${k}`] = v;
  }
}

function factsOf(lore, s, k) {
  const home = lore.ow.settlements[s.home];
  const T = lore.town(home);
  const b = s.books[k];
  const first = s.books[0];
  const C = s.cast;
  const war = lore.wars.find((w) => w.name === s.war) || null;
  const battle = war ? war.battles.find((q) => q.name === s.battle) || war.battles[0] : null;
  const myRealm = T.realm;
  const foe = war ? (myRealm && war.b === myRealm ? war.a : war.a === myRealm ? war.b : war.b) : null;
  const dOf = (id) => (id === null || id === undefined ? null : lore.dungeons((d) => d.id === id)[0] || null);
  const usePlace2 = b.type === 'sequel' && !['door', 'deep'].includes(first.call);
  const d = dOf(usePlace2 && s.place2 !== null ? s.place2 : s.place);
  const d1 = dOf(s.place);
  const nbs = lore.neighbours(home, 2);
  const town2 = nbs[0] ? nbs[0].T.name : 'the next town';
  // (The city: the realm's seat, unless that's here; then the next town
  // but one.)
  const city = T.realm && T.realm.capName && T.realm.capName !== T.name && T.realm.capName !== town2 ? T.realm.capName : nbs[1] ? nbs[1].T.name : 'the city';
  const f = T.faith;
  const founder = T.hist ? T.hist.founder : `the first folk of ${T.name}`;
  const placeName = d ? d.name : 'the old mine in the hills';
  const thingT = THINGS[s.thing];
  const sub = (t) => t.replace('{founder}', founder).replace('{home}', T.name).replace('{place}', d1 ? d1.name : placeName);
  const dwell = d ? lore.dwellers(d).slice(0, 3).map((n) => plural(n.toLowerCase())) : [];
  const way = d ? (lore.whereOf(d).match(/(north-east|north-west|south-east|south-west|north|south|east|west)/) || [null, 'north'])[1] : 'north';
  const F = {
    hero: C.hero.first, last: C.hero.last, friend: C.friend.first, mentor: C.mentor.first, villain: C.villain.first,
    comrade: C.comrade.first, villain2: C.villain2.first, victim: C.victim.first,
    home: T.name, homekind: T.kind, people: T.realm ? T.realm.people : peopleWord(T.style), ground: T.ground, water: T.water || 'the river',
    god: f ? f.god : 'the old gods', feast: f ? f.feast : 'midwinter', clergy: f ? f.clergy : 'priest', clergies: f ? `${f.clergy}s` : 'priests',
    ruler: T.realm && T.realm.ruler ? T.realm.ruler : null, capital: city,
    war: war ? war.name : 'the old war', battle: battle ? battle.name : 'the battle at the ford', enemy: foe ? foe.people : 'enemy',
    battleyear: battle ? String(battle.y) : null, winner: battle ? battle.winner.name : 'neither side',
    battletitle: battle ? titled(cap(battle.name)) : 'The Battle',
    place: placeName, where: d ? lore.whereOf(d) : `in the hills above ${T.name}`, dwellers: dwell.length ? listOf(dwell) : 'rats, and worse than rats',
    thing: sub(thingT.name), thingshort: thingT.short, thingwhat: sub(thingT.what), kept: thingT.kept,
    town2, dish: T.dishes[0] ? T.dishes[0].toLowerCase() : 'bread', drink: T.cuisine.drink,
    trade: TRADES[b.type === 'sequel' ? s.trade2 : s.trade], thetrade: TRADES[b.type === 'sequel' ? s.trade2 : s.trade].replace(/^an? /, 'the '), flaw: FLAWS[s.flaw], flawback: FLAWBACK[s.flaw], fwas: FWAS[s.fwas], vwhat: VWHAT[s.vwhat], mtrade: MTRADES[s.mtrade],
    gate: way, way, year: String(b.type === 'prequel' ? (battle ? battle.y - 1 : b.year) : b.year),
    titlething: titled(sub(thingT.name)), titleplace: titled(cap(placeName)),
  };
  pronouns(C.hero, '', F);
  pronouns(C.friend, 'f', F);
  pronouns(C.mentor, 'm', F);
  pronouns(C.villain, 'v', F);
  pronouns(C.comrade, 'c', F);
  pronouns(C.victim, 'x', F);
  pronouns(C.captain, 'k2', F);
  F.fman = PRON[C.friend.g].man;
  // (The kin who comes back: the villain's own child, or the villain
  // again.)
  const kin = ['villain', 'caught'].includes(first.call) ? C.villain : C.villain2;
  if (['villain', 'caught'].includes(first.call)) F.villain2 = C.villain.first;
  pronouns(kin, 'k', F);
  F.kman = PRON[kin.g].man;
  F.vrel = PRON[C.villain.g].rel;
  F.vrel2 = `${PRON[kin.g].his} ${F.vrel}'s`;
  F.kfather = `${PRON[kin.g].his} ${PRON[C.comrade.g].rel}`;
  F.KHe2 = PRON[C.captain.g].He;
  F.khe2 = PRON[C.captain.g].he;
  F.khim2 = PRON[C.captain.g].him;
  // How long ago, and how long after.
  const by = battle ? battle.y : first.year - 30;
  F.warago = words(first.year - by);
  F.Warago = cap(F.warago);
  if (b.type === 'sequel') {
    F.years = words(b.year - first.year);
    F.Years = cap(F.years);
    F.prevplace = d1 ? d1.name : placeName;
    F.prevthing = F.thing;
    F.prevtitle = first.title;
  }
  if (b.type === 'prequel') F.later = words(first.year - by);
  return F;
}

const peopleWord = (style) => cap(style);
function plural(w) {
  if (/(s|sh|ch|x)$/.test(w)) return `${w}es`;
  if (/[^aeiou]y$/.test(w)) return w.replace(/y$/, 'ies');
  if (/(wol|el|hal|lea|thie)f$/.test(w)) return w.replace(/f$/, 'ves');
  if (/man$/.test(w)) return w.replace(/man$/, 'men');
  if (/(sheep|deer|fish|folk)$/.test(w)) return w;
  return `${w}s`;
}
function listOf(xs) {
  if (xs.length <= 1) return xs[0] || '';
  return `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`;
}

// ------------------------------------------------------------ titles
function titleOf(lore, s, o, rng) {
  const home = lore.ow.settlements[s.home];
  const T = lore.town(home);
  const C = s.cast;
  const d = s.place !== null ? lore.dungeons((q) => q.id === s.place)[0] : null;
  const place = d ? d.name : 'the Hills';
  const f = T.faith;
  const feast = f ? f.feast : 'Midwinter';
  const nb = lore.neighbours(home, 1)[0];
  const town2 = nb ? nb.T.name : 'the Next Town';
  const thing = THINGS[s.thing];
  const thingName = thing.name.replace('{founder}', T.hist ? T.hist.founder : T.name).replace('{home}', T.name).replace('{place}', place);
  const war = s.war || 'the Old War';
  const first = s.books[0];
  let opts;
  if (o.type === 'first') {
    opts = {
      quest: [cap(thingName), `${C.hero.first}'s Road`, `The Road to ${cap(place)}`, `Below ${cap(place)}`, `The Theft at ${T.name}`],
      mystery: [`A Death at ${feast}`, `The ${T.name} Affair`, 'What the River Kept', 'The Brass Button', `The Roll of ${T.name}`],
      romance: [`Lamplight at ${T.name}`, 'The Boundary Wall', /^the /i.test(feast) ? `${cap(feast)} Dance` : `A ${feast} Dance`, 'Rosemary', `The Orchard at ${T.name}`],
    }[s.kind];
  } else if (o.type === 'sequel') {
    const call = first.call;
    opts = {
      quest: [`Return to ${cap(place)}`, call === 'door' ? 'The Second Door' : call === 'deep' ? `What Woke Below ${cap(place)}` : call === 'kin' ? `${C.villain2.first}` : `The Return of ${C.villain.first}`, `${C.hero.first} and the Long Road`],
      mystery: [`Another Death at ${T.name}`, call === 'door' ? 'The Second Name' : 'A Cup of Sweet Tea', `${C.hero.first} Investigates`],
      romance: [`The Bridge at ${town2}`, 'The Orchard Years', `Winter in ${town2}`],
    }[s.kind];
  } else {
    opts = [`Before ${C.hero.first}: A Tale of ${cap(war)}`, `The Year of ${titled(cap(s.battle || 'the Battle'))}`, `Young ${C.mentor.first}`, `${C.mentor.first} at ${titled(cap(s.battle || 'the Ford'))}`, 'The Fiddler\'s War'];
  }
  return titled(rng.pick(opts));
}

// ------------------------------------------------------------ the words
// Which pool a beat says, for how the story went.
function poolFor(s, b, first, beat) {
  const kind = s.kind;
  const o = b.type === 'first' ? b : first;
  const q = (name) => (beat.includes('.') ? beat : `${kind}.${beat}`) + (name ? `.${name}` : '');
  if (b.type === 'first') {
    if (kind === 'quest') {
      if (beat === 'dark') return q(`m${o.mfate}`);
      if (beat === 'climax') return q(`v${o.vfate}`);
      if (beat === 'after') return q(o.thing);
      if (beat === 'home2') return q(`m${o.mfate}`);
      if (beat === 'end') return q(o.hook);
    }
    if (kind === 'mystery') {
      if (beat === 'climax') return `mystery.reveal.v${o.vfate}`;
      if (beat === 'end') return q(o.hook);
    }
    if (kind === 'romance') {
      if (beat === 'climax') return `romance.end.${o.love}`;
      if (beat === 'end') return q(o.hook);
    }
    return q();
  }
  // (A sequel's and a prequel's beats name their own pools.)
  switch (beat) {
    case 'seq.open': return `seq.open.${kind}`;
    case 'seq.friend': return `seq.friend.${o.ffate}`;
    case 'seq.mentor': return `seq.mentor.${o.mfate}`;
    case 'seq.call': return `seq.call.${o.call}`;
    case 'sq.leave': return `sq.leave.${o.ffate}`;
    case 'sq.memory': return `sq.memory.${o.mfate}`;
    case 'sq.arrive': return ['door', 'deep'].includes(o.call) || s.place2 === null ? 'sq.arrive.same' : 'sq.arrive.new';
    case 'sq.face': return `sq.face.${o.call}`;
    case 'sq.climax': return `sq.climax.${o.call === 'caught' && b.k % 2 ? 'caught' : o.call}`;
    case 'sm.friend': return `sm.friend.${o.ffate}`;
    case 'sm.clue': return `sm.clue.${o.call}`;
    case 'sr.trouble': return `sr.trouble.${o.call}`;
    case 'sr.resolve': return `sr.resolve.${o.call}`;
    case 'sr.end': return `sr.end.${o.ffate}`;
    default: return beat;
  }
}

// A paragraph, from a pool (the writer's own way with it, now and then).
function say(pool, F, rng, voice, used) {
  const own = FICTION[`${pool}@${voice}`];
  let frames = FICTION[pool] || [];
  if (own && rng.chance(0.6)) frames = own;
  // (Not one with a blank this story can't fill: no ruler, for a free
  // town.)
  const fits = (t) => (t.match(/\{(\w+)\}/g) || []).every((m) => F[m.slice(1, -1)] !== undefined && F[m.slice(1, -1)] !== null);
  frames = frames.filter((t) => !used.has(t) && fits(t));
  if (!frames.length) frames = (FICTION[pool] || []).filter((t) => !used.has(t) && fits(t));
  if (!frames.length) return null;
  const t = rng.pick(frames);
  used.add(t);
  return prose(expand(t, rng), F);
}

// The blanks filled (twice over: a trade or a flaw has blanks of its own),
// and every sentence started with its capital.
export function prose(text, F) {
  let s = text;
  for (let i = 0; i < 2; i++) s = s.replace(/\{(\w+)\}/g, (m, k) => (F[k] !== undefined && F[k] !== null ? F[k] : m));
  s = tidy(s);
  s = s.replace(/([.!?])(\s+)(["']?)([a-z])/g, (m, p, sp, q, c) => `${p}${sp}${q}${c.toUpperCase()}`);
  s = s.replace(/(\.["'])(\s+)([a-z])/g, (m, p, sp, c) => `${p}${sp}${c.toUpperCase()}`);
  s = s.replace(/^(["'])([a-z])/, (m, q, c) => q + c.toUpperCase());
  return s;
}

// A book of a series, written out: its lines (as books.js writes them),
// title, writer and year.
export function writeNovel(lore, s, k) {
  const b = s.books[k];
  const first = s.books[0];
  b.k = k;
  const F = factsOf(lore, s, k);
  const rng = new RNG(hash4(s.seed, k, 0x5e17, 3));
  const voice = s.author.voice || 'storyteller';
  const plot = b.type === 'first' ? PLOTS[s.kind] : PLOTS[`${b.type}.${s.kind}`];
  const out = [];
  // (Front matter: the dedication, and the writer's other books.)
  const ded = rng.pick([`For ${rng.pick(['my mother', 'my father', 'everyone in ' + F.home, 'the ones who came home', 'those who asked what happened next'])}`, 'For anyone who has ever been afraid of the dark', null]);
  if (ded) out.push(`> ${ded}`);
  const others = s.books.filter((q, i) => i !== k && q.year <= b.year).map((q) => q.title);
  if (others.length) out.push(`> Also by ${s.author.name}: ${others.join('; ')}`);
  const used = new Set();
  plot.forEach(([title, beats], i) => {
    if (out.length) out.push('\f');
    const t = prose(title, F).replace(/\.$/, '');
    out.push(`# Chapter ${ORD[i + 1] || i + 1}: ${titled(t)}`);
    for (const beat of beats) {
      const pool = poolFor(s, b, first, beat);
      const p = say(pool, F, rng, voice, used);
      if (p) out.push(p);
    }
  });
  out.push('~');
  return { title: b.title, by: s.author.name, sign: s.author.sign, year: b.year, lines: out, genre: 'novel', id: `novel:${s.id}:${k}` };
}

// What a book of a series is about, in a line (for a reader's word of it,
// a shopkeeper's, a notice of it).
export function blurbOf(lore, s, k) {
  const b = s.books[k];
  const F = factsOf(lore, s, k);
  const L = {
    quest: [`${F.hero} ${F.last}, ${F.trade}, goes after the thief of ${F.thing}`, `a theft from the temple of ${F.home}, and a journey to ${F.place}`],
    mystery: [`a death at ${F.feast}, and ${F.hero} ${F.last}, who will not leave it alone`, `old ${F.mentor} found dead in the mill-race, and a secret from ${F.battle}`],
    romance: [`a ${F.home} family, a ${F.town2} one, and a quarrel as old as ${F.war}`, `two young people from towns that will not speak to each other`],
  }[s.kind];
  if (b.type === 'sequel') return `${F.hero} ${F.last} again, ${F.years} years after ${first(s).title}`;
  if (b.type === 'prequel') return `young ${F.mentor} and the war, long before ${first(s).title}`;
  return L[k % L.length];
}
const first = (s) => s.books[0];
