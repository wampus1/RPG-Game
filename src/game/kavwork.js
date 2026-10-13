// (Round 99) What a Kavorent floor does (laid out by world/deeps/kavorent.js;
// its new constructs are in entities/kavmobs.js):
//   the sentinel lenses by the doors: walk in a lens's sight and its eye
//     burns red, and every construct near is woken and sent for you (a
//     while later it goes back to watching); break it, and it's blind;
//   the live cables down a conduit spine's channel: step down among them
//     and they bite (a conductor over them burns hotter);
//   the memory well: its three glyph pillars turned in their order; set to
//     the glyphs its console shows (lit by the archivist when it comes by,
//     or when it falls) the well gives back what it keeps; set all wrong,
//     it pulses, and wakes what's near;
//   the wrecks: whatever of the constructs falls (and the old husks lying
//     about) a reclaimer can build a mite out of;
//   and its papers, on the consoles too.
import { FY, lootTier } from '../world/dungeongen.js';
import { B, META_ROT, META_STATE } from '../world/blocks.js';
import { summon } from '../entities/monsters.js';
import { GLYPHS } from '../world/deeps/kavlore.js';
import { walkTo } from './minework.js';

const key = (x, z) => `${x},${z}`;
const dist = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.z - b.z));
const S = (run) => {
  const D = (run.state.deeps ||= { turned: {}, opened: {}, taken: {}, woke: {} });
  return (D.kav ||= { lit: {}, solved: {}, turns: {}, reclaimed: {}, told: {} });
};
// What's going on on the floor now (not kept).
export function kavT(run) {
  if (!run.kavT) restore(run);
  return run.kavT;
}

// Put back what's been done on this floor; and find its wrecks.
export function restore(run) {
  const w = run.game.world;
  const st = S(run);
  const data = run.data;
  run.kavT = { wrecks: [], lens: {}, pulseT: 0, shockT: 0 };
  if (run.rec.type !== 'kavorent') return;
  for (const [k, rot] of Object.entries(st.turns)) {
    const [x, z] = k.split(',').map(Number);
    if (w.getBlock(x, FY, z) === B.kav_glyph) w.setBlock(x, FY, z, B.kav_glyph, rot & META_ROT);
  }
  for (const k of Object.keys(st.lit)) {
    const [x, z] = k.split(',').map(Number);
    if (w.getBlock(x, FY, z) === B.kav_console) w.setState(x, FY, z, true);
  }
  for (const wl of data.wells || []) if (st.solved[key(wl.x, wl.z)]) giveBack(run, wl, true);
  for (const k of Object.keys(st.reclaimed)) {
    const [x, z] = k.split(',').map(Number);
    if (w.getBlock(x, FY, z) === B.kav_husk) w.setBlock(x, FY, z, B.air);
  }
  // The old husks lying about: wrecks a reclaimer can work.
  const P = data.plan;
  if (P) {
    for (let z = 0; z < P.D; z++) {
      for (let x = 0; x < P.W; x++) {
        if (!P.open[z * P.W + x]) continue;
        const wx = x + data.x0;
        if (w.getBlock(wx, FY, z) === B.kav_husk) run.kavT.wrecks.push({ x: wx, z, husk: true });
      }
    }
  }
}

// The constructs near woken and sent after the nearest of you.
export function kavAlarm(run, at, r = 14, quiet = false) {
  const game = run.game;
  const party = run.partyHere ? run.partyHere() : [game.player];
  const p = party.filter((q) => !q.dead).sort((a, b) => dist(a, at) - dist(b, at))[0] || game.player;
  let n = 0;
  for (const c of run.creatures()) {
    if (c.dead || c.isBoss || c.waiting || c.peaceful || c.S.mode === 'passive' || !c.S.construct || dist(c, at) > r) continue;
    if (c.dormant) run.wake ? run.wake(c) : (c.dormant = 0);
    if (!c.target || c.target.dead) c.target = p;
    n++;
  }
  game.renderer.effect?.({ type: 'ring', wx: at.x, wy: FY + 1, wz: at.z, r0: 4, r1: 56, color: ['#ff5060', '#ffffff'], life: 0.9, oy: -6, flat: 0.5 });
  game.audio?.play('alarm', at);
  if (!quiet) game.ui.msg(n ? 'A tone sounds through the halls: the constructs near are coming for you!' : 'A tone sounds through the halls.', '#ff9aa4', true);
  return n;
}

// Standing (or hanging) over the live cables in a channel.
export function onCables(game, e) {
  const y = Math.round(e.y);
  return y <= FY - 1 && game.world.getBlock(e.x, y - 1, e.z) === B.kav_cables;
}

// The well's console woken (the archivist's come by, or fallen).
export function lightWell(run, x, z) {
  const st = S(run);
  for (const wl of run.data.wells || []) {
    if (!wl.console || wl.console.x !== x || wl.console.z !== z || st.lit[key(x, z)]) continue;
    st.lit[key(x, z)] = true;
    run.game.world.setState(x, FY, z, true);
    run.game.renderer.emit(x, FY + 1.2, z, { n: 10, color: ['#9ef0ff', '#ffffff'], up: 20, speed: 30, life: 0.6, glow: true });
    if (run.partyHere && run.partyHere().some((p) => dist(p, { x, z }) <= 12)) run.game.ui.msg('The well\'s console wakes: glyphs glow on it.', '#a0f4ff');
  }
}

// The well, set right: what it keeps given back (once).
function giveBack(run, wl, quiet = false) {
  const game = run.game;
  const w = game.world;
  for (const p of wl.pillars) w.setState(p.x, FY, p.z, true);
  if (quiet || !wl.cache) return;
  const at = wl.cache;
  w.setBlock(at.x, FY, at.z, B.kav_cache, META_STATE);
  game.renderer.effect?.({ type: 'ring', wx: wl.x, wy: FY, wz: wl.z, r0: 3, r1: 40, color: ['#9ef0ff', '#ffffff'], life: 1, oy: 4, flat: 0.5, thick: 2 });
  game.renderer.emit(wl.x, FY + 2, wl.z, { n: 30, color: ['#9ef0ff', '#ffffff', '#46cfee'], up: 60, speed: 40, life: 1.2, glow: true });
  game.audio?.play('secret');
  const tier = lootTier(run.rec, run.floor) + 1;
  run.dropGear?.({ x: at.x, y: FY, z: at.z }, 1, tier);
  game.spawnDrop('kav_scrap', 2 + Math.floor(Math.random() * 3), at.x, FY, at.z, true);
  if (Math.random() < 0.35) game.spawnDrop('kav_core', 1, at.x, FY, at.z, true);
  game.ui.msg('The three glyphs sing together, and the well gives back what it kept.', '#a0f4ff', true);
}

// A glyph pillar turned to its next glyph.
function turnPillar(run, x, z) {
  const game = run.game;
  const w = game.world;
  const st = S(run);
  const wl = (run.data.wells || []).find((q) => q.pillars.some((p) => p.x === x && p.z === z));
  if (!wl) return;
  if (st.solved[key(wl.x, wl.z)]) {
    game.ui.msg('The pillar is set fast now, its glyph lit.', '#a0f4ff');
    return;
  }
  const rot = ((w.getMeta(x, FY, z) & META_ROT) + 1) % 4;
  w.setBlock(x, FY, z, B.kav_glyph, rot);
  st.turns[key(x, z)] = rot;
  game.audio?.play('rune', { x, z });
  game.renderer.floatText(x, FY + 2.2, z, GLYPHS[rot], '#a0f4ff');
  const touched = wl.pillars.every((p) => st.turns[key(p.x, p.z)] !== undefined);
  const right = wl.pillars.every((p) => (w.getMeta(p.x, FY, p.z) & META_ROT) === p.want);
  if (right) {
    st.solved[key(wl.x, wl.z)] = true;
    giveBack(run, wl);
    return;
  }
  // (All three set, and wrong: it pulses, and what's near wakes.)
  const T = kavT(run);
  if (touched && wl.pillars.every((p) => (w.getMeta(p.x, FY, p.z) & META_ROT) !== p.want) && T.pulseT <= 0) {
    T.pulseT = 12;
    game.renderer.effect?.({ type: 'ring', wx: wl.x, wy: FY, wz: wl.z, r0: 3, r1: 50, color: ['#ff5060', '#ffffff'], life: 0.8, oy: 4, flat: 0.5, thick: 2 });
    game.ui.msg('The well pulses, wrong-sounding. Something stirs.', '#ff9aa4');
    for (let i = 0; i < 2; i++) {
      const m = summon(game, 'mite', { x: wl.x, y: FY, z: wl.z }, 3, { level: run.rec.level || 1 });
      if (m) m.target = game.player;
    }
    kavAlarm(run, { x: wl.x, z: wl.z }, 9, true);
  }
}

// Something of the ruin's clicked (true if it was).
export function interact(run, x, y, z, b) {
  if (run.rec.type !== 'kavorent') return false;
  const game = run.game;
  switch (b.interact) {
    case 'kav_glyph':
      turnPillar(run, x, z);
      return true;
    case 'kav_well': {
      const st = S(run);
      const wl = (run.data.wells || []).find((q) => q.x === x && q.z === z);
      game.ui.msg(wl && st.solved[key(wl.x, wl.z)] ? 'The well\'s light runs quiet and even now.' : 'Light rises out of the well in a slow column, and glyphs drift up in it. Three pillars stand before it, waiting to be turned.', '#a0f4ff');
      return true;
    }
    case 'kav_console': {
      // The well's: dark till it's woken; then its glyphs.
      const wl = (run.data.wells || []).find((q) => q.console && q.console.x === x && q.console.z === z);
      if (wl) {
        if (S(run).lit[key(x, z)]) game.ui.openSign(wl.text.lines, wl.text.title);
        else game.ui.msg('The console is dark. Only the hand of its keeper would wake it.', '#7ee4f8');
        return true;
      }
      // A work log, a warning: what's written on it.
      const t = (run.data.lore || []).find((q) => q.x === x && q.z === z);
      if (t) {
        game.ui.openSign(t.lines, t.title);
        return true;
      }
      return false;
    }
  }
  return false;
}

// What one of its things says, with nothing written on it.
export function sayOf(b) {
  switch (b.name) {
    case 'kav_crate':
      return 'Sealed with a glyph you can\'t read. Something shifts inside when you knock.';
    case 'kav_pod':
      return 'Behind the frost, a face, calm. The plate at its foot has worn smooth.';
    case 'kav_pod_broken':
      return 'Cracked from inside. Empty.';
    case 'kav_mural':
      return 'Names, in rows of light, more than you could read in a lifetime.';
    case 'kav_orrery':
      return 'Rings within rings, turning round a model of the spire.';
  }
  return null;
}

// One of them fallen: a wreck to be worked; the archivist, and its light
// passes to the well's console.
export function onKill(run, e) {
  if (run.rec.type !== 'kavorent' || !e.S) return;
  if (e.species === 'archivist') {
    for (const wl of run.data.wells || []) if (wl.console) lightWell(run, wl.console.x, wl.console.z);
    return;
  }
  if (e.S.construct && !e.isBoss && e.species !== 'mite' && e.species !== 'reclaimer') {
    const T = kavT(run);
    T.wrecks.push({ x: e.x, z: e.z });
    if (T.wrecks.length > 24) T.wrecks.shift();
  }
}

// A husk worked into a mite (kept so: it's gone when you come back).
export function reclaimed(run, x, z) {
  S(run).reclaimed[key(x, z)] = true;
}

// The archivist on its round: from console to console, pausing at each;
// at the well's, it wakes the screen. Struck, it flees (see
// entities/kavmobs.js).
const LOOKS = ['*records*', '*reads*', '*the count, checked*', '*catalogues*', '*listens*'];
function archivist(run, c, dt) {
  const game = run.game;
  c.thinkT = 9;
  if (c.fleeT > 0) {
    c.fleeT -= dt;
    const f = c.fleeFrom || game.player;
    if (!c.moving) {
      const sx = Math.sign(c.x - f.x) || 1;
      const sz = Math.sign(c.z - f.z) || 1;
      c.tryStep(c.x + sx, c.z, c.S.step * 0.8) || c.tryStep(c.x, c.z + sz, c.S.step * 0.8) || c.tryStep(c.x - sz, c.z + sx, c.S.step * 0.8);
    }
    return;
  }
  const route = c.route || [];
  if (!route.length) return;
  c.leg ??= 0;
  const goal = route[c.leg % route.length];
  if (dist(c, goal) <= 1) {
    if (!c.moving) c.face(goal.x, goal.z);
    if (!(c.readT > 0)) {
      c.readT = 4;
      game.renderer.floatText(c.x, c.y + 2.6, c.z, LOOKS[Math.floor(Math.random() * LOOKS.length)], '#a0f4ff');
      lightWell(run, goal.x, goal.z);
    }
    c.readT -= dt;
    if (c.readT <= 0) c.leg++;
    return;
  }
  walkTo(c, goal, 1);
}

// --------------------------------------------------------------- each frame
export function tick(run, dt, party) {
  const game = run.game;
  const w = game.world;
  if (run.rec.type !== 'kavorent') return;
  const T = kavT(run);
  if (T.pulseT > 0) T.pulseT -= dt;
  for (const v of [...party, ...game.npcs]) if (v && v.arcCd > 0) v.arcCd -= dt;
  // The lenses: each a while on watch, a while burning once it's seen you.
  for (const L of run.data.lenses || []) {
    if (w.getBlock(L.x, FY, L.z) !== B.kav_lens) continue;
    const k = key(L.x, L.z);
    const s = (T.lens[k] ||= { t: 0 });
    if (s.t > 0) {
      s.t -= dt;
      if (s.t <= 0) w.setState(L.x, FY, L.z, false);
      continue;
    }
    const seen = party.find((p) => !p.dead && dist(p, L) <= 6 && Math.abs(p.y - FY) <= 1.5 && (!game.sim?.lineOfSight || game.sim.lineOfSight(L.x, L.z, p.x, p.z, FY + 1)));
    if (!seen) continue;
    s.t = 18;
    w.setState(L.x, FY, L.z, true);
    game.renderer.floatText(L.x, FY + 3, L.z, 'SEEN', '#ff6070');
    kavAlarm(run, { x: L.x, z: L.z }, 12);
  }
  // The cables: whoever steps down among them is shocked (a pace a second).
  T.shockT -= dt;
  if (T.shockT <= 0) {
    T.shockT = 0.8;
    for (const p of party) {
      if (p.dead || !onCables(game, p)) continue;
      game.damage(p, 2, null);
      p.slowT = Math.max(p.slowT || 0, 1);
      game.renderer.floatText(p.x, p.y + 2.2, p.z, 'live cables!', '#9ef0ff');
      game.renderer.emit(p.x, p.y + 0.4, p.z, { n: 10, color: ['#ffffff', '#9ef0ff', '#46cfee'], up: 30, speed: 50, life: 0.3, glow: true });
      game.audio?.play('thunder', p);
    }
  }
  // (A reclaimer done with a husk: kept so.) The archivists on their rounds.
  for (const c of run.creatures()) {
    if (c.species === 'archivist' && !c.dead && !c.dormant) archivist(run, c, dt);
    if (c.species !== 'reclaimer' || !c.build || !c.build.wreck.husk || c.build.noted) continue;
    c.build.noted = true;
    reclaimed(run, c.build.x, c.build.z);
  }
}
