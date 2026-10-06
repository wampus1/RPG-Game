// "The islands and the world": what people know of the land about them.
// Which island this is and what the others are like (each people sees
// them its own way), which way and how far a place is, the storm round
// them all and what the old charts say lies beyond it, the mountain on
// Kharos, and where the coast or the nearest lake is. Children know a
// little, and say so.
import { REGION_W, REGION_D } from '../config.js';
import { DAGONI } from '../world/geography.js';
import { hash4, RNG } from '../util/rng.js';
import { revealTown } from './dialogue.js';
import { FAR_PEOPLES, FAR_LANDS, isFar, cutOff } from '../world/farlands.js';

const COMPASS = ['east', 'south-east', 'south', 'south-west', 'west', 'north-west', 'north', 'north-east'];

export function compass(fromX, fromZ, x, z) {
  const ang = Math.atan2(z - fromZ, x - fromX);
  return COMPASS[((Math.round(ang / (Math.PI / 4)) % 8) + 8) % 8];
}

// How far, the way someone would put it.
export function howFar(d) {
  if (d < 60) return 'just over there';
  if (d < 220) return 'not far, an hour\'s walk or so';
  if (d < 600) return 'a few hours\' walk';
  if (d < 1300) return 'a long day\'s walk';
  return 'days away';
}

// Which people, for the way they see things.
function folkOf(s) {
  const st = s && s.style;
  return st === 'ember' || st === 'mist' || st === 'tide' ? st : 'thessa';
}

const ISLE_LINE = (L) => `${L.name} (${L.about})`;

// What each people says of each island.
const VIEWS = {
  thessa: {
    thessa: ['The green island, and the biggest of the three. Snow in the north, sand in the south, and horses everywhere between.', 'Three realms on it and never at peace for long.'],
    kharos: ['The fire island. There\'s a mountain at its heart that wakes every couple of months and turns the sky black for days.', 'The Ashborn live there: hard folk who bake their bread in hot ash. They\'d sooner trade with you than smile at you.'],
    myrrow: ['The misty island. Mangroves, moors and mushrooms as tall as houses, some of them glowing at night.', 'Two peoples there: the Mirefolk in the fog, and the Stiltfolk out on the water. Odd, both of them, but honest.'],
  },
  ember: {
    thessa: ['The soft island. Grass and cows and rain. They ride horses there because they have never had to run from fire.', 'Their kings fight each other over fields. We have one mountain, and that is enough to fear.'],
    kharos: ['This is Kharos. The Sleeper made it, and the Sleeper keeps it: every one of us lives under the mountain.', 'Ash, black glass, cinder woods and the hot springs. Nothing here is soft, and nothing here forgets.'],
    myrrow: ['The wet island. Fog in the morning and fog at night, and mushrooms where there should be trees.', 'The Mirefolk trade us spore-medicines for sulphur. The Stiltfolk sell crab and talk too much.'],
  },
  mist: {
    thessa: ['The bright island, westward. Too much sun, too many roads, and kings who shout.', 'They do make good iron, I\'ll give them that.'],
    kharos: ['The burning island. On a still night you can see the red of the mountain through the fog, all the way from here.', 'The Ashborn are proud and hard, and their medicine is fire. Ours is the dark.'],
    myrrow: ['This is Myrrow. The fog keeps us, the moss feeds us, and the glowcaps light the way home.', 'The Stiltfolk have the coast and the mangroves; we have the moors and the deep woods. We keep our own counsel.'],
  },
  tide: {
    thessa: ['The big island to the west. Good timber, good markets, and fishermen who can\'t tell a crab from a stone.', 'A raft can make it in a day or two, if the weather holds inside the Wall.'],
    kharos: ['North of us, the fire island. Their black snapper fetches a good price, and their sulphur a better one.', 'When the mountain goes up, the sea between goes grey with ash for a week. Bad fishing.'],
    myrrow: ['This is Myrrow. We Stiltfolk have the shallows and the mangroves, and build our houses up on legs out of the tide\'s way.', 'The Mirefolk have the moors inland. They bring us mushrooms; we bring them fish. It works.'],
  },
};

// The storm round them all, as each people tells it.
const WALL = {
  thessa: ['The Wall? It\'s been there longer than anyone\'s grandmother can remember. Nothing comes through it, and nothing goes out.', 'Some say the Kavorent raised it when they went away, to keep the world out. Or to keep us in.'],
  ember: ['The kiln-priests say the Wall is the Sleeper\'s breath: the mountain\'s smoke, gone round the world and come back angry.', 'Only a true ship could live in it. We have none. Nobody does.'],
  mist: ['The Wall is our own fog, grown old and bitter. The spirits in it don\'t like being looked at too long.', 'Don\'t whistle at it, and never try to sail it on a raft. It tears them to splinters.'],
  tide: ['We take the nets out as far as the grey water, and no further. Past that, the Wall.', 'Every year somebody tries it on a raft. Every year the raft comes back without them.'],
};

const BEYOND = {
  thessa: ['Beyond the Wall? The old charts in the town hall show two great lands: Velmarch to the north, and Ostria away east, and little isles scattered between.', 'Nobody living has seen them. They might be gone, for all we know.'],
  ember: ['There is a map in the kiln-temple, cut into black glass. It shows lands beyond the Wall: a long one north, a wide one east.', 'The priests say our people came from the east, long ago, before the mountain woke.'],
  mist: ['The fog-tellers say there are great lands out past the Wall, with forests of trees, not mushrooms. Velmarch, Ostria.', 'I\'ve never wanted to see them. I\'d miss the fog.'],
  tide: ['Grandfather had a song about it: two great lands beyond the grey water, and isles like stepping-stones.', 'Velmarch, and Ostria. And the Grey Skerries, and the Wyrd Isle where nothing is ever the same twice.'],
};

// What children say.
const KID = {
  here: (isle) => [`This is ${isle}! Everybody knows that.`],
  wall: ['The Wall is a storm that goes all the way round. Mum says if I go near it the wind will take me.'],
  beyond: ['There\'s nothing past the Wall. Or monsters. Probably monsters.'],
};

// A place named and pointed to goes on your map, marked as told of.
function tell(game, lines, x, z, label, glyph) {
  if (game.world.ow.pin(x, z, label, glyph)) {
    game.ui.msg(`Map updated: ${label}`, '#a0c8ff');
    lines.push('(Marked on your map.)');
  }
}

// (Round 68) Beyond the storm: what the far lands' folk know of their own
// land, of the others, of the storm far off in the south-west, and of the
// islands inside it.
function farMenu(npc, game) {
  const ow = game.world.ow;
  const out = [
    { id: 'geo', arg: 'here', label: 'What land is this?' },
    { id: 'geo', arg: 'lands', label: 'The other lands' },
    { id: 'geo', arg: 'wall', label: 'The storm in the south-west' },
    { id: 'geo', arg: 'dagoni', label: 'What lies inside the storm?' },
    { id: 'geo', arg: 'coast', label: 'Which way to the sea?' },
    { id: 'geo', arg: 'towns', label: 'Where is a town...' },
  ];
  if (!ow.wallDown) return out;
  return out.map((q) => (q.arg === 'dagoni' ? { ...q, label: 'The islands that were inside the storm' } : q));
}

function farTalk(npc, game, arg) {
  const ow = game.world.ow;
  const s = npc.settlement;
  const P = FAR_PEOPLES[s.style] || FAR_PEOPLES[FAR_LANDS[s.island].peoples[0]];
  const kid = npc.rec.age === 'child';
  const here = s.island;
  const hereL = ow.island(here);
  const more = { lines: [], choices: farMenu(npc, game), back: 'Thanks.' };
  if (!arg) return { lines: [kid ? 'I know where EVERYTHING is. Ask me!' : 'What would you like to know?'], choices: farMenu(npc, game), back: 'Never mind.' };
  if (arg === 'here') {
    if (kid) return { ...more, lines: [`This is ${hereL.name}! It's the biggest place in the world. Probably.`] };
    const lines = [`This is ${hereL.name}, ${hereL.about}.`, ...P.views.home];
    const realms = ow.civs.filter((c) => c.island === here && game.sim.realms.members(c).length);
    if (realms.length) lines.push(`${realms.length === 1 ? 'One realm holds it' : `${realms.length} realms share it`}: ${realms.map((c) => `the ${c.name.replace(/^The /, '')}${c.empire ? ' (an empire)' : ''}`).join(', ')}.`);
    return { ...more, lines };
  }
  if (arg === 'lands') {
    if (kid) return { ...more, lines: ['There are lots of lands. Some are big and some are little. Some have whales.'] };
    const lines = ['Beyond our shores, the old charts show these:'];
    for (const L of ow.lands) {
      if (L.key === here || !FAR_LANDS[L.key]) continue;
      const peoples = FAR_LANDS[L.key].peoples.map((k) => `the ${FAR_PEOPLES[k].label}`).join(' and ');
      lines.push(`${L.name}, ${compass(npc.x, npc.z, L.x, L.z)} of here: ${L.about}, where ${peoples} live${FAR_LANDS[L.key].peoples.length > 1 ? '' : 's'}.`);
    }
    return { ...more, lines };
  }
  if (arg === 'wall') {
    if (ow.wallDown) return { ...more, lines: ['The storm is gone. It went out like a candle, they say, all at once. Nobody alive has seen that sea calm before.'] };
    return { ...more, lines: kid ? ['The storm eats ships. Everybody knows that.'] : P.views.wall };
  }
  if (arg === 'dagoni') {
    if (ow.wallDown) return { ...more, lines: ['Three islands, it turns out, and people on them, who have never seen anything but the inside of that storm. The ships are already going to them.'] };
    return { ...more, lines: kid ? ['Nobody lives inside the storm. Nobody could.'] : P.views.dagoni };
  }
  if (arg === 'coast') {
    let best = null;
    for (let dz = -6; dz <= 6; dz++) for (let dx = -6; dx <= 6; dx++) {
      const c = ow.cell(Math.floor(npc.x / REGION_W) + dx, Math.floor(npc.z / REGION_D) + dz);
      if (!c || c.biome !== 'beach') continue;
      const x = (c.cx + 0.5) * REGION_W;
      const z = (c.cz + 0.5) * REGION_D;
      const d = Math.hypot(x - npc.x, z - npc.z);
      if (!best || d < best.d) best = { x, z, d };
    }
    if (!best) return { ...more, lines: ['The sea? Days off, from here. This is the heart of the land.'] };
    const lines = [`The nearest shore is ${compass(npc.x, npc.z, best.x, best.z)}: ${howFar(best.d)}.`];
    tell(game, lines, best.x, best.z, 'The shore', '≈');
    return { ...more, lines };
  }
  if (arg === 'towns' || arg.startsWith('town:')) {
    const others = ow.settlements.filter((q) => q !== s && q.condition !== 'abandoned' && !q.deserted && !cutOff(ow, s, q));
    const dist = (q) => Math.hypot((q.bounds.x0 + q.bounds.x1) / 2 - npc.x, (q.bounds.z0 + q.bounds.z1) / 2 - npc.z);
    if (arg === 'towns') {
      const near = others.filter((q) => q.island === here).sort((a, b) => dist(a) - dist(b)).slice(0, 8);
      const far = others.filter((q) => q.island !== here && (q.type === 'city')).sort((a, b) => dist(a) - dist(b)).slice(0, 4);
      return { lines: ['Which one?'], choices: [...near, ...far].map((q) => ({ id: 'geo', arg: `town:${q.id}`, label: `${q.name}${q.empire ? ' (the imperial capital)' : ''}${q.island !== here ? ` (${ow.island(q.island).name})` : ''}` })), back: 'Never mind.' };
    }
    const q = ow.settlements[Number(arg.slice(5))];
    if (!q) return more;
    const qx = (q.bounds.x0 + q.bounds.x1) / 2;
    const qz = (q.bounds.z0 + q.bounds.z1) / 2;
    const lines = [`${q.name}? ${q.empire ? `The capital of the ${q.civ.name.replace(/^The /, '')}, and the greatest city there is` : `A ${q.type}${q.civ ? ` of the ${q.civ.name.replace(/^The /, '')}` : ''}`}, ${q.island === here ? 'here on' : 'over on'} ${ow.island(q.island).name}.`];
    lines.push(`It's ${compass(npc.x, npc.z, qx, qz)} of here: ${q.island === here ? howFar(dist(q)) : 'across the sea. You\'ll want a ship.'}`);
    if (revealTown(game, q)) lines.push('(Marked on your map.)');
    return { ...more, lines };
  }
  return more;
}

// The menu of things to ask.
export function geoMenu(npc, game) {
  if (isFar(npc.settlement)) return farMenu(npc, game);
  const ow = game.world.ow;
  const here = ow.islandAt(npc.x, npc.z);
  const out = [
    { id: 'geo', arg: 'here', label: 'Which island is this?' },
    { id: 'geo', arg: 'islands', label: 'The Dagoni Islands' },
  ];
  for (const L of DAGONI) if (L.key !== here) out.push({ id: 'geo', arg: `isle:${L.key}`, label: `How do I get to ${L.name}?` });
  out.push({ id: 'geo', arg: 'wall', label: 'The storm round the islands' });
  out.push({ id: 'geo', arg: 'beyond', label: 'What lies beyond the storm?' });
  if (ow.volcano) out.push({ id: 'geo', arg: 'mountain', label: 'The mountain on Kharos' });
  out.push({ id: 'geo', arg: 'coast', label: 'Which way to the sea?' });
  out.push({ id: 'geo', arg: 'water', label: 'Any lakes or rivers near?' });
  out.push({ id: 'geo', arg: 'towns', label: 'Where is a town...' });
  return out;
}

// The nearest square (of those worked out) matching `test`, from (x, z).
function nearestCell(ow, x, z, test, island = null) {
  let best = null;
  for (const c of ow.liveCells) {
    if (!test(c)) continue;
    const cx = (c.cx + 0.5) * REGION_W;
    const cz = (c.cz + 0.5) * REGION_D;
    if (island && ow.islandAt(cx, cz) !== island) continue;
    const d = Math.hypot(cx - x, cz - z);
    if (!best || d < best.d) best = { c, x: cx, z: cz, d };
  }
  return best;
}

export function geoTalk(npc, game, arg) {
  const ow = game.world.ow;
  if (isFar(npc.settlement)) return farTalk(npc, game, arg);
  const s = npc.visit ? ow.settlements[npc.visit.from] || npc.settlement : npc.settlement;
  const folk = folkOf(s);
  const kid = npc.rec.age === 'child';
  const here = ow.islandAt(npc.x, npc.z) || s.island;
  const hereL = ow.island(here);
  const rng = new RNG(hash4(npc.rec.idx || 0, Math.floor(game.sim.abs / 60), 0x6e0));
  const back = 'Thanks.';
  const more = { lines: [], choices: geoMenu(npc, game), back };
  if (!arg) return { lines: [kid ? 'I know LOTS about the islands. Ask me!' : rng.pick(['What do you want to know?', 'Ask away. I\'ve lived here all my life.', 'I know a thing or two about the land round here.'])], choices: geoMenu(npc, game), back: 'Never mind.' };
  if (arg === 'here') {
    if (kid) return { ...more, lines: KID.here(hereL ? hereL.name : 'home') };
    const lines = hereL ? [`This is ${hereL.name}, ${hereL.about}.`, ...VIEWS[folk][here].slice(0, 1)] : ['You\'re on the water, friend.'];
    // (And who holds it.)
    const realms = ow.civs.filter((c) => c.island === here && game.sim.realms.members(c).length);
    const NUM = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six'];
    if (realms.length) lines.push(`${realms.length === 1 ? 'One realm holds it' : `${NUM[realms.length] || 'Many'} realms share it`}: ${realms.map((c) => `the ${c.name.replace(/^The /, '')}`).join(', ')}.`);
    return { ...more, lines };
  }
  if (arg === 'islands') {
    if (kid) return { ...more, lines: ['There are three islands: ours, and two others. And then the Wall.', 'I\'ve never been to the others. One is on FIRE.'] };
    const lines = [`Three islands inside the Wall: ${DAGONI.map((L) => L.name).join(', ')}. That's the whole of the world, as far as anyone here has seen.`];
    for (const L of DAGONI) if (L.key !== here) lines.push(`${L.name}: ${VIEWS[folk][L.key][0]}`);
    return { ...more, lines };
  }
  if (arg.startsWith('isle:')) {
    const key = arg.slice(5);
    const L = ow.island(key);
    if (!L) return more;
    const tx = (L.cx + 0.5) * REGION_W;
    const tz = (L.cz + 0.5) * REGION_D;
    const dir = compass(npc.x, npc.z, tx, tz);
    if (kid) return { ...more, lines: [`${L.name} is that way, I think. ${dir.charAt(0).toUpperCase() + dir.slice(1)}. Over the sea.`, 'You need a raft. I\'m not allowed on rafts.'] };
    const views = VIEWS[folk][key];
    // The nearest coast of that island from here, and the nearest port on it.
    const shore = nearestCell(ow, npc.x, npc.z, (c) => c.biome === 'beach', key);
    const port = ow.settlements.filter((q) => q.island === key && q.coast && q.condition !== 'abandoned').sort((a, b) => Math.hypot(a.cx * REGION_W - npc.x, a.cz * REGION_D - npc.z) - Math.hypot(b.cx * REGION_W - npc.x, b.cz * REGION_D - npc.z))[0];
    const myShore = nearestCell(ow, npc.x, npc.z, (c) => c.biome === 'beach', here);
    const lines = [`${ISLE_LINE(L)}.`, views[rng.int(0, views.length - 1)]];
    lines.push(`It lies ${dir} of here, over the water. You'll want a raft: anyone can knock one together from planks and string.`);
    if (myShore) lines.push(`Head ${compass(npc.x, npc.z, myShore.x, myShore.z)} to the coast (${howFar(myShore.d)}), then paddle ${shore ? compass(myShore.x, myShore.z, shore.x, shore.z) : dir}. It's about ${Math.round(Math.hypot((shore ? shore.x : tx) - myShore.x, (shore ? shore.z : tz) - myShore.z) / REGION_W)} leagues of open water.`);
    if (port) lines.push(`${port.name} is a port on that coast${port.civ ? `, held by the ${port.civ.name.replace(/^The /, '')}` : ''}. Land there and ask.`);
    if (key === 'kharos') lines.push('And keep away from the mountain when the ground starts shaking.');
    return { ...more, lines };
  }
  if (arg === 'wall') return { ...more, lines: kid ? KID.wall : WALL[folk] };
  if (arg === 'beyond') return { ...more, lines: kid ? KID.beyond : BEYOND[folk] };
  if (arg === 'mountain') {
    const V = game.sim.volcano;
    const togo = V.daysToGo();
    const lines = [];
    if (kid) lines.push('The fire mountain! When it goes BOOM the sky goes all dark. It\'s the best.');
    else if (folk === 'ember') lines.push('The Sleeper. It wakes every two or three months, and the kiln-priests feed it offerings so it will wake gently.');
    else lines.push('The Sleeper, the Ashborn call it: a mountain on Kharos that blows its top every couple of months. You hear it even here, and the sky goes black for days.');
    if (V.last !== null) lines.push(`It last went up ${game.day - V.last <= 1 ? 'just now' : `${game.day - V.last} days ago`}.`);
    if (togo !== null && togo <= 4 && here === 'kharos') lines.push('And the ground has been shaking. The vents are smoking. If I were you I\'d be somewhere else, soon.');
    else if (togo !== null && togo <= 10) lines.push('It\'s been quiet. Too quiet, my mother would say.');
    return { ...more, lines };
  }
  if (arg === 'coast') {
    const c = nearestCell(ow, npc.x, npc.z, (q) => q.biome === 'beach' || q.biome === 'mangrove', here);
    if (!c) return { ...more, lines: ['The sea? It\'s all round us, friend. Pick a direction.'] };
    const lines = [`The nearest shore is ${compass(npc.x, npc.z, c.x, c.z)}: ${howFar(c.d)}.`].concat(kid ? [] : ['Get a raft and you can go anywhere inside the Wall. Just not through it.']);
    tell(game, lines, c.x, c.z, 'The shore', '≈');
    return { ...more, lines };
  }
  if (arg === 'water') {
    const lake = nearestCell(ow, npc.x, npc.z, (q) => q.lake, here);
    const river = nearestCell(ow, npc.x, npc.z, (q) => q.river && !q.lake && q.biome !== 'ocean', here);
    const lines = [];
    if (lake) lines.push(`There's a lake ${compass(npc.x, npc.z, lake.x, lake.z)}: ${howFar(lake.d)}. Good fishing, they say.`);
    if (river) lines.push(`The nearest river runs ${compass(npc.x, npc.z, river.x, river.z)} of here: ${howFar(river.d)}.`);
    const hill = nearestCell(ow, npc.x, npc.z, (q) => q.biome === 'mountain' || q.biome === 'volcano', here);
    if (hill) lines.push(`And the high ground's ${compass(npc.x, npc.z, hill.x, hill.z)}, ${howFar(hill.d)}.`);
    if (!lines.length) lines.push('Nothing but the sea, I\'m afraid.');
    if (lake) tell(game, lines, lake.x, lake.z, 'A lake', '•');
    if (river) tell(game, lines, river.x, river.z, 'A river', '•');
    if (hill) tell(game, lines, hill.x, hill.z, 'High ground', '•');
    // (One note will do.)
    for (let i = lines.length - 1; i > lines.indexOf('(Marked on your map.)'); i--) if (lines[i] === '(Marked on your map.)') lines.splice(i, 1);
    return { ...more, lines };
  }
  if (arg === 'towns' || arg.startsWith('town:')) {
    // (Not the far lands', while the storm stands: nobody here knows them.)
    const others = ow.settlements.filter((q) => q !== npc.settlement && q.condition !== 'abandoned' && !q.deserted && !cutOff(ow, npc.settlement, q));
    const dist = (q) => Math.hypot((q.bounds.x0 + q.bounds.x1) / 2 - npc.x, (q.bounds.z0 + q.bounds.z1) / 2 - npc.z);
    if (arg === 'towns') {
      // The nearest on this island, and the chief towns of the others.
      const near = others.filter((q) => q.island === here).sort((a, b) => dist(a) - dist(b)).slice(0, 8);
      const far = others.filter((q) => q.island !== here && q.type !== 'village').sort((a, b) => dist(a) - dist(b)).slice(0, 4);
      return { lines: ['Which one?'], choices: [...near, ...far].map((q) => ({ id: 'geo', arg: `town:${q.id}`, label: `${q.name}${q.island !== here ? ` (${ow.island(q.island).name})` : ''}` })), back: 'Never mind.' };
    }
    const q = ow.settlements[Number(arg.slice(5))];
    if (!q) return more;
    const qx = (q.bounds.x0 + q.bounds.x1) / 2;
    const qz = (q.bounds.z0 + q.bounds.z1) / 2;
    const d = dist(q);
    const lines = [`${q.name}? A ${q.type}${q.civ ? ` of the ${q.civ.name.replace(/^The /, '')}` : ''}, ${q.island === here ? 'here on' : 'over on'} ${ow.island(q.island).name}.`];
    lines.push(`It's ${compass(npc.x, npc.z, qx, qz)} of here: ${q.island === here ? howFar(d) : 'across the water. You\'ll need a raft.'}`);
    if (q.coast && q.island === here) lines.push('It\'s on the coast, if you\'d rather go by water.');
    if (kid) lines.push('I went there once! Or I want to.');
    if (revealTown(game, q)) lines.push('(Marked on your map.)');
    return { ...more, lines };
  }
  return more;
}
