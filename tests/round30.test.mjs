import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGame, stubInput } from './helpers.mjs';
import { BLOCKS } from '../src/world/blocks.js';
import { buildFloor, DTYPES, FY, BENCHED, COFFINS_MAX, FIT, FIT_KAV } from '../src/world/dungeongen.js';
import { DungeonRun } from '../src/game/dungeon.js';
import { SPECIES } from '../src/entities/creature.js';
import { fits, apart, covers } from '../src/entities/footprint.js';
import { phaseOf, MARKS, STILL } from '../src/entities/tempo.js';
import { shielded, SENTINELS, SHIELD_DOWN } from '../src/entities/monsters.js';
import { arrowStrikes } from '../src/game/archery.js';
import { Music, musicMood, THEMES, bossLevel } from '../src/game/music.js';
import { REGION_W, REGION_D } from '../src/config.js';

function start(seed = 12345, minute = 10 * 60) {
  const game = makeGame(seed);
  const input = stubInput();
  game.minute = minute;
  for (let i = 0; i < 20; i++) game.update(0.1, input);
  game.cheats = { ...(game.cheats || {}), god: true };
  return { game, input, p: game.player };
}
const run = (game, input, n, dt = 0.05) => {
  for (let i = 0; i < n; i++) game.update(dt, input);
};
const fresh = (game, type) => ({ ...game.sim.dungeons.all.find((d) => d.type === type), floors: {}, cleared: false, pack: null });
const TYPE = { barrow_king: 'barrow', mound_witch: 'barrow', worm: 'mine', foreman: 'mine', brood_mother: 'mine', priest: 'crypt', horror: 'crypt', hollow_saint: 'crypt', warlord: 'holdout', twins: 'holdout', poisoner: 'holdout', overseer: 'kavorent', prime: 'kavorent' };

// Into the hall of a master of the kind given (put in place of whatever
// master it had), the fight begun, you a few paces off.
function fight(game, p, species) {
  const rec = fresh(game, TYPE[species]);
  new DungeonRun(game, rec).enter();
  while (game.dungeon.floor < rec.depth - 1) game.dungeon.changeFloor(1);
  const d = game.dungeon;
  d.metBoss = true;
  const br = d.data.bossRoom;
  for (const c of game.creatures) {
    if (c.isBoss || c.leash) {
      c.dead = true;
      game.removeOcc(c);
    }
  }
  game.creatures = game.creatures.filter((c) => !c.dead);
  const cx = Math.round((br.x0 + br.x1) / 2);
  const cz = Math.round((br.z0 + br.z1) / 2);
  const c = d.spawn(species, cx, FY, cz, { boss: true });
  c.leash = br;
  for (const q of game.creatures) if (!q.isBoss) q.dormant = 999;
  const s = game.findFreeSpot(cx, cz + 4, FY);
  p.teleport(s.x, s.y, s.z);
  d.bossFight();
  game.scene = null;
  return { d, c, br };
}

// ------------------------------------------------------------ big masters
test('the great masters fill three paces across: nothing walks into them, and a blow anywhere on them lands', () => {
  const { game, input, p } = start();
  const { c } = fight(game, p, 'horror');
  assert.equal(c.foot, 1);
  for (const k of ['overseer', 'brood_mother', 'worm', 'prime']) assert.ok(SPECIES[k].big && SPECIES[k].boss, k);
  assert.equal(game.occupiedBySolid(c.x + 1, c.y, c.z + 1, p), c, 'its edge is solid');
  assert.ok(covers(c, c.x - 1, c.z) && !covers(c, c.x - 2, c.z));
  // You, a pace from its edge (two from its middle): in reach.
  c.dormant = 999;
  c.windup = null;
  const s = { x: c.x + 2, z: c.z };
  game.removeOcc(p);
  p.teleport(s.x, c.y, s.z);
  assert.equal(apart(p, c), 1);
  const hp = c.hp;
  p.inv[p.selected] = { item: 'iron_sword', count: 1 };
  p.attackCd = 0;
  p.stamina = 10;
  game.attack(c, false);
  run(game, input, 30);
  assert.ok(c.hp < hp, `struck (${hp} -> ${c.hp})`);
  game.dungeon.leave();
});

test('a great master never stands where a wall would cut into it', () => {
  for (const sp of ['brood_mother', 'worm', 'horror']) {
    const { game, input, p } = start();
    const { c } = fight(game, p, sp);
    let bad = 0;
    for (let i = 0; i < 500; i++) {
      p.hp = p.maxHp;
      game.update(0.05, input);
      if (!c.burrowed && c.solid !== false && !fits(game, c, c.x, c.y, c.z, true)) bad++;
    }
    assert.equal(bad, 0, `${sp} in a wall ${bad} frames`);
    game.dungeon.leave();
  }
});

// ------------------------------------------------------------ never stood about
test('a master never stands about for long, and leaves a breath between its attacks', () => {
  for (const sp of ['priest', 'hollow_saint', 'barrow_king', 'overseer']) {
    const { game, input, p } = start();
    const { c } = fight(game, p, sp);
    let still = 0;
    let most = 0;
    let last = { x: c.x, z: c.z };
    let casts = c.casts || 0;
    let at = -1;
    let gap = 99;
    let t = 0;
    let swings = 0;
    let wound = false;
    for (let i = 0; i < 600; i++) {
      p.hp = p.maxHp;
      game.update(0.05, input);
      t += 0.05;
      if (c.windup && !wound) swings++;
      wound = !!c.windup;
      if ((c.casts || 0) > casts) {
        if (at >= 0) gap = Math.min(gap, t - at);
        at = t;
        casts = c.casts;
        still = 0;
      }
      const busy = c.moving || c.windup || c.act || c.burrowed || c.stunT > 0 || c.tether || c.ceiling || c.vanished || c.bolts > 0;
      if (c.x !== last.x || c.z !== last.z || busy) {
        still = 0;
        last = { x: c.x, z: c.z };
      } else most = Math.max(most, (still += 0.05));
    }
    assert.ok(most < STILL + 1.6, `${sp} stood ${most.toFixed(2)}s`);
    assert.ok(casts + swings >= 3, `${sp} did things (${casts} attacks, ${swings} blows)`);
    assert.ok(gap >= 0.9, `${sp}: ${gap.toFixed(2)}s between attacks`);
    game.dungeon.leave();
  }
});

// ------------------------------------------------------------ phases
test('a master turns at each mark: a roar, a new phase, attacks it held back, and the music climbs', () => {
  const { game, input, p } = start();
  const { c, d } = fight(game, p, 'barrow_king');
  assert.equal(phaseOf(c), 1);
  assert.match(musicMood(game), /_boss:p1$/);
  // Whole, it never shows its crown of frost or its grave-blades.
  const kinds = () => (game.hazards || []).filter((h) => h.by === c && (h.kind === 'cold' || (h.kind === 'erupt' && h.chill))).length;
  let seen = 0;
  for (let i = 0; i < 300; i++) {
    p.hp = p.maxHp;
    game.update(0.05, input);
    seen += kinds();
  }
  assert.equal(seen, 0, 'held back while whole');
  c.hp = Math.floor(c.maxHp * (MARKS[0] - 0.02));
  run(game, input, 2);
  assert.equal(c.phaseSeen, 2, 'turned');
  assert.match(musicMood(game), /_boss:p2$/);
  for (let i = 0; i < 400 && !seen; i++) {
    p.hp = p.maxHp;
    game.update(0.05, input);
    seen += kinds();
  }
  assert.ok(seen > 0, 'its worn attacks come out');
  c.hp = Math.floor(c.maxHp * (MARKS[1] - 0.02));
  run(game, input, 2);
  assert.equal(c.phaseSeen, 3);
  assert.match(musicMood(game), /_boss:p3$/);
  assert.ok(d.fight.phaseT < 1, 'the bar flashes');
  game.dungeon.leave();
});

test('every master\'s theme is grand, and climbs in place with the fight\'s phase', () => {
  for (const t of ['barrow', 'mine', 'crypt', 'holdout', 'kavorent']) {
    const T = THEMES[`dungeon_${t}_boss`];
    assert.ok(T.grand, t);
    assert.ok(T.bpm < 140, `${t}: slow and heavy to begin`);
  }
  assert.equal(bossLevel('p2'), 2);
  assert.equal(bossLevel('night'), 0);
  // A pretend sound card: count what's made.
  const made = { osc: 0, saw: 0 };
  const param = () => ({ value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {}, setTargetAtTime() {}, cancelScheduledValues() {} });
  const node = () => ({ connect: (n) => n, disconnect() {}, start() {}, stop() {}, gain: param(), frequency: param(), detune: param(), type: '' });
  const ctx = {
    currentTime: 0, state: 'running', sampleRate: 8000, destination: node(),
    createGain: node, createBiquadFilter: node, createBufferSource: node,
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
  const m = new Music({ ctx });
  try {
    climbs(m, made);
  } finally {
    if (m.timer) globalThis.clearInterval(m.timer);
  }
});

function climbs(m, made) {
  m.update(0.016, 'dungeon_crypt_boss:p1');
  const v = m.voice;
  v.schedule(8);
  assert.ok(made.saw > 0, 'drone and brass');
  const slow = v.stepDur;
  m.update(0.016, 'dungeon_crypt_boss:p3');
  assert.equal(m.voice, v, 'the same tune, not a new one');
  assert.equal(v.level, 3);
  v.schedule(9);
  assert.ok(v.lv > 1 && v.lv < 3, `climbing (${v.lv.toFixed(2)})`);
  v.schedule(40);
  assert.equal(v.lv, 3);
  assert.ok(v.stepDur < slow, 'quicker');
}

// ------------------------------------------------------------ the Overseer
test('the Overseer calls three sentinels at once; they hold up a shield that turns arrows but not blades', () => {
  const { game, input, p } = start();
  const { c } = fight(game, p, 'overseer');
  c.workCd = c.beamCd = c.gridCd = 999;
  run(game, input, 40);
  const live = () => (c.sentinels || []).filter((s) => !s.dead);
  assert.equal(live().length, SENTINELS);
  assert.ok(live().every((s) => s.species === 'drone' && s.sentinel === c));
  assert.ok(shielded(c));
  // An arrow glances off it.
  const hp = c.hp;
  const hit = arrowStrikes(game, { from: p, x0: p.x, z0: p.z, dmg: 6, kind: 'arrow' }, c);
  assert.equal(hit, false);
  assert.equal(c.hp, hp);
  // A blade doesn't.
  game.damage(c, 6, p);
  assert.ok(c.hp < hp, 'the blade goes through');
  // Never more than three.
  c.sentCd = 0;
  run(game, input, 40);
  assert.equal(live().length, SENTINELS);
  game.dungeon.leave();
});

test('kill all its sentinels and the Overseer\'s shield is down a good while, then it calls three more', () => {
  const { game, input, p } = start();
  const { c } = fight(game, p, 'overseer');
  c.workCd = c.beamCd = c.gridCd = 999;
  run(game, input, 40);
  const first = [...c.sentinels];
  for (const s of first) game.kill(s, p);
  assert.ok(!shielded(c));
  assert.ok(c.shieldDownT > SHIELD_DOWN - 1);
  const hp = c.hp;
  assert.equal(arrowStrikes(game, { from: p, x0: p.x, z0: p.z, dmg: 6, kind: 'arrow' }, c), true, 'arrows land now');
  assert.ok(c.hp < hp);
  // (Down: nothing called for a good while.)
  for (let i = 0; i < 200; i++) {
    c.workCd = c.beamCd = c.gridCd = 999;
    p.hp = p.maxHp;
    game.update(0.05, input);
  }
  assert.ok(!shielded(c), 'still down after ten seconds');
  for (let i = 0; i < 300 && !shielded(c); i++) {
    c.workCd = c.beamCd = c.gridCd = 999;
    p.hp = p.maxHp;
    game.update(0.05, input);
  }
  assert.ok(shielded(c), 'back up');
  assert.equal(c.sentinels.filter((s) => !s.dead).length, SENTINELS);
  assert.ok(c.sentinels.every((s) => !first.includes(s)), 'new ones');
  game.dungeon.leave();
});

test('no power nodes in the Overseer\'s hall any more', () => {
  const { game } = start();
  const rec = fresh(game, 'kavorent');
  const f = buildFloor(rec, rec.depth - 1);
  assert.ok(!f.nodes.some((n) => n.boss));
});

// ------------------------------------------------------------ the Prime
test('the Prime Golem has three quarters the health it had', () => {
  assert.equal(SPECIES.prime.hp, Math.round(170 * 0.75));
});

// ------------------------------------------------------------ smaller places
test('most old places go one to three floors down, a little tighter; a Kavorent ruin four, a good deal tighter', () => {
  const game = makeGame(12345);
  const all = game.sim.dungeons.all;
  const normal = all.filter((d) => d.type !== 'kavorent');
  assert.ok(normal.every((d) => d.depth >= 1 && d.depth <= 4));
  assert.ok(normal.filter((d) => d.depth <= 3).length >= normal.length * 0.8, 'most of them three or fewer');
  assert.ok(normal.some((d) => d.depth === 1) || normal.some((d) => d.depth === 2));
  for (const d of all.filter((q) => q.type === 'kavorent')) assert.equal(d.depth, 4);
  const bar = buildFloor(normal[0], 0);
  assert.ok(bar.plan.W <= Math.floor(DTYPES[normal[0].type].regions[0] * REGION_W * FIT[0]));
  assert.ok(bar.plan.W < DTYPES[normal[0].type].regions[0] * REGION_W);
  const kav = buildFloor(all.find((q) => q.type === 'kavorent'), 0);
  assert.ok(kav.plan.W <= Math.floor(3 * REGION_W * FIT_KAV[0]) && kav.plan.D <= Math.floor(3 * REGION_D * FIT_KAV[1]));
  assert.ok(kav.rooms.length <= 20, `${kav.rooms.length} rooms`);
});

test('the Pale Huntsman doesn\'t come up for now', () => {
  assert.ok(BENCHED.has('huntsman'));
  for (let s = 1; s <= 60; s++) {
    const f = buildFloor({ type: 'barrow', seed: s * 977, depth: 1, level: 2, vaultFloor: 0 }, 0);
    assert.ok(!f.spawns.some((q) => q.species === 'huntsman'), `seed ${s}`);
  }
});

test('a burial room has a few rows of coffins, not a field of them', () => {
  let most = 0;
  let any = 0;
  for (const type of ['barrow', 'crypt']) {
    for (let s = 1; s <= 40; s++) {
      const f = buildFloor({ type, seed: s * 131, depth: 2, level: 2, vaultFloor: 0 }, 0);
      const per = new Map();
      for (const q of f.coffins) {
        const r = f.plan.room[q.z * f.plan.W + (q.x - f.x0)];
        per.set(r, (per.get(r) || 0) + 1);
      }
      for (const n of per.values()) {
        most = Math.max(most, n);
        any++;
      }
    }
  }
  assert.ok(any > 5, 'there are burial rooms');
  assert.ok(most <= COFFINS_MAX, `${most} in one room`);
  assert.ok(BLOCKS);
});
