import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGame, stubInput } from './helpers.mjs';
import { B, BLOCKS } from '../src/world/blocks.js';
import { GROUND } from '../src/config.js';
import { respond, topicsFor } from '../src/game/dialogue.js';
import { countItem } from '../src/game/inventory.js';
import { alive } from '../src/sim/econ.js';
import { PROFESSIONS, licensesFor, wantsItem } from '../src/sim/careers.js';
import { LAWS, LAW_IDS, reviewLaws, support, stance, lawOn } from '../src/sim/laws.js';
import { voiceOf, speak } from '../src/game/voice.js';
import { exchangeFor } from '../src/game/chatter.js';
import { DEFAULTS, loadSettings, saveSettings, applySettings, changeSetting } from '../src/game/settings.js';
import { KITS, HATS, OUTFITS, randomHero, normalizeHero } from '../src/game/hero.js';
import { Creature } from '../src/entities/creature.js';

function start(seed = 12345, minute = 9 * 60) {
  const game = makeGame(seed);
  const input = stubInput();
  game.minute = minute;
  for (let i = 0; i < 20; i++) game.update(0.1, input);
  const [sid, a] = [...game.active][0];
  return { game, input, sid, a, L: a.layout, p: game.player, w: game.world };
}

function memStore() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}

test('people shut the doors they go through', () => {
  const { game, a, w } = start();
  const b = a.layout.buildings.find((q) => q.door);
  const d = b.door;
  const n = a.npcs.find((q) => q.rec.age === 'adult');
  game.setDoor(d.x, GROUND, d.z, true);
  n.openedDoors = [{ x: d.x, y: GROUND, z: d.z }];
  n.teleport(d.x, GROUND, d.z);
  n.closeDoorBehind();
  assert.ok(w.getState(d.x, GROUND, d.z), 'not while standing in the doorway');
  const out = b.outside;
  n.teleport(out.x + (out.x - d.x), GROUND, out.z + (out.z - d.z));
  n.moveT = 1;
  n.closeDoorBehind();
  assert.ok(!w.getState(d.x, GROUND, d.z), 'shut once clear of it');
  assert.equal(n.openedDoors.length, 0);
});

test('every field has a clear way out through its gate', () => {
  const game = makeGame(12345);
  let checked = 0;
  for (const s of game.world.ow.settlements.filter((q) => q.condition !== 'abandoned').slice(0, 8)) {
    const L = game.world.getLayout(s);
    game.loadAround(L.plaza.cx, L.plaza.cz, true);
    for (const f of L.fields) {
      const gx = f.x0 + Math.floor((f.x1 - f.x0 + 1) / 2);
      const inner = f.z1 - 1;
      // The row inside the gate is a path joining every furrow.
      for (let x = f.x0 + 1; x < f.x1; x++) assert.ok(!BLOCKS[game.world.getBlock(x, GROUND, inner)].solid, `row inside the gate is open at ${x}`);
      assert.ok(!BLOCKS[game.world.getBlock(gx, GROUND, f.z1)].solid, 'the gate itself is open');
      checked++;
    }
  }
  assert.ok(checked > 0);
});

test('news only marks the towns it names on your map', () => {
  const { game, a } = start();
  const n = a.npcs.find((q) => q.rec.age === 'adult');
  const ow = game.world.ow;
  const known = (o) => ow.explored[o.cz * 36 + o.cx] === 1;
  for (let i = 0; i < 12; i++) {
    const was = new Set(ow.settlements.filter(known).map((o) => o.id));
    const lines = respond(n, game, 'news').lines.join(' ');
    for (const o of ow.settlements) if (!was.has(o.id) && known(o)) assert.ok(lines.includes(o.name), `${o.name} was named when it was marked`);
  }
});

test('children do more than play games; tag has a countdown and a runaway', () => {
  const { game, input, a } = start(12345, 14 * 60);
  const kids = a.npcs.filter((n) => n.rec.age === 'child' && game.playtime.free(n));
  assert.ok(kids.length >= 2);
  const moods = new Set();
  for (let i = 0; i < 40; i++) {
    for (const k of kids) {
      k.moodUntil = 0;
      moods.add(game.playtime.mood(k));
    }
  }
  assert.ok(moods.size >= 3, `varied moods: ${[...moods]}`);
  for (const k of kids) {
    k.playMood = 'game';
    k.moodUntil = 1e12;
  }
  game.playtime.gather = () => null;
  const g = game.playtime.start(a.layout, kids, 'tag');
  g.span = 1e9;
  g.grace = 0;
  const it = g.it;
  const other = kids.find((k) => k !== it);
  other.teleport(it.x + 1, it.y, it.z);
  const said = [];
  it.say = (t) => said.push(t);
  game.playtime.tag(g, 0.05);
  assert.equal(g.it, other, 'tagged');
  assert.ok(said.some((t) => /you're it/i.test(t)), 'the tagger shouts');
  assert.ok(g.grace > 2, 'the new one counts first');
  assert.ok(it.goal && it.goal.play, 'the tagger runs off');
  void input;
});

test('graves are set by a family member later; the funeral gathers everyone', () => {
  const { game, input, a } = start(12345, 9 * 60);
  const L = a.layout;
  const victim = L.npcs.find((r) => r.age === 'adult' && alive(r) && r.partner !== null && r.partner !== undefined);
  const slot = game.sim.recordDeath(L, victim, 'old age', null);
  assert.notEqual(game.world.getBlock(slot.x, GROUND, slot.z), B.gravestone, 'not straight away');
  const bur = L.econ.burials.find((b) => b.x === slot.x);
  assert.ok(bur && bur.bearer !== null);
  let placed = false;
  for (let i = 0; i < 8000 && !placed; i++) {
    game.update(0.25, input);
    placed = game.world.getBlock(slot.x, GROUND, slot.z) === B.gravestone;
  }
  assert.ok(placed, 'the stone went in');
  const f = L.econ.funerals[0];
  while (game.sim.abs < f.s + 40) game.update(0.5, input);
  const there = f.mourners.filter((m) => {
    const r = L.npcs[m.idx];
    return r.ent && r.ent.activity && r.ent.activity.entry.act === 'funeral';
  });
  assert.ok(there.length >= Math.ceil(f.mourners.length * 0.75), 'family and friends are at the funeral');
});

test('bigger towns license more trades; buyers only want what their work needs', () => {
  assert.ok(!licensesFor('village').includes('smith'));
  assert.ok(licensesFor('town').includes('smith') && !licensesFor('town').includes('jeweller'));
  assert.ok(licensesFor('city').includes('jeweller'));
  assert.ok(licensesFor('village').length >= 6);
  assert.ok(wantsItem('cook', 'raw_meat'));
  assert.ok(!wantsItem('blacksmith', 'raw_meat'));
  assert.ok(wantsItem('blacksmith', 'iron_ore'));
  assert.ok(wantsItem('guard', 'bread'), 'anyone buys bread');
  const { game, a, sid, p } = start();
  const mayor = a.npcs.find((n) => n.rec.job === 'mayor');
  const t = game.sim.careers.professionTerms(mayor, 'jeweller');
  assert.equal(t.reason, 'tier');
  // As a trapper with meat, only a cook (or someone like them) comes to buy.
  game.sim.careers.job = { kind: 'profession', job: 'trapper', sid, since: 1 };
  p.give('raw_meat', 5);
  for (let k = 0; k < 12; k++) {
    game.sim.careers.customer = null;
    game.sim.careers.nextCustomer = 0;
    game.minute = 600;
    game.sim.careers.updateCustomers();
    const c = game.sim.careers.customer;
    if (!c) continue;
    const who = a.layout.npcs[c.idx];
    assert.ok(wantsItem(who.job, c.item), `${who.job} wants ${c.item}`);
    assert.ok(PROFESSIONS.trapper.goods.includes(c.item));
    who.override = null;
  }
});

test('laws: the council passes and repeals them, and petitions change them', () => {
  const { game, a, L, sid, p } = start();
  for (const id of LAW_IDS) assert.ok(LAWS[id].name && typeof support(L, id) === 'number');
  L.econ.laws.curfew = false;
  L.econ.recent.night = 5;
  L.econ.recent.calm = 0;
  const r = reviewLaws(L, game.day, 'Mayor');
  assert.ok(r && r.id === 'curfew' && r.on, 'night-time trouble brings a curfew');
  // A petition to repeal it.
  const mayor = a.npcs.find((n) => n.rec.job === 'mayor');
  game.sim.citizen = { sid, since: 1, host: null, hostBed: null, home: null, taxDay: game.day, owed: 0 };
  respond(mayor, game, 'petition', 'law:curfew:off');
  assert.ok(game.sim.petition);
  for (const n of a.npcs) {
    if (n.rec.age === 'child' || n.rec.job === 'mayor') continue;
    game.sim.repEntry(sid, n.rec.idx).v = 80;
    if (topicsFor(n, game).some((t) => t.id === 'sign')) respond(n, game, 'sign');
  }
  assert.ok(game.sim.petition.signers.length >= 3);
  respond(mayor, game, 'petition');
  assert.ok(!lawOn(L, 'curfew'), 'repealed by petition');
  // Laws bite: a tariff on outsiders.
  game.sim.citizen = null;
  const trader = a.npcs.find((n) => n.rec.job !== 'mayor' && n.rec.age === 'adult');
  const before = game.sim.priceFactor(trader);
  L.econ.laws.tariff = true;
  assert.ok(game.sim.priceFactor(trader) > before * 1.05);
  // Poaching where there's a game law.
  L.econ.laws.poaching = true;
  const deer = new Creature(game, 'deer', p.x + 2, p.y, p.z);
  const w = a.npcs.find((n) => n.rec.age === 'adult');
  w.teleport(p.x + 3, p.y, p.z + 1);
  game.sim.witnesses = () => [w];
  game.checkPoaching(deer);
  assert.ok(game.sim.justice.pendingIn(sid).some((c) => c.type === 'poaching'));
  assert.ok(stance({ idx: 1, job: 'trapper', personality: {} }, 'poaching') > stance({ idx: 1, job: 'cook', personality: {} }, 'poaching'));
});

test('everyone keeps their own voice', () => {
  const { game, a } = start(4242);
  const mayor = a.npcs.find((n) => n.rec.job === 'mayor');
  assert.equal(voiceOf(mayor.rec).reg, 'formal');
  assert.ok(!/can't|don't/.test(speak(mayor.rec, "I can't say. Don't ask.")));
  const kid = a.npcs.find((n) => n.rec.age === 'child');
  assert.equal(voiceOf(kid.rec).reg, 'chirpy');
  assert.ok(!topicsFor(kid, game).some((t) => t.id === 'laws'), 'children don\'t talk law');
  const v1 = voiceOf(mayor.rec);
  assert.equal(voiceOf(mayor.rec), v1, 'the same voice every time');
  const line = 'Well, I suppose it is time to go home.';
  assert.equal(speak(mayor.rec, line, { first: true }), speak(mayor.rec, line, { first: true }), 'the same words come out the same way');
  // Plenty to talk about among themselves.
  const opens = new Set();
  for (let k = 0; k < 120; k++) {
    const x = a.npcs[k % a.npcs.length];
    const y = a.npcs[(k * 7 + 3) % a.npcs.length];
    if (x !== y) opens.add(exchangeFor(x, y, game)[0]);
  }
  assert.ok(opens.size >= 20, `${opens.size} different conversations`);
});

test('settings: volumes and visuals, saved between games', () => {
  const st = memStore();
  const s = loadSettings(st);
  assert.deepEqual(s, DEFAULTS);
  changeSetting(s, 'music', -2);
  changeSetting(s, 'crt', 0);
  changeSetting(s, 'sound', 99);
  assert.equal(s.music, DEFAULTS.music - 2);
  assert.equal(s.crt, !DEFAULTS.crt);
  assert.equal(s.sound, 10);
  saveSettings(st, s);
  assert.deepEqual(loadSettings(st), s);
  const got = {};
  const crt = {};
  const renderer = {};
  const ui = {};
  applySettings({ ...s, shake: false, windowAnim: false }, { audio: { setVolume: (v) => (got.sound = v) }, music: { setVolume: (v) => (got.music = v) }, crt, renderer, ui });
  assert.equal(got.music, s.music / 10);
  assert.equal(crt.enabled, s.crt);
  assert.ok(renderer.noShake && ui.instantWindows);
});

test('character creation: more looks and kits, kept through the game', () => {
  assert.ok(Object.keys(KITS).length >= 10);
  assert.ok(HATS.length >= 8 && OUTFITS.length >= 8);
  const hero = normalizeHero({ ...randomHero(3), name: 'Wren', kit: 'hunter', look: { ...randomHero(3).look, hat: 'beret', pattern: 'sash', outfit: 'vest', beard: true, acc: 'glasses' } });
  assert.equal(hero.look.hatColor, hero.look.accent);
  const g0 = makeGame(12345);
  const game = new g0.constructor({ seed: 12345, renderer: g0.renderer, audio: null, ui: g0.ui, hero: { ...hero, origin: 'native' } });
  const look = game.player.look;
  assert.equal(look.beard, true);
  assert.equal(look.acc, 'glasses');
  assert.equal(look.hat, 'leather_cap' === game.player.equip.head ? 'lcap' : 'beret');
  assert.ok(countItem(game.player.inv, 'bow'));
});
