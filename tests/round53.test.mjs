// Round 53: an older world's details no longer ask to update it every
// frame (they piled up and froze the game), and the save list stops
// reading every save to see it's there; a dish's effect's picture tells
// what it does under the pointer with a window open too; and dishes that
// answer what you do (each time you break a block, are struck, eat, land a
// blow...) and that make things happen (lightning, a little blast, flame,
// a heart healed; or lightning on you, a storm, a spell as a sheep...).
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGame, stubInput, stubUI } from './helpers.mjs';
import { ITEMS } from '../src/world/items.js';
import { dishKey, parseDish, dishLines, cookDish, effectOf, ACTS, TRIGS, TYPES, TRIG_SECS } from '../src/world/dishes.js';
import { dishFx, condHolds } from '../src/game/cooking.js';
import { DO, dishTrigger, fireAct, sheepFilter, foesNear } from '../src/game/dishacts.js';
import { Creature } from '../src/entities/creature.js';
import { SaveDetailsWindow, InventoryWindow } from '../src/ui/windows.js';
import { UI } from '../src/ui/ui.js';
import { Window } from '../src/ui/window.js';
import { SaveStore } from '../src/game/saves.js';
import { STEPS, stepsFor, migrateSave } from '../src/game/migrate.js';
import { GAME_VERSION } from '../src/version.js';
import { asSeat } from '../src/game/party.js';
import { kitchenOf } from '../src/sim/econ.js';
import { B } from '../src/world/blocks.js';

function start(seed = 12345) {
  const game = makeGame(seed);
  const input = stubInput();
  game.minute = 10 * 60;
  for (let i = 0; i < 20; i++) game.update(0.1, input);
  return { game, input, p: game.player };
}
const run = (game, input, n = 10, dt = 0.1) => {
  for (let i = 0; i < n; i++) game.update(dt, input);
};
const tick = (game) => {
  game.frameNo = (game.frameNo || 0) + 1;
};
// A dish of our own making: what went in, its effects ([kind, which]), a
// condition or a trigger (a kind).
const dish = (fx, o = {}) => dishKey({ st: 'c', ings: ['sand', 'bread'], fx: fx.map(([type, i]) => ({ type, i })), cond: o.cond || null, trig: o.trig || null, mins: 300, heal: 3 });
function eat(game, p, key) {
  p.inv[0] = { item: key, count: 1 };
  p.selected = 0;
  game.eat();
  tick(game);
}
function wolfBy(game, p, dx = 2) {
  const w = new Creature(game, 'wolf', p.x + dx, p.y, p.z);
  game.addCreature(w);
  w.angry = true;
  w.target = p;
  return w;
}

// ------------------------------------------------------------ saves
test('an older world\'s details: asked to update it once, when you ask, never every frame', () => {
  let asked = 0;
  const ui = { ...stubUI(), mouseCell: { x: -1, y: -1 }, close() {}, open() {} };
  const w = new SaveDetailsWindow(ui, { id: 'mp1', title: 'YOUR WORLD', mp: true, meta: () => ({ world: 'Old', name: 'Hosty', day: 3, minute: 600, seed: 1, gv: '0.50.0', savedAt: Date.now() }), load() {}, remove() {}, update: () => asked++ });
  // (What the screen does to every window, every frame.)
  for (let i = 0; i < 120; i++) w.update(1 / 60);
  assert.equal(asked, 0, 'not asked by itself');
  w.onKey({ code: 'KeyU' });
  assert.equal(asked, 1, 'asked when U is pressed');
  w.upgrade();
  assert.equal(asked, 2);
  // (This version's own: nothing to update.)
  const w2 = new SaveDetailsWindow(ui, { id: 'mp1', title: 'YOUR WORLD', meta: () => ({ name: 'x', day: 1, minute: 0, seed: 1, gv: GAME_VERSION, savedAt: Date.now() }), load() {}, remove() {}, update: () => asked++ });
  w2.onKey({ code: 'KeyU' });
  assert.equal(asked, 2);
});

test('the save list remembers a save is there, rather than reading the whole of it every frame', async () => {
  const m = new Map();
  let reads = 0;
  const st = {
    getItem: (k) => {
      if (k.startsWith('tessera-save-') && k !== 'tessera-saves-v2') reads++;
      return m.has(k) ? m.get(k) : null;
    },
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
  };
  const store = new SaveStore(st);
  const big = JSON.stringify({ seed: 1, pad: 'x'.repeat(50000) });
  await store.putText('mp1', big, { name: 'Hosty', world: 'Old', day: 2, minute: 0, seed: 1, savedAt: 5, gv: '0.50.0' });
  reads = 0;
  for (let i = 0; i < 200; i++) store.worlds();
  assert.ok(reads <= 3, `${reads} reads for 200 looks`);
  assert.equal(store.worlds().length, 1);
  // Removed: gone from the list at once.
  store.remove('mp1');
  assert.equal(store.worlds().length, 0);
  await store.putText('mp2', big, { name: 'Again', world: 'New', day: 1, minute: 0, seed: 2, savedAt: 6 });
  assert.equal(store.worlds().length, 1);
});

// ------------------------------------------------------------ the HUD
test('a dish\'s picture under the pointer tells what it does, with your pack open too (not under a window)', () => {
  // (The screen's own: a canvas that draws nowhere.)
  const ctx = { createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }), putImageData() {}, drawImage() {}, fillRect() {}, clearRect() {}, getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }) };
  globalThis.document ??= { createElement: () => ({ getContext: () => ctx, width: 0, height: 0 }) };
  const { game, p } = start();
  eat(game, p, dish([['crumbly', 0]], { trig: 'crumbly' }));
  const ui = new UI(null);
  ui.game = game;
  ui.showHud = true;
  ui.mouseCell = { x: 2, y: 5 };
  ui.drawHud(game, 60);
  assert.ok(ui.tooltip && ui.tooltip.lines.some((l) => /Wears off/.test(l.text)), 'with nothing open');
  ui.tooltip = null;
  ui.windows.push(new InventoryWindow(ui));
  assert.ok(ui.modal);
  ui.drawHud(game, 60);
  assert.ok(ui.tooltip && ui.tooltip.lines.some((l) => /each time you break a block/.test(l.text)), 'with the pack open');
  // (A window over the picture: the window's, not the picture's.)
  ui.tooltip = null;
  ui.windows.push(new Window(ui, 30, 10, { x: 0, y: 0 }));
  ui.drawHud(game, 60);
  assert.equal(ui.tooltip, null);
});

// ------------------------------------------------------------ dishes: the data
test('dishes: a trigger and acts are written into the key and read back; older keys mean what they did', () => {
  const k = dish([['crumbly', 0], ['crumbly', 3], ['metallic', 4]], { trig: 'crumbly' });
  const d = parseDish(k);
  assert.equal(d.trig, 'crumbly');
  assert.equal(d.cond, null);
  assert.deepEqual(d.fx.map((f) => f.i), [0, 3, 4]);
  assert.deepEqual(effectOf(d.fx[1]), { k: 'blast', n: 1, good: true, type: 'crumbly', act: true });
  assert.equal(effectOf(d.fx[2]).k, 'zap');
  assert.equal(effectOf(d.fx[2]).good, false);
  // (One from round 50: a condition, two effects, as before.)
  const old = 'dish~p~sand,bread,iron_ingot~dry.0,crumbly.1~metallic~300~6';
  const od = parseDish(old);
  assert.equal(od.cond, 'metallic');
  assert.equal(od.trig, null);
  assert.deepEqual(ITEMS[old].dish.effects.map((e) => e.k), ['heatproof', 'haste']);
  // Every kind has a trigger and two acts of its own, all of them known.
  for (const [t, T] of Object.entries(TYPES)) {
    assert.ok(TRIGS[T.trig], `${t}: ${T.trig}`);
    assert.equal(T.acts.length, 2);
    assert.ok(ACTS[T.acts[0]] && ACTS[T.acts[0]].good, `${t}: good ${T.acts[0]}`);
    assert.ok(ACTS[T.acts[1]] && !ACTS[T.acts[1]].good, `${t}: bad ${T.acts[1]}`);
  }
  for (const a of Object.keys(ACTS)) assert.equal(typeof DO[a], 'function', a);
  assert.ok(Object.keys(ACTS).length >= 28, 'plenty of them');
});

test('dishes: what it says it does (on a trigger: when, then each effect; with none, its acts now and then)', () => {
  const k = dish([['crumbly', 0], ['crumbly', 3]], { trig: 'crumbly' });
  const lines = dishLines(ITEMS[k]);
  assert.equal(lines[0].text, `${TRIGS.break}:`);
  assert.ok(lines[0].cond);
  assert.ok(lines.some((l) => l.text === `breaks stone and ore 30% faster (${TRIG_SECS}s)`));
  assert.ok(lines.some((l) => l.act && l.text === ACTS.blast.text && l.good));
  const k2 = dish([['meat', 3], ['soft', 4]], { cond: 'cold' });
  const l2 = dishLines(ITEMS[k2]).map((l) => l.text);
  assert.ok(l2.includes(`now and then, ${ACTS.heart.text}`));
  assert.ok(l2.includes(`now and then, ${ACTS.sheep.text}`));
  assert.ok(l2.includes('only at night'));
});

test('cooking: some dishes come out with a trigger, some with acts, not all', () => {
  let trig = 0;
  let acts = 0;
  let r = 7;
  const rng = () => {
    r = (r * 16807) % 2147483647;
    return r / 2147483647;
  };
  const N = 600;
  for (let i = 0; i < N; i++) {
    const d = parseDish(cookDish(['sand', 'apple', 'iron_ingot'], 'p', rng(), rng));
    if (d.trig) trig++;
    if (d.fx.some((f) => f.i >= 3)) acts++;
  }
  assert.ok(trig > N * 0.15 && trig < N * 0.4, `triggers ${trig}/${N}`);
  assert.ok(acts > N * 0.15 && acts < N * 0.6, `acts ${acts}/${N}`);
});

// ------------------------------------------------------------ dishes: in play
test('a trigger: each block broken, its effects come on for a few seconds (and a little blast)', () => {
  const { game, input, p } = start();
  eat(game, p, dish([['crumbly', 0], ['crumbly', 3]], { trig: 'crumbly' }));
  assert.equal(dishFx(p, 'mine'), 0, 'not till you break something');
  const k = dish([['crumbly', 0], ['crumbly', 3]], { trig: 'crumbly' });
  assert.ok(!condHolds(game, p, ITEMS[k].dish, k));
  dishTrigger(game, p, 'break', { at: { x: p.x + 1, y: p.y, z: p.z } });
  tick(game);
  assert.ok(dishFx(p, 'mine') > 0, 'on');
  assert.ok(p.dishState[k].cd.blast > p.dishClock, 'the blast went off, and waits now');
  // (Other things you do don't set it off.)
  dishTrigger(game, p, 'eat');
  run(game, input, TRIG_SECS * 10 + 20);
  tick(game);
  assert.equal(dishFx(p, 'mine'), 0, 'off again');
});

test('a block broken by your own hand sets it off; struck, you\'re warded from the next blow', () => {
  const { game, input, p } = start();
  eat(game, p, dish([['crumbly', 0]], { trig: 'crumbly' }));
  const at = { x: p.x + 1, y: p.y - 1, z: p.z };
  game.world.setBlock(at.x, at.y, at.z, B.stone);
  game.breakBlock(at.x, at.y, at.z, true);
  tick(game);
  assert.ok(dishFx(p, 'mine') > 0, 'broken: on');
  // A ward on being struck.
  eat(game, p, dish([['bitter', 3]], { trig: 'cold' }));
  const w = wolfBy(game, p);
  p.hp = p.maxHp;
  game.damage(p, 3, w);
  const hp1 = p.hp;
  assert.ok(hp1 < p.maxHp, 'the first blow lands');
  assert.ok(p.dishWard > p.dishClock, 'warded after');
  game.damage(p, 3, w);
  assert.equal(p.hp, hp1, 'the next turned aside');
  game.damage(p, 3, w);
  assert.ok(p.hp < hp1, 'and only the one');
  void input;
});

test('a blow landed calls lightning down on them; a kill gives back a heart', () => {
  const { game, p } = start();
  const w = wolfBy(game, p);
  w.hp = w.maxHp = 40;
  eat(game, p, dish([['metallic', 3]], { trig: 'metallic' }));
  game.damage(w, 1, p);
  assert.ok(w.hp <= 40 - 1 - 5, `struck by lightning too (${w.hp})`);
  eat(game, p, dish([['meat', 3]], { trig: 'meat' }));
  p.hp = p.maxHp - 6;
  const hp0 = p.hp;
  const w2 = wolfBy(game, p, -2);
  game.kill(w2, p);
  assert.equal(p.hp, hp0 + 2, 'a heart back');
});

test('with no trigger, a dish\'s acts happen now and then (while its condition holds)', () => {
  const { game, input, p } = start();
  eat(game, p, dish([['juicy', 3]]));
  p.hp = p.maxHp - 8;
  const hp0 = p.hp;
  run(game, input, 400);
  assert.ok(p.hp > hp0, 'mended by it, in a while');
  // A bad one, only at night: by day it waits.
  const { game: g2, input: i2, p: p2 } = start();
  g2.minute = 12 * 60;
  eat(g2, p2, dish([['metallic', 4]], { cond: 'cold' }));
  p2.hp = p2.maxHp;
  run(g2, i2, 400);
  assert.equal(p2.hp, p2.maxHp, 'no lightning by day');
});

test('the acts: lightning, a blast, flame, frost, a gust, a quake, a snare, a flash, thorns: on foes, not on townsfolk', () => {
  const { game, p } = start();
  for (const a of ['bolt', 'blast', 'flame', 'frost', 'quake', 'snare', 'flash', 'thorns']) {
    const w = wolfBy(game, p, 2);
    w.hp = w.maxHp = 50;
    const before = { hp: w.hp, stun: w.stunT || 0, slow: w.slowT || 0, burn: w.burnT || 0, frozen: w.frozenT || 0, bleed: w.bleedT || 0 };
    assert.ok(foesNear(game, p, 3).includes(w), `${a}: a foe`);
    assert.ok(fireAct(game, p, a, { trigger: 'test' }), a);
    const after = { hp: w.hp, stun: w.stunT || 0, slow: w.slowT || 0, burn: w.burnT || 0, frozen: w.frozenT || 0, bleed: w.bleedT || 0 };
    assert.notDeepEqual(after, before, `${a} did something to it`);
    game.kill(w, null);
  }
  // Nobody near who's against you: lightning has nowhere to go.
  const towns = game.npcs.filter((n) => !n.dead);
  assert.ok(!fireAct(game, p, 'bolt', {}), 'no foe, no bolt');
  for (const n of towns) assert.ok(!(n.stunT > 0) || n.state === 'fight', 'nobody in town struck');
});

test('the acts on you: a heart, breath, a ward, a burst of speed, blinking, fish from the sky', () => {
  const { game, input, p } = start();
  p.hp = p.maxHp - 5;
  fireAct(game, p, 'heart');
  assert.equal(p.hp, p.maxHp - 3);
  p.stamina = 0;
  fireAct(game, p, 'wind', { trigger: 'test' });
  assert.equal(p.stamina, p.maxStamina || 10);
  fireAct(game, p, 'dash');
  tick(game);
  assert.ok(dishFx(p, 'speed') > 0.3, 'quick');
  const x0 = p.x;
  const z0 = p.z;
  p.dir = 0;
  fireAct(game, p, 'blink');
  assert.ok(p.x !== x0 || p.z !== z0, 'moved');
  const drops = game.drops.length;
  fireAct(game, p, 'fishrain');
  assert.ok(game.drops.length > drops, 'fish');
  run(game, input, 60);
  tick(game);
  assert.ok(dishFx(p, 'speed') <= 0.01, 'the burst over');
});

test('the bad acts: lightning on you, a blast, fire, frost, a stumble, stuck feet, a sneeze, a stink, a storm', () => {
  const { game, input, p } = start();
  p.hp = p.maxHp;
  fireAct(game, p, 'zap');
  assert.ok(p.hp < p.maxHp, 'zapped');
  fireAct(game, p, 'burn');
  assert.ok(p.burnT > 0);
  fireAct(game, p, 'chill');
  assert.ok(p.frozenT > 0);
  fireAct(game, p, 'stumble');
  assert.equal(p.stamina, 0);
  fireAct(game, p, 'stuck');
  assert.ok(p.rootT > 0);
  p.inv[3] = { item: 'apple', count: 2 };
  p.selected = 3;
  const drops = game.drops.length;
  fireAct(game, p, 'sneeze');
  assert.equal(p.inv[3].count, 1, 'one dropped');
  assert.ok(game.drops.length > drops);
  fireAct(game, p, 'storm');
  assert.ok(game.dishStorm && game.dishStorm.until > game.sim.abs);
  run(game, input, 40);
  assert.ok(game.weather && game.weather.kind !== 'clear' && game.weather.storm > 0.4, 'a storm overhead');
  fireAct(game, p, 'hiccup');
  assert.equal(p.hiccups, 4);
  run(game, input, 200);
  assert.equal(p.hiccups, 0, 'over');
});

test('turned into a sheep: a sheep for a while (no blows, no digging), bleating, then yourself again', () => {
  const { game, input, p } = start();
  fireAct(game, p, 'sheep');
  assert.ok(p.sheepT > 0);
  // (What a sheep can press: the camera, the belt, walking. Not F, not
  // space.)
  const keys = sheepFilter(game, p, [{ code: 'KeyF' }, { code: 'KeyQ' }, { code: 'Space' }, { code: 'Digit2' }, { code: 'KeyG' }]).map((k) => k.code);
  assert.deepEqual(keys, ['KeyQ', 'Digit2']);
  // A blow struck as a sheep: nothing.
  const w = wolfBy(game, p);
  const hp = w.hp;
  input.pressed?.push?.({ code: 'KeyF' });
  game.mining = { x: p.x, y: p.y - 1, z: p.z, progress: 0.5 };
  run(game, input, 5);
  assert.equal(game.mining, null, 'no digging');
  assert.equal(w.hp, hp);
  run(game, input, 160);
  assert.equal(p.sheepT, 0, 'yourself again');
});

test('a dish on someone playing in another\'s world: theirs to set off, theirs to feel', () => {
  const { game, input } = start();
  game.startParty({ id: 'h', name: 'Hosty' });
  const seat = game.addSeat({ id: 'g', name: 'Guesty' }, { ui: stubUI(), input: stubInput(), hero: null });
  const gp = seat.ent;
  run(game, input, 5);
  asSeat(game, seat, () => eat(game, gp, dish([['bitter', 3]], { trig: 'cold' })));
  const w = wolfBy(game, gp);
  gp.hp = gp.maxHp;
  game.damage(gp, 3, w);
  assert.ok(gp.dishWard > gp.dishClock, 'the guest warded');
  assert.ok(!(game.player.dishWard > 0), 'not the host');
  const hp = gp.hp;
  game.damage(gp, 3, w);
  assert.equal(gp.hp, hp);
});

test('migration 0.53.0: a dish\'s bookkeeping started clean; each kitchen puts up one of the new sort', () => {
  const step = STEPS.find((q) => q.to === '0.53.0');
  assert.ok(step && step.data && step.town);
  assert.ok(stepsFor('0.52.0').some((q) => q.to === '0.53.0'));
  assert.ok(STEPS.some((q) => q.to === GAME_VERSION));
  const { game } = start();
  const d = game.serialize();
  d.gv = '0.52.0';
  d.player.sheepT = 9;
  const out = migrateSave(d);
  assert.equal(out.from, '0.52.0');
  assert.equal(d.player.sheepT, undefined);
  const L = [...game.world.layouts.values()].find((q) => q.econ && kitchenOf(q));
  assert.ok(L, 'a town with a kitchen');
  const k = kitchenOf(L);
  const before = Object.keys(k.store).filter((q) => q.startsWith('dish~')).length;
  step.town(L, game);
  const dishes = Object.keys(k.store).filter((q) => q.startsWith('dish~'));
  assert.ok(dishes.length > before, 'one more');
  assert.ok(dishes.some((q) => {
    const x = parseDish(q);
    return x && (x.trig || x.fx.some((f) => f.i === 3));
  }), 'of the new sort');
});
