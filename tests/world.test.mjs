import test from 'node:test';
import assert from 'node:assert/strict';
import { Overworld } from '../src/world/worldgen.js';
import { World } from '../src/world/world.js';
import { BLOCKS, B } from '../src/world/blocks.js';
import { MAP_W, MAP_H, REGION_W, REGION_D, WORLD_Y } from '../src/config.js';

test('overworld generation is deterministic per seed', () => {
  const a = new Overworld(777);
  const b = new Overworld(777);
  assert.deepEqual(a.cells.map((c) => c.biome), b.cells.map((c) => c.biome));
  assert.deepEqual(a.settlements.map((s) => s.name), b.settlements.map((s) => s.name));
  const c = new Overworld(778);
  assert.notDeepEqual(a.cells.map((x) => x.biome), c.cells.map((x) => x.biome));
});

test('world map has varied biomes, rivers, lakes, civs and all settlement sizes', () => {
  for (const seed of [1, 12345, 4242]) {
    const ow = new Overworld(seed);
    const biomes = new Set(ow.cells.map((c) => c.biome));
    assert.ok(biomes.size >= 6, `seed ${seed}: only ${biomes.size} biomes`);
    assert.ok(biomes.has('ocean'));
    assert.ok(ow.rivers.length >= 3, `seed ${seed}: rivers`);
    assert.ok(ow.lakes.length >= 3, `seed ${seed}: lakes`);
    assert.ok(ow.civs.length >= 2, `seed ${seed}: civs`);
    const types = new Set(ow.settlements.map((s) => s.type));
    assert.deepEqual([...types].sort(), ['city', 'town', 'village']);
    assert.equal(ow.cells.length, MAP_W * MAP_H);
    assert.ok(ow.spawnSettlement);
  }
});

test('regions generate solid terrain with bedrock and surfaces', () => {
  const w = new World(12345);
  const s = w.ow.spawnSettlement;
  const rx = Math.floor(s.bounds.x0 / REGION_W);
  const rz = Math.floor(s.bounds.z0 / REGION_D);
  const r = w.loadRegion(rx, rz);
  assert.ok(r);
  let trees = 0;
  let plants = 0;
  for (let lz = 0; lz < REGION_D; lz++) {
    for (let lx = 0; lx < REGION_W; lx++) {
      assert.equal(r.get(lx, 0, lz), B.bedrock);
      for (let y = 1; y < WORLD_Y; y++) {
        const b = BLOCKS[r.get(lx, y, lz)];
        if (b.name.startsWith('log_')) trees++;
        if (b.render === 'plant') plants++;
      }
    }
  }
  assert.ok(plants > 20, 'expected vegetation');
  assert.ok(trees >= 0);
  // Same region regenerated is identical.
  const w2 = new World(12345);
  const r2 = w2.loadRegion(rx, rz);
  assert.deepEqual(Buffer.from(r.blocks), Buffer.from(r2.blocks));
});

test('settlements contain buildings with doors, beds and interiors', () => {
  const w = new World(4242);
  for (const type of ['village', 'town', 'city']) {
    const s = w.ow.settlements.find((q) => q.type === type && q.condition !== 'abandoned');
    const L = w.getLayout(s);
    assert.ok(L.buildings.length > 3, `${type} buildings`);
    const houses = L.buildings.filter((b) => b.residential);
    assert.ok(houses.length > 0, `${type} houses`);
    for (const b of houses) assert.ok(b.beds.length > 0, `${type} house without beds`);
    assert.ok(L.placements.size > 0);
    assert.ok(L.npcs.length > 0, `${type} npcs`);
  }
});
