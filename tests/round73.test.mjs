// Round 73, the QOL update: messages trimmed, the hotbar swap, two-handed
// weapons, the new blocks kept after the old (ids unchanged), displays and
// paintings, docks, the far realms' learning, winding streets and homes
// with rooms, names, fallen stars, voices, locked doors, the ancient
// places' own creatures, the World-Worm's body and its Tooth, and the
// migration step.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGame, stubInput } from './helpers.mjs';
import { trimHint } from '../src/ui/ui.js';
import { beltSwap } from '../src/ui/windows.js';
import { ITEMS, TWO_HAND_BONUS } from '../src/world/items.js';
import { B, BLOCKS } from '../src/world/blocks.js';
import { displayDefault, useDisplay, fits, paintingSubject } from '../src/game/displays.js';
import { DOCKS, dockSizeFor } from '../src/sim/ships.js';
import { RNG } from '../src/util/rng.js';
import { nameEra, personName, CULTURES } from '../src/world/names.js';
import { starborn } from '../src/game/combat.js';
import { knowsFall, starHomeSid } from '../src/game/starfall.js';
import { speak } from '../src/game/voice.js';
import { lockingCulture, doorLocked, houseOfDoor } from '../src/game/doorlocks.js';
import { ANCIENT_DTYPES } from '../src/world/ancient.js';
import { ANCIENT_SPECIES, ANCIENT_MOBS } from '../src/entities/ancientmobs.js';
import { buildFloor } from '../src/world/dungeongen.js';
import { covers, apart } from '../src/entities/footprint.js';
import { useEvolvedGear } from '../src/game/evolvedgear.js';
import { DungeonRun } from '../src/game/dungeon.js';
import { STEPS } from '../src/game/migrate.js';
import { GAME_VERSION, compareVersions } from '../src/version.js';
import { M } from '../src/world/settlement.js';

let base = null;
const game = () => {
  if (!base) {
    base = makeGame(777);
    const input = stubInput();
    for (let i = 0; i < 3; i++) base.update(0.1, input);
  }
  return base;
};
let far = null;
const farGame = () => (far ||= makeGame(4242, { learned: false, wg: 4 }));

test('fewer words in the corner: hints in brackets and the obvious go', () => {
  assert.equal(trimHint('Too low to reach that.'), '');
  assert.equal(trimHint('There\'s a block over your head.'), '');
  assert.equal(trimHint('Dust trickles from the roof... (it\'s coming down: move!)'), 'Dust trickles from the roof...');
  assert.equal(trimHint('A rare find (Iron Ore).'), 'A rare find (Iron Ore).');
});

test('hovering an item in the pack, a number key swaps it into that belt slot', () => {
  const p = { inv: new Array(36).fill(null) };
  p.inv[20] = { item: 'apple', count: 3 };
  p.inv[2] = { item: 'bread', count: 1 };
  const win = { hoverSlot: { slots: p.inv, i: 20 }, ui: { cursorStack: null, audio: null } };
  assert.ok(beltSwap(win, p, { code: 'Digit3' }));
  assert.equal(p.inv[2].item, 'apple');
  assert.equal(p.inv[20].item, 'bread');
  assert.equal(beltSwap(win, p, { code: 'KeyQ' }), false);
});

test('two-handed weapons hit two to four harder than they did', () => {
  for (const k of ['quarterstaff', 'greatsword', 'battle_axe', 'warhammer', 'halberd']) {
    const it = ITEMS[k];
    assert.equal(it.hands, 2, k);
    const n = TWO_HAND_BONUS({ ...it, damage: 1 });
    assert.ok(n >= 2 && n <= 4, `${k} +${n}`);
  }
  assert.ok(ITEMS.greatsword.damage >= 12);
  assert.ok(ITEMS.short_sword.damage < ITEMS.greatsword.damage);
  // (Bows aren't held to it: they shoot.)
  assert.equal(TWO_HAND_BONUS(ITEMS.bow), 0);
});

test('the new blocks come after every old one, so saved worlds keep their ids', () => {
  const names = BLOCKS.map((b) => b.name);
  const cob = names.indexOf('cob_wall');
  for (const k of ['quicksilver', 'acid_pool', 'display_stand', 'wall_hanger', 'painting_small', 'painting_large']) assert.ok(names.indexOf(k) > cob, k);
  assert.equal(BLOCKS[B.acid_pool].render, 'liquid');
  assert.equal(BLOCKS[B.weapon_rack].display, 3);
  for (const k of ['weapon_rack', 'display_stand', 'wall_hanger', 'painting_small', 'painting_large']) assert.ok(ITEMS[k], `${k} can be made`);
});

test('a weapon rack keeps weapons and shows them; a stand or a hook, one thing', () => {
  const g = game();
  const p = g.player;
  const x = p.x + 2;
  const z = p.z;
  const y = p.y;
  g.world.setBlock(x, y, z, B.weapon_rack, 0);
  assert.ok(fits(BLOCKS[B.weapon_rack], 'spear'));
  assert.ok(!fits(BLOCKS[B.weapon_rack], 'apple'));
  assert.ok(fits(BLOCKS[B.display_stand], 'apple'));
  const slots = g.world.getContainer(x, y, z);
  assert.equal(slots.length, 3);
  assert.ok(displayDefault(g.world, x, y, z, BLOCKS[B.weapon_rack]).length === 3);
  // (Whatever a town's rack started with, taken off first.)
  slots.fill(null);
  p.inv[p.selected] = { item: 'spear', count: 1 };
  useDisplay(g, x, y, z);
  assert.ok(slots.some((q) => q && q.item === 'spear'), 'set on it');
  assert.equal(p.inv[p.selected], null);
  useDisplay(g, x, y, z);
  assert.ok(!slots.some(Boolean), 'taken down again');
  assert.ok(p.inv.some((q) => q && q.item === 'spear'));
  // Broken: what's on it isn't kept for the next thing there.
  g.world.setBlock(x, y, z, B.air, 0);
  assert.equal(g.world.peekContainer(x, y, z), null);
});

test('a painting is always of the same thing in the same place', () => {
  const a = paintingSubject(10, 6, 20, 99);
  const b = paintingSubject(10, 6, 20, 99);
  assert.deepEqual(a, b);
  const kinds = new Set();
  for (let i = 0; i < 80; i++) kinds.add(paintingSubject(i, 6, i * 3, 7).kind);
  assert.ok(kinds.size >= 5, [...kinds].join(','));
});

test('every coastal town has a dock as big as it is; ships only where the realm can build them', () => {
  assert.equal(dockSizeFor({ type: 'village' }), 'small');
  assert.equal(dockSizeFor({ type: 'town' }), 'medium');
  assert.equal(dockSizeFor({ type: 'city' }), 'large');
  assert.ok(DOCKS.large.len > DOCKS.small.len && DOCKS.large.head);
  const g = farGame();
  let docks = 0;
  let tried = 0;
  for (const s of g.world.ow.settlements) {
    if (!s.coast || s.deserted || s.type === 'camp') continue;
    const L = g.sim.layoutOf(s.id);
    if (!L || !L.econ) continue;
    tried++;
    g.sim.ships.daily(L, 1, new RNG(s.id));
    const P = g.sim.ships.port(s.id);
    if (!P) continue;
    docks++;
    assert.equal(P.state, 'docked', `${s.name}: there from the first`);
    assert.equal(P.ship, g.sim.tech.has(s, 'trade_ships'), `${s.name}: a ship if they can build one`);
    if (tried > 14) break;
  }
  assert.ok(docks >= Math.ceil(tried * 0.7), `${docks} of ${tried}`);
});

test('the far realms start knowing much: twenty to thirty steps on the continents, ten to fifteen on the isles, and ships', () => {
  const g = farGame();
  const ow = g.world.ow;
  let cont = 0;
  let isle = 0;
  for (const c of ow.civs.filter((q) => q.far)) {
    const st = g.sim.tech.stateOf(ow.settlements[c.capital]);
    if (c.island === 'velmarch' || c.island === 'ostria') {
      cont++;
      assert.ok(st.done.length >= 20, `${c.name}: ${st.done.length}`);
      assert.ok(st.done.includes('trade_ships'), `${c.name} sails`);
    } else {
      isle++;
      assert.ok(st.done.length >= 10 && st.done.length <= 20, `${c.name}: ${st.done.length}`);
    }
  }
  assert.ok(cont && isle);
});

test('new worlds: winding streets for some peoples, homes of more shapes with rooms, villages of incomers', () => {
  const g = farGame();
  const ow = g.world.ow;
  // Homes walled into rooms.
  let rooms = 0;
  let shapes = new Set();
  for (const s of ow.settlements.filter((q) => q.type === 'town').slice(0, 8)) {
    const L = g.world.getLayout(s);
    for (const b of L.buildings.filter((q) => q.residential)) {
      if (b.homeRooms) rooms++;
      shapes.add(`${b.x1 - b.x0 + 1}x${b.z1 - b.z0 + 1}`);
    }
  }
  assert.ok(rooms >= 3, `${rooms} homes with rooms`);
  assert.ok(shapes.size >= 8, [...shapes].join(' '));
  // A winding street: its road off the straight line somewhere along it.
  const s = ow.settlements.find((q) => q.type === 'town' && q.style === 'wild') || ow.settlements.find((q) => q.type === 'town' && q.style === 'jade');
  if (s) {
    const L = g.world.getLayout(s);
    const b = L.bounds;
    const rowsAt = (x) => {
      const out = [];
      for (let z = b.z0; z <= b.z1; z++) if (L.maskAt(x, z) === M.ROAD) out.push(z);
      return out.join(',');
    };
    const xs = [0.15, 0.3, 0.7, 0.85].map((f) => b.x0 + Math.round((b.x1 - b.x0) * f));
    assert.ok(new Set(xs.map(rowsAt)).size > 1, 'not straight');
  }
  // Villages of other peoples among a far land's own.
  const mixed = ['velmarch', 'ostria', 'corrow', 'saltmere', 'hollowmark', 'wyrd', 'skerries'].filter((k) => new Set(ow.settlements.filter((q) => q.island === k).map((q) => q.style)).size > (k === 'velmarch' || k === 'ostria' ? 2 : 1));
  assert.ok(mixed.length >= 3, mixed.join(','));
});

test('more names, and a few from the neighbours (worlds made from 0.73 on only)', () => {
  const draw = (era) => {
    nameEra(era);
    const rng = new RNG(5);
    const out = new Set();
    for (let i = 0; i < 300; i++) out.add(personName(rng, 'vale').first);
    return out;
  };
  const old = draw(3);
  const now = draw(4);
  assert.ok([...old].every((n) => CULTURES.vale.first.includes(n)), 'an old world keeps its names');
  assert.ok([...now].some((n) => !CULTURES.vale.first.includes(n)), 'a new one has more');
  nameEra(4);
  const rng = new RNG(9);
  const high = new Set();
  for (let i = 0; i < 400; i++) high.add(personName(rng, 'high').first);
  for (const n of ['Balin', 'Gloin', 'Dvalin']) assert.ok(!high.has(n), n);
  nameEra(1);
});

test('a fallen star: only folk near where it fell know what it is; and now and then someone else has a wing', () => {
  const g = game();
  g.hero = { ...(g.hero || {}), origin: 'star' };
  const home = starHomeSid(g);
  assert.ok(home !== null);
  assert.ok(knowsFall(g, home));
  const far = g.world.ow.settlements.find((s) => s.island !== g.world.ow.settlements[home].island);
  if (far) assert.ok(!knowsFall(g, far.id));
  let n = 0;
  for (let i = 0; i < 5000; i++) if (starborn({ idx: i, age: 'adult', name: { first: `N${i}` } })) n++;
  assert.ok(n > 2 && n < 60, `${n} in 5000`);
  assert.equal(starborn({ idx: 3, age: 'child', name: { first: 'Kit' } }), false);
});

test('no more tacked-on pet names and fillers', () => {
  for (let i = 0; i < 60; i++) {
    const rec = { idx: i, job: i % 3 ? 'farmer' : 'miner', age: 'adult', personality: { sociability: 0.8, temper: 0.2 }, name: { first: 'Ada' } };
    const out = speak(rec, 'The harvest was good this year.', { first: true, warm: true });
    assert.ok(!/, (love|pal|mate|friend|hey you|lad|chum)[.!?]$/.test(out), out);
    assert.ok(!/^(Hey!|Ooh!|Guess what,)/.test(out), out);
  }
});

test('some peoples lock their doors; a resident never finds their own locked', () => {
  const g = game();
  const ow = g.world.ow;
  const s = ow.settlements.find((q) => q.type !== 'camp' && lockingCulture(q));
  assert.ok(s, 'someone locks up');
  assert.equal(lockingCulture(s), lockingCulture(s));
  const L = g.world.getLayout(s);
  const b = L.buildings.find((q) => q.residential && q.door);
  if (!b) return;
  assert.equal(houseOfDoor(g, b.door.x, b.door.z)?.b?.id ?? houseOfDoor(g, b.door.x, b.door.z)?.id, b.id);
  const resident = { rec: { home: b.id }, kind: 'npc' };
  assert.equal(doorLocked(g, b.door.x, 6, b.door.z, resident), false);
});

test('the ancient places keep only their own creatures', () => {
  for (const [type, T] of Object.entries(ANCIENT_DTYPES)) {
    assert.ok(T.only, type);
    for (const [k] of T.mobs) assert.ok(ANCIENT_SPECIES[k], `${type}: ${k}`);
  }
  assert.ok(ANCIENT_MOBS.length >= 12);
  const g = game();
  const rec = { ...g.sim.dungeons.all.find((d) => d.type === 'gullet'), floors: {}, cleared: false };
  const own = new Set(ANCIENT_DTYPES.gullet.mobs.map(([k]) => k));
  const out = buildFloor(rec, 0);
  for (const sp of out.spawns) if (!sp.boss && !sp.guardian) assert.ok(own.has(sp.species), sp.species);
});

test('the World-Worm: its body is solid and can be struck; it passes through its Gullet, untouchable', () => {
  const w = { x: 10, z: 10, foot: 1, bodyTiles: new Set([13 * 65536 + 10, 14 * 65536 + 10]) };
  assert.ok(covers(w, 13, 10));
  assert.ok(!covers(w, 13, 12));
  assert.equal(apart({ x: 15, z: 10 }, w), 1);
  const g = makeGame(4242);
  const input = stubInput();
  for (let i = 0; i < 3; i++) g.update(0.1, input);
  const rec = { ...g.sim.dungeons.all.find((d) => d.type === 'gullet'), floors: {}, cleared: false };
  new DungeonRun(g, rec).enter();
  const d = g.dungeon;
  g.cheats = { god: true };
  d.passT = 0.05;
  let hit = false;
  for (let t = 0; t < 20 && !hit; t += 0.05) {
    g.update(0.05, input);
    const c = d.passing;
    if (c && g.creatures.includes(c) && !c.burrowed) {
      const hp = c.hp;
      g.damage(c, 40, g.player);
      assert.equal(c.hp, hp, 'nothing marks it');
      hit = true;
    }
  }
  assert.ok(hit, 'it came through');
});

test('the Tooth: down into the ground, steered where you point, and up again; nothing reaches you under it', () => {
  const g = makeGame(777);
  const input = stubInput();
  for (let i = 0; i < 3; i++) g.update(0.1, input);
  const p = g.player;
  const x0 = p.x;
  g.aimAngle = () => 0;
  assert.ok(useEvolvedGear(g, p, 'worm_tooth'));
  assert.equal(p.tunnel.phase, 'dig');
  const hp = p.hp;
  let under = false;
  for (let t = 0; t < 3; t += 0.05) {
    if (p.tunnel && p.tunnel.phase === 'under') {
      under = true;
      g.damage(p, 5, null);
    }
    g.update(0.05, input);
  }
  assert.ok(under);
  assert.equal(p.tunnel, null);
  assert.equal(p.hp, hp);
  assert.ok(p.x > x0 + 3, `came up ${p.x - x0} on`);
});

test('0.73.0: a migration step for it, and the version', () => {
  assert.ok(compareVersions(GAME_VERSION, '0.73.0') >= 0);
  const s = STEPS.find((q) => q.to === '0.73.0');
  assert.ok(s && s.data && s.game);
  const log = [];
  s.data({}, log);
  assert.ok(log.some((l) => /dock/.test(l)));
  assert.ok(log.some((l) => /paintings/.test(l)));
});
