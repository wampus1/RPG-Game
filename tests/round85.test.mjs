// Round 85: the essentials. Quests saying plainly what to do and where (the
// pirates' cove found and marked, a mark moved and cleared as the task
// goes), the lost heirloom somewhere it can be had, no carried lights
// aboard ship, a holed ship flooding by the world's clock and patched with
// cobblestone, ships fired on fighting back or running, and the version's
// step.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeGame, stubInput } from './helpers.mjs';
import { B } from '../src/world/blocks.js';
import { R } from '../src/sim/saga/core.js';
import { coveOf } from '../src/game/pirates.js';
import { addShip, roomFor, sailable, ownerId, boardAt, breakVoxel, mendWith, shotAt, floodTime, PATCHES } from '../src/game/ships3d.js';
import { makeCrew } from '../src/game/shipcrew.js';
import { GAME_VERSION, compareVersions } from '../src/version.js';
import { stepsFor, migrateSave } from '../src/game/migrate.js';

const input = stubInput();
const G = makeGame(12345, { wg: 8 });
const S = G.sim.saga;
const run = (n) => {
  for (let i = 0; i < n; i++) G.update(0.05, input);
};
run(10);
const me = () => S.players()[0].pid;

// ------------------------------------------------------------ quests
test('taken at sea: the cove named, placed and marked; plain words for what to do', () => {
  const cove = coveOf(G);
  assert.ok(cove, 'a cove');
  const s = G.world.ow.settlements.find((q) => q.type === 'town' && G.world.layouts.get(q.id));
  S.emit('ship_taken', { sid: s.id, ship: 'Sea Maid', cove: cove.name, to: 'X' });
  run(10);
  const th = S.threads.find((q) => q.m === 'taken_at_sea');
  assert.ok(th, 'the story');
  const t = th.tasks[0];
  const heard = S.guide(t, me());
  assert.match(heard.how, /ransom/);
  assert.equal(heard.at.x, cove.x);
  assert.match(heard.where, new RegExp(cove.name));
  S.accept(t, R.pl(me()));
  assert.match(S.guide(t, me()).how, new RegExp(`Sail a ship to ${cove.name}`));
  assert.ok(G.world.ow.pins.some((q) => q.task === t.id && q.x === cove.x), 'marked');
  // (Beaten at the cove: found, done, and the mark moves to whoever asked.)
  S.emit('pirates_beaten', { ship: 99, name: 'The Black Gull', cove: true, pid: me() });
  run(5);
  assert.equal(t.status, 'won');
  assert.match(S.guide(t, me()).how, /Go back to/);
  S.turnIn(t, me());
  assert.ok(!G.world.ow.pins.some((q) => q.task === t.id), 'the mark gone with it');
  // (No cove, no story: nowhere to go.)
  const n = S.threads.length;
  S.emit('ship_taken', { sid: s.id, ship: 'Other', cove: null, to: 'X' });
  run(5);
  assert.equal(S.threads.filter((q) => q.m === 'taken_at_sea').length, S.threads.length - n + 1);
});

test('every open task has a "to do" and a place', () => {
  // (A few days for the world's stories to get going.)
  G.skipDays(3);
  for (let k = 0; G.skipping && k < 20000; k++) G.update(0.1, input);
  let n = 0;
  for (const th of S.threads) for (const t of th.tasks) {
    if (t.status !== 'open') continue;
    n++;
    const g = S.guide(t, me());
    assert.ok(g.how && g.how.length > 10, `${th.m}/${t.role}: how`);
    assert.ok(g.at && Number.isFinite(g.at.x), `${th.m}/${t.role}: where`);
  }
  assert.ok(n >= 1);
});

test('a strongbox to open wherever something\'s stashed at a camp', async () => {
  const { stash } = await import('../src/sim/saga/motifs/camp.js');
  const b = G.sim.bandits.live().find((q) => q.camp);
  if (!b) return;
  b.camp.cage = null;
  stash(S, b, [{ item: 'heirloom', count: 1 }]);
  assert.ok(b.camp.cage && b.camp.cage.stash, 'the box made');
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

let ship = null;
test('aboard: no carried light; a hole floods by the world\'s clock, and cobblestone stops it', () => {
  const p = G.player;
  const sp = openSpot(p.x, p.z);
  assert.ok(sp, 'open water');
  ship = addShip(G, { type: 'galleon', x: sp.x, z: sp.z, yaw: 0.7, owner: ownerId(G, p), anchor: true, crew: [] });
  p.teleport(Math.round(sp.x + ship.m.W / 2 + 2), 6, sp.z);
  boardAt(G, ship, p, ship.x, ship.z);
  assert.ok(p.deck, 'aboard');
  // A lantern-bearer aboard sheds none.
  const n = G.npcs[0];
  if (n) {
    const was = n.deck;
    n.deck = { s: ship.id };
    assert.ok(!G.entityLights().some((q) => q.ent === n));
    n.deck = was;
  }
  const m = ship.m;
  let hole = -1;
  for (let i = 0; i < m.N && hole < 0; i++) {
    const y = Math.floor(i / (m.W * m.L));
    if (m.skin[i] && m.struct[i] && ship.vox[i] && y > 0 && y <= m.wl - 1) hole = i;
  }
  assert.ok(hole >= 0);
  breakVoxel(G, ship, hole, 'quiet');
  assert.equal(ship.leaks.length, 1);
  run(2);
  const f0 = ship.floodCells;
  G.advanceTime(120);
  run(1);
  assert.ok(ship.floodCells > f0 + 50, `two hours' water in her (${f0} -> ${ship.floodCells})`);
  // (floodTime: as long as the frame, awake.)
  G.shipClock = undefined;
  assert.equal(floodTime(G, 0.05), 0.05);
  assert.ok(PATCHES('cobblestone') && PATCHES('planks') && !PATCHES('torch'));
  p.give('cobblestone', 3);
  const heldWas = p.heldDef;
  p.heldDef = () => ({ key: 'cobblestone' });
  assert.ok(mendWith(G, p, ship, hole), 'patched');
  p.heldDef = heldWas;
  assert.equal(ship.vox[hole], B.cobblestone);
  assert.equal(ship.leaks.length, 0);
  const f1 = ship.floodCells;
  G.advanceTime(60);
  run(1);
  assert.ok(ship.floodCells <= f1, 'no more water in');
});

test('fired on: a warship fights, a merchantman runs', () => {
  assert.ok(ship);
  const sp = openSpot(ship.x, ship.z, 40);
  const M = addShip(G, { type: 'brigantine', x: sp.x, z: sp.z, yaw: 0, crew: makeCrew(5, 'brigantine', 'vale', 8), name: 'The Fair Venture', ammo: 999 });
  M.vkind = 'trade';
  shotAt(G, M, { ship: ship.id });
  assert.ok(M.flee && !M.fight, 'runs');
  const W = addShip(G, { type: 'frigate', x: sp.x, z: sp.z + 40, yaw: 0, crew: makeCrew(7, 'frigate', 'vale', 14), name: 'The Valour', ammo: 999 });
  W.vkind = 'war';
  shotAt(G, W, { ship: ship.id });
  assert.ok(W.fight && W.fight.ship === ship.id, 'fights');
  // (A player's own ship isn't turned on anyone by it.)
  const mine = ship;
  shotAt(G, mine, { ship: W.id });
  assert.ok(!mine.fight && !mine.flee);
});

// ------------------------------------------------------------ the version
test('0.85.0: its step', () => {
  assert.ok(compareVersions(GAME_VERSION, '0.85.0') >= 0);
  assert.ok(stepsFor('0.84.0').some((s) => s.to === '0.85.0'));
  const d = { gv: '0.84.0', wg: 8 };
  const { log } = migrateSave(d);
  assert.ok(log.some((l) => /To do/.test(l)));
});
