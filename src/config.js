// Global constants shared by every system.

// --- Projection -----------------------------------------------------------
// The world is a 3D grid of cubes. x runs east, z runs south, y runs up.
// It is drawn in an oblique "3/4 top-down" projection: every cube shows its
// top face (TILE x TILE) and its south-facing front face (TILE x LH).
export const TILE = 16; // px, width/depth of a cube's top face
export const LH = 12; // px, visible height of one layer (front face height)

// --- Internal framebuffer ---------------------------------------------------
export const VIEW_W = 512;
export const VIEW_H = 288;
export const SCREEN_TILES_W = VIEW_W / TILE; // 32
export const SCREEN_TILES_H = VIEW_H / TILE; // 18

// --- World dimensions -------------------------------------------------------
// One square on the world map == one region == 2x2 screens of tiles.
export const REGION_W = SCREEN_TILES_W * 2; // 64 tiles
export const REGION_D = SCREEN_TILES_H * 2; // 36 tiles
export const WORLD_Y = 16; // number of vertical layers
export const MAP_W = 320; // world map width in regions (the Dagoni Islands are a small part of it: see world/geography.js)
export const MAP_H = 240; // world map height in regions
export const WORLD_TILES_W = MAP_W * REGION_W;
export const WORLD_TILES_D = MAP_H * REGION_D;
// Places apart from the island (a dungeon's floor, the deck of a ship at
// sea) are laid out far off to the east, past the edge of the map, in
// regions of their own that only exist while you're there: see
// World.inst. Region x indices from INST_RX on belong to them.
export const INST_RX = 2000;
export const INST_X0 = INST_RX * REGION_W;
// Each of them has a space of its own out there, side by side (so more than
// one can be open at once, for players in different old places): this
// many regions wide. The first (slot 0) is a ship at sea's; each old place
// has its own after that (see DungeonRun).
export const INST_SLOT_RX = 4;
export const instSlotOf = (rx) => Math.floor((rx - INST_RX) / INST_SLOT_RX);

// Standing level on flat ground: the surface block sits at GROUND-1 and
// creatures stand (feet) at GROUND. Water surfaces sit flush with the ground.
export const GROUND = 6;
export const SURFACE = GROUND - 1; // 5
export const WATER_Y = SURFACE; // water surface block layer

// --- ASCII UI grid ----------------------------------------------------------
export const CHAR_W = 6;
export const CHAR_H = 8;
export const COLS = Math.floor(VIEW_W / CHAR_W); // 85
export const ROWS = Math.floor(VIEW_H / CHAR_H); // 36

// --- Time -------------------------------------------------------------------
export const DAY_MINUTES = 24 * 60;
export const GAME_MINUTES_PER_SECOND = 1.0; // one in-game day == 24 real minutes

// --- Gameplay ---------------------------------------------------------------
export const REACH = 4.5; // tiles
export const PLAYER_STEP_TIME = 0.16; // seconds per tile
export const NPC_STEP_TIME = 0.3;
export const BELT_SIZE = 9;
export const INV_SIZE = 36; // belt (first 9) + backpack
export const REGION_LOAD_RADIUS = 1; // regions around the player kept generated
export const SETTLEMENT_ACTIVE_DIST = 90; // tiles from settlement bounds

export const DIRS = [
  { dx: 0, dz: 1, name: 'down' }, // 0: south / facing camera
  { dx: -1, dz: 0, name: 'left' }, // 1: west
  { dx: 0, dz: -1, name: 'up' }, // 2: north
  { dx: 1, dz: 0, name: 'right' }, // 3: east
];

export function dirFromDelta(dx, dz) {
  if (Math.abs(dx) > Math.abs(dz)) return dx < 0 ? 1 : 3;
  return dz < 0 ? 2 : 0;
}

// (Round 55) Anything running away (a hare from you, a monster backing
// off, a townsperson from a fight, an outlaw breaking off) goes 15% slower
// than it used to: each of its steps takes this much longer.
export const FLEE = 1 / 0.85;
