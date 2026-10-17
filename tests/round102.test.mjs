// Round 102: the Tide Grotto made over. Its tiles and things drawn afresh;
// its floors laid out by its own architect (the tidal flat, the clam beds,
// the divers' camp, the sea-shrine, the blowhole, the eel-run, the
// glow-pool) beside its old rooms, every one walkable, up its shelves and
// down into its channels; what's written there made from its own history
// and its town's; its new creatures drawn; and the tide at work: the
// flats flooding and draining on its clock, the clams opening at low
// water, the three pearls and the sea-door, the bell, the blowhole, the
// urchins, the drowned rising, the moray's lunge, the jelly's sting, the
// shrimpkin's mending; and its three masters painted by hand.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGame, stubInput } from './helpers.mjs';
import { DungeonRun } from '../src/game/dungeon.js';
import { buildFloor, FY } from '../src/world/dungeongen.js';
import { BLOCKS, B } from '../src/world/blocks.js';
import { SPECIES } from '../src/entities/creature.js';
import { GROTTO_SPECIES } from '../src/entities/grottomobs.js';
import { GROTTO_MOBS } from '../src/render/art/grotto_mobs.js';
import { GROTTO_SPRITES, grottoTop, grottoFront } from '../src/render/art/grotto_tex.js';
import { grottoLore } from '../src/world/deeps/grottolore.js';
import { GROTTO_OWN } from '../src/world/deeps/grotto.js';
import { addItem, countItem } from '../src/game/inventory.js';
import { gtT, TIDE, levelAt, tideLevel } from '../src/game/grottowork.js';
import { GAME_VERSION, compareVersions } from '../src/version.js';
import { stepsFor } from '../src/game/migrate.js';
import { GROTTO_BOSS_ART } from '../src/render/art/grotto_bosses.js';
import { FORGE, forgePaint } from '../src/render/forge.js';
import '../src/render/bossbody.js';

const rec = (s) => ({ id: `g${s}`, type: 'grotto', isle: 'myrrow', seed: 1000 + s * 31, depth: 3, level: 2, vaultFloor: 1, origin: { who: 'the Pearl-Queen Kailani', y: 1201 }, townName: 'Saltmarrow' });
const at = (f, x, y, z) => {
  const r = f.regions.get(Math.floor(x / 64) * 4096 + Math.floor(z / 36));
  return r ? r.get(x % 64, y, z % 36) : 0;
};
const PASS = new Set(['sealed', 'portcullis', 'boss_gate']);
// Every tile you can walk to (or swim) from the way in: a step up or down
// at a time, or up a ladder.
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
    if (at(f, f.x0 + x, FY - 1, z) === B.water && at(f, f.x0 + x, FY - 2, z) === B.water) return FY - 1;
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

test('every floor of a Tide Grotto can be walked (or swum), up onto its shelves and down into its channels', () => {
  for (let s = 0; s < 6; s++) for (let n = 0; n < 3; n++) assert.equal(reach(buildFloor(rec(s), n)), 0, `seed ${s} floor ${n}`);
});

test('a floor of a Tide Grotto is laid out as a Tide Grotto: its own rooms, its flats, its clams, its shrine, its creatures', () => {
  const kits = new Set();
  let clams = 0;
  let shells = 0;
  let tide = 0;
  let blow = 0;
  let morays = 0;
  let lying = 0;
  let present = 0;
  for (let s = 0; s < 6; s++) {
    for (let n = 0; n < 3; n++) {
      const f = buildFloor(rec(s), n);
      for (const r of f.rooms) kits.add(r.kit);
      clams += (f.clams || []).length;
      shells += (f.shells || []).length;
      tide += (f.tide || []).length;
      blow += (f.blowholes || []).length;
      morays += f.spawns.filter((q) => q.species === 'moray' && q.hole).length;
      lying += f.spawns.filter((q) => q.lying).length;
      if (n === 0) assert.ok(f.rooms.some((r) => r.kit === 'divecamp'), 'a divers\' camp on the first floor');
      // (Now and then a way's dug through one to join the doors: see
      // ensureWays. The clams it's dug through are let be.)
      for (const c of f.clams || []) if (at(f, c.x, FY, c.z) === B.gt_clam) present++;
      for (const sh of f.shells || []) {
        assert.equal(sh.shells.length, 3);
        for (const q of sh.shells) assert.equal(at(f, q.x, FY, q.z), B.gt_scallop);
        assert.equal(at(f, sh.door.x, FY, sh.door.z), B.gt_seadoor);
      }
      for (const t of f.tide || []) assert.ok([B.gt_wetsand, B.gt_urchins, B.water].includes(at(f, t.x, FY - 1, t.z)), 'the tide over the flats and channels');
    }
  }
  for (const k of GROTTO_OWN) assert.ok(kits.has(k), `the ${k}`);
  assert.ok(present >= clams * 0.95, `${present} of ${clams} clams where they say`);
  assert.ok(clams > 20 && shells > 3 && tide > 300 && blow > 1 && morays > 3 && lying > 5, `${clams} ${shells} ${tide} ${blow} ${morays} ${lying}`);
});

test('what\'s written in a Tide Grotto is its own, its town\'s, and the same each time', () => {
  const a = grottoLore(rec(1), 0, 'tide_mother');
  const b = grottoLore(rec(1), 0, 'tide_mother');
  for (const k of ['carving', 'law', 'count', 'pole', 'shell', 'log', 'prayer', 'cairn', 'last']) {
    const t = a[k]();
    assert.deepEqual(t, b[k](), k);
    assert.ok(t.title && t.lines.length >= 1 && t.lines.every((l) => typeof l === 'string' && l.length > 3), k);
  }
  assert.ok(a.carving().lines.join(' ').includes('the Pearl-Queen Kailani'));
  assert.ok(a.carving().lines.join(' ').includes('Saltmarrow'));
  assert.ok(a.last().title.includes('Tide-Mother'));
  // (The rule they broke is always on the tide-law.)
  assert.ok(a.law().lines.length >= 5);
  const titles = new Set();
  for (let s = 1; s <= 4; s++) for (let n = 0; n < 3; n++) for (const l of buildFloor(rec(s), n).lore) titles.add(l.title);
  for (const t of ['The Tide-Mother, Carved', 'The Dive-Count', 'The Tide-Law', 'The Tide-Pole', 'Scratched in a Shell', 'The Spiral of Shells']) assert.ok(titles.has(t), t);
});

test('the Tide Grotto\'s tiles and things are drawn; its new creatures are in the game and drawn', () => {
  for (const n of ['gt_rock', 'gt_sand', 'gt_wetsand', 'gt_shelf', 'gt_pebbles', 'gt_mosaic', 'gt_boardwalk', 'gt_urchins', 'gt_mussels', 'gt_seadoor']) assert.ok(grottoTop(n, 0), `${n} top`);
  for (const n of ['gt_rock', 'gt_mussels', 'gt_coralwall', 'gt_glowwall', 'gt_tidemark', 'gt_shellwall', 'gt_seadoor', 'gt_eelhole', 'gt_carving', 'gt_shelf', 'gt_boardwalk', 'gt_sand']) assert.ok(grottoFront(n, 0), `${n} front`);
  for (const [k, fn] of Object.entries(GROTTO_SPRITES)) {
    assert.ok(BLOCKS[B[k]], `${k} is a block`);
    for (const st of [false, true]) assert.ok(fn(0, st, 0), `${k} drawn`);
  }
  for (const sp of Object.keys(GROTTO_SPECIES)) {
    assert.ok(SPECIES[sp], `${sp} is a species`);
    assert.ok(GROTTO_MOBS[sp] && GROTTO_MOBS[sp].rows.length === 24, `${sp} is drawn`);
  }
  assert.ok(GROTTO_MOBS.drowned_diver.groups.rest, 'the diver lying in the sand');
});

// ------------------------------------------------------- in the grotto itself
function inGrotto() {
  const game = makeGame(12345);
  const input = stubInput();
  game.minute = 600;
  for (let i = 0; i < 20; i++) game.update(0.1, input);
  const base = game.sim.dungeons.all.find((q) => q.type === 'grotto');
  const r = { ...base, floors: {}, cleared: false, pack: null, weakened: 0 };
  new DungeonRun(game, r).enter();
  const d = game.dungeon;
  for (const c of game.creatures) {
    c.dead = true;
    game.removeOcc(c);
  }
  game.creatures = [];
  game.cheats = { ...(game.cheats || {}), god: false };
  for (const k of ['clams', 'shells', 'tide', 'blowholes', 'bells']) d.data[k] = [];
  // A clear stretch of sand, 15 by 8, about the way in.
  const e = d.data.rooms.find((q) => q.kit === 'entry');
  const x0 = d.data.x0 + e.cx - 7;
  const z0 = e.cz - 2;
  for (let z = z0 - 2; z <= z0 + 5; z++) {
    for (let x = x0 - 1; x <= x0 + 15; x++) {
      for (const y of [FY, FY + 1, FY + 2]) game.world.setBlock(x, y, z, B.air);
      game.world.setBlock(x, FY - 1, z, B.gt_sand);
      game.world.setBlock(x, FY - 2, z, B.gt_rock);
    }
  }
  const p = game.player;
  p.teleport(x0, FY, z0 + 2);
  p.hp = p.maxHp = 200;
  d.grottoT = null;
  return { game, input, d, p, x0, z0 };
}
const run = (game, input, secs) => {
  for (let t = 0; t < secs; t += 0.05) game.update(0.05, input);
};
// (The tide's clock set to a moment of its turn.)
const tideTo = (d, t) => (gtT(d).clock = t);

test('the tide comes in over the flats on its clock, and goes out again; wading it is slow', () => {
  const { game, input, d, p, x0, z0 } = inGrotto();
  const w = game.world;
  assert.equal(levelAt(0), 0);
  assert.equal(levelAt(TIDE.high + 1), 1);
  const flats = [];
  for (let x = x0 + 2; x <= x0 + 8; x++) {
    w.setBlock(x, FY - 1, z0 + 2, B.gt_wetsand);
    flats.push({ x, z: z0 + 2 });
  }
  // A channel too: sunk, water in it always.
  const ch = { x: x0 + 10, z: z0 + 2 };
  w.setBlock(ch.x, FY - 1, ch.z, B.water);
  w.setBlock(ch.x, FY - 2, ch.z, B.gt_shelf);
  d.data.tide = [...flats, { ...ch, deep: true }];
  p.teleport(x0 + 4, FY, z0 + 2);
  tideTo(d, 1);
  run(game, input, 0.2);
  assert.ok(flats.every((q) => w.getBlock(q.x, FY, q.z) === B.air), 'low water');
  tideTo(d, TIDE.high + 0.5);
  run(game, input, 0.2);
  assert.ok(flats.every((q) => w.getBlock(q.x, FY, q.z) === B.water), 'high water over the flats');
  assert.equal(w.getBlock(ch.x, FY, ch.z), B.water, 'the channel deep enough to swim');
  assert.ok(tideLevel(d) >= 0.99);
  assert.ok(p.tideT > 0, 'wading the tide');
  // (Kept without the tide's water in it.)
  d.saveFloor();
  assert.ok(flats.every((q) => w.getBlock(q.x, FY, q.z) === B.air), 'let out before the floor is kept');
  tideTo(d, TIDE.ebb + 7.9);
  run(game, input, 0.3);
  assert.ok(flats.every((q) => w.getBlock(q.x, FY, q.z) === B.air), 'gone out again');
});

test('the clams open at low water and shut at high; reach in for the pearl (and it may snap)', () => {
  const { game, input, d, p, x0, z0 } = inGrotto();
  const w = game.world;
  const c = { x: x0 + 4, z: z0 + 1 };
  w.setBlock(c.x, FY, c.z, B.gt_clam);
  d.data.clams = [{ ...c, pearl: true, room: 0 }];
  p.inv.fill(null);
  tideTo(d, TIDE.high + 1);
  run(game, input, 0.2);
  assert.equal(w.getState(c.x, FY, c.z), false, 'shut at high water');
  d.interact(c.x, FY, c.z, BLOCKS[B.gt_clam]);
  assert.equal(countItem(p.inv, 'pearl'), 0);
  tideTo(d, 1);
  run(game, input, 0.2);
  assert.ok(w.getState(c.x, FY, c.z), 'open at low water');
  assert.equal(w.getMeta(c.x, FY, c.z) & 1, 1, 'its pearl showing');
  d.interact(c.x, FY, c.z, BLOCKS[B.gt_clam]);
  assert.equal(countItem(p.inv, 'pearl'), 1, 'the pearl');
  d.interact(c.x, FY, c.z, BLOCKS[B.gt_clam]);
  assert.equal(countItem(p.inv, 'pearl'), 1, 'only the one');
});

test('three pearls in the three shells, and the sea-door opens', () => {
  const { game, input, d, p, x0, z0 } = inGrotto();
  const w = game.world;
  const shells = [0, 2, 4].map((k) => ({ x: x0 + 3 + k, z: z0 + 1 }));
  for (const q of shells) w.setBlock(q.x, FY, q.z, B.gt_scallop);
  const door = { x: x0 + 12, z: z0 - 2 };
  for (const y of [FY, FY + 1]) w.setBlock(door.x, y, door.z, B.gt_seadoor);
  d.data.shells = [{ shells, door, room: 0 }];
  p.inv.fill(null);
  d.interact(shells[0].x, FY, shells[0].z, BLOCKS[B.gt_scallop]);
  assert.equal(w.getState(shells[0].x, FY, shells[0].z), false, 'no pearl, nothing laid');
  addItem(p.inv, 'pearl', 3);
  for (const q of shells) d.interact(q.x, FY, q.z, BLOCKS[B.gt_scallop]);
  assert.equal(countItem(p.inv, 'pearl'), 0, 'all three laid');
  assert.ok(shells.every((q) => w.getState(q.x, FY, q.z)));
  run(game, input, 2);
  assert.equal(w.getBlock(door.x, FY, door.z), B.air, 'the sea-door open');
  assert.ok(d.state.grotto.opened[`${door.x},${door.z}`]);
});

test('the tide-bell tells the tide, and rings as it turns', () => {
  const { game, input, d, x0, z0 } = inGrotto();
  const w = game.world;
  const b = { x: x0 + 5, z: z0 + 1 };
  w.setBlock(b.x, FY, b.z, B.gt_bell);
  d.data.bells = [{ ...b, room: 0 }];
  const said = [];
  game.ui.msg = (t) => said.push(t);
  tideTo(d, 1);
  d.interact(b.x, FY, b.z, BLOCKS[B.gt_bell]);
  assert.ok(said.some((t) => /tide is out/.test(t)), said.join('|'));
  tideTo(d, TIDE.flood - 0.1);
  run(game, input, 0.3);
  assert.ok(w.getState(b.x, FY, b.z), 'it rang as the tide turned');
  assert.ok(said.some((t) => /coming in/.test(t)));
});

test('at high water the blowhole spouts and throws whoever\'s on it up onto the ledge', () => {
  const { game, input, d, p, x0, z0 } = inGrotto();
  const w = game.world;
  const top = { x: x0 + 6, y: FY + 2, z: z0 - 1 };
  for (const y of [FY, FY + 1]) w.setBlock(top.x, y, top.z, B.gt_rock);
  const bh = { x: x0 + 6, z: z0 };
  w.setBlock(bh.x, FY, bh.z, B.gt_blowhole);
  d.data.blowholes = [{ ...bh, top, room: 0 }];
  p.teleport(bh.x, FY, bh.z);
  tideTo(d, 1);
  run(game, input, 0.5);
  assert.equal(p.y, FY, 'not at low water');
  // (It spouts a moment in every three of high water.)
  tideTo(d, 42.2 - ((bh.x * 0.37) % 3));
  run(game, input, 0.3);
  assert.equal(p.y, FY + 2, 'up onto the ledge');
  assert.equal(p.x, top.x);
});

test('the urchins spine whoever steps on them', () => {
  const { game, input, p, x0, z0 } = inGrotto();
  game.world.setBlock(x0 + 3, FY - 1, z0 + 2, B.gt_urchins);
  p.teleport(x0 + 3, FY, z0 + 2);
  const hp = p.hp;
  run(game, input, 0.2);
  assert.ok(p.hp < hp && p.slowT > 0, 'spined');
});

test('a drowned diver lies in the sand till the tide raises it (or a blow); in the water its grab holds you under', () => {
  const { game, input, d, p, x0, z0 } = inGrotto();
  const c = d.spawn('drowned_diver', x0 + 6, FY, z0 + 2, { lying: true });
  p.teleport(x0 + 4, FY, z0 + 2);
  tideTo(d, 1);
  run(game, input, 1);
  assert.ok(c.lying, 'still lying at low water');
  assert.equal(c.x, x0 + 6);
  tideTo(d, TIDE.high + 1);
  run(game, input, 0.2);
  assert.ok(!c.lying, 'risen with the tide');
  const c2 = d.spawn('drowned_diver', x0 + 9, FY, z0 + 2, { lying: true });
  tideTo(d, 1);
  game.damage(c2, 1, p);
  assert.ok(!c2.lying, 'struck, it rises');
  // In the water, its grab holds you.
  game.world.setBlock(p.x, FY, p.z, B.water);
  SPECIES.drowned_diver.onHit(game, c, p);
  assert.ok(p.rootT > 0, 'held under');
});

test('a moray lunges down its line, drags you toward its hole, and is only open while it\'s out', () => {
  const { game, input, d, p, x0, z0 } = inGrotto();
  const w = game.world;
  for (const y of [FY, FY + 1]) w.setBlock(x0 + 6, y, z0 - 2, B.gt_eelhole);
  const c = d.spawn('moray', x0 + 6, FY, z0 - 1, { hole: { x: x0 + 6, z: z0 - 2 }, out: { x: 0, z: 1 } });
  // In its hole, blows turned.
  const hp0 = c.hp;
  game.damage(c, 8, p);
  assert.ok(hp0 - c.hp <= 2, 'turned by the rock');
  p.teleport(x0 + 6, FY, z0 + 2);
  const hp = p.hp;
  run(game, input, 1);
  assert.ok(p.hp < hp, 'bitten');
  assert.equal(p.z, z0 + 1, 'dragged toward its hole');
  assert.ok(c.outT > 0, 'out, and open');
  const h1 = c.hp;
  game.damage(c, 4, p);
  assert.equal(h1 - c.hp, 4, 'struck true');
});

test('a lantern jelly stings; stranded on the sand it lies still and stings whoever steps by; burst, its threads sting', () => {
  const { game, input, d, p, x0, z0 } = inGrotto();
  const j = d.spawn('lantern_jelly', x0 + 6, FY, z0 + 2, {});
  p.teleport(x0 + 5, FY, z0 + 2);
  const hp = p.hp;
  // (Round 116: it gathers its light first, the best part of a second.)
  run(game, input, 1.2);
  assert.ok(j.lying, 'stranded, out of the water');
  assert.equal(j.x, x0 + 6, 'it doesn\'t go anywhere');
  assert.ok(p.hp < hp && p.stunT >= 0, 'stung');
  SPECIES.lantern_jelly.onHit(game, j, p);
  assert.ok(p.stunT > 0.5, 'a jolt');
  game.damage(j, 99, p);
  run(game, input, 0.1);
  assert.ok(gtT(d).threads.length, 'its threads left');
});

test('the shrimpkin mend whatever is most hurt near them: the drowned you\'re fighting, or you', () => {
  const { game, input, d, p, x0, z0 } = inGrotto();
  const s = d.spawn('shrimpkin', x0 + 5, FY, z0 + 2, { peaceful: true });
  const c = d.spawn('drowned_diver', x0 + 8, FY, z0 + 3, {});
  c.dormant = 99;
  c.waiting = true;
  c.hp = 4;
  p.teleport(x0 + 1, FY, z0 + 4);
  run(game, input, 6);
  assert.ok(c.hp > 4, 'the diver mended');
  assert.ok(!s.dead && s.peaceful);
});

test('the version and its step', () => {
  assert.ok(compareVersions(GAME_VERSION, '1.2.0') >= 0);
  assert.ok(stepsFor('1.1.0').some((s) => s.to === '1.2.0'));
});

test('the Tide Grotto\'s masters are painted by hand, every part in place', () => {
  assert.deepEqual(Object.keys(GROTTO_BOSS_ART).sort(), ['abyssal_clam', 'coral_colossus', 'tide_mother']);
  for (const [k, A] of Object.entries(GROTTO_BOSS_ART)) {
    assert.ok(SPECIES[k], `${k} is a species`);
    assert.ok(FORGE[k] && FORGE[k].pix, `${k} is painted`);
    assert.equal(A.size, 64);
    assert.equal(A.body.rows.length, 64, `${k} has a body`);
    for (const [n, q] of Object.entries(A.parts)) assert.ok(q.pix && q.pix.rows.length, `${k}.${n} has a picture`);
  }
  // (The Mother's head and flipper; drawn into her shell as she spins.)
  const tm = FORGE.tide_mother;
  assert.ok(tm.parts.head && tm.parts.flipper);
  const st = {};
  SPECIES.tide_mother.artSt({ spinT: 2 }, st);
  assert.equal(st.shell, 1);
  assert.equal(tm.parts.head.show({ st }), false);
  assert.equal(tm.parts.head.show({ st: {} }), true);
  assert.notEqual(forgePaint('tide_mother', 0, { shell: 1 }).d.join(','), forgePaint('tide_mother', 0, {}).d.join(','));
  // (The clam's upper valve lifts on its hinge, clockwise, as it's prised
  // open, and its mantle and pearl show.)
  const sh = FORGE.abyssal_clam.parts.shell;
  assert.ok(sh.extra({ st: { open: 1 }, t: 0 }) > 0.4);
  assert.ok(Math.abs(sh.extra({ st: {}, t: 0 })) < 0.15);
  assert.notEqual(forgePaint('abyssal_clam', 0, { open: 1 }).d.join(','), forgePaint('abyssal_clam', 0, {}).d.join(','));
  // (The colossus's arms; it strides; its eyes go white as it winds up.)
  const cc = FORGE.coral_colossus;
  assert.ok(cc.parts.armN && cc.parts.armF && cc.walk);
  assert.notEqual(forgePaint('coral_colossus', 0, { wind: 1 }).d.join(','), forgePaint('coral_colossus', 0, {}).d.join(','));
});
