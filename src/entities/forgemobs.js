// (Round 101) What works in the Kiln-Deep beside its slag crabs, cinderlings,
// magma slugs, glasshides and forge hounds (laid out by world/deeps/
// forge.js, drawn in render/art/forge_mobs.js; the hammers, the steam, the
// grates and the rest they work by are in game/forgework.js), each made to
// work with the others:
//   the ash-smith: one of the sealed smiths, burnt to ash in the shape of a
//     man, leather apron, hammer. Still at the work: it pays you no mind
//     unless you strike it or take from its racks. At an anvil, every blow
//     of its hammer mends the iron near it (the wardens, the hounds, the
//     bellowsbacks). It falls in a cloud of choking ash.
//   the bellowsback: a squat construct with a great bellows on its back.
//     It breathes a gust down a line that throws you back (into the
//     channel, under the hammer, into the vent) and fans the fire: a
//     cinderling in it is stoked (its fire hotter, wider), a grate flares.
//   the iron warden: riveted plate, a shield for a front, slow. Cold iron:
//     blows land a third as hard. Through fire it goes red-hot (it burns
//     you when it strikes, and blows land true); quenched while hot (in a
//     trough, in the steam) it goes brittle, and blows land double.
import { BRAINS } from './monsters.js';
import { knock } from '../game/combat.js';
import { burn } from '../game/gems.js';
import { FY } from '../world/dungeongen.js';
import { B } from '../world/blocks.js';
import { forgeCloud, provoke, flareLine, heatAt, steamAt } from '../game/forgework.js';

const dist = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.z - b.z));
const runOf = (c) => c.game.runAt?.(c.x) || c.game.dungeon || null;
const IRON = new Set(['iron_warden', 'forge_hound', 'bellowsback']);

// An ash-smith struck: it and its fellows turn on whoever did it.
function smithStruck(game, c, src, amount) {
  if (src && src !== c && (src.kind === 'player' || src.kind === 'npc')) {
    const run = runOf(c);
    if (run) provoke(run, src, c, 'struck');
    else {
      c.angry = true;
      c.peaceful = false;
      c.target = src;
    }
  }
  return amount;
}
// The iron warden: cold iron turns blows; hot, they land; brittle, double.
function wardenWard(game, c, src, amount) {
  if (c.brittleT > 0) {
    if (!(c.wardNote > 0)) {
      c.wardNote = 0.8;
      game.renderer.floatText(c.x, c.y + 2.6, c.z, 'brittle!', '#c8e8ff');
    }
    return Math.round(amount * 2);
  }
  if (c.hotT > 0) return amount;
  if (!(c.wardNote > 0)) {
    c.wardNote = 1.2;
    game.renderer.floatText(c.x, c.y + 2.6, c.z, 'cold iron', '#a0a8b8');
  }
  return Math.max(1, Math.round(amount / 3));
}

export const FORGE_SPECIES = {
  ash_smith: {
    name: 'Ash-Smith', hp: 18, dmg: 4, step: 0.55, mode: 'passive', aggro: 9, under: true, fireproof: true, brain: 'ashSmith', calm: 'ashSmith', style: 'bash', ward: smithStruck, isle: 'kharos',
    drops: [['coal', 1, 2, 0.6], ['iron_ingot', 1, 1, 0.3]],
    // (Fallen: its ash, choking, all about it.)
    onDeath(game, c) {
      const run = runOf(c);
      if (run) forgeCloud(run, c.x, c.z, 1.8, 3.5);
      game.renderer.emit(c.x, c.y + 1, c.z, { n: 26, color: ['#5a5650', '#8a857e', '#2e2c2c'], up: 24, speed: 30, life: 1.2, shape: 'puff', gravity: -8 });
      game.renderer.floatText(c.x, c.y + 2.2, c.z, 'it falls to ash', '#a8a098');
    },
  },
  bellowsback: { name: 'Bellowsback', hp: 18, dmg: 3, step: 0.5, mode: 'hostile', aggro: 10, under: true, construct: true, fireproof: true, brain: 'bellowsback', style: 'bash', isle: 'kharos', drops: [['leather', 1, 2, 0.6], ['iron_ingot', 1, 1, 0.3]] },
  iron_warden: {
    name: 'Iron Warden', hp: 34, dmg: 5, step: 0.75, mode: 'hostile', aggro: 9, under: true, construct: true, fireproof: true, brain: 'ironWarden', style: 'bash', ward: wardenWard, isle: 'kharos',
    drops: [['iron_ingot', 1, 3, 0.8]],
    // (Red-hot, its blows burn.)
    onHit(game, a, v) {
      if (a.hotT > 0) burn(game, v, a, 2);
    },
  },
};

export const FORGE_BRAINS = {
  // At the work: at its anvil, blow on blow, mending the iron near it; on a
  // bench, at rest. Given cause, it fights as anyone would.
  ashSmith(c, dt) {
    const game = c.game;
    if (c.angry) {
      c.peaceful = false;
      return false;
    }
    c.target = null;
    const a = c.anvil;
    if (!a) return true;
    if (dist(c, a) > 1) {
      if (!c.moving) {
        const sx = Math.sign(a.x - c.x);
        const sz = Math.sign(a.z - c.z);
        (sx && c.tryStep(c.x + sx, c.z, c.S.step)) || (sz && c.tryStep(c.x, c.z + sz, c.S.step));
      }
      return true;
    }
    c.face(a.x, a.z);
    c.strikeT = (c.strikeT ?? 0.4) - dt;
    if (c.strikeT <= 0) {
      c.strikeT = 1.4;
      c.doAction?.(0.4);
      game.renderer.emit(a.x, FY + 1, a.z, { n: 6, color: ['#ffd060', '#ff8030', '#ffffff'], up: 30, speed: 40, life: 0.4, glow: true });
      if (Math.random() < 0.4) game.audio?.play('tink', a);
      // (Each blow mends the iron near it.)
      for (const o of game.creatures) {
        if (o === c || o.dead || !IRON.has(o.species) || dist(o, c) > 4 || o.hp >= o.maxHp) continue;
        o.hp = Math.min(o.maxHp, o.hp + 1);
        game.renderer.emit(o.x, o.y + 1.2, o.z, { n: 4, color: ['#ffd060', '#ffb040'], up: 14, speed: 10, life: 0.5, glow: true });
        if (!(o.mendNote > 0)) {
          o.mendNote = 3;
          game.renderer.floatText(o.x, o.y + 2.4, o.z, 'mended at the anvil', '#ffd080');
        }
      }
    }
    for (const o of game.creatures) if (o.mendNote > 0) o.mendNote -= dt / Math.max(1, game.creatures.length);
    return true;
  },

  // Lined up with you, it draws in, and breathes: a gust down the line that
  // throws you back and fans the fire.
  bellowsback(c, dt) {
    const game = c.game;
    const t = c.target;
    c.gustCd = (c.gustCd ?? 2) - dt;
    if (c.gustWind > 0) {
      c.gustWind -= dt;
      if (Math.random() < dt * 20) game.renderer.emit(c.x, c.y + 1, c.z, { n: 1, color: ['#c8c0b8', '#8a857e'], up: 6, speed: 12, life: 0.4, shape: 'puff' });
      if (c.gustWind > 0) return true;
      gust(c, c.gustDir);
      return true;
    }
    if (!t || t.dead) return false;
    const dx = t.x - c.x;
    const dz = t.z - c.z;
    const lined = (dx === 0 || dz === 0) && dist(c, t) <= 6 && dist(c, t) >= 1 && Math.abs(t.y - c.y) < 1.5;
    if (lined && c.gustCd <= 0) {
      c.gustCd = 5;
      c.gustWind = 0.7;
      c.gustDir = { x: Math.sign(dx), z: Math.sign(dz) };
      c.face(t.x, t.z);
      c.doAction?.(0.7);
      game.renderer.floatText(c.x, c.y + 2.2, c.z, 'it draws in...', '#c8c0b8');
      game.audio?.play('whoosh', c);
      return true;
    }
    return false;
  },

  // Through fire, red-hot; quenched hot, brittle.
  ironWarden(c, dt) {
    const game = c.game;
    const run = runOf(c);
    if (c.wardNote > 0) c.wardNote -= dt;
    if (c.brittleT > 0) {
      c.brittleT -= dt;
      if (Math.random() < dt * 4) game.renderer.emit(c.x, c.y + 1.4, c.z, { n: 1, color: ['#e0f0ff', '#a0c8e8'], up: 6, speed: 6, life: 0.6 });
    }
    // (In fire, on a grate, beside the metal, or burning: it heats.)
    const hot = c.burnT > 0 || (run && heatAt(run, c.x, c.z));
    if (hot && !(c.brittleT > 0)) {
      if (!(c.hotT > 0)) game.renderer.floatText(c.x, c.y + 2.6, c.z, 'red-hot!', '#ff9040');
      c.hotT = 7;
    }
    if (c.hotT > 0) {
      c.hotT -= dt;
      if (Math.random() < dt * 6) game.renderer.emit(c.x, c.y + 1.2, c.z, { n: 1, color: ['#ff8030', '#ffd060'], up: 20, speed: 8, life: 0.5, glow: true });
      // (Quenched: in the water, in the steam.)
      const wet = game.world.getBlock(c.x, FY - 1, c.z) === B.water || game.world.getBlock(c.x, c.y, c.z) === B.water || (run && steamAt(run, c.x, c.z));
      if (wet) {
        c.hotT = 0;
        c.brittleT = 6;
        game.renderer.emit(c.x, c.y + 1, c.z, { n: 24, color: ['#ffffff', '#e0e8f0', '#c8d0d8'], up: 40, speed: 30, life: 1.0, shape: 'puff', gravity: -20 });
        game.renderer.floatText(c.x, c.y + 2.8, c.z, 'quenched - brittle!', '#c8e8ff');
        game.audio?.play('hiss', c);
      }
    }
    return false;
  },
};

// A bellowsback's breath: down the line before it, six paces.
function gust(c, dir) {
  const game = c.game;
  const run = runOf(c);
  const tiles = [];
  for (let k = 1; k <= 6; k++) tiles.push({ x: c.x + dir.x * k, z: c.z + dir.z * k });
  for (const t of tiles) {
    game.renderer.emit(t.x, c.y + 1, t.z, { n: 3, color: ['#e8e0d8', '#b8b0a8'], up: 4, speed: 30, life: 0.5, shape: 'puff' });
  }
  const on = (e) => tiles.some((t) => t.x === e.x && t.z === e.z) && Math.abs(e.y - c.y) < 1.5;
  for (const e of [...game.everyone(), ...game.creatures]) {
    if (e === c || e.dead || !on(e)) continue;
    // Thrown back.
    if (e.kind === 'player' || !e.S || !e.S.anchored) {
      knock(game, { x: e.x - dir.x, z: e.z - dir.z }, e, 2);
      if (e.kind === 'player') game.renderer.floatText(e.x, e.y + 2.4, e.z, 'blown back!', '#e8e0d8');
    }
    // A cinderling fanned: stoked.
    if (e.species === 'cinderling') {
      e.stokedT = 8;
      e.dmgMult = 1.6;
      game.renderer.floatText(e.x, e.y + 2, e.z, 'stoked!', '#ffb040');
      game.renderer.emit(e.x, e.y + 1, e.z, { n: 14, color: ['#ff8030', '#ffd060'], up: 30, speed: 30, life: 0.6, glow: true });
    }
  }
  if (run) flareLine(run, tiles);
}

Object.assign(BRAINS, FORGE_BRAINS);
