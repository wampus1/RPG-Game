// Round 69: the great ships, easier to live aboard. Every part of her
// decks to be got to and from; down a hatch by meaning to, at any angle;
// her wheel, guns and hatches clicked; talk, fight and give orders aboard;
// mend her from outside; rafts that meet her; companions who come aboard
// with you; ships in bottles (and back into them), at 750 to 5,000; her
// ghost where she'd go; a blueprint table for her name and colours; the
// view below turning with her; the map's glyphs; and the update.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGame, stubInput } from './helpers.mjs';
import { shipModel, SHIP_TYPES, standOn, stepOn, isInside, onPlan } from '../src/world/shipmodels.js';
import { deckInteract } from '../src/game/ships3d.js';
import { addShip, boardAt, breakVoxel, roomFor, sailable, entrances, walkAboard, shipsOf, shipById, putAboard, leaveDeck, windOf, ownerId } from '../src/game/ships3d.js';
import { holdShipAt, holdUse, holdPos, holdOf } from '../src/game/shiphold.js';
import { fittingAt, useShipItem, raftMeetsShip, shipMouse, shipGhostTick, holdViewTick, npcAboard, helmView, HELM_ZOOM_MAX } from '../src/game/shipgame.js';
import { makeCrew, crewOf } from '../src/game/shipcrew.js';
import { apart } from '../src/entities/footprint.js';
import { launch as launchRaft, steer } from '../src/entities/raft.js';
import { ITEMS } from '../src/world/items.js';
import { B, BLOCKS } from '../src/world/blocks.js';
import { BIOMES } from '../src/world/biomes.js';
import { CHAR_INDEX } from '../src/render/font.js';
import { sunkenPlace } from '../src/game/dungeon.js';
import { STEPS, migrateSave } from '../src/game/migrate.js';
import { GAME_VERSION, compareVersions } from '../src/version.js';

const TYPES = ['sloop', 'brigantine', 'galleon', 'frigate'];

const openWater = (game, type = 'galleon') => {
  const p = game.player;
  for (let R = 30; R < 900; R += 12) {
    for (let k = 0; k < 48; k++) {
      const a = (k / 48) * Math.PI * 2;
      const x = Math.round(p.x + Math.cos(a) * R);
      const z = Math.round(p.z + Math.sin(a) * R);
      game.loadAround?.(x, z, true);
      if (!roomFor(game, type, x, z, 0)) continue;
      let ok = true;
      for (let a2 = 0; a2 < 16 && ok; a2++) for (const rr of [10, 20, 30]) if (!sailable(game, Math.round(x + Math.cos((a2 / 16) * 6.283) * rr), Math.round(z + Math.sin((a2 / 16) * 6.283) * rr))) ok = false;
      if (ok) return { x, z };
    }
  }
  return null;
};
const keyed = (...keys) => ({ ...stubInput(), isDown: (k) => keys.includes(k) });
const run = (game, n, input = stubInput()) => {
  for (let i = 0; i < n; i++) game.update(1 / 60, input);
};
const withShip = (seed, type, o = {}) => {
  const game = makeGame(seed);
  const spot = openWater(game, type);
  assert.ok(spot, 'open water');
  const p = game.player;
  const S = addShip(game, { type, x: spot.x, z: spot.z, yaw: 0, owner: ownerId(game, p), anchor: true, crew: [], ...o });
  p.teleport(Math.round(spot.x + S.m.W / 2 + 2), 6, spot.z);
  return { game, S, p, spot };
};

// ------------------------------------------------------------ her decks
test('every part of every ship\'s decks can be got back from (no corner that traps anyone)', () => {
  for (const type of TYPES) {
    const m = shipModel(type);
    const cells = [];
    const key = (x, y, z) => `${x},${y},${z}`;
    for (let z = 0; z < m.L; z++) for (let x = 0; x < m.W; x++) for (let y = 1; y <= m.H + 1; y++) if (standOn(m, m.vox, x, y, z) && !isInside(m, x, y, z)) cells.push([x, y, z]);
    const sp = cells.find((c) => c[0] === m.spawn.x && c[2] === m.spawn.z) || cells[0];
    const reach = new Set([key(...sp)]);
    let grew = true;
    while (grew) {
      grew = false;
      for (const [x, y, z] of cells) {
        if (reach.has(key(x, y, z))) continue;
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const tx = x + dx;
          const tz = z + dz;
          if (!onPlan(m, tx, tz)) continue;
          const ny = stepOn(m, m.vox, x, y, z, tx, tz);
          if (ny >= 0 && !isInside(m, tx, ny, tz) && reach.has(key(tx, ny, tz))) {
            reach.add(key(x, y, z));
            grew = true;
            break;
          }
        }
      }
    }
    const lost = cells.filter((c) => !reach.has(key(...c)));
    assert.equal(lost.length, 0, `${type}: ${JSON.stringify(lost.slice(0, 6))}`);
    assert.ok(entrances(m).length >= 1, `${type}: a way below`);
  }
});

test('down a hatch by meaning to, whichever way she lies; or click it and be walked there', () => {
  for (const yaw of [Math.PI / 4, 2.4]) {
    const { game, S, p } = withShip(31, 'sloop', { yaw });
    boardAt(game, S, p, S.x, S.z);
    const E = entrances(S.m).find((q) => q.kind === 'hatch');
    putAboard(game, S, p, E.x, E.y, E.z);
    // The key whose way on the screen is nearest the way down, as she lies.
    const want = Math.atan2(E.dz, E.dx);
    let best = null;
    for (const [k, [du, dv]] of Object.entries({ KeyW: [0, -1], KeyS: [0, 1], KeyA: [-1, 0], KeyD: [1, 0] })) {
      const [ldx, ldz] = S.dirLocal(du, dv);
      let d = Math.abs(Math.atan2(ldz, ldx) - want) % (Math.PI * 2);
      if (d > Math.PI) d = Math.PI * 2 - d;
      if (!best || d < best.d) best = { k, d };
    }
    run(game, 40, keyed(best.k));
    assert.ok(!p.deck && holdShipAt(game, p.x) === S, `below (yaw ${yaw.toFixed(2)}, ${best.k})`);
  }
  // Clicked: walked to it, and down.
  const { game, S, p } = withShip(32, 'galleon');
  boardAt(game, S, p, S.x, S.z);
  const E = entrances(S.m)[0];
  assert.ok(walkAboard(game, p, S, { x: E.x, y: E.y, z: E.z }, { kind: 'below', E }));
  run(game, 60 * 12);
  assert.ok(!p.deck && holdShipAt(game, p.x) === S, 'walked down');
});

test('her wheel and a hatch are things to click; on her deck, those beside you are beside you', () => {
  const { game, S, p } = withShip(33, 'brigantine', { yaw: 0.8, crew: makeCrew(3, 'brigantine', 'vale', 3) });
  const m = S.m;
  const h = m.helm;
  assert.equal(fittingAt(S, (h.y * m.L + h.z) * m.W + h.x).kind, 'helm');
  const hz = m.hatches.find((q) => q.top);
  assert.equal(fittingAt(S, ((hz.U) * m.L + hz.z) * m.W + hz.x)?.kind, 'below');
  boardAt(game, S, p, S.x, S.z);
  run(game, 30);
  const c = crewOf(game, S)[0];
  assert.ok(c && c.deck, 'a hand aboard');
  putAboard(game, S, c, p.deck.cx + 1, p.deck.y, p.deck.cz);
  assert.equal(apart(p, c), 1, 'a pace off, by her deck');
});

test('your crew take orders: to the pump, and paid off and ashore', () => {
  const { game, S, p } = withShip(34, 'brigantine', { crew: makeCrew(5, 'brigantine', 'vale', 3) });
  boardAt(game, S, p, S.x, S.z);
  run(game, 30);
  const crew = crewOf(game, S);
  assert.ok(crew.length >= 2);
  const [a, b] = crew;
  a.order = 'pump';
  a.task = null;
  a.thinkT = 0;
  b.paidOff = true;
  S.crewRecs = S.crewRecs.filter((r) => r !== b.recRef);
  run(game, 60 * 20);
  assert.ok(!a.deck && S.hold && S.hold.has(a), 'below at the pump');
  assert.ok(!(game.sailors || []).includes(b), 'gone ashore');
  assert.equal(S.crewRecs.length, crew.length - 1);
});

test('a hole in her side mended from the water outside, with a click', () => {
  const { game, S, p } = withShip(35, 'sloop');
  const m = S.m;
  let vi = -1;
  for (let i = 0; i < m.N && vi < 0; i++) {
    const y = Math.floor(i / (m.W * m.L));
    if (m.skin[i] && S.vox[i] && y === m.deck - 1 && i % m.W === m.W - 1) vi = i;
  }
  if (vi < 0) for (let i = 0; i < m.N && vi < 0; i++) if (m.skin[i] && S.vox[i] && Math.floor(i / (m.W * m.L)) >= 2) vi = i;
  const was = S.vox[vi];
  breakVoxel(game, S, vi, 'quiet');
  const x = vi % m.W;
  const z = Math.floor(vi / m.W) % m.L;
  const [wx, wz] = S.toWorld(x + 1.6, z + 0.5);
  p.teleport(Math.round(wx), 5, Math.round(wz));
  p.give('planks', 4);
  p.selected = p.inv.findIndex((s) => s && s.item === 'planks');
  game.cursor = { mx: 0, my: 0, ship: { s: S.id, vi, face: 5 }, inReach: true };
  shipMouse(game, 1 / 60, [{ type: 'down', button: 0 }], { mouse: { down: true } });
  assert.equal(S.vox[vi], was, 'mended');
});

test('a raft meets a ship: yours, and you\'re aboard her (the raft in your pack); anyone else\'s, she\'s as solid as a bank', () => {
  const { game, S, p } = withShip(36, 'sloop');
  const [wx, wz] = S.toWorld(S.m.W + 4, S.m.L / 2);
  const tx = Math.round(wx);
  const tz = Math.round(wz);
  p.teleport(tx, 6, tz);
  assert.ok(launchRaft(game, tx, tz), 'afloat');
  p.raft.ang = Math.atan2(S.x - tx, S.z - tz);
  const input = keyed('KeyW');
  for (let i = 0; i < 60 * 5 && p.raft; i++) steer(p, 1 / 60, input);
  assert.ok(p.deck && p.deck.s === S.id, 'aboard');
  assert.ok(p.inv.some((s) => s && s.item === 'raft'), 'the raft kept');
  // A stranger's.
  const { game: g2, S: T, p: q } = withShip(37, 'sloop', { owner: 'someone-else' });
  const [ax, az] = T.toWorld(-5, T.m.L / 2);
  q.teleport(Math.round(ax), 6, Math.round(az));
  launchRaft(g2, Math.round(ax), Math.round(az));
  q.raft.ang = Math.atan2(T.x - q.raft.x, T.z - q.raft.z);
  for (let i = 0; i < 60 * 6; i++) steer(q, 1 / 60, input);
  assert.ok(q.raft && !q.deck, 'still on the raft');
  assert.equal(raftMeetsShip(g2, q, T.x, T.z), 'block');
  const [lx, lz] = T.toLocal(q.raft.x, q.raft.z);
  assert.ok(!onPlan(T.m, Math.floor(lx), Math.floor(lz)), 'not through her');
});

test('companions come aboard with you, about her deck, below, and ashore again', () => {
  const { game, S, p } = withShip(38, 'brigantine');
  const n = game.npcs.find((q) => !q.dead && q.rec.age !== 'child' && q.rec.job !== 'guard' && q.rec.job !== 'mayor');
  assert.ok(n, 'someone');
  const car = game.sim.careers;
  car.escort = { sid: n.layout.settlement.id, idx: n.rec.idx, name: n.name, until: game.sim.abs + 6000, fee: 0, hours: 100 };
  car.attach(n);
  n.teleport(p.x + 1, p.y, p.z);
  boardAt(game, S, p, S.x, S.z);
  for (let i = 0; i < 60 * 4 && !n.deck; i++) {
    game.update(1 / 60, stubInput());
    if (!n.moving) npcAboard(game, n, 1 / 60);
  }
  assert.ok(n.deck && n.deck.s === S.id, 'aboard after you');
  // Ashore: they come too.
  leaveDeck(game, p);
  p.teleport(p.x, 6, p.z);
  for (let i = 0; i < 120; i++) npcAboard(game, n, 1 / 60);
  assert.ok(!n.deck, 'off her after you');
});

// ------------------------------------------------------------ bottles
test('every ship comes in a bottle, at 750 to 5,000, and with no crew', () => {
  let last = 0;
  for (const t of TYPES) {
    const it = ITEMS[`ship_${t}`];
    assert.match(it.name, /in a Bottle$/, it.name);
    assert.equal(it.name, `${SHIP_TYPES[t].name} in a Bottle`);
    assert.ok(it.shipPrice >= 750 && it.shipPrice <= 5000 && it.shipPrice > last, `${t}: ${it.shipPrice}`);
    last = it.shipPrice;
  }
  assert.equal(ITEMS.ship_sloop.shipPrice, 750);
  assert.equal(ITEMS.ship_frigate.shipPrice, 5000);
  assert.ok(ITEMS.ship_bottle && ITEMS.ship_bottle.shipBottle);
  const game = makeGame(39);
  const npc = game.npcs.find((q) => q.layout);
  assert.equal(game.sim.buyPrice(npc, 'ship_galleon'), ITEMS.ship_galleon.shipPrice, 'the same price anywhere');
  // Launched: no crew till you sign some on.
  const spot = openWater(game, 'sloop');
  const p = game.player;
  const [sx, sz] = [spot.x, spot.z];
  // (On the shore nearest her water.)
  for (let r = 0; r < 60; r++) {
    const x = Math.round(sx + (p.x - sx) * (r / 60));
    const z = Math.round(sz + (p.z - sz) * (r / 60));
    const y = game.world.findStandY(x, z, 8);
    if (y >= 0 && !game.world.isWaterAt(x, y, z) && !game.world.isWaterAt(x, y - 1, z)) {
      p.teleport(x, y, z);
      break;
    }
  }
  p.give('ship_sloop', 1);
  const n0 = shipsOf(game).length;
  useShipItem(game, ITEMS.ship_sloop);
  const S = shipsOf(game)[n0];
  assert.ok(S, 'launched');
  assert.equal(S.crewRecs.length, 0, 'no crew');
});

test('a ship of yours into a bottle (her crew, her damage, her stores) and out again', () => {
  const { game, S, p } = withShip(40, 'brigantine', { crew: makeCrew(9, 'brigantine', 'vale', 3), name: 'The Grey Heron' });
  breakVoxel(game, S, S.m.N - S.m.W * 3 + 2, 'quiet');
  const diff = S.save().diff.length;
  p.give('ship_bottle', 1);
  useShipItem(game, ITEMS.ship_bottle);
  assert.ok(!shipsOf(game).includes(S), 'gone into it');
  const slot = p.inv.find((s) => s && s.item.startsWith('bottled~'));
  assert.ok(slot, 'a ship in a bottle');
  const it = ITEMS[slot.item];
  assert.equal(it.name, 'Brigantine in a Bottle');
  assert.equal(it.shipName, 'The Grey Heron');
  // Kept with the world.
  const d = game.serialize();
  assert.ok(d.ships.bottles && Object.keys(d.ships.bottles).length === 1);
  // Uncorked.
  p.teleport(S.x + S.m.W + 3, 6, S.z);
  useShipItem(game, it);
  const T = shipsOf(game).find((q) => q.name === 'The Grey Heron');
  assert.ok(T, 'out again');
  assert.equal(T.crewRecs.length, 3, 'her crew with her');
  assert.equal(T.save().diff.length, diff, 'her damage with her');
  assert.ok(!p.inv.some((s) => s && s.item === slot.item));
});

test('the masters of sunken places may drop a ship in a bottle', () => {
  assert.ok(sunkenPlace({ type: 'broch', name: 'the Drowned Broch' }));
  assert.ok(sunkenPlace({ type: 'gut', name: 'x' }) && sunkenPlace({ type: 'grotto', name: 'x' }));
  assert.ok(sunkenPlace({ type: 'crypt', name: 'the Drowned Crypt of Ys' }));
  assert.ok(!sunkenPlace({ type: 'crypt', name: 'the Crypt of Ys' }));
  assert.ok(!sunkenPlace({ type: 'barrow', name: 'Old Barrow' }));
});

// ------------------------------------------------------------ her ghost
test('a ship in a bottle in hand: her ghost on the water, red where she\'d be on land', () => {
  const { game, S, p, spot } = withShip(41, 'sloop');
  shipsOf(game).splice(shipsOf(game).indexOf(S), 1);
  p.give('ship_sloop', 1);
  p.selected = p.inv.findIndex((s) => s && s.item === 'ship_sloop');
  p.teleport(spot.x + 6, 6, spot.z);
  game.cursor = { mx: 0, my: 0, x: spot.x, y: 5, z: spot.z };
  shipGhostTick(game);
  assert.ok(game.shipGhost && game.shipGhost.ok, 'clear on open water');
  // Pointed at the land (the player's own island).
  const w = game.world;
  let land = null;
  for (let r = 1; r < 400 && !land; r += 2) {
    for (let k = 0; k < 24 && !land; k++) {
      const x = Math.round(spot.x + Math.cos(k / 3.8) * r);
      const z = Math.round(spot.z + Math.sin(k / 3.8) * r);
      const y = w.findStandY(x, z, 8);
      if (y > 0 && !w.isWaterAt(x, y, z) && !w.isWaterAt(x, y - 1, z)) land = { x, y, z };
    }
  }
  assert.ok(land);
  p.teleport(land.x, land.y, land.z);
  game.cursor = { mx: 0, my: 0, x: land.x, y: land.y, z: land.z };
  shipGhostTick(game);
  assert.ok(game.shipGhost && !game.shipGhost.ok && game.shipGhost.bad.length > 0, 'red, and where');
  // And she isn't launched there.
  const n0 = shipsOf(game).length;
  useShipItem(game, ITEMS.ship_sloop);
  assert.equal(shipsOf(game).length, n0);
});

// ------------------------------------------------------------ her plans
test('a blueprint table in every ship (the galleon\'s in her captain\'s cabin): her name and colours', () => {
  for (const t of TYPES) {
    const m = shipModel(t);
    assert.ok(m.blueprint, t);
    const { x, y, z } = m.blueprint;
    assert.equal(m.vox[(y * m.L + z) * m.W + x], B.blueprint_table, t);
  }
  const g = shipModel('galleon');
  assert.ok(g.cabins.some((c) => c.kind !== 'galley' && g.blueprint.y === c.y && g.blueprint.z >= c.z0 && g.blueprint.z <= c.z1), 'in a cabin');
  assert.equal(BLOCKS[B.blueprint_table].interact, 'blueprint');
  // Used, below: her plans opened (yours), or not (anyone else's).
  const { game, S, p } = withShip(42, 'sloop');
  let opened = null;
  game.ui.openBlueprint = (q) => (opened = q);
  holdOf(game, S);
  const [X, Y, Z] = holdPos(S, S.m.blueprint.x, S.m.blueprint.y, S.m.blueprint.z);
  assert.equal(game.world.getBlock(X, Y, Z), B.blueprint_table, 'there below');
  S.owner = ownerId(game, p);
  holdUse(game, p, X, Y, Z, 'blueprint');
  assert.equal(opened, S);
  opened = null;
  S.owner = 'someone-else';
  holdUse(game, p, X, Y, Z, 'blueprint');
  assert.equal(opened, null);
});

test('below her decks, the view turns with her; back on deck, as it was', () => {
  const { game, S, p } = withShip(43, 'brigantine');
  const r = game.renderer;
  r.view = 1;
  r.turn = (d) => (r.view = (r.view + d + 4) & 3);
  boardAt(game, S, p, S.x, S.z);
  const E = entrances(S.m)[0];
  walkAboard(game, p, S, { x: E.x, y: E.y, z: E.z }, { kind: 'below', E });
  run(game, 60 * 12);
  assert.ok(holdShipAt(game, p.x) === S, 'below');
  for (const [deg, want] of [[0, 1], [90, 0], [180, 3], [270, 2]]) {
    S.yaw = (deg * Math.PI) / 180;
    for (let i = 0; i < 4; i++) holdViewTick(game);
    assert.equal(r.view, want, `${deg}°`);
  }
  putAboard(game, S, p, S.m.spawn.x, S.m.deck + 1, S.m.spawn.z);
  holdViewTick(game);
  assert.equal(r.view, 1, 'as it was');
});

test('at her wheel the view draws back to take in all of her, centred on her; let go, and it comes in again', () => {
  for (const type of ['sloop', 'galleon']) {
    const { game, S, p } = withShip(45, type);
    const r = game.renderer;
    r.toView ||= (x, z) => [x, z];
    boardAt(game, S, p, S.x, S.z);
    assert.equal(helmView(game), null, 'not at the wheel');
    const st = S.m.helm.stand;
    putAboard(game, S, p, st.x, st.y, st.z);
    deckInteract(game, p);
    assert.equal(p.deck.role, 'helm');
    const v = helmView(game);
    assert.ok(v && v.zoom > 1.3 && v.zoom <= HELM_ZOOM_MAX, `${type}: ${v && v.zoom}`);
    assert.ok(Math.hypot(v.focus.x - S.x, v.focus.z - S.z) < S.m.L / 2, 'her middle');
    run(game, 2);
    assert.ok(game.renderer.zoomGoal >= v.zoom - 0.01, 'the camera told');
    assert.ok(game.helmFocus);
    deckInteract(game, p);
    run(game, 2);
    assert.ok(!game.helmFocus && game.renderer.zoomGoal < v.zoom);
  }
});

// ------------------------------------------------------------ the wind
test('she makes way on every heading but dead into the wind (and there she falls off it)', () => {
  for (const rel of [0, 60, 110, 150, 178]) {
    const { game, S } = withShip(44, 'sloop');
    S.anchor = false;
    S.sailGoal = 1;
    S.sailSet = 1;
    const x0 = S.x;
    const z0 = S.z;
    const W = windOf(game);
    const downwind = Math.atan2(W.x, W.z);
    S.yaw = downwind + (rel * Math.PI) / 180;
    const y0 = S.yaw;
    run(game, 60 * 12);
    const moved = Math.hypot(S.x - x0, S.z - z0);
    const turned = Math.abs(S.yaw - y0);
    assert.ok(moved > 2 || turned > 0.3, `${rel}° off the wind: moved ${moved.toFixed(1)}, turned ${turned.toFixed(2)}`);
  }
});

// ------------------------------------------------------------ the map
test('every land\'s ground has its own mark on the map (none a "?")', () => {
  for (const [k, b] of Object.entries(BIOMES)) for (const c of b.char || '') assert.ok(CHAR_INDEX.has(c), `${k}: ${c}`);
  for (const c of '§◊◎∆♜✦●▮▯') assert.ok(CHAR_INDEX.has(c), c);
});

// ------------------------------------------------------------ the update
test('a world from 0.68 comes up to 0.69', () => {
  assert.ok(compareVersions(GAME_VERSION, '0.69.0') >= 0);
  assert.ok(STEPS.find((s) => s.to === '0.69.0'));
  const d = { gv: '0.68.0', v: 1, ships: { ships: [], seq: 0 } };
  const r = migrateSave(d);
  assert.deepEqual(d.ships.bottles, {});
  assert.ok(r.log.some((t) => /bottle/i.test(t)));
  assert.ok(shipById);
});
