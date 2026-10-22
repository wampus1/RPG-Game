// Round 116: seen, and fair. Things in the old places that were drawn see-
// through to nothing (a lantern jelly, a shrimpkin) drawn as they should
// be; a jelly's sting and a moray's lunge seen coming; a moray given its
// hole again, so it strikes; urchin beds seen at every tide, a gale's line
// and a bolt's plate seen before they hurt you, the words that explained
// them gone; a crossbow that doesn't look like a pick. The coach: run by
// some realms and not others; pulled up at the far town beside its own
// coach (never into it), at the way in on the side it came from; got down
// from with Space, the fare back in the first moments; and driven home
// again, seen the whole way. And the version's step.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { makeGame, stubInput } from './helpers.mjs';
import { alphaOf, grid } from '../src/render/pixart.js';
import { LANTERN_JELLY, SHRIMPKIN } from '../src/render/art/grotto_mobs.js';
import { DungeonRun } from '../src/game/dungeon.js';
import { FY } from '../src/world/dungeongen.js';
import { GroundFx } from '../src/render/groundfx.js';
import { vaultTop } from '../src/render/art/vault_tex.js';
import { smithIcon } from '../src/render/iconsmith.js';
import { hasCoaches, coachLinks, coachStand, coachBay, coachmanAt, townGates } from '../src/sim/coaches.js';
import { REFUND_SECS } from '../src/game/rides.js';
import { countItem } from '../src/game/inventory.js';
import { GAME_VERSION, compareVersions } from '../src/version.js';
import { stepsFor } from '../src/game/migrate.js';

const src = (f) => fs.readFileSync(new URL(`../src/${f}`, import.meta.url), 'utf8');

test('a colour see-through by a part (0.45) is as see-through as it says, not all but gone', () => {
  assert.equal(alphaOf(undefined), 255);
  assert.equal(alphaOf(0.5), 128);
  assert.equal(alphaOf(0.9), 230);
  assert.equal(alphaOf(200), 200);
  // The jelly and the shrimpkin: there to be seen.
  for (const def of [LANTERN_JELLY, SHRIMPKIN]) {
    const p = grid(def);
    let seen = 0;
    for (let i = 3; i < p.d.length; i += 4) if (p.d[i] >= 100) seen++;
    assert.ok(seen > 40, `${seen} pixels to be seen`);
  }
});

// Into a tide grotto, everything else there asleep.
function grotto(seed = 12345) {
  const game = makeGame(seed);
  const input = stubInput();
  const base = game.sim.dungeons.all.find((d) => d.type === 'grotto');
  const run = new DungeonRun(game, { ...base, floors: {}, cleared: false, packs: [], depth: 3 });
  run.enter();
  for (let i = 0; i < 5; i++) game.update(1 / 30, input);
  return { game, input, run };
}

test('a moray has its hole again, and lunges at whoever comes before it, the ground it strikes shown first', () => {
  const { game, input } = grotto();
  const m = game.creatures.find((c) => c.species === 'moray' && !c.dead);
  assert.ok(m, 'a moray');
  assert.ok(m.hole && m.holeOut, 'in its hole, facing out of it');
  for (const c of game.creatures) if (c !== m) c.dormant = 999;
  const p = game.player;
  // Off to one side of its line, two out.
  const o = m.holeOut;
  const side = { x: o.z, z: o.x };
  let spot = null;
  for (const w of [-1, 1]) {
    const x = m.x + o.x * 2 + side.x * w;
    const z = m.z + o.z * 2 + side.z * w;
    if (game.world.findStandY(x, z, FY) === FY && !game.world.isWaterAt(x, FY + 1, z)) spot = { x, z };
  }
  assert.ok(spot, 'somewhere to stand before it');
  game.teleportPlayer(spot.x, FY, spot.z);
  const hp = p.hp;
  let told = false;
  let struck = false;
  for (let i = 0; i < 30 * 4 && !struck; i++) {
    game.update(1 / 30, input);
    if (m.lungeT > 0 && (game.zones || []).some((z) => z.by === m && z.tiles.some((t) => t.x === spot.x && t.z === spot.z))) told = true;
    if (p.hp < hp) struck = true;
  }
  assert.ok(told, 'where it\'ll strike shown before it does');
  assert.ok(struck, 'and it strikes');
});

test('a lantern jelly gathers its light before it stings: step away, and it stings nothing', () => {
  const { game, input } = grotto();
  const j = game.creatures.find((c) => c.species === 'lantern_jelly' && !c.dead);
  assert.ok(j, 'a jelly');
  for (const c of game.creatures) if (c !== j) c.dormant = 999;
  const p = game.player;
  const s = game.findFreeSpot(j.x + 3, j.z, j.y);
  game.teleportPlayer(s.x, s.y, s.z);
  const t = game.findFreeSpot(s.x + 1, s.z, s.y);
  game.moveEntity?.(j, t.x, t.y, t.z);
  j.teleport(t.x, t.y, t.z);
  j.stingCd = 0;
  let tell = false;
  for (let i = 0; i < 30 && !tell; i++) {
    game.update(1 / 30, input);
    tell = j.tellT > 0;
  }
  assert.ok(tell, 'it gathers its light');
  assert.ok((game.zones || []).some((z) => z.by === j), 'the ground about it lit');
  const hp = p.hp;
  const away = game.findFreeSpot(j.x - 4, j.z, j.y);
  game.teleportPlayer(away.x, away.y, away.z);
  for (let i = 0; i < 30; i++) game.update(1 / 30, input);
  assert.equal(p.hp, hp, 'stepped away: not stung');
});

test('urchin beds drawn at every tide, their spines up through the water; no words to explain them', () => {
  let rects = 0;
  const ctx = { fillStyle: '', fillRect: () => rects++ };
  const fx = new GroundFx({ toView: (a, b) => [a, b], fxCap: null });
  fx.drawUrchins(ctx, 10, 20, 0, 0, 0, false);
  const dry = rects;
  rects = 0;
  fx.drawUrchins(ctx, 10, 20, 0, 0, 0, true);
  assert.ok(dry > 20 && rects > 10, `drawn dry (${dry}) and under the tide (${rects})`);
  // Over the water above a bed, and on a bed laid in the ground's picture.
  assert.ok(/world\.getBlock\(wx, y - 1, wz\) === B\.gt_urchins\) this\.drawUrchins/.test(src('render/groundfx.js')));
  assert.ok(/barIds\(\)\.has\(id\) \|\| id === B\.gt_urchins\b/.test(src('render/renderer.js')));
  assert.ok(!/Mind the black urchin beds/.test(src('game/grottowork.js')), 'no band-aid');
});

test('a gale\'s line and a bolt\'s plate are seen before they hurt you', () => {
  assert.ok(/addZone\(game, \{ by: s, kind: 'mark', tiles: s\.tiles, y: FY, life: GUST_WARN/.test(src('game/brochwork.js')), 'the gale\'s line on the floor while it whistles');
  const a = vaultTop('tv_brick', 0);
  const b = vaultTop('tv_plate', 0);
  let diff = 0;
  for (let i = 0; i < a.d.length; i += 4) if (Math.abs(a.d[i] - b.d[i]) + Math.abs(a.d[i + 1] - b.d[i + 1]) + Math.abs(a.d[i + 2] - b.d[i + 2]) > 40) diff++;
  assert.ok(diff > 80, `the plate plain to see (${diff} of 256 pixels unlike the bricks)`);
  for (const f of ['game/brochwork.js', 'game/vaultwork.js', 'game/warrenwork.js', 'game/gutwork.js']) assert.ok(!/\((Listen for the whistle|Watch for bricks|Mind the cracked places|Every third beat)/.test(src(f)), f);
});

test('a crossbow lies across its square: not corner to corner like a pick', () => {
  const xb = smithIcon('crossbow', {});
  const pk = smithIcon('iron_pickaxe', {});
  const row = (p, y) => {
    let n = 0;
    for (let x = 0; x < 16; x++) if (p.d[(y * 16 + x) * 4 + 3]) n++;
    return n;
  };
  assert.ok(row(xb, 8) >= 12, 'its stock and bolt along the middle');
  let diff = 0;
  for (let i = 3; i < xb.d.length; i += 4) if (!!xb.d[i] !== !!pk.d[i]) diff++;
  assert.ok(diff > 40, `its shape its own (${diff})`);
});

test('some realms run coaches and some don\'t; none to or from a town of one that doesn\'t', () => {
  const game = makeGame(12345);
  const ss = game.world.ow.settlements.filter((s) => !s.deserted && s.civ);
  const yes = ss.filter(hasCoaches);
  assert.ok(yes.length && yes.length < ss.length, `${yes.length} of ${ss.length}`);
  const civs = new Map();
  for (const s of ss) civs.set(s.civ.id, hasCoaches(s));
  assert.ok([...civs.values()].includes(false) && [...civs.values()].includes(true), 'by the realm');
  const no = ss.find((s) => !hasCoaches(s));
  assert.equal(coachLinks(game, no).length, 0);
  for (const s of yes.slice(0, 4)) for (const l of coachLinks(game, s)) assert.ok(hasCoaches(l.s), 'only to towns with one');
});

// At the stand in the starting town, by day, with money.
function atStand() {
  const game = makeGame(12345);
  const input = stubInput();
  game.minute = 720;
  for (let i = 0; i < 20; i++) game.update(0.1, input);
  const p = game.player;
  const here = game.world.ow.settlementAt(p.x, p.z);
  p.give('coin', 500);
  return { game, input, p, here };
}

test('Space, in the coach\'s first moments: down, the fare back, and it turns about for its stand', () => {
  const { game, input, p, here } = atStand();
  const c0 = countItem(p.inv, 'coin');
  assert.ok(game.journey(coachLinks(game, here)[0]));
  assert.ok(countItem(p.inv, 'coin') < c0, 'paid');
  for (let i = 0; i < 30; i++) game.update(0.1, input);
  assert.ok(p._ride.realT < REFUND_SECS);
  game.handleKeys([{ code: 'Space', raw: 'Space' }], 0);
  assert.ok(!p._ride, 'down');
  assert.equal(countItem(p.inv, 'coin'), c0, 'the fare back');
  assert.equal(game.coachRuns.length, 1, 'the coach turning about');
  assert.equal(coachmanAt(game, here.id), 'away');
  for (let i = 0; i < 900 && game.coachRuns.length; i++) game.update(0.1, input);
  assert.equal(game.coachRuns.length, 0, 'back');
  game.update(0.1, input);
  assert.equal(coachmanAt(game, here.id), 'here');
  assert.ok(game.props.has(`coach:${here.id}`), 'at its stand again');
});

test('later on, no fare back', () => {
  const { game, input, p, here } = atStand();
  assert.ok(game.journey(coachLinks(game, here)[0]));
  const c1 = countItem(p.inv, 'coin');
  for (let i = 0; i < 30; i++) game.update(0.1, input);
  p._ride.realT = REFUND_SECS + 1;
  game.handleKeys([{ code: 'KeyF', raw: 'KeyF' }], 0);
  assert.ok(!p._ride, 'down');
  assert.equal(countItem(p.inv, 'coin'), c1);
  assert.equal(game.coachRuns.length, 1, 'it goes on without you');
});

test('a coach in from another town pulls up beside the one standing there, then drives home, seen the whole way', () => {
  const { game, input, p, here } = atStand();
  const link = coachLinks(game, here)[0];
  assert.ok(game.journey(link));
  game.handleKeys([{ code: 'KeyT', raw: 'KeyT' }], 0);
  for (let i = 0; i < 8000 && p._ride; i++) game.update(0.05, input);
  assert.ok(!p._ride, 'there');
  const LB = game.world.layouts.get(link.s.id);
  const st = coachStand(LB);
  const bay = coachBay(LB, here);
  assert.ok(Math.max(Math.abs(bay.x - st.x), Math.abs(bay.z - st.z)) >= 2, 'its own spot, a pace off the standing one');
  assert.ok(townGates(LB).length >= 2, 'ways in on more than one side');
  const run = game.coachRuns[0];
  assert.ok(run && game.props.has(run.key), 'the coach still there, not gone');
  assert.ok(Math.abs(run.prop.x - bay.x) + Math.abs(run.prop.z - bay.z) <= 1.5, 'pulled up where it should');
  // And off home.
  game.waiting = null;
  game.sleepFast = 0;
  const x0 = run.prop.x;
  const z0 = run.prop.z;
  for (let i = 0; i < 400; i++) game.update(0.1, input);
  assert.ok(Math.abs(run.prop.x - x0) + Math.abs(run.prop.z - z0) > 4, 'on its way home');
  const last = run.way[run.way.length - 1];
  const home = coachStand(game.world.layouts.get(here.id));
  assert.ok(Math.abs(last.x - home.x) + Math.abs(last.z - home.z) <= 1, 'to its own stand');
});

test('version 1.16.0, and the step to it', () => {
  assert.ok(compareVersions(GAME_VERSION, '1.16.0') >= 0);
  const steps = stepsFor('1.15.0').filter((s) => s.to === '1.16.0');
  assert.equal(steps.length, 1);
  const log = [];
  steps[0].data({}, log);
  assert.ok(/coach/i.test(log[0]) && /urchin/i.test(log[0]));
});
