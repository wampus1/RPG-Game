// Every town has a past: who founded it and when, the fires, floods and
// sieges it came through, what it's known for, and the old story folk tell
// round the fire. It's cut on the plaque by the old statue on the square,
// written up in the library's books, and told by anyone who's asked. What
// happens from now on (battles, raids, heroes, a new ruler, a town grown
// into a city) is added as it happens, and the greatest deeds get a statue
// of their own on the square.
import { RNG, hash4 } from '../util/rng.js';
import { B } from '../world/blocks.js';
import { M } from '../world/settlement.js';
import { GROUND } from '../config.js';
import { ledger } from './econ.js';
import { religionOf, cuisineOf } from './culture.js';

// The year it is now: a year here runs sixty days.
const YEAR_DAYS = 60;
const BASE_YEAR = 1180;
export function yearOf(day) {
  return BASE_YEAR + Math.floor(Math.max(0, day) / YEAR_DAYS);
}

const FOUNDERS = {
  vale: ['Aldo', 'Berta', 'Corin', 'Dela', 'Emrys', 'Fenna', 'Galt', 'Hesse', 'Ines', 'Jorn'],
  north: ['Asgrim', 'Brynja', 'Egil', 'Frida', 'Halvar', 'Ingrid', 'Ketil', 'Sigrun'],
  sun: ['Amun', 'Bastet', 'Farid', 'Hanan', 'Idris', 'Layla', 'Nabil', 'Samira'],
  wild: ['Ayo', 'Chidi', 'Ekon', 'Imani', 'Kofi', 'Nia', 'Tendai', 'Zola'],
  high: ['Balin', 'Dagna', 'Durin', 'Helga', 'Thrain', 'Brunhild', 'Gimra', 'Orsik'],
};
const EPITHETS = ['the Elder', 'the Founder', 'Oakheart', 'the Bold', 'Longstride', 'the Wise', 'Ironhand', 'the Wanderer', 'Hearthkeeper', 'of the Old Road'];
const CAME = ['over the hills', 'up the river', 'across the sea', 'out of the east', 'down from the high passes', 'fleeing a hard winter', 'following a wandering star'];
const BEASTS = ['a great white stag', 'a wolf as big as a horse', 'a serpent in the deep water', 'a wyrm under the hill', 'a headless rider', 'a lady in grey', 'a bear that walks like a man'];
const PLACES = ['the old well', 'the graveyard', 'the hill road', 'the mill race', 'the ruined tower', 'the crossroads'];

// Recent news worth writing into a town's history (from its ledger).
const NOTABLE = /Battle of|raided|raiders|burned|sacked|is named Hero|statue|crowned|now rules|is a (town|city) now|became a (town|city)|swore|broke away|made peace|declared war|opens its gates|taken by|bandits|exiled|founded|plague|great fire|are no more|opened the doors of their own|week after week/i;

export class History {
  constructor(game, sim) {
    this.game = game;
    this.sim = sim;
  }

  // The town's story (made up the first time it's asked for).
  of(L) {
    const e = L.econ;
    if (!e.history) e.history = this.generate(L);
    return e.history;
  }

  generate(L) {
    const s = L.settlement;
    const rng = new RNG(hash4(s.seed >>> 0, 0x415f));
    const style = (s.civ ? s.civ.style : s.style) || 'vale';
    const now = yearOf(this.game.day);
    const age = s.type === 'city' ? rng.int(280, 520) : s.type === 'town' ? rng.int(110, 300) : rng.int(35, 150);
    const founded = now - age;
    const founder = `${rng.pick(FOUNDERS[style] || FOUNDERS.vale)} ${rng.pick(EPITHETS)}`;
    const entries = [];
    const at = (lo, hi) => founded + Math.round(age * rng.float(lo, hi));
    entries.push({ y: founded, text: `${s.name} was founded by ${founder}, who came ${rng.pick(CAME)} with ${rng.int(3, 12)} families.`, kind: 'founded' });
    const pool = [];
    if (s.type !== 'village') pool.push(() => ({ y: at(0.2, 0.6), text: `Most of ${s.name} burned in the Great Fire, and was built again ${s.type === 'city' ? 'in stone' : 'by the next summer'}.`, kind: 'fire' }));
    if (s.river || s.lake || s.coast) pool.push(() => ({ y: at(0.1, 0.8), text: `The ${s.coast ? 'sea came over the harbour wall' : s.river ? 'river burst its banks' : 'lake rose'} and took the old mill and half the fields.`, kind: 'flood' }));
    pool.push(() => ({ y: at(0.3, 0.9), text: 'The coughing sickness took one in five. The graveyard was doubled that year.', kind: 'plague' }));
    if (s.type === 'city' || L.walled) pool.push(() => ({ y: at(0.4, 0.9), text: `${s.name} held out through a long siege, and the walls were raised higher after.`, kind: 'siege' }));
    pool.push(() => ({ y: at(0.05, 0.5), text: `The temple of ${religionOf(s).god} was raised on the hill.`, kind: 'temple' }));
    pool.push(() => ({ y: at(0.2, 0.95), text: 'A hungry winter: the snow lay till spring, and the town ate its seed corn.', kind: 'famine' }));
    pool.push(() => ({ y: at(0.1, 0.9), text: `A star with a burning tail hung over ${s.name} for nine nights.`, kind: 'omen' }));
    if (s.civ) pool.push(() => ({ y: at(0.6, 0.98), text: `${s.name} swore itself to the ${s.civ.name.replace(/^The /, '')}.`, kind: 'realm' }));
    for (const f of rng.shuffle(pool).slice(0, s.type === 'city' ? 4 : s.type === 'town' ? 3 : 2)) entries.push(f());
    entries.sort((a, b) => a.y - b.y);
    // Known for.
    const c = cuisineOf(s);
    const known = [];
    if (s.nearMountain) known.push('its iron', 'its miners');
    if (s.coast || s.river || s.lake) known.push('its fish', 'its boatmen');
    if (['forest', 'taiga', 'jungle'].includes(s.biome)) known.push('its timber');
    if (['plains', 'savanna'].includes(s.biome)) known.push('its horses');
    if (L.fields && L.fields.length) known.push('its harvest fairs');
    known.push(`its ${c.word.split(' and ')[0]}`);
    if (!(/ale|mead|beer/.test(c.drink) && religionOf(s).taboos.includes('no_drink'))) known.push(`its ${c.drink}`);
    const famous = rng.pick(known);
    const legend = rng.pick([
      `${founder}'s ghost walks ${rng.pick(PLACES)} on ${religionOf(s).holyName} nights.`,
      `${rng.pick(BEASTS)} lives out past ${rng.pick(PLACES)}. Folk who go looking don't come back the same.`,
      `There's gold buried under ${rng.pick(PLACES)}, from before the town was even here.`,
      `the old statue on the square weeps on the day ${founder} died.`,
      `${founder} never died at all, and sleeps under the hill till ${s.name} needs them again.`,
    ]);
    return { founded, founder, famous, legend, entries, scanned: 0 };
  }

  // Something worth remembering happened here.
  add(L, text, kind = 'event', day = this.game.day) {
    if (!L || !L.econ) return null;
    const h = this.of(L);
    if (h.entries.some((q) => q.text === text)) return null;
    const it = { y: yearOf(day), day, text, kind };
    h.entries.push(it);
    // (The made-up past is kept; the recent run is trimmed.)
    const live = h.entries.filter((q) => q.day !== undefined);
    if (live.length > 30) h.entries.splice(h.entries.indexOf(live[0]), 1);
    return it;
  }

  // Daily: the notable lines of the town's ledger go into its history.
  daily(L, day) {
    const h = this.of(L);
    const list = L.econ.ledger || [];
    for (const it of list) {
      if (it.day < (h.scanned || 0) || it.day > day) continue;
      if (NOTABLE.test(it.text) && !/council wants|can't pay/i.test(it.text)) this.add(L, it.text, 'news', it.day);
    }
    h.scanned = day + 1;
  }

  // The plaque by the old statue (and the history book in the library).
  lines(L, max = 14) {
    const h = this.of(L);
    const s = L.settlement;
    const out = [`Founded in the year ${h.founded} by ${h.founder}.`, `Known far and wide for ${h.famous}.`, ''];
    const list = h.entries.filter((q) => q.kind !== 'founded');
    const keep = list.slice(-Math.max(1, max - 4));
    for (const q of keep) out.push(`${q.y}: ${q.text}`);
    if (!keep.length) out.push(`Little has happened in ${s.name} that anyone wrote down.`);
    return out;
  }

  // What someone tells you of the place.
  talk(L, rng) {
    const h = this.of(L);
    const s = L.settlement;
    const out = [`${s.name}? ${h.founder} founded it, back in ${h.founded}. ${yearOf(this.game.day) - h.founded} years ago, near enough.`];
    const old = h.entries.filter((q) => q.day === undefined && q.kind !== 'founded');
    const recent = h.entries.filter((q) => q.day !== undefined);
    if (old.length) {
      const o = rng.pick(old);
      out.push(`My grandmother used to tell how in ${o.y}... ${o.text.replace(/^\w/, (c) => c.toLowerCase())}`);
    }
    if (recent.length) out.push(`And not long ago: ${recent[recent.length - 1].text.replace(/^\w/, (c) => c.toLowerCase())}`);
    out.push(`We're known for ${h.famous.replace(/^its /, 'our ')}. And they say ${h.legend}`);
    return out;
  }

  legend(L) {
    return this.of(L).legend;
  }

  // ------------------------------------------------------------ statues
  // A statue on the square for someone who did something great here.
  raiseStatue(L, who, deed, day = this.game.day, kind = 'npc') {
    if (!L || !L.econ || !L.plaza) return null;
    const e = L.econ;
    e.statues ||= [];
    if (e.statues.some((q) => q.who === who && q.deed === deed)) return null;
    const p = L.plaza;
    const w = this.game.world;
    const taken = new Set(e.statues.map((q) => `${q.x},${q.z}`));
    let at = null;
    for (let r = 2; r <= 7 && !at; r++) {
      for (let dz = -r; dz <= r && !at; dz++) {
        for (let dx = -r; dx <= r && !at; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== r || (dx + dz) % 2) continue;
          const x = p.cx + dx;
          const z = p.cz + dz;
          if (L.maskAt(x, z) !== M.PLAZA || taken.has(`${x},${z}`)) continue;
          if (L.spots && L.spots.some && L.spots.some((q) => q.x === x && q.z === z)) continue;
          if (w.regionAt(x, z) && (w.getBlock(x, GROUND, z) !== B.air || this.game.entityAt?.(x, GROUND, z))) continue;
          at = { x, z };
        }
      }
    }
    if (!at) return null;
    this.sim.setBlocks([[at.x, GROUND, at.z, B.statue, 0]]);
    const st = { x: at.x, z: at.z, who, deed, day, kind };
    e.statues.push(st);
    const text = `A statue of ${who} was raised on the square, for ${deed}.`;
    ledger(L, day, text);
    this.add(L, text, 'statue', day);
    if (this.game.active.has(L.settlement.id)) this.game.ui.msg(`${L.settlement.name} raises a statue of ${who} on the square, for ${deed}.`, '#ffe070');
    return st;
  }

  statueAt(L, x, z) {
    return (L.econ.statues || []).find((q) => q.x === x && q.z === z) || null;
  }

  // What the statue or the plaque says.
  statueText(L, x, z) {
    const st = this.statueAt(L, x, z);
    if (st) return { title: `A STATUE OF ${st.who.toUpperCase()}`, lines: [`${st.who}`, `for ${st.deed}`, '', `Raised by the people of ${L.settlement.name}`, `in the year ${yearOf(st.day)}.`] };
    return { title: `THE HISTORY OF ${L.settlement.name.toUpperCase()}`, lines: this.lines(L) };
  }
}
