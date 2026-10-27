// (Round 146) What goes on at the places a town's known for, and when (see
// sim/cities.js): the games at the arena, the races, the plays, the
// services and feast days, the lectures and the star-watching, the
// auctions, the fair days, the castings at the foundry, the drill at the
// citadel, the launch of a ship, the gatherings at the old stones, the
// delvers going down. Each kind has its own lasting state (its fighters
// and their records, its horses, its plays, the names of the delvers lost
// below), its own day's doings worked out from the world's seed and that
// state, and its own way of turning out when nobody's there to watch (when
// someone is, the show plays out before them: see game/cityplay.js).
import { RNG, hash4 } from '../util/rng.js';
import { personName } from '../world/names.js';
import { familyOf } from '../world/specialties.js';
import { religionOf } from './culture.js';
import { DAY } from './econ.js';

const at = (day, min) => day * DAY + min;
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// ------------------------------------------------------------ names
// Fighters: a name and an epithet, and a way of fighting by their people.
const STYLES = {
  classic: ['Murmillo', 'Retiarius', 'Secutor', 'Thraex', 'Hoplomachus', 'Dimachaerus'],
  north: ['Shield-breaker', 'Berserker', 'Axe-dancer', 'Spear-wall'],
  sun: ['Sand-runner', 'Scorpion', 'Chariot-born', 'Twin-blade'],
  jade: ['Crane stance', 'Tiger stance', 'Iron palm', 'Willow sword'],
  high: ['Hammer-hand', 'Anvil', 'Shieldwall', 'Pick-and-axe'],
  any: ['Brawler', 'Blade', 'Spearman', 'Bruiser', 'Duellist'],
};
const EPITHETS = ['the Red', 'the Unbroken', 'Iron-jaw', 'the Lion', 'the Quick', 'Bloodsand', 'the Bear', 'Grim', 'the Viper', 'Stonefist', 'the Gentle', 'the Butcher', 'Fair-hair', 'the Old Wolf', 'Thunder', 'the Ghost'];
const CRIMES = ['horse-theft', 'smuggling', 'brawling', 'desertion', 'banditry', 'poaching', 'arson', 'debt', 'heresy', 'robbing the tolls'];

export function fighterName(rng, style) {
  const n = personName(rng, style);
  return { name: `${n.first} ${rng.pick(EPITHETS)}`, first: n.first };
}

// Horses: two words, fine-sounding; their colours (the silks).
const H_A = ['Swift', 'Red', 'Golden', 'Night', 'Storm', 'Silver', 'Wild', 'Lucky', 'Proud', 'Bold', 'Old', 'Morning', 'Thunder', 'Dancing', 'Iron', 'Falling'];
const H_B = ['Arrow', 'Wind', 'Star', 'Dancer', 'Spark', 'Comet', 'Lady', 'Prince', 'Hoof', 'Runner', 'Fire', 'Song', 'Ghost', 'Rain', 'Crown', 'Glory'];
const SILKS = [['#a82a2a', '#f0e0a0'], ['#2a5aa8', '#ffffff'], ['#2a8a4a', '#f0c040'], ['#6a2a8a', '#f0e0f0'], ['#e0a020', '#2a2a2a'], ['#f0f0f0', '#a82a2a'], ['#1a1a1a', '#e0c040'], ['#c85a8a', '#2a2a5a']];
export function horseName(rng) {
  return `${rng.pick(H_A)} ${rng.pick(H_B)}`;
}

// Plays: a title by its kind, and who wrote it.
const PLAYS = {
  tragedy: ['The Fall of {h}', 'The King Who Would Not Kneel', '{h}\'s Daughter', 'Ashes of {p}', 'The Last Watch', 'Blood on the Snow', 'The Drowned Bride'],
  comedy: ['The Miser\'s Goose', 'Two Grooms and a Goat', 'The Mayor\'s New Hat', 'Much Ado at {p}', 'The Merry Widow of {p}', 'Three Wrong Doors', 'The Baker\'s Revenge'],
  history: ['The Siege of {p}', 'The Founding of {p}', '{h} the Bold', 'The Long War', 'The Crown of {p}'],
  romance: ['The Lantern and the Moth', 'Letters from {p}', 'A Ring of Reeds', 'The Ferryman\'s Love', 'Under the Plum Tree'],
};
export const PLAY_LINES = {
  tragedy: ['Is this the end of all our hopes?', 'I loved you, and it was not enough.', 'The crown is heavy, and the night is long.', 'Strike, then! I am already dead.', 'Who weeps for the king? No one.', 'Let the gods judge me; I am done.'],
  comedy: ['That goose is MINE!', 'I am not drunk, the floor is moving!', 'Wrong door again!', 'Hide! Here comes my wife!', 'A hat! My kingdom for a hat!', 'You call that a pie?'],
  history: ['Hold the gate! Hold it, I say!', 'Here we raise our town, and here we stay.', 'For the realm, and for our children!', 'They come at dawn. Let them come.', 'This stone shall stand a thousand years.'],
  romance: ['Meet me where the river bends.', 'Every star tonight is yours.', 'I would cross the sea for you.', 'Say it, then. Say you\'ll stay.', 'A lantern, and a promise.'],
};

// What an auction might put up: rare things, with what they're worth.
const LOTS = [
  ['relic_shard', 'a shard of an old relic'], ['gem', 'a cut gem'], ['pearl_necklace', 'a pearl necklace'], ['steel_sword', 'a steel blade'], ['treasure_map', 'an old map'],
  ['silk', 'a bolt of silk'], ['spices', 'a crate of spices'], ['marble_bust', 'a marble bust'], ['star_chart', 'a chart of the stars'], ['laurel_wreath', 'a champion\'s laurels'],
  ['fine_coat_purple', 'a coat fit for a prince'], ['gold_circlet', 'a gold circlet'], ['moonstone', 'a moonstone'], ['bloodstone', 'a bloodstone'], ['lute', 'a fine lute'],
];

// ------------------------------------------------------------ helpers
// The dice for a quarter's day (the same each time it's asked).
export function dayRng(L, i, day, salt = 0) {
  return new RNG(hash4(L.settlement.seed >>> 0, i * 131 + salt, day, 0x5e0));
}
const offset = (L, i, n) => (hash4(L.settlement.seed >>> 0, i, 0x5e1) % n);

// ------------------------------------------------------------ the kinds
// Each: init(ctx) makes its lasting state; events(ctx, day) its doings for
// a day ({ type, title, s, e, crowd (a share of the town, or 0), act
// (what those who come do: 'show' to sit and watch, 'pray'), data });
// resolve(ctx, ev) how one turned out, unwatched: what's said of it (news),
// and what it changed in the state.
export const SHOWS = {
  // ------------------------------------------------------------ arena
  arena: {
    init({ L, q, rng }) {
      const style = familyOf(L.settlement.style);
      const ways = STYLES[style] || STYLES.any;
      const roster = [];
      for (let k = 0; k < (q.size === 'city' ? 8 : q.size === 'town' ? 6 : 4); k++) {
        const f = fighterName(rng, L.settlement.style);
        roster.push({ id: k + 1, name: f.name, way: rng.pick(ways), skill: rng.float(0.35, 0.9), w: rng.int(0, 12), l: rng.int(0, 8), fame: 0 });
      }
      for (const f of roster) f.fame = f.w * 2 - f.l;
      const condemned = [];
      for (let k = 0; k < 2; k++) condemned.push({ id: 100 + k, name: personName(rng, L.settlement.style).first + ' ' + personName(rng, L.settlement.style).last, crime: rng.pick(CRIMES), w: 0 });
      return { roster, condemned, champ: roster.reduce((a, b) => (b.fame > a.fame ? b : a)).id, nextId: 200, log: [] };
    },
    events({ L, q, st }, day) {
      const i = q.i;
      if ((day + offset(L, i, 3)) % 3 !== 0) return [];
      const rng = dayRng(L, i, day, 1);
      const pool = [...st.roster];
      const bouts = [];
      const n = q.size === 'village' ? 2 : q.size === 'town' ? 3 : 4;
      for (let k = 0; k < n && pool.length >= 2; k++) {
        // (The condemned fight for their freedom: the third bout, if any wait.)
        if (k === n - 1 && st.condemned.length) {
          const c = st.condemned[0];
          const a = pool.splice(rng.int(0, pool.length - 1), 1)[0];
          bouts.push({ a: a.id, b: c.id, kind: 'freedom' });
          continue;
        }
        const a = pool.splice(rng.int(0, pool.length - 1), 1)[0];
        const b = pool.splice(rng.int(0, pool.length - 1), 1)[0];
        bouts.push({ a: a.id, b: b.id, kind: k === n - 2 && q.size === 'city' ? 'title' : 'bout' });
      }
      return [{ type: 'games', title: 'The Games', s: at(day, 840), e: at(day, 1050), crowd: 0.4, act: 'show', data: { bouts } }];
    },
    resolve({ L, st, rng }, ev) {
      const news = [];
      for (const b of ev.data.bouts) {
        if (b.result) continue;
        const A = fighterOf(st, b.a);
        const Bf = fighterOf(st, b.b);
        if (!A || !Bf) continue;
        const pa = (A.skill ?? 0.5) / ((A.skill ?? 0.5) + (Bf.skill ?? 0.45));
        b.result = rng.chance(pa) ? 'a' : 'b';
        settleBout(st, b, L, news);
      }
      return news;
    },
  },
  // ------------------------------------------------------------ racecourse
  racecourse: {
    init({ L, q, rng }) {
      const horses = [];
      for (let k = 0; k < (q.size === 'city' ? 10 : 7); k++) {
        horses.push({ id: k + 1, name: horseName(rng), jockey: personName(rng, L.settlement.style).first, speed: rng.float(0.4, 0.95), stam: rng.float(0.4, 0.95), w: rng.int(0, 6), starts: rng.int(4, 20), silks: k % SILKS.length });
      }
      return { horses, log: [] };
    },
    events({ L, q, st }, day) {
      const i = q.i;
      if ((day + offset(L, i, 4)) % 4 !== 0) return [];
      const rng = dayRng(L, i, day, 2);
      const races = [];
      const n = 3;
      for (let k = 0; k < n; k++) {
        const field = rng.shuffle([...st.horses]).slice(0, Math.min(st.horses.length, q.size === 'village' ? 4 : 6)).map((h) => h.id);
        races.push({ field, name: rng.pick(['the Maiden Plate', 'the Golden Spurs', 'the Long Mile', 'the Mayor\'s Cup', 'the Old Course', 'the Sprint', 'the Grand Stakes']) });
      }
      return [{ type: 'races', title: 'Race Day', s: at(day, 900), e: at(day, 1080), crowd: 0.35, act: 'show', data: { races } }];
    },
    resolve({ st, rng }, ev) {
      const news = [];
      for (const r of ev.data.races) {
        if (r.result) continue;
        const scored = r.field.map((id) => {
          const h = st.horses.find((o) => o.id === id);
          return { id, v: h ? h.speed * 0.6 + h.stam * 0.3 + rng.float(0, 0.45) : 0 };
        }).sort((a, b) => b.v - a.v);
        r.result = scored.map((o) => o.id);
        settleRace(st, r, news);
      }
      return news;
    },
  },
  // ------------------------------------------------------------ theatre
  theatre: {
    init({ L, rng }) {
      const s = L.settlement;
      const plays = [];
      for (let k = 0; k < 6; k++) {
        const genre = rng.pick(Object.keys(PLAYS));
        const hero = personName(rng, s.style).first;
        const place = rng.chance(0.5) ? s.name : rng.pick(['the Vale', 'the North', 'the Old City', 'the Islands', 'the Marsh']);
        const title = rng.pick(PLAYS[genre]).replace('{h}', hero).replace('{p}', place);
        const author = personName(rng, s.style);
        plays.push({ id: k + 1, title, genre, author: `${author.first} ${author.last}`, acts: rng.int(2, 4), fame: rng.int(0, 5), shows: 0 });
      }
      return { plays, log: [] };
    },
    events({ L, q, st }, day) {
      const i = q.i;
      if ((day + offset(L, i, 7)) % 7 === 6) return [];
      const play = st.plays[Math.floor(day / 3) % st.plays.length];
      return [{ type: 'play', title: play.title, s: at(day, 1140), e: at(day, 1290), crowd: 0.3, act: 'show', data: { play: play.id, genre: play.genre } }];
    },
    resolve({ st, rng }, ev) {
      const p = st.plays.find((o) => o.id === ev.data.play);
      if (!p) return [];
      p.shows++;
      const good = rng.chance(0.55 + p.fame * 0.03);
      p.fame = Math.max(0, p.fame + (good ? 1 : -1));
      ev.data.reception = good ? 'cheers' : 'jeers';
      return good && p.fame >= 6 && p.shows % 5 === 0 ? [`"${p.title}" packed the theatre again: they say it's the best thing ${p.author} ever wrote.`] : [];
    },
  },
  // ------------------------------------------------------------ holy
  holy: {
    init({ L, rng }) {
      const faith = religionOf(L.settlement);
      return { god: faith ? faith.god : 'the Old Mother', saint: personName(rng, L.settlement.style).first, pilgrims: 0, log: [] };
    },
    events({ L, q, st }, day) {
      const evs = [
        { type: 'service', title: 'Morning Prayers', s: at(day, 420), e: at(day, 465), crowd: 0.15, act: 'pray' },
        { type: 'service', title: 'Evensong', s: at(day, 1080), e: at(day, 1125), crowd: 0.2, act: 'pray' },
      ];
      if ((day + offset(L, q.i, 30)) % 30 === 0) evs.push({ type: 'feast', title: `The Feast of Saint ${st.saint}`, s: at(day, 600), e: at(day, 960), crowd: 0.5, act: 'pray', data: { pilgrims: 4 + (q.size === 'city' ? 6 : 2) } });
      return evs;
    },
    resolve({ st }, ev) {
      if (ev.type !== 'feast') return [];
      st.pilgrims += ev.data.pilgrims;
      return [`Pilgrims came from far and wide for the Feast of Saint ${st.saint}.`];
    },
  },
  // ------------------------------------------------------------ library
  library: {
    init({ L, rng }) {
      const topics = ['the stars and their courses', 'the old kings', 'the Kavorent', 'the healing herbs', 'the far isles', 'the making of steel', 'the speech of birds', 'the founding of the realm'];
      return { topics: rng.shuffle(topics), log: [], lectures: 0 };
    },
    events({ L, q, st }, day) {
      const evs = [];
      if ((day + offset(L, q.i, 5)) % 5 === 0) evs.push({ type: 'lecture', title: `A Lecture on ${st.topics[Math.floor(day / 5) % st.topics.length]}`, s: at(day, 900), e: at(day, 990), crowd: 0.1, act: 'show' });
      if (q.f && q.f.includes('observatory')) evs.push({ type: 'stars', title: 'Star-Watching', s: at(day, 1260), e: at(day, 1380), crowd: 0.04, act: 'show' });
      return evs;
    },
    resolve({ st }, ev) {
      if (ev.type === 'lecture') st.lectures++;
      return [];
    },
  },
  // ------------------------------------------------------------ bazaar
  bazaar: {
    init() {
      return { log: [], sold: 0 };
    },
    events({ L, q }, day) {
      if (!q.f || !q.f.includes('auction')) return [];
      if ((day + offset(L, q.i, 5)) % 5 !== 0) return [];
      const rng = dayRng(L, q.i, day, 3);
      const lots = rng.shuffle([...LOTS]).slice(0, 4).map(([item, desc]) => ({ item, desc, base: 0 }));
      return [{ type: 'auction', title: 'The Auction', s: at(day, 660), e: at(day, 750), crowd: 0.15, act: 'show', data: { lots } }];
    },
    resolve({ st, rng }, ev) {
      for (const lot of ev.data.lots) {
        if (lot.sold) continue;
        lot.sold = rng.chance(0.85) ? 'npc' : 'none';
      }
      st.sold += ev.data.lots.filter((o) => o.sold === 'npc').length;
      return [];
    },
  },
  // ------------------------------------------------------------ fair
  fair: {
    init() {
      return { log: [], champ: null };
    },
    events({ L, q }, day) {
      const k = (day + offset(L, q.i, 10)) % 10;
      if (k > 1) return [];
      return [{ type: 'fairday', title: k === 0 ? 'Fair Day' : 'Fair Day (the second)', s: at(day, 540), e: at(day, 1260), crowd: 0.45, act: 'stroll' }];
    },
    resolve({ L, st, rng }) {
      const who = personName(rng, L.settlement.style).first;
      st.champ = who;
      return rng.chance(0.4) ? [`${who} rang the bell on the striker three times running at the fair.`] : [];
    },
  },
  // ------------------------------------------------------------ citadel
  citadel: {
    init() {
      return { log: [], hired: 0 };
    },
    events(_, day) {
      return [{ type: 'drill', title: 'The Drill', s: at(day, 420), e: at(day, 540), crowd: 0, act: 'show' }];
    },
    resolve() {
      return [];
    },
  },
  // ------------------------------------------------------------ baths
  baths: {
    init() {
      return { log: [] };
    },
    events(_, day) {
      return [{ type: 'bathing', title: 'The Evening Bath', s: at(day, 1080), e: at(day, 1200), crowd: 0.2, act: 'bathe' }];
    },
    resolve() {
      return [];
    },
  },
  // ------------------------------------------------------------ forge
  forge: {
    init() {
      return { log: [], castings: 0 };
    },
    events({ L, q }, day) {
      if ((day + offset(L, q.i, 4)) % 4 !== 0) return [];
      return [{ type: 'casting', title: 'The Pour', s: at(day, 600), e: at(day, 660), crowd: 0.08, act: 'show' }];
    },
    resolve({ st }) {
      st.castings++;
      return [];
    },
  },
  // ------------------------------------------------------------ winery
  winery: {
    init({ rng }) {
      return { log: [], vintage: rng.int(2, 5) };
    },
    events({ L, q }, day) {
      const k = (day + offset(L, q.i, 30)) % 30;
      const evs = [{ type: 'tasting', title: 'The Tasting', s: at(day, 1050), e: at(day, 1170), crowd: 0.06, act: 'show' }];
      if (k >= 20 && k <= 23) evs.push({ type: 'harvest', title: 'The Harvest', s: at(day, 420), e: at(day, 1020), crowd: 0.1, act: 'farm' });
      return evs;
    },
    resolve({ st, rng }, ev) {
      if (ev.type !== 'harvest') return [];
      st.vintage = Math.max(1, Math.min(5, st.vintage + rng.int(-1, 1)));
      return st.vintage >= 5 ? ['They say this year\'s vintage will be one to remember.'] : [];
    },
  },
  // ------------------------------------------------------------ shipyard
  shipyard: {
    init() {
      return { log: [], launched: 0 };
    },
    events({ L, q }, day) {
      if ((day + offset(L, q.i, 20)) % 20 !== 0) return [];
      return [{ type: 'launch', title: 'A Launching', s: at(day, 720), e: at(day, 780), crowd: 0.35, act: 'show' }];
    },
    resolve({ L, st, rng }) {
      st.launched++;
      const name = `the ${rng.pick(['Swift', 'Gull', 'Maiden', 'Fortune', 'Grey', 'Morning'])} ${rng.pick(['Star', 'Wing', 'Pride', 'Queen', 'Lark', 'Wind'])}`;
      st.lastShip = name;
      return [`A new ship, ${name}, went down the slip at ${L.settlement.name}.`];
    },
  },
  // ------------------------------------------------------------ gardens
  gardens: {
    init() {
      return { log: [] };
    },
    events(_, day) {
      return [{ type: 'promenade', title: 'The Evening Promenade', s: at(day, 1020), e: at(day, 1140), crowd: 0.15, act: 'stroll' }];
    },
    resolve() {
      return [];
    },
  },
  // ------------------------------------------------------------ monastery
  monastery: {
    init() {
      return { log: [] };
    },
    events(_, day) {
      return [{ type: 'forms', title: 'The Morning Forms', s: at(day, 360), e: at(day, 420), crowd: 0.04, act: 'show' }];
    },
    resolve() {
      return [];
    },
  },
  // ------------------------------------------------------------ circle
  circle: {
    init() {
      return { log: [] };
    },
    events({ L, q }, day) {
      if ((day + offset(L, q.i, 15)) % 15 !== 0) return [];
      return [{ type: 'gathering', title: 'The Gathering at the Stones', s: at(day, 1260), e: at(day, 1410), crowd: 0.3, act: 'pray' }];
    },
    resolve() {
      return [];
    },
  },
  // ------------------------------------------------------------ the delve
  delve: {
    init() {
      return { log: [], lost: [], hauls: 0, trips: 0 };
    },
    events({ L, q }, day) {
      if ((day + offset(L, q.i, 3)) % 3 !== 0) return [];
      return [{ type: 'expedition', title: 'The Delvers Go Down', s: at(day, 480), e: at(day, 1080), crowd: 0.08, act: 'show' }];
    },
    resolve({ L, st, rng }) {
      st.trips++;
      const news = [];
      // (Most come back with something; now and then one doesn't come
      // back at all, and their name goes on the stone.)
      const delvers = L.npcs.filter((r) => r.job === 'delver' && r.alive !== false && !r.away);
      if (rng.chance(0.65)) {
        st.hauls++;
        if (rng.chance(0.3)) news.push(rng.pick(['The delvers came up with a chest of old coin.', 'The delvers brought up a relic nobody can name.', 'A good day below: the delvers are buying the drinks.']));
      }
      if (delvers.length && rng.chance(0.06)) {
        const r = rng.pick(delvers);
        st.lost.push({ name: `${r.name.first} ${r.name.last}`, day: Math.floor(L.sim ? L.sim.today() : 0) });
        st.lostRec = r.idx;
        news.push(`${r.name.first} ${r.name.last} went down into the delve and never came back up.`);
      }
      return news;
    },
  },
};
// (The rest keep no calendar of their own: their days are their work.)
for (const k of ['apiary', 'quarry', 'ruins']) SHOWS[k] = { init: () => ({ log: [] }), events: () => [], resolve: () => [] };

// ------------------------------------------------------------ the arena's books
export function fighterOf(st, id) {
  return st.roster.find((f) => f.id === id) || st.condemned.find((f) => f.id === id) || (st.guests || []).find((f) => f.id === id) || null;
}

// A bout settled (`b.result` 'a' or 'b'): the records, the champion, the
// condemned's freedom.
export function settleBout(st, b, L, news) {
  const A = fighterOf(st, b.a);
  const Bf = fighterOf(st, b.b);
  if (!A || !Bf) return;
  const win = b.result === 'a' ? A : Bf;
  const lose = b.result === 'a' ? Bf : A;
  win.w = (win.w || 0) + 1;
  lose.l = (lose.l || 0) + 1;
  if (win.fame !== undefined) win.fame += b.kind === 'title' ? 4 : 2;
  if (lose.fame !== undefined) lose.fame = Math.max(-5, lose.fame - 1);
  const winner = win.name;
  if (b.kind === 'freedom') {
    const c = st.condemned.find((o) => o === win || o === lose);
    if (c === win) {
      c.w = (c.w || 0) + 1;
      if (c.w >= 3) {
        st.condemned = st.condemned.filter((o) => o !== c);
        news.push(`${c.name}, condemned for ${c.crime}, won a third bout in the arena and walked out free.`);
        st.freed = (st.freed || 0) + 1;
      }
    } else if (c) {
      // (Beaten: back to the cells, to try again another day; or, after a
      // third loss, given up on and sent off to the mines.)
      c.l = (c.l || 0) + 1;
      if (c.l >= 3) st.condemned = st.condemned.filter((o) => o !== c);
    }
  }
  // The champion: whoever stands highest.
  const best = st.roster.reduce((a, f) => (!a || f.fame > a.fame ? f : a), null);
  if (best && best.id !== st.champ) {
    st.champ = best.id;
    news.push(`${best.name} is champion of the arena at ${L.settlement.name} now.`);
  }
  if (b.kind === 'title') news.push(`${winner} won the title bout at ${L.settlement.name}.`);
}

// A race settled (`r.result`: the field in the order they finished).
export function settleRace(st, r, news) {
  r.result.forEach((id, k) => {
    const h = st.horses.find((o) => o.id === id);
    if (!h) return;
    h.starts++;
    if (k === 0) h.w++;
  });
  const h = st.horses.find((o) => o.id === r.result[0]);
  if (h && h.w > 0 && h.w % 5 === 0) news.push(`${h.name} has won ${h.w} races now: the finest horse on the course.`);
}

export { SILKS, LOTS, CRIMES, cap };
