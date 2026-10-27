// (Round 146) What a player can do at the places a town is known for (see
// world/specialties.js, sim/cities.js): every one of their things to use
// (the arena's gate and its board and its cages, the library's lecterns
// and its map table and its glass, the font and the candles and the
// relic, the bazaar's stalls and its auction block, the forge's furnaces,
// the citadel's board and butts, the baths, the playbill, the racecourse's
// odds, the fair's striker and the fortune-teller's tent, the dig, the
// press, the hives, the old stones...), the window each opens on the
// quarter (what's on, what came of it, its services, its story: see
// ui/citywin.js), and what plays out before your eyes when you're there
// for it: the bouts in the arena, the horses round the course, the play on
// the stage, the bells for a service.
//
// Run on the host for everyone (each as themselves: see Game.asPlayer), so
// with others playing each has their own wagers, their own name in the
// arena, their own once-a-day blessings; the window's mirrored to them.
import { B, BLOCKS } from '../world/blocks.js';
import { ITEMS } from '../world/items.js';
import { GROUND } from '../config.js';
import { RNG, hash4 } from '../util/rng.js';
import { countItem, removeItem } from './inventory.js';
import { gainMastery, mastery } from './mastery.js';
import { quarterAt } from '../world/quarters/index.js';
import { roleTag } from '../world/quarters/kit.js';
import { SPECIALTIES } from '../world/specialties.js';
import { fighterOf, PLAY_LINES, SILKS, SHOWS } from '../sim/shows.js';
import { titleOf } from '../sim/cities.js';
import { price, alive, hearNews, ledger, setOverride, DAY } from '../sim/econ.js';
import { pidOf } from '../sim/saga/refs.js';
import { partyPlayers } from './party.js';
import { Creature } from '../entities/creature.js';

const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const clock = (abs) => {
  const m = ((abs % DAY) + DAY) % DAY;
  const h = Math.floor(m / 60);
  return `${h % 12 || 12}:${String(m % 60).padStart(2, '0')}${h < 12 ? 'am' : 'pm'}`;
};

// ------------------------------------------------------------ where
// The quarter at (x, z) in a town about the players, if any.
export function quarterHere(game, x, z) {
  for (const a of game.active.values()) {
    const L = a.layout;
    const q = L && quarterAt(L, x, z);
    if (q) return { L, q };
  }
  return null;
}

function ctxOf(game, L, q, x, y, z) {
  const C = game.sim.cities;
  const p = game.player;
  return { game, L, q, i: q.i, C, S: C.stateOf(L, q.i), p, pid: pidOf(p), sid: L.settlement.id, x, y, z, day: game.day, now: game.sim.abs, rng: new RNG(hash4(x, z, game.sim.abs, 0x146)) };
}

// ------------------------------------------------------------ helpers
const say = (c, t, col = '#e8d8b0') => c.game.ui.msg(t, col);
const coins = (c) => countItem(c.p.inv, 'coin');
// Paid for: from your purse to the quarter's takings (or the town's).
function pay(c, n, what = '') {
  if (n <= 0) return true;
  if (coins(c) < n) {
    say(c, `You need ¤${n}${what ? ` for ${what}` : ''}.`, '#ff9060');
    return false;
  }
  removeItem(c.p.inv, 'coin', n);
  const Q = c.C.qs(c.L);
  Q.takings = (Q.takings || 0) + n;
  c.game.audio?.play('coin');
  return true;
}
function give(c, item, n = 1) {
  if (!ITEMS[item]) return;
  const left = c.p.give(item, n);
  if (left) c.game.spawnDrop(item, left, c.p.x, c.p.y, c.p.z, true);
}
// Once a day each, for each player (the blessing, the dig, the study...).
function once(c, key) {
  const P = c.C.mine(c.pid);
  const k = `${c.sid}:${c.i}:${key}`;
  if (P.seen[k] === c.day) return false;
  P.seen[k] = c.day;
  // (What's from days gone, let go.)
  for (const [kk, d] of Object.entries(P.seen)) if (d < c.day - 3) delete P.seen[kk];
  return true;
}
const doneToday = (c, key) => c.C.mine(c.pid).seen[`${c.sid}:${c.i}:${key}`] === c.day;
function burst(c, x, y, z, color, o = {}) {
  c.game.renderer.emit(x, y, z, { n: o.n ?? 10, color, up: o.up ?? 24, speed: o.speed ?? 20, life: o.life ?? 0.8, gravity: o.gravity ?? -10, glow: o.glow ?? true, shape: o.shape, oy: o.oy ?? -4 });
}
function buff(c, stat, n, hours, name) {
  const p = c.p;
  const now = c.game.sim.abs;
  p.buffs = (p.buffs || []).filter((q) => q.stat !== stat || q.until <= now);
  p.buffs.push({ stat, n, until: now + hours * 60, name });
  c.game.refreshBonus?.();
}
// One of the quarter's own people about, at their work (or anywhere in it).
function staffAbout(c, job, r = 40) {
  const tag = roleTag(c.i, job);
  let best = null;
  for (const rec of c.L.npcs) {
    if (rec.qtag !== tag || !alive(rec) || !rec.ent || rec.ent.dead || rec.ent.sleeping) continue;
    const d = rec.ent.distTo(c.p);
    if (d <= r && (!best || d < best.d)) best = { n: rec.ent, d };
  }
  return best ? best.n : null;
}
// One of the town's people held where they are (in the pit, on the stage)
// for `mins`, facing `face` (see acts.showAt), then back to their day.
function holdAt(game, e, i, mins, face) {
  const now = game.sim.abs;
  setOverride(e.rec, now, now + mins, 'show', { place: 'quarter', q: i, tag: 'perform', target: { x: e.x, y: e.y, z: e.z }, face, seat: false });
  e.activity = null;
}
function letGo(e) {
  if (e && e.rec && e.rec.override && e.rec.override.tag === 'perform') e.rec.override = null;
  if (e) e.activity = null;
}

// The players near a place, each told (as themselves).
function tellNear(game, x, z, r, text, col = '#ffe070') {
  for (const p of partyPlayers(game)) {
    if (Math.hypot(p.x - x, p.z - z) > r) continue;
    game.asPlayer(p, () => game.ui.msg(text, col));
  }
}
// A look at something, a different word for it by where it stands.
const pickAt = (c, list) => list[hash4(c.x, c.z, 0x14a) % list.length];

// ------------------------------------------------------------ using things
// A thing of a quarter's used (see Game.interact): what it does, or the
// window on the quarter it opens.
export function quarterInteract(game, x, y, z, b) {
  const h = quarterHere(game, x, z);
  if (!h) {
    game.ui.msg(LOOK[b.name] ? LOOK[b.name][0] : `${b.label || b.name}.`, '#c8c8c8');
    return;
  }
  const c = ctxOf(game, h.L, h.q, x, y, z);
  const f = USE[b.name];
  if (f) f(c, b);
  else if (LOOK[b.name]) say(c, pickAt(c, LOOK[b.name]));
  else openQuarter(game, c.sid, c.i);
}

// The quarter's window (see ui/citywin.js), at a page.
let QW = null;
export function setQuarterWindow(W) {
  QW = W;
}
export function openQuarter(game, sid, i, page = 'main') {
  if (!QW || !game.ui.open) return;
  const was = game.ui.find && game.ui.find('quarter');
  if (was) game.ui.close(was);
  game.ui.open(new QW(game.ui, sid, i, page));
}

// Looks: what's said of the things that are only to be looked at (by
// where each stands, one of a few).
const LOOK = {
  beast_cage: ['A great maned lion paces the cage, and stops, and looks at you.', 'A bear, chained, lifts its head as you come near. The bars are scored with claw-marks.', 'Something with spotted hide lies along the back of the cage, tail twitching.', 'A boar the size of a cart snorts at you through the bars.'],
  gladiator_statue: ['A fighter in bronze, sword raised. The plinth names a champion of long ago.', 'A gladiator in stone, one foot on a fallen foe. The nose is rubbed bright by passers-by for luck.'],
  holmgang_post: ['A carved post of the ring. The old law\'s cut into it: what\'s settled here stays settled.'],
  globe: ['The great globe turns under your hand: the islands, the seas between, the edges where the mapmakers stopped.'],
  water_wheel: ['The wheel turns and turns, driving the forge\'s hammers. The race beneath it foams.'],
  catapult: ['A great engine of war, its arm drawn down, a stone in its cup. The garrison drills on it of a morning.'],
  bath_statue: ['A marble figure pouring water from a jar, forever.', 'A bronze nymph, green with age, over the steaming pool.'],
  towel_shelf: ['Towels, folded and warm, and a jar of scented oil.'],
  footlight: ['A footlight, its flame behind glass, turned to the stage.'],
  stage_flat: ['A painted flat: a castle wall, a forest, a ship at sea, depending how it\'s turned.'],
  spina_obelisk: ['An obelisk on the spine, cut with the names of famous horses and the races they won.'],
  start_gate: ['The starting gates, each stall numbered. The horses go in here on race day.'],
  yard_crane: ['A great crane of timber and rope, for lifting the hulls\' ribs into place.'],
  topiary: ['A hedge clipped into a peacock, every feather picked out.', 'A hedge clipped into a leaping hare.', 'A hedge clipped into a crowned lion.', 'A hedge clipped into spirals, one on another.'],
  garden_urn: ['A carved urn brimming with flowers you don\'t know the names of.'],
  rough_statue: ['A statue half out of the block: a face, an arm, the rest still stone.'],
  stone_blocks: ['Dressed stone, squared and stacked, the masons\' marks on each.'],
  incense: ['Incense smoulders on the stand. The smoke goes straight up, then curls.'],
  dig_site: ['A trench, carefully cut, string marking out the squares.'],
  vine_row: ['A row of vines on their stakes.'],
};

// What each thing does, by its block.
const USE = {
  // ---------------------------------------------------------- the arena
  arena_gate: (c) => openQuarter(c.game, c.sid, c.i),
  bout_board: (c) => openQuarter(c.game, c.sid, c.i, 'board'),
  beast_cage: (c) => {
    say(c, pickAt(c, LOOK.beast_cage));
    c.game.audio?.play('roar', { x: c.x, y: c.y, z: c.z });
    if (c.rng.chance(0.25) && Math.max(Math.abs(c.p.x - c.x), Math.abs(c.p.z - c.z)) <= 1) {
      c.p.hp = Math.max(1, c.p.hp - 1);
      c.p.flash = 0.15;
      say(c, 'A paw lashes out through the bars! You leap back, scratched.', '#ff9060');
    }
  },
  gladiator_statue: (c) => {
    const ch = c.S.roster && fighterOf(c.S, c.S.champ);
    say(c, ch ? `${pickAt(c, LOOK.gladiator_statue)} Fresh flowers at its feet, for ${ch.name}, the champion now.` : pickAt(c, LOOK.gladiator_statue));
  },
  holmgang_post: (c) => openQuarter(c.game, c.sid, c.i),
  champion_bronze: (c) => {
    const ch = c.S.roster && fighterOf(c.S, c.S.champ);
    const you = c.C.fameOf(c.pid, c.sid);
    say(c, ch ? `The champion in bronze, three times life-size. The plinth's been recut: ${ch.name.toUpperCase()}, ${ch.w} WINS.${you >= 8 ? ' There\'s talk of putting your name on the next one.' : ''}` : 'The champion in bronze, three times life-size.', '#ffd070');
  },
  // ---------------------------------------------------------- the library
  reading_lectern: (c) => study(c),
  scroll_shelf: (c) => openQuarter(c.game, c.sid, c.i),
  map_table: (c) => openQuarter(c.game, c.sid, c.i),
  globe: (c) => {
    const ow = c.game.world.ow;
    say(c, `${pickAt(c, LOOK.globe)} ${ow.civs ? ow.civs.length : 0} peoples are marked on it, and ${ow.settlements.length} towns.`);
    burst(c, c.x, c.y + 1, c.z, ['#a0c8ff', '#ffffff'], { n: 6, shape: 'star' });
  },
  telescope: (c) => stargaze(c),
  orrery: (c) => {
    say(c, 'The orrery\'s gears click: the moons swing round the world on their brass arms, the wandering stars on theirs. Tonight\'s sky, to the hour.', '#c8d8ff');
    burst(c, c.x, c.y + 2, c.z, ['#ffe070', '#c8d8ff'], { n: 8, shape: 'star' });
    c.game.audio?.play('chime', { x: c.x, y: c.y, z: c.z });
  },
  // ---------------------------------------------------------- the holy seat
  holy_font: (c) => {
    const p = c.p;
    p.hp = p.maxHp;
    p.sick = false;
    burst(c, p.x, p.y + 1, p.z, ['#a0e0ff', '#ffffff', '#ffe8a0'], { n: 14, shape: 'star' });
    c.game.audio?.play('heal');
    if (once(c, 'font')) {
      buff(c, 'end', 1, 6, 'Blessed water');
      say(c, 'You touch the water of the font to your brow. A coolness goes through you, and your hurts are eased. (Endurance +1 for 6 hours.)', '#a0e0ff');
    } else say(c, 'The water of the font is cool. Your hurts are eased.', '#a0e0ff');
  },
  candle_rack: (c) => {
    if (!pay(c, 1, 'a candle')) return;
    burst(c, c.x, c.y + 1, c.z, ['#ffb03a', '#ffe48a'], { n: 6, up: 12 });
    c.game.sim.addRenown(c.sid, 1, 'lit a candle at the holy seat');
    const dead = (c.game.deadNpcs.get(c.sid) || []).length;
    say(c, dead ? 'You light a candle among the others, for the town\'s dead. A cleric nods to you.' : 'You light a candle among the others. It gutters, and steadies.', '#ffe8a0');
  },
  relic_shrine: (c) => {
    if (!once(c, 'relic')) {
      say(c, 'You kneel again before the relic. Its blessing is with you already today.', '#ffe8a0');
      return;
    }
    const st = c.S;
    buff(c, 'cha', 1, 8, 'Blessing of the relic');
    burst(c, c.x, c.y + 1, c.z, ['#ffe070', '#fff4c0'], { n: 18, shape: 'star', up: 30 });
    c.game.audio?.play('chime');
    say(c, `You kneel before the relic of ${st.saint ? `Saint ${st.saint}` : 'the faith'}. You rise lighter. (Charisma +1 for 8 hours.)`, '#ffe8a0');
  },
  // ---------------------------------------------------------- the bazaar
  spice_sacks: (c) => stall(c, 'spices', 'a scoop of spices'),
  rug_stack: (c) => stall(c, c.rng.pick(['rug_red', 'rug_blue', 'rug_green']), 'a rug'),
  pottery: (c) => stall(c, 'pottery', 'a painted pot'),
  birdcages: (c) => {
    say(c, 'Birds of every colour in the cages, singing over each other. A green one says something rude in a far-off tongue.');
    c.game.audio?.play('bird', { x: c.x, y: c.y, z: c.z });
  },
  silk_rack: (c) => stall(c, 'silk', 'a bolt of silk'),
  price_board: (c) => openQuarter(c.game, c.sid, c.i),
  auction_block: (c) => openQuarter(c.game, c.sid, c.i, 'board'),
  // ---------------------------------------------------------- the forge
  blast_furnace: (c) => openQuarter(c.game, c.sid, c.i),
  quench_trough: (c) => {
    burst(c, c.x, c.y + 1, c.z, ['#eceef4', '#d0d4dc'], { n: 12, gravity: -20, glow: false, shape: 'puff' });
    c.game.audio?.play('puff', { x: c.x, y: c.y, z: c.z });
    say(c, 'The water in the trough is black with scale. It hisses where a smith\'s just quenched a blade.');
  },
  guild_board: (c) => openQuarter(c.game, c.sid, c.i, 'board'),
  // ---------------------------------------------------------- the citadel
  merc_board: (c) => openQuarter(c.game, c.sid, c.i, 'board'),
  target_butt: (c) => {
    const ammo = countItem(c.p.inv, 'arrow');
    if (!ammo) {
      say(c, 'The butts are stuck full of arrows from the morning\'s practice. You\'d want a bow and arrows of your own.');
      return;
    }
    openGame(c, 'archery', 'The Butts', 0);
  },
  // ---------------------------------------------------------- the baths
  massage_table: (c) => {
    if (!pay(c, 5, 'a rub-down')) return;
    c.p.hp = c.p.maxHp;
    buff(c, 'agi', 1, 6, 'Loosened up');
    say(c, 'An attendant works the knots out of your back with oil and strong hands. You get up feeling years younger. (Agility +1 for 6 hours.)', '#a0ffa0');
    burst(c, c.p.x, c.p.y + 1, c.p.z, ['#eceef4', '#ffe8c0'], { n: 8, glow: false, shape: 'puff' });
  },
  // ---------------------------------------------------------- the theatre
  stage_curtain: (c) => openQuarter(c.game, c.sid, c.i),
  playbill: (c) => openQuarter(c.game, c.sid, c.i, 'board'),
  // ---------------------------------------------------------- the racecourse
  odds_board: (c) => openQuarter(c.game, c.sid, c.i, 'board'),
  finish_post: (c) => {
    const rec = c.S.trial;
    say(c, rec ? `The winning post. Chalked on it: the course record, ${rec.secs.toFixed(1)}s, ${rec.name} on ${rec.horse}.` : 'The winning post, its paint worn by a thousand finishes. Ride a lap from the gates on your own horse to set the course record.', '#ffe070');
  },
  // ---------------------------------------------------------- the fair
  high_striker: (c) => openGame(c, 'bell', 'The Striker', 2),
  fortune_tent: (c) => fortune(c),
  ring_toss: (c) => {
    if (!pay(c, 1, 'three rings')) return;
    const skill = 0.25 + Math.min(0.3, (c.p.stats?.agi || 0) * 0.03);
    let hits = 0;
    for (let k = 0; k < 3; k++) if (c.rng.chance(skill)) hits++;
    burst(c, c.x, c.y + 1, c.z, ['#e04848', '#f8d040', '#3a8ad8'], { n: 6 + hits * 4 });
    if (hits >= 2) {
      const prize = c.rng.pick(['apple', 'pie', 'flower_red', 'dice', 'flute']);
      give(c, prize, 1);
      say(c, `${hits} rings over the pegs! The showman hands you ${ITEMS[prize].name.toLowerCase()} off the prize shelf.`, '#a0ffa0');
      c.game.audio?.play('reveal_good');
    } else say(c, hits ? 'One ring on a peg, the others clatter off. Not enough for a prize.' : 'All three rings bounce off. The showman grins.', '#ffb080');
  },
  prize_shelf: (c) => say(c, 'The prize shelf: a painted doll, a tin whistle, a cake under a cloth, and right at the top a little gold cup nobody\'s ever won.'),
  carousel: (c) => {
    if (!pay(c, 1, 'a ride')) return;
    say(c, 'Round and round on a painted horse, the music wheezing, the fair spinning past. Childish, and wonderful.', '#ffd0f0');
    c.game.audio?.play('chime');
    buff(c, 'cha', 1, 3, 'Merry');
  },
  // ---------------------------------------------------------- the ruins
  dig_site: (c) => dig(c),
  glyph_stone: (c) => glyphs(c),
  finds_table: (c) => openQuarter(c.game, c.sid, c.i),
  colossus_head: (c) => say(c, 'The head of a giant of bronze, fallen on its side, half in the earth. Its eyes are as tall as you are. Moss grows in its ear. Whoever it was, they were someone, once.', '#e8d8b0'),
  // ---------------------------------------------------------- the winery
  vine_row: (c) => {
    const S = c.S;
    const k = (c.day + hash4(c.sid, c.i) % 30) % 30;
    if (k < 16) {
      say(c, `${pickAt(c, LOOK.vine_row)} The fruit's still small and hard. Harvest's some way off.`);
      return;
    }
    if (!once(c, `vine:${c.x}:${c.z}`)) {
      say(c, 'You\'ve picked this row over today.');
      return;
    }
    give(c, 'grapes', 2 + (S.vintage || 3) % 3);
    say(c, 'You pick a bunch or two. Nobody seems to mind (much).', '#c8a0e0');
  },
  wine_press: (c) => {
    const n = countItem(c.p.inv, 'grapes');
    if (n < 3) {
      say(c, 'The great press. Bring three bunches of grapes to press a bottle\'s worth.');
      return;
    }
    const w = Math.floor(n / 3);
    removeItem(c.p.inv, 'grapes', w * 3);
    give(c, 'wine', w);
    burst(c, c.x, c.y + 1, c.z, ['#6a1a4a', '#8a2a5a', '#a83a6a'], { n: 14, glow: false, gravity: 60 });
    c.game.audio?.play('pour');
    say(c, `You work the press: ${w} bottle${w > 1 ? 's' : ''} of new wine.`, '#c8a0e0');
  },
  wine_vat: (c) => tasting(c),
  wine_cask: (c) => tasting(c),
  // ---------------------------------------------------------- the shipyard
  rope_coil: (c) => {
    if (!once(c, 'rope')) {
      say(c, 'Coils of good rope. The ropemaker\'s watching you.');
      return;
    }
    give(c, 'string', 2);
    say(c, 'The ropemaker cuts you two lengths from the end of a coil. "Offcuts. Go on."', '#e8d8b0');
  },
  // ---------------------------------------------------------- the gardens
  aviary: (c) => {
    c.game.audio?.play('bird', { x: c.x, y: c.y, z: c.z });
    say(c, pickAt(c, ['Birds from every land in the aviary: crested, long-tailed, one that hangs upside-down and screams.', 'A flash of red and blue between the leaves of the aviary, and a song like a flute.', 'White doves, hundreds of them, in the great cage.']));
    burst(c, c.x, c.y + 2, c.z, ['#e04848', '#3a8ad8', '#f8d040', '#ffffff'], { n: 6, glow: false, gravity: -20 });
  },
  // ---------------------------------------------------------- the monastery
  meditation_mat: (c) => {
    if (!once(c, 'meditate')) {
      say(c, 'You sit again a while. The stillness is easier now.', '#c8e8ff');
      return;
    }
    gainMastery(c.game, 'study', 0.5);
    buff(c, 'end', 2, 6, 'Still mind');
    burst(c, c.p.x, c.p.y + 1, c.p.z, ['#c8e8ff', '#ffffff'], { n: 10, shape: 'star', up: 10 });
    say(c, 'You sit on the mat, and breathe, and let the morning go by. When you rise you\'re not sure how long it\'s been. (Endurance +2 for 6 hours.)', '#c8e8ff');
  },
  wooden_dummy: (c) => {
    c.p.doAction?.(0.3);
    c.game.audio?.play('swing');
    burst(c, c.x, c.y + 1, c.z, ['#d8b07a', '#c49660'], { n: 5, glow: false, gravity: 120 });
    if ((c.C.mine(c.pid).dummyT || 0) > c.game.sim.abs) return;
    c.C.mine(c.pid).dummyT = c.game.sim.abs + 30;
    gainMastery(c.game, 'dueling', 0.25);
    say(c, pickAt(c, ['Strike, block, strike: the dummy\'s arms swing back at you. A monk watching corrects your stance.', 'You work the wooden dummy until your forearms ache.']), '#e8d8b0');
  },
  tea_table: (c) => {
    if (!pay(c, 1, 'tea')) return;
    give(c, 'jasmine_tea', 1);
    say(c, 'A monk pours you a bowl of tea and sets the pot down without a word. It\'s very good.', '#a0e0a0');
  },
  incense: (c) => {
    burst(c, c.x, c.y + 1, c.z, ['#9a9aa2', '#b4b4ba'], { n: 6, glow: false, shape: 'puff', up: 10, gravity: -15 });
    say(c, pickAt(c, LOOK.incense));
  },
  // ---------------------------------------------------------- the apiary
  bee_skep: (c) => {
    if (!once(c, `skep:${c.x}:${c.z}`)) {
      say(c, 'The bees are humming. You\'ve taken enough from this one today.');
      return;
    }
    const stung = c.rng.chance(c.p.equipment?.head ? 0.15 : 0.45);
    if (stung) {
      c.p.hp = Math.max(1, c.p.hp - 1);
      c.p.flash = 0.15;
      c.game.audio?.play('sting');
      say(c, 'Ow! Stung, and again. You come away with the comb anyway.', '#ffb080');
    } else say(c, 'You lift the skep gently and break off a little comb, the bees humming round your hands.', '#ffe070');
    give(c, 'honeycomb', 1);
    burst(c, c.x, c.y + 1, c.z, ['#ffd040', '#2a2a2a'], { n: 10, glow: false, gravity: 0, speed: 30 });
  },
  // ---------------------------------------------------------- the old stones
  rune_stone: (c) => omen(c),
  altar_stone: (c) => offering(c),
  // ---------------------------------------------------------- the quarry
  mason_bench: (c) => openQuarter(c.game, c.sid, c.i),
  // ---------------------------------------------------------- the delve
  delve_board: (c) => openQuarter(c.game, c.sid, c.i, 'board'),
  delve_memorial: (c) => {
    const lost = c.S.lost || [];
    say(c, lost.length ? `The stone of those who went down and didn't come back. The newest names: ${lost.slice(-3).map((q) => q.name).join(', ')}. ${lost.length} in all.` : 'The memorial stone of the delve. Room on it for names, and none cut yet. Long may it stay that way.', '#b0b8e0');
  },
};

// ------------------------------------------------------------ the services
// A trader's stall: their wares (the one minding it, if they're about),
// or a thing off the front of it, bought there and then.
function stall(c, item, what) {
  const n = staffAbout(c, 'stallholder', 6);
  if (n && c.game.ui.openTrade) {
    c.game.ui.openTrade(n);
    return;
  }
  if (!ITEMS[item]) return;
  const cost = Math.max(1, Math.round(price(item) * 0.85));
  if (!pay(c, cost, what)) return;
  give(c, item, 1);
  say(c, `Nobody's minding the stall: you leave ¤${cost} in the dish and take ${what}.`, '#e8d8b0');
}

// Study at a lectern: once a day, something learned (and somewhere told of).
function study(c) {
  if (!once(c, 'study')) {
    say(c, 'You read on a while. Your head\'s full for today.', '#a0c8ff');
    return;
  }
  gainMastery(c.game, 'study', 1);
  const L = c.L;
  const dun = c.game.sim.dungeons.all.filter((r) => r && r.origin && r.x !== undefined && !r.known && Math.hypot(r.x - c.p.x, r.z - c.p.z) < 900);
  const r = dun.length ? dun[hash4(c.day, c.sid, 0x14b) % dun.length] : null;
  if (r) {
    r.known = true;
    say(c, `In a chronicle you find it: "${r.origin.short}" The place is marked on your map now.`, '#a0c8ff');
  } else {
    const facts = (L.econ.ledger || []).slice(-30);
    const f = facts.length ? facts[hash4(c.day, c.sid, 0x14c) % facts.length] : null;
    say(c, f ? `In the town's own books: "${f.text}"` : 'You read a treatise on the courses of the stars, and understand perhaps half.', '#a0c8ff');
  }
}

function stargaze(c) {
  if (c.game.isDay()) {
    say(c, 'The great glass, turned to the sky. By day there\'s nothing to see but sky.', '#c8d8ff');
    return;
  }
  burst(c, c.p.x, c.p.y + 6, c.p.z - 3, ['#ffffff', '#c8d8ff'], { n: 10, shape: 'star', gravity: 0, speed: 60 });
  if (!once(c, 'stars')) {
    say(c, 'The stars wheel slowly through the glass.', '#c8d8ff');
    return;
  }
  gainMastery(c.game, 'study', 1);
  const lucky = c.rng.chance(0.3 + mastery(c.game, 'study').rank * 0.05);
  if (lucky) give(c, 'star_chart', 1);
  say(c, lucky ? 'Through the great glass: the moons, the wandering stars, a comet nobody\'s named. The astronomer lets you copy their chart.' : 'Through the great glass: the moons, their seas and mountains, and stars behind stars.', '#c8d8ff');
}

// A fortune told (and true, as often as not: an old place hereabouts).
function fortune(c) {
  if (!pay(c, 3, 'your fortune')) return;
  burst(c, c.x, c.y + 1, c.z, ['#c8a0ff', '#ffffff'], { n: 12, shape: 'star' });
  const sim = c.game.sim;
  const near = sim.dungeons.all.filter((r) => r && r.x !== undefined && !r.cleared && Math.hypot(r.x - c.p.x, r.z - c.p.z) < 700);
  const r = near.length ? near[hash4(c.day, c.pid.length, c.sid, 0x14d) % near.length] : null;
  const dir = (r) => {
    const a = Math.atan2(r.z - c.p.z, r.x - c.p.x);
    return ['east', 'south-east', 'south', 'south-west', 'west', 'north-west', 'north', 'north-east'][((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8];
  };
  if (r && c.rng.chance(0.7)) {
    const was = r.known;
    r.known = true;
    say(c, `The fortune-teller turns a card, and another. "I see a door in the earth, to the ${dir(r)}... ${r.cleared ? 'empty' : 'and something waiting'}. ${cap(r.name)}." ${was ? '' : 'The place is marked on your map.'}`, '#c8a0ff');
  } else {
    const news = (c.L.econ.rumours || []).slice(-3);
    say(c, news.length ? `"The cards speak of... ${news[0].text.replace(/\.$/, '')}. And of a stranger. That's you, dear."` : `"${c.rng.pick(['A long road, and a warm hearth at the end of it.', 'Gold, but not where you think.', 'Beware the quiet one.', 'A friend will need you, soon.'])}"`, '#c8a0ff');
  }
  buff(c, 'cha', 1, 4, 'Foretold');
}

function dig(c) {
  if (!once(c, `dig:${c.x}:${c.z}`)) {
    say(c, 'You\'ve dug this square out today.');
    return;
  }
  c.p.doAction?.(0.3);
  c.game.audio?.play('dig');
  burst(c, c.x, c.y + 1, c.z, ['#8a6a44', '#6a5034', '#a8885c'], { n: 10, glow: false, gravity: 120 });
  const r = c.rng.next();
  const item = r < 0.1 ? 'relic_shard' : r < 0.35 ? 'old_coin' : r < 0.5 ? 'pottery' : null;
  if (item && ITEMS[item]) {
    give(c, item, 1);
    say(c, `You brush away the earth: ${ITEMS[item].name.toLowerCase()}! The antiquarian will want to see that.`, '#ffe070');
  } else say(c, 'You dig, carefully, and find nothing but stones and a worm.', '#c8c8c8');
}

function glyphs(c) {
  const rank = mastery(c.game, 'study').rank;
  if (rank < 3) {
    say(c, 'Writing in a tongue nobody speaks: hooks and eyes and little ladders. A scholar might make it out.', '#c8c8c8');
    return;
  }
  if (!once(c, 'glyphs')) {
    say(c, 'You\'ve made out all you can of it today.', '#c8c8c8');
    return;
  }
  gainMastery(c.game, 'study', 1);
  const sites = (c.game.world.sites || []).filter((s) => s.ancient && s.x !== undefined);
  const s = sites.length ? sites.reduce((a, b) => (Math.hypot(b.x - c.p.x, b.z - c.p.z) < Math.hypot(a.x - c.p.x, a.z - c.p.z) ? b : a)) : null;
  if (s) c.game.world.ow.markExplored(s.x, s.z, 2);
  say(c, s ? 'You make it out, slowly: a list of names, a warning, and a way, "where the old road meets the stones". You think you know where. (Marked on your map.)' : 'You make it out, slowly: a king\'s name, and his boasts, and nothing else.', '#a0c8ff');
}

function tasting(c) {
  if (!pay(c, 2, 'a tasting')) return;
  const v = c.S.vintage || 3;
  give(c, 'wine', 1);
  say(c, `${['A thin year, this one.', 'Sound enough, no more.', 'A good year, round and full.', 'A fine year! You can taste the summer in it.', 'A great year. They\'ll talk of this one.'][Math.max(0, Math.min(4, v - 1))]} You take a bottle away with you.`, '#c8a0e0');
}

function omen(c) {
  const rng = new RNG(hash4(c.day, c.x, c.z, 0x14e));
  const good = rng.chance(0.6);
  const text = good ? rng.pick(['The rune of the open road: a journey, and good company on it.', 'The rune of the hearth: what you build will stand.', 'The rune of the bright blade: you\'ll not be bested today.']) : rng.pick(['The rune of the long night: tread carefully.', 'The rune of the broken shield: an old friend may fail you.', 'The rune of the deep water: what you seek is further than you think.']);
  burst(c, c.x, c.y + 1, c.z, good ? ['#a0ffa0', '#ffffff'] : ['#8090c0', '#c0c8e0'], { n: 10, shape: 'star' });
  if (good && once(c, 'omen')) buff(c, 'str', 1, 4, 'Good omen');
  say(c, `You lay your hand on the stone. ${text}${good ? ' (Strength +1 for 4 hours.)' : ''}`, good ? '#a0ffa0' : '#b0b8e0');
}

function offering(c) {
  const held = c.p.heldItem && c.p.heldItem();
  if (!held || held === 'coin' || !ITEMS[held]) {
    say(c, 'The altar stone, worn hollow by a thousand offerings. You\'d want something in your hand to leave on it.', '#c8c8c8');
    return;
  }
  const v = price(held);
  removeItem(c.p.inv, held, 1);
  burst(c, c.x, c.y + 1, c.z, ['#ffb03a', '#ffe48a', '#ffffff'], { n: 16, up: 30 });
  c.game.audio?.play('rune');
  if (v >= 20 && once(c, 'offering')) {
    buff(c, 'str', 2, 8, 'The old gods\' favour');
    say(c, `You leave the ${ITEMS[held].name.toLowerCase()} on the altar. The wind drops. Something old is pleased. (Strength +2 for 8 hours.)`, '#ffe070');
  } else say(c, `You leave the ${ITEMS[held].name.toLowerCase()} on the altar. The stones say nothing.`, '#c8c8c8');
}

// One of the festival's games (see ui/festwin.js), played for a prize.
function openGame(c, kind, title, fee) {
  if (fee && !pay(c, fee, 'a go')) return;
  const s = c.L.settlement;
  const token = (Math.random() * 1e9) | 0;
  const cfg = {
    kind, token, seed: hash4(s.seed >>> 0, c.i, token), sid: s.id, ev: null, title, town: s.name, style: s.style || 'vale', quarter: { sid: s.id, i: c.i },
    hour: (c.game.minute || 0) / 60, wet: false, board: [], tries: 1, look: c.p.look,
  };
  if (kind === 'archery') cfg.wind = { x: Math.round((((hash4(token, 1) % 2000) / 1000) - 1) * 30) / 100, gust: 0.3 };
  c.C.mine(c.pid).game = { token, kind, sid: s.id, i: c.i };
  c.game.openFest(cfg);
}

// How a player did at one (see Game.festResult).
export function cityFestResult(game, cfg, msg) {
  const pid = pidOf(game.player);
  const P = game.sim.cities.mine(pid);
  const g = P.game;
  if (!g || g.token !== cfg.token || msg.token !== cfg.token) return null;
  P.game = null;
  const score = Math.max(0, Math.min(100, +msg.score || 0));
  if (cfg.kind === 'bell') {
    if (score >= 96) {
      game.player.give('laurel_wreath', 1);
      game.ui.msg('DING! The bell rings out over the fair, and the crowd cheers. The showman crowns you with a wreath.', '#ffe070');
      return { text: 'You rang the bell! A wreath for the strongest at the fair.' };
    }
    if (score >= 75) {
      game.player.give('pie', 1);
      game.ui.msg('A good swing! Not the bell, but near it. A pie for your trouble.', '#a0ffa0');
      return { text: 'Near the bell: a pie for your trouble.' };
    }
    return { text: 'Not this time.' };
  }
  if (cfg.kind === 'archery') {
    gainMastery(game, 'dueling', 0.2);
    if (score >= 60) {
      const n = Math.round(score / 10);
      game.player.give('coin', n);
      game.ui.msg(`Good shooting! The garrison's sergeant pays out ¤${n} on the wager.`, '#a0ffa0');
      return { text: `Good shooting: ¤${n}.` };
    }
    return { text: 'The sergeant shakes their head.' };
  }
  return null;
}

// ------------------------------------------------------------ the window's model
// What the quarter's window shows (a page of it): its words, and the
// things to do there (each `act`, done by quarterAct). Data only: drawn
// in ui/citywin.js, the same on every screen.
export function quarterView(game, sid, i, page) {
  const L = game.sim.layoutOf(sid);
  const q = L && (L.quarters || [])[i];
  if (!q) return null;
  const C = game.sim.cities;
  const S = C.stateOf(L, i);
  const pid = pidOf(game.player);
  const K = SPECIALTIES[q.k];
  const spec = (L.settlement.spec || [])[q.sk] || {};
  const v = { title: q.name, sub: `${titleOf(q)} of ${L.settlement.name}`, blurb: K ? cap(K.blurb) : '', tabs: [{ id: 'main', label: 'What\'s on' }], lines: [], rows: [], page };
  const board = BOARD[q.k];
  if (board) v.tabs.push({ id: 'board', label: board.label });
  v.tabs.push({ id: 'story', label: 'Its story' });
  const now = game.sim.abs;
  const line = (t, c) => v.lines.push({ t, c });
  const row = (label, right, act, on = true, col) => v.rows.push({ label, right, act, on, col });
  if (page === 'story') {
    line(`Built in the year ${spec.year || '?'} by the town's ${['founders', 'elders', 'first council', 'old lords'][hash4(sid, i) % 4]}.`);
    line(v.blurb, '#8a7a62');
    const fe = q.f || [];
    if (fe.length) line(`Known for: ${fe.map((f) => FEAT[f] || f).join(', ')}.`, '#c8b890');
    for (const t of storyOf(q, S, C, pid, sid)) line(t, '#e8d8b0');
    const past = C.qs(L).past.filter((o) => o.q === i).slice(-6).reverse();
    if (past.length) line('Lately:', '#ffe070');
    for (const o of past) line(` Day ${o.day + 1}: ${o.title}${o.res ? ` (${o.res})` : ''}${o.n ? `, ${o.n} came` : ''}.`, '#a89878');
    return v;
  }
  if (page === 'board' && board) {
    board.view({ game, L, q, S, C, pid, sid, i, now, line, row });
    return v;
  }
  // What's on: today's doings, what's on now, what's next.
  const evs = C.eventsOf(L, i);
  if (!evs.length) {
    const nx = nextEvent(L, q, S, game.day);
    line(nx ? `Nothing on today. Next: ${nx.title}, on day ${nx.day + 1} at ${clock(nx.s)}.` : 'Nothing kept to a calendar here: just the day\'s work.', '#a89878');
  }
  for (const ev of evs) {
    const on = now >= ev.s && now < ev.e && !ev.done;
    const st = ev.done ? `done${ev.crowdN ? `, ${ev.crowdN} came` : ''}` : on ? 'ON NOW' : now < ev.s ? `at ${clock(ev.s)}` : 'over';
    line(`${on ? '►' : '·'} ${ev.title} (${clock(ev.s)}-${clock(ev.e)}): ${st}`, on ? '#80e070' : ev.done ? '#8a7a62' : '#e8d8b0');
  }
  const owed = C.owed(pid, sid);
  if (owed) row('Collect your winnings', `¤${owed}`, 'collect', true, '#80e070');
  for (const s of SERVICES[q.k] || []) {
    if (s.when && !s.when({ game, L, q, S, C, pid, sid, i, now })) continue;
    row(s.label, typeof s.fee === 'function' ? s.fee({ game, L, q, S }) : s.fee ? `¤${s.fee}` : '', s.act);
  }
  // The quarter's own people.
  const staff = L.npcs.filter((r) => r.qtag && r.qtag.startsWith(`q${i}:`) && alive(r));
  if (staff.length) line(`Its people: ${staff.slice(0, 6).map((r) => `${r.name.first} (${(JOBS_T[r.job] || r.job).toLowerCase()})`).join(', ')}${staff.length > 6 ? `, and ${staff.length - 6} more` : ''}.`, '#8a7a62');
  return v;
}
const JOBS_T = { gladiator: 'Gladiator', lanista: 'Master of the games', bookie: 'Bookmaker', actor: 'Player', stallholder: 'Stallholder' };

// The next of a quarter's doings on a later day (up to a month on).
function nextEvent(L, q, S, day) {
  const K = SHOWS[q.k];
  if (!K) return null;
  for (let d = day + 1; d <= day + 30; d++) {
    const list = K.events({ L, q, st: S }, d) || [];
    if (list.length) return { ...list[0], day: d };
  }
  return null;
}

// What the features are, in words.
const FEAT = {
  cages: 'beasts in cages', cells: 'cells for the condemned', box: 'a lord\'s box', statue: 'a champion in bronze', awnings: 'awnings against the sun', school: 'a school of gladiators', shrine: 'a shrine to the fallen', towers: 'towers', fountain: 'a fountain', grass: 'a grass floor',
  observatory: 'a star tower', archive: 'an archive', cloister: 'a cloister', maps: 'a map room', scriptorium: 'a scriptorium', garden: 'a garden', statues: 'statues', dome: 'a great dome',
  guild: 'a delvers\' guild', relics: 'relics brought up', bell: 'an alarm bell', infirmary: 'an infirmary', barricade: 'a barricade', memorial: 'a memorial to the lost',
  spring: 'a holy spring', bells: 'bells', relic: 'a holy relic', hostel: 'a pilgrims\' hostel', candles: 'candles', graves: 'old graves',
  auction: 'auctions', exchange: 'a money exchange', caravanserai: 'a caravanserai', spices: 'the spice market', far: 'goods from far lands', clock: 'a great clock',
  foundry: 'a foundry', mine: 'a mine', waterwheel: 'a water wheel', oreyard: 'an ore yard', chimneys: 'tall chimneys',
  keep: 'a keep', yard: 'a training yard', armory: 'an armoury', stables: 'stables', mercs: 'swords for hire', chapel: 'a chapel', moat: 'a moat',
  steam: 'steam rooms', cold: 'a cold plunge', massage: 'rub-downs', mosaic: 'mosaics',
  curtain: 'a great curtain', boxes: 'private boxes', props: 'scenery', orchestra: 'an orchestra', lanterns: 'lanterns',
  spina: 'a spine of obelisks', stands: 'grandstands', bookie: 'a bookmaker', market: 'a horse market',
  strongman: 'a striker', fortune: 'a fortune-teller', carousel: 'a carousel', stage: 'a stage', pens: 'pens of beasts', games: 'games of skill',
  colossus: 'a fallen colossus', gate: 'an old gate', columns: 'a colonnade', dig: 'a dig', vault: 'a sealed vault', glyphs: 'old writing', overgrown: 'ivy over everything',
  rows: 'rows of vines', press: 'a press', cellar: 'cellars', tasting: 'tastings', vats: 'great vats', carts: 'carts',
  lighthouse: 'a lighthouse', crane: 'cranes', ropewalk: 'a ropewalk', drydock: 'a dry dock', fishmarket: 'a fish market',
  menagerie: 'a menagerie', glasshouse: 'a glasshouse', maze: 'a hedge maze', pond: 'a pond', aviary: 'an aviary', topiary: 'topiary',
  training: 'a training yard', tea: 'a tea house', library: 'a library', pagoda: 'a pagoda',
  meadery: 'a meadery', flowers: 'flower beds', skeps: 'straw skeps',
  altar: 'an altar stone', grove: 'a sacred grove', runes: 'rune stones', bonfire: 'a bonfire', menhir: 'a great menhir',
  masons: 'masons\' yards',
};

// A few lines of a quarter's own story (its champions, its plays...).
function storyOf(q, S, C, pid, sid) {
  const out = [];
  if (q.k === 'arena' && S.roster) {
    const ch = fighterOf(S, S.champ);
    if (ch) out.push(`Champion: ${ch.name}, a ${ch.way}, ${ch.w} wins and ${ch.l} losses.`);
    if (S.freed) out.push(`${S.freed} of the condemned have won their freedom on these sands.`);
    const f = C.fameOf(pid, sid);
    if (f) out.push(f > 0 ? `Your own name here: ${f >= 8 ? 'a legend of the sands' : f >= 4 ? 'a crowd favourite' : 'known to the crowd'} (${C.mine(pid).arena?.[sid]?.w || 0} wins).` : 'The crowd remembers you, and not kindly.');
  }
  if (q.k === 'racecourse' && S.horses) {
    const best = [...S.horses].sort((a, b) => b.w - a.w)[0];
    if (best) out.push(`The finest horse on the course: ${best.name} (ridden by ${best.jockey}), ${best.w} wins from ${best.starts} starts.`);
    if (S.trial) out.push(`Course record: ${S.trial.secs.toFixed(1)}s, ${S.trial.name} on ${S.trial.horse}.`);
  }
  if (q.k === 'theatre' && S.plays) {
    const best = [...S.plays].sort((a, b) => b.fame - a.fame)[0];
    if (best) out.push(`Its most famous play: "${best.title}" by ${best.author}, played ${best.shows} times.`);
  }
  if (q.k === 'holy' && S.god) out.push(`Sacred to ${S.god}. ${S.pilgrims || 0} pilgrims have come for the feast of Saint ${S.saint}.`);
  if (q.k === 'delve') out.push(`The delvers have gone down ${S.trips || 0} times, and come up with something ${S.hauls || 0} of them. ${(S.lost || []).length} never came back.`);
  if (q.k === 'shipyard' && S.launched) out.push(`${S.launched} ships launched here${S.lastShip ? `, the latest ${S.lastShip}` : ''}.`);
  if (q.k === 'forge' && S.castings) out.push(`The great furnaces have been poured ${S.castings} times.`);
  if (q.k === 'library' && S.lectures) out.push(`${S.lectures} lectures given in its halls.`);
  if (q.k === 'winery') out.push(`This year's vintage: ${['thin', 'fair', 'good', 'fine', 'great'][Math.max(0, Math.min(4, (S.vintage || 3) - 1))]}.`);
  if (q.k === 'fair' && S.champ) out.push(`The strongest at the last fair: ${S.champ}.`);
  return out;
}

// Each kind's own services, on its first page.
const SERVICES = {
  arena: [{ label: 'Fight on the sands', act: 'fight' }],
  library: [{ label: 'Study at a lectern (once a day)', act: 'study' }, { label: 'Buy a chart of the stars', fee: 14, act: 'buy:star_chart:14' }, { label: 'Buy a map of these parts', fee: 15, act: 'map' }],
  holy: [{ label: 'Light a candle', fee: 1, act: 'candle' }, { label: 'Holy water', fee: 2, act: 'buy:holy_water:2' }, { label: 'A beeswax candle to take', fee: 3, act: 'buy:beeswax_candle:3' }],
  bazaar: [{ label: 'Sell your gems and pearls to the changer', act: 'sellgems' }, { label: 'Buy a bolt of silk', fee: 12, act: 'buy:silk:12' }, { label: 'Buy a scoop of spices', fee: 6, act: 'buy:spices:6' }],
  forge: [{ label: 'Smelt your iron ore at the furnaces (¤1 each)', act: 'smelt' }, { label: 'Buy an iron ingot', fee: 5, act: 'buy:iron_ingot:5' }],
  citadel: [{ label: 'Drill with the garrison (once a day)', act: 'drill' }],
  baths: [{ label: 'Take the waters', fee: 2, act: 'bathe' }, { label: 'A rub-down', fee: 5, act: 'rub' }],
  theatre: [{ label: 'Buy a seat for tonight', fee: 3, act: 'ticket', when: (o) => o.C.eventsOf(o.L, o.i).some((e) => e.type === 'play' && !e.done) }],
  racecourse: [],
  fair: [{ label: 'Strike the bell', fee: 2, act: 'striker' }, { label: 'Have your fortune told', fee: 3, act: 'fortune' }],
  ruins: [{ label: 'Sell your finds to the antiquarian', act: 'sellfinds' }],
  winery: [{ label: 'A tasting', fee: 2, act: 'taste' }, { label: 'A case to take away (four bottles)', fee: 18, act: 'buy:wine:18:4' }],
  shipyard: [{ label: 'Buy rope and timber', fee: 6, act: 'buy:planks:6:4' }, { label: 'A spyglass from the chandler', fee: 30, act: 'buy:spyglass:30' }],
  gardens: [{ label: 'Buy a cutting', fee: 3, act: 'buy:sapling:3' }, { label: 'A posy of rare flowers', fee: 2, act: 'buy:flower_blue:2:3' }],
  monastery: [{ label: 'A bowl of tea', fee: 1, act: 'buy:jasmine_tea:1' }, { label: 'Meditate (once a day)', act: 'meditate' }],
  apiary: [{ label: 'A jar of honey', fee: 3, act: 'buy:honeycomb:3' }, { label: 'A flask of mead', fee: 4, act: 'buy:mead:4' }, { label: 'Beeswax candles', fee: 3, act: 'buy:beeswax_candle:3:2' }],
  circle: [{ label: 'Ask the seer for an omen', fee: 2, act: 'omen' }],
  quarry: [{ label: 'Buy dressed stone (eight)', fee: 6, act: 'buy:stone_bricks:6:8' }, { label: 'Commission a bust', fee: 30, act: 'buy:marble_bust:30' }],
  delve: [{ label: 'Rent a lantern and rope for the way down', fee: 4, act: 'kit' }],
};

// Each kind's board, if it has one: its label and its page.
const BOARD = {
  arena: { label: 'The card', view: arenaBoard },
  racecourse: { label: 'Race card', view: raceBoard },
  theatre: { label: 'Repertoire', view: theatreBoard },
  bazaar: { label: 'The auction', view: auctionBoard },
  forge: { label: 'Guild contracts', view: contractBoard },
  delve: { label: 'Contracts', view: contractBoard },
  citadel: { label: 'Swords for hire', view: mercBoard },
};

function arenaBoard(o) {
  const { L, i, S, C, now, line, row, pid, sid } = o;
  const ev = C.eventsOf(L, i).find((e) => e.type === 'games');
  const ch = fighterOf(S, S.champ);
  if (ch) line(`Champion of the arena: ${ch.name} (${ch.w}-${ch.l}).`, '#ffd070');
  if (!ev) {
    line('No games today. The card\'s posted the morning of the games.', '#a89878');
  } else {
    line(`${ev.title}, ${clock(ev.s)}. ${ev.done ? 'Over.' : now >= ev.s ? 'Under way: no more wagers.' : 'Wagers taken till the first bout.'}`, '#e8d8b0');
    ev.data.bouts.forEach((b, k) => {
      const A = fighterOf(S, b.a);
      const Bf = fighterOf(S, b.b);
      if (!A || !Bf) return;
      const od = C.odds(L, i, ev, k);
      const kind = b.kind === 'title' ? ' (TITLE)' : b.kind === 'freedom' ? ' (FOR FREEDOM)' : '';
      const res = b.result ? `  → ${(b.result === 'a' ? A : Bf).name} won` : '';
      line(`${k + 1}. ${A.name} [${A.way}, ${A.w}-${A.l}] v ${Bf.name} [${Bf.crime ? `condemned for ${Bf.crime}` : `${Bf.way}, ${Bf.w}-${Bf.l}`}]${kind}${res}`, b.result ? '#8a7a62' : '#e8d8b0');
      if (!ev.done && now < ev.s) {
        for (const stake of [5, 20]) {
          row(`  ¤${stake} on ${A.name}`, `${od.a}:1`, `bet:${k}:a:${stake}`);
          row(`  ¤${stake} on ${Bf.name}`, `${od.b}:1`, `bet:${k}:b:${stake}`);
        }
      }
    });
  }
  const mine = C.mine(pid).bets.filter((b) => b.sid === sid && b.q === i && b.state === 'open');
  for (const b of mine) line(`Your wager: ¤${b.stake} on ${b.title} at ${b.odds}:1.`, '#80e070');
  line('The school\'s roster:', '#ffe070');
  for (const f of [...S.roster].sort((a, b) => b.fame - a.fame).slice(0, 6)) line(` ${f.name}, ${f.way}: ${f.w}-${f.l}${f.id === S.champ ? ' (champion)' : ''}`, '#a89878');
}

function raceBoard(o) {
  const { L, i, S, C, now, line, row, pid, sid } = o;
  const ev = C.eventsOf(L, i).find((e) => e.type === 'races');
  if (!ev) {
    line('No racing today. The card\'s up the morning of a race day.', '#a89878');
  } else {
    line(`${ev.title}, from ${clock(ev.s)}. ${ev.done ? 'Over.' : now >= ev.s ? 'Under way: no more wagers.' : 'Wagers taken till the off.'}`, '#e8d8b0');
    ev.data.races.forEach((r, k) => {
      const od = C.odds(L, i, ev, k);
      const won = r.result ? S.horses.find((h) => h.id === r.result[0]) : null;
      line(`${k + 1}. ${r.name}${won ? `  → won by ${won.name}` : ''}`, won ? '#8a7a62' : '#ffe070');
      for (const id of r.field) {
        const h = S.horses.find((q) => q.id === id);
        if (!h) continue;
        if (!ev.done && now < ev.s) row(`  ¤10 on ${h.name} (${h.jockey}, ${h.w} wins)`, `${od[id]}:1`, `bet:${k}:${id}:10`);
        else line(`  ${h.name} (${h.jockey})`, '#a89878');
      }
    });
  }
  const mine = C.mine(pid).bets.filter((b) => b.sid === sid && b.q === i && b.state === 'open');
  for (const b of mine) line(`Your wager: ¤${b.stake} on ${b.title} at ${b.odds}:1.`, '#80e070');
}

function theatreBoard(o) {
  const { L, i, S, C, line } = o;
  const ev = C.eventsOf(L, i).find((e) => e.type === 'play');
  line(ev ? `Tonight at ${clock(ev.s)}: "${ev.title}".` : 'Dark tonight: no play.', '#ffe070');
  for (const p of S.plays) line(` "${p.title}", a ${p.genre} in ${p.acts} acts by ${p.author}. ${p.shows} performances. ${p.fame >= 6 ? 'A triumph.' : p.fame >= 3 ? 'Well liked.' : 'New, or not much loved.'}`, '#a89878');
}

function auctionBoard(o) {
  const { L, i, C, now, line, row, pid } = o;
  const ev = C.eventsOf(L, i).find((e) => e.type === 'auction');
  if (!ev) {
    line('No auction today.', '#a89878');
    return;
  }
  line(`${ev.title}, ${clock(ev.s)}-${clock(ev.e)}. ${ev.done ? 'The hammer\'s fallen.' : now < ev.s ? 'Lots on view; bidding opens at the start.' : 'Bidding now!'}`, '#e8d8b0');
  ev.data.lots.forEach((lot, k) => {
    const base = Math.max(4, Math.round(price(lot.item) * 0.8));
    const cur = lot.bid ? lot.bid.amt : base;
    const mine = lot.bid && lot.bid.pid === pid;
    line(`${k + 1}. ${cap(lot.desc)}: ${lot.sold ? (lot.bid ? `sold to ${mine ? 'you' : 'another'} for ¤${lot.bid.amt}` : lot.sold === 'npc' ? 'sold' : 'not sold') : `¤${cur}${lot.bid ? (mine ? ' (yours)' : ' (another\'s)') : ''}`}`, mine ? '#80e070' : '#e8d8b0');
    if (!ev.done && now >= ev.s && !lot.sold && !mine) row(`  Bid ¤${cur + Math.max(2, Math.round(cur * 0.1))}`, '', `bid:${k}`);
  });
}

// The day's contracts (the guild's wants, or the delve's).
function contractsOf(game, L, q, day) {
  const r = new RNG(hash4(L.settlement.seed >>> 0, q.i, day, 0x14f));
  const pool = q.k === 'delve'
    ? [['relic_shard', 1, 40], ['old_coin', 3, 24], ['gem', 1, 30], ['bone', 6, 12], ['iron_ore', 6, 14], ['gold_ore', 2, 26]]
    : [['iron_ore', 8, 20], ['coal', 10, 16], ['gold_ore', 3, 22], ['cobblestone', 20, 10], ['log_oak', 10, 12], ['iron_ingot', 4, 22]];
  return r.shuffle(pool.filter(([k]) => ITEMS[k])).slice(0, 3).map(([item, n, pay]) => ({ item, n, pay: Math.round(pay * r.float(0.85, 1.25)) }));
}
function contractBoard(o) {
  const { game, L, q, line, row, pid, sid, i } = o;
  const list = contractsOf(game, L, q, game.day);
  line(q.k === 'delve' ? 'Wanted from below, paid on delivery:' : 'The guild wants, paid on delivery:', '#ffe070');
  list.forEach((ct, k) => {
    const done = o.C.mine(pid).seen[`${sid}:${i}:ct${k}`] === game.day;
    const have = countItem(game.player.inv, ct.item);
    row(`${ct.n} × ${ITEMS[ct.item].name.toLowerCase()} (you have ${have})`, done ? 'done' : `¤${ct.pay}`, `contract:${k}`, !done && have >= ct.n);
  });
  if (q.k === 'delve') {
    const S = o.S;
    line(`Lost below: ${(S.lost || []).length ? S.lost.slice(-4).map((x) => x.name).join(', ') : 'none yet'}.`, '#b0b8e0');
  }
}

function mercBoard(o) {
  const { L, i, row, line, game } = o;
  const swords = L.npcs.filter((r) => r.qtag === roleTag(i, 'sellsword') && alive(r));
  if (!swords.length) line('No swords for hire just now.', '#a89878');
  for (const r of swords) {
    const here = r.ent && !r.ent.dead && !r.ent.sleeping;
    const fee = 12 + (hash4(r.idx, 0x150) % 10);
    row(`${r.name.first} ${r.name.last}, ${r.equipment?.tool ? ITEMS[r.equipment.tool]?.name?.toLowerCase() || 'blade' : 'blade'} for a day`, `¤${fee}`, `hire:${r.idx}:${fee}`, here && !game.sim.careers.escort);
  }
  if (game.sim.careers.escort) line('(You already have someone with you.)', '#8a7a62');
}

// ------------------------------------------------------------ doing them
export function quarterAct(game, sid, i, act) {
  const L = game.sim.layoutOf(sid);
  const q = L && (L.quarters || [])[i];
  if (!q || !act) return;
  const c = ctxOf(game, L, q, game.player.x, game.player.y, game.player.z);
  const [k, a1, a2, a3, a4] = act.split(':');
  switch (k) {
    case 'collect': {
      const n = c.C.collect(c.pid, sid);
      if (n) {
        c.p.give('coin', n);
        say(c, `The bookmaker counts out your winnings: ¤${n}.`, '#80e070');
        c.game.audio?.play('coin');
      }
      break;
    }
    case 'buy': {
      const item = a1;
      const fee = +a2;
      const n = +(a3 || 1);
      if (!ITEMS[item] || !pay(c, fee, ITEMS[item].name.toLowerCase())) break;
      give(c, item, n);
      say(c, `Bought ${n > 1 ? `${n} × ` : ''}${ITEMS[item].name.toLowerCase()} for ¤${fee}.`, '#e8d8b0');
      break;
    }
    case 'bet': {
      const ev = c.C.eventsOf(L, i).find((e) => e.type === 'games' || e.type === 'races');
      if (!ev || ev.done || c.game.sim.abs >= ev.s) {
        say(c, 'No more wagers on that.', '#ff9060');
        break;
      }
      const sub = +a1;
      const pick = ev.type === 'games' ? a2 : +a2;
      const stake = +a3;
      if (!pay(c, stake, 'the wager')) break;
      const b = c.C.bet(c.pid, L, i, ev, sub, pick, stake);
      if (b) say(c, `The bookmaker chalks it up: ¤${stake} on ${b.title} at ${b.odds} to 1.`, '#ffe070');
      break;
    }
    case 'bid': {
      const ev = c.C.eventsOf(L, i).find((e) => e.type === 'auction');
      const lot = ev && ev.data.lots[+a1];
      if (!lot || lot.sold || ev.done) break;
      const base = Math.max(4, Math.round(price(lot.item) * 0.8));
      const cur = lot.bid ? lot.bid.amt : base;
      const amt = cur + Math.max(2, Math.round(cur * 0.1));
      if (coins(c) < amt) {
        say(c, `You haven't ¤${amt} to bid.`, '#ff9060');
        break;
      }
      // (Someone in the hall may go higher: up to what they'd give.)
      const theirs = Math.round(price(lot.item) * (0.9 + (hash4(ev.s, +a1, 0x151) % 100) / 100));
      if (theirs > amt) {
        lot.bid = { pid: 'npc', amt: Math.min(theirs, amt + Math.max(2, Math.round(amt * 0.1))) };
        say(c, `You bid ¤${amt}... and a merchant at the back raises it to ¤${lot.bid.amt}.`, '#ffb080');
      } else {
        lot.bid = { pid: c.pid, amt, name: c.game.playerName };
        say(c, `You bid ¤${amt}. The auctioneer looks round the hall... no one goes higher, yet.`, '#80e070');
      }
      break;
    }
    case 'fight': arenaFight(c); break;
    case 'study': study(c); break;
    case 'map': {
      if (!pay(c, 15, 'the map')) break;
      c.game.world.ow.markExplored(c.p.x, c.p.z, 7);
      for (const r of c.game.sim.dungeons.all) if (r && r.x !== undefined && Math.hypot(r.x - c.p.x, r.z - c.p.z) < 260) r.known = true;
      say(c, 'The cartographer copies out the country for days around, every road and ruin. (Your map is filled in round about.)', '#a0c8ff');
      break;
    }
    case 'candle': USE.candle_rack(c); break;
    case 'sellgems': case 'sellfinds': {
      const keys = k === 'sellgems' ? Object.keys(ITEMS).filter((x) => ITEMS[x].gem || x === 'pearl' || x === 'pearl_necklace') : ['old_coin', 'relic_shard', 'pottery', 'marble_bust'];
      let got = 0;
      for (const x of keys) {
        const n = countItem(c.p.inv, x);
        if (!n || !ITEMS[x]) continue;
        removeItem(c.p.inv, x, n);
        got += Math.round(price(x) * (k === 'sellgems' ? 0.9 : 1.1)) * n;
      }
      if (!got) {
        say(c, k === 'sellgems' ? 'You\'ve nothing the changer wants.' : 'You\'ve no finds to sell.', '#c8c8c8');
        break;
      }
      c.p.give('coin', got);
      c.game.audio?.play('coin');
      say(c, `Sold for ¤${got}.`, '#80e070');
      break;
    }
    case 'smelt': {
      const n = countItem(c.p.inv, 'iron_ore');
      if (!n) {
        say(c, 'You\'ve no iron ore to smelt.', '#c8c8c8');
        break;
      }
      const m = Math.min(n, coins(c));
      if (!m || !pay(c, m, 'the smelting')) break;
      removeItem(c.p.inv, 'iron_ore', m);
      give(c, 'iron_ingot', m);
      say(c, `Your ore goes in with the furnace's charge. ${m} iron ingot${m > 1 ? 's' : ''} come out of the pour.`, '#ffb060');
      break;
    }
    case 'drill': {
      if (!once(c, 'drill')) {
        say(c, 'The drillmaster\'s had enough of you for one day.', '#c8c8c8');
        break;
      }
      gainMastery(c.game, 'dueling', 1);
      buff(c, 'str', 1, 4, 'Drilled');
      say(c, 'Shield up, step, thrust, again, again: an hour in the yard with the garrison. Your arms are lead, and you\'re the better for it. (Strength +1 for 4 hours.)', '#e8d8b0');
      break;
    }
    case 'bathe': {
      if (!pay(c, 2, 'the baths')) break;
      c.p.hp = c.p.maxHp;
      buff(c, 'end', 1, 6, 'Bathed');
      say(c, 'Hot water, then cold, then hot again; the dirt of the road comes away and your aches with it. (Endurance +1 for 6 hours.)', '#a0e0ff');
      break;
    }
    case 'rub': USE.massage_table(c); break;
    case 'ticket': {
      if (!pay(c, 3, 'a seat')) break;
      c.C.mine(c.pid).ticket = { sid, i, day: c.day };
      say(c, 'A seat for tonight\'s play. Be in by the curtain.', '#ffe070');
      break;
    }
    case 'striker': USE.high_striker(c); break;
    case 'fortune': fortune(c); break;
    case 'taste': tasting(c); break;
    case 'meditate': USE.meditation_mat(c); break;
    case 'omen': if (pay(c, 2, 'an omen')) omen(c); break;
    case 'kit': {
      if (!pay(c, 4, 'the kit')) break;
      give(c, 'torch', 3);
      give(c, 'string', 1);
      say(c, 'Three torches and a rope. "Bring the rope back," says the guildmaster. Nobody ever does.', '#e8d8b0');
      break;
    }
    case 'contract': {
      const ct = contractsOf(c.game, L, q, c.day)[+a1];
      if (!ct || countItem(c.p.inv, ct.item) < ct.n || !once(c, `ct${a1}`)) break;
      removeItem(c.p.inv, ct.item, ct.n);
      c.p.give('coin', ct.pay);
      c.game.audio?.play('coin');
      c.game.sim.addRenown(sid, 2, q.k === 'delve' ? 'filled a contract for the delvers' : 'filled a contract for the guild');
      say(c, `Delivered: ${ct.n} × ${ITEMS[ct.item].name.toLowerCase()}. ¤${ct.pay}, and a nod from the ${q.k === 'delve' ? 'guildmaster' : 'guild'}.`, '#80e070');
      break;
    }
    case 'hire': {
      const r = L.npcs[+a1];
      if (r && r.ent && !r.ent.dead) hireSword(c, r.ent, +a2);
      break;
    }
    default: break;
  }
  void a4;
}

// A sellsword taken on for a day: as a guard's hired (see Careers.hire).
function hireSword(c, n, fee) {
  const car = c.game.sim.careers;
  if (car.escort) {
    say(c, 'You\'ve someone with you already.', '#ff9060');
    return;
  }
  if (c.game.isWanted(c.sid)) {
    say(c, `"Not with the watch after you, friend."`, '#ff9060');
    return;
  }
  if (!pay(c, fee, 'the sellsword')) return;
  n.rec.coins = (n.rec.coins || 0) + Math.ceil(fee * 0.8);
  car.escort = { sid: c.sid, idx: n.rec.idx, name: n.name, until: c.game.sim.abs + 24 * 60, fee, hours: 24 };
  car.attach(n);
  ledger(c.L, c.day, `${n.rec.name.first} the sellsword was hired by ${c.game.playerName}.`);
  n.say(n.rng.pick(['Lead on. I\'ll watch your back.', 'For a day, then. Point me at them.', 'Coin first, then the killing. Good.']), 3);
}

// ------------------------------------------------------------ the arena
// Onto the sands against one of the school: during the games, before the
// crowd, for a purse and your name; any other time, a bout before the
// school, for a little.
function arenaFight(c) {
  const q = c.q;
  const g = c.game;
  if (g.duel || g.sim.war.live) {
    say(c, 'Not now.', '#c8c8c8');
    return;
  }
  const pit = q.pit;
  if (!pit) return;
  // (The one nearest your name in the roster: the crowd likes a match.)
  const fame = c.C.fameOf(c.pid, c.sid);
  const cands = c.L.npcs.filter((r) => r.qtag === roleTag(c.i, 'gladiator') && alive(r) && r.ent && !r.ent.dead && !r.ent.sleeping);
  if (!cands.length) {
    say(c, 'None of the school\'s fighters is about. Come back when they\'re training.', '#c8c8c8');
    return;
  }
  const target = 0.4 + Math.max(-0.2, Math.min(0.5, fame * 0.05));
  const skillOf = (r) => {
    const f = c.S.roster.find((o) => o.rec === r.idx);
    return f ? f.skill : 0.5;
  };
  cands.sort((a, b) => Math.abs(skillOf(a) - target) - Math.abs(skillOf(b) - target));
  const r = cands[0];
  const n = r.ent;
  const w = g.world;
  const py = w.findStandY(pit.cx - 2, pit.cz, GROUND + 2);
  const ny = w.findStandY(pit.cx + 2, pit.cz, GROUND + 2);
  c.p.teleport(pit.cx - 2, py > 0 ? py : GROUND, pit.cz);
  n.teleport(pit.cx + 2, ny > 0 ? ny : GROUND, pit.cz);
  // (Fighting fit, as the school keeps them.)
  n.hp = n.maxHp;
  const games = c.C.eventsOf(c.L, c.i).find((e) => e.type === 'games' && c.game.sim.abs >= e.s && c.game.sim.abs < e.e);
  const f = c.S.roster.find((o) => o.rec === r.idx);
  g.startDuel(n, 0, { arena: { sid: c.sid, i: c.i, fid: f ? f.id : null, games: !!games, name: f ? f.name : n.name } });
  tellNear(g, pit.cx, pit.cz, 40, games ? `The crowd roars: ${g.playerName} against ${f ? f.name : n.name}!` : `A bout before the school: you against ${f ? f.name : n.name}.`, '#ffe070');
  g.audio?.play(games ? 'cheer' : 'gong', n);
}

// How it went (see Game.endDuel).
export function arenaBoutDone(game, d, result) {
  const A = d.arena;
  const L = game.sim.layoutOf(A.sid);
  if (!L) return;
  const C = game.sim.cities;
  const S = C.stateOf(L, A.i);
  const pid = pidOf(game.player);
  const P = C.mine(pid);
  P.arena ||= {};
  const rec = (P.arena[A.sid] ||= { w: 0, l: 0 });
  const f = S && A.fid !== null ? fighterOf(S, A.fid) : null;
  const pit = L.quarters[A.i].pit;
  if (result === 'won') {
    rec.w++;
    const fame = C.addFame(pid, A.sid, A.games ? 2 : 1);
    const purse = A.games ? 20 + fame * 3 : 6;
    game.player.give('coin', purse);
    if (f) {
      f.l = (f.l || 0) + 1;
      f.fame = Math.max(-5, (f.fame || 0) - 1);
    }
    game.ui.msg(`${A.games ? 'The crowd is on its feet!' : 'The school applauds.'} You beat ${f ? f.name : 'your foe'}: ¤${purse}.`, '#a0ffa0');
    if (pit) tellNear(game, pit.cx, pit.cz, 40, `${game.playerName} wins on the sands!`, '#ffe070');
    game.audio?.play('cheer');
    // (Beat the champion, before the crowd: the arena's yours.)
    if (A.games && f && f.id === S.champ) {
      game.player.give('laurel_wreath', 1);
      const text = `${game.playerName} beat ${f.name}, the champion, before the whole arena at ${L.settlement.name}.`;
      hearNews(L, L.settlement.name, [text], game.day);
      ledger(L, game.day, text);
      game.sim.cities.spread(L, [text], game.day, game.sim.abs);
      game.ui.msg('You beat the champion! The crowd throws flowers, and someone crowns you with laurels.', '#ffd070');
    } else if (fame === 4 || fame === 8) {
      const text = fame >= 8 ? `They say ${game.playerName} is the finest fighter the arena at ${L.settlement.name} has seen.` : `${game.playerName} is the crowd's new favourite at the arena of ${L.settlement.name}.`;
      hearNews(L, L.settlement.name, [text], game.day);
      ledger(L, game.day, text);
    }
  } else if (result === 'lost') {
    rec.l++;
    C.addFame(pid, A.sid, A.games ? -1 : 0);
    if (f) {
      f.w = (f.w || 0) + 1;
      f.fame = (f.fame || 0) + (A.games ? 2 : 1);
    }
    game.ui.msg(`${f ? f.name : 'Your foe'} has you down. ${A.games ? 'The crowd jeers, then cheers the winner.' : '"Again tomorrow," says the lanista.'}`, '#ffb080');
  }
}

// ------------------------------------------------------------ live shows
// A quarter's doings, played out where the players can see them (on the
// host: see Game.update). `game.cityLive`: by `sid:i`, each show's state
// (the arena's bouts, the races, the play), and the crowd's excitement
// (see acts.showAt).
export function cityUpdate(game, dt) {
  game.cityLive ||= new Map();
  game.cityT = (game.cityT || 0) - dt;
  const tick = game.cityT <= 0;
  if (tick) game.cityT = 1;
  const players = partyPlayers(game);
  if (tick) {
    const seen = new Set();
    for (const a of game.active.values()) {
      const L = a.layout;
      if (!L || !(L.quarters || []).length) continue;
      const C = game.sim.cities;
      const now = game.sim.abs;
      for (const q of L.quarters) {
        // (Settled as it starts, played out to its end.)
        const ev = C.eventsOf(L, q.i).find((e) => now >= e.s && now < e.e) || null;
        const key = `${L.settlement.id}:${q.i}`;
        const by = ev && players.some((p) => Math.hypot(p.x - q.at.x, p.z - q.at.z) < 48 && !p.dead);
        if (!by) continue;
        seen.add(key);
        if (!game.cityLive.has(key) || game.cityLive.get(key).ev !== ev) game.cityLive.set(key, startShow(game, L, q, ev));
      }
      // (In the water: the baths ease you.)
    }
    for (const [k, sh] of game.cityLive) {
      if (seen.has(k)) continue;
      endShow(game, sh);
      game.cityLive.delete(k);
    }
    for (const p of players) {
      const w = game.world;
      if (w.getBlock(p.x, p.y, p.z) === B.bath_water || w.getBlock(p.x, p.y - 1, p.z) === B.bath_water) {
        if (p.hp < p.maxHp) p.hp = Math.min(p.maxHp, p.hp + 1);
        if (Math.random() < 0.3) game.renderer.emit(p.x, p.y + 1, p.z, { n: 2, color: ['#eceef4', '#d0d4dc'], shape: 'puff', grow: 3, up: 10, life: 1.6, gravity: -8, oy: -2 });
      }
    }
    for (const p of players) raceTrial(game, p);
  }
  for (const sh of game.cityLive.values()) {
    sh.hype = Math.max(0, (sh.hype || 0) - dt * 0.4);
    const f = SHOW[sh.ev.type];
    if (f && f.update) f.update(game, sh, dt);
  }
}

function startShow(game, L, q, ev) {
  const sh = { L, q, ev, t: 0, hype: 0.3, cries: null };
  ev.live = true;
  const f = SHOW[ev.type];
  tellNear(game, q.at.x, q.at.z, 48, `${ev.title} at ${q.name}${ev.type === 'play' ? '' : ' is under way'}.`, '#ffe070');
  if (f && f.start) f.start(game, sh);
  return sh;
}
function endShow(game, sh) {
  const f = SHOW[sh.ev.type];
  if (f && f.end) f.end(game, sh);
  sh.ev.live = false;
}

// Where the stage is (its middle, its floor, and which way it faces: to
// the way in, where the house is).
function stageOf(q) {
  const s = q.stage;
  if (!s) return null;
  const cx = Math.round((s.x0 + s.x1) / 2);
  const cz = Math.round((s.z0 + s.z1) / 2);
  const g = (q.gates && q.gates[0]) || q.at;
  const dx = g.x - cx;
  const dz = g.z - cz;
  const face = Math.abs(dx) >= Math.abs(dz) ? (dx > 0 ? 3 : 1) : dz > 0 ? 0 : 2;
  return { ...s, cx, cz, face };
}

// Each kind of doings' own show.
const SHOW = {
  games: {
    // The bouts in turn, the school's own fighters on the sands (or the
    // condemned brought up from the cells), the result as it's settled.
    start(game, sh) {
      const { L, q, ev } = sh;
      game.sim.cities.settle(L, q.i, ev);
      ev.live = true;
      sh.k = -1;
      sh.cries = ['Huzzah!', 'Blood! Blood!', 'Get up! GET UP!', 'Mercy! Mercy!', 'Did you see that?!', 'Kill! ...No, spare them!'];
      sh.next = 2;
      game.audio?.play('horn', { x: q.at.x, y: GROUND, z: q.at.z });
    },
    update(game, sh, dt) {
      const { L, q, ev } = sh;
      const pit = q.pit;
      if (!pit) return;
      sh.next -= dt;
      const S = game.sim.cities.stateOf(L, q.i);
      if (sh.bout) {
        const b = sh.bout;
        b.t += dt;
        // Blow and counter-blow, the sand flying.
        if (b.t >= b.blowAt) {
          b.blowAt = b.t + 0.45 + Math.random() * 0.5;
          const [hit, by] = Math.random() < 0.5 ? [b.a, b.b] : [b.b, b.a];
          if (by && !by.dead) {
            by.face(hit.x, hit.z);
            by.doAction(0.3);
          }
          if (hit && !hit.dead) {
            hit.flash = 0.1;
            game.renderer.emit(hit.x, hit.y + 1, hit.z, { n: 5, color: ['#d8c088', '#c8a060', '#ffffff'], up: 16, speed: 30, life: 0.4, gravity: 90, oy: -4 });
            if (Math.random() < 0.3) game.renderer.emit(hit.x, hit.y + 1, hit.z, { n: 3, color: ['#c02020', '#801010'], up: 10, speed: 20, life: 0.4, gravity: 120, oy: -6 });
          }
          game.audio?.play(Math.random() < 0.5 ? 'clang' : 'hit', hit);
          sh.hype = Math.min(1.5, sh.hype + 0.15);
        }
        if (b.t >= b.dur) {
          // The end of it: the loser down on one knee, the winner's arms up.
          const win = b.won === 'a' ? b.a : b.b;
          const lose = b.won === 'a' ? b.b : b.a;
          if (lose && !lose.dead) lose.kneelT = 3;
          if (win && !win.dead) {
            win.doAction(0.6);
            win.say(win.rng.pick(['VICTORY!', 'Who\'s next?!', 'For the crowd!']), 2.5, '#ffe070');
          }
          tellNear(game, pit.cx, pit.cz, 48, `${b.names[b.won === 'a' ? 0 : 1]} wins${b.kind === 'freedom' && b.won === 'b' ? ', and is one bout nearer freedom' : ''}!`, '#ffe070');
          game.audio?.play('cheer', win || { x: pit.cx, y: GROUND, z: pit.cz });
          sh.hype = 1.8;
          const done = sh.bout;
          sh.bout = null;
          sh.next = 6;
          setTimeout(() => {
            letGo(done.a);
            letGo(done.b);
          }, 3500);
        }
        return;
      }
      if (sh.next > 0) return;
      sh.k++;
      const bt = ev.data.bouts[sh.k];
      if (!bt) {
        sh.next = 999;
        return;
      }
      const A = fighterOf(S, bt.a);
      const Bf = fighterOf(S, bt.b);
      // (Two of the school to stand for them: whoever's named, if they're
      // here; the others are the school's too.)
      const school = L.npcs.filter((r) => r.qtag === roleTag(q.i, 'gladiator') && alive(r) && r.ent && !r.ent.dead).map((r) => r.ent);
      const entOf = (f, not) => (f && f.rec !== undefined && L.npcs[f.rec] && L.npcs[f.rec].ent && !L.npcs[f.rec].ent.dead ? L.npcs[f.rec].ent : school.find((e) => e !== not) || null);
      const a = entOf(A, null);
      const b = entOf(Bf, a);
      const names = [A ? A.name : 'a fighter', Bf ? Bf.name : 'one of the condemned'];
      tellNear(game, pit.cx, pit.cz, 48, `Bout ${sh.k + 1}: ${names[0]} against ${names[1]}${bt.kind === 'title' ? ', for the title' : bt.kind === 'freedom' ? `, condemned${Bf && Bf.crime ? ` for ${Bf.crime}` : ''}, fighting for freedom` : ''}!`, '#ffe070');
      game.audio?.play('gong', { x: pit.cx, y: GROUND, z: pit.cz });
      if (!a || !b) {
        // (Nobody to stand for them: the result's called from the sands.)
        sh.next = 4;
        tellNear(game, pit.cx, pit.cz, 48, `${names[bt.result === 'a' ? 0 : 1]} wins!`, '#ffe070');
        return;
      }
      const w = game.world;
      const ya = w.findStandY(pit.cx - 1, pit.cz, GROUND + 2);
      const yb = w.findStandY(pit.cx + 1, pit.cz, GROUND + 2);
      for (const [e, x, y, f] of [[a, pit.cx - 1, ya, 3], [b, pit.cx + 1, yb, 1]]) {
        e.teleport(x, y > 0 ? y : GROUND, pit.cz);
        holdAt(game, e, q.i, 20, f);
      }
      a.face(b.x, b.z);
      b.face(a.x, a.z);
      sh.bout = { a, b, t: 0, blowAt: 1.2, dur: 9 + Math.random() * 5, won: bt.result || 'a', names, kind: bt.kind };
    },
    end(game, sh) {
      void game;
      if (sh.bout) {
        letGo(sh.bout.a);
        letGo(sh.bout.b);
      }
    },
  },
  races: {
    // The horses round the course, in their silks, the order they finish
    // in as it's settled; the crowd up as they come round the last bend.
    start(game, sh) {
      const { L, q, ev } = sh;
      game.sim.cities.settle(L, q.i, ev);
      ev.live = true;
      sh.k = -1;
      sh.next = 3;
      sh.cries = ['Come on, come ON!', 'Go on, my beauty!', 'He\'s fading!', 'Neck and neck!', 'Whip him up!'];
      game.audio?.play('horn', { x: q.at.x, y: GROUND, z: q.at.z });
    },
    update(game, sh, dt) {
      const { L, q, ev } = sh;
      const tr = q.track;
      if (!tr || !tr.pts.length) return;
      sh.next -= dt;
      const S = game.sim.cities.stateOf(L, q.i);
      if (sh.race) {
        const R = sh.race;
        R.t += dt;
        let done = true;
        for (const h of R.horses) {
          if (h.c.dead) continue;
          const f = Math.min(1, R.t / h.T);
          if (f < 1) done = false;
          // (Eased out of the gates, a burst at the end for the winner.)
          const e = f < 0.15 ? (f / 0.15) ** 2 * 0.15 : f;
          const idx = Math.min(R.len - 1, Math.floor(e * (R.len - 1)));
          if (idx !== h.idx && h.c.moveT >= 1) {
            h.idx = idx;
            const pt = R.path[(R.i0 + idx) % tr.pts.length];
            const lx = pt.x + h.lane.x;
            const lz = pt.z + h.lane.z;
            h.c.face(lx, lz);
            h.c.startMove(lx, GROUND, lz, Math.max(0.08, (h.T / R.len) * 0.9));
            if (Math.random() < 0.3) game.renderer.emit(h.c.x, GROUND, h.c.z, { n: 2, color: ['#b89868', '#a88858'], up: 10, speed: 12, life: 0.5, gravity: 60, glow: false, oy: 4 });
          }
          if (f >= 1 && !h.home) {
            h.home = true;
            R.order.push(h);
            if (R.order.length === 1) {
              tellNear(game, q.at.x, q.at.z, 60, `${h.name} wins ${R.name}!`, '#ffe070');
              game.audio?.play('cheer', h.c);
              sh.hype = 1.8;
            }
          }
        }
        if (R.t > R.T0 * 0.75) sh.hype = Math.min(1.6, sh.hype + dt * 0.5);
        if (done && R.t > R.T0 + 2) {
          for (const h of R.horses) h.c.dead = true;
          sh.race = null;
          sh.next = 8;
        }
        return;
      }
      if (sh.next > 0) return;
      sh.k++;
      const r = ev.data.races[sh.k];
      if (!r) {
        sh.next = 999;
        return;
      }
      const result = r.result || r.field;
      // The way round from the start: the nearest point to the gates on.
      const pts = tr.pts;
      let i0 = 0;
      let bd = Infinity;
      pts.forEach((p, k) => {
        const d = Math.hypot(p.x - tr.start.x, p.z - tr.start.z);
        if (d < bd) {
          bd = d;
          i0 = k;
        }
      });
      const len = tr.loop ? pts.length + 1 : pts.length;
      const c0 = q.at;
      const T0 = Math.max(14, len * 0.16);
      const horses = result.map((id, place) => {
        const hd = S.horses.find((o) => o.id === id);
        const p = pts[i0];
        // (Each in a lane of its own, out from the middle or in.)
        const rx = p.x - c0.x;
        const rz = p.z - c0.z;
        const rl = Math.hypot(rx, rz) || 1;
        const off = (place % 3) - 1;
        const lane = tr.loop ? { x: Math.round((rx / rl) * off), z: Math.round((rz / rl) * off) } : { x: 0, z: off };
        const c = new Creature(game, 'horse', p.x + lane.x, GROUND, p.z + lane.z, (hd ? hd.silks : place) % 3);
        c.dormant = true;
        c.saddled = true;
        c.banner = SILKS[(hd ? hd.silks : place) % SILKS.length][0];
        c.racer = true;
        game.addCreature(c);
        return { c, id, name: hd ? hd.name : 'a horse', T: T0 + place * (0.6 + Math.random() * 0.5), idx: 0, lane, home: false };
      });
      sh.race = { horses, t: -3, T0, len, i0, path: pts, order: [], name: r.name };
      tellNear(game, q.at.x, q.at.z, 60, `${r.name}: they're under starter's orders... and they're OFF!`, '#ffe070');
      game.audio?.play('horn', { x: tr.start.x, y: GROUND, z: tr.start.z });
    },
    end(game, sh) {
      if (sh.race) for (const h of sh.race.horses) h.c.dead = true;
      sh.race = null;
    },
  },
  play: {
    // The players on the stage, the lines of the play (of its kind), the
    // house's cheers (or jeers) at the curtain.
    start(game, sh) {
      const { L, q, ev } = sh;
      game.sim.cities.settle(L, q.i, ev);
      ev.live = true;
      sh.next = 6;
      sh.line = 0;
      sh.cries = ev.data.reception === 'cheers' ? ['Bravo!', 'Encore!', 'Oh, the poor thing...', 'Ha!'] : ['Boo!', 'Get off!', 'Rubbish!', 'Zzz...'];
      game.audio?.play('chime', { x: q.at.x, y: GROUND, z: q.at.z });
    },
    update(game, sh, dt) {
      const { L, q, ev } = sh;
      sh.next -= dt;
      if (sh.next > 0) return;
      const st = stageOf(q);
      const cast = L.npcs.filter((r) => r.qtag === roleTag(q.i, 'actor') && alive(r) && r.ent && !r.ent.dead).map((r) => r.ent);
      const lines = PLAY_LINES[ev.data.genre] || PLAY_LINES.comedy;
      if (sh.line >= 8 || !cast.length) {
        if (!sh.bowed) {
          sh.bowed = true;
          for (const a of cast) a.doAction(0.6);
          tellNear(game, q.at.x, q.at.z, 40, ev.data.reception === 'cheers' ? 'The curtain falls to cheers. The players bow, and bow again.' : 'The curtain falls. Somebody throws a cabbage.', ev.data.reception === 'cheers' ? '#a0ffa0' : '#ffb080');
          game.audio?.play(ev.data.reception === 'cheers' ? 'cheer' : 'reveal_poor', st ? { x: st.cx, y: GROUND, z: st.cz } : q.at);
          setTimeout(() => cast.forEach(letGo), 4000);
          sh.hype = 1.6;
          // (A seat taken for tonight: an evening well spent.)
          for (const p of partyPlayers(game)) {
            const P = game.sim.cities.mine(pidOf(p));
            if (P.ticket && P.ticket.sid === L.settlement.id && P.ticket.day === game.day && Math.hypot(p.x - q.at.x, p.z - q.at.z) < 30) {
              P.ticket = null;
              game.asPlayer(p, () => {
                const c = { p, game: game };
                buff(c, 'cha', 1, 8, 'A night at the theatre');
                game.ui.msg('A good night out. (Charisma +1 for 8 hours.)', '#ffe070');
              });
            }
          }
        }
        sh.next = 999;
        return;
      }
      const a = cast[sh.line % cast.length];
      if (st && !(a.rec.override && a.rec.override.tag === 'perform')) {
        const x = st.cx + (sh.line % 3) - 1;
        const y = game.world.findStandY(x, st.cz, (st.y ?? GROUND) + 1);
        a.teleport(x, y > 0 ? y : GROUND, st.cz);
        holdAt(game, a, q.i, Math.max(10, ev.e - game.sim.abs), st.face);
      }
      a.doAction(0.5);
      a.say(lines[(sh.line + hash4(ev.s, 0x152)) % lines.length], 4.5, '#ffe8c0');
      sh.line++;
      sh.next = 6 + Math.random() * 3;
      sh.hype = Math.min(1.2, sh.hype + 0.3);
    },
  },
  service: {
    start(game, sh) {
      game.audio?.play('bell', { x: sh.q.at.x, y: GROUND, z: sh.q.at.z });
      sh.next = 8;
    },
    update(game, sh, dt) {
      sh.next -= dt;
      if (sh.next > 0) return;
      sh.next = 14 + Math.random() * 10;
      const cl = sh.L.npcs.find((r) => r.qtag === roleTag(sh.q.i, 'cleric') && alive(r) && r.ent && !r.ent.dead);
      const S = game.sim.cities.stateOf(sh.L, sh.q.i);
      if (cl) cl.ent.say(cl.ent.rng.pick([`Blessed be ${S.god || 'the Light'}.`, 'Let us pray.', 'Lift up your hearts.', `Remember Saint ${S.saint || 'Aldo'}, who gave all.`, 'Go in peace.']), 4, '#ffe8a0');
      game.renderer.emit(sh.q.at.x, GROUND + 3, sh.q.at.z, { n: 6, color: ['#ff9ad0', '#9ad0ff', '#ffe08a'], shape: 'note', up: 20, speed: 14, gravity: -6, life: 2, spreadX: 8 });
    },
  },
  casting: {
    start(game, sh) {
      sh.next = 4;
      game.audio?.play('horn', { x: sh.q.at.x, y: GROUND, z: sh.q.at.z });
    },
    update(game, sh, dt) {
      sh.next -= dt;
      if (sh.next > 0) return;
      sh.next = 0.5;
      for (const f of sh.q.fx) {
        if (f.kind !== 'furnace' && f.kind !== 'pour') continue;
        game.renderer.emit(f.x, f.y + 1, f.z, { n: 6, color: ['#ff7a2a', '#ffb03a', '#ffe48a'], up: 30, speed: 24, gravity: 80, life: 0.7, glow: true });
      }
      if (Math.random() < 0.2) game.audio?.play('pour', sh.q.at);
      sh.hype = 0.8;
    },
  },
  launch: {
    start(game, sh) {
      sh.next = 20;
      game.audio?.play('ship_bell', { x: sh.q.at.x, y: GROUND, z: sh.q.at.z });
    },
    update(game, sh, dt) {
      sh.next -= dt;
      if (sh.next > 0 || sh.done) return;
      sh.done = true;
      const S = game.sim.cities.stateOf(sh.L, sh.q.i);
      tellNear(game, sh.q.at.x, sh.q.at.z, 48, 'The chocks are knocked out... and she slides down the slip into the water! The yard cheers.', '#ffe070');
      game.audio?.play('cheer', sh.q.at);
      game.audio?.play('splash', sh.q.at);
      sh.hype = 1.8;
      void S;
    },
  },
  gathering: {
    start(game, sh) {
      sh.next = 3;
      game.audio?.play('war_drums', { x: sh.q.at.x, y: GROUND, z: sh.q.at.z });
    },
    update(game, sh, dt) {
      sh.next -= dt;
      if (sh.next > 0) return;
      sh.next = 0.4;
      game.renderer.emit(sh.q.at.x, GROUND + 1, sh.q.at.z, { n: 4, color: ['#ff7a2a', '#ffb03a', '#ffe48a'], up: 40, speed: 14, gravity: -30, life: 1.2, glow: true });
      sh.hype = 0.6;
    },
  },
};

// ------------------------------------------------------------ the course
// Your own lap of a racecourse on your own horse: from the gates round to
// the winning post, against the clock (the course record kept on the post).
function raceTrial(game, p) {
  const P = game.sim.cities.mine(pidOf(p));
  const mounted = p.mount && p.mount.kind === 'horse';
  const h = quarterHere(game, p.x, p.z);
  const q = h && h.q.k === 'racecourse' ? h.q : null;
  const tr = q && q.track;
  if (!tr || !tr.loop || !mounted) {
    if (P.trial && (!mounted || !q)) P.trial = null;
    return;
  }
  const at = (pt, r) => Math.hypot(p.x - pt.x, p.z - pt.z) <= r;
  const t = game.sim.abs;
  if (!P.trial) {
    if (at(tr.start, 2)) {
      P.trial = { sid: h.L.settlement.id, i: q.i, t0: performance.now(), far: false };
      game.asPlayer(p, () => game.ui.msg('Off from the gates! Round the course to the winning post.', '#ffe070'));
    }
    return;
  }
  const far = tr.pts.reduce((a, b) => (Math.hypot(b.x - tr.start.x, b.z - tr.start.z) > Math.hypot(a.x - tr.start.x, a.z - tr.start.z) ? b : a));
  if (at(far, 3)) P.trial.far = true;
  if (P.trial.far && at(tr.finish, 2)) {
    const secs = (performance.now() - P.trial.t0) / 1000;
    P.trial = null;
    const S = game.sim.cities.stateOf(h.L, q.i);
    const best = !S.trial || secs < S.trial.secs;
    if (best) S.trial = { secs, name: game.playerName, horse: p.mount.name || 'their horse', day: game.day };
    game.asPlayer(p, () => game.ui.msg(best ? `A lap in ${secs.toFixed(1)}s: a new course record! They'll chalk it on the post.` : `A lap in ${secs.toFixed(1)}s. The record's ${S.trial.secs.toFixed(1)}s.`, best ? '#ffd070' : '#e8d8b0'));
    if (best) game.audio?.play('fanfare');
  }
  void t;
}

// What a quarter's sign says (see Game.signText).
export function quarterSign(L, q) {
  const C = L.sim && L.sim.cities;
  const ev = C ? C.next(L, q.i) || C.current(L, q.i) : null;
  return `${q.name}${ev ? ` | ${ev.title}, ${clock(ev.s)}` : ''}`;
}

export { BLOCKS };
