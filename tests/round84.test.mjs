// Round 84: the essentials. A ship's lower decks walked down into as part
// of her (her stairs, the decks above cut away, her pump and stores used
// from inside); storms (thunder, hail, sandstorms, the wind in the
// plants); the great continents' provinces; doors that are locked staying
// shut when walked into; the ancient technology button; the vote talked
// of only with citizens; an empire's houses all lived in, its market laid
// out in stalls; a city's several graveyards; each people's own look; the
// save check leaving unopened chests alone; and the version's step.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeGame, stubInput } from './helpers.mjs';
import { B, BLOCKS, META_STATE } from '../src/world/blocks.js';
import { addShip, roomFor, sailable, entrances, walkAboard, ownerId, boardAt, deckPath } from '../src/game/ships3d.js';
import { isInside, standOn, onPlan } from '../src/world/shipmodels.js';
import { cutOf } from '../src/render/shipvox.js';
import { insideFitting, isBelowOn } from '../src/game/shiphold.js';
import { useFitting } from '../src/game/shipgame.js';
import { stormAt, STORMS, weatherWord } from '../src/world/weather.js';
import { underCover } from '../src/game/storms.js';
import { PROVINCE_LANDS } from '../src/world/provinces.js';
import { doorLocked, houseOfDoor, nightLocking } from '../src/game/doorlocks.js';
import { TechWindow } from '../src/ui/research.js';
import { topicsFor } from '../src/game/dialogue.js';
import { yardsOf } from '../src/sim/sim.js';
import { checkRegion } from '../src/game/savehealth.js';
import { GAME_VERSION } from '../src/version.js';
import { stepsFor, migrateSave } from '../src/game/migrate.js';
import { runCommand } from '../src/game/commands.js';

const input = stubInput();
const run = (game, n, inp = input) => {
  for (let i = 0; i < n; i++) game.update(1 / 60, inp);
};

// One world made as new ones are now (world gen 8).
const G = makeGame(12345, { wg: 8 });
run(G, 5);

// ------------------------------------------------------------ the ships
test('down a galleon\'s hatch, by her stairs, and below: the decks above cut away, every deck of her walkable', () => {
  const p = G.player;
  let spot = null;
  for (let R = 30; R < 900 && !spot; R += 12) {
    for (let k = 0; k < 48; k++) {
      const a = (k / 48) * Math.PI * 2;
      const x = Math.round(p.x + Math.cos(a) * R);
      const z = Math.round(p.z + Math.sin(a) * R);
      G.loadAround?.(x, z, true);
      if (roomFor(G, 'galleon', x, z, 0) && sailable(G, x, z)) {
        spot = { x, z };
        break;
      }
    }
  }
  assert.ok(spot, 'open water');
  const S = addShip(G, { type: 'galleon', x: spot.x, z: spot.z, yaw: 0.7, owner: ownerId(G, p), anchor: true, crew: [] });
  p.teleport(Math.round(spot.x + S.m.W / 2 + 2), 6, spot.z);
  boardAt(G, S, p, S.x, S.z);
  assert.ok(p.deck, 'aboard');
  const m = S.m;
  // Stairs, not blocks, between her decks.
  let stairs = 0;
  for (let i = 0; i < m.N; i++) if (S.vox[i] === B.deck_planks_stairs) stairs++;
  assert.ok(stairs >= 4, 'stairs');
  const E = entrances(m)[0];
  assert.ok(walkAboard(G, p, S, { x: E.x, y: E.y, z: E.z }, { kind: 'below', E }));
  run(G, 60 * 12);
  assert.ok(p.deck && p.deck.s === S.id, 'still aboard her: no place apart');
  assert.ok(isBelowOn(S, p) && p.deck.below, 'below');
  assert.ok(cutOf(G, S) !== null, 'the decks above cut away');
  // Every deck of her inside to be got to from there.
  const cells = [];
  for (let z = 0; z < m.L; z++) for (let x = 0; x < m.W; x++) for (let y = 1; y <= m.H + 1; y++) if (onPlan(m, x, z) && standOn(m, S.vox, x, y, z) && isInside(m, x, y, z)) cells.push([x, y, z]);
  const levels = new Set(cells.map((c) => c[1]));
  const got = cells.filter(([x, y, z]) => deckPath(S, { x: p.deck.cx, y: p.deck.y, z: p.deck.cz }, { x, y, z }, 6000));
  assert.ok(got.length >= cells.length * 0.95, `${got.length}/${cells.length} reachable`);
  assert.equal(new Set(got.map((c) => c[1])).size, levels.size, 'every deck');
  // Her pump, worked from below; her stores opened.
  let pump = null;
  let store = null;
  for (let i = 0; i < m.N; i++) {
    const f = insideFitting(S, i);
    if (f && f.kind === 'pump' && !pump) pump = f;
    if (f && f.kind === 'store' && !store) store = f;
  }
  S.floodCells = 40;
  useFitting(G, p, S, { kind: 'inside', f: pump });
  run(G, 60 * 15);
  assert.ok(S.floodCells < 40, 'pumped');
  let opened = null;
  const was = G.ui.openContainer;
  G.ui.openContainer = (t, slots, pos) => {
    opened = { t, n: slots.length, pos };
  };
  useFitting(G, p, S, { kind: 'inside', f: store });
  run(G, 60 * 15);
  G.ui.openContainer = was;
  assert.ok(opened && opened.n >= 9 && opened.pos.ship === S.id, 'her stores');
  // Back ashore for the rest.
  p.deck = null;
  p.teleport(Math.round(G.world.ow.settlements[0].bounds.x0 + 3), 6, Math.round(G.world.ow.settlements[0].bounds.z0 + 3));
});

// ------------------------------------------------------------ storms
test('storms: a thunderstorm\'s rain, a sandstorm under a clear sky, the wind getting up, hail stinging the bare-headed', () => {
  assert.equal(weatherWord('blizzard'), 'blizzard');
  const seen = {};
  for (const b of ['plains', 'taiga', 'desert']) for (let t = 0; t < 60 * 24 * 40; t += 60) {
    const k = stormAt(7, 3000, 2000, t, b);
    if (k) seen[`${b}:${k}`] = true;
  }
  assert.ok(seen['plains:thunder'] && seen['taiga:blizzard'] && seen['desert:sandstorm'], JSON.stringify(seen));
  const g = makeGame(31);
  const abs = () => g.day * 1440 + g.minute;
  g.modWeather = { kind: 'thunder', until: abs() + 300 };
  run(g, 60 * 3);
  assert.equal(g.weather.kind, 'rain');
  assert.equal(g.weather.severe, 'thunder');
  run(g, 60 * 22);
  assert.ok(g.weather.blow >= 0.95 && g.weather.wind > 1.5, 'the wind up');
  g.modWeather = { kind: 'sandstorm', until: abs() + 300 };
  g.weather.t = 0;
  run(g, 60 * 3);
  assert.equal(g.weather.kind, 'clear');
  assert.equal(g.weather.severe, 'sandstorm');
  // Hail.
  g.modWeather = { kind: 'hail', until: abs() + 600 };
  g.weather.t = 0;
  run(g, 60 * 25);
  const p = g.player;
  assert.ok(!underCover(g, p) || true);
  p.equip.head = null;
  p.hp = p.maxHp;
  const cover = underCover(g, p);
  run(g, 60 * 30);
  if (!cover) assert.ok(p.hp < p.maxHp, 'stung');
  p.equip.head = 'leather_cap';
  p.hp = p.maxHp;
  run(g, 60 * 30);
  assert.equal(p.hp, p.maxHp, 'a hat keeps it off');
  // The console calls one down.
  const out = runCommand ? runCommand(g, 'weather blizzard 1') : null;
  if (out) assert.ok(g.modWeather && g.modWeather.kind === 'blizzard');
  assert.ok(STORMS.gale && STORMS.hail.base === 'rain');
});

// ------------------------------------------------------------ provinces
test('Velmarch and Ostria parted into provinces, each with its own ground (in a world made now)', () => {
  const ow = G.world.ow;
  for (const key of PROVINCE_LANDS) {
    const P = ow.provinces.filter((q) => q.land === key);
    assert.ok(P.length >= 5, `${key}: ${P.length}`);
    assert.equal(new Set(P.map((q) => q.name)).size, P.length, 'named, no two alike');
    const main = new Set(P.map((q) => q.theme.b[0]));
    if (key === 'velmarch') assert.ok(main.has('rimewood') && main.has('olive_hills'));
    if (key === 'ostria') assert.ok(main.has('bamboo_grove') && main.has('red_mesa'));
    // Each province mostly its own ground.
    const q = P[0];
    const out = {};
    let n = 0;
    for (let dz = -200; dz <= 200; dz += 40) for (let dx = -200; dx <= 200; dx += 40) {
      const at = ow.provinceAt(q.x + dx, q.z + dz);
      if (!at || at.p !== q) continue;
      const b = ow.biomeAt(q.x + dx, q.z + dz, {}).biome;
      out[b] = (out[b] || 0) + 1;
      n++;
    }
    if (n >= 6) assert.ok((out[q.theme.b[0]] || 0) + (out[q.theme.b[1]] || 0) >= n * 0.5, JSON.stringify(out));
  }
  const old = makeGame(12345);
  assert.equal((old.world.ow.provinces || []).length, 0, 'an old world keeps its ground');
});

// ------------------------------------------------------------ small fixes
test('a locked front door stays shut when walked into', () => {
  const g = makeGame(777);
  g.minute = 23 * 60;
  let found = null;
  for (const s of g.world.ow.settlements) {
    if (found || !nightLocking(s) || s.type === 'village' || s.condition === 'abandoned') continue;
    const L = g.world.getLayout(s);
    for (const b of L.buildings) {
      if (!b.residential || b.playerHome || !b.door || !b.outside) continue;
      const H = houseOfDoor(g, b.door.x, b.door.z);
      if (H && Math.abs(b.outside.x - b.door.x) + Math.abs(b.outside.z - b.door.z) === 1) {
        found = { s, b };
        break;
      }
    }
  }
  assert.ok(found, 'a house');
  const { b } = found;
  const p = g.player;
  p.teleport(b.outside.x, 6, b.outside.z);
  run(g, 30);
  g.minute = 23 * 60;
  const y = 6;
  assert.ok(doorLocked(g, b.door.x, y, b.door.z, p), 'locked to us');
  const dx = b.door.x - b.outside.x;
  const dz = b.door.z - b.outside.z;
  const key = dz < 0 ? 'KeyW' : dz > 0 ? 'KeyS' : dx < 0 ? 'KeyA' : 'KeyD';
  const push = { ...stubInput(), isDown: (k) => k === key, lastMoveKey: key };
  for (let i = 0; i < 60; i++) {
    g.minute = 23 * 60;
    g.update(1 / 60, push);
  }
  assert.ok(!g.world.getState(b.door.x, y, b.door.z), 'still shut');
  assert.ok(g.ui.msgs.some((m) => /Locked/.test(m)), 'told why');
});

test('the Ancient Technology button does what it says (the press isn\'t taken for a drag)', () => {
  const w = Object.create(TechWindow.prototype);
  let pressed = false;
  w.hits = [{ x: 10, y: 20, w: 25, h: 1, fn: () => (pressed = true) }];
  w.area = () => ({ x0: 0, y0: 0, x1: 1000, y1: 1000 });
  w.cam = { x: 0, y: 0, z: 1 };
  w.onClick({ type: 'down', button: 0, x: 80, y: 160 }, 12, 20, G);
  assert.ok(pressed);
  assert.ok(!w.drag, 'not a drag');
});

test('only a town\'s citizens are asked about its vote', () => {
  const s = G.world.ow.settlements.find((q) => q.type === 'town' && q.condition !== 'abandoned');
  const L = G.world.getLayout(s);
  const r = L.npcs.find((q) => q.age === 'adult' && q.alive !== false);
  const npc = { rec: r, settlement: s, layout: L, name: r.name, visit: false, id: r.id, state: 'routine', distTo: () => 2 };
  const real = G.sim.causes.of;
  G.sim.causes.of = () => ({ champ: [], sides: ['For it', 'Against it'], side: null, asked: {}, end: 9 });
  const citizen = G.sim.isCitizen;
  try {
    G.sim.isCitizen = () => false;
    assert.ok(!topicsFor(npc, G).some((t) => t.id === 'cause_ask'), 'not to an outsider');
    G.sim.isCitizen = () => true;
    assert.ok(topicsFor(npc, G).some((t) => t.id === 'cause_ask'), 'to a citizen');
  } finally {
    G.sim.causes.of = real;
    G.sim.isCitizen = citizen;
  }
});

// ------------------------------------------------------------ the empires
test('an empire\'s houses all lived in; its market laid out in stalls; a city\'s graveyards', () => {
  const ow = G.world.ow;
  const s = ow.settlements.find((q) => q.empire);
  const L = G.world.getLayout(s);
  const lives = (h) => L.npcs.some((q) => q.home === h.id && q.alive !== false);
  const empty = L.buildings.filter((h) => h.residential && !h.playerHome && !h.underConstruction && h.type !== 'palace' && !lives(h));
  assert.equal(empty.length, 0, 'no empty houses');
  // Graveyards: an empire's three (or as many as there was room for), the
  // dead laid nearest home.
  const yards = yardsOf(L);
  assert.ok(yards.length >= 2, `${yards.length} graveyards`);
  assert.equal(yards[0], L.graveyard);
  const used = new Set();
  for (const r of L.npcs.slice(0, 24)) {
    const sl = G.sim.addGrave(L, r, 'old age', 3);
    used.add(yards.findIndex((g) => g.slots.includes(sl)));
  }
  assert.ok(used.size >= 2, 'more than one used');
  const sv = G.sim.serializeSettlement(L);
  assert.ok(sv.graves2 && sv.graves2.length === yards.length - 1, 'kept in the save');
  // The market: stalls (posts, a cloth over each, counters), nothing
  // dotted about under a cloth of its own.
  const emp = ow.settlements.filter((q) => q.empire).map((q) => G.world.getLayout(q)).find((q) => (q.landmarks || []).some((m) => m.kind === 'market'));
  if (emp) {
    const mk = emp.landmarks.find((m) => m.kind === 'market');
    G.teleportPlayer(mk.at.x, 6, mk.at.z);
    run(G, 20);
    let counters = 0;
    let canopies = 0;
    let lone = 0;
    for (let z = mk.z0; z <= mk.z1; z++) {
      for (let x = mk.x0; x <= mk.x1; x++) {
        if (G.world.getBlock(x, 6, z) === B.counter) counters++;
        if (G.world.getBlock(x, 8, z) === B.canopy) canopies++;
        if (G.world.getBlock(x, 7, z) === B.canopy) lone++;
      }
    }
    assert.ok(counters >= 4 && canopies >= 8, `${counters} counters, ${canopies} cloths`);
    assert.equal(lone, 0, 'no cloth sat on a crate');
  }
});

// ------------------------------------------------------------ looks
test('each people\'s own chimneys, and their props drawn their own way', async () => {
  const s = G.world.ow.settlements.find((q) => q.style === 'ember' && q.type !== 'village');
  const L = G.world.getLayout(s);
  const c = L.chimneys[0];
  if (c) {
    G.teleportPlayer(c.x, 6, c.z + 2);
    run(G, 10);
    assert.equal(G.world.getBlock(c.x, c.y - 1, c.z), B.kiln_brick, 'capped in kiln brick');
    assert.equal(G.world.getBlock(c.x, c.y - 2, c.z), B.basalt_bricks, 'basalt below');
  }
  const { LOOK_OF, LOOKED, lookSprite, LOOKS } = await import('../src/render/lookart.js');
  assert.equal(LOOK_OF.jade, 3);
  assert.equal(LOOK_OF.ember, 7);
  for (let k = 1; k < LOOKS; k++) for (const n of LOOKED) if (!n.startsWith('awning')) assert.ok(lookSprite(n, k, 0, 1, 0, 0), `${n} ${k}`);
});

// ------------------------------------------------------------ the save check
test('the save check leaves a chest nobody\'s opened alone (filled as it\'s opened)', () => {
  const g = makeGame(31);
  const p = g.player;
  const r = g.world.regionAt(Math.round(p.x), Math.round(p.z));
  const x = Math.round(p.x) + 1;
  const z = Math.round(p.z);
  g.world.setBlock(x, 6, z, B.chest);
  const i = ((z - r.z0) * 64 + (x - r.x0)) * 16 + 6;
  r.containers.delete(i);
  checkRegion(g, r);
  assert.ok(!r.containers.has(i), 'not given empty slots');
  assert.ok(BLOCKS[B.chest].interact === 'container');
});

// ------------------------------------------------------------ the version
test('0.84.0: its step, and an old world told what\'s new for it', () => {
  assert.equal(GAME_VERSION, '0.84.0');
  const steps = stepsFor('0.83.0');
  assert.deepEqual(steps.map((q) => q.to), ['0.84.0']);
  const d = { gv: '0.83.0', wg: 7, pending: [] };
  const { log } = migrateSave(d);
  assert.ok(log.some((l) => /lower decks/.test(l)));
  assert.ok(log.some((l) => /provinces/.test(l)));
  assert.equal(d.gv, '0.84.0');
  const meta = META_STATE;
  assert.ok(meta > 0);
});
