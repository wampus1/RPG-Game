// (Round 101) The Kiln-Deep at work (laid out by world/deeps/forge.js): the
// trip-hammers falling on their beat; the steam vents bursting on theirs;
// the grates flaring as the bellows breathe (or a bellowsback's gust fans
// them); the casting pit (the lever tips the crucible, the metal runs down
// the channel to the mould, and the kiln-key sets in it); the kiln-door it
// opens; the singing anvils (strike them in the forge-song's order and the
// guild-door opens; wrongly, and the ash-smiths look up from their work);
// the work itself (break the smiths' racks or stacks and they turn on you);
// an ash-smith's ash, choking.
//
// What's been done (poured, taken, opened, sung) is kept in the floor's
// state, and put back when the floor's made again (see restore).
import { FY } from '../world/dungeongen.js';
import { B, BLOCKS } from '../world/blocks.js';
import { addItem, countItem, removeItem } from './inventory.js';
import { burn } from './gems.js';
import { NOTES } from '../world/deeps/forgelore.js';

const k2 = (x, z) => `${x},${z}`;
const near = (a, b, r) => Math.max(Math.abs(a.x - b.x), Math.abs(a.z - b.z)) <= r;
const mine = (run) => (run.state.forge ||= { poured: {}, taken: {}, opened: {}, sung: {} });
// What's going on about the floor this visit (not saved).
export const fgT = (run) => (run.forgeT ||= { clock: 0, clouds: [], pours: [], flare: new Map(), steam: new Set(), song: {}, ringing: [], opening: [], told: {}, down: new Set(), hit: new Map() });
const isForge = (run) => run && run.rec && run.rec.type === 'forge';
const runOf = (game, x) => game.runAt?.(x) || game.dungeon || null;
export const HAMMER = { period: 2.6, down: 0.35 };
export const VENT = { period: 6, hiss: 4.4, burst: 5.0 };
export const GRATE = { period: 6, flare: 5.2 };

// ------------------------------------------------------------ put back
export function restore(run) {
  if (!isForge(run)) return;
  const w = run.game.world;
  const S = mine(run);
  for (const c of run.data.casts || []) {
    const k = k2(c.lever.x, c.lever.z);
    if (!S.poured[k]) continue;
    w.setState(c.lever.x, c.lever.y, c.lever.z, true);
    w.setState(c.crucible.x, c.crucible.y, c.crucible.z, true);
    w.setBlock(c.mould.x, FY - 2, c.mould.z, B.fg_keymould);
    if (!S.taken[k] && w.getBlock(c.mould.x, FY - 1, c.mould.z) === B.air) {
      w.setBlock(c.mould.x, FY - 1, c.mould.z, B.fg_castkey);
      w.setState(c.mould.x, FY - 1, c.mould.z, true);
    }
  }
  for (const d of run.data.kilndoors || []) if (S.opened[k2(d.x, d.z)]) for (const y of [FY, FY + 1]) w.setBlock(d.x, y, d.z, B.air);
  for (const a of run.data.anvils || []) if (S.sung[k2(a.door.x, a.door.z)]) for (const y of [FY, FY + 1]) w.setBlock(a.door.x, y, a.door.z, B.air);
}

// ------------------------------------------------------------ the ash
// A cloud of choking ash a while, `rad` round: whoever of you is in it,
// slow, and short of breath.
export function forgeCloud(run, x, z, rad, dur) {
  fgT(run).clouds.push({ x, z, rad, t: dur });
}

// The smiths given cause: every ash-smith near `at` (or all of the room's)
// turns on whoever gave it.
export function provoke(run, src, at, why = 'struck') {
  const game = run.game;
  let n = 0;
  for (const c of run.creatures()) {
    if (c.dead || c.species !== 'ash_smith' || c.angry) continue;
    if (!near(c, at, 9) && c !== at) continue;
    c.angry = true;
    c.peaceful = false;
    c.target = src;
    if (c.dormant) run.wake?.(c);
    n++;
  }
  if (n && !fgT(run).told[why]) {
    fgT(run).told[why] = true;
    const line = why === 'work' ? 'The ash-smiths look up from their anvils at what you\'ve done to their work. They put down their tongs.' : why === 'song' ? 'The note jars. All round the hall, the ash-smiths look up from their work.' : 'The ash-smiths turn from the work, all of them at once.';
    game.ui.msg(line, '#e08060', true);
  }
}

// ------------------------------------------------------------ hot, wet
// Is the tile hot (a grate under it, the metal beside it, a fire on it)?
export function heatAt(run, x, z) {
  const w = run.game.world;
  if (w.getBlock(x, FY - 1, z) === B.fg_grate) return true;
  for (const [ox, oz] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) if (w.getBlock(x + ox, FY - 1, z + oz) === B.lava) return true;
  const f = run.game.fireTiles && run.game.fireTiles.get(`${x},${FY},${z}`);
  return !!(f && !f.done);
}
// Is the tile in a vent's steam just now?
export const steamAt = (run, x, z) => fgT(run).steam.has(k2(x, z));
// A line of tiles fanned (a bellowsback's gust): any grates in it flare.
export function flareLine(run, tiles) {
  const T = fgT(run);
  const w = run.game.world;
  for (const t of tiles) if (w.getBlock(t.x, FY - 1, t.z) === B.fg_grate) T.flare.set(k2(t.x, t.z), 0.9);
}

// ------------------------------------------------------------ clicked
export function sayOf(b) {
  switch (b.name) {
    case 'fg_relief': return 'The guild\'s mark: the hammer over the anvil.';
    case 'fg_tally': return 'Marks in fives, wall after wall of them.';
    case 'fg_roll': return 'A bronze plate, the names on it worn smooth.';
    case 'fg_statue': return 'A Kiln-King in stone, both hands on his hammer.';
    case 'fg_plinth': return 'A masterwork, on its plinth. Not a mark on it.';
    case 'fg_table': return 'A long table, scarred and burnt, the tankards still on it.';
    default: return null;
  }
}

export function interact(run, x, y, z, b) {
  if (!isForge(run)) return false;
  const game = run.game;
  const p = game.player;
  const S = mine(run);
  const T = fgT(run);
  switch (b.interact) {
    // A singing anvil struck: its note; the song, or a jarring.
    case 'fg_singanvil': {
      const pz = (run.data.anvils || []).find((q) => q.anvils.some((a) => a.x === x && a.z === z));
      const a = pz && pz.anvils.find((q) => q.x === x && q.z === z);
      ring(run, x, z, a ? a.note : 0);
      if (!pz || S.sung[k2(pz.door.x, pz.door.z)]) return true;
      const k = k2(pz.door.x, pz.door.z);
      const got = (T.song[k] ||= []);
      got.push(a.note);
      const want = pz.song;
      if (got.some((n, i) => n !== want[i])) {
        T.song[k] = [];
        game.audio?.play('clang', { x, z });
        provoke(run, p, { x, z }, 'song');
        return true;
      }
      if (got.length === want.length) {
        S.sung[k] = true;
        T.song[k] = [];
        T.opening.push({ ...pz.door, t: 1.4 });
        game.ui.msg('The three notes hang in the air together, and the hall rings with them. In the wall, stone grinds on stone.', '#ffd080');
        game.audio?.play('chime', { x, z });
      }
      return true;
    }
    // The pouring lever: the crucible tipped, the metal run.
    case 'fg_lever': {
      const c = (run.data.casts || []).find((q) => q.lever.x === x && q.lever.z === z);
      if (!c) return false;
      const k = k2(c.lever.x, c.lever.z);
      if (S.poured[k]) {
        game.ui.msg('The crucible hangs empty on its trunnions. It has given what it had.', '#c8c8b8');
        return true;
      }
      S.poured[k] = true;
      game.world.setState(c.lever.x, c.lever.y, c.lever.z, true);
      game.world.setState(c.crucible.x, c.crucible.y, c.crucible.z, true);
      T.pours.push({ c, t: 0, i: 0 });
      game.ui.msg('You haul on the lever. The crucible groans on its trunnions and tips, and white metal pours down into the channel.', '#ffb060');
      game.audio?.play('pour', { x, z });
      return true;
    }
    // The kiln-key in its mould: too hot, or set and taken.
    case 'fg_castkey': {
      if (!game.world.getState(x, y, z)) {
        game.ui.msg('Too hot to touch. It\'s still glowing in the mould.', '#ff9060');
        burn(game, p, null, 1);
        return true;
      }
      if (addItem(p.inv, 'kiln_key', 1) > 0) {
        game.ui.msg('You\'ve no room to carry it.', '#c8c8b8');
        return true;
      }
      game.world.setBlock(x, y, z, B.air);
      const c = (run.data.casts || []).find((q) => q.mould.x === x && q.mould.z === z);
      if (c) S.taken[k2(c.lever.x, c.lever.z)] = true;
      game.ui.msg('A key of black iron, still warm, its bow shaped like a flame: the kiln-key.', '#ffd080');
      game.audio?.play('pickup', { x, z });
      return true;
    }
    // The kiln-door: the key, or not.
    case 'fg_kilndoor': {
      const d = (run.data.kilndoors || []).find((q) => q.x === x && q.z === z);
      if (!d) return false;
      if (countItem(p.inv, 'kiln_key') <= 0) {
        game.ui.msg('An iron door, banded, its keyhole shaped like a flame. It\'s warm to the touch. Locked fast.', '#c8c8b8');
        return true;
      }
      removeItem(p.inv, 'kiln_key', 1);
      S.opened[k2(d.x, d.z)] = true;
      T.opening.push({ ...d, t: 0.8 });
      game.ui.msg('The kiln-key turns in the flame-shaped lock, and the iron door swings in on a breath of hot air.', '#ffd080');
      game.audio?.play('unlock', { x, z });
      return true;
    }
    case 'fg_guilddoor':
      game.ui.msg('A door of the stone, no handle and no keyhole, the guild\'s mark inlaid across it in bronze. It answers to something.', '#c8c8b8');
      return true;
  }
  return false;
}
// A singing anvil rung: its note in the air, its face glowing a moment.
function ring(run, x, z, note) {
  const game = run.game;
  game.world.setState(x, FY, z, true);
  fgT(run).ringing.push({ x, z, t: 0.9 });
  game.audio?.play('tink', { x, z });
  game.renderer.floatText(x, FY + 2.2, z, ['dong', 'dang', 'ding'][note % 3], ['#e0a060', '#ffd080', '#fff4c0'][note % 3]);
  game.renderer.emit(x, FY + 1, z, { n: 10, color: ['#ffd060', '#ffffff'], up: 30, speed: 40, life: 0.5, glow: true });
}

// One of the forge's own fallen.
export function onKill(run, e) {
  if (!isForge(run)) return;
  const game = run.game;
  if (e.species === 'iron_warden' && e.brittleT > 0) game.renderer.emit(e.x, e.y + 1, e.z, { n: 30, color: ['#c8d0d8', '#6a6a7a', '#ffffff'], up: 40, speed: 70, gravity: 140, life: 0.8 });
}

// Something of the forge's broken (see game.breakBlock): the smiths' work.
export function forgeBroken(game, x, y, z, id) {
  const run = runOf(game, x);
  if (!isForge(run)) return;
  if (id === B.fg_rack || id === B.fg_ingots) provoke(run, game.player, { x, z }, 'work');
}

// ------------------------------------------------------------ each step
export function tick(run, dt, party) {
  if (!isForge(run)) return;
  const game = run.game;
  const w = game.world;
  const T = fgT(run);
  const r = game.renderer;
  T.clock += dt;
  const all = () => [...party, ...run.creatures()].filter((e) => e && !e.dead);
  // The trip-hammers: up, and down on their beat on whoever's under them.
  for (const h of run.data.hammers || []) {
    const t = (T.clock + h.phase) % HAMMER.period;
    const down = t < HAMMER.down;
    const key = k2(h.x, h.z);
    if (down !== T.down.has(key)) {
      if (down) {
        T.down.add(key);
        w.setState(h.x, FY, h.z, true);
        r.emit(h.x, FY + 0.3, h.z, { n: 14, color: ['#ffd060', '#ff8030', '#ffffff'], up: 30, speed: 50, life: 0.5, glow: true });
        game.audio?.play('thud', h);
        for (const e of all()) {
          if (e.x !== h.x || e.z !== h.z || Math.abs(e.y - FY) > 1 || e.S?.floats) continue;
          game.damage(e, 5, null);
          e.stunT = Math.max(e.stunT || 0, 0.8);
          r.floatText(e.x, e.y + 2.4, e.z, 'HAMMERED!', '#ffb060');
        }
      } else {
        T.down.delete(key);
        w.setState(h.x, FY, h.z, false);
      }
    }
    // (It rises: grit shaken down from its head.)
    if (t > HAMMER.period - 0.6 && Math.random() < dt * 10) r.emit(h.x, FY + 1.6, h.z, { n: 1, color: ['#8a857e', '#5a5650'], up: -6, speed: 6, life: 0.4 });
  }
  // The steam vents: a hiss, and then the burst.
  T.steam.clear();
  for (const v of run.data.vents || []) {
    const t = (T.clock + v.phase) % VENT.period;
    const on = t >= VENT.burst;
    if (!!w.getState(v.x, FY, v.z) !== on) w.setState(v.x, FY, v.z, on);
    if (t >= VENT.hiss && t < VENT.burst && Math.random() < dt * 12) r.emit(v.x, FY + 0.6, v.z, { n: 1, color: ['#ffffff', '#d8e0e8'], up: 20, speed: 10, life: 0.4, shape: 'puff' });
    if (!on) continue;
    const tiles = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].map(([ox, oz]) => ({ x: v.x + ox, z: v.z + oz }));
    for (const q of tiles) T.steam.add(k2(q.x, q.z));
    if (Math.random() < dt * 20) {
      const q = tiles[Math.floor(Math.random() * tiles.length)];
      r.emit(q.x, FY + 0.4, q.z, { n: 2, color: ['#ffffff', '#e0e8f0'], up: 40, speed: 12, life: 0.8, shape: 'puff', gravity: -20 });
    }
    for (const e of party) {
      if (!e || e.dead || !tiles.some((q) => q.x === e.x && q.z === e.z)) continue;
      const hk = `steam:${v.x},${v.z}`;
      if ((T.hit.get(e) || {})[hk] > T.clock) continue;
      T.hit.set(e, { ...(T.hit.get(e) || {}), [hk]: T.clock + 0.8 });
      game.damage(e, 2, null);
      r.floatText(e.x, e.y + 2.4, e.z, 'scalded!', '#e0e8f0');
    }
  }
  // The grates: they flare when the bellows breathe (or a gust fans them).
  for (const [k, v] of T.flare) if (v - dt <= 0) T.flare.delete(k); else T.flare.set(k, v - dt);
  for (const g of run.data.grates || []) {
    const t = (T.clock + g.phase) % GRATE.period;
    const flare = t >= GRATE.flare;
    for (const q of g.tiles) {
      const hot = flare || T.flare.has(k2(q.x, q.z));
      if (!hot) {
        // (Before they flare, the fire under them brightens.)
        if (t > GRATE.flare - 0.8 && Math.random() < dt * 3) r.emit(q.x, FY + 0.1, q.z, { n: 1, color: ['#ff8030', '#ffd060'], up: 10, speed: 4, life: 0.4, glow: true });
        continue;
      }
      if (Math.random() < dt * 14) r.emit(q.x + Math.random() - 0.5, FY + 0.2, q.z + Math.random() - 0.5, { n: 1, color: ['#ff8030', '#ffd060', '#ff4020'], up: 40, speed: 6, gravity: -30, life: 0.5, glow: true });
      for (const e of party) {
        if (!e || e.dead || e.x !== q.x || e.z !== q.z || Math.abs(e.y - FY) > 1) continue;
        const hk = `grate:${q.x},${q.z}`;
        if ((T.hit.get(e) || {})[hk] > T.clock) continue;
        T.hit.set(e, { ...(T.hit.get(e) || {}), [hk]: T.clock + 1 });
        game.damage(e, 1, null);
        burn(game, e, null, 2);
        r.floatText(e.x, e.y + 2.4, e.z, 'the grate flares!', '#ff9040');
      }
    }
  }
  // The pour: down the channel tile by tile, into the mould; there it sets.
  for (const P of T.pours) {
    P.t += dt;
    const c = P.c;
    const n = c.channel.length;
    while (P.i < n && P.t > 0.35 * (P.i + 1)) {
      const q = c.channel[P.i];
      w.setBlock(q.x, FY - 1, q.z, B.lava);
      r.emit(q.x, FY, q.z, { n: 8, color: ['#fff0a0', '#ffb040', '#ff6020'], up: 20, speed: 20, life: 0.5, glow: true });
      P.i++;
    }
    if (!P.cast && P.t > 0.35 * (n + 1)) {
      P.cast = true;
      w.setBlock(c.mould.x, FY - 2, c.mould.z, B.fg_keymould);
      w.setBlock(c.mould.x, FY - 1, c.mould.z, B.fg_castkey);
      w.setState(c.mould.x, FY - 1, c.mould.z, false);
      r.emit(c.mould.x, FY, c.mould.z, { n: 20, color: ['#fff0a0', '#ffb040'], up: 30, speed: 30, life: 0.7, glow: true });
      game.ui.msg('The metal floods the mould at the channel\'s end, and in it, glowing, a shape: a key.', '#ffb060');
      game.lightDirty = true;
    }
    if (!P.set && P.t > 0.35 * (n + 1) + 3) {
      P.set = true;
      for (const q of c.channel) if (w.getBlock(q.x, FY - 1, q.z) === B.lava) w.setBlock(q.x, FY - 1, q.z, B.air);
      if (w.getBlock(c.mould.x, FY - 1, c.mould.z) === B.fg_castkey) w.setState(c.mould.x, FY - 1, c.mould.z, true);
      game.ui.msg('The metal dulls and settles in the channel. The key in the mould has gone dark: set.', '#c8c8b8');
      game.audio?.play('hiss', c.mould);
      game.lightDirty = true;
    }
  }
  T.pours = T.pours.filter((P) => !P.set);
  // The ash: whoever of you is in it, slow and short of breath.
  for (const c of T.clouds) {
    c.t -= dt;
    if (Math.random() < dt * 10) {
      const a = Math.random() * Math.PI * 2;
      const d = Math.random() * c.rad;
      r.emit(c.x + Math.cos(a) * d, FY + 0.3 + Math.random() * 1.2, c.z + Math.sin(a) * d, { n: 1, color: ['#5a5650', '#8a857e'], up: 3, speed: 4, gravity: -1, life: 1.4, shape: 'puff' });
    }
    for (const p of party) {
      if (!p || p.dead || Math.hypot(p.x - c.x, p.z - c.z) > c.rad) continue;
      p.slowT = Math.max(p.slowT || 0, 0.6);
      if (p.kind === 'player') p.stamina = Math.max(0, (p.stamina || 0) - dt * 0.8);
      if (!(p.ashNote > 0)) {
        p.ashNote = 1.6;
        r.floatText(p.x, p.y + 2.4, p.z, 'choking ash', '#c8c0b8');
      }
    }
  }
  for (const p of party) if (p && p.ashNote > 0) p.ashNote -= dt;
  T.clouds = T.clouds.filter((c) => c.t > 0);
  // A stoked cinderling burns down again.
  for (const c of run.creatures()) {
    if (!(c.stokedT > 0)) continue;
    c.stokedT -= dt;
    if (Math.random() < dt * 8) r.emit(c.x, c.y + 1, c.z, { n: 1, color: ['#ff8030', '#ffd060'], up: 20, speed: 10, life: 0.4, glow: true });
    if (c.stokedT <= 0) c.dmgMult = 1;
  }
  // The anvils' ring dying away; doors opening.
  for (const q of T.ringing) if ((q.t -= dt) <= 0) w.setState(q.x, FY, q.z, false);
  T.ringing = T.ringing.filter((q) => q.t > 0);
  for (const o of T.opening) {
    o.t -= dt;
    if (Math.random() < dt * 12) r.emit(o.x, FY + Math.random() * 2, o.z, { n: 1, color: ['#8a857e', '#5a5650'], up: 10, speed: 20, life: 0.5 });
    if (o.t <= 0) {
      for (const y of [FY, FY + 1]) {
        const n = BLOCKS[w.getBlock(o.x, y, o.z)].name;
        if (n === 'fg_kilndoor' || n === 'fg_guilddoor') w.setBlock(o.x, y, o.z, B.air);
      }
      game.audio?.play('creak', o);
      game.lightDirty = true;
    }
  }
  T.opening = T.opening.filter((o) => o.t > 0);
}
export { NOTES };
