import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGame, stubInput } from './helpers.mjs';
import { DAY } from '../src/sim/econ.js';

function start(seed = 12345, minute = 9 * 60) {
  const game = makeGame(seed);
  const input = stubInput();
  game.minute = minute;
  for (let i = 0; i < 20; i++) game.update(0.1, input);
  const [sid, a] = [...game.active][0];
  return { game, input, sid, a, L: a.layout, p: game.player, w: game.world };
}

test('a hearing waits for the morning, with the prisoner kept in the cell', () => {
  const { game, input, sid, L } = start(7, 23 * 60);
  const j = game.sim.justice;
  j.commit(sid, 'theft', { item: 'bread', n: 1, witnesses: [] });
  j.imprison(sid, 'surrender', true);
  assert.equal(j.jail.phase, 'night');
  for (let i = 0; i < 30; i++) game.update(0.1, input);
  assert.equal(j.jail.phase, 'night', 'no hearing at night');
  if (L.jail) assert.ok(L.jail.cell.some((c) => c.x === game.player.x && c.z === game.player.z), 'still in the cell');
  // Saved and loaded overnight, still waiting.
  assert.equal(j.serialize().jail.phase, 'night');
  game.minute = 10 * 60;
  for (let i = 0; i < 40 && j.jail && j.jail.phase === 'night'; i++) game.update(0.1, input);
  assert.notEqual(j.jail.phase, 'night', 'the hearing is called in the morning');
});

test('in daylight with everyone up, the hearing is called at once', () => {
  const { game, sid } = start(7, 11 * 60);
  const j = game.sim.justice;
  j.commit(sid, 'theft', { item: 'bread', n: 1, witnesses: [] });
  j.imprison(sid, 'surrender', true);
  assert.equal(j.jail.phase, 'gather');
});

test('fewer people notice a crime in the dark, and far-off busy people often miss it', () => {
  const { game, sid, a } = start(12345, 12 * 60);
  const n = a.npcs.find((q) => !q.sleeping && q.rec.age === 'adult' && q.rec.job !== 'guard');
  const px = n.x;
  const pz = n.z + 6;
  n.face(px, pz);
  const day = () => game.sim.witnesses(sid, px, pz, 9).includes(n);
  game.minute = 1 * 60;
  n.sleeping = false;
  assert.ok(!game.sim.witnesses(sid, px, pz, 9).includes(n), 'six tiles off in the dark: too far');
  game.minute = 12 * 60;
  // Up close, anyone notices.
  assert.ok(game.sim.witnesses(sid, n.x, n.z + 2, 9).includes(n) || !game.sim.lineOfSight(n.x, n.z, n.x, n.z + 2, n.y + 1));
  // Far off, over many minutes, they don't always.
  let seen = 0;
  const t0 = game.sim.abs;
  for (let k = 0; k < 40; k++) {
    game.minute = 12 * 60 + k * 3;
    if (day()) seen++;
  }
  void t0;
  assert.ok(seen < 40, `noticed ${seen} times out of 40`);
});

test('the mayor pays someone from town to carry a letter, who comes back paid', () => {
  const { game, L } = start(12345, 9 * 60);
  const dip = game.sim.diplomacy;
  const to = dip.neighbours(L.settlement)[0];
  assert.ok(to, 'a neighbour to write to');
  L.econ.treasury = 500;
  const q = dip.write(L.settlement, to, 'trade');
  q.written -= 11 * 60;
  const t0 = L.econ.treasury;
  dip.courier(game.sim.abs);
  assert.equal(q.status, 'carried');
  assert.ok(q.courier, 'carried by a hired courier');
  const rec = L.npcs[q.carrierIdx];
  assert.ok(rec.errand, 'they have the errand');
  assert.ok(L.econ.treasury < t0, 'the treasury paid');
  assert.ok(L.econ.ledger.some((it) => /paid .* to carry a letter/.test(it.text)));
  const coins = rec.coins;
  game.sim.diplomacy.courierHome(L, rec, game.day);
  assert.ok(rec.coins > coins && !rec.errand && !rec.away);
  void DAY;
});
