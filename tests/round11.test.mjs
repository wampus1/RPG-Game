import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGame, stubInput, lotsReady } from './helpers.mjs';
import { topicsFor, respond, openingLine } from '../src/game/dialogue.js';
import { runCommand } from '../src/game/commands.js';
import { B } from '../src/world/blocks.js';

function start(seed = 7, minute = 9 * 60) {
  const game = makeGame(seed);
  const input = stubInput();
  game.minute = minute;
  for (let i = 0; i < 20; i++) game.update(0.1, input);
  const [sid, a] = [...game.active][0];
  return { game, input, sid, a, L: a.layout, p: game.player };
}

// Browser storage that runs out of room, as it does at a few megabytes.
function smallStore(limit) {
  const m = new Map();
  const size = () => [...m.values()].reduce((n, v) => n + v.length, 0);
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => {
      const was = m.get(k) || '';
      if (size() - was.length + String(v).length > limit) {
        const e = new Error('The quota has been exceeded.');
        e.name = 'QuotaExceededError';
        throw e;
      }
      m.set(k, String(v));
    },
    removeItem: (k) => m.delete(k),
  };
}

function memDB() {
  const m = new Map();
  return { m, get: async (k) => m.get(k), put: async (k, v) => void m.set(k, v), del: async (k) => void m.delete(k) };
}

test('saving: games go to the database (gzipped) when browser storage is too small for them', async () => {
  const { SaveStore } = await import('../src/game/saves.js');
  const game = makeGame(12345);
  game.playerName = 'Wren';
  const st = smallStore(4000);
  // Browser storage alone can't hold even one game...
  await assert.rejects(new SaveStore(st).save('1', game), /quota/i);
  // ...but with the database every slot can.
  const db = memDB();
  const store = new SaveStore(st, db);
  for (const id of ['1', '2', '3', '4', '5', 'auto']) await store.save(id, game);
  assert.equal(store.list().filter((q) => q.meta).length, 6);
  assert.ok(db.m.get('tessera-save-3').gz, 'compressed');
  const data = await store.load('3');
  assert.equal(data.seed, 12345);
  assert.equal(data.playerName ?? data.name, 'Wren');
  store.remove('3');
  assert.ok(!store.has('3'));
});

// A town (not a village) of seed 7, with its layout and mayor.
function town(game, pick = (s) => s.type === 'town') {
  const s = game.world.ow.settlements.find((q) => pick(q) && !q.deserted);
  const L = game.sim.layoutOf(s.id);
  const rec = L.npcs.find((r) => r.job === 'mayor');
  return { s, L, mayor: { rec, layout: L, settlement: s, ent: null } };
}

test('food: bakers eat from their own ovens, the cook grills spare fish, the mayor feeds the hungry', async () => {
  const { eatMeal, kitchenOf, DAY, tickHour } = await import('../src/sim/econ.js');
  const { st } = await import('../src/sim/econ.js');
  const { RNG } = await import('../src/util/rng.js');
  const game = makeGame(7);
  // A baker with an empty pack and larder, and bread at the bakery.
  const L = game.world.ow.settlements.map((s) => game.sim.layoutOf(s.id)).find((q) => q && q.npcs.some((r) => r.job === 'baker'));
  const baker = L.npcs.find((r) => r.job === 'baker');
  baker.inv = [];
  baker.fed = 0;
  if (L.econ.pantry[baker.home]) L.econ.pantry[baker.home] = {};
  const biz = L.econ.biz[baker.work.building];
  biz.store = {};
  st.add(biz.store, 'bread', 4);
  const meal = eatMeal(L, baker, 'home', game.day, new RNG(1), 12 * 60);
  assert.equal(meal.item, 'bread');
  assert.equal(meal.source, 'work');
  // The cook: a pile of fish comes down, grilled.
  const T = town(game).L;
  const k = kitchenOf(T);
  const cook = T.npcs.find((r) => r.job === 'cook');
  assert.ok(k && cook, 'a town with a kitchen');
  st.add(k.store, 'fish', 40);
  const was = st.count(k.store, 'fish');
  for (let h = 0; h < 24; h++) tickHour(game.sim, T, 2 * DAY + h * 60);
  assert.ok(st.count(k.store, 'fish') < was - 10, `fish cooked (${was} -> ${st.count(k.store, 'fish')})`);
  // Hungry people: the mayor pays for meals and puts them in their hands.
  const hungry = T.npcs.filter((r) => r.age === 'adult' && r.job !== 'mayor').slice(0, 4);
  for (const r of hungry) {
    r.hungry = 2;
    r.inv = [];
  }
  T.econ.treasury = 500;
  tickHour(game.sim, T, 3 * DAY + 10 * 60);
  assert.ok(T.econ.feeding && T.econ.feeding.fed >= 4, 'fed them');
  assert.ok(T.econ.ledger.some((q) => /paid ¤\d+ to feed \d+ hungry/.test(q.text)));
  assert.ok(hungry.every((r) => r.fed >= 1 || r.inv.some((q) => q && q.count > 0)), 'each got a meal');
});

test('hunger: people only look hungry when they really are', async () => {
  const { eatMeal } = await import('../src/sim/econ.js');
  const { RNG } = await import('../src/util/rng.js');
  const game = makeGame(7);
  const { L } = town(game);
  const r = L.npcs.find((q) => q.age === 'adult' && q.job === 'farmer') || L.npcs.find((q) => q.age === 'adult');
  // (Nothing anywhere to eat, or to buy.)
  r.inv = [];
  r.coins = 0;
  for (const k of Object.keys(L.econ.pantry)) L.econ.pantry[k] = {};
  for (const b of Object.values(L.econ.biz)) b.store = {};
  for (const o of L.npcs) if (o !== r) o.inv = [];
  // A skipped snack after a good meal isn't going hungry...
  r.fed = 1;
  r.hungry = 0;
  r.missed = 0;
  const a = eatMeal(L, r, 'home', game.day, new RNG(2), 18 * 60);
  assert.equal(a.item, null);
  assert.equal(a.starving, false);
  // ...going without all day is.
  r.fed = 0;
  eatMeal(L, r, 'home', game.day, new RNG(3), 12 * 60);
  const b = eatMeal(L, r, 'home', game.day, new RNG(4), 18 * 60);
  assert.equal(b.starving, true);
});

test('news from afar: posted for two days, fading, then gone', async () => {
  const { hearNews, freshRumours, rumourAge, DAY } = await import('../src/sim/econ.js');
  const game = makeGame(7);
  const { L } = town(game);
  const t0 = 3 * DAY + 9 * 60;
  hearNews(L, 'Farhaven', ['A baby, Wren, was born to the Ashes.'], 3, t0);
  assert.equal(freshRumours(L.econ, t0 + 60).length, 1);
  const r = L.econ.rumours[0];
  assert.ok(rumourAge(r, t0 + DAY) > 0.4 && rumourAge(r, t0 + DAY) < 0.6, 'half faded after a day');
  assert.equal(freshRumours(L.econ, t0 + 2 * DAY - 10).length, 1);
  assert.equal(freshRumours(L.econ, t0 + 2 * DAY + 10).length, 0, 'gone after two days');
  // New news clears out the stale.
  hearNews(L, 'Oakley', ['The builders finished a new bakery.'], 6, t0 + 3 * DAY);
  assert.deepEqual(L.econ.rumours.map((q) => q.from), ['Oakley']);
  // (And talk and the paper leave it alone too.)
  game.sim.simNow = t0 + 3 * DAY;
  assert.ok(!game.sim.press.stories(L).some((q) => q.from === 'Farhaven'));
});

test('streets: a town with no lots lays a two-wide street, marks lots with signs, and what waited is built', () => {
  const game = makeGame(7);
  // (A town with open ground beside it for a street and its lots.)
  const { s, L } = town(game, (q) => q.name === 'Ashstead');
  const sim = game.sim;
  for (const p of L.plots) if (p) p.taken = true;
  // Nothing to build on: the new house waits its turn.
  L.econ.treasury = 2000;
  Object.assign(L.econ.stock || {}, { wood: 500, stone: 500 });
  const k = L.econ.stock || (L.econ.stock = { wood: 500, stone: 500 });
  k.wood = 500;
  k.stone = 500;
  assert.equal(sim.works.startBuilding(L, 'house_m', ''), null);
  assert.ok(sim.roads.waiting(L, 'build', { type: 'house_m' }), 'queued');
  // The builders lay out a street.
  sim.roads.daily(L, game.day + 1);
  const street = sim.works.projects.find((p) => !p.done && p.sid === s.id && p.kind === 'road');
  assert.ok(street, 'a street under way');
  const set = new Set(street.road.map(([x, z]) => `${x},${z}`));
  const n = ([x, z]) => [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dz]) => set.has(`${x + dx},${z + dz}`) || L.isRoadTile(x + dx, z + dz)).length;
  assert.ok(street.road.every((t) => n(t) >= 2), 'two tiles wide all along');
  const before = L.plots.length;
  sim.works.finishNow(L, street);
  // Lots along it, each with a sign, the street at its door.
  const lots = L.plots.slice(before).filter(Boolean);
  assert.ok(lots.length >= 1);
  for (const p of lots.filter((q) => !q.taken)) {
    assert.ok(sim.roads.roadside(L, p), 'a street at the door');
    assert.ok(L.signs.some((q) => q.kind === 'plot' && q.plot === p.id), 'a sign on it');
  }
  // The town's ground has grown to take the street in.
  const [x, z] = street.road[Math.floor(street.road.length / 2)];
  assert.equal(game.world.ow.settlementAt(x, z), s);
  // ...and the waiting house goes up on one of the lots.
  sim.roads.startWaiting(L);
  const house = sim.works.projects.find((p) => !p.done && p.sid === s.id && p.kind === 'build' && p.type === 'house_m');
  assert.ok(house, 'the house is started');
  assert.ok(!sim.roads.waiting(L, 'build', { type: 'house_m' }));
  assert.ok(sim.roads.roadside(L, L.plots[house.plot]));
});

test('your workshop and your house wait for a lot with a street, and the mayor tells you how they are coming', () => {
  const game = makeGame(7);
  const { L, mayor } = town(game);
  const sim = game.sim;
  game.player.give('coin', 3000);
  for (const p of L.plots) if (p) p.taken = true;
  sim.join(mayor);
  sim.changeRep(mayor, 40);
  assert.ok(sim.roads.waiting(L, 'home'), 'the house waits for a lot');
  assert.ok(!sim.construction, 'nothing built before there is a street to it');
  const r = sim.careers.takeProfession(mayor, 'herbalist');
  assert.ok(r.ok && r.building && r.building.queued, 'the workshop is ordered');
  assert.ok(sim.roads.waiting(L, 'workshop', { job: 'herbalist' }));
  const t = topicsFor(mayor, game).find((q) => q.id === 'myworks');
  assert.ok(t && /workshop and house/.test(t.label));
  const said = respond(mayor, game, 'myworks').lines.join(' ');
  assert.match(said, /workshop is paid for and waiting on a lot/);
  assert.match(said, /house is paid for and waiting/);
  // Lots come free: both go up, the street at their doors.
  lotsReady(game, L, 'player_workshop', 2);
  sim.roads.startWaiting(L);
  const shop = sim.works.projects.find((p) => !p.done && p.shop === 'herbalist');
  assert.ok(shop, 'workshop started');
  assert.ok(sim.construction && !sim.construction.done, 'house started');
  assert.ok(sim.roads.roadside(L, L.plots[sim.construction.plot]));
  const now = respond(mayor, game, 'myworks').lines.join(' ');
  assert.match(now, /workshop/);
  assert.match(now, /builder/);
  // A builder can tell you too.
  const b = L.npcs.find((q) => q.job === 'builder' || q.job === 'carpenter');
  if (b) assert.ok(topicsFor({ rec: b, layout: L, settlement: mayor.settlement, ent: null }, game).some((q) => q.id === 'myworks'));
});

test('city walls: gates are at least four wide, and a breach takes down seven', () => {
  const game = makeGame(12345);
  const s = game.world.ow.settlements.find((q) => q.type === 'city' && game.world.getLayout(q).walled);
  const L = game.world.getLayout(s);
  const b = L.bounds;
  const at = { x: Math.floor((b.x0 + b.x1) / 2) + 6, z: b.z0 };
  for (let x = at.x - 4; x <= at.x + 4; x++) L.setMask(x, b.z0, 7);
  assert.equal(L.breachPlan(at).tiles.length, 7);
  // A wall built round a grown town leaves wide gates where roads cross it.
  const T = game.world.getLayout(game.world.ow.settlements.find((q) => q.type === 'town'));
  const plan = T.wallPlan();
  const open = new Set(plan.gates.map((g) => `${g.x},${g.z}`));
  for (const g of plan.gates) {
    const horiz = g.z === T.bounds.z0 || g.z === T.bounds.z1;
    let w = 1;
    for (let k = 1; open.has(horiz ? `${g.x - k},${g.z}` : `${g.x},${g.z - k}`); k++) w++;
    for (let k = 1; open.has(horiz ? `${g.x + k},${g.z}` : `${g.x},${g.z + k}`); k++) w++;
    assert.ok(w >= 4, `gate ${w} wide`);
  }
});

test('renown: only a town\'s own people hail you as its friend or hero', () => {
  const { game, a, L } = start(7);
  const s = L.settlement;
  // The player is the hero of another town of the same people.
  const other = game.world.ow.settlements.find((q) => q.id !== s.id && q.civ && s.civ && q.civ === s.civ) || game.world.ow.settlements.find((q) => q.id !== s.id);
  game.sim.renown.set(other.id, 40);
  for (const n of a.npcs) {
    const line = openingLine(n, game);
    assert.ok(!/Hero|hero|friend of/.test(line), `${n.rec.name.first}: ${line}`);
  }
  // At home, they know you.
  game.sim.renown.set(s.id, 40);
  const lines = a.npcs.filter((n) => n.rec.age === 'adult').map((n) => {
    game.sim.repEntry(s.id, n.rec.idx).met = false;
    return openingLine(n, game);
  });
  assert.ok(lines.some((l) => /Hero|hero/.test(l)));
});

test('the command console: teleport, reveal the map, and make a wedding happen', () => {
  const { game, input } = start(7);
  const out = (t) => runCommand(game, t).join(' ');
  assert.match(out('help'), /tp <town>/);
  // (Somewhere you're not: a lived-in town with a plain name.)
  const far = game.world.ow.settlements.find((q) => q.condition !== 'abandoned' && !game.active.has(q.id) && /^[A-Za-z]+$/.test(q.name));
  const name = far.name;
  assert.match(out(`tp ${name.slice(0, 5).toLowerCase()}`), new RegExp(`Teleported to ${name}`));
  assert.ok(game.world.ow.settlementAt(game.player.x, game.player.z) === far);
  for (let i = 0; i < 10; i++) game.update(0.1, input);
  assert.ok(game.active.has(far.id), 'the town comes to life around you');
  assert.match(out('tp 400 300'), /Teleported to/);
  assert.ok(Math.abs(game.player.x - 400) < 6 && Math.abs(game.player.z - 300) < 6);
  out('reveal');
  assert.ok(game.revealMap);
  out('teleport on');
  assert.ok(game.cheats.mapTeleport);
  // A wedding in a couple of hours, today.
  const said = out(`wedding now ${name.toLowerCase()}`);
  assert.match(said, new RegExp(`are to be married in ${name}: day \\d+`));
  const L = game.sim.layoutOf(far.id);
  const ev = L.econ.events.find((q) => q.kind === 'wedding');
  assert.equal(ev.day, game.day);
  assert.ok(ev.s - game.sim.now() <= 4 * 60);
  // Time passes (as if waiting) and the wedding happens.
  for (let h = Math.floor(game.sim.now() / 60) * 60; h < ev.e + 60; h += 60) game.sim.events.hourly(L, h);
  assert.ok(ev.wed, 'they were married');
  // Waiting till a time, without a seat.
  assert.match(out('time +2'), /Waiting until/);
  assert.ok(game.waiting && game.waiting.anywhere);
  assert.match(out('nonsense'), /Unknown command/);
  // Cheats are kept with the save.
  const data = game.serialize();
  assert.ok(data.cheats.reveal && data.cheats.mapTeleport);
});

test('town signs: every town gets its sign by the road in', () => {
  const game = makeGame(12345);
  for (const s of game.world.ow.settlements.filter((q) => !q.deserted).slice(0, 6)) {
    const L = game.world.getLayout(s);
    game.loadAround(s.cx * 64 + 32, s.cz * 36 + 18, true);
    for (const pt of L.entrances.slice(0, 1)) game.loadAround(pt.x, pt.z, true);
    game.sim.checkTownSigns(L);
    const sg = L.signs.find((q) => q.kind === 'entrance');
    assert.ok(sg, `${s.name} has a sign`);
    if (game.world.regionAt(sg.x, sg.z)) assert.equal(game.world.getBlock(sg.x, 6, sg.z), B.sign);
  }
});
