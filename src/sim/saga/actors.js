// The stories' own people and beasts, made for the world when you're near
// enough to see them (see Saga.syncActors): who they are is made once and
// kept in the story (so the messenger who finds you tomorrow is the same
// one), and they're put together as townsfolk-style records to walk about.
import { NPC } from '../../entities/npc.js';
import { Creature, SPECIES } from '../../entities/creature.js';
import { makeLook, makePersonality, makeAdventurer } from '../../entities/npcgen.js';
import { personName, familyName, CULTURES } from '../../world/names.js';
import { ITEMS, offhandable } from '../../world/items.js';
import { RNG, hash4 } from '../../util/rng.js';
import { townMid } from './refs.js';

const WEAPONS = {
  outlaw: ['iron_sword', 'stone_sword', 'iron_axe', 'spear', 'club', 'hand_axe', 'short_sword', 'flail', 'quarterstaff', 'battle_axe'],
  thug: ['club', 'quarterstaff', 'hand_axe', 'dagger'],
  soldier: ['iron_sword', 'spear', 'iron_axe'],
  guard: ['iron_sword', 'spear'],
};
const ok = (k) => (ITEMS[k] ? k : null);
const TITLE_OF = {
  outlaw: 'Outlaw', thug: 'Thug', messenger: 'Messenger', soldier: 'Soldier', guard: 'Guard', child: 'Child', elder: 'Elder', stranger: 'Stranger',
  priest: 'Priest', scholar: 'Scholar', refugee: 'Refugee', merchant: 'Merchant', hunter: 'Sellsword', champion: 'Champion',
};

// Someone made up for a story: `kind` 'outlaw', 'thug', 'messenger',
// 'soldier', 'guard', 'child', 'elder', 'stranger', 'priest', 'scholar',
// 'refugee', 'merchant', 'hunter' (a hired blade), 'champion'.
export function makePerson(rng, style, kind) {
  style = CULTURES[style] ? style : 'vale';
  const age = kind === 'child' ? 'child' : kind === 'elder' ? 'elder' : 'adult';
  const job = { outlaw: 'guard', thug: 'laborer', messenger: 'merchant', soldier: 'guard', guard: 'guard', child: 'child', elder: 'retired', stranger: 'merchant', priest: 'priest', scholar: 'scholar', refugee: 'farmer', merchant: 'merchant', hunter: 'guard', champion: 'guard' }[kind] || 'farmer';
  if (kind === 'hunter' || kind === 'champion') {
    const a = makeAdventurer(rng, style, kind === 'champion' ? 3 : 2);
    return { name: a.name, look: a.look, personality: a.personality, traits: a.traits, job: kind === 'champion' ? 'champion' : 'sellsword', weapon: a.gear.weapon, wear: a.gear.wear, maxHp: a.maxHp, armor: 0.3, age: 'adult', kind };
  }
  const { p, traits } = makePersonality(rng, null, job, age);
  const look = makeLook(rng, style, age, job, null);
  if (kind === 'outlaw' || kind === 'thug') {
    look.hat = rng.pick(['hood', 'hood', null]);
    look.outfit = rng.pick(['hunter', 'rags', 'vest']);
    look.accent = '#3a2a2a';
  } else if (kind === 'messenger') {
    look.hat = 'hood';
    look.outfit = rng.pick(['hunter', 'vest']);
  } else if (kind === 'soldier') {
    look.hat = 'helmet';
    look.outfit = 'guard';
  } else if (kind === 'refugee') {
    look.outfit = 'rags';
  }
  const w = WEAPONS[kind] ? ok(rng.pick(WEAPONS[kind])) : null;
  const hp = kind === 'child' ? 10 : kind === 'elder' ? 14 : kind === 'outlaw' ? 20 + rng.int(0, 6) : kind === 'soldier' || kind === 'guard' ? 30 : 18;
  return {
    name: personName(rng, style, familyName(rng, style)), look, personality: p, traits, age, kind,
    job: { outlaw: 'bandit', thug: 'thug', messenger: 'messenger', soldier: 'soldier', guard: 'guard', child: 'child', elder: 'elder', stranger: 'traveller', priest: 'priest', scholar: 'scholar', refugee: 'refugee', merchant: 'merchant' }[kind] || 'traveller',
    weapon: w, maxHp: hp, armor: kind === 'soldier' || kind === 'guard' ? 0.25 : kind === 'outlaw' ? 0.1 : 0,
  };
}

// A band member as a story's person.
export function fromBandit(m, band) {
  return {
    name: m.name, look: m.look, personality: m.personality, traits: m.traits || [], age: 'adult', kind: 'outlaw', job: 'bandit',
    weapon: m.weapon, maxHp: m.maxHp, armor: m.armor ?? (band && band.windfall ? 0.25 : 0.1), wear: m.wear || null, title: m.title || null,
    band: band ? band.id : null, member: m.id,
  };
}

// The nearest town that's been laid out (for the record's home).
export function layoutNear(game, x, z) {
  let best = null;
  let bd = Infinity;
  for (const L of game.world.layouts.values()) {
    if (!L.settlement) continue;
    const m = townMid(L.settlement);
    const d = Math.hypot(m.x - x, m.z - z);
    if (d < bd) {
      bd = d;
      best = L;
    }
  }
  if (best) return best;
  const s = game.world.ow.settlementsNear(x, z)[0] || game.world.ow.settlements[0];
  return s ? game.world.getLayout(s) : null;
}

export function actorRec(a, L, th) {
  const P = a.person || {};
  const sched = [{ s: 0, e: 1440, act: 'adventure', place: 'camp' }];
  const weapon = P.weapon && ITEMS[P.weapon] ? P.weapon : null;
  const idx = 9000 + ((th.id * 37 + hash4(a.key.length, a.key.charCodeAt(0) || 0)) % 900);
  return {
    id: `saga${th.id}:${a.key}`, idx, sid: L.settlement.id, visitor: true, saga: th.id,
    name: P.name || { first: 'Someone', last: '' }, age: P.age || 'adult', job: P.job || 'traveller', title: P.title || a.title || TITLE_OF[P.kind] || 'Traveller', home: null, bed: 0, household: null,
    partner: null, children: [], parents: [], friends: [], personality: P.personality || { kindness: 0.5, bravery: 0.5, sociability: 0.5, temper: 0.3, greed: 0.4, piety: 0.4, curiosity: 0.5 }, traits: P.traits || [],
    hobbies: [], look: P.look || {}, alive: true, shift: 'day', restDay: -1, bandit: P.band ?? undefined,
    equipment: {
      tool: weapon, hobbyItem: null, items: weapon ? [{ item: weapon, count: 1 }] : [], coins: 0, armor: P.armor || 0,
      shield: P.offhand || (P.kind === 'outlaw' && weapon && offhandable(weapon) && (a.key.length % 3 === 0) ? 'dagger' : null),
    },
    wear: P.wear || undefined, maxHp: P.maxHp || 20, hp: Math.max(1, Math.round(a.hp ?? P.maxHp ?? 20)), work: { kind: 'none' }, schedule: { work: sched, rest: sched },
    coins: P.coins ?? 2, inv: [], skills: { trading: 0.2, cooking: 0.2, hunting: 0.5, fishing: 0.2, farming: 0.1, building: 0.1, crafting: 0.2 },
    fed: 1, hungry: 0, mood: 0.5, grief: [], override: null, away: false, doneKey: null,
  };
}

// A person, put in the world at `spot`.
export function spawnPerson(game, a, spot, th) {
  const L = layoutNear(game, spot.x, spot.z);
  if (!L) return null;
  const rec = actorRec(a, L, th);
  const n = new NPC(game, rec, L);
  n.teleport(spot.x, spot.y, spot.z);
  rec.ent = n;
  game.npcs.push(n);
  n.sagaKey = `${th.id}:${a.key}`;
  n.sagaThread = th.id;
  const o = a.orders || {};
  if (a.talk) {
    n.state = 'saga';
    n.saga = { th: th.id, key: a.key, role: a.role, home: o.home || { x: spot.x, z: spot.z }, ...o };
  } else {
    n.state = 'warband';
    n.warband = { kind: 'saga', role: a.role, th: th.id, key: a.key, foe: !!a.hostile, home: o.home || { x: spot.x, z: spot.z }, phase: 'go', ...o };
    n.hostileNow = !!a.hostile;
    if (a.person && a.person.band !== undefined && a.person.band !== null) {
      n.warband.band = a.person.band;
      n.warband.member = a.person.member;
    }
  }
  return n;
}

// A beast (a pack's, a den's, a named one), put in the world at `spot`.
export function spawnBeast(game, a, spot, th) {
  if (!SPECIES[a.species]) return null;
  const c = new Creature(game, a.species, spot.x, spot.y, spot.z, a.variant || 0);
  c.sagaKey = `${th.id}:${a.key}`;
  c.sagaThread = th.id;
  c.saga = { th: th.id, key: a.key, role: a.role };
  if (a.name) c.name = a.name;
  if (a.maxHp) {
    c.maxHp = a.maxHp;
    c.hp = Math.max(1, Math.min(a.maxHp, Math.round(a.hp ?? a.maxHp)));
  }
  if (a.dmg) c.S = { ...c.S, dmg: a.dmg, name: a.name || c.S.name };
  if (a.hostile) {
    c.angry = true;
    c.hostileNow = true;
  }
  c.home = a.orders && a.orders.home ? { ...a.orders.home } : { x: spot.x, z: spot.z };
  game.addCreature(c);
  return c;
}

// A style for someone of a town (its people's way of dress).
export function styleNear(game, x, z) {
  const s = game.world.ow.settlementsNear(x, z)[0];
  return (s && s.style) || 'vale';
}

export function personRng(seed, ...k) {
  return new RNG(hash4(seed | 0, ...k));
}
