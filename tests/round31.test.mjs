import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGame, stubInput } from './helpers.mjs';
import { B, BLOCKS, NATURAL } from '../src/world/blocks.js';
import { ITEMS } from '../src/world/items.js';
import { recipesFor } from '../src/world/recipes.js';
import { DungeonRun } from '../src/game/dungeon.js';
import { DTYPES, FY } from '../src/world/dungeongen.js';
import { SPECIES } from '../src/entities/creature.js';
import { padded, MASTER_PAD } from '../src/entities/footprint.js';
import { tumble, dynamiteBlast, throwDynamite } from '../src/entities/monsters.js';
import { Music, THEMES, TITLE_SONGS, TITLE_SONG_LEN } from '../src/game/music.js';
import { randomHero, TRAITS, KITS, pointsLeft, EYES, BEARD_STYLES } from '../src/game/hero.js';
import { CharacterWindow } from '../src/ui/create.js';
import { Grid } from '../src/ui/ascii.js';
import { Lock, SHEAR, lockGrade, chestTier, RELOCK_DAYS } from '../src/game/lockpick.js';
import { mastery, gainMastery, RANKS, rankText } from '../src/game/mastery.js';
import { rollCatch, KINDS, castLine, hook, updateFishing } from '../src/game/fishing.js';
import { settingPlan } from '../src/ui/windows.js';
import { studyPlan, GEARS } from '../src/ui/research.js';

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

// Into a holdout with nothing in it but you (and what's put there).
function holdout(game) {
  new DungeonRun(game, fresh(game, 'holdout')).enter();
  for (const c of game.creatures) {
    c.dead = true;
    game.removeOcc(c);
  }
  game.creatures = [];
  return game.dungeon;
}
const near = (game, x, z) => game.findFreeSpot(x, z, FY);

// ------------------------------------------------------------ quick fixes
test('the mouse wheel (with Shift too) picks the hotbar slot, never the working layer', () => {
  const { game, p } = start();
  p.selected = 2;
  const layer = p.layerMode;
  game.handleKeys([], 1);
  assert.equal(p.selected, 3);
  game.handleKeys([], -1);
  game.handleKeys([], -1);
  assert.equal(p.selected, 1);
  assert.equal(p.layerMode, layer, 'the layer is left alone');
});

test('a master the size of a person is a little easier to hit than its one pace', () => {
  const { game, p } = start();
  assert.ok(padded({ isBoss: true, S: { humanoid: true } }));
  assert.ok(!padded({ isBoss: true, foot: 1, S: { humanoid: true } }), 'the great ones have their own footprint');
  assert.ok(!padded({ isBoss: false, S: { humanoid: true } }));
  assert.ok(MASTER_PAD > 0.5 && MASTER_PAD < 1.5);
  // One a pace off diagonally ahead of a swing: found.
  const c = { dead: false, isBoss: true, S: { humanoid: true }, x: p.x + 1, y: p.y, z: p.z + 1 };
  game.creatures.push(c);
  assert.equal(game.masterNear(p, 0, 1, { reach: 1 }), c);
  assert.equal(game.masterNear(p, 0, -1, { reach: 1 }), null, 'not behind you');
  game.creatures.pop();
});

test('a master waiting with old wounds does not wake for them when you come back', () => {
  const { game, input, p } = start();
  const rec = fresh(game, 'holdout');
  new DungeonRun(game, rec).enter();
  while (game.dungeon.floor < rec.depth - 1) game.dungeon.changeFloor(1);
  const d = game.dungeon;
  const boss = game.creatures.find((c) => c.isBoss && c.waiting);
  assert.ok(boss, 'a master waits in its hall');
  // (Wounded from last time; you come in at the far end of the floor.)
  boss.hp = Math.round(boss.maxHp * 0.5);
  delete boss.restHp;
  for (let i = 0; i < 40; i++) {
    p.hp = p.maxHp;
    game.update(0.05, input);
  }
  assert.ok(!d.fight, 'no fight for wounds it already had');
  // Just outside its hall, and still nothing until it's struck.
  const br = d.data.bossRoom;
  let s = null;
  for (let r = 1; r <= 3 && !s; r++) {
    for (let x = br.x0 - r; x <= br.x1 + r && !s; x++) {
      for (let z = br.z0 - r; z <= br.z1 + r && !s; z++) {
        const inside = x >= br.x0 && x <= br.x1 && z >= br.z0 && z <= br.z1;
        if (!inside && game.world.canStand(x, FY, z) && !game.occupiedAny(x, FY, z)) s = { x, y: FY, z };
      }
    }
  }
  assert.ok(s, 'a spot by its hall');
  game.removeOcc(p);
  p.teleport(s.x, s.y, s.z);
  run(game, input, 10);
  assert.ok(!d.fight, 'not for coming near');
  boss.hp -= 3;
  run(game, input, 4);
  assert.ok(d.fight, 'struck: it wakes');
  game.scene = null;
  d.leave();
});

// ------------------------------------------------------------ digging
test('digging into the ground beside you takes the rock over it too: a passage you can walk into', () => {
  const { game, p } = start();
  const w = game.world;
  // Rock at your feet and your head, a pace off.
  const x = p.x + 1;
  const z = p.z;
  w.setBlock(x, p.y, z, B.stone);
  w.setBlock(x, p.y + 1, z, B.stone);
  assert.ok(NATURAL.has(B.stone) && !NATURAL.has(B.cobblestone));
  const c = { x, y: p.y, z, block: BLOCKS[B.stone], inReach: true };
  assert.deepEqual(game.tunnelPair(c), { x, y: p.y + 1, z });
  // Not with the layer locked, and not with blocks you placed.
  p.layerMode = 0;
  assert.equal(game.tunnelPair(c), null);
  p.layerMode = null;
  w.setBlock(x, p.y + 1, z, B.cobblestone);
  assert.equal(game.tunnelPair(c), null);
  w.setBlock(x, p.y + 1, z, B.stone);
  for (let i = 0; i < 200 && w.getBlock(x, p.y, z) !== B.air; i++) game.mineTick(0.1, c);
  assert.equal(w.getBlock(x, p.y, z), B.air);
  assert.equal(w.getBlock(x, p.y + 1, z), B.air, 'and the rock over it');
});

// ------------------------------------------------------------ title music
test('the title has several songs, and moves on to another after a while', () => {
  assert.ok(TITLE_SONGS.length >= 6);
  for (const [k, name] of TITLE_SONGS) assert.ok(THEMES[k] && name, k);
  assert.ok(Object.values(THEMES).some((T) => T.meter === 12), 'a waltz among them');
  const m = new Music({ ctx: { state: 'running' } });
  m.title = { i: 0, t: 0 };
  m.voice = { key: TITLE_SONGS[0][0] };
  assert.equal(m.titleSong(1), TITLE_SONGS[0][0]);
  const next = m.titleSong(TITLE_SONG_LEN + 1);
  assert.notEqual(next, TITLE_SONGS[0][0], 'on to another song');
  m.voice = { key: next };
  assert.ok(m.nowPlaying(), 'and it has a name');
});

// ------------------------------------------------------------ character
test('the character screen has more to choose, and its long list scrolls', () => {
  const h = randomHero(77);
  assert.ok(EYES.includes(h.look.eyeColor));
  assert.ok(BEARD_STYLES.includes(h.look.beardStyle));
  for (const k of ['night_owl', 'steady_hands', 'squeamish']) assert.ok(TRAITS[k], k);
  assert.ok(TRAITS.squeamish.flaw);
  assert.ok(KITS.cutpurse.items.some(([it]) => it === 'lockpick'));
  for (const k of Object.keys(KITS)) for (const [it] of KITS[k].items) assert.ok(ITEMS[it], `${k}: ${it}`);
  assert.ok(pointsLeft(h) >= 0);
  const ui = { audio: null, mouseCell: { x: 0, y: 0 }, time: 0 };
  const win = new CharacterWindow(ui, 5, () => {});
  for (const id of ['nameStyle', 'eyeColor', 'mark', 'neck', 'cape', 'gloves']) assert.ok(win.rows.some((r) => r.id === id), id);
  win.setTab(1);
  const g = new Grid(win.w, win.h);
  win.draw(g);
  assert.equal(win.scroll, 0);
  const n = win.tabRows.length;
  assert.ok(n > win.view.V, 'more than fits');
  for (let i = 0; i < n - 1; i++) win.onKey({ code: 'ArrowDown' });
  win.hits = [];
  win.draw(g);
  assert.ok(win.scroll > 0, 'scrolled down to the line you\'re on');
  win.onWheel(-99);
  assert.equal(win.scroll, 0, 'and the wheel scrolls it back');
});

test('squeamish: raw meat does you no good', () => {
  const { game, p } = start();
  game.hero = { ...(game.hero || {}), traits: ['squeamish'], specialties: [] };
  p.hp = 5;
  p.inv[0] = { item: 'raw_meat', count: 2 };
  p.selected = 0;
  game.eat();
  assert.equal(p.hp, 5);
  assert.equal(p.inv[0].count, 1);
});

// ------------------------------------------------------------ bandits
test('three more of the holdout\'s own, each in their own clothes, in the holdout\'s rooms', () => {
  for (const k of ['bombarder', 'thief', 'coward']) {
    assert.ok(SPECIES[k] && SPECIES[k].bandit && SPECIES[k].humanoid, k);
    assert.ok(DTYPES.holdout.mobs.some(([s]) => s === k), `${k} in the mob table`);
  }
  assert.ok(ITEMS.dynamite && ITEMS.lockpick);
});

test('a bombarder lobs dynamite from afar, and takes out a knife up close', () => {
  const { game, input, p } = start();
  const d = holdout(game);
  const s = near(game, p.x, p.z + 5) || near(game, p.x + 5, p.z);
  const b = d.spawn('bombarder', s.x, s.y, s.z, {});
  b.target = p;
  b.bombCd = 0;
  let stick = false;
  for (let i = 0; i < 80 && !stick; i++) {
    p.hp = p.maxHp;
    game.update(0.05, input);
    stick = (game.projectiles || []).some((a) => a.stick);
  }
  assert.ok(stick, 'a stick of dynamite in the air');
  // Right up against you: the knife.
  const s2 = near(game, p.x + 1, p.z);
  game.removeOcc(b);
  b.teleport(s2.x, s2.y, s2.z);
  game.moveEntity(b, s2.x, s2.y, s2.z);
  run(game, input, 4);
  assert.equal(b.arms, 'dagger');
  d.leave();
});

test('dynamite goes up under anyone near (not whoever threw it), and sets powder off', () => {
  const { game, input, p } = start();
  const d = holdout(game);
  const s = near(game, p.x + 4, p.z);
  const c = d.spawn('cutthroat', s.x, s.y, s.z, {});
  c.dormant = 999;
  const hp = c.hp;
  dynamiteBlast(game, c.x, c.y, c.z, p, { fuse: 0.1 });
  run(game, input, 6);
  assert.ok(c.hp < hp || c.dead, 'caught in it');
  // Thrown by you: one from your hand, off through the air.
  p.inv[0] = { item: 'dynamite', count: 2 };
  p.selected = 0;
  game.cursor = { x: p.x + 4, y: p.y, z: p.z };
  const before = (game.projectiles || []).length;
  assert.ok(game.throwDynamite());
  assert.equal(p.inv[0].count, 1);
  assert.equal(game.projectiles.length, before + 1);
  assert.ok(throwDynamite);
  d.leave();
});

test('a thief rolls clean past you, to your back', () => {
  const { game, p } = start();
  const d = holdout(game);
  // A corridor of open floor along x.
  const w = game.world;
  for (let k = -3; k <= 3; k++) {
    for (const yy of [FY, FY + 1]) w.setBlock(p.x + k, yy, p.z, B.air);
    w.setBlock(p.x + k, FY - 1, p.z, B.stone);
  }
  game.removeOcc(p);
  p.teleport(p.x, FY, p.z);
  const t = d.spawn('thief', p.x - 1, FY, p.z, {});
  assert.ok(t, 'spawned');
  assert.ok(tumble(t, 1, 0, 2));
  assert.ok(t.x > p.x, `past you (${t.x} vs ${p.x})`);
  assert.ok(t.rollT > 0, 'rolling (so a blow misses)');
  d.leave();
});

test('a coward hangs back and shouts for help; left alone, it goes into a frenzy', () => {
  const { game, input, p } = start();
  const d = holdout(game);
  const s = near(game, p.x + 4, p.z) || near(game, p.x, p.z + 4);
  const co = d.spawn('coward', s.x, s.y, s.z, {});
  const a = near(game, s.x + 2, s.z) || near(game, s.x, s.z + 2);
  const ally = d.spawn('cutthroat', a.x, a.y, a.z, {});
  co.target = p;
  co.shoutCd = 0;
  ally.target = null;
  // (Its friend out of the way of seeing you itself.)
  ally.S = { ...ally.S, aggro: 0 };
  run(game, input, 3);
  assert.equal(ally.target, p, 'called over');
  assert.ok(!co.frenzy, 'not with a friend near');
  ally.dead = true;
  game.removeOcc(ally);
  game.creatures = game.creatures.filter((c) => !c.dead);
  for (let i = 0; i < 40 && !co.frenzy; i++) {
    p.hp = p.maxHp;
    game.update(0.05, input);
  }
  assert.ok(co.frenzy, 'alone: frenzied');
  d.leave();
});

// ------------------------------------------------------------ locks
test('a lock: flick a pin up, turn as its gap meets the shear line; slips strain the pick till it snaps', () => {
  const L = new Lock(1, 42);
  assert.equal(L.pins.length, lockGrade(1).pins);
  assert.equal(L.order, null, 'a village lock has no binding order');
  // The wrong moment: strain.
  assert.equal(L.tension(0), 'miss');
  assert.ok(L.stress > 0);
  // The right one.
  L.pins[0].h = SHEAR;
  assert.equal(L.tension(0), 'set');
  for (let i = 1; i < L.pins.length; i++) {
    L.pins[i].h = SHEAR;
    const r = L.tension(i);
    assert.ok(r === 'set' || r === 'open');
  }
  assert.ok(L.open);
  // Too many slips: snap.
  const M = new Lock(1, 43);
  let snapped = false;
  for (let i = 0; i < 10 && !snapped; i++) snapped = M.tension(0) === 'snap';
  assert.ok(snapped);
  // A flicked pin goes up, and the spring brings it down.
  const N = new Lock(1, 44);
  N.flick(0);
  N.update(0.1);
  assert.ok(N.pins[0].h > 0);
  for (let i = 0; i < 60; i++) N.update(0.05);
  assert.equal(N.pins[0].h, 0);
});

test('better locks bind in an order, and the best have spool pins that false-set', () => {
  const L = new Lock(4, 7);
  assert.ok(L.order && L.pins.length === 6);
  const bind = L.binding();
  const other = L.pins.findIndex((_, i) => i !== bind);
  L.pins[other].h = SHEAR;
  assert.equal(L.tension(other), 'loose', 'not the binding pin: it springs back');
  const spool = L.pins.findIndex((q) => q.spool);
  assert.ok(spool >= 0);
  // Set them in order: a spool gives a false set first.
  let falses = 0;
  for (let k = 0; k < 20 && !L.open; k++) {
    const i = L.binding();
    L.pins[i].h = SHEAR;
    if (L.tension(i) === 'false') falses++;
  }
  assert.ok(L.open);
  assert.ok(falses >= 1);
  assert.equal(chestTier('village', 'house_s'), 1);
  assert.equal(chestTier('city', 'manor'), 4);
  // Steady hands: wider gaps, less strain.
  const a = new Lock(2, 9);
  const b = new Lock(2, 9, { steady: true });
  assert.ok(b.pins[0].win > a.pins[0].win && b.missStrain < a.missStrain);
});

test('a household\'s chest is locked; picked, it stays open a while, then they lock it again', () => {
  const { game, p } = start();
  const s = game.currentSettlement || game.world.ow.settlementsNear(p.x, p.z)[0];
  const L = game.world.getLayout(s);
  const homes = L.buildings.filter((b) => b.residential && !b.playerHome);
  assert.ok(homes.filter((b) => b.chestPos).length >= homes.length / 2, 'most homes keep a chest');
  const b = homes.find((q) => q.chestPos && !game.sim.isGuest(s.id, q.id));
  const { x, y, z } = b.chestPos;
  assert.equal(game.world.getBlock(x, y, z), B.chest);
  assert.ok(game.chestLocked(x, y, z));
  // No pick: no luck.
  game.ui.msgs.length = 0;
  game.interact(x, y, z);
  assert.ok(game.ui.msgs.some((m) => /lockpick/i.test(m)));
  // Picked: open a while.
  game.picked.set(`${x},${y},${z}`, game.day);
  assert.ok(!game.chestLocked(x, y, z));
  assert.ok(game.serialize().picked.length === 1, 'kept with the save');
  game.day += RELOCK_DAYS;
  assert.ok(game.chestLocked(x, y, z), 'locked again');
  // Lockpicks: four from an iron ingot at an anvil.
  assert.ok(recipesFor('anvil').some((r) => r.out === 'lockpick' && r.n === 4));
});

// ------------------------------------------------------------ the fine work
test('practice counts: ranks rise, and say so', () => {
  const { game } = start();
  assert.equal(mastery(game, 'fishing').rank, 1);
  let up = false;
  for (let i = 0; i < RANKS[1]; i++) up = gainMastery(game, 'fishing') || up;
  assert.ok(up);
  assert.equal(mastery(game, 'fishing').rank, 2);
  assert.match(rankText(game, 'fishing'), /Rank 2/);
  assert.ok(game.serialize().stats.mastery.fishing >= RANKS[1], 'kept with the save');
});

test('what bites depends on the water and on practice; big ones land more', () => {
  const seen = (o) => {
    const out = new Set();
    for (let i = 0; i < 400; i++) out.add(rollCatch(Math.random, o));
    return out;
  };
  const novice = seen({ rank: 1 });
  assert.ok(!novice.has('pike') && !novice.has('golden'), 'a novice hooks no pike');
  const old = seen({ rank: 8 });
  assert.ok(old.has('pike') || old.has('eel'), 'an old hand does');
  const sea = seen({ rank: 8, salt: true });
  assert.ok(!sea.has('perch') && !sea.has('pike'), 'no perch in the sea');
  assert.ok(sea.has('mackerel'));
  for (const k of Object.keys(KINDS)) assert.ok(KINDS[k].move, k);
  // Hooked and landed: a big one gives an extra fish, and practice.
  const { game, p } = start();
  p.inv[0] = { item: 'fishing_rod', count: 1 };
  p.selected = 0;
  castLine(game, { x: p.x + 2, y: p.y - 1, z: p.z });
  game.fishing.t = 0;
  updateFishing(game, 0.05, null);
  hook(game, () => 0.01);
  const f = game.fishing;
  f.big = true;
  f.progress = 0.99;
  f.zone = f.fish;
  const had = p.inv.reduce((n, s) => n + (s && s.item === 'fish' ? s.count : 0), 0);
  updateFishing(game, 0.1, { isDown: () => false, mouse: { down: false } }, () => 0.5);
  assert.equal(game.fishing, null);
  assert.ok(p.inv.reduce((n, s) => n + (s && s.item === 'fish' ? s.count : 0), 0) >= had + 2, 'a big one: two fish');
  assert.ok((game.stats.mastery || {}).fishing > 0);
});

test('a gem setting gets fiddlier with practice; so does the study', () => {
  const a = settingPlan(1, false, () => 0.5);
  assert.equal(a.prongs.length, 4);
  assert.equal(a.decoys.length, 0);
  assert.ok(!a.reverse && !a.pulse);
  const b = settingPlan(9, true, Math.random);
  assert.equal(b.prongs.length, 6);
  assert.ok(b.decoys.length >= 1 && b.reverse && b.pulse > 0 && b.speed > a.speed);
  const s1 = studyPlan(1, () => 0.5);
  assert.equal(s1.radii.length, 3);
  assert.ok(s1.gears.every((k) => k === 'counter'));
  const s6 = studyPlan(6, Math.random);
  assert.equal(s6.radii.length, 4);
  assert.equal(s6.gears.length, 3);
  assert.ok(s6.drift > s1.drift);
  for (const k of s6.gears) assert.ok(k in GEARS);
});
