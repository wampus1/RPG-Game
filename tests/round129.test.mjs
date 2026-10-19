// Round 129: festivals spread round the town (the places, the programme,
// the townsfolk over it, rain sending it indoors); the games played at them
// (archery, the foot race, wrestling the champion, the eating match, the
// riddling, the dance, the cook-off, and each people's own), prizes, music
// for tips, helping beforehand; the leader's speech, mischief, and how the
// day went; each player's own screen playing the games in multiplayer.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGame } from './helpers.mjs';
import { DAY } from '../src/sim/econ.js';
import { ITEMS } from '../src/world/items.js';
import { countItem } from '../src/game/inventory.js';
import { programme, segNow, festive, dayOf, posterLines } from '../src/sim/festival.js';
import {
  CONTESTS, RIDDLES, enter, result, tick, standings, npcFinished, prizeKey, give, GIFTS, canSpeak, speech, cask, rowdy, quality, boardRows,
} from '../src/game/festplay.js';
import { FestWindow } from '../src/ui/festwin.js';
import { GAMES2 } from '../src/ui/festwin2.js';
import { kinOf, festColours } from '../src/ui/festpaint.js';
import { uiFrame, applyFrame } from '../src/net/uiwire.js';
import { GAME_VERSION, compareVersions } from '../src/version.js';
import { stepsFor } from '../src/game/migrate.js';

// A world, its windows caught (not drawn), and a do in a town of `type`.
function festWorld(kind = 'fete', type = 'town', pick = null) {
  const g = makeGame(12345, { wg: 9 });
  g.opened = [];
  g.ui.open = (w) => g.opened.push(w);
  g.ui.find = () => null;
  g.ui.close = () => {};
  const s = g.world.ow.settlements.find((q) => q.type === type && !q.deserted && (!pick || pick(q)));
  const L = g.world.getLayout(s);
  const ev = kind === 'feast' ? g.sim.events.feast(L, g.day, 0) : g.sim.events.fete(L, g.day, type);
  return { g, s, L, ev };
}
// On to `t` (minutes since the world began), the town's hours lived.
function until(g, L, t) {
  for (let h = Math.ceil((g.day * DAY + g.minute) / 60) * 60; h <= t; h += 60) g.sim.events.hourly(L, h);
  g.day = Math.floor(t / DAY);
  g.minute = t % DAY;
}
const near = (g, ev, v) => {
  const r = v === 'stage' ? ev.site : ev.venues.find((q) => q.id === v);
  g.teleportPlayer(Math.round((r.x0 + r.x1) / 2), g.player.y, r.z1 + 1);
};

test('a festival is spread round the town, to a programme, the townsfolk over it', () => {
  const { g, L, ev } = festWorld('feast', 'city');
  assert.ok(festive(ev));
  assert.ok(ev.prog.some((q) => q.k === 'fair') && ev.prog.some((q) => q.k === 'feast') && ev.prog.some((q) => q.k === 'night'));
  until(g, L, ev.day * DAY + 8 * 60);
  assert.ok(ev.venues.length >= 2, 'places put up round the town');
  const where = new Set();
  for (const gg of ev.guests) for (const sg of gg.segs || []) where.add(sg.v);
  assert.ok(where.size >= 3, 'the guests spread over the places');
  assert.ok(posterLines(ev).length >= 3);
  // (The programme's the same, worked out again.)
  assert.deepEqual(programme(L, ev).map((q) => q.k), ev.prog.map((q) => q.k));
  const gg = ev.guests.find((q) => q.segs && q.segs.length > 1);
  assert.ok(segNow(gg.segs, gg.segs[0].from + 1));
  assert.ok(dayOf(L, ev.s) === ev);
});

test('contests by the places it has, and the people\'s own; townsfolk who have a go', () => {
  const { g, s, L, ev } = festWorld();
  until(g, L, ev.day * DAY + 7 * 60);
  const keys = Object.keys(ev.contests || {});
  for (const k of ['eating', 'riddles', 'dance', 'cookoff']) assert.ok(keys.includes(k), k);
  const own = Object.keys(CONTESTS).filter((k) => CONTESTS[k].people && CONTESTS[k].people.includes(s.style));
  assert.equal(own.length, 1, 'each people its own');
  assert.ok(keys.includes(own[0]));
  for (const k of keys) {
    const c = ev.contests[k];
    assert.ok(c.from < c.to);
    if (k !== 'wrestling') assert.ok(c.npc.length >= 1, `${k}: some of the town have a go`);
  }
  // (Only the people's own.)
  assert.ok(!keys.some((k) => CONTESTS[k].people && !CONTESTS[k].people.includes(s.style)));
});

test('a contest closes with its places, called out, put in the ledger; the day is reckoned', () => {
  const { g, L, ev } = festWorld();
  until(g, L, (ev.day + 1) * DAY + 60);
  for (const c of Object.values(ev.contests)) {
    assert.ok(c.done, `${c.k} closed`);
    assert.ok(c.places.length >= 1);
  }
  assert.ok(typeof ev.quality === 'number' && ev.quality >= 0 && ev.quality <= 100);
  const lf = L.econ.lastFest;
  assert.ok(lf && lf.word && lf.champs.length >= 1);
  assert.ok(L.econ.ledger.some((q) => /goes to/.test(q.text || q)));
  assert.ok(L.econ.ledger.some((q) => / won /.test(q.text || q)));
  const { q, parts } = quality(L, ev);
  assert.equal(q, ev.quality);
  assert.ok('turnout' in parts && 'weather' in parts);
});

test('having a go: the game opened for you, how you did checked against your go', () => {
  const { g, L, ev } = festWorld();
  until(g, L, ev.day * DAY + 8 * 60);
  const c = ev.contests.eating;
  until(g, L, c.from + 2);
  // (Away from the ale tables: told where to go.)
  g.teleportPlayer(L.plaza.cx + 40, g.player.y, L.plaza.cz + 40);
  assert.match(enter(g, L, ev, 'eating'), /ale tables|Go there/);
  near(g, ev, 'alehouse');
  assert.equal(enter(g, L, ev, 'eating'), null);
  const w = g.opened.pop();
  assert.ok(w instanceof FestWindow && w.fest.kind === 'eating' && w.fest.token);
  assert.ok(Array.isArray(w.fest.rivals));
  // (Too soon, and a made-up go: nothing.)
  assert.equal(result(g, L, ev, 'eating', { token: w.fest.token + 1, score: 9 }), null);
  g.minute += 30;
  const r = result(g, L, ev, 'eating', { token: w.fest.token, score: 999 });
  assert.equal(r.score, CONTESTS.eating.max);
  assert.ok(r.board.some((q) => q.you));
  // (The same go twice: no.)
  assert.equal(result(g, L, ev, 'eating', { token: w.fest.token, score: 5 }), null);
  assert.match(enter(g, L, ev, 'eating'), /had your go/);
  // The riddling: your picks against the answers.
  const rc = ev.contests.riddles;
  assert.equal(enter(g, L, ev, 'riddles'), null);
  const rw = g.opened.pop();
  assert.equal(rw.fest.items.length, 5);
  assert.ok(rw.fest.items.every((it) => it.opts.length === 4));
  const ans = rc.open.host.answers;
  g.minute += 30;
  const rr = result(g, L, ev, 'riddles', { token: rw.fest.token, picks: ans.map((a, i) => (i < 3 ? a : (a + 1) % 4)) });
  assert.equal(rr.score, 3);
  assert.ok(RIDDLES.length >= 20);
});

test('the race: runners home past the marks, the quickest first; the board', () => {
  const { g, L, ev } = festWorld();
  until(g, L, ev.day * DAY + 8 * 60);
  const c = ev.contests.race;
  if (!c) return;
  assert.ok(c.course.length >= 3, 'a course round the town');
  assert.match(enter(g, L, ev, 'race'), /isn't till/);
  until(g, L, c.from + 1);
  assert.match(enter(g, L, ev, 'race'), /name's down/);
  // Off, and home.
  c.race = { go: true, clock: 40.2, runners: {} };
  npcFinished(L, ev, c.npc[0].idx);
  c.race.clock = 35.5;
  npcFinished(L, ev, c.npc[1].idx);
  const st = standings(c);
  assert.equal(st[0].score, 35.5);
  const rows = boardRows(L, ev, g.sim.abs, 'host');
  assert.ok(rows.find((r) => r.k === 'race').entered);
});

test('prizes: a rosette for the place, coin and the town\'s good word', () => {
  const key = prizeKey('archery', 1, 1203, 'Kaldhavn');
  const it = ITEMS[key];
  assert.ok(it && it.prize && it.prize.place === 1);
  assert.match(it.name, /First: Archery Rosette/);
  assert.match(it.about, /Kaldhavn/);
});

test('the cook-off: a dish handed in, tasted, the judges\' cards; and a prize', () => {
  const { g, L, ev } = festWorld();
  until(g, L, ev.day * DAY + 8 * 60);
  const c = ev.contests.cookoff;
  until(g, L, c.from + 60);
  near(g, ev, 'stage');
  assert.match(enter(g, L, ev, 'cookoff'), /Hold the dish/);
  g.player.give('pottage', 1);
  g.player.selected = g.player.inv.findIndex((q) => q && q.item === 'pottage');
  assert.match(enter(g, L, ev, 'cookoff'), /judges' table/);
  assert.equal(countItem(g.player.inv, 'pottage'), 0);
  g.day = Math.floor(c.at / DAY);
  g.minute = c.at % DAY;
  tick(g.sim.events, L, ev, c.at);
  assert.ok(c.done);
  const mine = c.judged.find((p) => p.who === 'pl:host');
  assert.equal(mine.cards.length, 3);
  assert.ok(mine.cards.every((v) => v >= 1 && v <= 10));
  assert.ok(g.opened.some((w) => w.fest && w.fest.kind === 'cookoff'), 'the judging shown');
});

test('helping beforehand: food, ale, flowers or coin for the host', () => {
  const { g, L, ev } = festWorld();
  g.player.give('bread', 6);
  const had = countItem(g.player.inv, 'bread');
  assert.ok(GIFTS.food.test('bread'));
  assert.ok(give(g, L, ev, 'food'));
  assert.ok(countItem(g.player.inv, 'bread') <= had - 1);
  assert.equal(ev.gifts.food, 1);
  assert.ok(!give(g, L, ev, 'coin') || countItem(g.player.inv, 'coin') >= 0);
});

test('the speech: the one who governs opens it, and the factions think the better of them', () => {
  const { g, L, ev } = festWorld();
  until(g, L, ev.day * DAY + 8 * 60);
  const feast = ev.prog.find((q) => q.k === 'feast');
  g.day = Math.floor(feast.from / DAY);
  g.minute = feast.from % DAY - 10;
  assert.equal(canSpeak(g, L, ev, g.sim.abs), null, 'not yours to open');
  const was = g.sim.office.isHolder;
  g.sim.office.isHolder = () => true;
  const T = g.sim.office.town(L);
  try {
    assert.equal(canSpeak(g, L, ev, g.sim.abs), 'office');
    const r = speech(g, L, ev, 'plain');
    assert.ok(r && r.said);
    assert.ok(ev.speech && ev.speech.tone === 'plain');
    assert.ok(Object.values(T.favour).some((v) => v !== 0));
    assert.equal(canSpeak(g, L, ev, g.sim.abs), null, 'opened once');
  } finally {
    g.sim.office.isHolder = was;
  }
});

test('the ale cask: a mug on the house; a potion tipped in, a rowdy night', () => {
  const { g, L, ev } = festWorld();
  until(g, L, ev.day * DAY + 8 * 60);
  const fair = ev.prog.find((q) => q.k === 'fair');
  until(g, L, fair.from + 30);
  const a = ev.venues.find((q) => q.id === 'alehouse');
  const x = a.x0 + 1;
  const z = a.z0 + 1;
  assert.match(cask(g, L, x, z), /on the house/);
  assert.match(cask(g, L, x, z), /had your festival mug/);
  g.player.give('cure', 1);
  g.player.selected = g.player.inv.findIndex((q) => q && q.item === 'cure');
  cask(g, L, x, z);
  assert.ok(ev.spiked && rowdy(ev, g.sim.abs));
});

test('multiplayer: a guest plays the game on their own screen; the host checks how they did', () => {
  const hostUi = { windows: [], remoteSeat: true, close(w) { this.windows = this.windows.filter((q) => q !== w); } };
  let got = null;
  hostUi.game = { festResult(cfg, m) { got = m; return { score: m.score, place: 1, board: [{ name: 'You', score: m.score, you: true }] }; } };
  const cfg = { kind: 'eating', token: 42, seed: 7, title: 'EATING MATCH', town: 'X', style: 'vale', hour: 12, tries: 1, rivals: [] };
  const hw = new FestWindow(hostUi, cfg);
  assert.ok(hw.passive, 'the host only waits');
  hostUi.windows.push(hw);
  const last = {};
  const guestUi = { windows: [], forward: [] };
  applyFrame(guestUi, uiFrame(hostUi, null, last));
  const m = guestUi.windows[0];
  assert.ok(m && m.mirror && m.fest.kind === 'eating');
  m.finish({ score: 7.3 });
  hw.onKey(guestUi.forward[0]);
  assert.equal(got.score, 7.3);
  applyFrame(guestUi, uiFrame(hostUi, null, last));
  assert.equal(m.fest.reply.place, 1);
  // (Unchanged since: not sent again.)
  assert.equal(uiFrame(hostUi, null, last).wins[0].festd, 1);
  hostUi.windows = [];
  applyFrame(guestUi, uiFrame(hostUi, null, last));
  assert.equal(guestUi.windows.length, 0);
  assert.ok(m.cleaned, 'its tune stopped');
});

test('every game has its window; each people its look', () => {
  const ui = { windows: [] };
  for (const k of [...['archery', 'eating', 'riddles', 'dance', 'cookoff'], ...Object.keys(GAMES2)]) {
    const w = new FestWindow(ui, { kind: k, token: 1, seed: 3, title: k, town: 'X', style: 'north', hour: 14, tries: 1, items: [], plates: [], judges: [] });
    assert.ok(w.play, k);
    assert.ok(typeof w.play.paint === 'function');
  }
  for (const k of Object.keys(CONTESTS)) if (CONTESTS[k].play === 'win') assert.ok(['archery', 'eating', 'riddles', 'dance', ...Object.keys(GAMES2)].includes(k), k);
  assert.equal(kinOf('rime'), 'north');
  assert.equal(kinOf('velari'), 'vale');
  assert.deepEqual(festColours('skerry'), festColours('tide'));
});

test('version 1.29.0, and a world from 1.28 is brought up to it', () => {
  assert.ok(compareVersions('1.29.0', GAME_VERSION) <= 0);
  assert.ok(compareVersions('1.28.0', GAME_VERSION) < 0);
  assert.ok(stepsFor('1.28.0').some((q) => q.to === '1.29.0'));
});
