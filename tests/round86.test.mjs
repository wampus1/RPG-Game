// Round 86: the essentials. Out of your depth, swimming only for water no
// deeper; the anchor weighed at the capstan, quicker for more hands; a
// flag in layers, kept and sent; piracy (a realm hunting you, an honest
// hand turning, the guilds' coves letting you in, sworn to one); the
// spyglass; and the version's step.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeGame, stubInput } from './helpers.mjs';
import { B } from '../src/world/blocks.js';
import { addShip, roomFor, sailable, ownerId, boardAt, packShip } from '../src/game/ships3d.js';
import { makeCrew } from '../src/game/shipcrew.js';
import { capstanOf, startWeigh, weighTick, letGo } from '../src/game/anchor.js';
import { flagColorAt, cleanLayers, markAt, MARKS } from '../src/render/shipvox.js';
import { piracyOf, shipSunk, pirateFoe, isKnownPirate, pledge, piracyTick, PIRATE_AT } from '../src/game/piracy.js';
import { covesOf, spawnPirate, GUILDS, piratesSave, piratesLoad } from '../src/game/pirates.js';
import { toggleSpyglass, spyWheel, spyTick, SPY_MAX } from '../src/game/spyglass.js';
import { VIEW_W, VIEW_H } from '../src/config.js';
import { GAME_VERSION, compareVersions } from '../src/version.js';
import { stepsFor, migrateSave } from '../src/game/migrate.js';

const input = stubInput();
const G = makeGame(12345, { wg: 8 });
const run = (n) => {
  for (let i = 0; i < n; i++) G.update(0.05, input);
};
run(10);
const p = G.player;

// ------------------------------------------------------------ deep water
test('out of your depth: shallower or as deep, never deeper', () => {
  const w = G.world;
  const x0 = Math.round(p.x) + 6;
  const z0 = Math.round(p.z) + 6;
  // A, D: three deep; B: four deep; C: two deep (swimmable).
  const col = (x, z, deep) => {
    for (let y = 1; y < 10; y++) w.setBlock(x, y, z, y > 5 ? B.air : y > 5 - deep ? B.water : B.stone);
  };
  col(x0, z0, 3);
  col(x0 + 1, z0, 4);
  col(x0 - 1, z0, 2);
  col(x0, z0 + 1, 3);
  assert.equal(w.waterDepth(x0, 5, z0), 3);
  assert.equal(w.stepTarget(x0, 5, z0, x0 - 1, z0, false, true), 5, 'to the shallows');
  assert.equal(w.stepTarget(x0, 5, z0, x0, z0 + 1, false, true), 5, 'along as deep');
  assert.notEqual(w.stepTarget(x0, 5, z0, x0 + 1, z0, false, true), 5, 'not deeper');
  assert.notEqual(w.stepTarget(x0 - 1, 5, z0, x0, z0, false, true), 5, 'from swimmable water, not out of your depth');
});

// ------------------------------------------------------------ ships
function openSpot(x0, z0, minR = 30) {
  const open = (x, z, r) => {
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2;
      if (!sailable(G, Math.round(x + Math.cos(a) * r), Math.round(z + Math.sin(a) * r))) return false;
    }
    return true;
  };
  for (let R = minR; R < 1500; R += 12) {
    for (let k = 0; k < 48; k++) {
      const a = (k / 48) * Math.PI * 2;
      const x = Math.round(x0 + Math.cos(a) * R);
      const z = Math.round(z0 + Math.sin(a) * R);
      G.loadAround?.(x, z, true);
      if (roomFor(G, 'galleon', x, z, 0) && sailable(G, x, z) && open(x, z, 40)) return { x, z };
    }
  }
  return null;
}

let mine = null;
test('the capstan: the anchor weighed by hands at the bars, quicker with more', () => {
  const sp = openSpot(p.x, p.z);
  assert.ok(sp, 'open water');
  mine = addShip(G, { type: 'galleon', x: sp.x, z: sp.z, yaw: 0.4, owner: ownerId(G, p), anchor: true, crew: [], flagLayers: [{ shape: 'skull', color: '#f0f0e8' }, { shape: 'nope', color: '#000000' }] });
  const cap = capstanOf(mine);
  assert.ok(cap, 'a capstan');
  assert.ok(startWeigh(G, mine));
  assert.ok(mine.weigh && mine.anchor, 'weighing, still down');
  weighTick(G, mine, 2);
  assert.equal(mine.weigh.k, 0, 'nobody at the bars');
  const hand = (i) => ({ id: 9000 + i, dead: false, deck: { s: mine.id, cx: cap.x + (i % 2 ? 1 : -1), cz: cap.z, y: cap.y, role: null } });
  const was = G.sailors;
  G.sailors = [hand(0)];
  weighTick(G, mine, 1);
  const one = mine.weigh.k;
  G.sailors = [hand(0), hand(1), hand(2), hand(3)];
  weighTick(G, mine, 1);
  const four = mine.weigh.k - one;
  assert.ok(one > 0 && four > one * 3, `four at the bars quicker than one (${one} vs ${four})`);
  for (let k = 0; k < 40 && mine.anchor; k++) weighTick(G, mine, 1);
  assert.ok(!mine.anchor && !mine.weigh, 'aweigh');
  G.sailors = was;
  letGo(G, mine);
  assert.ok(mine.anchor);
});

test('her flag in layers: drawn, kept, sent', () => {
  assert.deepEqual(mine.flagLayers, [{ shape: 'skull', color: '#f0f0e8' }], 'an unknown shape dropped');
  assert.ok(MARKS.length >= 20);
  for (const m of MARKS) {
    let n = 0;
    for (let i = 0; i < 20; i++) for (let j = 0; j < 20; j++) n += markAt(m, (i + 0.5) / 20, (j + 0.5) / 20) ? 1 : 0;
    assert.ok(n > 0 && n < 400, `${m}: some of the flag, not all`);
  }
  const F = { flag: '#1a1a1a', flagLayers: [{ shape: 'border', color: '#a02020' }, { shape: 'disc', color: '#e0c040' }] };
  assert.equal(flagColorAt(F, 0.02, 0.5), '#a02020');
  assert.equal(flagColorAt(F, 0.5, 0.48), '#e0c040');
  assert.equal(flagColorAt(F, 0.25, 0.3), '#1a1a1a');
  assert.deepEqual(mine.save().flagLayers, mine.flagLayers);
  assert.deepEqual(packShip(mine).fy, mine.flagLayers);
  assert.equal(cleanLayers(new Array(9).fill({ shape: 'disc', color: '#ffffff' })).length, 5);
});

// ------------------------------------------------------------ piracy
test('piracy: a realm hunts you, an honest hand turns, the coves let you in, a guild sworn to', () => {
  const sp = openSpot(mine.x, mine.z, 40);
  p.teleport(Math.round(mine.x + mine.m.W / 2 + 2), 6, mine.z);
  boardAt(G, mine, p, mine.x, mine.z);
  assert.ok(p.deck, 'aboard');
  const civ = G.world.ow.civs[0];
  const town = G.world.ow.settlements.find((s) => s.civ && s.civ.id === civ.id);
  if (town) G.sim.renown.set(town.id, 30);
  mine.crewRecs = makeCrew(77, 'galleon', 'vale', 2);
  mine.crewRecs[0].temper = 'rogue';
  mine.crewRecs[1].temper = 'honest';
  const honest = mine.crewRecs[1];
  const sink = (o = {}) => {
    const T = addShip(G, { type: 'brigantine', x: sp.x, z: sp.z, yaw: 0, civ: civ.id, crew: [], name: 'The Fair Venture', ...o });
    T.lastHit = { ship: mine.id, by: null };
    return T;
  };
  // (Fired on first: fighting back's no crime.)
  const A = sink();
  A.firedOnPlayer = true;
  shipSunk(G, A);
  assert.equal(piracyOf(G, p).n, 0);
  shipSunk(G, sink());
  const r = piracyOf(G, p);
  assert.equal(r.n, 1);
  assert.equal(r.sunk[civ.id], 1);
  if (town) assert.ok(G.sim.renown.get(town.id) < 30, 'thought the worse of');
  assert.equal(honest.qualms, 1, 'a warning');
  assert.ok(!honest.mutineer && mine.crewRecs[0].qualms === undefined);
  shipSunk(G, sink());
  assert.ok(honest.mutineer, 'mutiny');
  // A warship of that realm comes about for you.
  const W = addShip(G, { type: 'frigate', x: mine.x + 40, z: mine.z, yaw: 0, civ: civ.id, crew: [], name: 'The Valour' });
  W.vkind = 'war';
  G.piracy.t = 0;
  piracyTick(G, 1);
  assert.ok(W.fight && W.fight.ship === mine.id, 'hunted');
  // Known for a pirate: the coves let you in; sworn, rivals still come.
  assert.ok(!isKnownPirate(G, p) && pirateFoe(G, p, 0));
  for (let i = r.n; i < PIRATE_AT; i++) shipSunk(G, sink());
  assert.ok(isKnownPirate(G, p));
  assert.ok(!pirateFoe(G, p, 0) && !pirateFoe(G, p, 2), 'let in at any cove');
  pledge(G, p, 1, GUILDS[1]);
  assert.ok(!pirateFoe(G, p, 1) && pirateFoe(G, p, 0), 'theirs, and the others\' rival');
  // Sinking one of your own guild: cast out.
  const own = spawnPirate(G, sp.x, sp.z + 30, { guild: 1 });
  if (own) {
    assert.deepEqual(own.flagLayers, GUILDS[1].layers);
    own.lastHit = { ship: mine.id, by: null };
    shipSunk(G, own);
    assert.equal(piracyOf(G, p).guild, null);
  }
  // Kept with the world.
  const saved = JSON.parse(JSON.stringify(piratesSave(G)));
  const n = piracyOf(G, p).n;
  piratesLoad(G, saved);
  assert.equal(piracyOf(G, p).n, n);
});

test('the guilds\' coves: one each, on different lands', () => {
  const C = covesOf(G);
  assert.ok(C.length >= 1);
  assert.deepEqual(C.map((c) => c.guild), C.map((_, i) => i));
  assert.equal(new Set(C.map((c) => c.name)).size, C.length);
});

// ------------------------------------------------------------ the spyglass
test('the spyglass: up, turned by the mouse, run out by the wheel', () => {
  const held = p.heldDef;
  p.heldDef = () => ({ key: 'spyglass' });
  assert.ok(toggleSpyglass(G) && G.spy);
  const d0 = G.spy.d;
  assert.ok(spyWheel(G, -1) && G.spy.d > d0, 'further out');
  for (let i = 0; i < 30; i++) spyWheel(G, -1);
  assert.equal(G.spy.d, SPY_MAX);
  let f = null;
  for (let i = 0; i < 60; i++) f = spyTick(G, { mouse: { inside: true, x: VIEW_W - 2, y: VIEW_H / 2 } }, 0.1);
  const rp = p.renderPos ? p.renderPos() : p;
  assert.ok(Math.hypot(f.x - rp.x, f.z - rp.z) > SPY_MAX * 0.9, 'looking far out');
  // (Put away: lowered.)
  p.heldDef = held;
  assert.equal(spyTick(G, input, 0.1), null);
  assert.equal(G.spy, null);
});

// ------------------------------------------------------------ the version
test('0.86.0: its step', () => {
  assert.ok(compareVersions(GAME_VERSION, '0.86.0') >= 0);
  assert.ok(stepsFor('0.85.0').some((s) => s.to === '0.86.0'));
  const { log } = migrateSave({ gv: '0.85.0', wg: 8 });
  assert.ok(log.some((l) => /capstan/.test(l)));
});
