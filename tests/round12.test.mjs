import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGame, stubInput } from './helpers.mjs';
import { Creature } from '../src/entities/creature.js';
import { B } from '../src/world/blocks.js';
import { M } from '../src/world/settlement.js';
import { DAY, tickHour, st } from '../src/sim/econ.js';
import { planShopping, buyAt, needsOf, equipFor, MERCHANT_TIERS } from '../src/sim/shops.js';
import { onBladeHit, tickStatus, updateFlames } from '../src/game/gems.js';
import { wantsItem } from '../src/sim/careers.js';
import { jobTitle } from '../src/entities/npcgen.js';
import { CULTURES, familyName } from '../src/world/names.js';
import { RNG } from '../src/util/rng.js';

function start(seed = 7, minute = 9 * 60) {
  const game = makeGame(seed);
  const input = stubInput();
  game.minute = minute;
  for (let i = 0; i < 20; i++) game.update(0.1, input);
  const [sid, a] = [...game.active][0];
  return { game, input, sid, a, L: a.layout, p: game.player };
}

const town = (game, name) => {
  const s = game.world.ow.settlements.find((q) => q.name === name) || game.world.ow.settlements.find((q) => q.type !== 'village');
  return { s, L: game.sim.layoutOf(s.id) };
};

test('turning the camera: time and you stand still until it has swung round', () => {
  const { game, p } = start();
  const input = { ...stubInput(), isDown: (k) => k === 'KeyD' || k === 'ArrowRight', lastMoveKey: 'KeyD' };
  game.renderer.spin = { t: 0, dur: 0.4 };
  const m0 = game.minute;
  const x0 = p.x;
  for (let i = 0; i < 10; i++) game.update(0.1, input);
  assert.equal(game.minute, m0, 'time stood still');
  assert.equal(p.x, x0, 'so did you');
  game.renderer.spin = null;
  for (let i = 0; i < 10; i++) game.update(0.1, stubInput());
  assert.ok(game.minute > m0, 'and carries on after');
});

test('locked up for the night before the hearing, you can sleep on the cot till morning', () => {
  const game = makeGame(12345);
  const s = game.world.ow.settlements.find((q) => { const L = game.world.getLayout(q); return L.jail && !q.deserted; });
  const L = game.world.getLayout(s);
  game.loadAround(L.jail.bed.x, L.jail.bed.z, true);
  game.minute = 22 * 60;
  game.sim.justice.jail = { sid: s.id, phase: 'night', t: 0, how: 'surrender', party: [], lines: [], li: 0, lt: 0, release: null, cellless: false };
  game.player.teleport(L.jail.stand.x, L.jail.y, L.jail.stand.z);
  game.trySleep(L.jail.bed.x, L.jail.y, L.jail.bed.z);
  assert.ok(game.sleep, 'asleep on the cot');
  assert.ok(game.sleep.jail);
  assert.equal(game.sleep.wake, (game.day + 1) * DAY + 420, 'until seven in the morning');
});

test('sloped roofs: the gable ends are walled right up under the roof', () => {
  const game = makeGame(7);
  let checked = 0;
  for (const s of game.world.ow.settlements.filter((q) => !q.deserted)) {
    const L = game.world.getLayout(s);
    for (const b of L.buildings.filter((q) => q.mats && !q.mats.flat && !q.underConstruction && q.roofBase).slice(0, 3)) {
      game.loadAround(b.x0, b.z0, true);
      const w = game.world;
      // The first course of the roof: the wall runs on between its two slopes.
      if (b.z1 - b.z0 < 3) continue;
      for (const x of [b.x0, b.x1]) {
        for (let z = b.z0 + 1; z <= b.z1 - 1; z++) assert.notEqual(w.getBlock(x, b.roofBase, z), B.air, `${s.name} ${b.type} gable at ${x},${z}`);
      }
      checked++;
    }
    if (checked >= 6) break;
  }
  assert.ok(checked >= 3, `checked ${checked} houses`);
});

test('a wedding: guests standing keep a little room, and talk less', () => {
  const { game, L } = start(7);
  const E = game.sim.events;
  const single = L.npcs.filter((r) => r.alive !== false && r.age === 'adult' && (r.partner === null || r.partner === undefined));
  const a = single[0];
  const b = single.find((q) => q.household !== a.household);
  if (!a || !b) return;
  const ev = E.wedding(L, a, b, game.day);
  E.build(L, ev, true);
  for (const r of L.npcs) if (r.age !== 'child') r.mood = 1;
  E.invite(L, ev);
  const standing = ev.guests.filter((g) => g.role === 'guest' && g.x !== null);
  const at = new Set(standing.map((g) => `${g.x},${g.z}`));
  for (const g of standing) {
    const close = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dz]) => at.has(`${g.x + dx},${g.z + dz}`));
    assert.equal(close.length, 0, `guest at ${g.x},${g.z} has room`);
  }
});

test('more names: surnames of trades and families, civilization titles of their own, named shops', () => {
  const rng = new RNG(3);
  for (const c of Object.keys(CULTURES)) {
    const names = new Set(Array.from({ length: 200 }, () => familyName(rng, c)));
    assert.ok(names.size >= 60, `${c}: ${names.size} surnames`);
    assert.ok(CULTURES[c].first.length >= 45, `${c} first names`);
  }
  const game = makeGame(7);
  const civs = game.world.ow.civs.map((c) => c.name);
  assert.ok(civs.every((n) => n && n.length > 5), civs.join(', '));
  let named = 0;
  for (const s of game.world.ow.settlements) {
    const L = game.world.getLayout(s);
    named += L.buildings.filter((b) => ['smithy', 'shop', 'bakery', 'temple'].includes(b.type) && !['Smithy', 'General Store', 'Bakery', 'Temple'].includes(b.name)).length;
  }
  assert.ok(named >= 5, `${named} shops with names of their own`);
});

test('builders lay a street where they stand, not all at once; walls go up a stretch at a time', () => {
  const { game, L } = start(4);
  const sim = game.sim;
  const plan = sim.roads.planStreet(L);
  assert.ok(plan, 'room for a street');
  const p = sim.roads.startStreet(L, plan);
  // Nobody near it yet: plenty of hours booked, hardly anything down.
  for (const r of L.npcs) if (r.override && r.override.project === p.id && r.ent) r.ent.teleport(L.plaza.cx, 6, L.plaza.cz);
  p.work = 5000;
  sim.works.advance(L, p, sim.abs);
  assert.ok(p.placed <= 2, `only ${p.placed} laid with nobody there`);
  // A builder at the end of the street: the stretch beside them goes in.
  const r = L.npcs.find((q) => q.override && q.override.project === p.id && q.ent);
  assert.ok(r, 'a builder is on it');
  const first = sim.works.planOf(p).list[p.placed];
  r.ent.teleport(first[0], 6, first[2] + 1);
  const before = p.placed;
  sim.works.advance(L, p, sim.abs);
  assert.ok(p.placed > before, 'laid where the builder is');
  assert.ok(p.placed < p.total, 'but not the whole street');
  // A walled city's wall: the first stretch is finished before the next.
  const city = game.world.getLayout(game.world.ow.settlements.find((q) => q.type === 'city'));
  const list = city.wallPlan().list.slice(0, 20);
  const xs = list.map((q) => q[0]);
  const zs = list.map((q) => q[2]);
  assert.ok(Math.max(...xs) - Math.min(...xs) + Math.max(...zs) - Math.min(...zs) <= 8, 'a short stretch first');
});

test('places you have never been draw up their plans and live on too', () => {
  const { game, input } = start(7);
  const n0 = game.world.layouts.size;
  for (let i = 0; i < 120; i++) game.update(0.5, input);
  assert.ok(game.world.layouts.size > n0 + 5, `${game.world.layouts.size} towns laid out`);
  const far = [...game.world.layouts.values()].filter((L) => !game.active.has(L.settlement.id));
  assert.ok(far.some((L) => L.econ && L.econ.lastAbs !== null), 'and their days go by');
});

test('shopping: people who need something go to the shop that has it, and the shop takes their money', () => {
  const game = makeGame(7);
  const { L } = town(game, 'Wynfield');
  const shop = L.buildings.find((b) => b.type === 'shop' && L.econ.biz[b.id]);
  const biz = L.econ.biz[shop.id];
  st.add(biz.store, 'arrow', 5);
  st.add(biz.store, 'string', 5);
  const who = L.npcs.find((r) => r.age === 'adult' && ['trapper', 'guard', 'fisher'].includes(r.job));
  assert.ok(needsOf(L, who).some((n) => n.key === 'tool'), 'their trade wears things out');
  who.override = null;
  who.coins = 100;
  who.shopDue = { tool: 0, clothes: 99, house: 99, armour: 99, jewel: 99, fine: 99, remedy: 99, reading: 99 };
  const day = 3;
  planShopping(game.sim, L, day);
  assert.equal(who.override && who.override.act, 'shop', 'off to the shops');
  const o = who.override;
  const seller = o.seller !== undefined ? L.npcs[o.seller] : L.econ.biz[o.building];
  const sales = seller.sales || 0;
  const had = who.inv.reduce((n, q) => n + (q && q.item === o.item ? q.count : 0), 0);
  // (Nobody watching: it's bought when they get there.)
  tickHour(game.sim, L, Math.floor(o.s / 60) * 60);
  assert.equal(who.override, null);
  assert.ok(seller.sales > sales, 'a sale');
  assert.ok(who.inv.reduce((n, q) => n + (q && q.item === o.item ? q.count : 0), 0) > had || who.wear, 'they have it');
  // Over the counter, the money goes in the till.
  who.coins = 50;
  const till = seller.till ?? seller.coins;
  const r = buyAt(L, who, { ...o }, day);
  if (r && r.item) {
    assert.ok(who.coins < 50, 'paid');
    assert.ok((seller.till ?? seller.coins) > till, 'and the shop has the money');
  }
  // Nobody needing anything, nobody buying: a shop earns nothing for sitting there.
  const r2 = buyAt(L, who, { building: shop.id, item: 'nothing_at_all', items: [] }, day);
  assert.ok(r2.none);
});

test('merchants: peddlers, traders and master merchants, with wares and purses to match', () => {
  const game = makeGame(7);
  const merchants = [];
  for (const s of game.world.ow.settlements) merchants.push(...game.world.getLayout(s).npcs.filter((r) => r.job === 'merchant'));
  assert.ok(merchants.length && merchants.every((r) => r.tier >= 1 && r.tier <= 3));
  assert.ok(new Set(merchants.map((r) => r.tier)).size >= 2, 'not all the same');
  const top = merchants.find((r) => r.tier === 3);
  if (top) assert.equal(jobTitle(top), 'Master Merchant');
  assert.ok(MERCHANT_TIERS[3].profit > MERCHANT_TIERS[1].profit, 'better merchants do better on the road');
  assert.ok(MERCHANT_TIERS[3].goods.some((k) => k.includes('+')), 'and carry jewelled pieces');
});

test('gems: what a stone does depends on what it is set in, for you or a guard', () => {
  const { game, p, L, a } = start(7);
  const w = game.world;
  // A ruby blade throws flame ahead of the swing.
  p.dir = 3;
  const x = p.x + 3;
  const wolf = new Creature(game, 'wolf', x, p.y, p.z);
  game.addCreature(wolf);
  const hp0 = wolf.hp;
  const slot = p.inv.findIndex((q) => !q);
  p.inv[slot] = { item: 'iron_sword+ruby', count: 1 };
  p.selected = slot;
  if (w.getBlock(p.x + 1, p.y, p.z) === B.air && w.getBlock(p.x + 2, p.y, p.z) === B.air) {
    p.attackCd = 0;
    game.swing();
    for (let i = 0; i < 10; i++) updateFlames(game, 0.1);
    assert.ok(wolf.hp < hp0 || wolf.burnT > 0, 'the flame reached it');
  }
  // Amethyst armour turns part of a blow back on whoever struck it.
  p.equip.body = 'chainmail+amethyst';
  wolf.teleport(p.x + 1, p.y, p.z);
  const hw = wolf.hp;
  game.damage(p, 6, wolf);
  assert.ok(wolf.hp < hw, 'the wolf felt it');
  // Emerald armour closes a wound, slowly.
  p.equip.body = 'chainmail+emerald';
  p.hp = p.maxHp - 3;
  p.gemMendT = 0;
  tickStatus(game, p, 0.1);
  assert.equal(p.hp, p.maxHp - 2);
  // A guard with a sapphire sword chills what they cut.
  const guard = a.npcs.find((n) => n.rec.job === 'guard');
  equipFor(guard.rec, 'iron_sword+sapphire');
  assert.equal(guard.meleeWeapon(), 'iron_sword+sapphire');
  onBladeHit(game, guard, wolf);
  assert.ok(wolf.slowT > 0, 'chilled');
  // Guards want jewelled gear; the tooltip says what it does.
  assert.ok(wantsItem('guard', 'bow+topaz'));
  assert.ok(!wantsItem('farmer', 'bow+topaz'));
  void L;
});

test('a jeweller: miners bring their finds to sell, guards buy jewelled pieces', () => {
  const { game, sid, a, p } = start(7);
  const car = game.sim.careers;
  const miner = a.npcs.find((n) => n.rec.age === 'adult' && n.rec.job !== 'guard' && n.rec.job !== 'mayor');
  miner.rec.job = 'miner';
  car.job = { kind: 'profession', job: 'jeweller', sid, since: game.day };
  p.give('coin', 200);
  car.customer = { sid, idx: miner.rec.idx, name: miner.rec.name.first, kind: 'offer', item: 'gem', count: 1, price: 45, until: game.sim.abs + 90, arrived: true };
  const coins = p.inv.reduce((n, q) => n + (q && q.item === 'coin' ? q.count : 0), 0);
  const r = car.serveCustomer(miner);
  assert.ok(r.ok, 'bought');
  assert.ok(p.inv.some((q) => q && q.item === 'gem'), 'the gem is yours');
  assert.equal(p.inv.reduce((n, q) => n + (q && q.item === 'coin' ? q.count : 0), 0), coins - 45);
  // A guard buys your jewelled sword, and wields it.
  const guard = a.npcs.find((n) => n.rec.job === 'guard');
  p.give('iron_sword+ruby', 1);
  car.customer = { sid, idx: guard.rec.idx, name: guard.rec.name.first, kind: 'buy', item: 'iron_sword+ruby', count: 1, price: 60, until: game.sim.abs + 90, arrived: true };
  guard.rec.coins = 200;
  assert.ok(car.serveCustomer(guard).ok);
  assert.equal(guard.meleeWeapon(), 'iron_sword+ruby');
});

test('guards push through crowds, and pull a prisoner through after them', () => {
  const { game, a, L, p } = start(7);
  const guard = a.npcs.find((n) => n.rec.job === 'guard');
  const folk = a.npcs.filter((n) => n.rec.job !== 'guard' && !n.sleeping).slice(0, 2);
  const cx = L.plaza.cx;
  const cz = L.plaza.cz + 1;
  const at = (e, x, z) => e.teleport(x, game.world.findStandY(x, z, 6), z);
  at(guard, cx, cz);
  at(folk[0], cx + 1, cz);
  assert.ok(game.shove(folk[0], guard, { x: cx + 2, z: cz }), 'shoved aside');
  assert.ok(folk[0].x !== cx + 1 || folk[0].z !== cz);
  // A bystander in the prisoner's way is pushed aside by the rope.
  at(p, cx, cz + 2);
  at(folk[1], cx + 1, cz + 2);
  for (let i = 0; i < 5; i++) game.update(0.1, stubInput());
  at(folk[1], cx + 1, cz + 2);
  const moved = game.sim.justice.pullToward(cx + 3, 6, cz + 2, 0);
  assert.ok(moved, 'the prisoner comes through');
});

test('construction: inter-town roads and event sets are the builders\' work, never popped in', () => {
  const { game, L } = start(7);
  const E = game.sim.events;
  const ev = E.feast(L, game.day, 0);
  E.build(L, ev, true);
  const p = game.sim.works.projects.find((q) => q.id === ev.stage);
  assert.ok(p && p.kind === 'stage', 'the builders put the set up');
  assert.ok(!ev.blocks.every(([x, y, z, id]) => game.world.getBlock(x, y, z) === id), 'not all at once');
  void M;
});
