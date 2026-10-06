// Round 67: a mod's picture kept with the list of mods (so the Workshop's
// page of mods and a new world's list can show it); a rigged creature's
// animations played at the pace they last; changes to a world's mods
// from the pause menu; and the update.
import test from 'node:test';
import assert from 'node:assert/strict';
import './helpers.mjs';
import { newMod, newAsset, encodeCel, modPic, picPixels, PIC_SIZE } from '../src/mod/format.js';
import { ModLibrary } from '../src/mod/library.js';
import { groupSecs } from '../src/mod/rig.js';
import { lookFrame, CREATURE_LOOKS } from '../src/render/sprites.js';
import { planOf, planEmpty, KEEP, OUT, NEWER, ADD } from '../src/ui/modmanager.js';
import { STEPS, migrateSave } from '../src/game/migrate.js';
import { GAME_VERSION, compareVersions } from '../src/version.js';

// A mod with a picture: 8 x 4 art, left half colour 2, right half colour 5.
function pictured() {
  const m = newMod({ name: 'Pictured', author: 'T' });
  const a = newAsset({ name: 'Pic', w: 8, h: 4 });
  const idx = new Uint8Array(32);
  for (let i = 0; i < 32; i++) idx[i] = i % 8 < 4 ? 2 : 5;
  a.frames[0].cels.l1 = encodeCel(idx);
  a.id = 'pic';
  m.assets.pic = a;
  m.icon = 'pic';
  return m;
}

// ------------------------------------------------------------ mod pictures
test('a mod\'s picture, small: kept with the list of mods, its shape as drawn', () => {
  const m = pictured();
  const d = picPixels(modPic(m));
  assert.equal(d.length, PIC_SIZE * PIC_SIZE * 4);
  // (8 x 4 fitted into 16 x 16: twice as big, in the middle, 8 rows down
  // from 4 to 12.)
  const at = (x, y) => [...d.slice((y * PIC_SIZE + x) * 4, (y * PIC_SIZE + x) * 4 + 4)];
  assert.equal(at(0, 0)[3], 0, 'clear above it');
  assert.ok(at(2, 6)[3] > 0 && at(13, 6)[3] > 0);
  assert.notDeepEqual(at(2, 6), at(13, 6), 'its two halves');
  assert.equal(modPic(newMod({ name: 'Plain' })), null, 'none: none');
  assert.equal(picPixels('not a picture'), null);
});

test('the library keeps each mod\'s picture with its list, and finds those it hadn\'t yet', async () => {
  const lib = new ModLibrary(null);
  const m = pictured();
  const e = await lib.put(m);
  assert.ok(e.pic);
  assert.equal(lib.list()[0].pic, e.pic);
  // (A mod listed before pictures were kept: found once.)
  const ix = lib.index();
  delete ix[m.id].pic;
  lib.writeJson('tessera-mods-v1', ix);
  assert.equal(lib.list()[0].pic, undefined);
  assert.equal(await lib.fillPics(), true);
  assert.equal(lib.list()[0].pic, e.pic);
  assert.equal(await lib.fillPics(), false, 'nothing more to find');
  // (Its picture taken away: gone from the list too.)
  m.icon = null;
  assert.equal((await lib.put(m)).pic, null);
});

// ------------------------------------------------------------ rigs
test('a rigged creature walks and stands at the pace its animations last', () => {
  // (Its own length, or the game's pace if it doesn't say.)
  assert.equal(groupSecs('walk', [0, 6, 2.5]), 2.5);
  assert.ok(Math.abs(groupSecs('walk', [0, 6, 0]) - 0.625) < 1e-9);
  assert.ok(Math.abs(groupSecs('idle', [6, 6]) - 1 / 0.6) < 1e-9);
  const slow = { groups: { walk: [0, 6, 3], idle: [6, 6, 6] }, frames: 12, size: 16, draw: () => null };
  const quick = { groups: { walk: [0, 6, 0.6], idle: [6, 6, 1] }, frames: 12, size: 16, draw: () => null };
  CREATURE_LOOKS['test:slow'] = slow;
  CREATURE_LOOKS['test:quick'] = quick;
  try {
    const e = { moving: true, id: 0 };
    // A three-second walk: half a second in, its first frame still.
    assert.equal(lookFrame('test:slow', e, 0.4), 0);
    assert.equal(lookFrame('test:slow', e, 1.6), 3);
    // A walk of 0.6 seconds: half way through by then.
    assert.equal(lookFrame('test:quick', e, 0.3), 3);
    // Standing: in its idle frames, at its own pace.
    const f = lookFrame('test:slow', { moving: false, id: 0 }, 3);
    assert.equal(f, 9);
  } finally {
    delete CREATURE_LOOKS['test:slow'];
    delete CREATURE_LOOKS['test:quick'];
  }
});

// ------------------------------------------------------------ a world's mods
test('changes to a world\'s mods from the pause menu: what\'s taken out, updated and added', () => {
  const rows = [
    { id: 'a', inWorld: true, to: KEEP },
    { id: 'b', inWorld: true, to: OUT },
    { id: 'c', inWorld: true, to: NEWER, newer: '1.1.0' },
    { id: 'd', inWorld: false, to: ADD },
    { id: 'e', inWorld: false, to: KEEP },
  ];
  assert.deepEqual(planOf(rows), { remove: ['b'], update: ['c'], add: ['d'] });
  assert.equal(planEmpty(planOf(rows)), false);
  assert.equal(planEmpty(planOf(rows.map((r) => ({ ...r, to: KEEP })))), true);
});

// ------------------------------------------------------------ the update
test('a world from 0.66 comes up to 0.67', () => {
  assert.ok(compareVersions(GAME_VERSION, '0.67.0') >= 0);
  assert.ok(STEPS.find((s) => s.to === '0.67.0'));
  const d = { gv: '0.66.0', v: 1, mods: null };
  const r = migrateSave(d);
  assert.ok(r.log.some((l) => /pause menu/.test(l)));
  assert.equal(d.gv, GAME_VERSION);
});
