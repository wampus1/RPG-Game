import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGame, stubInput } from './helpers.mjs';
import { RNG } from '../src/util/rng.js';
import { alive, stockOf, DAY } from '../src/sim/econ.js';
import { Creature } from '../src/entities/creature.js';
import { BLOCKS } from '../src/world/blocks.js';
import { styleOf, beginAttack, tickAttack, heftOf, roll } from '../src/game/combat.js';
import { promote } from '../src/sim/growth.js';
import { settlementIcons } from '../src/ui/windows.js';
import { TECHS, TECH_IDS, rivalsOf, treeOf } from '../src/sim/tech.js';
import { runCommand } from '../src/game/commands.js';
import { smallTalk, STYLES } from '../src/game/markov.js';
import { wellMade } from '../src/game/talk/grammar.js';
import { talkContext } from '../src/game/dialogue.js';

function start(seed = 12345, opts = {}, minute = 10 * 60) {
  const game = makeGame(seed, opts);
  const input = stubInput();
  game.minute = minute;
  for (let i = 0; i < 20; i++) game.update(0.1, input);
  const [sid, a] = [...game.active][0];
  return { game, input, sid, a, L: a.layout, p: game.player };
}
const run = (game, input, n, dt = 0.1) => {
  for (let i = 0; i < n; i++) game.update(dt, input);
};
const people = (L) => L.npcs.filter((r) => alive(r) && !r.away && !r.migrated && !r.visitor);
const setAbs = (game, t) => {
  game.day = Math.floor(t / DAY);
  game.minute = t - game.day * DAY;
};

// A wolf that stands still and takes it.
function dummy(game, at, dx = 1, dz = 0) {
  const w = new Creature(game, 'wolf', at.x + dx, at.y, at.z + dz);
  game.addCreature(w);
  w.hp = w.maxHp = 200;
  w.S = { ...w.S, mode: 'passive' };
  w.stunT = 1e9;
  return w;
}

// A war between the realm you start in and its neighbour, with a battle
// fought on open ground west of your town, you watching from nearby.
function battleField(game, opts = {}) {
  const [, a0] = [...game.active][0];
  const L = a0.layout;
  for (const s of game.world.ow.settlements) game.sim.layoutOf(s.id);
  const W = game.sim.war;
  const home = L.settlement;
  const foeTown = game.world.ow.settlements.find((s) => s.civ && s.civ !== home.civ && game.sim.layoutOf(s.id)?.econ);
  const [a, b] = [home.civ, foeTown.civ];
  game.sim.realms.shift(a, b, -100, game.day);
  const w = W.declare(a, b, { k: 'land', text: 'the land between them' }, game.day, new RNG(2));
  const bd = home.bounds;
  const site = { x: bd.x0 - 22, z: Math.round((bd.z0 + bd.z1) / 2) };
  game.loadAround(site.x, site.z, true);
  const p = game.player;
  p.teleport(site.x + 3, game.world.findStandY(site.x + 3, site.z - 8, 6), site.z - 8);
  w.plan = { at: game.sim.abs, site, biome: 'plains', river: false, name: 'the Battle of Test Field', attacker: 'b', atk: foeTown.id, def: home.id, ca: a.id, cb: b.id };
  W.chooseTactic = opts.tactic || ((ww, side) => (side === 'a' ? 'hold' : 'line'));
  return { W, w, L, home, foeTown, a, b, site };
}

// ------------------------------------------------------------ day skips
test('skipping days sends everyone about off cleanly, and the town comes back to life after', () => {
  const { game, input, L } = start();
  game.skipDays(2);
  assert.equal(game.npcs.filter((n) => !n.dead).length, 0, 'nobody left standing frozen while the days go by');
  for (let i = 0; i < 4000 && game.skipping; i++) game.update(0.1, input);
  assert.ok(!game.skipping);
  run(game, input, 30);
  const ents = people(L).map((r) => r.ent).filter((e) => e && !e.dead);
  assert.ok(ents.length >= 3, 'the town is back');
  const at = new Map(ents.map((e) => [e, `${e.x},${e.z}`]));
  run(game, input, 150);
  const moved = ents.filter((e) => !e.dead && `${e.x},${e.z}` !== at.get(e)).length;
  assert.ok(moved >= 2, `people go about their day (${moved} of ${ents.length} moved)`);
});

test('a town grown into a city shows a city on the map, not a town', () => {
  const game = makeGame(12345);
  const input = stubInput();
  run(game, input, 5);
  const s = game.world.ow.settlements.find((q) => q.type === 'town');
  const L = game.sim.layoutOf(s.id);
  const glyphs = () => [...settlementIcons(game).values()].filter((o) => o.s === s).map((o) => o.glyph);
  assert.ok(glyphs().every((g) => /[[\]■]/.test(g)), 'a town to begin with');
  promote(game.sim, L, 'city', game.day);
  assert.equal(s.type, 'city');
  const after = glyphs();
  assert.ok(after.length >= 2, 'bigger');
  assert.ok(after.every((g) => !/[[\]■]/.test(g)), `drawn as a city (${after.join(' ')})`);
});

// ------------------------------------------------------------ combat
test('a weapon in hand swings when you click, and never digs', () => {
  const { game, p } = start();
  p.inv[p.selected] = { item: 'iron_sword', count: 1 };
  p.stamina = 10;
  // Pointing at the ground right in front of you, mouse held down.
  const x = p.x + 1;
  const z = p.z;
  const y = p.y - 1;
  const id = game.world.getBlock(x, y, z);
  game.aimAngle = () => 0;
  game.cursor = { x, y, z, block: BLOCKS[id], inReach: true, face: 'top' };
  const held = { mouse: { down: true } };
  game.handleMouse(0.05, [{ type: 'down', button: 0 }], held);
  assert.ok(p.swing || p.attackCd > 0, 'it swings');
  for (let i = 0; i < 60; i++) game.handleMouse(0.05, [], held);
  assert.equal(game.mining, null, 'no digging');
  assert.equal(game.world.getBlock(x, y, z), id, 'the ground is untouched');
  // An empty hand still digs.
  p.inv[p.selected] = null;
  game.cursor = { x, y, z, block: BLOCKS[id], inReach: true, face: 'top' };
  game.handleMouse(0.05, [{ type: 'down', button: 0 }], held);
  game.handleMouse(0.05, [], held);
  assert.ok(game.mining, 'bare hands dig');
});

test('a swing at the air still lands on a foe in front of you', () => {
  const { game, input, p } = start();
  p.inv[p.selected] = { item: 'iron_sword', count: 1 };
  run(game, input, 5);
  const w = dummy(game, p, 1, 0);
  p.attackCd = 0;
  p.commitT = 0;
  p.swing = null;
  p.stamina = 10;
  game.aimAngle = () => 0;
  assert.ok(game.swingAt());
  const hp = w.hp;
  for (let i = 0; i < 20; i++) game.update(0.05, input);
  assert.ok(w.hp < hp, 'it hits');
});

test('the dodge roll tumbles you past whoever\'s in the way, fast, with a moment to find your feet after', () => {
  const { game, input, p } = start();
  run(game, input, 5);
  let done = false;
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const clear = [1, 2, 3].every((k) => game.world.stepTarget(p.x + dx * (k - 1), p.y, p.z + dz * (k - 1), p.x + dx * k, p.z + dz * k, false) === p.y && !game.world.isWaterAt(p.x + dx * k, p.y, p.z + dz * k));
    if (!clear || [1, 2, 3].some((k) => game.occupiedBySolid(p.x + dx * k, p.y, p.z + dz * k, p))) continue;
    const w = dummy(game, p, dx, dz);
    const [x0, z0] = [p.x, p.z];
    p.stamina = 10;
    p.rollCd = 0;
    assert.ok(roll(game, p, [dx, dz]));
    const gone = Math.abs(p.x - x0) + Math.abs(p.z - z0);
    assert.ok(gone >= 2, `through and out the other side (${gone})`);
    assert.ok(!(p.x === w.x && p.z === w.z), 'not on top of them');
    assert.ok(p.moveDur <= 0.08 * gone + 0.05, `a burst of speed (${p.moveDur.toFixed(2)}s for ${gone})`);
    assert.equal(p.moveEase, 'out', 'quickest at the start');
    assert.ok(p.rollRecover > p.rollT, 'then a moment to recover');
    done = true;
    break;
  }
  assert.ok(done, 'found open ground to roll on');
});

test('guards\' strings of blows come a little slower', () => {
  const { game } = start();
  const g = game.npcs.find((n) => n.rec.job === 'guard' && !n.dead);
  if (!g) return;
  g.rec.equipment.tool = 'iron_sword';
  g.rec.equipment.shield = null;
  const v = dummy(game, g);
  g.attackCd = 0;
  const st = styleOf(g);
  assert.ok(beginAttack(game, g, v, st, { combo: 2, press: 1 }));
  const times = [];
  let hp = v.hp;
  let t = 0;
  for (let i = 0; i < 200 && g.windup; i++) {
    tickAttack(game, g, 0.02);
    t += 0.02;
    if (v.hp < hp) {
      times.push(t);
      hp = v.hp;
    }
  }
  assert.ok(times.length >= 2, `a string of blows (${times.length})`);
  const gap = times[1] - times[0];
  assert.ok(gap >= st.windup * heftOf(g) * 0.7, `room to breathe between them (${gap.toFixed(2)}s)`);
});

test('the screen shakes less', () => {
  const { game } = start();
  const wolf = dummy(game, game.player);
  game.shake = 0;
  game.damage(game.player, 4, wolf);
  assert.ok(game.shake >= 0.4 && game.shake <= 0.8, `a jolt, not an earthquake (${game.shake.toFixed(2)})`);
  for (let i = 0; i < 6; i++) game.damage(game.player, 4, wolf);
  assert.ok(game.shake <= 1.3, 'and it never piles up too far');
});

// ------------------------------------------------------------ battles
test('an army on the march is on the ground where the map shows it, walking toward the field', () => {
  const game = makeGame(12345, { learned: false });
  const input = stubInput();
  game.minute = 600;
  run(game, input, 20);
  const { W, w } = battleField(game);
  const plan = W.planBattle(w, game.day, new RNG(3));
  assert.ok(plan.depart < plan.at, 'they set out ahead of the battle');
  setAbs(game, Math.round(plan.depart + (plan.at - plan.depart) / 2));
  const m = W.marchPos(plan);
  assert.ok(m.f > 0.3 && m.f < 0.7);
  // The map marker is where the army is.
  const mark = W.markers().find((q) => q.kind === 'army');
  assert.ok(mark && Math.hypot(mark.x - m.x, mark.z - m.z) < 1, 'the map shows the head of the column');
  game.loadAround(Math.round(m.x), Math.round(m.z), true);
  const p = game.player;
  p.teleport(Math.round(m.x + 25), game.world.findStandY(Math.round(m.x + 25), Math.round(m.z), 6), Math.round(m.z));
  game.updateSettlements(true);
  W.syncMarch();
  const col = W.columns.get(w.id);
  assert.ok(col && col.ents.length >= 3, `a column of soldiers (${col ? col.ents.length : 0})`);
  for (const e of col.ents) assert.ok(Math.hypot(e.x - m.x, e.z - m.z) < 40, 'near the marker');
  run(game, input, 40, 0.25);
  const m2 = W.marchPos(plan);
  const still = col.ents.filter((e) => !e.dead && game.npcs.includes(e));
  assert.ok(still.length >= 3);
  const near = still.filter((e) => Math.hypot(e.x - m2.x, e.z - m2.z) < 30).length;
  assert.ok(near >= still.length / 2, 'keeping up with it');
});

test('battles are fought the same day they\'re called, and start once both lines are drawn up', () => {
  const game = makeGame(12345, { learned: false });
  const input = stubInput();
  game.minute = 13 * 60;
  run(game, input, 20);
  const { W, w } = battleField(game);
  const plan = W.planBattle(w, game.day, new RNG(3));
  const wait = plan.at - game.sim.abs;
  assert.ok(wait >= 170 && wait <= 6 * 60, `a few hours off, not tomorrow (${Math.round(wait)} minutes)`);
  // On the field: drawn up, then it begins.
  const f = battleField(game);
  f.W.update(0.1);
  const live = f.W.live;
  assert.ok(live && !live.go, 'drawing up');
  for (let i = 0; i < 200 && !live.go; i++) game.update(0.25, input);
  assert.ok(live.go, 'begun');
  assert.ok(live.goT <= 26, `soon (${live.goT.toFixed(1)}s)`);
});

test('nobody pops in or out of sight around a battle', () => {
  const game = makeGame(12345, { learned: false });
  const input = stubInput();
  game.minute = 600;
  run(game, input, 20);
  const { W } = battleField(game);
  const seen = new Map(game.npcs.map((n) => [n, true]));
  const popped = [];
  const check = () => {
    const now = new Set(game.npcs);
    for (const n of now) {
      if (seen.has(n)) continue;
      seen.set(n, true);
      if (game.inSight(n.x, n.z, 0)) popped.push(`in: ${n.rec?.name?.first} at ${n.x},${n.z}`);
    }
    for (const [n] of seen) {
      if (now.has(n)) continue;
      seen.delete(n);
      if (!n.dead && game.inSight(n.x, n.z, 0)) popped.push(`out: ${n.rec?.name?.first} at ${n.x},${n.z}`);
    }
  };
  W.update(0.1);
  check();
  const live = W.live;
  assert.ok(live);
  for (let i = 0; i < 1600 && W.live; i++) {
    game.update(0.25, input);
    check();
  }
  assert.ok(live.done, 'it was fought out');
  assert.deepEqual(popped, [], 'nobody appeared or vanished in view');
});

// ------------------------------------------------------------ the tree
test('choices: learning one side of a pair bars the other for good', () => {
  const game = makeGame(12345, { learned: false });
  const T = game.sim.tech;
  T.cheat = false;
  // (On the common tree, every choice is a pair; an island's may have a
  // side of its own in place of one, or none, where it never learns one.)
  const common = treeOf(null);
  const groups = {};
  for (const k of common.ids) if (TECHS[k].excl) (groups[TECHS[k].excl] ||= []).push(k);
  assert.ok(Object.keys(groups).length >= 7, 'several choices');
  for (const g of Object.values(groups)) {
    assert.equal(g.length, 2, 'each a pair');
    assert.deepEqual(rivalsOf(g[0]), [g[1]]);
  }
  for (const k of TECH_IDS) if (TECHS[k].excl) assert.ok(['tolls', 'bows', 'arms', 'coffers', 'justice', 'learning', 'harvest'].includes(TECHS[k].excl));
  // (Free trade or customs: a realm whose island has both.)
  const both = (c) => { const t = T.treeFor(T.stateOf(c)); return t.techs.free_trade && t.techs.customs; };
  const civ = game.world.ow.civs.find(both);
  const st = T.stateOf(civ);
  st.done = st.done.filter((k) => k !== 'free_trade' && k !== 'customs');
  T.learnWithPrereqs(civ, 'free_trade', game.day);
  assert.ok(st.done.includes('free_trade'));
  assert.ok(T.barred(st, 'customs'), 'customs houses are barred');
  assert.ok(!T.ready(st, 'customs'));
  assert.match(runCommand(game, `learn customs ${civ.name}`).join(' '), /barred/);
  // (Two realms that chose differently end up different.)
  const other = game.world.ow.civs.find((c) => c !== civ && both(c));
  const so = T.stateOf(other);
  so.done = so.done.filter((k) => k !== 'free_trade' && k !== 'customs');
  T.learnWithPrereqs(other, 'customs', game.day);
  assert.ok(so.done.includes('customs') && !so.done.includes('free_trade'));
});

test('every step says plainly what it does', () => {
  for (const k of TECH_IDS) {
    const t = TECHS[k];
    assert.ok(t.desc && t.desc.length <= 330, k);
    assert.ok(!t.lore, `${k}: no lore`);
  }
  const exact = TECH_IDS.filter((k) => /\d|twice|half|every|each|instead/i.test(TECHS[k].desc)).length;
  assert.ok(exact >= TECH_IDS.length * 0.8, `numbers, not flavour (${exact} of ${TECH_IDS.length})`);
  for (const k of ['trade_ships', 'rams', 'catapults', 'prison_labor', 'portals']) assert.ok(TECHS[k].big, `${k} is a great work`);
});

test('a town that changes banner keeps the work it put into the tree', () => {
  const game = makeGame(12345, { learned: false });
  const T = game.sim.tech;
  T.cheat = false;
  const ow = game.world.ow;
  for (const s of ow.settlements) game.sim.layoutOf(s.id);
  // A town (not a capital) and a step that neither its realm nor another
  // knows: the town does a fifth of the work on it.
  let s = null;
  let to = null;
  let id = null;
  for (const q of ow.settlements) {
    if (!q.civ || game.sim.realms.capitalOf(q.civ) === q || !game.sim.layoutOf(q.id)?.econ) continue;
    for (const c of ow.civs) {
      if (c === q.civ || !game.sim.realms.members(c).length) continue;
      const k = ['metalworking', 'masonry', 'bookkeeping', 'archery', 'codex', 'surveying'].find((x) => !T.stateOf(q).done.includes(x) && !T.stateOf(c).done.includes(x));
      if (k) [s, to, id] = [q, c, k];
      if (s) break;
    }
    if (s) break;
  }
  assert.ok(s && to && id, 'a town, a realm and a step to try');
  const st = T.stateOf(s);
  st.current = id;
  st.progress = 0;
  const cost = TECHS[id].cost;
  T.addPoints(s, cost * 0.2, game.day);
  assert.equal(T.contribution(s, id).pct, 20);
  // Over to the other realm.
  const before = T.progressOn(T.stateOf(to), id);
  game.sim.realms.join(s, to);
  assert.equal(s.civ, to);
  assert.ok(!T.has(s, id), 'the step is lost under the new banner');
  const after = T.progressOn(T.stateOf(to), id);
  assert.ok(Math.abs(after - before - cost * 0.2) < 1, `but its fifth of the work came too (${before} -> ${after})`);
  // Had it done the whole of it, the new realm would learn it there and then.
  const s2 = ow.settlements.find((q) => q !== s && q.civ && q.civ !== to && game.sim.realms.capitalOf(q.civ) !== q && game.sim.layoutOf(q.id)?.econ);
  if (s2 && T.ready(T.stateOf(to), id)) {
    T.contrib[s2.id] = { ...(T.contrib[s2.id] || {}), [id]: cost };
    game.sim.realms.join(s2, to);
    assert.ok(T.stateOf(to).done.includes(id), 'learned');
  }
});

test('the learn command teaches a realm a step and what it needs first', () => {
  const game = makeGame(12345, { learned: false });
  game.sim.tech.cheat = false;
  const civ = game.world.ow.civs[0];
  const out = runCommand(game, `learn trade ships ${civ.name}`).join(' ');
  assert.match(out, /Trade Ships/);
  assert.ok(game.sim.tech.stateOf(civ).done.includes('trade_ships'));
  assert.match(runCommand(game, 'learn list').join(' '), /portals/);
  assert.match(runCommand(game, `learn nonsense ${civ.name}`).join(' '), /No step/);
});

// ------------------------------------------------------------ great works
test('siege engines: catapults lob stones into the enemy and a ram breaks a walled town\'s wall', () => {
  // (Seed 8: a town with open ground west of it for the field.)
  const game = makeGame(8, { learned: false });
  const input = stubInput();
  game.minute = 600;
  run(game, input, 20);
  const T = game.sim.tech;
  T.cheat = false;
  const { W, L, b } = battleField(game);
  for (const k of ['siegecraft', 'rams', 'catapults']) T.stateOf({ civ: b, id: 0 }).done.push(k);
  if (!L.walled) {
    const plan = L.wallPlan();
    game.sim.setBlocks(plan.list);
    L.applyWall(plan.tiles, false);
    L.econ.walled = true;
  }
  const w = W.wars[W.wars.length - 1];
  assert.deepEqual(W.engines(w.plan, 'b'), { catapults: 1, ram: true });
  assert.deepEqual(W.engines(w.plan, 'a'), { catapults: 0, ram: false });
  W.update(0.1);
  const live = W.live;
  const kinds = (live.engines || []).map((e) => e.type);
  assert.ok(kinds.includes('catapult') && kinds.includes('ram'), `engines on the field (${kinds.join(', ')})`);
  assert.ok(live.engines.every((e) => e.crew.length >= 1), 'crewed');
  const ram = live.engines.find((e) => e.type === 'ram');
  let lobs = 0;
  const orig = game.lob.bind(game);
  game.lob = (...args) => {
    lobs++;
    return orig(...args);
  };
  // Under way: the ram rolls for the wall.
  for (let i = 0; i < 400 && !(live.go && lobs >= 2); i++) game.update(0.25, input);
  const d0 = Math.abs(ram.x - ram.wall.x) + Math.abs(ram.z - ram.wall.z);
  run(game, input, 20, 0.25);
  assert.ok(Math.abs(ram.x - ram.wall.x) + Math.abs(ram.z - ram.wall.z) < d0, 'the ram rolls on the wall');
  // (Most of the defenders cut down: the attackers carry the field, take
  // the town, and the ram goes on to break in.)
  live.sides.a.ents.forEach((n, i) => {
    if (i % 4 === 0 || n.dead || !n.warband) return;
    Object.assign(n, { hp: 1, down: true, sleeping: true, path: null, state: 'warband' });
    n.warband.phase = 'down';
  });
  for (let i = 0; i < 1400 && W.live && !(lobs >= 2 && L.econ.breached); i++) game.update(0.25, input);
  assert.equal(L.settlement.civ, b, 'the town taken');
  assert.ok(lobs >= 2, `stones thrown (${lobs})`);
  assert.ok(L.econ.breached, 'a breach in the wall');
  assert.equal(ram.phase, 'breached', 'knocked in by the ram, where you could see it');
  assert.ok(game.sim.works.projects.some((q) => q.kind === 'mend' && q.sid === L.settlement.id), 'and the builders will mend it');
});

test('trade ships: a harbour, a great ship, a voyage abroad with the merchants aboard, and the profit', () => {
  const game = makeGame(12345, { learned: false });
  const input = stubInput();
  run(game, input, 10);
  const T = game.sim.tech;
  T.cheat = false;
  const SH = game.sim.ships;
  let L = null;
  for (const s of game.world.ow.settlements) {
    if (!(s.coast || s.river) || !s.civ) continue;
    const q = game.sim.layoutOf(s.id);
    if (q && q.econ && SH.dockSite(q) && q.npcs.some((r) => r.job === 'merchant' && alive(r))) {
      L = q;
      break;
    }
  }
  if (!L) return;
  const s = L.settlement;
  // (Not before it's learned.)
  assert.equal(SH.daily(L, game.day, new RNG(1)), null);
  T.stateOf(s).done.push('trade_ships');
  L.econ.treasury = 1000;
  SH.daily(L, game.day, new RNG(1));
  const P = SH.port(s.id);
  assert.equal(P.state, 'building');
  const proj = game.sim.works.projects.find((q) => q.id === P.project);
  assert.ok(proj && proj.kind === 'dock', 'shipwrights at work on a pier');
  game.sim.works.finishNow(L, proj);
  SH.daily(L, game.day + 1, new RNG(2));
  assert.equal(P.state, 'docked');
  assert.match(L.econ.ledger.map((e) => e.text || e).join(' '), new RegExp(`The ${P.name} was launched`));
  P.next = game.day + 2;
  setAbs(game, (game.day + 2) * DAY + 60);
  SH.daily(L, game.day, new RNG(3));
  const v = P.voyage;
  assert.ok(v, 'she sails');
  assert.ok(v.crew.length >= 1 && v.crew.length <= 5, `merchants aboard (${v.crew.length})`);
  const t0 = L.econ.treasury;
  setAbs(game, v.back + 1);
  SH.update();
  assert.equal(P.voyage, null, 'home again');
  assert.ok(L.econ.treasury - t0 >= 60, `a big profit (¤${L.econ.treasury - t0})`);
});

test('portals: an arch on every square of the realm, linking its towns; a town taken by another realm goes dark', () => {
  const game = makeGame(12345, { learned: false });
  const input = stubInput();
  run(game, input, 10);
  game.sim.tech.cheat = false;
  const PO = game.sim.portals;
  const ow = game.world.ow;
  const civ = ow.civs.find((c) => game.sim.realms.members(c).filter((s) => game.sim.layoutOf(s.id)?.econ).length >= 2);
  assert.ok(civ);
  runCommand(game, `learn portals ${civ.name}`);
  const towns = game.sim.realms.memberLayouts(civ);
  for (const L of towns) L.econ.treasury = 1000;
  for (let d = 0; d < 3; d++) {
    for (const L of towns) {
      PO.daily(L, game.day + d);
      for (const q of game.sim.works.projects) if (!q.done && q.kind === 'portal' && q.sid === L.settlement.id) game.sim.works.finishNow(L, q);
    }
  }
  const built = towns.filter((L) => PO.of(L.settlement.id)?.built);
  assert.ok(built.length >= 2, `portals raised (${built.length})`);
  const cap = game.sim.realms.capitalOf(civ);
  const net = PO.network(cap.id).map((q) => q.sid);
  assert.ok(net.length >= 1, 'linked');
  // Taken by another realm: cut off.
  const lost = built.find((L) => L.settlement !== cap);
  const foe = ow.civs.find((c) => c !== civ && game.sim.realms.members(c).length);
  game.sim.realms.join(lost.settlement, foe);
  assert.ok(!PO.open(lost.settlement.id), 'dark');
  assert.ok(!PO.network(cap.id).some((q) => q.sid === lost.settlement.id), 'closed to its old realm');
  assert.ok(!PO.linked(cap, lost.settlement));
  // A fare for strangers, free to the realm's own.
  assert.equal(PO.fareFor(cap.id) >= 0, true);
});

test('prison labour: prisoners quarry and cut wood under spare guards, and work off their time', () => {
  const game = makeGame(12345, { learned: false });
  const input = stubInput();
  run(game, input, 10);
  game.sim.tech.cheat = false;
  const ow = game.world.ow;
  const W = game.sim.war;
  // (A realm whose capital has guards to spare.)
  // (Not on Thessa, where an old law forbids it.)
  const civ = ow.civs.find((c) => game.sim.tech.treeFor(game.sim.tech.stateOf(c)).techs.prison_labor && game.sim.realms.capitalOf(c) && game.sim.labor.spare(game.sim.layoutOf(game.sim.realms.capitalOf(c).id)).guards.length >= 2);
  const cap = game.sim.realms.capitalOf(civ);
  const L = game.sim.layoutOf(cap.id);
  const foe = ow.civs.find((c) => c !== civ && game.sim.realms.members(c).length);
  const FL = game.sim.layoutOf(game.sim.realms.members(foe)[0].id);
  for (const r of FL.npcs.filter((q) => q.job === 'guard' && q.age === 'adult' && alive(q)).slice(0, 3)) W.takePrisoner(r, FL, civ, game.day, 'a test', cap.id);
  const n = W.held(cap.id).length;
  assert.ok(n >= 2, 'prisoners in the cells');
  // (Not before the realm knows how.)
  assert.equal(game.sim.labor.daily(L, game.day, new RNG(1)), null);
  runCommand(game, `learn prison labour ${civ.name}`);
  const k0 = { ...stockOf(L) };
  const out = game.sim.labor.daily(L, game.day, new RNG(1));
  assert.ok(out && out.gang >= 1, 'out to work');
  assert.ok(out.guards >= Math.ceil(out.gang / 2), 'one guard for every two');
  assert.ok((stockOf(L).stone || 0) + (stockOf(L).wood || 0) > (k0.stone || 0) + (k0.wood || 0), 'stone and timber for the town');
  for (let d = 1; d <= 9; d++) game.sim.labor.daily(L, game.day + d, new RNG(d + 1));
  assert.ok(W.held(cap.id).length < n, 'some have worked off their captivity and gone home');
});

// ------------------------------------------------------------ talk
test('the talk corpus is well made, and has more to say', () => {
  let frames = 0;
  const scan = (o, path) => {
    for (const [k, v] of Object.entries(o)) {
      if (k === 'lexicon') continue;
      if (Array.isArray(v)) {
        for (const f of v) {
          frames++;
          assert.ok(wellMade(f), `${path}${k}: ${f}`);
        }
      } else if (v && typeof v === 'object') scan(v, `${path}${k}.`);
    }
  };
  for (const [k, v] of Object.entries(STYLES)) scan(v, `${k}.`);
  assert.ok(frames >= 400, `plenty of frames (${frames})`);
  for (const k of ['study', 'learned', 'ships', 'portal', 'prisoners', 'health', 'animals', 'stories', 'chores']) assert.ok(STYLES.base[k] && STYLES.base[k].length >= 3, k);
});

test('folk talk of what\'s new: the scholars\' work, the town\'s ship, the portal, the prisoners', () => {
  const { game, L } = start();
  const ctx = talkContext(game, L.settlement);
  assert.ok('study' in ctx && 'ship' in ctx && 'portalto' in ctx && 'prisoners' in ctx);
  const news = { ...ctx, study: 'surveying', learned: 'watermills', ship: 'Swift Gull', portalto: 'Marrow', prisoners: true };
  const folk = people(L).filter((r) => r.age === 'adult');
  const lines = [];
  for (const r of folk.slice(0, 25)) for (let i = 0; i < 12; i++) lines.push(smallTalk(r, new RNG(r.idx * 17 + i), news));
  const said = (re) => lines.filter((l) => re.test(l)).length;
  assert.ok(said(/surveying|watermills/i) >= 2, 'the scholars');
  assert.ok(said(/Swift Gull/) >= 1, 'the ship');
  assert.ok(said(/Marrow|portal/) >= 1, 'the portal');
  assert.ok(said(/prisoner/i) >= 1, 'the prisoners');
  // Without them, never.
  const plain = { ...ctx, study: null, learned: null, ship: null, portalto: null, prisoners: false };
  for (const r of folk.slice(0, 15)) for (let i = 0; i < 4; i++) assert.doesNotMatch(smallTalk(r, new RNG(r.idx * 19 + i), plain), /\{|Swift Gull|portal to/);
  for (const l of lines) assert.match(l, /[.!?]$/, l);
});
