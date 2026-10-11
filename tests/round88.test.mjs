// Round 88: the essentials. Asking around about trouble sends you to
// whoever's asking (never offered as the asker's own); nobody abed where
// there's no bed; a bed broken out from under someone wakes them, and they
// mind; and the version's step.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeGame, stubInput } from './helpers.mjs';
import { B } from '../src/world/blocks.js';
import { sagaRespond } from '../src/sim/saga/talk.js';
import { GAME_VERSION, compareVersions } from '../src/version.js';
import { stepsFor, migrateSave } from '../src/game/migrate.js';

const input = stubInput();
const G = makeGame(12345, { wg: 8 });
const run = (n, dt = 0.05) => {
  for (let i = 0; i < n; i++) G.update(dt, input);
};
run(10);
const S = G.sim.saga;

test('someone else\'s task, asked of a passer-by: who to see, not theirs to give', () => {
  G.skipDays(3);
  for (let k = 0; G.skipping && k < 20000; k++) G.update(0.1, input);
  let pair = null;
  for (const th of S.threads) {
    for (const t of th.tasks) {
      if (t.status !== 'open' || !t.giver || t.giver.t !== 'rec') continue;
      const n = G.npcs.find((q) => !q.dead && q.rec && q.rec.age !== 'child' && q.settlement && q.settlement.id === t.giver.sid && q.rec.idx !== t.giver.idx);
      if (n) pair = { t, n };
      if (pair) break;
    }
    if (pair) break;
  }
  assert.ok(pair, 'a task with someone asking, and someone else in their town');
  const r = sagaRespond(pair.n, G, 'sg_offer', String(pair.t.id));
  assert.ok(!(r.choices || []).some((c) => c.id === 'sg_accept'), 'not taken on from them');
  assert.match(r.lines.join(' '), /hear|Word is|say/i);
});

test('nobody sleeps where there\'s no bed; a bed broken from under them wakes them, and they mind', () => {
  G.advanceTime((24 * 60 + 60 - G.minute) % 1440 || 1);
  run(1500);
  const n = G.npcs.find((q) => q.sleeping && q.bedTile && !q.bedTile.tent && q.rec.idx !== undefined);
  assert.ok(n, 'someone abed');
  assert.ok(n.bedThere(n.bedTile, n.y));
  // (Not without a bed.)
  assert.ok(!n.bedThere({ x: n.x + 40, z: n.z + 40 }, n.y));
  const before = G.sim.opinion(n);
  const bx = n.x;
  const bz = n.z;
  let by = -1;
  for (const y of [n.y, n.y - 1, n.y + 1]) if (G.world.getBlock(bx, y, bz) === B.bed) by = y;
  assert.ok(by >= 0, 'their bed');
  G.breakBlock(bx, by, bz, true);
  assert.ok(!n.sleeping, 'woken');
  assert.ok(G.sim.opinion(n) < before, 'and they mind');
  // (Another's bed gone some other way: they're up within a moment or two.)
  const m = G.npcs.find((q) => q !== n && q.sleeping && q.bedTile && !q.bedTile.tent);
  if (m) {
    for (const y of [m.y, m.y - 1, m.y + 1]) if (G.world.getBlock(m.x, y, m.z) === B.bed) G.world.setBlock(m.x, y, m.z, B.air);
    run(60);
    assert.ok(!m.sleeping, 'up off the floor');
  }
});

test('0.88.0: its step', () => {
  assert.ok(compareVersions(GAME_VERSION, '0.88.0') >= 0);
  assert.ok(stepsFor('0.87.0').some((s) => s.to === '0.88.0'));
  const { log } = migrateSave({ gv: '0.87.0', wg: 8 });
  assert.ok(log.some((l) => /bed/.test(l)));
});
