import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGame, stubInput } from './helpers.mjs';
import { topicsFor, respond } from '../src/game/dialogue.js';
import { countItem } from '../src/game/inventory.js';
import { buildingAt } from '../src/sim/sim.js';
import { Creature } from '../src/entities/creature.js';
import { exchangeFor } from '../src/game/chatter.js';
import { playerProfile } from '../src/ui/windows.js';

// Seed 7 starts next to a village with two guards and a smithy.
function start(minute = 9 * 60) {
  const game = makeGame(7);
  const input = stubInput();
  game.minute = minute;
  for (let i = 0; i < 20; i++) game.update(0.1, input);
  const [sid, a] = [...game.active][0];
  game.player.give('coin', 300);
  return { game, input, sid, a, L: a.layout, p: game.player };
}

function walk(game, input, p, dx, steps) {
  for (let k = 0; k < steps; k++) {
    const nx = p.x + dx;
    const ny = game.world.stepTarget(p.x, p.y, p.z, nx, p.z, false);
    if (ny >= 0 && !game.occupiedBySolid(nx, ny, p.z, p)) {
      p.teleport(nx, ny, p.z);
      game.onPlayerStep(nx, ny, p.z, false);
    }
    for (let i = 0; i < 3; i++) game.update(0.1, input);
  }
}

test('citizens can join the watch: kit, uniform, armor, patrol pay and a new title', () => {
  const { game, input, a, L, p } = start();
  const mayor = a.npcs.find((n) => n.rec.job === 'mayor');
  const hall = L.buildings.find((b) => b.type === 'townhall');
  p.teleport(hall.inside.x, 6, hall.inside.z);
  game.currentSettlement = L.settlement;
  assert.equal(playerProfile(game).title, 'Adventurer');
  assert.ok(topicsFor(mayor, game).some((t) => t.id === 'profession'));
  assert.match(respond(mayor, game, 'profession', 'ask:guard').lines.join(' '), /Only citizens/);
  respond(mayor, game, 'citizen', 'yes');
  assert.equal(playerProfile(game).title, `Citizen of ${L.settlement.name}`);
  game.sim.changeRep(mayor, 20);
  const offer = respond(mayor, game, 'profession', 'ask:guard');
  assert.ok(offer.choices.some((c) => c.arg === 'take:guard'));
  respond(mayor, game, 'profession', 'take:guard');
  assert.equal(playerProfile(game).job, `Town Guard of ${L.settlement.name}`);
  for (const k of ['iron_sword', 'bow', 'arrow', 'guard_badge']) assert.ok(countItem(p.inv, k) > 0, `kit has ${k}`);
  assert.equal(p.look.outfit, 'guard');
  const hp = p.hp;
  game.damage(p, 8, null);
  assert.ok(hp - p.hp < 8, 'the uniform softens blows');
  p.hp = p.maxHp;
  // Walk the beat until evening: duty is paid from the treasury at 20:00.
  const coins = countItem(p.inv, 'coin');
  for (let i = 0; i < 6000 && game.minute < 20 * 60 + 2; i++) {
    if (i % 20 === 0) game.onPlayerStep(p.x, p.y, p.z, false);
    game.update(0.25, input);
  }
  assert.ok(countItem(p.inv, 'coin') > coins, 'paid for the patrol');
  assert.ok(game.ui.msgs.some((m) => /Guard pay/.test(m)));
  // A conviction here costs you the post and the uniform.
  game.sim.careers.onConviction(L.settlement.id);
  assert.equal(game.sim.careers.job, null);
  assert.notEqual(p.look.outfit, 'guard');
});

test('licensed trades: a fee, a premium on goods, and the town\'s fields and snares', () => {
  const { game, a, L, p } = start();
  const mayor = a.npcs.find((n) => n.rec.job === 'mayor');
  const cook = a.npcs.find((n) => n.rec.job === 'cook');
  const coins = countItem(p.inv, 'coin');
  respond(mayor, game, 'profession', 'take:trapper');
  assert.ok(game.sim.careers.licensed('trapper', L.settlement.id));
  assert.ok(countItem(p.inv, 'coin') < coins, 'licence fee paid');
  assert.ok(countItem(p.inv, 'snare') >= 2, 'starter snares');
  assert.ok(game.sim.careers.sellFactor(cook, 'raw_meat') > 1);
  assert.equal(game.sim.careers.sellFactor(cook, 'bread'), 1);
  respond(mayor, game, 'profession', 'take:farmer');
  assert.ok(game.sim.careers.licensed('farmer', L.settlement.id), 'a new trade replaces the old one');
  assert.ok(!game.sim.careers.licensed('trapper', L.settlement.id));
});

test('working at a shop: chores, customers, the shop\'s chests, pay for work done, getting fired', () => {
  const { game, input, a, L, p } = start(7 * 60);
  const car = game.sim.careers;
  const smith = a.npcs.find((n) => n.rec.job === 'blacksmith');
  assert.ok(car.canEmploy(smith));
  game.sim.changeRep(smith, 30);
  L.econ.biz[smith.rec.work.building].till = 150;
  const terms = respond(smith, game, 'job');
  assert.ok(terms.choices.some((c) => c.arg === 'yes'), terms.lines.join(' '));
  respond(smith, game, 'job', 'yes');
  const j = car.job;
  assert.equal(j.kind, 'employee');
  assert.match(car.title(), /Smith/);
  const b = L.buildings[j.building];
  p.teleport(b.inside.x, 6, b.inside.z);
  assert.equal(buildingAt(L, p.x, p.z), b);
  for (let i = 0; i < 800 && !j.chores; i++) game.update(0.2, input);
  assert.ok(j.chores && j.chores.length >= 2, 'chores for the day');
  // Opening the shop's chests on shift is work, not theft.
  const stock = j.chores.filter((c) => c.kind === 'stock');
  for (const c of stock) game.interact(c.x, c.y, c.z);
  assert.equal(j.tasks, stock.length);
  assert.equal(game.sim.justice.pendingIn(L.settlement.id).length, 0);
  assert.equal(game.containerOwner(stock[0].x, stock[0].y, stock[0].z).kind, 'work');
  // Customers come in and get served from the shop's stock.
  let served = 0;
  for (let i = 0; i < 5000 && !served && game.minute < j.shift[1] - 30; i++) {
    game.update(0.2, input);
    const c = car.customer;
    if (c && c.arrived) {
      const n = a.npcs.find((q) => q.rec.idx === c.idx);
      assert.ok(topicsFor(n, game).some((t) => t.id === 'serve'));
      L.econ.biz[j.building].store[c.item] = (L.econ.biz[j.building].store[c.item] || 0) + c.count;
      respond(n, game, 'serve');
      served++;
    }
  }
  assert.ok(served, 'a customer was served');
  const done = j.tasks;
  const coins = countItem(p.inv, 'coin');
  for (let i = 0; i < 20000 && game.minute < j.shift[1] + 2; i++) game.update(0.25, input);
  const wage = countItem(p.inv, 'coin') - coins;
  assert.ok(wage >= done * j.wage * 0.9, `wages ${wage} for ${done} tasks`);
  assert.ok(car.discount(smith) < 1, 'staff discount');
  // Insulting the boss ends it.
  respond(smith, game, 'rude');
  assert.equal(car.job, null);
});

test('a hired guard follows you, fights beasts, survives a save and goes home after', () => {
  const { game, input, a, p } = start(10 * 60);
  const car = game.sim.careers;
  const guard = a.npcs.find((n) => n.rec.job === 'guard');
  p.teleport(guard.x + 1, guard.y, guard.z);
  const offer = respond(guard, game, 'hire');
  assert.equal(offer.choices.length, 4);
  respond(guard, game, 'hire', '12');
  assert.equal(guard.state, 'hired');
  assert.ok(!a.npcs.includes(guard), 'no longer part of the town roster');
  walk(game, input, p, 1, 12);
  for (let i = 0; i < 60; i++) game.update(0.1, input);
  assert.ok(guard.distTo(p) <= 3, `escort is ${guard.distTo(p)} tiles away`);
  const wolf = new Creature(game, 'wolf', p.x + 3, p.y, p.z + 1);
  game.addCreature(wolf);
  for (let i = 0; i < 300 && !wolf.dead; i++) {
    p.hp = p.maxHp;
    game.update(0.1, input);
  }
  assert.ok(wolf.dead, 'the escort killed the wolf');
  const data = JSON.parse(JSON.stringify(game.serialize()));
  const g2 = new game.constructor({ seed: data.seed, renderer: game.renderer, audio: null, ui: game.ui, save: data });
  for (let i = 0; i < 5; i++) g2.update(0.1, input);
  const e2 = g2.sim.careers.ent;
  assert.ok(e2 && e2.state === 'hired' && e2.distTo(g2.player) <= 3, 'escort restored beside you');
  for (let i = 0; i < 20000 && car.escort; i++) game.update(0.25, input);
  assert.equal(car.escort, null, 'contract ran out');
  assert.ok(guard.state === 'routine' || guard.state === 'leaving');
});

test('favors: fetch, deliver a letter, slay beasts; lapsed requests disappoint', () => {
  const { game, a, p } = start(12 * 60);
  const fav = game.sim.favors;
  const offers = a.npcs.map((n) => [n, fav.offer(n)]).filter(([, o]) => !o.none);
  assert.ok(offers.length >= 3, 'people ask for help');
  const [fn, fo] = offers.find(([, o]) => o.kind === 'fetch' && o.item !== 'food');
  respond(fn, game, 'favor_accept');
  assert.ok(topicsFor(fn, game).some((t) => t.id === 'favor_check'));
  while (countItem(p.inv, fo.item)) p.inv[p.inv.findIndex((s) => s && s.item === fo.item)] = null;
  assert.match(respond(fn, game, 'favor_check').lines[0], /Still waiting/);
  p.give(fo.item, fo.count);
  const before = game.sim.opinion(fn);
  respond(fn, game, 'favor_check');
  assert.equal(countItem(p.inv, fo.item), 0, 'items handed over');
  assert.ok(game.sim.opinion(fn) > before);
  assert.equal(fav.given(fn), null);
  // A letter.
  const [dn] = offers.find(([, o]) => o.kind === 'deliver') || [];
  if (dn) {
    const f = respond(dn, game, 'favor_accept') && fav.given(dn);
    assert.equal(countItem(p.inv, 'letter'), 1);
    const to = a.npcs.find((n) => n.rec.idx === f.to);
    assert.ok(topicsFor(to, game).some((t) => t.id === 'deliver'));
    respond(to, game, 'deliver');
    assert.equal(countItem(p.inv, 'letter'), 0);
    assert.equal(fav.given(dn), null);
  }
  // Beasts slain near town count toward a slaying request.
  const slayer = a.npcs.find((n) => n.rec.job === 'guard' && !fav.given(n));
  fav.list.push({ id: 99, sid: slayer.settlement.id, town: 'x', giver: slayer.rec.idx, giverName: 'x', kind: 'slay', count: 2, kills: 0, coins: 4, rep: 8, day: game.day, due: game.day + 2, official: true, b: { x0: p.x - 40, z0: p.z - 40, x1: p.x + 40, z1: p.z + 40 } });
  for (let i = 0; i < 2; i++) {
    const s = new Creature(game, 'slime', p.x + 2, p.y, p.z);
    game.addCreature(s);
    game.kill(s, p);
  }
  assert.ok(respond(slayer, game, 'favor_check').lines[0].includes('quieter'));
  // Lapsed requests go away and cost a little goodwill.
  const [ln] = offers.find(([n, o]) => n !== fn && n !== dn && o.kind === 'fetch') || [];
  if (ln) {
    respond(ln, game, 'favor_accept');
    const op = game.sim.opinion(ln);
    game.day += 6;
    fav.update();
    assert.equal(fav.given(ln), null);
    assert.ok(game.sim.opinion(ln) < op);
  }
});

test('conversation follow-ups, questions back, and villagers chatting among themselves', () => {
  const { game, input, a } = start(12 * 60);
  const n = a.npcs.find((q) => q.rec.age === 'adult' && q.rec.job !== 'guard' && q.rec.job !== 'mayor');
  const who = respond(n, game, 'who');
  assert.ok(who.choices.some((c) => c.id === 'work'));
  assert.ok(respond(n, game, 'work').lines.length >= 1);
  // Chatty people ask something back; answers matter.
  let asked = null;
  for (const q of a.npcs.filter((x) => x.rec.age === 'adult')) {
    const r = respond(q, game, 'kind');
    if (r.choices) {
      asked = [q, r];
      break;
    }
  }
  assert.ok(asked, 'someone asked a question');
  const [q, r] = asked;
  assert.ok(r.choices.every((c) => c.id === 'answer'));
  assert.ok(respond(q, game, 'answer', r.choices[0].arg).lines[0].length > 0);
  // Two neighbours exchange a few lines.
  const [x, y] = a.npcs;
  const lines = exchangeFor(x, y, game);
  assert.ok(lines.length >= 2 && lines.every((l) => typeof l === 'string' && l.length));
  let heard = 0;
  for (let i = 0; i < 3000 && !heard; i++) {
    game.update(0.1, input);
    heard = game.chatter && game.chatter.queue.length;
  }
  assert.ok(heard, 'an ambient conversation started');
});
