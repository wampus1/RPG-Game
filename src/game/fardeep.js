// What makes each far land's own kind of old place dangerous to walk
// through, now and then (see DungeonRun.placeDangers), and what drifts in
// its air (see DungeonRun.ambience). (Round 68: see world/fardeep.js.)
//   An Imperial Catacomb: the dead legions' spears thrust out of the
//     niches, a rank of them along the row you're in;
//   a Terracotta Vault: the clay army's crossbows loose down the hall, a
//     cross of bolts through where you stand;
//   the Leviathan's Gut: it digests; bile wells up round you and eats at
//     what it touches, and its heart beats through everything;
//   a Salt Cathedral: the brine rises, and salt crystallises round your
//     feet (roll free before it sets);
//   a Deep Warren: something digs under you, and the floor gives;
//   a Hollow Hill: nothing stays where it was put: you included, whisked
//     off to somewhere else in the hill in a swirl of glamour;
//   a Drowned Broch: the gale comes in through the slits, and the spray.
import { FY } from '../world/dungeongen.js';
import { B, BLOCKS } from '../world/blocks.js';
import { addHazard, addZone, areaTiles } from '../entities/monsters.js';

const open = (game, x, z) => {
  const b = game.world.getBlock(x, FY, z);
  return b === B.air || !BLOCKS[b].solid;
};
const floorAt = (game, x, z) => BLOCKS[game.world.getBlock(x, FY - 1, z)].solid && open(game, x, z) && !BLOCKS[game.world.getBlock(x, FY + 1, z)].solid;

// A row of open floor through (x, z), along x (`across`) or z, out to `n`
// each way or the first wall.
function row(game, x, z, across, n) {
  const out = [{ x, z }];
  for (const s of [-1, 1]) {
    for (let k = 1; k <= n; k++) {
      const q = across ? { x: x + s * k, z } : { x, z: z + s * k };
      if (!open(game, q.x, q.z)) break;
      out.push(q);
    }
  }
  return out;
}

// Its peril, if it has one of its own: true if it went off.
export function farDanger(run, type, p, dmg) {
  const game = run.game;
  const r = game.renderer;
  const say = (k, text, col) => {
    if (!run[k]) game.ui.msg(text, col, true);
    run[k] = true;
  };
  switch (type) {
    case 'catacomb': {
      // A rank of spears out of the niches, along your row: the dead
      // legion dressing its line.
      const across = Math.random() < 0.5;
      const tiles = row(game, p.x, p.z, across, 6);
      for (const t of tiles) r.emit(t.x, FY + 0.6, t.z, { n: 1, color: ['#c8d8ff', '#ffe8a0'], up: 4, speed: 4, life: 1, glow: true });
      const a = tiles.reduce((m, q) => (across ? (q.x < m.x ? q : m) : q.z < m.z ? q : m), tiles[0]);
      const b = tiles.reduce((m, q) => (across ? (q.x > m.x ? q : m) : q.z > m.z ? q : m), tiles[0]);
      addHazard(game, { tiles, y: FY, dur: 1.4, dmg, kind: 'beam', from: a, to: b, beamColor: '#e8f0ff', halo: '#c8a040', width: 2, trap: true, place: true, color: [220, 200, 140] });
      game.audio?.play('march');
      say('toldRanks', 'Spear-points glint in the niches along your row... (the ranks are dressing: get out of line!)', '#e0d0a0');
      return true;
    }
    case 'vault': {
      // The clay crossbowmen loose down the hall: a cross of bolts.
      const tiles = [...row(game, p.x, p.z, true, 7), ...row(game, p.x, p.z, false, 5).slice(1)];
      for (const t of tiles) if (Math.random() < 0.4) r.emit(t.x, FY + 0.8, t.z, { n: 1, color: ['#ff9060', '#ffd0a0'], up: 2, speed: 3, life: 0.8 });
      const ends = [row(game, p.x, p.z, true, 7), row(game, p.x, p.z, false, 5)];
      for (const line of ends) {
        const far = line[line.length - 1];
        addHazard(game, { tiles: line, y: FY, dur: 1.5, dmg, kind: 'dart', from: far, to: line[0], trap: true, place: true, color: [230, 120, 80] });
      }
      game.audio?.play('creak');
      say('toldBows', 'Crossbows creak in the dark: the clay soldiers are drawing on you! (step off the cross)', '#ffb090');
      return true;
    }
    case 'gut': {
      // Bile wells up round you, and lies a while, eating at you.
      const tiles = [{ x: p.x, z: p.z }, ...areaTiles(p.x, p.z, 2, true).filter((q) => Math.random() < 0.4 && floorAt(game, q.x, q.z))];
      for (const t of tiles) r.emit(t.x, FY + 0.1, t.z, { n: 2, color: ['#a8c040', '#d8e870'], up: 6, speed: 4, life: 0.9, oy: 6 });
      addHazard(game, { tiles, y: FY, dur: 1.4, dmg: Math.round(dmg * 0.6), kind: 'acid', trap: true, place: true, onFire: (g) => {
        addZone(g, { kind: 'bile', tiles, y: FY, life: 6, slow: true, color: [150, 180, 60], puff: ['#a8c040', '#d8e870'] });
      } });
      game.audio?.play('splash');
      say('toldBile', 'The floor of the gut heaves, and bile wells up round your feet! (move!)', '#c8e070');
      return true;
    }
    case 'saltworks': {
      // The brine rises round you, and the salt sets.
      const tiles = [{ x: p.x, z: p.z }, ...areaTiles(p.x, p.z, 1).filter(() => Math.random() < 0.55)];
      for (const t of tiles) r.emit(t.x, FY + 0.1, t.z, { n: 2, color: ['#ffffff', '#f8d8e8'], up: 4, speed: 4, life: 1.1, oy: 6, glow: true });
      addHazard(game, { tiles, y: FY, dur: 1.5, dmg: Math.round(dmg * 0.5), kind: 'cold', color: [240, 230, 240], trap: true, place: true, onFire: (g, h, hit) => {
        for (const e of hit) if (e.kind === 'player') {
          e.grabbedT = Math.max(e.grabbedT || 0, 1.4);
          g.renderer.floatText(e.x, e.y + 2.4, e.z, 'crystallised! (roll free)', '#ffffff');
        }
        for (const t of h.tiles) g.renderer.emit(t.x, FY + 0.4, t.z, { n: 4, color: ['#ffffff', '#f0e8f8'], up: 20, speed: 16, life: 0.6, glow: true });
      } });
      game.audio?.play('salt_song');
      say('toldSalt', 'Brine wells up through the floor, and the salt begins to sing... (move before it sets!)', '#f8e8f0');
      return true;
    }
    case 'warren': {
      // Something digging under you: the floor heaves and gives.
      const tiles = [{ x: p.x, z: p.z }, ...areaTiles(p.x, p.z, 1).filter(() => Math.random() < 0.5)];
      for (const t of tiles) r.emit(t.x, FY + 0.1, t.z, { n: 3, color: ['#7a5a3a', '#a8885a'], up: 6, speed: 6, life: 0.8, oy: 6 });
      addHazard(game, { tiles, y: FY, dur: 1.3, dmg, stun: 0.5, kind: 'erupt', trap: true, place: true });
      game.audio?.play('rumble');
      game.shake = Math.min(1, (game.shake || 0) + 0.25);
      say('toldDigger', 'Something is digging, right under your feet... (move!)', '#d8b890');
      return true;
    }
    case 'mound': {
      // Whisked away: somewhere else in the hill, a swirl of glamour.
      const spots = [];
      for (let k = 0; k < 40 && spots.length < 1; k++) {
        const x = p.x + Math.round((Math.random() - 0.5) * 24);
        const z = p.z + Math.round((Math.random() - 0.5) * 16);
        if (Math.abs(x - p.x) + Math.abs(z - p.z) < 6) continue;
        if (!floorAt(game, x, z) || game.entityAt?.(x, FY, z) || game.world.isWaterAt?.(x, FY, z)) continue;
        const b = run.data.bossRoom;
        if (b && x >= b.x0 - 1 && x <= b.x1 + 1 && z >= b.z0 - 1 && z <= b.z1 + 1) continue;
        spots.push({ x, z });
      }
      if (!spots.length) return false;
      const to = spots[0];
      for (const at of [p, to]) {
        r.emit(at.x, FY + 1, at.z, { n: 24, color: ['#c8a0ff', '#80ffd0', '#ffffff'], up: 30, speed: 30, life: 1, glow: true });
        r.effect?.({ type: 'ring', wx: at.x, wy: FY, wz: at.z, r0: 3, r1: 24, color: ['#c8a0ff', '#ffffff'], life: 0.6, oy: 3, flat: 0.5, thick: 2 });
      }
      p.teleport(to.x, FY, to.z);
      game.audio?.play('chime');
      game.renderer.flashScreen?.('#c8a0ff', 0.25);
      say('toldGlamour', 'The hill turns about you, and you are somewhere else. (Nothing stays where it was put here.)', '#d8c0ff');
      return true;
    }
    case 'broch': {
      // A gale through the slits, along your row: knocked along it, soaked.
      const across = Math.random() < 0.5;
      const dir = Math.random() < 0.5 ? 1 : -1;
      const tiles = row(game, p.x, p.z, across, 4);
      for (const t of tiles) r.emit(t.x, FY + 1, t.z, { n: 2, color: ['#c8e0f0', '#ffffff'], up: 2, speed: 30, life: 0.6, shape: 'puff' });
      const from = across ? { x: p.x - dir, z: p.z } : { x: p.x, z: p.z - dir };
      addHazard(game, { tiles, y: FY, dur: 1.3, dmg: Math.round(dmg * 0.5), knock: 2, from, chill: 1.5, kind: 'cold', color: [180, 210, 230], trap: true, place: true });
      game.audio?.play('wind_low');
      say('toldGale', 'The wind howls in through the arrow-slits... (a gale: get out of its way!)', '#c8e0f0');
      return true;
    }
  }
  return false;
}

// What drifts in its air, at (x, z): `c` its motes' colours.
export function farMotes(game, type, x, z, c) {
  const r = game.renderer;
  switch (type) {
    case 'catacomb':
      // Dust turning slowly down through the dark, gold where it catches
      // the light.
      r.emit(x, FY + 2.4, z, { n: 1, color: c, up: -2, speed: 2, gravity: 3, life: 3, glow: Math.random() < 0.3 });
      return true;
    case 'vault':
      // Incense, and sparks off the lanterns.
      if (Math.random() < 0.7) r.emit(x, FY + 1.4, z, { n: 1, color: ['#8a7a70', '#b0a090'], up: 4, speed: 2, gravity: -3, life: 2.4, shape: 'puff' });
      else r.emit(x, FY + 1.8, z, { n: 1, color: c, up: 8, speed: 4, gravity: -6, life: 1.2, glow: true });
      return true;
    case 'gut':
      // Bile dripping off the ribs, and the steam off it.
      if (Math.random() < 0.5) r.emit(x, FY + 2.6, z, { n: 1, color: ['#c8d870', '#a8b850'], up: -2, speed: 1, gravity: 80, life: 0.9, oy: -10 });
      else r.emit(x, FY + 0.2, z, { n: 1, color: c, up: 3, speed: 3, gravity: -4, life: 2, shape: 'puff' });
      return true;
    case 'saltworks':
      // Salt glittering in the air, turning, catching what light there is.
      r.emit(x, FY + 0.5 + Math.random() * 1.8, z, { n: 1, color: c, up: 1, speed: 2, gravity: -1, life: 2.6, glow: true });
      return true;
    case 'warren':
      // Earth sifting from the roof; a lantern pod's glow drifting.
      if (Math.random() < 0.6) r.emit(x, FY + 2.6, z, { n: 1, color: ['#7a5a3a', '#5a4430'], up: -4, speed: 2, gravity: 60, life: 1.2, oy: -10 });
      else r.emit(x, FY + 1, z, { n: 1, color: c, up: 2, speed: 3, gravity: -2, life: 2.4, glow: true });
      return true;
    case 'mound': {
      // Fey lights, wandering in little circles.
      const t = game.time || 0;
      r.emit(x + Math.cos(t + x) * 0.5, FY + 0.8 + Math.sin(t * 2 + z) * 0.5, z, { n: 1, color: c, up: 3, speed: 6, gravity: -2, life: 2, glow: true });
      return true;
    }
    case 'broch':
      // Spray, driven in on the wind.
      r.emit(x, FY + 1 + Math.random(), z, { n: 1, color: c, up: 1, speed: 12, gravity: 20, life: 0.9 });
      return true;
  }
  return false;
}
