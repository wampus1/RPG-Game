// Round 132: gear won the hard way. Found gear rarer and humbler (the old
// places' loot by their depth, a master's one piece, or two off the
// greatest), and the masters leaving one or two of the old places' own
// materials, rarer the greater the master. Made gear worked by hand at the
// forge (heat, hammer, quench; at the bench, the bowyer's and the cutting
// table, their own work), its stars how well it was done, no more than your
// Smithing allows; additives with natures you learn by working them,
// leaning its modifiers, now and then one working only at some times, and
// flaws for a botched job; patterns, casts poured again and again; reforging
// that keeps a piece's stars; tempering for one more; steel for a smith of
// some skill; and a town's blacksmith taking commissions.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGame, stubUI } from './helpers.mjs';
import { RNG } from '../src/util/rng.js';
import { ITEMS } from '../src/world/items.js';
import { RECIPES } from '../src/world/recipes.js';
import { rollStars, parseStar, modOf, gearClass, starKey } from '../src/world/quality.js';
import { lootTier } from '../src/world/dungeongen.js';
import { bossMaterials, chestMaterial, MATERIALS, rarityOf } from '../src/world/smithmats.js';
import { forgeKind, masteryCap, materialCap, starsFor, qualityOf, forgePiece, forgeCfg, forgeResult, writePattern, pressCast, recipeFor, STAGES } from '../src/game/smithing.js';
import { reforgeKey } from '../src/game/reforge.js';
import { hasMod } from '../src/game/mods.js';
import { smithTopics, smithRespond } from '../src/game/smithtalk.js';
import { ForgeWindow } from '../src/ui/forgewin.js';
import { CraftWindow } from '../src/ui/windows.js';
import { countItem } from '../src/game/inventory.js';
import { GAME_VERSION, compareVersions } from '../src/version.js';
import { stepsFor } from '../src/game/migrate.js';

const world = () => makeGame(12345, { wg: 9 });
const R = (out, station = null) => RECIPES.find((r) => r.out === out && (!station || r.station === station));
const rankTo = (g, n) => {
  ((g.stats ||= {}).mastery ||= {}).smithing = [0, 0, 3, 8, 15, 25, 40, 60, 85, 115, 150][n];
};
const fill = (g, list) => {
  g.player.inv.fill(null);
  for (const [k, n] of list) g.player.give(k, n);
};
const SWORD = [['iron_ingot', 12], ['stick', 6], ['leather', 6], ['coin', 900]];

test('the old places\' loot: humbler, by depth; a master\'s gear and its materials', () => {
  // (A time crystal's tier adds half a step of depth, not a whole one.)
  assert.equal(lootTier({ level: 1, tier: 3 }, 2), 3);
  const rng = new RNG(4);
  const hist = (o) => {
    const h = [0, 0, 0, 0, 0, 0];
    for (let i = 0; i < 4000; i++) h[rollStars(rng, { origin: 'd', ...o })]++;
    return h;
  };
  const home = hist({ tier: 1 });
  assert.equal(home[4] + home[5], 0, 'a home chest never gives four stars');
  assert.ok(home[1] > home[2] && home[2] > home[3], 'one star the commonest');
  assert.ok(home[3] / 4000 < 0.12, 'three stars rare');
  const boss = hist({ tier: 2, boss: true });
  assert.equal(boss[1] + boss[4] + boss[5], 0, 'a master\'s own piece: two or three stars at home');
  // Masters leave one or two materials, rarer off the greater ones.
  const rarities = (tier) => {
    const n = { uncommon: 0, rare: 0, vrare: 0 };
    let count = 0;
    for (let i = 0; i < 600; i++) {
      const got = bossMaterials(tier, rng);
      assert.ok(got.length >= 1 && got.length <= 2);
      count += got.length;
      for (const k of got) {
        assert.ok(MATERIALS[k] && ITEMS[k], k);
        n[rarityOf(k)]++;
      }
    }
    return { ...n, count };
  };
  const t1 = rarities(1);
  const t4 = rarities(4);
  assert.equal(t1.vrare, 0, 'nothing very rare off a lesser master');
  assert.ok(t1.uncommon > t1.rare * 4);
  assert.ok(t4.vrare > 0 && t4.rare > t4.uncommon, 'the greatest masters leave the rarest');
  assert.ok(t1.count > 600 && t1.count < 1200);
  // Deep chests now and then hold a material; shallow ones never.
  assert.equal(chestMaterial(1, rng), null);
  let got = 0;
  for (let i = 0; i < 2000; i++) if (chestMaterial(4, rng)) got++;
  assert.ok(got > 50 && got < 600, `deep chests sometimes (${got})`);
});

test('each piece is worked at the forge it belongs to; dyes and the rest as ever', () => {
  assert.equal(forgeKind(R('iron_sword', 'anvil')), 'forge');
  assert.equal(forgeKind(R('wood_sword')), 'carve');
  assert.equal(forgeKind(R('bow')), 'bow');
  assert.equal(forgeKind(R('leather_tunic')), 'stitch');
  assert.equal(forgeKind(R('fine_coat', 'tailor')), 'stitch', 'a coat with a little gold in it is still stitched');
  assert.equal(forgeKind(R('wool_hood_red')), null, 'a dye: no forge');
  assert.equal(forgeKind(R('planks')), null);
  assert.deepEqual(STAGES.forge, ['heat', 'hammer', 'quench']);
  // The caps: your rank, and what it's made of.
  assert.deepEqual([1, 2, 3, 5, 6, 8, 9, 10].map(masteryCap), [2, 2, 3, 3, 4, 4, 5, 5]);
  assert.equal(materialCap(R('wood_sword')), 3);
  assert.equal(materialCap(R('iron_sword', 'anvil')), 4);
  assert.equal(materialCap(R('iron_sword', 'anvil'), ['star_iron']), 5);
  assert.deepEqual([0.1, 0.4, 0.6, 0.8, 0.95].map(starsFor), [1, 2, 3, 4, 5]);
  assert.ok(Math.abs(qualityOf([1, 0, 1], 'forge') - 2 / 3.4) < 1e-9, 'the hammer counts a little more');
});

test('crafting a piece at a bench opens the forge, never stars on the spot', () => {
  const g = world();
  fill(g, SWORD);
  const ui = { ...stubUI(), game: g, opened: [], open(w) { this.opened.push(w); }, msg() {} };
  const cw = new CraftWindow(ui, 'anvil');
  const r = R('iron_sword', 'anvil');
  assert.equal(cw.craft(r, g, 5), 0);
  assert.equal(ui.opened.length, 1);
  assert.ok(ui.opened[0] instanceof ForgeWindow);
  assert.equal(ui.opened[0].forge.kind, 'forge');
  assert.equal(countItem(g.player.inv, 'iron_ingot'), 12, 'nothing spent till the work\'s done');
  // "Craft all" passes the forge's work by (anything else it makes).
  cw.craftAll(g);
  assert.ok(!g.player.inv.some((s) => s && ITEMS[s.item] && (ITEMS[s.item].stars || forgeKind(RECIPES.find((q) => q.out === s.item)))));
  // Steel wants a smith of some skill.
  fill(g, [['iron_ingot', 4], ['coal', 6]]);
  const st = R('steel_ingot');
  assert.equal(st.rank, 4);
  const fw = new CraftWindow(ui, 'furnace');
  assert.equal(fw.craft(st, g, 1), 0);
  assert.equal(countItem(g.player.inv, 'steel_ingot'), 0);
  rankTo(g, 4);
  assert.equal(fw.craft(st, g, 1), 1);
  assert.equal(countItem(g.player.inv, 'steel_ingot'), 1);
});

test('the work done well or badly: its stars, as your rank and its makings allow', () => {
  const g = world();
  const r = R('iron_sword', 'anvil');
  fill(g, SWORD);
  const res = forgeResult(g, forgeCfg(g, r), { scores: [1, 1, 1] }, new RNG(1));
  assert.ok(res.ok);
  assert.equal(res.stars, 2, 'a beginner\'s best: two stars');
  assert.equal(countItem(g.player.inv, 'iron_ingot'), 12 - r.in.iron_ingot, 'the makings spent');
  assert.ok(g.stats.mastery.smithing > 0, 'Smithing comes on');
  // A master: four from iron alone, five with a rare material in it.
  rankTo(g, 10);
  fill(g, [...SWORD, ['star_iron', 1]]);
  assert.equal(forgeResult(g, forgeCfg(g, r), { scores: [1, 1, 1] }, new RNG(2)).stars, 4);
  const five = forgeResult(g, forgeCfg(g, r), { scores: [1, 1, 1], adds: ['star_iron'] }, new RNG(3));
  assert.equal(five.stars, 5);
  assert.equal(countItem(g.player.inv, 'star_iron'), 0);
  assert.ok(five.learned.some((l) => l.name === 'Star Iron'), 'what star iron is, learnt');
  // Botched: one star, and often a flaw.
  let flawed = 0;
  for (let i = 0; i < 60; i++) {
    const p = forgePiece('iron_sword', 0.05, [], 10, new RNG(100 + i), { cap: 4 });
    assert.equal(p.stars, 1);
    if (p.flaws.length) flawed++;
  }
  assert.ok(flawed > 20, `flaws come of a botched job (${flawed})`);
  const dull = ITEMS[starKey('iron_sword', 1, 'c', 0, ['dull'])];
  const plain = ITEMS[starKey('iron_sword', 1, 'c', 0, [])];
  assert.ok(dull.damage < plain.damage, 'a dull blade hits lighter');
  assert.ok(modOf('blade', 'dull').flaw);
});

test('additives lean what a piece comes out with, and one may work only at night', () => {
  const count = (adds, want) => {
    let n = 0;
    for (let i = 0; i < 300; i++) if (forgePiece('iron_sword', 0.95, adds, 10, new RNG(i), { cap: 5 }).mods.some((m) => m.startsWith(want))) n++;
    return n;
  };
  assert.ok(count(['ember_pod'], 'searing') > count([], 'searing') * 2, 'an ember pod leans toward searing');
  // (Round 137: of the night is a trigger now, "dusk": what it wakes works
  // all night.)
  let night = null;
  for (let i = 0; i < 200 && !night; i++) night = forgePiece('iron_sword', 0.95, ['grave_iron'], 10, new RNG(i), { cap: 5 }).mods.find((m) => m.endsWith('-dusk') && !m.startsWith('shade'));
  assert.ok(night, 'grave iron gives a modifier of the night');
  const d = modOf('blade', night);
  assert.equal(d.cond, 'dusk');
  assert.match(d.about, /night/);
  // It works only after dark.
  const g = world();
  const key = starKey('iron_sword', 3, 'c', 0, [night]);
  const e = { kind: 'player', heldItem: () => key, equip: {}, game: g, hp: 10, maxHp: 10 };
  const m = night.split('-')[0];
  g.isDay = () => true;
  assert.equal(hasMod(e, 'blade', m), false);
  g.isDay = () => false;
  assert.equal(hasMod(e, 'blade', m), true);
});

test('reforging keeps its stars; tempering adds one, with a rare material', () => {
  // (The old way gave a star now and then: no more.)
  let k = starKey('iron_sword', 2, 'd', 0, ['keen']);
  for (let i = 0; i < 60; i++) k = reforgeKey(k, new RNG(i));
  assert.equal(parseStar(k).stars, 2);
  const g = world();
  rankTo(g, 6);
  const piece = starKey('iron_sword', 3, 'd', 5, ['dull']);
  fill(g, [['iron_ingot', 2], ['coin', 300], [piece, 1], ['drake_scale', 2]]);
  const slot = () => g.player.inv.findIndex((s) => s && s.item.startsWith('iron_sword~'));
  const rf = forgeResult(g, forgeCfg(g, null, { mode: 'reforge', slot: slot() }), { scores: [1, 1] }, new RNG(9));
  assert.ok(rf.ok);
  const after = parseStar(rf.key);
  assert.equal(after.stars, 3, 'its stars kept');
  assert.ok(!after.mods.includes('dull'), 'its flaw beaten out');
  assert.equal(countItem(g.player.inv, 'coin'), 300 - (20 + 3 * 15));
  const tp = forgeResult(g, forgeCfg(g, null, { mode: 'temper', slot: slot() }), { scores: [1, 1], adds: ['drake_scale'] }, new RNG(10));
  assert.ok(tp.ok && !tp.failed);
  assert.equal(parseStar(tp.key).stars, 4, 'a star more');
  assert.equal(countItem(g.player.inv, 'drake_scale'), 1);
  // Not past what your rank allows (four, at rank 6): the material's spent.
  const no = forgeResult(g, forgeCfg(g, null, { mode: 'temper', slot: slot() }), { scores: [1, 1], adds: ['drake_scale'] }, new RNG(11));
  assert.ok(no.failed);
  assert.equal(parseStar(g.player.inv[slot()].item).stars, 4);
  assert.equal(countItem(g.player.inv, 'drake_scale'), 0);
});

test('a pattern written down, and a cast poured again and again, exactly', () => {
  const g = world();
  rankTo(g, 10);
  const r = R('iron_sword', 'anvil');
  fill(g, [...SWORD, ['scroll', 1], ['blank_cast', 1], ['relic_shard', 3], ['ember_pod', 2]]);
  const made = forgeResult(g, forgeCfg(g, r), { scores: [1, 1, 1], adds: ['ember_pod'] }, new RNG(21));
  const pat = writePattern(g, made.key, ['ember_pod']);
  assert.ok(pat.ok);
  assert.equal(countItem(g.player.inv, 'scroll'), 0);
  assert.ok(ITEMS[pat.key].pattern);
  // Forged from the pattern: its modifiers, its additive taken.
  const cfg = forgeCfg(g, r);
  assert.equal(cfg.patterns.length, 1);
  const again = forgeResult(g, cfg, { scores: [0.6, 0.6, 0.6], pattern: pat.key }, new RNG(22));
  assert.deepEqual(parseStar(again.key).mods.filter((m) => !modOf('blade', m).flaw), parseStar(made.key).mods.filter((m) => !modOf('blade', m).flaw));
  assert.equal(countItem(g.player.inv, 'ember_pod'), 0, 'the pattern\'s additive used');
  // The cast: a blank used, the piece kept; poured, copies exactly as it was.
  const press = pressCast(g, made.key);
  assert.ok(press.ok);
  assert.equal(countItem(g.player.inv, 'blank_cast'), 0);
  assert.equal(countItem(g.player.inv, made.key), 1);
  assert.ok(!pressCast(g, starKey('iron_sword', 3, 'd', 0, [])).ok, 'only a piece forged by hand');
  assert.equal(recipeFor('iron_sword').out, 'iron_sword');
  const pour = forgeCfg(g, r, { mode: 'cast', cast: press.key, times: 2 });
  assert.deepEqual(pour.stages, ['pour']);
  const out = forgeResult(g, pour, { scores: [0.2] }, new RNG(23));
  assert.ok(out.ok);
  assert.equal(out.made, 2);
  assert.equal(countItem(g.player.inv, made.key), 3, 'two copies, exactly the piece');
  assert.equal(countItem(g.player.inv, 'relic_shard'), 1, 'a relic shard each');
  const four = forgeResult(g, forgeCfg(g, r, { mode: 'cast', cast: press.key, times: 2 }), { scores: [1] }, new RNG(24));
  assert.ok(!four.ok, 'not without the shards');
  // A blank cast: a very rare material at its heart.
  const blank = RECIPES.filter((q) => q.out === 'blank_cast');
  assert.ok(blank.length >= 3 && blank.every((q) => Object.keys(q.in).some((k) => rarityOf(k) === 'vrare')));
});

test('the forge\'s window: played on a guest\'s screen, worked out at the host', () => {
  const g = world();
  fill(g, SWORD);
  const r = R('iron_sword', 'anvil');
  const cfg = forgeCfg(g, r);
  // The guest's own screen: each stage played, what came of it sent on.
  const gui = { ...stubUI(), game: null, forward: [], msg() {} };
  const w = new ForgeWindow(gui, JSON.parse(JSON.stringify(cfg)), { mirror: true });
  assert.equal(w.phase, 'prep');
  w.prepGo();
  for (let i = 0; i < cfg.stages.length; i++) {
    assert.equal(w.phase, 'intro');
    w.begin();
    w.play.finish(0.9);
    w.update(1 / 60);
    assert.equal(w.phase, 'between');
    for (let f = 0; f < 90; f++) w.update(1 / 60);
  }
  assert.equal(w.phase, 'wait');
  const sent = gui.forward.find((f) => f.code === 'ForgeAct');
  assert.ok(sent);
  // The host's window: it only waits to hear.
  const hui = { ...stubUI(), game: g, remoteSeat: 2, msg() {} };
  const h = new ForgeWindow(hui, cfg);
  assert.ok(h.passive);
  h.onKey(sent);
  assert.ok(cfg.reply && cfg.reply.ok, 'the piece made, at the host');
  assert.ok(g.player.inv.some((s) => s && s.item.startsWith('iron_sword~')));
  h.onKey(sent);
  assert.equal(g.player.inv.filter((s) => s && s.item.startsWith('iron_sword~')).length, 1, 'not twice');
  // Back on the guest's screen, it's shown.
  w.forge.reply = cfg.reply;
  w.update(1 / 60);
  assert.equal(w.phase, 'reveal');
});

test('a town\'s blacksmith takes a commission, ready the next day', () => {
  const g = world();
  fill(g, [['coin', 2000]]);
  const smith = (type) => ({ rec: { job: 'blacksmith', idx: 4 }, settlement: { id: 900 + type.length, type } });
  const npc = smith('city');
  assert.equal(smithTopics(npc, g)[0].id, 'sm_order');
  const menu = smithRespond(npc, g, 'sm_order');
  assert.ok(menu.choices.length >= 4);
  const pick = menu.choices[0];
  const before = countItem(g.player.inv, 'coin');
  smithRespond(npc, g, 'sm_order', pick.arg);
  assert.ok(countItem(g.player.inv, 'coin') < before, 'paid up front');
  assert.equal(smithTopics(npc, g)[0].id, 'sm_collect');
  assert.match(smithRespond(npc, g, 'sm_collect').lines[0], /Tomorrow/);
  g.day += 1;
  smithRespond(npc, g, 'sm_collect');
  const got = g.player.inv.find((s) => s && s.item.startsWith(`${pick.arg}~`));
  assert.ok(got, 'collected');
  const st = ITEMS[got.item].stars;
  assert.ok(st >= 3 && st <= 4, 'a city smith\'s work: three or four stars');
  assert.ok(!(ITEMS[got.item].mods || []).some((m) => modOf(gearClass(ITEMS[pick.arg]), m).flaw), 'no flaws out of the shop');
  assert.equal(smithTopics(npc, g)[0].id, 'sm_order');
  // A village smith's: two.
  const v = smith('village');
  const m2 = smithRespond(v, g, 'sm_order');
  smithRespond(v, g, 'sm_order', m2.choices[0].arg);
  g.day += 1;
  smithRespond(v, g, 'sm_collect');
  assert.ok(g.player.inv.some((s) => s && ITEMS[s.item] && ITEMS[s.item].stars === 2 && s.item.startsWith(`${m2.choices[0].arg}~`)));
});

test('version 1.32.0, and the forge\'s ways explained to an older world', () => {
  assert.ok(compareVersions('1.32.0', GAME_VERSION) <= 0);
  const s = stepsFor('1.31.0').find((q) => q.to === '1.32.0');
  assert.ok(s && s.game);
  const g = world();
  const log = [];
  s.game(g, log);
  assert.ok(log.length && g.stats.smithKnown);
});
