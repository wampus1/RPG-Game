// Block registry. Every cell of the world grid stores a block id (Uint8) and a
// meta byte: bits 0-1 rotation (0=S,1=W,2=N,3=E), bit 2 state (open / lit).

export const META_ROT = 0b011;
export const META_STATE = 0b100;

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
  rotatable: false,
  interact: null,
  replaceable: false,
  support: false, // pops off when the block below disappears
  liquid: false,
  label: null,
  tall: false, // sprite visually spans two layers
};

function def(name, props = {}) {
  const id = BLOCKS.length;
  const d = { ...DEFAULTS, ...props, id, name };
  if (d.standable === null) d.standable = d.solid && d.render === 'cube';
  if (d.drop === undefined) d.drop = name;
  if (!d.label) d.label = name.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  BLOCKS.push(d);
  B[name] = id;
  return d;
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
def('table', { ...sprite, tool: 'axe', hardness: 0.7 });
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
export const ROAD_BLOCKS = new Set([B.path, B.cobblestone, B.gravel, B.stone_bricks, B.planks, B.planks_dark]);
export const LOGS = new Set(
  ['oak', 'birch', 'pine', 'palm', 'jungle', 'acacia', 'willow'].map((w) => B[`log_${w}`]),
);
export const LEAVES = new Set(
  ['oak', 'birch', 'pine', 'palm', 'jungle', 'acacia', 'willow', 'snowy'].map((w) => B[`leaves_${w}`]),
);
