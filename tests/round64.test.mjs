// Round 64: node boxes that follow their settings, values typed into words
// and fields ({name}), the story If's new questions and beats, creatures
// told what to do (walk, follow, flee, guard, leap, temper, pace), more
// nodes, Drop item from a hand or a slot, a weapon's swing and shot, the
// Workshop's own music, and the update.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGame, stubInput } from './helpers.mjs';
import { newMod, normalizeMod } from '../src/mod/format.js';
import { NODES, makeNode, shown, lint, compile, Runner } from '../src/mod/graph.js';
import { SVC, fillText, SOUNDS } from '../src/mod/nodes.js';
import { IFS, STORY_NODE_TYPES } from '../src/mod/storynodes.js';
import { compileStory, compareValues } from '../src/mod/storyrun.js';
import { installMods, uninstallMods, MODS } from '../src/mod/registry.js';
import { modState } from '../src/mod/hooks.js';
import { doingOf } from '../src/mod/behave.js';
import { MOTIFS, R } from '../src/sim/saga/core.js';
import { fill } from '../src/sim/saga/motifs/lib.js';
import { THEMES, WORKSHOP_SONGS, Music } from '../src/game/music.js';
import { STEPS, migrateSave } from '../src/game/migrate.js';
import { GAME_VERSION, compareVersions } from '../src/version.js';

const L = (a, ap, b, bp = 'in') => ({ id: `${a.id}${ap}${b.id}${bp}`, from: [a.id, ap], to: [b.id, bp] });
const graph = (nodes, links = []) => ({ nodes, links, notes: [] });
const quiet = (fn) => {
  const w = console.warn;
  console.warn = () => {};
  try {
    return fn();
  } finally {
    console.warn = w;
  }
};
const labels = (n, list) => list.filter((p) => shown(n, p)).map((p) => p.id);

// ------------------------------------------------------------ nodes that follow their settings
test('a node\'s inputs and outputs follow how it\'s set', () => {
  const ev = makeNode('tpl.event');
  const D = NODES['tpl.event'];
  assert.ok(D.dyn);
  assert.deepEqual(labels(ev, D.in), ['chance'], 'the world starting: nothing more to say');
  ev.p.when = 'custom event';
  assert.deepEqual(labels(ev, D.in), ['custom', 'chance']);
  ev.p.when = 'near structure';
  assert.deepEqual(labels(ev, D.in), ['structure', 'radius', 'chance']);
  ev.p.when = 'at an hour';
  assert.deepEqual(labels(ev, D.in), ['hour', 'chance']);
  // A ranged weapon: its range and ammo, not its reach; it's shot, not swung.
  const wpn = makeNode('tpl.weapon');
  const W = NODES['tpl.weapon'];
  assert.ok(labels(wpn, W.in).includes('reach') && !labels(wpn, W.in).includes('ammo'));
  assert.ok(labels(wpn, W.out).includes('onSwing') && !labels(wpn, W.out).includes('onShoot'));
  wpn.p.ranged = true;
  assert.ok(!labels(wpn, W.in).includes('reach') && labels(wpn, W.in).includes('ammo'));
  assert.ok(labels(wpn, W.out).includes('onShoot') && !labels(wpn, W.out).includes('onSwing'));
  // A boss's phases.
  const boss = makeNode('tpl.boss', 0, 0, { p: { phases: '2' } });
  assert.deepEqual(labels(boss, NODES['tpl.boss'].out).filter((k) => k.startsWith('onPhase')), ['onPhase2']);
  // Drop item: new things, or from someone.
  const drop = makeNode('act.drop');
  const DR = NODES['act.drop'];
  assert.deepEqual(labels(drop, DR.in).filter((k) => k !== 'in'), ['item', 'count', 'at']);
  drop.p.from = 'an armour slot';
  assert.deepEqual(labels(drop, DR.in).filter((k) => k !== 'in'), ['who', 'at']);
  assert.ok(labels(drop, DR.props).includes('wear'));
  drop.p.from = 'a pack slot';
  assert.deepEqual(labels(drop, DR.in).filter((k) => k !== 'in'), ['who', 'slot', 'count', 'at']);
  // The story's If: only what its question needs (a rule of a function too).
  const chk = makeNode('st.check');
  const C = NODES['st.check'];
  assert.deepEqual(labels(chk, C.props), ['what', 'item', 'count']);
  chk.p.what = 'the hour is between';
  assert.deepEqual(labels(chk, C.props), ['what', 'from', 'to']);
  chk.p.what = 'a player in it came as';
  assert.deepEqual(labels(chk, C.props), ['what', 'origin']);
  chk.p.origin = 'mod';
  assert.deepEqual(labels(chk, C.props), ['what', 'origin', 'originId']);
  assert.ok(IFS.length >= 25);
  // The story's beginning: its chance only now and then.
  const st = makeNode('st.start');
  assert.ok(labels(st, NODES['st.start'].props).includes('chance'));
  st.p.when = 'when an event is sent';
  assert.ok(!labels(st, NODES['st.start'].props).includes('chance') && labels(st, NODES['st.start'].props).includes('event'));
});

test('a wire into what a node isn\'t set to use is pointed out', () => {
  const root = makeNode('tpl.event', 0, 0, { id: 'r' });
  const num = makeNode('val.number', 0, 0, { id: 'n' });
  const g = graph([root, num], [L(num, 'out', root, 'every')]);
  assert.ok(lint(g).some((q) => q.level === 'warn' && /isn't used/.test(q.text)));
  root.p.when = 'every so often';
  assert.ok(!lint(g).some((q) => /isn't used/.test(q.text)));
});

// ------------------------------------------------------------ {values} in words and fields
test('values typed into words and fields, by name or by whose', () => {
  const game = makeGame();
  const m = newMod({ name: 'Vals', author: 'T' });
  const x = { game, mod: m, self: null, player: game.player, vars: { gold: 7.256 }, locals: {} };
  SVC.setVar(x, 'world', 'times-met', 3);
  SVC.setVar(x, 'player', 'class', 'mage');
  assert.equal(fillText(x, 'Met {times-met} times, as a {class}, with {gold} gold.'), 'Met 3 times, as a mage, with 7.26 gold.');
  assert.equal(fillText(x, '{world:times-met}/{player:class}/{nothing}'), '3/mage/{nothing}');
  // A number field with a value in it: the number.
  const add = makeNode('math.op', 0, 0, { id: 'a', v: { a: '{world:times-met}', b: 2 } });
  const prog = compile(graph([add]));
  const run = new Runner(prog, {});
  assert.equal(NODES['math.op'].eval(x, add, 'out', run.api(x, add)), 5);
  // Compared: as numbers when both are, else as words.
  assert.equal(compareValues('10', 'is more than', 9), true);
  assert.equal(compareValues('', 'is less than', 1), true, 'nothing counts as 0');
  assert.equal(compareValues('Mage', 'is', 'mage'), true);
  assert.equal(compareValues('the old mill', 'has in it', 'MILL'), true);
  assert.equal(compareValues('3', 'is not', 3), false);
  // The game's own story words take names with a dash in them too.
  assert.equal(fill('{times-met} and {x}', { 'times-met': 2 }), '2 and {x}');
});

// ------------------------------------------------------------ creatures told what to do
function beastMod(extra = []) {
  const m = newMod({ name: 'Beasts', author: 'T' });
  const root = makeNode('tpl.animal', 0, 0, { id: 'root', v: { name: 'Pup', hp: 12 } });
  m.entities.pup = { id: 'pup', name: 'Pup', graph: graph([root, ...extra.flatMap((q) => q.nodes)], extra.flatMap((q) => q.links(root))) };
  normalizeMod(m);
  return m;
}

test('a creature walks where it\'s sent, and its graph goes on when it gets there', () => {
  const off = makeNode('q.offset', 0, 0, { id: 'off', v: { dx: 5, dz: 2 } });
  const me = makeNode('ctx.self', 0, 0, { id: 'me' });
  const go = makeNode('beh.goto', 0, 0, { id: 'go', v: { near: 1, secs: 30 } });
  const set = makeNode('act.setvar', 0, 0, { id: 'set', v: { name: 'there', value: 1 }, p: { scope: 'world' } });
  const m = beastMod([{ nodes: [off, me, go, set], links: (root) => [L(root, 'onSpawn', go), L(me, 'out', off, 'at'), L(off, 'out', go, 'to'), L(go, 'arrived', set)] }]);
  quiet(() => installMods([m]));
  try {
    const game = makeGame();
    const p = game.player;
    const s = game.findFreeSpot(p.x + 4, p.z, p.y);
    const c = game.spawnMonster(`m:${m.id}:pup`, s.x, s.y, s.z);
    assert.ok(c);
    const input = stubInput();
    for (let i = 0; i < 300 && !modState(game).vars[`${m.id}:there`]; i++) game.update(0.05, input);
    assert.equal(modState(game).vars[`${m.id}:there`], 1, 'arrived, and on from Arrived');
    assert.ok(Math.hypot(c.x - (s.x + 5), c.z - (s.z + 2)) <= 1.5);
    assert.equal(doingOf(c), 'its own ways', 'done: back to its own ways');
  } finally {
    uninstallMods();
  }
});

test('follow, flee, temper, pace and a leap', () => {
  const m = beastMod();
  quiet(() => installMods([m]));
  try {
    const game = makeGame();
    const p = game.player;
    const s = game.findFreeSpot(p.x + 5, p.z, p.y);
    const c = game.spawnMonster(`m:${m.id}:pup`, s.x, s.y, s.z);
    const x = { game, mod: m, self: c, player: p, vars: {}, locals: {} };
    const input = stubInput();
    SVC.order(x, c, { kind: 'follow', who: p, dist: 2 });
    for (let i = 0; i < 200; i++) game.update(0.05, input);
    assert.ok(Math.hypot(c.x - p.x, c.z - p.z) <= 2.9, 'at the player\'s side');
    assert.equal(doingOf(c), 'following');
    let safe = false;
    SVC.order(x, c, { kind: 'flee', from: p, far: 7, done: (q) => (safe = q === 'safe') });
    for (let i = 0; i < 300 && !safe; i++) game.update(0.05, input);
    assert.ok(safe && Math.hypot(c.x - p.x, c.z - p.z) >= 7);
    // Riled, then calmed.
    SVC.temper(x, c, 'hostile', 0);
    assert.equal(c.hostileNow, true);
    SVC.temper(x, c, 'calm', 0);
    assert.equal(c.hostileNow, false);
    // Twice as quick on its feet.
    const before = c.stepTime();
    SVC.pace(x, c, 2, 0);
    assert.ok(Math.abs(c.stepTime() - before / 2) < 1e-9);
    // Through the air, and down again.
    SVC.order(x, c, null);
    const to = { x: c.x + 3, y: c.y, z: c.z };
    assert.ok(SVC.leap(x, c, to, 14));
    for (let i = 0; i < 6; i++) game.update(0.05, input);
    assert.ok(c.hop > 0, 'up in the air');
    for (let i = 0; i < 30; i++) game.update(0.05, input);
    assert.equal(c.hop, 0);
    assert.equal(c.modLeap, null);
  } finally {
    uninstallMods();
  }
});

test('someone coming near a creature, and it guarding its place', () => {
  const near = makeNode('ev.near', 0, 0, { id: 'near', v: { r: 6 }, p: { which: 'players' } });
  const add = makeNode('act.addvar', 0, 0, { id: 'add', v: { name: 'met', by: 1 }, p: { scope: 'world' } });
  const m = beastMod([{ nodes: [near, add], links: () => [L(near, 'fire', add)] }]);
  quiet(() => installMods([m]));
  try {
    const game = makeGame();
    const p = game.player;
    const s = game.findFreeSpot(p.x + 3, p.z, p.y);
    const c = game.spawnMonster(`m:${m.id}:pup`, s.x, s.y, s.z);
    const input = stubInput();
    for (let i = 0; i < 40; i++) game.update(0.05, input);
    assert.equal(modState(game).vars[`${m.id}:met`], 1, 'once, as they came near');
    for (let i = 0; i < 40; i++) game.update(0.05, input);
    assert.equal(modState(game).vars[`${m.id}:met`], 1, 'not again while they stay');
    // Guarding: it goes for players who come within its reach.
    const x = { game, mod: m, self: c, player: p, vars: {}, locals: {} };
    SVC.order(x, c, { kind: 'guard', at: { x: c.x, y: c.y, z: c.z }, r: 8, which: 'players' });
    for (let i = 0; i < 20; i++) game.update(0.05, input);
    assert.equal(c.target, p);
    assert.equal(doingOf(c), 'fighting');
  } finally {
    uninstallMods();
  }
});

test('Drop item: from the main hand, the off hand, an armour slot, a slot of the pack', () => {
  const game = makeGame();
  const p = game.player;
  const m = newMod({ name: 'Drops', author: 'T' });
  const x = { game, mod: m, player: p, vars: {}, locals: {} };
  const at = { x: p.x, y: p.y, z: p.z };
  p.inv[p.selected] = { item: 'bread', count: 4 };
  assert.equal(SVC.dropFrom(x, p, { from: 'the main hand', n: 1 }, at), 'bread');
  assert.equal(p.inv[p.selected].count, 3);
  assert.equal(SVC.dropFrom(x, p, { from: 'the main hand', n: 0 }, at), 'bread', '0: the lot');
  assert.equal(p.inv[p.selected], null);
  p.equip.head = 'iron_helmet';
  assert.equal(SVC.dropFrom(x, p, { from: 'an armour slot', wear: 'head', n: 1 }, at), 'iron_helmet');
  assert.equal(p.equip.head, null);
  p.equip.shield = 'wooden_shield';
  assert.equal(SVC.dropFrom(x, p, { from: 'the off hand', n: 1 }, at), 'wooden_shield');
  assert.equal(p.equip.shield, null);
  p.inv[5] = { item: 'stick', count: 6 };
  assert.equal(SVC.dropFrom(x, p, { from: 'a pack slot', slot: 5, n: 2 }, at), 'stick');
  assert.equal(p.inv[5].count, 4);
  const empty = p.inv.findIndex((q, i) => !q && i !== p.selected);
  assert.equal(SVC.dropFrom(x, p, { from: 'a pack slot', slot: empty, n: 1 }, at), null, 'an empty slot: nothing');
  assert.ok(game.drops.filter((d) => ['bread', 'iron_helmet', 'wooden_shield', 'stick'].includes(d.item)).length >= 4, 'on the ground');
});

// ------------------------------------------------------------ stories
test('the story If\'s new questions, and the new beats', () => {
  const m = newMod({ name: 'Tales', author: 'T' });
  const N = (type, p, id) => makeNode(type, 0, 0, { p, id });
  const s = N('st.start', { title: 'Asking', when: 'only when started', where: 'any town', giver: 'someone grown', other: 'nobody' }, 's');
  const set = N('st.set', { name: 'trust', op: 'set', value: '{world:gift}' }, 'set');
  const c1 = N('st.check', { what: 'a value is', name: 'trust', op: 'is at least', value: '4' }, 'c1');
  const c2 = N('st.check', { what: 'these compare', left: '{player:class}', op: 'is', value: 'mage' }, 'c2');
  const c3 = N('st.check', { what: 'the hour is between', from: 0, to: 24 }, 'c3');
  const c4 = N('st.check', { what: 'players in it are at least', least: 1 }, 'c4');
  const take = N('st.take', { item: 'bread', count: 2 }, 'take');
  const end = N('st.end', { outcome: 'good', text: '{giver} trusts you {trust}.' }, 'end');
  const bad = N('st.end', { outcome: 'bad', text: 'No.' }, 'bad');
  m.stories.ask = { id: 'ask', name: 'Ask', graph: graph([s, set, c1, c2, c3, c4, take, end, bad], [
    L(s, 'begin', set), L(set, 'next', c1), L(c1, 'yes', c2), L(c1, 'no', bad), L(c2, 'yes', c3), L(c2, 'no', bad),
    L(c3, 'yes', c4), L(c3, 'no', bad), L(c4, 'yes', take), L(c4, 'no', bad), L(take, 'ok', end), L(take, 'no', bad),
  ]) };
  normalizeMod(m);
  assert.ok(compileStory(m, m.stories.ask));
  for (const t of ['st.say', 'st.take', 'st.rep', 'st.spawn']) assert.ok(STORY_NODE_TYPES.includes(t) && NODES[t]);
  quiet(() => installMods([m]));
  try {
    const mid = `m:${m.id}:ask`;
    const game = makeGame();
    const S = game.sim.saga;
    S.start();
    const x = { game, mod: m, player: game.player, vars: {}, locals: {} };
    SVC.setVar(x, 'world', 'gift', 5);
    SVC.setVar(x, 'player', 'class', 'mage');
    const bread = () => game.player.inv.filter(Boolean).filter((q) => q.item === 'bread').reduce((n, q) => n + q.count, 0);
    game.player.give('bread', 3);
    const had = bread();
    const L0 = [...game.world.layouts.values()].find((q) => q.econ && q.settlement);
    const th = S.begin(mid, { sid: L0.settlement.id, cast: { town: R.town(L0.settlement.id) } });
    assert.ok(th);
    assert.ok(MOTIFS[mid]);
    assert.equal(th.outcome, 'good', 'every If said yes; the bread taken');
    assert.equal(th.vars.trust, 5);
    assert.equal(bread(), had - 2);
  } finally {
    uninstallMods();
  }
});

// ------------------------------------------------------------ more of everything
test('more nodes, and every node\'s sound one the game can play', () => {
  for (const t of ['beh.goto', 'beh.follow', 'beh.flee', 'beh.wander', 'beh.patrol', 'beh.keep', 'beh.hold', 'beh.guard', 'beh.hunt', 'beh.stop', 'beh.leap', 'beh.face', 'beh.temper', 'beh.pace', 'beh.home', 'beh.join',
    'ev.near', 'ev.lowhp', 'flow.switch', 'flow.counter', 'flow.check', 'act.weather', 'act.time', 'act.fill', 'q.doing', 'q.foe', 'q.home', 'q.alive', 'q.kind', 'q.wearing', 'q.weather', 'q.roofed',
    'math.clamp', 'math.fn', 'math.text', 'math.pickword']) assert.ok(NODES[t], t);
  assert.equal(new Set(SOUNDS).size, SOUNDS.length, 'no sound twice');
  // Switch: the case it matches.
  const sw = makeNode('flow.switch', 0, 0, { id: 'sw', v: { value: 'b', a: 'a', b: 'b' } });
  const run = new Runner(compile(graph([sw])), {});
  const x = { vars: {}, locals: {} };
  assert.equal(NODES['flow.switch'].run(x, sw, run.api(x, sw)), 'b');
});

test('a world\'s weather and time, changed by a mod', () => {
  const game = makeGame();
  const m = newMod({ name: 'Sky', author: 'T' });
  const x = { game, mod: m, player: game.player, vars: {}, locals: {} };
  SVC.weather(x, 'snow', 60);
  game.update(0.1, stubInput());
  game.updateWeather(2.5);
  assert.equal(game.weather.kind, 'snow');
  SVC.setTime(x, 'set', 21.5);
  assert.equal(game.minute, 21 * 60 + 30);
  const day = game.day;
  SVC.setTime(x, 'add hours', 4);
  assert.equal(game.day, day + 1);
  assert.equal(game.minute, 90);
});

// ------------------------------------------------------------ the Workshop's music
test('the Workshop has music of its own, quieter, with new instruments', () => {
  assert.ok(WORKSHOP_SONGS.length >= 5);
  for (const [k] of WORKSHOP_SONGS) assert.ok(THEMES[k], k);
  const mu = new Music(null);
  assert.equal(typeof mu.duck, 'function');
  mu.duck(1);
});

// ------------------------------------------------------------ the update
test('a world from 0.63 comes up to 0.64', () => {
  assert.ok(compareVersions(GAME_VERSION, '0.64.0') >= 0);
  const step = STEPS.find((s) => s.to === '0.64.0');
  assert.ok(step);
  const d = { gv: '0.63.0', v: 1, mods: null, modWeather: { kind: 'rain' } };
  const r = migrateSave(d);
  assert.ok(r.log.some((l) => /creatures/.test(l)));
  assert.equal(d.modWeather, undefined);
  assert.equal(d.gv, GAME_VERSION);
});

test('MODS is left as it was', () => {
  assert.equal(MODS.active.length, 0);
});
