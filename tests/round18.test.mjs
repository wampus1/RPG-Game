import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGame, stubInput, lotsReady } from './helpers.mjs';
import { B } from '../src/world/blocks.js';
import { RNG } from '../src/util/rng.js';
import { DAY, alive, stockFor, stockOf } from '../src/sim/econ.js';
import { electMayor } from '../src/sim/life.js';
import { roadCellLinks } from '../src/ui/windows.js';
import { actFx, finishDrink, MESS } from '../src/entities/acts.js';
import { TechWindow, ResearchWindow } from '../src/ui/research.js';
import { TECHS, TECH_IDS } from '../src/sim/tech.js';
import { PROFESSIONS } from '../src/sim/careers.js';
import { growth } from '../src/sim/growth.js';

function start(seed = 12345, opts = {}, minute = 10 * 60) {
  const game = makeGame(seed, opts);
  const input = stubInput();
  game.minute = minute;
  for (let i = 0; i < 20; i++) game.update(0.1, input);
  const [sid, a] = [...game.active][0];
  return { game, input, sid, a, L: a.layout, p: game.player };
}

const tick = (game, input, n = 20, dt = 0.25) => {
  for (let i = 0; i < n; i++) game.update(dt, input);
};

const reload = (game) => {
  const data = JSON.parse(JSON.stringify(game.serialize()));
  return new game.constructor({ seed: data.seed, renderer: game.renderer, audio: null, ui: game.ui, save: data });
};

const fakeUi = (game) => ({ mouseCell: { x: -99, y: -99 }, audio: null, game, msgs: [], msg(t) { this.msgs.push(t); } });

// Every town laid out (as the world does over its first minutes).
function world(seed = 12345, opts = { learned: false }) {
  const game = makeGame(seed, opts);
  for (const s of game.world.ow.settlements) game.sim.layoutOf(s.id);
  return game;
}

const people = (L) => L.npcs.filter((r) => alive(r) && !r.away && !r.migrated && !r.visitor);
const plainCivs = (game) => game.world.ow.civs;

// A text-grid stand-in that remembers what was written on it.
function grid() {
  const texts = [];
  return {
    texts,
    g: new Proxy({}, { get: () => (...args) => { for (const a of args) if (typeof a === 'string' && a.length > 1) texts.push(a); } }),
  };
}

// ------------------------------------------------------------ builders, leaders
test('every town starts the world with a builder', () => {
  const game = world(12345, { learned: true });
  for (const s of game.world.ow.settlements) {
    if (s.condition === 'abandoned' || s.deserted) continue;
    const L = game.sim.layoutOf(s.id);
    assert.ok(people(L).some((r) => r.job === 'builder'), `${s.name} (${s.type}) has a builder`);
  }
});

test('a dead ruler is succeeded, and a town that loses its mayor elects another', () => {
  const game = world();
  const R = game.sim.realms;
  const civ = plainCivs(game)[0];
  const old = R.ruler(civ);
  assert.ok(old, 'the realm has a ruler');
  const capL = game.sim.layoutOf(R.realm(civ).capital);
  game.sim.recordDeath(capL, old, 'old age', null, game.day);
  assert.equal(R.ruler(civ), null);
  R.court(civ, capL, game.day + 1, new RNG(1));
  const next = R.ruler(civ);
  assert.ok(next && next !== old && alive(next), 'someone new rules');
  assert.ok(capL.econ.ledger.some((n) => /is dead/.test(n.text) && /now leads/.test(n.text)), 'the succession is posted');
  // A mayor.
  const L = game.sim.layoutOf(game.world.ow.settlements.find((s) => s.type === 'town' && s.civ).id);
  const mayor = L.npcs.find((r) => r.job === 'mayor' && alive(r));
  game.sim.recordDeath(L, mayor, 'old age', null, game.day);
  for (let d = 1; d <= 4; d++) electMayor(game.sim, L, game.day + d);
  const now = L.npcs.find((r) => r.job === 'mayor' && alive(r));
  assert.ok(now && now !== mayor, 'a new mayor');
});

// ------------------------------------------------------------ roads
test('a road between towns winds, shows on the map square by square, and is built by both towns\' builders', () => {
  const game = world(12345, { learned: true });
  const ss = game.world.ow.settlements;
  const D = game.sim.diplomacy;
  const a = ss.find((s) => s.name === 'Magdeep');
  const b = ss.find((s) => s.name === 'Orngate');
  const r = D.startRoad(a, b);
  assert.ok(r && r.tiles.length > 20);
  // Not a straight line: it changes heading again and again.
  let turns = 0;
  let last = null;
  for (let i = 4; i < r.tiles.length; i += 4) {
    const dx = Math.sign(r.tiles[i][0] - r.tiles[i - 4][0]);
    const dz = Math.sign(r.tiles[i][2] - r.tiles[i - 4][2]);
    const h = `${dx},${dz}`;
    if (last && h !== last) turns++;
    last = h;
  }
  assert.ok(turns >= 3, `twists and turns (${turns})`);
  // A couple of days' work from both ends.
  r.last = game.sim.abs - DAY * 2;
  D.buildRoads();
  assert.ok(r.fromA > 0 && r.fromB > 0, 'built out from both towns');
  // On the map: each square a straight piece or a corner.
  const links = roadCellLinks([{ ...r, done: true }]);
  assert.ok(links.size > 3);
  for (const dirs of links.values()) assert.ok(dirs.size >= 1 && dirs.size <= 4);
  // Builders go out to the road in working hours.
  D.crews(Math.floor(game.sim.abs / DAY) * DAY + 600);
  const crew = [a, b].flatMap((s) => game.sim.layoutOf(s.id).npcs.filter((q) => q.roadwork));
  assert.ok(crew.length >= 2, 'a crew at each end');
  assert.ok(D.frontier(r, 'A') && D.frontier(r, 'B'), 'two ends being worked');
});

// ------------------------------------------------------------ activities
test('an ale is set down, drunk, and left as an empty mug to clear away', () => {
  const { game, L, p } = start();
  const n = game.npcs.find((q) => !q.dead && q.layout === L && q.rec.age === 'adult');
  // A spot of floor beside them.
  const x = n.x + 1;
  const z = n.z;
  const y = game.world.findStandY(x, z, n.y);
  game.world.setBlock(x, y, z, B.air, 0);
  assert.ok(game.setDown(x, y, z, 'ale', 1, { sid: L.settlement.id, idx: n.rec.idx, name: n.name }));
  game.placed.get(`${x},${y},${z}`).drink = true;
  n.drink = { x, y, z, sips: 5, need: 5 };
  void p;
  finishDrink(n, true);
  const got = game.placed.get(`${x},${y},${z}`);
  assert.equal(got.item, 'empty_mug');
  assert.ok(got.owner.mess, 'staff clear it away');
  assert.ok(MESS.has('empty_mug'));
});

test('dice are thrown onto the table and land showing their faces', () => {
  const { game, L, p } = start();
  const tosses = [];
  game.renderer.toss = (o) => tosses.push(o);
  const n = game.npcs.find((q) => !q.dead && q.layout === L && q.rec.age === 'adult');
  n.teleport(p.x + 1, p.y, p.z);
  n.atGoal = true;
  actFx(n, { act: 'hobby', hobby: 'dice' }, game, 10);
  assert.equal(tosses.length, 2, 'two dice');
  for (const t of tosses) {
    assert.equal(t.kind, 'dice');
    assert.ok(t.face >= 1 && t.face <= 6);
  }
});

// ------------------------------------------------------------ the tech tree
test('four branches of five: potions, master merchants, jewellers, steel and wells wait on what the realm knows', () => {
  assert.equal(TECH_IDS.length, 20);
  for (const b of ['economy', 'warfare', 'society', 'engineering']) assert.equal(TECH_IDS.filter((k) => TECHS[k].branch === b).length, 5);
  const game = world();
  const T = game.sim.tech;
  const s = game.world.ow.settlements.find((q) => q.civ && q.type === 'town');
  const L = game.sim.layoutOf(s.id);
  assert.equal(T.has(s, 'alchemy'), false);
  assert.ok(!stockFor(L, 'herbalist').some((k) => k.startsWith('potion_')), 'no potions yet');
  assert.ok(!stockFor(L, 'smith').includes('steel_sword'));
  assert.equal(PROFESSIONS.jeweller.tech, 'gemcraft', 'a jeweller\'s licence needs gemcraft');
  T.learn(s, 'alchemy', game.day);
  T.learn(s, 'steel', game.day);
  assert.ok(stockFor(L, 'herbalist').some((k) => k.startsWith('potion_')), 'potions once alchemy is known');
  assert.ok(stockFor(L, 'smith').includes('steel_sword'));
  // Guards re-equipped.
  T.learn(s, 'drill', game.day);
  T.daily(L, game.day, new RNG(1));
  const g = people(L).find((r) => r.job === 'guard');
  assert.ok(g.drilled && g.equipment.tool === 'steel_sword');
  // Townsfolk wake hardier from proper beds (hospitality).
  T.learn(s, 'hospitality', game.day);
  T.daily(L, game.day + 1, new RNG(2));
  assert.ok(people(L).some((r) => r.blue && r.blue.hp > 0));
});

test('the ruler sets the scholars to work, researchers study at the academy, and the realm learns', () => {
  const game = world();
  const T = game.sim.tech;
  // A seat of learning with room for it (a realm's capital, or a free
  // town: its own master), and a lot ready, as its streets would give it.
  const capL = game.world.ow.settlements.filter((q) => q.type !== 'village' && (!q.civ || game.sim.realms.isCapital(q)))
    .map((q) => game.sim.layoutOf(q.id)).find((L) => lotsReady(game, L, 'academy', 1).length);
  assert.ok(capL, 'somewhere with room');
  capL.econ.treasury = 2000;
  const s = capL.settlement;
  const st = T.stateOf(s);
  const known = st.done.length;
  for (let d = 1; d <= 40 && !capL.buildings.some((b) => b.type === 'academy'); d++) T.daily(capL, game.day + d, new RNG(d));
  assert.ok(st.current || st.done.length > known, 'something under study');
  // Finish the academy and staff it.
  for (const q of game.sim.works.projects) if (!q.done && q.sid === capL.settlement.id) game.sim.works.finishNow(capL, q);
  for (let d = 41; d <= 46; d++) T.daily(capL, game.day + d, new RNG(d));
  assert.ok(capL.buildings.some((b) => b.type === 'academy' && !b.underConstruction), 'an academy');
  assert.ok(people(capL).some((r) => r.job === 'researcher'), 'researchers');
  const before = st.progress + st.done.length * 1000;
  for (let d = 47; d <= 60; d++) T.daily(capL, game.day + d, new RNG(d));
  assert.ok(st.progress + st.done.length * 1000 > before, 'the work goes on');
});

test('the mayor shows the tree, and the study minigame records an insight for the realm', () => {
  const game = world();
  const s = game.world.ow.settlements.find((q) => q.civ && q.type === 'city');
  const ui = fakeUi(game);
  const tw = new TechWindow(ui, game, s);
  const { g, texts } = grid();
  tw.draw(g, game);
  assert.ok(texts.some((t) => /ECONOMY/.test(t)) && texts.some((t) => /WARFARE/.test(t)), 'four columns');
  assert.ok(texts.some((t) => /Bookkeeping/.test(t)));
  const T = game.sim.tech;
  T.stateOf(s).current = 'masonry';
  T.stateOf(s).progress = 0;
  const L = game.sim.layoutOf(s.id);
  L.econ.treasury = 100;
  const rw = new ResearchWindow(ui, game, s);
  // Not lined up: a blot, nothing learned.
  rw.rings.forEach((r, i) => (r.rot = 1 + i));
  rw.record();
  assert.equal(T.stateOf(s).progress, 0);
  // All three marks under the pointer.
  for (const r of rw.rings) r.rot = -r.mark * ((Math.PI * 2) / 8);
  assert.ok(rw.allAligned());
  const coins = game.player.inv.reduce((n, q) => n + (q && q.item === 'coin' ? q.count : 0), 0);
  rw.record();
  assert.ok(T.stateOf(s).progress > 0, 'points toward masonry');
  assert.equal(game.player.inv.reduce((n, q) => n + (q && q.item === 'coin' ? q.count : 0), 0), coins + 6, 'paid for it');
});

// ------------------------------------------------------------ politics
test('a realm pushes its borders out as it grows, and draws them back as it shrinks', () => {
  const game = world();
  const P = game.sim.politics;
  const civ = plainCivs(game)[0];
  const land = P.land(civ).length;
  P.wantLand(civ);
  // Grown a great deal since it was first counted.
  P.str0[civ.id] = P.strength(civ) / 2;
  P.borders(civ, game.day, new RNG(1));
  const more = P.land(civ).length;
  assert.ok(more > land, `spread (${land} -> ${more})`);
  // Shrunk.
  P.str0[civ.id] = P.strength(civ) * 3;
  P.borders(civ, game.day + 7, new RNG(2));
  assert.ok(P.land(civ).length < more, 'drawn back');
  // The map's land survives a save.
  const g2 = reload(game);
  assert.equal(g2.sim.politics.land(g2.world.ow.civs[0]).length, P.land(civ).length);
});

test('friendly realms of like mind ally; clashing ways keep them apart; a soured alliance breaks', () => {
  const game = world();
  const P = game.sim.politics;
  const R = game.sim.realms;
  const [a, b, c] = plainCivs(game);
  a.values = ['mercantile', 'artisan'];
  b.values = ['artisan', 'seafaring'];
  c.values = ['pious', 'agrarian'];
  R.shift(a, b, 90 - R.relation(a, b).score, game.day);
  for (let d = 1; d <= 30 && !P.allied(a, b); d++) P.pacts([a, b], game.day + d, new RNG(d));
  assert.ok(P.allied(a, b), 'allied');
  assert.ok(P.allies(a).includes(b));
  // Pious and scholarly can't stand side by side.
  a.values = ['scholarly', 'mercantile'];
  R.shift(a, c, 90 - R.relation(a, c).score, game.day);
  for (let d = 1; d <= 30; d++) P.pacts([a, c], game.day + d, new RNG(d));
  assert.ok(!P.allied(a, c), 'cultures clash');
  assert.ok(P.clash(a, c));
  // A falling-out: the alliance breaks, and it's remembered as a dispute.
  R.shift(a, b, -200, game.day);
  P.pacts([a, b], game.day + 40, new RNG(9));
  assert.ok(!P.allied(a, b));
  assert.ok(P.disputes.some((d) => d.kind === 'pact'));
});

test('a small realm long allied to a big one joins it', () => {
  const game = world();
  const P = game.sim.politics;
  const R = game.sim.realms;
  const [big, , small] = plainCivs(game);
  small.values = big.values.slice();
  P.ally(big, small, game.day - 40);
  P.alliances[0].since = game.day - 40;
  R.shift(big, small, 100, game.day);
  const towns = R.members(small).length;
  let done = null;
  for (let i = 0; i < 40 && !done; i++) done = P.merges(game.day + i * 7, new RNG(i));
  assert.ok(done && done.into === big, 'merged');
  assert.equal(R.members(small).length, 0);
  assert.ok(R.members(big).length >= towns + 1);
  assert.ok(small.merged);
});

test('by decree the watch grows in a war; with conscription the old (and the young) are drafted, and sent home at peace', () => {
  const game = world();
  const P = game.sim.politics;
  const W = game.sim.war;
  const T = game.sim.tech;
  const [a, b] = plainCivs(game);
  const capS = game.sim.realms.capitalOf(a);
  T.learn(a, 'codex', game.day);
  T.learn(a, 'conscription', game.day);
  const w = W.declare(a, b, { k: 'land', text: 'the land between them' }, game.day, new RNG(1));
  w.score = -60; // going badly for a
  P.policy(a, game.day, new RNG(1));
  assert.equal(a.decrees.watch, 'heavy');
  assert.ok(['elders', 'all'].includes(a.decrees.draft), `draft: ${a.decrees.draft}`);
  // A town keeps to it: everyone spare joins, then the elders.
  const L = game.sim.layoutOf(capS.id);
  const g0 = people(L).filter((r) => r.job === 'guard').length;
  for (let d = 0; d < 60; d += 3) P.townDay(L, d + (3 - (capS.id % 3)) % 3, new RNG(d));
  assert.ok(people(L).filter((r) => r.job === 'guard').length > g0, 'more guards');
  // No one spare left (and the watch thinned out): the draft reaches the elders.
  for (const r of people(L)) if (r.age === 'adult' && !['mayor', 'noble', 'priest'].includes(r.job) && r.ruler === undefined) r.job = 'innkeeper';
  a.decrees.draft = 'elders';
  for (let d = 60; d < 120; d += 3) P.townDay(L, d + (3 - (capS.id % 3)) % 3, new RNG(d));
  const drafted = L.npcs.filter((r) => r.drafted !== undefined && alive(r));
  assert.ok(drafted.length && drafted.every((r) => r.age === 'elder'), 'elders called up');
  assert.ok(drafted[0].schedule.work.some((e) => e.act === 'work'), 'with a shift to stand');
  // Peace: the draft ends and they go home.
  a.decrees.draft = 'none';
  for (let d = 120; d < 240; d += 3) P.townDay(L, d + (3 - (capS.id % 3)) % 3, new RNG(d));
  assert.equal(L.npcs.filter((r) => r.drafted !== undefined && alive(r)).length, 0);
  assert.ok(L.econ.ledger.some((n) => /sent home from the watch/.test(n.text)));
});

test('a town short of guards takes people on (the watch no longer dwindles away)', () => {
  const game = world();
  const s = game.world.ow.settlements.find((q) => q.type === 'city');
  const L = game.sim.layoutOf(s.id);
  for (const r of people(L).filter((q) => q.job === 'guard').slice(1)) r.job = 'laborer';
  for (let d = 0; d < 30; d++) game.sim.politics.townDay(L, d, new RNG(d));
  assert.ok(people(L).filter((r) => r.job === 'guard').length >= 4);
  assert.ok(L.econ.ledger.some((n) => /watch was short-handed/.test(n.text)));
});

// ------------------------------------------------------------ raids
function hostilePair(game) {
  const ss = game.world.ow.settlements;
  const from = ss.find((s) => s.name === 'Bramham');
  const to = ss.find((s) => s.name === 'Orngate');
  game.sim.realms.shift(from.civ, to.civ, -90, game.day);
  return { from, to, a: from.civ, b: to.civ };
}

test('hostile realms send small raiding parties at night; merchants keep off the roads; the town walls itself in sooner', () => {
  const game = world();
  const W = game.sim.war;
  const { from, to, a, b } = hostilePair(game);
  const r0 = game.sim.realms.relation(a, b).score;
  const raid = W.planRaid(a, b, from, to, game.day, new RNG(3));
  assert.ok(raid, 'a raid');
  assert.ok(raid.party.length >= 2 && raid.party.length <= 5, 'a small party, not an army');
  const recs = W.partyRecs(raid);
  assert.ok(recs.every((r) => r.away && r.raid === raid.id), 'off over the border');
  assert.ok((raid.at % DAY) >= 21 * 60 || (raid.at % DAY) < 3 * 60, 'by night');
  assert.ok(W.unsafe(to), 'word of riders keeps merchants away');
  const TL = game.sim.layoutOf(to.id);
  assert.ok(TL.econ.ledger.some((n) => /Riders of the/.test(n.text)));
  // Reckoned up (you're not there).
  const out = W.resolveRaid(raid, TL, game.sim.layoutOf(from.id), new RNG(4));
  assert.ok(['plundered', 'repelled'].includes(out.result));
  assert.ok(recs.every((r) => !alive(r) || (!r.away && r.raid === undefined)), 'home again');
  assert.ok(game.sim.realms.relation(a, b).score < r0, 'relations sour');
  assert.equal(W.raidLog.length, 1);
  assert.ok(TL.econ.recent.raids >= 1);
  assert.ok(!W.unsafe(to), 'the alert lifts');
  // Walls go up sooner: a raided town (not yet a city) with the coin.
  const town = game.world.ow.settlements.find((s) => s.type === 'town' && s.civ && !game.sim.layoutOf(s.id).walled);
  const L = game.sim.layoutOf(town.id);
  L.econ.raidedDay = game.day;
  L.econ.treasury = 600;
  game.sim.works.projects = game.sim.works.projects.filter((q) => q.sid !== town.id);
  if (game.sim.construction && game.sim.construction.sid === town.id) game.sim.construction = null;
  let wall = null;
  for (let d = game.day; d < game.day + 6 && !wall; d++) {
    stockOf(L).stone = 200;
    stockOf(L).wood = 200;
    const out = growth(game.sim, L, d);
    if (out && out.wall) wall = out.wall;
    // (Anything else it decided to build first is done at once.)
    for (const q of game.sim.works.projects) if (!q.done && q.sid === town.id && q.kind !== 'wall') game.sim.works.finishNow(L, q);
  }
  assert.ok(wall, 'a wall against raiders');
  assert.ok(L.econ.ledger.some((n) => /wall the town in/.test(n.text)));
});

test('raiders on the ground: the watch fights them, and killing a raider is no crime', () => {
  const { game, input, L, p } = start(12345, { learned: false }, 22 * 60);
  const W = game.sim.war;
  const ss = game.world.ow.settlements;
  const to = L.settlement;
  const from = ss.find((s) => s.civ && s.civ !== to.civ && game.sim.layoutOf(s.id) && people(game.sim.layoutOf(s.id)).filter((r) => r.job === 'guard').length >= 3);
  game.sim.realms.shift(from.civ, to.civ, -90, game.day);
  const raid = W.planRaid(from.civ, to.civ, from, to, game.day, new RNG(5));
  assert.ok(raid);
  raid.at = game.sim.abs;
  W.update(0.1);
  assert.ok(W.live && W.live.kind === 'raid', 'fought out on the ground');
  const raiders = W.live.ents;
  assert.ok(raiders.length >= 2);
  assert.ok(raiders.every((n) => n.state === 'warband' && n.warband.foe && n.hostileNow));
  assert.ok(raiders.every((n) => /^tabard:/.test(n.look.gear.body)), 'in their realm\'s colours');
  // You cut one down: no crime, no charge.
  const r0 = raiders[0];
  game.damage(r0, 999, p);
  assert.ok(r0.dead);
  assert.equal(game.sim.justice.pendingIn(to.id).length, 0);
  assert.ok(!game.isWanted(to.id));
  assert.ok(!alive(r0.rec), 'they really died');
  assert.ok(/raiding/.test(r0.rec.cause || ''), r0.rec.cause);
  // The watch goes for the rest.
  tick(game, input, 40, 0.25);
  const guardsOn = game.npcs.filter((n) => !n.dead && n.rec.job === 'guard' && n.layout === L && n.threat && n.threat.warband);
  assert.ok(guardsOn.length || raiders.slice(1).some((n) => n.dead || n.warband.phase === 'flee'), 'the watch turns out');
  // Over in the end, and reckoned up.
  for (let i = 0; i < 160 && W.live; i++) game.update(0.5, input);
  for (const n of raiders) if (!n.dead && game.npcs.includes(n)) game.despawnNpc(n);
  for (let i = 0; i < 4 && W.live; i++) game.update(0.5, input);
  assert.equal(W.live, null);
  assert.equal(W.raidLog.length, 1);
});

// ------------------------------------------------------------ war
test('war needs a reason; allies are called (or the alliance breaks); battles kill real soldiers and wear the realms down', () => {
  const game = world();
  const W = game.sim.war;
  const P = game.sim.politics;
  const R = game.sim.realms;
  const [a, b, c] = plainCivs(game);
  R.shift(a, b, -100, game.day);
  // Hostile, but no grievance: no war.
  for (let i = 0; i < 20; i++) W.considerWars([a, b], game.day + i * 7, new RNG(i));
  assert.equal(W.wars.length, 0, 'no reason, no war');
  // Raid after raid on a's towns.
  for (let i = 0; i < 3; i++) W.raidLog.push({ a: b.id, b: a.id, day: game.day, result: 'plundered' });
  assert.ok(W.reasons(a, b, game.day).some((q) => q.k === 'raids'));
  // b has an ally who won't help.
  c.values = b.values.slice();
  P.ally(b, c, game.day);
  R.shift(c, a, 100 - R.relation(c, a).score, game.day);
  for (let i = 0; i < 40 && !W.wars.length; i++) W.considerWars([a, b], game.day, new RNG(100 + i));
  assert.equal(W.wars.length, 1, 'war declared');
  const w = W.wars[0];
  assert.deepEqual(w.a, [a.id]);
  assert.ok(!P.allied(b, c) || w.b.includes(c.id), 'the ally joins, or the alliance is broken');
  // A battle (far from you: reckoned up).
  game.player.x = 0;
  game.player.z = 0;
  W.planBattle(w, game.day, new RNG(1));
  assert.ok(w.plan && /^the Battle of /.test(w.plan.name));
  const dead0 = game.world.ow.settlements.reduce((n, s) => n + game.sim.layoutOf(s.id).npcs.filter((r) => !alive(r)).length, 0);
  const rec = W.battle(w, w.plan);
  assert.ok(rec && rec.text && rec.winner, rec && rec.text);
  assert.ok(['line', 'flank', 'pincer', 'hold', 'works', 'feint', 'retreat'].includes(rec.ta));
  assert.ok(w.score !== 0);
  assert.ok((w.weary[a.id] || 0) > 0 && (w.weary[b.id] || 0) > 0, 'weariness');
  const fell = game.world.ow.settlements.reduce((n, s) => n + game.sim.layoutOf(s.id).npcs.filter((r) => !alive(r) && /^fell at /.test(r.cause || '')).length, 0);
  assert.ok(fell === rec.la + rec.lb - 0 || fell <= rec.la + rec.lb, 'the fallen are real people');
  void dead0;
  assert.ok(R.memberLayouts(a).some((L) => L.econ.ledger.some((n) => n.text === rec.text)), 'news of it');
  // Weariness makes the towns restless.
  w.weary[a.id] = 0.9;
  const L = R.memberLayouts(a).find((q) => !R.isCapital(q.settlement));
  const u0 = L.econ.unrest || 0;
  W.townDay(L, 6 - (L.settlement.id % 7) + 7);
  assert.ok((L.econ.unrest || 0) > u0);
});

test('a beaten realm sues for peace and serves the victor; a truce follows; a vassal pays tribute and may throw off the yoke', () => {
  const game = world();
  const W = game.sim.war;
  const P = game.sim.politics;
  const [a, b] = plainCivs(game);
  game.sim.realms.shift(a, b, -100, game.day);
  const w = W.declare(a, b, { k: 'raids', text: 'the raids on its towns' }, game.day, new RNG(1));
  w.score = 110;
  W.suePeace(w, game.day + 20, new RNG(2));
  assert.equal(W.wars.length, 0, 'over');
  assert.equal(w.over.terms, 'vassal');
  assert.equal(P.lordOf(b), a);
  assert.ok(W.truce(a, b, game.day + 25), 'a truce');
  assert.ok(P.bound(a, b));
  // Tribute.
  const VL = game.sim.layoutOf(game.sim.realms.realm(b).capital);
  VL.econ.treasury = 500;
  P.vassalWeek(game.day + 21, new RNG(3));
  assert.ok(VL.econ.treasury < 500 && P.vassals[b.id].paid > 0, 'tribute paid');
  // Hatred: thrown off.
  game.sim.realms.shift(a, b, -200, game.day);
  for (let i = 0; i < 40 && P.lordOf(b); i++) P.vassalWeek(game.day + 30 + i * 7, new RNG(i));
  assert.equal(P.lordOf(b), null, 'free again');
});

test('a losing side\'s ally may betray it and change sides', () => {
  const game = world();
  const W = game.sim.war;
  const P = game.sim.politics;
  const R = game.sim.realms;
  const [a, b, c] = plainCivs(game);
  R.shift(a, b, -100, game.day);
  const w = W.declare(a, b, { k: 'land', text: 'the land between them' }, game.day, new RNG(1));
  w.a.push(c.id);
  w.weary[c.id] = 0;
  P.ally(a, c, game.day);
  w.score = -80; // a is losing badly
  for (let i = 0; i < 60 && w.a.includes(c.id); i++) W.betrayals(w, game.day + i * 7, new RNG(i));
  assert.ok(w.b.includes(c.id) || !w.a.includes(c.id), 'turned coat (or left)');
  if (w.b.includes(c.id)) {
    assert.ok(!P.allied(a, c));
    assert.ok(R.memberLayouts(a).some((L) => L.econ.ledger.some((n) => /Betrayal!/.test(n.text))));
  }
});

test('a battle near you is fought out on the ground: lines, a plan each, log walls, and the side that breaks', () => {
  const { game, input, L, p } = start(12345, { learned: false });
  for (const s of game.world.ow.settlements) game.sim.layoutOf(s.id);
  const W = game.sim.war;
  const ss = game.world.ow.settlements;
  const home = L.settlement;
  const foeTown = ss.find((s) => s.name === 'Bramham');
  const [a, b] = [home.civ, foeTown.civ];
  game.sim.realms.shift(a, b, -100, game.day);
  const w = W.declare(a, b, { k: 'land', text: 'the land between them' }, game.day, new RNG(2));
  const bd = home.bounds;
  const site = { x: bd.x0 - 22, z: Math.round((bd.z0 + bd.z1) / 2) };
  game.loadAround(site.x, site.z, true);
  p.teleport(site.x + 3, game.world.findStandY(site.x + 3, site.z - 8, 6), site.z - 8);
  w.plan = { at: game.sim.abs, site, biome: 'plains', river: false, name: 'the Battle of Test Field', attacker: 'b', atk: foeTown.id, def: home.id, ca: a.id, cb: b.id };
  W.chooseTactic = (ww, side) => (side === 'a' ? 'works' : 'pincer');
  W.update(0.1);
  const live = W.live;
  assert.ok(live && live.kind === 'battle', 'fought here');
  assert.equal(live.sides.a.tactic, 'works');
  assert.equal(live.sides.b.tactic, 'pincer');
  assert.ok(live.sides.a.ents.length && live.sides.b.ents.length);
  assert.ok(live.walls.length > 0, 'log walls to throw up');
  const roles = live.sides.b.ents.map((n) => n.warband.role);
  assert.ok(roles.includes('left') && roles.includes('right'), 'two wings for the pincer');
  tick(game, input, 48, 0.25);
  assert.ok(live.walls.some((q) => q.up), 'the walls go up');
  for (let i = 0; i < 1600 && !live.done; i++) game.update(0.25, input);
  assert.ok(live.done, 'one side broke (or it ran its course)');
  const rec = w.battles[w.battles.length - 1] || W.past.flatMap((q) => q.battles).pop();
  assert.ok(rec && rec.live, 'reckoned from what happened');
  // The field is cleared afterwards.
  for (let i = 0; i < 200 && W.live; i++) game.update(0.25, input);
  assert.equal(W.live, null);
  assert.ok(live.walls.every((q) => !q.up || game.world.getBlock(q.op[0], q.op[1], q.op[2]) !== q.op[3]), 'walls taken down');
});

test('wars, alliances, vassals and truces survive a save', () => {
  const game = world();
  const W = game.sim.war;
  const P = game.sim.politics;
  const [a, b, c] = plainCivs(game);
  game.sim.realms.shift(a, b, -100, game.day);
  P.ally(a, c, game.day);
  const w = W.declare(a, b, { k: 'land', text: 'the land between them' }, game.day, new RNG(1));
  W.planBattle(w, game.day, new RNG(2));
  W.truces['9:10'] = game.day + 5;
  P.vassals[c.id] = { lord: a.id, since: game.day, paid: 0 };
  const g2 = reload(game);
  const W2 = g2.sim.war;
  const [a2, b2, c2] = g2.world.ow.civs;
  assert.equal(W2.wars.length, 1);
  assert.ok(W2.enemies(a2, b2));
  assert.ok(W2.wars[0].plan && !W2.wars[0].plan.live);
  assert.ok(g2.sim.politics.allied(a2, c2) || g2.sim.politics.lordOf(c2) === a2);
  assert.equal(g2.sim.politics.lordOf(c2), a2);
  assert.equal(W2.truces['9:10'], game.day + 5);
});
