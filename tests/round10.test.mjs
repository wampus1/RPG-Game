import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGame, stubInput, lotsReady } from './helpers.mjs';
import { respond } from '../src/game/dialogue.js';
import { countItem, countAny, removeAny, makeSlots, addItem } from '../src/game/inventory.js';
import { RECIPES } from '../src/world/recipes.js';
import { checkWatch } from '../src/sim/civic.js';
import { RNG } from '../src/util/rng.js';
import { screenToWorld } from '../src/entities/player.js';

function start(seed = 7, minute = 9 * 60) {
  const game = makeGame(seed);
  const input = stubInput();
  game.minute = minute;
  for (let i = 0; i < 20; i++) game.update(0.1, input);
  const [sid, a] = [...game.active][0];
  game.player.give('coin', 300);
  return { game, input, sid, a, L: a.layout, p: game.player };
}

// Into the town hall, to talk business with the mayor.
function atHall(game, L) {
  const hall = L.buildings.find((b) => b.type === 'townhall');
  if (hall) game.player.teleport(hall.inside.x, 6, hall.inside.z);
  game.currentSettlement = L.settlement;
}

test('wooden recipes take any kind of planks or logs', () => {
  const stick = RECIPES.find((r) => r.out === 'stick');
  assert.ok(stick.in.planks);
  const inv = makeSlots(9);
  addItem(inv, 'planks_birch', 1);
  addItem(inv, 'planks_dark', 1);
  assert.equal(countAny(inv, 'planks'), 2, 'birch and dark planks both count as planks');
  const took = removeAny(inv, 'planks', 2);
  assert.equal(took.reduce((n, [, c]) => n + c, 0), 2);
  assert.equal(countAny(inv, 'planks'), 0);
  // Charcoal and log walls from any logs.
  assert.ok(RECIPES.find((r) => r.out === 'coal' && r.in.log));
  assert.ok(RECIPES.find((r) => r.out === 'log_wall' && r.in.log));
  addItem(inv, 'log_birch', 2);
  assert.equal(countAny(inv, 'log'), 2);
});

test('children don\'t hear what other towns wrote about you', () => {
  const { game, L, sid } = start();
  const kid = L.npcs.find((r) => r.age === 'child' && r.ent);
  const adult = L.npcs.find((r) => r.age === 'adult' && r.ent);
  const k0 = game.sim.opinion(kid.ent);
  const a0 = game.sim.opinion(adult.ent);
  game.sim.diplomacy.warnings.set(sid, [{ from: 0, fromName: 'Elsewhere', day: 1, crimes: 3, exiled: false }]);
  game.sim.areaCache.clear();
  assert.ok(game.sim.opinion(adult.ent) < a0, 'grown-ups think less of you');
  assert.equal(game.sim.opinion(kid.ent), k0, 'children don\'t know');
});

test('children play less and help a parent at work', () => {
  const { L } = start(12345);
  const tot = {};
  for (const r of L.npcs.filter((q) => q.age === 'child')) {
    const list = Array.isArray(r.schedule) ? r.schedule : Object.values(r.schedule)[0];
    for (const e of list) tot[e.act] = (tot[e.act] || 0) + (e.e - e.s);
  }
  assert.ok(tot.help > 0, 'some time helping');
  const free = (tot.play || 0) + (tot.help || 0) + (tot.wander || 0);
  assert.ok(tot.play / free < 0.8 && tot.play / free > 0.55, `play is about seven tenths of free time (${(tot.play / free).toFixed(2)})`);
});

test('camera turns: keys move you across the screen however it faces', () => {
  // W is up the screen: north when unturned, and a quarter turn later west.
  assert.deepEqual(screenToWorld(0, -1, 0), [0, -1]);
  assert.deepEqual(screenToWorld(0, -1, 1), [-1, 0]);
  assert.deepEqual(screenToWorld(0, -1, 2), [0, 1]);
  assert.deepEqual(screenToWorld(0, -1, 3), [1, 0]);
});

test('you count as a citizen, and as one of the watch, once sworn in', () => {
  const { game, a, L, p } = start();
  const s = L.settlement;
  const mayor = a.npcs.find((n) => n.rec.job === 'mayor');
  atHall(game, L);
  assert.equal(game.sim.playerCount(s.id), 0);
  respond(mayor, game, 'citizen', 'yes');
  assert.equal(game.sim.playerCount(s.id), 1, 'a citizen now');
  game.sim.changeRep(mayor, 30);
  respond(mayor, game, 'profession', 'take:guard');
  assert.equal(game.sim.playerGuard(s.id), 1, 'on the watch');
  // With you on the watch and every other guard gone, nobody is pressed into service.
  for (const r of L.npcs) if (r.job === 'guard') r.alive = false;
  assert.equal(checkWatch(game.sim, L, game.day, new RNG(3)), null);
  // The uniform: the town's colours, worn from the pack.
  const tab = p.inv.findIndex((q) => q && q.item.startsWith('tabard_'));
  assert.ok(tab >= 0);
  const want = s.civ ? `tabard_${s.civ.color.name.toLowerCase()}` : 'tabard_free';
  assert.equal(p.inv[tab].item, want);
  p.wear(tab);
  assert.ok(p.armorValue() > 0.1);
  // Losing citizenship costs the town a citizen (and you the post).
  game.sim.revoke('test');
  assert.equal(game.sim.playerCount(s.id), 0);
  assert.equal(game.sim.playerGuard(s.id), 0);
  assert.ok(!p.equip.body, 'the uniform went back');
  assert.ok(L.econ.ledger.some((it) => /lost a citizen/.test(it.text)));
});

test('the night watch pays a little more than the day', () => {
  const { game, a, L, p } = start();
  const mayor = a.npcs.find((n) => n.rec.job === 'mayor');
  atHall(game, L);
  respond(mayor, game, 'citizen', 'yes');
  game.sim.changeRep(mayor, 30);
  respond(mayor, game, 'profession', 'take:guard');
  const car = game.sim.careers;
  const j = car.job;
  L.econ.treasury = 1000;
  j.duty = 240;
  const day = car.payDuty(L, j, false);
  j.nightDuty = 240;
  const night = car.payDuty(L, j, true);
  assert.ok(night > day, `night ¤${night} > day ¤${day}`);
  void countItem;
  void p;
});

test('trade benches: only the licensed can work them; tailored clothes charm people', async () => {
  const { recipesFor } = await import('../src/world/recipes.js');
  const { ITEMS } = await import('../src/world/items.js');
  const { game, a, L, p } = start();
  const car = game.sim.careers;
  assert.ok(!car.canUseBench('tailor'));
  // The loom makes dyed clothes that add charisma.
  const r = recipesFor('tailor').find((q) => q.out === 'linen_shirt_red');
  assert.ok(r && r.in.linen_shirt && r.in.flower_red);
  assert.ok(ITEMS.linen_shirt_red.stats.cha >= 1);
  assert.ok(String(ITEMS.linen_shirt_red.look).startsWith('linen:'));
  const npc = a.npcs.find((n) => n.rec.age === 'adult');
  const before = game.sim.opinion(npc);
  p.give('fine_coat_purple', 1);
  p.wear(p.inv.findIndex((q) => q && q.item === 'fine_coat_purple'));
  game.refreshBonus();
  assert.ok(game.hero.bonus.cha >= 3, 'the coat adds charisma');
  assert.ok(game.sim.opinion(npc) > before, 'people warm to you');
  void L;
});

test('potions raise an ability for a few hours; vigor gives blue hearts', () => {
  const { game, p } = start();
  p.give('potion_might', 1);
  game.selectSlot(p.inv.findIndex((q) => q && q.item === 'potion_might'));
  assert.ok(game.drink());
  assert.equal(game.hero.bonus.str, 2);
  // Hours later, it wears off.
  game.minute += 4 * 60;
  game.refreshBonus();
  assert.equal(game.hero.bonus.str || 0, 0);
  p.give('potion_vigor', 1);
  game.selectSlot(p.inv.findIndex((q) => q && q.item === 'potion_vigor'));
  assert.ok(game.drink());
  assert.ok(p.blue.hp >= 4);
});

test('a scribe prints the news and hands it out; people read it and talk of it', () => {
  const { game, a, L, p } = start();
  const press = game.sim.press;
  L.econ.ledger.push({ day: game.day, text: 'A great fish was caught in the mill pond.' });
  const stories = press.stories(L);
  assert.ok(stories.some((q) => /great fish/.test(q.text)));
  assert.equal(press.print(L, stories.slice(0, 2), 4), null, 'no paper, no ink');
  p.give('paper', 1);
  p.give('ink', 1);
  const ed = press.print(L, stories.slice(0, 2), 4);
  assert.ok(ed && ed.headlines.length === 2);
  assert.equal(countItem(p.inv, 'newspaper'), 4);
  const npc = a.npcs.find((n) => n.rec.age === 'adult' && n.rec.job !== 'mayor');
  const op = game.sim.opinion(npc);
  const r = respond(npc, game, 'paper');
  assert.ok(r.lines.length);
  assert.equal(npc.rec.readEdition, ed.id);
  assert.ok(game.sim.opinion(npc) > op);
  assert.equal(countItem(p.inv, 'newspaper'), 3);
});

test('a jeweller sets a gem: stats and a gift for the blade', async () => {
  const { ITEMS } = await import('../src/world/items.js');
  const { game, p } = start();
  p.give('iron_sword', 1);
  p.give('ruby', 1);
  const i = p.inv.findIndex((q) => q && q.item === 'iron_sword');
  assert.ok(game.setGem({ kind: 'inv', i }, 'ruby'));
  assert.equal(p.inv[i].item, 'iron_sword+ruby');
  assert.equal(countItem(p.inv, 'ruby'), 0);
  const it = ITEMS['iron_sword+ruby'];
  assert.equal(it.gift, 'ember');
  assert.ok(it.stats.str >= 1);
  game.selectSlot(i);
  game.refreshBonus();
  assert.equal(game.hero.bonus.str, 1, 'held, the ruby adds strength');
  // Armour takes gems too.
  p.give('leather_tunic', 1);
  p.give('emerald', 1);
  const j = p.inv.findIndex((q) => q && q.item === 'leather_tunic');
  p.wear(j);
  assert.ok(game.setGem({ kind: 'equip', slot: 'body' }, 'emerald'));
  assert.equal(p.equip.body, 'leather_tunic+emerald');
});

test('born here: a family name, parents who treat you as their child, a home, and a place of your own if you want it', async () => {
  const { randomHero } = await import('../src/game/hero.js');
  const { Game } = await import('../src/game/game.js');
  const { stubRenderer, stubUI } = await import('./helpers.mjs');
  const hero = { ...randomHero(7), name: 'Wren', origin: 'native' };
  const game = new Game({ seed: 12345, renderer: stubRenderer(), audio: null, ui: stubUI(), hero });
  const input = stubInput();
  for (let i = 0; i < 20; i++) game.update(0.1, input);
  const c = game.sim.citizen;
  assert.ok(c && c.native && c.family);
  assert.ok(c.family.name && game.playerName === `Wren ${c.family.name}`, `named ${game.playerName}`);
  const L = game.sim.layoutOf(c.sid);
  assert.ok(c.family.parents.length >= 1, 'parents');
  const parent = L.npcs[c.family.parents[0]];
  assert.equal(game.sim.familyOf(parent), 'parent');
  assert.ok(game.sim.repEntry(c.sid, parent.idx).v >= 80, 'a parent\'s love');
  // They greet you as their child.
  const a = game.active.get(c.sid);
  const pe = a && a.npcs.find((n) => n.rec === parent);
  if (pe) {
    const { openingLine } = await import('../src/game/dialogue.js');
    const line = openingLine(pe, game);
    assert.ok(/love|child|Wren|eaten|supper/.test(line), line);
  }
  // The mayor can have a place of your own built.
  const mayor = a && a.npcs.find((n) => n.rec.job === 'mayor');
  if (mayor) {
    game.player.give('coin', 500);
    lotsReady(game, L, 'house_s');
    const t = game.sim.ownHomeTerms(mayor);
    if (t.ok) {
      assert.ok(game.sim.ownHome(mayor).ok);
      assert.ok(game.sim.construction && !game.sim.construction.done, 'the builders start on it');
    }
  }
});

// ------------------------------------------------------------ town events
test('a wedding: posters the day before, an arch and benches on the day, guests drifting in, and all taken down after', async () => {
  const { B } = await import('../src/world/blocks.js');
  const { game, input, L } = start();
  const w = game.world;
  const E = game.sim.events;
  const single = L.npcs.filter((r) => r.alive !== false && r.age === 'adult' && (r.partner === null || r.partner === undefined));
  const a = single[0];
  const b = single.find((q) => q.household !== a.household);
  const ev = E.wedding(L, a, b, game.day);
  assert.equal(ev.day, game.day + 2, 'two days off');
  assert.ok(L.econ.ledger.some((it) => /are to be married/.test(it.text)));
  const goTo = (day, min) => {
    game.day = day;
    game.minute = min;
    for (let i = 0; i < 4; i++) game.update(0.6, input);
  };
  goTo(ev.day - 1, 7 * 60);
  assert.ok(!ev.posters.length || ev.posters.every((q) => !q.up), 'no posters yet');
  goTo(ev.day - 1, 14 * 60);
  assert.ok(ev.posters.length >= 2, 'a few posters');
  assert.ok(ev.posters.every((q) => w.getBlock(q.x, 6, q.z) === B.poster), 'up around town');
  const t = game.signText(ev.posters[0].x, 6, ev.posters[0].z);
  assert.ok(t.lines.some((l) => l.includes(a.name.last.toUpperCase())), 'the poster says whose wedding');
  goTo(ev.day, 7 * 60 + 30);
  assert.ok(ev.site && ev.blocks.length, 'somewhere to put it up');
  assert.ok(game.sim.works.projects.some((p) => p.id === ev.stage && p.kind === 'stage'), 'the builders are on it');
  // People set off at different times, some well before, some just in time.
  const leave = ev.guests.map((g) => g.leave - ev.s);
  assert.ok(Math.max(...leave) - Math.min(...leave) >= 30, `staggered (${Math.min(...leave)}..${Math.max(...leave)})`);
  assert.ok(ev.guests.some((g) => g.role === 'couple') && ev.guests.some((g) => g.role === 'seat'));
  goTo(ev.day, 14 * 60 + 40);
  assert.ok(ev.blocks.every(([x, y, z, id]) => w.getBlock(x, y, z) === id), 'the arch and benches are up');
  assert.ok(w.getBlock(...ev.blocks.find((q) => q[3] === B.flower_arch).slice(0, 3)) === B.flower_arch);
  const going = ev.guests.filter((g) => g.set).map((g) => L.npcs[g.idx]);
  assert.ok(going.length && going.every((r) => r.override && r.override.act === 'event'), 'on their way');
  goTo(ev.day, 16 * 60 + 30);
  assert.equal(a.partner, b.idx, 'wed');
  assert.ok(L.econ.ledger.some((it) => /were married/.test(it.text)));
  goTo(ev.day + 1, 20 * 60);
  assert.equal(ev.state, 'done');
  assert.ok(ev.blocks.every(([x, y, z]) => w.getBlock(x, y, z) === B.air), 'all taken down');
  assert.ok(ev.posters.every((q) => w.getBlock(q.x, 6, q.z) !== B.poster), 'posters down');
});

test('not everyone goes: family and friends, the sociable and the cheerful do; the grieving and the gloomy stay home', () => {
  const game = makeGame(12345);
  const s = game.world.ow.settlements.find((q) => q.type === 'city');
  const L = game.world.getLayout(s);
  const E = game.sim.events;
  const people = L.npcs.filter((r) => r.alive !== false && !r.away);
  const [a, b] = people.filter((r) => r.age === 'adult' && r.job !== 'merchant' && (r.partner === null || r.partner === undefined));
  const ev = { id: 7, kind: 'wedding', couple: [a.idx, b.idx], host: null };
  const n = people.filter((r) => E.going(L, ev, r)).length;
  assert.ok(n > people.length * 0.2 && n < people.length * 0.85, `${n} of ${people.length} going`);
  // The same person, in different moods and natures.
  const r = people.find((q) => q.age === 'adult' && q !== a && q !== b && !E.relation(L, q, a) && !E.relation(L, q, b) && q.job !== 'guard');
  const base = { ...r, grief: [], traits: [], mood: 0.6, personality: { ...r.personality, sociability: 0.5 } };
  const p0 = E.pull(L, ev, base);
  assert.ok(E.pull(L, ev, { ...base, traits: ['outgoing', 'cheerful'] }) > p0, 'the outgoing are keener');
  assert.ok(E.pull(L, ev, { ...base, traits: ['reserved', 'gloomy'] }) < p0, 'the reserved less so');
  assert.ok(E.pull(L, ev, { ...base, mood: 0.15 }) < p0, 'a low mood keeps people home');
  assert.ok(E.pull(L, ev, { ...base, grief: [{ rel: 'family' }] }) < p0 - 0.2, 'so does grief');
  assert.ok(E.pull(L, ev, { ...base, partner: a.idx }) > p0 + 0.3, 'family always want to be there');
  assert.equal(E.pull(L, ev, a), 1, 'the couple, of course');
});

test('feast days and a town\'s promotion are announced ahead, not held on the spot', async () => {
  const { promote } = await import('../src/sim/growth.js');
  const { game, L } = start();
  const E = game.sim.events;
  promote(game.sim, L, 'town', game.day);
  const fete = E.upcoming(L).find((q) => q.kind === 'fete');
  assert.ok(fete && fete.day === game.day + 2 && fete.tier === 'town');
  assert.ok(L.econ.ledger.some((it) => /celebration .* will be held/.test(it.text)));
  // One do a day: the feast goes to the next free day.
  const feast = E.feast(L, game.day, 40);
  assert.equal(feast.day, game.day + 3);
  // What people say about it: whether they're going, and why not.
  const npc = [...game.active.values()][0].npcs.find((q) => q.rec.age === 'adult' && q.rec.job !== 'mayor');
  const r = respond(npc, game, 'life');
  assert.ok(r.lines.some((l) => /celebration|feast/.test(l)), r.lines.join(' / '));
});
