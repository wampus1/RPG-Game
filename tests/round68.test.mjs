// Round 68: stories with every node the entity graphs have and many more
// of their own; the far lands lived in (shapes by the seed, their own
// ground, beasts, music, peoples, learning, empires, dungeons and bosses,
// gear); great ships (sloop, brigantine, galleon, frigate) to sail,
// fight, board, mend and sail together; the realms' fleets; and the update.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGame, stubInput } from './helpers.mjs';
import { newMod, normalizeMod } from '../src/mod/format.js';
import { NODES, CATS, makeNode } from '../src/mod/graph.js';
import { STORY_NODE_TYPES, IFS, WHERE_TOWN } from '../src/mod/storynodes.js';
import { STORY_NODE_TYPES_2 } from '../src/mod/storynodes2.js';
import { compileStory } from '../src/mod/storyrun.js';
import { installMods, uninstallMods } from '../src/mod/registry.js';
import { MOTIFS, R } from '../src/sim/saga/core.js';
import { townMid } from '../src/sim/saga/refs.js';
import { MODS } from '../src/mod/state.js';
import { shipsOf, shipById } from '../src/game/ships3d.js';

const L = (a, ap, b, bp = 'in') => ({ id: `${a.id}.${ap}>${b.id}.${bp}`, from: [a.id, ap], to: [b.id, bp] });
const graph = (nodes, links = []) => ({ nodes, links, notes: [] });
const N = (type, p = {}, id = null, v = null) => makeNode(type, 0, 0, { p, id: id || `${type}${Math.random().toString(36).slice(2, 6)}`, v: v || {} });
const quiet = (fn) => {
  const w = console.warn;
  console.warn = () => {};
  try {
    return fn();
  } finally {
    console.warn = w;
  }
};
// A story of a mod's, installed, begun in the first town with people.
function tell(nodes, links, fn, o = {}) {
  const m = newMod({ name: 'Sagas', author: 'T' });
  m.stories.s = { id: 's', name: 'S', graph: graph(nodes, links) };
  normalizeMod(m);
  quiet(() => installMods([m]));
  try {
    const game = o.game || makeGame();
    const S = game.sim.saga;
    S.start();
    const L0 = [...game.world.layouts.values()].find((q) => q.econ && q.settlement && q.npcs.filter((r) => r.age === 'adult' && r.alive !== false).length >= 4);
    const th = S.begin(`m:${m.id}:s`, { sid: L0.settlement.id, cast: { town: R.town(L0.settlement.id) } });
    return fn({ game, S, th, L0, m });
  } finally {
    uninstallMods();
  }
}

// ------------------------------------------------------------ stories
test('the story tool has a great many more beats, in groups of their own', () => {
  for (const t of STORY_NODE_TYPES_2) assert.ok(NODES[t] && NODES[t].story, t);
  assert.ok(STORY_NODE_TYPES.length + STORY_NODE_TYPES_2.length >= 55);
  for (const c of ['Story: ways', 'Story: people', 'Story: towns & realms', 'Story: players', 'Story: the sea', 'Story: values']) assert.ok(CATS.includes(c), c);
  // Every one of the entity graph's flow nodes can be in a story too.
  const usable = Object.values(NODES).filter((d) => !d.story && !d.root && !d.starts);
  assert.ok(usable.length >= 150, `${usable.length} of the entity graph's nodes`);
  for (const q of ['the third is alive', 'the story\'s ship is sunk', 'a player in it is at sea', 'an event has been sent', 'the storm wall is down']) assert.ok(IFS.includes(q), q);
  for (const q of ['a town on Velmarch', 'a town on Ostria', 'a town past the storm', 'an empire\'s capital']) assert.ok(WHERE_TOWN.includes(q), q);
});

test('ways: which way, round again, the first time, in turn, marks', () => {
  const s = N('st.start', { title: 'Ways', when: 'only when started', giver: 'someone grown', other: 'nobody' }, 's');
  const set = N('st.set', { name: 'pick', op: 'words', words: 'blue' }, 'set');
  const sw = N('st.switch', { a: 'red', b: 'blue' }, 'sw', { value: '{pick}' });
  const loop = N('st.loop', { times: 3 }, 'loop');
  const add = N('st.set', { name: 'n', op: 'add', value: 1 }, 'add');
  const once = N('st.once', {}, 'once');
  const first = N('st.set', { name: 'firsts', op: 'add', value: 1 }, 'first');
  const cyc = N('st.cycle', { ways: 3 }, 'cyc');
  const c1 = N('st.set', { name: 'c', op: 'words', words: 'one' }, 'c1');
  const mark = N('st.mark', { name: 'here' }, 'mark');
  const jump = N('st.jump', { name: 'here' }, 'jump');
  const end = N('st.end', { outcome: 'done', text: 'Done.' }, 'end');
  const bad = N('st.end', { outcome: 'bad' }, 'bad');
  tell([s, set, sw, loop, add, once, first, cyc, c1, mark, jump, end, bad], [
    L(s, 'begin', set), L(set, 'next', sw), L(sw, 'a', bad), L(sw, 'b', loop), L(sw, 'else', bad),
    L(loop, 'again', add), L(add, 'next', once), L(once, 'first', first), L(once, 'after', loop), L(first, 'next', loop),
    L(loop, 'done', cyc), L(cyc, 'w1', c1), L(cyc, 'w2', bad), L(c1, 'next', jump), L(mark, 'next', end),
  ], ({ th }) => {
    assert.equal(th.outcome, 'done');
    assert.equal(th.vars.n, 3, 'round three times');
    assert.equal(th.vars.firsts, 1, 'the first time only once');
    assert.equal(th.vars.c, 'one', 'in turn: the first way first');
  });
});

test('a story runs the entity graph\'s nodes, with its own values and people', () => {
  const s = N('st.start', { title: 'Mixed', when: 'only when started', giver: 'someone grown', other: 'someone grown' }, 's');
  const sv = N('act.setvar', { scope: 'local' }, 'sv', { name: 'gold', value: 7 });
  const seq = N('flow.seq', {}, 'seq');
  const msg = N('act.message', {}, 'msg', { text: 'Gold: {gold}' });
  const calc = N('st.calc', { name: 'gold', op: 'this × that' }, 'calc', { a: '{gold}', b: '3' });
  const mathAdd = N('math.op', { op: '+' }, 'mo', { a: 2, b: 5 });
  const calc2 = N('st.calc', { name: 'seven', op: 'this + that' }, 'calc2', { b: '0' });
  const who = N('st.who', {}, 'who');
  const c = N('st.check', { what: 'a value is', name: 'gold', op: 'is', value: '21' }, 'c');
  const end = N('st.end', { outcome: 'rich', text: '{giver} counts {gold}.' }, 'end');
  const bad = N('st.end', { outcome: 'poor' }, 'bad');
  tell([s, sv, seq, msg, calc, mathAdd, calc2, who, c, end, bad], [
    L(s, 'begin', sv), L(sv, 'then', seq), L(seq, 'a', msg), L(seq, 'b', calc), L(calc, 'next', calc2), L(mathAdd, 'out', calc2, 'a'), L(calc2, 'next', c),
    L(c, 'yes', end), L(c, 'no', bad),
  ], ({ th, game }) => {
    void game;
    assert.equal(th.vars.gold, 21, 'Set variable (local) is the story\'s own value; Work it out with it');
    assert.equal(th.vars.seven, 7, 'a maths node wired into a beat');
    assert.equal(th.outcome, 'rich');
  });
  assert.ok(NODES['flow.seq'] && NODES['math.op'], 'the nodes used');
});

test('a story flow that waits (an entity graph Wait) goes on later; one that leads nowhere ends it', () => {
  const s = N('st.start', { title: 'Later', when: 'only when started', giver: 'someone grown', other: 'nobody' }, 's');
  const wait = N('flow.delay', {}, 'wait', { secs: 1 });
  const end = N('st.end', { outcome: 'later' }, 'end');
  tell([s, wait, end], [L(s, 'begin', wait), L(wait, 'then', end)], ({ th, game }) => {
    assert.ok(!th.done, 'waiting');
    for (let i = 0; i < 30 && !th.done; i++) game.update(0.1, stubInput());
    assert.equal(th.outcome, 'later');
  });
  const s2 = N('st.start', { title: 'Nowhere', when: 'only when started', giver: 'someone grown', other: 'nobody' }, 's');
  const msg = N('act.message', {}, 'msg', { text: 'Hello' });
  tell([s2, msg], [L(s2, 'begin', msg)], ({ th }) => assert.equal(th.outcome, 'over'));
});

test('people: someone else brought in, changed, found out about; the town changed; coins; a new chapter', () => {
  const s = N('st.start', { title: 'Folk', when: 'only when started', giver: 'someone grown', other: 'nobody' }, 's');
  const cast = N('st.cast', { role: 'third', who: 'someone grown' }, 'cast');
  const learn = N('st.learn', { of: 'the third', pf: 'first name', name: 'who3' }, 'learn');
  const pers = N('st.person', { who: 'third', what: 'coins', how: 'set', value: '77' }, 'pers');
  const learn2 = N('st.learn', { of: 'the third', pf: 'coins', name: 'c3' }, 'learn2');
  const town = N('st.town', { what: 'coffers', how: 'add', value: '123' }, 'town');
  const coins = N('st.coins', { how: 'given', n: 9 }, 'coins');
  const chap = N('st.retitle', { title: 'Chapter of {third}', card: true }, 'chap');
  const keep = N('st.keep', { scope: 'the world', name: 'deeds', op: 'add' }, 'keep', { value: 2 });
  const end = N('st.end', { outcome: 'ok', text: '{third} was there.' }, 'end');
  const none = N('st.end', { outcome: 'none' }, 'none');
  tell([s, cast, learn, pers, learn2, town, coins, chap, keep, end, none], [
    L(s, 'begin', cast), L(cast, 'next', learn), L(cast, 'none', none), L(learn, 'next', pers), L(pers, 'next', learn2), L(learn2, 'next', town),
    L(town, 'next', coins), L(coins, 'next', chap), L(chap, 'next', keep), L(keep, 'next', end),
  ], ({ th, game, L0 }) => {
    const before = game.player.inv.filter(Boolean).filter((q) => q.item === 'coin').reduce((a, q) => a + q.count, 0);
    void before;
    assert.equal(th.outcome, 'ok');
    assert.ok(th.cast.third && th.cast.third.t === 'rec', 'a third in it');
    assert.ok(th.vars.who3 && th.title.includes(th.vars.who3), 'their name, in the new title');
    assert.equal(th.vars.c3, 77, 'their coins set, and found out');
    assert.ok(L0.econ.treasury >= 123, 'the town\'s coffers');
    assert.equal(game.modState.vars[`${Object.keys(game.modState.vars)[0].split(':').slice(0, -1).join(':')}:deeds`], 2, 'a world value kept');
  });
});

test('the sea: a ship comes, the story waits till she\'s sunk', () => {
  const s = N('st.start', { title: 'Sail', when: 'only when started', giver: 'someone grown', other: 'nobody' }, 's');
  const ship = N('st.ship', { type: 'sloop', side: 'at anchor, friendly', off: 'a player in it', name: 'The {giver}' }, 'ship');
  const when = N('st.when', { what: 'the story\'s ship is sunk' }, 'when');
  const end = N('st.end', { outcome: 'sunk' }, 'end');
  const no = N('st.end', { outcome: 'dry' }, 'no');
  const game = makeGame();
  // (The player by the sea.)
  const p = game.player;
  const ow = game.world.ow;
  let spot = null;
  for (let r = 4; r < 400 && !spot; r += 4) {
    for (let k = 0; k < 24 && !spot; k++) {
      const x = Math.round(p.x + Math.cos((k / 24) * Math.PI * 2) * r);
      const z = Math.round(p.z + Math.sin((k / 24) * Math.PI * 2) * r);
      const c = ow.cell(Math.floor(x / 64), Math.floor(z / 64));
      if (c && c.biome === 'ocean') spot = { x, z };
    }
  }
  assert.ok(spot, 'sea near');
  game.loadAround?.(spot.x, spot.z, true);
  p.x = spot.x;
  p.z = spot.z;
  tell([s, ship, when, end, no], [L(s, 'begin', ship), L(ship, 'next', when), L(ship, 'no', no), L(when, 'yes', end)], ({ th, game: g }) => {
    assert.ok(th.vars._ship !== undefined, `a ship came (${th.outcome})`);
    const sh = shipById(g, th.vars._ship);
    assert.ok(sh && shipsOf(g).includes(sh));
    assert.ok(!th.done, 'waiting till she\'s sunk');
    sh.sinking = 0.001;
    MOTIFS[th.m].nodes.when.hour(th, g.sim.saga);
    assert.equal(th.outcome, 'sunk');
  }, { game });
});

test('someone brought along: they follow a player in it, and are brought (back to their day after)', () => {
  const s = N('st.start', { title: 'Escort', when: 'only when started', giver: 'someone grown', other: 'someone grown' }, 's');
  const esc = N('st.escort', { who: 'other', to: 'out near the town', near: 5 }, 'esc');
  const done = N('st.end', { outcome: 'brought' }, 'done');
  const lost = N('st.end', { outcome: 'lost' }, 'lost');
  const m = newMod({ name: 'Esc', author: 'T' });
  m.stories.s = { id: 's', name: 'S', graph: graph([s, esc, done, lost], [L(s, 'begin', esc), L(esc, 'done', done), L(esc, 'lost', lost)]) };
  normalizeMod(m);
  quiet(() => installMods([m]));
  try {
    const game = makeGame();
    const p = game.player;
    const S = game.sim.saga;
    S.start();
    const Lt = [...game.world.layouts.values()].find((q) => q.econ && q.settlement && q.npcs.filter((r) => r.age === 'adult').length >= 4);
    const mid = townMid(Lt.settlement);
    p.teleport(mid.x, game.world.findStandY(mid.x, mid.z), mid.z);
    for (let i = 0; i < 40; i++) game.update(0.1, stubInput());
    const th = MODS.startStory(game, MODS.active[0], 's', { pos: { x: mid.x, z: mid.z } });
    assert.ok(th && th.node === 'esc', 'taken on');
    const rec = game.world.layouts.get(th.cast.other.sid).npcs[th.cast.other.idx];
    assert.ok(rec.ent && rec.ent.state === 'story' && rec.ent.storyOrder.follow, 'following');
    const t = th.tasks[0];
    // (Off to where they're to be brought: they keep up, the way a
    // follower does, coming after when left behind.)
    for (let k = 0; k < 600 && !th.done; k++) {
      if (k === 20) {
        game.loadAround?.(t.at.x, t.at.z, true);
        const y = game.world.findStandY(t.at.x, t.at.z);
        p.teleport(t.at.x, y > 0 ? y : p.y, t.at.z);
      }
      game.update(0.1, stubInput());
    }
    assert.equal(th.outcome, 'brought');
    assert.ok(!rec.ent || rec.ent.state !== 'story', 'back to their day');
  } finally {
    uninstallMods();
  }
});

test('compiling a story with every new beat in it', () => {
  const m = newMod({ name: 'All', author: 'T' });
  const s = N('st.start', { title: 'All', when: 'only when started' }, 's');
  const nodes = [s, ...STORY_NODE_TYPES_2.map((t, i) => N(t, {}, `n${i}`))];
  const links = [];
  for (let i = 0; i < nodes.length - 1; i++) {
    const a = nodes[i];
    const b = nodes[i + 1];
    const out = NODES[a.type].out.find((q) => q.t === 'flow');
    if (out && NODES[b.type].in.some((q) => q.id === 'in')) links.push(L(a, out.id, b));
  }
  m.stories.all = { id: 'all', name: 'All', graph: graph(nodes, links) };
  normalizeMod(m);
  const M = compileStory(m, m.stories.all);
  assert.ok(M);
  for (const n of nodes) if (NODES[n.type].in.some((q) => q.t === 'flow')) assert.ok(M.nodes[n.id], `${n.type} made a beat`);
});
