// Round 49: fights and masters darker, each with instruments of its own,
// and every scene its own music; as many flaws as you like; achievements
// that unlock the titles you go by (none to begin with); worlds from an
// older version brought up to this one; openings painted, for everyone in
// a world with others too, kept out of the world till they're done; and a
// smaller wing.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGame, stubInput, stubRenderer, stubUI } from './helpers.mjs';
import { Game } from '../src/game/game.js';
import { THEMES } from '../src/game/music.js';
import { PATCH, LOUD } from '../src/game/synth.js';
import { KITS } from '../src/game/compose.js';
import { TRAITS, TRAIT_PICKS, traitPicks, normalizeHero, randomHero, goodTraits } from '../src/game/hero.js';
import { WING_SIZE } from '../src/render/wing.js';
import { FEATS, FEAT, FeatBook, newFeats, titlesOf } from '../src/game/achievements.js';
import { Accounts, TITLES, cleanTitle } from '../src/net/account.js';
import { GAME_VERSION, compareVersions, canUpgrade } from '../src/version.js';
import { SaveStore } from '../src/game/saves.js';
import { homeScene, homeInfo, wreckScene, wreckInfo, introFrom, WRECK } from '../src/game/intros.js';
import { spireOpening, bossDefeat } from '../src/game/scenes.js';
import { eruptionScene } from '../src/game/eruption.js';
import { wallFall } from '../src/game/wallfall.js';
import { starfallScene } from '../src/game/starfall.js';
import { HostNet } from '../src/net/host.js';
import { siteBlocks } from '../src/world/sites.js';
import { REGION_W, REGION_D } from '../src/config.js';

const memStore = () => {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
};

function start(seed = 12345) {
  const game = makeGame(seed);
  const input = stubInput();
  game.minute = 10 * 60;
  for (let i = 0; i < 20; i++) game.update(0.1, input);
  return { game, input, p: game.player };
}

const heroGame = (seed, origin) => new Game({ seed, renderer: stubRenderer(), audio: null, ui: stubUI(), hero: { ...randomHero(seed), origin }, intro: true });

// ------------------------------------------------------------ the music
const FIGHTS = ['fight_beasts', 'fight_monsters', 'fight_guards', 'fight_bandits', 'fight_boss', 'fight_kharos', 'fight_myrrow', 'fight_kavorent'];
const MASTERS = Object.keys(THEMES).filter((k) => THEMES[k].grand && k !== 'tempest');

test('each kind of fight leads with an instrument of its own, and none of them is bright', () => {
  const leads = FIGHTS.map((k) => THEMES[k].lead);
  assert.equal(new Set(leads).size, leads.length, `every fight its own lead (${leads.join(', ')})`);
  for (const k of ['fight_beasts', 'fight_monsters', 'fight_guards', 'fight_bandits']) {
    const T = THEMES[k];
    assert.ok(!['major', 'mixo', 'lydian', 'penta', 'dorian'].includes(T.scale), `${k}: a dark mode (${T.scale})`);
    assert.ok(!['pluck', 'bell', 'kalimba', 'marimba', 'steel'].includes(T.arp), `${k}: nothing twinkling (${T.arp})`);
    assert.ok(T.mood === 'dark', k);
    assert.ok((T.leadEnergy ?? T.energy) < T.energy, `${k}: the tune moves slower than the drive under it`);
    assert.ok(!KITS[T.kit].shaker && !KITS[T.kit].hat, `${k}: no bright shaker or hats (${T.kit})`);
  }
  // The new instruments, each a real one with a level.
  for (const p of ['cello', 'dist', 'chant', 'screech', 'warhorn', 'braam', 'reese', 'twang', 'crushed', 'abyss', 'didge']) assert.ok(PATCH[p] && LOUD[p], p);
  assert.ok(KITS.hunt && !KITS.hunt.snare, 'the hunt still has no snare');
});

test('masters\' music: dark, heavy, a wall of brass (or their own) for stabs, no plucked or belled arps', () => {
  assert.ok(MASTERS.length >= 8);
  for (const k of MASTERS) {
    const T = THEMES[k];
    assert.ok(!['pluck', 'kalimba', 'marimba', 'koto', 'bell'].includes(T.arp), `${k}: ${T.arp}`);
    assert.ok(PATCH[T.stab || 'braam'], `${k}: stab ${T.stab}`);
    assert.ok(!['major', 'mixo', 'lydian', 'penta', 'dorian'].includes(T.scale), `${k}: ${T.scale}`);
  }
  const leads = MASTERS.map((k) => THEMES[k].lead);
  assert.ok(new Set(leads).size >= 7, `their leads differ (${leads.join(', ')})`);
});

test('every scene has music of its own, heard nowhere else', () => {
  const g = start().game;
  const moods = new Set();
  const mood = (sc, t) => {
    sc.t = t;
    return sc.mood;
  };
  const rec = g.sim.dungeons.all.find((d) => d.type === 'kavorent');
  moods.add(mood(spireOpening(g, rec, 0, '#ff0000'), 1));
  moods.add(mood(eruptionScene(g, { here: true }), 1));
  const wall = wallFall(g);
  moods.add(mood(wall, 1));
  moods.add(mood(wall, 14));
  const star = starfallScene(g, { village: 'Ashby', first: 'Vega' });
  moods.add(mood(star, 1));
  moods.add(mood(star, 20));
  moods.add(bossDefeat(g, { rec: { type: 'barrow' } }, { x: 0, y: 0, z: 0, species: 'x' }).mood);
  for (const m of moods) {
    assert.ok(m && m.startsWith('cs_') && THEMES[m], `${m}`);
  }
  assert.ok(moods.size >= 7, 'all different');
  // Each opening's its own instrument, played by no theme but its own.
  const elsewhere = (inst, own) => Object.entries(THEMES).some(([k, T]) => !k.startsWith('cs_') && k !== own && ['lead', 'counter', 'keys', 'arp', 'pad'].some((r) => T[r] === inst));
  assert.ok(!elsewhere('celesta') && THEMES.cs_starfall.lead === 'celesta');
  assert.ok(!elsewhere('dulcimer') && THEMES.cs_home.lead === 'dulcimer');
  assert.ok(!elsewhere('fiddle') && THEMES.cs_voyage.lead === 'fiddle');
  assert.ok(!elsewhere('theremin') && THEMES.cs_spire.lead === 'theremin');
});

// ------------------------------------------------------------ flaws, the wing
test('as many flaws as you like: each one another good pick', () => {
  const flaws = Object.keys(TRAITS).filter((k) => TRAITS[k].flaw);
  const good = Object.keys(TRAITS).filter((k) => !TRAITS[k].flaw);
  const h = normalizeHero({ traits: [...good.slice(0, TRAIT_PICKS + 6), ...flaws.slice(0, 6)] });
  assert.equal(h.traits.filter((k) => TRAITS[k].flaw).length, 6, 'all six kept');
  assert.equal(traitPicks(h), TRAIT_PICKS + 6);
  assert.equal(goodTraits(h).length, TRAIT_PICKS + 6);
});

test('the fallen star\'s wing is smaller', () => {
  assert.ok(WING_SIZE < 22 && WING_SIZE >= 12, `${WING_SIZE}`);
});

// ------------------------------------------------------------ achievements
test('achievements: each unlocks a title of its own; every title starts locked', () => {
  const titles = FEATS.map((f) => f.title);
  assert.equal(new Set(titles).size, titles.length);
  assert.deepEqual(TITLES, ['', ...titles]);
  for (const f of FEATS) assert.ok(f.name && f.about && typeof f.test === 'function', f.id);
  // A new account goes by nothing, and can't pick what it hasn't earned.
  const a = new Accounts(memStore());
  a.create('Wren', {}, 'Hi.', 'Knight');
  assert.equal(a.profile.title, '');
  assert.deepEqual(a.titles(), []);
  a.update({ title: 'Knight' });
  assert.equal(a.profile.title, '');
  // Earned: it can.
  const book = new FeatBook(memStore(), a);
  assert.ok(book.unlock('knight'));
  assert.ok(!book.unlock('knight'), 'once');
  assert.deepEqual(a.titles(), ['Knight']);
  a.update({ title: 'Knight' });
  assert.equal(a.profile.title, 'Knight');
  assert.equal(cleanTitle('Knight'), 'Knight');
  // An old account going by a title it never earned: none, now.
  const st = memStore();
  st.setItem('tessera-account-v1', JSON.stringify({ id: 'x', name: 'Oldie', title: 'Bard', friends: [] }));
  assert.equal(new Accounts(st).profile.title, '');
  // Earned before the account was made: brought along when it is.
  const st2 = memStore();
  const b = new Accounts(st2);
  const early = new FeatBook(st2, b);
  early.unlock('miner');
  b.localFeats = () => early.local;
  b.create('Late', {}, '', 'Miner');
  assert.equal(b.profile.title, 'Miner');
  assert.deepEqual(titlesOf(b.account.feats), ['Miner']);
  // (And they go with the account's code.)
  const c = new Accounts(memStore());
  c.importCode(b.exportCode());
  assert.equal(c.profile.title, 'Miner');
});

test('achievements are seen as they\'re done: your own kept here, someone else\'s sent to their screen', () => {
  const { game, input } = start();
  const book = new FeatBook(memStore(), null);
  const said = [];
  game.featBook = book;
  game.onFeat = (id) => said.push(id);
  game.stats.mined = 500;
  game.stats.kills = 30;
  game.checkFeats();
  assert.ok(book.has('miner') && book.has('hunter') && book.has('begun'));
  assert.ok(!book.has('slayer'));
  assert.ok(said.includes('miner'));
  // Not twice.
  said.length = 0;
  game.checkFeats();
  assert.equal(said.length, 0);
  // Not while an opening plays (nothing's been done yet).
  const fresh = new FeatBook(memStore(), null);
  game.featBook = fresh;
  game.player.limbo = true;
  game.checkFeats();
  assert.ok(!fresh.has('miner'));
  game.player.limbo = false;
  // Someone else in your world: theirs, sent to them (once).
  game.startParty({ id: 'h', name: 'Hosty' });
  const seat = game.addSeat({ id: 'g', name: 'Guesty' }, { ui: stubUI(), input: stubInput(), hero: null });
  const sent = [];
  game.net = { feat: (s, id) => sent.push([s.id, id]), afterUpdate() {}, mute: 0 };
  game.asPlayer(seat.ent, () => {
    game.stats.placed = 250;
  });
  game.checkFeats();
  game.checkFeats();
  assert.ok(sent.some(([s, id]) => s === 'g' && id === 'builder'));
  assert.equal(sent.filter(([, id]) => id === 'builder').length, 1);
  assert.ok(!fresh.has('builder'), 'not the host\'s');
  game.net = null;
  for (let i = 0; i < 3; i++) game.update(0.1, input);
  // The host's code sends it to the right player's screen.
  const out = [];
  const net = Object.create(HostNet.prototype);
  net.guests = new Map([[1, { state: 'in', seat, cid: 7 }]]);
  net.to = (g, m) => out.push([g.cid, m]);
  net.feat(seat, 'builder');
  assert.deepEqual(out, [[7, { t: 'feat', id: 'builder' }]]);
});

test('some achievements need doing, not just being born somewhere', () => {
  const game = heroGame(12345, 'native');
  game.scene.t = game.scene.dur;
  game.sceneTick(0.01, []);
  const got = newFeats(game, new Set());
  assert.ok(got.includes('native') && got.includes('begun'));
  assert.ok(!got.includes('citizen'), 'a citizen of the town you were born in doesn\'t count');
  assert.ok(!got.includes('bard'), 'your family liking you isn\'t enough');
  assert.equal(FEAT.citizen.title, 'Citizen');
});

// ------------------------------------------------------------ versions
test('a world from an older version can be brought up to this one (never back)', async () => {
  assert.ok(compareVersions('0.47.0', '0.48.0') < 0);
  assert.ok(compareVersions('0.48.0', '0.47.9') > 0);
  assert.equal(compareVersions('1.2.3', '1.2.3'), 0);
  assert.ok(compareVersions(null, '0.0.1') < 0, 'no version at all: the oldest');
  assert.ok(canUpgrade('0.47.0') && canUpgrade(undefined));
  assert.ok(!canUpgrade(GAME_VERSION), 'not to itself');
  assert.ok(!canUpgrade('9.0.0'), 'not from a newer one');
  const store = new SaveStore(memStore());
  await store.putText('2', JSON.stringify({ seed: 3, gv: '0.47.0', day: 4 }), { name: 'Ana', day: 4, seed: 3, gv: '0.47.0', savedAt: 1 });
  const told = [];
  store.onChange = (id, meta) => told.push([id, meta.gv]);
  const meta = await store.setVersion('2', GAME_VERSION);
  assert.equal(meta.gv, GAME_VERSION);
  assert.equal((await store.load('2')).gv, GAME_VERSION);
  assert.equal((await store.load('2')).day, 4, 'nothing else in it changed');
  assert.deepEqual(told, [['2', GAME_VERSION]], 'and kept wherever the saves are kept');
  await assert.rejects(() => store.setVersion('3', GAME_VERSION));
});

// ------------------------------------------------------------ openings
test('openings are painted, and their player is kept out of the world till they end', () => {
  for (const origin of ['native', 'crash']) {
    const game = heroGame(12345, origin);
    const sc = game.scene;
    assert.ok(sc && sc.intro && sc.lock, origin);
    assert.equal(sc.kind, origin === 'native' ? 'home_intro' : 'wreck_intro');
    assert.ok(!game.cutscene, 'nothing played out in the world itself');
    const p = game.player;
    assert.ok(p.limbo);
    assert.notEqual(game.occ.get(game.occKey(p.x, p.y, p.z)), p, 'in nobody\'s way');
    // Nothing goes after them.
    const c = { distTo: (q) => Math.hypot(q.x - p.x, q.z - p.z), x: p.x, y: p.y, z: p.z, S: {} };
    assert.ok(game.findPrey(c, 10) !== p, 'not them');
    // Over: set down in the world.
    sc.t = sc.dur;
    game.update(0.05, stubInput());
    assert.ok(!game.scene && !p.limbo);
    assert.equal(game.occ.get(game.occKey(p.x, p.y, p.z)), p);
  }
});

test('the painted openings: what\'s told, and a player\'s screen paints the same from it', () => {
  const home = heroGame(12345, 'native');
  const info = homeInfo(home);
  assert.ok(info.town && info.beats.length >= 2 && info.parents && info.folk > 0);
  assert.equal(JSON.stringify(JSON.parse(JSON.stringify(info))), JSON.stringify(info), 'plain data');
  const again = introFrom(home, { kind: 'home_intro', info });
  assert.equal(again.kind, 'home_intro');
  assert.equal(again.dur, homeScene(home, info).dur);
  const wreck = heroGame(12345, 'crash');
  const wi = wreckInfo(wreck);
  assert.ok(wi.ship && wi.captain && wi.reason);
  const ws = wreckScene(wreck, wi);
  assert.equal(ws.mood, 'cs_voyage');
  ws.t = WRECK.STORM;
  assert.equal(ws.mood, 'cs_gale');
  ws.t = WRECK.BLACK + 1;
  assert.equal(ws.mood, 'wreck');
  assert.equal(introFrom(wreck, { kind: 'wreck_intro', info: wi }).kind, 'wreck_intro');
  // (Sent with the scene to the player's screen.)
  const net = Object.create(HostNet.prototype);
  assert.deepEqual(net.sceneOf(ws).info, wi);
});

test('in a world with others, a newcomer sees their own opening, out of everyone\'s way, then is set down where their story puts them', () => {
  const { game, input } = start();
  game.startParty({ id: 'h', name: 'Hosty' });
  // A native: their home town, their family's house.
  const hn = normalizeHero({ ...randomHero(9), origin: 'native', name: 'Tarn' });
  const s1 = game.addSeat({ id: 'n1', name: 'Tarn' }, { ui: stubUI(), input: stubInput(), hero: hn });
  const sc1 = game.asPlayer(s1.ent, () => game.scene);
  assert.equal(sc1 && sc1.kind, 'home_intro');
  assert.ok(s1.ent.limbo);
  assert.ok(game.asPlayer(s1.ent, () => game.sim.citizen && game.sim.citizen.native), 'born there');
  // Not seen by anyone while it plays.
  for (let i = 0; i < 3; i++) game.update(0.05, input);
  assert.ok(!game.visibleEntities.includes(s1.ent));
  // A castaway: on the beach.
  const hc = normalizeHero({ ...randomHero(10), origin: 'crash', name: 'Mara' });
  const s2 = game.addSeat({ id: 'c1', name: 'Mara' }, { ui: stubUI(), input: stubInput(), hero: hc });
  assert.equal(game.asPlayer(s2.ent, () => game.scene && game.scene.kind), 'wreck_intro');
  const coast = game.coastSpot();
  assert.ok(coast && Math.abs(s2.ent.x - coast.x) <= 6 && Math.abs(s2.ent.z - coast.z) <= 6, 'washed up on the beach');
  // Their opening over, as the host plays it: in the world.
  game.asPlayer(s1.ent, () => {
    game.scene.t = game.scene.dur;
  });
  for (let i = 0; i < 3; i++) game.update(0.05, input);
  assert.ok(!s1.ent.limbo);
  assert.ok(game.asPlayer(s1.ent, () => game.ui.msgs.some((m) => /Home again/.test(m))));
  assert.ok(s2.ent.limbo, 'the other still watching theirs');
});

test('an old place that falls in while its ground is put away is fallen in when that ground comes back', () => {
  const game = makeGame(12345);
  const w = game.world;
  const rec = game.sim.dungeons.all.find((d) => d.type === 'barrow' && !d.cleared);
  const site = game.sim.dungeons.site(rec);
  const rx = Math.floor(site.x / REGION_W);
  const rz = Math.floor(site.z / REGION_D);
  // The ground about it, changed once and left behind (kept as it was
  // then, not made afresh when it's back).
  game.loadAround(site.x, site.z, true);
  const kept = [];
  for (let dz = -1; dz <= 1; dz++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (!w.isLoaded(rx + dx, rz + dz)) continue;
      w.loadRegion(rx + dx, rz + dz).modified = true;
      w.unloadRegion(rx + dx, rz + dz);
      kept.push(w.regionKey(rx + dx, rz + dz));
    }
  }
  assert.ok(kept.length && kept.every((k) => w.saved.has(k)), 'put away');
  // Cleared by someone else, while nobody's there.
  game.sim.dungeons.cleared(rec, 'Some adventurers');
  game.loadAround(site.x, site.z, true);
  const finalOf = (s) => [...new Map(siteBlocks(s, s.state).map((q) => [`${q[0]},${q[1]},${q[2]}`, q])).values()];
  const placed = finalOf(site);
  assert.ok(placed.length > 5);
  for (const [dx, y, dz, id] of placed) assert.equal(w.getBlock(site.x + dx, y, site.z + dz), id, `${dx},${y},${dz}`);
});
