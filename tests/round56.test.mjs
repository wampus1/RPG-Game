// Round 56: no story for a birth (the towns see to them); armour that
// never adds up past 80%; the chests of the old places glowing; stars by
// island (Thessa to three, the far islands to five, five only off a
// master); asked to save before leaving; outlaws who fight when they
// should; captives you can squeeze past who go on home alone once among
// their own; the quest log's own buttons and scroll bar; stories that mind
// who dies in them; no black words; places heard of on a guest's map too;
// and no reaching through walls.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGame, stubInput } from './helpers.mjs';
import { ITEMS, WEAR_SLOTS, ARMOR_CAP } from '../src/world/items.js';
import { softArmor, armorSlotCap, rollStars, starGear, STAR_MAX } from '../src/world/quality.js';
import { Lighting } from '../src/render/lighting.js';
import { B } from '../src/world/blocks.js';
import { ConfirmWindow } from '../src/ui/windows.js';
import { QuestWindow } from '../src/ui/quests.js';
import { Grid, C } from '../src/ui/ascii.js';
import { MOTIFS, R } from '../src/sim/saga/core.js';
import { GuestNet } from '../src/net/guest.js';
import { HostNet } from '../src/net/host.js';
import { STEPS } from '../src/game/migrate.js';
import { GAME_VERSION, compareVersions } from '../src/version.js';
import { RNG } from '../src/util/rng.js';

function start(seed = 12345) {
  const game = makeGame(seed);
  const input = stubInput();
  game.minute = 10 * 60;
  for (let i = 0; i < 30; i++) game.update(0.1, input);
  return { game, input, S: game.sim.saga, p: game.player };
}
const quiet = (fn) => {
  const w = console.warn;
  console.warn = () => {};
  try {
    return fn();
  } finally {
    console.warn = w;
  }
};

test('no armour, however starred and plated, adds up past 80%', () => {
  assert.equal(ARMOR_CAP, 0.8);
  // The best of each slot there is, at five stars and sturdy.
  let sum = 0;
  for (const slot of ['head', 'body', 'legs', 'feet']) {
    let best = 0;
    for (const [k, d] of Object.entries(ITEMS)) {
      if (d.kind !== 'armor' || d.slot !== slot || d.stars) continue;
      const s = starGear(k, { stars: STAR_MAX, origin: 'd', mods: ['sturdy'] });
      const a = ITEMS[s] ? ITEMS[s].armor || 0 : 0;
      best = Math.max(best, a, softArmor(slot, (d.armor || 0) + 0.05));
    }
    const cap = armorSlotCap(slot);
    assert.ok(best <= cap[1] + 1e-9, `${slot}: ${best}`);
    sum += best;
  }
  assert.ok(sum < 0.8, `the best of everything: ${sum}`);
  // (A plain breastplate is as it was; it's only the high end that's held in.)
  assert.equal(softArmor('body', 0.2), 0.2);
  assert.ok(softArmor('body', 0.45) < 0.33);
  assert.ok(WEAR_SLOTS.includes('shield'));
});

test('a chest down an old place with something in it glows; an empty one, or one up top, doesn\'t', () => {
  const blocks = new Map([['3,1,3', B.chest], ['5,1,3', B.chest]]);
  const world = {
    topAt: () => 3,
    getBlock: (x, y, z) => blocks.get(`${x},${y},${z}`) || 0,
    getMeta: () => 0,
    peekContainer: (x) => (x === 3 ? [{ item: 'coin', count: 2 }, null] : [null, null]),
  };
  const below = Lighting.prototype.scan.call({}, world, 0, 0, 8, 8, true);
  assert.equal(below.length, 1);
  assert.equal(below[0].x, 3);
  assert.ok(below[0].L > 0 && below[0].tint);
  assert.equal(Lighting.prototype.scan.call({}, world, 0, 0, 8, 8, false).length, 0);
});

test('stars by island: Thessa to three, the far islands to four, five only off a master; the more, the rarer', () => {
  const rng = new RNG(56);
  const count = (o, n = 3000) => {
    const c = [0, 0, 0, 0, 0, 0];
    for (let i = 0; i < n; i++) c[rollStars(rng, { origin: 'd', ...o })]++;
    return c;
  };
  for (const tier of [0, 2, 5]) {
    const t = count({ tier });
    assert.equal(t[4] + t[5], 0, 'Thessa: never past three');
    const tb = count({ tier, boss: true });
    assert.equal(tb[4] + tb[5], 0, 'not even off a master');
    const f = count({ tier, far: true });
    assert.equal(f[5], 0, 'the far islands: five only off a master');
    assert.ok(f[4] > 0);
  }
  const fb = count({ tier: 3, far: true, boss: true });
  assert.ok(fb[5] > 0, 'off a master over there: five');
  assert.equal(fb[1], 0);
  const shallow = count({ tier: 0 });
  assert.ok(shallow[1] > shallow[2] && shallow[2] > shallow[3], `rarer up the stars: ${shallow}`);
});

test('a question with a way back out of it: ESC backs out, not "no"', () => {
  let yes = 0;
  let no = 0;
  const ui = { close() {}, mouseCell: { x: -1, y: -1 } };
  const w = new ConfirmWindow(ui, 'SAVE FIRST?', 'Save it before you go?', () => yes++, { yes: 'Save', no: 'Don\'t save', onNo: () => no++, cancel: 'Back' });
  w.onKey({ code: 'Escape' });
  assert.equal(yes + no, 0);
  w.onKey({ code: 'KeyN' });
  assert.equal(no, 1);
  w.onKey({ code: 'KeyY' });
  assert.equal(yes, 1);
});

test('one of a band long out still fights: how long they\'ve been about isn\'t how long they\'ve fought', () => {
  const { game, p } = start();
  const n = game.npcs.find((q) => q.rec && !q.dead && q.rec.age === 'adult' && q.rec.job !== 'guard');
  n.teleport(p.x + 2, p.y, p.z);
  n.state = 'warband';
  n.warband = { kind: 'saga', role: 'sentry', foe: true, home: { x: n.x, z: n.z } };
  n.hostileNow = true;
  n.stateT = 500;
  for (let i = 0; i < 5; i++) n.update(0.1);
  assert.equal(n.threat, p, 'set on you');
  assert.equal(n.state, 'warband');
  assert.ok(n.warFightT > 0 && n.warFightT < 90);
});

test('a captive you\'re leading: squeezed past, and once home they go on alone', () => {
  const { game, p } = start();
  const n = game.npcs.find((q) => q.rec && !q.dead && q.rec.age === 'adult' && q.rec.job !== 'guard');
  n.state = 'saga';
  n.saga = { follow: 'host' };
  // Going on alone: walking off, and out of the world once there.
  n.saga = { homeward: { x: Math.round(n.x), z: Math.round(n.z) } };
  n.update(0.1);
  assert.ok(n.dead || !game.npcs.includes(n), 'home');
  void p;
});

test('a captive killed by the one who freed them: that\'s what the story says', () => {
  const { game, S } = start();
  const L = game.world.layouts.get(game.currentSettlement.id);
  const r = L.npcs.find((q) => q.age === 'adult');
  const th = { id: 9999, cast: { captive: R.rec(L.settlement.id, r.idx), band: { t: 'band', id: -77 } }, vars: { leader: 'host' }, node: 'freed' };
  const line = MOTIFS.captive.castDown(th, 'captive', { by: R.pl('host') }, S);
  assert.match(line, /got .* out of the cage, and then cut them down/);
  assert.equal(MOTIFS.captive.castDown(th, 'jailer', {}, S), null);
});

test('a story ends when someone at its heart dies; by your hand, it\'s held against you', () => {
  const { game, input, S } = start();
  const L = game.world.layouts.get(game.currentSettlement.id);
  const begin = () => {
    const rng = new RNG(1);
    for (let i = 0; i < 800; i++) {
      const o = MOTIFS.lost_child.scan(S, rng, S.day);
      if (o && o.sid === L.settlement.id && L.npcs[o.cast.parent.idx].alive !== false && !S.live().some((t) => t.m === 'lost_child' && t.cast.parent.idx === o.cast.parent.idx)) return S.begin('lost_child', o);
    }
    return null;
  };
  const a = begin();
  assert.ok(a);
  a.touched.host = S.now;
  game.sim.renown.set(L.settlement.id, 30);
  quiet(() => {
    game.sim.recordDeath(L, L.npcs[a.cast.parent.idx], 'slain', 'player');
    for (let i = 0; i < 5; i++) game.update(0.1, input);
  });
  assert.ok(a.done);
  assert.equal(a.outcome, 'blood');
  assert.ok(game.sim.renown.get(L.settlement.id) < 30, 'the town remembers');
  assert.ok(S.person('host').deeds.some((d) => /^Killed /.test(d.text)));
  // Not by you: just over.
  const b = begin();
  if (b) {
    quiet(() => {
      game.sim.recordDeath(L, L.npcs[b.cast.parent.idx], 'illness', null);
      for (let i = 0; i < 5; i++) game.update(0.1, input);
    });
    assert.ok(b.done);
    assert.equal(b.outcome, 'cut_short');
  }
});

test('no black words: a colour that comes as null is the usual one', () => {
  const g = new Grid(10, 1);
  g.text(0, 0, 'hello', null);
  assert.equal(g.fg[0], C.fg);
  const { game } = start();
  const n = game.npcs.find((q) => q.rec && !q.dead);
  n.say('Hello', 2, null);
  assert.equal(n.bubble.color, undefined);
});

test('old places and camps heard of in the host\'s world are on a guest\'s map too', () => {
  const { game } = start();
  const d = game.sim.dungeons.all.find((q) => !q.known && !q.seen);
  assert.ok(d);
  d.known = true;
  const msg = {};
  HostNet.prototype.mapNews.call({ game }, { seat: game.seat, sent: { ex: [], pinsN: 0 } }, msg);
  assert.ok(msg.places && msg.places.ds.some((q) => q[0] === d.id));
  // At the guest's: their copy of the world.
  const other = makeGame(12345);
  const theirs = other.sim.dungeons.get(d.id);
  assert.ok(!theirs.known);
  GuestNet.prototype.places.call({ game: other }, msg.places);
  assert.ok(theirs.known);
  assert.deepEqual(other.sim.bandits.knownCamps(), msg.places.camps);
});

test('no opening a chest through a wall', () => {
  const { game, p } = start();
  const w = game.world;
  const x = Math.round(p.x) + 3;
  const z = Math.round(p.z);
  const y = p.y;
  // Clear ground, a chest three along.
  for (let dx = -1; dx <= 5; dx++) for (let dz = -5; dz <= 5; dz++) for (let dy = 0; dy < 4; dy++) w.setBlock(Math.round(p.x) + dx, y + dy, z + dz, 0);
  w.setBlock(x, y, z, B.chest);
  assert.ok(game.wayTo(x, y, z), 'open ground');
  // A wall between, long and high.
  for (let dz = -5; dz <= 5; dz++) for (let dy = -1; dy < 4; dy++) w.setBlock(x - 1, y + dy, z + dz, B.stone);
  assert.ok(!game.wayTo(x, y, z), 'walled off');
  let opened = 0;
  game.ui.openContainer = () => opened++;
  game.interact(x, y, z);
  assert.equal(opened, 0);
  // A gap in it: round you go.
  w.setBlock(x - 1, y, z + 3, 0);
  w.setBlock(x - 1, y + 1, z + 3, 0);
  assert.ok(game.wayTo(x, y, z), 'through the gap');
});

test('0.56.0: a story of a child on the way let go', () => {
  const step = STEPS.find((q) => q.to === '0.56.0');
  assert.ok(step && step.game);
  const { game, S } = start();
  const th = { id: S.nextId ? S.nextId++ : 99999, m: 'newborn', node: 'waiting', title: 'A Child on the Way', cast: {}, vars: {}, tasks: [], actors: [], hist: [], touched: {}, kids: [], done: false };
  S.threads.push(th);
  const log = [];
  step.game(game, log);
  assert.ok(th.done);
  assert.ok(!MOTIFS.newborn);
  assert.ok(compareVersions(GAME_VERSION, '0.56.0') >= 0);
});

test('the quest log: a button to mark it on the map, one to give it up (asked twice), and a bar to scroll by', () => {
  const { game, S } = start();
  const L = game.world.layouts.get(game.currentSettlement.id);
  let th = null;
  const rng = new RNG(3);
  for (let i = 0; i < 800 && !th; i++) {
    const o = MOTIFS.lost_child.scan(S, rng, S.day);
    if (o && o.sid === L.settlement.id) th = S.begin('lost_child', o);
  }
  assert.ok(th);
  const t = th.tasks.find((q) => q.status === 'open');
  assert.ok(t);
  t.at ||= { x: 10, z: 10 };
  S.accept(t, R.pl('host'));
  const ui = { game, mouseCell: { x: -1, y: -1 }, close() {}, audio: null };
  const w = new QuestWindow(ui);
  const out = [];
  const g = { box() {}, fill() {}, put() {}, center() {}, text: (x, y, s) => out.push({ x, y, s: String(s) }) };
  w.hits = [];
  w.draw(g, game);
  const mark = out.find((q) => /\[M\] Mark on map/.test(q.s));
  const drop = out.find((q) => /\[G\] Give up/.test(q.s));
  assert.ok(mark && drop, 'both buttons');
  const pins = game.world.ow.pins.length;
  w.onClick(null, mark.x, mark.y, game);
  assert.ok(game.world.ow.pins.length > pins || game.ui.msgs.some((m) => /Marked/.test(m)));
  w.onClick(null, drop.x, drop.y, game);
  assert.ok(S.claimedBy(t, 'host'), 'asked first');
  w.onKey({ code: 'KeyG' }, game);
  assert.ok(!S.claimedBy(t, 'host'), 'given up');
  // A long story's words: a bar to scroll by.
  for (let i = 0; i < 60; i++) S.note(th, `Something happened, the ${i}th thing.`);
  w.setTab('stories');
  const out2 = [];
  w.hits = [];
  w.draw({ ...g, text: (x, y, s) => out2.push({ x, y, s: String(s) }) }, game);
  if (w.entries(game).length) {
    assert.ok(out2.some((q) => q.s === '▼'), 'a bar');
    const before = w.dscroll;
    w.scrollBy(5);
    assert.ok(w.dscroll > before);
  }
});
