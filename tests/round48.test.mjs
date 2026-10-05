// Round 48: tool modifiers that only ever add to what you can do, the
// traits reworked (skills among them, plain words, flaws that never touch
// what stats give), the game's version on its worlds, and the Fallen Star.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGame, stubInput, stubUI, stubRenderer } from './helpers.mjs';
import { Game } from '../src/game/game.js';
import { B } from '../src/world/blocks.js';
import { ITEMS } from '../src/world/items.js';
import { starKey, starable, parseStar, MODS } from '../src/world/quality.js';
import { extraDigMult, toolDrops } from '../src/game/mods.js';
import {
  TRAITS, TRAIT_PICKS, normalizeHero, traitPicks, goodTraits, randomHero, ORIGINS, WING_BACK,
  hpBonus, staminaBonus, priceMult, repGainMult, stepMult, damageMult, digMult, cooldownMult, opinionBonus,
} from '../src/game/hero.js';
import { GAME_VERSION, versionText, sameVersion } from '../src/version.js';
import { metaOf } from '../src/game/saves.js';
import { refusal } from '../src/net/guest.js';
import { Relay } from '../tools/relay.mjs';
import { roll } from '../src/game/combat.js';
import { starSpot, starWary, starfallScene, STAR_IMPACT, starShockwave } from '../src/game/starfall.js';

function start(seed = 12345) {
  const game = makeGame(seed);
  const input = stubInput();
  game.minute = 10 * 60;
  for (let i = 0; i < 20; i++) game.update(0.1, input);
  return { game, input, p: game.player };
}

const hold = (p, key) => {
  p.inv[0] = { item: key, count: 1 };
  p.selected = 0;
};

// ------------------------------------------------------------ tools
test('no tool modifier digs more than you asked: Wide and Sawing are gone, replaced by ones that only add', () => {
  assert.ok(!MODS.tool.wide && !MODS.tool.sawing);
  assert.ok(MODS.tool.clean && MODS.tool.lumber);
  // Pieces from older saves read as their replacements (and still work).
  const pick = Object.keys(ITEMS).find((k) => ITEMS[k].tool === 'pick' && starable(k));
  const old = starKey(pick, 3, 'c', 600, ['wide']);
  assert.deepEqual(parseStar(old).mods, ['clean']);
  assert.ok(ITEMS[old], 'an old Wide pick still loads');
  assert.ok(ITEMS[old].name.startsWith('Clean-cutting'));
  // Clean-cutting: the extra block of a two-high dig costs nothing more;
  // a step cut, half. Without it, as ever.
  const { game, p } = start();
  hold(p, starKey(pick, 3, 'c', 600, ['clean']));
  assert.equal(extraDigMult(p, false), 0);
  assert.equal(extraDigMult(p, true), 0.5);
  hold(p, pick);
  assert.equal(extraDigMult(p, false), 1);
  // Breaking a single block with it breaks only that block.
  hold(p, starKey(pick, 3, 'c', 600, ['clean']));
  const x = p.x + 3;
  const z = p.z;
  game.world.setBlock(x, 9, z, B.stone);
  game.world.setBlock(x, 10, z, B.stone);
  game.breakBlock(x, 9, z, true);
  assert.equal(game.world.getBlock(x, 10, z), B.stone, 'the block over it is left alone');
});

test('a woodsman\'s axe gives logs (more of them), never planks', () => {
  const { game, p } = start();
  const axe = Object.keys(ITEMS).find((k) => ITEMS[k].tool === 'axe' && starable(k));
  const log = Object.keys(B).find((k) => /^log/.test(k));
  hold(p, starKey(axe, 3, 'c', 600, ['sawing']));
  const d = [{ item: log, count: 6 }];
  toolDrops(game, p, B[log], d);
  assert.equal(d[0].item, log);
  assert.equal(d[0].count, 8);
});

// ------------------------------------------------------------ traits
test('the old skills are traits now; you pick good ones, and each flaw gives one more pick', () => {
  const good = Object.keys(TRAITS).filter((k) => !TRAITS[k].flaw);
  const flaws = Object.keys(TRAITS).filter((k) => TRAITS[k].flaw);
  for (const k of ['angler', 'haggler', 'miner', 'duelist', 'marksman', 'rider', 'sailor', 'tough', 'nimble']) assert.ok(good.includes(k), k);
  assert.ok(good.length >= 33 && flaws.length >= 10, 'more of them');
  const h = normalizeHero({ traits: [] });
  assert.equal(traitPicks(h), TRAIT_PICKS);
  h.traits = [flaws[0]];
  assert.equal(traitPicks(h), TRAIT_PICKS + 1);
  h.traits = flaws.slice(0, 5);
  assert.equal(traitPicks(h), TRAIT_PICKS + 5, 'every flaw counts (round 49: no cap)');
  // An old character: skills and traits, one list.
  const o = normalizeHero({ specialties: ['angler', 'cook'], traits: ['tough', 'frail'] });
  assert.deepEqual(o.traits, ['angler', 'cook', 'tough']);
  assert.equal(goodTraits(o).length, 3);
  // A random new one has a few good traits.
  const r = randomHero(5);
  assert.ok(goodTraits(r).length >= 2 && goodTraits(r).length <= TRAIT_PICKS);
});

test('no flaw takes away anything a stat gives (health, stamina, speed, damage, digging, prices, liking)', () => {
  const base = normalizeHero({ traits: [] });
  const fns = { hpBonus, staminaBonus, priceMult, repGainMult, stepMult, damageMult, digMult, cooldownMult, opinionBonus };
  for (const k of Object.keys(TRAITS).filter((q) => TRAITS[q].flaw)) {
    const h = normalizeHero({ traits: [k] });
    for (const [name, f] of Object.entries(fns)) assert.equal(f(h), f(base), `${k} changes ${name}`);
  }
});

test('trait descriptions are plain: they say what changes, in numbers where there are any', () => {
  for (const [k, t] of Object.entries(TRAITS)) {
    assert.ok(t.about && t.about.length < 140, k);
    assert.ok(!/[()]/.test(t.about), `${k}: no asides in brackets`);
    assert.ok(!/stat point/i.test(t.about), `${k}: flaws don't trade for stat points`);
  }
});

// ------------------------------------------------------------ versions
test('every save says which version of the game it was made in', () => {
  const { game } = start();
  assert.match(GAME_VERSION, /^\d+\.\d+\.\d+$/);
  assert.equal(game.serialize().gv, GAME_VERSION);
  assert.equal(metaOf(game).gv, GAME_VERSION);
  assert.ok(sameVersion(GAME_VERSION));
  assert.ok(!sameVersion('0.1.0'));
  assert.equal(versionText(undefined), 'an older version');
});

test('a player on another version is turned away from a world, and told why', () => {
  const relay = new Relay({ port: 0, addrs: () => ['10.0.0.5'] });
  relay.host = { sock: { open: true, send() {} }, account: { id: 'h', name: 'Hosty' } };
  relay.world = { name: 'Elsewhere', gv: '0.47.0' };
  const sent = [];
  const sock = { ip: '10.0.0.9', open: true, json: (m) => sent.push(m), close() {}, send() {} };
  relay.guestHello(sock, { id: 'g', name: 'Guesty' }, { gv: GAME_VERSION });
  assert.equal(sent[0].t, 'refused');
  assert.equal(sent[0].why, 'gameversion');
  assert.equal(sent[0].host, '0.47.0');
  const text = refusal('gameversion', sent[0]);
  assert.ok(/0\.47\.0/.test(text) && text.includes(GAME_VERSION) && /can't join/.test(text));
  // The same version: in.
  const ok = [];
  relay.world.gv = GAME_VERSION;
  relay.guestHello({ ...sock, json: (m) => ok.push(m) }, { id: 'g2', name: 'Other' }, { gv: GAME_VERSION });
  assert.ok(!ok.some((m) => m.t === 'refused'));
});

// ------------------------------------------------------------ the fallen star
function starGame(seed = 12345) {
  const hero = normalizeHero({ ...randomHero(3), origin: 'star', name: 'Lumen' });
  const game = new Game({ seed, renderer: stubRenderer(), audio: null, ui: stubUI(), hero, intro: false });
  return { game, p: game.player };
}

test('a fallen star wakes in a scorched crater by a village on Thessa, with a wing', () => {
  assert.ok(ORIGINS.star);
  const { game, p } = starGame();
  assert.ok(game.starAt && game.starAt.village, 'by a village');
  const ow = game.world.ow;
  assert.equal(ow.islandAt(p.x, p.z), ow.islands[0].key, 'on Thessa');
  assert.ok(!ow.settlementAt(p.x, p.z), 'out of the village itself');
  let burnt = 0;
  for (let dz = -2; dz <= 2; dz++) {
    for (let dx = -2; dx <= 2; dx++) {
      const y = game.world.findStandY(game.starAt.x + dx, game.starAt.z + dz, 10);
      const id = game.world.getBlock(game.starAt.x + dx, y - 1, game.starAt.z + dz);
      if (id === B.scorched || id === B.ash) burnt++;
    }
  }
  assert.ok(burnt >= 8, 'scorched ground about you');
  assert.ok(p.wing && p.wing.k === 1, 'the wing, whole');
  assert.ok(game.ui.msgs.some((m) => /crater/.test(m)));
});

test('the wing carries you through a second roll without stamina, then grows back', () => {
  const { game, p } = starGame();
  const input = stubInput();
  for (let i = 0; i < 5; i++) game.update(0.1, input);
  p.stamina = 100;
  p.rollCd = 0;
  assert.ok(roll(game, p, [1, 0]), 'the first roll');
  const after1 = p.stamina;
  assert.ok(after1 < 100, 'it costs stamina');
  // Straight after (the roll done, the cooldown not): only the wing can.
  p.rollT = 0;
  assert.ok(p.rollCd > 0);
  assert.ok(roll(game, p, [0, 1]), 'the second roll, on the wing');
  assert.equal(p.stamina, after1, 'no stamina for it');
  assert.equal(p.wing.k, 0, 'the wing spent');
  // A third: the wing is spent, so no.
  p.rollT = 0;
  assert.ok(!roll(game, p, [1, 0]));
  // It comes back over WING_BACK seconds.
  for (let t = 0; t < WING_BACK / 2; t += 0.5) p.update(0.5, input, true);
  assert.ok(p.wing.k > 0.3 && p.wing.k < 1, 'growing back');
  for (let t = 0; t < WING_BACK; t += 0.5) p.update(0.5, input, true);
  assert.equal(p.wing.k, 1, 'whole again');
  // Without the wing, a roll in the cooldown is refused, as ever.
  const { game: g2, p: p2 } = start();
  p2.stamina = 100;
  p2.rollCd = 0;
  roll(g2, p2, [1, 0]);
  p2.rollT = 0;
  assert.ok(!roll(g2, p2, [0, 1]));
});

test('some townsfolk are wary of a fallen star; they talk about the wing', () => {
  const { game } = starGame();
  const s = game.world.ow.settlements.find((q) => q.id === game.starAt.sid);
  const L = game.sim.layoutOf(s.id);
  game.loadAround(L.plaza.cx, L.plaza.cz, true);
  game.updateSettlements(true);
  const folk = game.npcs.filter((n) => n.settlement && n.settlement.id === s.id && n.rec);
  assert.ok(folk.length > 2);
  const wary = folk.filter((n) => starWary(n.rec, s.id));
  const easy = folk.filter((n) => !starWary(n.rec, s.id));
  assert.ok(wary.length && easy.length, 'some, not all');
  // Wary of you: their opinion of you is lower than it would be.
  const n = wary[0];
  const v = game.sim.opinion(n);
  const was = game.hero.origin;
  game.hero.origin = 'crash';
  const v0 = game.sim.opinion(n);
  game.hero.origin = was;
  assert.equal(v, Math.max(-100, v0 - 12));
});

test('the falling: a painted scene, the strike felt by everyone else on Thessa', () => {
  const { game } = start();
  // Another player on Thessa when a star comes down by them.
  game.startParty({ id: 'h', name: 'Hosty' });
  const hero = normalizeHero({ ...randomHero(4), origin: 'star', name: 'Vega' });
  const seat = game.addSeat({ id: 's1', name: 'Vega' }, { ui: stubUI(), input: stubInput(), hero });
  const sc = game.asPlayer(seat.ent, () => game.scene);
  assert.ok(sc && sc.kind === 'starfall' && sc.lock, 'the newcomer sees their fall');
  assert.ok(seat.ent.wing, 'with a wing');
  // Played on to the strike, as the host plays it for them.
  const hostMsgs = game.ui.msgs.length;
  game.asPlayer(seat.ent, () => {
    sc.t = STAR_IMPACT - 0.01;
    game.sceneTick(0.05, []);
  });
  assert.ok(sc.struck);
  assert.ok(game.starShock, 'handed on to the world');
  game.update(0.05, stubInput());
  assert.ok(!game.starShock);
  assert.ok(game.ui.msgs.length > hostMsgs && /star/i.test(game.ui.msgs.at(-1)), 'the host is told');
  assert.ok((game.shake || 0) > 0.4, 'and shaken');
  // The scene skipped: on to waking, told where.
  const s2 = starfallScene(game, { village: 'Ashby', first: 'Vega' });
  s2.update(game, 0.1, [{ code: 'Enter' }]);
  assert.ok(s2.struck && s2.t >= s2.dur);
});

test('the shockwave reaches only those on the same island', () => {
  const { game } = start();
  const p = game.player;
  const msgs = game.ui.msgs.length;
  // Struck far away, on another island (if there is one): not felt.
  const ow = game.world.ow;
  const other = ow.islands.find((I) => I.key !== ow.islandAt(p.x, p.z));
  if (other) {
    starShockwave(game, { x: Math.floor(other.x), z: Math.floor(other.z), y: 10, who: null });
    assert.equal(game.ui.msgs.length, msgs);
  }
  starShockwave(game, { x: p.x + 40, z: p.z, y: p.y, who: null });
  assert.ok(game.ui.msgs.length > msgs);
  assert.ok(/to the east/.test(game.ui.msgs.at(-1)));
  assert.ok(starSpot(game, 7), 'a place to land');
});
