// Round 117: no reaching through bars; a picture for everything; an old
// place's tier on the map, its way in grander for it, rebuilt stone by
// stone when a crystal turns it back (and nobody shut in by it); relic
// shards set at an anvil; what things do, said plainly; the picture never
// left turned or shifted by something gone wrong, nor a scene left holding
// you; the fairy ring letting you go; and the sound heard from where you
// are.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { makeGame, stubInput } from './helpers.mjs';
import { reachClear } from '../src/game/game.js';
import { B } from '../src/world/blocks.js';
import { ITEMS, SHARD_MAX, grownRelic } from '../src/world/items.js';
import { siteBlocks } from '../src/world/sites.js';
import { timeTurn } from '../src/game/timecrystal.js';
import { setShards, fitShard, relicReach } from '../src/game/relics.js';
import { cleanCtx } from '../src/render/renderer.js';
import { TIER_BADGE } from '../src/ui/worldmap.js';
import { DungeonRun } from '../src/game/dungeon.js';
import { FY } from '../src/world/dungeongen.js';
import { countItem } from '../src/game/inventory.js';
import { GAME_VERSION, compareVersions } from '../src/version.js';
import { stepsFor } from '../src/game/migrate.js';

const src = (f) => fs.readFileSync(new URL(`../src/${f}`, import.meta.url), 'utf8');

test('nothing reached through iron bars or a wall; over a counter, yes', () => {
  const game = makeGame(12345);
  const w = game.world;
  const p = game.player;
  const y = p.y;
  const x0 = p.x;
  const z0 = p.z;
  // Clear ground, a chest three paces off.
  for (let dx = -1; dx <= 4; dx++) for (let dz = -2; dz <= 2; dz++) for (const yy of [y, y + 1, y + 2]) w.setBlock(x0 + dx, yy, z0 + dz, B.air);
  w.setBlock(x0 + 3, y, z0, B.chest);
  assert.ok(reachClear(w, p, x0 + 3, z0), 'nothing in the way');
  // A counter, waist high: still in reach.
  w.setBlock(x0 + 1, y, z0, B.planks);
  assert.ok(reachClear(w, p, x0 + 3, z0), 'over a counter');
  // Bars, a whole row of them (a cell's front): not.
  for (let dz = -2; dz <= 2; dz++) for (const yy of [y, y + 1]) w.setBlock(x0 + 2, yy, z0 + dz, B.iron_bars);
  assert.ok(!reachClear(w, p, x0 + 3, z0), 'not through the bars');
  // The cell door shut: not; open: yes.
  for (const yy of [y, y + 1]) w.setBlock(x0 + 2, yy, z0, B.cell_door);
  assert.ok(!reachClear(w, p, x0 + 3, z0), 'not through a shut cell door');
  for (const yy of [y, y + 1]) w.setBlock(x0 + 2, yy, z0, B.cell_door_open);
  assert.ok(reachClear(w, p, x0 + 3, z0), 'through an open one');
});

test('every item has a picture of its own: the gilt chalice, the saint\'s relic, the jailer\'s keys', () => {
  const sp = src('render/sprites.js');
  for (const k of ['gilt_chalice', 'saint_relic', 'cell_keys', 'mill_sail', 'quicksilver', 'acid_pool', 'placed_item']) {
    assert.ok(ITEMS[k], k);
    assert.ok(sp.includes(`case '${k}':`), `${k} drawn`);
  }
});

test('an old place\'s tier on the map: a badge beside it, tier III alight', () => {
  assert.equal(TIER_BADGE.length, 4);
  const m = src('ui/worldmap.js');
  assert.ok(/tierBadge\(d\);/.test(m), 'drawn for each');
  assert.ok(/if \(tier >= 3\)/.test(m), 'tier III its own');
});

test('a way in grander for its tier, its door and the way to it kept clear', () => {
  const game = makeGame(12345);
  for (const type of ['barrow', 'crypt', 'mine', 'grove', 'forge', 'grotto', 'holdout']) {
    const rec = game.sim.dungeons.all.find((d) => d.type === type && d.x !== undefined);
    if (!rec) continue;
    const site = game.sim.dungeons.site(rec);
    const one = siteBlocks(site, { tier: 1 });
    const two = siteBlocks(site, { tier: 2 });
    const three = siteBlocks(site, { tier: 3 });
    const fires = (bl) => bl.filter((q) => q[3] === B.brazier).length;
    assert.ok(two.length > one.length && three.length > two.length, `${type}: grander each tier`);
    assert.ok(fires(three) > fires(two) && fires(two) >= 2, `${type}: more fires`);
    // (What it was, still there underneath: the door where it was.)
    const last = new Map();
    for (const q of three) last.set(`${q[0]},${q[1]},${q[2]}`, q[3]);
    for (const q of one) if (BLOCK_DOOR.has(q[3])) assert.equal(last.get(`${q[0]},${q[1]},${q[2]}`), q[3], `${type}: its way in kept`);
    // Fallen in: no grandeur.
    assert.equal(siteBlocks(site, { tier: 3, cleared: true }).length, siteBlocks(site, { tier: 1, cleared: true }).length);
  }
});
const BLOCK_DOOR = new Set([B.barrow_door, B.sinkhole, B.mine_shaft, B.hollow_door, B.forge_door, B.grotto_mouth, B.cave_mouth].filter((q) => q !== undefined));

test('turned back with a crystal, the way in builds itself up a stone at a time, and nobody is shut inside it', () => {
  const game = makeGame(12345);
  const input = stubInput();
  const rec = game.sim.dungeons.all.find((d) => d.type === 'barrow' && d.x !== undefined);
  const site = game.sim.dungeons.site(rec);
  rec.cleared = true;
  site.state = { cleared: true };
  game.teleportPlayer(rec.x, 40, rec.z + 2);
  for (let i = 0; i < 10; i++) game.update(0.1, input);
  // (Standing right on its middle.)
  const p = game.player;
  game.teleportPlayer(rec.x, game.world.findStandY(rec.x, rec.z, 60), rec.z);
  game.renderer.effect = () => {};
  game.renderer.flashScreen = () => {};
  game.scene = timeTurn(game, rec, 3, '#ffd070');
  const sc = game.scene;
  let mid = 0;
  for (let i = 0; i < 400 && game.scene; i++) {
    game.update(1 / 30, input);
    if (sc.t > 2.5 && sc.t < sc.SNAP && !mid) mid = sc.placed;
  }
  assert.ok(sc.plan.length > 20, `${sc.plan.length} stones to put back`);
  assert.ok(mid > 0 && mid < sc.plan.length, `a part of it up midway (${mid} of ${sc.plan.length})`);
  assert.equal(rec.tier, 3);
  assert.ok(!rec.cleared);
  assert.equal(site.state.tier, 3);
  assert.ok(game.world.canStand(p.x, p.y, p.z, true), 'not shut up in its stones');
});

test('a scene that goes wrong is cut short, never left holding you still', () => {
  const game = makeGame(12345);
  let ended = false;
  game.scene = { t: 0, dur: 5, lock: true, update() { throw new Error('boom'); }, end() { ended = true; } };
  const err = console.error;
  console.error = () => {};
  try {
    game.sceneTick(0.1, []);
  } finally {
    console.error = err;
  }
  assert.equal(game.scene, null);
  assert.ok(ended);
});

test('a picture left turned and shifted by a drawing gone wrong is put straight', () => {
  const calls = [];
  const ctx = { restore: () => calls.push('restore'), setTransform: (...a) => calls.push(['t', ...a]), globalAlpha: 0.3, globalCompositeOperation: 'lighter', filter: 'blur(2px)', shadowBlur: 4, imageSmoothingEnabled: true };
  cleanCtx(ctx);
  assert.ok(calls.filter((c) => c === 'restore').length >= 16, 'every save let go of');
  assert.deepEqual(calls.find((c) => Array.isArray(c)), ['t', 1, 0, 0, 1, 0, 0]);
  assert.equal(ctx.globalAlpha, 1);
  assert.equal(ctx.globalCompositeOperation, 'source-over');
  assert.equal(ctx.imageSmoothingEnabled, false);
  let reset = 0;
  cleanCtx({ reset: () => reset++ });
  assert.equal(reset, 1);
  assert.ok(/cleanCtx\(this\.ctx\)/.test(src('render/renderer.js')) && /cleanCtx\(ctx, true\)/.test(src('main.js')));
});

test('the fairy ring lets you go: set down off it, not taken again, the view held on its middle meanwhile', () => {
  const game = makeGame(12345, { wg: 2 });
  const input = stubInput();
  game.cheats = { god: true };
  const base = game.sim.dungeons.all.find((d) => d.type === 'mound');
  let run;
  let g = null;
  for (let off = 0; off < 25 && !g; off++) {
    run = new DungeonRun(game, { ...base, seed: base.seed + off, floors: {}, cleared: false, packs: [], depth: 3 });
    run.enter();
    g = (run.data.rings || [])[0];
    if (!g) run.leave();
  }
  assert.ok(g, 'a ring');
  for (const c of game.creatures) c.dormant = 999;
  const t = g.tiles[0];
  const p = game.player;
  game.teleportPlayer(t.x, FY, t.z);
  let taken = 0;
  let was = false;
  let held = false;
  for (let i = 0; i < 30 * 12; i++) {
    game.update(1 / 30, input);
    const dancing = p.rootT > 0;
    if (dancing && !was) taken++;
    if (dancing && game.ringFocus) held = true;
    was = dancing;
  }
  assert.equal(taken, 1, 'taken once');
  assert.ok(held, 'the view held');
  assert.ok(!run.data.rings.some((q) => q.tiles.some((u) => u.x === p.x && u.z === p.z)), 'off the ring');
  assert.equal(game.ringFocus, null);
});

test('relic shards are set at an anvil: a relic and shards in their slots, and Set', () => {
  const game = makeGame(12345);
  const p = game.player;
  p.inv.fill(null);
  p.inv[3] = { item: 'relic_hearth', count: 1 };
  p.inv[5] = { item: 'relic_shard', count: 11 };
  // (Not from the belt any more.)
  p.selected = 5;
  assert.ok(fitShard(game, ITEMS.relic_shard));
  assert.equal(p.inv[3].item, 'relic_hearth', 'nothing set from the belt');
  const r = setShards(game, 3, 5);
  assert.ok(r.ok);
  assert.equal(r.set, SHARD_MAX);
  assert.equal(p.inv[3].item, grownRelic('hearth', SHARD_MAX));
  assert.equal(countItem(p.inv, 'relic_shard'), 11 - SHARD_MAX);
  assert.ok(relicReach(SHARD_MAX) > relicReach(0));
  assert.ok(!setShards(game, 3, 5).ok, 'full');
  assert.ok(!setShards(game, 5, 3).ok, 'the wrong way round');
  assert.ok(/RelicAnvilWindow/.test(src('ui/windows.js')), 'from the anvil');
});

test('what things do, said plainly', () => {
  const vague = /never quite|nothing forged|wants the sun|gather itself|a little, wearing|Somebody misses|it slips past|no longer quiet|weight in gold|out of time with everything/i;
  for (const [k, it] of Object.entries(ITEMS)) if (it.about) assert.ok(!vague.test(it.about), `${k}: ${it.about}`);
  assert.ok(/anvil/i.test(ITEMS.relic_shard.about));
  assert.ok(/radius 4 paces/.test(ITEMS.relic_hearth.about));
});

test('the sound heard from where you are, and woken again if the browser put it to sleep', () => {
  assert.ok(/Object\.defineProperty\(proxy, 'listener'/.test(src('net/host.js')));
  const a = src('game/audio.js');
  assert.ok(/this\.ctx\.resume\?\.\(\)/.test(a) && /this\.failed >= 5/.test(a));
});

test('version 1.17.0, and the step to it', () => {
  assert.ok(compareVersions(GAME_VERSION, '1.17.0') >= 0);
  const steps = stepsFor('1.16.0').filter((s) => s.to === '1.17.0');
  assert.equal(steps.length, 1);
  const log = [];
  steps[0].data({}, log);
  assert.ok(/tier/i.test(log[0]) && /anvil/i.test(log[0]));
});
