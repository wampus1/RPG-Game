// The game's version: shown on the title screen, written into every save
// and sent when joining someone's world. Raise it with each release (the
// middle number is the round of work; see README). Worlds made in another
// version still load, with a warning; a player on another version can't
// join a world (see tools/relay.mjs).
export const GAME_VERSION = '0.56.0';

// Written as people read it.
export const versionText = (v) => (v ? `v${v}` : 'an older version');

// A world's version against this one: true if it's this one.
export const sameVersion = (v) => v === GAME_VERSION;

// Two versions in order: below 0 if `a` is older than `b`, 0 if they're
// the same, above 0 if newer. (No version at all: older than any.)
export function compareVersions(a, b) {
  const part = (v) => (v ? String(v).split('.').map((n) => parseInt(n, 10) || 0) : [-1]);
  const x = part(a);
  const y = part(b);
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const d = (x[i] ?? 0) - (y[i] ?? 0);
    if (d) return Math.sign(d);
  }
  return 0;
}

// Can a world made in version `v` be brought up to this one? (Only ever
// forward: a world from a newer version can't be taken back.)
export const canUpgrade = (v) => compareVersions(v, GAME_VERSION) < 0;
