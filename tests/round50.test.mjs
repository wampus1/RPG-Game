// Round 50: a blue, draconic wing (drawn in its place among everything
// else, and a burst of light and wind when it rolls you); openings painted
// properly, their people with their arms at their sides; masters that use
// everything they have; food that mends over time; cooking anything at a
// fire, a pot, an oven or a table, by you and the town's cooks; the watch
// patching itself up and fighting as a body; a save's details before it's
// loaded, deleted or updated; and older worlds brought up to this version.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGame, stubInput } from './helpers.mjs';
import { ITEMS, healSplit } from '../src/world/items.js';
import { TYPES, CONDS, ingredientTypes, cookDish, parseDish, dishName, dishForm, dishLines, COOK_STATIONS } from '../src/world/dishes.js';
import { DISH_MAX, dishFx, recipeOf, canMake, stockPantry, npcCook, PANTRY } from '../src/game/cooking.js';
import { WING_SIZE, wingPixels } from '../src/render/wing.js';
import { drawPerson } from '../src/render/scenekit.js';
import { press } from '../src/entities/tempo.js';
import { guardPlan } from '../src/entities/tactics.js';
import { guardSupplies } from '../src/sim/econ.js';
import { Creature } from '../src/entities/creature.js';
import { STEPS, stepsFor, migrateSave } from '../src/game/migrate.js';
import { GAME_VERSION } from '../src/version.js';
import { SaveStore } from '../src/game/saves.js';
import { SaveSlotsWindow, SaveDetailsWindow } from '../src/ui/windows.js';
import { B } from '../src/world/blocks.js';
import { Game } from '../src/game/game.js';

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
const memStore = () => {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
};
// A rough random, the same every time.
const seeded = (s) => () => {
  s = (s * 1103515245 + 12345) & 0x7fffffff;
  return s / 0x7fffffff;
};

// ------------------------------------------------------------ the wing
test('the fallen star\'s wing: a little smaller, blue, and the light shows through it', () => {
  assert.ok(WING_SIZE <= 14, `${WING_SIZE}`);
  const px = wingPixels(0, false, false);
  let solid = 0;
  let blue = 0;
  let through = 0;
  for (let i = 0; i < px.length; i += 4) {
    const a = px[i + 3];
    if (!a) continue;
    solid++;
    if (px[i + 2] > px[i] && px[i + 2] >= px[i + 1]) blue++;
    if (a < 255) through++;
  }
  assert.ok(solid > 40, 'something to it');
  assert.ok(blue / solid > 0.8, `blue (${blue}/${solid})`);
  assert.ok(through / solid > 0.3, `its skin thin enough to see through (${through}/${solid})`);
});

// ------------------------------------------------------------ the openings
test('people in the openings: arms joined at the shoulder, no hand off on its own', () => {
  for (const size of ['tiny', 'small', 'normal']) {
    for (const pose of ['stand', 'walk', 'point', 'wave', 'run', 'cower', 'down']) {
      for (const face of ['front', 'back']) {
        for (const frame of [0, 1]) {
          const at = new Map();
          drawPerson((x, y, c) => c && at.set(`${x},${y}`, [x, y]), 50, 50, { size, pose, face, frame, dir: 1, turn: 1, t: 0.3 });
          // All of them, one piece (corner to corner counts).
          const all = [...at.values()];
          const seen = new Set([`${all[0][0]},${all[0][1]}`]);
          const todo = [all[0]];
          while (todo.length) {
            const [x, y] = todo.pop();
            for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
              const k = `${x + dx},${y + dy}`;
              if (at.has(k) && !seen.has(k)) {
                seen.add(k);
                todo.push(at.get(k));
              }
            }
          }
          assert.equal(seen.size, at.size, `${size} ${pose} ${face} ${frame}: ${at.size - seen.size} pixels apart from the rest`);
          // And no wider than a person (arms at their sides).
          const xs = all.map((q) => q[0]);
          const w = Math.max(...xs) - Math.min(...xs) + 1;
          assert.ok(w <= (pose === 'down' ? 9 : 6), `${size} ${pose}: ${w} wide`);
        }
      }
    }
  }
});

// ------------------------------------------------------------ food
test('food heals a little at once (three at most), the rest over time', () => {
  assert.deepEqual([healSplit(2).now, healSplit(2).regen], [2, 0]);
  assert.equal(healSplit(5).now, 2);
  assert.equal(healSplit(12).now, 3);
  assert.equal(healSplit(12).now + healSplit(12).regen, 12, 'nothing lost');
  for (const [k, d] of Object.entries(ITEMS)) {
    if (d.kind !== 'food' || !d.heal) continue;
    assert.ok((d.now ?? d.heal) <= 3, `${k}: ${d.now ?? d.heal} at once`);
  }
  const { game, input, p } = start();
  const big = Object.keys(ITEMS).find((k) => ITEMS[k].kind === 'food' && ITEMS[k].heal >= 8 && !k.includes('~'));
  p.hp = 2;
  p.inv[p.selected] = { item: big, count: 1 };
  game.eat();
  assert.ok(p.hp <= 5, `${big}: ${p.hp} at once`);
  const now = p.hp;
  run(game, input, 400, 0.05);
  assert.ok(p.hp > now + 2, `and more after (${now} -> ${p.hp})`);
});

// ------------------------------------------------------------ cooking
test('everything is one or two kinds of thing to a cook, each kind with two good effects and a bad', () => {
  for (const k of Object.keys(ITEMS)) {
    const t = ingredientTypes(k);
    assert.ok(t.length >= 1 && t.length <= 2, `${k}: ${t}`);
    for (const q of t) assert.ok(TYPES[q], `${k}: ${q}`);
  }
  assert.ok(Object.keys(TYPES).length >= 14);
  for (const [k, T] of Object.entries(TYPES)) {
    assert.equal(T.good.length, 2, k);
    assert.ok(T.bad, k);
    assert.ok(CONDS[T.cond], `${k}: a condition it can set`);
  }
});

test('the sandy bread and iron stew: what it\'s called, what it does, and only in metal armour', () => {
  // As in the example: sand (crumbly), bread (squishy, dry) and an iron
  // ingot (metallic, hard) in a pot; metallic the condition, dry and
  // crumbly each giving one of their good effects; five hours.
  const key = 'dish~p~sand,bread,iron_ingot~dry.0,crumbly.0~metallic~300~6';
  const def = ITEMS[key];
  assert.ok(def, 'made of its key');
  assert.equal(def.name, 'Sandy Bread and Iron Stew');
  assert.equal(def.kind, 'food');
  assert.deepEqual(def.dish.effects.map((e) => e.k).sort(), ['heatproof', 'mine']);
  const lines = dishLines(def).map((l) => l.text);
  assert.ok(lines.some((l) => /metal armour/.test(l)), lines.join(' / '));
  assert.ok(lines.some((l) => /5 hours/.test(l)), lines.join(' / '));
  const { game, p } = start();
  p.inv[p.selected] = { item: key, count: 1 };
  game.eat();
  assert.ok(p.buffs.some((b) => b.dish === key), 'its effects on you');
  game.frameNo++;
  assert.equal(dishFx(p, 'mine'), 0, 'not without metal on');
  p.equip.head = 'iron_helmet';
  game.frameNo++;
  assert.ok(dishFx(p, 'mine') > 0 && dishFx(p, 'heatproof') > 0, 'in an iron helmet: both');
});

test('cooking anything: named for what went in and where, cooked well it does good', () => {
  for (const st of Object.keys(COOK_STATIONS)) {
    const key = cookDish(['apple', 'raw_meat', 'carrot'], st, 1, seeded(3));
    const d = parseDish(key);
    assert.ok(d && ITEMS[key], key);
    assert.deepEqual(d.ings, ['apple', 'raw_meat', 'carrot']);
    assert.ok(d.fx.length + (d.cond ? 1 : 0) <= 3, 'three of its kinds at most');
    assert.equal(ITEMS[key].name, dishName(st, d.ings));
  }
  // You can't make a pie at a campfire.
  for (const ings of [['apple'], ['bread', 'berries'], ['raw_meat', 'carrot', 'mushroom']]) assert.ok(!/Pie|Tart|Loaf/.test(dishForm('c', ings)), dishForm('c', ings));
  assert.ok(/Pie|Tart|Loaf/.test(dishForm('o', ['apple', 'bread'])));
  assert.ok(/Stew|Soup/.test(dishForm('p', ['raw_meat', 'carrot'])));
  // One thing: no condition. Two or three: now and then one.
  const r = seeded(9);
  let conds = 0;
  for (let i = 0; i < 200; i++) {
    assert.equal(parseDish(cookDish(['apple'], 'c', 0.5, r)).cond, null);
    if (parseDish(cookDish(['sand', 'bread', 'iron_ingot'], 'p', 0.5, r)).cond) conds++;
  }
  assert.ok(conds > 60 && conds < 140, `about half (${conds}/200)`);
  // Well cooked, mostly good; burnt, mostly bad.
  const bad = (score) => {
    let n = 0;
    let all = 0;
    for (let i = 0; i < 200; i++) {
      const d = parseDish(cookDish(['sand', 'bread', 'iron_ingot'], 'p', score, r));
      all += d.fx.length;
      n += d.fx.filter((f) => f.i === 2).length;
    }
    return n / all;
  };
  const good = bad(1);
  const burnt = bad(0);
  assert.ok(good < 0.15 && burnt > 0.45, `bad effects: ${good.toFixed(2)} cooked well, ${burnt.toFixed(2)} burnt`);
  // A dish doesn't go into another as itself.
  const twice = cookDish([cookDish(['apple'], 'c', 1, r), 'bread'], 'o', 1, r);
  assert.equal(twice.split('~').length, 7, twice);
});

test('at most three dishes at once, and a recipe makes the same dish again from the same things', () => {
  const { game, p } = start();
  const r = seeded(4);
  const keys = [['apple'], ['carrot'], ['bread'], ['mushroom']].map((i) => cookDish(i, 'c', 1, r));
  for (const k of keys) {
    p.inv[p.selected] = { item: k, count: 1 };
    game.eat();
  }
  assert.ok(p.buffs.filter((b) => b.dish).length <= DISH_MAX);
  const rec = recipeOf(keys[0]);
  assert.deepEqual(rec.ings, ['apple']);
  assert.equal(rec.st, 'c');
  p.inv = Array(p.inv.length).fill(null);
  assert.ok(!canMake(p.inv, rec));
  p.give('apple', 1);
  assert.ok(canMake(p.inv, rec));
});

test('a campfire to cook at; a table too', () => {
  const { game, p } = start();
  const opened = [];
  game.ui.closeAll = () => {};
  game.ui.open = (w) => opened.push(w);
  const x = Math.round(p.x) + 1;
  const z = Math.round(p.z);
  const y = Math.round(p.y);
  for (const [blk, st] of [[B.campfire, 'c'], [B.table, 't']]) {
    game.world.setBlock(x, y, z, blk);
    opened.length = 0;
    game.interact(x, y, z);
    const w = opened.find((q) => q.kind === 'cook');
    assert.ok(w, `cooking at the ${st === 'c' ? 'campfire' : 'table'}`);
    assert.equal(w.st, st);
  }
});

test('the town\'s cooks cook too: from their pantry, and they write down what turns out well', () => {
  const store = {};
  stockPantry(store, seeded(2), 3);
  assert.ok(Object.keys(store).some((k) => PANTRY.includes(k)));
  const rec = { recipes: [] };
  const r = seeded(5);
  let made = 0;
  for (let i = 0; i < 30; i++) {
    const k = npcCook(rec, store, r);
    if (!k) continue;
    made++;
    assert.ok(ITEMS[k] && ITEMS[k].dish, k);
    for (const ing of parseDish(k).ings) assert.ok(!ing.startsWith('dish'), 'from what they have, not what they\'ve cooked');
    if (!Object.values(store).some((n) => n > 0)) stockPantry(store, r, 3);
  }
  assert.ok(made >= 10, `${made}`);
  assert.ok(rec.recipes.length > 0 && rec.recipes.length <= 6, `${rec.recipes.length} recipes kept`);
});

// ------------------------------------------------------------ the watch
function watchFight(nFoes, extra = 2) {
  const game = makeGame(12345);
  const input = stubInput();
  game.minute = 12 * 60;
  run(game, input, 20, 0.1);
  const [, a] = [...game.active].sort((x, y) => y[1].npcs.filter((n) => n.rec.job === 'guard').length - x[1].npcs.filter((n) => n.rec.job === 'guard').length)[0];
  for (const n of a.npcs.filter((q) => q.rec.age === 'adult' && q.rec.job !== 'guard' && q.rec.job !== 'mayor').slice(0, extra)) {
    n.rec.job = 'guard';
    n.rec.equipment.tool = 'iron_sword';
  }
  const guards = a.npcs.filter((n) => n.rec.job === 'guard' && !n.dead);
  const g0 = guards[0];
  const p = game.player;
  p.teleport(g0.x + 10, g0.y, g0.z + 10);
  guards.forEach((g, i) => {
    const s = game.findFreeSpot(g0.x + (i % 3) * 2, g0.z + Math.floor(i / 3) * 2, g0.y);
    g.teleport(s.x, s.y, s.z);
  });
  const foes = [];
  for (let i = 0; i < nFoes; i++) {
    const s = game.findFreeSpot(g0.x + 6 + (i % 3), g0.z + Math.floor(i / 3), g0.y);
    const w = new Creature(game, 'wolf', s.x, s.y, s.z);
    w.maxHp = w.hp = 400;
    game.addCreature(w);
    foes.push(w);
  }
  for (const g of guards) g.engage(foes[0]);
  return { game, input, guards, foes, p };
}

test('the watch spreads out round a few foes, and forms a line against many; never in a heap', () => {
  for (const [n, mode] of [[2, 'surround'], [6, 'line']]) {
    const { game, input, guards, foes, p } = watchFight(n);
    assert.ok(guards.length >= 3, `${guards.length} of the watch`);
    let stacked = 0;
    let seen = null;
    for (let i = 0; i < 300; i++) {
      p.hp = p.maxHp;
      for (const g of guards) g.hp = Math.max(g.hp, g.maxHp * 0.7);
      game.update(0.05, input);
      const live = guards.filter((g) => !g.dead && g.state === 'fight' && !g.moving);
      for (let x = 0; x < live.length; x++) for (let y = x + 1; y < live.length; y++) if (live[x].x === live[y].x && live[x].z === live[y].z) stacked++;
      const pl = game._tacCache && game._tacCache.byFoe.get(foes.find((f) => !f.dead));
      if (pl && pl.mode) seen = pl.mode;
      if (i === 100) {
        // (Each with a place of their own.)
        const g = guards.find((q) => q.state === 'fight' && q.threat);
        const plan = g && guardPlan(game, g, g.threat);
        if (plan && plan.spot) for (const o of guards) if (o !== g && o.state === 'fight' && o.threat) {
          const op = guardPlan(game, o, o.threat);
          if (op && op.spot) assert.ok(op.spot.x !== plan.spot.x || op.spot.z !== plan.spot.z, 'not the same place');
        }
      }
    }
    assert.equal(seen, mode, `${n} foes: ${seen}`);
    assert.ok(stacked <= 4, `${n} foes: standing on each other ${stacked} times`);
  }
});

test('the watch buys salves, and a guard who\'s fallen back drinks one when they\'re hurt', () => {
  const { game } = start();
  const [, a] = [...game.active][0];
  const L = a.layout;
  for (const r of L.npcs) if (r.job === 'guard') {
    r.inv = [];
    r.coins = 100;
  }
  // (Someone in town with salves to sell.)
  const shop = Object.values(L.econ.biz).find((b) => b && b.store);
  shop.store.healing_salve = 20;
  guardSupplies(L);
  const guards = L.npcs.filter((r) => r.job === 'guard' && r.alive !== false);
  assert.ok(guards.length);
  assert.ok(guards.some((r) => (r.inv || []).some((s) => s && s.item === 'healing_salve')), 'bought from whoever sells them');
  const g = a.npcs.find((n) => n.rec.job === 'guard' && !n.dead);
  g.rec.inv = [{ item: 'healing_salve', count: 1 }];
  g.hp = Math.round(g.maxHp * 0.3);
  const before = g.hp;
  const foe = { x: g.x + 6, y: g.y, z: g.z, dead: false };
  assert.ok(g.patchUp(foe, 6), 'drinks it');
  assert.ok(g.hp > before);
  assert.ok(!g.rec.inv.some((s) => s && s.item === 'healing_salve' && s.count > 0), 'used up');
  g.hp = Math.round(g.maxHp * 0.3);
  g.rec.inv = [{ item: 'healing_salve', count: 1 }];
  assert.ok(!g.patchUp(foe, 6), 'not again straight away');
  g.salvedAt = -99;
  assert.ok(!g.patchUp(foe, 1), 'not with the foe at their elbow');
});

// ------------------------------------------------------------ masters
test('a master kept waiting makes one more of its works ready at a time, not all at once', () => {
  const c = { target: { dead: false }, sinceAtk: 3.3, hp: 100, maxHp: 100, S: {}, aCd: 5, bCd: 8, cCd: 12, gapT: 2 };
  assert.equal(press(c), 'ready');
  assert.deepEqual([c.aCd, c.bCd, c.cCd], [0, 8, 12], 'the soonest');
  assert.equal(press(c), 'ready');
  assert.deepEqual([c.bCd, c.cCd], [8, 12], 'and nothing more straight away');
  c.sinceAtk += 1;
  press(c);
  assert.equal(c.bCd, 0, 'a moment later, the next');
  assert.equal(c.cCd, 12);
});

// ------------------------------------------------------------ saves
test('loading: a save picked shows its details, to load, update (older ones) or delete it', async () => {
  const store = new SaveStore(memStore());
  await store.putText('2', JSON.stringify({ seed: 3, gv: '0.48.0', day: 4 }), { name: 'Ana', day: 4, seed: 3, gv: '0.48.0', savedAt: 1, place: 'the wilds' });
  const opened = [];
  const did = [];
  const ui = { open: (w) => opened.push(w), close() {}, closeWin() {}, hooks: { loadSlot: (id) => did.push(['load', id]), upgradeSlot: (id) => did.push(['update', id]) }, audio: null, mouse: { cx: -1, cy: -1 } };
  const w = new SaveSlotsWindow(ui, 'load', store);
  w.close = () => {};
  w.sel = store.list().findIndex((q) => q.id === '2');
  w.onKey({ code: 'KeyX' });
  assert.ok(store.list().find((q) => q.id === '2').meta, 'X does nothing in the list');
  w.pick(null);
  const d = opened.find((q) => q instanceof SaveDetailsWindow);
  assert.ok(d, 'its details');
  d.close = () => {};
  d.onKey({ code: 'KeyU' });
  assert.deepEqual(did.pop(), ['update', '2'], 'an older one can be updated');
  d.onKey({ code: 'Enter' });
  assert.deepEqual(did.pop(), ['load', '2']);
  d.onKey({ code: 'KeyX' });
  assert.ok(store.list().find((q) => q.id === '2').meta, 'asked first');
  d.onKey({ code: 'KeyX' });
  assert.ok(!store.list().find((q) => q.id === '2').meta, 'deleted');
  // One of this version: nothing to update.
  await store.putText('3', JSON.stringify({ seed: 3, gv: GAME_VERSION }), { name: 'Bo', day: 1, seed: 3, gv: GAME_VERSION, savedAt: 1 });
  w.sel = store.list().findIndex((q) => q.id === '3');
  w.pick(null);
  const d2 = opened[opened.length - 1];
  d2.onKey({ code: 'KeyU' });
  assert.equal(did.length, 0);
});

// ------------------------------------------------------------ updating
test('an older world brought up to this version: one step at a time, what\'s new added to it', () => {
  assert.ok(STEPS.some((s) => s.to === GAME_VERSION), 'this version has its step');
  assert.deepEqual(stepsFor(GAME_VERSION), []);
  assert.ok(stepsFor('0.48.0').length >= 2);
  // A world saved in 0.48, as written.
  const { game } = start();
  const d = game.serialize();
  d.gv = '0.48.0';
  delete d.player.recipes;
  delete d.player.kinds;
  d.player.buffs = [{ name: 'old' }, { name: 'kept', until: 5 }];
  delete d.stats.cooked;
  const out = migrateSave(d);
  assert.equal(out.from, '0.48.0');
  assert.equal(d.gv, GAME_VERSION);
  assert.deepEqual(d.player.recipes, []);
  assert.deepEqual(d.player.kinds, []);
  assert.deepEqual(d.player.buffs.map((b) => b.name), ['kept'], 'a broken effect dropped');
  assert.equal(d.stats.cooked, 0);
  assert.ok(d.pending.includes('0.50.0'), 'the rest when it\'s loaded');
  // Loaded: the watch each with a salve, the kitchens stocked.
  const g2 = new Game({ seed: d.seed, renderer: game.renderer, audio: null, ui: game.ui, save: d });
  const input = stubInput();
  run(g2, input, 20, 0.1);
  assert.ok(g2.migrated && g2.migrated.length, 'told what was done');
  const towns = [...g2.world.layouts.values()].filter((L) => L.econ);
  assert.ok(towns.length);
  for (const L of towns) {
    assert.ok((L.econ.migrated || []).includes('0.50.0'), L.settlement.name);
    for (const r of L.npcs) if (r.job === 'guard' && r.alive !== false && !r.dead) assert.ok((r.inv || []).some((s) => s && s.item === 'healing_salve'), `${r.name.first} of the watch`);
  }
  // And saved again: done, not done twice.
  const again = g2.serialize();
  assert.ok((again.sim.migrate || []).includes('0.50.0'));
});
