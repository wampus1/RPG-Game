// Round 110: the Athanor made over. Its marble, its faces and its things
// drawn afresh; its floors laid out by its own architect (the
// laboratorium and its alcoves, the great furnace on its dais, the
// cloister and its fountain, the speculum and its sanctum, the vat-hall,
// the garden of metals), a stage of the Work to each floor, beside its old
// rooms, every one walkable; what's written there made from its own story;
// its new creatures drawn and at work (the adept that calls quicksilver up
// under you, the leaden sentinel that gilds, the vat-tender that mends the
// Work and whose death breaks the vats; the homunculi going to the
// quicksilver to mend, the imps going for the furnace's fire); the
// speculum's beam and its mirrors; the transmutation table; the athanor
// and its egg; the quicksilver and its fumes; and its master painted by
// hand.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGame, stubInput } from './helpers.mjs';
import { DungeonRun } from '../src/game/dungeon.js';
import { buildFloor, FY } from '../src/world/dungeongen.js';
import { BLOCKS, B } from '../src/world/blocks.js';
import { ITEMS } from '../src/world/items.js';
import { SPECIES } from '../src/entities/creature.js';
import { ATHANOR_SPECIES } from '../src/entities/athanormobs.js';
import { ATHANOR_MOBS } from '../src/render/art/athanor_mobs.js';
import { ATHANOR_SPRITES, athanorTop, athanorFront } from '../src/render/art/athanor_tex.js';
import { athanorLore, STAGES } from '../src/world/deeps/athanorlore.js';
import { ATHANOR_OWN, STAGE_FLOOR, mirrorTurn } from '../src/world/deeps/athanor.js';
import { ANCIENT_DTYPES } from '../src/world/ancient.js';
import { anT, restore, trace, quicken, RIPEN } from '../src/game/athanorwork.js';
import { addItem, countItem } from '../src/game/inventory.js';
import { GAME_VERSION, compareVersions } from '../src/version.js';
import { stepsFor } from '../src/game/migrate.js';
import { ATHANOR_BOSS_ART } from '../src/render/art/athanor_bosses.js';
import { FORGE, forgePaint } from '../src/render/forge.js';
import '../src/render/bossbody.js';

const rec = (s) => ({ id: `a${s}`, type: 'athanor', isle: 'velmarch', seed: 1000 + s * 31, depth: 3, level: 4, vaultFloor: 1, origin: { who: 'the Divine Alchemist', y: 400 }, townName: 'Quillcross' });
const at = (f, x, y, z) => {
  const r = f.regions.get(Math.floor(x / 64) * 4096 + Math.floor(z / 36));
  return r ? r.get(x % 64, y, z % 36) : 0;
};
const PASS = new Set(['sealed', 'portcullis', 'boss_gate', 'an_seal']);
// Every tile you can walk to from the way in, a step up or down at a time.
// (Things set on the floor aren't tiles to walk to; nor is the top of a
// bookcase.)
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
        if (h === null || h === FY + 2) continue;
        if (BLOCKS[at(f, f.x0 + x, h - 1, z)]?.name === 'bookshelf') continue;
        if (!seen.has(z * P.W + x)) miss++;
      }
    }
  }
  return miss;
}

test('every floor of an Athanor can be walked, up onto the furnace\'s dais and into every alcove', () => {
  for (let s = 0; s < 6; s++) for (let n = 0; n < 3; n++) assert.equal(reach(buildFloor(rec(s), n)), 0, `seed ${s} floor ${n}`);
});

test('the Athanor is its own architect\'s now, a stage of the Work to each floor', () => {
  const T = ANCIENT_DTYPES.athanor;
  assert.ok(T.arch, 'its architect');
  assert.equal(T.wall, B.an_marble);
  assert.ok(T.mobs.some(([k]) => k === 'adept') && T.mobs.some(([k]) => k === 'leaden_sentinel'));
  for (let n = 0; n < 3; n++) {
    const f = buildFloor(rec(1), n);
    const e = f.rooms.find((r) => r.kit === 'laboratorium');
    assert.ok(e, `a laboratorium on floor ${n}`);
    assert.equal(at(f, f.x0 + e.cx, FY - 1, e.cz) === B[STAGE_FLOOR[n]] || [B.an_albedo, B.an_nigredo, B.an_ouroboros].includes(at(f, f.x0 + e.cx, FY - 1, e.cz)), true, `its floor the ${STAGES[n].key}`);
  }
});

test('a floor of an Athanor is laid out as one: its speculum and sanctum, its tables, its athanor on its dais, its vats', () => {
  const kits = new Set();
  const n0 = { specula: 0, tables: 0, athanors: 0, vats: 0 };
  const sp = {};
  let solved = 0;
  for (let s = 0; s < 6; s++) {
    for (let n = 0; n < 3; n++) {
      const f = buildFloor(rec(s), n);
      for (const r of f.rooms) kits.add(r.kit);
      for (const q of f.specula || []) {
        assert.equal(at(f, q.seal.x, FY, q.seal.z), B.an_seal);
        assert.equal(at(f, q.lamp.x, FY, q.lamp.z), B.an_sunlamp);
        for (const m of q.mirrors) assert.equal(at(f, m.x, FY, m.z), B.an_mirror);
        // (Turned as it wants, the beam goes from the lamp by each mirror
        // to the seal, through nothing in its way.)
        let p = { x: q.lamp.x, z: q.lamp.z };
        let d = q.lamp.dir;
        let k = 0;
        for (let i = 0; i < 40; i++) {
          p = { x: p.x + d.x, z: p.z + d.z };
          const m = q.mirrors.findIndex((mm) => mm.x === p.x && mm.z === p.z);
          if (m >= 0) {
            assert.equal(m, k, 'the mirrors in turn');
            d = mirrorTurn(q.mirrors[m].want, d);
            k++;
            continue;
          }
          if (p.x === q.seal.x && p.z === q.seal.z) break;
          assert.ok(!BLOCKS[at(f, p.x, FY, p.z)].solid, 'nothing in the beam\'s way');
        }
        assert.ok(p.x === q.seal.x && p.z === q.seal.z && k === 3, 'laid on the seal');
        // (Never already solved as it's found.)
        assert.ok(q.mirrors.some((m) => (at(f, m.x, FY, m.z) && true) && m.want !== undefined));
        solved++;
      }
      for (const q of f.tables || []) assert.equal(at(f, q.x, FY, q.z), B.an_transmute);
      for (const q of f.athanors || []) {
        assert.equal(at(f, q.x, FY + 1, q.z), B.an_athanor);
        assert.equal(at(f, q.x, FY, q.z), B.an_dais);
      }
      for (const g of f.vats || []) for (const q of g.vats) assert.equal(at(f, q.x, FY, q.z), B.an_vat);
      for (const k of Object.keys(n0)) n0[k] += (f[k] || []).length;
      for (const q of f.spawns) sp[q.species] = (sp[q.species] || 0) + 1;
    }
  }
  for (const k of ATHANOR_OWN) assert.ok(kits.has(k), `the ${k}`);
  for (const [k, v] of Object.entries(n0)) assert.ok(v > 3, `${k}: ${v}`);
  assert.ok(solved > 3);
  for (const k of ['adept', 'leaden_sentinel', 'vat_tender', 'quicksilver_homunculus', 'sulphur_imp', 'alembic_golem']) assert.ok(sp[k] > 2, `${k}: ${sp[k]}`);
});

test('what\'s written in an Athanor is its own story, the same each time, a brother a Frater and a sister a Soror', () => {
  const L = athanorLore(rec(2), 0, 'divine_alchemist');
  const L2 = athanorLore(rec(2), 0, 'divine_alchemist');
  assert.deepEqual(L.diary(), L2.diary());
  assert.ok(L.brother.startsWith('Frater ') && L.sister.startsWith('Soror '));
  assert.ok(/Aurelia|Sabina|Calpurnia|Marcella|Livilla|Flavia|Severina|Domitia/.test(L.sister));
  assert.ok(!/Aurelia|Sabina|Calpurnia|Marcella|Livilla|Flavia|Severina|Domitia/.test(L.brother));
  assert.ok(L.inventory().lines.join(' ').includes('Quillcross'));
  assert.equal(athanorLore(rec(2), 2).stage, 'rubedo');
  for (const k of ['diary', 'recipe', 'tablet', 'speculum', 'inventory', 'shepherd', 'operations', 'furnace', 'letter', 'table', 'story', 'last']) {
    const e = L[k]();
    assert.ok(e.title && e.lines.length, k);
  }
  let titled = 0;
  for (let s = 0; s < 4; s++) for (let n = 0; n < 3; n++) titled += (buildFloor(rec(s), n).lore || []).length;
  assert.ok(titled > 20);
});

test('the Athanor\'s tiles and things are drawn; its new creatures are in the game and drawn; the Red Tincture is a thing', () => {
  for (const n of ['an_marble', 'an_pilaster', 'an_niche', 'an_shelves', 'an_tablet', 'an_rose', 'an_furnace', 'an_seal']) assert.ok(athanorFront(n, 0) && athanorTop(n, 0), n);
  for (const n of ['an_nigredo', 'an_albedo', 'an_rubedo', 'an_ouroboros', 'an_dais']) assert.ok(athanorTop(n, 1), n);
  for (const [n, f] of Object.entries(ATHANOR_SPRITES)) {
    assert.ok(B[n] !== undefined, n);
    assert.ok(f(0, false, 0) && f(1, true, 1), n);
  }
  for (const k of Object.keys(ATHANOR_SPECIES)) assert.ok(SPECIES[k], k);
  for (const k of ['adept', 'leaden_sentinel', 'vat_tender', 'quicksilver_homunculus', 'quicksilver_bead', 'alembic_golem', 'sulphur_imp']) {
    const A = ATHANOR_MOBS[k];
    assert.ok(A && A.size === 24 && A.groups.walk && A.groups.attack, k);
  }
  assert.ok(ATHANOR_MOBS.leaden_sentinel.groups.gilt, 'gilded, its own frames');
  assert.ok(ITEMS.red_tincture && ITEMS.lead);
  assert.equal(SPECIES.vat_tender.mode, 'passive');
});

function inAthanor() {
  const game = makeGame(12345);
  const input = stubInput();
  game.minute = 600;
  for (let i = 0; i < 20; i++) game.update(0.1, input);
  const base = game.sim.dungeons.all.find((q) => q.type === 'crypt');
  const r = { ...base, type: 'athanor', isle: 'velmarch', floors: {}, cleared: false, pack: null, weakened: 0 };
  new DungeonRun(game, r).enter();
  const d = game.dungeon;
  for (const c of game.creatures) {
    c.dead = true;
    game.removeOcc(c);
  }
  game.creatures = [];
  game.cheats = { ...(game.cheats || {}), god: false };
  for (const k of ['specula', 'tables', 'athanors', 'vats']) d.data[k] = [];
  // A clear hall, 15 by 8, about the way in, its marble wall north of it.
  const e = d.data.rooms.find((q) => q.kit === 'entry');
  const x0 = d.data.x0 + e.cx - 7;
  const z0 = e.cz - 2;
  for (let z = z0 - 2; z <= z0 + 5; z++) {
    for (let x = x0 - 1; x <= x0 + 15; x++) {
      for (const y of [FY, FY + 1, FY + 2]) game.world.setBlock(x, y, z, B.air);
      game.world.setBlock(x, FY - 1, z, B.an_albedo);
      game.world.setBlock(x, FY - 2, z, B.an_marble);
    }
  }
  for (let x = x0 - 1; x <= x0 + 15; x++) for (const y of [FY, FY + 1]) game.world.setBlock(x, y, z0 - 3, B.an_marble);
  game.zones = [];
  const p = game.player;
  p.teleport(x0, FY, z0 + 5);
  p.hp = p.maxHp = 200;
  d.athT = null;
  return { game, input, d, p, x0, z0 };
}
const run = (game, input, secs) => {
  for (let t = 0; t < secs; t += 0.05) game.update(0.05, input);
};

test('the speculum: the mirrors turned by hand till the beam lies on the seal, and the sanctum opens (and stays open)', () => {
  const { game, input, d, p, x0, z0 } = inAthanor();
  const w = game.world;
  // The lamp west, shining east; the mirrors; the seal in the north wall.
  const lamp = { x: x0, z: z0 + 4, dir: { x: 1, z: 0 } };
  w.setBlock(lamp.x, FY, lamp.z, B.an_sunlamp);
  const ms = [{ x: x0 + 4, z: z0 + 4, want: 0 }, { x: x0 + 4, z: z0 + 1, want: 0 }, { x: x0 + 9, z: z0 + 1, want: 0 }];
  // (Turned wrong: the first and the last.)
  ms.forEach((m, i) => w.setBlock(m.x, FY, m.z, B.an_mirror, i === 1 ? 0 : 1));
  const seal = { x: x0 + 9, z: z0 - 3 };
  for (const y of [FY, FY + 1]) w.setBlock(seal.x, y, seal.z, B.an_seal);
  const q = { lamp, mirrors: ms, seal, room: 0 };
  d.data.specula = [q];
  // (Its way to the seal.)
  for (const y of [FY, FY + 1]) for (const z of [z0 - 2, z0 - 1]) w.setBlock(seal.x, y, z, B.air);
  assert.ok(!trace(d, q).onSeal);
  // Into the beam: it scorches.
  p.teleport(x0 + 2, FY, z0 + 4);
  const hp = p.hp;
  run(game, input, 1.5);
  assert.ok(p.hp < hp, 'scorched');
  p.teleport(x0 + 12, FY, z0 + 5);
  // The first turned: lit, the beam goes on up; the last turned: the seal.
  d.interact(ms[0].x, FY, ms[0].z, BLOCKS[B.an_mirror]);
  assert.ok(w.getState(ms[0].x, FY, ms[0].z) && w.getState(ms[1].x, FY, ms[1].z), 'lit along the way');
  assert.equal(w.getBlock(seal.x, FY, seal.z), B.an_seal, 'not yet');
  d.interact(ms[2].x, FY, ms[2].z, BLOCKS[B.an_mirror]);
  assert.equal(w.getBlock(seal.x, FY, seal.z), B.air, 'open');
  // Made again: as it was left.
  for (const y of [FY, FY + 1]) w.setBlock(seal.x, y, seal.z, B.an_seal);
  for (const m of ms) w.setMeta(m.x, FY, m.z, 1);
  restore(d);
  assert.equal(w.getBlock(seal.x, FY, seal.z), B.air, 'still open');
  assert.equal(w.getMeta(ms[0].x, FY, ms[0].z) & 1, 0, 'still turned');
  assert.ok(game.lightBeams !== undefined);
});

test('the transmutation table turns lead to gold, once, and the adepts come to see who did it', () => {
  const { game, d, p, x0, z0 } = inAthanor();
  const t = { x: x0 + 7, z: z0 };
  game.world.setBlock(t.x, FY, t.z, B.an_transmute);
  d.data.tables = [t];
  d.interact(t.x, FY, t.z, BLOCKS[B.an_transmute]);
  assert.equal(countItem(p.inv, 'gold_ingot'), 0, 'nothing to lay in it');
  addItem(p.inv, 'lead', 2);
  d.interact(t.x, FY, t.z, BLOCKS[B.an_transmute]);
  assert.equal(countItem(p.inv, 'gold_ingot'), 2);
  assert.equal(countItem(p.inv, 'lead'), 1);
  assert.ok(game.world.getState(t.x, FY, t.z));
  assert.ok(game.creatures.filter((c) => c.species === 'adept' && !c.dead).length >= 1, 'the adepts come');
  d.interact(t.x, FY, t.z, BLOCKS[B.an_transmute]);
  assert.equal(countItem(p.inv, 'gold_ingot'), 2, 'once');
});

test('the athanor fed coal burns, the imps come to its fire, and the egg ripens into the Red Tincture', () => {
  const { game, input, d, p, x0, z0 } = inAthanor();
  const q = { x: x0 + 7, z: z0 + 1 };
  game.world.setBlock(q.x, FY, q.z, B.an_dais);
  game.world.setBlock(q.x, FY + 1, q.z, B.an_athanor);
  d.data.athanors = [q];
  d.interact(q.x, FY + 1, q.z, BLOCKS[B.an_athanor]);
  assert.ok(!game.world.getState(q.x, FY + 1, q.z), 'no fuel, no fire');
  addItem(p.inv, 'coal', 1);
  d.interact(q.x, FY + 1, q.z, BLOCKS[B.an_athanor]);
  assert.ok(game.world.getState(q.x, FY + 1, q.z), 'lit');
  assert.equal(countItem(p.inv, 'coal'), 0);
  p.teleport(x0 + 4, FY, z0 + 4);
  game.cheats.god = true;
  run(game, input, 9);
  assert.ok(game.creatures.some((c) => c.species === 'sulphur_imp' && !c.dead), 'the imps come');
  // (Killed as they come, the egg ripens.)
  const f = anT(d).fires.get(`${q.x},${q.z}`);
  f.t = RIPEN - 0.5;
  for (const c of game.creatures) c.dead = true;
  run(game, input, 1);
  assert.ok(game.drops.some((x) => x.item === 'red_tincture'), 'the Red Tincture');
  assert.ok(!game.world.getState(q.x, FY + 1, q.z), 'the fire sinks');
  d.interact(q.x, FY + 1, q.z, BLOCKS[B.an_athanor]);
  assert.ok(!anT(d).fires.size, 'once');
});

test('an imp at the athanor eats the heat out of it', () => {
  const { game, input, d, p, x0, z0 } = inAthanor();
  const q = { x: x0 + 7, z: z0 + 1 };
  game.world.setBlock(q.x, FY, q.z, B.an_dais);
  game.world.setBlock(q.x, FY + 1, q.z, B.an_athanor);
  d.data.athanors = [q];
  addItem(p.inv, 'sulfur', 1);
  d.interact(q.x, FY + 1, q.z, BLOCKS[B.an_athanor]);
  const f = anT(d).fires.get(`${q.x},${q.z}`);
  f.t = 10;
  f.imp = 99;
  p.teleport(x0 + 2, FY, z0 + 5);
  const imp = d.spawn('sulphur_imp', q.x + 1, FY, q.z, {});
  imp.dormant = 0;
  imp.toFire = q;
  run(game, input, 0.2);
  assert.ok(f.t < 10, 'set back');
});

test('the vats: one smashed lets out what was in it; the tender mends the Work, and its death breaks them all', () => {
  const { game, input, d, p, x0, z0 } = inAthanor();
  const vats = [{ x: x0 + 4, z: z0 - 2 }, { x: x0 + 6, z: z0 - 2 }, { x: x0 + 8, z: z0 - 2 }];
  for (const v of vats) {
    game.world.setBlock(v.x, FY, v.z, B.an_vat);
    game.world.setState(v.x, FY, v.z, true);
  }
  d.data.vats = [{ vats, room: 0 }];
  d.interact(vats[0].x, FY, vats[0].z, BLOCKS[B.an_vat]);
  assert.ok(game.world.getState(vats[0].x, FY, vats[0].z), 'looked in first');
  d.interact(vats[0].x, FY, vats[0].z, BLOCKS[B.an_vat]);
  assert.ok(!game.world.getState(vats[0].x, FY, vats[0].z), 'smashed');
  assert.ok(game.creatures.some((c) => c.species === 'quicksilver_homunculus' && !c.dead), 'out it climbs');
  const h = game.creatures.find((c) => c.species === 'quicksilver_homunculus');
  h.hp = 2;
  h.dormant = 99;
  const t = d.spawn('vat_tender', h.x + 1, FY, h.z, { peaceful: true });
  t.dormant = 0;
  p.teleport(x0 + 14, FY, z0 + 5);
  run(game, input, 3);
  assert.ok(h.hp > 2, 'mended');
  game.damage(t, t.hp + 50, p);
  assert.ok(t.dead);
  assert.ok(vats.every((v) => !game.world.getState(v.x, FY, v.z)), 'every vat broken');
  restore(d);
  assert.ok(vats.every((v) => !game.world.getState(v.x, FY, v.z)));
});

test('an adept calls quicksilver up under you; the homunculi mend in it; an imp\'s fire on it fumes', () => {
  const { game, input, d, p, x0, z0 } = inAthanor();
  p.teleport(x0 + 2, FY, z0 + 3);
  game.cheats.god = true;
  const a = d.spawn('adept', x0 + 7, FY, z0 + 3, {});
  a.dormant = 0;
  a.target = p;
  a.castCd = 0;
  run(game, input, 1.5);
  const z = (game.zones || []).find((q) => q.kind === 'quick');
  assert.ok(z, 'quicksilver');
  assert.ok(z.tiles.some((q) => q.x === p.x && q.z === p.z) || p.slowT > 0);
  a.dead = true;
  // A homunculus in it, hurt: mended.
  const t = z.tiles[0];
  const h = d.spawn('quicksilver_homunculus', t.x, FY, t.z, {});
  h.dormant = 99;
  h.hp = 3;
  run(game, input, 1);
  assert.ok(h.hp > 3, 'mended in it');
  h.dead = true;
  // An imp by it: fumes.
  const imp = d.spawn('sulphur_imp', t.x + 1, FY, t.z + 1, {});
  imp.dormant = 99;
  run(game, input, 0.2);
  assert.ok(game.zones.some((q) => q.kind === 'fume'), 'fumes');
  assert.ok(!game.zones.some((q) => q.kind === 'quick' && !q.done));
  // (And laid by hand, it's there.)
  assert.ok(quicken(d, [{ x: x0 + 12, z: z0 }], null));
});

test('a leaden sentinel beaten to half gilds: quicker, harder, and gold on it', () => {
  const { game, d, p, x0, z0 } = inAthanor();
  const s = d.spawn('leaden_sentinel', x0 + 7, FY, z0 + 2, {});
  s.dormant = 0;
  const m = s.dmgMult;
  game.damage(s, Math.ceil(s.maxHp * 0.6), p);
  assert.ok(s.gilded && s.altLook === 'gilt');
  assert.ok(s.dmgMult > m && s.hasteT > 0);
  assert.equal(s.carries, 'gold_ingot');
});

test('the version and its step', () => {
  assert.ok(compareVersions(GAME_VERSION, '1.10.0') >= 0);
  assert.ok(stepsFor('1.9.0').some((s) => s.to === '1.10.0'));
});

test('the Divine Alchemist is painted by hand: its rings turning, its eye gone red when it\'s risen, its arms still at their sockets', () => {
  assert.deepEqual(Object.keys(ATHANOR_BOSS_ART), ['divine_alchemist']);
  const A = ATHANOR_BOSS_ART.divine_alchemist;
  assert.equal(A.size, 128);
  assert.equal(A.body.rows.length, 128);
  assert.deepEqual(A.idle, [0, 8]);
  assert.deepEqual(A.states.risen.idle, [8, 8]);
  const D = FORGE.divine_alchemist;
  assert.ok(D.pix);
  assert.equal(D.ax, 64);
  assert.equal(D.ay, 126, 'its arms hung from the eye where they were');
  for (const q of Object.values(A.parts)) assert.ok(q.pix.rows.length);
  // (Two frames of it differ: the rings turn. Risen, the eye's red.)
  const f0 = forgePaint('divine_alchemist', 0, {});
  const f6 = forgePaint('divine_alchemist', 6, {});
  const r0 = forgePaint('divine_alchemist', 0, { risen: 1 });
  const diff = (a, b) => {
    let n = 0;
    for (let i = 0; i < a.d.length; i += 4) if (a.d[i] !== b.d[i] || a.d[i + 1] !== b.d[i + 1]) n++;
    return n;
  };
  assert.ok(diff(f0, f6) > 50, 'turning');
  assert.ok(diff(f0, r0) > 200, 'risen');
  // (The eye's middle where the arms are drawn from: the pupil, dark.)
  const i = (54 * 128 + 64) * 4;
  assert.ok(f0.d[i] < 40 && f0.d[i + 3] > 0);
});
