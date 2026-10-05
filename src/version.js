// The game's version: shown on the title screen, written into every save
// and sent when joining someone's world. Raise it with each release (the
// middle number is the round of work; see README). Worlds made in another
// version still load, with a warning; a player on another version can't
// join a world (see tools/relay.mjs).
export const GAME_VERSION = '0.48.0';

// Written as people read it.
export const versionText = (v) => (v ? `v${v}` : 'an older version');

// A world's version against this one: true if it's this one.
export const sameVersion = (v) => v === GAME_VERSION;
