// (Round 105) The Leviathan's Gut at work (laid out by world/deeps/gut.js):
// the heartbeat, under everything (faster the deeper you go); on it the
// sphincter valves open a moment (be in them then), and every third beat
// the ridged floor pushes whoever stands on it a tile along its grain;
// the bile sunk in the floor burns whoever wades it (not the crabs); the
// blisters, burst, leave bile puddled that burns a while, and set off the
// blisters by them; and the whalers' scar in the wall, cut open, gives on
// their cache.
//
// What's been done (the scars cut open) is kept in the floor's state, and
// put back when the floor's made again (see restore).
import { FY } from '../world/dungeongen.js';
import { B, BLOCKS } from '../world/blocks.js';

const k2 = (x, z) => `${x},${z}`;
const dist = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.z - b.z));
const mine = (run) => (run.state.gut ||= { opened: {} });
// What's going on about the floor this visit (not saved).
export const lvT = (run) => (run.gutT ||= { told: {}, beatT: 1, beats: 0, open: {}, acid: [], burn: new Map() });
const isGut = (run) => run && run.rec && run.rec.type === 'gut';
export const runOf = (game, x) => game.runAt?.(x) || game.dungeon || null;
// (The crabs' shells, and the gut's own, don't mind bile.)
const BILEPROOF = new Set(['bone_crab', 'bile_blister', 'slime', 'gutworm']);
// The beat: slower near the top, quicker the deeper you go.
export const beatOf = (run) => Math.max(1, 1.6 - (run.floor || 0) * 0.2);
const solid = (w, x, y, z) => !!(BLOCKS[w.getBlock(x, y, z)] || {}).solid;

// ------------------------------------------------------------ put back
export function restore(run) {
  if (!isGut(run)) return;
  const w = run.game.world;
  const S = mine(run);
  for (const s of run.data.scars || []) if (S.opened[k2(s.x, s.z)]) for (const y of [FY, FY + 1]) w.setBlock(s.x, y, s.z, B.air);
}

// ------------------------------------------------------------ clicked
export function sayOf(b) {
  switch (b.name) {
    case 'lv_barrels': return 'Casks of whale-oil, the bungs sealed with tar.';
    case 'lv_skeleton': return 'What\'s left of a whaler, his oilskin coat whole over it.';
    case 'lv_logbook': return 'A book, swollen with the wet, its pages stuck together.';
    default: return null;
  }
}
export function interact(run, x, y, z, b) {
  if (!isGut(run)) return false;
  const game = run.game;
  const w = game.world;
  switch (b.interact) {
    // The whalers' scar: cut open along their stitches.
    case 'lv_scar': {
      for (const yy of [FY, FY + 1]) if (w.getBlock(x, yy, z) === B.lv_scar) w.setBlock(x, yy, z, B.air);
      if ((run.data.scars || []).some((q) => q.x === x && q.z === z)) mine(run).opened[k2(x, z)] = true;
      game.renderer.emit(x, FY + 1, z, { n: 18, color: ['#a03a3c', '#d07068', '#76202a'], up: 20, speed: 30, gravity: 120, life: 0.8 });
      game.audio?.play('bite', { x, z });
      game.lightDirty = true;
      game.ui.msg('You cut along the whalers\' stitches, and the flesh parts: behind it, a hollow they cut and filled.', '#e0b0a0', true);
      return true;
    }
    case 'lv_valve':
      game.ui.msg('A ring of muscle, clenched shut. With every beat of the heart it slackens, a moment: through it then, or not at all.', '#e0b0a0');
      return true;
  }
  return false;
}

// ------------------------------------------------------------ the blisters
// A blister bursts: bile over everyone by it (not the crabs), a puddle of
// it on the floor that burns a while, and the blisters by it burst too.
export function burst(run, c) {
  const game = run.game;
  const r = game.renderer;
  r.emit(c.x, c.y + 0.6, c.z, { n: 26, color: ['#a0b828', '#d0e050', '#f0f8a0', '#6a8018'], up: 40, speed: 50, gravity: 140, life: 0.8 });
  r.floatText(c.x, c.y + 2.2, c.z, 'the blister bursts!', '#d0e050');
  game.audio?.play('splash', c);
  for (const e of [...game.everyone(), ...game.creatures]) {
    if (!e || e === c || e.dead || BILEPROOF.has(e.species) || dist(e, c) > 1 || Math.abs(e.y - c.y) > 1) continue;
    game.damage(e, 3, null);
    e.slowT = Math.max(e.slowT || 0, 1.5);
  }
  const T = lvT(run);
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) T.acid.push({ x: c.x + dx, z: c.z + dz, y: c.y, t: 6 });
  if (!T.told.blister) {
    T.told.blister = true;
    game.ui.msg('The blister bursts, and bile spatters everything near it: where it lies, it burns. (Anything that comes by one sets it off.)', '#d0e050', true);
  }
  // (And the next one along.)
  for (const o of game.creatures) if (!o.dead && o !== c && o.species === 'bile_blister' && dist(o, c) <= 1) o.burstSoon = 0.25;
}

// ------------------------------------------------------------ each step
export function tick(run, dt, party = null) {
  if (!isGut(run)) return;
  const game = run.game;
  const w = game.world;
  const T = lvT(run);
  const r = game.renderer;
  const who = (party || [game.player]).filter((p) => p && !p.dead);
  const mobs = run.creatures();
  // The blisters set off by their neighbours.
  for (const o of mobs) {
    if (o.dead || !(o.burstSoon > 0)) continue;
    o.burstSoon -= dt;
    if (o.burstSoon <= 0) game.damage(o, 99, o);
  }
  // The heartbeat.
  T.beatT -= dt;
  if (T.beatT <= 0) {
    T.beatT = beatOf(run);
    T.beats++;
    beat(run, T, who);
  }
  // The valves: open the moment after the beat, shut again after (never
  // on whoever's in them).
  for (const v of run.data.valves || []) {
    const kv = k2(v.x, v.z);
    const occupied = [...who, ...mobs].some((e) => e && !e.dead && e.x === v.x && e.z === v.z);
    if (T.open[kv] > 0) T.open[kv] -= dt;
    const open = T.open[kv] > 0 || occupied;
    const cur = w.getBlock(v.x, FY, v.z);
    if (open && cur === B.lv_valve) {
      for (const y of [FY, FY + 1]) w.setBlock(v.x, y, v.z, B.air);
      game.lightDirty = true;
    } else if (!open && cur === B.air) {
      for (const y of [FY, FY + 1]) w.setBlock(v.x, y, v.z, B.lv_valve);
      r.emit(v.x, FY + 1, v.z, { n: 4, color: ['#a03a3c', '#d07068'], up: 6, speed: 8, life: 0.3 });
    }
  }
  // Wading the bile, or standing in a burst blister's: it burns.
  const burning = (e) => {
    if (e.y === FY - 1 && w.getBlock(e.x, FY - 2, e.z) === B.lv_bile) return true;
    return T.acid.some((a) => a.x === e.x && a.z === e.z && Math.abs(a.y - e.y) <= 1);
  };
  for (const e of [...who, ...mobs]) {
    if (!e || e.dead || BILEPROOF.has(e.species) || !burning(e)) continue;
    const t = (T.burn.get(e) ?? 0) - dt;
    e.slowT = Math.max(e.slowT || 0, 0.4);
    if (t <= 0) {
      T.burn.set(e, 0.8);
      game.damage(e, 1, null);
      r.emit(e.x, e.y + 0.4, e.z, { n: 4, color: ['#d0e050', '#f0f8a0'], up: 10, speed: 8, life: 0.4 });
      if (e.kind === 'player' && !T.told.bile) {
        T.told.bile = true;
        game.ui.msg('The bile burns. Get out of it.', '#d0e050', true);
      }
    } else T.burn.set(e, t);
  }
  for (const a of T.acid) a.t -= dt;
  T.acid = T.acid.filter((a) => a.t > 0);
}
// On the beat: the walls pulse (a shake you feel in your teeth), the
// valves open, and every third beat the ridged floor pushes.
function beat(run, T, who) {
  const game = run.game;
  const w = game.world;
  const near = (q, r) => who.some((p) => dist(p, q) <= r);
  if (who.length) {
    game.audio?.play('heart', who[0]);
    game.shake = Math.min(0.6, (game.shake || 0) + 0.08);
  }
  for (const v of run.data.valves || []) {
    T.open[k2(v.x, v.z)] = 0.9;
    if (near(v, 8)) game.renderer.emit(v.x, FY + 1, v.z, { n: 6, color: ['#d07068', '#f0b0a0'], up: 8, speed: 12, life: 0.4 });
  }
  if (!T.told.beat && who.length) {
    T.told.beat = true;
    game.ui.msg('Under your feet, slow and enormous, a heartbeat. The walls move with it.', '#e0b0a0', true);
  }
  if (T.beats % 3 !== 0) return;
  // The ridged floor: whoever's on it (and isn't held fast to the wall)
  // goes a tile along its grain, if there's floor (or bile) there.
  const rugae = run.data.rugae || [];
  if (!rugae.length) return;
  const at = new Map(rugae.map((q) => [k2(q.x, q.z), q]));
  for (const e of [...who, ...run.creatures()]) {
    if (!e || e.dead || e.moving || (e.S && e.S.anchored) || e.y !== FY) continue;
    const q = at.get(k2(e.x, e.z));
    if (!q) continue;
    const nx = e.x + q.dx;
    const nz = e.z + q.dz;
    if (solid(w, nx, FY, nz) || solid(w, nx, FY + 1, nz)) continue;
    const y = solid(w, nx, FY - 1, nz) ? FY : solid(w, nx, FY - 2, nz) ? FY - 1 : null;
    if (y === null) continue;
    const there = game.occ?.get(game.occKey(nx, y, nz));
    if (there && there !== e) continue;
    game.moveEntity(e, nx, y, nz);
    e.teleport?.(nx, y, nz);
    game.renderer.emit(e.x, FY + 0.2, e.z, { n: 3, color: ['#d07068', '#a03a3c'], up: 4, speed: 10, life: 0.3 });
    if (e.kind === 'player' && !T.told.rugae) {
      T.told.rugae = true;
      game.ui.msg('The ridged floor heaves under you on the beat and carries you along it.', '#e0b0a0', true);
    }
  }
}
