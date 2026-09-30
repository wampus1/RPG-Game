import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGame, stubInput } from './helpers.mjs';
import { topicsFor, respond } from '../src/game/dialogue.js';
import { countItem } from '../src/game/inventory.js';
import { B, CROPS, cropStage, cropMature } from '../src/world/blocks.js';
import { alive } from '../src/sim/econ.js';
import { SPECIES, Creature } from '../src/entities/creature.js';

function start(seed = 7, minute = 9 * 60) {
  const game = makeGame(seed);
  const input = stubInput();
  game.minute = minute;
  for (let i = 0; i < 20; i++) game.update(0.1, input);
  const [sid, a] = [...game.active][0];
  game.player.give('coin', 300);
  return { game, input, sid, a, L: a.layout, p: game.player, w: game.world };
}

const rng = { next: () => 0.3, chance: () => false };

test('crops grow through stages over days; unripe gives seeds, a hoe gives more', () => {
  const { game, L, w, p } = start(12345, 8 * 60);
  const f = L.fields[0];
  let spot = null;
  for (let z = f.z0; z <= f.z1 && !spot; z++) for (let x = f.x0; x <= f.x1; x++) if (w.getBlock(x, 5, z) === B.farmland) spot = spot || { x, z };
  w.setBlock(spot.x, 6, spot.z, B.air);
  assert.ok(game.canPlace(B.wheat_crop, spot.x, 6, spot.z));
  assert.ok(!game.canPlace(B.wheat_crop, p.x, p.y, p.z + 40), 'crops need farmland');
  game.crops.plant(spot.x, 6, spot.z, B.wheat_crop);
  const seen = new Set();
  for (let h = 0; h < 80; h += 4) {
    game.minute += 240;
    if (game.minute >= 1440) {
      game.minute -= 1440;
      game.day++;
    }
    game.crops.t = 0;
    game.crops.update(0.1);
    seen.add(cropStage(w.getMeta(spot.x, 6, spot.z)));
  }
  assert.equal(seen.size, CROPS[B.wheat_crop].stages, `stages seen: ${[...seen]}`);
  assert.ok(cropMature(B.wheat_crop, w.getMeta(spot.x, 6, spot.z)));
  const ripe = game.crops.harvest(B.wheat_crop, w.getMeta(spot.x, 6, spot.z), false, () => 0.99);
  const hoe = game.crops.harvest(B.wheat_crop, w.getMeta(spot.x, 6, spot.z), true, () => 0.99);
  assert.ok(hoe.find((d) => d.item === 'wheat').count > ripe.find((d) => d.item === 'wheat').count, 'hoes yield extra');
  assert.deepEqual(game.crops.harvest(B.wheat_crop, 0, true), [{ item: 'seeds', count: 1 }], 'unripe crops give their seed back');
  // A growing crop survives a save.
  game.crops.plant(spot.x, 6, spot.z, B.cabbage_crop);
  const data = JSON.parse(JSON.stringify(game.serialize()));
  const g2 = new game.constructor({ seed: data.seed, renderer: game.renderer, audio: null, ui: game.ui, save: data });
  assert.ok(g2.crops.list.size >= 1);
});

test('farmers harvest ripe fields and sow them again', () => {
  const { game, input, L, w } = start(12345, 9 * 60);
  const count = () => {
    let ripe = 0;
    let young = 0;
    for (const f of L.fields) for (let z = f.z0; z <= f.z1; z++) for (let x = f.x0; x <= f.x1; x++) {
      const id = w.getBlock(x, 6, z);
      if (CROPS[id]) cropMature(id, w.getMeta(x, 6, z)) ? ripe++ : young++;
    }
    return { ripe, young };
  };
  const before = count();
  for (let i = 0; i < 2500; i++) game.update(0.2, input);
  const after = count();
  assert.ok(after.ripe < before.ripe, `harvested (${before.ripe} -> ${after.ripe})`);
  assert.ok(after.young > before.young, 'resown');
});

test('wolves are weaker; trappers fight beasts with a blade and set their own snares', () => {
  assert.ok(SPECIES.wolf.hp <= 9 && SPECIES.wolf.dmg <= 2);
  const { game, a, w } = start(12345, 10 * 60);
  const tr = a.npcs.find((n) => n.rec.job === 'trapper');
  const wolf = new Creature(game, 'wolf', tr.x + 1, tr.y, tr.z);
  game.addCreature(wolf);
  tr.react(wolf, false);
  assert.equal(tr.state, 'fight');
  wolf.teleport(tr.x + 1, tr.y, tr.z);
  assert.ok(['stone_sword', 'iron_sword'].includes(tr.heldItem()), `holds ${tr.heldItem()}`);
  tr.calmDown(true);
  // At a hunting ground, a fresh snare goes down beside them.
  const spot = tr.layout.spotsByTag('hunt').find((s) => !s.trap && w.findStandY(s.x, s.z, 6) > 0);
  tr.teleport(spot.x, w.findStandY(spot.x, spot.z, 6), spot.z);
  assert.ok(tr.laySnare(), 'laid a snare');
  const s = tr.rec.snares[0];
  assert.equal(w.getBlock(s.x, s.y, s.z), B.snare);
  assert.ok(tr.ownSnareGoal().trap);
});

test('a town without guards finds one, and one that cannot is deserted', () => {
  const { game, sid, L } = start(12345);
  for (const r of L.npcs) if (r.job === 'guard') r.alive = false;
  game.sim.dailyCivic(L, game.day, rng);
  const guards = L.npcs.filter((r) => alive(r) && r.job === 'guard');
  assert.equal(guards.length, 1);
  assert.ok(guards[0].age === 'adult' && guards[0].look.hat === 'helmet');
  for (const r of L.npcs) if (r.age === 'adult') r.alive = false;
  game.sim.dailyCivic(L, game.day, rng);
  assert.ok(L.settlement.deserted, 'deserted');
  const T = [...game.world.layouts.values()].find((q) => q.npcs.some((r) => r.from === sid));
  assert.ok(T && T.settlement.id !== sid, 'moved to another settlement');
  const data = JSON.parse(JSON.stringify(game.serialize()));
  const g2 = new game.constructor({ seed: data.seed, renderer: game.renderer, audio: null, ui: game.ui, save: data });
  assert.ok(g2.world.ow.settlements[sid].deserted);
  const T2 = g2.world.getLayout(g2.world.ow.settlements[T.settlement.id]);
  assert.equal(T2.npcs.filter((r) => r.from === sid).length, T.npcs.filter((r) => r.from === sid).length, 'newcomers are saved');
});

test('the town hall chests hold the treasury', () => {
  const { game, input, L, w } = start();
  const coins = () => L.treasury.reduce((n, t) => n + w.getContainer(t.x, t.y, t.z).reduce((m, q) => m + (q && q.item === 'coin' ? q.count : 0), 0), 0);
  assert.ok(L.treasury.length >= 1);
  assert.equal(coins(), Math.floor(L.econ.treasury));
  const sl = w.getContainer(L.treasury[0].x, L.treasury[0].y, L.treasury[0].z);
  sl[sl.findIndex((q) => q && q.item === 'coin')].count -= 40;
  const t0 = L.econ.treasury;
  for (let i = 0; i < 10; i++) game.update(0.1, input);
  assert.equal(L.econ.treasury, t0 - 40, 'taking coins empties the treasury');
  L.econ.treasury += 25;
  for (let i = 0; i < 10; i++) game.update(0.1, input);
  assert.equal(coins(), Math.floor(L.econ.treasury), 'town income shows up in the chest');
});

test('witnesses need a line of sight', () => {
  const { game, sid, a, L } = start();
  const n = a.npcs.find((q) => !q.sleeping && q.rec.age === 'adult');
  const b = L.buildings.find((q) => q.residential && q.homeSpots.length);
  // Standing inside a closed house: someone outside, beyond the wall, can't see in.
  const inside = b.homeSpots[0];
  n.teleport(b.x0 - 3, 6, inside.z);
  n.face(inside.x, inside.z);
  const doorOpen = game.world.getState(b.door.x, 6, b.door.z);
  if (!doorOpen) assert.ok(!game.sim.canSee(n, inside.x, inside.z), 'walls block sight');
  // Out in the open, in front of them: seen. Behind their back: not.
  const px = n.x;
  const pz = n.z + 4;
  n.face(px, pz);
  assert.ok(game.sim.canSee(n, px, pz) || !game.sim.lineOfSight(n.x, n.z, px, pz, 7));
  n.face(px, n.z - 4);
  assert.ok(!game.sim.canSee(n, px, pz), 'looking the other way');
  assert.ok(game.sim.canSee(n, n.x, n.z + 1), 'right beside them');
  void sid;
});

test('jailbreaks make you wanted and the jail is repaired', () => {
  const { game, input, sid, a, L, w } = start(7, 10 * 60);
  const j = game.sim.justice;
  const n = a.npcs.find((q) => q.rec.job !== 'guard');
  j.commit(sid, 'theft', { witnesses: [n], value: 3 });
  j.imprison(sid, 'surrender', true);
  const bar = L.jail.blocks.find((q) => q[3] === B.iron_bars);
  w.setBlock(bar[0], bar[1], bar[2], B.air);
  w.setBlock(bar[0], bar[1] + 1, bar[2], B.air);
  game.player.teleport(bar[0], 6, bar[2]);
  for (let i = 0; i < 5; i++) game.update(0.1, input);
  assert.equal(j.jail, null);
  assert.ok(game.isWanted(sid));
  assert.ok(j.pendingIn(sid).some((c) => c.type === 'jailbreak' && c.guardSaw), 'the empty cell is proof enough');
  game.player.teleport(L.bounds.x1 + 30, 6, L.bounds.z1 + 20);
  game.loadAround(game.player.x, game.player.z, true);
  for (let i = 0; i < 1500; i++) {
    game.update(0.2, input);
    game.player.hp = game.player.maxHp;
  }
  assert.equal(w.getBlock(bar[0], bar[1], bar[2]), B.iron_bars, 'bars restored');
});

test('guards may bear arms, lose the post on trial, and for insulting the mayor', () => {
  const { game, input, sid, a, L, p } = start(7, 10 * 60);
  const mayor = a.npcs.find((n) => n.rec.job === 'mayor');
  game.sim.join(mayor);
  game.sim.changeRep(mayor, 30);
  respond(mayor, game, 'profession', 'take:guard');
  assert.ok(game.sim.careers.isGuard(sid));
  L.econ.laws.armsBan = true;
  p.selected = p.inv.findIndex((q) => q && q.item === 'iron_sword');
  const guard = a.npcs.find((n) => n.rec.job === 'guard');
  p.teleport(guard.x + 1, guard.y, guard.z);
  for (let i = 0; i < 40; i++) game.update(0.3, input);
  assert.ok(!game.sim.justice.pendingIn(sid).some((c) => c.type === 'brandishing'), 'guards may carry weapons');
  // On trial: the post, badge and kit go.
  const n = a.npcs.find((q) => q.rec.job !== 'guard' && q.rec.job !== 'mayor');
  game.sim.justice.commit(sid, 'theft', { witnesses: [n], value: 3 });
  game.sim.justice.imprison(sid, 'surrender', true);
  const v = game.sim.justice.verdict();
  assert.ok(v.stripped);
  assert.ok(!game.sim.careers.isGuard(sid));
  assert.equal(countItem(p.inv, 'guard_badge'), 0);
  assert.ok(!(game.sim.justice.held?.items || []).some((q) => q.item === 'guard_badge'));
  // Insulting the mayor can cost a guard the post.
  game.sim.justice.jail = null;
  game.sim.justice.pending.clear();
  game.wanted.clear();
  game.sim.careers.job = null;
  game.sim.careers.kits.clear();
  game.sim.changeRep(mayor, 100);
  game.sim.justice.record.clear();
  respond(mayor, game, 'profession', 'take:guard');
  assert.ok(game.sim.careers.isGuard(sid));
  mayor.rec.personality.temper = 1;
  for (let i = 0; i < 20 && game.sim.careers.isGuard(sid); i++) respond(mayor, game, 'rude');
  assert.ok(!game.sim.careers.isGuard(sid), 'kicked off the watch');
});

test('companions, favour cooldowns, customers and discounts', () => {
  const { game, input, a, p } = start(4, 9 * 60);
  const car = game.sim.careers;
  const friend = a.npcs.find((n) => n.rec.age === 'adult' && !['guard', 'mayor'].includes(n.rec.job) && !(n.rec.grief || []).length);
  assert.ok(!topicsFor(friend, game).some((t) => t.id === 'companion'));
  game.sim.changeRep(friend, 90);
  assert.ok(topicsFor(friend, game).some((t) => t.id === 'companion'));
  respond(friend, game, 'companion', 'yes');
  assert.equal(friend.state, 'hired');
  assert.ok(car.escort.companion);
  respond(friend, game, 'dismiss');
  assert.equal(car.escort, null);
  // A favour done: no new one for a day or so.
  const fav = game.sim.favors;
  const giver = a.npcs.find((n) => fav.offer(n).kind === 'fetch' && fav.offer(n).item !== 'food');
  const o = fav.offer(giver);
  respond(giver, game, 'favor_accept');
  p.give(o.item, o.count);
  respond(giver, game, 'favor_check');
  assert.equal(fav.offer(giver).none, 'recent');
  // Townsfolk come to buy from a licensed trapper.
  const mayor = a.npcs.find((n) => n.rec.job === 'mayor');
  respond(mayor, game, 'profession', 'take:trapper');
  p.give('raw_meat', 5);
  car.nextCustomer = game.sim.abs;
  let c = null;
  for (let i = 0; i < 3000 && !c; i++) {
    game.update(0.2, input);
    if (car.customer && car.customer.arrived) c = car.customer;
  }
  assert.ok(c, 'a customer came');
  const buyer = a.npcs.find((n) => n.rec.idx === c.idx);
  assert.ok(topicsFor(buyer, game).some((t) => t.id === 'serve'));
  // Discounts: friends and citizens pay less than the asking price.
  const shop = a.npcs.find((n) => n.rec.job === 'blacksmith');
  game.sim.changeRep(shop, 60);
  const parts = game.sim.priceParts(shop);
  assert.ok(parts.discount < 1 && parts.reasons.includes('friend'));
  assert.ok(game.sim.priceFactor(shop) < parts.base);
});

test('a hated citizen is confronted by the mayor, then expelled', () => {
  const { game, input, a, L } = start(7, 9 * 60);
  const mayor = a.npcs.find((n) => n.rec.job === 'mayor');
  game.sim.join(mayor);
  for (const n of a.npcs) game.sim.changeRep(n, -90);
  game.sim.dailyCivic(L, game.day, rng);
  assert.equal(game.sim.confront.stage, 'warn');
  let opened = null;
  game.ui.openDialogue = (n) => {
    opened = n;
  };
  for (let i = 0; i < 3000 && !opened; i++) game.update(0.2, input);
  assert.equal(opened, mayor, 'the mayor came over');
  assert.deepEqual(topicsFor(mayor, game).map((t) => t.arg), ['promise', 'defy']);
  respond(mayor, game, 'conduct', 'promise');
  assert.equal(game.sim.citizen.warned, game.day);
  game.day += 4;
  game.sim.dailyCivic(L, game.day, rng);
  assert.equal(game.sim.confront.stage, 'expel');
  respond(mayor, game, 'conduct');
  assert.equal(game.sim.citizen, null);
});

test('plaza paving continues under benches and wells', () => {
  const { L, w } = start(12345);
  const p = L.plaza;
  const plazaBlock = w.getBlock(p.x0 + 1, 5, p.z0 + 1);
  const under = w.getBlock(p.cx, 5, p.cz);
  assert.equal(under, plazaBlock, 'under the centrepiece');
  const bench = L.spots.find((s) => s.seat && s.x >= p.x0 && s.x <= p.x1 && s.z >= p.z0 && s.z <= p.z1 && w.getBlock(s.x, 6, s.z) === B.bench);
  if (bench) assert.equal(w.getBlock(bench.x, 5, bench.z), plazaBlock, 'under a bench');
});
