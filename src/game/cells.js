// (Round 114) A town's cell doors. Locked while there's anyone behind one
// (a prisoner of war, one of the town's own doing their time, or you): no
// opening it with a hand on the bars. A lockpick will do it (the lock
// window; a jail's lock is a good one), and whoever was inside sees the
// door standing open and goes: a prisoner of war runs for home, one of
// the town's slips off about their business. Seen doing it, and it's a
// crime (see sim/justice.js: freeing a prisoner).
import { B } from '../world/blocks.js';
import { hash4 } from '../util/rng.js';
import { countItem } from './inventory.js';
import { lockTier } from './lockpick.js';
import { LockWindow } from '../ui/lockpick.js';

const at = (d, x, z) => d && d.x === x && d.z === z;

// The town whose jail (or prison cell) has its door at (x, z), and which.
export function cellOf(game, x, z) {
  for (const s of game.world.ow.settlementsNear(x, z)) {
    const L = game.world.layouts.get(s.id);
    if (!L) continue;
    if (L.jail && at(L.jail.door, x, z)) return { L, jail: true, door: L.jail.door, y: L.jail.y };
    for (const c of L.prisonCells || []) if (at(c.door, x, z)) return { L, jail: false, door: c.door, y: c.door.y };
  }
  return null;
}

// Who's locked in behind the cell door at (x, z): prisoners of war, and
// the town's own doing their time.
export function cellOccupants(game, x, z) {
  const out = [];
  for (const n of game.sim.war?.captiveEnts?.values() || []) {
    if (n && !n.dead && n.state === 'captive' && n.captive && at(n.captive.door, x, z)) out.push(n);
  }
  const cell = cellOf(game, x, z);
  if (cell && cell.jail) {
    for (const r of cell.L.npcs) {
      const n = r.ent;
      if (n && !n.dead && n.state === 'jailed') out.push(n);
    }
  }
  return out;
}

// Is that cell door locked, and why: 'you' (you're the one in there),
// 'held' (someone else is), or null.
export function cellLocked(game, x, z) {
  const j = game.sim.justice.jail;
  const L = game.jailLayoutAt ? game.jailLayoutAt(x, z) : null;
  if (j && !j.cellless && L && j.sid === L.settlement.id) return 'you';
  return cellOccupants(game, x, z).length ? 'held' : null;
}

// A cell door clicked. True if it was dealt with here (locked, or the lock
// set to be picked); false to swing it as any other.
export function useCellDoor(game, x, y, z, id) {
  if (id === B.cell_door_open) return false;
  const why = cellLocked(game, x, z);
  if (!why) return false;
  const p = game.player;
  if (countItem(p.inv, 'lockpick') <= 0) {
    game.ui.msg(why === 'you' ? 'The cell door is locked. (A lockpick would open it, if you had one.)' : 'The cell door is locked fast. (A lockpick would open it.)', '#ffb080');
    game.audio?.play('locked', { x, z });
    return true;
  }
  const cell = cellOf(game, x, z);
  const s = cell ? cell.L.settlement : null;
  game.audio?.play('locked', { x, z });
  game.ui.open(new LockWindow(game.ui, game, {
    tier: Math.min(4, lockTier(s, {}) + 1),
    seed: hash4(x, y, z, 0xce11),
    label: 'The cell door',
    watched: () => false,
    onOpen: () => {
      game.stats.locksPicked = (game.stats.locksPicked || 0) + 1;
      openCell(game, x, y, z);
      if (why === 'held') freeCell(game, x, z, p);
    },
  }));
  return true;
}

// The cell door swung open (and the bars over it left to walk under).
export function openCell(game, x, y, z) {
  const w = game.world;
  w.setBlock(x, y, z, B.cell_door_open, 0);
  if (w.getBlock(x, y + 1, z) === B.iron_bars) w.setBlock(x, y + 1, z, B.cell_door_top, 0);
  game.audio?.play('unlock', { x, z });
}

// Whoever's behind the door at (x, z), let out by `by`: they see it open,
// and go. (And if the watch saw who did it, it's a crime.)
export function freeCell(game, x, z, by = null) {
  const freed = cellOccupants(game, x, z);
  for (const n of freed) {
    if (n.state === 'captive') n.captive.freed = by || 'door';
    else if (n.state === 'jailed') game.sim.society.escapeCell?.(n);
  }
  const cell = cellOf(game, x, z);
  if (freed.length && cell && by === game.player) {
    const wits = game.sim.witnesses(cell.L.settlement.id, x, z, 10).filter((q) => !freed.includes(q) && q.state !== 'captive' && q.state !== 'jailed' && ((q.rec && q.rec.job === 'guard') || q.distTo?.(by) <= 6));
    if (wits.length) game.sim.justice.commit(cell.L.settlement.id, 'freeing', { witnesses: wits, desc: 'Letting a prisoner out of the cells' });
  }
  return freed;
}
