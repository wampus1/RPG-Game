import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGame, stubInput } from './helpers.mjs';
import { respond } from '../src/game/dialogue.js';
import { countItem, countAny, removeAny, makeSlots, addItem } from '../src/game/inventory.js';
import { RECIPES } from '../src/world/recipes.js';
import { checkWatch } from '../src/sim/civic.js';
import { RNG } from '../src/util/rng.js';
import { screenToWorld } from '../src/entities/player.js';

function start(seed = 7, minute = 9 * 60) {
  const game = makeGame(seed);
  const input = stubInput();
  game.minute = minute;
  for (let i = 0; i < 20; i++) game.update(0.1, input);
  const [sid, a] = [...game.active][0];
  game.player.give('coin', 300);
  return { game, input, sid, a, L: a.layout, p: game.player };
}

// Into the town hall, to talk business with the mayor.
function atHall(game, L) {
  const hall = L.buildings.find((b) => b.type === 'townhall');
  if (hall) game.player.teleport(hall.inside.x, 6, hall.inside.z);
  game.currentSettlement = L.settlement;
}

test('wooden recipes take any kind of planks or logs', () => {
  const stick = RECIPES.find((r) => r.out === 'stick');
  assert.ok(stick.in.planks);
  const inv = makeSlots(9);
  addItem(inv, 'planks_birch', 1);
  addItem(inv, 'planks_dark', 1);
  assert.equal(countAny(inv, 'planks'), 2, 'birch and dark planks both count as planks');
  const took = removeAny(inv, 'planks', 2);
  assert.equal(took.reduce((n, [, c]) => n + c, 0), 2);
  assert.equal(countAny(inv, 'planks'), 0);
  // Charcoal and log walls from any logs.
  assert.ok(RECIPES.find((r) => r.out === 'coal' && r.in.log));
  assert.ok(RECIPES.find((r) => r.out === 'log_wall' && r.in.log));
  addItem(inv, 'log_birch', 2);
  assert.equal(countAny(inv, 'log'), 2);
});

test('children don\'t hear what other towns wrote about you', () => {
  const { game, L, sid } = start();
  const kid = L.npcs.find((r) => r.age === 'child' && r.ent);
  const adult = L.npcs.find((r) => r.age === 'adult' && r.ent);
  const k0 = game.sim.opinion(kid.ent);
  const a0 = game.sim.opinion(adult.ent);
  game.sim.diplomacy.warnings.set(sid, [{ from: 0, fromName: 'Elsewhere', day: 1, crimes: 3, exiled: false }]);
  game.sim.areaCache.clear();
  assert.ok(game.sim.opinion(adult.ent) < a0, 'grown-ups think less of you');
  assert.equal(game.sim.opinion(kid.ent), k0, 'children don\'t know');
});

test('children play less and help a parent at work', () => {
  const { L } = start(12345);
  const tot = {};
  for (const r of L.npcs.filter((q) => q.age === 'child')) {
    const list = Array.isArray(r.schedule) ? r.schedule : Object.values(r.schedule)[0];
    for (const e of list) tot[e.act] = (tot[e.act] || 0) + (e.e - e.s);
  }
  assert.ok(tot.help > 0, 'some time helping');
  const free = (tot.play || 0) + (tot.help || 0) + (tot.wander || 0);
  assert.ok(tot.play / free < 0.8 && tot.play / free > 0.55, `play is about seven tenths of free time (${(tot.play / free).toFixed(2)})`);
});

test('camera turns: keys move you across the screen however it faces', () => {
  // W is up the screen: north when unturned, and a quarter turn later west.
  assert.deepEqual(screenToWorld(0, -1, 0), [0, -1]);
  assert.deepEqual(screenToWorld(0, -1, 1), [-1, 0]);
  assert.deepEqual(screenToWorld(0, -1, 2), [0, 1]);
  assert.deepEqual(screenToWorld(0, -1, 3), [1, 0]);
});

test('you count as a citizen, and as one of the watch, once sworn in', () => {
  const { game, a, L, p } = start();
  const s = L.settlement;
  const mayor = a.npcs.find((n) => n.rec.job === 'mayor');
  atHall(game, L);
  assert.equal(game.sim.playerCount(s.id), 0);
  respond(mayor, game, 'citizen', 'yes');
  assert.equal(game.sim.playerCount(s.id), 1, 'a citizen now');
  game.sim.changeRep(mayor, 30);
  respond(mayor, game, 'profession', 'take:guard');
  assert.equal(game.sim.playerGuard(s.id), 1, 'on the watch');
  // With you on the watch and every other guard gone, nobody is pressed into service.
  for (const r of L.npcs) if (r.job === 'guard') r.alive = false;
  assert.equal(checkWatch(game.sim, L, game.day, new RNG(3)), null);
  // The uniform: the town's colours, worn from the pack.
  const tab = p.inv.findIndex((q) => q && q.item.startsWith('tabard_'));
  assert.ok(tab >= 0);
  const want = s.civ ? `tabard_${s.civ.color.name.toLowerCase()}` : 'tabard_free';
  assert.equal(p.inv[tab].item, want);
  p.wear(tab);
  assert.ok(p.armorValue() > 0.1);
  // Losing citizenship costs the town a citizen (and you the post).
  game.sim.revoke('test');
  assert.equal(game.sim.playerCount(s.id), 0);
  assert.equal(game.sim.playerGuard(s.id), 0);
  assert.ok(!p.equip.body, 'the uniform went back');
  assert.ok(L.econ.ledger.some((it) => /lost a citizen/.test(it.text)));
});

test('the night watch pays a little more than the day', () => {
  const { game, a, L, p } = start();
  const mayor = a.npcs.find((n) => n.rec.job === 'mayor');
  atHall(game, L);
  respond(mayor, game, 'citizen', 'yes');
  game.sim.changeRep(mayor, 30);
  respond(mayor, game, 'profession', 'take:guard');
  const car = game.sim.careers;
  const j = car.job;
  L.econ.treasury = 1000;
  j.duty = 240;
  const day = car.payDuty(L, j, false);
  j.nightDuty = 240;
  const night = car.payDuty(L, j, true);
  assert.ok(night > day, `night ¤${night} > day ¤${day}`);
  void countItem;
  void p;
});
