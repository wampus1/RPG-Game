// Round 111: the Hall of the Last Champion made over. Its sandstone, its
// faces and its things drawn afresh; its floors laid out by its own
// architect (the hall of honours and its gallery, the feast-hall, the oath
// chapel and its door, the barracks, the wound and its wards, the hall of
// the fallen), a floor to each of what it was, beside its old rooms, every
// one walkable, the galleries too; what's written there made from its own
// story; its new creatures drawn and at work (the huntress's shade on the
// high ground whose arrows pin you, the curseling that gets the fallen up
// again cursed, the mourner who wails); the oath; the wards; the
// memorials; and its master painted by hand, every one of his forms.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGame, stubInput } from './helpers.mjs';
import { DungeonRun } from '../src/game/dungeon.js';
import { buildFloor, FY } from '../src/world/dungeongen.js';
import { BLOCKS, B } from '../src/world/blocks.js';
import { SPECIES } from '../src/entities/creature.js';
import { CHAMPION_SPECIES } from '../src/entities/championmobs.js';
import { CHAMPION_MOBS } from '../src/render/art/champion_mobs.js';
import { CHAMPION_SPRITES, championTop, championFront } from '../src/render/art/champion_tex.js';
import { championLore, VIRTUES } from '../src/world/deeps/championlore.js';
import { CHAMPION_OWN, STAGE_FLOOR } from '../src/world/deeps/champion.js';
import { ANCIENT_DTYPES } from '../src/world/ancient.js';
import { chT, restore, HOLD, onKill, raiseCursed, corpseNear } from '../src/game/championwork.js';
import { addItem, countItem } from '../src/game/inventory.js';
import { GAME_VERSION, compareVersions } from '../src/version.js';
import { stepsFor } from '../src/game/migrate.js';
import { CHAMPION_BOSS_ART } from '../src/render/art/champion_bosses.js';
import { FORGE, forgePaint } from '../src/render/forge.js';
import '../src/render/bossbody.js';

const rec = (s) => ({ id: `c${s}`, type: 'champion', isle: 'velmarch', seed: 1000 + s * 31, depth: 3, level: 4, vaultFloor: 1, origin: { who: 'the Last Champion', y: 612 }, townName: 'Quillcross' });
const at = (f, x, y, z) => {
  const r = f.regions.get(Math.floor(x / 64) * 4096 + Math.floor(z / 36));
  return r ? r.get(x % 64, y, z % 36) : 0;
};
const PASS = new Set(['sealed', 'portcullis', 'boss_gate', 'ch_oathdoor']);
// Every tile you can walk to from the way in, a step up or down at a time,
// up onto the galleries. (Things set on the floor aren't tiles to walk to;
// nor is the top of a bookcase.)
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
        // (The gallery, up its steps; not the tops of things.)
        if (h === null || (h === FY + 2 && at(f, f.x0 + x, FY + 1, z) !== B.ch_dais)) continue;
        if (BLOCKS[at(f, f.x0 + x, h - 1, z)]?.name === 'bookshelf') continue;
        if (!seen.has(z * P.W + x)) miss++;
      }
    }
  }
  return miss;
}


test('every floor of a Hall of the Last Champion can be walked, up onto its galleries', () => {
  for (let s = 0; s < 6; s++) for (let n = 0; n < 3; n++) assert.equal(reach(buildFloor(rec(s), n)), 0, `seed ${s} floor ${n}`);
});

test("the Hall is its own architect's now, a floor to each of what it was", () => {
  const T = ANCIENT_DTYPES.champion;
  assert.ok(T.arch, 'its architect');
  assert.equal(T.wall, B.ch_stone);
  for (const k of ['shade_archer', 'curseling']) assert.ok(T.mobs.some(([m]) => m === k), k);
  assert.ok(T.kept.includes('mourner'));
  for (let n = 0; n < 3; n++) {
    const f = buildFloor(rec(2), n);
    const h = f.rooms.find((r) => r.kit === 'hall');
    assert.ok(h, `a hall of honours on floor ${n}`);
    const fl = at(f, f.x0 + h.cx, FY - 1, h.cz + 2);
    assert.ok([B[STAGE_FLOOR[n]], B.ch_runner, B.ch_cursed, B.ch_dais].includes(fl), `its floor on floor ${n}: ${BLOCKS[fl].name}`);
  }
});

test('a floor of the Hall is laid out as one: the oath and its stones and door, the wards round the wound, the memorials, the galleries', () => {
  const kits = new Set();
  const n0 = { oaths: 0, wards: 0, memorials: 0 };
  const sp = {};
  let galleries = 0;
  let cursed = 0;
  for (let s = 0; s < 6; s++) {
    for (let n = 0; n < 3; n++) {
      const f = buildFloor(rec(s), n);
      for (const r of f.rooms) kits.add(r.kit);
      for (const q of f.oaths || []) {
        assert.equal(at(f, q.door.x, FY, q.door.z), B.ch_oathdoor);
        assert.equal(q.kneels.length, 4);
        for (const k of q.kneels) assert.equal(at(f, k.x, FY, k.z), B.ch_kneel);
        assert.deepEqual([...q.kneels.map((k) => k.v)].sort(), [0, 1, 2, 3], 'one stone a virtue');
        assert.deepEqual([...q.order].sort(), [0, 1, 2, 3]);
        assert.ok((f.lore || []).some((l) => l.title.startsWith('The Oath of')), 'his oath written on the floor');
      }
      for (const g of f.wards || []) {
        for (const q of g.wards) assert.equal(at(f, q.x, FY, q.z), B.ch_ward);
        assert.ok(g.tiles.length > 3, 'the growth round the wound');
      }
      for (const g of f.memorials || []) for (const q of g.list) {
        assert.equal(at(f, q.x, FY, q.z), B.ch_memorial);
        assert.ok(q.lore && q.lore.lines.length);
      }
      for (const k of Object.keys(n0)) n0[k] += (f[k] || []).length;
      for (const q of f.spawns) sp[q.species] = (sp[q.species] || 0) + 1;
      for (let z = 0; z < f.plan.D; z++) for (let x = 0; x < f.plan.W; x++) {
        if (at(f, f.x0 + x, FY + 1, z) === B.ch_dais) galleries++;
        if (n === 2 && at(f, f.x0 + x, FY - 1, z) === B.ch_cursed) cursed++;
      }
    }
  }
  for (const k of CHAMPION_OWN) assert.ok(kits.has(k), `the ${k}`);
  for (const [k, v] of Object.entries(n0)) assert.ok(v > 3, `${k}: ${v}`);
  assert.ok(galleries > 30, `galleries: ${galleries}`);
  assert.ok(cursed > 30, `the curse on the barrow floors: ${cursed}`);
  for (const k of ['oathbound_squire', 'trial_sentinel', 'banner_wraith', 'shade_archer', 'curseling', 'mourner']) assert.ok(sp[k] > 2, `${k}: ${sp[k]}`);
});

test("what's written in the Hall is its own story, the same each time; the oath book has the order the stones open to", () => {
  const L = championLore(rec(3), 0, 'the_hero');
  const L2 = championLore(rec(3), 0, 'the_hero');
  assert.deepEqual(L.oathBook(), L2.oathBook());
  assert.deepEqual(L.oath, championLore(rec(3), 2).oath, 'the same oath on every floor');
  const book = L.oathBook().lines;
  L.oath.forEach((v, i) => assert.ok(book[i].includes(VIRTUES[v].name), `${i}: ${VIRTUES[v].name}`));
  assert.ok(L.story().lines.join(' ').includes(L.hero));
  assert.ok(L.wars().lines.join(' ').includes('Quillcross'));
  assert.equal(championLore(rec(3), 2).stage, 'barrow');
  for (const k of ['oathBook', 'plaque', 'diary', 'letter', 'toast', 'curse', 'fallen', 'wards', 'memorial', 'wars', 'story', 'last', 'hall']) {
    const e = L[k]();
    assert.ok(e.title && e.lines.length, k);
  }
});

test("the Hall's tiles and things are drawn; its new creatures are in the game and drawn", () => {
  for (const n of ['ch_stone', 'ch_frieze', 'ch_banner', 'ch_plaque', 'ch_arms', 'ch_laurel', 'ch_oathdoor', 'ch_cursewall']) assert.ok(championFront(n, 0) && championTop(n, 0), n);
  for (const n of ['ch_flags', 'ch_cracked', 'ch_runner', 'ch_cursed', 'ch_dais']) assert.ok(championTop(n, 1), n);
  for (const [n, f] of Object.entries(CHAMPION_SPRITES)) {
    assert.ok(B[n] !== undefined, n);
    assert.ok(f(0, false, 0) && f(3, true, 1), n);
  }
  for (const k of Object.keys(CHAMPION_SPECIES)) assert.ok(SPECIES[k], k);
  for (const k of ['shade_archer', 'curseling', 'mourner', 'banner_wraith']) {
    const A = CHAMPION_MOBS[k];
    assert.ok(A && A.size === 24 && A.groups.walk && A.groups.attack, k);
  }
  assert.equal(SPECIES.mourner.mode, 'passive');
});

function inHall() {
  const game = makeGame(12345);
  const input = stubInput();
  game.minute = 600;
  for (let i = 0; i < 20; i++) game.update(0.1, input);
  const base = game.sim.dungeons.all.find((q) => q.type === 'crypt');
  const r = { ...base, type: 'champion', isle: 'velmarch', floors: {}, cleared: false, pack: null, weakened: 0 };
  new DungeonRun(game, r).enter();
  const d = game.dungeon;
  for (const c of game.creatures) {
    c.dead = true;
    game.removeOcc(c);
  }
  game.creatures = [];
  game.cheats = { ...(game.cheats || {}), god: false };
  for (const k of ['oaths', 'wards', 'memorials']) d.data[k] = [];
  // A clear hall, 15 by 8, about the way in, its stone wall north of it.
  const e = d.data.rooms.find((q) => q.kit === 'entry');
  const x0 = d.data.x0 + e.cx - 7;
  const z0 = e.cz - 2;
  for (let z = z0 - 2; z <= z0 + 5; z++) {
    for (let x = x0 - 1; x <= x0 + 15; x++) {
      for (const y of [FY, FY + 1, FY + 2]) game.world.setBlock(x, y, z, B.air);
      game.world.setBlock(x, FY - 1, z, B.ch_flags);
      game.world.setBlock(x, FY - 2, z, B.ch_stone);
    }
  }
  for (let x = x0 - 1; x <= x0 + 15; x++) for (const y of [FY, FY + 1]) game.world.setBlock(x, y, z0 - 3, B.ch_stone);
  game.zones = [];
  const p = game.player;
  p.teleport(x0, FY, z0 + 5);
  p.hp = p.maxHp = 200;
  d.champT = null;
  return { game, input, d, p, x0, z0 };
}
const run = (game, input, secs) => {
  for (let t = 0; t < secs; t += 0.05) game.update(0.05, input);
};

test('the oath: knelt at in its order the stones kindle and the door opens (and stays open); out of order, the curse bursts out', () => {
  const { game, d, p, x0, z0 } = inHall();
  const w = game.world;
  const door = { x: x0 + 7, z: z0 - 3 };
  for (const y of [FY, FY + 1]) w.setBlock(door.x, y, door.z, B.ch_oathdoor);
  const kneels = [0, 1, 2, 3].map((i) => ({ x: x0 + 3 + i * 2, z: z0, v: [2, 0, 3, 1][i] }));
  for (const k of kneels) w.setBlock(k.x, FY, k.z, B.ch_kneel, k.v);
  const order = [1, 3, 0, 2];
  const q = { kneels, door, order, room: 0 };
  d.data.oaths = [q];
  const byV = (v) => kneels.find((k) => k.v === v);
  // Wrong: the first stone of the oath is Mercy (1); kneel at Valour (0).
  const hp = p.hp;
  d.interact(byV(0).x, FY, byV(0).z, BLOCKS[B.ch_kneel]);
  assert.ok(p.hp < hp, 'the curse bursts');
  assert.ok(game.creatures.some((c) => c.species === 'curseling' && !c.dead), 'curselings');
  for (const c of game.creatures) c.dead = true;
  // In order.
  for (const v of order.slice(0, 3)) {
    d.interact(byV(v).x, FY, byV(v).z, BLOCKS[B.ch_kneel]);
    assert.ok(w.getState(byV(v).x, FY, byV(v).z), `stone ${v} lit`);
  }
  assert.equal(w.getBlock(door.x, FY, door.z), B.ch_oathdoor, 'not yet');
  d.interact(byV(order[3]).x, FY, byV(order[3]).z, BLOCKS[B.ch_kneel]);
  assert.equal(w.getBlock(door.x, FY, door.z), B.air, 'open');
  for (const y of [FY, FY + 1]) w.setBlock(door.x, y, door.z, B.ch_oathdoor);
  restore(d);
  assert.equal(w.getBlock(door.x, FY, door.z), B.air, 'still open');
  assert.ok(kneels.every((k) => w.getState(k.x, FY, k.z)));
});

test('a cracked ward leaks the curse: it burns, it gives up curselings; held three breaths it seals, and with the last the growth burns away', () => {
  const { game, input, d, p, x0, z0 } = inHall();
  const w = game.world;
  const tiles = [];
  for (let x = x0 + 5; x <= x0 + 9; x++) for (const z of [z0 - 2, z0 - 1]) {
    w.setBlock(x, FY - 1, z, B.ch_cursed);
    tiles.push({ x, z });
  }
  const wards = [{ x: x0 + 3, z: z0 + 1, sealed: false }, { x: x0 + 11, z: z0 + 1, sealed: false }];
  for (const q of wards) w.setBlock(q.x, FY, q.z, B.ch_ward, 0);
  const g = { wards, tiles, src: { x: x0 + 7, z: z0 - 2 }, room: 0 };
  d.data.wards = [g];
  // Standing on the growth: it burns.
  p.teleport(x0 + 6, FY, z0 - 1);
  const hp = p.hp;
  run(game, input, 1.6);
  assert.ok(p.hp < hp, 'burned');
  // Near it a while: a curseling crawls out.
  p.teleport(x0 + 13, FY, z0 + 4);
  game.cheats.god = true;
  chT(d).spawnT.set(g, 0.1);
  run(game, input, 0.3);
  assert.ok(game.creatures.some((c) => c.species === 'curseling' && !c.dead), 'a curseling');
  for (const c of game.creatures) c.dead = true;
  // Held: the first ward seals.
  p.teleport(wards[0].x + 1, FY, wards[0].z);
  d.interact(wards[0].x, FY, wards[0].z, BLOCKS[B.ch_ward]);
  for (const c of game.creatures) c.dead = true;
  for (let t = 0; t < HOLD + 0.3; t += 0.05) {
    game.update(0.05, input);
    for (const c of game.creatures) c.dead = true;
    p.teleport(wards[0].x + 1, FY, wards[0].z);
  }
  assert.ok(w.getState(wards[0].x, FY, wards[0].z), 'sealed');
  assert.equal(w.getBlock(tiles[0].x, FY - 1, tiles[0].z), B.ch_cursed, 'the growth still there');
  // Walked away from: the words break off.
  p.teleport(wards[1].x + 1, FY, wards[1].z);
  d.interact(wards[1].x, FY, wards[1].z, BLOCKS[B.ch_ward]);
  p.teleport(wards[1].x + 3, FY, wards[1].z + 2);
  game.update(0.05, input);
  assert.equal(chT(d).hold, null, 'broken off');
  // Held: the last seals, and the growth is gone.
  p.teleport(wards[1].x + 1, FY, wards[1].z);
  d.interact(wards[1].x, FY, wards[1].z, BLOCKS[B.ch_ward]);
  for (let t = 0; t < HOLD + 0.3; t += 0.05) {
    game.update(0.05, input);
    for (const c of game.creatures) c.dead = true;
    p.teleport(wards[1].x + 1, FY, wards[1].z);
  }
  assert.ok(tiles.every((t) => w.getBlock(t.x, FY - 1, t.z) === B.ch_cracked), 'the growth burned away');
  for (const t of tiles) w.setBlock(t.x, FY - 1, t.z, B.ch_cursed);
  for (const q of wards) w.setState(q.x, FY, q.z, false);
  restore(d);
  assert.ok(wards.every((q) => w.getState(q.x, FY, q.z)) && w.getBlock(tiles[0].x, FY - 1, tiles[0].z) === B.ch_cracked, 'as it was left');
});

test('a curseling gets to the fallen and they get up again, cursed', () => {
  const { game, input, d, p, x0, z0 } = inHall();
  p.teleport(x0 + 14, FY, z0 + 5);
  game.cheats.god = true;
  const s = d.spawn('oathbound_squire', x0 + 4, FY, z0 + 1, {});
  onKill(d, s);
  assert.ok(corpseNear(d, { x: x0 + 6, z: z0 + 1 }));
  const c = d.spawn('curseling', x0 + 7, FY, z0 + 1, {});
  c.dormant = 0;
  c.target = p;
  run(game, input, 3);
  const up = game.creatures.find((q) => q.species === 'oathbound_squire' && q.cursed && !q.dead);
  assert.ok(up, 'up again');
  assert.ok(c.dead, 'the curseling gone into it');
  // (Not twice.)
  onKill(d, up);
  assert.equal(chT(d).corpses.filter((q) => !q.taken).length, 0);
  assert.ok(raiseCursed);
});

test('the huntress\'s shade keeps the high ground and her arrows pin you', () => {
  const { game, input, d, p, x0, z0 } = inHall();
  const w = game.world;
  for (let x = x0 + 8; x <= x0 + 12; x++) for (const y of [FY, FY + 1]) w.setBlock(x, y, z0 - 2, B.ch_dais);
  const a = d.spawn('shade_archer', x0 + 10, FY + 2, z0 - 2, {});
  a.dormant = 0;
  a.target = p;
  p.teleport(x0 + 4, FY, z0 + 2);
  p.slowT = 0;
  let pinned = false;
  for (let t = 0; t < 6 && !pinned; t += 0.05) {
    game.update(0.05, input);
    if (p.slowT > 0) pinned = true;
  }
  assert.ok(pinned, 'pinned');
  assert.equal(a.y, FY + 2, 'still up on the gallery');
});

test('a mourner wails at a fight near her, and what sleeps near her wakes; a memorial given to blesses you once a floor', () => {
  const { game, input, d, p, x0, z0 } = inHall();
  const m = d.spawn('mourner', x0 + 7, FY, z0 + 1, { peaceful: true });
  m.dormant = 0;
  const sleeper = d.spawn('oathbound_squire', x0 + 12, FY, z0 + 3, {});
  sleeper.dormant = 99;
  const foe = d.spawn('curseling', x0 + 8, FY, z0 + 2, {});
  foe.dormant = 0;
  foe.target = p;
  p.teleport(x0 + 6, FY, z0 + 3);
  game.cheats.god = true;
  run(game, input, 0.3);
  assert.ok(!sleeper.dormant, 'woken by her wail');
  // A memorial.
  const q = { x: x0 + 2, z: z0 - 1, lore: { title: 'Cut in the Memorial', lines: ['Hild of Quillcross.'] } };
  game.world.setBlock(q.x, FY, q.z, B.ch_memorial);
  d.data.memorials = [{ list: [q], room: 0 }];
  addItem(p.inv, 'coin', 2);
  const had = countItem(p.inv, 'coin');
  d.interact(q.x, FY, q.z, BLOCKS[B.ch_memorial]);
  assert.equal(countItem(p.inv, 'coin'), had - 1);
  assert.ok(game.world.getState(q.x, FY, q.z));
  assert.ok((p.buffs || []).some((b) => b.name === 'Remembered'), 'remembered');
});

test('the version and its step', () => {
  assert.ok(compareVersions(GAME_VERSION, '1.11.0') >= 0);
  assert.ok(stepsFor('1.10.0').some((s) => s.to === '1.11.0'));
});

test('the Hero is painted by hand: his stride, his legs gone to tentacles, and every part of him as he is or as the curse has made it', () => {
  assert.deepEqual(Object.keys(CHAMPION_BOSS_ART), ['the_hero']);
  const A = CHAMPION_BOSS_ART.the_hero;
  assert.equal(A.size, 128);
  assert.equal(A.ay, 125);
  assert.deepEqual(A.walk, [1, 4]);
  assert.deepEqual(A.states.legs.idle, [5, 4]);
  const D = FORGE.the_hero;
  assert.ok(D.pix);
  assert.equal(D.ay, 125, 'his tentacle-arm thrown from where it was');
  assert.ok(A.parts.armF.pixVariants.claw && A.parts.armF.pixVariants.blade);
  assert.ok(A.parts.armB.pixVariants.tentacle);
  assert.ok(A.parts.head.pixVariants.stalks);
  assert.ok(A.parts.chest.pixVariants.maw);
  assert.ok(A.parts.wingB && A.parts.wingF && A.parts.cape);
  assert.ok(typeof D.parts.wingB.show === 'function', 'the wings only when the curse gives him them');
  assert.ok(typeof D.parts.armF.variant === 'function');
  const diff = (a, b) => {
    let n = 0;
    for (let i = 0; i < a.d.length; i += 4) if (a.d[i] !== b.d[i] || a.d[i + 3] !== b.d[i + 3]) n++;
    return n;
  };
  const stand = forgePaint('the_hero', 0, {});
  const step = forgePaint('the_hero', 6, { walk: 1 });
  const tent = forgePaint('the_hero', 0, { legs: 1 });
  assert.ok(diff(stand, step) > 30, 'striding');
  assert.ok(diff(stand, tent) > 200, 'his legs gone to tentacles');
});
