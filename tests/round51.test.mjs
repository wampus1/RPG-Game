// Round 51: the wing a way out when you've no breath left; a cooked dish
// that builds up and then comes out with a flourish, at a furnace too, its
// window kept inside itself; recipes written on scrolls, to sell, give
// away, buy and read; what's working on you shown as little pictures with
// their time left; instruments to play and a pipe to smoke; and the
// openings painted again (the houses whole, the people on the ground).
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGame, stubInput, stubRenderer, stubUI } from './helpers.mjs';
import { ITEMS } from '../src/world/items.js';
import { cookDish, RECIPE_PREFIX } from '../src/world/dishes.js';
import { learnRecipe, writeRecipe, recipeScroll, RECIPE_MAX } from '../src/game/cooking.js';
import { roll } from '../src/game/combat.js';
import { normalizeHero, randomHero } from '../src/game/hero.js';
import { Game } from '../src/game/game.js';
import { CookWindow, RecipeScrollWindow } from '../src/ui/cook.js';
import { InstrumentWindow } from '../src/ui/instrument.js';
import { INSTRUMENTS, keyLabel, noteName } from '../src/game/instruments.js';
import { CraftWindow, TradeWindow } from '../src/ui/windows.js';
import { buffKey, shortLeft } from '../src/ui/ui.js';
import { Grid } from '../src/ui/ascii.js';
import { STEPS, stepsFor, migrateSave } from '../src/game/migrate.js';
import { GAME_VERSION } from '../src/version.js';
import { Bmp, house, ramp, toHsl } from '../src/render/brush.js';
import { villagers, HOMES, FIRE, SQUARE } from '../src/render/art_star.js';

function start(seed = 12345) {
  const game = makeGame(seed);
  const input = stubInput();
  game.minute = 10 * 60;
  for (let i = 0; i < 20; i++) game.update(0.1, input);
  return { game, input, p: game.player };
}
// A stand-in for the UI a window sits in (it opens, closes, and is told
// where the mouse is).
function winUI(game) {
  const u = { game, audio: null, mouseCell: { x: -1, y: -1 }, msgs: [], opened: [], closed: [] };
  u.msg = (t) => u.msgs.push(t);
  u.open = (w) => u.opened.push(w);
  u.close = (w) => u.closed.push(w);
  u.closeAll = () => {};
  return u;
}
const hold = (p, item, count = 1) => {
  p.inv[p.selected] = { item, count };
};
// A rough random, the same every time.
const seeded = (s) => () => {
  s = (s * 1103515245 + 12345) & 0x7fffffff;
  return s / 0x7fffffff;
};

// ------------------------------------------------------------ the wing
test('the wing carries you through a roll when you\'re too winded for one, for no stamina', () => {
  const hero = normalizeHero({ ...randomHero(3), origin: 'star', name: 'Lumen' });
  const game = new Game({ seed: 12345, renderer: stubRenderer(), audio: null, ui: stubUI(), hero, intro: false });
  const p = game.player;
  const input = stubInput();
  for (let i = 0; i < 5; i++) game.update(0.1, input);
  p.stamina = 0;
  p.rollCd = 0;
  p.rollT = 0;
  assert.equal(p.wing.k, 1);
  assert.ok(roll(game, p, [1, 0]), 'rolled on the wing');
  assert.equal(p.stamina, 0, 'no stamina spent (there was none)');
  assert.equal(p.wing.k, 0, 'the wing spent instead');
  // The wing spent and still no breath: no.
  p.rollT = 0;
  p.rollCd = 0;
  assert.ok(!roll(game, p, [0, 1]));
  // Breath enough: an ordinary roll, the wing left alone.
  p.wing.k = 1;
  p.stamina = 100;
  p.rollCd = 0;
  assert.ok(roll(game, p, [1, 0]));
  assert.ok(p.stamina < 100);
  assert.equal(p.wing.k, 1, 'not spent on a roll you had breath for');
  // Without a wing, winded is winded.
  const { game: g2, p: p2 } = start();
  p2.stamina = 0;
  p2.rollCd = 0;
  assert.ok(!roll(g2, p2, [1, 0]));
});

// ------------------------------------------------------------ cooking
test('a dish comes out with a flourish: it builds, bursts (or smokes), then shows what it is', () => {
  const { game, p } = start();
  const ui = winUI(game);
  const w = new CookWindow(ui, game, { st: 'p' });
  const key = cookDish(['raw_meat', 'carrot'], 'p', 0.95, seeded(3));
  w.give(key, 0.95, false, ['raw_meat', 'carrot']);
  assert.equal(w.phase, 'reveal');
  assert.equal(w.tier.word, 'PERFECT!');
  assert.ok(p.inv.some((s) => s && s.item === key), 'in your pack already');
  // Building: sparks drawn in; then out it comes, a burst of them.
  for (let t = 0; t < 1.4; t += 0.05) w.update(0.05);
  assert.equal(w.phase, 'reveal', 'still building');
  assert.ok(w.parts.length > 0, 'sparks drawn in');
  const before = w.parts.length;
  for (let t = 0; t < 0.2; t += 0.05) w.update(0.05);
  assert.ok(w.parts.length > before + 20, 'the burst');
  for (let t = 0; t < 2; t += 0.05) w.update(0.05);
  assert.equal(w.phase, 'done');
  // Burnt: smoke, not sparks. And any key gets you straight to the end.
  const w2 = new CookWindow(ui, game, { st: 'c', lit: true });
  w2.give(cookDish(['apple'], 'c', 0.1, seeded(4)), 0.1, false, ['apple']);
  assert.ok(w2.tier.smoke);
  w2.onKey({ code: 'Space' });
  assert.equal(w2.phase, 'done');
  assert.ok(w2.parts.length > 0, 'it smoked');
});

test('the cooking window keeps everything inside itself, however long the dish\'s name', () => {
  const { game, p } = start();
  const ui = winUI(game);
  const r = seeded(9);
  for (const st of ['c', 'p', 'o', 't']) {
    const w = new CookWindow(ui, game, { st, lit: true });
    const key = cookDish(['raw_meat', 'mushroom', 'carrot', 'cabbage'], st, 0.7, r);
    p.inv = Array(p.inv.length).fill(null);
    for (const k of ['raw_meat', 'mushroom', 'carrot', 'cabbage', 'glowcap', 'mangrove_pod', 'crab_meat', 'ember_pod', 'honey', 'berries', 'apple']) p.give(k, 3);
    learnRecipe(p, key);
    const g = new Grid(w.w, w.h);
    const outside = [];
    const put = g.put.bind(g);
    g.put = (x, y, ch, ...rest) => {
      if ((x < 0 || y < 0 || x >= g.w || y >= g.h) && ch !== ' ') outside.push(`${x},${y} '${ch}'`);
      return put(x, y, ch, ...rest);
    };
    const draw = (what) => {
      outside.length = 0;
      g.clear();
      w.hits = [];
      w.draw(g, game);
      assert.deepEqual(outside, [], `${st}, ${what}: drawn off the window`);
    };
    draw('picking');
    w.tab = 'recipes';
    draw('recipes');
    w.tab = 'pack';
    w.give(key, 0.7, false, ['raw_meat', 'mushroom', 'carrot', 'cabbage']);
    draw('coming out');
    w.skipReveal();
    draw('done');
  }
});

test('a furnace\'s crafting window has its button for cooking in the pot', () => {
  const { game } = start();
  const ui = winUI(game);
  const w = new CraftWindow(ui, 'furnace');
  const g = new Grid(w.w, w.h);
  w.draw(g, game);
  const rows = [];
  for (let y = 0; y < g.h; y++) rows.push(g.ch.slice(y * g.w, (y + 1) * g.w).join(''));
  assert.ok(rows.some((l) => /Cook a dish in the pot/.test(l)), rows.join('\n'));
  const opened = [];
  game.openCooking = (st) => opened.push(st);
  ui.game = game;
  w.onKey({ code: 'KeyK' });
  assert.deepEqual(opened, ['p']);
});

// ------------------------------------------------------------ recipes on scrolls
test('a recipe written on a blank scroll: sold to a cook, read to learn it, the scroll kept', () => {
  const { game, p } = start();
  const dish = cookDish(['apple', 'bread'], 'o', 0.9, seeded(6));
  const key = recipeScroll(dish);
  assert.ok(key.startsWith(RECIPE_PREFIX));
  const d = ITEMS[key];
  assert.equal(d.kind, 'recipe');
  assert.equal(d.recipe, dish);
  assert.ok(d.name.startsWith('Recipe: '), d.name);
  assert.ok(d.value >= 10);
  // No blank scroll, nothing to write on.
  p.inv = Array(p.inv.length).fill(null);
  assert.equal(writeRecipe(p.inv, dish), false);
  p.give('scroll', 2);
  assert.equal(writeRecipe(p.inv, dish), true);
  assert.equal(p.inv.reduce((n, s) => n + (s && s.item === 'scroll' ? s.count : 0), 0), 1, 'a blank one used');
  assert.ok(p.inv.some((s) => s && s.item === key));
  // Read: learnt, and the scroll kept (to sell, or give away).
  p.recipes = [];
  p.selected = p.inv.findIndex((s) => s && s.item === key);
  assert.ok(game.useHeldThing());
  assert.ok(p.recipes.some((r) => r.key === dish));
  assert.ok(p.inv.some((s) => s && s.item === key), 'still have it');
  assert.equal(learnRecipe(p, dish), 'known');
  // Cooks want them; a smith doesn't.
  const ui = winUI(game);
  const tw = new TradeWindow(ui, { rec: { job: 'cook' } });
  tw.shopData = { kind: 'cook' };
  assert.ok(tw.wants(key, game));
  tw.shopData = { kind: 'smith' };
  assert.ok(!tw.wants(key, game));
  // A dish never goes into another; nor does a recipe.
  const w = new CookWindow(ui, game, { st: 'p' });
  const g = new Grid(w.w, w.h);
  w.draw(g, game);
  assert.ok(!(w.list || []).some((q) => String(q.key || q).startsWith(RECIPE_PREFIX)));
  assert.ok(RECIPE_MAX >= 12);
});

test('a blank scroll used: copy one of your recipes onto it (or told you know none yet)', () => {
  const { game, p } = start();
  const opened = [];
  game.ui.open = (w) => opened.push(w);
  p.recipes = [];
  hold(p, 'scroll', 2);
  assert.ok(game.useHeldThing());
  assert.equal(opened.length, 0);
  assert.ok(game.ui.msgs.some((m) => /blank scroll/i.test(m)));
  const dish = cookDish(['fish'], 'c', 0.9, seeded(8));
  learnRecipe(p, dish);
  assert.ok(game.useHeldThing());
  const w = opened.find((q) => q instanceof RecipeScrollWindow);
  assert.ok(w, 'the window to copy one in');
  w.ui = winUI(game);
  w.onKey({ code: 'Enter' });
  assert.ok(p.inv.some((s) => s && s.item === recipeScroll(dish)));
  assert.equal(p.inv.reduce((n, s) => n + (s && s.item === 'scroll' ? s.count : 0), 0), 1);
});

// ------------------------------------------------------------ the HUD
test('what\'s working on you: each its own picture, the food or the potion it came from', () => {
  const { game, p } = start();
  const dish = cookDish(['raw_meat', 'carrot'], 'p', 0.9, seeded(2));
  assert.equal(buffKey({ dish, name: 'whatever' }), dish);
  hold(p, 'potion_might');
  p.buffs = [];
  game.drink();
  const b = p.buffs.find((q) => q.stat);
  assert.ok(b, 'drunk');
  assert.equal(b.item, 'potion_might');
  assert.equal(buffKey(b), 'potion_might');
  // (Older ones, without the item: by what kind of potion it was.)
  assert.equal(buffKey({ combat: 'haste', name: '?' }), 'potion_haste');
  assert.equal(buffKey({ stat: 'str' }), 'potion_might');
  assert.equal(buffKey({ name: 'nothing at all' }), null);
  // Time left, short enough to go under a picture.
  assert.equal(shortLeft(240), '4h');
  assert.equal(shortLeft(52), '52m');
  assert.equal(shortLeft(0.2), '1m');
  for (const m of [1, 59, 60, 600, 1439]) assert.ok(shortLeft(m).length <= 3, `${m}`);
});

// ------------------------------------------------------------ instruments
test('every instrument its own keys and notes, a key for each', () => {
  const kinds = Object.keys(INSTRUMENTS);
  assert.ok(kinds.length >= 6);
  const sets = new Set();
  for (const k of kinds) {
    const I = INSTRUMENTS[k];
    assert.ok(ITEMS[k] && ITEMS[k].instrument, `${k} is an instrument to hold`);
    assert.equal(new Set(I.keys).size, I.keys.length, `${k}: a key once each`);
    assert.equal(I.labels.length, I.keys.length);
    if (!I.drums) assert.equal(I.notes.length, I.keys.length);
    for (let i = 0; i < I.keys.length; i++) assert.ok(keyLabel(I, i).length <= 5);
    sets.add(`${I.keys.join()}|${(I.notes || I.drums).join()}`);
  }
  assert.equal(sets.size, kinds.length, 'no two the same');
  assert.equal(noteName(60), 'C4');
  assert.equal(noteName(69), 'A4');
});

test('playing one: the right button brings up its keys; while it\'s up only they (and ESC) do anything', () => {
  const { game, p } = start();
  const opened = [];
  game.ui.open = (w) => opened.push(w);
  for (const k of Object.keys(INSTRUMENTS)) {
    hold(p, k);
    opened.length = 0;
    assert.ok(game.useHeldThing(), k);
    const w = opened[0];
    assert.ok(w instanceof InstrumentWindow, k);
    assert.ok(w.modal, 'nothing else while you play');
    const ui = winUI(game);
    w.ui = ui;
    const floats = [];
    game.renderer.floatText = (...a) => floats.push(a);
    const I = INSTRUMENTS[k];
    // Its keys play; any other is swallowed (no walking off); ESC puts it away.
    assert.ok(w.onKey({ code: I.keys[0] }));
    assert.equal(floats.length, 1, 'a note played');
    for (const code of ['ArrowUp', 'KeyE', 'Tab', 'KeyI']) if (!I.keys.includes(code)) assert.ok(w.onKey({ code }), `${code} swallowed`);
    assert.equal(floats.length, 1, 'and played nothing');
    assert.equal(ui.closed.length, 0);
    w.onKey({ code: 'Escape' });
    assert.equal(ui.closed.length, 1);
    // And put down: it stops.
    const w2 = new InstrumentWindow(ui, game, k);
    hold(p, 'apple');
    w2.update(0.1, game);
    assert.equal(ui.closed.length, 2);
  }
});

test('a clay pipe smoked: puffs of smoke off you for a while', () => {
  const { game, p, input } = start();
  hold(p, 'pipe');
  let puffs = 0;
  game.renderer.emit = (x, y, z, o) => {
    if (o && o.shape === 'puff') puffs++;
  };
  assert.ok(game.useHeldThing());
  assert.ok(p.smokeT > 0);
  for (let i = 0; i < 40; i++) game.update(0.1, input);
  assert.ok(puffs >= 3, `${puffs}`);
  for (let i = 0; i < 40; i++) game.update(0.1, input);
  const n = puffs;
  for (let i = 0; i < 20; i++) game.update(0.1, input);
  assert.equal(puffs, n, 'and then it\'s out');
});

// ------------------------------------------------------------ the openings
test('a painted house is one piece: no bit of roof left hanging on by a pixel', () => {
  const solid = (b, x, y) => b.alpha(x, y) === 255;
  // (Counting only what's thick enough: three of its four sides solid.)
  const core = (b, x, y) => solid(b, x, y) && [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => solid(b, x + dx, y + dy)).length >= 3;
  const pieces = (b) => {
    const seen = new Uint8Array(b.w * b.h);
    let n = 0;
    for (let y = 0; y < b.h; y++) {
      for (let x = 0; x < b.w; x++) {
        if (seen[y * b.w + x] || !core(b, x, y)) continue;
        n++;
        const todo = [[x, y]];
        seen[y * b.w + x] = 1;
        while (todo.length) {
          const [cx, cy] = todo.pop();
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nx = cx + dx;
            const ny = cy + dy;
            if (nx < 0 || ny < 0 || nx >= b.w || ny >= b.h || seen[ny * b.w + nx] || !core(b, nx, ny)) continue;
            seen[ny * b.w + nx] = 1;
            todo.push([nx, ny]);
          }
        }
      }
    }
    return n;
  };
  const wall = ramp('#c8b090', 4);
  const roof = ramp('#8a4a3a', 4);
  const timber = ramp('#4a3020', 2);
  for (const shape of ['gable', 'steep', 'flat', 'hut']) {
    for (const thatch of [false, true]) {
      for (const [w, h] of [[13, 8], [15, 9], [22, 13], [30, 16], [40, 20]]) {
        for (const chimney of [false, true]) {
          const b = new Bmp(120, 90);
          house(b, 20, 70, w, h, { wall, roof, timber, thatch, shape, chimney, windows: 2, lit: 0.5, glow: '#ffc060' });
          assert.equal(pieces(b), 1, `${shape}${thatch ? ', thatched' : ''}, ${w}x${h}${chimney ? ', a chimney' : ''}`);
        }
      }
    }
  }
});

test('the fallen star\'s village: its people on the ground of the square, none on a house\'s wall', () => {
  const rng = { float: (a, b) => a + (b - a) * 0.5, chance: () => false };
  const folk = villagers(rng);
  assert.ok(folk.length >= 6);
  for (const f of folk) {
    const k = ((f.x - FIRE.x) / SQUARE.rx) ** 2 + ((f.y - FIRE.y) / SQUARE.ry) ** 2;
    assert.ok(k <= 1, `(${f.x}, ${f.y}) in the square`);
    assert.ok(Math.hypot(f.x - FIRE.x, (f.y - FIRE.y) * 2) > 8, 'not in the fire');
    for (const [x, yb, w, h] of HOMES) {
      const d = Math.max(4, Math.round(w * 0.4));
      const onIt = f.x >= x - 1 && f.x <= x + w + d && f.y >= yb - h - d && f.y <= yb + 1;
      assert.ok(!onIt, `(${f.x}, ${f.y}) up against the house at ${x}`);
    }
  }
  assert.ok(folk.some((f) => f.small && f.points), 'a child pointing');
});

test('painting\'s colours: the shadows cooler, the lights warmer', () => {
  const dist = (h, to) => Math.min(Math.abs(h - to), 360 - Math.abs(h - to));
  for (const base of ['#6aa04a', '#8a4a3a', '#c8b090', '#3a7a3a']) {
    const r = ramp(base, 5);
    const [h0] = toHsl(r[0]);
    const [h4] = toHsl(r[4]);
    const [hb] = toHsl(base);
    assert.ok(toHsl(r[0])[2] < toHsl(r[4])[2], 'darker to lighter');
    assert.ok(dist(h0, 245) < dist(hb, 245), `${base}: its shadow bluer`);
    assert.ok(dist(h4, 52) < dist(hb, 52), `${base}: its light warmer`);
  }
});

// ------------------------------------------------------------ updating
test('a world from 0.50 brought up: potions\' effects with their pictures, the new goods in the shops', () => {
  assert.ok(STEPS.some((s) => s.to === '0.51.0'));
  assert.ok(STEPS.some((s) => s.to === GAME_VERSION));
  assert.ok(stepsFor('0.50.0').length >= 1);
  const { game } = start();
  const d = game.serialize();
  d.gv = '0.50.0';
  d.player.buffs = [{ stat: 'str', n: 2, until: 1e9, name: ITEMS.potion_might.name }];
  migrateSave(d);
  assert.equal(d.gv, GAME_VERSION);
  assert.equal(d.player.buffs[0].item, 'potion_might');
  // A town's shops, as they were before: the new goods put in them.
  const step = STEPS.find((s) => s.to === '0.51.0');
  const towns = [...game.world.layouts.values()].filter((L) => L.econ);
  assert.ok(towns.length);
  const NEW = ['lute', 'flute', 'pipe', 'scroll', 'lyre', 'fiddle', 'hand_drum', 'hunting_horn'];
  let had = 0;
  for (const L of towns) {
    for (const b of Object.values(L.econ.biz || {})) if (b && b.store) for (const k of NEW) delete b.store[k];
    step.town(L);
    for (const b of Object.values(L.econ.biz || {})) if (b && b.store) had += NEW.filter((k) => b.store[k]).length;
  }
  assert.ok(had > 0, 'some shop has them now');
});
