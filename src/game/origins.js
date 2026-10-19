// (Round 123) Three more ways a story can begin:
//   - a leader: already at the head of a town on Thessa (governed under the
//     charter they chose), or ruling a whole realm from its capital (under
//     the form of government they chose), from the first morning;
//   - a brigand: ashore at the Black Gull Brethren's haven by their cove,
//     sworn to the brethren and known among them, a sloop of their own at
//     anchor off the beach with a hand or two aboard, and the realms
//     nearest the cove knowing their name, and not kindly;
//   - an outworlder: crawling out of an escape pod that fell burning out
//     of the sky into the wilds of Thessa, far from any town.
// Where each begins (originSpot), what's made ready for them there
// (originSetup, as them), and their first words (originIntroduce).
import { RNG, hash4 } from '../util/rng.js';
import { GROUND, REGION_W, REGION_D } from '../config.js';
import { B } from '../world/blocks.js';
import { leadOf } from './hero.js';
import { makeCrater } from './starfall.js';
import { covesOf, GUILDS } from './pirates.js';
import { piracyOf, PIRATE_AT } from './piracy.js';
import { addShip, waterSpot, ownerId } from './ships3d.js';
import { makeCrew } from './shipcrew.js';
import { CHARTERS, charterFits } from '../sim/charters.js';
import { REALM_FORMS } from '../sim/realmforms.js';
import { pidOf } from '../sim/saga/refs.js';

export const NEW_ORIGINS = ['leader', 'brigand', 'outworlder'];
export const isNewOrigin = (h) => !!h && NEW_ORIGINS.includes(h.origin);
// (The realms a brigand's known to: their towns think the worse of them,
// their warships come for them on sight.)
export const INFAMY = -25;
const SLOOPS = ['The Gallows Kiss', 'The Salt Widow', 'The Black Wager', 'The Grinning Gull', 'The Drowned Crown', 'The Rattlebone'];

const live = (s) => s && s.condition !== 'abandoned' && !s.deserted && s.type !== 'camp';
const mid = (s) => ({ x: (s.cx + s.cw / 2) * REGION_W, z: (s.cz + s.cd / 2) * REGION_D });
function saltOf(hero, salt) {
  let k = salt >>> 0;
  for (const ch of String((hero && hero.name) || '')) k = (k * 31 + ch.charCodeAt(0)) >>> 0;
  return k;
}

// ------------------------------------------------------------ where
export function originSpot(game, hero, salt = 0) {
  if (!hero) return null;
  if (hero.origin === 'leader') return leaderSpot(game, hero, salt);
  if (hero.origin === 'brigand') return brigandSpot(game);
  if (hero.origin === 'outworlder') return podSpot(game, hero, salt);
  return null;
}

// A town of Thessa no one playing governs yet (a town or a city if there
// is one); or a realm's capital, a realm no one playing rules.
function leaderSpot(game, hero, salt) {
  const ow = game.world.ow;
  const sim = game.sim;
  const lead = leadOf(hero);
  const rng = new RNG(hash4(game.seed >>> 0, saltOf(hero, salt), 0x1ead));
  const thessa = ow.islands[0];
  const free = (s) => live(s) && !(sim.office && sim.office.of(s.id) && sim.office.of(s.id).holder);
  let s = null;
  let civ = null;
  if (lead.scope === 'realm') {
    const realms = sim.realms;
    const list = rng.shuffle(realms.civs.filter((c) => realms.members(c).length >= 2 && !(sim.crown && sim.crown.ruled(c)) && free(realms.capitalOf(c))));
    // (One whose seat is on Thessa, where every story starts, if any.)
    civ = list.find((c) => realms.capitalOf(c).island === thessa.key) || list[0] || null;
    s = civ ? realms.capitalOf(civ) : null;
  }
  if (!s) {
    const towns = ow.settlements.filter((q) => free(q) && q.island === thessa.key);
    const big = towns.filter((q) => q.type === 'town' || q.type === 'city');
    s = rng.pick(big.length ? big : towns.length ? towns : ow.settlements.filter(free)) || null;
    civ = null;
  }
  if (!s) return null;
  const L = game.world.getLayout(s);
  const x = L && L.plaza ? L.plaza.cx + 2 : Math.floor(mid(s).x);
  const z = L && L.plaza ? L.plaza.cz : Math.floor(mid(s).z);
  return { kind: 'leader', x, z, sid: s.id, civ: civ ? civ.id : null, scope: civ ? 'realm' : 'town', style: civ ? lead.style : lead.scope === 'town' ? lead.style : 'council' };
}

// The beach by the Black Gulls' cove: a few paces up from the waterline,
// facing the sea.
function brigandSpot(game) {
  const cove = covesOf(game)[0];
  if (!cove) return null;
  const ow = game.world.ow;
  const land = (ow.lands || []).find((q) => q.name === cove.land);
  const cx = land ? (land.x0 + land.x1) / 2 : cove.shore.x;
  const cz = land ? (land.z0 + land.z1) / 2 : cove.shore.z;
  let dx = cx - cove.shore.x;
  let dz = cz - cove.shore.z;
  const d = Math.hypot(dx, dz) || 1;
  dx /= d;
  dz /= d;
  const w = game.world;
  for (let r = 0; r < 40; r++) {
    const x = Math.round(cove.shore.x + dx * r);
    const z = Math.round(cove.shore.z + dz * r);
    game.loadAround(x, z, true);
    const y = w.findStandY(x, z, GROUND);
    if (y <= 0 || w.isWaterAt(x, y - 1, z) || w.isWaterAt(x, y, z)) continue;
    // (A few paces further up the beach: room for the haven.)
    const ux = Math.round(x + dx * 4);
    const uz = Math.round(z + dz * 4);
    return { kind: 'brigand', x: ux, z: uz, dx, dz, cove: { name: cove.name, guild: cove.guild ?? 0, x: cove.x, z: cove.z, land: cove.land } };
  }
  return { kind: 'brigand', x: Math.round(cove.shore.x + dx * 6), z: Math.round(cove.shore.z + dz * 6), dx, dz, cove: { name: cove.name, guild: cove.guild ?? 0, x: cove.x, z: cove.z, land: cove.land } };
}

// Open ground in the wilds of Thessa, well away from any town.
function podSpot(game, hero, salt) {
  const ow = game.world.ow;
  const w = game.world;
  const thessa = ow.islands[0];
  const towns = ow.settlements.filter((s) => live(s) && s.island === thessa.key);
  if (!towns.length) return null;
  const rng = new RNG(hash4(game.seed >>> 0, saltOf(hero, salt), 0x90d));
  for (const s of rng.shuffle(towns.slice()).slice(0, 8)) {
    const m = mid(s);
    const a0 = rng.float(0, Math.PI * 2);
    for (let i = 0; i < 10; i++) {
      const a = a0 + (i / 10) * Math.PI * 2;
      const dist = 55 + rng.int(0, 25);
      const x = Math.round(m.x + Math.cos(a) * dist);
      const z = Math.round(m.z + Math.sin(a) * dist);
      if (ow.islandAt && ow.islandAt(x, z) !== thessa.key) continue;
      if (towns.some((q) => Math.hypot(mid(q).x - x, mid(q).z - z) < 45)) continue;
      game.loadAround(x, z, true);
      if (ow.settlementAt(x, z)) continue;
      const y = w.findStandY(x, z, GROUND);
      if (y <= 0 || w.isWaterAt(x, y, z) || w.isWaterAt(x, y - 1, z)) continue;
      return { kind: 'outworlder', x, z, near: s.name };
    }
  }
  return null;
}

// ------------------------------------------------------------ made ready
// For the one playing (`game.player` is them), standing at `at` now.
export function originSetup(game, spot) {
  if (!spot) return null;
  const h = game.hero;
  if (!h) return null;
  game.originAt = spot;
  h.originAt = { kind: spot.kind, sid: spot.sid ?? null, civ: spot.civ ?? null, cove: spot.cove ? spot.cove.name : null, near: spot.near || null };
  if (spot.kind === 'leader') return leaderSetup(game, spot);
  if (spot.kind === 'brigand') return brigandSetup(game, spot);
  if (spot.kind === 'outworlder') return podSetup(game, spot);
  return null;
}

function leaderSetup(game, spot) {
  const sim = game.sim;
  const o = sim.office;
  const L = sim.layoutOf(spot.sid);
  if (!o || !L || !L.econ) return null;
  const pid = o.pid();
  const day = game.day;
  const name = game.playerName;
  // The town, under the charter chosen (one it can have: a temple's rule
  // needs a temple and a priest).
  const charter = spot.scope === 'town' ? spot.style : 'council';
  const fits = charterFits(L, charter);
  const T = o.install(L, pid, name, 'birthright', day, { quiet: true, charter });
  T.lastOverall = 58;
  if (charter === 'lordship' && T.charter === 'lordship') T.holder.style = 'Liege';
  if (!fits) spot.fellBack = CHARTERS[T.charter].name;
  // A citizen of long standing.
  if (sim.citizen && sim.citizen.sid === L.settlement.id) sim.citizen.since = day - 30;
  // The realm, too.
  if (spot.scope === 'realm' && spot.civ !== null && sim.crown) {
    const civ = game.world.ow.civs[spot.civ];
    if (civ) sim.crown.crownPlayer(civ, pid, name, 'birthright', day, { form: spot.style, style: 'Monarch' });
  }
  // (Nothing to answer before the first morning: the banners wait for
  // the story's opening to end; a monarch still chooses their style.)
  o.shows = o.shows.filter((q) => q.pid !== pid || q.kind === 'crowned');
  return spot;
}

function brigandSetup(game, spot) {
  const p = game.player;
  const h = game.hero;
  const cove = spot.cove;
  const G = GUILDS[cove.guild] || GUILDS[0];
  // One of the brethren, known for it.
  const r = piracyOf(game, p);
  r.guild = cove.guild;
  r.n = Math.max(r.n, PIRATE_AT);
  // The realms nearest the cove know the name: their towns think the worse
  // of you, their warships come for you.
  const realms = game.sim.realms;
  const near = realms.civs.filter((c) => realms.members(c).length && realms.capitalOf(c)).map((c) => ({ c, d: Math.hypot(mid(realms.capitalOf(c)).x - cove.x, mid(realms.capitalOf(c)).z - cove.z) })).sort((a, b) => a.d - b.d).slice(0, 2);
  h.infamy = {};
  for (const { c } of near) {
    h.infamy[c.id] = INFAMY;
    r.sunk[c.id] = Math.max(1, r.sunk[c.id] || 0);
  }
  spot.realms = near.map(({ c }) => c.name);
  // A sloop of your own at anchor off the beach, a hand or two aboard.
  const rng = new RNG(hash4(game.seed >>> 0, saltOf(h, 0), 0xb51));
  const at = waterSpot(game, 'sloop', spot.x, spot.z, 6, 90, true);
  if (at) {
    const hands = 1 + rng.int(0, 1);
    const crew = makeCrew(rng.int(0, 1e9), 'sloop', 'vale', hands + 1).slice(1).map((c, i) => ({
      ...c, role: i === 0 ? 'mate' : 'sailor', temper: 'rogue',
      look: { ...c.look, hat: rng.pick(['bandana', 'bandana', 'cap']), hatColor: '#1a1a1a', outfit: rng.pick(['plain', 'vest']) },
    }));
    const S = addShip(game, {
      type: 'sloop', x: at.x, z: at.z, yaw: at.yaw ?? 0, owner: ownerId(game, p), name: rng.pick(SLOOPS), crew, ammo: 24,
      paint: '#2a2228', paint2: '#121014', flag: G.flag, flagLayers: G.layers, emblem: 'saltire', markColor: '#121212', anchor: true, sailSet: 0,
    });
    spot.ship = S ? S.name : null;
    spot.hands = crew.map((c) => c.name.first);
  }
  // A sabre and a spyglass: a pirate's.
  p.give('sabre', 1);
  p.give('spyglass', 1);
  // The haven, and the brethren living there.
  const S = game.sim.saga;
  if (S && !S.live().some((t) => t.m === 'pirate_haven' && t.vars.guild === cove.guild)) {
    const s = game.world.ow.settlementsNear ? game.world.ow.settlementsNear(spot.x, spot.z)[0] : null;
    S.startStory('pirate_haven', { sid: s ? s.id : null, vars: { guild: cove.guild, name: cove.name, x: Math.round(spot.x), z: Math.round(spot.z), dx: spot.dx, dz: spot.dz }, touched: [pidOf(p)] });
  }
  game.world.ow.pin?.(cove.x, cove.z, `${cove.name} (pirates)`, '×');
  return spot;
}

// The pod, half buried in the crater it made, still glowing.
function podSetup(game, spot) {
  const w = game.world;
  game.loadAround(spot.x, spot.z, true);
  makeCrater(game, spot.x, spot.z);
  const x0 = spot.x + 2;
  const z0 = spot.z;
  const y = Math.max(1, w.findStandY(x0, z0, GROUND));
  const shell = B.obsidian ?? B.stone;
  const pane = B.glass ?? shell;
  const glow = B.glow_crystal ?? B.torch;
  const put = (x, yy, z, id) => {
    if (w.regionAt(x, z)) w.setBlock(x, yy, z, id);
  };
  // A capsule lying on its side, its hatch blown open toward you.
  for (let dx = 0; dx < 3; dx++) {
    put(x0 + dx, y, z0 - 1, shell);
    put(x0 + dx, y, z0 + 1, shell);
    put(x0 + dx, y + 1, z0, dx === 1 ? pane : shell);
  }
  put(x0 + 3, y, z0, shell);
  put(x0 + 2, y, z0, glow);
  game.hero.podAt = { x: x0, z: z0 };
  return spot;
}

// ------------------------------------------------------------ first words
export function originIntroduce(game) {
  const h = game.hero;
  if (!isNewOrigin(h)) return false;
  const at = game.originAt || {};
  const msg = (t, c) => game.ui.msg(t, c);
  if (h.origin === 'leader') {
    const sim = game.sim;
    const L = at.sid !== undefined ? sim.layoutOf(at.sid) : null;
    const name = L ? L.settlement.name : 'your town';
    if (at.scope === 'realm' && at.civ !== null) {
      const civ = game.world.ow.civs[at.civ];
      const F = REALM_FORMS[sim.realms.realm(civ).form] || REALM_FORMS.monarchy;
      msg(`${civ.name} is yours to rule, as a ${F.name.toLowerCase()}, from its seat at ${name}.`, '#ffe070');
      msg('Press N for the crown: its matters each morning, its decrees, its towns and its neighbours. Your chancellor sees to what you leave undecided.', '#a0c8ff');
    } else {
      const T = sim.office.of(at.sid);
      msg(`You govern ${name}${T ? ` as ${CHARTERS[T.charter].short}` : ''}.${at.fellBack ? ` (It couldn't be governed the way you wanted: it has no temple and priest to rule it. ${at.fellBack} it is.)` : ''}`, '#ffe070');
      msg('Press N for the council: the town\'s matters each morning at ten, its money, laws and people. Your steward keeps the hall.', '#a0c8ff');
    }
    return true;
  }
  if (h.origin === 'brigand') {
    const G = GUILDS[(at.cove && at.cove.guild) || 0] || GUILDS[0];
    msg(`Ashore at ${at.cove ? at.cove.name : 'the cove'}, the haven of ${G.name}: their ships will never fire on you, and the brethren on the beach count you one of their own.`, '#ffe070');
    if (at.ship) msg(`${at.ship}, your sloop, rides at anchor off the beach${at.hands && at.hands.length ? ` with ${at.hands.join(' and ')} aboard` : ''}. Climb aboard (F beside her), take her wheel (F at it).`, '#a0c8ff');
    if (at.realms && at.realms.length) msg(`${at.realms.join(' and ')} know your name: their towns think the worse of you, and their warships will come for you on sight.`, '#ff9070');
    return true;
  }
  msg(`You crawl out of the wreck of your escape pod into a scorched crater${at.near ? ` in the wilds beyond ${at.near}` : ''}. The sky you fell from is quiet now.`, '#ffe070');
  msg('Nobody here has seen anything like you. They\'ll be slow to trust you, slower still to let you lead them. The map (M) shows what you have seen.', '#a0c8ff');
  return true;
}
