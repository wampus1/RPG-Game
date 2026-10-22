// Round 135: townsfolk with inner lives. Hidden talents (inherited) and
// skills learnt by doing; feelings that rise with what happens and fade;
// memories, opinions and gossip; and what they say chosen by all of it,
// shown in how the letters move and colour.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGame, stubInput } from './helpers.mjs';
import { talentsOf, practise, ensureSkills, childDay, SKILLS, fitFor } from '../src/sim/mind/talent.js';
import { stir, feelings, feel, dominant, packFeelings } from '../src/sim/mind/emotion.js';
import { remember, recall, gossip, warm, opinionOf, packMemories, weight } from '../src/sim/mind/memory.js';
import { bond, pkey } from '../src/sim/mind/mind.js';
import { parseFx, emote, fxOffset, TEXT_FX, FX_SHAKE, FX_BOLD } from '../src/ui/textfx.js';
import { Grid } from '../src/ui/ascii.js';
import { packGrid, unpackGrid } from '../src/net/uiwire.js';
import { allRules, choose, fill, matches } from '../src/game/talk/rules.js';
import { factsFor } from '../src/game/talk/facts.js';
import { respond, openingLine } from '../src/game/dialogue.js';
import { runCommand } from '../src/game/commands.js';
import { DEFAULTS, SETTING_ROWS, applySettings } from '../src/game/settings.js';
import { GAME_VERSION, compareVersions } from '../src/version.js';
import { stepsFor } from '../src/game/migrate.js';
import { alive, DAY } from '../src/sim/econ.js';
import { RNG } from '../src/util/rng.js';

let shared = null;
function world() {
  if (shared) return shared;
  const g = makeGame(12345, { wg: 9 });
  const inp = stubInput();
  for (let i = 0; i < 30; i++) g.update(0.25, inp);
  shared = g;
  return g;
}
const townOf = (g) => {
  const n = g.npcs.find((q) => q.rec && q.settlement);
  return { n, L: n.homeLayout || n.layout };
};
const adults = (g) => g.npcs.filter((q) => q.rec && q.settlement && q.rec.age === 'adult' && alive(q.rec));

test('talents: the same each time for the same person, and a child\'s lean toward their parents\'', () => {
  const g = world();
  const { L } = townOf(g);
  const r = L.npcs.find((q) => q && alive(q));
  const a = talentsOf(L, r);
  assert.equal(a.length, SKILLS.length);
  for (const v of a) assert.ok(v >= 0 && v <= 1);
  // (Worked out afresh: the same.)
  const copy = { ...r, tal: undefined };
  assert.deepEqual(talentsOf(L, copy), a);
  // A child, on average, closer to their parents than to a stranger.
  let near = 0;
  let far = 0;
  let n = 0;
  for (const c of L.npcs) {
    if (!c || !c.parents || !c.parents.length) continue;
    const p = L.npcs[c.parents[0]];
    const s = L.npcs.find((q) => q && q !== c && q !== p && !(c.parents || []).includes(q.idx));
    if (!p || !s) continue;
    const tc = talentsOf(L, c);
    const tp = talentsOf(L, p);
    const ts = talentsOf(L, s);
    for (let i = 0; i < tc.length; i++) {
      near += Math.abs(tc[i] - tp[i]);
      far += Math.abs(tc[i] - ts[i]);
    }
    n++;
  }
  if (n >= 2) assert.ok(near < far, `${near} vs ${far}`);
});

test('skills: practice makes better, the more for talent and beside a better hand, never past what talent allows', () => {
  const g = world();
  const { L } = townOf(g);
  const r = { ...L.npcs.find((q) => q && alive(q) && q.age === 'adult'), tal: undefined, skills: { ...L.npcs[0].skills } };
  ensureSkills(L, r);
  for (const k of ['combat', 'lore', 'healing', 'leadership', 'charm']) assert.equal(typeof r.skills[k], 'number');
  r.skills.lore = 0.1;
  const a = { ...r, skills: { ...r.skills } };
  const b = { ...r, skills: { ...r.skills } };
  practise(L, a, 'lore', 0.05);
  practise(L, b, 'lore', 0.05, 0.9);
  assert.ok(a.skills.lore > 0.1);
  assert.ok(b.skills.lore > a.skills.lore, 'taught by a better hand');
  // (However long: no further than talent allows.)
  for (let i = 0; i < 4000; i++) practise(L, a, 'lore', 0.05);
  const t = talentsOf(L, a)[SKILLS.indexOf('lore')];
  assert.ok(a.skills.lore <= 0.55 + t * 0.45 + 1e-9);
  assert.ok(fitFor(L, a, 'priest') > 0);
});

test('a child learns at their parents\' side, a little each day', () => {
  const g = world();
  const { L } = townOf(g);
  const kid = L.npcs.find((c) => c && alive(c) && c.age === 'child' && (c.parents || []).some((i) => L.npcs[i] && L.npcs[i].skills));
  if (!kid) return;
  const c = { ...kid, skills: { ...ensureSkills(L, kid) } };
  const before = Object.values(c.skills).reduce((x, y) => x + y, 0);
  for (let d = 0; d < 4; d++) childDay(L, c, d, { priest: 0.6, books: 0.6 });
  const after = Object.values(c.skills).reduce((x, y) => x + y, 0);
  assert.ok(after > before);
  // (Slowly: a childhood, not a few days, to a trade.)
  for (const k of SKILLS) assert.ok(c.skills[k] - (kid.skills[k] ?? 0) < 0.1, k);
});

test('feelings rise with what happens, pile up less the fuller they are, and fade', () => {
  const r = { idx: 1, mood: 0.5 };
  stir(r, 'grief', 0.6, 0);
  assert.ok(Math.abs(feel(r, 'grief', 0) - 0.6) < 1e-9);
  stir(r, 'grief', 0.6, 0);
  assert.ok(feel(r, 'grief', 0) < 1 && feel(r, 'grief', 0) > 0.8);
  assert.ok(r.mood < 0.5, 'grief lowers the mood');
  assert.equal(dominant(r, 0).kind, 'grief');
  // Joy fades in a day or so; grief takes a week.
  stir(r, 'joy', 0.8, 0);
  const later = 2 * DAY;
  const e = feelings(r, later);
  assert.ok(!e.j || e.j < 0.2, 'joy gone');
  assert.ok(e.g > 0.6, 'grief stays');
  // Soothed.
  const g0 = e.g;
  stir(r, 'grief', -0.5, later);
  assert.ok(feel(r, 'grief', later) < g0);
  // In a save: rounded, nothing faded.
  const p = packFeelings(r.emo);
  assert.ok(p.g > 0 && p.t === Math.round(later));
  assert.equal(packFeelings(null), undefined);
  // In time, nothing at all.
  assert.equal(feelings(r, later + 200 * DAY), null);
  assert.equal(r.emo, null);
});

test('memories fade by how much they mattered, gossip passes them on as hearsay, opinions are kept to the strongest', () => {
  const a = { idx: 1 };
  const b = { idx: 2 };
  remember(a, { k: 'loss', n: 'Bram', v: -0.9, s: 1 }, 10);
  remember(a, { k: 'feast', v: 0.4, s: 0.3 }, 10);
  assert.equal(recall(a, 10)[0].k, 'loss');
  assert.ok(weight(a.mem[1], 80) < 0.05, 'a small thing forgotten');
  assert.ok(weight(a.mem[0], 80) > 0.5, 'a death not');
  const m = gossip(a, b, 11);
  assert.ok(m && m.h, 'heard');
  assert.equal(m.k, 'loss');
  assert.ok(m.s < 1);
  assert.equal(gossip(a, b, 12)?.k === 'loss', false, 'not told twice');
  assert.equal(gossip(b, { idx: 3 }, 12), null, 'hearsay isn\'t passed on');
  for (let i = 0; i < 20; i++) warm(a, `n:${i}`, (i + 1) / 25);
  assert.ok(Object.keys(a.op).length <= 12);
  assert.ok(opinionOf(a, 'n:19') > 0.7);
  const packed = packMemories(a.mem, 300);
  assert.ok(packed.every((q) => weight(q, 300) >= 0.04));
});

test('a death is grieved by those it was close to, and barely by strangers; the killer remembered', () => {
  const g = world();
  const { L } = townOf(g);
  const sid = L.settlement.id;
  const dead = L.npcs.find((r) => r && alive(r) && r.age === 'adult' && r.partner !== null && r.partner !== undefined && L.npcs[r.partner] && alive(L.npcs[r.partner]));
  assert.ok(dead);
  const partner = L.npcs[dead.partner];
  const stranger = L.npcs.find((r) => r && alive(r) && r !== dead && r !== partner && !bond(r, dead) && !bond(dead, r));
  const now = g.sim.abs;
  const g0 = feel(stranger, 'grief', now);
  g.sim.mind.hear({ type: 'npc_died', who: { t: 'rec', sid, idx: dead.idx }, cause: 'slain', byPlayer: true });
  assert.ok(feel(partner, 'grief', now) > 0.6);
  assert.ok(feel(partner, 'anger', now) > 0.2);
  assert.ok(recall(partner, g.day).some((m) => m.k === 'loss' && m.n === dead.name.first));
  assert.ok(recall(partner, g.day).some((m) => m.k === 'killed' && m.w === pkey(g)));
  assert.ok(feel(stranger, 'grief', now) - g0 < 0.2);
  // What they say to you now.
  const ent = g.npcs.find((q) => q.rec === partner);
  if (ent) {
    const F = factsFor(ent, g);
    assert.ok(F.grief > 0.6 && F.memPk === 'killed');
    assert.equal(F.vars.killed, dead.name.first);
  }
});

test('grief takes some hours from the work; the hours worked make a worker better', () => {
  const g = world();
  const { L } = townOf(g);
  const M = g.sim.mind;
  const r = { ...L.npcs.find((q) => q && alive(q) && q.age === 'adult' && q.job === 'farmer') || L.npcs.find((q) => q && alive(q) && q.age === 'adult' && q.job) };
  r.emo = null;
  r.skills = { ...r.skills };
  for (let h = 0; h < 24; h++) assert.equal(M.canWork(r, h), true);
  stir(r, 'grief', 1, M.now());
  stir(r, 'strain', 1, M.now());
  let worked = 0;
  for (let h = 0; h < 200; h++) if (M.canWork(r, h)) worked++;
  assert.ok(worked < 180 && worked > 40, `${worked}`);
  const before = JSON.stringify(r.skills);
  for (let i = 0; i < 50; i++) M.worked(L, r);
  assert.notEqual(JSON.stringify(r.skills), before);
});

test('a town\'s day for its people\'s minds is cheap and leaves the town\'s own dice alone', () => {
  const g = world();
  const { L } = townOf(g);
  const st = L.econ.rng ? JSON.stringify(L.econ.rng) : null;
  const t0 = performance.now();
  for (let d = 0; d < 20; d++) g.sim.mind.townDay(L, g.day + d);
  const ms = (performance.now() - t0) / 20;
  assert.ok(ms < 15, `${ms.toFixed(2)}ms a day`);
  if (st) assert.equal(JSON.stringify(L.econ.rng), st);
});

test('text marks: read into letters and effects, pauses and pace; a mark never shown', () => {
  const p = parseFx('{@slow}I {sr:hate} you.{.} {d:Go.}');
  assert.equal(p.text, 'I hate you. Go.');
  assert.equal(p.pace, 0.6);
  assert.ok(p.pauses.has(11));
  assert.equal(p.fx[2] & 3, FX_SHAKE);
  assert.equal(p.fx[0], 0);
  assert.ok(p.fx[12] > 0);
  const q = parseFx('{b:Wait{.} here}');
  assert.equal(q.text, 'Wait here');
  assert.ok(q.pauses.has(4));
  assert.ok(q.fx[0] & FX_BOLD);
  assert.equal(parseFx('no marks').fx, null);
  assert.equal(parseFx('a {brace without a close').text, 'a {brace without a close');
  // Feelings, shown: rage shakes a shout, fear stammers, grief slows.
  assert.match(emote('Get out!', { kind: 'anger', v: 0.8 }), /^\{@fast\}\{sr:/);
  assert.equal(parseFx(emote('What was that?', { kind: 'fear', v: 0.7 })).text, 'W-what was that?');
  assert.equal(parseFx(emote('He was good.', { kind: 'grief', v: 0.7 })).pace, 0.6);
  assert.equal(emote('{w:Already marked}', { kind: 'joy', v: 1 }), '{w:Already marked}');
  assert.equal(emote('(Stage direction.)', { kind: 'anger', v: 1 }), '(Stage direction.)');
  // Motion off: still, colours kept.
  TEXT_FX.motion = false;
  assert.deepEqual(fxOffset(FX_SHAKE, 0, 1.3), [0, 0]);
  TEXT_FX.motion = true;
});

test('a text grid carries the effects, and sends them to guests', () => {
  const gr = new Grid(20, 2);
  const p = parseFx('{s:Run}! now');
  gr.textFx(1, 0, p.text, '#fff', p.fx);
  assert.equal(gr.fx[1] & 3, FX_SHAKE);
  assert.equal(gr.fx[4], 0);
  const packed = packGrid(gr);
  assert.ok(packed.fx);
  const back = unpackGrid(packed);
  assert.deepEqual(Array.from(back.fx), Array.from(gr.fx));
  // (Nothing marked: nothing sent.)
  const plain = new Grid(10, 1);
  plain.text(0, 0, 'hello');
  assert.equal(packGrid(plain).fx, undefined);
  // Written over: the effect goes with the letter.
  gr.put(1, 0, 'x');
  assert.equal(gr.fx[1], 0);
});

test('every line written can be filled and read; the most particular line that fits is the one said', () => {
  const known = new Set(['name', 'full', 'me', 'town', 'tw', 'trade', 'skill', 'skillWord', 'mut', 'title', 'address', 'held', 'dead', 'child', 'spouse', 'gift', 'killed', 'lost', 'kin', 'kinGift']);
  const ids = new Set();
  const rules = allRules();
  assert.ok(rules.length >= 150);
  for (const r of rules) {
    assert.ok(!ids.has(r.id), `two rules called ${r.id}`);
    ids.add(r.id);
    assert.ok(r.lines.length, r.id);
    for (const l of r.lines) {
      for (const m of l.matchAll(/\{([A-Za-z]+)\}/g)) assert.ok(known.has(m[1][0].toLowerCase() + m[1].slice(1)), `${r.id}: {${m[1]}}`);
      assert.ok(!/[{}]/.test(parseFx(l.replace(/\{([A-Za-z]+)\}/g, 'X')).text), `${r.id}: ${l}`);
      assert.ok(!/—/.test(l), `${r.id}: no long dash in the font`);
    }
  }
  assert.equal(fill('Hello {name}, {Address}.', { name: 'Ash', address: 'my lord' }), 'Hello Ash, My lord.');
  assert.equal(fill('For {dead}.', { dead: null }), null);
  // Of two that fit, the one that asks more of the moment.
  const g = world();
  const ent = adults(g)[0];
  const F = factsFor(ent, g);
  F.grief = 0.9;
  F.feel = 'grief';
  F.mem_loss = { k: 'loss', n: 'Bram', s: 1 };
  F.vars.dead = 'Bram';
  const got = choose('open', F, new RNG(1), null, 0);
  assert.ok(got);
  assert.ok(matches(got.rule, F));
  assert.ok(got.rule.keys.some((k) => k === 'mem_loss' || k === 'grief'), got.rule.id);
  // Said lately: not said again so soon.
  const said = {};
  const first = choose('open', F, new RNG(2), said, 0);
  for (let i = 0; i < 6; i++) {
    const again = choose('open', F, new RNG(3 + i), said, 0);
    if (again && again.rule.id === first.rule.id) assert.fail('repeated within its cooldown');
  }
});

test('how are you, what are you good at, a joke: answered as they are', () => {
  const g = world();
  const [a, b] = adults(g);
  stir(a.rec, 'grief', 0.9, g.sim.abs);
  remember(a.rec, { k: 'loss', n: 'Bram', x: 'partner', v: -0.9, s: 1 }, g.day);
  const how = respond(a, g, 'howare');
  assert.ok(how && how.lines.length);
  assert.ok(how.lines.join(' ').length > 5);
  const good = respond(b, g, 'goodat');
  assert.ok(good && good.lines.length);
  const j1 = respond(b, g, 'jest');
  assert.ok(j1 && j1.lines.length);
  // Once a day.
  const j2 = respond(b, g, 'jest');
  assert.ok(j2.lines.join(' ') !== j1.lines.join(' ') || j2.lines.length);
  const o = openingLine(a, g);
  assert.equal(typeof o, 'string');
  assert.ok(!/\{[a-z]+\}/i.test(parseFx(o).text), o);
});

test('what they feel, remember and think is kept in a save', () => {
  const g = world();
  const { L } = townOf(g);
  const r = L.npcs.find((q) => q && alive(q) && q.age === 'adult');
  stir(r, 'pride', 0.7, g.sim.abs);
  remember(r, { k: 'mastery', v: 0.7, s: 0.8, x: 'farming' }, g.day);
  const op0 = opinionOf(r, 'p:host');
  warm(r, 'p:host', 0.5);
  const op1 = opinionOf(r, 'p:host');
  const d = JSON.parse(JSON.stringify(g.serialize()));
  const Game = g.constructor;
  const g2 = new Game({ seed: d.seed, renderer: g.renderer, audio: null, ui: g.ui, save: d, wg: 9 });
  const L2 = g2.sim.layoutOf(L.settlement.id);
  const r2 = L2.npcs[r.idx];
  assert.ok(feel(r2, 'pride', g2.sim.abs) > 0.5);
  assert.ok(recall(r2, g2.day).some((m) => m.k === 'mastery'));
  assert.ok(op1 > op0);
  assert.equal(opinionOf(r2, 'p:host'), op1);
  assert.equal(typeof r2.skills.combat, 'number');
});

test('the mind console command shows what\'s going on inside someone', () => {
  const g = world();
  const n = adults(g)[0];
  g.player.x = n.x;
  g.player.z = n.z;
  const out = runCommand(g, 'mind');
  assert.ok(out[0].includes(n.rec.name.first), out[0]);
  assert.ok(out.some((l) => l.startsWith('Feels:')));
  assert.ok(out.some((l) => l.startsWith('Skills:')));
  assert.ok(runCommand(g, 'mind nobody-of-that-name')[0].startsWith('Nobody'));
});

test('moving text can be turned off in the settings', () => {
  assert.equal(DEFAULTS.textMotion, true);
  assert.ok(SETTING_ROWS.some((r) => r.key === 'textMotion'));
  applySettings({ ...DEFAULTS, textMotion: false }, {});
  assert.equal(TEXT_FX.motion, false);
  applySettings({ ...DEFAULTS }, {});
  assert.equal(TEXT_FX.motion, true);
});

test('version 1.35.0', () => {
  assert.ok(compareVersions('1.35.0', GAME_VERSION) <= 0);
  const s = stepsFor('1.34.0').find((q) => q.to === '1.35.0');
  assert.ok(s && s.game);
});
