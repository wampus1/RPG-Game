import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGame, stubInput, lotsReady } from './helpers.mjs';
import { stockOf } from '../src/sim/econ.js';
import { B } from '../src/world/blocks.js';
import { GROUND } from '../src/config.js';
import { funeralSpots } from '../src/sim/sim.js';
import { Creature } from '../src/entities/creature.js';
import { onSwing, updateFlames } from '../src/game/gems.js';
import { ITEMS } from '../src/world/items.js';
import { recipesFor } from '../src/world/recipes.js';

function start(seed = 7, minute = 9 * 60) {
  const game = makeGame(seed);
  const input = stubInput();
  game.minute = minute;
  for (let i = 0; i < 20; i++) game.update(0.1, input);
  const [sid, a] = [...game.active][0];
  return { game, input, sid, a, L: a.layout, p: game.player };
}

const reload = (game) => {
  const data = JSON.parse(JSON.stringify(game.serialize()));
  return new game.constructor({ seed: data.seed, renderer: game.renderer, audio: null, ui: game.ui, save: data });
};

const tick = (game, input, n = 20, dt = 0.25) => {
  for (let i = 0; i < n; i++) game.update(dt, input);
};

const J = (game, sid) => game.sim.justice.pendingIn(sid).filter((c) => c.type === 'curfew');

// The city, loaded around you.
function inCity(seed = 12345, minute = 10 * 60) {
  const game = makeGame(seed);
  const input = stubInput();
  const city = game.world.ow.settlements.find((s) => s.type === 'city');
  const L = game.world.getLayout(city);
  const p = game.player;
  p.teleport(L.plaza.cx, GROUND, L.plaza.cz);
  game.loadAround(L.plaza.cx, L.plaza.cz, true);
  game.updateSettlements(true);
  game.minute = minute;
  tick(game, input, 20, 0.1);
  p.teleport(L.plaza.cx, game.world.findStandY(L.plaza.cx, L.plaza.cz, GROUND), L.plaza.cz);
  return { game, input, L, p, sid: city.id, a: game.active.get(city.id) };
}

const cheb = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.z - b.z));

// ------------------------------------------------------------ funerals
test('mourners at a funeral stand spaced out, not shoulder to shoulder', () => {
  const { L } = start(4);
  const slot = L.graveyard.slots[0];
  const spots = funeralSpots(L, slot.x, slot.z, 9);
  assert.ok(spots.length >= 6, `${spots.length} places for mourners`);
  for (let i = 0; i < spots.length; i++) {
    for (let j = i + 1; j < spots.length; j++) assert.ok(cheb(spots[i], spots[j]) >= 2, 'a pace between each mourner');
  }
  assert.ok(!spots.some((q) => q.x === slot.x && q.z === slot.z), 'nobody stands in the grave');
});

// ------------------------------------------------------------ theft
test('several things taken from one building around the same time are one theft', () => {
  const { game, sid, a } = start(4);
  const J = game.sim.justice;
  const n = a.npcs.find((q) => q.rec.job !== 'guard');
  J.commit(sid, 'theft', { witnesses: [n], value: 5, items: [{ item: 'bread', count: 1 }], desc: 'Stealing 1 Bread from the Bakery', owner: { kind: 'biz', id: 3 }, bid: 3 });
  J.commit(sid, 'theft', { witnesses: [n], value: 30, items: [{ item: 'bread', count: 2 }, { item: 'apple', count: 1 }], desc: 'Stealing 2 Bread from the Bakery', owner: { kind: 'biz', id: 3 }, bid: 3 });
  const list = J.pendingIn(sid).filter((c) => c.type === 'theft');
  assert.equal(list.length, 1, 'lumped together');
  assert.equal(list[0].value, 35);
  assert.equal(list[0].sev, 'moderate', 'the total decides how serious it is');
  assert.match(list[0].desc, /3 Bread/);
  // Somewhere else is another matter.
  J.commit(sid, 'theft', { witnesses: [n], value: 4, items: [{ item: 'apple', count: 1 }], owner: { kind: 'biz', id: 9 }, bid: 9 });
  assert.equal(J.pendingIn(sid).filter((c) => c.type === 'theft').length, 2);
});

// ------------------------------------------------------------ curfew
test('a guard on watch comes over after curfew, warns you, then fines you', () => {
  const { game, input, L, p, sid, a } = inCity(12345, 23 * 60);
  const w = game.world;
  const x = p.x;
  const z = p.z;
  L.econ.laws = { ...(L.econ.laws || {}), curfew: true };
  const guard = a.npcs.find((n) => n.rec.job === 'guard' && !n.dead && n.rec.shift === 'night' && !n.sleeping);
  assert.ok(guard, 'a night watchman');
  for (const n of a.npcs) if (n.rec.job === 'guard' && n !== guard) n.sleeping = true;
  guard.teleport(x + 6, w.findStandY(x + 6, z, GROUND), z);
  let warned = false;
  for (let i = 0; i < 400 && !J(game, sid).length; i++) {
    game.update(0.1, input);
    if (game.sim.justice.curfewT && game.sim.justice.curfewT.warned) warned = true;
  }
  assert.ok(warned, 'the guard came over and warned you first');
  assert.equal(J(game, sid).length, 1, 'then booked you for it');
  assert.ok(guard.distTo(p) <= 4, 'having stayed to see you did as you were told');
});

// ------------------------------------------------------------ gates
test('at night the watch shuts a gate again about five seconds after opening it', () => {
  const game = makeGame(12345);
  const input = stubInput();
  const city = game.world.ow.settlements.find((s) => s.type === 'city');
  const L = game.world.getLayout(city);
  const g = L.gates[0];
  const w = game.world;
  game.player.teleport(g.x + 8, GROUND, g.z + 8);
  game.loadAround(g.x, g.z, true);
  game.updateSettlements(true);
  game.minute = 23 * 60;
  tick(game, input, 5, 0.1);
  game.player.teleport(g.x + 8, w.findStandY(g.x + 8, g.z + 8, GROUND), g.z + 8);
  const guard = game.npcs.find((n) => !n.dead && n.rec.job === 'guard' && n.layout === L);
  guard.teleport(g.x + 2, GROUND, g.z + 2);
  guard.sleeping = false;
  game.setGate(g.x, g.z, true);
  const at = (secs) => {
    for (let t = 0; t < secs; t += 0.1) {
      game.minute = 23 * 60;
      guard.teleport(g.x + 2, GROUND, g.z + 2);
      guard.sleeping = false;
      game.update(0.1, input);
    }
    return w.getState(g.x, GROUND, g.z);
  };
  assert.equal(at(3), true, 'held open for whoever is coming through');
  assert.equal(at(3.5), false, 'then shut again');
});

// ------------------------------------------------------------ set-down things
test('something set down is named by what it is and whose, and sits a level up', () => {
  const { game, p, L } = start(7);
  const w = game.world;
  const x = p.x + 1;
  const z = p.z;
  const y = w.findStandY(x, z, p.y);
  const rec = L.npcs.find((r) => r.age === 'adult');
  game.setDown(x, y, z, 'bread', 2, { sid: L.settlement.id, idx: rec.idx, name: `${rec.name.first} ${rec.name.last}` });
  const got = game.placed.get(`${x},${y},${z}`);
  assert.equal(got.item, 'bread');
  assert.equal(game.placedOwnerName(got), ` (${rec.name.first}'s)`);
  assert.equal(game.placedOwnerName({ item: 'dirty_dish', owner: { mess: true } }), '');
  // (The tooltip reads the item's name, not "set down".)
  assert.equal(ITEMS[got.item].name, 'Bread');
});

// ------------------------------------------------------------ meals
test('the tavern serves a meal on a table, it becomes a dirty dish, and the keeper clears it', () => {
  const { game, L } = start(12345);
  const tav = L.buildings.find((b) => b.type === 'tavern');
  assert.ok(tav, 'there is a tavern');
  const w = game.world;
  // A seat beside a table in the tavern.
  let seat = null;
  for (let x = tav.x0 + 1; x < tav.x1 && !seat; x++) {
    for (let z = tav.z0 + 1; z < tav.z1 && !seat; z++) {
      if (w.getBlock(x, GROUND, z) !== B.air || w.getBlock(x, GROUND + 1, z) !== B.air) continue;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const bl = w.getBlock(x + dx, GROUND, z + dz);
        if ((bl === B.table || bl === B.counter) && w.getBlock(x + dx, GROUND + 1, z + dz) === B.air) seat = { x, z };
      }
    }
  }
  assert.ok(seat, 'somewhere to eat');
  const eater = game.npcs.find((n) => !n.dead && n.layout === L && n.rec.age === 'adult' && !['barkeep', 'innkeeper', 'cook'].includes(n.rec.job));
  eater.teleport(seat.x, GROUND, seat.z);
  eater.rec.lastMeal = { item: 'stew', day: game.day };
  eater.serveMeal();
  assert.ok(eater.meal, 'a meal was brought');
  const k = `${eater.meal.x},${eater.meal.y},${eater.meal.z}`;
  assert.equal(game.placed.get(k).item, 'stew');
  assert.equal(w.getBlock(eater.meal.x, eater.meal.y - 1, eater.meal.z) === B.table || w.getBlock(eater.meal.x, eater.meal.y - 1, eater.meal.z) === B.counter, true, 'on a table or counter');
  eater.finishMeal();
  assert.equal(game.placed.get(k).item, 'dirty_dish');
  // Picking up a dirty dish is no crime.
  const [dx, dy, dz] = k.split(',').map(Number);
  // The keeper clears it away.
  const keeper = game.npcs.find((n) => !n.dead && n.layout === L && ['barkeep', 'innkeeper', 'cook'].includes(n.rec.job)) || eater;
  keeper.teleport(dx + (w.canStand(dx + 1, GROUND, dz) ? 1 : -1), GROUND, dz);
  keeper.tidyT = 0;
  for (let i = 0; i < 40 && game.placed.has(k); i++) keeper.tidyUp(0.1);
  assert.ok(!game.placed.has(k), 'the table is clear again');
  assert.equal(w.getBlock(dx, dy, dz), B.air);
});

// ------------------------------------------------------------ displays
test('a merchant shows off wares on a counter; taking one is theft and comes out of their stock', () => {
  const { game, L, sid } = inCity(12345);
  const m = game.npcs.find((n) => !n.dead && n.layout === L && n.rec.job === 'merchant' && n.rec.work && n.rec.work.building != null);
  assert.ok(m, 'a shopkeeper');
  const biz = L.econ.biz[m.rec.work.building];
  const b = L.buildings.find((q) => q.id === m.rec.work.building);
  const w = game.world;
  // Stood by a counter of theirs.
  let spot = null;
  for (let x = b.x0 + 1; x < b.x1 && !spot; x++) {
    for (let z = b.z0 + 1; z < b.z1 && !spot; z++) {
      if (!w.canStand(x, GROUND, z)) continue;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const bl = w.getBlock(x + dx, GROUND, z + dz);
        if ((bl === B.table || bl === B.counter) && w.getBlock(x + dx, GROUND + 1, z + dz) === B.air) spot = { x, z };
      }
    }
  }
  assert.ok(spot, 'a counter in the shop');
  m.teleport(spot.x, GROUND, spot.z);
  biz.store.bread = 6;
  m.atGoal = true;
  m.path = null;
  m.wareT = 0;
  m.showWares(0.1);
  const shown = m.shownWares();
  assert.equal(shown.length, 1, 'one piece set out');
  const q = shown[0];
  assert.deepEqual(q.got.display, { sid, bid: m.rec.work.building });
  const item = q.got.item;
  const before = biz.store[item];
  // You take it, right in front of them.
  game.player.teleport(spot.x, GROUND, spot.z + 1);
  const got = game.takePlaced(q.x, q.y, q.z);
  game.tookPlaced(q.x, q.z, got);
  assert.equal(biz.store[item] || 0, before - 1, 'gone from their stock too');
  assert.ok(game.sim.justice.pendingIn(sid).some((c) => c.type === 'theft' && /display/.test(c.desc)), 'and that\'s theft');
});

// ------------------------------------------------------------ stables
test('a town with horses builds stables, and its horses stand in the stalls', () => {
  const game = makeGame(12345);
  const sim = game.sim;
  // (A town with a lot free for it: a full one waits for its streets to grow.)
  const L = game.world.ow.settlements.filter((s) => s.type === 'town').map((s) => game.world.getLayout(s)).find((q) => lotsReady(game, q, 'stables').length);
  Object.assign(stockOf(L), { wood: 200, stone: 200 });
  const p = sim.works.startBuilding(L, 'stables', '', false, 0);
  assert.ok(p, 'room for stables');
  sim.works.finishNow(L, p);
  const sb = L.buildings.find((b) => b.type === 'stables');
  assert.ok(sb && sb.stalls && sb.stalls.length >= 3, 'with stalls');
  assert.equal(sb.name, 'Stables');
  const st = sim.stables.of(L);
  st.horses = 3;
  st.horsesOut = 0;
  const at = sim.stables.standing(L);
  const inStalls = at.horses.filter((h) => h.stall);
  assert.equal(inStalls.length, 3, 'each horse in a stall');
  for (const h of inStalls) assert.ok(sb.stalls.some((q) => q.x === h.x && q.z === h.z));
});

// ------------------------------------------------------------ riding
test('a wild horse is won over with food, saddled, ridden, and hitched to your wagon', () => {
  const { game, input, p } = start(7);
  const w = game.world;
  assert.ok(['saddle', 'wagon'].every((k) => recipesFor('workbench').some((r) => r.out === k)), 'saddles and wagons are made at a workbench');
  const x = p.x + 30;
  const z = p.z;
  game.loadAround(x, z, true);
  p.teleport(x, w.findStandY(x, z, 6), z);
  const c = new Creature(game, 'horse', x + 1, w.findStandY(x + 1, z, p.y), z, 2);
  game.addCreature(c);
  // Won't come to you empty-handed.
  p.inv[p.selected] = null;
  game.riding.useHorse(c);
  assert.ok(!c.own);
  p.inv[p.selected] = { item: 'apple', count: 6 };
  let feeds = 0;
  while (!c.own && feeds++ < 6) game.riding.useHorse(c);
  assert.ok(c.own && feeds >= 2 && feeds <= 4, `tamed after ${feeds} apples`);
  // No saddle, no riding.
  p.inv[p.selected] = null;
  game.riding.useHorse(c);
  assert.ok(!p.mount);
  p.inv[p.selected] = { item: 'saddle', count: 1 };
  game.riding.useHorse(c);
  assert.ok(c.own.saddled);
  game.riding.useHorse(c);
  assert.equal(p.mount && p.mount.kind, 'horse');
  // Quicker than walking.
  const x0 = p.x;
  for (let i = 0; i < 30; i++) game.update(0.05, { ...input, isDown: (k) => k === 'KeyD' || k === 'ArrowRight', lastMoveKey: 'ArrowRight' });
  const rode = Math.abs(p.x - x0);
  assert.ok(rode >= 6, `rode ${rode} tiles in 1.5s`);
  game.riding.dismount();
  assert.ok(!p.mount);
  tick(game, input, 25, 0.05);
  const hc = game.creatures.find((q) => q.own && !q.dead);
  assert.ok(hc && hc.saddled, 'the horse waits where you left it');
  // A wagon of your own.
  p.inv[p.selected] = { item: 'wagon', count: 1 };
  assert.ok(game.riding.placeWagon(p.x, w.findStandY(p.x, p.z + 2, p.y), p.z + 2));
  tick(game, input, 25, 0.05);
  const prop = [...game.props.values()].find((q) => q.own);
  assert.ok(prop, 'it stands there');
  hc.teleport(prop.x + 1, prop.y, prop.z);
  game.riding.useWagon(prop);
  assert.equal(game.riding.wagons[0].horse, game.riding.horses[0].id, 'horse in the shafts');
  tick(game, input, 25, 0.05);
  const prop2 = [...game.props.values()].find((q) => q.own);
  game.riding.useWagon(prop2);
  assert.equal(p.mount && p.mount.kind, 'wagon', 'up on the bench');
  const g2 = reload(game);
  assert.equal(g2.player.mount && g2.player.mount.kind, 'wagon');
  assert.equal(g2.riding.horses.length, 1);
  assert.equal(g2.riding.wagons.length, 1);
});

test('you can climb into the back of anyone\'s wagon, and step down again', () => {
  const { game, p } = start(7);
  const prop = { x: p.x + 1, y: p.y, z: p.z, type: 'wagon' };
  game.riding.useWagon(prop);
  assert.equal(p.inWagon, prop);
  assert.ok(!p.mount, 'a passenger, not the driver');
  game.riding.climbOut();
  assert.ok(!p.inWagon);
});

// ------------------------------------------------------------ ruby flame
test('a ruby blade throws its flame toward the pointer, and sets alight whatever it catches', () => {
  const { game, p } = start(7);
  const w = game.world;
  const x = p.x + 30;
  const z = p.z;
  game.loadAround(x, z, true);
  p.teleport(x, w.findStandY(x, z, 6), z);
  p.inv[p.selected] = { item: 'iron_sword+ruby', count: 1 };
  const ahead = new Creature(game, 'rabbit', x + 2, w.findStandY(x + 2, z, p.y), z, 0);
  const behind = new Creature(game, 'rabbit', x - 2, w.findStandY(x - 2, z, p.y), z, 0);
  game.addCreature(ahead);
  game.addCreature(behind);
  // Pointing east (+x), whichever way you face.
  p.dir = 1;
  game.aimAngle = () => 0;
  onSwing(game, p, null);
  assert.equal(game.flames.length, 1);
  for (let i = 0; i < 10; i++) updateFlames(game, 0.05);
  assert.ok(ahead.burnT > 0 || ahead.dead, 'the one it was thrown at burns');
  assert.ok(!(behind.burnT > 0), 'the one behind you doesn\'t');
  // And the other way.
  game.aimAngle = () => Math.PI;
  onSwing(game, p, null);
  for (let i = 0; i < 10; i++) updateFlames(game, 0.05);
  assert.ok(behind.burnT > 0 || behind.dead);
});
