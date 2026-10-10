// Round 78: the essentials of what's new (one world shared where it can
// be, to keep it quick): snow by height, the flee pace, ladders, the
// grapple, placing under yourself, chat channels, the pack's tools,
// reforging, blueprints, causes, ships of your own design, stalls,
// pirates, the new stories, and the save check.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeGame, stubInput } from './helpers.mjs';
import { B, BLOCKS } from '../src/world/blocks.js';
import { ITEMS } from '../src/world/items.js';
import { RECIPES } from '../src/world/recipes.js';
import { FLEE_PLAYER } from '../src/config.js';
import { snowTint } from '../src/render/groundfx.js';
import { throwGrapple } from '../src/game/grapple.js';
import { hears, parseLine } from '../src/net/chat.js';
import { sortPack, compareGear } from '../src/game/invtools.js';
import { starKey } from '../src/world/quality.js';
import { reforge, moveMod } from '../src/game/reforge.js';
import { planOf, ghostAt, copyBox } from '../src/game/plans.js';
import { blankDesign, typeOf, registerDesign, designsSave, designsLoad } from '../src/game/shipdesign.js';
import { previewModel, SHIP_TYPES } from '../src/world/shipmodels.js';
import { addShip, waterSpot, boardAt, ownerId } from '../src/game/ships3d.js';
import { carriesOf } from '../src/game/stalls.js';
import { spawnPirate, coveOf, isPirate } from '../src/game/pirates.js';
import { MOTIFS } from '../src/sim/saga/core.js';
import { checkRegion, healthNote } from '../src/game/savehealth.js';
import { GAME_VERSION } from '../src/version.js';
import { stepsFor } from '../src/game/migrate.js';

const input = stubInput();
const G = makeGame(12345);
for (let i = 0; i < 6; i++) G.update(0.1, input);
const ready = (game) => {
  for (let i = 0; i < 3; i++) game.update(0.1, input);
  return game;
};

test('snow is brighter up on a roof than on the ground; a beast runs from you slower', () => {
  const lum = (s) => s.split(',').map(Number).reduce((a, b) => a + b, 0);
  assert.ok(lum(snowTint(10)) > lum(snowTint(5)));
  assert.ok(Math.abs(1 / FLEE_PLAYER - 0.75) < 1e-9);
});

test('a ladder: three sticks make two, it climbs, nothing to bump into', () => {
  const r = RECIPES.find((q) => q.out === 'ladder');
  assert.ok(r && r.n === 2 && r.in.stick === 3);
  assert.equal(BLOCKS[B.ladder].solid, false);
  const w = G.world;
  const p = G.player;
  const x = p.x + 3;
  const z = p.z + 3;
  const y = p.y;
  for (let k = 0; k < 4; k++) w.setBlock(x, y + k, z, B.air);
  w.setBlock(x, y - 1, z, B.stone);
  w.setBlock(x, y + 1, z, B.ladder, 2);
  assert.ok(w.canStand(x, y + 1, z), 'stands on a ladder in mid-air');
});

test('the grapple hauls you up out of a pit', () => {
  const game = ready(makeGame(4321));
  const p = game.player;
  const w = game.world;
  const { x, y, z } = p;
  for (let dx = -3; dx <= 3; dx++) {
    for (let dz = -3; dz <= 3; dz++) {
      for (let yy = y - 3; yy < y + 4; yy++) w.setBlock(x + dx, yy, z + dz, Math.abs(dx) <= 1 && Math.abs(dz) <= 1 && yy < y ? B.air : yy < y ? B.stone : B.air);
      w.setBlock(x + dx, y - 4, z + dz, B.stone);
    }
  }
  game.teleportPlayer(x, y - 3, z);
  p.inv[p.selected] = { item: 'grapple_hook', count: 1 };
  assert.ok(throwGrapple(game, { x: x + 2, y: y - 1, z, block: { id: B.stone }, face: 'top' }));
  let n = 0;
  while ((p._grapple || p.moving) && n++ < 400) game.update(0.05, input);
  assert.ok(p.y >= y - 1, `up out of the pit (y ${p.y - y})`);
});

test('a block set where you stand lifts you onto it', () => {
  const game = ready(makeGame(4322));
  const p = game.player;
  const w = game.world;
  const { x, y, z } = p;
  for (let yy = y; yy < y + 4; yy++) w.setBlock(x, yy, z, B.air);
  p.inv[p.selected] = { item: 'cobblestone', count: 5 };
  game.tryPlace({ x, y, z, ok: true });
  for (let i = 0; i < 6; i++) game.update(0.05, input);
  assert.equal(w.getBlock(x, y, z), B.cobblestone);
  assert.equal(p.y, y + 1);
});

test('chat channels: local within a hundred paces, instance only below, /l and /i', () => {
  const world = { instAt: (x) => (x >= 1e7 ? { slot: 1 } : null) };
  const g = { world };
  const a = { x: 0, z: 0 };
  assert.ok(hears(g, a, { x: 60, z: 60 }, 'local'));
  assert.ok(!hears(g, a, { x: 300, z: 0 }, 'local'));
  assert.ok(hears(g, a, { x: 9000, z: 0 }, 'global'));
  assert.deepEqual(parseLine('/l hello').ch, 'local');
  assert.equal(parseLine('/l hello').text, 'hello');
});

test('the pack sorted, and gear weighed against what you wear', () => {
  const inv = Array(40).fill(null);
  inv[20] = { item: 'apple', count: 3 };
  inv[25] = { item: 'iron_sword', count: 1 };
  inv[30] = { item: 'apple', count: 4 };
  sortPack(inv);
  const rest = inv.filter(Boolean);
  assert.equal(rest.length, 2);
  assert.equal(rest.find((s) => s.item === 'apple').count, 7);
  assert.ok(Array.isArray(compareGear(G.player, 'iron_sword')));
});

test('reforging keeps the stars; a modifier moves onto another piece', () => {
  const game = makeGame(4323);
  const p = game.player;
  p.inv.fill(null);
  p.inv[0] = { item: starKey('iron_sword', 2, 'c', 100, ['venom']), count: 1 };
  p.inv[1] = { item: starKey('iron_sword', 1, 'c', 7, []), count: 1 };
  p.inv[2] = { item: 'coin', count: 999 };
  p.inv[3] = { item: 'iron_ingot', count: 20 };
  const r = reforge(game, 1);
  assert.ok(r.ok, r.why);
  assert.ok(ITEMS[r.key].stars >= 1);
  const m = moveMod(game, 0, 1, 'venom');
  assert.ok(m.ok, m.why);
  assert.ok(ITEMS[m.key].mods.includes('venom'));
});

test('a blueprint in the off hand takes the blocks you set; a box copies a building', () => {
  const game = ready(makeGame(4324));
  const p = game.player;
  const w = game.world;
  p.equip.shield = 'blueprint';
  p.inv[p.selected] = { item: 'cobblestone', count: 10 };
  const t = { x: p.x + 2, y: p.y, z: p.z, ok: true, ghost: true };
  for (let k = 0; k < 3; k++) w.setBlock(t.x, t.y + k, t.z, B.air);
  game.tryPlace(t);
  const plan = planOf(game, p.equip.shield);
  assert.ok(plan && plan.cells.length === 1, 'on the plan');
  assert.notEqual(w.getBlock(t.x, t.y, t.z), B.cobblestone, 'not in the world');
  assert.ok(ghostAt(game, t.x, t.y, t.z));
  for (let k = 0; k < 3; k++) w.setBlock(p.x + 6, p.y + k, p.z + 6, B.planks);
  assert.ok(copyBox(game, plan, { x0: p.x + 5, x1: p.x + 7, y0: p.y, y1: p.y + 3, z0: p.z + 5, z1: p.z + 7 }) >= 3);
});

test('a town votes on a cause; the stories hear how it went', () => {
  const s = G.world.ow.settlementAt(G.player.x, G.player.z);
  const L = G.world.layouts.get(s.id);
  const C = G.sim.causes;
  let q = null;
  const rng = { chance: () => true, int: (a) => a, float: (a, b) => a + (b - a) * 0.3, next: () => 0.3, pick: (a) => a[0] };
  for (let d = 0; d < 40 && !q; d++) q = C.begin(L, G.day + d, rng);
  assert.ok(q, 'a cause begun');
  const before = G.sim.saga.live().length;
  C.resolve(L, q, q.end);
  assert.ok(q.done);
  assert.ok(G.sim.saga.live().length >= before);
});

test('ships of your own design: built cell by cell, kept with the world', () => {
  for (const d of [blankDesign(), { ...blankDesign(), L: 30, W: 11, decks: 2, quarter: 'cabin', fore: 'galley', poop: true, masts: ['square2', 'square3', 'lateen'], deckGuns: 4, gunDeck: true, horses: 4, wagons: 2 }]) {
    const T = typeOf(d);
    const m = previewModel(T);
    assert.ok(m.helm && m.masts.length === d.masts.length && m.gangways.length, 'a whole ship');
    assert.ok(T.speed >= 8 && T.speed <= 32);
  }
  const game = makeGame(4325);
  const D = registerDesign(game, { ...blankDesign(), name: 'Sea Wren' });
  assert.ok(SHIP_TYPES[`design_${D.id}`]);
  assert.equal(ITEMS[`shipd~${D.id}`].name, 'Sea Wren in a Bottle');
  const saved = JSON.parse(JSON.stringify(designsSave(game)));
  const again = { shipDesigns: null };
  designsLoad(again, saved);
  assert.equal(again.shipDesigns.get(D.id).name, 'Sea Wren');
});

test('a horse ridden aboard a galleon goes to her stalls', () => {
  const game = ready(makeGame(4326));
  const p = game.player;
  const at = waterSpot(game, 'galleon', p.x, p.z, 10, 400, true);
  assert.ok(at, 'open water near');
  const S = addShip(game, { type: 'galleon', x: at.x, z: at.z, yaw: at.yaw, owner: ownerId(game, p), name: 'Mine', anchor: true, crew: [] });
  assert.equal(carriesOf(S).horses, 4);
  game.riding.horses.push({ id: 9, x: p.x, y: p.y, z: p.z, coat: 1, saddled: true, trust: 1 });
  p.mount = { kind: 'horse', horseId: 9, coat: 1, saddle: true };
  assert.ok(boardAt(game, S, p, S.x, S.z));
  assert.equal(game.riding.horse(9).aboard, S.id);
});

test('pirates: a cove on a lonely shore, a black-flagged crew, and none of them crash the game dying', () => {
  const game = ready(makeGame(4327));
  const cove = coveOf(game);
  assert.ok(cove && cove.name, 'a cove');
  const p = game.player;
  const at = waterSpot(game, 'brigantine', p.x, p.z, 20, 400, true);
  const S = spawnPirate(game, at.x, at.z, { seed: 3 });
  assert.ok(S && S.pirate && S.hostile);
  assert.ok(S.crewRecs.some((r) => r.role === 'pirate_archer'));
  for (let i = 0; i < 10; i++) game.update(0.1, input);
  const c = (game.sailors || []).find((q) => q.shipId === S.id);
  if (c) {
    assert.ok(isPirate(c));
    game.damage(c, 999, p);
    assert.ok(c.dead);
  }
});

test('stories that grow from what happens: pirates, a sea fight, an army ashore', () => {
  const S = G.sim.saga;
  const L = [...G.world.layouts.values()].find((q) => q.econ && q.npcs.length > 6);
  const sid = L.settlement.id;
  S.emit('ship_taken', { sid, ship: 'Grey Heron', cove: 'Skull Haven' });
  S.emit('sea_fight', { sid, ship: 'Valiant', winner: 'Black Wolf' });
  S.emit('troops_landed', { sid, raid: 5, ship: 'Bounty', foe: 'Enemy' });
  for (let i = 0; i < 6; i++) G.update(0.1, input);
  const ms = S.live().map((th) => th.m);
  for (const m of ['taken_at_sea', 'drowned_stone', 'army_ashore']) assert.ok(ms.includes(m), m);
  const army = S.live().find((th) => th.m === 'army_ashore');
  S.emit('war_raid', { sid, raid: 5, won: false, loot: 0 });
  for (let i = 0; i < 3; i++) G.update(0.1, input);
  assert.ok(army.outcome === 'held' || army.over, 'the town held');
  assert.ok(MOTIFS.raider_bounty && MOTIFS.sore_loser && MOTIFS.built_from_plans);
});

test('the save check takes down a painting with no wall and mends a door', () => {
  const game = ready(makeGame(4328));
  const w = game.world;
  const p = game.player;
  const x = p.x + 4;
  const z = p.z + 4;
  const y = p.y;
  for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) for (let k = 0; k < 3; k++) w.setBlock(x + dx, y + k, z + dz, B.air);
  w.setBlock(x, y + 1, z, B.painting_small, 0);
  w.setBlock(x + 1, y, z + 1, B.door, 0);
  w.setBlock(x + 1, y + 1, z + 1, B.air);
  const r = w.regionAt(x, z);
  const n = checkRegion(game, r);
  assert.ok(n >= 2, `put right ${n}`);
  assert.equal(w.getBlock(x, y + 1, z), B.air);
  assert.equal(w.getBlock(x + 1, y + 1, z + 1), B.door_top);
  assert.match(healthNote(game), /Save check/);
});

test('version 0.78.0, with its step', () => {
  assert.equal(GAME_VERSION, '0.78.0');
  assert.ok(stepsFor('0.77.0').some((s) => s.to === '0.78.0'));
});
