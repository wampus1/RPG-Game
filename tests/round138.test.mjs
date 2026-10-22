// Round 138: more triggers (a heavy blow, one of the dead struck, eating,
// the last foe falling, a blow from afar or from behind, a broken guard, a
// fish landed, a foe felled at a blow, daybreak, rain) and more abilities
// (a wall of flame, a geyser, ironskin, a blood pact, a chain hook, a frost
// lance, a swarm, a well of night, a spring bloom, a smoke veil, a spirit
// wolf, a gale step); and every ability's look redrawn the way the world
// is drawn: whole pixels, a few shades of each colour, a stipple for a
// fade, a frame at a time.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { makeGame } from './helpers.mjs';
import { Creature } from '../src/entities/creature.js';
import { starKey } from '../src/world/quality.js';
import { TRIGGERS, ABILITIES, ABILITY_KEYS, TRIGGER_KEYS } from '../src/world/triggers.js';
import { ADDITIVES } from '../src/world/smithmats.js';
import { cast, fireTrigger, tickAbilities, abilityOn, abSoak, abBlow, abKill, abState } from '../src/game/abilities.js';
import { PALS } from '../src/render/abilityfx.js';
import { GAME_VERSION, compareVersions } from '../src/version.js';
import { stepsFor } from '../src/game/migrate.js';

const world = () => makeGame(12345, { wg: 9 });
const NEW_T = ['smash', 'undead', 'eat', 'victory', 'shotat', 'back', 'guardbreak', 'fish', 'oneshot', 'dawn', 'rain'];
const NEW_A = ['firewall', 'geyser', 'ironskin', 'pact', 'hook', 'lance', 'swarm', 'well', 'renew', 'veil', 'spirit', 'gale'];
const wolf = (g, dx, dz) => {
  const p = g.player;
  const w = new Creature(g, 'wolf', p.x + dx, p.y, p.z + dz);
  g.addCreature(w);
  w.angry = true;
  w.target = p;
  return w;
};
const wear = (g, key) => {
  g.player.equip.body = key;
  return key;
};

test('more triggers and abilities, each in something that goes into the forge', () => {
  for (const t of NEW_T) assert.ok(TRIGGERS[t], t);
  for (const a of NEW_A) assert.ok(ABILITIES[a], a);
  assert.ok(TRIGGER_KEYS.length >= 38 && ABILITY_KEYS.length >= 38);
  const used = new Set(Object.values(ADDITIVES).flatMap((a) => a.traits));
  for (const k of [...NEW_T, ...NEW_A]) assert.ok(used.has(k), `${k} in an additive`);
  // Every ability drawn in a palette of its own kind of light.
  for (const a of ABILITY_KEYS) assert.ok(PALS[ABILITIES[a].pal], `${a} has a palette`);
  const audio = fs.readFileSync(new URL('../src/game/audio.js', import.meta.url), 'utf8');
  for (const a of NEW_A) assert.ok(audio.includes(`case 'ab_${a}'`), `a sound for ${a}`);
});

test('the abilities are drawn as the world is: whole pixels, no soft blurs', () => {
  const src = fs.readFileSync(new URL('../src/render/abilityfx.js', import.meta.url), 'utf8');
  for (const bad of ['createRadialGradient', 'createLinearGradient', "'lighter'", '.arc(', '.ellipse(', '.stroke(']) assert.ok(!src.includes(bad), `no ${bad}`);
  for (const t of ['firewall', 'geyser', 'chain', 'lance', 'swarm', 'well', 'bloom', 'smoke', 'spirit', 'bite', 'gust']) assert.ok(new RegExp(`\\n  ${t}\\(`).test(src), `an effect drawn: ${t}`);
  // Each palette a ramp of five shades, dark to light.
  const lum = (h) => [1, 3, 5].reduce((s, i) => s + parseInt(h.slice(i, i + 2), 16), 0);
  for (const [k, P] of Object.entries(PALS)) {
    assert.equal(P.length, 5, k);
    assert.ok(lum(P[0]) < lum(P[2]) && lum(P[2]) < lum(P[4]), `${k} runs dark to light`);
  }
});

test('each new ability does what it says, seen and heard', () => {
  for (const a of NEW_A) {
    const g = world();
    const p = g.player;
    const foes = [wolf(g, 2, 0), wolf(g, 3, 1), wolf(g, -2, 1)];
    for (const f of foes) f.hp = f.maxHp = 200;
    const fx = [];
    const eff = g.renderer.effect;
    g.renderer.effect = (o) => {
      fx.push(o.type);
      return eff?.call(g.renderer, o);
    };
    const snd = [];
    g.audio = { play: (n) => snd.push(n) };
    p.burnT = 3;
    assert.ok(cast(g, p, a, {}, 1), `${a} cast`);
    for (let i = 0; i < 60; i++) tickAbilities(g, p, 0.1);
    assert.ok(fx.includes('sigil') && fx.length >= 2, `${a}: its look`);
    assert.ok(snd.includes(`ab_${a}`), `${a}: its sound`);
    if (a === 'renew') assert.ok(!(p.burnT > 0), 'spring bloom puts out the fire on you');
    if (ABILITIES[a].foe) assert.ok(foes.some((f) => f.dead || f.hp < 200 || f.stunT > 0 || f.frozenT > 0), `${a}: a foe felt it`);
  }
});

test('ironskin turns a third of a blow; a smoke veil turns half of them; a blood pact mends', () => {
  const g = world();
  const p = g.player;
  const w = wolf(g, 1, 0);
  cast(g, p, 'ironskin', {}, 1);
  assert.equal(abSoak(g, p, w, 9), 6);
  const g2 = world();
  const q = g2.player;
  const w2 = wolf(g2, 1, 0);
  cast(g2, q, 'veil', {}, 1);
  let missed = 0;
  for (let i = 0; i < 200; i++) if (abSoak(g2, q, w2, 3) === 0) missed++;
  assert.ok(missed > 60 && missed < 140, `${missed} of 200 lost in the smoke`);
  const g3 = world();
  const r = g3.player;
  const w3 = wolf(g3, 1, 0);
  w3.hp = w3.maxHp = 100;
  cast(g3, r, 'pact', {}, 1);
  r.hp = r.maxHp - 5;
  const before = r.hp;
  g3.damage(w3, 2, r);
  assert.ok(r.hp > before, 'a blow landed mends you');
});

test('the new triggers come when they should', () => {
  const g = world();
  const p = g.player;
  wear(g, starKey('iron_breastplate', 3, 'c', 0, ['hale-back', 'fleet-shotat']));
  p.dir = 0;
  const st = abState(p);
  const live = (m, t) => (st.surge[`armor.${m}.${t}`] || 0) > st.t;
  // Struck from behind (facing +z, struck from -z).
  const behind = wolf(g, 0, -1);
  abBlow(g, p, behind, 1);
  assert.ok(live('hale', 'back'), 'from behind');
  // From afar (and only by chance: try a few).
  const far = wolf(g, 4, 0);
  for (let i = 0; i < 30 && !live('fleet', 'shotat'); i++) abBlow(g, p, far, 1);
  assert.ok(live('fleet', 'shotat'), 'from afar');
  // The last foe about you falling; and daybreak.
  const g2 = world();
  const q = g2.player;
  q.inv[0] = { item: starKey('iron_sword', 3, 'c', 0, ['keen-victory', 'swift-oneshot']), count: 1 };
  q.selected = 0;
  const lone = wolf(g2, 1, 0);
  abKill(g2, q, lone);
  assert.ok((abState(q).surge['blade.keen.victory'] || 0) > abState(q).t, 'the last of them');
  lone.hp = 0;
  abBlow(g2, lone, q, 1, false, true);
  assert.ok((abState(q).surge['blade.swift.oneshot'] || 0) > abState(q).t, 'felled at a blow');
  const g3 = world();
  const r = g3.player;
  wear(g3, starKey('iron_breastplate', 3, 'c', 0, ['halo-dawn']));
  let day = false;
  g3.isDay = () => day;
  tickAbilities(g3, r, 0.1);
  day = true;
  tickAbilities(g3, r, 0.1);
  assert.ok(abilityOn(r, 'halo'), 'daybreak');
  assert.ok(fireTrigger);
});

test('a wall of flame burns whatever stands in it', () => {
  const g = world();
  const p = g.player;
  p.dir = 3;
  const w = wolf(g, 2, 0);
  w.hp = w.maxHp = 200;
  cast(g, p, 'firewall', {}, 1);
  for (let i = 0; i < 20; i++) tickAbilities(g, p, 0.1);
  assert.ok(w.burnT > 0 || w.hp < 200);
});

test('version 1.38.0', () => {
  assert.ok(compareVersions('1.38.0', GAME_VERSION) <= 0);
  assert.ok(stepsFor('1.37.0').some((q) => q.to === '1.38.0'));
});
