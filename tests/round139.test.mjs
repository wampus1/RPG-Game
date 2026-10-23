// Round 139: every weapon's special (hold the button down, let go when it's
// ready: the ground it will cover shown under you as it winds up, on every
// screen) and a trigger for it; relics only off the masters (always off a
// third-tier one), broken down into shards at an anvil, and shown on their
// pedestals; smiths priced by their skill, making anything forged, paid in
// their own purse; fallen stars greeted as one of their own by those with
// a wing; a jail's evidence chest, its guard at the door, and visitors in
// through the door to the bars (and off on foot after); the map's tier
// badges; armour held in the hand.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { makeGame, stubInput } from './helpers.mjs';
import { Creature } from '../src/entities/creature.js';
import { ITEMS, RELICS } from '../src/world/items.js';
import { starKey } from '../src/world/quality.js';
import { TRIGGERS } from '../src/world/triggers.js';
import { ADDITIVES } from '../src/world/smithmats.js';
import { SPECIALS, SPECIAL_KEYS, specialOf, specialShapes, shapeTiles, doSpecial, windSpecial, specialTick, specialLine } from '../src/game/specials.js';
// (Round 142: the ground each covers as shapes, not squares; the squares
// whose middles they take in, for these.)
const specialTiles = (k, x, z, dx, dz, at) => shapeTiles(specialShapes(k, x, z, Math.atan2(dz, dx), at)).filter((t) => t.x !== x || t.z !== z);
import { SPECIAL_FX } from '../src/render/specialfx.js';
import { STYLES, weaponStyle, staminaCost } from '../src/game/combat.js';
import { abState } from '../src/game/abilities.js';
import { modsOf } from '../src/game/mods.js';
import { salvageRelic, SALVAGE_SHARDS } from '../src/game/relics.js';
import { RELIC_DROP } from '../src/game/dungeon.js';
import { priceOf, smithWares, smithRespond } from '../src/game/smithtalk.js';
import { kindred } from '../src/game/starfall.js';
import { topicsFor, respond, openingLine } from '../src/game/dialogue.js';
import { parseFx } from '../src/ui/textfx.js';
import { lockGrade, lockTier, STRONGROOM } from '../src/game/lockpick.js';
import { SENTRY_MIN } from '../src/sim/justice.js';
import { R, pidOf } from '../src/sim/saga/core.js';
import { pkey } from '../src/sim/mind/common.js';
import { GAME_VERSION, compareVersions } from '../src/version.js';
import { stepsFor } from '../src/game/migrate.js';

const src = (p) => fs.readFileSync(new URL(`../src/${p}`, import.meta.url), 'utf8');
const ARMS = { shove: null, shadow: 'dagger', lunge: 'iron_sword', flurry: 'sabre', sweep: 'quarterstaff', skewer: 'spear', haul: 'harpoon', crack: 'club', whirl: 'hand_axe', reap: 'flail', hew: 'halberd', cleave: 'greatsword', quake: 'warhammer' };
const wolf = (g, x, z, hp = 400) => {
  const p = g.player;
  const y = g.world.findStandY(x, z, p.y);
  const w = new Creature(g, 'wolf', x, y > 0 ? y : p.y, z);
  g.addCreature(w);
  w.angry = true;
  w.target = p;
  w.hp = w.maxHp = hp;
  return w;
};
const hold = (g, item) => {
  const p = g.player;
  p.inv[p.selected] = item ? { item, count: 1 } : null;
};

// ------------------------------------------------------------ specials
test('every weapon has a special of its own; bows draw as they did', () => {
  for (const [k, item] of Object.entries(ARMS)) assert.equal(specialOf(item), k, `${item} -> ${k}`);
  assert.equal(specialOf('bow'), null);
  assert.equal(specialOf('crossbow'), null);
  // (Every weapon in the game finds one, gems and all.)
  for (const [key, d] of Object.entries(ITEMS)) if (d && d.kind === 'weapon' && !d.ranged) assert.ok(SPECIALS[specialOf(key)], key);
  for (const k of SPECIAL_KEYS) {
    const sp = SPECIALS[k];
    assert.ok(sp.name && sp.about && sp.cost > 0 && sp.charge > 0 && sp.mult > 0, k);
    assert.ok(specialTiles(k, 0, 0, 1, 0, { x: 2, z: 0 }).some((t) => t.w > 0), `${k} covers some ground`);
    assert.ok(SPECIAL_FX.includes(k), `${k} has a look`);
  }
  assert.match(specialLine('warhammer'), /Hold: Earthshaker \(8 stamina\)/);
});

test('light specials cost less breath than a plain blow, heavy ones more, and the heavy weapons\' do the most', () => {
  const plain = (item) => staminaCost(STYLES[weaponStyle(item)]);
  assert.ok(SPECIALS.shove.cost < plain(null));
  assert.ok(SPECIALS.shadow.cost < plain('dagger'));
  assert.ok(SPECIALS.sweep.cost < plain('quarterstaff'));
  for (const k of ['lunge', 'skewer', 'crack', 'whirl', 'reap', 'hew', 'cleave', 'quake']) assert.ok(SPECIALS[k].cost > plain(ARMS[k]), `${k} costs more than its plain blow`);
  // (What each does, all told: the ground it covers, how hard there.)
  const worth = (k) => specialTiles(k, 0, 0, 1, 0, { x: 2, z: 0 }).reduce((n, t) => n + t.w, 0) * SPECIALS[k].mult;
  const light = ['shove', 'shadow', 'flurry', 'sweep', 'lunge'];
  const heavy = ['whirl', 'reap', 'hew', 'cleave', 'quake'];
  const best = Math.max(...light.map(worth));
  for (const k of heavy) assert.ok(worth(k) > best, `${k} (${worth(k)}) beats every light one (${best})`);
  for (const k of heavy) assert.ok(SPECIALS[k].charge > SPECIALS.lunge.charge && SPECIALS[k].weight >= 3, `${k} is slow and heavy`);
});

test('each special goes off: its blows, its cost, its look and its sound', () => {
  for (const [k, item] of Object.entries(ARMS)) {
    const g = makeGame(12345, { wg: 9 });
    const p = g.player;
    hold(g, item);
    const foes = specialTiles(k, p.x, p.z, 1, 0, { x: p.x + 2, z: p.z }).filter((t) => t.w > 0).slice(0, 3).map((t) => wolf(g, t.x, t.z));
    p.stamina = 10;
    const fx = [];
    const eff = g.renderer.effect;
    g.renderer.effect = (o) => {
      fx.push(o.type);
      return eff?.call(g.renderer, o);
    };
    const snd = [];
    g.audio = { play: (n) => snd.push(n) };
    const hits = doSpecial(g, p, { k, dx: 1, dz: 0, target: foes[0] });
    for (let i = 0; i < 10; i++) specialTick(g, p, 0.05);
    assert.ok(hits, `${k} went off`);
    assert.ok(foes.some((f) => f.hp < 400), `${k}: a foe felt it`);
    assert.ok(Math.abs(10 - p.stamina - SPECIALS[k].cost) < 0.01, `${k}: ${SPECIALS[k].cost} stamina`);
    assert.ok(fx.includes(`sp_${k}`), `${k}: its look`);
    assert.ok(snd.includes(`sp_${k}`), `${k}: its sound`);
  }
});

test('what the specials do besides: a step behind them, a leap, a stun, a pull', () => {
  const g = makeGame(12345, { wg: 9 });
  const p = g.player;
  hold(g, 'dagger');
  const x0 = p.x;
  const w = wolf(g, p.x + 2, p.z);
  doSpecial(g, p, { k: 'shadow', dx: 1, dz: 0, target: w });
  assert.ok(p.x === w.x + 1 || Math.abs(p.z - w.z) === 1, 'stepped round behind them');
  assert.ok(p.x !== x0 || p.z !== w.z);
  const g2 = makeGame(12345, { wg: 9 });
  const q = g2.player;
  hold(g2, 'club');
  const c = wolf(g2, q.x + 1, q.z);
  doSpecial(g2, q, { k: 'crack', dx: 1, dz: 0, target: c });
  assert.ok(c.stunT >= 1.5, 'stunned');
  const g3 = makeGame(12345, { wg: 9 });
  const r = g3.player;
  hold(g3, 'harpoon');
  const far = wolf(g3, r.x + 4, r.z);
  doSpecial(g3, r, { k: 'haul', dx: 1, dz: 0 });
  assert.ok(far.x < r.x + 4, 'hauled in');
  const g4 = makeGame(12345, { wg: 9 });
  const s = g4.player;
  hold(g4, 'greatsword');
  const sx = s.x;
  doSpecial(g4, s, { k: 'cleave', dx: 1, dz: 0 });
  assert.ok(s.x === sx + 2 || s.x === sx + 1, 'leapt forward');
  assert.ok(s.leap, 'in the air');
  for (let i = 0; i < 10; i++) specialTick(g4, s, 0.05);
  assert.ok(!s.leap && !s.hop, 'and down again');
});

test('held down, a special winds up where everyone can see it, and goes off as you let go', () => {
  const g = makeGame(12345, { wg: 9 });
  const p = g.player;
  hold(g, 'iron_sword');
  p.stamina = 10;
  const inp = stubInput();
  inp.mouse.down = true;
  g.cursor = null;
  g.handleMouse(0.016, [{ type: 'down', button: 0 }], inp);
  assert.ok(g.charging && g.charging.k === 'lunge', 'winding up');
  for (let i = 0; i < 40; i++) g.handleMouse(0.016, [], inp);
  assert.ok(g.charging.ready, 'ready');
  // (On you, as plain data, so it goes over the wire with you.)
  assert.ok(p.spec && p.spec.k === 'lunge' && p.spec.a === 1);
  assert.ok(!Object.keys(p.spec).some((k) => k.startsWith('_')));
  const fx = [];
  const eff = g.renderer.effect;
  g.renderer.effect = (o) => {
    fx.push(o.type);
    return eff?.call(g.renderer, o);
  };
  inp.mouse.down = false;
  g.handleMouse(0.016, [{ type: 'up', button: 0 }], inp);
  assert.ok(!g.charging && !p.spec, 'let go');
  assert.ok(fx.includes('sp_lunge'), 'the lunge');
  assert.ok(Math.abs(10 - p.stamina - SPECIALS.lunge.cost) < 0.01);
  // A quick click is the plain blow, as ever.
  const g2 = makeGame(12345, { wg: 9 });
  hold(g2, 'iron_sword');
  const i2 = stubInput();
  i2.mouse.down = true;
  g2.cursor = null;
  g2.handleMouse(0.016, [{ type: 'down', button: 0 }], i2);
  i2.mouse.down = false;
  g2.handleMouse(0.016, [{ type: 'up', button: 0 }], i2);
  assert.ok(g2.player.swing, 'a plain swing');
});

test('the warning is drawn on the ground for every one of you, as the world is drawn', () => {
  const s = src('render/specialfx.js');
  for (const bad of ['createRadialGradient', 'createLinearGradient', "'lighter'", '.arc(', '.ellipse(', '.stroke(']) assert.ok(!s.includes(bad), `no ${bad}`);
  assert.ok(src('render/renderer.js').includes('drawSpecialTele(this, ctx, game)'));
  assert.ok(src('net/guest.js').includes('game.netPlayers = players'));
  assert.ok(src('render/fx.js').includes("startsWith('sp_')"));
  // (Every one of a special's sounds.)
  const audio = src('game/audio.js');
  for (const k of [...SPECIAL_KEYS, 'ready']) assert.ok(audio.includes(`case 'sp_${k}'`), `a sound for ${k}`);
  const g = makeGame(12345, { wg: 9 });
  const p = g.player;
  windSpecial(g, p, { k: 'quake', t: 0, dx: 1, dz: 0 }, 0.45);
  assert.equal(p.spec.k, 'quake');
  assert.ok(p.spec.a > 0.4 && p.spec.a < 0.6, 'half wound up');
});

test('a new trigger: your weapon\'s special, in something that goes into the forge', () => {
  assert.ok(TRIGGERS.special && TRIGGERS.special.gear.includes('blade'));
  assert.ok(Object.values(ADDITIVES).some((a) => a.traits.includes('special')));
  const g = makeGame(12345, { wg: 9 });
  const p = g.player;
  hold(g, starKey('iron_sword', 3, 'c', 0, ['keen-special']));
  wolf(g, p.x + 1, p.z);
  doSpecial(g, p, { k: specialOf('iron_sword'), dx: 1, dz: 0 });
  const st = abState(p);
  assert.ok((st.surge['blade.keen.special'] || 0) > st.t, 'keen, after a special');
});

// ------------------------------------------------------------ relics
test('relics come off the masters only, rarely (always off a third-tier one), and break down at the anvil', () => {
  assert.ok(RELIC_DROP > 0 && RELIC_DROP < 0.25);
  const dg = src('game/dungeon.js');
  assert.match(dg, />= 3 \|\| Math\.random\(\) < RELIC_DROP/);
  const gen = src('world/dungeongen.js');
  assert.ok(!/\[\[`relic_\$\{rng\.pick\(RELIC_KEYS\)\}`, 1\]\]/.test(gen), 'no relic left in a chest');
  const g = makeGame(12345, { wg: 9 });
  const p = g.player;
  const kind = Object.keys(RELICS)[0];
  p.inv[4] = { item: `relic_${kind}`, count: 1 };
  const r = salvageRelic(g, 4);
  assert.ok(r.ok && r.n === SALVAGE_SHARDS);
  assert.ok(!p.inv.some((s) => s && s.item === `relic_${kind}`), 'the relic broken up');
  assert.ok(p.inv.some((s) => s && s.item === 'relic_shard' && s.count >= SALVAGE_SHARDS));
  assert.ok(!salvageRelic(g, 4).ok, 'nothing there');
  assert.ok(src('ui/relicanvil.js').includes('Salvage'));
  assert.ok(src('render/oldplaces.js').includes('itemIcon(relicItem('), 'shown on its pedestal');
});

// ------------------------------------------------------------ smiths
test('a smith makes anything forged, dearer the better they are, and keeps what you pay', () => {
  for (const k of ['iron_sword', 'steel_sword', 'warhammer', 'halberd', 'iron_breastplate']) {
    if (!ITEMS[k]) continue;
    assert.ok(priceOf(k, 'town', 0.9) > priceOf(k, 'town', 0.2) * 2, `${k}: a master's dearer`);
  }
  const g = makeGame(12345, { wg: 9 });
  g.player.inv[0] = { item: 'coin', count: 5000 };
  const npc = { rec: { job: 'blacksmith', idx: 4, coins: 10, skills: { crafting: 0.7, building: 0.7 } }, settlement: { id: 901, type: 'town' } };
  const all = smithWares(g, npc);
  assert.ok(all.length >= 15, `${all.length} things to order`);
  const kinds = new Set(all.map((w) => w.kind));
  assert.ok(kinds.size >= 4, 'of every kind');
  const menu = smithRespond(npc, g, 'sm_order');
  const k1 = smithRespond(npc, g, 'sm_order', menu.choices[0].arg);
  const pick = k1.choices.find((c) => c.arg);
  const price = all.find((w) => w.k === pick.arg).price;
  smithRespond(npc, g, 'sm_order', pick.arg);
  assert.equal(npc.rec.coins, 10 + price, 'the smith is paid');
});

// ------------------------------------------------------------ fallen stars
test('one with a wing of their own greets a fallen star as one of their own', () => {
  const g = makeGame(12345, { wg: 9 });
  const inp = stubInput();
  for (let i = 0; i < 12; i++) g.update(0.25, inp);
  const npc = g.npcs.find((n) => n.rec && n.settlement && n.rec.age === 'adult' && n.state === 'routine');
  // (A name that makes them one: the same test as combat.starborn.)
  const base = npc.rec.name.first;
  for (let i = 0; i < 5000 && !kindred(npc.rec, { origin: 'star' }); i++) npc.rec.name.first = `${base}${i}`;
  g.hero.origin = 'star';
  assert.ok(kindred(npc.rec, g.hero));
  assert.ok(topicsFor(npc, g).some((t) => t.id === 'kin'));
  assert.ok(parseFx(openingLine(npc, g)).text.length > 3);
  const before = (g.player.inv.find((s) => s && s.item === 'shard_moonstone') || { count: 0 }).count;
  let last = null;
  for (let i = 0; i < 7; i++) last = respond(npc, g, 'kin');
  assert.ok(last.lines.length);
  const after = (g.player.inv.find((s) => s && s.item === 'shard_moonstone') || { count: 0 }).count;
  assert.ok(after > before, 'a keepsake at the end of it');
  g.hero.origin = 'outworlder';
  assert.ok(!topicsFor(npc, g).some((t) => t.id === 'kin'), 'only to a fallen star');
});

// ------------------------------------------------------------ the jail
function jailTown() {
  const g = makeGame(12345, { wg: 9 });
  const inp = stubInput();
  for (let i = 0; i < 20; i++) g.update(0.25, inp);
  const n0 = g.npcs.find((q) => q.rec && q.settlement && q.layout && q.layout.jail);
  return { g, inp, L: n0.layout, sid: n0.layout.settlement.id };
}

test('what the guards take off you is locked in an evidence chest, and handed back from it', () => {
  const { g, inp, L, sid } = jailTown();
  const p = g.player;
  p.inv[0] = { item: 'iron_sword', count: 1 };
  g.sim.justice.imprison(sid, 'surrender', true);
  for (let i = 0; i < 4; i++) g.update(0.25, inp);
  const v = g.sim.justice.vaults.get(sid);
  assert.ok(v, 'an evidence chest');
  const slots = g.world.getContainer(v.x, v.y, v.z);
  assert.ok(slots.some((s) => s && s.item === 'iron_sword'), 'the sword in it');
  const b = L.buildings.find((q) => v.x >= q.x0 && v.x <= q.x1 && v.z >= q.z0 && v.z <= q.z1);
  assert.ok(b && (b.id === L.jail.building || b.type === 'townhall'), 'in the jail (or the town hall)');
  const own = g.containerOwner(v.x, v.y, v.z);
  assert.equal(own.kind, 'evidence');
  assert.ok(g.chestLocked(v.x, v.y, v.z));
  assert.equal(lockTier(null, own), STRONGROOM);
  assert.ok(lockGrade(STRONGROOM).pins > lockGrade(4).pins, 'the hardest lock there is');
  assert.ok(g.unbreakableChest(v.x, v.y, v.z));
  // (Saved and loaded.)
  assert.ok(g.sim.justice.serialize().vaults.length);
  g.sim.justice.release('served');
  assert.ok(p.inv.some((s) => s && s.item === 'iron_sword'), 'handed back');
  assert.ok(!g.world.getContainer(v.x, v.y, v.z).some((s) => s && s.item === 'iron_sword'), 'out of the chest');
});

test('with guards enough, one stands at the jail door while anyone\'s in the cell', () => {
  const { g, inp, L, sid } = jailTown();
  g.sim.justice.imprison(sid, 'surrender', true);
  const guards = g.guardsOf(sid);
  assert.ok(guards.length >= SENTRY_MIN, `${guards.length} guards`);
  for (const q of guards) q.wake?.();
  for (const q of guards) q.sleeping = false;
  g.sim.justice.postSentries();
  const on = L.npcs.find((r) => r.override && r.override.act === 'watch' && r.override.post);
  assert.ok(on && on.job === 'guard', 'one on the door');
  const b = L.buildings[L.jail.building];
  const t = on.override.target;
  assert.ok(Math.abs(t.x - b.outside.x) + Math.abs(t.z - b.outside.z) <= 1, 'just outside it');
  g.sim.justice.release('served');
  for (let i = 0; i < 3; i++) g.update(0.5, inp);
  g.sim.justice.postSentries();
  assert.ok(!L.npcs.some((r) => r.override && r.override.post), 'and off it once the cell\'s empty');
});

test('someone come to have a word with you in the cell comes in to the bars, not up against the wall', () => {
  const { g, inp, L, sid } = jailTown();
  const p = g.player;
  g.sim.justice.imprison(sid, 'surrender', true);
  for (let i = 0; i < 4; i++) g.update(0.25, inp);
  const cell = g.sim.justice.cellside(p);
  assert.ok(cell, 'in a cell');
  const c = g.npcs.find((q) => q.rec && q.layout === L && q.rec.age === 'adult' && q.rec.job !== 'guard' && !q.dead && q.state === 'routine' && !q.rec.override);
  c.wake?.();
  const b = L.buildings[L.jail.building];
  let best = null;
  for (let z = b.z0 - 2; z <= b.z1 + 2; z++) {
    for (let x = b.x0 - 2; x <= b.x1 + 2; x++) {
      if (x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1) continue;
      const y = g.world.findStandY(x, z, L.jail.y);
      if (y < 0 || Math.abs(y - L.jail.y) > 1) continue;
      const d = Math.hypot(x - p.x, z - p.z);
      if (!best || d < best.d) best = { x, y, z, d };
    }
  }
  c.teleport(best.x, best.y, best.z);
  c.rec.seek = { pk: pkey(g), k: 'confront', d: g.day };
  let saidOutside = false;
  for (let i = 0; i < 160 && !c.rec.seek.said; i++) {
    g.update(0.25, inp);
    if (c.rec.seek && c.rec.seek.said && !cell.has(c)) saidOutside = true;
  }
  assert.ok(c.rec.seek && c.rec.seek.said, 'they had their say');
  assert.ok(!saidOutside && cell.has(c), 'from inside the jail');
});

test('the grieving, done with you, walk off rather than vanish where they stood', () => {
  const g = makeGame(12345, { wg: 9 });
  const inp = stubInput();
  for (let i = 0; i < 12; i++) g.update(0.25, inp);
  const S = g.sim.saga;
  const n0 = g.npcs.find((q) => q.rec && q.settlement && q.rec.age === 'adult');
  const L = n0.layout;
  const sid = L.settlement.id;
  const vic = L.npcs.find((r) => r.age === 'adult' && r !== n0.rec);
  const pid = pidOf(g.player);
  const th = S.startStory('vendetta', { cast: { victim: R.rec(sid, vic.idx), killer: R.pl(pid), avenger: R.rec(sid, n0.rec.idx), town: R.town(sid) }, sid, vars: { rel: 'sister' }, touched: [pid] });
  S.go(th, 'reckoning');
  const p = g.player;
  S.actor(th, { key: 'avenger', kind: 'npc', role: 'avenger', talk: true, at: { x: Math.round(p.x) + 3, z: Math.round(p.z) }, person: { name: n0.rec.name, look: n0.rec.look, personality: n0.rec.personality, traits: n0.rec.traits, age: 'adult', job: n0.rec.job, maxHp: 20, title: 'Grieving' }, orders: { seek: pid, markFor: pid, mark: 'talk', hail: 'You.', patience: 120 } });
  for (let i = 0; i < 8; i++) g.update(0.25, inp);
  const e = S.actorEnt(th, 'avenger');
  assert.ok(e, 'they came');
  th.vars.price = 1;
  p.inv[3] = { item: 'coin', count: 50 };
  respond(e, g, 'sgv_pay', `t${th.id}`);
  assert.ok(!e.dead, 'still there');
  assert.ok(e.saga && e.saga.exit, 'on their way');
  const x0 = e.x;
  for (let i = 0; i < 12; i++) g.update(0.25, inp);
  assert.ok(e.dead || Math.abs(e.x - x0) + Math.abs(e.z - p.z) > 2, 'walked off');
});

// ------------------------------------------------------------ fixes
test('the map\'s tier badges are drawn at every zoom close enough for them', () => {
  const s = src('ui/worldmap.js');
  assert.ok(!s.includes('if (Math.min(bw, h) < 16) return;'));
  assert.ok(s.includes('for (const d of badged) tierBadge(d);'));
});

test('armour held in the hand: no modifiers of a weapon\'s, and nothing thrown', () => {
  const g = makeGame(12345, { wg: 9 });
  const p = g.player;
  const key = starKey('iron_breastplate', 5, 'c', 0, ['sturdy', 'hale', 'fleet']);
  hold(g, key);
  let m = null;
  assert.doesNotThrow(() => {
    m = modsOf(p);
  });
  assert.ok(m && !(m.blade || []).length, 'nothing of it as a weapon');
  const inp = stubInput();
  assert.doesNotThrow(() => {
    for (let i = 0; i < 8; i++) g.update(0.1, inp);
  });
});

test('version 1.39.0', () => {
  assert.ok(compareVersions('1.39.0', GAME_VERSION) <= 0);
  assert.ok(stepsFor('1.38.0').some((q) => q.to === '1.39.0'));
});
