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
def('rug_red', { ...nonSolid, render: 'flat', rug: true, hardness: 0.2, support: true, label: 'Red Rug' });
def('rug_blue', { ...nonSolid, render: 'flat', rug: true, hardness: 0.2, support: true, label: 'Blue Rug' });
def('rug_green', { ...nonSolid, render: 'flat', rug: true, hardness: 0.2, support: true, label: 'Green Rug' });
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
// (Round 79) And its people's way with a canopy, in the bits above that
// (see CANOPY_STYLES): stripes, a fringed cloth, a check, a curled eave, a
// woven mat, a laced hide, a gilt scallop, a lacquered board.
export const CANOPY_STYLE_SHIFT = 5;
export const CANOPY_STYLES = { vale: 0, mist: 1, tide: 2, jade: 3, sun: 4, kesh: 4, north: 5, rime: 5, skerry: 5, velmarch: 6, ostria: 6, velari: 6, ember: 7, corrow: 2, salt: 4, hollow: 1, wyrd: 3 };
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
def('weapon_rack', { ...sprite, solid: true, interact: 'display', display: 3, displayKind: 'weapon', tool: 'axe', hardness: 1.5, label: 'Weapon Rack' });
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
// (Round 68) What the great ships are built of (see world/shipmodels.js):
// their tarred hull planking and scrubbed decks, the rail round the deck
// (nobody stands on that), the ports the guns run out of, the stern's
// windows and gilded carving, the masts, the copper sheathing under the
// waterline; and below deck, the guns on their carriages, the crew's
// hammocks, the bilge pump and the capstan.
def('hull_planks', { tool: 'axe', hardness: 1.4, drop: 'planks', label: 'Hull Planking' });
def('deck_planks', { tool: 'axe', hardness: 1.1, drop: 'planks', label: 'Deck Planking' });
def('ship_rail', { tool: 'axe', hardness: 1.1, drop: 'planks', standable: false, label: 'Ship\'s Rail' });
def('gunport', { tool: 'axe', hardness: 1.4, drop: 'planks', label: 'Gunport' });
def('stern_window', { tool: 'axe', hardness: 0.6, opaque: false, drop: 'glass', label: 'Stern Window' });
def('gilt_trim', { tool: 'axe', hardness: 1.2, drop: 'planks', label: 'Gilded Carving' });
def('ship_mast', { tool: 'axe', hardness: 3, drop: 'planks', label: 'Mast' });
def('copper_sheath', { tool: 'pick', hardness: 1.6, drop: 'planks', label: 'Copper Sheathing' });
def('ship_cannon', { ...sprite, solid: true, rotatable: true, interact: 'cannon', tool: 'pick', hardness: 4, drop: [{ item: 'iron_ingot', min: 2, max: 4 }], support: false, label: 'Ship\'s Gun' });
def('hammock', { ...sprite, solid: false, rotatable: true, interact: 'hammock', tool: 'axe', hardness: 0.4, drop: 'cloth', support: false, label: 'Hammock' });
def('ship_pump', { ...sprite, solid: true, interact: 'pump', tool: 'axe', hardness: 2, drop: 'planks', support: false, label: 'Bilge Pump' });
def('capstan', { ...sprite, solid: true, tool: 'axe', hardness: 2, drop: 'planks', support: false, label: 'Capstan' });
// (Round 69) Her plans spread on a table in her captain's cabin (in a
// sloop's hold): her name and her colours, to be changed (see ui/blueprint.js).
def('blueprint_table', { ...sprite, solid: true, interact: 'blueprint', tool: 'axe', hardness: 2, drop: 'planks', support: false, label: 'Blueprint Table' });
// (Round 71) The ways into the ancient places (see world/ancient.js):
// after every other block, so a saved world's blocks keep their numbers.
def('athanor_door', { ...sprite, tall: true, solid: true, interact: 'dungeon', hardness: Infinity, drop: null, light: 6, label: 'Athanor Doors' });
def('champion_door', { ...sprite, tall: true, solid: true, interact: 'dungeon', hardness: Infinity, drop: null, light: 3, label: 'Champion\'s Door' });
def('rift_door', { interact: 'dungeon', hardness: Infinity, drop: null, light: 7, label: 'The Rift\'s Heart' });
def('gullet_mouth', { ...sprite, tall: true, solid: true, interact: 'dungeon', hardness: Infinity, drop: null, light: 2, label: 'The Gullet' });
// (Round 72) The Sundered Reach's ground (see world/ancient.js, riftShape):
// the floor of the rift, which is nothing much at all, and the ground
// round it, burnt black and cracked.
def('abyss_floor', { hardness: Infinity, drop: null, light: 2, label: 'The Void' });
def('scorched_earth', { tool: 'shovel', hardness: 0.8, drop: 'dirt', label: 'Sundered Earth' });
// (Round 70) Thin walls, a post with a wall running off it to whatever's
// beside it (another wall, a fence, a solid block): bridges' parapets, and
// anyone's to build. One of each stone (and wood) a bridge's made of.
export const WALL_BASES = ['cobblestone', 'stone_bricks', 'mossy_bricks', 'marble', 'basalt', 'basalt_bricks', 'planks_lacquer', 'whalebone', 'tile_blue', 'salt_brick', 'drystone', 'travertine', 'cob'];
for (const base of WALL_BASES) {
  const o = BLOCKS[B[base]];
  if (!o) continue;
  def(`${base}_wall`, { opaque: false, render: 'wall', wallOf: base, standable: false, tool: o.tool, hardness: o.hardness, label: `${o.label} Wall` });
}

// (Round 73) Liquids sunk in the floor, waded (stood in, not on): the
// Athanor's quicksilver, heavy and cold; the Gullet's acid.
def('quicksilver', { solid: false, opaque: false, render: 'liquid', standable: true, hardness: Infinity, drop: null, light: 2, label: 'Quicksilver' });
def('acid_pool', { solid: false, opaque: false, render: 'liquid', standable: true, hardness: Infinity, drop: null, light: 4, label: 'Acid' });
// (Round 73) Things to show things on (see game/displays.js): a weapon
// rack's three pegs (above), a stand for one piece, a hook on the wall for
// another; and paintings, small and large, of whatever the painter saw.
def('display_stand', { ...sprite, solid: true, interact: 'display', display: 1, tool: 'axe', hardness: 0.8, label: 'Display Stand' });
def('wall_hanger', { ...sprite, solid: false, interact: 'display', display: 1, tool: 'axe', hardness: 0.4, label: 'Wall Hanger' });
// (Round 74: hung on a wall, nothing under them: `onWall`, the wall's
// side in the low bits of the meta. See displays.wallDirOf.)
def('painting_small', { ...sprite, support: false, onWall: true, solid: false, interact: 'painting', painting: 'small', tool: 'axe', hardness: 0.3, label: 'Painting' });
def('painting_large', { ...sprite, support: false, onWall: true, solid: false, interact: 'painting', painting: 'large', tool: 'axe', hardness: 0.3, label: 'Large Painting' });
// (Round 75) Stairs, one for each kind of floor a people lays: a step up
// that needs no head room over it (see World.canStand and stepTarget),
// turned the way it climbs (the low bits of its meta: the way you go up
// it, as facings are counted), and drawn in its floor's own stone or wood.
export const STAIR_BASES = ['planks', 'planks_dark', 'planks_drift', 'planks_cinder', 'planks_bog', 'planks_birch', 'planks_lacquer', 'bamboo', 'flagstone', 'cobblestone', 'stone_bricks', 'marble', 'tile_blue', 'turquoise_tile', 'travertine', 'salt_brick'].filter((n) => B[n] !== undefined);
for (const base of STAIR_BASES) {
  const o = BLOCKS[B[base]];
  def(`${base}_stairs`, { solid: true, opaque: false, render: 'stair', stair: true, stairOf: base, rotatable: true, standable: true, tool: o.tool, hardness: o.hardness, label: `${o.label || cap(base.replace(/_/g, ' '))} Stairs` });
}
// (Round 78) A ladder up a wall: nothing to bump into, hung on the wall it
// climbs (its facing, the low bits of its meta, the side the wall's on, as
// a painting's is), and climbed (see World.canStand and Player.climb).
def('ladder', { ...sprite, solid: false, support: false, onWall: true, rotatable: true, ladder: true, tool: 'axe', hardness: 0.4, label: 'Ladder' });
// (Round 78) A shipwright's bench: ships of your own design drawn up and
// built on it (see ui/shipdesign.js).
def('shipwright_bench', { ...sprite, solid: true, interact: 'shipdesign', tool: 'axe', hardness: 2, support: false, label: 'Shipwright\'s Bench' });
// (Round 84) A ship's stairs between her decks and up to her castles: a
// plank step turned the way it climbs (see world/shipmodels.js). Last of
// all, so no block before it changes its number.
def('deck_planks_stairs', { solid: true, opaque: false, render: 'stair', stair: true, stairOf: 'deck_planks', rotatable: true, standable: true, tool: 'axe', hardness: 1.1, drop: 'planks', label: 'Deck Stairs' });
// The stair for a floor of `id` (wood's own plank stair if there's none).
export function stairFor(id) {
  const n = BLOCKS[id] && BLOCKS[id].name;
  return B[`${n}_stairs`] ?? B.planks_stairs;
}

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

// (Round 95) The barrow made over (see world/deeps/barrow.js): worn flags
// down its processional ways (and steps of them up onto a bier's dais),
// the great carved stones and the oak that line its chambers; and what's
// set about in it: spiral stones (that turn: a puzzle), rune slabs that
// name the dead (read them), biers, the benches and boards of the feast of
// the dead and its cold hearth, shields and spears laid by, offering bowls
// (take from one, and the dead wake), corpse-lanterns, a buried ship's
// prow, grave goods, cairns, and the runes cut in the floor that catch at
// the living. Last of all, so no block before them changes its number.
def('barrow_flags', { tool: 'pick', hardness: 5, drop: 'cobblestone', label: 'Barrow Flags' });
def('barrow_ortho', { tool: 'pick', hardness: 9, drop: 'cobblestone', label: 'Carved Standing Stone' });
def('barrow_oak', { tool: 'axe', hardness: 5, drop: 'planks', label: 'Oak Lining' });
def('barrow_flags_stairs', { solid: true, opaque: false, render: 'stair', stair: true, stairOf: 'barrow_flags', rotatable: true, standable: true, tool: 'pick', hardness: 5, drop: 'cobblestone', label: 'Barrow Steps' });
// (Each carved with one of the four sigils: turned, it shows the next. See
// game/deeps.js.)
def('spiral_stone', { ...sprite, tall: true, solid: true, interact: 'spiral', hardness: Infinity, drop: null, label: 'Spiral Stone' });
def('spiral_stone_sun', { ...sprite, tall: true, solid: true, interact: 'spiral', hardness: Infinity, drop: null, label: 'Spiral Stone' });
def('spiral_stone_serpent', { ...sprite, tall: true, solid: true, interact: 'spiral', hardness: Infinity, drop: null, label: 'Spiral Stone' });
def('spiral_stone_eye', { ...sprite, tall: true, solid: true, interact: 'spiral', hardness: Infinity, drop: null, label: 'Spiral Stone' });
def('rune_slab', { ...sprite, solid: true, interact: 'lore', hardness: Infinity, drop: null, label: 'Rune Slab' });
def('bier', { ...sprite, solid: true, rotatable: true, hardness: Infinity, drop: null, label: 'Bier' });
def('mead_bench', { ...sprite, solid: false, tool: 'axe', hardness: 2, drop: 'planks', label: 'Mead Bench' });
def('feast_board', { ...sprite, solid: true, tool: 'axe', hardness: 2, drop: 'planks', label: 'Feast Board' });
def('cold_hearth', { ...sprite, solid: false, light: 5, interact: 'lore', hardness: Infinity, drop: null, label: 'Cold Hearth' });
def('shield_rack', { ...sprite, solid: true, tool: 'axe', hardness: 1.5, drop: [{ item: 'round_shield', chance: 0.25 }, { item: 'planks', chance: 0.5 }], label: 'Shield Rack' });
def('grave_spears', { ...sprite, solid: true, tool: 'axe', hardness: 1, drop: [{ item: 'spear', chance: 0.2 }, { item: 'stick', chance: 0.6 }], label: 'Grave Spears' });
def('offering_bowl', { ...sprite, solid: false, interact: 'offering', hardness: Infinity, drop: null, label: 'Offering Bowl' });
def('corpse_lantern', { ...sprite, solid: true, light: 9, hardness: 2, tool: 'pick', drop: null, label: 'Corpse-Lantern' });
def('ship_prow', { ...sprite, tall: true, solid: true, interact: 'lore', hardness: Infinity, drop: null, label: 'Dragon Prow' });
def('grave_goods', { ...sprite, solid: true, interact: 'container', hardness: Infinity, drop: null, label: 'Grave Goods' });
// The stone that closes a chief's treasury, its face carved with all four
// sigils (rolled back by the spiral stones: see game/deeps.js).
def('spiral_seal', { tool: 'pick', hardness: Infinity, drop: null, label: 'Sealing Stone' });
def('snare_rune', { solid: false, opaque: false, render: 'flat', standable: false, support: true, hardness: Infinity, drop: null, light: 1, label: 'Snare Rune' });

// (Round 96) The mine made over (see world/deeps/mine.js): its trodden
// spoil and the rock it's hewn from (a vein of quartz in it here and
// there, the wet where water seeps down it, a rich seam, a miner's chalk
// cross on a soft place), the timbering of its drifts, benches cut in the
// rock and steps up them, boards laid over a sump, rails down its drifts,
// and the rubble that chokes a passage (only a runaway cart clears it); and
// what's set about in it: the miners' lamps, the tally board, the
// headframe over the shaft, the pump at the sump, a prop cracking under
// the roof, the shaft bell, bunks, a cold stove, a rack of tools, firedamp
// hanging in the air, a crawler's eggs, the surveyor's table, a cart that
// runs, a heap of ore, the points at a junction. Last of all, so no block
// before them changes its number.
def('mine_floor', { tool: 'shovel', hardness: 2, drop: 'gravel', label: 'Spoil' });
def('mine_timber', { tool: 'axe', hardness: 4, drop: 'planks', label: 'Timbered Rock' });
def('mine_quartz', { tool: 'pick', hardness: 5, drop: 'cobblestone', label: 'Quartz-Veined Rock' });
def('mine_seep', { tool: 'pick', hardness: 5, drop: 'cobblestone', label: 'Seeping Rock' });
def('rich_vein', { tool: 'pick', hardness: 4, drop: [{ item: 'gold_ore', chance: 0.8 }, { item: 'gem', chance: 0.25 }], label: 'Rich Seam' });
def('chalk_mark', { tool: 'pick', hardness: 0.8, drop: 'cobblestone', label: 'Chalk-Marked Rock' });
def('cart_choke', { hardness: Infinity, drop: null, label: 'Choked Passage' });
def('mine_bench', { tool: 'pick', hardness: 5, drop: 'cobblestone', label: 'Cut Bench' });
def('mine_steps', { solid: true, opaque: false, render: 'stair', stair: true, stairOf: 'mine_bench', rotatable: true, standable: true, tool: 'pick', hardness: 5, drop: 'cobblestone', label: 'Cut Steps' });
def('mine_boards', { tool: 'axe', hardness: 1.5, drop: 'planks', label: 'Sump Boards' });
def('mine_rail', { solid: false, opaque: false, render: 'flat', rug: true, standable: false, support: true, tool: 'pick', hardness: 1, drop: [{ item: 'iron_ingot', chance: 0.3 }], label: 'Rails' });
def('pit_lamp', { ...sprite, solid: true, light: 10, tool: 'pick', hardness: 1, drop: null, label: 'Miner\'s Lamp' });
def('tally_board', { ...sprite, solid: true, interact: 'lore', hardness: Infinity, drop: null, label: 'Tally Board' });
def('headframe', { ...sprite, tall: true, solid: true, interact: 'lore', hardness: Infinity, drop: null, label: 'Headframe' });
def('mine_pump', { ...sprite, solid: true, interact: 'pump', hardness: Infinity, drop: null, label: 'Sump Pump' });
def('cracked_prop', { ...sprite, solid: true, tool: 'axe', hardness: 1.5, drop: [{ item: 'planks', chance: 0.5 }], label: 'Cracked Prop' });
def('shaft_bell', { ...sprite, solid: true, interact: 'shaft_bell', hardness: Infinity, drop: null, label: 'Shaft Bell' });
def('miner_bunk', { ...sprite, solid: true, interact: 'lore', tool: 'axe', hardness: 2, drop: 'planks', label: 'Bunk' });
def('cold_stove', { ...sprite, solid: true, tool: 'pick', hardness: 3, drop: [{ item: 'iron_ingot', chance: 0.4 }], label: 'Cold Stove' });
def('tool_rack', { ...sprite, solid: true, tool: 'axe', hardness: 1.5, drop: [{ item: 'iron_pickaxe', chance: 0.15 }, { item: 'stick', chance: 0.5 }], label: 'Tool Rack' });
def('firedamp', { ...sprite, solid: false, standable: false, support: false, hardness: Infinity, drop: null, gas: true, label: 'Firedamp' });
def('egg_sac', { ...sprite, solid: true, tool: 'axe', hardness: 0.3, drop: null, label: 'Crawler Eggs' });
def('survey_table', { ...sprite, solid: true, interact: 'lore', hardness: Infinity, drop: null, label: 'Surveyor\'s Table' });
def('lamp_tin', { ...sprite, solid: false, interact: 'lore', hardness: Infinity, drop: null, label: 'Lamp-Tin' });
def('runaway_cart', { ...sprite, solid: true, interact: 'cart', hardness: Infinity, drop: null, label: 'Ore Cart' });
def('ore_pile', { ...sprite, solid: true, tool: 'pick', hardness: 1, drop: [{ item: 'iron_ore', chance: 0.6 }, { item: 'coal', chance: 0.5 }, { item: 'gold_ore', chance: 0.15 }], label: 'Heap of Ore' });
def('rail_switch', { ...sprite, solid: false, interact: 'rail_switch', hardness: Infinity, drop: null, label: 'Points' });
def('mine_fall', { tool: 'shovel', hardness: 1.2, drop: [{ item: 'cobblestone', chance: 0.5 }], label: 'Fall of Rock' });

// (Round 97) The crypt made over (see world/deeps/crypt.js): its dressed
// stone (the crypt bricks and flagstones drawn afresh), a carved pilaster,
// the niches of the dead (open, and sealed with a lettered slab), the
// ossuary's wall of bones, an iron grille, the chancel's dais and the steps
// up it, ledger slabs over graves, the nave's marble, a cracked flag over
// the void and a loose one with a ring in it; and what's set about in it:
// the vigil candles (lit, and snuffed), tombs with their effigies (shut,
// and dragged open), the altar, a saint in stone, the Register on its
// lectern, choir stalls, heaped bones, a keeper's cot, a prayer desk, the
// reliquary, daylight down a shaft, ferns in it, a vestment press, a
// pauper's grave-board. Last of all, so no block before them changes its
// number.
def('crypt_pilaster', { tool: 'pick', hardness: 7, drop: 'cobblestone', label: 'Pilaster' });
def('crypt_niche', { tool: 'pick', hardness: 4, drop: [{ item: 'bone', chance: 0.7 }], label: 'Burial Niche' });
def('crypt_sealed', { tool: 'pick', hardness: 6, drop: 'cobblestone', label: 'Sealed Niche' });
def('bone_wall', { tool: 'pick', hardness: 3, drop: [{ item: 'bone', chance: 0.8 }], label: 'Wall of Bones' });
def('crypt_grille', { hardness: Infinity, drop: null, label: 'Iron Grille' });
def('crypt_dais', { tool: 'pick', hardness: 5, drop: 'cobblestone', label: 'Dais' });
def('crypt_steps', { solid: true, opaque: false, render: 'stair', stair: true, stairOf: 'crypt_dais', rotatable: true, standable: true, tool: 'pick', hardness: 5, drop: 'cobblestone', label: 'Steps' });
def('crypt_ledger', { tool: 'pick', hardness: 5, drop: 'cobblestone', label: 'Ledger Stone' });
def('crypt_marble', { tool: 'pick', hardness: 5, drop: 'marble', label: 'Marble Floor' });
def('crypt_weak', { tool: 'pick', hardness: 0.5, drop: null, label: 'Cracked Flag' });
def('loose_flag', { solid: false, opaque: false, render: 'flat', rug: true, standable: false, support: true, interact: 'loose_flag', hardness: Infinity, drop: null, label: 'Loose Flag' });
def('vigil_candle', { ...sprite, solid: true, light: 9, interact: 'vigil', hardness: Infinity, drop: null, label: 'Vigil Candle' });
def('vigil_out', { ...sprite, solid: true, interact: 'vigil', hardness: Infinity, drop: null, label: 'Snuffed Candle' });
// (A tomb's effigy laid four ways: with a sword, a book, the hands joined,
// a crozier. Each its own, so the Register's riddle reads the same however
// you look at it.)
def('effigy_tomb', { ...sprite, solid: true, interact: 'tomb', hardness: Infinity, drop: null, label: 'Tomb' });
def('effigy_book', { ...sprite, solid: true, interact: 'tomb', hardness: Infinity, drop: null, label: 'Tomb' });
def('effigy_prayer', { ...sprite, solid: true, interact: 'tomb', hardness: Infinity, drop: null, label: 'Tomb' });
def('effigy_crozier', { ...sprite, solid: true, interact: 'tomb', hardness: Infinity, drop: null, label: 'Tomb' });
def('tomb_open', { ...sprite, solid: true, hardness: Infinity, drop: null, label: 'Open Tomb' });
def('crypt_altar', { ...sprite, solid: true, light: 4, interact: 'lore', hardness: Infinity, drop: null, label: 'Altar' });
def('saint_statue', { ...sprite, tall: true, solid: true, light: 3, interact: 'lore', hardness: Infinity, drop: null, label: 'Saint' });
def('register_lectern', { ...sprite, solid: true, interact: 'lore', hardness: Infinity, drop: null, label: 'The Register' });
def('choir_stall', { ...sprite, solid: true, tool: 'axe', hardness: 2, drop: 'planks', label: 'Choir Stall' });
def('ossuary_heap', { ...sprite, solid: true, hardness: 0.6, drop: [{ item: 'bone', chance: 0.9, min: 1, max: 3 }], label: 'Heap of Bones' });
def('keeper_cot', { ...sprite, solid: true, interact: 'lore', tool: 'axe', hardness: 2, drop: 'planks', label: 'Keeper\'s Cot' });
def('prayer_desk', { ...sprite, solid: true, tool: 'axe', hardness: 1.5, drop: 'planks', label: 'Prayer Desk' });
def('reliquary', { ...sprite, solid: true, light: 5, interact: 'reliquary', hardness: Infinity, drop: null, label: 'Reliquary' });
def('light_shaft', { ...sprite, tall: true, solid: false, light: 13, hardness: Infinity, drop: null, label: 'Daylight' });
def('crypt_fern', { ...sprite, solid: false, hardness: 0.1, drop: null, label: 'Ferns' });
def('vestment_press', { ...sprite, solid: true, tool: 'axe', hardness: 2, drop: 'planks', label: 'Vestment Press' });
def('grave_board', { ...sprite, solid: true, interact: 'lore', tool: 'axe', hardness: 1, drop: 'planks', label: 'Grave-Board' });

// (Round 98) The holdout made over (see world/deeps/holdout.js): its cave
// rock (drawn afresh, warm and sooted), a timber shore, a palisade of
// sharpened logs, boards torn off caravans, the scaffold the archers stand
// on, a false wall over the gang's stash; its packed earth, rough planks, a
// stolen rug, straw, a rope bridge's slats; caltrops, a tripwire strung
// with bells, a trail of black powder, a hide pegged over a pit; and what's
// set about in it: the mess's tables and benches, bunks, bedrolls, a
// footlocker, the spit over its pit, an ale cask, dice on a barrel, crates
// of plunder with their merchants' brands (and one prised open), bolts of
// cloth, sacks, a smashed wagon, a stand of stolen armour, a grindstone,
// the cook's cauldron, a butcher's block, a rack of meat, the WANTED post,
// the raid map, the quartermaster's ledger, the chief's throne of loot, a
// lantern on its post, a dog's bones. Last of all, so no block before them
// changes its number.
def('hold_rock', { tool: 'pick', hardness: 6, drop: 'cobblestone', label: 'Cave Rock' });
def('hold_shore', { tool: 'axe', hardness: 4, drop: 'planks', label: 'Shored Rock' });
def('palisade', { opaque: true, tool: 'axe', hardness: 3, drop: 'log_oak', label: 'Palisade' });
def('hold_boards', { tool: 'axe', hardness: 2, drop: 'planks', label: 'Wagon Boards' });
def('hold_scaffold', { tool: 'axe', hardness: 2, drop: 'planks', label: 'Scaffold' });
def('hold_false', { tool: 'pick', hardness: 1, interact: 'stash', drop: null, label: 'Cave Rock' });
def('hold_dirt', { tool: 'shovel', hardness: 0.6, drop: 'dirt', label: 'Packed Earth' });
def('hold_planks', { tool: 'axe', hardness: 2, drop: 'planks', label: 'Rough Planks' });
def('hold_rug', { tool: 'axe', hardness: 1, drop: 'cloth', label: 'Stolen Rug' });
def('hold_straw', { tool: 'shovel', hardness: 0.4, drop: 'dirt', label: 'Straw' });
def('hold_bridge', { tool: 'axe', hardness: 1.5, drop: 'planks', label: 'Rope Bridge' });
def('hold_caltrops', { solid: false, opaque: false, render: 'flat', rug: true, standable: false, support: true, hardness: 0.5, drop: null, label: 'Caltrops' });
def('hold_tripwire', { solid: false, opaque: false, render: 'flat', rug: true, standable: false, support: true, hardness: 0.2, drop: null, label: 'Tripwire' });
def('hold_powder', { solid: false, opaque: false, render: 'flat', rug: true, standable: false, support: true, interact: 'powder', hardness: 0.2, drop: null, label: 'Powder Trail' });
def('hold_hide', { solid: false, opaque: false, render: 'flat', rug: true, standable: false, support: true, hardness: 0.3, drop: null, label: 'Hide' });
def('hold_table', { ...sprite, solid: true, tool: 'axe', hardness: 2, drop: 'planks', label: 'Mess Table' });
def('hold_bench', { ...sprite, solid: false, tool: 'axe', hardness: 1.5, drop: 'planks', label: 'Bench' });
def('hold_bunk', { ...sprite, tall: true, solid: true, tool: 'axe', hardness: 2, drop: 'planks', label: 'Bunk' });
def('hold_bedroll', { ...sprite, solid: false, hardness: 0.5, drop: [{ item: 'cloth', chance: 0.5 }], label: 'Bedroll' });
def('hold_locker', { ...sprite, solid: true, interact: 'lore', hardness: Infinity, drop: null, label: 'Footlocker' });
def('hold_spit', { ...sprite, solid: true, light: 12, hardness: Infinity, drop: null, label: 'Spit' });
def('ale_cask', { ...sprite, solid: true, tool: 'axe', hardness: 2, drop: null, label: 'Ale Cask' });
def('dice_barrel', { ...sprite, solid: true, tool: 'axe', hardness: 1.5, drop: [{ item: 'coin', chance: 0.6, min: 1, max: 3 }], label: 'Dice Barrel' });
def('crate_star', { ...sprite, solid: true, interact: 'plunder', hardness: Infinity, drop: null, label: 'Crate (Star Brand)' });
def('crate_wheel', { ...sprite, solid: true, interact: 'plunder', hardness: Infinity, drop: null, label: 'Crate (Wheel Brand)' });
def('crate_fish', { ...sprite, solid: true, interact: 'plunder', hardness: Infinity, drop: null, label: 'Crate (Fish Brand)' });
def('crate_tree', { ...sprite, solid: true, interact: 'plunder', hardness: Infinity, drop: null, label: 'Crate (Tree Brand)' });
def('crate_open', { ...sprite, solid: true, tool: 'axe', hardness: 1, drop: 'planks', label: 'Empty Crate' });
def('cloth_bolts', { ...sprite, solid: true, hardness: 0.5, drop: [{ item: 'cloth', chance: 1, min: 1, max: 3 }], label: 'Bolts of Cloth' });
def('loot_sacks', { ...sprite, solid: true, hardness: 0.5, drop: [{ item: 'coin', chance: 0.5, min: 1, max: 4 }, { item: 'wheat', chance: 0.5 }], label: 'Sacks' });
def('smashed_wagon', { ...sprite, solid: true, tool: 'axe', hardness: 2, drop: 'planks', label: 'Smashed Wagon' });
def('armour_stand', { ...sprite, tall: true, solid: true, hardness: Infinity, drop: null, label: 'Armour Stand' });
def('hold_grind', { ...sprite, solid: true, hardness: Infinity, drop: null, label: 'Grindstone' });
def('hold_cauldron', { ...sprite, solid: true, light: 6, hardness: Infinity, drop: null, label: 'Cauldron' });
def('butcher_block', { ...sprite, solid: true, tool: 'axe', hardness: 2, drop: 'planks', label: 'Butcher\'s Block' });
def('meat_hooks', { ...sprite, tall: true, solid: true, hardness: 0.6, drop: [{ item: 'raw_meat', chance: 0.8, min: 1, max: 2 }], label: 'Meat Hooks' });
def('wanted_post', { ...sprite, tall: true, solid: true, interact: 'lore', hardness: Infinity, drop: null, label: 'Wanted Bill' });
def('raid_map', { ...sprite, solid: true, interact: 'lore', hardness: Infinity, drop: null, label: 'Raid Map' });
def('plunder_ledger', { ...sprite, solid: true, interact: 'lore', hardness: Infinity, drop: null, label: 'The Plunder Ledger' });
def('loot_throne', { ...sprite, tall: true, solid: true, hardness: Infinity, drop: null, label: 'Throne of Loot' });
def('hold_lantern', { ...sprite, tall: true, solid: true, light: 11, hardness: Infinity, drop: null, label: 'Lantern Post' });
def('dog_bones', { ...sprite, solid: false, hardness: 0.2, drop: [{ item: 'bone', chance: 0.6 }], label: 'Gnawed Bones' });

// (Round 99) The Kavorent made over (see world/deeps/kavorent.js): its
// alloy (drawn afresh: a precise panel with its seam of light), a wall of
// it failed and cracked, the cradle's wall of the sleepers' names, a
// viewport onto the works; a plate with a node of light let in, the hall's
// inlay, a grate over a channel, the dais and its steps, a bed of cables in
// a sunk channel; and what's set about in it: the sleepers' pods (sealed,
// open, broken), a construct's cradle, the orrery, a railing, a coolant
// tank, the sentinel lens, a sealed crate, the Choir's crystal, the memory
// well and its glyph pillars. Last of all, so no block before them changes
// its number.
def('kav_failed', { hardness: Infinity, drop: null, label: 'Failed Alloy' });
def('kav_mural', { interact: 'lore', hardness: Infinity, drop: null, light: 2, label: 'The Names' });
def('kav_viewport', { hardness: Infinity, drop: null, light: 3, label: 'Viewport' });
def('kav_node_floor', { hardness: Infinity, drop: null, light: 4, label: 'Lit Plate' });
def('kav_inlay', { hardness: Infinity, drop: null, light: 2, label: 'Inlaid Floor' });
def('kav_grate', { hardness: Infinity, drop: null, light: 3, label: 'Grate' });
def('kav_dais', { hardness: Infinity, drop: null, label: 'Dais' });
def('kav_steps', { solid: true, opaque: false, render: 'stair', stair: true, stairOf: 'kav_dais', rotatable: true, standable: true, hardness: Infinity, drop: null, label: 'Steps' });
def('kav_cables', { hardness: Infinity, drop: null, light: 4, label: 'Cables' });
def('kav_pod', { ...sprite, tall: true, solid: true, interact: 'lore', light: 4, hardness: Infinity, drop: null, label: 'Sleeper\'s Pod' });
def('kav_pod_open', { ...sprite, tall: true, solid: true, hardness: Infinity, drop: null, label: 'Empty Pod' });
def('kav_pod_broken', { ...sprite, tall: true, solid: true, interact: 'lore', hardness: Infinity, drop: null, label: 'Broken Pod' });
def('kav_cradle', { ...sprite, tall: true, solid: true, light: 3, hardness: Infinity, drop: null, label: 'Construct Cradle' });
def('kav_orrery', { ...sprite, tall: true, solid: true, interact: 'lore', light: 6, hardness: Infinity, drop: null, label: 'Orrery' });
def('kav_rail', { ...sprite, solid: true, hardness: Infinity, drop: null, label: 'Railing' });
def('kav_tank', { ...sprite, tall: true, solid: true, light: 6, hardness: Infinity, drop: null, label: 'Coolant Tank' });
def('kav_lens', { ...sprite, tall: true, solid: true, light: 4, tool: 'pick', hardness: 4, drop: [{ item: 'kav_scrap', chance: 0.6 }], label: 'Sentinel Lens' });
def('kav_crate', { ...sprite, solid: true, interact: 'lore', tool: 'pick', hardness: 3, drop: [{ item: 'kav_scrap', chance: 0.7, min: 1, max: 2 }], label: 'Sealed Crate' });
def('kav_shards', { ...sprite, solid: false, tool: 'pick', light: 5, hardness: 0.8, drop: [{ item: 'kav_scrap', chance: 0.2 }], label: 'Choir Crystal' });
def('kav_well', { ...sprite, tall: true, solid: true, interact: 'kav_well', light: 11, hardness: Infinity, drop: null, label: 'Memory Well' });
def('kav_glyph', { ...sprite, solid: true, rotatable: true, interact: 'kav_glyph', light: 3, hardness: Infinity, drop: null, label: 'Glyph Pillar' });

// (Round 100) The Wildwood Hollow made over (see world/deeps/grove.js): its
// wall of living roots (with a shelf of glowcaps, of bare earth, the Green
// Man the Keepers cut, one of the Kept grown into the bark, a knothole with
// eyes in it, and a door of roots the hob draws back), a bank of earth held
// by roots and the root-steps up it; its floors (moss, leaf litter, a worn
// path, the Keepers' flags, leaf mould, a bed of earth in the sun); roots
// lying across the floor, and the snare among them; and what's set about in
// it: glowcaps, the toadstools of a fairy ring, ferns, bluebells, a curtain
// of roots, the rag-root, the offering stone, an antler post, the rule-
// stone, one of the Kept standing, a puffball, a hornets' nest, a fallen
// log, the woodcutter's stump and camp, a shaft of daylight, the sun-seed
// and what it grows, a ladder of roots, a boulder. Last of all, so no block
// before them changes its number.
def('gr_roots', { tool: 'axe', hardness: Infinity, drop: null, label: 'Living Roots' });
def('gr_glowshelf', { hardness: Infinity, drop: null, light: 5, label: 'Glowcap Shelf' });
def('gr_earth', { hardness: Infinity, drop: null, label: 'Earth' });
def('gr_greenman', { interact: 'lore', hardness: Infinity, drop: null, label: 'The Green Man' });
def('gr_kept', { interact: 'lore', hardness: Infinity, drop: null, label: 'One of the Kept' });
def('gr_knot', { hardness: Infinity, drop: null, light: 1, label: 'Knothole' });
def('gr_rootdoor', { hardness: Infinity, drop: null, label: 'Living Roots' });
def('gr_bank', { hardness: Infinity, drop: null, label: 'Bank' });
def('gr_banksteps', { solid: true, opaque: false, render: 'stair', stair: true, stairOf: 'gr_bank', rotatable: true, standable: true, hardness: Infinity, drop: null, label: 'Root-Steps' });
def('gr_moss', { tool: 'shovel', hardness: Infinity, drop: null, label: 'Moss' });
def('gr_litter', { tool: 'shovel', hardness: Infinity, drop: null, label: 'Leaf Litter' });
def('gr_worn', { tool: 'shovel', hardness: Infinity, drop: null, label: 'Path' });
def('gr_flags', { hardness: Infinity, drop: null, label: 'Mossy Flags' });
def('gr_mould', { tool: 'shovel', hardness: Infinity, drop: null, label: 'Leaf Mould' });
def('gr_sunbed', { interact: 'gr_sunbed', hardness: Infinity, drop: null, light: 6, label: 'Bed of Earth' });
def('gr_rootflat', { solid: false, opaque: false, render: 'flat', rug: true, standable: false, support: true, tool: 'axe', hardness: 0.6, drop: [{ item: 'stick', chance: 0.5 }], label: 'Roots' });
def('gr_snare', { solid: false, opaque: false, render: 'flat', rug: true, standable: false, support: true, tool: 'axe', hardness: 0.6, drop: [{ item: 'stick', chance: 0.5 }], label: 'Roots' });
def('gr_glowcaps', { ...dressing, rotatable: true, hardness: 0.05, light: 6, drop: [{ item: 'glowcap', chance: 0.5 }], label: 'Glowcaps' });
def('gr_toadstool', { ...dressing, rotatable: true, hardness: 0.05, light: 1, drop: null, label: 'Toadstools' });
def('gr_fern', { ...dressing, rotatable: true, hardness: 0.05, drop: null, label: 'Fern' });
def('gr_bluebells', { ...dressing, rotatable: true, hardness: 0.05, drop: null, label: 'Bluebells' });
def('gr_rootcurtain', { ...dressing, tall: true, rotatable: true, tool: 'axe', hardness: 0.2, drop: [{ item: 'stick', chance: 0.5 }], label: 'Hanging Roots' });
def('gr_ragroot', { ...sprite, tall: true, solid: true, rotatable: true, interact: 'lore', hardness: Infinity, drop: null, label: 'The Rag-Root' });
def('gr_offering', { ...sprite, solid: true, interact: 'gr_offering', hardness: Infinity, drop: null, label: 'Offering Stone' });
def('gr_antlerpost', { ...sprite, tall: true, solid: true, hardness: Infinity, drop: null, label: 'Antler Post' });
def('gr_rulestone', { ...sprite, tall: true, solid: true, interact: 'lore', hardness: Infinity, drop: null, label: 'The Rule-Stone' });
def('gr_keptroot', { ...sprite, tall: true, solid: true, interact: 'lore', hardness: Infinity, drop: null, label: 'One of the Kept' });
def('gr_puffball', { ...dressing, hardness: 0.1, drop: null, label: 'Puffball' });
def('gr_hornets', { ...dressing, tall: true, hardness: 0.1, drop: [{ item: 'honeycomb', chance: 0.7, min: 1, max: 2 }], label: 'Hornets\' Nest' });
def('gr_log', { ...sprite, solid: true, rotatable: true, tool: 'axe', hardness: 3, drop: [{ item: 'log_oak', chance: 0.6 }], label: 'Fallen Log' });
def('gr_stump', { ...sprite, solid: true, interact: 'lore', hardness: Infinity, drop: null, label: 'Notched Stump' });
def('gr_camp', { ...dressing, interact: 'lore', hardness: Infinity, drop: null, label: 'A Last Camp' });
def('gr_sunbeam', { ...dressing, tall: true, interact: 'gr_sunbed', hardness: Infinity, light: 10, drop: null, label: 'Daylight' });
def('gr_seedpod', { ...dressing, interact: 'gr_seedpod', hardness: Infinity, light: 4, drop: null, label: 'Seed Pod' });
def('gr_sprout', { ...dressing, hardness: Infinity, light: 3, drop: null, label: 'Shoot' });
def('gr_rootladder', { ...sprite, solid: false, support: false, onWall: true, rotatable: true, ladder: true, hardness: Infinity, drop: null, label: 'Ladder of Roots' });
def('gr_boulder', { ...sprite, solid: true, rotatable: true, hardness: Infinity, drop: null, label: 'Mossy Boulder' });
// (Round 101) The Kiln-Deep made over (see world/deeps/forge.js): its wall of
// dressed basalt (a flue's mouth, an iron band, the guild's mark, the tally
// of the days, the guild-roll, the kiln-door the kiln-key opens, the
// guild-door the singing anvils open), the gantry along a hall and its iron
// stair; its floors (iron plate, basalt flags, a grate over fire, coal, ash,
// fired brick, a casting mould and the master's mould); and what's set about
// in it: the anvils (the three that sing), the crucible and its lever, the
// bellows, the trip-hammer, a brazier, racks of blades and stacks of ingots
// (the work: the smiths' own), coal heaps, a cart, a steam vent, plinths of
// masterworks, a hoist chain, the guild's banner, tables and benches, a
// Kiln-King in stone, slag, an iron ladder, the kiln-key fresh from its
// mould. Last of all, so no block before them changes its number.
def('fg_wall', { tool: 'pick', hardness: Infinity, drop: null, label: 'Dressed Basalt' });
def('fg_flue', { hardness: Infinity, drop: null, light: 6, label: 'Flue' });
def('fg_ironband', { hardness: Infinity, drop: null, label: 'Banded Basalt' });
def('fg_relief', { interact: 'lore', hardness: Infinity, drop: null, label: 'The Guild\'s Mark' });
def('fg_tally', { interact: 'lore', hardness: Infinity, drop: null, label: 'The Tally' });
def('fg_roll', { interact: 'lore', hardness: Infinity, drop: null, label: 'The Guild-Roll' });
def('fg_kilndoor', { interact: 'fg_kilndoor', hardness: Infinity, drop: null, light: 1, label: 'Kiln-Door' });
def('fg_guilddoor', { interact: 'fg_guilddoor', hardness: Infinity, drop: null, label: 'Guild-Door' });
def('fg_gantry', { hardness: Infinity, drop: null, label: 'Gantry' });
def('fg_gantrysteps', { solid: true, opaque: false, render: 'stair', stair: true, stairOf: 'fg_gantry', rotatable: true, standable: true, hardness: Infinity, drop: null, label: 'Iron Stair' });
def('fg_plate', { hardness: Infinity, drop: null, label: 'Iron Plate' });
def('fg_flags', { hardness: Infinity, drop: null, label: 'Basalt Flags' });
def('fg_grate', { hardness: Infinity, drop: null, light: 8, label: 'Fire Grate' });
def('fg_coal', { tool: 'shovel', hardness: Infinity, drop: null, label: 'Coal' });
def('fg_ash', { tool: 'shovel', hardness: Infinity, drop: null, label: 'Ash' });
def('fg_brick', { hardness: Infinity, drop: null, label: 'Fired Brick' });
def('fg_mould', { hardness: Infinity, drop: null, label: 'Casting Mould' });
def('fg_keymould', { hardness: Infinity, drop: null, light: 2, label: 'The Master\'s Mould' });
def('fg_anvil', { ...sprite, solid: true, rotatable: true, interact: 'anvil', tool: 'pick', hardness: Infinity, drop: null, label: 'Anvil' });
def('fg_singanvil', { ...sprite, solid: true, rotatable: true, interact: 'fg_singanvil', hardness: Infinity, drop: null, light: 1, lightWhenState: true, label: 'Singing Anvil' });
def('fg_crucible', { ...sprite, solid: true, hardness: Infinity, light: 10, drop: null, label: 'Crucible' });
def('fg_bellows', { ...sprite, solid: true, rotatable: true, hardness: Infinity, drop: null, label: 'Bellows' });
def('fg_hammer', { ...dressing, tall: true, hardness: Infinity, drop: null, label: 'Trip-Hammer' });
def('fg_brazier', { ...sprite, solid: true, hardness: Infinity, light: 13, drop: null, label: 'Brazier' });
def('fg_rack', { ...sprite, solid: true, rotatable: true, tool: 'pick', hardness: 1.5, drop: [{ item: 'iron_ingot', chance: 0.6, min: 1, max: 2 }], label: 'Rack of Blades' });
def('fg_ingots', { ...sprite, solid: true, rotatable: true, tool: 'pick', hardness: 1.5, drop: [{ item: 'iron_ingot', chance: 1, min: 1, max: 3 }, { item: 'gold_ingot', chance: 0.25 }], label: 'Ingots' });
def('fg_coalheap', { ...dressing, rotatable: true, tool: 'shovel', hardness: 0.4, light: 2, drop: [{ item: 'coal', chance: 1, min: 1, max: 3 }], label: 'Coal Heap' });
def('fg_cart', { ...sprite, solid: true, rotatable: true, hardness: Infinity, drop: null, label: 'Coal Cart' });
def('fg_vent', { ...dressing, hardness: Infinity, drop: null, label: 'Steam Vent' });
def('fg_lever', { ...sprite, solid: true, interact: 'fg_lever', hardness: Infinity, drop: null, label: 'Pouring Lever' });
def('fg_plinth', { ...sprite, solid: true, rotatable: true, interact: 'lore', hardness: Infinity, drop: null, label: 'Masterwork' });
def('fg_chain', { ...dressing, tall: true, hardness: Infinity, drop: null, label: 'Hoist Chain' });
def('fg_banner', { ...dressing, tall: true, hardness: 0.5, drop: null, label: 'Guild Banner' });
def('fg_table', { ...sprite, solid: true, rotatable: true, interact: 'lore', hardness: Infinity, drop: null, label: 'Long Table' });
def('fg_bench', { ...dressing, rotatable: true, hardness: Infinity, drop: null, label: 'Bench' });
def('fg_statue', { ...sprite, tall: true, solid: true, interact: 'lore', hardness: Infinity, drop: null, label: 'A Kiln-King in Stone' });
def('fg_slag', { ...sprite, solid: true, rotatable: true, tool: 'pick', hardness: 2, light: 2, drop: [{ item: 'obsidian_shard', chance: 0.5 }], label: 'Slag' });
def('fg_ladder', { ...sprite, solid: false, support: false, onWall: true, rotatable: true, ladder: true, hardness: Infinity, drop: null, label: 'Iron Ladder' });
def('fg_castkey', { ...dressing, interact: 'fg_castkey', hardness: Infinity, light: 6, lightWhenState: false, drop: null, label: 'The Kiln-Key' });
// (Round 102) The Tide Grotto made over (see world/deeps/grotto.js): its wall
// of black volcanic rock wearing the tide (mussels thick, coral grown up it,
// the glowing algae, the divers' tide-marks, the shrine's spiral of shells,
// the sea-door the three pearls open, a moray's hole, the carving of the
// Tide-Mother), a shelf of rock a step up and its steps, the divers'
// boardwalk; its floors (shell sand, the wet sand of the flats the tide
// covers, shingle, the shrine's mosaic, an urchin bed); and what's set about
// in it: kelp, coral, anemones, the giant clams, the offering shells, nets,
// baskets, the tide-pole, the tide-bell, a rope ladder, the dive-weights, a
// wreck's hull, a shell lantern, the blowhole, a diver's bones, a cairn of
// shells, driftwood, a cold fire, a barnacled boulder. Last of all, so no
// block before them changes its number.
def('gt_rock', { tool: 'pick', hardness: Infinity, drop: null, label: 'Sea-Cave Rock' });
def('gt_mussels', { hardness: Infinity, drop: null, label: 'Mussel Bed' });
def('gt_coralwall', { hardness: Infinity, drop: null, label: 'Coral-Grown Rock' });
def('gt_glowwall', { hardness: Infinity, drop: null, light: 5, label: 'Glowing Algae' });
def('gt_tidemark', { interact: 'lore', hardness: Infinity, drop: null, label: 'The Tide-Marks' });
def('gt_shellwall', { interact: 'lore', hardness: Infinity, drop: null, light: 2, label: 'The Spiral of Shells' });
def('gt_seadoor', { interact: 'gt_seadoor', hardness: Infinity, drop: null, label: 'Sea-Door' });
def('gt_eelhole', { hardness: Infinity, drop: null, label: 'Moray Hole' });
def('gt_carving', { interact: 'lore', hardness: Infinity, drop: null, label: 'The Tide-Mother, Carved' });
def('gt_shelf', { hardness: Infinity, drop: null, label: 'Rock Shelf' });
def('gt_shelfsteps', { solid: true, opaque: false, render: 'stair', stair: true, stairOf: 'gt_shelf', rotatable: true, standable: true, hardness: Infinity, drop: null, label: 'Rock Steps' });
def('gt_boardwalk', { hardness: Infinity, drop: null, label: 'Boardwalk' });
def('gt_sand', { tool: 'shovel', hardness: Infinity, drop: null, label: 'Shell Sand' });
def('gt_wetsand', { tool: 'shovel', hardness: Infinity, drop: null, label: 'Tidal Flat' });
def('gt_pebbles', { hardness: Infinity, drop: null, label: 'Shingle' });
def('gt_mosaic', { hardness: Infinity, drop: null, light: 2, label: 'Shell Mosaic' });
def('gt_urchins', { hardness: Infinity, drop: null, label: 'Urchin Bed' });
def('gt_kelp', { ...dressing, tall: true, hardness: 0.1, drop: [{ item: 'kelp', chance: 0.6 }], label: 'Kelp' });
def('gt_coral', { ...sprite, solid: true, rotatable: true, tool: 'pick', hardness: 1, drop: [{ item: 'coral', chance: 0.7 }], label: 'Coral' });
def('gt_anemone', { ...dressing, rotatable: true, hardness: Infinity, light: 7, drop: null, label: 'Glowing Anemones' });
def('gt_clam', { ...sprite, solid: true, rotatable: true, interact: 'gt_clam', hardness: Infinity, drop: null, label: 'Giant Clam' });
def('gt_scallop', { ...sprite, solid: true, interact: 'gt_scallop', hardness: Infinity, light: 2, lightWhenState: true, drop: null, label: 'Offering Shell' });
def('gt_net', { ...dressing, tall: true, hardness: 0.3, drop: [{ item: 'string', chance: 0.6, min: 1, max: 2 }], label: 'Diver\'s Net' });
def('gt_basket', { ...sprite, solid: true, rotatable: true, hardness: 0.3, drop: [{ item: 'pearl', chance: 0.35 }, { item: 'coral', chance: 0.3 }], label: 'Basket of Shells' });
def('gt_tidepole', { ...sprite, tall: true, solid: true, interact: 'lore', hardness: Infinity, drop: null, label: 'Tide-Pole' });
def('gt_bell', { ...sprite, tall: true, solid: true, interact: 'gt_bell', hardness: Infinity, drop: null, label: 'Tide-Bell' });
def('gt_ladder', { ...sprite, solid: false, support: false, onWall: true, rotatable: true, ladder: true, hardness: Infinity, drop: null, label: 'Rope Ladder' });
def('gt_weights', { ...sprite, solid: true, rotatable: true, hardness: Infinity, drop: null, label: 'Dive-Weights' });
def('gt_hull', { ...sprite, solid: true, rotatable: true, hardness: Infinity, drop: null, label: 'Wreck' });
def('gt_lantern', { ...sprite, solid: true, hardness: Infinity, light: 11, drop: null, label: 'Shell Lantern' });
def('gt_blowhole', { ...dressing, tall: true, hardness: Infinity, drop: null, label: 'Blowhole' });
def('gt_bones', { ...dressing, rotatable: true, interact: 'lore', hardness: Infinity, drop: null, label: 'A Diver\'s Bones' });
def('gt_cairn', { ...sprite, solid: true, interact: 'lore', hardness: Infinity, drop: null, label: 'Cairn of Shells' });
def('gt_driftwood', { ...dressing, rotatable: true, hardness: 0.3, drop: [{ item: 'stick', chance: 0.7, min: 1, max: 2 }], label: 'Driftwood' });
def('gt_firering', { ...dressing, hardness: Infinity, drop: null, label: 'Cold Fire' });
def('gt_boulder', { ...sprite, solid: true, rotatable: true, hardness: Infinity, drop: null, label: 'Barnacled Boulder' });
// (Round 103) The Imperial Catacomb made over (see world/deeps/catacomb.js):
// its wall of tufa laid in opus reticulatum under a travertine cornice; the
// galleries' shelf-graves (sealed, a name on each: broken open for what's
// in them; one broken open already; one with a dead arm in it), a
// columbarium's niches, two frescoes, the ossuary's skulls, an inscription,
// the stemma of the family, the relief of the Triumph, an arcosolium, the
// family tomb's door; a portico raised a step and the tribunal raised at
// the head of the legion's hall, and their steps; its floors (opus
// sectile, black-and-white mosaic, travertine flags, the galleries' tufa,
// the ossuary's bones, the tribunal's porphyry); and what's set about in
// it: the lamps (lit, or snuffed), urns, a sarcophagus, the busts of the
// ancestors, a statue, the legion's eagle, a column, a trophy of arms, an
// altar, bones, a pyramid of skulls, the fossors' oil, tools and slabs,
// fallen masonry, a ladder, the legion's banner. Last of all, so no block
// before them changes its number.
def('cc_tufa', { tool: 'pick', hardness: Infinity, drop: null, label: 'Tufa, Laid in a Net' });
def('cc_loculi', { interact: 'cc_loculus', hardness: Infinity, drop: null, label: 'Shelf-Graves (sealed)' });
def('cc_loculi_open', { hardness: Infinity, drop: null, label: 'Shelf-Graves (broken open)' });
def('cc_handhole', { hardness: Infinity, drop: null, label: 'A Broken Grave' });
def('cc_columbarium', { hardness: Infinity, drop: null, label: 'Columbarium' });
def('cc_fresco', { hardness: Infinity, drop: null, label: 'Fresco' });
def('cc_dove', { hardness: Infinity, drop: null, label: 'Fresco of a Dove' });
def('cc_skulls', { hardness: Infinity, drop: null, label: 'Wall of Skulls' });
def('cc_inscription', { interact: 'lore', hardness: Infinity, drop: null, label: 'Inscription' });
def('cc_stemma', { interact: 'lore', hardness: Infinity, drop: null, label: 'The Family Tree' });
def('cc_relief', { interact: 'lore', hardness: Infinity, drop: null, light: 2, label: 'The Triumph, in Relief' });
def('cc_arcosolium', { interact: 'lore', hardness: Infinity, drop: null, label: 'Arched Tomb' });
def('cc_tombdoor', { interact: 'cc_tombdoor', hardness: Infinity, drop: null, label: 'Door of the Family Tomb' });
def('cc_portico', { hardness: Infinity, drop: null, label: 'Portico' });
def('cc_portsteps', { solid: true, opaque: false, render: 'stair', stair: true, stairOf: 'cc_portico', rotatable: true, standable: true, hardness: Infinity, drop: null, label: 'Portico Steps' });
def('cc_tribunal', { hardness: Infinity, drop: null, light: 1, label: 'Tribunal' });
def('cc_tribsteps', { solid: true, opaque: false, render: 'stair', stair: true, stairOf: 'cc_tribunal', rotatable: true, standable: true, hardness: Infinity, drop: null, label: 'Tribunal Steps' });
def('cc_sectile', { hardness: Infinity, drop: null, label: 'Inlaid Marble' });
def('cc_mosaic', { hardness: Infinity, drop: null, label: 'Mosaic' });
def('cc_mosaicnet', { hardness: Infinity, drop: null, label: 'Mosaic' });
def('cc_flags', { hardness: Infinity, drop: null, label: 'Travertine Flags' });
def('cc_tufafloor', { tool: 'pick', hardness: Infinity, drop: null, label: 'Tufa Floor' });
def('cc_bonefloor', { hardness: Infinity, drop: null, label: 'Bones' });
def('cc_porphyry', { hardness: Infinity, drop: null, label: 'Porphyry' });
def('cc_lamp', { ...sprite, tall: true, solid: true, interact: 'cc_lamp', hardness: Infinity, light: 11, lightWhenState: true, drop: null, label: 'Bronze Lampstand' });
def('cc_lucerna', { ...sprite, solid: true, interact: 'cc_lamp', hardness: Infinity, light: 8, lightWhenState: true, drop: null, label: 'Oil Lamp' });
def('cc_urn', { ...sprite, solid: true, rotatable: true, kinds: true, hardness: 0.5, drop: [{ item: 'old_coin', chance: 0.35 }, { item: 'bone', chance: 0.3 }], label: 'Urn of Ashes' });
def('cc_sarcophagus', { ...sprite, solid: true, interact: 'lore', hardness: Infinity, drop: null, label: 'Sarcophagus' });
def('cc_bust', { ...sprite, tall: true, solid: true, rotatable: true, kinds: true, interact: 'cc_bust', hardness: Infinity, light: 3, lightWhenState: true, drop: null, label: 'Bust of an Ancestor' });
def('cc_statue', { ...sprite, tall: true, solid: true, hardness: Infinity, drop: null, label: 'Statue' });
def('cc_eagle', { ...sprite, tall: true, solid: true, hardness: Infinity, light: 3, drop: null, label: 'The Legion\'s Eagle' });
def('cc_column', { ...sprite, tall: true, solid: true, hardness: Infinity, drop: null, label: 'Column' });
def('cc_tropaeum', { ...sprite, tall: true, solid: true, hardness: Infinity, drop: null, label: 'Trophy of Arms' });
def('cc_altar', { ...sprite, solid: true, hardness: Infinity, light: 5, drop: null, label: 'Altar' });
def('cc_bones', { ...dressing, rotatable: true, interact: 'lore', hardness: Infinity, drop: null, label: 'Bones' });
def('cc_skullpile', { ...sprite, solid: true, hardness: Infinity, drop: null, label: 'Skulls' });
def('cc_amphora', { ...sprite, solid: true, rotatable: true, hardness: 0.5, drop: [{ item: 'clay', chance: 0.6 }], label: 'Amphorae of Lamp Oil' });
def('cc_tools', { ...dressing, rotatable: true, interact: 'lore', hardness: Infinity, drop: null, label: 'A Fossor\'s Tools' });
def('cc_slab', { ...sprite, solid: true, rotatable: true, interact: 'lore', hardness: Infinity, drop: null, label: 'Epitaph' });
def('cc_rubble', { ...sprite, solid: true, rotatable: true, hardness: Infinity, drop: null, label: 'Fallen Masonry' });
def('cc_ladder', { ...sprite, solid: false, support: false, onWall: true, rotatable: true, ladder: true, hardness: Infinity, drop: null, label: 'Ladder' });
def('cc_banner', { ...sprite, tall: true, solid: true, hardness: Infinity, drop: null, label: 'The Legion\'s Banner' });

// (Round 104) The Terracotta Vault made over (see world/deeps/vault.js): its
// wall of rammed earth beaten down in layers (a timber post against it, a
// crack in it); the palace's black lacquer (cloud scrolls; a gold roundel),
// the four beasts of the directions on silk, a bronze door with its monster
// mask, a crossbow's slot in the wall, a stele, the artisans' tally (and
// the crack beside it, which gives), the workshop's clay heads, a kiln; an
// earth ridge between the army's trenches, the dais and its steps; its
// floors (grey brick, loess, black stone, red lacquer, quicksilver, jade in
// a key pattern, a bronze bridge, a plate that sets off the crossbows); and
// what's set about in it: the clay soldiers (four kinds, each its face),
// one broken, a clay horse, a red column, the kneeling girl's lamp, a paper
// lantern, a bronze cauldron, the bells, the war drum, a screen, the
// throne, a mountain of the empire in bronze, the jade discs of the five
// directions (one block a colour), a soldier half made, clay, the bones of
// one sealed in, stone armour, a rack of arms, a fallen beam, jars. Last of
// all, so no block before them changes its number.
def('tv_earth', { tool: 'pick', hardness: Infinity, drop: null, label: 'Rammed Earth' });
def('tv_lacquer', { hardness: Infinity, drop: null, label: 'Black Lacquer' });
def('tv_roundel', { hardness: Infinity, drop: null, label: 'Black Lacquer, a Gold Roundel' });
def('tv_dragon', { interact: 'lore', hardness: Infinity, drop: null, label: 'The Azure Dragon of the East' });
def('tv_bird', { interact: 'lore', hardness: Infinity, drop: null, label: 'The Vermilion Bird of the South' });
def('tv_tiger', { interact: 'lore', hardness: Infinity, drop: null, label: 'The White Tiger of the West' });
def('tv_tortoise', { interact: 'lore', hardness: Infinity, drop: null, label: 'The Black Tortoise of the North' });
def('tv_bronzedoor', { interact: 'tv_bronzedoor', hardness: Infinity, drop: null, label: 'Bronze Door' });
def('tv_crossbow', { interact: 'tv_crossbow', hardness: Infinity, drop: null, label: 'A Slot in the Wall' });
def('tv_stele', { interact: 'lore', hardness: Infinity, drop: null, label: 'Stele' });
def('tv_tally', { interact: 'lore', hardness: Infinity, drop: null, label: 'Scratched Tally' });
def('tv_crack', { interact: 'tv_crack', hardness: Infinity, drop: null, label: 'Rammed Earth (cracked)' });
def('tv_heads', { hardness: Infinity, drop: null, label: 'Shelves of Clay Heads' });
def('tv_kiln', { hardness: Infinity, drop: null, light: 9, label: 'Kiln' });
def('tv_ridge', { hardness: Infinity, drop: null, label: 'Earth Ridge' });
def('tv_dais', { hardness: Infinity, drop: null, light: 1, label: 'Dais' });
def('tv_daissteps', { solid: true, opaque: false, render: 'stair', stair: true, stairOf: 'tv_dais', rotatable: true, standable: true, hardness: Infinity, drop: null, label: 'Dais Steps' });
def('tv_brick', { hardness: Infinity, drop: null, label: 'Grey Brick' });
def('tv_plate', { hardness: Infinity, drop: null, label: 'Grey Brick' });
def('tv_loess', { tool: 'pick', hardness: Infinity, drop: null, label: 'Loess' });
def('tv_stone', { hardness: Infinity, drop: null, label: 'Polished Black Stone' });
def('tv_lacquerfloor', { hardness: Infinity, drop: null, label: 'Red Lacquer' });
def('tv_mercury', { hardness: Infinity, drop: null, light: 2, label: 'Quicksilver' });
def('tv_jade', { hardness: Infinity, drop: null, light: 1, label: 'Jade in Black Stone' });
def('tv_bridge', { hardness: Infinity, drop: null, label: 'Bronze Bridge' });
def('tv_soldier', { ...sprite, solid: true, rotatable: true, kinds: true, hardness: Infinity, drop: null, label: 'Clay Soldier' });
def('tv_shards', { ...dressing, rotatable: true, kinds: true, hardness: Infinity, drop: null, label: 'A Broken Clay Soldier' });
def('tv_horse', { ...sprite, solid: true, hardness: Infinity, drop: null, label: 'Clay Horse' });
def('tv_column', { ...sprite, tall: true, solid: true, hardness: Infinity, drop: null, label: 'Red Column' });
def('tv_lamp', { ...sprite, solid: true, interact: 'tv_lamp', hardness: Infinity, light: 9, lightWhenState: true, drop: null, label: 'Bronze Lamp' });
def('tv_lantern', { ...sprite, tall: true, solid: true, hardness: Infinity, light: 10, lightWhenState: true, drop: null, label: 'Paper Lantern' });
def('tv_ding', { ...sprite, solid: true, interact: 'lore', hardness: Infinity, drop: null, label: 'Bronze Cauldron' });
def('tv_bells', { ...sprite, solid: true, interact: 'tv_bells', hardness: Infinity, drop: null, label: 'Bronze Bells' });
def('tv_drum', { ...sprite, solid: true, interact: 'tv_drum', hardness: Infinity, drop: null, label: 'War Drum' });
def('tv_screen', { ...sprite, solid: true, rotatable: true, hardness: Infinity, drop: null, label: 'Lacquer Screen' });
def('tv_throne', { ...sprite, solid: true, interact: 'lore', hardness: Infinity, drop: null, label: 'Throne' });
def('tv_mountain', { ...sprite, solid: true, rotatable: true, kinds: true, hardness: Infinity, drop: null, label: 'Bronze Mountain' });
def('tv_disc_green', { ...sprite, solid: true, interact: 'tv_disc', hardness: Infinity, light: 3, lightWhenState: true, drop: null, label: 'Green Jade Disc' });
def('tv_disc_red', { ...sprite, solid: true, interact: 'tv_disc', hardness: Infinity, light: 3, lightWhenState: true, drop: null, label: 'Red Jade Disc' });
def('tv_disc_white', { ...sprite, solid: true, interact: 'tv_disc', hardness: Infinity, light: 3, lightWhenState: true, drop: null, label: 'White Jade Disc' });
def('tv_disc_black', { ...sprite, solid: true, interact: 'tv_disc', hardness: Infinity, light: 3, lightWhenState: true, drop: null, label: 'Black Jade Disc' });
def('tv_disc_yellow', { ...sprite, solid: true, interact: 'tv_disc', hardness: Infinity, light: 3, lightWhenState: true, drop: null, label: 'Yellow Jade Disc' });
def('tv_torso', { ...sprite, solid: true, rotatable: true, hardness: Infinity, drop: null, label: 'A Soldier Half Made' });
def('tv_clay', { ...sprite, solid: true, rotatable: true, hardness: 0.5, drop: [{ item: 'clay', chance: 1 }], label: 'Clay' });
def('tv_bones', { ...dressing, rotatable: true, interact: 'lore', hardness: Infinity, drop: null, label: 'Bones' });
def('tv_armour', { ...sprite, solid: true, hardness: Infinity, drop: null, label: 'Stone Armour' });
def('tv_rack', { ...sprite, solid: true, rotatable: true, hardness: Infinity, drop: null, label: 'Rack of Arms' });
def('tv_beam', { ...sprite, solid: true, rotatable: true, hardness: Infinity, drop: null, label: 'Fallen Beam' });
def('tv_jars', { ...sprite, solid: true, rotatable: true, hardness: 0.5, drop: [{ item: 'clay', chance: 0.6 }, { item: 'jasmine_tea', chance: 0.2 }], label: 'Storage Jars' });

// (Round 105) The Leviathan's Gut made over (see world/deeps/gut.js): its
// walls of flesh in their folds; the throat's cartilage, a rib grown
// through the wall, the barnacled hide, a gutworm's hole, the whalers' scar
// (cut it open: their cache), the sphincter valve (it opens on the beat),
// an artery, worm eggs; a ledge of bone up on the ribs; its floors (the
// ridged gut, its grain either way, that pushes on the beat; flesh; bone
// sand; bile, that burns; ambergris; the swallowed ship's deck); and what's
// set about in it: a rib, the dead it's digesting, the whalers' camp (a
// tent, the try-pot, harpoons, lanterns, oil casks, a rope ladder, the
// captain's logbook), ambergris, eggs, a glowing cyst, polyps, the ship's
// hull and mast, a flensing hook, an anchor. Last of all, so no block
// before them changes its number.
def('lv_flesh', { tool: 'pick', hardness: Infinity, drop: null, label: 'Flesh' });
def('lv_cartilage', { hardness: Infinity, drop: null, label: 'Cartilage' });
def('lv_ribwall', { hardness: Infinity, drop: null, label: 'A Rib in the Flesh' });
def('lv_hide', { hardness: Infinity, drop: null, label: 'Hide, Barnacled' });
def('lv_wormhole', { hardness: Infinity, drop: null, label: 'A Hole in the Flesh' });
def('lv_scar', { interact: 'lv_scar', hardness: Infinity, drop: null, label: 'A Scar, Stitched' });
def('lv_valve', { interact: 'lv_valve', hardness: Infinity, drop: null, label: 'Sphincter' });
def('lv_artery', { hardness: Infinity, drop: null, light: 4, label: 'Artery' });
def('lv_eggs', { hardness: Infinity, drop: null, label: 'Worm Eggs' });
def('lv_ledge', { hardness: Infinity, drop: null, label: 'Bone Ledge' });
def('lv_rugae_x', { hardness: Infinity, drop: null, label: 'Ridged Gut' });
def('lv_rugae_z', { hardness: Infinity, drop: null, label: 'Ridged Gut' });
def('lv_fleshfloor', { hardness: Infinity, drop: null, label: 'Flesh' });
def('lv_bonesand', { tool: 'shovel', hardness: Infinity, drop: null, label: 'Bone Sand' });
def('lv_bile', { hardness: Infinity, drop: null, light: 2, label: 'Bile' });
def('lv_amberfloor', { hardness: Infinity, drop: null, label: 'Ambergris' });
def('lv_deck', { hardness: Infinity, drop: null, label: 'Wet Deck' });
def('lv_rib', { ...sprite, tall: true, solid: true, rotatable: true, hardness: Infinity, drop: null, label: 'Whale Rib' });
def('lv_skeleton', { ...dressing, rotatable: true, interact: 'lore', hardness: Infinity, drop: null, label: 'A Whaler, Half Digested' });
def('lv_tent', { ...sprite, solid: true, rotatable: true, hardness: Infinity, drop: null, label: 'Whalers\' Lean-To' });
def('lv_trypot', { ...sprite, solid: true, hardness: Infinity, light: 9, lightWhenState: true, drop: null, label: 'Try-Pot' });
def('lv_harpoons', { ...sprite, solid: true, rotatable: true, hardness: Infinity, drop: null, label: 'Harpoons' });
def('lv_lantern', { ...sprite, tall: true, solid: true, rotatable: true, hardness: Infinity, light: 10, lightWhenState: true, drop: null, label: 'Whale-Oil Lantern' });
def('lv_barrels', { ...sprite, solid: true, rotatable: true, interact: 'lore', hardness: 0.6, drop: [{ item: 'planks', chance: 0.5 }], label: 'Casks of Whale-Oil' });
def('lv_ladder', { ...sprite, solid: false, support: false, onWall: true, rotatable: true, ladder: true, hardness: Infinity, drop: null, label: 'Rope Ladder' });
def('lv_logbook', { ...sprite, solid: true, interact: 'lore', hardness: Infinity, drop: null, label: 'The Captain\'s Logbook' });
def('lv_ambergris', { ...sprite, solid: true, rotatable: true, kinds: true, hardness: 1, drop: [{ item: 'ambergris', chance: 1 }], label: 'Ambergris' });
def('lv_eggclutch', { ...dressing, rotatable: true, hardness: 0.3, drop: null, label: 'Worm Eggs' });
def('lv_cyst', { ...sprite, solid: true, hardness: Infinity, light: 8, drop: null, label: 'Glowing Cyst' });
def('lv_polyp', { ...dressing, rotatable: true, hardness: Infinity, drop: null, label: 'Polyps' });
def('lv_hull', { ...sprite, solid: true, rotatable: true, hardness: Infinity, drop: null, label: 'A Ship\'s Hull' });
def('lv_mast', { ...sprite, tall: true, solid: true, rotatable: true, hardness: Infinity, drop: null, label: 'A Broken Mast' });
def('lv_hook', { ...sprite, tall: true, solid: false, hardness: Infinity, drop: null, label: 'Flensing Hook' });
def('lv_anchor', { ...sprite, solid: true, rotatable: true, hardness: Infinity, drop: null, label: 'Anchor' });
