// The quick set (round 78): the game's essentials, each looked at once, in
// worlds shared between the checks so the whole lot runs in well under a
// minute. (Every round's own tests are still there, and slower: `npm run
// test:full`.) Run with `npm test`, alongside the latest round's tests.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeGame, stubInput, stubUI, stubRenderer } from '../helpers.mjs';
import { Game } from '../../src/game/game.js';
import { Creature } from '../../src/entities/creature.js';
import { B } from '../../src/world/blocks.js';
import { RECIPES, recipesFor } from '../../src/world/recipes.js';
import { ITEMS } from '../../src/world/items.js';
import { kindsOf } from '../../src/game/inventory.js';
import { topicsFor, respond } from '../../src/game/dialogue.js';
import { migrateSave } from '../../src/game/migrate.js';
import { GAME_VERSION } from '../../src/version.js';
import { HostNet } from '../../src/net/host.js';
import { GuestNet } from '../../src/net/guest.js';
import { SHIP_KINDS, shipModel } from '../../src/world/shipmodels.js';
import { addShip, waterSpot } from '../../src/game/ships3d.js';

const input = stubInput();
const G = makeGame(12345);
G.minute = 12 * 60;
for (let i = 0; i < 20; i++) G.update(0.1, input);

// A free, standable tile near the player.
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

test('the world: the same from the same seed; ground with bedrock; towns with people', () => {
  const again = makeGame(12345);
  assert.equal(again.world.ow.settlements.length, G.world.ow.settlements.length);
  assert.equal(again.world.ow.settlements[0].name, G.world.ow.settlements[0].name);
  const p = G.player;
  const r = G.world.regionAt(p.x, p.z);
  assert.ok(r, 'the ground under you');
  assert.equal(G.world.getBlock(p.x, 0, p.z), B.bedrock);
  const [, a] = [...G.active][0];
  assert.ok(a.npcs.length > 3, 'folk in the nearest town');
});

test('walking: a step at a time', () => {
  const game = makeGame(12345);
  const p = game.player;
  const w = game.world;
  for (let dx = 0; dx < 6; dx++) {
    w.setBlock(p.x + dx, p.y - 1, p.z, B.stone);
    for (let k = 0; k < 3; k++) w.setBlock(p.x + dx, p.y + k, p.z, B.air);
  }
  const x0 = p.x;
  const inp = stubInput();
  inp.lastMoveKey = 'KeyD';
  inp.isDown = (k) => k === 'KeyD';
  for (let i = 0; i < 30; i++) game.update(0.05, inp);
  assert.ok(p.x > x0, 'moved east');
});

test('blocks: set, mined, dropped, picked up', () => {
  const p = G.player;
  const w = G.world;
  p.inv[0] = { item: 'chest', count: 2 };
  p.selected = 0;
  const t = nearGround(G, -2, 0);
  G.tryPlace({ ...t, ok: true });
  assert.equal(w.getBlock(t.x, t.y, t.z), B.chest);
  G.breakBlock(t.x, t.y, t.z, true);
  assert.equal(w.getBlock(t.x, t.y, t.z), B.air);
  p.teleport(t.x, t.y, t.z);
  for (let i = 0; i < 40; i++) G.update(0.05, input);
  assert.equal(p.inv[0].count, 2, 'picked back up');
});

test('crafting: every recipe makes and takes real things', () => {
  for (const r of RECIPES) {
    assert.ok(ITEMS[r.out], `makes ${r.out}`);
    for (const k of Object.keys(r.in)) assert.ok(kindsOf(k).some((q) => ITEMS[q]), `${r.out} takes ${k}`);
  }
  assert.ok(recipesFor('workbench').length > 20);
});

test('a fight: a beast struck down drops something', () => {
  const p = G.player;
  const t = nearGround(G, 3, 3);
  const c = new Creature(G, 'chicken', t.x, t.y, t.z);
  G.addCreature(c);
  const before = G.drops.length;
  G.damage(c, 999, p);
  assert.ok(c.dead);
  assert.ok(G.drops.length > before);
});

test('talking: a townsperson has topics, and answers', () => {
  const [, a] = [...G.active][0];
  const n = a.npcs.find((q) => !q.dead && q.rec.age === 'adult' && q.rec.job !== 'guard');
  const ids = topicsFor(n, G).map((t) => t.id);
  for (const id of ['ask', 'gift', 'bye']) assert.ok(ids.includes(id), id);
  const r = respond(n, G, 'who');
  assert.ok(r.lines.length && r.lines[0].length);
});

test('a day goes by in town without a hitch', () => {
  const day = G.day;
  G.skipDays(1);
  let k = 0;
  while (G.skipping && k++ < 4000) G.update(0.1, input);
  assert.equal(G.day, day + 1);
});

test('a save: written, read back the same, and an old one brought up to date', () => {
  const p = G.player;
  const t = nearGround(G, 2, 1);
  G.world.setBlock(t.x, t.y, t.z, B.glass);
  p.inv[3] = { item: 'gem', count: 3 };
  const data = JSON.parse(JSON.stringify(G.serialize()));
  const g2 = new Game({ seed: data.seed, renderer: stubRenderer(), audio: null, ui: stubUI(), save: data });
  assert.equal(g2.world.getBlock(t.x, t.y, t.z), B.glass);
  assert.deepEqual(g2.player.inv[3], { item: 'gem', count: 3 });
  const old = { ...data, gv: '0.60.0' };
  const m = migrateSave(old);
  assert.equal(old.gv, GAME_VERSION);
  assert.ok(m.log.length > 0);
});

test('ships: every kind built whole, one launched and sailing', () => {
  for (const k of SHIP_KINDS) {
    const m = shipModel(k);
    assert.ok(m.helm && m.masts.length && m.guns.length, k);
  }
  const p = G.player;
  const at = waterSpot(G, 'sloop', p.x, p.z, 10, 400, true);
  assert.ok(at);
  const S = addShip(G, { type: 'sloop', x: at.x, z: at.z, yaw: at.yaw, name: 'Quick', anchor: false, crew: [] });
  S.sailGoal = 1;
  for (let i = 0; i < 20; i++) G.update(0.1, input);
  assert.ok(Number.isFinite(S.x) && Number.isFinite(S.v));
});

test('playing together: a player joins, sees the same world, walks', () => {
  const game = makeGame(12345);
  game.minute = 10 * 60;
  for (let i = 0; i < 10; i++) game.update(0.1, input);
  const queue = [];
  const flush = () => {
    while (queue.length) queue.shift()();
  };
  const ui = () => Object.assign(stubUI(), { windows: [], update() {}, find: () => null, closeAll() {} });
  let gg = null;
  let guestNet = null;
  const hostNet = new HostNet(game, {
    send: (text) => {
      if (text[0] === '@') queue.push(() => guestNet.receive(text.slice(text.indexOf('|') + 1)));
    },
    profile: { id: 'h', name: 'Hosty' },
    world: { name: 'Testland' },
    makeUI: ui,
  });
  guestNet = new GuestNet({
    send: (text) => queue.push(() => hostNet.receive(`@7|${text}`)),
    profile: { id: 'g', name: 'Guesty' },
    build: (save) => (gg = new Game({ seed: save.seed, renderer: stubRenderer(), audio: null, ui: ui(), save, remote: true })),
    onNeedHero: () => guestNet.sendHero(null),
    onEnd: () => {},
  });
  const gin = stubInput();
  gin.keys = new Set();
  gin.isDown = (k) => gin.keys.has(k);
  const step = (n) => {
    for (let i = 0; i < n; i++) {
      game.update(0.05, input);
      flush();
      if (gg) gg.update(0.05, gin);
      flush();
    }
  };
  hostNet.receive('!' + JSON.stringify({ t: 'join', cid: 7, account: { id: 'g', name: 'Guesty' } }));
  flush();
  step(5);
  assert.ok(gg, 'the player\'s copy of the world');
  assert.equal(game.seats.length, 2);
  const gp = game.seats[1].ent;
  gin.keys.add('KeyD');
  step(20);
  gin.keys.clear();
  step(5);
  assert.deepEqual([gg.player.x, gg.player.z], [gp.x, gp.z]);
});
