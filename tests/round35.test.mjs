import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGame, stubInput } from './helpers.mjs';
import { FY } from '../src/world/dungeongen.js';
import { ISLE_BOSSES, ISLE_DTYPES, ISLE_BOSS_HP, ISLE_BOSS_DMG, ISLE_BOSS_TEMPO } from '../src/world/isledeep.js';
import { DungeonRun } from '../src/game/dungeon.js';
import { SPECIES } from '../src/entities/creature.js';
import { cd } from '../src/entities/bosskit.js';
import { used } from '../src/entities/tempo.js';
import { roll } from '../src/game/combat.js';
import { mesmerise, swallow, struggle, glaze, chipGlaze, sporeUp, shakeSpores, takeSoul, freeSouls, plunder, spill, lodestone, ink, tickAfflictions, afflictionsOf, settleAfflictions } from '../src/game/afflict.js';
import { addItem, countItem } from '../src/game/inventory.js';
import { paintFigure, hasFigure, FIG_W, FIG_H } from '../src/render/bossfigs.js';
import { paintBeast, beastOf } from '../src/render/bossbeasts.js';
import { artState } from '../src/render/bossbody.js';
import { drawHumanoid, FRAMES } from '../src/render/people.js';

// Where each island master keeps its hall.
const WHERE = {};
for (const [isle, kinds] of Object.entries(ISLE_BOSSES)) for (const [type, list] of Object.entries(kinds)) for (const b of list) WHERE[b] = { isle, type };
for (const [type, T] of Object.entries(ISLE_DTYPES)) for (const b of T.bosses) WHERE[b] = { isle: T.isle, type };
const ALL = Object.keys(WHERE);

// Into `sp`'s hall (or any hall of an island's), it spawned as the master.
function hall(game, sp, isle = WHERE[sp].isle, type = WHERE[sp].type) {
  const base = game.sim.dungeons.all.find((d) => d.type !== 'kavorent');
  new DungeonRun(game, { ...base, type, isle, floors: {}, cleared: false, depth: 1, level: 1 }).enter();
  const d = game.dungeon;
  const br = d.data.bossRoom;
  for (const q of game.creatures) if (q.isBoss || q.leash) {
    q.dead = true;
    game.removeOcc(q);
  }
  game.creatures = game.creatures.filter((q) => !q.dead);
  const cx = Math.round((br.x0 + br.x1) / 2);
  const cz = Math.round((br.z0 + br.z1) / 2);
  const c = d.spawn(sp, cx, FY, cz, { boss: true });
  c.leash = br;
  for (const q of game.creatures) if (!q.isBoss) q.dormant = 999;
  const s = game.findFreeSpot(cx, cz + 4, FY);
  game.player.teleport(s.x, s.y, s.z);
  return { d, c, cx, cz };
}

// A fight with `sp` (you can't be killed), `secs` long, worn down through
// its phases: what was seen of it (`watch` names what to look for).
function fight(game, sp, secs, watch) {
  const input = stubInput();
  game.cheats = { ...(game.cheats || {}), god: true };
  const p = game.player;
  const { d, c } = hall(game, sp);
  d.bossFight();
  game.scene = null;
  const seen = new Set();
  for (let t = 0; t < secs && !c.dead; t += 0.05) {
    if (t > secs / 3 && t < secs / 3 + 0.06) c.hp = Math.floor(c.maxHp * 0.6);
    if (t > (2 * secs) / 3 && t < (2 * secs) / 3 + 0.06) c.hp = Math.floor(c.maxHp * 0.3);
    p.hp = p.maxHp;
    game.update(0.05, input);
    for (const [k, f] of Object.entries(watch)) if (f(c, p, game)) seen.add(k);
  }
  const works = (game.works || []).filter((w) => w.by === c).length;
  c.dead = true;
  for (let i = 0; i < 4; i++) game.update(0.05, input);
  d.leave();
  return { seen, c, works };
}

test('the far islands\' masters: a quarter more health, hitting 15% harder, quicker, and quicker still at first', () => {
  assert.equal(ISLE_BOSS_HP.kharos, 1.25);
  assert.equal(ISLE_BOSS_HP.myrrow, 1.25);
  assert.equal(ISLE_BOSS_DMG.kharos, 1.15);
  assert.equal(ISLE_BOSS_DMG.myrrow, 1.15);
  assert.ok(!ISLE_BOSS_HP.thessa && !ISLE_BOSS_DMG.thessa && !ISLE_BOSS_TEMPO.thessa, 'Thessa\'s as they were');
  // The same master, in a hall of Thessa's and one of Kharos's.
  const game = makeGame(12345);
  const a = hall(game, 'cinder_king', 'thessa', 'barrow').c;
  game.dungeon.leave();
  const b = hall(game, 'cinder_king', 'kharos', 'barrow').c;
  game.dungeon.leave();
  assert.ok(Math.abs(b.maxHp / a.maxHp - 1.25) < 0.02, `health ${a.maxHp} -> ${b.maxHp}`);
  assert.ok(Math.abs(b.dmgMult / a.dmgMult - 1.15) < 0.01, 'hits harder');
  assert.ok(!a.tempo && b.tempo > 1, 'quicker');
  // A shorter breath between attacks, shortest of all while it's whole
  // (not feeling you out first).
  for (const c of [a, b]) c.hp = c.maxHp;
  used(a);
  used(b);
  assert.ok(a.gapT / b.gapT >= 1.5, `first-phase gap ${a.gapT.toFixed(2)} vs ${b.gapT.toFixed(2)}`);
  a.hp = Math.floor(a.maxHp * 0.5);
  b.hp = Math.floor(b.maxHp * 0.5);
  used(a);
  used(b);
  assert.ok(a.gapT / b.gapT > 1.2 && a.gapT / b.gapT < 1.5, 'still quicker later, not as much');
  // Its powers come round sooner, the first time sooner still.
  const q = { tempo: 1.3 };
  const r = {};
  let tq = 0;
  let tr = 0;
  while (!cd(q, 'xCd', 0.05, 3)) tq += 0.05;
  while (!cd(r, 'xCd', 0.05, 3)) tr += 0.05;
  assert.ok(tr / tq > 2, `first cast ${tr.toFixed(2)}s vs ${tq.toFixed(2)}s`);
});

test('swallowed: strike and strike to burst out (and it\'s stunned); too slow and you\'re spat out, hurt', () => {
  const game = makeGame(12345);
  const { c } = hall(game, 'urn_mother');
  const p = game.player;
  assert.ok(swallow(game, p, c, { need: 5, max: 6 }));
  assert.ok(p.swallowed && p.grabbedT > 0);
  assert.ok(afflictionsOf(p).some((a) => /SWALLOWED/.test(a.text)));
  // (Every blow you try is a shove at the inside of it.)
  game.swing();
  assert.equal(p.swallowed.got, 1, 'a blow is a shove');
  for (let i = 0; i < 3; i++) struggle(game, p);
  assert.ok(p.swallowed, 'not yet');
  struggle(game, p);
  assert.ok(!p.swallowed, 'burst out');
  assert.ok(c.stunT > 2, 'and it reels');
  // Again, but sat still: spat out after a while, worse for it.
  p.hp = p.maxHp;
  swallow(game, p, c, { need: 5, max: 2, spit: 4 });
  for (let t = 0; t < 2.2; t += 0.1) tickAfflictions(game, p, 0.1);
  assert.ok(!p.swallowed);
  assert.ok(p.hp < p.maxHp, 'spat out, hurt');
  game.dungeon.leave();
});

test('mesmerised: your feet go the wrong way', () => {
  const game = makeGame(12345);
  const { c } = hall(game, 'moth_mother');
  // (Her out of the way.)
  c.dead = true;
  game.removeOcc(c);
  const p = game.player;
  const right = { ...stubInput(), isDown: (k) => k === 'KeyD', lastMoveKey: 'KeyD' };
  const x0 = p.x;
  for (let i = 0; i < 12; i++) game.update(0.05, right);
  assert.ok(p.x > x0, 'right goes right');
  const x1 = p.x;
  mesmerise(game, p, 3);
  for (let i = 0; i < 12; i++) game.update(0.05, right);
  assert.ok(p.x < x1, 'mesmerised, right goes left');
  game.dungeon.leave();
});

test('glaze, spores, souls, ink: each comes on its own way and has its own way off', () => {
  const game = makeGame(12345);
  const { c } = hall(game, 'kiln_priest');
  const p = game.player;
  // Glaze: three coats and you're fired solid; a hard blow to him cracks
  // one off; they flake off in time.
  glaze(game, p, c);
  glaze(game, p, c);
  assert.equal(p.glaze, 2);
  chipGlaze(game, p);
  assert.equal(p.glaze, 1);
  const hp = p.hp;
  glaze(game, p, c, 2);
  assert.equal(p.glaze, 0, 'fired');
  assert.ok(p.stunT > 1 && p.hp < hp, 'set solid, and burned');
  glaze(game, p, c);
  for (let t = 0; t < 8; t += 0.5) tickAfflictions(game, p, 0.5);
  assert.equal(p.glaze, 0, 'flaked off');
  // Spores: a roll shakes them off; let them bloom and they hurt, and grow.
  sporeUp(game, p, c, 0.5);
  shakeSpores(game, p);
  assert.ok(p.spores > 0 && p.spores < 0.2);
  const puffers = game.creatures.filter((q) => q.species === 'spore_puffer').length;
  const hp2 = p.hp;
  sporeUp(game, p, c, 1);
  assert.equal(p.spores, 0);
  assert.ok(p.hp < hp2, 'they bloom');
  assert.ok(game.creatures.filter((q) => q.species === 'spore_puffer').length > puffers, 'and grow');
  // Rolling shakes them off, too.
  sporeUp(game, p, c, 0.6);
  p.stunT = 0;
  p.grabbedT = 0;
  p.rollCd = 0;
  p.stamina = 99;
  assert.ok(roll(game, p, [1, 0]), 'rolls');
  assert.ok(p.spores < 0.6, 'shaken');
  // Souls: a heart into a lantern; break it, and it's yours again.
  const max = p.maxHp;
  const lantern = { x: p.x + 2, y: p.y, z: p.z };
  assert.ok(takeSoul(game, p, c, lantern));
  assert.equal(p.maxHp, max - 1);
  assert.ok(afflictionsOf(p).some((a) => /SOUL/.test(a.text)));
  freeSouls(game, lantern);
  assert.equal(p.maxHp, max);
  // Ink: you can't see, a while.
  ink(game, p, 2);
  assert.ok(p.inkT > 0);
  for (let t = 0; t < 2.5; t += 0.5) tickAfflictions(game, p, 0.5);
  assert.ok(!(p.inkT > 0));
  game.dungeon.leave();
});

test('plundered: Sharktooth takes your coin and your things, and a hard blow knocks them back out', () => {
  const game = makeGame(12345);
  const { c } = hall(game, 'sharktooth');
  const p = game.player;
  addItem(p.inv, 'coin', 50);
  const coins = countItem(p.inv, 'coin');
  plunder(game, p, c);
  const took = coins - countItem(p.inv, 'coin');
  assert.ok(took >= 3 && took <= Math.ceil(coins * 0.2), `took ${took} of ${coins}`);
  assert.ok(c.loot.length >= 1);
  assert.ok(artState(c).loot, 'his hoard glints on him');
  // (Not again at once.)
  plunder(game, p, c);
  assert.equal(coins - countItem(p.inv, 'coin'), took);
  const drops = game.items ? game.items.length : 0;
  spill(game, c, true);
  assert.equal(c.loot.length, 0);
  if (game.items) assert.ok(game.items.length > drops, 'spilled on the floor');
  game.dungeon.leave();
});

test('disarmed: the lodestone tears iron out of your hand, or drags you in by your armour', () => {
  const game = makeGame(12345);
  const { c } = hall(game, 'slag_titan');
  const p = game.player;
  p.inv[p.selected] = { item: 'iron_sword', count: 1 };
  assert.equal(lodestone(game, p, c, () => {}), 'weapon');
  assert.equal(p.inv[p.selected], null, 'out of your hand');
  let dragged = 0;
  p.equip = { ...(p.equip || {}), body: 'iron_chest' };
  assert.equal(lodestone(game, p, c, () => dragged++), 'pulled');
  assert.equal(dragged, 1);
  p.equip = {};
  assert.equal(lodestone(game, p, c, () => dragged++), null, 'nothing of iron on you');
  game.dungeon.leave();
});

test('the fight over, you\'re yourself again: soul, sight, feet and pockets', () => {
  const game = makeGame(12345);
  const { c } = hall(game, 'lantern_lord');
  const p = game.player;
  const max = p.maxHp;
  takeSoul(game, p, c, { x: 0, y: 0, z: 0 });
  mesmerise(game, p, 9);
  ink(game, p, 9);
  sporeUp(game, p, c, 0.5);
  swallow(game, p, c);
  settleAfflictions(game, c);
  assert.equal(p.maxHp, max);
  assert.ok(!p.swallowed && !(p.mazeT > 0) && !(p.inkT > 0) && !(p.spores > 0));
  assert.equal(afflictionsOf(p).length, 0);
  game.dungeon.leave();
});

test('Kharos\'s masters each have their own ways', () => {
  const game = makeGame(12345);
  // The Cinder King's decrees; the Urn-Mother swallows; the Bellows
  // Golem vents its heat; the Vitrified Horror shatters and reforms; the
  // Bombard Queen rolls kegs.
  const want = {
    cinder_king: { decree: (c) => c.decree },
    // (You stand at her mouth as her breath ends, so it's not left to
    // where the fight happens to have taken you.)
    urn_mother: {
      swallowed: (c, p) => p.swallowed,
      inhale: (c, p) => {
        if (c.inhale && c.inhale.t < 0.15 && !p.swallowed && Math.hypot(p.x - c.x, p.z - c.z) > 1) p.teleport(c.x + 1, p.y, c.z);
        return c.inhale;
      },
    },
    bellows_golem: { vent: (c) => c.ventT > 0, heat: (c) => c.heat > 30 },
    vitrified_horror: { shatter: (c) => c.shatter },
    bombard_queen: { keg: (c, p, g) => g.creatures.some((q) => q.species === 'rolling_keg' && !q.dead) },
  };
  for (const [sp, watch] of Object.entries(want)) {
    const { seen, works } = fight(game, sp, 36, watch);
    for (const k of Object.keys(watch)) assert.ok(seen.has(k), `${sp}: ${k}`);
    assert.equal(works, 0, `${sp} leaves its hall be`);
  }
  // Kharn the Ash-Reaver's fury: up with each blow he lands, cooled by a
  // parry; full, he goes berserk.
  const { c } = hall(game, 'ash_reaver');
  c.S.onStrike(game, c, game.player, 3);
  assert.equal(c.fury, 15);
  c.S.onParried(game, c, game.player);
  assert.equal(c.fury, 0);
  c.fury = 99;
  c.target = game.player;
  c.S.tick(c, 1);
  assert.ok(c.berserkT > 0, 'berserk');
  assert.ok(artState(c).berserk);
  game.dungeon.leave();
  // A keg struck rolls back to her.
  const k = hall(game, 'bombard_queen');
  const keg = game.spawnMonster('rolling_keg', k.c.x + 3, FY, k.c.z, {});
  keg.owner = k.c;
  keg.roll = [1, 0];
  keg.fuseT = 3;
  keg.S.ward(game, keg, game.player, 5);
  assert.ok(keg.back, 'sent back');
  game.dungeon.leave();
});

test('Myrrow\'s and the grove\'s masters each have their own ways', () => {
  const game = makeGame(12345);
  const want = {
    moth_mother: { gaze: (c) => c.gaze, eyes: (c) => c.eyes },
    hollow_oak: { spring: (c) => c.season === 0, summer: (c) => c.season === 1 },
    drowned_choir: { song: (c) => c.song },
    hollow_king: { echo: (c, p, g) => g.creatures.some((q) => q.echoOf === c && !q.dead) },
  };
  for (const [sp, watch] of Object.entries(want)) {
    const { seen, works } = fight(game, sp, 36, watch);
    for (const k of Object.keys(watch)) assert.ok(seen.has(k), `${sp}: ${k}`);
    assert.equal(works, 0, `${sp} leaves its hall be`);
  }
  // The Abyssal Clam: parry its snap and it's prised open.
  const { c } = hall(game, 'abyssal_clam');
  c.S.onParried(game, c, game.player);
  assert.ok(c.open && c.exposedT > 0);
  assert.ok(artState(c).open, 'drawn open');
  game.dungeon.leave();
  // The Hollow Oak: soft in autumn, hard as iron in winter.
  const o = hall(game, 'hollow_oak').c;
  o.season = 2;
  const soft = o.S.ward(game, o, game.player, 10);
  o.season = 3;
  const hard = o.S.ward(game, o, game.player, 10);
  assert.ok(soft > 10 && hard < 10, `autumn ${soft}, winter ${hard}`);
  game.dungeon.leave();
});

test('the Elder Stag charges; sidestepped by a wall, he\'s stunned against it', () => {
  const game = makeGame(12345);
  const { c, d } = hall(game, 'elder_stag');
  const p = game.player;
  const input = stubInput();
  game.cheats = { ...(game.cheats || {}), god: true };
  // (His charge, and nothing else of his: his bellow and the wild hunt
  // would throw you back against a wall, and leave him no run at it.)
  c.bellowCd = 999;
  c.huntCd = 999;
  d.bossFight();
  game.scene = null;
  // He lowers his antlers, at you.
  let charged = false;
  for (let t = 0; t < 20 && !charged; t += 0.05) {
    game.update(0.05, input);
    if (c.charge) charged = true;
  }
  assert.ok(charged, 'he charges');
  // You step aside: he runs on till the wall stops him.
  const C = c.charge;
  p.teleport(p.x + (C.uz ? 4 : 0), p.y, p.z + (C.ux ? 4 : 0));
  let stunned = false;
  for (let t = 0; t < 8 && !stunned; t += 0.05) {
    p.hp = p.maxHp;
    game.update(0.05, input);
    if (c.stunT >= 2.5) stunned = true;
  }
  assert.ok(stunned, 'stunned against the wall');
  d.leave();
});

test('every master is painted, one to one, in frames that move', () => {
  // (Round 71: the evolved masters are only ever forged: see round71.)
  const masters = Object.keys(SPECIES).filter((k) => SPECIES[k].boss && !SPECIES[k].evolved);
  for (const sp of masters) {
    const S = SPECIES[sp];
    if (['brood_mother', 'horror', 'overseer'].includes(sp)) continue;
    const draw = (t, st = {}) => (S.humanoid ? paintFigure(sp, t, st) : paintBeast(sp, t, st));
    assert.ok(S.humanoid ? hasFigure(sp) : beastOf(sp), `${sp} has a painting`);
    const a = draw(0);
    const b = draw(0.25);
    const w = draw(0.25, { wind: 1 });
    if (S.humanoid) assert.equal(a.w, FIG_W) && assert.equal(a.h, FIG_H);
    const filled = (p) => {
      let n = 0;
      for (let i = 3; i < p.d.length; i += 4) if (p.d[i]) n++;
      return n;
    };
    assert.ok(filled(a) > 300, `${sp} is something`);
    // (It moves: its frames differ; and it shows a blow coming.)
    const diff = (p, q) => {
      let n = 0;
      for (let i = 0; i < p.d.length; i++) if (p.d[i] !== q.d[i]) n++;
      return n;
    };
    assert.ok(diff(a, b) > 20, `${sp} moves`);
    assert.ok(diff(a, w) > 20, `${sp} winds up`);
  }
  // States that show: the Moth's eyes, the Clam open, the Oak's seasons.
  const diff = (p, q) => p.d.some((v, i) => v !== q.d[i]);
  assert.ok(diff(paintBeast('moth_mother', 0, {}), paintBeast('moth_mother', 0, { eyes: 1 })));
  assert.ok(diff(paintBeast('abyssal_clam', 0, {}), paintBeast('abyssal_clam', 0, { open: 1 })));
  assert.ok(diff(paintBeast('hollow_oak', 0, { season: 1 }), paintBeast('hollow_oak', 0, { season: 3 })));
});

test('clothes are painted in shades, not flat: every outfit has a lit side and a shadowed one', () => {
  const base = { skin: '#d8a880', hair: '#5a3a22', hairStyle: 'short', shirt: '#7a5a8a', pants: '#4a4a6a', shoes: '#3a2a1a', accent: '#b03030' };
  for (const outfit of ['plain', 'guard', 'smith', 'robe_white', 'noble', 'hunter', 'rags', 'ashwrap', 'mistcloak', 'tidewrap']) {
    for (let f = 0; f < FRAMES; f++) {
      const p = drawHumanoid({ ...base, outfit }, 0, f);
      const cols = new Set();
      for (let i = 0; i < p.d.length; i += 4) if (p.d[i + 3]) cols.add((p.d[i] << 16) | (p.d[i + 1] << 8) | p.d[i + 2]);
      assert.ok(cols.size >= 14, `${outfit} frame ${f}: ${cols.size} colours`);
    }
  }
});

test('only a few masters still change their halls; the rest leave them be and fight their own ways', () => {
  // (Those that keep their halls: the vents, the glass, the forge's lava;
  // the bog, the lamprey's and the kraken's and the tide's water; the
  // thorns.)
  const keepers = new Set(['magma_tender', 'obsidian_abbess', 'kiln_king', 'bog_king', 'lamprey_queen', 'smugglers_kraken', 'tide_mother', 'thorn_queen']);
  const others = ALL.filter((k) => !keepers.has(k));
  assert.equal(others.length, 25);
  const game = makeGame(12345);
  for (const sp of others) {
    const { works, c } = fight(game, sp, 15, {});
    assert.equal(works, 0, `${sp} leaves its hall be`);
    assert.ok((c.casts || 0) >= 1, `${sp} fights (${c.casts})`);
  }
});
