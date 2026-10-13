// Round 100: the Wildwood Hollow made over. Its tiles and things drawn
// afresh; its floors laid out by its own architect (the hollow and its
// bank, the rootway, the dell, the keepers' shrine, the hall of the Kept,
// the sunwell, the woodcutters' camp; the ring's glade, sealed) beside its
// old rooms, every one walkable, up its banks and roots; what's written
// there made from its own history and its town's; its new creatures drawn;
// and its works at work: the offering stone and the hob, the sun-seed and
// the roots it grows, the ring that takes you, the snares, the puffballs,
// the drowsebloom's pollen, the glimmer that rides the hurt, the delver
// under the floor, the woodwose that roots; and its three masters painted
// by hand.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGame, stubInput } from './helpers.mjs';
import { DungeonRun } from '../src/game/dungeon.js';
import { buildFloor, FY, DTYPES } from '../src/world/dungeongen.js';
import { BLOCKS, B } from '../src/world/blocks.js';
import { SPECIES } from '../src/entities/creature.js';
import { GROVE_SPECIES } from '../src/entities/grovemobs.js';
import { GROVE_MOBS } from '../src/render/art/grove_mobs.js';
import { GROVE_SPRITES, groveTop, groveFront, groveFlat } from '../src/render/art/grove_tex.js';
import { GROVE_BOSS_ART } from '../src/render/art/grove_bosses.js';
import { FORGE, forgePaint, forgePartPx } from '../src/render/forge.js';
import '../src/render/bossbody.js';
import { groveLore, RULES } from '../src/world/deeps/grovelore.js';
import { GROVE_OWN } from '../src/world/deeps/grove.js';
import { addItem, countItem } from '../src/game/inventory.js';
import { grT } from '../src/game/grovework.js';
import { GAME_VERSION, compareVersions } from '../src/version.js';
import { stepsFor } from '../src/game/migrate.js';

const rec = (s) => ({ id: `g${s}`, type: 'grove', isle: 'thessa', seed: 1000 + s * 31, depth: 3, level: 2, vaultFloor: 1, origin: { who: 'the Green Lady', y: 1201 }, townName: 'Quillcross' });
// (A tile of a floor as built: `x` the world's.)
const at = (f, x, y, z) => {
  const r = f.regions.get(Math.floor(x / 64) * 4096 + Math.floor(z / 36));
  return r ? r.get(x % 64, y, z % 36) : 0;
};
const PASS = new Set(['sealed', 'portcullis', 'boss_gate']);
// Every tile you can walk to from the way in: a step up or down at a time,
// or up a ladder (the roots grown up a bank).
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
  return { seen, stand };
}

test('every floor of the Hollow can be walked, up its banks and down into its dells', () => {
  for (let s = 1; s <= 6; s++) {
    for (let n = 0; n < 3; n++) {
      const f = buildFloor(rec(s), n);
      const { seen, stand } = reach(f);
      const P = f.plan;
      for (const r of f.rooms) {
        if (r.kit === 'hidden' || r.sealed) continue;
        for (let z = r.z0; z <= r.z1; z++) {
          for (let x = r.x0; x <= r.x1; x++) {
            if (P.room[z * P.W + x] !== r.id) continue;
            const h = stand(x, z);
            // (Not the top of a 2-high ledge: what's kept up there is got at by
            // the roots grown up it.)
            if (h === null || h === FY + 2) continue;
            assert.ok(seen.has(z * P.W + x), `${s}/${n}: a tile of the ${r.kit} room (${x},${z}) can't be reached`);
          }
        }
      }
      if (f.downAt) assert.ok(seen.has(f.downAt.z * P.W + f.downAt.x - f.x0), `${s}/${n}: the way down`);
    }
  }
});

test('a floor of the Hollow is laid out as the Hollow: its own rooms, its stone and hob, its sunwell, its ring', () => {
  const kits = new Set();
  let hobs = 0;
  let wells = 0;
  let rings = 0;
  let kept = 0;
  for (let s = 1; s <= 6; s++) {
    for (let n = 0; n < 3; n++) {
      const f = buildFloor(rec(s), n);
      for (const r of f.rooms) kits.add(r.kit);
      for (const h of f.hobs || []) {
        hobs++;
        assert.equal(at(f, h.stone.x, FY, h.stone.z), B.gr_offering, 'the offering stone');
        if (h.door) assert.equal(at(f, h.door.x, FY, h.door.z), B.gr_rootdoor, 'the roots across what it keeps');
      }
      for (const w of f.sunwells || []) {
        wells++;
        assert.equal(at(f, w.beam.x, FY, w.beam.z), B.gr_sunbeam, 'the daylight');
        // (Its seed somewhere else on the floor.)
        if (w.seed) assert.equal(at(f, w.seed.x, FY, w.seed.z), B.gr_seedpod, 'the seed pod');
      }
      for (const g of f.rings || []) {
        rings++;
        assert.ok(g.to && g.back, 'its glade and the way back');
        assert.ok(!BLOCKS[at(f, g.to.x, FY, g.to.z)].solid, 'its glade open');
      }
      for (let z = 0; z < f.plan.D; z++) for (let x = 0; x < f.plan.W; x++) if (at(f, f.x0 + x, FY, z) === B.gr_keptroot) kept++;
    }
  }
  for (const k of GROVE_OWN) assert.ok(kits.has(k), `some floor has a ${k}`);
  assert.ok(hobs > 2 && wells > 2 && rings > 0 && kept > 5, `hobs ${hobs}, sunwells ${wells}, rings ${rings}, kept ${kept}`);
  assert.ok(DTYPES.grove.arch, 'its own architect');
});

test('what\'s written in the Hollow is its own, its town\'s, and the same each time', () => {
  const a = groveLore(rec(1), 0, 'hollow_oak');
  const b = groveLore(rec(1), 0, 'hollow_oak');
  assert.deepEqual(a.rulestone(), b.rulestone());
  assert.deepEqual(a.first(), b.first());
  assert.ok(a.rules.includes(a.fault), 'the broken rule is one of those cut in the stone');
  assert.ok(a.rulestone().lines.some((l) => l.includes(RULES[a.fault])));
  assert.ok(a.first().lines.join(' ').includes('Quillcross'), 'the town remembers');
  assert.ok(a.last().title.includes('Hollow Oak'));
  assert.ok(a.arrive().includes('the Green Lady'), 'what\'s said coming in');
  for (const k of ['rulestone', 'kept', 'first', 'rags', 'greenman', 'stump', 'camp', 'last']) {
    const t = a[k]();
    assert.ok(t.title && t.lines.length >= 1 && t.lines.every((l) => typeof l === 'string' && l.length > 3), k);
  }
  const titles = new Set();
  for (let n = 0; n < 3; n++) for (const l of buildFloor(rec(2), n).lore) titles.add(l.title);
  assert.ok(titles.has('The Rule-Stone') && titles.has('One of the Kept'), [...titles].join(', '));
});

test('the Hollow\'s tiles and things are drawn; its new creatures are in the game and drawn', () => {
  for (const k of ['gr_roots', 'gr_moss', 'gr_litter', 'gr_worn', 'gr_flags', 'gr_mould', 'gr_bank']) {
    for (let v = 0; v < 4; v++) assert.ok(groveTop(k, v).d.some((q) => q), `${k} top`);
  }
  for (const k of ['gr_roots', 'gr_glowshelf', 'gr_earth', 'gr_greenman', 'gr_kept', 'gr_knot', 'gr_rootdoor', 'gr_bank']) assert.ok(groveFront(k, 0).d.some((q) => q), `${k} face`);
  for (const k of ['gr_rootflat', 'gr_snare']) assert.ok(groveFlat(k, 0).d.some((q) => q), `${k} flat`);
  for (const [k, f] of Object.entries(GROVE_SPRITES)) {
    for (const st of [0, 1]) assert.ok(f(0, st, 0).d.some((q) => q), `${k} is drawn`);
    assert.ok(BLOCKS[B[k]], `${k} is a block`);
  }
  for (const sp of Object.keys(GROVE_SPECIES)) {
    assert.ok(SPECIES[sp], `${sp} is a species`);
    assert.ok(GROVE_MOBS[sp] && GROVE_MOBS[sp].rows.length === 24, `${sp} is drawn`);
  }
});

// ------------------------------------------------------- in the Hollow itself
function inHollow() {
  const game = makeGame(12345);
  const input = stubInput();
  game.minute = 600;
  for (let i = 0; i < 20; i++) game.update(0.1, input);
  const base = game.sim.dungeons.all.find((q) => q.type === 'grove');
  const r = { ...base, floors: {}, cleared: false, pack: null, weakened: 0 };
  new DungeonRun(game, r).enter();
  const d = game.dungeon;
  for (const c of game.creatures) {
    c.dead = true;
    game.removeOcc(c);
  }
  game.creatures = [];
  game.cheats = { ...(game.cheats || {}), god: false };
  d.data.rings = [];
  d.data.hobs = [];
  d.data.sunwells = [];
  // A clear stretch of moss, 15 by 8, about the way in.
  const e = d.data.rooms.find((q) => q.kit === 'entry');
  const x0 = d.data.x0 + e.cx - 7;
  const z0 = e.cz - 2;
  for (let z = z0 - 2; z <= z0 + 5; z++) {
    for (let x = x0 - 1; x <= x0 + 15; x++) {
      for (const y of [FY, FY + 1, FY + 2]) game.world.setBlock(x, y, z, B.air);
      game.world.setBlock(x, FY - 1, z, B.gr_moss);
      game.world.setBlock(x, FY - 2, z, B.gr_roots);
    }
  }
  const p = game.player;
  p.teleport(x0, FY, z0 + 2);
  p.hp = p.maxHp = 200;
  d.groveT = null;
  return { game, input, d, p, x0, z0 };
}
const run = (game, input, secs) => {
  for (let t = 0; t < secs; t += 0.05) game.update(0.05, input);
};

test('food left at the offering stone: the roots draw back from what they keep', () => {
  const { game, input, d, p, x0, z0 } = inHollow();
  const stone = { x: x0 + 5, z: z0 };
  const door = { x: x0 + 8, z: z0 - 1 };
  game.world.setBlock(stone.x, FY, stone.z, B.gr_offering);
  for (const y of [FY, FY + 1]) game.world.setBlock(door.x, y, door.z, B.gr_rootdoor);
  d.data.hobs = [{ stone, door }];
  const hob = d.spawn('hob', x0 + 6, FY, z0 + 2, {});
  p.teleport(stone.x, FY, stone.z + 1);
  // Nothing to give, nothing done.
  p.inv.fill(null);
  d.interact(stone.x, FY, stone.z, BLOCKS[B.gr_offering]);
  run(game, input, 2);
  assert.equal(game.world.getBlock(door.x, FY, door.z), B.gr_rootdoor);
  addItem(p.inv, 'honeycomb', 2);
  d.interact(stone.x, FY, stone.z, BLOCKS[B.gr_offering]);
  assert.equal(countItem(p.inv, 'honeycomb'), 1, 'one left in the bowl');
  assert.ok(game.world.getState(stone.x, FY, stone.z), 'the bowl full');
  run(game, input, 2);
  assert.equal(game.world.getBlock(door.x, FY, door.z), B.air, 'the roots drawn back');
  assert.equal(game.world.getBlock(door.x, FY + 1, door.z), B.air);
  assert.ok(!hob.dead && !d.woodTurned, 'and the hob content');
  d.leave();
});

test('the sun-seed, found and planted in the daylight, grows roots up the bank', () => {
  const { game, input, d, p, x0, z0 } = inHollow();
  const beam = { x: x0 + 7, z: z0 };
  const seed = { x: x0 + 2, z: z0 + 4 };
  game.world.setBlock(beam.x, FY, beam.z, B.gr_sunbeam);
  game.world.setBlock(seed.x, FY, seed.z, B.gr_seedpod);
  d.data.sunwells = [{ beam, rot: 0, room: 0, seed }];
  p.inv.fill(null);
  d.interact(beam.x, FY, beam.z, BLOCKS[B.gr_sunbeam]);
  assert.equal(game.world.getBlock(beam.x, FY, beam.z), B.gr_sunbeam, 'nothing to plant');
  d.interact(seed.x, FY, seed.z, BLOCKS[B.gr_seedpod]);
  assert.equal(countItem(p.inv, 'sun_seed'), 1, 'the seed taken up');
  assert.equal(game.world.getBlock(seed.x, FY, seed.z), B.air);
  d.interact(beam.x, FY, beam.z, BLOCKS[B.gr_sunbeam]);
  assert.equal(countItem(p.inv, 'sun_seed'), 0, 'and planted');
  assert.equal(game.world.getBlock(beam.x, FY, beam.z), B.gr_sprout);
  run(game, input, 4);
  for (const y of [FY, FY + 1]) {
    assert.equal(game.world.getBlock(beam.x, y, beam.z), B.gr_rootladder, 'the roots grown up the bank');
    assert.ok(BLOCKS[B.gr_rootladder].ladder);
  }
  assert.ok(d.state.grove.grown[`${beam.x},${beam.z}`], 'and it stays grown');
  d.leave();
});

test('the ring takes you to its glade, and its toadstools put you back', () => {
  const { game, input, d, p, x0, z0 } = inHollow();
  const g = { x: x0 + 3, z: z0 + 1, rx: 2, rz: 1.6, to: { x: x0 + 12, z: z0 + 3 }, back: { x: x0 + 13, z: z0 + 3 } };
  d.data.rings = [g];
  p.teleport(g.x, FY, g.z);
  run(game, input, 0.2);
  assert.ok(Math.abs(p.x - g.to.x) <= 2 && Math.abs(p.z - g.to.z) <= 2, `taken (${p.x},${p.z})`);
  run(game, input, 2.2);
  p.teleport(g.back.x, FY, g.back.z);
  run(game, input, 0.2);
  assert.ok(Math.abs(p.x - g.x) <= 3 && Math.abs(p.z - g.z) <= 4, `and put back (${p.x},${p.z})`);
  d.leave();
});

test('a snare root catches you; a puffball trodden on bursts, and its spores slow you', () => {
  const { game, input, d, p, x0, z0 } = inHollow();
  game.world.setBlock(x0 + 4, FY, z0 + 2, B.gr_snare);
  const w = d.spawn('thornling', x0 + 8, FY, z0 + 4, { dormant: 99 });
  p.teleport(x0 + 4, FY, z0 + 2);
  run(game, input, 0.1);
  assert.ok(p.grabbedT > 0, 'caught');
  assert.equal(w.dormant, 0, 'and the wood comes to see');
  game.world.setBlock(x0 + 10, FY, z0 + 2, B.gr_puffball);
  p.grabbedT = 0;
  p.teleport(x0 + 10, FY, z0 + 2);
  run(game, input, 0.1);
  assert.ok(game.world.getState(x0 + 10, FY, z0 + 2), 'burst');
  assert.ok(grT(d).clouds.length > 0 && p.slowT > 0, 'and drowsy');
  d.leave();
});

test('a drowsebloom puffs its pollen at you, then shuts (hard to hurt)', () => {
  const { game, input, d, p, x0, z0 } = inHollow();
  const b = d.spawn('drowsebloom', x0 + 6, FY, z0 + 2, {});
  b.target = p;
  b.puffCd = 0;
  p.teleport(x0 + 4, FY, z0 + 2);
  run(game, input, 0.2);
  assert.ok(grT(d).clouds.some((c) => c.by === b), 'a cloud of it');
  assert.ok(p.slowT > 0, 'slow in it');
  assert.ok(b.shutT > 0);
  const hp = b.hp;
  game.damage(b, 6, p);
  assert.equal(hp - b.hp, 3, 'shut, half as hard');
  d.leave();
});

test('a glimmer rides the worst hurt of the wood, mending it and making it quick; struck, it blinks to another', () => {
  const { game, input, d, p, x0, z0 } = inHollow();
  const a = d.spawn('thornling', x0 + 6, FY, z0 + 2, {});
  const b = d.spawn('thornling', x0 + 10, FY, z0 + 4, {});
  for (const c of [a, b]) {
    c.stunT = 99;
    c.target = null;
  }
  a.hp = 2;
  const g = d.spawn('glimmer', x0 + 8, FY, z0 + 2, {});
  p.teleport(x0, FY, z0 - 1);
  run(game, input, 4);
  assert.equal(g.riding, a, 'the worst hurt');
  assert.ok(a.hp > 2, 'mended');
  assert.ok(a.hasteT > 0, 'quick');
  game.damage(g, 1, p);
  assert.equal(g.riding, b, 'blinked to the other');
  d.leave();
});

test('a delver goes under the floor, and comes up under you, throwing you', () => {
  const { game, input, d, p, x0, z0 } = inHollow();
  const c = d.spawn('delver', x0 + 10, FY, z0 + 2, {});
  c.target = p;
  c.diveCd = 0;
  p.teleport(x0 + 4, FY, z0 + 2);
  const hp = p.hp;
  let went = false;
  for (let t = 0; t < 8 && !(c.upT > 0); t += 0.05) {
    game.update(0.05, input);
    went ||= !!c.burrowed;
    c.target = p;
  }
  assert.ok(went, 'under');
  assert.ok(c.upT > 0, 'and up');
  assert.ok(p.hp < hp, 'under you');
  d.leave();
});

test('a woodwose steps out of the bark; hurt badly, it roots, and blows land a third as hard', () => {
  const { game, input, d, p, x0, z0 } = inHollow();
  game.world.setBlock(x0 + 7, FY, z0 + 1, B.gr_keptroot);
  const c = d.spawn('woodwose', x0 + 7, FY, z0 + 2, {});
  p.teleport(x0 + 3, FY, z0 + 2);
  c.target = p;
  run(game, input, 0.1);
  assert.ok(game.world.getState(x0 + 7, FY, z0 + 1), 'the bark split and empty');
  c.hp = 10;
  c.rootCd = 0;
  for (let t = 0; t < 2 && !(c.rootedT > 0); t += 0.05) game.update(0.05, input);
  assert.ok(c.rootedT > 0, 'rooted');
  const hp = c.hp;
  game.damage(c, 10, p);
  assert.ok(hp - c.hp <= 4, `hard to hurt (${hp - c.hp})`);
  d.leave();
});

test('strike the hob, and the whole wood turns on you', () => {
  const { game, input, d, p, x0, z0 } = inHollow();
  const hob = d.spawn('hob', x0 + 4, FY, z0 + 2, {});
  const w = d.spawn('thornling', x0 + 12, FY, z0 + 4, { dormant: 99 });
  p.teleport(x0 + 3, FY, z0 + 2);
  game.damage(hob, 1, p);
  assert.ok(hob.wronged && d.woodTurned);
  assert.equal(w.dormant, 0);
  assert.equal(w.target, p);
  run(game, input, 0.1);
  d.leave();
});

test('the version and its step', () => {
  assert.ok(compareVersions(GAME_VERSION, '1.0.0') >= 0);
  assert.ok(stepsFor('0.99.0').some((s) => s.to === '1.0.0'));
});

test('the Hollow\'s masters are painted by hand, every part in place', () => {
  assert.deepEqual(Object.keys(GROVE_BOSS_ART).sort(), ['elder_stag', 'hollow_oak', 'thorn_queen']);
  for (const [k, A] of Object.entries(GROVE_BOSS_ART)) {
    assert.ok(SPECIES[k], `${k} is a species`);
    assert.ok(FORGE[k] && FORGE[k].pix, `${k} is painted`);
    assert.equal(A.size, 64);
    assert.equal(A.body.rows.length, 64, `${k} has a body`);
    for (const [n, q] of Object.entries(A.parts)) assert.ok(q.pix && q.pix.rows.length, `${k}.${n} has a picture`);
  }
  // (The stag's moss is painted on its antlers now; it strides.)
  assert.ok(!FORGE.elder_stag.front && FORGE.elder_stag.walk);
  // (The oak by its season: its winter, its eyes lit as it winds up, its
  // crown in each season's leaves; its crown hung where the forged one was.)
  const px = (st) => forgePaint('hollow_oak', 0, st).d.join(',');
  const summer = px({});
  assert.notEqual(px({ season: 3 }), summer);
  assert.notEqual(px({ wind: 1 }), summer);
  assert.equal(typeof FORGE.hollow_oak.parts.crown.at, 'function');
  assert.equal(typeof FORGE.hollow_oak.parts.crown.variant, 'function');
  const crown = (v) => forgePartPx('hollow_oak', 'crown', v).d.join(',');
  const seen = new Set(['0', '1', '2', '3'].map(crown));
  assert.equal(seen.size, 4, 'four crowns');
  // (The queen's staff in her hand.)
  assert.equal(GROVE_BOSS_ART.thorn_queen.parts.blade.parent, 'armN');
});
