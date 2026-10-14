// Round 107: the Deep Warren made over. Its tiles and things drawn
// afresh; its floors laid out by its own architect (the Hollowfolk's delve
// with its loft and its pantry behind the dresser, the stores, the moot
// with its tiers, the old round tunnel and its stopper, the root hall, the
// mushroom garden) beside its old rooms, every one walkable, lofts and
// tiers too; what's written there made from the delve's family, its Moot
// and the town above; its new creatures drawn and at work (the gloom moth
// smothering the pods, the grub eaten by a tunneler and mending it, the
// rootbound's roots holding you); the noise of the scree and the boards;
// the hollow floor; the pantry; the stopper; and its two masters painted
// by hand.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGame, stubInput } from './helpers.mjs';
import { DungeonRun } from '../src/game/dungeon.js';
import { buildFloor, FY } from '../src/world/dungeongen.js';
import { BLOCKS, B } from '../src/world/blocks.js';
import { SPECIES } from '../src/entities/creature.js';
import { WARREN_SPECIES } from '../src/entities/warrenmobs.js';
import { WARREN_MOBS } from '../src/render/art/warren_mobs.js';
import { WARREN_SPRITES, warrenTop, warrenFront } from '../src/render/art/warren_tex.js';
import { warrenLore, FAULTS } from '../src/world/deeps/warrenlore.js';
import { WARREN_OWN } from '../src/world/deeps/warren.js';
import { wrT, restore, GIVE_AFTER } from '../src/game/warrenwork.js';
import { GAME_VERSION, compareVersions } from '../src/version.js';
import { stepsFor } from '../src/game/migrate.js';
import { WARREN_BOSS_ART } from '../src/render/art/warren_bosses.js';
import { FORGE } from '../src/render/forge.js';
import '../src/render/bossbody.js';

const rec = (s) => ({ id: `w${s}`, type: 'warren', isle: 'hollowmark', seed: 1000 + s * 31, depth: 3, level: 2, vaultFloor: 1, origin: { who: 'the First Digger', y: 1201 }, townName: 'Quillcross' });
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
        if (h === FY + 2 && at(f, f.x0 + x, FY + 1, z) !== B.wr_tier) continue;
        // (A single empty pace shut in on all four sides, behind a chest in
        // a corner, holds nothing and leads nowhere.)
        if ([[1, 0], [-1, 0], [0, 1], [0, -1]].every(([a, c]) => stand(x + a, z + c) === null) && !at(f, f.x0 + x, FY, z)) continue;
        if (!seen.has(z * P.W + x)) miss++;
      }
    }
  }
  return miss;
}

test('every floor of a Deep Warren can be walked, up onto its lofts and the moot\'s tiers and down into its pits', () => {
  for (let s = 0; s < 6; s++) for (let n = 0; n < 3; n++) assert.equal(reach(buildFloor(rec(s), n)), 0, `seed ${s} floor ${n}`);
});

test('a floor of a Deep Warren is laid out as one: its pods, its hollow floor, its pantries, its stoppers, its tiers', () => {
  const kits = new Set();
  const n0 = { pods: 0, cracks: 0, pantries: 0, stoppers: 0 };
  let moths = 0;
  let grubs = 0;
  let rootbound = 0;
  let tiers = 0;
  let loud = 0;
  for (let s = 0; s < 6; s++) {
    for (let n = 0; n < 3; n++) {
      const f = buildFloor(rec(s), n);
      for (const r of f.rooms) kits.add(r.kit);
      for (const q of f.pods || []) assert.equal(at(f, q.x, FY, q.z), B.wr_pod);
      for (const q of f.cracks || []) assert.equal(at(f, q.x, FY - 1, q.z), B.wr_cracked);
      for (const p of f.pantries || []) {
        assert.equal(at(f, p.door.x, FY, p.door.z), B.wr_smalldoor);
        assert.equal(at(f, p.dresser.x, FY, p.dresser.z), B.wr_dresser, 'the dresser across it');
        assert.equal(Math.abs(p.door.x - p.dresser.x) + Math.abs(p.door.z - p.dresser.z), 1);
      }
      for (const q of f.stoppers || []) assert.equal(at(f, q.x, FY, q.z), B.wr_stopper);
      for (const k of Object.keys(n0)) n0[k] += (f[k] || []).length;
      moths += f.spawns.filter((q) => q.species === 'gloom_moth').length;
      grubs += f.spawns.filter((q) => q.species === 'larder_grub').length;
      rootbound += f.spawns.filter((q) => q.species === 'rootbound').length;
      for (let z = 0; z < f.plan.D; z++) {
        for (let x = 0; x < f.plan.W; x++) {
          const id = at(f, f.x0 + x, FY - 1, z);
          if (id === B.wr_scree || id === B.wr_boards) loud++;
          if (at(f, f.x0 + x, FY, z) === B.wr_tier) tiers++;
        }
      }
      if (n === 0) assert.ok(f.rooms.some((r) => r.kit === 'delve'), 'the delve on the first floor');
    }
  }
  for (const k of WARREN_OWN) assert.ok(kits.has(k), `the ${k}`);
  for (const [k, v] of Object.entries(n0)) assert.ok(v > 3, `${k}: ${v}`);
  assert.ok(moths > 10 && grubs > 10 && rootbound > 10 && tiers > 50 && loud > 200, `${moths} ${grubs} ${rootbound} ${tiers} ${loud}`);
});

test('what\'s written in a Deep Warren is its family\'s, its Moot\'s and its town\'s, and the same each time', () => {
  const a = warrenLore(rec(1), 0, 'first_digger');
  const b = warrenLore(rec(1), 0, 'first_digger');
  for (const k of ['diary', 'moot', 'larder', 'rounds', 'recipe', 'drawing', 'letter', 'prayer', 'dead', 'bones', 'story', 'last']) {
    const t = a[k]();
    assert.deepEqual(t, b[k](), k);
    assert.ok(t.title && t.lines.length >= 1 && t.lines.every((l) => typeof l === 'string' && l.length > 3), k);
  }
  assert.ok(a.diary().title.includes(a.family) && /dresser/.test(a.diary().lines.join(' ')), 'the diary tells where the jam is');
  assert.ok(a.moot().lines.join(' ').includes('Quillcross'));
  assert.ok(a.story().lines.includes(FAULTS[a.fault].why), 'what went wrong');
  assert.ok(a.last().title.includes('First Digger'));
  const titles = new Set();
  for (let s = 1; s <= 4; s++) for (let n = 0; n < 3; n++) for (const l of buildFloor(rec(s), n).lore) titles.add(l.title);
  for (const t of ['The Moot-Book', 'The Lamplighter\'s Rounds', 'Cave-Root Stew', 'Old Bones', 'Scratched in the Old Cell', 'A Drawing']) assert.ok(titles.has(t), t);
});

test('the Deep Warren\'s tiles and things are drawn; its new creatures are in the game and drawn', () => {
  for (const n of ['wr_loam', 'wr_floor', 'wr_moss', 'wr_scree', 'wr_boards', 'wr_rug', 'wr_cracked', 'wr_bed', 'wr_roots', 'wr_pitbed', 'wr_tier']) assert.ok(warrenTop(n, 0), `${n} top`);
  for (const n of ['wr_loam', 'wr_wattle', 'wr_door', 'wr_smalldoor', 'wr_shelf', 'wr_hearth', 'wr_rings', 'wr_stopper', 'wr_glow', 'wr_tier', 'wr_pitbed']) assert.ok(warrenFront(n, 0), `${n} front`);
  for (const [k, fn] of Object.entries(WARREN_SPRITES)) {
    assert.ok(BLOCKS[B[k]], `${k} is a block`);
    for (const st of [false, true]) assert.ok(fn(0, st, 0), `${k} drawn`);
  }
  for (const sp of Object.keys(WARREN_SPECIES)) {
    assert.ok(SPECIES[sp], `${sp} is a species`);
    assert.ok(WARREN_MOBS[sp] && WARREN_MOBS[sp].rows.length === 24, `${sp} is drawn`);
  }
});

// ------------------------------------------------------- in the warren
function inWarren() {
  const game = makeGame(12345);
  const input = stubInput();
  game.minute = 600;
  for (let i = 0; i < 20; i++) game.update(0.1, input);
  // (The warren's over the sea, on Hollowmark: a dungeon at home made one
  // for the test.)
  const base = game.sim.dungeons.all.find((q) => q.type === 'crypt');
  const r = { ...base, type: 'warren', isle: 'hollowmark', floors: {}, cleared: false, pack: null, weakened: 0 };
  new DungeonRun(game, r).enter();
  const d = game.dungeon;
  for (const c of game.creatures) {
    c.dead = true;
    game.removeOcc(c);
  }
  game.creatures = [];
  game.cheats = { ...(game.cheats || {}), god: false };
  for (const k of ['pods', 'cracks', 'pantries', 'stoppers']) d.data[k] = [];
  // A clear hall, 15 by 8, about the way in, its wall of loam north of it.
  const e = d.data.rooms.find((q) => q.kit === 'entry');
  const x0 = d.data.x0 + e.cx - 7;
  const z0 = e.cz - 2;
  for (let z = z0 - 2; z <= z0 + 5; z++) {
    for (let x = x0 - 1; x <= x0 + 15; x++) {
      for (const y of [FY, FY + 1, FY + 2]) game.world.setBlock(x, y, z, B.air);
      game.world.setBlock(x, FY - 1, z, B.wr_moss);
      game.world.setBlock(x, FY - 2, z, B.wr_loam);
    }
  }
  for (let x = x0 - 1; x <= x0 + 15; x++) for (const y of [FY, FY + 1]) game.world.setBlock(x, y, z0 - 3, B.wr_loam);
  const p = game.player;
  p.teleport(x0, FY, z0 + 4);
  p.hp = p.maxHp = 200;
  d.warrenT = null;
  return { game, input, d, p, x0, z0 };
}
const run = (game, input, secs) => {
  for (let t = 0; t < secs; t += 0.05) game.update(0.05, input);
};

test('the scree is loud underfoot: the sleeping tunnelers hear it and come; the moss is quiet', () => {
  const { game, input, d, p, x0, z0 } = inWarren();
  const t = d.spawn('tunneler', x0 + 8, FY, z0 + 1, { dormant: 2 });
  // Walking the moss: nothing.
  for (let x = x0 + 1; x <= x0 + 4; x++) {
    p.teleport(x, FY, z0 + 4);
    run(game, input, 0.2);
  }
  assert.ok(t.dormant, 'still asleep');
  // Onto the scree.
  for (let x = x0 + 1; x <= x0 + 4; x++) game.world.setBlock(x, FY - 1, z0 + 3, B.wr_scree);
  p.teleport(x0 + 1, FY, z0 + 3);
  run(game, input, 0.2);
  p.teleport(x0 + 2, FY, z0 + 3);
  run(game, input, 0.2);
  assert.ok(!t.dormant && t.target === p, 'it heard, and comes');
  assert.ok(wrT(d).told.loud);
});

test('a gloom moth flies to a lit pod and smothers it; rubbed, the pod glows again', () => {
  const { game, input, d, x0, z0 } = inWarren();
  const q = { x: x0 + 9, z: z0 + 1 };
  game.world.setBlock(q.x, FY, q.z, B.wr_pod, 0);
  game.world.setState(q.x, FY, q.z, true);
  d.data.pods = [{ ...q, room: 0 }];
  const m = d.spawn('gloom_moth', x0 + 5, FY, z0 + 1, {});
  run(game, input, 6);
  assert.ok(!game.world.getState(q.x, FY, q.z), 'gone dark under it');
  d.interact(q.x, FY, q.z, BLOCKS[B.wr_pod]);
  assert.ok(game.world.getState(q.x, FY, q.z), 'glowing again');
  // Struck, it bursts: its dust over whoever's by it.
  const p = game.player;
  p.teleport(m.x + 1, FY, m.z);
  game.damage(m, 99, p);
  assert.ok(m.dead);
});

test('a tunneler that comes by a larder grub stops and eats it, and is mended', () => {
  const { game, input, d, x0, z0 } = inWarren();
  const g = d.spawn('larder_grub', x0 + 8, FY, z0 + 2, { peaceful: true });
  const t = d.spawn('tunneler', x0 + 9, FY, z0 + 2, {});
  t.dormant = 0;
  t.hp = 3;
  run(game, input, 0.3);
  assert.ok(g.dead, 'eaten');
  assert.equal(t.hp, t.maxHp, 'mended');
  assert.ok(t.feedT > 0, 'busy at it');
});

test('the rootbound\'s roots come up where you stand and hold you fast', () => {
  const { game, input, d, p, x0, z0 } = inWarren();
  const rb = d.spawn('rootbound', x0 + 8, FY, z0 + 2, {});
  rb.dormant = 0;
  rb.rootCd = 0;
  p.teleport(x0 + 4, FY, z0 + 2);
  let held = false;
  for (let t = 0; t < 3 && !held; t += 0.05) {
    game.update(0.05, input);
    if (p.rootT > 0) held = true;
  }
  assert.ok(held, 'held fast');
});

test('cracked earth gives way under you a moment after you step on it, into the pit; it stays fallen', () => {
  const { game, input, d, p, x0, z0 } = inWarren();
  const q = { x: x0 + 6, z: z0 + 2, room: 0, cache: true };
  game.world.setBlock(q.x, FY - 1, q.z, B.wr_cracked);
  d.data.cracks = [q];
  p.teleport(q.x, FY, q.z);
  const hp = p.hp;
  const drops = game.drops.length;
  run(game, input, GIVE_AFTER + 0.3);
  assert.equal(p.y, FY - 1, 'down in the pit');
  assert.ok(p.hp < hp, 'hurt');
  assert.equal(game.world.getBlock(q.x, FY - 2, q.z), B.wr_pitbed);
  assert.ok(game.drops.length > drops, 'what the old diggers left');
  game.world.setBlock(q.x, FY - 1, q.z, B.wr_cracked);
  restore(d);
  assert.equal(game.world.getBlock(q.x, FY - 1, q.z), B.air, 'still fallen');
});

test('the dresser pushed along the wall shows the pantry\'s little door; it opens; it stays so', () => {
  const { game, d, x0, z0 } = inWarren();
  const door = { x: x0 + 5, z: z0 - 3 };
  const dresser = { x: x0 + 5, z: z0 - 2 };
  for (const y of [FY, FY + 1]) game.world.setBlock(door.x, y, door.z, B.wr_smalldoor);
  game.world.setBlock(dresser.x, FY, dresser.z, B.wr_dresser);
  d.data.pantries = [{ door, dresser, dir: { x: 0, z: -1 }, room: 0 }];
  d.interact(door.x, FY, door.z, BLOCKS[B.wr_smalldoor]);
  assert.equal(game.world.getBlock(door.x, FY, door.z), B.wr_smalldoor, 'not with the dresser in front');
  d.interact(dresser.x, FY, dresser.z, BLOCKS[B.wr_dresser]);
  assert.equal(game.world.getBlock(dresser.x, FY, dresser.z), B.air, 'pushed along');
  assert.ok([x0 + 4, x0 + 6].some((x) => game.world.getBlock(x, FY, dresser.z) === B.wr_dresser));
  d.interact(door.x, FY, door.z, BLOCKS[B.wr_smalldoor]);
  assert.equal(game.world.getBlock(door.x, FY, door.z), B.air, 'open');
  for (const y of [FY, FY + 1]) game.world.setBlock(door.x, y, door.z, B.wr_smalldoor);
  for (const x of [x0 + 4, x0 + 6]) game.world.setBlock(x, FY, dresser.z, B.air);
  game.world.setBlock(dresser.x, FY, dresser.z, B.wr_dresser);
  restore(d);
  assert.equal(game.world.getBlock(door.x, FY, door.z), B.air, 'still open');
  assert.equal(game.world.getBlock(dresser.x, FY, dresser.z), B.air, 'still pushed along');
});

test('the stopper: its warning read first, then dug out; everything under the floor hears', () => {
  const { game, d, x0, z0 } = inWarren();
  const q = { x: x0 + 7, z: z0 - 3 };
  for (const y of [FY, FY + 1]) game.world.setBlock(q.x, y, q.z, B.wr_stopper);
  d.data.stoppers = [{ ...q, room: 0 }];
  const t = d.spawn('tunneler', x0 + 12, FY, z0 + 2, { dormant: 2 });
  d.interact(q.x, FY, q.z, BLOCKS[B.wr_stopper]);
  assert.equal(game.world.getBlock(q.x, FY, q.z), B.wr_stopper, 'the warning first');
  d.interact(q.x, FY, q.z, BLOCKS[B.wr_stopper]);
  assert.equal(game.world.getBlock(q.x, FY, q.z), B.air, 'dug out');
  assert.ok(!t.dormant, 'heard');
  for (const y of [FY, FY + 1]) game.world.setBlock(q.x, y, q.z, B.wr_stopper);
  restore(d);
  assert.equal(game.world.getBlock(q.x, FY, q.z), B.air, 'still open');
});

test('the version and its step', () => {
  assert.ok(compareVersions(GAME_VERSION, '1.7.0') >= 0);
  assert.ok(stepsFor('1.6.0').some((s) => s.to === '1.7.0'));
});

test('the Deep Warren\'s masters are painted by hand, every part in place', () => {
  assert.deepEqual(Object.keys(WARREN_BOSS_ART).sort(), ['first_digger', 'thing_below']);
  for (const [k, A] of Object.entries(WARREN_BOSS_ART)) {
    assert.ok(SPECIES[k], `${k} is a species`);
    assert.ok(FORGE[k] && FORGE[k].pix, `${k} is painted`);
    assert.equal(A.size, 64);
    assert.equal(A.body.rows.length, 64, `${k} has a body`);
    for (const [n, q] of Object.entries(A.parts)) assert.ok(q.pix && q.pix.rows.length, `${k}.${n} has a picture`);
  }
  assert.ok(WARREN_BOSS_ART.first_digger.walk, 'the digger walks');
  assert.ok(WARREN_BOSS_ART.thing_below.idle, 'the thing breathes');
});
