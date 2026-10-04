import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGame, stubInput } from './helpers.mjs';
import { B } from '../src/world/blocks.js';
import { exileSpot, EXILE_CLEAR } from '../src/sim/justice.js';
import { blastRubble } from '../src/entities/bosses.js';
import { teleportTo } from '../src/game/commands.js';

test('the banished are left well clear of the town, and its guards don\'t come after them', () => {
  const game = makeGame(12345);
  const input = stubInput();
  const ow = game.world.ow;
  const towns = ow.settlements.filter((s) => s && s.bounds && (s.type === 'town' || s.type === 'city')).slice(0, 4);
  for (const s of towns) {
    const L = game.sim.layoutOf(s.id) || game.world.getLayout(s);
    const at = exileSpot(game, L);
    assert.equal(ow.settlementAt(at.x, at.z), null, `${s.name}: out of town`);
    const b = s.bounds;
    const gap = Math.max(b.x0 - at.x, at.x - b.x1, b.z0 - at.z, at.z - b.z1);
    assert.ok(gap >= EXILE_CLEAR, `${s.name}: ${gap} paces clear`);
  }
  // Banished for real from the first: no guard lays a hand on you after.
  const s = towns[0];
  teleportTo(game, (s.bounds.x0 + s.bounds.x1) >> 1, (s.bounds.z0 + s.bounds.z1) >> 1);
  for (let t = 0; t < 2; t += 0.1) game.update(0.1, input);
  const L = game.active.get(s.id).layout;
  game.sim.justice.exile(L, { judgeName: 'the mayor', proven: [] });
  const p = game.player;
  const hp = p.hp;
  for (let t = 0; t < 20; t += 0.1) game.update(0.1, input);
  assert.equal(game.currentSettlement, null, 'not in town');
  assert.ok(p.hp >= hp && !p.dead, 'unharmed');
  assert.ok(game.sim.justice.exiled.has(s.id), 'still exiled');
});

test('Foreman Gask\'s charges blow apart his own rubble close by, and only his', () => {
  const game = makeGame(12345);
  const w = game.world;
  const p = game.player;
  const y = p.y;
  const x = p.x + 5;
  const z = p.z + 5;
  const c = { rubble: new Set() };
  for (const [dx, dz] of [[0, 0], [1, 0], [3, 0]]) {
    w.setBlock(x + dx, y, z + dz, B.gravel);
    c.rubble.add(`${x + dx},${y},${z + dz}`);
  }
  // (Gravel of the hall's own, not his.)
  w.setBlock(x - 1, y, z, B.gravel);
  const n = blastRubble(game, c, x, y, z);
  assert.equal(n, 2);
  assert.equal(w.getBlock(x, y, z), B.air);
  assert.equal(w.getBlock(x + 1, y, z), B.air);
  assert.equal(w.getBlock(x + 3, y, z), B.gravel, 'too far off');
  assert.equal(w.getBlock(x - 1, y, z), B.gravel, 'not his');
});
