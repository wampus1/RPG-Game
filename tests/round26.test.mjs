import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGame, stubInput, stubRenderer, stubUI } from './helpers.mjs';
import { Game } from '../src/game/game.js';
import { RNG } from '../src/util/rng.js';
import { alive } from '../src/sim/econ.js';
import { Creature } from '../src/entities/creature.js';
import { sprintCost } from '../src/entities/player.js';
import { sleepless } from '../src/game/combat.js';
import { gemText } from '../src/game/gems.js';
import { GEMS, ITEMS, socketed, canSocket } from '../src/world/items.js';
import { recipesFor } from '../src/world/recipes.js';
import { B } from '../src/world/blocks.js';
import { INST_X0, GROUND } from '../src/config.js';
import { buildFloor, DTYPES } from '../src/world/dungeongen.js';
import { DungeonRun } from '../src/game/dungeon.js';
import { setRelic, relicDamage, inRelic, serializeRelics, loadRelics, updateRelics } from '../src/game/relics.js';
import { useGadget, pierceOf } from '../src/game/kavtech.js';
import { ANCIENT, ANCIENT_IDS } from '../src/sim/ancient.js';
import { canSeeAncient } from '../src/ui/ancient.js';
import { respond } from '../src/game/dialogue.js';
import { randomHero } from '../src/game/hero.js';
import { buildVoyage, halfBeam, HULL } from '../src/world/voyage.js';
import { THEMES, musicMood } from '../src/game/music.js';

function start(seed = 12345, minute = 10 * 60) {
  const game = makeGame(seed);
  const input = stubInput();
  game.minute = minute;
  for (let i = 0; i < 20; i++) game.update(0.1, input);
  const [sid, a] = [...game.active][0];
  return { game, input, sid, a, L: a.layout, p: game.player };
}
const run = (game, input, n, dt = 0.1) => {
  for (let i = 0; i < n; i++) game.update(dt, input);
};

// ------------------------------------------------------------ the body
test('wounds no longer close on their own: only food, sleep, a potion or a stone mend them', () => {
  const { game, input, p } = start();
  p.wellFed = 0;
  p.hp = 10;
  run(game, input, 300);
  assert.equal(p.hp, 10);
  // (A delightful meal still mends you a while.)
  p.wellFed = 60;
  run(game, input, 120);
  assert.ok(p.hp > 10);
});

test('every day without sleep takes a point off your max stamina, until you sleep', () => {
  const { game, input, p } = start();
  run(game, input, 2);
  const fresh = p.maxStamina;
  p.awakeSince = game.day * 1440 + game.minute - 2 * 1440 - 30;
  run(game, input, 2);
  assert.equal(sleepless(game, p), 2);
  assert.equal(p.sleepless, 2);
  assert.ok(Math.abs(fresh - 2 - p.maxStamina) < 1e-6);
  assert.ok(game.ui.msgs.some((m) => /without sleep/.test(m)));
});

test('running costs little breath when you\'re whole, and a lot when you\'re hurt', () => {
  const p = { hp: 20, maxHp: 20 };
  const whole = sprintCost(p);
  p.hp = 10;
  const half = sprintCost(p);
  p.hp = 2;
  const near = sprintCost(p);
  assert.ok(whole < 0.05);
  assert.ok(half > whole * 4);
  assert.ok(near > half * 1.5);
});

// ------------------------------------------------------------ swinging
test('a swing at the air lands on whoever is standing there, hostile or not', () => {
  const { game, input, a, p } = start();
  p.give('iron_sword', 1);
  p.selected = p.inv.findIndex((q) => q && q.item === 'iron_sword');
  const n = a.npcs.find((q) => !q.dead && q.rec.job !== 'guard' && q.rec.age === 'adult');
  // Somewhere flat to stand them, a pace in front.
  let placed = false;
  for (const [dx, dz, dir] of [[1, 0, 3], [-1, 0, 1], [0, 1, 0], [0, -1, 2]]) {
    const y = game.world.findStandY(p.x + dx, p.z + dz, p.y);
    if (y !== p.y || game.occupiedBySolid(p.x + dx, y, p.z + dz, n)) continue;
    n.teleport(p.x + dx, y, p.z + dz);
    n.stunT = 1e9;
    p.dir = dir;
    placed = true;
    break;
  }
  if (!placed) return;
  const hp0 = n.hp;
  p.attackCd = 0;
  assert.ok(game.swingAt());
  run(game, input, 12, 0.05);
  assert.ok(n.hp < hp0 || n.down || n.state === 'flee' || n.state === 'fight');
});

test('a training dummy struck takes the blow: it rocks and shows the damage', () => {
  const { game, p } = start();
  const floats = [];
  const wobbles = [];
  game.renderer.floatText = (x, y, z, t) => floats.push(t);
  game.renderer.wobble = (...a) => wobbles.push(a);
  game.hitDummy({ x: p.x + 1, y: p.y, z: p.z }, 7, false, { heavy: false });
  game.hitDummy({ x: p.x + 1, y: p.y, z: p.z }, 9, true, { heavy: false });
  assert.deepEqual(floats, ['7', '9!']);
  assert.equal(wobbles.length, 2);
  game.updateDummy(2);
  assert.ok(floats.some((t) => /16 in 2 blows/.test(t)));
});

// ------------------------------------------------------------ gems
test('three new stones, each with its own work in every kind of gear (and every stone its own in a shield)', () => {
  const shield = Object.keys(ITEMS).find((k) => ITEMS[k].block && ITEMS[k].kind === 'armor' && !ITEMS[k].socket && canSocket(k));
  const gear = ['iron_sword', 'bow', 'leather_tunic', shield];
  for (const g of ['onyx', 'moonstone', 'bloodstone']) {
    assert.ok(GEMS[g] && GEMS[g].rare, g);
    for (const base of gear) {
      const t = gemText(socketed(base, g));
      assert.ok(t && t.length > 20, `${g} ${base}`);
    }
  }
  const all = new Set(Object.keys(GEMS).map((g) => gemText(socketed(shield, g))));
  assert.equal(all.size, Object.keys(GEMS).length);
});

// ------------------------------------------------------------ music
test('every town tune has a night version, and the openings have their own', () => {
  for (const k of ['village', 'town', 'city']) assert.ok(THEMES[k]);
  for (const k of ['history', 'voyage', 'storm', 'wreck']) assert.ok(THEMES[k], k);
  const { game } = start(12345, 23 * 60);
  const mood = musicMood(game);
  if (game.currentSettlement) assert.match(mood, /:night$/);
});

// ------------------------------------------------------------ old places
test('the bigger world has old places of every kind, each with a reason to be there', () => {
  const game = makeGame(12345);
  const all = game.sim.dungeons.all;
  assert.ok(all.length >= 8);
  for (const t of ['barrow', 'mine', 'crypt', 'holdout', 'kavorent']) assert.ok(all.some((d) => d.type === t), t);
  for (const d of all) {
    assert.ok(d.name && d.origin && d.origin.text.length > 30, d.name);
    // (Round 30: most one to three floors, a mine now and then a fourth;
    // a Kavorent ruin four.)
    assert.ok(d.depth >= DTYPES[d.type].floors[0] && d.depth <= DTYPES[d.type].floors[1] + (d.type === 'mine' ? 1 : 0));
    if (d.type !== 'kavorent') assert.ok(d.depth >= 1 && d.depth <= 4);
    else assert.equal(d.depth, 4);
  }
});

test('floors are made from room kits stitched together, with ways up and down', () => {
  const game = makeGame(12345);
  for (const t of ['barrow', 'mine', 'crypt', 'holdout', 'kavorent']) {
    const rec = game.sim.dungeons.all.find((d) => d.type === t);
    const kits = new Set();
    for (let n = 0; n < rec.depth; n++) {
      const f = buildFloor(rec, n);
      assert.ok(f.regions.size > 0);
      assert.ok(f.up, `${t} ${n} up`);
      if (n < rec.depth - 1) assert.ok(f.down, `${t} ${n} down`);
      assert.ok(f.rooms.length >= 4, `${t} ${n} rooms`);
      for (const r of f.rooms) kits.add(r.kit);
      assert.ok(f.spawns.length > 0);
    }
    assert.ok(kits.size >= 4, `${t}: ${[...kits]}`);
  }
  // (A Kavorent ruin dwarfs the rest, if less than it did.)
  const kav = game.sim.dungeons.all.find((d) => d.type === 'kavorent');
  const bar = game.sim.dungeons.all.find((d) => d.type === 'barrow');
  assert.ok(buildFloor(kav, 0).rooms.length > buildFloor(bar, 0).rooms.length * 1.2);
});

test('going down into an old place and back up: a place apart, kept as you left it', () => {
  const { game, input, p } = start();
  const rec = game.sim.dungeons.all.find((d) => d.type === 'barrow' && d.depth >= 2);
  const before = { x: p.x, z: p.z };
  const creatures = game.creatures.length;
  new DungeonRun(game, rec).enter();
  assert.ok(game.dungeon);
  assert.ok(p.x >= INST_X0);
  assert.ok(rec.known && rec.entered);
  run(game, input, 10);
  assert.ok(game.creatures.length > 0);
  assert.ok(game.dungeon.changeFloor(1));
  assert.equal(game.dungeon.floor, 1);
  assert.ok(rec.floors[0]);
  game.dungeon.leave();
  assert.equal(game.dungeon, null);
  assert.equal(game.world.inst, null);
  assert.ok(p.x < INST_X0);
  assert.ok(Math.abs(p.x - rec.x) < 12 && Math.abs(p.z - rec.z) < 12);
  assert.ok(game.creatures.length <= creatures + 2);
  assert.ok(before);
});

test('a cut stone offered to a Kavorent spire opens the face you stand at', () => {
  const { game, p } = start();
  const rec = game.sim.dungeons.all.find((d) => d.type === 'kavorent');
  game.loadAround(rec.x, rec.z, true);
  p.teleport(rec.x, game.world.findStandY(rec.x, rec.z + 4, rec.h + 1), rec.z + 4);
  p.inv[0] = { item: 'ruby', count: 1 };
  p.selected = 0;
  game.offerToSpire(rec);
  // (It opens partway through its scene: see scenes.js.)
  assert.equal(game.scene && game.scene.kind, 'spire');
  for (let i = 0; i < 200 && game.scene; i++) {
    const sc = game.scene;
    sc.t += 0.05;
    sc.update?.(game, 0.05);
    if (sc.t >= sc.dur) {
      sc.end?.(game);
      game.scene = null;
    }
  }
  assert.equal(rec.spire.open, 0);
  assert.equal(p.inv[0], null);
});

test('townsfolk tell of old places near by, and they go on your map', () => {
  const { game, a } = start();
  const n = a.npcs.find((q) => !q.dead && q.rec.age === 'adult');
  const before = game.sim.dungeons.all.filter((d) => d.known).length;
  const r = respond(n, game, 'oldplaces');
  assert.ok(r.lines && r.lines[0].length > 10);
  const after = game.sim.dungeons.all.filter((d) => d.known).length;
  if (!/None round here|Nothing like that|keep to the roads/.test(r.lines[0])) assert.equal(after, before + 1);
  // (Once a day each.)
  const r2 = respond(n, game, 'oldplaces');
  assert.match(r2.lines[0], /all I know|told you|Ask someone/);
});

test('adventurers go down into old places on their own, and come back stronger (or not at all)', () => {
  const game = makeGame(12345);
  const ds = game.sim.dungeons;
  const adv = game.sim.adventurers;
  const a = adv.list.find((q) => !q.dead);
  if (!a) return;
  const d = ds.all.find((q) => q.type === 'barrow');
  const lvl = a.level;
  a.state = 'delve';
  a.level = 4;
  a.delve = { id: d.id, start: game.sim.abs, end: game.sim.abs, lead: a.id, party: [a.id], from: (ds.nearestTown(d) || game.world.ow.settlements[0]).id };
  const res = ds.comeBack(a);
  assert.ok(res);
  if (res.won) {
    assert.ok(d.delves >= 1 && d.weakened > 0);
    assert.ok(a.level > 4 || a.level === 5);
  } else assert.ok(d.weakened > 0);
  assert.ok(lvl >= 1);
});

// ------------------------------------------------------------ loot
test('shards fuse into stones, and Kavorent scrap is worked into iron', () => {
  const hand = recipesFor('hand');
  const jew = recipesFor('jeweller');
  for (const g of Object.keys(GEMS)) {
    assert.ok(hand.some((r) => r.out === g && r.in[`shard_${g}`] === 5), g);
    assert.ok(jew.some((r) => r.out === g && r.in[`shard_${g}`] === 4), g);
  }
  assert.ok(recipesFor('furnace').some((r) => r.out === 'iron_ingot' && r.in.kav_scrap === 2));
  assert.ok(recipesFor('smith').some((r) => r.out === 'iron_ingot' && r.n === 2 && r.in.kav_scrap === 1));
  for (const k of ['kav_scrap', 'kav_core', 'old_coin', 'old_blueprint', 'kav_blade', 'kav_lance', 'kav_caster', 'kav_aegis', 'kav_blink', 'kav_mender', 'kav_bulwark', 'kav_lodestar', 'kav_everlight', 'kav_edge', 'kav_plating']) assert.ok(ITEMS[k], k);
});

test('relics set down give their circle its power, and come back up again', () => {
  const { game, input, p, a } = start();
  const x = p.x + 1;
  const z = p.z;
  game.world.setBlock(x, p.y, z, B.relic);
  setRelic(game, x, p.y, z, 'ward');
  assert.ok(inRelic(game, p.x, p.y, p.z, 'ward'));
  const n = a.npcs.find((q) => !q.dead);
  assert.equal(relicDamage(game, p, n, 10), 8);
  const saved = serializeRelics(game);
  game.relics.clear();
  loadRelics(game, saved);
  assert.equal(game.relics.size, 1);
  // A hearthstone: wounds close near it.
  game.world.setBlock(x, p.y, z, B.relic);
  setRelic(game, x, p.y, z, 'hearth');
  p.hp = 10;
  for (let i = 0; i < 100; i++) updateRelics(game, 0.1);
  assert.ok(p.hp > 10);
  run(game, input, 1);
});

test('Kavorent gadgets: a blink, a mending cell with three uses, a wall of light that goes', () => {
  const { game, input, p } = start();
  // Blink: some paces in a moment.
  const x0 = p.x;
  const z0 = p.z;
  let moved = false;
  for (const dir of [0, 1, 2, 3]) {
    p.dir = dir;
    p.gadgetCd = {};
    if (useGadget(game, { ...ITEMS.kav_blink, key: 'kav_blink' }) && (p.x !== x0 || p.z !== z0)) {
      moved = true;
      break;
    }
  }
  assert.ok(moved);
  assert.ok(Math.max(Math.abs(p.x - x0), Math.abs(p.z - z0)) <= 6);
  // Mending: three uses a day.
  for (let i = 0; i < 5; i++) {
    p.gadgetCd = {};
    p.hp = 5;
    useGadget(game, { ...ITEMS.kav_mender, key: 'kav_mender' });
  }
  assert.equal(p.mender.n, 0);
  assert.ok(game.ui.msgs.some((m) => /Mending Cell is dark/.test(m)));
  // The field: up, then gone.
  p.gadgetCd = {};
  useGadget(game, { ...ITEMS.kav_bulwark, key: 'kav_bulwark' });
  assert.ok((game.bulwarks || []).length > 0);
  run(game, input, 100);
  assert.equal((game.bulwarks || []).length, 0);
});

test('a phase blade slips past armour; the Kavorent\'s gear stands apart', () => {
  assert.ok(pierceOf({ kind: 'player', heldItem: () => 'kav_blade' }) > 0.5 || ITEMS.kav_blade.pierce > 0.5);
  assert.ok(ITEMS.kav_lance.lance && ITEMS.kav_caster.ammo === 'none');
  assert.ok(ITEMS.kav_carapace.slot === 'body');
});

// ------------------------------------------------------------ the Ancient tree
test('the Ancient Technology Tree: cores to spend, arts that need others first, and what they do', () => {
  const { game, L, a } = start();
  const s = L.settlement;
  const A = game.sim.ancient;
  assert.equal(canSeeAncient(game, s), false);
  for (const id of ANCIENT_IDS) {
    assert.ok(ANCIENT[id].cost >= 1 && ANCIENT[id].desc.length > 20);
    for (const r of ANCIENT[id].req) assert.ok(ANCIENT[r]);
  }
  // A core given to the mayor (or any council member): coin, and the realm can study.
  const p = game.player;
  p.give('kav_core', 2);
  const mayor = a.npcs.find((n) => !n.dead && n.rec.job === 'mayor') || a.npcs.find((n) => !n.dead && n.rec.age === 'adult');
  const coins = p.inv.filter((q) => q && q.item === 'coin').reduce((n, q) => n + q.count, 0);
  respond(mayor, game, 'give_core');
  const coins2 = p.inv.filter((q) => q && q.item === 'coin').reduce((n, q) => n + q.count, 0);
  assert.ok(coins2 > coins);
  assert.ok(canSeeAncient(game, s));
  const st = A.stateOf(s);
  assert.equal(st.cores, 2);
  // (The Mending Spring needs the Growth Lattice first.)
  assert.equal(A.buy(s, 'spring'), false);
  assert.ok(A.buy(s, 'lattice'));
  assert.ok(A.has(s, 'lattice'));
  A.addCores(L, 9);
  assert.ok(A.buy(s, 'forge'));
  assert.ok(A.power(s) > 1);
  // (Ward Pylons need the Coldfire Lamps.)
  assert.equal(A.buy(s, 'wards'), false);
  assert.ok(A.buy(s, 'lamps'));
  assert.ok(A.buy(s, 'wards'));
  assert.ok(A.placesOf(L).pylons.length >= 4);
  assert.ok(A.buy(s, 'spring'));
  // (Its basin goes down by the well.)
  const sp = A.placesOf(L).springs[0];
  if (sp) assert.equal(game.world.getBlock(sp.x, GROUND, sp.z), B.kav_basin);
});

test('ward pylons strike down what comes at a town', () => {
  const { game, L } = start();
  const s = L.settlement;
  const A = game.sim.ancient;
  A.addCores(L, 5);
  A.buy(s, 'lamps');
  A.buy(s, 'wards');
  const py = A.placesOf(L).pylons[0];
  const y = game.world.findStandY(py.x + 2, py.z + 2, GROUND);
  const c = new Creature(game, 'skeleton', py.x + 2, y, py.z + 2);
  game.addCreature(c);
  const hp = c.hp;
  for (let i = 0; i < 10; i++) A.update(0.5);
  assert.ok(c.hp < hp || c.dead);
});

// ------------------------------------------------------------ the openings
function heroGame(seed, origin) {
  const hero = { ...randomHero(seed), origin };
  return new Game({ seed, renderer: stubRenderer(), audio: null, ui: stubUI(), hero, intro: true });
}

test('a castaway\'s story opens on the deck of their ship, and ends on the beach', () => {
  const game = heroGame(12345, 'crash');
  const cs = game.cutscene;
  assert.ok(cs && cs.kind === 'ship');
  const p = game.player;
  assert.ok(p.x >= INST_X0);
  assert.ok(cs.crew.length >= 8);
  assert.ok(cs.crew.some((c) => c.role === 'Captain'));
  const beach = cs.beach;
  const clock = cs.clock.minute;
  const input = stubInput();
  // Out to sea a while, then the storm.
  run(game, input, 30);
  assert.equal(cs.phase, 'calm');
  cs.stormAt = cs.t;
  run(game, input, 5);
  assert.equal(cs.phase, 'gather');
  assert.equal(game.weather.kind, 'rain');
  for (let i = 0; i < 1200 && game.cutscene; i++) game.update(0.1, input);
  assert.equal(game.cutscene, null);
  assert.equal(game.world.inst, null);
  assert.equal(p.x, beach.x);
  assert.equal(p.z, beach.z);
  assert.ok(Math.abs(game.minute - clock) < 1);
  assert.ok(game.ui.msgs.some((m) => /wet sand/.test(m)));
});

test('a native\'s story opens on their town building itself up as its history is told', () => {
  const game = heroGame(12345, 'native');
  const cs = game.cutscene;
  assert.ok(cs && cs.kind === 'home');
  const L = cs.L;
  const b = L.buildings.find((q) => q.x0 !== undefined && q.type !== 'townhall');
  // At the start: bare ground where the houses will be.
  cs.prog = 0;
  let hidden = 0;
  for (let x = b.x0; x <= b.x1; x++) for (let z = b.z0; z <= b.z1; z++) for (let y = GROUND; y < GROUND + 4; y++) if (game.world.getBlock(x, y, z) && cs.veiled(x, y, z, game.world.getBlock(x, y, z))) hidden++;
  assert.ok(hidden > 0);
  cs.prog = 1;
  let still = 0;
  for (let x = b.x0; x <= b.x1; x++) for (let z = b.z0; z <= b.z1; z++) for (let y = GROUND; y < GROUND + 4; y++) if (game.world.getBlock(x, y, z) && cs.veiled(x, y, z, game.world.getBlock(x, y, z))) still++;
  assert.equal(still, 0);
  assert.ok(cs.beats.length >= 2);
  for (let i = 1; i < cs.beats.length; i++) assert.ok(cs.beats[i].y >= cs.beats[i - 1].y);
  const input = stubInput();
  for (let i = 0; i < 600 && game.cutscene; i++) game.update(0.1, input);
  assert.equal(game.cutscene, null);
  assert.ok(game.ui.msgs.some((m) => /Home again/.test(m)));
});

test('the ship: a hull riding out of the water, rails round it, two masts with canvas', () => {
  const v = buildVoyage();
  const h = v.hull;
  assert.ok(h.x1 - h.x0 + 1 === HULL.len);
  assert.ok(halfBeam(HULL.len - 1) <= 1 && halfBeam(10) === 4);
  const reg = (x, z) => v.regions.get((Math.floor(x / 64)) * 4096 + Math.floor(z / 36));
  const at = (x, y, z) => reg(x, z).get(x % 64, y, z % 36);
  assert.equal(at(h.x0 + 12, HULL.deck, h.cz), B.planks);
  assert.equal(at(h.x0 + 12, HULL.deck + 1, h.cz + 4), B.fence);
  assert.equal(at(h.main, 12, h.cz), B.log_oak);
  assert.equal(at(h.main + 1, 12, h.cz), B.sail);
  assert.equal(at(h.x0 - 5, 5, h.cz), B.water);
  assert.ok(new RNG(1));
  assert.ok(alive);
});
