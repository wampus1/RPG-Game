// Round 112: the Sundered Reach made over. Its red stone and black glass,
// its faces and its things drawn afresh; its floors laid out by its own
// architect (the dwellings and their lofts up ladders, the observatory and
// the kiva under its sighting-stones, the fault and its chasm, the
// crystal-caverns, the shrine, the breach), a floor to each of what the
// void has done to it, beside its old rooms, every one walkable, the lofts
// too; what's written there made from its own story; its new creatures
// drawn and at work (the weaver's threads, and the stalkers that come for
// whoever's stuck in them; the shardbacks, let be or turned, and their
// crystals going up; the watchers' echoes remembering); the sky-dial; the
// chasms and their phase-bridges; and its master painted by hand.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGame, stubInput } from './helpers.mjs';
import { DungeonRun } from '../src/game/dungeon.js';
import { buildFloor, FY } from '../src/world/dungeongen.js';
import { BLOCKS, B } from '../src/world/blocks.js';
import { SPECIES } from '../src/entities/creature.js';
import { RIFT_SPECIES } from '../src/entities/riftmobs.js';
import { RIFT_MOBS } from '../src/render/art/rift_mobs.js';
import { RIFT_SPRITES, riftTop, riftFront } from '../src/render/art/rift_tex.js';
import { riftLore, SIGNS } from '../src/world/deeps/riftlore.js';
import { RIFT_OWN, STAGE_FLOOR } from '../src/world/deeps/rift.js';
import { ANCIENT_DTYPES } from '../src/world/ancient.js';
import { rfT, restore, beatOf, BRIDGE_ON, BRIDGE_WARN, FALL_DMG, burstAt, onKill } from '../src/game/riftwork.js';
import { findPath } from '../src/entities/pathfind.js';
import { GAME_VERSION, compareVersions } from '../src/version.js';
import { stepsFor } from '../src/game/migrate.js';
import { RIFT_BOSS_ART } from '../src/render/art/rift_bosses.js';
import { FORGE, forgePaint } from '../src/render/forge.js';
import '../src/render/bossbody.js';

const rec = (s) => ({ id: `r${s}`, type: 'rift', isle: 'ostria', seed: 1000 + s * 31, depth: 3, level: 4, vaultFloor: 1, origin: { who: 'the Rift Crawler', y: 744 }, townName: 'Redwater' });
const at = (f, x, y, z) => {
  const r = f.regions.get(Math.floor(x / 64) * 4096 + Math.floor(z / 36));
  return r ? r.get(x % 64, y, z % 36) : 0;
};
const PASS = new Set(['sealed', 'portcullis', 'boss_gate', 'rf_lid']);
// Every tile you can walk to from the way in, a step up or down at a time,
// or up a ladder onto a loft; never onto the abyss. (Things set on the
// floor aren't tiles to walk to.)
function reach(f) {
  const P = f.plan;
  const solid = (x, y, z) => {
    const b = BLOCKS[at(f, f.x0 + x, y, z)];
    return !!(b && b.solid && !PASS.has(b.interact));
  };
  const prop = (x, y, z) => (BLOCKS[at(f, f.x0 + x, y, z)] || {}).render === 'sprite';
  const ladder = (x, y, z) => !!(BLOCKS[at(f, f.x0 + x, y, z)] || {}).ladder;
  const stand = (x, z) => {
    if (!P.open[z * P.W + x]) return null;
    if (at(f, f.x0 + x, FY - 1, z) === B.rf_abyss) return null;
    for (const y of [FY - 1, FY, FY + 1, FY + 2]) if ((y === FY - 1 ? !solid(x, FY - 1, z) && solid(x, FY - 2, z) : (solid(x, y - 1, z) && !prop(x, y - 1, z)) || y === FY) && !solid(x, y, z) && !solid(x, y + 1, z)) return y;
    return null;
  };
  const seen = new Map();
  const e = [f.entry.x - f.x0, f.entry.z];
  seen.set(e[1] * P.W + e[0], stand(e[0], e[1]));
  const st = [e];
  while (st.length) {
    const [x, z] = st.pop();
    const h = seen.get(z * P.W + x);
    for (const [a, c] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + a;
      const nz = z + c;
      const i = nz * P.W + nx;
      if (nx < 0 || nz < 0 || nx >= P.W || nz >= P.D || seen.has(i)) continue;
      const h2 = stand(nx, nz);
      if (h2 === null) continue;
      if (h2 - h > 1 && !(ladder(x, h, z) || ladder(nx, h, nz) || ladder(x, h + 1, z))) continue;
      seen.set(i, h2);
      st.push([nx, nz]);
    }
  }
  let miss = 0;
  for (const r of f.rooms) {
    if (r.kit === 'hidden') continue;
    for (let z = r.z0; z <= r.z1; z++) {
      for (let x = r.x0; x <= r.x1; x++) {
        if (P.room[z * P.W + x] !== r.id) continue;
        const h = stand(x, z);
        // (The lofts, up their ladders; not the tops of things.)
        if (h === null || (h === FY + 2 && ![B.rf_dais, B.rf_rug].includes(at(f, f.x0 + x, FY + 1, z)))) continue;
        if (!seen.has(z * P.W + x)) miss++;
      }
    }
  }
  return miss;
}

test('every floor of a Sundered Reach can be walked, up the ladders onto its lofts', () => {
  for (let s = 0; s < 6; s++) for (let n = 0; n < 3; n++) assert.equal(reach(buildFloor(rec(s), n)), 0, `seed ${s} floor ${n}`);
});

test("the Reach is its own architect's now, a floor to each of what the void has done", () => {
  const T = ANCIENT_DTYPES.rift;
  assert.ok(T.arch, 'its architect');
  assert.equal(T.wall, B.rf_stone);
  assert.ok(T.mobs.some(([m]) => m === 'rift_weaver'));
  for (const k of ['sky_watcher', 'shardback']) assert.ok(T.kept.includes(k), k);
  for (let n = 0; n < 3; n++) {
    const f = buildFloor(rec(2), n);
    const h = f.rooms.find((r) => r.kit === 'dwelling');
    assert.ok(h, `a dwelling on floor ${n}`);
    let own = 0;
    // (The homes hold out longest: crazed stone even in the Between.)
    const want = n >= 2 ? [B.rf_crazed, B.rf_glass] : [B[STAGE_FLOOR[n]]];
    for (let z = h.z0; z <= h.z1; z++) for (let x = h.x0; x <= h.x1; x++) if (want.includes(at(f, f.x0 + x, FY - 1, z))) own++;
    assert.ok(own > 10, `its floor on floor ${n}: ${own}`);
  }
});

test('a floor of the Reach is laid out as one: the kiva and its stones, the chasms and their bridges, the lofts and ladders', () => {
  const kits = new Set();
  const n0 = { kivas: 0, faults: 0 };
  const sp = {};
  let lofts = 0;
  let ladders = 0;
  let glass = 0;
  for (let s = 0; s < 6; s++) {
    for (let n = 0; n < 3; n++) {
      const f = buildFloor(rec(s), n);
      const L = riftLore(rec(s), n);
      for (const r of f.rooms) kits.add(r.kit);
      for (const q of f.kivas || []) {
        assert.equal(q.dials.length, 4);
        q.dials.forEach((d, i) => {
          assert.equal(at(f, d.x, FY, d.z), B.rf_dial);
          assert.equal(d.want, L.sky[i], 'set to the sky as it stood');
        });
        for (const t of q.lid) {
          assert.equal(at(f, t.x, FY - 1, t.z), B.rf_lid);
          assert.ok(BLOCKS[at(f, t.x, FY - 2, t.z)].solid, 'the kiva floor under it');
        }
        assert.ok(q.loot.length > 0, 'something hidden down there');
      }
      for (const q of f.faults || []) {
        for (const t of q.abyss) assert.equal(at(f, t.x, FY - 1, t.z), B.rf_abyss);
        for (const g of q.bridges) for (const t of g) assert.equal(at(f, t.x, FY - 1, t.z), B.rf_bridge);
        assert.ok(q.bridges.length >= 1);
      }
      for (const k of Object.keys(n0)) n0[k] += (f[k] || []).length;
      for (const q of f.spawns) sp[q.species] = (sp[q.species] || 0) + 1;
      for (let z = 0; z < f.plan.D; z++) for (let x = 0; x < f.plan.W; x++) {
        if (at(f, f.x0 + x, FY + 1, z) === B.rf_dais) lofts++;
        if (BLOCKS[at(f, f.x0 + x, FY, z)].ladder) ladders++;
        if (n === 2 && at(f, f.x0 + x, FY - 1, z) === B.rf_glass) glass++;
      }
    }
  }
  for (const k of RIFT_OWN) assert.ok(kits.has(k), `the ${k}`);
  for (const [k, v] of Object.entries(n0)) assert.ok(v > 3, `${k}: ${v}`);
  assert.ok(lofts > 20, `lofts: ${lofts}`);
  assert.ok(ladders > 5, `ladders: ${ladders}`);
  assert.ok(glass > 60, `the black glass of the Between: ${glass}`);
  for (const k of ['void_stalker', 'shard_mote', 'echo_shade', 'rift_weaver', 'shardback', 'sky_watcher']) assert.ok(sp[k] > 2, `${k}: ${sp[k]}`);
});

test("what's written in the Reach is its own story, the same each time; the journal has how the sky stood", () => {
  const L = riftLore(rec(3), 0);
  const L2 = riftLore(rec(3), 0);
  assert.deepEqual(L.journal(), L2.journal());
  assert.deepEqual(L.sky, riftLore(rec(3), 2).sky, 'the same sky on every floor');
  const j = L.journal().lines[0].toLowerCase();
  L.sky.forEach((s) => assert.ok(j.includes(SIGNS[s].name.toLowerCase()), SIGNS[s].name));
  assert.ok(L.story().lines.join(' ').includes(L.mesa));
  assert.ok(L.last().lines.join(' ').includes('Redwater'));
  assert.equal(riftLore(rec(3), 2).stage, 'between');
  assert.notEqual(L.potter, undefined);
  assert.equal(typeof L.potter, 'string', "the potter's name, not overwritten");
  for (const k of ['journal', 'chart', 'mural', 'mark', 'spirit', 'story', 'last', 'hall']) {
    const e = L[k]();
    assert.ok(e.title && e.lines.length, k);
  }
  assert.ok(L.memory().length > 10);
});

test("the Reach's tiles and things are drawn; its new creatures are in the game and drawn", () => {
  for (const n of ['rf_stone', 'rf_mural', 'rf_niche', 'rf_chart', 'rf_glasswall', 'rf_tearwall']) assert.ok(riftFront(n, 0) && riftTop(n, 0), n);
  for (const n of ['rf_sand', 'rf_crazed', 'rf_glass', 'rf_abyss', 'rf_bridge', 'rf_rug', 'rf_lid']) assert.ok(riftTop(n, 1), n);
  for (const [n, f] of Object.entries(RIFT_SPRITES)) {
    assert.ok(B[n] !== undefined, n);
    assert.ok(f(0, false, 0) && f(3, true, 1), n);
  }
  for (const k of Object.keys(RIFT_SPECIES)) assert.ok(SPECIES[k], k);
  for (const k of ['rift_weaver', 'shardback', 'sky_watcher', 'void_stalker', 'shard_mote']) {
    const A = RIFT_MOBS[k];
    assert.ok(A && A.size === 24 && A.groups.walk && A.groups.attack, k);
  }
  assert.equal(SPECIES.sky_watcher.mode, 'passive');
  assert.equal(SPECIES.shardback.mode, 'neutral');
});

function inReach() {
  const game = makeGame(12345);
  const input = stubInput();
  game.minute = 600;
  for (let i = 0; i < 20; i++) game.update(0.1, input);
  const base = game.sim.dungeons.all.find((q) => q.type === 'crypt');
  const r = { ...base, type: 'rift', isle: 'ostria', floors: {}, cleared: false, pack: null, weakened: 0 };
  new DungeonRun(game, r).enter();
  const d = game.dungeon;
  for (const c of game.creatures) {
    c.dead = true;
    game.removeOcc(c);
  }
  game.creatures = [];
  game.cheats = { ...(game.cheats || {}), god: false };
  for (const k of ['kivas', 'faults']) d.data[k] = [];
  // A clear hall, 15 by 8, about the way in.
  const e = d.data.rooms.find((q) => q.kit === 'entry');
  const x0 = d.data.x0 + e.cx - 7;
  const z0 = e.cz - 2;
  for (let z = z0 - 2; z <= z0 + 5; z++) {
    for (let x = x0 - 1; x <= x0 + 15; x++) {
      for (const y of [FY, FY + 1, FY + 2]) game.world.setBlock(x, y, z, B.air);
      game.world.setBlock(x, FY - 1, z, B.rf_sand);
      game.world.setBlock(x, FY - 2, z, B.rf_stone);
    }
  }
  game.zones = [];
  const p = game.player;
  p.teleport(x0, FY, z0 + 5);
  p.hp = p.maxHp = 200;
  d.riftT = null;
  return { game, input, d, p, x0, z0 };
}
const run = (game, input, secs) => {
  for (let t = 0; t < secs; t += 0.05) game.update(0.05, input);
};

test('the sky-dial: the stones turned as the sky stood, the lid falls in on what was hidden (and stays open)', () => {
  const { game, d, x0, z0 } = inReach();
  const w = game.world;
  const c = { x: x0 + 7, z: z0 + 1 };
  const lid = [];
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
    w.setBlock(c.x + dx, FY - 1, c.z + dz, B.rf_lid);
    lid.push({ x: c.x + dx, z: c.z + dz });
  }
  const want = [2, 0, 3, 1];
  const dials = [[0, -3], [3, 0], [0, 3], [-3, 0]].map(([dx, dz], i) => ({ x: c.x + dx, z: c.z + dz, want: want[i], quarter: i }));
  for (const q of dials) w.setBlock(q.x, FY, q.z, B.rf_dial, (q.want + 1) & 3);
  const q = { dials, lid, c, loot: [['gem', 2]], room: 0 };
  d.data.kivas = [q];
  // Three of them right: still shut.
  for (const dl of dials.slice(0, 3)) for (let k = 0; k < 3; k++) d.interact(dl.x, FY, dl.z, BLOCKS[B.rf_dial]);
  dials.slice(0, 3).forEach((dl) => assert.equal(w.getMeta(dl.x, FY, dl.z) & 3, dl.want));
  assert.equal(w.getBlock(c.x, FY - 1, c.z), B.rf_lid, 'not yet');
  const before = (game.drops || game.items || []).length;
  for (let k = 0; k < 3; k++) d.interact(dials[3].x, FY, dials[3].z, BLOCKS[B.rf_dial]);
  assert.equal(w.getBlock(c.x, FY - 1, c.z), B.air, 'the lid fallen in');
  assert.ok(dials.every((dl) => w.getState(dl.x, FY, dl.z)), 'the stones lit');
  assert.ok((game.drops || game.items || []).length >= before);
  for (const t of lid) w.setBlock(t.x, FY - 1, t.z, B.rf_lid);
  restore(d);
  assert.equal(w.getBlock(c.x, FY - 1, c.z), B.air, 'still open');
});

test('the chasm: step onto the abyss and you fall, and come to where you stood, hurt; the bridges come and go on their beat; nothing that walks paths over it', () => {
  const { game, input, d, p, x0, z0 } = inReach();
  const w = game.world;
  const abyss = [];
  const bridge = [];
  for (let z = z0 - 2; z <= z0 + 5; z++) for (const x of [x0 + 7, x0 + 8]) {
    if (z === z0 + 2) {
      w.setBlock(x, FY - 1, z, B.rf_bridge);
      bridge.push({ x, z });
    } else {
      w.setBlock(x, FY - 1, z, B.rf_abyss);
      abyss.push({ x, z });
    }
  }
  d.data.faults = [{ abyss, bridges: [bridge], room: 0, beat: 0 }];
  assert.equal(beatOf(0), 'on');
  assert.equal(beatOf(BRIDGE_ON + 0.1), 'warn');
  assert.equal(beatOf(BRIDGE_ON + BRIDGE_WARN + 0.1), 'off');
  // Fall: back where you stood, hurt.
  p.teleport(x0 + 6, FY, z0);
  run(game, input, 0.2);
  const hp = p.hp;
  p.teleport(x0 + 7, FY, z0);
  run(game, input, 0.2);
  assert.ok(p.hp <= hp - FALL_DMG + 1, `hurt: ${hp} -> ${p.hp}`);
  assert.equal(w.getBlock(p.x, FY - 1, p.z) === B.rf_abyss, false, 'out of it');
  assert.equal(p.x, x0 + 6, 'where you stood');
  // The bridge: gone on its beat, and back.
  p.teleport(x0 + 2, FY, z0 + 4);
  rfT(d).clock = 0;
  run(game, input, BRIDGE_ON + BRIDGE_WARN + 0.3);
  assert.equal(w.getBlock(bridge[0].x, FY - 1, bridge[0].z), B.rf_abyss, 'gone');
  run(game, input, 3.2);
  assert.equal(w.getBlock(bridge[0].x, FY - 1, bridge[0].z), B.rf_bridge, 'back');
  // A path for something that walks never goes over the edge.
  for (const t of bridge) w.setBlock(t.x, FY - 1, t.z, B.rf_abyss);
  const path = findPath(w, x0 + 4, FY, z0 + 2, x0 + 11, FY, z0 + 2, { maxNodes: 2000 });
  assert.ok(!path || path.every(([x, , z]) => !BLOCKS[w.getBlock(x, FY - 1, z)].abyss), 'round, never over');
  // Knocked in, it's gone.
  const s = d.spawn('void_stalker', x0 + 7, FY, z0 + 4, {});
  s.dormant = 99;
  run(game, input, 0.2);
  assert.ok(s.dead, 'fallen');
});

test("a weaver's thread sticks you, and the stalkers come for you; a mote going up snaps the threads, and stirs the shardbacks", () => {
  const { game, input, d, p, x0, z0 } = inReach();
  game.cheats.god = true;
  const wv = d.spawn('rift_weaver', x0 + 10, FY, z0 + 2, {});
  wv.dormant = 0;
  wv.target = p;
  wv.spinCd = 0;
  p.teleport(x0 + 5, FY, z0 + 2);
  run(game, input, 0.3);
  const th = (game.zones || []).find((z) => z.thread && !z.done);
  assert.ok(th, 'a thread strung');
  assert.ok(th.tiles.some((t) => t.x === p.x && t.z === p.z) || th.tiles.length >= 4);
  // Stuck: the stalker blinks for you.
  const st = d.spawn('void_stalker', x0 + 12, FY, z0 + 4, {});
  st.dormant = 0;
  st.blinkCd = 9;
  p.grabbedT = 1;
  run(game, input, 0.1);
  assert.ok(st.blinkCd < 1, 'it comes');
  // A burst by the thread: it snaps; a shardback near turns.
  const sb = d.spawn('shardback', th.tiles[0].x, FY, th.tiles[0].z + 2, {});
  sb.dormant = 0;
  burstAt(d, th.tiles[0]);
  assert.ok(th.done, 'snapped');
  assert.ok(sb.angry, 'bristling');
});

test("a shardback killed goes up and cuts what's by it; a watcher's echo remembers at you, and killed comes back wrong", () => {
  const { game, input, d, p, x0, z0 } = inReach();
  p.teleport(x0 + 14, FY, z0 + 5);
  game.cheats.god = true;
  const sb = d.spawn('shardback', x0 + 4, FY, z0 + 1, {});
  const foe = d.spawn('echo_shade', x0 + 5, FY, z0 + 1, {});
  foe.dormant = 99;
  // (Held where it stands while the crystals hum.)
  foe.stunT = 5;
  const hp = foe.hp;
  game.damage(sb, sb.hp + 50, p);
  run(game, input, 1.2);
  assert.ok(foe.dead || foe.hp < hp, 'cut by the crystals');
  // A watcher remembers.
  const wt = d.spawn('sky_watcher', x0 + 10, FY, z0 + 3, { peaceful: true });
  wt.dormant = 0;
  p.teleport(x0 + 11, FY, z0 + 3);
  run(game, input, 0.2);
  assert.ok(rfT(d).heard.has(wt), 'it remembered');
  // Killed: back wrong.
  const n = game.creatures.filter((c) => c.species === 'echo_shade' && !c.dead).length;
  onKill(d, wt);
  assert.ok(game.creatures.filter((c) => c.species === 'echo_shade' && !c.dead && c.wrong).length > 0 && game.creatures.filter((c) => c.species === 'echo_shade' && !c.dead).length > n);
});

test('the version and its step', () => {
  assert.ok(compareVersions(GAME_VERSION, '1.12.0') >= 0);
  assert.ok(stepsFor('1.11.0').some((s) => s.to === '1.12.0'));
});

test('the Rift Crawler is painted by hand: the rift down it opening and closing, torn wide when it rises; its head as it winds up or burns; its legs still its own', () => {
  assert.deepEqual(Object.keys(RIFT_BOSS_ART), ['rift_crawler']);
  const A = RIFT_BOSS_ART.rift_crawler;
  assert.equal(A.size, 128);
  assert.equal(A.ay, 126);
  assert.deepEqual(A.idle, [0, 4]);
  assert.deepEqual(A.states.risen.idle, [4, 4]);
  const D = FORGE.rift_crawler;
  assert.ok(D.pix);
  assert.ok(D.legs, 'its legs stepping where they fall');
  assert.ok(A.parts.head.pixVariants.wind && A.parts.head.pixVariants.risen);
  assert.equal(A.parts.armF.parent, 'head');
  assert.ok(typeof D.parts.armF.show === 'function', 'an arm not drawn while it reaches out with it');
  const diff = (a, b) => {
    let n = 0;
    for (let i = 0; i < a.d.length; i += 4) if (a.d[i] !== b.d[i] || a.d[i + 3] !== b.d[i + 3]) n++;
    return n;
  };
  const a = forgePaint('rift_crawler', 0, {});
  const b = forgePaint('rift_crawler', 12, {});
  const r = forgePaint('rift_crawler', 0, { risen: 1 });
  assert.ok(diff(a, b) > 10, 'the rift breathing');
  assert.ok(diff(a, r) > 100, 'torn wide');
});
