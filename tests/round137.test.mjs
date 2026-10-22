// Round 137: triggers and abilities on forged pieces. The old "only at
// night" modifiers are triggers now (when you're struck, when you bring a
// foe down, when night falls...), each setting off one of the piece's
// modifiers for a while or one of its abilities (a healing aura, a meteor,
// chain lightning...), each seen and heard; some come often, some hardly
// ever. At the anvil, what each trigger sets off can be changed round, for
// a little of what the piece is made of; never what the piece has.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { makeGame } from './helpers.mjs';
import { RNG } from '../src/util/rng.js';
import { ITEMS } from '../src/world/items.js';
import { Creature } from '../src/entities/creature.js';
import { parseStar, starKey, modOf, modLine } from '../src/world/quality.js';
import { TRIGGERS, ABILITIES, ABILITY_KEYS, TRIGGER_KEYS, RATES, splitTok } from '../src/world/triggers.js';
import { TRAITS, ADDITIVES } from '../src/world/smithmats.js';
import { forgePiece, bindTriggers, describe } from '../src/game/smithing.js';
import { hasMod } from '../src/game/mods.js';
import { CAST, cast, fireTrigger, tickAbilities, abilityOn, armedOf } from '../src/game/abilities.js';
import { bindings, rebind, rebindCost, swappedKey } from '../src/game/rebind.js';
import { countItem } from '../src/game/inventory.js';
import { ReforgeWindow } from '../src/ui/reforge.js';
import { GAME_VERSION, compareVersions } from '../src/version.js';
import { stepsFor, migrateSave } from '../src/game/migrate.js';

const world = () => makeGame(12345, { wg: 9 });
const wolves = (g, n = 3) => {
  const p = g.player;
  const out = [];
  for (const [dx, dz] of [[1, 0], [2, 1], [-1, 2], [0, -2]].slice(0, n)) {
    const w = new Creature(g, 'wolf', p.x + dx, p.y, p.z + dz);
    g.addCreature(w);
    w.angry = true;
    w.target = p;
    out.push(w);
  }
  return out;
};
const wear = (g, slot, key) => {
  g.player.equip[slot] = key;
  return key;
};

test('a wide run of triggers, from the common to the hardly-ever, and of abilities', () => {
  assert.ok(TRIGGER_KEYS.length >= 25, `${TRIGGER_KEYS.length} triggers`);
  assert.ok(ABILITY_KEYS.length >= 25, `${ABILITY_KEYS.length} abilities`);
  for (const r of Object.keys(RATES)) assert.ok(TRIGGER_KEYS.filter((t) => TRIGGERS[t].rate === r).length >= 4, `several that come ${r}`);
  // Each its own: no two read alike.
  assert.equal(new Set(TRIGGER_KEYS.map((t) => TRIGGERS[t].when)).size, TRIGGER_KEYS.length);
  // The commoner come by chance on something that happens often; the rarer
  // always, on something that seldom does.
  assert.ok(TRIGGERS.struck.chance < 1 && TRIGGERS.mine.chance < 0.2);
  assert.equal(TRIGGERS.deathblow.chance, 1);
  // The conditions are gone from what goes into a piece: triggers and
  // abilities instead, every one of them in something.
  for (const t of ['night', 'hurt', 'deep', 'wild', 'water', 'fight']) assert.ok(!TRAITS[t], `no ${t} condition`);
  const used = new Set(Object.values(ADDITIVES).flatMap((a) => a.traits));
  for (const t of TRIGGER_KEYS) assert.ok(used.has(t), `trigger ${t} in something`);
  for (const a of ABILITY_KEYS) assert.ok(used.has(a), `ability ${a} in something`);
});

test('every ability has its own sound and its own look', () => {
  const audio = fs.readFileSync(new URL('../src/game/audio.js', import.meta.url), 'utf8');
  const fx = fs.readFileSync(new URL('../src/render/abilityfx.js', import.meta.url), 'utf8');
  const src = fs.readFileSync(new URL('../src/game/abilities.js', import.meta.url), 'utf8');
  for (const a of ABILITY_KEYS) {
    assert.ok(audio.includes(`case 'ab_${a}'`), `a sound for ${a}`);
    assert.ok(src.includes(`'ab_${a}'`), `${a} plays it`);
  }
  for (const t of ['sigil', 'shock', 'spikes', 'meteor', 'fissure', 'roots', 'pillar', 'wisp', 'cloud', 'clock', 'star', 'vortex', 'dome', 'slash']) assert.ok(new RegExp(`\\n  ${t}\\(`).test(fx), `an effect drawn: ${t}`);
});

test('forged with a trigger and an ability, the one sets off the other; a trigger alone wakes a modifier', () => {
  let both = null;
  for (let i = 0; i < 60 && !both; i++) {
    const r = forgePiece('iron_sword', 0.95, ['living_amber'], 10, new RNG(i), { cap: 5 });
    both = r.mods.find((m) => m.startsWith('halo-'));
  }
  assert.equal(both, 'halo-struck', 'living amber: a healing aura when struck');
  const d = modOf('blade', both);
  assert.equal(d.ability, 'halo');
  assert.match(modLine('blade', both).text, /Healing Aura when you're struck, often/);
  // A trigger with no ability to set off: one of its modifiers, woken.
  const mods = bindTriggers('blade', ['keen', 'swift'], ['ember_pod'].flatMap((k) => ADDITIVES[k].traits), 1, new RNG(3));
  assert.ok(mods.some((m) => m.endsWith('-crit')), mods.join());
  // An ability that can't go on that kind of gear doesn't.
  assert.ok(!bindTriggers('blade', [], ['shatter', 'mine'], 1, new RNG(1)).some((m) => m.startsWith('shatter')));
  // Named for its first modifier, or for its ability's nature.
  assert.equal(ITEMS[starKey('iron_sword', 3, 'c', 0, ['halo-struck'])].name, 'Radiant Iron Sword');
  assert.ok(describe(starKey('iron_sword', 3, 'c', 0, ['keen', 'meteor-kill'])).mods[1].line.startsWith('☼ Meteor'));
});

test('an old piece of the night reads as one woken at nightfall, and still works only at night', () => {
  const k = 'iron_sword~3c00.keen-night';
  assert.deepEqual(parseStar(k).mods, ['keen-dusk']);
  assert.ok(ITEMS[k], 'still a piece');
  const g = world();
  g.player.inv[0] = { item: k, count: 1 };
  g.player.selected = 0;
  g.isDay = () => true;
  assert.equal(hasMod(g.player, 'blade', 'keen'), false);
  g.isDay = () => false;
  assert.equal(hasMod(g.player, 'blade', 'keen'), true);
  // (Written the new way by the step.)
  const step = stepsFor('1.36.0').find((q) => q.to === '1.37.0');
  const log = [];
  step.game(g, log);
  assert.equal(g.player.inv[0].item, 'iron_sword~3c00.keen-dusk');
  assert.match(log.join(' '), /triggers/);
});

test('struck, a battle-born piece wakes its modifier for a while', () => {
  const g = world();
  const p = g.player;
  wear(g, 'body', starKey('iron_breastplate', 3, 'c', 0, ['sturdy', 'hale-struck']));
  const [w] = wolves(g, 1);
  assert.equal(hasMod(p, 'armor', 'hale'), 0);
  for (let i = 0; i < 40 && !hasMod(p, 'armor', 'hale'); i++) {
    p.hp = p.maxHp;
    g.damage(p, 1, w);
  }
  assert.equal(hasMod(p, 'armor', 'hale'), 1, 'woken by a blow');
  for (let i = 0; i < 130; i++) tickAbilities(g, p, 0.1);
  assert.equal(hasMod(p, 'armor', 'hale'), 0, 'and asleep again after');
});

test('a healing aura comes when struck, works a while on you, and goes', () => {
  const g = world();
  const p = g.player;
  wear(g, 'body', starKey('iron_breastplate', 3, 'c', 0, ['halo-struck']));
  const [w] = wolves(g, 1);
  for (let i = 0; i < 40 && !abilityOn(p, 'halo'); i++) g.damage(p, 1, w);
  assert.ok(abilityOn(p, 'halo'));
  assert.match(p.abOn, /halo/, 'drawn on you (and sent to the others playing)');
  p.hp = Math.max(1, p.maxHp - 6);
  const before = p.hp;
  for (let i = 0; i < 70; i++) tickAbilities(g, p, 0.1);
  assert.ok(p.hp > before, 'mended');
  assert.ok(!p.abOn, 'and gone');
});

test('every ability does what it says, seen and heard', () => {
  for (const a of ABILITY_KEYS) {
    if (a === 'shatter' || a === 'midas' || a === 'seek') continue;
    const g = world();
    const p = g.player;
    const foes = wolves(g, 3);
    const hp0 = foes.map((f) => f.hp);
    const fx = [];
    const eff = g.renderer.effect;
    g.renderer.effect = (o) => {
      fx.push(o.type);
      return eff?.call(g.renderer, o);
    };
    const snd = [];
    g.audio = { play: (n) => snd.push(n) };
    assert.ok(cast(g, p, a, {}, 1), `${a} cast`);
    for (let i = 0; i < 40; i++) tickAbilities(g, p, 0.1);
    assert.ok(fx.includes('sigil'), `${a}: a sigil flares`);
    assert.ok(fx.length >= 2, `${a}: its own look`);
    assert.ok(snd.includes(`ab_${a}`), `${a}: its own sound`);
    const hurt = foes.some((f, i) => f.dead || f.hp < hp0[i] || f.slowT > 0 || f.stunT > 0 || f.poisonT > 0);
    const self = ['halo', 'blades', 'aegis', 'shade', 'quicken', 'rage', 'bramble', 'beacon', 'firewall', 'ironskin', 'pact', 'renew', 'veil', 'gale'].includes(a);
    assert.ok(hurt || self, `${a}: it did something`);
  }
});

test('with no foe about, an ability that wants one does nothing and costs nothing', () => {
  const g = world();
  const p = g.player;
  for (const a of ABILITY_KEYS.filter((k) => ABILITIES[k].foe)) assert.equal(cast(g, p, a, {}, 1), false, a);
  wear(g, 'body', starKey('iron_breastplate', 3, 'c', 0, ['nova-bloodied']));
  assert.equal(fireTrigger(g, p, 'bloodied', {}), false);
});

test('an aegis takes blows; an undying piece will not let a blow kill you, once in a while', () => {
  const g2 = world();
  const q = g2.player;
  const [w] = wolves(g2, 1);
  assert.ok(CAST.aegis);
  cast(g2, q, 'aegis', {}, 1);
  const hp = q.hp;
  g2.damage(q, 3, w);
  assert.equal(q.hp, hp, 'the aegis took it');
  wear(g2, 'body', starKey('iron_breastplate', 3, 'c', 0, ['stasis-deathblow']));
  q._ab.on = {};
  q.hp = 3;
  g2.damage(q, 50, w);
  assert.equal(q.hp, 1, 'held at one heart');
  assert.ok(!q.dead);
  g2.damage(q, 50, w);
  assert.ok(q.dead || q.hp <= 0, 'but not twice in a row');
});

test('a rebind trades what two triggers set off, for a little of the piece\'s makings; what it has stays', () => {
  const g = world();
  const p = g.player;
  const k = starKey('iron_sword', 3, 'c', 7, ['keen', 'halo-struck', 'meteor-kill', 'brutal-crit']);
  p.inv.fill(null);
  p.inv[0] = { item: k, count: 1 };
  p.give('coin', 200);
  p.give('iron_ingot', 3);
  const b = bindings(k);
  assert.equal(b.length, 3);
  const c = rebindCost(k);
  assert.equal(c.item, 'iron_ingot');
  const r = rebind(g, 0, b[0].i, b[1].i);
  assert.ok(r.ok, r.why);
  const sp = parseStar(r.key);
  assert.deepEqual(sp.mods, ['keen', 'halo-kill', 'meteor-struck', 'brutal-crit']);
  assert.equal(sp.stars, 3);
  assert.equal(sp.roll, 7);
  // The same things, the same triggers: only who sets off what.
  const pay = (key) => parseStar(key).mods.map((m) => splitTok(m).p).sort();
  const trig = (key) => parseStar(key).mods.map((m) => splitTok(m).t).sort();
  assert.deepEqual(pay(r.key), pay(k));
  assert.deepEqual(trig(r.key), trig(k));
  assert.equal(countItem(p.inv, 'coin'), 200 - c.coin);
  assert.equal(countItem(p.inv, 'iron_ingot'), 3 - c.n);
  // A modifier with no trigger isn't one of them.
  assert.equal(swappedKey(r.key, 0, 1), null);
  // Without the makings, no.
  p.inv.fill(null);
  p.inv[0] = { item: r.key, count: 1 };
  assert.equal(rebind(g, 0, b[0].i, b[2].i).ok, false);
});

test('the anvil shows a piece\'s triggers and changes them round', () => {
  const g = world();
  const p = g.player;
  const k = starKey('iron_sword', 3, 'c', 7, ['halo-struck', 'meteor-kill']);
  p.inv.fill(null);
  p.inv[0] = { item: k, count: 1 };
  p.give('coin', 200);
  p.give('iron_ingot', 3);
  const ui = g.ui;
  const w = new ReforgeWindow(ui);
  w.sel = 0;
  w.view = 'bind';
  const cells = [];
  const grid = { fill() {}, box() {}, text: (x, y, t) => cells.push(String(t)) };
  w.hits = [];
  w.hit = (x, y, ww, h, fn) => w.hits.push({ y, fn });
  w.hovering = () => false;
  w.draw(grid, g);
  const all = cells.join('\n');
  assert.match(all, /when you're struck/);
  assert.match(all, /Healing Aura/);
  assert.match(all, /Meteor/);
  // Pick one, then the other.
  const rows = w.hits.filter((h) => h.y >= 5 && h.y <= 8);
  rows[0].fn(null, g);
  rows[1].fn(null, g);
  assert.deepEqual(parseStar(p.inv[w.sel].item).mods, ['halo-kill', 'meteor-struck']);
});

test('a bow\'s shot from afar, a tool\'s ore: their own triggers', () => {
  const g = world();
  const p = g.player;
  const bow = starKey('bow', 3, 'c', 0, ['chain-shot']);
  if (!ITEMS[bow]) return;
  p.inv[0] = { item: bow, count: 1 };
  p.selected = 0;
  assert.ok(armedOf(p).some((e) => e.t === 'shot'));
  assert.ok(!modOf('bow', 'chain-crit'), 'a telling blow is a blade\'s');
  assert.ok(modOf('tool', 'shatter-mine'));
  assert.ok(!modOf('armor', 'shatter-struck'), 'a shatterstrike is a tool\'s');
});

test('version 1.37.0', () => {
  assert.ok(compareVersions('1.37.0', GAME_VERSION) <= 0);
  assert.ok(stepsFor('1.36.0').some((q) => q.to === '1.37.0'));
  assert.equal(typeof migrateSave, 'function');
});
