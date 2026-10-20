// Round 131: ships only on water that reaches the sea; pirates' havens on
// the shore with a great pier and a black ship of their own, their flag a
// mast two tall, their roofs calmer; the brethren's own tree of learning,
// each step doing something of its own; a ship's hands as people (named,
// seen winding up a blow, struck through her planks, talked to in the same
// window as anyone, and much more to say), and kept aboard with the save.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGame, stubInput } from './helpers.mjs';
import { RNG } from '../src/util/rng.js';
import { SURFACE, GROUND } from '../src/config.js';
import { B, BLOCKS } from '../src/world/blocks.js';
import { seaLinked, waterSpot, addShip, boardAt, ownerId, saveShips, shipsOf } from '../src/game/ships3d.js';
import { makeCrew, crewOf, crewBlow } from '../src/game/shipcrew.js';
import { shipMouse, sailorTalk } from '../src/game/shipgame.js';
import { treeOf, TECHS } from '../src/sim/tech.js';
import { HAVEN_STARTS } from '../src/sim/haventech.js';
import { sailorTopics, sailorRespond, sailorOpening } from '../src/game/sailortalk.js';
import { Sailor } from '../src/entities/sailor.js';
import { addItem, countItem } from '../src/game/inventory.js';
import { GAME_VERSION, compareVersions } from '../src/version.js';
import { stepsFor } from '../src/game/migrate.js';

const world = () => makeGame(12345, { wg: 9 });
// (No tree known by default in a test world: makeGame knows everything.)
const unlearned = (g) => {
  g.sim.tech.cheat = false;
  return g;
};
const portOf = (g) => {
  const port = g.world.ow.settlements.find((s) => s.coast && !s.haven);
  const L = g.world.getLayout(port);
  g.teleportPlayer(L.plaza.cx, 40, L.plaza.cz);
  return L;
};
// A ship of `type` off the port, with a crew of `n` (the last a merchant).
function shipAt(g, L, type = 'brigantine', n = 5) {
  const at = waterSpot(g, type, L.plaza.cx, L.plaza.cz, 0, 200, true, true);
  const crew = makeCrew(5, type, 'vale', n);
  crew[n - 1].role = 'merchant';
  return addShip(g, { type, x: at.x, z: at.z, yaw: at.yaw, name: 'The Test', anchor: true, crew });
}

test('ships keep to water that reaches the open sea, never a pond', () => {
  const g = world();
  const L = portOf(g);
  const at = waterSpot(g, 'sloop', L.plaza.cx, L.plaza.cz, 0, 200, true, true);
  assert.ok(at, 'sea water by a port');
  assert.ok(seaLinked(g, at.x, at.z));
  // A pond inland: never the sea's.
  let pond = null;
  for (const s of g.world.ow.settlements.filter((q) => !q.coast && !q.haven).slice(0, 40)) {
    const PL = g.world.getLayout(s);
    const b = PL.bounds;
    for (let x = b.x0 - 30; x < b.x1 + 30 && !pond; x += 2) for (let z = b.z0 - 30; z < b.z1 + 30 && !pond; z += 2) if (g.world.regionAt(x, z) && g.world.isWaterAt(x, SURFACE, z) && !seaLinked(g, x, z)) pond = { x, z };
    if (pond) break;
  }
  assert.ok(pond, 'a pond to try');
  const spot = waterSpot(g, 'sloop', pond.x, pond.z, 0, 20, false, true);
  assert.ok(!spot || seaLinked(g, spot.x, spot.z), 'no ship put in the pond');
});

test('every haven is on the shore, with a great pier and a black ship', () => {
  const g = world();
  for (const h of g.sim.havens.list) {
    const s = g.sim.havens.settlement(h);
    assert.ok(s.coast, `${h.name} on the coast`);
    const L = g.world.getLayout(s);
    g.sim.ships.daily(L, g.day, new RNG(1));
    const P = g.sim.ships.ports[s.id];
    assert.ok(P, `${h.name} has a pier`);
    assert.equal(P.size, 'large');
  }
});

test('a haven\'s flag is one mast two tall, with nothing round it; cut down, all of it', () => {
  const g = world();
  const h = g.sim.havens.list[0];
  const L = g.world.getLayout(g.sim.havens.settlement(h));
  const { cx, cz } = L.plaza;
  g.teleportPlayer(cx, 40, cz + 3);
  for (let i = 0; i < 5; i++) g.update(0.1, stubInput());
  assert.match(BLOCKS[g.world.getBlock(cx, GROUND, cz)].name, /^jolly_/, 'the guild\'s flag');
  assert.equal(g.world.getBlock(cx, GROUND + 1, cz), B.jolly_top, 'its upper half');
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) if (dx || dz) assert.notEqual(g.world.getBlock(cx + dx, GROUND, cz + dz), B.plinth, 'no plinth round it');
  g.breakBlock(cx, GROUND, cz, true);
  assert.notEqual(g.world.getBlock(cx, GROUND + 1, cz), B.jolly_top, 'gone with the mast');
});

test('the brethren learn their own lore: their first steps known, no banks or siege engines', () => {
  const g = unlearned(world());
  const T = g.sim.tech;
  const tree = treeOf('haven');
  for (const k of ['banking', 'mint', 'rams', 'catapults', 'prisons', 'schools', 'portals', 'fortress']) assert.ok(!tree.techs[k], `no ${k}`);
  for (const k of ['h_black_ships', 'h_fireships', 'h_hidden', 'h_batteries', 'h_ransom']) assert.ok(tree.techs[k], k);
  const s = g.sim.havens.settlement(g.sim.havens.list[0]);
  const st = T.stateOf(s);
  assert.equal(st.isle, 'haven');
  for (const k of HAVEN_STARTS) assert.ok(st.done.includes(k), k);
  // (Their own forms of the common steps count.)
  assert.ok(T.has(s, 'trade_ships') && T.has(s, 'drill') && T.has(s, 'codex'));
  assert.equal(T.fxOf(s, 'chest'), 6);
  // Every step of theirs does something.
  for (const k of tree.ids.filter((id) => TECHS[id].isles && TECHS[id].isles.includes('haven'))) assert.ok(TECHS[k].fx && Object.keys(TECHS[k].fx).length, `${k} does something`);
});

test('what the brethren know pays: prizes, ransoms, the chest, word kept quiet', () => {
  const g = unlearned(world());
  const H = g.sim.havens;
  const Br = g.sim.brethren;
  const h = H.list[0];
  g.world.getLayout(H.settlement(h));
  const st = g.sim.tech.stateOf(H.settlement(h));
  const G = Br.of(h.guild);
  const cap = { id: 99, name: 'Captain Test', ship: 'Test', prizes: 0, infamy: 0, haven: h.id };
  const before = G.treasury;
  Br.prize(G, cap, 100, null, g.day, new RNG(3));
  const plain = G.treasury - before;
  st.done.push('h_prize_courts');
  const mid = G.treasury;
  Br.prize(G, cap, 100, null, g.day, new RNG(3));
  assert.equal(G.treasury - mid, Math.round(plain * 1.4), 'prize courts: 40% more');
  // Ransom brokers: dearer captives.
  const p1 = H.takeCaptive(h, 'taken', new RNG(9));
  st.done.push('h_fences', 'h_ransom');
  const p2 = H.takeCaptive(h, 'taken', new RNG(9));
  assert.ok(p2.ransom > p1.ransom, 'ransoms run higher');
  // Hidden coves: a captive home can't say where.
  st.done.push('h_hidden');
  const home = g.world.ow.settlements[p2.sid];
  g.sim.war.release(p2, 'released', g.day);
  if (home.civ) assert.equal(H.realmKnows(h, home.civ.id), false);
  // And the haven's study goes on, paid from the chest.
  const n = st.done.length;
  G.treasury = 5000;
  Br.lore(G, g.day);
  const p0 = st.progress;
  for (let d = 1; d < 40; d++) Br.lore(G, g.day + d);
  assert.ok(st.done.length > n || st.progress > p0, 'their study goes on');
  assert.ok(G.treasury < 5000, 'out of the chest');
});

test('a ship\'s hand is a person: named, titled, seen winding up a blow', () => {
  const g = world();
  const L = portOf(g);
  const S = shipAt(g, L);
  boardAt(g, S, g.player, S.x, S.z);
  for (let i = 0; i < 20; i++) g.update(0.1, stubInput());
  const c = crewOf(g, S)[0];
  assert.equal(typeof c.name, 'string');
  assert.ok(!/object/i.test(c.name));
  assert.equal(c.title, 'Captain');
  const x = new Sailor(g, { name: { first: 'Ada', last: 'Lane' }, role: 'gunner' });
  assert.equal(x.name, 'Ada Lane');
  // A blow: wound up first (the "!" over them), then struck.
  const foe = g.player;
  c.x = foe.x + 1;
  c.z = foe.z;
  c.y = foe.y;
  c.attackCd = 0;
  const hp = foe.hp;
  assert.ok(crewBlow(g, c, foe, 0.1));
  assert.ok(c.windup && c.windup.tiles.length, 'seen coming');
  assert.equal(foe.hp, hp, 'not yet');
  for (let i = 0; i < 10 && c.windup; i++) crewBlow(g, c, foe, 0.1);
  assert.ok(!c.windup);
  assert.ok(foe.hp < hp, 'struck');
});

test('a weapon in hand swings at a ship\'s planks instead of nothing happening', () => {
  const g = world();
  const L = portOf(g);
  const S = shipAt(g, L);
  const p = g.player;
  addItem(p.inv, 'sabre', 1);
  p.selected = p.inv.findIndex((q) => q && q.item === 'sabre');
  g.cursor = { ship: { s: S.id, vi: 0, face: 0 }, inReach: true, mx: 0, my: 0 };
  assert.equal(shipMouse(g, 0.1, [{ type: 'down', button: 0 }], { mouse: { down: true } }), false, 'left to the swing');
  // (Planks in hand still mend, a bare hand still knocks a plank out.)
  p.selected = -1;
  assert.equal(shipMouse(g, 0.1, [], { mouse: { down: false } }), true);
});

test('a ship\'s hand has much to say, in the dialogue window', () => {
  const g = world();
  const L = portOf(g);
  const S = shipAt(g, L);
  boardAt(g, S, g.player, S.x, S.z);
  for (let i = 0; i < 20; i++) g.update(0.1, stubInput());
  const crew = crewOf(g, S);
  const c = crew[0];
  assert.ok(sailorOpening(c, g).length > 3);
  const ids = sailorTopics(c, g).map((t) => t.id);
  for (const k of ['sl_who', 'sl_ship', 'sl_wind', 'sl_news', 'sl_lore', 'sl_yarn', 'bye']) assert.ok(ids.includes(k), k);
  for (const t of sailorTopics(c, g)) {
    const r = sailorRespond(c, g, t.id, t.arg);
    assert.ok(r.lines && r.lines.length && r.lines.every((l) => typeof l === 'string' && l.length > 1), t.id);
  }
  // A merchant's wares, bought on deck.
  const m = crew.find((q) => q.role === 'merchant');
  addItem(g.player.inv, 'coin', 200);
  const w = sailorRespond(m, g, 'sl_wares');
  assert.ok(w.choices.length >= 1);
  const coin = countItem(g.player.inv, 'coin');
  const had = countItem(g.player.inv, w.choices[0].arg);
  sailorRespond(m, g, w.choices[0].id, w.choices[0].arg);
  assert.ok(countItem(g.player.inv, 'coin') < coin);
  assert.equal(countItem(g.player.inv, w.choices[0].arg), had + 1);
  // Your own crew: orders, and how they're bearing up.
  S.owner = ownerId(g, g.player);
  const own = sailorTopics(c, g).map((t) => t.id);
  assert.ok(own.includes('sl_orders') && own.includes('sl_crew'));
  sailorRespond(c, g, 'sl_o_guns');
  assert.equal(c.order, 'guns');
  // (The window: the same as anyone's.)
  let opened = null;
  g.ui.openSailorTalk = (who) => (opened = who);
  sailorTalk(g, c);
  assert.equal(opened, c);
  assert.equal(g.talkingTo, c, 'they stop to listen');
});

test('a passing ship you\'re aboard is kept with the save, her crew with her', () => {
  const g = world();
  const L = portOf(g);
  const S = shipAt(g, L);
  S.transient = true;
  assert.ok(!saveShips(g).some((o) => o.id === S.id), 'not kept, with nobody aboard');
  boardAt(g, S, g.player, S.x, S.z);
  for (let i = 0; i < 20; i++) g.update(0.1, stubInput());
  const saved = saveShips(g).find((o) => o.id === S.id);
  assert.ok(saved, 'kept, with you aboard');
  assert.equal(saved.crew.length, S.crewRecs.length);
  const d = JSON.parse(JSON.stringify(g.serialize()));
  const g2 = makeGame(12345, { wg: 9 });
  g2.applySave(d);
  const S2 = shipsOf(g2).find((q) => q.name === 'The Test');
  assert.ok(S2);
  for (let i = 0; i < 30; i++) g2.update(0.1, stubInput());
  assert.ok(crewOf(g2, S2).length >= 3, 'her crew aboard');
  // (Hands taken off her some other way: back on her deck.)
  g2.sailors = g2.sailors.filter((q) => q.shipId !== S2.id);
  for (let i = 0; i < 5; i++) g2.update(0.1, stubInput());
  assert.ok(crewOf(g2, S2).length >= 3, 'back aboard');
});

test('version 1.31.0, and older havens get their flag put right', () => {
  assert.ok(compareVersions('1.31.0', GAME_VERSION) <= 0);
  const steps = stepsFor('1.30.0');
  const s = steps.find((q) => q.to === '1.31.0');
  assert.ok(s && s.town && s.game);
});
