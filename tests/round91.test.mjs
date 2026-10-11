// Round 91: the essentials. A guest below ground has the floor's plan, laid
// out as the host's; what they see is noted on the host's record as well as
// their own; what any of you have seen reaches their map; and the
// version's step.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGame, stubInput, stubUI, stubRenderer } from './helpers.mjs';
import { Game } from '../src/game/game.js';
import { HostNet } from '../src/net/host.js';
import { GuestNet } from '../src/net/guest.js';
import { DungeonRun } from '../src/game/dungeon.js';
import { seenOf } from '../src/ui/dungeonmap.js';
import { GAME_VERSION, compareVersions } from '../src/version.js';
import { stepsFor, migrateSave } from '../src/game/migrate.js';

const uiStub = () => {
  const u = stubUI();
  u.windows = [];
  u.update = () => {};
  u.find = () => null;
  u.closeAll = () => {};
  return u;
};
function linked() {
  const game = makeGame(12345);
  const input = stubInput();
  game.minute = 10 * 60;
  for (let i = 0; i < 20; i++) game.update(0.1, input);
  const queue = [];
  let guestNet = null;
  const hostNet = new HostNet(game, {
    send: (text) => {
      if (text[0] === '@') {
        const body = text.slice(text.indexOf('|') + 1);
        queue.push(() => guestNet.receive(body));
      }
    },
    profile: { id: 'h', name: 'Hosty' },
    world: { name: 'Testland' },
    makeUI: () => uiStub(),
  });
  const flush = () => {
    while (queue.length) queue.shift()();
  };
  const out = { game, gg: null };
  const gin = stubInput();
  gin.keys = new Set();
  gin.isDown = (k) => gin.keys.has(k);
  guestNet = new GuestNet({
    send: (text) => queue.push(() => hostNet.receive(`@7|${text}`)),
    profile: { id: 'g', name: 'Guesty' },
    build: (save) => (out.gg = new Game({ seed: save.seed, renderer: stubRenderer(), audio: null, ui: uiStub(), save, remote: true })),
    onNeedHero: () => guestNet.sendHero(null),
    onEnd: () => {},
  });
  out.step = (n) => {
    for (let i = 0; i < n; i++) {
      game.update(0.05, input);
      flush();
      if (out.gg) out.gg.update(0.05, gin);
      flush();
    }
  };
  hostNet.receive('!' + JSON.stringify({ t: 'join', cid: 7, account: { id: 'g', name: 'Guesty' } }));
  flush();
  out.step(5);
  return out;
}

test('a guest below ground: the floor\'s plan, and what any of you have seen, on their map', () => {
  const L = linked();
  const { game } = L;
  const gp = game.seats[1].ent;
  const rec = { ...game.sim.dungeons.all.find((d) => d.type === 'barrow'), floors: {}, cleared: false, pack: null };
  new DungeonRun(game, rec).enter();
  L.step(4);
  game.asPlayer(gp, () => game.runFor(rec).enter());
  L.step(10);
  const run = game.dungeon;
  const theirs = L.gg.dungeon;
  assert.ok(theirs && theirs.data && theirs.data.plan, 'the plan, on their screen');
  const P = run.data.plan;
  const Q = theirs.data.plan;
  assert.equal(Q.W, P.W);
  assert.equal(Q.D, P.D);
  assert.equal(theirs.data.x0, run.data.x0, 'laid out where the host\'s is');
  assert.deepEqual([...Q.open].slice(0, 400), [...P.open].slice(0, 400));
  // The guest walks off a way on their own: the host's record has it too.
  const i = (x, z) => Math.round(z - (run.data.z0 || 0)) * P.W + Math.round(x - run.data.x0);
  let spot = null;
  for (let z = 0; z < P.D && !spot; z++) {
    for (let x = 0; x < P.W; x++) {
      const k = z * P.W + x;
      if (P.open[k] && !seenOf(run.rec, run.floor, P.W * P.D)[k] && Math.hypot(x + run.data.x0 - game.player.x, z + (run.data.z0 || 0) - game.player.z) > 14) {
        spot = { x: x + run.data.x0, z: z + (run.data.z0 || 0) };
        break;
      }
    }
  }
  assert.ok(spot, 'somewhere none of you have been');
  gp.teleport(spot.x, gp.y, spot.z);
  L.step(50);
  assert.ok(seenOf(run.rec, run.floor, P.W * P.D)[i(spot.x, spot.z)], 'noted on the host\'s record');
  // And somewhere only the host has been reaches the guest's map.
  assert.notEqual(theirs.rec, run.rec, 'their own copy of the record');
  const seenThere = (k) => seenOf(theirs.rec, theirs.floor, Q.W * Q.D)[k];
  let far = null;
  for (let k = 0; k < P.W * P.D && !far; k++) {
    const x = (k % P.W) + run.data.x0;
    const z = Math.floor(k / P.W) + (run.data.z0 || 0);
    if (P.open[k] && !seenThere(k) && Math.hypot(x - gp.x, z - gp.z) > 14) far = { x, z, k };
  }
  assert.ok(far, 'somewhere the guest hasn\'t seen');
  game.player.teleport(far.x, game.player.y, far.z);
  L.step(50);
  assert.ok(seenThere(far.k), 'where the host went, on the guest\'s map');
  assert.ok(seenThere(i(spot.x, spot.z)), 'and where they went themselves');
});

test('0.91.0: its step', () => {
  assert.ok(compareVersions(GAME_VERSION, '0.91.0') >= 0);
  assert.ok(stepsFor('0.90.0').some((s) => s.to === '0.91.0'));
  const { log } = migrateSave({ gv: '0.90.0', wg: 8 });
  assert.ok(log.some((l) => /map below ground/.test(l)));
});
