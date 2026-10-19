// (Round 126) Books: written, not shelved. Every book on every shelf is
// one of the world's own library: a town's annals, the history of a realm,
// an account of a war, a traveller's road, a people's table, the old
// places about a town, the beasts of a land, the things that were here
// before anyone, a book of a faith. What's in it is the world (see
// lore.js); how it's said is the chains' (see write.js).
//
// The library is the same for everyone and every time: each book is a kind
// and a subject (a town, a realm, a war, a land) and a number (there's more
// than one book on most things), and from those its title, its writer, the
// year it was written and every word of it follow. A book cites others,
// older than it, that are themselves in the library (and can be found on
// some shelf). No book tells of what happened after it was written: an
// old history of a town ends where its writer's day did.
//
// The lines of a book, as the reader lays them out (ui/document.js):
//   '\f'       the next page
//   '# Title'  a chapter's heading
//   '~'        an ornament between parts
//   '> text'   set to the right (a signature)
//   anything else, a paragraph.
import { RNG, hash4 } from '../../util/rng.js';
import { personName } from '../../world/names.js';
import { yearOf } from '../../sim/history.js';
import { loreOf, peopleOf, cap, bare, LANDS } from './lore.js';
import { Writer, tidy } from './write.js';
import { DISHES, DRINKS } from './corpus/table.js';
import { MEATY, FISHY } from '../../sim/culture.js';

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI'];
export const START_YEAR = yearOf(0);

function strHash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

// ------------------------------------------------------------ the kinds of book
// Each: `subjects(lore)` (what there are books of, each { id, ... });
// `title(rng, subj, lore)`; `style(subj)` (whose people the writer is);
// `fresh` (written in the present day: it tells of what's happening now);
// `write(W, lore, subj, meta, rng)` its lines.
export const GENRES = {};
const GENRE_IDS = () => Object.keys(GENRES);

// ------------------------------------------------------------ writers
// Who wrote it, and how they sign themselves.
function writerOf(rng, style, where, faith) {
  const n = personName(rng, style || 'vale');
  const name = `${n.first} ${n.last}`;
  const at = where || 'the road';
  const what = rng.pick([
    `of ${at}`, `of ${at}`, `${faith ? faith.clergy : 'priest'} of ${faith ? faith.god : 'the old gods'}, at ${at}`,
    `clerk to the council of ${at}`, `schoolmaster of ${at}`, `once of ${at}`, `scholar, of ${at}`,
  ]);
  return { name, first: n.first, sign: `${name}, ${what}` };
}

// ------------------------------------------------------------ the library
// A book's seed, from what it is.
function seedOf(lore, genre, sid, n) {
  return hash4(lore.seed, strHash(genre), strHash(String(sid)), n | 0);
}

// What a book is, before a word of it's written: its title, its writer, its
// year. `entry`: { genre, subj, n }.
export function metaOf(lore, entry) {
  const G = GENRES[entry.genre];
  const seed = seedOf(lore, entry.genre, entry.subj.id, entry.n);
  const rng = new RNG(seed);
  const title = G.title(rng, entry.subj, lore);
  const style = G.style(entry.subj, lore);
  const where = G.where ? G.where(entry.subj, lore) : null;
  const author = writerOf(rng, style, where ? where.name : null, where ? where.faith : null);
  // Written in the years before (the same years every time), or (a book of
  // what's happening now) this year.
  const fresh = G.fresh ? G.fresh(entry.subj, lore, rng) : rng.chance(0.25);
  let year = fresh ? lore.now : START_YEAR - rng.int(1, 60);
  if (G.earliest) year = Math.max(year, Math.min(lore.now, G.earliest(entry.subj, lore)));
  return { genre: entry.genre, subj: entry.subj, n: entry.n, seed, title, author, year, style, where, lore };
}

// Every book there is to be had in the world now (each kind, each subject,
// a few of each).
export function library(lore) {
  if (lore._library) return lore._library;
  const out = [];
  for (const g of GENRE_IDS()) {
    const G = GENRES[g];
    for (const subj of G.subjects(lore)) for (let n = 0; n < (G.copies || 2); n++) out.push({ genre: g, subj, n });
  }
  lore._library = out;
  return out;
}

// Books to cite: older than this one, on something near it.
function citable(lore, meta, near = () => true) {
  const out = [];
  for (const e of library(lore)) {
    if (e.genre === meta.genre && e.subj.id === meta.subj.id) continue;
    if (!near(e)) continue;
    const m = metaOf(lore, e);
    if (m.year < meta.year) out.push(m);
  }
  return out;
}

// ------------------------------------------------------------ a book
// The book on a shelf at (x, y, z): one of the library, more likely one on
// where the shelf is.
export function bookAt(game, x, y, z) {
  const lore = loreOf(game);
  const rng = new RNG(hash4(x, y, z, game.seed ^ 0x600c));
  const ow = game.world.ow;
  const here = ow.settlementAt(x, z) || null;
  const lib = library(lore);
  if (!lib.length) return null;
  const T = here ? lore.town(here) : null;
  const R = T ? T.realm : null;
  const land = T ? T.island : 'thessa';
  // (Mostly what's about here: this town, its realm, its land.)
  const weight = (e) => {
    const s = e.subj;
    let w = GENRES[e.genre].weight || 1;
    if (T && s.town === T.id) w *= 14;
    else if (R && s.realm === R.id) w *= 4;
    else if (s.land === land) w *= 2;
    return w;
  };
  let total = 0;
  const ws = lib.map((e) => {
    const w = weight(e);
    total += w;
    return w;
  });
  let r = rng.next() * total;
  let pick = lib[lib.length - 1];
  for (let i = 0; i < lib.length; i++) {
    r -= ws[i];
    if (r <= 0) {
      pick = lib[i];
      break;
    }
  }
  return writeBook(lore, pick);
}

// A book of the library, written out.
export function writeBook(lore, entry) {
  const meta = metaOf(lore, entry);
  const G = GENRES[entry.genre];
  const W = new Writer(new RNG(meta.seed ^ 0x51ed));
  const rng = new RNG(meta.seed ^ 0x7a11);
  const lines = G.write(W, lore, entry.subj, meta, rng);
  return { title: meta.title, by: meta.author.name, sign: meta.author.sign, year: meta.year, lines, genre: entry.genre, id: `${entry.genre}:${entry.subj.id}:${entry.n}` };
}

// ------------------------------------------------------------ helpers
// A clause made to follow "in 1102, ...": its first word lower-cased, if
// it's not a name.
function lowFirst(text, names) {
  const t = String(text).replace(/\.$/, '');
  const w = t.split(/[\s,']/)[0];
  if (names.has(w)) return t;
  return t.charAt(0).toLowerCase() + t.slice(1);
}

// "In that same year", "Two years later"...
const NUM = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
function whenRel(dy) {
  if (dy === 0) return 'in that same year';
  const n = Math.abs(dy);
  if (n === 1) return dy < 0 ? 'the year before' : 'the year after';
  return dy < 0 ? `${NUM[n] || n} years before` : `${NUM[n] || n} years later`;
}

// Names (for telling them from ordinary words).
function namesSet(lore) {
  if (lore._names) return lore._names;
  const s = new Set();
  for (const q of lore.ow.settlements) s.add(q.name);
  for (const R of lore.realms) {
    s.add(R.people);
    s.add(R.short);
    for (const k of R.kings) s.add(k.name);
  }
  lore._names = s;
  return s;
}

// More than one of them: "vicars", "keepers of the well", "spore-wives".
export function plural(w) {
  if (!w) return w;
  const [head, ...rest] = w.split(' of ');
  let p = head;
  if (/(sheep|deer|fish|moose|salmon|cattle|bison|folk)$/.test(head)) p = head;
  else if (/larva$/.test(head)) p = `${head}e`;
  else if (/mouse$/.test(head)) p = head.replace(/mouse$/, 'mice');
  else if (/goose$/.test(head)) p = head.replace(/goose$/, 'geese');
  else if (/(wol|el|hal|cal|lea|shel|thie)f$/.test(head)) p = head.replace(/f$/, 'ves');
  else if (/wife$/.test(head)) p = head.replace(/wife$/, 'wives');
  else if (/man$/.test(head)) p = head.replace(/man$/, 'men');
  else if (/[^aeiou]y$/.test(head)) p = head.replace(/y$/, 'ies');
  else if (/(s|sh|ch|x)$/.test(head)) p = `${head}es`;
  else p = `${head}s`;
  return [p, ...rest].join(' of ');
}

// What a hunter takes, as it's said: "feathers", but "raw meat".
const dropWord = (d) => (/meat|leather|string|gel|dust|sulfur|salt|wool|silk|mushroom/.test(d) ? d : plural(d));

const sentence = (s) => tidy(/[.!?]$/.test(s) ? s : `${s}.`);

// The facts every book of a town can draw on.
function townFacts(lore, T, year) {
  const R = T.realm;
  const f = T.faith;
  const h = T.hist;
  const ruler = R ? (year >= lore.now && R.ruler ? R.ruler : (lore.reigning(R, year) || {}).full) : null;
  const age = h ? year - h.founded : null;
  return {
    town: { name: T.name, again: [`the ${T.kind}`] },
    towntype: T.kind,
    realm: R ? { name: R.name, again: ['the realm'] } : null,
    capital: R && R.capital !== T.s ? R.capName : null,
    ruler,
    people: R ? R.people : peopleOf(T.style),
    land: T.land,
    ground: T.ground,
    water: T.water,
    founder: h ? { name: h.founder, again: ['the founder'] } : null,
    founded: h ? String(h.founded) : null,
    age: age ? String(age) : null,
    famous: h ? h.famous.replace(/^its /, 'its ') : null,
    dish: T.dishes[0] ? T.dishes[0].toLowerCase() : null,
    dish2: T.dishes[1] ? T.dishes[1].toLowerCase() : null,
    drink: T.cuisine.drink,
    god: f ? f.god : null,
    faith: f ? f.faith : null,
    feast: f ? f.feast : null,
    symbol: f ? f.symbol : null,
    holyday: f ? f.holyName : null,
    clergy: f ? f.clergy : null,
    clergies: f ? plural(f.clergy) : null,
    virtue: f ? f.virtue : null,
    year: String(year),
  };
}

// A book cited: its title, its writer, what it's about.
function citeFacts(m) {
  if (!m) return {};
  const G = GENRES[m.genre];
  return { otherbook: m.title, otherauthor: m.author.name, othertopic: G.topic ? G.topic(m.subj, m.lore) : null };
}

// The chapters, set out: each one starts a page.
function chapter(out, n, title) {
  if (out.length) out.push('\f');
  out.push(`# ${n ? `${ROMAN[n] || n}. ` : ''}${title}`);
}

// ============================================================ the annals of a town
const KIND_WORDS = { fire: 'Fire', flood: 'Flood', plague: 'Sickness', siege: 'Siege', famine: 'Hunger', omen: 'Omens', temple: 'The Temple', oath: 'Oaths', war: 'War', good: 'Good Years', bad: 'Hard Years', dungeon: 'Old Places', news: 'Recent Years', statue: 'Statues', drought: 'Drought', winter: 'Winter', fog: 'The Fog', wreck: 'The Wreck', lore: 'Remembered Things', founded: 'The Founding' };

GENRES.annals = {
  weight: 1.4,
  copies: 2,
  subjects: (lore) => lore.ow.settlements.map((s) => lore.town(s)).filter((T) => T && T.hist).map((T) => ({ id: `t${T.id}`, town: T.id, realm: T.realm ? T.realm.id : null, land: T.island, T })),
  title: (rng, subj) => rng.pick([`The Annals of ${subj.T.name}`, `A History of ${subj.T.name}`, `${subj.T.name}: A Chronicle`, `The Book of ${subj.T.name}`, `Of ${subj.T.name} and Its People`, `The Story of ${subj.T.name}`]),
  style: (subj) => subj.T.style,
  topic: (subj) => subj.T.name,
  where: (subj) => ({ name: subj.T.name, faith: subj.T.faith }),
  fresh: (subj, lore, rng) => rng.chance(0.4) || subj.T.hist.founded >= START_YEAR - 2,
  earliest: (subj) => subj.T.hist.founded + 2,
  write(W, lore, subj, meta, rng) {
    const T = subj.T;
    const h = T.hist;
    const out = [];
    const facts = { ...townFacts(lore, T, meta.year), subject: T.name, histtown: T.name };
    const names = namesSet(lore);
    // Preface.
    const cite = rng.pick(citable(lore, meta, (e) => (e.subj.town === T.id && ['annals', 'deeps', 'road'].includes(e.genre)) || (T.realm && e.subj.realm === T.realm.id && ['realm', 'war'].includes(e.genre))));
    chapter(out, 0, 'To the Reader');
    out.push(W.para('preface', { ...facts, ...citeFacts(cite) }, { min: 3, max: 4 }));
    out.push(`> ${meta.author.sign}, in the year ${meta.year}`);
    // The land, and the founding.
    let n = 1;
    chapter(out, n++, 'The Land and the Founding');
    out.push(W.para('land', facts, { min: 2, max: 3 }));
    const first = h.entries.find((q) => q.kind === 'founded');
    out.push(W.para('founding', facts, { min: 3, max: 4, fixed: { arrive: sentence(first ? first.text : `${T.name} was founded by ${h.founder} in ${h.founded}`) } }));
    // The years, a chapter to each few.
    const list = h.entries.filter((q) => q.kind !== 'founded' && q.y <= meta.year);
    const per = list.length > 6 ? 3 : 2;
    for (let i = 0; i < list.length; i += per) {
      const part = list.slice(i, i + per);
      const kinds = [...new Set(part.map((q) => KIND_WORDS[kindOf(q)] || 'Remembered Things'))].slice(0, 2);
      chapter(out, n++, `${part[0].y}${part[part.length - 1].y !== part[0].y ? ` to ${part[part.length - 1].y}` : ''}: ${kinds.join(' and ')}`);
      for (const q of part) out.push(this.event(W, lore, T, q, facts, names, rng));
    }
    // Its ways.
    chapter(out, n++, `The Ways of ${T.name}`);
    out.push(W.para('ways', facts, { min: 3, max: 4 }));
    // Its tale.
    if (h.legend) {
      const d = T.dungeons[0];
      chapter(out, n++, 'An Old Story');
      const leg = lowFirst(h.legend, names);
      out.push(W.para('legend', { ...facts, dungeon: d ? d.name : null, where: d ? lore.whereOf(d) : null }, { min: 3, max: 4, fixed: { tell: sentence(rng.pick([`The old folk of ${T.name} say that ${leg}`, `They say in ${T.name} that ${leg}`, `It is said that ${leg}`])) } }));
    }
    // Today.
    chapter(out, n++, `${T.name} in the Year ${meta.year}`);
    const state = T.s.condition === 'prosperous' ? rng.pick(['prosperous and growing', 'busier than it has ever been', 'thriving']) : T.s.condition === 'poor' ? rng.pick(['poorer than it was', 'going through hard times', 'struggling']) : rng.pick(['much as it has always been', 'a fair place to live', 'quiet and well kept']);
    const pools = T.realm ? {} : { realm: 'present.free' };
    out.push(W.para('present', { ...facts, state }, { min: 3, max: 4, pools }));
    out.push('~');
    return out;
  },
  // One thing that happened, its paragraph.
  event(W, lore, T, q, facts, names, rng) {
    const kind = kindOf(q);
    let text = q.kind === 'news' || q.kind === 'statue' ? null : lowFirst(q.text, names);
    let when = null;
    let more = {};
    // (An old place: its whole story, as the town tells it.)
    if (kind === 'dungeon') {
      const d = T.dungeons.find((x) => x.origin && x.origin.short && cap(x.origin.short) === q.text);
      if (d) {
        when = untold(d.origin.text.replace(/ They say[^.]*\.$/, ''), (W.told ||= new Set()));
        more = { dungeon: d.name, where: lore.whereOf(d) };
      }
    }
    // (A thing that befell it, not a thing that was done: "A hungry winter:
    // the snow lay till spring...")
    if (text && /^(a|an|the) [^,.;:]{0,40}:/i.test(text)) when ||= rng.pick([`In ${q.y} came ${text}`, `The year ${q.y} brought ${text}`]);
    when ||= text ? rng.pick([`In the year ${q.y}, ${text}`, `In ${q.y}, ${text}`, `It was in ${q.y} that ${text}`]) : rng.pick([`In ${q.y}, the rolls of ${T.name} record: "${q.text.replace(/\.$/, '')}."`, `The rolls of ${T.name} for ${q.y} say only this: "${q.text.replace(/\.$/, '')}."`]);
    // What else happened then, elsewhere.
    // (What else happened then: on the same land first.)
    const near = lore.near(q.y, 3, T.realm ? T.realm.id : -1).filter((e) => e.kind !== 'proclaimed' || rng.chance(0.5));
    const here = near.filter((e) => e.land === T.island || e.realms.some((id) => (lore.byCiv.get(id) || {}).island === T.island));
    const e = here.length ? rng.pick(here) : near.length && rng.chance(0.3) ? rng.pick(near) : null;
    const link = e ? { when: cap(whenRel(e.y - q.y)), whenlow: whenRel(e.y - q.y), other: lowFirst(e.text, names) } : {};
    const pools = {};
    for (const mv of ['detail', 'after']) {
      if (W.has(`event.${mv}.${kind}`)) pools[mv] = `event.${mv}.${kind}`;
      else pools[mv] = `event.${mv}.${/fire|flood|plague|siege|famine|drought|winter|fog|wreck/.test(kind) ? 'bad' : 'lore'}`;
    }
    return W.para('event', { ...facts, ...link, ...more, year: String(q.y) }, { min: 2, max: 5, fixed: { when: sentence(when) }, pools });
  },
};

// What kind of thing happened (for what's said of it): what the history
// calls it, and for the rest, whether it went well or ill.
const GOOD = /fair|healed|so great|rich|silver was struck|pearl|whale beached|spice|foretold|so keen|guild|chartered|relic|school|ploughs|clock|laden with|wedding|statue/i;
const BAD = /blight|burn|raid|fever|collapse|avalanche|buried|drought|froze|feud|fog|flood|sank|swallowed|angry|failed|plague|sickness|did not come|never came|black for|caught fire|split|exiled|bandits|sacked/i;
function kindOf(q) {
  if (q.kind === 'realm') return /swore itself/.test(q.text) ? 'oath' : /marched to war/.test(q.text) ? 'war' : 'good';
  if (q.kind === 'lore' || q.kind === 'event') return GOOD.test(q.text) && !BAD.test(q.text) ? 'good' : BAD.test(q.text) ? 'bad' : 'lore';
  return q.kind;
}

// ============================================================ a realm's history
// "Jorn and Oswin", "Jorn, Oswin and Dell".
function listOf(xs) {
  if (xs.length <= 1) return xs[0] || '';
  return `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`;
}
const VALUE_WORDS = { martial: 'courage in war', mercantile: 'trade and coin', pious: 'faith', scholarly: 'learning', agrarian: 'the land and its harvest', seafaring: 'the sea', artisan: 'good work, well made' };
const VALUE_TITLES = { martial: 'Of War', mercantile: 'Of Trade', pious: 'Of Faith', scholarly: 'Of Learning', agrarian: 'Of the Land', seafaring: 'Of the Sea', artisan: 'Of the Crafts' };
// What a ruler's name says of them (which of the epithets' paragraphs).
function epithetKind(e) {
  if (/Builder/.test(e)) return 'builder';
  if (/Bold|Bloodaxe|Unbowed|Stonefist|Ironhand|Sharktooth|Jaguar/.test(e)) return 'bold';
  if (/Wise|Just|Star-Reader|Patient|Owl-Sight|Lantern/.test(e)) return 'wise';
  if (/Pious|Unburnt|Kiln-Keeper|Rain-Bringer|Root-Keeper/.test(e)) return 'pious';
  if (/Young/.test(e)) return 'young';
  if (/Unready/.test(e)) return 'unready';
  if (/Peacemaker|Quiet/.test(e)) return 'peace';
  if (/Elder|Grey|Longreign/.test(e)) return 'old';
  return 'other';
}

// What's true of a realm in a year.
function realmFacts(lore, R, year) {
  const king = lore.reigning(R, Math.min(year, lore.now - 1));
  const ruler = year >= lore.now && R.ruler ? R.ruler : king ? king.full : null;
  const f = R.faith;
  const others = R.towns.filter((s) => s !== R.capital).map((s) => s.name);
  return {
    subject: R.name,
    realm: { name: R.name, again: ['the realm'] },
    short: R.short,
    people: R.people,
    land: R.land,
    capital: R.capName,
    founded: String(R.founded),
    came: String(R.came),
    camehow: R.cameHow,
    firstking: R.kings[0] ? R.kings[0].full : null,
    ruler,
    god: f ? f.god : null,
    faith: f ? f.faith : null,
    feast: f ? f.feast : null,
    holyday: f ? f.holyName : null,
    clergy: f ? f.clergy : null,
    clergies: f ? plural(f.clergy) : null,
    virtue: f ? f.virtue : null,
    rite: f ? f.rite : null,
    values: listOf(R.values.map((v) => VALUE_WORDS[v] || v)),
    count: String(R.towns.length),
    towns: others.length >= 2 ? listOf(others.slice(0, 3)) : null,
    year: String(year),
  };
}

GENRES.realm = {
  weight: 1,
  copies: 2,
  subjects: (lore) => lore.realms.map((R) => ({ id: `r${R.id}`, realm: R.id, land: R.island, R })),
  title: (rng, subj) => rng.pick([`A History of ${subj.R.name}`, `The ${subj.R.people} and Their Realm`, `The Chronicle of ${subj.R.short}`, `${subj.R.short}: Its Rulers and Its Wars`, `The Book of the ${subj.R.people}`]),
  style: (subj) => subj.R.style,
  topic: (subj) => subj.R.name,
  where: (subj) => ({ name: subj.R.capName, faith: subj.R.faith }),
  fresh: (subj, lore, rng) => rng.chance(0.4),
  earliest: (subj) => subj.R.founded + 20,
  write(W, lore, subj, meta, rng) {
    const R = subj.R;
    const out = [];
    const facts = realmFacts(lore, R, meta.year);
    const wars = lore.wars.filter((w) => (w.a === R || w.b === R) && w.start <= meta.year);
    // Preface.
    const cite = rng.pick(citable(lore, meta, (e) => (e.subj.realm === R.id && ['annals', 'realm', 'faith'].includes(e.genre)) || (e.subj.war && (e.subj.war.a === R || e.subj.war.b === R))));
    chapter(out, 0, 'To the Reader');
    out.push(W.para('preface', { ...facts, ...citeFacts(cite) }, { min: 3, max: 4 }));
    out.push(`> ${meta.author.sign}, in the year ${meta.year}`);
    let n = 1;
    chapter(out, n++, `The Coming of the ${R.people}`);
    out.push(W.para('came', facts, { min: 3, max: 4 }));
    chapter(out, n++, `The Founding of ${R.short}`);
    out.push(W.para('proclaimed', facts, { min: 3, max: 4 }));
    // The rulers: the first, the last, those of the wars, and a few others.
    const kings = R.kings.filter((k) => k.from <= meta.year);
    const now = kings[kings.length - 1];
    const keep = new Set([kings[0], now, ...kings.filter((k) => wars.some((w) => w.start <= k.to && w.start >= k.from))]);
    for (const k of rng.shuffle(kings.slice())) if (keep.size < 5) keep.add(k);
    chapter(out, n++, `The Rulers of ${R.short}`);
    let skipped = [];
    for (const k of kings) {
      if (!keep.has(k)) {
        skipped.push(k.name);
        continue;
      }
      if (skipped.length) {
        out.push(sentence(rng.pick([`After them came ${listOf(skipped)}, of whom little is written`, `Then ${skipped.length > 1 ? `${listOf(skipped)} reigned in turn` : `${skipped[0]} reigned`}, and the chronicles say little of ${skipped.length > 1 ? 'them' : 'that reign'}`, `${listOf(skipped)} ${skipped.length > 1 ? 'followed, one after another' : 'followed'}, and left little behind for the chroniclers`])));
        skipped = [];
      }
      const reigns = k === now && (meta.year < lore.now || !R.ruler);
      const w = wars.find((q) => q.start >= k.from && q.start <= k.to);
      const enemy = w ? (w.a === R ? w.b : w.a) : null;
      const kf = { ...facts, epithet: k.epithet, war: w ? w.name : null, enemy: enemy ? enemy.name : null, warstart: w ? String(w.start) : null, warend: w && w.end !== null ? String(w.end) : null };
      const reign = reigns ? `${k.full} has reigned since ${k.from}` : rng.pick([`${k.full} reigned from ${k.from} to ${k.to}`, `${k.full} took the throne in ${k.from}, and held it ${k.to - k.from} years`, `After ${k === kings[0] ? 'the founding' : 'them'}, ${k.full} reigned, from ${k.from} until ${k.to}`]);
      const death = reigns ? null : k.how === 'died in battle' && k.war ? `${k.name} died in battle in ${k.to}, in ${k.war.name}` : `${k.name} ${k.how.replace(/, some say$/, '')} in ${k.to}${/some say/.test(k.how) ? ', some say' : ''}`;
      const pools = { epithet: `reign.epithet.${epithetKind(k.epithet)}` };
      out.push(W.para('reign', kf, { min: 2, max: 4, fixed: death ? { reign: sentence(reign), death: sentence(death) } : { reign: sentence(reign) }, pools }));
    }
    // What they hold dear.
    chapter(out, n++, `What the ${R.people} Hold Dear`);
    R.values.forEach((v, i) => {
      const pools = { show: `value.show.${v}` };
      if (i > 0) pools.open = 'none';
      if (i < R.values.length - 1) pools.close = 'none';
      if (VALUE_TITLES[v]) out.push(`## ${VALUE_TITLES[v]}`);
      out.push(W.para('value', facts, { min: 2, max: 3, pools }));
    });
    chapter(out, n++, `The Faith of ${R.short}`);
    out.push(W.para('rfaith', facts, { min: 3, max: 4 }));
    chapter(out, n++, 'The Towns of the Realm');
    out.push(W.para('towns', facts, { min: 2, max: 3 }));
    if (wars.length) {
      chapter(out, n++, `${R.short} at War`);
      for (const w of wars.slice(-3)) {
        const enemy = w.a === R ? w.b : w.a;
        const big = w.battles.slice().sort((p, q) => q.fallen - p.fallen)[0];
        const going = w.end === null || w.end > meta.year;
        const wc = citable(lore, meta, (e) => e.subj.war === w)[0] || null;
        out.push(W.para('rwar', {
          ...facts, war: w.name, enemy: enemy.name, why: w.why, warstart: String(w.start), warend: going ? null : String(w.end),
          battles: w.battles.length > 1 ? listOf(w.battles.map((b) => b.name)) : null, battle: big ? big.name : null, battleyear: big ? String(big.y) : null, battlewinner: big ? big.winner.name : null,
          endtext: going ? `As I write, ${w.name} goes on` : w.endText, ...citeFacts(wc),
        }, { min: 2, max: 4 }));
      }
    }
    chapter(out, n++, `${R.short} in the Year ${meta.year}`);
    out.push(W.para('rnow', facts, { min: 2, max: 4 }));
    out.push('~');
    return out;
  },
};

// ============================================================ an account of a war
GENRES.war = {
  weight: 1,
  copies: 2,
  subjects: (lore) => lore.wars.map((w) => ({ id: `w${strHash(`${w.name}:${w.start}:${w.a.id}:${w.b.id}`)}`, war: w, realm: w.a.id, land: w.a.island })),
  title: (rng, subj) => {
    const w = subj.war;
    const big = w.battles[0];
    return rng.pick([`An Account of ${w.name}`, `${cap(w.name)}: Its Causes and Its Battles`, `${cap(w.name)}, ${w.start}${w.end && w.end !== w.start ? ` to ${w.end}` : ''}`, ...(big && w.peace ? [`From ${big.name} to ${w.peace}`] : [])]);
  },
  style: (subj, lore) => (subj.war.victor || subj.war.a).style,
  topic: (subj) => subj.war.name,
  where: (subj) => ({ name: (subj.war.victor || subj.war.a).capName, faith: (subj.war.victor || subj.war.a).faith }),
  fresh: (subj) => subj.war.live,
  earliest: (subj, lore) => (subj.war.end !== null ? subj.war.end + 1 : lore.now),
  write(W, lore, subj, meta, rng) {
    const w = subj.war;
    const A = w.a;
    const B = w.b;
    const out = [];
    const ak = lore.reigning(A, w.start);
    const bk = lore.reigning(B, w.start);
    const facts = {
      subject: w.name, war: { name: w.name, again: ['the war'] }, aggressor: A.name, defender: B.name, acapital: A.capName, why: w.why,
      warstart: String(w.start), warend: w.end !== null ? String(w.end) : null, akings: ak ? ak.full : null, bkings: bk ? bk.full : null,
      victor: w.victor ? w.victor.name : null, loser: w.loser ? w.loser.name : null, endtext: w.endText, ceded: w.ceded ? w.ceded.name : null,
      clergy: A.faith ? A.faith.clergy : null, clergies: A.faith ? plural(A.faith.clergy) : null, feast: A.faith ? A.faith.feast : null, year: String(meta.year),
    };
    const cite = rng.pick(citable(lore, meta, (e) => (e.subj.realm === A.id || e.subj.realm === B.id) && ['realm', 'war', 'annals'].includes(e.genre)));
    chapter(out, 0, 'To the Reader');
    out.push(W.para('preface', { ...facts, ...citeFacts(cite) }, { min: 2, max: 3 }));
    out.push(`> ${meta.author.sign}, in the year ${meta.year}`);
    let n = 1;
    chapter(out, n++, 'The Causes of the War');
    out.push(W.para('cause', facts, { min: 3, max: 4 }));
    chapter(out, n++, 'The War Begins');
    out.push(W.para('opening', facts, { min: 2, max: 3 }));
    for (const b of w.battles.filter((q) => q.y <= meta.year)) {
      chapter(out, n++, `${cap(b.name)}, ${b.y}`);
      const siege = /^the Siege of /.test(b.name);
      const bf = {
        ...facts, battle: b.name, battleyear: String(b.y), place: b.at ? b.at.name : null, ground: b.at ? lore.town(b.at).ground : null,
        winner: b.winner.name, loser: b.loser.name, fallen: `${b.fallen}`, besieger: b.at ? (b.at.civ && b.at.civ.id === A.id ? B.name : A.name) : null,
        feast: (b.winner.faith || {}).feast || facts.feast,
      };
      // (A siege the town's own side won was held; one it lost, the town
      // fell, and if it's theirs now it was given back at the peace.)
      const own = b.at && b.at.civ ? lore.byCiv.get(b.at.civ.id) : null;
      const fell = siege && own && b.winner !== own;
      const returned = fell && w.end !== null && w.end <= meta.year && !(w.ceded === b.at) ? w.peace : null;
      out.push(W.para(siege ? 'siege' : 'battle', { ...bf, peace: returned }, { min: 3, max: 5, pools: siege ? { outcome: fell ? 'siege.fell' : 'siege.held' } : {} }));
    }
    if (w.end !== null && w.end <= meta.year) {
      chapter(out, n++, cap(w.peace || 'The Peace'));
      out.push(W.para('peace', facts, { min: 2, max: 3 }));
      chapter(out, n++, 'After the War');
      out.push(W.para('aftermath', facts, { min: 2, max: 3 }));
    } else {
      chapter(out, n++, 'The War Goes On');
      out.push(W.para('ongoing', facts, { min: 2, max: 3 }));
    }
    out.push('~');
    return out;
  },
};

// ============================================================ a traveller's road
GENRES.road = {
  weight: 1.1,
  copies: 1,
  subjects(lore) {
    const out = [];
    const lands = new Map();
    for (const s of lore.ow.settlements) if (!s.deserted && s.condition !== 'abandoned') (lands.get(s.island || 'thessa') || lands.set(s.island || 'thessa', []).get(s.island || 'thessa')).push(s);
    for (const [land, towns] of lands) {
      if (towns.length < 3) continue;
      const starts = [...new Set([...lore.realms.filter((R) => R.island === land).map((R) => R.capital), ...towns.filter((s) => s.type !== 'village')])].slice(0, 4);
      for (const s of starts) {
        const route = lore.route(s, 5, new RNG(hash4(lore.seed, s.id, 0x50ad)));
        if (route.length >= 3) out.push({ id: `j${s.id}`, town: s.id, realm: s.civ ? s.civ.id : null, land, route });
      }
    }
    return out;
  },
  title: (rng, subj, lore) => {
    const a = subj.route[0].name;
    const b = subj.route[subj.route.length - 1].name;
    return rng.pick([`From ${a} to ${b}`, `A Traveller's Road through ${LANDS_NAME(lore, subj.land)}`, `On Foot from ${a}`, `The Road to ${b}`, `Letters from the ${LANDS_NAME(lore, subj.land)} Road`]);
  },
  style: (subj, lore) => lore.town(subj.route[0]).style,
  topic: (subj, lore) => `the roads of ${LANDS_NAME(lore, subj.land)}`,
  where: (subj, lore) => ({ name: subj.route[0].name, faith: lore.town(subj.route[0]).faith }),
  write(W, lore, subj, meta, rng) {
    const out = [];
    const route = subj.route.map((s) => lore.town(s));
    const first = route[0];
    const last = route[route.length - 1];
    const way0 = lore.wayTo(route[0].s, route[1].s);
    const base = { ...townFacts(lore, first, meta.year), subject: `the road from ${first.name} to ${last.name}`, last: last.name, gate: way0.dir, count: String(route.length) };
    const cite = rng.pick(citable(lore, meta, (e) => e.subj.land === subj.land && ['annals', 'deeps', 'beasts', 'road'].includes(e.genre)));
    chapter(out, 0, 'To the Reader');
    out.push(W.para('preface', { ...base, ...citeFacts(cite) }, { min: 2, max: 3 }));
    out.push(`> ${meta.author.sign}, in the year ${meta.year}`);
    let n = 1;
    chapter(out, n++, `Setting Out from ${first.name}`);
    out.push(W.para('setout', base, { min: 2, max: 4 }));
    for (let i = 1; i < route.length; i++) {
      const T = route[i];
      const prev = route[i - 1];
      const way = lore.wayTo(prev.s, T.s);
      const f = { ...townFacts(lore, T, meta.year), from: prev.name, way: way.dir, days: way.days };
      const d = T.dungeons[0] || null;
      const tb = T.faith && T.faith.taboos.length ? lore.taboo(rng.pick(T.faith.taboos)) : null;
      chapter(out, n++, i === route.length - 1 ? `${T.name}, and the End of the Road` : `To ${T.name}`);
      out.push(W.para('road', f, { min: 2, max: 4 }));
      const sf = { ...f, dungeon: d ? d.name : null, where: d ? lore.whereOf(d) : null, taboo: tb };
      out.push(W.para('stay', sf, { min: 3, max: 5, pools: T.realm ? {} : { first: 'stay.free' } }));
    }
    out.push(W.para('homeward', { ...townFacts(lore, last, meta.year), count: String(route.length) }, { min: 2, max: 3 }));
    out.push('~');
    return out;
  },
};
const LANDS_NAME = (lore, land) => LANDS[land] || 'the Island';

// ============================================================ a people's table
const titleCase = (t) => t.replace(/\b([a-z])/g, (m, c) => c.toUpperCase()).replace(/\b(Of|And|The|In|With|A)\b(?!^)/g, (m, w, i) => (i ? w.toLowerCase() : w));
GENRES.table = {
  weight: 0.9,
  copies: 2,
  subjects(lore) {
    const by = new Map();
    for (const s of lore.ow.settlements) {
      if (s.deserted || s.condition === 'abandoned') continue;
      const st = (s.civ ? s.civ.style : s.style) || 'vale';
      (by.get(st) || by.set(st, []).get(st)).push(s);
    }
    return [...by].map(([style, towns]) => {
      const rep = towns.find((s) => s.civ && s.civ.capital === s.id) || towns[0];
      return { id: `c${style}`, style, towns, rep, land: rep.island || 'thessa', realm: rep.civ ? rep.civ.id : null, people: peopleOf(style) };
    });
  },
  title: (rng, subj, lore) => {
    const T = lore.town(subj.rep);
    return rng.pick([`The Table of the ${subj.people}`, `On the Cooking of the ${subj.people}`, `${titleCase(T.dishes[0] || 'Bread')} and Other Dishes`, `What the ${subj.people} Eat`, `A ${subj.people} Kitchen`]);
  },
  style: (subj) => subj.style,
  topic: (subj) => `the table of the ${subj.people}`,
  where: (subj, lore) => ({ name: subj.rep.name, faith: lore.town(subj.rep).faith }),
  write(W, lore, subj, meta, rng) {
    const out = [];
    const T = lore.town(subj.rep);
    const c = T.cuisine;
    const f = T.faith;
    const food = f ? f.taboos.filter((k) => ['no_meat', 'no_fish', 'no_drink', 'no_mushroom'].includes(k)) : [];
    // A neighbouring people, and what they eat.
    const other = lore.ow.settlements
      .filter((q) => (q.island || 'thessa') === subj.land && ((q.civ ? q.civ.style : q.style) || 'vale') !== subj.style && !q.deserted)
      .sort((p, q) => Math.hypot(p.cx - subj.rep.cx, p.cz - subj.rep.cz) - Math.hypot(q.cx - subj.rep.cx, q.cz - subj.rep.cz))[0];
    const OT = other ? lore.town(other) : null;
    const base = {
      subject: `the table of the ${subj.people}`, people: subj.people, land: T.land, ground: T.ground, cuisine: c.word, drink: c.drink, drinkwhat: DRINKS[c.drink] || null,
      faith: f ? f.faith : null, god: f ? f.god : null, clergies: f ? plural(f.clergy) : null, feast: f ? f.feast : null, holyday: f ? f.holyName : null,
      dish: T.dishes[0] ? T.dishes[0].toLowerCase() : null,
      otherpeople: OT ? peopleOf(OT.style) : null, otherdish: OT && OT.dishes[0] ? OT.dishes[0].toLowerCase() : null, otherdrink: OT ? OT.cuisine.drink : null,
      year: String(meta.year),
    };
    const cite = rng.pick(citable(lore, meta, (e) => ['table', 'road'].includes(e.genre) && e.subj.land === subj.land));
    chapter(out, 0, 'To the Reader');
    out.push(W.para('preface', { ...base, ...citeFacts(cite) }, { min: 2, max: 3 }));
    out.push(`> ${meta.author.sign}, in the year ${meta.year}`);
    let n = 1;
    chapter(out, n++, `Of the ${subj.people} and Their Table`);
    out.push(W.para('tableopen', base, { min: 2, max: 4 }));
    c.dishes.forEach((k, i) => {
      const D = DISHES[k];
      if (!D) return;
      const name = T.dishes[i] || k;
      chapter(out, n++, `Of ${titleCase(name)}`);
      const many = /s$/.test(name) && !/ss$/.test(name);
      // (What the faithful do about a dish their faith forbids.)
      const not = food.includes('no_meat') && MEATY.has(k) ? ['dish.meatless', 'no_meat'] : food.includes('no_fish') && FISHY.has(k) ? ['dish.fishless', 'no_fish'] : food.includes('no_mushroom') && /mushroom|glowcap/.test(k) ? ['dish.nomush', 'no_mushroom'] : null;
      out.push(W.para('dish', { ...base, dish: name.toLowerCase(), ...D, be: many ? 'are' : 'is', it: many ? 'them' : 'it', they: many ? 'they' : 'it', taboo: not ? lore.taboo(not[1]) : null }, { min: 3, max: 4, pools: not ? { remark: not[0] } : {} }));
    });
    chapter(out, n++, `Of ${titleCase(c.drink)}`);
    const dry = food.includes('no_drink') && /ale|mead|beer|wine|spirit|whisky|toddy/.test(c.drink);
    out.push(W.para('drink', base, { min: 2, max: 3, pools: dry ? { where: 'drink.dry', remark: 'none' } : {} }));
    if (food.length) {
      chapter(out, n++, 'What the Faithful Will Not Eat');
      for (const k of food) out.push(W.para('forbid', { ...base, taboo: lore.taboo(k) }, { min: 2, max: 3 }));
    }
    chapter(out, n++, 'Of Feast Days');
    out.push(W.para('feastday', base, { min: 2, max: 3 }));
    if (OT) {
      chapter(out, n++, 'Of Other Tables');
      out.push(W.para('abroad', base, { min: 2, max: 3 }));
    }
    out.push('~');
    return out;
  },
};

// ============================================================ the old places
const pluralName = (n) => plural(String(n).toLowerCase());
function oldPlaceFacts(lore, d, meta) {
  const now = meta.year >= lore.now;
  const cleared = now && d.cleared;
  const by = d.clearedBy === 'you' ? lore.game.playerName || 'a stranger' : d.clearedBy;
  const n = Math.max(1, d.depth | 0);
  return {
    dungeon: d.name, story: d.origin.text, where: lore.whereOf(d), near: d.townName || null,
    dwellers: listOf(lore.dwellers(d).slice(0, 3).map(pluralName)) || null,
    depth: `${NUM[n] || n} ${n === 1 ? 'level' : 'levels'}`,
    delves: now && d.delves > 0 ? String(d.delves) : null, clearedby: cleared ? by || 'a band of delvers' : null,
  };
}
// A story, less the sentences of it already told in the book (old places of
// a kind often end the same way).
function untold(text, told) {
  const parts = String(text).match(/[^.!?]+[.!?]+/g) || [String(text)];
  const keep = parts.filter((p, i) => i === 0 || !told.has(p.trim()));
  for (const p of parts) told.add(p.trim());
  return keep.join('').trim();
}
const fateOf = (f) => (f.clearedby ? 'oldplace.fate.cleared' : f.delves ? 'oldplace.fate.delved' : 'oldplace.fate.none');

GENRES.deeps = {
  weight: 1.1,
  copies: 2,
  subjects(lore) {
    const out = [];
    for (const s of lore.ow.settlements) {
      const ds = lore.dungeons((d) => d.town === s.id && d.origin && d.origin.text);
      if (ds.length < 2) continue;
      // (And the old places of the towns round about, further off.)
      const far = lore.neighbours(s, 3).flatMap((n) => lore.dungeons((d) => d.town === n.T.id && d.origin && d.origin.text)).slice(0, 2);
      out.push({ id: `d${s.id}`, town: s.id, realm: s.civ ? s.civ.id : null, land: s.island || 'thessa', ds, far, near: s });
    }
    const lands = new Map();
    for (const d of lore.dungeons((x) => x.origin && x.origin.text && x.town !== null && x.town !== undefined)) {
      const s = lore.ow.settlements[d.town];
      const k = (s && s.island) || 'thessa';
      (lands.get(k) || lands.set(k, []).get(k)).push(d);
    }
    for (const [land, ds] of lands) if (ds.length >= 3) out.push({ id: `D${land}`, land, ds: new RNG(hash4(lore.seed, strHash(land), 0xdee9)).shuffle(ds.slice()).slice(0, 5) });
    return out;
  },
  title: (rng, subj) => (subj.near ? rng.pick([`Of the Old Places about ${subj.near.name}`, `Below ${subj.near.name}: A Delver's Notes`, `The Old Places of ${subj.near.name}`]) : rng.pick([`The Old Places of ${LANDS[subj.land] || 'the Island'}`, `Under ${LANDS[subj.land] || 'the Island'}: A Delver's Notes`, `Barrows, Mines and Worse`])),
  style: (subj, lore) => (subj.near ? lore.town(subj.near).style : subj.ds[0].style || 'vale'),
  topic: (subj) => (subj.near ? `the old places about ${subj.near.name}` : `the old places of ${LANDS[subj.land] || 'the island'}`),
  where: (subj, lore) => {
    const s = subj.near || lore.ow.settlements[subj.ds[0].town];
    return s ? { name: s.name, faith: lore.town(s).faith } : null;
  },
  write(W, lore, subj, meta, rng) {
    const out = [];
    const town = subj.near ? subj.near.name : (lore.ow.settlements[subj.ds[0].town] || {}).name;
    const base = { subject: subj.near ? `the old places about ${town}` : `the old places of ${LANDS[subj.land] || 'the island'}`, town, land: LANDS[subj.land] || 'the island', people: peopleOf(subj.ds[0].style || 'vale'), year: String(meta.year) };
    const cite = rng.pick(citable(lore, meta, (e) => ['deeps', 'elders', 'annals', 'road'].includes(e.genre) && ((subj.near && e.subj.town === subj.near.id) || e.subj.land === subj.land)));
    chapter(out, 0, 'To the Reader');
    out.push(W.para('preface', { ...base, ...citeFacts(cite) }, { min: 2, max: 3 }));
    out.push(W.para('delveopen', base, { min: 2, max: 3 }));
    out.push(`> ${meta.author.sign}, in the year ${meta.year}`);
    let n = 1;
    const told = new Set();
    const list = [...subj.ds.map((d) => [d, false]), ...(subj.far || []).map((d) => [d, true])];
    for (const [d, far] of list) {
      if (far && d === list.find(([, f]) => f)[0]) {
        chapter(out, n++, 'Further Off');
        out.push(W.para('delvefar', { ...base, other: d.townName || 'the next town' }, { min: 1, max: 2 }));
        out.push('\f');
      }
      chapter(out, n++, cap(d.name));
      const f = { ...base, ...oldPlaceFacts(lore, d, meta) };
      f.story = untold(f.story, told);
      const what = W.has(`oldplace.what.${d.type}`) ? `oldplace.what.${d.type}` : 'oldplace.what';
      const pools = { what, fate: fateOf(f) };
      if ((d.depth | 0) <= 1) pools.deep = 'oldplace.deep.one';
      if (d.type === 'kavorent') pools.dwell = 'oldplace.dwell.kav';
      out.push(W.para('oldplace', f, { min: 3, max: 5, fixed: { story: sentence(f.story) }, pools }));
    }
    out.push('~');
    return out;
  },
};

// ============================================================ before anyone
GENRES.elders = {
  weight: 0.6,
  copies: 3,
  subjects: (lore) => [{ id: 'k0', land: 'thessa' }],
  title: (rng) => rng.pick(['On the Kavorent', 'The Spires and Their Makers', 'Before the First Kings', 'The Long Count', 'Of Cores and Spires', 'The Things Before']),
  style: (subj, lore) => (lore.realms[0] ? lore.realms[0].style : 'vale'),
  topic: () => 'the Kavorent',
  where: (subj, lore) => (lore.realms[0] ? { name: lore.realms[0].capName, faith: lore.realms[0].faith } : null),
  write(W, lore, subj, meta, rng) {
    const out = [];
    const R = lore.realms[0];
    const now = meta.year >= lore.now;
    const base = { subject: 'the Kavorent and their works', land: R ? R.land : 'Thessa', people: R ? R.people : 'Valeborn', year: String(meta.year) };
    const cite = rng.pick(citable(lore, meta, (e) => e.genre === 'deeps'));
    chapter(out, 0, 'To the Reader');
    out.push(W.para('preface', { ...base, ...citeFacts(cite) }, { min: 2, max: 3 }));
    out.push(`> ${meta.author.sign}, in the year ${meta.year}`);
    let n = 1;
    chapter(out, n++, 'Who the Kavorent Were');
    out.push(W.para('kavwho', base, { min: 3, max: 4 }));
    const spires = rng.shuffle(lore.spires().slice()).slice(0, 3);
    if (spires.length) {
      chapter(out, n++, 'The Spires');
      for (const d of spires) {
        const s = d.town !== null && d.town !== undefined ? lore.ow.settlements[d.town] : null;
        const T = s ? lore.town(s) : null;
        out.push(W.para('spire', { ...base, spire: d.name, where: lore.whereOf(d), near: s ? s.name : null, people: T ? (T.realm ? T.realm.people : peopleOf(T.style)) : base.people }, { min: 2, max: 3 }));
      }
    }
    const arts = lore.arts();
    const held = now ? arts.filter((a) => a.realms.length) : [];
    chapter(out, n++, 'The Cores and the Old Arts');
    out.push(W.para('arts', { ...base, arts: held.length ? listOf(held.map((a) => `the ${a.name}`)) : null, artrealms: held.length ? listOf([...new Set(held.flatMap((a) => a.realms.map((R2) => R2.name)))]) : null }, { min: 1, max: 3 }));
    for (const a of rng.shuffle(arts.slice()).slice(0, 4)) {
      const has = now && a.realms.length ? listOf(a.realms.map((R2) => R2.name)) : null;
      out.push(W.para('art', { ...base, art: `the ${a.name}`, artdesc: a.desc, artrealms: has }, { min: 1, max: 2, pools: has ? {} : { held: 'none' } }));
    }
    const elders = lore.ancients();
    if (elders.length) {
      chapter(out, n++, 'The Things Older Still');
      for (const d of elders) {
        const land = d.isle ? LANDS[d.isle] : null;
        out.push(W.para('elder', { ...base, story: d.origin.text, place: d.name, land: land || base.land, where: lore.whereOf(d), master: d.origin.who || null, dwellers: listOf(lore.dwellers(d).slice(0, 3).map(pluralName)) }, { min: 2, max: 4, fixed: { story: sentence(d.origin.text) }, pools: d.type === 'champion' ? { what: 'elder.what.hero' } : {} }));
      }
    }
    out.push('~');
    return out;
  },
};

// ============================================================ a bestiary
GENRES.beasts = {
  weight: 0.9,
  copies: 2,
  subjects: (lore) => [...new Set(lore.ow.settlements.map((q) => q.island || 'thessa'))].filter((land) => lore.beasts(land).length >= 3).map((land) => ({ id: `b${land}`, land })),
  title: (rng, subj) => rng.pick([`A Bestiary of ${LANDS[subj.land] || 'the Island'}`, `The Beasts of ${LANDS[subj.land] || 'the Island'}`, 'Of Beasts Tame and Wild', `What Walks in ${LANDS[subj.land] || 'the Island'}`]),
  style: (subj, lore) => (lore.realms.find((R) => R.island === subj.land) || { style: 'vale' }).style,
  topic: (subj) => `the beasts of ${LANDS[subj.land] || 'the island'}`,
  where: (subj, lore) => {
    const R = lore.realms.find((q) => q.island === subj.land);
    return R ? { name: R.capName, faith: R.faith } : null;
  },
  write(W, lore, subj, meta, rng) {
    const out = [];
    const land = LANDS[subj.land] || 'the island';
    const base = { subject: `the beasts of ${land}`, land, year: String(meta.year) };
    const all = lore.beasts(subj.land);
    const cite = rng.pick(citable(lore, meta, (e) => e.subj.land === subj.land && (e.genre === 'deeps' || e.genre === 'road')));
    chapter(out, 0, 'To the Reader');
    out.push(W.para('preface', { ...base, ...citeFacts(cite) }, { min: 1, max: 2 }));
    out.push(W.para('beastopen', base, { min: 2, max: 3 }));
    out.push(`> ${meta.author.sign}, in the year ${meta.year}`);
    let n = 1;
    const parts = [
      ['Of Tame Beasts', all.filter((b) => b.tame)],
      ['Of Wild Beasts', all.filter((b) => !b.tame && b.mode !== 'hostile')],
      ['Of Things That Hunt', all.filter((b) => b.mode === 'hostile' && !b.night)],
      ['Of Things That Come by Night', all.filter((b) => b.mode === 'hostile' && b.night)],
    ];
    for (const [title, list] of parts) {
      if (!list.length) continue;
      chapter(out, n++, title);
      for (const b of list) {
        const name = b.name.toLowerCase();
        out.push(`## ${b.name}`);
        const habit = b.night ? 'beast.habit.night' : b.packs ? 'beast.habit.pack' : b.floats ? 'beast.habit.float' : b.tame ? 'beast.habit.tame' : 'none';
        // (Its size and strength: a danger only if it fights.)
        const body = b.hp <= 4 ? 'beast.body.weak' : !b.dmg ? 'beast.body.big' : b.hp <= 12 ? 'beast.body.fair' : 'beast.body.hardy';
        const f = { ...base, beast: name, beasts: plural(name), drops: b.drops.length ? listOf([...new Set(b.drops.map(dropWord))]) : null };
        out.push(W.para('beast', f, { min: 2, max: 4, pools: { nature: `beast.nature.${b.mode}`, habit, body, advice: b.tame ? 'beast.advice.tame' : `beast.advice.${b.mode}`, use: b.tame ? 'beast.use.tame' : 'beast.use' } }));
      }
    }
    // The things only told of.
    const styles = [...new Set(lore.ow.settlements.filter((q) => (q.island || 'thessa') === subj.land).map((q) => (q.civ ? q.civ.style : q.style) || 'vale'))];
    if (styles.length) {
      chapter(out, n++, 'Of Beasts Told Of, and Not Seen');
      for (const st of rng.shuffle(styles.slice()).slice(0, 3)) {
        const H = lore.haunts(st);
        const near = lore.ow.settlements.find((q) => (q.island || 'thessa') === subj.land && ((q.civ ? q.civ.style : q.style) || 'vale') === st);
        out.push(W.para('haunt', { ...base, haunt: rng.pick(H.beasts), place: rng.pick(H.places), people: peopleOf(st), near: near ? near.name : null }, { min: 2, max: 3 }));
      }
    }
    out.push('~');
    return out;
  },
};

// ============================================================ the book of a faith
GENRES.faith = {
  weight: 0.9,
  copies: 2,
  subjects: (lore) => lore.realms.filter((R) => R.faith).map((R) => ({ id: `f${R.id}`, realm: R.id, land: R.island, R })),
  title: (rng, subj) => {
    const f = subj.R.faith;
    return rng.pick([`The Book of ${bare(f.god).replace(/^(\w)/, (c) => c.toUpperCase())}`.replace(/^The Book of /, 'The Book of the ').replace(/^The Book of the (Saint|Thunderer|Mother|Father) /, 'The Book of $1 '), `${cap(f.faith)}: Its Teachings`, `Sayings of the ${titleCase(plural(f.clergy))}`, `On ${f.faith}`]).replace(/the The /g, 'the ');
  },
  style: (subj) => subj.R.style,
  topic: (subj) => subj.R.faith.faith,
  where: (subj) => ({ name: subj.R.capName, faith: subj.R.faith }),
  write(W, lore, subj, meta, rng) {
    const R = subj.R;
    const f = R.faith;
    const out = [];
    const base = { ...realmFacts(lore, R, meta.year), subject: f.faith, symbol: f.symbol, sacredbeast: f.beast, godcall: bare(f.god) };
    const cite = rng.pick(citable(lore, meta, (e) => e.subj.realm === R.id && ['realm', 'faith', 'annals'].includes(e.genre)));
    chapter(out, 0, 'To the Reader');
    out.push(W.para('preface', { ...base, ...citeFacts(cite) }, { min: 2, max: 3 }));
    out.push(`> ${meta.author.sign}, in the year ${meta.year}`);
    let n = 1;
    chapter(out, n++, `Of ${f.god}`);
    out.push(W.para('god', base, { min: 3, max: 4 }));
    chapter(out, n++, `The Holy Day, and ${f.feast}`);
    out.push(W.para('holy', base, { min: 2, max: 3 }));
    chapter(out, n++, `Of ${cap(f.virtue)}`);
    out.push(W.para('virtue', base, { min: 2, max: 4 }));
    if (f.taboos.length) {
      chapter(out, n++, 'What the Faithful Do Not Do');
      for (const k of f.taboos) out.push(W.para('rule', { ...base, taboo: lore.taboo(k) }, { min: 1, max: 3 }));
    }
    chapter(out, n++, 'Of the Dead');
    out.push(W.para('dead', base, { min: 2, max: 3 }));
    chapter(out, n++, 'A Parable');
    out.push(W.para('parable', base, { min: 3, max: 4 }));
    chapter(out, n++, 'A Prayer');
    out.push(W.para('prayer', base, { min: 3, max: 4 }));
    out.push('~');
    return out;
  },
};

export { loreOf };
