// Round 145: hosts raised by those who rule a realm or govern a town (their
// soldiers, their commander, their orders: give battle, besiege, clear an
// outpost, hold, come home); outposts put up near the front (watchtowers
// and stockades) that stop what passes them and fight it there; every
// soldier someone from a town, small realms calling up nearly everyone
// (not all of them armed), some slipping away rather than march; the
// watch kept off the roofs; and no drawing back of the view in a battle.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { makeGame, stubInput } from './helpers.mjs';
import { RNG } from '../src/util/rng.js';
import { raiseHost, orderHost, hostSize, hostRecs, candidates, setCommander, leaderOf, available, hostById, hostLine, HOST_MIN } from '../src/sim/hosts.js';
import { buildOutpost, garrisonRecs, outpostWatch, outpostLine, OUTPOST_KINDS } from '../src/sim/outposts.js';
import { WarTableWindow } from '../src/ui/command.js';
import { Grid } from '../src/ui/ascii.js';
import { findPath, onRoof, ROOFS } from '../src/entities/pathfind.js';
import { SETTING_ROWS, DEFAULTS } from '../src/game/settings.js';
import { GAME_VERSION, compareVersions } from '../src/version.js';
import { stepsFor } from '../src/game/migrate.js';
import { runCommand } from '../src/game/commands.js';
import { GROUND } from '../src/config.js';

const input = stubInput();
const src = (f) => fs.readFileSync(new URL(`../src/${f}`, import.meta.url), 'utf8');

// Every town laid out; the player crowned over the realm with the most
// towns, at war with the nearest town of another (the player far off).
function ruling(seed = 12345) {
  const game = makeGame(seed, { learned: true });
  game.minute = 600;
  for (let i = 0; i < 20; i++) game.update(0.1, input);
  for (const s of game.world.ow.settlements) game.sim.layoutOf(s.id);
  const W = game.sim.war;
  const p = game.player;
  const civ = game.world.ow.civs.filter((c) => game.sim.realms.members(c).length).sort((x, y) => game.sim.realms.members(y).length - game.sim.realms.members(x).length)[0];
  runCommand(game, `crown ${civ.name.replace(/^The /, '')}`);
  const cap = game.sim.realms.capitalOf(civ);
  const foeTown = game.world.ow.settlements.filter((s) => s.civ && s.civ !== civ && game.sim.layoutOf(s.id)?.econ).sort((a, b) => Math.hypot(a.cx - cap.cx, a.cz - cap.cz) - Math.hypot(b.cx - cap.cx, b.cz - cap.cz))[0];
  game.sim.realms.shift(civ, foeTown.civ, -100, game.day);
  const w = W.declare(civ, foeTown.civ, { k: 'land', text: 'land' }, game.day, new RNG(2));
  w.next = 9999;
  p.teleport(0, 80, 0);
  return { game, W, w, p, civ, cap, foeTown };
}

const text = (win, gr) => {
  let t = '';
  for (let y = 0; y < win.h; y++) {
    for (let x = 0; x < win.w; x++) t += gr.ch[y * win.w + x] || ' ';
    t += '\n';
  }
  return t;
};

test('a ruler raises a host from their own people, names its commander, and sends it to give battle', () => {
  const { game, W, w, p, civ, cap, foeTown } = ruling();
  const lead = leaderOf(W, p);
  assert.equal(lead.rank, 'ruler');
  assert.equal(lead.civ, civ);
  const L = game.world.layouts.get(cap.id);
  const A = available(W, L);
  assert.ok(A.guards.length + A.levy.length >= HOST_MIN);
  const h = raiseHost(W, p, cap.id, 10);
  assert.ok(h && h.id !== undefined, h.why);
  const recs = hostRecs(W, h);
  assert.equal(recs.length, hostSize(W, h));
  assert.ok(recs.length >= HOST_MIN && recs.length <= 10);
  // (Its soldiers are the town's own: named, of the capital, and with it.)
  for (const { r, L: HL } of recs) {
    assert.equal(HL, L);
    assert.ok(L.npcs.includes(r));
    assert.equal(r.host, h.id);
  }
  assert.equal(h.cmd && h.cmd.kind, 'npc', 'the best of its own commands it at first');
  // You take command yourself.
  const me = candidates(W, h).find((c) => c.kind === 'player');
  assert.ok(me);
  assert.ok(setCommander(W, p, h.id, me).ok);
  assert.equal(h.cmd.kind, 'player');
  // Orders: not a town of yours, then the enemy's.
  assert.equal(orderHost(W, p, h.id, 'attack', cap.id).ok, false);
  assert.ok(orderHost(W, p, h.id, 'attack', foeTown.id).ok);
  assert.equal(h.order.kind, 'attack');
  assert.ok(h.leg && h.leg.arr > game.sim.abs);
  assert.match(hostLine(W, h).doing, /mustering|attack/);
  // Mustered, it marches; at the town it offers battle, and a battle is
  // fought (off where you aren't).
  const n0 = w.battles.length;
  for (let t = 0; t < 60 * 24 && W.hosts.includes(h) && w.battles.length === n0; t++) game.update(1, input);
  assert.ok(w.battles.length > n0, 'a battle was fought');
  assert.ok(h.log.some((q) => /offers battle/.test(q.text)), h.log.map((q) => q.text).join(' / '));
  // (Those taken in it stay taken: a soldier home again is no prisoner
  // set free.)
  for (const q of W.prisoners) assert.ok(W.recOfPrisoner(q)?.captive, `${q.name} still held`);
  for (const { r } of hostRecs(W, h)) assert.equal(r.soldier, `h${h.id}`, 'still with the host');
  // Saved and loaded: the host is still there (or home and stood down).
  const g2 = makeGame(12345, { learned: true });
  g2.sim.war.load(JSON.parse(JSON.stringify(W.serialize())));
  assert.equal(g2.sim.war.hosts.length, W.hosts.length);
  if (W.hosts.length) assert.equal(hostById(g2.sim.war, h.id).name, h.name);
});

test('outposts: built near the front, manned by the town\'s own, and they stop what passes', () => {
  const { game, W, w, civ, cap, foeTown } = ruling();
  const FL = game.world.layouts.get(foeTown.id);
  FL.econ.treasury += 300;
  const O = buildOutpost(W, w, foeTown, cap, 'stockade', 'ai', new RNG(5));
  assert.ok(O && O.id !== undefined, O.why);
  assert.equal(O.state, 'building');
  assert.ok(OUTPOST_KINDS.stockade.gar >= 3);
  O.ready = game.sim.abs - 1;
  O.state = 'manned';
  const gar = garrisonRecs(W, O);
  assert.ok(gar.length >= 3);
  for (const { r } of gar) {
    assert.equal(r.outpost, O.id);
    assert.ok(FL.npcs.includes(r), 'the garrison is of the town that built it');
  }
  assert.match(outpostLine(W, O).state || '', /holding it/);
  // An army of ours marching past within sight of it: met there.
  const plan = { at: game.sim.abs + 600, site: { x: O.x, z: O.z }, biome: 'plains', river: false, name: 'x', attacker: w.a.includes(civ.id) ? 'a' : 'b', atk: cap.id, def: foeTown.id, ca: w.lead.a, cb: w.lead.b, passed: [] };
  w.plan = plan;
  const mover = { kind: 'army', w, plan, civ: civ.id, side: plan.attacker, at: { x: O.x + 3, z: O.z }, from: cap.id, passed: plan.passed };
  assert.ok(outpostWatch(W, w, mover));
  assert.ok(mover.passed.includes(O.id), 'met once, not again');
  assert.equal(outpostWatch(W, w, mover), false);
  assert.ok(O.fights >= 1 || O.log.length >= 2, 'fought there');
  assert.ok(W.markers().some((m) => m.kind === 'outpost' && m.id === O.id) || ['burned', 'empty'].includes(O.state));
});

test('the war table: the hosts, raising one, the outposts', () => {
  const { game, W, p, cap } = ruling();
  raiseHost(W, p, cap.id, 6);
  const ui = { game, input: { isDown: () => false }, mouse: { x: 0, y: 0 }, mouseCell: { x: -1, y: -1 }, audio: null, msg() {}, time: 0 };
  const win = new WarTableWindow(ui);
  win.goPage('hosts');
  let gr = new Grid(win.w, win.h);
  win.draw(gr, game);
  let t = text(win, gr);
  for (const s of ['HOSTS OF', 'Host of']) assert.ok(t.includes(s), s);
  win.raising = { sid: cap.id, n: 12 };
  gr = new Grid(win.w, win.h);
  win.draw(gr, game);
  t = text(win, gr);
  for (const s of ['Muster at:', 'Can spare', 'How many', 'armoury']) assert.ok(t.includes(s), s);
  win.goPage('outposts');
  gr = new Grid(win.w, win.h);
  win.draw(gr, game);
  assert.ok(text(win, gr).length > 0);
});

test('every soldier is someone from a town: none made up, towns not laid out send no one', () => {
  const { game, W, w, civ, cap, foeTown } = ruling();
  const side = w.a.includes(civ.id) ? 'a' : 'b';
  const plan = { at: game.sim.abs, site: { x: 0, z: 0 }, attacker: side, atk: cap.id, def: foeTown.id, ca: w.lead.a, cb: w.lead.b, name: 'x' };
  for (const sd of ['a', 'b']) {
    const P = W.pool(w, sd, plan);
    assert.equal(P.extra, 0, 'no soldiers without a name');
    for (const q of P.recs) assert.ok(q.L.npcs.includes(q.r) && q.L.settlement.civ && w[sd].includes(q.L.settlement.civ.id), 'each one of a town of the side');
  }
  // A town not yet laid out: queued to be, and sends no one meanwhile.
  game.instantWork = false;
  const s = game.world.ow.settlements.find((q) => q.civ === civ && q.id !== cap.id);
  if (s) {
    const L = game.world.layouts.get(s.id);
    game.world.layouts.delete(s.id);
    assert.equal(W.townFor(s, false), null);
    assert.ok((game.sim.layQueue || []).includes(s), 'queued to be laid out');
    game.world.layouts.set(s.id, L);
  }
  game.instantWork = true;
  assert.ok(!/out\.extra \+= Math\.round\(\(\{ city: 8/.test(src('sim/war.js')), 'the old made-up soldiers are gone');
});

test('a small realm calls up nearly everyone, not all of them armed; some slip away to another realm', () => {
  const game = makeGame(12345, { learned: true });
  game.minute = 600;
  for (let i = 0; i < 20; i++) game.update(0.1, input);
  for (const s of game.world.ow.settlements) game.sim.layoutOf(s.id);
  const W = game.sim.war;
  const pop = (c) => W.realms.members(c).reduce((n, s) => n + W.realms.popOf(s), 0);
  const civs = [...new Set(game.world.ow.settlements.filter((s) => s.civ && W.realms.members(s.civ).length).map((s) => s.civ))].sort((a, b) => pop(a) - pop(b));
  const small = civs[0];
  const big = civs[civs.length - 1];
  assert.ok(pop(small) * 2 < pop(big), `${pop(small)} against ${pop(big)}`);
  game.sim.realms.shift(small, big, -100, game.day);
  const w = W.declare(big, small, { k: 'land', text: 'land' }, game.day, new RNG(2));
  const ss = w.a.includes(small.id) ? 'a' : 'b';
  const bs = ss === 'a' ? 'b' : 'a';
  const D = W.draftRate(w, ss);
  assert.ok(D >= 0.75 && D <= 1, `${D}`);
  assert.equal(W.draftRate(w, bs), 0, 'the big realm drafts as usual');
  const sT = W.realms.members(small)[0];
  const bT = W.realms.members(big).sort((p, q) => Math.hypot(p.cx - sT.cx, p.cz - sT.cz) - Math.hypot(q.cx - sT.cx, q.cz - sT.cz))[0];
  const plan = { atk: bT.id, def: sT.id, attacker: bs, ca: w.lead.a, cb: w.lead.b, at: game.sim.abs + 30, site: { x: 0, z: 0 }, name: 'the Battle of Test Field' };
  const P = W.pool(w, ss, plan);
  // Three in four and more of those near who can stand (the old too).
  const L = game.world.layouts.get(sT.id);
  const fit = L.npcs.filter((r) => r.alive !== false && !r.away && !r.migrated && !r.visitor && (r.age === 'adult' || r.age === 'elder') && !['mayor', 'noble', 'priest'].includes(r.job) && r.ruler === undefined && r.councillor === undefined);
  const went = P.recs.filter((q) => q.L === L).length;
  assert.ok(went >= Math.floor(fit.length * 0.7), `${went} of ${fit.length}`);
  assert.ok(P.recs.some((q) => q.r.age === 'elder'), 'the old called up too');
  assert.ok(!P.recs.some((q) => q.r.age === 'child'), 'never the children');
  // More than the armoury holds: the rest with their tools.
  const poor = P.recs.filter((q) => q.kit === 'poor');
  assert.ok(poor.length > 0 && poor.every((q) => q.r.job !== 'guard'));
  assert.ok(W.armyPower(P, ss, w) < W.armyPower({ ...P, recs: P.recs.map((q) => ({ ...q, kit: null })) }, ss, w), 'worth less ill-armed');
  assert.equal(W.pool(w, bs, plan).recs.filter((q) => q.kit === 'poor').length, 0, 'the big realm\'s levy all armed');
  // Some never come: off to a town of another realm, or lying low.
  const before = P.recs.length;
  const n = W.dodge(w, plan, P, ss);
  assert.ok(n > 0, 'some slip away');
  assert.equal(P.recs.length, before - n);
  const gone = L.npcs.filter((r) => r.migrated);
  for (const r of gone) {
    const T = game.world.ow.settlements[+r.migrated.slice(1)];
    assert.ok(T && T.civ && T.civ !== small, `${r.name.first} went to ${T && T.name}, of another realm`);
  }
  const ledger = game.world.ow.settlements.filter((s) => s.civ === small).flatMap((s) => game.world.layouts.get(s.id).econ.ledger || []).map((e) => e.text || e).join('\n');
  assert.match(ledger, /calls up everyone who can hold a weapon/);
  assert.match(ledger, /slipped away rather than march|hid rather than answer the call/);
  // A host raised in the small realm may take nearly everyone too.
  const A = available(W, L);
  assert.ok(A.rate >= 0.75);
  // On the field: no helmet, and the tools of their trade.
  const q = poor.find((x) => !x.r.migrated && !x.r.ent);
  if (q) {
    const e = W.spawn(q.r, q.L, q.L.plaza.cx, q.L.plaza.cz, ss, 'battle', { war: w.id, role: 'centre', levy: true, kit: 'poor', home: { x: 0, z: 0 }, form: { x: 0, z: 0 }, phase: 'form' });
    if (e) {
      assert.notEqual(e.look.hat, 'helmet');
      assert.ok(['hoe', 'wood_axe', 'hammer', 'stone_pickaxe', 'wooden_spear', 'dagger', 'club'].includes(e.weapon()), e.weapon());
      game.despawnNpc(e);
    }
  }
});

test('the watch and soldiers kept off the roofs', () => {
  const game = makeGame(12345, { learned: true });
  game.minute = 600;
  for (let i = 0; i < 20; i++) game.update(0.1, input);
  const [, a0] = [...game.active][0];
  const L = a0.layout;
  const w = game.world;
  assert.ok(ROOFS.size > 5);
  // A house, and its roof.
  let roof = null;
  for (const b of L.buildings) {
    if (!b.residential) continue;
    const cx = Math.round((b.x0 + b.x1) / 2);
    const cz = Math.round((b.z0 + b.z1) / 2);
    const y = w.findStandY(cx, cz, null);
    if (y > GROUND + 2 && onRoof(w, cx, y, cz) && onRoof(w, cx + 1, w.findStandY(cx + 1, cz, null), cz)) {
      roof = { b, x: cx, y, z: cz };
      break;
    }
  }
  assert.ok(roof, 'a roofed house');
  // The way along the roof is no way, unless they're asked to take it.
  const y2 = w.findStandY(roof.x + 1, roof.z, null);
  const over = findPath(w, roof.x, roof.y, roof.z, roof.x + 1, y2, roof.z, {});
  assert.ok(over && over.length, 'over the roof, if roofs are allowed');
  const not = findPath(w, roof.x - 1, w.findStandY(roof.x - 1, roof.z, null), roof.z, roof.x + 1, y2, roof.z, { roofs: false });
  assert.ok(!not || not.slice(0, -1).every(([x, y, z]) => !onRoof(w, x, y, z)), 'no step on a roof on the way');
  // Spawned for a battle over a house: on the ground beside it.
  const r = L.npcs.find((q) => q.alive !== false && q.age === 'adult' && q.job !== 'guard' && !q.away);
  const e = game.sim.war.spawn(r, L, roof.x, roof.z, 'a', 'battle', { war: 0, role: 'centre', levy: true, home: { x: 0, z: 0 }, form: { x: 0, z: 0 }, phase: 'form' });
  if (e) {
    assert.ok(!onRoof(w, e.x, e.y, e.z) && e.y <= GROUND + 1, `spawned at ${e.y}`);
    game.despawnNpc(e);
  }
  // One of the watch who's got up there anyway: down again.
  const g = a0.npcs.find((n) => !n.dead && n.rec.job === 'guard');
  if (g) {
    g.teleport(roof.x, roof.y, roof.z);
    g.path = null;
    g.roofT = 0;
    for (let i = 0; i < 40 && onRoof(w, g.x, g.y, g.z); i++) game.update(0.1, input);
    assert.ok(!onRoof(w, g.x, g.y, g.z), 'the guard stepped down');
  }
});

test('no drawing back of the view in a battle', () => {
  const game = makeGame(12345, { learned: true });
  assert.equal(game.sim.war.battleZoom, undefined);
  assert.ok(!SETTING_ROWS.some((r) => r.key === 'battleCam'));
  assert.ok(!('battleCam' in DEFAULTS));
  assert.ok(!/battleView|battleZoom/.test(src('render/renderer.js') + src('game/game.js') + src('net/guest.js') + src('net/host.js')));
});

test('version 1.45.0', () => {
  assert.ok(compareVersions('1.45.0', GAME_VERSION) <= 0);
  assert.ok(compareVersions('1.44.0', GAME_VERSION) < 0);
  const steps = stepsFor('1.44.0');
  assert.ok(steps.some((s) => s.to === '1.45.0'));
  const game = makeGame(4, { learned: true });
  delete game.sim.war.hosts;
  delete game.sim.war.outposts;
  const log = [];
  steps.find((s) => s.to === '1.45.0').game(game, log);
  assert.ok(Array.isArray(game.sim.war.hosts) && Array.isArray(game.sim.war.outposts));
  assert.match(log.join(' '), /hosts/);
});
