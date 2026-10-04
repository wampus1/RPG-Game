import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGame, stubInput } from './helpers.mjs';
import { B, BLOCKS } from '../src/world/blocks.js';
import { GROUND, REGION_W, REGION_D, INST_RX } from '../src/config.js';
import { ITEMS } from '../src/world/items.js';
import { MEAL_PRICE, mendEcon } from '../src/sim/econ.js';
import { townsfolk, promotionNeeds } from '../src/sim/growth.js';
import { speaks, parried, bossBlowScale, BOSS_MIN_WINDUP, beginAttack } from '../src/game/combat.js';
import { addHazard, tellScale } from '../src/entities/monsters.js';
import { Creature } from '../src/entities/creature.js';
import { buildFloor, FY, FAR_LOOT } from '../src/world/dungeongen.js';
import { DungeonRun } from '../src/game/dungeon.js';
import { RAFT } from '../src/entities/raft.js';
import { SPRINT_STEP } from '../src/entities/player.js';
import { STORM, stormAt } from '../src/world/geography.js';
import { STORM_STAGES, stormState } from '../src/game/stormsea.js';
import { musicMood, THEMES } from '../src/game/music.js';
import { respond } from '../src/game/dialogue.js';
import { teleportTo } from '../src/game/commands.js';

let shared = null;
const world = () => (shared ||= makeGame(12345));
const run = (game, input, secs, dt = 0.05) => {
  for (let t = 0; t < secs; t += dt) game.update(dt, input);
};

// ------------------------------------------------------------ towns
test('a treasury that went NaN is mended, and every dish on a menu has a price', () => {
  const L = { econ: { treasury: NaN, biz: { 3: { till: NaN, earned: Infinity, earnedY: 2, taxDue: NaN, store: [] } } }, npcs: [{ coins: NaN, taxDue: NaN }] };
  mendEcon(L);
  assert.equal(L.econ.treasury, 0);
  assert.equal(L.econ.biz[3].till, 0);
  assert.equal(L.econ.biz[3].earned, 0);
  assert.equal(L.npcs[0].coins, 0);
  // (The far islands' dishes too: those were what came to NaN.)
  for (const k of ['spiced_lentils', 'tamales', 'goulash', 'pepper_stew', 'mushroom_broth', 'crab_boil', 'chowder', 'pottage']) {
    assert.ok(Number.isFinite(MEAL_PRICE[k]), `${k} has a price`);
  }
});

test('a village counts only the people really living there toward becoming a town, and says what it lacks', () => {
  const game = world();
  const s = game.world.ow.settlements.find((q) => q && q.type === 'village');
  const L = game.sim.layoutOf(s.id) || game.world.getLayout(s);
  const before = townsfolk(L).length;
  // Somebody who moved away (their old record stays behind) isn't counted.
  const r = L.npcs.find((q) => townsfolk(L).includes(q));
  r.migrated = true;
  assert.equal(townsfolk(L).length, before - 1);
  r.migrated = false;
  const lack = promotionNeeds(game.sim, L);
  assert.ok(Array.isArray(lack));
  for (const t of lack) assert.equal(typeof t, 'string');
});

test('standing wagons and horses are put on the ground near their spot, never up on a roof', () => {
  const game = world();
  const w = game.world;
  const x = game.player.x + 6;
  const z = game.player.z + 6;
  game.loadAround(x, z, true);
  // A little hut over the spot: walls, a roof on top.
  const y0 = w.findStandY(x, z, GROUND);
  for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) for (let y = y0; y < y0 + 3; y++) w.setBlock(x + dx, y, z + dz, B.planks);
  const spot = game.groundNear({ x, z }, y0);
  assert.ok(spot, 'somewhere found');
  assert.ok(Math.abs(spot.y - y0) <= 2, `on the ground (y ${spot.y} vs ${y0})`);
  assert.ok(Math.max(Math.abs(spot.x - x), Math.abs(spot.z - z)) >= 2, 'beside the hut, not on it');
  for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) for (let y = y0; y < y0 + 3; y++) w.setBlock(x + dx, y, z + dz, B.air);
});

// ------------------------------------------------------------ fights
test('only those with words to say cry out when you parry them', () => {
  const game = world();
  const p = game.player;
  const wolf = new Creature(game, 'wolf', p.x + 1, p.y, p.z);
  const skel = new Creature(game, 'skeleton', p.x + 1, p.y, p.z);
  assert.equal(speaks(wolf), false, 'a wolf');
  assert.equal(speaks(skel), false, 'the dead');
  assert.equal(speaks({ kind: 'npc' }), true, 'a person');
  assert.equal(speaks({ kind: 'creature', S: { humanoid: true, bandit: true } }), true, 'a bandit');
  const said = [];
  wolf.say = (t) => said.push(t);
  parried(game, p, wolf);
  assert.deepEqual(said, [], 'the wolf says nothing');
  const man = { ...wolf, kind: 'npc', S: null, say: (t) => said.push(t), rng: null, face() {}, startMove() {} };
  try {
    parried(game, p, man);
  } catch {
    // (A stand-in, not a whole person: what matters is what was said.)
  }
  assert.ok(said.length >= 1, 'a person cries out');
});

test('a master\'s blow lands as hard as it was slow in coming, and always gives you time to react', () => {
  assert.ok(tellScale(0.3, 0.9) < 0.5, 'a snap does little');
  assert.ok(tellScale(1.3, 0.9) > 1.3, 'a great slow blow, a lot');
  const game = world();
  const p = game.player;
  const boss = { isBoss: true, x: p.x + 4, y: p.y, z: p.z };
  const quick = addHazard(game, { by: boss, tiles: [{ x: p.x, z: p.z }], dur: 0.3, dmg: 10 });
  const slow = addHazard(game, { by: boss, tiles: [{ x: p.x, z: p.z }], dur: 1.3, dmg: 10 });
  assert.ok(quick.dmg < 5 && quick.dur >= 0.45, `quick: ${quick.dmg} in ${quick.dur}s`);
  assert.ok(slow.dmg > 12, `slow: ${slow.dmg}`);
  // (A landing that ends something already shown coming keeps its bite.)
  const land = addHazard(game, { by: boss, tiles: [{ x: p.x, z: p.z }], dur: 0.05, dmg: 8 });
  assert.equal(land.dmg, 8);
  game.hazards = [];
  assert.ok(bossBlowScale({ dur: 0.3 }) < bossBlowScale({ dur: 1 }));
  assert.ok(bossBlowScale({ dur: 1, flurried: 2 }) < 0.5, 'a flurry\'s follow-ups are light');
  // A big master's swing is never quicker than this.
  const c = new Creature(game, 'wolf', p.x + 1, p.y, p.z);
  c.isBoss = true;
  c.foot = 1;
  c.tempo = 4;
  assert.ok(beginAttack(game, c, p));
  assert.ok(c.windup.dur >= BOSS_MIN_WINDUP + 0.15 - 1e-9, `windup ${c.windup.dur}`);
});

// ------------------------------------------------------------ old places
const getter = (f) => (x, y, z) => {
  const r = f.regions.get((INST_RX + Math.floor(x / REGION_W)) * 4096 + Math.floor(z / REGION_D));
  return r ? r.get(x % REGION_W, y, z % REGION_D) : B.bedrock;
};

test('lava down below lies sunk in the floor, and never cuts the way through', () => {
  let sunk = 0;
  for (const type of ['crypt', 'forge']) {
    for (let s = 1; s <= 8; s++) {
      for (let n = 0; n < 2; n++) {
        const f = buildFloor({ type, isle: 'kharos', seed: s * 131, depth: 3, level: 1, vaultFloor: 1 }, n);
        const get = getter(f);
        const pass = (x, z) => {
          const ft = get(x, FY, z);
          return !(BLOCKS[ft].solid && !BLOCKS[ft].interact) && ft !== B.lava && get(x, FY - 1, z) !== B.lava;
        };
        // From the way in, everywhere's reached without setting foot in it.
        const W = f.W;
        const sx = f.entry.x - f.x0;
        const seen = new Set([f.entry.z * W + sx]);
        const q = [[sx, f.entry.z]];
        while (q.length) {
          const [x, z] = q.pop();
          for (const [a, c] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nx = x + a;
            const nz = z + c;
            if (nx < 0 || nz < 0 || nx >= W || nz >= f.D || seen.has(nz * W + nx) || !pass(nx, nz)) continue;
            seen.add(nz * W + nx);
            q.push([nx, nz]);
          }
        }
        for (let z = 0; z < f.D; z++) {
          for (let x = 0; x < W; x++) {
            assert.notEqual(get(x, FY, z), B.lava, 'not standing up out of the floor');
            if (get(x, FY - 1, z) === B.lava) sunk++;
          }
        }
        if (f.down) assert.ok(seen.has(f.down.z * W + (f.down.x - f.x0)), `the stairs down reached (${type} ${s} ${n})`);
      }
    }
  }
  assert.ok(sunk > 20, 'there is lava, sunk');
});

test('no chest down below is ever bare, and the far islands\' are richer than Thessa\'s', () => {
  const value = (isle) => {
    let v = 0;
    let n = 0;
    for (let s = 1; s <= 10; s++) {
      const f = buildFloor({ type: 'barrow', isle, seed: s * 97, depth: 3, level: 1, vaultFloor: 1 }, 1);
      for (const r of f.regions.values()) {
        for (const slots of r.containers.values()) {
          n++;
          assert.ok(slots.some(Boolean), 'something in it');
          for (const q of slots) if (q) v += (ITEMS[q.item]?.value || 0) * q.count;
        }
      }
    }
    return v / n;
  };
  assert.ok(FAR_LOOT.kharos > 0 && FAR_LOOT.myrrow > 0);
  const th = value('thessa');
  assert.ok(value('kharos') > th, 'Kharos richer');
  assert.ok(value('myrrow') > th, 'Myrrow richer');
});

test('coral down below is walked through', () => {
  assert.equal(BLOCKS[B.coral].solid, false);
});

test('the stairs go on your map once you\'re in their room', () => {
  const game = makeGame(12345);
  const base = game.sim.dungeons.all.find((d) => d.type === 'crypt' && d.depth >= 2);
  new DungeonRun(game, { ...base, floors: {}, cleared: false }).enter();
  const d = game.dungeon;
  assert.deepEqual(d.knownStairs().filter((s) => s.down), [], 'not yet');
  const s = d.data.down;
  const spot = game.findFreeSpot(s.x + 1, s.z, FY);
  game.teleportPlayer(spot.x, spot.y, spot.z);
  d.markStairs();
  assert.ok(d.knownStairs().some((q) => q.down), 'marked');
});

// ------------------------------------------------------------ handing over
test('old plans and cores are only handed over once you say so', () => {
  const game = world();
  const s = game.world.ow.settlements.find((q) => q && q.type !== 'village' && game.sim.layoutOf(q.id));
  const L = game.sim.layoutOf(s.id) || game.world.getLayout(s);
  game.updateSettlements?.(true);
  const p = game.player;
  p.give('old_blueprint', 2);
  const mayor = { rec: L.npcs.find((r) => r.age === 'adult'), settlement: s, layout: L, x: p.x, y: p.y, z: p.z };
  mayor.rec.name ||= { first: 'A', last: 'B' };
  const count = () => p.inv.filter((q) => q && q.item === 'old_blueprint').reduce((n, q) => n + q.count, 0);
  const ask = respond(mayor, game, 'give_plans');
  assert.ok(ask.choices.some((c) => c.arg === 'yes'), 'asked first');
  assert.ok(ask.lines.some((t) => /HAND OVER/.test(t)));
  assert.equal(count(), 2, 'still yours');
  respond(mayor, game, 'give_plans', 'yes');
  assert.equal(count(), 0, 'handed over');
});

// ------------------------------------------------------------ moving
test('a raft goes a little quicker, a sprint a little slower', () => {
  assert.equal(RAFT.max, 5);
  assert.ok(SPRINT_STEP > 0.62 && SPRINT_STEP < 0.8);
});

test('a windmill\'s sails turn on its hub (drawn, not built of blocks)', () => {
  const game = makeGame(12345);
  const ow = game.world.ow;
  let found = null;
  for (const s of ow.settlements) {
    if (!s || !s.bounds) continue;
    const L = game.world.getLayout(s);
    const b = L && L.buildings.find((q) => q.type === 'windmill' && q.sails);
    if (b) {
      found = { s, b };
      break;
    }
  }
  assert.ok(found, 'a windmill somewhere');
  const sl = found.b.sails;
  teleportTo(game, sl.x, sl.z + (sl.along ? 4 : 0));
  run(game, stubInput(), 1.5, 0.1);
  assert.equal(game.world.getBlock(sl.x, sl.y, sl.z), B.mill_hub);
  for (let dy = -3; dy <= 3; dy++) for (let d = -3; d <= 3; d++) {
    const x = sl.along ? sl.x + d : sl.x;
    const z = sl.along ? sl.z : sl.z + d;
    assert.notEqual(game.world.getBlock(x, sl.y + dy, z), B.mill_sail);
  }
  assert.ok([...game.props.values()].some((q) => q.type === 'sails' && q.x === sl.x && q.z === sl.z), 'the sails, turning');
});

// ------------------------------------------------------------ the storm
test('into the storm on a raft: dark, black, red, the lightning finds the raft, and you wake on a beach without it', () => {
  const game = makeGame(12345);
  const input = stubInput();
  run(game, input, 0.5);
  const z = Math.round(STORM.cz * REGION_D);
  let x = Math.round((STORM.cx + STORM.rx * 0.6) * REGION_W);
  while (stormAt(x + 1, z) <= 0) x++;
  x -= 30;
  game.loadAround(x, z, true);
  const p = game.player;
  p.teleport(x, GROUND, z);
  p.raft = { x, z, ang: Math.PI / 2, v: 0 };
  const paddle = { ...input, isDown: (k) => k === 'KeyW' };
  const seen = { dark: 0, red: 0, mood: new Set() };
  let i = 0;
  const S = stormState(game);
  for (; i < 2400; i++) {
    game.update(0.05, paddle);
    seen.dark = Math.max(seen.dark, S.dark);
    seen.red = Math.max(seen.red, S.red);
    seen.mood.add(musicMood(game).split(':')[0] + (musicMood(game).split(':')[1] || ''));
    if (S.phase === null && !p.raft && game.ui.msgs.some((m) => m.includes('come to'))) break;
  }
  assert.ok(i < 2400, 'it ended');
  assert.equal(seen.dark, 1, 'pitch black');
  assert.ok(seen.red > 0.9, 'and red');
  assert.equal(p.raft, null, 'the raft is gone');
  assert.equal(p.inv.some((q) => q && q.item === 'raft'), false, 'not given back');
  assert.ok(game.world.ow.islandAt(p.x, p.z), 'ashore on an island');
  assert.ok(p.hp < p.maxHp && p.hp >= 1, 'battered, alive');
  assert.ok(seen.mood.has('tempestp1') || seen.mood.has('tempestp2'), 'the storm\'s music');
  assert.ok(seen.mood.has('tempestp3'), 'its worst');
  assert.ok(STORM_STAGES.dark < STORM_STAGES.red && STORM_STAGES.red < STORM_STAGES.strike);
});

test('out on a raft, a sea-song; and the rain at the storm\'s edge doesn\'t stop and start over and over', () => {
  assert.ok(THEMES.sailing && THEMES.tempest);
  const game = makeGame(12345);
  const input = stubInput();
  run(game, input, 0.5);
  const p = game.player;
  // Somewhere just at the edge of the storm's rain.
  const z = Math.round(STORM.cz * REGION_D);
  let x = Math.round((STORM.cx + STORM.rx * 0.6) * REGION_W);
  const near = (q) => game.world.ow.stormNear(q, z);
  while (near(x) < 0.1) x++;
  game.loadAround(x, z, true);
  p.teleport(x, GROUND, z);
  p.raft = { x, z, ang: 0, v: 0 };
  game.minute = 12 * 60;
  run(game, input, 1);
  assert.equal(musicMood(game).split(':')[0], 'sailing', 'a sea-song');
  const before = game.ui.msgs.filter((m) => /rain stops/.test(m)).length;
  // To and fro across where the rain begins, for a while.
  for (let k = 0; k < 30; k++) {
    const xx = k % 2 ? x + 3 : x - 3;
    p.raft.x = xx;
    p.teleport(xx, GROUND, z);
    run(game, input, 2.1, 0.1);
  }
  const after = game.ui.msgs.filter((m) => /rain stops/.test(m)).length;
  assert.ok(after - before <= 1, `the rain stopped ${after - before} times`);
});
