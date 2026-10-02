// The great beam: the Overseer's, or yours through its Eye. It gathers a
// moment (light drawn into it), then pours out: a white core in a red
// sheath, turning slowly toward what it's aimed at, burning whatever's on
// its line (and a pace either side of it, for the Overseer's), and leaving
// the floor alight where it passes (see monsters.groundFire). Drawn by
// fx.drawLasers.
import { lineTiles, groundFire } from '../entities/monsters.js';
import { burn, chill } from './gems.js';
import { footTiles } from '../entities/footprint.js';

// `o`: { by, ang, aim() (the angle it's turned toward, or null), turn
// (radians a second), len, charge, dur, dmg, tick, width (1: three paces
// wide; less: one), foes ('player': you and townsfolk; 'monsters': the
// hostile), fire }.
export function startLaser(game, o) {
  const L = {
    by: o.by, ang: o.ang, aim: o.aim || null, turn: o.turn ?? 0.35, len: o.len ?? 16, charge: o.charge ?? 1.2, dur: o.dur ?? 5, dmg: o.dmg ?? 4, tick: o.tick ?? 0.3,
    width: o.width ?? 1, foes: o.foes || 'player', fire: o.fire !== false, t: 0, acc: 0, fireT: 0.3, beamT: 0, tiles: [], end: null, y: o.by.y,
    hue: o.hue || 'red', chill: o.chill || 0,
  };
  (game.lasers ||= []).push(L);
  game.audio?.play('charge', o.by);
  return L;
}

// The tiles it burns: its line, and for a wide one a pace either side.
function widen(tiles, width, ang) {
  if (width < 1) return tiles;
  const px = Math.round(-Math.sin(ang));
  const pz = Math.round(Math.cos(ang));
  const out = [...tiles];
  for (const q of tiles) {
    out.push({ x: q.x + px, z: q.z + pz });
    out.push({ x: q.x - px, z: q.z - pz });
  }
  return out;
}

export function updateLasers(game, dt) {
  // (The Overseer's spikes go with it: see monsters.js.)
  if (game.kavSpikes && game.kavSpikes.length) game.kavSpikes = game.kavSpikes.filter((s) => s.by && !s.by.dead && !s.gone);
  if (!game.lasers || !game.lasers.length) return;
  const r = game.renderer;
  for (const L of game.lasers) {
    const o = L.by;
    L.t += dt;
    if (!o || o.dead || L.t >= L.charge + L.dur) {
      L.done = true;
      continue;
    }
    const goal = L.aim ? L.aim() : null;
    if (goal !== null && goal !== undefined) {
      const d = Math.atan2(Math.sin(goal - L.ang), Math.cos(goal - L.ang));
      L.ang += Math.max(-L.turn * dt, Math.min(L.turn * dt, d));
    }
    L.y = o.y;
    const to = { x: o.x + Math.cos(L.ang) * L.len, z: o.z + Math.sin(L.ang) * L.len };
    L.tiles = lineTiles(game, { x: o.x, z: o.z, y: o.y }, to, L.len, o.y);
    const last = L.tiles[L.tiles.length - 1];
    L.end = last ? { x: last.x + Math.cos(L.ang) * 0.5, z: last.z + Math.sin(L.ang) * 0.5 } : { x: o.x + Math.cos(L.ang), z: o.z + Math.sin(L.ang) };
    if (L.t < L.charge) {
      // Gathering: sparks rising round it.
      if (Math.random() < dt * 40) {
        const a = Math.random() * Math.PI * 2;
        r.emit(o.x + Math.cos(a) * 0.9, o.y + 0.6 + Math.random() * 1.6, o.z + Math.sin(a) * 0.9, { n: 1, color: L.hue === 'grave' ? ['#a070ff', '#e0c8ff', '#ffffff'] : L.hue === 'arc' ? ['#40c0ff', '#e0fbff', '#ffffff'] : ['#ff6040', '#ffd0b0', '#ffffff'], up: 14, speed: 6, gravity: -10, life: 0.5, glow: true });
      }
      continue;
    }
    if (!L.fired) {
      L.fired = true;
      game.audio?.play('boom', o);
      game.shake = Math.max(game.shake || 0, L.width >= 1 ? 0.7 : 0.35);
    }
    L.beamT -= dt;
    if (L.beamT <= 0) {
      L.beamT = 0.3;
      game.audio?.play('beam', L.end);
    }
    game.shake = Math.max(game.shake || 0, L.width >= 1 ? 0.14 : 0.06);
    // Everything on its line burned, every so often.
    L.acc += dt;
    if (L.acc >= L.tick) {
      L.acc = 0;
      const keys = new Set(widen(L.tiles, L.width, L.ang).map((q) => q.x * 65536 + q.z));
      const targets = L.foes === 'player' ? [game.player, ...game.npcs] : game.creatures.filter((c) => c.hostileNow || c.S?.mode === 'hostile');
      for (const e of targets) {
        if (!e || e === o || e.dead || e.down || e.burrowed || Math.abs(e.y - o.y) > 1.5 || !footTiles(e).some((q) => keys.has(q.x * 65536 + q.z))) continue;
        if (e.kind === 'player' && e.rollT > 0) continue;
        game.damage(e, L.dmg, o);
        if (L.chill) chill(e, L.chill);
        else burn(game, e, o, 1.5);
      }
    }
    // And the floor left alight behind it.
    if (L.fire && L.tiles.length > 2) {
      L.fireT -= dt;
      if (L.fireT <= 0) {
        L.fireT = L.width >= 1 ? 0.12 : 0.2;
        const q = L.tiles[2 + Math.floor(Math.random() * (L.tiles.length - 2))];
        groundFire(game, q.x, q.z, o.y, o, L.foes !== 'player', 1);
      }
    }
    if (Math.random() < dt * 30) r.emit(L.end.x, o.y + 0.4, L.end.z, { n: 2, color: L.hue === 'grave' ? ['#ffffff', '#c8a0ff', '#8a40ff'] : L.hue === 'arc' ? ['#ffffff', '#a0f0ff', '#20a8ff'] : ['#ffffff', '#ffd060', '#ff6030'], up: 30, speed: 50, life: 0.4, glow: true });
  }
  game.lasers = game.lasers.filter((L) => !L.done);
}
