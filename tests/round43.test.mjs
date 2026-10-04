import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGame, stubInput, stubUI } from './helpers.mjs';
import { challengeBout, boutOf } from '../src/game/bout.js';
import { B } from '../src/world/blocks.js';
import { REGION_W, REGION_D } from '../src/config.js';
import { stampSites, blighted, blightReach } from '../src/world/sites.js';
import { DungeonRun, partyHpScale } from '../src/game/dungeon.js';

function start(seed = 12345, minute = 10 * 60) {
  const game = makeGame(seed);
  const input = stubInput();
  game.minute = minute;
  for (let i = 0; i < 20; i++) game.update(0.1, input);
  return { game, input, p: game.player };
}

// A region of nothing but `ground` (dirt under it), with a spire stood in it.
function blightOn(ground) {
  const s = { id: 'k43', type: 'kavorent', x: 2000, z: 2000, h: 5, seed: 4343, state: {} };
  const reg = {
    x0: s.x - (REGION_W >> 1),
    z0: s.z - (REGION_D >> 1),
    m: new Map(),
    get(lx, y, lz) {
      return this.m.get(`${lx},${y},${lz}`) ?? (y === 5 ? ground : y < 5 ? B.dirt : B.air);
    },
    set(lx, y, lz, id) {
      this.m.set(`${lx},${y},${lz}`, id);
    },
  };
  stampSites({ sites: [s] }, reg);
  const tops = new Map();
  let inside = 0;
  for (let lz = 0; lz < REGION_D; lz++) {
    for (let lx = 0; lx < REGION_W; lx++) {
      const x = reg.x0 + lx;
      const z = reg.z0 + lz;
      if (Math.abs(x - s.x) <= 7 && Math.abs(z - s.z) <= 7) continue;
      if (Math.hypot(x - s.x, z - s.z) > blightReach(s, Math.atan2(z - s.z, x - s.x)) - 1.5 || !blighted(s, x, z)) continue;
      inside++;
      const top = reg.get(lx, 5, lz);
      tops.set(top, (tops.get(top) || 0) + 1);
    }
  }
  return { inside, tops };
}

test('a spire\'s blight takes whatever ground it stands in: ash, moss, peat, rock, ice, sandstone', () => {
  const want = [
    ['ash', B.grass_void], ['cinder', B.grass_void], ['scorched', B.grass_void], ['moss', B.grass_void], ['peat', B.grass_void], ['mycelium', B.grass_void],
    ['ice', B.snow_void], ['snow', B.snow_void],
    ['stone', B.rock_void], ['basalt', B.rock_void], ['sandstone', B.rock_void], ['gravel', B.rock_void], ['obsidian', B.rock_void],
  ];
  for (const [name, to] of want) {
    const { inside, tops } = blightOn(B[name]);
    assert.ok(inside > 200, `${name}: ${inside}`);
    assert.equal(tops.get(to), inside, `${name}: all of it blighted (${[...tops].map(([k, v]) => `${k}:${v}`).join(' ')})`);
  }
});

test('round a spire on the fire island the ash is blighted as well', () => {
  const { game } = start(7);
  const s = game.world.sites.find((q) => q.type === 'kavorent' && q.island === 'kharos');
  assert.ok(s, 'a spire on Kharos');
  game.loadAround(s.x, s.z, true);
  let n = 0;
  let bad = 0;
  for (let dz = -20; dz <= 20; dz++) {
    for (let dx = -20; dx <= 20; dx++) {
      const d = Math.hypot(dx, dz);
      if (d < 8 || d > blightReach(s, Math.atan2(dz, dx)) - 1.5) continue;
      let top = B.air;
      for (let y = 30; y >= 1; y--) {
        top = game.world.getBlock(s.x + dx, y, s.z + dz);
        if (top !== B.air) break;
      }
      n++;
      if (top === B.ash || top === B.cinder || top === B.basalt || top === B.scorched) bad++;
    }
  }
  assert.ok(n > 300, `${n} tiles`);
  assert.equal(bad, 0, `${bad} of ${n} left as they were`);
});

// ------------------------------------------------------------ bouts between players
const keyInput = () => {
  const inp = stubInput();
  inp.keys = new Set();
  inp.isDown = (k) => inp.keys.has(k);
  return inp;
};

function party() {
  const { game, input } = start();
  game.startParty({ id: 'h', name: 'Hosty' });
  const opened = { host: [], guest: [] };
  game.ui.open = (w) => opened.host.push(w);
  const gui = stubUI();
  gui.open = (w) => opened.guest.push(w);
  const seat = game.addSeat({ id: 'g', name: 'Guesty' }, { ui: gui, input: keyInput(), hero: null });
  const gp = seat.ent;
  const p = game.player;
  const spot = game.findFreeSpot(p.x + 2, p.z, p.y);
  gp.teleport(spot.x, spot.y, spot.z);
  return { game, input, seat, gp, gui, opened };
}

test('players can have a bout as with an adventurer: asked, counted down, to a quarter, the purse paid', () => {
  const { game, input, seat, gp, gui, opened } = party();
  const p = game.player;
  assert.ok(!game.pvp, 'players can\'t fight here otherwise');
  const coins = (q) => q.inv.filter(Boolean).filter((s) => s.item === 'coin').reduce((n, s) => n + s.count, 0);
  if (coins(p) < 25) p.give('coin', 25);
  if (coins(gp) < 25) gp.give('coin', 25);
  const host0 = coins(p);
  const guest0 = coins(gp);
  // The host challenges the guest, for ¤25: the guest is asked.
  assert.ok(challengeBout(game, game.seat, 'g', 25));
  assert.equal(opened.guest.length, 1, 'the guest is asked');
  const ask = opened.guest[0];
  assert.equal(ask.kind, 'boutAsk');
  assert.equal(ask.ask.wager, 25);
  // Before they answer, a blow still doesn't land.
  const hp0 = gp.hp;
  game.damage(gp, 2, p);
  assert.equal(gp.hp, hp0);
  ask.onAnswer(true);
  assert.equal(game.bouts.length, 1, 'on');
  assert.ok(boutOf(game, p, gp));
  assert.ok(gui.msgs.some((m) => /bout with Hosty/.test(m)));
  // Counted down...
  for (let i = 0; i < 70; i++) game.update(0.05, input);
  assert.ok(!(game.bouts[0].ready > 0), 'the count is done');
  // ...and now blows land, whether players may fight here or not.
  game.damage(gp, 2, p);
  assert.ok(gp.hp < hp0, 'the blow lands');
  // Down to a quarter: the guest yields, the host wins the purse.
  game.damage(gp, 999, p);
  assert.ok(!gp.dead, 'nobody dies of a bout');
  assert.equal(gp.hp, Math.ceil(gp.maxHp * 0.25));
  assert.equal(game.bouts.length, 0, 'over');
  assert.ok(gp.kneelT > 0, 'on one knee');
  assert.equal(coins(p), host0 + 25);
  assert.equal(coins(gp), guest0 - 25);
  assert.ok(gui.msgs.some((m) => /Hosty won the bout/.test(m)));
  assert.equal(seat.store.g.scene && seat.store.g.scene.kind, 'yield', 'the guest sees it end');
  assert.equal(game.scene && game.scene.kind, 'yield', 'and the host');
  // Just after, no blow between them lands.
  const hp1 = gp.hp;
  game.damage(gp, 2, p);
  assert.equal(gp.hp, hp1, 'the bout is over');
});

test('a bout between players: declined, walked away from, too far off to ask', () => {
  const { game, input, gp, gui, opened } = party();
  const p = game.player;
  // Declined: no bout.
  assert.ok(challengeBout(game, game.seat, 'g', 0));
  opened.guest.pop().onAnswer(false);
  assert.ok(!game.bouts || !game.bouts.length);
  // The guest challenges the host, who accepts; then the guest walks off.
  const hostMsgs = [];
  game.ui.msg = (t) => hostMsgs.push(t);
  assert.ok(challengeBout(game, game.seats[1], 'h', 0));
  assert.equal(opened.host.length, 1, 'the host is asked');
  opened.host.pop().onAnswer(true);
  assert.equal(game.bouts.length, 1);
  const far = game.findFreeSpot(p.x + 20, p.z, p.y);
  gp.teleport(far.x, far.y, far.z);
  game.update(0.05, input);
  assert.equal(game.bouts.length, 0, 'over');
  assert.ok(gui.msgs.some((m) => /walked away/.test(m)), 'the guest walked away from it');
  assert.ok(hostMsgs.some((m) => /walked away from the bout: it's yours/.test(m)));
  // Too far off to challenge at all.
  assert.ok(!challengeBout(game, game.seat, 'g', 0));
  assert.ok(hostMsgs.some((m) => /too far off/.test(m)));
});

// ------------------------------------------------------------ masters, for a party
test('a master has more health for each player down in its old place, and less when one goes', () => {
  const { game, input, gp } = party();
  const up = { x: gp.x, y: gp.y, z: gp.z };
  const rec = { ...game.sim.dungeons.all.find((d) => d.type === 'barrow'), floors: {}, cleared: false, pack: null };
  new DungeonRun(game, rec).enter();
  while (game.dungeon.floor < rec.depth - 1) game.dungeon.changeFloor(1);
  const boss = game.creatures.find((c) => c.isBoss && !c.dead && c.leash);
  assert.ok(boss, 'a master');
  boss.dormant = 999;
  // Only the host down here (the guest went back up): as ever.
  gp.teleport(up.x, up.y, up.z);
  assert.ok(!game.world.inInstance(gp.x));
  game.update(0.05, input);
  assert.equal(game.dungeon.partyHere().length, 1);
  const base = boss.maxHp;
  assert.equal(boss.hp, base);
  // The guest comes down too (each goes down on their own: they join the
  // host's floor): half as much again and more.
  game.asPlayer(gp, () => game.runFor(rec).enter());
  assert.ok(game.world.inInstance(gp.x));
  game.update(0.05, input);
  assert.equal(boss.maxHp, Math.round(base * partyHpScale(2)));
  assert.ok(partyHpScale(2) > 1.5 && partyHpScale(3) > partyHpScale(2));
  assert.equal(boss.hp, boss.maxHp, 'still whole');
  // Half beaten; then the guest goes back up: half of what it was.
  boss.hp = Math.round(boss.maxHp / 2);
  game.asPlayer(gp, () => game.dungeon.leave());
  game.update(0.05, input);
  assert.equal(boss.maxHp, base);
  assert.ok(Math.abs(boss.hp - base / 2) <= 1, `${boss.hp} of ${base}`);
});
