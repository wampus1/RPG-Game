import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGame, stubInput } from './helpers.mjs';
import { B, BLOCKS } from '../src/world/blocks.js';
import { GROUND } from '../src/config.js';
import { DAY, alive, stockOf } from '../src/sim/econ.js';
import { TIERS } from '../src/sim/growth.js';
import { topicsFor, respond, openingLine } from '../src/game/dialogue.js';
import { exchangeFor } from '../src/game/chatter.js';
import { STYLES, styleOf } from '../src/sim/events.js';
import { RNG } from '../src/util/rng.js';

function start(seed = 7, minute = 9 * 60) {
  const game = makeGame(seed);
  const input = stubInput();
  game.minute = minute;
  for (let i = 0; i < 20; i++) game.update(0.1, input);
  const [sid, a] = [...game.active][0];
  return { game, input, sid, a, L: a.layout, p: game.player };
}

// (As the game loads a save: a new game from it.)
const reload = (game) => {
  const data = JSON.parse(JSON.stringify(game.serialize()));
  return new game.constructor({ seed: data.seed, renderer: game.renderer, audio: null, ui: game.ui, save: data });
};

const tick = (game, input, n = 20, dt = 0.25) => {
  for (let i = 0; i < n; i++) game.update(dt, input);
};

// ------------------------------------------------------------ population
test('villages and towns start bigger, with more guards, and need more to grow', () => {
  const game = makeGame(4242);
  const pops = { village: [], town: [] };
  for (const s of game.world.ow.settlements) {
    // (Ruins left empty long ago don't count.)
    if (!pops[s.type] || s.condition === 'abandoned' || s.deserted) continue;
    const L = game.world.getLayout(s);
    pops[s.type].push({ n: L.npcs.length, guards: L.npcs.filter((r) => r.job === 'guard').length });
  }
  const avg = (xs, k) => xs.reduce((m, q) => m + q[k], 0) / Math.max(1, xs.length);
  assert.ok(avg(pops.village, 'n') >= 12, `villages start with ${avg(pops.village, 'n')}`);
  assert.ok(avg(pops.town, 'n') >= 26, `towns start with ${avg(pops.town, 'n')}`);
  assert.ok(avg(pops.village, 'guards') >= 2, 'villages have a couple of guards');
  assert.ok(avg(pops.town, 'guards') >= avg(pops.village, 'guards'));
  assert.ok(TIERS.village.pop >= 26 && TIERS.town.pop >= 50, 'growing a tier takes more people');
});

// ------------------------------------------------------------ secession
test('a town can break away (hostile) or swear to a neighbouring realm (worse)', () => {
  const { game } = start(7);
  const realms = game.sim.realms;
  const ow = game.world.ow;
  const town = ow.settlements.find((s) => s.civ && !realms.isCapital(s) && realms.members(s.civ).length > 2);
  const L = game.sim.layoutOf(town.id);
  const old = town.civ;
  const free = realms.secede(L, game.day, new RNG(1), null);
  assert.ok(free && !free.joined && town.civ !== old, 'it declared independence');
  assert.equal(realms.standing(old, town.civ), 'hostile');
  assert.ok(realms.relation(old, town.civ).score <= -40);
  assert.ok(L.econ.ledger.some((l) => /independence/.test(l.text)));
  // Another town goes over to a different realm instead.
  const other = ow.settlements.find((s) => s.civ && s.civ !== old && s.civ !== town.civ && !realms.isCapital(s));
  const L2 = game.sim.layoutOf(other.id);
  const from = other.civ;
  const before = realms.relation(from, old).score;
  const r = realms.secede(L2, game.day, new RNG(1), old);
  assert.ok(r.joined && other.civ === old);
  assert.ok(realms.relation(from, old).score <= before - 55, 'switching sides costs more than going it alone');
  // It all survives a reload.
  const g2 = reload(game);
  assert.equal(g2.world.ow.settlements[town.id].civ.name, town.civ.name);
  assert.equal(g2.world.ow.settlements[other.id].civ.id, old.id);
});

// ------------------------------------------------------------ herbalists
test('herbalists appear in some villages (herbs, no potions) and tend the sick', () => {
  // (Potions need a realm that has learned alchemy: none has, at the start.)
  const game = makeGame(4242, { learned: false });
  let villages = 0;
  let withHerb = 0;
  for (const s of game.world.ow.settlements) {
    if (s.type !== 'village') continue;
    const L = game.sim.layoutOf(s.id);
    villages++;
    const b = L.buildings.find((q) => q.type === 'herbalist');
    if (!b) continue;
    withHerb++;
    const store = L.econ.biz[b.id] ? L.econ.biz[b.id].store : {};
    assert.ok(!Object.keys(store).some((k) => k.startsWith('potion_')), `${s.name}'s herbalist sells no potions`);
  }
  assert.ok(withHerb > 0 && withHerb < villages, `${withHerb}/${villages} villages have one`);
});

// ------------------------------------------------------------ set down
test('things set down stay put, have no collision, and are mined back up', () => {
  const { game, input, p } = start(7);
  const w = game.world;
  p.inv[p.selected] = { item: 'apple', count: 3 };
  const x = p.x + 1;
  const z = p.z;
  const y = w.findStandY(x, z, p.y);
  assert.ok(game.setDown(x, y, z, 'apple', 3, null));
  assert.equal(w.getBlock(x, y, z), B.placed_item);
  assert.equal(BLOCKS[B.placed_item].solid, false);
  assert.ok(w.canStand(x, y, z), 'you can walk over it');
  // Standing on it doesn't pick it up.
  p.teleport(x, y, z);
  tick(game, input, 10, 0.1);
  assert.ok(game.placed.has(`${x},${y},${z}`));
  // Survives a save.
  const g2 = reload(game);
  assert.equal(g2.placed.get(`${x},${y},${z}`).item, 'apple');
  const got = game.takePlaced(x, y, z);
  assert.equal(got.count, 3);
  assert.equal(w.getBlock(x, y, z), B.air);
});

// ------------------------------------------------------------ gates
test('city gates open by day and a guard shuts them at night', () => {
  const game = makeGame(7);
  const input = stubInput();
  const city = game.world.ow.settlements.find((s) => s.type === 'city');
  const L = game.world.getLayout(city);
  assert.ok(L.gates && L.gates.length, 'the city has gates');
  const g = L.gates[0];
  const w = game.world;
  game.player.teleport(g.x, GROUND, g.z + 3);
  game.loadAround(g.x, g.z, true);
  game.updateSettlements(true);
  game.minute = 12 * 60;
  tick(game, input, 30, 0.1);
  assert.equal(w.getBlock(g.x, GROUND, g.z), B.city_gate);
  assert.ok(w.getState(g.x, GROUND, g.z), 'open by day');
  game.minute = 22 * 60;
  game.player.teleport(g.x + 8, w.findStandY(g.x + 8, g.z + 8, GROUND), g.z + 8);
  // A guard nearby, awake.
  const guard = game.npcs.find((n) => !n.dead && n.rec.job === 'guard' && n.layout === L);
  assert.ok(guard, 'the watch is about');
  guard.teleport(g.x + 2, GROUND, g.z + 2);
  guard.sleeping = false;
  // (Anyone let through, the watch shuts it again a few seconds after.)
  tick(game, input, 80, 0.1);
  assert.equal(w.getState(g.x, GROUND, g.z), false, 'shut at night');
  assert.equal(w.canStand(g.x, GROUND, g.z, false), false, 'a shut gate stops you');
});

test('a walled city with buildings outside its walls plans an outer wall', () => {
  const game = makeGame(12345);
  const city = game.world.ow.settlements.find((s) => s.type === 'city');
  const L = game.sim.layoutOf(city.id);
  const b = L.bounds;
  const plan = L.outerWallPlan({ x0: b.x0 - 6, z0: b.z0 - 6, x1: b.x1 + 6, z1: b.z1 + 6 });
  assert.ok(plan && plan.tiles.length > 20, 'a ring of wall round the wider town');
  assert.ok(Array.isArray(plan.gates));
});

// ------------------------------------------------------------ stables
test('an animal handler tames horses, a carpenter builds wagons, merchants take them out', () => {
  // (Seed 8: a town.)
  const { game, L } = start(8);
  const st = game.sim.stables;
  const people = L.npcs.filter((r) => alive(r) && !r.visitor);
  let handler = people.find((r) => r.job === 'handler');
  for (let d = 0; d < 30 && !handler; d++) {
    st.daily(L, game.day + d, new RNG(d));
    handler = L.npcs.find((r) => r.job === 'handler');
  }
  assert.ok(handler, 'someone took on the horses');
  const s0 = st.of(L);
  const h0 = s0.horses;
  for (let d = 0; d < 40; d++) st.daily(L, game.day + d, new RNG(100 + d));
  assert.ok(s0.horses > h0 || s0.horses >= st.cap(L).horses, 'horses tamed');
  // A wagon when there's a carpenter, timber and coin.
  if (L.npcs.some((r) => r.job === 'carpenter' && alive(r))) {
    stockOf(L).wood = 60;
    L.econ.treasury = 500;
    for (let d = 0; d < 60; d++) st.daily(L, game.day + d, new RNG(300 + d));
    assert.ok(s0.wagons >= 1, 'a wagon built');
  }
  const m = st.take(L, 'wagon');
  assert.ok(m, 'one taken out');
  const out = s0.horsesOut;
  st.giveBack(m);
  assert.equal(s0.horsesOut, out - 1);
  assert.ok(st.hitch(L), 'a hitching post by the road in');
});

// ------------------------------------------------------------ caravans
test('trading companies travel by day, camp outside towns to trade, then move on', () => {
  const { game, input, sid, L } = start(12345, 9 * 60);
  const C = game.sim.caravans;
  assert.ok(C.list.length >= 3, 'a few companies on the roads');
  for (const g of C.list) {
    assert.ok(g.wagons >= 1 && g.members.some((m) => m.mount === 'horse'), 'wagons and riders');
    assert.ok(g.banner);
  }
  const g = C.list[0];
  g.state = 'road';
  g.dest = sid;
  g.arrive = game.sim.abs - 1;
  tick(game, input, 40);
  assert.equal(g.state, 'stay');
  const camp = game.sim.camps.get(`c:${g.id}`);
  assert.ok(camp, 'they pitched camp outside town');
  assert.ok(camp.horses.length >= 2 && camp.wagons.length >= 1, 'the horses tied up and the wagon beside them');
  assert.ok((g.leave - game.sim.abs) / 60 >= 20, 'staying a day or two');
  const ents = [...C.ents.values()];
  assert.ok(ents.length >= 2, 'you meet them in town');
  const trader = ents.find((e) => e.rec.role === 'trader');
  assert.ok(game.sim.shopOf(trader), 'and trade with them');
  assert.ok(topicsFor(trader, game).some((t) => t.id === 'co_company'));
  assert.ok(respond(trader, game, 'co_company').lines.length);
  assert.ok(L.econ.ledger.some((l) => /made camp outside town to trade/.test(l.text)));
  // Their tied horses and the wagon stand there.
  tick(game, input, 10);
  assert.ok([...game.tied.keys()].some((k) => k.startsWith(`c:${g.id}`)));
  assert.ok([...game.props.keys()].some((k) => k.startsWith(`c:${g.id}`)));
  // They set off by day...
  g.leave = game.sim.abs - 1;
  tick(game, input, 10);
  assert.equal(g.state, 'road');
  assert.ok(!game.sim.camps.get(`c:${g.id}`), 'camp struck');
  const tr = game.sim.travellers().filter((q) => q.company === g);
  assert.equal(tr.length, g.members.length);
  assert.ok(tr.every((q) => q.mount && (q.mount.kind === 'wagon' || q.mount.kind === 'horse') && q.mount.banner === g.banner), 'riding and driving, under their banner');
  // ...and a company survives a reload.
  const g2 = reload(game);
  assert.equal(g2.sim.caravans.list.length, C.list.length);
});

test('at night a company on the road camps by the roadside and gets down', () => {
  const { game, input } = start(7, 10 * 60);
  const C = game.sim.caravans;
  const g = C.list[1];
  // Half way along, at night.
  game.minute = 22 * 60;
  const from = game.world.ow.settlements[g.from];
  g.state = 'road';
  g.departAt = game.sim.abs - 8 * 60;
  g.arrive = game.sim.abs + 18 * 60;
  const spot = C.roadSpots().find((r) => r.g === g);
  assert.ok(spot && spot.camped, 'camped at night');
  assert.ok(from);
  game.player.teleport(spot.pos.x + 12, game.world.findStandY(spot.pos.x + 12, spot.pos.z, GROUND), spot.pos.z);
  game.loadAround(spot.pos.x, spot.pos.z, true);
  tick(game, input, 40);
  const key = [...game.roadCamp.keys()].find((k) => k.startsWith(`rc:${g.id}:`));
  assert.ok(key, 'a camp by the road');
  const rc = game.roadCamp.get(key);
  assert.equal(game.world.getBlock(rc.ops[0][0], rc.ops[0][1], rc.ops[0][2]), B.tent);
  const riders = game.sim.travellers().filter((q) => q.company === g);
  assert.ok(riders.every((q) => !q.mount), 'off their horses for the night');
  // Morning: struck, and back in the saddle.
  game.day += 1;
  game.minute = 7 * 60;
  tick(game, input, 20);
  assert.ok(!game.roadCamp.has(key));
  assert.equal(game.world.getBlock(rc.ops[0][0], rc.ops[0][1], rc.ops[0][2]) === B.tent, false);
});

// ------------------------------------------------------------ nomads
test('some nomad bands come with a plain wagon and horses', () => {
  const game = makeGame(7);
  const N = game.sim.nomads;
  const always = { chance: () => true };
  let mounted = 0;
  for (const s of game.world.ow.settlements) {
    const L = game.sim.layoutOf(s.id);
    const b = N.arrive(L, 3, always);
    if (b && b.mounts && b.mounts.length) {
      mounted++;
      assert.ok(b.mounts.some((m) => m.kind === 'wagon'));
      assert.ok(b.mounts.every((m) => !m.banner), 'no decoration');
    }
  }
  assert.ok(mounted > 0);
});

// ------------------------------------------------------------ outings
test('townsfolk go in a small group to a do in another town of the realm, and talk about it after', () => {
  const { game, input, sid, L } = start(7, 10 * 60);
  const s = L.settlement;
  const O = game.sim.outings;
  const dest = game.world.ow.settlements.find((o) => o !== s && o.civ === s.civ && Math.hypot(o.cx - s.cx, o.cz - s.cz) < 18);
  const DL = game.sim.layoutOf(dest.id);
  const ev = game.sim.events.feast(DL, game.day, 0);
  const t = O.plan(L, dest, ev, game.day, new RNG(5), game.sim.abs);
  assert.ok(t, 'a trip planned');
  const all = [...t.members, t.guard].filter((i) => i !== null);
  assert.ok(all.length >= 2 && all.length <= 4, 'a small group');
  assert.ok(all.length <= Math.ceil(L.npcs.filter((r) => alive(r) && !r.visitor).length / 5), 'no more than a fifth of the town');
  assert.ok(!all.some((i) => L.npcs[i].job === 'mayor'), 'the mayor stays');
  // A citizen they like is asked along.
  game.sim.citizen = { sid, since: game.day, host: null, hostBed: null, home: null, taxDay: game.day, owed: 0 };
  game.sim.repEntry(sid, t.lead).v = 40;
  t.player = 'ask';
  t.asked = true;
  const lead = L.npcs[t.lead].ent;
  if (lead) {
    const tops = topicsFor(lead, game).map((q) => q.id);
    assert.ok(tops.includes('trip'), 'you can say yes');
    respond(lead, game, 'trip', 'no');
    assert.equal(t.player, 'declined');
  }
  // Off they go (the hour after they meant to).
  const step = (until) => {
    while (game.sim.abs < until) {
      game.minute += 30;
      if (game.minute >= DAY) {
        game.minute -= DAY;
        game.day++;
      }
      tick(game, input, 3, 0.2);
    }
  };
  step(t.depart + 150);
  assert.equal(t.phase, 'out');
  assert.ok(t.went.every((i) => L.npcs[i].trip && L.npcs[i].trip.outing === t.id));
  const guests = (game.sim.visits.get(dest.id) || []).filter((v) => v.outing === t.id);
  assert.equal(guests.length, t.went.length, 'expected as guests there');
  assert.ok(guests.every((v) => v.guest && v.traded), 'visiting, not trading');
  assert.ok(t.leave >= ev.e, 'they stay for the do');
  // Home again, with something to talk about.
  O.home(L, t, t.ret, Math.floor(t.ret / DAY));
  const r = L.npcs[t.lead];
  assert.ok(r.tripMem && r.tripMem.dest === dest.name);
  assert.ok(!r.away && !r.outing);
  assert.ok(L.econ.ledger.some((l) => /came back from/.test(l.text)));
  game.day = r.tripMem.day;
  const a = { rec: r, layout: L, rng: new RNG(3) };
  const went = L.npcs[t.went.find((i) => i !== r.idx)];
  const stay = L.npcs.find((q) => alive(q) && q.age === 'adult' && !t.went.includes(q.idx));
  const lines = new Set();
  for (let k = 0; k < 60; k++) {
    a.rng = new RNG(k);
    lines.add(exchangeFor(a, { rec: k % 2 ? went : stay, layout: L }, game)[0]);
  }
  assert.ok([...lines].some((q) => q.includes(dest.name)), 'they talk about the trip');
});

test('guests from other towns turn up for a do and tie their horses at the post', () => {
  const { game, input, sid, L } = start(7, 10 * 60);
  const s = L.settlement;
  const O = game.sim.outings;
  const src = game.world.ow.settlements.find((o) => o !== s && o.civ === s.civ);
  const SL = game.sim.layoutOf(src.id);
  const ev = game.sim.events.feast(L, game.day, 0);
  const st = game.sim.stables.of(SL);
  st.horses = 3;
  st.wagons = 1;
  const t = O.plan(SL, s, ev, game.day, new RNG(2), game.sim.abs);
  assert.ok(t);
  O.setOff(SL, t, t.depart, Math.floor(t.depart / DAY));
  assert.ok(Object.values(SL.npcs).some((r) => r.trip && r.trip.mount), 'the town horses went with them');
  // They're here.
  for (const v of game.sim.visits.get(sid)) if (v.outing === t.id) v.arrive = game.sim.abs - 1;
  tick(game, input, 30);
  const ents = game.npcs.filter((n) => n.visit && n.visit.outing === t.id);
  assert.ok(ents.length >= 1, 'the visitors are in town');
  assert.equal(ents[0].title, 'Visitor');
  assert.ok(/visiting|came all the way/i.test(openingLine(ents[0], game)));
  assert.ok(!topicsFor(ents[0], game).some((q) => q.id === 'trade'), 'not here to sell');
  const h = game.sim.stables.hitch(L);
  game.player.teleport(h.x + 3, game.world.findStandY(h.x + 3, h.z + 3, GROUND), h.z + 3);
  tick(game, input, 10);
  assert.ok([...game.tied.keys()].some((k) => k.startsWith('guest:')), 'their horses tied at the post');
});

// ------------------------------------------------------------ event decor
test('every people dresses a feast its own way, with bunting and banners all over town', () => {
  const seen = new Set();
  // (A town of each people, on whichever of the islands they live.)
  const games = [7, 4, 1].map((seed) => {
    const game = makeGame(seed);
    game.minute = 400;
    tick(game, stubInput(), 10, 0.1);
    return game;
  });
  for (const style of Object.keys(STYLES)) {
    const game = games.find((g) => g.world.ow.settlements.some((q) => q.style === style && q.condition !== 'abandoned' && q.type !== 'village'));
    if (!game) continue;
    const L = game.world.getLayout(game.world.ow.settlements.find((q) => q.style === style && q.condition !== 'abandoned' && q.type !== 'village'));
    const look = styleOf(L.settlement);
    seen.add(L.settlement.style);
    const ev = game.sim.events.feast(L, game.day, 0, game.sim.abs + 60);
    ev.state = 'posted';
    game.sim.events.step(L, ev, game.sim.abs + 1, true);
    const ids = ev.blocks.map((q) => q[3]);
    assert.ok(ids.includes(B[look.centre[0][0]]), `${L.settlement.style}: ${look.centreWord}`);
    assert.ok(ev.decorN >= 5, 'decorations round town');
    const decor = ev.blocks.slice(ev.blocks.length - ev.decorN);
    assert.ok(decor.some((q) => q[3] === B.bunting && q[1] === GROUND + 2), 'bunting strung across the streets');
    assert.ok(decor.some((q) => q[3] === B.festival_banner), 'banners');
    const site = ev.site;
    const far = decor.filter((q) => Math.max(q[0] - site.x1, site.x0 - q[0], q[2] - site.z1, site.z0 - q[2]) > 6);
    assert.ok(far.length >= 3, 'spread through the town, not just by the square');
    // Up, and down again the next morning.
    const p = game.sim.works.projects.find((q) => q.id === ev.stage);
    game.sim.works.finishNow(L, p);
    assert.ok(ev.blocks.every(([x, y, z, id]) => !game.world.regionAt(x, z) || game.world.getBlock(x, y, z) === id));
    ev.state = 'over';
    game.sim.events.strike(L, ev, true);
    const sp = game.sim.works.projects.find((q) => q.id === ev.strike);
    game.sim.works.finishNow(L, sp);
    assert.ok(ev.blocks.every(([x, y, z]) => !game.world.regionAt(x, z) || game.world.getBlock(x, y, z) === B.air), 'all taken down');
  }
  assert.ok(seen.size >= Object.keys(STYLES).length - 1, `the peoples' feasts (${[...seen].join(', ')})`);
});
