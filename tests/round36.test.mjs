import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGame } from './helpers.mjs';
import { B, BLOCKS, META_STATE } from '../src/world/blocks.js';
import { GROUND, SURFACE } from '../src/config.js';
import { buildFloor, FY } from '../src/world/dungeongen.js';
import { ISLE_DTYPES } from '../src/world/isledeep.js';
import { RNG } from '../src/util/rng.js';
import { treeOf } from '../src/sim/tech.js';
import { ignite } from '../src/game/fire.js';
import { CRAFTS, CRAFTED, CRAFT_LOOKS } from '../src/render/textures.js';
import { Renderer } from '../src/render/renderer.js';
import { PIECE_NAMES, paintPiece, pieceHeight, PIECE_W } from '../src/render/pieces.js';
import { Rope, Train, Part, bodyOf, warp, onScreen } from '../src/render/bossrig.js';
import { Sculpt, MATERIALS } from '../src/render/sculpt.js';
import { paintBeast, beastOf } from '../src/render/bossbeasts.js';
import { paintFigure } from '../src/render/bossfigs.js';
import { FRAMES, hasBossArt } from '../src/render/bossbody.js';
import { rigBody, BODY_FRAMES, LEGGED, LEG_STYLES } from '../src/render/bossart.js';
import { SPECIES } from '../src/entities/creature.js';
import { Px } from '../src/render/pixel.js';

// One world for the looking-only tests (making one takes a while).
let shared = null;
const world = () => (shared ||= makeGame(12345));
const settle = (game, style, notVillage = true) => game.world.ow.settlements.find((s) => s.style === style && (!notVillage || s.type !== 'village') && s.condition !== 'abandoned');
const lum = (h) => {
  const n = parseInt(h.slice(1), 16);
  return ((n >> 16) & 255) * 0.3 + ((n >> 8) & 255) * 0.59 + (n & 255) * 0.11;
};
const filled = (p) => {
  let n = 0;
  for (let i = 3; i < p.d.length; i += 4) if (p.d[i]) n++;
  return n;
};
const diff = (p, q) => {
  let n = 0;
  for (let i = 0; i < Math.min(p.d.length, q.d.length); i++) if (p.d[i] !== q.d[i]) n++;
  return n;
};
// Every block of a town (in its bounds, between two heights) by kind.
function tally(game, s, y0, y1) {
  const b = s.bounds;
  const n = new Map();
  for (let z = b.z0; z <= b.z1; z++) for (let x = b.x0; x <= b.x1; x++) for (let y = y0; y <= y1; y++) {
    const id = game.world.getBlock(x, y, z);
    n.set(id, (n.get(id) || 0) + 1);
  }
  return (...ids) => ids.reduce((a, id) => a + (n.get(id) || 0), 0);
}
// A town as it'll look once its people have learned all they can (each
// step of its island's tree long settled in).
function learnAll(game, s) {
  const T = game.sim.tech;
  const st = T.stateOf(s);
  for (const k of T.treeFor(st).ids) if (!st.done.includes(k)) st.done.push(k);
  st.log = [];
  const L = game.world.getLayout(s);
  game.loadAround(L.plaza.cx, L.plaza.cz, true);
  // (What's built goes up while you're there to see it.)
  if (!game.active.has(s.id)) game.activate(s, true);
  T.integrate(L, game.day + 300);
  game.day += 300;
  return L;
}

// ------------------------------------------------------------ Kharos's towns
test('the Ashborn build in pale ash plaster and red kiln brick, roofed in terracotta and copper: never the black rock they stand on', () => {
  const game = world();
  const s = settle(game, 'ember');
  const L = game.world.getLayout(s);
  game.loadAround(L.plaza.cx, L.plaza.cz, true);
  const n = tally(game, s, GROUND, GROUND + 3);
  const own = n(B.ash_plaster, B.kiln_brick);
  assert.ok(own > 60, `${s.name}: walls of plaster and brick (${own})`);
  assert.ok(own > n(B.basalt, B.obsidian, B.cobblestone) * 4, `${s.name}: hardly any walls of the black rock`);
  const roofs = tally(game, s, GROUND + 2, GROUND + 10)(B.kiln_tile, B.copper_roof);
  assert.ok(roofs > 20, `${s.name}: terracotta and copper roofs (${roofs})`);
  // (And what they build in stands out from what's under it.)
  assert.ok(BLOCKS[B.ash_plaster] && BLOCKS[B.kiln_tile] && BLOCKS[B.kiln_brick] && BLOCKS[B.copper_roof]);
});

test('each people\'s furniture is made in its own wood: cinderwood and bronze, bogwood and dark iron, driftwood and rope', () => {
  assert.deepEqual(CRAFTS, { ember: 1, mist: 2, tide: 3 });
  for (const k of ['door', 'chest', 'barrel', 'table', 'chair', 'bench', 'sign', 'hanging_sign', 'bed', 'bookshelf', 'counter']) assert.ok(CRAFTED.has(k), `${k} is made in the craft`);
  const woods = [1, 2, 3].map((k) => CRAFT_LOOKS[k].planks[0]);
  assert.equal(new Set(woods).size, 3, 'three woods');
  const [ember, mist, tide] = [1, 2, 3].map((k) => CRAFT_LOOKS[k]);
  // The Ashborn's: a dark red-black wood (it sits with red brick and pale
  // plaster), studded, with bronze rather than grey iron.
  const red = parseInt(ember.planks[0].slice(1, 3), 16);
  const blue = parseInt(ember.planks[0].slice(5, 7), 16);
  assert.ok(red > blue + 30 && lum(ember.planks[0]) < 90, `cinderwood is dark and red (${ember.planks[0]})`);
  assert.ok(ember.fit.studs && parseInt(ember.fit.iron.slice(1, 3), 16) > parseInt(ember.fit.iron.slice(5, 7), 16) + 40, 'bronze fittings, studded');
  assert.ok(lum(tide.planks[0]) > 150, 'driftwood is bleached pale');
  assert.ok(lum(mist.planks[0]) < lum(tide.planks[0]), 'bogwood is grey-dark');
  // Where it stands decides it: an Ashborn town's furniture is theirs; a
  // Thessan town's oak.
  const game = world();
  const fake = {};
  const e = settle(game, 'ember');
  const v = settle(game, 'vale');
  assert.equal(Renderer.prototype.craftAt.call(fake, game, e.bounds.x0 + 4, e.bounds.z0 + 4), 1);
  assert.equal(Renderer.prototype.craftAt.call(fake, game, v.bounds.x0 + 4, v.bounds.z0 + 4), 0);
});

// ------------------------------------------------------------ squares
test('each people\'s square has its own great thing at its heart, not a well', () => {
  const game = world();
  const want = { ember: B.heartfire, mist: B.great_glowcap, tide: B.conch_fountain };
  for (const [style, id] of Object.entries(want)) {
    const s = settle(game, style);
    const L = game.world.getLayout(s);
    const P = L.plaza;
    game.loadAround(P.cx, P.cz, true);
    assert.equal(game.world.getBlock(P.cx, GROUND, P.cz), id, `${s.name}: its ${BLOCKS[id].name}`);
    // (On a plinth of nine paces.)
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1]]) assert.equal(game.world.getBlock(P.cx + dx, GROUND, P.cz + dz), B.plinth);
    // (Water still to be had: a well at the corner, or from the conch.)
    assert.ok(L.wells.length > 0, `${s.name} has water`);
    if (style === 'ember') assert.ok(game.world.getMeta(P.cx, GROUND, P.cz) & META_STATE, 'the heartfire burns');
  }
  // Thessa keeps its wells and statues.
  const v = settle(game, 'vale');
  const Lv = game.world.getLayout(v);
  game.loadAround(Lv.plaza.cx, Lv.plaza.cz, true);
  assert.ok([B.well, B.statue, B.fountain].includes(game.world.getBlock(Lv.plaza.cx, GROUND, Lv.plaza.cz)));
});

test('the great things are drawn bigger than a pace, and move', () => {
  assert.ok(PIECE_NAMES.length >= 5);
  for (const name of PIECE_NAMES) {
    const a = paintPiece(name, 0);
    const b = paintPiece(name, 5);
    // (Round and round without a jump.)
    const fr = Array.from({ length: 12 }, (_, f) => paintPiece(name, f));
    const steps = fr.slice(0, 11).map((p, i) => diff(p, fr[i + 1]));
    assert.ok(diff(fr[11], fr[0]) <= Math.max(...steps) * 1.15 + 20, `${name} loops smoothly`);
    assert.equal(a.w, PIECE_W);
    assert.ok(pieceHeight(name) > 48, `${name} stands tall`);
    assert.ok(filled(a) > 600, `${name} is something`);
    assert.ok(diff(a, b) > 40, `${name} moves (fire, water, glow)`);
  }
  // (Lit, it's not the same as unlit.)
  assert.ok(diff(paintPiece('heartfire', 0, 1), paintPiece('heartfire', 0, 0)) > 100);
  assert.ok(diff(paintPiece('great_glowcap', 0, 1), paintPiece('great_glowcap', 0, 0)) > 100);
});

// ------------------------------------------------------------ learning shows
test('what Kharos learns shows in its towns: a mosaic square, amber lamps, ember grates, the heart-crystal', () => {
  const game = world();
  const s = settle(game, 'ember');
  const L = learnAll(game, s);
  const P = L.plaza;
  assert.equal(game.world.getBlock(P.cx, GROUND, P.cz), B.heart_crystal, 'the heartfire set in its crystal');
  const n = tally(game, s, SURFACE, GROUND + 1);
  assert.ok(n(B.glass_lamp) >= 3, `amber glass lamps (${n(B.glass_lamp)})`);
  assert.ok(n(B.ember_gutter) >= 3, `ember grates in the streets (${n(B.ember_gutter)})`);
  assert.ok(n(B.kiln_tile) > 8, 'the square laid in a mosaic of kiln tile');
});

test('what Myrrow learns shows in its towns: fog lanterns, nacre squares, the glowcap and the conch kindled', () => {
  const game = world();
  for (const style of ['mist', 'tide']) {
    const s = settle(game, style);
    const L = learnAll(game, s);
    const P = L.plaza;
    assert.ok(game.world.getMeta(P.cx, GROUND, P.cz) & META_STATE, `${s.name}: its great thing kindled`);
    const n = tally(game, s, SURFACE, GROUND + 1);
    if (style === 'mist') assert.ok(n(B.fog_lantern) >= 3, `${s.name}: fog lanterns (${n(B.fog_lantern)})`);
    if (style === 'tide') assert.ok(n(B.nacre_tile) > 8, `${s.name}: a square of nacre (${n(B.nacre_tile)})`);
  }
  // (Each island's tree holds the steps that show.)
  assert.ok(treeOf('kharos').techs.ember_ward && treeOf('kharos').techs.glassblowing && treeOf('kharos').techs.magma_forges);
  assert.ok(treeOf('myrrow').techs.mist_heart && treeOf('myrrow').techs.fog_wardens && treeOf('myrrow').techs.pearl_diving);
});

test('the ember ward: the mountain\'s fire and a raider\'s torch break on it', () => {
  const game = world();
  const s = settle(game, 'ember');
  const L = learnAll(game, s);
  const w = game.wardOf(s);
  assert.ok(w && w.r >= 8, 'a ward over the town');
  assert.ok(game.wardAt(w.cx, w.cz), 'over its square');
  assert.ok(game.wards().some((q) => q.s === s), 'and to be seen');
  assert.equal(game.wardAt(w.cx + Math.ceil(w.r) + 30, w.cz), null, 'not out past it');
  assert.equal(ignite(game, w.cx + 2, GROUND + 1, w.cz + 2, 'volcano'), false, 'the mountain\'s fire won\'t take');
  assert.equal(ignite(game, w.cx + 2, GROUND + 1, w.cz + 2, 'bandits'), false, 'nor a raider\'s torch');
  const hit = game.sim.volcano.strike(L, game.day, new RNG(7));
  assert.ok(hit && hit.warded && hit.dead === 0 && hit.burnt === 0, 'an eruption hurts nobody under it');
});

// ------------------------------------------------------------ stairs
// A floor's blocks, by tile.
function blockAt(f, x, y, z) {
  const r = f.regions.get((Math.floor(x / 64) + 2000) * 4096 + Math.floor(z / 36));
  return r ? r.get(x % 64, y, z % 36) : 0;
}
test('stairs stand out of the way: never on a passage or across a room, with room to step onto them', () => {
  const types = ['barrow', 'mine', 'crypt', 'holdout', ...Object.keys(ISLE_DTYPES)];
  let floors = 0;
  for (const type of types) {
    for (let s = 1; s <= 6; s++) {
      for (let n = 0; n < 3; n++) {
        const f = buildFloor({ type, seed: s * 7919, depth: 3, level: 1, vaultFloor: 1, isle: ISLE_DTYPES[type] ? ISLE_DTYPES[type].isle : undefined }, n);
        const P = f.plan;
        const at = `${type} ${s} floor ${n}`;
        const lx = (q) => q.x - f.x0;
        floors++;
        assert.equal(blockAt(f, lx(f.up), FY, f.up.z), B.stairs_up, `${at}: stairs up`);
        assert.ok(!P.corr[f.up.z * P.W + lx(f.up)], `${at}: not in a passage`);
        // Room in front of them.
        for (const y of [FY, FY + 1]) assert.ok(!BLOCKS[blockAt(f, lx(f.upAt), y, f.upAt.z)].solid, `${at}: a clear pace in front of the stairs up`);
        if (f.down) for (const y of [FY, FY + 1]) assert.ok(!BLOCKS[blockAt(f, lx(f.downAt), y, f.downAt.z)].solid, `${at}: and the stairs down`);
        // With the stairs walked round (not through), every room's still
        // reached from where you come in.
        const stairs = new Set([f.up, f.down].filter(Boolean).map((q) => q.z * P.W + (q.x - f.x0)));
        const pass = (x, z) => {
          if (!P.open[z * P.W + x] || stairs.has(z * P.W + x)) return false;
          const bl = BLOCKS[blockAt(f, x, FY, z)];
          return !bl.solid || ['sealed', 'portcullis', 'boss_gate'].includes(bl.interact) || bl.name === 'weak_wall';
        };
        const seen = new Uint8Array(P.W * P.D);
        const st = [[f.upAt.x - f.x0, f.upAt.z]];
        seen[st[0][1] * P.W + st[0][0]] = 1;
        while (st.length) {
          const [x, z] = st.pop();
          for (const [a, c] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nx = x + a;
            const nz = z + c;
            const i = nz * P.W + nx;
            if (nx < 0 || nz < 0 || nx >= P.W || nz >= P.D || seen[i] || !pass(nx, nz)) continue;
            seen[i] = 1;
            st.push([nx, nz]);
          }
        }
        const lost = f.rooms.filter((r) => {
          if (r.kit === 'hidden') return false;
          for (let z = r.z0; z <= r.z1; z++) for (let x = r.x0; x <= r.x1; x++) if (P.room[z * P.W + x] === r.id && seen[z * P.W + x]) return false;
          return true;
        });
        assert.deepEqual(lost.map((r) => r.kit), [], `${at}: rooms cut off by the stairs`);
        if (f.down) assert.ok(seen[f.downAt.z * P.W + (f.downAt.x - f.x0)], `${at}: the way down's reached`);
      }
    }
  }
  assert.ok(floors > 100);
});

// ------------------------------------------------------------ the masters
test('every master is sculpted and surfaced as what it is, in twenty-four frames of breath', () => {
  assert.equal(FRAMES, 24);
  assert.equal(BODY_FRAMES, 24);
  for (const m of ['skin', 'cloth', 'leather', 'mail', 'metal', 'scales', 'chitin', 'fur', 'feather', 'bark', 'bone', 'glass', 'molten', 'obsidian', 'coral', 'fungus']) assert.ok(MATERIALS.includes(m), `${m} is a material`);
  const masters = Object.keys(SPECIES).filter((k) => SPECIES[k].boss);
  for (const sp of masters) assert.ok(hasBossArt(sp) || LEGGED.has(sp), `${sp} is painted`);
  // (Its breath comes round without a jump: from the last frame to the
  // first is no bigger a step than any other. Lava, slime, sparks and
  // drips included.)
  for (const sp of ['molten_heart', 'magma_tender', 'slag_titan', 'lamprey_queen', 'urn_mother', 'coral_colossus', 'cinder_king', 'hollow_saint', 'kiln_priest', 'drowned_choir']) {
    const draw = (f) => (beastOf(sp) ? paintBeast(sp, f / 24, {}) : paintFigure(sp, f / 24, {}));
    const fr = Array.from({ length: 24 }, (_, f) => draw(f));
    const steps = fr.slice(0, 23).map((p, i) => diff(p, fr[i + 1]));
    const seam = diff(fr[23], fr[0]);
    assert.ok(Math.max(...steps) > 0, `${sp} moves`);
    assert.ok(seam <= Math.max(...steps) * 1.15 + 20, `${sp}: comes round smoothly (${seam} vs ${Math.max(...steps)})`);
  }
  // The three that walk on legs of their own are sculpted too, and breathe.
  for (const k of ['brood_mother', 'horror', 'overseer']) {
    const a = rigBody(k, 0);
    assert.ok(filled(a) > 500, `${k} is something`);
    assert.ok(diff(a, rigBody(k, 6)) > 30, `${k} breathes`);
  }
  assert.deepEqual(Object.keys(LEG_STYLES).sort(), ['bone', 'mech', 'spider']);
});

test('a sculpted part is shaded as the stuff it is: fur isn\'t metal isn\'t glass', () => {
  const mats = ['fur', 'metal', 'glass', 'bark', 'scales'];
  const pics = mats.map((m) => {
    const X = new Sculpt(24, 24, { seed: 3 });
    X.ball(12, 12, 9, 9, '#8a6a5a', m, { rz: 8 });
    return X.render();
  });
  for (let i = 0; i < pics.length; i++) for (let j = i + 1; j < pics.length; j++) assert.ok(diff(pics[i], pics[j]) > 100, `${mats[i]} vs ${mats[j]}`);
});

test('a chain hangs between its collar and its stake, and swings free when it\'s broken', () => {
  const a = { x: 0, y: 2, z: 0 };
  const b = { x: 3, y: 0.1, z: 0 };
  const r = new Rope(16, 0.42, a, b);
  for (let i = 0; i < 240; i++) r.step(1 / 60, a, b, { gravity: 18, drag: 0.97 });
  // Held at both ends, sagging (longer than the span), never through the
  // floor, its links kept their length.
  assert.deepEqual([r.p[0].x, r.p[0].y], [0, 2]);
  assert.ok(Math.abs(r.p[16].x - 3) < 1e-6);
  assert.ok(Math.min(...r.p.map((q) => q.y)) >= 0);
  for (let i = 0; i < 16; i++) assert.ok(Math.hypot(r.p[i + 1].x - r.p[i].x, r.p[i + 1].y - r.p[i].y, r.p[i + 1].z - r.p[i].z) < 0.42 * 1.25);
  assert.ok(r.taut() < 1);
  // Broken free: its loose end falls and drags behind the collar.
  for (let i = 0; i < 240; i++) r.step(1 / 60, { x: -2, y: 2, z: 0 }, null, { gravity: 18, drag: 0.97 });
  assert.ok(r.p[16].y < 0.2 && r.p[16].x > -2, 'it trails on the floor');
  // On screen it's drawn from its floor up (a layer is three quarters of
  // a pace).
  const view = { toView: (x, z) => [x, z], camX: 0, camY: 0 };
  const s = r.screen(view, 10);
  const o = onScreen(view, -2, 10 + 2 / 0.75, 0);
  assert.ok(Math.abs(s[0].x - o.x) < 1e-6 && Math.abs(s[0].y - o.y) < 1e-6);
});

test('a serpent\'s body follows its head along the way it came, segment by segment', () => {
  const t = new Train(10, 0.5);
  for (let i = 0; i <= 60; i++) t.mark(i * 0.1, 0);
  for (let i = 0; i <= 40; i++) t.mark(6, i * 0.1);
  const pts = t.points({ x: -1, z: 0 });
  assert.equal(pts.length, 10);
  // Each a gap behind the one before, along the trail: up the bend, then
  // back along the first leg of it.
  for (let i = 1; i < 10; i++) assert.ok(Math.abs(Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z) - 0.5) < 0.08);
  assert.ok(pts[2].x === 6 && pts[9].z < 0.01 && pts[9].x < 6, 'round the corner it came by');
  // Drawn whole: one smooth length, lit and outlined, the part nearer you
  // than its head kept apart (drawn after it).
  const scr = pts.map((q) => ({ x: 20 + q.x * 16, y: 10 + q.z * 16 }));
  const body = bodyOf(scr, { rad: (k) => 5 - 3 * k, skin: () => [90, 70, 120], gloss: 0.8, front: (x, y) => y > 40 });
  assert.ok(body.back && body.front, 'behind its head and before it');
  const all = filled(body.back.px) + filled(body.front.px);
  assert.ok(all > 500, `a body (${all} pixels)`);
  // (Shaded round, not flat: many tones along it.)
  const tones = new Set();
  const p = body.back.px;
  for (let i = 0; i < p.d.length; i += 4) if (p.d[i + 3]) tones.add(p.d[i] * 65536 + p.d[i + 1] * 256 + p.d[i + 2]);
  assert.ok(tones.size > 12, `shaded (${tones.size} tones)`);
});

test('wings and lids are their own pieces, turned and beaten pixel for pixel', () => {
  const src = new Px(10, 4);
  src.rect(0, 0, 10, 4, [200, 100, 50]);
  const flat = warp(src, 0, 2, [1, 0, 0, 1], false);
  const edge = warp(src, 0, 2, [1, 0, 0, 0.25], false);
  assert.ok(filled(edge.px) < filled(flat.px) / 2, 'seen edge on as it beats');
  const p = new Part(() => src, 0, 2);
  const a = p.squeezed(0, 1, 0.5);
  assert.equal(p.squeezed(0, 1, 0.52), a, 'kept, not made again');
  assert.notEqual(p.squeezed(0, 1, -0.5), a, 'over the top is another');
});
