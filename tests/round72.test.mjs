// Round 72: the ancient places' gates made over, grand (the Reach a rift
// torn in the ground, with no building at all), the camera drawn back as
// you come up to them; the evolved masters painted better; each leaving a
// thing of its own power, three or four five-star pieces, and an
// achievement; and more kinds of room in their places.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGame, stubInput } from './helpers.mjs';
import { DungeonRun } from '../src/game/dungeon.js';
import { FY } from '../src/world/dungeongen.js';
import { ANCIENT_DTYPES, ANCIENT_GATE, ANCIENT_BOSSES, riftShape, GATE_REACH } from '../src/world/ancient.js';
import { RNG } from '../src/util/rng.js';
import { B } from '../src/world/blocks.js';
import { ITEMS } from '../src/world/items.js';
import { parseStar } from '../src/world/quality.js';
import { EVOLVED_LOOT, EVOLVED_GEAR_KEYS, clawMult, clawSoak } from '../src/game/evolvedgear.js';
import { useGadget } from '../src/game/kavtech.js';
import { FEATS, FEAT } from '../src/game/achievements.js';
import { musicMood } from '../src/game/music.js';
import { dungeonIcon } from '../src/render/dungeonart.js';
import { STEPS } from '../src/game/migrate.js';
import { GAME_VERSION, compareVersions } from '../src/version.js';

const TYPES = ['athanor', 'champion', 'rift', 'gullet'];
const DOORS = { athanor: 'athanor_door', champion: 'champion_door', rift: 'rift_door', gullet: 'gullet_mouth' };
let shared = null;
function world() {
  if (!shared) {
    shared = makeGame(4242);
    const input = stubInput();
    shared.minute = 600;
    for (let i = 0; i < 3; i++) shared.update(0.1, input);
  }
  return shared;
}
// A gate's blocks, as siteBlocks lays them.
function gate(type, state = {}) {
  const out = [];
  const put = (dx, y, dz, id, meta = 0) => out.push([dx, y, dz, id, meta]);
  const clear = () => {};
  ANCIENT_GATE[type](put, clear, 10, new RNG(7), state, { seed: 77 });
  return out;
}
// Into an ancient place's master's hall, its waking skipped.
function fight(type) {
  const game = makeGame(4242);
  const input = stubInput();
  game.minute = 600;
  for (let i = 0; i < 3; i++) game.update(0.1, input);
  game.cheats = { ...(game.cheats || {}), god: true };
  const rec = { ...game.sim.dungeons.all.find((d) => d.type === type), floors: {}, cleared: false };
  new DungeonRun(game, rec).enter();
  while (game.dungeon.floor < rec.depth - 1) game.dungeon.changeFloor(1);
  const d = game.dungeon;
  const g = d.data.bossGate;
  const p = game.player;
  p.teleport(g.x - g.ox * 3, FY, g.z - g.oz * 3);
  d.bossFight();
  game.scene = null;
  const c = game.creatures.find((q) => q.isBoss && !q.dead);
  for (const q of game.creatures) if (q !== c && !q.isBoss) q.dormant = 99;
  return { game, input, d, p, c };
}

// ------------------------------------------------------------ the gates
test('each gate is grand: thirty paces and more across, its door in it; the Reach no building but a rift', () => {
  for (const type of TYPES) {
    const out = gate(type);
    const xs = out.map((q) => q[0]);
    const zs = out.map((q) => q[2]);
    assert.ok(Math.max(...xs) - Math.min(...xs) >= 28, `${type}: wide`);
    // (The Reach's rift runs west to east: long, not square.)
    assert.ok(Math.max(...zs) - Math.min(...zs) >= (type === 'rift' ? 14 : 24), `${type}: deep`);
    assert.ok(Math.max(...xs) <= GATE_REACH && Math.min(...xs) >= -GATE_REACH, `${type}: within its reach`);
    assert.ok(out.some((q) => q[3] === B[DOORS[type]]), `${type}: its door`);
    const tallest = Math.max(...out.filter((q) => q[3] !== B.air).map((q) => q[1]));
    // (The Reach is torn into the ground, the Gullet sunk into it; the
    // other two are built up high.)
    if (type === 'rift') assert.ok(tallest <= 12, 'the Reach: nothing built up');
    else if (type === 'gullet') assert.ok(tallest <= 14, 'the Gullet: a crater');
    else assert.ok(tallest >= 16, `${type}: built high (${tallest})`);
  }
  // The Reach: the ground sunk to the void's floor, scorched round it.
  const reach = gate('rift');
  assert.ok(reach.filter((q) => q[3] === B.abyss_floor).length > 40, 'the void\'s floor');
  assert.ok(reach.filter((q) => q[3] === B.scorched_earth).length > 60, 'sundered earth round it');
  assert.ok(reach.some((q) => q[0] === 0 && q[2] === 0 && q[1] === 8 && q[3] === B.rift_door), 'the way down at the bottom of the basin');
  // Beaten, the Athanor's braziers are out.
  const lit = gate('athanor').filter((q) => q[3] === B.brazier && q[4] !== 0).length;
  const out2 = gate('athanor', { cleared: true }).filter((q) => q[3] === B.brazier && q[4] !== 0).length;
  assert.ok(lit > 0 && out2 === 0, 'braziers out once beaten');
});

test('the rift\'s shape: a seam across the ground, a basin in the middle, cracks running out from it', () => {
  const S = riftShape(77);
  assert.ok(S.sunk.length > 40 && S.edge.length > 60);
  assert.equal(S.tiles.get('0,0').depth, 2, 'the basin');
  assert.ok(S.sunk.some((q) => q.dx <= -12) && S.sunk.some((q) => q.dx >= 12), 'thirty paces long');
  assert.ok(S.fissures.length >= 10 && S.fissures.every((f) => f.pts.length >= 2), 'its fissures');
  assert.ok(S.pts.length >= 8);
  assert.equal(riftShape(77), S, 'kept');
});

test('the camera draws back as you come up to an ancient place, and its music plays outside', () => {
  const game = world();
  const d = game.sim.dungeons.all.find((q) => q.type === 'athanor');
  game.loadAround(d.x, d.z, true);
  const p = game.player;
  p.teleport(d.x, game.world.findStandY(d.x, d.z + 6, d.h + 1), d.z + 6);
  const near = game.placeNearness(0.05);
  assert.ok(game.nearAncient && game.nearAncient.type === 'athanor', 'near it');
  assert.ok(near > 0.3, `drawn back (${near})`);
  assert.equal(musicMood(game), 'dungeon_athanor');
  game.loadAround(d.x, d.z + 60, true);
  p.teleport(d.x, Math.max(1, game.world.findStandY(d.x, d.z + 60, d.h + 1)), d.z + 60);
  assert.equal(game.placeNearness(0.05), 0, 'far off: as it was');
  assert.equal(game.nearAncient, null);
});

test('two new blocks for the Reach, after every other', () => {
  assert.ok(B.abyss_floor !== undefined && B.scorched_earth !== undefined);
  assert.equal(B.abyss_floor, B.gullet_mouth + 1);
  assert.equal(B.scorched_earth, B.abyss_floor + 1);
});

// ------------------------------------------------------------ what they leave
test('each evolved master leaves its own thing, and three or four five-star pieces; and its achievement', () => {
  for (const type of TYPES) {
    const { game, input, p, c } = fight(type);
    for (let i = 0; i < 10; i++) game.update(0.05, input);
    c.enraged = true;
    const before = game.drops.length;
    game.damage(c, c.hp + 10, p);
    assert.ok(c.dead, `${type}: dead`);
    const got = game.drops.slice(before).map((q) => q.item);
    const key = EVOLVED_LOOT[ANCIENT_BOSSES[type]];
    assert.ok(got.includes(key), `${type}: ${key} (${got.join(',')})`);
    const five = got.filter((k) => parseStar(k) && parseStar(k).stars === 5);
    // (Its own three or four; and every master's one or two pieces of the
    // place's best besides, which can be five-star too.)
    assert.ok(five.length >= 3 && five.length <= 6, `${type}: five-star pieces (${five.length})`);
    assert.ok(game.scene && game.scene.kind === 'boss_down' && game.scene.ghost === c);
    const feat = FEATS.find((f) => f.test(game) && ['transmuter', 'sunderer', 'oathkeeper', 'wormsbane'].includes(f.id));
    assert.ok(feat, `${type}: its achievement`);
  }
});

test('the four things: gadgets of their masters\' power, with icons and charges', () => {
  assert.deepEqual(EVOLVED_GEAR_KEYS, ['alchemist_hand', 'rift_needle', 'hero_gauntlet', 'worm_tooth']);
  for (const k of EVOLVED_GEAR_KEYS) {
    const it = ITEMS[k];
    assert.ok(it && it.kind === 'gadget' && it.evolved && it.charge > 0 && it.about.length > 60, k);
    assert.ok(dungeonIcon(k, it), `${k}: its icon`);
  }
  for (const id of ['transmuter', 'sunderer', 'oathkeeper', 'wormsbane']) assert.ok(FEAT[id] && FEAT[id].title);
  assert.ok(FEAT.transmuter.test({ scene: { kind: 'boss_down', ghost: { species: 'divine_alchemist' } } }));
  assert.ok(!FEAT.transmuter.test({ scene: { kind: 'boss_down', ghost: { species: 'rift_crawler' } } }));
});

test('used: a ring of the element round you; a mark, then a rift; the Hero\'s strength; down and up under them', () => {
  const game = world();
  const p = game.player;
  const input = stubInput();
  game.cheats = { ...(game.cheats || {}), god: true };
  // (On ground that's loaded: the test before left them far off.)
  game.loadAround(p.x, p.z, true);
  p.teleport(p.x, Math.max(1, game.world.findStandY(p.x, p.z, 8)), p.z);
  const msgs = [];
  game.ui.msg = (m) => msgs.push(m);
  const use = (k) => {
    p.inv[0] = { item: k, count: 1 };
    p.selected = 0;
    p.gadgetCd = {};
    return useGadget(game, ITEMS[k]);
  };
  // The Hand: whoever's in its ring, hurt; the element turning each use.
  const m = game.spawnMonster('skeleton', p.x + 2, p.y, p.z);
  const hp0 = m.hp;
  assert.ok(use('alchemist_hand'));
  assert.ok(m.hp < hp0, 'caught in it');
  assert.equal(p.handEl, 0);
  assert.ok(p.gadgetCd.alchemist_hand > 0, 'gathering itself');
  use('alchemist_hand');
  assert.equal(p.handEl, 1);
  assert.ok(m.slowT > 0, 'frost');
  // The Needle: a mark, then a rift from it to here (not straight through
  // it yourself).
  use('rift_needle');
  assert.ok(p.needleMark && p.needleMark.x === p.x, 'marked');
  assert.ok(!(p.gadgetCd.rift_needle > 0), 'a mark costs nothing');
  p.teleport(p.x + 5, p.y, p.z);
  use('rift_needle');
  assert.ok(!p.needleMark && game.rifts && game.rifts.length === 1, 'the rift');
  assert.ok(game.rifts[0].cd.has(p));
  for (let i = 0; i < 10; i++) game.update(0.05, input);
  assert.equal(p.x, game.rifts[0].b.x, 'still at this end');
  // The Gauntlet.
  assert.ok(use('hero_gauntlet'));
  assert.ok(p.clawT > 10);
  assert.equal(clawMult(p), 1.5);
  assert.equal(clawSoak(p, 10), 7);
  assert.equal(clawSoak({ kind: 'player', clawT: 0 }, 10), 10);
  // The Tooth: down into the ground, steered along under it, and up
  // again (Round 73: no longer a jump straight there; pointed whichever
  // way there's ground to come up through).
  const x0 = p.x;
  const z0 = p.z;
  for (const a of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
    game.aimAngle = () => a;
    use('worm_tooth');
    for (let i = 0; i < 60 && p.tunnel; i++) game.update(0.05, input);
    if (p.x !== x0 || p.z !== z0) break;
  }
  delete game.aimAngle;
  assert.ok(Math.abs(p.x - x0) + Math.abs(p.z - z0) >= 2, `moved (${msgs.slice(-1)[0]})`);
  assert.ok(game.zones.some((z) => z.by === p && z.kind === 'bile'), 'acid left behind');
});

// ------------------------------------------------------------ the places
test('more kinds of room in each ancient place, and more of its dressing', () => {
  const NEW = { athanor: ['observatory', 'salt_garden', 'furnace'], champion: ['tomb', 'arena', 'reliquary'], rift: ['shardstorm', 'flicker'], gullet: ['leech_pool', 'throat', 'nest'] };
  const LISTS = { athanor: ['orreries', 'gardens', 'furnaces'], champion: ['tombs', 'reliquaries', 'trials'], rift: ['storms', 'flickers'], gullet: ['leeches', 'throats', 'eggs'] };
  for (const type of TYPES) {
    const T = ANCIENT_DTYPES[type];
    for (const k of NEW[type]) assert.ok(T.kits.includes(k), `${type}: ${k}`);
    assert.ok(T.decor.length >= 5, `${type}: dressing`);
    const game = makeGame(777);
    const input = stubInput();
    game.minute = 600;
    for (let i = 0; i < 3; i++) game.update(0.1, input);
    const rec = { ...game.sim.dungeons.all.find((d) => d.type === type), floors: {}, cleared: false };
    new DungeonRun(game, rec).enter();
    const seen = new Set();
    for (let f = 0; f < rec.depth; f++) {
      if (f) game.dungeon.changeFloor(1);
      const A = game.dungeon.data.anc || {};
      for (const key of LISTS[type]) if ((A[key] || []).some((R) => (key === 'trials' ? R.arena : key === 'eggs' ? R.nest : true))) seen.add(key);
      for (const r of game.dungeon.data.rooms || []) if (NEW[type].includes(r.kit)) seen.add(r.kit);
    }
    assert.ok(seen.size >= 2, `${type}: its new rooms built (${[...seen].join(',')})`);
  }
});

test('an arena is a trial of one champion; a nest\'s eggs hatch in twos', () => {
  for (const type of ['champion', 'gullet']) {
    const game = makeGame(4242);
    const input = stubInput();
    game.minute = 600;
    for (let i = 0; i < 3; i++) game.update(0.1, input);
    game.cheats = { ...(game.cheats || {}), god: true };
    const rec = { ...game.sim.dungeons.all.find((d) => d.type === type), floors: {}, cleared: false };
    new DungeonRun(game, rec).enter();
    let found = null;
    for (let f = 0; f < rec.depth && !found; f++) {
      if (f) game.dungeon.changeFloor(1);
      const A = game.dungeon.data.anc || {};
      found = type === 'champion' ? (A.trials || []).find((T) => T.arena) : (A.eggs || []).find((G) => G.nest);
    }
    if (!found) continue;
    const p = game.player;
    const bx = found.box;
    let spot = null;
    for (let z = bx.z0 + 1; z <= bx.z1 - 1 && !spot; z++) for (let x = bx.x0 + 1; x <= bx.x1 - 1 && !spot; x++) if (game.world.canStand(x, FY, z) && !game.occupiedBySolid(x, FY, z, p)) spot = { x, z };
    if (!spot) continue;
    p.teleport(spot.x, FY, spot.z);
    const before = game.creatures.filter((c) => !c.dead).length;
    for (let t = 0; t < 4; t += 0.05) game.update(0.05, input);
    const now = game.creatures.filter((c) => !c.dead);
    if (type === 'champion') {
      const on = game.dungeon.trialOn;
      assert.ok(on && on.T === found, 'the trial begun');
      assert.ok(on.mobs.length <= 1 && on.mobs.every((c) => c.arena && c.maxHp >= 40), 'one champion, twice the fighter');
    } else {
      assert.ok(now.length > before, 'hatched');
      assert.ok(found.eggs.filter((e) => e.hatched).length >= 1);
    }
  }
});

test('0.72.0: a migration step for it, and the version', () => {
  assert.ok(compareVersions(GAME_VERSION, '0.72.0') >= 0);
  const s = STEPS.find((q) => q.to === '0.72.0');
  assert.ok(s && s.data && s.game);
  const log = [];
  s.data({}, log);
  assert.ok(log.some((l) => /rift torn across the ground/.test(l)));
  assert.ok(log.some((l) => /five-star/.test(l)));
  const game = world();
  const glog = [];
  s.game(game, glog);
  assert.ok(glog.some((l) => /ancient places' gates/.test(l)), glog.join(' / '));
});
