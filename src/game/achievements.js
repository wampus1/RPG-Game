// Achievements (round 49): things done, in any world, kept with you (with
// your account when you have one: see net/account.js), each unlocking a
// title to go by, shown after your name to the people you play with. Every
// title starts locked.
//
// Most are seen by looking (see checkFeats, a few times a second for each
// player): what they've done (their tally: kills, blocks mined, fish...),
// where they are, what they're watching (a master falling, the Wall
// coming down). A player in someone else's world earns theirs there: the
// host tells their screen (see net/host.js and net/guest.js), which keeps
// it with their own account.

const n = (g, k) => (g.stats && g.stats[k]) || 0;
const coins = (p) => (p && p.inv ? p.inv.reduce((s, q) => s + (q && q.item === 'coin' ? q.count : 0), 0) : 0);
const sceneIs = (g, kind) => !!(g.scene && g.scene.kind === kind);
// (An evolved master's fall: its ghost in the scene of it.)
const fell = (g, species) => sceneIs(g, 'boss_down') && !!(g.scene.ghost && g.scene.ghost.species === species);
// (In the world: not watching an opening, not held out of it.)
const inWorld = (g) => !!(g.player && !g.player.limbo && !g.cutscene && !(g.scene && g.scene.intro));

// Each: its name, what it takes (plainly), and the title it unlocks.
export const FEATS = [
  { id: 'begun', name: 'A Story Begins', about: 'Wake up in the world after your opening.', title: 'Wanderer', test: (g) => inWorld(g) },
  { id: 'castaway', name: 'Washed Ashore', about: 'Live through the wreck of your ship (begin as a castaway).', title: 'Castaway', test: (g) => inWorld(g) && g.hero && g.hero.origin === 'crash' },
  { id: 'native', name: 'Born and Raised', about: 'Begin at home, born on the islands.', title: 'Local', test: (g) => inWorld(g) && g.hero && g.hero.origin === 'native' },
  { id: 'star', name: 'Fallen', about: 'Fall to the islands as a star.', title: 'Star-Born', test: (g) => inWorld(g) && g.hero && g.hero.origin === 'star' },
  { id: 'builder', name: 'Brick by Brick', about: 'Place 200 blocks.', title: 'Builder', test: (g) => n(g, 'placed') >= 200 },
  { id: 'miner', name: 'Deep Pockets', about: 'Mine or dig 500 blocks.', title: 'Miner', test: (g) => n(g, 'mined') >= 500 },
  { id: 'hunter', name: 'The Hunt', about: 'Defeat 25 creatures or foes.', title: 'Hunter', test: (g) => n(g, 'kills') >= 25 },
  { id: 'slayer', name: 'Slayer', about: 'Defeat 200 creatures or foes.', title: 'Slayer', test: (g) => n(g, 'kills') >= 200 },
  { id: 'angler', name: 'Patient Line', about: 'Catch 20 fish.', title: 'Angler', test: (g) => n(g, 'fish') >= 20 },
  { id: 'smith', name: 'Handiwork', about: 'Craft 50 things.', title: 'Smith', test: (g) => n(g, 'crafted') >= 50 },
  { id: 'farmer', name: 'Green Thumb', about: 'Harvest 30 ripe crops.', title: 'Farmer', test: (g) => n(g, 'harvested') >= 30 },
  { id: 'scholar', name: 'Flash of Insight', about: 'Have 10 insights at a town\'s study.', title: 'Scholar', test: (g) => n(g, 'insights') >= 10 },
  { id: 'rogue', name: 'Light Fingers', about: 'Pick 5 locks.', title: 'Rogue', test: (g) => n(g, 'locksPicked') >= 5 },
  { id: 'guardian', name: 'Good Samaritan', about: 'Save 3 people from whatever was attacking them.', title: 'Guardian', test: (g) => n(g, 'rescues') >= 3 },
  { id: 'explorer', name: 'Far and Wide', about: 'Explore 1500 squares of the map.', title: 'Explorer', test: (g) => ((g.world && g.world.ow && g.world.ow.exploredN) || 0) >= 1500 },
  { id: 'sailor', name: 'Over the Water', about: 'Set foot on a second island.', title: 'Sailor', test: (g) => (g.stats && g.stats.isles ? g.stats.isles.length : 0) >= 2 },
  { id: 'merchant', name: 'Heavy Purse', about: 'Carry 500 coins at once.', title: 'Merchant', test: (g) => coins(g.player) >= 500 },
  { id: 'delver', name: 'Into the Dark', about: 'Go down into an old place.', title: 'Delver', test: (g) => !!g.dungeon },
  { id: 'champion', name: 'Master\'s Bane', about: 'Bring down the master of an old place.', title: 'Champion', test: (g) => sceneIs(g, 'boss_down') },
  { id: 'spirebreaker', name: 'Spirebreaker', about: 'Bring down the master of a Kavorent spire.', title: 'Spirebreaker', test: (g) => sceneIs(g, 'boss_down') && !!(g.dungeon && g.dungeon.rec && g.dungeon.rec.spire) },
  { id: 'mystic', name: 'The Door Opens', about: 'Open a Kavorent spire with a cut stone.', title: 'Mystic', test: (g) => sceneIs(g, 'spire') },
  { id: 'wallbreaker', name: 'The Wall Falls', about: 'See the storm round the islands break.', title: 'Wallbreaker', test: (g) => sceneIs(g, 'wall') },
  { id: 'duelist', name: 'Satisfaction', about: 'Win a duel.', title: 'Duelist', test: (g) => sceneIs(g, 'yield') && !!g.scene.won },
  { id: 'survivor', name: 'Back from the Dark', about: 'Fall, and rise again.', title: 'Survivor', test: (g) => sceneIs(g, 'death') },
  { id: 'citizen', name: 'Papers, Please', about: 'Become a citizen of a town you weren\'t born in.', title: 'Citizen', test: (g) => !!(g.sim && g.sim.citizen && !g.sim.citizen.native) },
  { id: 'knight', name: 'Sworn Sword', about: 'Serve as a town guard.', title: 'Knight', test: (g) => !!(g.sim && g.sim.careers && g.sim.careers.isGuard && g.sim.careers.isGuard()) },
  { id: 'bard', name: 'Friend to All', about: 'Be well liked (Liked or better) by 12 people.', title: 'Bard', test: (g) => liked(g) >= 12 },
  { id: 'hero', name: 'Hero of the Town', about: 'Be named a hero by a town.', title: 'Hero', test: (g) => !!(g.sim && g.sim.renown && g.sim.renownTitle && [...g.sim.renown.keys()].some((sid) => g.sim.renownTitle(sid) === 'Hero')) },
  { id: 'outlaw', name: 'Wanted', about: 'Be wanted by the law somewhere.', title: 'Outlaw', test: (g) => !!(g.wanted && g.wanted.size) },
  { id: 'bounty', name: 'Bounty Hunter', about: 'Bring down a bandit leader.', title: 'Bounty Hunter', test: (g) => !!(g.sim && g.sim.bandits && g.sim.bandits.heads && Object.keys(g.sim.bandits.heads).length) },
  // (Round 72) The evolved masters of the ancient places (see
  // world/ancient.js): one each.
  { id: 'transmuter', name: 'The Great Work Undone', about: 'Bring down the Divine Alchemist in the Athanor.', title: 'Transmuter', test: (g) => fell(g, 'divine_alchemist') },
  { id: 'sunderer', name: 'The Reach Sealed', about: 'Bring down the Rift Crawler in the Sundered Reach.', title: 'Sunderer', test: (g) => fell(g, 'rift_crawler') },
  { id: 'oathkeeper', name: 'The Last War Ended', about: 'Bring down the Hero in the Hall of the Last Champion.', title: 'Oathkeeper', test: (g) => fell(g, 'the_hero') },
  { id: 'wormsbane', name: 'The Gullet Stilled', about: 'Bring down the Alinelidan in the Gullet of the World.', title: 'Worm-Slayer', test: (g) => fell(g, 'alinelidan') },
];
export const FEAT = Object.fromEntries(FEATS.map((f) => [f.id, f]));

// Every title there is (after none), in the order they're listed.
export const FEAT_TITLES = FEATS.map((f) => f.title);

// People who like you well (rep "Liked" or better).
function liked(g) {
  const rep = g.sim && g.sim.rep;
  if (!rep) return 0;
  let k = 0;
  for (const r of rep.values()) if (r && r.v >= 70 && ++k >= 12) break;
  return k;
}

// The titles a record of achievements (id: when) has unlocked.
export function titlesOf(got) {
  return FEATS.filter((f) => got && got[f.id]).map((f) => f.title);
}

// Which achievement unlocks `title`.
export const featFor = (title) => FEATS.find((f) => f.title === title) || null;

// What the player being played as (see party.js's asSeat) has newly done:
// the ids not in `have` (a set) whose test passes.
export function newFeats(game, have) {
  const out = [];
  for (const f of FEATS) {
    if (have.has(f.id)) continue;
    let ok = false;
    try {
      ok = !!f.test(game);
    } catch {
      ok = false;
    }
    if (ok) out.push(f.id);
  }
  return out;
}

// The island under you, noted (for "Over the Water").
export function noteIsle(game) {
  const ow = game.world && game.world.ow;
  const p = game.player;
  if (!ow || !ow.islandAt || !p || p.limbo || game.dungeon || p.raft) return;
  const isle = ow.islandAt(Math.round(p.x), Math.round(p.z));
  if (!isle) return;
  const s = game.stats || (game.stats = {});
  s.isles ||= [];
  if (!s.isles.includes(isle)) s.isles.push(isle);
}

// ------------------------------------------------------------ keeping them
// Kept in this browser (and with the account, when there is one: it goes
// where the account goes).
export const FEATS_KEY = 'tessera-feats-v1';

export class FeatBook {
  // `accounts`: the account store (see net/account.js), or null.
  constructor(storage, accounts = null) {
    this.st = storage;
    this.accounts = accounts;
    this.local = this.read();
  }

  read() {
    try {
      const o = JSON.parse(this.st && this.st.getItem(FEATS_KEY));
      return o && typeof o === 'object' ? clean(o) : {};
    } catch {
      return {};
    }
  }

  // Everything unlocked (id: when), here or on the account.
  get got() {
    const acc = this.accounts && this.accounts.account;
    return { ...this.local, ...clean(acc && acc.feats) };
  }

  has(id) {
    return !!this.got[id];
  }

  // Unlocked now (true if it's new).
  unlock(id) {
    if (!FEAT[id] || this.has(id)) return false;
    const t = Date.now();
    this.local[id] = t;
    try {
      this.st?.setItem(FEATS_KEY, JSON.stringify(this.local));
    } catch {
      // (No room: kept for now.)
    }
    const acc = this.accounts && this.accounts.account;
    if (acc) {
      acc.feats = { ...clean(acc.feats), [id]: t };
      this.accounts.write();
    }
    return true;
  }

  // Anything earned before the account was made (or on another copy of
  // it) put with it.
  merge() {
    const acc = this.accounts && this.accounts.account;
    if (!acc) return;
    const all = { ...this.local, ...clean(acc.feats) };
    if (Object.keys(all).length !== Object.keys(clean(acc.feats)).length) {
      acc.feats = all;
      this.accounts.write();
    }
  }

  titles() {
    return titlesOf(this.got);
  }
}

// A record of achievements with only real ones in it.
export function clean(o) {
  const out = {};
  if (!o || typeof o !== 'object') return out;
  for (const [k, v] of Object.entries(o)) if (FEAT[k] && v) out[k] = typeof v === 'number' ? v : 1;
  return out;
}
