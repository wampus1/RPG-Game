// Round 90: the essentials. Another player's wagon: sat in it (on the
// bench beside the reins, never at them), carried along with it while its
// owner drives, shown up there; still in it when it stops; out by moving;
// and the version's step.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeGame, stubInput } from './helpers.mjs';
import { GAME_VERSION, compareVersions } from '../src/version.js';
import { stepsFor, migrateSave } from '../src/game/migrate.js';

const input = stubInput();
const G = makeGame(12345, { wg: 8 });
for (let i = 0; i < 10; i++) G.update(0.05, input);

test('another player\'s wagon: in it, carried along as its owner drives, never two at the reins', () => {
  const p = G.player;
  const R = G.riding;
  // A second player, beside you.
  const p2 = { seat: { id: 'friend' }, x: p.x + 1, y: p.y, z: p.z, dead: false, look: { name: 'friend' }, mount: null, moving: false };
  p2.teleport = function teleport(x, y, z) { Object.assign(this, { x, y, z }); };
  p2.startMove = p2.teleport;
  G.everyone = () => [p, p2];
  // Your wagon, a horse in its shafts.
  p.give('wagon', 1);
  const x = Math.round(p.x) + 2;
  const z = Math.round(p.z);
  const y = G.world.findStandY(x, z, p.y);
  assert.ok(R.placeWagon(x, y, z));
  const w = R.wagons[R.wagons.length - 1];
  assert.equal(w.owner, 'host');
  R.horses.push({ id: 999, coat: 1, x, y, z });
  w.horse = 999;
  G.standT = 0;
  G.syncStanding(0.1);
  const prop = [...G.props.values()].find((o) => o.own === w);
  assert.ok(prop, 'standing');
  // They climb up onto the bench: beside it, not driving.
  const was = G.player;
  G.player = p2;
  R.useWagon(prop, 'bench');
  G.player = was;
  assert.equal(p2.mount, null, 'not at the reins');
  assert.equal(p2.inWagonId, w.id);
  assert.equal(p2.wagonSeat, 'bench');
  // You take up the reins and drive off: they come too.
  R.useWagon(prop, 'bench');
  assert.ok(p.mount && p.mount.wagonId === w.id);
  G.standT = 0;
  G.syncStanding(0.1);
  assert.ok(![...G.props.values()].some((o) => o.own === w), 'not standing while driven');
  p.teleport(x + 6, y, z);
  R.carry();
  assert.equal(p2.x, p.x);
  assert.equal(p2.z, p.z);
  assert.deepEqual(p.mount.benchMate, p2.look, 'shown beside you');
  // They can't take it from you.
  G.player = p2;
  R.useWagon({ own: w, x: p.x, y: p.y, z: p.z }, 'bench');
  G.player = was;
  assert.equal(p2.mount, null);
  // You stop: they're still sat in it, where it stands.
  R.dismount();
  G.standT = 0;
  G.syncStanding(0.1);
  R.carry();
  const now = [...G.props.values()].find((o) => o.own === w);
  assert.ok(now && p2.inWagon === now, 'in the one standing now');
  R.seatShown(now);
  assert.deepEqual(now.bench, p2.look);
  delete G.everyone;
});

test('0.90.0: its step', () => {
  assert.ok(compareVersions(GAME_VERSION, '0.90.0') >= 0);
  assert.ok(stepsFor('0.89.0').some((s) => s.to === '0.90.0'));
  const { log } = migrateSave({ gv: '0.89.0', wg: 8 });
  assert.ok(log.some((l) => /wagon/.test(l)));
});
