import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGame, stubInput } from './helpers.mjs';
import { Creature } from '../src/entities/creature.js';
import { B } from '../src/world/blocks.js';
import { DAY, tickHour, ledger, simulateTo, glutFactor, GLUT_MAX, CHILDHOOD, oldAgeRisk, alive } from '../src/sim/econ.js';
import { aging, comingOfAge } from '../src/sim/life.js';
import { RNG } from '../src/util/rng.js';

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
  const g2 = makeGame(game.seed);
  g2.applySave(data);
  return g2;
};

test('selling: the more of a thing a trader has, the less they pay, until they want no more', () => {
  const { game, a } = start(8);
  const smith = a.npcs.find((n) => n.rec.job === 'blacksmith');
  const sh = game.sim.shopOf(smith);
  // A book is no use to a smith: each one they already have takes the price down.
  const prices = [];
  for (let have = 0; have <= GLUT_MAX; have++) {
    sh.store.book = have;
    prices.push(game.sim.sellPrice(smith, 'book'));
  }
  assert.ok(prices[0] > 0);
  for (let i = 1; i < prices.length; i++) assert.ok(prices[i] <= prices[i - 1], prices.join());
  assert.ok(prices[5] < prices[0], prices.join());
  assert.equal(prices[GLUT_MAX], 0, 'they won\'t take any more');
  // Ore is what a smithy runs on: they'll take any amount at full price.
  sh.store.iron_ore = 0;
  const ore = game.sim.sellPrice(smith, 'iron_ore');
  sh.store.iron_ore = 60;
  assert.equal(game.sim.sellPrice(smith, 'iron_ore'), ore);
  // Same for fish at a cook's, but not sticks at a general store.
  assert.equal(glutFactor('cook', 'fish', 50), 1);
  assert.equal(glutFactor('general', 'stick', 2), 1);
  assert.ok(glutFactor('general', 'stick', 5) < 1);
  assert.equal(glutFactor('general', 'stick', GLUT_MAX), 0);
});

test('selling: a trader\'s glut clears over a few days, and they buy again', () => {
  const { game, a, L } = start(8);
  const smith = a.npcs.find((n) => n.rec.job === 'blacksmith');
  const sh = game.sim.shopOf(smith);
  sh.store.book = GLUT_MAX;
  assert.equal(game.sim.sellPrice(smith, 'book'), 0);
  const till = L.econ.biz[smith.rec.work.building].till;
  for (let d = 1; d <= 6; d++) tickHour(game.sim, L, (game.day + d) * DAY + 6 * 60);
  assert.ok((sh.store.book || 0) <= 3, `still ${sh.store.book}`);
  assert.ok(game.sim.sellPrice(smith, 'book') > 0);
  assert.ok(L.econ.biz[smith.rec.work.building].till > till - 200, 'sold on, not thrown away');
  // Ore piles up as it likes.
  sh.store.iron_ore = 40;
  tickHour(game.sim, L, (game.day + 7) * DAY + 6 * 60);
  assert.ok(sh.store.iron_ore >= 40);
});

test('saving works when a street had a lot it could not lay out', () => {
  const { game, L } = start();
  L.plots.push(null);
  assert.doesNotThrow(() => game.serialize());
  const g2 = reload(game);
  assert.ok(g2.player);
});

test('the notice board: news caught up from afar goes up in the order it happened', () => {
  const { game } = start();
  const far = game.world.ow.settlements.find((s) => !game.active.has(s.id));
  const L = game.sim.layoutOf(far.id);
  ledger(L, 40, 'late');
  ledger(L, 38, 'early');
  ledger(L, 39, 'middle');
  const tail = L.econ.ledger.slice(-3).map((l) => l.text);
  assert.deepEqual(tail, ['early', 'middle', 'late']);
  // A town caught up over a fortnight: never a day out of order.
  const T = game.sim.layoutOf(game.world.ow.settlements.find((s) => !game.active.has(s.id) && s.id !== far.id).id);
  game.day = 14;
  simulateTo(game.sim, T, 14 * DAY);
  const days = T.econ.ledger.map((l) => l.day);
  for (let i = 1; i < days.length; i++) assert.ok(days[i] >= days[i - 1], `day ${days[i]} after ${days[i - 1]}`);
});

test('beasts near you keep pace when time races; far-off ones idle on', () => {
  const { game, input, p } = start(7, 22 * 60);
  const near = new Creature(game, 'rabbit', p.x + 5, p.y, p.z + 5);
  const far = new Creature(game, 'rabbit', p.x + 200, p.y, p.z + 200);
  game.creatures.push(near, far);
  const calls = new Map([[near, 0], [far, 0]]);
  for (const c of [near, far]) {
    const u = c.update.bind(c);
    c.update = (dt) => {
      calls.set(c, calls.get(c) + dt);
      return u(dt);
    };
  }
  game.sleepFast = 60;
  game.update(0.1, input);
  game.sleepFast = 0;
  assert.ok(calls.get(near) >= 1, `near: ${calls.get(near)}`);
  assert.ok(calls.get(far) <= 0.1 + 1e-9, `far: ${calls.get(far)}`);
});

test('nomads camp outside town in tents while they decide, and strike camp when they go', () => {
  const { game, input, L } = start();
  let b = null;
  for (let d = 0; d < 400 && !b; d++) b = game.sim.nomads.arrive(L, game.day + d, new RNG(d));
  b.arrive = game.sim.abs - 1;
  b.decide = game.sim.abs + 600;
  for (let i = 0; i < 400; i++) game.update(0.25, input);
  const c = game.sim.camps.get(`n:${b.id}`);
  assert.ok(c, 'a camp');
  assert.ok(c.placed > 0, 'going up (a piece at a time, with them there)');
  const tents = c.ops.filter((o) => o[3] === B.tent);
  assert.ok(tents.length >= 1 && c.ops.some((o) => o[3] === B.campfire));
  for (const o of c.ops) assert.equal(game.world.ow.settlementAt(o[0], o[2]), null, 'outside town');
  for (const o of c.ops.slice(0, c.placed)) assert.equal(game.world.getBlock(o[0], o[1], o[2]), o[3]);
  assert.ok(L.econ.ledger.some((l) => /camped outside town/.test(l.text)));
  // It survives a save.
  const g2 = reload(game);
  assert.ok(g2.sim.camps.get(`n:${b.id}`));
  // They make up their minds: down come the tents.
  b.decide = game.sim.abs - 1;
  game.sim.nomads.update();
  assert.equal(game.sim.camps.get(`n:${b.id}`), null);
  for (const o of c.ops.slice(0, c.placed)) assert.equal(game.world.getBlock(o[0], o[1], o[2]), B.air);
});

test('a visiting merchant pitches a tent for their stay (in a town you\'re not in, it\'s simply up)', () => {
  const { game } = start();
  const far = game.world.ow.settlements.find((s) => !game.active.has(s.id));
  const L = game.sim.layoutOf(far.id);
  const c = game.sim.camps.pitch(L, 'v:test', 'merchant', 1, game.sim.abs + 600, 5);
  assert.ok(c);
  assert.equal(c.placed, c.ops.length);
  assert.ok(c.ops.some((o) => o[3] === B.tent) && c.ops.some((o) => o[3] === B.crate));
  for (const o of c.ops) assert.equal(game.world.ow.settlementAt(o[0], o[2]), null);
  // Striped canvas: a merchant's tent.
  assert.ok(c.ops.find((o) => o[3] === B.tent)[4] & 4);
  game.minute += 700;
  game.sim.camps.update(0.5, () => []);
  assert.equal(game.sim.camps.get('v:test'), null, 'gone when they leave');
});

test('people grow up and grow old: the hard trades are given up, and old age carries elders off', () => {
  const { game } = start();
  const far = game.world.ow.settlements.find((s) => !game.active.has(s.id) && s.type !== 'village') || game.world.ow.settlements.find((s) => !game.active.has(s.id));
  const L = game.sim.layoutOf(far.id);
  const day = game.day;
  aging(game.sim, L, day);
  assert.ok(L.npcs.filter(alive).every((r) => r.born !== undefined), 'everyone has a birthday');
  // A guard whose working years are up retires.
  const guard = L.npcs.find((r) => alive(r) && r.job === 'guard' && r.age === 'adult');
  guard.born = day - CHILDHOOD - guard.span;
  const smith = L.npcs.find((r) => alive(r) && r.age === 'adult' && !['guard', 'miner', 'lumberjack', 'builder', 'laborer', 'trapper', 'fisher', 'farmer'].includes(r.job) && r !== guard);
  smith.born = day - CHILDHOOD - smith.span;
  const job = smith.job;
  aging(game.sim, L, day);
  assert.equal(guard.age, 'elder');
  assert.equal(guard.job, 'retired');
  assert.ok(guard.look.stoop && guard.look.hat !== 'helmet' && guard.maxHp === 8);
  assert.equal(smith.age, 'elder');
  assert.equal(smith.job, job, 'a shopkeeper keeps at it');
  assert.ok(L.econ.ledger.some((l) => /getting on in years/.test(l.text)));
  // Each year of old age makes the next night likelier to be the last.
  assert.ok(oldAgeRisk(guard, day + 10) > oldAgeRisk(guard, day));
  assert.equal(oldAgeRisk(L.npcs.find((r) => r.age === 'adult' && alive(r)), day), 0);
  // A child comes of age when their childhood's done.
  const kid = L.npcs.find((r) => alive(r) && r.age === 'child');
  if (kid) {
    kid.born = day - CHILDHOOD;
    for (const r of L.npcs) if (r !== kid && r.age === 'child') r.born = day;
    assert.equal(comingOfAge(game.sim, L, day), kid);
    assert.equal(kid.age, 'adult');
  }
});

test('in a town nobody has seen, the years go by all the same', () => {
  const { game, sid } = start();
  // The farthest place from where you are: you've never been anywhere near.
  const home = game.world.ow.settlements.find((s) => s.id === sid);
  const dist = (s) => Math.hypot(s.cx - home.cx, s.cz - home.cz);
  // (The three farthest: whatever each happens to be like, between them
  // there are children, grown-ups and old folk.)
  const far = game.world.ow.settlements.filter((s) => s.condition !== 'abandoned').sort((a, b) => dist(b) - dist(a)).slice(0, 3);
  const Ls = far.map((s) => {
    assert.ok(!game.active.has(s.id));
    return game.sim.layoutOf(s.id);
  });
  const kids = new Set(Ls.flatMap((L) => L.npcs.filter((r) => r.age === 'child').map((r) => `${L.settlement.id}:${r.idx}`)));
  for (let d = 5; d <= 60; d += 5) {
    game.day = d;
    for (const L of Ls) simulateTo(game.sim, L, d * DAY);
  }
  const all = Ls.flatMap((L) => L.npcs.map((r) => ({ r, k: `${L.settlement.id}:${r.idx}` })));
  assert.ok(all.some(({ r, k }) => kids.has(k) && r.age === 'adult'), 'children grew up');
  assert.ok(all.some(({ r }) => r.aged), 'grown-ups grew old');
  assert.ok(all.some(({ r }) => r.cause === 'old age'), 'and some passed away');
  assert.ok(all.some(({ r }) => r.born > 0 && alive(r)), 'and babies were born');
});
