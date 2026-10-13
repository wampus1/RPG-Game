// Round 101: the Kiln-Deep made over. Its tiles and things drawn afresh;
// its floors laid out by its own architect (the great forge, the casting
// pit, the quench hall, the bellows room, the guild-hall, the king's
// gallery, the coal store, the flue) beside its old rooms, every one
// walkable, up its gantries and ladders; what's written there made from its
// own history and its town's; its new creatures drawn; and its works at
// work: the trip-hammers, the steam, the grates, the casting of the
// kiln-key and the door it opens, the singing anvils and the guild-door,
// the ash-smiths and their work, the bellowsback's gust, the iron warden
// hot and brittle; and its three masters painted by hand.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGame, stubInput } from './helpers.mjs';
import { DungeonRun } from '../src/game/dungeon.js';
import { buildFloor, FY, DTYPES } from '../src/world/dungeongen.js';
import { BLOCKS, B } from '../src/world/blocks.js';
import { SPECIES } from '../src/entities/creature.js';
import { FORGE_SPECIES } from '../src/entities/forgemobs.js';
import { FORGE_MOBS } from '../src/render/art/forge_mobs.js';
import { FORGE_SPRITES, forgeTop, forgeFront } from '../src/render/art/forge_tex.js';
import { forgeLore, NOTES } from '../src/world/deeps/forgelore.js';
import { FORGE_OWN } from '../src/world/deeps/forge.js';
import { addItem, countItem } from '../src/game/inventory.js';
import { fgT, HAMMER, VENT, GRATE } from '../src/game/forgework.js';
import { GAME_VERSION, compareVersions } from '../src/version.js';
import { stepsFor } from '../src/game/migrate.js';
import { FORGE_BOSS_ART } from '../src/render/art/forge_bosses.js';
import { FORGE, forgePaint } from '../src/render/forge.js';
import '../src/render/bossbody.js';

const rec = (s) => ({ id: `f${s}`, type: 'forge', isle: 'kharos', seed: 1000 + s * 31, depth: 3, level: 2, vaultFloor: 1, origin: { who: 'the Kiln-King Azkar', y: 1201 }, townName: 'Cinderford' });
const at = (f, x, y, z) => {
  const r = f.regions.get(Math.floor(x / 64) * 4096 + Math.floor(z / 36));
  return r ? r.get(x % 64, y, z % 36) : 0;
};
const PASS = new Set(['sealed', 'portcullis', 'boss_gate']);
// Every tile you can walk to from the way in: a step up or down at a time,
// or up a ladder.
function reach(f) {
  const P = f.plan;
  const solid = (x, y, z) => {
    const b = BLOCKS[at(f, f.x0 + x, y, z)];
    return !!(b && b.solid && !PASS.has(b.interact));
  };
  const ladder = (x, y, z) => !!(BLOCKS[at(f, f.x0 + x, y, z)] || {}).ladder;
  const stand = (x, z) => {
    if (!P.open[z * P.W + x]) return null;
    for (const y of [FY - 1, FY, FY + 1, FY + 2]) if ((y === FY - 1 ? !solid(x, FY - 1, z) && solid(x, FY - 2, z) : solid(x, y - 1, z) || y === FY) && !solid(x, y, z) && !solid(x, y + 1, z)) return y;
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
  return { seen, stand };
}

test('every floor of a Kiln-Deep can be walked, up its gantries and platforms and down into its pits', () => {
  for (let s = 1; s <= 6; s++) {
    for (let n = 0; n < 3; n++) {
      const f = buildFloor(rec(s), n);
      const { seen, stand } = reach(f);
      const P = f.plan;
      for (const r of f.rooms) {
        if (r.kit === 'hidden' || r.sealed) continue;
        for (let z = r.z0; z <= r.z1; z++) {
          for (let x = r.x0; x <= r.x1; x++) {
            if (P.room[z * P.W + x] !== r.id) continue;
            const h = stand(x, z);
            if (h === null || h === FY + 2) continue;
            assert.ok(seen.has(z * P.W + x), `${s}/${n}: a tile of the ${r.kit} room (${x},${z}) can't be reached`);
          }
        }
      }
      if (f.downAt) assert.ok(seen.has(f.downAt.z * P.W + f.downAt.x - f.x0), `${s}/${n}: the way down`);
    }
  }
});

test('a floor of a Kiln-Deep is laid out as a Kiln-Deep: its own rooms, its casting and its gallery, its anvils, its hammers', () => {
  const kits = new Set();
  let casts = 0;
  let anvils = 0;
  let hammers = 0;
  let vents = 0;
  for (let s = 1; s <= 8; s++) {
    for (let n = 0; n < 3; n++) {
      const f = buildFloor(rec(s), n);
      for (const r of f.rooms) kits.add(r.kit);
      for (const c of f.casts || []) {
        casts++;
        assert.equal(at(f, c.lever.x, c.lever.y, c.lever.z), B.fg_lever, 'the lever');
        assert.equal(at(f, c.crucible.x, c.crucible.y, c.crucible.z), B.fg_crucible, 'the crucible');
        assert.equal(at(f, c.mould.x, FY - 2, c.mould.z), B.fg_mould, 'the mould');
        for (const q of c.channel) assert.equal(at(f, q.x, FY - 1, q.z), B.air, 'the channel, cut');
        // (Its key's door on the same floor.)
        assert.ok((f.kilndoors || []).length, 'a kiln-door for its key');
      }
      for (const d of f.kilndoors || []) assert.equal(at(f, d.x, FY, d.z), B.fg_kilndoor);
      for (const a of f.anvils || []) {
        anvils++;
        assert.equal(a.anvils.length, 3);
        assert.deepEqual([...a.song].sort(), [0, 1, 2]);
        for (const q of a.anvils) assert.equal(at(f, q.x, FY, q.z), B.fg_singanvil);
        assert.equal(at(f, a.door.x, FY, a.door.z), B.fg_guilddoor);
      }
      for (const h of f.hammers || []) {
        hammers++;
        assert.equal(at(f, h.x, FY, h.z), B.fg_hammer);
        assert.ok(!BLOCKS[B.fg_hammer].solid, 'walked under');
      }
      for (const v of f.vents || []) {
        vents++;
        assert.equal(at(f, v.x, FY, v.z), B.fg_vent);
      }
    }
  }
  for (const k of FORGE_OWN) assert.ok(kits.has(k), `some floor has a ${k}`);
  assert.ok(casts > 3 && anvils > 3 && hammers > 6 && vents > 6, `casts ${casts}, anvils ${anvils}, hammers ${hammers}, vents ${vents}`);
  assert.ok(DTYPES.forge.arch, 'its own architect');
});

test('what\'s written in a Kiln-Deep is its own, its town\'s, and the same each time', () => {
  const a = forgeLore(rec(1), 0, 'kiln_king');
  const b = forgeLore(rec(1), 0, 'kiln_king');
  assert.deepEqual(a.song, b.song);
  assert.deepEqual(a.songPlaque(), b.songPlaque());
  assert.ok(a.songPlaque().lines.join(' ').includes(a.song.map((k) => `the anvil of ${NOTES[k]}`).join(', then ')), 'the song names its notes in order');
  assert.ok(a.sealing().lines.join(' ').includes('KILN-KING AZKAR'));
  assert.ok(a.sealing().lines.join(' ').includes('Cinderford'), 'the town hears the hammers');
  assert.ok(a.last().title.includes('Kiln-King'));
  assert.ok(a.arrive().includes('Kiln-King Azkar'));
  for (const k of ['sealing', 'songPlaque', 'tally', 'roll', 'quench', 'letter', 'work', 'masterwork', 'last']) {
    const t = a[k]();
    assert.ok(t.title && t.lines.length >= 2 && t.lines.every((l) => typeof l === 'string' && l.length > 3), k);
  }
  // (Every floor of the same deep sings the same song.)
  assert.deepEqual(forgeLore(rec(1), 2, 'kiln_king').song, a.song);
  // (Which Great Work it was: the plinth it lies on is turned to show it.)
  assert.equal(typeof a.workKey, 'string');
  assert.equal(typeof a.work, 'function');
  const titles = new Set();
  for (let s = 1; s <= 3; s++) for (let n = 0; n < 3; n++) for (const l of buildFloor(rec(s), n).lore) titles.add(l.title);
  for (const t of ['The Sealing', 'The Tally', 'The Guild-Roll', 'The Quench-Law', 'The Great Work']) assert.ok(titles.has(t), `${t}: ${[...titles].join(', ')}`);
});

test('the Kiln-Deep\'s tiles and things are drawn; its new creatures are in the game and drawn', () => {
  for (const k of ['fg_wall', 'fg_plate', 'fg_flags', 'fg_grate', 'fg_coal', 'fg_ash', 'fg_brick', 'fg_gantry', 'fg_mould', 'fg_keymould']) {
    for (let v = 0; v < 4; v++) assert.ok(forgeTop(k, v).d.some((q) => q), `${k} top`);
  }
  for (const k of ['fg_wall', 'fg_flue', 'fg_ironband', 'fg_relief', 'fg_tally', 'fg_roll', 'fg_kilndoor', 'fg_guilddoor', 'fg_gantry', 'fg_plate']) assert.ok(forgeFront(k, 0).d.some((q) => q), `${k} face`);
  for (const [k, f] of Object.entries(FORGE_SPRITES)) {
    for (const st of [0, 1]) assert.ok(f(0, st, 0).d.some((q) => q), `${k} is drawn`);
    assert.ok(BLOCKS[B[k]], `${k} is a block`);
  }
  // (Its singing anvils each drawn with their own note.)
  const notes = new Set([0, 1, 2].map((r) => FORGE_SPRITES.fg_singanvil(r, 0, 0).d.join(',')));
  assert.equal(notes.size, 3);
  for (const sp of Object.keys(FORGE_SPECIES)) {
    assert.ok(SPECIES[sp], `${sp} is a species`);
    assert.ok(FORGE_MOBS[sp] && FORGE_MOBS[sp].rows.length === 24, `${sp} is drawn`);
  }
});

// ------------------------------------------------------- in the deep itself
function inForge() {
  const game = makeGame(12345);
  const input = stubInput();
  game.minute = 600;
  for (let i = 0; i < 20; i++) game.update(0.1, input);
  const base = game.sim.dungeons.all.find((q) => q.type === 'forge');
  const r = { ...base, floors: {}, cleared: false, pack: null, weakened: 0 };
  new DungeonRun(game, r).enter();
  const d = game.dungeon;
  for (const c of game.creatures) {
    c.dead = true;
    game.removeOcc(c);
  }
  game.creatures = [];
  game.cheats = { ...(game.cheats || {}), god: false };
  for (const k of ['casts', 'kilndoors', 'anvils', 'hammers', 'vents', 'grates']) d.data[k] = [];
  // A clear stretch of iron plate, 15 by 8, about the way in.
  const e = d.data.rooms.find((q) => q.kit === 'entry');
  const x0 = d.data.x0 + e.cx - 7;
  const z0 = e.cz - 2;
  for (let z = z0 - 2; z <= z0 + 5; z++) {
    for (let x = x0 - 1; x <= x0 + 15; x++) {
      for (const y of [FY, FY + 1, FY + 2]) game.world.setBlock(x, y, z, B.air);
      game.world.setBlock(x, FY - 1, z, B.fg_plate);
      game.world.setBlock(x, FY - 2, z, B.fg_wall);
    }
  }
  const p = game.player;
  p.teleport(x0, FY, z0 + 2);
  p.hp = p.maxHp = 200;
  d.forgeT = null;
  return { game, input, d, p, x0, z0 };
}
const run = (game, input, secs) => {
  for (let t = 0; t < secs; t += 0.05) game.update(0.05, input);
};

test('the casting pit: pull the lever, the metal runs to the mould, the kiln-key sets there, and opens the kiln-door', () => {
  const { game, input, d, p, x0, z0 } = inForge();
  const w = game.world;
  const lever = { x: x0 + 3, y: FY, z: z0 };
  const crucible = { x: x0 + 4, y: FY, z: z0 };
  w.setBlock(lever.x, FY, lever.z, B.fg_lever);
  w.setBlock(crucible.x, FY, crucible.z, B.fg_crucible);
  const channel = [];
  for (let k = 1; k <= 3; k++) {
    const q = { x: crucible.x, z: z0 + k };
    w.setBlock(q.x, FY - 1, q.z, B.air);
    w.setBlock(q.x, FY - 2, q.z, B.fg_flags);
    channel.push(q);
  }
  const mould = { x: crucible.x, z: z0 + 4 };
  w.setBlock(mould.x, FY - 1, mould.z, B.air);
  w.setBlock(mould.x, FY - 2, mould.z, B.fg_mould);
  const door = { x: x0 + 12, z: z0 - 2 };
  for (const y of [FY, FY + 1]) w.setBlock(door.x, y, door.z, B.fg_kilndoor);
  d.data.casts = [{ lever, crucible, channel, mould, room: 0 }];
  d.data.kilndoors = [{ ...door, room: 0 }];
  p.inv.fill(null);
  p.teleport(x0 + 1, FY, z0 + 2);
  // The door, locked.
  d.interact(door.x, FY, door.z, BLOCKS[B.fg_kilndoor]);
  assert.equal(w.getBlock(door.x, FY, door.z), B.fg_kilndoor);
  // The lever: the metal runs.
  d.interact(lever.x, FY, lever.z, BLOCKS[B.fg_lever]);
  assert.ok(w.getState(crucible.x, FY, crucible.z), 'the crucible tipped');
  run(game, input, 0.8);
  assert.equal(w.getBlock(channel[0].x, FY - 1, channel[0].z), B.lava, 'down the channel');
  run(game, input, 1);
  assert.equal(w.getBlock(mould.x, FY - 1, mould.z), B.fg_castkey, 'into the mould');
  assert.equal(w.getBlock(mould.x, FY - 2, mould.z), B.fg_keymould);
  // Too hot to take, yet.
  d.interact(mould.x, FY - 1, mould.z, BLOCKS[B.fg_castkey]);
  assert.equal(countItem(p.inv, 'kiln_key'), 0, 'too hot');
  run(game, input, 3.5);
  assert.equal(w.getBlock(channel[0].x, FY - 1, channel[0].z), B.air, 'the channel set and cooled');
  assert.ok(w.getState(mould.x, FY - 1, mould.z), 'the key set');
  d.interact(mould.x, FY - 1, mould.z, BLOCKS[B.fg_castkey]);
  assert.equal(countItem(p.inv, 'kiln_key'), 1, 'the kiln-key');
  // And the door it opens.
  d.interact(door.x, FY, door.z, BLOCKS[B.fg_kilndoor]);
  run(game, input, 1.2);
  assert.equal(w.getBlock(door.x, FY, door.z), B.air);
  assert.equal(w.getBlock(door.x, FY + 1, door.z), B.air);
  assert.equal(countItem(p.inv, 'kiln_key'), 0, 'the key used');
  // The lever again: nothing left to pour.
  d.interact(lever.x, FY, lever.z, BLOCKS[B.fg_lever]);
  assert.equal(fgT(d).pours.length, 0);
  d.leave();
});

test('the singing anvils: the forge-song opens the guild-door; a wrong note sets the ash-smiths on you', () => {
  const { game, input, d, p, x0, z0 } = inForge();
  const w = game.world;
  const anv = [0, 1, 2].map((i) => ({ x: x0 + 3 + i * 2, z: z0 + 4, note: [2, 0, 1][i] }));
  for (const a of anv) w.setBlock(a.x, FY, a.z, B.fg_singanvil, a.note);
  const door = { x: x0 + 12, z: z0 - 2 };
  for (const y of [FY, FY + 1]) w.setBlock(door.x, y, door.z, B.fg_guilddoor);
  const song = [1, 2, 0];
  d.data.anvils = [{ anvils: anv, song, door, room: 0 }];
  const smith = d.spawn('ash_smith', x0 + 10, FY, z0 + 3, { peaceful: true });
  p.teleport(x0 + 5, FY, z0 + 3);
  const strike = (note) => {
    const a = anv.find((q) => q.note === note);
    d.interact(a.x, FY, a.z, BLOCKS[B.fg_singanvil]);
  };
  // Wrong: the second note out of turn.
  strike(1);
  strike(0);
  assert.ok(smith.angry && smith.target === p, 'the smiths look up from their work');
  assert.equal(w.getBlock(door.x, FY, door.z), B.fg_guilddoor);
  // Right: the song, in its order.
  game.kill(smith, p);
  for (const n of song) strike(n);
  run(game, input, 1.8);
  assert.equal(w.getBlock(door.x, FY, door.z), B.air, 'the guild-door open');
  assert.ok(d.state.forge.sung[`${door.x},${door.z}`]);
  d.leave();
});

test('a trip-hammer comes down on its beat on whoever stands under it', () => {
  const { game, input, d, p, x0, z0 } = inForge();
  const h = { x: x0 + 6, z: z0 + 2, phase: 0 };
  game.world.setBlock(h.x, FY, h.z, B.fg_hammer);
  d.data.hammers = [h];
  fgT(d).clock = HAMMER.period - 0.3;
  p.teleport(h.x, FY, h.z);
  const hp = p.hp;
  run(game, input, 0.4);
  assert.ok(p.hp < hp, 'hammered');
  assert.ok(game.world.getState(h.x, FY, h.z) || p.hp < hp);
  d.leave();
});

test('a steam vent scalds whoever\'s in it; a red-hot warden in it is quenched brittle', () => {
  const { game, input, d, p, x0, z0 } = inForge();
  const v = { x: x0 + 6, z: z0 + 2, phase: 0 };
  game.world.setBlock(v.x, FY, v.z, B.fg_vent);
  d.data.vents = [v];
  const wd = d.spawn('iron_warden', v.x + 1, FY, v.z, {});
  wd.target = null;
  wd.stunT = 99;
  wd.hotT = 5;
  p.teleport(v.x, FY, v.z + 1);
  fgT(d).clock = VENT.burst - 0.1;
  const hp = p.hp;
  run(game, input, 0.4);
  assert.ok(p.hp < hp, 'scalded');
  // (Its brain runs though it's stunned? It's quenched by the tick of its own brain: let it.)
  wd.stunT = 0;
  for (let t = 0; t < 1 && !(wd.brittleT > 0); t += 0.05) {
    fgT(d).clock = VENT.burst + 0.1;
    game.update(0.05, input);
  }
  assert.ok(wd.brittleT > 0, 'quenched, brittle');
  d.leave();
});

test('an iron warden: cold, blows a third as hard; burning, red-hot, they land; brittle, double', () => {
  const { game, input, d, p, x0, z0 } = inForge();
  const wd = d.spawn('iron_warden', x0 + 8, FY, z0 + 2, {});
  p.teleport(x0 + 1, FY, z0 + 2);
  const hit = (n) => {
    const hp = wd.hp;
    game.damage(wd, n, p);
    const lost = hp - wd.hp;
    wd.hp = wd.maxHp;
    return lost;
  };
  assert.equal(hit(9), 3, 'cold iron');
  wd.burnT = 2;
  run(game, input, 0.15);
  assert.ok(wd.hotT > 0, 'red-hot');
  assert.equal(hit(9), 9, 'hot');
  wd.hotT = 0;
  wd.burnT = 0;
  wd.brittleT = 5;
  assert.equal(hit(9), 18, 'brittle');
  d.leave();
});

test('a bellowsback\'s gust throws you back down the line, and stokes a cinderling in it', () => {
  const { game, input, d, p, x0, z0 } = inForge();
  const bb = d.spawn('bellowsback', x0 + 2, FY, z0 + 2, {});
  const cin = d.spawn('cinderling', x0 + 4, FY, z0 + 2, {});
  cin.stunT = 99;
  p.teleport(x0 + 6, FY, z0 + 2);
  bb.target = p;
  bb.gustCd = 0;
  let thrown = false;
  for (let t = 0; t < 3 && !thrown; t += 0.05) {
    game.update(0.05, input);
    bb.target = p;
    thrown = p.x > x0 + 6;
  }
  assert.ok(thrown, `blown back (${p.x - x0})`);
  assert.ok(cin.stokedT > 0 && cin.dmgMult > 1, 'stoked');
  d.leave();
});

test('an ash-smith at its anvil mends the iron near it; struck, its fellows turn too; fallen, it chokes you in ash', () => {
  const { game, input, d, p, x0, z0 } = inForge();
  const anvil = { x: x0 + 6, z: z0 + 1 };
  game.world.setBlock(anvil.x, FY, anvil.z, B.fg_anvil);
  const sm = d.spawn('ash_smith', anvil.x, FY, anvil.z + 1, { peaceful: true, anvil });
  const sm2 = d.spawn('ash_smith', anvil.x + 3, FY, anvil.z + 2, { peaceful: true });
  const wd = d.spawn('iron_warden', anvil.x + 2, FY, anvil.z + 2, {});
  wd.target = null;
  wd.stunT = 99;
  wd.hp = 10;
  p.teleport(x0, FY, z0 + 4);
  run(game, input, 3);
  assert.ok(wd.hp > 10, 'mended at the anvil');
  assert.ok(!sm.angry && !sm.target, 'paying you no mind');
  game.damage(sm, 1, p);
  assert.ok(sm.angry && sm2.angry && sm2.target === p, 'they turn on you, all of them');
  p.teleport(sm.x + 1, FY, sm.z);
  game.kill(sm, p);
  run(game, input, 0.2);
  assert.ok(fgT(d).clouds.length > 0, 'its ash');
  assert.ok(p.slowT > 0, 'choking');
  d.leave();
});

test('break the smiths\' racks, and they turn on you', () => {
  const { game, d, p, x0, z0 } = inForge();
  game.world.setBlock(x0 + 4, FY, z0 + 1, B.fg_rack);
  const sm = d.spawn('ash_smith', x0 + 7, FY, z0 + 2, { peaceful: true });
  p.teleport(x0 + 3, FY, z0 + 2);
  game.breakBlock(x0 + 4, FY, z0 + 1);
  assert.ok(sm.angry, 'their work');
  d.leave();
});

test('the grates flare as the bellows breathe, and burn whoever stands on them', () => {
  const { game, input, d, p, x0, z0 } = inForge();
  const g = { x: x0 + 5, z: z0 + 2 };
  game.world.setBlock(g.x, FY - 1, g.z, B.fg_grate);
  d.data.grates = [{ tiles: [g], room: 0, phase: 0 }];
  fgT(d).clock = GRATE.flare - 0.1;
  p.teleport(g.x, FY, g.z);
  const hp = p.hp;
  run(game, input, 0.4);
  assert.ok(p.hp < hp && p.burnT > 0, 'burned');
  d.leave();
});

test('the version and its step', () => {
  assert.ok(compareVersions(GAME_VERSION, '1.1.0') >= 0);
  assert.ok(stepsFor('1.0.0').some((s) => s.to === '1.1.0'));
});

test('the kiln-key is an item, and drawn', () => {
  const p = makeGame(1).player;
  p.inv.fill(null);
  assert.equal(addItem(p.inv, 'kiln_key', 1), 0);
  assert.equal(countItem(p.inv, 'kiln_key'), 1);
});

test('the Kiln-Deep\'s masters are painted by hand, every part in place', () => {
  assert.deepEqual(Object.keys(FORGE_BOSS_ART).sort(), ['kiln_king', 'molten_heart', 'slag_titan']);
  for (const [k, A] of Object.entries(FORGE_BOSS_ART)) {
    assert.ok(SPECIES[k], `${k} is a species`);
    assert.ok(FORGE[k] && FORGE[k].pix, `${k} is painted`);
    assert.equal(A.size, 64);
    assert.equal(A.body.rows.length, 64, `${k} has a body`);
    for (const [n, q] of Object.entries(A.parts)) assert.ok(q.pix && q.pix.rows.length, `${k}.${n} has a picture`);
  }
  // (The king with his hammer in hand; the titan's arms; both stride.)
  assert.ok(FORGE.kiln_king.parts.blade && FORGE.kiln_king.walk);
  assert.ok(FORGE.slag_titan.parts.armN && FORGE.slag_titan.parts.armF && FORGE.slag_titan.walk);
  // (The titan's lodestone wakes as it draws.)
  const st = {};
  SPECIES.slag_titan.artSt({ charge: { t: 1 } }, st);
  assert.equal(st.lode, 1);
  assert.notEqual(forgePaint('slag_titan', 0, { lode: 1 }).d.join(','), forgePaint('slag_titan', 0, {}).d.join(','));
  // (The heart beats: its frames swell and flare and rest.)
  const seen = new Set();
  for (let f = 0; f < 24; f += 3) seen.add(forgePaint('molten_heart', f, {}).d.join(','));
  assert.ok(seen.size >= 3, 'it beats');
});
