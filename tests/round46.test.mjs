// Round 46: the rest of multiplayer made each player's own (their map,
// the old places they go down, their scenes, their trials and errands),
// what's for everyone (the storm wall falling, the mountain going up),
// fallen packs named for whose they are, and guilds.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGame, stubInput, stubUI, stubRenderer } from './helpers.mjs';
import { Game } from '../src/game/game.js';
import { DungeonRun, slotOf } from '../src/game/dungeon.js';
import { FY } from '../src/world/dungeongen.js';
import { seatField, seatMap } from '../src/game/party.js';
import { B } from '../src/world/blocks.js';
import { HostNet } from '../src/net/host.js';
import { GuestNet } from '../src/net/guest.js';
import { INST_X0, INST_RX, INST_SLOT_RX, REGION_W, MAP_W } from '../src/config.js';

const uiStub = () => {
  const u = stubUI();
  u.windows = [];
  u.update = () => {};
  u.find = () => null;
  u.closeAll = () => {};
  return u;
};
const keyInput = () => {
  const inp = stubInput();
  inp.keys = new Set();
  inp.isDown = (k) => inp.keys.has(k);
  return inp;
};

// The host and one other in the same world (no network).
function party(seed = 12345) {
  const game = makeGame(seed);
  const input = stubInput();
  game.minute = 10 * 60;
  for (let i = 0; i < 20; i++) game.update(0.1, input);
  game.startParty({ id: 'h', name: 'Hosty' });
  const gin = keyInput();
  const gui = stubUI();
  const seat = game.addSeat({ id: 'g', name: 'Guesty' }, { ui: gui, input: gin, hero: null });
  return { game, input, gin, gui, seat, gp: seat.ent };
}

// The host and a player on their own screen, linked as over the network.
function linked() {
  const game = makeGame(12345);
  const input = stubInput();
  game.minute = 10 * 60;
  for (let i = 0; i < 20; i++) game.update(0.1, input);
  const queue = [];
  let guestNet = null;
  const hostNet = new HostNet(game, {
    send: (text) => {
      if (text[0] === '@') {
        const body = text.slice(text.indexOf('|') + 1);
        queue.push(() => guestNet.receive(body));
      }
    },
    profile: { id: 'h', name: 'Hosty' },
    world: { name: 'Testland' },
    makeUI: () => uiStub(),
  });
  const flush = () => {
    while (queue.length) queue.shift()();
  };
  const out = { game, input, hostNet, gg: null };
  guestNet = new GuestNet({
    send: (text) => queue.push(() => hostNet.receive(`@7|${text}`)),
    profile: { id: 'g', name: 'Guesty' },
    build: (save) => (out.gg = new Game({ seed: save.seed, renderer: stubRenderer(), audio: null, ui: uiStub(), save, remote: true })),
    onNeedHero: () => guestNet.sendHero(null),
  });
  out.guestNet = guestNet;
  out.gin = keyInput();
  out.step = (n) => {
    for (let i = 0; i < n; i++) {
      game.update(0.05, input);
      flush();
      if (out.gg) out.gg.update(0.05, out.gin);
      flush();
    }
  };
  hostNet.receive('!' + JSON.stringify({ t: 'join', cid: 7, account: { id: 'g', name: 'Guesty' } }));
  flush();
  out.step(5);
  return out;
}

const barrows = (game) => game.sim.dungeons.all.filter((d) => d.type === 'barrow');
const fresh = (rec) => Object.assign(rec, { floors: {}, cleared: false, pack: null, packs: [] });

// ------------------------------------------------------------ old places
test('each old place has a space of its own, side by side out past the map', () => {
  const game = makeGame();
  const [a, b] = barrows(game);
  const ra = new DungeonRun(game, a);
  const rb = new DungeonRun(game, b);
  assert.equal(ra.slot, slotOf(a));
  assert.notEqual(ra.slot, rb.slot);
  assert.ok(ra.x0 >= INST_X0 + INST_SLOT_RX * REGION_W, 'past the ship\'s (slot 0)');
  assert.ok(ra.x1 <= rb.x0 || rb.x1 <= ra.x0, 'never overlapping');
  assert.ok(ra.has(ra.x0) && !ra.has(rb.x0));
});

test('two players down two old places at once: each their own floor, their own beasts', () => {
  const { game, input, gp, seat } = party();
  const [a, b] = barrows(game).map(fresh);
  game.runFor(a).enter();
  game.asPlayer(gp, () => game.runFor(b).enter());
  for (let i = 0; i < 10; i++) game.update(0.05, input);
  const ra = game.dungeon;
  const rb = seatField(game, seat, 'dungeon');
  assert.ok(ra && rb && ra !== rb, 'two places');
  assert.equal(game.runs.size, 2);
  assert.ok(ra.has(game.player) && rb.has(gp), 'each down their own');
  assert.ok(game.world.instAt(game.player.x) && game.world.instAt(gp.x) && game.world.instAt(game.player.x) !== game.world.instAt(gp.x), 'both open');
  // The ground under each is their own place's.
  assert.ok(game.world.canStand(game.player.x, game.player.y, game.player.z));
  assert.ok(game.world.canStand(gp.x, gp.y, gp.z));
  const ca = ra.creatures();
  const cb = rb.creatures();
  assert.ok(ca.length && cb.length, 'each with its own dead');
  assert.ok(!ca.some((c) => cb.includes(c)));
  // Their things come for those down there with them, never the other.
  for (const c of [...ca, ...cb]) c.dormant = 0;
  for (let i = 0; i < 120; i++) game.update(0.05, input);
  for (const c of ra.creatures()) assert.ok(!c.target || c.target !== gp, 'not across places');
  for (const c of rb.creatures()) assert.ok(!c.target || c.target !== game.player);
  // The host comes up: theirs closes, the player's stays.
  ra.leave();
  assert.ok(!game.world.inInstance(game.player.x));
  assert.equal(game.runs.size, 1);
  assert.ok(!ra.creatures().length, 'its things gone');
  assert.ok(rb.creatures().length, 'the other\'s still there');
  assert.ok(a.floors[0] && a.floors[0].rx0 === ra.rx0, 'its floor kept, where it was');
  for (let i = 0; i < 10; i++) game.update(0.05, input);
  assert.ok(game.world.inInstance(gp.x), 'the player still below');
  game.asPlayer(gp, () => game.dungeon.leave());
  assert.equal(game.runs.size, 0);
});

test('one down an old place, one up top: the island carries on round the one up there', () => {
  const { game, input, gp } = party();
  const [a] = barrows(game).map(fresh);
  game.runFor(a).enter();
  // (Night, so things come out round the player up top.)
  game.minute = 23 * 60;
  for (let i = 0; i < 400; i++) game.update(0.05, input);
  const up = game.creatures.filter((c) => !c.dead && !game.world.inInstance(c.x));
  assert.ok(up.length > 0, 'beasts about the player up top');
  assert.ok(up.every((c) => Math.max(Math.abs(c.x - gp.x), Math.abs(c.z - gp.z)) < 60), 'round them');
  assert.ok(!game.creatures.some((c) => !c.inst && game.world.inInstance(c.x)), 'none wandered in below');
});

test('the last one down puts the island by; the first one up brings it back', () => {
  const game = makeGame();
  const input = stubInput();
  for (let i = 0; i < 10; i++) game.update(0.1, input);
  const before = game.creatures.filter((c) => !c.dead).length;
  const [a] = barrows(game).map(fresh);
  game.runFor(a).enter();
  assert.ok(game.islandStash, 'put by');
  assert.ok(!game.creatures.some((c) => !game.world.inInstance(c.x)));
  game.dungeon.leave();
  assert.equal(game.islandStash, null);
  assert.ok(game.creatures.filter((c) => !c.dead).length >= before);
});

test('a floor kept from before each old place had its own space is moved over to it', () => {
  const game = makeGame();
  const [a] = barrows(game).map(fresh);
  // As an older save kept it: laid out in the first slot.
  const run = game.runFor(a);
  run.enter();
  const x = game.player.x + 1;
  const z = game.player.z;
  game.world.setBlock(x, FY, z, B.chest, 0);
  run.notePlaced(x, FY, z);
  run.state.solved[`drain${x},${z}`] = true;
  run.leave();
  const kept = a.floors[0];
  const dx = run.x0 - INST_X0;
  const old = {
    ...kept,
    rx0: undefined,
    regions: kept.regions.map((r) => ({ ...r, rx: r.rx - (run.rx0 - INST_RX) })),
    state: { ...kept.state, placed: [`${x - dx},${FY},${z}`], solved: { [`drain${x - dx},${z}`]: true } },
  };
  delete old.rx0;
  a.floors[0] = old;
  const again = game.runFor(a);
  again.enter();
  assert.equal(game.world.getBlock(x, FY, z), B.chest, 'what was set down, where it was');
  assert.ok(again.placed.has(`${x},${FY},${z}`));
  assert.ok(again.state.solved[`drain${x},${z}`]);
  assert.equal(a.floors[0].rx0, again.rx0);
  again.leave();
});

test('a player goes down on their own: their screen shows their place, the host\'s the island', () => {
  const L = linked();
  const { game } = L;
  const seat = game.seats[1];
  const gp = seat.ent;
  const [a] = barrows(game).map(fresh);
  game.asPlayer(gp, () => game.runFor(a).enter());
  L.step(10);
  assert.ok(!game.dungeon, 'the host is up top');
  assert.ok(game.world.inInstance(gp.x));
  assert.ok(L.gg.dungeon && L.gg.dungeon.rec.id === a.id, 'the player\'s screen: down there');
  assert.ok(L.gg.world.inst && L.gg.world.inInstance(L.gg.player.x));
  assert.equal(L.gg.world.getBlock(gp.x, gp.y - 1, gp.z), game.world.getBlock(gp.x, gp.y - 1, gp.z), 'the same floor under them');
  assert.equal(L.gg.weather, null, 'no weather below');
  // Its beasts, seen by the player.
  const c = seatField(game, seat, 'dungeon').creatures().find((q) => Math.abs(q.x - gp.x) < 25 && Math.abs(q.z - gp.z) < 25);
  if (c) assert.ok(L.guestNet.ents.get(c.id), 'its things seen');
  // A block set down there reaches them; up top, the host's world goes on.
  game.world.setBlock(gp.x + 1, FY, gp.z, B.cobblestone);
  L.step(3);
  assert.equal(L.gg.world.getBlock(gp.x + 1, FY, gp.z), B.cobblestone);
  game.asPlayer(gp, () => game.dungeon.leave());
  L.step(8);
  assert.ok(!L.gg.dungeon && !L.gg.world.inst, 'back up on their screen');
});

// ------------------------------------------------------------ guilds
test('guilds: founded, joined by invitation, left; the last out and it\'s gone', () => {
  const { game } = party();
  const G = game.guilds;
  assert.ok(!G.act('h', 'create', { name: 'x' }).ok, 'a name too short');
  const r = G.act('h', 'create', { name: '  The  Wayfarers!! ' });
  assert.ok(r.ok);
  assert.equal(r.guild.name, 'The Wayfarers');
  assert.equal(G.of('h'), r.guild);
  assert.ok(!G.act('h', 'create', { name: 'Another' }).ok, 'one guild at a time');
  assert.ok(!G.act('g', 'join', { gid: r.guild.id }).ok, 'not without being asked');
  const inv = G.act('h', 'invite', { to: 'g' });
  assert.ok(inv.ok);
  assert.ok(inv.told.some(([pid, t]) => pid === 'g' && /Hosty invites you/.test(t)), 'the one asked is told, by name');
  assert.deepEqual(G.invitesFor('g').map((q) => q.id), [r.guild.id]);
  assert.ok(G.act('g', 'join', { gid: r.guild.id }).ok);
  assert.deepEqual(r.guild.members, ['h', 'g']);
  assert.equal(G.invitesFor('g').length, 0);
  // The leader leaves: the other leads it now.
  const lv = G.act('h', 'leave');
  assert.ok(lv.ok);
  assert.equal(r.guild.leader, 'g');
  assert.ok(lv.told.some(([pid, t]) => pid === 'g' && /You lead it now/.test(t)));
  assert.ok(G.act('g', 'leave').ok);
  assert.equal(G.list.length, 0, 'gone with its last member');
  // Asked and turned down.
  const r2 = G.act('g', 'create', { name: 'Night Owls' });
  G.act('g', 'invite', { to: 'h' });
  assert.ok(G.act('h', 'decline', { gid: r2.guild.id }).ok);
  assert.equal(G.invitesFor('h').length, 0);
});

test('guilds: guildmates see each other (where, how, as they look), and the world keeps its guilds', () => {
  const { game, input, gp } = party();
  game.partyWorld = { name: 'Guildland' };
  game.guilds.act('h', 'create', { name: 'Wayfarers' });
  game.guilds.act('h', 'invite', { to: 'g' });
  game.guilds.act('g', 'join', { gid: game.guilds.of('h').id });
  for (let i = 0; i < 3; i++) game.update(0.05, input);
  const mates = game.guildMates();
  assert.equal(mates.length, 1);
  const m = mates[0];
  assert.equal(m.name, 'Guesty');
  assert.deepEqual([m.x, m.z], [gp.x, gp.z]);
  assert.equal(m.hp, Math.ceil(gp.hp));
  assert.ok(m.look && m.look.skin, 'how they look');
  assert.ok(m.here, 'up on the island with you');
  // Down an old place: on the map at its way in, and not "here".
  const [a] = barrows(game).map(fresh);
  game.asPlayer(gp, () => game.runFor(a).enter());
  const m2 = game.guildMates()[0];
  assert.equal(m2.below, a.name);
  assert.deepEqual([m2.mx, m2.mz], [a.x, a.z]);
  assert.ok(!m2.here);
  assert.equal(game.asPlayer(gp, () => game.guildMates()).length, 1, 'and they see the host');
  // Saved and loaded: the guild's still there.
  const save = JSON.parse(JSON.stringify(game.serialize()));
  const g2 = new Game({ seed: save.seed, renderer: stubRenderer(), audio: null, ui: stubUI(), save });
  assert.equal(g2.guilds.list.length, 1);
  assert.equal(g2.guilds.list[0].name, 'Wayfarers');
  assert.deepEqual(g2.guilds.list[0].members, ['h', 'g']);
});

test('guilds over the network: a player founds one, the host joins it, and each sees the other', () => {
  const L = linked();
  const { game, hostNet, guestNet } = L;
  const notes = [];
  guestNet.onNote = (t) => notes.push(t);
  guestNet.guild('create', { name: 'Lantern Guild' });
  L.step(2);
  const gl = game.guilds.of('g');
  assert.ok(gl && gl.name === 'Lantern Guild', 'founded on the host');
  assert.ok(guestNet.guilds.some((q) => q.name === 'Lantern Guild'), 'and the player knows');
  assert.ok(notes.some((t) => /You founded/.test(t)));
  guestNet.guild('invite', { to: 'h' });
  L.step(2);
  assert.ok(gl.invites.includes('h'));
  hostNet.guildOp({ id: 'h', name: 'Hosty' }, { op: 'join', gid: gl.id });
  L.step(8);
  assert.deepEqual(gl.members, ['g', 'h']);
  assert.ok(notes.some((t) => /Hosty joined/.test(t)), 'the player told');
  // Each sees the other: the host on the player's screen, with health.
  const mates = L.gg.guildMates();
  assert.equal(mates.length, 1);
  assert.equal(mates[0].name, 'Hosty');
  assert.deepEqual([mates[0].x, mates[0].z], [game.player.x, game.player.z]);
  game.player.hp -= 3;
  L.step(10);
  assert.equal(L.gg.guildMates()[0].hp, Math.ceil(game.player.hp), 'health as it is now');
  assert.ok(game.guildMates().some((m) => m.name === 'Guesty'));
  // A refusal is told, with the reason.
  guestNet.guild('create', { name: 'Second' });
  L.step(2);
  assert.ok(notes.some((t) => /already in Lantern Guild/.test(t)));
});

// ------------------------------------------------------------ scenes
test('the mountain going up is everyone\'s scene (those down an old place only feel it)', () => {
  const { game, input, gp, seat, gui } = party();
  const V = game.sim.volcano;
  const [a] = barrows(game).map(fresh);
  // A third player, down an old place.
  const s3 = game.addSeat({ id: 'c', name: 'Cavey' }, { ui: stubUI(), input: keyInput(), hero: null });
  game.asPlayer(s3.ent, () => game.runFor(a).enter());
  V.felt(0, 0, null);
  for (let i = 0; i < 4; i++) game.update(0.05, input);
  assert.equal(game.scene && game.scene.kind, 'erupt', 'the host sees it');
  assert.equal(seatField(game, seat, 'scene')?.kind, 'erupt', 'so does the other up top');
  assert.ok(gui.msgs.some((t) => /roar|erupted|explodes/.test(t)), 'and is told, as where they are');
  assert.ok(!seatField(game, s3, 'scene'), 'not the one below');
  assert.ok(s3.ui.msgs.some((t) => /shudders/.test(t)), 'they feel it');
  void gp;
});

test('the mountain\'s scene on a player\'s own screen; burning rock round each one on Kharos, after', () => {
  const L = linked();
  const { game } = L;
  const V = game.sim.volcano;
  const gp = game.seats[1].ent;
  V.felt(0, 0, null);
  L.step(6);
  assert.equal(L.gg.scene && L.gg.scene.kind, 'erupt', 'on the player\'s screen');
  // On Kharos, under it: rock comes down round them once it's played.
  const Vw = game.world.ow.volcano;
  game.asPlayer(gp, () => {
    game.scene = null;
    gp.ashBombs = 5;
  });
  const isle = game.world.ow.islandAt(gp.x, gp.z);
  if (isle === Vw.island) {
    const hz = game.hazards.length;
    for (let i = 0; i < 60; i++) game.update(0.05, L.input);
    assert.ok(game.hazards.length > hz || gp.ashBombs < 5);
  } else {
    V.rain(0.1);
    assert.equal(gp.ashBombs, 0, 'off Kharos: out from under it');
  }
});

test('a story\'s opening scene is its player\'s own: the host\'s doesn\'t hold anyone else', () => {
  const { game, input, gp, gin, seat } = party();
  game.cutscene = { kind: 'home', live: true, playable: false, update() {}, draw() {} };
  assert.ok(game.isBlocked(), 'the host watches');
  assert.ok(!game.asPlayer(gp, () => game.isBlocked()), 'the other plays on');
  assert.equal(seatField(game, seat, 'cutscene'), null);
  const x0 = gp.x;
  gin.keys.add('KeyD');
  for (let i = 0; i < 30; i++) game.update(0.05, input);
  gin.keys.clear();
  assert.notEqual(gp.x, x0, 'they walked while the host watched');
  game.cutscene = null;
});

// ------------------------------------------------------------ each their own
test('each player\'s own map: where they\'ve been, kept with them, and sent to their screen', () => {
  const { game, input, gp, seat } = party();
  const k = (q) => Math.floor(q.z / 36) * MAP_W + Math.floor(q.x / 64);
  // The guest walks off somewhere the host has never been.
  const far = { x: gp.x + 64 * 6, z: gp.z };
  game.loadAround(far.x, far.z, true);
  const spot = game.findFreeSpot(far.x, far.z, gp.y);
  gp.teleport(spot.x, spot.y, spot.z);
  for (let i = 0; i < 3; i++) game.update(0.05, input);
  const om = seatMap(game, seat);
  assert.ok(om.explored[k(gp)], 'on the guest\'s map');
  assert.ok(!game.world.ow.explored[k(gp)], 'not on the host\'s');
  // Kept with their character, and back on their return.
  game.removeSeat(seat);
  const s2 = game.addSeat({ id: 'g', name: 'Guesty' }, { ui: stubUI(), input: keyInput(), hero: null });
  assert.ok(seatMap(game, s2).explored[k(spot)], 'their map came back with them');
  assert.ok(!game.world.ow.explored[k(spot)]);
});

test('a player\'s map on their own screen: new squares sent as they\'re walked (or told of)', () => {
  const L = linked();
  const { game } = L;
  const seat = game.seats[1];
  const om = seatMap(game, seat);
  // Told of a far place (as a townsperson might): on their map, on their screen.
  let i = 0;
  while (om.explored[i] || game.world.ow.explored[i]) i++;
  game.asPlayer(seat.ent, () => game.world.ow.markExplored((i % MAP_W) * 64 + 10, Math.floor(i / MAP_W) * 36 + 10, 0));
  L.step(14);
  assert.equal(L.gg.world.ow.explored[i], 1, 'their screen has it');
  assert.equal(game.world.ow.explored[i], 0, 'the host\'s map doesn\'t');
});

test('the bounties each has earned are their own', () => {
  const { game, gp } = party();
  const B0 = game.sim.bandits;
  game.asPlayer(gp, () => {
    B0.heads[7] = 3;
  });
  assert.equal(B0.heads[7], undefined, 'not the host\'s');
  assert.equal(game.asPlayer(gp, () => B0.heads[7]), 3);
  game.partyWorld = { name: 'Bountyland' };
  const save = JSON.parse(JSON.stringify(game.serialize()));
  const ch = new Map(save.party.chars).get('g');
  assert.equal(ch.heads[7], 3, 'kept with them');
});

test('one in jail: the town counts any of you locked up, not only the host', () => {
  const { game, gp } = party();
  const sid = game.world.ow.settlements.findIndex((s) => s);
  assert.ok(!game.sim.justice.jailedIn(sid));
  game.asPlayer(gp, () => {
    game.sim.justice.jail = { sid, phase: 'serving', release: 1e9 };
  });
  assert.equal(game.sim.justice.jail, null, 'the host is free');
  assert.ok(game.sim.justice.jailedIn(sid), 'but the town knows the guest is held');
  game.asPlayer(gp, () => {
    game.sim.justice.jail = null;
  });
});

test('a house going up is its player\'s: another can\'t start theirs over it, and it\'s named for them', () => {
  const { game, gp } = party();
  const sim = game.sim;
  game.asPlayer(gp, () => {
    game.playerName = 'Guesty';
    sim.construction = { sid: 0, plot: 0, bid: 0, done: false, owner: 'g', ownerName: 'Guesty', placed: 0, need: 1, work: 0, last: sim.abs };
  });
  assert.ok(sim.othersHouse(), 'the host sees it\'s someone else\'s');
  assert.ok(!game.asPlayer(gp, () => sim.othersHouse()), 'the guest\'s own');
  const mayor = { layout: game.world.getLayout(game.world.ow.settlements[0]) };
  sim.citizen = { sid: 0, home: null };
  // (Round 47: not turned away; theirs goes in line after it.)
  const t = sim.ownHomeTerms(mayor);
  assert.ok(t.ok);
  assert.equal(t.after, 'Guesty');
  sim.construction = null;
  sim.citizen = null;
});
