// Round 99: the Kavorent made over. Its tiles and things drawn afresh
// (painted around cyan, turned to each floor's light); its floors laid out
// by its own architect (the sleepers' cradle hall, the concourse and its
// gallery, the orrery, the repair bay, the conduit spine, the memory well)
// beside its old rooms, every one walkable; what's written there made from
// its own history; its new constructs drawn; and its works at work: the
// well's glyph pillars (and the archivist who wakes its console), the
// sentinel lenses, the live cables, the conductor's arc, the prism that
// relays light and turns shots back, the reclaimer that builds mites out
// of wrecks.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGame, stubInput } from './helpers.mjs';
import { DungeonRun } from '../src/game/dungeon.js';
import { buildFloor, FY, DTYPES } from '../src/world/dungeongen.js';
import { BLOCKS, B, META_ROT } from '../src/world/blocks.js';
import { SPECIES } from '../src/entities/creature.js';
import { KAV_SPECIES } from '../src/entities/kavmobs.js';
import { KAV_MOBS } from '../src/render/art/kav_mobs.js';
import { KAV_SPRITES } from '../src/render/art/kav_tex.js';
import { KAV_BOSS_ART } from '../src/render/art/kav_bosses.js';
import { FORGE, forgePaint } from '../src/render/forge.js';
import '../src/render/bossbody.js';
import { kavTop, kavFront } from '../src/render/art/kav_tex.js';
import { kavLore, GLYPHS } from '../src/world/deeps/kavlore.js';
import { KAV_OWN } from '../src/world/deeps/kavorent.js';
import { GAME_VERSION, compareVersions } from '../src/version.js';
import { stepsFor } from '../src/game/migrate.js';

const rec = (s, isle) => ({ id: `k${s}`, type: 'kavorent', seed: s * 7919 + 29, depth: 4, level: 2 + (s % 3), isle, name: 'The Humming Hill', townName: 'Hobb', vaults: [1] });
const blockAt = (f, x, y, z) => {
  const r = f.regions.get(Math.floor(x / 64) * 4096 + Math.floor(z / 36));
  return r ? r.get(x % 64, y, z % 36) : 0;
};
const PASS = new Set(['sealed', 'portcullis', 'boss_gate']);
const solid = (f, x, y, z) => {
  const b = BLOCKS[blockAt(f, x, y, z)];
  return !!(b && b.solid && !PASS.has(b.interact) && b.name !== 'weak_wall' && b.name !== 'kav_field');
};
const standY = (f, x, z) => {
  for (let y = FY + 2; y >= FY - 1; y--) if (!solid(f, x, y, z) && !solid(f, x, y + 1, z) && solid(f, x, y - 1, z)) return y;
  return null;
};
// Every tile you can walk to from the way in: a step up or down at a time
// (the dais, the gallery, down into a channel and out again).
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
      if (h2 == null || Math.abs(h2 - h) > 1) continue;
      seen.add(i);
      st.push([nx, nz]);
    }
  }
  return seen;
}
const nextTo = (seen, W, x0, p) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, c]) => seen.has((p.z + c) * W + p.x + a - x0));

test('every Kavorent floor can be walked, daises, galleries and channels and all, on every island', () => {
  for (const isle of ['thessa', 'kharos', 'myrrow']) {
    for (let s = 1; s <= 3; s++) {
      for (let n = 0; n < 4; n++) {
        const f = buildFloor(rec(s, isle), n);
        const seen = reach(f);
        const W = f.plan.W;
        const at = `${isle} ${s}/${n}`;
        for (const r of f.rooms) {
          if (r.kit === 'hidden' || r.sealed || r.kit === 'vault') continue;
          let ok = false;
          for (let z = r.z0; z <= r.z1 && !ok; z++) for (let x = r.x0; x <= r.x1 && !ok; x++) ok = f.plan.room[z * W + x] === r.id && seen.has(z * W + x);
          assert.ok(ok, `${at}: the ${r.kit} room can't be reached`);
        }
        if (f.downAt) assert.ok(seen.has(f.downAt.z * W + f.downAt.x - f.x0), `${at}: the lift down can't be reached`);
        // The well's pillars, its console; the archivist's consoles.
        for (const wl of f.wells || []) {
          for (const p of wl.pillars) assert.ok(nextTo(seen, W, f.x0, p), `${at}: a glyph pillar`);
          if (wl.console) assert.ok(nextTo(seen, W, f.x0, wl.console), `${at}: the well's console`);
        }
      }
    }
  }
});

test('a Kavorent floor is laid out as the Kavorent: its own rooms beside its old ones, its sleepers, its riddles', () => {
  const kits = new Set();
  let pods = 0;
  let names = 0;
  let cables = 0;
  let lenses = 0;
  for (let s = 1; s <= 5; s++) {
    const R = rec(s, 'thessa');
    for (let n = 0; n < 4; n++) {
      const f = buildFloor(R, n);
      for (const r of f.rooms) kits.add(r.kit);
      // The sleepers' hall on every floor but its master's; the old
      // puzzles kept.
      if (n < 3) assert.ok(f.rooms.some((r) => r.kit === 'cradle'), `${s}/${n}: the cradle hall`);
      assert.ok(f.rooms.some((r) => r.kit === 'reactor') || f.rooms.some((r) => r.kit === 'field'), `${s}/${n}: the old puzzles`);
      for (let z = 0; z < f.plan.D; z++) {
        for (let x = 0; x < f.plan.W; x++) {
          for (const y of [FY, FY + 1]) {
            const id = blockAt(f, f.x0 + x, y, z);
            if (id === B.kav_pod || id === B.kav_pod_open || id === B.kav_pod_broken) pods++;
            if (id === B.kav_mural) names++;
          }
        }
      }
      cables += (f.cables || []).length;
      lenses += (f.lenses || []).length;
      for (const L of f.lenses || []) assert.equal(blockAt(f, L.x, FY, L.z), B.kav_lens);
      // The well: three pillars, each with a glyph it wants, and its
      // console's words name them in order.
      for (const wl of f.wells || []) {
        assert.equal(wl.pillars.length, 3);
        assert.equal(blockAt(f, wl.x, FY, wl.z), B.kav_well);
        for (const p of wl.pillars) assert.equal(blockAt(f, p.x, FY, p.z), B.kav_glyph);
        assert.ok(wl.text.lines.join(' ').includes(wl.pillars.map((p) => GLYPHS[p.want][0].toUpperCase() + GLYPHS[p.want].slice(1)).join(', then ')));
      }
      // The archivist walks a round ending at the well's console.
      for (const a of f.spawns.filter((q) => q.species === 'archivist')) {
        assert.ok(a.peaceful && a.route && a.route.length, 'its round');
        const wl = (f.wells || [])[0];
        if (wl && wl.console) assert.deepEqual(a.route[a.route.length - 1], wl.console);
      }
    }
  }
  for (const k of KAV_OWN) assert.ok(kits.has(k), `some floor has a ${k}`);
  for (const k of ['hall', 'lab', 'reactor', 'field', 'hangar']) assert.ok(kits.has(k), `the old ${k} kept`);
  assert.ok(pods > 20 && names > 10 && cables > 0 && lenses > 5, `pods ${pods}, names ${names}, cables ${cables}, lenses ${lenses}`);
});

test('what\'s written in a Kavorent ruin is its own, and the same each time', () => {
  const a = kavLore(rec(1), 0, 'overseer');
  const b = kavLore(rec(1), 0, 'overseer');
  const c = kavLore(rec(2), 0, 'overseer');
  assert.equal(a.cadence, b.cadence);
  assert.deepEqual(a.plate(), b.plate());
  assert.notEqual(a.cadence, c.cadence);
  assert.ok(a.last().lines.some((l) => l.includes('Overseer')));
  assert.ok(a.visitor().lines[0].includes('Hobb'), 'the town above remembers it');
  for (const k of ['plate', 'woke', 'names', 'orrery', 'worklog', 'warning', 'visitor', 'last']) {
    const t = a[k]();
    assert.ok(t.title && t.lines.length >= 2 && t.lines.every((l) => typeof l === 'string' && l.length > 3), k);
  }
  // On the floors: the sleepers' plates, the names, the master's word.
  const f = buildFloor(rec(1, 'thessa'), 0);
  assert.ok(f.lore.some((l) => l.title === 'The Names'));
  assert.ok(f.lore.some((l) => l.title === 'A Sleeper\'s Plate'));
  assert.ok(f.lore.some((l) => l.title === 'Scratched in the Alloy'), 'someone from above got this far');
});

test('the Kavorent\'s tiles and things are drawn; its new constructs are in the game and drawn', () => {
  for (const k of ['kav_wall', 'kav_floor', 'kav_inlay', 'kav_grate', 'kav_dais', 'kav_cables', 'kav_lift', 'kav_debris', 'kav_glow', 'kav_mural', 'kav_viewport', 'kav_failed']) {
    for (let v = 0; v < 4; v++) assert.ok(kavTop(k, v).d.some((q) => q), `${k} top`);
  }
  for (const k of ['kav_wall', 'kav_mural', 'kav_viewport', 'kav_failed', 'kav_dais', 'kav_cables', 'kav_glow']) assert.ok(kavFront(k, 0).d.some((q) => q), `${k} face`);
  for (const [k, f] of Object.entries(KAV_SPRITES)) {
    for (const st of [0, 1]) assert.ok(f(0, st, 0).d.some((q) => q), `${k} is drawn`);
    assert.ok(BLOCKS[B[k]], `${k} is a block`);
  }
  for (const sp of Object.keys(KAV_SPECIES)) {
    assert.ok(SPECIES[sp], `${sp} is a species`);
    assert.ok(KAV_MOBS[sp] && KAV_MOBS[sp].rows.length === 24, `${sp} is drawn`);
  }
  assert.ok(DTYPES.kavorent.arch, 'its own architect');
});

// ------------------------------------------------------- in the ruin itself
function inRuin() {
  const game = makeGame(12345);
  const input = stubInput();
  game.minute = 600;
  for (let i = 0; i < 20; i++) game.update(0.1, input);
  const base = game.sim.dungeons.all.find((d) => d.type === 'kavorent');
  const r = { ...base, floors: {}, cleared: false, pack: null, weakened: 0 };
  new DungeonRun(game, r).enter();
  const d = game.dungeon;
  for (const c of game.creatures) {
    c.dead = true;
    game.removeOcc(c);
  }
  game.creatures = [];
  game.cheats = { ...(game.cheats || {}), god: false };
  d.data.lenses = [];
  d.data.wells = [];
  // A clear stretch of floor, 15 by 8, about the way in.
  const e = d.data.rooms.find((q) => q.kit === 'entry');
  const x0 = d.data.x0 + e.cx - 7;
  const z0 = e.cz - 2;
  for (let z = z0 - 2; z <= z0 + 5; z++) {
    for (let x = x0 - 1; x <= x0 + 15; x++) {
      for (const y of [FY, FY + 1, FY + 2]) game.world.setBlock(x, y, z, B.air);
      game.world.setBlock(x, FY - 1, z, B.kav_floor);
      game.world.setBlock(x, FY - 2, z, B.kav_wall);
    }
  }
  const p = game.player;
  p.teleport(x0, FY, z0 + 2);
  p.hp = p.maxHp = 200;
  d.kavT = null;
  return { game, input, d, p, x0, z0 };
}
const run = (game, input, secs) => {
  for (let t = 0; t < secs; t += 0.05) game.update(0.05, input);
};

test('the memory well: its console dark till the archivist wakes it; the pillars turned right, it gives back what it keeps', () => {
  const { game, input, d, p, x0, z0 } = inRuin();
  const wl = { x: x0 + 7, z: z0, pillars: [], cache: { x: x0 + 7, z: z0 - 1 }, console: { x: x0 + 12, z: z0 - 1 }, text: { title: 'The Memory Well', lines: ['x', 'The Ring, then the Count, then the Spire'] } };
  game.world.setBlock(wl.x, FY, wl.z, B.kav_well);
  game.world.setBlock(wl.console.x, FY, wl.console.z, B.kav_console);
  const want = [1, 3, 0];
  for (let i = 0; i < 3; i++) {
    const q = { x: x0 + 5 + i * 2, z: z0 + 2, want: want[i] };
    game.world.setBlock(q.x, FY, q.z, B.kav_glyph, (want[i] + 2) % 4);
    wl.pillars.push(q);
  }
  d.data.wells = [wl];
  d.kavT = null;
  // Dark, till its keeper comes by.
  let said = '';
  const msg = game.ui.msg;
  game.ui.msg = (t) => (said = t);
  d.interact(wl.console.x, FY, wl.console.z, BLOCKS[B.kav_console]);
  assert.match(said, /dark/);
  const a = d.spawn('archivist', wl.console.x - 1, FY, wl.console.z + 1, { peaceful: true, route: [wl.console] });
  run(game, input, 1);
  assert.ok(game.world.getState(wl.console.x, FY, wl.console.z), 'its keeper woke it');
  let sign = null;
  game.ui.openSign = (lines, title) => (sign = { lines, title });
  d.interact(wl.console.x, FY, wl.console.z, BLOCKS[B.kav_console]);
  assert.equal(sign && sign.title, 'The Memory Well');
  game.ui.msg = msg;
  // Turned: each turn its next glyph; all three right, the well gives.
  p.teleport(x0 + 7, FY, z0 + 3);
  for (let i = 0; i < 3; i++) {
    const q = wl.pillars[i];
    while ((game.world.getMeta(q.x, FY, q.z) & META_ROT) !== q.want) d.interact(q.x, FY, q.z, BLOCKS[B.kav_glyph]);
  }
  assert.ok(d.state.deeps.kav.solved[`${wl.x},${wl.z}`], 'set right');
  assert.equal(game.world.getBlock(wl.cache.x, FY, wl.cache.z), B.kav_cache, 'and what it kept, given back');
  assert.ok(game.drops.some((q) => Math.abs(q.x - wl.cache.x) <= 1 && Math.abs(q.z - wl.cache.z) <= 1), 'spilling out');
  assert.ok(!a.dead);
  d.leave();
});

test('the archivist struck sounds the alarm and flees; fallen, its light passes to the well\'s console', () => {
  const { game, input, d, p, x0, z0 } = inRuin();
  const con = { x: x0 + 14, z: z0 - 1 };
  game.world.setBlock(con.x, FY, con.z, B.kav_console);
  d.data.wells = [{ x: x0 + 12, z: z0, pillars: [], cache: null, console: con, text: { title: 'x', lines: ['y'] } }];
  d.kavT = null;
  const w = d.spawn('warden', x0 + 10, FY, z0 + 4, { dormant: 99 });
  const a = d.spawn('archivist', x0 + 3, FY, z0 + 2, { peaceful: true, route: [{ x: x0 + 3, z: z0 - 1 }] });
  p.teleport(x0 + 2, FY, z0 + 2);
  game.damage(a, 1, p);
  assert.ok(a.alarmed && a.fleeT > 0, 'away from you');
  assert.equal(w.dormant, 0, 'and the constructs near come');
  game.kill(a, p);
  run(game, input, 0.2);
  assert.ok(game.world.getState(con.x, FY, con.z), 'the console wakes as it falls');
  d.leave();
});

test('a sentinel lens sees you and calls what\'s near; the cables bite', () => {
  const { game, input, d, p, x0, z0 } = inRuin();
  game.world.setBlock(x0 + 6, FY, z0, B.kav_lens);
  d.data.lenses = [{ x: x0 + 6, z: z0 }];
  const w = d.spawn('warden', x0 + 14, FY, z0 + 4, { dormant: 99 });
  p.teleport(x0 + 4, FY, z0 + 2);
  run(game, input, 0.3);
  assert.ok(game.world.getState(x0 + 6, FY, z0), 'its eye burns');
  assert.equal(w.dormant, 0, 'the warden called');
  // Down among the live cables.
  for (const x of [x0 + 10, x0 + 11]) {
    game.world.setBlock(x, FY - 1, z0 + 4, B.air);
    game.world.setBlock(x, FY - 2, z0 + 4, B.kav_cables);
  }
  game.removeOcc(w);
  w.dead = true;
  const hp = p.hp;
  p.teleport(x0 + 10, FY - 1, z0 + 4);
  run(game, input, 1);
  assert.ok(p.hp < hp, 'shocked');
  d.leave();
});

test('a conductor holds an arc to its kind, and whoever crosses it is shocked', () => {
  const { game, input, d, p, x0, z0 } = inRuin();
  const c = d.spawn('conductor', x0 + 3, FY, z0 + 2, {});
  const w = d.spawn('warden', x0 + 9, FY, z0 + 2, {});
  c.target = p;
  w.target = null;
  w.stunT = 99;
  p.teleport(x0 + 6, FY, z0 + 2);
  const hp = p.hp;
  for (let t = 0; t < 3 && !(c.arc && c.arc.t > c.arc.warm); t += 0.05) {
    game.update(0.05, input);
    if (!p.dead) p.teleport(x0 + 6, FY, z0 + 2);
  }
  assert.ok(c.arc && c.arc.to === w, 'strung to the warden');
  run(game, input, 0.6);
  assert.ok(p.hp < hp, 'and the line bit');
  d.leave();
});

test('a prism turns a shot back; a drone\'s light sent through it comes at you', () => {
  const { game, input, d, p, x0, z0 } = inRuin();
  const pr = d.spawn('prism', x0 + 6, FY, z0 + 2, {});
  const hp = p.hp;
  const php = pr.hp;
  p.teleport(x0 + 1, FY, z0 + 2);
  game.damage(pr, 4, p);
  assert.equal(pr.hp, php, 'it took nothing');
  assert.ok(p.hp < hp, 'and gave it back');
  // Up close a blade goes home.
  p.teleport(x0 + 5, FY, z0 + 2);
  game.damage(pr, 4, p);
  assert.ok(pr.hp < php);
  const dr = d.spawn('drone', x0 + 10, FY, z0 + 4, {});
  dr.beamCd = 99;
  pr.target = p;
  pr.relayCd = 0;
  p.teleport(x0 + 1, FY, z0 + 2);
  run(game, input, 0.2);
  assert.ok((game.hazards || []).some((h) => h.by === pr && h.kind === 'beam'), 'relayed');
  d.leave();
});

test('a reclaimer builds a mite out of a fallen construct', () => {
  const { game, input, d, p, x0, z0 } = inRuin();
  const rc = d.spawn('reclaimer', x0 + 10, FY, z0 + 2, {});
  const w = d.spawn('warden', x0 + 7, FY, z0 + 2, {});
  p.teleport(x0, FY, z0 - 1);
  rc.target = null;
  game.kill(w, p);
  assert.ok(d.kavT.wrecks.some((q) => q.x === x0 + 7 && q.z === z0 + 2), 'a wreck');
  const mites = () => game.creatures.filter((c) => c.species === 'mite' && !c.dead).length;
  const before = mites();
  run(game, input, 5);
  assert.ok(mites() > before, 'a mite built from it');
  assert.ok(!d.kavT.wrecks.some((q) => q.x === x0 + 7 && q.z === z0 + 2), 'and the wreck used up');
  d.leave();
});

test('the version and its step', () => {
  assert.ok(compareVersions(GAME_VERSION, '0.99.0') >= 0);
  assert.ok(stepsFor('0.98.0').some((s) => s.to === '0.99.0'));
});

test('the Kavorent\'s masters are painted by hand, every part in place', () => {
  assert.deepEqual(Object.keys(KAV_BOSS_ART).sort(), ['condenser', 'crucible', 'overseer', 'prime']);
  for (const [k, A] of Object.entries(KAV_BOSS_ART)) {
    assert.ok(SPECIES[k], `${k} is a species`);
    assert.ok(FORGE[k] && FORGE[k].pix, `${k} is painted`);
    assert.equal(A.size, 128);
    assert.equal(A.body.rows.length, 128, `${k} has a body`);
    for (const [n, q] of Object.entries(A.parts)) assert.ok(q.pix && q.pix.rows.length, `${k}.${n} has a picture`);
  }
  // (What moves of itself goes where its forged part went: the shards and
  // vanes orbiting, the Prime's stones floating.)
  for (let i = 0; i < 6; i++) assert.equal(typeof FORGE.overseer.parts[`shard${i}front`].at, 'function');
  assert.ok(FORGE.overseer.parts.shard0front.show, 'a shard shown only on its side');
  assert.ok(FORGE.condenser.parts.vane0back.show && FORGE.prime.parts.stoneN.at, 'vanes and stones kept');
  assert.ok(FORGE.overseer.legs, 'the Overseer still walks on its own legs');
  assert.ok(FORGE.prime.walk && KAV_BOSS_ART.prime.walk, 'the Prime strides');
  // (The Crucible's heat in steps: each a picture of its own, and spent,
  // frosted; its hammers too.)
  const px = (st) => forgePaint('crucible', 0, st).d.join(',');
  const cold = px({});
  const warm = px({ heat: 1 });
  const hot = px({ heat: 2 });
  assert.notEqual(cold, warm);
  assert.notEqual(warm, hot);
  assert.notEqual(px({ vent: 1 }), cold);
  assert.ok(KAV_BOSS_ART.crucible.parts.armN.pixVariants.heat && KAV_BOSS_ART.crucible.parts.armN.pixVariants.vent);
  // (Winding up: the Condenser's lens and the Prime's visor blaze.)
  assert.notEqual(forgePaint('condenser', 0, { wind: 1 }).d.join(','), forgePaint('condenser', 0, {}).d.join(','));
  assert.notEqual(forgePaint('prime', 0, { wind: 1 }).d.join(','), forgePaint('prime', 0, {}).d.join(','));
});
