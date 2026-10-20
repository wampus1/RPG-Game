// Round 130: pirates' havens. Real settlements, hidden till found or heard
// of; their captives in the stockade; realms' expeditions that burn them for
// good, and villages turned pirate; the brethren's own polity (captains, a
// chief, the Articles, a council); a player's way up from hand to chief;
// the law on pirates (bills, hanging, the King's Pardon), bounty hunters,
// treasure maps; and each player's own knowledge of them in multiplayer.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGame, stubUI, stubInput } from './helpers.mjs';
import { isHaven, knowsHaven, hiddenHaven } from '../src/sim/havenref.js';
import { CAPTAIN_AT, CHIEF_AT, ARTICLE_IDS } from '../src/sim/brethren.js';
import { pledge, piracyOf } from '../src/game/piracy.js';
import { GUILDS } from '../src/game/pirates.js';
import { havenTopics, havenRespond } from '../src/game/haventalk.js';
import { HAVEN_WINDOWS } from '../src/ui/havenwin.js';
import { B, BLOCKS } from '../src/world/blocks.js';
import { ITEMS } from '../src/world/items.js';
import { RNG } from '../src/util/rng.js';
import { GAME_VERSION, compareVersions } from '../src/version.js';
import { stepsFor } from '../src/game/migrate.js';

const world = () => {
  const g = makeGame(12345, { wg: 9 });
  g.opened = [];
  g.ui.windows = [];
  g.ui.open = (w) => g.opened.push(w);
  return g;
};
const havenOf = (g, i = 0) => g.sim.havens.list[i];
const laid = (g, h) => g.world.getLayout(g.sim.havens.settlement(h));

test('each guild has a real haven ashore: a village of pirates, hidden from the start', () => {
  const g = world();
  const H = g.sim.havens;
  assert.ok(H.list.length >= 2, 'a haven for the guilds');
  const h = havenOf(g);
  const s = H.settlement(h);
  assert.ok(isHaven(s) && s.haven.guild === h.guild && !s.civ, 'a free village flying the black flag');
  const L = laid(g, h);
  assert.ok(L.npcs.length >= 8, 'people living there');
  assert.ok(L.npcs.some((r) => r.job === 'mayor') && L.npcs.filter((r) => r.job === 'guard').length >= 2);
  assert.ok(L.buildings.some((b) => b.type === 'stockade'), 'a stockade for the captives');
  assert.ok(L.npcs.some((r) => r.look && ['bandana', 'tricorn'].includes(r.look.hat)), 'dressed for the sea');
  // Nobody knows of it yet.
  assert.equal(knowsHaven(g, s, 'host'), false);
  assert.ok(hiddenHaven(g, s));
  // Its own things: the flag, the bills, the Articles.
  for (const n of ['sail_roof', 'jolly_gull', 'haven_wanted', 'articles_board', 'sea_chest', 'gallows', 'stocks', 'shore_gun']) assert.ok(B[n] !== undefined && BLOCKS[B[n]], n);
});

test('a haven is found by stumbling on it, or heard of by word of mouth', () => {
  const g = world();
  const H = g.sim.havens;
  const h = havenOf(g);
  // Word of mouth: a rough mark on the map, a little off.
  assert.ok(H.learn(h, 'host', 'heard', 'a fisher'));
  assert.equal(H.knows(h.sid, 'host'), 'heard');
  const rough = g.world.ow.pins.find((q) => q.haven === h.id);
  assert.ok(rough && rough.rough);
  // Hearing it again's no news.
  assert.equal(H.learn(h, 'host', 'heard'), false);
  // Walking up to it: found, the card, the exact mark.
  const c = H.centre(h);
  g.teleportPlayer(c.x, g.player.y, c.z);
  H.notice();
  assert.equal(H.knows(h.sid, 'host'), 'seen');
  assert.ok(g.opened.some((w) => w.kind === 'havencard'), 'the discovery card');
  const pins = g.world.ow.pins.filter((q) => q.haven === h.id);
  assert.equal(pins.length, 1);
  assert.ok(!pins[0].rough);
});

test('folk in port towns tell of the havens, the ones who\'d know likelier', () => {
  const g = world();
  const H = g.sim.havens;
  const port = [...g.world.ow.settlements].find((s) => s.coast && s.civ && !s.haven);
  const L = g.world.getLayout(port);
  const fisher = L.npcs.find((r) => r.job === 'fisher') || L.npcs[0];
  let told = null;
  for (let i = 0; i < 30 && !told; i++) {
    const r = H.rumour(L, fisher, 'host', new RNG(i + 1));
    assert.ok(r && typeof r.line === 'string' && r.line.length > 10);
    if (r.h) told = r.h;
  }
  assert.ok(told, 'a haven given away');
  assert.equal(H.knows(told.sid, 'host'), 'heard');
});

test('captives are held in a haven\'s stockade, ransomed, or pressed into the crew', () => {
  const g = world();
  const H = g.sim.havens;
  const h = havenOf(g);
  laid(g, h);
  const p = H.takeCaptive(h, 'taken off a fishing boat', new RNG(7));
  assert.ok(p, 'someone taken');
  assert.equal(p.haven, h.id);
  assert.equal(p.pirate, h.guild);
  assert.ok(p.ransom >= 30);
  assert.ok(H.held(h).includes(p));
  // Ransomed: home, the plunder the richer, and their town knows where the haven is.
  const before = h.stores.plunder;
  H.ransomed(p, 'host');
  assert.ok(!H.held(h).includes(p));
  assert.equal(h.stores.plunder, before + p.ransom);
  const home = g.world.ow.settlements[p.sid];
  if (home.civ) assert.ok(H.realmKnows(h, home.civ.id), 'the realm told');
  // (Nobody pays: pressed into the crew, one of the haven's people now.)
  const q = H.takeCaptive(h, 'carried off from the shore', new RNG(8));
  const rec = g.sim.war.recOfPrisoner(q);
  H.press(h, q, g.day);
  assert.ok(!H.held(h).includes(q));
  assert.equal(rec.captive, undefined, 'free, and one of theirs');
});

test('the brethren: captains, a chief, the Articles, their days at sea', () => {
  const g = world();
  const Br = g.sim.brethren;
  for (const h of g.sim.havens.list) laid(g, h);
  for (let d = 0; d < 6; d++) {
    g.day++;
    g.sim.havens.daily(g.day);
  }
  const G = Br.of(0);
  assert.ok(G.captains.length >= 2, 'captains seated');
  assert.equal(new Set(G.captains.map((c) => c.ship)).size, G.captains.length, 'every ship named apart');
  assert.ok(Br.chief(0), 'a chief');
  for (const k of ARTICLE_IDS) assert.ok(k in G.articles, k);
  const v = Br.view(0, 'host');
  assert.ok(v && Array.isArray(v.captains) && v.realms);
  // Saved and loaded, as it was.
  const d = JSON.parse(JSON.stringify(Br.serialize()));
  const g2 = world();
  g2.sim.brethren.load(d);
  assert.deepEqual(g2.sim.brethren.of(0).captains.map((c) => c.ship), G.captains.map((c) => c.ship));
});

test('any player can rise from hand to captain to chief', () => {
  const g = world();
  const Br = g.sim.brethren;
  for (const h of g.sim.havens.list) laid(g, h);
  for (let d = 0; d < 3; d++) {
    g.day++;
    g.sim.havens.daily(g.day);
  }
  pledge(g, g.player, 0, GUILDS[0]);
  const st = Br.standingOf('host');
  assert.equal(st.i, 0);
  assert.equal(st.m.rank, 'hand');
  // Sworn: told where the guild's havens are.
  assert.ok(g.sim.havens.standing(0).every((h) => g.sim.havens.knows(h.sid, 'host')));
  // Not yet a captain.
  assert.equal(Br.commission('host', { name: 'Wren' }).ok, false);
  while (st.m.merit < CAPTAIN_AT) Br.deed('host', 'prize');
  assert.equal(Br.commission('host', null).ok, false, 'a captain needs a ship');
  assert.ok(Br.commission('host', { name: 'Wren', type: 'sloop' }).ok);
  assert.equal(st.m.rank, 'captain');
  assert.equal(Br.callVote(0, 'host').ok, false, 'not known well enough yet');
  while (st.m.merit < CHIEF_AT) Br.deed('host', 'raid');
  assert.ok(Br.canChallenge(0, 'host').ok);
  // A challenge under the Articles, won: chief.
  Br.challengeDone(0, 'host', true);
  assert.equal(Br.chiefPid(0), 'host');
  assert.equal(Br.standingOf('host').m.rank, 'chief');
  // The chief's orders: the crew's share.
  Br.setCrewShare('host', 0.5);
  assert.equal(Br.crewCut('host', 100), 50);
});

test('a vote of the captains can make a player chief, or turn them down', () => {
  const g = world();
  const Br = g.sim.brethren;
  for (const h of g.sim.havens.list) laid(g, h);
  g.day++;
  g.sim.havens.daily(g.day);
  pledge(g, g.player, 0, GUILDS[0]);
  const st = Br.standingOf('host');
  st.m.merit = CAPTAIN_AT;
  Br.commission('host', { name: 'Wren', type: 'sloop' });
  st.m.merit = CHIEF_AT + 400;
  Br.of(0).mood = 0.1;
  const r = Br.callVote(0, 'host');
  assert.ok(r.ok && r.votes.length >= 1);
  assert.equal(r.carried, Br.chiefPid(0) === 'host');
  // Not again this week.
  assert.equal(Br.callVote(0, 'host').ok, false);
});

test('a realm that learns where a haven is sends marines, and can burn it for good', () => {
  const g = world();
  const H = g.sim.havens;
  const h = havenOf(g);
  const L = laid(g, h);
  H.takeCaptive(h, 'taken off a merchantman', new RNG(3));
  const town = g.world.ow.settlements.find((s) => s.civ && s.coast && !s.haven);
  g.world.getLayout(town);
  const C = town.civ;
  H.tellRealm(h, C.id, 'a sailor');
  assert.ok(H.realmKnows(h, C.id));
  H.raze(h, C);
  assert.ok(h.razed && h.razed.by === C.id);
  assert.equal(H.held(h).length, 0, 'the captives freed');
  assert.ok(H.settlement(h).deserted);
  assert.ok(L.npcs.every((r) => !r.alive || r.migrated || r.captive !== undefined || r.away || L.settlement.deserted));
  assert.ok(!H.standing(h.guild).includes(h), 'gone, for good');
});

test('a poor free village by the sea can turn pirate; its old visitors know only a village', () => {
  const g = world();
  const H = g.sim.havens;
  const v = g.world.ow.settlements.find((s) => !s.civ && !s.haven && s.coast && s.type === 'village');
  assert.ok(v, 'a free village by the sea');
  g.world.getLayout(v);
  const h = H.turn(v, 1, g.day);
  assert.ok(h && isHaven(v) && h.cover);
  assert.equal(g.sim.havens.of(v.id), h);
  // Someone who'd been there before: a village, as far as they know.
  g.world.ow.markExplored(H.centre(h).x, H.centre(h).z, 0);
  assert.equal(H.knows(v.id, 'host'), 'cover');
  // A new one founded on a lonely shore.
  const f = H.foundNew(2, null, g.day, new RNG(11), 'Tarry Bight');
  assert.ok(f && f.origin === 'founded');
});

test('havens and what\'s known of them are kept with the save', () => {
  const g = world();
  const H = g.sim.havens;
  const h = havenOf(g);
  H.learn(h, 'host', 'heard');
  const d = JSON.parse(JSON.stringify(g.serialize()));
  const g2 = makeGame(12345, { wg: 9 });
  g2.applySave(d);
  const h2 = g2.sim.havens.get(h.id);
  assert.ok(h2);
  assert.equal(g2.sim.havens.knows(h2.sid, 'host'), 'heard');
  const s2 = g2.sim.havens.settlement(h2);
  assert.ok(s2 && s2.haven && s2.haven.guild === h.guild);
});

test('a treasure map leads to a hoard, dug up and opened once', () => {
  const g = world();
  const H = g.sim.havens;
  const key = H.treasureMap(new RNG(5), havenOf(g));
  assert.ok(key && key.startsWith('tmap~'));
  assert.ok(ITEMS[key] && ITEMS.treasure_map);
  const [, x, z, n] = key.split('~').map(Number);
  const info = H.mapInfo(n);
  assert.equal(info.x, x);
  assert.ok(info.hint.length > 10);
  assert.ok(HAVEN_WINDOWS.tmap);
  g.world.getLayout(g.world.ow.settlements[0]);
  const y = 30;
  const p = g.player;
  p.give = p.give || (() => {});
  assert.ok(H.dig(x, y, z, p));
  assert.ok(H.mapInfo(n).dug);
  assert.equal(H.dig(x, y, z, p), false, 'once');
  const coin = [];
  p.give = (it, k) => coin.push([it, k]);
  H.openChest(x, y, z, p);
  assert.ok(coin.some(([it]) => it === 'coin'));
  coin.length = 0;
  H.openChest(x, y, z, p);
  assert.equal(coin.length, 0, 'empty the second time');
});

test('a known pirate is seized and tried for piracy: hanged, or the King\'s Pardon', () => {
  const g = world();
  pledge(g, g.player, 0, GUILDS[0]);
  const r = piracyOf(g, g.player);
  const town = g.world.ow.settlements.find((s) => s.civ && !s.haven && s.type === 'town');
  r.sunk[town.civ.id] = 5;
  r.n = 5;
  assert.ok(g.sim.havens.bountyOf('host') >= 80);
  g.sim.havens.pardon(g.player, town.civ.id);
  assert.equal(r.sunk[town.civ.id], 0);
  assert.equal(r.guild, null);
  assert.ok(g.sim.brethren.of(0).members.host.turncoat, 'a turncoat to the brethren');
  // The haven's corsairs would set on them now.
  assert.equal(g.sim.havens.hostileTo(havenOf(g), 'host'), 'turncoat');
});

test('a big enough price on your head brings out the bounty hunters', () => {
  const g = world();
  const H = g.sim.havens;
  const town = g.world.ow.settlements.find((s) => s.civ && !s.haven && s.type === 'town');
  const L = g.world.getLayout(town);
  g.active.set(town.id, { layout: L, npcs: [], since: 0 });
  const r = piracyOf(g, g.player);
  r.n = 9;
  r.sunk[town.civ.id] = 9;
  r.bounty = 200;
  // Out in the country, a little way from the town.
  let sent = false;
  for (let d = 0; d < 12 && !sent; d++) {
    g.day = 10 + d;
    const x = L.plaza.cx + 60;
    const z = L.plaza.cz;
    g.teleportPlayer(x, g.world.findStandY(x, z, 40) || 40, z);
    if (g.world.ow.settlementAt(g.player.x, g.player.z)) break;
    sent = H.bountyHunt(g.player);
  }
  assert.ok(sent, 'the hunters sent');
  const hunters = g.npcs.filter((n) => n.rec && n.rec.bountyHunter === 'host');
  assert.ok(hunters.length >= 2);
  assert.ok(hunters.every((n) => n.warband && n.warband.role === 'hunter' && n.warband.target === 'host'));
  // Not again the same day.
  assert.equal(H.bountyHunt(g.player), false);
});

test('in a haven, talk turns to the brethren', () => {
  const g = world();
  const h = havenOf(g);
  const L = laid(g, h);
  const npc = { rec: L.npcs.find((r) => r.job === 'mayor'), settlement: L.settlement, L, name: 'Quartermaster' };
  const topics = havenTopics(npc, g) || [];
  assert.ok(topics.some((t) => t.id === 'hv_swear'), 'swear to the brethren');
  const out = havenRespond(npc, g, 'hv_news');
  assert.ok(out === null || typeof out === 'object' || typeof out === 'string');
});

test('each player knows the havens they\'ve found; a guest sees only theirs', () => {
  const g = world();
  g.startParty({ id: 'h', name: 'Hosty' });
  const seat = g.addSeat({ id: 'g', name: 'Guesty' }, { ui: stubUI(), input: stubInput(), hero: null });
  const H = g.sim.havens;
  const h = havenOf(g);
  H.learn(h, String(seat.id), 'heard');
  const mine = H.forPid('host').find((q) => q[0] === h.sid);
  const theirs = H.forPid(String(seat.id)).find((q) => q[0] === h.sid);
  assert.equal(mine[2], 0);
  assert.equal(theirs[2], 'heard');
  // The guest's game, told by the host.
  const gg = { remote: true, havenKnown: { [h.sid]: 'heard' } };
  assert.equal(knowsHaven(gg, H.settlement(h)), 'heard');
  assert.equal(knowsHaven({ remote: true, havenKnown: {} }, H.settlement(h)), false);
});

test('version 1.30.0, and older worlds are given their havens', () => {
  assert.ok(compareVersions('1.30.0', GAME_VERSION) <= 0);
  const steps = stepsFor('1.29.0');
  assert.ok(steps.some((s) => s.to === '1.30.0'));
});
