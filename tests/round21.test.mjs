import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGame, stubInput } from './helpers.mjs';
import { RNG } from '../src/util/rng.js';
import { alive, stockFor, DAY } from '../src/sim/econ.js';
import { GROUND, SURFACE } from '../src/config.js';
import { B } from '../src/world/blocks.js';
import { religionOf, forbiddenFood, dishesOf, TABOOS } from '../src/sim/culture.js';
import { yearOf } from '../src/sim/history.js';
import { gossipLines, lifeOf } from '../src/sim/society.js';
import { fortuneOf } from '../src/sim/prosperity.js';
import { musicMood, flavourTheme, THEMES } from '../src/game/music.js';

function start(seed = 12345, opts = {}, minute = 10 * 60) {
  const game = makeGame(seed, opts);
  const input = stubInput();
  game.minute = minute;
  for (let i = 0; i < 20; i++) game.update(0.1, input);
  const [sid, a] = [...game.active][0];
  return { game, input, sid, a, L: a.layout, p: game.player };
}

function world(seed = 12345, opts = {}) {
  const game = makeGame(seed, opts);
  for (const s of game.world.ow.settlements) game.sim.layoutOf(s.id);
  return game;
}

const reload = (game) => {
  const data = JSON.parse(JSON.stringify(game.serialize()));
  return new game.constructor({ seed: data.seed, renderer: game.renderer, audio: null, ui: game.ui, save: data });
};

const people = (L) => L.npcs.filter((r) => alive(r) && !r.away && !r.migrated && !r.visitor);
const laid = (game) => [...game.world.layouts.values()].filter((L) => L.econ && !L.settlement.deserted);
const run = (game, input, n) => {
  for (let i = 0; i < n; i++) game.update(0.1, input);
};

// ------------------------------------------------------------ culture
test('every realm keeps its own faith, its people their own dishes; what the faith forbids is never on the menu', () => {
  const game = world();
  const civs = game.world.ow.civs;
  const faiths = civs.map((c) => religionOf(game.world.ow.settlements.find((s) => s.civ === c)));
  assert.equal(new Set(faiths.map((f) => f.god)).size, civs.length, 'a god of their own');
  assert.equal(new Set(faiths.map((f) => f.faith)).size, civs.length, 'a church of their own');
  for (const f of faiths) {
    assert.ok(f.taboos.length >= 1 && f.taboos.every((t) => TABOOS[t]));
    assert.ok(f.holyName && f.feast);
  }
  // The same every time.
  const s0 = game.world.ow.settlements.find((s) => s.civ);
  assert.deepEqual(religionOf(s0), religionOf(s0));
  for (const L of laid(game)) {
    const s = L.settlement;
    const inn = stockFor(L, 'inn');
    assert.ok(inn.includes(dishesOf(s)[0]), `${s.name} cooks its own dish`);
    for (const k of [...inn, ...stockFor(L, 'baker'), ...stockFor(L, 'cook')]) assert.equal(forbiddenFood(s, k), null, `${k} is forbidden in ${s.name}`);
  }
});

test('breaking a custom costs a little standing with those who saw it, and is no crime', () => {
  const { game, L, p } = start();
  const s = L.settlement;
  const key = religionOf(s).taboos[0];
  const n = game.npcs.filter((q) => !q.dead && q.settlement === s && q.state === 'routine').sort((a, b) => a.distTo(p) - b.distTo(p))[0];
  p.teleport(n.x + 1, n.y, n.z);
  const before = game.sim.opinion(n);
  const wits = game.sim.witnesses(s.id, p.x, p.z, 9);
  assert.ok(wits.includes(n));
  game.sim.customs.breach(s, key, p.x, p.z);
  assert.ok(game.sim.opinion(n) < before, 'thought less of');
  assert.ok(before - game.sim.opinion(n) <= 3, 'only slightly');
  assert.ok(!game.isWanted(s.id), 'not a crime');
});

// ------------------------------------------------------------ history
test('a town has a history: its founding, its past, what it is known for; the news of the day goes into it', () => {
  const { game, L } = start();
  const H = game.sim.history;
  const h = H.of(L);
  assert.ok(h.founded < yearOf(game.day) && h.founder && h.famous && h.legend);
  assert.ok(H.lines(L)[0].startsWith('Founded in the year'));
  L.econ.ledger.push({ day: game.day, text: `Raiders of the Testers raided ${L.settlement.name} in the night.` });
  H.daily(L, game.day);
  assert.ok(h.entries.some((q) => /raided/.test(q.text) && q.day === game.day));
  const talk = H.talk(L, new RNG(2));
  assert.ok(talk[0].includes(h.founder));
  // A statue for a hero, on the square, with its plaque.
  const st = H.raiseStatue(L, 'Ada Brave', 'holding the bridge', game.day, 'npc');
  assert.ok(st);
  assert.equal(game.world.getBlock(st.x, GROUND, st.z), B.statue);
  assert.match(H.statueText(L, st.x, st.z).lines.join(' '), /Ada Brave.*holding the bridge/);
  assert.ok(h.entries.some((q) => /statue of Ada Brave/.test(q.text)));
});

// ------------------------------------------------------------ crime and punishment
test('a pickpocket is seen, taken in by the watch, locked up, and fined by the mayor in the morning', () => {
  const { game, input, L, p } = start(12345, {}, 11 * 60);
  const S = game.sim.society;
  const n = game.npcs.filter((q) => !q.dead && q.settlement === L.settlement && q.rec.age === 'adult' && q.rec.job !== 'guard' && q.rec.job !== 'mayor' && q.state === 'routine')
    .sort((a, b) => a.distTo(p) - b.distTo(p))[0];
  lifeOf(n.rec).vice = 'thief';
  n.rec.coins = 100;
  assert.ok(S.startCrime(n, 'theft'));
  const seen = new Set();
  for (let i = 0; i < 600 && n.state !== 'jailed'; i++) {
    game.update(0.1, input);
    seen.add(n.state);
  }
  assert.ok(seen.has('crime'));
  assert.equal(n.state, 'jailed');
  assert.ok(n.rec.life.held);
  assert.ok(L.econ.ledger.some((q) => q.text.includes(n.rec.name.last) && /taken in|called before/.test(q.text)));
  S.trials(L, game.day + 1, new RNG(1));
  assert.equal(n.rec.life.held, null);
  assert.equal(n.rec.life.convictions, 1);
  assert.ok(L.econ.ledger.some((q) => /fined/.test(q.text) && q.text.includes(n.rec.name.last)));
});

test('the exiled go to the bandits, the road, the nomads or another realm', () => {
  const game = world();
  const S = game.sim.society;
  const L = laid(game).find((q) => people(q).length > 12);
  const adults = people(L).filter((r) => r.age === 'adult' && r.job !== 'mayor' && r.job !== 'guard');
  const set = (r, p) => Object.assign(r.personality, p);
  const [a, b, c, d] = adults;
  set(a, { temper: 0.9, kindness: 0.1 });
  set(b, { temper: 0.2, kindness: 0.8, bravery: 0.9 });
  set(c, { temper: 0.2, kindness: 0.8, bravery: 0.2, sociability: 0.9 });
  set(d, { temper: 0.2, kindness: 0.8, bravery: 0.2, sociability: 0.2 });
  const rng = new RNG(4);
  assert.equal(S.exile(L, a, game.day, rng, 'brawling'), 'bandits');
  assert.ok(game.sim.bandits.live().some((band) => band.members.some((m) => m.name.first === a.name.first && m.name.last === a.name.last)));
  assert.equal(S.exile(L, b, game.day, rng, 'theft'), 'adventurer');
  assert.ok(game.sim.adventurers.list.some((q) => q.exile === L.settlement.id && q.name.last === b.name.last));
  assert.equal(S.exile(L, c, game.day, rng, 'theft'), 'nomads');
  assert.ok(game.sim.nomads.bands.some((q) => q.people.some((m) => m.name.first === c.name.first && m.name.last === c.name.last)));
  assert.equal(S.exile(L, d, game.day, rng, 'theft'), 'realm');
  assert.ok(laid(game).some((T) => T !== L && T.npcs.some((r) => r.name.first === d.name.first && r.name.last === d.name.last && alive(r) && !r.migrated)));
  for (const r of [a, b, c]) assert.ok(r.migrated, 'gone from town');
});

// ------------------------------------------------------------ bandits
test('bandits camp in the wilds in tents, rob merchants on the road, and the towns put a price on them', () => {
  const game = world();
  const Bd = game.sim.bandits;
  Bd.start();
  const band = Bd.live()[0];
  assert.ok(band && band.camp && band.members.length >= 3);
  const ow = game.world.ow;
  assert.ok(!ow.settlementAt(band.camp.x, band.camp.z), 'out of town');
  assert.ok(band.camp.ops.some((o) => o[3] === B.tent) && band.camp.ops.some((o) => o[3] === B.campfire));
  // A merchant of a town nearby, out on the road.
  const L = Bd.nearTowns(band)[0];
  const rec = people(L).find((r) => r.age === 'adult') || L.npcs[0];
  rec.traveler = true;
  rec.coins = 50;
  rec.trip = { phase: 'away', goods: { bread: 6 }, dest: 0 };
  assert.equal(Bd.rob(band, game.day, new RNG(1)), rec);
  assert.ok(rec.trip.robbed && rec.coins < 50 && rec.trip.goods.bread < 6);
  assert.ok(L.econ.ledger.some((q) => /robbed on the road/.test(q.text)));
  assert.ok(Bd.bountiesIn(L).some((q) => q.band === band.id));
  assert.match(Bd.talk(L, new RNG(1)).join(' '), /a head/);
  // Bring one down and claim the bounty from the mayor.
  Bd.heads[band.id] = 2;
  const t0 = L.econ.treasury;
  const coins = (inv) => inv.reduce((n, q) => n + (q && q.item === 'coin' ? q.count : 0), 0);
  const c0 = coins(game.player.inv);
  const r = Bd.claim(L);
  assert.ok(r.pay > 0 && L.econ.treasury === t0 - r.pay && coins(game.player.inv) === c0 + r.pay);
});

test('a camp you walk up to: they warn you off, then set on you; one brought down counts toward the bounty', () => {
  const { game, input, p } = start();
  const Bd = game.sim.bandits;
  const band = Bd.live()[0];
  const f = band.camp.fire;
  p.teleport(f.x + 12, GROUND, f.z);
  run(game, input, 40);
  const ents = [...Bd.ents.values()].filter((n) => !n.dead && n.warband.band === band.id);
  assert.ok(ents.length >= 3, 'round the fire');
  assert.ok(ents.every((n) => n.warband.kind === 'bandit' && n.warband.phase === 'camp'));
  p.teleport(f.x + 7, GROUND, f.z);
  run(game, input, 20);
  assert.ok(ents.some((n) => n.warband.warned), 'warned off first');
  let came = false;
  for (let i = 0; i < 80 && !came; i++) {
    run(game, input, 1);
    came = ents.some((n) => n.threat === p);
  }
  assert.ok(came, 'then they come for you');
  const n0 = band.members.length;
  game.damage(ents[0], 999, p);
  assert.ok(ents[0].dead);
  assert.equal(band.members.length, n0 - 1);
  assert.equal(Bd.heads[band.id], 1);
});

test('a realm losing its war may pay a hungry band to fight for it', () => {
  const game = world();
  const Bd = game.sim.bandits;
  Bd.start();
  const band = Bd.live()[0];
  while (band.members.length < 4) band.members.push(Bd.outlaw(new RNG(band.members.length), 'vale'));
  band.loot = 10;
  const [a, b] = game.world.ow.civs;
  game.sim.realms.shift(a, b, -100, game.day);
  const w = game.sim.war.declare(a, b, { k: 'land', text: 'the land' }, game.day, new RNG(1));
  w.score = 40; // b is losing
  const cap = game.sim.realms.capitalOf(b);
  game.world.layouts.get(cap.id).econ.treasury = 600;
  const yes = { chance: () => true, pick: (l) => l[0], int: (x) => x, float: (x) => x, shuffle: (l) => l };
  const h = Bd.hire(band, game.day, yes);
  assert.ok(h && h.civ === b.id && h.side === 'b');
  assert.equal(Bd.hiredFor(w, 'b'), band.members.length);
  const plan = { attacker: 'a', atk: game.world.ow.settlements.find((s) => s.civ === a).id, def: cap.id };
  const pool = game.sim.war.pool(w, 'b', plan);
  const pool0 = { ...pool };
  band.hired = null;
  assert.equal(pool0.extra - game.sim.war.pool(w, 'b', plan).extra, band.members.length, 'fighting in its army');
});

// ------------------------------------------------------------ by raft
test('a realm sends raiders by raft to a town on the water beyond reach by land', () => {
  const game = world();
  const W = game.sim.war;
  const ow = game.world.ow;
  let found = null;
  for (const a of ow.civs) for (const b of ow.civs) if (a !== b && !found && W.seaPairs(a, b, 28).length) found = { a, b, pair: W.seaPairs(a, b, 28)[0] };
  assert.ok(found, 'some realm can reach another by water');
  const [s, o] = found.pair;
  assert.ok((s.coast || s.river || s.lake) && (o.coast || o.river || o.lake));
  assert.ok(Math.hypot(s.cx - o.cx, s.cz - o.cz) > 10);
  const raid = W.planRaid(found.a, found.b, s, o, game.day, new RNG(3), true);
  assert.ok(raid && raid.naval);
  const TL = game.world.layouts.get(o.id);
  const FL = game.world.layouts.get(s.id);
  assert.ok(TL.econ.ledger.some((q) => /Rafts of the/.test(q.text)));
  assert.ok(FL.econ.ledger.some((q) => /put out on rafts/.test(q.text)));
  W.resolveRaid(raid, TL, FL, new RNG(9));
  assert.ok(TL.econ.ledger.some((q) => /ashore by raft/.test(q.text)));
});

test('raiders by raft paddle in off the water and come ashore', () => {
  const { game, input, L } = start(12345, {}, 22 * 60);
  const W = game.sim.war;
  const t = L.settlement;
  const foe = game.world.ow.civs.find((c) => c !== t.civ);
  const src = game.world.ow.settlements.filter((s) => s.civ === foe)[0];
  game.sim.layoutOf(src.id);
  const raid = W.planRaid(foe, t.civ, src, t, game.day, new RNG(3), true);
  raid.at = game.sim.abs;
  W.strike(raid);
  const live = W.live;
  assert.ok(live && live.kind === 'raid' && live.ents.length);
  const ents = live.ents;
  assert.ok(ents.every((n) => n.raft && game.world.isWaterAt(n.x, SURFACE, n.z)), 'on rafts, on the water');
  run(game, input, 150);
  assert.ok(ents.some((n) => !n.warband.land && !n.raft && !game.world.isWaterAt(n.x, SURFACE, n.z)), 'ashore');
});

// ------------------------------------------------------------ markets
test('selling a flood of something drops its price there, and nearby; buying it all up makes it dear', () => {
  const game = world();
  const M = game.sim.market;
  const towns = laid(game);
  const L = towns[0];
  const near = towns.filter((O) => O !== L && Math.hypot(O.settlement.cx - L.settlement.cx, O.settlement.cz - L.settlement.cz) <= 8);
  assert.ok(near.length);
  M.trade(L, 'iron_ingot', 20, 'player');
  assert.ok(M.factor(L, 'iron_ingot') < 0.8);
  M.daily(game.day + 1, new RNG(1));
  assert.ok(near.every((O) => M.level(O, 'iron_ingot') > 0), 'word gets round');
  M.trade(L, 'bread', -30, 'player');
  assert.ok(M.factor(L, 'bread') > 1.2);
  assert.ok(M.notes(L).some((q) => q.k === 'bread' && /dear/.test(q.text)));
  // Left alone, it settles.
  for (let d = 2; d < 40; d++) M.daily(game.day + d, new RNG(d));
  assert.ok(Math.abs(M.level(L, 'bread')) < 0.1 && Math.abs(M.level(L, 'iron_ingot')) < 0.1);
});

test('what traders ask and pay follows the market', () => {
  const { game, L, p } = start();
  const n = game.npcs.find((q) => !q.dead && q.settlement === L.settlement && q.rec.job === 'blacksmith') || game.npcs.find((q) => !q.dead && q.settlement === L.settlement);
  const k = 'iron_ingot';
  const buy0 = game.sim.buyPrice(n, k);
  const sell0 = game.sim.sellPrice(n, k);
  game.sim.market.trade(L, k, 25, 'player');
  assert.ok(game.sim.buyPrice(n, k) < buy0);
  assert.ok(game.sim.sellPrice(n, k) <= sell0);
  game.sim.market.trade(L, k, -60, 'player');
  assert.ok(game.sim.buyPrice(n, k) > buy0);
  void p;
});

test('iron delivered week after week: the town puts up a new smithy', () => {
  const game = world();
  const M = game.sim.market;
  const L = laid(game).find((q) => q.settlement.type !== 'village' && q.buildings.filter((b) => b.type === 'smithy').length < 2);
  L.econ.treasury = 600;
  let got = null;
  for (let d = 1; d < 30 && !got; d++) {
    game.day = d;
    if (d % 2) M.trade(L, 'iron_ingot', 3, 'player');
    M.daily(d, new RNG(d));
    got = L.econ.ledger.find((q) => /new smithy/.test(q.text));
  }
  assert.ok(got, 'a new smithy');
  const queued = (L.econ.buildQueue || []).some((o) => o.type === 'smithy');
  const building = game.sim.works.projects.some((q) => q.sid === L.settlement.id && q.type === 'smithy' && !q.done);
  assert.ok(queued || building);
});

test('one who left to seek their fortune comes home to visit as a merchant', () => {
  const game = world();
  const towns = laid(game);
  const [A] = towns;
  const T = towns.find((q) => q !== A && Math.hypot(q.settlement.cx - A.settlement.cx, q.settlement.cz - A.settlement.cz) < 12);
  const r = people(T).find((q) => q.age === 'adult' && q.job !== 'mayor');
  r.traveler = true;
  r.tier = 'peddler';
  r.coins = 60;
  r.life = { fortune: { home: A.settlement.id, since: 1 } };
  game.day = 30;
  game.sim.departMerchant(T, r, game.sim.abs, game.day, new RNG(1));
  assert.equal(r.trip.dest, A.settlement.id);
  assert.equal(r.life.fortune.back, 30);
  assert.ok(A.econ.ledger.some((q) => /seek their fortune, is coming home/.test(q.text)));
});

// ------------------------------------------------------------ lives
test('careers and hearts: a captain for the watch, a shop of one\'s own, partings, and the gossip of it all', () => {
  const game = world();
  const S = game.sim.society;
  const L = laid(game).find((q) => people(q).filter((r) => r.job === 'guard').length >= 3);
  S.careers(L, game.day, new RNG(1));
  const cap = L.npcs.find((r) => r.life && r.life.rank === 'Captain');
  assert.ok(cap && cap.job === 'guard');
  // An affair found out: a parting, a feud, and talk of it.
  const married = people(L).find((r) => r.age === 'adult' && r.partner !== null && r.partner !== undefined && L.npcs[r.partner]);
  const other = people(L).find((r) => r.age === 'adult' && r !== married && r.idx !== married.partner && r.household !== married.household);
  const spouse = L.npcs[married.partner];
  lifeOf(married).affair = { with: other.idx, since: game.day - 5 };
  assert.ok(gossipLines(L).some((t) => t.includes(married.name.first) && t.includes(other.name.first)));
  const always = { chance: () => true, pick: (l) => l[0], int: (x) => x, float: (x) => x, shuffle: (l) => l };
  S.hearts(L, game.day, always);
  assert.equal(married.partner, null);
  assert.equal(spouse.partner, null);
  assert.ok(L.econ.ledger.some((q) => /parted ways/.test(q.text)));
  assert.ok((L.econ.feuds || []).length);
  assert.ok(gossipLines(L).some((t) => /aren't speaking/.test(t)));
  // A well-off soul opens a shop and runs it.
  const rich = people(L).find((r) => r.age === 'adult' && r.job !== 'mayor' && r.job !== 'guard');
  rich.life = { ...(rich.life || {}), opening: 'tailor' };
  const b = L.buildings.find((q) => q.type === 'tailor') || { id: L.buildings.length, type: 'tailor', name: 'The Tailor', residential: false };
  if (!L.buildings.includes(b)) L.buildings.push({ ...b, x0: 0, z0: 0, x1: 0, z1: 0, work: [], seats: [], beds: [] });
  for (const r of L.npcs) if (r.job === 'tailor' && r.work && r.work.building === b.id) r.work = { kind: 'none' };
  game.sim.onBuilt(L, L.buildings[b.id]);
  assert.equal(rich.job, 'tailor');
  assert.equal(rich.life.owns, b.id);
});

test('people move away for work, for love, for a better mayor, and the town remembers why', () => {
  const game = world();
  const S = game.sim.society;
  const L = laid(game).find((q) => people(q).length > 15);
  // Someone free to go: unattached, out of work, and keen on company.
  const r = people(L).find((q) => q.age === 'adult' && !(q.children || []).length && q.job !== 'mayor' && q.job !== 'guard' && q.ruler === undefined && q.councillor === undefined);
  if (r.partner !== null && r.partner !== undefined && L.npcs[r.partner]) L.npcs[r.partner].partner = null;
  r.partner = null;
  r.job = 'laborer';
  r.personality.sociability = 0.9;
  const n0 = people(L).length;
  for (let d = 1; d < 400 && !(L.econ.departed || []).length; d++) S.moves(L, d, new RNG(d * 7));
  const gone = L.econ.departed || [];
  assert.ok(gone.length, 'someone moved');
  assert.ok(['work', 'love', 'mayor'].includes(gone[0].why));
  assert.ok(people(L).length < n0);
  assert.ok(gossipLines(L).some((t) => t.includes(gone[0].first) || t.includes(gone[0].name.split(' ').slice(-1)[0])));
});

// ------------------------------------------------------------ how a town is doing
test('a thriving town hangs banners and plays a bright tune; a struggling one boards its windows', () => {
  const { game, L } = start();
  const P = game.sim.prosperity;
  L.econ.fortune = 'thriving';
  P.dress(L);
  assert.ok(L.econ.banners.length >= 2);
  assert.ok(L.econ.banners.every(([x, y, z]) => game.world.getBlock(x, y, z) === B.festival_banner));
  assert.match(musicMood(game), /@\w+\.thriving/);
  L.econ.fortune = 'struggling';
  P.dress(L);
  assert.equal(L.econ.banners.length, 0);
  assert.ok(L.econ.boarded.length > 0);
  assert.ok(L.econ.boarded.every(([x, y, z]) => game.world.getBlock(x, y, z) === B.planks));
  assert.match(musicMood(game), /\.struggling/);
  const spots = L.econ.boarded.slice();
  L.econ.fortune = 'steady';
  P.dress(L);
  assert.ok(spots.every(([x, y, z]) => game.world.getBlock(x, y, z) === B.glass), 'the boards come down');
  // The tune: its people's own, darker in hard times.
  const T = flavourTheme({ ...THEMES.town }, 'sun', 'struggling');
  assert.equal(T.scale, 'phrygian');
  assert.ok(T.bpm < THEMES.town.bpm);
  assert.equal(fortuneOf({ econ: { fortune: 'thriving' } }), 'thriving');
});

test('hard times put folk out begging on the square; good times give them work again', () => {
  const game = world();
  const P = game.sim.prosperity;
  const L = laid(game).find((q) => people(q).some((r) => r.job === 'laborer' || r.job === 'farmer'));
  for (const r of people(L)) if (['laborer', 'farmer', 'fisher'].includes(r.job)) r.coins = 2;
  for (let d = 1; d < 40 && !people(L).some((r) => r.job === 'beggar'); d++) P.beggars(L, d, 'struggling');
  const b = people(L).find((r) => r.job === 'beggar');
  assert.ok(b, 'one begging');
  for (let d = 40; d < 80 && b.job === 'beggar'; d++) P.beggars(L, d, 'thriving');
  assert.equal(b.job, 'laborer');
});

// ------------------------------------------------------------ saved
test('bandits, markets, lives and history are kept in a save', () => {
  const { game, L } = start();
  game.sim.bandits.start();
  const band = game.sim.bandits.live()[0];
  game.sim.bandits.heads[band.id] = 2;
  game.sim.market.trade(L, 'iron_ingot', 10, 'player');
  const r = people(L).find((q) => q.age === 'adult');
  lifeOf(r).vice = 'thief';
  lifeOf(r).convictions = 1;
  game.sim.history.add(L, 'Something remarkable happened.', 'event', game.day);
  const g2 = reload(game);
  const L2 = g2.world.layouts.get(L.settlement.id) || g2.sim.layoutOf(L.settlement.id);
  assert.equal(g2.sim.bandits.heads[band.id], 2);
  assert.ok(g2.sim.bandits.get(band.id).camp);
  assert.ok(g2.sim.market.level(L2, 'iron_ingot') > 0.3);
  const r2 = L2.npcs[r.idx];
  assert.equal(r2.life.vice, 'thief');
  assert.equal(r2.life.convictions, 1);
  assert.ok(g2.sim.history.of(L2).entries.some((q) => q.text === 'Something remarkable happened.'));
  void DAY;
});
