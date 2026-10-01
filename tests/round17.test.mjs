import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGame, stubInput, stubRenderer } from './helpers.mjs';
import { B } from '../src/world/blocks.js';
import { GROUND } from '../src/config.js';
import { Creature } from '../src/entities/creature.js';
import { recipesFor } from '../src/world/recipes.js';
import { countItem } from '../src/game/inventory.js';
import { LedgerWindow, roadLines } from '../src/ui/windows.js';
import { burn } from '../src/game/gems.js';
import { DialogueWindow } from '../src/ui/windows.js';
import { NPC } from '../src/entities/npc.js';
import { RNG } from '../src/util/rng.js';

function start(seed = 7, minute = 10 * 60) {
  const game = makeGame(seed);
  const input = stubInput();
  game.minute = minute;
  for (let i = 0; i < 20; i++) game.update(0.1, input);
  const [sid, a] = [...game.active][0];
  return { game, input, sid, a, L: a.layout, p: game.player };
}

const reload = (game) => {
  const data = JSON.parse(JSON.stringify(game.serialize()));
  return new game.constructor({ seed: data.seed, renderer: game.renderer, audio: null, ui: game.ui, save: data });
};

const tick = (game, input, n = 20, dt = 0.25) => {
  for (let i = 0; i < n; i++) game.update(dt, input);
};

// Out in open country, away from town.
function outside(game, dx = 30) {
  const p = game.player;
  const w = game.world;
  const x = p.x + dx;
  const z = p.z;
  game.loadAround(x, z, true);
  p.teleport(x, w.findStandY(x, z, 6), z);
  return { x, z, w, p };
}

const fakeUi = (game) => ({ mouseCell: null, audio: null, game, msg() {} });

// ------------------------------------------------------------ adventurers
test('an adventurer met on the road stops to listen while you talk', () => {
  const { game, input, p } = start(7);
  const { x, z, w } = outside(game);
  const L = [...game.active.values()][0].layout;
  const A = game.sim.adventurers;
  A.start();
  const adv = A.list[0];
  // (As the road brings them into being: see updateCaravans.)
  const npc = new NPC(game, A.roadRec(adv, L), L);
  npc.adventurer = adv;
  npc.caravan = { tx: x + 40, tz: z, to: 'Somewhere', from: 'Elsewhere' };
  npc.state = 'caravan';
  npc.teleport(x + 2, w.findStandY(x + 2, z, p.y), z);
  game.npcs.push(npc);
  // Walking off down the road...
  tick(game, input, 12, 0.1);
  assert.ok(npc.x > x + 2, 'on the move');
  // ...until you talk to them.
  p.teleport(npc.x - 1, npc.y, npc.z);
  new DialogueWindow(fakeUi(game), npc, game);
  assert.equal(game.talkingTo, npc);
  const at = npc.x;
  tick(game, input, 30, 0.1);
  assert.ok(Math.abs(npc.x - at) <= 1, 'stood still to listen');
});

// ------------------------------------------------------------ town horses
function townWithHorses(seed = 12345) {
  const game = makeGame(seed);
  const input = stubInput();
  const city = game.world.ow.settlements.find((s) => s.type === 'city');
  const L = game.world.getLayout(city);
  const st = game.sim.stables.of(L);
  Object.assign(st, { horses: 3, horsesOut: 0, saddled: 1 });
  const post = game.sim.stables.hitch(L);
  const p = game.player;
  p.teleport(post.x + 3, GROUND, post.z + 3);
  game.loadAround(post.x, post.z, true);
  game.updateSettlements(true);
  game.minute = 600;
  tick(game, input, 20, 0.1);
  p.teleport(post.x + 2, game.world.findStandY(post.x + 2, post.z + 2, GROUND), post.z + 2);
  tick(game, input, 12, 0.1);
  const horses = () => game.creatures.filter((c) => c.town && c.town.sid === city.id && !c.dead && !c.own);
  return { game, input, L, st, post, p, sid: city.id, horses };
}

test('a citizen can untie one of the town\'s horses, ride it, and bring it back', () => {
  const { game, input, st, post, p, sid, horses } = townWithHorses();
  assert.equal(horses().length, 3, 'three at the post');
  assert.deepEqual(horses().map((c) => c.saddled).sort(), [false, false, true], 'one saddled');
  const h0 = horses().find((c) => c.town.idx === 0);
  // Not a citizen: hands off.
  game.riding.useHorse(h0);
  assert.ok(!h0.own);
  game.sim.citizen = { sid, since: game.day, host: null, hostBed: null, home: null, taxDay: game.day, owed: 0 };
  game.riding.useHorse(h0);
  assert.ok(h0.own && h0.own.town, 'taken out');
  assert.deepEqual(st.lent, [0]);
  tick(game, input, 15, 0.1);
  assert.equal(horses().length, 2, 'its place at the post stands empty');
  assert.ok(!horses().some((c) => c.town.idx === 0));
  // Saddled already: up you get.
  p.teleport(h0.x + 1, h0.y, h0.z);
  game.riding.useHorse(h0);
  assert.equal(p.mount && p.mount.kind, 'horse');
  // Away from home, getting down keeps it.
  const far = post.x + 20;
  p.teleport(far, game.world.findStandY(far, post.z, GROUND), post.z);
  game.riding.dismount();
  assert.equal(game.riding.horses.length, 1, 'still out with you');
  // Back by the post: it goes home.
  game.riding.mountHorse(game.creatures.find((c) => c.own && !c.dead) || { own: game.riding.horses[0], x: p.x, y: p.y, z: p.z });
  p.teleport(post.x + 2, game.world.findStandY(post.x + 2, post.z + 2, GROUND), post.z + 2);
  game.riding.dismount();
  assert.equal(game.riding.horses.length, 0, 'handed back');
  assert.deepEqual(st.lent, []);
  assert.equal(st.horsesOut, 0);
  tick(game, input, 15, 0.1);
  assert.equal(horses().length, 3, 'back at the post');
});

test('the animal handler saddles the town\'s horses', () => {
  const { game, L, st, horses } = townWithHorses();
  // Someone to mind them, at work by the post.
  const n = game.npcs.find((q) => !q.dead && q.layout === L && q.rec.age === 'adult' && q.rec.job !== 'guard');
  n.rec.job = 'handler';
  const next = horses().find((c) => c.town.idx === st.saddled);
  assert.ok(next && !next.saddled);
  n.teleport(next.x + 1, next.y, next.z);
  n.tendT = 0;
  for (let i = 0; i < 40 && !next.saddled; i++) n.tendHorses(0.25);
  assert.ok(next.saddled, 'saddled up');
  assert.equal(st.saddled, 2);
  // And day by day, off-screen too.
  const rng = new RNG(3);
  for (let d = 0; d < 30 && st.saddled < st.horses; d++) game.sim.stables.daily(L, game.day + d, rng);
  assert.equal(st.saddled, st.horses, 'every horse saddled in the end');
});

test('breaking the post a horse is tied to sets it loose', () => {
  const { game, input, post, horses } = townWithHorses();
  const tied = horses().filter((c) => c.tie && c.tie.x === post.x && c.tie.z === post.z);
  assert.ok(tied.length >= 1);
  game.breakBlock(post.x, post.y, post.z, true);
  for (const c of tied) {
    assert.equal(c.tie, null, 'untied');
    assert.ok(c.loose);
  }
  // It isn't put back at the post straight away.
  tick(game, input, 20, 0.1);
  assert.ok(tied.every((c) => !c.dead), 'still wandering loose');
  assert.ok(!horses().some((c) => c !== tied[0] && c.standKey === tied[0].standKey && !c.loose), 'no copy at the post');
});

// ------------------------------------------------------------ camera
test('a new world always starts with north up; a saved one as you left it', () => {
  const r = stubRenderer();
  r.view = 2;
  const game = makeGame(7);
  game.renderer.view = 3;
  const g2 = new game.constructor({ seed: 7, renderer: r, audio: null, ui: game.ui });
  assert.equal(r.view, 0, 'north up');
  r.view = 1;
  const data = JSON.parse(JSON.stringify(g2.serialize()));
  r.view = 3;
  new game.constructor({ seed: data.seed, renderer: r, audio: null, ui: game.ui, save: data });
  assert.equal(r.view, 1, 'as it was saved');
});

// ------------------------------------------------------------ notice board
test('the notice board has a town tab and a news tab', () => {
  const { game, L } = start(7);
  const w = new LedgerWindow(fakeUi(game), game, L.settlement, L);
  assert.equal(w.tab, 'town');
  const town = w.townLines(game);
  assert.ok(town.some((l) => l.k === 'Taxes'), 'taxes on the town side');
  assert.ok(town.some((l) => l.k === 'Laws'));
  const news = w.newsLines(game);
  assert.equal(news[0].t, 'NOTICES');
  assert.ok(!news.some((l) => l.k === 'Taxes'), 'news is news');
  w.onKey({ code: 'ArrowRight' });
  assert.equal(w.tab, 'news');
  w.onKey({ code: 'Tab' });
  assert.equal(w.tab, 'town');
});

// ------------------------------------------------------------ roads
test('a road out of a city starts from one of its gateways', () => {
  const game = makeGame(12345);
  const ss = game.world.ow.settlements;
  const city = ss.find((s) => s.type === 'city');
  const L = game.world.getLayout(city);
  const other = ss.filter((s) => s !== city).sort((a, b) => Math.hypot(a.cx - city.cx, a.cz - city.cz) - Math.hypot(b.cx - city.cx, b.cz - city.cz))[0];
  const ends = L.roadEnds();
  assert.equal(ends.length, 4, 'four gateways, no corners');
  for (const e of ends) assert.ok(L.gates.some((g) => Math.abs(g.x - e.x) + Math.abs(g.z - e.z) <= 3), 'each at a gate');
  const r = game.sim.diplomacy.startRoad(city, other);
  const [x0, , z0] = r.tiles[0];
  // Just outside the wall, beside a gate.
  assert.ok(L.gates.some((g) => Math.abs(g.x - x0) + Math.abs(g.z - z0) <= 2), `starts at a gate (${x0},${z0})`);
  // On the map, a line along it once built.
  assert.equal(roadLines([r]).length, 0, 'nothing built yet');
  r.fromA = r.tiles.length;
  r.done = true;
  const lines = roadLines([r]);
  assert.equal(lines.length, 1, 'one unbroken line');
  assert.ok(lines[0].length > 3);
  assert.deepEqual(lines[0][0], [x0, z0]);
});

// ------------------------------------------------------------ leads
test('leads are made from string, and lead an animal along behind you', () => {
  const { game, input } = start(7);
  assert.ok(recipesFor('hand').some((r) => r.out === 'lead' && r.in.string === 3), 'three string makes a lead');
  const { x, z, w, p } = outside(game);
  const c = new Creature(game, 'deer', x + 2, w.findStandY(x + 2, z, p.y), z, 0);
  game.addCreature(c);
  p.inv[p.selected] = { item: 'lead', count: 2 };
  game.cursor = { entity: c };
  game.rightClick();
  assert.equal(c.leadBy, p, 'on the lead');
  assert.equal(countItem(p.inv, 'lead'), 1);
  // Walk off: it follows.
  // (Away from it: it's standing to the east of you.)
  for (let i = 0; i < 40; i++) game.update(0.05, { ...input, isDown: (k) => k === 'KeyA' || k === 'ArrowLeft', lastMoveKey: 'ArrowLeft' });
  tick(game, input, 20, 0.1);
  assert.ok(p.x < x - 3, `you moved (${p.x - x})`);
  assert.ok(Math.max(Math.abs(c.x - p.x), Math.abs(c.z - p.z)) <= 3, 'it came along');
  assert.ok(!(c.strain > 0), 'a deer doesn\'t fight it');
  // Let it go: the lead comes back.
  game.cursor = { entity: c };
  game.rightClick();
  assert.equal(c.leadBy, null);
  assert.equal(countItem(p.inv, 'lead'), 2);
});

test('a lead ties an animal to a fence post; break the post and it\'s loose', () => {
  const { game, input } = start(7);
  const { x, z, w, p } = outside(game);
  const c = new Creature(game, 'rabbit', x + 1, w.findStandY(x + 1, z, p.y), z, 0);
  game.addCreature(c);
  p.inv[p.selected] = { item: 'lead', count: 1 };
  game.cursor = { entity: c };
  game.rightClick();
  // A fence post beside you.
  const fx = x;
  const fz = z + 2;
  const fy = w.findStandY(fx, fz, p.y);
  w.setBlock(fx, fy, fz, B.fence);
  game.cursor = { block: { id: B.fence, interact: null }, x: fx, y: fy, z: fz, inReach: true, face: 'side' };
  game.rightClick();
  assert.ok(c.leadTied && c.tie && c.tie.x === fx && c.tie.z === fz, 'tied to the post');
  // Walk away: it stays.
  p.teleport(x + 8, w.findStandY(x + 8, z, p.y), z);
  tick(game, input, 30, 0.1);
  assert.ok(Math.max(Math.abs(c.x - fx), Math.abs(c.z - fz)) <= 1, 'stays at the post');
  game.breakBlock(fx, fy, fz, true);
  assert.equal(c.tie, null);
  assert.ok(!c.leadTied);
  assert.ok(game.drops.some((d) => d.item === 'lead'), 'the lead lies by the broken post');
});

test('a wolf on a lead strains against it and breaks free', () => {
  const { game, input } = start(7, 12 * 60);
  const { x, z, w, p } = outside(game);
  const c = new Creature(game, 'wolf', x + 2, w.findStandY(x + 2, z, p.y), z, 0);
  game.addCreature(c);
  p.inv[p.selected] = { item: 'lead', count: 1 };
  p.hp = p.maxHp = 1000;
  game.cursor = { entity: c };
  game.rightClick();
  assert.equal(c.leadBy, p);
  let peak = 0;
  for (let i = 0; i < 200 && c.leadBy; i++) {
    game.update(0.1, input);
    peak = Math.max(peak, c.strain || 0);
  }
  assert.ok(peak > 0.5, 'the bar filled');
  assert.equal(c.leadBy, null, 'snapped');
  assert.equal(countItem(p.inv, 'lead'), 0, 'and the lead is gone');
  assert.ok(game.ui.msgs.some((m) => /snaps its lead/.test(m)));
});

test('leads out on animals come back to your pack when you load', () => {
  const { game } = start(7);
  const { x, z, w, p } = outside(game);
  const c = new Creature(game, 'deer', x + 1, w.findStandY(x + 1, z, p.y), z, 0);
  game.addCreature(c);
  p.inv[p.selected] = { item: 'lead', count: 1 };
  game.cursor = { entity: c };
  game.rightClick();
  assert.equal(countItem(p.inv, 'lead'), 0);
  const g2 = reload(game);
  assert.equal(countItem(g2.player.inv, 'lead'), 1);
});

// ------------------------------------------------------------ roast meat
test('meat from a beast that died on fire comes out roasted', () => {
  const { game } = start(7);
  const { x, z, w, p } = outside(game);
  const c = new Creature(game, 'boar', x + 2, w.findStandY(x + 2, z, p.y), z, 0);
  game.addCreature(c);
  burn(game, c, p, 3);
  game.damage(c, 999, p);
  const meat = game.drops.filter((d) => /meat/.test(d.item)).map((d) => d.item);
  assert.ok(meat.length && meat.every((m) => m === 'cooked_meat'), `roasted: ${meat}`);
  // Not burning: raw as ever.
  const c2 = new Creature(game, 'boar', x - 2, w.findStandY(x - 2, z, p.y), z, 0);
  game.addCreature(c2);
  game.drops.length = 0;
  game.damage(c2, 999, p);
  assert.ok(game.drops.some((d) => d.item === 'raw_meat'));
});

// ------------------------------------------------------------ HUD
test('the HUD no longer lists a town\'s taxes and laws', async () => {
  const src = await import('node:fs').then((fs) => fs.readFileSync(new URL('../src/ui/ui.js', import.meta.url), 'utf8'));
  assert.ok(!/status = `Taxes/.test(src));
});
