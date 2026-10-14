// Round 114: fixes from play, and the barrow's heights. The barrow ship's
// hold planked all round with a ladder out; galleries and sunken floors
// with steps in the barrow's rooms; floors blended, their plain tiles laid
// most; every stair the right way round; pools let into the floor; no room
// more crowded than its tier allows; the corpse-light's cold fire, the
// tomb rats' bite, the old hound and its bones; the time crystal never
// shutting you in; cells locked while anyone's in them (and picked open,
// and the prisoner gone); a doorway that isn't a house; the coachman and
// his one coach; the weather easing from one kind into another; a skip of
// days that doesn't hold the game up; and a wedding's half-eaten dishes
// never read back off the screen.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { makeGame, stubInput } from './helpers.mjs';
import { DungeonRun } from '../src/game/dungeon.js';
import { buildFloor, FY, encounterCap, ENCOUNTER_CAP } from '../src/world/dungeongen.js';
import { BLOCKS, B } from '../src/world/blocks.js';
import { Creature } from '../src/entities/creature.js';
import { shipFloor, stepRot } from '../src/world/deeps/barrow.js';
import { variantAt } from '../src/render/renderer.js';
import { restoreDungeon } from '../src/game/timecrystal.js';
import { restamp } from '../src/world/sites.js';
import { useCellDoor, cellLocked, cellOccupants } from '../src/game/cells.js';
import { coachStand, coachLinks, coachmanAt, coachAway } from '../src/sim/coaches.js';
import { CRIMES } from '../src/sim/justice.js';
import { GAME_VERSION, compareVersions } from '../src/version.js';
import { stepsFor } from '../src/game/migrate.js';

const at = (f, x, y, z) => {
  const r = f.regions.get(Math.floor(x / 64) * 4096 + Math.floor(z / 36));
  return r ? r.get(x % 64, y, z % 36) : 0;
};
const metaAt = (f, x, y, z) => {
  const r = f.regions.get(Math.floor(x / 64) * 4096 + Math.floor(z / 36));
  return r ? r.meta[r.constructor.idx(x % 64, y, z % 36)] : 0;
};
const PASS = new Set(['sealed', 'portcullis', 'boss_gate']);
const solid = (f, x, y, z) => {
  const b = BLOCKS[at(f, x, y, z)];
  return !!(b && b.solid && !PASS.has(b.interact) && b.name !== 'weak_wall' && b.name !== 'spiral_seal');
};
const standY = (f, x, z) => {
  for (let y = FY + 1; y >= FY - 1; y--) if (!solid(f, x, y, z) && !solid(f, x, y + 1, z) && solid(f, x, y - 1, z)) return y;
  return null;
};
const brec = (s, isle = null, extra = {}) => ({ id: `b${s}`, type: 'barrow', seed: s * 7919 + 13, depth: 3, level: 1 + (s % 3), isle, name: 'Test Mound', origin: { who: 'the Grey Jarl', y: 211 }, fallen: [], ...extra });
const typed = (type, s, isle = null, extra = {}) => ({ ...brec(s, isle, extra), id: `${type}${s}`, type });
// Every tile you can get to from the way in, a step up or down at a time.
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
      if (h2 == null || h2 - h > 1 || h - h2 > 2) continue;
      if (h2 > h && solid(f, f.x0 + x, h + 2, z)) continue;
      seen.add(i);
      st.push([nx, nz]);
    }
  }
  return seen;
}

// ------------------------------------------------------------ the barrow
test('the barrow ship: its hold planked all round, and a ladder up out of it', () => {
  let ships = 0;
  for (let s = 0; s < 20; s++) {
    const rec = { id: `s${s}`, type: 'barrow', isle: 'corrow', seed: 500 + s * 17, depth: 3, level: 2 };
    const n = shipFloor(rec);
    if (n < 0) continue;
    const f = buildFloor(rec, n);
    const r = f.rooms.find((q) => q.kit === 'ship');
    if (!r) continue;
    ships++;
    let ladder = 0;
    for (let z = r.z0; z <= r.z1; z++) {
      for (let x = r.x0; x <= r.x1; x++) {
        const X = f.x0 + x;
        if (at(f, X, FY - 1, z) === B.ladder && at(f, X, FY, z) === B.ladder) ladder++;
        // (A tile of the hold: its sides at the hold's height are the hull.)
        const inHold = at(f, X, FY - 2, z) === B.planks_dark && !solid(f, X, FY - 1, z);
        if (!inHold) continue;
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const id = at(f, X + dx, FY - 1, z + dz);
          if (!BLOCKS[id].solid) continue;
          assert.ok([B.planks_dark, B.bier, B.grave_goods].includes(id), `seed ${s}: the hold's side is ${BLOCKS[id].name}, not the hull`);
        }
      }
    }
    assert.ok(ladder >= 1, `seed ${s}: a ladder out of the hold`);
  }
  assert.ok(ships >= 5, 'enough ships looked at');
});

test('the barrow has galleries and sunken floors, with steps, and every room can still be walked to', () => {
  let terraces = 0;
  let sunken = 0;
  for (const isle of [null, 'kharos', 'velmarch']) {
    for (let s = 1; s <= 6; s++) {
      for (let n = 0; n < 3; n++) {
        const f = buildFloor(brec(s, isle), n);
        for (const t of f.terraces || []) {
          terraces++;
          assert.ok(t.steps.length >= 1, 'a gallery has steps up to it');
          for (const q of t.steps) assert.ok(BLOCKS[at(f, q.x, FY, q.z)].stair, 'a step is a stair');
        }
        for (const t of f.sunken || []) {
          sunken++;
          assert.ok(t.steps.length >= 1, 'a sunken floor has steps down into it');
          for (const q of t.steps) assert.ok(BLOCKS[at(f, q.x, FY - 1, q.z)].stair, 'a step down is a stair');
        }
        const seen = reach(f);
        const W = f.plan.W;
        for (const r of f.rooms) {
          if (r.kit === 'hidden' || r.sealed) continue;
          let ok = false;
          for (let z = r.z0; z <= r.z1 && !ok; z++) for (let x = r.x0; x <= r.x1 && !ok; x++) ok = f.plan.room[z * W + x] === r.id && seen.has(z * W + x);
          assert.ok(ok, `${isle || 'thessa'} ${s}/${n}: the ${r.kit} room can't be reached`);
        }
      }
    }
  }
  assert.ok(terraces >= 10, `galleries (${terraces})`);
  assert.ok(sunken >= 10, `sunken floors (${sunken})`);
});

test('every stair in every kind of old place climbs toward its higher side', () => {
  const D4 = [[0, 1], [-1, 0], [0, -1], [1, 0]];
  assert.deepEqual([stepRot(0, 1), stepRot(-1, 0), stepRot(0, -1), stepRot(1, 0)], [0, 1, 2, 3]);
  for (const type of ['barrow', 'mine', 'crypt', 'catacomb', 'grove', 'forge', 'vault', 'grotto']) {
    let stairs = 0;
    for (let s = 1; s <= 3; s++) {
      for (let n = 0; n < 3; n++) {
        const f = buildFloor(typed(type, s), n);
        for (let z = 0; z < f.plan.D; z++) {
          for (let x = 0; x < f.plan.W; x++) {
            for (const y of [FY - 1, FY]) {
              const X = f.x0 + x;
              if (!BLOCKS[at(f, X, y, z)]?.stair) continue;
              stairs++;
              const [dx, dz] = D4[metaAt(f, X, y, z) & 3];
              const hi = standY(f, X + dx, z + dz);
              const lo = standY(f, X - dx, z - dz);
              if (hi !== null && lo !== null) assert.ok(hi >= lo, `${type} ${s}/${n}: a stair at ${x},${z} climbs the wrong way`);
            }
          }
        }
      }
    }
    if (['barrow', 'catacomb', 'grove', 'forge', 'grotto'].includes(type)) assert.ok(stairs > 0, `${type} has stairs`);
  }
});

test('pools lie in the floor, never on top of it', () => {
  for (const [type, isle] of [['grotto', null], ['grove', null], ['forge', null], ['broch', null], ['mine', 'skerries']]) {
    for (let s = 1; s <= 3; s++) {
      for (let n = 0; n < 3; n++) {
        const f = buildFloor(typed(type, s, isle), n);
        const lifted = new Set((f.lifted || []).map((q) => `${q.x},${q.z}`));
        for (let z = 0; z < f.plan.D; z++) {
          for (let x = 0; x < f.plan.W; x++) {
            const X = f.x0 + x;
            if (!BLOCKS[at(f, X, FY, z)]?.liquid || lifted.has(`${X},${z}`)) continue;
            assert.fail(`${type}${isle ? ` (${isle})` : ''} ${s}/${n}: ${BLOCKS[at(f, X, FY, z)].name} stood on the floor at ${x},${z}`);
          }
        }
      }
    }
  }
});

test('no room sets more foes on you than its tier allows', () => {
  assert.deepEqual([1, 2, 3, 4].map((t) => encounterCap({ tier: t })), [3, 4, 4, 5]);
  assert.equal(encounterCap({}), ENCOUNTER_CAP[1]);
  for (const type of ['barrow', 'mine', 'crypt', 'holdout', 'catacomb', 'gut']) {
    for (const tier of [1, 2, 4]) {
      for (let s = 1; s <= 3; s++) {
        const f = buildFloor(typed(type, s, null, { tier, level: 3 }), s % 3);
        const count = new Map();
        for (const sp of f.spawns) {
          if (sp.boss || sp.twin || sp.guardian || sp.peaceful) continue;
          const room = f.rooms[sp.room];
          if (room && room.kit === 'boss') continue;
          count.set(sp.room, (count.get(sp.room) || 0) + 1);
        }
        for (const [room, k] of count) assert.ok(k <= encounterCap({ tier }), `${type} tier ${tier}: room ${room} has ${k} foes`);
      }
    }
  }
});

test('floor tiles: the plain one laid most, the rest less and less', () => {
  const n = [0, 0, 0, 0];
  for (let z = 0; z < 200; z++) for (let x = 0; x < 200; x++) n[variantAt(x, 5, z)]++;
  const p = n.map((k) => k / 40000);
  assert.ok(Math.abs(p[0] - 0.5) < 0.03 && Math.abs(p[1] - 0.25) < 0.03 && Math.abs(p[2] - 0.15) < 0.03 && Math.abs(p[3] - 0.1) < 0.03, `weights ${p.map((q) => q.toFixed(2))}`);
});

// ------------------------------------------------------------ the barrow's creatures
function inBarrow() {
  const game = makeGame(12345);
  const input = stubInput();
  game.minute = 600;
  for (let i = 0; i < 20; i++) game.update(0.1, input);
  const base = game.sim.dungeons.all.find((q) => q.type === 'barrow') || game.sim.dungeons.all[0];
  const r = { ...base, type: 'barrow', floors: {}, cleared: false, pack: null, weakened: 0 };
  new DungeonRun(game, r).enter();
  const d = game.dungeon;
  for (const c of game.creatures) {
    c.dead = true;
    game.removeOcc(c);
  }
  game.creatures = [];
  for (const k of ['snares', 'offerings', 'wakes']) d.data[k] = [];
  d.data.hound = null;
  // A clear hall, 15 by 8, about the way in.
  const e = d.data.rooms.find((q) => q.kit === 'entry');
  const x0 = d.data.x0 + e.cx - 7;
  const z0 = e.cz - 2;
  for (let z = z0 - 2; z <= z0 + 5; z++) {
    for (let x = x0 - 1; x <= x0 + 15; x++) {
      for (const y of [FY, FY + 1, FY + 2]) game.world.setBlock(x, y, z, B.air);
      game.world.setBlock(x, FY - 1, z, B.barrow_flags);
      game.world.setBlock(x, FY - 2, z, B.stone);
    }
  }
  game.zones = [];
  game.hazards = [];
  const p = game.player;
  p.teleport(x0, FY, z0 + 5);
  p.hp = p.maxHp = 200;
  return { game, input, d, p, x0, z0 };
}
const runFor = (game, input, secs, each = null) => {
  for (let t = 0; t < secs; t += 0.05) {
    game.update(0.05, input);
    if (each) each();
  }
};
const spawn = (game, species, x, z) => {
  const c = new Creature(game, species, x, FY, z);
  c.dormant = 0;
  game.addCreature(c);
  return c;
};

test('the corpse-light keeps off and throws cold fire; a tomb rat on its own bites', () => {
  {
    const { game, input, p, x0, z0 } = inBarrow();
    const c = spawn(game, 'corpse_light', x0 + 5, z0 + 5);
    let orbs = 0;
    const hp0 = p.hp;
    runFor(game, input, 10, () => {
      for (const q of game.projectiles) if (q.kind === 'orb' && q.from === c && !q.counted) {
        q.counted = true;
        orbs++;
      }
    });
    assert.ok(orbs >= 1, 'it threw its cold fire');
    assert.ok(p.hp < hp0, 'and it burned');
  }
  {
    const { game, input, p, x0, z0 } = inBarrow();
    spawn(game, 'tomb_rat', x0 + 1, z0 + 5);
    const hp0 = p.hp;
    runFor(game, input, 8);
    assert.ok(p.hp < hp0, 'a rat on its own still bites');
  }
});

test('the old hound walks (never jumps), comes to a bone in your hand, and eats the bones you drop', () => {
  const { game, input, p, x0, z0 } = inBarrow();
  const c = spawn(game, 'old_hound', x0 + 3, z0 + 5);
  c.S.mode = 'passive';
  // A bone in hand: it comes up wagging, not away.
  p.give('bone', 3);
  p.selected = p.inv.findIndex((q) => q && q.item === 'bone');
  let jump = 0;
  let px = c.x;
  let pz = c.z;
  const watch = () => {
    jump = Math.max(jump, Math.abs(c.x - px) + Math.abs(c.z - pz));
    px = c.x;
    pz = c.z;
  };
  runFor(game, input, 4, watch);
  assert.ok(Math.max(Math.abs(c.x - p.x), Math.abs(c.z - p.z)) <= 2, 'it came to the bone in your hand');
  // Dropped: it goes to it and eats it.
  p.selected = 0;
  game.spawnDrop('bone', 1, Math.min(c.x + 5, x0 + 14), FY, z0 + 3, true);
  const drop = game.drops[game.drops.length - 1];
  runFor(game, input, 14, watch);
  assert.ok(drop.dead || drop.count < 1, 'the bone is eaten');
  assert.ok(jump <= 2, `it walked, a pace at a time (jumped ${jump})`);
});

// ------------------------------------------------------------ the world above
test('a time crystal never shuts you in the way in it rebuilds round you', () => {
  const game = makeGame(12345);
  const input = stubInput();
  for (let i = 0; i < 10; i++) game.update(0.1, input);
  const w = game.world;
  const walkOut = (x, y, z, rec) => {
    if (!w.canStand(x, y, z, true)) return false;
    const seen = new Set([`${x},${y},${z}`]);
    const q = [[x, y, z]];
    while (q.length && seen.size < 3000) {
      const [cx, cy, cz] = q.shift();
      if (Math.max(Math.abs(cx - rec.x), Math.abs(cz - rec.z)) > 10) return true;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const ny = w.stepTarget(cx, cy, cz, cx + dx, cz + dz, true);
        if (ny < 0 || seen.has(`${cx + dx},${ny},${cz + dz}`)) continue;
        seen.add(`${cx + dx},${ny},${cz + dz}`);
        q.push([cx + dx, ny, cz + dz]);
      }
    }
    return false;
  };
  let tried = 0;
  for (const type of ['barrow', 'mine', 'holdout']) {
    const rec = game.sim.dungeons.all.find((d) => d.type === type && d.x !== undefined);
    const site = rec && game.sim.dungeons.site(rec);
    if (!site) continue;
    for (let dz = -3; dz <= 3; dz++) {
      for (let dx = -3; dx <= 3; dx++) {
        rec.cleared = true;
        site.state = { ...(site.state || {}), cleared: true, beaten: true };
        game.loadAround(rec.x, rec.z, true);
        restamp(w, site);
        const x = rec.x + dx;
        const z = rec.z + dz;
        const y = w.findStandY(x, z, site.h + 1);
        if (!(y > 0) || !walkOut(x, y, z, rec)) continue;
        game.teleportPlayer(x, y, z);
        tried++;
        restoreDungeon(game, rec, 2);
        const p = game.player;
        assert.ok(walkOut(p.x, p.y, p.z, rec), `${type}: shut in at ${dx},${dz} once the way in stood back up`);
      }
    }
  }
  assert.ok(tried >= 20, `places tried (${tried})`);
});

// A town with a jail, about you.
function jailTown() {
  const game = makeGame(12345);
  const input = stubInput();
  game.minute = 720;
  for (let i = 0; i < 10; i++) game.update(0.1, input);
  for (const L of game.world.layouts.values()) {
    if (!L.jail || !L.econ) continue;
    const J = L.jail;
    game.teleportPlayer(J.front.x, J.y, J.front.z + 2);
    for (let i = 0; i < 60 && !L.npcs.some((r) => r.ent && !r.ent.dead && r.job !== 'guard'); i++) game.update(0.1, input);
    if (L.npcs.some((r) => r.ent && !r.ent.dead && r.job !== 'guard')) return { game, input, L, J };
  }
  return null;
}

test('a cell with someone in it is locked; a lockpick opens it, and they go', () => {
  const T = jailTown();
  assert.ok(T, 'a town with a jail');
  const { game, L, J } = T;
  const r = L.npcs.find((q) => q.ent && !q.ent.dead && q.job !== 'guard');
  const n = r.ent;
  r.life = r.life || {};
  r.life.jailUntil = game.sim.abs + 99999;
  n.teleport(J.stand.x, J.y, J.stand.z);
  n.state = 'jailed';
  game.world.setBlock(J.door.x, J.y, J.door.z, B.cell_door, 0);
  assert.equal(cellLocked(game, J.door.x, J.door.z), 'held');
  assert.ok(cellOccupants(game, J.door.x, J.door.z).includes(n));
  // No pick: locked, and it stays shut.
  const p = game.player;
  p.inv = p.inv.map((q) => (q && q.item === 'lockpick' ? null : q));
  assert.equal(useCellDoor(game, J.door.x, J.y, J.door.z, B.cell_door), true);
  assert.equal(game.world.getBlock(J.door.x, J.y, J.door.z), B.cell_door);
  assert.ok(game.ui.msgs.some((m) => /locked/.test(m)));
  // A pick: the lock window; picked, the door opens and they're off.
  p.give('lockpick', 2);
  let win = null;
  game.ui.open = (w) => {
    win = w;
  };
  assert.equal(useCellDoor(game, J.door.x, J.y, J.door.z, B.cell_door), true);
  assert.ok(win && win.spec && win.spec.onOpen, 'the lock window');
  win.spec.onOpen();
  assert.equal(game.world.getBlock(J.door.x, J.y, J.door.z), B.cell_door_open);
  assert.notEqual(n.state, 'jailed', 'out of the cell and away');
  assert.ok(CRIMES.freeing, 'freeing a prisoner is a crime');
  // An empty cell: no lock.
  assert.equal(cellLocked(game, J.door.x, J.door.z), null);
  assert.equal(useCellDoor(game, J.door.x, J.y, J.door.z, B.cell_door), false);
});

test('standing in a doorway at night isn\'t trespassing; inside the walls is', () => {
  const game = makeGame(12345);
  const input = stubInput();
  game.minute = 720;
  for (let i = 0; i < 20; i++) game.update(0.1, input);
  const s = game.currentSettlement || game.world.ow.settlementsNear(game.player.x, game.player.z)[0];
  const a = game.active.get(s.id);
  assert.ok(a, 'a town about');
  const b = a.layout.buildings.find((q) => q.residential && q.door && q.x1 - q.x0 >= 4 && q.z1 - q.z0 >= 4 && a.npcs.some((n) => n.rec.home === q.id));
  assert.ok(b, 'a house with someone home');
  const res = a.npcs.find((n) => n.rec.home === b.id);
  const J = game.sim.justice;
  game.minute = 23 * 60;
  game.currentSettlement = s;
  const inside = { x: Math.round((b.x0 + b.x1) / 2), z: Math.round((b.z0 + b.z1) / 2) };
  const keep = () => {
    res.teleport(inside.x, game.world.findStandY(inside.x, inside.z, res.y), inside.z);
    res.sleeping = false;
  };
  const p = game.player;
  p.teleport(b.door.x, game.world.findStandY(b.door.x, b.door.z, p.y), b.door.z);
  J.trespass = null;
  for (let i = 0; i < 12; i++) {
    keep();
    J.patrol();
  }
  assert.equal(J.trespass, null, 'the doorway is not the house');
  p.teleport(inside.x + (inside.x + 1 < b.x1 ? 1 : 0), game.world.findStandY(inside.x, inside.z, p.y), inside.z);
  keep();
  J.patrol();
  assert.ok(J.trespass && J.trespass.b === b.id, 'inside it is');
});

test('the coachman keeps his hours, and drives off in the one coach', () => {
  const game = makeGame(12345);
  const input = stubInput();
  game.minute = 720;
  for (let i = 0; i < 20; i++) game.update(0.1, input);
  let L = null;
  for (const a of game.active.values()) if (coachStand(a.layout) && coachLinks(game, a.layout.settlement).length) L = a.layout;
  assert.ok(L, 'a town with a coach');
  const sid = L.settlement.id;
  const cs = coachStand(L);
  game.teleportPlayer(cs.x + 2, game.world.findStandY(cs.x + 2, cs.z, 40), cs.z);
  game.standT = 0;
  game.update(0.1, input);
  const key = `coach:${sid}`;
  assert.equal(coachmanAt(game, sid), 'here');
  assert.ok(game.props.get(key)?.coachman, 'the coachman is up on the bench');
  game.minute = 23 * 60;
  assert.equal(coachmanAt(game, sid), 'night');
  game.standT = 0;
  game.update(0.1, input);
  game.riding.seatShown(game.props.get(key));
  assert.ok(game.props.has(key) && !game.props.get(key).bench, 'at night the coach stands empty');
  // By day, off you go: the coach at the stand is the one you're in.
  game.minute = 720;
  game.player.give('coin', 500);
  assert.ok(game.journey(coachLinks(game, L.settlement)[0]));
  assert.ok(coachAway(game, sid) !== null, 'away on the road');
  assert.equal(coachmanAt(game, sid), 'away');
  game.standT = 0;
  game.update(0.1, input);
  assert.ok(!game.props.has(key), 'no coach left standing behind it');
  const rides = [...game.props.values()].filter((q) => q.ride);
  assert.equal(rides.length, 1, 'one coach, carrying you');
  assert.ok(rides[0].driver, 'him driving');
});

test('the weather eases off before it turns into another kind', () => {
  const game = makeGame(12345);
  const input = stubInput();
  for (let i = 0; i < 5; i++) game.update(0.1, input);
  const w = game.weather || (game.weather = { kind: 'clear', level: 0, t: 0 });
  Object.assign(w, { kind: 'rain', level: 1, t: 0, severe: 'thunder', blowRaw: 1, blow: 1, next: null });
  game.modWeather = { kind: 'blizzard', until: game.day * 1440 + game.minute + 999 };
  const seen = [];
  for (let t = 0; t < 12; t += 0.1) {
    game.updateWeather(0.1, false);
    seen.push({ kind: game.weather.kind, level: game.weather.level, severe: game.weather.severe });
  }
  const flip = seen.findIndex((q) => q.kind === 'snow');
  assert.ok(flip > 0, 'it turned to snow');
  assert.ok(flip * 0.1 >= 2, `after a few seconds (${(flip * 0.1).toFixed(1)}s)`);
  assert.ok(seen[flip - 1].level <= 0.1, 'the rain had eased right off first');
  assert.ok(seen.slice(0, flip).every((q) => q.kind === 'rain'), 'rain the while');
  assert.equal(seen[seen.length - 1].severe, 'blizzard');
});

test('a skip of days goes in pieces, a frame at a time, and gets there', () => {
  const game = makeGame(12345);
  const input = stubInput();
  for (let i = 0; i < 10; i++) game.update(0.1, input);
  const d0 = game.day;
  assert.ok(game.skipDays(2));
  let worst = 0;
  let calls = 0;
  for (; game.skipping && calls < 20000; calls++) {
    const t0 = performance.now();
    game.update(0.1, input);
    worst = Math.max(worst, performance.now() - t0);
  }
  assert.ok(!game.skipping, 'done');
  assert.ok(game.day >= d0 + 2, 'two days on');
  assert.ok(worst < 3000, `no frame held up for long (${Math.round(worst)}ms)`);
});

test('nothing read back off a canvas to draw a half-eaten dish or a floor\'s edge', () => {
  const src = fs.readFileSync(new URL('../src/render/sprites.js', import.meta.url), 'utf8');
  const bitten = src.slice(src.indexOf('export function bittenIcon'), src.indexOf('export function itemIcon'));
  assert.ok(bitten.length > 100 && !/getImageData/.test(bitten), 'bitten icons cut out, not read back');
  const rsrc = fs.readFileSync(new URL('../src/render/renderer.js', import.meta.url), 'utf8');
  const fringe = rsrc.slice(rsrc.indexOf('  fringeOf('), rsrc.indexOf('  sideOf('));
  assert.ok(fringe.length > 100 && !/getImageData/.test(fringe), 'floor fringes drawn, not read back');
});

test('version 1.14.0, and the step to it', () => {
  assert.equal(GAME_VERSION, '1.14.0');
  assert.ok(compareVersions('1.13.0', GAME_VERSION) < 0);
  const steps = stepsFor('1.13.0');
  assert.equal(steps.length, 1);
  assert.equal(steps[0].to, '1.14.0');
  const log = [];
  steps[0].data({}, log);
  assert.ok(/barrow/i.test(log[0]) && /coach/i.test(log[0]));
});
