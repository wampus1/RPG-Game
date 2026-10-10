// Round 77 (QOL, part 3): rebindable keys and settings in tabs, the
// background laying out of towns (no town built all at once), upstairs
// slept and worked in, coaches and ferries, swimming, snow and rain on the
// ground, dialogue in kinds and what folk remember, and the migration step.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGame, stubInput } from './helpers.mjs';
import { B } from '../src/world/blocks.js';
import { ACTIONS, bind, keyOf, remapKey, resetKeybinds, loadKeybinds } from '../src/game/keybinds.js';
import { SETTING_ROWS, SETTING_TABS, DEFAULTS } from '../src/game/settings.js';
import { soundGroup } from '../src/game/audio.js';
import { coachLinks } from '../src/sim/coaches.js';
import { GroundFx } from '../src/render/groundfx.js';
import { topicsFor, TOPIC_CATS, remembers } from '../src/game/dialogue.js';
import { STEPS } from '../src/game/migrate.js';
import { GAME_VERSION, compareVersions } from '../src/version.js';

const mem = () => {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) };
};

test('keys rebound: the action moves, its old key is freed, a taken key swaps, and it is kept', () => {
  const st = mem();
  loadKeybinds(st);
  assert.equal(remapKey('KeyM'), 'KeyM');
  assert.ok(bind('map', 'KeyN', st));
  assert.equal(keyOf('map'), 'KeyN');
  assert.equal(remapKey('KeyN'), 'KeyM', 'N now opens the map');
  assert.ok(remapKey('KeyM') !== 'KeyM', 'M no longer does');
  // (Onto a key another action has: they swap.)
  assert.ok(bind('map', 'KeyC', st));
  assert.equal(keyOf('craft'), 'KeyN');
  assert.ok(!bind('map', 'Escape', st), 'Escape stays Escape');
  loadKeybinds(st);
  assert.equal(keyOf('map'), 'KeyC', 'kept between games');
  resetKeybinds(st);
  assert.equal(keyOf('map'), 'KeyM');
  assert.ok(ACTIONS.length > 30);
});

test('settings in tabs: every setting on one, and sounds by kind', () => {
  for (const r of SETTING_ROWS) {
    assert.ok(SETTING_TABS.includes(r.tab), r.key);
    assert.ok(r.key in DEFAULTS, r.key);
  }
  for (const t of ['General', 'Visuals', 'Sound', 'Multiplayer']) assert.ok(SETTING_ROWS.some((r) => r.tab === t), t);
  assert.equal(soundGroup('select'), 'ui');
  assert.equal(soundGroup('step_stone'), 'blocks');
  assert.equal(soundGroup('roar', { isBoss: true }), 'bosses');
  assert.equal(soundGroup('swing'), 'items');
});

test('towns are laid out a little each frame in the background, never all at once', () => {
  const game = makeGame(4242, { wg: 6 });
  game.instantWork = false;
  const input = stubInput();
  const W = game.world;
  const sync = [];
  const lay = W.layOut.bind(W);
  W.layOut = (s, ms = Infinity) => {
    if (ms === Infinity && !W.layouts.has(s.id)) sync.push(s.name);
    return lay(s, ms);
  };
  // (Asked for, not yet laid out: queued, null for now.)
  const s = W.ow.settlements.find((q) => !W.layouts.has(q.id));
  assert.equal(game.sim.laidOut(s.id), null);
  for (let i = 0; i < 600 && !W.layouts.has(s.id); i++) game.update(1 / 20, input);
  assert.ok(W.layouts.has(s.id), 'laid out soon after');
  assert.deepEqual(sync, [], 'none laid out all at once');
});

test('upstairs: beds slept in, a trade over a shop, rooms over the tavern; and the coach', () => {
  const game = makeGame(4242, { wg: 6 });
  const W = game.world;
  let upBeds = 0;
  let stacked = 0;
  let lodging = 0;
  for (const s of W.ow.settlements.slice(0, 30)) {
    const L = W.layouts.get(s.id) || W.layOut(s);
    for (const b of L.buildings) {
      upBeds += b.beds.filter((q) => q.up && q.y > 6).length;
      if (b.upperOf !== undefined && !b.vacant) {
        stacked++;
        assert.ok(b.work.every((w) => w.y > 6), 'its work is upstairs');
      }
      if (b.lodging) lodging += b.lodging.length;
    }
  }
  assert.ok(upBeds > 20, `${upBeds} beds upstairs`);
  assert.ok(stacked > 0, 'a trade upstairs');
  assert.ok(lodging > 0, 'rooms over a tavern');
  const input = stubInput();
  for (let i = 0; i < 5; i++) game.update(0.1, input);
  const here = W.ow.settlementAt(game.player.x, game.player.z);
  const links = coachLinks(game, here);
  assert.ok(links.length, 'somewhere to go by coach');
  game.player.give('coin', 200);
  game.journey(links[0]);
  // (Round 78: ridden the whole way, hurried on.)
  game.handleKeys([{ code: 'KeyT', raw: 'KeyT' }], 0);
  for (let i = 0; i < 4000 && (game.skipping || game.player._ride); i++) game.update(0.05, input);
  assert.equal(W.ow.settlementAt(game.player.x, game.player.z)?.id, links[0].s.id, 'set down there');
});

test('swimming across water two deep (not deeper), on foot', () => {
  const game = makeGame(12345);
  const w = game.world;
  const p = game.player;
  const x = p.x + 3;
  const z = p.z;
  const y = p.y;
  // A channel two deep beside a bank, a bed under it.
  w.setBlock(x, y - 3, z, B.stone);
  w.setBlock(x, y - 2, z, B.water);
  w.setBlock(x, y - 1, z, B.water);
  w.setBlock(x, y, z, B.air);
  w.setBlock(x, y + 1, z, B.air);
  assert.ok(w.canSwim(x, y - 1, z));
  assert.equal(w.stepTarget(x - 1, y, z, x, z, false, false), -1, 'no walking in');
  assert.equal(w.stepTarget(x - 1, y, z, x, z, false, true), y - 1, 'swimming in');
  w.setBlock(x, y - 3, z, B.water);
  assert.ok(!w.canSwim(x, y - 1, z), 'deeper: no');
});

test('snow lies, is trodden and shovelled; rain rings the water', () => {
  const game = makeGame(12345);
  const input = stubInput();
  for (let i = 0; i < 3; i++) game.update(0.1, input);
  const r = { emit() {}, particleK: 1, toView: (x, z) => [x, z] };
  const fx = new GroundFx(r);
  game.weather = { kind: 'snow', level: 1, t: 99 };
  for (let i = 0; i < 200; i++) fx.tick(game, 0.5);
  const p = game.player;
  assert.ok(fx.depth(p.x, p.z) > 1, 'a layer lying');
  assert.ok(fx.clear(p.x, p.z, 1));
  assert.equal(fx.depth(p.x, p.z), 0);
  game.weather = { kind: 'clear', level: 0, t: 99 };
  for (let i = 0; i < 2000; i++) fx.tick(game, 0.5);
  assert.equal(fx.snow.size, 0, 'melted');
  fx.ripple(p.x, p.y, p.z, false);
  assert.equal(fx.ripples.size, 1);
});

test('dialogue in kinds; folk remember what you did', () => {
  const game = makeGame(12345);
  const input = stubInput();
  for (let i = 0; i < 20; i++) game.update(0.1, input);
  const n = game.npcs.find((q) => q.rec && q.rec.age === 'adult' && !q.visit);
  const ts = topicsFor(n, game);
  const cats = new Set(TOPIC_CATS.map((c) => c.id));
  for (const t of ts) assert.ok(cats.has(t.cat) || t.cat === 'bye', `${t.id}: ${t.cat}`);
  assert.ok(ts.some((t) => t.id === 'bye'));
  game.sim.giveGift(n, 'bread');
  game.sim.changeRep(n, 10, { why: 'gift', item: 'bread' });
  const m = remembers(n, game);
  assert.ok(m && m.why === 'gift');
});

test('the migration step and the version', () => {
  assert.ok(compareVersions(GAME_VERSION, '0.77.0') >= 0);
  const s = STEPS.find((q) => q.to === '0.77.0');
  assert.ok(s);
  const log = [];
  s.data({}, log);
  assert.ok(log.length);
  assert.ok(compareVersions('0.76.0', GAME_VERSION) < 0);
});
