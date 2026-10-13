// Round 106: the Salt Cathedral made over. Its tiles and things drawn
// afresh; its floors laid out by its own architect (the chapel with its
// dais and pews and chandeliers, the brine lake with its walkway, its
// treadwheel and its flooded arch, the workings with their gallery up salt
// stairs, the shaft with its loft, the pans, the singing hall with its
// bricked chapel) beside its old rooms, every one walkable; what's written
// there made from its saint, its miners and the town above; its new
// creatures drawn and at work (the raker dragging you in, the bloom
// growing crystal, the flamingos taking fright); the brine (crusting you
// fast, mending the salt dead); the chandeliers; the singing crystals; the
// sluice; the bricked chapel; and its two masters painted by hand.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGame, stubInput } from './helpers.mjs';
import { DungeonRun } from '../src/game/dungeon.js';
import { buildFloor, FY } from '../src/world/dungeongen.js';
import { BLOCKS, B } from '../src/world/blocks.js';
import { ITEMS } from '../src/world/items.js';
import { SPECIES } from '../src/entities/creature.js';
import { SALT_SPECIES } from '../src/entities/saltmobs.js';
import { SALT_MOBS } from '../src/render/art/salt_mobs.js';
import { SALT_SPRITES, saltTop, saltFront } from '../src/render/art/salt_tex.js';
import { saltIcon } from '../src/render/art/salt_items.js';
import { saltLore, FAULTS } from '../src/world/deeps/saltlore.js';
import { SALT_OWN } from '../src/world/deeps/saltworks.js';
import { swT, restore, SET_AFTER } from '../src/game/saltwork.js';
import { GAME_VERSION, compareVersions } from '../src/version.js';
import { stepsFor } from '../src/game/migrate.js';
import { SALT_BOSS_ART } from '../src/render/art/salt_bosses.js';
import { FORGE } from '../src/render/forge.js';
import '../src/render/bossbody.js';

const rec = (s) => ({ id: `s${s}`, type: 'saltworks', isle: 'saltmere', seed: 1000 + s * 31, depth: 3, level: 2, vaultFloor: 1, origin: { who: 'the Salt Mother', y: 1201 }, townName: 'Quillcross' });
const at = (f, x, y, z) => {
  const r = f.regions.get(Math.floor(x / 64) * 4096 + Math.floor(z / 36));
  return r ? r.get(x % 64, y, z % 36) : 0;
};
const PASS = new Set(['sealed', 'portcullis', 'boss_gate']);
// Every tile you can walk to from the way in: a step up or down at a time,
// or up a ladder. (Things set on the floor aren't tiles to walk to.)
function reach(f) {
  const P = f.plan;
  const solid = (x, y, z) => {
    const b = BLOCKS[at(f, f.x0 + x, y, z)];
    return !!(b && b.solid && !PASS.has(b.interact));
  };
  const prop = (x, y, z) => (BLOCKS[at(f, f.x0 + x, y, z)] || {}).render === 'sprite';
  const ladder = (x, y, z) => !!(BLOCKS[at(f, f.x0 + x, y, z)] || {}).ladder;
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
        // (Its own galleries and lofts too, up their stairs and ladders; not
        // the tops of pillars.)
        const h = stand(x, z);
        if (h === null) continue;
        if (h === FY + 2 && ![B.sw_step, B.sw_crib].includes(at(f, f.x0 + x, FY + 1, z))) continue;
        if (!seen.has(z * P.W + x)) miss++;
      }
    }
  }
  return miss;
}

test('every floor of a Salt Cathedral can be walked, down into its brine and up its stairs and ladders', () => {
  for (let s = 0; s < 6; s++) for (let n = 0; n < 3; n++) assert.equal(reach(buildFloor(rec(s), n)), 0, `seed ${s} floor ${n}`);
});

test('a floor of a Salt Cathedral is laid out as one: its brine, its chandeliers, its crystals, its sluice, its bricks', () => {
  const kits = new Set();
  const n0 = { brine: 0, lake: 0, chandeliers: 0, singers: 0, wheels: 0, arches: 0, bricks: 0 };
  let rakers = 0;
  let blooms = 0;
  let flamingos = 0;
  for (let s = 0; s < 6; s++) {
    for (let n = 0; n < 3; n++) {
      const f = buildFloor(rec(s), n);
      for (const r of f.rooms) kits.add(r.kit);
      for (const q of [...(f.brine || []), ...(f.lake || [])]) {
        assert.equal(at(f, q.x, FY - 2, q.z), B.sw_brine);
        assert.equal(at(f, q.x, FY - 1, q.z), B.air, 'sunk');
      }
      for (const c of f.chandeliers || []) {
        assert.equal(at(f, c.x, FY, c.z), B.sw_chandelier);
        assert.equal(at(f, c.cleat.x, FY, c.cleat.z), B.sw_cleat, 'its rope tied off');
      }
      for (const q of f.singers || []) assert.equal(at(f, q.x, FY, q.z), B.sw_singer);
      for (const q of f.wheels || []) assert.equal(at(f, q.x, FY, q.z), B.sw_wheel);
      for (const q of f.arches || []) assert.equal(at(f, q.x, FY, q.z), B.sw_flooded);
      for (const q of f.bricks || []) assert.equal(at(f, q.x, FY, q.z), B.sw_bricked);
      // (A lake's treadwheel wherever there's a flooded arch.)
      if ((f.arches || []).length) assert.ok((f.wheels || []).some((w) => w.lake), 'the treadwheel by the lake');
      for (const k of Object.keys(n0)) n0[k] += (f[k] || []).length;
      rakers += f.spawns.filter((q) => q.species === 'salt_raker').length;
      blooms += f.spawns.filter((q) => q.species === 'salt_bloom').length;
      flamingos += f.spawns.filter((q) => q.species === 'pale_flamingo').length;
      if (n === 0) assert.ok(f.rooms.some((r) => r.kit === 'chapel'), 'the chapel on the first floor');
    }
  }
  for (const k of SALT_OWN) assert.ok(kits.has(k), `the ${k}`);
  for (const [k, v] of Object.entries(n0)) assert.ok(v > 3, `${k}: ${v}`);
  assert.ok(rakers > 20 && blooms > 10 && flamingos > 6, `${rakers} ${blooms} ${flamingos}`);
});

test('what\'s written in a Salt Cathedral is its saint\'s, its miners\' and its town\'s, and the same each time', () => {
  const a = saltLore(rec(1), 0, 'salt_mother');
  const b = saltLore(rec(1), 0, 'salt_mother');
  for (const k of ['hymn', 'tally', 'decree', 'reeve', 'votive', 'letter', 'carving', 'prayer', 'dead', 'last', 'story']) {
    const t = a[k]();
    assert.deepEqual(t, b[k](), k);
    assert.ok(t.title && t.lines.length >= 1 && t.lines.every((l) => typeof l === 'string' && l.length > 3), k);
  }
  assert.ok(a.hymn().lines.join(' ').includes('Quillcross'));
  assert.ok(/brick/i.test(a.tally().lines.join(' ')), 'where the bricked chapel is');
  assert.ok(/treadwheel/.test(a.reeve().lines.join(' ')) && /arch/.test(a.reeve().lines.join(' ')), 'the sluice told');
  assert.ok(a.last().title.includes('Salt Mother'));
  assert.ok(a.story().lines.includes(FAULTS[a.fault].why), 'what went wrong');
  const titles = new Set();
  for (let s = 1; s <= 4; s++) for (let n = 0; n < 3; n++) for (const l of buildFloor(rec(s), n).lore) titles.add(l.title);
  for (const t of ['The Miners\' Hymn', 'The Tally-Book', 'The Brine-Reeve\'s Notes', 'Decree of the Salt Office', 'Cut in the Plinth', 'A Miner']) assert.ok(titles.has(t), t);
});

test('the Salt Cathedral\'s tiles and things are drawn; its new creatures are in the game and drawn; a Mother\'s Tear is a thing', () => {
  for (const n of ['sw_rock', 'sw_floor', 'sw_slabs', 'sw_crust', 'sw_brine', 'sw_planks', 'sw_crystalfloor', 'sw_brick', 'sw_wetbed', 'sw_step', 'sw_crib']) assert.ok(saltTop(n, 0), `${n} top`);
  for (const n of ['sw_rock', 'sw_relief', 'sw_crib', 'sw_niche', 'sw_bricked', 'sw_cleat', 'sw_vein', 'sw_seep', 'sw_tally', 'sw_sluice', 'sw_flooded', 'sw_step', 'sw_brine', 'sw_floor']) assert.ok(saltFront(n, 0), `${n} front`);
  for (const [k, fn] of Object.entries(SALT_SPRITES)) {
    assert.ok(BLOCKS[B[k]], `${k} is a block`);
    for (const st of [false, true]) assert.ok(fn(0, st, 0), `${k} drawn`);
  }
  for (const sp of Object.keys(SALT_SPECIES)) {
    assert.ok(SPECIES[sp], `${sp} is a species`);
    assert.ok(SALT_MOBS[sp] && SALT_MOBS[sp].rows.length === 24, `${sp} is drawn`);
  }
  assert.ok(ITEMS.mothers_tear && ITEMS.mothers_tear.value > 30 && saltIcon('mothers_tear'), 'a Mother\'s Tear');
});

// ------------------------------------------------------- in the cathedral
function inSalt() {
  const game = makeGame(12345);
  const input = stubInput();
  game.minute = 600;
  for (let i = 0; i < 20; i++) game.update(0.1, input);
  // (The cathedral's over the sea, on Saltmere: a dungeon at home made one
  // for the test.)
  const base = game.sim.dungeons.all.find((q) => q.type === 'crypt');
  const r = { ...base, type: 'saltworks', isle: 'saltmere', floors: {}, cleared: false, pack: null, weakened: 0 };
  new DungeonRun(game, r).enter();
  const d = game.dungeon;
  for (const c of game.creatures) {
    c.dead = true;
    game.removeOcc(c);
  }
  game.creatures = [];
  game.cheats = { ...(game.cheats || {}), god: false };
  for (const k of ['brine', 'lake', 'chandeliers', 'singers', 'wheels', 'arches', 'bricks']) d.data[k] = [];
  // A clear hall, 15 by 8, about the way in, its wall of rock north of it.
  const e = d.data.rooms.find((q) => q.kit === 'entry');
  const x0 = d.data.x0 + e.cx - 7;
  const z0 = e.cz - 2;
  for (let z = z0 - 2; z <= z0 + 5; z++) {
    for (let x = x0 - 1; x <= x0 + 15; x++) {
      for (const y of [FY, FY + 1, FY + 2]) game.world.setBlock(x, y, z, B.air);
      game.world.setBlock(x, FY - 1, z, B.sw_floor);
      game.world.setBlock(x, FY - 2, z, B.sw_rock);
    }
  }
  for (let x = x0 - 1; x <= x0 + 15; x++) for (const y of [FY, FY + 1]) game.world.setBlock(x, y, z0 - 3, B.sw_rock);
  const p = game.player;
  p.teleport(x0, FY, z0 + 4);
  p.hp = p.maxHp = 200;
  d.saltT = null;
  return { game, input, d, p, x0, z0 };
}
const run = (game, input, secs) => {
  for (let t = 0; t < secs; t += 0.05) game.update(0.05, input);
};
// A pit of brine at (x, z), sunk.
function brine(game, d, x, z, list = 'brine') {
  game.world.setBlock(x, FY - 1, z, B.air);
  game.world.setBlock(x, FY - 2, z, B.sw_brine);
  d.data[list].push({ x, z });
}

test('wading the brine, the salt crusts on you and sets you fast; a salt wight mends in it; the scorpion minds none of it', () => {
  const { game, input, d, p, x0, z0 } = inSalt();
  for (let x = x0 + 2; x <= x0 + 9; x++) brine(game, d, x, z0 + 2);
  p.teleport(x0 + 3, FY - 1, z0 + 2);
  run(game, input, 1);
  assert.ok(p.crust > 0.5 && p.slowT > 0, 'crusting');
  run(game, input, SET_AFTER);
  assert.ok(p.rootT > 0 || p.crust < SET_AFTER, 'set fast');
  // Out of it, the crust flakes off.
  p.teleport(x0 + 3, FY, z0 + 4);
  p.rootT = 0;
  p.crust = 2;
  run(game, input, 2);
  assert.ok(p.crust < 1.2, 'flaking off');
  const w = d.spawn('salt_wight', x0 + 8, FY - 1, z0 + 2, {});
  w.dormant = 99;
  w.hp = 5;
  const sc = d.spawn('brine_scorpion', x0 + 6, FY - 1, z0 + 2, {});
  sc.dormant = 99;
  run(game, input, 3);
  assert.ok(w.hp > 5, 'the brine mends it');
  assert.ok(!(sc.crust > 0), 'the scorpion\'s shell doesn\'t mind');
});

test('the salt raker\'s rake reaches two paces and drags you in', () => {
  const { game, input, d, p, x0, z0 } = inSalt();
  const r = d.spawn('salt_raker', x0 + 7, FY, z0 + 2, {});
  r.dormant = 0;
  p.teleport(x0 + 3, FY, z0 + 2);
  const hp = p.hp;
  // (Pulled: a pace nearer it, without stepping, while it stands.)
  let pulled = false;
  let prev = { px: p.x, rx: r.x };
  for (let t = 0; t < 5 && !pulled; t += 0.05) {
    game.update(0.05, input);
    if (r.x === prev.rx && p.x === prev.px + 1 && r.x - p.x >= 1 && !p.moving) pulled = true;
    prev = { px: p.x, rx: r.x };
  }
  assert.ok(p.hp < hp, 'raked');
  assert.ok(pulled, 'dragged a pace toward it');
});

test('a salt bloom grows crystal about it, and its growth crumbles when it\'s broken', () => {
  const { game, input, d, p, x0, z0 } = inSalt();
  const b = d.spawn('salt_bloom', x0 + 8, FY, z0 + 2, {});
  b.dormant = 0;
  p.teleport(x0 + 3, FY, z0 + 4);
  run(game, input, 12);
  assert.ok(b.grown.length >= 2, `grown ${b.grown.length}`);
  for (const g of b.grown) assert.equal(game.world.getBlock(g.x, g.y, g.z), B.sw_growth);
  const grown = b.grown.slice();
  game.damage(b, 99, p);
  assert.ok(b.dead);
  for (const g of grown) assert.equal(game.world.getBlock(g.x, g.y, g.z), B.air, 'crumbled');
});

test('the flamingos take fright when you come near, and everything near wakes', () => {
  const { game, input, d, p, x0, z0 } = inSalt();
  const f1 = d.spawn('pale_flamingo', x0 + 10, FY, z0 + 2, { peaceful: true });
  const f2 = d.spawn('pale_flamingo', x0 + 11, FY, z0 + 3, { peaceful: true });
  const w = d.spawn('salt_wight', x0 + 13, FY, z0 + 1, { dormant: 2 });
  for (const f of [f1, f2]) f.dormant = 0;
  run(game, input, 0.5);
  assert.ok(!f1.fled && w.dormant, 'still, all of them');
  p.teleport(x0 + 8, FY, z0 + 2);
  run(game, input, 0.5);
  assert.ok(f1.fled && f2.fled, 'the flock takes fright');
  assert.ok(!w.dormant, 'and the wight wakes');
});

test('a chandelier comes down when its rope\'s slipped, on whatever\'s under it; it stays down', () => {
  const { game, d, x0, z0 } = inSalt();
  const c = { x: x0 + 7, z: z0 + 2, cleat: { x: x0 + 7, z: z0 - 3 }, room: 0 };
  game.world.setBlock(c.x, FY, c.z, B.sw_chandelier);
  for (const y of [FY, FY + 1]) game.world.setBlock(c.cleat.x, y, c.cleat.z, B.sw_cleat);
  d.data.chandeliers = [c];
  const w = d.spawn('salt_wight', c.x + 1, FY, c.z, {});
  w.dormant = 99;
  const hp = w.hp;
  d.interact(c.cleat.x, FY, c.cleat.z, BLOCKS[B.sw_cleat]);
  assert.equal(game.world.getBlock(c.x, FY, c.z), B.sw_shards, 'down');
  assert.ok(w.hp < hp && w.stunT > 0, 'on the wight under it');
  game.world.setBlock(c.x, FY, c.z, B.sw_chandelier);
  restore(d);
  assert.equal(game.world.getBlock(c.x, FY, c.z), B.sw_shards, 'still down');
});

test('a singing crystal rings: the salt dead shake still, the growth shatters, and everything near wakes', () => {
  const { game, d, p, x0, z0 } = inSalt();
  const s = { x: x0 + 7, z: z0 + 1 };
  game.world.setBlock(s.x, FY, s.z, B.sw_singer);
  d.data.singers = [{ ...s, room: 0 }];
  game.world.setBlock(s.x + 2, FY, s.z + 1, B.sw_growth);
  const w = d.spawn('salt_wight', s.x + 3, FY, s.z, {});
  w.dormant = 0;
  const far = d.spawn('brine_scorpion', s.x + 6, FY, s.z + 3, { dormant: 2 });
  p.teleport(s.x, FY, s.z + 2);
  d.interact(s.x, FY, s.z, BLOCKS[B.sw_singer]);
  assert.ok(w.stunT > 1, 'shaken still');
  assert.equal(game.world.getBlock(s.x + 2, FY, s.z + 1), B.air, 'the growth shattered');
  assert.ok(!far.dormant, 'heard');
  assert.ok(swT(d).rang[`${s.x},${s.z}`] > 0, 'it won\'t ring again yet');
});

test('the treadwheel opens the sluice: the lake drains, the flooded arch comes clear, the drowned get up; it stays drained', () => {
  const { game, d, x0, z0 } = inSalt();
  for (let x = x0 + 4; x <= x0 + 12; x++) for (const z of [z0 + 2, z0 + 3]) brine(game, d, x, z, 'lake');
  const wh = { x: x0 + 1, z: z0, room: 0, lake: true };
  game.world.setBlock(wh.x, FY, wh.z, B.sw_wheel);
  d.data.wheels = [wh];
  const a = { x: x0 + 13, z: z0 - 3, room: 0 };
  for (const y of [FY, FY + 1]) game.world.setBlock(a.x, y, a.z, B.sw_flooded);
  d.data.arches = [a];
  const n0 = game.creatures.length;
  d.interact(wh.x, FY, wh.z, BLOCKS[B.sw_wheel]);
  assert.ok(d.data.lake.every((q) => game.world.getBlock(q.x, FY - 2, q.z) === B.sw_wetbed), 'drained');
  assert.equal(game.world.getBlock(a.x, FY, a.z), B.air, 'the arch clear');
  assert.ok(game.creatures.filter((c) => c.species === 'salt_wight').length >= 2 && game.creatures.length > n0, 'the drowned get up');
  for (const q of d.data.lake) game.world.setBlock(q.x, FY - 2, q.z, B.sw_brine);
  for (const y of [FY, FY + 1]) game.world.setBlock(a.x, y, a.z, B.sw_flooded);
  restore(d);
  assert.equal(game.world.getBlock(a.x, FY, a.z), B.air, 'still clear');
  assert.equal(game.world.getBlock(x0 + 5, FY - 2, z0 + 2), B.sw_wetbed, 'still drained');
});

test('the bricked chapel struck down stays open', () => {
  const { game, d, x0, z0 } = inSalt();
  const q = { x: x0 + 4, z: z0 - 3 };
  for (const y of [FY, FY + 1]) game.world.setBlock(q.x, y, q.z, B.sw_bricked);
  d.data.bricks = [{ ...q, room: 0 }];
  d.interact(q.x, FY, q.z, BLOCKS[B.sw_bricked]);
  assert.equal(game.world.getBlock(q.x, FY, q.z), B.air);
  for (const y of [FY, FY + 1]) game.world.setBlock(q.x, y, q.z, B.sw_bricked);
  restore(d);
  assert.equal(game.world.getBlock(q.x, FY, q.z), B.air, 'still open');
});

test('a place\'s own ladders are kept when its floor is finished: the gut\'s rope ladders up to the whalers\' ledges', () => {
  let ribs = 0;
  let ladders = 0;
  let lofts = 0;
  for (let s = 0; s < 6; s++) {
    for (let n = 0; n < 3; n++) {
      const g = buildFloor({ ...rec(s), type: 'gut', isle: 'corrow' }, n);
      const sw = buildFloor(rec(s), n);
      for (let z = 0; z < g.plan.D; z++) for (let x = 0; x < g.plan.W; x++) if (at(g, g.x0 + x, FY, z) === B.lv_ladder) ladders++;
      for (let z = 0; z < sw.plan.D; z++) for (let x = 0; x < sw.plan.W; x++) if (at(sw, sw.x0 + x, FY, z) === B.sw_ladder) lofts++;
      ribs += g.rooms.filter((r) => r.kit === 'ribs').length;
    }
  }
  assert.ok(ribs > 3 && ladders >= ribs, `${ladders} ladders, ${ribs} ribs`);
  assert.ok(lofts > 3, `${lofts} loft ladders`);
});

test('the version and its step', () => {
  assert.ok(compareVersions(GAME_VERSION, '1.6.0') >= 0);
  assert.ok(stepsFor('1.5.0').some((s) => s.to === '1.6.0'));
});

test('the Salt Cathedral\'s masters are painted by hand, every part in place', () => {
  assert.deepEqual(Object.keys(SALT_BOSS_ART).sort(), ['mirage_lion', 'salt_mother']);
  for (const [k, A] of Object.entries(SALT_BOSS_ART)) {
    assert.ok(SPECIES[k], `${k} is a species`);
    assert.ok(FORGE[k] && FORGE[k].pix, `${k} is painted`);
    assert.equal(A.size, 64);
    assert.equal(A.body.rows.length, 64, `${k} has a body`);
    for (const [n, q] of Object.entries(A.parts)) assert.ok(q.pix && q.pix.rows.length, `${k}.${n} has a picture`);
  }
  assert.ok(SALT_BOSS_ART.mirage_lion.walk, 'the lion walks');
});
