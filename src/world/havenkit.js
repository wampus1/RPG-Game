// (Round 130) What a pirates' haven is made of, as the world lays one out
// (see settlement.js and npcgen.js): who lives there and what they're
// called, what its shacks are built of, what its rum house and its fence
// are called, and how its people dress. A haven is a village like any
// other in the map's eyes (s.haven marks it: see sim/havens.js), but its
// people come from every shore, and its trades go by the names the
// brethren give them.
import { B } from './blocks.js';

// The guilds' colours, in the order game/pirates.js keeps the guilds.
export const GUILD_COLORS = ['#121212', '#6a1010', '#1a2440'];
export const GUILD_FLAGS = ['jolly_gull', 'jolly_hand', 'jolly_tide'];
export const GUILD_NAMES = ['the Black Gull Brethren', 'the Red Hand Company', 'the Free Tide'];
// (On the map: a haven's square, in its guild's dark red.)
export const HAVEN_MAP = '#6a2020';

// Who they were before the sea took them: their looks and names from any
// of the islands' peoples.
export const HAVEN_STYLES = ['vale', 'north', 'sun', 'wild', 'tide', 'high', 'vale', 'tide'];

// Each trade, as the brethren name it.
export const HAVEN_TITLES = {
  mayor: 'Quartermaster', guard: 'Corsair', innkeeper: 'Rum-House Keeper', cook: 'Ship\'s Cook', barkeep: 'Pot-Boy',
  merchant: 'Fence', blacksmith: 'Gunsmith', builder: 'Shipwright', herbalist: 'Sawbones', fisher: 'Fisher',
  laborer: 'Deckhand', carpenter: 'Chandler', retired: 'Old Salt', trapper: 'Forager', farmer: 'Goatherd',
};

export const HAVEN_BUILDINGS = {
  tavern: ['The Drowned Rat', 'The Keelhauled Cat', 'The Gallows Tree', 'The Rusty Cutlass', 'The Mermaid\'s Purse', 'The Dead Man\'s Chest', 'The Leaky Bucket', 'The Grinning Skull'],
  shop: ['The Fence', 'No Questions Asked', 'The Magpie\'s Nest', 'Salvage & Sundries', 'The Back Door'],
  smithy: ['Powder & Shot', 'Iron & Brimstone', 'The Flash Pan', 'The Gun Deck'],
  herbalist: ['The Sawbones', 'Stitch & Splint', 'The Bonesetter'],
  warehouse: ['The Plunder Store', 'The Swag Loft', 'The Prize Shed'],
  stockade: ['The Stockade', 'The Brig Ashore', 'The Pen'],
  house_s: ['Shack'], house_m: ['Shanty'], house_l: ['Bunkhouse'],
};
export const HAVEN_TYPE_NAMES = { tavern: 'Rum House', townhall: 'Guild Hall', shop: 'The Fence', smithy: 'Gunsmith', herbalist: 'Sawbones', warehouse: 'Plunder Store', stockade: 'Stockade', house_s: 'Shack', house_m: 'Shanty', house_l: 'Bunkhouse' };

// What a haven's shacks are built of: salvage. Driftwood and dark planks,
// a ship's timber here and there, posts of mangrove; roofs of reed, or of
// old sails patched and tarred.
export function havenMats(type, rng) {
  const civic = type === 'townhall' || type === 'tavern' || type === 'stockade';
  const wall = type === 'stockade' ? B.log_wall : rng.weighted([[B.planks_drift, 3], [B.planks_dark, 2], [B.log_wall, civic ? 2 : 1], [B.planks, 1]]);
  const corner = type === 'stockade' ? B.log_oak : B.log_mangrove;
  const floor = rng.chance(0.5) ? B.planks_drift : B.planks_dark;
  const roof = type === 'townhall' ? B.roof_wood : rng.weighted([[B.sail_roof, 3], [B.roof_reed, 2], [B.thatch, 1]]);
  return { wall, corner, floor, roof, flat: false, style: 'haven' };
}

// How the brethren dress: bandanas and tricorns in their guild's colours,
// an eyepatch now and then, a sash, a sea-faded shirt.
const SHIRTS = ['#e8e0d0', '#3a2a2a', '#5a1a1a', '#2a2a3a', '#d8c8a0', '#4a3a2a', '#6a5a3a', '#2e4a5a'];
export function havenLook(look, rng, guild, job, age) {
  const col = GUILD_COLORS[guild] || GUILD_COLORS[0];
  const out = { ...look };
  if (age === 'child') {
    out.hat = rng.chance(0.4) ? 'bandana' : null;
    out.hatColor = col === '#121212' ? '#8a1a1a' : col;
    return out;
  }
  out.shirt = rng.pick(SHIRTS);
  out.accent = col === '#121212' ? '#8a1a1a' : col;
  if (job === 'mayor') out.hat = 'tricorn';
  else if (job === 'guard') out.hat = rng.pick(['bandana', 'bandana', 'tricorn', 'cap', null]);
  else out.hat = rng.pick(['bandana', null, 'cap', null, 'bandana']);
  out.hatColor = rng.pick([col, '#1a1a1a', '#8a1a1a', '#2a2a5a']);
  if (age === 'adult' && rng.chance(job === 'guard' ? 0.3 : 0.15)) out.acc = 'eyepatch';
  if (job === 'guard' || job === 'mayor') out.outfit = job === 'mayor' ? 'noble' : 'plain';
  out.beard = age !== 'child' && rng.chance(0.4);
  return out;
}

// A haven's own people: the plan of its households and its trades.
export function havenPlan(s, rng) {
  const target = rng.int(16, 22);
  const households = [];
  let pop = 0;
  while (pop < target) {
    const kind = rng.weighted([['single', 0.5], ['couple', 0.18], ['family', 0.14], ['elder', 0.12], ['parent', 0.06]]);
    const m = [];
    if (kind === 'single') m.push({ age: 'adult' });
    else if (kind === 'couple') m.push({ age: 'adult', partner: 1 }, { age: 'adult', partner: 0 });
    else if (kind === 'family') {
      m.push({ age: 'adult', partner: 1 }, { age: 'adult', partner: 0 });
      for (let i = rng.int(1, 2); i > 0; i--) m.push({ age: 'child', child: true });
    } else if (kind === 'parent') {
      m.push({ age: 'adult' });
      m.push({ age: 'child', child: true });
    } else m.push({ age: 'elder' });
    households.push({ kind, members: m });
    pop += m.length;
  }
  const adults = households.reduce((n, h) => n + h.members.filter((x) => x.age === 'adult').length, 0);
  const order = ['mayor', 'guard', 'guard', 'innkeeper', 'merchant', 'blacksmith', 'builder', 'guard', 'cook', 'herbalist', 'guard', 'fisher', 'laborer', 'guard', 'fisher', 'laborer', 'barkeep', 'laborer'];
  const jobs = order.slice(0, adults);
  while (jobs.length < adults) jobs.push(rng.chance(0.5) ? 'guard' : 'laborer');
  return { households, jobs, target, haven: true };
}
