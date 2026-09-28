import test from 'node:test';
import assert from 'node:assert/strict';
import { B, BLOCKS } from '../src/world/blocks.js';
import { makeGame, stubInput } from './helpers.mjs';

// A free, standable tile near the player (searching outward from dx, dz).
function nearGround(game, dx, dz) {
  const p = game.player;
  for (let r = 0; r < 6; r++) {
    for (let oz = -r; oz <= r; oz++) {
      for (let ox = -r; ox <= r; ox++) {
        const x = p.x + dx + ox;
        const z = p.z + dz + oz;
        const y = game.world.findStandY(x, z, p.y);
        if (y > 0 && (x !== p.x || z !== p.z) && !game.world.isWaterAt(x, y, z)) return { x, y, z };
      }
    }
  }
  throw new Error('no free tile');
}

test('player can walk tile by tile and bump doors open', () => {
  const game = makeGame(12345);
  const w = game.world;
  const p = game.player;
  let door = null;
  for (let r = 1; r < 25 && !door; r++) {
    for (let dz = -r; dz <= r && !door; dz++) {
      for (let dx = -r; dx <= r; dx++) {
        const x = p.x + dx;
        const z = p.z + dz;
        if (w.getBlock(x, 6, z) === B.door && (w.getMeta(x, 6, z) & 3) === 0 && w.canStand(x, 6, z + 1) && w.canStand(x, 6, z + 2)) {
          door = { x, z };
          break;
        }
      }
    }
  }
  assert.ok(door, 'a south-facing door near spawn');
  p.teleport(door.x, 6, door.z + 2);
  const input = stubInput();
  input.lastMoveKey = 'KeyW';
  input.isDown = (k) => k === 'KeyW';
  for (let i = 0; i < 60; i++) game.update(0.05, input);
  assert.ok(p.z < door.z, 'walked through the door');
});

test('placing, rotating, mining and dropping blocks', () => {
  const game = makeGame(12345);
  const p = game.player;
  const w = game.world;
  // Place a chest facing east.
  p.inv[0] = { item: 'chest', count: 2 };
  p.selected = 0;
  p.rot = 3;
  const t = nearGround(game, -2, 0);
  assert.ok(game.canPlace(B.chest, t.x, t.y, t.z));
  game.tryPlace({ ...t, ok: true });
  assert.equal(w.getBlock(t.x, t.y, t.z), B.chest);
  assert.equal(w.getMeta(t.x, t.y, t.z) & 3, 3);
  assert.equal(p.inv[0].count, 1);
  // Player-placed containers start empty.
  assert.ok(w.getContainer(t.x, t.y, t.z).every((s) => s === null));
  // Mining it drops a chest item that the player can pick up.
  game.breakBlock(t.x, t.y, t.z, true);
  assert.equal(w.getBlock(t.x, t.y, t.z), B.air);
  assert.ok(game.drops.some((d) => d.item === 'chest'));
  const input = stubInput();
  p.teleport(t.x, t.y, t.z);
  for (let i = 0; i < 40; i++) game.update(0.05, input);
  assert.equal(p.inv[0].count, 2, 'picked the chest back up');
});

test('breakTime depends on the tool', () => {
  const game = makeGame(12345);
  const p = game.player;
  const stone = BLOCKS[B.stone];
  p.inv[0] = null;
  p.selected = 0;
  const hand = game.breakTime(stone);
  p.inv[0] = { item: 'stone_pickaxe', count: 1 };
  const pick = game.breakTime(stone);
  assert.ok(pick < hand / 4, `pickaxe ${pick} vs hand ${hand}`);
  assert.equal(game.breakTime(BLOCKS[B.bedrock]), Infinity);
});

test('felling a tree drops its logs', () => {
  const game = makeGame(4242);
  const w = game.world;
  // Find a natural tree trunk in the loaded regions.
  let trunk = null;
  for (const r of w.regions.values()) {
    for (let i = 0; i < r.blocks.length && !trunk; i++) {
      const id = r.blocks[i];
      if (id !== B.log_oak) continue;
      const y = i % 16;
      const col = Math.floor(i / 16);
      const x = r.x0 + (col % 64);
      const z = r.z0 + Math.floor(col / 64);
      if (w.getBlock(x, y - 1, z) !== B.log_oak && game.isTreeLog(x, y, z)) trunk = { x, y, z };
    }
    if (trunk) break;
  }
  assert.ok(trunk, 'found an oak');
  game.breakBlock(trunk.x, trunk.y, trunk.z, true);
  assert.equal(w.getBlock(trunk.x, trunk.y + 1, trunk.z), B.air, 'upper trunk fell too');
  const logs = game.drops.filter((d) => d.item === 'log_oak').reduce((n, d) => n + d.count, 0);
  assert.ok(logs >= 2, `logs dropped: ${logs}`);
});

test('tossing items and sleeping through the night', () => {
  const game = makeGame(12345);
  const p = game.player;
  p.inv[0] = { item: 'torch', count: 5 };
  p.selected = 0;
  game.toss(false);
  assert.equal(p.inv[0].count, 4);
  assert.equal(game.drops.length, 1);
  game.toss(true);
  assert.equal(p.inv[0], null);
  game.minute = 22 * 60;
  game.trySleep(p.x, p.y, p.z);
  assert.ok(game.sleep && p.sleeping, 'lying down');
  const input = stubInput();
  let guard = 0;
  let fast = 0;
  while (game.sleep && guard++ < 5000) {
    game.update(0.05, input);
    fast = Math.max(fast, game.sleepFast || 0);
  }
  assert.ok(fast >= 30, 'time sped up while asleep');
  assert.ok(!game.sleep && !game.sleepFast && !p.sleeping, 'woke up');
  assert.equal(p.hp, p.maxHp);
  assert.ok(game.minute >= 6 * 60 && game.minute < 8 * 60, `woke at ${game.minute}`);
  assert.equal(game.day, 2);
});

test('save data round-trips player and world edits', () => {
  const game = makeGame(12345);
  const p = game.player;
  const t = nearGround(game, 2, 1);
  game.world.setBlock(t.x, t.y, t.z, B.glass);
  p.inv[3] = { item: 'gem', count: 3 };
  const data = JSON.parse(JSON.stringify(game.serialize()));
  const Game = game.constructor;
  const g2 = new Game({ seed: data.seed, renderer: game.renderer, audio: null, ui: game.ui, save: data });
  assert.equal(g2.world.getBlock(t.x, t.y, t.z), B.glass);
  assert.deepEqual(g2.player.inv[3], { item: 'gem', count: 3 });
  assert.equal(g2.player.x, p.x);
});
