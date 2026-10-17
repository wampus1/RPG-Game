// Round 119: who sees what. Nobody a storey above or below you sees you
// pick a lock (or anything else); no HUD on a guest's screen while their
// opening or a cutscene plays; and anyone up on a storey cut away over you
// (another player, the folk upstairs) isn't drawn standing on the air where
// its floor was, nor anyone a storey under the floor you're on. And the
// version's step.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { makeGame, stubInput } from './helpers.mjs';
import { B } from '../src/world/blocks.js';
import { GAME_VERSION, compareVersions } from '../src/version.js';
import { stepsFor } from '../src/game/migrate.js';

const src = (f) => fs.readFileSync(new URL(`../src/${f}`, import.meta.url), 'utf8');

test('nobody a storey above or below sees what you do; on the same floor, they do', () => {
  const game = makeGame(7);
  const input = stubInput();
  game.minute = 9 * 60;
  for (let i = 0; i < 20; i++) game.update(0.1, input);
  const [sid, a] = [...game.active][0];
  const w = game.world;
  const p = game.player;
  const n = a.npcs.find((q) => !q.sleeping && q.rec.age === 'adult' && q.rec.job !== 'guard');
  assert.ok(n, 'someone about');
  // An open floor two paces across, a ceiling (a floor above) between two
  // storeys, you on the lower and them right over you.
  const x = p.x;
  const z = p.z;
  const y = p.y;
  for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) {
    for (let yy = y; yy <= y + 6; yy++) w.setBlock(x + dx, yy, z + dz, B.air);
    w.setBlock(x + dx, y + 2, z + dz, B.planks);
  }
  n.sleeping = false;
  n.rec.away = false;
  n.teleport(x + 1, y + 3, z);
  n.face(x, z);
  assert.ok(!game.sim.witnesses(sid, x, z, 6, null, y).includes(n), 'the one upstairs sees nothing');
  // (Not given the height: yours, it's your doing, where you stand.)
  assert.ok(!game.sim.witnesses(sid, x, z, 6).includes(n), 'nor taken as yours');
  // Down on your floor, beside you: seen.
  n.teleport(x + 1, y, z);
  n.face(x, z);
  assert.ok(game.sim.witnesses(sid, x, z, 6, null, y).includes(n), 'on the same floor, seen');
  // (And the lock's watch goes by your height.)
  assert.ok(/witnesses\(owner\.sid, p\.x, p\.z, 6, null, p\.y\)/.test(src('game/game.js')));
});

test('no HUD on a guest\'s screen while their opening or a cutscene plays', () => {
  const u = src('ui/ui.js');
  assert.ok(/const cine = !!\(game && \(game\.cutscene \|\| \(game\.scene && game\.scene\.intro\)\)\);/.test(u));
  assert.ok(/if \(this\.showHud && !cine && game && game\.player\)/.test(u));
});

test('anyone on a storey cut away over you, or a storey under your floor, isn\'t drawn there', () => {
  const r = src('render/renderer.js');
  assert.ok(/if \(Math\.round\(e\.y\) >= level && this\.hidden\.has/.test(r), 'above the cut');
  assert.ok(/if \(below\(e\)\) continue;/.test(r), 'under your floor');
});

test('version 1.19.0, and the step to it', () => {
  assert.ok(compareVersions(GAME_VERSION, '1.19.0') >= 0);
  const steps = stepsFor('1.18.0').filter((s) => s.to === '1.19.0');
  assert.equal(steps.length, 1);
  const log = [];
  steps[0].data({}, log);
  assert.ok(/floor/i.test(log[0]) && /cutscene/i.test(log[0]));
});
