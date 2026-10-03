import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGame, stubInput, lotsReady } from './helpers.mjs';
import { World } from '../src/world/world.js';
import { REGION_W, REGION_D } from '../src/config.js';
import { B, BLOCKS } from '../src/world/blocks.js';
import { topicsFor, respond, openingLine } from '../src/game/dialogue.js';
import { countItem } from '../src/game/inventory.js';
import { alive, st } from '../src/sim/econ.js';
import { checkSupply, checkHousing, births } from '../src/sim/civic.js';
import { Creature } from '../src/entities/creature.js';

function start(seed = 7, minute = 9 * 60) {
  const game = makeGame(seed);
  const input = stubInput();
  game.minute = minute;
  for (let i = 0; i < 20; i++) game.update(0.1, input);
  const [sid, a] = [...game.active][0];
  return { game, input, sid, a, L: a.layout, p: game.player, w: game.world };
}

// Walk into another settlement so its people are about.
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

const always = { next: () => 0.1, chance: () => true, int: (a) => a, pick: (l) => l[0] };

test('barrels, tables and other props never block a doorway', () => {
  const DX = [0, -1, 0, 1];
  const DZ = [1, 0, -1, 0];
  let checked = 0;
  for (const seed of [7, 12345]) {
    const w = new World(seed);
    for (const s of w.ow.settlements) {
      const L = w.getLayout(s);
      for (const b of L.buildings) {
        const out = { x: b.door.x + DX[b.door.rot], z: b.door.z + DZ[b.door.rot] };
        const inn = { x: b.door.x - DX[b.door.rot], z: b.door.z - DZ[b.door.rot] };
        for (const t of [out, inn]) {
          if (t === out && L.buildings.some((q) => q !== b && t.x >= q.x0 && t.x <= q.x1 && t.z >= q.z0 && t.z <= q.z1)) continue;
          w.loadRegion(Math.floor(t.x / REGION_W), Math.floor(t.z / REGION_D));
          for (const y of [6, 7]) {
            const bl = BLOCKS[w.getBlock(t.x, y, t.z)];
            assert.ok(!bl.solid || bl.render === 'door', `${s.name} ${b.type}: ${bl.name} at ${t.x},${y},${t.z} blocks the door`);
          }
          checked++;
        }
      }
    }
  }
  assert.ok(checked > 200, `checked ${checked} doorways`);
});

test('saving someone from a beast earns their thanks, their family\'s and renown', () => {
  const { game, input, a, p, sid } = start(12345, 10 * 60);
  const n = a.npcs.find((q) => !q.dead && q.rec.age === 'adult' && q.rec.job !== 'guard' && !q.sleeping);
  p.teleport(n.x + 2, n.y, n.z);
  const wolf = new Creature(game, 'wolf', n.x + 1, n.y, n.z + 1);
  game.addCreature(wolf);
  wolf.angry = true;
  wolf.target = n;
  const before = game.sim.opinion(n);
  const renown = game.sim.renown.get(sid) || 0;
  for (let i = 0; i < 20 && !wolf.dead; i++) game.damage(wolf, 50, p);
  assert.ok(wolf.dead);
  assert.ok(game.sim.opinion(n) >= before + 8, `opinion ${before} -> ${game.sim.opinion(n)}`);
  assert.ok((game.stats.rescues || 0) >= 1);
  assert.ok(game.sim.renown.get(sid) > renown, 'the town remembers');
  assert.ok(game.ui.msgs.some((m) => /You saved/.test(m)));
  for (let i = 0; i < 5; i++) game.update(0.1, input);
});

test('builders mend damage, enlarge houses and put up new buildings', () => {
  const { game, input, sid, L, w } = start(5, 8 * 60);
  const works = game.sim.works;
  assert.ok(game.sim.builders(L).length >= 1, 'someone to do the building');
  // A hole in a wall is found and mended.
  const b = L.buildings.find((q) => q.residential && !q.playerHome);
  const wall = works.referencePlan(L, b).find(([x, y, z, id]) => y === 7 && BLOCKS[id].render === 'cube' && w.getBlock(x, y, z) === id);
  w.setBlock(wall[0], wall[1], wall[2], B.air);
  game.noteBuildingDamage(wall[0], wall[2], wall[3]);
  assert.ok(works.active(sid).some((q) => q.kind === 'repair'));
  for (let i = 0; i < 2000 && works.active(sid).length; i++) game.update(0.5, input);
  assert.equal(w.getBlock(wall[0], wall[1], wall[2]), wall[3], 'wall mended');
  // A house grows by a size.
  const house = L.buildings.find((q) => q.residential && !q.playerHome && works.expansionTerms(L, q).ok);
  const terms = works.expansionTerms(L, house);
  const beds = house.beds.length;
  const type = house.type;
  const ex = works.startExpansion(L, house, terms.bounds, null);
  for (let i = 0; i < 20000 && !ex.done; i++) game.update(0.5, input);
  assert.ok(ex.done, 'expansion finished');
  assert.equal(house.type, terms.next);
  assert.notEqual(house.type, type);
  assert.ok(house.beds.length > beds);
  assert.equal(w.getBlock(house.door.x, 6, house.door.z), B.door, 'still has its door');
  // And a new work building, with someone to run it (on a lot ready for it).
  lotsReady(game, L, 'bakery');
  const nb = works.startBuilding(L, 'bakery', ' for the town');
  assert.ok(nb && L.buildings[nb.bid].underConstruction);
  for (let i = 0; i < 20000 && !nb.done; i++) game.update(0.5, input);
  assert.ok(nb.done);
  assert.ok(L.econ.biz[nb.bid], 'the bakery does business');
  const staffed = () => L.npcs.some((r) => alive(r) && r.job === 'baker' && r.work && r.work.building === nb.bid);
  if (!staffed()) {
    // A small village may have nobody to spare, until someone is free.
    assert.equal(L.econ.hands, 'baker', 'the town knows it is short of hands');
    L.npcs.find((r) => alive(r) && r.age === 'adult' && r.job === 'farmer').job = 'laborer';
    L.econ.supplyDay = undefined;
    checkSupply(game.sim, L, game.day);
  }
  assert.ok(staffed(), 'someone was hired to work there');
  assert.ok(!L.econ.hands);
  // All of it survives a save.
  const g2 = reload(game);
  const L2 = g2.world.getLayout(g2.world.ow.settlements[sid]);
  assert.equal(L2.buildings[nb.bid].type, 'bakery');
  assert.ok(!L2.buildings[nb.bid].underConstruction);
  assert.equal(L2.buildings[house.id].type, house.type);
  assert.equal(L2.buildings[house.id].beds.length, house.beds.length);
});

test('enlarging your house: the mayor gives good workers a discount, builders charge full price', () => {
  const { game, input, L, a, p, sid } = start(8, 9 * 60);
  const hall = L.buildings.find((b) => b.type === 'townhall');
  const mayor = a.npcs.find((n) => n.rec.job === 'mayor');
  // Villages have no builder of their own; make someone the town's builder.
  const builder = a.npcs.find((n) => n.rec.job === 'builder') || a.npcs.find((n) => n.rec.age === 'adult' && !['mayor', 'guard'].includes(n.rec.job));
  builder.rec.job = 'builder';
  p.give('coin', 600);
  p.teleport(hall.inside.x, 6, hall.inside.z);
  game.currentSettlement = L.settlement;
  // A roomy lot on a new street (the village's own are hemmed in).
  for (const q of L.plots) if (q) q.taken = true;
  assert.ok(lotsReady(game, L, 'house_m').length, 'a new street with lots');
  respond(mayor, game, 'citizen', 'yes');
  for (let i = 0; i < 20000 && !(game.sim.construction && game.sim.construction.done); i++) game.update(0.25, input);
  assert.ok(game.sim.construction.done);
  assert.ok(topicsFor(mayor, game).some((t) => t.id === 'expand'));
  assert.ok(topicsFor(builder, game).some((t) => t.id === 'expand'));
  const full = game.sim.works.expansionTerms(L, L.buildings[game.sim.citizen.home]).cost;
  assert.match(respond(mayor, game, 'expand').lines.join(' '), new RegExp(`¤${full}\\b`));
  // Good work for the town earns a quarter off from the mayor...
  game.sim.addRenown(sid, 12, 'testing');
  const off = Math.round(full * 0.75);
  assert.match(respond(mayor, game, 'expand').lines.join(' '), new RegExp(`¤${off}\\b.*quarter off`));
  // ...but not from a builder, who is paid directly (and only knocks
  // something off for friends).
  game.sim.repEntry(sid, builder.rec.idx).v -= game.sim.opinion(builder);
  const offer = respond(builder, game, 'expand');
  assert.match(offer.lines.join(' '), new RegExp(`¤${full}\\b`));
  assert.ok(!/quarter off/.test(offer.lines.join(' ')));
  const coins = builder.rec.coins || 0;
  const mine = countItem(p.inv, 'coin');
  respond(builder, game, 'expand', 'yes');
  assert.equal(countItem(p.inv, 'coin'), mine - full);
  assert.equal(builder.rec.coins, coins + full);
  const job = game.sim.works.projects.find((q) => q.kind === 'expand' && q.owner === 'player');
  assert.ok(job, 'builders are on it');
  assert.match(respond(mayor, game, 'expand').lines.join(' '), /already working/);
});

test('miners dig stone and ore out in the wild, with a guard to watch them', () => {
  // (A town in the hills with stone showing, miners, and a watch big
  // enough to spare one.)
  const game = makeGame(1);
  const input = stubInput();
  game.minute = 9 * 60;
  const s = game.world.ow.settlements.find((q) => q.name === 'Kingsford');
  const { L, a } = visit(game, input, s);
  assert.ok(L.npcs.filter((r) => r.job === 'guard' && alive(r)).length > 3);
  const m = a.npcs.find((n) => n.rec.job === 'miner');
  const sp = L.spotsByTag('mine')[0];
  // (Out in the wild beyond the walls: the ground there loaded too.)
  game.loadAround(sp.x, sp.z, true);
  m.rec.override = null;
  m.teleport(sp.x, game.world.findStandY(sp.x, sp.z, 6), sp.z);
  m.goal = { x: sp.x, y: m.y, z: sp.z, tag: 'mine' };
  m.spot = sp;
  m.atGoal = true;
  const g = game.sim.escortMiner(m, null);
  assert.ok(g, 'a guard comes along');
  assert.equal(g.override.act, 'watch');
  assert.equal(g.override.ward, m.rec.idx);
  assert.equal(game.sim.escortMiner(m, null), null, 'only one guard per miner');
  const inv = () => m.rec.inv.reduce((n, it) => n + it.count, 0);
  const had = inv();
  for (let i = 0; i < 400 && (m.rec.minedToday || 0) < 3; i++) {
    m.mineWork();
    if (m.goal && !m.atGoal) {
      m.teleport(m.goal.x, m.goal.y, m.goal.z);
      m.atGoal = true;
    }
    for (let k = 0; k < 4; k++) m.update(0.1);
  }
  assert.ok(m.rec.minedToday >= 3, `mined ${m.rec.minedToday}`);
  assert.ok(inv() > had, 'stone in the pack');
  // The ore goes to the smithy.
  m.rec.inv.push({ item: 'iron_ore', count: 3 });
  const smith = L.buildings.find((b) => b.type === 'smithy');
  if (smith && L.econ.biz[smith.id]) {
    L.econ.biz[smith.id].till = 200;
    assert.ok(game.sim.sellOre(L, m.rec) > 0);
  }
});

test('towns hire and build what their trades depend on', () => {
  const game = makeGame(12345);
  const w = game.world;
  let hired = 0;
  let built = 0;
  let imported = 0;
  for (const s of w.ow.settlements.filter((q) => q.condition !== 'abandoned' && q.type !== 'village').slice(0, 6)) {
    const L = w.getLayout(s);
    L.econ.treasury = 2000;
    for (let d = 0; d < 12; d++) {
      // (New buildings wait for a lot: the town lays streets for them.)
      game.sim.roads.daily(L, d * 2);
      for (const q of game.sim.works.projects) if (!q.done && q.sid === s.id && (q.kind === 'road' || q.kind === 'path')) game.sim.works.finishNow(L, q);
      const r = checkSupply(game.sim, L, d * 2);
      if (r && r.hired) hired++;
      if (r && r.building) built++;
      if (r && r.building) break;
    }
    assert.ok(L.npcs.some((r) => r.job === 'builder'), `${s.name} keeps a builder`);
    if (L.npcs.some((r) => r.job === 'blacksmith' && alive(r))) {
      if (L.hasWorkplaceFor('miner')) assert.ok(L.npcs.some((r) => r.job === 'miner' && alive(r)), `${s.name}: the smith needs ore`);
      else {
        // No rock to mine nearby: merchants bring ore home from the road.
        const smithy = L.buildings.find((b) => b.type === 'smithy' && L.econ.biz[b.id]);
        const m = L.npcs.find((r) => r.job === 'merchant' && alive(r));
        if (smithy && m) {
          L.econ.biz[smithy.id].till = 300;
          m.coins = 100;
          assert.ok(game.sim.importOre(L, m, 0) > 0, `${s.name}: ore brought in`);
          assert.ok(st.count(L.econ.biz[smithy.id].store, 'iron_ore') > 0);
          imported++;
        }
      }
    }
    assert.ok(L.buildings.some((b) => b.type === 'smithy'), `${s.name} has or is building a smithy`);
  }
  assert.ok(hired + built + imported > 0, 'at least one gap was filled');
});

test('mayors write to each other: aid, roads, and warnings about criminals', () => {
  const { game, input, sid, L } = start(12345, 8 * 60);
  const d = game.sim.diplomacy;
  const s = L.settlement;
  L.econ.treasury = 10;
  const q = d.consider(L, game.day, always);
  assert.equal(q.kind, 'aid');
  for (let i = 0; i < 12000 && !d.letters.some((r) => r.kind === 'reply' && r.to === sid && r.status === 'delivered'); i++) game.update(0.5, input);
  assert.equal(q.status, 'delivered');
  assert.ok(L.econ.treasury > 10, 'help arrived');
  // A road halves the journey.
  const o = d.neighbours(s)[0];
  const slow = d.travelHours(s, o);
  const road = d.startRoad(s, o);
  // (Laid a tile at a time from both ends over the working days.)
  const t0 = Math.ceil(game.sim.abs / 1440) * 1440 + 540;
  d.buildRoads(t0);
  d.buildRoads(t0 + 60 * 3);
  assert.ok(!road.done && road.built > 0 && road.built < 45, 'a little at a time');
  for (let day = 1; day <= 10 && !road.done; day++) d.buildRoads(t0 + day * 1440);
  assert.ok(road.done);
  assert.ok(d.travelHours(s, o) < slow);
  assert.ok(d.roadCells().size > 0, 'shown on the map');
  // Convictions make the mayor warn the neighbours.
  game.sim.justice.recordOf(sid).convictions = 2;
  L.econ.lastLetter = undefined;
  d.consider(L, game.day, always);
  const warns = d.letters.filter((r) => r.kind === 'warn');
  assert.ok(warns.length >= 1);
  for (const l of warns) d.deliver(l);
  assert.ok(d.penalty(warns[0].to) > 0);
  const g2 = reload(game);
  assert.ok(g2.sim.diplomacy.roads.length >= 1);
  assert.ok(g2.sim.diplomacy.penalty(warns[0].to) > 0);
});

test('you can carry a mayor\'s dispatch to another town for pay', () => {
  const { game, input, L, a, p } = start(12345, 9 * 60);
  const d = game.sim.diplomacy;
  const mayor = a.npcs.find((n) => n.rec.job === 'mayor');
  const to = d.neighbours(L.settlement)[0];
  const q = d.write(L.settlement, to, 'gift', { amount: 20 });
  assert.ok(topicsFor(mayor, game).some((t) => t.id === 'mail'));
  respond(mayor, game, 'mail', 'yes');
  assert.equal(q.status, 'player');
  assert.equal(countItem(p.inv, 'dispatch'), 1);
  const { a: b } = visit(game, input, to);
  const other = b.npcs.find((n) => n.rec.job === 'mayor');
  assert.ok(topicsFor(other, game).some((t) => t.id === 'dispatch'));
  const coins = countItem(p.inv, 'coin');
  respond(other, game, 'dispatch');
  assert.equal(q.status, 'delivered');
  assert.equal(countItem(p.inv, 'dispatch'), 0);
  assert.ok(countItem(p.inv, 'coin') > coins, 'paid for the delivery');
});

test('nomads camp, weigh up the town, and settle together', () => {
  const { game, input, sid, L, a } = start(8, 8 * 60);
  const nm = game.sim.nomads;
  lotsReady(game, L, 'house_m');
  const band = nm.arrive(L, game.day, always);
  band.arrive = game.sim.abs;
  band.decide = game.sim.abs + 200;
  for (let i = 0; i < 30; i++) game.update(0.2, input);
  const ents = a.npcs.filter((n) => n.nomad);
  assert.equal(ents.length, band.people.length, 'the band walks in');
  assert.ok(topicsFor(ents[0], game).some((t) => t.id === 'nomad'));
  // Only a citizen can vouch for the town.
  assert.ok(!respond(ents[0], game, 'nomad').choices);
  respond(ents[0], game, 'nomad', 'vouch');
  assert.equal(band.vouched || 0, 0);
  game.sim.citizen = { sid, since: 1, host: null, hostBed: null, home: null, taxDay: game.day, owed: 0 };
  assert.ok(respond(ents[0], game, 'nomad').choices.some((c) => c.arg === 'vouch'));
  respond(ents[0], game, 'nomad', 'vouch');
  assert.ok(band.vouched > 0);
  game.sim.citizen = null;
  L.econ.treasury += 400;
  for (let i = 0; i < 30000 && !band.done; i++) game.update(0.5, input);
  assert.ok(band.done && band.stayed, `they ${band.stayed ? 'stayed' : 'left'}`);
  const recs = L.npcs.filter((r) => r.from === 'nomads');
  assert.equal(recs.length, band.people.length);
  assert.equal(new Set(recs.map((r) => r.home)).size, 1, 'one family, one house');
  assert.ok(recs.filter((r) => r.age === 'adult').every((r) => r.job && r.job !== 'none'));
  const g2 = reload(game);
  const L2 = g2.world.getLayout(g2.world.ow.settlements[sid]);
  assert.equal(L2.npcs.filter((r) => r.from === 'nomads').length, recs.length);
});

test('crowded families get a new house, and couples have children', () => {
  const { game, input, sid, L, a } = start(8, 8 * 60);
  const fam = L.npcs.find((r) => alive(r) && r.age === 'adult' && r.partner !== null && r.partner !== undefined);
  const hh = L.npcs.filter((r) => r.household === fam.household);
  for (const r of hh) r.home = null;
  L.econ.treasury = 400;
  lotsReady(game, L, 'house_m');
  const p = checkHousing(game.sim, L, game.day);
  assert.ok(p && p.type === 'house_m');
  for (let i = 0; i < 20000 && !p.done; i++) game.update(0.5, input);
  assert.ok(p.done);
  const home = L.buildings[hh[0].home];
  assert.ok(home && home.id === p.bid, 'moved into the new house');
  assert.ok(hh.every((r) => r.home === home.id), 'the whole family together');
  assert.equal(home.homeName, `The ${hh[0].name.last} House`);
  // A baby.
  const mum = L.npcs.find((r) => alive(r) && r.age === 'adult' && r.partner !== null && r.partner !== undefined && r.idx < r.partner && L.npcs[r.partner].home === r.home && r.ent);
  mum.children = [];
  L.npcs[mum.partner].children = [];
  const n = a.npcs.length;
  const born = births(game.sim, L, game.day, always).find((r) => r.parents.includes(mum.idx));
  assert.ok(born && born.age === 'child' && born.home === mum.home);
  assert.equal(born.name.last, mum.name.last);
  assert.ok(mum.children.includes(born.idx));
  assert.ok(born.ent && a.npcs.length > n, 'the baby is here in town');
  const g2 = reload(game);
  const L2 = g2.world.getLayout(g2.world.ow.settlements[sid]);
  assert.equal(L2.npcs[born.idx].name.first, born.name.first);
  assert.ok(L2.npcs[mum.idx].children.includes(born.idx));
  assert.equal(L2.npcs[hh[0].idx].home, home.id);
  assert.equal(L2.buildings[home.id].homeName, home.homeName);
});

test('renown: good deeds make you a Friend, then a Hero, of a town', () => {
  const { game, sid, a } = start(12345, 9 * 60);
  const sim = game.sim;
  const n = a.npcs.find((q) => q.rec.age === 'adult' && !q.dead);
  const base = sim.areaMod(sid);
  assert.equal(sim.renownTitle(sid), null);
  sim.addRenown(sid, 10, 'saving lives');
  assert.equal(sim.renownTitle(sid), 'Friend');
  assert.ok(game.ui.msgs.some((m) => /Friend of/.test(m)));
  sim.addRenown(sid, 15, 'your help');
  assert.equal(sim.renownTitle(sid), 'Hero');
  assert.ok(sim.areaMod(sid) > base, 'people think better of you');
  assert.ok(sim.goodStanding(sid));
  sim.repEntry(sid, n.rec.idx).met = false;
  assert.match(openingLine(n, game), /Hero of|talking about what you did/);
  assert.ok(sim.bestRenown().title.startsWith('Hero of'));
  const g2 = reload(game);
  assert.equal(g2.sim.renownTitle(sid), 'Hero');
});
