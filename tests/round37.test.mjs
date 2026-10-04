import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGame, stubInput } from './helpers.mjs';
import { B, planksOf, PLANK_BLOCKS } from '../src/world/blocks.js';
import { SURFACE } from '../src/config.js';
import { M } from '../src/world/settlement.js';
import { lockTier, chestTier } from '../src/game/lockpick.js';
import { Creature } from '../src/entities/creature.js';
import { THEMES, Music, musicMood, flavourTheme, nightTheme, isleTheme, voiceChord, bossLevel } from '../src/game/music.js';
import { SCALES, KITS, ARPS, chordDegs, degMidi, motif, line, bassBar } from '../src/game/compose.js';
import { PATCH, DRUM, LOUD, Rack, Samples, master } from '../src/game/synth.js';

// One world for the looking-only tests (making one takes a while).
let shared = null;
const world = () => (shared ||= makeGame(12345));
function start(seed = 12345, minute = 12 * 60) {
  const game = makeGame(seed);
  const input = stubInput();
  game.minute = minute;
  for (let i = 0; i < 20; i++) game.update(0.1, input);
  return { game, input, p: game.player };
}

// The plainest of sound cards: gains, filters, oscillators, buffers, and
// nothing else (no rooms, no echoes, no panning, no drawn waves). Counts
// what's made of it.
function fakeCtx() {
  const made = { osc: 0, saw: 0, src: 0 };
  const param = () => ({ value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {}, setTargetAtTime() {}, cancelScheduledValues() {} });
  const node = () => ({ connect: (n) => n, disconnect() {}, start() {}, stop() {}, gain: param(), frequency: param(), detune: param(), playbackRate: param(), type: '' });
  const ctx = {
    currentTime: 0, state: 'running', sampleRate: 8000, destination: node(),
    createGain: node, createBiquadFilter: node,
    createBufferSource() {
      made.src++;
      return node();
    },
    createBuffer: (ch, n) => ({ getChannelData: () => new Float32Array(n) }),
    createOscillator() {
      made.osc++;
      const o = node();
      return new Proxy(o, { set(obj, k, v) {
        if (k === 'type' && v === 'sawtooth') made.saw++;
        obj[k] = v;
        return true;
      } });
    },
  };
  return { ctx, made };
}
// A tune playing on it (not on a timer: stepped by hand).
function voiceOn(key) {
  const { ctx, made } = fakeCtx();
  const m = new Music({ ctx });
  m.update(0.016, key, true);
  globalThis.clearInterval(m.timer);
  return { m, v: m.voice, made };
}

// ------------------------------------------------------------ chests
test('a town hall\'s chests are locked under an advanced lock, and a shop\'s are locked too', () => {
  const { game } = start();
  const s = game.world.ow.settlements.find((q) => q.condition !== 'abandoned' && !q.deserted && q.type !== 'village' && game.world.getLayout(q).treasury?.length);
  assert.ok(s, 'a town with a treasury');
  const L = game.world.getLayout(s);
  game.loadAround(L.plaza.cx, L.plaza.cz, true);
  const { x, y, z } = L.treasury[0];
  assert.equal(game.world.getBlock(x, y, z), B.chest);
  const owner = game.containerOwner(x, y, z);
  assert.equal(owner.kind, 'biz');
  assert.equal(owner.b.type, 'townhall');
  assert.ok(game.chestLocked(x, y, z), 'the coffers are locked');
  assert.equal(lockTier(s, owner), 4, 'an advanced lock');
  assert.equal(lockTier({ type: 'village' }, owner), 3, 'a village\'s hall: still a good one');
  // (A household's is as it was.)
  assert.equal(lockTier(s, { b: { type: 'house_s' } }), chestTier(s.type, 'house_s'));
  // A shop's own chests, its keeper not about to share them.
  const chests = [];
  for (const b of L.buildings) {
    if (b.residential || b.type === 'townhall' || b.x0 === undefined || game.sim.careers.onShift(s.id, b.id)) continue;
    for (let y = SURFACE; y <= SURFACE + 3; y++) for (let z = b.z0; z <= b.z1; z++) for (let x = b.x0; x <= b.x1; x++) if (game.world.getBlock(x, y, z) === B.chest) chests.push({ x, y, z, b });
  }
  assert.ok(chests.length, 'shops keep chests');
  for (const q of chests) {
    assert.equal(game.containerOwner(q.x, q.y, q.z).kind, 'biz');
    assert.ok(game.chestLocked(q.x, q.y, q.z), `the ${q.b.type}'s chest is locked`);
  }
  const c = chests[0];
  game.ui.msgs.length = 0;
  game.interact(c.x, c.y, c.z);
  assert.ok(game.ui.msgs.some((t) => /locked/i.test(t)), 'and says so');
});

// ------------------------------------------------------------ the square
test('a square\'s ways across are kept clear, and a ring round what stands in its middle', () => {
  const game = world();
  let towns = 0;
  let stalls = 0;
  for (const s of game.world.ow.settlements.filter((q) => q.condition !== 'abandoned').slice(0, 16)) {
    const L = game.world.getLayout(s);
    const p = L.plaza;
    if (!p) continue;
    const w = p.x1 - p.x0 + 1;
    const d = p.z1 - p.z0 + 1;
    if (s.type === 'village') assert.ok(w >= 9 && d >= 7, `${s.name}: ${w}x${d}`);
    else if (s.type === 'town') assert.ok(w >= 17 && d >= 10, `${s.name}: ${w}x${d}`);
    let lanes = 0;
    for (let z = p.z0; z <= p.z1; z++) {
      for (let x = p.x0; x <= p.x1; x++) {
        // (The ways meet at what stands in the middle, and go round it.)
        if (!L.isLane(x, z) || Math.max(Math.abs(x - p.cx), Math.abs(z - p.cz)) <= 1) continue;
        lanes++;
        assert.notEqual(L.maskAt(x, z), M.DECOR, `${s.name}: something stands across a way at ${x - p.cx},${z - p.cz}`);
      }
    }
    assert.ok(lanes > 0);
    // (The ring about the middle is always a way.)
    for (const [dx, dz] of [[2, 0], [-2, 0], [0, 3], [3, 3], [-3, -2]]) assert.ok(L.isLane(p.cx + dx, p.cz + dz), `${s.name}: ring at ${dx},${dz}`);
    if (s.type !== 'village') {
      towns++;
      stalls += L.spotsByTag('market').length;
    }
  }
  assert.ok(towns > 0 && stalls > 0, `the market's still there (${stalls} stalls in ${towns} towns)`);
});

// ------------------------------------------------------------ planks
test('each island\'s towns cross water on their own planks, not oak', () => {
  assert.equal(planksOf('ember'), B.planks_cinder);
  assert.equal(planksOf('mist'), B.planks_bog);
  assert.equal(planksOf('tide'), B.planks_drift);
  assert.equal(planksOf('vale'), B.planks);
  for (const id of [B.planks_cinder, B.planks_bog, B.planks_drift]) assert.ok(PLANK_BLOCKS.has(id));
  const game = world();
  for (const [style, plank] of [['ember', B.planks_cinder], ['mist', B.planks_bog], ['tide', B.planks_drift]]) {
    const towns = game.world.ow.settlements.filter((s) => s.style === style && s.condition !== 'abandoned');
    assert.ok(towns.length, style);
    for (const s of towns.slice(0, 3)) {
      const L = game.world.getLayout(s);
      assert.equal(L.mats.bridge, plank, `${s.name}'s bridges`);
      game.loadAround(L.plaza.cx, L.plaza.cz, true);
      const b = s.bounds;
      for (let z = b.z0; z <= b.z1; z++) {
        for (let x = b.x0; x <= b.x1; x++) {
          if (L.maskAt(x, z) !== M.BRIDGE) continue;
          const id = game.world.getBlock(x, SURFACE, z);
          if (id !== B.air) assert.notEqual(id, B.planks, `${s.name}: oak over the water at ${x},${z}`);
        }
      }
    }
  }
});

// ------------------------------------------------------------ the music
test('every theme (and every way it\'s played) is made of real instruments, drums and modes', () => {
  const ok = (T, k) => {
    assert.ok(SCALES[T.scale], `${k}: ${T.scale}`);
    for (const role of ['lead', 'counter', 'pad', 'keys', 'arp', 'bass']) if (T[role]) assert.ok(PATCH[T[role]] && LOUD[T[role]], `${k}.${role}: ${T[role]}`);
    if (T.kit) assert.ok(KITS[T.kit], `${k}: ${T.kit}`);
    if (T.arpStyle) assert.ok(ARPS[T.arpStyle], `${k}: ${T.arpStyle}`);
    assert.ok(T.prog.length && T.prog.every(Number.isInteger), k);
    assert.ok(!T.progB || T.progB.every(Number.isInteger), k);
    assert.ok(T.bpm > 30 && T.bpm < 200, k);
  };
  for (const [k, T] of Object.entries(THEMES)) {
    ok(T, k);
    if (T.grand) continue;
    ok(nightTheme({ ...T }), `${k}:night`);
    for (const isle of ['kharos', 'myrrow']) ok(isleTheme({ ...T }, isle), `${k}~${isle}`);
  }
  for (const k of ['village', 'town', 'city']) {
    for (const style of ['vale', 'north', 'sun', 'wild', 'high']) {
      for (const f of ['thriving', 'steady', 'struggling']) {
        ok(flavourTheme({ ...THEMES[k] }, style, f), `${k}@${style}.${f}`);
        ok(nightTheme(flavourTheme({ ...THEMES[k] }, style, f)), `${k}@${style}.${f}:night`);
      }
    }
  }
});

test('the music knows what you\'re fighting: a wolf is a hunt, a skeleton the night\'s, bandits an outlaw\'s', () => {
  const { game, p } = start();
  const wolf = new Creature(game, 'wolf', p.x + 2, p.y, p.z);
  assert.ok(wolf.beast);
  wolf.angry = true;
  wolf.target = p;
  game.creatures.push(wolf);
  assert.equal(musicMood(game), 'fight_beasts');
  const skel = new Creature(game, 'skeleton', p.x - 2, p.y, p.z);
  assert.ok(!skel.beast);
  skel.target = p;
  game.creatures.push(skel);
  assert.equal(musicMood(game), 'fight_monsters', 'anything of the night among them: the night\'s music');
  game.creatures = [];
  game.combatT = 0;
  // Bandits on you.
  game.npcs.push({ dead: false, threat: p, state: 'fight', rec: { bandit: 1 }, distTo: () => 4 });
  assert.equal(musicMood(game), 'fight_bandits');
  game.npcs.pop();
  // A fight lingers a few seconds after the blows (as what you were fighting).
  game.combatT = 3;
  game.combatWith = 'beast';
  assert.equal(musicMood(game), 'fight_beasts');
  game.combatWith = 'bandit';
  assert.equal(musicMood(game), 'fight_bandits');
  game.combatT = 0;
  for (const k of ['fight_beasts', 'fight_monsters', 'fight_guards', 'fight_bandits']) assert.ok(THEMES[k].form === 'drive', k);
  assert.notEqual(THEMES.fight_beasts.kit, THEMES.fight_monsters.kit);
  assert.ok(!KITS[THEMES.fight_beasts.kit].snare, 'the hunt has no snare');
});

test('a town\'s music sounds like how it\'s doing: brighter and fuller when it thrives, sadder and sparer when it struggles', () => {
  const T = THEMES.town;
  const rich = flavourTheme({ ...T }, 'vale', 'thriving');
  const poor = flavourTheme({ ...T }, 'vale', 'struggling');
  assert.ok(rich.bpm > T.bpm && poor.bpm < T.bpm);
  assert.ok(rich.counter && rich.arp, 'more playing');
  assert.equal(rich.kit, 'city', 'a fuller kit');
  assert.ok(rich.tone > T.tone && poor.tone < T.tone);
  assert.equal(poor.scale, 'dorian', 'sad, not hopeless');
  assert.equal(poor.lead, 'ep', 'the tune alone on a soft piano');
  assert.ok(!poor.keys && !poor.arp && !poor.counter);
  assert.equal(poor.pad, 'warm');
  // Each people its own instruments.
  assert.equal(flavourTheme({ ...T }, 'sun', 'steady').lead, 'koto');
  assert.equal(flavourTheme({ ...T }, 'north', 'steady').lead, 'horn');
  assert.equal(flavourTheme({ ...T }, 'high', 'steady').kit, 'march');
  // By night: slower, softer, no drum machine.
  const n = nightTheme({ ...T });
  assert.ok(n.bpm < T.bpm && n.shimmer && n.form === 'calm');
  assert.equal(n.lead, 'kalimba');
  assert.equal(n.kit, 'soft');
  // Down below it's ominous: dark modes, a cave's ring, slow.
  for (const k of ['dungeon_barrow', 'dungeon_mine', 'dungeon_crypt', 'dungeon_kavorent']) {
    assert.ok(['cave', 'cathedral'].includes(THEMES[k].space), k);
    assert.ok(THEMES[k].bpm < 70 && THEMES[k].mood !== 'bright', k);
  }
  // The islands' instruments.
  assert.equal(isleTheme({ ...THEMES.beach }, 'kharos').lead, 'buzz');
  assert.equal(isleTheme({ ...THEMES.beach }, 'kharos').kit, 'forge');
  assert.equal(isleTheme({ ...THEMES.beach }, 'myrrow').lead, 'reed');
});

test('a tune is played in a form: an intro, the tune, its middle on other chords, the tune with more round it, a break', () => {
  const { v } = voiceOn('town@vale.steady');
  const seen = [];
  const layers = v.layers.bind(v);
  v.layers = () => {
    const L = layers();
    seen.push({ part: v.partName, lead: L.lead, counter: L.counter, arp: L.arp, drums: L.drums });
    return L;
  };
  const chords = [];
  const startBar = v.startBar.bind(v);
  v.startBar = (t) => {
    startBar(t);
    chords.push([v.partName, v.chord]);
  };
  v.schedule(150);
  const parts = seen.map((q) => q.part);
  assert.equal(parts[0], 'intro');
  assert.ok(!seen[0].lead, 'no tune in the intro');
  const order = parts.filter((q, i) => q !== parts[i - 1]);
  assert.deepEqual(order.slice(0, 6), ['intro', 'A', 'B', 'A2', 'break', 'A'], 'round again from the tune, not the intro');
  assert.ok(seen.some((q) => q.part === 'A' && q.lead && !q.counter));
  assert.ok(seen.some((q) => q.part === 'A2' && q.lead && q.counter), 'the flute answering, second time');
  assert.ok(seen.some((q) => q.part === 'break' && !q.lead));
  assert.ok(chords.filter(([p]) => p === 'B').every(([, c]) => THEMES.town.progB.includes(c)), 'the middle on its own chords');
  // A calm one breathes: drums only once the tune's begun, none in its air.
  const calm = voiceOn('plains').v;
  const cs = [];
  const cl = calm.layers.bind(calm);
  calm.layers = () => {
    const L = cl();
    cs.push({ part: calm.partName, drums: L.drums });
    return L;
  };
  calm.schedule(200);
  assert.ok(cs.filter((q) => q.part === 'intro' || q.part === 'air').every((q) => !q.drums));
  assert.ok(cs.some((q) => q.part === 'A' && q.drums));
});

test('a master\'s music climbs with the fight: heavy, then driving, then savage, the key lifted', () => {
  const { m, v, made } = voiceOn('dungeon_barrow_boss:p1');
  assert.equal(bossLevel('p3'), 3);
  v.schedule(4);
  assert.equal(v.kitName(), 'grand');
  assert.ok(made.saw > 0, 'the drone and the choir');
  const root = v.T.root;
  m.update(0.016, 'dungeon_barrow_boss:p2');
  assert.equal(m.voice, v);
  v.schedule(30);
  assert.equal(v.kitName(), 'grand2');
  m.update(0.016, 'dungeon_barrow_boss:p3');
  v.schedule(120);
  assert.equal(v.kitName(), 'fury');
  assert.equal(v.T.root, root + 1, 'up a step for the end');
  assert.equal(v.lv, 3);
});

test('chords are voiced to move as little as they can; tunes ask and answer over them', () => {
  const C = voiceChord([60, 64, 67], 55, 72);
  assert.ok(C.every((n) => n >= 55 && n <= 72));
  const F = voiceChord([65, 69, 72], 55, 72, C);
  const moved = F.reduce((a, n, i) => a + Math.abs(n - C[i]), 0);
  assert.ok(moved <= 5, `C to F moves ${moved}`);
  assert.deepEqual([...new Set(F.map((n) => n % 12))].sort((a, b) => a - b), [0, 5, 9]);
  // A phrase closed on its root; an open one on the fifth (or the second).
  let r = 7;
  const rand = () => ((r = (r * 16807) % 2147483647) / 2147483647);
  const T = { scale: 'major' };
  const pc = (d) => ((d % 7) + 7) % 7;
  for (let k = 0; k < 20; k++) {
    const M = motif(rand, 16, 0.5, 'calm');
    // (Home, where the last chord has it; else that chord's root.)
    const home = line(T, rand, M, [0, 4, 5, 3], { close: true, lo: -1, hi: 9 });
    assert.equal(pc(home[3].at(-1).deg), 0, 'closed at home');
    const closed = line(T, rand, M, [0, 5, 3, 4], { close: true, lo: -1, hi: 9 });
    assert.equal(pc(closed[3].at(-1).deg), 4, 'closed on the chord');
    const open = line(T, rand, M, [0, 5, 3, 4], { close: false, lo: -1, hi: 9 });
    assert.ok([1, 5].includes(pc(open[3].at(-1).deg)), 'left open');
    assert.equal(closed.length, 4);
    // Strong beats on the chord's own notes.
    for (let b = 0; b < 3; b++) {
      const chord = chordDegs([0, 5, 3, 4][b]).map((d) => ((d % 7) + 7) % 7);
      for (const n of closed[b]) if (n.s % 4 === 0) assert.ok(chord.includes(((n.deg % 7) + 7) % 7), `bar ${b} step ${n.s}`);
    }
  }
  assert.equal(degMidi(60, 'major', 7), 72);
  assert.ok(bassBar('walk', 0, 3, 16).length === 4);
});

test('every instrument and drum plays on the plainest sound card, and the drums come from samples once struck', () => {
  const { ctx, made } = fakeCtx();
  const music = { ctx, noise: ctx.createBuffer(1, 100, 8000) };
  const out = master(ctx, ctx.destination);
  const R = new Rack(music, out, { echo: 0.2 });
  const ch = R.chan('x', { pan: 0.3, verb: 0.3, echo: 0.3, chorus: true });
  for (const k of Object.keys(PATCH)) {
    R.play(k, ch, 220, 0, 0.5, 1, {});
    R.play(k, ch, [220, 277, 330], 1, 0.5, 1, { trem: true, deep: true, stab: true });
  }
  for (const k of Object.keys(DRUM)) R.hit(k, ch, 0, 1, { dur: 1, pitch: 1.2, f: 90 });
  assert.ok(made.osc > 50);
  // (No offline card here: struck live.)
  const S = new Samples(ctx, music.noise);
  assert.equal(S.get('kick'), null);
  // Where there is one, a drum's struck once, then played back.
  const renders = [];
  const OAC = class {
    constructor() {
      const f = fakeCtx().ctx;
      Object.assign(this, f);
    }
    startRendering() {
      renders.push(1);
      return Promise.resolve({ tag: 'buf' });
    }
  };
  globalThis.OfflineAudioContext = OAC;
  try {
    const S2 = new Samples(ctx, music.noise);
    assert.equal(S2.get('snare'), null, 'not yet');
    assert.equal(S2.get('snare'), null, 'still not');
    assert.equal(renders.length, 1, 'struck once');
    return Promise.resolve().then(() => new Promise((res) => setTimeout(res, 0))).then(() => {
      const s = S2.get('snare');
      assert.ok(s && s.buf.tag === 'buf' && s.rate === 1);
      const before = made.src;
      music.samples = S2;
      R.hit('snare', ch, 2, 0.8);
      assert.equal(made.src, before + 1, 'played from its sample');
      // A tom's one sample, played faster for a higher one.
      S2.buf.tom = { tag: 'tom' };
      assert.equal(S2.get('tom', { pitch: 1.3 }).rate, 1.3);
    });
  } finally {
    delete globalThis.OfflineAudioContext;
  }
});
