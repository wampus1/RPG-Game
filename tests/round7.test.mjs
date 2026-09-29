import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGame, stubInput, stubRenderer, stubUI } from './helpers.mjs';
import { Game } from '../src/game/game.js';
import { B, BLOCKS } from '../src/world/blocks.js';
import { GROUND } from '../src/config.js';
import { respond } from '../src/game/dialogue.js';
import { countItem } from '../src/game/inventory.js';
import { alive, simulateTo, STOCK, WANTS } from '../src/sim/econ.js';
import { weatherAt, SPELL } from '../src/world/weather.js';
import { SaveStore, SLOTS } from '../src/game/saves.js';
import { randomHero, pointsLeft, normalizeHero, STAT_POINTS } from '../src/game/hero.js';
import { ITEMS } from '../src/world/items.js';
import { RECIPES } from '../src/world/recipes.js';
import { musicMood, THEMES } from '../src/game/music.js';
import { Renderer } from '../src/render/renderer.js';
import { Creature } from '../src/entities/creature.js';
import { makeSchedules, availOf } from '../src/entities/npcgen.js';
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

function withHero(hero, seed = 12345) {
  const g0 = makeGame(seed);
  return new Game({ seed, renderer: g0.renderer, audio: null, ui: g0.ui, hero });
}

// A tiny stand-in for localStorage.
function memStore() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
    keys: () => [...m.keys()],
  };
}

test('taxes: a higher rate really brings in more, and the treasury gets it', () => {
  const run = (rate) => {
    const game = makeGame(12345);
    const s = game.world.ow.spawnSettlement;
    const L = game.world.getLayout(s);
    L.econ.tax = rate;
    const t0 = L.econ.treasury;
    let taxed = 0;
    const start = game.sim.abs;
    for (let d = 1; d <= 6; d++) {
      game.day++;
      simulateTo(game.sim, L, start + d * 1440);
      taxed += L.econ.taxY || 0;
    }
    return { taxed, payers: L.npcs.filter((r) => r.taxPaid > 0).length, t0, L };
  };
  const low = run(0.05);
  const high = run(0.25);
  assert.ok(low.taxed > 0, 'even a low rate collects something');
  assert.ok(high.taxed > low.taxed * 2, `a higher rate collects more (${low.taxed} vs ${high.taxed})`);
  assert.ok(high.payers > 3, 'plenty of people pay');
});

test('taxes: citizens pay a head tax plus the rate on what they earned in town', () => {
  const { game, L, sid, p } = start(12345);
  game.sim.citizen = { sid, since: 1, host: null, hostBed: null, home: null, taxDay: game.day, owed: 0 };
  L.econ.tax = 0.2;
  const t = game.sim.playerTax(L, 50);
  assert.equal(t.poll, 2);
  assert.equal(t.share, 10);
  assert.equal(t.tax, 12);
  // Earnings from work in town are counted for the next tax day.
  game.sim.careers.pay(40);
  assert.equal(game.sim.citizen.earned, 40);
  const coins = countItem(p.inv, 'coin');
  const treasury = L.econ.treasury;
  game.sim.dailyCivic(L, game.day + 1, new RNG(5));
  const paid = coins - countItem(p.inv, 'coin');
  assert.equal(paid, game.sim.playerTax(L, 40).tax, 'you paid the head tax and your share');
  assert.ok(L.econ.treasury >= treasury + paid, 'into the treasury');
  assert.equal(game.sim.citizen.lastTax.earned, 40);
});

test('save slots: five of your own and an autosave, listed, loaded and deleted', () => {
  const st = memStore();
  st.setItem('tessera-save-v1', JSON.stringify({ seed: 5, day: 3, minute: 600 }));
  const store = new SaveStore(st);
  assert.equal(SLOTS.length, 6);
  assert.equal(store.list().find((q) => q.id === '1').meta.day, 3, 'an old save moves into slot 1');
  assert.equal(st.getItem('tessera-save-v1'), null);
  const game = makeGame(12345);
  game.playerName = 'Tamsin';
  store.save('3', game);
  store.save('auto', game);
  const list = store.list();
  assert.equal(list.find((q) => q.id === '3').meta.name, 'Tamsin');
  assert.ok(store.has('auto'));
  assert.ok(['3', 'auto'].includes(store.latest().id));
  const data = store.load('3');
  assert.equal(data.seed, 12345);
  const g2 = new Game({ seed: data.seed, renderer: game.renderer, audio: null, ui: game.ui, save: data });
  assert.equal(g2.playerName, 'Tamsin');
  store.remove('3');
  assert.ok(!store.has('3'));
  assert.equal(store.load('3'), null);
});

test('children play tag and hide-and-seek in the streets and round the houses', () => {
  const { game, input, a } = start(12345, 14 * 60);
  const kids = a.npcs.filter((n) => n.rec.age === 'child' && game.playtime.free(n));
  assert.ok(kids.length >= 2, 'children out playing');
  for (const n of kids) {
    n.playMood = 'game';
    n.moodUntil = 1e12;
  }
  // Tag: whoever is it catches someone.
  game.playtime.gather = () => null;
  const tag = game.playtime.start(a.layout, kids, 'tag');
  tag.span = 1e9;
  const first = tag.it;
  for (let i = 0; i < 600 && tag.it === first; i++) game.update(0.1, input);
  assert.notEqual(tag.it, first, 'someone got tagged');
  game.playtime.end(tag);
  // Hide and seek: count, hide, get found.
  const hide = game.playtime.start(a.layout, kids, 'hide');
  hide.span = 1e9;
  const seen = new Set();
  let found = 0;
  for (let i = 0; i < 1500 && !(seen.has('seek') && found); i++) {
    game.update(0.1, input);
    seen.add(hide.phase);
    found = Math.max(found, hide.found.size);
  }
  assert.ok(seen.has('count') && seen.has('seek'), 'counting, then seeking');
  assert.ok(found > 0, 'somebody was found');
  for (const [n, s] of hide.spots) assert.ok(!game.world.isWaterAt(s.x, s.y, s.z) && n, 'hiding places are on dry land');
});

test('a builder who likes you knocks something off enlarging your house', () => {
  const { game, input, L, a, p, sid } = start(7, 9 * 60);
  const hall = L.buildings.find((b) => b.type === 'townhall');
  const mayor = a.npcs.find((n) => n.rec.job === 'mayor');
  const builder = a.npcs.find((n) => n.rec.job === 'builder') || a.npcs.find((n) => n.rec.age === 'adult' && !['mayor', 'guard'].includes(n.rec.job));
  builder.rec.job = 'builder';
  p.give('coin', 800);
  p.teleport(hall.inside.x, 6, hall.inside.z);
  game.currentSettlement = L.settlement;
  respond(mayor, game, 'citizen', 'yes');
  for (let i = 0; i < 40000 && !game.sim.construction.done; i++) game.update(0.25, input);
  assert.ok(game.sim.construction.done);
  const full = game.sim.works.expansionTerms(L, L.buildings[game.sim.citizen.home]).cost;
  const e = game.sim.repEntry(sid, builder.rec.idx);
  e.v -= game.sim.opinion(builder);
  assert.match(respond(builder, game, 'expand').lines.join(' '), new RegExp(`¤${full}\\b`));
  e.v += 80;
  const cut = Math.round(full * 0.7);
  const offer = respond(builder, game, 'expand').lines.join(' ');
  assert.match(offer, new RegExp(`¤${cut}\\b`), 'an old friend gets 30% off');
  assert.match(offer, /old friend/);
  const before = countItem(p.inv, 'coin');
  respond(builder, game, 'expand', 'yes');
  assert.equal(countItem(p.inv, 'coin'), before - cut);
});

test('breaking bits of your own house bothers nobody', () => {
  const { game, input, L, a, p, sid } = start(7, 9 * 60);
  const hall = L.buildings.find((b) => b.type === 'townhall');
  const mayor = a.npcs.find((n) => n.rec.job === 'mayor');
  p.give('coin', 600);
  p.teleport(hall.inside.x, 6, hall.inside.z);
  game.currentSettlement = L.settlement;
  respond(mayor, game, 'citizen', 'yes');
  for (let i = 0; i < 40000 && !game.sim.construction.done; i++) game.update(0.25, input);
  const home = L.buildings[game.sim.citizen.home];
  let wall = null;
  for (let x = home.x0; x <= home.x1 && !wall; x++) {
    const id = game.world.getBlock(x, 7, home.z1);
    if (BLOCKS[id].render === 'cube' && BLOCKS[id].solid) wall = [x, 7, home.z1, id];
  }
  assert.ok(wall, 'a wall to knock out');
  // Someone standing right there watching.
  const n = a.npcs.find((q) => !q.dead && !q.sleeping && q.rec.age === 'adult');
  n.teleport(wall[0], game.world.findStandY(wall[0], wall[2] + 2, 6), wall[2] + 2);
  n.state = 'routine';
  const op = game.sim.opinion(n);
  p.teleport(wall[0], game.world.findStandY(wall[0], wall[2] + 1, 6), wall[2] + 1);
  for (let k = 0; k < 5; k++) game.breakBlock(wall[0], wall[1], wall[2], true);
  assert.equal(game.world.getBlock(wall[0], wall[1], wall[2]), B.air);
  assert.equal(game.sim.opinion(n), op, 'no one minds');
  assert.equal(game.vandal.get(sid) || 0, 0);
  assert.ok(!game.sim.works.active(sid).some((q) => q.kind === 'repair' && q.bid === home.id), 'and no repair crew comes');
});

test('fishers only cast onto open water, and lines are drawn in depth order', () => {
  const { game, a, w } = start(12345);
  const n = a.npcs.find((q) => q.rec.age === 'adult');
  // Water under a plank: not a fishing spot.
  const x = n.x;
  const z = n.z;
  n.update = () => {};
  n.moveT = 1;
  n.dir = 3;
  n.atGoal = true;
  n.heldItem = () => 'fishing_rod';
  for (let k = 1; k <= 3; k++) {
    w.setBlock(x + k, n.y, z, B.air);
    w.setBlock(x + k, n.y + 1, z, B.air);
    w.setBlock(x + k, n.y - 1, z, B.water);
  }
  w.setBlock(x + 1, n.y - 1, z, B.planks);
  w.setBlock(x + 1, n.y - 2, z, B.water);
  n.fishKey = null;
  const t = n.fishSpot();
  assert.ok(t, 'open water two tiles out');
  assert.equal(t.x, x + 2);
  assert.equal(w.getBlock(t.x, t.y + 1, t.z), B.air, 'nothing over it');
  w.setBlock(x + 2, n.y, z, B.planks);
  w.setBlock(x + 3, n.y, z, B.planks);
  n.fishKey = null;
  assert.equal(n.fishSpot(), null, 'no casting through a wall or onto planks');
  // Rod, line and bobber go into the depth-sorted rows, not on top.
  game.fishing = { phase: 'wait', x: game.player.x + 2, y: GROUND - 1, z: game.player.z + 3, dip: 0 };
  const fake = { ctx: {}, camX: 0, camY: 0, time: 0 };
  const buckets = new Map();
  game.visibleEntities = [];
  Renderer.prototype.fishingDecos.call(fake, game, buckets, -1e9, 1e9);
  const rows = [...buckets.keys()];
  assert.ok(buckets.get(game.player.z + 3).some((q) => q.deco && q.layer === GROUND + 1), 'the bobber sits in its own row');
  assert.ok(rows.length >= 3, 'the line crosses rows');
});

test('market stalls are horizontal and nothing new is built by a gate', () => {
  const game = makeGame(12345);
  const towns = game.world.ow.settlements.filter((s) => s.type !== 'village' && s.condition !== 'abandoned').slice(0, 4);
  const w = game.world;
  for (const s of towns) {
    const L = w.getLayout(s);
    game.loadAround(L.plaza.cx, L.plaza.cz, true);
    const stalls = L.spots.filter((q) => q.stall);
    assert.ok(stalls.length, `${s.name} has stalls`);
    for (const st of stalls) {
      const front = st.z + (st.face === 0 ? 1 : -1);
      for (let dx = 0; dx <= 1; dx++) assert.equal(w.getBlock(st.x + dx, GROUND, front), B.counter, 'two counters side by side in front');
      // Nothing over the stallholder's head but the canopy up on its posts.
      assert.equal(w.getBlock(st.x, GROUND, st.z), B.air);
      assert.equal(w.getBlock(st.x, GROUND + 1, st.z), B.air);
      assert.equal(w.getBlock(st.x, GROUND + 2, st.z), B.canopy);
      assert.equal(w.getBlock(st.x - 1, GROUND, st.z), B.fence);
      assert.equal(w.getBlock(st.x + 2, GROUND, st.z), B.fence);
    }
    const exits = L.exits();
    assert.ok(exits.length, 'roads lead out');
    const g = exits[0];
    assert.equal(L.gateClear({ x0: g.x + 1, z0: g.z + 1, x1: g.x + 4, z1: g.z + 4 }), false, 'too close to the gate');
    for (let i = 0; i < 3; i++) {
      const plot = L.openPlot();
      if (!plot) break;
      assert.ok(L.gateClear(plot, exits), 'new lots keep the gates clear');
    }
  }
});

test('weather covers wide areas and changes in long spells', () => {
  assert.equal(SPELL, 360);
  let same = 0;
  let n = 0;
  for (let i = 0; i < 300; i++) {
    const x = 200 + i * 37;
    const z = 150 + ((i * 53) % 700);
    const t = i * 97;
    if (weatherAt(99, x, z, t, 'plains') === weatherAt(99, x + 40, z + 20, t, 'plains')) same++;
    n++;
  }
  assert.ok(same / n > 0.75, `nearby places mostly share the weather (${same}/${n})`);
  // And it does change as the fronts drift by.
  const kinds = new Set();
  for (let t = 0; t < 1440 * 20; t += 180) kinds.add(weatherAt(99, 1000, 500, t, 'plains'));
  assert.ok(kinds.size >= 2);
});

test('meals and lessons are staggered, not all at once', () => {
  const game = makeGame(12345);
  const L = game.world.getLayout(game.world.ow.settlements.find((s) => s.type !== 'village' && s.condition !== 'abandoned'));
  const avail = { ...availOf(L), study: true };
  const lunches = [];
  const lessons = new Set();
  for (let i = 0; i < 40; i++) {
    const rng = new RNG(1000 + i);
    const adult = { job: 'blacksmith', age: 'adult', personality: { chronotype: 0.5, diligence: 0.5, sociability: 0.4 }, hobbies: ['reading'] };
    const eat = makeSchedules(adult, rng, avail).work.find((e) => e.act === 'eat' && e.s > 600 && e.s < 900);
    if (eat) lunches.push(eat.s);
    const child = { job: 'child', age: 'child', personality: { chronotype: 0.5, diligence: 0.5, sociability: 0.5 }, hobbies: [] };
    const study = makeSchedules(child, rng, avail).work.find((e) => e.act === 'study');
    if (study) lessons.add(study.s < 720 ? 'morning' : 'afternoon');
  }
  assert.ok(Math.max(...lunches) - Math.min(...lunches) >= 60, 'lunch spread over an hour or more');
  assert.equal(lessons.size, 2, 'morning and afternoon classes');
});

test('alarm bells: more in bigger places, and the night watch rings them', () => {
  const game = makeGame(12345);
  const input = stubInput();
  const ow = game.world.ow;
  const count = (t) => game.world.getLayout(ow.settlements.find((s) => s.type === t && s.condition !== 'abandoned')).bells.length;
  assert.equal(count('village'), 1);
  assert.equal(count('town'), 2);
  assert.ok(count('city') >= 3);
  const s = ow.settlements.find((q) => q.type !== 'village' && q.condition !== 'abandoned' && game.world.getLayout(q).npcs.filter((r) => r.job === 'guard').length >= 3);
  game.minute = 23 * 60;
  game.day = 3;
  const { L, a } = visit(game, input, s);
  for (let i = 0; i < 300; i++) game.update(0.1, input);
  const guards = a.npcs.filter((n) => n.rec.job === 'guard');
  let watch = guards.find((n) => !n.sleeping && !n.dead);
  if (!watch) {
    watch = guards[0];
    watch.wake();
  }
  assert.ok(guards.some((n) => n.sleeping), 'most of the watch asleep');
  const c = new Creature(game, 'wolf', watch.x + 3, watch.y, watch.z);
  c.angry = true;
  game.creatures.push(c);
  game.moveEntity(c, c.x, c.y, c.z);
  assert.ok(game.alarmNeeded(watch, c));
  let woke = null;
  const ring = game.ringBell.bind(game);
  game.ringBell = (...args) => (woke = ring(...args));
  for (let i = 0; i < 400 && woke === null; i++) game.update(0.1, input);
  assert.ok(woke > 0, 'the bell woke the others');
  assert.ok(game.bellsOf(L).some((b) => game.world.getState(b.x, GROUND, b.z)), 'the bell swings');
  // Ringing it yourself for nothing annoys the watch.
  game.ringBell = ring;
  game.creatures = [];
  L.econ.bellAt = -999;
  const b = game.bellsOf(L)[0];
  const g = guards.find((n) => !n.dead);
  const op = game.sim.opinion(g);
  game.interact(b.x, GROUND, b.z);
  assert.ok(game.sim.opinion(g) < op);
});

test('character creation: a shipwreck on the beach, or at home in a town that knows you', () => {
  const hero = { ...randomHero(7), name: 'Tamsin', kit: 'soldier', stats: { str: 2, agi: 2, end: 5, cha: 3 }, specialties: ['angler', 'haggler'], traits: [] };
  assert.equal(pointsLeft(normalizeHero(hero)), STAT_POINTS - 4);
  const crash = withHero({ ...hero, origin: 'crash' });
  const p = crash.player;
  assert.equal(crash.playerName, 'Tamsin');
  assert.equal(crash.sim.citizen, null, 'nobody knows you');
  let water = 0;
  for (let dz = -4; dz <= 4; dz++) for (let dx = -4; dx <= 4; dx++) if (crash.world.isWaterAt(p.x + dx, p.y - 1, p.z + dz)) water++;
  assert.ok(water > 0, 'washed up by the sea');
  assert.equal(p.maxHp, 26, 'endurance 5 gives 6 more health');
  assert.equal(p.equip.head, 'iron_helmet', 'starting armour is worn');
  assert.equal(p.equip.body, 'leather_tunic');
  assert.ok(countItem(p.inv, 'iron_sword'));
  const native = withHero({ ...hero, origin: 'native' });
  const c = native.sim.citizen;
  assert.ok(c && c.native, 'a citizen from the start');
  assert.ok(c.host !== null, 'living with family');
  const L = native.sim.layoutOf(c.sid);
  const people = L.npcs.filter((r) => alive(r) && r.age === 'adult');
  assert.ok(people.every((r) => native.sim.repEntry(c.sid, r.idx).v >= 35 && native.sim.repEntry(c.sid, r.idx).met), 'everyone knows you');
  assert.equal(native.world.ow.settlementAt(native.player.x, native.player.z).id, c.sid);
  // Perks work: better prices for a haggler with charm.
  const g2 = reload(native);
  assert.equal(g2.hero.name, 'Tamsin');
  assert.equal(g2.player.maxHp, 26);
  assert.deepEqual(g2.player.equip, native.player.equip);
});

test('armour and clothes: worn, drawn, protective, crafted and sold', () => {
  const { game, p, a } = start(12345);
  p.inv[5] = { item: 'chainmail', count: 1 };
  p.inv[6] = { item: 'iron_helmet', count: 1 };
  assert.equal(p.wear(5), 'body');
  assert.equal(p.wear(6), 'head');
  assert.equal(p.inv[5], null);
  assert.equal(p.look.gear.body, 'chain');
  assert.equal(p.look.hat, 'helmet');
  assert.ok(Math.abs(p.armorValue() - 0.28) < 1e-9);
  const hp = p.hp;
  const wolf = new Creature(game, 'wolf', p.x + 1, p.y, p.z);
  game.damage(p, 10, wolf);
  assert.equal(hp - p.hp, 7, 'armour takes some of the blow');
  assert.ok(p.unwear('head'));
  assert.equal(p.equip.head, null);
  assert.ok(countItem(p.inv, 'iron_helmet'));
  for (const k of ['leather_tunic', 'iron_breastplate', 'straw_hat', 'leather_boots']) assert.ok(RECIPES.some((r) => r.out === k), `${k} can be made`);
  assert.ok(STOCK.smith.includes('chainmail') && WANTS.smith.includes('iron_helmet'));
  assert.ok(STOCK.tailor.includes('linen_shirt'));
  assert.ok(Object.values(ITEMS).filter((i) => i.kind === 'armor').length >= 12);
  const g2 = reload(game);
  assert.equal(g2.player.equip.body, 'chainmail', 'kept after a reload');
  assert.ok(a);
});

test('the music follows where you are and what you are doing', () => {
  const { game, input, p } = start(12345, 12 * 60);
  const s = game.currentSettlement;
  assert.ok(s);
  assert.equal(musicMood(game), s.type === 'village' ? 'village' : s.type);
  game.minute = 23 * 60;
  assert.match(musicMood(game), /:night$/);
  game.minute = 12 * 60;
  const wolf = new Creature(game, 'wolf', p.x + 2, p.y, p.z);
  wolf.angry = true;
  wolf.target = p;
  game.creatures.push(wolf);
  assert.equal(musicMood(game), 'fight_monsters');
  game.creatures = [];
  const ruin = game.world.ow.settlements.find((q) => q.condition === 'abandoned');
  visit(game, input, ruin);
  assert.equal(musicMood(game), 'ruins');
  for (const k of ['plains', 'desert', 'forest', 'village', 'graveyard', 'fight_guards']) assert.ok(THEMES[k]);
});

test('a new game made on the character screen can start without a hero (old saves and tests)', () => {
  const g = new Game({ seed: 4242, renderer: stubRenderer(), audio: null, ui: stubUI() });
  assert.equal(g.hero, null);
  assert.ok(countItem(g.player.inv, 'wood_pickaxe'));
});
