// (Round 95) What the old places' architects (see world/deeps/) set down,
// at work: what's written there, read; the kerb ring's stones turned and
// its hoard-door opening; the offering bowls emptied (and the dead coming
// for what was taken); the dead in their seats waking when something of
// theirs is touched; snare-runes in the floor; a corpse-light's thralls
// getting up again; and the old hound leading the way.
//
// A floor's what-was-done is kept in its state (`deeps`), and put back
// when the floor's made again (see restore).
import { FY } from '../world/dungeongen.js';
import { B } from '../world/blocks.js';
import { SIGIL_BLOCKS } from '../world/deeps/barrow.js';
import { SIGILS } from '../world/deeps/lore.js';
import { findPath } from '../entities/pathfind.js';
import { addItem } from './inventory.js';
import * as MW from './minework.js';
import * as CW from './cryptwork.js';
import * as HW from './holdwork.js';
import * as KW from './kavwork.js';
import * as GW from './grovework.js';

const key = (x, z) => `${x},${z}`;
const near = (a, b, r) => Math.max(Math.abs(a.x - b.x), Math.abs(a.z - b.z)) <= r;
const mine = (run) => (run.state.deeps ||= { turned: {}, opened: {}, taken: {}, woke: {} });

// Put back what's been done on this floor (its stones as they were turned,
// its hoard-door open, its bowls emptied).
export function restore(run) {
  const w = run.game.world;
  const D = mine(run);
  for (const sp of run.data.spirals || []) {
    for (const s of sp.stones) {
      const k = D.turned[key(s.x, s.z)];
      if (k !== undefined) w.setBlock(s.x, FY, s.z, SIGIL_BLOCKS[k]);
    }
    if (D.opened[key(sp.door.x, sp.door.z)]) openDoor(run, sp.door, true);
  }
  for (const o of run.data.offerings || []) if (D.taken[key(o.x, o.z)]) w.setState(o.x, FY, o.z, true);
  // (Round 96) The mine's: see minework.js.
  MW.restore(run);
  // (Round 97) The crypt's: see cryptwork.js.
  CW.restore(run);
  // (Round 98) The holdout's: see holdwork.js.
  if (run.rec.type === 'holdout') HW.restore(run);
  // (Round 99) The Kavorent's: see kavwork.js.
  if (run.rec.type === 'kavorent') KW.restore(run);
  // (Round 100) The Wildwood Hollow's: see grovework.js.
  if (run.rec.type === 'grove') GW.restore(run);
}

// Something of the architect's clicked (true if it was).
export function interact(run, x, y, z, b) {
  const game = run.game;
  switch (b.interact) {
    case 'lore': {
      const t = (run.data.lore || []).find((q) => q.x === x && q.z === z);
      if (t) game.ui.openSign(t.lines, t.title);
      else game.ui.msg(b.id === B.cold_hearth ? 'Ashes, long cold. Something glows in them still.' : MW.sayOf(b) || CW.sayOf(b) || HW.sayOf(b) || KW.sayOf(b) || GW.sayOf(b) || 'The carving is worn past reading.', '#c8c8b8');
      return true;
    }
    case 'spiral':
      turnStone(run, x, z);
      return true;
    case 'offering':
      takeOffering(run, x, z);
      return true;
  }
  return MW.interact(run, x, y, z, b) || CW.interact(run, x, y, z, b) || HW.interact(run, x, y, z, b) || KW.interact(run, x, y, z, b) || GW.interact(run, x, y, z, b);
}

// One of the place's own fallen (the crypt's bones: see cryptwork.js; the
// holdout's houndmaster and captives: see holdwork.js).
export function killed(run, e) {
  CW.onKill(run, e);
  if (run.rec.type === 'holdout') HW.onKill(run, e);
  if (run.rec.type === 'kavorent') KW.onKill(run, e);
  if (run.rec.type === 'grove') GW.onKill(run, e);
}

// A spiral stone turned to its next sigil; if that sets the ring in its
// chief's name, the hoard-door rolls back.
function turnStone(run, x, z) {
  const game = run.game;
  const w = game.world;
  const cur = SIGIL_BLOCKS.indexOf(w.getBlock(x, FY, z));
  if (cur < 0) return;
  const next = (cur + 1) % 4;
  w.setBlock(x, FY, z, SIGIL_BLOCKS[next]);
  game.audio?.play('dig', { x, z });
  game.renderer.emit(x, FY + 1, z, { n: 6, color: ['#8a8a7a', '#5a5a4a'], up: 10, speed: 20, life: 0.5 });
  game.renderer.floatText(x, FY + 2.6, z, SIGILS[next], '#d8d0b0');
  const sp = (run.data.spirals || []).find((q) => q.stones.some((s) => s.x === x && s.z === z));
  if (!sp) return;
  const D = mine(run);
  D.turned[key(x, z)] = next;
  if (D.opened[key(sp.door.x, sp.door.z)]) return;
  if (!sp.stones.every((s, i) => w.getBlock(s.x, FY, s.z) === SIGIL_BLOCKS[sp.want[i]])) return;
  D.opened[key(sp.door.x, sp.door.z)] = true;
  openDoor(run, sp.door, false);
}

function openDoor(run, door, quiet) {
  const game = run.game;
  const w = game.world;
  for (const y of [FY, FY + 1]) w.setBlock(door.x, y, door.z, B.air);
  if (quiet) return;
  game.audio?.play('rumble', door);
  game.shake = Math.min(1.2, (game.shake || 0) + 0.5);
  game.renderer.emit(door.x, FY + 1, door.z, { n: 30, color: ['#8a8070', '#5a5040', '#c8c0a8'], up: 40, speed: 50, life: 1.2 });
  game.ui.msg('The ring speaks the chief\'s name. Somewhere in the wall a great stone grinds aside.', '#e8d8a0', true);
  game.lightDirty = true;
}

// An offering bowl emptied into your purse; and those it was left for come
// up out of the pit after it.
function takeOffering(run, x, z) {
  const game = run.game;
  const p = game.player;
  const o = (run.data.offerings || []).find((q) => q.x === x && q.z === z);
  const D = mine(run);
  if (!o || D.taken[key(x, z)]) {
    game.ui.msg('An empty bowl, green with age.', '#c8c8b8');
    return;
  }
  D.taken[key(x, z)] = true;
  game.world.setState(x, FY, z, true);
  addItem(p.inv, 'old_coin', o.coins);
  game.audio?.play('coin', p);
  game.ui.msg(`You tip ${o.coins} old coins out of the bowl. Down in the pit, something stirs.`, '#e0c080', true);
  run.wakeGroup(o.group);
}

// Something of theirs taken (a grave-goods chest opened): those it
// belonged to wake.
export function touched(run, x, y, z) {
  for (const q of run.data.wakes || []) {
    if (q.x !== x || q.z !== z) continue;
    const D = mine(run);
    if (D.woke[q.group]) continue;
    D.woke[q.group] = true;
    run.game.ui.msg('The dead stir in their places.', '#c8d8e0', true);
    run.wakeGroup(q.group);
  }
}

// Once a frame: snares, the dead rising, the bier touched, the hound.
export function tick(run, dt, party) {
  const game = run.game;
  const data = run.data;
  const D = mine(run);
  // Snare-runes: whoever steps on one is held a moment, and the dead near
  // it hear.
  for (const s of data.snares || []) {
    for (const p of party) {
      if (p.dead || p.x !== s.x || p.z !== s.z || Math.abs(p.y - FY) > 0) continue;
      if (p.snaredAt === key(s.x, s.z)) continue;
      p.snaredAt = key(s.x, s.z);
      p.slowT = Math.max(p.slowT || 0, 2.5);
      game.renderer.floatText(p.x, p.y + 2.2, p.z, 'snared!', '#86eeff');
      game.renderer.emit(p.x, p.y + 0.2, p.z, { n: 12, color: ['#86eeff', '#c8fcff'], up: 20, speed: 30, life: 0.6, glow: true });
      game.audio?.play('freeze', p);
      for (const c of run.creatures()) if (c.dormant && !c.waiting && !c.guardian && near(c, s, 8)) run.wake(c);
    }
  }
  for (const p of party) if (p.snaredAt && !(data.snares || []).some((s) => s.x === p.x && s.z === p.z)) p.snaredAt = null;
  // The bier's sleeper (and its watch): touched, they wake.
  for (const q of data.wakes || []) {
    if (!q.touch || D.woke[q.group]) continue;
    if (party.some((p) => !p.dead && near(p, q, 1))) {
      D.woke[q.group] = true;
      run.wakeGroup(q.group);
    }
  }
  // Thralls that fell near a corpse-light, getting up again.
  if (run.rises && run.rises.length) {
    for (const r of run.rises) r.t -= dt;
    for (const r of run.rises.filter((q) => q.t <= 0)) {
      if (!r.light.dead && !game.entityAt(r.x, r.y, r.z)) {
        const c = run.spawn('bone_thrall', r.x, r.y, r.z);
        c.risen = true;
        c.raisedBy = r.light;
        c.summoner = r.light;
        game.renderer.emit(r.x, r.y + 0.5, r.z, { n: 12, color: ['#86eeff', '#d8d0b8'], up: 30, speed: 30, life: 0.7, glow: true });
        game.renderer.floatText(r.x, r.y + 2, r.z, 'it gets up again', '#86eeff');
      }
    }
    run.rises = run.rises.filter((q) => q.t > 0);
  }
  // A corpse-light gone out: everything it raised falls down again.
  for (const c of run.creatures()) {
    if (c.raisedBy && c.raisedBy.dead && !c.dead) {
      c.raisedBy = null;
      game.renderer.emit(c.x, c.y + 0.5, c.z, { n: 10, color: ['#d8d0b8', '#8a8270'], up: 10, speed: 20, life: 0.6 });
      game.damage(c, c.hp + 99, null);
    }
  }
  hound(run, dt, party);
  MW.tick(run, dt, party);
  CW.tick(run, dt, party);
  HW.tick(run, dt, party);
  KW.tick(run, dt, party);
  GW.tick(run, dt, party);
}

// The old hound: trotting ahead of you to where it means to go, looking
// back when you fall behind; there, it lies down, and is gone.
function hound(run, dt, party) {
  const game = run.game;
  const goal = run.data.hound;
  for (const c of run.creatures()) {
    if (c.species !== 'old_hound' || c.dead) continue;
    c.thinkT = 9;
    if (!goal) continue;
    const p = party.filter((q) => !q.dead).sort((a, b) => Math.abs(a.x - c.x) + Math.abs(a.z - c.z) - (Math.abs(b.x - c.x) + Math.abs(b.z - c.z)))[0];
    if (!p) continue;
    if (near(c, goal, 1)) {
      c.lying = true;
      c.face(p.x, p.z);
      if (near(p, goal, 2)) {
        game.renderer.emit(c.x, c.y + 0.5, c.z, { n: 16, color: ['#a8cce4', '#dcf2ff'], up: 30, speed: 20, life: 1, glow: true });
        game.ui.msg('The old hound lays its head on its paws, and is gone.', '#a8cce4');
        c.dead = true;
        c.hp = 0;
      }
      continue;
    }
    c.lying = false;
    if (c.moving) continue;
    const d = Math.max(Math.abs(p.x - c.x), Math.abs(p.z - c.z));
    if (d > 8) continue;
    // (Waiting for you to catch up.)
    if (d > 4) {
      c.face(p.x, p.z);
      c.waitT = (c.waitT || 0) + dt;
      if (c.waitT > 3) {
        c.waitT = 0;
        game.renderer.floatText(c.x, c.y + 1.6, c.z, 'it looks back at you', '#a8cce4');
      }
      continue;
    }
    if (!c.houndPath || c.houndI >= c.houndPath.length) {
      c.houndPath = findPath(game.world, c.x, c.y, c.z, goal.x, FY, goal.z, { maxNodes: 3000, near: 1, partial: true });
      c.houndI = 0;
      if (!c.houndPath || !c.houndPath.length) continue;
    }
    const [nx, , nz] = c.houndPath[c.houndI];
    if (c.tryStep(nx, nz, c.S.step)) c.houndI++;
    else c.houndPath = null;
  }
}
