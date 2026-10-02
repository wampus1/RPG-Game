import test from 'node:test';
import assert from 'node:assert/strict';
import { lotsReady, makeGame, stubInput } from './helpers.mjs';
import { World } from '../src/world/world.js';
import { Overworld } from '../src/world/worldgen.js';
import { simulateTo, alive, kitchenOf, st, DAY } from '../src/sim/econ.js';
import { topicsFor, respond } from '../src/game/dialogue.js';
import { B } from '../src/world/blocks.js';
import { countItem } from '../src/game/inventory.js';

function town(game) {
  const [sid, a] = [...game.active][0];
  return { sid, a, L: a.layout };
}

function warm(game, minute = 12 * 60, steps = 20) {
  const input = stubInput();
  game.minute = minute;
  for (let i = 0; i < steps; i++) game.update(0.1, input);
  return input;
}

test('settlements are spaced out, and every one has a graveyard, a jail and signs', () => {
  const ow = new Overworld(4242);
  const s = ow.settlements;
  for (let i = 0; i < s.length; i++) {
    for (let j = i + 1; j < s.length; j++) {
      const d = Math.hypot(s[i].cx + s[i].cw / 2 - s[j].cx - s[j].cw / 2, (s[i].cz + s[i].cd / 2 - s[j].cz - s[j].cd / 2) * 1.5);
      assert.ok(d > 3.5, `${s[i].name} and ${s[j].name} are too close`);
    }
  }
  assert.ok(s.length <= 19, `${s.length} settlements`);
  const w = new World(4242);
  for (const q of w.ow.settlements) {
    const L = w.getLayout(q);
    assert.ok(L.graveyard, `${q.name} has no graveyard`);
    if (q.condition === 'abandoned') continue;
    assert.ok(L.jail, `${q.name} has no jail`);
    assert.ok(L.signs.some((sg) => sg.kind === 'building'), `${q.name} has no building signs`);
    assert.ok(L.npcs.some((r) => r.job === 'mayor'), `${q.name} has no leader`);
  }
});

test('towns run on their own: meals get cooked, people eat, taxes are collected', () => {
  const game = makeGame(12345);
  const w = game.world;
  const layouts = w.ow.settlements.filter((q) => q.condition !== 'abandoned').slice(0, 6).map((q) => w.getLayout(q));
  const before = layouts.map((L) => L.econ.treasury);
  for (const L of layouts) simulateTo(game.sim, L, 8 * DAY + 600);
  let fed = 0;
  let people = 0;
  let meals = 0;
  const qualities = new Set();
  for (const L of layouts) {
    for (const r of L.npcs.filter(alive)) {
      people++;
      if (r.hungry === 0) fed++;
      if (r.lastMeal && r.lastMeal.q) qualities.add(r.lastMeal.q);
      assert.ok(Array.isArray(r.inv) && typeof r.coins === 'number' && r.skills, 'records carry inventory, coins and skills');
    }
    const k = kitchenOf(L);
    if (k) meals += st.count(k.store, 'stew') + st.count(k.store, 'gruel') + st.count(k.store, 'feast');
    assert.equal(L.econ.lastAbs, 8 * DAY + 600);
    assert.ok(L.econ.ledger.length >= 2);
  }
  assert.ok(fed > people * 0.75, `only ${fed}/${people} fed`);
  assert.ok(meals > 0, 'kitchens cooked something');
  assert.ok(qualities.size >= 2, `meal qualities seen: ${[...qualities]}`);
  assert.ok(layouts.some((L, i) => L.econ.treasury !== before[i]), 'treasuries move');
});

test('merchants set out on trading trips and come back', () => {
  const game = makeGame(4242);
  const w = game.world;
  const L = w.ow.settlements.filter((q) => q.type !== 'village' && q.condition !== 'abandoned').map((q) => w.getLayout(q)).find((l) => l.npcs.some((r) => r.traveler));
  const m = L.npcs.find((r) => r.traveler);
  let left = false;
  let back = false;
  for (let d = 2; d < 20 && !back; d++) {
    simulateTo(game.sim, L, d * DAY + 720);
    if (m.away) left = true;
    else if (left) back = true;
  }
  assert.ok(left, 'merchant never left');
  assert.ok(back, 'merchant never came back');
  assert.ok(L.econ.ledger.some((l) => /set out for/.test(l.text)));
});

test('a witnessed theft leads to arrest, a hearing and a fine', () => {
  const game = makeGame(12345);
  const input = warm(game);
  const { sid, a, L } = town(game);
  const p = game.player;
  const wits = a.npcs.filter((n) => !n.dead && !n.sleeping && n.rec.job !== 'guard').slice(0, 2);
  // Unseen crimes don't count.
  assert.equal(game.sim.justice.commit(sid, 'theft', { witnesses: [], value: 5 }), null);
  assert.ok(!game.isWanted(sid));
  const before = game.sim.opinion(wits[0]);
  game.sim.justice.commit(sid, 'theft', { witnesses: wits, value: 4, items: [{ item: 'bread', count: 2 }], desc: 'Stealing bread' });
  assert.ok(game.isWanted(sid));
  assert.ok(game.sim.opinion(wits[0]) < before, 'witnesses think less of you');
  p.give('coin', 200);
  p.give('iron_sword', 1);
  game.sim.justice.surrender(sid);
  // A guard takes your weapons and leads you to the cell on a rope.
  assert.ok(game.sim.justice.escort && p.restrained, 'being escorted');
  assert.equal(countItem(p.inv, 'iron_sword'), 0, 'weapons taken');
  for (let i = 0; i < 3000 && game.sim.justice.escort; i++) game.update(0.05, input);
  assert.ok(!p.restrained);
  assert.ok(game.sim.justice.jail);
  assert.ok(L.jail.cell.some((c) => c.x === p.x && c.z === p.z), 'player is in the cell');
  assert.equal(game.world.getBlock(L.jail.door.x, L.jail.y, L.jail.door.z), B.cell_door);
  assert.ok(!game.isWanted(sid));
  let verdict = null;
  game.ui.openTrial = (v) => {
    verdict = v;
  };
  for (let i = 0; i < 4000 && !verdict; i++) game.update(0.05, input);
  assert.ok(verdict, 'hearing reached a verdict');
  assert.equal(verdict.proven.length, 1);
  assert.equal(verdict.sentence, 'fine');
  const coins = countItem(p.inv, 'coin');
  game.sim.justice.resolve('pay');
  assert.equal(countItem(p.inv, 'coin'), coins - verdict.fine);
  assert.equal(game.sim.justice.jail, null);
  assert.equal(game.world.getBlock(L.jail.door.x, L.jail.y, L.jail.door.z), B.cell_door_open);
  assert.equal(countItem(p.inv, 'iron_sword'), 1, 'weapons returned');
  // The way out is clear: through the open door and past the bars above it.
  assert.ok(game.world.canStand(L.jail.door.x, L.jail.y, L.jail.door.z), 'can walk through the open cell door');
  assert.equal(game.sim.justice.recordOf(sid).convictions, 1);
});

test('guards knock lawbreakers out instead of killing them; repeat killers are sentenced harshly', () => {
  const game = makeGame(12345);
  warm(game);
  const { sid, a } = town(game);
  const p = game.player;
  const guard = game.guardsOf(sid)[0];
  const victim = a.npcs.find((n) => !n.dead && n.rec.job !== 'guard' && n.rec.age === 'adult');
  game.sim.justice.commit(sid, 'murder', { witnesses: [guard], victim: victim.name });
  let ko = false;
  game.ui.showKnockout = () => {
    ko = true;
  };
  p.hp = 2;
  game.damage(p, 5, guard);
  assert.ok(!p.dead, 'not killed');
  assert.ok(ko && game.sim.justice.jail, 'knocked out and jailed');
  const v = game.sim.justice.verdict();
  assert.equal(v.sentence, 'fine');
  game.sim.justice.verdictData = v;
  game.sim.justice.resolve('serve');
  assert.equal(game.sim.justice.jail.phase, 'serving');
  game.sim.justice.release('served');
  // Twice more: a repeat murderer faces death or exile.
  game.sim.justice.commit(sid, 'murder', { witnesses: [guard], victim: 'Someone' });
  game.sim.justice.commit(sid, 'assault', { witnesses: [guard], victim: 'Someone Else' });
  game.sim.justice.imprison(sid, 'surrender', true);
  const v2 = game.sim.justice.verdict();
  assert.ok(v2.sentence === 'death' || v2.sentence === 'exile', v2.sentence);
});

test('deaths fill the graveyard, which grows; family and friends mourn', () => {
  const game = makeGame(12345);
  warm(game);
  const { L } = town(game);
  const g = L.graveyard;
  const cap = g.slots.filter((q) => q.row < g.rows && !q.grave).length;
  const rows = g.rows;
  const dead = L.npcs.filter((r) => alive(r) && r.age !== 'child').slice(0, cap + 1);
  for (const r of dead) game.sim.recordDeath(L, r, 'old age', null);
  assert.ok(g.rows > rows || g.maxRows === rows, 'graveyard expanded');
  const slot = g.slots.find((q) => q.grave && q.grave.idx === dead[0].idx);
  // The plot is kept; the stone goes in when the family bring it.
  assert.notEqual(game.world.getBlock(slot.x, g.y, slot.z), B.gravestone);
  assert.ok(L.econ.burials.some((b) => b.x === slot.x && b.z === slot.z && b.bearer !== null));
  game.sim.placeGrave(L, slot.x, slot.z);
  assert.equal(game.world.getBlock(slot.x, g.y, slot.z), B.gravestone);
  assert.match(game.sim.graveText(slot.x, slot.z).join(' '), new RegExp(dead[0].name.first, 'i'));
  const mourner = L.npcs.find((r) => alive(r) && (r.grief || []).length);
  assert.ok(mourner, 'someone grieves');
  assert.ok(L.econ.funerals.length && L.econ.funerals[0].mourners.length, 'a funeral is planned');
  assert.ok(game.deadNpcs.get(L.settlement.id).has(dead[0].idx));
});

test('becoming a citizen: a host family, builders and a finished house', () => {
  const game = makeGame(12345);
  const input = warm(game, 9 * 60);
  const { a, L } = town(game);
  const p = game.player;
  const hall = L.buildings.find((b) => b.type === 'townhall');
  const mayor = a.npcs.find((n) => n.rec.job === 'mayor');
  p.give('coin', 100);
  p.teleport(hall.inside.x, 6, hall.inside.z);
  game.currentSettlement = L.settlement;
  // (A lot ready for the cottage, as the town's streets would give it.)
  lotsReady(game, L, 'house_s');
  assert.ok(topicsFor(mayor, game).some((t) => t.id === 'citizen'));
  const offer = respond(mayor, game, 'citizen');
  assert.ok(offer.choices && offer.choices.some((o) => o.arg === 'yes'));
  respond(mayor, game, 'citizen', 'yes');
  const c = game.sim.citizen;
  assert.ok(c && c.sid === L.settlement.id);
  assert.ok(c.host !== null && c.hostBed, 'staying with a family');
  assert.equal(game.sim.bedOwner(c.hostBed.x, c.hostBed.z), null, 'the guest bed is yours');
  assert.ok(game.sim.construction && game.sim.builders(L).length >= 1);
  for (let i = 0; i < 20000 && !(game.sim.construction && game.sim.construction.done); i++) game.update(0.25, input);
  assert.ok(game.sim.construction.done, 'house finished');
  assert.ok(game.day <= 4, `took until day ${game.day}`);
  const home = L.buildings[c.home];
  assert.ok(home && home.playerHome);
  assert.equal(game.world.getBlock(home.door.x, 6, home.door.z), B.door);
  assert.equal(game.sim.bedOwner(c.homeBed.x, c.homeBed.z), null);
});

test('reputation: gifts and kind words help, insults and violence hurt; greetings are rare', () => {
  const game = makeGame(12345);
  warm(game);
  const { a } = town(game);
  const n = a.npcs.find((q) => !q.dead && q.rec.job !== 'guard' && q.rec.age === 'adult');
  const r0 = game.sim.opinion(n);
  game.sim.chat(n, 'kind');
  const r1 = game.sim.opinion(n);
  assert.ok(r1 > r0);
  assert.equal(game.sim.chat(n, 'kind'), 0, 'only once a day');
  game.sim.giveGift(n, 'gem');
  const r2 = game.sim.opinion(n);
  assert.ok(r2 > r1);
  game.sim.chat(n, 'rude');
  assert.ok(game.sim.opinion(n) < r2);
  // Walking past everyone rarely gets more than a few remarks.
  let said = 0;
  const p = game.player;
  for (const q of a.npcs) {
    if (q.dead || q.sleeping) continue;
    q.greetCd = 0;
    q.bubble = null;
    p.teleport(q.x + 1, q.y, q.z);
    game.sim.greetT = 0;
    q.maybeGreet(p, 0.1);
    if (q.bubble) said++;
  }
  assert.ok(said < a.npcs.length * 0.6, `${said} of ${a.npcs.length} spoke up`);
});

test('dialogue offers real topics with answers', () => {
  const game = makeGame(12345);
  warm(game);
  const { a } = town(game);
  const n = a.npcs.find((q) => !q.dead && q.rec.age === 'adult' && q.rec.job !== 'guard');
  const ids = topicsFor(n, game).map((t) => t.id);
  for (const id of ['ask', 'favor', 'kind', 'gift', 'bye']) assert.ok(ids.includes(id), `missing topic ${id}`);
  const ask = respond(n, game, 'ask').choices.map((c) => c.id);
  for (const id of ['who', 'doing', 'work', 'news', 'life', 'family', 'people', 'directions']) assert.ok(ask.includes(id), `missing question ${id}`);
  for (const id of ['who', 'doing', 'work', 'news', 'life', 'family']) {
    const r = respond(n, game, id);
    assert.ok(r.lines && r.lines.length && r.lines.every((l) => typeof l === 'string' && l.length), id);
  }
  // Asking again gets something new rather than the same introduction.
  const again = respond(n, game, 'who').lines[0];
  assert.ok(/Still|know who/.test(again), again);
  const places = respond(n, game, 'directions').choices;
  assert.ok(places.length > 2);
  assert.match(respond(n, game, 'directions', places[0].arg).lines[0], /here/);
  const people = respond(n, game, 'people').choices;
  assert.ok(people.length >= 1);
  const about = respond(n, game, 'people', people[0].arg).lines;
  assert.ok(about.length >= 2 && about.every((l) => l.length), about.join(' / '));
});

test('sitting on a seat, and the new state survives a save', () => {
  const game = makeGame(12345);
  warm(game);
  const { sid, a, L } = town(game);
  const p = game.player;
  const seat = L.spots.find((s) => s.seat && game.world.getBlock(s.x, 6, s.z) !== B.air && !game.entityAt(s.x, 6, s.z));
  p.teleport(seat.x + 1, 6, seat.z);
  game.interact(seat.x, 6, seat.z);
  assert.ok(p.sitting, 'sitting');
  const n = a.npcs.find((q) => !q.dead);
  game.sim.changeRep(n, 20);
  game.sim.justice.commit(sid, 'theft', { witnesses: [n], value: 3 });
  L.econ.treasury = 777;
  const data = JSON.parse(JSON.stringify(game.serialize()));
  const g2 = new game.constructor({ seed: data.seed, renderer: game.renderer, audio: null, ui: game.ui, save: data });
  const L2 = g2.world.getLayout(g2.world.ow.settlements[sid]);
  assert.equal(L2.econ.treasury, 777);
  assert.equal(g2.sim.repEntry(sid, n.rec.idx).v, game.sim.repEntry(sid, n.rec.idx).v);
  assert.equal(g2.sim.justice.pendingIn(sid).length, 1);
  assert.ok(g2.isWanted(sid));
});
