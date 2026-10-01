// What people look like while they're at something: the dice rolling across
// the table, the cook at the hearth with the pot on and the steam rising,
// the barkeep pouring and the mug set down (and drunk, and left empty for
// someone to clear), food going down a bite at a time, smoke from a pipe,
// notes off a lute, sparks off the grindstone. Called each tick while
// someone is where they meant to be (see NPC.atGoal); returns true when
// that's all they do this tick.
import { B } from '../world/blocks.js';
import { GROUND } from '../config.js';
import { ITEMS } from '../world/items.js';
import { buildingAt } from '../sim/sim.js';

const FIRE = ['#ff7a2a', '#ffb03a', '#ffe48a'];
const STEAM = ['#eceef4', '#d0d4dc', '#b8bcc8'];
const SMOKE = ['#9a9aa2', '#b4b4ba', '#7e7e86'];
const FLOUR = ['#f4f0e4', '#e8e0cc', '#ffffff'];
const SAWDUST = ['#d8b07a', '#c49660', '#e8c890'];
const SPARK = ['#fff4b0', '#ffd040', '#ffffff'];
const GOLD = ['#ffe070', '#fff4c0'];
const NOTES = ['#ff9ad0', '#9ad0ff', '#c8ff9a', '#ffe08a'];
const INK = ['#2a2a3a', '#4a4a6a'];
const DIRT = ['#8a6a44', '#6a5034', '#a8885c'];
const FOAM = ['#f4ecd8', '#ffffff', '#e8c060'];

// Dishes a cook might have on the go.
const COOKING = ['stew', 'cooked_meat', 'cooked_fish', 'feast', 'gruel'];
// What's left on a table to be cleared.
export const MESS = new Set(['dirty_dish', 'empty_mug']);

// A puff of something at a tile (y in blocks; up/oy in pixels).
function puff(game, x, y, z, color, o = {}) {
  game.renderer.emit(x, y, z, { n: o.n ?? 1, color, shape: 'puff', size: o.size ?? 1, grow: o.grow ?? 3, up: o.up ?? 10, speed: o.speed ?? 6, gravity: o.gravity ?? -8, life: o.life ?? 1.6, oy: o.oy ?? -4, spreadX: o.spreadX ?? 3, spreadY: 2 });
}

const near = (n) => n.distTo(n.game.player) < 22;

// Someone's mouth, for crumbs and smoke (in the emit's terms).
const mouth = (n) => ({ x: n.x, y: n.y + 1, z: n.z, oy: n.rec.age === 'child' ? 4 : -2 });

// The hearth (the fire in the house, the tavern's stove) of a building, and
// a spot beside it to stand, found once.
function hearthOf(n, b) {
  if (!b) return null;
  if (b.hearthAt !== undefined) return b.hearthAt;
  const w = n.game.world;
  b.hearthAt = null;
  for (let z = b.z0; z <= b.z1 && !b.hearthAt; z++) {
    for (let x = b.x0; x <= b.x1 && !b.hearthAt; x++) {
      const id = w.getBlock(x, GROUND, z);
      if (id !== B.furnace && id !== B.oven) continue;
      for (const [dx, dz] of [[0, 1], [1, 0], [-1, 0], [0, -1]]) {
        if (w.canStand(x + dx, GROUND, z + dz)) {
          b.hearthAt = { x, z, sx: x + dx, sz: z + dz, oven: id === B.oven };
          break;
        }
      }
    }
  }
  return b.hearthAt;
}

// ------------------------------------------------------------ eating
// A plate in front of them: a bite at a time, crumbs flying, the food on
// the plate going down.
export function eatMeal(n, dt) {
  const m = n.meal;
  const game = n.game;
  n.biteT = (n.biteT ?? n.rng.float(0.5, 1.5)) - dt;
  if (n.biteT > 0) return;
  n.biteT = n.rng.float(1.8, 3.4);
  n.face(m.x, m.z);
  n.doAction(0.3);
  const got = game.placed && game.placed.get(`${m.x},${m.y},${m.z}`);
  if (!got || !got.meal) return;
  got.chew = (got.chew || 0) + 1;
  if (got.chew % 2 === 0) got.bites = Math.min(3, (got.bites || 0) + 1);
  if (!near(n)) return;
  game.renderer.emit(m.x, m.y, m.z, { n: 3, chunk: got.item, up: 22, speed: 18, gravity: 120, life: 0.5, oy: 6 });
  const mo = mouth(n);
  game.renderer.emit(mo.x, mo.y, mo.z, { n: 2, chunk: got.item, up: 10, speed: 14, gravity: 140, life: 0.4, oy: mo.oy });
  if (n.rng.chance(0.3)) game.audio?.play('eat', n);
  if (n.lineCd <= 0 && n.rng.chance(0.08)) {
    n.lineCd = n.rng.float(20, 40);
    n.say(n.rng.pick(['Mm.', 'Good, this.', 'Just what I needed.', '*munch*']), 2);
  }
}

// Eating something in the hand (no table to set it on): it goes in a bite
// at a time.
function snack(n, dt) {
  const item = n.snackItem;
  if (!item) return;
  n.biteT = (n.biteT ?? n.rng.float(0.5, 1.5)) - dt;
  if (n.biteT > 0) return;
  n.biteT = n.rng.float(2.2, 4);
  n.doAction(0.3);
  if (!near(n)) return;
  const mo = mouth(n);
  n.game.renderer.emit(mo.x, mo.y, mo.z, { n: 3, chunk: item, up: 16, speed: 18, gravity: 140, life: 0.45, oy: mo.oy });
  if (n.rng.chance(0.25)) n.game.audio?.play('eat', n);
}

// ------------------------------------------------------------ drinking
// Sat down at the tavern for a drink: the barkeep pours, and a mug goes
// down in front of them.
function orderDrink(n, b) {
  const game = n.game;
  if (n.drink || n.drinkOrder || (n.drinkCd || 0) > 0) return;
  const at = n.surfaceNear(2);
  if (!at) return;
  n.drinkOrder = { ...at, t: 1.4 };
  const keeper = game.npcs.find((q) => !q.dead && !q.sleeping && q.layout === n.layout && (q.rec.job === 'barkeep' || q.rec.job === 'innkeeper') && buildingAt(q.layout, q.x, q.z) === b && q.distTo(n) < 14);
  if (keeper) {
    // At the barrel: tap open, the ale runs.
    keeper.face(n.x, n.z);
    keeper.doAction(0.6);
    keeper.pourT = 1.2;
    if (near(n)) {
      game.renderer.emit(keeper.x, keeper.y + 1, keeper.z, { n: 6, color: ['#e8a030', '#c88020', '#f4ecd8'], shape: 'drop', up: 4, speed: 6, gravity: 140, life: 0.5, oy: 2 });
      game.audio?.play('pour', keeper);
      if (keeper.rng.chance(0.35)) keeper.sayLater?.(keeper.rng.pick([`One ale for ${n.rec.name.first}.`, 'Here you go.', 'Mind the foam.', 'Coming up!']), 0.8, 2.5);
    }
  }
}

function drinkTick(n, dt) {
  const game = n.game;
  const o = n.drinkOrder;
  if (o) {
    o.t -= dt;
    if (o.t > 0) return;
    n.drinkOrder = null;
    const owner = { sid: n.layout.settlement.id, idx: n.rec.idx, name: n.name };
    if (game.world.getBlock(o.x, o.y, o.z) !== B.air || !game.setDown(o.x, o.y, o.z, 'ale', 1, owner)) return;
    game.placed.get(`${o.x},${o.y},${o.z}`).drink = true;
    n.drink = { x: o.x, y: o.y, z: o.z, sips: 0, need: n.rng.int(4, 6) };
    if (near(n)) game.audio?.play('place', n);
    return;
  }
  const d = n.drink;
  if (!d) return;
  const got = game.placed && game.placed.get(`${d.x},${d.y},${d.z}`);
  if (!got || got.item !== 'ale') {
    n.drink = null;
    return;
  }
  n.sipT = (n.sipT ?? n.rng.float(1, 3)) - dt;
  if (n.sipT > 0) return;
  n.sipT = n.rng.float(3.5, 6.5);
  n.face(d.x, d.z);
  n.doAction(0.45);
  d.sips++;
  if (near(n)) {
    game.renderer.emit(d.x, d.y, d.z, { n: 3, color: FOAM, up: 18, speed: 10, gravity: 90, life: 0.5, oy: 4 });
    const mo = mouth(n);
    game.renderer.emit(mo.x, mo.y, mo.z, { n: 2, color: FOAM, shape: 'drop', up: 6, speed: 8, gravity: 120, life: 0.4, oy: mo.oy + 2 });
    if (n.rng.chance(0.25)) game.audio?.play('pour', n);
  }
  if (d.sips >= d.need) finishDrink(n, true);
  else if (n.lineCd <= 0 && n.rng.chance(0.1) && near(n)) {
    n.lineCd = n.rng.float(15, 35);
    n.say(n.rng.pick(['Ahh. That\'s the stuff.', 'Good ale, this.', 'To your health!', 'Another round soon, I think.']), 2.5);
  }
}

// The mug's done (or they're off): an empty one left on the table.
export function finishDrink(n, drained = false) {
  n.drinkOrder = null;
  const d = n.drink;
  if (!d) return;
  n.drink = null;
  n.drinkCd = drained ? n.rng.float(30, 90) : 20;
  const placed = n.game.placed;
  const k = `${d.x},${d.y},${d.z}`;
  const got = placed && placed.get(k);
  if (got && got.item === 'ale' && got.drink) placed.set(k, { item: 'empty_mug', count: 1, owner: { mess: true, sid: n.layout.settlement.id } });
  if (drained && near(n) && n.rng.chance(0.4)) n.say(n.rng.pick(['*hic*', 'Ahh.', 'That\'s me done.']), 2);
}

// ------------------------------------------------------------ dice
// A throw of the dice onto the table, everyone round it leaning in.
function diceTick(n, dt) {
  const game = n.game;
  n.diceT = (n.diceT ?? n.rng.float(1, 4)) - dt;
  if (n.diceT > 0) return;
  n.diceT = n.rng.float(5, 9);
  const t = tableNear(n) || { x: n.x + [0, -1, 0, 1][n.dir], y: n.y, z: n.z + [1, 0, -1, 0][n.dir], floor: true };
  n.face(t.x, t.z);
  n.doAction(0.4);
  if (!near(n)) return;
  // Two dice (three, now and then), thrown onto the table to roll.
  const faces = Array.from({ length: n.rng.chance(0.35) ? 3 : 2 }, () => n.rng.int(1, 6));
  // (Where they come to rest on screen, below the layer above: a table top
  // sits lower than a full block; on the floor, where feet stand.)
  const to = { x: t.x, y: t.floor ? t.y : t.y + 1, z: t.z, oy: t.floor ? 10 : 15 };
  game.renderer.rollDice?.({ from: { x: n.x, y: n.y, z: n.z }, to, faces });
  game.audio?.play('dig', n);
  const total = faces.reduce((m, f) => m + f, 0);
  const same = faces.every((f) => f === faces[0]);
  const many = faces.length === 3;
  const line = same && many ? `Triple ${faces[0]}s!` : same && faces[0] === 1 ? 'Snake eyes!' : same && faces[0] === 6 ? 'Double sixes!' : same ? `Doubles! ${faces[0]} and ${faces[1]}!`
    : total >= (many ? 15 : 10) ? `${total}! Pay up!` : total <= (many ? 6 : 4) ? `${total}... curse it.` : null;
  if (line && n.rng.chance(0.7)) n.sayLater?.(line, 1.4, 2.5);
  // The others at the table watch it land, and cheer or groan.
  for (const q of game.npcs) {
    if (q === n || q.dead || q.sleeping || q.layout !== n.layout || q.distTo(n) > 2.5 || !q.atGoal) continue;
    q.face(t.x, t.z);
    if (line && q.rng.chance(0.4)) q.sayLater?.(q.rng.pick(total >= (many ? 15 : 10) ? ['Lucky dog!', 'Again!', 'Hah!'] : ['Hard luck.', 'My turn!', 'Ha!']), 1.4, 2.2);
  }
}

// A table (or counter) right beside them, the top clear.
function tableNear(n) {
  const w = n.game.world;
  for (const [dx, dz] of [[0, 1], [1, 0], [-1, 0], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
    const id = w.getBlock(n.x + dx, n.y, n.z + dz);
    if (id === B.table || id === B.counter) return { x: n.x + dx, y: n.y, z: n.z + dz };
  }
  return null;
}

// ------------------------------------------------------------ cooking
// Off to the hearth for a while with the pot on (a cook between serving,
// someone at home of a morning), and back.
function hearthTrip(n, b, dt, minutes) {
  const h = hearthOf(n, b);
  if (!h) return false;
  const c = n.cooking;
  if (!c) {
    n.cookWait = (n.cookWait ?? n.rng.float(8, 30)) - dt;
    if (n.cookWait > 0) return false;
    n.cookWait = n.rng.float(30, 70);
    n.cooking = { h, t: minutes ?? n.rng.float(14, 26), dish: n.rng.pick(h.oven ? ['bread', 'pie'] : COOKING), back: n.goal };
    n.goal = { x: h.sx, y: GROUND, z: h.sz, face: 0, tag: 'cook', cookAt: true };
    n.atGoal = false;
    n.path = null;
    return true;
  }
  if (!n.goal || !n.goal.cookAt) {
    n.cooking = null;
    return false;
  }
  c.t -= dt;
  n.face(h.x, h.z);
  n.cookFx = (n.cookFx ?? 0) - dt;
  if (n.cookFx <= 0) {
    n.cookFx = n.rng.float(0.9, 1.6);
    n.doAction(0.35);
    if (near(n)) {
      const g = n.game;
      // Flames lick up as the fire's stirred, the pot steams.
      g.renderer.emit(h.x, GROUND + 1, h.z, { n: 4, color: FIRE, up: 22, speed: 14, gravity: -30, life: 0.5, oy: 2, glow: true });
      puff(g, h.x, GROUND + 1, h.z, STEAM, { n: 2, oy: -6, grow: 4, life: 1.8 });
      // Now and then a toss of the pan (or a loaf out of the oven).
      if (n.rng.chance(0.3)) g.renderer.emit(h.x, GROUND + 1, h.z, { n: 3, chunk: c.dish, up: 40, speed: 10, gravity: 160, life: 0.6, oy: -2 });
      if (n.rng.chance(0.35)) g.audio?.play(h.oven ? 'place' : 'torch', n);
    }
  }
  if (c.t <= 0) {
    n.cooking = null;
    if (n.lineCd <= 0 && near(n) && n.rng.chance(0.5)) {
      n.lineCd = n.rng.float(20, 40);
      n.say(n.rng.pick(h.oven ? ['Fresh out of the oven!', 'That\'ll be golden.', 'Mind, it\'s hot.'] : [`${ITEMS[c.dish]?.name || 'Stew'}'s on!`, 'Smells about right.', 'A pinch more salt...', 'Who\'s hungry?']), 2.5);
    }
    n.goal = c.back && !c.back.cookAt ? c.back : null;
    if (!n.goal) n.activity = null;
    n.atGoal = false;
    n.path = null;
  }
  return true;
}

// Who puts the pot on at home: the first grown-up of the house.
function homeCook(n, b) {
  const r = n.layout.npcs.find((q) => q.home === b.id && q.age === 'adult' && q.alive !== false && !q.away);
  return r === n.rec;
}

// ------------------------------------------------------------ the rest
// Little things for each pastime and trade.
function flourish(n, act, g, dt) {
  const game = n.game;
  const R = game.renderer;
  const hobby = act.act === 'hobby' ? act.hobby : null;
  const job = act.act === 'work' ? n.rec.job : null;
  const target = (n.spot && n.spot.target) || g.target || null;
  const at = target ? { x: target.x, y: GROUND + 1, z: target.z } : { x: n.x + [0, -1, 0, 1][n.dir], y: n.y + 1, z: n.z + [1, 0, -1, 0][n.dir] };
  n.fxT = (n.fxT ?? n.rng.float(0, 1)) - dt;
  if (n.fxT > 0) return;
  const mo = mouth(n);
  if (hobby === 'music') {
    n.fxT = n.rng.float(0.45, 0.9);
    if (n.rng.chance(0.5)) n.doAction(0.2);
    R.emit(mo.x, mo.y, mo.z, { n: 1, color: NOTES, shape: 'note', up: 18, speed: 14, gravity: -6, life: 1.6, oy: mo.oy - 4 });
  } else if (hobby === 'smoking') {
    n.fxT = n.rng.float(2.2, 4);
    puff(game, mo.x, mo.y, mo.z, SMOKE, { n: 2, oy: mo.oy - 2, grow: 3, life: 2.2, up: 8 });
  } else if (hobby === 'reading' || act.act === 'study' || (job === 'scholar' && target)) {
    n.fxT = n.rng.float(4, 8);
    n.doAction(0.15);
    R.emit(at.x, at.y, at.z, { n: 1, color: job ? INK : ['#f4ecd8'], up: 6, speed: 6, gravity: 30, life: 0.4, oy: 4 });
  } else if (hobby === 'praying' || (job === 'priest' && target)) {
    n.fxT = n.rng.float(0.8, 1.6);
    R.emit(n.x, n.y + 1, n.z, { n: 1, color: GOLD, shape: 'star', up: 14, speed: 8, gravity: -10, life: 1.6, oy: -4, glow: true });
    if (job === 'priest') R.emit(at.x, at.y, at.z, { n: 1, color: FIRE, up: 8, speed: 2, gravity: -10, life: 0.5, oy: -2 });
  } else if (hobby === 'sketching') {
    n.fxT = n.rng.float(1, 2);
    n.doAction(0.15);
    R.emit(n.x, n.y + 1, n.z, { n: 1, color: INK, up: 4, speed: 6, gravity: 40, life: 0.3, oy: 2 });
  } else if (hobby === 'stargazing' && !game.isDay()) {
    n.fxT = n.rng.float(5, 10);
    n.dir = 2;
    // A falling star.
    if (near(n) && n.rng.chance(0.5)) R.emit(n.x + n.rng.int(-6, 6), n.y + 7, n.z - 4, { n: 6, color: ['#ffffff', '#c8d8ff'], shape: 'star', vx: 90, vy: 30, spreadX: 1, spreadY: 1, gravity: 0, life: 0.5, glow: true });
  } else if (hobby === 'training') {
    n.fxT = n.rng.float(0.6, 1.1);
    n.doAction(0.3);
    R.emit(at.x, at.y, at.z, { n: 2, color: SAWDUST, up: 16, speed: 24, life: 0.4, oy: -6 });
    if (near(n) && n.rng.chance(0.4)) game.audio?.play('swing', n);
  } else if (hobby === 'gardening') {
    n.fxT = n.rng.float(1, 2);
    n.doAction(0.25);
    R.emit(at.x, at.y - 1, at.z, { n: 3, color: DIRT, up: 18, speed: 16, life: 0.4, oy: 4 });
  } else if (job === 'baker' && target) {
    const oven = game.world.getBlock(target.x, GROUND, target.z) === B.oven;
    n.fxT = n.rng.float(0.8, 1.5);
    n.doAction(0.3);
    if (oven) {
      R.emit(at.x, at.y, at.z, { n: 3, color: FIRE, up: 16, speed: 10, gravity: -30, life: 0.5, oy: 2, glow: true });
      if (n.rng.chance(0.3)) R.emit(at.x, at.y, at.z, { n: 3, chunk: n.rng.pick(['bread', 'pie']), up: 26, speed: 10, gravity: 150, life: 0.5, oy: 0 });
    } else {
      // Kneading: flour everywhere.
      puff(game, at.x, at.y, at.z, FLOUR, { n: 2, oy: 2, grow: 2, life: 1, up: 12 });
    }
  } else if (job === 'blacksmith' && target) {
    n.fxT = n.rng.float(1.5, 3);
    // The forge roars when the bellows go.
    const forge = hearthOf(n, buildingAt(n.layout, n.x, n.z));
    if (forge && near(n)) R.emit(forge.x, GROUND + 1, forge.z, { n: 5, color: FIRE, up: 26, speed: 12, gravity: -40, life: 0.6, oy: 0, glow: true });
    if (game.world.getBlock(target.x, GROUND, target.z) === B.grindstone) R.emit(at.x, at.y, at.z, { n: 6, color: SPARK, up: 10, speed: 60, gravity: 60, life: 0.35, oy: -2, glow: true });
  } else if (job === 'herbalist' && target) {
    n.fxT = n.rng.float(0.8, 1.6);
    R.emit(at.x, at.y, at.z, { n: 1, color: ['#9ae07a', '#c08ae8', '#e8f0e0'], shape: 'puff', size: 1, grow: 1, up: 12, speed: 4, gravity: -12, life: 1.2, oy: -4 });
  } else if (job === 'tailor' && target) {
    n.fxT = n.rng.float(0.5, 1.1);
    n.doAction(0.2);
    R.emit(at.x, at.y, at.z, { n: 1, color: ['#c84a4a', '#4a7ac8', '#e8d8b0', '#7ac84a'], shape: 'drop', up: 10, speed: 20, gravity: 60, life: 0.4, oy: -2 });
  } else if ((job === 'carpenter' || n.rec.job === 'builder') && target) {
    n.fxT = n.rng.float(0.6, 1.2);
    n.doAction(0.3);
    R.emit(at.x, at.y, at.z, { n: 3, color: SAWDUST, up: 14, speed: 22, gravity: 120, life: 0.45, oy: -2 });
  } else if (job === 'merchant') {
    n.fxT = n.rng.float(3, 6);
    // Counting the takings: a glint of coin.
    R.emit(at.x, at.y, at.z, { n: 1, color: GOLD, shape: 'star', up: 4, speed: 2, gravity: 0, life: 0.6, oy: 2, glow: true });
    if (n.rng.chance(0.4)) n.doAction(0.2);
  } else if ((job === 'barkeep' || job === 'innkeeper') && act.act === 'work') {
    n.fxT = n.rng.float(2, 4);
    // Polishing a mug.
    n.doAction(0.3);
    R.emit(n.x, n.y + 1, n.z, { n: 1, color: ['#ffffff'], shape: 'star', up: 2, speed: 2, gravity: 0, life: 0.4, oy: 0 });
  } else n.fxT = n.rng.float(2, 4);
}

// ------------------------------------------------------------ entry
export function actFx(n, act, g, dt) {
  if (!act || n.sleeping) return false;
  const b = buildingAt(n.layout, n.x, n.z);
  // Tavern: a drink in front of them (asked for when they sit down).
  const tavern = b && b.type === 'tavern';
  if (n.drinkCd > 0) n.drinkCd -= dt;
  if (tavern && n.atGoal && (act.hobby === 'drinking' || act.act === 'social' || (act.hobby === 'dice' && n.rec.idx % 3 === 0))) orderDrink(n, b);
  if (n.drink || n.drinkOrder) drinkTick(n, dt);
  // At the table with something to eat.
  if (n.meal && act.act === 'eat') {
    eatMeal(n, dt);
    return false;
  }
  // Food in hand (at home, no plate).
  n.snackItem = act.act === 'eat' && n.atGoal && !n.meal && n.rec.lastMeal && n.rec.lastMeal.day === n.game.day ? n.rec.lastMeal.item : null;
  if (n.snackItem) snack(n, dt);
  if (act.hobby === 'dice') diceTick(n, dt);
  // Cooks go to the hearth between serving; someone at home puts the pot
  // on of a morning.
  if (act.act === 'work' && n.rec.job === 'cook' && b && hearthTrip(n, b, dt)) return true;
  if (act.act === 'eat' && b && b.residential && n.game.minute < 9 * 60 && !n.meal && homeCook(n, b) && hearthTrip(n, b, dt, n.rng.float(10, 16))) return true;
  if (n.cooking) return hearthTrip(n, b, dt);
  flourish(n, act, g, dt);
  return false;
}
