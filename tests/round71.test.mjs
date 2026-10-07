// Round 71: every master of the old places forged anew (its own picture,
// its parts moving on it: 64 pixels, 128 for the Kavorent's and the
// evolved); four ancient places on the great continents, each unlike any
// other (rooms that do things to you), each with an evolved master: the
// Divine Alchemist (twelve arms of the elements, struck and cut off), the
// Rift Crawler (rifts, rewinding), the Hero (cursed parts that change,
// and his mercy), the Alinelidan (it learns your arms, it infests you, it
// burrows); each of them rising again the first time it falls; and
// their music, the darkest there is.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGame, stubInput } from './helpers.mjs';
import { DungeonRun } from '../src/game/dungeon.js';
import { buildFloor, FY } from '../src/world/dungeongen.js';
import { ANCIENT_DTYPES, ANCIENT_BOSSES, ANCIENT_LANDS, ANCIENT_GATE } from '../src/world/ancient.js';
import { SPECIES } from '../src/entities/creature.js';
import { BRAINS, BOSS_TITLES } from '../src/entities/monsters.js';
import { evoPhase, addRift, updateRifts, isEvolved } from '../src/entities/evolved.js';
import { armsOf, ELEMS } from '../src/entities/evolved_alchemist.js';
import { formOf, SLOTS } from '../src/entities/evolved_hero.js';
import { infest } from '../src/entities/evolved_worm.js';
import { FORGE } from '../src/render/forge.js';
import '../src/render/bossbody.js';
import { WORLD_DRAW } from '../src/render/evolvedfx.js';
import { THEMES } from '../src/game/music.js';
import { STEPS } from '../src/game/migrate.js';
import { GAME_VERSION, compareVersions } from '../src/version.js';
import { B, BLOCKS } from '../src/world/blocks.js';

const TYPES = ['athanor', 'champion', 'rift', 'gullet'];
const EVOLVED = ['divine_alchemist', 'rift_crawler', 'the_hero', 'alinelidan'];
let shared = null;
function world() {
  if (!shared) {
    shared = makeGame(4242);
    const input = stubInput();
    shared.minute = 600;
    for (let i = 0; i < 3; i++) shared.update(0.1, input);
  }
  return shared;
}
// Into an ancient place's master's hall, its waking skipped.
function fight(type) {
  const game = makeGame(4242);
  const input = stubInput();
  game.minute = 600;
  for (let i = 0; i < 3; i++) game.update(0.1, input);
  game.cheats = { ...(game.cheats || {}), god: true };
  const rec = { ...game.sim.dungeons.all.find((d) => d.type === type), floors: {}, cleared: false };
  new DungeonRun(game, rec).enter();
  while (game.dungeon.floor < rec.depth - 1) game.dungeon.changeFloor(1);
  const d = game.dungeon;
  const g = d.data.bossGate;
  const p = game.player;
  p.teleport(g.x - g.ox * 3, FY, g.z - g.oz * 3);
  d.bossFight();
  game.scene = null;
  const c = game.creatures.find((q) => q.isBoss && !q.dead);
  for (const q of game.creatures) if (q !== c && !q.isBoss) q.dormant = 99;
  return { game, input, d, p, c };
}
const run = (game, input, secs, dt = 0.05) => {
  for (let t = 0; t < secs; t += dt) {
    game.update(dt, input);
    game.scene = null;
  }
};

// ------------------------------------------------------------ the places
test('four ancient places on the great continents, two on each, each with its own master', () => {
  const game = world();
  const anc = game.sim.dungeons.all.filter((d) => TYPES.includes(d.type));
  assert.deepEqual(anc.map((d) => d.type).sort(), [...TYPES].sort(), 'one of each');
  for (const d of anc) {
    assert.equal(d.isle, ANCIENT_LANDS.velmarch.includes(d.type) ? 'velmarch' : 'ostria', `${d.type} on its land`);
    assert.equal(d.level, 4, 'as hard as the hardest');
    assert.ok(d.noDelve, 'nobody delves them for a living');
    assert.ok(d.name && d.origin && d.origin.text, `${d.type} has a name and a story`);
    assert.ok(ANCIENT_GATE[d.type], 'and a way in');
  }
  const sites = game.world.sites.filter((s) => s.ancient);
  assert.equal(sites.length, 4);
  for (const b of ['athanor_door', 'champion_door', 'rift_door', 'gullet_mouth']) assert.equal(BLOCKS[B[b]].interact, 'dungeon', b);
});

test('each ancient place is its own: its rooms, its floors, its master waiting at the bottom', () => {
  const game = world();
  for (const type of TYPES) {
    const rec = game.sim.dungeons.all.find((d) => d.type === type);
    const kits = new Set();
    let anc = null;
    for (let n = 0; n < rec.depth; n++) {
      const f = buildFloor(rec, n);
      for (const r of f.rooms) kits.add(r.kit);
      if (f.anc) anc = { ...(anc || {}), ...Object.fromEntries(Object.entries(f.anc).filter(([, v]) => v.length)) };
      if (n === rec.depth - 1) {
        const boss = f.spawns.find((s) => s.boss);
        assert.equal(boss.species, ANCIENT_BOSSES[type], `${type}'s master`);
        const br = f.bossRoom;
        assert.ok(br.x1 - br.x0 >= 24 && br.z1 - br.z0 >= 18, `${type}: a great hall for it (${br.x1 - br.x0}x${br.z1 - br.z0})`);
      }
    }
    const own = ANCIENT_DTYPES[type].kits.filter((k) => !['trap', 'treasure', 'guard'].includes(k));
    assert.ok(own.filter((k) => kits.has(k)).length >= 3, `${type}: its own rooms (${[...kits].join(', ')})`);
    assert.ok(anc && Object.keys(anc).length >= 2, `${type}: rooms that do things (${Object.keys(anc || {}).join(', ')})`);
  }
});

test('a trial-hall bars its ways out and sends the dead at you in waves; beaten, it opens', () => {
  const game = makeGame(4242);
  const input = stubInput();
  game.minute = 600;
  game.cheats = { god: true };
  const rec = { ...game.sim.dungeons.all.find((d) => d.type === 'champion'), floors: {}, cleared: false };
  new DungeonRun(game, rec).enter();
  let T = null;
  for (let n = 0; n < rec.depth && !T; n++) {
    if (n) game.dungeon.changeFloor(1);
    T = (game.dungeon.data.anc?.trials || [])[0] || null;
  }
  assert.ok(T, 'a trial-hall somewhere');
  const d = game.dungeon;
  const p = game.player;
  const cx = Math.round((T.box.x0 + T.box.x1) / 2);
  const cz = Math.round((T.box.z0 + T.box.z1) / 2);
  const y = game.world.findStandY(cx, cz, FY);
  p.teleport(cx, y > 0 ? y : FY, cz);
  d.arriveT = 0;
  run(game, input, 0.5);
  assert.ok(d.trialOn, 'it begins');
  const barred = (game.works || []).filter((q) => q.id === B.boss_gate).length;
  assert.ok(barred >= 1, 'its ways out barred');
  // The dead, wave after wave: put down as they come.
  for (let k = 0; k < 300 && d.trialOn; k++) {
    for (const c of d.trialOn?.mobs || []) if (!c.dead) game.kill(c, p);
    run(game, input, 0.25);
  }
  assert.ok(d.state.solved[`trial${T.room}`], 'beaten');
  run(game, input, 0.3);
  assert.equal((game.works || []).filter((q) => q.id === B.boss_gate).length, 0, 'the bars are up');
});

test('rifts take you through, one end to the other, and not straight back', () => {
  const game = world();
  const p = game.player;
  const at = { x: p.x, z: p.z };
  const to = { x: p.x + 8, z: p.z + 3 };
  game.world.setBlock(to.x, p.y, to.z, B.air);
  const R = addRift(game, { x: p.x + 20, z: p.z }, to, { life: 5, y: p.y, open: 1 });
  R.a = { ...at };
  updateRifts(game, 0.05);
  assert.ok(Math.abs(p.x - to.x) <= 1 && Math.abs(p.z - to.z) <= 1, `through (${p.x},${p.z} → ${to.x},${to.z})`);
  const was = { x: p.x, z: p.z };
  updateRifts(game, 0.05);
  assert.deepEqual({ x: p.x, z: p.z }, was, 'not back through at once');
  game.rifts = [];
});

// ------------------------------------------------------------ the masters
test('the evolved masters: twice the size, four or five phases, a dozen works and more, their own music', () => {
  for (const sp of EVOLVED) {
    const S = SPECIES[sp];
    assert.ok(S && S.evolved && S.boss, sp);
    assert.ok((S.phases || 4) >= 4, `${sp}: phases`);
    assert.ok(BRAINS[S.brain], `${sp}: its brain`);
    assert.ok(BOSS_TITLES[sp], `${sp}: its title`);
    assert.equal(FORGE[sp] && FORGE[sp].size, 128, `${sp}: painted at 128`);
    assert.ok(WORLD_DRAW[sp], `${sp}: what it reaches into the world with, drawn`);
  }
  assert.equal(SPECIES.alinelidan.phases, 5);
  for (const t of TYPES) {
    const th = THEMES[`dungeon_${t}_boss`];
    assert.ok(th && th.apocalypse && th.levels === 6, `${t}: its music climbs through six levels`);
  }
});

test('the masters of the old places are each forged: 64 pixels, 128 for the Kavorent\'s and the evolved', () => {
  const bosses = Object.entries(SPECIES).filter(([, S]) => S.boss).map(([k]) => k);
  assert.ok(bosses.length >= 120, `${bosses.length} masters`);
  const missing = bosses.filter((k) => !FORGE[k]);
  assert.deepEqual(missing, [], 'every one forged');
  for (const k of bosses) {
    const big = SPECIES[k].evolved || ['overseer', 'crucible', 'condenser', 'prime'].includes(k);
    if (big) assert.equal(FORGE[k].size, 128, k);
    else assert.equal(FORGE[k].size, 64, k);
  }
});

test('it won\'t die the first time: it rises again, healed, worse; the second time it dies', () => {
  for (const type of TYPES) {
    const { game, input, c, p } = fight(type);
    assert.ok(isEvolved(c));
    c.hp = 5;
    game.damage(c, 50, p);
    assert.ok(!c.dead, `${type}: not dead`);
    assert.ok(c.enraged && c.riseT > 0, `${type}: rising`);
    assert.ok(c.hp >= c.maxHp * 0.55, `${type}: healed`);
    // (Nothing touches it as it rises.)
    const h = c.hp;
    game.damage(c, 20, p);
    assert.equal(c.hp, h, 'untouchable as it rises');
    run(game, input, 3.5);
    assert.equal(evoPhase(c), (c.S.phases || 4) + 1, 'its last phase');
    c.hp = 5;
    game.damage(c, 50, p);
    assert.ok(c.dead || c.hp <= 0, `${type}: the second time, it dies`);
  }
});

test('the Divine Alchemist: arms out by phase, each a hand you can strike (a little goes into the eye), cut off when struck enough', () => {
  const { game, input, c, p } = fight('athanor');
  assert.equal(ELEMS.length, 12);
  run(game, input, 0.5);
  const out = () => armsOf(c).filter((a) => a.on && a.alive).length;
  assert.equal(out(), 4, 'four to begin with');
  const hands = () => game.creatures.filter((q) => q.species === 'alchemist_hand' && !q.dead && q.master === c);
  assert.equal(hands().length, 4, 'a hand for each');
  const h = hands()[0];
  const before = c.hp;
  game.damage(h, 20, p);
  assert.ok(c.hp < before && before - c.hp <= 10, `a blow on a hand goes a little into it (${before - c.hp})`);
  // Struck enough: cut off, and it reels.
  game.damage(h, 9999, p);
  run(game, input, 0.2);
  assert.equal(out(), 3, 'an arm cut off');
  assert.ok(c.stunT > 0 || armsOf(c).some((a) => a.cut), 'it reels');
  // Worn into its next phases: more of them, and the cut ones grown again.
  for (const [frac, n] of [[0.7, 6], [0.45, 9], [0.2, 12]]) {
    c.hp = Math.round(c.maxHp * frac);
    run(game, input, 0.3);
    assert.equal(out(), n, `${n} arms at ${frac}`);
  }
});

test('the Rift Crawler goes back to what it was, unless hurt hard as it gathers itself', () => {
  const { game, input, c } = fight('rift');
  run(game, input, 0.5);
  c.hp = Math.round(c.maxHp * 0.6);
  c.phaseSeen = 2;
  c.windup = null;
  c.act = null;
  c.mem = [{ x: c.x, z: c.z, hp: Math.round(c.maxHp * 0.7), t: (c.fightClock || 0) - 3 }];
  c.rewindCd = -1;
  c.gapT = 0;
  for (const k of Object.keys(c)) if (k.endsWith('Cd') && k !== 'rewindCd' && typeof c[k] === 'number') c[k] = 99;
  // (Once it's done with the step it's taking.)
  for (let i = 0; i < 30 && !c.rewinding; i++) run(game, input, 0.05);
  assert.ok(c.rewinding, 'it gathers itself');
  const hp0 = c.hp;
  run(game, input, 1.6);
  assert.ok(c.hp > hp0, `back as it was, or nearly (${hp0} → ${c.hp})`);
});

test('the Hero changes as the curse moves in him, and what he does is what he is', () => {
  const { game, input, c } = fight('champion');
  run(game, input, 0.5);
  const F = formOf(c);
  assert.deepEqual(Object.keys(F).sort(), Object.keys(SLOTS).sort());
  const cursed = () => Object.entries(formOf(c)).filter(([k, v]) => v !== SLOTS[k].base).length;
  c.morphT = 0;
  run(game, input, 0.1);
  assert.equal(cursed(), 1, 'one part of him at a time, whole');
  assert.ok(c.morphT >= 4.9 && c.morphT <= 8.1, `every five to eight seconds (${c.morphT})`);
  c.hp = Math.round(c.maxHp * 0.3);
  run(game, input, 0.2);
  assert.ok(cursed() >= 3, `more of him, worn (${cursed()})`);
});

test('the Hero spares you once, the first time he\'d kill you (everyone sees it); never again', () => {
  const { game, c, p } = fight('champion');
  game.cheats = {};
  p.hp = 3;
  game.damage(p, 60, c);
  assert.ok(!p.dead && p.hp === 1, 'spared');
  assert.equal(game.scene && game.scene.kind, 'hero_mercy', 'the man in him fights it, and you see it');
  assert.ok(c.stunT > 1, 'he holds back');
  game.scene = null;
  p.mercyT = 0;
  p.hp = 3;
  game.damage(p, 60, c);
  assert.ok(p.dead || p.hp <= 0, 'no mercy the second time');
});

test('the Alinelidan learns what you hurt it with, and infests you', () => {
  const { game, input, c, p } = fight('gullet');
  p.inv[p.selected] = { item: 'iron_sword', count: 1 };
  run(game, input, 0.3);
  for (let i = 0; i < 5; i++) game.damage(c, 10, p);
  // Into its second stage: it's learned the sword.
  c.hp = Math.round(c.maxHp * 0.75);
  run(game, input, 0.3);
  assert.equal(c.immune, 'iron_sword', 'it learned your sword');
  const h = c.hp;
  game.damage(c, 40, p);
  assert.ok(h - c.hp <= 4, `it barely feels it (${h - c.hp})`);
  p.inv[p.selected] = { item: 'iron_axe', count: 1 };
  const h2 = c.hp;
  game.damage(c, 40, p);
  assert.ok(h2 - c.hp >= 30, 'another weapon bites');
  // Infested: a worm's bite, softer armour.
  infest(game, c, p);
  infest(game, c, p);
  assert.equal(p.worms, 2);
  game.cheats = {};
  p.hp = p.maxHp;
  const hp = p.hp;
  for (let i = 0; i < 50; i++) game.update(0.05, input);
  assert.ok(p.hp < hp, 'they bite');
  assert.ok(SPECIES.gullet_leech, 'its leeches');
});

test('the Alinelidan leaves holes of acid where it dives, filled in with dirt after', () => {
  const { game, input, c } = fight('gullet');
  run(game, input, 0.3);
  for (const k of Object.keys(c)) if (k.endsWith('Cd') && typeof c[k] === 'number') c[k] = 99;
  c.burrowCd = -1;
  c.gapT = 0;
  const at = { x: c.x, z: c.z };
  run(game, input, 1.4);
  assert.equal(game.world.getBlock(at.x, FY - 1, at.z), B.acid_pool, 'acid where it went down');
  run(game, input, 17);
  assert.equal(game.world.getBlock(at.x, FY - 1, at.z), B.mud, 'filled in with dirt');
});

// ------------------------------------------------------------ the version
test('0.71.0: a migration step for it, and the version', () => {
  assert.ok(compareVersions(GAME_VERSION, '0.71.0') >= 0);
  const s = STEPS.find((q) => q.to === '0.71.0');
  assert.ok(s && s.data && s.game);
  const log = [];
  s.data({}, log);
  assert.ok(log.some((l) => /ancient places/.test(l)));
  const game = world();
  const glog = [];
  s.game(game, glog);
  assert.ok(glog.some((l) => /4 ancient places/.test(l)), glog.join(' / '));
});
