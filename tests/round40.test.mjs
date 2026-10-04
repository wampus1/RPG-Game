import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGame, stubInput } from './helpers.mjs';
import { DungeonRun } from '../src/game/dungeon.js';
import { FY } from '../src/world/dungeongen.js';
import { BLOCKS } from '../src/world/blocks.js';
import { padOf, inReach, MASTER_PAD } from '../src/entities/footprint.js';
import { launchOrb, swatOrbs, ORB_LIFE } from '../src/game/orbs.js';

function start(seed = 12345) {
  const game = makeGame(seed);
  const input = stubInput();
  game.minute = 10 * 60;
  for (let i = 0; i < 20; i++) game.update(0.1, input);
  return { game, input, p: game.player };
}
const run = (game, input, n, dt = 0.05) => {
  for (let i = 0; i < n; i++) game.update(dt, input);
};
const fresh = (game, type) => ({ ...game.sim.dungeons.all.find((d) => d.type === type), floors: {}, cleared: false, pack: null });

// Into the barrow's hall with the Mound Witch (or another master), the
// fight begun, you a few paces south of her.
function fight(game, p, species = 'mound_witch', type = 'barrow') {
  const rec = fresh(game, type);
  new DungeonRun(game, rec).enter();
  while (game.dungeon.floor < rec.depth - 1) game.dungeon.changeFloor(1);
  const d = game.dungeon;
  d.metBoss = true;
  const br = d.data.bossRoom;
  for (const c of game.creatures) {
    if (c.isBoss || c.leash) {
      c.dead = true;
      game.removeOcc(c);
    }
  }
  game.creatures = game.creatures.filter((c) => !c.dead);
  const cx = Math.round((br.x0 + br.x1) / 2);
  const cz = Math.round((br.z0 + br.z1) / 2);
  const c = d.spawn(species, cx, FY, cz, { boss: true });
  c.leash = br;
  for (const q of game.creatures) if (!q.isBoss) q.dormant = 999;
  const s = game.findFreeSpot(cx, cz + 4, FY);
  p.teleport(s.x, s.y, s.z);
  d.bossFight();
  game.scene = null;
  return { d, c, br };
}

// A clear straight line of floor between two spots (nothing solid at
// foot or head height).
function clear(game, y, x0, z0, x1, z1) {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(z1 - z0));
  for (let k = 0; k <= n; k++) {
    const x = Math.round(x0 + ((x1 - x0) * k) / (n || 1));
    const z = Math.round(z0 + ((z1 - z0) * k) / (n || 1));
    if (BLOCKS[game.world.getBlock(x, y, z)].solid || BLOCKS[game.world.getBlock(x, y + 1, z)].solid) return false;
  }
  return true;
}

test('the Mound Witch is a little broader to hit than other masters: a blow from two paces finds her', () => {
  const { game, p } = start();
  const { c } = fight(game, p);
  assert.ok(padOf(c) > MASTER_PAD, 'broader than the rest');
  const at = (dx, dz) => ({ x: c.x + dx, z: c.z + dz, y: c.y, foot: 0 });
  assert.ok(inReach(at(0, 2), c, 1), 'two paces straight off');
  assert.ok(inReach(at(1, 2), c, 1), 'two paces, a little to the side');
  assert.ok(!inReach(at(2, 2), c, 1), 'not two paces on the diagonal');
  assert.ok(!inReach(at(0, 3), c, 1), 'not three paces');
  game.dungeon.leave();
  // (Another master, no broader than ever.)
  const g2 = start();
  const other = fight(g2.game, g2.p, 'poisoner', 'holdout').c;
  assert.equal(padOf(other), MASTER_PAD);
  assert.ok(!inReach({ x: other.x, z: other.z + 2, y: other.y, foot: 0 }, other, 1), 'the poisoner: two paces is out of reach');
  g2.game.dungeon.leave();
});

test('the Mound Witch blinks away less often than she did, however close you keep to her', () => {
  const { game, input, p } = start();
  const { c } = fight(game, p);
  game.cheats = { ...(game.cheats || {}), god: true };
  // On her heels the whole while.
  const times = [];
  let last = { x: c.x, z: c.z };
  for (let i = 0; i < 600; i++) {
    p.hp = p.maxHp;
    c.hp = c.maxHp;
    if (i % 4 === 0 && !p.moving) {
      const s = game.findFreeSpot(c.x, c.z + 1, FY);
      if (s) p.teleport(s.x, s.y, s.z);
    }
    game.update(0.05, input);
    if (Math.abs(c.x - last.x) + Math.abs(c.z - last.z) >= 4) times.push(i * 0.05);
    last = { x: c.x, z: c.z };
  }
  assert.ok(times.length >= 2, 'she still blinks');
  const gaps = times.slice(1).map((t, k) => t - times[k]);
  // (Before: every three and a half seconds or so, kept on.)
  assert.ok(Math.min(...gaps) >= 5, `gaps: ${gaps.map((g) => g.toFixed(1)).join(', ')}`);
  game.dungeon.leave();
});

test('whole or worn, the Mound Witch lets go a witch-light at you; desperate, never', () => {
  const { game, input, p } = start();
  const { c } = fight(game, p);
  game.cheats = { ...(game.cheats || {}), god: true };
  let seen = null;
  for (let i = 0; i < 400 && !seen; i++) {
    p.hp = p.maxHp;
    game.update(0.05, input);
    seen = (game.orbs || []).find((o) => o.by === c) || null;
  }
  assert.ok(seen, 'one let go');
  assert.ok(Math.hypot(seen.vx, seen.vz) < 4, 'slow');
  assert.equal(seen.life, ORB_LIFE);
  game.dungeon.leave();
  // Desperate: none.
  const g2 = start();
  const w = fight(g2.game, g2.p).c;
  g2.game.cheats = { ...(g2.game.cheats || {}), god: true };
  w.hp = Math.round(w.maxHp * 0.2);
  let any = false;
  for (let i = 0; i < 400; i++) {
    g2.p.hp = g2.p.maxHp;
    // (Kept desperate: her tether would draw her back up.)
    w.hp = Math.round(w.maxHp * 0.2);
    g2.game.update(0.05, g2.input);
    if ((g2.game.orbs || []).some((o) => o.by === w)) any = true;
  }
  assert.ok(!any, 'no witch-lights, desperate');
  g2.game.dungeon.leave();
});

test('a witch-light glances off the walls, stays in her hall, and is gone after seven seconds', () => {
  const { game, input, p } = start();
  const { c, br } = fight(game, p);
  c.stunT = 99;
  // (You out of the hall, out of its way.)
  let away = null;
  for (let r = 3; r < 30 && !away; r++) {
    const s = game.findFreeSpot(br.x0 - r, br.z0 - r, FY);
    if (s && (s.x < br.x0 - 1 || s.z < br.z0 - 1)) away = s;
  }
  p.teleport(away.x, away.y, away.z);
  game.orbs = [];
  // Straight at the hall's west side.
  const o = launchOrb(game, c, { x: c.x - 10, z: c.z });
  const vx = o.vx;
  let gone = null;
  // (Turned back at some point: in a wide hall it may cross and glance
  // off the far wall too before it's done.)
  let turned = false;
  for (let t = 0; t < 9; t += 0.05) {
    game.update(0.05, input);
    if (!o.done && Math.sign(o.vx) !== Math.sign(vx)) turned = true;
    if (!o.done) {
      assert.ok(o.x >= br.x0 - 0.5 && o.x <= br.x1 + 0.5 && o.z >= br.z0 - 0.5 && o.z <= br.z1 + 0.5, 'in the hall');
      assert.ok(!BLOCKS[game.world.getBlock(Math.round(o.x), o.y, Math.round(o.z))].solid, 'never in a wall');
    }
    if (o.done && gone === null) gone = t + 0.05;
  }
  assert.ok(o.bounces >= 1, 'it glanced off a wall');
  assert.ok(turned, 'and came back the other way');
  assert.ok(gone !== null && Math.abs(gone - ORB_LIFE) < 0.15, `gone at ${gone}s`);
  assert.equal((game.orbs || []).length, 0);
  game.dungeon.leave();
});

// You a few paces south of her, a clear line between, nothing else about.
function lineUp(game, p, c) {
  c.stunT = 99;
  game.orbs = [];
  for (let k = 3; k <= 6; k++) {
    for (const [dx, dz] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
      const x = c.x + dx * k;
      const z = c.z + dz * k;
      if (game.world.findStandY(x, z, c.y) !== c.y || game.occupiedBySolid(x, c.y, z, p) || !clear(game, c.y, c.x, c.z, x, z)) continue;
      p.teleport(x, c.y, z);
      return { dx, dz };
    }
  }
  return null;
}

test('a witch-light that reaches you burns', () => {
  const { game, input, p } = start();
  const { c } = fight(game, p);
  assert.ok(lineUp(game, p, c));
  p.hp = p.maxHp;
  const o = launchOrb(game, c, p, { dmg: 4 });
  for (let i = 0; i < 80 && !o.done; i++) game.update(0.05, input);
  assert.ok(o.done && !o.back, 'it burst on you');
  assert.ok(p.hp < p.maxHp, 'and hurt');
  game.dungeon.leave();
});

test('a raised guard knocks a witch-light back at her, and it hurts her', () => {
  const { game, input, p } = start();
  const { c } = fight(game, p);
  const dir = lineUp(game, p, c);
  assert.ok(dir);
  p.inv[p.selected] = { item: 'iron_sword', count: 1 };
  p.stamina = 10;
  p.hp = p.maxHp;
  input.mouse.rdown = true;
  p.face(c.x, c.z);
  run(game, input, 4);
  assert.ok(p.blocking, 'guard up');
  const hp0 = p.hp;
  const chp = c.hp;
  const o = launchOrb(game, c, p, { dmg: 4 });
  for (let i = 0; i < 80 && !o.back && !o.done; i++) {
    p.face(c.x, c.z);
    game.update(0.05, input);
  }
  assert.ok(o.back, 'knocked back');
  assert.equal(p.hp, hp0, 'unhurt');
  input.mouse.rdown = false;
  for (let i = 0; i < 80 && !o.done; i++) game.update(0.05, input);
  assert.ok(c.hp < chp, 'it found her');
  game.dungeon.leave();
});

test('a blow swung through a witch-light knocks it back at her', () => {
  const { game, input, p } = start();
  const { c } = fight(game, p);
  const dir = lineUp(game, p, c);
  assert.ok(dir);
  p.inv[p.selected] = { item: 'iron_sword', count: 1 };
  run(game, input, 3);
  p.attackCd = 0;
  p.commitT = 0;
  p.swing = null;
  p.stamina = 10;
  // Hanging right in front of you, toward her.
  const o = launchOrb(game, c, p);
  o.t = 1;
  o.x = p.x - dir.dx;
  o.z = p.z - dir.dz;
  o.vx = 0;
  o.vz = 0;
  game.aimAngle = () => Math.atan2(-dir.dz, -dir.dx);
  const chp = c.hp;
  assert.ok(game.swingAt());
  for (let i = 0; i < 20 && !o.back; i++) game.update(0.05, input);
  assert.ok(o.back, 'knocked back by the blow');
  assert.ok(Math.sign(o.vx) === Math.sign(c.x - p.x) || Math.sign(o.vz) === Math.sign(c.z - p.z), 'toward her');
  for (let i = 0; i < 80 && !o.done; i++) game.update(0.05, input);
  assert.ok(c.hp < chp, 'and it hurt her');
  // (A blow swung the other way misses one behind you.)
  const o2 = launchOrb(game, c, p);
  o2.t = 1;
  o2.x = p.x + dir.dx * 1.4;
  o2.z = p.z + dir.dz * 1.4;
  o2.vx = 0;
  o2.vz = 0;
  assert.ok(!swatOrbs(game, p, -dir.dx, -dir.dz), 'not one behind you');
  game.dungeon.leave();
});
