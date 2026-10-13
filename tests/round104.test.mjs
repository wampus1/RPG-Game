// Round 104: the Terracotta Vault made over. Its tiles and things drawn
// afresh; its floors laid out by its own architect (the army's pit with
// its trenches and ridges, the chariot pit, the palace's court with its
// dais, the empire in quicksilver, the artisans' workshop, the shrine of
// the five directions, the crossbow gallery) beside its old rooms, every
// one walkable; what's written there made from its emperor, his army, the
// artisans sealed in with it and the town above; its new creatures drawn
// and at work (the drummer's drum and bell, the quicksilver splitting and
// running together and waking the statues, the artisans mending); the
// statues that aren't clay; the crossbow plates; the quicksilver's poison;
// the discs of the directions; the tunnel; and its two masters painted by
// hand.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGame, stubInput } from './helpers.mjs';
import { DungeonRun } from '../src/game/dungeon.js';
import { buildFloor, FY } from '../src/world/dungeongen.js';
import { BLOCKS, B } from '../src/world/blocks.js';
import { SPECIES } from '../src/entities/creature.js';
import { BRAINS } from '../src/entities/monsters.js';
import { VAULT_SPECIES } from '../src/entities/vaultmobs.js';
import { VAULT_MOBS } from '../src/render/art/vault_mobs.js';
import { VAULT_SPRITES, vaultTop, vaultFront } from '../src/render/art/vault_tex.js';
import { vaultLore, DIRECTIONS } from '../src/world/deeps/vaultlore.js';
import { VAULT_OWN, DISCS } from '../src/world/deeps/vault.js';
import { vtT, restore } from '../src/game/vaultwork.js';
import { GAME_VERSION, compareVersions } from '../src/version.js';
import { stepsFor } from '../src/game/migrate.js';
import { VAULT_BOSS_ART } from '../src/render/art/vault_bosses.js';
import { FORGE } from '../src/render/forge.js';
import '../src/render/bossbody.js';

const rec = (s) => ({ id: `v${s}`, type: 'vault', isle: 'ostria', seed: 1000 + s * 31, depth: 3, level: 2, vaultFloor: 1, origin: { who: 'the First Emperor', y: 1201 }, townName: 'Quillcross' });
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

test('every floor of a Terracotta Vault can be walked, down into its trenches and up onto its dais', () => {
  for (let s = 0; s < 6; s++) for (let n = 0; n < 3; n++) assert.equal(reach(buildFloor(rec(s), n)), 0, `seed ${s} floor ${n}`);
});

test('a floor of a Terracotta Vault is laid out as one: its army in its trenches, its rivers, its discs, its plates, its tunnel', () => {
  const kits = new Set();
  let statues = 0;
  let alive = 0;
  let trench = 0;
  let mercury = 0;
  let plates = 0;
  let discs = 0;
  let tunnels = 0;
  let drummers = 0;
  let artisans = 0;
  for (let s = 0; s < 6; s++) {
    for (let n = 0; n < 3; n++) {
      const f = buildFloor(rec(s), n);
      for (const r of f.rooms) kits.add(r.kit);
      for (const q of f.statues || []) {
        assert.equal(at(f, q.x, q.y, q.z), B.tv_soldier, 'a statue where it says');
        statues++;
        if (q.alive) alive++;
        if (q.y === FY - 1) trench++;
      }
      for (const q of f.mercury || []) {
        assert.equal(at(f, q.x, FY - 2, q.z), B.tv_mercury);
        assert.equal(at(f, q.x, FY - 1, q.z), B.air, 'sunk');
        mercury++;
      }
      for (const b of f.crossbows || []) {
        assert.equal(at(f, b.x, FY, b.z), B.tv_crossbow);
        for (const p of b.plates) {
          assert.equal(p.x, b.x, 'a plate on its crossbow\'s line');
          assert.equal(at(f, p.x, FY - 1, p.z), B.tv_plate);
          plates++;
        }
      }
      for (const d of f.discs || []) {
        discs++;
        assert.equal(d.peds.length, 5);
        assert.deepEqual(d.peds.map((p) => p.dir).sort(), [0, 1, 2, 3, 4]);
        for (const p of d.peds) {
          const id = at(f, p.x, FY, p.z);
          assert.ok(DISCS.some((k) => B[k] === id), 'a disc on its pedestal');
          assert.notEqual(id, B[DISCS[p.dir]], 'never already in its colour');
        }
        assert.equal(at(f, d.door.x, FY, d.door.z), B.tv_bronzedoor);
      }
      for (const t of f.tunnels || []) {
        assert.equal(at(f, t.x, FY, t.z), B.tv_crack);
        tunnels++;
      }
      drummers += f.spawns.filter((q) => q.species === 'drummer').length;
      artisans += f.spawns.filter((q) => q.species === 'artisan' && q.peaceful).length;
      if (n === 0) assert.ok(f.rooms.some((r) => r.kit === 'directions'), 'the shrine of the directions on the first floor');
    }
  }
  for (const k of VAULT_OWN) assert.ok(kits.has(k), `the ${k}`);
  assert.ok(statues > 1000 && alive > 60 && trench > 500 && mercury > 100 && plates > 10 && discs > 6 && tunnels > 3 && drummers > 10 && artisans > 5, `${statues} ${alive} ${trench} ${mercury} ${plates} ${discs} ${tunnels} ${drummers} ${artisans}`);
});

test('what\'s written in a Terracotta Vault is its emperor\'s, its army\'s, its artisans\' and its town\'s, and the same each time', () => {
  const a = vaultLore(rec(1), 0, 'terracotta_general');
  const b = vaultLore(rec(1), 0, 'terracotta_general');
  for (const k of ['stele', 'tally', 'mark', 'muster', 'map', 'directions', 'ding', 'verse', 'letter', 'decree', 'throne', 'bones', 'last']) {
    const t = a[k]();
    assert.deepEqual(t, b[k](), k);
    assert.ok(t.title && t.lines.length >= 1 && t.lines.every((l) => typeof l === 'string' && l.length > 3), k);
  }
  assert.ok(a.stele().lines.join(' ').toLowerCase().includes('the first emperor'));
  assert.ok(a.letter().lines.join(' ').includes(a.potter), 'the master potter\'s letter');
  assert.ok(a.directions().lines.join(' ').includes('yellow'), 'the centre\'s colour');
  for (let k = 0; k < 4; k++) assert.ok(a.beast(k).lines[0].includes(DIRECTIONS[k].colour), `${DIRECTIONS[k].beast}'s colour`);
  assert.ok(a.last().title.includes('Terracotta General'));
  const titles = new Set();
  for (let s = 1; s <= 4; s++) for (let n = 0; n < 3; n++) for (const l of buildFloor(rec(s), n).lore) titles.add(l.title);
  for (const t of ['The Stele', 'The Muster', 'The Five Directions', 'The Azure Dragon', 'Scratched Tally', 'The Artisans\' Letter', 'A Potter\'s Mark', 'The Empire in Little']) assert.ok(titles.has(t), t);
});

test('the Terracotta Vault\'s tiles and things are drawn; its new creatures are in the game and drawn; a statue\'s face stays its own however the view turns', () => {
  for (const n of ['tv_earth', 'tv_brick', 'tv_plate', 'tv_loess', 'tv_stone', 'tv_lacquerfloor', 'tv_mercury', 'tv_jade', 'tv_bridge', 'tv_ridge', 'tv_dais']) assert.ok(vaultTop(n, 0), `${n} top`);
  for (const n of ['tv_earth', 'tv_lacquer', 'tv_roundel', 'tv_dragon', 'tv_bird', 'tv_tiger', 'tv_tortoise', 'tv_bronzedoor', 'tv_crossbow', 'tv_stele', 'tv_tally', 'tv_crack', 'tv_heads', 'tv_kiln', 'tv_ridge', 'tv_dais', 'tv_mercury', 'tv_brick', 'tv_stone']) assert.ok(vaultFront(n, 0), `${n} front`);
  for (const [k, fn] of Object.entries(VAULT_SPRITES)) {
    assert.ok(BLOCKS[B[k]], `${k} is a block`);
    for (const st of [false, true]) assert.ok(fn(0, st, 0), `${k} drawn`);
  }
  for (const sp of Object.keys(VAULT_SPECIES)) {
    assert.ok(SPECIES[sp], `${sp} is a species`);
    assert.ok(VAULT_MOBS[sp] && VAULT_MOBS[sp].rows.length === 24, `${sp} is drawn`);
  }
  // (Round 104: a bust's ancestor, a soldier's face: by its turn, never
  // the view's.)
  for (const k of ['tv_soldier', 'tv_mountain', 'cc_bust', 'cc_urn']) assert.ok(BLOCKS[B[k]].kinds, k);
});

// ------------------------------------------------------- in the vault itself
function inVault() {
  const game = makeGame(12345);
  const input = stubInput();
  game.minute = 600;
  for (let i = 0; i < 20; i++) game.update(0.1, input);
  // (The vaults are over the sea, in Ostria: a dungeon at home made one
  // for the test.)
  const base = game.sim.dungeons.all.find((q) => q.type === 'crypt');
  const r = { ...base, type: 'vault', isle: 'ostria', floors: {}, cleared: false, pack: null, weakened: 0 };
  new DungeonRun(game, r).enter();
  const d = game.dungeon;
  for (const c of game.creatures) {
    c.dead = true;
    game.removeOcc(c);
  }
  game.creatures = [];
  game.cheats = { ...(game.cheats || {}), god: false };
  for (const k of ['statues', 'shards', 'tunnels', 'discs', 'crossbows', 'mercury']) d.data[k] = [];
  // A clear hall, 15 by 8, about the way in, its wall of earth north of it.
  const e = d.data.rooms.find((q) => q.kit === 'entry');
  const x0 = d.data.x0 + e.cx - 7;
  const z0 = e.cz - 2;
  for (let z = z0 - 2; z <= z0 + 5; z++) {
    for (let x = x0 - 1; x <= x0 + 15; x++) {
      for (const y of [FY, FY + 1, FY + 2]) game.world.setBlock(x, y, z, B.air);
      game.world.setBlock(x, FY - 1, z, B.tv_brick);
    }
  }
  for (let x = x0 - 1; x <= x0 + 15; x++) for (const y of [FY, FY + 1]) game.world.setBlock(x, y, z0 - 3, B.tv_earth);
  const p = game.player;
  p.teleport(x0, FY, z0 + 4);
  p.hp = p.maxHp = 200;
  d.vaultT = null;
  return { game, input, d, p, x0, z0 };
}
const run = (game, input, secs) => {
  for (let t = 0; t < secs; t += 0.05) game.update(0.05, input);
};
const statue = (game, d, x, z, alive, kind = 0) => {
  game.world.setBlock(x, FY, z, B.tv_soldier, kind);
  const q = { x, y: FY, z, kind, alive };
  d.data.statues.push(q);
  return q;
};
const living = (game, sp) => game.creatures.filter((c) => !c.dead && c.species === sp);

test('a statue that isn\'t clay steps down when you come by it; one that is clay stays clay', () => {
  const { game, input, d, p, x0, z0 } = inVault();
  const a = statue(game, d, x0 + 6, z0, true);
  const b = statue(game, d, x0 + 10, z0, false);
  p.teleport(x0 + 10, FY, z0 + 1);
  run(game, input, 0.3);
  assert.equal(game.world.getBlock(b.x, FY, b.z), B.tv_soldier, 'clay is clay');
  p.teleport(x0 + 6, FY, z0 + 1);
  run(game, input, 0.2);
  assert.equal(game.world.getBlock(a.x, FY, a.z), B.air, 'the statue gone');
  const c = living(game, 'terracotta_soldier')[0];
  assert.ok(c && c.fromStatue === a, 'a soldier in its place');
  assert.ok(vtT(d).told.wake);
  // (Left standing when the floor's kept: back in its place, waiting.)
  d.saveFloor();
  assert.equal(game.world.getBlock(a.x, FY, a.z), B.tv_soldier, 'stood back in its rank');
});

test('the drummer: at the drum the clay comes on, at the bell it halts and blows glance off it', () => {
  const { game, input, d, p, x0, z0 } = inVault();
  const dr = d.spawn('drummer', x0 + 12, FY, z0 + 2, {});
  const s = d.spawn('terracotta_soldier', x0 + 9, FY, z0 + 2, {});
  for (const c of [dr, s]) {
    c.dormant = 0;
    c.target = p;
  }
  p.teleport(x0 + 2, FY, z0 + 2);
  // The bell: halted.
  dr.bell = false;
  dr.beatT = 0;
  BRAINS.drummer(dr, 0.01);
  assert.ok(dr.bell && s.haltT > 0 && s.stunT > 0, 'halted');
  const hp = s.hp;
  game.damage(s, 8, p);
  assert.equal(s.hp, hp, 'the blow glances off');
  // The drum: on it comes, quick.
  dr.beatT = 0;
  BRAINS.drummer(dr, 0.01);
  assert.ok(!dr.bell && !(s.haltT > 0) && s.hasteT > 0, 'marching');
  game.damage(s, 8, p);
  assert.ok(s.hp < hp, 'and open to a blow');
  run(game, input, 0.1);
});

test('the bells you strike halt the clay; the drum you strike wakes it', () => {
  const { game, input, d, p, x0, z0 } = inVault();
  game.world.setBlock(x0 + 3, FY, z0, B.tv_bells);
  game.world.setBlock(x0 + 5, FY, z0, B.tv_drum);
  const s = d.spawn('terracotta_soldier', x0 + 8, FY, z0 + 2, {});
  s.dormant = 0;
  d.interact(x0 + 3, FY, z0, BLOCKS[B.tv_bells]);
  assert.ok(s.haltT > 0, 'halted by the bells');
  const a = statue(game, d, x0 + 9, z0 + 4, true);
  p.teleport(x0 + 1, FY, z0 + 4);
  d.interact(x0 + 5, FY, z0, BLOCKS[B.tv_drum]);
  assert.equal(game.world.getBlock(a.x, FY, a.z), B.air, 'the army answers the drum');
  run(game, input, 0.1);
});

test('quicksilver splits when struck, its beads run together when they touch, and a bead run into a statue moves it', () => {
  const { game, input, d, p, x0, z0 } = inVault();
  p.teleport(x0, FY, z0 + 4);
  const q = d.spawn('quicksilver', x0 + 8, FY, z0 + 2, {});
  q.dormant = 0;
  game.damage(q, 3, p);
  run(game, input, 0.1);
  assert.ok(q.dead, 'split');
  const beads = living(game, 'quicksilver_bead');
  assert.equal(beads.length, 2, 'into two beads');
  // Touching, they run together.
  beads[1].teleport(beads[0].x + 1, FY, beads[0].z);
  for (const b of beads) {
    b.mergeCd = 0;
    b.dormant = 99;
  }
  BRAINS.quicksilver(beads[0], 0.01);
  run(game, input, 0.1);
  assert.equal(living(game, 'quicksilver_bead').length, 0);
  assert.equal(living(game, 'quicksilver').length, 1, 'one again');
  // A bead by a statue (clay, or not): into its cracks, and it moves.
  for (const c of game.creatures) c.dead = true;
  run(game, input, 0.05);
  const st = statue(game, d, x0 + 12, z0, false);
  const b = d.spawn('quicksilver_bead', x0 + 12, FY, z0 + 1, {});
  b.dormant = 0;
  run(game, input, 0.1);
  assert.equal(game.world.getBlock(st.x, FY, st.z), B.air, 'the statue moved');
  const s = living(game, 'terracotta_soldier')[0];
  assert.ok(s && s.quick && s.hasteT > 0, 'quickened');
  // Its touch poisons.
  SPECIES.quicksilver.onHit(game, b, p);
  assert.ok(p.poisonT > 0);
});

test('a clay soldier broken leaves its shards; a sealed artisan mends them, and what he mends stands waiting', () => {
  const { game, input, d, p, x0, z0 } = inVault();
  const s = d.spawn('terracotta_soldier', x0 + 6, FY, z0 + 2, {});
  game.damage(s, 999, p);
  run(game, input, 0.1);
  assert.equal(game.world.getBlock(x0 + 6, FY, z0 + 2), B.tv_shards, 'its shards where it fell');
  assert.equal(d.data.shards.length, 1);
  const a = d.spawn('artisan', x0 + 10, FY, z0 + 2, { peaceful: true });
  a.dormant = 0;
  p.teleport(x0, FY, z0 + 5);
  run(game, input, 8);
  assert.equal(game.world.getBlock(x0 + 6, FY, z0 + 2), B.tv_soldier, 'mended');
  const q = d.data.statues.find((t) => t.x === x0 + 6 && t.z === z0 + 2);
  assert.ok(q && q.alive, 'and not clay');
  assert.ok(!a.dead && !a.angry);
  // Struck, he flees.
  game.damage(a, 1, p);
  assert.ok(a.fleeT > 0);
});

test('a plate in the gallery floor looses the crossbow in the wall down its line', () => {
  const { game, input, d, p, x0, z0 } = inVault();
  const bow = { x: x0 + 5, z: z0 - 3 };
  for (const y of [FY, FY + 1]) game.world.setBlock(bow.x, y, bow.z, B.tv_crossbow);
  const plate = { x: x0 + 5, z: z0 + 2 };
  game.world.setBlock(plate.x, FY - 1, plate.z, B.tv_plate);
  d.data.crossbows = [{ ...bow, plates: [plate], room: 0 }];
  p.teleport(x0 + 4, FY, z0 + 2);
  run(game, input, 0.2);
  const hp = p.hp;
  p.teleport(plate.x, FY, plate.z);
  run(game, input, 0.2);
  assert.ok(p.hp < hp, 'a bolt from the wall');
  assert.ok(vtT(d).told.bolt);
});

test('wading the quicksilver poisons you', () => {
  const { game, input, p, x0, z0 } = inVault();
  game.world.setBlock(x0 + 4, FY - 1, z0 + 2, B.air);
  game.world.setBlock(x0 + 4, FY - 2, z0 + 2, B.tv_mercury);
  p.teleport(x0 + 4, FY - 1, z0 + 2);
  run(game, input, 0.2);
  assert.ok(p.poisonT > 0 && p.slowT > 0);
});

test('the five discs set each in its direction\'s colour open the chamber; it stays open', () => {
  const { game, input, d, p, x0, z0 } = inVault();
  const w = game.world;
  const cx = x0 + 7;
  const cz = z0 + 2;
  const peds = [{ d: 4, x: cx, z: cz }, { d: 0, x: cx + 3, z: cz }, { d: 1, x: cx, z: cz + 3 }, { d: 2, x: cx - 3, z: cz }, { d: 3, x: cx, z: cz - 2 }].map((q) => ({ x: q.x, z: q.z, dir: q.d }));
  for (const q of peds) w.setBlock(q.x, FY, q.z, B[DISCS[(q.dir + 1) % 5]]);
  const door = { x: x0 + 13, z: z0 - 3 };
  for (const y of [FY, FY + 1]) w.setBlock(door.x, y, door.z, B.tv_bronzedoor);
  d.data.discs = [{ peds, door, room: 0 }];
  p.teleport(x0, FY, z0 + 4);
  // Each turned round to its own colour.
  for (const q of peds) {
    let n = 0;
    while (w.getBlock(q.x, FY, q.z) !== B[DISCS[q.dir]] && n++ < 6) d.interact(q.x, FY, q.z, BLOCKS[w.getBlock(q.x, FY, q.z)]);
  }
  assert.ok(peds.every((q) => w.getState(q.x, FY, q.z)), 'all five shining');
  run(game, input, 2);
  assert.equal(w.getBlock(door.x, FY, door.z), B.air, 'the chamber open');
  // (Made again: put back.)
  for (const y of [FY, FY + 1]) w.setBlock(door.x, y, door.z, B.tv_bronzedoor);
  restore(d);
  assert.equal(w.getBlock(door.x, FY, door.z), B.air, 'still open');
});

test('the crack by the artisans\' tally gives onto their tunnel', () => {
  const { game, d, x0, z0 } = inVault();
  const t = { x: x0 + 6, z: z0 - 3 };
  for (const y of [FY, FY + 1]) game.world.setBlock(t.x, y, t.z, B.tv_crack);
  d.data.tunnels = [{ ...t, room: 0 }];
  d.interact(t.x, FY, t.z, BLOCKS[B.tv_crack]);
  assert.equal(game.world.getBlock(t.x, FY, t.z), B.air);
  for (const y of [FY, FY + 1]) game.world.setBlock(t.x, y, t.z, B.tv_crack);
  restore(d);
  assert.equal(game.world.getBlock(t.x, FY, t.z), B.air, 'still open');
});

test('the version and its step', () => {
  assert.ok(compareVersions(GAME_VERSION, '1.4.0') >= 0);
  assert.ok(stepsFor('1.3.0').some((s) => s.to === '1.4.0'));
});

test('the Terracotta Vault\'s masters are painted by hand, every part in place', () => {
  assert.deepEqual(Object.keys(VAULT_BOSS_ART).sort(), ['jade_dragon', 'terracotta_general']);
  for (const [k, A] of Object.entries(VAULT_BOSS_ART)) {
    assert.ok(SPECIES[k], `${k} is a species`);
    assert.ok(FORGE[k] && FORGE[k].pix, `${k} is painted`);
    assert.equal(A.size, 64);
    assert.equal(A.body.rows.length, 64, `${k} has a body`);
    for (const [n, q] of Object.entries(A.parts)) assert.ok(q.pix && q.pix.rows.length, `${k}.${n} has a picture`);
  }
});
