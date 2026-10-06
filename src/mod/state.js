// What's in the game from mods just now (round 62): kept apart from the
// rest (nothing imported), so anything can look without pulling the mods
// in. Filled by registry.js; added to by hooks.js, build.js, render.js.
export const MODS = {
  active: [], // the mods, as given
  byId: new Map(),
  ents: new Map(), // game key -> { mod, ent, kind, prog, runner, f (fields), key }
  blocks: new Map(), // block id -> ent record
  loot: new Map(), // `${mod}:${id}` -> table
  structures: new Map(), // `${mod}:${id}` -> structure
  layouts: new Map(),
  dungeons: new Map(),
  vfx: new Map(),
  assets: new Map(),
  rigs: new Map(),
  stories: new Map(),
  sounds: new Map(), // game key ('m:mod:id') -> { mod, v } (round 66)
  songs: new Map(), // likewise
  events: [], // world events' records
  effects: new Map(), // game key -> record
  blockIds: {}, // game key -> id (what the world keeps)
  hooks: { install: [], uninstall: [] }, // others' own setting up (render, stories...)
  host: null, // what graphs reach the game through (see hooks.js)
  serial: 0,
};

