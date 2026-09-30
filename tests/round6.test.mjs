import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGame, stubInput } from './helpers.mjs';
import { B, BLOCKS } from '../src/world/blocks.js';
import { GROUND } from '../src/config.js';
import { topicsFor, respond } from '../src/game/dialogue.js';
import { countItem } from '../src/game/inventory.js';
import { alive, simulateTo, stockOf, weatherQuits, weatherBreak, DAY } from '../src/sim/econ.js';
import { weatherAt, townWeather } from '../src/world/weather.js';
import { castLine, hook, updateFishing } from '../src/game/fishing.js';
import { placeSome } from '../src/sim/works.js';
import { growth, promote } from '../src/sim/growth.js';
import { electMayor, weddings, comingOfAge, aging, raids } from '../src/sim/life.js';
import { Renderer } from '../src/render/renderer.js';
import { World } from '../src/world/world.js';
import { RNG } from '../src/util/rng.js';

function start(seed = 12345, minute = 9 * 60) {
  const game = makeGame(seed);
  const input = stubInput();
  game.minute = minute;
  for (let i = 0; i < 20; i++) game.update(0.1, input);
  const [sid, a] = [...game.active][0];
  return { game, input, sid, a, L: a.layout, p: game.player, w: game.world };
}

function visit(game, input, s) {
  const L = game.world.getLayout(s);
  game.loadAround(L.plaza.cx, L.plaza.cz, true);
  game.player.teleport(L.plaza.cx, game.world.findStandY(L.plaza.cx, L.plaza.cz + 2, 6), L.plaza.cz + 2);
  game.updateSettlements(true);
  for (let i = 0; i < 20; i++) game.update(0.1, input);
  return { L, a: game.active.get(s.id) };
}

function reload(game) {
  const data = JSON.parse(JSON.stringify(game.serialize()));
  return new game.constructor({ seed: data.seed, renderer: game.renderer, audio: null, ui: game.ui, save: data });
}

const always = { next: () => 0.1, chance: () => true, int: (a) => a, pick: (l) => l[0], shuffle: (l) => l, float: (a) => a };

test('a new well and a night in a village bed give blue hearts for the day', () => {
  const { game, L, p } = start(12345);
  const max = p.maxHp;
  const well = L.wells[0];
  assert.ok(well, 'the village has a well');
  game.interact(well.x, GROUND, well.z);
  assert.equal(p.maxHp, max, 'no permanent change');
  assert.equal(p.blue.hp, 2, 'a blue heart');
  game.interact(well.x, GROUND, well.z);
  assert.equal(p.blue.hp, 2, 'only once a day from each well');
  // Blue hearts take the blow first.
  const hp = p.hp;
  game.damage(p, 1, null);
  assert.equal(p.hp, hp);
  assert.equal(p.blue.hp, 1);
  const bed = L.buildings.find((b) => b.residential && b.beds.length).beds[0];
  game.sleep = { phase: 'deep', t: 0, bed: { x: bed.x, y: GROUND, z: bed.z }, from: { x: p.x, y: p.y, z: p.z }, wake: 0, start: 0, hp0: p.hp, jail: false };
  game.wakeUp(false);
  assert.ok(p.blue.hp >= 2, 'a night in the village');
  assert.equal(p.hp, p.maxHp);
  const g2 = reload(game);
  assert.equal(g2.player.blue.hp, p.blue.hp, 'kept after a reload');
  // Gone when the day ends.
  game.day++;
  p.update(0.01, { isDown: () => false, lastMoveKey: null }, true);
  assert.equal(p.blue.hp, 0);
});

test('while you stay with a family, their beds and chests are yours to use', () => {
  const { game, L, a, p, sid } = start(12345);
  const hall = L.buildings.find((b) => b.type === 'townhall');
  const mayor = a.npcs.find((n) => n.rec.job === 'mayor');
  p.give('coin', 200);
  p.teleport(hall.inside.x, 6, hall.inside.z);
  game.currentSettlement = L.settlement;
  respond(mayor, game, 'citizen', 'yes');
  const c = game.sim.citizen;
  assert.ok(c && c.host !== null);
  assert.ok(game.sim.isGuest(sid, c.host));
  const house = L.buildings[c.host];
  const other = house.beds.find((b) => !(b.x === c.hostBed.x && b.z === c.hostBed.z));
  if (other) {
    for (const n of game.npcs) if (n.x === other.x && n.z === other.z) n.sleeping = false;
    assert.equal(game.sim.bedOwner(other.x, other.z), null, 'any bed in the house');
  }
  const owner = game.containerOwner(house.inside.x, GROUND, house.inside.z);
  assert.equal(owner.kind, 'host');
  const thefts = game.sim.justice.recordOf(sid).thefts || 0;
  assert.equal(game.onContainerTake({ owner }, [{ item: 'bread', count: 3 }]), false);
  assert.equal(game.sim.justice.recordOf(sid).thefts || 0, thefts, 'no crime');
});

test('voices inside a closed building stay inside', () => {
  const { game, L, a, p, w } = start(12345, 11 * 60);
  const b = L.buildings.find((q) => q.residential && !q.playerHome && q.x1 - q.x0 >= 4);
  const n = a.npcs.find((q) => !q.dead && !q.sleeping && q.rec.age === 'adult');
  n.teleport(b.inside.x, GROUND, b.inside.z);
  w.setState(b.door.x, GROUND, b.door.z, false);
  p.teleport(b.x1 + 6, w.findStandY(b.x1 + 6, b.z1 + 4, GROUND), b.z1 + 4);
  assert.equal(game.speechAudible(n), false, 'not through the walls');
  w.setState(b.door.x, GROUND, b.door.z, true);
  const ox = b.door.x + (b.door.rot === 3 ? 2 : b.door.rot === 1 ? -2 : 0);
  const oz = b.door.z + (b.door.rot === 0 ? 2 : b.door.rot === 2 ? -2 : 0);
  p.teleport(ox, w.findStandY(ox, oz, GROUND), oz);
  assert.equal(game.speechAudible(n), true, 'the door is open and you are right there');
  w.setState(b.door.x, GROUND, b.door.z, false);
  p.teleport(b.inside.x, GROUND, b.inside.z);
  assert.equal(game.speechAudible(n), true, 'inside with them');
});

test('the roof comes away when you are inside, even under a hole or a tall ridge', () => {
  const { L, w, p } = start(12345);
  const b = L.buildings.find((q) => q.residential && !q.playerHome);
  p.teleport(b.inside.x, GROUND, b.inside.z);
  // Punch a hole in the roof right above you.
  for (let y = GROUND + 1; y < GROUND + 16; y++) if (BLOCKS[w.getBlock(p.x, y, p.z)].render === 'cube') w.setBlock(p.x, y, p.z, B.air);
  const r = { hidden: null };
  Renderer.prototype.computeCutaway.call(r, w, p, null);
  assert.equal(r.hidden, null, 'without knowing the building, a hole leaves the roof up');
  Renderer.prototype.computeCutaway.call(r, w, p, b);
  assert.ok(r.hidden && r.hidden.has(b.x0 * 65536 + b.z0) && r.hidden.has(b.x1 * 65536 + b.z1), 'the whole building opens up');
});

test('builders put up walls straight away: empty air to clear costs no time', () => {
  const { game, w, p } = start(12345);
  const x = p.x + 3;
  const z = p.z + 3;
  const list = [];
  for (let y = GROUND + 4; y < GROUND + 10; y++) list.push([x, y, z, B.air, 0]);
  list.push([x, GROUND + 4, z, B.planks, 0]);
  const st = { work: 5, placed: 0 };
  const out = placeSome(game, list, st, 5);
  assert.equal(out.length, 1);
  assert.equal(out[0][3], B.planks, 'the first block placed is a real one');
  assert.equal(st.placed, list.length);
  void w;
});

test('a licensed professional always gets a better price for their goods', () => {
  const { game, sid, a } = start(12345);
  const n = a.npcs.find((q) => !q.dead && q.rec.age === 'adult');
  const normal = game.sim.sellPrice(n, 'wheat');
  game.sim.careers.job = { kind: 'profession', job: 'farmer', sid };
  const lic = game.sim.sellPrice(n, 'wheat');
  assert.ok(lic > normal, `${lic} > ${normal}`);
  assert.equal(game.sim.sellPrice(n, 'iron_ingot'), game.sim.sellPrice(n, 'iron_ingot'));
});

test('the game saves itself at seven every morning', () => {
  const { game, input } = start(12345, 6 * 60);
  let saves = 0;
  game.autosave = () => saves++;
  game.minute = 6 * 60 + 59.5;
  for (let i = 0; i < 10; i++) game.update(0.1, input);
  assert.equal(saves, 1);
  for (let i = 0; i < 10; i++) game.update(0.1, input);
  assert.equal(saves, 1, 'once a day');
});

test('mayors tell you about the neighbouring towns, and where a letter goes', () => {
  const { game, L, a } = start(12345);
  const mayor = a.npcs.find((n) => n.rec.job === 'mayor');
  assert.ok(topicsFor(mayor, game).some((t) => t.id === 'towns'));
  const r = respond(mayor, game, 'towns');
  assert.ok(r.choices.length >= 1);
  const o = game.world.ow.settlements[+r.choices[0].arg];
  const before = game.world.ow.explored[o.cz * 256 + o.cx];
  const detail = respond(mayor, game, 'towns', r.choices[0].arg).lines.join(' ');
  assert.match(detail, new RegExp(`${o.name} is a (village|town|city), about \\d+ hours' walk to the (north|south|east|west)`));
  void before;
  const q = game.sim.diplomacy.write(L.settlement, o, 'gift', { amount: 10 });
  const took = respond(mayor, game, 'mail', 'yes').lines.join(' ');
  assert.match(took, /marked it on your map/);
  assert.match(q.where, /hours' walk/);
});

test('a few guards keep watch at night: fewer than by day', () => {
  let towns = 0;
  for (const seed of [12345, 4242]) {
    const w = new World(seed);
    for (const s of w.ow.settlements.filter((q) => q.condition !== 'abandoned')) {
      const guards = w.getLayout(s).npcs.filter((r) => r.job === 'guard');
      if (guards.length < 3) continue;
      const night = guards.filter((g) => g.shift === 'night').length;
      assert.ok(night >= 1 && night < guards.length - night, `${s.name}: ${night} of ${guards.length} at night`);
      towns++;
    }
  }
  assert.ok(towns > 3);
});

test('when time races while you sleep, people keep pace', () => {
  const { game, input, a } = start(12345, 22 * 60);
  const n = a.npcs.find((q) => !q.dead);
  let calls = 0;
  const up = n.update.bind(n);
  n.update = (dt) => {
    calls++;
    return up(dt);
  };
  game.update(0.05, input);
  const normal = calls;
  calls = 0;
  game.sleepFast = 60;
  game.update(0.05, input);
  game.sleepFast = 0;
  assert.ok(calls >= normal * 3, `${calls} updates in a fast frame vs ${normal}`);
});

test('weather is the same wherever you ask from, and drives the lazier home', () => {
  const { game, L } = start(12345);
  const s = L.settlement;
  const seen = new Set();
  for (let h = 0; h < 24 * 20; h += 4) seen.add(townWeather(game.seed, s, h * 60));
  assert.ok(seen.has('clear') && seen.size >= 2, [...seen].join());
  assert.equal(weatherAt(game.seed, 100, 200, 5000, 'plains'), weatherAt(game.seed, 100, 200, 5000, 'plains'));
  assert.equal(weatherAt(game.seed, 100, 200, 5000, 'desert'), 'clear');
  const lazy = { job: 'farmer', age: 'adult', traits: ['lazy'], personality: { diligence: 0.2 } };
  const keen = { job: 'farmer', age: 'adult', traits: ['hardworking'], personality: { diligence: 0.9 } };
  assert.equal(weatherQuits(lazy, 'rain'), true);
  assert.equal(weatherQuits(keen, 'rain'), false);
  assert.equal(weatherQuits({ ...lazy, job: 'blacksmith' }, 'rain'), false, 'indoor work goes on');
  const farmer = L.npcs.find((r) => r.job === 'farmer' && alive(r));
  Object.assign(farmer, { traits: ['lazy'], override: null });
  farmer.personality.diligence = 0.1;
  const day = game.day + 1;
  const o = weatherBreak(farmer, 'rain', day, 10 * 60);
  if (farmer.schedule.work.some((en) => en.act === 'work' && en.s <= 600 && en.e > 640) && day % 7 !== farmer.restDay) {
    assert.ok(o && o.act === 'home' && o.weather === 'rain');
  }
});

test('rain soaks the fields, they dry out again, and wet soil grows crops twice as fast', () => {
  const { game, w } = start(12345, 9 * 60);
  game.updateWeather = () => {};
  const crops = game.crops;
  const soil = [...crops.fields.values()].filter((f) => w.regionAt(f.x, f.z));
  assert.ok(soil.length > 5);
  game.weather = { kind: 'rain', level: 1 };
  crops.moisture();
  assert.ok(soil.every((f) => w.getBlock(f.x, f.y, f.z) === B.farmland_wet), 'soaked');
  game.weather = { kind: 'clear', level: 0 };
  game.day += 2;
  crops.moisture();
  assert.ok(soil.every((f) => w.getBlock(f.x, f.y, f.z) === B.farmland), 'dried out');
  const [f, g] = soil;
  w.setBlock(f.x, f.y + 1, f.z, B.air);
  w.setBlock(g.x, g.y + 1, g.z, B.air);
  crops.plant(f.x, f.y + 1, f.z, B.wheat_crop);
  crops.plant(g.x, g.y + 1, g.z, B.wheat_crop);
  crops.wetten(g.x, g.y, g.z, 200);
  const dry = crops.list.get(crops.key(f.x, f.y + 1, f.z));
  const wet = crops.list.get(crops.key(g.x, g.y + 1, g.z));
  for (let i = 0; i < 300; i++) {
    game.minute += 3;
    if (game.minute >= 1440) {
      game.minute -= 1440;
      game.day++;
    }
    crops.t = 0;
    crops.moistT = 99;
    crops.update(0.01);
  }
  assert.ok(crops.stageOf(wet) > crops.stageOf(dry), `wet ${crops.stageOf(wet)} vs dry ${crops.stageOf(dry)}`);
});

test('buckets: fill one at the well, water a patch of farmland', () => {
  const { game, L, p, w } = start(12345);
  game.updateWeather = () => {};
  game.weather = { kind: 'clear', level: 0 };
  p.inv[0] = { item: 'bucket', count: 1 };
  p.selected = 0;
  const well = L.wells[0];
  game.interact(well.x, GROUND, well.z);
  assert.equal(p.inv[0].item, 'water_bucket');
  const f = [...game.crops.fields.values()].find((q) => w.regionAt(q.x, q.z) && w.getBlock(q.x, q.y, q.z) === B.farmland);
  assert.ok(game.waterField(f.x, f.y, f.z));
  assert.equal(w.getBlock(f.x, f.y, f.z), B.farmland_wet);
  assert.equal(p.inv[0].item, 'bucket', 'empty again');
});

test('farmers carry water from the well to dry rows', () => {
  const { game, input, w } = start(12345, 8 * 60);
  game.updateWeather = () => {};
  game.weather = { kind: 'clear', level: 0 };
  game.weatherIn = () => 'clear';
  const wet = () => [...game.crops.fields.values()].filter((f) => w.regionAt(f.x, f.z) && w.getBlock(f.x, f.y, f.z) === B.farmland_wet).length;
  const before = wet();
  for (let i = 0; i < 900 && wet() <= before; i++) game.update(0.2, input);
  assert.ok(wet() > before, 'some rows watered');
});

test('fishing: wait for the bite, strike, and reel the fish in', () => {
  const { game, p } = start(12345);
  p.inv[0] = { item: 'fishing_rod', count: 1 };
  p.selected = 0;
  castLine(game, { x: p.x + 2, y: GROUND - 1, z: p.z });
  const f = game.fishing;
  assert.equal(f.phase, 'wait');
  assert.ok(f.t >= 8 * 0.7 * 0.8, 'a proper wait');
  assert.equal(hook(game), false, 'too early');
  f.t = 0;
  updateFishing(game, 0.05, null);
  assert.equal(f.phase, 'bite');
  assert.ok(hook(game, () => 0.1));
  assert.equal(f.phase, 'reel');
  const input = { isDown: (k) => k === 'Space' && game.fishing && game.fishing.zone < game.fishing.fish, mouse: { down: false } };
  const had = p.inv.reduce((n, s) => n + (s ? s.count : 0), 0);
  for (let i = 0; i < 2000 && game.fishing; i++) updateFishing(game, 0.02, input, () => 0.5);
  assert.equal(game.fishing, null);
  assert.ok(p.inv.reduce((n, s) => n + (s ? s.count : 0), 0) > had, 'something landed');
});

test('merchants carry news between towns, and can be met on the road', () => {
  const { game, input } = start(12345, 7 * 60 + 50);
  const S = game.world.ow.settlements.find((q) => q.condition !== 'abandoned' && game.world.getLayout(q).npcs.some((r) => r.traveler));
  const L = game.world.getLayout(S);
  game.sim.catchUp(L);
  const m = L.npcs.find((r) => r.traveler && alive(r));
  L.econ.ledger.push({ day: game.day, text: 'A baby, Ivy, was born to Rue and Ada Ashwood.' });
  game.sim.departMerchant(L, m, game.sim.abs, game.day, new RNG(3));
  const v = game.sim.visits.get(m.trip.dest).find((q) => q.id === m.trip.visit);
  assert.ok(v.news.some((t) => /Ivy/.test(t)), 'news from home travels with them');
  const dest = game.world.ow.settlements[m.trip.dest];
  const DL = game.world.getLayout(dest);
  game.sim.merchantVisits(DL, m.trip.arrive + 60, new RNG(5));
  assert.ok((DL.econ.rumours || []).some((r) => /Ivy/.test(r.text) && r.from === S.name));
  // Half way there, the merchant is out on the road.
  game.minute += Math.round((m.trip.arrive - m.trip.depart) / 2);
  if (m.ent) game.despawnNpc(m.ent);
  m.away = true;
  m.leaving = false;
  const tr = game.sim.travellers().find((q) => q.rec === m);
  assert.ok(tr);
  game.loadAround(tr.pos.x, tr.pos.z, true);
  game.player.teleport(tr.pos.x + 12, game.world.findStandY(tr.pos.x + 12, tr.pos.z, 6), tr.pos.z);
  game.updateSettlements(true);
  game.caravanT = 0;
  game.updateCaravans(0.1);
  const c = game.caravans.get(tr.key);
  assert.ok(c && !c.dead, 'you meet them on the road');
  assert.ok(game.sim.shopOf(c), 'and can trade from their pack');
  for (let i = 0; i < 5; i++) game.update(0.1, input);
});

test('life goes on: a new mayor is chosen, couples marry, children grow up, beasts come at night', () => {
  const { game } = start(12345);
  const s = game.world.ow.settlements.find((q) => q.type === 'city');
  const L = game.world.getLayout(s);
  const day = game.day + 1;
  const mayor = L.npcs.find((r) => r.job === 'mayor' && alive(r));
  game.sim.recordDeath(L, mayor, 'old age', null, day);
  assert.equal(electMayor(game.sim, L, day), null, 'a couple of days of mourning first');
  const m2 = electMayor(game.sim, L, day + 2);
  assert.ok(m2 && m2.job === 'mayor' && m2 !== mayor);
  const pair = weddings(game.sim, L, day + 2, always);
  // Announced now; the wedding itself is two days on.
  const ev = game.sim.events.upcoming(L).find((q) => q.couple && q.couple.includes(pair[0].idx));
  assert.ok(ev && ev.day === day + 4);
  for (let t = (day + 2) * 1440 + 660; t <= ev.e + 60; t += 60) game.sim.events.hourly(L, t);
  assert.ok(pair && pair[0].partner === pair[1].idx && pair[0].home === pair[1].home);
  const kids = L.npcs.filter((r) => r.age === 'child' && alive(r)).length;
  // (Everyone's birthday is settled the first time the town's days are
  // counted; a childhood is a few weeks.)
  aging(game.sim, L, day);
  const grown = comingOfAge(game.sim, L, day + 30);
  assert.ok(grown && grown.age === 'adult' && grown.job !== 'child' && !grown.look.small);
  assert.equal(L.npcs.filter((r) => r.age === 'child' && alive(r)).length, kids - 1);
  const raid = raids(game.sim, L, day + 2, always);
  assert.ok(raid);
  assert.ok(L.econ.ledger.some((l) => /in the night/.test(l.text)));
  game.day = day + 5;
  const g2 = reload(game);
  const L2 = g2.world.getLayout(g2.world.ow.settlements[s.id]);
  assert.equal(L2.npcs[m2.idx].job, 'mayor');
  assert.equal(L2.npcs[pair[0].idx].partner, pair[1].idx);
  assert.equal(L2.npcs[grown.idx].age, 'adult');
});

test('nobody starves in a big city over three weeks away', () => {
  const game = makeGame(12345);
  const s = game.world.ow.settlements.find((q) => q.name === 'Haycross');
  const L = game.world.getLayout(s);
  const causes = [];
  const rd = game.sim.recordDeath.bind(game.sim);
  game.sim.recordDeath = (L0, rec, cause, killer, when) => {
    causes.push(cause);
    return rd(L0, rec, cause, killer, when);
  };
  for (let d = 3; d <= 21; d += 3) {
    game.day = d;
    simulateTo(game.sim, L, d * DAY + 600);
  }
  assert.ok(!causes.includes('starvation'), causes.join());
});

test('towns grow: new trades, a village becomes a town, a town a walled city', () => {
  const { game, input, sid, L } = start(12345, 8 * 60);
  const s = L.settlement;
  assert.equal(s.type, 'village');
  L.econ.treasury = 5000;
  stockOf(L).wood = 200;
  stockOf(L).stone = 200;
  promote(game.sim, L, 'town', game.day);
  assert.equal(s.type, 'town');
  assert.equal(s.baseType, 'village');
  let day = game.day;
  const types = new Set(L.buildings.map((b) => b.type));
  for (let k = 0; k < 9; k++) {
    day++;
    // (A new building waits for a lot: the town lays a street for it.)
    game.sim.roads.daily(L, day);
    growth(game.sim, L, day);
    for (const p of game.sim.works.projects) if (!p.done && p.sid === sid) game.sim.works.finishNow(L, p);
  }
  const added = L.buildings.map((b) => b.type).filter((t) => !types.has(t));
  assert.ok(added.length >= 1, `new buildings: ${added}`);
  promote(game.sim, L, 'city', day);
  let wall = null;
  for (let k = 0; k < 6 && !wall; k++) {
    day++;
    const r = growth(game.sim, L, day);
    if (r && r.wall) wall = r.wall;
  }
  assert.ok(wall, 'the new city builds a wall');
  // The builders raise it a stretch at a time (not all at once).
  for (let i = 0; i < 3000 && !wall.done; i++) game.update(0.5, input);
  assert.ok(wall.placed > 0 && !wall.done, `under way (${wall.placed}/${wall.total})`);
  game.sim.works.finishNow(L, wall);
  assert.ok(wall.done && L.walled);
  const t = game.sim.works.built.find((q) => q.kind === 'wall').tiles[0];
  assert.equal(game.world.getBlock(t[0], GROUND + 1, t[1]), B.stone_bricks);
  const g2 = reload(game);
  const s2 = g2.world.ow.settlements[sid];
  assert.equal(s2.type, 'city');
  const L2 = g2.world.getLayout(s2);
  assert.ok(L2.walled);
  assert.equal(L2.buildings.length, L.buildings.length, 'laid out as founded, then grown back');
});

test('a walled city out of room pulls down part of its wall and builds beyond it', () => {
  const game = makeGame(12345);
  const input = stubInput();
  game.minute = 8 * 60;
  const s = game.world.ow.settlements.find((q) => q.name === 'Haycross');
  visit(game, input, s);
  const L = game.world.getLayout(s);
  assert.ok(L.walled);
  L.econ.treasury = 9000;
  stockOf(L).wood = 300;
  stockOf(L).stone = 300;
  let day = game.day;
  let breach = null;
  for (let k = 0; k < 30 && !breach; k++) {
    day++;
    game.sim.roads.daily(L, day);
    const r = growth(game.sim, L, day);
    if (r && r.breach) breach = r.breach;
    if (r && r.building && L.plots[r.building.plot].fringe && !breach) {
      for (const p of game.sim.works.projects) if (!p.done && p.sid === s.id) game.sim.works.finishNow(L, p);
      break;
    }
    for (const p of game.sim.works.projects) if (!p.done && p.sid === s.id) game.sim.works.finishNow(L, p);
  }
  // Either a stretch of wall comes down, or (where a gate already opens
  // onto the free ground) the city builds out through the gate.
  const b0 = s.bounds;
  const outside = () => L.buildings.find((q) => q.x1 < b0.x0 || q.x0 > b0.x1 || q.z1 < b0.z0 || q.z0 > b0.z1);
  assert.ok((breach && breach.done) || outside(), 'a breach in the wall, or building beyond a gate');
  if (breach) {
    const tiles = game.sim.works.built.find((q) => q.kind === 'breach').tiles;
    assert.ok(tiles.length >= 3);
    assert.ok(tiles.every(([x, z]) => game.world.getBlock(x, GROUND + 1, z) === B.air));
  } else {
    const o = outside();
    const pl = L.plots.find((q) => q && q.x0 === o.x0 && q.z0 === o.z0);
    const w = game.sim.works.built.find((q) => q.plot === pl?.id && q.sid === s.id);
    assert.ok(pl && w && w.road && w.road.length, 'with a road out to the streets');
  }
  for (let k = 0; k < 9; k++) {
    day++;
    growth(game.sim, L, day);
    for (const p of game.sim.works.projects) if (!p.done && p.sid === s.id) game.sim.works.finishNow(L, p);
  }
  const b = s.bounds;
  const out = L.buildings.find((q) => q.x1 < b.x0 || q.x0 > b.x1 || q.z1 < b.z0 || q.z0 > b.z1);
  assert.ok(out, 'something built outside the old walls');
  assert.equal(game.world.ow.settlementAt(out.x0 + 1, out.z0 + 1), s, 'and it still belongs to the city');
});

test('you can give timber, stone or coin to help a town grow', () => {
  const { game, L, a, sid } = start(12345);
  const mayor = a.npcs.find((n) => n.rec.job === 'mayor');
  game.player.give('planks', 20);
  const planks = countItem(game.player.inv, 'planks');
  const r = respond(mayor, game, 'donate');
  assert.match(r.lines.join(' '), /timber/);
  const wood = stockOf(L).wood;
  const renown = game.sim.renown.get(sid) || 0;
  respond(mayor, game, 'donate', 'wood');
  assert.equal(stockOf(L).wood, wood + planks * 2);
  assert.equal(countItem(game.player.inv, 'planks'), 0);
  assert.ok(game.sim.renown.get(sid) > renown);
});
