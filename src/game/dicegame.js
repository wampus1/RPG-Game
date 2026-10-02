// Dice, for you: right click with dice in hand and you throw two onto the
// table in front of you (or the floor), like anyone in a tavern, and they
// roll for real (see render/dice.js). Someone at the table who plays dice
// may take you on: they throw after you, and the higher throw takes a coin
// off the other.
import { B } from '../world/blocks.js';
import { countItem, removeItem } from './inventory.js';

const WORDS = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];

// A table (or counter) to throw on: the one you're pointing at, if it's
// close, else one beside you, else the floor in front of you.
function tableFor(game) {
  const p = game.player;
  const w = game.world;
  const c = game.cursor;
  const isTable = (id) => id === B.table || id === B.counter;
  if (c && c.block && isTable(c.block.id) && Math.max(Math.abs(c.x - p.x), Math.abs(c.z - p.z)) <= 2) return { x: c.x, y: c.y, z: c.z };
  for (const [dx, dz] of [[0, 1], [1, 0], [-1, 0], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
    if (isTable(w.getBlock(p.x + dx, p.y, p.z + dz))) return { x: p.x + dx, y: p.y, z: p.z + dz };
  }
  const [fx, fz] = [[0, 1], [-1, 0], [0, -1], [1, 0]][p.dir] || [0, 1];
  return { x: p.x + fx, y: p.y, z: p.z + fz, floor: true };
}

const landing = (t) => ({ x: t.x, y: t.floor ? t.y : t.y + 1, z: t.z, oy: t.floor ? 10 : 15 });
const roll2 = () => [1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)];

export function throwDice(game) {
  const p = game.player;
  if ((p.diceCd || 0) > 0 || game.diceGame || p.dead || p.swing || p.rollT > 0) return false;
  const t = tableFor(game);
  const faces = roll2();
  p.face(t.x, t.z);
  p.doAction(0.4);
  p.diceCd = 2;
  game.renderer.rollDice?.({ from: { x: p.x, y: p.y, z: p.z }, to: landing(t), faces });
  game.audio?.play('dig', p);
  // Anyone at the table who plays, with coin to lose, takes you on.
  const rival = game.npcs.find((q) => !q.dead && !q.sleeping && q.state === 'routine' && q.rec && (q.rec.hobbies || []).includes('dice') && (q.rec.coins || 0) > 0
    && Math.max(Math.abs(q.x - t.x), Math.abs(q.z - t.z)) <= 2) || null;
  game.diceGame = { t: 0, table: t, faces, total: faces[0] + faces[1], rival: rival && countItem(p.inv, 'coin') > 0 ? rival : null, stage: 'yours' };
  return true;
}

// Each frame: the dice coming to rest, and the other player's turn.
export function tickDice(game, dt) {
  const p = game.player;
  if (p.diceCd > 0) p.diceCd -= dt;
  const g = game.diceGame;
  if (!g) return;
  g.t += dt;
  const r = game.renderer;
  const t = g.table;
  if (g.stage === 'yours' && g.t >= 1.2) {
    const [a, b] = g.faces;
    const line = a === b ? (a === 6 ? 'Double sixes!' : a === 1 ? 'Snake eyes!' : `Doubles: ${WORDS[a]}s!`) : `${a} and ${b}: ${WORDS[g.total]}.`;
    r.floatText(t.x, t.y + 2, t.z, String(g.total), '#ffe8a0');
    game.ui.msg(`You throw the dice. ${line}`, '#ffe8a0');
    // (Whoever's watching makes a noise about it.)
    for (const q of game.npcs) {
      if (q.dead || q.sleeping || q === g.rival || Math.max(Math.abs(q.x - t.x), Math.abs(q.z - t.z)) > 3 || q.rng.chance(0.5)) continue;
      q.face(t.x, t.z);
      q.sayLater?.(q.rng.pick(g.total >= 10 ? ['Hah! Lucky.', 'Not bad!', 'Ooh!'] : g.total <= 4 ? ['Hard luck!', 'Ha!', 'Ouch.'] : ['Hm.', 'Again?']), 0.3, 2);
    }
    if (!g.rival || g.rival.dead) {
      game.diceGame = null;
      return;
    }
    g.stage = 'theirs';
    g.t = 0;
    const n = g.rival;
    n.face(t.x, t.z);
    n.say(n.rng.pick(['My turn!', 'Beat that, then.', 'Let\'s see...', 'A coin on it?']), 1.6, '#ffe8a0');
  } else if (g.stage === 'theirs' && g.t >= 0.9 && !g.theirs) {
    const n = g.rival;
    g.theirs = roll2();
    n.doAction(0.4);
    r.rollDice?.({ from: { x: n.x, y: n.y, z: n.z }, to: landing(t), faces: g.theirs });
    game.audio?.play('dig', n);
  } else if (g.stage === 'theirs' && g.theirs && g.t >= 2.1) {
    const n = g.rival;
    const mine = g.theirs[0] + g.theirs[1];
    r.floatText(t.x, t.y + 2, t.z, String(mine), '#c8d8ff');
    const name = n.rec.name ? n.rec.name.first : n.name;
    if (mine > g.total) {
      if (countItem(p.inv, 'coin') > 0) {
        removeItem(p.inv, 'coin', 1);
        n.rec.coins = (n.rec.coins || 0) + 1;
      }
      n.say(n.rng.pick([`${mine}! I'll take that coin.`, 'Ha! Mine.', 'Pay up, friend.']), 2.4, '#ffb080');
      game.ui.msg(`${name} throws ${WORDS[mine]}, and takes a coin off you.`, '#ffb080');
    } else if (mine < g.total) {
      if ((n.rec.coins || 0) > 0) {
        n.rec.coins--;
        p.give('coin', 1);
      }
      n.say(n.rng.pick([`${mine}... curse it.`, 'Bah! Here.', 'Your luck, this time.']), 2.4, '#ffe8a0');
      game.ui.msg(`${name} throws ${WORDS[mine]}. A coin to you!`, '#a0e0a0');
      game.audio?.play('coin');
    } else {
      n.say('Even! Again?', 2, '#ffe8a0');
      game.ui.msg(`${name} throws ${WORDS[mine]} too: even.`, '#c8d8ff');
    }
    game.diceGame = null;
  }
}
