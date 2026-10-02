import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGame, stubInput } from './helpers.mjs';
import { Creature } from '../src/entities/creature.js';
import { ITEMS } from '../src/world/items.js';
import { B, BLOCKS } from '../src/world/blocks.js';
import { buildFloor, DTYPES, FY, SEALED } from '../src/world/dungeongen.js';
import { DungeonRun } from '../src/game/dungeon.js';
import { Region } from '../src/world/region.js';
import { BOSS_TITLES, addZone, kegBlast } from '../src/entities/monsters.js';
import { staminaBonus } from '../src/game/hero.js';
import { canBlock, usedByHand } from '../src/game/combat.js';
import { THEMES, musicMood } from '../src/game/music.js';
import { TECHS } from '../src/sim/tech.js';
import { DAY } from '../src/sim/econ.js';

function start(seed = 12345, minute = 10 * 60) {
  const game = makeGame(seed);
  const input = stubInput();
  game.minute = minute;
  for (let i = 0; i < 20; i++) game.update(0.1, input);
  return { game, input, p: game.player };
}
const run = (game, input, n, dt = 0.1) => {
  for (let i = 0; i < n; i++) game.update(dt, input);
};

// A floor's blocks, by local tile.
function blockAt(f, x, y, z) {
  const r = f.regions.get((Math.floor(x / 64) + 2000) * 4096 + Math.floor(z / 36));
  return r ? r.get(x % 64, y, z % 36) : 0;
}
function metaAt(f, x, y, z) {
  const r = f.regions.get((Math.floor(x / 64) + 2000) * 4096 + Math.floor(z / 36));
  return r ? r.meta[Region.idx(x % 64, y, z % 36)] : 0;
}
// Every room reachable from the way in (gates, seals and crumbling walls
// counting as ways through).
function unreached(f) {
  const P = f.plan;
  const pass = (x, z) => {
    if (!P.open[z * P.W + x]) return false;
    const bl = BLOCKS[blockAt(f, x, FY, z)];
    return !bl.solid || ['sealed', 'portcullis', 'boss_gate'].includes(bl.interact) || bl.name === 'weak_wall';
  };
  const seen = new Uint8Array(P.W * P.D);
  const st = [[f.entry.x - f.x0, f.entry.z]];
  seen[st[0][1] * P.W + st[0][0]] = 1;
  while (st.length) {
    const [x, z] = st.pop();
    for (const [a, c] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + a;
      const nz = z + c;
      const i = nz * P.W + nx;
      if (nx < 0 || nz < 0 || nx >= P.W || nz >= P.D || seen[i] || !pass(nx, nz)) continue;
      seen[i] = 1;
      st.push([nx, nz]);
    }
  }
  return f.rooms.filter((r) => {
    if (r.kit === 'hidden') return false;
    for (let z = r.z0; z <= r.z1; z++) for (let x = r.x0; x <= r.x1; x++) if (P.room[z * P.W + x] === r.id && seen[z * P.W + x]) return false;
    return true;
  });
}
const types = ['barrow', 'mine', 'crypt', 'holdout'];
const recOf = (type, seed, extra = {}) => ({ type, seed, depth: 3, level: 1, vaultFloor: 1, ...extra });

// ------------------------------------------------------------ the body
test('the more agile you are, the more breath you have', () => {
  const lo = staminaBonus({ stats: { agi: 3 }, traits: [] });
  const mid = staminaBonus({ stats: { agi: 5 }, traits: [] });
  const hi = staminaBonus({ stats: { agi: 8 }, traits: [] });
  assert.ok(lo < mid && mid < hi);
});

test('a shield on your arm doesn\'t stop you eating, drinking or using things', () => {
  const { game, p } = start();
  p.equip.shield = 'wooden_shield';
  p.inv[p.selected] = { item: 'bread', count: 2 };
  assert.ok(usedByHand(ITEMS.bread));
  assert.equal(canBlock(game, p), false);
  p.hp = p.maxHp - 3;
  game.eat();
  assert.ok(p.hp > p.maxHp - 3);
  p.inv[p.selected] = { item: 'iron_sword', count: 1 };
  assert.equal(canBlock(game, p), true);
});

test('hot dishes mend you slowly, and more in all than food that mends at once', () => {
  const { game, input, p } = start();
  assert.ok(ITEMS.stew.regen > 0 && ITEMS.stew.heal > ITEMS.cooked_meat.heal);
  p.maxHp = 40;
  p.hp = 10;
  p.inv[p.selected] = { item: 'stew', count: 1 };
  game.eat();
  const now = p.hp;
  assert.ok(p.slowHeal && p.slowHeal.left > 0);
  run(game, input, 120);
  assert.ok(p.hp > now, 'it keeps mending after');
});

test('a duel waits for the count before they come at you, unless you swing first', () => {
  const { game, input } = start();
  const { p } = { p: game.player };
  const npc = game.npcs.find((n) => !n.dead && !n.child && n.distTo(p) < 10) || game.npcs.find((n) => !n.dead);
  const spot = game.findFreeSpot(p.x + 2, p.z, p.y);
  npc.teleport(spot.x, spot.y, spot.z);
  game.startDuel(npc, 5);
  assert.equal(npc.duelReady, 3);
  run(game, input, 10);
  assert.ok(npc.duelReady > 0, 'still squaring up');
  game.duelBegins();
  assert.equal(npc.duelReady, 0);
  game.endDuel?.('draw');
});

test('a beast struck from afar runs from whoever struck it', () => {
  const { game, input, p } = start();
  const y = game.world.findStandY(p.x + 6, p.z, p.y);
  const deer = new Creature(game, 'deer', p.x + 6, y, p.z);
  game.addCreature(deer);
  game.damage(deer, 1, p);
  assert.ok(deer.fleeT > 0 && deer.fleeFrom === p);
  const d0 = Math.abs(deer.x - p.x) + Math.abs(deer.z - p.z);
  run(game, input, 30);
  assert.ok(deer.dead || Math.abs(deer.x - p.x) + Math.abs(deer.z - p.z) >= d0);
});

test('the tree\'s deep mines and catapults have their pictures', () => {
  assert.equal(TECHS.catapults.icon, 'catapult');
  assert.equal(TECHS.mining.icon, 'mine_cart');
});

// ------------------------------------------------------------ loot and coin
test('old coin is worth half a gold piece: two of them for one', () => {
  assert.equal(ITEMS.old_coin.value, 0.5);
  assert.equal(ITEMS.old_coin.exchange, 2);
  const { game } = start();
  const npc = game.npcs.find((n) => !n.dead && game.sim.shopOf(n));
  if (npc) assert.equal(game.sim.sellPrice(npc, 'old_coin'), 1);
});

test('the first floor\'s chests are poor; deeper down they\'re better, and few kinds of thing to a chest', () => {
  const tally = (n) => {
    let coins = 0;
    let value = 0;
    let chests = 0;
    let kinds = 0;
    for (let s = 1; s <= 12; s++) {
      for (const type of types) {
        const f = buildFloor(recOf(type, s * 97), n);
        for (const r of f.regions.values()) {
          for (const slots of r.containers.values()) {
            chests++;
            const ks = new Set();
            for (const q of slots) {
              if (!q) continue;
              ks.add(q.item);
              if (q.item === 'coin') coins += q.count;
              if (q.item === 'old_coin') coins += q.count / 2;
              value += (ITEMS[q.item]?.value || 0) * q.count;
            }
            kinds = Math.max(kinds, ks.size);
          }
        }
      }
    }
    return { coins: coins / chests, value: value / chests, kinds };
  };
  const top = tally(0);
  const deep = tally(2);
  assert.ok(top.value < deep.value, `deeper is richer (${top.value} vs ${deep.value})`);
  assert.ok(top.coins < 2.5, `little coin up top (${top.coins} a chest)`);
  assert.ok(top.kinds <= 7, `few kinds of thing to a chest (${top.kinds})`);
});

test('relics are rare in chests; a master always keeps one', () => {
  let relics = 0;
  for (let s = 1; s <= 20; s++) {
    for (const type of types) {
      for (let n = 0; n < 3; n++) {
        const f = buildFloor(recOf(type, s * 31), n);
        for (const r of f.regions.values()) for (const slots of r.containers.values()) for (const q of slots) if (q && q.item.startsWith('relic_')) relics++;
      }
    }
  }
  assert.ok(relics <= 12, `relics in chests: ${relics} over 240 floors`);
  const { game } = start();
  const rec = { ...game.sim.dungeons.all.find((d) => d.type === 'crypt'), floors: {}, cleared: false };
  new DungeonRun(game, rec).enter();
  while (game.dungeon.floor < rec.depth - 1) game.dungeon.changeFloor(1);
  const boss = game.creatures.find((c) => c.isBoss);
  game.kill(boss, game.player);
  for (const c of game.creatures.filter((q) => q.isBoss && !q.dead)) game.kill(c, game.player);
  assert.ok(rec.cleared);
  assert.ok(game.drops.some((d) => d.item.startsWith('relic_')), 'a relic dropped');
  game.dungeon.leave();
});

test('adventurers leave the old places alone at first, and rarely finish one off', () => {
  const { game } = start();
  const dn = game.sim.dungeons;
  for (const a of game.sim.adventurers.list) a.state = 'stay';
  for (let h = 0; h < 24 * 5; h++) {
    dn.lastHour = -1;
    game.minute = (h % 24) * 60;
    dn.delves();
  }
  assert.ok(!game.sim.adventurers.list.some((a) => a.state === 'delve'), 'nobody goes down in the first days');
  assert.ok(game.sim.abs < DAY * 12);
});

// ------------------------------------------------------------ the floors
test('rooms come in all shapes and sizes, and every one can be reached', () => {
  const shapes = new Set();
  const sizes = new Set();
  for (const type of types) {
    for (let s = 1; s <= 8; s++) {
      for (let n = 0; n < 3; n++) {
        const f = buildFloor(recOf(type, s * 131), n);
        for (const r of f.rooms) {
          shapes.add(r.shape);
          sizes.add((r.x1 - r.x0 + 1) * (r.z1 - r.z0 + 1));
        }
        assert.deepEqual(unreached(f).map((r) => r.kit), [], `${type} ${s} floor ${n}`);
      }
    }
  }
  for (const sh of ['rect', 'round', 'octagon', 'cross', 'ell', 'cave']) assert.ok(shapes.has(sh), sh);
  assert.ok(sizes.size > 30);
});

test('a sealed room has one way in, and one door across it, the right way round', () => {
  for (const type of [...types, 'kavorent']) {
    for (let s = 1; s <= 10; s++) {
      const rec = recOf(type, s * 53, type === 'kavorent' ? { depth: 6, level: 4, vaults: [1, 3, 5] } : {});
      for (let n = 0; n < rec.depth; n++) {
        const f = buildFloor(rec, n);
        const P = f.plan;
        for (const r of f.rooms.filter((q) => SEALED.has(q.kit) && q.door)) {
          let rim = 0;
          for (let z = r.z0 - 1; z <= r.z1 + 1; z++) {
            for (let x = r.x0 - 1; x <= r.x1 + 1; x++) {
              const i = z * P.W + x;
              if (P.room[i] === r.id || !P.open[i]) continue;
              if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, c]) => P.room[(z + c) * P.W + x + a] === r.id)) rim++;
            }
          }
          assert.equal(rim, 1, `${type} ${s}/${n} ${r.kit}: one doorway`);
          // (The door's sides are rock: it fills its passage.)
          const d = r.door;
          const side = d.ox ? [[0, 1], [0, -1]] : [[1, 0], [-1, 0]];
          for (const [a, c] of side) assert.ok(!P.open[(d.z + c) * P.W + d.x + a], 'rock either side of the door');
          if (r.kit === 'vault') {
            const id = blockAt(f, d.x, FY, d.z);
            assert.ok(id === B.sealed_door || id === B.kav_seal);
            if (id === B.sealed_door) assert.equal(metaAt(f, d.x, FY, d.z) & 3, d.oz ? 0 : 1);
          }
        }
      }
    }
  }
});

test('each kind of place is dressed its own way', () => {
  const want = { barrow: ['urn', 'roots'], mine: ['stalagmite', 'glowshroom'], crypt: ['candles', 'statue'], holdout: ['weapon_rack', 'war_banner'] };
  for (const type of types) {
    const found = new Set();
    for (let s = 1; s <= 4; s++) {
      const f = buildFloor(recOf(type, s * 17), 0);
      for (let z = 0; z < f.plan.D; z++) for (let x = 0; x < f.plan.W; x++) found.add(BLOCKS[blockAt(f, x, FY, z)].name);
    }
    for (const k of want[type]) assert.ok(found.has(k), `${type} has ${k}`);
    const T = DTYPES[type];
    assert.ok(T.dark && T.ambient.length && T.motes.length && T.bosses.length >= 3);
  }
});

test('below ground nobody climbs up onto the fittings or the walls', () => {
  const { game, p } = start();
  const rec = game.sim.dungeons.all.find((d) => d.type === 'crypt');
  new DungeonRun(game, rec).enter();
  const w = game.world;
  let wall = null;
  for (let dz = -8; dz <= 8 && !wall; dz++) for (let dx = -8; dx <= 8 && !wall; dx++) if (BLOCKS[w.getBlock(p.x + dx, FY, p.z + dz)].solid) wall = { x: p.x + dx, z: p.z + dz };
  assert.ok(wall);
  for (let y = FY + 1; y <= FY + 3; y++) assert.equal(w.canStand(wall.x, y, wall.z), false);
  game.dungeon.leave();
});

test('a floor that gives way drops you into a room, never onto a wall', () => {
  const { game } = start();
  const rec = game.sim.dungeons.all.find((d) => d.type === 'barrow');
  new DungeonRun(game, rec).enter();
  const d = game.dungeon;
  d.changeFloor(1);
  const P = d.data.plan;
  let rock = null;
  for (let z = 2; z < P.D - 2 && !rock; z++) for (let x = 2; x < P.W - 2 && !rock; x++) if (!P.open[z * P.W + x]) rock = { x: d.data.x0 + x, z };
  const at = d.landing(rock.x, rock.z);
  assert.ok(P.room[at.z * P.W + (at.x - d.data.x0)] >= 0);
  assert.equal(game.world.getBlock(at.x, FY, at.z), B.air);
  game.dungeon.leave();
});

// ------------------------------------------------------------ the masters
test('three masters to each kind of place, every one named and titled', () => {
  for (const type of types) {
    const seen = new Set();
    for (let s = 1; s <= 40; s++) {
      const f = buildFloor(recOf(type, s * 211), 2);
      for (const sp of f.spawns) if (sp.boss) seen.add(sp.species);
    }
    for (const b of DTYPES[type].bosses) {
      assert.ok(seen.has(b), `${type}: ${b} comes up`);
      assert.ok(BOSS_TITLES[b] && BOSS_TITLES[b].name && BOSS_TITLES[b].title);
    }
  }
});

test('the master waits behind its gate; in you go, the gate comes down, and it can\'t leave its hall', () => {
  const { game, input, p } = start();
  const rec = { ...game.sim.dungeons.all.find((d) => d.type === 'barrow'), floors: {}, cleared: false };
  new DungeonRun(game, rec).enter();
  while (game.dungeon.floor < rec.depth - 1) game.dungeon.changeFloor(1);
  const d = game.dungeon;
  const g = d.data.bossGate;
  const br = d.data.bossRoom;
  assert.ok(g && br);
  assert.equal(game.world.getBlock(g.x, FY, g.z), B.boss_gate);
  const boss = game.creatures.find((c) => c.isBoss);
  assert.ok(boss.waiting);
  game.cheats = { ...(game.cheats || {}), god: true };
  p.teleport(g.x + g.ox, FY, g.z + g.oz);
  d.interact(g.x, FY, g.z, BLOCKS[B.boss_gate]);
  assert.equal(game.world.getBlock(g.x, FY, g.z), B.boss_gate_open);
  p.teleport(g.x - g.ox * 2, FY, g.z - g.oz * 2);
  run(game, input, 3);
  assert.ok(d.fight, 'the fight begins');
  assert.equal(game.world.getBlock(g.x, FY, g.z), B.boss_gate, 'the gate crashes down');
  assert.equal(boss.waiting, false);
  assert.equal(musicMood(game), 'dungeon_barrow_boss');
  // Out the gate (heaved up), and well away: it stays in its hall.
  game.world.setBlock(g.x, FY, g.z, B.boss_gate_open, g.rot);
  p.teleport(g.x + g.ox * 3, FY, g.z + g.oz * 3);
  for (let i = 0; i < 60; i++) {
    run(game, input, 1);
    if (p.hp < p.maxHp / 2) p.hp = p.maxHp;
    for (const c of game.creatures.filter((q) => q.isBoss && !q.dead)) assert.ok(c.x >= br.x0 && c.x <= br.x1 && c.z >= br.z0 && c.z <= br.z1, `${c.species} stays in its hall`);
  }
  game.dungeon.leave();
});

test('the Twins share one bar, and both must fall', () => {
  const { game } = start();
  const base = game.sim.dungeons.all.find((d) => d.type === 'holdout');
  const rec = { ...base, floors: {}, cleared: false };
  for (let k = 0; k < 400; k++) {
    rec.seed = base.seed + k * 7;
    if (buildFloor(rec, rec.depth - 1).spawns.some((s) => s.species === 'twins')) break;
  }
  new DungeonRun(game, rec).enter();
  while (game.dungeon.floor < rec.depth - 1) game.dungeon.changeFloor(1);
  game.dungeon.bossFight();
  const f = game.dungeon.fight;
  assert.equal(f.boss.length, 2);
  assert.equal(f.name, 'Rook & Wren');
  const [a, b] = f.boss;
  game.kill(a, game.player);
  assert.equal(rec.cleared, false);
  assert.ok(b.raged);
  game.kill(b, game.player);
  assert.ok(rec.cleared);
  game.dungeon.leave();
});

test('ground that stays bad: poison pools hurt, snares hold you', () => {
  const { game, input, p } = start();
  game.cheats = { ...(game.cheats || {}) };
  p.maxHp = 40;
  p.hp = 40;
  addZone(game, { tiles: [{ x: p.x, z: p.z }], y: p.y, life: 3, kind: 'poison', tick: 0.5, dmg: 1 });
  run(game, input, 15);
  assert.ok(p.hp < 40);
  run(game, input, 20);
  assert.ok(p.hp < 40);
  assert.equal((game.zones || []).length, 0, 'gone when its time is up');
  addZone(game, { tiles: [{ x: p.x, z: p.z }], y: p.y, life: 10, kind: 'snare', once: true, root: 1.5, dmg: 2 });
  run(game, input, 1);
  assert.ok(p.grabbedT > 0);
});

test('a powder keg broken open goes up, and hurts whoever is near', () => {
  const { game, input, p } = start();
  p.maxHp = 40;
  p.hp = 40;
  kegBlast(game, p.x + 1, p.y, p.z, 0.3);
  run(game, input, 6);
  assert.ok(p.hp < 40);
});

test('every kind of place has its own music: exploring, fighting, and its master', () => {
  for (const type of [...types, 'kavorent']) {
    for (const v of ['', '_fight', '_boss']) assert.ok(THEMES[`dungeon_${type}${v}`], `${type}${v}`);
  }
});
