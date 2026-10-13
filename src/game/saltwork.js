// (Round 106) The Salt Cathedral at work (laid out by
// world/deeps/saltworks.js): the brine, that crusts whoever wades it till
// they're set fast in the salt (not the scorpions, the flamingos, the
// blooms), and mends the salt wights and rakers that stand in it; the
// chandeliers, hung on ropes tied off at the wall, that come down on
// whatever's under them when a rope's slipped; the singing crystals, that
// ring when struck (everything made of salt by them shaken still, the
// blooms' growth shattered; and everything near woken, the flamingos
// startled); the treadwheel by the lake, that opens the sluice: the lake
// drains, the flooded arch comes clear, and what lay drowned on its bed
// gets up; and the bricked-up chapel, struck down.
//
// What's been done (the lakes drained, the chandeliers down, the bricks
// struck down) is kept in the floor's state, and put back when the floor's
// made again (see restore).
import { FY } from '../world/dungeongen.js';
import { B } from '../world/blocks.js';

const k2 = (x, z) => `${x},${z}`;
const dist = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.z - b.z));
const mine = (run) => (run.state.salt ||= { drained: {}, fallen: {}, bricks: {} });
// What's going on about the floor this visit (not saved).
export const swT = (run) => (run.saltT ||= { told: {}, rang: {}, mend: new Map() });
const isSalt = (run) => run && run.rec && run.rec.type === 'saltworks';
export const runOf = (game, x) => game.runAt?.(x) || game.dungeon || null;
// (Their shells, their legs, their crystal: the brine doesn't take to
// them.)
export const CRUSTPROOF = new Set(['brine_scorpion', 'pale_flamingo', 'salt_bloom', 'slime', 'salt_mother']);
// (Made of salt: they mend in the brine, and shake still when the crystals
// ring.)
export const SALTMADE = new Set(['salt_wight', 'salt_raker', 'salt_bloom', 'salt_mother']);
// How long in the brine before the salt sets you fast.
export const SET_AFTER = 3;

// ------------------------------------------------------------ put back
export function restore(run) {
  if (!isSalt(run)) return;
  const w = run.game.world;
  const S = mine(run);
  for (const wh of run.data.wheels || []) if (wh.lake && S.drained[k2(wh.x, wh.z)]) drain(run, wh, true);
  for (const c of run.data.chandeliers || []) if (S.fallen[k2(c.x, c.z)]) fall(run, c, true);
  for (const q of run.data.bricks || []) if (S.bricks[k2(q.x, q.z)]) for (const y of [FY, FY + 1]) w.setBlock(q.x, y, q.z, B.air);
}

// ------------------------------------------------------------ clicked
export function sayOf(b) {
  switch (b.name) {
    case 'sw_altar': return 'An altar cut out of one block of salt, a white cloth over it.';
    case 'sw_mother': return 'The Salt Mother, as the miners carved her: veiled, her arms open. Brine runs from under her veil.';
    case 'sw_ledger': return 'A book swollen with damp, its pages salted together.';
    case 'sw_dead': return 'A miner, white with salt from his hood to his boots.';
    default: return null;
  }
}
export function interact(run, x, y, z, b) {
  if (!isSalt(run)) return false;
  const game = run.game;
  const w = game.world;
  switch (b.interact) {
    // A chandelier's rope, tied off: slip it.
    case 'sw_cleat': {
      const c = (run.data.chandeliers || []).find((q) => q.cleat.x === x && q.cleat.z === z);
      if (!c || mine(run).fallen[k2(c.x, c.z)]) {
        game.ui.msg('A rope tied off on an iron ring. It goes up into the dark, and holds nothing now.', '#e8e0e0');
        return true;
      }
      fall(run, c, false);
      return true;
    }
    // The treadwheel: by the lake, it opens the sluice; in the shaft, it's
    // the hoist's, its rope long gone.
    case 'sw_wheel': {
      const wh = (run.data.wheels || []).find((q) => q.x === x && q.z === z);
      if (!wh || !wh.lake) {
        game.ui.msg('The hoist\'s treadwheel. Its rope ran up the shaft once; it hangs in tatters now.', '#e8e0e0');
        return true;
      }
      if (mine(run).drained[k2(x, z)]) {
        game.ui.msg('The sluice stands open. The lake is gone down into the old sump.', '#e8e0e0');
        return true;
      }
      mine(run).drained[k2(x, z)] = true;
      drain(run, wh, false);
      return true;
    }
    // A singing crystal: struck, it rings.
    case 'sw_singer':
      ring(run, { x, y, z }, game.player);
      return true;
    // The bricked-up chapel: struck down.
    case 'sw_bricked': {
      for (const yy of [FY, FY + 1]) if (w.getBlock(x, yy, z) === B.sw_bricked) w.setBlock(x, yy, z, B.air);
      if ((run.data.bricks || []).some((q) => q.x === x && q.z === z)) mine(run).bricks[k2(x, z)] = true;
      game.renderer.emit(x, FY + 1, z, { n: 30, color: ['#f0ece8', '#d0ccc8', '#a8a4a0'], up: 30, speed: 40, gravity: 120, life: 1 });
      game.audio?.play('rumble', { x, z });
      game.shake = Math.min(1, (game.shake || 0) + 0.3);
      game.lightDirty = true;
      game.ui.msg('You strike the bricks. The old salt mortar gives, and the wall falls in on a chapel nobody was meant to open.', '#f0e8e8', true);
      return true;
    }
  }
  return false;
}

// ------------------------------------------------------------ the chandelier
// Down it comes: on everything under it and by it, hurt and stunned; its
// crystal everywhere.
export function fall(run, c, quiet) {
  const game = run.game;
  const w = game.world;
  w.setBlock(c.x, FY, c.z, B.sw_shards, (c.x + c.z) % 2);
  for (const y of [FY, FY + 1]) if (w.getBlock(c.cleat.x, y, c.cleat.z) === B.sw_cleat) w.setBlock(c.cleat.x, y, c.cleat.z, B.sw_rock);
  game.lightDirty = true;
  if (quiet) return;
  mine(run).fallen[k2(c.x, c.z)] = true;
  const r = game.renderer;
  r.emit(c.x, FY + 0.6, c.z, { n: 40, color: ['#ffffff', '#c0d4e4', '#e4f0fa', '#ffc85a'], up: 50, speed: 70, gravity: 160, life: 1, glow: true });
  r.effect?.({ type: 'ring', wx: c.x, wy: FY, wz: c.z, r0: 2, r1: 26, color: ['#ffffff', '#c0d4e4'], life: 0.5, oy: 3, flat: 0.5, thick: 2 });
  game.audio?.play('shatter', c);
  game.shake = Math.min(1.2, (game.shake || 0) + 0.6);
  let n = 0;
  for (const e of [...game.everyone(), ...game.creatures]) {
    if (!e || e.dead || dist(e, c) > 1 || Math.abs(e.y - FY) > 1) continue;
    const big = e.isBoss ? 10 : SALTMADE.has(e.species) ? 8 : 6;
    game.damage(e, big, null);
    e.stunT = Math.max(e.stunT || 0, e.isBoss ? 1 : 1.6);
    if (e.kind !== 'player') n++;
  }
  r.floatText(c.x, FY + 2.6, c.z, n ? 'the chandelier comes down on them!' : 'the chandelier comes down!', '#ffffff');
  const T = swT(run);
  if (!T.told.chandelier) {
    T.told.chandelier = true;
    game.ui.msg('You slip the rope, and the chandelier comes down in a crash of crystal on whatever was under it.', '#f0f0ff', true);
  }
}

// ------------------------------------------------------------ the sluice
// The lake drains into the old sump: its bed laid bare (wet, but it'll
// bear you), the flooded arch clear; and what lay drowned on its bed gets
// up.
export function drain(run, wh, quiet) {
  const game = run.game;
  const w = game.world;
  const lake = (run.data.lake || []).filter((q) => q.room === undefined || q.room === wh.room);
  const here = lake.filter((q) => Math.abs(q.x - wh.x) <= 24 && Math.abs(q.z - wh.z) <= 18);
  for (const q of here) if (w.getBlock(q.x, FY - 2, q.z) === B.sw_brine) w.setBlock(q.x, FY - 2, q.z, B.sw_wetbed);
  for (const a of run.data.arches || []) {
    if (a.room !== wh.room) continue;
    for (const y of [FY, FY + 1]) if (w.getBlock(a.x, y, a.z) === B.sw_flooded) w.setBlock(a.x, y, a.z, B.air);
  }
  game.lightDirty = true;
  if (quiet) return;
  const r = game.renderer;
  game.audio?.play('rumble', wh);
  game.audio?.play('splash', wh);
  game.shake = Math.min(1, (game.shake || 0) + 0.4);
  for (const q of here) if ((q.x + q.z) % 3 === 0) r.emit(q.x, FY - 1, q.z, { n: 3, color: ['#4e7c7a', '#b0d8d0', '#ffffff'], up: 14, speed: 10, life: 0.8 });
  game.ui.msg('You walk the treadwheel round. Somewhere a sluice groans open, and the lake goes down, sucking, into the dark; the arch at its end comes clear. On the bed it leaves, something white is getting up.', '#e8f0f0', true);
  // (The drowned on its bed, up out of it.)
  const pool = here.slice().sort((a, c) => (a.x * 7 + a.z * 13) % 11 - (c.x * 7 + c.z * 13) % 11);
  let n = 0;
  for (const q of pool) {
    if (n >= 2 + Math.min(1, run.floor || 0)) break;
    if (game.occ?.get(game.occKey(q.x, FY - 1, q.z))) continue;
    if (dist(q, wh) < 3) continue;
    const c = run.spawn('salt_wight', q.x, FY - 1, q.z, { room: wh.room, variant: 3 });
    if (c) {
      c.target = game.player;
      r.emit(q.x, FY - 0.6, q.z, { n: 14, color: ['#ffffff', '#b0d8d0'], up: 30, speed: 30, life: 0.7 });
      n++;
    }
  }
}

// ------------------------------------------------------------ the singing
// A singing crystal rings: everything of salt by it shakes still, the
// blooms' growth shatters; and everything near hears it.
export function ring(run, at, by = null) {
  const game = run.game;
  const w = game.world;
  const T = swT(run);
  const kk = k2(at.x, at.z);
  if ((T.rang[kk] || 0) > (game.time || 0)) {
    game.ui.msg('The crystal is still humming. It won\'t ring again yet.', '#e0d8f8');
    return false;
  }
  T.rang[kk] = (game.time || 0) + 8;
  const r = game.renderer;
  r.effect?.({ type: 'ring', wx: at.x, wy: FY, wz: at.z, r0: 4, r1: 60, color: ['#e0d8f8', '#ffffff'], life: 0.9, oy: 6, flat: 0.5, thick: 2 });
  r.emit(at.x, FY + 1.6, at.z, { n: 24, color: ['#e0d8f8', '#ffffff', '#f0c0d0'], up: 30, speed: 40, life: 1, glow: true });
  r.floatText(at.x, FY + 3, at.z, 'the crystal rings!', '#e0d8f8');
  game.audio?.play('chime', at);
  game.audio?.play('salt_song', at);
  let shook = 0;
  for (const c of game.creatures) {
    if (c.dead) continue;
    const d = dist(c, at);
    if (SALTMADE.has(c.species) && d <= 5) {
      c.stunT = Math.max(c.stunT || 0, c.isBoss ? 1.2 : 2.5);
      r.emit(c.x, c.y + 1, c.z, { n: 8, color: ['#ffffff', '#e0d8f8'], up: 10, speed: 12, life: 0.5 });
      if (!c.isBoss) shook++;
    }
    // (The lion's haze is the salt's song gone wrong: a true note shakes it
    // off, and it stands there, plain, a moment.)
    if (c.species === 'mirage_lion' && d <= 8) {
      c.stunT = Math.max(c.stunT || 0, 1.5);
      r.floatText(c.x, c.y + 3, c.z, 'the true note breaks its haze!', '#fff0c0');
    }
    // (And everything that hears it wakes.)
    if (d <= 10 && c.dormant && !c.waiting) run.wake?.(c);
    if (d <= 10 && c.species === 'pale_flamingo' && !c.fled) honk(run, c, by);
  }
  // The blooms' growth, shattered.
  for (const c of game.creatures) {
    if (c.species !== 'salt_bloom' || !c.grown) continue;
    c.grown = c.grown.filter((g) => {
      if (dist(g, at) > 5) return true;
      shatter(game, g);
      return false;
    });
  }
  for (let dz = -5; dz <= 5; dz++) {
    for (let dx = -5; dx <= 5; dx++) {
      const x = at.x + dx;
      const z = at.z + dz;
      if (w.getBlock(x, FY, z) === B.sw_growth) shatter(game, { x, y: FY, z });
    }
  }
  if (!T.told.ring) {
    T.told.ring = true;
    game.ui.msg(`The crystal rings, a high sweet note that goes on and on. ${shook ? 'Everything made of salt about it shakes, and stands still.' : 'The salt in the walls answers it.'} (And everything down here heard it.)`, '#e0d8f8', true);
  }
  return true;
}
function shatter(game, g) {
  const w = game.world;
  if (w.getBlock(g.x, g.y, g.z) !== B.sw_growth) return;
  w.setBlock(g.x, g.y, g.z, B.air);
  game.renderer.emit(g.x, g.y + 0.6, g.z, { n: 10, color: ['#ffffff', '#f0d8e0', '#c0d4e4'], up: 20, speed: 26, gravity: 100, life: 0.6, glow: true });
}
// A bloom broken: all it grew crumbles.
export function crumble(run, c) {
  const game = run.game;
  for (const g of c.grown || []) shatter(game, g);
  c.grown = [];
  game.renderer.emit(c.x, c.y + 0.6, c.z, { n: 24, color: ['#ffffff', '#f0d8e0', '#4e7c7a'], up: 30, speed: 40, gravity: 100, life: 0.8, glow: true });
  game.audio?.play('shatter', c);
}

// ------------------------------------------------------------ the flock
// A flamingo startled: it honks, the flock with it takes fright, and
// everything near wakes.
export function honk(run, c, by = null) {
  const game = run.game;
  const T = swT(run);
  const flock = game.creatures.filter((o) => !o.dead && o.species === 'pale_flamingo' && !o.fled && dist(o, c) <= 6);
  if (!flock.includes(c)) flock.push(c);
  for (const o of flock) {
    o.fled = true;
    o.fleeFrom = by || o.fleeFrom || null;
    o.fleeT = 6;
    game.renderer.emit(o.x, o.y + 1.4, o.z, { n: 8, color: ['#ffffff', '#f8d0d8', '#e8a0b0'], up: 30, speed: 30, life: 0.6 });
  }
  game.renderer.floatText(c.x, c.y + 2.6, c.z, 'HONK! HONK!', '#f8d0d8');
  game.audio?.play('honk', c);
  game.audio?.play('flap', c);
  let woke = 0;
  for (const o of game.creatures) {
    if (o.dead || o.waiting || !o.dormant || dist(o, c) > 12) continue;
    run.wake?.(o);
    if (by) o.target = by;
    woke++;
  }
  if (!T.told.honk) {
    T.told.honk = true;
    game.ui.msg(`The flamingos take fright, honking and flapping, white wings everywhere. ${woke ? 'All round, things that were still are getting up.' : 'The noise goes on and on down the halls.'}`, '#f8d0d8', true);
  }
}

// ------------------------------------------------------------ each step
export function tick(run, dt, party = null) {
  if (!isSalt(run)) return;
  const game = run.game;
  const w = game.world;
  const T = swT(run);
  const r = game.renderer;
  const who = (party || [game.player]).filter((p) => p && !p.dead);
  const mobs = run.creatures();
  const inBrine = (e) => e.y === FY - 1 && w.getBlock(e.x, FY - 2, e.z) === B.sw_brine;
  for (const e of [...who, ...mobs]) {
    if (!e || e.dead) continue;
    // The salt wights and rakers mend in it.
    if (SALTMADE.has(e.species) && e.species !== 'salt_bloom' && inBrine(e)) {
      const t = (T.mend.get(e) ?? 1) - dt;
      if (t <= 0 && e.hp < e.maxHp) {
        T.mend.set(e, 1);
        e.hp = Math.min(e.maxHp, e.hp + (e.isBoss ? 3 : 1));
        r.emit(e.x, e.y + 0.6, e.z, { n: 4, color: ['#ffffff', '#b0d8d0'], up: 12, speed: 6, life: 0.5, glow: true });
        if (!T.told.mend && who.some((p) => dist(p, e) <= 10)) {
          T.told.mend = true;
          game.ui.msg('The salt wight wades into the brine, and the salt in it knits its cracks shut. (Keep them out of the brine.)', '#e8f0f0', true);
        }
      } else T.mend.set(e, t);
    }
    // Wading it, the salt crusts on you, till you're set fast.
    if (CRUSTPROOF.has(e.species)) continue;
    if (inBrine(e)) {
      e.crust = (e.crust || 0) + dt;
      e.slowT = Math.max(e.slowT || 0, 0.3 + Math.min(1, e.crust / SET_AFTER) * 0.5);
      if ((e.crustFx = (e.crustFx || 0) - dt) <= 0) {
        e.crustFx = 0.5;
        r.emit(e.x, e.y + 0.4, e.z, { n: 3, color: ['#ffffff', '#e8e4e4'], up: 6, speed: 6, life: 0.5 });
      }
      if (e.kind === 'player' && !T.told.brine) {
        T.told.brine = true;
        game.ui.msg('The brine is thick and cold, and where it touches you the salt begins to grow. (Out of it, before you\'re set fast!)', '#e8f0f0', true);
      }
    } else if (e.crust > 0) e.crust = Math.max(0, e.crust - dt * 0.6);
    if (e.crust >= SET_AFTER) {
      e.crust = 0;
      if (e.kind === 'player') e.rootT = Math.max(e.rootT || 0, 1.2);
      else e.stunT = Math.max(e.stunT || 0, 1.2);
      r.floatText(e.x, e.y + 2.4, e.z, 'set fast in the salt!', '#ffffff');
      r.emit(e.x, e.y + 1, e.z, { n: 16, color: ['#ffffff', '#f0ecec', '#c0d4e4'], up: 16, speed: 16, life: 0.7, glow: true });
      game.audio?.play('tink', e);
    }
  }
}
