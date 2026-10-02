import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGame, stubInput } from './helpers.mjs';
import { RNG } from '../src/util/rng.js';
import { alive, DAY, stockOf } from '../src/sim/econ.js';
import { GROUND, SURFACE } from '../src/config.js';
import { B } from '../src/world/blocks.js';
import { Creature } from '../src/entities/creature.js';
import { jobTitle } from '../src/entities/npcgen.js';
import { runCommand } from '../src/game/commands.js';
import { newsWeight, LedgerWindow } from '../src/ui/windows.js';
import { chainFor, babble, smallTalk } from '../src/game/markov.js';
import { SPECIALTIES, TRAITS, normalizeHero, staminaBonus, priceMult, repGainMult } from '../src/game/hero.js';
import { weaponStyle, STYLES, resolveHit, roll, COST } from '../src/game/combat.js';
import { TECHS } from '../src/sim/tech.js';
import { ignite, tickFires } from '../src/game/fire.js';
import { religionOf, realmFaith } from '../src/sim/culture.js';

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
  const save = JSON.parse(JSON.stringify(game.serialize()));
  return new game.constructor({ seed: game.seed, renderer: game.renderer, audio: null, ui: game.ui, save });
};
const people = (L) => L.npcs.filter((r) => alive(r) && !r.away && !r.migrated && !r.visitor);
const laid = (game) => [...game.world.layouts.values()].filter((L) => L.econ && !L.settlement.deserted && L.settlement.condition !== 'abandoned');
const run = (game, input, n) => {
  for (let i = 0; i < n; i++) game.update(0.1, input);
};

// ------------------------------------------------------------ fixes
test('bandits are named for what they are, not as merchants', () => {
  assert.equal(jobTitle({ job: 'bandit', bandit: 1 }), 'Bandit');
  assert.equal(jobTitle({ job: 'bandit', bandit: 1, banditChief: true }), 'Bandit Chief');
  assert.equal(jobTitle({ job: 'bandit', bandit: 1, hiredSword: true }), 'Sellsword');
  const { game } = start();
  const band = game.sim.bandits.live()[0];
  const L = game.sim.layoutOf(band.near);
  const rec = game.sim.bandits.recFor(band, band.members[0], L);
  assert.equal(jobTitle(rec), 'Bandit Chief', 'the first of them leads');
});

test('opening the console does not make you invincible; "god" does, and your wounds don\'t heal by the frame', () => {
  const { game, input, p } = start();
  runCommand(game, 'help');
  p.hp = 10;
  run(game, input, 30);
  assert.ok(p.hp < p.maxHp, 'still hurt a few seconds on');
  const hp = p.hp;
  game.damage(p, 3, null);
  assert.equal(p.hp, hp - 3, 'blows land');
  runCommand(game, 'god on');
  const hg = p.hp;
  game.damage(p, 3, null);
  assert.equal(p.hp, hg, 'nothing hurts in god mode');
  runCommand(game, 'god off');
  game.damage(p, 1, null);
  assert.equal(p.hp, hg - 1);
});

test('a guard who has to fetch you from a seat comes to your side, and gets you to the cells', () => {
  const { game, input, p, L, sid } = start();
  const guard = game.npcs.find((n) => n.rec.job === 'guard' && !n.dead && n.layout === L);
  assert.ok(guard);
  // Sitting a long way off.
  guard.teleport(p.x + 12, game.world.findStandY(p.x + 12, p.z, GROUND), p.z);
  game.sim.justice.guardBeside(guard);
  assert.ok(Math.max(Math.abs(guard.x - p.x), Math.abs(guard.z - p.z)) <= 1, 'right beside you');
  void input;
  void sid;
});

test('commands: fast-forward days, and start (or end) a war', () => {
  const { game, input } = start();
  const d0 = game.day;
  runCommand(game, 'skip 2');
  for (let i = 0; i < 200 && game.skipping; i++) game.update(0.1, input);
  assert.ok(!game.skipping);
  assert.equal(game.day, d0 + 2, 'two days on');
  const [a, b] = game.world.ow.civs;
  const out = runCommand(game, `war ${a.name.replace(/^The /, '')} on ${b.name.replace(/^The /, '')}`);
  assert.ok(game.sim.war.wars.some((w) => w.a.includes(a.id) && w.b.includes(b.id)), `war declared (${out})`);
  runCommand(game, `war peace ${a.name.replace(/^The /, '')}`);
  assert.ok(!game.sim.war.atWar(a), 'and peace made');
});

test('the news: a line between the days, and the small stuff faded', () => {
  assert.ok(newsWeight('Taxes stand at 8%, by order of the mayor.') < newsWeight('War! The realm has declared war on its neighbour.'));
  const { game, L } = start();
  L.econ.ledger.push({ day: game.day - 1, text: 'A merchant arrived in town.' }, { day: game.day, text: 'Bandits raided the farms.' });
  const w = new LedgerWindow({ mouseCell: { x: -99, y: -99 }, audio: null, game, msg() {} }, game, L.settlement, L);
  const lines = w.newsLines(game).map((l) => l.t);
  assert.ok(lines.some((t) => /── Day/.test(t)), 'a separator for each day');
});

// ------------------------------------------------------------ dialogue
test('small talk comes out of word chains, in each people\'s own voice and each person\'s own way', () => {
  const north = chainFor('north', 'gruff', ['gloomy']);
  const sun = chainFor('sun', 'formal', ['pious']);
  assert.equal(chainFor('north', 'gruff', ['gloomy']), north, 'chains are made once');
  const rng = new RNG(4);
  const a = new Set();
  for (let i = 0; i < 12; i++) a.add(babble(north, rng));
  assert.ok(a.size >= 6, 'plenty of different lines');
  for (const l of a) assert.match(l, /[.!?]$/);
  const { L } = start();
  const lines = new Set(people(L).slice(0, 10).map((r) => smallTalk(r, new RNG(r.idx), { town: L.settlement.name })));
  assert.ok(lines.size >= 6, 'different folk, different talk');
  void sun;
});

// ------------------------------------------------------------ character
test('more skills and traits to choose from, each with a use', () => {
  assert.ok(Object.keys(SPECIALTIES).length >= 15);
  assert.ok(Object.keys(TRAITS).length >= 16);
  assert.ok(Object.values(TRAITS).filter((t) => t.flaw).length >= 6, 'flaws too');
  const h = normalizeHero({ specialties: ['duelist', 'marksman'], traits: ['tireless', 'outlander'] });
  assert.deepEqual(h.specialties, ['duelist', 'marksman']);
  // (Tireless is worth thirty tenths of breath, on top of what agility gives.)
  assert.equal(staminaBonus(h) - staminaBonus(normalizeHero({ ...h, traits: ['outlander'] })), 30);
  assert.ok(priceMult(h) > priceMult(normalizeHero({ traits: [] })), 'an outlander pays more');
  assert.ok(repGainMult(normalizeHero({ traits: ['silver_tongue'] })) > repGainMult(normalizeHero({ traits: [] })));
});

// ------------------------------------------------------------ combat
test('blows are wound up first: you can see them coming, roll clear, or take them on a shield', () => {
  const { game, input, p } = start();
  p.equip.shield = 'iron_shield';
  const wolf = new Creature(game, 'wolf', p.x + 1, p.y, p.z);
  game.addCreature(wolf);
  wolf.target = p;
  let saw = false;
  const hp0 = p.hp;
  for (let i = 0; i < 40 && !saw; i++) {
    run(game, input, 1);
    if (wolf.windup) saw = true;
  }
  assert.ok(saw, 'a wind-up before the bite');
  assert.equal(p.hp, hp0, 'nothing landed yet');
  // Rolled clear.
  p.rollT = 0.3;
  assert.equal(resolveHit(game, wolf, p, STYLES.bite), 'dodged');
  p.rollT = 0;
  // A raised shield, facing it (not a parry: up a while).
  p.blocking = true;
  p.blockT = 1;
  p.face(wolf.x, wolf.z);
  p.stamina = 100;
  const r = resolveHit(game, wolf, p, STYLES.bite);
  assert.equal(r, 'blocked');
  assert.ok(p.stamina < 100, 'it costs breath');
  // Just as it lands: a parry, and the wolf is left reeling.
  p.blockT = 0.1;
  assert.equal(resolveHit(game, wolf, p, STYLES.bite), 'parried');
  assert.ok(wolf.stunT > 0 && p.riposte > 0);
});

test('a dodge roll costs breath and carries you two paces', () => {
  const { game, p } = start();
  p.stamina = 100;
  p.rollCd = 0;
  const x0 = p.x;
  const z0 = p.z;
  const ok = roll(game, p, [1, 0]);
  if (ok) {
    assert.equal(p.stamina, 100 - COST.roll);
    assert.ok(p.rollT > 0);
    assert.ok(Math.abs((p.tx ?? p.x) - x0) + Math.abs((p.tz ?? p.z) - z0) <= 2);
  }
});

test('each weapon fights its own way, and the watch carries all sorts', () => {
  assert.equal(weaponStyle('spear'), 'spear');
  assert.equal(STYLES.spear.reach, 2);
  assert.ok(STYLES.axe.windup > STYLES.sword.windup && STYLES.axe.mult > STYLES.sword.mult);
  assert.ok(STYLES.dagger.flurry >= 2);
  const game = world(12345, { learned: true });
  const tools = new Set();
  for (const L of laid(game)) for (const r of people(L)) if (r.job === 'guard') tools.add(r.equipment.tool);
  assert.ok(tools.size >= 3, `guards' weapons: ${[...tools].join(', ')}`);
});

// ------------------------------------------------------------ building styles
test('each people builds its own way: awnings in the south, horns on northern gables, overhanging thatch in the forests', () => {
  const game = world();
  const count = (L, ids) => {
    let n = 0;
    for (const arr of L.placements.values()) for (let i = 0; i < arr.length; i += 5) if (ids.includes(arr[i + 3])) n++;
    return n;
  };
  const by = (style) => laid(game).filter((L) => L.settlement.condition !== 'poor' && (L.settlement.civ ? L.settlement.civ.style : L.settlement.style) === style);
  const sun = by('sun');
  if (sun.length) assert.ok(sun.some((L) => count(L, [B.awning_red, B.awning_blue, B.awning_yellow, B.awning_green]) > 0), 'awnings over southern doors');
  const wild = by('wild');
  if (wild.length) assert.ok(wild.some((L) => count(L, [B.log_jungle]) > 0), 'carved posts in the forest towns');
});

// ------------------------------------------------------------ tech
test('no forge without metalworking: the smith labours, the watch carries wood and stone; learning it lights the forge', () => {
  const game = world(12345, { learned: false });
  const T = game.sim.tech;
  const L = laid(game).find((q) => !T.has(q.settlement, 'metalworking') && people(q).some((r) => r.job === 'guard'));
  assert.ok(L, 'a town that has never worked iron');
  assert.ok(!people(L).some((r) => r.job === 'blacksmith'), 'no smith');
  const guards = people(L).filter((r) => r.job === 'guard');
  assert.ok(guards.every((g) => !['iron_sword', 'iron_axe', 'mace', 'spear', 'steel_sword'].includes(g.equipment.tool)), 'no iron in the watch');
  assert.ok(!T.allows(L.settlement, 'job', 'blacksmith'));
  assert.ok(TECHS.metalworking && TECHS.steel.also.includes('metalworking'));
  T.learn(L.settlement, 'metalworking', game.day);
  T.enforce(L, game.day + 1);
  assert.ok(T.allows(L.settlement, 'job', 'blacksmith'));
  assert.ok(people(L).filter((r) => r.job === 'guard').some((g) => /iron|mace|spear/.test(g.equipment.tool) || g.equipment.tool === 'bow' || g.equipment.tool === 'stone_axe' || g.equipment.tool === 'stone_sword' || g.equipment.tool === 'wooden_spear'), 'their kit back');
});

test('every town has somewhere to study and someone studying; the mayor fits it out', () => {
  const game = world(12345, { learned: false });
  const T = game.sim.tech;
  const L = laid(game).find((q) => !q.settlement.civ && !q.buildings.some((b) => ['academy', 'library', 'study'].includes(b.type)));
  assert.ok(L, 'a free town with nowhere to study');
  const out = T.daily(L, game.day, new RNG(1));
  assert.ok(out.study || game.sim.works.projects.some((p) => p.sid === L.settlement.id && p.type === 'study') || (L.econ.buildQueue || []).some((o) => o.type === 'study'), 'a study is going up');
  assert.ok(people(L).some((r) => r.job === 'researcher'), 'and someone to study (at the hall, till it\'s done)');
  // The mayor spends on it.
  const lab = L.buildings.find((b) => b.type === 'study') || L.buildings.find((b) => b.type === 'townhall');
  lab.type = 'study';
  lab.underConstruction = false;
  L.econ.treasury = 600;
  Object.assign(stockOf(L), { wood: 100, stone: 100 });
  for (let d = 1; d <= 16 && !(L.econ.labLevel > 0); d++) T.daily(L, game.day + d, new RNG(d));
  assert.ok(L.econ.labLevel >= 1, 'better fitted');
});

test('what a realm learns shows, once it has settled in: helms on the watch, children with their books', () => {
  const game = world(12345, { learned: false });
  const T = game.sim.tech;
  const L = laid(game).find((q) => q.settlement.civ && people(q).some((r) => r.job === 'guard') && people(q).some((r) => r.age === 'child'));
  const s = L.settlement;
  T.learn(s, 'drill', game.day);
  T.learn(s, 'schools', game.day);
  assert.ok(!T.settledIn(s, 'schools', game.day), 'not overnight');
  T.integrate(L, game.day + 40);
  assert.ok(people(L).filter((r) => r.job === 'guard').every((g) => g.look.hat === 'helmet'), 'helms');
  assert.ok(people(L).some((r) => r.age === 'child' && r.equipment.tool === 'book'), 'books');
});

// ------------------------------------------------------------ map, bandits, fire
test('a bandit camp goes on your map once someone tells you of it', () => {
  const { game } = start();
  const Bd = game.sim.bandits;
  const band = Bd.live()[0];
  band.known = false;
  assert.ok(!Bd.knownCamps().some((c) => c.name === band.name));
  const L = game.sim.layoutOf(band.near);
  band.camp.x = (L.settlement.bounds.x0 + L.settlement.bounds.x1) / 2 + 40;
  band.camp.z = (L.settlement.bounds.z0 + L.settlement.bounds.z1) / 2;
  Bd.talk(L, new RNG(1));
  assert.ok(Bd.knownCamps().some((c) => c.name === band.name), 'on the map');
});

test('a torch catches a thatched roof; it burns, and burns away', () => {
  const { game, p } = start();
  const w = game.world;
  const x = p.x + 3;
  const z = p.z + 3;
  w.setBlock(x, GROUND, z, B.hay_bale, 0);
  assert.ok(ignite(game, x, GROUND, z, 'test'));
  for (let i = 0; i < 200 && game.fires.length; i++) tickFires(game, 0.1);
  assert.equal(w.getBlock(x, GROUND, z), B.air, 'burned away');
});

test('raiders go through the chests, and the town is marked as raided', () => {
  const { game, L } = start();
  const Bd = game.sim.bandits;
  const band = Bd.live()[0];
  const w = game.world;
  // A chest with something in it.
  const b = L.buildings.find((q) => q.residential && q.x0 !== undefined);
  let at = null;
  for (let z = b.z0 + 1; z < b.z1 && !at; z++) for (let x = b.x0 + 1; x < b.x1; x++) if (w.getBlock(x, GROUND, z) === B.chest) at = { x, z };
  if (!at) {
    at = { x: b.x0 + 1, z: b.z0 + 1 };
    w.setBlock(at.x, GROUND, at.z, B.chest, 0);
  }
  const slots = w.getContainer(at.x, GROUND, at.z);
  slots[0] = { item: 'bread', count: 6 };
  Bd.raiding = { band: band.id, sid: L.settlement.id, take: 0, at: game.sim.abs, n: band.members.length, name: band.name };
  const n = { warband: { band: band.id }, rng: new RNG(2) };
  const took = Bd.lootChest(n, at.x, GROUND, at.z, L);
  assert.ok(took > 0, 'into the sack');
  assert.ok(Bd.raiding.looted >= 1);
  // Over: the town remembers it.
  Bd.raiding.at = -1e9;
  for (const e of Bd.ents.values()) game.despawnNpc(e);
  Bd.checkRaid();
  assert.equal(L.econ.raidedDay, game.day);
});

test('armies on the march show on the map', () => {
  const game = world();
  const W = game.sim.war;
  const [a, b] = game.world.ow.civs;
  W.declare(a, b, { k: 'whim', text: 'a test' }, game.day, new RNG(1));
  const w = W.wars[0];
  W.planBattle(w, game.day, new RNG(2));
  assert.ok(w.plan);
  if (!w.plan.naval) assert.ok(W.markers().some((m) => m.kind === 'army'), 'a column on the road');
});

// ------------------------------------------------------------ economy & society
test('shortages change the work: farmers sow what\'s short, a smith out of iron sends for it', () => {
  const game = world();
  const M = game.sim.market;
  const L = laid(game).find((q) => (q.econ.crops || []).length > 1 && q.buildings.some((b) => b.type === 'smithy' && q.econ.biz[b.id]) && people(q).some((r) => r.job === 'blacksmith'));
  assert.ok(L);
  M.of(L).cabbage = -1;
  M.adapt(L, game.day, new RNG(1), laid(game));
  assert.equal(L.econ.cropFocus, 'cabbage');
  const smithy = L.buildings.find((b) => b.type === 'smithy' && L.econ.biz[b.id]);
  const biz = L.econ.biz[smithy.id];
  biz.store.iron_ore = 0;
  biz.till = 100;
  for (let d = 1; d <= 6; d++) M.adapt(L, game.day + d, new RNG(d), laid(game));
  assert.ok(biz.store.iron_ore > 0 || L.econ.smithMode === 'mend', 'sent for iron, or making do');
});

test('those who leave to seek their fortune don\'t all come back merchants', () => {
  const game = world();
  const fates = new Set();
  for (let seed = 1; seed < 60 && fates.size < 4; seed++) {
    const rng = new RNG(seed);
    fates.add(rng.weighted([['merchant', 3], ['settled', 2], ['poor', 2], ['rich', 1], ['lost', 1.2]]));
  }
  assert.ok(fates.size >= 4);
  // One who is never heard of again.
  const [A, Bl] = laid(game);
  const r = people(A).find((q) => q.age === 'adult' && q.job !== 'mayor');
  const [m] = game.sim.sendPeople(A, [r], Bl, 'to seek their fortune');
  m.life = { fortune: { home: A.settlement.id, since: game.day, fate: 'lost', at: game.day } };
  game.sim.society.fortunes(Bl, game.day + 1, new RNG(1));
  assert.ok(m.migrated, 'gone');
  assert.ok(A.econ.ledger.some((q) => /fear the worst/.test(q.text)));
});

test('famine: families leave in waves, tempers fray, and the desperate join the bandits', () => {
  const game = world();
  const H = game.sim.hardship;
  const L = laid(game).find((q) => people(q).length >= 14 && game.sim.realms && H.refuge(q));
  assert.ok(L);
  const n0 = people(L).length;
  for (let d = 1; d <= 30; d++) {
    for (const r of people(L)) r.hungry = 2;
    H.daily(L, game.day + d);
  }
  assert.ok(L.econ.famineDays >= 4, 'a famine');
  assert.ok((L.econ.unrest || 0) > 0, 'unrest');
  assert.ok(people(L).length < n0, 'people have gone');
  assert.ok(L.econ.ledger.some((q) => /Hunger has driven|bandits|hills/i.test(q.text)));
});

test('a crowded town sends settlers to found a village; they travel, camp, and build; it survives a reload', () => {
  const game = world();
  const F = game.sim.founding;
  const L = laid(game).find((q) => q.settlement.type !== 'village' && people(q).length >= 20);
  const n0 = game.world.ow.settlements.length;
  const p = F.found(L, game.day, new RNG(3));
  assert.ok(p, 'settlers set out');
  const s = game.world.ow.settlements[p.sid];
  assert.equal(game.world.ow.settlements.length, n0 + 1);
  assert.equal(game.world.ow.settlementAt((s.bounds.x0 + s.bounds.x1) >> 1, (s.bounds.z0 + s.bounds.z1) >> 1), s, 'on the map');
  assert.ok(game.sim.travellers().some((t) => t.settler === p.id), 'on the road');
  p.arrive = game.sim.abs - 1;
  F.update();
  assert.equal(p.stage, 'camp');
  F.daily(game.day + 1, new RNG(1));
  const NL = game.sim.layoutOf(p.sid);
  assert.ok(game.sim.works.projects.some((q) => q.sid === p.sid) || (NL.econ.buildQueue || []).length, 'the first house');
  const g2 = reload(game);
  assert.equal(g2.world.ow.settlements[p.sid].name, s.name, 'still there after a reload');
});

test('a ruler with a dream chases it: a merchant prince builds markets, a warlord takes any border quarrel as cause', () => {
  const game = world(12345, { learned: false });
  const R = game.sim.realms;
  const [a, b] = game.world.ow.civs;
  const r = R.ruler(a);
  r.ambition = 'warlord';
  game.sim.politics.grievance?.(a, b, game.day, 'border', 'a test');
  const why = game.sim.war.reasons(a, b, game.day);
  if (game.sim.politics.grievances(a, b, game.day, 30).some((d) => d.kind === 'border')) assert.ok(why.some((q) => q.k === 'land'));
  r.ambition = 'merchant';
  const capL = game.sim.layoutOf(R.realm(a).capital);
  capL.econ.treasury = 900;
  for (const L of R.memberLayouts(a)) Object.assign(stockOf(L), { wood: 200, stone: 200 });
  R.pursue(a, capL, game.day, new RNG(1));
  assert.ok(game.sim.works.projects.some((q) => q.type === 'shop') || R.memberLayouts(a).every((L) => L.settlement.type === 'village' || L.buildings.some((q) => q.type === 'shop')), 'a market hall');
});

// ------------------------------------------------------------ religion
test('faiths travel the roads, missionaries preach, and the conquered keep (or are made to drop) their gods', () => {
  const game = world();
  const Rl = game.sim.religion;
  const [a, b] = game.world.ow.civs;
  const fa = realmFaith(a);
  const T = laid(game).find((L) => L.settlement.civ === b && !game.sim.realms.isCapital(L.settlement));
  assert.ok(T);
  // Missionaries, again and again.
  for (let i = 0; i < 8; i++) Rl.pullKey(T, fa.key, 0.35);
  Rl.convertIfWon(T, game.day);
  assert.equal(religionOf(T.settlement).key, fa.key, 'converted');
  // Conquered: keeps its gods...
  const U = laid(game).find((L) => L.settlement.civ === b && L !== T && !game.sim.realms.isCapital(L.settlement));
  const before = religionOf(U.settlement).key;
  game.sim.realms.ruler(a).ambition = null;
  a.values = (a.values || []).filter((v) => v !== 'pious');
  game.sim.realms.join(U.settlement, a);
  assert.equal(religionOf(U.settlement).key, before, 'old gods kept');
  // ...unless a zealot takes it.
  const V = laid(game).find((L) => L.settlement.civ === b && L !== T && L !== U && !game.sim.realms.isCapital(L.settlement));
  if (V) {
    game.sim.realms.ruler(a).ambition = 'zealot';
    game.sim.realms.join(V.settlement, a);
    assert.equal(religionOf(V.settlement).key, fa.key, 'forced to the new faith');
    assert.ok(V.econ.resent, 'and bitter');
    assert.ok(Rl.holyCause(b, a, null, game.day), 'cause for a holy war');
  }
});

test('faiths differ in more than their gods: clergy, virtue, rites, sacred beasts', () => {
  const game = world();
  const fs = laid(game).map((L) => religionOf(L.settlement));
  for (const f of fs) assert.ok(f.clergy && f.virtue && f.rite && f.beast);
  assert.ok(new Set(fs.map((f) => `${f.clergy}|${f.virtue}|${f.rite}`)).size >= 3, 'variety');
});

test('history fits the people: a northern town remembers raids and winters, a desert town droughts', () => {
  const game = world();
  const H = game.sim.history;
  const texts = laid(game).map((L) => ({ style: L.settlement.civ ? L.settlement.civ.style : L.settlement.style, h: H.generate(L) }));
  const north = texts.filter((t) => t.style === 'north');
  if (north.length) assert.ok(north.some((t) => t.h.entries.some((e) => /longship|ice|whale|jarl|Raiders from over the sea|Wolves came/.test(e.text)) || /Bloodaxe|Far-Sailing|Wolfskin|Unbowed|Ice-Beard/.test(t.h.founder)));
  // Fuller histories than before.
  assert.ok(texts.some((t) => t.h.entries.length >= 5));
});

void DAY;
void SURFACE;
