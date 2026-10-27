// (Round 146) What a place is known for, beyond its size and its people's
// ways: the arena where gladiators fight for glory and prisoners for their
// freedom, the great library and its star tower, the way down into what
// lies under the town, the seat of a faith, the grand bazaar, the foundry,
// the citadel, the baths, the theatre, the racecourse, the fairground,
// the ruins the town grew up among, the winery, the shipyard and its
// light, the gardens and their beasts, the monastery on the hill; and,
// at a village, the pit, the scriptorium, the shrine, the bloomery, the
// horse fair, the apiary, the hot spring, the stone circle, the quarry.
//
// Each town has one or two of them (a great city three, a village one now
// and then), picked when the world is made from where it stands (the
// mountains about it, the sea, the river, the old places near), who
// built it (a warlike people raises an arena, a learned one a library,
// a pious one a cathedral), how big it is, and what the towns about it
// have already: the same thing twice is rare, and never close together.
// And no two of a kind are the same: each one's form is its people's own
// (a colosseum of marble arches, a holmgang ring of carved posts, a pit
// of red earth under awnings), and each has its own features (cages for
// beasts or not, a lord's box, a champion in bronze by the gate...), its
// own name and its own story.
//
// Kept on the settlement as `s.spec` (a list of { k, form, v, f, name,
// year, founder }), worked out from the world's seed alone, so it's the
// same every time the world's loaded, here and in the layout worker.
// What's built for each is in world/quarters/, what goes on there in
// sim/cities.js.
import { RNG, hash4 } from '../util/rng.js';
import { REGION_W, REGION_D } from '../config.js';
import { OWN_TYPE } from './isledeep.js';
import { FAR_OWN_TYPE } from './fardeep.js';

// Each people's way of building, as one of a handful of families (see
// world/quarters/kit.js): what their halls, columns and roofs look like.
export const FAMILY = {
  vale: 'vale', north: 'north', sun: 'sun', wild: 'wild', high: 'high', ember: 'ember', mist: 'mist', tide: 'tide',
  velari: 'classic', rime: 'north', jade: 'jade', kesh: 'sun', corrow: 'tide', salt: 'sun', hollow: 'high', wyrd: 'north', skerry: 'north',
};
export const familyOf = (style) => FAMILY[style] || 'vale';

// The forms by the size of the place (`village`, `town`, `city`): its key,
// what it's called, and the ground it wants (across, deep; the first that
// fits).
export const SPECIALTIES = {
  arena: {
    name: 'Arena', blurb: 'gladiator games, prisoners fighting for their freedom, and a wager on every bout',
    forms: {
      village: { key: 'pit', title: 'Fighting Pit', sizes: [[15, 13], [13, 11]] },
      town: { key: 'amphitheatre', title: 'Amphitheatre', sizes: [[21, 17], [19, 15], [17, 13]] },
      city: { key: 'colosseum', title: 'Colosseum', sizes: [[29, 23], [27, 21], [25, 19], [21, 17]] },
    },
    cap: 5, spacing: 9,
    features: [['cages', 0.6], ['cells', 0.8], ['box', 0.6], ['statue', 0.5], ['awnings', 0.45], ['school', 0.7], ['shrine', 0.4], ['towers', 0.35], ['fountain', 0.25], ['grass', 0.15]],
    fit: (e) => 1 + (e.vals.martial ? 2.2 : 0) + (e.fam === 'classic' ? 2.5 : 0) + (e.fam === 'sun' ? 0.8 : 0) + (e.vals.pious ? -0.4 : 0) + (e.empire ? 1.5 : 0),
  },
  library: {
    name: 'Library', blurb: 'a great library of the world\'s books, scribes at their desks, and a tower for reading the stars',
    forms: {
      village: { key: 'scriptorium', title: 'Scriptorium', sizes: [[13, 11], [11, 9]] },
      town: { key: 'great_library', title: 'Great Library', sizes: [[19, 15], [17, 13]] },
      city: { key: 'grand_library', title: 'Grand Library', sizes: [[25, 19], [23, 17], [19, 15]] },
    },
    cap: 4, spacing: 10,
    features: [['observatory', 0.7], ['archive', 0.6], ['cloister', 0.55], ['maps', 0.7], ['scriptorium', 0.8], ['garden', 0.4], ['statues', 0.5], ['dome', 0.45]],
    fit: (e) => 0.8 + (e.vals.scholarly ? 3 : 0) + (e.vals.pious ? 0.6 : 0) + (e.fam === 'jade' || e.fam === 'classic' ? 0.8 : 0) + (e.ancient ? 0.6 : 0),
  },
  delve: {
    name: 'Delve', blurb: 'a way down into the old places under the town, and the delvers who go down it',
    forms: {
      town: { key: 'delve', title: 'Delve', sizes: [[19, 13], [17, 11], [15, 11]] },
      city: { key: 'deep_delve', title: 'Deep Delve', sizes: [[23, 15], [19, 13], [17, 11]] },
    },
    cap: 4, spacing: 12,
    features: [['guild', 1], ['relics', 0.8], ['bell', 0.6], ['infirmary', 0.5], ['barricade', 0.5], ['memorial', 0.5]],
    fit: (e) => 0.6 + e.dungeons * 1.4 + (e.mountain ? 1.2 : 0) + (e.fam === 'high' ? 1.5 : 0) + (e.vals.martial ? 0.4 : 0),
  },
  holy: {
    name: 'Holy Seat', blurb: 'pilgrims from far and wide, healing, blessings, and the great days of the faith',
    forms: {
      village: { key: 'shrine', title: 'Shrine', sizes: [[13, 11], [11, 9]] },
      town: { key: 'abbey', title: 'Abbey', sizes: [[19, 15], [17, 13]] },
      city: { key: 'cathedral', title: 'Cathedral', sizes: [[25, 19], [23, 17], [19, 15]] },
    },
    cap: 6, spacing: 10,
    features: [['spring', 0.5], ['bells', 0.7], ['relic', 0.8], ['hostel', 0.6], ['garden', 0.4], ['statues', 0.6], ['candles', 0.8], ['graves', 0.35]],
    fit: (e) => 1 + (e.vals.pious ? 3 : 0) + (e.fam === 'mist' || e.fam === 'wild' ? 0.5 : 0) + (e.lake ? 0.4 : 0),
  },
  bazaar: {
    name: 'Grand Bazaar', blurb: 'every good under the sun, auctions, and the region\'s prices on the board',
    forms: {
      town: { key: 'market_hall', title: 'Market Hall', sizes: [[19, 13], [17, 11], [15, 11]] },
      city: { key: 'grand_bazaar', title: 'Grand Bazaar', sizes: [[25, 19], [23, 17], [21, 15]] },
    },
    cap: 5, spacing: 9,
    features: [['auction', 0.8], ['exchange', 0.7], ['caravanserai', 0.5], ['fountain', 0.5], ['spices', 0.6], ['far', 0.6], ['clock', 0.3]],
    fit: (e) => 1 + (e.vals.mercantile ? 3 : 0) + (e.coast ? 0.8 : 0) + (e.river ? 0.5 : 0) + e.hub * 0.5 + (e.fam === 'sun' ? 1 : 0),
  },
  forge: {
    name: 'Forge', blurb: 'great forges and a foundry, the smiths\' guild, and ore by the cartload',
    forms: {
      village: { key: 'bloomery', title: 'Bloomery', sizes: [[13, 11], [11, 9]] },
      town: { key: 'forge_quarter', title: 'Forge Quarter', sizes: [[19, 13], [17, 11]] },
      city: { key: 'foundry', title: 'Great Foundry', sizes: [[23, 17], [21, 15], [19, 13]] },
    },
    cap: 5, spacing: 9,
    features: [['foundry', 0.6], ['mine', 0.55], ['waterwheel', 0.4], ['guild', 0.8], ['oreyard', 0.8], ['statue', 0.3], ['chimneys', 0.9]],
    fit: (e) => 0.6 + (e.mountain ? 2.2 : 0) + (e.fam === 'high' ? 2.5 : 0) + (e.fam === 'ember' ? 2.5 : 0) + (e.vals.martial ? 0.6 : 0) + (e.river ? 0.4 : 0),
  },
  citadel: {
    name: 'Citadel', blurb: 'a fortress and its garrison, the training yard, and swords for hire',
    forms: {
      town: { key: 'fort', title: 'Fort', sizes: [[19, 15], [17, 13]] },
      city: { key: 'citadel', title: 'Citadel', sizes: [[25, 19], [23, 17], [19, 15]] },
    },
    cap: 5, spacing: 10,
    features: [['keep', 0.8], ['towers', 0.8], ['yard', 1], ['armory', 0.7], ['stables', 0.5], ['mercs', 0.7], ['chapel', 0.3], ['moat', 0.25]],
    fit: (e) => 0.7 + (e.vals.martial ? 2.4 : 0) + e.border * 1.4 + (e.mountain ? 0.4 : 0) + (e.empire ? 0.8 : 0),
  },
  baths: {
    name: 'Baths', blurb: 'hot pools and cold, steam, a rub-down, and all the gossip of the town',
    forms: {
      village: { key: 'hot_spring', title: 'Hot Spring', sizes: [[13, 11], [11, 9]] },
      town: { key: 'bathhouse', title: 'Bathhouse', sizes: [[17, 13], [15, 11]] },
      city: { key: 'thermae', title: 'Thermae', sizes: [[23, 17], [21, 15], [17, 13]] },
    },
    cap: 4, spacing: 10,
    features: [['steam', 0.8], ['cold', 0.6], ['garden', 0.5], ['statues', 0.6], ['massage', 0.6], ['mosaic', 0.8], ['spring', 0.4]],
    fit: (e) => 0.5 + (e.fam === 'classic' ? 3 : 0) + (e.fam === 'sun' ? 1.2 : 0) + (e.fam === 'ember' ? 2 : 0) + (e.fam === 'north' ? 0.8 : 0) + (e.fam === 'jade' ? 1 : 0) + (e.mountain ? 0.6 : 0),
  },
  theatre: {
    name: 'Theatre', blurb: 'plays and music under the stars, and a stage for anyone with a tune',
    forms: {
      town: { key: 'playhouse', title: 'Playhouse', sizes: [[17, 13], [15, 11]] },
      city: { key: 'grand_theatre', title: 'Grand Theatre', sizes: [[23, 17], [21, 15], [17, 13]] },
    },
    cap: 4, spacing: 10,
    features: [['curtain', 0.8], ['boxes', 0.5], ['props', 0.7], ['statues', 0.4], ['orchestra', 0.5], ['lanterns', 0.7]],
    fit: (e) => 0.8 + (e.vals.scholarly ? 0.8 : 0) + (e.vals.mercantile ? 0.6 : 0) + (e.fam === 'classic' ? 2 : 0) + (e.fam === 'jade' ? 1.6 : 0) + (e.cond === 'prosperous' ? 0.8 : 0),
  },
  racecourse: {
    name: 'Racecourse', blurb: 'horse races, the betting stand, and the finest horses for sale',
    forms: {
      village: { key: 'horse_fair', title: 'Horse Fair', sizes: [[19, 13], [17, 11]] },
      town: { key: 'racecourse', title: 'Racecourse', sizes: [[31, 15], [29, 13], [25, 13]] },
      city: { key: 'hippodrome', title: 'Hippodrome', sizes: [[37, 17], [33, 15], [29, 13]] },
    },
    cap: 4, spacing: 11,
    features: [['spina', 0.8], ['stands', 1], ['stables', 0.8], ['statues', 0.5], ['bookie', 0.9], ['market', 0.5]],
    fit: (e) => 0.4 + (e.open ? 2.2 : 0) + (e.vals.martial ? 0.6 : 0) + (e.fam === 'classic' ? 1.6 : 0) + (e.fam === 'sun' ? 0.8 : 0),
  },
  fair: {
    name: 'Fairground', blurb: 'the great fair: traders from every realm, games, and a strongman to beat',
    forms: {
      village: { key: 'fairground', title: 'Fairground', sizes: [[19, 13], [17, 11], [15, 11]] },
      town: { key: 'fairground', title: 'Fairground', sizes: [[21, 15], [19, 13], [17, 11]] },
    },
    cap: 5, spacing: 8,
    features: [['strongman', 0.8], ['fortune', 0.7], ['carousel', 0.4], ['stage', 0.5], ['pens', 0.5], ['games', 0.8]],
    fit: (e) => 0.6 + e.hub * 0.9 + e.border * 0.8 + (e.vals.agrarian ? 0.6 : 0) + (e.vals.mercantile ? 0.6 : 0),
  },
  ruins: {
    name: 'Old Ruins', blurb: 'the bones of something far older than the town, and what can still be dug out of them',
    forms: {
      village: { key: 'ruins', title: 'Old Ruins', sizes: [[15, 13], [13, 11]] },
      town: { key: 'ruins', title: 'Old Ruins', sizes: [[19, 15], [17, 13]] },
      city: { key: 'ruins', title: 'Old Ruins', sizes: [[23, 17], [19, 15]] },
    },
    cap: 4, spacing: 10,
    features: [['colossus', 0.5], ['gate', 0.6], ['columns', 0.9], ['dig', 1], ['vault', 0.4], ['glyphs', 0.6], ['overgrown', 0.6]],
    fit: (e) => 0.3 + e.ancient * 3 + e.dungeons * 0.5 + (e.vals.scholarly ? 0.6 : 0),
  },
  winery: {
    name: 'Winery', blurb: 'the drink the place is famous for, and the cellars it ages in',
    forms: {
      village: { key: 'winery', title: 'Winery', sizes: [[17, 13], [15, 11]] },
      town: { key: 'winery', title: 'Winery', sizes: [[19, 13], [17, 11]] },
    },
    cap: 5, spacing: 8,
    features: [['rows', 1], ['press', 0.9], ['cellar', 0.8], ['tasting', 0.8], ['vats', 0.7], ['carts', 0.5]],
    fit: (e) => 0.7 + (e.vals.agrarian ? 1.8 : 0) + (e.fertile ? 1.2 : 0) + (e.fam === 'vale' ? 0.8 : 0) + (e.fam === 'classic' ? 1 : 0),
  },
  shipyard: {
    name: 'Shipyard', blurb: 'ships built on the slip, and the great light that guides them home',
    forms: {
      town: { key: 'shipyard', title: 'Shipyard', sizes: [[21, 13], [19, 11], [17, 11]] },
      city: { key: 'great_shipyard', title: 'Great Shipyard', sizes: [[25, 15], [23, 13], [19, 13]] },
    },
    cap: 4, spacing: 12, coastal: true,
    features: [['lighthouse', 0.8], ['crane', 0.8], ['ropewalk', 0.5], ['drydock', 0.5], ['fishmarket', 0.5]],
    fit: (e) => (e.coast ? 1 + (e.vals.seafaring ? 3 : 0) + (e.fam === 'tide' ? 1.5 : 0) : 0),
  },
  gardens: {
    name: 'Gardens', blurb: 'gardens of rare plants from every land, and the beasts kept there',
    forms: {
      town: { key: 'gardens', title: 'Gardens', sizes: [[19, 15], [17, 13]] },
      city: { key: 'royal_gardens', title: 'Royal Gardens', sizes: [[25, 19], [23, 17], [19, 15]] },
    },
    cap: 3, spacing: 12,
    features: [['menagerie', 0.7], ['glasshouse', 0.6], ['maze', 0.4], ['pond', 0.7], ['aviary', 0.5], ['topiary', 0.6]],
    fit: (e) => 0.4 + (e.cond === 'prosperous' ? 1 : 0) + (e.fam === 'jade' ? 2 : 0) + (e.fam === 'classic' ? 1.2 : 0) + (e.fertile ? 0.6 : 0) + (e.empire ? 1.5 : 0),
  },
  monastery: {
    name: 'Monastery', blurb: 'an order of monks: their teaching, their tea, and the training of body and mind',
    forms: {
      village: { key: 'monastery', title: 'Monastery', sizes: [[17, 15], [15, 13], [13, 11]] },
      town: { key: 'monastery', title: 'Monastery', sizes: [[19, 15], [17, 13]] },
    },
    cap: 4, spacing: 11,
    features: [['bells', 0.7], ['training', 0.9], ['tea', 0.7], ['garden', 0.8], ['library', 0.5], ['pagoda', 0.5]],
    fit: (e) => 0.4 + (e.mountain ? 1.8 : 0) + (e.vals.pious ? 1.4 : 0) + (e.fam === 'jade' ? 2.5 : 0) + (e.fam === 'high' ? 0.6 : 0),
  },
  apiary: {
    name: 'Apiary', blurb: 'honey, mead and beeswax, and the keepers of the hives',
    forms: {
      village: { key: 'apiary', title: 'Apiary', sizes: [[15, 11], [13, 11]] },
    },
    cap: 4, spacing: 8,
    features: [['meadery', 0.7], ['flowers', 1], ['candles', 0.6], ['skeps', 0.8]],
    fit: (e) => 0.5 + (e.fertile ? 1.6 : 0) + (e.vals.agrarian ? 1 : 0) + (e.fam === 'north' ? 0.8 : 0),
  },
  circle: {
    name: 'Stone Circle', blurb: 'the old stones, the seers who read them, and what the stars say',
    forms: {
      village: { key: 'circle', title: 'Stone Circle', sizes: [[15, 13], [13, 11]] },
    },
    cap: 4, spacing: 10,
    features: [['altar', 0.8], ['grove', 0.6], ['runes', 0.7], ['bonfire', 0.7], ['menhir', 0.5]],
    fit: (e) => 0.4 + (e.fam === 'north' ? 1.4 : 0) + (e.fam === 'wild' ? 1.2 : 0) + (e.fam === 'mist' ? 1.4 : 0) + (e.vals.pious ? 0.6 : 0) + e.ancient * 0.6,
  },
  quarry: {
    name: 'Quarry', blurb: 'stone cut from the hill, the masons who dress it, and statues for any square',
    forms: {
      village: { key: 'quarry', title: 'Quarry', sizes: [[17, 13], [15, 11]] },
      town: { key: 'quarry', title: 'Quarry', sizes: [[19, 13], [17, 11]] },
    },
    cap: 4, spacing: 9,
    features: [['crane', 0.8], ['masons', 0.9], ['statues', 0.6], ['carts', 0.6]],
    fit: (e) => 0.3 + (e.mountain ? 2.2 : 0) + (e.fam === 'high' ? 1 : 0) + (e.fam === 'classic' ? 0.6 : 0),
  },
};
export const KIND_IDS = Object.keys(SPECIALTIES);
// (New kinds in a later version go on the end, and are given out only to
// places that have nothing yet, so a world's places keep what they were
// known for when it was first made.)

// How many each size of place has: a city two (an empire's three), a
// town one (now and then two), a village now and then one.
const COUNT = { village: [[0, 0.62], [1, 0.38]], town: [[1, 0.78], [2, 0.22]], city: [[2, 0.8], [3, 0.2]] };

// What there is about a place, for choosing what it's known for.
function envOf(ow, s, sites) {
  const vals = {};
  for (const v of (s.civ && s.civ.values) || []) vals[v] = true;
  let mount = 0;
  let open = 0;
  let fertile = 0;
  let n = 0;
  for (let dz = -2; dz <= s.cd + 1; dz++) {
    for (let dx = -2; dx <= s.cw + 1; dx++) {
      const c = ow.cell(s.cx + dx, s.cz + dz);
      if (!c) continue;
      n++;
      if ((c.mountainness || 0) > 0.3) mount++;
      if (['plains', 'savanna', 'grassland', 'steppe', 'meadow'].includes(c.biome)) open++;
      if (['plains', 'forest', 'meadow', 'grassland', 'jungle'].includes(c.biome)) fertile++;
    }
  }
  const cx = s.cx + s.cw / 2;
  const cz = s.cz + s.cd / 2;
  const near = (q, d) => Math.hypot(q.cx - cx, (q.cz - cz) * 1.4) <= d;
  let dungeons = 0;
  let ancient = 0;
  for (const q of sites || []) {
    if (!near(q, 9)) continue;
    if (q.type === 'kavorent' || q.type === 'ancient' || /ancient/.test(q.type || '')) ancient = Math.min(2, ancient + 1);
    else dungeons = Math.min(3, dungeons + 1);
  }
  let hub = 0;
  let border = 0;
  for (const o of ow.settlements) {
    if (o === s || o.haven) continue;
    if (Math.hypot(o.cx - s.cx, o.cz - s.cz) > 9) continue;
    hub++;
    if (o.civ && s.civ && o.civ !== s.civ) border = 1;
  }
  return {
    vals, fam: familyOf(s.style), empire: !!s.empire, coast: !!s.coast, river: !!s.river, lake: !!s.lake, cond: s.condition,
    mountain: mount >= 2 || (n && mount / n > 0.12), open: n && open / n > 0.35, fertile: n && fertile / n > 0.4,
    dungeons, ancient, hub: Math.min(3, Math.max(0, hub - 2)) / 3 * 2, border,
  };
}

// The size a place is reckoned at for its forms.
const sizeOf = (s) => (s.type === 'city' ? 'city' : s.type === 'town' ? 'town' : 'village');

// Give every place in the world what it's known for (see the top). Called
// once the settlements and the old places are made; the same every time.
export function assignSpecialties(ow) {
  const rng = new RNG(hash4(ow.seed, 0x5bec));
  const setts = ow.settlements.filter((s) => s && !s.haven && s.condition !== 'abandoned' && !s.founding);
  // (The grandest first: they have the best claim to the rare things.)
  const rank = (s) => (s.empire ? 0 : s.type === 'city' ? 1 : s.type === 'town' ? 2 : 3);
  const order = setts.map((s) => ({ s, r: rank(s), k: rng.next() })).sort((a, b) => a.r - b.r || a.k - b.k).map((q) => q.s);
  const used = new Map();
  const where = new Map();
  for (const s of order) {
    const size = sizeOf(s);
    const srng = new RNG(hash4(ow.seed, s.id, 0x5bed));
    let want = srng.weighted(COUNT[size]);
    if (s.empire) want = 3;
    s.spec = [];
    if (!want) continue;
    const e = envOf(ow, s, ow.sites);
    for (let i = 0; i < want; i++) {
      const cands = [];
      for (const k of KIND_IDS) {
        const K = SPECIALTIES[k];
        if (!K.forms[size] || s.spec.some((q) => q.k === k)) continue;
        if (K.coastal && !e.coast) continue;
        let w = K.fit(e);
        if (!(w > 0)) continue;
        // Rare: each one already given makes another far less likely, and
        // never past its cap, nor near another of its kind.
        const n = used.get(k) || 0;
        if (n >= K.cap) continue;
        w *= 0.32 ** n;
        const close = (where.get(k) || []).some((o) => Math.hypot(o.cx - s.cx, o.cz - s.cz) < K.spacing);
        if (close) continue;
        cands.push([k, w]);
      }
      if (!cands.length) break;
      const k = srng.weighted(cands);
      const q = makeSpec(ow, s, k, size, srng);
      s.spec.push(q);
      used.set(k, (used.get(k) || 0) + 1);
      if (!where.has(k)) where.set(k, []);
      where.get(k).push(s);
    }
  }
  // The rest have none.
  for (const s of ow.settlements) if (s && !s.spec) s.spec = [];
  // (A delve's old place is one of the world's own, made with it, after
  // all the rest (so their numbers never change): where it is is worked
  // out when its town's laid out, at the foot of its way down. See
  // sim/cities.js.)
  for (const s of ow.settlements) {
    const q = (s.spec || []).find((o) => o.k === 'delve');
    if (!q || !ow.sites) continue;
    const r = new RNG(hash4(ow.seed, s.id, 0xde17));
    const own = FAR_OWN_TYPE[s.island] || OWN_TYPE[s.island];
    const e = envOf(ow, s, []);
    const type = own && r.chance(0.5) ? own : e.mountain || e.fam === 'high' ? 'mine' : e.vals.pious ? 'crypt' : r.pick(['barrow', 'crypt', 'mine', 'holdout']);
    ow.sites.push({ id: ow.sites.length, type, cx: s.cx, cz: s.cz, island: s.island, seed: hash4(ow.seed, s.id, 0xde18), delve: s.id, delveName: q.name });
  }
  // (A world made from 1.46 on: a town or a city with something to be
  // known for spreads to the edges of its squares on the map, for the
  // room it takes. See Layout.roads.)
  if ((ow.wg || 1) >= 10) {
    for (const s of setts) {
      if (!s.spec.length) continue;
      const b = s.bounds;
      const mx = s.type === 'city' || s.type === 'village' ? 2 : 0;
      b.z0 = Math.min(b.z0, s.cz * REGION_D + 2);
      b.z1 = Math.max(b.z1, (s.cz + s.cd) * REGION_D - 3);
      if (mx) {
        b.x0 = Math.min(b.x0, s.cx * REGION_W + mx);
        b.x1 = Math.max(b.x1, (s.cx + s.cw) * REGION_W - mx - 1);
      }
    }
  }
}

// One place's one specialty: its form, its own seed, its features, its
// name and its story.
export function makeSpec(ow, s, k, size, rng) {
  const K = SPECIALTIES[k];
  const F = K.forms[size] || K.forms.town || K.forms.city || K.forms.village;
  const v = hash4(ow.seed, s.id, k.length * 131 + k.charCodeAt(0), 0x5bee);
  const r = new RNG(v);
  const f = [];
  for (const [feat, p] of K.features) if (r.chance(p)) f.push(feat);
  // (A grand one has more of what such places have.)
  if (size === 'city') for (const [feat, p] of K.features) if (!f.includes(feat) && r.chance(p * 0.5)) f.push(feat);
  const name = specName(s, k, F, r);
  const year = 40 + r.int(0, 260);
  return { k, form: F.key, size, v, f, name, year };
}

// ------------------------------------------------------------ names
// A name in a people's own way: a few patterns each, filled from words of
// their own, and plain "<Town> <Title>" now and then.
const WORDS = {
  arena: {
    classic: { adj: ['Flavian', 'Imperial', 'Golden', 'Great', 'Eternal', 'Triumphal'], noun: ['Colosseum', 'Circus', 'Arena', 'Amphitheatre'] },
    north: { adj: ['Iron', 'Blood', 'Raven', 'Shield', 'Wolf\'s'], noun: ['Ring', 'Holmgang', 'Proving Ring', 'Shield Ring'] },
    sun: { adj: ['Red', 'Sunlit', 'Scorpion', 'Lion\'s', 'Golden'], noun: ['Sands', 'Pit', 'Arena', 'Bloodsand'] },
    high: { adj: ['Deep', 'Anvil', 'Stone', 'Thane\'s'], noun: ['Proving Hall', 'Ring', 'Pit', 'Trial Ground'] },
    jade: { adj: ['Jade', 'Crane', 'Tiger', 'Lotus', 'Thunder'], noun: ['Courtyard', 'Arena', 'Ring', 'Pavilion of Blades'] },
    any: { adj: ['Old', 'Red', 'Iron', 'Bull\'s', 'Black', 'Lion\'s', 'Grand'], noun: ['Arena', 'Pit', 'Ring', 'Sands', 'Games'] },
  },
  library: {
    classic: { adj: ['Imperial', 'Great', 'Aurelian', 'Marble'], noun: ['Library', 'Athenaeum', 'Museion', 'Archive'] },
    jade: { adj: ['Hall of', 'Pavilion of', 'House of'], noun: ['a Thousand Scrolls', 'Quiet Ink', 'the Willow Brush', 'Ten Thousand Leaves'], pre: true },
    north: { adj: ['Saga', 'Rune', 'Skald\'s', 'Long'], noun: ['Hall', 'House', 'Lore-Hall'] },
    high: { adj: ['Deep', 'Iron-bound', 'Ancestors\''], noun: ['Archive', 'Vault of Books', 'Lorehold'] },
    sun: { adj: ['House of', 'Garden of', 'Hall of'], noun: ['Wisdom', 'Stars', 'Many Pages', 'the Reed Pen'], pre: true },
    any: { adj: ['Great', 'Old', 'Lantern', 'Owl', 'Quiet', 'Grey'], noun: ['Library', 'Archive', 'Book-House', 'Scriptorium'] },
  },
  delve: {
    any: { adj: ['Black', 'Deep', 'Old', 'Hollow', 'Cold', 'Long', 'Lantern'], noun: ['Delve', 'Way Down', 'Pit', 'Descent', 'Shaft', 'Undergate'] },
    high: { adj: ['Deep', 'Grey', 'Iron', 'Elder'], noun: ['Delve', 'Deepgate', 'Undermine', 'Long Stair'] },
  },
  holy: {
    any: { adj: ['Holy', 'Blessed', 'Sacred', 'Shining', 'Quiet'], noun: ['Seat', 'Sanctuary', 'Shrine', 'Abbey', 'Minster', 'Cathedral'] },
    jade: { adj: ['Temple of', 'Pagoda of', 'Shrine of'], noun: ['the Golden Lotus', 'the Nine Bells', 'Eternal Spring', 'the Jade Mountain'], pre: true },
    sun: { adj: ['Temple of', 'House of', 'Ziggurat of'], noun: ['the Sun', 'the Morning Star', 'the Burning Eye', 'the Dawn'], pre: true },
    north: { adj: ['Old', 'High', 'Hallowed', 'Stave'], noun: ['Hof', 'Temple', 'Stave Church', 'Holy Hall'] },
  },
  bazaar: {
    any: { adj: ['Grand', 'Great', 'Covered', 'Thousand-Stall', 'Golden', 'Crossroads'], noun: ['Bazaar', 'Market', 'Exchange', 'Souk', 'Market Hall'] },
    sun: { adj: ['Grand', 'Spice', 'Golden', 'Copper'], noun: ['Souk', 'Bazaar', 'Caravanserai'] },
    jade: { adj: ['Lantern', 'Silk', 'Jade', 'Thousand-Lantern'], noun: ['Market', 'Arcade', 'Exchange'] },
  },
  forge: {
    any: { adj: ['Great', 'Black', 'Hammer', 'Iron', 'Red', 'Smoke'], noun: ['Forge', 'Foundry', 'Works', 'Smithies', 'Anvil'] },
    high: { adj: ['Hammer', 'Deep', 'Thane\'s', 'Mountain'], noun: ['Forge', 'Forgehall', 'Anvilhold', 'Foundry'] },
    ember: { adj: ['Cinder', 'Ash', 'Magma', 'Ember'], noun: ['Forge', 'Foundry', 'Kilns', 'Smelter'] },
  },
  citadel: {
    any: { adj: ['High', 'Old', 'King\'s', 'Grey', 'Iron', 'Watch'], noun: ['Citadel', 'Fort', 'Keep', 'Bastion', 'Hold'] },
    classic: { adj: ['Imperial', 'Legion', 'Castra'], noun: ['Fortress', 'Castrum', 'Citadel'] },
  },
  baths: {
    any: { adj: ['Old', 'Warm', 'Steaming', 'Healing', 'Sweet-water'], noun: ['Baths', 'Springs', 'Bathhouse', 'Waters'] },
    classic: { adj: ['Imperial', 'Great', 'Marble'], noun: ['Thermae', 'Baths', 'Balneae'] },
    north: { adj: ['Smoke', 'Birch', 'Hot-stone'], noun: ['Sauna', 'Bath-hall', 'Steam-house'] },
    jade: { adj: ['Moon', 'Cloud', 'Plum Blossom'], noun: ['Springs', 'Bathhouse', 'Waters'] },
  },
  theatre: {
    any: { adj: ['Royal', 'Swan', 'Globe', 'Old', 'Lantern', 'Masked'], noun: ['Theatre', 'Playhouse', 'Stage', 'Odeon'] },
    jade: { adj: ['Opera of', 'Pavilion of', 'House of'], noun: ['the Painted Mask', 'Falling Petals', 'the Moon Gate'], pre: true },
    north: { adj: ['Skald\'s', 'Mead', 'Saga'], noun: ['Hall', 'Stage', 'Song-Hall'] },
  },
  racecourse: {
    any: { adj: ['Old', 'Great', 'Thunder', 'Royal', 'Wind', 'Long'], noun: ['Racecourse', 'Track', 'Gallops', 'Course'] },
    classic: { adj: ['Great', 'Imperial', 'Circus'], noun: ['Hippodrome', 'Circus', 'Stadium'] },
  },
  fair: { any: { adj: ['Great', 'Midsummer', 'Harvest', 'Crossroads', 'Merry', 'Goose'], noun: ['Fair', 'Fairground', 'Fair-field', 'Market Fair'] } },
  ruins: { any: { adj: ['Fallen', 'Old', 'Broken', 'Sleeping', 'Drowned', 'Giant\'s'], noun: ['Ruins', 'Stones', 'Colonnade', 'Halls', 'Bones'] } },
  winery: {
    any: { adj: ['Old', 'Sun', 'Red', 'Golden', 'Hill', 'Abbey'], noun: ['Winery', 'Vineyard', 'Cellars', 'Press'] },
    north: { adj: ['Mead', 'Honey', 'Old', 'Barrow'], noun: ['Meadery', 'Brewhouse', 'Mead-hall'] },
    high: { adj: ['Stone', 'Deep', 'Dark'], noun: ['Brewery', 'Alehouse Cellars', 'Brewhold'] },
    jade: { adj: ['Rice', 'Plum', 'Cloud'], noun: ['Wine House', 'Distillery', 'Brewery'] },
    wild: { adj: ['Palm', 'Honey', 'Sweet'], noun: ['Winery', 'Brew-yard', 'Toddy Grove'] },
  },
  shipyard: { any: { adj: ['Old', 'Great', 'King\'s', 'Salt', 'Gull', 'Tide'], noun: ['Shipyard', 'Yards', 'Slipway', 'Docks'] } },
  gardens: { any: { adj: ['Royal', 'Hanging', 'Moon', 'Summer', 'Emerald', 'Pleasure'], noun: ['Gardens', 'Garden', 'Paradise', 'Arboretum'] } },
  monastery: {
    any: { adj: ['Still', 'Cloud', 'High', 'Quiet', 'Mountain', 'Iron'], noun: ['Monastery', 'Abbey', 'Retreat', 'Hermitage'] },
    jade: { adj: ['Monastery of', 'Temple of', 'Hall of'], noun: ['the Still Water', 'the White Crane', 'Falling Leaves', 'the Iron Fist'], pre: true },
  },
  apiary: { any: { adj: ['Golden', 'Honey', 'Old', 'Clover', 'Hum'], noun: ['Apiary', 'Hives', 'Bee-garth', 'Honey-yard'] } },
  circle: { any: { adj: ['Old', 'Whispering', 'Grey', 'Star', 'Nine', 'Dancing'], noun: ['Stones', 'Circle', 'Ring', 'Henge'] } },
  quarry: { any: { adj: ['Old', 'White', 'Grey', 'King\'s', 'Deep'], noun: ['Quarry', 'Stone-pit', 'Delf', 'Cuttings'] } },
};

export function specName(s, k, F, rng) {
  const W = WORDS[k] || {};
  const fam = familyOf(s.style);
  const set = W[fam] || W.any || { adj: ['Great'], noun: [F.title] };
  const r = rng.next();
  if (r < 0.22) return `${s.name} ${F.title}`;
  const adj = rng.pick(set.adj);
  const noun = rng.pick(set.noun);
  if (set.pre) return `The ${adj} ${noun}`.replace(/^The (Temple|Hall|House|Pavilion|Shrine|Pagoda|Ziggurat|Garden|Monastery|Opera) of/, '$1 of');
  if (r < 0.5) return `The ${adj} ${noun}`;
  if (r < 0.7) return `The ${noun} of ${s.name}`;
  return `The ${adj} ${noun}`;
}

// What it says of a place, for the map and the town's history: "famous
// for its colosseum (gladiator games...)".
export function famousFor(s) {
  const list = (s.spec || []).map((q) => SPECIALTIES[q.k] && q);
  return list.filter(Boolean);
}

export function formOf(q) {
  const K = SPECIALTIES[q.k];
  if (!K) return null;
  return K.forms[q.size] || Object.values(K.forms).find((F) => F.key === q.form) || null;
}
