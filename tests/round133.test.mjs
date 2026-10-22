// Round 133: the forge's workshops rebuilt and lit: rooms in one-point
// perspective, solid things standing in them casting their shadows from
// each light, every pixel lit afresh from its material's ramp; the work
// laid into the same light.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Cam, GBuf, MATS, mat, room, box, cyl, castShadows, shade, light, W, H, N } from '../src/ui/forgelight.js';
import { Shop, SMITHY, BENCH, BOWYER, TABLE, fire, bellows, ironBar, billet, hammer, quenchPiece, water, crucible, motes, blank, chisel, binding, lamp, bowOnPost, lantern, hide, seam } from '../src/ui/forgepaint.js';
import { GAME_VERSION, compareVersions } from '../src/version.js';
import { stepsFor } from '../src/game/migrate.js';

// A shop lit into a buffer of pixels (as its window does, without a page).
function lit(S, st = {}, t = 1) {
  const out = new Uint8ClampedArray(N * 4);
  shade(S.gb, S.def.lights(S, t, st), S.def.amb, out);
  return out;
}
const tones = (px) => {
  const set = new Set();
  for (let i = 0; i < N; i++) set.add((px[i * 4] << 16) | (px[i * 4 + 1] << 8) | px[i * 4 + 2]);
  return set.size;
};

test('a room in perspective: floor, walls and ceiling, the nearest along each ray', () => {
  const gb = new GBuf(new Cam(128, 40, 120));
  const floorM = mat('#606060');
  const wallM = mat('#806040');
  room(gb, { fy: 50, cy: -60, lx: -100, rx: 100 }, (pl) => [pl === 'floor' ? floorM : wallM, 1]);
  // The back wall's foot at eye height plus the floor's drop; below it, the
  // floor, nearer the further down.
  const at = (x, y) => gb.z[y * W + x];
  assert.equal(gb.mat[60 * W + 128], wallM);
  assert.equal(gb.mat[120 * W + 128], floorM);
  assert.ok(at(128, 100) > at(128, 140), 'the floor comes nearer toward the bottom');
  assert.ok(Math.abs(at(128, 60) - 120) < 0.01, 'the back wall at its depth');
  // A box standing on the floor hides the wall behind it, and casts a
  // shadow away from a light.
  const sh = [];
  box(gb, -10, 10, 30, 50, 70, 80, () => [floorM, 1], sh);
  const L = light(-60, 10, 75, 300, 1, '#ffffff', 0);
  castShadows(gb, sh, L, 0, 0);
  const [sx, sy] = gb.cam.p(30, 50, 76);
  assert.ok(gb.sh[(Math.round(sy) * W + Math.round(sx)) * 4] > 128, 'its shadow on the floor, away from the light');
  const [lx, ly] = gb.cam.p(-40, 50, 76);
  assert.equal(gb.sh[(Math.round(ly) * W + Math.round(lx)) * 4], 0, 'the floor toward the light, lit');
  // A cylinder's side faces round it.
  const g2 = new GBuf(new Cam(128, 40, 120));
  cyl(g2, 0, 70, 10, 20, 50, (part) => [floorM, 1, part === 'top' ? [0, -1, 0] : null]);
  const [cx, cy] = g2.cam.p(-8, 40, 66);
  assert.ok(g2.nx[Math.round(cy) * W + Math.round(cx)] < -40, 'its left side faces left');
});

test('every workshop is built, its shadows cast, and lit from its material ramps', () => {
  for (const kind of ['forge', 'carve', 'bow', 'stitch']) {
    const S = new Shop(kind, 2);
    S.begin();
    let shadowed = 0;
    let open = 0;
    for (let i = 0; i < N; i++) {
      if (!S.base.mat[i]) continue;
      if (S.base.sh[i * 4] > 200) shadowed++;
      else if (S.base.sh[i * 4] === 0) open++;
    }
    assert.ok(shadowed > 200 && open > 1000, `${kind}: shadow and light (${shadowed}, ${open})`);
    const px = lit(S, { fire: 0.6 });
    assert.ok(tones(px) > 40, `${kind}: many tones`);
    // (Every pixel set.)
    for (let i = 0; i < N; i++) assert.equal(px[i * 4 + 3], 255);
  }
});

test('the fire lights the smithy: fiercer, brighter, and the hot iron glows', () => {
  const S = new Shop('forge', 1);
  const bright = (k) => {
    S.begin();
    fire(S, 1, k);
    const px = lit(S, { fire: k });
    let sum = 0;
    for (let i = 0; i < N; i++) sum += px[i * 4] + px[i * 4 + 1] + px[i * 4 + 2];
    return sum / N;
  };
  assert.ok(bright(1) > bright(0.1) * 1.15, 'a roaring fire lights the room more');
  // The coal bed glows (its own light, unlit by anything else).
  S.begin();
  fire(S, 1, 0.8);
  const glowing = S.px.coal.filter(([x, y]) => MATS[S.gb.mat[y * W + x]].unlit).length;
  assert.ok(glowing > S.px.coal.length * 0.3);
  // Each moving thing draws, and the hot ones give their light.
  S.begin();
  bellows(S, 0.5);
  const I = ironBar(S, 0.9);
  assert.equal(I.heat, 0.9);
  const lights = S.def.lights(S, 1, { fire: 0.5, iron: I });
  assert.equal(lights.length, 5, 'fire, its bounce, a lamp behind you, the moon, the iron');
  S.begin();
  billet(S, 'iron_sword', 0.8, 0.5, 0.4);
  hammer(S, 0.3);
  quenchPiece(S, 0.7, 0.5);
  water(S, 1, 0.5, 0.5);
  crucible(S, 0.6, 0.5, 1);
  lit(S, { iron: { x: 0, y: 20, z: 70, heat: 0.8 } });
  assert.ok(SMITHY.anvil && SMITHY.tub && SMITHY.fire);
});

test('the bench, the bowyer\'s and the table: their work drawn in their light', () => {
  const B = new Shop('carve', 1);
  B.begin();
  motes(B, 3);
  blank(B, [0.2, 0.6], [0.4], [0.8]);
  chisel(B, 0, 0.5);
  binding(B, 'wood_sword', [1, 0.7, 0.2], 8, 1);
  assert.ok(tones(lit(B)) > 40);
  assert.ok(BENCH.blank.x1 > BENCH.blank.x0);
  const W2 = new Shop('bow', 1);
  W2.begin();
  lamp(W2, 1);
  bowOnPost(W2, 0.6, [1], false, 0, 1, 0.62);
  bowOnPost(W2, 0.35, [], true, 0.8, 1);
  lit(W2);
  assert.ok(BOWYER.grip);
  const T = new Shop('stitch', 1);
  T.begin();
  lantern(T, 1);
  hide(T, 12, (w) => 72 + Math.sin(w * 0.06) * 10, [[-30, 70, 1], [-29, 71, 0.2]], -24, 72);
  seam(T, 10, [1, 0.7, 0], 3, 0.5);
  lit(T);
  assert.ok(TABLE.top.d1 > TABLE.top.d0);
  assert.equal(H, 144);
});

test('version 1.33.0', () => {
  assert.ok(compareVersions('1.33.0', GAME_VERSION) <= 0);
  const s = stepsFor('1.32.0').find((q) => q.to === '1.33.0');
  assert.ok(s && s.game);
});
