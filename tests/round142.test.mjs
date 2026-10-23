// Round 142: weapon specials strike in true shapes (a strip, a slice of a
// circle, a circle, at exactly the angle aimed), their warnings drawn as
// those shapes; more to a town's past (how it began, its luck, named
// townsfolk, one thing leading to another); folk who hold something
// against you short with you, or not speaking to you at all; the world
// map's Civilization tab (a town's plan, of the parts you've walked);
// and the three new openings played slower.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { makeGame, stubInput, stubRenderer, stubUI } from './helpers.mjs';
import { Game } from '../src/game/game.js';
import { Creature } from '../src/entities/creature.js';
import { SPECIAL_KEYS, specialShapes, shapesOn, shapeTiles, doSpecial, specialTick, heading } from '../src/game/specials.js';
import { ageOf } from '../src/sim/history.js';
import { FOUNDINGS, TOWN_EVENTS, LEGENDS } from '../src/sim/pasts.js';
import { topicsFor, openingLine } from '../src/game/dialogue.js';
import { regardOf, allowedBy } from '../src/game/social.js';
import { planOf, planWire, planFromWire, noteNear, seenOf, knownPlaces, NEAR } from '../src/game/townmap.js';
import { MapWindow } from '../src/ui/worldmap.js';
import { Grid } from '../src/ui/ascii.js';
import { randomHero } from '../src/game/hero.js';
import { PACE } from '../src/game/originintros.js';
import { HostNet } from '../src/net/host.js';
import { GuestNet } from '../src/net/guest.js';
import { GAME_VERSION, compareVersions } from '../src/version.js';
import { stepsFor } from '../src/game/migrate.js';

const src = (p) => fs.readFileSync(new URL(`../src/${p}`, import.meta.url), 'utf8');
const input = stubInput();
const wolf = (g, x, z, hp = 400) => {
  const p = g.player;
  const y = g.world.findStandY(x, z, p.y);
  const w = new Creature(g, 'wolf', x, y > 0 ? y : p.y, z);
  g.addCreature(w);
  w.angry = true;
  w.target = p;
  w.hp = w.maxHp = hp;
  return w;
};
const hold = (g, item) => {
  const p = g.player;
  p.inv[p.selected] = item ? { item, count: 1 } : null;
};
function town(seed = 12345) {
  const game = makeGame(seed);
  for (let i = 0; i < 30; i++) game.update(0.1, input);
  const [, a] = [...game.active][0];
  return { game, L: a.layout };
}

// ------------------------------------------------------------ the shapes
test('a special covers a shape at the angle it is aimed: one on the diagonal, or off the eight ways, is struck', () => {
  for (const k of SPECIAL_KEYS) {
    const sh = specialShapes(k, 0, 0, 0, { x: 2, z: 0 });
    assert.ok(sh.some((s) => s.t === 'box' || s.t === 'cone' || s.t === 'circle'), `${k} has a shape`);
    // (Turned to any angle, it turns with it.)
    const a = Math.PI / 4;
    const turned = specialShapes(k, 0, 0, a, { x: 2, z: 2 });
    const tiles = shapeTiles(turned).filter((t) => t.w > 0);
    assert.ok(tiles.some((t) => t.x > 0 && t.z > 0), `${k} reaches the diagonal`);
  }
  // A strip aimed between east and the diagonal takes in what's there
  // (the eight ways would have gone straight east, and missed it).
  const ang = Math.atan2(1, 3);
  assert.deepEqual(heading(Math.cos(ang), Math.sin(ang)), [1, 0]);
  assert.ok(shapesOn(specialShapes('skewer', 0, 0, ang), { x: 3, z: 1 }) > 0);
  assert.ok(shapesOn(specialShapes('skewer', 0, 0, 0), { x: 3, z: 1.6 }) === 0, 'and not what is well off to the side');
  // A cone is a slice: in front, not behind.
  assert.ok(shapesOn(specialShapes('reap', 0, 0, 0), { x: 2, z: 0 }) > 0);
  assert.ok(shapesOn(specialShapes('reap', 0, 0, 0), { x: -2, z: 0 }) === 0);
  // The quake lands harder at its heart than at its edge.
  const q = specialShapes('quake', 0, 0, 0);
  assert.ok(shapesOn(q, { x: 1, z: 0 }) > shapesOn(q, { x: 3.2, z: 0 }));
});

test('in play: a lunge aimed off the eight ways strikes the wolf it is aimed at, and the warning is drawn as shapes', () => {
  const g = makeGame(12345, { wg: 9 });
  const p = g.player;
  hold(g, 'iron_sword');
  const w = wolf(g, p.x + 3, p.z + 1);
  p.stamina = 10;
  const hits = doSpecial(g, p, { k: 'lunge', ang: Math.atan2(1, 3) });
  for (let i = 0; i < 10; i++) specialTick(g, p, 0.05);
  assert.ok(hits && hits.includes(w), 'the wolf off the line was struck');
  assert.ok(w.hp < 400);
  // (A diagonal one too, with a spear.)
  const g2 = makeGame(12345, { wg: 9 });
  const q = g2.player;
  hold(g2, 'spear');
  const w2 = wolf(g2, q.x + 2, q.z + 2);
  q.stamina = 10;
  assert.ok((doSpecial(g2, q, { k: 'skewer', ang: Math.PI / 4 }) || []).includes(w2));
  // The warning: shapes, in the pixel look (no curves, strokes or glows).
  const fx = src('render/specialfx.js');
  assert.match(fx, /specialShapes\(/);
  for (const bad of ['.arc(', '.ellipse(', '.stroke(', 'Gradient(', "'lighter'"]) assert.ok(!fx.includes(bad), bad);
  // (The aim goes to the other players with the wind-up.)
  assert.match(src('game/specials.js'), /ang: /);
});

// ------------------------------------------------------------ the past
test('towns\' pasts differ: how they began, their luck, their own folk, one thing leading to another', () => {
  const game = makeGame(12345);
  for (const s of game.world.ow.settlements) game.sim.layoutOf(s.id);
  const H = game.sim.history;
  const Ls = [...game.world.layouts.values()].filter((L) => L.econ && !L.settlement.founding && !L.settlement.haven);
  const began = new Set();
  const luck = new Set();
  const kinds = new Set();
  const now = game.day;
  for (const L of Ls) {
    const h = H.generate(L);
    // (The same town, the same past, every time it's told.)
    assert.deepEqual(H.generate(L), h);
    began.add(h.began);
    luck.add(h.fortune);
    const first = h.entries.find((e) => e.kind === 'founded');
    assert.ok(first && first.y === h.founded && first.text.includes(h.founder.split(' ')[0]), 'the founding names its founder');
    for (const e of h.entries) {
      kinds.add(e.kind);
      if (e.kind !== 'dungeon') assert.ok(e.y >= h.founded && e.y <= now + 2000, e.text);
    }
    // (Folk off to found a neighbour: before that neighbour was founded.)
    for (const e of h.entries) {
      const m = /went off with their carts to found (.+)\.$/.exec(e.text);
      if (!m) continue;
      const o = game.world.ow.settlements.find((q) => q.name === m[1]);
      assert.ok(o && h.founded < e.y, e.text);
      const L2 = game.world.layouts.get(o.id);
      const y2 = L2 && L2.econ.history ? L2.econ.history.founded : H.generate(L2 || game.sim.layoutOf(o.id)).founded;
      assert.ok(e.y < y2, `${e.text} (${e.y}, founded ${y2})`);
    }
    // (The first draw is the town's age, as the books reckon it too.)
    assert.equal(h.founded, Math.floor(game.day / 60) + 1180 - ageOf(L.settlement));
  }
  assert.ok(began.size >= 4, `${[...began]}`);
  assert.ok(luck.size >= 3, `${[...luck]}`);
  for (const k of ['build', 'good', 'bad', 'lore']) assert.ok(kinds.has(k), k);
  assert.ok(FOUNDINGS.length >= 10 && TOWN_EVENTS.length >= 40 && LEGENDS.length >= 8);
  // (No man or woman named: the townsfolk in it are "they".)
  for (const f of TOWN_EVENTS) assert.ok(!/\b(he|she|his|her)\b/.test(String(f.text)), f.id);
});

// ------------------------------------------------------------ cold shoulders
test('folk who hold something against you: wary, cold, then not speaking to you (unless you plead)', () => {
  const { game } = town();
  const n = game.npcs.find((q) => !q.dead && q.rec && q.rec.age === 'adult' && !['mayor', 'guard'].includes(q.rec.job) && !q.visit && !q.saga && q.state === 'routine');
  const sim = game.sim;
  const r = sim.repEntry(sim.repSidOf(n), n.rec.idx);
  const ids = () => topicsFor(n, game).map((t) => t.id);
  r.v = 20;
  assert.equal(regardOf(n, game).level, 0);
  assert.ok(ids().includes('chat'));
  r.v = -20;
  assert.equal(regardOf(n, game).level, 1);
  for (const id of ids()) assert.ok(!['so_secret', 'so_dream', 'so_intro', 'so_teach', 'favor', 'so_drink'].includes(id), id);
  r.v = -45;
  assert.equal(regardOf(n, game).level, 2);
  assert.ok(!ids().includes('chat') && !ids().includes('ask'), 'only what has to be said');
  assert.ok(ids().includes('gift') && ids().includes('bye'));
  r.v = -70;
  assert.equal(regardOf(n, game).level, 3);
  // They turn away; asked again there and then, they'll hear you out.
  let opened = null;
  game.ui.openDialogue = (q) => {
    opened = q;
  };
  game.ui.msgs.length = 0;
  game.talk(n);
  assert.equal(opened, null);
  assert.ok(game.ui.msgs.some((m) => /won't speak to you/.test(m.text || m)));
  game.talk(n);
  assert.equal(opened, n);
  assert.ok(openingLine(n, game).length > 0);
  for (const t of topicsFor(n, game)) assert.ok(['now', 'manners', 'bye'].includes(t.cat), t.id);
  // (Rude or threatening isn't a plea.)
  assert.ok(!allowedBy(3, { id: 'rude', cat: 'manners' }));
});

// ------------------------------------------------------------ the town's map
test('the town\'s map: the parts you walk near are kept, in the save, and sent to a player on request', () => {
  const { game, L } = town();
  const p = game.player;
  p.x = L.plaza.cx + 0.5;
  p.z = L.plaza.cz + 0.5;
  game.currentSettlement = L.settlement;
  assert.ok(noteNear(game));
  const S = seenOf(game, L.settlement.id);
  const near = Object.keys(S.b).map(Number);
  assert.ok(near.length > 0, 'something on the square');
  for (const id of near) {
    const b = L.buildings[id];
    const d = Math.hypot(Math.max(b.x0 - p.x, 0, p.x - b.x1), Math.max(b.z0 - p.z, 0, p.z - b.z1));
    assert.ok(d <= NEAR, `${b.name} is near`);
  }
  assert.ok(knownPlaces(game, L.settlement.id).length === near.length + Object.keys(S.lm).length);
  assert.ok(near.length < L.buildings.length, 'not the whole town from one spot');
  // Over the wire and back: the same ground.
  const w = planFromWire(JSON.parse(JSON.stringify(planWire(L))));
  assert.deepEqual(Array.from(w.mask), Array.from(planOf(L).mask));
  assert.equal(w.b.length, L.buildings.length);
  // Kept in the save.
  const save = JSON.parse(JSON.stringify(game.serialize()));
  const g2 = new game.constructor({ seed: game.seed, renderer: game.renderer, audio: null, ui: game.ui, save });
  const S2 = g2.townSeen[L.settlement.id];
  assert.deepEqual(Object.keys(S2.b).sort(), Object.keys(S.b).sort());
  assert.deepEqual(Array.from(S2.bits), Array.from(S.bits));
  // (A player's screen asks the host for the plan: see net/host.js.)
  assert.match(src('net/host.js'), /m\.t === 'plan'/);
  assert.match(src('net/guest.js'), /askPlan\(sid\)/);
});

test('the world map: a World tab always, a Civilization tab only while in a town', () => {
  const { game, L } = town();
  const ui = { game, input: { isDown: () => false }, mouse: { x: 0, y: 0, down: false }, mouseCell: { x: -1, y: -1 }, audio: null, msg() {}, time: 0 };
  const w = new MapWindow(ui);
  const row0 = () => {
    const g = new Grid(w.w, w.h);
    w.hits = [];
    w.draw(g, game);
    let t = '';
    for (let x = 0; x < w.w; x++) t += g.ch[x] || ' ';
    return t;
  };
  game.currentSettlement = L.settlement;
  assert.match(row0(), /WORLD/);
  assert.match(row0(), /CIVILIZATION/);
  assert.ok(w.onKey({ code: 'Digit2' }));
  assert.equal(w.tab, 'civ');
  w.update(0.05);
  row0();
  // Out of town: only the world (and back to it).
  game.currentSettlement = null;
  assert.doesNotMatch(row0(), /CIVILIZATION/);
  assert.equal(w.tab, 'world');
  assert.ok(!w.onKey({ code: 'Digit2' }) || w.tab === 'world');
});

test('a player in someone else\'s world gets a town\'s plan from the host, and fills in its map as they walk', () => {
  const game = makeGame(12345);
  game.minute = 10 * 60;
  for (let i = 0; i < 20; i++) game.update(0.1, input);
  const queue = [];
  let guestNet = null;
  const ui = () => {
    const u = stubUI();
    u.windows = [];
    u.update = () => {};
    u.find = () => null;
    u.closeAll = () => {};
    return u;
  };
  const hostNet = new HostNet(game, {
    send: (text) => {
      if (text[0] === '@') queue.push(() => guestNet.receive(text.slice(text.indexOf('|') + 1)));
    },
    profile: { id: 'h', name: 'Hosty' },
    world: { name: 'Testland' },
    makeUI: () => ui(),
  });
  let gg = null;
  guestNet = new GuestNet({
    send: (text) => queue.push(() => hostNet.receive(`@7|${text}`)),
    profile: { id: 'g', name: 'Guesty' },
    build: (save) => (gg = new Game({ seed: save.seed, renderer: stubRenderer(), audio: null, ui: ui(), save, remote: true })),
    onNeedHero: () => guestNet.sendHero(null),
    onEnd: () => {},
  });
  const flush = () => {
    while (queue.length) queue.shift()();
  };
  hostNet.receive('!' + JSON.stringify({ t: 'join', cid: 7, account: { id: 'g', name: 'Guesty' } }));
  flush();
  const gin = stubInput();
  for (let i = 0; i < 10; i++) {
    game.update(0.05, input);
    flush();
    if (gg) gg.update(0.05, gin);
    flush();
  }
  assert.ok(gg && gg.remote, 'joined');
  const s = game.currentSettlement || [...game.active.values()][0].layout.settlement;
  const L = game.world.layouts.get(s.id);
  // (No town laid out on the player's screen: it asks.)
  assert.equal(gg.world.layouts.get(s.id), undefined);
  gg.currentSettlement = gg.world.ow.settlements[s.id];
  gg.player.x = L.plaza.cx + 0.5;
  gg.player.z = L.plaza.cz + 0.5;
  assert.equal(noteNear(gg), false, 'nothing to go on yet');
  flush();
  flush();
  assert.ok(gg.townPlans && gg.townPlans[s.id], 'the host sent the plan');
  assert.ok(noteNear(gg));
  assert.ok(knownPlaces(gg, s.id).length > 0);
});

// ------------------------------------------------------------ the openings
test('the leader\'s, the brigand\'s and the outworlder\'s openings play slower, to be read', () => {
  assert.ok(PACE > 0.4 && PACE < 0.8);
  for (const origin of ['leader', 'brigand', 'outworlder']) {
    const extra = origin === 'leader' ? { lead: { scope: 'town', style: 'council' } } : origin === 'outworlder' ? { mutations: ['glow'] } : {};
    const game = new Game({ seed: 12345, renderer: stubRenderer(), audio: null, ui: stubUI(), hero: { ...randomHero(12345), name: 'Anwen', origin, ...extra }, intro: true });
    const sc = game.scene;
    assert.ok(sc && sc.intro && sc.pace === PACE, origin);
    const t0 = sc.t;
    game.sceneTick(1, []);
    assert.ok(Math.abs(sc.t - t0 - PACE) < 1e-9, `${origin}: a second of the clock, ${PACE} of the scene`);
  }
});

test('version 1.42.0', () => {
  assert.ok(compareVersions('1.42.0', GAME_VERSION) <= 0);
  assert.ok(stepsFor('1.41.0').some((q) => q.to === '1.42.0'));
});
