import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGame, stubInput } from './helpers.mjs';
import { RNG } from '../src/util/rng.js';
import { alive } from '../src/sim/econ.js';
import { Creature } from '../src/entities/creature.js';
import { NPC } from '../src/entities/npc.js';
import { ITEMS, twoHanded, offhandable } from '../src/world/items.js';
import { RECIPES } from '../src/world/recipes.js';
import { STOCK } from '../src/sim/econ.js';
import { STYLES, weaponStyle, styleOf, shieldOf, offhandOf, resolveHit, roll, beginAttack, tickAttack, buffOf, MAX_STAMINA, heftOf } from '../src/game/combat.js';
import { chainFor, babble, smallTalk, expand, fill } from '../src/game/markov.js';
import { talkContext } from '../src/game/dialogue.js';
import { GUARD_ARMS } from '../src/sim/careers.js';
import { TECHS } from '../src/sim/tech.js';

function start(seed = 12345, opts = {}, minute = 10 * 60) {
  const game = makeGame(seed, opts);
  const input = stubInput();
  game.minute = minute;
  for (let i = 0; i < 20; i++) game.update(0.1, input);
  const [sid, a] = [...game.active][0];
  return { game, input, sid, a, L: a.layout, p: game.player };
}
const run = (game, input, n, dt = 0.1) => {
  for (let i = 0; i < n; i++) game.update(dt, input);
};
const people = (L) => L.npcs.filter((r) => alive(r) && !r.away && !r.migrated && !r.visitor);

// A wolf to practise on, right beside you, that won't die too soon.
function dummy(game, p, dx = 1) {
  const w = new Creature(game, 'wolf', p.x + dx, p.y, p.z);
  game.addCreature(w);
  w.hp = w.maxHp = 200;
  w.S = { ...w.S, mode: 'passive' };
  // (Dazed where it stands: it neither bites nor wanders off.)
  w.stunT = 1e9;
  return w;
}

// ------------------------------------------------------------ fixes
test('Ctrl with a game key never reaches the browser (Ctrl+G is not "find")', async () => {
  const src = await import('node:fs').then((fs) => fs.readFileSync(new URL('../src/game/input.js', import.meta.url), 'utf8'));
  assert.match(src, /ctrlGame/);
  assert.match(src, /'KeyG'/);
});

test('you can dodge roll mid-stride', () => {
  const { game, p } = start();
  p.stamina = 10;
  p.rollCd = 0;
  // Walking: a step under way.
  const nx = p.x + 1;
  const ny = game.world.stepTarget(p.x, p.y, p.z, nx, p.z, false);
  if (ny < 0 || game.occupiedBySolid(nx, ny, p.z, p)) return;
  p.startMove(nx, ny, p.z, 0.3);
  p.moveT = 0.5;
  assert.ok(p.moving);
  const ok = roll(game, p, [1, 0]);
  assert.ok(ok, 'rolled while moving');
  assert.ok(p.rollT > 0);
});

test('a trading company that rides into town ahead of its reckoning stays, as itself, where it stopped', () => {
  const { game, L } = start();
  const C = game.sim.caravans;
  C.start();
  const g = C.list[0];
  const other = game.world.ow.settlements.find((s) => s.id !== L.settlement.id && game.sim.layoutOf(s.id)?.econ);
  Object.assign(g, { state: 'road', from: other.id, dest: L.settlement.id, at: null, departAt: game.sim.abs - 60, arrive: game.sim.abs + 600 });
  const trs = game.sim.travellers().filter((t) => t.company === g);
  assert.ok(trs.length >= 1);
  game.caravans ||= new Map();
  game.caravanIn ||= new Set();
  const e = L.entrances[0];
  const ents = trs.map((tr, i) => {
    const m = new NPC(game, tr.rec, tr.L);
    m.caravan = { tx: tr.target.x, tz: tr.target.z, way: tr.way, to: tr.to.name, from: tr.from.name };
    m.company = g;
    m.state = 'caravan';
    m.tr = tr;
    m.mount = tr.mount;
    const s = game.findFreeSpot(e.x + i, e.z, 0) || game.findFreeSpot(e.x, e.z, 64);
    m.teleport(s.x, s.y, s.z);
    tr.rec.ent = m;
    game.npcs.push(m);
    game.caravans.set(tr.key, m);
    return m;
  });
  const at = ents.map((m) => [m.x, m.z]);
  assert.equal(game.caravanLanded(trs[0], ents[0]), 'company');
  assert.equal(g.state, 'stay', 'they have arrived');
  const now = [...C.ents.values()].filter((n) => !n.dead);
  assert.equal(now.length, trs.length, 'all of them are still here');
  for (const n of now) assert.ok(at.some(([x, z]) => Math.max(Math.abs(n.x - x), Math.abs(n.z - z)) <= 2), 'right where they were');
});

test('the map marks a trader where they really are when they are near you', () => {
  const { game } = start();
  const tr = game.sim.travellers().find((t) => t.company || (t.rec && t.rec.traveler));
  if (!tr) return;
  const fake = { dead: false, x: tr.pos.x + 7, z: tr.pos.z - 3, tr };
  game.caravans = new Map([[tr.key, fake]]);
  const MapWindow = { trade: null };
  // (The same rule the map uses: a live one wins over the reckoning.)
  const ents = game.caravans;
  const n = ents.get(tr.key);
  MapWindow.trade = [{ x: n && !n.dead ? n.x : tr.pos.x, z: n && !n.dead ? n.z : tr.pos.z }];
  assert.deepEqual(MapWindow.trade[0], { x: fake.x, z: fake.z });
});

// ------------------------------------------------------------ weapons
test('new arms, one- and two-handed, melee and ranged, each with a way of fighting, a recipe and a seller', () => {
  const melee = ['short_sword', 'sabre', 'hand_axe', 'flail', 'quarterstaff', 'greatsword', 'battle_axe', 'warhammer', 'halberd'];
  const ranged = ['longbow', 'crossbow', 'sling', 'javelin'];
  for (const k of [...melee, ...ranged]) {
    assert.ok(ITEMS[k] && ITEMS[k].kind === 'weapon', k);
    assert.ok(RECIPES.some((r) => r.out === k || r.item === k || r.key === k || (r.result && r.result === k)) || Object.values(STOCK).some((l) => l.includes(k)), `${k} can be had`);
  }
  for (const k of ranged) assert.ok(ITEMS[k].ranged);
  for (const k of ['greatsword', 'battle_axe', 'warhammer', 'halberd', 'quarterstaff', 'longbow', 'crossbow', 'bow']) assert.ok(twoHanded(k), `${k} takes two hands`);
  for (const k of ['short_sword', 'sabre', 'hand_axe', 'dagger', 'iron_sword']) assert.ok(offhandable(k), `${k} fits the off hand`);
  assert.ok(!offhandable('greatsword') && !offhandable('bow') && !offhandable('iron_shield'));
  assert.equal(weaponStyle('greatsword'), 'great');
  assert.equal(weaponStyle('warhammer'), 'maul');
  assert.equal(weaponStyle('halberd'), 'halberd');
  assert.equal(weaponStyle('quarterstaff'), 'staff');
  assert.equal(weaponStyle('sabre'), 'sword');
  assert.ok(STYLES.great.sweep && STYLES.staff.sweep);
  assert.ok(STYLES.flail.pierce > 0, 'a flail goes round a shield');
  assert.equal(ITEMS.crossbow.ammo, 'bolt');
  assert.ok(ITEMS.javelin.thrown);
});

test('a two-handed weapon leaves no hand for a shield; a one-handed blade can go in the off hand', () => {
  const { p } = start();
  p.equip.shield = 'iron_shield';
  p.inv[p.selected] = { item: 'iron_sword', count: 1 };
  assert.ok(shieldOf(p), 'a sword and a shield');
  assert.ok(p.look.gear && p.look.gear.shield, 'the shield is on the arm');
  p.inv[p.selected] = { item: 'greatsword', count: 1 };
  assert.equal(shieldOf(p), null, 'not with a greatsword');
  assert.ok(!p.look.gear || !p.look.gear.shield, 'slung out of sight');
  // A dagger to the off hand, from the pack.
  p.inv[p.selected] = { item: 'iron_sword', count: 1 };
  const i = p.inv.findIndex((q, k) => !q && k > 9);
  p.inv[i] = { item: 'dagger', count: 1 };
  assert.equal(p.wear(i), 'shield');
  assert.equal(p.equip.shield, 'dagger');
  assert.equal(offhandOf(p), 'dagger');
  assert.equal(shieldOf(p), null);
  assert.equal(p.offhandItem(), 'dagger', 'drawn in the other hand');
  p.inv[p.selected] = { item: 'halberd', count: 1 };
  assert.equal(offhandOf(p), null, 'no second blade with a halberd');
});

test('fighting with two blades: a second blow on the heels of the first (you and anyone else)', () => {
  const { game, input, p } = start();
  // (No lucky crits to muddy the sums.)
  const rand = Math.random;
  Math.random = () => 0.5;
  try {
    p.inv[p.selected] = { item: 'iron_sword', count: 1 };
    const w = dummy(game, p);
    p.equip.shield = null;
    p.stamina = 10;
    game.attack(w);
    run(game, input, 12, 0.05);
    const one = 200 - w.hp;
    w.hp = 200;
    w.teleport(p.x + 1, p.y, p.z);
    p.equip.shield = 'short_sword';
    p.attackCd = 0;
    p.commitT = 0;
    p.stamina = 10;
    game.attack(w);
    run(game, input, 12, 0.05);
    assert.ok(200 - w.hp > one, `two blades hit harder (${one} vs ${200 - w.hp})`);
  } finally {
    Math.random = rand;
  }
  // An NPC with a second blade strikes twice.
  const g = game.npcs.find((n) => n.rec.job === 'guard' && !n.dead);
  if (!g) return;
  g.rec.equipment.tool = 'iron_sword';
  g.rec.equipment.shield = 'dagger';
  assert.equal(offhandOf(g), 'dagger');
  const v = dummy(game, g, 1);
  v.teleport(g.x + 1, g.y, g.z);
  g.attackCd = 0;
  g.stunT = 0;
  assert.ok(beginAttack(game, g, v, styleOf(g)));
  let blows = 0;
  let hp = v.hp;
  for (let i = 0; i < 40 && g.windup; i++) {
    tickAttack(game, g, 0.05);
    if (v.hp < hp) {
      blows++;
      hp = v.hp;
    }
  }
  assert.ok(blows >= 2, `two blows from two blades (${blows})`);
});

test('a guard recruit is issued arms from the watch\'s rack, not always a sword', () => {
  const { game, L } = start();
  const car = game.sim.careers;
  const seen = new Set();
  for (let d = 0; d < 30; d++) {
    game.day = d;
    const kit = car.kitFor('guard', L.settlement);
    const arm = kit[0][0];
    assert.ok(ITEMS[arm] && ITEMS[arm].kind === 'weapon', arm);
    seen.add(arm);
  }
  assert.ok(seen.size >= 3, `several kinds (${[...seen].join(', ')})`);
  assert.ok(GUARD_ARMS.length >= 8);
});

test('enemies strike faster or slower by their weapon, and bare-handed or beast by the kind of blow', () => {
  const { game } = start();
  const g = game.npcs.find((n) => !n.dead && n.rec.age === 'adult');
  g.rec.equipment.tool = 'dagger';
  const quick = styleOf(g).windup * heftOf(g);
  g.rec.equipment.tool = 'warhammer';
  const slow = styleOf(g).windup * heftOf(g);
  assert.ok(slow > quick * 2, 'a war hammer comes round far slower than a dagger');
  g.rec.equipment.tool = 'mace';
  assert.ok(heftOf(g) > 1, 'a mace is heavier than most clubs');
  // Bare hands: a jab, or a haymaker now and then.
  g.rec.equipment.tool = null;
  g.rec.equipment.items = [];
  const kinds = new Set();
  for (let i = 0; i < 40; i++) kinds.add(styleOf(g, true).name);
  assert.ok(kinds.has('punch') && kinds.has('haymaker'));
  assert.ok(STYLES.haymaker.windup > STYLES.fist.windup);
  // Beasts: a wolf lunges, or snaps close in (quicker).
  const wolf = new Creature(game, 'wolf', g.x, g.y, g.z);
  const wk = new Set();
  for (let i = 0; i < 40; i++) wk.add(styleOf(wolf, true).name);
  assert.ok(wk.has('lunge') && wk.has('snap'));
  assert.ok(STYLES.snap.windup < STYLES.bite.windup);
});

test('guards are tougher: harder blows, strings of them, and a step aside won\'t shake them off', () => {
  const { game, p } = start();
  const g = game.npcs.find((n) => n.rec.job === 'guard' && !n.dead);
  if (!g) return;
  g.rec.equipment.tool = 'iron_sword';
  g.rec.equipment.shield = null;
  const v = dummy(game, g);
  v.teleport(g.x + 1, g.y, g.z);
  // A combo: three blows from one wind-up.
  g.attackCd = 0;
  assert.ok(beginAttack(game, g, v, styleOf(g), { combo: 2, press: 1 }));
  let blows = 0;
  let hp = v.hp;
  for (let i = 0; i < 80 && g.windup; i++) {
    tickAttack(game, g, 0.05);
    if (v.hp < hp) {
      blows++;
      hp = v.hp;
    }
  }
  assert.ok(blows >= 3, `a string of blows (${blows})`);
  // Pressing: you step aside as it comes, and it follows you.
  p.teleport(g.x + 1, g.y, g.z);
  g.attackCd = 0;
  g.stunT = 0;
  assert.ok(beginAttack(game, g, p, styleOf(g), { press: 1 }));
  const side = [[0, 1], [0, -1]].map(([dx, dz]) => [g.x + 1 + dx, g.z + dz]).find(([x, z]) => game.world.stepTarget(p.x, p.y, p.z, x, z, false) >= 0 && !game.occupiedBySolid(x, p.y, z, p));
  if (!side) return;
  p.teleport(side[0], p.y, side[1]);
  const hp0 = p.hp;
  for (let i = 0; i < 40 && g.windup; i++) tickAttack(game, g, 0.05);
  assert.ok(p.hp < hp0, 'the blow followed you');
  // And they hit harder than a townsman with the same blade.
  const t = game.npcs.find((n) => n.rec.job !== 'guard' && n.rec.age === 'adult' && !n.dead);
  t.rec.equipment.tool = 'iron_sword';
  assert.ok(g.attackDamage() > t.attackDamage());
});

// ------------------------------------------------------------ your blows
test('your blow winds up (by the weapon), then lands; you are committed to it', () => {
  const { game, input, p } = start();
  const w = dummy(game, p);
  p.inv[p.selected] = null;
  p.stamina = 10;
  game.attack(w);
  assert.ok(p.swing, 'a wind-up first');
  const fist = p.swing.dur;
  assert.equal(w.hp, 200, 'nothing yet');
  run(game, input, 6, 0.05);
  assert.ok(w.hp < 200, 'then it lands');
  w.hp = 200;
  w.teleport(p.x + 1, p.y, p.z);
  p.inv[p.selected] = { item: 'warhammer', count: 1 };
  p.attackCd = 0;
  p.commitT = 0;
  p.stamina = 10;
  game.attack(w);
  assert.ok(p.swing.dur > fist * 3, 'a war hammer takes a long haul back');
  assert.equal(roll(game, p, [0, 1]), false, 'no rolling out of it');
  // Stepped away before it landed: a miss.
  w.teleport(p.x + 4, p.y, p.z);
  run(game, input, 12, 0.05);
  assert.equal(w.hp, 200, 'whiff');
});

test('stamina is counted in points: a punch costs one, weapons two or more; it comes back slowly', () => {
  const { game, input, p } = start();
  run(game, input, 2);
  assert.ok(p.maxStamina >= 7 && p.maxStamina <= 16, `about ten points (${p.maxStamina})`);
  assert.equal(MAX_STAMINA, 10);
  const w = dummy(game, p);
  for (const [item, cost] of [[null, 1], ['dagger', 2], ['iron_sword', 2], ['spear', 3], ['greatsword', 5]]) {
    p.inv[p.selected] = item ? { item, count: 1 } : null;
    p.equip.shield = null;
    p.stamina = 10;
    p.attackCd = 0;
    p.commitT = 0;
    p.swing = null;
    w.teleport(p.x + 1, p.y, p.z);
    game.attack(w);
    assert.equal(10 - p.stamina, cost, `${item || 'fist'} costs ${cost}`);
    p.swing = null;
  }
  // Back slowly: a couple of points a second standing still.
  p.stamina = 0;
  p.restT = 1;
  p.swing = null;
  const s0 = p.stamina;
  for (let i = 0; i < 10; i++) game.update(0.1, input);
  assert.ok(p.stamina - s0 > 1 && p.stamina - s0 < 3.2, `regained ${p.stamina - s0}`);
});

test('a parry just as the blow lands stuns them for seconds, with a crack of light and the world holding its breath', () => {
  const { game, p } = start();
  p.equip.shield = 'iron_shield';
  p.inv[p.selected] = { item: 'iron_sword', count: 1 };
  const wolf = new Creature(game, 'wolf', p.x + 1, p.y, p.z);
  game.addCreature(wolf);
  p.blocking = true;
  p.blockT = 0.1;
  p.face(wolf.x, wolf.z);
  let flashed = false;
  game.renderer.flashScreen = () => {
    flashed = true;
  };
  assert.equal(resolveHit(game, wolf, p, STYLES.bite), 'parried');
  assert.ok(wolf.stunT >= 2.5, `stunned a few seconds (${wolf.stunT})`);
  assert.ok(game.hitStop > 0 && game.slowMo > 0 && game.shake > 0.5 && flashed);
  // Up too long before it came: a plain block.
  p.blockT = 0.6;
  p.stamina = 10;
  assert.equal(resolveHit(game, wolf, p, STYLES.bite), 'blocked');
});

test('hurt: the screen shakes and reddens', () => {
  const { game } = start();
  const wolf = new Creature(game, 'wolf', game.player.x + 1, game.player.y, game.player.z);
  game.addCreature(wolf);
  game.shake = 0;
  game.hurtFlash = 0;
  game.damage(game.player, 2, wolf);
  assert.ok(game.shake >= 0.6 && game.hurtFlash > 0.5);
});

test('fighting potions: more stamina, faster stamina, harder blows, quicker blows', () => {
  const { game, input, p } = start();
  for (const k of ['potion_breath', 'potion_wind', 'potion_fury', 'potion_haste']) {
    assert.ok(ITEMS[k] && ITEMS[k].kind === 'potion' && ITEMS[k].effect.combat, k);
    assert.ok(RECIPES.some((r) => Object.values(r).includes(k)), `${k} is brewed`);
  }
  run(game, input, 2);
  const max0 = p.maxStamina;
  for (const k of ['potion_breath', 'potion_wind', 'potion_fury', 'potion_haste']) {
    p.inv[p.selected] = { item: k, count: 1 };
    assert.ok(game.drink(), k);
  }
  run(game, input, 2);
  assert.ok(p.maxStamina >= max0 + 5, 'deeper breath');
  assert.ok(buffOf(game, 'wind') > 0 && buffOf(game, 'fury') > 0 && buffOf(game, 'haste') > 0);
  // Quicker blows.
  const w = dummy(game, p);
  p.inv[p.selected] = { item: 'warhammer', count: 1 };
  p.attackCd = 0;
  p.stamina = 10;
  game.attack(w);
  const fast = p.swing.dur;
  p.swing = null;
  p.buffs = p.buffs.filter((q) => q.combat !== 'haste');
  p.attackCd = 0;
  p.commitT = 0;
  game.attack(w);
  assert.ok(fast < p.swing.dur, 'quicksilver hands');
});

// ------------------------------------------------------------ talk
test('the phrase grammar makes choices and maybe-words', () => {
  const rng = new RNG(3);
  const outs = new Set();
  for (let i = 0; i < 40; i++) outs.add(expand('(The|This) rain [really] (soaks|drowns) (everything|us).', rng));
  assert.ok(outs.size >= 8);
  for (const o of outs) assert.match(o, /^(The|This) rain (really )?(soaks|drowns) (everything|us)\.$/);
  assert.equal(fill('{realm} could do more.', { realm: 'the council' }), 'The council could do more.');
  assert.equal(fill('The {realm} rules.', { realm: 'the council' }), 'The council rules.');
  assert.equal(fill('I ate a {dish}.', { dish: 'onion pie' }), 'I ate an onion pie.');
});

test('small talk is about what\'s around them: the weather, their trade, their family, the market', () => {
  const { game, L } = start();
  const ctx = talkContext(game, L.settlement);
  assert.ok(ctx.L && ctx.wkind && ctx.other);
  const rain = { ...ctx, wkind: 'rain', weather: 'rain' };
  const folk = people(L).filter((r) => r.age === 'adult');
  let wet = 0;
  for (const r of folk.slice(0, 20)) for (let i = 0; i < 4; i++) if (/rain|wet|mud|puddle|washing|dry|soak|drip|bog|boots|roof/i.test(smallTalk(r, new RNG(r.idx * 7 + i), rain))) wet++;
  assert.ok(wet >= 6, `rain on their minds (${wet})`);
  // Something short on the market comes up.
  const short = { ...ctx, scarce: 'iron' };
  let iron = 0;
  for (const r of folk.slice(0, 20)) for (let i = 0; i < 4; i++) if (/iron/.test(smallTalk(r, new RNG(r.idx * 11 + i), short))) iron++;
  assert.ok(iron >= 2, `talk of the shortage (${iron})`);
  // Family by name.
  const wed = folk.find((r) => r.partner !== null && r.partner !== undefined && L.npcs[r.partner]);
  if (wed) {
    const name = L.npcs[wed.partner].name.first;
    let said = 0;
    for (let i = 0; i < 40; i++) if (smallTalk(wed, new RNG(i), ctx).includes(name)) said++;
    assert.ok(said >= 1, 'talks of their partner by name');
  }
});

test('small talk reads well: whole sentences, no trailing words, no stray slots, and new lines as well as old', () => {
  const { game, L } = start();
  const ctx = talkContext(game, L.settlement);
  const lines = [];
  for (const r of people(L).slice(0, 30)) for (let i = 0; i < 3; i++) lines.push(smallTalk(r, new RNG(r.idx * 5 + i), ctx));
  for (const l of lines) {
    assert.match(l, /[.!?]$/, l);
    assert.doesNotMatch(l, /\{\w+\}/, l);
    assert.doesNotMatch(l, /\b(the|a|and|of|to|my) [.!?]$/i, l);
    assert.doesNotMatch(l, /\b[Tt]he the\b/, l);
    assert.match(l, /^[A-Z"']/, l);
  }
  assert.ok(new Set(lines).size >= lines.length * 0.7, 'mostly different');
  // The chain finds sentences its frames never wrote.
  const c = chainFor('vale', 'plain', ['cheerful'], 'farmer');
  const rng = new RNG(9);
  let fresh = 0;
  for (let i = 0; i < 60; i++) {
    const s = babble(c, rng, { topic: 'work', novel: 1 });
    const t = c.topics.get('work');
    if (!t.seen.has(s)) fresh++;
  }
  assert.ok(fresh >= 5, `new sentences (${fresh})`);
});

test('each people and each way of talking sounds its own', () => {
  const north = chainFor('north', 'rough', []);
  const formal = chainFor('sun', 'formal', ['pious']);
  const rng = new RNG(5);
  const a = [];
  const b = [];
  for (let i = 0; i < 40; i++) {
    a.push(babble(north, rng));
    b.push(babble(formal, rng));
  }
  const overlap = a.filter((l) => b.includes(l)).length;
  assert.ok(overlap < 12, 'not the same lines');
});

// ------------------------------------------------------------ factions
test('each realm starts out knowing one to seven things, by its size, its people and what it holds dear', () => {
  for (const seed of [12345, 777]) {
    const game = makeGame(seed, { learned: false });
    game.sim.tech.cheat = false;
    for (const civ of game.world.ow.civs) {
      const st = game.sim.tech.stateOf({ civ, id: 0 });
      assert.ok(st.done.length >= 1 && st.done.length <= 7, `${civ.name}: ${st.done.length}`);
      for (const k of st.done) {
        assert.ok(TECHS[k], k);
        assert.ok(TECHS[k].tier <= 3, 'nothing advanced at the start');
        for (const r of TECHS[k].req) assert.ok(st.done.includes(r), `${k} needs ${r}`);
      }
    }
  }
});
