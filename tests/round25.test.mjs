import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGame, stubInput } from './helpers.mjs';
import { RNG } from '../src/util/rng.js';
import { alive } from '../src/sim/econ.js';
import { Creature } from '../src/entities/creature.js';
import { STYLES, styleOf, beginAttack, tickAttack, roll, resolveHit, parryWindow } from '../src/game/combat.js';
import { beginDraw, tickDraw, releaseDraw, arrowStrikes } from '../src/game/archery.js';
import { throwDice, tickDice } from '../src/game/dicegame.js';
import { gemText, onBlock } from '../src/game/gems.js';
import { socketed } from '../src/world/items.js';
import { LEAVES, B } from '../src/world/blocks.js';
import { GROUND } from '../src/config.js';

function start(seed = 12345, opts = {}, minute = 10 * 60) {
  const game = makeGame(seed, opts);
  const input = stubInput();
  game.minute = minute;
  for (let i = 0; i < 20; i++) game.update(0.1, input);
  const [sid, a] = [...game.active][0];
  return { game, input, sid, a, L: a.layout, p: game.player };
}
const run = (game, input, n, dt = 0.1) => {
  for (let i = 0; i < n; i++) game.update(dt, input);
};
const people = (L) => L.npcs.filter((r) => alive(r) && !r.away && !r.migrated && !r.visitor);

function dummy(game, at, dx = 1, dz = 0, species = 'wolf') {
  const w = new Creature(game, species, at.x + dx, at.y, at.z + dz);
  game.addCreature(w);
  w.hp = w.maxHp = 200;
  w.S = { ...w.S, mode: 'passive' };
  w.stunT = 1e9;
  return w;
}

// Someone standing a few paces off in the open, held still.
function standee(game, a, p, dx = 4) {
  for (const d of [dx, -dx]) {
    const y = game.world.findStandY(p.x + d, p.z, p.y);
    if (y !== p.y) continue;
    const n = a.npcs.find((q) => !q.dead && q.rec.job !== 'guard' && q.rec.age === 'adult');
    if (!n) return null;
    n.teleport(p.x + d, y, p.z);
    n.stunT = 1e9;
    return n;
  }
  return null;
}

// ------------------------------------------------------------ combat fixes
test('a string of blows reaches only as far as the weapon does', () => {
  const { game } = start();
  const g = game.npcs.find((n) => n.rec.job === 'guard' && !n.dead);
  if (!g) return;
  g.rec.equipment.tool = 'iron_sword';
  g.rec.equipment.shield = null;
  const v = dummy(game, g);
  g.attackCd = 0;
  assert.ok(beginAttack(game, g, v, styleOf(g), { combo: 2 }));
  // They back off two paces before the next blow comes: it falls short.
  for (let i = 0; i < 40 && g.windup && v.hp === v.maxHp; i++) tickAttack(game, g, 0.05);
  v.teleport(g.x + 3, g.y, g.z);
  for (let i = 0; i < 80 && g.windup; i++) {
    tickAttack(game, g, 0.05);
    if (g.windup) for (const t of g.windup.tiles) assert.ok(Math.max(Math.abs(t.x - g.x), Math.abs(t.z - g.z)) <= 1, `a sword reaches a pace (${t.x - g.x},${t.z - g.z})`);
  }
});

test('parrying wants sharper timing; heavy weapons swing a little slower in your hands', () => {
  const { game } = start();
  assert.ok(parryWindow(game) <= 0.2 + 1e-9);
  assert.ok(STYLES.great.pw >= 0.42 && STYLES.maul.pw >= 0.44 && STYLES.axe.pw >= 0.27);
  assert.ok(STYLES.sword.pw < 0.2, 'light blades as quick as ever');
});

test('weapons taken at arrest include the blade in your off hand, and come back to it', () => {
  const { game, sid, p } = start();
  p.inv[p.selected] = { item: 'iron_sword', count: 1 };
  p.equip.shield = 'dagger';
  const taken = game.sim.justice.confiscateWeapons(sid);
  assert.ok(taken.some((q) => q.item === 'dagger'), 'the dagger too');
  assert.equal(p.equip.shield, null);
  game.sim.justice.returnWeapons(false);
  assert.equal(p.equip.shield, 'dagger', 'back in the off hand');
});

// ------------------------------------------------------------ townsfolk
test('someone killed in their bed stays dead', () => {
  const { game, input, sid, a, p } = start(12345, {}, 2 * 60);
  run(game, input, 40, 0.25);
  const sleeper = a.npcs.find((n) => !n.dead && n.sleeping && n.rec.job !== 'guard');
  assert.ok(sleeper, 'someone asleep');
  const rec = sleeper.rec;
  game.damage(sleeper, 999, p);
  assert.ok(!alive(rec));
  assert.ok(game.deadNpcs.get(sid)?.has(rec.idx));
  run(game, input, 40, 0.25);
  assert.ok(!game.npcs.some((n) => n.rec === rec && !n.dead), 'not back in their bed');
});

test('someone in a panic who reaches safety cowers instead of spinning on the spot', () => {
  const { game, input, a } = start();
  const n = a.npcs.find((q) => !q.dead && q.rec.job !== 'guard' && q.rec.age === 'adult' && !q.sleeping);
  const wolf = dummy(game, n, 6, 0);
  n.startFlee(wolf, null);
  n.fleeGoal = { x: n.x, y: n.y, z: n.z };
  n.fleeSet = 0;
  let turns = 0;
  let dir = n.dir;
  for (let i = 0; i < 60; i++) {
    n.stateT += 0.05;
    n.flee(0.05);
    if (n.dir !== dir) turns++;
    dir = n.dir;
  }
  assert.ok(turns <= 4, `a nervous look round now and then (${turns} turns in 3s)`);
  void input;
});

test('a guard on duty walking past notices you breaking into a house', () => {
  const { game, L } = start();
  const sim = game.sim;
  const g = game.npcs.find((n) => n.rec.job === 'guard' && !n.dead && !n.sleeping);
  if (!g) return;
  // (On their rounds: the watch is looking out for exactly this.)
  g.state = 'routine';
  let seen = 0;
  for (let k = 0; k < 20; k++) {
    // (Each moment's its own chance.)
    game.minute += 3;
    const d = 3 + (k % 3);
    if (sim.notices(g, d, 7, g.x + d, g.z + k)) seen++;
  }
  assert.ok(seen >= 12, `the watch notices (${seen} of 20)`);
  void L;
});

test('merchants set out their dearest goods', () => {
  // (Seed 8: a town with a shop.)
  const { game, L } = start(8);
  const m = game.npcs.find((n) => n.rec.job === 'merchant' && n.wareStock && n.wareStock());
  assert.ok(m, 'a merchant');
  // Behind a counter in the shop (or any table in town).
  const w0 = game.world;
  const b = L.buildings[m.rec.work.building];
  let at = null;
  const look = (x0, z0, x1, z1) => {
    for (let z = z0; z <= z1 && !at; z++) {
      for (let x = x0; x <= x1 && !at; x++) {
        const id = w0.getBlock(x, GROUND, z);
        if (id !== B.counter && id !== B.table) continue;
        for (const [dx, dz] of [[0, 1], [1, 0], [-1, 0], [0, -1]]) {
          if (w0.getBlock(x + dx, GROUND, z + dz) === B.air && w0.getBlock(x + dx, GROUND + 1, z + dz) === B.air && !game.entityAt(x + dx, GROUND, z + dz)) {
            at = { x: x + dx, z: z + dz };
            break;
          }
        }
      }
    }
  };
  if (b) look(b.x0, b.z0, b.x1, b.z1);
  if (!at) look(L.bounds.x0, L.bounds.z0, L.bounds.x1, L.bounds.z1);
  assert.ok(at, 'a counter to stand at');
  m.teleport(at.x, GROUND, at.z);
  const w = m.wareStock();
  for (const k of Object.keys(w.store)) w.store[k] = 0;
  Object.assign(w.store, { bread: 9, cloth: 6, iron_sword: 3, gem: 2 });
  m.atGoal = true;
  m.moveT = 1;
  m.rng = new RNG(1);
  for (let i = 0; i < 2; i++) {
    m.wareT = 0;
    m.showWares(0.1);
  }
  const shown = m.shownWares().map((q) => q.got.item);
  assert.ok(shown.length >= 1, 'something out');
  assert.ok(shown.every((k) => k === 'gem' || k === 'iron_sword'), `the best of it (${shown.join(',')})`);
});

// ------------------------------------------------------------ bows
test('a bow is drawn by holding, loosed where you aim, and a shot to the head hits half as hard again', () => {
  const { game, a, p } = start();
  p.inv[p.selected] = { item: 'bow', count: 1 };
  p.inv[(p.selected + 1) % p.inv.length] = { item: 'arrow', count: 10 };
  const t = standee(game, a, p);
  if (!t) return;
  const shot = (up, secs) => {
    game.cursor = { entity: t, entUp: up, x: t.x, z: t.z };
    p.attackCd = 0;
    p.stamina = 10;
    t.hp = t.maxHp = 40;
    assert.ok(beginDraw(game));
    for (let i = 0; i < secs * 20; i++) tickDraw(game, 0.05, true);
    const power = p.bowDraw.power;
    const tired = 10 - p.stamina;
    assert.equal(roll(game, p, [0, 1]), false, 'no rolling with an arrow on the string');
    const loosed = releaseDraw(game);
    // (A clean loose's crit, out of the way.)
    for (const q of game.projectiles) if (q.aimed) q.dmg = Math.min(q.dmg, 4);
    for (let i = 0; i < 40; i++) game.updateProjectiles(0.05);
    return { power, tired, loosed, dmg: 40 - t.hp };
  };
  const body = shot(0.3, 1);
  assert.equal(body.power, 1);
  assert.ok(body.tired > 0.5, 'drawing costs breath');
  assert.ok(body.loosed && body.dmg >= 3, `it flies true (${body.dmg})`);
  const head = shot(0.9, 1);
  assert.ok(head.dmg >= Math.round(body.dmg * 1.5) - 1, `in the head (${head.dmg} vs ${body.dmg})`);
  const twitch = shot(0.3, 0.1);
  assert.equal(twitch.loosed, false, 'barely drawn: let down again');
  assert.equal(twitch.dmg, 0);
  const held = shot(0.3, 4);
  assert.ok(held.tired > body.tired, 'holding a full draw tires the arm');
});

test('drawing slows your step, and a bow never digs', async () => {
  const src = await import('node:fs').then((fs) => fs.readFileSync(new URL('../src/entities/player.js', import.meta.url), 'utf8'));
  assert.match(src, /bowDraw \? 1\.6 : 1/);
  const { game, p } = start();
  p.inv[p.selected] = { item: 'bow', count: 1 };
  p.inv[(p.selected + 1) % p.inv.length] = { item: 'arrow', count: 5 };
  const x = p.x + 1;
  const y = p.y - 1;
  const id = game.world.getBlock(x, y, p.z);
  game.cursor = { x, y, z: p.z, block: { id, hardness: 1 }, inReach: true, face: 'top' };
  game.handleMouse(0.05, [{ type: 'down', button: 0 }], { mouse: { down: true } });
  assert.ok(p.bowDraw, 'drawing, not digging');
  for (let i = 0; i < 40; i++) game.handleMouse(0.05, [], { mouse: { down: true } });
  assert.equal(game.mining, null);
  assert.equal(game.world.getBlock(x, y, p.z), id);
});

test('a shield turned toward the archer stops most arrows; arrows to the head hurt more', () => {
  const { game, a, p } = start();
  const g = a.npcs.find((n) => !n.dead && n.rec.job === 'guard');
  if (!g) return;
  g.rec.equipment.shield = 'iron_shield';
  g.rec.equipment.tool = 'iron_sword';
  let blocked = 0;
  for (let i = 0; i < 40; i++) {
    g.hp = g.maxHp = 500;
    g.face(p.x, p.z);
    const shot = { from: p, kind: 'arrow', dmg: 4, x0: p.x, z0: p.z };
    if (!arrowStrikes(game, shot, g)) blocked++;
  }
  assert.ok(blocked >= 24, `blocked easily (${blocked} of 40)`);
  // Headshots by archers, now and then.
  const archer = a.npcs.find((n) => !n.dead && n !== g && n.rec.job === 'guard') || g;
  let heads = 0;
  const texts = [];
  game.renderer.floatText = (x, y, z, s) => texts.push(s);
  p.hp = p.maxHp = 9999;
  for (let i = 0; i < 200; i++) arrowStrikes(game, { from: archer, kind: 'arrow', dmg: 4 }, p);
  heads = texts.filter((s) => s === 'headshot!').length;
  assert.ok(heads >= 8 && heads <= 60, `some in the head (${heads} of 200)`);
});

// ------------------------------------------------------------ battles and raids
test('a raid stops your waiting; you can\'t wait with a fight going on', () => {
  const { game, L } = start(12345, { learned: false }, 22 * 60);
  const W = game.sim.war;
  const to = L.settlement;
  const from = game.world.ow.settlements.find((s) => s.civ && s.civ !== to.civ && game.sim.layoutOf(s.id) && people(game.sim.layoutOf(s.id)).filter((r) => r.job === 'guard').length >= 3);
  game.sim.realms.shift(from.civ, to.civ, -90, game.day);
  const raid = W.planRaid(from.civ, to.civ, from, to, game.day, new RNG(5));
  assert.ok(raid);
  assert.ok(game.startWait(4, true));
  assert.ok(game.waiting);
  raid.at = game.sim.abs;
  W.update(0.1);
  assert.ok(W.live && W.live.kind === 'raid');
  assert.equal(game.waiting, null, 'up at once');
  assert.equal(game.startWait(2, true), false, 'no sitting it out');
});

test('a battle where one side never comes to blows doesn\'t go on forever', () => {
  const game = makeGame(12345, { learned: false });
  const input = stubInput();
  game.minute = 600;
  run(game, input, 20);
  const [, a0] = [...game.active][0];
  const L = a0.layout;
  for (const s of game.world.ow.settlements) game.sim.layoutOf(s.id);
  const W = game.sim.war;
  const home = L.settlement;
  const foeTown = game.world.ow.settlements.find((s) => s.civ && s.civ !== home.civ && game.sim.layoutOf(s.id)?.econ);
  game.sim.realms.shift(home.civ, foeTown.civ, -100, game.day);
  const w = W.declare(home.civ, foeTown.civ, { k: 'land', text: 'land' }, game.day, new RNG(2));
  const bd = home.bounds;
  const site = { x: bd.x0 - 22, z: Math.round((bd.z0 + bd.z1) / 2) };
  game.loadAround(site.x, site.z, true);
  const p = game.player;
  p.teleport(site.x + 3, game.world.findStandY(site.x + 3, site.z - 8, 6), site.z - 8);
  w.plan = { at: game.sim.abs, site, biome: 'plains', river: false, name: 'the Battle of Test Field', attacker: 'b', atk: foeTown.id, def: home.id, ca: home.civ.id, cb: foeTown.civ.id };
  W.chooseTactic = () => 'hold';
  W.update(0.1);
  const live = W.live;
  assert.ok(live);
  // (Both sides dug in, nobody moving: a standoff.)
  for (const n of [...live.sides.a.ents, ...live.sides.b.ents]) {
    n.stunT = 1e9;
    if (n.warband) n.warband.phase = 'form';
  }
  for (let i = 0; i < 600 && !live.done; i++) game.update(0.25, input);
  assert.ok(live.done, 'over');
  assert.ok(live.t < 140, `in a minute or two (${live.t.toFixed(0)}s)`);
});

// ------------------------------------------------------------ dice
test('you can throw dice on a table, and a player at it may take you on for a coin', () => {
  const { game, input, p, a } = start();
  p.inv[p.selected] = { item: 'dice', count: 2 };
  p.give('coin', 5);
  let rolled = 0;
  game.renderer.rollDice = () => rolled++;
  const rival = a.npcs.find((n) => !n.dead && n.rec.age === 'adult' && n.rec.job !== 'guard');
  rival.rec.hobbies = [...(rival.rec.hobbies || []), 'dice'];
  rival.rec.coins = 5;
  rival.state = 'routine';
  const [fx, fz] = [[0, 1], [-1, 0], [0, -1], [1, 0]][p.dir];
  rival.teleport(p.x + fx * 2, p.y, p.z + fz * 2);
  rival.sleeping = false;
  assert.ok(throwDice(game));
  assert.equal(rolled, 1);
  const coins0 = p.inv.reduce((n, q) => n + (q && q.item === 'coin' ? q.count : 0), 0);
  for (let i = 0; i < 80 && game.diceGame; i++) tickDice(game, 0.05);
  assert.equal(game.diceGame, null, 'played out');
  assert.equal(rolled, 2, 'they threw too');
  const coins1 = p.inv.reduce((n, q) => n + (q && q.item === 'coin' ? q.count : 0), 0);
  assert.ok(Math.abs(coins1 - coins0) <= 1, 'a coin either way (or even)');
  void input;
});

// ------------------------------------------------------------ the night
test('skeletons carry all sorts, and fight the way of what they carry', () => {
  const { game, p } = start();
  const arms = new Set();
  for (let i = 0; i < 80; i++) arms.add(new Creature(game, 'skeleton', p.x, p.y, p.z).arms);
  for (const k of ['stone_sword', 'hand_axe', 'wooden_spear', 'club', 'bow']) assert.ok(arms.has(k), k);
  const sk = new Creature(game, 'skeleton', p.x, p.y, p.z);
  sk.arms = 'wooden_spear';
  assert.equal(styleOf(sk), STYLES.spear);
  sk.arms = 'hand_axe';
  assert.equal(styleOf(sk), STYLES.axe);
  assert.equal(sk.heldItem(), 'hand_axe');
});

test('new things in the night: ghouls rake three times over, wisps throw cold fire from afar', () => {
  const { game, input, p } = start();
  game.isDay = () => false;
  // A ghoul's rakes: three strokes from one wind-up, hard on a guard.
  const gh = new Creature(game, 'ghoul', p.x + 1, p.y, p.z);
  game.addCreature(gh);
  const v = dummy(game, gh, 1, 0);
  gh.attackCd = 0;
  assert.ok(beginAttack(game, gh, v, STYLES.rake));
  let hits = 0;
  let hp = v.hp;
  for (let i = 0; i < 80 && gh.windup; i++) {
    tickAttack(game, gh, 0.05);
    if (v.hp < hp) {
      hits++;
      hp = v.hp;
    }
  }
  assert.equal(hits, 3, 'three rakes');
  assert.ok(STYLES.rake.drain > 1, 'each costs more to block');
  // A wisp at a distance gathers itself and lobs.
  let lobs = 0;
  const orig = game.lobOrb.bind(game);
  game.lobOrb = (...q) => {
    lobs++;
    return orig(...q);
  };
  let wx = null;
  for (const d of [5, -5]) if (game.world.findStandY(p.x + d, p.z, p.y) > 0) wx = d;
  if (wx === null) return;
  const wisp = new Creature(game, 'wisp', p.x + wx, game.world.findStandY(p.x + wx, p.z, p.y), p.z);
  game.addCreature(wisp);
  wisp.target = p;
  p.hp = p.maxHp = 500;
  for (let i = 0; i < 120 && !lobs; i++) game.update(0.05, input);
  assert.ok(lobs >= 1, 'cold fire');
});

// ------------------------------------------------------------ gems
test('a stone in a shield works when it turns a blow; one in armour when you roll', () => {
  const { game, p } = start();
  assert.match(gemText(socketed('iron_shield', 'amethyst')), /Bulwark: a parry throws every foe/);
  assert.match(gemText(socketed('iron_helmet', 'sapphire')), /rolling takes less breath/);
  // An amethyst shield throws them back.
  p.equip.shield = socketed('iron_shield', 'amethyst');
  const w = dummy(game, p, 1, 0);
  w.stunT = 0;
  const x0 = w.x;
  onBlock(game, p, w, false);
  assert.ok(w.x !== x0 || w.moving, 'thrown back');
  // (Round 26: each shield stone its own way.) A sapphire shield ices
  // over with each blow it turns; the third freezes the attacker solid.
  p.equip.shield = socketed('iron_shield', 'sapphire');
  const ice = dummy(game, p, 0, 1);
  for (let i = 0; i < 3; i++) onBlock(game, p, ice, false);
  assert.ok(ice.frozenT > 0, 'frozen solid');
  // An emerald shield gathers what it turns as light, to mend you later.
  p.equip.shield = socketed('iron_shield', 'emerald');
  const wolf = dummy(game, p, -1, 0);
  p.wardStore = 0;
  onBlock(game, p, wolf, false, 3);
  assert.ok(p.wardStore > 0, 'light gathered');
  void parryWindow;
  void resolveHit;
  void STYLES;
});

// ------------------------------------------------------------ wildlife
test('the woods are alive: birds nest in the trees, owls at night, and the farms keep beasts', () => {
  const { game, input, p, L } = start();
  const w = game.world;
  let spot = null;
  for (let r = 20; r < 90 && !spot; r += 6) {
    for (let k = 0; k < 16 && !spot; k++) {
      const x = Math.round(p.x + Math.cos((k / 16) * Math.PI * 2) * r);
      const z = Math.round(p.z + Math.sin((k / 16) * Math.PI * 2) * r);
      game.loadAround(x, z, true);
      let leaves = 0;
      for (let dz = -6; dz <= 6; dz++) for (let dx = -6; dx <= 6; dx++) for (let y = GROUND + 2; y < GROUND + 12; y++) if (LEAVES.has(w.getBlock(x + dx, y, z + dz))) {
        leaves++;
        break;
      }
      if (leaves > 20) spot = { x, z };
    }
  }
  if (!spot) return;
  p.teleport(spot.x, w.findStandY(spot.x, spot.z, GROUND), spot.z);
  run(game, input, 100);
  const W = game.wildlife;
  assert.ok(W.nests.length >= 1, 'nests');
  assert.ok(W.birds.some((b) => b.kind === 'song'), 'songbirds');
  for (let i = 0; i < 100; i++) W.updateFlies(0.1, true);
  assert.ok(W.flies.length >= 1, 'butterflies on a fine day');
  game.minute = 23 * 60;
  run(game, input, 50);
  assert.equal(W.flies.length, 0, 'none at night');
  if (W.birds.some((b) => b.kind === 'owl')) assert.ok(W.birds.filter((b) => b.kind === 'song').every((b) => b.state !== 'ground'), 'songbirds home to roost');
  // The town's beasts by its fields.
  const beasts = game.creatures.filter((c) => c.livestock === L.settlement.id);
  if (L.fields.length) assert.ok(beasts.length >= 1 && beasts.every((c) => ['pig', 'sheep', 'cow'].includes(c.species)), 'pigs, sheep, cows');
});
