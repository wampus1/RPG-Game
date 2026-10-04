// Relics: things of power from below, set down anywhere. Each works on all
// within a few paces of it (the circle of runes drawn round it shows how
// far, in its colour; see render/oldplaces.js):
//   hearth   wounds close, slowly, for everyone in it
//   vigil    night things burn in its light, and none are born near it
//   breath   stamina comes back twice as fast
//   ward     blows land a fifth lighter on those inside
//   fury     blows struck from inside land a fifth harder
//   harvest  crops in it grow twice as fast
// A relic set down below ground stays on that floor of that place (the
// same stretch of instance space is reused by every dungeon, so each is
// tagged with where it really is). Relic shards, set into one, make its
// circle reach further (see fitShard).
import { ITEMS, RELICS, SHARD_MAX, SHARD_REACH, grownRelic } from '../world/items.js';
import { B } from '../world/blocks.js';

export const RELIC_R = 4;
// How far a relic with so many shards in it reaches.
export const relicReach = (shards = 0) => RELIC_R + SHARD_REACH * Math.min(SHARD_MAX, shards || 0);

// Where you are, as relics count it. (Or where x is: the floor of the old
// place open there, with others down different ones; see DungeonRun.)
export function placeTag(game, x = undefined) {
  const run = x !== undefined && game.runAt ? game.runAt(x) : null;
  const d = run || (x === undefined || (game.world && game.world.inInstance(x)) ? game.dungeon : null);
  return d ? `${d.rec.id}:${d.floor}` : null;
}

function* active(game, x = undefined) {
  if (!game.relics || !game.relics.size) return;
  const tag = placeTag(game, x);
  for (const q of game.relics.values()) if ((q.inst || null) === tag) yield q;
}

// Is (x, y, z) inside a relic of this kind's circle?
export function inRelic(game, x, y, z, kind) {
  for (const q of active(game, x)) {
    if (q.kind !== kind || Math.abs(y - q.y) > 4) continue;
    const r = (q.r || RELIC_R) + 0.5;
    if ((x - q.x) ** 2 + (z - q.z) ** 2 <= r * r) return q;
  }
  return null;
}

// Within `pad` of any relic of this kind (for keeping night things from
// being born near a vigil lamp).
export function nearRelic(game, x, z, kind, pad = 0) {
  for (const q of active(game, x)) {
    if (q.kind !== kind) continue;
    const r = (q.r || RELIC_R) + pad;
    if ((x - q.x) ** 2 + (z - q.z) ** 2 <= r * r) return q;
  }
  return null;
}

// What a blow comes to, with relics about: lighter on someone in a ward,
// harder from someone in a war totem's circle, and the dead weaker in a
// vigil lamp's light.
export function relicDamage(game, target, source, amount) {
  if (!game.relics || !game.relics.size) return amount;
  let m = 1;
  if (inRelic(game, target.x, target.y, target.z, 'ward')) m *= 0.8;
  if (source && inRelic(game, source.x, source.y, source.z, 'fury')) m *= 1.2;
  if (target.S && (target.S.undead || target.S.night) && inRelic(game, target.x, target.y, target.z, 'vigil')) m *= 1.4;
  return m === 1 ? amount : Math.max(1, Math.round(amount * m));
}

// Stamina back twice as fast in a windcharm's circle.
export function relicBreath(game, e) {
  return inRelic(game, e.x, e.y, e.z, 'breath') ? 2 : 1;
}

// Crops in a seed of plenty's circle grow twice as fast.
export function relicGrowth(game, x, y, z) {
  return !!inRelic(game, x, y, z, 'harvest');
}

// Set one down (the block's placed by the usual placing; this remembers
// what it is).
export function setRelic(game, x, y, z, kind, shards = 0) {
  if (!game.relics) game.relics = new Map();
  game.relics.set(`${x},${y},${z}`, { x, y, z, kind, r: relicReach(shards), shards: shards || 0, inst: placeTag(game, x) });
  const R = RELICS[kind];
  game.renderer.emit(x, y + 0.5, z, { n: 26 + 4 * (shards || 0), color: [R.color, '#ffffff', ...(shards ? ['#e0b8ff'] : [])], up: 30, speed: 40, life: 0.8, glow: true });
  game.audio?.play('rune');
  game.ui.msg(`You set down the ${R.name}. Runes kindle in a circle round it${shards ? `, ${relicReach(shards)} paces across` : ''}: ${R.about.charAt(0).toLowerCase()}${R.about.slice(1)}`, R.color);
}

// A relic shard used from the belt: it sinks into a relic in your pack (the
// nearest to the shard's slot that can take one more), and that relic's
// circle reaches half a pace further for good. Whether it was used.
export function fitShard(game, def, p = game.player) {
  if (!def || def.kind !== 'relic_shard') return false;
  const slot = p.inv[p.selected];
  const order = [...p.inv.keys()].sort((a, b) => Math.abs(a - p.selected) - Math.abs(b - p.selected));
  let at = -1;
  let full = false;
  for (const i of order) {
    const it = p.inv[i] && ITEMS[p.inv[i].item];
    if (!it || it.kind !== 'relic') continue;
    if ((it.shards || 0) >= SHARD_MAX) {
      full = true;
      continue;
    }
    at = i;
    break;
  }
  if (at < 0) {
    game.ui.msg(full ? `Your relics have all the shards they'll take (${SHARD_MAX}).` : 'You carry no relic to set it in. (Take one up first: the shard goes into a relic in your pack.)', '#e0b8ff', true);
    game.audio?.play('error');
    return true;
  }
  const was = ITEMS[p.inv[at].item];
  const n = (was.shards || 0) + 1;
  p.inv[at] = { item: grownRelic(was.relic, n), count: 1 };
  slot.count--;
  if (slot.count <= 0) p.inv[p.selected] = null;
  const R = RELICS[was.relic];
  game.renderer.emit(p.x, p.y + 1.2, p.z, { n: 20, color: ['#e0b8ff', R.color, '#ffffff'], up: 30, speed: 26, life: 0.8, glow: true, gravity: -16 });
  game.audio?.play('rune');
  game.ui.msg(`The shard sinks into the ${R.name} and is gone: its circle will reach ${relicReach(n)} paces now (${n} of ${SHARD_MAX} shards).`, '#e0b8ff');
  return true;
}

// The relic at a block (or one that's been lost track of: its block with
// nothing remembered, taken as a hearthstone so it can still be picked up).
export function relicAt(game, x, y, z) {
  return (game.relics && game.relics.get(`${x},${y},${z}`)) || null;
}

// Each half second: hearthstones mend, vigil lamps burn night things.
export function updateRelics(game, dt) {
  if (!game.relics || !game.relics.size) return;
  game.relicT = (game.relicT || 0) - dt;
  if (game.relicT > 0) return;
  game.relicT = 0.5;
  const tag = placeTag(game);
  const p = game.player;
  for (const [k, q] of game.relics) {
    if ((q.inst || null) !== tag) continue;
    if (Math.abs(q.x - p.x) > 40 || Math.abs(q.z - p.z) > 40) continue;
    // (Broken, or blown up: forgotten, and the relic itself left lying.)
    if (game.world.regionAt(q.x, q.z) && game.world.getBlock(q.x, q.y, q.z) !== B.relic) {
      game.relics.delete(k);
      game.spawnDrop(relicItem(q.kind, q.shards), 1, q.x, q.y, q.z, true);
      continue;
    }
    const r2 = ((q.r || RELIC_R) + 0.5) ** 2;
    const inside = (e) => !e.dead && !e.down && Math.abs(e.y - q.y) <= 4 && (e.x - q.x) ** 2 + (e.z - q.z) ** 2 <= r2;
    if (q.kind === 'hearth') {
      // Half a heart every four seconds or so, to everyone not at war.
      q.acc = (q.acc || 0) + 0.5;
      if (q.acc < 4) continue;
      q.acc = 0;
      const mend = (e, max) => {
        if (!inside(e) || e.hp >= max) return;
        e.hp = Math.min(max, e.hp + 1);
        game.renderer.emit(e.x, e.y + 1, e.z, { n: 3, color: ['#ffb050', '#ffe0a0'], up: 16, speed: 6, gravity: -12, life: 0.7, glow: true });
        if (e === p) game.renderer.floatText(e.x, e.y + 2, e.z, '+1', '#ffb050');
      };
      mend(p, p.maxHp);
      for (const n of game.npcs) if (!n.hostile) mend(n, n.maxHp || 10);
    } else if (q.kind === 'vigil') {
      for (const c of game.creatures) {
        if (!inside(c) || !(c.S.undead || c.S.night || c.species === 'wisp')) continue;
        q.burn = (q.burn || 0) + 1;
        game.dotHit = true;
        game.damage(c, 1, null);
        game.dotHit = false;
        game.renderer.emit(c.x, c.y + 0.8, c.z, { n: 5, color: ['#fff0a0', '#ffffff'], up: 20, speed: 14, life: 0.5, glow: true });
      }
    }
  }
}

// The item a relic block gives back when taken up.
// (With the shards that were set in it.)
export function relicItem(kind, shards = 0) {
  return ITEMS[`relic_${kind}`] ? grownRelic(kind, shards || 0) : 'relic_hearth';
}

export function serializeRelics(game) {
  return game.relics ? [...game.relics.values()].map(({ x, y, z, kind, r, shards, inst }) => ({ x, y, z, kind, r, shards: shards || 0, inst })) : [];
}

export function loadRelics(game, list) {
  game.relics = new Map();
  for (const q of list || []) game.relics.set(`${q.x},${q.y},${q.z}`, { ...q });
}
