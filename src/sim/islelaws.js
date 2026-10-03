// The islands' own laws, as they bear on you (see laws.js for the laws
// themselves, and where they come from).
//   Thessa's riding law: no riding in the streets. Kharos's fire tithe
// (more tax; the mountain spares the town some of its wrath) and
// black-glass law (no iron blades in the smithy; obsidian sells cheap).
// Myrrow: the Mirefolk's lantern law (a light after dark, or a fine) and
// spore law (the town's mushrooms are everyone's), the Stiltfolk's
// catch-share (fish fetch less; the town gains) and raft dues (¤2 to put a
// raft in at their shore).
//   The watch warns you once, and fines you if you carry on.
import { lawOn } from './laws.js';
import { countItem, removeItem } from '../game/inventory.js';
import { FISHY } from './culture.js';
import { DAY_MINUTES } from '../config.js';

// Mushrooms the spore law covers.
export const SPORE_BLOCKS = new Set(['mushroom_red', 'mushroom_brown', 'glowshroom', 'mushroom_cap', 'mushroom_stem', 'glowcap_cap']);

// The town you're standing in (and its layout), if it's lived in.
function townHere(game) {
  const p = game.player;
  const s = game.world.ow.settlementAt(Math.round(p.x), Math.round(p.z));
  if (!s || !game.active.has(s.id) || s.condition === 'abandoned' || s.deserted) return null;
  return game.active.get(s.id).layout;
}

// A guard (or anyone awake) who'd notice you, nearest first.
function watcher(game, L) {
  const p = game.player;
  let best = null;
  for (const n of game.active.get(L.settlement.id).npcs) {
    if (n.dead || n.sleeping || n.down || n.state === 'flee') continue;
    const d = Math.max(Math.abs(n.x - p.x), Math.abs(n.z - p.z));
    const reach = n.rec.job === 'guard' ? 9 : 5;
    if (d > reach) continue;
    const score = d - (n.rec.job === 'guard' ? 4 : 0);
    if (!best || score < best.score) best = { n, score };
  }
  return best ? best.n : null;
}

// Warned once (per town, per law, for a while); after that, a fine.
function breach(game, L, id, warnLine, fine, msg) {
  const now = game.day * DAY_MINUTES + game.minute;
  const key = `${L.settlement.id}:${id}`;
  const m = (game.lawMarks ||= new Map());
  const was = m.get(key);
  const n = watcher(game, L);
  if (!n) return false;
  if (was && now - was.at < 25) return false;
  const p = game.player;
  if (!was || now - was.at > 24 * 60) {
    m.set(key, { at: now, n: 1 });
    n.face(p.x, p.z);
    n.say(warnLine, 3, '#ffd080');
    game.ui.msg(`${msg} (${L.settlement.name}: you've been warned.)`, '#ffd080');
    return true;
  }
  m.set(key, { at: now, n: was.n + 1 });
  const paid = Math.min(fine, countItem(p.inv, 'coin'));
  if (paid > 0) removeItem(p.inv, 'coin', paid);
  L.econ.treasury += paid;
  n.face(p.x, p.z);
  n.say(paid ? `That's a fine of ¤${paid}. The law's the law.` : 'No coin? Then I\'ll remember your face.', 3, '#ff9060');
  game.ui.msg(paid ? `Fined ¤${paid} in ${L.settlement.name} for breaking the ${msg.toLowerCase().replace(/[.!]$/, '')}.` : `You couldn't pay the fine in ${L.settlement.name}. They won't forget it.`, '#ff9060');
  if (!paid && game.sim.changeRep) game.sim.changeRep(n, -3);
  return true;
}

// Each second or so, while you're in a town.
export function enforceIslandLaws(game, dt) {
  game.islawT = (game.islawT ?? 0) - dt;
  if (game.islawT > 0) return;
  game.islawT = 1;
  if (game.dungeon || game.cutscene || game.sleep) return;
  const L = townHere(game);
  if (!L) return;
  const p = game.player;
  const indoors = !!(game.buildingAtPlayer && game.buildingAtPlayer());
  // Riding through the streets.
  if (p.mount && !indoors && lawOn(L, 'horseLaw')) {
    if (breach(game, L, 'horseLaw', 'Down off that horse! No riding in the streets here.', 3, 'Riding law: no riding in the streets.')) L.econ.recent.riding = (L.econ.recent.riding || 0) + 1;
  }
  // Out after dark without a light.
  const m = game.minute;
  const night = m >= 21 * 60 || m < 5 * 60;
  if (night && !indoors && !p.raft && lawOn(L, 'lanternLaw') && !(p.heldLightKind && p.heldLightKind())) {
    breach(game, L, 'lanternLaw', 'Where\'s your light? The fog takes the unlit, stranger. Light a torch or a lantern.', 3, 'Lantern law: carry a light after dark.');
  }
}

// What the fire tithe adds to a citizen's day.
export function titheOf(L) {
  return lawOn(L, 'fireTithe') ? 2 : 0;
}

// The mountain goes a little easier on a town that tithes.
export function wrathFactor(L) {
  return lawOn(L, 'fireTithe') ? 0.8 : 1;
}

// A smith's stock under the black-glass law: no iron blades, obsidian.
const IRON_BLADES = new Set(['iron_sword', 'steel_sword', 'short_sword', 'sabre', 'greatsword', 'gold_sword']);
export function blackGlassStock(L, list) {
  if (!lawOn(L, 'blackGlass')) return list;
  const out = list.filter((k) => !IRON_BLADES.has(k));
  if (!out.includes('obsidian_blade')) out.push('obsidian_blade');
  return out;
}

// Prices: obsidian is cheap where it's the law; fish fetch less where
// the catch is shared.
export function lawPrice(L, k, selling) {
  if (!L) return 1;
  if (!selling && k === 'obsidian_blade' && lawOn(L, 'blackGlass')) return 0.7;
  if (selling && FISHY.has(k) && lawOn(L, 'catchShare')) return 0.8;
  return 1;
}

// Putting a raft in at a Stiltfolk shore.
export function raftDues(game, x, z) {
  const ow = game.world.ow;
  for (const s of ow.settlementsNear(x, z)) {
    const b = s.bounds;
    if (x < b.x0 - 14 || x > b.x1 + 14 || z < b.z0 - 14 || z > b.z1 + 14) continue;
    const L = game.world.layouts.get(s.id);
    if (!L || !L.econ || !lawOn(L, 'raftDues')) continue;
    const p = game.player;
    const paid = Math.min(2, countItem(p.inv, 'coin'));
    if (paid) removeItem(p.inv, 'coin', paid);
    L.econ.treasury += paid;
    game.ui.msg(paid ? `Paid ¤${paid} in raft dues to the harbour of ${s.name}.` : `You owe ${s.name}'s harbour its raft dues, and have no coin. Somebody wrote your name down.`, paid ? '#e8e0a0' : '#ff9060');
    return paid;
  }
  return 0;
}
