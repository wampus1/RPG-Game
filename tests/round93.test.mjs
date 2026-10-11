// Round 93: the essentials. A pack fallen down below, clicked: it bursts,
// all that was in it out on the floor, the pack gone and forgotten; a time
// crystal at a way in with a pack still below: warned once, and used again,
// it goes ahead; a master never begins an attack in silence, and every
// sound asked for by name has a voice; and the version's step.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGame, stubInput } from './helpers.mjs';
import { DungeonRun } from '../src/game/dungeon.js';
import { FY } from '../src/world/dungeongen.js';
import { B } from '../src/world/blocks.js';
import { ITEMS } from '../src/world/items.js';
import { useTimeCrystal } from '../src/game/timecrystal.js';
import { SOUND_ALIAS } from '../src/game/audio.js';
import fs from 'node:fs';
import path from 'node:path';
import { GAME_VERSION, compareVersions } from '../src/version.js';
import { stepsFor, migrateSave } from '../src/game/migrate.js';

const input = stubInput();
const run = (game, n) => {
  for (let i = 0; i < n; i++) game.update(0.05, input);
};

test('a fallen pack, clicked: it bursts, and everything in it spills out', () => {
  const game = makeGame(12345, { wg: 8 });
  run(game, 10);
  const rec = { ...game.sim.dungeons.all.find((d) => d.type === 'barrow'), floors: {}, cleared: false, pack: null, packs: [] };
  new DungeonRun(game, rec).enter();
  run(game, 10);
  const d = game.dungeon;
  const p = game.player;
  const at = d.dropPack([['iron_ingot', 3], ['bread', 2]], Math.round(p.x) + 1, Math.round(p.z));
  assert.ok(at && game.world.getBlock(at.x, FY, at.z) === B.satchel);
  assert.equal(rec.packs.length, 1);
  const before = game.drops.length;
  game.interact(at.x, FY, at.z);
  assert.equal(game.world.getBlock(at.x, FY, at.z), B.air, 'the pack gone');
  const out = game.drops.slice(before);
  assert.equal(out.filter((q) => q.item === 'iron_ingot').reduce((a, q) => a + q.count, 0), 3);
  assert.equal(out.filter((q) => q.item === 'bread').reduce((a, q) => a + q.count, 0), 2);
  assert.equal(rec.packs.length, 0, 'and no longer marked');
  assert.ok(!(d.notes || []).some((n) => n.pack && n.pack.x === at.x && n.pack.z === at.z));
});

test('a time crystal over a pack\'s warning: told once; used again, it goes ahead', () => {
  const game = makeGame(12345, { wg: 8 });
  run(game, 10);
  const p = game.player;
  const rec = game.sim.dungeons.all.find((d) => d.type === 'barrow');
  rec.cleared = true;
  game.sim.dungeons.site(rec).state = { cleared: true };
  rec.packs = [{ floor: 0, x: 1, z: 1, name: 'Wren', id: null }];
  game.teleportPlayer(rec.x + 1, 6, rec.z + 2);
  run(game, 10);
  const said = [];
  const msg = game.ui.msg;
  game.ui.msg = (t, ...a) => {
    said.push(t);
    return msg.call(game.ui, t, ...a);
  };
  p.inv[p.selected] = { item: 'time_crystal_1', count: 2 };
  useTimeCrystal(game, ITEMS.time_crystal_1);
  assert.ok(!game.scene, 'not yet');
  assert.ok(said.some((t) => /pack still lies down there/.test(t)), 'told of the pack');
  assert.equal(p.inv[p.selected].count, 2, 'nothing used');
  said.length = 0;
  useTimeCrystal(game, ITEMS.time_crystal_1);
  assert.ok(!said.some((t) => /pack still lies/.test(t)), 'not told again');
  assert.equal(game.scene && game.scene.kind, 'timeturn', 'on with it');
  run(game, 180);
  assert.equal(rec.cleared, false, 'turned back');
  assert.equal((rec.packs || []).length, 0, 'the pack lost to time');
});

test('masters that began their attacks in silence: a sound for every one now', () => {
  const game = makeGame(12345, { wg: 8 });
  run(game, 10);
  const rec = { ...game.sim.dungeons.all.find((d) => d.type === 'barrow'), floors: {}, cleared: false, pack: null, packs: [] };
  new DungeonRun(game, rec).enter();
  run(game, 10);
  let n = 0;
  game.audio = { play() { n++; this.plays = (this.plays || 0) + 1; }, setVolume() {}, loop() {}, stop() {} };
  const p = game.player;
  p.hp = p.maxHp = 1e9;
  for (const sp of ['scrimshaw_horror', 'salt_mummy', 'thing_below', 'crucible', 'rune_golem']) {
    const s = game.findFreeSpot(p.x + 4, p.z, p.y);
    const c = game.dungeon.spawn(sp, s.x, s.y, s.z, { boss: true });
    c.target = p;
    let casts = 0;
    let silent = 0;
    for (let i = 0; i < 300; i++) {
      p.hp = p.maxHp;
      const before = n;
      const cb = c.casts || 0;
      game.update(0.05, input);
      if ((c.casts || 0) > cb) {
        casts++;
        if (n === before) silent++;
      }
    }
    assert.ok(casts > 0, `${sp} fought`);
    assert.equal(silent, 0, `${sp}: none in silence`);
    c.dead = true;
    game.creatures = game.creatures.filter((q) => !q.dead);
  }
});

test('every sound asked for by name has a voice', () => {
  const root = path.resolve('src');
  const audio = fs.readFileSync(path.join(root, 'game/audio.js'), 'utf8');
  const known = new Set([...audio.matchAll(/case '([a-z_0-9]+)'/g)].map((m) => m[1]));
  const asked = new Set();
  const walk = (d) => {
    for (const f of fs.readdirSync(d, { withFileTypes: true })) {
      const q = path.join(d, f.name);
      if (f.isDirectory()) walk(q);
      else if (f.name.endsWith('.js')) for (const m of fs.readFileSync(q, 'utf8').matchAll(/audio\??\.play\('([a-z_0-9]+)'/g)) asked.add(m[1]);
    }
  };
  walk(root);
  const mute = [...asked].filter((k) => !known.has(k) && !known.has(SOUND_ALIAS[k]));
  assert.deepEqual(mute, []);
});

test('0.93.0: its step', () => {
  assert.ok(compareVersions(GAME_VERSION, '0.93.0') >= 0);
  assert.ok(stepsFor('0.92.0').some((s) => s.to === '0.93.0'));
  const { log } = migrateSave({ gv: '0.92.0', wg: 8 });
  assert.ok(log.some((l) => /pack bursts/.test(l)));
});
