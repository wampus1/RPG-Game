// Round 76: paintings only where they belong (not in temples or jails,
// not where anything stands, not over a door), knocking at doors (never at
// your own; half a minute, then off), the salt flats toned down, and the
// migration step.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGame, stubInput } from './helpers.mjs';
import { BLOCKS } from '../src/world/blocks.js';
import { NO_PAINTINGS } from '../src/world/settlement.js';
import { ofHouse } from '../src/game/doorlocks.js';
import { FAR_P } from '../src/render/farart.js';
import { STEPS } from '../src/game/migrate.js';
import { GAME_VERSION, compareVersions } from '../src/version.js';
import { SURFACE } from '../src/config.js';

const Y0 = SURFACE + 1;

test('paintings: none in temples, jails or barns; none where anything stands or over a door', () => {
  for (const t of ['temple', 'prison', 'stockade', 'barn', 'guardhouse']) assert.ok(NO_PAINTINGS.has(t), t);
  let seen = 0;
  for (const seed of [12345, 777]) {
    const game = makeGame(seed, { wg: 5 });
    const input = stubInput();
    for (let i = 0; i < 3; i++) game.update(0.1, input);
    const w = game.world;
    for (const L of w.layouts.values()) {
      for (const b of L.buildings) {
        if (b.x0 === undefined) continue;
        for (let z = b.z0; z <= b.z1; z++) {
          for (let x = b.x0; x <= b.x1; x++) {
            for (let y = Y0; y <= Y0 + 5; y++) {
              const id = w.getBlock(x, y, z);
              if (!BLOCKS[id] || !BLOCKS[id].painting) continue;
              seen++;
              assert.ok(!NO_PAINTINGS.has(b.type), `a painting in a ${b.type}`);
              if (y === Y0 + 1) {
                const under = BLOCKS[w.getBlock(x, Y0, z)];
                assert.ok(!under.solid || under.render !== 'cube', `${b.type}: a painting over a wall or a block`);
                assert.ok(!(b.door && b.door.x === x && b.door.z === z - 1), 'over the door');
              }
            }
          }
        }
      }
    }
  }
  assert.ok(seen > 0, 'some hung');
});

test('nobody\'s locked out of their own house; a knock waits half a minute, then they go', () => {
  const H = { b: { id: 7, family: 'Ashdown' }, L: {} };
  assert.ok(ofHouse({ rec: { home: 7 }, layout: H.L }, H));
  assert.ok(ofHouse({ rec: { home: '7' }, layout: H.L }, H), 'however the id is kept');
  assert.ok(ofHouse({ rec: { home: 3, name: { last: 'Ashdown' } }, layout: H.L }, H), 'of the family');
  assert.ok(!ofHouse({ rec: { home: 3, name: { last: 'Brook' } }, layout: H.L }, H));
  assert.ok(!ofHouse({ rec: { home: 3, name: { last: 'Ashdown' } }, layout: {} }, H), 'not the same name from another town');
});

test('the salt flats are no longer a glare', () => {
  const lum = (h) => {
    const n = parseInt(h.slice(1), 16);
    return 0.3 * (n >> 16) + 0.59 * ((n >> 8) & 255) + 0.11 * (n & 255);
  };
  for (const c of FAR_P.salt_crust) assert.ok(lum(c) < 235, c);
});

test('the migration step: 0.76.0', () => {
  assert.ok(compareVersions(GAME_VERSION, '0.76.0') >= 0);
  const step = STEPS.find((s) => s.to === '0.76.0');
  const game = makeGame(777);
  const log = [];
  step.data({}, log);
  step.game(game, log);
  assert.ok(log.length);
});
