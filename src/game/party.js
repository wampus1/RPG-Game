// Everyone playing in one world (multiplayer: see net/host.js). The host's
// own player is the game's player as ever; each who joins has a seat of
// their own: their player, their character, their windows and keys and
// camera, and their own standing with the world's people (reputation,
// crimes, citizenship, work, favours owed). Whatever a player does, the
// game does as them (asSeat): their seat's things are swapped into the
// game for the moment, so all the game's own code for doing things works
// for each of them unchanged, and the one hurt (or the one who struck) is
// the one it happens to.

// The game's own fields that are each player's.
export const GAME_FIELDS = [
  'player', 'hero', 'playerName', 'ui', 'input', 'cursor', 'mining', 'pending', 'placeRepeat', 'queuedBlow', 'fishing', 'sleep', 'waiting', 'sleepFast',
  'scene', 'shake', 'hurtFlash', 'healFlash', 'lastHp', 'beatT', 'bonusT', 'currentSettlement', 'biomeCache', 'stats', 'dummyLog', 'duel', 'charging',
  'combatT', 'combatWith', 'wanted', 'hitStop', 'slowMo', 'slowMoScale', 'diceGame', 'talkingTo', 'stormWarned', 'lavaWarned', 'lastPrayDay', 'aimFixed',
  'nearSpire', 'looseKeys', 'revealMap', 'stormSea', 'duelAfter', 'spireStorm', 'spireBoltT', 'wallPending',
  // (The old place each is down, if any: see DungeonRun. And the sky over
  // them, wherever they are.)
  'dungeon', 'weather',
  // (A story's opening scene, each their own; and the mountain going up,
  // still to be seen: see eruption.js.)
  'cutscene', 'eruptPending',
];
// The town's view of each: what they think of you, your record.
export const SIM_FIELDS = ['rep', 'citizen', 'renown', 'areaCache', 'confront', 'petition'];
export const JUSTICE_FIELDS = [
  'pending', 'record', 'exiled', 'jail', 'resisted', 'haltCd', 'checkT', 'trespass', 'brandish', 'exileWarn', 'sightings', 'escort', 'pendingEscort',
  'curfewT', 'unsolved', 'repairs', 'forfeit', 'held', 'verdictData',
];
export const CAREER_FIELDS = ['job', 'kits', 'escort', 'returning', 'oldLook', 'ent', 'lastAbs', 'lastStep', 'customer', 'nextCustomer'];
export const FAVOR_FIELDS = ['list', 'offers', 'next', 'done', 'day'];
// Each one's own map: where they've been, and what they've been told of.
export const MAP_FIELDS = ['explored', 'exploredN', 'pins'];

const GROUPS = [
  ['g', (game) => game, GAME_FIELDS],
  ['v', (game) => game.renderer, ['view']],
  ['s', (game) => game.sim, SIM_FIELDS],
  ['j', (game) => game.sim.justice, JUSTICE_FIELDS],
  ['c', (game) => game.sim.careers, CAREER_FIELDS],
  ['f', (game) => game.sim.favors, FAVOR_FIELDS],
  ['o', (game) => game.world && game.world.ow, MAP_FIELDS],
  // (The bounties each has earned, toward claiming: see sim/bandits.js.)
  ['b', (game) => game.sim.bandits, ['heads', 'headNames']],
];

export class Seat {
  constructor({ id, profile = null, host = false }) {
    this.id = id;
    this.profile = profile;
    this.host = host;
    // Its things, while they're out of the game (always, but for the
    // seat the game is being played as).
    this.store = null;
    this.ent = null;
    // (A player who's joined: how to reach them; see net/host.js.)
    this.cid = null;
  }

  get name() {
    return (this.profile && this.profile.name) || 'Player';
  }
}

// What a newcomer starts with: their own of everything, and nobody yet
// knows them.
export function freshStore(game, { player, hero = null, ui = null, input = null, name = 'Wanderer' }) {
  const sim = game.sim;
  const j = new sim.justice.constructor(game, sim);
  const c = new sim.careers.constructor(game, sim);
  const f = new sim.favors.constructor(game, sim);
  const g = {};
  for (const k of GAME_FIELDS) g[k] = undefined;
  Object.assign(g, {
    player, hero, playerName: name, ui, input, cursor: null, mining: null, pending: null, placeRepeat: 0, queuedBlow: null, fishing: null, sleep: null,
    waiting: null, sleepFast: 0, scene: null, shake: 0, hurtFlash: 0, healFlash: 0, stats: { kills: 0, crafted: 0, mined: 0, placed: 0 },
    currentSettlement: null, wanted: new Map(), revealMap: false, dungeon: null, weather: null, cutscene: null, eruptPending: null,
  });
  const pick = (o, fields) => Object.fromEntries(fields.map((k) => [k, o[k]]));
  return {
    g,
    v: { view: 0 },
    s: { rep: new Map(), citizen: null, renown: new Map(), areaCache: new Map(), confront: null, petition: null },
    j: pick(j, JUSTICE_FIELDS),
    c: pick(c, CAREER_FIELDS),
    f: pick(f, FAVOR_FIELDS),
    // (Nowhere yet on their map: see Game.restoreSeat.)
    o: { explored: new Uint8Array(game.world.ow.explored.length), exploredN: 0, pins: [] },
    b: { heads: {}, headNames: {} },
  };
}

// The game's fields into the seat.
function pull(game, seat) {
  const st = seat.store || (seat.store = {});
  for (const [k, get, fields] of GROUPS) {
    const o = get(game);
    if (!o) continue;
    const box = st[k] || (st[k] = {});
    for (const f of fields) box[f] = o[f];
  }
  seat.ent = game.player;
}

// The seat's into the game.
function push(game, seat) {
  for (const [k, get, fields] of GROUPS) {
    const o = get(game);
    const box = seat.store[k];
    if (!o || !box) continue;
    for (const f of fields) o[f] = box[f];
  }
}

// Do `fn` as the player in `seat` (back as whoever it was after, whatever
// happens). Nests: a blow one player strikes that lands on another runs
// as the one it lands on, then back.
export function asSeat(game, seat, fn) {
  const cur = game.seat;
  if (!seat || !cur || seat === cur || !seat.store) return fn();
  pull(game, cur);
  push(game, seat);
  game.seat = seat;
  try {
    return fn();
  } finally {
    pull(game, seat);
    push(game, cur);
    game.seat = cur;
  }
}

// A seat's own field, wherever it is just now.
export function seatField(game, seat, k) {
  if (seat === game.seat) return game[k];
  return seat.store && seat.store.g ? seat.store.g[k] : undefined;
}

// A seat's own field `f` of one of its groups (`k`: 'j' the law's view of
// them, 's' the towns', 'c' their work...), wherever it is just now.
export function seatPart(game, seat, k, f) {
  if (seat === game.seat || !seat.store) {
    const grp = GROUPS.find((q) => q[0] === k);
    const o = grp ? grp[1](game) : null;
    return o ? o[f] : undefined;
  }
  return seat.store[k] ? seat.store[k][f] : undefined;
}

// A seat's own map (its `explored`, `exploredN` and `pins`), wherever it
// is just now.
export function seatMap(game, seat) {
  return seat === game.seat || !seat.store || !seat.store.o ? game.world.ow : seat.store.o;
}

// Has anyone playing been to (or been told of) map square `k`?
export function exploredByAny(game, k) {
  if (game.world.ow.explored[k]) return true;
  for (const s of game.seats || []) if (s !== game.seat && s.store && s.store.o && s.store.o.explored[k]) return true;
  return false;
}

// The whole party's players (the host's first): those still in the world.
export function partyPlayers(game) {
  if (!game.seats || game.seats.length < 2) return game.player ? [game.player] : [];
  const out = [];
  for (const s of game.seats) {
    const p = s === game.seat ? game.player : s.ent;
    if (p) out.push(p);
  }
  return out;
}
