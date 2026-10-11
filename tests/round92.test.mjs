// Round 92: the essentials. A time crystal used at a way in: everyone near
// sees it turned back (on their own screen too), whoever held it up, and
// the place is turned back once; and the version's step.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGame, stubInput, stubUI, stubRenderer } from './helpers.mjs';
import { Game } from '../src/game/game.js';
import { HostNet } from '../src/net/host.js';
import { GuestNet } from '../src/net/guest.js';
import { ITEMS } from '../src/world/items.js';
import { useTimeCrystal } from '../src/game/timecrystal.js';
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

function nearPlace(L) {
  const { game } = L;
  const gp = game.seats[1].ent;
  const rec = game.sim.dungeons.all.find((d) => d.type === 'barrow');
  rec.cleared = true;
  const site = game.sim.dungeons.site(rec);
  site.state = { cleared: true };
  game.teleportPlayer(rec.x + 1, 6, rec.z + 2);
  game.asPlayer(gp, () => game.teleportPlayer(rec.x - 2, 6, rec.z + 2));
  L.step(20);
  return { gp, rec };
}

test('the host holds it up: the guest sees it, on their own screen; turned back once', () => {
  const L = linked();
  const { game } = L;
  const { gp, rec } = nearPlace(L);
  const p = game.player;
  p.inv[p.selected] = { item: 'time_crystal_1', count: 1 };
  assert.ok(useTimeCrystal(game, ITEMS.time_crystal_1));
  assert.equal(game.scene && game.scene.kind, 'timeturn');
  const theirs = seatField(game, game.seats[1], 'scene');
  assert.ok(theirs && theirs.kind === 'timeturn' && theirs.witness, 'the guest watching');
  assert.equal(theirs.holder, p, 'the crystal in the host\'s hand');
  L.step(4);
  assert.ok(L.gg.scene && L.gg.scene.kind === 'timeturn', 'played on the guest\'s screen');
  assert.ok(L.gg.scene.witness && L.gg.scene.shown);
  L.step(160);
  assert.equal(rec.cleared, false, 'turned back');
  assert.equal(rec.restores, 1, 'once');
  assert.ok(!L.gg.scene, 'and over for them');
  assert.ok(gp);
});

test('a guest holds it up: the host sees it too', () => {
  const L = linked();
  const { game } = L;
  const { gp, rec } = nearPlace(L);
  game.asPlayer(gp, () => {
    gp.inv[gp.selected] = { item: 'time_crystal_1', count: 1 };
    assert.ok(useTimeCrystal(game, ITEMS.time_crystal_1));
  });
  assert.ok(game.scene && game.scene.kind === 'timeturn' && game.scene.witness, 'the host watching');
  assert.equal(game.scene.holder, gp);
  L.step(4);
  assert.ok(L.gg.scene && L.gg.scene.kind === 'timeturn' && !L.gg.scene.witness, 'the guest\'s own, on their screen');
  L.step(160);
  assert.equal(rec.restores, 1, 'turned back once');
});

test('0.92.0: its step', () => {
  assert.ok(compareVersions(GAME_VERSION, '0.92.0') >= 0);
  assert.ok(stepsFor('0.91.0').some((s) => s.to === '0.92.0'));
  const { log } = migrateSave({ gv: '0.91.0', wg: 8 });
  assert.ok(log.some((l) => /time crystal/.test(l)));
});
