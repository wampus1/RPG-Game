// (Round 112) The Sundered Reach at work (laid out by world/deeps/rift.js;
// the old works, the rift pairs, the fractures, the echoes, the shards, the
// shard-storms, the gravity wells and the flicker, are still
// game/ancient.js's): the sky-dial (the four sighting-stones round the
// kiva, turned to the signs as the sky stood the night it split, the
// elder's journal has it, and the kiva's lid falls in on what the
// Watchers hid down there); the chasms (step onto the abyss and you fall,
// and come to back where you last stood, hurt; anything that walks,
// knocked in, is gone) and their phase-bridges (there a while, then they
// shimmer, then they're not, then they are again); the weavers' threads
// (strung across the floor at you, sticking where you step in them; a
// shard mote going up snaps any near it); the shardbacks (grazing, let be;
// a burst near them, or a blow, and they turn; one killed goes up in a
// burst of its crystals that cuts whatever's beside it, yours or not); and
// the watchers' echoes (come near one and it lives a moment of their last
// evening at you; kill one and what was in it comes back wrong).
//
// What's been done (the kivas opened) is kept in the floor's state, and
// put back when the floor's made again (see restore).
import { FY } from '../world/dungeongen.js';
import { B, BLOCKS } from '../world/blocks.js';
import { SIGNS, QUARTERS, riftLore } from '../world/deeps/riftlore.js';
import { addHazard } from '../entities/monsters.js';

const k2 = (x, z) => `${x},${z}`;
const dist = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.z - b.z));
const mine = (run) => (run.state.rift ||= { opened: {} });
// What's going on about the floor this visit (not saved).
export const rfT = (run) => (run.riftT ||= { told: {}, safe: new Map(), fallT: new Map(), phase: new Map(), heard: new Set(), later: [], lore: null });
const isRift = (run) => run && run.rec && run.rec.type === 'rift';
export const runOf = (game, x) => game.runAt?.(x) || game.dungeon || null;
const VOID = ['#c8a0ff', '#5ad8f0', '#ffffff'];
const STAR = ['#fff0c0', '#ffd070', '#ffffff'];
const CRYSTAL = [200, 160, 255];
// A phase-bridge's beat: there, shimmering, gone (seconds).
export const BRIDGE_ON = 5;
export const BRIDGE_WARN = 1.2;
export const BRIDGE_OFF = 3;
const CYCLE = BRIDGE_ON + BRIDGE_WARN + BRIDGE_OFF;
// What a fall costs.
export const FALL_DMG = 4;
// How near a burst has to be to snap a thread, or turn a shardback.
const SNAP = 2;
const STIR = 4;

const tell = (run, k, text, color) => {
  const T = rfT(run);
  if (T.told[k]) return;
  T.told[k] = true;
  run.game.ui.msg(text, color, true);
};
export const loreOf = (run) => (rfT(run).lore ||= riftLore(run.rec, run.floor || 0));
const floorAt = (w, x, z) => BLOCKS[w.getBlock(x, FY - 1, z)];
export const overAbyss = (w, e) => e.y <= FY && !!floorAt(w, e.x, e.z)?.abyss;
function spotNear(run, x, z, r = 2) {
  const game = run.game;
  const w = game.world;
  for (let d = 1; d <= r; d++) {
    for (let dz = -d; dz <= d; dz++) {
      for (let dx = -d; dx <= d; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== d) continue;
        const sx = x + dx;
        const sz = z + dz;
        if (BLOCKS[w.getBlock(sx, FY, sz)].solid || BLOCKS[w.getBlock(sx, FY + 1, sz)].solid || !BLOCKS[w.getBlock(sx, FY - 1, sz)].solid || floorAt(w, sx, sz)?.abyss) continue;
        if (game.occupiedBySolid?.(sx, FY, sz)) continue;
        return { x: sx, z: sz };
      }
    }
  }
  return null;
}
export function call(run, species, at, r = 2) {
  const s = spotNear(run, at.x, at.z, r);
  if (!s) return null;
  const c = run.spawn(species, s.x, FY, s.z, {});
  if (c) c.dormant = 0;
  return c;
}

// ------------------------------------------------------------ the sky-dial
function openKiva(run, q, quiet) {
  const game = run.game;
  const w = game.world;
  mine(run).opened[k2(q.c.x, q.c.z)] = true;
  for (const d of q.dials) {
    if (w.getBlock(d.x, FY, d.z) !== B.rf_dial) continue;
    w.setMeta(d.x, FY, d.z, (w.getMeta(d.x, FY, d.z) & ~3) | d.want);
    w.setState(d.x, FY, d.z, true);
  }
  for (const t of q.lid) if (w.getBlock(t.x, FY - 1, t.z) === B.rf_lid) w.setBlock(t.x, FY - 1, t.z, B.air);
  game.lightDirty = true;
  if (quiet) return;
  // What they hid down there, tumbled in.
  for (const [item, n] of q.loot || []) {
    const t = q.lid[Math.floor(Math.random() * q.lid.length)];
    game.spawnDrop(item, n, t.x, FY - 1, t.z, true);
  }
  game.audio?.play('crumble', q.c);
  game.audio?.play('chime', q.c);
  game.shake = Math.min(1, (game.shake || 0) + 0.35);
  game.renderer.emit(q.c.x, FY, q.c.z, { n: 40, color: ['#c89060', '#8a5a3a', '#e0b080'], up: 30, speed: 30, life: 1, shape: 'puff' });
  for (const d of q.dials) game.renderer.emit(d.x, FY + 1.2, d.z, { n: 12, color: STAR, up: 20, speed: 10, life: 0.9, glow: true });
  const L = loreOf(run).story();
  game.ui.msg(`The last stone turns home and all four of them kindle, and the kiva's lid sags, cracks, and falls in with a long sigh of dust. Down there, by what they hid: ${L.lines.join(' ')}`, '#ffd070', true);
}
function turnDial(run, q, d) {
  const game = run.game;
  const w = game.world;
  const m = w.getMeta(d.x, FY, d.z);
  const now = (m + 1) & 3;
  w.setMeta(d.x, FY, d.z, (m & ~3) | now);
  game.audio?.play('stone', d);
  game.renderer.emit(d.x, FY + 1, d.z, { n: 6, color: ['#c89060', '#e0b080'], up: 8, speed: 10, life: 0.5, shape: 'puff' });
  game.renderer.floatText(d.x, FY + 2, d.z, SIGNS[now].name, now === d.want ? '#ffd070' : '#e0c8a8');
  if (q.dials.every((o) => (w.getMeta(o.x, FY, o.z) & 3) === o.want)) {
    openKiva(run, q, false);
    return;
  }
  tell(run, 'dial', `You put your shoulder to the sighting-stone and it grinds round: ${SIGNS[now].name}, ${SIGNS[now].shape}, to the ${QUARTERS[d.quarter]}. (Four stones round the kiva, one to each quarter. How did the sky stand? The elder kept a journal.)`, '#e0c8a8');
}

// ------------------------------------------------------------ the chasms
// A bridge's beat, at this moment: 'on', 'warn' or 'off'.
export function beatOf(t) {
  const u = ((t % CYCLE) + CYCLE) % CYCLE;
  return u < BRIDGE_ON ? 'on' : u < BRIDGE_ON + BRIDGE_WARN ? 'warn' : 'off';
}
function setBridge(run, tiles, on) {
  const w = run.game.world;
  for (const t of tiles) {
    const b = w.getBlock(t.x, FY - 1, t.z);
    if (on && b === B.rf_abyss) w.setBlock(t.x, FY - 1, t.z, B.rf_bridge);
    else if (!on && b === B.rf_bridge) w.setBlock(t.x, FY - 1, t.z, B.rf_abyss);
  }
  run.game.lightDirty = true;
}
// Over the edge: you come to where you last stood, hurt; anything else
// that walks is gone.
function fall(run, e) {
  const game = run.game;
  const T = rfT(run);
  game.renderer.emit(e.x, FY, e.z, { n: 18, color: VOID, up: -20, speed: 20, life: 0.8, glow: true });
  game.audio?.play('whoosh', e);
  if (e.kind !== 'player') {
    game.renderer.floatText(e.x, FY + 1.6, e.z, 'falls into the void', '#c8a0ff');
    game.kill(e, null);
    tell(run, 'knocked', 'It goes over the edge, and falls, and falls, and there is no sound of it landing. (Anything that walks goes the same way: drive them in.)', '#c8a0ff');
    return;
  }
  const s = T.safe.get(e);
  const back = s && !floorAt(game.world, s.x, s.z)?.abyss ? s : spotNear(run, e.x, e.z, 4);
  if (back) e.teleport(back.x, FY, back.z);
  e.grabbedT = 0;
  e.stunT = Math.max(e.stunT || 0, 0.6);
  game.damage(e, FALL_DMG, null);
  game.renderer.floatText(e.x, e.y + 2.4, e.z, 'fell!', '#c8a0ff');
  T.fallT.set(e, 1);
  tell(run, 'fall', 'The floor isn\'t there. You fall into the stars, a long, cold, silent way, and then you are lying where you last stood with the breath knocked out of you. (Keep off the abyss. The bridges come and go: watch them shimmer.)', '#c8a0ff');
}

// ------------------------------------------------------------ the threads
// A thread strung from a weaver toward someone, across the floor.
export function spin(game, c, t, tiles) {
  if (!tiles.length) return null;
  const z = { by: c, tiles, y: c.y, life: 12, kind: 'web', root: 0.9, slow: true, color: [190, 150, 255], thread: true, t: 0, acc: 0 };
  (game.zones ||= []).push(z);
  return z;
}
// A burst: threads near it snap, shardbacks near it turn.
export function burstAt(run, at) {
  const game = run.game;
  let snapped = 0;
  for (const z of game.zones || []) {
    if (!z.thread || z.done || !z.tiles.some((q) => dist(q, at) <= SNAP)) continue;
    z.done = true;
    snapped++;
    for (const q of z.tiles) game.renderer.emit(q.x, FY + 0.4, q.z, { n: 2, color: ['#c8a0ff', '#ffffff'], up: 10, speed: 20, life: 0.4, glow: true });
  }
  if (snapped) {
    game.renderer.floatText(at.x, FY + 2.2, at.z, 'threads snap', '#c8a0ff');
    tell(run, 'snap', 'The mote goes up and the weaver\'s threads near it snap and curl away like burnt hair. (Bring the motes to the threads.)', '#c8a0ff');
  }
  for (const c of run.creatures()) {
    if (c.dead || c.species !== 'shardback' || c.angry || dist(c, at) > STIR) continue;
    c.angry = true;
    c.dormant = 0;
    c.target = nearestOf(run, c) || game.player;
    game.renderer.floatText(c.x, c.y + 2.2, c.z, 'bristles', '#d8c0ff');
  }
}
function nearestOf(run, c) {
  let best = null;
  for (const o of [...run.game.everyone(), ...run.creatures()]) {
    if (!o || o === c || o.dead || o.species === 'shardback' || o.S?.mode === 'passive' || dist(o, c) > 6) continue;
    if (!best || dist(o, c) < dist(best, c)) best = o;
  }
  return best;
}
// A shardback killed: its crystals go up, cutting whatever's by it.
function shatter(run, c) {
  const game = run.game;
  const tiles = [];
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) tiles.push({ x: c.x + dx, z: c.z + dz });
  addHazard(game, { by: null, keep: true, trap: true, tiles, y: c.y, dur: 0.9, dmg: 6, kind: 'burst', center: { x: c.x, z: c.z }, color: CRYSTAL });
  game.renderer.emit(c.x, c.y + 1, c.z, { n: 14, color: ['#d8c0ff', '#ffffff', '#8a60e0'], up: 16, speed: 14, life: 0.9, glow: true });
  tell(run, 'shatter', 'The shardback\'s crystals crack all over as it falls, and hum, and then they go: a burst of glass that cuts whatever\'s beside it. (Step back; or let them be among its enemies when it goes.)', '#d8c0ff');
  // (And the burst stirs the rest of the herd.)
  rfT(run).later.push({ t: 0.95, fn: () => burstAt(run, c) });
}

// ------------------------------------------------------------ the killed
export function onKill(run, e) {
  if (!isRift(run) || !e) return;
  const game = run.game;
  if (e.species === 'shard_mote') burstAt(run, e);
  else if (e.species === 'shardback') shatter(run, e);
  else if (e.species === 'sky_watcher' && !e.wrong) {
    // What was in it comes back wrong.
    const c = call(run, 'echo_shade', e, 1);
    if (c) {
      c.target = game.player;
      c.wrong = true;
      game.renderer.floatText(c.x, c.y + 2.4, c.z, 'it comes back wrong', '#c8a0ff');
    }
    tell(run, 'wrong', 'The echo comes apart under your blow like smoke, and then it pulls itself back together, and it is not the same. (The watchers are only remembering. Let them.)', '#c8a0ff');
  }
}

// ------------------------------------------------------------ put back
export function restore(run) {
  if (!isRift(run)) return;
  const S = mine(run);
  for (const q of run.data.kivas || []) if (S.opened[k2(q.c.x, q.c.z)]) openKiva(run, q, true);
}

// ------------------------------------------------------------ clicked
export function sayOf(b) {
  switch (b.name) {
    case 'rf_mural': return 'Paint on plaster, the sky-disc and the people under it; most of it flaked away.';
    case 'rf_niche': return 'A niche cut in the rock, a jar and a bowl in it, the dust of something in the bowl.';
    case 'rf_glasswall': return 'The red stone gone to black glass here, and stars in the glass, moving.';
    case 'rf_tearwall': return 'A seam in the wall, and through it, nothing at all. It is cold to stand near.';
    default: return null;
  }
}
export function interact(run, x, y, z, b) {
  if (!isRift(run)) return false;
  const game = run.game;
  const S = mine(run);
  switch (b.interact) {
    case 'rf_dial': {
      const q = (run.data.kivas || []).find((o) => o.dials.some((d) => d.x === x && d.z === z));
      const v = game.world.getMeta(x, y, z) & 3;
      if (!q) {
        game.ui.msg(`A sighting-stone, a disc of sandstone on a post, ${SIGNS[v].shape} cut through it: ${SIGNS[v].name}.`, '#e0c8a8');
        return true;
      }
      if (S.opened[k2(q.c.x, q.c.z)]) {
        game.ui.msg(`The sighting-stone of the ${QUARTERS[q.dials.find((d) => d.x === x && d.z === z).quarter]}, ${SIGNS[v].name} on it, lit from inside. The sky as it stood.`, '#ffd070');
        return true;
      }
      turnDial(run, q, q.dials.find((d) => d.x === x && d.z === z));
      return true;
    }
    case 'rf_lid': {
      const q = (run.data.kivas || []).find((o) => o.lid.some((t) => t.x === x && t.z === z));
      game.ui.msg(q ? 'The kiva\'s lid: poles laid close and clay packed over them, a ladder-hole in the middle, stopped with a stone. It won\'t lift. (The sighting-stones round it: turn them to the sky.)' : 'A lid of poles and packed clay, sunk with age.', '#e0c8a8', true);
      return true;
    }
    default: return false;
  }
}

// ------------------------------------------------------------ each frame
export function tick(run, dt, party = null) {
  if (!isRift(run)) return;
  const game = run.game;
  const w = game.world;
  const T = rfT(run);
  const who = (party || [game.player]).filter((p) => p && !p.dead);
  if (!who.length) return;
  const p0 = game.player;
  const mobs = run.creatures();
  // (What's been put off a moment.)
  if (T.later.length) {
    for (const q of T.later) q.t -= dt;
    const due = T.later.filter((q) => q.t <= 0);
    T.later = T.later.filter((q) => q.t > 0);
    for (const q of due) q.fn();
  }
  // The bridges, on their beat.
  T.clock = (T.clock || 0) + dt;
  for (const f of run.data.faults || []) {
    f.bridges.forEach((tiles, i) => {
      const st = beatOf(T.clock + f.beat + i * (CYCLE / 2));
      const was = T.phase.get(tiles) || 'on';
      if (st === was) {
        if (st === 'warn' && Math.random() < dt * 20) {
          const t = tiles[Math.floor(Math.random() * tiles.length)];
          game.renderer.emit(t.x, FY, t.z, { n: 1, color: VOID, up: 10, speed: 8, life: 0.5, glow: true });
        }
        return;
      }
      T.phase.set(tiles, st);
      if (st === 'warn' && who.some((p) => dist(p, tiles[0]) <= 10)) {
        game.renderer.floatText(tiles[0].x, FY + 1.2, tiles[0].z, 'the bridge shimmers', '#c8a0ff');
        game.audio?.play('hum', tiles[0]);
      }
      setBridge(run, tiles, st !== 'off');
      if (st === 'off') tell(run, 'bridge', 'The bridge flickers and is gone, and the stars show through where it was. (It comes back. Cross while it\'s there.)', '#c8a0ff');
    });
  }
  // Over the edge.
  for (const p of who) {
    const ft = (T.fallT.get(p) || 0) - dt;
    T.fallT.set(p, ft);
    if (overAbyss(w, p)) {
      if (ft <= 0 && !p.moving) fall(run, p);
    } else if (p.y === FY && !p.moving) T.safe.set(p, { x: p.x, z: p.z });
  }
  for (const c of mobs) if (!c.dead && !c.S?.floats && !c.isBoss && !c.moving && overAbyss(w, c)) fall(run, c);
  // Webbed: the stalkers know it.
  for (const p of who) {
    if (!(p.grabbedT > 0)) continue;
    for (const c of mobs) {
      if (c.dead || c.species !== 'void_stalker' || c.dormant || dist(c, p) > 7 || (c.blinkCd ?? 9) <= 0.4) continue;
      c.blinkCd = 0.4;
      c.target = p;
      tell(run, 'blink', 'Stuck fast in the thread, you feel something step out of nothing behind you. (The stalkers come for the webbed. Roll free.)', '#c8a0ff');
    }
  }
  // The watchers: come near one and it remembers at you.
  for (const c of mobs) {
    if (c.dead || c.species !== 'sky_watcher' || T.heard.has(c) || dist(c, p0) > 2) continue;
    T.heard.add(c);
    const m = loreOf(run).memory();
    game.renderer.floatText(c.x, c.y + 2.4, c.z, 'remembers', '#ffd8a0');
    game.ui.msg(`The watcher doesn't see you. ${m}`, '#ffd8a0', true);
  }
}
