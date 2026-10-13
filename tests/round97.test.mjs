// Round 97: the crypt made over. Its floors laid out by its own architect
// (a nave with its chancel, chapels, the donors' tombs, the loculi, the
// ossuary, the drowned undercroft, the keepers' cells, the scriptorium, the
// vigil chapel, the light well, the reliquary), every one of them walkable
// in every land; what's written there made from its history; its own
// creatures drawn; and its works at work: the vigil candles that keep the
// dead asleep (snuffed, the tombs open; lit again, the risen are hushed),
// the donors' riddle, the vigil chapel's grille, the cracked flags, the
// daylight, the loose flag, the reliquary, the mourner, the sexton, the
// cantor, the penitent.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGame, stubInput } from './helpers.mjs';
import { DungeonRun } from '../src/game/dungeon.js';
import { buildFloor, FY } from '../src/world/dungeongen.js';
import { BLOCKS, B } from '../src/world/blocks.js';
import { SPECIES } from '../src/entities/creature.js';
import { CRYPT_SPECIES } from '../src/entities/cryptmobs.js';
import { CRYPT_MOBS } from '../src/render/art/crypt_mobs.js';
import { CRYPT_SPRITES } from '../src/render/art/crypt_tex.js';
import { cryptLore, godOf, POSES } from '../src/world/deeps/cryptlore.js';
import { snuff, relight } from '../src/game/cryptwork.js';
import { GAME_VERSION } from '../src/version.js';
import { CRYPT_BOSS_ART } from '../src/render/art/crypt_bosses.js';
import { FORGE } from '../src/render/forge.js';
import '../src/render/bossbody.js';
import { stepsFor } from '../src/game/migrate.js';

const rec = (s, isle) => ({
  id: `c${s}`, type: 'crypt', seed: s * 7919 + 13, depth: 3, level: 1 + (s % 3), isle, name: 'the Lamp-Bearer\'s Crypt', townName: 'Hobb',
  origin: { y: 211, text: 'In 211, the water came up through the floor of the crypt of the temple of the Lamp-Bearer north of Hobb.' }, fallen: [],
});
const blockAt = (f, x, y, z) => {
  const r = f.regions.get(Math.floor(x / 64) * 4096 + Math.floor(z / 36));
  return r ? r.get(x % 64, y, z % 36) : 0;
};
// (What's meant to be opened to be got through.)
const PASS = new Set(['sealed', 'portcullis', 'boss_gate']);
const solid = (f, x, y, z) => {
  const b = BLOCKS[blockAt(f, x, y, z)];
  return !!(b && b.solid && !PASS.has(b.interact) && b.name !== 'weak_wall');
};
const standY = (f, x, z) => {
  for (let y = FY + 2; y >= FY - 1; y--) if (!solid(f, x, y, z) && !solid(f, x, y + 1, z) && solid(f, x, y - 1, z)) return y;
  return null;
};
function reach(f) {
  const { W, open } = f.plan;
  const seen = new Set();
  const st = [[f.entry.x - f.x0, f.entry.z]];
  seen.add(st[0][1] * W + st[0][0]);
  while (st.length) {
    const [x, z] = st.pop();
    const h = standY(f, f.x0 + x, z) ?? FY;
    for (const [a, c] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + a;
      const nz = z + c;
      const i = nz * W + nx;
      if (seen.has(i) || !open[i]) continue;
      const h2 = standY(f, f.x0 + nx, nz);
      if (h2 == null || h2 - h > 1 || h - h2 > 2) continue;
      seen.add(i);
      st.push([nx, nz]);
    }
  }
  return seen;
}

test('every crypt floor can be walked, chancels, causeways and cells and all, in every land', () => {
  for (const isle of [null, 'kharos', 'myrrow', 'velmarch']) {
    for (let s = 1; s <= 4; s++) {
      for (let n = 0; n < 3; n++) {
        const f = buildFloor(rec(s, isle), n);
        const seen = reach(f);
        const W = f.plan.W;
        for (const r of f.rooms) {
          if (r.kit === 'hidden' || r.sealed) continue;
          let ok = false;
          for (let z = r.z0; z <= r.z1 && !ok; z++) for (let x = r.x0; x <= r.x1 && !ok; x++) ok = f.plan.room[z * W + x] === r.id && seen.has(z * W + x);
          assert.ok(ok, `${isle || 'thessa'} ${s}/${n}: the ${r.kit} room can't be reached`);
        }
        if (f.downAt) assert.ok(seen.has(f.downAt.z * W + f.downAt.x - f.x0), `${isle || 'thessa'} ${s}/${n}: the way down can't be reached`);
      }
    }
  }
});

test('a crypt is laid out as a crypt: its own rooms, its vigil, its riddles', () => {
  let effigies = 0;
  let vigils = 0;
  let walks = 0;
  for (let s = 1; s <= 8; s++) {
    for (let n = 0; n < 3; n++) {
      const f = buildFloor(rec(s, null), n);
      const kits = f.rooms.map((r) => r.kit);
      if (n === 0) assert.ok(kits.includes('scriptorium'), `${s}/${n}: the Register's on the first floor`);
      if (n === 2) assert.ok(kits.includes('reliquary') && f.reliquary, `${s}/${n}: the reliquary's at the bottom`);
      for (const k of ['nave', 'effigies', 'vigil', 'lightwell', 'cells', 'reliquary']) assert.ok(kits.filter((q) => q === k).length <= 1, `${s}/${n}: one ${k} at most`);
      assert.ok((f.candles || []).length >= 6, `${s}/${n}: vigil candles burn`);
      // Nothing that matters set where the wall to its south would hide it.
      for (const t of f.tombs || []) {
        if ((t.y ?? FY) !== FY) continue;
        assert.ok(f.plan.open[(t.z + 1) * f.plan.W + t.x - f.x0], `${s}/${n}: a tomb hidden behind a wall`);
      }
      for (const e of f.effigies || []) {
        effigies++;
        assert.ok(e.tombs.length >= 2 && e.tombs.some((t) => t.pose === e.answer), 'the chalice is in one of the donors\' tombs');
        // (The Register on this floor says how its donor lies.)
        const reg = (f.lore || []).find((q) => q.title === 'The Register');
        assert.ok(reg && reg.lines.some((l) => l.includes(POSES[e.answer])), `${s}/${n}: the Register gives the riddle's answer`);
      }
      for (const v of f.vigils || []) {
        vigils++;
        for (const c of v.candles) assert.equal(blockAt(f, c.x, FY, c.z), B.vigil_out, 'the vigil chapel\'s candles are out');
        assert.equal(blockAt(f, v.grille.x, FY, v.grille.z), B.crypt_grille);
        const reg = (f.lore || []).find((q) => q.title === 'The Register');
        assert.ok(reg && reg.lines.some((l) => l.includes('vigil chapel keeps')), 'and how many lights it keeps');
      }
      if (f.penitent) {
        walks++;
        assert.equal(blockAt(f, f.penitent.flag.x, FY, f.penitent.flag.z), B.loose_flag, 'the walk ends at the loose flag');
        assert.ok(f.spawns.some((q) => q.species === 'penitent' && q.route), 'and the penitent is there to walk it');
      }
    }
  }
  assert.ok(effigies >= 2 && vigils >= 2 && walks >= 6, `riddles: ${effigies} donors' chapels, ${vigils} vigils, ${walks} walks`);
});

test('what\'s written in a crypt is its own, and the same each time', () => {
  const r = rec(3, null);
  const a = cryptLore(r, 1, 'priest');
  const b = cryptLore(r, 1, 'priest');
  assert.equal(godOf(r), 'the Lamp-Bearer');
  assert.deepEqual(a.register(1, 4), b.register(1, 4));
  assert.equal(a.saint, b.saint);
  assert.ok(a.last().lines[0].includes('Prior') || a.last().lines[0].includes('saint') || a.last().lines.join(' ').length > 20);
  const other = cryptLore(rec(5, null), 1);
  assert.notEqual(a.saint + a.prior, other.saint + other.prior);
  assert.ok(a.altar().lines[0].includes('the Lamp-Bearer'), 'raised to its own god');
});

test('the crypt\'s own creatures are all in the game and all drawn; its props too', () => {
  for (const sp of Object.keys(CRYPT_SPECIES)) {
    assert.ok(SPECIES[sp], `${sp} is a species`);
    assert.ok(CRYPT_MOBS[sp] && CRYPT_MOBS[sp].rows.length >= 16, `${sp} is drawn`);
  }
  for (const k of ['vigil_candle', 'vigil_out', 'effigy_tomb', 'effigy_book', 'effigy_prayer', 'effigy_crozier', 'tomb_open', 'crypt_altar', 'saint_statue', 'reliquary', 'light_shaft']) {
    const p = CRYPT_SPRITES[k](0, 0, 0);
    assert.ok(p.d.some((v) => v), `${k} is drawn`);
  }
});

// ------------------------------------------------------- in the crypt itself
function inCrypt() {
  const game = makeGame(12345);
  const input = stubInput();
  game.minute = 600;
  for (let i = 0; i < 20; i++) game.update(0.1, input);
  const base = game.sim.dungeons.all.find((d) => d.type === 'crypt');
  const r = { ...base, floors: {}, cleared: false, pack: null, weakened: 0 };
  new DungeonRun(game, r).enter();
  const d = game.dungeon;
  for (const c of game.creatures) {
    c.dead = true;
    game.removeOcc(c);
  }
  game.creatures = [];
  game.cheats = { ...(game.cheats || {}), god: false };
  // A clear stretch of floor, 9 by 5, in the way-in's room; nothing of the
  // place's own works on this floor but what each test sets out.
  d.data.candles = [];
  d.data.tombs = [];
  d.data.vigils = [];
  d.data.wells = [];
  d.data.weakFlags = [];
  const e = d.data.rooms.find((q) => q.kit === 'entry');
  const x0 = d.data.x0 + e.cx - 4;
  const z0 = e.cz - 2;
  for (let z = z0 - 1; z <= z0 + 5; z++) {
    for (let x = x0 - 1; x <= x0 + 9; x++) {
      for (const y of [FY, FY + 1, FY + 2]) game.world.setBlock(x, y, z, B.air);
      game.world.setBlock(x, FY - 1, z, B.crypt_floor);
    }
  }
  const p = game.player;
  p.teleport(x0, FY, z0);
  p.hp = p.maxHp = 200;
  return { game, input, d, p, x0, z0 };
}
const run = (game, input, secs) => {
  for (let t = 0; t < secs; t += 0.05) game.update(0.05, input);
};
const candleAt = (game, d, x, z, lit = true) => {
  game.world.setBlock(x, FY, z, lit ? B.vigil_candle : B.vigil_out);
  d.data.candles.push({ x, z, y: FY });
};

test('the dead by a burning candle sleep as you pass; snuffed, they get up, and its tombs open', () => {
  const { game, input, d, p, x0, z0 } = inCrypt();
  candleAt(game, d, x0 + 4, z0 + 1);
  // (As the architect lays them by a burning candle: lying light.)
  const sk = d.spawn('skeleton', x0 + 5, FY, z0 + 2, { dormant: 0.6, vigil: true });
  game.world.setBlock(x0 + 6, FY, z0, B.effigy_book);
  d.data.tombs.push({ x: x0 + 6, z: z0, y: FY, pose: 1, species: 'entombed', candle: { x: x0 + 4, z: z0 + 1, y: FY } });
  p.teleport(x0 + 3, FY, z0 + 3);
  run(game, input, 2);
  assert.ok(sk.dormant > 0, 'still asleep, you two paces off');
  snuff(d, x0 + 4, FY, z0 + 1, null);
  assert.equal(game.world.getBlock(x0 + 4, FY, z0 + 1), B.vigil_out);
  assert.equal(sk.dormant, 0, 'up');
  assert.equal(game.world.getBlock(x0 + 6, FY, z0), B.tomb_open, 'the lid grinds aside');
  assert.ok(game.creatures.some((c) => !c.dead && c.species === 'entombed'), 'and the knight in it climbs out');
  d.leave();
});

test('a candle lit again hushes the risen in its light: slow, their blows weak', () => {
  const { game, input, d, p, x0, z0 } = inCrypt();
  candleAt(game, d, x0 + 4, z0 + 2, false);
  const sk = d.spawn('skeleton', x0 + 5, FY, z0 + 2);
  sk.dormant = 0;
  p.inv[p.selected] = { item: 'torch', count: 1 };
  p.teleport(x0 + 3, FY, z0 + 2);
  d.interact(x0 + 4, FY, z0 + 2, BLOCKS[B.vigil_out]);
  assert.equal(game.world.getBlock(x0 + 4, FY, z0 + 2), B.vigil_candle, 'lit with the torch');
  assert.ok(sk.hushT > 0 && sk.slowT > 0, 'hushed at once');
  const hp = p.hp;
  game.damage(p, 10, sk);
  assert.ok(hp - p.hp <= 6, `its blow weak (${hp - p.hp})`);
  run(game, input, 1);
  assert.ok(sk.hushT > 0, 'and kept so while the candle burns');
  d.leave();
});

test('light every candle in the vigil chapel and its grille lifts', () => {
  const { game, d, x0, z0 } = inCrypt();
  const cs = [{ x: x0 + 2, z: z0 }, { x: x0 + 5, z: z0 }, { x: x0 + 8, z: z0 }];
  for (const c of cs) candleAt(game, d, c.x, c.z, false);
  const grille = { x: x0 + 5, z: z0 - 1 };
  game.world.setBlock(grille.x, FY, grille.z, B.crypt_grille);
  d.data.vigils.push({ room: 0, candles: cs, grille });
  relight(d, cs[0].x, FY, cs[0].z);
  relight(d, cs[1].x, FY, cs[1].z);
  assert.equal(game.world.getBlock(grille.x, FY, grille.z), B.crypt_grille, 'two of three: still shut');
  relight(d, cs[2].x, FY, cs[2].z);
  assert.equal(game.world.getBlock(grille.x, FY, grille.z), B.air, 'all three: it lifts');
  d.leave();
});

test('the donors\' riddle: the right tomb has the chalice, a wrong one its dead', () => {
  const { game, d, p, x0, z0 } = inCrypt();
  game.world.setBlock(x0 + 2, FY, z0, B.effigy_prayer);
  game.world.setBlock(x0 + 4, FY, z0, B.effigy_tomb);
  d.data.tombs.push({ x: x0 + 2, z: z0, y: FY, pose: 2, puzzle: true, right: true, species: 'entombed' });
  d.data.tombs.push({ x: x0 + 4, z: z0, y: FY, pose: 0, puzzle: true, right: false, species: 'entombed' });
  p.teleport(x0 + 3, FY, z0 + 1);
  const before = game.drops ? game.drops.length : 0;
  d.interact(x0 + 2, FY, z0, BLOCKS[B.effigy_prayer]);
  assert.equal(game.world.getBlock(x0 + 2, FY, z0), B.tomb_open);
  assert.ok(!game.drops || game.drops.length > before || game.items?.length, 'the chalice spills out');
  assert.ok(!game.creatures.some((c) => !c.dead && c.species === 'entombed'), 'nobody in that one');
  d.interact(x0 + 4, FY, z0, BLOCKS[B.effigy_tomb]);
  assert.ok(game.creatures.some((c) => !c.dead && c.species === 'entombed'), 'the wrong one: its knight');
  d.leave();
});

test('a mourner goes to the candles and pinches them out', () => {
  const { game, input, d, p, x0, z0 } = inCrypt();
  candleAt(game, d, x0 + 7, z0 + 2);
  const m = d.spawn('mourner', x0 + 4, FY, z0 + 2);
  m.dormant = 0;
  p.teleport(x0, FY, z0);
  run(game, input, 6);
  assert.equal(game.world.getBlock(x0 + 7, FY, z0 + 2), B.vigil_out, 'out');
  d.leave();
});

test('a sexton raises the fallen from their bones; not in a burning candle\'s light', () => {
  const { game, input, d, p, x0, z0 } = inCrypt();
  p.teleport(x0, FY, z0);
  game.cheats = { ...(game.cheats || {}), invisible: true };
  const sx = d.spawn('sexton', x0 + 6, FY, z0 + 3);
  sx.dormant = 0;
  const sk = d.spawn('skeleton', x0 + 7, FY, z0 + 1);
  game.kill(sk, p);
  assert.equal(d.cryptT.bones.length, 1, 'its bones lie there');
  run(game, input, 5);
  assert.ok(game.creatures.some((c) => !c.dead && c.species === 'skeleton' && c.raised), 'up again');
  // And by a candle, not.
  const sk2 = d.spawn('skeleton', x0 + 2, FY, z0 + 1);
  candleAt(game, d, x0 + 2, z0 + 2);
  game.kill(sk2, p);
  run(game, input, 5);
  assert.equal(game.creatures.filter((c) => !c.dead && c.species === 'skeleton' && c.raised).length, 1, 'the bones in candlelight stay down');
  d.leave();
});

test('while a cantor sings the dead about it take half the hurt; struck, it stops', () => {
  const { game, input, d, p, x0, z0 } = inCrypt();
  p.teleport(x0, FY, z0);
  const cn = d.spawn('cantor', x0 + 8, FY, z0 + 4);
  cn.dormant = 0;
  cn.target = p;
  const sk = d.spawn('skeleton', x0 + 6, FY, z0 + 4);
  sk.dormant = 0.5;
  run(game, input, 0.5);
  assert.ok(sk.hymnT > 0, 'under the hymn');
  const hp = sk.hp;
  game.damage(sk, 8, p);
  assert.equal(hp - sk.hp, 4, 'half the hurt');
  game.damage(cn, 1, p);
  assert.ok(!cn.singing && cn.hymnOff > 0, 'the hymn breaks off');
  d.leave();
});

test('a cracked flag gives way under you', () => {
  const { game, input, d, p, x0, z0 } = inCrypt();
  game.world.setBlock(x0 + 4, FY - 1, z0 + 2, B.crypt_weak);
  d.data.weakFlags.push({ x: x0 + 4, z: z0 + 2 });
  p.teleport(x0 + 4, FY, z0 + 2);
  const hp = p.hp;
  run(game, input, 1.5);
  assert.equal(game.world.getBlock(x0 + 4, FY - 1, z0 + 2), B.water, 'water under it');
  assert.ok(p.hp < hp, 'and you went in');
  d.leave();
});

test('the dead won\'t stand in daylight', () => {
  const { game, input, d, p, x0, z0 } = inCrypt();
  p.teleport(x0, FY, z0);
  d.data.wells.push({ x: x0 + 5, z: z0 + 2, r: 2 });
  const sk = d.spawn('skeleton', x0 + 5, FY, z0 + 2);
  sk.dormant = 0.5;
  const hp = sk.hp;
  run(game, input, 1.5);
  assert.ok(sk.dead || sk.hp < hp, 'it burns');
  d.leave();
});

test('lift the loose flag: a hollow, a casket', () => {
  const { game, d, p, x0, z0 } = inCrypt();
  game.world.setBlock(x0 + 3, FY, z0 + 2, B.loose_flag);
  p.teleport(x0 + 2, FY, z0 + 2);
  d.interact(x0 + 3, FY, z0 + 2, BLOCKS[B.loose_flag]);
  assert.equal(game.world.getBlock(x0 + 3, FY, z0 + 2), B.air);
  assert.equal(game.world.getBlock(x0 + 3, FY - 1, z0 + 2), B.chest, 'a casket in the hollow');
  const box = game.world.getContainer(x0 + 3, FY - 1, z0 + 2);
  assert.ok(box.some((s) => s && s.item === 'gilt_chalice'));
  d.leave();
});

test('take the saint\'s bones and every candle on the floor goes out, the nearest first', () => {
  const { game, input, d, p, x0, z0 } = inCrypt();
  candleAt(game, d, x0 + 2, z0 + 1);
  candleAt(game, d, x0 + 8, z0 + 4);
  game.world.setBlock(x0 + 1, FY, z0 + 1, B.reliquary);
  p.teleport(x0, FY, z0);
  d.interact(x0 + 1, FY, z0 + 1, BLOCKS[B.reliquary]);
  assert.ok(p.inv.some((s) => s && s.item === 'saint_relic'), 'you have them');
  run(game, input, 0.9);
  assert.equal(game.world.getBlock(x0 + 2, FY, z0 + 1), B.vigil_out, 'the near one first');
  assert.equal(game.world.getBlock(x0 + 8, FY, z0 + 4), B.vigil_candle, 'the far one still burning');
  run(game, input, 1.5);
  assert.equal(game.world.getBlock(x0 + 8, FY, z0 + 4), B.vigil_out, 'then it');
  d.leave();
});

test('the penitent waits for you, and walks on as you follow', () => {
  const { game, input, d, p, x0, z0 } = inCrypt();
  const route = [{ x: x0 + 1, z: z0 + 2 }, { x: x0 + 8, z: z0 + 2 }];
  const pn = d.spawn('penitent', x0 + 1, FY, z0 + 2, { peaceful: true, route });
  p.teleport(x0 - 30, FY, z0);
  run(game, input, 3);
  assert.ok(Math.abs(pn.x - (x0 + 1)) <= 1, 'it waits');
  p.teleport(x0, FY, z0 + 2);
  run(game, input, 10);
  assert.ok(pn.x >= x0 + 6, `and walks on (${pn.x - x0})`);
  d.leave();
});

test('the crypt\'s masters are all painted by hand, every part in place', () => {
  const names = Object.keys(CRYPT_BOSS_ART);
  assert.equal(names.length, 23);
  for (const k of names) {
    assert.ok(SPECIES[k], `${k} is a species`);
    const D = FORGE[k];
    assert.ok(D && D.pix, `${k} is painted`);
    const A = CRYPT_BOSS_ART[k];
    assert.ok(A.body.rows.length, `${k} has a body`);
    for (const [n, q] of Object.entries(A.parts || {})) {
      assert.ok(q.pix && q.pix.rows.length, `${k}.${n} has a picture`);
      if (q.parent) assert.ok(A.parts[q.parent], `${k}.${n} hangs on ${q.parent}`);
    }
  }
  // (What their effects hang on: the censers and staves in their hands,
  // the lantern on its crook, the choir's singing faces.)
  for (const k of ['priest', 'kiln_priest', 'whale_priest', 'pale_vestal', 'rune_witch', 'lantern_lord', 'hollow_saint']) assert.equal(CRYPT_BOSS_ART[k].parts.blade.parent, 'armN', `${k}'s weapon is in its hand`);
  assert.ok(CRYPT_BOSS_ART.lantern_lord.parts.lantern, 'the lantern hangs from its crook');
  for (let i = 0; i < 3; i++) assert.ok(CRYPT_BOSS_ART.drowned_choir.parts[`head${i}`].pixVariants.song, 'each voice opens its mouth to sing');
  // (The panes and shards still orbit as the forged ones did; the
  // horror's heart beats.)
  assert.equal(typeof FORGE.obsidian_abbess.parts.pane0front.at, 'function');
  assert.ok(FORGE.obsidian_abbess.parts.pane0front.show, 'a pane shows in front only as it comes round');
  assert.deepEqual(CRYPT_BOSS_ART.horror.idle, [0, 4]);
  assert.ok(FORGE.horror.legs, 'the horror keeps its legs of bone');
});

test('the version and its step', () => {
  assert.equal(GAME_VERSION, '0.97.0');
  const steps = stepsFor('0.96.0');
  assert.ok(steps.some((s) => s.to === '0.97.0'));
});
