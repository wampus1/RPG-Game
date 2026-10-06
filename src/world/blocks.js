// Block registry. Every cell of the world grid stores a block id (Uint16) and a
// meta byte: bits 0-1 rotation (0=S,1=W,2=N,3=E), bit 2 state (open / lit).

export const META_ROT = 0b011;
export const META_STATE = 0b100;
export const META_AGE = 0b111000; // crops: growth stage (bits 3-5)

export const BLOCKS = [];
export const B = {};

const DEFAULTS = {
  solid: true, // blocks movement
  opaque: true, // hides neighbouring faces / blocks light
  standable: null, // can stand on top (defaults to solid cube)
  render: 'cube', // cube | sprite | plant | liquid | flat | door | fence | none
  hardness: 1, // seconds to break with the right tool at speed 1
  tool: null, // pick | axe | shovel
  drop: undefined, // item key, null, or [{item, chance, min, max}]
  light: 0, // light emission when lit/always
  lightWhenState: false, // emits only when the state bit is set
  lightState: 0, // brighter than `light` while the state bit is set
  rotatable: false,
  interact: null,
  replaceable: false,
  support: false, // pops off when the block below disappears
  liquid: false,
  label: null,
  tall: false, // sprite visually spans two layers
};

const LEGACY_TWICE = new Set(['cobweb', 'statue']);
function def(name, props = {}) {
  // (Two blocks of one name: the second would quietly take the first's
  // place. The dungeons' cobwebs and the town statues have done so for a
  // long while, and saved worlds count on it.)
  if (B[name] !== undefined && !LEGACY_TWICE.has(name)) throw new Error(`block ${name} defined twice`);
  const id = BLOCKS.length;
  const d = { ...DEFAULTS, ...props, id, name };
  if (d.standable === null) d.standable = d.solid && d.render === 'cube';
  if (d.drop === undefined) d.drop = name;
  if (!d.label) d.label = name.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  BLOCKS.push(d);
  B[name] = id;
  return d;
}

// (Round 62) A mod's block, at the id a world keeps it by (see
// mod/registry.js): put in place, or taken out again (the list cut back
// to the game's own).
export function defineBlockAt(id, name, props = {}) {
  const d = { ...DEFAULTS, ...props, id, name, mod: true };
  if (d.standable === null) d.standable = d.solid && d.render === 'cube';
  if (d.drop === undefined) d.drop = name;
  if (!d.label) d.label = name;
  while (BLOCKS.length < id) BLOCKS.push(null);
  BLOCKS[id] = d;
  B[name] = id;
  return d;
}
export function truncateBlocks(n) {
  for (let i = n; i < BLOCKS.length; i++) if (BLOCKS[i] && B[BLOCKS[i].name] === i) delete B[BLOCKS[i].name];
  BLOCKS.length = n;
}

const nonSolid = { solid: false, opaque: false };
const plant = { ...nonSolid, render: 'plant', hardness: 0.05, replaceable: true, support: true };
const sprite = { opaque: false, render: 'sprite', standable: false, support: true };
// Leaves can always be walked through (they rustle and slow you a little).
const leaves = (extra = []) => ({
  solid: false,
  opaque: false,
  hardness: 0.25,
  tool: 'axe',
  drop: [
    { item: 'sapling', chance: 0.06 },
    { item: 'stick', chance: 0.12 },
    ...extra,
  ],
});

def('air', { ...nonSolid, render: 'none', hardness: 0, drop: null, replaceable: true });
// --- terrain ------------------------------------------------------------
def('bedrock', { hardness: Infinity, drop: null });
def('stone', { tool: 'pick', hardness: 1.5, drop: 'cobblestone' });
def('cobblestone', { tool: 'pick', hardness: 1.5 });
def('dirt', { tool: 'shovel', hardness: 0.5 });
def('grass', { tool: 'shovel', hardness: 0.6, drop: 'dirt', label: 'Grass' });
def('grass_lush', { tool: 'shovel', hardness: 0.6, drop: 'dirt', label: 'Forest Floor' });
def('grass_dry', { tool: 'shovel', hardness: 0.6, drop: 'dirt', label: 'Dry Grass' });
def('grass_jungle', { tool: 'shovel', hardness: 0.6, drop: 'dirt', label: 'Jungle Floor' });
def('grass_taiga', { tool: 'shovel', hardness: 0.6, drop: 'dirt', label: 'Needle Floor' });
def('sand', { tool: 'shovel', hardness: 0.5 });
def('sandstone', { tool: 'pick', hardness: 0.9 });
def('snow', { tool: 'shovel', hardness: 0.3 });
def('ice', { tool: 'pick', hardness: 0.5, opaque: false });
def('mud', { tool: 'shovel', hardness: 0.5 });
def('gravel', { tool: 'shovel', hardness: 0.6 });
def('clay', { tool: 'shovel', hardness: 0.6 });
def('water', {
  ...nonSolid,
  render: 'liquid',
  liquid: true,
  hardness: Infinity,
  drop: null,
  replaceable: true,
});
def('coal_ore', { tool: 'pick', hardness: 2, drop: [{ item: 'coal', min: 1, max: 2 }] });
def('iron_ore', { tool: 'pick', hardness: 2.5 });
def('gold_ore', { tool: 'pick', hardness: 3 });
def('gem_ore', { tool: 'pick', hardness: 3.5, drop: 'gem', label: 'Gem Ore' });
def('path', { tool: 'shovel', hardness: 0.5, drop: 'dirt', label: 'Dirt Path' });
def('farmland', { tool: 'shovel', hardness: 0.5, drop: 'dirt' });
// --- wood -------------------------------------------------------------------
for (const w of ['oak', 'birch', 'pine', 'palm', 'jungle', 'acacia', 'willow']) {
  def(`log_${w}`, { tool: 'axe', hardness: 1.2, label: `${cap(w)} Log` });
}
def('leaves_oak', leaves([{ item: 'apple', chance: 0.05 }]));
def('leaves_birch', leaves());
def('leaves_pine', leaves());
def('leaves_palm', leaves([{ item: 'coconut', chance: 0.08 }]));
def('leaves_jungle', leaves());
def('leaves_acacia', leaves());
def('leaves_willow', leaves());
def('leaves_snowy', { ...leaves(), label: 'Snowy Needles' });
def('planks', { tool: 'axe', hardness: 1, label: 'Oak Planks' });
def('planks_birch', { tool: 'axe', hardness: 1, label: 'Birch Planks' });
def('planks_dark', { tool: 'axe', hardness: 1, label: 'Dark Planks' });
// --- construction ------------------------------------------------------------
def('stone_bricks', { tool: 'pick', hardness: 1.6 });
def('mossy_bricks', { tool: 'pick', hardness: 1.6 });
def('cracked_bricks', { tool: 'pick', hardness: 1.3 });
def('bricks', { tool: 'pick', hardness: 1.6, label: 'Clay Bricks' });
def('adobe', { tool: 'pick', hardness: 0.9, label: 'Adobe' });
def('plaster', { tool: 'pick', hardness: 1 });
def('timber', { tool: 'axe', hardness: 1, label: 'Timber Frame' });
def('log_wall', { tool: 'axe', hardness: 1.2, label: 'Log Wall' });
def('marble', { tool: 'pick', hardness: 2 });
def('thatch', { hardness: 0.4, rotatable: true });
def('roof_red', { tool: 'pick', hardness: 0.8, rotatable: true, label: 'Clay Roof Tiles' });
def('roof_slate', { tool: 'pick', hardness: 0.8, rotatable: true, label: 'Slate Roof' });
def('roof_wood', { tool: 'axe', hardness: 0.8, rotatable: true, label: 'Wood Shingles' });
def('roof_green', { tool: 'pick', hardness: 0.8, rotatable: true, label: 'Copper Roof' });
def('roof_snow', { tool: 'shovel', hardness: 0.6, rotatable: true, drop: 'roof_wood', label: 'Snowy Roof' });
def('glass', { opaque: false, hardness: 0.3 });
def('hay_bale', { hardness: 0.4 });
def('counter', { tool: 'axe', hardness: 1, standable: false });
def('bookshelf', { tool: 'axe', hardness: 1, interact: 'bookshelf', rotatable: true });
def('awning_red', { hardness: 0.3, opaque: false, label: 'Red Awning' });
def('awning_blue', { hardness: 0.3, opaque: false, label: 'Blue Awning' });
def('awning_yellow', { hardness: 0.3, opaque: false, label: 'Yellow Awning' });
def('awning_green', { hardness: 0.3, opaque: false, label: 'Green Awning' });
def('fence', { opaque: false, render: 'fence', standable: false, tool: 'axe', hardness: 0.7 });
def('door', {
  opaque: false,
  render: 'door',
  rotatable: true,
  interact: 'door',
  tool: 'axe',
  hardness: 0.8,
  standable: false,
});
def('door_top', {
  ...nonSolid,
  render: 'door',
  rotatable: true,
  interact: 'door',
  tool: 'axe',
  hardness: 0.8,
  drop: null,
  label: 'Door',
});
// --- furniture & interactive props ------------------------------------------
def('chest', { ...sprite, interact: 'container', rotatable: true, tool: 'axe', hardness: 0.8 });
def('barrel', { ...sprite, interact: 'container', tool: 'axe', hardness: 0.8 });
def('crate', { ...sprite, interact: 'container', tool: 'axe', hardness: 0.7 });
def('workbench', { ...sprite, interact: 'workbench', tool: 'axe', hardness: 0.9 });
def('furnace', { ...sprite, interact: 'furnace', tool: 'pick', hardness: 1.4, light: 8 });
def('anvil', { ...sprite, interact: 'anvil', tool: 'pick', hardness: 2 });
def('torch', {
  ...sprite,
  solid: false,
  interact: 'torch',
  hardness: 0.05,
  light: 13,
  lightWhenState: true,
});
def('lantern', {
  ...sprite,
  solid: false,
  interact: 'torch',
  hardness: 0.3,
  light: 14,
  lightWhenState: true,
});
def('campfire', {
  ...sprite,
  solid: false,
  interact: 'torch',
  hardness: 0.5,
  light: 14,
  lightWhenState: true,
  drop: [{ item: 'stick', min: 2, max: 3 }],
});
def('bed', { ...sprite, interact: 'bed', rotatable: true, tool: 'axe', hardness: 0.6 });
def('table', { ...sprite, tool: 'axe', hardness: 0.7, interact: 'table' });
def('chair', { ...sprite, solid: false, rotatable: true, tool: 'axe', hardness: 0.5, interact: 'sit' });
def('bench', { ...sprite, solid: false, rotatable: true, tool: 'axe', hardness: 0.6, interact: 'sit' });
def('well', { ...sprite, interact: 'well', tool: 'pick', hardness: 3, tall: true, drop: 'cobblestone' });
def('altar', { ...sprite, interact: 'altar', tool: 'pick', hardness: 3, drop: 'marble' });
def('sign', { ...sprite, interact: 'sign', rotatable: true, tool: 'axe', hardness: 0.4 });
def('notice_board', { ...sprite, interact: 'sign', tool: 'axe', hardness: 0.6, tall: true });
def('gravestone', { ...sprite, interact: 'grave', tool: 'pick', hardness: 1.5, drop: 'cobblestone' });
def('statue', { ...sprite, interact: 'statue', tool: 'pick', hardness: 4, tall: true, drop: 'marble' });
def('training_dummy', { ...sprite, tool: 'axe', hardness: 0.6, tall: true, drop: 'hay_bale' });
def('scarecrow', { ...sprite, tool: 'axe', hardness: 0.5, tall: true, drop: 'hay_bale' });
def('pumpkin', { ...sprite, hardness: 0.4, standable: false });
def('rug_red', { ...nonSolid, render: 'flat', hardness: 0.2, support: true, label: 'Red Rug' });
def('rug_blue', { ...nonSolid, render: 'flat', hardness: 0.2, support: true, label: 'Blue Rug' });
def('rug_green', { ...nonSolid, render: 'flat', hardness: 0.2, support: true, label: 'Green Rug' });
def('cobweb', { ...nonSolid, render: 'sprite', hardness: 0.3, drop: 'string', support: false });
def('rock', { ...sprite, tool: 'pick', hardness: 1, drop: [{ item: 'cobblestone', min: 1, max: 2 }] });
def('cactus', { ...sprite, hardness: 0.4 });
// --- plants -----------------------------------------------------------------
def('tall_grass', { ...plant, drop: [{ item: 'seeds', chance: 0.12 }] });
def('fern', { ...plant, drop: [{ item: 'seeds', chance: 0.05 }] });
def('flower_red', { ...plant, label: 'Poppy' });
def('flower_yellow', { ...plant, label: 'Buttercup' });
def('flower_blue', { ...plant, label: 'Cornflower' });
def('flower_white', { ...plant, label: 'Daisy' });
def('flower_purple', { ...plant, label: 'Lavender' });
def('bush', { ...plant, hardness: 0.2, drop: [{ item: 'stick', chance: 0.5 }] });
def('berry_bush', { ...plant, hardness: 0.2, drop: [{ item: 'berries', min: 1, max: 3 }] });
def('dead_bush', { ...plant, drop: [{ item: 'stick', min: 1, max: 2 }] });
def('reeds', { ...plant, drop: [{ item: 'reeds', min: 1, max: 1 }] });
def('mushroom_red', { ...plant, drop: 'mushroom', label: 'Red Mushroom' });
def('mushroom_brown', { ...plant, drop: 'mushroom', label: 'Brown Mushroom' });
def('herb', { ...plant, drop: [{ item: 'herb', min: 1, max: 2 }], label: 'Wild Herb' });
def('sapling', { ...plant, label: 'Sapling' });
def('lily_pad', { ...nonSolid, render: 'flat', hardness: 0.05, replaceable: true, drop: null });
def('wheat_crop', { ...plant, drop: [{ item: 'wheat', min: 1, max: 2 }, { item: 'seeds', chance: 0.5 }], label: 'Wheat' });
def('carrot_crop', { ...plant, drop: [{ item: 'carrot', min: 1, max: 3 }], label: 'Carrots' });
def('cabbage_crop', { ...plant, drop: [{ item: 'cabbage', min: 1, max: 1 }], label: 'Cabbage' });
// --- town life: jails, stools, hanging signs, snares (appended to keep ids stable)
def('iron_bars', { opaque: false, standable: false, tool: 'pick', hardness: 6, label: 'Iron Bars' });
def('cell_door', { opaque: false, standable: false, interact: 'cell_door', tool: 'pick', hardness: 7, drop: 'iron_bars', label: 'Cell Door' });
def('cell_door_open', { ...sprite, solid: false, interact: 'cell_door', tool: 'pick', hardness: 7, drop: 'iron_bars', label: 'Cell Door' });
def('stool', { ...sprite, solid: false, tool: 'axe', hardness: 0.4, interact: 'sit' });
def('hanging_sign', { ...sprite, solid: false, interact: 'sign', rotatable: true, tool: 'axe', hardness: 0.3, support: false, label: 'Hanging Sign' });
def('snare', { ...sprite, solid: false, interact: 'trap', tool: 'axe', hardness: 0.2, drop: [{ item: 'string', min: 1, max: 1 }, { item: 'stick', min: 1, max: 1 }], label: 'Snare' });
def('cell_door_top', { opaque: false, solid: false, standable: false, tool: 'pick', hardness: 7, drop: null, label: 'Iron Bars' });
// Farmland soaked by rain or a bucket: crops grow twice as fast in it.
def('farmland_wet', { tool: 'shovel', hardness: 0.5, drop: 'dirt', label: 'Moist Farmland' });
// A town's alarm bell: the watch rings it to raise the other guards.
def('bell', { ...sprite, interact: 'bell', tool: 'pick', hardness: 4, drop: 'iron_ingot', label: 'Alarm Bell' });
// A market stall's striped cloth canopy: its rotation is the way the stall's
// front faces, and its colour is kept in the bits above (see CANOPY_SHIFT).
export const CANOPY_SHIFT = 3;
def('canopy', { ...sprite, solid: false, rotatable: true, support: false, tool: 'axe', hardness: 0.3, drop: 'cloth', label: 'Stall Canopy' });
// Trade benches: every licensed trade has its own to work at (its
// `station` names the trade, and the recipes made there).
const bench = (name, station, label, extra = {}) => def(name, { ...sprite, interact: 'bench', station, tool: 'axe', hardness: 0.9, label, ...extra });
bench('loom', 'tailor', 'Tailor\'s Loom');
bench('alembic', 'herbalist', 'Herbalist\'s Still', { tool: 'pick', hardness: 1 });
bench('writing_desk', 'scribe', 'Scribe\'s Desk');
bench('jeweler_bench', 'jeweller', 'Jeweller\'s Bench', { tool: 'pick', hardness: 1.2 });
bench('oven', 'baker', 'Baker\'s Oven', { tool: 'pick', hardness: 1.4, light: 6 });
bench('grindstone', 'smith', 'Smith\'s Grindstone', { tool: 'pick', hardness: 1.5 });
bench('tanning_rack', 'trapper', 'Tanning Rack', { hardness: 0.7 });
bench('tackle_bench', 'fisher', 'Tackle Bench', { hardness: 0.7 });
bench('sawbench', 'woodcutter', 'Sawhorse', { hardness: 0.8 });
bench('potting_bench', 'farmer', 'Potting Bench', { hardness: 0.7 });
bench('rock_crusher', 'miner', 'Rock Crusher', { tool: 'pick', hardness: 2 });
// For weddings and feast days: posters put up around town the day before
// (a wedding's has a heart, a feast's a sun: kept in the state bit), and
// what the builders put up on the square for the day.
def('poster', { ...sprite, interact: 'sign', tool: 'axe', hardness: 0.3, drop: null, label: 'Poster' });
def('flower_arch', { ...sprite, solid: false, tall: true, tool: 'axe', hardness: 0.6, drop: null, label: 'Flower Arch' });
def('maypole', { ...sprite, tall: true, tool: 'axe', hardness: 0.8, drop: null, label: 'Maypole' });
def('bunting', { ...sprite, solid: false, rotatable: true, support: false, tool: 'axe', hardness: 0.2, drop: null, label: 'Bunting' });
def('feast_table', { ...sprite, tool: 'axe', hardness: 0.7, drop: null, label: 'Feast Table' });
// A traveller's tent, pitched outside town by nomads and visiting merchants
// while they stay: its rotation is the way the opening faces, its colour is
// kept above (CANOPY_SHIFT), and the state bit marks a merchant's stripes.
def('tent', { ...sprite, rotatable: true, tool: 'axe', hardness: 0.4, drop: 'cloth', label: 'Tent' });
// City gates: two leaves of heavy timber in a gateway through the wall.
// The lower half stops you when shut (the state bit is open); the upper
// half is only there to look at.
def('city_gate', { ...sprite, solid: true, rotatable: true, interact: 'gate', tool: 'axe', hardness: 4, drop: 'planks', label: 'City Gate', support: false });
def('city_gate_top', { ...sprite, solid: false, rotatable: true, interact: 'gate', tool: 'axe', hardness: 4, drop: null, label: 'City Gate', support: false });
// Something set down on the ground (what it is lives in game.placed): no
// collision, and you take it back by mining it, not by walking over it.
def('placed_item', { solid: false, opaque: false, render: 'placed', standable: false, support: true, hardness: 0.1, drop: [], label: 'Set down' });
// A banner on a pole, put up round town for a do. Its colours and mark are
// the town's own (the colour bits above CANOPY_SHIFT and the state bit pick
// one of eight: see DECOR_PALETTES); bunting takes its colours the same way.
def('festival_banner', { ...sprite, solid: false, tool: 'axe', hardness: 0.3, drop: null, label: 'Banner' });
// A portal (see sim/portals.js): a stone arch, its middle alight with a
// slow violet swirl; dark when cut off from the rest of its realm's.
def('portal', { ...sprite, tall: true, interact: 'portal', tool: 'pick', hardness: 9, light: 11, drop: null, label: 'Portal' });
def('portal_dark', { ...sprite, tall: true, interact: 'portal', tool: 'pick', hardness: 9, drop: null, label: 'Dark Portal' });
// Sun-baked clay slabs laid as a path: the lanes of towns in the sand,
// where a dirt track would vanish into the dunes.
def('flagstone', { tool: 'pick', hardness: 0.8, drop: 'cobblestone', label: 'Flagstone Path' });

// --- below ground ---------------------------------------------------------------
// Dungeons (see world/dungeongen.js and game/dungeon.js): the stone of each
// kind of place, and what's down there with it. Walls are slow to dig
// through (a dungeon is a maze for a reason); a few things give way.
def('barrow_stone', { tool: 'pick', hardness: 6, drop: 'cobblestone', label: 'Barrow Stones' });
def('barrow_earth', { tool: 'shovel', hardness: 3, drop: 'dirt', label: 'Packed Earth' });
def('crypt_brick', { tool: 'pick', hardness: 7, drop: 'cobblestone', label: 'Crypt Bricks' });
def('crypt_floor', { tool: 'pick', hardness: 5, drop: 'cobblestone', label: 'Crypt Flagstones' });
def('mine_rock', { tool: 'pick', hardness: 5, drop: 'cobblestone', label: 'Deep Rock' });
def('mine_beam', { tool: 'axe', hardness: 4, drop: 'planks', label: 'Pit Props' });
def('cave_rock', { tool: 'pick', hardness: 5, drop: 'cobblestone', label: 'Cave Rock' });
def('bones', { ...plant, drop: [{ item: 'bone', chance: 0.6 }], label: 'Old Bones' });
def('coffin', { ...sprite, solid: true, interact: 'coffin', rotatable: true, tool: 'axe', hardness: 2, drop: 'planks', label: 'Coffin' });
def('sarcophagus', { ...sprite, solid: true, interact: 'coffin', rotatable: true, hardness: Infinity, drop: null, label: 'Sarcophagus' });
def('pressure_plate', { solid: false, opaque: false, render: 'flat', standable: false, support: true, hardness: 2, tool: 'pick', drop: null, label: 'Loose Flagstone' });
def('arrow_slit', { tool: 'pick', hardness: 8, rotatable: true, drop: 'cobblestone', label: 'Arrow Slit' });
def('lever', { ...sprite, solid: false, interact: 'lever', rotatable: true, hardness: Infinity, drop: null, label: 'Lever' });
def('portcullis', { ...sprite, tall: true, solid: true, interact: 'portcullis', rotatable: true, hardness: Infinity, drop: null, label: 'Iron Gate' });
def('portcullis_up', { ...sprite, tall: true, solid: false, interact: 'portcullis', rotatable: true, hardness: Infinity, drop: null, label: 'Raised Gate' });
def('cracked_floor', { tool: 'pick', hardness: 0.6, drop: 'cobblestone', label: 'Cracked Flagstones' });
def('weak_wall', { tool: 'pick', hardness: 0.8, drop: 'cobblestone', label: 'Crumbling Wall' });
def('sealed_door', { ...sprite, tall: true, solid: true, interact: 'sealed', rotatable: true, hardness: Infinity, drop: null, label: 'Sealed Door' });
def('stairs_down', { interact: 'stairs', hardness: Infinity, drop: null, label: 'Stairs Down' });
def('stairs_up', { ...sprite, solid: false, interact: 'stairs', rotatable: true, hardness: Infinity, drop: null, label: 'Stairs Up' });
def('brazier', { ...sprite, interact: 'brazier', light: 10, lightWhenState: true, hardness: 2, tool: 'pick', drop: null, label: 'Brazier' });
// The ways in from above: a door in a barrow mound, a sinkhole, a mine's
// shaft, a cave's mouth. (Fallen in, once what's below is beaten.)
def('barrow_door', { ...sprite, tall: true, solid: true, interact: 'dungeon', hardness: Infinity, drop: null, label: 'Barrow Door' });
def('sinkhole', { interact: 'dungeon', hardness: Infinity, drop: null, label: 'Sinkhole' });
def('mine_shaft', { interact: 'dungeon', hardness: Infinity, drop: null, label: 'Mine Shaft' });
def('cave_mouth', { ...sprite, tall: true, solid: true, interact: 'dungeon', hardness: Infinity, drop: null, label: 'Cave Mouth' });
def('rubble_seal', { hardness: Infinity, drop: null, label: 'Fallen-In Entrance', interact: 'dungeon' });
// The Kavorent's: their spires, and the halls under them.
def('kav_pillar', { interact: 'kav_pillar', hardness: Infinity, drop: null, label: 'Kavorent Spire' });
def('kav_door', { ...sprite, tall: true, solid: false, interact: 'kav_lift', hardness: Infinity, drop: null, light: 6, label: 'Open Spire' });
def('kav_lift', { interact: 'kav_lift', hardness: Infinity, drop: null, light: 6, label: 'Lift Platform' });
def('kav_wall', { hardness: Infinity, drop: null, label: 'Kavorent Alloy' });
def('kav_floor', { hardness: Infinity, drop: null, label: 'Kavorent Floor' });
def('kav_glow', { hardness: Infinity, drop: null, light: 7, label: 'Light Seam' });
def('kav_debris', { tool: 'pick', hardness: 2.5, drop: [{ item: 'kav_scrap', chance: 0.3 }, { item: 'cobblestone', chance: 0.5 }], label: 'Fallen Alloy' });
def('kav_field', { solid: true, opaque: false, render: 'sprite', standable: false, support: false, tall: true, hardness: Infinity, drop: null, light: 6, label: 'Force Wall' });
def('kav_console', { ...sprite, interact: 'kav_console', hardness: Infinity, drop: null, light: 4, label: 'Glyph Console' });
def('kav_plate', { solid: false, opaque: false, render: 'flat', standable: false, support: true, hardness: Infinity, drop: null, light: 3, label: 'Glyph Plate' });
def('kav_node', { ...sprite, interact: 'kav_node', hardness: Infinity, drop: null, light: 5, label: 'Power Node' });
def('kav_seal', { ...sprite, tall: true, solid: true, interact: 'sealed', hardness: Infinity, drop: null, light: 4, label: 'Vault Seal' });
def('kav_cache', { ...sprite, interact: 'container', hardness: Infinity, drop: null, light: 3, label: 'Kavorent Cache' });
def('kav_emitter', { hardness: Infinity, drop: null, rotatable: true, light: 4, label: 'Emitter' });
// What a realm that has learned the Kavorent's arts puts up in its towns
// (see sim/ancient.js): cold lamps along the streets, ward pylons round the
// edge, a basin of mending light by the well.
def('kav_lamp', { ...sprite, tall: true, solid: true, hardness: Infinity, drop: null, light: 12, label: 'Coldfire Lamp' });
def('kav_pylon', { ...sprite, tall: true, solid: true, hardness: Infinity, drop: null, light: 8, label: 'Ward Pylon' });
def('kav_basin', { ...sprite, solid: true, hardness: Infinity, drop: null, light: 9, label: 'Mending Spring' });
// A relic set down: its power reaches all round it (see game/relics.js).
def('relic', { ...sprite, interact: 'relic', tool: 'pick', hardness: 1, drop: null, light: 6, label: 'Relic' });
// The ship you sailed on (see voyage.js): its canvas and its wheel.
def('sail', { tool: 'axe', hardness: 0.4, drop: 'cloth', label: 'Sailcloth' });
def('helm', { ...sprite, solid: true, hardness: 1, tool: 'axe', drop: null, label: 'Ship\'s Wheel' });
// What else is down there (see dungeongen.js, decorate): the dressing of
// each kind of place; the master's great gate (down behind you, up again
// when it's dead); a holdout's alarm gong; kegs of powder that go up.
const dressing = { ...sprite, solid: false };
def('cobweb', { ...dressing, hardness: 0.2, drop: [{ item: 'string', chance: 0.5 }], label: 'Cobwebs' });
def('urn', { ...sprite, solid: true, hardness: 0.2, drop: [{ item: 'old_coin', chance: 0.2 }, { item: 'bone', chance: 0.15 }], label: 'Burial Urn' });
def('candles', { ...dressing, hardness: 0.1, light: 6, drop: null, label: 'Candles' });
def('statue', { ...sprite, tall: true, solid: true, tool: 'pick', hardness: 8, drop: 'cobblestone', label: 'Old Statue' });
def('skull_pile', { ...sprite, solid: true, hardness: 0.6, drop: [{ item: 'bone', chance: 0.8, min: 1, max: 3 }], label: 'Heaped Skulls' });
def('mine_cart', { ...sprite, solid: true, tool: 'axe', hardness: 2, drop: [{ item: 'iron_ore', chance: 0.5 }, { item: 'coal', chance: 0.5 }], label: 'Ore Cart' });
def('stalagmite', { ...sprite, solid: true, tool: 'pick', hardness: 1.5, drop: [{ item: 'cobblestone', chance: 0.6 }], label: 'Stalagmite' });
def('glowshroom', { ...dressing, hardness: 0.05, light: 5, drop: null, label: 'Glowcaps' });
def('weapon_rack', { ...sprite, solid: true, tool: 'axe', hardness: 1.5, drop: [{ item: 'spear', chance: 0.2 }, { item: 'planks', chance: 0.6 }], label: 'Weapon Rack' });
def('war_banner', { ...dressing, tall: true, tool: 'axe', hardness: 0.3, drop: [{ item: 'cloth', chance: 0.6 }], label: 'War Banner' });
def('hanging_chains', { ...dressing, tall: true, tool: 'pick', hardness: 1, drop: null, label: 'Hanging Chains' });
def('powder_keg', { ...sprite, solid: true, hardness: 0.3, drop: null, label: 'Powder Keg' });
def('roots', { ...dressing, tall: true, tool: 'axe', hardness: 0.2, drop: [{ item: 'stick', chance: 0.5 }], label: 'Hanging Roots' });
def('rubble', { ...dressing, tool: 'shovel', hardness: 0.2, drop: [{ item: 'cobblestone', chance: 0.4 }], label: 'Rubble' });
def('bone_throne', { ...sprite, tall: true, solid: true, hardness: Infinity, drop: null, label: 'Throne of Bones' });
def('boss_gate', { ...sprite, tall: true, solid: true, interact: 'boss_gate', rotatable: true, hardness: Infinity, drop: null, label: 'Great Gate' });
def('boss_gate_open', { ...sprite, tall: true, solid: false, interact: 'boss_gate', rotatable: true, hardness: Infinity, drop: null, label: 'Great Gate (Raised)' });
def('kav_gate', { ...sprite, tall: true, solid: true, interact: 'boss_gate', rotatable: true, hardness: Infinity, drop: null, light: 4, label: 'Hall Door' });
def('gong', { ...sprite, solid: true, tool: 'axe', hardness: 1.5, drop: null, label: 'Alarm Gong' });
// A Kavorent spire's keystone (a hollow in it the shape of a cut stone),
// and the blight round a spire: the turf and the trees gone violet, and
// what grows in it.
def('kav_keystone', { interact: 'kav_pillar', hardness: Infinity, drop: null, light: 3, label: 'Keystone' });
def('grass_void', { tool: 'shovel', hardness: 0.6, drop: 'dirt', label: 'Blighted Turf' });
def('leaves_void', { ...leaves(), drop: [{ item: 'stick', chance: 0.1 }], label: 'Blighted Leaves' });
def('void_bloom', { ...dressing, hardness: 0.05, light: 4, drop: null, label: 'Voidbloom' });
def('glow_crystal', { ...dressing, tool: 'pick', hardness: 0.6, light: 5, drop: [{ item: 'kav_scrap', chance: 0.15 }], label: 'Weird Crystals' });
def('tendril', { ...dressing, tall: true, hardness: 0.1, light: 2, drop: null, label: 'Tendril' });
def('eye_stalk', { ...dressing, hardness: 0.1, drop: null, label: 'Watcher Stalk' });
// The Kavorent's halls dressed to overawe you: sentinels taller than you
// are, black monoliths crawling with glyphs, light-screens, conduits, the
// husks of fallen constructs, and vents breathing in the floor.
def('kav_statue', { ...sprite, tall: true, solid: true, hardness: Infinity, drop: null, light: 2, label: 'Sentinel' });
def('kav_monolith', { ...sprite, tall: true, solid: true, hardness: Infinity, drop: null, light: 5, label: 'Glyph Monolith' });
def('kav_holo', { ...sprite, tall: true, solid: true, hardness: Infinity, drop: null, light: 4, label: 'Light-Screen' });
def('kav_conduit', { ...sprite, solid: true, hardness: Infinity, drop: null, light: 3, label: 'Conduit' });
def('kav_husk', { ...sprite, solid: true, rotatable: true, tool: 'pick', hardness: 3, drop: [{ item: 'kav_scrap', chance: 0.5 }], label: 'Fallen Construct' });
def('kav_vent', { ...dressing, hardness: Infinity, drop: null, label: 'Vent' });
// Your pack, left where you fell below ground (what you'd found down there).
def('satchel', { ...sprite, solid: false, interact: 'container', hardness: Infinity, drop: null, light: 3, label: 'Fallen Pack' });
// A row of spikes in a passage's floor that come up in their turn; an old
// idol that blesses whoever lays a hand on it, once (lit till then).
def('spikes', { ...dressing, hardness: Infinity, drop: null, label: 'Spike Trap' });
def('idol', { ...sprite, solid: true, interact: 'idol', hardness: Infinity, drop: null, light: 6, lightWhenState: true, label: 'Old Idol' });
// Where the blight's got into a Kavorent ruin: its floor and walls veined
// violet (see dungeongen.js, blightRoom).
def('blight_floor', { hardness: Infinity, drop: null, label: 'Blighted Alloy' });
def('blight_wall', { hardness: Infinity, drop: null, label: 'Blighted Alloy' });
// Snow the blight's got into, round a spire in the cold: gone lavender,
// veined violet. (Last, so no block saved before it changes number.)
def('snow_void', { tool: 'shovel', hardness: 0.3, drop: 'snow', label: 'Blighted Snow' });
// --- the other Dagoni Islands (after all the rest, so no saved number moves)
// Kharos, the fire island: ash over basalt, black glass, cinders, yellow
// sulphur crust round the steam vents, lava (which you can wade into, once),
// and the black-barked cinder trees with their ember-red leaves. Ground
// burned bare by the mountain's fire is scorched.
def('ash', { tool: 'shovel', hardness: 0.4, label: 'Ash' });
def('basalt', { tool: 'pick', hardness: 2 });
def('obsidian', { tool: 'pick', hardness: 4, drop: [{ item: 'obsidian_shard', chance: 1, min: 1, max: 3 }] });
def('lava', { solid: false, opaque: false, render: 'liquid', hardness: Infinity, drop: null, light: 13, lava: true, label: 'Lava' });
def('cinder', { tool: 'shovel', hardness: 0.5, label: 'Cinders' });
def('sulfur_crust', { tool: 'pick', hardness: 1, drop: [{ item: 'sulfur', chance: 1, min: 1, max: 2 }], label: 'Sulphur Crust' });
def('steam_vent', { ...sprite, solid: false, hardness: Infinity, drop: null, label: 'Steam Vent' });
def('log_cinder', { tool: 'axe', hardness: 1.4, label: 'Cinderwood Log' });
def('leaves_ember', { ...leaves([{ item: 'ember_pod', chance: 0.05 }]), light: 1, label: 'Ember Leaves' });
def('fire_lily', { ...plant, light: 3, label: 'Fire Lily' });
def('scorched', { tool: 'shovel', hardness: 0.5, drop: 'dirt', label: 'Scorched Earth' });
// Myrrow, the misty island: moss and peat on the moors, purple heather,
// mangroves standing in the shallows, and the fungal forests (white
// mycelium underfoot, and mushrooms the height of houses, some of them
// glowing blue).
def('moss', { tool: 'shovel', hardness: 0.5, drop: 'dirt', label: 'Moss' });
def('peat', { tool: 'shovel', hardness: 0.6, drop: [{ item: 'peat_turf', chance: 1, min: 1, max: 2 }], label: 'Peat' });
def('heather', { ...plant, label: 'Heather' });
def('mycelium', { tool: 'shovel', hardness: 0.5, drop: 'dirt', label: 'Mycelium' });
def('log_mangrove', { tool: 'axe', hardness: 1.2, label: 'Mangrove Log' });
def('leaves_mangrove', leaves([{ item: 'mangrove_pod', chance: 0.04 }]));
def('mushroom_stem', { tool: 'axe', hardness: 0.8, drop: [{ item: 'mushroom_brown', chance: 0.5 }], label: 'Giant Mushroom Stem' });
def('mushroom_cap', { solid: false, opaque: false, tool: 'axe', hardness: 0.3, drop: [{ item: 'mushroom_red', chance: 0.3 }], label: 'Giant Mushroom Cap' });
def('glowcap_cap', { solid: false, opaque: false, tool: 'axe', hardness: 0.3, light: 7, drop: [{ item: 'glowcap', chance: 0.4 }], label: 'Glowcap' });
// Round 34: the islands' own roofs (the Mirefolk's spotted mushroom-cap
// and moss, the Stiltfolk's reed), and the Ashborn's brazier, their
// lamp-post and rooftop fire.
def('roof_mushroom', { tool: 'axe', hardness: 0.5, rotatable: true, drop: 'mushroom_red', label: 'Mushroom-Cap Roof' });
def('roof_moss', { hardness: 0.4, rotatable: true, drop: 'moss', label: 'Moss Roof' });
def('roof_reed', { hardness: 0.4, rotatable: true, label: 'Reed Thatch' });
def('ash_brazier', { ...sprite, interact: 'torch', tool: 'pick', hardness: 1.2, light: 14, lightWhenState: true, drop: 'basalt', label: 'Brazier' });
// The islands' own trades (see isletrades.js): Thessa's millstone, and the
// sails of its windmills on their hub; Kharos's glass kiln, never let go
// out; the Mirefolk's spore beds, glowing faintly; the Stiltfolk's table
// for sorting pearls from the shell.
bench('millstone', 'miller', 'Millstone', { tool: 'pick', hardness: 1.4 });
bench('glass_kiln', 'glassblower', 'Glass Kiln', { tool: 'pick', hardness: 1.5, light: 9 });
bench('spore_bed', 'sporewright', 'Spore Bed', { hardness: 0.6, light: 4 });
bench('pearl_table', 'pearldiver', 'Pearl-Sorting Table', { hardness: 0.7 });
def('mill_sail', { solid: false, opaque: false, render: 'none', tool: 'axe', hardness: 0.3, drop: 'cloth', label: 'Windmill Sail' });
def('mill_hub', { tool: 'axe', hardness: 1, drop: 'planks', label: 'Windmill Hub' });
// The islands' own old places (see isledeep.js): Thessa's Wildwood
// Hollows under the roots of the oldest trees (walls of living root, and
// briars, which some down there can grow at will); Kharos's Kiln-Deeps,
// the forges of the old Kiln-Kings (basalt brick, a floor of cooled slag,
// crucibles); Myrrow's Tide Grottoes (rock crusted with coral, shell sand,
// coral growing up out of it, kelp, giant clams). Each with its own way
// in. And the black brick of a Kharos crypt.
def('root_wall', { tool: 'axe', hardness: 6, drop: [{ item: 'stick', chance: 0.6 }], label: 'Living Roots' });
def('briar', { ...sprite, solid: true, tool: 'axe', hardness: 0.4, drop: [{ item: 'stick', chance: 0.4 }], label: 'Briars' });
def('forge_brick', { tool: 'pick', hardness: 7, drop: 'basalt', label: 'Forge Brick' });
def('slag', { tool: 'pick', hardness: 3, drop: [{ item: 'iron_ore', chance: 0.08 }], label: 'Slag' });
def('crucible', { ...sprite, solid: true, tool: 'pick', hardness: 3, light: 9, drop: null, label: 'Crucible' });
def('coral_rock', { tool: 'pick', hardness: 6, drop: 'cobblestone', label: 'Coral Rock' });
def('shell_sand', { tool: 'shovel', hardness: 0.5, drop: 'sand', label: 'Shell Sand' });
def('coral', { ...sprite, solid: false, tool: 'pick', hardness: 0.8, light: 2, drop: [{ item: 'pearl', chance: 0.04 }], label: 'Coral' });
def('kelp', { ...dressing, tall: true, hardness: 0.1, drop: null, label: 'Kelp' });
def('giant_clam', { ...sprite, solid: true, tool: 'pick', hardness: 2, drop: [{ item: 'pearl', chance: 0.5, min: 1, max: 2 }], label: 'Giant Clam' });
def('basalt_bricks', { tool: 'pick', hardness: 7, drop: 'basalt', label: 'Basalt Bricks' });
def('hollow_door', { ...sprite, tall: true, solid: true, interact: 'dungeon', hardness: Infinity, drop: null, label: 'Hollow in the Roots' });
def('forge_door', { ...sprite, tall: true, solid: true, interact: 'dungeon', hardness: Infinity, drop: null, light: 6, label: 'Forge Door' });
def('grotto_mouth', { ...sprite, tall: true, solid: true, interact: 'dungeon', hardness: Infinity, drop: null, label: 'Grotto Mouth' });
// Round 36: what the Ashborn build with, so their houses stand out from
// the black ground they're built on: walls of pale ash plaster (lime and
// pumice, washed every spring), roofs of terracotta kiln tile, a hall's
// walls of glazed kiln brick, and green copper sheeting over the great
// roofs.
def('ash_plaster', { tool: 'pick', hardness: 1, label: 'Ash Plaster' });
def('kiln_tile', { tool: 'pick', hardness: 1.2, label: 'Kiln Tile' });
def('kiln_brick', { tool: 'pick', hardness: 2, label: 'Kiln Brick' });
def('copper_roof', { tool: 'pick', hardness: 1.5, label: 'Copper Sheeting' });
// The great things in each people's square (drawn bigger than their pace:
// see render/pieces.js), and the stone they stand on, round them (the
// paces beside and behind, kept clear of anyone: an unseen plinth).
//   A fountain, where a Thessan town has learned to bring water in;
//   the Ashborn's heartfire, a great bowl of fire on a basalt dais, and the
// heart-crystal it becomes once they've learned to raise the ember ward;
//   the Mirefolk's Old Glowcap, a mushroom grown as tall as a house (grown
// greater still, and brighter, once they know the heart of the mire);
//   the Stiltfolk's conch fountain, water poured from a great shell on a
// coral spire (pearls set glowing in it too, with the heart of the mire).
def('fountain', { ...sprite, tall: true, interact: 'well', hardness: Infinity, drop: null, label: 'Fountain' });
def('heartfire', { ...sprite, tall: true, hardness: Infinity, drop: null, light: 15, lightWhenState: true, label: 'Heartfire' });
def('heart_crystal', { ...sprite, tall: true, hardness: Infinity, drop: null, light: 15, label: 'Heart-Crystal' });
def('great_glowcap', { ...sprite, tall: true, hardness: Infinity, drop: null, light: 10, lightState: 15, label: 'The Old Glowcap' });
def('conch_fountain', { ...sprite, tall: true, interact: 'well', hardness: Infinity, drop: null, light: 4, lightState: 12, label: 'Conch Fountain' });
def('plinth', { solid: true, opaque: false, render: 'none', standable: false, hardness: Infinity, drop: null, label: 'Plinth' });
// What the islands' learning puts up about their towns: the Ashborn's lamps
// of amber glass, and the bronze grates of their magma forges set in the
// streets over channels of the mountain's heat; the Mirefolk's fog
// lanterns; squares laid in nacre by the pearl divers.
def('glass_lamp', { ...sprite, tall: true, tool: 'pick', hardness: 1, light: 13, drop: 'glass', label: 'Glass Lamp' });
def('ember_gutter', { tool: 'pick', hardness: 2, light: 6, drop: 'basalt', label: 'Ember Grate' });
def('fog_lantern', { ...sprite, tall: true, tool: 'axe', hardness: 1, light: 11, drop: null, label: 'Fog Lantern' });
def('nacre_tile', { tool: 'pick', hardness: 1.5, label: 'Nacre Tiles' });

// Round 37: planking in each far people's own wood (decks, piers, the
// boardwalks over the water and the bog, boards over a poor house's
// windows): the Ashborn's black-red cinderwood, the Mirefolk's grey-green
// bogwood, the Stiltfolk's sea-bleached driftwood. (Thessa's peoples use
// oak.)
def('planks_cinder', { tool: 'axe', hardness: 1, label: 'Cinderwood Planks' });
def('planks_bog', { tool: 'axe', hardness: 1, label: 'Bogwood Planks' });
def('planks_drift', { tool: 'axe', hardness: 1, label: 'Driftwood Planks' });
// Rock the blight's got into, round a spire on stony ground (a mountain's
// foot, the desert's sandstone, the fire island's basalt): gone
// violet-black, veined. (Last, so no saved number moves.)
def('rock_void', { tool: 'pick', hardness: 1.5, drop: 'cobblestone', label: 'Blighted Rock' });
// A column of frozen coolant the Crucible throws up before it blows (see
// entities/bosses_spire.js): shelter, a while.
def('kav_coolant', { hardness: Infinity, drop: null, light: 6, label: 'Coolant Column' });

// Round 68: what the far lands' peoples build with (see world/farlands.js):
// the Velari's warm travertine, their fluted marble columns and red barrel
// tiles; the Rimeborn's frost-dark logs and roofs of living turf; the Jade
// Court's red-lacquered posts, paper screens, bamboo floors and roofs of
// green glazed tile; the Keshari's red adobe and turquoise mosaic; the
// Bonewrights' whalebone; the Saltfolk's white salt brick and blue glaze;
// the Hollowfolk's cob; the drystone of the Wyrd Isle and the Skerries,
// and the Skerrymen's thatch roped down against the gales.
def('travertine', { tool: 'pick', hardness: 1.8, label: 'Travertine' });
def('roof_terracotta', { tool: 'pick', hardness: 1.2, rotatable: true, label: 'Barrel-Tile Roof' });
def('marble_column', { tool: 'pick', hardness: 2.2, drop: 'marble', label: 'Marble Column' });
def('log_frost', { tool: 'axe', hardness: 1.3, label: 'Frost-Dark Logs' });
def('roof_turf', { tool: 'shovel', hardness: 0.6, rotatable: true, drop: 'dirt', label: 'Turf Roof' });
def('planks_lacquer', { tool: 'axe', hardness: 1.1, label: 'Lacquered Wood' });
def('paper_wall', { tool: 'axe', hardness: 0.5, label: 'Paper Screen' });
def('roof_jade', { tool: 'pick', hardness: 1.2, rotatable: true, label: 'Jade Tile Roof' });
def('bamboo', { tool: 'axe', hardness: 0.8, label: 'Bamboo Boards' });
def('adobe_red', { tool: 'pick', hardness: 0.9, label: 'Red Adobe' });
def('turquoise_tile', { tool: 'pick', hardness: 1.5, label: 'Turquoise Mosaic' });
def('whalebone', { tool: 'pick', hardness: 1.6, label: 'Whalebone' });
def('salt_brick', { tool: 'pick', hardness: 1, label: 'Salt Brick' });
def('tile_blue', { tool: 'pick', hardness: 1.2, rotatable: true, label: 'Blue Glaze' });
def('cob', { tool: 'shovel', hardness: 0.8, drop: 'dirt', label: 'Cob' });
def('drystone', { tool: 'pick', hardness: 2, drop: 'cobblestone', label: 'Drystone' });
def('roof_rope', { hardness: 0.5, rotatable: true, label: 'Roped Thatch' });
// The great things in the far peoples' squares (drawn whole: see
// render/farpieces.js): the Velari's triumphal column, its gilt eagle
// over the forum; the Rimeborn's frost hearth, a fire of blue ice in a
// ring of antlered stones; the Jade Court's bell pagoda; the Keshari's
// sun wheel over the kiva; the Bonewrights' arch of a great whale's jaws;
// the Saltfolk's salt obelisk in its pink pool (water drawn from it like a
// well's); the Hollowfolk's lantern tree; the Wyrdfolk's ring of
// runestones; the Skerrymen's beacon.
def('triumph_column', { ...sprite, tall: true, hardness: Infinity, drop: null, light: 6, label: 'Triumphal Column' });
def('frost_hearth', { ...sprite, tall: true, hardness: Infinity, drop: null, light: 13, lightWhenState: true, label: 'Frost Hearth' });
def('bell_pagoda', { ...sprite, tall: true, hardness: Infinity, drop: null, light: 9, label: 'Bell Pagoda' });
def('sun_wheel', { ...sprite, tall: true, hardness: Infinity, drop: null, light: 8, label: 'Sun Wheel' });
def('jaw_arch', { ...sprite, tall: true, hardness: Infinity, drop: null, light: 8, label: 'Whale-Jaw Arch' });
def('salt_obelisk', { ...sprite, tall: true, interact: 'well', hardness: Infinity, drop: null, light: 5, label: 'Salt Obelisk' });
def('lantern_tree', { ...sprite, tall: true, hardness: Infinity, drop: null, light: 14, label: 'Lantern Tree' });
def('stone_ring', { ...sprite, tall: true, hardness: Infinity, drop: null, light: 7, label: 'Ring of Runestones' });
def('beacon', { ...sprite, tall: true, hardness: Infinity, drop: null, light: 15, lightWhenState: true, label: 'Beacon' });
// Round 68: the far lands' own ground, trees and plants (see biomes.js):
// Velmarch's golden olive hills (olive trees and dark cypresses, vines
// heavy with grapes) and its frozen rimewood (birches white with frost,
// leaves of ice, flowers of ice that glow); Ostria's bamboo groves (and
// cherry trees in blossom, peonies) and its red mesas (red rock, saguaro
// and prickly pear); Corrow's bone strand (pale sand, the ribs of whales,
// sea grass); Saltmere's salt flats (the crust, its crystals, saltbush);
// Hollowmark's lantern hollows (giant ferns, glowberries, lantern trees);
// the Wyrd Isle's rune heath (silver birches, fairy rings, standing
// stones); the Skerries' sea cliffs (thrift, and cairns).
def('grass_gold', { tool: 'shovel', hardness: 0.6, drop: 'dirt', label: 'Golden Grass' });
def('frost_grass', { tool: 'shovel', hardness: 0.6, drop: 'dirt', label: 'Frosted Grass' });
def('red_rock', { tool: 'pick', hardness: 1.4, drop: 'cobblestone', label: 'Red Rock' });
def('salt_crust', { tool: 'shovel', hardness: 0.7, label: 'Salt Crust' });
def('bone_sand', { tool: 'shovel', hardness: 0.5, drop: 'sand', label: 'Bone Sand' });
def('heath', { tool: 'shovel', hardness: 0.6, drop: 'dirt', label: 'Heath' });
def('log_olive', { tool: 'axe', hardness: 1.2, label: 'Olive Log' });
def('leaves_olive', { ...leaves([{ item: 'olives', chance: 0.12 }]), label: 'Olive Leaves' });
def('leaves_cypress', { ...leaves(), label: 'Cypress Needles' });
def('log_frostbirch', { tool: 'axe', hardness: 1.1, label: 'Frost Birch Log' });
def('leaves_frost', { ...leaves([{ item: 'frost_crystal', chance: 0.04 }]), light: 2, label: 'Ice Leaves' });
def('bamboo_stalk', { tool: 'axe', hardness: 0.6, drop: [{ item: 'bamboo_cane', min: 1, max: 2 }], label: 'Bamboo Stalk' });
def('leaves_bamboo', { ...leaves(), label: 'Bamboo Leaves' });
def('log_cherry', { tool: 'axe', hardness: 1.1, label: 'Cherry Log' });
def('leaves_blossom', { ...leaves([{ item: 'cherries', chance: 0.06 }]), label: 'Cherry Blossom' });
def('leaves_lantern', { ...leaves([{ item: 'lantern_pod', chance: 0.12 }]), light: 4, label: 'Lantern Leaves' });
def('leaves_silver', { ...leaves(), label: 'Silver Birch Leaves' });
def('vine', { ...plant, drop: [{ item: 'grapes', chance: 0.6, min: 1, max: 2 }], label: 'Vine' });
def('ice_flower', { ...plant, light: 5, drop: [{ item: 'frost_crystal', chance: 0.25 }], label: 'Ice Flower' });
def('peony', { ...plant, label: 'Peony' });
def('prickly_pear', { ...plant, drop: [{ item: 'cactus_fruit', chance: 0.6 }], label: 'Prickly Pear' });
def('sea_grass', { ...plant, label: 'Sea Grass' });
def('saltbush', { ...plant, drop: [{ item: 'salt', chance: 0.3 }], label: 'Saltbush' });
def('giant_fern', { ...plant, label: 'Giant Fern' });
def('glowberry_bush', { ...plant, light: 6, drop: [{ item: 'glowberries', min: 1, max: 3 }], label: 'Glowberry Bush' });
def('fairy_ring', { ...plant, light: 4, label: 'Fairy Ring' });
def('thrift', { ...plant, label: 'Sea Thrift' });
def('whale_rib', { ...sprite, tall: true, solid: true, tool: 'pick', hardness: 2, drop: [{ item: 'bone', min: 2, max: 4 }], label: 'Whale Rib' });
def('salt_crystal', { ...sprite, solid: true, tool: 'pick', hardness: 1, light: 3, drop: [{ item: 'salt', min: 1, max: 3 }], label: 'Salt Crystals' });
def('standing_stone', { ...sprite, tall: true, solid: true, tool: 'pick', hardness: 6, drop: 'cobblestone', light: 2, label: 'Standing Stone' });
def('cairn', { ...sprite, solid: true, tool: 'pick', hardness: 2, drop: 'cobblestone', label: 'Cairn' });
// (Round 68) The ways into the far lands' own old places (see
// world/fardeep.js and sites.js).
def('catacomb_door', { ...sprite, tall: true, solid: true, interact: 'dungeon', hardness: Infinity, drop: null, light: 3, label: 'Catacomb Gate' });
def('vault_door', { ...sprite, tall: true, solid: true, interact: 'dungeon', hardness: Infinity, drop: null, light: 4, label: 'Vault Doors' });
def('gut_mouth', { ...sprite, tall: true, solid: true, interact: 'dungeon', hardness: Infinity, drop: null, label: 'Whale\'s Maw' });
def('salt_door', { ...sprite, tall: true, solid: true, interact: 'dungeon', hardness: Infinity, drop: null, light: 4, label: 'Cathedral Door' });
def('warren_hole', { ...sprite, tall: true, solid: true, interact: 'dungeon', hardness: Infinity, drop: null, light: 3, label: 'Warren Hole' });
def('mound_door', { ...sprite, tall: true, solid: true, interact: 'dungeon', hardness: Infinity, drop: null, light: 5, label: 'Door in the Hill' });
def('broch_door', { ...sprite, tall: true, solid: true, interact: 'dungeon', hardness: Infinity, drop: null, label: 'Broch Door' });

function cap(s) {
  return s[0].toUpperCase() + s.slice(1);
}

export const AIR = B.air;
export const WATER = B.water;

export function isSolid(id) {
  return BLOCKS[id].solid;
}
export function isOpaque(id) {
  return BLOCKS[id].opaque;
}

// Block ids that count as a road for pathfinding cost / settlement logic.
// The ground itself (as it lies, not as anyone set it): what digging goes
// through, and what's drawn as cut rock when you're down in it.
export const NATURAL = new Set(['stone', 'dirt', 'grass', 'grass_lush', 'grass_dry', 'grass_jungle', 'grass_taiga', 'sand', 'sandstone', 'snow', 'mud', 'gravel', 'clay', 'coal_ore', 'iron_ore', 'gold_ore', 'gem_ore', 'bedrock', 'mine_rock', 'cave_rock',
  'ash', 'basalt', 'obsidian', 'cinder', 'sulfur_crust', 'scorched', 'moss', 'peat', 'mycelium',
  'grass_gold', 'frost_grass', 'red_rock', 'salt_crust', 'bone_sand', 'heath'].filter((k) => B[k] !== undefined).map((k) => B[k]));
// Ores, and the glint they show in a cut wall.
export const ORE_GLINT = new Map([['coal_ore', '#3a3a44'], ['iron_ore', '#e0b090'], ['gold_ore', '#ffd84a'], ['gem_ore', '#7affe0']].filter(([k]) => B[k] !== undefined).map(([k, c]) => [B[k], c]));
export const ROAD_BLOCKS = new Set([B.path, B.flagstone, B.cobblestone, B.gravel, B.stone_bricks, B.planks, B.planks_dark, B.basalt, B.mossy_bricks, B.planks_cinder, B.planks_bog, B.planks_drift, B.travertine, B.turquoise_tile, B.salt_brick, B.bamboo]);
// The planks a people lays (by its town's style): see planks_cinder.
const STYLE_PLANKS = { ember: B.planks_cinder, mist: B.planks_bog, tide: B.planks_drift, rime: B.planks_dark, jade: B.bamboo, corrow: B.planks_drift, salt: B.planks_birch, wyrd: B.planks_dark, skerry: B.planks_dark };
export const planksOf = (style) => STYLE_PLANKS[style] || B.planks;
export const PLANK_BLOCKS = new Set([B.planks, B.planks_birch, B.planks_dark, B.planks_cinder, B.planks_bog, B.planks_drift, B.bamboo, B.planks_lacquer]);
export const LOGS = new Set(
  ['oak', 'birch', 'pine', 'palm', 'jungle', 'acacia', 'willow', 'cinder', 'mangrove', 'olive', 'frostbirch', 'cherry'].map((w) => B[`log_${w}`]),
);
export const LEAVES = new Set(
  ['oak', 'birch', 'pine', 'palm', 'jungle', 'acacia', 'willow', 'snowy', 'ember', 'mangrove', 'olive', 'cypress', 'frost', 'bamboo', 'blossom', 'lantern', 'silver'].map((w) => B[`leaves_${w}`]),
);

// Crops: how many visual stages they pass through, game hours per stage,
// what you plant them from and what they yield.
export const CROPS = {
  [B.wheat_crop]: { stages: 4, hours: 18, seed: 'seeds', produce: 'wheat' },
  [B.carrot_crop]: { stages: 3, hours: 20, seed: 'carrot', produce: 'carrot' },
  [B.cabbage_crop]: { stages: 4, hours: 22, seed: 'cabbage_seeds', produce: 'cabbage' },
};

export function isFarmland(id) {
  return id === B.farmland || id === B.farmland_wet;
}

export function cropStage(meta) {
  return (meta & META_AGE) >> 3;
}

export function cropMeta(id, stage) {
  const c = CROPS[id];
  return c ? Math.max(0, Math.min(c.stages - 1, stage)) << 3 : 0;
}

export function cropMature(id, meta) {
  const c = CROPS[id];
  return !c || cropStage(meta) >= c.stages - 1;
}
