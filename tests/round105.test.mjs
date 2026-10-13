// Round 105: the Leviathan's Gut made over. Its tiles and things drawn
// afresh; its floors laid out by its own architect (the gullet, the ribs
// with the whalers' camp and their ledge, the stomach with its bile and the
// swallowed ship, the valve, the worms' nest, the ambergris, the artery)
// beside its old rooms, every one walkable; what's written there made from
// its whale, the ship that went in and her crew, and the town above; its
// new creatures drawn and at work (the gutworm latching on, the blisters
// bursting, the hermit running); the heartbeat and what it moves (the
// valves, the ridged floor); the bile; the whalers' scar; and its two
// masters painted by hand.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGame, stubInput } from './helpers.mjs';
import { DungeonRun } from '../src/game/dungeon.js';
import { buildFloor, FY } from '../src/world/dungeongen.js';
import { BLOCKS, B } from '../src/world/blocks.js';
import { ITEMS } from '../src/world/items.js';
import { SPECIES } from '../src/entities/creature.js';
import { GUT_SPECIES } from '../src/entities/gutmobs.js';
import { GUT_MOBS } from '../src/render/art/gut_mobs.js';
import { GUT_SPRITES, gutTop, gutFront } from '../src/render/art/gut_tex.js';
import { gutIcon } from '../src/render/art/gut_items.js';
import { gutLore } from '../src/world/deeps/gutlore.js';
import { GUT_OWN } from '../src/world/deeps/gut.js';
import { lvT, beatOf, restore } from '../src/game/gutwork.js';
import { GAME_VERSION, compareVersions } from '../src/version.js';
import { stepsFor } from '../src/game/migrate.js';
import { GUT_BOSS_ART } from '../src/render/art/gut_bosses.js';
import { FORGE } from '../src/render/forge.js';
import '../src/render/bossbody.js';

const rec = (s) => ({ id: `g${s}`, type: 'gut', isle: 'corrow', seed: 1000 + s * 31, depth: 3, level: 2, vaultFloor: 1, origin: { who: 'the Great Whale', y: 1201 }, townName: 'Quillcross' });
const at = (f, x, y, z) => {
  const r = f.regions.get(Math.floor(x / 64) * 4096 + Math.floor(z / 36));
  return r ? r.get(x % 64, y, z % 36) : 0;
};
const PASS = new Set(['sealed', 'portcullis', 'boss_gate']);
// Every tile you can walk to from the way in: a step up or down at a time,
// or up a ladder.
function reach(f) {
  const P = f.plan;
  const solid = (x, y, z) => {
    const b = BLOCKS[at(f, f.x0 + x, y, z)];
    return !!(b && b.solid && !PASS.has(b.interact));
  };
  const ladder = (x, y, z) => !!(BLOCKS[at(f, f.x0 + x, y, z)] || {}).ladder;
  const stand = (x, z) => {
    if (!P.open[z * P.W + x]) return null;
    for (const y of [FY - 1, FY, FY + 1, FY + 2]) if ((y === FY - 1 ? !solid(x, FY - 1, z) && solid(x, FY - 2, z) : solid(x, y - 1, z) || y === FY) && !solid(x, y, z) && !solid(x, y + 1, z)) return y;
    return null;
  };
  const seen = new Map();
  const e = [f.entry.x - f.x0, f.entry.z];
  seen.set(e[1] * P.W + e[0], stand(e[0], e[1]));
  const st = [e];
  while (st.length) {
    const [x, z] = st.pop();
    const h = seen.get(z * P.W + x);
    for (const [a, c] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + a;
      const nz = z + c;
      const i = nz * P.W + nx;
      if (nx < 0 || nz < 0 || nx >= P.W || nz >= P.D || seen.has(i)) continue;
      const h2 = stand(nx, nz);
      if (h2 === null) continue;
      if (h2 - h > 1 && !(ladder(x, h, z) || ladder(nx, h, nz) || ladder(x, h + 1, z))) continue;
      seen.set(i, h2);
      st.push([nx, nz]);
    }
  }
  let miss = 0;
  for (const r of f.rooms) {
    if (r.kit === 'hidden') continue;
    for (let z = r.z0; z <= r.z1; z++) {
      for (let x = r.x0; x <= r.x1; x++) {
        if (P.room[z * P.W + x] !== r.id) continue;
        const h = stand(x, z);
        if (h === null || h === FY + 2) continue;
        if (!seen.has(z * P.W + x)) miss++;
      }
    }
  }
  return miss;
}

test('every floor of a Leviathan\'s Gut can be walked, down into its bile and up onto the whalers\' ledge', () => {
  for (let s = 0; s < 6; s++) for (let n = 0; n < 3; n++) assert.equal(reach(buildFloor(rec(s), n)), 0, `seed ${s} floor ${n}`);
});

test('a floor of a Leviathan\'s Gut is laid out as one: its ridged floor, its bile, its valves, its scars, its worms', () => {
  const kits = new Set();
  let rugae = 0;
  let bile = 0;
  let valves = 0;
  let scars = 0;
  let worms = 0;
  let blisters = 0;
  let hermits = 0;
  for (let s = 0; s < 6; s++) {
    for (let n = 0; n < 3; n++) {
      const f = buildFloor(rec(s), n);
      for (const r of f.rooms) kits.add(r.kit);
      for (const q of f.rugae || []) {
        const id = at(f, q.x, FY - 1, q.z);
        assert.ok((q.dx && id === B.lv_rugae_x) || (q.dz && id === B.lv_rugae_z), 'the ridges across the way it pushes');
        assert.equal(Math.abs(q.dx) + Math.abs(q.dz), 1);
        rugae++;
      }
      for (const q of f.bile || []) {
        assert.equal(at(f, q.x, FY - 2, q.z), B.lv_bile);
        assert.equal(at(f, q.x, FY - 1, q.z), B.air, 'sunk');
        bile++;
      }
      for (const v of f.valves || []) {
        assert.equal(at(f, v.x, FY, v.z), B.lv_valve);
        valves++;
      }
      for (const c of f.scars || []) {
        assert.equal(at(f, c.x, FY, c.z), B.lv_scar);
        scars++;
      }
      worms += f.spawns.filter((q) => q.species === 'gutworm' && q.hole).length;
      blisters += f.spawns.filter((q) => q.species === 'bile_blister').length;
      hermits += f.spawns.filter((q) => q.species === 'ambergris_hermit').length;
      if (n === 0) assert.ok(f.rooms.some((r) => r.kit === 'ribs'), 'the whalers\' ribs on the first floor');
    }
  }
  for (const k of GUT_OWN) assert.ok(kits.has(k), `the ${k}`);
  assert.ok(rugae > 300 && bile > 100 && valves > 3 && scars > 3 && worms > 20 && blisters > 20 && hermits > 3, `${rugae} ${bile} ${valves} ${scars} ${worms} ${blisters} ${hermits}`);
});

test('what\'s written in a Leviathan\'s Gut is its whale\'s, its whalers\' and its town\'s, and the same each time', () => {
  const a = gutLore(rec(1), 0, 'leviathan_heart');
  const b = gutLore(rec(1), 0, 'leviathan_heart');
  for (const k of ['log', 'tally', 'letter', 'manifest', 'tryworks', 'complaint', 'prayer', 'farewell', 'dead', 'last']) {
    const t = a[k]();
    assert.deepEqual(t, b[k](), k);
    assert.ok(t.title && t.lines.length >= 1 && t.lines.every((l) => typeof l === 'string' && l.length > 3), k);
  }
  assert.ok(a.log().lines.join(' ').includes(a.ship) && a.log().lines.join(' ').includes('Quillcross'));
  assert.ok(a.log().lines.join(' ').includes('cross'), 'where they cut their cache');
  for (const c of a.crew) assert.ok(a.manifest().lines.join(' ').includes(c.name), c.name);
  assert.ok(a.last().title.includes('Heart'));
  const titles = new Set();
  for (let s = 1; s <= 4; s++) for (let n = 0; n < 3; n++) for (const l of buildFloor(rec(s), n).lore) titles.add(l.title);
  for (const t of ['The Captain\'s Log', 'The Manifest', 'Cut in the Bone', 'A Whaler', 'A Prayer', 'Scratched on a Cask']) assert.ok(titles.has(t), t);
});

test('the Leviathan\'s Gut\'s tiles and things are drawn; its new creatures are in the game and drawn; ambergris is a thing', () => {
  for (const n of ['lv_flesh', 'lv_rugae_x', 'lv_rugae_z', 'lv_fleshfloor', 'lv_bonesand', 'lv_bile', 'lv_amberfloor', 'lv_deck', 'lv_ledge']) assert.ok(gutTop(n, 0), `${n} top`);
  for (const n of ['lv_flesh', 'lv_cartilage', 'lv_ribwall', 'lv_hide', 'lv_wormhole', 'lv_scar', 'lv_valve', 'lv_artery', 'lv_eggs', 'lv_ledge', 'lv_bile', 'lv_fleshfloor']) assert.ok(gutFront(n, 0), `${n} front`);
  for (const [k, fn] of Object.entries(GUT_SPRITES)) {
    assert.ok(BLOCKS[B[k]], `${k} is a block`);
    for (const st of [false, true]) assert.ok(fn(0, st, 0), `${k} drawn`);
  }
  for (const sp of Object.keys(GUT_SPECIES)) {
    assert.ok(SPECIES[sp], `${sp} is a species`);
    assert.ok(GUT_MOBS[sp] && GUT_MOBS[sp].rows.length === 24, `${sp} is drawn`);
  }
  assert.ok(GUT_MOBS.ambergris_hermit.groups.rest, 'the hermit drawn in under its lump');
  assert.ok(ITEMS.ambergris && ITEMS.ambergris.value > 30 && gutIcon('ambergris'), 'ambergris');
});

// ------------------------------------------------------- in the gut itself
function inGut() {
  const game = makeGame(12345);
  const input = stubInput();
  game.minute = 600;
  for (let i = 0; i < 20; i++) game.update(0.1, input);
  // (The gut's over the sea, on Corrow: a dungeon at home made one for
  // the test.)
  const base = game.sim.dungeons.all.find((q) => q.type === 'crypt');
  const r = { ...base, type: 'gut', isle: 'corrow', floors: {}, cleared: false, pack: null, weakened: 0 };
  new DungeonRun(game, r).enter();
  const d = game.dungeon;
  for (const c of game.creatures) {
    c.dead = true;
    game.removeOcc(c);
  }
  game.creatures = [];
  game.cheats = { ...(game.cheats || {}), god: false };
  for (const k of ['rugae', 'bile', 'valves', 'scars']) d.data[k] = [];
  // A clear hall, 15 by 8, about the way in, its wall of flesh north of it.
  const e = d.data.rooms.find((q) => q.kit === 'entry');
  const x0 = d.data.x0 + e.cx - 7;
  const z0 = e.cz - 2;
  for (let z = z0 - 2; z <= z0 + 5; z++) {
    for (let x = x0 - 1; x <= x0 + 15; x++) {
      for (const y of [FY, FY + 1, FY + 2]) game.world.setBlock(x, y, z, B.air);
      game.world.setBlock(x, FY - 1, z, B.lv_fleshfloor);
      game.world.setBlock(x, FY - 2, z, B.lv_flesh);
    }
  }
  for (let x = x0 - 1; x <= x0 + 15; x++) for (const y of [FY, FY + 1]) game.world.setBlock(x, y, z0 - 3, B.lv_flesh);
  const p = game.player;
  p.teleport(x0, FY, z0 + 4);
  p.hp = p.maxHp = 200;
  d.gutT = null;
  return { game, input, d, p, x0, z0 };
}
const run = (game, input, secs) => {
  for (let t = 0; t < secs; t += 0.05) game.update(0.05, input);
};

test('a gutworm lunges out of its hole and latches on: held, and drunk from, till it\'s struck off', () => {
  const { game, input, d, p, x0, z0 } = inGut();
  for (const y of [FY, FY + 1]) game.world.setBlock(x0 + 6, y, z0 - 3, B.lv_wormhole);
  const w = d.spawn('gutworm', x0 + 6, FY, z0 - 2, { hole: { x: x0 + 6, z: z0 - 3 }, out: { x: 0, z: 1 } });
  w.dormant = 0;
  // In its hole, it's hard to hurt.
  const h0 = w.hp;
  game.damage(w, 8, p);
  assert.ok(h0 - w.hp <= 3, 'it shrinks into its hole');
  p.teleport(x0 + 6, FY, z0 - 1);
  const hp = p.hp;
  run(game, input, 2);
  assert.ok(w.latched === p, 'latched on');
  assert.ok(p.rootT > 0, 'held fast');
  assert.ok(p.hp < hp - 2, 'drunk from');
  game.damage(w, 4, p);
  assert.ok(!w.latched, 'struck off');
  assert.ok(w.cool > 0);
});

test('a bile blister bursts when anything comes by: bile over everyone near, and a puddle that burns (not the crabs)', () => {
  const { game, input, d, p, x0, z0 } = inGut();
  const bl = d.spawn('bile_blister', x0 + 6, FY, z0 + 2, {});
  const b2 = d.spawn('bile_blister', x0 + 7, FY, z0 + 2, {});
  const crab = d.spawn('bone_crab', x0 + 6, FY, z0 + 3, {});
  for (const c of [bl, b2, crab]) c.dormant = 0;
  crab.dormant = 99;
  p.teleport(x0 + 5, FY, z0 + 2);
  const hp = p.hp;
  const ch = crab.hp;
  run(game, input, 0.6);
  assert.ok(bl.dead && b2.dead, 'burst, and the next one with it');
  assert.ok(p.hp < hp, 'bile');
  assert.equal(crab.hp, ch, 'the crab\'s shell doesn\'t mind');
  assert.ok(lvT(d).acid.length > 0, 'a puddle');
  const h1 = p.hp;
  run(game, input, 1.8);
  assert.ok(p.hp < h1 && p.slowT > 0, 'it burns, standing in it');
});

test('the ambergris hermit sits still as a lump, runs when you come near, and is worth catching', () => {
  const { game, input, d, p, x0, z0 } = inGut();
  const h = d.spawn('ambergris_hermit', x0 + 10, FY, z0 + 2, { peaceful: true });
  h.dormant = 0;
  run(game, input, 0.3);
  assert.ok(h.lying, 'a lump of ambergris');
  assert.equal(h.x, x0 + 10);
  p.teleport(x0 + 8, FY, z0 + 2);
  run(game, input, 1.5);
  assert.ok(!h.lying && h.fleeT > 0, 'it runs');
  assert.ok(Math.abs(h.x - p.x) + Math.abs(h.z - p.z) > 2, 'away from you');
  assert.ok(SPECIES.ambergris_hermit.drops.some(([k, , , c]) => k === 'ambergris' && c >= 1));
});

test('the heartbeat: the valve opens on the beat a moment and shuts again', () => {
  const { game, input, d, p, x0, z0 } = inGut();
  const v = { x: x0 + 8, z: z0 - 3 };
  for (const y of [FY, FY + 1]) game.world.setBlock(v.x, y, v.z, B.lv_valve);
  d.data.valves = [{ ...v, room: 0 }];
  p.teleport(x0 + 2, FY, z0 + 4);
  const T = lvT(d);
  T.beatT = 0.05;
  run(game, input, 0.2);
  assert.ok(T.beats >= 1, 'a beat');
  assert.equal(game.world.getBlock(v.x, FY, v.z), B.air, 'open on the beat');
  run(game, input, 1);
  assert.equal(game.world.getBlock(v.x, FY, v.z), B.lv_valve, 'shut again');
  assert.ok(beatOf(d) <= 1.6);
});

test('every third beat the ridged floor carries you a tile along its grain; into the bile, it burns', () => {
  const { game, input, d, p, x0, z0 } = inGut();
  const w = game.world;
  for (let x = x0 + 3; x <= x0 + 5; x++) {
    w.setBlock(x, FY - 1, z0 + 2, B.lv_rugae_x);
    d.data.rugae.push({ x, z: z0 + 2, dx: 1, dz: 0 });
  }
  // The bile beyond.
  w.setBlock(x0 + 6, FY - 1, z0 + 2, B.air);
  w.setBlock(x0 + 6, FY - 2, z0 + 2, B.lv_bile);
  d.data.bile.push({ x: x0 + 6, z: z0 + 2 });
  p.teleport(x0 + 5, FY, z0 + 2);
  const T = lvT(d);
  T.beats = 2;
  T.beatT = 0.05;
  run(game, input, 0.15);
  assert.equal(p.x, x0 + 6, 'carried along');
  assert.equal(p.y, FY - 1, 'down into the bile');
  const hp = p.hp;
  run(game, input, 1);
  assert.ok(p.hp < hp, 'it burns');
});

test('the whalers\' scar cut open gives on their cache; it stays open', () => {
  const { game, d, x0, z0 } = inGut();
  const s = { x: x0 + 4, z: z0 - 3 };
  for (const y of [FY, FY + 1]) game.world.setBlock(s.x, y, s.z, B.lv_scar);
  d.data.scars = [{ ...s, room: 0 }];
  d.interact(s.x, FY, s.z, BLOCKS[B.lv_scar]);
  assert.equal(game.world.getBlock(s.x, FY, s.z), B.air);
  for (const y of [FY, FY + 1]) game.world.setBlock(s.x, y, s.z, B.lv_scar);
  restore(d);
  assert.equal(game.world.getBlock(s.x, FY, s.z), B.air, 'still open');
});

test('the version and its step', () => {
  assert.ok(compareVersions(GAME_VERSION, '1.5.0') >= 0);
  assert.ok(stepsFor('1.4.0').some((s) => s.to === '1.5.0'));
});

test('the Leviathan\'s Gut\'s masters are painted by hand, every part in place', () => {
  assert.deepEqual(Object.keys(GUT_BOSS_ART).sort(), ['gut_wyrm', 'leviathan_heart']);
  for (const [k, A] of Object.entries(GUT_BOSS_ART)) {
    assert.ok(SPECIES[k], `${k} is a species`);
    assert.ok(FORGE[k] && FORGE[k].pix, `${k} is painted`);
    assert.equal(A.size, 64);
    assert.equal(A.body.rows.length, 64, `${k} has a body`);
    for (const [n, q] of Object.entries(A.parts)) assert.ok(q.pix && q.pix.rows.length, `${k}.${n} has a picture`);
  }
  assert.ok(GUT_BOSS_ART.leviathan_heart.idle, 'the heart beats');
});
