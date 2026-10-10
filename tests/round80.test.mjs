// Round 80: the essentials of what's new, where it touches the game: a
// master's hall holding the rest of its place still; a player's copy of
// someone else's world never laying out towns; the town builder's lot test
// by counts and its towns laid out "elsewhere" just as here; the light
// looked at again only when a light changes; the cap on effects a frame;
// the guild strip's near-lately filter; great rooms in the old places; and
// the version.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeGame, stubInput } from './helpers.mjs';
import { DungeonRun } from '../src/game/dungeon.js';
import { World } from '../src/world/world.js';
import { buildLayout, adoptLayout, M } from '../src/world/settlement.js';
import { worldState, syncWorld, layHere } from '../src/world/laywork.js';
import { buildFloor } from '../src/world/dungeongen.js';
import { B } from '../src/world/blocks.js';
import { addEffect } from '../src/render/fx.js';
import { FX_CAPS, applySettings, DEFAULTS } from '../src/game/settings.js';
import { nearMates } from '../src/game/guilds.js';
import { GAME_VERSION, compareVersions } from '../src/version.js';
import { stepsFor } from '../src/game/migrate.js';

const input = stubInput();

test('a master fought with all of you in its hall: the rest of the place holds still till it\'s done', () => {
  const game = makeGame(12345);
  game.minute = 10 * 60;
  for (let i = 0; i < 10; i++) game.update(0.1, input);
  const p = game.player;
  const rec = { ...game.sim.dungeons.all.find((d) => d.type === 'barrow'), floors: {}, cleared: false, pack: null, packs: [] };
  const run = new DungeonRun(game, rec);
  run.enter();
  // Its hall: round where you stand; its master in it; one of its own away
  // down the floor, after you.
  run.data.bossRoom = { x0: p.x - 2, x1: p.x + 2, z0: p.z - 2, z1: p.z + 2 };
  const s = game.findFreeSpot(p.x + 1, p.z, p.y);
  const boss = run.spawn('barrow_king', s.x, s.y, s.z, { boss: true });
  const far = game.findFreeSpot(p.x + 12, p.z, p.y) || game.findFreeSpot(p.x - 12, p.z, p.y);
  const c = run.spawn('skeleton', far.x, far.y, far.z);
  c.dormant = 0;
  c.target = p;
  let ticks = 0;
  const upd = c.update.bind(c);
  c.update = (dt) => {
    ticks++;
    return upd(dt);
  };
  run.fight = { boss: [boss], name: 'X', title: '', tier: 1, t: 0, frac: 1, trail: 1, hitT: -9, away: 0 };
  for (let i = 0; i < 5; i++) game.update(0.05, input);
  assert.ok(run.focus, 'held still');
  assert.equal(ticks, 0, 'the one away down the floor not moved');
  assert.ok(game.heldStill(c));
  // Out of the hall (or the fight over): it all goes on.
  run.fight = null;
  for (let i = 0; i < 3; i++) game.update(0.05, input);
  assert.ok(!run.focus);
  assert.ok(ticks > 0);
});

test('someone else\'s world seen from here: no town laid out on this machine', () => {
  const w = new World(4242, { wg: 1 });
  w.remote = true;
  const s = w.ow.settlements[0];
  assert.equal(w.getLayout(s), null);
  assert.equal(w.layouts.size, 0);
});

test('the lot test by counts says what looking at every tile said, and a town laid out "on the worker" is the town laid out here', () => {
  const w = new World(777, { wg: 7 });
  const s = w.ow.settlements.find((q) => q.type === 'town');
  const L = buildLayout(w, s);
  const brute = (r, allowWater) => {
    const inset = L.settlement.type === 'city' ? 2 : 1;
    if (!L.inside(r.x0, r.z0, inset) || !L.inside(r.x1, r.z1, inset)) return false;
    for (let z = r.z0 - 1; z <= r.z1 + 1; z++) {
      for (let x = r.x0 - 1; x <= r.x1 + 1; x++) {
        const m = L.maskAt(x, z);
        const ring = x < r.x0 || x > r.x1 || z < r.z0 || z > r.z1;
        if (ring) {
          if ((m === M.BUILD && L.settlement.type === 'village') || m === M.WALL || m === M.FIELD) return false;
        } else if (!(m === M.FREE || (allowWater && m === M.WATER && !L.col(x, z).deep))) return false;
      }
    }
    return true;
  };
  let n = 0;
  let seed = 7;
  const rnd = (k) => {
    seed = (seed * 1103515245 + 12345) >>> 0;
    return seed % k;
  };
  for (let i = 0; i < 400; i++) {
    if (i === 200) for (let k = 0; k < 40; k++) L.setMask(L.bounds.x0 + rnd(L.W), L.bounds.z0 + rnd(L.D), [M.FREE, M.BUILD, M.FIELD][rnd(3)]);
    const x0 = L.bounds.x0 + rnd(L.W);
    const z0 = L.bounds.z0 + rnd(L.D);
    const r = { x0, z0, x1: x0 + 2 + rnd(6), z1: z0 + 2 + rnd(5) };
    for (const wet of [false, true]) {
      assert.equal(L.rectOk(r, wet), brute(r, wet));
      n++;
    }
  }
  assert.equal(n, 800);
  // The worker's way: a world from the seed, brought up to this one (a
  // village grown to a town since), the town laid out whole, sent back.
  const A = new World(777, { wg: 7 });
  const g = A.ow.settlements.find((q) => q.type === 'village');
  g.baseType = 'village';
  g.type = 'town';
  const Bw = new World(777, { wg: 7 });
  syncWorld(Bw, globalThis.structuredClone(worldState(A)));
  for (const q of [g, A.ow.settlements.find((t) => t.type === 'city')]) {
    const out = layHere(Bw, Bw.ow.settlements[q.id]);
    const copy = { ...q };
    const L2 = adoptLayout(A, copy, globalThis.structuredClone(out.data));
    const now = q.type;
    if (q.baseType) q.type = q.baseType;
    const L1 = buildLayout(A, q);
    q.type = now;
    const sig = (L) => JSON.stringify([[...L.placements].map(([k, a]) => [k, a.length, a.slice(0, 50)]), L.buildings.map((b) => [b.type, b.x0, b.z0, b.x1, b.z1]), L.npcs.length, [...L.mask].slice(0, 400)]);
    assert.equal(sig(L2), sig(L1), q.name);
    assert.deepEqual(L2.col(L1.bounds.x0 + 2, L1.bounds.z0 + 2), L1.col(L1.bounds.x0 + 2, L1.bounds.z0 + 2));
  }
});

test('the light looked at again for a light lit or put out, not for every other block\'s state', () => {
  const game = makeGame(12345);
  const p = game.player;
  const w = game.world;
  const y = w.findStandY(p.x + 2, p.z, p.y);
  w.setBlock(p.x + 2, y, p.z, B.lantern);
  game.lightDirty = false;
  w.setMeta(p.x + 2, y - 1, p.z, 1);
  assert.equal(game.lightDirty, false, 'the ground under it: no');
  w.setState(p.x + 2, y, p.z, true);
  assert.equal(game.lightDirty, true, 'the lantern lit: yes');
});

test('effects a frame: no more than the setting allows', () => {
  const r = { toView: (x, z) => [x, z], fx: [], fxLeft: 2 };
  for (let i = 0; i < 5; i++) addEffect(r, { type: 'ring', wx: 0, wz: 0, life: 1 });
  assert.equal(r.fx.length, 2);
  const renderer = {};
  applySettings({ ...DEFAULTS, fxCap: 2 }, { renderer });
  assert.equal(renderer.fxCap, FX_CAPS[2]);
  assert.ok(FX_CAPS[0].parts > FX_CAPS[2].parts);
});

test('the guild strip: only those near you in the last half a minute', () => {
  const seen = new Map();
  const p = { x: 0, z: 0 };
  const mates = [
    { id: 'a', here: true, x: 30, z: 10 },
    { id: 'b', here: true, x: 400, z: 0 },
    { id: 'c', here: false, x: 5, z: 5 },
  ];
  assert.deepEqual(nearMates(mates, p, seen, 1000).map((m) => m.id), ['a']);
  // (Gone off since: still shown a while, then not.)
  mates[0].x = 500;
  assert.deepEqual(nearMates(mates, p, seen, 20000).map((m) => m.id), ['a']);
  assert.deepEqual(nearMates(mates, p, seen, 40000).map((m) => m.id), []);
});

test('great rooms in the old places: bigger, walled into rooms within, each kind its own way, all of it reachable', () => {
  const styles = new Map();
  for (const type of ['barrow', 'mine', 'crypt', 'holdout', 'kavorent']) {
    let grand = 0;
    for (let seed = 1; seed <= 3; seed++) {
      const f = buildFloor({ id: seed, type, seed: seed * 7919, depth: 3, level: 1, x: 0, z: 0, name: 'T' }, 0);
      const P = f.plan;
      for (const r of f.rooms) {
        if (!r.grand) continue;
        grand++;
        styles.set(type, r.grand);
        assert.ok(r.inner.length > 0, `${type}: inner walls`);
        assert.ok(r.x1 - r.x0 + 1 >= 13 && r.z1 - r.z0 + 1 >= 11, `${type}: bigger`);
        // Every tile of it reachable from its middle.
        const W = P.W;
        const seen = new Set([r.cz * W + r.cx]);
        const q = [[r.cx, r.cz]];
        while (q.length) {
          const [x, z] = q.pop();
          for (const [ox, oz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nx = x + ox;
            const nz = z + oz;
            const k = nz * W + nx;
            if (nx < r.x0 || nz < r.z0 || nx > r.x1 || nz > r.z1 || seen.has(k) || !P.open[k]) continue;
            seen.add(k);
            q.push([nx, nz]);
          }
        }
        for (let z = r.z0; z <= r.z1; z++) for (let x = r.x0; x <= r.x1; x++) if (P.room[z * W + x] === r.id) assert.ok(seen.has(z * W + x), `${type}: (${x}, ${z}) cut off`);
      }
    }
    assert.ok(grand > 0, `${type}: a great room`);
  }
  assert.equal(new Set(styles.values()).size, 5, 'five ways');
});

test('version 0.80.0, with its step', () => {
  assert.ok(compareVersions(GAME_VERSION, '0.80.0') >= 0);
  assert.ok(stepsFor('0.79.0').some((s) => s.to === '0.80.0'));
});
