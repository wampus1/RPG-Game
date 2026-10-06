// Round 57: a trading company's night camp by the road comes alive (and
// those killed there, people or horses, stay dead); a company setting off
// in the morning isn't stood back up behind you as it walks away; and
// settings for a machine (or a line) that can't keep up.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGame, stubInput, stubUI, stubRenderer } from './helpers.mjs';
import { Game } from '../src/game/game.js';
import { HostNet } from '../src/net/host.js';
import { GuestNet } from '../src/net/guest.js';
import { DEFAULTS, SETTING_ROWS, SETTING_KEYS, changeSetting, applySettings } from '../src/game/settings.js';
import { SettingsWindow } from '../src/ui/windows.js';
import { Renderer } from '../src/render/renderer.js';
import { STEPS } from '../src/game/migrate.js';
import { GAME_VERSION, compareVersions } from '../src/version.js';

function start(seed = 12345) {
  const game = makeGame(seed);
  const input = stubInput();
  game.minute = 10 * 60;
  for (let i = 0; i < 30; i++) game.update(0.1, input);
  return { game, input, p: game.player };
}

// On through the hours till a company's camped for the night out in the
// wilds (or on the road by day, `camped` false).
function companyOut(game, camped) {
  const C = game.sim.caravans;
  for (let h = 0; h < 24 * 14; h++) {
    game.minute += 60;
    if (game.minute >= 1440) {
      game.minute -= 1440;
      game.day++;
    }
    C.update();
    const r = C.roadSpots().find((q) => q.camped === camped && !game.world.ow.settlementAt(q.pos.x, q.pos.z) && (camped || (game.minute > 8 * 60 && game.minute < 16 * 60)));
    if (r) return r;
  }
  return null;
}

test('a company\'s night camp: about the fire, not stock still; the dead stay dead, horses too', () => {
  const { game, input } = start();
  const r = companyOut(game, true);
  assert.ok(r, 'a company camped by the road');
  game.teleportPlayer(r.pos.x + 12, 6, r.pos.z + 12);
  for (let i = 0; i < 80; i++) game.update(0.1, input);
  const ents = () => [...game.caravans.values()].filter((n) => n.company === r.g && !n.dead);
  const here = ents();
  assert.ok(here.length >= 1, 'they\'re there');
  assert.ok(game.roadCamp.size >= 1, 'the camp\'s up');
  const before = here.map((n) => `${n.x},${n.z}`);
  for (let i = 0; i < 300; i++) game.update(0.1, input);
  assert.ok(here.some((n, i) => `${n.x},${n.z}` !== before[i]), 'someone\'s moved about');
  // One killed: not back.
  const v = here[0];
  const i0 = v.rec.member;
  game.kill(v, game.player);
  for (let i = 0; i < 40; i++) game.update(0.1, input);
  assert.ok(r.g.members[i0].dead, 'gone from the company');
  assert.ok(!ents().some((n) => n.rec.member === i0), 'and not stood back up');
  // A horse killed: not back either.
  const horse = game.creatures.find((c) => !c.dead && c.standKey && c.standKey.startsWith('rc:'));
  if (horse) {
    const k = horse.standKey;
    game.kill(horse, game.player);
    for (let i = 0; i < 40; i++) game.update(0.1, input);
    assert.ok(!game.creatures.some((c) => !c.dead && c.standKey === k), 'the horse stays dead');
    assert.ok(r.g.members.some((m) => m.horseLost), 'and whoever rode it walks');
  }
  // The last of them: the company's no more.
  for (const m of r.g.members) m.dead = false;
  r.g.members.forEach((m, i) => {
    if (i) m.dead = true;
  });
  game.sim.caravans.memberDied(r.g.id, 0);
  assert.ok(!game.sim.caravans.get(r.g.id), 'disbanded');
});

test('a town\'s horse killed: one fewer, its place empty till another\'s broken in', () => {
  const { game } = start();
  const L = game.world.layouts.get(game.currentSettlement.id);
  const S = game.sim.stables;
  const st = S.of(L);
  st.horses = 3;
  st.horsesOut = 0;
  st.lent = [];
  const before = S.standing(L);
  if (!before || before.horses.length < 2) return;
  const victim = before.horses[0];
  S.slain(L, victim.idx);
  assert.equal(st.horses, 2);
  const after = S.standing(L);
  assert.ok(!after.horses.some((h) => h.idx === victim.idx), 'its place empty');
  assert.equal(after.horses.length, 2);
});

test('a company walking off in the morning isn\'t stood back up behind you', () => {
  const { game, input } = start();
  const r = companyOut(game, false);
  if (!r) return;
  game.teleportPlayer(r.pos.x + 12, 6, r.pos.z + 12);
  for (let i = 0; i < 40; i++) game.update(0.1, input);
  const ents = [...game.caravans.entries()].filter(([, n]) => n.company === r.g && !n.dead);
  if (!ents.length) return;
  // They've walked on ahead, out past where you can see them.
  const [k, n] = ents[0];
  n.teleport(game.player.x + 60, n.y, game.player.z);
  game.caravanT = 0;
  game.updateCaravans(0.1);
  assert.ok(!game.caravans.has(k) || game.caravans.get(k) !== n, 'seen off');
  for (let i = 0; i < 5; i++) {
    game.caravanT = 0;
    game.updateCaravans(0.1);
  }
  assert.ok(!game.caravans.has(k), 'not stood back up where the reckoning has them');
});

test('settings for a slow machine: frame rate, lighting, particles, rain and snow, online updates', () => {
  for (const k of ['frameCap', 'lighting', 'particles', 'weatherFx', 'netRate']) assert.ok(k in DEFAULTS, k);
  assert.ok(SETTING_ROWS.some((r) => r.section));
  const s = { ...DEFAULTS };
  changeSetting(s, 'particles', 1);
  changeSetting(s, 'particles', 1);
  assert.equal(s.particles, 2);
  changeSetting(s, 'particles', 1);
  assert.equal(s.particles, 0, 'round again');
  changeSetting(s, 'lighting', -1);
  assert.equal(s.lighting, 1);
  s.particles = 2;
  s.weatherFx = false;
  s.netRate = 1;
  const renderer = { lighting: {} };
  let rate = null;
  applySettings(s, { renderer, net: { setRate: (hz) => (rate = hz) } });
  assert.equal(renderer.particleK, 0);
  assert.ok(renderer.noWeatherFx);
  assert.ok(renderer.lighting.fast);
  assert.equal(rate, 10);
  // No particles at all.
  const fake = { particles: [], roofed: () => false, toView: (x, z) => [x, z], particleK: 0 };
  Renderer.prototype.emit.call(fake, 1, 1, 1, { n: 12 });
  assert.equal(fake.particles.length, 0);
  fake.particleK = 1;
  Renderer.prototype.emit.call(fake, 1, 1, 1, { n: 12 });
  assert.equal(fake.particles.length, 12);
  // The window fits on the screen, every setting on it.
  const w = new SettingsWindow({ ...stubUI(), mouseCell: { x: -1, y: -1 }, hooks: {} }, { ...DEFAULTS });
  assert.ok(w.h <= 36, `${w.h} rows`);
  const seen = [];
  w.hits = [];
  w.draw({ fill() {}, box() {}, center() {}, text: (x, y, t) => seen.push(String(t)) });
  for (const r of SETTING_KEYS) assert.ok(seen.includes(r.label), r.label);
});

test('online, light: the host sends word half as often, and the player still sees the world', () => {
  const game = makeGame(12345);
  const input = stubInput();
  game.minute = 600;
  for (let i = 0; i < 20; i++) game.update(0.1, input);
  const queue = [];
  let n = 0;
  let guestNet = null;
  const uiStub = () => Object.assign(stubUI(), { windows: [], update() {}, find: () => null, closeAll() {} });
  const hostNet = new HostNet(game, {
    send: (text) => {
      if (text[0] !== '@') return;
      const body = text.slice(text.indexOf('|') + 1);
      if (body.includes('"t":"s"') || body.includes('"snap"')) n++;
      queue.push(() => guestNet.receive(body));
    },
    profile: { id: 'h', name: 'Hosty' },
    world: { name: 'Testland' },
    makeUI: () => uiStub(),
  });
  let gg = null;
  guestNet = new GuestNet({
    send: (text) => queue.push(() => hostNet.receive(`@7|${text}`)),
    profile: { id: 'g', name: 'Guesty' },
    build: (save) => (gg = new Game({ seed: save.seed, renderer: stubRenderer(), audio: null, ui: uiStub(), save, remote: true })),
    onNeedHero: () => guestNet.sendHero(null),
    onEnd: () => {},
  });
  const gin = stubInput();
  const flush = () => {
    while (queue.length) queue.shift()();
  };
  const step = (k) => {
    for (let i = 0; i < k; i++) {
      game.update(0.05, input);
      flush();
      if (gg) gg.update(0.05, gin);
      flush();
    }
  };
  hostNet.receive('!' + JSON.stringify({ t: 'join', cid: 7, account: { id: 'g', name: 'Guesty' } }));
  flush();
  step(10);
  assert.ok(gg, 'joined');
  const g = [...hostNet.guests.values()][0];
  const count = (k) => {
    let sent = 0;
    const orig = hostNet.sendTo.bind(hostNet);
    hostNet.sendTo = (q, s) => {
      sent++;
      return orig(q, s);
    };
    step(k);
    hostNet.sendTo = orig;
    return sent;
  };
  const smooth = count(40);
  guestNet.setRate(10);
  flush();
  assert.equal(g.every, 2);
  const light = count(40);
  assert.ok(light <= Math.ceil(smooth / 2) + 1 && light > 0, `${smooth} then ${light}`);
  // Back to smooth.
  guestNet.setRate(20);
  flush();
  assert.equal(g.every, 1);
  void n;
});

test('0.57.0', () => {
  const step = STEPS.find((q) => q.to === '0.57.0');
  assert.ok(step);
  assert.ok(compareVersions(GAME_VERSION, '0.57.0') >= 0);
});

test('permissions: the host lets a player use commands; they run as that player', () => {
  const game = makeGame(12345);
  const input = stubInput();
  game.minute = 600;
  for (let i = 0; i < 20; i++) game.update(0.1, input);
  const queue = [];
  let guestNet = null;
  const uiStub = () => Object.assign(stubUI(), { windows: [], update() {}, find: () => null, closeAll() {} });
  const hostNet = new HostNet(game, {
    send: (text) => {
      if (text[0] !== '@') return;
      const body = text.slice(text.indexOf('|') + 1);
      queue.push(() => guestNet.receive(body));
    },
    profile: { id: 'h', name: 'Hosty' },
    world: { name: 'Testland' },
    makeUI: () => uiStub(),
  });
  let gg = null;
  guestNet = new GuestNet({
    send: (text) => queue.push(() => hostNet.receive(`@7|${text}`)),
    profile: { id: 'g', name: 'Guesty' },
    build: (save) => (gg = new Game({ seed: save.seed, renderer: stubRenderer(), audio: null, ui: uiStub(), save, remote: true })),
    onNeedHero: () => guestNet.sendHero(null),
    onEnd: () => {},
    onNote: () => {},
    onParty: () => {},
  });
  const flush = () => {
    while (queue.length) queue.shift()();
  };
  const step = (k) => {
    for (let i = 0; i < k; i++) {
      game.update(0.05, input);
      flush();
      if (gg) gg.update(0.05, stubInput());
      flush();
    }
  };
  hostNet.receive('!' + JSON.stringify({ t: 'join', cid: 7, account: { id: 'g', name: 'Guesty' } }));
  flush();
  step(10);
  assert.ok(gg);
  const seat = game.seats[1];
  const has = (k) => (seat.ent.inv || []).filter((q) => q && q.item === k).reduce((a, q) => a + q.count, 0);
  // Not allowed: told so, and nothing happens.
  assert.ok(!guestNet.canCommand());
  const start0 = has('bread');
  guestNet.command('give bread 3');
  flush();
  assert.ok(gg.ui.consoleLog.some((l) => /hasn't let you/.test(l.text || l)));
  assert.equal(has('bread'), start0);
  // The host allows it (and it's kept with the world).
  hostNet.setPerm('g', 'commands', true);
  flush();
  assert.ok(guestNet.canCommand(), 'the player knows');
  assert.ok(hostNet.partyList().find((q) => q.id === 'g').perm.commands);
  assert.deepEqual(game.partySave().perms, { g: { commands: true } });
  const before = has('bread');
  guestNet.command('give bread 3');
  flush();
  step(2);
  assert.equal(has('bread'), before + 3, 'into their pack, not the host\'s');
  assert.ok(gg.ui.consoleLog.length >= 2);
  // Taken away again.
  hostNet.setPerm('g', 'commands', false);
  flush();
  assert.ok(!guestNet.canCommand());
});

test('0.58.0: no permissions in an older hosted world till the host gives them', () => {
  const step = STEPS.find((q) => q.to === '0.58.0');
  assert.ok(step);
  const d = { party: { world: { name: 'x' } } };
  step.data(d, []);
  assert.deepEqual(d.party.perms, {});
  assert.ok(compareVersions(GAME_VERSION, '0.58.0') >= 0);
});

test('a player\'s fight wears off (it only ever did for the host, so they never talked to anyone again)', async () => {
  const { asSeat } = await import('../src/game/party.js');
  const game = makeGame(12345);
  const input = stubInput();
  game.minute = 600;
  for (let i = 0; i < 20; i++) game.update(0.1, input);
  const queue = [];
  let guestNet = null;
  const uiStub = () => Object.assign(stubUI(), { windows: [], update() {}, find: () => null, closeAll() {} });
  const hostNet = new HostNet(game, {
    send: (text) => {
      if (text[0] !== '@') return;
      const body = text.slice(text.indexOf('|') + 1);
      queue.push(() => guestNet.receive(body));
    },
    profile: { id: 'h', name: 'Hosty' },
    world: { name: 'Testland' },
    makeUI: () => uiStub(),
  });
  guestNet = new GuestNet({
    send: (text) => queue.push(() => hostNet.receive(`@7|${text}`)),
    profile: { id: 'g', name: 'Guesty' },
    build: (save) => new Game({ seed: save.seed, renderer: stubRenderer(), audio: null, ui: uiStub(), save, remote: true }),
    onNeedHero: () => guestNet.sendHero(null),
    onEnd: () => {},
    onNote: () => {},
    onParty: () => {},
  });
  const flush = () => {
    while (queue.length) queue.shift()();
  };
  hostNet.receive('!' + JSON.stringify({ t: 'join', cid: 7, account: { id: 'g', name: 'Guesty' } }));
  flush();
  for (let i = 0; i < 10; i++) {
    game.update(0.05, input);
    flush();
  }
  const seat = game.seats[1];
  asSeat(game, seat, () => {
    game.combatT = 5;
  });
  for (let i = 0; i < 140; i++) {
    game.update(0.05, input);
    flush();
  }
  const left = asSeat(game, seat, () => game.combatT);
  assert.ok(!(left > 0), `still in a fight: ${left}`);
});

test('a player\'s own reveal and map teleport: on their screen, not the host\'s', () => {
  const game = makeGame(12345);
  const input = stubInput();
  game.minute = 600;
  for (let i = 0; i < 20; i++) game.update(0.1, input);
  const queue = [];
  let guestNet = null;
  const uiStub = () => Object.assign(stubUI(), { windows: [], update() {}, find: () => null, closeAll() {} });
  const hostNet = new HostNet(game, {
    send: (text) => {
      if (text[0] !== '@') return;
      const body = text.slice(text.indexOf('|') + 1);
      queue.push(() => guestNet.receive(body));
    },
    profile: { id: 'h', name: 'Hosty' },
    world: { name: 'Testland' },
    makeUI: () => uiStub(),
  });
  let gg = null;
  guestNet = new GuestNet({
    send: (text) => queue.push(() => hostNet.receive(`@7|${text}`)),
    profile: { id: 'g', name: 'Guesty' },
    build: (save) => (gg = new Game({ seed: save.seed, renderer: stubRenderer(), audio: null, ui: uiStub(), save, remote: true })),
    onNeedHero: () => guestNet.sendHero(null),
    onEnd: () => {},
    onNote: () => {},
    onParty: () => {},
  });
  const flush = () => {
    while (queue.length) queue.shift()();
  };
  hostNet.receive('!' + JSON.stringify({ t: 'join', cid: 7, account: { id: 'g', name: 'Guesty' } }));
  flush();
  for (let i = 0; i < 10; i++) {
    game.update(0.05, input);
    flush();
    if (gg) gg.update(0.05, stubInput());
    flush();
  }
  hostNet.setPerm('g', 'commands', true);
  flush();
  guestNet.command('reveal');
  guestNet.command('teleport on');
  flush();
  assert.ok(gg.revealMap, 'their map, whole');
  assert.ok(gg.cheats.mapTeleport, 'and a click on it takes them there');
  assert.ok(!game.revealMap, 'not the host\'s');
  assert.ok(!(game.cheats && game.cheats.mapTeleport), 'nor the host\'s map teleport');
  // A click on their map: the host moves them.
  const seat = game.seats[1];
  const sent = [];
  const was = guestNet.command.bind(guestNet);
  guestNet.command = (t) => {
    sent.push(t);
    return was(t);
  };
  const s = game.world.ow.settlements.find((q) => q.id !== game.currentSettlement?.id) || game.world.ow.settlements[0];
  guestNet.command(`tp ${s.bounds.x0 + 4} ${s.bounds.z0 + 4}`);
  flush();
  assert.ok(Math.abs(seat.ent.x - (s.bounds.x0 + 4)) < 12, 'moved on the host');
});
