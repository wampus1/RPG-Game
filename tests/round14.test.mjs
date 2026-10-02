import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGame, stubInput } from './helpers.mjs';
import { B } from '../src/world/blocks.js';
import { DAY, alive, tickHour } from '../src/sim/econ.js';
import { lawOn } from '../src/sim/laws.js';
import { formOf, rulerTitle, shortTitle } from '../src/sim/realms.js';
import { reachWith } from '../src/sim/roads.js';
import { settlementIcons } from '../src/ui/windows.js';
import { topicsFor, respond } from '../src/game/dialogue.js';
import { makeAdventurer } from '../src/entities/npcgen.js';
import { RNG } from '../src/util/rng.js';
import { raids } from '../src/sim/life.js';

function start(seed = 7, minute = 9 * 60) {
  const game = makeGame(seed);
  const input = stubInput();
  game.minute = minute;
  for (let i = 0; i < 20; i++) game.update(0.1, input);
  const [sid, a] = [...game.active][0];
  return { game, input, sid, a, L: a.layout, p: game.player };
}

// (As the game loads a save: a new game from it.)
const reload = (game) => {
  const data = JSON.parse(JSON.stringify(game.serialize()));
  return new game.constructor({ seed: data.seed, renderer: game.renderer, audio: null, ui: game.ui, save: data });
};

// An adventurer brought to the town you're in, and met there.
function advHere(game, sid, input, level = null) {
  const A = game.sim.adventurers;
  A.start();
  const adv = level ? A.list.find((a) => a.level === level) || A.list[0] : A.list[0];
  adv.state = 'road';
  adv.dest = sid;
  adv.at = null;
  adv.arrive = game.sim.abs - 1;
  for (let i = 0; i < 12; i++) game.update(0.25, input);
  return { adv, ent: A.ents.get(adv.id) };
}

test('every town has its notice board on the square', () => {
  for (const seed of [1, 12345, 99]) {
    const game = makeGame(seed);
    for (const s of game.world.ow.settlements) {
      const L = game.world.getLayout(s);
      const board = L.signs.find((q) => q.kind === 'board');
      assert.ok(board, `${s.name} (seed ${seed}) has a notice board`);
      const p = L.plaza;
      assert.ok(board.x >= p.x0 && board.x <= p.x1 && board.z >= p.z0 && board.z <= p.z1, 'on the square');
    }
  }
});

test('the map: a town spreads into the squares its streets reach, and a place that has grown shows its bigger mark', () => {
  const game = makeGame(12345);
  // (A village with open land to its east, for its streets to reach.)
  const open = (q) => {
    const c = game.world.ow.cell(q.cx + 1, q.cz);
    return c && c.settlement === null && c.biome !== 'ocean';
  };
  const s = game.world.ow.settlements.find((q) => q.type === 'village' && open(q)) || game.world.ow.settlements.find((q) => q.type === 'village');
  const cells = (q) => [...settlementIcons(game)].filter(([, v]) => v.s === q).map(([k]) => k);
  assert.equal(cells(s).length, 1, 'a village: its one square');
  // Grown into a city: its city mark, on open ground beside it (round 24:
  // a grown town reads as what it is now, streets or no).
  s.baseType = 'village';
  s.type = 'city';
  assert.ok(cells(s).length > 1, 'a city now');
  // A street runs into the square next door: it's part of the town.
  const east = s.cx + 1;
  const ok = game.world.ow.cell(east, s.cz) && game.world.ow.cell(east, s.cz).settlement === null;
  if (ok) {
    reachWith(s, [[(east) * 64 + 3, s.cz * 36 + 10]]);
    assert.ok(cells(s).includes(s.cz * 10000 + east), 'it shows there');
  }
  // It's remembered in a save.
  const g2 = reload(game);
  assert.deepEqual(g2.world.ow.settlements[s.id].reach || null, s.reach || null);
});

test('saves keep birthdays and grey hair', () => {
  const { game, sid } = start();
  const L = game.sim.layoutOf(sid);
  game.sim.civicDay(L, game.day, new RNG(1));
  const r = L.npcs.find((q) => alive(q) && q.age === 'adult' && q.job === 'blacksmith') || L.npcs.find((q) => alive(q) && q.age === 'adult' && q.job !== 'mayor');
  r.born = game.day - 200;
  game.sim.civicDay(L, game.day, new RNG(2));
  assert.equal(r.age, 'elder');
  const g2 = reload(game);
  const r2 = g2.sim.layoutOf(sid).npcs[r.idx];
  assert.equal(r2.born, r.born);
  assert.equal(r2.elderSince, r.elderSince);
  assert.equal(r2.look.hair, r.look.hair);
  assert.ok(r2.look.stoop);
});

test('realms: a ruler in the largest city, with a title that fits the realm', () => {
  const { game } = start();
  const R = game.sim.realms;
  for (const civ of game.world.ow.civs) {
    const cap = R.capitalOf(civ);
    assert.ok(cap && cap.civ === civ);
    const members = R.members(civ);
    const cities = members.filter((s) => s.type === 'city');
    if (cities.length) assert.equal(cap.type, 'city');
    const L = game.sim.layoutOf(cap.id);
    game.sim.civicDay(L, game.day, new RNG(3));
    const ruler = R.ruler(civ);
    assert.ok(ruler, `${civ.name} has a ruler`);
    assert.equal(ruler.ruler, civ.id);
    assert.ok(L.npcs.includes(ruler), 'who lives in the capital');
    assert.ok(R.rulerName(civ).startsWith(shortTitle(civ)));
    assert.ok(['monarch', 'council', 'elder'].includes(formOf(civ)));
    if (formOf(civ) === 'council') assert.equal(R.realm(civ).council.length, 2);
  }
  assert.equal(formOf({ name: 'The Ashford Jarldom' }), 'monarch');
  assert.equal(rulerTitle({ name: 'The Ashford Jarldom' }), 'Jarl');
  assert.equal(formOf({ name: 'Free Cities of Zar' }), 'council');
  assert.equal(formOf({ name: 'The Oak Shire' }), 'elder');
  assert.equal(rulerTitle({ name: 'The Oak Shire' }), 'High Elder');
});

test('realms: rulers die like anyone, and someone succeeds them', () => {
  const { game } = start();
  const R = game.sim.realms;
  const civ = game.world.ow.civs[0];
  const L = game.sim.layoutOf(R.capitalOf(civ).id);
  const day = game.day;
  game.sim.civicDay(L, day, new RNG(3));
  const old = R.ruler(civ);
  game.sim.recordDeath(L, old, 'old age', null, day);
  game.sim.civicDay(L, day + 1, new RNG(4));
  const next = R.ruler(civ);
  assert.ok(next && next !== old, 'a new ruler');
  assert.ok(L.econ.ledger.some((l) => l.text.includes(`${old.name.first} ${old.name.last} is dead`)));
  // Word goes round the whole realm.
  const other = R.memberLayouts(civ).find((q) => q !== L);
  if (other) assert.ok(other.econ.ledger.some((l) => l.text.includes('is dead')));
});

test('realms: towns pay tribute to the capital, and the capital helps its poorer towns', () => {
  const { game } = start();
  const R = game.sim.realms;
  const civ = game.world.ow.civs.find((c) => R.members(c).length >= 2);
  const capS = R.capitalOf(civ);
  const capL = game.sim.layoutOf(capS.id);
  const town = game.sim.layoutOf(R.members(civ).find((s) => s !== capS).id);
  // Tribute: a share of the morning's taxes.
  town.econ.taxY = 100;
  town.econ.treasury = 500;
  const before = capL.econ.treasury;
  const n = R.tribute(town, game.day);
  assert.equal(n, Math.floor(100 * R.realm(civ).share));
  assert.equal(capL.econ.treasury, before + n);
  assert.equal(town.econ.treasury, 500 - n);
  // Aid: a town with an empty treasury and the watch unpaid gets help.
  capL.econ.treasury = 2000;
  town.econ.treasury = 0;
  town.econ.unpaid = 2;
  const got = R.aid(civ, capL, game.day + 2);
  assert.ok(got && got.sid === town.settlement.id, JSON.stringify(got));
  assert.ok(capL.econ.treasury < 2000);
  assert.ok(town.econ.ledger.some((l) => /sent/.test(l.text) || /paying for/.test(l.text)));
});

test('realms: decrees every town keeps (a least tax, a weapons ban)', () => {
  // (Seed 1: a village that belongs to a realm.)
  const { game, sid } = start(1);
  const R = game.sim.realms;
  const L = game.sim.layoutOf(sid);
  const civ = L.settlement.civ;
  const realm = R.realm(civ);
  realm.decrees.taxFloor = 0.1;
  L.econ.tax = 0.04;
  R.daily(L, game.day, new RNG(1));
  assert.equal(L.econ.tax, 0.1);
  // The mayor can't lower it below the floor either.
  L.econ.treasury = 99999;
  for (let h = 0; h < 3; h++) tickHour(game.sim, L, (game.day + 1 + h) * DAY + 10 * 60);
  assert.ok(L.econ.tax >= 0.1 - 1e-9, `tax ${L.econ.tax}`);
  // A realm-wide weapons ban applies whatever the town's own laws say.
  L.econ.laws.armsBan = false;
  realm.decrees.armsBan = false;
  assert.equal(lawOn(L, 'armsBan'), false);
  realm.decrees.armsBan = true;
  assert.equal(lawOn(L, 'armsBan'), true);
  // Decreed from the capital when there's trouble across the realm.
  realm.decrees.armsBan = false;
  const capL = game.sim.layoutOf(realm.capital);
  game.sim.civicDay(capL, game.day, new RNG(1));
  for (const T of R.memberLayouts(civ)) T.econ.recent.violence = 5;
  assert.equal(R.decree(civ, game.day + 1, new RNG(1)), 'armsBan');
  assert.ok(realm.decrees.armsBan);
});

test('relations between realms: hostility brings tariffs, refusals and wary merchants', () => {
  const { game } = start();
  const R = game.sim.realms;
  const [a, b] = game.world.ow.civs;
  // (A realm that trades freely never sets tariffs: this one doesn't.)
  game.sim.tech.cheat = false;
  game.sim.tech.stateOf(a).done = game.sim.tech.stateOf(a).done.filter((k) => k !== 'free_trade');
  const r = R.relation(a, b);
  assert.ok(['friendly', 'wary', 'hostile'].includes(r.standing));
  R.shift(a, b, -200, game.day);
  assert.equal(R.standing(a, b), 'hostile');
  const aL = game.sim.layoutOf(R.capitalOf(a).id);
  assert.ok(aL.econ.ledger.some((l) => /hostile/.test(l.text)), 'the news goes round');
  // The ruler puts a tariff on the other realm's merchants.
  game.sim.civicDay(aL, game.day, new RNG(1));
  let got = null;
  for (let d = 0; d < 3 && got !== 'tariff'; d++) got = R.decree(a, game.day + d, new RNG(d));
  assert.equal(got, 'tariff');
  const bs = R.members(b)[0];
  assert.ok(R.tariffOn(R.capitalOf(a), bs));
  // A merchant of b trading in a's capital pays it.
  const goods = { cloth: 3 };
  const v = { id: 'vt', from: bs.id, fromName: bs.name, goods, arrive: game.sim.abs, leave: game.sim.abs + 600, coins: 10, earned: 0, tier: 1 };
  const t0 = aL.econ.treasury;
  const shop = aL.buildings.find((q) => q.type === 'shop');
  if (shop) aL.econ.biz[shop.id].till = 500;
  game.sim.visitTrade(aL, v, new RNG(1));
  if (v.earned > 0) assert.ok(aL.econ.treasury > t0, 'the tariff went to the treasury');
  // A letter across the border is refused.
  const dip = game.sim.diplomacy;
  const q = { id: 99, from: bs.id, to: R.capitalOf(a).id, kind: 'trade', payload: {}, day: game.day, status: 'carried' };
  dip.deliver(q);
  assert.ok(aL.econ.ledger.some((l) => /refused/.test(l.text)));
  // Trade and good treatment warm things again, in time.
  const before = r.score;
  R.noteTrade(bs, R.capitalOf(a), 500);
  R.relationsDaily(game.day + 5);
  assert.ok(r.score > before);
  // Relations are kept in a save.
  const g2 = reload(game);
  assert.equal(g2.sim.realms.standing(g2.world.ow.civs[0], g2.world.ow.civs[1]), R.standing(a, b));
});

test('adventurers: well armed, better yet when renowned', () => {
  const lo = makeAdventurer(new RNG(1), 'vale', 1);
  const hi = makeAdventurer(new RNG(2), 'vale', 3);
  assert.ok(hi.gear.weapon.includes('+'), 'a jewelled blade');
  assert.ok(Object.values(hi.gear.wear).some((k) => k.includes('+')) || (hi.gear.bow || '').includes('+'), 'and more');
  assert.ok(hi.maxHp > lo.maxHp && hi.dodge > lo.dodge && hi.deflect > lo.deflect);
  assert.ok(lo.maxHp >= 30, 'far tougher than townsfolk');
});

test('adventurers: they come to town, pitch a tent, trade, and move on', () => {
  const { game, sid, input, L } = start();
  const { adv, ent } = advHere(game, sid, input);
  assert.equal(adv.state, 'stay');
  assert.equal(adv.at, sid);
  const camp = game.sim.camps.get(`a:${adv.id}`);
  assert.ok(camp && camp.ops.some((o) => o[3] === B.tent));
  assert.ok(L.econ.ledger.some((l) => /pitched a tent outside town/.test(l.text)));
  assert.ok(adv.lastTrade, 'did their business');
  assert.ok(ent && !ent.dead, 'someone you can meet');
  assert.ok(/Adventurer/.test(ent.title));
  // A deed for the day.
  const kind = game.sim.adventurers.deed(adv, L, game.day, new RNG(5));
  assert.ok(['hunt', 'bread', 'spar', 'tales'].includes(kind));
  // Time's up: tent struck, on the road again.
  adv.leave = game.sim.abs - 1;
  game.sim.adventurers.update();
  assert.equal(adv.state, 'road');
  assert.notEqual(adv.dest, sid);
  assert.equal(game.sim.camps.get(`a:${adv.id}`), null);
  // Saved and loaded with everything else.
  const g2 = reload(game);
  assert.equal(g2.sim.adventurers.get(adv.id).dest, adv.dest);
});

test('adventurers: a hard fight (dodges, turned arrows, their stones)', () => {
  const { game, sid, input, p } = start();
  const { ent } = advHere(game, sid, input, 3);
  let dodged = 0;
  for (let i = 0; i < 60; i++) {
    ent.dodgeCd = 0;
    ent.moveT = 1;
    const hp = ent.hp;
    game.damage(ent, 1, p);
    if (ent.hp === hp) dodged++;
  }
  assert.ok(dodged >= 10, `dodged ${dodged} of 60`);
  assert.equal(ent.threat, p, 'and fights back');
  let turned = 0;
  for (let i = 0; i < 40; i++) {
    const hp = ent.hp;
    game.shoot(p, ent, 1);
    game.updateProjectiles(5);
    if (ent.hp === hp) turned++;
  }
  assert.ok(turned >= 8, `turned ${turned} of 40 arrows aside`);
  // Their stone, called up in earnest.
  p.x = ent.x + 1;
  p.z = ent.z;
  const php = p.hp;
  ent.hp = Math.min(ent.hp, Math.floor(ent.maxHp * 0.5));
  assert.ok(ent.useArt(p));
  assert.ok(p.hp < php || ent.hp > Math.floor(ent.maxHp * 0.5) || p.stunT > 0 || p.slowT > 0 || p.burnT > 0);
});

test('adventurers: beaten by one, you\'re spared (not jailed); kill one and their gear is yours', () => {
  const { game, sid, input, p } = start();
  const { ent, adv } = advHere(game, sid, input);
  p.inv.push({ item: 'coin', count: 40 });
  p.hp = 2;
  game.damage(p, 10, ent);
  assert.ok(!p.dead && p.hp === 1);
  assert.ok(!game.sim.justice.jail, 'no cell for it');
  assert.ok(game.ui.msgs.some((m) => /let you live/.test(m)));
  // And the other way round.
  const drops = [];
  const sd = game.spawnDrop.bind(game);
  game.spawnDrop = (k, n, ...rest) => {
    drops.push(k);
    return sd(k, n, ...rest);
  };
  game.kill(ent, p);
  assert.ok(drops.includes(adv.gear.weapon), 'their weapon');
  assert.ok(Object.values(adv.gear.wear).every((k) => drops.includes(k)), 'their armour');
  assert.ok(adv.dead);
});

test('adventurers: a friendly bout for a wager is no crime', () => {
  const { game, sid, input, p } = start();
  const { ent } = advHere(game, sid, input);
  p.inv.push({ item: 'coin', count: 60 });
  game.startDuel(ent, 25);
  for (let i = 0; i < 300 && game.duel; i++) {
    ent.dodgeCd = 5;
    game.damage(ent, 3, p);
  }
  assert.ok(!game.duel, 'the bout is over');
  assert.ok(!ent.dead && ent.hp >= 1);
  assert.ok(!game.isWanted(sid), 'nobody calls the guard');
  assert.ok(game.ui.msgs.some((m) => /You won the bout/.test(m)));
});

test('adventurers: a citizen is a local to them, a wanderer one of their own', () => {
  const { game, sid, input, L } = start();
  const { ent, adv } = advHere(game, sid, input);
  const ids = () => topicsFor(ent, game).map((t) => t.id);
  assert.ok(ids().includes('adv_duel') && ids().includes('adv_swap') && !ids().includes('adv_guard'));
  const r = respond(ent, game, 'adv_swap');
  assert.ok(r.lines.length >= 1);
  game.sim.citizen = { sid, home: null, host: null, day: game.day };
  assert.ok(ids().includes('adv_guard') && !ids().includes('adv_duel'));
  game.player.inv.push({ item: 'coin', count: 40 });
  respond(ent, game, 'adv_guard');
  assert.equal(adv.guard, sid);
  assert.ok(L.econ.ledger.some((l) => /standing watch/.test(l.text)));
  // Trading from their pack.
  const sh = game.sim.shopOf(ent);
  assert.equal(sh.kind, 'adventurer');
  assert.equal(sh.store, adv.pack);
});

test('adventurers staying in a town see off beasts in the night', () => {
  const { game } = start();
  const A = game.sim.adventurers;
  A.start();
  const far = game.world.ow.settlements.find((s) => !game.active.has(s.id) && s.condition !== 'abandoned' && !s.deserted);
  const L = game.sim.layoutOf(far.id);
  const adv = A.list[0];
  adv.state = 'stay';
  adv.at = far.id;
  adv.guard = far.id;
  adv.leave = game.sim.abs + 600;
  const always = { chance: () => true, pick: (a) => a[0], int: (a) => a, float: (a) => a, next: () => 0, shuffle: (a) => a };
  const res = raids(game.sim, L, game.day, always);
  assert.ok(res && res.driven && res.by === adv);
  assert.ok(L.econ.ledger.some((l) => /an adventurer staying in town, drove/.test(l.text)));
});
