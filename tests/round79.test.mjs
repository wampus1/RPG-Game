// Round 79: the essentials of what's new (one world shared where it can
// be, to keep it quick): a town's rack, the ride's wait, map markers,
// crafting by the batch, the stories' director, memories, peaceful ways
// out, trails, failure's branches, mods' scripts, commands, needs and
// steps, the new lie of the land, and the version.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeGame, stubInput } from './helpers.mjs';
import { B } from '../src/world/blocks.js';
import { REGION_W, REGION_D } from '../src/config.js';
import { useDisplay } from '../src/game/displays.js';
import { buildingAt } from '../src/sim/sim.js';
import { hurry } from '../src/game/rides.js';
import { addMark } from '../src/ui/worldmap.js';
import { CraftWindow } from '../src/ui/windows.js';
import { addItem, countItem } from '../src/game/inventory.js';
import { craftSources } from '../src/game/invtools.js';
import { R } from '../src/sim/saga/core.js';
import { storyCallback } from '../src/sim/saga/memory.js';
import { peaceRespond } from '../src/sim/saga/resolve.js';
import { planTrail } from '../src/sim/saga/motifs/trails.js';
import { RNG } from '../src/util/rng.js';
import { newMod, normalizeMod, modHash } from '../src/mod/format.js';
import { installMods, uninstallMods } from '../src/mod/registry.js';
import { runCommand } from '../src/game/commands.js';
import { runMigrations, tryScript } from '../src/mod/scripts.js';
import { checkMods, orderMods } from '../src/mod/deps.js';
import { landmarksIn } from '../src/world/landmarks.js';
import { GAME_VERSION, compareVersions } from '../src/version.js';
import { stepsFor } from '../src/game/migrate.js';

const input = stubInput();
const G = makeGame(12345);
for (let i = 0; i < 6; i++) G.update(0.1, input);
const S = G.sim.saga;
const L = [...G.world.layouts.values()].find((l) => l.econ && l.npcs.length > 8);
const sid = L.settlement.id;
const folk = L.npcs.filter((r) => r.age !== 'child' && !r.dead);

test('a rack the town set out in its yard is the town\'s: taking from it is theft', () => {
  const p = G.player;
  let spot = null;
  for (let z = L.bounds.z0; z <= L.bounds.z1 && !spot; z++) for (let x = L.bounds.x0; x <= L.bounds.x1 && !spot; x++) {
    if (buildingAt(L, x, z) || G.world.ow.settlementAt(x, z) !== L.settlement) continue;
    const y = G.world.findStandY(x, z, p.y);
    if (y > 0) spot = { x, y, z };
  }
  const { x, y, z } = spot;
  G.world.setBlock(x, y, z, B.weapon_rack);
  const rk = G.world.regionKey(Math.floor(x / REGION_W), Math.floor(z / REGION_D));
  if (!L.placements.get(rk)) L.placements.set(rk, []);
  L.placements.get(rk).push(x, y, z, B.weapon_rack, 0);
  G.world.getContainer(x, y, z)[0] = { item: 'iron_sword', count: 1 };
  assert.equal(G.containerOwner(x, y, z).kind, 'town');
  p.selected = p.inv.findIndex((q) => !q);
  const before = G.sim.justice.unsolved.length + [...G.sim.justice.pending.values()].flat().length;
  useDisplay(G, x, y, z);
  assert.ok(G.sim.justice.unsolved.length + [...G.sim.justice.pending.values()].flat().length > before);
  // (One you put up yourself is yours.)
  G.myChests = new Set([`${x},${y},${z}`]);
  assert.equal(G.containerOwner(x, y, z), null);
});

test('T on the coach opens the wait window; map markers; crafting by the batch', () => {
  const p = G.player;
  let opened = null;
  const was = G.ui.openWait;
  G.ui.openWait = (o) => (opened = o);
  p._ride = { kind: 'coach' };
  p.rideInfo = { left: 95 };
  hurry(G, p);
  assert.equal(opened.ride, 95);
  p._ride = null;
  p.rideInfo = null;
  G.ui.openWait = was;
  const m = addMark(G, 100, 200, 'Camp');
  assert.ok(G.mapMarks.includes(m) && m.label === 'Camp');
  const cw = new CraftWindow({ msg() {}, audio: null, game: G }, 'hand');
  const r = cw.recipes.find((q) => q.out === 'stick');
  for (let i = 0; i < p.inv.length; i++) if (p.inv[i] && /planks/.test(p.inv[i].item)) p.inv[i] = null;
  addItem(p.inv, 'planks', 10);
  const most = cw.maxTimes(craftSources(G), r);
  assert.ok(most >= 5, `planks for ${most}`);
  const n0 = countItem(p.inv, 'stick');
  cw.craft(r, G, most, true);
  assert.equal(countItem(p.inv, 'stick'), n0 + most * r.n);
  assert.equal(cw.maxTimes(craftSources(G), r), 0);
});

test('the director: a quiet stretch after a raid, an opening after a death', () => {
  const D = S.director;
  D.heat = 0;
  D.observe({ type: 'raid', won: true, sid });
  D.observe({ type: 'war_raid', sid });
  D.newDay(40, new RNG(1));
  assert.equal(D.mood, 'quiet');
  D.observe({ type: 'player_died', pid: 'host' });
  assert.ok(D.owed.some((o) => o.pid === 'host'));
  D.newDay(D.owed[0].at, new RNG(2));
  assert.ok(S.live().some((t) => t.m === 'boon') || S.traceLog.some((l) => l.kind === 'director' && /opening/.test(l.text)));
});

test('a story ended peacefully (a bribe), and remembered by those in it', () => {
  const th = S.begin('strike', { cast: { lead: R.rec(sid, folk[2].idx), mayor: R.rec(sid, folk[3].idx), town: R.town(sid) }, sid, vars: { who: 'the weavers' } });
  S.touch(th, 'host');
  addItem(G.player.inv, 'coin', 200);
  peaceRespond(S, { rec: folk[2], settlement: L.settlement, id: 1 }, G, 'sgp_bribe', `t${th.id}`);
  assert.ok(th.done && th.outcome === 'paid');
  S.memories.at(-1).day -= 5;
  const said = storyCallback(S, { rec: folk[2], settlement: L.settlement }, G, new RNG(3));
  assert.ok(said && /weavers/i.test(said.text), said && said.text);
});

test('a task missed leads on to another story; a trail stays this side of the storm while it stands', () => {
  const th = S.begin('feud', { cast: { a: R.rec(sid, folk[4].idx), b: R.rec(sid, folk[5].idx), town: R.town(sid) }, sid, vars: { why: 'a fence', fa: 'Xa', fb: 'Yb', step: 0 } });
  // (Chance has a say: a few tries.)
  let branched = false;
  for (let k = 0; k < 6 && !branched; k++) {
    const t = S.tasksOf(th)[0] || S.post(th, { role: 'mediate', kind: 'talk', title: `try ${k}`, sid });
    S.accept(t, R.pl('host'));
    t.due = S.now - 1;
    th.vars.fellOut = false;
    th.steps++;
    S.hourly(Math.floor(S.now / 60) + 1 + k);
    branched = S.live().some((q) => q.m === 'fallout');
  }
  assert.ok(branched);
  const plan = planTrail(S, L.settlement, new RNG(4));
  assert.ok(plan.wall && plan.legs.every((id) => !G.world.ow.settlements[id].far));
});

test('mods: a script\'s command, another mod\'s value, a sandbox that stops, needs and clashes, versioned steps', () => {
  const a = newMod({ name: 'Alpha', version: '1.2.0' });
  a.id = 'alphamod';
  a.scripts = { s: { name: 'S', code: 'on command "boom" (args) {\n  setvar("n", getvar("n") + 1)\n  give("bread", 1)\n}\non migrate "1.1.0" { setvar("moved", 1) }' } };
  const b = newMod({ name: 'Beta' });
  b.id = 'betamod';
  b.requires = [{ id: 'alphamod', version: '1.0.0' }, { id: 'missingmod' }];
  b.rules = { breakSpeed: 50 };
  a.rules = { breakSpeed: 150 };
  normalizeMod(a);
  normalizeMod(b);
  const warns = checkMods([b, a]);
  assert.ok(warns.some((w) => /missingmod/.test(w.text)) && warns.some((w) => w.kind === 'clash'));
  assert.deepEqual(orderMods([b, a]).map((m) => m.id), ['alphamod', 'betamod']);
  installMods([b, a]);
  const bread = countItem(G.player.inv, 'bread');
  runCommand(G, 'boom');
  assert.equal(countItem(G.player.inv, 'bread'), bread + 1);
  assert.equal(G.modState.vars['alphamod:n'], 1);
  assert.deepEqual(runMigrations(G, [{ id: 'alphamod', version: '1.0.0' }]), ['Alpha 1.1.0']);
  assert.ok(!tryScript(G, a, 'while true { let x = 1 }').ok);
  assert.ok(tryScript(G, a, 'log(str({}.constructor))').lines.some((l) => l.includes('none')));
  uninstallMods();
  // (A mod from before, with nothing needed: its hash as it was.)
  const old = newMod({ name: 'Old' });
  const h = modHash(old);
  normalizeMod(old);
  assert.equal(modHash(old), h);
});

test('worlds made now: landforms and landmarks; worlds made before keep their land', () => {
  assert.equal(G.world.terrain.forms, null);
  const W = makeGame(4242, { wg: 7 });
  const T = W.world.terrain;
  assert.ok(T.forms);
  const p = W.player;
  let forms = 0;
  for (let z = p.z - 900; z < p.z + 900; z += 12) for (let x = p.x - 900; x < p.x + 900; x += 12) if (T.column(x, z, T.context(x, z, x, z), {}).form) forms++;
  assert.ok(forms > 0);
  assert.ok(landmarksIn(W.world.ow, p.x - 5000, p.z - 4000, p.x + 5000, p.z + 4000).length > 0);
});

test('version 0.79.0, with its step', () => {
  assert.ok(compareVersions(GAME_VERSION, '0.79.0') >= 0);
  assert.ok(stepsFor('0.78.0').some((s) => s.to === '0.79.0'));
});
