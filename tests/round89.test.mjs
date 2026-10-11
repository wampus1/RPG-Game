// Round 89: the essentials. An instrument's notes go out through the world
// (so a world's host sends them to every player near), fainter with
// distance and silent past earshot; and the version's step.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { GAME_VERSION, compareVersions } from '../src/version.js';
import { stepsFor, migrateSave } from '../src/game/migrate.js';

test('instrument notes: played through the world, sent to whoever is near', async () => {
  const { Renderer } = await import('../src/render/renderer.js');
  const played = [];
  const fake = { game: { ui: { music: {} }, player: { x: 0, z: 0 }, audio: null }, noteVoice: { play: (k, i, v) => played.push(v) } };
  Renderer.prototype.instrumentNote.call(fake, 0, 6, 0, 'lute', 2);
  Renderer.prototype.instrumentNote.call(fake, 12, 6, 0, 'lute', 2);
  Renderer.prototype.instrumentNote.call(fake, 60, 6, 0, 'lute', 2);
  assert.equal(played.length, 2, 'not heard from far off');
  assert.ok(played[0] > played[1], 'fainter further away');
  // (The host sends it on, like the world's other sounds and sights.)
  assert.match(readFileSync(new URL('../src/net/host.js', import.meta.url), 'utf8'), /wrap\('instrumentNote'/);
  assert.match(readFileSync(new URL('../src/ui/instrument.js', import.meta.url), 'utf8'), /renderer\.instrumentNote/);
});

test('0.89.0: its step', () => {
  assert.ok(compareVersions(GAME_VERSION, '0.89.0') >= 0);
  assert.ok(stepsFor('0.88.0').some((s) => s.to === '0.89.0'));
  const { log } = migrateSave({ gv: '0.88.0', wg: 8 });
  assert.ok(log.some((l) => /Chairs/.test(l)));
});
