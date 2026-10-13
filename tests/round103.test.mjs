// Round 103: the Imperial Catacomb made over. Its tiles and things drawn
// afresh; its floors laid out by its own architect (the galleries of
// shelf-graves, the columbarium, the legion's basilica with its porticoes
// and tribunal, the family's cubiculum, the ossuary with its loft and its
// pit, the hall of the Triumph) beside its old rooms, every one walkable;
// what's written there made from its emperor, his legion and the town
// above; its new creatures drawn and at work (the aquilifer dressing the
// ranks, the grasping hand, the lemures snuffing the lamps, the fossors
// lighting them again); the graves to rob, the busts to honour in order;
// and its two masters painted by hand.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGame, stubInput } from './helpers.mjs';
import { DungeonRun } from '../src/game/dungeon.js';
import { buildFloor, FY } from '../src/world/dungeongen.js';
import { BLOCKS, B } from '../src/world/blocks.js';
import { SPECIES } from '../src/entities/creature.js';
import { CATA_SPECIES } from '../src/entities/catamobs.js';
import { CATA_MOBS } from '../src/render/art/cata_mobs.js';
import { CATACOMB_SPRITES, catacombTop, catacombFront } from '../src/render/art/catacomb_tex.js';
import { cataLore } from '../src/world/deeps/catalore.js';
import { CATA_OWN } from '../src/world/deeps/catacomb.js';
import { countItem } from '../src/game/inventory.js';
import { ccT, litNear, restore } from '../src/game/catawork.js';
import { GAME_VERSION, compareVersions } from '../src/version.js';
import { stepsFor } from '../src/game/migrate.js';
import { CATA_BOSS_ART } from '../src/render/art/cata_bosses.js';
import { FORGE } from '../src/render/forge.js';
import '../src/render/bossbody.js';

const rec = (s) => ({ id: `c${s}`, type: 'catacomb', isle: 'velmarch', seed: 1000 + s * 31, depth: 3, level: 2, vaultFloor: 1, origin: { who: 'the Emperor Aurelian', y: 1201 }, townName: 'Quillcross' });
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

test('every floor of an Imperial Catacomb can be walked, up onto its porticoes, its tribunal and its lofts', () => {
  for (let s = 0; s < 6; s++) for (let n = 0; n < 3; n++) assert.equal(reach(buildFloor(rec(s), n)), 0, `seed ${s} floor ${n}`);
});

test('a floor of an Imperial Catacomb is laid out as one: its own rooms, its lamps, its graves, its busts, its legion', () => {
  const kits = new Set();
  let lamps = 0;
  let loculi = 0;
  let busts = 0;
  let porticoes = 0;
  let tribunals = 0;
  let aquiliferi = 0;
  let lying = 0;
  for (let s = 0; s < 6; s++) {
    for (let n = 0; n < 3; n++) {
      const f = buildFloor(rec(s), n);
      for (const r of f.rooms) kits.add(r.kit);
      for (const l of f.lamps || []) {
        const id = at(f, l.x, l.y || FY, l.z);
        assert.ok(id === B.cc_lamp || id === B.cc_lucerna, 'a lamp where it says');
        lamps++;
      }
      for (const q of f.loculi || []) {
        if (at(f, q.x, FY, q.z) === B.cc_loculi) loculi++;
      }
      for (const t of f.busts || []) {
        busts++;
        assert.equal(t.busts.length, 4);
        assert.deepEqual([...t.order].sort(), [0, 1, 2, 3]);
        for (const b of t.busts) assert.equal(at(f, b.x, FY, b.z), B.cc_bust);
        assert.equal(at(f, t.door.x, FY, t.door.z), B.cc_tombdoor, 'the family\'s tomb');
      }
      for (const r of f.rooms) {
        if (r.kit !== 'basilica') continue;
        for (let z = r.z0; z <= r.z1; z++) {
          for (let x = r.x0; x <= r.x1; x++) {
            const id = at(f, f.x0 + x, FY, z);
            if (id === B.cc_portico) porticoes++;
            if (id === B.cc_tribunal) tribunals++;
          }
        }
      }
      aquiliferi += f.spawns.filter((q) => q.species === 'aquilifer').length;
      lying += f.spawns.filter((q) => q.species === 'loculus_hand' && q.lying).length;
    }
  }
  for (const k of CATA_OWN) assert.ok(kits.has(k), `the ${k}`);
  assert.ok(lamps > 200 && loculi > 100 && busts > 8 && porticoes > 30 && tribunals > 30 && aquiliferi > 6 && lying > 3, `${lamps} ${loculi} ${busts} ${porticoes} ${tribunals} ${aquiliferi} ${lying}`);
});

test('what\'s written in an Imperial Catacomb is its emperor\'s, its legion\'s and its town\'s, and the same each time', () => {
  const a = cataLore(rec(1), 0, 'last_emperor');
  const b = cataLore(rec(1), 0, 'last_emperor');
  for (const k of ['dedication', 'epitaph', 'ledger', 'relief', 'stemma', 'graffiti', 'decree', 'sarcophagus', 'tools', 'last']) {
    const t = a[k]();
    assert.deepEqual(t, b[k](), k);
    assert.ok(t.title && t.lines.length >= 1 && t.lines.every((l) => typeof l === 'string' && l.length > 3), k);
  }
  assert.ok(a.dedication().lines.join(' ').toLowerCase().includes('the emperor aurelian'));
  assert.ok(a.victories.some((v) => v.where.includes('Quillcross')), 'a victory fought below the town');
  assert.equal(a.house.length, 4);
  // (The family's tree says the order the busts are honoured in.)
  const tree = a.stemma().lines.join(' ');
  for (const h of a.house) assert.ok(tree.includes(h.name.split(' ')[0]), h.name);
  const titles = new Set();
  for (let s = 1; s <= 4; s++) for (let n = 0; n < 3; n++) for (const l of buildFloor(rec(s), n).lore) titles.add(l.title);
  for (const t of ['The Dedication', 'An Epitaph', 'The Fossors\' Ledger', 'The Emperor\'s Decree', 'Scratched on the Wall']) assert.ok(titles.has(t), t);
});

test('the Imperial Catacomb\'s tiles and things are drawn; its new creatures are in the game and drawn', () => {
  for (const n of ['cc_tufa', 'cc_loculi', 'cc_sectile', 'cc_mosaic', 'cc_mosaicnet', 'cc_flags', 'cc_tufafloor', 'cc_bonefloor', 'cc_porphyry', 'cc_portico', 'cc_tribunal']) assert.ok(catacombTop(n, 0), `${n} top`);
  for (const n of ['cc_tufa', 'cc_loculi', 'cc_loculi_open', 'cc_handhole', 'cc_columbarium', 'cc_fresco', 'cc_dove', 'cc_skulls', 'cc_inscription', 'cc_stemma', 'cc_relief', 'cc_arcosolium', 'cc_tombdoor', 'cc_portico', 'cc_tribunal']) assert.ok(catacombFront(n, 0), `${n} front`);
  for (const [k, fn] of Object.entries(CATACOMB_SPRITES)) {
    assert.ok(BLOCKS[B[k]], `${k} is a block`);
    for (const st of [false, true]) assert.ok(fn(0, st, 0), `${k} drawn`);
  }
  for (const sp of Object.keys(CATA_SPECIES)) {
    assert.ok(SPECIES[sp], `${sp} is a species`);
    assert.ok(CATA_MOBS[sp] && CATA_MOBS[sp].rows.length === 24, `${sp} is drawn`);
  }
  assert.ok(CATA_MOBS.loculus_hand.groups.rest, 'the hand up out of the bones');
});

// ------------------------------------------------------- in the catacomb itself
function inCatacomb() {
  const game = makeGame(12345);
  const input = stubInput();
  game.minute = 600;
  for (let i = 0; i < 20; i++) game.update(0.1, input);
  // (The catacombs are over the sea, in Velmarch: a dungeon at home made
  // one for the test.)
  const base = game.sim.dungeons.all.find((q) => q.type === 'crypt');
  const r = { ...base, type: 'catacomb', isle: 'velmarch', floors: {}, cleared: false, pack: null, weakened: 0 };
  new DungeonRun(game, r).enter();
  const d = game.dungeon;
  for (const c of game.creatures) {
    c.dead = true;
    game.removeOcc(c);
  }
  game.creatures = [];
  game.cheats = { ...(game.cheats || {}), god: false };
  for (const k of ['lamps', 'loculi', 'busts']) d.data[k] = [];
  // A clear hall, 15 by 8, about the way in.
  const e = d.data.rooms.find((q) => q.kit === 'entry');
  const x0 = d.data.x0 + e.cx - 7;
  const z0 = e.cz - 2;
  for (let z = z0 - 2; z <= z0 + 5; z++) {
    for (let x = x0 - 1; x <= x0 + 15; x++) {
      for (const y of [FY, FY + 1, FY + 2]) game.world.setBlock(x, y, z, B.air);
      game.world.setBlock(x, FY - 1, z, B.cc_flags);
    }
  }
  const p = game.player;
  p.teleport(x0, FY, z0 + 2);
  p.hp = p.maxHp = 200;
  d.cataT = null;
  return { game, input, d, p, x0, z0 };
}
const run = (game, input, secs) => {
  for (let t = 0; t < secs; t += 0.05) game.update(0.05, input);
};
const lampAt = (game, d, x, z, lit) => {
  game.world.setBlock(x, FY, z, B.cc_lucerna);
  game.world.setState(x, FY, z, lit);
  d.data.lamps.push({ x, z });
};

test('a lemur can\'t be touched in the dark; by a burning lamp it can', () => {
  const { game, d, p, x0, z0 } = inCatacomb();
  const c = d.spawn('lemur', x0 + 8, FY, z0 + 2, {});
  const hp = c.hp;
  game.damage(c, 5, p);
  assert.equal(c.hp, hp, 'the blow goes through it');
  lampAt(game, d, x0 + 9, z0 + 1, true);
  assert.ok(litNear(d, c.x, c.z, 4));
  game.damage(c, 5, p);
  assert.equal(c.hp, hp - 5, 'in the lamplight, struck true');
});

test('a lemur snuffs the lamps it passes; a fossor lights them again; you can too', () => {
  const { game, input, d, p, x0, z0 } = inCatacomb();
  const w = game.world;
  lampAt(game, d, x0 + 12, z0 + 1, true);
  const l = d.spawn('lemur', x0 + 12, FY, z0 + 2, {});
  l.dormant = 99;
  run(game, input, 0.3);
  assert.equal(w.getState(x0 + 12, FY, z0 + 1), false, 'snuffed');
  l.dead = true;
  game.creatures = game.creatures.filter((c) => c !== l);
  const f = d.spawn('fossor', x0 + 9, FY, z0 + 3, { peaceful: true });
  p.teleport(x0, FY, z0 + 4);
  run(game, input, 8);
  assert.ok(w.getState(x0 + 12, FY, z0 + 1), 'lit again by the fossor');
  assert.ok(!f.angry && f.peaceful, 'and he minds his own business');
  w.setState(x0 + 12, FY, z0 + 1, false);
  d.interact(x0 + 12, FY, z0 + 1, BLOCKS[B.cc_lucerna]);
  assert.ok(w.getState(x0 + 12, FY, z0 + 1), 'lit by you');
  assert.ok(ccT(d).told.lamp);
});

test('a shelf-grave broken open gives up its grave goods; rob two and the fossors come for you; robbed it stays robbed', () => {
  const { game, d, p, x0, z0 } = inCatacomb();
  const w = game.world;
  const graves = [{ x: x0 + 3, z: z0 - 2, goods: true }, { x: x0 + 5, z: z0 - 2, goods: true }];
  for (const q of graves) for (const y of [FY, FY + 1]) w.setBlock(q.x, y, q.z, B.cc_loculi);
  d.data.loculi = graves;
  const f = d.spawn('fossor', x0 + 10, FY, z0 + 3, { peaceful: true });
  p.inv.fill(null);
  const rnd = Math.random;
  Math.random = () => 0.5;
  try {
    d.interact(graves[0].x, FY, graves[0].z, BLOCKS[B.cc_loculi]);
    assert.equal(w.getBlock(graves[0].x, FY, graves[0].z), B.cc_loculi_open);
    assert.ok(countItem(p.inv, 'old_coin') >= 1, 'old coins among the bones');
    assert.ok(!f.angry, 'the fossors only look, the first time');
    d.interact(graves[1].x, FY, graves[1].z, BLOCKS[B.cc_loculi]);
    assert.ok(f.angry && !f.peaceful && f.target === p, 'the second, they come for you');
  } finally {
    Math.random = rnd;
  }
  // (Put back as it was when the floor's made again.)
  for (const y of [FY, FY + 1]) w.setBlock(graves[0].x, y, graves[0].z, B.cc_loculi);
  restore(d);
  assert.equal(w.getBlock(graves[0].x, FY, graves[0].z), B.cc_loculi_open, 'still robbed');
});

test('the busts honoured in the order of descent open the family\'s tomb; out of order, the dead of the house come', () => {
  const { game, input, d, p, x0, z0 } = inCatacomb();
  const w = game.world;
  const busts = [0, 1, 2, 3].map((kind) => ({ x: x0 + 3 + kind * 2, z: z0 - 1, kind }));
  for (const b of busts) w.setBlock(b.x, FY, b.z, B.cc_bust, b.kind);
  const door = { x: x0 + 13, z: z0 - 2 };
  for (const y of [FY, FY + 1]) w.setBlock(door.x, y, door.z, B.cc_tombdoor);
  const order = [2, 0, 3, 1];
  d.data.busts = [{ busts, order, names: ['Gaius', 'Lucius', 'Marcus', 'Titus'], door, room: 0 }];
  p.teleport(x0 + 1, FY, z0 + 3);
  const bustOf = (k) => busts.find((b) => b.kind === k);
  // Wrong first: the fillets go dark, and lemures come.
  d.interact(bustOf(2).x, FY, bustOf(2).z, BLOCKS[B.cc_bust]);
  assert.ok(w.getState(bustOf(2).x, FY, bustOf(2).z), 'the first, its fillet shining');
  d.interact(bustOf(1).x, FY, bustOf(1).z, BLOCKS[B.cc_bust]);
  assert.ok(busts.every((b) => !w.getState(b.x, FY, b.z)), 'all dark again');
  assert.ok(game.creatures.filter((c) => c.species === 'lemur').length >= 1, 'the dead of the house');
  for (const c of game.creatures) c.dead = true;
  game.creatures = [];
  for (const k of order) d.interact(bustOf(k).x, FY, bustOf(k).z, BLOCKS[B.cc_bust]);
  assert.ok(busts.every((b) => w.getState(b.x, FY, b.z)), 'all four shining');
  run(game, input, 2);
  assert.equal(w.getBlock(door.x, FY, door.z), B.air, 'the tomb open');
  assert.ok(d.state.catacomb.opened[`${door.x},${door.z}`]);
});

test('an aquilifer dresses the ranks (a shield locked two paces off); bring the eagle down and they waver', () => {
  const { game, input, d, p, x0, z0 } = inCatacomb();
  const a = d.spawn('legion_shade', x0 + 6, FY, z0 + 2, {});
  const b = d.spawn('legion_shade', x0 + 8, FY, z0 + 2, {});
  for (const c of [a, b]) {
    c.dormant = 99;
    c.waiting = true;
  }
  const hp = a.hp;
  game.damage(a, 10, p);
  assert.equal(hp - a.hp, 10, 'two paces apart, no shield wall');
  const q = d.spawn('aquilifer', x0 + 11, FY, z0 + 2, {});
  q.target = p;
  p.teleport(x0 + 1, FY, z0 + 2);
  run(game, input, 0.2);
  assert.ok(a.rankedT > 0, 'its ranks dressed');
  const h1 = a.hp;
  a.x = x0 + 6;
  game.damage(a, 10, p);
  assert.ok(h1 - a.hp < 10, 'the shield wall, two paces off');
  game.damage(q, 999, p);
  assert.ok(a.stunT > 0 && b.stunT > 0, 'they waver');
});

test('a dead hand out of a grave grabs whoever passes, and holds them', () => {
  const { game, input, d, p, x0, z0 } = inCatacomb();
  d.spawn('loculus_hand', x0 + 6, FY, z0 + 2, {});
  p.teleport(x0 + 5, FY, z0 + 2);
  const hp = p.hp;
  run(game, input, 0.3);
  assert.ok(p.rootT > 0 && p.hp < hp, 'held');
});

test('the version and its step', () => {
  assert.ok(compareVersions(GAME_VERSION, '1.3.0') >= 0);
  assert.ok(stepsFor('1.2.0').some((s) => s.to === '1.3.0'));
});

test('the Imperial Catacomb\'s masters are painted by hand, every part in place', () => {
  assert.deepEqual(Object.keys(CATA_BOSS_ART).sort(), ['bronze_wolf', 'last_emperor']);
  for (const [k, A] of Object.entries(CATA_BOSS_ART)) {
    assert.ok(SPECIES[k], `${k} is a species`);
    assert.ok(FORGE[k] && FORGE[k].pix, `${k} is painted`);
    assert.equal(A.size, 64);
    assert.equal(A.body.rows.length, 64, `${k} has a body`);
    for (const [n, q] of Object.entries(A.parts)) assert.ok(q.pix && q.pix.rows.length, `${k}.${n} has a picture`);
  }
  assert.ok(CATA_BOSS_ART.bronze_wolf.walk, 'the wolf strides');
  for (const n of ['head', 'armN', 'armF', 'blade', 'cape']) assert.ok(CATA_BOSS_ART.last_emperor.parts[n], `the emperor's ${n}`);
  for (const n of ['head', 'jaw', 'tail0']) assert.ok(CATA_BOSS_ART.bronze_wolf.parts[n], `the wolf's ${n}`);
});
