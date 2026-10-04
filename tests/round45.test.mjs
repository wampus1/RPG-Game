import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGame, stubInput } from './helpers.mjs';
import { ITEMS, socketed } from '../src/world/items.js';
import { buildFloor, gearFor } from '../src/world/dungeongen.js';
import { RNG } from '../src/util/rng.js';
import { MODS, STAR_MAX, starKey, parseStar, plainKey, starGear, rollStars, rollMods, starable, gearClass } from '../src/world/quality.js';
import { modsOf, onBladeMods, onBlockMods, toolDrops, stepModMult, gearHp, critBonus, bladeMult } from '../src/game/mods.js';
import { B } from '../src/world/blocks.js';
import { Creature } from '../src/entities/creature.js';

function start(seed = 12345, minute = 10 * 60) {
  const game = makeGame(seed);
  const input = stubInput();
  game.minute = minute;
  for (let i = 0; i < 20; i++) game.update(0.1, input);
  return { game, input, p: game.player };
}

// Something in your hand, in the first slot of your belt.
function hold(p, key) {
  p.inv[0] = { item: key, count: 1 };
  p.selected = 0;
}

// A dummy to try things on, a pace in front of you.
function dummy(game, p, hp = 200) {
  const c = new Creature(game, 'wolf', p.x + 1, p.y, p.z);
  game.addCreature(c);
  c.hp = c.maxHp = hp;
  return c;
}

test('eight modifiers for each kind of gear', () => {
  for (const cls of ['blade', 'bow', 'shield', 'armor', 'tool']) assert.equal(Object.keys(MODS[cls]).length, 8, cls);
  assert.equal(gearClass(ITEMS.iron_sword), 'blade');
  assert.equal(gearClass(ITEMS.longbow), 'bow');
  assert.equal(gearClass(ITEMS.iron_shield), 'shield');
  assert.equal(gearClass(ITEMS.chainmail), 'armor');
  assert.equal(gearClass(ITEMS.iron_pickaxe || ITEMS.stone_pickaxe), 'tool');
  assert.equal(gearClass(ITEMS.bread), null);
});

test('a starred piece is its plain one made better, its stars and modifiers in its key', () => {
  const k = starKey('iron_sword', 4, 'd', 600, ['venom', 'keen']);
  const it = ITEMS[k];
  assert.ok(it, k);
  assert.equal(it.stars, 4);
  assert.equal(it.origin, 'd');
  assert.deepEqual(it.mods, ['venom', 'keen']);
  assert.equal(it.plain, 'iron_sword');
  assert.equal(plainKey(k), 'iron_sword');
  assert.equal(it.name, `Venomous ${ITEMS.iron_sword.name}`);
  assert.ok(it.damage > ITEMS.iron_sword.damage, `${it.damage} vs ${ITEMS.iron_sword.damage}`);
  assert.ok(it.value > ITEMS.iron_sword.value);
  assert.ok(!it.stack || it.stack === 1, 'one to a slot');
  // More stars, better (whatever the roll).
  const one = ITEMS[starKey('iron_sword', 1, 'c', 1295)];
  const five = ITEMS[starKey('iron_sword', 5, 'c', 0)];
  assert.ok(five.damage > one.damage);
  // The same stars, a little more or less by the roll.
  assert.notEqual(ITEMS[starKey('iron_sword', 3, 'c', 0)].damage, ITEMS[starKey('iron_sword', 3, 'c', 1295)].damage);
  // Armour keeps more off; a shield takes more of a blow.
  assert.ok(ITEMS[starKey('chainmail', 3, 'c', 600)].armor > ITEMS.chainmail.armor);
  assert.ok(ITEMS[starKey('iron_shield', 3, 'c', 600)].block > ITEMS.iron_shield.block);
  // Nothing new among the items you'd list (a starred piece is made up when asked for).
  assert.ok(!Object.keys(ITEMS).some((q) => q.includes('~')));
  // A key that isn't a good one is no item at all.
  assert.equal(ITEMS['iron_sword~9zz'], undefined);
  assert.equal(ITEMS[starKey('iron_sword', 3, 'c', 0, ['smelting'])], undefined, 'not a blade modifier');
  assert.deepEqual(parseStar(k), { plain: 'iron_sword', stars: 4, origin: 'd', roll: 600, mods: ['venom', 'keen'] });
  // A stone set in it keeps its stars.
  const set = socketed(k, 'ruby');
  assert.ok(ITEMS[set], set);
  assert.equal(ITEMS[set].stars, 4);
  assert.ok(ITEMS[set].socket);
  // Only plain gear takes stars.
  assert.ok(starable('iron_sword'));
  assert.ok(!starable(k));
  assert.ok(!starable('bread'));
  assert.equal(starGear('bread'), 'bread');
});

test('stars: made at a bench mostly one or two; found below, more the deeper, more again off a master', () => {
  const rng = new RNG(45);
  const avg = (o) => {
    let n = 0;
    for (let i = 0; i < 400; i++) n += rollStars(rng, o);
    return n / 400;
  };
  const made = avg({ origin: 'c' });
  assert.ok(made < 2.3, `made ${made}`);
  assert.ok(avg({ origin: 'c', tinker: true }) > made);
  assert.ok(avg({ origin: 'd', tier: 3 }) > avg({ origin: 'd', tier: 0 }) + 1);
  assert.ok(avg({ origin: 'd', tier: 1, boss: true }) > avg({ origin: 'd', tier: 1 }) + 0.6);
  for (let i = 0; i < 300; i++) {
    const s = rollStars(rng, { origin: 'd', tier: 6, boss: true });
    assert.ok(s >= 1 && s <= STAR_MAX);
  }
  // More modifiers with more stars; a tool's own only on that kind of tool.
  let few = 0;
  let many = 0;
  for (let i = 0; i < 300; i++) {
    few += rollMods('blade', 1, rng).length;
    many += rollMods('blade', 5, rng).length;
    assert.ok(!rollMods('tool', 5, rng, ITEMS.iron_axe || { tool: 'axe' }).includes('smelting'));
  }
  assert.ok(many > few * 3, `${many} vs ${few}`);
});

test('gear found below is starred and marked as from the deep, chests and masters alike', () => {
  let found = 0;
  for (let seed = 1; seed < 25; seed++) {
    for (const type of ['crypt', 'mine', 'kavorent']) {
      const rec = { type, seed: seed * 977, depth: type === 'kavorent' ? 4 : 3, level: 2, isle: 'thessa', name: 'x' };
      for (let n = 0; n < rec.depth; n++) {
        const out = buildFloor(rec, n);
        for (const r of out.regions.values()) {
          for (const slots of r.containers.values()) {
            for (const s of slots) {
              if (!s || !gearClass(ITEMS[s.item])) continue;
              assert.ok(ITEMS[s.item].stars, `${s.item} unstarred`);
              assert.equal(ITEMS[s.item].origin, 'd');
              found++;
            }
          }
        }
      }
    }
  }
  assert.ok(found > 20, `${found}`);
  // The same floor, the same things (stars and all).
  const rec = { type: 'crypt', seed: 4242, depth: 3, level: 1, isle: 'thessa', name: 'x' };
  const items = (o) => [...o.regions.values()].flatMap((r) => [...r.containers.values()].flat()).filter(Boolean).map((s) => s.item).join();
  assert.equal(items(buildFloor(rec, 2)), items(buildFloor(rec, 2)));
  const rng = { chance: (p) => Math.random() < p, int: (a, b) => a + Math.floor(Math.random() * (b - a + 1)), float: (a, b) => a + Math.random() * (b - a), pick: (a) => a[Math.floor(Math.random() * a.length)] };
  for (let i = 0; i < 30; i++) {
    const k = gearFor('barrow', 2, rng, null, true);
    assert.ok(ITEMS[k].stars >= 2, k);
    assert.equal(ITEMS[k].origin, 'd');
  }
});

test('things made at a bench come out starred', () => {
  const { game, p } = start();
  const r = { out: 'iron_sword' };
  const made = new Set();
  for (let i = 0; i < 40; i++) made.add(starGear(r.out, { origin: 'c' }));
  for (const k of made) {
    assert.equal(ITEMS[k].origin, 'c');
    assert.equal(ITEMS[k].plain, 'iron_sword');
  }
  assert.ok(made.size > 10, 'each one its own');
  assert.ok(game && p);
});

test('a blade\'s modifiers: venom poisons, frost chills, keen strikes true, merciless finishes', () => {
  const { game, p } = start();
  const t = dummy(game, p);
  assert.ok(t, 'a creature to try it on');
  hold(p, starKey('iron_sword', 3, 'c', 600, ['venom', 'frost', 'keen']));
  assert.deepEqual(modsOf(p).blade, ['venom', 'frost', 'keen']);
  onBladeMods(game, p, t);
  assert.ok(t.poisonT > 0, 'poisoned');
  assert.ok(t.slowT > 0, 'chilled');
  assert.ok(critBonus(p) > 0);
  hold(p, starKey('iron_sword', 3, 'c', 600, ['merciless']));
  t.hp = 10;
  assert.equal(bladeMult(p, t), 1.5);
  t.hp = 200;
  assert.equal(bladeMult(p, t), 1);
  // A plain one does none of it.
  hold(p, 'iron_sword');
  assert.equal(critBonus(p), 0);
});

test('a thorned shield gives back what it turns; fleet and hale armour', () => {
  const { game, p } = start();
  const t = dummy(game, p);
  p.equip.shield = starKey('iron_shield', 3, 'c', 600, ['thorns']);
  const hp = t.hp;
  onBlockMods(game, p, t, false, 6);
  assert.ok(t.hp < hp, 'struck back');
  // Fleet: quicker steps; hale: more health.
  p.equip.body = starKey('chainmail', 3, 'c', 600, ['fleet', 'hale']);
  p.equip.feet = starKey('iron_boots', 3, 'c', 600, ['fleet']);
  assert.ok(stepModMult(p) < 1);
  assert.equal(gearHp(p), 2);
  const before = p.maxHp;
  p.update(0.05, stubInput(), game);
  assert.ok(p.maxHp >= before);
});

test('a smelting pick brings ore up as metal; a sawing axe fells planks', () => {
  const { game, p } = start();
  const pick = Object.keys(ITEMS).find((k) => ITEMS[k].tool === 'pick' && starable(k));
  hold(p, starKey(pick, 3, 'c', 600, ['smelting']));
  const drops = [{ item: 'iron_ore', count: 1 }];
  toolDrops(game, p, B.iron_ore, drops);
  assert.equal(drops[0].item, 'iron_ingot');
  const axe = Object.keys(ITEMS).find((k) => ITEMS[k].tool === 'axe' && starable(k));
  const log = Object.keys(B).find((k) => /^log/.test(k));
  if (axe && log) {
    hold(p, starKey(axe, 3, 'c', 600, ['sawing']));
    const d = [{ item: ITEMS[log] ? log : 'log_oak', count: 1 }];
    toolDrops(game, p, B[log], d);
    assert.ok(/planks/.test(d[0].item), d[0].item);
  }
});
