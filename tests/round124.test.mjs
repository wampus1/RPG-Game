// Round 124: the three newer origins' openings painted again, shot by shot
// (see render/art_leader.js, art_brigand.js, art_outworld.js); and an
// outworlder's mutations, each its own gift and its own cost now, none of
// them a trait the islands' folk have (see game/mutations.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { stubRenderer, stubUI } from './helpers.mjs';
import { Game } from '../src/game/game.js';
import { normalizeHero, randomHero, has, digMult, MUTATIONS } from '../src/game/hero.js';
import { mutIncoming, mutOutgoing, mutLastBlow, mutationTick, mutLight, FORESIGHT_EVERY, DRY_AFTER } from '../src/game/mutations.js';
import { introFrom } from '../src/game/intros.js';
import { GAME_VERSION, compareVersions } from '../src/version.js';
import { stepsFor } from '../src/game/migrate.js';

const begin = (hero, seed = 12345) => new Game({ seed, renderer: stubRenderer(), audio: null, ui: stubUI(), hero: { ...randomHero(seed), name: 'Anwen', ...hero }, intro: true });
const foe = { kind: 'monster', x: 0, z: 0 };

test('no mutation hands out a trait anyone else can have', () => {
  for (const k of Object.keys(MUTATIONS)) assert.ok(!MUTATIONS[k].grants, k);
  const h = normalizeHero({ origin: 'outworlder', mutations: ['glow', 'antennae', 'twin_hearts'] });
  for (const t of ['night_eyes', 'notorious', 'tracker', 'seasick', 'tireless', 'squeamish', 'tough', 'duelist']) assert.ok(!has(h, t), t);
  // (Shown on the body, and a hat taken off for the antennae.)
  assert.deepEqual(h.look.mut, ['glow', 'antennae', 'twin_hearts']);
  assert.equal(h.look.hat, null);
  const g = normalizeHero({ origin: 'outworlder', mutations: ['chitin'] });
  assert.deepEqual(g.look.mut, ['chitin']);
});

test('chitin and the third eye: blows land lighter; one foreseen now and then', () => {
  const game = begin({ origin: 'outworlder', mutations: ['chitin', 'third_eye'] });
  const p = game.player;
  // Chitin: a point off every blow (never below 1); the third eye halves
  // the first, then not again till it's seen another coming.
  assert.equal(mutIncoming(game, p, foe, 11), 5);
  assert.equal(mutIncoming(game, p, foe, 11), 10);
  assert.equal(mutIncoming(game, p, foe, 1), 1);
  mutationTick(game, p, FORESIGHT_EVERY + 0.1);
  assert.equal(mutIncoming(game, p, foe, 11), 5);
  // In full daylight, outdoors, your own blows are softer for it.
  game.minute = 12 * 60;
  assert.equal(mutOutgoing(game, p, 20), 17);
  game.minute = 22 * 60;
  assert.equal(mutOutgoing(game, p, 20), 20);
});

test('a dense frame and twin hearts; gills drying out; a light of your own', () => {
  const game = begin({ origin: 'outworlder', mutations: ['dense', 'twin_hearts', 'gills'] });
  const p = game.player;
  const h = game.hero;
  game.minute = 22 * 60;
  assert.equal(mutOutgoing(game, p, 10), 12, 'blows harder');
  assert.ok(digMult(h) > digMult({ ...h, mutations: [] }), 'digs faster');
  // A killing blow, once a day: you stay on your feet.
  p.hp = 4;
  const k = mutLastBlow(game, p, 50);
  assert.ok(p.hp - k > 0);
  assert.equal(mutLastBlow(game, p, 50), 50, 'once a day');
  // Too long out of water, and you weaken.
  p.mut.dry = DRY_AFTER - 0.5;
  mutationTick(game, p, 1);
  assert.equal(mutOutgoing(game, p, 10), 11);
  assert.ok(game.ui.msgs.some((m) => /gills are drying/.test(m)));
  assert.equal(mutLight(h), null);
  assert.equal(mutLight(normalizeHero({ origin: 'outworlder', mutations: ['glow'] })), 5);
});

test('antennae: no helmet or hat goes on over them', () => {
  const game = begin({ origin: 'outworlder', mutations: ['antennae'] });
  const p = game.player;
  p.inv[0] = { item: 'iron_helmet', count: 1 };
  assert.equal(p.wear(0), null);
  assert.equal(p.equip.head || null, null);
  assert.ok(game.ui.msgs.some((m) => /antennae/.test(m)));
});

test('each opening, made again from what\'s told, runs its course to the dark', () => {
  for (const [origin, kind, extra] of [['leader', 'leader_intro', { lead: { scope: 'town', style: 'council' } }], ['brigand', 'brigand_intro', {}], ['outworlder', 'outworld_intro', { mutations: ['glow'] }]]) {
    const game = begin({ origin, ...extra });
    assert.equal(game.scene.kind, kind);
    const sc = introFrom(game, { kind, info: game.scene.info });
    assert.equal(sc.kind, kind);
    assert.ok(sc.dur > 30 && sc.words.length === 5);
    for (let t = 0; t < sc.dur; t += 0.5) {
      sc.t = t;
      sc.update(game, 0.5, []);
      assert.ok(typeof sc.mood === 'string');
    }
  }
});

test('version 1.24.0, and the step to it', () => {
  assert.ok(compareVersions(GAME_VERSION, '1.24.0') >= 0);
  const steps = stepsFor('1.23.0').filter((s) => s.to === '1.24.0');
  assert.equal(steps.length, 1);
  const log = [];
  steps[0].data({}, log);
  assert.ok(/mutation/i.test(log[0]));
});
