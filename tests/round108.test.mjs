// Round 108: the Hollow Hill made over. Its tiles and things drawn afresh;
// its floors laid out by its own architect (the court's hall with its dais
// and throne, the feast, the dance and its ring, the stones and the cairn
// behind its slab, the passage tomb, the birchwood and the bower behind its
// hill-door) beside its old rooms, every one walkable; what's written there
// made from the hill's own story and its town's; its new creatures drawn
// and at work (the changeling that snatches and runs for a door, the
// witch-hare's hex, the hob lighting the lanterns the wisps drink dark);
// the hill-doors and their twins; the stones woken in the trees' order;
// the ring that takes you dancing, and broken; the feast; the harp; the
// offering; and its two masters painted by hand.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGame, stubInput } from './helpers.mjs';
import { DungeonRun } from '../src/game/dungeon.js';
import { buildFloor, FY } from '../src/world/dungeongen.js';
import { BLOCKS, B } from '../src/world/blocks.js';
import { SPECIES } from '../src/entities/creature.js';
import { MOUND_SPECIES } from '../src/entities/moundmobs.js';
import { MOUND_MOBS } from '../src/render/art/mound_mobs.js';
import { MOUND_SPRITES, moundTop, moundFront } from '../src/render/art/mound_tex.js';
import { moundLore, FAULTS, TREES } from '../src/world/deeps/moundlore.js';
import { MOUND_OWN } from '../src/world/deeps/mound.js';
import { mdT, restore, DANCE, HARP_HOLD } from '../src/game/moundwork.js';
import { GAME_VERSION, compareVersions } from '../src/version.js';
import { stepsFor } from '../src/game/migrate.js';
import { MOUND_BOSS_ART } from '../src/render/art/mound_bosses.js';
import { FORGE } from '../src/render/forge.js';
import '../src/render/bossbody.js';

const rec = (s) => ({ id: `m${s}`, type: 'mound', isle: 'wyrd', seed: 1000 + s * 31, depth: 3, level: 2, vaultFloor: 1, origin: { who: 'the Fair King', y: 1201 }, townName: 'Quillcross' });
const at = (f, x, y, z) => {
  const r = f.regions.get(Math.floor(x / 64) * 4096 + Math.floor(z / 36));
  return r ? r.get(x % 64, y, z % 36) : 0;
};
const PASS = new Set(['sealed', 'portcullis', 'boss_gate']);
// Every tile you can walk to from the way in: a step up or down at a time.
// (Things set on the floor aren't tiles to walk to.)
function reach(f) {
  const P = f.plan;
  const solid = (x, y, z) => {
    const b = BLOCKS[at(f, f.x0 + x, y, z)];
    return !!(b && b.solid && !PASS.has(b.interact));
  };
  const prop = (x, y, z) => (BLOCKS[at(f, f.x0 + x, y, z)] || {}).render === 'sprite';
  const stand = (x, z) => {
    if (!P.open[z * P.W + x]) return null;
    for (const y of [FY - 1, FY, FY + 1, FY + 2]) if ((y === FY - 1 ? !solid(x, FY - 1, z) && solid(x, FY - 2, z) : (solid(x, y - 1, z) && !prop(x, y - 1, z)) || y === FY) && !solid(x, y, z) && !solid(x, y + 1, z)) return y;
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
      if (h2 === null || h2 - h > 1) continue;
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
        if (h === null) continue;
        if (h === FY + 2 && at(f, f.x0 + x, FY + 1, z) !== B.hh_dais) continue;
        if (!seen.has(z * P.W + x)) miss++;
      }
    }
  }
  return miss;
}

test('every floor of a Hollow Hill can be walked, up onto the dais and the stones\' mound and down into the pool', () => {
  for (let s = 0; s < 6; s++) for (let n = 0; n < 3; n++) assert.equal(reach(buildFloor(rec(s), n)), 0, `seed ${s} floor ${n}`);
});

test('a floor of a Hollow Hill is laid out as one: its doors in pairs, its rings, its feasts, its stones, its lanterns', () => {
  const kits = new Set();
  const n0 = { hilldoors: 0, rings: 0, feasts: 0, circles: 0, lanterns: 0 };
  const sp = {};
  let bowers = 0;
  for (let s = 0; s < 6; s++) {
    for (let n = 0; n < 3; n++) {
      const f = buildFloor(rec(s), n);
      for (const r of f.rooms) kits.add(r.kit);
      const doors = f.hilldoors || [];
      assert.equal(doors.length % 2, 0, 'in pairs');
      doors.forEach((q, i) => {
        assert.equal(at(f, q.x, FY, q.z), B.hh_hilldoor);
        assert.equal(doors[q.to].to, i, 'each the other\'s twin');
        assert.equal(BLOCKS[at(f, q.front.x, FY, q.front.z)].solid, false, 'clear in front of it');
        if (q.bower) bowers++;
      });
      for (const g of f.rings || []) {
        for (const t of g.tiles) assert.equal(at(f, t.x, FY - 1, t.z), B.hh_ring);
        for (const c of g.caps) assert.equal(at(f, c.x, FY, c.z), B.hh_ringcap, 'its toadstools');
      }
      for (const q of f.feasts || []) for (const t of q.tables) assert.equal(at(f, t.x, FY, t.z), B.hh_feast);
      for (const q of f.circles || []) {
        assert.deepEqual(q.stones.map((s_) => s_.kind).sort(), [0, 1, 2, 3, 4], 'one of each tree');
        for (const s_ of q.stones) assert.equal(at(f, s_.x, FY + 1, s_.z), B.hh_stone);
        assert.equal(at(f, q.slab.x, FY, q.slab.z), B.hh_slab);
      }
      for (const q of f.lanterns || []) assert.equal(at(f, q.x, FY, q.z), B.hh_lantern);
      for (const k of Object.keys(n0)) n0[k] += (f[k] || []).length;
      for (const q of f.spawns) sp[q.species] = (sp[q.species] || 0) + 1;
    }
  }
  for (const k of MOUND_OWN) assert.ok(kits.has(k), `the ${k}`);
  for (const [k, v] of Object.entries(n0)) assert.ok(v > 3, `${k}: ${v}`);
  assert.ok(bowers > 0, 'a bower behind its door');
  for (const k of ['changeling', 'witch_hare', 'hob', 'fey_knight', 'wisp']) assert.ok(sp[k] > 2, `${k}: ${sp[k]}`);
});

test('what\'s written in a Hollow Hill is its own story and its town\'s, and the same each time', () => {
  const a = moundLore(rec(1), 0, 'fair_king');
  const b = moundLore(rec(1), 0, 'fair_king');
  for (const k of ['verse', 'rules', 'offering', 'piper', 'taken', 'doors', 'changeling', 'throne', 'story', 'last']) {
    const t = a[k]();
    assert.deepEqual(t, b[k](), k);
    assert.ok(t.title && t.lines.length >= 1 && t.lines.every((l) => typeof l === 'string' && l.length > 3), k);
  }
  // The verse tells the stones' order.
  const v = a.verse().lines.join(' ');
  let last = -1;
  for (const tr of TREES) {
    const i = v.indexOf(tr);
    assert.ok(i > last, `${tr} in its place`);
    last = i;
  }
  assert.ok(a.piper().lines.join(' ').includes(a.piperName), 'the piper by name');
  assert.ok(a.story().lines.includes(FAULTS[a.fault].why), 'what went wrong');
  assert.ok(a.last().title.includes('Fair King'));
  const titles = new Set();
  for (let s = 1; s <= 4; s++) for (let n = 0; n < 3; n++) for (const l of buildFloor(rec(s), n).lore) titles.add(l.title);
  for (const t of ['Under the Hill', 'Cut on the Basin', 'Bones, Garlanded', 'A Piper, Asleep', 'Cut in the Cairn']) assert.ok(titles.has(t), t);
});

test('the Hollow Hill\'s tiles and things are drawn; its new creatures are in the game and drawn', () => {
  for (const n of ['hh_drystone', 'hh_heath', 'hh_flags', 'hh_starlit', 'hh_ring', 'hh_moss', 'hh_litter', 'hh_pool']) assert.ok(moundTop(n, 0), `${n} top`);
  for (const n of ['hh_drystone', 'hh_spiral', 'hh_hilldoor', 'hh_ogham', 'hh_slab', 'hh_niche', 'hh_woven', 'hh_dais']) assert.ok(moundFront(n, 0), `${n} front`);
  for (const [k, fn] of Object.entries(MOUND_SPRITES)) {
    assert.ok(BLOCKS[B[k]], `${k} is a block`);
    for (const st of [false, true]) assert.ok(fn(0, st, 0), `${k} drawn`);
  }
  for (const sp of Object.keys(MOUND_SPECIES)) {
    assert.ok(SPECIES[sp], `${sp} is a species`);
    assert.ok(MOUND_MOBS[sp] && MOUND_MOBS[sp].rows.length === 24, `${sp} is drawn`);
  }
});

// ------------------------------------------------------- in the hill
function inHill() {
  const game = makeGame(12345);
  const input = stubInput();
  game.minute = 600;
  for (let i = 0; i < 20; i++) game.update(0.1, input);
  const base = game.sim.dungeons.all.find((q) => q.type === 'crypt');
  const r = { ...base, type: 'mound', isle: 'wyrd', floors: {}, cleared: false, pack: null, weakened: 0 };
  new DungeonRun(game, r).enter();
  const d = game.dungeon;
  for (const c of game.creatures) {
    c.dead = true;
    game.removeOcc(c);
  }
  game.creatures = [];
  game.cheats = { ...(game.cheats || {}), god: false };
  for (const k of ['hilldoors', 'rings', 'feasts', 'circles', 'lanterns']) d.data[k] = [];
  // A clear hall, 15 by 8, about the way in, its drystone wall north of it.
  const e = d.data.rooms.find((q) => q.kit === 'entry');
  const x0 = d.data.x0 + e.cx - 7;
  const z0 = e.cz - 2;
  for (let z = z0 - 2; z <= z0 + 5; z++) {
    for (let x = x0 - 1; x <= x0 + 15; x++) {
      for (const y of [FY, FY + 1, FY + 2]) game.world.setBlock(x, y, z, B.air);
      game.world.setBlock(x, FY - 1, z, B.hh_heath);
      game.world.setBlock(x, FY - 2, z, B.hh_drystone);
    }
  }
  for (let x = x0 - 1; x <= x0 + 15; x++) for (const y of [FY, FY + 1]) game.world.setBlock(x, y, z0 - 3, B.hh_drystone);
  const p = game.player;
  p.teleport(x0, FY, z0 + 4);
  p.hp = p.maxHp = 200;
  d.moundT = null;
  return { game, input, d, p, x0, z0 };
}
const run = (game, input, secs) => {
  for (let t = 0; t < secs; t += 0.05) game.update(0.05, input);
};

test('in at a hill-door, and out of its twin', () => {
  const { game, d, p, x0, z0 } = inHill();
  const a = { x: x0 + 2, z: z0 - 3, front: { x: x0 + 2, z: z0 - 2 }, room: 0, to: 1 };
  const c = { x: x0 + 12, z: z0 - 3, front: { x: x0 + 12, z: z0 - 2 }, room: 0, to: 0 };
  for (const q of [a, c]) for (const y of [FY, FY + 1]) game.world.setBlock(q.x, y, q.z, B.hh_hilldoor);
  d.data.hilldoors = [a, c];
  p.teleport(a.front.x, FY, a.front.z);
  d.interact(a.x, FY, a.z, BLOCKS[B.hh_hilldoor]);
  assert.deepEqual([p.x, p.z], [c.front.x, c.front.z], 'out of the other');
  assert.ok(mdT(d).told.door);
});

test('the stones wake in the trees\' order and roll back the slab; out of order they all go dark; it stays open', () => {
  const { game, d, p, x0, z0 } = inHill();
  const slab = { x: x0 + 7, z: z0 - 3 };
  for (const y of [FY, FY + 1]) game.world.setBlock(slab.x, y, slab.z, B.hh_slab);
  const kinds = [3, 0, 4, 1, 2];
  const stones = kinds.map((k, i) => ({ x: x0 + 3 + i * 2, z: z0 + 1, kind: k }));
  for (const s of stones) game.world.setBlock(s.x, FY + 1, s.z, B.hh_stone, s.kind);
  d.data.circles = [{ stones, slab, room: 0 }];
  const by = (k) => stones.find((s) => s.kind === k);
  const touch = (k) => d.interact(by(k).x, FY + 1, by(k).z, BLOCKS[B.hh_stone]);
  touch(0);
  touch(1);
  assert.ok(game.world.getState(by(0).x, FY + 1, by(0).z) && game.world.getState(by(1).x, FY + 1, by(1).z), 'two awake');
  const hp = p.hp;
  touch(3);
  assert.ok(stones.every((s) => !game.world.getState(s.x, FY + 1, s.z)), 'all dark again');
  assert.ok(p.hp < hp, 'a shock');
  for (let k = 0; k < 5; k++) touch(k);
  assert.equal(game.world.getBlock(slab.x, FY, slab.z), B.air, 'the slab rolled back');
  for (const y of [FY, FY + 1]) game.world.setBlock(slab.x, y, slab.z, B.hh_slab);
  restore(d);
  assert.equal(game.world.getBlock(slab.x, FY, slab.z), B.air, 'still open');
  assert.ok(stones.every((s) => game.world.getState(s.x, FY + 1, s.z)), 'still awake');
});

test('step in the ring and you\'re taken dancing round it, and out dizzy; kick its toadstools over and it\'s only grass', () => {
  const { game, input, d, p, x0, z0 } = inHill();
  const tiles = [];
  for (let x = x0 + 4; x <= x0 + 10; x++) tiles.push({ x, z: z0 + 1 });
  for (let x = x0 + 10; x >= x0 + 4; x--) tiles.push({ x, z: z0 + 2 });
  for (const t of tiles) game.world.setBlock(t.x, FY - 1, t.z, B.hh_ring);
  const caps = [{ x: x0 + 6, z: z0 + 1 }, { x: x0 + 9, z: z0 + 2 }];
  for (const c of caps) game.world.setBlock(c.x, FY, c.z, B.hh_ringcap);
  d.data.rings = [{ tiles, caps, room: d.data.rooms[0].id }];
  p.teleport(x0 + 4, FY, z0 + 1);
  run(game, input, 1);
  assert.ok(mdT(d).dance.get(p), 'dancing');
  assert.ok(tiles.some((t) => t.x === p.x && t.z === p.z) && !(p.x === x0 + 4 && p.z === z0 + 1), 'taken round');
  run(game, input, DANCE);
  assert.ok(!mdT(d).dance.get(p), 'let go');
  assert.ok(p.slowT > 0, 'dizzy');
  // The toadstools kicked over, one by one.
  d.interact(caps[0].x, FY, caps[0].z, BLOCKS[B.hh_ringcap]);
  assert.equal(game.world.getBlock(tiles[0].x, FY - 1, tiles[0].z), B.hh_ring, 'not yet');
  d.interact(caps[1].x, FY, caps[1].z, BLOCKS[B.hh_ringcap]);
  assert.ok(tiles.every((t) => game.world.getBlock(t.x, FY - 1, t.z) === B.hh_heath), 'only grass');
  game.world.setBlock(tiles[0].x, FY - 1, tiles[0].z, B.hh_ring);
  restore(d);
  assert.equal(game.world.getBlock(tiles[0].x, FY - 1, tiles[0].z), B.hh_heath, 'still broken');
  // Broken, it takes nobody.
  run(game, input, 3);
  p.teleport(tiles[3].x, FY, tiles[3].z);
  run(game, input, 0.5);
  assert.ok(!mdT(d).dance.get(p));
});

test('the feast mends every hurt; then you can\'t stop eating, and the court wakes', () => {
  const { game, input, d, p, x0, z0 } = inHill();
  const t = { x: x0 + 7, z: z0 + 1 };
  game.world.setBlock(t.x, FY, t.z, B.hh_feast);
  d.data.feasts = [{ tables: [t], room: 0 }];
  const k = d.spawn('fey_knight', x0 + 9, FY, z0 + 2, { dormant: 2 });
  p.hp = 20;
  p.teleport(t.x, FY, t.z + 2);
  d.interact(t.x, FY, t.z, BLOCKS[B.hh_feast]);
  assert.equal(p.hp, 20, 'asked first');
  d.interact(t.x, FY, t.z, BLOCKS[B.hh_feast]);
  assert.equal(p.hp, p.maxHp, 'every hurt mended');
  assert.ok(p.rootT > 0, 'can\'t stop');
  assert.ok(!k.dormant && k.target === p, 'the court awake');
  run(game, input, 0.2);
  d.interact(t.x, FY, t.z, BLOCKS[B.hh_feast]);
  p.hp = 20;
  d.interact(t.x, FY, t.z, BLOCKS[B.hh_feast]);
  assert.equal(p.hp, 20, 'eaten once only');
});

test('the golden harp: the fair folk stop, and listen, and forget you; not again at once', () => {
  const { game, d, p, x0, z0 } = inHill();
  const h = { x: x0 + 3, z: z0 + 1 };
  game.world.setBlock(h.x, FY, h.z, B.hh_harp);
  const k = d.spawn('fey_knight', x0 + 9, FY, z0 + 2, {});
  k.dormant = 0;
  k.target = p;
  d.interact(h.x, FY, h.z, BLOCKS[B.hh_harp]);
  assert.ok(k.lostT >= HARP_HOLD - 0.01 && !k.target, 'listening');
  k.lostT = 0;
  d.interact(h.x, FY, h.z, BLOCKS[B.hh_harp]);
  assert.equal(k.lostT, 0, 'the strings still trembling');
});

test('the changeling snatches something from your pack and runs for a door; struck down, it drops it', () => {
  const { game, input, d, p, x0, z0 } = inHill();
  const a = { x: x0 + 13, z: z0 - 3, front: { x: x0 + 13, z: z0 - 2 }, room: 0, to: 1 };
  const c = { x: x0 + 1, z: z0 - 3, front: { x: x0 + 1, z: z0 - 2 }, room: 0, to: 0 };
  for (const q of [a, c]) for (const y of [FY, FY + 1]) game.world.setBlock(q.x, y, q.z, B.hh_hilldoor);
  d.data.hilldoors = [a, c];
  p.inv[(p.selected + 1) % p.inv.length] = { item: 'heather_bread', count: 4 };
  p.teleport(x0 + 7, FY, z0 + 2);
  const ch = d.spawn('changeling', p.x + 1, FY, p.z, { peaceful: true });
  ch.dormant = 0;
  run(game, input, 0.3);
  assert.ok(ch.loot && ch.loot.n > 0, 'snatched');
  const took = ch.loot.item;
  assert.ok(ch.runTo === a, 'for the nearest door');
  p.teleport(x0 + 1, FY, z0 + 4);
  run(game, input, 4);
  assert.ok(ch.x !== x0 + 8 || ch.z !== z0 + 2, 'off');
  const drops = game.drops.length;
  game.damage(ch, 99, p);
  assert.ok(ch.dead);
  assert.ok(game.drops.slice(drops).some((q) => q.item === took), 'dropped what it took');
});

test('the witch-hare\'s hex slows and marks you; with the hob\'s luck on you it doesn\'t mark', () => {
  const { game, input, d, p, x0, z0 } = inHill();
  const h = d.spawn('witch_hare', x0 + 10, FY, z0 + 2, {});
  h.dormant = 0;
  h.hexCd = 0;
  p.teleport(x0 + 5, FY, z0 + 2);
  let marked = false;
  for (let t = 0; t < 4 && !marked; t += 0.05) {
    game.update(0.05, input);
    if (p.markT > 0) marked = true;
  }
  assert.ok(marked && p.slowT > 0, 'hexed');
  // Food left at the offering, the hob by: a gift, and its luck.
  const o = { x: x0 + 2, z: z0 - 2 };
  game.world.setBlock(o.x, FY, o.z, B.hh_offering);
  d.spawn('hob', x0 + 1, FY, z0 + 3, { peaceful: true });
  p.inv[p.selected] = { item: 'heather_bread', count: 2 };
  const drops = game.drops.length;
  d.interact(o.x, FY, o.z, BLOCKS[B.hh_offering]);
  assert.equal(p.inv[p.selected].count, 1, 'left in the bowl');
  assert.ok(game.drops.length > drops, 'a gift back');
  p.markT = 0;
  h.hexCd = 0;
  let again = false;
  for (let t = 0; t < 6; t += 0.05) {
    game.update(0.05, input);
    if (p.markT > 0) again = true;
  }
  assert.ok(!again, 'the hex slides off');
});

test('a wisp drinks a fey lantern dark; the hob lights it again', () => {
  const { game, input, d, x0, z0 } = inHill();
  const q = { x: x0 + 8, z: z0 + 1 };
  game.world.setBlock(q.x, FY, q.z, B.hh_lantern);
  game.world.setState(q.x, FY, q.z, true);
  d.data.lanterns = [q];
  d.moundT = null;
  const w = d.spawn('wisp', x0 + 9, FY, z0 + 1, {});
  w.dormant = 99;
  run(game, input, 0.2);
  w.dormant = 0;
  w.target = null;
  for (let t = 0; t < 3 && game.world.getState(q.x, FY, q.z); t += 0.05) {
    w.x = x0 + 9;
    w.z = z0 + 1;
    game.update(0.05, input);
  }
  assert.ok(!game.world.getState(q.x, FY, q.z), 'drunk dark');
  w.dead = true;
  d.spawn('hob', x0 + 3, FY, z0 + 2, { peaceful: true });
  run(game, input, 8);
  assert.ok(game.world.getState(q.x, FY, q.z), 'lit again');
});

test('the version and its step', () => {
  assert.ok(compareVersions(GAME_VERSION, '1.8.0') >= 0);
  assert.ok(stepsFor('1.7.0').some((s) => s.to === '1.8.0'));
});

test('the Hollow Hill\'s masters are painted by hand, every part in place', () => {
  assert.deepEqual(Object.keys(MOUND_BOSS_ART).sort(), ['fair_king', 'hill_sleeper']);
  for (const [k, A] of Object.entries(MOUND_BOSS_ART)) {
    assert.ok(SPECIES[k], `${k} is a species`);
    assert.ok(FORGE[k] && FORGE[k].pix, `${k} is painted`);
    assert.equal(A.size, 64);
    assert.equal(A.body.rows.length, 64, `${k} has a body`);
    for (const [n, q] of Object.entries(A.parts)) assert.ok(q.pix && q.pix.rows.length, `${k}.${n} has a picture`);
  }
  assert.ok(MOUND_BOSS_ART.fair_king.parts.blade, 'the moonlight blade');
  assert.ok(MOUND_BOSS_ART.hill_sleeper.walk, 'the hill walks');
});
