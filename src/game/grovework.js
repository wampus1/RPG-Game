// (Round 100) The Wildwood Hollow at work (laid out by world/deeps/
// grove.js): the ring of toadstools that takes you to its own glade and
// puts you back; the snare roots that catch you; the puffballs and the
// drowsebloom's pollen (slow in it); the hornets' nest, broken, and its
// swarm after whoever's nearest; the offering stone (leave it food, and the
// hob draws the roots back from what they keep); the sun-seed, found and
// planted in the shaft of daylight, growing roots up the bank; a toadstool
// of a ring broken, and the wood taking it ill; the hob struck, and the
// whole wood turning on you.
//
// What's been done (fed, grown, taken) is kept in the floor's state, and
// put back when the floor's made again (see restore).
import { FY } from '../world/dungeongen.js';
import { B, BLOCKS } from '../world/blocks.js';
import { ITEMS } from '../world/items.js';
import { addItem, countItem, removeItem } from './inventory.js';
import { addHazard } from '../entities/monsters.js';

const k2 = (x, z) => `${x},${z}`;
const near = (a, b, r) => Math.max(Math.abs(a.x - b.x), Math.abs(a.z - b.z)) <= r;
const mine = (run) => (run.state.grove ||= { fed: {}, grown: {}, taken: {}, burst: {} });
// What's going on about the floor this visit (not saved).
export const grT = (run) => (run.groveT ||= { clouds: [], swarms: [], grow: [], opening: [], cd: new Map(), snareCd: {}, told: {} });
const isGrove = (run) => run && run.rec && run.rec.type === 'grove';
const runOf = (game, x) => game.runAt?.(x) || game.dungeon || null;

// ------------------------------------------------------------ put back
export function restore(run) {
  if (!isGrove(run)) return;
  const w = run.game.world;
  const S = mine(run);
  for (const h of run.data.hobs || []) {
    if (!S.fed[k2(h.stone.x, h.stone.z)]) continue;
    w.setState(h.stone.x, FY, h.stone.z, true);
    if (h.door) for (const y of [FY, FY + 1]) w.setBlock(h.door.x, y, h.door.z, B.air);
  }
  for (const s of run.data.sunwells || []) {
    if (s.seed && S.taken[k2(s.seed.x, s.seed.z)] && w.getBlock(s.seed.x, FY, s.seed.z) === B.gr_seedpod) w.setBlock(s.seed.x, FY, s.seed.z, B.air);
    if (S.grown[k2(s.beam.x, s.beam.z)]) grow(run, s, true);
  }
  for (const key of Object.keys(S.burst)) {
    const [x, z] = key.split(',').map(Number);
    if (w.getBlock(x, FY, z) === B.gr_puffball) w.setState(x, FY, z, true);
  }
}

// ------------------------------------------------------------ the pollen
// A cloud of drowsy pollen (or a puffball's spores) a while, `rad` round:
// whoever of you is in it, slow.
export function groveCloud(run, x, z, rad, dur, by = null) {
  grT(run).clouds.push({ x, z, rad, t: dur, by });
  const r = run.game.renderer;
  for (let i = 0; i < 26; i++) {
    const a = Math.random() * Math.PI * 2;
    const d = Math.random() * rad;
    r.emit(x + Math.cos(a) * d, FY + 0.4 + Math.random(), z + Math.sin(a) * d, { n: 1, color: ['#f0e0a0', '#e8d070', '#fff8d0'], up: 6, speed: 8, gravity: -2, life: 1.6, shape: 'puff', glow: Math.random() < 0.4 });
  }
}

// The hob wronged: every one of the wood on the floor awake, and after you.
export function groveWoodTurns(run, src) {
  const game = run.game;
  if (run.woodTurned) return;
  run.woodTurned = true;
  game.ui.msg('A sound goes through the roots like a breath drawn in. The wood has turned on you.', '#e08060', true);
  game.audio?.play('whisper', src);
  for (const c of run.creatures()) {
    if (c.dead || c.peaceful || c.isBoss) continue;
    if (c.dormant) run.wake(c);
    c.target = src;
  }
}

// ------------------------------------------------------------ clicked
export function sayOf(b) {
  switch (b.name) {
    case 'gr_rulestone': return 'The rules are cut too deep in the moss to read.';
    case 'gr_ragroot': return 'Rags, hundreds of them, tied on a dead root. The words on them have run.';
    case 'gr_greenman': return 'A face cut in the root: leaves for hair, leaves for a beard.';
    case 'gr_kept':
    case 'gr_keptroot': return 'A face in the bark, eyes shut. Breathing, slowly, the way a tree breathes.';
    case 'gr_stump': return 'Notches down its side, in rows of seven.';
    case 'gr_camp': return 'A bedroll, rotted through, and a fire that went out a long time ago.';
    default: return null;
  }
}

export function interact(run, x, y, z, b) {
  if (!isGrove(run)) return false;
  const game = run.game;
  const p = game.player;
  switch (b.interact) {
    // The offering stone: food left on it (whatever you've got to eat).
    case 'gr_offering': {
      const S = mine(run);
      const h = (run.data.hobs || []).find((q) => q.stone.x === x && q.stone.z === z);
      if (S.fed[k2(x, z)]) {
        game.ui.msg('The bowl is full, and something in the roots is content.', '#c8e890');
        return true;
      }
      const slot = p.inv.find((s) => s && ITEMS[s.item] && ITEMS[s.item].kind === 'food');
      if (!slot) {
        game.ui.msg('A bowl on a flat stone, empty and dry. Nobody has left anything here in a long while.', '#c8c8b8');
        return true;
      }
      const it = slot.item;
      removeItem(p.inv, it, 1);
      S.fed[k2(x, z)] = true;
      game.world.setState(x, FY, z, true);
      game.audio?.play('chime', { x, z });
      game.renderer.emit(x, FY + 1, z, { n: 14, color: ['#fff4a0', '#c8f080', '#ffffff'], up: 30, speed: 20, life: 1, glow: true });
      const hob = run.creatures().find((c) => c.species === 'hob' && !c.dead && !c.wronged);
      game.ui.msg(`You leave ${ITEMS[it].name.toLowerCase()} in the bowl.${hob ? ' The hob creeps up, sniffs it, and nods to you, very gravely.' : ' Something in the roots sighs.'}`, '#c8e890');
      if (hob) hob.say?.(['Kind. You\'re kind.', 'The old way. Nobody does the old way.', 'This way, this way.'][Math.floor(Math.random() * 3)], 2.4, '#c8e890');
      if (h && h.door) grT(run).opening.push({ ...h.door, t: 1.6 });
      return true;
    }
    // The shaft of daylight: the sun-seed planted in its bed, or not.
    case 'gr_sunbed': {
      const s = (run.data.sunwells || []).find((q) => q.beam.x === x && q.beam.z === z);
      if (!s) return false;
      if (mine(run).grown[k2(x, z)]) return true;
      if (countItem(p.inv, 'sun_seed') <= 0) {
        game.ui.msg('Daylight, real daylight, falling through a hole in the roots onto a bed of turned earth. Something was meant to grow here.', '#f0e8b0');
        return true;
      }
      removeItem(p.inv, 'sun_seed', 1);
      mine(run).grown[k2(x, z)] = true;
      game.world.setBlock(x, FY, z, B.gr_sprout);
      grT(run).grow.push({ s, t: 0 });
      game.ui.msg('You press the sun-seed into the warm earth. It splits at once, and a shoot comes up, reaching for the light.', '#f0e8b0');
      game.audio?.play('crop', { x, z });
      return true;
    }
    // The seed pod: taken up.
    case 'gr_seedpod': {
      if (addItem(p.inv, 'sun_seed', 1) > 0) {
        game.ui.msg('You\'ve no room to carry it.', '#c8c8b8');
        return true;
      }
      game.world.setBlock(x, FY, z, B.air);
      mine(run).taken[k2(x, z)] = true;
      game.ui.msg('A seed pod the size of your fist, golden and warm. It wants the sun.', '#f0e8b0');
      game.audio?.play('pickup', { x, z });
      return true;
    }
  }
  return false;
}

// The roots climb the bank (at once, when it's put back).
function grow(run, s, now = false) {
  const game = run.game;
  const w = game.world;
  const { x, z } = s.beam;
  for (const y of [FY, FY + 1]) w.setBlock(x, y, z, B.gr_rootladder, s.rot);
  if (now) return;
  for (let i = 0; i < 24; i++) game.renderer.emit(x, FY + Math.random() * 2, z, { n: 1, color: ['#93703f', '#55822c', '#f0d060'], up: 20, speed: 20, life: 0.8, glow: Math.random() < 0.3 });
  game.ui.msg('The shoot thickens, and splits into roots, and the roots climb the bank like hands, and hold.', '#f0e8b0');
  game.audio?.play('creak', { x, z });
}

// One of the wood's own fallen.
export function onKill(run, e) {
  if (!isGrove(run)) return;
  const game = run.game;
  if (e.species === 'glimmer') game.renderer.emit(e.x, e.y + 1, e.z, { n: 18, color: ['#fff4a0', '#ffd860', '#ffffff'], up: 30, speed: 60, life: 0.6, glow: true });
  if (e.species === 'hob') groveWoodTurns(run, game.player);
}

// ------------------------------------------------------------ broken
// Something of the wood's broken (see game.breakBlock): a hornets' nest, a
// puffball, a toadstool of a ring.
export function groveBroken(game, x, y, z, id) {
  const run = runOf(game, x);
  if (!isGrove(run)) return;
  const T = grT(run);
  if (id === B.gr_hornets) {
    T.swarms.push({ x: x + 0.5, z: z + 0.5, t: 9, hitT: 0 });
    game.ui.msg('The nest splits, and the hornets come boiling out of it!', '#f0d060');
    game.audio?.play('buzz', { x, z });
  } else if (id === B.gr_puffball) {
    groveCloud(run, x, z, 1.8, 4);
  } else if (id === B.gr_toadstool && (run.data.rings || []).some((r) => Math.hypot((x - r.x) / (r.rx + 1), (z - r.z) / (r.rz + 1)) <= 1.3)) {
    // (A toadstool of a ring: the wood takes it ill.)
    const p = game.player;
    const tiles = [];
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) if (dx || dz) tiles.push({ x: p.x + dx, z: p.z + dz });
    addHazard(game, { by: null, tiles, y: p.y, dur: 0.9, dmg: 3, kind: 'erupt', center: { x: p.x, z: p.z }, color: [110, 170, 70], trap: true });
    if (!T.told.ring) {
      T.told.ring = true;
      game.ui.msg('Thorns come up through the moss round you. The wood takes it ill when its rings are broken.', '#e08060', true);
    }
  }
}

// ------------------------------------------------------------ each step
export function tick(run, dt, party) {
  if (!isGrove(run)) return;
  const game = run.game;
  const w = game.world;
  const T = grT(run);
  const r = game.renderer;
  for (const [k, v] of T.cd) if (v - dt <= 0) T.cd.delete(k); else T.cd.set(k, v - dt);
  for (const p of party) {
    if (!p || p.dead) continue;
    // The ring: step in it and you're taken; step in its glade's toadstools
    // and you're put back.
    if (!T.cd.has(p)) {
      for (const g of run.data.rings || []) {
        const inRing = Math.hypot((p.x - g.x) / g.rx, (p.z - g.z) / g.rz) < 0.62;
        if (inRing) {
          T.cd.set(p, 2);
          take(run, p, g.to, 'The light goes green and strange, and the ground tips, and you are somewhere else.');
          break;
        }
        if (p.x === g.back.x && p.z === g.back.z) {
          T.cd.set(p, 2);
          take(run, p, { x: g.x, z: g.z + Math.ceil(g.rz) + 1 }, 'The toadstools close round you, and you are back where you were. Your hair is full of pollen.');
          break;
        }
      }
    }
    // A snare root: caught.
    const at = w.getBlock(p.x, FY, p.z);
    if (at === B.gr_snare && !(T.snareCd[k2(p.x, p.z)] > 0)) {
      T.snareCd[k2(p.x, p.z)] = 8;
      p.grabbedT = Math.max(p.grabbedT || 0, 1.6);
      r.floatText(p.x, p.y + 2.4, p.z, 'the roots catch you!', '#a0d070');
      r.emit(p.x, FY + 0.3, p.z, { n: 12, color: ['#6a4b2c', '#93703f', '#35561e'], up: 20, speed: 30, life: 0.6 });
      game.audio?.play('creak', p);
      // (The wood knows where its snares are, and comes to see.)
      for (const c of run.creatures()) if (!c.dead && !c.peaceful && c.dormant && near(c, p, 6)) run.wake(c);
    }
    // A puffball trodden on: burst.
    if (at === B.gr_puffball && !w.getState?.(p.x, FY, p.z)) {
      w.setState(p.x, FY, p.z, true);
      mine(run).burst[k2(p.x, p.z)] = true;
      groveCloud(run, p.x, p.z, 1.8, 4);
      r.floatText(p.x, p.y + 2.4, p.z, 'puff!', '#e8d070');
    }
  }
  for (const k of Object.keys(T.snareCd)) if ((T.snareCd[k] -= dt) <= 0) delete T.snareCd[k];
  // The pollen: whoever of you is in it, drowsy.
  for (const c of T.clouds) {
    c.t -= dt;
    if (Math.random() < dt * 10) {
      const a = Math.random() * Math.PI * 2;
      const d = Math.random() * c.rad;
      r.emit(c.x + Math.cos(a) * d, FY + 0.3 + Math.random() * 1.2, c.z + Math.sin(a) * d, { n: 1, color: ['#f0e0a0', '#e8d070'], up: 3, speed: 4, gravity: -1, life: 1.4, shape: 'puff' });
    }
    for (const p of party) {
      if (!p || p.dead || Math.hypot(p.x - c.x, p.z - c.z) > c.rad) continue;
      p.slowT = Math.max(p.slowT || 0, 0.6);
      p.drowsyT = Math.max(p.drowsyT || 0, 0.6);
      if (!(p.drowsyNote > 0)) {
        p.drowsyNote = 1.6;
        r.floatText(p.x, p.y + 2.4, p.z, 'drowsy...', '#e8d070');
      }
    }
  }
  for (const p of party) if (p && p.drowsyNote > 0) p.drowsyNote -= dt;
  T.clouds = T.clouds.filter((c) => c.t > 0);
  // The hornets: after whoever's nearest, stinging.
  for (const s of T.swarms) {
    s.t -= dt;
    s.hitT -= dt;
    const all = [...party, ...run.creatures()].filter((e) => e && !e.dead && !e.peaceful && e.species !== 'glimmer');
    const tgt = all.sort((a, b) => Math.hypot(a.x - s.x, a.z - s.z) - Math.hypot(b.x - s.x, b.z - s.z))[0];
    if (tgt) {
      const dx = tgt.x + 0.5 - s.x;
      const dz = tgt.z + 0.5 - s.z;
      const d = Math.hypot(dx, dz) || 1;
      const sp = Math.min(d, 3.2 * dt);
      s.x += (dx / d) * sp;
      s.z += (dz / d) * sp;
      if (d < 1.2 && s.hitT <= 0) {
        s.hitT = 0.8;
        game.damage(tgt, 1, null);
        r.floatText(tgt.x, tgt.y + 2.4, tgt.z, 'stung!', '#f0d060');
      }
    }
    for (let i = 0; i < 2; i++) r.emit(s.x - 0.5 + Math.random(), FY + 0.6 + Math.random() * 1.2, s.z - 0.5 + Math.random(), { n: 1, color: ['#f0d060', '#1a1610'], up: 0, speed: 30, gravity: 0, life: 0.25 });
  }
  T.swarms = T.swarms.filter((s) => s.t > 0);
  // The roots drawing back from what they keep.
  for (const o of T.opening) {
    o.t -= dt;
    if (Math.random() < dt * 12) r.emit(o.x, FY + Math.random() * 2, o.z, { n: 1, color: ['#6a4b2c', '#93703f'], up: 10, speed: 20, life: 0.5 });
    if (o.t <= 0) {
      for (const y of [FY, FY + 1]) if (BLOCKS[w.getBlock(o.x, y, o.z)].name === 'gr_rootdoor') w.setBlock(o.x, y, o.z, B.air);
      game.ui.msg('With a sound like a long breath let out, the roots in the wall draw back.', '#c8e890');
      game.audio?.play('creak', o);
      game.lightDirty = true;
    }
  }
  T.opening = T.opening.filter((o) => o.t > 0);
  // The sun-seed growing.
  for (const g of T.grow) {
    g.t += dt;
    const { x, z } = g.s.beam;
    if (g.t > 1.6 && !g.tall) {
      g.tall = true;
      w.setState(x, FY, z, true);
    }
    if (Math.random() < dt * 8) r.emit(x, FY + 0.5 + Math.random(), z, { n: 1, color: ['#f0d060', '#c8f080'], up: 12, speed: 8, life: 0.8, glow: true });
    if (g.t > 3.4) {
      g.done = true;
      grow(run, g.s);
    }
  }
  T.grow = T.grow.filter((g) => !g.done);
}

// Taken (or put back): the green light, and there.
function take(run, p, to, line) {
  const game = run.game;
  const r = game.renderer;
  const s = game.findFreeSpot(to.x, to.z, 3) || { x: to.x, y: FY, z: to.z };
  r.emit(p.x, p.y + 1, p.z, { n: 24, color: ['#c8f080', '#fff4a0', '#80e0c0'], up: 30, speed: 50, life: 0.8, glow: true });
  if (p === game.player) game.teleportPlayer(s.x, s.y, s.z);
  else p.teleport?.(s.x, s.y, s.z);
  r.emit(s.x, s.y + 1, s.z, { n: 24, color: ['#c8f080', '#fff4a0', '#80e0c0'], up: 30, speed: 50, life: 0.8, glow: true });
  game.audio?.play('chime', p);
  if (p === game.player) game.ui.msg(line, '#c8f080');
}
