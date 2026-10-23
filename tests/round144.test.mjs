// Round 144: battles fought by bands (each with its captain and banner, its
// morale, its orders, a commander's plan over them all), sieges (day by day
// off-screen; the assault on the ground, ladders and ram and the fighting
// in the streets), the sack (how cruel, by who took the town), and you in
// command (the war table, orders given as the battle goes on, a fallen
// banner taken up).
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGame, stubInput } from './helpers.mjs';
import { RNG } from '../src/util/rng.js';
import { brutality, sackOf, CONDUCTS } from '../src/sim/conduct.js';
import { startSiege, scheduleAssault, siegeLines, siegeFor, siegeDay } from '../src/sim/siege.js';
import { commandOf, playerOrder, setPlan, takeBanner, giveWord, afterCommand } from '../src/sim/command.js';
import { allBands, standing, bandUp } from '../src/sim/bands.js';
import { WarTableWindow } from '../src/ui/command.js';
import { Grid } from '../src/ui/ascii.js';
import { GAME_VERSION, compareVersions } from '../src/version.js';
import { stepsFor } from '../src/game/migrate.js';
import { runCommand } from '../src/game/commands.js';

const input = stubInput();

// A war between the realm of the town you're in and a neighbour's, the
// player standing near where they'll fight.
function atWar(seed = 12345, cap = 16) {
  const game = makeGame(seed, { learned: true });
  game.minute = 600;
  for (let i = 0; i < 20; i++) game.update(0.1, input);
  const [, a0] = [...game.active][0];
  const L = a0.layout;
  for (const s of game.world.ow.settlements) game.sim.layoutOf(s.id);
  const W = game.sim.war;
  W.liveMax = cap;
  const home = L.settlement;
  const foeTown = game.world.ow.settlements.find((s) => s.civ && s.civ !== home.civ && game.sim.layoutOf(s.id)?.econ);
  const [a, b] = [home.civ, foeTown.civ];
  game.sim.realms.shift(a, b, -100, game.day);
  const w = W.declare(a, b, { k: 'land', text: 'land' }, game.day, new RNG(2));
  return { game, L, W, w, home, foeTown, a, b };
}

// A town walled (as its builders would wall it), gates and all.
function wallUp(game, L) {
  if (L.walled) return L;
  const plan = L.wallPlan();
  game.sim.setBlocks(plan.list);
  L.applyWall(plan.tiles, false);
  L.econ.walled = true;
  for (const q of plan.gates) L.gates.push(q);
  game.sim.setBlocks(L.gateBlocks(plan.gates));
  return L;
}

// A battle in the field outside the town, the player of its realm (and
// named by it to command, if `rank`).
function battle(rank = 'marshal', seed = 12345, cap = 16) {
  const o = atWar(seed, cap);
  const { game, W, w, home, foeTown, a, b } = o;
  game.sim.citizen = { sid: home.id, since: game.day, host: null, hostBed: null, home: null, taxDay: game.day, owed: 0 };
  if (rank) W.ranks = { [a.id]: { 'p:host': rank } };
  const bd = home.bounds;
  const site = { x: bd.x0 - 22, z: Math.round((bd.z0 + bd.z1) / 2) };
  game.loadAround(site.x, site.z, true);
  const p = game.player;
  p.teleport(site.x + 8, game.world.findStandY(site.x + 8, site.z, 6), site.z);
  w.plan = { at: game.sim.abs, site, biome: 'plains', river: false, name: 'the Battle of Test Field', attacker: 'b', atk: foeTown.id, def: home.id, ca: a.id, cb: b.id };
  W.callUp(w, w.plan, game.day);
  W.update(0.1);
  return { ...o, site, p, live: W.live };
}

test('how a town taken by storm is treated: by the people who took it, their ruler, and the commander in the field', () => {
  const { game, foeTown, a } = atWar();
  const sim = game.sim;
  const as = (values) => ({ ...a, values });
  const ctx = { town: foeTown };
  const martial = brutality(sim, as(['martial', 'seafaring']), { ...ctx, w: { reason: 'holy' } });
  const pious = brutality(sim, as(['pious', 'scholarly']), ctx);
  assert.ok(martial.c > pious.c + 0.3, `a martial people in a holy war (${martial.c}) crueller than a pious, learned one (${pious.c})`);
  assert.ok(martial.why.some((q) => /holy war/.test(q.text)) && pious.why.some((q) => /pious/.test(q.text)), 'and says why');
  const merchants = brutality(sim, as(['mercantile']), ctx);
  assert.ok(merchants.g > pious.g, 'a merchant people carries off more');
  // The commander: a merciful one holds them back; a hot-tempered, cruel
  // one lets them go.
  const kind = brutality(sim, as([]), { ...ctx, commander: { personality: { temper: 0.1, kindness: 0.95 }, otraits: { v: 1, list: ['merciful'] } } });
  const hard = brutality(sim, as([]), { ...ctx, commander: { personality: { temper: 0.95, kindness: 0.05 }, otraits: { v: 1, list: ['stern'] } } });
  assert.ok(hard.c > kind.c + 0.2, `${hard.c} vs ${kind.c}`);
  // What went before: a long siege, assaults thrown back, terms refused.
  const bitter = brutality(sim, as([]), { ...ctx, days: 9, failed: 3, refused: 1 });
  assert.ok(bitter.c > brutality(sim, as([]), ctx).c + 0.25);
  // A player ruler's decree on their armies' conduct, and a player's word
  // in the field, over all of it.
  assert.deepEqual(CONDUCTS, ['mercy', 'custom', 'plunder', 'ruthless']);
  assert.equal(brutality(sim, as(['martial']), { ...ctx, conduct: 'mercy', days: 9, failed: 3 }).level, 'orderly');
  assert.equal(brutality(sim, as(['pious']), { ...ctx, conduct: 'ruthless' }).level, 'massacre');
  const loot = brutality(sim, as([]), { ...ctx, conduct: 'plunder' });
  assert.equal(loot.level, 'plunder', 'plunder, no killing: the town stripped, its people left be');
  assert.equal(brutality(sim, as(['martial']), { ...ctx, word: 'spare' }).level, 'orderly');
  assert.ok(['sack', 'massacre'].includes(brutality(sim, as(['pious']), { ...ctx, word: 'free' }).level));
  // What it comes to.
  const pop = 60;
  const none = sackOf(brutality(sim, as([]), { ...ctx, conduct: 'mercy' }), pop);
  const worst = sackOf(brutality(sim, as([]), { ...ctx, conduct: 'ruthless' }), pop);
  assert.equal(none.killed, 0);
  assert.equal(none.fires, 0);
  assert.ok(worst.killed > 0 && worst.fires > 2 && !worst.quarter && worst.flee);
  assert.ok(worst.loot > none.loot && worst.stores > none.stores);
  const plunder = sackOf(loot, pop);
  assert.equal(plunder.killed, 0, 'no killing');
  assert.ok(plunder.loot > none.loot && !plunder.flee);
});

test('a ruler who plays decrees how their armies treat the towns they take', () => {
  const { game, a } = atWar();
  const crown = game.sim.crown;
  assert.equal(crown.decreeNow(a, 'conduct'), 'custom');
  const text = crown.decree(a, 'conduct', 'mercy', null, true);
  assert.match(text, /mercy/);
  assert.equal(crown.R(a).decrees.conduct, 'mercy');
  assert.equal(crown.decreeNow(a, 'conduct'), 'mercy');
  assert.equal(crown.decree(a, 'conduct', 'mercy', null, true), null, 'so it stands already');
  assert.equal(crown.decree(a, 'conduct', 'nonsense', null, true), null);
  assert.match(crown.stated(a, { fx: { decree: 'conduct', v: 'ruthless' } }).text, /no quarter/);
});

test('a battle is fought by bands: captains, banners, orders, morale', () => {
  const { live, W, game } = battle(null);
  assert.ok(live && live.kind === 'battle', 'the battle is fought where you are');
  for (const sd of ['a', 'b']) {
    const S = live.sides[sd];
    assert.ok(S.bands.length >= 2, `side ${sd}: ${S.bands.length} bands`);
    assert.ok(S.marshal, 'a commander for each side');
    const roles = new Set(S.bands.map((b) => b.role));
    assert.ok(roles.size >= 2, [...roles].join(','));
    for (const b of S.bands) {
      assert.ok(b.ents.length && b.ents.every((n) => n.warband), `${b.name}: its soldiers know their band`);
      assert.ok(b.captain && b.ents.includes(b.captain), `${b.name} has a captain`);
      if (b.ents.length > 1) assert.ok(b.bearer && b.bearer.warband.bearer, `${b.name} has its banner up`);
      assert.ok(b.order && b.order.kind, 'and its orders');
      assert.ok(b.morale > 30 && b.morale <= 100);
    }
  }
  // Every soldier on the field is in one band.
  const seen = new Set();
  for (const b of allBands(live)) for (const n of b.ents) {
    assert.ok(!seen.has(n), 'no soldier in two bands');
    seen.add(n);
  }
  // Fought out a while: they close, blows land, and it tells on their
  // nerve.
  const start = Object.fromEntries(allBands(live).map((b) => [b.id, b.morale]));
  for (let i = 0; i < 30 * 40 && !live.done; i++) game.update(1 / 30, input);
  assert.ok(live.go, 'the battle has begun');
  const fallen = allBands(live).reduce((k, b) => k + b.ents.filter((n) => !standing(n)).length, 0);
  assert.ok(fallen > 0 || live.done, 'blows have landed');
  assert.ok(allBands(live).some((b) => b.morale < start[b.id] - 1 || b.state !== 'ok') || live.done, 'and some band\'s nerve is shaken');
  void W;
});

test('you, in command: orders given as it goes, the plan changed, a fallen banner taken up', () => {
  const { live, W, p, site } = battle('marshal');
  const c = commandOf(W, p);
  assert.equal(c.rank, 'marshal');
  assert.ok(c.bands.length >= 2);
  assert.equal(live.sides[c.side].cmdBy, 'p:host');
  const b0 = c.bands.find((b) => b.role !== 'bows') || c.bands[0];
  let r = playerOrder(W, p, b0.id, 'charge');
  assert.ok(r.ok, r.why);
  assert.equal(b0.order.kind, 'charge');
  assert.equal(b0.order.by, 'p:host', 'yours: their captain won\'t change it');
  r = playerOrder(W, p, 'all', 'advance', { x: site.x, z: site.z });
  assert.ok(r.ok && r.n >= 2);
  assert.ok(!playerOrder(W, p, b0.id, 'storm').ok, 'no walls to storm here');
  if (b0.role !== 'bows') assert.ok(!playerOrder(W, p, b0.id, 'loose').ok, 'only the bowmen loose');
  r = setPlan(W, p, 'pincer');
  assert.ok(r.ok);
  assert.equal(live.sides[c.side].tactic, 'pincer');
  assert.ok(!setPlan(W, p, 'pincer').ok, 'that\'s the plan already');
  r = playerOrder(W, p, b0.id, 'follow');
  assert.ok(r.ok && b0.order.kind === 'follow' && b0.order.p === p);
  r = playerOrder(W, p, b0.id, 'free');
  assert.ok(r.ok && b0.order.by === 'ai', 'back to its captain');
  assert.ok(!giveWord(W, p, 'spare').ok, 'no town to spare here');
  // A band of the enemy's: not yours to command.
  const theirs = live.sides[c.side === 'a' ? 'b' : 'a'].bands[0];
  assert.ok(!playerOrder(W, p, theirs.id, 'hold').ok);
  // A banner down beside you: taken up, the band's yours, and the day won,
  // you're named a captain of the realm.
  const b1 = c.bands[c.bands.length - 1];
  live.fallenBanners = [{ band: b1.id, x: Math.floor(p.x), z: Math.floor(p.z), t: live.t, color: b1.color }];
  const got = takeBanner(W, p);
  assert.equal(got, b1);
  assert.equal(b1.player, p);
  assert.ok(p.banner && p.banner.band === b1.id, 'you carry its colours');
  assert.equal(live.fallenBanners.length, 0);
  const civ = live.sides[c.side].civ;
  W.ranks[civ.id] = {};
  afterCommand(W, live, c.side);
  assert.equal(W.ranks[civ.id]['p:host'], 'captain');
  assert.equal(p.banner, null);
});

test('drafted into a band: you fight in it, under its captain', () => {
  const { live, W, p } = battle('soldier');
  const c = commandOf(W, p);
  assert.ok(c, 'you\'re on a side');
  assert.equal(c.rank, 'soldier');
  assert.ok(!playerOrder(W, p, 'all', 'charge').ok, 'no one to command');
  const r = live.ranks.get(p);
  assert.ok(r && r.band, 'given a band to fight in');
  assert.ok(game0msgs(W).some((m) => /You fight in /.test(m)));
  // A captain of the realm: a band of their own.
  const cap = battle('captain');
  const cc = commandOf(cap.W, cap.p);
  assert.equal(cc.rank, 'captain');
  assert.equal(cc.bands.length, 1);
  assert.ok(playerOrder(cap.W, cap.p, cc.bands[0].id, 'hold').ok);
  assert.ok(!setPlan(cap.W, cap.p, 'feint').ok, 'only the commander changes the plan');
});
const game0msgs = (W) => W.game.ui.msgs;

test('the war table shows the field: our bands, theirs, the plans and the orders', () => {
  const { game } = battle('marshal');
  const ui = { game, input: { isDown: () => false }, mouse: { x: 0, y: 0 }, mouseCell: { x: -1, y: -1 }, audio: null, msg() {}, time: 0 };
  const win = new WarTableWindow(ui);
  assert.equal(win.mode(), 'field');
  const gr = new Grid(win.w, win.h);
  win.draw(gr, game);
  let text = '';
  for (let y = 0; y < win.h; y++) {
    for (let x = 0; x < win.w; x++) text += gr.ch[y * win.w + x] || ' ';
    text += '\n';
  }
  for (const s of ['THE WAR TABLE', 'You command the host', 'OURS', 'THEIRS', 'Their plan', 'Charge', 'Rally', 'Plan:', 'pincer']) assert.ok(text.includes(s), s);
});

test('a walled town besieged: day by day, until it falls, holds, or the siege is lifted', () => {
  const { game, W, w, home, foeTown, a, b } = atWar(12345);
  const L = wallUp(game, game.world.layouts.get(home.id));
  game.player.teleport(0, 80, 0);
  const plan = { at: game.sim.abs, site: { x: L.bounds.x0 - 22, z: L.bounds.z0 }, biome: 'plains', river: false, name: 'x', attacker: 'b', atk: foeTown.id, def: home.id, ca: a.id, cb: b.id };
  assert.equal(siegeFor(W, w, plan, 1.5), 'walls');
  const S = startSiege(W, w, plan, 'battle', game.day, new RNG(3));
  assert.ok(S && w.siege === S && !S.small);
  assert.ok(S.walls.length >= 4, 'its wall in stretches');
  assert.ok(S.gate, 'a gate to batter');
  assert.ok(S.garrison >= 3 && S.host >= 4 && S.food > 0);
  assert.ok(W.markers().some((m) => m.kind === 'siege' && m.sid === home.id), 'marked on the map');
  const lines = siegeLines(W, w).join('\n');
  assert.match(lines, /The siege of/);
  assert.match(lines, /Food for/);
  // Saved and loaded mid-siege: it goes on.
  const g2 = makeGame(12345, { learned: true });
  g2.sim.war.load(JSON.parse(JSON.stringify(W.serialize())));
  const w2 = g2.sim.war.wars.find((q) => q.id === w.id);
  assert.ok(w2 && w2.siege && w2.siege.sid === home.id && w2.siege.walls.length === S.walls.length);
  // Days pass: the camp builds, the food runs down; in the end it's over
  // one way or another, and remembered.
  const food = S.food;
  let day = game.day;
  for (let i = 0; i < 40 && w.siege && W.wars.includes(w); i++) {
    day++;
    game.day = day;
    siegeDay(W, w, day, new RNG(50 + i));
    if (w.siege && w.siege.next && !w.siege.next.live) {
      w.siege.next.at = game.sim.abs - 1;
      W.update(0.1);
    }
  }
  assert.ok(S.food < food || S.phase === 'over', 'the stores run down');
  assert.equal(S.phase, 'over', 'it ends');
  assert.ok(['stormed', 'surrendered', 'betrayed', 'lifted', 'starved', 'over'].includes(S.end.how), S.end.how);
  assert.ok((w.sieges || []).some((q) => q.sid === home.id), 'and the war remembers it');
});

test('an unwalled town: surrounded, if the army\'s big enough; barricades, not walls', () => {
  const { game, W, w, home, foeTown, a, b } = atWar(12345);
  const L = game.world.layouts.get(home.id);
  if (L.walled) return;
  const plan = { at: game.sim.abs, site: { x: L.bounds.x0 - 22, z: L.bounds.z0 }, biome: 'plains', river: false, name: 'x', attacker: 'b', atk: foeTown.id, def: home.id, ca: a.id, cb: b.id };
  // A big host: a smaller siege. A handful: no siege (the town's simply
  // taken, or not).
  const pool = W.pool.bind(W);
  W.pool = () => ({ recs: [], extra: 60, civs: [b], total: 60 });
  assert.equal(siegeFor(W, w, plan, 1.5), 'small');
  W.pool = () => ({ recs: [], extra: 3, civs: [b], total: 3 });
  assert.equal(siegeFor(W, w, plan, 1.5), null);
  W.pool = () => ({ recs: [], extra: 40, civs: [b], total: 40 });
  game.player.teleport(0, 80, 0);
  const S = startSiege(W, w, plan, 'small', game.day, new RNG(3));
  W.pool = pool;
  assert.ok(S.small);
  assert.equal(S.walls.length, 0);
  assert.equal(S.gate, null);
  assert.ok(S.barricades.length >= 1, 'the streets barricaded');
  assert.match(game.ui.msgs.join('\n'), /surrounded/);
});

test('the assault on the ground: ladders up, the ram at the gate, the defenders on the walls', () => {
  const { game, W, w, home, foeTown, a, b } = atWar(8, 14);
  const L = wallUp(game, game.world.layouts.get(home.id));
  const plan = { at: game.sim.abs, site: { x: L.bounds.x0 - 22, z: Math.round((L.bounds.z0 + L.bounds.z1) / 2) }, biome: 'plains', river: false, name: 'x', attacker: 'b', atk: foeTown.id, def: home.id, ca: a.id, cb: b.id };
  const S = startSiege(W, w, plan, 'battle', game.day, new RNG(3));
  S.engines.catapults = 1;
  S.engines.rams = 1;
  S.engines.ladders = 6;
  S.host = Math.max(S.host, 30);
  const p = game.player;
  p.teleport(L.plaza.cx, game.world.findStandY(L.plaza.cx, L.plaza.cz, 6), L.plaza.cz);
  for (let i = 0; i < 30; i++) game.update(0.1, input);
  const site = W.sieges.sites.get(S.id);
  assert.ok(site && site.built, 'the siege lines laid out round the town');
  assert.ok(site.posts.length > 4, 'places on the wall for the defenders');
  assert.ok(site.ents.length > 0, 'the camp astir');
  assert.ok(L.barred, 'the gates barred');
  scheduleAssault(W, w, S, game.day, ['walls', 'gate']);
  S.next.at = game.sim.abs - 1;
  W.update(0.1);
  const live = W.live;
  assert.ok(live && live.siege === S, 'the storming, there and then');
  const kinds = live.points.map((q) => q.kind);
  assert.ok(kinds.includes('gate') && kinds.includes('walls'), kinds.join(','));
  const atk = live.sides[S.atk];
  const def = live.sides[S.def];
  assert.ok(atk.bands.some((q) => q.role === 'ladders'), 'bands at the ladders');
  assert.ok(atk.bands.some((q) => q.role === 'storm'), 'a band at the gate');
  assert.ok(def.bands.some((q) => q.posts && q.posts.length), 'defenders posted on the walls');
  assert.ok(live.site.ladders.length >= 1);
  for (let i = 0; i < 30 * 25 && !live.done; i++) game.update(1 / 30, input);
  assert.ok(live.done || live.site.ladders.some((q) => q.up) || live.inside > 0, 'a ladder against the wall, or they\'re through');
  assert.ok(allBands(live).some((q) => bandUp(q) < q.start) || live.done, 'and men have fallen');
});

test('the console: a battle at a size, there and then; a town besieged, and stormed', () => {
  const game = makeGame(12345, { learned: true });
  game.minute = 600;
  for (let i = 0; i < 20; i++) game.update(0.1, input);
  for (const s of game.world.ow.settlements) game.sim.layoutOf(s.id);
  const W = game.sim.war;
  const r = runCommand(game, 'battle 24');
  assert.match(r.join(' '), /a side on the field/);
  const live = W.live;
  assert.ok(live && live.kind === 'battle');
  assert.equal(live.cap, 24);
  assert.ok(live.sides.a.ents.length >= 16 && live.sides.b.ents.length >= 16, `${live.sides.a.ents.length} v ${live.sides.b.ents.length}`);
  assert.match(runCommand(game, 'battle').join(' '), /already/);
  // A town besieged (not the one fought over).
  W.live = null;
  const s = game.world.ow.settlements.find((q) => q.civ && game.sim.layoutOf(q.id)?.econ && !W.atWar(q.civ));
  const out = runCommand(game, `siege ${s.name}`).join(' ');
  assert.match(out, new RegExp(`${s.name} is besieged`));
  const w = W.warOf(s.civ);
  assert.ok(w && w.siege && w.siege.sid === s.id);
  runCommand(game, `siege storm ${s.name}`);
  assert.ok(w.siege.next && w.siege.next.at <= game.sim.abs, 'the assault, now');
});

test('version 1.44.0', () => {
  assert.ok(compareVersions('1.44.0', GAME_VERSION) <= 0);
  assert.ok(stepsFor('1.43.0').some((q) => q.to === '1.44.0'));
});
