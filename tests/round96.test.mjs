// Round 96: the mine, made over. Every floor of it can be walked, in each
// land; firedamp goes up when a flame finds it (a torch, never a lantern),
// the whole pocket at once; a blast beetle struck rolls off fizzing and
// takes the dead with it; the drifting firedamp bursts into gas, or flares
// at a flame; a blast brings a cracked prop's roof down; the cart runs as
// the points are thrown; the pump drains the sump; the bell calls the shift;
// eggs hatch; a knocker hurt brings the roof down on you; what's written in
// a mine is its own; its creatures and masters are all drawn; and the
// version's step.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGame, stubInput } from './helpers.mjs';
import { DungeonRun } from '../src/game/dungeon.js';
import { buildFloor, FY } from '../src/world/dungeongen.js';
import { BLOCKS, B } from '../src/world/blocks.js';
import { SPECIES } from '../src/entities/creature.js';
import { MINE_SPECIES } from '../src/entities/minemobs.js';
import { MINE_MOBS } from '../src/render/art/mine_mobs.js';
import { MINE_BOSS_ART } from '../src/render/art/mine_bosses.js';
import '../src/render/bossbody.js';
import { FORGE } from '../src/render/forge.js';
import { mineLore } from '../src/world/deeps/minelore.js';
import { igniteGas, propFall } from '../src/game/minework.js';
import { GAME_VERSION } from '../src/version.js';
import { stepsFor } from '../src/game/migrate.js';

const rec = (s, isle) => ({ id: `m${s}`, type: 'mine', seed: s * 7919 + 13, depth: 3, level: 1 + (s % 3), isle, name: 'Test Copper Mine', townName: 'Hobb', origin: { y: 211 }, fallen: [] });
const blockAt = (f, x, y, z) => {
  const r = f.regions.get(Math.floor(x / 64) * 4096 + Math.floor(z / 36));
  return r ? r.get(x % 64, y, z % 36) : 0;
};
// (What's meant to be opened to be got through: the choke, the chalk.)
const PASS = new Set(['sealed', 'portcullis', 'boss_gate']);
const solid = (f, x, y, z) => {
  const b = BLOCKS[blockAt(f, x, y, z)];
  return !!(b && b.solid && !PASS.has(b.interact) && b.name !== 'weak_wall' && b.name !== 'cart_choke' && b.name !== 'chalk_mark');
};
const standY = (f, x, z) => {
  for (let y = FY + 2; y >= FY - 1; y--) if (!solid(f, x, y, z) && !solid(f, x, y + 1, z) && solid(f, x, y - 1, z)) return y;
  return null;
};
function reach(f) {
  const { W, open } = f.plan;
  const seen = new Set();
  const st = [[f.entry.x - f.x0, f.entry.z]];
  seen.add(st[0][1] * W + st[0][0]);
  while (st.length) {
    const [x, z] = st.pop();
    const h = standY(f, f.x0 + x, z) ?? FY;
    for (const [a, c] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + a;
      const nz = z + c;
      const i = nz * W + nx;
      if (seen.has(i) || !open[i]) continue;
      const h2 = standY(f, f.x0 + nx, nz);
      // (Up a ladder, or a step at a time; down two at most.)
      const ladder = blockAt(f, f.x0 + nx, h2 ?? FY, nz) === B.ladder || blockAt(f, f.x0 + x, h, z) === B.ladder;
      if (h2 == null || (h2 - h > 1 && !ladder) || h - h2 > 2) continue;
      seen.add(i);
      st.push([nx, nz]);
    }
  }
  return seen;
}

test('every mine floor can be walked, benches, ledges, sumps and all, in every land', () => {
  for (const isle of [null, 'kharos', 'myrrow', 'velmarch']) {
    for (let s = 1; s <= 4; s++) {
      for (let n = 0; n < 3; n++) {
        const f = buildFloor(rec(s, isle), n);
        const seen = reach(f);
        const W = f.plan.W;
        for (const r of f.rooms) {
          if (r.kit === 'hidden' || r.sealed) continue;
          let ok = false;
          for (let z = r.z0; z <= r.z1 && !ok; z++) for (let x = r.x0; x <= r.x1 && !ok; x++) ok = f.plan.room[z * W + x] === r.id && seen.has(z * W + x);
          assert.ok(ok, `${isle || 'thessa'} ${s}/${n}: the ${r.kit} room can't be reached`);
        }
        if (f.downAt) assert.ok(seen.has(f.downAt.z * W + f.downAt.x - f.x0), `${isle || 'thessa'} ${s}/${n}: the way down can't be reached`);
      }
    }
  }
});

test('a mine is laid out as a mine: its own rooms, its works, its papers', () => {
  const kits = new Set();
  let carts = 0;
  let pumps = 0;
  let bells = 0;
  let gas = 0;
  for (let s = 1; s <= 6; s++) {
    for (let n = 0; n < 3; n++) {
      const f = buildFloor(rec(s, null), n);
      for (const r of f.rooms) kits.add(r.kit);
      carts += (f.cartRuns || []).length;
      pumps += (f.pumps || []).length;
      bells += (f.bells || []).length;
      gas += (f.gas || []).length;
      // (Never more than two of one kind of room on a floor.)
      const count = {};
      for (const r of f.rooms) count[r.kit] = (count[r.kit] || 0) + 1;
      for (const k of ['stope', 'cave_in', 'sump', 'powder', 'shaft']) assert.ok(!(count[k] > 2), `${s}/${n}: ${count[k]} ${k}s`);
      if (n === 0) assert.ok(f.rooms.some((r) => r.kit === 'office'), 'the foreman\'s office on the first floor');
    }
  }
  for (const k of ['stope', 'sump', 'powder', 'cave_in', 'shaft', 'office']) assert.ok(kits.has(k), `some floor has a ${k}`);
  assert.ok(carts > 0 && pumps > 0 && bells > 0 && gas > 0, `carts ${carts}, pumps ${pumps}, bells ${bells}, gas ${gas}`);
});

test('what\'s written in a mine is its own, and the same each time', () => {
  const r = rec(3, null);
  const a = mineLore(r, 0, 'worm');
  const b = mineLore(r, 0, 'worm');
  assert.deepEqual(a.ledger(), b.ledger());
  assert.equal(a.owner, mineLore(r, 2, 'worm').owner, 'the same owner on every floor');
  assert.match(a.headframe().lines.join(' '), /copper/);
  assert.match(a.headframe().lines.join(' '), /Hobb/);
  assert.match(a.survey(true, 'over, away from the spur').lines.join(' '), /points are thrown over/);
  const other = mineLore(rec(4, null), 0, 'worm');
  assert.notEqual(a.owner + a.foreman, other.owner + other.foreman);
});

test('the mine\'s own creatures are all in the game and all drawn', () => {
  for (const sp of Object.keys(MINE_SPECIES)) {
    assert.ok(SPECIES[sp], `${sp} is a species`);
    assert.ok(MINE_MOBS[sp], `${sp} is drawn`);
    assert.ok(MINE_MOBS[sp].rows.length >= 16, `${sp} has rows`);
  }
});

// ------------------------------------------------------- in the mine itself
function inMine() {
  const game = makeGame(12345);
  const input = stubInput();
  game.minute = 600;
  for (let i = 0; i < 20; i++) game.update(0.1, input);
  const base = game.sim.dungeons.all.find((d) => d.type === 'mine');
  const r = { ...base, floors: {}, cleared: false, pack: null, weakened: 0 };
  new DungeonRun(game, r).enter();
  const d = game.dungeon;
  // (Nothing of the place about: each test sets out its own.)
  for (const c of game.creatures) {
    c.dead = true;
    game.removeOcc(c);
  }
  game.creatures = [];
  game.cheats = { ...(game.cheats || {}), god: false };
  // A clear stretch of floor, 9 by 5, in the way-in's room.
  const e = d.data.rooms.find((q) => q.kit === 'entry');
  const x0 = d.data.x0 + e.cx - 4;
  const z0 = e.cz - 2;
  for (let z = z0 - 1; z <= z0 + 5; z++) {
    for (let x = x0 - 1; x <= x0 + 9; x++) {
      for (const y of [FY, FY + 1, FY + 2]) game.world.setBlock(x, y, z, B.air);
      game.world.setBlock(x, FY - 1, z, B.mine_floor);
    }
  }
  const p = game.player;
  p.teleport(x0, FY, z0);
  p.hp = p.maxHp = 200;
  return { game, input, d, p, x0, z0 };
}
const run = (game, input, secs) => {
  for (let t = 0; t < secs; t += 0.05) game.update(0.05, input);
};

test('firedamp lit goes up all at once, the flame running through it, and hurts what\'s in it', () => {
  const { game, input, d, p, x0, z0 } = inMine();
  p.teleport(x0, FY, z0 + 4);
  for (let x = x0 + 2; x <= x0 + 7; x++) game.world.setBlock(x, FY, z0 + 1, B.firedamp);
  const c = d.spawn('rat', x0 + 7, FY, z0 + 1);
  c.dormant = 0.5;
  const hp = c.hp;
  assert.ok(igniteGas(game, x0 + 2, FY, z0 + 1));
  run(game, input, 2);
  for (let x = x0 + 2; x <= x0 + 7; x++) assert.notEqual(game.world.getBlock(x, FY, z0 + 1), B.firedamp, 'it all went up');
  assert.ok(c.dead || c.hp < hp, 'the rat at the far end was caught in it');
  d.leave();
});

test('a torch carried into firedamp lights it; a lantern doesn\'t', () => {
  const { game, input, d, p, x0, z0 } = inMine();
  game.world.setBlock(x0 + 3, FY, z0 + 2, B.firedamp);
  p.equip.shield = 'lantern';
  p.teleport(x0 + 2, FY, z0 + 2);
  run(game, input, 1.5);
  assert.equal(game.world.getBlock(x0 + 3, FY, z0 + 2), B.firedamp, 'a lantern: nothing');
  p.equip.shield = null;
  p.inv[p.selected] = { item: 'torch', count: 1 };
  assert.equal(p.heldLightKind(), 'fire');
  const hp = p.hp;
  run(game, input, 1.5);
  assert.notEqual(game.world.getBlock(x0 + 3, FY, z0 + 2), B.firedamp, 'a torch: up it goes');
  assert.ok(p.hp < hp, 'and you with it');
  d.leave();
});

test('a blast beetle struck curls up and rolls away fizzing, and goes off among whatever\'s there', () => {
  const { game, input, d, p, x0, z0 } = inMine();
  p.teleport(x0 + 1, FY, z0 + 2);
  const bt = d.spawn('blast_beetle', x0 + 2, FY, z0 + 2);
  const m = d.spawn('lost_miner', x0 + 6, FY, z0 + 2);
  m.dormant = 0.5;
  const mhp = m.hp;
  const was = bt.hp;
  game.damage(bt, 3, p);
  assert.equal(bt.hp, was, 'the blow turned off its shell');
  assert.ok(bt.armed, 'its fuse is lit');
  assert.ok(bt.x >= x0 + 4, `rolled off away from you (to ${bt.x - x0})`);
  run(game, input, 2);
  assert.ok(bt.dead, 'it went off');
  assert.ok(m.dead || m.hp < mhp, 'and took the miner with it');
  d.leave();
});

test('the drifting firedamp: burst, it leaves its gas; a flame near it, and it flares', () => {
  const { game, input, d, p, x0, z0 } = inMine();
  p.teleport(x0, FY, z0 + 4);
  const f = d.spawn('firedamp', x0 + 4, FY, z0 + 2);
  f.dormant = 0.5;
  game.damage(f, f.hp + 5, p);
  let gas = 0;
  for (let z = z0; z <= z0 + 4; z++) for (let x = x0 + 2; x <= x0 + 6; x++) if (game.world.getBlock(x, FY, z) === B.firedamp) gas++;
  assert.ok(gas >= 3, `it left its gas (${gas})`);
  // Another, with a torch brought to it.
  const g = d.spawn('firedamp', x0 + 7, FY, z0 + 4);
  p.inv[p.selected] = { item: 'torch', count: 1 };
  p.teleport(x0 + 8, FY, z0 + 4);
  g.target = p;
  run(game, input, 1.5);
  assert.ok(g.dead && g.burnt, 'it flared');
  d.leave();
});

test('a blast by a cracked prop brings the roof down round it', () => {
  const { game, input, d, p, x0, z0 } = inMine();
  p.teleport(x0, FY, z0 + 4);
  game.world.setBlock(x0 + 6, FY, z0 + 1, B.cracked_prop);
  const c = d.spawn('rat', x0 + 6, FY, z0 + 2);
  c.dormant = 0.5;
  const hp = c.hp;
  game.world.setBlock(x0 + 5, FY, z0 + 2, B.powder_keg);
  game.breakBlock?.(x0 + 5, FY, z0 + 2, false);
  if (game.world.getBlock(x0 + 5, FY, z0 + 2) === B.powder_keg) {
    // (Or set off by hand.)
    game.world.setBlock(x0 + 5, FY, z0 + 2, B.air);
    propFall(game, x0 + 6, FY, z0 + 1, 0.5);
  }
  run(game, input, 3);
  assert.equal(game.world.getBlock(x0 + 6, FY, z0 + 1), B.mine_fall, 'the prop\'s place is a fall of rock');
  assert.ok(c.dead || c.hp < hp, 'and the rat under it was hurt');
  d.leave();
});

test('the cart runs as the points are thrown: off down the spur, or into the fall and through it', () => {
  const { game, input, d } = inMine();
  // (Find a floor with a cart run with points.)
  let cr = (d.data.cartRuns || []).find((q) => q.switch);
  for (let f = 1; !cr && f < d.rec.depth; f++) {
    d.changeFloor(1);
    cr = (d.data.cartRuns || []).find((q) => q.switch);
  }
  if (!cr) return;
  for (const c of game.creatures) c.dormant = 0.5;
  const w = game.world;
  const p = game.player;
  // Thrown wrong.
  w.setState(cr.switch.x, FY, cr.switch.z, !cr.want);
  d.interact(cr.cart.x, FY, cr.cart.z, BLOCKS[B.runaway_cart]);
  run(game, input, 4);
  assert.equal(w.getBlock(cr.choke.x, FY, cr.choke.z), B.cart_choke, 'the fall\'s still there');
  assert.equal(w.getBlock(cr.cart.x, FY, cr.cart.z), B.mine_rail, 'the cart went off');
  assert.equal(w.getBlock(cr.spur.end.x, FY, cr.spur.end.z), B.runaway_cart, 'down the spur to the buffer');
  // Hauled back, the points thrown right, and again.
  d.interact(cr.spur.end.x, FY, cr.spur.end.z, BLOCKS[B.runaway_cart]);
  assert.equal(w.getBlock(cr.cart.x, FY, cr.cart.z), B.runaway_cart, 'hauled back');
  d.interact(cr.switch.x, FY, cr.switch.z, BLOCKS[B.rail_switch]);
  assert.equal(w.getState(cr.switch.x, FY, cr.switch.z) ? 1 : 0, cr.want);
  p.teleport(p.x, p.y, p.z);
  d.interact(cr.cart.x, FY, cr.cart.z, BLOCKS[B.runaway_cart]);
  run(game, input, 4);
  assert.equal(w.getBlock(cr.choke.x, FY, cr.choke.z), B.air, 'the fall burst open');
  assert.equal(w.getBlock(cr.choke.x, FY + 1, cr.choke.z), B.air);
  d.leave();
});

test('the pump drains the sump, and what was in the water comes up', () => {
  const { game, input, d } = inMine();
  let pm = (d.data.pumps || [])[0];
  for (let f = 1; !pm && f < d.rec.depth; f++) {
    d.changeFloor(1);
    pm = (d.data.pumps || [])[0];
  }
  if (!pm) return;
  const wet = pm.water.filter((q) => BLOCKS[game.world.getBlock(q.x, q.y, q.z)].liquid);
  assert.ok(wet.length > 0, 'water in the sump');
  d.interact(pm.x, FY, pm.z, BLOCKS[B.mine_pump]);
  run(game, input, 0.25 * pm.water.length + 2);
  assert.ok(pm.water.every((q) => !BLOCKS[game.world.getBlock(q.x, q.y, q.z)].liquid), 'drained');
  assert.ok(d.state.deeps.mine.drained[`${pm.x},${pm.z}`]);
  d.leave();
});

test('the shaft bell calls every lost miner on the floor to it', () => {
  const { game, d, p, x0, z0 } = inMine();
  const bell = { x: x0 + 8, z: z0 + 4 };
  game.world.setBlock(bell.x, FY, bell.z, B.shaft_bell);
  d.data.bells = [bell];
  p.teleport(x0, FY, z0);
  const m = d.spawn('lost_miner', x0 + 1, FY, z0 + 4, { dormant: 3 });
  m.dormant = 3;
  game.cheats = { ...(game.cheats || {}), invisible: true };
  // (Out of its sight: you, ringing from afar.)
  p.teleport(x0 + 9, FY, z0);
  d.interact(bell.x, FY, bell.z, BLOCKS[B.shaft_bell]);
  assert.equal(m.dormant, 0, 'it woke');
  assert.ok(m.lure, 'and heads for the bell');
  d.leave();
});

test('come near a crawler\'s eggs and they hatch', () => {
  const { game, input, d, p, x0, z0 } = inMine();
  game.world.setBlock(x0 + 5, FY, z0 + 2, B.egg_sac);
  d.data.eggs = [{ x: x0 + 5, z: z0 + 2 }];
  p.teleport(x0 + 3, FY, z0 + 2);
  run(game, input, 3);
  assert.equal(game.world.getBlock(x0 + 5, FY, z0 + 2), B.air, 'the egg\'s gone');
  assert.ok(game.creatures.some((c) => !c.dead && c.species === 'crawler' && c.hatchling), 'a crawler hatched');
  d.leave();
});

test('hurt a knocker and the roof comes down on you', () => {
  const { game, input, d, p, x0, z0 } = inMine();
  p.teleport(x0 + 2, FY, z0 + 2);
  const k = d.spawn('knocker', x0 + 3, FY, z0 + 2, { peaceful: true });
  const hp = p.hp;
  game.damage(k, 5, p);
  assert.ok(k.dead, 'it\'s gone');
  assert.ok((game.hazards || []).some((h) => h.kind === 'rocks'), 'rock coming down');
  run(game, input, 1.5);
  assert.ok(p.hp < hp, 'on you');
  d.leave();
});

test('the mine\'s masters are all painted by hand, every part in place', () => {
  const names = Object.keys(MINE_BOSS_ART);
  assert.equal(names.length, 23);
  for (const k of names) {
    assert.ok(SPECIES[k], `${k} is a species`);
    const D = FORGE[k];
    assert.ok(D && D.pix, `${k} is painted`);
    const A = MINE_BOSS_ART[k];
    assert.ok(A.body.rows.length, `${k} has a body`);
    for (const [n, q] of Object.entries(A.parts || {})) {
      assert.ok(q.pix && q.pix.rows.length, `${k}.${n} has a picture`);
      if (q.parent) assert.ok(A.parts[q.parent], `${k}.${n} hangs on ${q.parent}`);
    }
  }
  // (What their effects hang on: the overseers' weapons in their hands,
  // the golems' heads.)
  for (const k of ['foreman', 'iron_legate']) assert.equal(MINE_BOSS_ART[k].parts.blade.parent, 'armN', `${k}'s weapon is in its hand`);
  for (const k of ['deep_golem', 'turquoise_golem', 'rune_golem', 'storm_giant']) assert.ok(MINE_BOSS_ART[k].parts.head, `${k} has a head`);
});

test('the version and its step', () => {
  assert.equal(GAME_VERSION, '0.96.0');
  const steps = stepsFor('0.95.0');
  assert.ok(steps.some((s) => s.to === '0.96.0'));
});
