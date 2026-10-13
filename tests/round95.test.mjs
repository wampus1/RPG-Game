// Round 95: the barrow, made over. Every floor of it can be walked (its
// raised and sunken places too), in each land; the kerb ring's stones turn
// and, set in the chief's name, roll back the hoard-door; the name-stone
// that tells it is somewhere on the floor; the barrow's own creatures are
// all drawn; its masters are all painted by hand; and the version's step.
import test from 'node:test';
import assert from 'node:assert/strict';
import '../src/game/game.js';
import { buildFloor, FY } from '../src/world/dungeongen.js';
import { BLOCKS, B } from '../src/world/blocks.js';
import { SIGIL_BLOCKS } from '../src/world/deeps/barrow.js';
import { interact as deepInteract } from '../src/game/deeps.js';
import { SPECIES } from '../src/entities/creature.js';
import { BARROW_SPECIES } from '../src/entities/barrowmobs.js';
import { BARROW_MOBS } from '../src/render/art/barrow_mobs.js';
import { BARROW_BOSS_ART } from '../src/render/art/barrow_bosses.js';
import '../src/render/bossbody.js';
import { FORGE } from '../src/render/forge.js';
import { GAME_VERSION, compareVersions } from '../src/version.js';
import { stepsFor } from '../src/game/migrate.js';

const rec = (s, isle) => ({ id: `d${s}`, type: 'barrow', seed: s * 7919 + 13, depth: 3, level: 1 + (s % 3), isle, name: 'Test Mound', origin: { who: 'the Grey Jarl', y: 211 }, fallen: [] });
const blockAt = (f, x, y, z) => {
  const r = f.regions.get(Math.floor(x / 64) * 4096 + Math.floor(z / 36));
  return r ? r.get(x % 64, y, z % 36) : 0;
};
const PASS = new Set(['sealed', 'portcullis', 'boss_gate']);
const solid = (f, x, y, z) => {
  const b = BLOCKS[blockAt(f, x, y, z)];
  return !!(b && b.solid && !PASS.has(b.interact) && b.name !== 'weak_wall' && b.name !== 'spiral_seal');
};
const standY = (f, x, z) => {
  for (let y = FY + 1; y >= FY - 1; y--) if (!solid(f, x, y, z) && !solid(f, x, y + 1, z) && solid(f, x, y - 1, z)) return y;
  return null;
};
// Every tile you can get to from the way in, a step up or two down at a time.
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
      if (h2 > h && solid(f, f.x0 + x, h + 2, z)) continue;
      seen.add(i);
      st.push([nx, nz]);
    }
  }
  return seen;
}

test('every barrow floor can be walked, raised and sunken places and all, in every land', () => {
  for (const isle of [null, 'kharos', 'myrrow', 'velmarch']) {
    for (let s = 1; s <= 5; s++) {
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

// A floor with a kerb ring on it.
function ringFloor() {
  for (let s = 1; s <= 80; s++) {
    for (let n = 0; n < 3; n++) {
      const f = buildFloor(rec(s, null), n);
      if (f.spirals && f.spirals.length) return f;
    }
  }
  return null;
}

test('the kerb ring: its name-stone is on the floor; set in the chief\'s name, it opens the hoard', () => {
  const f = ringFloor();
  assert.ok(f, 'some barrow floor has a kerb ring');
  const sp = f.spirals[0];
  assert.equal(sp.stones.length, 4);
  assert.ok(sp.stones.some((s, i) => s.start !== sp.want[i]), 'the ring is not already set');
  const clue = (f.lore || []).find((q) => q.x === sp.clue.x && q.z === sp.clue.z);
  assert.ok(clue && /NAME-STONE/.test(clue.title), 'the name-stone is written');
  // (A world of just the stones and the door.)
  const blocks = new Map();
  const k = (x, y, z) => `${x},${y},${z}`;
  for (const s of sp.stones) blocks.set(k(s.x, FY, s.z), SIGIL_BLOCKS[s.start]);
  blocks.set(k(sp.door.x, FY, sp.door.z), B.stone);
  blocks.set(k(sp.door.x, FY + 1, sp.door.z), B.stone);
  const said = [];
  const game = {
    world: { getBlock: (x, y, z) => blocks.get(k(x, y, z)) ?? B.air, setBlock: (x, y, z, b) => blocks.set(k(x, y, z), b), setState: () => {} },
    renderer: { emit: () => {}, floatText: () => {} },
    ui: { msg: (t) => said.push(t), openSign: () => {} },
    audio: null,
  };
  const run = { game, data: f, state: {} };
  const turn = (s) => deepInteract(run, s.x, FY, s.z, BLOCKS[blocks.get(k(s.x, FY, s.z))]);
  // Turn every stone but the last to its sigil: the door stays shut.
  sp.stones.forEach((s, i) => {
    if (i === 3) return;
    for (let t = 0; t < (sp.want[i] - s.start + 4) % 4; t++) turn(s);
  });
  const last = sp.stones[3];
  if ((sp.want[3] - last.start + 4) % 4 === 0) {
    for (let t = 0; t < 4; t++) turn(last);
  } else {
    assert.equal(blocks.get(k(sp.door.x, FY, sp.door.z)), B.stone, 'not yet');
    for (let t = 0; t < (sp.want[3] - last.start + 4) % 4; t++) turn(last);
  }
  assert.equal(blocks.get(k(sp.door.x, FY, sp.door.z)), B.air, 'the hoard-door rolled back');
  assert.ok(run.state.deeps.opened[`${sp.door.x},${sp.door.z}`], 'and it stays open');
  assert.ok(said.some((t) => /grinds aside/.test(t)));
});

test('the barrow\'s own creatures are all in the game and all drawn', () => {
  for (const sp of Object.keys(BARROW_SPECIES)) {
    assert.ok(SPECIES[sp], `${sp} is a species`);
    assert.ok(BARROW_MOBS[sp], `${sp} is drawn`);
  }
});

test('the barrow\'s masters are all painted by hand, every part in place', () => {
  const names = Object.keys(BARROW_BOSS_ART);
  assert.equal(names.length, 22);
  for (const k of names) {
    const D = FORGE[k];
    assert.ok(D && D.pix, `${k} is painted`);
    const A = BARROW_BOSS_ART[k];
    assert.ok(A.body.rows.length, `${k} has a body`);
    for (const [n, q] of Object.entries(A.parts || {})) {
      assert.ok(q.pix && q.pix.rows.length, `${k}.${n} has a picture`);
      if (q.parent) assert.ok(A.parts[q.parent], `${k}.${n} hangs on ${q.parent}`);
    }
  }
  // (What their effects hang on: a figure's weapon arm and its blade, a
  // head where there's a breath or a glow from it.)
  for (const k of ['frost_jarl', 'bone_thane', 'trow_king', 'antlered_one', 'finnman', 'root_witch']) {
    assert.equal(BARROW_BOSS_ART[k].parts.blade.parent, 'armN', `${k}'s weapon is in its hand`);
  }
  for (const k of ['frost_jarl', 'jade_corpse_lord', 'raven_queen', 'salt_mummy']) assert.ok(BARROW_BOSS_ART[k].parts.head, `${k} has a head`);
});

test('the version and its step', () => {
  assert.ok(compareVersions(GAME_VERSION, '0.95.0') >= 0);
  assert.ok(stepsFor('0.94.0').some((s) => s.to === '0.95.0'));
});
