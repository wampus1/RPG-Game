// (Round 104) The Terracotta Vault at work (laid out by world/deeps/
// vault.js): its army of clay, every soldier a statue, and some of them not
// clay (come by one and it steps down at you; the drum wakes them; a bead
// of quicksilver run into one's cracks moves it); the broken ones the
// sealed artisans mend (and what they mend stands again, and isn't clay);
// the drum and the bell (strike them yourself: the bell halts the clay, the
// drum wakes it); the crossbows in the gallery wall and the plates that
// loose them; the quicksilver (wading it poisons; its beads split when
// struck and run together when they touch); the five discs of the
// directions, and the chamber they open; the crack by the artisans' tally,
// and the tunnel behind it.
//
// What's been done (the statues woken or set waiting again, the tunnel
// opened, the discs set) is kept in the floor's state, and put back when
// the floor's made again (see restore).
import { FY } from '../world/dungeongen.js';
import { B } from '../world/blocks.js';
import { DISCS } from '../world/deeps/vault.js';
import { DIRECTIONS } from '../world/deeps/vaultlore.js';

const k3 = (x, y, z) => `${x},${y},${z}`;
const k2 = (x, z) => `${x},${z}`;
const dist = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.z - b.z));
const mine = (run) => (run.state.vault ||= { armed: {}, woke: {}, opened: {}, solved: {} });
// What's going on about the floor this visit (not saved).
export const vtT = (run) => (run.vaultT ||= { told: {}, opening: [], on: {}, bowCd: {}, bellCd: 0, drumCd: 0 });
const isVault = (run) => run && run.rec && run.rec.type === 'vault';
export const runOf = (game, x) => game.runAt?.(x) || game.dungeon || null;
// The clay that marches to the drum and halts at the bell (the
// crossbowmen keep shooting through both).
export const MARCHERS = new Set(['terracotta_soldier']);
const CLAY = new Set(['terracotta_soldier', 'terracotta_archer']);
// Halted at the bell: stood as clay a while, blows glancing off (see the
// soldier's ward, entities/farmobs.js).
export function halted(o, t) {
  o.haltT = Math.max(o.haltT || 0, t);
  o.stunT = Math.max(o.stunT || 0, t);
}
// A statue waiting (not clay): the ones laid out so, and the ones set
// waiting since (mended, or stood back in their places).
const armed = (run, q) => !mine(run).woke[k3(q.x, q.y, q.z)] && (q.alive || mine(run).armed[k3(q.x, q.y, q.z)]);
const statueAt = (run, q) => run.game.world.getBlock(q.x, q.y, q.z) === B.tv_soldier;

// ------------------------------------------------------------ put back
export function restore(run) {
  if (!isVault(run)) return;
  const w = run.game.world;
  const S = mine(run);
  for (const q of run.data.statues || []) if (S.woke[k3(q.x, q.y, q.z)] && statueAt(run, q)) w.setBlock(q.x, q.y, q.z, B.air);
  for (const t of run.data.tunnels || []) if (S.opened[k2(t.x, t.z)]) for (const y of [FY, FY + 1]) w.setBlock(t.x, y, t.z, B.air);
  for (const d of run.data.discs || []) {
    if (!S.solved[k2(d.door.x, d.door.z)]) continue;
    for (const p of d.peds) {
      w.setBlock(p.x, FY, p.z, B[DISCS[p.dir]]);
      w.setState(p.x, FY, p.z, true);
    }
    for (const y of [FY, FY + 1]) w.setBlock(d.door.x, y, d.door.z, B.air);
  }
}
// Before the floor's kept: the clay that woke and still stands goes back
// to its place, a statue again, waiting.
export function restand(run) {
  if (!isVault(run)) return;
  const w = run.game.world;
  const S = mine(run);
  for (const c of run.creatures()) {
    const q = c.fromStatue;
    if (!q || c.dead) continue;
    if (w.getBlock(q.x, q.y, q.z) !== B.air) continue;
    w.setBlock(q.x, q.y, q.z, B.tv_soldier, q.kind & 3);
    delete S.woke[k3(q.x, q.y, q.z)];
    S.armed[k3(q.x, q.y, q.z)] = true;
  }
}

// ------------------------------------------------------------ the statues
// One steps down: the statue gone, a soldier of clay in its place, at
// whoever woke it.
function wake(run, q, target, why = 'near') {
  const game = run.game;
  const w = game.world;
  if (!statueAt(run, q)) return null;
  w.setBlock(q.x, q.y, q.z, B.air);
  mine(run).woke[k3(q.x, q.y, q.z)] = true;
  const c = run.spawn(q.kind === 2 ? 'terracotta_archer' : 'terracotta_soldier', q.x, q.y, q.z, { room: q.room });
  if (!c) return null;
  c.fromStatue = q;
  c.dormant = 0;
  c.waiting = false;
  if (target) c.target = target;
  game.renderer.emit(q.x, q.y + 1, q.z, { n: 14, color: ['#a8886a', '#cdb08e', '#806248'], up: 20, speed: 24, life: 0.7 });
  game.renderer.floatText(q.x, q.y + 2.6, q.z, why === 'bead' ? 'the quicksilver runs into it, and it moves' : 'the statue moves!', '#e0c090');
  game.audio?.play('crumble', q);
  const T = vtT(run);
  if (!T.told.wake) {
    T.told.wake = true;
    game.ui.msg('One of the clay soldiers turns its head, and steps down out of its rank. (Not all of the army is clay. You can\'t tell which.)', '#e0c090', true);
  }
  return c;
}
// The nearest waiting statue to `at` (within `r`) steps down. (A bead of
// quicksilver wakes any statue, waiting or not.)
export function wakeStatue(run, at, r = 5, why = 'near') {
  if (!isVault(run)) return null;
  const any = why === 'bead';
  const q = (run.data.statues || [])
    .filter((s) => statueAt(run, s) && (any || armed(run, s)) && dist(s, at) <= r)
    .sort((a, b) => dist(a, at) - dist(b, at))[0];
  return q ? wake(run, q, run.game.player, why) : null;
}
// A broken soldier mended: its shards gone, a statue in its place, waiting.
export function mend(run, sh, by = null) {
  const game = run.game;
  const w = game.world;
  sh.mended = true;
  if (w.getBlock(sh.x, sh.y, sh.z) !== B.tv_shards) return;
  const kind = (sh.x + sh.z) % 2;
  w.setBlock(sh.x, sh.y, sh.z, B.tv_soldier, kind);
  const q = { x: sh.x, y: sh.y, z: sh.z, kind, alive: true, room: sh.room };
  (run.data.statues ||= []).push(q);
  mine(run).armed[k3(q.x, q.y, q.z)] = true;
  run.data.shards = (run.data.shards || []).filter((s) => s !== sh);
  game.renderer.emit(sh.x, sh.y + 1, sh.z, { n: 12, color: ['#cdb08e', '#e8d8b8'], up: 14, speed: 10, life: 0.8, glow: true });
  game.renderer.floatText(sh.x, sh.y + 2.6, sh.z, 'mended: it stands again', '#e0c090');
  game.audio?.play('chime', sh);
  const T = vtT(run);
  if (by && !T.told.mend) {
    T.told.mend = true;
    game.ui.msg('The potter\'s ghost fits the last shard into place, and the soldier stands again in its rank. (What he mends is not clay.)', '#e0c090', true);
  }
}

// ------------------------------------------------------------ clicked
export function sayOf(b) {
  switch (b.name) {
    case 'tv_dragon': return 'The Azure Dragon of the east, painted on silk, green.';
    case 'tv_bird': return 'The Vermilion Bird of the south, painted on silk, red.';
    case 'tv_tiger': return 'The White Tiger of the west, painted on silk.';
    case 'tv_tortoise': return 'The Black Tortoise of the north, a snake wound about it.';
    case 'tv_stele': return 'A stone tablet on a stone tortoise\'s back, cut in columns.';
    case 'tv_tally': return 'Strokes in the earth, in fives, row on row.';
    case 'tv_ding': return 'A bronze cauldron on three legs, the monster mask round its belly.';
    case 'tv_throne': return 'Black lacquer and gold, the dragon on its back.';
    case 'tv_bones': return 'The bones of a man, curled up by the wall.';
    default: return null;
  }
}

export function interact(run, x, y, z, b) {
  if (!isVault(run)) return false;
  const game = run.game;
  const w = game.world;
  const T = vtT(run);
  switch (b.interact) {
    // A jade disc turned to the next of the five colours.
    case 'tv_disc':
      return turnDisc(run, x, z);
    // The crack by the tally: it gives.
    case 'tv_crack': {
      const t = (run.data.tunnels || []).find((q) => q.x === x && q.z === z);
      for (const yy of [FY, FY + 1]) if (w.getBlock(x, yy, z) === B.tv_crack) w.setBlock(x, yy, z, B.air);
      if (t) mine(run).opened[k2(x, z)] = true;
      game.renderer.emit(x, FY + 1, z, { n: 18, color: ['#a06c3e', '#744828', '#b88050'], up: 20, speed: 30, gravity: 120, life: 0.8 });
      game.audio?.play('crumble', { x, z });
      game.lightDirty = true;
      game.ui.msg('You push at the crack, and the beaten earth gives: behind it a tunnel, dug by hand.', '#e0c090', true);
      return true;
    }
    case 'tv_bronzedoor':
      game.ui.msg('Two leaves of bronze, the monster mask between them, a ring in its jaw. No keyhole. The shrine\'s discs are watched by the mask\'s eyes.', '#d8c890');
      return true;
    case 'tv_crossbow':
      game.ui.msg('A square slot in the earth, bronze-lined. In the dark of it, the head of a bolt. Mind where you tread in front of it: the bricks laid square.', '#d8c890');
      return true;
    // The girl's lamp: its shade turned, to show the flame or hide it.
    case 'tv_lamp': {
      const on = !w.getState(x, y, z);
      w.setState(x, y, z, on);
      game.lightDirty = true;
      game.audio?.play('click', { x, z });
      game.ui.msg(on ? 'You turn the lamp\'s shade, and the flame shows.' : 'You turn the lamp\'s shade over the flame.', '#ffd890');
      return true;
    }
    // The bells: struck, the clay about them halts as at the officers'
    // bell.
    case 'tv_bells': {
      if (T.bellCd > 0) {
        game.ui.msg('The bells are still ringing.', '#d8e8f0');
        return true;
      }
      T.bellCd = 8;
      game.audio?.play('bell', { x, z });
      game.renderer.floatText(x, FY + 2.8, z, 'the bells ring out: HALT', '#d8e8f0');
      let n = 0;
      for (const o of game.creatures) {
        if (o.dead || !MARCHERS.has(o.species) || dist(o, { x, z }) > 9) continue;
        halted(o, 3.5);
        n++;
      }
      game.ui.msg(n ? 'You strike the bells, and every clay soldier in earshot stops dead where it stands.' : 'You strike the bells. The sound goes on a long time.', '#d8e8f0');
      return true;
    }
    // The war drum: struck, the army answers it.
    case 'tv_drum': {
      if (T.drumCd > 0) return true;
      T.drumCd = 6;
      game.audio?.play('boom', { x, z });
      game.renderer.floatText(x, FY + 2.8, z, 'BOOM', '#ffb070');
      let n = 0;
      for (const s of run.data.statues || []) {
        if (n >= 3 || !statueAt(run, s) || !armed(run, s) || dist(s, { x, z }) > 8) continue;
        if (wake(run, s, game.player, 'drum')) n++;
      }
      game.ui.msg(n ? 'You strike the drum, and the army answers it.' : 'You strike the drum. The sound rolls away down the trenches, and nothing answers. This time.', '#ffb070', true);
      return true;
    }
  }
  return false;
}
// A disc turned: its next colour. All five in their colours, and the
// chamber behind the bronze door opens.
function turnDisc(run, x, z) {
  const game = run.game;
  const w = game.world;
  const S = mine(run);
  const cur = DISCS.findIndex((k) => w.getBlock(x, FY, z) === B[k]);
  if (cur < 0) return false;
  const d = (run.data.discs || []).find((q) => q.peds.some((p) => p.x === x && p.z === z));
  if (d && S.solved[k2(d.door.x, d.door.z)]) {
    game.ui.msg('The five discs shine in their colours. Heaven is open.', '#e8f0c0');
    return true;
  }
  const next = (cur + 1) % 5;
  w.setBlock(x, FY, z, B[DISCS[next]]);
  game.audio?.play('tink', { x, z });
  const ped = d && d.peds.find((p) => p.x === x && p.z === z);
  const colour = DIRECTIONS[next].colour;
  game.renderer.floatText(x, FY + 2.6, z, colour, '#e8f0c0');
  game.ui.msg(ped ? `The ${ped.dir === 4 ? 'centre' : DIRECTIONS[ped.dir].dir} pedestal. You turn its disc: ${colour} jade.` : `You turn the disc: ${colour} jade.`, '#e8f0c0');
  if (!d || !d.peds.every((p) => w.getBlock(p.x, FY, p.z) === B[DISCS[p.dir]])) return true;
  S.solved[k2(d.door.x, d.door.z)] = true;
  for (const p of d.peds) w.setState(p.x, FY, p.z, true);
  vtT(run).opening.push({ ...d.door, t: 1.6 });
  game.lightDirty = true;
  game.audio?.play('chime', d.door);
  game.audio?.play('rumble', d.door);
  game.ui.msg('Each quarter in its colour, and the centre in the emperor\'s: the five discs shine, and the bronze doors grind open.', '#ffe890', true);
  return true;
}

// ------------------------------------------------------------ fallen
// A clay soldier broken: its shards where it fell (for the artisans).
export function onKill(run, e) {
  if (!isVault(run) || !CLAY.has(e.species)) return;
  const w = run.game.world;
  if (w.getBlock(e.x, e.y, e.z) !== B.air) return;
  w.setBlock(e.x, e.y, e.z, B.tv_shards, (e.x + e.z) % 2);
  (run.data.shards ||= []).push({ x: e.x, y: e.y, z: e.z, room: e.room });
}

// ------------------------------------------------------------ each step
export function tick(run, dt, party = null) {
  if (!isVault(run)) return;
  const game = run.game;
  const w = game.world;
  const T = vtT(run);
  const r = game.renderer;
  const who = (party || [game.player]).filter((p) => p && !p.dead);
  if (T.bellCd > 0) T.bellCd -= dt;
  if (T.drumCd > 0) T.drumCd -= dt;
  const mobs = run.creatures();
  for (const c of mobs) if (c.haltT > 0) c.haltT -= dt;
  // The statues: come by a waiting one and it steps down at you.
  for (const q of run.data.statues || []) {
    if (!armed(run, q) || !statueAt(run, q)) continue;
    const p = who.find((o) => dist(o, q) <= 1 && Math.abs(o.y - q.y) <= 1);
    if (p) wake(run, q, p);
  }
  // The quicksilver: split when struck, run together when beads touch,
  // and into a statue's cracks when one rolls up to it.
  for (const c of mobs) {
    if (c.dead) continue;
    if (c.split) {
      c.split = false;
      const hp = Math.max(2, Math.ceil(c.hp / 2));
      c.dead = true;
      game.removeOcc?.(c);
      for (const [ox, oz] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) {
        if (game.creatures.filter((o) => o.splitFrom === c && !o.dead).length >= 2) break;
        const s = game.findFreeSpot?.(c.x + ox, c.z + oz, 1);
        const b = s && run.spawn('quicksilver_bead', s.x, s.y, s.z, { room: c.room });
        if (!b) continue;
        b.hp = Math.min(b.maxHp, hp);
        b.mergeCd = 4;
        b.splitFrom = c;
        b.target = c.target;
        b.dormant = 0;
      }
      r.emit(c.x, c.y + 0.5, c.z, { n: 12, color: ['#e4ecf4', '#b8c0c8', '#ffffff'], up: 14, speed: 30, life: 0.5 });
      r.floatText(c.x, c.y + 2, c.z, 'it splits', '#c8d0d8');
      if (!T.told.split) {
        T.told.split = true;
        game.ui.msg('The quicksilver splits under the blow into two beads, and they roll apart. (Where they touch, they run together again.)', '#c8d0d8', true);
      }
      continue;
    }
    if (c.merge) {
      const o = c.merge;
      c.merge = null;
      if (o.dead || dist(o, c) > 1) continue;
      const hp = Math.min(16, c.hp + o.hp);
      c.dead = true;
      o.dead = true;
      game.removeOcc?.(c);
      game.removeOcc?.(o);
      const big = run.spawn('quicksilver', c.x, c.y, c.z, { room: c.room });
      if (big) {
        big.hp = Math.min(big.maxHp, hp);
        big.mergeCd = 4;
        big.target = c.target || o.target;
        big.dormant = 0;
      }
      r.floatText(c.x, c.y + 2, c.z, 'they run together', '#c8d0d8');
      continue;
    }
    if ((c.species === 'quicksilver' || c.species === 'quicksilver_bead') && !c.dormant) {
      const q = (run.data.statues || []).find((s) => statueAt(run, s) && dist(s, c) <= 1 && Math.abs(s.y - c.y) <= 1);
      if (q) {
        const s = wake(run, q, c.target || game.player, 'bead');
        if (s) {
          s.hasteT = 8;
          s.quick = true;
          c.dead = true;
          game.removeOcc?.(c);
        }
      }
    }
  }
  // Wading the quicksilver: it poisons, and drags at you.
  for (const p of who) {
    if (p.y !== FY - 1 || w.getBlock(p.x, FY - 2, p.z) !== B.tv_mercury) continue;
    p.poisonT = Math.max(p.poisonT || 0, 2);
    p.slowT = Math.max(p.slowT || 0, 0.5);
    if (!T.told.mercury) {
      T.told.mercury = true;
      game.ui.msg('You wade into the quicksilver. It is heavy and cold, and the air over it burns your throat. (Cross by the bronze bridges.)', '#c8d0d8', true);
    }
  }
  // The crossbows: a plate trodden, and the bow in the wall over its line
  // looses down it, at whoever's first in the line.
  for (const bow of run.data.crossbows || []) {
    const kb = k2(bow.x, bow.z);
    if (T.bowCd[kb] > 0) T.bowCd[kb] -= dt;
    for (const pl of bow.plates) {
      const kp = k2(pl.x, pl.z);
      const on = who.find((p) => p.x === pl.x && p.z === pl.z && p.y === FY);
      if (!on) {
        T.on[kp] = false;
        continue;
      }
      if (T.on[kp] || T.bowCd[kb] > 0) continue;
      T.on[kp] = true;
      T.bowCd[kb] = 1.2;
      loose(run, bow);
    }
  }
  // The bronze doors opening.
  for (const o of T.opening) {
    o.t -= dt;
    if (Math.random() < dt * 12) r.emit(o.x, FY + Math.random() * 2, o.z, { n: 1, color: ['#c8a85a', '#9a7a3a'], up: 10, speed: 20, life: 0.5 });
    if (o.t <= 0) {
      for (const y of [FY, FY + 1]) if (w.getBlock(o.x, y, o.z) === B.tv_bronzedoor) w.setBlock(o.x, y, o.z, B.air);
      game.audio?.play('creak', o);
      game.lightDirty = true;
    }
  }
  T.opening = T.opening.filter((o) => o.t > 0);
}
// A bolt from the wall, down its line: whoever's first in it is struck.
function loose(run, bow) {
  const game = run.game;
  const r = game.renderer;
  game.audio?.play('dart', bow);
  game.renderer.floatText(bow.x, FY + 2.6, bow.z + 1, 'click... a bolt from the wall!', '#ffd0a0');
  const all = [...game.everyone(), ...game.creatures].filter((e) => e && !e.dead && e.x === bow.x && e.z > bow.z && Math.abs(e.y - FY) <= 1);
  const hit = all.sort((a, b) => a.z - b.z)[0];
  const end = hit ? hit.z : bow.z + 10;
  for (let z = bow.z + 1; z <= end; z++) r.emit(bow.x, FY + 1.2, z, { n: 1, color: ['#c8a85a', '#fff0a0'], up: 0, speed: 4, life: 0.25 });
  if (hit) {
    game.damage(hit, 6, null);
    r.emit(hit.x, hit.y + 1.2, hit.z, { n: 8, color: ['#c8a85a', '#e0c090'], up: 10, speed: 30, life: 0.4 });
  }
  const T = vtT(run);
  if (!T.told.bolt) {
    T.told.bolt = true;
    game.ui.msg('A brick sinks under your foot, and a bolt comes out of the wall.', '#ffd0a0', true);
  }
}
