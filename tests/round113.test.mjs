// Round 113: the Gullet of the World made over. Its earth and the
// swallowed city's mudbrick and glaze, its faces and its things drawn
// afresh; its floors laid out by its own architect (the bore and its
// cracked roof, the street and its roofs up ladders, the temple's
// terraces, the canal and its sluice, the clutch, the shed, the hoard),
// a floor to each of how far down, beside its old rooms, every one
// walkable, the roofs and terraces too; what's written there made from
// its own story; its new creatures drawn and at work (the borers coming
// up under you, the clutch-mother laying and screaming, the Swallowed
// leading you, and gone if you hurt one); the tremors; the sluice; the
// god's table and his favour; the bricked-up door; and its master
// painted by hand.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGame, stubInput } from './helpers.mjs';
import { DungeonRun } from '../src/game/dungeon.js';
import { buildFloor, FY } from '../src/world/dungeongen.js';
import { BLOCKS, B } from '../src/world/blocks.js';
import { SPECIES } from '../src/entities/creature.js';
import { GULLET_SPECIES } from '../src/entities/gulletmobs.js';
import { GULLET_MOBS } from '../src/render/art/gullet_mobs.js';
import { GULLET_SPRITES, gulletTop, gulletFront } from '../src/render/art/gullet_tex.js';
import { gulletLore } from '../src/world/deeps/gulletlore.js';
import { GULLET_OWN } from '../src/world/deeps/gullet.js';
import { ANCIENT_DTYPES } from '../src/world/ancient.js';
import { glT, restore, tremor, favoured, FAVOUR, BLOWS, FALL_DMG, upheave, lay, HATCH_T } from '../src/game/gulletwork.js';
import { addItem, countItem } from '../src/game/inventory.js';
import { GAME_VERSION, compareVersions } from '../src/version.js';
import { stepsFor } from '../src/game/migrate.js';
import { GULLET_BOSS_ART, ALINELIDAN_RINGS } from '../src/render/art/gullet_bosses.js';
import { FORGE, forgePaint } from '../src/render/forge.js';
import { artState } from '../src/render/bossbody.js';

const rec = (s) => ({ id: `g${s}`, type: 'gullet', isle: 'ostria', seed: 1000 + s * 31, depth: 3, level: 4, vaultFloor: 1, origin: { who: 'the Alinelidan', y: 312 }, townName: 'Redwater' });
const at = (f, x, y, z) => {
  const r = f.regions.get(Math.floor(x / 64) * 4096 + Math.floor(z / 36));
  return r ? r.get(x % 64, y, z % 36) : 0;
};
const PASS = new Set(['sealed', 'portcullis', 'boss_gate', 'gl_bricked']);
// Every tile you can walk to from the way in, a step up or down at a time,
// or up a ladder onto a roof. (Things set on the floor aren't tiles to
// walk to.)
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
        const h = stand(x, z);
        // (The roofs, up their ladders; the temple's top; not the tops of things.)
        if (h === null || (h === FY + 2 && ![B.gl_roof, B.gl_terrace].includes(at(f, f.x0 + x, FY + 1, z)))) continue;
        if (!seen.has(z * P.W + x)) miss++;
      }
    }
  }
  return miss;
}

test('every floor of a Gullet of the World can be walked, up onto its roofs and its terraces', () => {
  for (let s = 0; s < 6; s++) for (let n = 0; n < 3; n++) assert.equal(reach(buildFloor(rec(s), n)), 0, `seed ${s} floor ${n}`);
});

test("the Gullet is its own architect's now, a floor to each of how far down", () => {
  const T = ANCIENT_DTYPES.gullet;
  assert.ok(T.arch, 'its architect');
  assert.equal(T.wall, B.gl_earth);
  for (const k of ['borer', 'clutch_mother']) assert.ok(T.mobs.some(([m]) => m === k), k);
  assert.ok(T.kept.includes('swallowed_one'));
  for (let n = 0; n < 3; n++) {
    const f = buildFloor(rec(2), n);
    const h = f.rooms.find((r) => r.kit === 'bore');
    assert.ok(h, `a bore on floor ${n}`);
    let own = 0;
    const want = n >= 2 ? B.gl_slick : B.gl_dirt;
    for (let z = h.z0; z <= h.z1; z++) for (let x = h.x0; x <= h.x1; x++) if (at(f, f.x0 + x, FY - 1, z) === want) own++;
    assert.ok(own > 10, `its floor on floor ${n}: ${own}`);
  }
});

test('a floor of the Gullet is laid out as one: the cracked roofs, the sluices, the god, the bricked doors, the clutches, the roofs and terraces', () => {
  const kits = new Set();
  const n0 = { falls: 0, sluices: 0, offerings: 0, bricks: 0, clutches: 0 };
  const sp = {};
  let roofs = 0;
  let terraces = 0;
  let mud = 0;
  for (let s = 0; s < 6; s++) {
    for (let n = 0; n < 3; n++) {
      const f = buildFloor(rec(s), n);
      for (const r of f.rooms) kits.add(r.kit);
      for (const g of f.falls || []) for (const t of g.tiles) assert.equal(at(f, t.x, FY, t.z), B.gl_grit);
      for (const q of f.sluices || []) {
        assert.equal(at(f, q.wheel.x, FY, q.wheel.z), B.gl_wheel);
        assert.ok(q.acid.length >= 9);
        for (const t of q.acid) assert.equal(at(f, t.x, FY - 1, t.z), B.acid_pool);
      }
      for (const q of f.offerings || []) assert.equal(at(f, q.x, q.y, q.z), B.gl_offering);
      for (const q of f.bricks || []) assert.equal(at(f, q.door.x, FY, q.door.z), B.gl_bricked);
      for (const g of f.clutches || []) for (const e of g.eggs) assert.equal(at(f, e.x, FY, e.z), B.gl_eggs);
      for (const k of Object.keys(n0)) n0[k] += (f[k] || []).length;
      for (const q of f.spawns) sp[q.species] = (sp[q.species] || 0) + 1;
      for (let z = 0; z < f.plan.D; z++) for (let x = 0; x < f.plan.W; x++) {
        if (at(f, f.x0 + x, FY + 1, z) === B.gl_roof) roofs++;
        if (at(f, f.x0 + x, FY, z) === B.gl_terrace) terraces++;
        if (at(f, f.x0 + x, FY, z) === B.gl_city) mud++;
      }
    }
  }
  for (const k of GULLET_OWN) assert.ok(kits.has(k), `the ${k}`);
  for (const [k, v] of Object.entries(n0)) assert.ok(v > 2, `${k}: ${v}`);
  assert.ok(roofs > 20, `roofs: ${roofs}`);
  assert.ok(terraces > 20, `terraces: ${terraces}`);
  assert.ok(mud > 100, `the city's mudbrick: ${mud}`);
  for (const k of ['gut_leech', 'acid_spitter', 'maw_larva', 'borer', 'clutch_mother', 'swallowed_one']) assert.ok(sp[k] > 2, `${k}: ${sp[k]}`);
});

test("what's written in the Gullet is its own story, the same each time", () => {
  const L = gulletLore(rec(3), 0);
  const L2 = gulletLore(rec(3), 0);
  assert.deepEqual(L.annals(), L2.annals());
  assert.equal(L.kingdom, gulletLore(rec(3), 2).kingdom, 'the same kingdom on every floor');
  assert.equal(typeof L.god, 'string', "the god's name, not overwritten");
  assert.ok(L.annals().lines.join(' ').includes(L.king));
  assert.ok(!/\d(1th|2th|3th)\b/.test(L.annals().lines.join(' ')) || /1[123]th/.test(L.annals().lines.join(' ')), 'its ordinals');
  assert.ok(L.letter().lines.join(' ').includes(L.kingdom));
  assert.ok(L.last().lines.join(' ').includes('Redwater'));
  assert.equal(gulletLore(rec(3), 2).stage, 'belly');
  for (const k of ['annals', 'tablet', 'relief', 'statue', 'letter', 'sluice', 'throne', 'last', 'hall']) {
    const e = L[k]();
    assert.ok(e.title && e.lines.length, k);
  }
  assert.ok(L.swallowed().length > 10);
});

test("the Gullet's tiles and things are drawn; its new creatures are in the game and drawn", () => {
  for (const n of ['gl_earth', 'gl_city', 'gl_frieze', 'gl_doorway', 'gl_relief', 'gl_tablet', 'gl_bricked', 'gl_cut', 'gl_etched', 'gl_terrace', 'gl_roof']) assert.ok(gulletFront(n, 0) && gulletTop(n, 0), n);
  for (const n of ['gl_dirt', 'gl_paving', 'gl_slick', 'gl_silt', 'gl_glazed', 'gl_deck']) assert.ok(gulletTop(n, 1), n);
  for (const [n, f] of Object.entries(GULLET_SPRITES)) {
    assert.ok(B[n] !== undefined, n);
    assert.ok(f(0, false, 0) && f(3, true, 1), n);
  }
  for (const k of Object.keys(GULLET_SPECIES)) assert.ok(SPECIES[k], k);
  for (const k of ['borer', 'clutch_mother', 'swallowed_one', 'gut_leech', 'acid_spitter', 'maw_larva']) {
    const A = GULLET_MOBS[k];
    assert.ok(A && A.size === 24 && A.groups.walk && A.groups.attack, k);
  }
  assert.equal(SPECIES.swallowed_one.mode, 'passive');
});

function inGullet() {
  const game = makeGame(12345);
  const input = stubInput();
  game.minute = 600;
  for (let i = 0; i < 20; i++) game.update(0.1, input);
  const base = game.sim.dungeons.all.find((q) => q.type === 'crypt');
  const r = { ...base, type: 'gullet', isle: 'ostria', floors: {}, cleared: false, pack: null, weakened: 0 };
  new DungeonRun(game, r).enter();
  const d = game.dungeon;
  for (const c of game.creatures) {
    c.dead = true;
    game.removeOcc(c);
  }
  game.creatures = [];
  game.cheats = { ...(game.cheats || {}), god: false };
  for (const k of ['falls', 'sluices', 'offerings', 'bricks', 'clutches']) d.data[k] = [];
  if (d.data.anc) for (const k of ['acid', 'leeches', 'eggs', 'quakes', 'throats']) d.data.anc[k] = [];
  // A clear hall, 15 by 8, about the way in.
  const e = d.data.rooms.find((q) => q.kit === 'entry');
  const x0 = d.data.x0 + e.cx - 7;
  const z0 = e.cz - 2;
  for (let z = z0 - 2; z <= z0 + 5; z++) {
    for (let x = x0 - 1; x <= x0 + 15; x++) {
      for (const y of [FY, FY + 1, FY + 2]) game.world.setBlock(x, y, z, B.air);
      game.world.setBlock(x, FY - 1, z, B.gl_paving);
      game.world.setBlock(x, FY - 2, z, B.gl_earth);
    }
  }
  game.zones = [];
  game.hazards = [];
  const p = game.player;
  p.teleport(x0, FY, z0 + 5);
  p.hp = p.maxHp = 200;
  d.gulletT = null;
  glT(d).quakeT = 999;
  return { game, input, d, p, x0, z0 };
}
const run = (game, input, secs) => {
  for (let t = 0; t < secs; t += 0.05) game.update(0.05, input);
};

test('the Sleeper turns: the roof comes in where it\'s cracked, on whoever\'s under it, yours or theirs', () => {
  const { game, input, d, p, x0, z0 } = inGullet();
  const tiles = [{ x: x0 + 5, z: z0 + 1 }, { x: x0 + 6, z: z0 + 1 }];
  for (const t of tiles) game.world.setBlock(t.x, FY, t.z, B.gl_grit);
  d.data.falls = [{ tiles, room: 0 }];
  p.teleport(x0 + 5, FY, z0 + 1);
  const leech = d.spawn('gut_leech', x0 + 6, FY, z0 + 1, {});
  leech.dormant = 99;
  leech.stunT = 9;
  const hp = p.hp;
  const lh = leech.hp;
  assert.ok(tremor(d) > 0);
  run(game, input, 2);
  assert.ok(p.hp <= hp - FALL_DMG + 1, `the roof on you: ${hp} -> ${p.hp}`);
  assert.ok(leech.dead || leech.hp < lh, 'and on it');
});

test('the sluice: turned, the river runs, the acid goes, and what was in it drowns (and it stays turned)', () => {
  const { game, d, x0, z0 } = inGullet();
  const w = game.world;
  const acid = [];
  for (let x = x0 + 3; x <= x0 + 10; x++) for (const z of [z0 + 1, z0 + 2]) {
    w.setBlock(x, FY - 1, z, B.acid_pool);
    acid.push({ x, z });
  }
  const wheel = { x: x0 + 2, z: z0 };
  w.setBlock(wheel.x, FY, wheel.z, B.gl_wheel);
  d.data.anc.acid = [{ tiles: [...acid], box: { x0, z0: z0 - 2, x1: x0 + 15, z1: z0 + 5 } }];
  d.data.sluices = [{ wheel, acid, room: 0 }];
  const leech = d.spawn('gut_leech', x0 + 6, FY, z0 + 1, {});
  leech.dormant = 99;
  d.interact(wheel.x, FY, wheel.z, BLOCKS[B.gl_wheel]);
  assert.ok(acid.every((t) => w.getBlock(t.x, FY - 1, t.z) === B.gl_silt), 'washed');
  assert.equal(d.data.anc.acid.length, 0, 'no acid left to burn');
  assert.ok(leech.dead, 'drowned');
  assert.ok(w.getState(wheel.x, FY, wheel.z));
  for (const t of acid) w.setBlock(t.x, FY - 1, t.z, B.acid_pool);
  restore(d);
  assert.ok(acid.every((t) => w.getBlock(t.x, FY - 1, t.z) === B.gl_silt), 'still washed');
});

test("the god's table: fed, his favour on you, and his waters can't burn you", () => {
  const { game, input, d, p, x0, z0 } = inGullet();
  const w = game.world;
  const q = { x: x0 + 2, z: z0, y: FY };
  w.setBlock(q.x, FY, q.z, B.gl_offering);
  d.data.offerings = [q];
  // Nothing to give: nothing happens.
  p.selected = p.inv.findIndex((q) => !q);
  d.interact(q.x, FY, q.z, BLOCKS[B.gl_offering]);
  assert.ok(!favoured(game, p));
  addItem(p.inv, 'bread', 2);
  const had = countItem(p.inv, 'bread');
  const slot = p.inv.findIndex((s) => s && s.item === 'bread');
  p.selected = slot;
  d.interact(q.x, FY, q.z, BLOCKS[B.gl_offering]);
  assert.ok(favoured(game, p), FAVOUR);
  assert.equal(countItem(p.inv, 'bread'), had - 1);
  assert.ok(w.getState(q.x, FY, q.z), 'the little lamp lit');
  // In the acid: no burn.
  const acid = [];
  for (let x = x0 + 6; x <= x0 + 8; x++) {
    w.setBlock(x, FY - 1, z0 + 2, B.acid_pool);
    acid.push({ x, z: z0 + 2 });
  }
  d.data.anc.acid = [{ tiles: acid, box: { x0, z0: z0 - 2, x1: x0 + 15, z1: z0 + 5 } }];
  p.teleport(x0 + 7, FY, z0 + 2);
  const hp = p.hp;
  run(game, input, 2.5);
  assert.equal(p.hp, hp, 'not burned');
});

test('the bricked-up door: three blows, each loud enough to wake what sleeps near; then in', () => {
  const { game, d, p, x0, z0 } = inGullet();
  const w = game.world;
  const door = { x: x0 + 4, z: z0 - 2 };
  for (const y of [FY, FY + 1]) w.setBlock(door.x, y, door.z, B.gl_bricked);
  const q = { door, room: 0 };
  d.data.bricks = [q];
  const sleeper = d.spawn('gut_leech', x0 + 10, FY, z0 + 3, {});
  sleeper.dormant = 99;
  p.teleport(door.x, FY, door.z + 1);
  for (let k = 0; k < BLOWS - 1; k++) d.interact(door.x, FY, door.z, BLOCKS[B.gl_bricked]);
  assert.equal(w.getBlock(door.x, FY, door.z), B.gl_bricked, 'not yet');
  assert.ok(!sleeper.dormant, 'woken by the noise');
  d.interact(door.x, FY, door.z, BLOCKS[B.gl_bricked]);
  assert.equal(w.getBlock(door.x, FY, door.z), B.air, 'in');
  for (const y of [FY, FY + 1]) w.setBlock(door.x, y, door.z, B.gl_bricked);
  restore(d);
  assert.equal(w.getBlock(door.x, FY, door.z), B.air, 'still open');
});

test('the clutches hatch as you come near; a mother lays, and her eggs hatch in their time; something coming up under them hatches the lot', () => {
  const { game, input, d, p, x0, z0 } = inGullet();
  game.cheats.god = true;
  const w = game.world;
  const eggs = [{ x: x0 + 8, z: z0 + 1 }, { x: x0 + 10, z: z0 + 1 }, { x: x0 + 12, z: z0 + 1 }];
  for (const e of eggs) w.setBlock(e.x, FY, e.z, B.gl_eggs);
  d.data.clutches = [{ eggs, room: 0 }];
  p.teleport(x0 + 7, FY, z0 + 2);
  run(game, input, 0.2);
  assert.equal(w.getBlock(eggs[0].x, FY, eggs[0].z), B.air, 'hatched');
  assert.ok(game.creatures.some((c) => c.species === 'maw_larva' && !c.dead));
  assert.equal(w.getBlock(eggs[2].x, FY, eggs[2].z), B.gl_eggs, 'the far one not yet');
  assert.ok(upheave(d, eggs[2], 2) >= 1, 'upheaved');
  assert.equal(w.getBlock(eggs[2].x, FY, eggs[2].z), B.air);
  // A mother lays; hers hatch in their time.
  p.teleport(x0, FY, z0 + 5);
  const m = d.spawn('clutch_mother', x0 + 12, FY, z0 + 4, {});
  m.dormant = 99;
  const e = lay(d, m);
  assert.ok(e, 'laid');
  assert.equal(w.getBlock(e.x, FY, e.z), B.gl_eggs);
  run(game, input, HATCH_T + 0.5);
  assert.equal(w.getBlock(e.x, FY, e.z), B.air, 'hatched in its time');
});

test('a borer goes under the floor and comes up under you (you see it coming), throwing the eggs open', () => {
  const { game, input, d, p, x0, z0 } = inGullet();
  game.cheats.god = true;
  const w = game.world;
  const b = d.spawn('borer', x0 + 12, FY, z0 + 2, {});
  b.dormant = 0;
  b.target = p;
  b.upT = 0;
  p.teleport(x0 + 4, FY, z0 + 2);
  w.setBlock(x0 + 5, FY, z0 + 3, B.gl_eggs);
  d.data.clutches = [{ eggs: [{ x: x0 + 5, z: z0 + 3 }], room: 0 }];
  let under = false;
  let warned = false;
  for (let t = 0; t < 10 && !(under && !b.burrowed && dist(b, p) <= 1); t += 0.05) {
    game.update(0.05, input);
    p.teleport(x0 + 4, FY, z0 + 2);
    if (b.burrowed) under = true;
    if (b.rise) warned = true;
  }
  assert.ok(under, 'it went under');
  assert.ok(warned, 'the ground cracking first');
  assert.ok(!b.burrowed && Math.max(Math.abs(b.x - p.x), Math.abs(b.z - p.z)) <= 1, 'up under you');
  assert.equal(w.getBlock(x0 + 5, FY, z0 + 3), B.air, 'the egg by it hatched');
});
const dist = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.z - b.z));

test('the Swallowed: come near one and it leads you to the bricked door its people know; hurt one and they are all gone', () => {
  const { game, input, d, p, x0, z0 } = inGullet();
  game.cheats.god = true;
  const w = game.world;
  const door = { x: x0 + 13, z: z0 - 2 };
  for (const y of [FY, FY + 1]) w.setBlock(door.x, y, door.z, B.gl_bricked);
  d.data.bricks = [{ door, room: 0 }];
  const s = d.spawn('swallowed_one', x0 + 2, FY, z0 + 2, { peaceful: true });
  s.dormant = 0;
  const s2 = d.spawn('swallowed_one', x0 + 3, FY, z0 + 4, { peaceful: true });
  s2.dormant = 0;
  p.teleport(x0 + 1, FY, z0 + 2);
  for (let t = 0; t < 12; t += 0.05) {
    game.update(0.05, input);
    const c = glT(d).guide?.c;
    if (c) p.teleport(Math.max(x0, c.x - 2), FY, c.z);
    if (glT(d).guide?.there) break;
  }
  const G = glT(d).guide;
  assert.ok(G, 'led');
  assert.ok(G.there && dist(G.c, door) <= 1, 'to the door');
  // Hurt one: they're gone.
  game.damage(s2, 1, p);
  run(game, input, 0.2);
  assert.ok(glT(d).hidden);
  assert.ok(game.creatures.every((c) => c.species !== 'swallowed_one' || c.dead), 'all gone');
});

test('the version and its step', () => {
  assert.ok(compareVersions(GAME_VERSION, '1.13.0') >= 0);
  assert.ok(stepsFor('1.12.0').some((s) => s.to === '1.13.0'));
});

test('the Alinelidan is painted by hand: its jaws shut on its maw, peeled open as it bites, its hide flushed risen, and the rings of its body', () => {
  assert.deepEqual(Object.keys(GULLET_BOSS_ART), ['alinelidan']);
  const A = GULLET_BOSS_ART.alinelidan;
  assert.equal(A.size, 128);
  assert.equal(A.ay, 100);
  assert.deepEqual(A.idle, [0, 4]);
  assert.deepEqual(A.states.wind.idle, [8, 2]);
  const D = FORGE.alinelidan;
  assert.ok(D.pix);
  assert.ok(!D.front, 'its jaws painted, not drawn over');
  for (const k of [44, 36, 28, 20]) assert.ok(ALINELIDAN_RINGS[k] && ALINELIDAN_RINGS[k].rows.length === k + 4, `ring ${k}`);
  const diff = (a, b) => {
    let n = 0;
    for (let i = 0; i < a.d.length; i += 4) if (a.d[i] !== b.d[i] || a.d[i + 3] !== b.d[i + 3]) n++;
    return n;
  };
  const shut = forgePaint('alinelidan', 0, {});
  assert.ok(diff(shut, forgePaint('alinelidan', 0, { wind: 1 })) > 200, 'its jaws open');
  assert.ok(diff(shut, forgePaint('alinelidan', 0, { risen: 1 })) > 1000, 'its hide flushed');
  // (Biting, its jaws open.)
  assert.equal(artState({ jawT: 0.5, hp: 10, maxHp: 10, S: SPECIES.alinelidan }).wind, 1);
});
