// Round 94: the essentials. Down the stairs with others on the floor: no
// one's pulled across it; the one at the stairs waits, and when the rest
// come they all go on together; a Kavorent hall never crowded past what
// you can get about in; and the version's step.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGame, stubInput, stubUI, stubRenderer } from './helpers.mjs';
import { Game } from '../src/game/game.js';
import { HostNet } from '../src/net/host.js';
import { GuestNet } from '../src/net/guest.js';
import { DungeonRun, GATHER_R } from '../src/game/dungeon.js';
import { buildFloor, FY, KAV_CROWD } from '../src/world/dungeongen.js';
import { BLOCKS } from '../src/world/blocks.js';
import { REGION_W, REGION_D, INST_RX } from '../src/config.js';
import { seatField } from '../src/game/party.js';
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

test('the stairs with others still about the floor: nobody pulled across it; all of you go on together', () => {
  const L = linked();
  const { game } = L;
  const gp = game.seats[1].ent;
  const rec = { ...game.sim.dungeons.all.find((d) => d.type === 'barrow' && d.depth > 1), floors: {}, cleared: false, pack: null, packs: [] };
  new DungeonRun(game, rec).enter();
  L.step(4);
  game.asPlayer(gp, () => game.runFor(rec).enter());
  L.step(8);
  const run = game.dungeon;
  assert.equal(run.floor, 0);
  // The guest off across the floor.
  const far = run.data.rooms.map((r) => ({ x: r.cx + run.data.x0, z: r.cz })).sort((a, b) => Math.hypot(b.x - game.player.x, b.z - game.player.z) - Math.hypot(a.x - game.player.x, a.z - game.player.z))[0];
  gp.teleport(far.x, FY, far.z);
  game.moveEntity(gp, far.x, FY, far.z);
  L.step(2);
  const where = { x: gp.x, z: gp.z };
  assert.ok(Math.max(Math.abs(gp.x - game.player.x), Math.abs(gp.z - game.player.z)) > GATHER_R);
  // The host takes the stairs: waits there; the guest isn't moved.
  assert.equal(run.changeFloor(1), false);
  L.step(10);
  assert.equal(run.floor, 0, 'not yet');
  assert.ok(run.waitFor, 'waiting by the stairs');
  assert.deepEqual({ x: gp.x, z: gp.z }, where, 'the guest stays where they were');
  // The guest comes over: on they all go.
  const at = game.findFreeSpot(game.player.x + 1, game.player.z, game.player.y);
  gp.teleport(at.x, at.y, at.z);
  game.moveEntity(gp, at.x, at.y, at.z);
  L.step(4);
  assert.equal(run.floor, 1, 'down together');
  assert.ok(!run.waitFor);
  assert.equal(seatField(game, game.seats[1], 'dungeon'), run);
});

test('a Kavorent floor: no hall crowded past getting about it', () => {
  const game = makeGame(12345, { wg: 8 });
  const kav = game.sim.dungeons.all.filter((d) => d.type === 'kavorent');
  assert.ok(kav.length);
  let worst = 0;
  for (const base of kav) {
    for (let s = 0; s < 3; s++) {
      const rec = { ...base, seed: (base.seed + s * 7919) >>> 0 };
      for (let n = 0; n < rec.depth; n++) {
        const D = buildFloor(rec, n, INST_RX);
        const P = D.plan;
        const get = (lx, z) => {
          const wx = lx + D.x0;
          const r = D.regions.get(Math.floor(wx / REGION_W) * 4096 + Math.floor(z / REGION_D));
          return r ? r.get(wx % REGION_W, FY, z % REGION_D) : 0;
        };
        const per = new Map();
        for (let i = 0; i < P.W * P.D; i++) {
          if (!P.open[i] || P.room[i] < 0) continue;
          const e = per.get(P.room[i]) || { n: 0, solid: 0 };
          e.n++;
          const id = get(i % P.W, Math.floor(i / P.W));
          if (BLOCKS[id] && BLOCKS[id].solid) e.solid++;
          per.set(P.room[i], e);
        }
        for (const [ri, e] of per) {
          const r = D.rooms[ri];
          if (!r || ['boss', 'vault', 'hidden'].includes(r.kit) || r.sealed || e.n < 20) continue;
          worst = Math.max(worst, e.solid / e.n);
        }
      }
    }
  }
  assert.ok(worst <= 0.3, `the most crowded hall: ${worst.toFixed(2)} of its floor`);
  assert.ok(KAV_CROWD <= 0.2);
});

test('0.94.0: its step', () => {
  assert.ok(compareVersions(GAME_VERSION, '0.94.0') >= 0);
  assert.ok(stepsFor('0.93.0').some((s) => s.to === '0.94.0'));
  const { log } = migrateSave({ gv: '0.93.0', wg: 8 });
  assert.ok(log.some((l) => /stairs/.test(l)));
});
