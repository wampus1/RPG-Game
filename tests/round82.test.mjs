// Round 82: the essentials (one world shared where it can be): talk that
// wraps, guards' trust, the coach on the roads and streets (and picked on
// a map), horses and wagons in the round with tank controls, rugs joined
// whichever way you look, as many save slots as you like, the wait slider
// and the settings' squares, the game's stories switched off by a mod, and
// the version's step.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeGame, stubInput } from './helpers.mjs';
import { B } from '../src/world/blocks.js';
import { M } from '../src/world/settlement.js';
import { bubbleLines, rugJoin } from '../src/render/renderer.js';
import { HIRE_MIN_OPINION } from '../src/sim/careers.js';
import { repLevel } from '../src/sim/sim.js';
import { coachLinks, hasCoaches } from '../src/sim/coaches.js';
import { REGION_W, REGION_D } from '../src/config.js';
import { CoachMapWindow } from '../src/ui/travel.js';
import { steedPixels, dirAngle, easeAngle } from '../src/render/steeds.js';
import { turnMount, mountStep } from '../src/game/riding.js';
import { SaveStore, slotIds } from '../src/game/saves.js';
import { WaitWindow } from '../src/ui/windows.js';
import { SETTING_ROWS, setSetting } from '../src/game/settings.js';
import { MODS } from '../src/mod/state.js';
import { storyOn } from '../src/mod/rules.js';
import { MOTIFS } from '../src/sim/saga/core.js';
import { GAME_VERSION, compareVersions } from '../src/version.js';
import { stepsFor, migrateSave } from '../src/game/migrate.js';

const input = stubInput();
const G = makeGame(777);
for (let i = 0; i < 5; i++) G.update(0.1, input);

test('talk over someone\'s head wraps to a few short lines, never running off', () => {
  const lines = bubbleLines('Have you heard? The miller\'s daughter ran off with a sailor, and nobody in the whole of the town can talk of anything else at all.');
  assert.ok(lines.length >= 2 && lines.length <= 3);
  for (const l of lines) assert.ok(l.length <= 30, l);
  assert.deepEqual(bubbleLines('Hm? Oh, hi.'), ['Hm? Oh, hi.']);
});

test('a guard who only mildly dislikes you still guards you', () => {
  assert.ok(HIRE_MIN_OPINION <= -25);
  assert.equal(repLevel(-12).label, 'Neutral');
  assert.ok(-12 >= HIRE_MIN_OPINION, 'neutral (-12) is enough');
  assert.equal(repLevel(HIRE_MIN_OPINION - 1).label, 'Disliked', 'it takes real dislike');
});

test('the coach keeps to the streets and roads (never through a house or the water), picked on a map', () => {
  const W = G.world;
  // (Round 116: not every realm runs a coach: a town of one that does.)
  let here = W.ow.settlementAt(G.player.x, G.player.z);
  if (!hasCoaches(here)) {
    here = W.ow.settlements.find((q) => !q.deserted && hasCoaches(q) && coachLinks(G, q).length);
    G.teleportPlayer(Math.round((here.cx + here.cw / 2) * REGION_W), 40, Math.round((here.cz + here.cd / 2) * REGION_D));
    for (let i = 0; i < 20; i++) G.update(0.1, input);
  }
  const links = coachLinks(G, here);
  assert.ok(links.length, 'somewhere to go');
  G.player.give('coin', 200);
  // Picked on the map, and asked first.
  const ui = { game: G, mouse: null, mouseCell: { x: 0, y: 0 }, audio: null, msg() {}, close() {}, input: null, time: 0 };
  const win = new CoachMapWindow(ui, { kind: 'coach', sid: here.id });
  win.update(0.016);
  assert.ok(win.links(G).length === links.length);
  win.choose(win.links(G)[0]);
  assert.equal(G.player._ride, undefined, 'not off till you say yes');
  win.go(G);
  const R = G.player._ride;
  assert.ok(R && !R.pending && R.pts.length > 2);
  let bad = 0;
  let diag = 0;
  for (const sid of [R.from, R.to]) {
    const L = W.layouts.get(sid);
    for (let i = 1; i < R.pts.length; i++) {
      const a = R.pts[i - 1];
      const b = R.pts[i];
      if (a.x !== b.x && a.z !== b.z) diag++;
      const n = Math.ceil(Math.hypot(b.x - a.x, b.z - a.z));
      for (let j = 0; j <= n; j++) {
        const x = Math.round(a.x + ((b.x - a.x) * j) / Math.max(1, n));
        const z = Math.round(a.z + ((b.z - a.z) * j) / Math.max(1, n));
        if (L && L.inside(x, z) && ![M.ROAD, M.PLAZA, M.BRIDGE, M.FREE, M.FIELD].includes(L.maskAt(x, z))) bad++;
      }
    }
  }
  assert.equal(bad, 0, 'nothing built on in its way');
  assert.equal(diag, 0, 'square to the streets');
  // It turns into its corners as it goes (a heading, not a flip).
  G.update(0.1, input);
  assert.equal(typeof R.prop.ang, 'number');
});

test('horses and wagons drawn in the round, turned to any heading', () => {
  const side = steedPixels('horse', { coat: 1, saddle: true }, Math.PI / 2);
  const end = steedPixels('horse', { coat: 1, saddle: true }, 0);
  const lit = (P) => P.px.filter(Boolean).length;
  assert.ok(lit(side) > 150 && lit(end) > 50);
  assert.ok(side.w > end.w + 10, 'longer side on than end on');
  const wagon = steedPixels('wagon', { hood: true, banner: '#3060c0', horse: { coat: 2 } }, 0.6);
  assert.ok(lit(wagon) > lit(side));
  assert.ok(Math.abs(easeAngle(0.1, Math.PI * 2 - 0.1, 1, 0.05) - 0.05) < 1e-9, 'the short way round');
});

test('riding: A and D turn it, W drives it on the way it\'s heading', () => {
  const p = G.player;
  p.mount = { kind: 'horse', coat: 0, saddle: true, ang: dirAngle(0) };
  const held = new Set(['KeyA']);
  const inp = { ...input, isDown: (k) => held.has(k) };
  turnMount(p, 0.2, inp);
  assert.ok(p.mount.ang > 0.5 && p.mount.ang < 0.8, 'turned to its left');
  p.mount.ang = Math.PI / 4;
  held.clear();
  held.add('KeyW');
  p.tankOff = null;
  const st = mountStep(p, inp);
  assert.ok(st && st.dx >= 0 && st.dz >= 0 && st.dx + st.dz >= 1, 'on along the heading');
  held.clear();
  assert.equal(mountStep(p, inp), null, 'nothing held, nowhere');
  p.mount = null;
});

test('rugs side by side join up whichever way the camera\'s turned', () => {
  const w = { getBlock: (x, y, z) => (x >= 0 && x <= 1 && z === 0 ? B.rug_red : 0) };
  // Two rugs east-west: at view 0 the first runs on to its right...
  assert.equal(rugJoin(w, 0, 5, 0, B.rug_red, 0) & 15, 2);
  // ...turned a quarter, that's down the screen; turned half, its left.
  assert.equal(rugJoin(w, 0, 5, 0, B.rug_red, 1) & 15, 4);
  assert.equal(rugJoin(w, 0, 5, 0, B.rug_red, 2) & 15, 8);
  assert.equal(rugJoin(w, 0, 5, 0, B.rug_red, 1) & 16, 16, 'its fringe kept at its own ends');
});

test('as many save slots as you like, single player and hosted', async () => {
  class Mem {
    constructor() {
      this.m = new Map();
    }
    getItem(k) {
      return this.m.has(k) ? this.m.get(k) : null;
    }
    setItem(k, v) {
      this.m.set(k, String(v));
    }
    removeItem(k) {
      this.m.delete(k);
    }
  }
  const store = new SaveStore(new Mem());
  const meta = (o) => ({ name: 'Ada', day: 1, minute: 0, seed: 1, place: 'Here', savedAt: 1, ...o });
  for (let i = 1; i <= 7; i++) await store.putText(String(i), '{}', meta());
  const ids = store.list().map((q) => q.id);
  assert.deepEqual(ids, ['auto', '1', '2', '3', '4', '5', '6', '7', '8'], 'one more after the last');
  for (let i = 1; i <= 4; i++) await store.putText(`mp${i}`, '{}', meta({ world: `W${i}` }));
  assert.equal(store.worlds().length, 4, 'more than three worlds to host');
  assert.equal(store.freeWorld(), 'mp5');
  assert.deepEqual(slotIds({}), ['1', '2', '3', '4', '5']);
});

test('the wait is a slider; a setting\'s squares set it where clicked; no label cut off', () => {
  const ui = { mouse: null, mouseCell: { x: 0, y: 0 }, audio: null };
  const w = new WaitWindow(ui, G, {});
  w.setHours(10);
  assert.equal(w.hours, 10);
  w.setHours(40);
  assert.equal(w.hours, 24);
  const row = SETTING_ROWS.find((r) => r.kind !== 'bool' && r.kind !== 'choice');
  const s = { [row.key]: 1 };
  setSetting(s, row.key, 7);
  assert.equal(s[row.key], Math.min(7, row.max));
  for (const r of SETTING_ROWS) assert.ok(r.label.length <= 26, r.label);
});

test('a mod can switch off the game\'s own stories', () => {
  const id = Object.keys(MOTIFS).find((k) => !k.startsWith('m:') && MOTIFS[k].nodes);
  assert.ok(storyOn(id));
  MODS.storiesOff = new Set([id]);
  try {
    assert.ok(!storyOn(id));
    assert.equal(G.sim.saga.begin(id, { cast: {}, vars: {} }), null, 'it never begins');
  } finally {
    MODS.storiesOff = null;
  }
});

test('version 0.82.0: landmarks you came across come off the map (ones you were told of stay)', () => {
  assert.ok(compareVersions(GAME_VERSION, '0.82.0') >= 0);
  assert.ok(stepsFor('0.81.0').some((s) => s.to === '0.82.0'));
  const d = { gv: '0.81.0', landmarksFound: { a: { how: 'found' }, b: { how: 'told' } }, pins: [{ landmark: 'a', x: 1, z: 1 }, { landmark: 'b', x: 2, z: 2 }, { label: 'quest', x: 3, z: 3 }] };
  migrateSave(d);
  assert.deepEqual(d.pins.map((q) => q.landmark || q.label), ['b', 'quest']);
});
