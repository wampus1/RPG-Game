// Round 143: the town's map (the world map's Civilization tab) in more
// detail, and drawn the world map's way: what's on top of each tile (a
// roof, a tree, a crop, a lantern, the paving) in its own colour, lit by
// its height; far out a pixel a tile, closer a little stamp, closest a
// glyph on its ground; the unknown as the world map's.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGame, stubInput } from './helpers.mjs';
import { B } from '../src/world/blocks.js';
import { planOf, planWire, planFromWire } from '../src/game/townmap.js';
import { lookOf, paintTile } from '../src/ui/townlook.js';
import { MapWindow } from '../src/ui/worldmap.js';
import { M } from '../src/world/settlement.js';
import { GAME_VERSION, compareVersions } from '../src/version.js';
import { stepsFor } from '../src/game/migrate.js';

const input = stubInput();
function town(seed = 12345) {
  const game = makeGame(seed);
  for (let i = 0; i < 20; i++) game.update(0.1, input);
  const [, a] = [...game.active][0];
  return { game, L: a.layout };
}

test('a town\'s plan knows what\'s on top of every tile, and how high it stands', () => {
  const { L } = town();
  const P = planOf(L);
  assert.equal(P.top.length, L.W * L.D);
  assert.ok(P.top.every((id) => id > 0), 'something on every tile');
  // Over its buildings, roofs (or flat roofs) standing high; on its
  // streets, the paving low.
  let roofs = 0;
  let over = 0;
  let streetHt = 0;
  let streets = 0;
  for (let i = 0; i < P.top.length; i++) {
    if (L.mask[i] === M.BUILD) {
      over++;
      if (lookOf(P.top[i], P.ht[i] >= 2, true).kind === 'roof') roofs++;
    } else if (L.mask[i] === M.ROAD) {
      streets++;
      streetHt += P.ht[i];
    }
  }
  assert.ok(roofs / over > 0.7, `${roofs} of ${over} building tiles roofed`);
  assert.ok(streets && streetHt / streets < 1.5, 'the streets lie low');
  // (And what else the town put there: its lanterns, its trees or flowers.)
  const kinds = new Set([...P.top].map((id, i) => lookOf(id, P.ht[i] >= 2, L.mask[i] === M.BUILD).kind));
  for (const k of ['roof', 'pave', 'ground']) assert.ok(kinds.has(k), k);
  assert.ok(kinds.size >= 7, `${[...kinds]}`);
  // Over the wire to a player, the same; an older host's plan still reads.
  const w = planFromWire(JSON.parse(JSON.stringify(planWire(L))));
  assert.deepEqual(Array.from(w.top), Array.from(P.top));
  assert.deepEqual(Array.from(w.ht), Array.from(P.ht));
  const old = planFromWire({ ...JSON.parse(JSON.stringify(planWire(L))), top: undefined, ht: undefined });
  assert.ok(old && old.top === null && old.mask.length === L.W * L.D);
});

test('each thing seen from above has its look: by the words of its name, not a part of one', () => {
  const kind = (name, raised = false, roofed = false) => lookOf(B[name], raised, roofed).kind;
  assert.equal(kind('roof_red'), 'roof');
  assert.equal(kind('thatch'), 'roof');
  assert.equal(kind('leaves_oak'), 'tree');
  assert.equal(lookOf(B.leaves_pine).ch, '♠');
  assert.equal(kind('water'), 'water');
  assert.equal(kind('lantern'), 'light');
  assert.equal(kind('wheat_crop'), 'crop');
  assert.equal(kind('flower_red'), 'flower');
  assert.equal(kind('fence'), 'fence');
  assert.equal(kind('gravestone'), 'grave');
  // (Flagstone isn't a flag, nor gravel a grave, nor cracked bricks a rack.)
  assert.equal(kind('flagstone'), 'pave');
  assert.equal(kind('gravel'), 'pave');
  assert.equal(kind('cobblestone'), 'pave');
  if (B.cracked_bricks) assert.notEqual(kind('cracked_bricks'), 'prop');
  // Masonry standing up is a wall; over a building, its roof.
  assert.equal(kind('stone_bricks', true), 'wall');
  assert.equal(kind('stone_bricks', true, true), 'roof');
  // The bare ground marked as the world map marks its lands.
  assert.equal(lookOf(B.grass).ch, '"');
  assert.equal(lookOf(B.sand).ch, '·');
  if (B.snow) assert.equal(lookOf(B.snow).ch, '*');
});

test('a tile drawn far out, close-ish and close in: a dot, a stamp, a glyph on its ground; the unknown dark', () => {
  const draw = (mode, k, L, fog = false) => {
    const px = new Uint32Array(k * k);
    paintTile(px, k, 0, 0, k, mode, L, 1, 3, 4, fog);
    return px;
  };
  const roof = lookOf(B.roof_red);
  const dots = draw('dots', 2, roof);
  assert.equal(new Set(dots).size, 1, 'one colour, far out');
  assert.ok(new Set(draw('tiles', 4, roof)).size >= 2, 'its rows of tiles, closer');
  const tree = lookOf(B.leaves_oak);
  const g = draw('glyphs', 8, tree);
  assert.ok(new Set(g).size >= 2, 'a ♣ on its ground, close in');
  const fog = draw('glyphs', 8, tree, true);
  assert.notDeepEqual(Array.from(fog), Array.from(g));
  // (Every pixel written.)
  for (const px of [dots, g, fog]) assert.ok(px.every((v) => v !== 0));
});

test('the town map zooms in steps from the whole town to a glyph a tile, never past what it can keep', () => {
  const { game, L } = town();
  const ui = { game, input: { isDown: () => false }, mouse: { x: 0, y: 0, down: false }, mouseCell: { x: -1, y: -1 }, audio: null, msg() {}, time: 0 };
  const w = new MapWindow(ui);
  game.currentSettlement = L.settlement;
  w.tab = 'civ';
  const P = planOf(L);
  const { steps, base } = w.townSteps(P);
  const a = w.area();
  assert.ok(steps[base] * P.W <= Math.max(P.W, a.x1 - a.x0) && steps[base] * P.D <= Math.max(P.D, a.y1 - a.y0), 'first, the whole town fits');
  for (const k of steps) assert.ok(P.W * P.D * k * k <= 4e6);
  const k0 = w.townScale(P);
  for (let i = 0; i < 20; i++) w.zoomTown(1);
  assert.equal(w.townScale(P), steps[steps.length - 1]);
  assert.ok(w.townScale(P) >= 8, 'close enough for glyphs');
  for (let i = 0; i < 20; i++) w.zoomTown(-1);
  assert.equal(w.townScale(P), steps[0]);
  assert.ok(k0 >= steps[0]);
});

test('version 1.43.0', () => {
  assert.ok(compareVersions('1.43.0', GAME_VERSION) <= 0);
  assert.ok(stepsFor('1.42.0').some((q) => q.to === '1.43.0'));
});
