// Round 98: the holdout made over. Its floors laid out by its own
// architect (the mess, the bunks, the watch with its scaffold, the kennel,
// the armory, the cells, the store and its stash, the kitchen, the powder
// hole, the crack with its rope bridge), every one of them walkable in
// every land; what's written there made from its history and the towns it
// robs; its own creatures drawn; and its works at work: the plunder
// crates (the ledger's brand holds the take; the wrong one is loud), the
// false wall, the cells and the captives in them, the powder trails, the
// kegs kicked rolling, tripwires, hides over staked pits, the lookout's
// mark, the houndmaster and his dogs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGame, stubInput } from './helpers.mjs';
import { DungeonRun } from '../src/game/dungeon.js';
import { buildFloor, FY, DTYPES } from '../src/world/dungeongen.js';
import { BLOCKS, B } from '../src/world/blocks.js';
import { SPECIES } from '../src/entities/creature.js';
import { HOLD_SPECIES } from '../src/entities/holdmobs.js';
import { HOLD_MOBS } from '../src/render/art/hold_mobs.js';
import { HOLD_SPRITES } from '../src/render/art/hold_tex.js';
import { holdLore, BRANDS } from '../src/world/deeps/holdoutlore.js';
import { rollKeg } from '../src/game/holdwork.js';
import { addItem, countItem } from '../src/game/inventory.js';
import { GAME_VERSION, compareVersions } from '../src/version.js';
import { stepsFor } from '../src/game/migrate.js';
import { HOLD_BOSS_ART } from '../src/render/art/hold_bosses.js';
import { FORGE } from '../src/render/forge.js';
import '../src/render/bossbody.js';

const rec = (s, isle) => ({
  id: `h${s}`, type: 'holdout', seed: s * 7919 + 13, depth: 3, level: 1 + (s % 3), isle, name: 'Black Rat Holdout', townName: 'Hobb',
  origin: { y: 211, who: 'Jory Black' }, fallen: [],
});
const blockAt = (f, x, y, z) => {
  const r = f.regions.get(Math.floor(x / 64) * 4096 + Math.floor(z / 36));
  return r ? r.get(x % 64, y, z % 36) : 0;
};
// (What's meant to be opened to be got through.)
const PASS = new Set(['sealed', 'portcullis', 'boss_gate', 'cell_door']);
const solid = (f, x, y, z) => {
  const b = BLOCKS[blockAt(f, x, y, z)];
  return !!(b && b.solid && !PASS.has(b.interact) && b.name !== 'weak_wall' && b.name !== 'hold_false');
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
      // (Up a ladder onto the scaffold; a step at a time otherwise.)
      const ladder = blockAt(f, f.x0 + x, FY, z) === B.ladder;
      if (h2 == null || (h2 - h > 1 && !ladder) || h - h2 > 2) continue;
      seen.add(i);
      st.push([nx, nz]);
    }
  }
  return seen;
}
const nextTo = (seen, W, x0, p) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, c]) => seen.has((p.z + c) * W + p.x + a - x0));

test('every holdout floor can be walked, scaffolds, cells and cracks and all, in every land', () => {
  for (const isle of [null, 'kharos', 'myrrow', 'velmarch', 'skerries']) {
    for (let s = 1; s <= 4; s++) {
      for (let n = 0; n < 3; n++) {
        const f = buildFloor(rec(s, isle), n);
        const seen = reach(f);
        const W = f.plan.W;
        const at = `${isle || 'thessa'} ${s}/${n}`;
        for (const r of f.rooms) {
          if (r.kit === 'hidden' || r.sealed) continue;
          let ok = false;
          for (let z = r.z0; z <= r.z1 && !ok; z++) for (let x = r.x0; x <= r.x1 && !ok; x++) ok = f.plan.room[z * W + x] === r.id && seen.has(z * W + x);
          assert.ok(ok, `${at}: the ${r.kit} room can't be reached`);
        }
        if (f.downAt) assert.ok(seen.has(f.downAt.z * W + f.downAt.x - f.x0), `${at}: the way down can't be reached`);
        // Up the ladder to the lookout; to every cell's door; to the false wall.
        for (const l of f.spawns.filter((q) => q.species === 'lookout')) assert.ok(seen.has(l.z * W + l.x - f.x0), `${at}: the lookout's scaffold`);
        for (const c of f.cells || []) {
          assert.ok(nextTo(seen, W, f.x0, c.door), `${at}: a cell door`);
          assert.equal(f.spawns[c.captive]?.species, 'captive', `${at}: the captive behind it`);
        }
        if (f.stash) assert.ok(nextTo(seen, W, f.x0, f.stash), `${at}: the false wall`);
      }
    }
  }
});

test('a holdout is laid out as a holdout: its own rooms, its scaffolds, its riddle', () => {
  const kits = new Set();
  let ladders = 0;
  let stakes = 0;
  let wires = 0;
  let hides = 0;
  for (let s = 1; s <= 6; s++) {
    for (let n = 0; n < 3; n++) {
      const f = buildFloor(rec(s, null), n);
      for (const r of f.rooms) kits.add(r.kit);
      stakes += (f.stakes || []).length;
      for (let z = 0; z < f.plan.D; z++) {
        for (let x = 0; x < f.plan.W; x++) {
          const id = blockAt(f, f.x0 + x, FY, z);
          if (id === B.ladder) ladders++;
          if (id === B.hold_tripwire) wires++;
          if (id === B.hold_hide) hides++;
        }
      }
      if (n === 0) {
        assert.ok(f.rooms.some((r) => r.kit === 'plunder') && f.rooms.some((r) => r.kit === 'cells'), 'the store and the cells on the first floor');
        assert.ok(f.lore.some((l) => l.title === 'WANTED'), 'the wanted bill at the way in');
      }
      // (Exactly one crate of the brand the ledger names.)
      if (f.plunder) {
        assert.equal(f.plunder.crates.filter((c) => c.brand === f.plunder.answer).length, 1);
        for (const c of f.plunder.crates) assert.equal(blockAt(f, c.x, FY, c.z), B[`crate_${BRANDS[c.brand]}`]);
        const ledger = f.lore.find((l) => l.title === 'The Plunder Ledger');
        assert.ok(ledger && ledger.lines.join(' ').includes(`the ${BRANDS[f.plunder.answer]} burnt on it`));
      }
      if (f.stash) assert.equal(blockAt(f, f.stash.x, FY, f.stash.z), B.hold_false);
      const count = {};
      for (const r of f.rooms) count[r.kit] = (count[r.kit] || 0) + 1;
      for (const k of ['mess', 'plunder', 'cells', 'kitchen', 'magazine', 'armory', 'chasm', 'kennel']) assert.ok(!(count[k] > 1), `${s}/${n}: ${count[k]} ${k}s`);
    }
  }
  for (const k of ['mess', 'bunks', 'watch', 'kennel', 'armory', 'cells', 'plunder', 'kitchen', 'magazine', 'chasm']) assert.ok(kits.has(k), `some floor has a ${k}`);
  assert.ok(ladders > 0 && stakes > 0 && wires > 0 && hides > 0, `ladders ${ladders}, stakes ${stakes}, wires ${wires}, hides ${hides}`);
});

test('what\'s written in a holdout is its own, and the same each time', () => {
  const r = rec(3, null);
  const a = holdLore(r, 0, 'warlord');
  const b = holdLore(r, 0, 'warlord');
  assert.deepEqual(a.wanted(), b.wanted());
  assert.equal(a.gang, holdLore(r, 2, 'warlord').gang, 'the same gang on every floor');
  assert.match(a.wanted().lines.join(' '), /Hobb/);
  assert.match(a.wanted().lines.join(' '), /black-bearded/);
  assert.match(a.last().lines.join(' '), /Jory Black/);
  assert.match(a.last().lines.join(' '), /211/);
  assert.match(a.ledger(2).lines.join(' '), /the fish burnt on it/);
  const cap = a.captive('in the store-cave, on its north side');
  assert.ok(cap.name && cap.thanks && cap.farewell);
  assert.match(cap.stashHint, /store-cave, on its north side/);
  assert.notEqual(a.gang + a.chief, holdLore(rec(4, null), 0, 'warlord').gang + holdLore(rec(4, null), 0, 'warlord').chief);
});

test('the holdout\'s own creatures are all in the game and all drawn; its props too', () => {
  for (const sp of Object.keys(HOLD_SPECIES)) {
    assert.ok(SPECIES[sp], `${sp} is a species`);
    assert.ok(HOLD_MOBS[sp] && HOLD_MOBS[sp].rows.length >= 16, `${sp} is drawn`);
  }
  for (const k of ['war_hound', 'bruiser']) assert.ok(DTYPES.holdout.mobs.some(([s]) => s === k), `${k} wanders the holdout`);
  for (const k of ['hold_table', 'hold_bunk', 'hold_spit', 'crate_star', 'crate_wheel', 'crate_fish', 'crate_tree', 'crate_open', 'loot_throne', 'hold_lantern', 'wanted_post', 'plunder_ledger']) {
    const p = HOLD_SPRITES[k](0, 0, 0);
    assert.ok(p.d.some((v) => v), `${k} is drawn`);
  }
});

// ------------------------------------------------------- in the holdout itself
function inHold() {
  const game = makeGame(12345);
  const input = stubInput();
  game.minute = 600;
  for (let i = 0; i < 20; i++) game.update(0.1, input);
  const base = game.sim.dungeons.all.find((d) => d.type === 'holdout');
  const r = { ...base, floors: {}, cleared: false, pack: null, weakened: 0 };
  new DungeonRun(game, r).enter();
  const d = game.dungeon;
  for (const c of game.creatures) {
    c.dead = true;
    game.removeOcc(c);
  }
  game.creatures = [];
  game.cheats = { ...(game.cheats || {}), god: false };
  // A clear stretch of floor, 15 by 8, about the way in; nothing of the
  // place's own works on this floor but what each test sets out.
  d.data.plunder = null;
  d.data.stash = null;
  d.data.cells = [];
  d.data.gongs = [];
  const e = d.data.rooms.find((q) => q.kit === 'entry');
  const x0 = d.data.x0 + e.cx - 7;
  const z0 = e.cz - 2;
  for (let z = z0 - 2; z <= z0 + 5; z++) {
    for (let x = x0 - 1; x <= x0 + 15; x++) {
      for (const y of [FY, FY + 1, FY + 2]) game.world.setBlock(x, y, z, B.air);
      game.world.setBlock(x, FY - 1, z, B.hold_dirt);
    }
  }
  const p = game.player;
  p.teleport(x0, FY, z0 + 2);
  p.hp = p.maxHp = 200;
  return { game, input, d, p, x0, z0 };
}
const run = (game, input, secs) => {
  for (let t = 0; t < secs; t += 0.05) game.update(0.05, input);
};

test('the plunder crates: the ledger\'s brand holds the take; a wrong one is loud', () => {
  const { game, d, p, x0, z0 } = inHold();
  game.world.setBlock(x0 + 2, FY, z0, B.crate_star);
  game.world.setBlock(x0 + 4, FY, z0, B.crate_wheel);
  d.data.plunder = { crates: [{ x: x0 + 2, z: z0, brand: 0 }, { x: x0 + 4, z: z0, brand: 1 }], answer: 0 };
  const c = d.spawn('cutthroat', x0 + 8, FY, z0 + 2, { dormant: 3 });
  p.teleport(x0 + 3, FY, z0 + 1);
  d.interact(x0 + 4, FY, z0, BLOCKS[B.crate_wheel]);
  assert.equal(game.world.getBlock(x0 + 4, FY, z0), B.crate_open, 'prised open');
  assert.equal(c.dormant, 0, 'and the noise woke the one dozing nearby');
  const coin = countItem(p.inv, 'coin');
  d.interact(x0 + 2, FY, z0, BLOCKS[B.crate_star]);
  assert.ok(countItem(p.inv, 'coin') >= coin + 12, 'the take');
  assert.ok(countItem(p.inv, 'gold_ingot') >= 1, 'and a gold bar');
  d.leave();
});

test('the false wall gives under your hand: the stash behind it', () => {
  const { game, d, p, x0, z0 } = inHold();
  for (const y of [FY, FY + 1]) game.world.setBlock(x0 + 2, y, z0 - 2, B.hold_false);
  d.data.stash = { x: x0 + 2, z: z0 - 2, ox: 0, oz: 1 };
  p.teleport(x0 + 2, FY, z0 - 1);
  d.interact(x0 + 2, FY, z0 - 2, BLOCKS[B.hold_false]);
  assert.equal(game.world.getBlock(x0 + 2, FY, z0 - 2), B.air);
  assert.equal(game.world.getBlock(x0 + 2, FY + 1, z0 - 2), B.air);
  assert.ok(d.state.deeps.hold.stash, 'remembered');
  d.leave();
});

test('a cell door: locked without the keys; with them, the captive follows you out and tells you of the stash', () => {
  const { game, input, d, p, x0, z0 } = inHold();
  const door = { x: x0 + 6, z: z0 - 1 };
  game.world.setBlock(door.x, FY, door.z, B.cell_door);
  const cap = d.spawn('captive', door.x, FY, z0 - 2, { id: 77, rest: true, peaceful: true });
  d.data.cells = [{ door, captive: 77, name: 'Ann Reed', thanks: 'Get me out!', farewell: 'Thank you.', stashHint: 'Behind the false wall.' }];
  d.data.stash = { x: x0 + 14, z: z0 - 2, ox: 0, oz: 1 };
  p.teleport(door.x, FY, door.z + 1);
  game.interact(door.x, FY, door.z);
  assert.equal(game.world.getBlock(door.x, FY, door.z), B.cell_door, 'locked fast');
  addItem(p.inv, 'cell_keys', 1);
  game.interact(door.x, FY, door.z);
  assert.equal(game.world.getBlock(door.x, FY, door.z), B.cell_door_open, 'the keys turn it');
  assert.ok(cap.freed && cap.follow === p, 'and they come with you');
  // Brought to the way in: away, and what they know told.
  d.data.entry = { x: x0 + 10, z: z0 + 2 };
  p.teleport(x0 + 10, FY, z0 + 3);
  game.removeOcc(cap);
  cap.teleport(x0 + 11, FY, z0 + 2);
  game.moveEntity(cap, x0 + 11, FY, z0 + 2);
  const coin = countItem(p.inv, 'coin');
  run(game, input, 0.5);
  assert.ok(cap.dead && cap.rescued, 'away up the tunnel');
  assert.ok(countItem(p.inv, 'coin') > coin, 'a few coins pressed on you');
  assert.ok(d.state.deeps.hold.told, 'and told of the stash');
  d.leave();
});

test('a powder trail lit burns along to the kegs, and they go up', () => {
  const { game, input, d, p, x0, z0 } = inHold();
  for (let x = x0 + 3; x <= x0 + 6; x++) game.world.setBlock(x, FY, z0 + 2, B.hold_powder);
  game.world.setBlock(x0 + 7, FY, z0 + 2, B.powder_keg);
  const c = d.spawn('cutthroat', x0 + 8, FY, z0 + 2, { dormant: 99 });
  const hp = c.hp;
  p.teleport(x0 + 2, FY, z0 + 2);
  d.interact(x0 + 3, FY, z0 + 2, BLOCKS[B.hold_powder]);
  assert.equal(game.world.getBlock(x0 + 3, FY, z0 + 2), B.hold_powder, 'no flame, no fire');
  p.inv[p.selected] = { item: 'torch', count: 1 };
  d.interact(x0 + 3, FY, z0 + 2, BLOCKS[B.hold_powder]);
  p.teleport(x0, FY, z0 - 1);
  run(game, input, 3);
  assert.equal(game.world.getBlock(x0 + 5, FY, z0 + 2), B.air, 'burnt along');
  assert.notEqual(game.world.getBlock(x0 + 7, FY, z0 + 2), B.powder_keg, 'the keg gone up');
  assert.ok(c.hp < hp || c.dead, 'and whoever stood by it with it');
  d.leave();
});

test('a keg kicked rolling bursts on whatever it meets', () => {
  const { game, input, d, x0, z0 } = inHold();
  game.world.setBlock(x0 + 3, FY, z0, B.powder_keg);
  const c = d.spawn('cutthroat', x0 + 8, FY, z0, { dormant: 99 });
  const hp = c.hp;
  rollKeg(d, x0 + 3, z0, 1, 0, null);
  run(game, input, 2.5);
  assert.ok(c.hp < hp || c.dead, 'it rolled into them');
  d.leave();
});

test('a tripwire\'s bells rouse the gang; a hide gives onto stakes', () => {
  const { game, input, d, p, x0, z0 } = inHold();
  const c = d.spawn('cutthroat', x0 + 9, FY, z0 + 4, { dormant: 99 });
  game.world.setBlock(x0 + 2, FY, z0 + 2, B.hold_tripwire);
  p.teleport(x0 + 2, FY, z0 + 2);
  run(game, input, 0.2);
  assert.equal(game.world.getBlock(x0 + 2, FY, z0 + 2), B.air, 'the wire snapped');
  assert.equal(c.dormant, 0, 'they heard');
  assert.equal(c.target, p);
  game.world.setBlock(x0 + 4, FY, z0, B.hold_hide);
  const hp = p.hp;
  p.teleport(x0 + 4, FY, z0);
  run(game, input, 0.6);
  assert.equal(game.world.getBlock(x0 + 4, FY - 1, z0), B.spikes, 'a staked pit under it');
  assert.equal(Math.round(p.y), FY - 1, 'down in it');
  assert.ok(p.hp < hp, 'and it bit');
  d.leave();
});

test('the lookout marks you and sounds the horn; marked, an archer\'s arrows find you further off', () => {
  const { game, input, d, p, x0, z0 } = inHold();
  const sleeper = d.spawn('cutthroat', x0 + 14, FY, z0 + 4, { dormant: 99 });
  const lk = d.spawn('lookout', x0 + 6, FY, z0 + 2, {});
  lk.target = p;
  run(game, input, 0.5);
  assert.ok(p.markedT > 0, 'marked');
  assert.equal(sleeper.dormant, 0, 'the horn woke them');
  game.kill(lk, p);
  const ar = d.spawn('holdout_archer', x0 + 12, FY, z0 + 2, {});
  ar.target = p;
  p.markedT = 9;
  p.markedBy = { dead: false };
  let homing = false;
  for (let t = 0; t < 6 && !homing; t += 0.05) {
    game.update(0.05, input);
    homing = game.projectiles.some((a) => a.from === ar && a.homing);
  }
  assert.ok(homing, 'shot at twelve paces, and the arrow follows you');
  d.leave();
});

test('the houndmaster down, his dogs go wild', () => {
  const { game, input, d, p, x0, z0 } = inHold();
  const hm = d.spawn('houndmaster', x0 + 8, FY, z0 + 2, { group: 'pack' });
  const dogs = [d.spawn('war_hound', x0 + 6, FY, z0 + 1, { group: 'pack' }), d.spawn('war_hound', x0 + 6, FY, z0 + 3, { group: 'pack' })];
  hm.target = p;
  game.damage(hm, 9999, p);
  run(game, input, 0.2);
  assert.ok(hm.dead);
  for (const h of dogs) assert.ok(h.wild, 'wild');
  d.leave();
});

test('the holdout\'s chiefs are all painted by hand, every part in place', () => {
  const names = Object.keys(HOLD_BOSS_ART);
  assert.equal(names.length, 24, 'the twenty-three, the twins two of them');
  for (const k of names) {
    assert.ok(SPECIES[k], `${k} is a species`);
    const D = FORGE[k];
    assert.ok(D && D.pix, `${k} is painted`);
    const A = HOLD_BOSS_ART[k];
    assert.ok(A.body.rows.length, `${k} has a body`);
    for (const [n, q] of Object.entries(A.parts || {})) {
      assert.ok(q.pix && q.pix.rows.length, `${k}.${n} has a picture`);
      if (q.parent) assert.ok(A.parts[q.parent], `${k}.${n} hangs on ${q.parent}`);
    }
  }
  // (What their effects hang on: the weapons in their hands; the hydra's
  // heads on their necks; the drake's jaw that breathes fire.)
  for (const k of ['warlord', 'twins', 'twin_b', 'poisoner', 'bombard_queen', 'the_wrecker', 'sharktooth']) assert.equal(HOLD_BOSS_ART[k].parts.blade.parent, 'armN', `${k}'s weapon is in its hand`);
  for (let i = 0; i < 3; i++) assert.equal(HOLD_BOSS_ART.lagoon_hydra.parts[`head${i}`].parent, `neck${i}`);
  assert.equal(HOLD_BOSS_ART.chained_drake.parts.jaw.parent, 'head');
  for (const k of ['war_eagle', 'thunderbird', 'storm_petrel']) assert.ok(HOLD_BOSS_ART[k].parts.wingN && HOLD_BOSS_ART[k].parts.wingF, `${k} has its wings`);
});

test('the version and its step', () => {
  assert.ok(compareVersions(GAME_VERSION, '0.98.0') >= 0);
  assert.equal(GAME_VERSION, '0.98.0');
  const steps = stepsFor('0.97.0');
  assert.ok(steps.some((s) => s.to === '0.98.0'));
});
